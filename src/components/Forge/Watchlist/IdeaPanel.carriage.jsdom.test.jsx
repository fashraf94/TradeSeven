// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.carriage.jsdom.test.jsx
//
// Pilot P1b — the Idea panel once ideas ride battles (build prompt item 7;
// acceptance rows 6 and 7 on the client):
//   · the review lines render [SYM] or [LIST] per founder ruling B3, from the
//     server's `deployedLists` (the FROZEN list the due version rode in) —
//     never the live list; neither known → the chip alone;
//   · the battle-ended line renders only for an `unspecified` idea (a B5
//     clock-fallback version shows its chip alone);
//   · an activated version that is not the current one shows as running —
//     its chip and dates, existing copy only;
//   · a superseded due version is offered Reaffirm exactly when ruling B4
//     holds (every newer version pre-deploy), its line rendered on it, and
//     the reaffirmation targets IT on the current pointer.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const state = vi.hoisted(() => ({ on: true }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isHypothesisRecordsOn: () => state.on }));
const svc = vi.hoisted(() => ({
  listHypothesisVersions: vi.fn(),
  createHypothesisVersion: vi.fn(),
  transitionHypothesis: vi.fn(),
  reaffirmHypothesis: vi.fn(),
  newOpId: vi.fn(() => 'op-fixed'),
}));
vi.mock('../../../services/hypothesisVersionService', () => svc);

import IdeaPanel from './IdeaPanel';
import { DARK_TOKENS } from '../../../theme/tokens';
import { ACTION_LABELS, PANEL_COPY, STATUS_LABELS } from './ideaCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  state.on = true;
  for (const fn of Object.values(svc)) fn.mockReset?.();
  svc.newOpId.mockImplementation(() => 'op-fixed');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const cond = (symbol) => ({ symbol, side: 'above', level: 100, basis: 'daily_close' });
const DEPLOYED = { firstDeployedAt: '2026-10-13T15:00:00.000Z', lastDeployedAt: '2026-10-13T15:00:00.000Z', lastDeployedBattleId: 'battle-1', reviewDueAt: '2026-10-27T20:00:00.000Z' };
const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [],
  status: 'ready', stateReason: 'player_ready', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const due = (n, over = {}) => v(n, { status: 'review_due', stateReason: 'horizon_elapsed', stateSource: 'review_pass', ...DEPLOYED, ...over });
const answer = (versions, extra = {}) => ({
  watchlistId: 'wl-1', currentVersion: Math.max(...versions.map((x) => x.version)), versions: [...versions].sort((a, b) => b.version - a.version), research: [], ...extra,
});
const FROZEN_MANY = { battleId: 'battle-1', name: 'AI capex', tickers: ['NVDA', 'PLTR', 'AMD'] };
const FROZEN_ONE = { battleId: 'battle-1', name: 'Chips', tickers: ['NVDA'] };
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
async function mount(data) {
  svc.listHypothesisVersions.mockResolvedValue(data);
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
  await flush();
}
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
async function click(el) { await act(async () => { el.click(); }); await flush(); }

describe('B3 — the review lines name [SYM] or the FROZEN [LIST]', () => {
  it('[LIST], horizon elapsed: a multi-ticker frozen list, no conditions → the [LIST] row with the frozen name', async () => {
    await mount(answer([due(1)], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-lifecycle-line').textContent).toBe("Your AI capex idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
  });
  it('[SYM], horizon elapsed: a ONE-ticker frozen list → [SYM] is that ticker', async () => {
    await mount(answer([due(1)], { deployedLists: { 1: FROZEN_ONE } }));
    expect(q('idea-lifecycle-line').textContent).toBe("Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
  });
  it('[SYM] from the idea\'s OWN single-symbol conditions beats the frozen list; two condition symbols → [LIST]', async () => {
    await mount(answer([due(1, { activation: [cond('AMD')] })], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-lifecycle-line').textContent).toContain('Your AMD idea reached its time-frame');
    act(() => root.unmount());
    root = createRoot(container);
    await mount(answer([due(1, { activation: [cond('AMD'), cond('NVDA')] })], { deployedLists: { 1: FROZEN_ONE } }));
    expect(q('idea-lifecycle-line').textContent).toContain('Your Chips idea reached its time-frame');
  });
  it('battle ended, `unspecified`: [SYM] and [LIST] rows', async () => {
    const ended = (over) => due(1, { horizonEnum: 'unspecified', horizonSource: 'default', stateReason: 'battle_ended', reviewDueAt: null, ...over });
    await mount(answer([ended({})], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-lifecycle-line').textContent).toBe("The battle ended with your AI capex idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    act(() => root.unmount());
    root = createRoot(container);
    await mount(answer([ended({})], { deployedLists: { 1: FROZEN_ONE } }));
    expect(q('idea-lifecycle-line').textContent).toBe("The battle ended with your NVDA idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
  });
  it('no frozen list known (the server could not prove one) → the status chip alone, no line — never the live list', async () => {
    await mount(answer([due(1)], { deployedLists: {} }));
    expect(q('idea-lifecycle-line')).toBeNull();
    expect(q('idea-status').textContent).toBe(`v1 · ${STATUS_LABELS.review_due}`);
  });
  it('B5 — a clock-fallback version flagged at the battle\'s end (a swing idea, never open-ended) → no "open-ended" line', async () => {
    await mount(answer([due(1, { stateReason: 'battle_ended', reviewDueAt: null, reviewClockFault: 'calendar_unavailable' })], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-lifecycle-line')).toBeNull();
    expect(container.textContent).not.toContain('open-ended');
  });
});

describe('the running idea — an activated version that is not the current one', () => {
  it('shows its chip and its first-deploy / review-due dates (existing copy), beside the current draft', async () => {
    await mount(answer([v(1, { status: 'activated', stateReason: 'deployed', ...DEPLOYED }), v(2, { status: 'draft', stateReason: 'player_authored' })]));
    expect(q('idea-status').textContent).toBe(`v2 · ${STATUS_LABELS.draft}`);
    expect(q('idea-running').textContent).toContain(`v1 · ${STATUS_LABELS.activated}`);
    expect(q('idea-running-dates').textContent).toBe(`${PANEL_COPY.firstDeployed} Oct 13, 2026 · ${PANEL_COPY.reviewDue} Oct 27, 2026`);
  });
  it('the current version activated → the main block already says so (no second block); a B5 version shows no due date', async () => {
    await mount(answer([v(1, { status: 'activated', stateReason: 'deployed', ...DEPLOYED, reviewDueAt: null, reviewClockFault: 'calendar_unavailable' })]));
    expect(q('idea-running')).toBeNull();
    expect(q('idea-status').textContent).toBe(`v1 · ${STATUS_LABELS.activated}`);
    expect(q('idea-dates').textContent).toContain(`${PANEL_COPY.firstDeployed} Oct 13, 2026`);
    expect(q('idea-dates').textContent).not.toContain(PANEL_COPY.reviewDue);
  });
});

describe('B4 — a superseded due version is offered Reaffirm exactly when every newer version is pre-deploy', () => {
  it('due v1, current draft v2 → the due block shows v1\'s line and a Reaffirm that targets v1 on the CURRENT pointer', async () => {
    svc.reaffirmHypothesis.mockResolvedValue({});
    await mount(answer([due(1), v(2, { status: 'draft', stateReason: 'player_authored' })], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-superseded-due')).not.toBeNull();
    expect(q('idea-superseded-line').textContent).toContain('Your AI capex idea reached its time-frame');
    await click(button(`${ACTION_LABELS.reaffirm} v1`));
    expect(q('idea-editor')).not.toBeNull();
    await click(button(ACTION_LABELS.reaffirm));
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, opId: 'op-fixed', expectedVersion: 2 });
  });
  for (const blocker of ['activated', 'invalidated', 'retired']) {
    it(`a newer ${blocker} version blocks it → no due block, no Reaffirm`, async () => {
      await mount(answer([due(1), v(2, { status: blocker, stateReason: 'x' })]));
      expect(q('idea-superseded-due')).toBeNull();
      expect(button(`${ACTION_LABELS.reaffirm} v1`)).toBeUndefined();
    });
  }
  it('rejected and cancelled newer versions are pre-deploy terminals — they do not block', async () => {
    await mount(answer([due(1), v(2, { status: 'rejected', stateReason: 'player_rejected' }), v(3, { status: 'cancelled', stateReason: 'player_cancelled' })]));
    expect(q('idea-superseded-due')).not.toBeNull();
  });
  it('the history rows never offer Reaffirm (closing moves only)', async () => {
    await mount(answer([due(1), v(2, { status: 'draft', stateReason: 'player_authored' })]));
    expect(q('idea-history-v1').textContent).not.toContain(ACTION_LABELS.reaffirm);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// The BUILD_RULES §2 mutation lens (L5, the panel): each row below kills a mutant that survived
// the first pass; the mutant ids are the lens's (review report §9.2).

describe('mutation lens rows — the panel (P01, P07, P13)', () => {
  it('P07 — Reaffirm v1 opens the editor on v1\'s statement, not the current draft\'s', async () => {
    await mount(answer([due(1), v(2, { status: 'draft', stateReason: 'player_authored' })], { deployedLists: { 1: FROZEN_MANY } }));
    await click(button(`${ACTION_LABELS.reaffirm} v1`));
    expect(q('idea-editor').querySelector('textarea').value).toBe('Idea number 1');
  });
  it('P01 — a CURRENT due version shows no superseded block (one Reaffirm)', async () => {
    await mount(answer([due(1)], { deployedLists: { 1: FROZEN_MANY } }));
    expect(q('idea-superseded-due')).toBeNull();
  });
  it('P13 — two due versions under a draft: the NEWEST due one is offered', async () => {
    await mount(answer([due(1), due(2), v(3, { status: 'draft', stateReason: 'player_authored' })]));
    expect(button(`${ACTION_LABELS.reaffirm} v2`)).toBeDefined();
  });
});
