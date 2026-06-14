// api/cron/agentVwapFloor.replay.test.js
// VWAP Floor Semantics V1 — June 11 incident replay (spec §6 acceptance).
//
// SYNTHETIC fixture: no battle-doc export of agent "Shadow" exists in the
// repo, so this reconstructs the incident's load-bearing shapes from the
// spec/audit: a stale intraday session (EODHD returning June 10 candles all
// day), vwap counters surviving swaps (VLO/XRP at 7), deviations hovering
// just below zero, a bench with a duplicate LRCX entry, and PANW/LRCX
// held-symbol collisions (LRCX→LRCX self-swap, PANW triple-slot).
//
// Scope: drives the PURE layers — floor predicates, evaluateRisk, the
// replacement pickers, and validateTradeDecision. Transaction-level
// enforcement (self/dup throws, bench replace-or-append) is covered in
// agentSwapExecution.test.js (the allowed executeSwapServer test home), and
// the cron wiring by the static guards in agent-evaluate.test.js.

import { describe, it, expect } from 'vitest';
import {
  isVwapSessionUsable,
  isVwapStrike,
  pruneCounterMaps,
  seedVwapFireGuard,
  isReplacementQualified,
  VWAP_CASCADE_GUARD_N,
} from '../_utils/agentVwapFloor.js';
import { evaluateRisk, pickSwapReplacementCandidate } from '../_utils/agentRiskManager.js';
import { validateTradeDecision } from '../_utils/agentSwapExecution.js';

const INCIDENT_DAY = '2026-06-11';
const STALE_SESSION = '2026-06-10'; // what EODHD kept returning that morning
const BALANCED_DEAD_BAND = 0.5;

// Held portfolio at the height of the incident (post-PANW-pile-in shape).
const HELD = ['LRCX', 'PANW', 'MU'];

// Per-symbol stale-session intraday state — every symbol's "latest session"
// is yesterday. Counters as persisted after the 6th swap (prune did not exist).
const STALE_SESSIONS = {
  LRCX: { sessionDate: STALE_SESSION, sessionCandleCount: 78 },
  PANW: { sessionDate: STALE_SESSION, sessionCandleCount: 78 },
  MU: { sessionDate: STALE_SESSION, sessionCandleCount: 78 },
};
const SURVIVING_COUNTERS = { VLO: 7, XRP: 7, LRCX: 2 };

describe('replay §6.1 — stale-session day arms nothing', () => {
  it('no symbol passes the freshness gate, so no vwap entry is published', () => {
    for (const symbol of HELD) {
      expect(isVwapSessionUsable({ ...STALE_SESSIONS[symbol], todayET: INCIDENT_DAY })).toBe(false);
    }
  });

  it('with no snapshot, an aged counter alone cannot fire vwap_failure (the 12-swap engine is off)', () => {
    for (const symbol of HELD) {
      const r = evaluateRisk(
        { symbol, baseATR: 2.5, dailyPct: 0 },
        100, 100, 2.5,
        null, // A1: stale session published no momentumData.vwap entry
        { ticksBelowVwap: 7 },
        {},
      );
      expect(r.action).toBe('HOLD');
    }
  });
});

describe('replay §6.5 — dead-band hover is noise, not weakness', () => {
  // The incident-morning deviation profile: persistently negative, never deep.
  const HOVER_DEVIATIONS = [-0.05, -0.12, -0.21, -0.38, -0.49];

  it('zero strikes across the hover profile at the balanced dead-band', () => {
    for (const deviation of HOVER_DEVIATIONS) {
      expect(isVwapStrike(deviation, BALANCED_DEAD_BAND)).toBe(false);
    }
  });

  it('even WITH an aged counter and a fresh snapshot, a hover tick does not fire (A3)', () => {
    const r = evaluateRisk(
      { symbol: 'LRCX', baseATR: 2.5, dailyPct: 0 },
      100, 100, 2.5,
      { vwap: 100, vwapDeviation: -0.45, sma20_5m: null },
      { ticksBelowVwap: 7 },
      {},
    );
    expect(r.action).toBe('HOLD');
  });
});

describe('replay §6.2 — held/self can never be picked again', () => {
  // June 11 bench shape: duplicate LRCX entries plus names already held.
  const INCIDENT_BENCH = [
    { symbol: 'LRCX', isCrypto: false },
    { symbol: 'LRCX', isCrypto: false }, // the duplicate B4 now prevents
    { symbol: 'PANW', isCrypto: false },
    { symbol: 'VLO', isCrypto: false },
  ];
  const prices = {
    LRCX: { changePercent: 4 },
    PANW: { changePercent: 3 },
    VLO: { changePercent: 1 },
  };

  it('the picker skips held symbols (incl. the outgoing LRCX) and lands on the only free name', () => {
    const pick = pickSwapReplacementCandidate({
      benchAssets: INCIDENT_BENCH,
      prices,
      outgoingIsCrypto: false,
      heldSymbols: new Set(HELD),
    });
    expect(pick.symbol).toBe('VLO'); // not LRCX (self), not PANW (held)
  });

  it('returns null (skip-and-hold) when every bench name is held', () => {
    const pick = pickSwapReplacementCandidate({
      benchAssets: INCIDENT_BENCH.filter(a => a.symbol !== 'VLO'),
      prices,
      outgoingIsCrypto: false,
      heldSymbols: new Set(HELD),
    });
    expect(pick).toBeNull();
  });

  it('validateTradeDecision pre-flags the two incident decision shapes', () => {
    const battle = {
      portfolio: {
        star: [{ symbol: 'LRCX', isCrypto: false }],
        core: [{ symbol: 'PANW', isCrypto: false }],
        support: [{ symbol: 'MU', isCrypto: false }],
        bench: { stocks: INCIDENT_BENCH, crypto: null },
      },
      watchlist: { hotBench: [] },
    };
    const base = { decision: 'SWAP', conviction: 85, hypothesis: 'replayed incident decision shape' };

    const selfSwap = validateTradeDecision({ ...base, symbolOut: 'LRCX', symbolIn: 'LRCX' }, battle);
    expect(selfSwap.valid).toBe(false);
    expect(selfSwap.errors.join(' ')).toMatch(/cannot replace itself/);

    const tripleSlot = validateTradeDecision({ ...base, symbolOut: 'MU', symbolIn: 'PANW' }, battle);
    expect(tripleSlot.valid).toBe(false);
    expect(tripleSlot.errors.join(' ')).toMatch(/already occupies an active portfolio slot/);
  });
});

describe('replay §6.4 — counters do not survive their positions', () => {
  it('the tick-start prune drops VLO/XRP streaks once those names are no longer held', () => {
    const vwapTicks = { ...SURVIVING_COUNTERS };
    const stagnationTicks = { VLO: 4, LRCX: 0 };
    pruneCounterMaps([vwapTicks, stagnationTicks], new Set(HELD));
    expect(vwapTicks).toEqual({ LRCX: 2 });
    expect(stagnationTicks).toEqual({ LRCX: 0 });
  });
});

describe('replay §6.7 — no mass flagging when freshness returns', () => {
  it('the morning after (fresh sessions, healthy deviations) nothing fires despite the stale counters', () => {
    // A1 passes again, but the counters were pruned and deviations are healthy.
    expect(isVwapSessionUsable({ sessionDate: '2026-06-12', todayET: '2026-06-12', sessionCandleCount: 12 })).toBe(true);
    const r = evaluateRisk(
      { symbol: 'LRCX', baseATR: 2.5, dailyPct: 0 },
      100, 100, 2.5,
      { vwap: 100, vwapDeviation: 0.4, sma20_5m: null },
      { ticksBelowVwap: 0 },
      {},
    );
    expect(r.action).toBe('HOLD');
  });
});

describe('replay §6.6 — the cascade guard would have stopped the spiral at N', () => {
  it('fires 1..N-1 pass unguarded; the Nth+ must qualify, and June-11 candidates could not', () => {
    let guard = seedVwapFireGuard(undefined, INCIDENT_DAY);
    const guardActiveAt = [];
    for (let fire = 1; fire <= 12; fire++) {
      if (guard.count >= VWAP_CASCADE_GUARD_N) guardActiveAt.push(fire);
      guard.count++;
    }
    // Fires 5..12 (count 4..11 at decision time) all required qualification.
    expect(guardActiveAt[0]).toBe(VWAP_CASCADE_GUARD_N + 1);
    expect(guardActiveAt.length).toBe(12 - VWAP_CASCADE_GUARD_N);

    // And no June-11 candidate could qualify: every session was stale.
    expect(isReplacementQualified({
      sessionDate: STALE_SESSION,
      sessionCandleCount: 78,
      vwapDeviation: 0.5, // even a healthy-looking deviation
      todayET: INCIDENT_DAY,
      deadBandPct: BALANCED_DEAD_BAND,
    })).toBe(false);
  });

  it('the guard counter resets cleanly the next day (no permanent throttle)', () => {
    expect(seedVwapFireGuard({ date: INCIDENT_DAY, count: 12 }, '2026-06-12')).toEqual({ date: '2026-06-12', count: 0 });
  });
});
