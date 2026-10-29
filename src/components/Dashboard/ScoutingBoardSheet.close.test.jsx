// @vitest-environment jsdom
//
// src/components/Dashboard/ScoutingBoardSheet.close.test.jsx
//
// Command Center repair R1, founder ruling Q4 — which deploy results close the
// Scouting Board sheet. A created deploy closes it, as before R1; so does the
// agent's already-running battle (`existing_battle`), which closed it before R1
// typed that answer (it was then a false success:true). Every failure leaves it
// open, as before, consistent with the ceremony's error terminal.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// The board's own read stays pending: only the footer's deploy button matters here.
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(() => new Promise(() => {})) }));

const { default: ScoutingBoardSheet } = await import('./ScoutingBoardSheet');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root; let host;
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
});

async function tapDeploy(result) {
  const onClose = vi.fn();
  const onDeploy = vi.fn(async () => result);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <ScoutingBoardSheet open onClose={onClose} agent={{ archetype: 'momentum' }} accent="#22c55e"
        deploying={false} deployDisabled={false} isLive={false} onDeploy={onDeploy} />,
    );
  });
  const btn = [...document.querySelectorAll('button')].find((b) => /Deploy this agent/.test(b.textContent || ''));
  expect(btn, 'the sheet\'s deploy button').toBeTruthy();
  await act(async () => { btn.click(); });
  await act(async () => {});
  expect(onDeploy).toHaveBeenCalledTimes(1);
  return onClose;
}

describe('ScoutingBoardSheet closes on a created deploy and on the running battle (founder ruling Q4)', () => {
  it('created closes the sheet', async () => {
    expect(await tapDeploy({ outcome: 'created', success: true, agentBattleId: 'battle-new' })).toHaveBeenCalledTimes(1);
  });

  it('existing_battle closes the sheet, as the pre-R1 answer did', async () => {
    const onClose = await tapDeploy({ outcome: 'existing_battle', success: false, existingBattleId: 'battle-running', postIssued: true, httpStatus: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['refused', { outcome: 'refused', success: false, status: 429, httpStatus: 429, postIssued: true, reason: 'cooldown' }],
    ['uncertain', { outcome: 'uncertain', success: false, status: 500, httpStatus: 500, postIssued: true }],
    ['handoff_failed', { outcome: 'handoff_failed', success: false, status: 200, httpStatus: 200, postIssued: true, battleId: 'battle-new' }],
    ['orphaned', { outcome: 'orphaned', success: false, postIssued: true }],
    ['a shell catch', { success: false }],
  ])('%s leaves the sheet open', async (_label, result) => {
    expect(await tapDeploy(result)).not.toHaveBeenCalled();
  });
});

// The S8 review's S8-9 (ruling R-S8F-10): the footer's `deployBusy = deployDisabled || deploying` was pinned by no row
// (its mutant Q6M-11, `→ deploying`, survived 237). The real sheet, open, each half on its own.
describe('the footer is disabled while the deploy cannot start or is under way (S8-9)', () => {
  async function renderBoard({ deployDisabled, deploying }) {
    const onDeploy = vi.fn(async () => ({ outcome: 'created', success: true, agentBattleId: 'battle-new' }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <ScoutingBoardSheet open onClose={vi.fn()} agent={{ archetype: 'momentum' }} accent="#22c55e"
          deploying={deploying} deployDisabled={deployDisabled} isLive={false} onDeploy={onDeploy} />,
      );
    });
    const footer = [...document.querySelectorAll('button')].find((b) => /Deploy this agent|Deploying…|Battle in progress/.test(b.textContent || ''));
    expect(footer, 'the sheet\'s footer button').toBeTruthy();
    return { footer, onDeploy };
  }

  it('deployDisabled: the footer is disabled and a click never calls onDeploy', async () => {
    const { footer, onDeploy } = await renderBoard({ deployDisabled: true, deploying: false });
    expect(footer.disabled).toBe(true);
    await act(async () => { footer.click(); });
    expect(onDeploy).not.toHaveBeenCalled();
  });

  it('deploying: the footer is disabled, says so, and a click never calls onDeploy', async () => {
    const { footer, onDeploy } = await renderBoard({ deployDisabled: false, deploying: true });
    expect(footer.disabled).toBe(true);
    expect(footer.textContent).toContain('Deploying…');
    await act(async () => { footer.click(); });
    expect(onDeploy).not.toHaveBeenCalled();
  });
});
