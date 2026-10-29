// @vitest-environment jsdom
//
// The Command Center S8 fix build — one rule per fact on the CONNECTED hub (the S8 review's lens Q5 rows, gone with
// its snapshot, rebuilt here on slice S3's harness: the identity, the owner-tagged agent and the ten-game window are
// driven; App's poll arrives through `hub` as App sends it; the market's state is the row's).
//
//   R-S8F-7 (S8-2, K-1)  one count of live games, read by the Games header and Shadow's status line: "N live" counts the
//                        games that have opened; a list all waiting for the open says so; every opened game past its end
//                        time is the strip's "Live · ending" on the status line, never "in progress".
//   R-S8F-8 (S8-3)       after a failed poll the retained live rows and the next action's live candidate say "As of
//                        {time} · couldn't refresh", from the Deploy card's own freshness.
//   R-S8F-9 (S8-4, K-9)  a date from another year carries its year (Games and History rows, the tape link, the next
//                        action's title); "ends" names its short day when the end is not today.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// The Daily Regime Brief's read (hooks/useDailyRegimeBrief.js) is not under test here. Left real it reaches Firestore (`db` is `{}`),
// fails, and its 1.5 s retry can outlive this file (the PR #1003 CI flake). `loading` is the state the real read held for those 1.5 s.
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
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

// The S8 review's S8-3 (ruling R-S8F-8; spec §3, "retained owned games show 'as of {time}' and the error"): after a
// failed poll, the Games live rows and the next action's live candidate say when the retained list was true — the Deploy
// card's own freshness, in the same words.
describe('R-S8F-8 — retained live rows carry their age after a failed poll (S8-3)', () => {
  const ASOF = NOW - 90 * 60000;
  const at = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(ASOF));
  const stale = () => hubOf({ activeBattles: [bb('bb_live')], activePoll: pollMeta({ status: 'error', error: new Error('poll failed'), lastSuccessfulAt: ASOF }) });
  const nextAction = () => document.querySelector('[data-hub-next-action]');

  it('desktop: the live row says "As of {time} · couldn\'t refresh", the card says the same time, and the next action carries it', () => {
    render('desktop', stale());
    const note = games().querySelector('[data-hub-games-live-note="stale"]');
    expect(note?.textContent).toBe(COPY.games.staleAsOf(COPY.time.et(at)));
    expect(document.querySelector('[data-hub-deploy]').textContent).toContain(`${at} ET`);
    expect(nextAction().textContent).toContain(COPY.games.staleAsOf(COPY.time.et(at)));
  });

  it('phone: no live rows of its own, so the next action carries the age; the strip says the same time', () => {
    render('mobile', stale());
    expect(nextAction().textContent).toContain(COPY.games.staleAsOf(COPY.time.et(at)));
    expect(strip().textContent).toContain(`${at} ET`);
  });

  it('a poll that answered: no age on the live rows or the next action', () => {
    render('desktop', hubOf({ activeBattles: [bb('bb_live')] }));
    expect(games().querySelector('[data-hub-games-live-note]')).toBeNull();
    expect(nextAction().textContent).not.toMatch(/couldn.t refresh/i);
  });
});

// The S8 review's S8-4 and K-9 (ruling R-S8F-9), its lens Q5-3 repro rebuilt: a date from another year carries its year on
// the Games rows, the tape link and the next action's title; "ends" names its day when that is not today.
describe('R-S8F-9 — dates (S8-4, K-9)', () => {
  const OLD = done(1, { id: 'done_old', completedAt: '2025-12-03T21:05:00.000Z' });

  it('a game from December 2025 on October 27, 2026: the Games row, the tape link and the next action say "Dec 3, 2025"', () => {
    r.window = windowOf([OLD]);
    render('desktop', hubOf());
    const row = games().querySelector('[data-hub-game-row="completed"]').closest('button');
    expect(row.getAttribute('aria-label')).toContain('Dec 3, 2025');
    expect(games().textContent).toContain('Dec 3, 2025');
    const tape = [...games().querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Open battle tape'));
    expect(tape.getAttribute('aria-label')).toContain('Dec 3, 2025');
    expect(document.querySelector('[data-hub-next-action]').textContent).toContain(COPY.nextAction.reviewTitle('Dec 3, 2025'));
  });

  it("this year's games carry no year, as before", () => {
    render('desktop', hubOf());
    expect(games().textContent).toContain('Oct 25');
    expect(games().textContent).not.toMatch(/Oct 25, 2026/);
  });

  it("a game deployed after hours on Tuesday ends at Wednesday's close: its row says \"ends Wed 4:00 PM ET\"", () => {
    r.market = { state: 'CLOSED', isOpen: false };
    render('desktop', hubOf({ activeBattles: [bb('bb_wait', { expiresAt: '2026-10-28T20:00:00Z', scoreState: WAITING })] }));
    const row = games().querySelector('[data-hub-game-row="live"]').closest('button');
    expect(row.textContent).toContain(COPY.strip.deployed(COPY.games.waitingForOpen));
    expect(row.textContent).toContain('ends Wed 4:00 PM ET');
  });
});

// The build's own review, lens L3 (L3-2, L3-4): the phone Overview lists live rows of its own (every live game but the
// next action's); after a failed poll they carry the age too. And the all-waiting header tag is the rows' own phrase.
describe('review fixes L3-2, L3-4', () => {
  const ASOF = NOW - 90 * 60000;
  const at = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(ASOF));
  const overview = () => document.querySelector('[data-hub-phone-panel="overview"]');

  it('L3-2 phone, two live games and a failed poll: the Overview\'s live row carries "As of {time} · couldn\'t refresh" as the card does', () => {
    render('mobile', hubOf({
      activeBattles: [bb('bb_one'), bb('bb_two', { activatedAt: '2026-10-27T13:40:00Z' })],
      activePoll: pollMeta({ status: 'error', error: new Error('poll failed'), lastSuccessfulAt: ASOF }),
    }));
    const rows = overview().querySelectorAll('[data-hub-game-row="live"]');
    expect(rows).toHaveLength(1);
    const note = overview().querySelector('[data-hub-games-live-note="stale"]');
    expect(note?.textContent).toBe(COPY.games.staleAsOf(COPY.time.et(at)));
    expect(document.querySelector('[data-hub-next-action]').textContent).toContain(COPY.games.staleAsOf(COPY.time.et(at)));
  });

  it('L3-2 phone, a poll that answered: no note over the Overview\'s live rows', () => {
    render('mobile', hubOf({ activeBattles: [bb('bb_one'), bb('bb_two', { activatedAt: '2026-10-27T13:40:00Z' })] }));
    expect(overview().querySelectorAll('[data-hub-game-row="live"]')).toHaveLength(1);
    expect(overview().querySelector('[data-hub-games-live-note]')).toBeNull();
  });

  // Ruling Q-S8F-5 (b): the test game has a start time, as a game deployed after hours now does (its first trading day,
  // `timing.tradingDays[0]`, is the next session's).
  it('L3-4 the all-waiting header says the row\'s own phrase, "Deployed · Starts Wed 9:30 AM ET", as the status line does', () => {
    r.market = { state: 'CLOSED', isOpen: false };
    render('desktop', hubOf({ activeBattles: [bb('bb_wait', { expiresAt: '2026-10-28T20:00:00Z', timing: { tradingDays: ['2026-10-28'] }, scoreState: WAITING })] }));
    const phrase = COPY.strip.deployed(COPY.games.startsAt('Wed 9:30 AM ET'));
    expect(games().querySelector('[data-hub-game-row="live"]').closest('button').textContent).toContain(phrase);
    expect(gamesHeader().textContent).toContain(phrase);
    expect(statusLine().textContent).toBe(phrase);
  });

  it('L3-4, no start time known (a game without its trading days): the row, the header and the status line say "Deployed · waiting for the open"', () => {
    r.market = { state: 'CLOSED', isOpen: false };
    render('desktop', hubOf({ activeBattles: [bb('bb_wait', { scoreState: WAITING })] }));
    const phrase = COPY.strip.deployed(COPY.games.waitingForOpen);
    expect(games().querySelector('[data-hub-game-row="live"]').closest('button').textContent).toContain(phrase);
    expect(gamesHeader().textContent).toContain(phrase);
    expect(statusLine().textContent).toBe(phrase);
  });
});

// Founder ruling Q-S8F-5 (b): one wording for a waiting game everywhere. The strip, the Games header (every live game
// waiting) and the status line (none opened) say the strip's "Deployed · {clock}" from the waiting game that starts
// soonest (hub/gamesDisplay.js waitingLineOf); each row keeps its own clock.
describe('Q-S8F-5 — one wording for a waiting game everywhere: the soonest start', () => {
  const SOONER = COPY.strip.deployed(COPY.games.startsAt('Wed 9:30 AM ET'));
  const LATER = COPY.strip.deployed(COPY.games.startsAt('Thu 9:30 AM ET'));
  // The Thursday game was deployed last, so it leads the list and is the strip's game.
  const two = () => hubOf({ activeBattles: [
    bb('bb_thu', { activatedAt: '2026-10-27T14:50:00Z', expiresAt: '2026-10-29T20:00:00Z', timing: { tradingDays: ['2026-10-29'] }, scoreState: WAITING }),
    bb('bb_wed', { activatedAt: '2026-10-27T14:40:00Z', expiresAt: '2026-10-28T20:00:00Z', timing: { tradingDays: ['2026-10-28'] }, scoreState: WAITING }),
  ] });

  it('desktop: the header and the status line say the soonest start; each row keeps its own', () => {
    render('desktop', two());
    const rows = [...games().querySelectorAll('[data-hub-game-row="live"]')].map((el) => el.closest('button').textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain(LATER);
    expect(rows[1]).toContain(SOONER);
    expect(gamesHeader().textContent).toContain(SOONER);
    expect(statusLine().textContent).toBe(SOONER);
  });

  it("phone: the strip says the soonest start too, though its game is the Thursday one", () => {
    render('mobile', two());
    expect(strip().textContent).toContain(SOONER);
    expect(strip().textContent).not.toContain(LATER);
    expect(statusLine().textContent).toBe(SOONER);
  });
});

// The merge with #999 (BaggerBomb cleanup C5): a game deployed from 3:15 PM ET plays the NEXT session. Before its first
// trading day it is waiting, with the market open, and every surface says so from the one hub/gamesDisplay.js
// liveGameRows call (derivePhase with the row's own clock): the Games header and the status line (hub/hubModel.js
// liveCountsOf), the row, the strip, the next action and the phone Overview's own live row. Since ruling Q-S8F-5 the
// header and the status line say the row's own "Deployed · Starts Wed 9:30 AM ET" (hub/gamesDisplay.js waitingLineOf).
describe('the #999 merge — a game deployed between 3:15 and 4:00 PM ET reads as waiting everywhere', () => {
  // Tuesday, Oct 27, 2026, 3:30 PM ET: the market is open.
  const LATE = Date.UTC(2026, 9, 27, 19, 30);
  const STARTS = 'Starts Wed 9:30 AM ET';
  /** Deployed at 3:20 PM ET: its first trading day is Wednesday's session, which it ends at Wednesday's close. */
  const late = (id, over = {}) => bb(id, {
    activatedAt: '2026-10-27T19:20:00Z', expiresAt: '2026-10-28T20:00:00Z', timing: { tradingDays: ['2026-10-28'] }, scoreState: WAITING, ...over,
  });
  const nextAction = () => document.querySelector('[data-hub-next-action]');
  const overview = () => document.querySelector('[data-hub-phone-panel="overview"]');

  beforeEach(() => {
    vi.setSystemTime(LATE);
    r.market = { state: 'OPEN', isOpen: true };
  });

  it('desktop: the Games header, the status line, the row and the next action say waiting (the header and the line in the row\'s words); nothing says live', () => {
    render('desktop', hubOf({ activeBattles: [late('bb_late')] }));
    expect(gamesHeader().textContent).not.toMatch(/\d+ live/);
    expect(gamesHeader().textContent).toContain(COPY.strip.deployed(STARTS));
    expect(statusLine().textContent).toBe(COPY.strip.deployed(STARTS));
    const row = games().querySelector('[data-hub-game-row="live"]').closest('button');
    expect(row.textContent).toContain(COPY.strip.deployed(STARTS));
    expect(row.textContent).toContain('ends Wed 4:00 PM ET');
    expect(nextAction().textContent).toContain(COPY.nextAction.preOpenTitle);
    expect(nextAction().textContent).not.toContain(COPY.nextAction.liveTitle);
  });

  it("phone: the strip, the status line, the next action and the Overview's own live row say waiting", () => {
    render('mobile', hubOf({ activeBattles: [late('bb_late'), late('bb_late2', { activatedAt: '2026-10-27T19:25:00Z' })] }));
    expect(strip().textContent).toContain(COPY.strip.deployed(STARTS));
    expect(strip().textContent).not.toContain(COPY.strip.live(''));
    expect(statusLine().textContent).toBe(COPY.strip.deployed(STARTS));
    expect(nextAction().textContent).toContain(COPY.nextAction.preOpenTitle);
    const rows = overview().querySelectorAll('[data-hub-game-row="live"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].closest('button').textContent).toContain(COPY.strip.deployed(STARTS));
  });

  it('control: at the same instant, a game whose first trading day is today reads live on every surface', () => {
    render('desktop', hubOf({ activeBattles: [late('bb_today', { activatedAt: '2026-10-27T13:30:00Z', expiresAt: '2026-10-27T20:00:00Z', timing: { tradingDays: ['2026-10-27'] }, scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } })] }));
    expect(gamesHeader().textContent).toContain(COPY.games.liveCount(1));
    expect(statusLine().textContent).toBe(COPY.shadow.statusLiveOne);
    expect(nextAction().textContent).toContain(COPY.nextAction.liveTitle);
  });
});
