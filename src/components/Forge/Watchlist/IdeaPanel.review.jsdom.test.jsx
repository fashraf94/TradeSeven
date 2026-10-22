// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.review.jsdom.test.jsx
//
// Pilot P1c — the Idea panel's review card (founder ruling E2) and the void
// line (ruling E3), on the client (acceptance rows 3 and 4):
//   · the newest deployed version in a reviewable state (review_due, or
//     retired after a deploy — the founder's retired v1) gets the card, under
//     its review line: the window, ONE row of list against market and the
//     difference (the server's numbers), the per-name table collapsed, the
//     carrying battles as links (voided ones marked), the honest line;
//   · a version that never deployed asks for nothing; a refused review shows
//     nothing; a pending one shows the window, the battles and the line only;
//   · a battle link reads the owner's battle and asks App for its Film Room;
//   · a version the review pass returned to Ready says so (table C V1.2).

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
  getHypothesisReview: vi.fn(),
}));
vi.mock('../../../services/hypothesisVersionService', () => svc);
const battleRead = vi.hoisted(() => ({ readCarryingBattle: vi.fn() }));
vi.mock('../../../services/carryingBattleRead', () => battleRead);

import IdeaPanel from './IdeaPanel';
import { DARK_TOKENS } from '../../../theme/tokens';
import { OPEN_BATTLE_REVIEW_EVENT } from './ideaNavigation';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root; let opened;
const onOpen = (e) => { opened.push(e.detail.battle); };
beforeEach(() => {
  state.on = true;
  for (const fn of Object.values(svc)) fn.mockReset?.();
  battleRead.readCarryingBattle.mockReset();
  svc.newOpId.mockImplementation(() => 'op-fixed');
  opened = [];
  window.addEventListener(OPEN_BATTLE_REVIEW_EVENT, onOpen);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  window.removeEventListener(OPEN_BATTLE_REVIEW_EVENT, onOpen);
  act(() => root.unmount());
  container.remove();
});

const DEPLOYED = { firstDeployedAt: '2026-10-13T17:21:40.668Z', lastDeployedAt: '2026-10-14T15:38:00.000Z', lastDeployedBattleId: 'b-2', reviewDueAt: '2026-10-15T20:00:00.000Z' };
const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'intraday', horizonSource: 'parse', activation: [], invalidation: [],
  status: 'ready', stateReason: 'player_ready', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const answer = (versions, extra = {}) => ({
  watchlistId: 'wl-1', currentVersion: Math.max(...versions.map((x) => x.version)), versions: [...versions].sort((a, b) => b.version - a.version), research: [], ...extra,
});
const REVIEW = {
  watchlistId: 'wl-1', version: 1, status: 'review_due',
  window: { kind: 'timed', start: { etDate: '2026-10-12', closeAt: '2026-10-12T20:00:00.000Z' }, end: { etDate: '2026-10-15', closeAt: '2026-10-15T20:00:00.000Z' }, empty: false },
  battles: [
    { battleId: 'b-1', createdAt: '2026-10-13T17:21:40.668Z', endedAt: '2026-10-14T00:00:00.000Z', voided: false, known: true },
    { battleId: 'b-2', createdAt: '2026-10-14T15:38:00.000Z', endedAt: '2026-10-14T20:55:26.000Z', voided: true, known: true },
    { battleId: 'b-x', createdAt: null, endedAt: null, voided: false, known: false },
  ],
  listName: 'AI capex', agentName: 'Shadow',
  honestLine: "Shadow doesn't act on your ideas yet. This shows how the names did over the idea's time-frame — not what the agent did with it.",
  evidence: {
    computedAt: '2026-10-15T23:01:00.000Z', source: 'eodhd_daily',
    names: [
      { symbol: 'NVDA', status: 'ok', startClose: 100, endClose: 110, changePct: 10 },
      { symbol: 'AMD', status: 'unavailable', reason: 'no_end_close' },
    ],
    list: { status: 'ok', changePct: 10, counted: 1, total: 2 },
    market: { symbol: 'SPY', status: 'ok', startClose: 500, endClose: 505, changePct: 1 },
  },
  pending: null,
  difference: 9,
};
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => {}); };
async function mount(data, review = REVIEW) {
  svc.listHypothesisVersions.mockResolvedValue(data);
  if (review instanceof Error) svc.getHypothesisReview.mockRejectedValue(review);
  else svc.getHypothesisReview.mockResolvedValue(review);
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
  await flush();
}
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
async function click(el) { await act(async () => { el.click(); }); await flush(); }
// The battle read loads on the tap (a dynamic import): wait for it, bounded well inside the row's timeout.
async function until(pred) { for (let i = 0; i < 60 && !pred(); i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 25)); }); }

describe('the review card (E2)', () => {
  it('a review_due current version: the card under its review line — window, list vs SPY in one row, the difference, names collapsed, battles as links, the honest line', async () => {
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })], { deployedLists: { 1: { battleId: 'b-2', name: 'AI capex', tickers: ['NVDA', 'AMD'] } } }));
    expect(svc.getHypothesisReview).toHaveBeenCalledWith('wl-1', 1);
    const card = q('idea-review-card');
    expect(card).not.toBeNull();
    // Under the review line, inside the current version's block.
    const line = q('idea-lifecycle-line');
    expect(line.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(q('idea-review-window').textContent).toBe('Oct 12, 2026 → Oct 15, 2026');
    expect(q('idea-review-list').textContent).toBe('AI capex +10.00%');
    expect(q('idea-review-market').textContent).toBe('SPY +1.00%');
    expect(q('idea-review-difference').textContent).toBe('Difference +9.00 pts');
    expect(q('idea-review-names')).toBeNull(); // collapsed
    await click(q('idea-review-names-toggle'));
    expect(q('idea-review-name-NVDA').textContent).toBe('NVDA 100.00 → 110.00 · +10.00%');
    expect(q('idea-review-name-AMD').textContent).toBe('AMD · No data');
    expect(q('idea-review-battle-b-1').textContent).toBe('Oct 13, 2026');
    expect(q('idea-review-battle-b-2').textContent).toBe('Oct 14, 2026 · voided');
    expect(q('idea-review-battle-b-x')).toBeNull(); // a battle the server could not vouch for is not offered
    expect(q('idea-review-honest').textContent).toBe(REVIEW.honestLine);
  });
  it('a RETIRED version that had a deploy (the founder\'s v1) gets its card too', async () => {
    await mount(answer([v(1, { status: 'retired', stateReason: 'player_retired', ...DEPLOYED })]), { ...REVIEW, status: 'retired' });
    expect(svc.getHypothesisReview).toHaveBeenCalledWith('wl-1', 1);
    expect(q('idea-review-card')).not.toBeNull();
  });
  it('a superseded reviewable version shows its card in its own block, under its chip', async () => {
    await mount(answer([v(1, { status: 'retired', stateReason: 'player_retired', ...DEPLOYED }), v(2, { status: 'ready' })]), { ...REVIEW, status: 'retired' });
    expect(q('idea-review-block').textContent).toContain('v1 · Retired');
    expect(q('idea-review-block').querySelector('[data-testid="idea-review-card"]')).not.toBeNull();
  });
  it('NO request for a version that never deployed (a retired draft, a ready idea)', async () => {
    await mount(answer([v(1, { status: 'retired' }), v(2, { status: 'ready' })]));
    expect(svc.getHypothesisReview).not.toHaveBeenCalled();
    expect(q('idea-review-card')).toBeNull();
  });
  it('a refused review (the window not closed yet, 409) shows nothing', async () => {
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]), Object.assign(new Error('x'), { status: 409, code: 'review_window_open' }));
    expect(q('idea-review-card')).toBeNull();
  });
  it('evidence still settling (pending): the window, the battles and the line — no numbers', async () => {
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]), { ...REVIEW, evidence: null, pending: 'awaiting_close', difference: null });
    expect(q('idea-review-card')).not.toBeNull();
    expect(q('idea-review-row')).toBeNull();
    expect(q('idea-review-names-toggle')).toBeNull();
    expect(q('idea-review-battles')).not.toBeNull();
    expect(q('idea-review-honest')).not.toBeNull();
  });
  it('a battle link reads the owner\'s battle and asks App for its Film Room (OPEN_BATTLE_REVIEW_EVENT)', async () => {
    battleRead.readCarryingBattle.mockResolvedValue({ id: 'b-2', ownerId: 'me', status: 'completed' });
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]));
    await click(q('idea-review-battle-b-2'));
    await until(() => opened.length > 0);
    expect(battleRead.readCarryingBattle).toHaveBeenCalledWith('b-2');
    expect(opened).toEqual([{ id: 'b-2', ownerId: 'me', status: 'completed' }]);
  });
  it('a battle that cannot be read opens nothing', async () => {
    battleRead.readCarryingBattle.mockResolvedValue(null);
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]));
    await click(q('idea-review-battle-b-1'));
    await until(() => battleRead.readCarryingBattle.mock.calls.length > 0);
    await flush();
    expect(battleRead.readCarryingBattle).toHaveBeenCalledWith('b-1');
    expect(opened).toEqual([]);
  });
  it('flag off → no panel and no review request', async () => {
    state.on = false;
    await mount(answer([v(1, { status: 'review_due', ...DEPLOYED })]));
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
    expect(svc.getHypothesisReview).not.toHaveBeenCalled();
  });
});

describe('the void line (E3)', () => {
  it('a version the review pass returned to Ready because its only carrying battle never ran says so, under its status', async () => {
    await mount(answer([v(1, { status: 'ready', stateReason: 'deploy_voided' })]));
    expect(q('idea-voided-line').textContent).toBe("That battle never ran, so your idea is back to Ready. Its clock hasn't started.");
    expect(svc.getHypothesisReview).not.toHaveBeenCalled();
  });
  it('an ordinary ready version shows no such line', async () => {
    await mount(answer([v(1, { status: 'ready', stateReason: 'player_ready' })]));
    expect(q('idea-voided-line')).toBeNull();
  });
});
