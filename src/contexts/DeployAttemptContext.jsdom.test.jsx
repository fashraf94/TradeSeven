// @vitest-environment jsdom
//
// src/contexts/DeployAttemptContext.jsdom.test.jsx
//
// Command Center slice S2b — the root deploy provider, end to end through the
// REAL hub hold controls (HubHold → HoldToDeployButton → useHoldToDeploy → the
// hold seam → the provider), the REAL identity source (services/authIdentity.js,
// fed through a mocked firebase/auth listener), the real reducer and the real
// §3.1 selector. The deploy service, the due-idea check, the verifier, the owned
// read and the ceremony are stand-ins a row drives; the ceremony itself, with its
// real stage machine, is exercised in DeployAttemptContext.ceremony.jsdom.test.jsx.
// rAF is controllable (frames run only when a row says so); timers and Date are
// fake.
//
// Spec V1.2 §11.3 rows: Ownership C2, Vocabulary C3, Hold C4, Lifetime/intent,
// Existing battle R1 (the hydration half), P1b refusal; and the prompt's §4
// must-haves.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  due: null,
  verify: null,
  owned: null,
  ceremonyOn: false,
  ceremonies: [],
  ceremonyMounts: 0,
  targetProgress: { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false },
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../services/dueIdeaCheck', () => ({ checkDueIdea: (...args) => h.due(...args) }));
vi.mock('../services/agentBattleVerify', () => ({ findActiveBattleForAgent: (...args) => h.verify(...args) }));
vi.mock('../services/ownedBattleRead', () => ({ readOwnedBattle: (...args) => h.owned(...args) }));
vi.mock('../hooks/useDeployTargetProgress', () => ({ default: () => h.targetProgress }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
  isDeployCeremonyOn: () => h.ceremonyOn,
}));
// The ceremony's own suite runs the real one; here a stand-in records what the provider hands it.
vi.mock('../components/Dashboard/deployCeremony/DeployCeremony', () => ({
  default: function CeremonyStub(props) {
    // A mount is a fresh ceremony instance (a new key): counted once per instance.
    const [mount] = React.useState(() => { h.ceremonyMounts += 1; return h.ceremonyMounts; });
    h.ceremonies.push({ ...props, mount });
    return <div data-ceremony={props.attemptId} data-ceremony-mount={mount} />;
  },
}));
vi.mock('../components/Dashboard/deployCeremony/DueIdeaInterstitial', () => ({
  default: ({ onProceed }) => <button type="button" data-due-screen="" onClick={onProceed}>Deploy without it</button>,
}));

import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';
import { resetAuthIdentityForTests, readAuthIdentity } from '../services/authIdentity';
import { __resetHoldClaim, currentHold } from '../hooks/holdClaim';
import { DeployAttemptProvider, EXISTING_READ_RETRY_MS } from './DeployAttemptContext';
import { deployDisplay, DISPLAY_ACTIONS } from '../components/CommandCenter/hub/deployDisplay';
import { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } from '../constants/hypothesisRecords';
import { DEPLOY_IN_PROGRESS_LINE } from '../constants/deployOutcomes';
import useHoldToDeploy from '../hooks/useHoldToDeploy';
import { FakeHub, HubRoot, StackProbe, createFrames } from '../components/CommandCenter/__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_800_000_000_000;
const CARD = 'hub-deploy-card';
const STRIP = 'hub-deploy-strip';
let nowMs;
let frames;
let sky;
let container;
let root;
let probe;
let stack;
let bridge;
let posts;

const onSky = (event) => sky.push(event.detail);
const reasons = () => sky.filter((d) => d.progress === null).map((d) => d.reason);

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

/** The deploy service's stand-in: records the call, reports the target, and waits for the row's answer. */
function serviceWaits() {
  h.deploy = vi.fn((agentId, onCreate, onTarget, options) => {
    const d = deferred();
    posts.push({ agentId, onCreate, onTarget, isCurrent: options?.isCurrent, answer: d.resolve });
    onTarget?.(agentId);
    return d.promise;
  });
}

const CREATED = (id = 'battle-new') => ({ outcome: 'created', success: true, agentBattleId: id });
const EXISTING = (id = 'battle-running') => ({ outcome: 'existing_battle', success: false, existingBattleId: id, postIssued: true, httpStatus: 200 });
const UNCERTAIN = () => ({ outcome: 'uncertain', success: false, postIssued: true, httpStatus: null, error: 'deploy_network' });
const REVIEW_DUE = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 409, status: 409, error: DEPLOY_REFUSAL_CODE, details: undefined });
const IN_PROGRESS = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Deploy already in progress', reason: 'in_progress' });

function signIn(uid) {
  act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
}

function render({ controls = [CARD, STRIP], hubEnabled = true, showHub = true, hub = {}, over = {} } = {}) {
  act(() => {
    root.render(
      <DeployAttemptProvider hubEnabled={hubEnabled} {...bridge}>
        {showHub && (
          <HubRoot>
            <StackProbe probe={stack} />
            <FakeHub controls={controls} probe={probe} hub={hub} over={over} />
          </HubRoot>
        )}
      </DeployAttemptProvider>,
    );
  });
}

const buttonOf = (id) => container.querySelector(`[data-control="${id}"] button`);
function pointer(id, type, pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  buttonOf(id).dispatchEvent(e);
}
const press = (id, pointerId = 1) => act(() => { pointer(id, 'pointerdown', pointerId); });
const lift = (id, pointerId = 1) => act(() => { pointer(id, 'pointerup', pointerId); });
const enter = (id) => act(() => { buttonOf(id).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' })); });
/** Move the clock to T0 + ms and run the frames already queued, inside act. */
const frameAt = (ms) => act(() => { nowMs = T0 + ms; frames.run(nowMs); });
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
/** A pointer hold from press to its threshold frame (committed when nothing stopped it). */
const holdToThreshold = (id = CARD) => { const from = nowMs - T0; press(id); frameAt(from + 600); frameAt(from + 1300); };
const state = () => probe.current.state;
const attempt = () => probe.current.snapshot?.state?.attempt ?? null;

beforeEach(() => {
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.ceremonyOn = false;
  h.ceremonies = [];
  h.ceremonyMounts = 0;
  h.targetProgress = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false };
  h.due = vi.fn(async () => null);
  h.verify = vi.fn(async () => ({ found: false, battle: null }));
  h.owned = vi.fn(async () => null);
  posts = [];
  serviceWaits();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  nowMs = T0;
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  frames = createFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
  sky = [];
  window.addEventListener(DEPLOY_INTENT_EVENT, onSky);
  bridge = {
    onCreateAgentBattle: vi.fn(() => 'battle-new'),
    onEnterBattle: vi.fn(),
    onOpenBattle: vi.fn(),
    refreshActiveBattles: vi.fn(),
    clearCeremonyStash: vi.fn(),
    userName: 'flash',
  };
  probe = { current: null };
  stack = { current: null };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render();
  signIn('uid-A');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(DEPLOY_INTENT_EVENT, onSky);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the hold through the provider — commitment is the boundary (C4)', () => {
  it('the hub starts ready for the signed-in identity, at its epoch', () => {
    expect(readAuthIdentity()).toMatchObject({ resolved: true, uid: 'uid-A', authEpoch: 1 });
    expect(state().displayState).toBe('ready');
    expect(state().canStart).toBe(true);
    expect(buttonOf(CARD).disabled).toBe(false);
  });

  it('commitment first: Locked in, a release after it is ignored, and exactly one deploy after the 450 ms beat', async () => {
    holdToThreshold();
    expect(currentHold()).toMatchObject({ controlId: CARD, phase: 'locked', inputId: 'pointer:1' });
    expect(probe.current.snapshot.state.hold).toMatchObject({ controlId: CARD, phase: 'locked' });
    lift(CARD);
    await advance(449);
    expect(h.deploy).not.toHaveBeenCalled();
    await advance(1);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(h.deploy.mock.calls[0][0]).toBe('agent-uid-A');
    expect(reasons()).toEqual(['commit']);
    expect(attempt()).toMatchObject({ phase: 'submitting', capturedUid: 'uid-A', authEpoch: 1 });
  });

  it('cancellation first in the same frame: the release lands before the threshold frame runs — zero deployment', async () => {
    press(CARD);
    frameAt(600);
    // The clock is past the threshold, but the release is processed first.
    act(() => { nowMs = T0 + 1300; pointer(CARD, 'pointerup'); frames.run(nowMs); });
    expect(currentHold()).toBeNull();
    expect(probe.current.snapshot.state.hold).toBeNull();
    await advance(5000);
    expect(h.deploy).not.toHaveBeenCalled();
    expect(reasons()).toEqual(['abort']);
  });

  it('keyboard: Enter commits at once (snap, no held key), and deploys once after the same beat', async () => {
    enter(CARD);
    expect(currentHold()).toMatchObject({ controlId: CARD, phase: 'locked', inputId: 'key' });
    expect(frames.pending()).toBe(0);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('two controls in the same tick: one claim; the denied one emits nothing at all — no frame, no sky, no request', async () => {
    act(() => { pointer(CARD, 'pointerdown'); pointer(STRIP, 'pointerdown', 2); });
    expect(frames.pending()).toBe(1);
    expect(currentHold()).toMatchObject({ controlId: CARD });
    const skyBefore = sky.length;
    // A key and a tap on the competitor are denied too.
    enter(STRIP);
    let tapped;
    await act(async () => { tapped = await probe.current.deploy.tap(STRIP); });
    expect(tapped).toEqual({ success: false });
    expect(sky.length).toBe(skyBefore);
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('pointer and key on the same control: the key on a charging control is ignored; one deploy', async () => {
    press(CARD);
    enter(CARD);
    expect(currentHold()).toMatchObject({ phase: 'charging', inputId: 'pointer:1' });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('a tap first, then a hold in the same tick: the hold is denied while the tap\'s attempt stands — one request', async () => {
    let tap;
    act(() => { tap = probe.current.deploy.tap(CARD); pointer(STRIP, 'pointerdown'); });
    await flush();
    expect(frames.pending()).toBe(0);
    expect(h.deploy).toHaveBeenCalledTimes(1);
    posts[0].answer(CREATED());
    await act(async () => { await tap; });
  });

  it('R2 Q5 (fails on the legacy hook): a denied second finger lifting does not cancel the first finger\'s hold', async () => {
    press(CARD, 1);
    press(CARD, 2); // denied: the control is already charging
    lift(CARD, 2);
    expect(currentHold()).toMatchObject({ controlId: CARD, phase: 'charging' });
    frameAt(1300);
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(reasons()).toEqual(['commit']);
  });

  it('…while today\'s shells keep R2\'s hook as it was: there, the second finger\'s lift still cancels (unchanged, by ruling)', () => {
    function Legacy() {
      const { bind, phase } = useHoldToDeploy({ enabled: true, controlId: 'legacy', onComplete: () => {} });
      return <button type="button" data-legacy={phase} {...bind}>legacy</button>;
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    const r = createRoot(host);
    act(() => r.render(<Legacy />));
    const b = host.querySelector('button');
    const fire = (type, id) => { const e = new Event(type, { bubbles: true }); Object.defineProperty(e, 'pointerId', { value: id }); b.dispatchEvent(e); };
    act(() => { fire('pointerdown', 1); fire('pointerdown', 2); fire('pointerup', 2); });
    expect(b.getAttribute('data-legacy')).toBe('idle');
    act(() => r.unmount());
    host.remove();
  });

  it('the committed beat survives its control unmounting (the hub navigated away): one deploy, one attempt', async () => {
    holdToThreshold();
    render({ showHub: false });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    // Back on the hub (another site, another tree): the one attempt, still submitting, and no hold to start.
    render({ controls: [STRIP] });
    expect(state().displayState).toBe('submitting');
    expect(state().canStart).toBe(false);
    expect(buttonOf(STRIP).disabled).toBe(true);
  });

  it('an overlay opening while charging cancels in the same task — before any frame runs — and the threshold then commits nothing', async () => {
    press(CARD);
    frameAt(600);
    act(() => { stack.current.open('sheet', { within: container }); });
    expect(currentHold()).toBeNull();
    expect(reasons()).toEqual(['abort']);
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('after commitment an overlay or a blur cannot cancel: the deploy still completes once', async () => {
    holdToThreshold();
    act(() => { stack.current.open('sheet', { within: container }); window.dispatchEvent(new Event('blur')); });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(reasons()).toEqual(['commit']);
  });

  it('a blur or a hidden tab while charging cancels through the seam: one abort, the claim back, no deploy', async () => {
    press(CARD);
    frameAt(600);
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(currentHold()).toBeNull();
    expect(probe.current.snapshot.state.hold).toBeNull();
    expect(reasons()).toEqual(['abort']);
    press(STRIP);
    frameAt(900);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    delete document.hidden;
    expect(currentHold()).toBeNull();
    expect(reasons()).toEqual(['abort', 'abort']);
    await advance(2000);
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('progress is the owner-tagged store\'s: the charge, by its own control and token', () => {
    press(CARD);
    frameAt(650);
    const { progress } = probe.current.deploy;
    expect(progress.get()).toMatchObject({ controlId: CARD, holdToken: currentHold().holdToken });
    expect(progress.get().progress).toBeCloseTo(0.5, 2);
    lift(CARD);
    expect(progress.get()).toBeNull();
  });
});

describe('ownership through every boundary (C2)', () => {
  it('an identity change while charging cancels the charge in its own task: no deploy', async () => {
    press(CARD);
    frameAt(600);
    signIn('uid-B');
    expect(currentHold()).toBeNull();
    expect(reasons()).toEqual(['abort']);
    frameAt(1300);
    await advance(1000);
    expect(h.deploy).not.toHaveBeenCalled();
    expect(state().displayState).toBe('ready'); // B's own readiness
  });

  it('an identity change during the committed beat revokes it: no POST for anyone, and the slot is free', async () => {
    holdToThreshold();
    signIn('uid-B');
    await advance(450);
    await flush();
    expect(h.deploy).not.toHaveBeenCalled();
    expect(currentHold()).toBeNull();
    expect(attempt()).toBeNull();
  });

  it('an identity change while the request is out: the late answer shows the new account nothing, hands App nothing, and the server battle is left alone', async () => {
    holdToThreshold();
    await advance(450);
    await flush();
    const post = posts[0];
    signIn('uid-B');
    expect(attempt()).toBeNull(); // orphaned and cleaned at once: B is not kept waiting
    expect(state().displayState).toBe('ready');
    expect(post.isCurrent()).toBe(false);
    // The late handoff and result: the wrapper refuses before App, and nothing is shown.
    expect(post.onCreate({}, {}, { agentBattleId: 'battle-new' })).toBeNull();
    post.answer(CREATED());
    await flush();
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(attempt()).toBeNull();
    expect(state().displayState).toBe('ready');
  });

  it('A → B → A: the original promise cannot come back — a new epoch, a fresh hub, nothing revived', async () => {
    holdToThreshold();
    await advance(450);
    await flush();
    const post = posts[0];
    signIn('uid-B');
    signIn('uid-A');
    expect(readAuthIdentity()).toMatchObject({ uid: 'uid-A', authEpoch: 3 });
    expect(post.isCurrent()).toBe(false);
    post.answer(CREATED());
    await flush();
    expect(attempt()).toBeNull();
    expect(state().displayState).toBe('ready');
    // A's next deploy is its own, under the new epoch.
    holdToThreshold(STRIP);
    await advance(450);
    await flush();
    expect(posts).toHaveLength(2);
    expect(attempt()).toMatchObject({ capturedUid: 'uid-A', authEpoch: 3 });
  });

  it('an identity change while the due-idea screen waits: the screen closes, and no deploy call is ever made', async () => {
    h.due = vi.fn(async () => ({ watchlistId: 'w1', version: 2, currentVersion: 2, title: null }));
    holdToThreshold();
    await advance(450);
    await flush();
    expect(container.querySelector('[data-due-screen]')).not.toBeNull();
    signIn('uid-B');
    expect(container.querySelector('[data-due-screen]')).toBeNull();
    await flush();
    expect(h.deploy).not.toHaveBeenCalled();
  });

  it('the handoff runs only through the provider\'s check, and App is handed the deploy\'s own meta', async () => {
    holdToThreshold();
    await advance(450);
    await flush();
    const meta = { agentBattleId: 'battle-new', ownerUid: 'uid-A' };
    posts[0].onCreate({ star: [] }, { stocks: [] }, meta);
    expect(bridge.onCreateAgentBattle).toHaveBeenCalledTimes(1);
    expect(bridge.onCreateAgentBattle.mock.calls[0][2]).toMatchObject(meta);
  });
});

describe('the due-idea screen comes before any hub deploy call (P1c E1)', () => {
  it('a due idea: its one screen first, no deploy call until the choice, then exactly one', async () => {
    h.due = vi.fn(async () => ({ watchlistId: 'w1', version: 2, currentVersion: 2, title: null }));
    holdToThreshold();
    await advance(450);
    await flush();
    expect(h.due).toHaveBeenCalledTimes(1);
    expect(h.due.mock.calls[0][0]).toMatchObject({ id: 'agent-uid-A' });
    expect(h.deploy).not.toHaveBeenCalled();
    await act(async () => { container.querySelector('[data-due-screen]').click(); });
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-due-screen]')).toBeNull();
  });

  it('a Retry skips the check: the choice was made', async () => {
    holdToThreshold();
    await advance(450);
    await flush();
    posts[0].answer(IN_PROGRESS());
    await flush();
    expect(attempt().phase).toBe('refused');
    expect(state().action).toBe(DISPLAY_ACTIONS.RETRY);
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.RETRY); });
    await flush();
    expect(h.due).toHaveBeenCalledTimes(1);
    expect(h.deploy).toHaveBeenCalledTimes(2);
  });
});

describe('outcomes, dismissal, retry and uncertainty (C3, §5.4)', () => {
  async function deployOnce() {
    holdToThreshold();
    await advance(450);
    await flush();
  }

  it('created, ceremony off: App\'s handoff navigates as today, and that navigation acknowledges the terminal', async () => {
    await deployOnce();
    posts[0].onCreate({}, {}, { agentBattleId: 'battle-new', ownerUid: 'uid-A' });
    posts[0].answer(CREATED());
    await flush();
    expect(bridge.onCreateAgentBattle).toHaveBeenCalledTimes(1);
    expect(attempt()).toMatchObject({ phase: 'idle' });
    expect(bridge.refreshActiveBattles).toHaveBeenCalledTimes(1);
  });

  it('uncertain → dismissed → no fresh POST: no hold, tap or Retry until an owned clear result', async () => {
    await deployOnce();
    posts[0].answer(UNCERTAIN());
    await flush();
    expect(state().displayState).toBe('uncertain');
    expect(state().action).toBe(DISPLAY_ACTIONS.CHECK_DEPLOYMENT);
    act(() => { probe.current.api.dismiss(); });
    expect(attempt().phase).toBe('uncertain'); // the guard stays
    press(CARD);
    expect(frames.pending()).toBe(0);
    let tapped;
    await act(async () => { tapped = await probe.current.deploy.tap(CARD); });
    expect(tapped).toEqual({ success: false });
    await act(async () => { await probe.current.api.retry(); });
    expect(h.deploy).toHaveBeenCalledTimes(1);
    // Check deployment: the target-scoped verifier, clear → Retry is offered; still nothing replays by itself.
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.CHECK_DEPLOYMENT); });
    await flush();
    expect(h.verify).toHaveBeenCalledWith('agent-uid-A');
    expect(attempt().reconciliationStatus).toBe('clear');
    expect(state().action).toBe(DISPLAY_ACTIONS.RETRY);
    await advance(60000);
    expect(h.deploy).toHaveBeenCalledTimes(1);
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.RETRY); });
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(2);
    expect(attempt().attemptEpoch).toBeGreaterThan(1);
  });

  it('uncertain, and the check finds the owned battle: existing, never a creation — Open game, no Retry', async () => {
    await deployOnce();
    posts[0].answer(UNCERTAIN());
    await flush();
    const battle = { id: 'battle-x', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' };
    h.verify = vi.fn(async () => ({ found: true, battle }));
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.CHECK_DEPLOYMENT); });
    await flush();
    expect(attempt()).toMatchObject({ phase: 'existing', resolution: { kind: 'found_existing', battleId: 'battle-x' } });
    expect(state().action).toBe(DISPLAY_ACTIONS.OPEN_GAME);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_GAME); });
    expect(bridge.onOpenBattle).toHaveBeenCalledWith(battle);
    expect(attempt().phase).toBe('idle');
  });

  it('uncertain, and the check fails: still uncertain, Check again — never a Retry', async () => {
    await deployOnce();
    posts[0].answer(UNCERTAIN());
    await flush();
    h.verify = vi.fn(async () => { throw new Error('offline'); });
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.CHECK_DEPLOYMENT); });
    await flush();
    expect(attempt()).toMatchObject({ phase: 'uncertain', reconciliationStatus: 'error' });
    expect(state().action).toBe(DISPLAY_ACTIONS.CHECK_DEPLOYMENT);
  });

  it('a clear check with a known cooldown: Retry waits for the bound; the Retry-After evidence is the server\'s', async () => {
    await deployOnce();
    posts[0].answer({ ...UNCERTAIN(), retryAfter: 90 });
    await flush();
    await act(async () => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.CHECK_DEPLOYMENT); });
    await flush();
    expect(attempt().reconciliationStatus).toBe('clear');
    expect(state().action).toBeNull();
    expect(state().retryBlock).toMatchObject({ displayState: 'cooldown' });
    await act(async () => { await probe.current.api.retry(); });
    expect(h.deploy).toHaveBeenCalledTimes(1);
    await advance(90100);
    expect(state().action).toBe(DISPLAY_ACTIONS.RETRY);
  });

  it('existing: no create callback, no synthetic id; the owned document is read once, deduplicated, and Open opens it', async () => {
    const battle = { id: 'battle-running', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' };
    h.owned = vi.fn(async () => battle);
    await deployOnce();
    posts[0].answer(EXISTING());
    await flush();
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(attempt()).toMatchObject({ result: { kind: 'existing', battleId: 'battle-running' } });
    expect(h.owned).toHaveBeenCalledTimes(1);
    expect(h.owned).toHaveBeenCalledWith('battle-running', 'uid-A');
    // Ceremony off: the fetched owned document opens at once, and only it.
    expect(bridge.onOpenBattle).toHaveBeenCalledWith(battle);
    expect(attempt().phase).toBe('idle');
  });

  it('existing, and the owned read fails: a visible note, and its Retry waits 30 s (outside the review budget)', async () => {
    h.owned = vi.fn(async () => { throw new Error('denied'); });
    await deployOnce();
    posts[0].answer(EXISTING());
    await flush();
    expect(h.owned).toHaveBeenCalledTimes(1);
    expect(probe.current.deploy.existingRead).toMatchObject({ status: 'error', battleId: 'battle-running' });
    const display = deployDisplay({ ...state(), existingRead: probe.current.deploy.existingRead });
    expect(display.cardNote.text).toMatch(/^Couldn’t open the running game/);
    expect(display.stripLine2('loadout')).toBe('Couldn’t open the running game');
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_GAME); });
    await flush();
    expect(h.owned).toHaveBeenCalledTimes(1);
    await advance(EXISTING_READ_RETRY_MS);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_GAME); });
    await flush();
    expect(h.owned).toHaveBeenCalledTimes(2);
    expect(bridge.onOpenBattle).not.toHaveBeenCalled();
  });

  it('a foreign document from the read is no answer: nothing opens', async () => {
    h.owned = vi.fn(async () => ({ id: 'battle-running', ownerId: 'uid-B' }));
    await deployOnce();
    posts[0].answer(EXISTING());
    await flush();
    expect(bridge.onOpenBattle).not.toHaveBeenCalled();
    expect(probe.current.deploy.existingRead.status).toBe('error');
  });

  it('409 review-due: the shared line, the Forge action, and no automatic POST — dismissal re-reads, the next hold is the intent', async () => {
    const hub = { onOpenForge: vi.fn() };
    render({ hub });
    await deployOnce();
    posts[0].answer(REVIEW_DUE());
    await flush();
    expect(attempt().phase).toBe('refused');
    const display = deployDisplay(state());
    expect(display.cardLine.text).toBe(DUE_DEPLOY_LINE);
    expect(display.cardLine.action.kind).toBe(DISPLAY_ACTIONS.OPEN_FORGE_REVIEW);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_FORGE_REVIEW); });
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: 'watchlists', watchlistId: null, returnTo: 'dashboard' });
    await advance(120000);
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(state().displayState).toBe('ready');
  });

  it('429 "Deploy already in progress" reads as that refusal on the card and the strip, not as lost contact', async () => {
    await deployOnce();
    posts[0].answer(IN_PROGRESS());
    await flush();
    const display = deployDisplay(state());
    expect(state().displayState).toBe('failed');
    expect(display.cardLine.text).toBe(DEPLOY_IN_PROGRESS_LINE);
    expect(display.stripLine2('loadout')).toBe(DEPLOY_IN_PROGRESS_LINE);
  });

  it('a fast refusal and a losing late callback: the guard holds until acknowledgment, and a stale ceremony note changes nothing', async () => {
    await deployOnce();
    posts[0].answer(IN_PROGRESS());
    await flush();
    const before = probe.current.snapshot.state;
    act(() => { probe.current.api.phaseChanged({ attemptId: 'attempt_stale', phase: 'reveal', errorTone: null }); });
    expect(probe.current.snapshot.state).toBe(before);
    press(CARD);
    expect(frames.pending()).toBe(0);
    act(() => { probe.current.api.dismiss(); });
    expect(attempt().phase).toBe('idle');
    expect(state().canStart).toBe(true);
  });
});

describe('lifetime: the root outlives the hub; a runtime disable; the root unmounting (§4, §5.4, R-S2b-8)', () => {
  it('ceremony on: it mounts at the root with the attempt id, after the due check, and survives the hub unmounting', async () => {
    h.ceremonyOn = true;
    holdToThreshold();
    await advance(450);
    await flush();
    const id = attempt().attemptId;
    expect(container.querySelector(`[data-ceremony="${id}"]`)).not.toBeNull();
    expect(h.ceremonies.at(-1)).toMatchObject({ attemptId: id, deployResult: { status: 'pending' } });
    render({ showHub: false });
    expect(container.querySelector(`[data-ceremony="${id}"]`)).not.toBeNull();
    render();
    expect(container.querySelectorAll('[data-ceremony]')).toHaveLength(1);
    posts[0].answer(IN_PROGRESS());
    await flush();
    expect(h.ceremonies.at(-1).deployResult).toMatchObject({ status: 'error', reason: 'in_progress' });
    act(() => { h.ceremonies.at(-1).onDismiss(); });
    expect(container.querySelector('[data-ceremony]')).toBeNull();
    expect(attempt().phase).toBe('idle');
  });

  it('ceremony on: while it is open the app behind it is inert (spec §10); closing it gives the app back', async () => {
    h.ceremonyOn = true;
    container.id = 'root';
    holdToThreshold();
    await advance(450);
    await flush();
    expect(container.hasAttribute('inert')).toBe(true);
    posts[0].answer(IN_PROGRESS());
    await flush();
    act(() => { h.ceremonies.at(-1).onDismiss(); });
    expect(container.hasAttribute('inert')).toBe(false);
    container.removeAttribute('id');
  });

  it('ceremony on: an explicit creation\'s Enter goes to App once, after the owner and epoch are checked again', async () => {
    h.ceremonyOn = true;
    holdToThreshold();
    await advance(450);
    await flush();
    posts[0].answer(CREATED());
    await flush();
    expect(attempt().phase).toBe('created');
    act(() => { h.ceremonies.at(-1).onEnterBattle(null); });
    expect(bridge.onEnterBattle).toHaveBeenCalledTimes(1);
    expect(bridge.onEnterBattle).toHaveBeenCalledWith(null);
    expect(attempt().phase).toBe('idle');
  });

  it('ceremony on: an Enter after an identity change enters nothing', async () => {
    h.ceremonyOn = true;
    holdToThreshold();
    await advance(450);
    await flush();
    posts[0].answer(CREATED());
    await flush();
    const enter = h.ceremonies.at(-1).onEnterBattle;
    signIn('uid-B');
    act(() => { enter({ id: 'battle-new', ownerId: 'uid-A' }); enter(null); });
    expect(bridge.onEnterBattle).not.toHaveBeenCalled();
  });

  it('ceremony on: an identity change closes the ceremony at the change itself, not when the late result arrives', async () => {
    h.ceremonyOn = true;
    holdToThreshold();
    await advance(450);
    await flush();
    expect(container.querySelector('[data-ceremony]')).not.toBeNull();
    signIn('uid-B');
    expect(container.querySelector('[data-ceremony]')).toBeNull();
  });

  it('a runtime disable: a charging hold cancels and no new attempt starts; a committed one completes once', async () => {
    press(CARD);
    frameAt(600);
    render({ hubEnabled: false });
    expect(currentHold()).toBeNull();
    press(CARD);
    expect(frames.pending()).toBe(0);
    // …a hold committed before the disable keeps its request.
    render({ hubEnabled: true });
    expect(probe.current.snapshot.flagDisabled).toBe(true);
  });

  it('a committed hold before a runtime disable still deploys, once', async () => {
    holdToThreshold();
    render({ hubEnabled: false });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('the root unmounting releases a beat it will never run and revokes every callback: no late promise revives anything', async () => {
    holdToThreshold();
    act(() => root.unmount());
    await advance(450);
    await flush();
    expect(h.deploy).not.toHaveBeenCalled();
    expect(currentHold()).toBeNull();
    root = createRoot(container);
  });

  it('…and a request in flight when the root goes: its answer reaches nothing', async () => {
    holdToThreshold();
    await advance(450);
    await flush();
    const post = posts[0];
    act(() => root.unmount());
    expect(post.isCurrent()).toBe(false);
    post.answer(CREATED());
    await flush();
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(bridge.refreshActiveBattles).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});

// ── The review's fix round (S2b report §8): each row fails on the build head 8b2eb835 ──────────────────────────
describe('fix round — the review\'s confirmed findings', () => {
  async function committedAndOut(id = CARD) {
    holdToThreshold(id);
    await advance(450);
    await flush();
  }

  it('W4-1: ceremony off, a creation whose handoff threw — "Deployed · Enter battle", and Enter reads the real battle and enters it', async () => {
    const battle = { id: 'battle-new', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' };
    h.owned = vi.fn(async () => battle);
    await committedAndOut();
    posts[0].answer({ outcome: 'handoff_failed', success: false, postIssued: true, httpStatus: 200, battleId: 'battle-new', error: 'deploy_handoff' });
    await flush();
    expect(state().displayState).toBe('confirmed');
    expect(state().action).toBe(DISPLAY_ACTIONS.ENTER_BATTLE);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.ENTER_BATTLE); });
    await flush();
    expect(h.owned).toHaveBeenCalledWith('battle-new', 'uid-A');
    expect(bridge.onEnterBattle).toHaveBeenCalledWith(battle);
    expect(attempt().phase).toBe('idle');
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('W4-5: …and when that read fails, the card says so and its Retry waits 30 s — no silent dead end, no read storm', async () => {
    h.owned = vi.fn(async () => { throw new Error('offline'); });
    await committedAndOut();
    posts[0].answer({ outcome: 'handoff_failed', success: false, postIssued: true, httpStatus: 200, battleId: 'battle-new', error: 'deploy_handoff' });
    await flush();
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.ENTER_BATTLE); });
    await flush();
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.ENTER_BATTLE); });
    await flush();
    expect(h.owned).toHaveBeenCalledTimes(1);
    const display = deployDisplay({ ...state(), existingRead: probe.current.deploy.existingRead });
    expect(display.cardNote.text).toMatch(/^Couldn’t open the running game/);
    await advance(EXISTING_READ_RETRY_MS);
    h.owned = vi.fn(async () => ({ id: 'battle-new', ownerId: 'uid-A' }));
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.ENTER_BATTLE); });
    await flush();
    expect(bridge.onEnterBattle).toHaveBeenCalledTimes(1);
  });

  it('W4-2: ceremony on, closed while the request was out, then created — the hub offers Enter (the stash), never a "Finishing" no ceremony will finish', async () => {
    h.ceremonyOn = true;
    await committedAndOut();
    act(() => { h.ceremonies.at(-1).onDismiss(); });
    expect(container.querySelector('[data-ceremony]')).toBeNull();
    expect(attempt().phase).toBe('submitting');
    posts[0].answer(CREATED());
    await flush();
    expect(state().displayState).toBe('confirmed');
    expect(state().action).toBe(DISPLAY_ACTIONS.ENTER_BATTLE);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.ENTER_BATTLE); });
    expect(bridge.onEnterBattle).toHaveBeenCalledWith(null);
    expect(attempt().phase).toBe('idle');
  });

  it('W2-1: an identity change frees the slot of a hold whose request is still out — the new account\'s hold claims and deploys at once', async () => {
    await committedAndOut();
    expect(currentHold()).toMatchObject({ phase: 'locked' });
    signIn('uid-B');
    expect(currentHold()).toBeNull();
    expect(state().canStart).toBe(true);
    holdToThreshold(STRIP);
    expect(currentHold()).toMatchObject({ controlId: STRIP, phase: 'locked' });
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(2);
    expect(attempt()).toMatchObject({ capturedUid: 'uid-B' });
    // The old request's late settle frees nothing of B's (the hook's release is token-scoped).
    posts[0].answer(CREATED());
    await flush();
    expect(attempt()).toMatchObject({ capturedUid: 'uid-B', phase: 'submitting' });
  });

  it('W3-1, W3-2: once the hold has started its request, the attempt speaks — no "Locked in" after a refusal, and the control is not live', async () => {
    await committedAndOut();
    expect(probe.current.deploy.holdPhase).toBeNull();
    posts[0].answer(IN_PROGRESS());
    await flush();
    expect(probe.current.snapshot.state.hold).toMatchObject({ phase: 'locked' }); // the record stays the attempt's
    expect(probe.current.deploy.holdPhase).toBeNull();
    expect(probe.current.deploy.holdControlId).toBeNull();
    expect(buttonOf(CARD).disabled).toBe(true);
  });

  it('W3-3: a control mounted inside its own committed beat (a site flip) says "Locked in", not the idle look', async () => {
    holdToThreshold();
    render({ showHub: false });
    render();
    expect(probe.current.deploy.holdPhase).toBe('locked');
    expect(buttonOf(CARD).textContent).toContain('Locked in');
    await advance(450);
    await flush();
    expect(h.deploy).toHaveBeenCalledTimes(1);
  });

  it('W3-4: a committed hold whose request cannot start gives its record back — the next hold can claim', async () => {
    const noId = { status: 'ready', agent: { ownerId: 'uid-A', name: 'Nameless', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 1, error: null };
    render({ over: { agent: noId } });
    holdToThreshold();
    await advance(450);
    await flush();
    expect(h.deploy).not.toHaveBeenCalled();
    expect(probe.current.snapshot.state.hold).toBeNull();
    expect(state().canStart).toBe(true);
  });

  it('W4-4: after a failed owned read, Open game reads again once its wait is over — and opens what it finds', async () => {
    h.owned = vi.fn(async () => { throw new Error('offline'); });
    await committedAndOut();
    posts[0].answer(EXISTING());
    await flush();
    const battle = { id: 'battle-running', ownerId: 'uid-A', status: 'active' };
    h.owned = vi.fn(async () => battle);
    await advance(EXISTING_READ_RETRY_MS);
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_GAME); });
    await flush();
    expect(bridge.onOpenBattle).toHaveBeenCalledWith(battle);
    expect(attempt().phase).toBe('idle');
  });

  it('W4-6: the ceremony revealed (its gates admitted a battle) but the provider\'s read came back empty — still unresolved, never acknowledged as clear', async () => {
    h.ceremonyOn = true;
    await committedAndOut();
    posts[0].answer(UNCERTAIN());
    await flush();
    const id = attempt().attemptId;
    act(() => { probe.current.api.phaseChanged({ attemptId: id, phase: 'reveal', errorTone: null }); });
    await flush();
    expect(attempt()).toMatchObject({ phase: 'uncertain', reconciliationStatus: 'error' });
    act(() => { h.ceremonies.at(-1).onDismiss(); });
    expect(attempt().phase).toBe('uncertain');
    expect(state().action).toBe(DISPLAY_ACTIONS.CHECK_DEPLOYMENT);
  });

  it('W4-7: the target\'s recorded lastDeployedAt still counts when it lands after a quick dismissal', async () => {
    await committedAndOut();
    posts[0].answer(IN_PROGRESS());
    await flush();
    act(() => { probe.current.api.dismiss(); });
    expect(attempt().phase).toBe('idle');
    h.targetProgress = { deployProgress: null, lastDeployedAt: new Date(nowMs - 10000).toISOString(), lastDecision: null, targetKnown: true };
    render();
    expect(state().displayState).toBe('cooldown');
    expect(state().cooldownUntil).toBe(nowMs - 10000 + 120000);
  });

  it('W4-8: Enter refuses a document that is not the battle the record names', async () => {
    await committedAndOut();
    posts[0].answer({ outcome: 'handoff_failed', success: false, postIssued: true, httpStatus: 200, battleId: 'battle-new', error: 'deploy_handoff' });
    await flush();
    act(() => { probe.current.api.enterBattle({ id: 'battle-other', ownerId: 'uid-A' }); });
    expect(bridge.onEnterBattle).not.toHaveBeenCalled();
    expect(attempt().phase).toBe('created');
  });

  it('W2-2: a former owner\'s agent, still in the render that carries the new identity, stamps no cooldown under the new uid', async () => {
    signIn('uid-B');
    const stale = { status: 'ready', agent: { id: 'agent-uid-A', ownerId: 'uid-A', lastDeployedAt: new Date(nowMs - 1000).toISOString(), stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 1, error: null };
    render({ over: { agent: stale } });
    expect(probe.current.snapshot.state.cooldowns['uid-B']).toBeUndefined();
  });

  it('the post-check half of FR-1: a creation that answers after the ceremony\'s check already settled on its error gets a fresh ceremony', async () => {
    h.ceremonyOn = true;
    await committedAndOut();
    const id = attempt().attemptId;
    const firstMount = h.ceremonies.at(-1).mount;
    act(() => { probe.current.api.phaseChanged({ attemptId: id, phase: 'error', errorTone: 'lost_contact' }); });
    posts[0].answer(CREATED());
    await flush();
    expect(h.ceremonies.at(-1).mount).toBeGreaterThan(firstMount);
    expect(h.ceremonies.at(-1).deployResult).toMatchObject({ status: 'success', agentBattleId: 'battle-new' });
    expect(container.querySelectorAll('[data-ceremony]')).toHaveLength(1);
  });

  it('…and an answer that lands while the ceremony is still running keeps the one instance', async () => {
    h.ceremonyOn = true;
    await committedAndOut();
    const firstMount = h.ceremonies.at(-1).mount;
    posts[0].answer(CREATED());
    await flush();
    expect(h.ceremonies.at(-1).mount).toBe(firstMount);
  });
});
