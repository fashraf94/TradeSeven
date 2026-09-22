// src/components/League/backing/YourBacking.test.jsx
//
// Backing Beta PR 4 — SURFACE D, Your Backing (spec V1.3 §5, D-r; design
// brief §2.D, rev2 §3). One card per backed pod; the team(s) backed; where the
// pod stands from the banked composites; day N of 5 on the rail; the Monday
// draft reveal (both layers, public WHAT); one tap into the tape; and NO stake
// action anywhere on the surface.
//
// The spectator battle hook is mocked (it polls an endpoint); everything else
// is the real component over real-shaped docs. react-dom/server.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const battles = vi.hoisted(() => ({ byOwner: {} }));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({
  default: () => ({ battles: battles.byOwner, loading: false, error: null }),
}));

const { default: YourBacking, dayTrailFor, agentSixFor, humanPicksFor, backedPodsFor } = await import('./YourBacking');

const WED = new Date('2026-09-23T14:00:00.000Z');
const leg = (direction) => ({ direction, openedAt: '2026-09-21T11:00:00.000Z' });

const group = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39',
  seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
  players: [
    { odUserId: 'od-a', picks: [{ symbol: 'NVDA', legs: [leg('long')] }, { symbol: 'AMD', legs: [leg('long'), leg('short')] }, { symbol: 'VST', legs: [leg('long')] }] },
    { odUserId: 'od-x', picks: [{ symbol: 'TSLA', legs: [leg('long')] }] },
    { odUserId: 'cpu-3', isCpu: true, picks: [] },
    { odUserId: 'cpu-4', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    day2: { closeScores: { 'od-a': { compositePoints: 3.4 }, 'od-x': { compositePoints: 2.6 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    // day 3 banked TODAY (Wednesday): the pods' own reading of the day (deriveCurrentTradingDay).
    day3: { recordedDate: '2026-09-23', closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
  },
  ...over,
});

const inPlay = (over = {}) => ({
  stakes: [
    { id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
    { id: 's2', groupId: 'g-play', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' },
    { id: 's3', groupId: 'g-two', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
    // the window's stake — its pool is still OPEN, so it is not this week's card
    { id: 's4', groupId: 'g-next', teamOdUserId: 'od-a', amount: 50, status: 'live', weekKey: '2026-W40' },
  ],
  poolsById: { 'g-play': { status: 'closed' }, 'g-two': { status: 'closed' }, 'g-next': { status: 'open' } },
  groupsById: { 'g-play': group(), 'g-two': group({ seatNames: { 'od-x': 'Rigel' } }) },
  ...over,
});

const render = (props = {}) => renderToString(<YourBacking inPlay={inPlay()} onOpenTape={() => {}} now={WED} {...props} />);

describe('one card per backed pod, Monday–Friday', () => {
  it('renders a card per pod whose pool has closed, and none for the window’s open pool', () => {
    const html = render();
    expect((html.match(/data-backing="week-card"/g) || []).length).toBe(2);
    expect(html).not.toContain('data-group="g-next"');
    expect(html).toContain('Your backing');
    expect(html).toContain('Day 3 of 5');
  });

  it('names the team(s) backed with the amount, summed per team', () => {
    const html = render();
    expect(html).toContain('Mira · 350 BP');
    expect(html).toContain('Rigel · 200 BP');
  });

  it('shows where the pod stands from the banked composites and the team’s rank at each banked close', () => {
    const html = render();
    expect(html).toContain('data-backing="week-standing"');
    expect(html).toContain('data-backing="day-trail"');
    // Mira: day1 2nd (3.0 > 2.1), day2 1st, day3 2nd — on the rail as ordinals.
    expect(html).toContain('>2nd<');
    expect(html).toContain('>1st<');
    expect(html).toContain('In play');
  });

  it('the Monday draft reveal: the backed team’s starting picks, both layers, once they exist', () => {
    battles.byOwner = {
      'od-a': {
        ownerId: 'od-a', status: 'active', _whyConcealed: true,
        agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', initialPortfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] } },
      },
    };
    const html = render();
    expect(html).toContain('This week · both layers');
    expect(html).toContain('What Mira and Kestrel hold');
    expect(html).not.toContain('drafted Monday');
    expect(html).toContain('Mira · 3');
    expect(html).toContain('Kestrel · 6');
    for (const s of ['NVDA', 'AMD', 'VST', 'AVGO', 'ANET', 'META']) expect(html).toContain(s);
    battles.byOwner = {};
  });

  it('before the drafts land it says so — nothing filled', () => {
    const html = render({ inPlay: inPlay({ groupsById: { 'g-play': group({ players: [{ odUserId: 'od-a', picks: [] }, { odUserId: 'od-x', picks: [] }] }), 'g-two': group() } }) });
    expect(html).toContain('The books show once the pod has drafted.');
  });

  it('one tap into the tape, and NO stake action anywhere on the surface', () => {
    const html = render();
    expect(html).toContain('Open the tape');
    expect(html).toContain('data-backing="week-tape"');
    expect(html).not.toContain('Confirm');
    expect(html).not.toMatch(/Back (Mira|Rigel)/);
    expect(html).not.toContain('<input');
    expect(html).not.toContain('data-backing="stake-control"');
  });

  it('a settled week reads complete', () => {
    const html = render({ inPlay: inPlay({ poolsById: { 'g-play': { status: 'resolved' }, 'g-two': { status: 'resolved' } }, groupsById: { 'g-play': group({ status: 'complete' }), 'g-two': group({ status: 'complete' }) } }) });
    expect(html).toContain('Week complete');
    expect(html).toContain('>Settled<');
  });

  it('with nothing in play it renders nothing', () => {
    expect(renderToString(<YourBacking inPlay={{ stakes: [], poolsById: {}, groupsById: {} }} now={WED} />)).toBe('');
  });
});

describe('the pure pieces', () => {
  it('dayTrailFor ranks the team at each banked close, through the last banked day', () => {
    expect(dayTrailFor(group(), 'od-a')).toEqual({ trail: [2, 1, 2], through: 3 });
    expect(dayTrailFor({ players: [] }, 'od-a')).toEqual({ trail: [], through: 0 });
  });

  it('agentSixFor reads the frozen Monday portfolio (public WHAT), else the current book, else nothing', () => {
    expect(agentSixFor({ agentContext: { initialPortfolio: { star: [{ symbol: 'A' }], core: [], support: [{ symbol: 'B' }] } } })).toEqual(['A', 'B']);
    expect(agentSixFor({ portfolio: { star: [{ symbol: 'C' }] } })).toEqual(['C']);
    expect(agentSixFor(null)).toEqual([]);
  });

  it('humanPicksFor reads the roster with the CURRENT direction (the last leg)', () => {
    expect(humanPicksFor(group(), 'od-a')).toEqual([{ symbol: 'NVDA', direction: 'long' }, { symbol: 'AMD', direction: 'short' }, { symbol: 'VST', direction: 'long' }]);
    expect(humanPicksFor(group(), 'od-zz')).toEqual([]);
  });

  it('backedPodsFor groups the stakes by pod and drops open pools and pools not yet read', () => {
    expect(backedPodsFor(inPlay()).map((p) => [p.groupId, p.stakes.length])).toEqual([['g-play', 2], ['g-two', 1]]);
  });
});

describe('the PR 4 review record — FAB-1, DOM-6, FAB-2 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md)', () => {
  it('FAB-1: a complete pod whose pool has not resolved reads Settling — never Settled', () => {
    const html = render({ inPlay: inPlay({ poolsById: { 'g-play': { status: 'resolving' }, 'g-two': { status: 'closed' } }, groupsById: { 'g-play': group({ status: 'complete' }), 'g-two': group({ status: 'complete' }) } }) });
    expect(html).toContain('>Settling<');
    expect(html).not.toContain('>Settled<');
    expect(html).toContain('Week complete · settling');
    expect(html).not.toContain('>Week complete<');
  });

  it('DOM-6: a voided stake says so beside its amount; a live one says nothing', () => {
    const html = render({ inPlay: inPlay({ stakes: [
      { id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'voided', weekKey: '2026-W39' },
      { id: 's3', groupId: 'g-two', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
    ] }) });
    expect(html).toContain('Mira · 250 BP · void');
    expect(html).toContain('Rigel · 200 BP<');
  });

  it('FAB-2: a layer that has not drafted says so for THAT layer — the other layer still shows', () => {
    battles.byOwner = {};
    const html = render();
    expect(html).toContain('Mira · 3');
    expect(html).toContain('no book on file yet');
    expect(html).not.toContain('built Monday');
    expect(html).not.toContain('drafted Monday');
  });
});
