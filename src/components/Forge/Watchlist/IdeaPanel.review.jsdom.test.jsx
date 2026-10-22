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
    // One of the list's two names priced: the figure says so (review L4-3).
    expect(q('idea-review-list').textContent).toBe('AI capex +10.00% · 1 of 2');
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
  it('evidence still settling (pending): the window and the battles — no numbers, and no honest line (it says the card shows how the names did — review L4-9)', async () => {
    await mount(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]), { ...REVIEW, evidence: null, pending: 'awaiting_close', difference: null });
    expect(q('idea-review-card')).not.toBeNull();
    expect(q('idea-review-window')).not.toBeNull();
    expect(q('idea-review-row')).toBeNull();
    expect(q('idea-review-names-toggle')).toBeNull();
    expect(q('idea-review-battles')).not.toBeNull();
    expect(q('idea-review-honest')).toBeNull();
  });
  it('another request is still computing the evidence: the panel asks again, 5 s later, and the card fills in (review L4-9)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]));
      svc.getHypothesisReview.mockReset();
      svc.getHypothesisReview.mockResolvedValueOnce({ ...REVIEW, evidence: null, pending: 'computing', difference: null }).mockResolvedValue(REVIEW);
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(1);
      expect(q('idea-review-row')).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      await flush();
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(2);
      expect(q('idea-review-row')).not.toBeNull();
      expect(q('idea-review-honest')).not.toBeNull();
      // Settled: no further asking.
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
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
  it('a NON-current version the unwind returned to Ready says so on its own history row — B2 may carry it next (review L4-12 / L2-9)', async () => {
    await mount(answer([v(1, { status: 'ready', stateReason: 'deploy_voided' }), v(2, { status: 'draft', stateReason: 'player_created' })]));
    expect(q('idea-voided-line')).toBeNull(); // the current version (v2) is a draft
    expect(q('idea-voided-line-v1').textContent).toBe("That battle never ran, so your idea is back to Ready. Its clock hasn't started.");
    expect(q('idea-voided-line-v2')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BUILD_RULES §2 mutation lens L5c (the review card and the panel's review fetch): each row kills a
// mutant that survived the first pass; the ids are the lens's (RC = IdeaReviewCard.jsx, IP = IdeaPanel.jsx).

describe('mutation lens L5c rows — the card and the panel', () => {
  const dueV1 = () => v(1, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED });
  const computing = { ...REVIEW, evidence: null, pending: 'computing', difference: null };

  it('RC01 / RC02 / RC04 / RC06 / RC07 / RC17 — a list that lagged: minus signs kept, a flat SPY unsigned; closes as stored (4 significant figures under $1, 2 decimals from $1); the open toggle says so', async () => {
    const lagged = {
      ...REVIEW,
      evidence: {
        ...REVIEW.evidence,
        names: [
          { symbol: 'NVDA', status: 'ok', startClose: 0.1235, endClose: 0.1358, changePct: 9.96 },
          { symbol: 'AMD', status: 'ok', startClose: 1, endClose: 0.85, changePct: -15 },
        ],
        list: { status: 'ok', changePct: -2.52, counted: 2, total: 2 },
        market: { symbol: 'SPY', status: 'ok', startClose: 500, endClose: 500, changePct: 0 },
      },
      difference: -2.52,
    };
    await mount(answer([dueV1()]), lagged);
    expect(q('idea-review-list').textContent).toBe('AI capex -2.52%');
    expect(q('idea-review-market').textContent).toBe('SPY 0.00%');
    expect(q('idea-review-difference').textContent).toBe('Difference -2.52 pts');
    await click(q('idea-review-names-toggle'));
    expect(q('idea-review-names-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q('idea-review-name-NVDA').textContent).toBe('NVDA 0.1235 → 0.1358 · +9.96%');
    expect(q('idea-review-name-AMD').textContent).toBe('AMD 1.00 → 0.8500 · -15.00%');
  });

  it('RC10 / RC12 / RC13 — nothing priced: the list reads "No data" alone, SPY reads "No data", and there is no difference', async () => {
    const unpriced = {
      ...REVIEW,
      evidence: {
        ...REVIEW.evidence,
        names: [{ symbol: 'NVDA', status: 'unavailable', reason: 'fetch_failed' }, { symbol: 'AMD', status: 'unavailable', reason: 'no_end_close' }],
        list: { status: 'unavailable', reason: 'no_name_priced', counted: 0, total: 2 },
        market: { symbol: 'SPY', status: 'unavailable', reason: 'fetch_failed' },
      },
      difference: null,
    };
    await mount(answer([dueV1()]), unpriced);
    expect(q('idea-review-list').textContent).toBe('AI capex No data');
    expect(q('idea-review-market').textContent).toBe('SPY No data');
    expect(q('idea-review-difference')).toBeNull();
    expect(q('idea-review-honest').textContent).toBe(REVIEW.honestLine);
  });

  it('RC14 / RC26 — no frozen names: no "Each name" toggle; no battle the server vouches for: no battles line', async () => {
    const bare = {
      ...REVIEW,
      battles: [{ battleId: 'b-x', createdAt: null, endedAt: null, voided: false, known: false }],
      evidence: { ...REVIEW.evidence, names: [], list: { status: 'unavailable', reason: 'no_frozen_list', counted: 0, total: 0 } },
      difference: null,
    };
    await mount(answer([dueV1()]), bare);
    expect(q('idea-review-row')).not.toBeNull();
    expect(q('idea-review-names-toggle')).toBeNull();
    expect(q('idea-review-battles')).toBeNull();
  });

  it('IP02 — two reviewable versions: the card is the NEWEST one\'s', async () => {
    await mount(answer([v(1, { status: 'retired', stateReason: 'player_retired', ...DEPLOYED }), v(2, { status: 'review_due', stateReason: 'horizon_elapsed', ...DEPLOYED })]), { ...REVIEW, version: 2 });
    expect(svc.getHypothesisReview.mock.calls).toEqual([['wl-1', 2]]);
  });

  it('IP06 / IP09 — still computing after every re-ask: the panel asks 1 + 3 times, then stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.listHypothesisVersions.mockResolvedValue(answer([dueV1()]));
      svc.getHypothesisReview.mockResolvedValue(computing);
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      for (let i = 0; i < 6; i += 1) {
        await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
        await flush();
      }
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('IP07 — awaiting_close (hours away) is not re-asked', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.listHypothesisVersions.mockResolvedValue(answer([dueV1()]));
      svc.getHypothesisReview.mockResolvedValue({ ...REVIEW, evidence: null, pending: 'awaiting_close', difference: null });
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      await flush();
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('IP05 / IP11 — unmounted while computing: no request once the panel is gone (an answer still in flight, or a re-ask already scheduled)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.listHypothesisVersions.mockResolvedValue(answer([dueV1()]));
      // (a) the first answer arrives after the panel is gone
      let release;
      svc.getHypothesisReview.mockImplementationOnce(() => new Promise((r) => { release = r; })).mockResolvedValue(computing);
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      act(() => root.unmount());
      root = createRoot(container);
      await act(async () => { release(computing); });
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(1);
      // (b) the answer came, its re-ask is scheduled, then the panel goes
      svc.getHypothesisReview.mockReset();
      svc.getHypothesisReview.mockResolvedValue(computing);
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(1);
      act(() => root.unmount());
      root = createRoot(container);
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('IP12 — a re-ask that fails takes the card away (no stale pending card)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      svc.listHypothesisVersions.mockResolvedValue(answer([dueV1()]));
      svc.getHypothesisReview.mockResolvedValueOnce(computing).mockRejectedValue(Object.assign(new Error('unavailable'), { status: 503 }));
      await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
      await flush();
      expect(q('idea-review-card')).not.toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      await flush();
      expect(svc.getHypothesisReview).toHaveBeenCalledTimes(2);
      expect(q('idea-review-card')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('IP14 / IP16 — the card sits in the current version\'s own block, beside its statement, exactly once (no separate review block)', async () => {
    await mount(answer([dueV1()]));
    expect(container.querySelectorAll('[data-testid="idea-review-card"]')).toHaveLength(1);
    expect(q('idea-review-block')).toBeNull();
    expect(q('idea-statement').parentElement.contains(q('idea-review-card'))).toBe(true);
  });

  it('IP15 — a superseded due version\'s card sits in its due block (under its line, beside its Reaffirm), not in a separate block', async () => {
    await mount(answer([dueV1(), v(2, { status: 'draft', stateReason: 'player_authored' })]));
    expect(q('idea-superseded-due').contains(q('idea-review-card'))).toBe(true);
    expect(q('idea-review-block')).toBeNull();
  });

  it('IP03 / IP17 — a move that changes the reviewed version asks again, and the old answer is not shown meanwhile', async () => {
    svc.transitionHypothesis.mockResolvedValue({});
    await mount(answer([dueV1()]));
    expect(q('idea-review-card')).not.toBeNull();
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'retired', stateReason: 'player_retired', ...DEPLOYED })]));
    svc.getHypothesisReview.mockImplementation(() => new Promise(() => {})); // the new answer is still on its way
    const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
    await click(button('Retire'));
    await click(button('Confirm: Retire'));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'retire', expectedStatus: 'review_due' });
    expect(svc.getHypothesisReview).toHaveBeenCalledTimes(2);
    expect(q('idea-review-card')).toBeNull();
  });

  it('IP01 / IP04 — re-pointed at another list: the first list\'s card is never shown under the second while its answer is on the way', async () => {
    await mount(answer([dueV1()]));
    expect(q('idea-review-card')).not.toBeNull();
    svc.listHypothesisVersions.mockResolvedValue({ ...answer([dueV1()]), watchlistId: 'wl-2' });
    svc.getHypothesisReview.mockImplementation(() => new Promise(() => {}));
    await act(async () => { root.render(<IdeaPanel watchlistId="wl-2" tokens={DARK_TOKENS} />); });
    await flush();
    expect(svc.listHypothesisVersions).toHaveBeenLastCalledWith('wl-2');
    expect(q('idea-panel')).not.toBeNull();
    expect(q('idea-review-card')).toBeNull();
  });
});
