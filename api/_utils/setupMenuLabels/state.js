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

/** One entry, normalised: anything malformed is dropped to its safe reading. Pure. */
export function normalizeEntry(raw) {
  if (!isPlainObject(raw)) return null;
  return {
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

/** The stored document, normalised. Pure. */
export function normalizeState(raw) {
  const out = emptyState();
  if (!isPlainObject(raw) || raw.schemaVersion !== STATE_SCHEMA_VERSION) return out;
  if (isPlainObject(raw.cursors)) out.cursors.owners = stringOrNull(raw.cursors.owners);
  if (isPlainObject(raw.governedSessions)) {
    out.governedSessions.previous = sessionOrNull(raw.governedSessions.previous);
    out.governedSessions.current = sessionOrNull(raw.governedSessions.current);
  }
  if (isPlainObject(raw.attempts)) {
    for (const [id, e] of Object.entries(raw.attempts)) {
      const entry = normalizeEntry(e);
      if (id && entry) out.attempts[id] = entry;
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
    return { status: 'read', state: normalizeState(snap.data()) };
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
  if (entry.done) return 'done';
  if (entry.activeToken) return entry.inFlightUntil !== null && entry.inFlightUntil > nowMs ? 'in_flight' : 'recover';
  if (entry.n >= MAX_RESERVATIONS_PER_KEY_PER_SESSION) return 'exhausted';
  if (entry.dueAt !== null && entry.dueAt > nowMs) return 'not_due';
  return null;
}

/**
 * Reserve one key under `token`. ONE transaction.
 * @returns {Promise<{ status: 'reserved', replay: boolean, n: number } | { status: 'refused', reason: string }>}
 */
export async function reserveKey({ db, id, session, token, nowMs }) {
  const ref = stateRefOf(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = snap.exists ? normalizeState(snap.data()) : emptyState();
    const entry = state.attempts[id] ?? null;
    if (entry?.activeToken === token) return { status: 'reserved', replay: true, n: entry.n }; // a re-run of our own committed attempt
    const refusal = refusalOf(entry, { nowMs, isNewKey: !entry, keyCount: Object.keys(state.attempts).length });
    if (refusal === 'recover') {
      // Correction B: the outcome was never saved. Durable, once: the next run sees not_due, not this.
      state.attempts[id] = { ...entry, activeToken: null, inFlightUntil: null, lastOutcome: 'unresolved', lastReason: null, lastAt: nowMs, dueAt: nowMs + RECOVERY_DUE_MS, recoveredAt: nowMs };
      tx.set(ref, { ...state, updatedAt: new Date(nowMs).toISOString() });
      return { status: 'refused', reason: 'recovered' };
    }
    if (refusal) return { status: 'refused', reason: refusal };
    const base = entry ?? { session, n: 0, activeToken: null, lastToken: null, reservedAt: null, inFlightUntil: null, lastOutcome: null, lastReason: null, lastAt: null, dueAt: null, done: false, recoveredAt: null };
    const next = { ...base, session, n: base.n + 1, activeToken: token, reservedAt: nowMs, inFlightUntil: nowMs + IN_FLIGHT_MS };
    state.attempts[id] = next;
    tx.set(ref, { ...state, updatedAt: new Date(nowMs).toISOString() });
    return { status: 'reserved', replay: false, n: next.n };
  });
}

/** Applies a token-owned transition once. `apply(entry)` returns the next entry. */
async function ownedTransition({ db, id, token, nowMs, apply }) {
  const ref = stateRefOf(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const state = snap.exists ? normalizeState(snap.data()) : emptyState();
    const entry = state.attempts[id] ?? null;
    if (!entry) return { status: 'missing' };
    if (entry.activeToken !== token) return { status: entry.lastToken === token ? 'already_applied' : 'stale' };
    state.attempts[id] = { ...apply(entry), activeToken: null, lastToken: token, inFlightUntil: null };
    tx.set(ref, { ...state, updatedAt: new Date(nowMs).toISOString() });
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
    const snap = await tx.get(ref);
    const state = snap.exists ? normalizeState(snap.data()) : emptyState();
    const stored = state.governedSessions;
    // Forward only: the newer of the two currents wins, with ITS previous (an older run never moves it back).
    const own = { previous: sessionOrNull(governed?.previous), current: sessionOrNull(governed?.current) };
    const newer = maxSession(stored.current, own.current) === own.current && own.current !== null ? own : stored;
    const merged = { current: maxSession(stored.current, own.current), previous: newer.previous };
    let pruned = 0;
    if (merged.previous !== null) {
      for (const [id, entry] of Object.entries(state.attempts)) {
        if (entry.session !== null && entry.session < merged.previous) { delete state.attempts[id]; pruned += 1; }
      }
    }
    tx.set(ref, { ...state, cursors: { owners: stringOrNull(ownersCursor) ?? state.cursors.owners }, governedSessions: merged, updatedAt: new Date(nowMs).toISOString() });
    return { pruned, governedSessions: merged };
  });
}
