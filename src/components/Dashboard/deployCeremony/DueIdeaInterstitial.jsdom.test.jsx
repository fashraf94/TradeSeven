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
//     the plan): no words appear — no "try again" in any form (review L4-6) —
//     the same three buttons stay, live again, and the next press re-reads
//     the idea first — an idea no longer due (the lost response landed after
//     all) simply deploys; a step that outlasts STEP_TIMEOUT_MS counts as
//     failed; while a step runs the buttons are busy, never disabled, so
//     focus stays inside the screen (review L4-13).

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

import DueIdeaInterstitial, { STEP_TIMEOUT_MS } from './DueIdeaInterstitial';
import { DUE_DEPLOY_ACTIONS } from '../../Forge/Watchlist/ideaCopy';

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
  it('a typed refusal (409) → NO deploy, no words (the server\'s "Reload and try again" never shows), the same three buttons live again', async () => {
    svc.reaffirmHypothesis.mockRejectedValue(typed(409, 'version_conflict', 'The idea changed since you loaded it. Reload and try again.'));
    await mount();
    const before = screen().textContent;
    await press('reaffirm');
    expect(proceeded).toBe(0);
    expect(screen().textContent).toBe(before);
    expect(screen().textContent).not.toMatch(/try again/i);
    expect(buttons().map((b) => b.textContent)).toEqual(['Reaffirm and deploy', 'Retire and deploy', 'Deploy without it']);
    expect(buttons().every((b) => !b.disabled && b.getAttribute('aria-disabled') === 'false')).toBe(true);
  });
  it('a failure with no server words (a lost response) → no deploy, no words', async () => {
    svc.transitionHypothesis.mockRejectedValue(new Error('Failed to fetch'));
    await mount();
    const before = screen().textContent;
    await press('retire');
    expect(proceeded).toBe(0);
    expect(screen().textContent).toBe(before);
  });
  it('while a step runs the buttons are busy, never disabled (focus stays inside the screen), and a second press does nothing', async () => {
    let finish;
    svc.reaffirmHypothesis.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await mount();
    await act(async () => { byAction('reaffirm').click(); });
    expect(buttons().every((b) => !b.disabled && b.getAttribute('aria-disabled') === 'true')).toBe(true);
    await act(async () => { byAction('without').click(); });
    expect(proceeded).toBe(0);
    await act(async () => { finish({}); });
    await flush();
    expect(proceeded).toBe(1);
    expect(svc.reaffirmHypothesis).toHaveBeenCalledTimes(1);
  });
  it(`a step that outlasts STEP_TIMEOUT_MS (${STEP_TIMEOUT_MS} ms) counts as failed: no deploy, the buttons live again, and the next press re-reads first`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.transitionHypothesis.mockReturnValue(new Promise(() => {}));
      await mount();
      await act(async () => { byAction('retire').click(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(STEP_TIMEOUT_MS); });
      await flush();
      expect(proceeded).toBe(0);
      expect(buttons().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      svc.listHypothesisVersions.mockResolvedValue({ watchlistId: 'wl-1', currentVersion: 3, versions: [{ version: 2, status: 'retired', firstDeployedAt: '2026-10-05T15:00:00.000Z' }] });
      await act(async () => { byAction('retire').click(); });
      await flush();
      expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
      expect(proceeded).toBe(1);
    } finally {
      vi.useRealTimers();
    }
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
  it('the re-read itself fails → still no deploy, still no words', async () => {
    svc.transitionHypothesis.mockRejectedValueOnce(new Error('Failed to fetch'));
    svc.listHypothesisVersions.mockRejectedValue(typed(404, 'disabled', undefined));
    await mount();
    const before = screen().textContent;
    await press('retire');
    await press('retire');
    expect(proceeded).toBe(0);
    expect(screen().textContent).toBe(before);
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

// ── The mutation lens's rows (review L5a), each proven red on its mutant and green on the original ──
describe('L5a mutation lens rows — the screen\'s steps (I05, I07, I09, I11, I14, I19)', () => {
  it('I05/I14 — the REAFFIRM and the RE-READ are bounded by STEP_TIMEOUT_MS too: a hung one counts as failed — no deploy, the buttons live again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.reaffirmHypothesis.mockReturnValue(new Promise(() => {}));
      await mount();
      await act(async () => { byAction('reaffirm').click(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(STEP_TIMEOUT_MS); });
      await flush();
      expect(proceeded).toBe(0);
      expect(buttons().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
      // The next press re-reads first — and a hung re-read is bounded the same way.
      svc.listHypothesisVersions.mockReturnValue(new Promise(() => {}));
      await act(async () => { byAction('reaffirm').click(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(STEP_TIMEOUT_MS); });
      await flush();
      expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
      expect(svc.reaffirmHypothesis).toHaveBeenCalledTimes(1);
      expect(proceeded).toBe(0);
      expect(buttons().every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each(['reaffirm', 'retire'])('I09/I11 — %s after a failed step acts on the version the RE-READ names (the idea moved on to another due version), never the stale one', async (id) => {
    const step = id === 'reaffirm' ? svc.reaffirmHypothesis : svc.transitionHypothesis;
    step.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({});
    svc.listHypothesisVersions.mockResolvedValue({
      watchlistId: 'wl-1', currentVersion: 6,
      versions: [dueVersion({ version: 4 }), { version: 2, status: 'retired', firstDeployedAt: '2026-10-05T15:00:00.000Z', activation: [], invalidation: [] }],
    });
    await mount();
    await press(id);
    await press(id);
    expect(step).toHaveBeenCalledTimes(2);
    expect(step.mock.calls[1][1]).toMatchObject({ version: 4 });
    expect(proceeded).toBe(1);
  });
  it('I07 — the re-read refreshes the screen\'s idea: a step that fails again leaves the RE-READ idea\'s title on screen', async () => {
    svc.reaffirmHypothesis.mockRejectedValue(new Error('Failed to fetch'));
    svc.listHypothesisVersions.mockResolvedValue({
      watchlistId: 'wl-1', currentVersion: 3, versions: [dueVersion({ stateReason: 'horizon_elapsed', horizonEnum: 'swing' })],
      deployedLists: { 2: { name: 'Chips', tickers: ['NVDA'] } },
    });
    await mount({ ...DUE, title: null });
    await press('reaffirm');
    await press('reaffirm');
    expect(proceeded).toBe(0);
    expect(screen().querySelector('[data-testid="due-idea-title"]')?.textContent).toBe('Your NVDA idea reached its time-frame.');
  });
  it('I19 — the step bound is 15 s (pinned, as dueIdeaCheck.test.js pins its 2.5 s)', () => {
    expect(STEP_TIMEOUT_MS).toBe(15_000);
  });
});
