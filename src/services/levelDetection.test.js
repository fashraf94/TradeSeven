// Research modal honesty fixes, F4 — the 50-day SMA counts as a level source
// (build report docs/audits/20261015_BUILD_RESEARCH_MODAL_HONESTY_FIXES.md).
// calculateSMA returns a plain number, and useResearchData stores it as-is;
// detectLevels read `sma50.value`, so the 50-day SMA was silently dropped.

import { describe, it, expect } from 'vitest';
import { detectLevels } from './levelDetection';

// Five flat bars (newest-first): too few for Fibonacci or swing points, no
// volume — the only other factor is the round number $100 below $100.40.
const BARS = Array.from({ length: 5 }, (_, i) => ({
  date: `2026-10-${String(14 - i).padStart(2, '0')}`, open: 100.4, high: 100.6, low: 100.2, close: 100.4, volume: 0,
}));
const factorNames = (levels) => [...levels.support, ...levels.resistance].flatMap((l) => l.factors.map((f) => f.name));

describe('F4 — detectLevels reads indicators.sma50 as a number', () => {
  it('a 50-day SMA near the price joins the $100 round number as a support level', () => {
    const levels = detectLevels(BARS, { sma20: null, sma50: 99.8, sma200: null });
    expect(factorNames(levels)).toContain('50-day SMA');
    expect(levels.support).toHaveLength(1);
    expect(levels.support[0].factors.map((f) => f.name).sort()).toEqual(['50-day SMA', 'Psychological Level']);
  });

  it('control: without the 50-day SMA the round number stands alone and no level qualifies', () => {
    const levels = detectLevels(BARS, { sma20: null, sma50: null, sma200: null });
    expect(levels.support).toEqual([]);
    expect(levels.resistance).toEqual([]);
  });

  it('its siblings read the same way: a 20-day SMA at the same price qualifies too', () => {
    const levels = detectLevels(BARS, { sma20: 99.8, sma50: null, sma200: null });
    expect(factorNames(levels)).toContain('20-day SMA');
  });
});
