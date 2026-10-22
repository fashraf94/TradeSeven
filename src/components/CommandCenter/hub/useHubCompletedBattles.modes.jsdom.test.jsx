// @vitest-environment jsdom
//
// Command Center hub, slice S3 (ruling R-S3-6; spec V1.2 §6) — the coordinator
// over the REAL getReviewAvailability, unmodified, in each FILM_ROOM_V2_MODE:
//   off        the helper's legacy document branch: no read, no request;
//   on         zero admission requests, at most one final-day tape get per
//              eligible completed battle;
//   allowlist  one cached, definite owner verdict per page (in-flight
//              requests shared), then the tape get for an admitted owner.
// The helper and its gate run as shipped; only the network and the tape read
// are stubbed — the tape through the helper's own `readTape` seam, because
// under vitest the helper's lazy `import('firebase/firestore')` reaches the
// real SDK on some runs (the same limit App's poll meets). The hub's
// production call, getReviewAvailability(battle) and nothing else, is pinned in
// useHubCompletedBattles.jsdom.test.jsx. A completed record without a written
// close pass stays unavailable with the mode on.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_V2_MODE() { return flags.mode; },
}));
const id = vi.hoisted(() => ({ current: { resolved: true, uid: 'uid-A', authEpoch: 1 } }));
vi.mock('../../../services/authIdentity', () => ({ useAuthIdentity: () => id.current }));
const fb = vi.hoisted(() => ({ tapeReads: [], tapes: new Map(), window: [] }));
vi.mock('../../../services/completedAgentBattles', () => ({
  fetchRecentCompletedAgentBattles: vi.fn(async () => fb.window),
}));
vi.mock('../../../firebase/config', () => ({ db: { tag: 'db' }, auth: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'uid-A', getIdToken: async () => 'token' } }),
}));

import useHubCompletedBattles from './useHubCompletedBattles';
import { resetFilmRoomVerdicts } from '../../../utils/filmRoomGate';
import { getReviewAvailability } from '../../../utils/reviewAvailability';

/** The final-day tape read, at the helper's own seam: one recorded get per call. */
const readTape = async (battleId, etDate) => {
  const path = `agentBattles/${battleId}/tape/${etDate}`;
  fb.tapeReads.push(path);
  return fb.tapes.get(path) ?? null;
};
const SEAMS = Object.freeze({ checkReview: (b) => getReviewAvailability(b, { readTape }) });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Thu Oct 22 2026, 15:00 UTC: every pass for the Oct 19–20 games has run.
const T0 = Date.UTC(2026, 9, 22, 15, 0, 0);
const battle = (n, over = {}) => ({
  id: `done_${n}`,
  ownerId: 'uid-A',
  status: 'completed',
  gameMode: null,
  timing: { tradingDays: ['2026-10-19', '2026-10-20'] },
  completedAt: '2026-10-20T20:05:00.000Z',
  dailyReviews: [],
  reviewPending: false,
  ...over,
});
const WRITTEN = { passes: { close: { status: 'written' } } };

let host;
let root;
let seen;
let requests;
function Probe() {
  seen.push(useHubCompletedBattles(10, SEAMS));
  return null;
}
const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0); });
const states = () => Object.fromEntries(Object.entries(seen[seen.length - 1].reviews).map(([k, v]) => [k, v.state]));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  resetFilmRoomVerdicts();
  fb.tapeReads = [];
  fb.tapes = new Map();
  fb.window = [];
  seen = [];
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    requests.push(String(url));
    return { ok: true, json: async () => ({ allowlisted: true }) };
  }));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('FILM_ROOM_V2_MODE off — the helper\'s document branch', () => {
  it('ready from a recorded review, pending from the queue flag, unavailable otherwise: no tape read, no request', async () => {
    flags.mode = 'off';
    fb.window = [battle(1, { dailyReviews: [{ date: '2026-10-20' }] }), battle(2, { reviewPending: true }), battle(3)];
    act(() => { root.render(<Probe />); });
    await settle();
    expect(states()).toEqual({ done_1: 'ready', done_2: 'pending', done_3: 'unavailable' });
    expect(fb.tapeReads).toEqual([]);
    expect(requests).toEqual([]);
  });
});

describe('FILM_ROOM_V2_MODE on — Stage 3', () => {
  it('ready from a written close pass; a completed record without one stays unavailable; one tape get per battle, no admission request', async () => {
    flags.mode = 'on';
    fb.window = [battle(1), battle(2), battle(3, { dailyReviews: [{ date: '2026-10-20' }] })];
    fb.tapes.set('agentBattles/done_1/tape/2026-10-20', WRITTEN);
    fb.tapes.set('agentBattles/done_3/tape/2026-10-20', { passes: { close: { status: 'failed' } } });
    act(() => { root.render(<Probe />); });
    await settle();
    expect(states()).toEqual({ done_1: 'ready', done_2: 'unavailable', done_3: 'unavailable' });
    expect(fb.tapeReads.sort()).toEqual(['agentBattles/done_1/tape/2026-10-20', 'agentBattles/done_2/tape/2026-10-20', 'agentBattles/done_3/tape/2026-10-20']);
    expect(requests).toEqual([]);
    expect(seen[seen.length - 1].reviews.done_1.result).toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
  });
});

describe('FILM_ROOM_V2_MODE allowlist — one cached owner verdict per page', () => {
  it('an admitted owner: one verdict request for all three battles, then each one\'s tape get', async () => {
    flags.mode = 'allowlist';
    fb.window = [battle(1), battle(2), battle(3)];
    fb.tapes.set('agentBattles/done_2/tape/2026-10-20', WRITTEN);
    act(() => { root.render(<Probe />); });
    await settle();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^\/api\/agent\/cockpit-status\?battleId=done_\d$/);
    expect(states()).toEqual({ done_1: 'unavailable', done_2: 'ready', done_3: 'unavailable' });
    expect(fb.tapeReads).toHaveLength(3);
  });

  it('an owner the server does not admit: the legacy document branch, no tape read', async () => {
    flags.mode = 'allowlist';
    vi.stubGlobal('fetch', vi.fn(async (url) => { requests.push(String(url)); return { ok: true, json: async () => ({ allowlisted: false }) }; }));
    fb.window = [battle(1, { dailyReviews: [{ date: 'd' }] }), battle(2)];
    act(() => { root.render(<Probe />); });
    await settle();
    expect(requests).toHaveLength(1);
    expect(states()).toEqual({ done_1: 'ready', done_2: 'unavailable' });
    expect(fb.tapeReads).toEqual([]);
  });
});
