// api/_utils/moverCandidates.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F1 two-tick confirmation.
//
// The candidate lifecycle + ATOMIC consumption that makes the T+1 confirmation
// pass idempotent under overlapping scan invocations. Discovery item 2 / A1:
// scan passes are NOT serialized (no lock/idempotency guard exists, and a
// manual authorized GET or the independently-POST-able generate-mover can race
// a cron tick), so consumption is a transactional compare-and-set on candidate
// STATE — reusing the trainingLifecycle version-precondition pattern, never a
// non-atomic check-then-act (which reproduces the TOCTOU it must close).
//
// State machine (F1a): pending -> confirmed | reverted | expired, EXACTLY one
// terminal transition. Every mutation runs inside runTransaction with a status
// precondition, so:
//   - two overlapping consumers of one pending candidate produce EXACTLY one
//     confirmation (R1a) — the loser re-reads a terminal status and backs off;
//   - a reverted/expired candidate can NEVER re-confirm against a stale trigger
//     snapshot (C3 / R1b) — consume only ever acts on `pending`.
//
// Server-only collection (admin SDK; client rules deny-all by default), one doc
// per (marketDate, symbol) at moverCandidates/{marketDate}__{SYMBOL}. Date-keyed
// with an expiresAt mirroring validatedCatalystCache (getMidnightET) so a flush
// can retire terminal docs pre-market (wire flushExpiredCandidates alongside
// flushExpiredCatalysts).

export const CANDIDATE_COLLECTION = 'moverCandidates';

export const CANDIDATE_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REVERTED: 'reverted',
  EXPIRED: 'expired',
});

const TERMINAL_OUTCOMES = Object.freeze([
  CANDIDATE_STATUS.CONFIRMED,
  CANDIDATE_STATUS.REVERTED,
  CANDIDATE_STATUS.EXPIRED,
]);

// A pending candidate survives at most this many unconsumed scan ticks (passes
// that could not evaluate its symbol — quote error / symbol left the scan set)
// before it is expired (F1a).
export const DEFAULT_EXPIRY_TICKS = 2;

export function candidateDocId(marketDate, symbol) {
  return `${marketDate}__${String(symbol).toUpperCase()}`;
}

function candidateRef(db, marketDate, symbol) {
  return db.collection(CANDIDATE_COLLECTION).doc(candidateDocId(marketDate, symbol));
}

/**
 * The confirmation predicate (F1c / R1c). The T+1 snapshot must INDEPENDENTLY
 * re-satisfy the trigger — fresh magnitude at/above threshold AND the same
 * direction as the T trigger — not merely "hasn't reverted relative to T". A
 * partial revert that no longer clears the threshold (e.g. -3.0% -> -2.1% vs a
 * 3% threshold) fails here and is treated as a revert. A direction flip is NOT
 * a re-satisfaction of the original candidate; the opposite move arms its own
 * fresh candidate on a later tick.
 *
 * Pure; exported so scan-movers and its tests read ONE source (display-agreement
 * doctrine, BUILD_RULES §9).
 *
 * @param {number} freshChangePct — the T+1 percent change (signed)
 * @param {object} triggerSnapshot — the recorded T snapshot ({ changePct, ... })
 * @param {number} thresholdPct — the trigger threshold (e.g. MOVE_THRESHOLD_PCT)
 * @returns {boolean}
 */
export function reSatisfiesTrigger(freshChangePct, triggerSnapshot, thresholdPct) {
  const fresh = Number(freshChangePct);
  if (!Number.isFinite(fresh)) return false;
  if (Math.abs(fresh) < Math.abs(Number(thresholdPct))) return false;
  const trigger = Number(triggerSnapshot?.changePct);
  if (!Number.isFinite(trigger) || trigger === 0) return true; // no usable prior direction
  return Math.sign(fresh) === Math.sign(trigger);
}

/**
 * Record a pending candidate for a detected mover (T pass). Birth-suppression
 * (F1b): a pending candidate for the symbol suppresses creation — the guard
 * lives at candidate BIRTH, transactionally, so overlapping T passes cannot
 * create two pending candidates for one symbol. (The caller separately gates on
 * the story dedup window, the second half of F1b.) A terminal candidate doc
 * (confirmed/reverted/expired from an earlier lifecycle) is re-armed with a
 * FRESH snapshot — never re-confirmed.
 *
 * @returns {Promise<{created: boolean, reason: string}>}
 */
export async function recordCandidate(db, { marketDate, symbol, triggerSnapshot, now = new Date(), expiresAt = null }) {
  const ref = candidateRef(db, marketDate, symbol);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (snap.exists && snap.data().status === CANDIDATE_STATUS.PENDING) {
      return { created: false, reason: 'pending_exists' };
    }
    const doc = {
      marketDate,
      symbol: String(symbol).toUpperCase(),
      status: CANDIDATE_STATUS.PENDING,
      version: 0,
      triggerSnapshot: triggerSnapshot || null,
      ticksSeen: 0,
      createdAt: now,
      updatedAt: now,
      terminalAt: null,
      terminalReason: null,
      expiresAt,
    };
    t.set(ref, doc);
    return { created: true, reason: snap.exists ? 're_armed' : 'created' };
  });
}

/**
 * Atomically consume a pending candidate into a terminal state (the T+1 CAS).
 * Only ever acts on `pending`; if the doc is absent or already terminal the
 * caller lost the race (or a duplicate delivery) — a benign no-op. Exactly one
 * caller wins the pending->outcome flip; only the winner should act
 * (generate/revert-log).
 *
 * @param {string} outcome — CONFIRMED | REVERTED | EXPIRED
 * @returns {Promise<{won: boolean, status: string, candidate: object|null}>}
 */
export async function consumeCandidate(db, { marketDate, symbol, outcome, reason = null, now = new Date() }) {
  if (!TERMINAL_OUTCOMES.includes(outcome)) {
    throw new Error(`consumeCandidate: invalid terminal outcome '${outcome}'`);
  }
  const ref = candidateRef(db, marketDate, symbol);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return { won: false, status: 'absent', candidate: null };
    const c = snap.data();
    if (c.status !== CANDIDATE_STATUS.PENDING) {
      return { won: false, status: c.status, candidate: c };
    }
    const updated = {
      ...c,
      status: outcome,
      version: (c.version || 0) + 1,
      terminalAt: now,
      terminalReason: reason,
      updatedAt: now,
    };
    t.set(ref, updated);
    return { won: true, status: outcome, candidate: updated };
  });
}

/**
 * Tick a pending candidate the current pass could not evaluate (quote error /
 * symbol absent from the scan set). Increments ticksSeen and expires at
 * maxTicks (F1a: `expired` fires only on a skipped pass). Transactional so the
 * count and the terminal flip cannot race.
 *
 * @returns {Promise<{expired: boolean, ticksSeen: number, status: string}>}
 */
export async function tickPendingCandidate(db, { marketDate, symbol, maxTicks = DEFAULT_EXPIRY_TICKS, now = new Date() }) {
  const ref = candidateRef(db, marketDate, symbol);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists || snap.data().status !== CANDIDATE_STATUS.PENDING) {
      return { expired: false, ticksSeen: 0, status: snap.exists ? snap.data().status : 'absent' };
    }
    const c = snap.data();
    const ticksSeen = (c.ticksSeen || 0) + 1;
    const base = { ...c, ticksSeen, version: (c.version || 0) + 1, updatedAt: now };
    if (ticksSeen >= maxTicks) {
      t.set(ref, { ...base, status: CANDIDATE_STATUS.EXPIRED, terminalAt: now, terminalReason: 'candidate_expired' });
      return { expired: true, ticksSeen, status: CANDIDATE_STATUS.EXPIRED };
    }
    t.set(ref, base);
    return { expired: false, ticksSeen, status: CANDIDATE_STATUS.PENDING };
  });
}

/**
 * List the pending candidates for a market date (the T+1 consumption pass).
 * Single-field query (marketDate) + in-memory status filter so it needs no
 * composite index and runs in the test mock.
 *
 * @returns {Promise<object[]>}
 */
export async function listPendingCandidates(db, marketDate) {
  const snap = await db.collection(CANDIDATE_COLLECTION).where('marketDate', '==', marketDate).get();
  const out = [];
  for (const d of snap.docs) {
    const c = d.data();
    if (c && c.status === CANDIDATE_STATUS.PENDING) out.push(c);
  }
  return out;
}

/**
 * Retire a prior day's candidate docs pre-market (mirror of
 * flushExpiredCatalysts). Best-effort; never throws into the caller.
 */
export async function flushExpiredCandidates(db, marketDate) {
  try {
    const snap = await db.collection(CANDIDATE_COLLECTION).where('marketDate', '==', marketDate).get();
    const deletions = [];
    for (const d of snap.docs) {
      const ref = db.collection(CANDIDATE_COLLECTION).doc(candidateDocId(marketDate, d.data().symbol));
      if (typeof ref.delete === 'function') deletions.push(ref.delete());
    }
    await Promise.all(deletions);
  } catch (err) {
    console.warn(`[MoverCandidates] flush failed for ${marketDate}:`, err?.message || err);
  }
}
