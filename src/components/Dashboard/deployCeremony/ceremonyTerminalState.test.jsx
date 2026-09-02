// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyTerminalState.test.jsx
//
// PR 2 — terminal-state honesty. "The client may not make a claim about server
// state it has not verified."
//
// THE DEFECT: the ceremony asserted "no battle was created" without checking
// whether one was. `decide.js:929` (`await agentRef.update({ activeBattleId })`)
// is the only statement that can throw between the battle commit at `:910` and
// the 200 at `:963` — so in the founding incident the battle was DURABLE, the
// client saw a 500, and the ceremony told the user nothing had happened.
//
// Every row is written to fail under the mutation named in its comment; the
// required set is §7's. Rows 1–3 and 10 run through DeployCeremony because the
// mutation they guard against (reverting the query key to the ranked `agent.id`,
// or falling back to `agent.activeBattleId`) lives there — a machine-level row
// with an injected checker cannot see it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const { targetProgressState, verifyMock } = vi.hoisted(() => ({
  targetProgressState: { value: null },
  verifyMock: vi.fn(),
}));

vi.mock('../../../services/agentBattleVerify', () => ({
  findActiveBattleForAgent: verifyMock,
  default: verifyMock,
}));
// ceremonyData's real module reaches firebase/config through authService; the
// ceremony never calls it here.
vi.mock('../../../firebase/authService', () => ({ getIdToken: vi.fn() }));
vi.mock('../../../hooks/useDeployTargetProgress', () => ({ default: () => targetProgressState.value }));
vi.mock('../../../hooks/useModalFocus', () => ({ default: () => {} }));
vi.mock('../../Research/useMarketContext', () => ({ default: () => ({ marketContext: null }) }));
vi.mock('./ceremonyData', async (importOriginal) => ({
  ...(await importOriginal()),
  useEquippedWatchlistSymbols: () => ({ symbols: [] }),
}));

const { default: useCeremonyStageMachine } = await import('./useCeremonyStageMachine.js');
const { default: DeployCeremony } = await import('./DeployCeremony.jsx');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid1';
const OURS = '2026-09-02T14:00:00.000Z';
const FOUND_BATTLE = { id: 'battle-found-1', agentId: CLONE, status: 'active', portfolio: { star: [] } };
// The string the client may only use when it has actually checked.
const NON_CREATION_CLAIM = 'no battle was created';

let container; let root; let seen;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
  seen = undefined;
  verifyMock.mockReset();
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

// ═══════════════════════════════════════════════════════════════════════════
// The machine seam — rows 4–9
// ═══════════════════════════════════════════════════════════════════════════
describe('useCeremonyStageMachine — the verification seam', () => {
  const T = { targetKnown: true, targetAgentId: CLONE };
  const BASE = {
    stage: undefined, deployId: undefined, updatedAt: undefined, errorPhase: undefined,
    deployStatus: 'pending', targetKnown: false, targetAgentId: null,
  };
  let verify;

  function MachineProbe(props) { seen = useCeremonyStageMachine(props); return null; }

  // Two separate act() calls: a concurrent root does not commit inside the
  // callback that scheduled it, so advancing timers in the SAME act would run
  // evaluate() against the previous render's inputs.
  const step = (props, ms = 200) => {
    act(() => { root.render(<MachineProbe {...{ ...BASE, ...props, verifyBattle: verify }} />); });
    act(() => { vi.advanceTimersByTime(ms); });
  };
  // Flush the async check: attempt 1, the 400ms propagation-lag gap, attempt 2.
  const flush = async (ms = 900) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  };
  // The baseline payload. A machine's FIRST observation of its target is the
  // baseline (§5), so an error delivered as the first payload would never be
  // "ours" and no error branch would fire at all.
  const armBaseline = () => step({ ...T, stage: undefined, deployId: null });

  beforeEach(() => {
    verify = vi.fn().mockResolvedValue({ found: false, battle: null });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  // ── ROW 4 ────────────────────────────────────────────────────────────────
  // Server error + empty query → the ONE combination that licenses a
  // non-creation claim. Both conditions are required.
  // MUTATION: hardcode tone 'lost_contact' (or drop the serverErrorSignal read)
  // → reds. Pre-PR-2 the machine never produced errorTone at all → reds.
  it('row 4 — server terminal error + empty query → confirmed failure', async () => {
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    expect(seen.phase).toBe('verifying');       // checked BEFORE claiming
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('confirmed');
    expect(seen.errorKind).toBe('server');       // retained as diagnostic context
    expect(verify).toHaveBeenCalled();
  });

  // errorPhase 'post_decision' only means the decision persisted at
  // decide.js:704, which PRECEDES battle creation at :910 — so it is not itself
  // evidence. It still confirms here only because the query came back empty.
  it('row 4b — post_decision server error + empty query → confirmed, kind retained', async () => {
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'post_decision' });
    await flush();
    expect(seen.errorTone).toBe('confirmed');
    expect(seen.errorKind).toBe('server_post');
  });

  // ── ROW 5 ────────────────────────────────────────────────────────────────
  // The founding incident's shape: the POST rejected, the server never wrote a
  // terminal error. One empty query is not enough to claim non-creation.
  // MUTATION: treat an empty query alone as confirmation → reds.
  it('row 5 — POST error + empty query, no server signal → lost contact', async () => {
    armBaseline();
    step({ ...T, deployStatus: 'error' });
    expect(seen.phase).toBe('verifying');
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
    expect(seen.errorKind).toBe('deploy');
  });

  // ── ROW 6 ────────────────────────────────────────────────────────────────
  // A watchdog firing means we stopped hearing, not that nothing happened.
  //
  // The 90s wait is advanced to JUST SHORT of the watchdog synchronously, and the
  // watchdog itself is crossed inside an ASYNC advance. That is load-bearing, not
  // cosmetic: a large SYNCHRONOUS advance runs the 2s budget timer to expiry
  // without ever letting the checker's promise resolve, so the row would commit
  // via the budget and silently duplicate row 8 instead of testing an empty
  // query. (It did, until this was caught by M5 below failing to red it.)
  it('row 6 — watchdog timeout + empty query → lost contact', async () => {
    armBaseline();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, 2500);
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, 87000);
    expect(seen.phase).toBe('theater');            // still inside the watchdog
    await flush(700);                              // watchdog crosses here
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('timeout');
    expect(verify).toHaveBeenCalled();
    await flush(800);                              // the second attempt lands
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
  });

  // ── ROW 7 ────────────────────────────────────────────────────────────────
  // The strongest form: a LOUD server error is present, and the check still
  // threw. A check that could not complete has learned nothing and must not
  // author a stronger claim than the one it replaced.
  // MUTATION: drop `checkFailed` from the tone expression (so the server signal
  // alone confirms) → reds.
  it('row 7 — verification throws → lost contact, even with a server error signal', async () => {
    verify.mockRejectedValue(new Error('permission-denied'));
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
    expect(seen.errorTone).not.toBe('confirmed');
  });

  // An absent checker is a check that could not RUN — same conclusion.
  it('row 7b — no checker wired at all → lost contact, never a non-creation claim', async () => {
    verify = undefined;
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
  });

  // ── ROW 8 ────────────────────────────────────────────────────────────────
  // The hard 2s cap. The user is already waiting; the budget resolves the
  // ceremony rather than stranding it, and resolves it HONESTLY.
  // MUTATION: remove the budget race → the machine hangs in 'verifying' and both
  // assertions red.
  it('row 8 — verification exceeds the 2s budget → lost contact', async () => {
    verify.mockReturnValue(new Promise(() => {}));   // never resolves
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush(1500);
    expect(seen.phase).toBe('verifying');            // still inside the budget
    await flush(1000);                               // now past 2000ms
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
  });

  // ── ROW 9 ────────────────────────────────────────────────────────────────
  // The latch. Without 'verifying' in the early return the machine keeps
  // evaluating error branches while a check is in flight: it starts a fresh
  // check on every 100ms tick and lets a later error branch overwrite the kind
  // that actually got it here — committing underneath its own verification.
  // MUTATION: drop 'verifying' from the early return → both counts and the kind
  // assertion red.
  it('row 9 — while verifying, no error branch re-fires and no second check starts', async () => {
    verify.mockReturnValue(new Promise(() => {}));   // hold the check open
    armBaseline();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, 2500);
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` }, 95000);
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('timeout');
    expect(verify).toHaveBeenCalledTimes(1);

    // ~10 further ticks, with the server's terminal error now landing mid-check
    // and the watchdog condition still true.
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'post_decision' }, 1000);
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('timeout');          // not overwritten by 'server_post'
    expect(verify).toHaveBeenCalledTimes(1);         // exactly one check, still the first
  });

  // The check that recovers. Machine half of row 1: a found battle is a REVEAL,
  // and it carries the id the query returned.
  it('a found battle routes to reveal and carries the battle through', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline();
    step({ ...T, deployStatus: 'error' });
    await flush();
    expect(seen.phase).toBe('reveal');
    expect(seen.stageIndex).toBe(4);
    expect(seen.errorTone).toBeNull();
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  // §3 — the bounded retry absorbs CLIENT propagation lag. It retries an EMPTY
  // answer only; it is not a poll and must stay inside the budget.
  it('a second attempt absorbs propagation lag: empty, then found → reveal', async () => {
    verify
      .mockResolvedValueOnce({ found: false, battle: null })
      .mockResolvedValueOnce({ found: true, battle: FOUND_BATTLE });
    armBaseline();
    step({ ...T, deployStatus: 'error' });
    await flush();
    expect(verify).toHaveBeenCalledTimes(2);
    expect(seen.phase).toBe('reveal');
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  it('stops at two attempts — the budget is a cap, not a poll', async () => {
    armBaseline();
    step({ ...T, deployStatus: 'error' });
    await flush(5000);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(seen.phase).toBe('error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The ceremony surface — rows 1, 2, 3, 10
// ═══════════════════════════════════════════════════════════════════════════
describe('DeployCeremony — the recovered path and the honest headline', () => {
  const rankedAgent = {
    id: RANKED,
    name: 'Nova',
    archetype: 'contrarian',
    // DELIBERATELY ABSENT. If decide.js:929 is the failure then this was never
    // written — that update IS the statement that threw — so any CTA that reads
    // it dead-ends the user on a null pointer in exactly the recovered case.
    activeBattleId: undefined,
    lastDeployedAt: null,
  };

  // Key-sensitive on purpose: the mock answers for the DEPLOY TARGET only. Revert
  // the caller's key to the ranked `agent.id` and this returns empty, which is
  // precisely the production failure — "no battle" with total confidence.
  const battleOnTargetOnly = () => verifyMock.mockImplementation(async (id) => (
    id === CLONE ? { found: true, battle: FOUND_BATTLE } : { found: false, battle: null }
  ));

  const renderWith = (deployProgress, deployResult, targetProgress, extraProps) => {
    targetProgressState.value = {
      deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true, ...targetProgress,
    };
    act(() => {
      root.render(
        <DeployCeremony
          agent={rankedAgent}
          agentName="Nova"
          targetAgentId={CLONE}
          deployResult={deployResult}
          onRetry={() => {}}
          onDismiss={() => {}}
          {...extraProps}
        />,
      );
    });
  };

  // TWO renders, deliberately. A machine's FIRST observation of its target is the
  // §5 BASELINE, so a deployProgress delivered on the mount render would never be
  // "ours" and no server branch could fire — the ceremony would fall through to
  // the client-error branch and every "confirmed" row would silently test the
  // lost-contact path instead. So: mount clean, then deliver this deploy's
  // outcome.
  const renderCeremony = async ({ targetProgress = {}, serverError = null, ...extraProps } = {}) => {
    renderWith(null, { status: 'pending' }, targetProgress, extraProps);
    renderWith(serverError, { status: 'error', error: 'deploy_http_500' }, targetProgress, extraProps);
    // Real timers here: the next 100ms tick, then attempt 1 → 400ms propagation
    // gap → attempt 2.
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    return document.body.textContent;
  };

  const buttonWithText = (text) => [...document.body.querySelectorAll('button')]
    .find((b) => (b.textContent || '').includes(text));

  // ── ROW 1 ────────────────────────────────────────────────────────────────
  // MUTATION: revert the query key to `agent.id` → the mock answers empty → the
  // error surface renders → reds.
  it('row 1 — a battle exists → reveal, not error', async () => {
    battleOnTargetOnly();
    const text = await renderCeremony();
    expect(text).toContain('Nova is ready for battle.');
    expect(text).not.toContain(NON_CREATION_CLAIM);
    expect(text).not.toContain('Couldn’t confirm the deploy.');
  });

  // ── ROW 2 — THE TRAP ─────────────────────────────────────────────────────
  // MUTATION A: revert the query key to `agent.id` → no battle found → reds.
  // MUTATION B: pass `agent.activeBattleId` on the recovered path instead of the
  // found battle → onEnterBattle receives null → reds.
  it('row 2 — activeBattleId absent + battle found → the CTA carries the id from the query', async () => {
    battleOnTargetOnly();
    const entered = [];
    await renderCeremony({ onEnterBattle: (b) => entered.push(b) });

    expect(rankedAgent.activeBattleId).toBeUndefined();   // the trap's precondition
    const cta = buttonWithText('Enter the battle');
    expect(cta).toBeTruthy();
    act(() => { cta.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(entered).toHaveLength(1);
    expect(entered[0]?.id).toBe(FOUND_BATTLE.id);
    expect(entered[0]).toEqual(FOUND_BATTLE);   // the whole doc, hydratable without a second read
  });

  // ── ROW 3 ────────────────────────────────────────────────────────────────
  // The key itself, at the ceremony's seam. (The query's own field names are
  // asserted in src/services/agentBattleVerify.test.js.)
  // MUTATION: revert the key to `agent.id` → reds on both assertions.
  it('row 3 — the check is keyed on targetAgentId, never on the ranked agent.id', async () => {
    battleOnTargetOnly();
    await renderCeremony();
    expect(verifyMock).toHaveBeenCalled();
    expect(verifyMock.mock.calls.every(([id]) => id === CLONE)).toBe(true);
    expect(verifyMock).not.toHaveBeenCalledWith(RANKED);
  });

  // The copy contract. Confirmed may assert non-creation; lost contact may not.
  it('row 4/5 copy — confirmed asserts non-creation, lost contact does not', async () => {
    verifyMock.mockResolvedValue({ found: false, battle: null });

    // Server terminal error for our deploy + empty query → confirmed.
    const confirmed = await renderCeremony({
      serverError: { stage: 'error', deployId: OURS, errorPhase: 'pre_decision' },
    });
    expect(confirmed).toContain(NON_CREATION_CLAIM);

    act(() => { root.render(<div key="reset" />); });

    // POST error only, no server signal → lost contact.
    const lost = await renderCeremony();
    expect(lost).not.toContain(NON_CREATION_CLAIM);
    expect(lost).toContain('Couldn’t confirm the deploy.');
    expect(lost).toContain('will appear on your hub');
  });

  // ── ROW 7 (surface half) ─────────────────────────────────────────────────
  it('row 7 — a thrown check never renders "no battle was created"', async () => {
    verifyMock.mockRejectedValue(new Error('permission-denied'));
    const text = await renderCeremony({
      serverError: { stage: 'error', deployId: OURS, errorPhase: 'post_decision' },
    });
    expect(text).not.toContain(NON_CREATION_CLAIM);
    expect(text).toContain('Couldn’t confirm the deploy.');
  });

  // ── ROW 10 ───────────────────────────────────────────────────────────────
  // §6: retry needs NO new mechanism. `canRetry` derives from cooldownUntil
  // (target lastDeployedAt + 120s) and is independent of the outcome — which is
  // what produces §4's table in practice:
  //   confirmed  — typically a PRE-decision failure, so decide.js:675 never ran,
  //                the cooldown is empty, and retry is immediately available.
  //   lost contact (the :929 case) — lastDeployedAt WAS written at :675 before
  //                the throw, so the cooldown is populated and gates the retry.
  describe('row 10 — retry availability', () => {
    beforeEach(() => { verifyMock.mockResolvedValue({ found: false, battle: null }); });

    it('confirmed failure with no deploy recorded → retry enabled', async () => {
      const text = await renderCeremony({
        serverError: { stage: 'error', deployId: OURS, errorPhase: 'pre_decision' },
        targetProgress: { lastDeployedAt: null },
      });
      expect(text).toContain(NON_CREATION_CLAIM);
      expect(text).toContain('Try again');
    });

    it('lost contact after a landed deploy → retry cooldown-gated', async () => {
      const text = await renderCeremony({
        targetProgress: { lastDeployedAt: new Date(Date.now() - 20000).toISOString() },
      });
      expect(text).toContain('Couldn’t confirm the deploy.');
      expect(text).toMatch(/Retry available in \d+s/);
      expect(text).not.toContain('Try again');
    });

    // The mechanism, stated: the gate is the cooldown, not the tone. A tone-keyed
    // gate would pass both rows above and fail this one.
    it('lost contact with no deploy recorded → retry enabled (the gate is the cooldown, not the tone)', async () => {
      const text = await renderCeremony({ targetProgress: { lastDeployedAt: null } });
      expect(text).toContain('Couldn’t confirm the deploy.');
      expect(text).toContain('Try again');
    });
  });
});
