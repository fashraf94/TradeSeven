// api/cron/agent-evaluate.shouldRebuildHotBench.test.js
//
// Consumer half of Option B: unit tests for shouldRebuildHotBench, the pure gate
// that decides whether the agent rebuilds the hotBench menu this tick. Rebuild on
// a new trading day OR when the producer published a fresher stockRankings doc
// (intraday recompute) since the last rebuild — so menu membership tracks fresh
// baggerBombFit instead of being frozen once/day.
//
// Critically includes the inertness case: with a missing producer stamp (ms=0)
// on a non-new-day tick, the gate must fall back to isNewTradingDay-only (today's
// behavior), so the change is a no-op until Option B actually stamps computedAt.
//
// BUILD_RULES §4 dependency-surface guard: the import below loads the REAL
// cron module unmocked, so it exercises the cron's whole import surface —
// including the Release-2 edges (src/config/featureFlags.js,
// controlPromptRenderer, controlSuppressionTelemetry, tempoDialClamp,
// swapProvenance). Never add vi.mock for those modules here; a renamed or
// broken export must fail THIS file's import.

import { describe, it, expect } from 'vitest';
import { shouldRebuildHotBench } from './agent-evaluate.js';

describe('shouldRebuildHotBench', () => {
  it('new day, no fresher doc → true', () => {
    expect(shouldRebuildHotBench({
      isNewTradingDay: true,
      rankingsComputedMs: 5000,
      lastHotBenchComputedMs: 5000, // not fresher
    })).toBe(true);
  });

  it('not new day, fresher computedAt → true', () => {
    expect(shouldRebuildHotBench({
      isNewTradingDay: false,
      rankingsComputedMs: 6000,
      lastHotBenchComputedMs: 5000,
    })).toBe(true);
  });

  it('not new day, same computedAt → false', () => {
    expect(shouldRebuildHotBench({
      isNewTradingDay: false,
      rankingsComputedMs: 5000,
      lastHotBenchComputedMs: 5000,
    })).toBe(false);
  });

  it('missing stamp (0) + new day → true', () => {
    expect(shouldRebuildHotBench({
      isNewTradingDay: true,
      rankingsComputedMs: 0,
      lastHotBenchComputedMs: 0,
    })).toBe(true);
  });

  it('missing stamp (0) + not new day → false (inert pre-Option-B)', () => {
    expect(shouldRebuildHotBench({
      isNewTradingDay: false,
      rankingsComputedMs: 0,
      lastHotBenchComputedMs: 0,
    })).toBe(false);
  });
});
