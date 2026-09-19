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

// Intraday Data — Build 1, contract §11 (the ONE flags-off behaviour change):
// the legacy candle path passes its newest session candle's timestamp and the
// gate refuses a stalled feed. The 2026-09-18 discovery found the gate was a
// calendar-date test only — three today-dated bars published at 09:35 and
// then nothing passed it all day (docs/audits/20260918_PHASE0_INTRADAY_DATA.md
// §1.2). 45 minutes: nine 5-minute bars of slack over the vendor's ~15–20
// minute delay, well inside the session and well outside a stall.
export const VWAP_LEGACY_MAX_AGE_MS = 45 * 60 * 1000;

/**
 * The epoch-ms instant of the NEWEST candle in a list, from EODHD's `datetime`
 * ('YYYY-MM-DD HH:mm:ss' UTC, or ISO) or a `timestamp` (seconds or ms). Null
 * when no candle carries a parseable instant — which the gate then refuses.
 * Pure; exported for the call sites and the tests.
 */
export function newestCandleAsOfMs(candles) {
  let max = null;
  for (const c of Array.isArray(candles) ? candles : []) {
    let ms = null;
    if (typeof c?.timestamp === 'number' && Number.isFinite(c.timestamp)) ms = c.timestamp < 1e11 ? c.timestamp * 1000 : c.timestamp;
    else if (typeof c?.datetime === 'string') {
      const m = c.datetime.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z)?$/);
      if (m) ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
      else { const d = new Date(c.datetime); ms = Number.isNaN(d.getTime()) ? null : d.getTime(); }
    }
    if (ms !== null && (max === null || ms > max)) max = ms;
  }
  return max;
}

/**
 * A1 arming predicate — may this symbol's session VWAP arm/strike the floor?
 * Stale sessions (yesterday's candles after a data outage), ultra-thin
 * sessions (open of day) AND a stalled feed (today-dated candles whose newest
 * bar is older than `maxAgeMs` at `nowMs` — contract §11, the freshness
 * clause, MANDATORY: a missing instant fails closed) all fail closed: no
 * snapshot, no strike, no fire.
 *
 * @param {Object} args
 * @param {string|null} args.sessionDate - YYYY-MM-DD of the latest session in
 *   the candle data (from filterToLatestSession)
 * @param {string} args.todayET - YYYY-MM-DD, current ET trading date
 * @param {number} [args.coverageCount] - candles in that latest session (contract §11 name)
 * @param {number} [args.sessionCandleCount] - the same count, the pre-§11 name (alias)
 * @param {number} args.asOfMs - the newest session candle's instant (epoch ms)
 * @param {number} args.nowMs - the caller's clock (epoch ms)
 * @param {number} [args.maxAgeMs=VWAP_LEGACY_MAX_AGE_MS]
 * @returns {boolean}
 */
export function isVwapSessionUsable({ sessionDate, todayET, coverageCount, sessionCandleCount, asOfMs, nowMs, maxAgeMs = VWAP_LEGACY_MAX_AGE_MS }) {
  const count = Number.isFinite(coverageCount) ? coverageCount : sessionCandleCount;
  if (sessionDate !== todayET || !(count >= MIN_SESSION_CANDLES)) return false;
  // §11 — the freshness clause. No instant → refused; stalled → refused.
  if (!Number.isFinite(asOfMs) || !Number.isFinite(nowMs) || !Number.isFinite(maxAgeMs)) return false;
  return nowMs - asOfMs <= maxAgeMs;
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
export function isReplacementQualified({ sessionDate, sessionCandleCount, coverageCount, vwapDeviation, todayET, deadBandPct, asOfMs, nowMs, maxAgeMs }) {
  return (
    // §11: the same gate, the same freshness clause — a stalled fresh-fetch
    // cannot qualify a replacement either.
    isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount, coverageCount, asOfMs, nowMs, maxAgeMs })
    && Number.isFinite(vwapDeviation)
    && vwapDeviation > -deadBandPct
  );
}
