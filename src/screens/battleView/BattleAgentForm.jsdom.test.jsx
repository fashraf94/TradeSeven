// @vitest-environment jsdom
//
// src/screens/battleView/BattleAgentForm.jsdom.test.jsx
//
// Agent form build S1 (Scope B) — the battle form, through its real slot with AGENT_FORM_BATTLE_ENABLED on, and the
// wrapper replaced by a recording stand-in. The player: the battle's own archetype (agentContext.archetype) in teal;
// the CPU opponent: copper, mirrored and bare (R9); both decorative (R10), batched (R2), at growth stage 1 (R7); the
// mood from the scope's cockpit feed and clock and the hub's outcome derivation (R8); the still while the chunk loads.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentFormSpec } from '../../components/AgentForm/agentFormSpec';

vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_BATTLE_ENABLED: true }));
const seen = vi.hoisted(() => ({ forms: [] }));
vi.mock('../../components/AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    render() { seen.forms.push(this.props); return <i data-test-form={this.props.allegiance} />; }
  },
}));

const { BattleAgentFormScope, BattleAgentFormSlot } = await import('./battleAgentFormSlot');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-29T15:00:00.000Z');
const LIVE = { status: 'active', agentContext: { agentName: 'Aurora', archetype: 'degen' }, cronState: { evaluatingAt: null }, statusFeed: [], scoreState: { currentScore: 12, opponentScore: 3 } };

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.forms = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

async function show(el) {
  await act(async () => { root.render(el); });
  // The lazy chunk and the outcome module resolve on later turns.
  for (let i = 0; i < 20 && !host.querySelector('[data-test-form]'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}
const scope = (children, cockpitFeed = null) => <BattleAgentFormScope cockpitFeed={cockpitFeed} now={NOW}>{children}</BattleAgentFormScope>;
const last = (allegiance) => seen.forms.filter((f) => f.allegiance === allegiance).at(-1);

describe('the slot: the form\'s still while the chunk loads, then the form', () => {
  it('shows the SVG still first, sized, decorative; then the form', async () => {
    act(() => { root.render(scope(<BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 12, opponent: 3 }} />)); });
    const still = host.querySelector('[data-agent-form-placeholder]');
    expect(still).not.toBeNull();
    expect(still.parentElement.getAttribute('aria-hidden')).toBe('true');
    expect(still.parentElement.style.width).toBe('72px');
    await show(scope(<BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 12, opponent: 3 }} />));
    expect(host.querySelector('[data-test-form="player"]')).not.toBeNull();
  });
});

describe('the player\'s form and the CPU\'s', () => {
  it('the player: the battle\'s archetype (agentContext.archetype), teal, decorative, batched, the CSS glow, stage 1', async () => {
    await show(scope(<BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 12, opponent: 3 }} reducedMotion />));
    expect(last('player')).toMatchObject({ archetype: 'degen', allegiance: 'player', label: null, batched: true, bloom: 'css', coreStage: 1, armorStage: 1, size: 72, reducedMotion: true, mood: 'confident' });
  });

  it('the CPU opponent: no archetype — a bare core — in copper, mirrored, facing the player (R9)', async () => {
    await show(scope(<BattleAgentFormSlot agentBattle={LIVE} side="opponent" size={72} scores={{ player: 12, opponent: 3 }} />));
    const cpu = last('opponent');
    expect(cpu).toMatchObject({ archetype: undefined, allegiance: 'opponent', label: null, mood: 'worried' });
    expect(agentFormSpec(cpu)).toMatchObject({ kind: 'none', pal: 'copper', face: -1 });
  });
});

describe('the mood, from the scope and the battle (R8)', () => {
  it('waiting while the cockpit holds a call that needs the player; the CPU is never waiting', async () => {
    await show(scope(<><BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 3, opponent: 12 }} /><BattleAgentFormSlot agentBattle={LIVE} side="opponent" size={72} scores={{ player: 3, opponent: 12 }} /></>, { needsYouCount: 1 }));
    for (let i = 0; i < 20 && !host.querySelector('[data-test-form="opponent"]'); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(last('player').mood).toBe('waiting');
    expect(last('opponent').mood).toBe('confident');
  });

  it('researching while an evaluation the server would honour is in flight, by the scope\'s clock', async () => {
    const evaluating = { ...LIVE, cronState: { evaluatingAt: new Date(NOW.getTime() - 20_000).toISOString() } };
    await show(scope(<BattleAgentFormSlot agentBattle={evaluating} size={72} scores={{ player: 12, opponent: 3 }} />));
    expect(last('player').mood).toBe('researching');
  });

  it('celebrating a won, completed battle — through the hub\'s outcome derivation, loaded beside the form', async () => {
    const won = { ...LIVE, status: 'completed', statusFeed: [{ action: 'battle_complete' }], scoreState: { currentScore: 12, opponentScore: 3, evaluationCount: 9 } };
    await show(scope(<BattleAgentFormSlot agentBattle={won} size={72} scores={{ player: 12, opponent: 3 }} />));
    expect(last('player').mood).toBe('celebrating');
  });
});
