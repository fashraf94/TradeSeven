// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyDeployTarget.test.jsx
//
// PR 1 — "identity comes from the ranked agent; deploy state comes from the
// deploy target." Three layers of the one contract:
//
//   §3  agentDeploy reports the resolved target id, on BOTH branches, before the POST.
//   §5  the stage machine's baseline is scoped to (machine instance, target id),
//       so a late subscription cannot pin a STALE deployId as ours.
//   §6  the ceremony's cooldown reads the target's lastDeployedAt; identity does not.
//
// Every stage-machine row here is written to FAIL against the pre-fix machine
// (baseline captured once at mount) — see the notes on each. Rows deliberately
// hold deployStatus at 'pending' where they test progress tracking, because the
// SUCCESS_GRACE_MS safety net forces a reveal on a client success regardless of
// the guard, and would mask a mis-pinned deployId.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// ── module mocks ───────────────────────────────────────────────────────────
const { getIdTokenMock, targetProgressState, verifyMock } = vi.hoisted(() => ({
  getIdTokenMock: vi.fn(),
  targetProgressState: { value: null },
  verifyMock: vi.fn(),
}));

vi.mock('../../../firebase/authService', () => ({ getIdToken: getIdTokenMock }));
// PR 2: the ceremony now runs an existence check before committing to any
// terminal claim. Mocked here so this file keeps testing PR 1's contract without
// pulling in firebase/config; the check's own behavior is covered in
// ceremonyTerminalState.test.jsx.
vi.mock('../../../services/agentBattleVerify', () => ({
  findActiveBattleForAgent: verifyMock,
  default: verifyMock,
}));
vi.mock('../../../hooks/useDeployTargetProgress', () => ({
  default: () => targetProgressState.value,
}));
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../../Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('./ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));

const { deployAgent } = await import('../../../services/agentDeploy.js');
const { default: useCeremonyStageMachine } = await import('./useCeremonyStageMachine.js');
const { default: DeployCeremony } = await import('./DeployCeremony.jsx');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid1';

let container; let root; let seen;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  seen = undefined;
  getIdTokenMock.mockReset();
  verifyMock.mockReset();
  verifyMock.mockResolvedValue({ found: false, battle: null });
  targetProgressState.value = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════════════════════
// §3 — the deploy path reports its resolved target
// ═══════════════════════════════════════════════════════════════════════════
describe('agentDeploy — reports the resolved deploy target (§3)', () => {
  // A deploy that resolves a clone, then POSTs. Records the call ORDER so we can
  // prove the report lands before the POST (which is what keeps §5's baseline
  // correct — subscribing after the server's first write is the residual race).
  const runDeploy = async ({ cloneOk }) => {
    const order = [];
    const reported = [];
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      order.push(`fetch:${url}`);
      if (url === '/api/agent/ensure-casual-clone') {
        return cloneOk
          ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
          : { ok: false, status: 500, text: async () => JSON.stringify({ error: 'boom' }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, agentBattleId: 'b1', portfolio: {}, bench: [] }) };
    }));
    const onTarget = (id) => { order.push(`report:${id}`); reported.push(id); };
    const result = await deployAgent(RANKED, null, onTarget);
    return { order, reported, result, body: JSON.parse(globalThis.fetch.mock.calls.at(-1)[1].body) };
  };

  it('reports the CLONE id, and does so before the decide POST', async () => {
    const { order, reported, body } = await runDeploy({ cloneOk: true });
    expect(reported).toEqual([RANKED, CLONE]);       // ranked first, then the resolved clone
    expect(body.agentId).toBe(CLONE);                 // and that is what decide receives
    const lastReport = order.lastIndexOf(`report:${CLONE}`);
    const post = order.indexOf('fetch:/api/agent/decide');
    expect(lastReport).toBeGreaterThan(-1);
    expect(lastReport).toBeLessThan(post);
  });

  // §7.3 — the branch a client-side `casual-agent-{uid}` derivation would get
  // wrong: the clone ensure fails, so the deploy target IS the ranked agent.
  it('fallback: clone ensure fails → target stays the RANKED agent (§7.3)', async () => {
    const { reported, body } = await runDeploy({ cloneOk: false });
    expect(reported).toEqual([RANKED]);
    expect(reported.at(-1)).toBe(RANKED);
    expect(body.agentId).toBe(RANKED);   // the id reported === the id deployed
  });

  it('a throwing consumer never breaks the deploy', async () => {
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/agent/ensure-casual-clone'
        ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
        : { ok: true, status: 200, text: async () => JSON.stringify({ success: true, agentBattleId: 'b1' }) }
    )));
    const result = await deployAgent(RANKED, null, () => { throw new Error('consumer blew up'); });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PR 2 — what deployAgent reports about WHERE a failure happened
//
// The ceremony's recovered-reveal gate turns on this: what a `decide.js` status
// does and does not prove is stated once, in the FAILURE MODEL block at the top
// of `services/agentBattleVerify.js`. Both fields were previously computed and
// dropped, which is why the ceremony could not tell a refusal from a real
// failure and would announce a refused deploy as a success.
// ═══════════════════════════════════════════════════════════════════════════
describe('agentDeploy — reports where the failure happened (PR 2)', () => {
  const postFailing = (status, body) => {
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/agent/ensure-casual-clone'
        ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
        : { ok: false, status, text: async () => body }
    )));
  };

  it.each([429, 403, 503, 409, 500])('carries the HTTP status (%s) and postIssued', async (status) => {
    postFailing(status, JSON.stringify({ error: 'nope' }));
    const r = await deployAgent(RANKED, null, () => {});
    expect(r.success).toBe(false);
    expect(r.httpStatus).toBe(status);
    expect(r.postIssued).toBe(true);
  });

  it('a NON-JSON error page still carries its status', async () => {
    postFailing(502, '<html>gateway</html>');
    const r = await deployAgent(RANKED, null, () => {});
    expect(r.httpStatus).toBe(502);
    expect(r.postIssued).toBe(true);
  });

  // The request left the client but produced no response: whether the server saw
  // it is unknowable, and that IS the answer the ceremony needs — it stays
  // eligible for recovery, unlike a refusal.
  it('a transport failure reports postIssued with NO status, instead of throwing', async () => {
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/agent/ensure-casual-clone') return { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) };
      throw new TypeError('Failed to fetch');
    }));
    const r = await deployAgent(RANKED, null, () => {});
    expect(r.success).toBe(false);
    expect(r.postIssued).toBe(true);
    expect(r.httpStatus).toBeNull();
  });

  // A bail before the POST cannot have created anything.
  it('a client-side bail reports postIssued false', async () => {
    getIdTokenMock.mockResolvedValue(null);          // no auth token → never posts
    const r = await deployAgent(RANKED, null, () => {});
    expect(r.postIssued).toBe(false);
    expect(await deployAgent(null, null, () => {})).toMatchObject({ postIssued: false });
  });

  // ── R3 · THE IDENTIFIER MUST SURVIVE THE TRIP ────────────────────────────
  // The handoff runs AFTER a 200 carrying a real, durable battle id. Letting the
  // throw escape reported the whole deploy through the shells' catch as
  // `postIssued: false` — "never reached the server" — for a deploy that
  // definitively did, and threw the id away with it.
  const postSucceeding = (body) => {
    getIdTokenMock.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/agent/ensure-casual-clone'
        ? { ok: true, status: 200, text: async () => JSON.stringify({ cloneId: CLONE }) }
        : { ok: true, status: 200, text: async () => JSON.stringify(body) }
    )));
  };

  // DIES UNDER: dropping `battleId` from the handoff-failure return; letting the
  // callback throw escape; reporting postIssued false for it.
  it('a callback throw after a 200 returns the server battle id instead of throwing', async () => {
    postSucceeding({ success: true, agentBattleId: 'battle-real-1', portfolio: {}, bench: {} });
    const boom = () => { throw new Error('could not build the battle'); };

    const r = await deployAgent(RANKED, boom, () => {});
    expect(r.success).toBe(false);
    expect(r.battleId).toBe('battle-real-1');         // the id survived
    expect(r.postIssued).toBe(true);                  // it DID reach the server
    expect(r.httpStatus).toBe(200);
    expect(r.error).toBe('deploy_handoff');
  });

  it('an async callback rejection after a 200 is caught the same way', async () => {
    postSucceeding({ success: true, agentBattleId: 'battle-real-2', portfolio: {}, bench: {} });
    const boom = async () => { throw new Error('async build failure'); };

    const r = await deployAgent(RANKED, boom, () => {});
    expect(r.battleId).toBe('battle-real-2');
    expect(r.postIssued).toBe(true);
  });

  // decide.js:748-758 — "agent already has an active battle" — also returns 200 +
  // success:true, carrying `existingBattleId` and NO `agentBattleId`. That battle
  // was not created by this deploy, so there is no id to carry and the 200 must
  // buy nothing. The machine's gate keys on the id, not the status, precisely so
  // this row cannot become a reveal.
  // DIES UNDER: fabricating an id here, or admitting 200 on the status alone.
  it('a 200 carrying only existingBattleId yields NO battle id to carry', async () => {
    postSucceeding({ success: true, existingBattleId: 'battle-someone-elses', portfolio: {}, bench: {} });
    const boom = () => { throw new Error('could not build the battle'); };

    const r = await deployAgent(RANKED, boom, () => {});
    expect(r.battleId).toBeNull();
    expect(r.postIssued).toBe(true);
  });

  // The ordinary success path is untouched: no battleId key, still success.
  it('a callback that does NOT throw still reports plain success', async () => {
    postSucceeding({ success: true, agentBattleId: 'battle-ok', portfolio: {}, bench: {} });
    const r = await deployAgent(RANKED, async () => {}, () => {});
    expect(r).toEqual({ success: true, agentBattleId: 'battle-ok' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §5 — baseline scoped to (machine instance, target id)
// ═══════════════════════════════════════════════════════════════════════════
describe('useCeremonyStageMachine — baseline scoping (§5)', () => {
  const BASE = { stage: undefined, deployId: undefined, updatedAt: undefined, errorPhase: undefined, deployStatus: 'pending', targetKnown: false, targetAgentId: null };

  function MachineProbe(props) { seen = useCeremonyStageMachine(props); return null; }
  // Two separate act() calls, deliberately: a concurrent root does not commit
  // inside the callback that scheduled it, so advancing timers in the SAME act
  // would run evaluate() against the previous render's inputs — every row would
  // silently lag one step behind and assert the wrong tick.
  const step = (props, ms = 200) => {
    act(() => { root.render(<MachineProbe {...{ ...BASE, ...props }} />); });
    act(() => { vi.advanceTimersByTime(ms); });
  };

  // 'performance' is NOT in vitest's default toFake list, and the machine measures
  // its stage floors with performance.now() — without it every floor check reads
  // real elapsed time (~1ms) and no stage ever advances.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  // §7.4 — the headline §5 row. A prior deploy left a terminal deployProgress on
  // the target; the subscription resolves late, so that stale block is the first
  // thing this machine ever sees. It must become the BASELINE, not "ours".
  //
  // Pre-fix (baseline captured at mount, when the target is unresolved and
  // deployId is null): STALE !== null pins STALE as ours, and every checkpoint of
  // the real deploy is then ignored — serverRank stays 0 and stageIndex stays 0.
  it('a STALE deployId on the target becomes the baseline, never "ours" (§7.4)', () => {
    const STALE = '2026-09-01T10:00:00.000Z';
    const OURS = '2026-09-02T14:00:00.000Z';

    // Target unresolved — nulls only.
    step({ targetKnown: false, targetAgentId: null });
    expect(seen.serverRank).toBe(0);

    // First observation of the target: the PREVIOUS deploy's terminal state.
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'complete', deployId: STALE, updatedAt: STALE });
    expect(seen.serverRank).toBe(0);   // absorbed as baseline, not as progress
    expect(seen.stageIndex).toBe(0);

    // Our deploy's real checkpoints now land on the same document.
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_running', deployId: OURS, updatedAt: OURS });
    expect(seen.serverRank).toBe(1);   // pre-fix: still 0

    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_complete', deployId: OURS, updatedAt: `${OURS}-2` }, 3000);
    expect(seen.serverRank).toBe(2);
    expect(seen.stageIndex).toBeGreaterThan(0);  // pre-fix: stuck at stage 1 of the theater
    expect(seen.canSkip).toBe(true);
  });

  // §5.1 — a "target unknown" payload must not establish anything, even if a
  // deployId somehow reaches the machine while the target is unresolved.
  it('a target-unknown payload sets no baseline and absorbs no progress (§5.1)', () => {
    // Two DIFFERING ids while the target is still unresolved — the shape the
    // pre-fix machine mishandles: it baselines off the first and pins the second.
    step({ targetKnown: false, targetAgentId: null, stage: 'strategy_running', deployId: 'ranked-doc-id' });
    step({ targetKnown: false, targetAgentId: null, stage: 'complete', deployId: 'other-doc-id' }, 3000);
    expect(seen.serverRank).toBe(0);   // pre-fix: 4 — 'other-doc-id' pinned as ours
    expect(seen.stageIndex).toBe(0);

    // Once the target resolves, the first payload FOR IT is the baseline.
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'complete', deployId: 'other-doc-id' });
    expect(seen.serverRank).toBe(0);
  });

  // §5.1 — `null` is a legitimate baseline (a freshly minted clone carries no
  // deployProgress at all) and must not be confused with "not yet established".
  it('a target with NO deployProgress takes null as its baseline, then tracks ours', () => {
    step({ targetKnown: true, targetAgentId: CLONE, stage: undefined, deployId: undefined });
    expect(seen.serverRank).toBe(0);
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_running', deployId: 'd-new' });
    expect(seen.serverRank).toBe(1);
  });

  // §5.2 — the target id changing mid-run invalidates everything learned from
  // the old one. Pre-fix there is no re-arm at all: the ranked doc's id stays the
  // baseline, so the clone's stale id looks like a change and gets pinned.
  it('re-arms when the target id changes (§5.2)', () => {
    step({ targetKnown: true, targetAgentId: RANKED, stage: 'complete', deployId: 'A', updatedAt: 'A' });
    expect(seen.serverRank).toBe(0);

    // New target, carrying its OWN stale terminal block.
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'complete', deployId: 'B', updatedAt: 'B' });
    expect(seen.serverRank).toBe(0);   // pre-fix: 4 — 'B' differs from baseline 'A' and gets pinned

    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_running', deployId: 'C', updatedAt: 'C' });
    expect(seen.serverRank).toBe(1);   // pre-fix: 0 — 'C' is not the pinned 'B'
  });

  // REGRESSION row, not a defect guard: this scenario behaves identically before
  // and after the fix (the spec predicts exactly that — the retry case is already
  // correct once the rule is scoped to (instance, target) rather than to a
  // fresh-snapshot event). It is here to prove the re-scoping did not break it.
  //
  // §5.3 / §7.5 — retry. setCeremonyRun bumps the ceremony key, so a NEW machine
  // instance mounts while the subscription still holds the PREVIOUS deploy's
  // terminal state. The rule is scoped to (instance, target), not to a
  // fresh-snapshot event, so that already-held snapshot is a valid baseline.
  it('retry: a fresh instance baselines off the previous deploy\'s held state (§7.5)', async () => {
    const FIRST = '2026-09-02T14:00:00.000Z';
    const SECOND = '2026-09-02T14:05:00.000Z';

    // First run: baseline off the target's pre-deploy state, pin FIRST, then fail.
    step({ targetKnown: true, targetAgentId: CLONE, stage: undefined, deployId: null });
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_running', deployId: FIRST, updatedAt: FIRST });
    expect(seen.serverRank).toBe(1);
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'error', deployId: FIRST, updatedAt: `${FIRST}-e`, errorPhase: 'pre_decision' });
    // PR 2: the error commit routes through 'verifying' first. No verifyBattle is
    // wired here, which IS a check that could not run, so it resolves to the error
    // surface on the next microtask rather than synchronously.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(seen.phase).toBe('error');

    // Remount (the key bump). The subscription is unchanged and still delivers
    // the first deploy's terminal payload as this instance's first observation.
    act(() => { root.render(<div key="remount" />); });
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'error', deployId: FIRST, updatedAt: `${FIRST}-e`, errorPhase: 'pre_decision' });
    // The previous deploy's terminal state is this instance's BASELINE, so it is
    // not "ours" and must not fail the retry before it has begun.
    expect(seen.phase).toBe('theater');
    expect(seen.serverRank).toBe(0);

    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_running', deployId: SECOND, updatedAt: SECOND });
    expect(seen.serverRank).toBe(1);
    step({ targetKnown: true, targetAgentId: CLONE, stage: 'strategy_complete', deployId: SECOND, updatedAt: `${SECOND}-2` }, 3000);
    expect(seen.serverRank).toBe(2);
    expect(seen.stageIndex).toBeGreaterThan(0);
  });

  // BEHAVIOUR row: the wrong-document defect lives upstream in DeployCeremony, so
  // this passes with or without the baseline re-scoping. It proves the machine
  // does the right thing once it is actually fed the deploy target's progress.
  //
  // §7.1's machine half: all four checkpoints on the clone doc drive the theater
  // to the reveal. deployStatus only flips to success at the end, so the reveal
  // here is earned by the checkpoints, not by the grace-period safety net.
  it('clone-path deploy: four checkpoints advance the theater to the reveal (§7.1)', () => {
    const OURS = '2026-09-02T14:00:00.000Z';
    const at = (stage, n, ms) => step(
      { targetKnown: true, targetAgentId: CLONE, stage, deployId: OURS, updatedAt: `${OURS}-${n}`, deployStatus: 'pending' },
      ms,
    );
    step({ targetKnown: true, targetAgentId: CLONE, stage: undefined, deployId: null });
    at('strategy_running', 1, 2500);
    expect(seen.stageIndex).toBe(1);
    at('strategy_complete', 2, 3000);
    expect(seen.stageIndex).toBe(2);
    at('portfolio_running', 3, 3000);
    expect(seen.stageIndex).toBe(3);
    at('complete', 4, 3000);
    expect(seen.phase).toBe('theater');   // dual-signal: telemetry alone never reveals

    step({ targetKnown: true, targetAgentId: CLONE, stage: 'complete', deployId: OURS, updatedAt: `${OURS}-4`, deployStatus: 'success' }, 3000);
    expect(seen.phase).toBe('reveal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6 / §7.6 / §7.7 — what the ceremony reads from which document
// ═══════════════════════════════════════════════════════════════════════════
describe('DeployCeremony — deploy state from the target, identity from the ranked agent', () => {
  const rankedAgent = {
    id: RANKED,
    name: 'Nova',
    archetype: 'contrarian',
    equippedWatchlistName: 'Grid',
    // Deliberately ancient: reading the RANKED doc's cooldown would unlock retry.
    lastDeployedAt: '2020-01-01T00:00:00.000Z',
    lastDecision: { portfolio: { star: [{ symbol: 'RANKEDPICK' }] } },
  };

  // PR 2: a client error routes to 'verifying' first, so the error surface these
  // rows assert on appears only once the existence check has resolved (empty, per
  // the default mock — two attempts, 400ms apart). Real timers here, so flush by
  // waiting out the retry gap.
  const renderCeremony = async (targetProgress, extraProps = {}) => {
    targetProgressState.value = {
      deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false, ...targetProgress,
    };
    act(() => {
      root.render(
        <DeployCeremony
          agent={rankedAgent}
          agentName="Nova"
          targetAgentId={CLONE}
          deployResult={{ status: 'error', error: 'deploy_http_500' }}
          onRetry={() => {}}
          onDismiss={() => {}}
          {...extraProps}
        />,
      );
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    return document.body.textContent;
  };

  // §7.6 — the countdown must reflect the deploy that actually happened. The
  // ranked doc's lastDeployedAt is from 2020; only the TARGET's is recent.
  it('cooldown comes from the TARGET\'s lastDeployedAt (§7.6)', async () => {
    const text = await renderCeremony({
      targetKnown: true,
      lastDeployedAt: new Date(Date.now() - 20000).toISOString(), // 20s ago → ~100s left
    });
    expect(text).toMatch(/Retry available in \d+s/);
    expect(text).not.toContain('Try again');
  });

  // §6 — fail OPEN while the target is unresolved: fall back to the ranked
  // agent's value rather than stranding the retry button.
  it('falls back to the ranked agent\'s lastDeployedAt when the target is unknown (§6)', async () => {
    const text = await renderCeremony({ targetKnown: false, lastDeployedAt: null });
    expect(text).toContain('Try again');   // ranked value is ancient → unlocked
  });

  it('a target that has never deployed leaves retry unlocked, matching the server gate', async () => {
    const text = await renderCeremony({ targetKnown: true, lastDeployedAt: null });
    expect(text).toContain('Try again');
  });

  // §7.7 — identity is untouched by all of the above.
  it('identity still comes from the ranked agent (§7.7)', () => {
    targetProgressState.value = {
      deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: true,
    };
    act(() => {
      root.render(
        <DeployCeremony
          agent={rankedAgent}
          agentName="Nova"
          targetAgentId={CLONE}
          deployResult={{ status: 'pending' }}
          onDismiss={() => {}}
        />,
      );
    });
    const text = document.body.textContent;
    // Both chips are read off `agent` — the RANKED doc — and neither is exposed
    // by the deploy-target subscription at all, so no clone value can reach them.
    expect(text).toContain('Contrarian');  // archetype chip — agent.archetype
    expect(text).toContain('Grid');        // equipped watchlist — agent.equippedWatchlistName
  });
});
