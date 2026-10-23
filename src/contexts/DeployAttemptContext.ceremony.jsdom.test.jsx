// @vitest-environment jsdom
//
// src/contexts/DeployAttemptContext.ceremony.jsdom.test.jsx
//
// Command Center slice S2b — the hub's attempt through the REAL deploy ceremony
// and its REAL stage machine, the REAL deploy service, the shells' REAL mapping,
// the REAL target-scoped verifier and the REAL owned targeted read, with only the
// network and Firestore beneath them mocked, and the REAL identity source fed
// through a mocked firebase/auth. Real timers (the machine's own clock).
//
// Spec V1.2 §11.3 rows: "Existing battle R1" (200 battleCreated:false: no new
// reveal or Enter, no create callback, no synthetic id; the owned document
// hydrates through the dedicated targeted read, a league battle included);
// "P1b refusal" (a 409 review-due: the shared line, the Forge action, no
// automatic POST); C3's recovered resolution (a 500 after the POST, the
// preserved gates admit the owned battle → provider created/recovered, "Battle
// confirmed", Enter opens it); C2's A → B → A with the real service.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({
  authListeners: [],
  uid: 'uid-A',
  getDocsFromServer: null,
  getDocFromServer: null,
  targetProgress: { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false },
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ __collection: name }),
  query: (...parts) => ({ __query: parts }),
  where: (...w) => ({ __where: w }),
  limit: (n) => ({ __limit: n }),
  getDocs: vi.fn(),
  getDocsFromServer: (...args) => h.getDocsFromServer(...args),
  doc: (_db, collectionName, id) => ({ __doc: `${collectionName}/${id}` }),
  getDocFromServer: (...args) => h.getDocFromServer(...args),
}));
vi.mock('../firebase/config', () => ({ db: {}, get auth() { return { currentUser: h.uid ? { uid: h.uid } : null }; } }));
vi.mock('../firebase/authService', () => ({
  getIdToken: async () => 'tok',
  getCurrentUser: () => (h.uid ? { uid: h.uid } : null),
}));
vi.mock('../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../hooks/useDeployTargetProgress', () => ({ default: () => h.targetProgress }));
vi.mock('../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../components/Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('../components/Dashboard/deployCeremony/ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeployCeremonyOn: () => true,
  CASUAL_CLONE_CONCURRENCY_ENABLED: true,
}));

vi.setConfig({ testTimeout: 15000 });
const WAIT_MS = 4000;

const { DeployAttemptProvider } = await import('./DeployAttemptContext');
const { resetAuthIdentityForTests, readAuthIdentity } = await import('../services/authIdentity');
const { __resetHoldClaim } = await import('../hooks/holdClaim');
const { FakeHub, HubRoot } = await import('../components/CommandCenter/__fixtures__/deployAttemptKit');
const { deployDisplay, DISPLAY_ACTIONS } = await import('../components/CommandCenter/hub/deployDisplay');
const { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } = await import('../constants/hypothesisRecords');

const CLONE = 'casual-agent-uid-A';
const RUNNING_ID = 'battle-running';
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
const hourFromNow = () => new Date(Date.now() + 3600000).toISOString();

let container;
let root;
let probe;
let bridge;
let rowGeneration = 0;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.uid = 'uid-A';
  h.getDocsFromServer = vi.fn(async () => ({ empty: true, docs: [] }));
  h.getDocFromServer = vi.fn(async () => ({ exists: () => false }));
  h.targetProgress = { deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false };
  bridge = {
    onCreateAgentBattle: vi.fn(() => 'battle-new'),
    onEnterBattle: vi.fn(),
    onOpenBattle: vi.fn(),
    refreshActiveBattles: vi.fn(),
    clearCeremonyStash: vi.fn(),
    userName: 'flash',
  };
  probe = { current: null };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  act(() => {
    root.render(
      <DeployAttemptProvider hubEnabled {...bridge}>
        <HubRoot><FakeHub controls={['hub-deploy-card']} probe={probe} hub={{ onOpenForge: bridge.onOpenForge }} /></HubRoot>
      </DeployAttemptProvider>,
    );
  });
  act(() => { for (const cb of [...h.authListeners]) cb({ uid: 'uid-A' }); });
});

afterEach(() => {
  rowGeneration += 1;
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

const text = () => document.body.textContent || '';
const button = (label) => [...document.body.querySelectorAll('button')].find((b) => (b.textContent || '').includes(label));
const waitFor = async (pred, what) => {
  const gen = rowGeneration;
  const start = Date.now();
  while (gen === rowGeneration && !pred() && Date.now() - start < WAIT_MS) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  if (!pred()) throw new Error(`never reached: ${what} — text: ${text().slice(0, 300)}`);
};
const attempt = () => probe.current.snapshot?.state?.attempt ?? null;
const decideAnswers = (decide) => {
  globalThis.fetch = vi.fn(async (url) => (url === '/api/agent/ensure-casual-clone' ? json(200, { cloneId: CLONE }) : decide()));
};
const decidePosts = () => globalThis.fetch.mock.calls.filter(([url]) => url === '/api/agent/decide').length;
const tap = async () => { let r; await act(async () => { r = await probe.current.deploy.tap('hub-deploy-card'); }); return r; };

describe('Existing battle R1 — the hub\'s attempt through the real ceremony (spec §11.3)', () => {
  const EXISTING_200 = { success: true, battleCreated: false, existingBattleId: RUNNING_ID, portfolio: { star: [] }, bench: { stocks: [] } };

  it('the existing terminal: no reveal, no Enter, no create callback, no synthetic id; the owned document hydrates once, by its id', async () => {
    // A LEAGUE battle: the target-scoped verifier skips it (its attribution filter), the targeted read resolves it.
    const leagueDoc = { agentId: CLONE, ownerId: 'uid-A', status: 'active', groupId: 'g1', expiresAt: hourFromNow(), portfolio: { star: [] } };
    h.getDocFromServer = vi.fn(async () => ({ exists: () => true, id: RUNNING_ID, data: () => leagueDoc }));
    decideAnswers(() => json(200, EXISTING_200));
    const result = await tap();
    expect(result).toMatchObject({ outcome: 'existing_battle', existingBattleId: RUNNING_ID });
    await waitFor(() => text().includes('already has a game running'), 'the existing terminal');
    expect(text()).not.toContain('ready for battle');
    expect(button('Enter the battle')).toBeUndefined();
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('agentBattleId');
    expect(attempt()).toMatchObject({ phase: 'existing', result: { battleId: RUNNING_ID }, ceremonyPhase: 'existing' });
    await waitFor(() => probe.current.deploy.existingRead?.status === 'found', 'the owned read');
    expect(h.getDocFromServer).toHaveBeenCalledTimes(1);
    expect(h.getDocFromServer.mock.calls[0][0]).toEqual({ __doc: `agentBattles/${RUNNING_ID}` });
    // Open hands over the owned document the targeted read returned — the league battle.
    await waitFor(() => Boolean(button('Open game')) && button('Open game').getAttribute('aria-disabled') !== 'true', 'Open enabled');
    act(() => { button('Open game').click(); });
    expect(bridge.onOpenBattle).toHaveBeenCalledTimes(1);
    expect(bridge.onOpenBattle.mock.calls[0][0]).toMatchObject({ id: RUNNING_ID, groupId: 'g1', ownerId: 'uid-A' });
    expect(attempt().phase).toBe('idle');
    expect(decidePosts()).toBe(1);
  });
});

describe('P1b refusal — a 409 review-due through the real service and ceremony', () => {
  it('the shared line in the ceremony and on the card, the Forge action, and no automatic POST', async () => {
    bridge.onOpenForge = vi.fn();
    act(() => {
      root.render(
        <DeployAttemptProvider hubEnabled {...bridge}>
          <HubRoot><FakeHub controls={['hub-deploy-card']} probe={probe} hub={{ onOpenForge: bridge.onOpenForge }} /></HubRoot>
        </DeployAttemptProvider>,
      );
    });
    decideAnswers(() => json(409, { error: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE }));
    await tap();
    await waitFor(() => text().includes(DUE_DEPLOY_LINE), 'the shared line in the ceremony');
    expect(attempt()).toMatchObject({ phase: 'refused', result: { kind: 'review_due', line: DUE_DEPLOY_LINE } });
    const display = deployDisplay(probe.current.state);
    expect(display.cardLine).toMatchObject({ text: DUE_DEPLOY_LINE, action: { kind: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW } });
    act(() => { probe.current.deploy.attemptAction(DISPLAY_ACTIONS.OPEN_FORGE_REVIEW); });
    expect(bridge.onOpenForge).toHaveBeenCalledWith({ area: 'watchlists', watchlistId: null, returnTo: 'dashboard' });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(decidePosts()).toBe(1);
  });
});

describe('C3 — an uncertain answer the preserved gates resolve: created, recovered', () => {
  it('a 500 after the POST; the ceremony admits the owned battle → "Battle confirmed", and Enter opens that document', async () => {
    const found = { agentId: CLONE, ownerId: 'uid-A', status: 'active', expiresAt: hourFromNow(), portfolio: { star: [] } };
    h.getDocsFromServer = vi.fn(async () => ({ empty: false, docs: [{ id: 'battle-found', data: () => found }] }));
    decideAnswers(() => json(500, { error: 'boom' }));
    await tap();
    await waitFor(() => attempt()?.phase === 'created', 'the recovered creation');
    expect(attempt()).toMatchObject({ phase: 'created', resolution: { kind: 'recovered', battleId: 'battle-found' } });
    // The original service evidence stays uncertain.
    expect(attempt().result).toMatchObject({ kind: 'uncertain' });
    expect(deployDisplay(probe.current.state).status).toBe('Battle confirmed');
    await waitFor(() => Boolean(button('Enter the battle')), 'the reveal');
    act(() => { button('Enter the battle').click(); });
    expect(bridge.onEnterBattle).toHaveBeenCalledTimes(1);
    expect(bridge.onEnterBattle.mock.calls[0][0]).toMatchObject({ id: 'battle-found', ownerId: 'uid-A' });
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(decidePosts()).toBe(1);
  });
});

describe('C2 — A → B → A while the real service waits on the POST', () => {
  it('the uid is A again, but the epoch moved: the service returns orphaned, nothing is handed to App, the ceremony is gone', async () => {
    let answer;
    globalThis.fetch = vi.fn((url) => {
      if (url === '/api/agent/ensure-casual-clone') return Promise.resolve(json(200, { cloneId: CLONE }));
      return new Promise((r) => { answer = r; });
    });
    let pending;
    act(() => { pending = probe.current.deploy.tap('hub-deploy-card'); });
    await waitFor(() => typeof answer === 'function', 'the POST');
    expect(document.querySelector('.deploy-ceremony-overlay')).not.toBeNull();
    act(() => { h.uid = 'uid-B'; for (const cb of [...h.authListeners]) cb({ uid: 'uid-B' }); });
    expect(document.querySelector('.deploy-ceremony-overlay')).toBeNull();
    act(() => { h.uid = 'uid-A'; for (const cb of [...h.authListeners]) cb({ uid: 'uid-A' }); });
    expect(readAuthIdentity()).toMatchObject({ uid: 'uid-A', authEpoch: 3 });
    answer(json(200, { success: true, battleCreated: true, agentBattleId: 'battle-late', portfolio: { star: [] }, bench: { stocks: [] } }));
    let result;
    await act(async () => { result = await pending; });
    expect(result).toMatchObject({ outcome: 'orphaned', postIssued: true });
    expect(bridge.onCreateAgentBattle).not.toHaveBeenCalled();
    expect(attempt()).toBeNull();
    expect(document.querySelector('.deploy-ceremony-overlay')).toBeNull();
    expect(probe.current.state.displayState).toBe('ready');
  });
});
