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
//
// THE DESKTOP LAYOUT (Backing desktop layouts — Monday–Friday takes the whole
// screen): the same cards, wide, from the same model — the rows at the end
// hold the two layouts to the same facts and the same absence of any action.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TEAM_NAME_PENDING } from '../../../constants/backing';

const battles = vi.hoisted(() => ({ byOwner: {} }));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({
  default: () => ({ battles: battles.byOwner, loading: false, error: null }),
}));

const { default: YourBacking, dayTrailFor, agentSixFor, humanPicksFor, backedPodsFor } = await import('./YourBacking');
const { RESULTS, WEEK } = await import('./backingCopy');

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

// The team-labels route's answer, in full: each team's label pair AND its two
// layers named apart (`player`, `agent` — this build's review record, RAWID-R-2).
const LABELS = {
  'od-a': { label: 'Kestrel', secondary: 'Mira', player: 'Mira', agent: 'Kestrel' },
  'od-x': { label: 'Orbit', secondary: 'Rigel', player: 'Rigel', agent: 'Orbit' },
  'cpu-3': { label: 'CPU — Diversifier', secondary: null, player: 'CPU — Diversifier', agent: 'CPU — Diversifier' },
  'cpu-4': { label: 'CPU — Speculator', secondary: null, player: 'CPU — Speculator', agent: 'CPU — Speculator' },
};

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
  // D-af (Amendment C §C1): the SERVER's names (GET /api/backing/team-labels
  // through useMyBacking) — each team by its primary agent, the player as the
  // secondary. The group docs' seatNames above are ignored by the surface.
  labelsById: { 'g-play': LABELS, 'g-two': LABELS, 'g-next': LABELS },
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
    // Each team by its primary agent (D-af).
    expect(html).toContain('Kestrel · 350 BP');
    expect(html).toContain('Orbit · 200 BP');
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
    expect(html).toContain('Kestrel · 250 BP · void');
    expect(html).toContain('Orbit · 200 BP<');
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

describe('the PR 4 review record — refutation pass (R-B-2)', () => {
  it('a backed pod locked in ahead of its Monday reads "Locked in · plays Monday" — never a battle day', () => {
    const html = render({ inPlay: inPlay({
      stakes: [{ id: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W40' }],
      poolsById: { 'lds-wed': { status: 'closed' } },
      groupsById: { 'lds-wed': group({ status: 'drafting', dailyScores: {} }) },
    }) });
    expect(html).toContain('Locked in · plays Monday');
    expect(html).not.toContain('Day ');
    expect(html).toContain('>Locked · plays Monday<');
  });
});

describe('D-af — every team is named by the SERVER (Amendment C §C1)', () => {
  it('the standing rows name every seat by its label — the house seats too', () => {
    const html = render();
    for (const name of ['Kestrel', 'Orbit', 'CPU — Diversifier', 'CPU — Speculator']) expect(html).toContain(name);
  });

  it('with NO labels delivered, every name reads "Unnamed team" — never an id, and never the group doc\'s seatNames', () => {
    const html = render({ inPlay: inPlay({ labelsById: undefined }) });
    expect(html).toContain('Unnamed team · 350 BP');
    expect(html).not.toMatch(/od-[ax]|cpu-[34]/);
    expect(html).not.toContain('Rigel · 200 BP');
  });

  it('WIRING-5: while a pod\'s names are ON THEIR WAY its teams read the pending placeholder — never "Unnamed team", never an id', () => {
    const html = render({ inPlay: inPlay({ labelsById: {} }) });
    expect(html).toContain(`${TEAM_NAME_PENDING} · 350 BP`);
    expect(html).not.toContain('Unnamed team');
    expect(html).not.toMatch(/od-[ax]|cpu-[34]/);
  });
});

describe('the reveal names the two layers APART — this build\'s review record (RAWID-R-2, RAWID-2)', () => {
  const SIX = { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] };
  const withBattle = (agentName) => { battles.byOwner = { 'od-a': { ownerId: 'od-a', status: 'active', _whyConcealed: true, agentContext: { agentName, initialPortfolio: SIX } } }; };
  const labelled = (odA) => inPlay({ labelsById: { 'g-play': { ...LABELS, 'od-a': odA }, 'g-two': LABELS, 'g-next': LABELS } });

  it('a player the server cannot name reads "Unnamed team" beside the agent — the human\'s picks are NEVER filed under the agent\'s name', () => {
    withBattle('Kestrel');
    const html = render({ inPlay: labelled({ label: 'Kestrel', secondary: null, player: null, agent: 'Kestrel' }) });
    expect(html).toContain('What Unnamed team and Kestrel hold');
    expect(html).not.toContain('What Kestrel and Kestrel hold');
    // The human's three picks under the player's (neutral) name; the agent's six under the agent's.
    expect(html).toContain('Unnamed team · 3');
    expect(html).not.toMatch(/Kestrel · 3(?![0-9])/);
    expect(html).toContain('Kestrel · 6');
    battles.byOwner = {};
  });

  it('the agent is the SERVER\'s belted name — a battle record whose agent name is id-shaped never reaches the screen', () => {
    withBattle('cpu-9');
    const html = render({ inPlay: labelled({ label: 'Mira', secondary: null, player: 'Mira', agent: null }) });
    expect(html).toContain('What Mira and Mira’s agent hold');
    expect(html).not.toContain('cpu-9');
    battles.byOwner = {};
  });
});

describe('the desktop layout — the same facts, wide, and still nothing to click but the tape', () => {
  const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\u2019').replace(/\s+/g, ' ');
  it('every pod\'s card states the same backed rows, standing, trail and two-layer reveal in both layouts', () => {
    battles.byOwner = { 'od-a': { ownerId: 'od-a', agentContext: { initialPortfolio: { star: [{ symbol: 'NVDA' }], core: [{ symbol: 'AVGO' }], support: [{ symbol: 'VST' }] } } } };
    const mobile = strip(render());
    const desktop = strip(render({ layout: 'desktop' }));
    for (const fact of [
      'Kestrel · 350 BP', 'Orbit · 200 BP',                 // the backed rows (the server's labels)
      'Where the pod stands', 'Kestrel', 'Orbit', 'CPU — Diversifier', 'CPU — Speculator',
      'This week · both layers', 'What Mira and Kestrel hold', 'Mira · 3', 'Kestrel · 6', 'NVDA', 'AMD', 'VST', 'AVGO',
      'MON', 'TUE', 'WED', 'Day 3 of 5', 'Open the tape',
    ]) {
      expect(mobile, `mobile: ${fact}`).toContain(fact);
      expect(desktop, `desktop: ${fact}`).toContain(fact);
    }
    battles.byOwner = {};
  });

  it('the desktop cards are the wide layout, one per backed pod, with no stake action', () => {
    const html = render({ layout: 'desktop' });
    expect(html).toContain('data-layout="desktop"');
    expect((html.match(/data-backing="week-card"/g) || []).length).toBe(2);
    expect(html).not.toContain('data-group="g-next"');
    expect(html).not.toMatch(/Confirm|data-backing="confirm"|data-backing="cta-back"|type="number"|data-backing="custom-amount"/);
  });
});

describe('WIRE-R-2 — a pod CANCELLED after its pool closed never reads "plays Monday" (the desktop review record)', () => {
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  /** The viewer's one stake on `lds-wed` — a slot pod whose pool closed at its fire. */
  const cancelledPod = ({ pool = { status: 'closed' }, g, answered = true, stakeOver = {} } = {}) => inPlay({
    stakes: [{ id: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W40', ...stakeOver }],
    poolsById: { 'lds-wed': pool },
    groupsById: answered ? { 'lds-wed': g } : {},
    labelsById: { 'lds-wed': LABELS },
  });
  const expectCancelledCard = (html) => {
    const t = text(html);
    expect(t).toContain(WEEK.cancelled);
    expect(html).toContain(`>${WEEK.status.cancelled}<`);
    expect(html).toContain('data-cancelled="true"');
    expect(t, 'never "plays Monday"').not.toMatch(/plays Monday/);
    expect(t, 'no battle day').not.toMatch(/Day \d of 5/);
    // No standing, no trail, no book, no tape: a week it will not play.
    for (const gone of ['week-standing', 'week-reveal', 'week-tape']) expect(html).not.toContain(`data-backing="${gone}"`);
    expect(t).not.toContain(WEEK.standing);
    // The stake itself still reads — the server's name and the amount.
    expect(t).toContain('Kestrel · 250 BP');
  };

  for (const [name, g] of [
    ['VOIDED', group({ status: 'voided' })],
    ['EXPIRED', group({ status: 'expired', dailyScores: {} })],
    ['GONE (the group read answered with no document)', null],
  ]) {
    it(`${name}: the card reads "This pod was cancelled — your stake will be returned." until the refund lands — mobile and desktop`, () => {
      expectCancelledCard(render({ inPlay: cancelledPod({ g }) }));
      expectCancelledCard(render({ inPlay: cancelledPod({ g }), layout: 'desktop' }));
      // A held pool (resolving) is cancelled the same way.
      expectCancelledCard(render({ inPlay: cancelledPod({ g, pool: { status: 'resolving' } }) }));
    });
  }

  it('a pod whose group read has NOT landed is not taken for a missing one — it reads as it did (nothing guessed)', () => {
    const html = render({ inPlay: cancelledPod({ answered: false }) });
    expect(html).not.toContain(WEEK.cancelled);
    expect(html).not.toContain('data-cancelled');
  });

  it('then SHOWS THE REFUND once it lands: the refunded pool\'s own words and reason — never the cancellation, never "Settled", never "plays Monday"', () => {
    const refunded = cancelledPod({
      g: group({ status: 'voided' }),
      pool: { status: 'refunded', refundReason: 'group_voided', refundedAt: '2026-09-24T14:00:00.000Z' },
      stakeOver: { status: 'voided', voidReason: 'group_voided' },
    });
    for (const layout of ['mobile', 'desktop']) {
      const html = render({ inPlay: refunded, layout });
      const t = text(html);
      expect(t).toContain(RESULTS.reason.group_voided);
      expect(t).toContain(RESULTS.outcome.refunded);
      expect(t).toContain('Kestrel · 250 BP · void');
      expect(t).not.toContain(WEEK.cancelled);
      expect(html).not.toContain(`>${WEEK.settled}<`);
      expect(t).not.toMatch(/plays Monday/);
    }
    // A pod gone before its refund: the stake's own reason names it.
    const gone = render({ inPlay: cancelledPod({ g: null, pool: { status: 'refunded' }, stakeOver: { status: 'voided', voidReason: 'group_deleted' } }) });
    expect(text(gone)).toContain(RESULTS.reason.group_deleted);
  });

  it('beside a pod that PLAYS, the section\'s line is the playing pod\'s (the cancelled card speaks for itself); only cancelled pods — no line at all', () => {
    const mixed = inPlay({
      stakes: [
        { id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
        { id: 's9', groupId: 'g-void', teamOdUserId: 'od-x', amount: 100, status: 'live', weekKey: '2026-W39' },
      ],
      poolsById: { 'g-play': { status: 'closed' }, 'g-void': { status: 'closed' } },
      groupsById: { 'g-play': group(), 'g-void': group({ status: 'voided' }) },
      labelsById: { 'g-play': LABELS, 'g-void': LABELS },
    });
    const t = text(render({ inPlay: mixed }));
    expect(t).toContain('Day 3 of 5');
    expect(t).toContain(WEEK.cancelled);
    expect(t).not.toMatch(/plays Monday/);
    // Only a cancelled pod: the section names the week and no line — never "Locked in · plays Monday".
    const lone = render({ inPlay: cancelledPod({ g: group({ status: 'expired', dailyScores: {} }) }) });
    expect(lone).not.toContain(WEEK.lockedSub);
    expect(lone).toContain(`>${WEEK.title}<`);
  });

  it('a pool that closed INSUFFICIENT on a voided pod is not this state: its stakes were voided at the close and it reads as it always has', () => {
    const html = render({ inPlay: cancelledPod({ g: group({ status: 'voided' }), pool: { status: 'insufficient' }, stakeOver: { status: 'voided', voidReason: 'insufficient' } }) });
    expect(html).not.toContain(WEEK.cancelled);
    expect(html).toContain(`>${WEEK.settled}<`);
  });
});
