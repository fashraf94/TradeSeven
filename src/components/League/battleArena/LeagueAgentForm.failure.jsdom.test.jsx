// @vitest-environment jsdom
//
// src/components/League/battleArena/LeagueAgentForm.failure.jsdom.test.jsx
//
// Agent form build S2 — the two load failures, each in its own module graph, as S1's battle form: the form's chunk fails
// (the slot keeps the still and the arena stays), and the after-bell read's module fails (the form still draws, and an
// unknown rival is a bare core).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: true }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host, errors;
beforeEach(() => {
  vi.resetModules();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  errors.mockRestore();
  vi.doUnmock('./LeagueAgentForm');
  vi.doUnmock('../../AgentForm/AgentForm');
  vi.doUnmock('./finishedRivalRead');
});

const turns = (n, ready) => (async () => { for (let i = 0; i < n && !ready(); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); })();
const SEAT = { id: 'me', archId: 'degen', you: true };

describe('a failed load leaves the arena standing', () => {
  it('the form\'s chunk fails: the slot keeps the still, and what sits beside it stays', async () => {
    vi.doMock('./LeagueAgentForm', () => { throw new Error('chunk failed'); });
    const { LeagueAgentFormSlot } = await import('./leagueAgentFormSlot');
    await act(async () => { root.render(<div><LeagueAgentFormSlot seat={SEAT} you size={50} /><span data-beside="">the score</span></div>); });
    await turns(100, () => false);
    expect(host.querySelector('[data-agent-form-placeholder]')).not.toBeNull();
    expect(host.querySelector('[data-beside]')).not.toBeNull();
  });

  it('the after-bell read\'s module fails: the form draws, and a rival with no armor is a bare core', async () => {
    const seen = [];
    vi.doMock('../../AgentForm/AgentForm', () => ({ default: (props) => { seen.push(props); return <i data-test-form="" />; } }));
    vi.doMock('./finishedRivalRead', () => { throw new Error('chunk failed'); });
    const { LeagueAgentFormScope, LeagueAgentFormSlot } = await import('./leagueAgentFormSlot');
    const standing = { rank: 3, seats: 4, cut: true, shown: true, complete: true };
    await act(async () => { root.render(<LeagueAgentFormScope groupId="g1"><LeagueAgentFormSlot seat={{ id: 'rae', kind: 'human', archId: null }} size={44} standing={standing} /></LeagueAgentFormScope>); });
    await turns(600, () => host.querySelector('[data-test-form]') !== null);
    expect(seen.at(-1)).toMatchObject({ allegiance: 'opponent', mood: 'worried' });
    expect(seen.at(-1).archetype).toBeUndefined();
  });
});
