// api/_utils/agentCronState.js
// Forge Enforcement Keystone V1.4 §4.5 — shared cron-state persistence helper.
//
// processAgentBattle (api/cron/agent-evaluate.js) has five mutually-exclusive
// return paths that each persist the per-tick cron state immediately before an
// `await battleRef.update(...)`. finalizeCronState stamps the SHARED cron-state
// subset onto the update object so that:
//   1. a new cross-cutting state field is a ONE-LINE add here instead of five
//      edits (Phase 3 / Knob A adds stagnationTicks / lastTickPrice /
//      lastTickTimestamp at the marked spot below), and
//   2. no return path can silently forget the `evaluatingAt: null` lock release.
//
// Cron-state ONLY. statusFeed concat/slice and every site-specific field stay at
// the call site. The error-path lock release in the cron's catch block stays a
// standalone minimal write — a failed tick must not persist partial cron state.

/**
 * Stamp the shared cron-state fields onto an update object. Mutates and returns
 * the same object (so it composes with `battleRef.update(...)`).
 *
 * @param {Object} update - object passed to battleRef.update (scoreUpdate | finalUpdate)
 * @param {Object} [state]
 * @param {Object} [state.vwapTicks] - per-symbol VWAP tick counters
 * @param {Object} [state.intradayMomentum] - momentumData.vwap snapshot
 * @param {string} [state.now] - ISO timestamp for `cronState.lastEvaluatedAt`.
 *   Defaults to the current time. The full Haiku path passes its shared `now`
 *   so `lastEvaluatedAt === lastTriggeredAt` exactly, as before.
 * @param {Object} [state.stagnationTicks] - per-symbol Knob-A stagnation counters (§4.2)
 * @param {Object} [state.lastTickPrice] - per-symbol last-tick price (D2 comparison)
 * @param {Object} [state.lastTickTimestamp] - per-symbol last-tick epoch-ms (tick-age guard)
 * @returns {Object} the same `update` object, with shared cron-state fields set
 */
export function finalizeCronState(update, { vwapTicks, intradayMomentum, now, stagnationTicks, lastTickPrice, lastTickTimestamp } = {}) {
  update['cronState.lastEvaluatedAt'] = now || new Date().toISOString();
  update['cronState.evaluatingAt'] = null; // always release the evaluating lock
  update['cronState.vwapTicks'] = vwapTicks;
  update['cronState.intradayMomentum'] = intradayMomentum;
  // Phase 3 (Knob A, §4.2) — stagnation state persisted here in ONE place so all
  // 5 flush sites carry it automatically. (withinAge is transient — NOT persisted.)
  update['cronState.stagnationTicks'] = stagnationTicks;
  update['cronState.lastTickPrice'] = lastTickPrice;
  update['cronState.lastTickTimestamp'] = lastTickTimestamp;
  return update;
}
