// src/components/BaggerBomb/computeProximity.test.js
//
// Phase A (A2) — the proximity lift (hazard 15). The extracted, pure
// computeProximity() must render EXACTLY the text the label component's
// inline path rendered before the lift, over a matrix that covers both the
// dollar branch (cron levels present) and the ATR branch, plus the
// achievement, maxed and zero-distance cases.
//
// THE ORACLE below is the pre-lift logic copied VERBATIM from
// src/components/BaggerBomb/ProximityLabel.jsx:176-242 at eaf2a0e2 (the
// pre-build commit): the two useMemo bodies, the achievement selection and
// formatText(), with React removed. It is deliberately a copy, not an import
// of the new module — a test that compares a function to itself cannot fail.
// Flag-off byte-identity of every user-side BaggerBomb view rests on this
// equality, because those views now render through computeProximity() with
// no precomputed prop.

import { describe, it, expect } from 'vitest';
import {
  computeProximity,
  calculateNextThreshold,
  THRESHOLDS,
  ACHIEVEMENT_CONFIG,
} from './computeProximity';
import ProximityLabelDefault, {
  calculateNextThreshold as reExportedCalc,
  THRESHOLDS as reExportedThresholds,
} from './ProximityLabel';

// ─── The pre-lift oracle (ProximityLabel.jsx:176-242 @ eaf2a0e2) ─────────────

function oracleText({ priceChange, baseATR, history, dailyLevels, currentPrice }) {
  const { distance, label, icon, direction, highestCrossed } = calculateNextThreshold(priceChange, baseATR, history);

  // When cron levels available, compute dollar distance to next threshold
  const dollarInfo = (() => {
    if (!dailyLevels || !currentPrice || currentPrice <= 0) return null;
    if (direction === 'maxed' || highestCrossed) return null;
    // Map label to cron level key
    const labelToKey = { 'Bagger': 'baggerBomb', 'Double': 'doubleBagger', 'TenBagger': 'tenBagger', 'Bust': 'bust', 'Crash': 'crash', 'Meltdown': 'meltdown' };
    const targetKey = labelToKey[label];
    const targetPrice = targetKey ? dailyLevels[targetKey] : null;
    if (!targetPrice) return null;
    const dollarDistance = Math.abs(targetPrice - currentPrice);
    const pctDistance = (dollarDistance / currentPrice) * 100;
    return { dollarDistance, pctDistance, targetPrice };
  })();

  // Check if we should show achievement text
  const achievement = highestCrossed && (direction === 'maxed' || distance === 0)
    ? ACHIEVEMENT_CONFIG[highestCrossed]
    : null;

  // Format the display text - "💣 X.X% to BaggerBomb" or "💣 $3.50 to Bagger" format
  const formatText = () => {
    if (achievement) return achievement.text;
    if (direction === 'maxed') {
      return `${icon} MAX`;
    }
    if (distance === 0) {
      return `${icon}`;
    }
    // When cron levels available, show dollar distance
    if (dollarInfo) {
      return `${icon} ${dollarInfo.pctDistance.toFixed(1)}% to ${label}`;
    }
    return `${icon} ${distance.toFixed(1)}% to ${label}`;
  };

  return { text: formatText(), achievement, direction, distance, label };
}

// ─── The fixture matrix ─────────────────────────────────────────────────────

const LEVELS = {
  baseline: 100,
  baggerBomb: 102.5, doubleBagger: 103.75, tenBagger: 105,
  bust: 97.5, crash: 96.25, meltdown: 95,
};
const NO_HISTORY = { maxMultiplier: 0, minMultiplier: 0 };

const CASES = [];
// ATR branch: no levels / no price.
for (const priceChange of [-6, -4.2, -2.6, -1.3, -0.4, 0, 0.4, 1.1, 2.4, 3.9, 5.2]) {
  for (const baseATR of [2.5, 1.2, 4]) {
    CASES.push({ name: `atr pc=${priceChange} atr=${baseATR}`, priceChange, baseATR, history: NO_HISTORY, dailyLevels: null, currentPrice: null });
  }
}
// Dollar branch: cron levels + a live price around each level.
for (const currentPrice of [95.4, 96.9, 98.2, 99.6, 100, 100.9, 102.1, 103.2, 104.4, 106]) {
  const priceChange = ((currentPrice - LEVELS.baseline) / LEVELS.baseline) * 100;
  CASES.push({ name: `dollar price=${currentPrice}`, priceChange, baseATR: 2.5, history: NO_HISTORY, dailyLevels: LEVELS, currentPrice });
}
// Crossed thresholds on each side, both branches.
for (const history of [
  { maxMultiplier: 1.0, minMultiplier: 0 },
  { maxMultiplier: 1.6, minMultiplier: 0 },
  { maxMultiplier: 2.2, minMultiplier: 0 },
  { maxMultiplier: 0, minMultiplier: -1.0 },
  { maxMultiplier: 0, minMultiplier: -1.7 },
  { maxMultiplier: 0, minMultiplier: -2.5 },
  { maxMultiplier: 1.2, minMultiplier: -1.2 },
]) {
  for (const priceChange of [-5, -1, 0.5, 3, 6]) {
    CASES.push({ name: `crossed ${JSON.stringify(history)} pc=${priceChange} atr`, priceChange, baseATR: 2.5, history, dailyLevels: null, currentPrice: null });
    CASES.push({ name: `crossed ${JSON.stringify(history)} pc=${priceChange} dollar`, priceChange, baseATR: 2.5, history, dailyLevels: LEVELS, currentPrice: 100 + priceChange });
  }
}
// Degenerate: zero / missing ATR, missing history, zero-distance exactly at target.
CASES.push({ name: 'zero atr', priceChange: 1, baseATR: 0, history: NO_HISTORY, dailyLevels: null, currentPrice: null });
CASES.push({ name: 'missing history', priceChange: 1, baseATR: 2.5, history: undefined, dailyLevels: null, currentPrice: null });
CASES.push({ name: 'at the bagger line', priceChange: 2.5, baseATR: 2.5, history: NO_HISTORY, dailyLevels: null, currentPrice: null });
CASES.push({ name: 'at the bust line', priceChange: -2.5, baseATR: 2.5, history: NO_HISTORY, dailyLevels: null, currentPrice: null });
CASES.push({ name: 'levels but no target key', priceChange: 1, baseATR: 2.5, history: NO_HISTORY, dailyLevels: { baseline: 100 }, currentPrice: 101 });

describe('computeProximity — the lifted text equals the pre-lift formatText over the matrix', () => {
  it('covers both branches', () => {
    expect(CASES.some((c) => c.dailyLevels && c.currentPrice)).toBe(true);
    expect(CASES.some((c) => !c.dailyLevels)).toBe(true);
    expect(CASES.length).toBeGreaterThan(80);
  });

  for (const c of CASES) {
    it(`${c.name}`, () => {
      const lifted = computeProximity(c);
      const oracle = oracleText(c);
      expect(lifted.text).toBe(oracle.text);
      expect(lifted.achievement).toEqual(oracle.achievement);
      expect(lifted.direction).toBe(oracle.direction);
      expect(lifted.distance).toBe(oracle.distance);
      expect(lifted.label).toBe(oracle.label);
    });
  }

  it('the two branches really do differ where they should — the dollar branch is the row\'s number', () => {
    // Same ATR inputs; with levels the rendered distance is the DOLLAR one.
    const atr = computeProximity({ priceChange: 1, baseATR: 2.5, history: NO_HISTORY });
    const dollar = computeProximity({ priceChange: 1, baseATR: 2.5, history: NO_HISTORY, dailyLevels: LEVELS, currentPrice: 101 });
    expect(atr.text).toBe('💣 1.5% to Bagger');
    expect(dollar.text).toBe('💣 1.5% to Bagger'); // 102.5 vs 101 → 1.485…
    const dollarFar = computeProximity({ priceChange: 1, baseATR: 2.5, history: NO_HISTORY, dailyLevels: { ...LEVELS, baggerBomb: 104 }, currentPrice: 101 });
    expect(dollarFar.text).toBe('💣 3.0% to Bagger');
    expect(dollarFar.dollarInfo?.targetPrice).toBe(104);
  });

  it('is pure — the same input always yields the same output object shape', () => {
    const a = computeProximity({ priceChange: 0.4, baseATR: 2.5, history: NO_HISTORY });
    const b = computeProximity({ priceChange: 0.4, baseATR: 2.5, history: NO_HISTORY });
    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual(
      ['achievement', 'direction', 'distance', 'dollarInfo', 'highestCrossed', 'icon', 'isPrimed', 'label', 'text'].sort(),
    );
  });
});

describe('the label module still exports what the barrel re-exports', () => {
  it('calculateNextThreshold and THRESHOLDS are the same objects through both paths', () => {
    expect(reExportedCalc).toBe(calculateNextThreshold);
    expect(reExportedThresholds).toBe(THRESHOLDS);
    expect(typeof ProximityLabelDefault).toBe('function');
  });
});
