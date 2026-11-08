// api/_utils/setupMenuLabels/state.js
//
// Slice 2 — THE STATE, setupMenuLabelState/main (spec V2 §6.3–§6.5, as amended by Correction B of the
// founder's kickoff, 7 Nov 2026). One mutable server-only document:
//
//   { schemaVersion: 1,
//     cursors: { owners },
//     governedSessions: { previous, current },          // only ever moves forward
//     attempts: { [snapshotId]: Entry },                  // index-exempt map (firestore.indexes.json)
//     updatedAt }
//   Entry: { session, n, activeToken, lastToken, reservedAt, inFlightUntil, lastOutcome, lastReason,
//            lastAt, dueAt, done, recoveredAt }            // instants are epoch ms or null
//
// RESERVATION BEFORE REQUEST, OWNED BY A TOKEN. The tenant mints one token per operation OUTSIDE any
// transaction callback and passes it in, so a callback the SDK re-runs reuses it. Every transition is
// one transaction on this document, and the provider/store call is never inside one:
//
//   reserveKey   refuses (no write) done / exhausted / not_due / in_flight / state_full; a key that
//                already carries THIS token is a re-run of a committed attempt (`replay`, counted once);
//                an active reservation whose in-flight period has passed with no saved outcome is
//                RECOVERED (written once: active cleared, `unresolved`, due RECOVERY_DUE_MS after this
//                observation, its reservation still counted) and refused — no request this run;
//                otherwise n + 1, the token active, in flight for IN_FLIGHT_MS.
//   completeKey  the outcome, applied only while THIS token is the active one, and only once: it clears
//                the token, records it as `lastToken`, the outcome, the typed reason, `lastAt`, the
//                due time; `pending` refunds the reservation. A re-run finds `lastToken === token`
//                (`already_applied`); anything else is `stale` and changes nothing — so a late or
//                duplicate completion can never decrement twice, erase a successor's reservation,
//                replace its due time or mark it done.
//   cancelKey    no store call started (admission lost, or a reservation whose commit is uncertain):
//                refund, under the same token rule; idempotent.
//   finishRun    the end-of-run write: cursors; governed sessions merged forward; entries older than
//                the previous governed session pruned — never a newer run's (an older run's floor is
//                computed from the newest current session either run knows).
//
// The cap is three NON-REFUNDED reservations per key per session. A reservation is not a provider
// request (a final cache hit or a live lease elsewhere makes none); the tenant counts those apart.
// Nothing is ever evicted to admit a key: past STATE_MAX_KEYS a new key is refused.

import {
  CONFIRM_MARGIN_MS, IN_FLIGHT_MS, MAX_RESERVATIONS_PER_KEY_PER_SESSION, NEXT_RUN_MS, RECOVERY_DUE_MS, STATE_COLLECTION,
  STATE_DOC, STATE_MAX_KEYS, STATE_OUTCOMES, STATE_REASONS, STATE_SCHEMA_VERSION, STORE_CONFIRM_AFTER_MS, TRANSIENT_REASONS,
} from './constants.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const stringOrNull = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const sessionOrNull = (v) => (typeof v === 'string' && SESSION_RE.test(v) ? v : null);

export const stateRefOf = (db) => db.collection(STATE_COLLECTION).doc(STATE_DOC);

export function emptyState() {
  return { schemaVersion: STATE_SCHEMA_VERSION, cursors: { owners: null }, governedSessions: { previous: null, current: null }, attempts: {}, updatedAt: null };
}

// FAIL CLOSED (review SM1-1). A document this code does not recognise — another schema version, or an
// \`attempts\` that is not a map — is UNREADABLE: never read as empty, never rewritten (no request follows,
// and no transaction writes over it). An ENTRY whose fields are not the shapes this code writes is MALFORMED:
// its key is refused (no reservation, no request), it counts toward the key cap, it is never pruned, and every
// whole-document write puts it back exactly as it was read. Nothing is ever read as zero, false or "due now".

/** Can this code read the stored document, and rewrite it whole? Pure. */
export function stateDocReadable(raw) {
  return isPlainObject(raw) && raw.schemaVersion === STATE_SCHEMA_VERSION && (raw.attempts === undefined || isPlainObject(raw.attempts));
}

const absentOr = (v, ok) => v === undefined || v === null || ok(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const INSTANT_FIELDS = Object.freeze(['reservedAt', 'inFlightUntil', 'lastAt', 'dueAt', 'recoveredAt']);

/** Is a stored entry exactly the shapes this code writes (missing optional fields allowed)? Pure. */
function entryWellFormed(raw) {
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

/** One entry, normalised; a malformed one is kept verbatim and marked (refused, never rewritten). Pure. */
export function normalizeEntry(raw) {
  if (!entryWellFormed(raw)) return { malformed: true, raw: isPlainObject(raw) ? { ...raw } : raw };
  return {
    malformed: false,
    session: sessionOrNull(raw.session),
    n: Number.isInteger(raw.n) && raw.n >= 0 ? raw.n : 0,
    activeToken: stringOrNull(raw.activeToken),
    lastToken: stringOrNull(raw.lastToken),
    reservedAt: finiteOrNull(raw.reservedAt),
    inFlightUntil: finiteOrNull(raw.inFlightUntil),
    lastOutcome: STATE_OUTCOMES.includes(raw.lastOutcome) ? raw.lastOutcome : null,
    lastReason: STATE_REASONS.includes(raw.lastReason) ? raw.lastReason : null,
    lastAt: finiteOrNull(raw.lastAt),
    dueAt: finiteOrNull(raw.dueAt),
    done: raw.done === true,
    recoveredAt: finiteOrNull(raw.recoveredAt),
  };
}

/** The stored document, normalised (an unreadable one reads as empty here; callers test stateDocReadable first). Pure. */
export function normalizeState(raw) {
  const out = emptyState();
  if (!stateDocReadable(raw)) return out;
  if (isPlainObject(raw.cursors)) out.cursors.owners = stringOrNull(raw.cursors.owners);
  if (isPlainObject(raw.governedSessions)) {
    out.governedSessions.previous = sessionOrNull(raw.governedSessions.previous);
    out.governedSessions.current = sessionOrNull(raw.governedSessions.current);
  }
  if (isPlainObject(raw.attempts)) {
    for (const [id, e] of Object.entries(raw.attempts)) {
      if (id) out.attempts[id] = normalizeEntry(e);
    }
  }
  out.updatedAt = stringOrNull(raw.updatedAt);
  return out;
}

/**
 * The plain read (the labels' reader, and the tenant's preparation). Never rejects.
 * @returns {Promise<{ status: 'read' | 'absent' | 'unreadable', state: object }>}
 */
export async function readLabelState(db) {
  try {
    const snap = await stateRefOf(db).get();
    if (!snap.exists) return { status: 'absent', state: emptyState() };
    const raw = snap.data();
    if (!stateDocReadable(raw)) return { status: 'unreadable', state: emptyState() }; // never read as empty (SM1-1)
    return { status: 'read', state: normalizeState(raw) };
  } catch {
    return { status: 'unreadable', state: emptyState() };
  }
}

/** A stored reason as the state may keep it: on its list, else `other`; null when there is none. Pure. */
export function typedReasonOf(reason) {
  if (reason === null || reason === undefined) return null;
  return STATE_REASONS.includes(reason) ? reason : 'other';
}

/** The due time after an outcome recorded at `lastAt` (spec V2 §6.4). Pure. */
export function dueAtOf(outcome, reason, lastAt) {
  if (outcome === 'final' || outcome === 'excluded') return null;
  if (outcome === 'retryable' && !TRANSIENT_REASONS.includes(reason)) return lastAt + STORE_CONFIRM_AFTER_MS + CONFIRM_MARGIN_MS;
  return lastAt + NEXT_RUN_MS; // transient retryable, pending, threw
}

/**
 * Why a key may not be reserved now, from a normalised entry — or null. Pure; the transaction and the
 * tenant's pre-filter share it. `recover` means: an active reservation whose in-flight period passed.
 */
export function refusalOf(entry, { nowMs, isNewKey, keyCount }) {
  if (!entry) return isNewKey && keyCount >= STATE_MAX_KEYS ? 'state_full' : null;
  if (entry.malformed) return 'malformed';
  if (entry.done) return 'done';
  if (entry.activeToken) return entry.inFlightUntil !== null && entry.inFlightUntil > nowMs ? 'in_flight' : 'recover';
  if (entry.n >= MAX_RESERVATIONS_PER_KEY_PER_SESSION) return 'exhausted';
  if (entry.dueAt !== null && entry.dueAt > nowMs) return 'not_due';
  return null;
}

/** The document a transaction writes: every entry as normalised, a malformed one exactly as it was read. Pure. */
export function stateDocOf(state, nowMs, over = {}) {
  const attempts = {};
  for (const [id, e] of Object.entries(state.attempts)) {
    if (e?.malformed) { attempts[id] = e.raw; continue; }
    const entry = { ...e };
    delete entry.malformed;
    attempts[id] = entry;
  }
  return { schemaVersion: STATE_SCHEMA_VERSION, cursors: state.cursors, governedSessions: state.governedSessions, attempts, updatedAt: new Date(nowMs).toISOString(), ...over };
}

/** Read the document inside a transaction: an unreadable one is reported, never normalised to empty (SM1-1). */
async function readInTx(tx, ref) {
  const snap = await tx.get(ref);
  if (!snap.exists) return { state: emptyState() };
  const raw = snap.data();
  if (!stateDocReadable(raw)) return { unreadable: true };
  return { state: normalizeState(raw) };
}

/**
 * Reserve one key under `token`. ONE transaction.
 * @returns {Promise<{ status: 'reserved', replay: boolean, n: number } | { status: 'refused', reason: string }>}
 */
export async function reserveKey({ db, id, session, token, nowMs }) {
  const ref = stateRefOf(db);
  return db.runTransaction(async (tx) => {
    const read = await readInTx(tx, ref);
    if (read.unreadable) return { status: 'refused', reason: 'state_unreadable' }; // no write over a document this code cannot read
    const { state } = read;
    const entry = state.attempts[id] ?? null;
    if (entry?.activeToken === token) return { status: 'reserved', replay: true, n: entry.n }; // a re-run of our own committed attempt
    const refusal = refusalOf(entry, { nowMs, isNewKey: !entry, keyCount: Object.keys(state.attempts).length });
    if (refusal === 'recover') {
      // Correction B: the outcome was never saved. Durable, once: the next run sees not_due, not this.
      state.attempts[id] = { ...entry, activeToken: null, inFlightUntil: null, lastOutcome: 'unresolved', lastReason: null, lastAt: nowMs, dueAt: nowMs + RECOVERY_DUE_MS, recoveredAt: nowMs };
      tx.set(ref, stateDocOf(state, nowMs));
      return { status: 'refused', reason: 'recovered' };
    }
    if (refusal) return { status: 'refused', reason: refusal };
    const base = entry ?? { session, n: 0, activeToken: null, lastToken: null, reservedAt: null, inFlightUntil: null, lastOutcome: null, lastReason: null, lastAt: null, dueAt: null, done: false, recoveredAt: null };
    const next = { ...base, session, n: base.n + 1, activeToken: token, reservedAt: nowMs, inFlightUntil: nowMs + IN_FLIGHT_MS };
    state.attempts[id] = next;
    tx.set(ref, stateDocOf(state, nowMs));
    return { status: 'reserved', replay: false, n: next.n };
  });
}

/** Applies a token-owned transition once. `apply(entry)` returns the next entry. */
async function ownedTransition({ db, id, token, nowMs, apply }) {
  const ref = stateRefOf(db);
  return db.runTransaction(async (tx) => {
    const read = await readInTx(tx, ref);
    if (read.unreadable) return { status: 'state_unreadable' };
    const { state } = read;
    const entry = state.attempts[id] ?? null;
    if (!entry) return { status: 'missing' };
    if (entry.malformed) return { status: 'malformed' };
    if (entry.activeToken !== token) return { status: entry.lastToken === token ? 'already_applied' : 'stale' };
    state.attempts[id] = { ...apply(entry), activeToken: null, lastToken: token, inFlightUntil: null };
    tx.set(ref, stateDocOf(state, nowMs));
    return { status: 'applied' };
  });
}

/**
 * Record the outcome of THIS reservation's store call. ONE transaction.
 * @param {{ outcome: 'final'|'excluded'|'retryable'|'pending'|'threw', reason?: string|null, nowMs: number }} p
 */
export async function completeKey({ db, id, token, outcome, reason = null, nowMs }) {
  const typed = outcome === 'retryable' ? typedReasonOf(reason) : null;
  return ownedTransition({
    db, id, token, nowMs,
    apply: (entry) => ({
      ...entry,
      n: outcome === 'pending' ? Math.max(0, entry.n - 1) : entry.n, // a live lease elsewhere: no fetch, refunded
      lastOutcome: outcome,
      lastReason: typed,
      lastAt: nowMs,
      dueAt: dueAtOf(outcome, reason, nowMs),
      done: entry.done || outcome === 'final' || outcome === 'excluded',
    }),
  });
}

/** No store call started under this reservation: refund it. ONE transaction; token-checked; idempotent. */
export async function cancelKey({ db, id, token, nowMs }) {
  return ownedTransition({ db, id, token, nowMs, apply: (entry) => ({ ...entry, n: Math.max(0, entry.n - 1) }) });
}

const maxSession = (a, b) => (a === null ? b : b === null ? a : (a > b ? a : b));

/**
 * The end-of-run write: the owner cursor, the governed sessions merged FORWARD, and the pruning of entries
 * older than the previous governed session. ONE transaction.
 * @param {{ governed: { previous: string|null, current: string|null }, ownersCursor: string|null, nowMs: number }} p
 */
export async function finishRun({ db, governed, ownersCursor, nowMs }) {
  const ref = stateRefOf(db);
  return db.runTransaction(async (tx) => {
    const read = await readInTx(tx, ref);
    if (read.unreadable) return { pruned: 0, governedSessions: null, skipped: 'state_unreadable' };
    const { state } = read;
    const stored = state.governedSessions;
    // Forward only: the newer of the two currents wins, with ITS previous (an older run never moves it back).
    const own = { previous: sessionOrNull(governed?.previous), current: sessionOrNull(governed?.current) };
    const newer = maxSession(stored.current, own.current) === own.current && own.current !== null ? own : stored;
    const merged = { current: maxSession(stored.current, own.current), previous: newer.previous };
    let pruned = 0;
    if (merged.previous !== null) {
      for (const [id, entry] of Object.entries(state.attempts)) {
        if (!entry.malformed && entry.session !== null && entry.session < merged.previous) { delete state.attempts[id]; pruned += 1; }
      }
    }
    tx.set(ref, stateDocOf(state, nowMs, { cursors: { owners: stringOrNull(ownersCursor) ?? state.cursors.owners }, governedSessions: merged }));
    return { pruned, governedSessions: merged };
  });
}
