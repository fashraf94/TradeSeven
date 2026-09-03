// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyRecoveredReveal.test.jsx
//
// R1 — THE FULL FALSE-REVEAL PATH, END TO END.
//
// Every other row on this seam mocks `findActiveBattleForAgent`, which is right
// for testing the machine but cannot see the defect R1 closes: the defect lives
// in the JOIN between the machine's attribution gate and what the query is
// willing to return. So this file wires the REAL verifier to a mocked Firestore
// and drives the whole ceremony.
//
// THE PATH. `ensure-casual-clone` falls back, so the deploy target is the RANKED
// agent. `deployBlockedByLive` gates on BaggerBomb only
// (`commandCenterLiveBattles.js:159`), so a live league battle does not stop the
// deploy. A model call throws → 500, and per the FAILURE MODEL block in
// `services/agentBattleVerify.js` that same 500 is what decide.js returns for a
// throw ~780 lines BEFORE the battle commit — so the attribution gate admits it.
// The query then finds the user's live league game, and before the league filter
// the ceremony announced "Deployment complete" and its CTA opened a competitive
// battle the user did not just deploy, under the PREVIOUS deploy's picks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const {
  collectionMock, queryMock, whereMock, limitMock, getDocsMock, getDocsFromServerMock,
  authState, targetProgressState,
} = vi.hoisted(() => ({
  collectionMock: vi.fn((_db, name) => ({ __collection: name })),
  queryMock: vi.fn((...parts) => ({ __query: parts })),
  whereMock: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
  limitMock: vi.fn((n) => ({ __limit: n })),
  getDocsMock: vi.fn(),
  getDocsFromServerMock: vi.fn(),
  authState: { currentUser: { uid: 'uid-1' } },
  targetProgressState: { value: null },
}));

// The REAL agentBattleVerify runs here — only Firestore beneath it is mocked.
vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  limit: limitMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
}));
vi.mock('../../../firebase/config', () => ({ db: { __db: true }, auth: authState }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: vi.fn() }));
vi.mock('../../../hooks/useDeployTargetProgress', () => ({ default: () => targetProgressState.value }));
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../../Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('./ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));

const { default: DeployCeremony } = await import('./DeployCeremony.jsx');

const RANKED = 'agent-ranked-1';
const OURS = '2026-09-02T14:00:00.000Z';
const OUR_PROGRESS = { stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` };
const LOST_CONTACT_HEADLINE = 'Couldn’t confirm the deploy.';
const hourFromNow = () => new Date(Date.now() + 3600000).toISOString();

// The user's live league game, sitting on the ranked agent — status 'active',
// clock still running, and carrying the groupId that makes it a league battle
// (`agentBattleService.js:137` stamps it on tournament docs only).
const LEAGUE_BATTLE = {
  agentId: RANKED, ownerId: 'uid-1', status: 'active', groupId: 'group-77',
  gameMode: 'flat6', expiresAt: hourFromNow(), portfolio: { star: [{ symbol: 'LEAGUEPICK' }] },
};
// What a Command Center deploy actually creates on the same target: no groupId.
const CASUAL_BATTLE = {
  agentId: RANKED, ownerId: 'uid-1', status: 'active',
  expiresAt: hourFromNow(), portfolio: { star: [{ symbol: 'CASUALPICK' }] },
};

const serverReturns = (...docs) => {
  getDocsFromServerMock.mockResolvedValue({ empty: docs.length === 0, docs });
};

let container; let root; let entered;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  entered = undefined;
  collectionMock.mockClear(); queryMock.mockClear(); whereMock.mockClear(); limitMock.mockClear();
  getDocsMock.mockReset(); getDocsFromServerMock.mockReset();
  authState.currentUser = { uid: 'uid-1' };
  targetProgressState.value = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const renderWith = (deployProgress, deployResult) => {
  targetProgressState.value = {
    deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true,
  };
  act(() => {
    root.render(
      <DeployCeremony
        agent={{ id: RANKED, name: 'Nova', archetype: 'contrarian' }}
        agentName="Nova"
        // The clone fallback fired: the deploy target IS the ranked agent.
        targetAgentId={RANKED}
        deployResult={deployResult}
        onEnterBattle={(b) => { entered = b; }}
        onRetry={() => {}}
        onDismiss={() => {}}
      />,
    );
  });
};

// Poll rather than sleep a fixed span — the real duration is the next 100ms tick
// plus the check, and a tuned sleep is one slow CI box away from a flake.
const settle = async (timeoutMs = 5000) => {
  const done = () => /Deployment (complete|failed|unconfirmed)/.test(document.body.textContent || '');
  const start = Date.now();
  while (!done() && Date.now() - start < timeoutMs) {
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  if (!done()) throw new Error(`ceremony never reached a terminal surface within ${timeoutMs}ms`);
};
const tick = async (ms = 150) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

// THREE renders: (1) mount clean — that payload is the §5 baseline; (2) the server
// BEGINS our deploy, a deployId differing from the baseline, which the machine
// pins; (3) this deploy's outcome — a 500 thrown before the commit.
const runDeployEndingIn500 = async () => {
  renderWith(null, { status: 'pending' });
  renderWith(OUR_PROGRESS, { status: 'pending' });
  await tick();
  renderWith(OUR_PROGRESS, {
    status: 'error', error: 'deploy_http_500', details: 'Anthropic overloaded',
    postIssued: true, httpStatus: 500,
  });
  await settle();
  return document.body.textContent;
};

describe('R1 — a live league battle is never revealed as this deploy’s', () => {
  // THE ROW THIS FIX EXISTS FOR.
  // DIES UNDER: removing the league filter from findActiveBattleForAgent.
  it('the full path — clone fallback, live ranked battle, pre-commit 500 — does not reveal', async () => {
    serverReturns({ id: 'battle-league', data: () => LEAGUE_BATTLE });

    const text = await runDeployEndingIn500();

    expect(text).not.toContain('Deployment complete');
    expect(text).not.toContain('Nova is ready for battle.');
    expect(text).not.toContain('LEAGUEPICK');
    // And it does not swing to the opposite lie either: the check ran and found
    // nothing IN SCOPE, with no way to know what the server did, so it says so.
    expect(text).toContain(LOST_CONTACT_HEADLINE);
    expect(text).not.toMatch(/no battle was created/);
  });

  // The CTA is the part that hurts: it walks the user into a competitive game.
  // DIES UNDER: removing the league filter.
  it('there is no "Enter the battle" CTA to walk the user into the league game', async () => {
    serverReturns({ id: 'battle-league', data: () => LEAGUE_BATTLE });
    await runDeployEndingIn500();

    const enterCta = [...document.body.querySelectorAll('button')]
      .find((b) => (b.textContent || '').includes('Enter the battle'));
    expect(enterCta).toBeUndefined();
    expect(entered).toBeUndefined();
  });

  // POSITIVE CONTROL. Without this the row above could pass because the harness
  // never reveals anything — which is exactly how a guard rots into a tautology.
  // The identical path with a CASUAL battle on the target must still recover.
  it('the same path with a casual battle on the target still recovers it', async () => {
    serverReturns({ id: 'battle-casual', data: () => CASUAL_BATTLE });

    const text = await runDeployEndingIn500();

    expect(text).toContain('Deployment complete');
    expect(text).toContain('Nova is ready for battle.');
    // R2, end to end: the read that produced this came from the server, not the
    // cache-capable reader.
    expect(getDocsFromServerMock).toHaveBeenCalled();
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  // R1 × R4 through the whole stack: the league doc must not consume the scan
  // window and cost us the recovery sitting behind it.
  // DIES UNDER: restoring limit(1) / docs[0].
  it('a league battle beside the real one does not suppress the recovery', async () => {
    serverReturns(
      { id: 'battle-league', data: () => LEAGUE_BATTLE },
      { id: 'battle-casual', data: () => CASUAL_BATTLE },
    );

    const text = await runDeployEndingIn500();
    expect(text).toContain('Deployment complete');

    const enterCta = [...document.body.querySelectorAll('button')]
      .find((b) => (b.textContent || '').includes('Enter the battle'));
    expect(enterCta).toBeTruthy();
    act(() => { enterCta.click(); });
    expect(entered?.id).toBe('battle-casual');   // never the league doc
  });
});
