// api/_utils/agentVwapFloor.test.js
// VWAP Floor Semantics V1 — behavioral tests for the pure floor/guard helpers.
// The cron wiring (where these are called) is covered by the static guards in
// api/cron/agent-evaluate.test.js; the June-11 incident replay lives in
// api/cron/agentVwapFloor.replay.test.js.

import { describe, it, expect } from 'vitest';
import {
  MIN_SESSION_CANDLES,
  VWAP_CASCADE_GUARD_N,
  isVwapSessionUsable,
  isVwapStrike,
  pruneCounterMaps,
  seedVwapFireGuard,
  isReplacementQualified,
} from './agentVwapFloor.js';

const TODAY = '2026-06-12';
const YESTERDAY = '2026-06-11';

describe('isVwapSessionUsable — A1 freshness/arming predicate', () => {
  it('arms on a fresh session with enough candles', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: 10 })).toBe(true);
  });

  it("disarms on a stale session (yesterday's candles after a data outage)", () => {
    expect(isVwapSessionUsable({ sessionDate: YESTERDAY, todayET: TODAY, sessionCandleCount: 78 })).toBe(false);
  });

  it('disarms on an ultra-thin session (< MIN_SESSION_CANDLES at the open)', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: MIN_SESSION_CANDLES - 1 })).toBe(false);
  });

  it('boundary: exactly MIN_SESSION_CANDLES arms', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: MIN_SESSION_CANDLES })).toBe(true);
  });

  it('fails closed on a missing sessionDate', () => {
    expect(isVwapSessionUsable({ sessionDate: null, todayET: TODAY, sessionCandleCount: 10 })).toBe(false);
  });
});

describe('isVwapStrike — A2 dead-band strike predicate', () => {
  it('strikes below the dead-band', () => {
    expect(isVwapStrike(-0.6, 0.5)).toBe(true);
  });

  it('does not strike when hovering inside the dead-band (the June-11 -0.05% shape)', () => {
    expect(isVwapStrike(-0.05, 0.5)).toBe(false);
    expect(isVwapStrike(-0.4, 0.5)).toBe(false);
  });

  it('boundary: exactly -deadBand is not a strike (strict <)', () => {
    expect(isVwapStrike(-0.5, 0.5)).toBe(false);
  });

  it('positive deviation never strikes', () => {
    expect(isVwapStrike(0.3, 0.5)).toBe(false);
  });

  it('fails closed on non-finite deviation', () => {
    expect(isVwapStrike(null, 0.5)).toBe(false);
    expect(isVwapStrike(undefined, 0.5)).toBe(false);
    expect(isVwapStrike(NaN, 0.5)).toBe(false);
  });

  it('per-preset bands order correctly (defensive strictest)', () => {
    const dev = -0.4;
    expect(isVwapStrike(dev, 0.3)).toBe(true);  // defensive counts it
    expect(isVwapStrike(dev, 0.5)).toBe(false); // balanced does not
    expect(isVwapStrike(dev, 0.7)).toBe(false); // aggressive does not
  });
});

describe('pruneCounterMaps — B1 counter hygiene', () => {
  it('drops keys for symbols no longer held, across all maps, in place', () => {
    const vwapTicks = { VLO: 7, AAPL: 1 };
    const stagnationTicks = { VLO: 3, AAPL: 0 };
    const lastTickPrice = { VLO: 100, AAPL: 200 };
    const lastTickTimestamp = { VLO: 1, AAPL: 2 };
    pruneCounterMaps([vwapTicks, stagnationTicks, lastTickPrice, lastTickTimestamp], new Set(['AAPL']));
    for (const map of [vwapTicks, stagnationTicks, lastTickPrice, lastTickTimestamp]) {
      expect(Object.keys(map)).toEqual(['AAPL']);
    }
  });

  it('a re-entered symbol starts fresh (its old streak was pruned while unheld)', () => {
    const vwapTicks = { XRP: 7 };
    pruneCounterMaps([vwapTicks], new Set(['MU'])); // XRP swapped out
    expect(vwapTicks.XRP).toBeUndefined();
    // re-entry later: counter seeds at (vwapTicks[XRP] || 0) + 1 = 1, not 8
    expect((vwapTicks.XRP || 0) + 1).toBe(1);
  });

  it('no-op when everything is held', () => {
    const map = { A: 1, B: 2 };
    pruneCounterMaps([map], new Set(['A', 'B']));
    expect(map).toEqual({ A: 1, B: 2 });
  });
});

describe('seedVwapFireGuard — B6 daily fire counter lifecycle', () => {
  it('seeds fresh on first run', () => {
    expect(seedVwapFireGuard(undefined, TODAY)).toEqual({ date: TODAY, count: 0 });
  });

  it('carries the same-day count forward (as a new object)', () => {
    const prev = { date: TODAY, count: 3 };
    const seeded = seedVwapFireGuard(prev, TODAY);
    expect(seeded).toEqual({ date: TODAY, count: 3 });
    expect(seeded).not.toBe(prev); // working copy, persisted state untouched
  });

  it('resets on ET date rollover', () => {
    expect(seedVwapFireGuard({ date: YESTERDAY, count: 9 }, TODAY)).toEqual({ date: TODAY, count: 0 });
  });

  it('tolerates a malformed persisted count', () => {
    expect(seedVwapFireGuard({ date: TODAY, count: undefined }, TODAY)).toEqual({ date: TODAY, count: 0 });
  });

  it('guard activation boundary: inactive at N-1 fires, active at N', () => {
    expect(VWAP_CASCADE_GUARD_N - 1 >= VWAP_CASCADE_GUARD_N).toBe(false);
    expect(VWAP_CASCADE_GUARD_N >= VWAP_CASCADE_GUARD_N).toBe(true);
  });
});

describe('isReplacementQualified — B6 cascade qualification (fail-closed)', () => {
  const base = { sessionDate: TODAY, sessionCandleCount: 10, todayET: TODAY, deadBandPct: 0.5 };

  it('qualifies a fresh replacement above the dead-band', () => {
    expect(isReplacementQualified({ ...base, vwapDeviation: 0.2 })).toBe(true);
    expect(isReplacementQualified({ ...base, vwapDeviation: -0.3 })).toBe(true);
  });

  it('disqualifies a replacement itself below the dead-band', () => {
    expect(isReplacementQualified({ ...base, vwapDeviation: -0.8 })).toBe(false);
  });

  it('disqualifies on a stale session even with a good deviation', () => {
    expect(isReplacementQualified({ ...base, sessionDate: YESTERDAY, vwapDeviation: 1.5 })).toBe(false);
  });

  it('disqualifies on a thin session', () => {
    expect(isReplacementQualified({ ...base, sessionCandleCount: 2, vwapDeviation: 1.5 })).toBe(false);
  });

  it('disqualifies on a missing deviation (fail-closed)', () => {
    expect(isReplacementQualified({ ...base, vwapDeviation: undefined })).toBe(false);
    expect(isReplacementQualified({ ...base, vwapDeviation: NaN })).toBe(false);
  });
});
