// @vitest-environment jsdom
//
// Agent form build A1 follow-up — founder ruling N1 (Nov 4, 2026): outside a game Shadow is neutral, and the game seats
// keep their armor. With AGENT_FORM_ARMORY_ENABLED held on here (it is dark on main), the hub's hero is bare
// (CommandCenterHub.armory.jsdom.test.jsx); these rows hold the seats to what they wear today: the battle header's and
// pane's form the battle's archetype, a League seat in battle the battle's archetype, and the League lobby's climb
// preview the archetype the lobby holds. The wrapper is a recording stand-in; the slots and the arena bridge are real.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ forms: [] }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    render() { seen.forms.push(this.props); return <i data-test-form={this.props.allegiance} />; }
  },
}));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({
  ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: true, AGENT_FORM_BATTLE_ENABLED: true, AGENT_FORM_LEAGUE_ENABLED: true,
}));

const { BattleAgentFormScope, BattleAgentFormSlot } = await import('../../screens/battleView/battleAgentFormSlot');
const { LeagueAgentFormScope, LeagueAgentFormSlot } = await import('../League/battleArena/leagueAgentFormSlot');
const { buildArenaModel } = await import('../League/battleArena/buildArenaModel');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.forms = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

async function show(el) {
  await act(async () => { root.render(el); });
  for (let i = 0; i < 600 && !host.querySelector('[data-test-form]'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  expect(host.querySelector('[data-test-form]')).not.toBeNull();
}
const players = () => seen.forms.filter((p) => p.allegiance === 'player');

const UID = 'me';
const seats = (over = {}) => buildArenaModel({
  group: { status: 'battle', players: [{ odUserId: UID, picks: [] }, { odUserId: 'cpu-3', isCpu: true, picks: [] }] },
  battle: { agentContext: { archetype: 'degen', agentName: 'Aurora' } },
  uid: UID, mode: 'ranked', displayNames: {},
  ...over,
}).seats;

describe('N1: the game seats keep their armor with the armory on', () => {
  it('the battle header and pane: your form wears the battle\'s archetype', async () => {
    const battle = { status: 'active', agentContext: { archetype: 'analyst' }, statusFeed: [], scoreState: { currentScore: 0, opponentScore: 0, evaluationCount: 0 } };
    await show(<BattleAgentFormScope cockpitFeed={null}><BattleAgentFormSlot agentBattle={battle} size={72} scores={{ player: 0, opponent: 0 }} /></BattleAgentFormScope>);
    expect(players().at(-1).archetype).toBe('analyst');
  });

  it('a League seat in battle (the fuse and the climb): yours wears the battle\'s archetype', async () => {
    const you = seats().find((s) => s.id === UID);
    await show(<LeagueAgentFormSlot seat={you} you size={54} />);
    expect(players().at(-1).archetype).toBe('degen');
  });

  it('the League lobby\'s climb preview (a pod\'s seats): yours wears the archetype the lobby holds', async () => {
    const preview = seats({ battle: null }).find((s) => s.id === UID);
    await show(<LeagueAgentFormScope youArchetype="guardian"><LeagueAgentFormSlot seat={preview} you size={54} /></LeagueAgentFormScope>);
    expect(players().at(-1).archetype).toBe('guardian');
  });
});
