// api/_utils/agentVwapFloor.test.js
// VWAP Floor Semantics V1 — behavioral tests for the pure floor/guard helpers.
// The cron wiring (where these are called) is covered by the static guards in
// api/cron/agent-evaluate.test.js; the June-11 incident replay lives in
// api/cron/agentVwapFloor.replay.test.js.

import { describe, it, expect } from 'vitest';
import {
  MIN_SESSION_CANDLES,
  VWAP_CASCADE_GUARD_N,
  VWAP_LEGACY_MAX_AGE_MS,
  isVwapSessionUsable,
  isVwapStrike,
  pruneCounterMaps,
  seedVwapFireGuard,
  isReplacementQualified,
  newestCandleAsOfMs,
} from './agentVwapFloor.js';

const TODAY = '2026-06-12';
const YESTERDAY = '2026-06-11';
// Intraday Data Build 1 §11: every row below carries a FRESH instant (the
// newest candle 10 minutes before the clock) — the freshness clause is
// mandatory, so the pre-§11 rows keep asserting the date/count legs only
// with a fresh feed. The clause itself is asserted in its own block.
const NOW = Date.UTC(2026, 5, 12, 15, 0, 0);
const FRESH = { asOfMs: NOW - 10 * 60_000, nowMs: NOW };

describe('isVwapSessionUsable — A1 freshness/arming predicate', () => {
  it('arms on a fresh session with enough candles', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: 10, ...FRESH })).toBe(true);
  });

  it("disarms on a stale session (yesterday's candles after a data outage)", () => {
    expect(isVwapSessionUsable({ sessionDate: YESTERDAY, todayET: TODAY, sessionCandleCount: 78, ...FRESH })).toBe(false);
  });

  it('disarms on an ultra-thin session (< MIN_SESSION_CANDLES at the open)', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: MIN_SESSION_CANDLES - 1, ...FRESH })).toBe(false);
  });

  it('boundary: exactly MIN_SESSION_CANDLES arms', () => {
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, sessionCandleCount: MIN_SESSION_CANDLES, ...FRESH })).toBe(true);
    expect(isVwapSessionUsable({ sessionDate: TODAY, todayET: TODAY, coverageCount: MIN_SESSION_CANDLES, ...FRESH })).toBe(true);
  });

  it('fails closed on a missing sessionDate', () => {
    expect(isVwapSessionUsable({ sessionDate: null, todayET: TODAY, sessionCandleCount: 10, ...FRESH })).toBe(false);
  });
});

describe('isVwapSessionUsable — the §11 freshness clause (Intraday Data Build 1, the one flags-off change)', () => {
  const ok = { sessionDate: TODAY, todayET: TODAY, coverageCount: 10 };

  it('VWAP_LEGACY_MAX_AGE_MS is 45 minutes', () => {
    expect(VWAP_LEGACY_MAX_AGE_MS).toBe(45 * 60 * 1000);
  });

  it('refuses a STALLED feed: today-dated candles whose newest bar is older than 45 minutes (the 09:35-then-nothing shape)', () => {
    // Three bars published at 09:30/09:35/09:40 ET, then the feed stalls; the
    // 12:00 ET tick: date matches, count ≥ 3, the newest bar is 2h20m old.
    const newest = Date.UTC(2026, 5, 12, 13, 40, 0);
    const noon = Date.UTC(2026, 5, 12, 16, 0, 0);
    expect(isVwapSessionUsable({ ...ok, coverageCount: 3, asOfMs: newest, nowMs: noon })).toBe(false);
    // …and the same three bars at 09:50 ET (10 minutes old) pass.
    expect(isVwapSessionUsable({ ...ok, coverageCount: 3, asOfMs: newest, nowMs: newest + 10 * 60_000 })).toBe(true);
  });

  it('boundary: exactly 45 minutes old arms; one millisecond more is refused', () => {
    expect(isVwapSessionUsable({ ...ok, asOfMs: NOW - VWAP_LEGACY_MAX_AGE_MS, nowMs: NOW })).toBe(true);
    expect(isVwapSessionUsable({ ...ok, asOfMs: NOW - VWAP_LEGACY_MAX_AGE_MS - 1, nowMs: NOW })).toBe(false);
  });

  it('the clause is MANDATORY: a missing or non-finite instant fails closed (the pre-§11 call shape no longer arms)', () => {
    expect(isVwapSessionUsable({ ...ok })).toBe(false);
    expect(isVwapSessionUsable({ ...ok, asOfMs: null, nowMs: NOW })).toBe(false);
    expect(isVwapSessionUsable({ ...ok, asOfMs: NaN, nowMs: NOW })).toBe(false);
    expect(isVwapSessionUsable({ ...ok, asOfMs: NOW, nowMs: undefined })).toBe(false);
  });

  it('a caller may tighten or loosen maxAgeMs explicitly', () => {
    expect(isVwapSessionUsable({ ...ok, asOfMs: NOW - 20 * 60_000, nowMs: NOW, maxAgeMs: 15 * 60_000 })).toBe(false);
    expect(isVwapSessionUsable({ ...ok, asOfMs: NOW - 60 * 60_000, nowMs: NOW, maxAgeMs: 90 * 60_000 })).toBe(true);
  });

  it('newestCandleAsOfMs reads EODHD datetimes (UTC), ISO strings and second/ms timestamps; null when nothing parses', () => {
    expect(newestCandleAsOfMs([
      { datetime: '2026-06-12 13:30:00' }, { datetime: '2026-06-12 13:45:00' }, { datetime: '2026-06-12 13:40:00' },
    ])).toBe(Date.UTC(2026, 5, 12, 13, 45, 0));
    expect(newestCandleAsOfMs([{ datetime: '2026-06-12T13:45:00.000Z' }])).toBe(Date.UTC(2026, 5, 12, 13, 45, 0));
    expect(newestCandleAsOfMs([{ timestamp: 1781185500 }])).toBe(1781185500 * 1000);
    expect(newestCandleAsOfMs([{ timestamp: 1781185500000 }])).toBe(1781185500000);
    expect(newestCandleAsOfMs([{ datetime: 'garbage' }, {}])).toBeNull();
    expect(newestCandleAsOfMs([])).toBeNull();
    expect(newestCandleAsOfMs(null)).toBeNull();
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
  const base = { sessionDate: TODAY, sessionCandleCount: 10, todayET: TODAY, deadBandPct: 0.5, ...FRESH };

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

  it('§11: disqualifies on a STALLED fresh fetch, and on a missing instant', () => {
    expect(isReplacementQualified({ ...base, vwapDeviation: 1.5, asOfMs: NOW - 46 * 60_000 })).toBe(false);
    expect(isReplacementQualified({ ...base, vwapDeviation: 1.5, asOfMs: undefined })).toBe(false);
    expect(isReplacementQualified({ ...base, vwapDeviation: 1.5, asOfMs: NOW - 44 * 60_000 })).toBe(true);
  });
});
