// @vitest-environment jsdom
//
// The Command Center S8 fix build — one rule per fact on the CONNECTED hub (the S8 review's lens Q5 rows, gone with
// its snapshot, rebuilt here on slice S3's harness: the identity, the owner-tagged agent and the ten-game window are
// driven; App's poll arrives through `hub` as App sends it; the market's state is the row's).
//
//   R-S8F-7 (S8-2, K-1)  one count of live games, read by the Games header and Shadow's status line: "N live" counts the
//                        games that have opened; a list all waiting for the open says so; every opened game past its end
//                        time is the strip's "Live · ending" on the status line, never "in progress".

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const r = vi.hoisted(() => ({
  identity: { resolved: true, uid: 'uid-A', authEpoch: 2 },
  agent: null,
  window: null,
  market: { state: 'OPEN', isOpen: true },
}));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Tuesday, Oct 27, 2026, 11:00 AM ET (15:00 UTC).
const NOW = Date.UTC(2026, 9, 27, 15, 0);
const UID = 'uid-A';
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });

/** A BaggerBomb game: `evaluationCount: 0` with the market closed is one deployed and waiting for the open. */
const bb = (id, over = {}) => ({
  id, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: '2026-10-27T13:30:00Z', expiresAt: '2026-10-27T20:00:00Z',
  scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 }, ...over,
});
const WAITING = { currentScore: 0, tradeCount: 0, evaluationCount: 0 };
const done = (n, over = {}) => ({
  id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
  completedAt: `2026-10-${String(26 - n).padStart(2, '0')}T20:05:00.000Z`,
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: '2026-10-20T19:58:00.000Z' },
  statusFeed: [{ action: 'battle_complete' }],
  ...over,
});
const THREE = [done(1), done(2), done(3)];
const agentReady = () => ({ status: 'ready', agent: { id: 'agent-a', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = (battles, over = {}) => ({
  battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1,
  reviews: Object.fromEntries((battles || []).map((b) => [b.id, { state: 'ready', result: READY, nextAt: null }])),
  checking: false, refreshing: false, nextAttemptAt: null, refresh: vi.fn(), ...over,
});
const pollMeta = (over = {}) => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false, ...over });
const hubOf = (over = {}) => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), ...over });

let layout;
let removeTokens;
let removeNav;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf(THREE);
  r.market = { state: 'OPEN', isOpen: true };
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  vi.useRealTimers();
});

function render(site, hub, width = site === 'mobile' ? 390 : 1216) {
  layout.state.hubWidth = width;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  return m;
}
const games = () => document.querySelector('[data-hub-section="games"]');
/** The Games section's header row: its label, its count tag and the History link. */
const gamesHeader = () => games().firstElementChild;
const statusLine = () => document.querySelector('[data-hub-status]');
const strip = () => document.querySelector('[data-hub-strip]');

describe('R-S8F-7 — one count of live games for the Games header and the status line (S8-2, K-1)', () => {
  it.each([[1216], [800], [600]])('desktop site at %ipx — a game deployed after hours, waiting for the open: the header says so, never "1 live"', (width) => {
    r.market = { state: 'CLOSED', isOpen: false };
    render('desktop', hubOf({ activeBattles: [bb('bb_wait', { scoreState: WAITING })] }), width);
    expect(gamesHeader().textContent).not.toMatch(/\d+ live/);
    expect(gamesHeader().textContent).toContain(COPY.games.waitingForOpen);
    expect(statusLine().textContent).toBe(COPY.strip.deployed(COPY.games.waitingForOpen));
  });

  it('one opened and one waiting: the header counts the opened one alone, as the status line does', () => {
    r.market = { state: 'CLOSED', isOpen: false };
    render('desktop', hubOf({ activeBattles: [bb('bb_open'), bb('bb_wait', { activatedAt: '2026-10-27T13:40:00Z', scoreState: WAITING })] }));
    expect(gamesHeader().textContent).toContain(COPY.games.liveCount(1));
    expect(gamesHeader().textContent).not.toContain(COPY.games.liveCount(2));
    expect(statusLine().textContent).toBe(COPY.shadow.statusLiveOne);
  });

  it('an opened game past its end time (K-1): the status line says the strip\'s "Live · ending", never "in progress"', () => {
    render('desktop', hubOf({ activeBattles: [bb('bb_over', { expiresAt: '2026-10-27T14:00:00Z' })] }));
    expect(statusLine().textContent).toBe(COPY.strip.live(COPY.games.ending));
    expect(statusLine().textContent).not.toMatch(/in progress/);
    expect(games().textContent).toContain(COPY.strip.live(COPY.games.ending));
    expect(gamesHeader().textContent).toContain(COPY.games.liveCount(1));
  });

  it('the phone strip and the status line agree on the same game past its end', () => {
    render('mobile', hubOf({ activeBattles: [bb('bb_over', { expiresAt: '2026-10-27T14:00:00Z' })] }));
    expect(strip().textContent).toContain(COPY.strip.live(COPY.games.ending));
    expect(statusLine().textContent).toBe(COPY.strip.live(COPY.games.ending));
  });

  it('one opened game still running beside one past its end: "in progress" — the line says "ending" only when every opened game is', () => {
    render('desktop', hubOf({ activeBattles: [bb('bb_over', { expiresAt: '2026-10-27T14:00:00Z' }), bb('bb_run', { activatedAt: '2026-10-27T13:40:00Z' })] }));
    expect(statusLine().textContent).toBe(COPY.shadow.statusLiveMany(2));
  });
});
