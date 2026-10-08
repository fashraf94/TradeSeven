// api/_utils/landedTrade.js
//
// Integrity follow-up 2 (8 Oct 2026), Part D — retry-safe records (founder
// decision Q3). Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE RULE: never record a refusal, a failure or "No trade was made." for a
// trade that landed.
//
// WHY A THROW DOES NOT MEAN "NO TRADE": the executor (executeSwapServer,
// api/_utils/agentSwapExecution.js — fenced, called, never edited) runs one
// Admin SDK transaction. On a retryable commit error (DEADLINE_EXCEEDED,
// UNAVAILABLE, …) the SDK re-runs the whole transaction — and a commit the
// backend APPLIED can still report such an error. The second attempt then
// reads the battle with the swap already in it (the slot holds the incoming
// stock) and throws: the untyped self-swap error at off / shadow, P6's typed
// SwapRefusalError at enforce. The throw comes AFTER the trade committed
// (integrity build §6.3, reviewers I3 / IV3).
//
// THE CHECK: the six callers in api/cron/agent-evaluate.js wrap the executor
// call itself in its own try. When it throws, `swapResultAfterThrow` reads
// the battle afresh and looks for the row THIS call would have written — its
// evaluationId, its slot and its incoming stock, swapped out no earlier than
// the call began (the time bound makes the match exact even where an
// evaluationId is shared or null: the dormant proposal paths).
//   - found   → the executor's own result is rebuilt from the row (and the
//               incoming position in the slot), and the caller finishes its
//               success path: no refusal, no failure marker, no release.
//               When the slot no longer holds that position the result
//               carries `incomingAsset: null` and is marked
//               (`landedAfterErrorOf` → 'confirmed_after_error');
//   - absent  → the original error is rethrown: the caller records as today;
//   - the read fails → the original error is rethrown, tagged 'unknown':
//               the caller records `executionOutcome: 'unknown'` and no line
//               that claims either way.
//
// ZERO product imports: pure apart from the read it is handed.

/** The typed marker a record carries when the trade's outcome could not be read. */
export const EXECUTION_OUTCOME_UNKNOWN = 'unknown';
/** The executor threw and the fresh read found no trade from this call (internal tag; the caller records as before). */
export const EXECUTION_NOT_LANDED = 'not_landed';
/** The typed marker a success record carries when the trade was confirmed after the executor threw, but not every value could be rebuilt. */
export const EXECUTION_LANDED_AFTER_ERROR = 'confirmed_after_error';

const OUTCOME = new WeakMap();
const PARTIAL = new WeakSet();

/**
 * The identity of one executor call, taken immediately before it is made:
 * what its trade row would carry (the executor writes `evaluationId` from the
 * metadata, `tier` / `slotIndex` from its arguments, `symbolIn` from the bench
 * asset, `swappedOutAt` from its own clock).
 */
export function executorCallOf({ evaluationId = null, tier = null, slotIndex = null, symbolIn = null } = {}) {
  return Object.freeze({ evaluationId: evaluationId ?? null, tier: tier ?? null, slotIndex: slotIndex ?? null, symbolIn: symbolIn ?? null, startedAtMs: Date.now() });
}

/** Is `row` the trade row `call` wrote? */
export function isRowOfCall(row, call) {
  if (!row || typeof row !== 'object' || !call) return false;
  if ((row.evaluationId ?? null) !== call.evaluationId) return false;
  if (row.tier !== call.tier || row.slotIndex !== call.slotIndex) return false;
  if (typeof row.symbolIn !== 'string' || row.symbolIn !== call.symbolIn) return false;
  const at = typeof row.swappedOutAt === 'string' ? Date.parse(row.swappedOutAt) : NaN;
  return Number.isFinite(at) && at >= call.startedAtMs;
}

/**
 * A fresh read of the battle after the executor call threw.
 *
 * @returns {Promise<{ outcome: 'landed', closedTrade: object, incomingAsset: object|null }
 *   | { outcome: 'not_landed' } | { outcome: 'unknown' }>}
 */
export async function readLandedTrade(battleRef, call) {
  let data;
  try {
    const snap = await battleRef.get();
    data = typeof snap?.data === 'function' ? snap.data() : undefined;
  } catch (readErr) {
    console.error(`[landedTrade] re-read after an executor throw failed: ${readErr?.message || readErr}`);
    return { outcome: EXECUTION_OUTCOME_UNKNOWN };
  }
  if (!data || typeof data !== 'object') return { outcome: EXECUTION_OUTCOME_UNKNOWN };
  const trades = Array.isArray(data.trades) ? data.trades : [];
  let closedTrade = null;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (isRowOfCall(trades[i], call)) { closedTrade = trades[i]; break; }
  }
  if (!closedTrade) return { outcome: EXECUTION_NOT_LANDED };
  // The executor wrote the incoming position into the slot with
  // swappedInAt === the row's swappedOutAt (one clock reading per attempt).
  const occupant = data.portfolio?.[call.tier]?.[call.slotIndex];
  const incomingAsset = occupant && typeof occupant === 'object'
    && occupant.symbol === closedTrade.symbolIn && occupant.swappedInAt === closedTrade.swappedOutAt
    ? occupant
    : null;
  return { outcome: 'landed', closedTrade, incomingAsset };
}

/**
 * The catch around the executor call itself. Returns the executor's result
 * rebuilt from the battle when the trade landed; otherwise rethrows `err`
 * (an Error, so the callers' existing `err.message` / typed-refusal checks see
 * exactly what the executor threw), tagged with the outcome.
 */
export async function swapResultAfterThrow(battleRef, call, err) {
  const landed = await readLandedTrade(battleRef, call);
  if (landed.outcome === 'landed') {
    const result = { closedTrade: landed.closedTrade, incomingAsset: landed.incomingAsset };
    if (!landed.incomingAsset) PARTIAL.add(result);
    console.warn(`[landedTrade] the executor threw, but the trade landed (${call.evaluationId} → ${call.symbolIn}); finishing the success path from the row`);
    return result;
  }
  const error = err instanceof Error || (err !== null && typeof err === 'object') ? err : new Error(String(err));
  OUTCOME.set(error, landed.outcome);
  throw error;
}

/** The outcome a rethrown executor error carries ('not_landed' | 'unknown'), or null for any other error. */
export function executionOutcomeOf(err) {
  return err !== null && typeof err === 'object' ? (OUTCOME.get(err) ?? null) : null;
}

/** Did the read fail (the trade may or may not have landed)? */
export function executionOutcomeUnknown(err) {
  return executionOutcomeOf(err) === EXECUTION_OUTCOME_UNKNOWN;
}

/** 'confirmed_after_error' for a result rebuilt without its incoming position, else null. */
export function landedAfterErrorOf(result) {
  return result !== null && typeof result === 'object' && PARTIAL.has(result) ? EXECUTION_LANDED_AFTER_ERROR : null;
}

/** The success-record fields for a result: the marker when it was rebuilt partially, else nothing. */
export function landedAfterErrorFields(result) {
  const marker = landedAfterErrorOf(result);
  return marker ? { executionLanded: marker } : {};
}
