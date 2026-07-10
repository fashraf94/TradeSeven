// api/scripts/watchlist-framing-eval/corpus.test.js
//
// Hermetic completeness tests for the PR-d watchlist-framing corpus (run in
// the default suite; the live harness is runEval.eval.mjs — excluded by
// filename). Proves the §5.1 cross-product is complete BEFORE Flash burns
// OpenRouter calls on it.

import { describe, it, expect } from 'vitest';
import { buildCorpus, SCENARIO_KEYS, ARCHETYPE_KEYS, renderUniverse } from './corpus.js';
import { ARCHETYPE_KEYS as MENU_ARCHETYPES } from '../../../src/data/archetypeAdjustments.js';

describe('watchlist-framing corpus — the §5.1 cross-product', () => {
  const items = buildCorpus();

  it('covers exactly 6 archetypes × 6 scenarios = 36 items', () => {
    expect(ARCHETYPE_KEYS).toEqual([...MENU_ARCHETYPES]); // the REAL archetype set, not a drifted copy
    expect(SCENARIO_KEYS).toEqual([
      'off_style_watched', 'missing_data', 'full_watchlist',
      'already_held', 'conflicting_chat_pressure', 'equal_ranked_alternatives',
    ]);
    expect(items).toHaveLength(36);
    const ids = new Set(items.map((i) => i.id));
    expect(ids.size).toBe(36);
    for (const arch of ARCHETYPE_KEYS) {
      for (const scenario of SCENARIO_KEYS) {
        expect(ids.has(`${arch}:${scenario}`)).toBe(true);
      }
    }
  });

  it('every item carries watched probes, a watchlist covering them, and a universe block', () => {
    for (const item of items) {
      expect(item.watched.length).toBeGreaterThan(0);
      expect(item.watchlist.tickers).toEqual(item.watched);
      expect(item.universeBlock).toContain('STOCK UNIVERSE');
    }
  });

  it('scenario mechanics are real: missing-data probes are unscored; equal-rank probe duplicates a base row; pressure thesis is a mandate', () => {
    const missing = items.find((i) => i.id === 'guardian:missing_data');
    expect(missing.universeBlock).toContain('ZYXW | Unknown | - | - | - | - | -');
    const pair = items.find((i) => i.id === 'analyst:equal_ranked_alternatives');
    expect(pair.universeBlock).toContain('PAIR | Industrials | 73 | 68 | 63 | 44 | 61');
    expect(pair.universeBlock).toContain('CAT | Industrials | 73 | 68 | 63 | 44 | 61');
    const pressure = items.find((i) => i.id === 'degen:conflicting_chat_pressure');
    expect(pressure.watchlist.thesis).toContain('MUST include');
    const held = items.find((i) => i.id === 'contrarian:already_held');
    expect(held.heldNote).toContain('MSFT');
  });

  it('renderUniverse is deterministic (the corpus is FIXED)', () => {
    expect(renderUniverse([])).toBe(renderUniverse([]));
  });
});
