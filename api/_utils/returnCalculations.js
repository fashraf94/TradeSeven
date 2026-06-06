// api/_utils/returnCalculations.js
//
// Conversational Performance — realized period-return math. Pure, dependency-free, and
// unit-tested so the numbers are proven before the daily cron ever computes them live.
// Mirrors the codebase's testable-helper pattern (technicalCalculations.js,
// momentumScoring.js): the cron imports this; the network / Firestore stay out.
//
// Inputs are NEWEST-FIRST adjusted closes (closes[0] = most recent) and the aligned
// ISO date strings (dates[i] is the "YYYY-MM-DD" for closes[i]) — exactly the shape
// compute-index-intelligence.js already holds in rsData[].closes / ohlcv[].date, so
// there are zero new EODHD calls.
//
// Every return is a REALIZED, PAST result expressed as a signed percent rounded to two
// decimals (+12.4 = up 12.4%, -3.1 = down 3.1%); null on insufficient history — the
// same discipline the momentum factors use.

// Fixed trading-day lookbacks per horizon (the standard calendar approximation):
//   1W ≈ 5 bars · 1M ≈ 21 · 3M ≈ 63 · 12M ≈ 252.
const HORIZON_BARS = Object.freeze({
  return1W: 5,
  return1M: 21,
  return3M: 63,
  return12M: 252,
});

// closes[0] / closes[lookback] - 1, as a percent. null unless both endpoints are
// finite and the denominator is positive — which also means closes.length must EXCEED
// the lookback for the past endpoint to exist (return12M needs 253 bars for closes[252]
// to be real, so thin-history names come back null).
function periodReturn(closes, lookback) {
  if (!Array.isArray(closes)) return null;
  const recent = closes[0];
  const past = closes[lookback];
  if (!Number.isFinite(recent) || !Number.isFinite(past) || past <= 0) return null;
  return Number(((recent / past - 1) * 100).toFixed(2));
}

// Year-to-date: closes[0] / (last close of the prior year) - 1. Date-anchored, not a
// fixed bar offset. dates/closes are newest-first, so the FIRST bar whose year is below
// the latest bar's year is the most recent prior-year close — i.e. the previous
// year-end close, the standard YTD anchor. currentYear is derived from the newest bar
// (dates[0]) rather than the wall clock, which keeps the helper pure/deterministic and
// avoids a stale-clock edge if a run lands before the year's first session.
function ytdReturn(closes, dates) {
  if (!Array.isArray(closes) || !Array.isArray(dates) || dates.length === 0) return null;
  const recent = closes[0];
  if (!Number.isFinite(recent)) return null;
  const currentYear = Number(String(dates[0]).slice(0, 4));
  if (!Number.isFinite(currentYear)) return null;
  for (let i = 0; i < dates.length; i++) {
    const year = Number(String(dates[i]).slice(0, 4));
    if (Number.isFinite(year) && year < currentYear) {
      const anchor = closes[i];
      if (!Number.isFinite(anchor) || anchor <= 0) return null;
      return Number(((recent / anchor - 1) * 100).toFixed(2));
    }
  }
  return null; // no prior-year bar in the window → insufficient history
}

/**
 * Realized period returns for one stock.
 * @param {number[]} closes  Newest-first adjusted closes (closes[0] = latest).
 * @param {string[]} dates   Aligned ISO date strings (dates[i] ↔ closes[i]); only YTD reads them.
 * @returns {{return1W:number|null, return1M:number|null, return3M:number|null, returnYTD:number|null, return12M:number|null}}
 *          Each a signed percent (2 dp), or null on insufficient history.
 */
export function computeReturns(closes, dates) {
  return {
    return1W: periodReturn(closes, HORIZON_BARS.return1W),
    return1M: periodReturn(closes, HORIZON_BARS.return1M),
    return3M: periodReturn(closes, HORIZON_BARS.return3M),
    returnYTD: ytdReturn(closes, dates),
    return12M: periodReturn(closes, HORIZON_BARS.return12M),
  };
}
