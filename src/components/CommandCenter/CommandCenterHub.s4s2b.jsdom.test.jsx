// @vitest-environment jsdom
//
// Command Center hub — the merge of slice S4 with slice S2b (merge round, Oct 24, 2026): the next action's first-deployment
// card, inside App's deploy provider (src/contexts/DeployAttemptContext.jsx), with S2b's real hold, seam and provider.
//
// S4 decides WHEN the card shows (hub/nextAction.js firstDeploymentOffer); S2b decides what its hold DOES (holdWiring /
// holding). The two meet in one place: while the card's own hold charges, the selector denies every start (S2a's row 3b),
// so the offer sets that one hold aside, and the card — the very control being pressed — stays mounted until the commit.
// Then the attempt stands, the offer ends, and exactly one request has gone out.
//
// The harness is S2b's (CommandCenterHub.s2b.jsdom.test.jsx): the identity source is the real one, the agent read and the
// window are stand-ins (here a first-time player: gamesPlayed 0 and an empty ready read), the service and ceremony are stand-ins.

import React from 'react';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ authListeners: [], deploy: null, posts: [], gamesPlayed: 0 }));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => ({
    status: uid ? 'ready' : 'loading',
    agent: uid ? { id: `agent-${uid}`, ownerId: uid, name: 'Nova', archetype: 'momentum_chaser', stats: { gamesPlayed: h.gamesPlayed, wins: 0, losses: 0 } } : null,
    ownerUid: uid ?? null,
    ownerEpoch: options?.ownerEpoch ?? null,
    readError: null,
    retry: () => {},
    activeDirectives: [],
  }),
}));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
vi.mock('./hub/useHubCompletedBattles', async () => {
  const { readAuthIdentity } = await import('../../services/authIdentity');
  return {
    default: () => {
      const id = readAuthIdentity();
      return {
        battles: [], status: 'ready', error: null, ownerUid: id.uid, ownerEpoch: id.authEpoch, lastSuccessfulAt: Date.now(), generation: 1,
        reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, refresh: () => {},
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
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
  isDeployCeremonyOn: () => false,
}));

import CommandCenterHub from './CommandCenterHub';
import { DeployAttemptProvider } from '../../contexts/DeployAttemptContext';
import { resetAuthIdentityForTests } from '../../services/authIdentity';
import { __resetHoldClaim, currentHold } from '../../hooks/holdClaim';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';
import { createFrames } from './__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = Date.UTC(2026, 9, 24, 15, 0);
const HOUR = 3600000;
const NEXT = 'hub-next-action';
let nowMs;
let frames;
let layout;
let removeTokens;
let removeNav;
let mounted;

const iso = (ms) => new Date(ms).toISOString();
const LIVE = { id: 'bb_live', ownerId: 'uid-A', agentId: 'casual-agent-uid-A', status: 'active', activatedAt: iso(T0 - 2 * HOUR), expiresAt: iso(T0 + 3 * HOUR), scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4 } };

const hubOf = (over = {}) => ({
  activeBattles: [],
  activePoll: { epoch: 1, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false },
  refreshActiveBattles: vi.fn(async () => true),
  openGame: vi.fn(),
  openFilmRoom: vi.fn(),
  setScreen: vi.fn(),
  onOpenForge: vi.fn(),
  ...over,
});

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  resetAuthIdentityForTests();
  __resetHoldClaim();
  sessionStorage.clear();
  h.authListeners = [];
  h.posts = [];
  h.gamesPlayed = 0;
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
  removeNav = mountFakeBottomNav();
  mounted = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  removeNav();
  layout.restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
const tree = (site, hub) => (
  <DeployAttemptProvider hubEnabled userName="flash" onCreateAgentBattle={vi.fn()} onEnterBattle={vi.fn()} onOpenBattle={vi.fn()} refreshActiveBattles={hub.refreshActiveBattles} clearCeremonyStash={vi.fn()}>
    <CommandCenterHub site={site} hub={hub} />
  </DeployAttemptProvider>
);
function render(site, hub = hubOf(), width = site === 'mobile' ? 390 : 1216) {
  layout.state.hubWidth = width;
  const m = mount(tree(site, hub));
  mounted.push(m);
  signIn('uid-A');
  return { m, hub };
}
const nextCard = () => document.querySelector('[data-hub-next-action]');
const nextKind = () => nextCard()?.getAttribute('data-hub-next-action') ?? null;
const holdIn = (scope) => byRole(scope, 'button', COPY.deploy.holdLabel)[0] ?? scope.querySelector('button[aria-label]');
const strip = () => document.querySelector('[data-hub-strip]');
const pointer = (el, type, pointerId = 1) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: pointerId }); el.dispatchEvent(e); };
const frameAt = (ms) => act(() => { nowMs = T0 + ms; frames.run(nowMs); });
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('the first-deployment card with S2b\'s real hold (merge of S4 and S2b)', () => {
  it('desktop: the card offers a live hold, and the hold charges to its threshold with the card mounted throughout, then deploys once', async () => {
    render('desktop');
    expect(nextKind()).toBe('deploy');
    const card = nextCard();
    const hold = holdIn(card);
    expect(hold.disabled).toBe(false);
    act(() => { pointer(hold, 'pointerdown'); });
    expect(currentHold()).toMatchObject({ controlId: NEXT, phase: 'charging' });
    for (const ms of [325, 650, 975]) {
      frameAt(ms);
      // The selector denies every start while a hold stands, its own included; the OFFER sets that one hold aside.
      expect(nextCard(), `still offered at ${ms} ms`).toBe(card);
      expect(holdIn(nextCard()), 'the very control being pressed').toBe(hold);
      expect(hold.disabled).toBe(false);
    }
    frameAt(1300);
    expect(currentHold()).toMatchObject({ controlId: NEXT, phase: 'locked' });
    expect(nextCard()).toBe(card);
    expect(hold.disabled).toBe(false);
    expect(h.deploy).not.toHaveBeenCalled();
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(h.deploy.mock.calls[0][0]).toBe('agent-uid-A');
  });

  it('mobile: the same on the Overview, and while the card charges no other control can start (the strip\'s hold is denied)', async () => {
    render('mobile');
    expect(nextKind()).toBe('deploy');
    const hold = holdIn(nextCard());
    expect(hold.disabled).toBe(false);
    expect(holdIn(strip()).disabled).toBe(false);
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(650);
    expect(currentHold()).toMatchObject({ controlId: NEXT, phase: 'charging' });
    expect(holdIn(nextCard())).toBe(hold);
    expect(holdIn(strip()).disabled, 'one hold at a time').toBe(true);
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('once the deployment is under way the offer ends: the card is gone, no second request can start, and the answer changes nothing', async () => {
    render('desktop');
    act(() => { pointer(holdIn(nextCard()), 'pointerdown'); });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(nextCard(), 'the attempt stands: a deployment is not a thing to offer').toBeNull();
    await advance(3000);
    expect(h.deploy).toHaveBeenCalledTimes(1);
    h.posts[0].answer({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('a release before the threshold cancels the charge: nothing deploys, and the card is still offered for another try', async () => {
    render('desktop');
    const hold = holdIn(nextCard());
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(600);
    act(() => { pointer(hold, 'pointerup'); });
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
    expect(nextKind()).toBe('deploy');
    expect(holdIn(nextCard()).disabled).toBe(false);
  });

  it('Later during a charge sets the card aside, and the charge goes with the control: no hold stands, nothing deploys', async () => {
    render('desktop');
    act(() => { pointer(holdIn(nextCard()), 'pointerdown'); });
    frameAt(600);
    click(nextCard().querySelector('[data-hub-later]'));
    expect(nextCard()).toBeNull();
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
    // The strip's hold is free again.
    expect(holdIn(document.querySelector('[data-hub-deploy]')).disabled).toBe(false);
  });

  it('a live game takes the card (rule 1): opening it opens the game and never deploys; there is no first-deployment card or hold', async () => {
    const hub = hubOf({ activeBattles: [LIVE] });
    render('desktop', hub);
    await flush();
    expect(nextKind()).toBe('openGame');
    expect(byRole(nextCard(), 'button', COPY.deploy.holdLabel)).toHaveLength(0);
    click(byRole(nextCard(), 'button', COPY.nextAction.openGame)[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('setting the live game aside with Later does not put the first deployment in its place: a game is live, so there is nothing to offer', async () => {
    const hub = hubOf({ activeBattles: [LIVE] });
    render('desktop', hub);
    await flush();
    expect(nextKind()).toBe('openGame');
    click(nextCard().querySelector('[data-hub-later]'));
    expect(nextCard(), 'the live game is still live').toBeNull();
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('mobile: while the STRIP\'s hold charges the card stays offered (its own hold is not the one set aside) but its hold is denied — one hold at a time, both ways', async () => {
    render('mobile');
    const stripHold = holdIn(strip());
    const cardHold = holdIn(nextCard());
    expect(cardHold.disabled).toBe(false);
    act(() => { pointer(stripHold, 'pointerdown'); });
    frameAt(650);
    expect(currentHold()).toMatchObject({ controlId: 'hub-deploy-strip', phase: 'charging' });
    expect(nextKind(), 'the offer sets any standing hold aside, so the card does not flicker').toBe('deploy');
    expect(holdIn(nextCard()).disabled, 'but another control\'s charge denies this one').toBe(true);
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('a player who has played gets no first-deployment card; the Deploy card\'s own hold is the way in, and it deploys once', async () => {
    h.gamesPlayed = 4;
    render('desktop');
    expect(nextCard()).toBeNull();
    const hold = holdIn(document.querySelector('[data-hub-deploy]'));
    expect(hold.disabled).toBe(false);
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });
});

describe('the names: S2b\'s holdWiring / holding, and no onDeploy from the next action (Q-S4-10)', () => {
  const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the hub files pass the card holdWiring and holding, and no `actions.deploy` or `onDeploy` reaches NextActionCard', () => {
    for (const rel of ['./CommandCenterHub.jsx', './PhoneTabs.jsx']) {
      const src = code(rel);
      const cards = src.match(/<NextActionCard\b[^>]*>/g) || [];
      expect(cards.length, rel).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card, rel).toContain('holdWiring={actions.nextActionHold}');
        expect(card, rel).toContain('holding={actions.nextActionHolding}');
        expect(card, rel).not.toMatch(/\bonDeploy\b/);
      }
      expect(src, rel).not.toMatch(/\bactions\.deploy\b/);
    }
    const card = code('./sections/NextActionCard.jsx');
    expect(card).toMatch(/export default function NextActionCard\(\{[^}]*\bholdWiring\b[^}]*\bholding\b[^}]*\}\)/);
    expect(card).not.toMatch(/\bonDeploy\b/);
  });
});
