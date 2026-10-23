// @vitest-environment jsdom
//
// Command Center hub, slice S3 (rulings R-S3-5, R-S3-6, R-S3-9; spec V1.2 §6 "show retained as-of data and refreshing/queued
// state accurately") — the scheduler's state as the Games section receives it, end to end (review T5-4). Every UI row of the
// connected hub replaces useHubCompletedBattles with a hand-built window, so the flags the display reads (`refreshing`,
// `nextAttemptAt`) were never produced by the real scheduler and carried by the real hook and useHubReaders in one run.
// Here only the I/O is stubbed — the identity, the owner-tagged agent, the completed read, the review helper, the market —
// and the hook, the scheduler and useHubReaders are the real ones, under the fake clock.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const id = vi.hoisted(() => ({ current: { resolved: true, uid: 'uid-A', authEpoch: 2 } }));
vi.mock('../../../services/authIdentity', () => ({ useAuthIdentity: () => id.current }));
vi.mock('../../../hooks/useAgent', () => ({
  default: () => ({ status: 'ready', agent: { id: 'agent-a', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 2, readError: null, retry: () => {} }),
}));
const io = vi.hoisted(() => ({ reads: [], answer: null }));
vi.mock('../../../services/completedAgentBattles', () => ({
  fetchRecentCompletedAgentBattles: vi.fn(async (uid, max) => { io.reads.push({ uid, max, at: Date.now() }); return io.answer(io.reads.length); }),
}));
vi.mock('../../../utils/reviewAvailability', () => ({
  getReviewAvailability: vi.fn(async () => ({ ready: true, target: 'filmRoom', availability: 'ready' })),
}));
vi.mock('../../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));

import useHubReaders from './useHubReaders';
import { resetHubLedgersForTests } from './useHubCompletedBattles';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const T0 = Date.UTC(2026, 9, 22, 15, 0, 0);
const S = 1000;
const UID = 'uid-A';

const done = (n) => ({
  id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
  completedAt: `2026-10-${String(21 - n).padStart(2, '0')}T20:05:00.000Z`,
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: '2026-10-20T19:58:00.000Z' },
  statusFeed: [{ action: 'battle_complete' }],
});
const TEN = Array.from({ length: 10 }, (_, i) => done(i + 1));
const HUB = Object.freeze({
  activeBattles: [],
  activePoll: { epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: T0, error: null, refreshing: false },
  refreshActiveBattles: () => {},
  openGame: () => {},
  openFilmRoom: () => {},
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

beforeEach(() => {
  resetHubLedgersForTests();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  id.current = { resolved: true, uid: UID, authEpoch: 2 };
  io.reads = [];
  io.answer = async () => TEN;
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

describe('the Games section receives the real scheduler\'s state (review T5-4)', () => {
  it('a retained window whose next read failed keeps when the next attempt is; the read that follows is published as refreshing', async () => {
    // Read 1 answers (0 s, every review ready, so nothing is scheduled). Window focus at 130 s asks for read 2, which fails:
    // its one automatic retry is queued for 250 s. At 250 s that retry is out and slow.
    io.answer = (n) => {
      if (n === 1) return Promise.resolve(TEN);
      if (n === 2) return Promise.reject(new Error('unavailable'));
      return new Promise(() => {});
    };
    act(() => { root.render(<Probe />); });
    await advance(1 * S);
    // The hook, the scheduler and the section are the real ones: the read was made, and its ten rows are the section's.
    expect(io.reads.map(({ uid, max }) => [uid, max])).toEqual([[UID, 10]]);
    expect(last().sections.games).toMatchObject({ status: 'ready', stale: false, refreshing: false, nextAttemptAt: null, asOf: T0 });
    expect(last().sections.games.rows).toHaveLength(10);

    await advance(129 * S);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await advance(0);
    expect(io.reads).toHaveLength(2);
    expect(last().sections.games).toMatchObject({ status: 'ready', stale: true, refreshing: false, asOf: T0, nextAttemptAt: T0 + 250 * S });

    await advance(120 * S);
    expect(io.reads).toHaveLength(3);
    expect(last().sections.games).toMatchObject({ status: 'ready', stale: true, refreshing: true, asOf: T0 });
  });
});
