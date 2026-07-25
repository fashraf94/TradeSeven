// api/cron/compute-rankings.beatRateSource.test.js
//
// Fundamental Wire — Commit 1, founder ruling D2: computeEarningsConsistency
// must MARK whether beatRate is real per-company history ('computed') or the
// SECTOR_BEAT_RATES constant ('sector_default'), and the marker must persist
// beside the value. The fabricated value itself keeps flowing into the pillar
// system unchanged — suppression happens at the mirror, keyed on this marker.
//
// Style-A (rollup.test.js precedent): import the real exported helper, zero
// mocks. compute-rankings.js imports only api/_utils — no api→src edge here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeEarningsConsistency } from './compute-rankings.js';
import { SECTOR_BEAT_RATES } from '../_utils/rankingConfig.js';

const SOURCE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compute-rankings.js');

function historyOf(surprises) {
  // Build an EODHD-shaped Earnings.History: estimate 1.00, actual 1.00 + s.
  const history = {};
  surprises.forEach((s, i) => {
    history[`2026-0${(i % 9) + 1}-0${Math.floor(i / 9) + 1}`] = {
      epsActual: String(1 + s),
      epsEstimate: '1.00',
    };
  });
  return { History: history };
}

describe('computeEarningsConsistency — beatRateSource (D2)', () => {
  it("no History at all → sector default + 'sector_default'", () => {
    const out = computeEarningsConsistency(null, 'XLK');
    expect(out.beatRate).toBeCloseTo((SECTOR_BEAT_RATES.XLK ?? 0.68) * 100, 6);
    expect(out.beatRateSource).toBe('sector_default');
    expect(out.avgSurpriseMag).toBeNull();
  });

  it("fewer than 4 usable quarters → sector default + 'sector_default' (partial surprise stats still real)", () => {
    const out = computeEarningsConsistency(historyOf([0.05, 0.02, -0.01]), 'XLF');
    expect(out.beatRate).toBeCloseTo((SECTOR_BEAT_RATES.XLF ?? 0.68) * 100, 6);
    expect(out.beatRateSource).toBe('sector_default');
    expect(out.avgSurpriseMag).not.toBeNull(); // computed from the 3 real entries
  });

  it("unknown sector falls back to 0.68, still marked 'sector_default'", () => {
    const out = computeEarningsConsistency(null, 'NOT_A_SECTOR');
    expect(out.beatRate).toBeCloseTo(68, 6);
    expect(out.beatRateSource).toBe('sector_default');
  });

  it(">=4 usable quarters → real beat rate + 'computed'", () => {
    const out = computeEarningsConsistency(historyOf([0.05, 0.02, -0.01, 0.03, 0.01, -0.02]), 'XLK');
    // 4 of 6 beats
    expect(out.beatRate).toBeCloseTo((4 / 6) * 100, 6);
    expect(out.beatRateSource).toBe('computed');
  });
});

describe('persist + extract wiring (static-source guard)', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');

  it('extractMetrics forwards the marker', () => {
    expect(/beatRateSource: earningsConsistencyMetrics\.beatRateSource,/.test(src)).toBe(true);
  });

  it('persistResults writes the marker beside beatRate with the ?? null idiom', () => {
    expect(/beatRateSource: stock\.metrics\?\.beatRateSource \?\? null,/.test(src)).toBe(true);
  });
});
