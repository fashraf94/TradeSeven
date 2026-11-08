// api/_utils/setupMenuLabels/stateShape.js
//
// Slice 2 — WHAT A READABLE STATE IS, pure (correction round F3). The validators the production reader
// (state.js: readLabelState, normalizeEntry) applies to setupMenuLabelState/main, in a module with no I/O and
// no write path, so the read-only census (scripts/census-setup-menu-labels.mjs) can apply EXACTLY the same
// rules without importing the state writer. state.js imports these; nothing here is restated anywhere.
//
//   stateDocReadable(raw)     the document: a plain object, schemaVersion STATE_SCHEMA_VERSION, `attempts`
//                             absent or a plain object (an array is not). Unreadable → never read as empty.
//   stateEntryWellFormed(raw) one entry: exactly the shapes state.js writes, optional fields absent or null.
//                             A malformed entry is never coerced: not its `n`, not its outcome.
//   stateEntryIds(attempts)   the entry ids the reader considers (every own key but the empty one).

import { STATE_OUTCOMES, STATE_REASONS, STATE_SCHEMA_VERSION } from './constants.js';

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;
export const sessionOrNull = (v) => (typeof v === 'string' && SESSION_RE.test(v) ? v : null);
const absentOr = (v, ok) => v === undefined || v === null || ok(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const INSTANT_FIELDS = Object.freeze(['reservedAt', 'inFlightUntil', 'lastAt', 'dueAt', 'recoveredAt']);

/** Is the stored document one this code can read? Pure. */
export function stateDocReadable(raw) {
  return isPlainObject(raw) && raw.schemaVersion === STATE_SCHEMA_VERSION && (raw.attempts === undefined || isPlainObject(raw.attempts));
}

/** Is a stored entry exactly the shapes state.js writes (missing optional fields allowed)? Pure. */
export function stateEntryWellFormed(raw) {
  return isPlainObject(raw)
    && Number.isInteger(raw.n) && raw.n >= 0
    && absentOr(raw.done, (v) => typeof v === 'boolean')
    && absentOr(raw.session, (v) => sessionOrNull(v) !== null)
    && absentOr(raw.activeToken, (v) => typeof v === 'string' && v.length > 0)
    && absentOr(raw.lastToken, (v) => typeof v === 'string' && v.length > 0)
    && INSTANT_FIELDS.every((k) => absentOr(raw[k], isFiniteNumber))
    && absentOr(raw.lastOutcome, (v) => STATE_OUTCOMES.includes(v))
    && absentOr(raw.lastReason, (v) => STATE_REASONS.includes(v));
}

/** The entry ids of a readable document's `attempts`, as the reader iterates them. Pure. */
export function stateEntryIds(attempts) {
  return isPlainObject(attempts) ? Object.keys(attempts).filter((id) => id) : [];
}
