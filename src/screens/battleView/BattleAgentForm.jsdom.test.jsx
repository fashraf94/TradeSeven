// @vitest-environment jsdom
//
// src/screens/battleView/BattleAgentForm.jsdom.test.jsx
//
// Agent form build S1 (Scope B) — the battle form, through its real slot with AGENT_FORM_BATTLE_ENABLED on, and the
// wrapper replaced by a recording stand-in. The player: the battle's own archetype (agentContext.archetype) in teal;
// the CPU opponent: copper, mirrored and bare (R9); both decorative (R10), batched (R2), at growth stage 1 (R7); the
// mood from the scope's cockpit feed and clock and the hub's outcome derivation (R8); the still while the chunk loads;
// and both drawn at the tight framing (the S1 size follow-up), the battle views' own.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const here = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), name);

const LIVE = { status: 'active', agentContext: { agentName: 'Aurora', archetype: 'degen' }, cronState: { evaluatingAt: null }, statusFeed: [], scoreState: { currentScore: 12, opponentScore: 3 } };

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.forms = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

// The lazy chunk and the outcome module resolve on later turns: a few ms alone, but under a loaded full suite the first
// import in a worker missed a 100 ms wait. So wait up to 3 s (under the row's 5 s limit), ending as soon as it is there.
async function until(selector) {
  for (let i = 0; i < 300 && !host.querySelector(selector); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}
async function show(el) {
  await act(async () => { root.render(el); });
  await until('[data-test-form]');
}
const scope = (children, cockpitFeed = null) => <BattleAgentFormScope cockpitFeed={cockpitFeed}>{children}</BattleAgentFormScope>;
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
  it('the player: the battle\'s archetype (agentContext.archetype), teal, decorative, batched, the CSS glow, stage 1, framed tight', async () => {
    await show(scope(<BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 12, opponent: 3 }} reducedMotion />));
    expect(last('player')).toMatchObject({ archetype: 'degen', allegiance: 'player', label: null, batched: true, bloom: 'css', coreStage: 1, armorStage: 1, size: 72, reducedMotion: true, mood: 'confident', framing: 'tight' });
  });

  it('the CPU opponent: no archetype — a bare core — in copper, mirrored, facing the player (R9)', async () => {
    await show(scope(<BattleAgentFormSlot agentBattle={LIVE} side="opponent" size={72} scores={{ player: 12, opponent: 3 }} />));
    const cpu = last('opponent');
    expect(cpu).toMatchObject({ archetype: undefined, allegiance: 'opponent', label: null, mood: 'worried', framing: 'tight' });
    expect(agentFormSpec(cpu)).toMatchObject({ kind: 'none', pal: 'copper', face: -1, zoom: .9 });
  });
});

describe('the mood, from the scope and the battle (R8)', () => {
  it('waiting while the cockpit holds a call that needs the player; the CPU is never waiting', async () => {
    await show(scope(<><BattleAgentFormSlot agentBattle={LIVE} size={72} scores={{ player: 3, opponent: 12 }} /><BattleAgentFormSlot agentBattle={LIVE} side="opponent" size={72} scores={{ player: 3, opponent: 12 }} /></>, { needsYouCount: 1 }));
    await until('[data-test-form="opponent"]');
    expect(last('player').mood).toBe('waiting');
    expect(last('opponent').mood).toBe('confident');
  });

  it('researching while an evaluation the server would honour is in flight, by the form\'s own clock', async () => {
    const evaluating = { ...LIVE, cronState: { evaluatingAt: new Date(Date.now() - 20_000).toISOString() } };
    await show(scope(<BattleAgentFormSlot agentBattle={evaluating} size={72} scores={{ player: 12, opponent: 3 }} />));
    expect(last('player').mood).toBe('researching');
  });

  it('celebrating a won, completed battle — through the hub\'s outcome derivation, loaded beside the form', async () => {
    const won = { ...LIVE, status: 'completed', statusFeed: [{ action: 'battle_complete' }], scoreState: { currentScore: 12, opponentScore: 3, evaluationCount: 9 } };
    await show(scope(<BattleAgentFormSlot agentBattle={won} size={72} scores={{ player: 12, opponent: 3 }} />));
    expect(last('player').mood).toBe('celebrating');
  });
});

// Build S2 (ruling R21, the S1 review's SR-7): the form's clock is its own, so it ticks with the cockpit controller on or
// off: a crashed tick's stale stamp ages out of "researching" on any screen that draws a form.
describe('the form\'s own clock (R21)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('ticks by itself: a stamp near the lock\'s age reads researching, then ages out without the screen doing anything', async () => {
    const stale = { ...LIVE, cronState: { evaluatingAt: new Date(Date.now() - 100_000).toISOString() } };
    await show(scope(<BattleAgentFormSlot agentBattle={stale} size={72} scores={{ player: 1, opponent: 3 }} />));
    expect(last('player').mood).toBe('researching');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() });
    act(() => { root.render(scope(<BattleAgentFormSlot agentBattle={stale} size={72} scores={{ player: 1, opponent: 3 }} key="fresh" />)); });
    await act(async () => { await Promise.resolve(); });
    expect(last('player').mood).toBe('researching');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(last('player').mood).toBe('researching');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(last('player').mood).toBe('worried');
  });

  it('the scope hands the forms no clock: a screen cannot tie them back to the controller', async () => {
    const source = readFileSync(here('battleAgentFormSlot.jsx'), 'utf8');
    expect(source).not.toMatch(/\bnowMs\b/);
    expect(source).not.toMatch(/\bnow\b[,}=]/);
    const form = readFileSync(here('BattleAgentForm.jsx'), 'utf8');
    expect(form).toMatch(/useCoarseNow\(true\)/);
  });
});
