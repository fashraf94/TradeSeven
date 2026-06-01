// src/data/onboardingStockTiers.test.js
//
// Guards the onboarding stock-pick curated content + the sector-affinity
// derivation that feeds personality.sectorAffinity (NOT the archetype).

import { describe, it, expect } from 'vitest';
import {
  STOCK_TIERS, PICK_MIN, PICK_MAX, getPickMeta, deriveSectorAffinity,
} from './onboardingStockTiers.js';

describe('onboarding stock tiers — content integrity', () => {
  it('pins the pick range to the locked 3–8', () => {
    expect(PICK_MIN).toBe(3);
    expect(PICK_MAX).toBe(8);
  });

  it('has three risk tiers, each with well-formed picks', () => {
    expect(STOCK_TIERS).toHaveLength(3);
    for (const tier of STOCK_TIERS) {
      expect(tier.id).toBeTruthy();
      expect(tier.label).toBeTruthy();
      expect(tier.picks.length).toBeGreaterThanOrEqual(PICK_MAX); // enough to pick a full set within one tier
      for (const p of tier.picks) {
        expect(p.symbol).toMatch(/^[A-Z0-9.-]{1,12}$/); // round-trips through watchlistEquip's SYMBOL_REGEX
        expect(p.name).toBeTruthy();
        expect(p.sector).toBeTruthy();
      }
    }
  });

  it('has no duplicate symbols across tiers', () => {
    const all = STOCK_TIERS.flatMap((t) => t.picks.map((p) => p.symbol));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('getPickMeta', () => {
  it('returns sector + tier metadata for a known symbol', () => {
    const lly = getPickMeta('LLY');
    expect(lly.sector).toBe('Healthcare');
    expect(lly.tierLabel).toBe('Steady');
  });

  it('returns null for an unknown symbol', () => {
    expect(getPickMeta('ZZZZ')).toBeNull();
  });
});

describe('deriveSectorAffinity', () => {
  it('orders sectors by pick frequency, most first', () => {
    // AAPL/MSFT/NVDA = Technology ×3, LLY = Healthcare ×1
    expect(deriveSectorAffinity(['AAPL', 'MSFT', 'NVDA', 'LLY'])).toEqual(['Technology', 'Healthcare']);
  });

  it('breaks frequency ties alphabetically (deterministic)', () => {
    // KO = Consumer Staples ×1, NEE = Utilities ×1 → alphabetical
    expect(deriveSectorAffinity(['KO', 'NEE'])).toEqual(['Consumer Staples', 'Utilities']);
  });

  it('ignores unknown symbols and handles empty / non-array input', () => {
    expect(deriveSectorAffinity(['AAPL', 'ZZZZ'])).toEqual(['Technology']);
    expect(deriveSectorAffinity([])).toEqual([]);
    expect(deriveSectorAffinity(undefined)).toEqual([]);
  });
});
