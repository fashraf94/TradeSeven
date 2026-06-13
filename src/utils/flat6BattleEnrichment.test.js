// src/utils/flat6BattleEnrichment.test.js
//
// P7 — the flat6 battle view's data-layer battery (the testable seam the phase
// requires, since the codebase has no React DOM harness). Locks: the 2/2/2
// SLOT LABELS, FLAT scoring (tierMultiplier:1 — never 2x/1.5x), SCORER-CONTRACT
// PARITY (the util CALLS calculateAssetScoreV3 — proven by equality with a
// direct call, so a future copy-drift fails here), the banked-score identity,
// the no-opponent render (opponent:null never read), the activation-day
// baseline gate, and the display-score resolution.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of
// flat6BattleEnrichment.js (→ baggerBombUtils → canonical constants) is the
// runtime guard — it explodes here if a browser-only dep ever enters the
// graph. Never mock the scorer.

import { describe, it, expect } from 'vitest';
import {
  buildFlat6BattleModel,
  enrichFlat6Asset,
  resolveDisplayScore,
  flat6BattleSymbols,
  isFlat6ActivationDay,
  FLAT6_SLOT_LABELS,
} from './flat6BattleEnrichment';
import { calculateAssetScoreV3 } from './baggerBombUtils';

const ACTIVATED_AT = '2026-06-13T13:30:00.000Z'; // 09:30 ET, June 13
const SAME_ET_DAY = Date.parse('2026-06-13T18:00:00Z'); // 14:00 ET, June 13
const NEXT_ET_DAY = Date.parse('2026-06-15T18:00:00Z'); // June 15

function flat6Battle(overrides = {}) {
  const asset = (symbol) => ({ symbol, name: symbol, tierMultiplier: 1 });
  return {
    id: 'b1',
    status: 'active',
    gameMode: 'baggerbomb_tournament',
    opponent: null,
    activatedAt: ACTIVATED_AT,
    createdAt: ACTIVATED_AT,
    portfolio: {
      star: [asset('NVDA'), asset('AMD')],
      core: [asset('TSLA'), asset('AAPL')],
      support: [asset('MSFT'), asset('GOOG')],
      startingPrices: { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120 },
    },
    scoring: {
      thresholds: {
        NVDA: { threshold: 2.5 }, AMD: { threshold: 2.5 }, TSLA: { threshold: 2.5 },
        AAPL: { threshold: 2.5 }, MSFT: { threshold: 2.5 }, GOOG: { threshold: 2.5 },
      },
    },
    scoreState: { currentScore: 0 },
    thresholdHistory: {},
    trades: [],
    ...overrides,
  };
}

describe('flat6BattleSymbols', () => {
  it('returns all six holdings across the 2/2/2 slots', () => {
    expect(flat6BattleSymbols(flat6Battle())).toEqual(['NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'GOOG']);
  });
  it('is empty for a null battle', () => {
    expect(flat6BattleSymbols(null)).toEqual([]);
  });
});

describe('buildFlat6BattleModel — slot labels + no opponent', () => {
  it('renders the three LINEUP slot labels (not tier names), 2 assets each', () => {
    const model = buildFlat6BattleModel(flat6Battle(), { now: SAME_ET_DAY });
    expect(model.slots.map(s => s.label)).toEqual([
      FLAT6_SLOT_LABELS.star, FLAT6_SLOT_LABELS.core, FLAT6_SLOT_LABELS.support,
    ]);
    expect(model.slots.map(s => s.label)).toEqual(['Lineup 1–2', 'Lineup 3–4', 'Lineup 5–6']);
    model.slots.forEach(s => expect(s.assets).toHaveLength(2));
    expect(model.holdingsCount).toBe(6);
  });

  it('never reads opponent — a null-opponent doc builds cleanly', () => {
    const battle = flat6Battle({ opponent: null });
    expect(() => buildFlat6BattleModel(battle, { now: SAME_ET_DAY })).not.toThrow();
    const model = buildFlat6BattleModel(battle, { now: SAME_ET_DAY });
    expect(model).not.toHaveProperty('opponentScore');
  });
});

describe('flat scoring (tierMultiplier:1, never 2x)', () => {
  it('scores a star-SLOT name at 1x, not the tiered 2x', () => {
    // NVDA +10% on the activation day (entry baseline 100 → cur 110).
    const battle = flat6Battle();
    const model = buildFlat6BattleModel(battle, { effectivePrices: { NVDA: 110 }, now: SAME_ET_DAY });
    const nvda = model.slots[0].assets.find(a => a.symbol === 'NVDA');
    // base = priceChange(10) * 10 * tierMultiplier(1) = 100 (NOT 200 at 2x).
    expect(nvda.basePoints).toBe(100);
    // Compare to the tiered star multiplier for the same move: 2x → 200.
    const tiered = calculateAssetScoreV3({ symbol: 'NVDA', baseATR: 2.5, tier: 'star' }, 10, {}, {}, 10);
    expect(tiered.basePoints).toBe(200);
    expect(nvda.basePoints).toBeLessThan(tiered.basePoints);
  });
});

describe('SCORER-CONTRACT PARITY (calls the canonical scorer, never copies)', () => {
  it('enrichFlat6Asset.points === a direct calculateAssetScoreV3 call with the same inputs', () => {
    const asset = { symbol: 'NVDA', name: 'NVDA', tierMultiplier: 1 };
    const ctx = {
      startingPrices: { NVDA: 100 },
      effectivePrices: { NVDA: 113 },
      thresholds: { NVDA: { threshold: 2.5 } },
      previousClosePrices: {},
      persistedHistory: {},
      isActivationDay: true,
      slotKey: 'star',
    };
    const enriched = enrichFlat6Asset(asset, ctx);

    // Reproduce the glue the util computed, then call the scorer directly.
    const priceChange = ((113 - 100) / 100) * 100;        // +13%
    const thresholdPriceChange = priceChange;             // activation day → entry baseline
    const multiplier = thresholdPriceChange / 2.5;
    const history = {
      maxMultiplier: Math.max(0, multiplier > 0 ? multiplier : 0),
      minMultiplier: Math.min(0, multiplier < 0 ? multiplier : 0),
    };
    const direct = calculateAssetScoreV3(
      { symbol: 'NVDA', name: 'NVDA', tierMultiplier: 1, baseATR: 2.5, tier: 'star' },
      priceChange, history, {}, thresholdPriceChange,
    );

    expect(enriched.points).toBe(direct.totalPoints);
    expect(enriched.basePoints).toBe(direct.basePoints);
    expect(enriched.bonusPoints).toBe(direct.bonusPoints);
    expect(enriched.badges).toEqual(direct.badges);
  });

  it('defers direction to the scorer ONCE (no pre-negation, no double-negation)', () => {
    // Agents are long-only (V1), so this short asset is a dormant case — but it
    // LOCKS the contract: the glue does NOT pre-negate (display priceChange is
    // the raw move), and points equal a single direct scorer call with the same
    // raw inputs. If a future edit reintroduced the live screen's pre-negation,
    // the scorer would negate twice and this equality would break.
    const asset = { symbol: 'X', tierMultiplier: 1, direction: 'short' };
    const ctx = { startingPrices: { X: 100 }, effectivePrices: { X: 110 }, thresholds: { X: { threshold: 2.5 } }, isActivationDay: true, slotKey: 'core' };
    const enriched = enrichFlat6Asset(asset, ctx);
    expect(enriched.priceChange).toBeCloseTo(10); // RAW move, not pre-negated

    const priceChange = 10;
    const thresholdPriceChange = 10;
    const multiplier = thresholdPriceChange / 2.5;
    const history = {
      maxMultiplier: Math.max(0, multiplier > 0 ? multiplier : 0),
      minMultiplier: Math.min(0, multiplier < 0 ? multiplier : 0),
    };
    const direct = calculateAssetScoreV3({ ...asset, baseATR: 2.5, tier: 'core' }, priceChange, history, {}, thresholdPriceChange);
    expect(enriched.points).toBe(direct.totalPoints);
  });
});

describe('running agent score = active + banked', () => {
  it('adds closed-trade lockedPoints to the live recompute', () => {
    const battle = flat6Battle({ trades: [{ symbolOut: 'OLD', lockedPoints: 50 }, { lockedPoints: 'bad' }] });
    const model = buildFlat6BattleModel(battle, { effectivePrices: { NVDA: 110 }, now: SAME_ET_DAY });
    expect(model.bankedScore).toBe(50); // the non-finite lockedPoints ignored
    expect(model.liveAgentScore).toBe(model.activeScore + 50);
  });
});

describe('activation-day threshold baseline gate', () => {
  it('on day 2+ uses previousClose, not entry, for the threshold change', () => {
    expect(isFlat6ActivationDay(flat6Battle(), SAME_ET_DAY)).toBe(true);
    expect(isFlat6ActivationDay(flat6Battle(), NEXT_ET_DAY)).toBe(false);

    // Day 2: entry 100, previousClose 105, current 110 → threshold change vs 105.
    const a = enrichFlat6Asset(
      { symbol: 'X', tierMultiplier: 1 },
      { startingPrices: { X: 100 }, previousClosePrices: { X: 105 }, effectivePrices: { X: 110 }, thresholds: { X: { threshold: 2.5 } }, isActivationDay: false, slotKey: 'support' },
    );
    expect(a.thresholdPriceChange).toBeCloseTo(((110 - 105) / 105) * 100);
    // priceChange (base scoring) still vs entry.
    expect(a.priceChange).toBeCloseTo(10);
  });
});

describe('resolveDisplayScore', () => {
  it('trusts the persisted cron score until prices load', () => {
    expect(resolveDisplayScore({ pricesLoaded: false, isComplete: false, liveAgentScore: 999, persistedScore: 42 })).toBe(42);
  });
  it('freezes a completed battle on the persisted final', () => {
    expect(resolveDisplayScore({ pricesLoaded: true, isComplete: true, liveAgentScore: 10, persistedScore: 88 })).toBe(88);
  });
  it('uses the live recompute for an active, priced battle', () => {
    expect(resolveDisplayScore({ pricesLoaded: true, isComplete: false, liveAgentScore: 73, persistedScore: 0 })).toBe(73);
  });
});
