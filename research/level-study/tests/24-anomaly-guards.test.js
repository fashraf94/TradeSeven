// Session-4 §2 config chores — anomaly-scan sensitivity guards (drives scanWarnings directly).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanWarnings } from '../02-build-levels.js';

// A full per-symbol stats object (computeStats shape) with benign, constant defaults so only the
// metric under test varies across symbols (constant metrics have MAD 0 and are skipped).
function mkStat(symbol, o = {}) {
  return {
    symbol,
    events: { merges: o.merges ?? 5, splits: o.splits ?? 5, retirements: o.retirements ?? 5 },
    familyCountStudy: o.familyCountStudy ?? 100,
    ratios: {
      newFamiliesPer100Sessions: 10,
      mergesPer100Families: o.mergesPer100Families ?? 8,
      splitsPer100Families: o.splitsPer100Families ?? 3,
      mergesPlusSplitsPer100Families: 11,
      retirementShare: 0.2,
      roleFlipsPer100MatchedFamilySessions: o.roleFlips ?? 2.34,
      snapshotFamilyChurnRate: 0.5,
    },
    medianFamilyLifespanSessions: 120,
    tierMixPct: { F1: 60, F2: 30, F3: o.f3 ?? 10 },
    activeLevelsPerDay: { median: 6 },
    atrPctMedian: o.atrPctMedian ?? 1.8,
  };
}

test('§2.1 — MAD floor quiets a tight distribution but a genuine outlier survives', () => {
  // roleFlips is a TIGHT distribution (MAD ≈ 0.01 « 0.05·median) — the 2.45 must NOT be flagged.
  // F2+F3 share carries a GENUINE outlier (40 vs ~12; MAD 1 ≥ 0.05·median) — it MUST survive.
  const roleFlips = [2.32, 2.33, 2.34, 2.35, 2.45];
  const f3 = [10, 11, 12, 13, 40].map((v) => v - 30); // tierMixPct.F2=30, so F2+F3 = 30 + (v-30) = v
  const stats = roleFlips.map((rf, i) => mkStat(`S${i}`, { roleFlips: rf, f3: f3[i] }));
  const { warnings } = scanWarnings(stats);
  assert.ok(!warnings.some((w) => w.includes('roleFlipsPer100MatchedFamilySessions') && w.includes('MAD outlier')),
    'a near-degenerate MAD must not cry wolf on the role-flip rate');
  assert.ok(warnings.some((w) => w.includes('F2plusF3sharePct') && w.includes('40') && w.includes('MAD outlier')),
    'a genuine F2/F3-share outlier (PG-like) survives the floor');
});

test('§2.2 — cross-strata correlations are suppressed as insufficient below the event floor', () => {
  // Universe total events = 5 × (1+0+1) = 10 < 20 → report insufficient, no cross-strata warning.
  const thin = [1, 2, 3, 4, 5].map((atr, i) =>
    mkStat(`S${i}`, { merges: 1, splits: 0, retirements: 1, atrPctMedian: atr, mergesPer100Families: atr * 10 }));
  const rThin = scanWarnings(thin);
  assert.equal(rThin.correlations.status, 'insufficient', 'below the floor the correlations are marked insufficient');
  assert.equal(rThin.correlations.totalEvents, 10);
  assert.ok(!rThin.warnings.some((w) => w.startsWith('cross-strata:')), 'no cross-strata warning below the floor');

  // Universe total events = 5 × (5+5+5) = 75 ≥ 20, ATR perfectly correlated with merge rate → warning fires.
  const thick = [1, 2, 3, 4, 5].map((atr, i) =>
    mkStat(`S${i}`, { atrPctMedian: atr, mergesPer100Families: atr * 10 }));
  const rThick = scanWarnings(thick);
  assert.notEqual(rThick.correlations.status, 'insufficient', 'above the floor correlations are computed');
  assert.ok(rThick.warnings.some((w) => w.startsWith('cross-strata:') && w.includes('atrPct_vs_mergeRate')),
    'a real ATR/merge-rate correlation still fires above the floor');
});
