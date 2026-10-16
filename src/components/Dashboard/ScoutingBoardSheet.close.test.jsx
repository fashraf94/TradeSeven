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
