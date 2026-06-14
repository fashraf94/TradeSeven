// api/_utils/agentVwapFloor.js
// VWAP Floor Semantics V1 — pure helpers for the platform vwap_failure floor
// and its churn-containment guard (spec: docs/vwap-floor-semantics-v1.md;
// June 11 incident: agent "Shadow", 12 swaps in ~2h on stale-session VWAP).
//
// Pure module: no I/O, no Firestore, no fetch — mirrors agentEvalTransport.js.
// The cron (api/cron/agent-evaluate.js) owns all I/O, including the
// guard-active on-demand intraday fetch that feeds isReplacementQualified.

// FOUNDER-LOCK (D1a): a session must have at least this many 5-minute candles
// before its VWAP can arm the floor — earlier than this, session VWAP is too
// thin to mean anything (first candle trivially equals its own VWAP).
export const MIN_SESSION_CANDLES = 3;

// FOUNDER-LOCK (D5a): after this many vwap_failure fires per battle per day,
// every further fire must qualify its replacement on fresh intraday data.
export const VWAP_CASCADE_GUARD_N = 4;

// Upper bound on the guard-active qualification fetch. Race-without-abort is
// accepted here (unlike the Haiku call): an orphaned EODHD GET costs nothing
// and bills nothing.
export const CASCADE_QUALIFY_TIMEOUT_MS = 5000;

/**
 * A1 arming predicate — may this symbol's session VWAP arm/strike the floor?
 * Stale sessions (yesterday's candles after a data outage) and ultra-thin
 * sessions (open of day) both fail closed: no snapshot, no strike, no fire.
 *
 * @param {Object} args
 * @param {string|null} args.sessionDate - YYYY-MM-DD of the latest session in
 *   the candle data (from filterToLatestSession)
 * @param {string} args.todayET - YYYY-MM-DD, current ET trading date
 * @param {number} args.sessionCandleCount - candles in that latest session
 * @returns {boolean}
 */
export function isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount }) {
  return sessionDate === todayET && sessionCandleCount >= MIN_SESSION_CANDLES;
}

/**
 * A2 strike predicate — does this tick's deviation count toward the
 * vwap_failure counter? Requires magnitude below the preset dead-band, not
 * mere negativity: hovering at -0.05% is noise, not weakness.
 *
 * @param {number} vwapDeviation - percent deviation from session VWAP (signed)
 * @param {number} deadBandPct - preset dead-band, stored positive (e.g. 0.5)
 * @returns {boolean}
 */
export function isVwapStrike(vwapDeviation, deadBandPct) {
  return Number.isFinite(vwapDeviation) && vwapDeviation < -deadBandPct;
}

/**
 * B1 counter hygiene — drop per-symbol counter keys for symbols no longer
 * held, so a symbol swapped out and later re-entered starts at zero instead
 * of inheriting a weeks-old streak. Mutates the maps in place (they are
 * this-tick working copies in the cron).
 *
 * @param {Object[]} maps - counter maps keyed by symbol
 *   (vwapTicks, stagnationTicks, lastTickPrice, lastTickTimestamp)
 * @param {Set<string>} heldSymbols - currently held portfolio symbols
 */
export function pruneCounterMaps(maps, heldSymbols) {
  for (const map of maps) {
    for (const symbol of Object.keys(map)) {
      if (!heldSymbols.has(symbol)) delete map[symbol];
    }
  }
}

/**
 * B6 guard state — seed the per-battle daily fire counter, resetting on ET
 * date rollover. Returns a fresh object (never the persisted one) so the
 * cron's working copy can mutate freely.
 *
 * @param {Object|null|undefined} prevGuard - battle.cronState.vwapFireGuard
 * @param {string} todayET - YYYY-MM-DD, current ET trading date
 * @returns {{date: string, count: number}}
 */
export function seedVwapFireGuard(prevGuard, todayET) {
  if (prevGuard && prevGuard.date === todayET) {
    return { date: prevGuard.date, count: prevGuard.count || 0 };
  }
  return { date: todayET, count: 0 };
}

/**
 * B6 qualification predicate — once the cascade guard is active, a
 * replacement must prove on FRESH intraday data that it is not itself below
 * the dead-band (else the floor is just rotating one weak name into another).
 * Fail-closed by construction: stale/thin sessions fail the freshness
 * predicate, and a missing deviation fails Number.isFinite.
 *
 * @param {Object} args
 * @param {string|null} args.sessionDate
 * @param {number} args.sessionCandleCount
 * @param {number} args.vwapDeviation
 * @param {string} args.todayET
 * @param {number} args.deadBandPct
 * @returns {boolean}
 */
export function isReplacementQualified({ sessionDate, sessionCandleCount, vwapDeviation, todayET, deadBandPct }) {
  return (
    isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount })
    && Number.isFinite(vwapDeviation)
    && vwapDeviation > -deadBandPct
  );
}
