// src/components/League/battleArena/decomposition.test.js
//
// Phase B Decomposition — the orb decomposes into visible layer subtotals that sum
// EXACTLY to the rendered live orb (Ruling A, acceptance #1/#4). Runs with the live
// orb flag ON (the decomposition is gated on it); the flag-OFF byte-identical case
// is asserted in buildArenaModel.test.js. Drives the REAL buildArenaModel + the REAL
// DecompositionStrip / StarCell (renderToString) — no mocks of the math.

import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { buildArenaModel } from './buildArenaModel';
import { DecompositionStrip } from './DecompositionStrip';
import { StarCell } from './StarCell';
import { DockAgentSix } from './CommandDock';

// The layer-grouped decomposition (rivalLive / ranked relax) is gated on
// LEAGUE_LIVE_ORB_ENABLED inside buildArenaModel — force it ON (Vitest hoists the
// mock above the imports; importOriginal keeps every other flag real).
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_LIVE_ORB_ENABLED: true,
}));

const YOU = 'u-you';
const NOW = Date.parse('2026-06-16T20:30:00.000Z');
const AGENT_START = { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120 };

// TODAY-activated fullday battle → youOrbLive; startingPrices == AGENT_START so flat
// live prices score the six at 0 (a round-clean agent-live term).
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

// u-you: three held picks (prior banked closed leg + today's flat live leg → held
// points 8/12/5 = 25) + one banked dropped pick (7). day2 agentPoints = 30 (the
// banked-prior floor). Flat prices → six live 0. One swap +15.
function makeGroup() {
  const held = (symbol, baseline, banked) => ({
    symbol,
    legs: [
      { direction: 'long', baselinePrice: baseline, closedAt: '2026-06-15T20:00:00.000Z', bankedScore: banked, thresholdHistory: [] },
      { direction: 'long', baselinePrice: baseline, thresholdHistory: [] },
    ],
  });
  return {
    id: 'g1', status: 'battle', watchers: 12, userPool: ['NVDA'],
    players: [
      {
        odUserId: YOU,
        picks: [held('GE', 40, 8), held('AMZN', 100, 12), held('VLO', 130, 5)],
        droppedPicks: [{ symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00.000Z', bankedScore: 7 }] }],
      },
      { odUserId: 'cpu-1', isCpu: true },
    ],
    dailyScores: {
      day1: { closeScores: { [YOU]: { compositePoints: 1 } } },
      day2: { closeScores: { [YOU]: { compositePoints: 2, agentPoints: 30 } } },
    },
  };
}

const FLAT = { ...AGENT_START, GE: 40, AMZN: 100, VLO: 130, KO: 60 };
const SWAP = [{ symbolOut: 'LLY', symbolIn: 'ZZZ', lockedPoints: 15, swapDay: 1 }];

const model = (extra = {}) => buildArenaModel({
  group: makeGroup(), battle: battle(SWAP), uid: YOU, mode: 'training',
  priceCtx: { now: NOW, isActivationDay: false, effectivePrices: FLAT, previousClosePrices: AGENT_START },
  ...extra,
});

describe('buildArenaModel — decomposition (Ruling A: layer subtotals reconcile to the orb)', () => {
  it('agentSide + userLayer === youLiveScore, EXACTLY — the on-screen layers sum to the rendered orb', () => {
    const m = model();
    const d = m.decomposition;
    expect(d).not.toBeNull();
    // the reconciliation invariant (acceptance #1/#4)
    expect(d.agentSide + d.userLayer).toBe(m.youLiveScore);
    expect(d.orb).toBe(m.youLiveScore);
  });

  it('the five terms + two layer subtotals are the confirmed values (banked 30 · six 0 · swaps 15 · three 25 · dropped 7 → 93)', () => {
    const d = model().decomposition;
    expect(d.bankedPrior).toBe(30);
    expect(d.six).toBe(0);          // flat prices → agent-live 0
    expect(d.swaps).toBe(15);
    expect(d.three).toBe(25);       // held banked 8+12+5, live legs flat → 0
    expect(d.dropped).toBe(7);
    expect(d.k).toBe(1.5);
    expect(d.agentSide).toBe(45);           // 30 + 0 + 15  (×1)
    expect(d.userLayerRaw).toBe(32);        // 25 + 7
    expect(d.userLayer).toBe(48);           // 1.5 × 32
    expect(d.orb).toBe(93);                 // 45 + 48
  });

  it('the user layer is the COMBINED half × k, not the loose terms — a flat six-term sum would miss by 0.5× the user terms', () => {
    const d = model().decomposition;
    const flatFaceValue = d.bankedPrior + d.six + d.swaps + d.three + d.dropped; // 30+0+15+25+7 = 77
    expect(flatFaceValue).not.toBe(d.orb);                       // 77 ≠ 93 — proves the ×1.5 grouping matters
    expect(d.orb - flatFaceValue).toBeCloseTo(0.5 * d.userLayerRaw, 6); // the missing 0.5× user half = 16
  });

  it('points-led cards flip on WITH the decomposition (headline "pts")', () => {
    expect(model().headline).toBe('pts');
  });
});

describe('DecompositionStrip — renders the layers reconciling to the orb', () => {
  it('renders nothing when decomposition is null (off-gate)', () => {
    expect(renderToString(React.createElement(DecompositionStrip, { decomposition: null }))).toBe('');
  });

  it('shows the orb, both layer subtotals, and the ×1.5 user weighting', () => {
    const d = model().decomposition;
    const html = renderToString(React.createElement(DecompositionStrip, { decomposition: d }));
    expect(html).toContain('93');    // the orb it reconciles to
    expect(html).toContain('45');    // agent-side subtotal
    expect(html).toContain('48');    // user-layer subtotal (×1.5 applied)
    expect(html).toContain('×1.5');  // the weighting is visible
    expect(html.toLowerCase()).toContain('swaps');   // swaps is a visible term, not just a header stat
    expect(html.toLowerCase()).toContain('dropped'); // dropped too
  });
});

describe('StarCell — points-led leads with star.points (Rulings B/C), not star.banked', () => {
  const star = (over = {}) => ({
    tk: 'GE', tier: 'support', dir: 'long', mult: 1.2, points: 137, banked: 8,
    badge: null, state: 'heating', justIn: false, settleState: null, ...over,
  });

  it("headline='pts' shows star.points (137), the orb contribution — not star.banked (8)", () => {
    const html = renderToString(React.createElement(StarCell, { star: star(), headline: 'pts' }));
    expect(html).toContain('137');       // the contribution
    expect(html).not.toContain('+8 ');   // not the closed-legs-only banked value as the hero number
  });

  it("headline='mult' (off-gate) is unchanged — leads with the multiplier, not the points", () => {
    const html = renderToString(React.createElement(StarCell, { star: star(), headline: 'mult' }));
    expect(html).toContain('1.2');      // the drama multiplier leads (× is a separate text node)
    expect(html).not.toContain('137');  // star.points is NOT the hero number here — byte-identical to today
  });
});

describe('DockAgentSix — honest points label (Ruling B honesty gate)', () => {
  const stars = [{ tk: 'NVDA', tier: 'star', dir: 'long', mult: 1, points: 10, banked: 0, badge: null, state: 'quiet', justIn: false }];

  it("points-led header says today's points (base + today's badges), NEVER 'cumulative'", () => {
    const html = renderToString(React.createElement(DockAgentSix, { stars, dormant: false, complete: false, headline: 'pts' }));
    expect(html).toContain('base + today'); // the honest composition (apostrophes escape → match the safe substring)
    expect(html.toLowerCase()).not.toContain('cumulative'); // never overstate what exists (Path b is parked)
  });

  it("off-gate header ('mult') is byte-identical to today ('it manages these')", () => {
    const html = renderToString(React.createElement(DockAgentSix, { stars, dormant: false, complete: false, headline: 'mult' }));
    expect(html).toContain('it manages these');
    expect(html).not.toContain('base + today');
  });
});
