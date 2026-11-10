// api/_utils/evidence/packItem.js
//
// Huddle S1 — THE GATHERED-EVIDENCE PACK ITEM (Amendment C V1.2 §C10), in the shape
// Shared Research, the stock research modal and the Film Room already agreed:
//   { id, kind, fact, source: { recordKind, recordId, label }, at, asOf|null,
//     status: 'verified'|'unverified'|'unavailable', reason|null }
// `id` is deterministic: the first 12 hex characters of a SHA-256 of
// `kind|recordKind|recordId|at`. Script sentences, `names[]` and cards point at these ids
// (A §A7); cards render their source lines from them. No `pin` in S1.
//
// Status rules (C10): a close from the morning record is `verified` with its asOf; a
// headline is stored as an ATTRIBUTION ("{source} reported: {title}") and is `verified` as
// that attribution only; a source that errored or was skipped is a `source_status` item,
// `unavailable`, with its reason. Nothing `unverified` is spoken without the word.

import { createHash } from 'node:crypto';

export const PACK_KINDS = Object.freeze(['close', 'headline', 'event', 'holding', 'agent_pick', 'opener', 'prior_plan', 'source_status']);
export const PACK_STATUS = Object.freeze(['verified', 'unverified', 'unavailable']);

export const packItemIdOf = ({ kind, recordKind, recordId, at }) => createHash('sha256')
  .update(`${kind}|${recordKind ?? ''}|${recordId ?? ''}|${at ?? ''}`, 'utf8').digest('hex').slice(0, 12);

/** Build one pack item; throws on a kind or status outside the agreed vocabulary (a programming error). */
export function packItem({ kind, fact, recordKind = null, recordId = null, label, at, asOf = null, status = 'verified', reason = null }) {
  if (!PACK_KINDS.includes(kind)) throw new Error(`pack item: unknown kind ${kind}`);
  if (!PACK_STATUS.includes(status)) throw new Error(`pack item: unknown status ${status}`);
  if (typeof fact !== 'string' || !fact) throw new Error('pack item: a fact is required');
  return {
    id: packItemIdOf({ kind, recordKind, recordId, at }),
    kind,
    fact,
    source: { recordKind, recordId, label: label ?? null },
    at: at ?? null,
    asOf,
    status,
    reason,
  };
}

/** A headline as an attribution, never a fact (C10). */
export function headlineItem(news) {
  return packItem({
    kind: 'headline',
    fact: `${news.source} reported: ${news.title}`,
    recordKind: 'symbolDayEvidence.news',
    recordId: news.newsId,
    label: news.sourceKind === 'fantasytimes_story' ? 'FantasyTimes' : `${news.source} via EODHD`,
    at: news.publishedAt,
    asOf: news.publishedAt,
    status: 'verified',
    reason: null,
  });
}
