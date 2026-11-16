// @vitest-environment jsdom
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — the BaggerBomb page, version 1, rendered with the
// hub's own readers inside App's deploy provider (the S2b harness: the identity source is the real one, fed through a mocked
// firebase/auth; the agent read and the ten-game window are stand-ins a row programs; the deploy service is a stand-in).
//
// Four parts and nothing else:
//   1. Deploy       the hub's press-and-hold card, live through the provider: one deploy after commitment and the beat;
//   2. Live game    the live BaggerBomb rows, each with "Open game" (handed the raw record, as the hub's rows are);
//   3. Finished     the hub's completed window, league rows excluded, and the hub's History sheet over the same rows;
//   4. Record       wins, losses and games played from the agent's stored stats.
// Rendered with: an agent with no battles, one live battle, finished battles, and a league row among both.
//
// The League's pieces never run here: no loadout scope, so no League lock read (services/leagueLockService is a spy that must
// stay unasked), and no ranked row anywhere on the page or in its History.

import React from 'react';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  posts: [],
  agent: null,
  window: null,
  lockSubs: [],
  hide: true,
  openLoadout: null,
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => (h.agent ? h.agent(uid, options) : { status: 'loading', agent: null, ownerUid: uid ?? null, ownerEpoch: options?.ownerEpoch ?? null, readError: null, retry: () => {}, activeDirectives: [] }),
}));
vi.mock('./hub/useHubCompletedBattles', async () => {
  const { readAuthIdentity } = await import('../../services/authIdentity');
  return {
    default: () => {
      const id = readAuthIdentity();
      const w = h.window ?? { battles: [], reviews: {} };
      return {
        battles: w.battles, status: w.status ?? 'ready', error: null, ownerUid: id.uid, ownerEpoch: id.authEpoch, lastSuccessfulAt: Date.now(), generation: 1,
        reviews: w.reviews ?? {}, checking: false, refreshing: false, nextAttemptAt: null, refresh: w.refresh ?? (() => {}),
      };
    },
  };
});
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: async () => ({ found: false, battle: null }) }));
vi.mock('../../services/ownedBattleRead', () => ({ readOwnedBattle: async () => null }));
vi.mock('../../hooks/useDeployTargetProgress', () => ({ default: () => ({ deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false }) }));
vi.mock('../Dashboard/deployCeremony/DeployCeremony', () => ({ default: (props) => <div data-ceremony={props.attemptId} /> }));
// The League lock's one client read: a spy. The page must never ask it.
vi.mock('../../services/leagueLockService', () => ({
  subscribeLeagueLock: (uid) => { h.lockSubs.push(uid); return () => {}; },
}));
// The page is rendered only while the league is hidden, so the flag is ON here (read at render time through a getter): the loadout
// scope the Deploy card's line needs then hands the League lock read no owner. A control row turns it off to prove the spy sees.
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_HIDE_ENABLED() { return h.hide; },
  isDeploySkyCouplingOn: () => true,
  isDeployCeremonyOn: () => false,
}));

import BaggerBombPage from './BaggerBombPage';
import { DeployAttemptProvider } from '../../contexts/DeployAttemptContext';
import { resetAuthIdentityForTests } from '../../services/authIdentity';
import { __resetHoldClaim, currentHold } from '../../hooks/holdClaim';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { BAGGERBOMB_PAGE_COPY as PAGE } from '../../constants/baggerBombPageCopy';
import { byRole, click, injectTokens, installFakeLayout, mount } from './__fixtures__/hubTestKit';
import { createFrames } from './__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = Date.UTC(2026, 10, 16, 15, 0); // a Monday session, 10:00 AM ET
const UID = 'uid-A';
let nowMs;
let frames;
let layout;
let removeTokens;
let mounted;

const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const AGENT = (stats = { wins: 7, losses: 3, gamesPlayed: 10 }) => (uid, options) => ({
  status: uid ? 'ready' : 'loading',
  agent: uid ? { id: `agent-${uid}`, ownerId: uid, name: 'Nova', archetype: 'momentum_chaser', ...(stats === null ? {} : { stats }) } : null,
  ownerUid: uid ?? null,
  ownerEpoch: options?.ownerEpoch ?? null,
  readError: null,
  retry: () => {},
  activeDirectives: [],
});
const LIVE_BB = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: '2026-11-16T14:35:00Z', expiresAt: '2026-11-16T21:00:00Z', scoreState: { currentScore: 3.1, opponentScore: 2.2, tradeCount: 2 } };
const LIVE_LEAGUE = { id: 'lg_live', ownerId: UID, agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: '2026-11-16T14:36:00Z', expiresAt: '2026-11-16T21:00:00Z', scoreState: { currentScore: 1.4, opponentScore: 1.1, tradeCount: 1 } };
const done = (n, over = {}) => ({
  id: `done_${String(n).padStart(2, '0')}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
  completedAt: `2026-11-${String(13 - n).padStart(2, '0')}T21:05:00.000Z`,
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: '2026-11-12T20:58:00.000Z' },
  statusFeed: [{ action: 'battle_complete' }],
  ...over,
});
const windowOf = (battles) => ({ battles, reviews: Object.fromEntries(battles.map((b) => [b.id, { state: 'ready', result: READY, nextAt: null }])) });

const hubOf = (activeBattles = []) => ({
  activeBattles,
  activePoll: { epoch: 1, status: 'ready', ownerUid: UID, ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false },
  refreshActiveBattles: vi.fn(async () => true),
  openGame: vi.fn(),
  openFilmRoom: vi.fn(),
  setScreen: vi.fn(),
  onOpenForge: vi.fn(),
});

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.posts = [];
  h.lockSubs = [];
  h.hide = true;
  h.openLoadout = vi.fn();
  h.agent = AGENT();
  h.window = windowOf([]);
  h.deploy = vi.fn((agentId, onCreate, onTarget) => {
    const d = deferred();
    h.posts.push({ agentId, answer: d.resolve });
    onTarget?.(agentId);
    return d.promise;
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  nowMs = T0;
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  frames = createFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
  layout = installFakeLayout();
  mounted = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  layout.restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
const tree = (site, hub) => (
  <DeployAttemptProvider hubEnabled userName="flash" onCreateAgentBattle={vi.fn()} onEnterBattle={vi.fn()} onOpenBattle={vi.fn()} refreshActiveBattles={hub.refreshActiveBattles} clearCeremonyStash={vi.fn()}>
    <BaggerBombPage site={site} hub={hub} onOpenLoadout={h.openLoadout} />
  </DeployAttemptProvider>
);
function render(site = 'desktop', hub = hubOf()) {
  const m = mount(tree(site, hub));
  mounted.push(m);
  signIn(UID);
  return { m, hub };
}
const page = () => document.querySelector('[data-bb-page]');
const part = (name) => page().querySelector(`[data-bb-part="${name}"]`);
const deployCard = () => page().querySelector('[data-hub-section="deploy"]');
const textOf = (el) => (el ? el.textContent : '');
const stat = (id) => page().querySelector(`[data-bb-record-stat="${id}"] span`)?.textContent ?? null;
const rowLabels = (scope) => [...scope.querySelectorAll('[data-hub-game-row]')].map((el) => el.closest('button').getAttribute('aria-label'));
const pointer = (el, type, pointerId = 1) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: pointerId }); el.dispatchEvent(e); };
const frameAt = (ms) => act(() => { nowMs = T0 + ms; frames.run(nowMs); });
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('the page, an agent with no battles — all four parts, nothing else', () => {
  it.each(['desktop', 'mobile'])('%s: the title, the Deploy card, no live game, no finished games, and the stored record', (site) => {
    render(site);
    expect(page().getAttribute('data-bb-site')).toBe(site);
    expect(textOf(page().querySelector('h1'))).toBe(PAGE.title);
    // 1. Deploy: the hub's own card, its hold ready.
    expect(deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).toBe('ready');
    expect(byRole(deployCard(), 'button', COPY.deploy.holdLabel)).toHaveLength(1);
    // 2. Live game: none, said so.
    expect(textOf(part('live'))).toContain(PAGE.live.none);
    expect(part('live').querySelector('[data-hub-game-row]')).toBeNull();
    // 3. Finished: none, said so, no History link.
    expect(textOf(part('finished'))).toContain(PAGE.finished.empty);
    expect(byRole(part('finished'), 'button', PAGE.finished.history)).toHaveLength(0);
    // 4. Record: the three stored numbers, and where they come from.
    expect([stat('wins'), stat('losses'), stat('gamesPlayed')]).toEqual(['7', '3', '10']);
    expect(textOf(part('record'))).toContain(PAGE.record.caption);
    // Nothing else: exactly these five regions, no hub shell, no loadout cards, no League.
    expect([...page().querySelectorAll('section[data-bb-part], header[data-bb-part]')].map((el) => el.getAttribute('data-bb-part'))).toEqual(['title', 'live', 'finished', 'record']);
    // The hub's ROOT MARKER is on the page (its scoped box model and focus ring, the overlay stack's and the ceremony's focus
    // fallbacks all find the hub by it), but none of the hub's own shell: no body grid, no stage, no cards.
    expect(page().getAttribute('data-hub')).toBe('shell');
    expect(page().querySelector('[data-hub-body], [data-hub-slot], [data-hub-strip]')).toBeNull();
    expect(page().querySelector('[data-loadout-card]')).toBeNull();
    expect(textOf(page())).not.toMatch(/league|ranked/i);
  });

  it('the record says what it cannot know: unavailable without both counts, loading while the agent reads, games played only when stored', () => {
    h.agent = AGENT({ wins: 2, losses: 1 });
    render();
    expect([stat('wins'), stat('losses'), stat('gamesPlayed')]).toEqual(['2', '1', null]);
    mounted.pop().unmount();
    h.agent = AGENT({ wins: 2 });
    render();
    expect(textOf(part('record'))).toContain(PAGE.record.unavailable);
    expect(stat('wins')).toBeNull();
    mounted.pop().unmount();
    h.agent = AGENT(null); // a stored agent with no stats at all
    render();
    expect(textOf(part('record'))).toContain(PAGE.record.unavailable);
    mounted.pop().unmount();
    h.agent = null; // the hook's own loading answer
    render();
    expect(textOf(part('record'))).toContain(PAGE.record.loading);
  });
});

describe('the page, one live BaggerBomb game', () => {
  it.each(['desktop', 'mobile'])('%s: the live game is listed with "Open game", which hands the raw record to App\'s opener', (site) => {
    const hub = hubOf([LIVE_BB]);
    render(site, hub);
    expect(rowLabels(part('live'))).toHaveLength(1);
    expect(rowLabels(part('live'))[0]).toContain('Open live game');
    expect(textOf(part('live'))).not.toContain(PAGE.live.none);
    const open = byRole(part('live'), 'button', PAGE.live.openGame);
    expect(open).toHaveLength(1);
    click(open[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0]).toBe(LIVE_BB);
    // The row itself opens the same game.
    click(part('live').querySelector('[data-hub-game-row]').closest('button'));
    expect(hub.openGame).toHaveBeenCalledTimes(2);
    expect(hub.openGame.mock.calls[1][0]).toBe(LIVE_BB);
  });

  it('a live league game is never shown as the BaggerBomb game: with only a league game live the part reads "no game live"', () => {
    render('desktop', hubOf([LIVE_LEAGUE]));
    expect(part('live').querySelector('[data-hub-game-row]')).toBeNull();
    expect(textOf(part('live'))).toContain(PAGE.live.none);
    expect(byRole(part('live'), 'button', PAGE.live.openGame)).toHaveLength(0);
  });

  it('with a BaggerBomb game and a league game both live, only the BaggerBomb one is listed', () => {
    const hub = hubOf([LIVE_LEAGUE, LIVE_BB]);
    render('desktop', hub);
    expect(rowLabels(part('live'))).toHaveLength(1);
    click(byRole(part('live'), 'button', PAGE.live.openGame)[0]);
    expect(hub.openGame.mock.calls[0][0]).toBe(LIVE_BB);
    expect(textOf(page())).not.toMatch(/ranked/i);
  });
});

describe('the page, finished games — the hub\'s window and History, league rows excluded', () => {
  const BB_DONE = Array.from({ length: 6 }, (_, i) => done(i + 1));
  const LEAGUE_DONE = [done(7, { id: 'lg_done_1', groupId: 'g1', agentId: 'agent-a' }), done(8, { id: 'lg_done_2', groupId: 'g2', agentId: 'agent-a' })];

  it('lists the three most recent BaggerBomb games with the hub\'s own rows, and the League rows are not among them', () => {
    // The window holds the league games newest, so a filter after slicing would show them.
    h.window = windowOf([...LEAGUE_DONE, ...BB_DONE]);
    render();
    const labels = rowLabels(part('finished'));
    expect(labels).toHaveLength(3);
    for (const label of labels) expect(label).toContain('Open game record: BaggerBomb vs');
    expect(textOf(part('finished'))).not.toMatch(/ranked/i);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.empty);
  });

  it('"History" opens the hub\'s own sheet over every finished BaggerBomb game in the window — no league row — with the career record', () => {
    h.window = windowOf([...LEAGUE_DONE, ...BB_DONE]);
    render('desktop');
    const history = byRole(part('finished'), 'button', PAGE.finished.history);
    expect(history).toHaveLength(1);
    expect(history[0].style.minHeight).toBe('');
    click(history[0]);
    const sheet = document.querySelector('[data-hub-sheet-overlay]') ?? document.querySelector('[role="dialog"]');
    expect(sheet, 'the history sheet opened').not.toBeNull();
    expect(sheet.querySelector('[data-hub-sheet]').getAttribute('data-hub-sheet')).toBe('dialog');
    expect(sheet.textContent).toContain(COPY.history.title);
    expect(rowLabels(sheet)).toHaveLength(BB_DONE.length);
    expect(sheet.textContent).not.toMatch(/ranked/i);
    expect(sheet.textContent).toContain('7W-3L');
    expect(sheet.textContent).toContain(COPY.history.careerCaption);
  });

  it('with three or fewer finished BaggerBomb games there is no History link; a window of League games alone says so, never "no finished games"', () => {
    h.window = windowOf([...LEAGUE_DONE, done(1), done(2)]);
    render();
    expect(rowLabels(part('finished'))).toHaveLength(2);
    expect(byRole(part('finished'), 'button', PAGE.finished.history)).toHaveLength(0);
    mounted.pop().unmount();
    h.window = windowOf(LEAGUE_DONE);
    render();
    expect(rowLabels(part('finished'))).toHaveLength(0);
    // The hub reads the latest ten games before any filter: a window of the other kind is not an empty history (LH-C5).
    expect(textOf(part('finished'))).toContain(PAGE.finished.emptyRecent);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.empty);
    mounted.pop().unmount();
    h.window = windowOf([]);
    render();
    expect(textOf(part('finished'))).toContain(PAGE.finished.empty);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.emptyRecent);
  });

  it('a failed window read is never an empty history: the hub\'s own note and its Retry', () => {
    h.window = { battles: null, reviews: {}, status: 'error', refresh: vi.fn() };
    render();
    expect(part('finished').querySelector('[data-hub-games-note="error"]')).not.toBeNull();
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.empty);
    click(byRole(part('finished'), 'button', COPY.games.retry)[0]);
    expect(h.window.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('the page, Deploy — the hub\'s hold, through the provider App mounts around every screen', () => {
  it.each([['desktop', 'hub-deploy-card'], ['mobile', 'hub-deploy-card']])('%s: holding the card\'s control deploys once after commitment and the beat; the card then says submitting', async (site, controlId) => {
    render(site);
    const hold = byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0];
    expect(hold.disabled).toBe(false);
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(650);
    frameAt(1300);
    expect(currentHold()).toMatchObject({ controlId, phase: 'locked' });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).toBe('submitting');
  });

  it('releasing early deploys nothing', async () => {
    render('desktop');
    const hold = byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0];
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(400);
    act(() => { pointer(hold, 'pointerup'); });
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('with a BaggerBomb game already live the card does not offer a second deploy (the hub\'s own admission table)', () => {
    render('desktop', hubOf([LIVE_BB]));
    const state = deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy');
    expect(state).not.toBe('ready');
  });
});

describe('the page never touches the League', () => {
  it('asks the League lock for nothing, whatever it renders', () => {
    h.window = windowOf([done(1), done(2, { id: 'lg_done', groupId: 'g1', agentId: 'agent-a' })]);
    render('desktop', hubOf([LIVE_BB, LIVE_LEAGUE]));
    render('mobile', hubOf([]));
    expect(h.lockSubs).toEqual([]);
  });
});

// ── Review round (LH-B2/C4/D4, D5, C6/B9, B1/C2): the states and wiring the first rows did not drive ──────────────────────────

const POLL_UNANSWERED = { epoch: 1, status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false };
const POLL_FAILED = { epoch: 1, status: 'error', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: new Error('unavailable'), refreshing: false };
const buttonsOf = (scope, text) => [...scope.querySelectorAll('button')].filter((b) => b.textContent.trim() === text);

describe('the Live part never says "no game" for a live list it has not read (the hub\'s T0R-2 rule)', () => {
  it.each([['the poll has not answered yet', POLL_UNANSWERED], ['the first poll failed', POLL_FAILED]])('%s, with the finished window already read: "checking", not "No game live"', (_, poll) => {
    h.window = windowOf([done(1)]);
    render('desktop', { ...hubOf([]), activePoll: poll, activeBattles: null });
    expect(textOf(part('live'))).toContain(COPY.games.loading);
    expect(textOf(part('live'))).not.toContain(PAGE.live.none);
    expect(part('live').querySelector('[data-hub-game-row]')).toBeNull();
  });

  it('and with the window failed to read too, still "checking" — never the empty note beside a Deploy card that says it cannot tell', () => {
    h.window = { battles: null, reviews: {}, status: 'error', refresh: vi.fn() };
    render('desktop', { ...hubOf([]), activePoll: POLL_FAILED, activeBattles: null });
    expect(textOf(part('live'))).not.toContain(PAGE.live.none);
    expect(textOf(part('live'))).toContain(COPY.games.loading);
  });

  it('once the poll has answered with no game, the note is "No game live" (the control: the same page, a resolved poll)', () => {
    render('desktop', hubOf([]));
    expect(textOf(part('live'))).toContain(PAGE.live.none);
    expect(textOf(part('live'))).not.toContain(COPY.games.loading);
  });
});

describe('the Finished part, every state of the hub\'s window', () => {
  it('while the first read is out it says it is checking, and shows no empty note', () => {
    h.window = { battles: null, reviews: {}, status: 'loading' };
    render();
    expect(textOf(part('finished'))).toContain(COPY.games.loading);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.empty);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.emptyRecent);
  });

  it('a retained window whose refresh failed (stale) shows its rows and the hub\'s as-of note with Retry, and never an empty note', () => {
    h.window = { ...windowOf([done(1), done(2)]), status: 'error', refresh: vi.fn() };
    render();
    expect(part('finished').querySelector('[data-hub-games-note="stale"]')).not.toBeNull();
    expect(rowLabels(part('finished'))).toHaveLength(2);
    click(byRole(part('finished'), 'button', COPY.games.retry)[0]);
    expect(h.window.refresh).toHaveBeenCalledTimes(1);
    mounted.pop().unmount();
    h.window = { battles: [], reviews: {}, status: 'error', refresh: vi.fn() };
    render();
    expect(part('finished').querySelector('[data-hub-games-note="stale"]')).not.toBeNull();
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.empty);
    expect(textOf(part('finished'))).not.toContain(PAGE.finished.emptyRecent);
  });

  it('a finished row opens that game, and its "Open battle tape" link opens the Film Room — both handed the raw record', () => {
    const records = [done(1), done(2)];
    h.window = windowOf(records);
    const hub = hubOf();
    render('desktop', hub);
    click(part('finished').querySelector('[data-hub-game-row="completed"]').closest('button'));
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0]).toBe(records[0]);
    const tape = part('finished').querySelectorAll('[data-hub-review="ready"] button');
    expect(tape).toHaveLength(2);
    click(tape[1]);
    expect(hub.openFilmRoom).toHaveBeenCalledTimes(1);
    expect(hub.openFilmRoom.mock.calls[0][0]).toBe(records[1]);
  });

  it('History on the PHONE: the hub\'s sheet, phone-docked, its rows open games, its Refresh asks the window', () => {
    const records = Array.from({ length: 5 }, (_, i) => done(i + 1));
    h.window = { ...windowOf(records), refresh: vi.fn() };
    const hub = hubOf();
    render('mobile', hub);
    const historyLink = byRole(part('finished'), 'button', PAGE.finished.history)[0];
    // The phone composition reaches the hub's parts: 44 px targets (hub/HubParts.jsx PHONE_TARGET), not the desktop's in-line link.
    expect(historyLink.style.minHeight).toBe('44px');
    click(historyLink);
    const sheet = document.querySelector('[data-hub-sheet-overlay]') ?? document.querySelector('[role="dialog"]');
    expect(sheet, 'the history sheet opened').not.toBeNull();
    expect(sheet.querySelector('[data-hub-sheet]').getAttribute('data-hub-sheet')).toBe('bottom');
    expect(rowLabels(sheet)).toHaveLength(5);
    click(sheet.querySelector('[data-hub-game-row="completed"]').closest('button'));
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0]).toBe(records[0]);
    click(buttonsOf(sheet, COPY.history.refresh)[0]);
    expect(h.window.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('the Deploy card on the page — the rest of what the hub\'s card does', () => {
  it('opening History cancels a hold that has not committed (the overlay\'s onOpen is the provider\'s cancel)', async () => {
    h.window = windowOf(Array.from({ length: 5 }, (_, i) => done(i + 1)));
    render('desktop');
    const hold = byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0];
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(400);
    expect(currentHold()).toMatchObject({ controlId: 'hub-deploy-card', phase: 'charging' });
    click(byRole(part('finished'), 'button', PAGE.finished.history)[0]);
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('a read\'s Retry on the card runs the readers\' own refresh (the poll\'s), not the attempt\'s', () => {
    const hub = { ...hubOf([]), activePoll: POLL_FAILED, activeBattles: null };
    render('desktop', hub);
    expect(deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).not.toBe('ready');
    const retry = buttonsOf(deployCard(), COPY.deploy.retry);
    expect(retry.length).toBeGreaterThan(0);
    click(retry[0]);
    expect(hub.refreshActiveBattles).toHaveBeenCalledTimes(1);
  });

  it('shows "Next deploy carries …" (the hub card\'s own line, from the same scope) and its door takes the player to the Loadout tab', () => {
    const hub = hubOf();
    render('desktop', hub);
    const line = deployCard().querySelector('[data-loadout-deploy-line]');
    expect(line, 'the loadout line is on the card').not.toBeNull();
    expect(line.getAttribute('data-loadout-deploy-next') || line.querySelector('[data-loadout-deploy-next]')?.getAttribute('data-loadout-deploy-next')).toBe('momentum_chaser');
    click(line.querySelector('button'));
    expect(h.openLoadout).toHaveBeenCalledTimes(1);
  });

  it('without the deploy provider (the hub kill switch) the page still renders its four parts and the hold is inert — nothing throws', () => {
    const m = mount(<BaggerBombPage site="desktop" hub={hubOf()} onOpenLoadout={h.openLoadout} />);
    mounted.push(m);
    signIn(UID);
    expect(page()).not.toBeNull();
    for (const name of ['live', 'finished', 'record']) expect(part(name)).not.toBeNull();
    const hold = byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0];
    act(() => { pointer(hold, 'pointerdown'); });
    expect(currentHold()).toBeNull();
    expect(h.deploy).not.toHaveBeenCalled();
  });
});

describe('the Deploy card on the page — an open overlay and a width flip', () => {
  it('while the History sheet is open the card\'s hold is disabled (the hub\'s overlay stack tells the deploy state: modalOpen), and live again when it closes', () => {
    h.window = windowOf(Array.from({ length: 5 }, (_, i) => done(i + 1)));
    render('desktop');
    const hold = () => byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0];
    expect(hold().disabled).toBe(false);
    click(byRole(part('finished'), 'button', PAGE.finished.history)[0]);
    expect(hold().disabled).toBe(true);
    click(byRole(document.querySelector('[data-hub-sheet-overlay]'), 'button', COPY.sheet?.close ?? 'Close')[0] ?? document.querySelector('[data-hub-sheet-overlay] button'));
    expect(hold().disabled).toBe(false);
  });

  it('a width flip across 768 px while submitting keeps the ONE attempt: the card shows it, and no second request starts', async () => {
    const hub = hubOf();
    const { m } = render('mobile', hub);
    act(() => { pointer(byRole(deployCard(), 'button', COPY.deploy.holdLabel)[0], 'pointerdown'); });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    m.rerender(tree('desktop', hub));
    expect(page().getAttribute('data-bb-site')).toBe('desktop');
    expect(deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).toBe('submitting');
    // A press on whatever hold control the card shows now must start nothing: still the one request.
    for (const b of deployCard().querySelectorAll('button')) act(() => { pointer(b, 'pointerdown'); });
    frameAt(2600);
    await advance(1000);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    h.posts[0].answer({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, error: 'Deploy already in progress', reason: 'in_progress' });
    await flush();
    expect(deployCard().querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).toBe('failed');
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });
});

describe('the page as the hub\'s own root (the review\'s layout finding)', () => {
  it('carries the hub\'s box-model and focus rules for its own root, and the one <style> that holds them', () => {
    render('desktop');
    const css = document.querySelector('style[data-hub-css]').textContent;
    expect(css).toContain('[data-hub="shell"] *');
    expect(css).toContain('box-sizing: border-box');
    expect(css).toContain('[data-hub="shell"] :focus-visible');
    expect(page().matches('[data-hub="shell"]')).toBe(true);
  });

  it('the League lock IS asked for under the same scope when the hide is off — the control that shows the "asks the lock for nothing" row can see', () => {
    h.hide = false;
    render('desktop', hubOf([]));
    expect(h.lockSubs).toEqual([UID]);
  });
});
