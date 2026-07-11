// research/level-study/lib/depth-eligibility.js
//
// R2 depth-eligibility utility. Given any symbol's daily bars, assert the universe
// rule: ≥ 550 verified daily trading sessions before the study start (2023-07-10).
// This is the tool the founder's full-universe freeze will be swept with (S2 test #5).
//
// Zero product imports.

import CONFIG from '../config.js';
import { isoBefore } from './session-time.js';

const AS_OF = CONFIG.universe.eligibilityAsOf;                 // '2023-07-10'
const FLOOR = CONFIG.universe.eligibilityMinPreStudySessions;  // 550

/**
 * @param {string} symbol
 * @param {Array} dailyBars normalized daily bars ({date}) OR raw EODHD /eod records ({date})
 * @returns {{symbol,firstDailyBar,lastDailyBar,preStudySessions,floor,margin,verdict}}
 */
export function depthEligibility(symbol, dailyBars) {
  const dates = dailyBars.map((b) => b.date).filter(Boolean).sort();
  const preStudy = dates.filter((d) => isoBefore(d, AS_OF));
  const count = preStudy.length;
  return {
    symbol,
    firstDailyBar: dates[0] || null,
    lastDailyBar: dates[dates.length - 1] || null,
    preStudySessions: count,
    floor: FLOOR,
    margin: count - FLOOR,
    verdict: count >= FLOOR ? 'PASS' : 'FAIL',
  };
}

/**
 * Sweep a list of {symbol, dailyBars}. Returns rows sorted FAIL-first then thinnest margin.
 * @param {Array<{symbol:string, dailyBars:Array}>} entries
 */
export function depthEligibilitySweep(entries) {
  return entries
    .map((e) => depthEligibility(e.symbol, e.dailyBars))
    .sort((a, b) => {
      if (a.verdict !== b.verdict) return a.verdict === 'FAIL' ? -1 : 1;
      return a.margin - b.margin;
    });
}
