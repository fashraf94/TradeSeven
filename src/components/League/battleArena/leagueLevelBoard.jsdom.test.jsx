// @vitest-environment jsdom
//
// src/components/League/battleArena/leagueLevelBoard.jsdom.test.jsx
//
// Agent form S2, review S2R-3 and the founder's ruling of Oct 30, 2026: a fully level board has no leader. With every
// seat's total equal nobody is crowned and every figure is calm, on both League surfaces that crown, the fuse hero and
// the climb, flag on and flag off: today's hero crowns the first seat of every pod's all-zero board before the bell. A
// partial tie keeps its crown. The crown and the mood read one gate (BUILD_RULES §9), so the last block hands both one
// board and compares them, on boards where a second source would answer differently.
//
// What is real: FuseHero, ClimbArena, the gate and deriveLeagueMood. The icon, the old head and the slot are recording
// stand-ins, so a row reads the crown by its seat and each figure by what the screen handed it.

import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: false }));
const seen = vi.hoisted(() => ({ slots: [], heads: [] }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get AGENT_FORM_LEAGUE_ENABLED() { return flag.on; } };
});
vi.mock('../../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
vi.mock('../LeagueParts', async (importOriginal) => ({ ...(await importOriginal()), LIcon: ({ name }) => <i data-test-icon={name} /> }));
vi.mock('../../AgentPresence', async (importOriginal) => ({
  ...(await importOriginal()),
  default: function Head(props) {
    seen.heads.push(props);
    return <i data-test-seat={props.accent} />;
  },
}));
vi.mock('./leagueAgentFormSlot', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    LeagueAgentFormSlot: function Probe(props) {
      const board = useContext(real.LeagueStandingContext);
      seen.slots.push({ ...props, board });
      return <i data-test-seat={props.seat.color} />;
    },
  };
});

const { FuseHero } = await import('./FuseHero');
const { ClimbArena } = await import('./ClimbArena');
const { deriveLeagueMood, standingOf } = await import('../../../screens/battleView/leagueAgentMood');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.slots = []; seen.heads = []; });
afterEach(() => { flag.on = false; act(() => root.unmount()); host.remove(); });
const render = (el) => { seen.slots = []; seen.heads = []; act(() => { root.render(el); }); };

// Each seat's `score` says the opposite of every board below, on purpose: neither gate may read it.
const SEATS = [
  { id: 'a', name: 'Ada', color: '#F2C14E', archId: 'momentum_chaser', score: 1 },
  { id: 'me', name: 'Me', color: '#5EEAD4', archId: 'degen', you: true, score: 2 },
  { id: 'b', name: 'Bo', color: '#B79CED', archId: 'contrarian', score: 3 },
  { id: 'c', name: 'Cy', color: '#E8924A', archId: null, score: 4 },
];
const YOU_FIRST = [SEATS[1], SEATS[0], SEATS[2], SEATS[3]];
const seatOfColor = Object.fromEntries(SEATS.map((s) => [s.color, s.id]));
const board = (a, me, b, c) => ({ a, me, b, c });
const ZEROS = board(0, 0, 0, 0);

const trail = (values, seeds = ZEROS) => ({ seeds, samples: {}, head: { t: Date.parse('2026-10-30T16:00:00.000Z'), values } });
const fuse = (props = {}) => <FuseHero state="live" mode="ranked" seats={SEATS} climb={{}} youId="me" dayIdx={0} w={362} h={356} compact {...props} />;
const banked = (values) => Object.fromEntries(Object.entries(values).map(([id, v]) => [id, [v]]));
const climb = (props = {}) => <ClimbArena state="live" mode="ranked" seats={SEATS} climb={banked(ZEROS)} youId="me" dayIdx={0} w={362} h={300} compact {...props} />;

/** The seat each drawn crown sits on: the crown and the seat's figure share one box on both surfaces. */
const crowned = () => [...host.querySelectorAll('[data-test-icon="crown"]')].map((crown) => seatOfColor[crown.parentElement.parentElement.querySelector('[data-test-seat]')?.dataset.testSeat]);
/** Each figure's reading: the form's real mood from what the screen handed it, or the old head's standing (0 is calm). */
const moods = () => seen.slots.map(({ seat, you, standing, board: fuseBoard }) => deriveLeagueMood({ you, standing: standing ?? standingOf(fuseBoard, seat.id) }));
const readings = () => (flag.on ? moods() : seen.heads.map((head) => head.standing));
const allCalm = () => { const r = readings(); expect(r.length).toBeGreaterThanOrEqual(4); for (const v of r) expect(['idle', 0]).toContain(v); };

const SURFACES = [
  ['the fuse', (values, seats = SEATS) => fuse({ seats, trail: trail(values) })],
  ['the climb', (values, seats = SEATS) => climb({ seats, climb: banked(values) })],
];

describe.each([['on', true], ['off', false]])('AGENT_FORM_LEAGUE_ENABLED %s', (_, on) => {
  beforeEach(() => { flag.on = on; });

  describe.each(SURFACES)('%s', (name, draw) => {
    it('all zero, as every pod shows before its first bell: nobody is crowned, every figure is calm', () => {
      render(draw(ZEROS));
      expect(crowned()).toEqual([]);
      allCalm();
    });

    it('all equal mid-day: nobody is crowned, every figure is calm', () => {
      render(draw(board(5, 5, 5, 5)));
      expect(crowned()).toEqual([]);
      allCalm();
    });

    it('with the player in the first seat, who would have worn the tie\'s crown', () => {
      render(draw(board(5, 5, 5, 5), YOU_FIRST));
      expect(crowned()).toEqual([]);
      allCalm();
    });

    it.each([
      ['two lead', board(5, 5, 4, 3), 'a'],
      ['two lead, the player the second seat of the tie\'s order', board(4, 5, 5, 3), 'me'],
      ['two in the middle', board(5, 4, 4, 3), 'a'],
      ['two pairs', board(5, 5, 3, 3), 'a'],
      ['three lead', board(5, 5, 5, 3), 'a'],
      ['three trail', board(3, 5, 3, 3), 'me'],
    ])('a partial tie keeps today\'s crown: %s', (_tie, values, leader) => {
      render(draw(values));
      expect(crowned()).toEqual([leader]);
    });

    it('a spread board: the crown on its leader, and the figures read the standing', () => {
      render(draw(board(40, 30, 20, 10)));
      expect(crowned()).toEqual(['a']);
      // Flag off, the fuse's old heads hold a literal standing of 0 on every board: only the climb's reads one.
      expect(readings().some((v) => v !== 'idle' && v !== 0)).toBe(on || name === 'the climb');
    });
  });

  describe('the fuse\'s other ways to a zero board', () => {
    it.each([
      ['a cold mount, no trail at all', null],
      ['a trail with no head yet', { seeds: ZEROS, samples: {} }],
    ])('%s', (_case, value) => {
      render(fuse({ trail: value }));
      expect(crowned()).toEqual([]);
      allCalm();
    });
  });

  it('the fuse: a level board prints no "total" line either, the crown\'s own annotation', () => {
    render(fuse({ trail: trail(board(5, 5, 5, 5)) }));
    expect(host.querySelector('[data-fh-subvalue]')).toBeNull();
    render(fuse({ trail: trail(board(5, 5, 4, 3)) }));
    expect(host.querySelectorAll('[data-fh-subvalue]')).toHaveLength(1);
    expect(host.querySelector('[data-fh-tip="a"] [data-fh-subvalue]')).not.toBeNull();
  });

  it('the climb: a level board at altitude still plots at altitude, and drops the leader\'s halo and size with the crown', () => {
    render(climb({ climb: banked(board(5, 5, 5, 5)) }));
    expect(host.innerHTML).toContain('bv2cl'); // trails: "at rest" stays all-zero, where the seats sit is not what changed
    expect(host.querySelectorAll('.bv2-halo')).toHaveLength(1); // the player's own, which is identity
    const lead = flag.on ? seen.slots.find((s) => s.seat.id === 'a').size : seen.heads[0].size;
    render(climb({ climb: banked(board(5, 5, 5, 4)) }));
    expect(host.querySelectorAll('.bv2-halo')).toHaveLength(2);
    expect(flag.on ? seen.slots.find((s) => s.seat.id === 'a').size : seen.heads[0].size).toBeGreaterThan(lead);
  });
});

describe('the crown and the mood read one gate: one board, handed to both', () => {
  beforeEach(() => { flag.on = true; });

  /** What the crown says and what the mood's gate says about the board just drawn. */
  const verdicts = () => {
    const [first] = seen.slots;
    return { crowns: crowned().length, shown: (first.standing ?? standingOf(first.board, first.seat.id)).shown };
  };

  describe.each([
    ['live', {}],
    ['finished', { state: 'complete' }],
  ])('on the fuse, %s', (_state, extra) => {
    it.each([
      ['level at zero', ZEROS, ZEROS, false],
      ['level mid-day', board(5, 5, 5, 5), ZEROS, false],
      ['a partial tie', board(5, 5, 4, 3), ZEROS, true],
      ['spread', board(40, 30, 20, 10), ZEROS, true],
      // Level totals, spread days: it prints +4 / +3 / +2 / +1 today and nobody leads.
      ['level totals whose days differ', board(5, 5, 5, 5), board(1, 2, 3, 4), false],
      // Spread totals, level days: it prints +5 four times and Cy leads.
      ['moved alike, totals apart', board(6, 7, 8, 9), board(1, 2, 3, 4), true],
    ])('%s', (_board, values, seeds, leads) => {
      render(fuse({ ...extra, trail: trail(values, seeds) }));
      expect(verdicts()).toEqual({ crowns: leads ? 1 : 0, shown: leads });
    });
  });

  it('on the fuse, a voided board and a board before the bell', () => {
    render(fuse({ trail: trail(board(40, 30, 20, 10)), voided: true }));
    expect(verdicts()).toEqual({ crowns: 0, shown: false });
    render(fuse({ trail: trail(board(40, 30, 20, 10)), state: 'awaiting' }));
    expect(verdicts()).toEqual({ crowns: 0, shown: false });
  });

  it.each([
    ['level at zero', banked(ZEROS), {}, false],
    ['level at altitude', banked(board(5, 5, 5, 5)), {}, false],
    ['a partial tie', banked(board(5, 5, 4, 3)), {}, true],
    ['spread', banked(board(40, 30, 20, 10)), {}, true],
    // The climb ranks by each seat's live altitude, so the gate must too.
    ['banked level, one rival live above', banked(board(5, 5, 5, 5)), { liveComposites: { a: 6 } }, true],
    ['banked level, the player live above', banked(board(5, 5, 5, 5)), { youLiveScore: 6 }, true],
    ['banked apart, every seat live level', banked(board(9, 7, 3, 1)), { liveComposites: { a: 5, b: 5, c: 5 }, youLiveScore: 5 }, false],
  ])('on the climb, %s', (_board, climbSeries, extra, leads) => {
    render(climb({ climb: climbSeries, ...extra }));
    expect(verdicts()).toEqual({ crowns: leads ? 1 : 0, shown: leads });
  });

  it('on the climb, a voided board and a board before the bell', () => {
    render(climb({ climb: banked(board(40, 30, 20, 10)), voided: true }));
    expect(verdicts()).toEqual({ crowns: 0, shown: false });
    render(climb({ climb: banked(board(40, 30, 20, 10)), state: 'awaiting' }));
    expect(verdicts()).toEqual({ crowns: 0, shown: false });
  });

  it('a level finish carries no verdict, even for a player the screen would rank first', () => {
    render(fuse({ state: 'complete', trail: trail(board(5, 5, 5, 5)) }));
    const you = seen.slots.find((s) => s.you);
    expect(deriveLeagueMood({ you: true, standing: standingOf(you.board, 'me'), finalRank: 1 })).toBe('idle');
  });

  it('the opponents are calm with the player: the forms read the board, never a seat\'s own score', () => {
    render(fuse({ trail: trail(board(5, 5, 5, 5)) }));
    expect(moods()).toEqual(['idle', 'idle', 'idle', 'idle']);
    render(climb({ climb: banked(board(5, 5, 5, 5)) }));
    expect(moods()).toEqual(['idle', 'idle', 'idle', 'idle']);
  });
});
