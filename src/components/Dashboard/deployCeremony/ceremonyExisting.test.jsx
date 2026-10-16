// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyExisting.test.jsx
//
// Command Center repair R1 — the ceremony with the REAL stage machine, fed by
// the REAL deploy service and the shells' REAL mapping (deployResult.js), over
// the REAL target-scoped verifier with only Firestore beneath it mocked:
//
//   service result  →  deployResultFor  →  <DeployCeremony deployResult>  →  machine
//
// Spec V1.2 §11.3 rows this file executes:
//   "Existing battle R1" — 200 battleCreated:false: the existing terminal, no
//     reveal, no Enter, no create callback, no synthetic agent_ id; Open hands
//     over the owned server document.
//   "P1b refusal" — a real 409 review-due: the shared line in details, no
//     Forge action in the shipped ceremony, nothing POSTed again by itself.
// Plus R-R1-6's onPhaseChange echo, and the recovery path (500 after the POST,
// document found) revealing exactly as before.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const {
  getDocsFromServerMock, authState, signedIn, getIdTokenMock, targetProgressState,
} = vi.hoisted(() => ({
  getDocsFromServerMock: vi.fn(),
  authState: { currentUser: { uid: 'uid-1' } },
  signedIn: { uid: 'uid-1' },
  getIdTokenMock: vi.fn(),
  targetProgressState: { value: null },
}));

// The REAL agentBattleVerify runs — only Firestore beneath it is mocked.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  query: vi.fn((...parts) => ({ __query: parts })),
  where: vi.fn((...w) => ({ __where: w })),
  limit: vi.fn((n) => ({ __limit: n })),
  getDocs: vi.fn(),
  getDocsFromServer: getDocsFromServerMock,
}));
vi.mock('../../../firebase/config', () => ({ db: { __db: true }, auth: authState }));
vi.mock('../../../firebase/authService', () => ({
  getIdToken: getIdTokenMock,
  getCurrentUser: () => (signedIn.uid ? { uid: signedIn.uid } : null),
}));
vi.mock('../../../hooks/useDeployTargetProgress', () => ({ default: () => targetProgressState.value }));
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../../Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('./ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));

// A row's waits stay well inside its own timeout, so a failing row fails on its
// assertion — never on vitest's timeout, whose still-running wait loop would
// leak act() calls into the rows after it.
vi.setConfig({ testTimeout: 15000 });
const WAIT_MS = 3000;

const { deployAgent } = await import('../../../services/agentDeploy.js');
const { deployResultFor } = await import('../deployResult.js');
const { default: DeployCeremony } = await import('./DeployCeremony.jsx');
const { DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE } = await import('../../../constants/hypothesisRecords');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid-1';
const RUNNING_ID = 'battle-running';
const OURS = '2026-10-16T14:00:00.000Z';
const hourFromNow = () => new Date(Date.now() + 3600000).toISOString();
const RUNNING_DOC = () => ({
  agentId: CLONE, ownerId: 'uid-1', status: 'active', expiresAt: hourFromNow(),
  portfolio: { star: [{ symbol: 'RUNPICK' }] },
});
const EXISTING_200 = {
  success: true, portfolioUpdated: true, battleCreated: false, reason: 'Agent already has an active battle',
  existingBattleId: RUNNING_ID, portfolio: { star: [] }, bench: { stocks: [] }, innerMonologue: 'm', strategyBrief: 'b',
};

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
const serverReturns = (...docs) => getDocsFromServerMock.mockResolvedValue({ empty: docs.length === 0, docs });
const docOf = (id, data) => ({ id, data: () => data });

let container; let root; let entered; let opened; let retried; let notes; let createCb;
// Bumped when a row ends: a wait loop from an earlier row stops instead of
// running on into the next one.
let rowGeneration = 0;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  entered = undefined; opened = []; retried = 0; notes = [];
  createCb = vi.fn();
  getDocsFromServerMock.mockReset();
  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue('tok');
  authState.currentUser = { uid: 'uid-1' };
  signedIn.uid = 'uid-1';
  targetProgressState.value = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  rowGeneration += 1;
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

/** The real service against a stubbed network: the clone resolves, decide answers `decide`. */
async function serviceResult(decide) {
  globalThis.fetch = vi.fn(async (url) => (url === '/api/agent/ensure-casual-clone' ? json(200, { cloneId: CLONE }) : decide));
  return deployAgent(RANKED, createCb, () => {});
}

const renderWith = (deployProgress, deployResult, extra = {}) => {
  targetProgressState.value = { deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true };
  act(() => {
    root.render(
      <DeployCeremony
        agent={{ id: RANKED, name: 'Nova', archetype: 'contrarian' }}
        agentName="Nova"
        targetAgentId={CLONE}
        deployResult={deployResult}
        onEnterBattle={(b) => { entered = b ?? null; }}
        onOpenBattle={(b) => { opened.push(b); }}
        onRetry={() => { retried += 1; }}
        onDismiss={() => {}}
        attemptId="att-1"
        onPhaseChange={(n) => { notes.push(n); }}
        {...extra}
      />,
    );
  });
};

const text = () => document.body.textContent || '';
const buttons = () => [...document.body.querySelectorAll('button')];
const button = (label) => buttons().find((b) => (b.textContent || '').includes(label));
const waitFor = async (pred, what, timeoutMs = WAIT_MS) => {
  const gen = rowGeneration;
  const start = Date.now();
  while (gen === rowGeneration && !pred() && Date.now() - start < timeoutMs) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  if (gen !== rowGeneration) throw new Error(`abandoned: ${what} (its row already ended)`);
  if (!pred()) throw new Error(`never reached: ${what} — text: ${text().slice(0, 300)}`);
};
const tick = async (ms = 150) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

// Mount clean (the §5 baseline), then the server begins our deploy and writes
// its checkpoints — through 'complete', which decide.js stamps in the decision
// write BEFORE its existing-battle check — and then the client's own result.
const runTo = async (deployResult, extra) => {
  renderWith(null, { status: 'pending' }, extra);
  renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, { status: 'pending' }, extra);
  await tick();
  renderWith({ stage: 'complete', deployId: OURS, updatedAt: `${OURS}-2` }, deployResult, extra);
};

describe('Existing battle R1 (spec §11.3) — the real machine with 200 battleCreated:false', () => {
  it('the service calls no create callback and fabricates no id; the mapping makes it `existing`', async () => {
    const result = await serviceResult(json(200, EXISTING_200));
    expect(createCb).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'existing_battle', success: false, existingBattleId: RUNNING_ID, postIssued: true, httpStatus: 200 });
    expect(deployResultFor(result)).toEqual({ status: 'existing', existingBattleId: RUNNING_ID, httpStatus: 200, postIssued: true });
    expect(JSON.stringify(result)).not.toMatch(/agent_/);
  });

  it('the existing terminal: no reveal, no Enter, even beside a complete checkpoint', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Already running'), 'the existing terminal');
    // Past the reveal's success grace, in case anything still drifts toward it.
    await tick(600);
    expect(text()).toContain('Nova already has a game running.');
    expect(text()).toContain('No new game was started.');
    expect(text()).not.toContain('Deployment complete');
    expect(text()).not.toContain('ready for battle');
    expect(text()).not.toMatch(/Deployment (failed|unconfirmed)/);
    expect(button('Enter the battle')).toBeUndefined();
    expect(entered).toBeUndefined();
    expect(createCb).not.toHaveBeenCalled();
  });

  it('Open hands over the OWNED SERVER DOCUMENT the server named, read through the target-scoped verifier', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => button('Open game') && !button('Open game').disabled, 'Open enabled');
    expect(getDocsFromServerMock).toHaveBeenCalled();
    act(() => { button('Open game').click(); });
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ id: RUNNING_ID, ownerId: 'uid-1', agentId: CLONE, portfolio: { star: [{ symbol: 'RUNPICK' }] } });
    expect(entered).toBeUndefined();
  });

  it('the shell\'s own live list answers first, without a read', async () => {
    const listed = { id: RUNNING_ID, ...RUNNING_DOC() };
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))), { liveBattles: [listed] });
    await waitFor(() => button('Open game') && !button('Open game').disabled, 'Open enabled');
    expect(getDocsFromServerMock).not.toHaveBeenCalled();
    act(() => { button('Open game').click(); });
    expect(opened).toEqual([listed]);
  });

  it('a missing document: "Couldn’t open the running game" and Retry, which reads again and deploys nothing', async () => {
    serverReturns();
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Couldn’t open the running game'), 'unavailable');
    expect(button('Open game')).toBeUndefined();
    const reads = getDocsFromServerMock.mock.calls.length;
    const posts = globalThis.fetch.mock.calls.length;
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    act(() => { button('Retry').click(); });
    await waitFor(() => button('Open game') && !button('Open game').disabled, 'Open after retry');
    expect(getDocsFromServerMock.mock.calls.length).toBeGreaterThan(reads);
    expect(globalThis.fetch.mock.calls.length).toBe(posts);
    expect(retried).toBe(0);
    expect(createCb).not.toHaveBeenCalled();
  });

  it('a foreign document is never offered', async () => {
    serverReturns(docOf(RUNNING_ID, { ...RUNNING_DOC(), ownerId: 'uid-2' }));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))), { liveBattles: [{ id: RUNNING_ID, ...RUNNING_DOC(), ownerId: 'uid-2' }] });
    await waitFor(() => text().includes('Couldn’t open the running game'), 'unavailable');
    expect(button('Open game')).toBeUndefined();
    expect(opened).toEqual([]);
  });

  it('another battle on the target is not the one the server named', async () => {
    serverReturns(docOf('battle-other', RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Couldn’t open the running game'), 'unavailable');
    expect(opened).toEqual([]);
  });

  it('the owner is read again at Open: a switch after the read opens nothing', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => button('Open game') && !button('Open game').disabled, 'Open enabled');
    signedIn.uid = 'uid-2';
    act(() => { button('Open game').click(); });
    expect(opened).toEqual([]);
    await waitFor(() => text().includes('Couldn’t open the running game'), 'unavailable after the switch');
  });

  it('the terminal latches: a later result never turns it into a reveal or a verification', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Already running'), 'the existing terminal');
    renderWith({ stage: 'complete', deployId: OURS, updatedAt: `${OURS}-3` }, { status: 'success', agentBattleId: 'battle-x' });
    await tick(600);
    expect(text()).toContain('Already running');
    expect(text()).not.toContain('Deployment complete');
    // An error result, and the server's own error checkpoint, after the terminal:
    // a machine that did not latch `existing` would start a verification here.
    renderWith({ stage: 'error', deployId: OURS, updatedAt: `${OURS}-4` }, { status: 'error', postIssued: true, httpStatus: 500, existingBattleId: RUNNING_ID });
    await tick(400);
    expect(text()).toContain('Already running');
    expect(text()).not.toMatch(/Deployment (failed|unconfirmed)/);
    expect(notes.map((n) => n.phase)).toEqual(['theater', 'existing']);
  });

  it('while the document is still being read, Open is disabled and opens nothing', async () => {
    let release;
    getDocsFromServerMock.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ empty: false, docs: [docOf(RUNNING_ID, RUNNING_DOC())] }); }));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Finding the running game…'), 'the pending read');
    expect(button('Open game').disabled).toBe(true);
    act(() => { button('Open game').click(); });
    expect(opened).toEqual([]);
    await act(async () => { release(); });
    await waitFor(() => button('Open game') && !button('Open game').disabled, 'Open after the read');
    expect(text()).not.toContain('Finding the running game…');
  });
});

describe('P1b refusal (spec §11.3) — a real 409 review-due through the real machine', () => {
  it('the shared line in details; the ceremony offers Try again and Back to hub only; nothing POSTs by itself', async () => {
    // A casual battle IS live on the target: the refusal must not hide behind a reveal of it.
    serverReturns(docOf('battle-earlier', RUNNING_DOC()));
    const result = await serviceResult(json(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    expect(result).toMatchObject({ outcome: 'refused', code: DEPLOY_REFUSAL_CODE, details: DUE_DEPLOY_LINE });
    const posts = globalThis.fetch.mock.calls.length;
    await runTo(deployResultFor(result));
    await waitFor(() => /Deployment (failed|unconfirmed)/.test(text()), 'the error terminal');
    expect(text()).toContain(DUE_DEPLOY_LINE);
    expect(text()).not.toContain('Deployment complete');
    expect(text()).not.toContain('Already running');
    // The shipped CeremonyError has no Forge action; R1 adds none (the hub's
    // Forge action is S2b's). Its two controls are these.
    expect(buttons().map((b) => (b.textContent || '').trim()).filter(Boolean).sort())
      .toEqual(['Back to hub', expect.stringMatching(/^(Try again|Retry available in \d+s)$/)].sort());
    await tick(400);
    expect(retried).toBe(0);
    expect(globalThis.fetch.mock.calls.length).toBe(posts);
    expect(createCb).not.toHaveBeenCalled();
  });
});

describe('onPhaseChange (R-R1-6) — every phase, echoing the attempt id it was given', () => {
  it('existing: theater on mount, then existing', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))));
    await waitFor(() => text().includes('Already running'), 'the existing terminal');
    expect(notes).toEqual([
      { attemptId: 'att-1', phase: 'theater', errorTone: null },
      { attemptId: 'att-1', phase: 'existing', errorTone: null },
    ]);
  });

  it('error: theater, verifying, then error with its tone — and the id held at each change', async () => {
    serverReturns();
    const result = await serviceResult(json(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    renderWith(null, { status: 'pending' });
    renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, { status: 'pending' }, { attemptId: 'att-2' });
    await tick();
    renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, deployResultFor(result), { attemptId: 'att-2' });
    await waitFor(() => /Deployment (failed|unconfirmed)/.test(text()), 'the error terminal');
    expect(notes.map((n) => n.phase)).toEqual(['theater', 'verifying', 'error']);
    expect(notes[0].attemptId).toBe('att-1');
    expect(notes.slice(1).map((n) => n.attemptId)).toEqual(['att-2', 'att-2']);
    expect(notes[2].errorTone).toBe('lost_contact');
    expect(notes.slice(0, 2).map((n) => n.errorTone)).toEqual([null, null]);
  });

  it('a throwing listener never breaks the ceremony', async () => {
    serverReturns(docOf(RUNNING_ID, RUNNING_DOC()));
    await runTo(deployResultFor(await serviceResult(json(200, EXISTING_200))), { onPhaseChange: () => { throw new Error('listener'); } });
    await waitFor(() => text().includes('Already running'), 'the existing terminal');
  });
});

describe('the recovery path is untouched — a 500 after the POST, document found', () => {
  it('reveals exactly as before, and Enter carries the found document', async () => {
    serverReturns(docOf('battle-recovered', RUNNING_DOC()));
    const result = await serviceResult(json(500, { error: 'Failed to generate portfolio', details: 'post-commit throw' }));
    expect(result.outcome).toBe('uncertain');
    expect(deployResultFor(result)).toEqual({
      status: 'error', error: 'Failed to generate portfolio', details: 'post-commit throw', httpStatus: 500, postIssued: true, battleId: null,
    });
    renderWith(null, { status: 'pending' });
    renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, { status: 'pending' });
    await tick();
    renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, deployResultFor(result));
    await waitFor(() => text().includes('Deployment complete'), 'the recovered reveal');
    expect(text()).not.toContain('Already running');
    act(() => { button('Enter the battle').click(); });
    expect(entered?.id).toBe('battle-recovered');
    expect(notes.map((n) => n.phase)).toEqual(['theater', 'verifying', 'reveal']);
  });
});
