// api/_utils/filmTape/tapeSize.js
//
// Film Room B1 (Astra F3, criterion 4) — THE TAPE DOCUMENT AGAINST FIRESTORE'S
// SIZE LIMIT. B1 adds two optional sections to the tape: `meetings` (T2) and
// the `tags` section's items and exits. Each is bounded on its own, but the
// bounds do not know the rest of the document, so a near-limit core tape plus
// bounded meetings could pass Firestore's 1 MiB document limit and fail the
// WHOLE write. Before the write — a fresh write and a merge alike
// (tapeMerge.js) — the merged document is estimated against a budget with a
// margin under that limit:
//
//   1. over the budget: `meetings` is dropped — `coverage.meetings` reads
//      unavailable, reason document_size_budget — and the size re-estimated;
//   2. still over: the tag items and exits are dropped the same way
//      (`coverage.tags` unavailable, document_size_budget);
//   3. still over: the core tape alone is over, and it is written as before
//      B1 — Firestore's own limit decides, as it always has.
//
// The estimate is conservative: the larger of Firestore's documented storage
// size (string = UTF-8 bytes + 1, number 8, boolean and null 1, a map's field
// names UTF-8 + 1 each, the document's name + 16, the document + 32) and the
// document's UTF-8 JSON length.

import { coverageOf } from './tapeAssemble.js';
import { TAPE_SUBCOLLECTION } from '../../../src/constants/filmTape.js';

/** Firestore's maximum document size, in bytes. */
export const FIRESTORE_MAX_DOCUMENT_BYTES = 1_048_576;
/** The budget the close pass writes within: the limit less a margin for the estimate. */
export const TAPE_SIZE_BUDGET_BYTES = 950_000;
/** The reason a dropped section's coverage names. */
export const SIZE_BUDGET_REASON = 'document_size_budget';
export const MEETINGS_OVER_BUDGET_NOTE = `meetings not stored: the tape would pass its document size budget (${SIZE_BUDGET_REASON})`;
export const TAGS_OVER_BUDGET_NOTE = `stalled unavailable: the tape would pass its document size budget (${SIZE_BUDGET_REASON})`;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const utf8 = (s) => Buffer.byteLength(s, 'utf8');

/** A value's size by Firestore's documented storage-size rules. */
export function firestoreValueBytes(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return utf8(v) + 1;
  if (v instanceof Date) return 8;
  if (Array.isArray(v)) return v.reduce((n, x) => n + firestoreValueBytes(x), 0);
  if (typeof v === 'object') return Object.entries(v).reduce((n, [k, x]) => (x === undefined ? n : n + utf8(k) + 1 + firestoreValueBytes(x)), 0);
  return 8;
}

/** The tape document's estimated size: agentBattles/{battleId}/tape/{etDate}, conservatively. */
export function tapeDocumentBytes(doc) {
  const name = ['agentBattles', String(doc?.battleId ?? ''), TAPE_SUBCOLLECTION, String(doc?.etDate ?? '')].reduce((n, s) => n + utf8(s) + 1, 16);
  let json;
  try { json = utf8(JSON.stringify(doc)); } catch { json = Infinity; }
  return Math.max(name + firestoreValueBytes(doc) + 32, json);
}

const overBudget = (cov, sources, note) => coverageOf('unavailable', {
  span: isObj(cov) ? cov.span ?? null : null,
  sources: isObj(cov) && Array.isArray(cov.sources) ? cov.sources : sources,
  note,
});

/**
 * The document the write sends, within `budget` where B1's optional sections
 * can make it so (steps 1–3 above). Returns `doc` itself when it fits.
 */
export function fitTapeToBudget(doc, { budget = TAPE_SIZE_BUDGET_BYTES } = {}) {
  if (!isObj(doc) || tapeDocumentBytes(doc) <= budget) return doc;
  let out = doc;
  if (Array.isArray(out.meetings) && out.meetings.length) {
    const coverage = isObj(out.coverage) ? out.coverage : {};
    out = { ...out, meetings: [], coverage: { ...coverage, meetings: overBudget(coverage.meetings, ['gameplanMeetingHistory', 'gameplanMeeting'], MEETINGS_OVER_BUDGET_NOTE) } };
    if (tapeDocumentBytes(out) <= budget) return out;
  }
  if (isObj(out.tags) && ((Array.isArray(out.tags.items) && out.tags.items.length) || (Array.isArray(out.tags.exits) && out.tags.exits.length))) {
    const coverage = isObj(out.coverage) ? out.coverage : {};
    out = { ...out, tags: { ...out.tags, items: null, exits: null }, coverage: { ...coverage, tags: overBudget(coverage.tags, ['checks', 'checks.evidence', 'checks.risk', 'actions'], TAGS_OVER_BUDGET_NOTE) } };
  }
  // Still over: the core tape alone — written as before B1; Firestore's limit decides.
  return out;
}
