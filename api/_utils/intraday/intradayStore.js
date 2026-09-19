// api/_utils/intraday/intradayStore.js
//
// Intraday Data — Build 1, contract §7: the three shapes, why strings, the
// lease and atomic publication, the budget transaction. This is the I/O half
// of the poller; every calculation is in sweepCalc.js (pure).
//
//   intradaySnapshots/latest            { sweepId, generation, sweepAt, lastSuccessfulSweepAt, lease,
//                                         calcVersion, anomalies, counters, symbols: { [sym]: facts } }
//   intradayCalcState/{etDate}          { accumulators: { [sym]: acc }, generation, etDate }
//   intradayCalcState/{etDate}/actionable/{sym}
//                                       { ringJson, stateJson, logJson, generation, seedStatus }  (§7.2: G9 — JSON strings)
//   intradayBudget/{etDate}             { unitsRequested, unitsBySource, sweeps }  (§5.3 step 4)
//
// CLOCK: `now` is a FUNCTION supplied by the cron (its wall clock), called
// once per transaction attempt (§7.4 "now per attempt") — this module never
// reads the clock itself. No Firestore increment sentinel anywhere (D-105): the
// budget counter is read, added, written inside one transaction; the
// D-105 increment sentinel is never imported here.

export const SNAPSHOT_COLLECTION = 'intradaySnapshots';
export const SNAPSHOT_DOC_ID = 'latest';
export const CALC_STATE_COLLECTION = 'intradayCalcState';
export const ACTIONABLE_SUBCOLLECTION = 'actionable';
export const BUDGET_COLLECTION = 'intradayBudget';
export const DEFINITIONS_COLLECTION = 'intradayDefinitions';
export const VALIDATION_COLLECTION = 'intradayValidation';
export const VALIDATION_STATE_COLLECTION = 'intradayValidationState';

export const snapshotRef = (db) => db.collection(SNAPSHOT_COLLECTION).doc(SNAPSHOT_DOC_ID);
export const calcStateRef = (db, etDate) => db.collection(CALC_STATE_COLLECTION).doc(etDate);
export const actionableRef = (db, etDate, sym) => calcStateRef(db, etDate).collection(ACTIONABLE_SUBCOLLECTION).doc(sym);
export const budgetRef = (db, etDate) => db.collection(BUDGET_COLLECTION).doc(etDate);
export const definitionsRef = (db, calcVersion) => db.collection(DEFINITIONS_COLLECTION).doc(`v${calcVersion}`);
export const validationRef = (db, etDate) => db.collection(VALIDATION_COLLECTION).doc(etDate);
export const validationStateRef = (db, etDate) => db.collection(VALIDATION_STATE_COLLECTION).doc(etDate);

const dataOf = (snap) => (snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);

// ---------------------------------------------------------------------------
// §7.2 — JSON strings for the ring / state / log
// ---------------------------------------------------------------------------

export function serializeActionable(doc, generation) {
  return {
    ringJson: JSON.stringify(doc.ring ?? { buckets: [] }),
    stateJson: JSON.stringify(doc.state ?? null),
    logJson: JSON.stringify(doc.log ?? []),
    generation,
    seedStatus: doc.seedStatus ?? null,
  };
}

export function parseActionable(data) {
  if (!data) return null;
  const parse = (s, fallback) => {
    if (typeof s !== 'string') return fallback;
    try { return JSON.parse(s); } catch { return fallback; }
  };
  return {
    ring: parse(data.ringJson, { buckets: [] }),
    state: parse(data.stateJson, null),
    log: parse(data.logJson, []),
    seedStatus: data.seedStatus ?? null,
    generation: data.generation ?? null,
  };
}

// ---------------------------------------------------------------------------
// §7.4 — lease
// ---------------------------------------------------------------------------

/**
 * Acquire the sweep lease on intradaySnapshots/latest. Aborts with
 * `lease_busy` when another owner's lease is unexpired. Returns the previous
 * snapshot so the sweep can carry facts forward.
 */
export async function acquireLease(db, { owner, now, leaseMs }) {
  const ref = snapshotRef(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = now();
    const prev = dataOf(snap);
    const lease = prev?.lease || null;
    if (lease && typeof lease.expiresAt === 'number' && lease.expiresAt > nowMs && lease.owner !== owner) {
      return { ok: false, reason: 'lease_busy', previous: prev, lease };
    }
    const nextLease = { owner, expiresAt: nowMs + leaseMs, acquiredAt: nowMs };
    if (prev) tx.update(ref, { lease: nextLease });
    else tx.set(ref, { lease: nextLease, generation: 0, symbols: {} });
    return { ok: true, previous: prev, lease: nextLease, generation: prev?.generation ?? 0 };
  });
}

/** Cleanup outside the publish transaction, conditioned on `owner === me`. */
export async function releaseLease(db, { owner }) {
  const ref = snapshotRef(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = dataOf(snap);
    if (!prev?.lease || prev.lease.owner !== owner) return { released: false };
    tx.update(ref, { lease: null });
    return { released: true };
  });
}

// ---------------------------------------------------------------------------
// §5.3 step 4 — units recorded BEFORE any calculation or publication
// ---------------------------------------------------------------------------

/**
 * Read-add-write on intradayBudget/{etDate}. 1 unit per ticker requested
 * whether or not it returned (G1), 5 per /intraday/ request.
 */
export async function recordUnits(db, { etDate, units, unitsBySource = {}, sweepId, now }) {
  const ref = budgetRef(db, etDate);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = dataOf(snap) || {};
    const bySource = { ...(cur.unitsBySource || {}) };
    for (const [k, v] of Object.entries(unitsBySource)) bySource[k] = (bySource[k] || 0) + v;
    const next = {
      etDate,
      unitsRequested: (cur.unitsRequested || 0) + units,
      unitsBySource: bySource,
      sweeps: (cur.sweeps || 0) + 1,
      lastSweepId: sweepId ?? null,
      updatedAt: now(),
    };
    tx.set(ref, next);
    return next;
  });
}

// ---------------------------------------------------------------------------
// §7.4 — atomic publication
// ---------------------------------------------------------------------------

/**
 * One transaction: require `owner === me && expiresAt > now` (else abort with
 * NOTHING written: `lease_lost` / `lease_expired`); write the snapshot, the
 * universe state and every actionable document with ONE generation; release
 * the lease inside the same transaction.
 */
export async function publishSweep(db, { owner, now, etDate, snapshotDoc, universeState, actionableDocs = {}, generation }) {
  const ref = snapshotRef(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = now();
    const prev = dataOf(snap);
    const lease = prev?.lease || null;
    if (!lease || lease.owner !== owner) return { ok: false, reason: 'lease_lost' };
    if (!(typeof lease.expiresAt === 'number' && lease.expiresAt > nowMs)) return { ok: false, reason: 'lease_expired' };
    const publishedAt = nowMs;
    tx.set(ref, { ...snapshotDoc, generation, lease: null, publishedAt, lastSuccessfulSweepAt: snapshotDoc.sweepAt });
    tx.set(calcStateRef(db, etDate), { etDate, accumulators: universeState?.accumulators || {}, generation, updatedAt: publishedAt });
    let written = 0;
    for (const [sym, doc] of Object.entries(actionableDocs)) {
      tx.set(actionableRef(db, etDate, sym), serializeActionable(doc, generation));
      written += 1;
    }
    return { ok: true, generation, actionableWritten: written, publishedAt };
  });
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadCalcState(db, etDate) {
  const snap = await calcStateRef(db, etDate).get();
  const data = dataOf(snap);
  return data ? { accumulators: data.accumulators || {}, generation: data.generation ?? 0 } : { accumulators: {}, generation: 0 };
}

export async function loadActionableDocs(db, etDate, syms) {
  const out = {};
  const refs = syms.map((s) => actionableRef(db, etDate, s));
  const snaps = typeof db.getAll === 'function' && refs.length ? await db.getAll(...refs) : await Promise.all(refs.map((r) => r.get()));
  snaps.forEach((snap, i) => {
    const parsed = parseActionable(dataOf(snap));
    if (parsed) out[syms[i]] = parsed;
  });
  return out;
}

export async function loadSnapshot(db) {
  return dataOf(await snapshotRef(db).get());
}

/**
 * Firestore's documented storage-size accounting (string: UTF-8 bytes + 1;
 * integer/double: 8; boolean: 1; null: 1; map: Σ(key bytes + 1 + value);
 * array: Σ values; document: name path bytes + 16 + fields + 32). Used by the
 * §7.3 sizing measurement.
 */
export function firestoreDocBytes(path, data) {
  const enc = (s) => Buffer.byteLength(String(s), 'utf8');
  const val = (v) => {
    if (v === null || v === undefined) return 1;
    if (typeof v === 'boolean') return 1;
    if (typeof v === 'number') return 8;
    if (typeof v === 'string') return enc(v) + 1;
    if (Array.isArray(v)) return v.reduce((a, x) => a + val(x), 0);
    if (typeof v === 'object') return Object.entries(v).reduce((a, [k, x]) => a + enc(k) + 1 + val(x), 0);
    return 0;
  };
  const name = path.split('/').reduce((a, seg) => a + enc(seg) + 1, 0) + 16;
  return name + val(data) + 32;
}
