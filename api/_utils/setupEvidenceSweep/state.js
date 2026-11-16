// api/_utils/setupEvidenceSweep/state.js
//
// The chart's evidence, PR B — THE SWEEP'S STATE (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-4,
// SW-5): one small server-only document per trading session, setupEvidenceSweepState/{session}.
// Counts and instants only — no symbol, no per-symbol map, so no index exemption:
//
//   { schemaVersion: 1, session,
//     providerRequests,                  // THE ALLOCATION: requests counted for this session, the cap's counter
//     runs, firstRunAt, lastRunAt,       // how many runs recorded, and when
//     completedAt,                       // the first run that found every name final, else null
//     runMs,                             // the recorded runs' time, summed
//     latest: { startedAt, names, final: { measured, refused }, acquired, retryable: { reason: n },
//               pending, excluded, deferred: { reason: n }, failures: { stage: n }, programmingErrors },
//     updatedAt }
//
// THE COUNTER IS READ AND WRITTEN INSIDE A TRANSACTION, with no increment sentinel (SW-4):
// reserveProviderRequest reads `providerRequests` and writes it + 1 in one transaction, BEFORE the
// request it admits, and refuses at the cap. So the count is a count of requests started, every
// one admitted under the cap whichever run or instance asked; a run that dies after its request
// leaves the count standing (it survives a failed run); the next session's document starts at zero.
//
// FAIL CLOSED: a document this code does not recognise — another schema version, another session,
// a counter that is not a whole number — is UNREADABLE: never read as zero, never written over.
// A reservation against it is refused (no request), and recordRun skips it.

import { DEFERRED_REASONS, FAILURE_STAGES, LATEST_FIELDS, RETRYABLE_REASONS, STATE_COLLECTION, STATE_SCHEMA_VERSION, SWEEP_DAILY_PROVIDER_CAP } from './constants.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const stringOrNull = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const countOr0 = (v) => (isCount(v) ? v : 0);

export const stateRefOf = (db, session) => db.collection(STATE_COLLECTION).doc(session);

export function emptyState(session) {
  return { schemaVersion: STATE_SCHEMA_VERSION, session, providerRequests: 0, runs: 0, firstRunAt: null, lastRunAt: null, completedAt: null, runMs: 0, latest: null, updatedAt: null };
}

/** Can this code read the stored document as the given session's state? Pure. */
export function stateReadable(raw, session) {
  return isPlainObject(raw) && raw.schemaVersion === STATE_SCHEMA_VERSION && raw.session === session && isCount(raw.providerRequests) && isCount(raw.runs);
}

/** A tally map kept to a closed list of keys: anything else is counted under `other`. Pure. */
export function closedTally(obj, allowed) {
  const out = {};
  for (const [k, n] of Object.entries(isPlainObject(obj) ? obj : {})) {
    if (!isCount(n) || n === 0) continue;
    const key = allowed.includes(k) ? k : 'other';
    out[key] = (out[key] || 0) + n;
  }
  return out;
}

/** A failure tally, keyed `stage:code` with the stage on its list and a short lowercase or numeric code. Pure. */
export function failureTally(obj) {
  const out = {};
  for (const [k, n] of Object.entries(isPlainObject(obj) ? obj : {})) {
    if (!isCount(n) || n === 0) continue;
    const at = k.indexOf(':');
    const stage = at === -1 ? k : k.slice(0, at);
    const code = at === -1 ? '' : k.slice(at + 1);
    const key = `${FAILURE_STAGES.includes(stage) ? stage : 'other'}:${/^(?:\d{1,3}|[a-z][a-z_-]{0,39}|[A-Z][A-Za-z]{0,30}Error|E[A-Z]{3,15})$/.test(code) ? code : 'other'}`;
    out[key] = (out[key] || 0) + n;
  }
  return out;
}

/** A run's tallies as the state keeps them: exactly LATEST_FIELDS, counts on closed lists. Pure. */
export function latestOf(t = {}) {
  const final = isPlainObject(t.final) ? t.final : {};
  const latest = {
    startedAt: stringOrNull(t.startedAt),
    names: countOr0(t.names),
    final: { measured: countOr0(final.measured), refused: countOr0(final.refused) },
    acquired: countOr0(t.acquired),
    retryable: closedTally(t.retryable, RETRYABLE_REASONS),
    pending: countOr0(t.pending),
    excluded: countOr0(t.excluded),
    deferred: closedTally(t.deferred, DEFERRED_REASONS),
    failures: failureTally(t.failures),
    programmingErrors: countOr0(t.programmingErrors),
  };
  return Object.fromEntries(LATEST_FIELDS.map((k) => [k, latest[k]]));
}

/** The stored document, normalised (callers test stateReadable first). Pure. */
export function normalizeState(raw, session) {
  if (!stateReadable(raw, session)) return emptyState(session);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    session,
    providerRequests: raw.providerRequests,
    runs: raw.runs,
    firstRunAt: stringOrNull(raw.firstRunAt),
    lastRunAt: stringOrNull(raw.lastRunAt),
    completedAt: stringOrNull(raw.completedAt),
    runMs: countOr0(raw.runMs),
    latest: isPlainObject(raw.latest) ? latestOf(raw.latest) : null,
    updatedAt: stringOrNull(raw.updatedAt),
  };
}

const docOf = (state, nowMs) => ({ ...state, updatedAt: new Date(nowMs).toISOString() });

/**
 * The plain read (the run's preparation). Never rejects.
 * @returns {Promise<{ status: 'read' | 'absent' | 'unreadable', state: object }>}
 */
export async function readSweepState(db, session) {
  try {
    const snap = await stateRefOf(db, session).get();
    if (!snap.exists) return { status: 'absent', state: emptyState(session) };
    const raw = snap.data();
    if (!stateReadable(raw, session)) return { status: 'unreadable', state: emptyState(session) };
    return { status: 'read', state: normalizeState(raw, session) };
  } catch {
    return { status: 'unreadable', state: emptyState(session) };
  }
}

async function readInTx(tx, ref, session) {
  const snap = await tx.get(ref);
  if (!snap.exists) return { state: emptyState(session) };
  const raw = snap.data();
  if (!stateReadable(raw, session)) return { unreadable: true };
  return { state: normalizeState(raw, session) };
}

/**
 * One provider request's place under the cap, taken BEFORE the request. ONE transaction.
 * @returns {Promise<{ ok: true, count: number } | { ok: false, reason: 'cap' | 'state_unreadable', count: number | null }>}
 */
export async function reserveProviderRequest({ db, session, nowMs, cap = SWEEP_DAILY_PROVIDER_CAP }) {
  const ref = stateRefOf(db, session);
  return db.runTransaction(async (tx) => {
    const read = await readInTx(tx, ref, session);
    if (read.unreadable) return { ok: false, reason: 'state_unreadable', count: null };
    const { state } = read;
    if (state.providerRequests >= cap) return { ok: false, reason: 'cap', count: state.providerRequests };
    const count = state.providerRequests + 1;
    tx.set(ref, docOf({ ...state, providerRequests: count }, nowMs));
    return { ok: true, count };
  });
}

/**
 * The end-of-run record: one more run, its time, its tallies; the counter as read. ONE transaction.
 * @param {{ startedAtMs: number, ms: number, complete: boolean, tallies: object }} run
 * @returns {Promise<{ written: true, providerRequests: number } | { written: false, skipped: 'state_unreadable' }>}
 */
export async function recordRun({ db, session, run, nowMs }) {
  const ref = stateRefOf(db, session);
  return db.runTransaction(async (tx) => {
    const read = await readInTx(tx, ref, session);
    if (read.unreadable) return { written: false, skipped: 'state_unreadable' };
    const { state } = read;
    const startedAt = new Date(run.startedAtMs).toISOString();
    tx.set(ref, docOf({
      ...state,
      runs: state.runs + 1,
      firstRunAt: state.firstRunAt ?? startedAt,
      lastRunAt: startedAt,
      completedAt: state.completedAt ?? (run.complete === true ? new Date(nowMs).toISOString() : null),
      runMs: state.runMs + countOr0(Math.round(run.ms)),
      latest: latestOf({ ...run.tallies, startedAt }),
    }, nowMs));
    return { written: true, providerRequests: state.providerRequests };
  });
}
