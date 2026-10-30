// @vitest-environment jsdom
//
// src/components/League/battleArena/LeagueAgentForm.jsdom.test.jsx
//
// Agent form build S2 — the one renderer the League's sites share, with the wrapper replaced by a recording stand-in and
// the seats built by the real bridge (buildArenaModel). What each seat is handed: the player teal (R11), a League CPU its
// archetype in copper (R13), a human rival theirs in copper (R14), an unknown seat a bare copper core. The slot's still
// and its boundary, as S1's battle slot. The founder's rulings of Oct 30, 2026 on who keeps their armor: yours on the
// lobby preview (2), and human rivals after the bell, read once (4). The moods' rows are
// screens/battleView/leagueAgentMood.test.js.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ forms: [], fetchWithAuth: null }));
vi.mock('../../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    render() { seen.forms.push(this.props); return <i data-test-form={this.props.allegiance} />; }
  },
}));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: true }));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: (...args) => seen.fetchWithAuth(...args) }));

const { LeagueAgentFormScope, LeagueAgentFormSlot, LeagueStandingContext } = await import('./leagueAgentFormSlot');
const { buildArenaModel } = await import('./buildArenaModel');
const { agentFormSpec } = await import('../../AgentForm/agentFormSpec');
const { cpuArchetypeForN } = await import('../../../constants/leagueTournament');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.forms = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

async function until(selector) {
  for (let i = 0; i < 300 && !host.querySelector(selector); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}
async function show(el) {
  await act(async () => { root.render(el); });
  await until('[data-test-form]');
}
const last = () => seen.forms.at(-1);
/** What the engine would draw from the props a seat was handed. */
const drawn = (props) => agentFormSpec({ archetype: props.archetype, allegiance: props.allegiance, facing: props.facing });

const UID = 'me';
const seats = (over = {}) => buildArenaModel({
  group: { status: 'battle', players: [{ odUserId: UID, picks: [] }, { odUserId: 'cpu-3', isCpu: true, picks: [] }, { odUserId: 'rival', picks: [] }, { odUserId: 'stranger', picks: [] }] },
  battle: { agentContext: { archetype: 'degen', agentName: 'Aurora' } },
  uid: UID, mode: 'ranked', displayNames: { rival: 'Rae', stranger: 'Sam' },
  spectatedBattles: { rival: { agentContext: { archetype: 'guardian' } } },
  ...over,
}).seats;
const seat = (id, over) => seats(over).find((s) => s.id === id);

describe('the slot: the form\'s still while the chunk loads, then the form', () => {
  it('shows the SVG still first, sized and decorative, in the seat\'s allegiance; then the form', async () => {
    act(() => { root.render(<LeagueAgentFormSlot seat={seat('cpu-3')} size={44} />); });
    const still = host.querySelector('[data-agent-form-placeholder]');
    expect(still).not.toBeNull();
    expect(still.getAttribute('width')).toBe('44');
    expect(still.getAttribute('aria-hidden')).toBe('true');
    expect(still.parentElement.getAttribute('aria-hidden')).toBe('true');
    expect(host.innerHTML).toContain('--ft-copper');
    await until('[data-test-form]');
    expect(host.querySelector('[data-agent-form-placeholder]')).toBeNull();
  });
});

describe('who wears what (R11, R13, R14)', () => {
  it('the player: their battle\'s archetype, in teal, looking right', async () => {
    await show(<LeagueAgentFormSlot seat={seat(UID)} you size={50} />);
    expect(last()).toMatchObject({ archetype: 'degen', allegiance: 'player', coreStage: 1, armorStage: 1, batched: true, bloom: 'css', framing: 'tight', label: null, size: 50 });
    expect(drawn(last())).toMatchObject({ kind: 'spec', pal: 'teal', face: 1 });
  });

  it('a League CPU: the archetype it plays with, in copper, not a bare core', async () => {
    await show(<LeagueAgentFormSlot seat={seat('cpu-3')} size={44} />);
    expect(last().archetype).toBe(cpuArchetypeForN(3));
    expect(last().allegiance).toBe('opponent');
    expect(drawn(last()).kind).not.toBe('none');
    expect(drawn(last()).pal).toBe('copper');
  });

  it('a human rival: their own archetype, in copper', async () => {
    await show(<LeagueAgentFormSlot seat={seat('rival')} size={44} />);
    expect(drawn(last())).toMatchObject({ kind: 'preserve', pal: 'copper', face: -1 });
  });

  it('an unknown or missing archetype is a bare copper core', async () => {
    await show(<LeagueAgentFormSlot seat={seat('stranger')} size={44} />);
    expect(last().archetype).toBeUndefined();
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'copper' });
    await show(<LeagueAgentFormSlot seat={seat('rival', { spectatedBattles: { rival: { agentContext: { archetype: 'unknown' } } } })} size={44} />);
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'copper' });
  });

  it('the form reads the code id: a seat with only the display label draws no armor from it', async () => {
    await show(<LeagueAgentFormSlot seat={{ id: 'x', arch: 'Trend Follower' }} size={44} />);
    expect(last().archetype).toBeUndefined();
  });

  it('a layout\'s facing reaches the form; the seat keeps its colour', async () => {
    await show(<LeagueAgentFormSlot seat={seat('rival')} size={44} facing="right" />);
    expect(drawn(last())).toMatchObject({ face: 1, pal: 'copper' });
  });
});

describe('your armor on the lobby preview (founder ruling 2 of Oct 30, 2026)', () => {
  // The preview reads no battle, so the seat has no archId; the lobby's scope hands the archetype it already holds.
  const preview = seat(UID, { battle: null });

  it('the scope\'s archetype dresses your seat, in teal', async () => {
    expect(preview.archId).toBeNull();
    await show(<LeagueAgentFormScope youArchetype="guardian"><LeagueAgentFormSlot seat={preview} you size={54} /></LeagueAgentFormScope>);
    expect(last().archetype).toBe('guardian');
    expect(drawn(last())).toMatchObject({ kind: 'preserve', pal: 'teal' });
  });

  it('unknown still draws the bare teal core', async () => {
    await show(<LeagueAgentFormScope youArchetype={undefined}><LeagueAgentFormSlot seat={preview} you size={54} /></LeagueAgentFormScope>);
    expect(last().archetype).toBeUndefined();
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'teal' });
    await show(<LeagueAgentFormSlot seat={preview} you size={54} />);
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'teal' });
  });

  it('it is yours alone: a rival on the same preview never wears it', async () => {
    await show(<LeagueAgentFormScope youArchetype="guardian"><LeagueAgentFormSlot seat={{ id: 'rae', kind: 'human', archId: null }} size={44} /></LeagueAgentFormScope>);
    expect(last().archetype).toBeUndefined();
  });

  it('a battle\'s own snapshot wins over the scope, where a seat has one', async () => {
    await show(<LeagueAgentFormScope youArchetype="guardian"><LeagueAgentFormSlot seat={seat(UID)} you size={50} /></LeagueAgentFormScope>);
    expect(last().archetype).toBe('degen');
  });
});

describe('human rivals keep their armor after the bell (founder ruling 4 of Oct 30, 2026)', () => {
  const FINISHED = { rank: 3, seats: 4, cut: true, shown: true, complete: true };
  const LIVE = { ...FINISHED, complete: false };
  const humans = (over = {}) => ({ id: 'rae', kind: 'human', archId: null, ...over });
  const answer = (battles) => async () => ({ ok: true, json: async () => ({ battles }) });
  let reads;
  beforeEach(() => {
    reads = 0;
    seen.fetchWithAuth = async () => { reads += 1; return answer({ rae: { agentContext: { archetype: 'guardian' } }, sam: { agentContext: { archetype: 'degen' } }, tao: { agentContext: {} } })(); };
  });

  // The read is memoized per group for the page's life, so each row brings its own group id.
  let group = 0;
  const open = (children, props = {}) => <LeagueAgentFormScope groupId={`g${(group += 1)}`} {...props}>{children}</LeagueAgentFormScope>;

  it('a finished game opened fresh: a human rival wears their armor, in copper', async () => {
    await show(open(<LeagueAgentFormSlot seat={humans()} size={44} standing={FINISHED} />));
    expect(last()).toMatchObject({ archetype: 'guardian', allegiance: 'opponent' });
    expect(drawn(last())).toMatchObject({ kind: 'preserve', pal: 'copper' });
  });

  it('one read per open, however many rivals and renders', async () => {
    const seats3 = [humans(), humans({ id: 'sam' }), humans({ id: 'tao' })];
    const el = open(<>{seats3.map((s) => <LeagueAgentFormSlot key={s.id} seat={s} size={44} standing={FINISHED} />)}</>);
    await show(el);
    await act(async () => { root.render(el); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(host.querySelectorAll('[data-test-form]')).toHaveLength(3);
    expect(reads).toBe(1);
  });

  it('never polls: the clock moves on and nothing asks again', async () => {
    await show(open(<LeagueAgentFormSlot seat={humans()} size={44} standing={FINISHED} />));
    const timers = vi.spyOn(globalThis, 'setInterval');
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(reads).toBe(1);
    expect(timers.mock.calls.filter(([, ms]) => ms === 60000)).toEqual([]);
    timers.mockRestore();
  });

  it('unknown stays a bare copper core', async () => {
    await show(open(<LeagueAgentFormSlot seat={humans({ id: 'tao' })} size={44} standing={FINISHED} />));
    expect(last().archetype).toBeUndefined();
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'copper' });
  });

  it('a failed read leaves a bare copper core and the arena standing', async () => {
    seen.fetchWithAuth = async () => { reads += 1; throw new Error('offline'); };
    await show(open(<LeagueAgentFormSlot seat={humans()} size={44} standing={FINISHED} />));
    expect(drawn(last())).toMatchObject({ kind: 'none', pal: 'copper' });
    expect(reads).toBe(1);
  });

  it('no read at all where none is needed', async () => {
    const stays = async (el) => { await show(el); expect(reads).toBe(0); };
    await stays(open(<LeagueAgentFormSlot seat={humans()} size={44} standing={LIVE} />));
    await stays(open(<LeagueAgentFormSlot seat={humans({ archId: 'guardian' })} size={44} standing={FINISHED} />));
    await stays(open(<LeagueAgentFormSlot seat={{ id: 'cpu-3', kind: 'cpu', archId: cpuArchetypeForN(3) }} size={44} standing={FINISHED} />));
    await stays(open(<LeagueAgentFormSlot seat={{ id: 'me', kind: 'you', archId: null }} you size={50} standing={FINISHED} />));
    await stays(<LeagueAgentFormSlot seat={humans()} size={44} standing={FINISHED} />);
  });
});

describe('the mood reaches the form from what the screen holds', () => {
  const board = { ranked: ['cpu-3', 'rival', UID, 'stranger'], cut: true, shown: true, complete: false };
  const standing = (children) => <LeagueStandingContext.Provider value={board}>{children}</LeagueStandingContext.Provider>;

  it('the fuse\'s board, by seat id: the player out of the cut worried, the leading rival confident', async () => {
    await show(standing(<LeagueAgentFormSlot seat={seat(UID)} you size={50} />));
    expect(last().mood).toBe('worried');
    await show(standing(<LeagueAgentFormSlot seat={seat('cpu-3')} size={44} />));
    expect(last().mood).toBe('confident');
  });

  it('a standing handed in wins over the board (the climb derives its own)', async () => {
    await show(standing(<LeagueAgentFormSlot seat={seat(UID)} you size={50} standing={{ rank: 1, seats: 4, cut: false, shown: true, complete: false }} />));
    expect(last().mood).toBe('confident');
  });

  it('the arena\'s battle: a live evaluation lock reads researching for the player, and for no rival', async () => {
    const battle = { status: 'active', cronState: { evaluatingAt: new Date(Date.now() - 20_000).toISOString() } };
    await show(<LeagueAgentFormScope battle={battle}>{standing(<LeagueAgentFormSlot seat={seat(UID)} you size={50} />)}</LeagueAgentFormScope>);
    expect(last().mood).toBe('researching');
    await show(<LeagueAgentFormScope battle={battle}>{standing(<LeagueAgentFormSlot seat={seat('stranger')} size={44} />)}</LeagueAgentFormScope>);
    expect(last().mood).toBe('worried');
  });

  it('with no scope and no board (the lobby\'s preview has no battle) the form still draws, idle', async () => {
    await show(<LeagueAgentFormSlot seat={seat(UID)} you size={50} />);
    expect(last().mood).toBe('idle');
  });

  it('the group\'s final verdict celebrates: the rank the screen prints, through the scope (founder ruling 1)', async () => {
    const finished = { ranked: ['cpu-3', 'rival', UID, 'stranger'], cut: true, shown: true, complete: true };
    const final = (youRank) => (
      <LeagueAgentFormScope youRank={youRank}>
        <LeagueStandingContext.Provider value={finished}><LeagueAgentFormSlot seat={seat(UID)} you size={50} /></LeagueStandingContext.Provider>
      </LeagueAgentFormScope>
    );
    await show(final(2));
    expect(last().mood).toBe('celebrating');
    await show(final(3));
    expect(last().mood).toBe('idle');
    await show(standing(<LeagueAgentFormSlot seat={seat('cpu-3')} size={44} />));
    expect(last().mood).toBe('confident');
  });
});
