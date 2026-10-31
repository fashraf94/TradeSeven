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
vi.mock('./useArenaModel', () => ({ useArenaModel: () => ({ model: { seats: [], youRank: 3 }, handlers: {}, ready: true }) }));
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
const { fuseFormFrame, fuseFormPx, FUSE_FORM_PX } = await import('./fuseFormLayout');
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

  it('shows no standing and no crown before the bell, on a voided board, or with every seat level (the founder\'s ruling on S2R-3)', () => {
    const crowns = () => host.querySelectorAll('[data-fh-crown]').length;
    render(fuse());
    expect(slot('me').board.shown).toBe(true);
    expect(crowns()).toBe(1);
    render(fuse({ state: 'awaiting' }));
    expect(slot('me').board.shown).toBe(false);
    expect(crowns()).toBe(0);
    render(fuse({ voided: true }));
    expect(slot('me').board.shown).toBe(false);
    expect(crowns()).toBe(0);
    render(fuse({ trail: trail({ a: 5, me: 5, b: 5, c: 5 }) }));
    expect(slot('me').board.shown).toBe(false);
    expect(crowns()).toBe(0);
  });

  it('a finished game is complete on the board; a live one is not', () => {
    render(fuse());
    expect(slot('me').board.complete).toBe(false);
    render(fuse({ state: 'complete' }));
    expect(slot('me').board.complete).toBe(true);
  });
});

// The rows below read the drawn numbers: a figure's centre from its box, a point from the line the fuse actually ends on.
const centreOf = (id) => parseFloat(host.querySelector(`[data-fh-tip="${id}"] .bv2-tap, [data-fh-tip="${id}"] > div`).style.top) + slot(id).size / 2;
const pointOf = (id) => {
  const path = [...host.querySelectorAll(`[data-fh-fuse="${id}"] path`)].at(-1).getAttribute('d');
  return Number(path.trim().split(/[ ,]/).at(-1));
};
const IDS = SEATS.map((s) => s.id);

describe('the anchor rule: each figure sits at its own line\'s end point', () => {
  // The path prints to a tenth of a px, so "to the pixel" is that rounding and no more.
  const ROUNDING = 0.06;

  it('a spread board: every figure\'s centre is its point, to the pixel, at the plot\'s full height', () => {
    render(fuse({ h: 356 }));
    for (const id of IDS) expect(Math.abs(centreOf(id) - pointOf(id))).toBeLessThan(ROUNDING);
    expect(new Set(IDS.map(pointOf)).size).toBe(4);
  });

  it('just right of the point, as the heads were', () => {
    render(fuse({ h: 356 }));
    expect(parseFloat(host.querySelector('[data-fh-tip="a"] .bv2-tap, [data-fh-tip="a"] > div').style.left)).toBe(12);
  });

  it('holds on the desktop\'s fixed hero, with the decomposition strip\'s shorter height too', () => {
    for (const h of [420, 374]) {
      render(fuse({ compact: false, w: 1316, h, trail: trail({ a: 40, me: 25, b: 10, c: -5 }) }));
      for (const id of IDS) expect(Math.abs(centreOf(id) - pointOf(id))).toBeLessThan(ROUNDING);
    }
  });

  it('draws no elbow when a figure is at its point, and one when a bunch moved it', () => {
    const elbows = () => host.querySelectorAll('[data-fh-tip] > span[style*="border-left"]').length;
    render(fuse({ h: 356 }));
    expect(elbows()).toBe(0);
    render(fuse({ h: 356, trail: trail({ a: 10.3, me: 10.2, b: 10.1, c: 10 }) }));
    expect(elbows()).toBe(4);
  });
});

describe('the bunched rule on the arena', () => {
  const BUNCHED = { a: 10.3, me: 10.2, b: 10.1, c: 10 };

  it('figures part around their points, in the lines\' own order', () => {
    render(fuse({ h: 356, trail: trail(BUNCHED) }));
    const byPoint = [...IDS].sort((x, y) => pointOf(x) - pointOf(y));
    expect(byPoint).toEqual(['a', 'me', 'b', 'c']);
    const centres = byPoint.map(centreOf);
    expect(centres).toEqual([...centres].sort((x, y) => x - y));
    const offsets = byPoint.map((id) => centreOf(id) - pointOf(id));
    expect(offsets.reduce((sum, v) => sum + v, 0)).toBeCloseTo(0, 0);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[3]).toBeGreaterThan(0);
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThan(75);
  });

  it('the order follows the lines, not the seats and not the standing', () => {
    render(fuse({ h: 356, trail: { ...trail({ a: 10, me: 10.1, b: 10.2, c: 10.3 }), seeds: { a: 0, me: 0, b: 0, c: 0 } } }));
    expect([...IDS].sort((x, y) => centreOf(x) - centreOf(y))).toEqual(['c', 'b', 'me', 'a']);
  });

  it('the figures clear each other: their boxes never overlap', () => {
    render(fuse({ h: 356, trail: trail(BUNCHED) }));
    const boxes = [...IDS].sort((x, y) => centreOf(x) - centreOf(y)).map((id) => ({ top: centreOf(id) - slot(id).size / 2, bottom: centreOf(id) + slot(id).size / 2 }));
    for (let i = 1; i < 4; i += 1) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
  });

  it('a bunch stays inside the plot at the hero\'s floor', () => {
    const h = 273;
    const frame = fuseFormFrame({ w: 362, h, compact: true });
    render(fuse({ h, trail: trail(BUNCHED) }));
    expect(Math.min(...IDS.map(centreOf))).toBeGreaterThanOrEqual(frame.plotT - 0.5);
    expect(Math.max(...IDS.map(centreOf))).toBeLessThanOrEqual(frame.floorY + 0.5);
  });
});

describe('the toggle clearance', () => {
  // The head row ends at 46 px on the phone, measured with the app's stylesheet (fuseFormLayout.js). The form's top, the
  // crown above it and the leader's 37 px value column around its centre must all stay below that.
  it('the highest value, its figure and its crown stay below the toggle, whoever leads', () => {
    for (const values of [VALUES, { a: 10, me: 40, b: 20, c: 30 }]) {
      render(fuse({ h: 356, trail: trail(values) }));
      const leader = values.a > values.me ? 'a' : 'me';
      const top = centreOf(leader);
      expect(top - slot(leader).size / 2 - 9).toBeGreaterThanOrEqual(46);
      expect(top - 37 / 2).toBeGreaterThanOrEqual(46);
      expect(host.querySelector(`[data-fh-tip="${leader}"] [data-fh-crown]`)).not.toBeNull();
    }
  });

  it('the highest point is the plot\'s top, and the plot\'s top is below the row, on the phone and the desktop', () => {
    render(fuse({ h: 356 }));
    expect(pointOf('a')).toBe(fuseFormFrame({ w: 362, h: 356, compact: true }).plotT);
    render(fuse({ compact: false, w: 1316, h: 420 }));
    expect(pointOf('a')).toBe(fuseFormFrame({ w: 1316, h: 420 }).plotT);
    expect(pointOf('a') - FUSE_FORM_PX.desktop.you / 2 - 12).toBeGreaterThanOrEqual(52);
  });
});

describe('the final verdict on the fuse (founder ruling 1 of Oct 30, 2026)', () => {
  it('the board says complete only when the screen\'s own state does: a day\'s close leaves a group still playing live', () => {
    render(fuse({ state: 'live' }));
    expect(slot('me').board.complete).toBe(false);
    render(fuse({ state: 'complete' }));
    expect(slot('me').board.complete).toBe(true);
    expect(slot('me').board.shown).toBe(true);
  });

  it('a finished board that was voided or never played shows no standing and no crown, so it carries no verdict', () => {
    render(fuse({ state: 'complete', voided: true }));
    expect(slot('me').board).toMatchObject({ complete: true, shown: false });
    expect(host.querySelector('[data-fh-crown]')).toBeNull();
    render(fuse({ state: 'complete', trail: trail({ a: 0, me: 0, b: 0, c: 0 }) }));
    expect(slot('me').board).toMatchObject({ complete: true, shown: false });
    expect(host.querySelector('[data-fh-crown]')).toBeNull();
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

  it('shows none at rest, on a voided board, or level at any altitude', () => {
    render(climb({ state: 'awaiting' }));
    expect(slot('me').standing.shown).toBe(false);
    render(climb({ voided: true }));
    expect(slot('me').standing.shown).toBe(false);
    render(climb({ climb: { a: [0], me: [0], b: [0], c: [0] } }));
    expect(slot('me').standing.shown).toBe(false);
    render(climb({ climb: { a: [5], me: [5], b: [5], c: [5] } }));
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

describe('the live arena hands the forms its battle, its group and the rank it prints', () => {
  const BATTLE = { id: 'b1', cronState: {} };
  it.each(['mobile', 'desktop'])('%s', (viewport) => {
    render(<LeagueBattleArenaLive group={{ id: 'g1', status: 'battle' }} battle={BATTLE} mode="ranked" uid="me" viewport={viewport} />);
    expect(seen.arena.at(-1)).toEqual({ battle: BATTLE, groupId: 'g1', youRank: 3, youArchetype: null });
  });
});
