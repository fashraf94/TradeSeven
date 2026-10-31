// @vitest-environment jsdom
//
// src/components/League/battleArena/leagueAgentForm.killSwitch.jsdom.test.jsx
//
// The League's kill switch (founder ruling F2, Oct 30, 2026). AGENT_FORM_LEAGUE_ENABLED stays in the code so one line rolls
// the League back, and that only holds while the old path works. So: with the flag false, the fuse hero and the climb draw
// the robot head at its own sizes, the live arena holds no form scope, the phone hero goes back to its stylesheet height,
// and the screen around them still works. The level-board rows (leagueLevelBoard.jsdom.test.jsx) run this flag position too.

import React, { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ heads: [], slots: 0, scopes: [] }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: false }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
vi.mock('../LeagueParts', async (importOriginal) => ({ ...(await importOriginal()), LIcon: ({ name }) => <i data-test-icon={name} /> }));
vi.mock('../../AgentPresence', async (importOriginal) => ({
  ...(await importOriginal()),
  default: function Head(props) { seen.heads.push(props); return <i data-test-head={props.accent} />; },
}));
vi.mock('./leagueAgentFormSlot', async (importOriginal) => ({
  ...(await importOriginal()),
  LeagueAgentFormSlot: function SlotProbe() { seen.slots += 1; return <i data-test-slot="" />; },
}));
vi.mock('./useArenaModel', () => ({ useArenaModel: () => ({ model: { seats: [], youRank: 3 }, handlers: {}, ready: true }) }));
vi.mock('./ArenaDesktop', async () => {
  const { LeagueAgentFormContext } = await vi.importActual('./leagueAgentFormSlot');
  return { ArenaDesktop: function ArenaProbe() { seen.scopes.push(useContext(LeagueAgentFormContext)); return <i data-test-arena="" />; } };
});

const { FuseHero } = await import('./FuseHero');
const { ClimbArena } = await import('./ClimbArena');
const { ArenaMobile } = await import('./ArenaMobile');
const { default: LeagueBattleArenaLive } = await import('./LeagueBattleArenaLive');
const { headSizeFor } = await import('./climbHeadLayout');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.heads = []; seen.slots = 0; seen.scopes = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = (el) => { seen.heads = []; act(() => { root.render(el); }); };

const SEATS = [
  { id: 'a', name: 'Ada', color: '#F2C14E', archId: 'momentum_chaser', arch: 'Trend Follower', score: 1 },
  { id: 'me', name: 'Me', color: '#5EEAD4', archId: 'degen', arch: 'Speculator', you: true, score: 2 },
  { id: 'b', name: 'Bo', color: '#B79CED', archId: 'contrarian', arch: 'Contrarian', score: 3 },
  { id: 'c', name: 'Cy', color: '#E8924A', archId: null, arch: null, score: 4 },
];
const YOU = SEATS[1];
const VALUES = { a: 40, me: 30, b: 20, c: 10 };
const trail = (values = VALUES) => ({ seeds: { a: 0, me: 0, b: 0, c: 0 }, samples: {}, head: { t: Date.parse('2026-10-30T16:00:00.000Z'), values } });
const fuse = (props = {}) => <FuseHero state="live" mode="ranked" seats={SEATS} climb={{}} youId="me" dayIdx={0} w={362} h={292} compact trail={trail()} {...props} />;
const banked = (values) => Object.fromEntries(Object.entries(values).map(([id, v]) => [id, [v]]));
const climb = (props = {}) => <ClimbArena state="live" mode="ranked" seats={SEATS} climb={banked(VALUES)} youId="me" dayIdx={0} w={362} h={300} compact {...props} />;
const headOf = (seat) => seen.heads.filter((h) => h.accent === seat.color).at(-1);

describe('flag off: the fuse hero draws the robot head', () => {
  it.each([['the phone', true, 362, 292, 30, 25], ['the desktop', false, 1316, 420, 44, 36]])('%s: every seat a head at its own size, static, its glow around it, and no form', (_, compact, w, h, you, rival) => {
    render(fuse({ compact, w, h }));
    expect(seen.heads.length).toBeGreaterThanOrEqual(4);
    expect(SEATS.map((s) => headOf(s).size)).toEqual([rival, you, rival, rival]);
    for (const s of SEATS) expect(headOf(s)).toMatchObject({ reactivityLevel: 'static', standing: 0, enableEnvironment: false });
    expect(seen.slots).toBe(0);
    expect(host.innerHTML).toContain('drop-shadow');
  });

  it('the screen still works: the values and the YOU mark print, the leader wears the crown, and its total shows', () => {
    render(fuse());
    expect(host.textContent).toContain('YOU');
    expect(host.textContent).toContain('total');
    const crowns = host.querySelectorAll('[data-fh-crown]');
    expect(crowns).toHaveLength(1);
    expect(crowns[0].parentElement.querySelector('[data-test-head]').dataset.testHead).toBe(SEATS[0].color);
  });

  it('the scope toggle answers: The week drops the leader\'s Today total', () => {
    render(fuse());
    const week = [...host.querySelectorAll('button')].find((b) => b.textContent === 'The week');
    act(() => { week.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelectorAll('[data-fh-crown]')).toHaveLength(1);
    expect(host.querySelector('[data-fh-subvalue]')).toBeNull();
  });
});

describe('flag off: the climb draws the robot head', () => {
  it.each([['the phone', true], ['the desktop', false]])('%s: every seat a head at headSizeFor\'s size, yours the reactive one, and no form', (_, compact) => {
    render(climb({ compact, w: compact ? 362 : 800, h: compact ? 300 : 336 }));
    expect(headOf(YOU).size).toBe(headSizeFor(true, false, compact));
    expect(headOf(SEATS[0]).size).toBe(headSizeFor(false, true, compact));
    expect(headOf(SEATS[2]).size).toBe(headSizeFor(false, false, compact));
    expect(headOf(YOU).reactivityLevel).toBe('reactive');
    expect(headOf(SEATS[0]).reactivityLevel).toBe('static');
    expect(seen.slots).toBe(0);
  });

  it('your head carries your standing from the ranking, and the leader wears the crown', () => {
    render(climb());
    expect(headOf(YOU).standing).not.toBe(0);
    expect(host.querySelectorAll('[data-test-icon="crown"]')).toHaveLength(1);
  });
});

describe('flag off: the live arena and the phone hero', () => {
  it('the desktop arena holds no form scope', () => {
    render(<LeagueBattleArenaLive group={{ id: 'g1', status: 'battle' }} battle={{ id: 'b1' }} mode="ranked" uid="me" viewport="desktop" />);
    expect(host.querySelector('[data-test-arena]')).not.toBeNull();
    expect(seen.scopes.at(-1)).toBeNull();
  });

  it('the phone hero is the stylesheet\'s again: no inline height, and the page renders its seats as heads', () => {
    const html = renderToString(<ArenaMobile state="live" mode="ranked" />);
    expect(/class="bv2-fuse-hero-m" style="([^"]*)"/.exec(html)[1]).toBe('position:relative;margin-top:10px');
    expect(html).toContain('data-test-head');
    expect(html).not.toContain('data-test-slot');
    expect(seen.slots).toBe(0);
  });
});
