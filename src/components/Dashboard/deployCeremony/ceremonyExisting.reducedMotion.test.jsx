// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyExisting.reducedMotion.test.jsx
//
// Command Center repair R1 (review L5-6) — the existing-battle terminal under
// reduced motion. DeployCeremony picks its body as error → reveal → existing →
// the reduced-motion checklist → the theater; a reduced-motion user must get
// the terminal, never the checklist. framer-motion reads the OS setting once and
// caches it, so the hook is mocked for this whole file.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const { targetProgressState } = vi.hoisted(() => ({ targetProgressState: { value: null } }));

vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));
vi.mock('../../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: vi.fn(async () => ({ found: false, battle: null })), default: vi.fn() }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: vi.fn(), getCurrentUser: () => ({ uid: 'uid-1' }) }));
vi.mock('../../../hooks/useDeployTargetProgress', () => ({ default: () => targetProgressState.value }));
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../../Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('./ceremonyData', async (importOriginal) => ({ ...(await importOriginal()), useEquippedWatchlistSymbols: () => ({ symbols: [] }) }));

const { default: DeployCeremony } = await import('./DeployCeremony.jsx');

const RUNNING = { id: 'battle-running', ownerId: 'uid-1', status: 'active', agentId: 'casual-agent-uid-1' };
let container; let root; let opened;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  opened = [];
  targetProgressState.value = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: true };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const text = () => document.body.textContent || '';

describe('the existing terminal under reduced motion (review L5-6)', () => {
  it('shows "Already running" and opens the running game — never the reduced-motion checklist', async () => {
    act(() => {
      root.render(
        <DeployCeremony
          agent={{ id: 'agent-ranked-1', name: 'Nova' }}
          agentName="Nova"
          targetAgentId="casual-agent-uid-1"
          deployResult={{ status: 'existing', existingBattleId: 'battle-running', httpStatus: 200, postIssued: true }}
          liveBattles={[RUNNING]}
          onOpenBattle={(b) => { opened.push(b); }}
          onEnterBattle={() => {}}
          onRetry={() => {}}
          onDismiss={() => {}}
        />,
      );
    });
    const start = Date.now();
    while (!text().includes('Open game') && Date.now() - start < 3000) {
      await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    }
    expect(text()).toContain('Already running');
    expect(text()).toContain('Nova already has a game running.');
    const open = [...document.body.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Open game'));
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    act(() => { open.click(); });
    expect(opened).toEqual([RUNNING]);
  });
});
