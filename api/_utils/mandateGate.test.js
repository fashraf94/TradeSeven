// api/_utils/mandateGate.test.js
// Spec 1 §3.4 — deterministic gate order (C-21). Exercises the exit lane,
// universe check, cash-floor sizing, sector cap, weight cap, and position cap,
// plus the constitutional guarantee: a SELL on fresh data is NEVER suppressed.

import { describe, it, expect } from 'vitest';
import { evaluateGate } from './mandateGate.js';
import { checkSectorCap, sectorExposureUsd } from './mandateSectorCap.js';

const GATE = {
  cashFloorPct: 0.02,
  minPositions: 5,
  maxPositions: 15,
  maxSinglePositionWeightPct: 0.35,
  sectorConcentrationCap: 0.30,
  decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'],
};

const SNAP = {
  symbols: {
    AAPL: { complete: true, price: 200, sector: 'Technology' },
    MSFT: { complete: true, price: 400, sector: 'Technology' },
    XOM: { complete: true, price: 100, sector: 'Energy' },
    FROZEN: { complete: false, price: null, sector: 'Technology' },
  },
};

// A book: AAPL 100sh @mark 200 = $20k in Technology; cash $80k; total $100k.
const POSITIONS = { AAPL: { shares: 100, costBasisTotal: 18000, lastMark: 200, sector: 'Technology' } };
const CASH = 80000;

describe('HOLD + exit lane', () => {
  it('HOLD always passes', () => {
    const r = evaluateGate({ decision: { verb: 'HOLD' }, positions: POSITIONS, cash: CASH, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(true);
    expect(r.rule).toBe('hold');
  });

  it('SELL of a held, fresh symbol passes the exit lane', () => {
    const r = evaluateGate({
      decision: { verb: 'SELL', ticker: 'AAPL' }, positions: POSITIONS, cash: CASH, snapshot: SNAP,
      gateConfig: GATE, actionableHeld: new Set(['AAPL']),
    });
    expect(r.passed).toBe(true);
    expect(r.rule).toBe('exit_lane');
  });

  it('SELL of a non-held symbol is gated (not_held)', () => {
    const r = evaluateGate({ decision: { verb: 'SELL', ticker: 'TSLA' }, positions: POSITIONS, cash: CASH, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.reason).toBe('not_held');
  });

  it('SELL of a held-but-stale symbol STILL PASSES (C-21: exit never suppressed; executor fills at last-good mark)', () => {
    const r = evaluateGate({
      decision: { verb: 'SELL', ticker: 'AAPL' }, positions: POSITIONS, cash: CASH, snapshot: SNAP,
      gateConfig: GATE, actionableHeld: new Set([]), // AAPL not fresh — but the exit is never blocked
    });
    expect(r.passed).toBe(true);
    expect(r.rule).toBe('exit_lane');
    expect(r.freshMark).toBe(false); // the mark is stale; the executor uses carry-over
  });

  it('TRIM carries its dollar size through to execution', () => {
    const r = evaluateGate({
      decision: { verb: 'TRIM', ticker: 'AAPL', sizeUsd: 5000 }, positions: POSITIONS, cash: CASH, snapshot: SNAP,
      gateConfig: GATE, actionableHeld: new Set(['AAPL']),
    });
    expect(r.passed).toBe(true);
    expect(r.execSizeUsd).toBe(5000);
  });
});

describe('C-21 — a SELL on fresh data is never suppressed by book state', () => {
  it('passes even when the book is below min positions (bootstrapping) and quarantine-like state', () => {
    // Single position → positionCount 1 < minPositions 5 → bootstrapping true.
    const r = evaluateGate({
      decision: { verb: 'SELL', ticker: 'AAPL' }, positions: POSITIONS, cash: CASH, snapshot: SNAP,
      gateConfig: GATE, actionableHeld: new Set(['AAPL']),
    });
    expect(r.passed).toBe(true);       // exit not blocked
    expect(r.bootstrapping).toBe(true); // and the book IS below target
  });
});

describe('entry gates — universe, cash floor, sector cap, weight, count', () => {
  it('BUY of a symbol not present-and-complete in the snapshot is gated (universe)', () => {
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'FROZEN', sizeUsd: 1000 }, positions: POSITIONS, cash: CASH, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('universe');
  });

  it('BUY clamps to spendable when under the weight/sector caps', () => {
    // Buy XOM $50k requested; spendable 78k; XOM weight after = 50k/100k = 50% > 35% cap → rejected.
    // Use a small book so a modest buy clamps on cash, not weight: cash 1000, total = 20000(AAPL)+1000 = 21000.
    const smallCash = 1000;
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'XOM', sizeUsd: 5000 }, positions: POSITIONS, cash: smallCash, snapshot: SNAP, gateConfig: GATE });
    // spendable = 1000 - 0.02*21000 = 580. execSize clamps to 580; XOM weight 580/21000 ~2.8% ok; Energy sector ~2.8% < 30%.
    expect(r.passed).toBe(true);
    expect(r.clamped).toBe(true);
    expect(r.execSizeUsd).toBeCloseTo(580, 5);
  });

  it('BUY at/below the cash floor is gated (cash_floor)', () => {
    // cash exactly at floor: cash 2000, total = 20000+2000 = 22000, floor = 440; spendable 1560 >0.
    // Make cash below floor: cash 100, total = 20100, floor = 402 → spendable negative.
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'XOM', sizeUsd: 100 }, positions: POSITIONS, cash: 100, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('cash_floor');
  });

  it('BUY breaching the sector cap is gated (fail-closed)', () => {
    // AAPL already 20k Technology (20%). Buy MSFT (Technology) $15k → Tech 35k/100k = 35% > 30% cap.
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'MSFT', sizeUsd: 15000 }, positions: POSITIONS, cash: CASH, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('sector_cap');
  });

  it('sector cap uses the FRESH mark, not the stale lastMark (C1 fail-open regression)', () => {
    // Held AAPL 100sh @ stale lastMark 100 (Tech), but the fresh snapshot marks it 300.
    // Fresh Tech exposure = 30k; total = 30k + 71k cash = 101k. A $2k MSFT (Tech) buy →
    // (30k+2k)/101k ≈ 31.7% > 30% cap → gated. With the OLD stale-mark numerator (10k)
    // it would have been (10k+2k)/101k ≈ 11.9% and wrongly PASSED.
    const positions = { AAPL: { shares: 100, costBasisTotal: 10000, lastMark: 100, sector: 'Technology' } };
    const snap = { symbols: { AAPL: { complete: true, price: 300, sector: 'Technology' }, MSFT: { complete: true, price: 400, sector: 'Technology' } } };
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'MSFT', sizeUsd: 2000 }, positions, cash: 71000, snapshot: snap, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('sector_cap');
  });

  it('BUY of a complete symbol whose daily sector is unknown fails closed (C4 — no seed guess)', () => {
    // AAPL is present-and-complete but its snapshot sector is null (daily not enriched).
    const snap = { symbols: { AAPL: { complete: true, price: 200, sector: null } } };
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'AAPL', sizeUsd: 1000 }, positions: {}, cash: 100000, snapshot: snap, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('sector_cap');
    expect(r.reason).toBe('unknown_sector');
  });

  it('BUY breaching max single-position weight is gated (sector cap lifted to isolate it)', () => {
    // With sector cap unlimited (null), a $40k XOM buy on a fresh $100k book is
    // 40% weight > the 35% single-position cap → weight gate fires.
    const noSectorCap = { ...GATE, sectorConcentrationCap: null };
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'XOM', sizeUsd: 40000 }, positions: {}, cash: 100000, snapshot: SNAP, gateConfig: noSectorCap });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('max_single_position_weight');
  });

  it('BUY of a NEW ticker at the position cap is gated (max_positions)', () => {
    const positions = {};
    for (let i = 0; i < 15; i++) positions[`S${i}`] = { shares: 1, costBasisTotal: 100, lastMark: 100, sector: 'Utilities' };
    // total = 15*100 + cash. cash 100000. New ticker XOM.
    const r = evaluateGate({ decision: { verb: 'BUY', ticker: 'XOM', sizeUsd: 1000 }, positions, cash: 100000, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(false);
    expect(r.rule).toBe('max_positions');
  });

  it('ADD to an existing position at the position cap still passes (no new position)', () => {
    const positions = {};
    for (let i = 0; i < 15; i++) positions[`S${i}`] = { shares: 1, costBasisTotal: 100, lastMark: 100, sector: 'Utilities' };
    positions.AAPL = { shares: 10, costBasisTotal: 2000, lastMark: 200, sector: 'Technology' };
    // 16 positions but ADD to held AAPL adds no new slot. Small add to stay under caps.
    const r = evaluateGate({ decision: { verb: 'ADD', ticker: 'AAPL', sizeUsd: 500 }, positions, cash: 100000, snapshot: SNAP, gateConfig: GATE });
    expect(r.passed).toBe(true);
    expect(r.rule).toBe('add');
  });
});

describe('sector cap unit — fail-closed policy on fresh exposure', () => {
  it('null cap is unlimited (passes)', () => {
    expect(checkSectorCap({ sector: 'Technology', addUsd: 1e9, sectorExposureUsd: {}, totalValue: 100, cap: null }).passed).toBe(true);
  });
  it('unknown sector with a cap set fails closed', () => {
    expect(checkSectorCap({ sector: null, addUsd: 1, sectorExposureUsd: {}, totalValue: 100, cap: 0.3 }).passed).toBe(false);
  });
  it('checks (current + add)/total against the cap, boundary passes', () => {
    // Tech already 25; add 5 → 30/100 = 30% == cap 0.30 → passes (boundary).
    expect(checkSectorCap({ sector: 'Tech', addUsd: 5, sectorExposureUsd: { Tech: 25 }, totalValue: 100, cap: 0.30 }).passed).toBe(true);
    // add 6 → 31% > 30% → fails.
    expect(checkSectorCap({ sector: 'Tech', addUsd: 6, sectorExposureUsd: { Tech: 25 }, totalValue: 100, cap: 0.30 }).passed).toBe(false);
  });
  it('sectorExposureUsd helper sums marked position value by sector', () => {
    const exp = sectorExposureUsd({ A: { shares: 10, lastMark: 5, sector: 'X' }, B: { shares: 2, lastMark: 10, sector: 'X' }, C: { shares: 1, lastMark: 100, sector: 'Y' } });
    expect(exp).toEqual({ X: 70, Y: 100 });
  });
});
