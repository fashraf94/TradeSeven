// @vitest-environment jsdom
//
// Command Center hub, slice S2b — the CONNECTED hub inside App's deploy
// provider (src/contexts/DeployAttemptContext.jsx): the strip's and the Deploy
// card's holds are live and deploy once through the provider; the status line
// announces the hold's phases and shows its percentage aria-hidden, outside the
// live region; Games does not re-render per frame; "See what it's eyeing" opens
// the Scouting Board inside the hub's overlay stack and its deploy is a tap
// through the provider's guard; a tab change cancels a charge; a site flip
// across 768 px during submitting keeps one attempt.
//
// The readers are driven (the identity source is the real one, fed through a
// mocked firebase/auth; the agent read and the ten-game window are stand-ins);
// the deploy service, the ceremony and the board are stand-ins a row drives.

import React from 'react';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  posts: [],
  gamesRenders: 0,
  boards: [],
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => ({
    status: uid ? 'ready' : 'loading',
    agent: uid ? { id: `agent-${uid}`, ownerId: uid, name: 'Nova', archetype: 'momentum_chaser', stats: { gamesPlayed: 3, wins: 1, losses: 0 } } : null,
    ownerUid: uid ?? null,
    ownerEpoch: options?.ownerEpoch ?? null,
    readError: null,
    retry: () => {},
    activeDirectives: [],
  }),
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
vi.mock('../Dashboard/ScoutingBoardSheet', () => ({
  default: (props) => {
    h.boards.push(props);
    if (!props.open) return null;
    return (
      <div data-board="">
        <button
          type="button"
          data-board-deploy=""
          disabled={props.deployDisabled || props.deploying}
          onClick={async () => { const r = await props.onDeploy?.(); if (r?.success) props.onClose?.(); }}
        >
          Deploy this agent
        </button>
      </div>
    );
  },
}));
vi.mock('./sections/GamesSection', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: (props) => { h.gamesRenders += 1; return <actual.default {...props} />; } };
});
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

const T0 = Date.UTC(2026, 9, 23, 15, 0);
let nowMs;
let frames;
let layout;
let removeTokens;
let removeNav;
let mounted;

const hubOf = () => ({
  activeBattles: [],
  activePoll: { epoch: 1, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false },
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
  h.gamesRenders = 0;
  h.boards = [];
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
const strip = () => document.querySelector('[data-hub-strip]');
const card = () => document.querySelector('[data-hub-deploy]:not([data-hub-deploy-card="phone"])');
const holdIn = (scope) => byRole(scope, 'button', COPY.deploy.holdLabel)[0] ?? scope.querySelector('button[aria-label]');
const status = () => document.querySelector('[data-hub-status]');
const pointer = (el, type, pointerId = 1) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: pointerId }); el.dispatchEvent(e); };
const frameAt = (ms) => act(() => { nowMs = T0 + ms; frames.run(nowMs); });
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('the hub\'s holds, live through the provider (R-S2b-3, R-S2b-4)', () => {
  it('mobile: the strip\'s hold deploys once after commitment and the beat; the strip and Shadow then say submitting', async () => {
    render('mobile');
    expect(strip().getAttribute('data-hub-strip')).toBe('ready');
    const hold = holdIn(strip());
    expect(hold.disabled).toBe(false);
    act(() => { pointer(hold, 'pointerdown'); });
    frameAt(650);
    frameAt(1300);
    expect(currentHold()).toMatchObject({ controlId: 'hub-deploy-strip', phase: 'locked' });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(strip().getAttribute('data-hub-strip')).toBe('submitting');
    expect(status().textContent).toContain(COPY.shadow.statusSubmitting);
  });

  it('desktop: the card\'s hold — "Holding to deploy" in the live region, the percentage aria-hidden beside it, then "Locked in"; Games never re-renders per frame', async () => {
    render('desktop');
    const hold = holdIn(card());
    act(() => { pointer(hold, 'pointerdown'); });
    expect(status().textContent).toContain(COPY.shadow.statusHolding);
    const gamesBefore = h.gamesRenders;
    frameAt(325);
    frameAt(650);
    frameAt(975);
    const percent = document.querySelector('[data-hub-hold-percent]');
    expect(percent).not.toBeNull();
    expect(percent.getAttribute('aria-hidden')).toBe('true');
    expect(percent.textContent).toBe('75%');
    expect(status().contains(percent)).toBe(false);
    expect(status().textContent).not.toMatch(/%/);
    expect(h.gamesRenders).toBe(gamesBefore);
    frameAt(1300);
    expect(status().textContent).toContain(COPY.shadow.statusLocked);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('mobile: a tab change while the strip charges cancels it (spec §5.5) — no deploy', async () => {
    render('mobile');
    act(() => { pointer(holdIn(strip()), 'pointerdown'); });
    frameAt(600);
    const tab = document.querySelector('[role="tab"]:not([aria-selected="true"])');
    click(tab);
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('a site flip across 768 px during submitting keeps the one attempt: the card shows it, and no second request starts', async () => {
    const { m, hub } = render('mobile');
    act(() => { pointer(holdIn(strip()), 'pointerdown'); });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    layout.state.hubWidth = 1216;
    m.rerender(tree('desktop', hub));
    expect(card().getAttribute('data-hub-deploy')).toBe('submitting');
    expect(holdIn(card()).disabled).toBe(true);
    h.posts[0].answer({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, error: 'Deploy already in progress', reason: 'in_progress' });
    await flush();
    expect(card().getAttribute('data-hub-deploy')).toBe('failed');
    expect(card().textContent).toContain('A deploy is already in progress');
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });
});

describe('the Scouting Board (R-S2b-7)', () => {
  it('"See what it\'s eyeing" opens the board inside the hub\'s stack (modalOpen: the card\'s hold is disabled); its deploy is a tap through the guard', async () => {
    render('desktop');
    const link = byRole(card(), 'button', COPY.deploy.scoutingBoard)[0];
    expect(link).toBeTruthy();
    click(link);
    expect(document.querySelector('[data-board]')).not.toBeNull();
    expect(document.querySelector('[data-hub="shell"]').hasAttribute('data-hub-modal-open')).toBe(true);
    expect(holdIn(card()).disabled).toBe(true);
    const deployButton = document.querySelector('[data-board-deploy]');
    expect(deployButton.disabled).toBe(false);
    await act(async () => { deployButton.click(); });
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    // The attempt stands: a second press of the board's deploy is refused by the guard.
    expect(document.querySelector('[data-board-deploy]').disabled).toBe(true);
    await act(async () => { await h.boards.at(-1).onDeploy(); });
    expect(h.deploy).toHaveBeenCalledTimes(1);
    h.posts[0].answer({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
    await flush();
    expect(document.querySelector('[data-board]')).toBeNull();
  });

  it('the board\'s deploy cannot bypass a charging hold: opening the board cancels the charge first', async () => {
    render('desktop');
    act(() => { pointer(holdIn(card()), 'pointerdown'); });
    frameAt(600);
    click(byRole(card(), 'button', COPY.deploy.scoutingBoard)[0]);
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });
});

describe('W5 survivors in the hub (S2b report §8)', () => {
  it('CC2: desktop — an area change while the card charges cancels it; no deploy', async () => {
    render('desktop');
    act(() => { pointer(holdIn(card()), 'pointerdown'); });
    frameAt(600);
    const area = document.querySelector('[data-hub-slot="stage"] [role="tab"][aria-selected="false"]');
    expect(area).not.toBeNull();
    click(area);
    expect(currentHold()).toBeNull();
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('CC7: with the provider, a read\'s Retry is still the read\'s — the poll is refreshed, and nothing deploys', async () => {
    const hub = hubOf();
    hub.activePoll = { epoch: 1, status: 'error', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: 'boom', refreshing: false };
    render('desktop', hub);
    expect(card().getAttribute('data-hub-deploy')).toBe('eligibility_error');
    click(byRole(card(), 'button', COPY.deploy.retry)[0]);
    expect(hub.refreshActiveBattles).toHaveBeenCalledTimes(1);
    expect(h.deploy).not.toHaveBeenCalled();
  });
});

// ── Founder ruling Q-S2b-4 (S2b report §15): Dismiss on the strip and the card ──────────────────────────────────
describe('Q-S2b-4 — a refusal no ceremony shows has Dismiss on the strip and the card', () => {
  const IN_PROGRESS = { outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Deploy already in progress', reason: 'in_progress' };
  const UNCERTAIN = { outcome: 'uncertain', success: false, postIssued: true, httpStatus: null, error: 'deploy_network' };
  async function deployAndAnswer(scope, answer) {
    act(() => { pointer(holdIn(scope()), 'pointerdown'); });
    frameAt(1300);
    await advance(450);
    await flush();
    h.posts[0].answer(answer);
    await flush();
  }

  it('mobile: the strip says "Deployment refused" with Retry and Dismiss; Dismiss acknowledges it, and nothing deploys', async () => {
    render('mobile');
    await deployAndAnswer(strip, IN_PROGRESS);
    expect(strip().getAttribute('data-hub-strip')).toBe('failed');
    expect(strip().textContent).toContain('Deployment refused');
    expect(byRole(strip(), 'button', COPY.deploy.retry)).toHaveLength(1);
    const dismiss = byRole(strip(), 'button', COPY.deploy.dismiss);
    expect(dismiss).toHaveLength(1);
    click(dismiss[0]);
    expect(strip().getAttribute('data-hub-strip')).not.toBe('failed');
    expect(byRole(strip(), 'button', COPY.deploy.dismiss)).toHaveLength(0);
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('desktop: the card\'s line carries Retry and Dismiss; Dismiss acknowledges it', async () => {
    render('desktop');
    await deployAndAnswer(card, IN_PROGRESS);
    expect(card().getAttribute('data-hub-deploy')).toBe('failed');
    const line = card().querySelector('[data-hub-deploy-line]');
    expect(line.textContent).toContain('A deploy is already in progress');
    expect(byRole(line, 'button', COPY.deploy.retry)).toHaveLength(1);
    click(byRole(line, 'button', COPY.deploy.dismiss)[0]);
    expect(card().getAttribute('data-hub-deploy')).not.toBe('failed');
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('desktop: an uncertain answer has Check deployment on the card, and no Dismiss', async () => {
    render('desktop');
    await deployAndAnswer(card, UNCERTAIN);
    expect(card().getAttribute('data-hub-deploy')).toBe('uncertain');
    expect(byRole(card(), 'button', COPY.deploy.checkDeployment)).toHaveLength(1);
    expect(byRole(card(), 'button', COPY.deploy.dismiss)).toHaveLength(0);
  });
});
