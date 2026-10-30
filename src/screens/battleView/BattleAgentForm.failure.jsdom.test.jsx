// @vitest-environment jsdom
//
// src/screens/battleView/BattleAgentForm.failure.jsdom.test.jsx
//
// Agent form build S1 (Scope B) — a failed load never takes the battle screen down. The battle form is a lazy chunk
// and the hub's outcome derivation loads beside it; on a flaky connection either can fail. The form's chunk failing
// leaves the slot on the form's still (its own boundary), with the rest of the screen in place; the outcome module
// failing leaves the form running, a completed battle idle (never a claimed win).

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WON = { status: 'completed', agentContext: { archetype: 'degen' }, statusFeed: [{ action: 'battle_complete' }], scoreState: { currentScore: 12, opponentScore: 3, evaluationCount: 9 } };
let root, host, quiet;
beforeEach(() => {
  vi.resetModules();
  vi.doMock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_BATTLE_ENABLED: true }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); host.remove(); quiet.mockRestore(); vi.doUnmock('./BattleAgentForm'); vi.doUnmock('../../components/CommandCenter/hub/selectors/gameOutcome'); vi.doUnmock('../../components/AgentForm/AgentForm'); });

async function turns(n = 20, until = () => false) {
  for (let i = 0; i < n && !until(); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}

describe('a failed load keeps the screen', () => {
  it('the form\'s chunk fails: the slot keeps the still, and the rest of the screen stays', async () => {
    vi.doMock('./BattleAgentForm', () => { throw new Error('chunk failed to load'); });
    const { BattleAgentFormScope, BattleAgentFormSlot } = await import('./battleAgentFormSlot');
    await act(async () => {
      root.render(
        <div data-test-screen="1">
          <BattleAgentFormScope cockpitFeed={null}>
            <BattleAgentFormSlot agentBattle={WON} size={72} scores={{ player: 12, opponent: 3 }} />
          </BattleAgentFormScope>
          <p data-test-rest="1">scores</p>
        </div>,
      );
    });
    await turns();
    expect(host.querySelector('[data-test-rest]')).not.toBeNull();
    expect(host.querySelector('[data-agent-form-placeholder]')).not.toBeNull();
  });

  it('the outcome module fails: the form still draws, and a completed battle is idle, never a claimed win', async () => {
    vi.doMock('../../components/CommandCenter/hub/selectors/gameOutcome', () => { throw new Error('chunk failed to load'); });
    const forms = [];
    vi.doMock('../../components/AgentForm/AgentForm', () => ({
      default: class AgentFormProbe extends Component { render() { forms.push(this.props); return <i data-test-form="1" />; } },
    }));
    const { BattleAgentFormScope, BattleAgentFormSlot } = await import('./battleAgentFormSlot');
    await act(async () => {
      root.render(
        <BattleAgentFormScope cockpitFeed={null}>
          <BattleAgentFormSlot agentBattle={WON} size={72} scores={{ player: 12, opponent: 3 }} />
        </BattleAgentFormScope>,
      );
    });
    // Up to 3 s for the lazy form (a loaded full suite once took longer than 100 ms for it), ending once it shows.
    await turns(600, () => Boolean(host.querySelector('[data-test-form]')));
    expect(host.querySelector('[data-test-form]')).not.toBeNull();
    expect(forms.at(-1).mood).toBe('idle');
  });
});
