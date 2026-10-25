// @vitest-environment jsdom
//
// Command Center hub, slice S4 (R-S4-5, R-S4-6, R-S4-7; Amendment B) — the readers end to end, with the REAL hook and scheduler
// under a fake clock and only the I/O stubbed (the identity, the owner-tagged agent, the completed read, the review helper, the
// market, the brief): History's Refresh shares the rolling budget, and a quick return from the Film Room shows the games and an
// openable tape at once — the founder's smoke check, as rows.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const id = vi.hoisted(() => ({ current: { resolved: true, uid: 'uid-A', authEpoch: 2 } }));
const ag = vi.hoisted(() => ({ directives: undefined }));
vi.mock('../../../services/authIdentity', () => ({ useAuthIdentity: () => id.current }));
vi.mock('../../../hooks/useAgent', () => ({
  default: () => ({ status: 'ready', agent: { id: 'agent-a', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 2, readError: null, retry: () => {}, activeDirectives: ag.directives }),
}));
const io = vi.hoisted(() => ({ reads: [], checks: [], answer: null, check: null }));
vi.mock('../../../services/completedAgentBattles', () => ({
  fetchRecentCompletedAgentBattles: vi.fn(async (uid, max) => { io.reads.push({ uid, max, at: Date.now() }); return io.answer(io.reads.length); }),
}));
vi.mock('../../../utils/reviewAvailability', () => ({
  getReviewAvailability: vi.fn(async (battle) => { io.checks.push(battle.id); return io.check(battle); }),
}));
vi.mock('../../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTime } from './hubDate';
import useHubReaders from './useHubReaders';
import { resetHubLedgersForTests } from './useHubCompletedBattles';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const T0 = Date.UTC(2026, 9, 23, 15, 0, 0);
const S = 1000;
const UID = 'uid-A';
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });

const done = (n) => {
  const completed = Date.UTC(2026, 9, 22 - n, 20, 5);
  return {
    id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
    activatedAt: new Date(completed - 6 * 3600 * 1000).toISOString(), completedAt: new Date(completed).toISOString(),
    scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: new Date(completed - 120000).toISOString() },
    statusFeed: [{ action: 'battle_complete' }],
  };
};
const TEN = Array.from({ length: 10 }, (_, i) => done(i + 1));
const openGame = vi.fn();
const openFilmRoom = vi.fn();
const HUB = Object.freeze({
  activeBattles: [],
  activePoll: { epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: T0, error: null, refreshing: false },
  refreshActiveBattles: () => {},
  openGame,
  openFilmRoom,
});

let host;
let root;
let seen;
function Probe() {
  seen.push(useHubReaders(HUB));
  return null;
}
const last = () => seen[seen.length - 1];
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const mountProbe = () => { act(() => { root.render(<Probe />); }); };
const remount = () => {
  act(() => root.unmount());
  root = createRoot(host);
  seen = [];
};

beforeEach(() => {
  resetHubLedgersForTests();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  id.current = { resolved: true, uid: UID, authEpoch: 2 };
  io.reads = [];
  io.checks = [];
  io.answer = async () => TEN;
  io.check = async () => READY;
  openGame.mockClear();
  openFilmRoom.mockClear();
  seen = [];
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('History\'s Refresh shares the rolling budget (R-S4-5)', () => {
  it('inside the 120 s window it queues one read at the permitted time and publishes when, instead of reading; at that time it reads once', async () => {
    mountProbe();
    await advance(1 * S);
    expect(io.reads).toHaveLength(1);
    await advance(29 * S);
    act(() => last().actions.refreshHistory());
    await advance(1 * S);
    expect(io.reads, 'no read inside the window').toHaveLength(1);
    expect(last().sections.games.nextAttemptAt).toBe(T0 + 120 * S);
    // ...and what the sheet would say about it:
    expect(COPY.history.nextRefresh(COPY.time.et(formatHubTime(T0 + 120 * S, { roundUp: true })))).toMatch(/^Next refresh at 11:02\s?AM ET$/);
    // A second press changes nothing: one queued cycle.
    act(() => last().actions.refreshHistory());
    await advance(1 * S);
    expect(io.reads).toHaveLength(1);
    await advance(89 * S + 100);
    expect(io.reads.map((read) => read.at - T0)).toEqual([0, 120 * S]);
    expect(last().sections.games.nextAttemptAt).toBeNull();
  });

  it('with the budget free it reads at once, and says it is refreshing meanwhile', async () => {
    let release;
    mountProbe();
    await advance(1 * S);
    io.answer = (n) => (n === 2 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(TEN));
    await advance(130 * S);
    act(() => last().actions.refreshHistory());
    await advance(0);
    expect(io.reads).toHaveLength(2);
    expect(last().sections.games).toMatchObject({ refreshing: true, status: 'ready' });
    await act(async () => { release(TEN); await vi.advanceTimersByTimeAsync(0); });
    expect(last().sections.games.refreshing).toBe(false);
  });

  it('its trigger is the explicit one the scheduler already honours: it is not turned away by the focus rule (a cycle under 120 s old)', async () => {
    mountProbe();
    await advance(1 * S);
    // A focus 30 s in is ignored (the last cycle is under 120 s old); a Refresh in the same place is not — it queues.
    await advance(29 * S);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await advance(1 * S);
    expect(last().sections.games.nextAttemptAt).toBeNull();
    act(() => last().actions.refreshHistory());
    await advance(1 * S);
    expect(last().sections.games.nextAttemptAt).toBe(T0 + 120 * S);
  });
});

describe('a quick return shows the games and an openable tape at once (R-S4-6, R-S4-7; the smoke check)', () => {
  it('the first frame of the return: the rows "as of" their read, every tape openable, the next action the newest review — and nothing was read', async () => {
    mountProbe();
    await advance(1 * S);
    const readsBefore = io.reads.length;
    const checksBefore = io.checks.length;
    remount();
    await advance(20 * S);
    mountProbe();
    const first = seen[0];
    expect(first.sections.games).toMatchObject({ status: 'ready', carried: true, asOf: T0 });
    expect(first.sections.games.rows).toHaveLength(10);
    expect(first.sections.games.rows.every((row) => row.reviewLine.openable)).toBe(true);
    expect(first.sections.nextAction.candidate).toMatchObject({ key: 'review', id: 'done_01' });
    // Activity's inputs: the kept window's ten documents, with the age they stand on (the runtime finishes the list with the Loadout).
    expect(first.sections.activityInputs.battles).toHaveLength(10);
    expect(first.sections.activityInputs.windowAge).toMatchObject({ carried: true, stale: false, asOf: T0 });
    // "Open battle tape" opens the Film Room straight away, through the helper's own answer.
    act(() => first.actions.openTape({ id: 'done_03' }));
    expect(openFilmRoom).toHaveBeenCalledTimes(1);
    expect(openFilmRoom.mock.calls[0][0]).toBe(TEN[2]);
    // And the card's own action goes through the same lookup.
    act(() => first.actions.nextAction());
    expect(openFilmRoom.mock.calls[1][0]).toBe(TEN[0]);
    await advance(1 * S);
    expect(io.reads, 'a return inside the window reads nothing').toHaveLength(readsBefore);
    expect(io.checks, 'and asks no review again').toHaveLength(checksBefore);
  });

  it('a review that was still pending is not an openable tape on the return, and is not the next action', async () => {
    io.check = async (battle) => (battle.id === 'done_01' ? PENDING : READY);
    mountProbe();
    await advance(1 * S);
    remount();
    await advance(20 * S);
    mountProbe();
    const first = seen[0];
    const row = first.sections.games.rows.find((r) => r.id === 'done_01');
    expect(row.reviewLine.openable).toBe(false);
    expect(first.sections.nextAction.candidate).toMatchObject({ key: 'review', id: 'done_02' });
    act(() => first.actions.openTape({ id: 'done_01' }));
    expect(openFilmRoom).not.toHaveBeenCalled();
  });

  it('a hub that unmounted while its first read was out: the return shows the read that landed, with no tape claimed it does not have', async () => {
    let release;
    io.answer = (n) => (n === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(TEN));
    mountProbe();
    await advance(500);
    remount();
    await act(async () => { release(TEN); await vi.advanceTimersByTimeAsync(0); });
    await advance(5 * S);
    mountProbe();
    const first = seen[0];
    expect(first.sections.games).toMatchObject({ status: 'ready', carried: true });
    expect(first.sections.games.rows).toHaveLength(10);
    // Its reviews were never asked (the hub was gone): queued, not openable, and not offered.
    expect(first.sections.games.rows.some((row) => row.reviewLine.openable)).toBe(false);
    expect(first.sections.nextAction.candidate).toBeNull();
    expect(first.sections.activityInputs.battles).toHaveLength(10);
    expect(io.reads).toHaveLength(1);
  });
});

// ── The merge with S2b (merge round, Oct 24, 2026): the readers hand the deploy provider what only they hold ──────────────────────
describe('the readers hand S2b\'s provider the owned live set and the ceremony\'s directive count (merge of S4 into S2b\'s ConnectedHub)', () => {
  const LIVE_DOC = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: new Date(T0 - 2 * 3600 * 1000).toISOString(), expiresAt: new Date(T0 + 3 * 3600 * 1000).toISOString(), scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } };
  const OTHER_DOC = { ...LIVE_DOC, id: 'bb_other', ownerId: 'uid-B' };
  let hubWith;
  function LiveProbe() {
    seen.push(useHubReaders(hubWith));
    return null;
  }

  afterEach(() => { ag.directives = undefined; });

  it('`liveBattles` is the owner\'s own documents from the poll\'s list, and only those', async () => {
    hubWith = { ...HUB, activeBattles: [LIVE_DOC, OTHER_DOC] };
    act(() => { root.render(<LiveProbe />); });
    await advance(1 * S);
    expect(last().liveBattles.map((b) => b.id)).toEqual(['bb_live']);
    expect(last().sections.games.live.map((g) => g.id)).toEqual(['bb_live']);
  });

  it('with no live game the set is empty, not absent', async () => {
    hubWith = { ...HUB, activeBattles: [] };
    act(() => { root.render(<LiveProbe />); });
    await advance(1 * S);
    expect(last().liveBattles).toEqual([]);
  });

  it('`ceremonyAgent.directiveCount` counts the agent\'s active directives, and is 0 when it has none or the read has no list', async () => {
    hubWith = { ...HUB };
    ag.directives = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
    act(() => { root.render(<LiveProbe />); });
    await advance(1 * S);
    expect(last().ceremonyAgent).toEqual({ directiveCount: 3 });
    expect(Object.isFrozen(last().ceremonyAgent)).toBe(true);
    ag.directives = undefined;
    remount();
    act(() => { root.render(<LiveProbe />); });
    await advance(1 * S);
    expect(last().ceremonyAgent).toEqual({ directiveCount: 0 });
  });

  it('S4\'s sections and actions ride in the same return (nothing of either slice was lost in the merge)', async () => {
    hubWith = { ...HUB };
    act(() => { root.render(<LiveProbe />); });
    await advance(1 * S);
    expect(Object.keys(last().sections).sort()).toEqual(['activityInputs', 'brief', 'deploy', 'games', 'nextAction']);
    for (const key of ['openGame', 'openTape', 'refreshHistory', 'nextAction', 'laterNextAction', 'retryBrief', 'openActivity', 'deployAction', 'retryGames']) {
      expect(Object.keys(last().actions), key).toContain(key);
    }
    expect(last().inputs.auth).toMatchObject({ signedIn: true, uid: UID });
    expect(last().agent).toBeTruthy();
  });
});
