// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyInProgress.test.jsx
//
// Command Center slice S2b, live change (b) — ruling R-S2b-9b (R2 report §10,
// moved there by the founder): decide.js's 429 "Deploy already in progress" is a
// definitive refusal of THIS request while the agent's other deploy runs. The
// REAL service types it (`refused`, `reason: 'in_progress'`), the shells' REAL
// mapping forwards the reason, and the REAL ceremony and stage machine now read
// it as that refusal — "A deploy is already in progress." — instead of the
// lost-contact "Couldn't confirm the deploy." It applies in both shells and in
// the hub, which mount this same ceremony. The "in progress" rows fail on the
// code before S2b (the failing-first log is in the S2b report §6); the CONTROL
// rows pin that no other refusal or failure changed its words.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const { getDocsFromServerMock, authState, signedIn, getIdTokenMock, targetProgressState } = vi.hoisted(() => ({
  getDocsFromServerMock: vi.fn(),
  authState: { currentUser: { uid: 'uid-1' } },
  signedIn: { uid: 'uid-1' },
  getIdTokenMock: vi.fn(),
  targetProgressState: { value: null },
}));

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

vi.setConfig({ testTimeout: 15000 });
const WAIT_MS = 4000;

const { deployAgent } = await import('../../../services/agentDeploy.js');
const { deployResultFor } = await import('../deployResult.js');
const { default: DeployCeremony } = await import('./DeployCeremony.jsx');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid-1';
const OURS = '2026-10-23T14:00:00.000Z';
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });

let container;
let root;
let rowGeneration = 0;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  getDocsFromServerMock.mockReset();
  getDocsFromServerMock.mockResolvedValue({ empty: true, docs: [] });
  getIdTokenMock.mockReset();
  getIdTokenMock.mockResolvedValue('tok');
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

async function serviceResult(decide) {
  globalThis.fetch = vi.fn(async (url) => (url === '/api/agent/ensure-casual-clone' ? json(200, { cloneId: CLONE }) : decide));
  return deployAgent(RANKED, vi.fn(), () => {});
}

const renderWith = (deployProgress, deployResult) => {
  targetProgressState.value = { deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true };
  act(() => {
    root.render(
      <DeployCeremony
        agent={{ id: RANKED, name: 'Nova', archetype: 'contrarian' }}
        agentName="Nova"
        targetAgentId={CLONE}
        deployResult={deployResult}
        onEnterBattle={() => {}}
        onRetry={() => {}}
        onDismiss={() => {}}
      />,
    );
  });
};

const text = () => document.body.textContent || '';
const live = () => document.body.querySelector('[aria-live="polite"]')?.textContent || '';
const waitFor = async (pred, what) => {
  const gen = rowGeneration;
  const start = Date.now();
  while (gen === rowGeneration && !pred() && Date.now() - start < WAIT_MS) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  if (!pred()) throw new Error(`never reached: ${what} — text: ${text().slice(0, 300)}`);
};

async function ceremonyFor(decide) {
  const result = await serviceResult(decide);
  renderWith(null, { status: 'pending' });
  renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, { status: 'pending' });
  await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, deployResultFor(result));
  return result;
}

describe('429 "Deploy already in progress" — a refusal, said as one (fails before S2b)', () => {
  it('the service types it refused with reason in_progress, and the mapping forwards the reason', async () => {
    const result = await serviceResult(json(429, { error: 'Deploy already in progress' }));
    expect(result).toMatchObject({ outcome: 'refused', reason: 'in_progress', httpStatus: 429, postIssued: true });
    expect(deployResultFor(result)).toMatchObject({ status: 'error', reason: 'in_progress', httpStatus: 429, postIssued: true });
  });

  it('the ceremony: "A deploy is already in progress." — not "Couldn\'t confirm the deploy" — and the live region says the same', async () => {
    await ceremonyFor(json(429, { error: 'Deploy already in progress' }));
    await waitFor(() => text().includes('A deploy is already in progress.'), 'the in-progress refusal');
    expect(text()).not.toContain('Couldn’t confirm the deploy.');
    expect(text()).not.toContain('Deployment unconfirmed');
    expect(text()).not.toContain('no battle was created');
    expect(text()).toContain('Deployment refused');
    expect(text()).not.toContain('Deployment failed');
    expect(text()).toContain('If the deploy already running creates a battle, it will appear on your hub.');
    expect(live()).toBe('A deploy is already in progress.');
  });
});

describe('CONTROL — every other answer keeps its words', () => {
  it('the 429 cooldown ("Please wait 2 minutes between deploys") is unchanged: lost contact, as before', async () => {
    const result = await ceremonyFor(json(429, { error: 'Please wait 2 minutes between deploys' }));
    expect(result.reason).toBe('cooldown');
    expect(deployResultFor(result)).not.toHaveProperty('reason');
    await waitFor(() => text().includes('Couldn’t confirm the deploy.'), 'lost contact');
    expect(text()).not.toContain('A deploy is already in progress');
  });

  it('a 500 after the POST is unchanged: lost contact when nothing is found', async () => {
    await ceremonyFor(json(500, { error: 'boom' }));
    await waitFor(() => text().includes('Couldn’t confirm the deploy.'), 'lost contact');
    expect(text()).not.toContain('A deploy is already in progress');
  });

  it('the mapping\'s other shapes carry no reason at all (a key only the in-progress refusal adds)', () => {
    expect(deployResultFor({ outcome: 'refused', success: false, status: 400, httpStatus: 400, postIssued: true, error: 'bad' })).toStrictEqual({
      status: 'error', error: 'bad', details: undefined, httpStatus: 400, postIssued: true, battleId: null,
    });
    expect(deployResultFor({ outcome: 'refused', success: false, httpStatus: 429, postIssued: true, error: 'x', reason: 'cooldown' })).not.toHaveProperty('reason');
    // Typed in_progress only with the refused outcome: an untyped look-alike is not promoted.
    expect(deployResultFor({ success: false, httpStatus: 429, postIssued: true, reason: 'in_progress' })).not.toHaveProperty('reason');
  });
});
