// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyIdeaNotice.jsdom.test.jsx
//
// Pilot P1c — founder ruling E1, AFTER the deploy (acceptance row 2's second
// half): the ceremony's success screen shows table C V1.2's line — "This
// battle is running without your idea — it's still waiting for your review."
// — ONLY when the deploy's own response carried `hypothesisNotice:
// 'review_due'`, and the line is the link to the equipped list's Idea panel
// (it closes the ceremony and asks App to open the list's editor through
// OPEN_IDEA_EVENT). The chain is the real one:
//
//   decide's 200  →  deployAgent (real)  →  deployResultFor (real)  →  <DeployCeremony> (real machine)  →  CeremonyReveal
//
// The harness is ceremonyExisting.test.jsx's: only Firestore, auth, the
// target-progress hook, focus and market context are mocked.

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
const WAIT_MS = 3000;

const { deployAgent } = await import('../../../services/agentDeploy.js');
const { deployResultFor } = await import('../deployResult.js');
const { default: DeployCeremony } = await import('./DeployCeremony.jsx');
const { OPEN_IDEA_EVENT } = await import('../../Forge/Watchlist/ideaNavigation.js');

const LINE = "This battle is running without your idea — it's still waiting for your review.";
const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid-1';
const OURS = '2026-10-16T14:00:00.000Z';
const CREATED_200 = {
  success: true, portfolioUpdated: true, battleCreated: true, agentBattleId: 'battle-new', expiresAt: '2026-10-16T20:00:00.000Z',
  portfolio: { star: [] }, bench: { stocks: [] }, opponent: {}, opponentBench: {}, innerMonologue: 'm', strategyBrief: 'b',
};
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });

let container; let root; let dismissed; let opens; let rowGeneration = 0;
const onOpen = (e) => { opens.push(e.detail); };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  dismissed = 0; opens = [];
  window.addEventListener(OPEN_IDEA_EVENT, onOpen);
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
  window.removeEventListener(OPEN_IDEA_EVENT, onOpen);
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

const renderWith = (deployProgress, deployResult, agent) => {
  targetProgressState.value = { deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true };
  act(() => {
    root.render(
      <DeployCeremony
        agent={agent}
        agentName="Nova"
        targetAgentId={CLONE}
        deployResult={deployResult}
        onEnterBattle={() => {}}
        onOpenBattle={() => {}}
        onRetry={() => {}}
        onDismiss={() => { dismissed += 1; }}
      />,
    );
  });
};
const text = () => document.body.textContent || '';
const notice = () => document.body.querySelector('[data-testid="ceremony-idea-notice"]');
const tick = async (ms = 150) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const waitFor = async (pred, what, timeoutMs = WAIT_MS) => {
  const gen = rowGeneration;
  const start = Date.now();
  while (gen === rowGeneration && !pred() && Date.now() - start < timeoutMs) await tick(40);
  if (!pred()) throw new Error(`never reached: ${what} — text: ${text().slice(0, 300)}`);
};

/** Mount, run the server's checkpoints through 'complete', hand the ceremony the client's result, and cross the stage floors. */
async function revealWith(deployResult, agent = { id: RANKED, name: 'Nova', archetype: 'contrarian', equippedWatchlistId: 'wl-1' }) {
  const realNow = performance.now.bind(performance);
  let offset = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => realNow() + offset);
  renderWith(null, { status: 'pending' }, agent);
  renderWith({ stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, { status: 'pending' }, agent);
  await tick();
  renderWith({ stage: 'complete', deployId: OURS, updatedAt: `${OURS}-2` }, deployResult, agent);
  for (let i = 0; i < 10 && !text().includes('Deployment complete'); i += 1) { offset += 3000; await tick(150); }
  await waitFor(() => text().includes('Deployment complete'), 'the reveal');
}
async function serviceResult(decide) {
  globalThis.fetch = vi.fn(async (url) => (url === '/api/agent/ensure-casual-clone' ? json(200, { cloneId: CLONE }) : decide));
  return deployAgent(RANKED, vi.fn(), () => {});
}

describe('E1 after the deploy — the success screen says the battle runs without the idea, only when the response said so', () => {
  it('the real chain: a 200 carrying hypothesisNotice review_due → the reveal shows table C V1.2\'s line, verbatim', async () => {
    const result = await serviceResult(json(200, { ...CREATED_200, hypothesisNotice: 'review_due' }));
    expect(result).toMatchObject({ outcome: 'created', hypothesisNotice: 'review_due' });
    await revealWith(deployResultFor(result));
    expect(notice().textContent).toBe(LINE);
    expect(text()).toContain('Nova is ready for battle.');
  });
  it('the line is the link to the list\'s Idea panel: it closes the ceremony and asks App to open the equipped list', async () => {
    await revealWith({ status: 'success', agentBattleId: 'battle-new', hypothesisNotice: 'review_due' });
    expect(notice().tagName).toBe('BUTTON');
    act(() => { notice().click(); });
    expect(dismissed).toBe(1);
    expect(opens).toEqual([{ watchlistId: 'wl-1' }]);
  });
  it('no notice on the response → no line (an ordinary created deploy, byte for byte the R1 reveal)', async () => {
    const result = await serviceResult(json(200, CREATED_200));
    await revealWith(deployResultFor(result));
    expect(notice()).toBeNull();
    expect(text()).not.toContain(LINE);
  });
  it('no equipped list to open → the line is said as plain text, never a dead link', async () => {
    await revealWith({ status: 'success', agentBattleId: 'battle-new', hypothesisNotice: 'review_due' }, { id: RANKED, name: 'Nova', archetype: 'contrarian' });
    expect(notice().tagName).toBe('DIV');
    expect(notice().textContent).toBe(LINE);
    expect(opens).toEqual([]);
  });
  it('a notice value other than review_due is not a notice', async () => {
    await revealWith({ status: 'success', agentBattleId: 'battle-new', hypothesisNotice: 'something_else' });
    expect(notice()).toBeNull();
  });
});
