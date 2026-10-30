// @vitest-environment jsdom
//
// src/components/League/battleArena/LeagueAgentForm.jsdom.test.jsx
//
// Agent form build S2 — the one renderer the League's sites share, with the wrapper replaced by a recording stand-in and
// the seats built by the real bridge (buildArenaModel). What each seat is handed: the player teal (R11), a League CPU its
// archetype in copper (R13), a human rival theirs in copper (R14), an unknown seat a bare copper core. The slot's still
// and its boundary, as S1's battle slot. The moods' rows are screens/battleView/leagueAgentMood.test.js.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ forms: [] }));
vi.mock('../../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    render() { seen.forms.push(this.props); return <i data-test-form={this.props.allegiance} />; }
  },
}));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: true }));

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
});
