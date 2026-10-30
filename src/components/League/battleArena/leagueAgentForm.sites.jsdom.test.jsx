// @vitest-environment jsdom
//
// src/components/League/battleArena/leagueAgentForm.sites.jsdom.test.jsx
//
// Agent form build S2 — the League's sites with AGENT_FORM_LEAGUE_ENABLED on, the slot replaced by a recording stand-in
// that also reads the screen's board. What each site hands the form: the fuse hero's standing from deriveCut, the crown's
// own source (BUILD_RULES §9), never a seat's score; the climb's from its own ranking; the sizes (R16), the face's lift
// left behind, facing where the layout has a direction (R14), and the live arena's battle. Flag off, the League's own
// suites and the masked build diff hold today's bytes.

import React, { act, useContext, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ slots: [], mounts: 0, arena: [] }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: true }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
vi.mock('./leagueAgentFormSlot', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    LeagueAgentFormSlot: function Probe(props) {
      const board = useContext(real.LeagueStandingContext);
      useEffect(() => { seen.mounts += 1; }, []);
      seen.slots.push({ ...props, board });
      return <i data-test-slot={props.seat.id} style={{ width: props.size }} />;
    },
  };
});
vi.mock('./useArenaModel', () => ({ useArenaModel: () => ({ model: { seats: [] }, handlers: {}, ready: true }) }));
vi.mock('./ArenaMobile', async () => {
  const { LeagueAgentFormContext } = await vi.importActual('./leagueAgentFormSlot');
  return { ArenaMobile: function ArenaProbe() { seen.arena.push(useContext(LeagueAgentFormContext)); return null; } };
});
vi.mock('./ArenaDesktop', async () => {
  const { LeagueAgentFormContext } = await vi.importActual('./leagueAgentFormSlot');
  return { ArenaDesktop: function ArenaProbe() { seen.arena.push(useContext(LeagueAgentFormContext)); return null; } };
});

const { FuseHero } = await import('./FuseHero');
const { ClimbArena } = await import('./ClimbArena');
const { default: LeagueBattleArenaLive } = await import('./LeagueBattleArenaLive');
const { fuseFormGap, fuseFormPx, FUSE_FORM_PX } = await import('./leagueAgentFormSlot');
const { deriveCut, latestTrailSnapshot } = await import('./fuseGeometry');
const { headSizeFor } = await import('./climbHeadLayout');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.slots = []; seen.mounts = 0; seen.arena = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = (el) => act(() => { root.render(el); });
const slot = (id) => seen.slots.filter((s) => s.seat.id === id).at(-1);

const SEATS = [
  { id: 'a', name: 'Ada', color: '#F2C14E', archId: 'momentum_chaser', score: 1 },
  { id: 'me', name: 'Me', color: '#5EEAD4', archId: 'degen', you: true, score: 2 },
  { id: 'b', name: 'Bo', color: '#B79CED', archId: 'contrarian', score: 3 },
  { id: 'c', name: 'Cy', color: '#E8924A', archId: null, score: 4 },
];
// The trail's head is the fuse's statement of NOW. Each seat's `score` above says the opposite order on purpose.
const VALUES = { a: 40, me: 30, b: 20, c: 10 };
const trail = (values = VALUES) => ({ seeds: { a: 0, me: 0, b: 0, c: 0 }, samples: {}, head: { t: Date.parse('2026-10-30T16:00:00.000Z'), values } });
const fuse = (props = {}) => <FuseHero state="live" mode="ranked" seats={SEATS} climb={{}} youId="me" dayIdx={0} w={362} h={292} compact trail={trail()} {...props} />;

describe('the fuse hero (the live arena, ranked and training)', () => {
  it('draws a form for every seat, the player a size up, with no head and no glow filter of the seat\'s colour', () => {
    render(fuse());
    expect(SEATS.map((s) => slot(s.id).size)).toEqual([FUSE_FORM_PX.compact.rival, FUSE_FORM_PX.compact.you, FUSE_FORM_PX.compact.rival, FUSE_FORM_PX.compact.rival]);
    expect(slot('me').you).toBe(true);
    expect(slot('a').you).toBe(false);
    expect(host.innerHTML).not.toContain('drop-shadow');
    render(fuse({ compact: false, w: 1316, h: 420 }));
    expect(slot('me').size).toBe(FUSE_FORM_PX.desktop.you);
    expect(slot('a').size).toBe(FUSE_FORM_PX.desktop.rival);
  });

  it('every seat is over the 40 px floor, so every seat is live (R12, R16)', () => {
    for (const compact of [true, false]) for (const you of [true, false]) expect(fuseFormPx(you, compact)).toBeGreaterThanOrEqual(40);
  });

  it('the form takes the head\'s box, on the tip\'s anchor: the robot\'s face lift is gone', () => {
    render(fuse());
    expect(host.innerHTML).not.toContain('calc(-50% -');
  });

  it('the board is deriveCut\'s order, the crown\'s own: the seats\' scores say the opposite and are not read', () => {
    render(fuse());
    const { board } = slot('me');
    expect(board.ranked).toEqual(['a', 'me', 'b', 'c']);
    expect(board.ranked).toEqual(deriveCut(latestTrailSnapshot(trail(), SEATS.map((s) => s.id), {}), SEATS.map((s) => s.id), 'me').ranked);
    expect(host.querySelector('[data-fh-tip="a"] [data-fh-crown]')).not.toBeNull();
  });

  it('ranked plays to the cut; training has none', () => {
    render(fuse());
    expect(slot('me').board.cut).toBe(true);
    render(fuse({ mode: 'training' }));
    expect(slot('me').board.cut).toBe(false);
  });

  it('any lead is a standing: no points margin decides it (S1\'s ruling 3)', () => {
    render(fuse({ trail: trail({ a: 10.03, me: 10.02, b: 10.01, c: 10 }) }));
    expect(slot('me').board.shown).toBe(true);
    expect(slot('me').board.ranked).toEqual(['a', 'me', 'b', 'c']);
  });

  it('shows no standing before the bell, on a voided board, or with every seat level', () => {
    render(fuse());
    expect(slot('me').board.shown).toBe(true);
    render(fuse({ state: 'awaiting' }));
    expect(slot('me').board.shown).toBe(false);
    render(fuse({ voided: true }));
    expect(slot('me').board.shown).toBe(false);
    render(fuse({ trail: trail({ a: 5, me: 5, b: 5, c: 5 }) }));
    expect(slot('me').board.shown).toBe(false);
  });

  it('a finished game is complete on the board; a live one is not', () => {
    render(fuse());
    expect(slot('me').board.complete).toBe(false);
    render(fuse({ state: 'complete' }));
    expect(slot('me').board.complete).toBe(true);
  });
});

describe('bunched tips: the gap makes room for the forms, inside the hero', () => {
  it('a rival\'s form and 2 px, where the hero has the room', () => {
    expect(fuseFormGap(true, 292)).toBe(46);
    expect(fuseFormGap(false, 420)).toBe(58);
  });

  it('a short phone hero: the gap gives way so the last seat stays in the box', () => {
    for (const h of [180, 185, 200, 205]) {
      const gap = fuseFormGap(true, h);
      expect(gap).toBeLessThan(46);
      expect(48 + 3 * gap + FUSE_FORM_PX.compact.rival / 2).toBeLessThanOrEqual(h);
    }
  });

  it('the tips are spread by that gap', () => {
    render(fuse({ trail: trail({ a: 10.3, me: 10.2, b: 10.1, c: 10 }) }));
    const tops = SEATS.map((s) => parseFloat(host.querySelector(`[data-fh-tip="${s.id}"] .bv2-tap, [data-fh-tip="${s.id}"] > div`).style.top) + slot(s.id).size / 2).sort((x, y) => x - y);
    for (let i = 1; i < tops.length; i += 1) expect(tops[i] - tops[i - 1]).toBeCloseTo(46, 5);
  });
});

describe('the climb (the Training tab\'s preview, and the fuse-off fallback)', () => {
  const CLIMB = { a: [40], me: [30], b: [20], c: [10] };
  const climb = (props = {}) => <ClimbArena state="live" mode="ranked" seats={SEATS} climb={CLIMB} youId="me" w={362} h={300} dayIdx={0} compact {...props} />;

  it('draws a form in the head\'s footprint, from the seat, at the head\'s own sizes', () => {
    render(climb());
    expect(slot('me').size).toBe(headSizeFor(true, false, true));
    expect(slot('a').size).toBe(headSizeFor(false, true, true));
    expect(slot('c').seat.archId).toBeNull();
    expect(host.innerHTML).not.toContain('calc(-50% -');
  });

  it('its standing is the climb\'s own ranking, and its own cut', () => {
    render(climb());
    expect(slot('me').standing).toEqual({ rank: 2, seats: 4, cut: true, shown: true, complete: false });
    expect(slot('c').standing.rank).toBe(4);
    render(climb({ mode: 'training' }));
    expect(slot('me').standing.cut).toBe(false);
  });

  it('shows none at rest or on a voided board', () => {
    render(climb({ state: 'awaiting' }));
    expect(slot('me').standing.shown).toBe(false);
    render(climb({ voided: true }));
    expect(slot('me').standing.shown).toBe(false);
    render(climb({ climb: { a: [0], me: [0], b: [0], c: [0] } }));
    expect(slot('me').standing.shown).toBe(false);
  });

  it('the lanes have a direction: an opponent looks toward the player, either side of them', () => {
    render(climb());
    expect(slot('a').facing).toBe('right');
    expect(slot('b').facing).toBe('left');
    expect(slot('c').facing).toBe('left');
    expect(slot('me').facing).toBeUndefined();
  });

  it('with no player on the board (a stranger\'s view) nobody is told where to look', () => {
    render(climb({ youId: 'nobody' }));
    expect(SEATS.map((s) => slot(s.id).facing)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('a surge does not remount the form: the engine view lives through it', () => {
    render(climb());
    const mounts = seen.mounts;
    render(climb({ surge: { key: 7, pts: 3 } }));
    render(climb({ surge: { key: 8, pts: 3 } }));
    expect(seen.mounts).toBe(mounts);
  });
});

describe('the live arena hands the forms its battle', () => {
  const BATTLE = { id: 'b1', cronState: {} };
  it.each(['mobile', 'desktop'])('%s', (viewport) => {
    render(<LeagueBattleArenaLive group={{ status: 'battle' }} battle={BATTLE} mode="ranked" uid="me" viewport={viewport} />);
    expect(seen.arena.at(-1)).toEqual({ battle: BATTLE });
  });
});
