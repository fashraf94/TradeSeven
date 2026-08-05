// src/components/League/battleArena/liveCompositeReconcile.test.js
//
// THE RECONCILIATION GATE — Phase B-client, Option X.
//
// Option X keeps YOUR seat on the per-tick client path (buildArenaModel →
// youLiveScore) and sources ONLY rivals from the read-only endpoint
// (api/_utils/tournamentLiveComposite.js → computeGroupLiveComposites). That
// split is only sound if the endpoint's per-seat arithmetic is the SAME
// arithmetic your own seat already runs — otherwise your seat and the rivals'
// seats would be scored on two different rulers and the climb would be a lie.
//
// This suite proves endpoint(you) reconciles with youLiveScore(you) on EVERY
// non-freshness term the founder enumerated:
//   • banked floor        — priorBankedAgent (agent) rides in both,
//   • user half           — Σ scorePick over held ∪ dropped, identical,
//   • k = 1.5             — the single computeComposite home, both sides,
//   • rounding            — the endpoint's round2 shape vs the your-seat raw,
// with ONLY the accepted ~15-min agent-freshness gap allowed between them (the
// endpoint's agent half is scoreState.currentScore, ~15-min fresh; the your-seat
// agent half is live). Test #3 isolates that gap and proves NOTHING else leaks.
//
// If these ever disagree on a non-freshness term this suite goes RED — the fix
// is the shared arithmetic (or the drop invariant), NEVER loosening the gate.
//
// Both graphs load clean in Node (buildArenaModel's bridge + the endpoint core
// are each guarded by their own co-located dependency-surface tests); importing
// both here is the cross-tree reconciliation, computed — never mocked.

import { describe, it, expect } from 'vitest';
import { buildArenaModel } from './buildArenaModel';
import { computeGroupLiveComposites } from '../../../../api/_utils/tournamentLiveComposite.js';

const YOU = 'u-you';
const NOW = Date.parse('2026-06-16T20:30:00.000Z'); // Tue 16:30 ET — round live, wire open
const AGENT_START = { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120 };

const sum = (rows) => rows.reduce((a, s) => a + (Number.isFinite(s?.points) ? s.points : 0), 0);
const quotesFrom = (prices) => Object.fromEntries(Object.entries(prices).map(([s, c]) => [s, { current: c }]));

// A TODAY-activated fullday battle → youOrbLive fires (training + activation-day).
// startingPrices == AGENT_START, so live prices == AGENT_START score the six at 0.
function battle(trades = []) {
  const asset = (symbol) => ({ symbol, name: symbol, tierMultiplier: 1 });
  return {
    id: 'b1', status: 'active', gameMode: 'baggerbomb_tournament', opponent: null,
    activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z',
    portfolio: {
      star: [asset('NVDA'), asset('AMD')], core: [asset('TSLA'), asset('AAPL')], support: [asset('MSFT'), asset('GOOG')],
      startingPrices: { ...AGENT_START },
    },
    scoring: { thresholds: Object.fromEntries(Object.keys(AGENT_START).map((s) => [s, { threshold: 2.5 }])) },
    scoreState: { currentScore: 0 }, thresholdHistory: {}, trades,
    agentContext: { archetype: 'degen' },
  };
}

// u-you: three HELD picks (each a prior-banked closed leg + today's live leg) and
// two DROPPED picks (one fully banked, one same-day pending — its live leg closed
// bank-pending, exactly as tournamentClaims writes it). priorBankedAgent (day2
// agentPoints) is the banked agent floor. Rivals are present so the endpoint scores
// a full pod; only YOUR seat is asserted.
function makeGroup(priorAgent = 30) {
  const held = (symbol, direction, baseline, banked) => ({
    symbol,
    legs: [
      { direction, baselinePrice: baseline, closedAt: '2026-06-15T20:00:00.000Z', bankedScore: banked, thresholdHistory: [] },
      { direction, baselinePrice: baseline, thresholdHistory: [] }, // today's live leg
    ],
  });
  return {
    id: 'g1', status: 'battle', watchers: 12,
    userPool: ['NVDA', 'TSLA', 'COIN'],
    players: [
      {
        odUserId: YOU,
        picks: [held('GE', 'long', 40, 8), held('AMZN', 'long', 100, 12), held('VLO', 'short', 130, 5)],
        droppedPicks: [
          // fully banked (last leg closed with a bankedScore) → counts 7 on BOTH sides
          { symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00.000Z', bankedScore: 7 }] },
          // same-day drop: last leg closed today, NO bankedScore yet → 0 on BOTH sides
          { symbol: 'F', legs: [{ direction: 'long', baselinePrice: 12, closedAt: '2026-06-16T13:25:00.000Z', thresholdHistory: [] }] },
        ],
      },
      { odUserId: 'cpu-1', isCpu: true },
      { odUserId: 'u-riv', picks: [{ symbol: 'XOM', legs: [{ direction: 'long', baselinePrice: 90, thresholdHistory: [] }] }] },
      { odUserId: 'cpu-2', isCpu: true },
    ],
    dailyScores: {
      day1: { closeScores: { [YOU]: { compositePoints: 1.4 } } },
      day2: { closeScores: { [YOU]: { compositePoints: 2.0, agentPoints: priorAgent } } }, // banked agent floor = 30
    },
    feed: [],
  };
}

// ── EXACT fixture: every live leg FLAT (price == baseline) so the whole pod is
// round-clean. Agent six at AGENT_START → Σagent 0; held live legs 0 → Σuser is the
// banked sum; the composite is an exact integer/half. Any rounding residual would
// show as a non-exact miss. ──
const FLAT = { ...AGENT_START, GE: 40, AMZN: 100, VLO: 130, KO: 60, F: 12, XOM: 90 };
const SWAP = [{ symbolOut: 'LLY', symbolIn: 'ZZZ', lockedPoints: 15, swapDay: 1 }]; // today's realized swap = +15

function runYourSeat(group, batt, prices, atrPercentiles = null) {
  return buildArenaModel({
    group, battle: batt, uid: YOU, mode: 'training',
    priceCtx: { now: NOW, isActivationDay: false, effectivePrices: prices, previousClosePrices: AGENT_START, atrPercentiles },
  });
}

describe('live-composite reconciliation — endpoint(you) vs youLiveScore(you)', () => {
  it('EXACT (agent-fresh, round-clean): endpoint(you) === youLiveScore(you) — floor + held∪dropped + k + rounding, zero residual', () => {
    const g = makeGroup();
    const m = runYourSeat(g, battle(SWAP), FLAT);

    // Preconditions — the live orb actually fired, and each term is the number we
    // reasoned to (so a failure below points at the reconciliation, not the setup).
    expect(sum(m.agentStars)).toBe(0);            // six flat → 0
    expect(m.agentDeparted.total).toBe(15);       // today's swap
    expect(sum(m.userStars)).toBe(25);            // held banked 8+12+5, live legs flat → 0
    expect(m.userDeparted.total).toBe(7);         // KO banked; F pending → 0
    expect(m.userDeparted.pendingCount).toBe(1);  // same-day F is a pending bank, never a fake number
    expect(m.youLiveScore).toBe(93);              // compose(30+0+15, 25+7) = 45 + 1.5·32

    // The your-seat agent half, made explicit, is what a just-refreshed scoreState
    // would read (freshness gap = 0). Feed it as the endpoint's agent scalar.
    const agentFresh = 30 + sum(m.agentStars) + m.agentDeparted.total; // 45
    const endpoint = computeGroupLiveComposites(g, { [YOU]: agentFresh, 'u-riv': 0 }, quotesFrom(FLAT), null)[YOU];

    expect(endpoint).toBe(m.youLiveScore); // 93 === 93, exactly
  });

  it('the endpoint carries the SAME user half (Σ held ∪ dropped) as your seat — extracted through k', () => {
    const g = makeGroup();
    const m = runYourSeat(g, battle(SWAP), FLAT);
    const agentFresh = 30 + sum(m.agentStars) + m.agentDeparted.total; // 45
    const endpoint = computeGroupLiveComposites(g, { [YOU]: agentFresh }, quotesFrom(FLAT), null)[YOU];

    const userHalfFromEndpoint = (endpoint - agentFresh) / 1.5; // (93 − 45)/1.5
    const userHalfYourSeat = sum(m.userStars) + m.userDeparted.total; // 25 + 7
    expect(userHalfFromEndpoint).toBeCloseTo(userHalfYourSeat, 6); // 32 == 32 — held ∪ dropped, both sides
    expect(userHalfFromEndpoint).toBeCloseTo(32, 6);
  });

  it('ONLY the agent half diverges: a stale-agent gap flows through ×1 (not ×k), and nothing else leaks', () => {
    const g = makeGroup();
    const m = runYourSeat(g, battle(SWAP), FLAT);
    const agentFresh = 30 + sum(m.agentStars) + m.agentDeparted.total; // 45
    const stale = 5; // the endpoint's agent read is 5 richer than your live agent half

    const fresh = computeGroupLiveComposites(g, { [YOU]: agentFresh }, quotesFrom(FLAT), null)[YOU];
    const staleEndpoint = computeGroupLiveComposites(g, { [YOU]: agentFresh + stale }, quotesFrom(FLAT), null)[YOU];

    expect(fresh).toBe(m.youLiveScore);                          // fresh → exact
    expect(staleEndpoint - m.youLiveScore).toBeCloseTo(stale, 6); // 98 − 93 = 5 (the agent half is NOT ×1.5)
    expect(staleEndpoint - fresh).toBeCloseTo(stale, 6);          // the gap is EXACTLY the agent delta
  });

  it('LIVE legs reconcile: non-zero user live-leg scoring + agent movement agree to the endpoint 2-dp precision', () => {
    // GE +5% / AMZN +3% / VLO short −2.3%, agent NVDA/AMD moved. Same per-symbol
    // percentile ATR fed to BOTH sides (resolveBaseATR over this map) — so the live
    // legs score on one ruler; the only residual is the endpoint's round2.
    const atr = { GE: 0.9, AMZN: 0.5, VLO: 0.7 };
    const LIVE = { ...AGENT_START, NVDA: 110, AMD: 52, GE: 42, AMZN: 103, VLO: 127, KO: 60, F: 12, XOM: 92 };
    const g = makeGroup();
    const m = runYourSeat(g, battle([{ symbolOut: 'LLY', symbolIn: 'ZZZ', lockedPoints: 9, swapDay: 1 }]), LIVE, atr);

    expect(m.youLiveScore).not.toBeNull();
    const agentFresh = 30 + sum(m.agentStars) + m.agentDeparted.total; // live agent half, read back
    const endpoint = computeGroupLiveComposites(g, { [YOU]: agentFresh }, quotesFrom(LIVE), atr)[YOU];

    expect(endpoint).toBeCloseTo(m.youLiveScore, 2); // reconciles to the endpoint's rounding precision
  });
});
