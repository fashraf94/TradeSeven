// src/utils/leagueStarMeter.test.js
//
// The import below transitively loads api/_utils/tournamentUserScoring.js into
// the Node/Vitest env — if that cross-tree chain ever pulled server-only code
// into the client surface, THIS import would throw. That is the hard
// dependency-surface guard (founder item 1); keep it real, never mock it.
import { describe, it, expect } from 'vitest';
import { readAgentStars, readUserStar, readUserStars } from './leagueStarMeter';
import { buildFlat6BattleModel } from './flat6BattleEnrichment';
import { CAPTURE_STATE } from '../constants/leagueTournament';

describe('dependency-surface guard', () => {
  it('the cross-tree import (src → api/_utils/tournamentUserScoring) loads clean in Node', () => {
    expect(typeof readUserStar).toBe('function');
    expect(typeof readAgentStars).toBe('function');
  });
});

describe('readAgentStars — agent six, parity with buildFlat6BattleModel', () => {
  const battle = {
    status: 'active',
    portfolio: {
      star: [{ symbol: 'MSTR', direction: 'long' }],
      core: [], support: [],
      startingPrices: { MSTR: 100 },
    },
    scoring: { thresholds: { MSTR: { threshold: 2.5 } } },
    trades: [{ symbolIn: 'MSTR', symbolOut: 'SOFI', swapDay: 3 }],
  };
  const priceCtx = { effectivePrices: { MSTR: 110 }, isActivationDay: true };

  it('maps tk/tier/dir/mult/state/badge and never recomputes (points match the model)', () => {
    const [row] = readAgentStars(battle, priceCtx);
    const enriched = buildFlat6BattleModel(battle, priceCtx).slots[0].assets[0];
    expect(row.tk).toBe('MSTR');
    expect(row.tier).toBe('star');
    expect(row.dir).toBe('long');
    expect(row.mult).toBeCloseTo(4, 5);       // thresholdPriceChange 10% / baseATR 2.5
    expect(row.state).toBe('hit');
    expect(row.badge).toBe('TenBagger');       // crossed all positive tiers (mult 4 ≥ 2.0)
    expect(row.points).toBe(enriched.points);  // parity, not a re-derivation
    expect(row.banked).toBe(enriched.bonusPoints);
  });

  it('justIn flags the symbol swapped in on the latest swap day', () => {
    const [row] = readAgentStars(battle, priceCtx);
    expect(row.justIn).toBe(true);
    const noSwap = readAgentStars({ ...battle, trades: [] }, priceCtx);
    expect(noSwap[0].justIn).toBe(false);
  });
});

describe('readUserStar — user picks via scorePick', () => {
  it('NO RE-NEGATION: a short whose price FELL scores positive → hit', () => {
    const pick = { symbol: 'TSLA', legs: [{ direction: 'short', baselinePrice: 100, thresholdHistory: [] }] };
    const row = readUserStar(pick, { quote: { current: 90 }, baseATR: 2.5 }); // -10% raw → +10% for the short
    expect(row.dir).toBe('short');
    expect(row.mult).toBeCloseTo(4, 5); // +10% / 2.5, scorer negated the short ONCE
    expect(row.state).toBe('hit');
    expect(row.points).toBeGreaterThan(0);
  });

  it('banked + live composition: points === banked + live leg', () => {
    const pick = {
      symbol: 'NVDA',
      legs: [
        { direction: 'long', baselinePrice: 100, closedAt: '2026-06-10T20:00:00Z', bankedScore: 15, thresholdHistory: [] },
        { direction: 'long', baselinePrice: 110, thresholdHistory: [] },
      ],
    };
    const row = readUserStar(pick, { quote: { current: 121 }, baseATR: 2.5 });
    expect(row.banked).toBe(15);                // the closed leg's banked points
    expect(row.points).toBeGreaterThan(15);     // + a positive live leg
    expect(row.tier).toBe('support');
  });

  it('a missing/zero quote does not throw — quiet, zero points', () => {
    const pick = { symbol: 'AAPL', legs: [{ direction: 'long', baselinePrice: 100, thresholdHistory: [] }] };
    const row = readUserStar(pick, { quote: { current: 0 }, baseATR: 2.5 });
    expect(row.points).toBe(0);
    expect(row.state).toBe('quiet');
  });

  it('a fully-SETTLED pick (no open leg) surfaces banked points with state quiet (documented)', () => {
    // Both legs closed → scorePick returns liveLegResult: null. points = banked total,
    // state describes (absent) live movement = 'quiet'. The complete-state badge is the
    // component phase's job; here we pin the live-layer contract so it's intentional.
    const pick = {
      symbol: 'NVDA',
      legs: [
        { direction: 'long', baselinePrice: 100, closedAt: '2026-06-10T20:00:00Z', bankedScore: 30, thresholdHistory: [] },
        { direction: 'short', baselinePrice: 120, closedAt: '2026-06-11T20:00:00Z', bankedScore: 20, thresholdHistory: [] },
      ],
    };
    const row = readUserStar(pick, { quote: { current: 130 }, baseATR: 2.5 });
    expect(row.banked).toBe(50);   // 30 + 20, both closed legs
    expect(row.points).toBe(50);   // no live leg to add
    expect(row.state).toBe('quiet');
    expect(row.badge).toBeNull();
    expect(row.dir).toBe('short'); // last leg's direction
  });
});

describe('readUserStars — three picks, default vs supplied ATR', () => {
  const player = {
    picks: [
      { symbol: 'GE', legs: [{ direction: 'long', baselinePrice: 100, thresholdHistory: [] }] },
      { symbol: 'BTC', legs: [{ direction: 'long', baselinePrice: 100, thresholdHistory: [] }] },
    ],
  };
  it('maps every pick and respects supplied ATR over the default', () => {
    const rows = readUserStars(
      player,
      { GE: { current: 105 }, BTC: { current: 105 } },
      { atrBySymbol: { GE: 5 }, cryptoSymbols: new Set(['BTC']) },
    );
    expect(rows.map((r) => r.tk)).toEqual(['GE', 'BTC']);
    // GE: +5% / atr 5 = 1.0 → hit boundary; BTC: +5% / crypto default 5.0 = 1.0 → hit
    expect(rows[0].mult).toBeCloseTo(1, 5);
    expect(rows[1].mult).toBeCloseTo(1, 5);
  });
});

describe('readUserStar / readUserStars — settleState (canonical-open axis)', () => {
  const pendingPick = { symbol: 'NVDA', legs: [{ direction: 'long', baselinePrice: null, captureState: CAPTURE_STATE.PENDING_OPEN, thresholdHistory: [] }] };
  const capturedPick = { symbol: 'AMD', legs: [{ direction: 'long', baselinePrice: 100, captureState: CAPTURE_STATE.CAPTURED, thresholdHistory: [] }] };

  it('legacy (default) → settleState null; canonical → a first-class state', () => {
    expect(readUserStar(pendingPick, { quote: { current: 100 }, baseATR: 2.5 }).settleState).toBeNull();
    expect(readUserStar(pendingPick, { quote: { current: 100 }, baseATR: 2.5, canonicalPolicy: true }).settleState).toBe('pending');
    expect(readUserStar(capturedPick, { quote: { current: 103 }, baseATR: 2.5, canonicalPolicy: true }).settleState).toBe('estimated');
    expect(readUserStar(capturedPick, { quote: { current: 103 }, baseATR: 2.5, canonicalPolicy: true, dayBanked: true }).settleState).toBe('official');
  });

  it('readUserStars threads canonicalPolicy/dayBanked to every pick; legacy stays null', () => {
    const player = { picks: [pendingPick, capturedPick] };
    const quotes = { NVDA: { current: 100 }, AMD: { current: 103 } };
    expect(readUserStars(player, quotes, { canonicalPolicy: true }).map((r) => r.settleState)).toEqual(['pending', 'estimated']);
    expect(readUserStars(player, quotes).map((r) => r.settleState)).toEqual([null, null]);
  });
});
