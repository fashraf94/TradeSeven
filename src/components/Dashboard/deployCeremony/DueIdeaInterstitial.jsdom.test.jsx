// @vitest-environment jsdom
// src/components/Dashboard/deployCeremony/DueIdeaInterstitial.jsdom.test.jsx
//
// Pilot P1c — founder ruling E1, the deploy station's one screen before a
// deploy whose idea is due (acceptance row 2):
//   · the title is table C V1.2's line with [SYM] / the FROZEN [LIST]; none
//     known → no title, never an invented one;
//   · exactly three buttons, in the ruling's order — no fourth option, no
//     "Try again";
//   · each button's sequence: reaffirm → the reaffirm route (the due version,
//     a fresh opId, the pointer the GET saw) THEN the deploy; retire → the
//     transition route (retire, expected review_due) THEN the deploy; deploy
//     without it → the deploy alone, no route call;
//   · a failed step never falls through to a deploy (the advisor's change to
//     the plan): the server's typed message is shown, the same three buttons
//     stay, and the next press re-reads the idea first — an idea no longer
//     due (the lost response landed after all) simply deploys.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const svc = vi.hoisted(() => ({
  reaffirmHypothesis: vi.fn(),
  transitionHypothesis: vi.fn(),
  newOpId: vi.fn(),
  listHypothesisVersions: vi.fn(),
  createHypothesisVersion: vi.fn(),
}));
vi.mock('../../../services/hypothesisVersionService', () => svc);
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));

import DueIdeaInterstitial from './DueIdeaInterstitial';
import { DUE_DEPLOY_ACTIONS, PANEL_COPY } from '../../Forge/Watchlist/ideaCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root; let proceeded; let ops;
beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockReset();
  ops = 0;
  svc.newOpId.mockImplementation(() => `op-${++ops}`);
  proceeded = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const DUE = Object.freeze({ watchlistId: 'wl-1', version: 2, currentVersion: 3, title: 'Your AI capex idea reached its time-frame.' });
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
const screen = () => document.body.querySelector('[data-testid="due-idea-interstitial"]');
const buttons = () => [...screen().querySelectorAll('button')];
const byAction = (id) => screen().querySelector(`button[data-action="${id}"]`);
async function mount(due = DUE) {
  await act(async () => { root.render(<DueIdeaInterstitial due={due} onProceed={() => { proceeded += 1; }} />); });
  await flush();
}
async function press(id) { await act(async () => { byAction(id).click(); }); await flush(); }
const typed = (status, code, message) => Object.assign(new Error(message), { status, code, body: { error: code, message } });
const dueVersion = (over = {}) => ({ version: 2, status: 'review_due', firstDeployedAt: '2026-10-05T15:00:00.000Z', activation: [], invalidation: [], ...over });

describe('the screen (E1, table C V1.2)', () => {
  it('the title, then exactly the three buttons in the ruling\'s order — no fourth option, no "Try again"', async () => {
    await mount();
    expect(screen().getAttribute('role')).toBe('dialog');
    expect(screen().querySelector('[data-testid="due-idea-title"]').textContent).toBe(DUE.title);
    expect(buttons().map((b) => b.textContent)).toEqual(['Reaffirm and deploy', 'Retire and deploy', 'Deploy without it']);
    expect(buttons().map((b) => b.getAttribute('data-action'))).toEqual(DUE_DEPLOY_ACTIONS.map((a) => a.id));
    expect(screen().textContent).not.toMatch(/try again/i);
    expect(screen().querySelector('[data-testid="due-idea-error"]')).toBeNull();
  });
  it('no [SYM] or [LIST] known → no title at all (never an invented one); the three buttons stand', async () => {
    await mount({ ...DUE, title: null });
    expect(screen().querySelector('[data-testid="due-idea-title"]')).toBeNull();
    expect(buttons()).toHaveLength(3);
  });
});

describe('each button\'s sequence', () => {
  it('Reaffirm and deploy → the reaffirm route on the due version with a fresh opId and the pointer the GET saw, THEN the deploy', async () => {
    let atReaffirm = null;
    svc.reaffirmHypothesis.mockImplementation(async () => { atReaffirm = proceeded; return { version: { version: 4, status: 'ready' } }; });
    await mount();
    await press('reaffirm');
    expect(svc.reaffirmHypothesis).toHaveBeenCalledTimes(1);
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 2, opId: 'op-1', expectedVersion: 3 });
    expect(atReaffirm).toBe(0); // the deploy had not started when the reaffirm ran
    expect(proceeded).toBe(1);
    expect(svc.transitionHypothesis).not.toHaveBeenCalled();
  });
  it('Retire and deploy → the transition route (retire, expected review_due) on the due version, THEN the deploy', async () => {
    svc.transitionHypothesis.mockResolvedValue({ version: { version: 2, status: 'retired' } });
    await mount();
    await press('retire');
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 2, action: 'retire', expectedStatus: 'review_due' });
    expect(proceeded).toBe(1);
    expect(svc.reaffirmHypothesis).not.toHaveBeenCalled();
  });
  it('Deploy without it → the deploy alone: no route call, the idea stays due', async () => {
    await mount();
    await press('without');
    expect(proceeded).toBe(1);
    expect(svc.reaffirmHypothesis).not.toHaveBeenCalled();
    expect(svc.transitionHypothesis).not.toHaveBeenCalled();
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
});

describe('a failed step never falls through to a deploy', () => {
  it('a typed refusal (409) → the server\'s own words, NO deploy, the same three buttons standing', async () => {
    svc.reaffirmHypothesis.mockRejectedValue(typed(409, 'version_conflict', 'The idea changed since you loaded it. Reload and try again.'));
    await mount();
    await press('reaffirm');
    expect(proceeded).toBe(0);
    expect(screen().querySelector('[data-testid="due-idea-error"]').textContent).toBe('The idea changed since you loaded it. Reload and try again.');
    expect(buttons().map((b) => b.textContent)).toEqual(['Reaffirm and deploy', 'Retire and deploy', 'Deploy without it']);
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });
  it('a failure with no server words (a lost response) → the Idea panel\'s own failure line, no deploy', async () => {
    svc.transitionHypothesis.mockRejectedValue(new Error('Failed to fetch'));
    await mount();
    await press('retire');
    expect(proceeded).toBe(0);
    expect(screen().querySelector('[data-testid="due-idea-error"]').textContent).toBe(PANEL_COPY.moveFailed);
  });
  it('the next press re-reads the idea FIRST: still due → the step again with the fresh pointer and a new opId, then the deploy', async () => {
    svc.reaffirmHypothesis.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({});
    svc.listHypothesisVersions.mockResolvedValue({
      watchlistId: 'wl-1', currentVersion: 5, versions: [{ version: 5, status: 'draft' }, dueVersion()], deployedLists: { 2: { name: 'AI capex', tickers: ['NVDA', 'AMD'] } },
    });
    await mount();
    await press('reaffirm');
    expect(proceeded).toBe(0);
    await press('reaffirm');
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(svc.reaffirmHypothesis).toHaveBeenLastCalledWith('wl-1', { version: 2, opId: 'op-2', expectedVersion: 5 });
    expect(proceeded).toBe(1);
  });
  it('the next press finds the idea no longer due (the lost reaffirm landed): it deploys with no second reaffirm', async () => {
    svc.reaffirmHypothesis.mockRejectedValueOnce(new Error('Failed to fetch'));
    svc.listHypothesisVersions.mockResolvedValue({
      watchlistId: 'wl-1', currentVersion: 4, versions: [{ version: 4, status: 'ready' }, dueVersion({ successorVersion: 4 })],
    });
    await mount();
    await press('reaffirm');
    await press('reaffirm');
    expect(svc.reaffirmHypothesis).toHaveBeenCalledTimes(1);
    expect(proceeded).toBe(1);
  });
  it('the re-read itself fails → said, and still no deploy', async () => {
    svc.transitionHypothesis.mockRejectedValueOnce(new Error('Failed to fetch'));
    svc.listHypothesisVersions.mockRejectedValue(typed(404, 'disabled', undefined));
    await mount();
    await press('retire');
    await press('retire');
    expect(proceeded).toBe(0);
    expect(screen().querySelector('[data-testid="due-idea-error"]')).not.toBeNull();
  });
  it('Deploy without it after a failure deploys at once (no re-read, no route)', async () => {
    svc.reaffirmHypothesis.mockRejectedValue(new Error('Failed to fetch'));
    await mount();
    await press('reaffirm');
    await press('without');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
    expect(proceeded).toBe(1);
  });
});
