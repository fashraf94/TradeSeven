// @vitest-environment jsdom
//
// Independent review of slice S2b (Fable, 2026-10-23) — reproductions. The hub's
// attempt through the REAL deploy ceremony and its REAL stage machine, under a
// fake clock (setInterval, setTimeout, Date and performance.now all fake; rAF
// controllable and never run), with the deploy service, the verifier and the
// owned read as stand-ins a row answers. Each row below asserts what spec V1.2
// §5.2 / §5.4 says the player should see; a row that FAILS at the reviewed head
// is the finding's proof.
//
// Committed from the review's appendix A (docs/audits/20261023_FABLE_REVIEW_S2B_PROVIDER.md);
// all six rows fail at the reviewed head 5e192c9b and pass after the S2b fix round
// (build report §16). Any line changed from the appendix is marked "S2b fix round".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  verify: null,
  owned: null,
  targetProgress: { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false },
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'uid-A' } } }));
vi.mock('../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../services/agentBattleVerify', () => ({ findActiveBattleForAgent: (...args) => h.verify(...args) }));
vi.mock('../services/ownedBattleRead', () => ({ readOwnedBattle: (...args) => h.owned(...args) }));
vi.mock('../hooks/useDeployTargetProgress', () => ({ default: () => h.targetProgress }));
vi.mock('../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../components/Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('../components/Dashboard/deployCeremony/ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => false,
  isDeployCeremonyOn: () => true,
}));

import { resetAuthIdentityForTests } from '../services/authIdentity';
import { __resetHoldClaim } from '../hooks/holdClaim';
import { DeployAttemptProvider } from './DeployAttemptContext';
import { deployDisplay, DISPLAY_ACTIONS } from '../components/CommandCenter/hub/deployDisplay';
import { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } from '../constants/hypothesisRecords';
import { FakeHub, HubRoot, createFrames } from '../components/CommandCenter/__fixtures__/deployAttemptKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 60000 });

const T0 = 1_800_000_000_000;
const CARD = 'hub-deploy-card';
const RUNNING = { id: 'battle-running', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' };
let nowMs;
let frames;
let container;
let root;
let probe;
let bridge;
let posts;
let pendingVerify;

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

const EXISTING = () => ({ outcome: 'existing_battle', success: false, existingBattleId: RUNNING.id, postIssued: true, httpStatus: 200 });
const CREATED = () => ({ outcome: 'created', success: true, agentBattleId: 'battle-new' });
const REVIEW_DUE = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 409, status: 409, error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE });
const COOLDOWN_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Please wait 2 minutes between deploys', reason: 'cooldown' });
const LIMITER_429 = () => ({ outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Too many requests', retryAfter: 90 });

const text = () => document.body.textContent || '';
const overlay = () => document.querySelector('.deploy-ceremony-overlay');
const buttons = () => [...document.body.querySelectorAll('button')];
const button = (label) => buttons().find((b) => (b.textContent || '').includes(label) || b.getAttribute('aria-label') === label);
const attempt = () => probe.current.snapshot?.state?.attempt ?? null;
const state = () => probe.current.state;

const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });
const jump = async (ms) => { await act(async () => { nowMs += ms; vi.setSystemTime(nowMs); vi.advanceTimersByTime(100); }); };
const advance = async (ms) => { await act(async () => { nowMs += ms; vi.advanceTimersByTime(ms); }); };
const flush = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }); };
const tap = async () => { act(() => { probe.current.deploy.tap(CARD); }); await flush(); };

/** The watchdog's check: the verifier answers "no battle" twice (its 400 ms second look included), the machine ends on its tone. */
const checkRunsEmpty = async () => {
  await advance(100);
  await flush();
  await advance(400);
  await flush();
  await flush();
};

beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.targetProgress = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false };
  h.verify = vi.fn(async () => ({ found: false, battle: null }));
  h.owned = vi.fn(async () => null);
  posts = [];
  pendingVerify = null;
  h.deploy = vi.fn((agentId, onCreate, onTarget) => {
    const d = deferred();
    posts.push({ agentId, onCreate, onTarget, answer: d.resolve });
    onTarget?.(agentId);
    return d.promise;
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  nowMs = T0;
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  frames = createFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
  bridge = {
    onCreateAgentBattle: vi.fn(() => 'battle-new'),
    onEnterBattle: vi.fn(),
    onOpenBattle: vi.fn(),
    refreshActiveBattles: vi.fn(),
    clearCeremonyStash: vi.fn(),
    onOpenForge: vi.fn(),
    userName: 'flash',
  };
  probe = { current: null };
  container = document.createElement('div');
  container.id = 'root'; // App's root: the provider marks it inert while its overlay is open
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  act(() => {
    root.render(
      <DeployAttemptProvider hubEnabled {...bridge}>
        <HubRoot><FakeHub controls={[CARD]} probe={probe} hub={{ onOpenForge: bridge.onOpenForge }} /></HubRoot>
      </DeployAttemptProvider>,
    );
  });
  signIn('uid-A');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FRB — the hand-off to the ceremony after the watchdog (R-S2b-9a, the half the provider owns)', () => {
  it('existing: the owned read is still out when the watchdog latches the error — the record says existing, the ceremony must too (§5.2 one vocabulary)', async () => {
    const read = deferred();
    h.owned = vi.fn(() => read.promise);
    await tap();
    expect(overlay()).not.toBeNull();
    expect(posts).toHaveLength(1);

    // 89 s of theater, then the server's "already running" answer. Its hand-off to the ceremony waits for the owned read.
    await jump(89000);
    posts[0].answer(EXISTING());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'existing', result: { battleId: RUNNING.id } });
    expect(h.owned).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain('already has a game running');

    // The 90 s watchdog fires inside that window; its check finds nothing; the machine latches "Couldn't confirm".
    await jump(1000);
    expect(h.verify).toHaveBeenCalled();
    await checkRunsEmpty();
    expect(text()).toMatch(/Couldn.t confirm the deploy/);

    // Now the owned read answers and the provider hands the existing result to the ceremony.
    read.resolve(RUNNING);
    await flush();
    await flush();
    expect(probe.current.deploy.existingRead).toMatchObject({ status: 'found', battleId: RUNNING.id });
    expect(attempt().phase).toBe('existing');

    // What the player must see (spec §5.2, existing row; R-S2b-9a's intent): the existing terminal, never "Couldn't confirm".
    expect(text()).toContain('already has a game running');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
  });

  it('created: the answer lands while the watchdog\'s check is in flight — the record says created, the ceremony must not say "Couldn\'t confirm"', async () => {
    h.verify = vi.fn(() => { pendingVerify = deferred(); return pendingVerify.promise; });
    await tap();
    await jump(90000); // the watchdog: verifying, the check held open by the row
    expect(h.verify).toHaveBeenCalledTimes(1);
    expect(attempt().ceremonyPhase).toBe('verifying');

    posts[0].answer(CREATED());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'created', result: { kind: 'created', battleId: 'battle-new' } });

    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    await advance(400);
    await flush();
    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    await flush();

    // The record says created, so the ceremony may not say the opposite (§5.2 created row: theater/finishing until the reveal gates).
    expect(attempt().phase).toBe('created');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
  });
});

describe('FRB — definitive refusals through the real ceremony (§5.2 refused row: "error with confirmed-refusal tone")', () => {
  it('a 429 cooldown refusal: the hub says "Deployment refused"; the ceremony must not hide it behind lost-contact copy', async () => {
    await tap();
    posts[0].answer(COOLDOWN_429());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused', result: { kind: 'refused' } });
    await checkRunsEmpty();
    expect(deployDisplay(state()).status).toBe('Deployment refused');
    // The ceremony's own words for the same answer:
    expect(text()).not.toContain('Deployment unconfirmed');
    expect(text()).not.toMatch(/Couldn.t confirm the deploy/);
    expect(text()).toContain('Deployment refused');
  });

  it('a 409 review-due (P1b): the Forge action must be reachable — the ceremony is modal over an inert hub, and Back to hub must not drop it', async () => {
    await tap();
    posts[0].answer(REVIEW_DUE());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused', result: { kind: 'review_due', line: DUE_DEPLOY_LINE } });
    await checkRunsEmpty();
    expect(text()).toContain(DUE_DEPLOY_LINE);

    // The hub carries the action, under the ceremony: the app root is inert, so the player cannot press it there.
    expect(deployDisplay(state()).cardLine).toMatchObject({ action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW } });
    expect(container.hasAttribute('inert')).toBe(true);
    // The ceremony offers no Forge action of its own (and no Retry: the action is the Forge, not a Retry).
    // S2b fix round (founder ruling on FRB-2): the Forge action is reached through Back to hub, which closes the
    // ceremony and keeps the refusal; the ceremony gets no Forge control. The appendix asserted one in the overlay.
    const inOverlay = [...overlay().querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
    expect(inOverlay).toEqual(['Back to hub']);
    act(() => { button('Back to hub').click(); });
    expect(overlay()).toBeNull();
    expect(container.hasAttribute('inert')).toBe(false);
    expect(deployDisplay(state()).cardLine).toMatchObject({
      text: DUE_DEPLOY_LINE, action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW }, dismiss: { kind: 'dismiss' },
    });
  });

  it('a 409 review-due (P1b): Back to hub must not drop the Forge action the hub carries', async () => {
    await tap();
    posts[0].answer(REVIEW_DUE());
    await flush();
    await checkRunsEmpty();
    expect(deployDisplay(state()).cardLine).toMatchObject({ action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW } });
    // Back to hub: per §5.4 the refusal's primary action is the Forge; acknowledging it away leaves the player none.
    act(() => { button('Back to hub').click(); });
    expect(bridge.onOpenForge).not.toHaveBeenCalled();
    expect(state().action).toBe(DISPLAY_ACTIONS.OPEN_FORGE_REVIEW);
  });

  it('a refusal under a known cooldown (the limiter\'s Retry-After): the ceremony must say when Retry opens, as the shells\' error surface does', async () => {
    await tap();
    posts[0].answer(LIMITER_429());
    await flush();
    expect(attempt()).toMatchObject({ phase: 'refused' });
    expect(attempt().cooldownUntil).toBe(Date.now() + 90000);
    await checkRunsEmpty();
    expect(state().retryBlock).toMatchObject({ displayState: 'cooldown' });
    // CeremonyError renders its countdown only when it is handed onRetry; the hub's root ceremony withholds it while the table blocks.
    expect(button('Retry available in') ?? button('Try again')).toBeDefined();
  });
});
