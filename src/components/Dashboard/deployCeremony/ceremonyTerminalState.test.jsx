// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyTerminalState.test.jsx
//
// PR 2 — terminal-state honesty. "The client may not make a claim about server
// state it has not verified."
//
// THE DEFECT: the ceremony asserted "no battle was created" without checking
// whether one was. In the founding incident the battle was DURABLE, the client
// saw a 500, and the ceremony told the user nothing had happened. Why a 500 can
// mean that — and, for the attribution rows below, what it does NOT prove — is
// stated once, in the FAILURE MODEL block at the top of
// `services/agentBattleVerify.js`.
//
// THE MIRROR DEFECT, found in review: a check that answers "does a battle exist
// on this agent" is not an answer to "did THIS deploy create one". Swapping an
// unverified negative claim for an unverified positive one is the same failure.
// Attribution rows below hold that line.
//
// Every row names the mutation it dies under. Rows 1-3 and 10 run through
// DeployCeremony because the mutation they guard (reverting the query key to the
// ranked `agent.id`, or falling back to `agent.activeBattleId`) lives there.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { StrictMode } from 'react';
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
const { default: CeremonyError } = await import('./CeremonyError.jsx');
const { pickCeremonyEntry } = await import('./ceremonyData.js');
const ceremonyTiming = await import('./ceremonyTiming.js');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid1';
const OURS = '2026-09-02T14:00:00.000Z';
const PRIOR = '2026-09-01T09:00:00.000Z';
const FOUND_BATTLE = { id: 'battle-found-1', agentId: CLONE, status: 'active', portfolio: { star: [] } };

// EVERY claim the client may only make once it has actually checked. Matching on
// the single literal 'no battle was created' misses the `server_post` headline
// ("… made its picks, but the battle couldn't be created"), which is a
// full-strength non-creation claim — a row policing only the literal cannot fail
// under the defect it names.
const NON_CREATION_CLAIM = /no battle was created|couldn’t be created|couldn't be created/;
const LOST_CONTACT_HEADLINE = 'Couldn’t confirm the deploy.';

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
// The machine seam
// ═══════════════════════════════════════════════════════════════════════════
describe('useCeremonyStageMachine — the verification seam', () => {
  const T = { targetKnown: true, targetAgentId: CLONE };
  const BASE = {
    stage: undefined, deployId: undefined, updatedAt: undefined, errorPhase: undefined,
    deployStatus: 'pending', targetKnown: false, targetAgentId: null,
    deployHttpStatus: null, deployPostIssued: false,
  };
  // The client outcome that leaves a battle POSSIBLE: the POST reached the server
  // and came back 500. NOT "the battle is ours" — a 500 is also what decide.js
  // returns for a throw before the commit (FAILURE MODEL, in
  // services/agentBattleVerify.js). Eligibility, not attribution.
  const COULD_HAVE_COMMITTED = { deployStatus: 'error', deployPostIssued: true, deployHttpStatus: 500 };
  let verify;

  function MachineProbe(props) { seen = useCeremonyStageMachine(props); return null; }

  // Two separate act() calls: a concurrent root does not commit inside the
  // callback that scheduled it, so advancing timers in the SAME act would run
  // evaluate() against the previous render's inputs.
  const step = (props, ms = 200) => {
    act(() => { root.render(<MachineProbe {...{ ...BASE, ...props, verifyBattle: verify }} />); });
    act(() => { vi.advanceTimersByTime(ms); });
  };
  // ASYNC advance. Microtasks interleave with timers, so a check's promises can
  // actually resolve. A large SYNCHRONOUS advance instead runs the 2s budget to
  // expiry while the checker's promise never gets a turn — which silently turns
  // any row into a budget-timeout row. That disease was found in two rows during
  // review; every row that must observe a real answer flushes through here.
  const flush = async (ms = 900) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  };
  // The §5 baseline. A machine's FIRST observation of its target is the baseline,
  // so an error delivered as the first payload is never "ours".
  const armBaseline = (deployId = null) => step({ ...T, stage: undefined, deployId });
  // The server BEGINS our deploy: a deployId differing from the baseline, which
  // the machine pins. Attribution depends on this pin — see the attribution rows.
  const pinOurDeploy = () => step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` });

  beforeEach(() => {
    verify = vi.fn().mockResolvedValue({ found: false, battle: null });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  // ── ROW 4 ────────────────────────────────────────────────────────────────
  // Server error + empty query — the ONE combination that licenses a
  // non-creation claim. Both conditions are required.
  // DIES UNDER: tone hardcoded 'lost_contact'; beginVerification not setting the
  // kind; committing to error at the seam without checking.
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
  // evidence. It confirms here only because the query came back empty.
  it('row 4b — post_decision server error + empty query → confirmed, kind retained', async () => {
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'post_decision' });
    await flush();
    expect(seen.errorTone).toBe('confirmed');
    expect(seen.errorKind).toBe('server_post');
  });

  // The two halves of the server-error signal, separated. Both are load-bearing
  // and each was unguarded until review: every other row happened to satisfy both
  // at once, so dropping either disjunct reddened nothing.
  //
  // HALF A — the signal seen BEFORE the check began, and gone from the props by
  // the time it resolves (a late snapshot can overwrite the terminal block).
  // DIES UNDER: dropping `serverErrorSeenRef.current ||` from the disjunction.
  it('row 4c — a server error seen before the check still confirms after it resolves', async () => {
    let release;
    verify.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    expect(seen.phase).toBe('verifying');
    // The terminal error is no longer in the props when the answer lands.
    step({ ...T, stage: 'portfolio_running', deployId: OURS, updatedAt: `${OURS}-late` });
    await act(async () => { release({ found: false, battle: null }); await vi.advanceTimersByTimeAsync(900); });
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('confirmed');
  });

  // HALF B — the signal arrives DURING the check. The latch holds the machine
  // still, so it is only ever seen by the resolution's own re-read of the props.
  // DIES UNDER: dropping `|| ourErrorNow` from the disjunction.
  it('row 4d — a server error landing DURING the check is picked up at resolution', async () => {
    let release;
    verify.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    armBaseline();
    pinOurDeploy();
    step({ ...T, deployStatus: 'error' });                 // POST error starts the check
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('deploy');
    // Server writes its terminal error while the check is in flight.
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'post_decision', deployStatus: 'error' });
    await act(async () => { release({ found: false, battle: null }); await vi.advanceTimersByTimeAsync(900); });
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('confirmed');   // without the resolution re-read: 'lost_contact'
    expect(seen.errorKind).toBe('deploy');      // the kind that got us here, not the late one
  });

  // ── ROW 5 ────────────────────────────────────────────────────────────────
  // The founding incident's shape: the POST rejected, the server never wrote a
  // terminal error. One empty query is not enough to claim non-creation.
  // DIES UNDER: treating an empty query alone as confirmation.
  it('row 5 — POST error + empty query, no server signal → lost contact', async () => {
    armBaseline();
    pinOurDeploy();
    step({ ...T, deployStatus: 'error' });
    expect(seen.phase).toBe('verifying');
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
    expect(seen.errorKind).toBe('deploy');
  });

  // ── ROW 6 ────────────────────────────────────────────────────────────────
  // A watchdog firing means we stopped hearing, not that nothing happened.
  // The 90s wait is advanced synchronously to JUST SHORT of the watchdog; the
  // watchdog itself is crossed inside an ASYNC advance so the check can really
  // resolve. See the note on `flush` — without this the row commits via the
  // budget and silently duplicates row 8.
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
  // DIES UNDER: dropping `checkFailed` from the tone expression.
  it('row 7 — verification throws → lost contact, even with a server error signal', async () => {
    verify.mockRejectedValue(new Error('permission-denied'));
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
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

  // A checker that resolves something OTHER than its contract has not answered.
  // Treated as a definitive "no", a broken contract would license the exact claim
  // this machine may not make without evidence.
  // DIES UNDER: `if (r && r.found)` alone, i.e. any non-found resolution counting
  // as a real empty answer.
  it.each([
    ['nothing at all', undefined],
    ['a truthy payload with no `found`', { battle: FOUND_BATTLE }],
    ['a non-boolean `found`', { found: 'no', battle: null }],
  ])('row 7c — a checker resolving %s cannot license a non-creation claim', async (_label, resolved) => {
    verify.mockResolvedValue(resolved);
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');   // NOT 'confirmed'
  });

  // "Found" with nothing to open is not an answer either: it would reveal a
  // battle and then dead-end the CTA on a null id.
  it('row 7d — found:true with no battle payload never reveals', async () => {
    verify.mockResolvedValue({ found: true, battle: null });
    armBaseline();
    pinOurDeploy();
    step({ ...T, deployStatus: 'error' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
    expect(seen.recoveredBattle).toBeNull();
  });

  // ── ROW 8 ────────────────────────────────────────────────────────────────
  // The hard 2s cap. The user is already waiting; the budget resolves the
  // ceremony rather than stranding it, and resolves it HONESTLY.
  // DIES UNDER: removing the budget arm of the race.
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
  // evaluating error branches while a check is in flight: it starts a fresh check
  // on every 100ms tick and lets a later error branch overwrite the kind that
  // actually got it here — committing underneath its own verification.
  //
  // The check is held open by a never-resolving checker AND the whole row runs on
  // ASYNC advances, so the budget genuinely has not expired while the assertions
  // run. (Synchronously advancing past 2s would leave the machine in 'verifying'
  // only because the budget's continuation is an undrained microtask — the row
  // would then be measuring the sync/async boundary, not the latch.)
  it('row 9 — while verifying, no error branch re-fires and no second check starts', async () => {
    verify.mockReturnValue(new Promise(() => {}));   // hold the check open
    armBaseline();
    pinOurDeploy();
    step({ ...T, deployStatus: 'error', stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` });
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('deploy');
    expect(verify).toHaveBeenCalledTimes(1);

    // ~8 further ticks, still inside the 2s budget, with the server's terminal
    // error now landing mid-check and the client error still asserted.
    await flush(800);
    expect(seen.phase).toBe('verifying');            // the budget has NOT expired
    step({ ...T, deployStatus: 'error', stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'post_decision' });
    await flush(600);
    expect(seen.phase).toBe('verifying');
    expect(seen.errorKind).toBe('deploy');           // not overwritten by 'server_post'
    expect(verify).toHaveBeenCalledTimes(1);         // exactly one check, still the first
  });

  // ── ATTRIBUTION ──────────────────────────────────────────────────────────
  // A battle on this target is not necessarily a battle THIS deploy created.
  // decide.js returns 429 at :178 / :187 BEFORE the deployProgress init at :208,
  // so on a refused deploy the server writes nothing and the battle the query
  // finds belongs to a PREVIOUS deploy. Revealing then announces "Deployment
  // complete" for a deploy that never ran.
  // DIES UNDER: revealing on `outcome.found` alone.
  // Every pre-battle refusal in decide.js returns a 4xx/409/503 — :178 and :187
  // (the two 429s) return before the deployProgress init at :208, and :844/:907
  // before the commit at :910. So a status other than 500 PROVES the server
  // refused before it could create anything, and the battle the query finds is a
  // PREVIOUS deploy's. Revealing it announces "Deployment complete" for a deploy
  // that never ran.
  // DIES UNDER: revealing on `outcome.found` alone.
  it.each([
    ['429 — deploy already in progress (decide.js:178)', 429],
    ['429 — the 2-minute cooldown (decide.js:187)', 429],
    ['403 — ownership (decide.js:171)', 403],
    ['503 — pricing baseline gate (decide.js:844)', 503],
    ['409 — compiled-build gate (decide.js:907)', 409],
  ])('attribution — a %s refusal never reveals a battle it did not create', async (_label, httpStatus) => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR,
           deployStatus: 'error', deployPostIssued: true, deployHttpStatus: httpStatus });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.phase).not.toBe('reveal');
    expect(seen.errorTone).toBe('lost_contact');   // we do not know — and we say so
    expect(seen.recoveredBattle).toBeNull();
  });

  // A deploy that never reached the POST cannot have created anything either.
  it('attribution — a client-side bail that never reached the server never reveals', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR,
           deployStatus: 'error', deployPostIssued: false, deployHttpStatus: null });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.recoveredBattle).toBeNull();
  });

  // The canonical :929 failure: a 500 from the catch at :1012, which is the ONLY
  // status decide.js can return after the battle commit at :910.
  it('attribution — a 500 IS a reveal: the battle may well be ours', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR, ...COULD_HAVE_COMMITTED });
    await flush();
    expect(seen.phase).toBe('reveal');
    expect(seen.stageIndex).toBe(4);
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  // A transport failure is genuinely unknowable — the request may have landed and
  // committed — so it stays eligible.
  it('attribution — a transport failure with no status stays eligible for recovery', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR,
           deployStatus: 'error', deployPostIssued: true, deployHttpStatus: null });
    await flush();
    expect(seen.phase).toBe('reveal');
  });

  // ── R3 · THE SERVER'S OWN BATTLE ID ──────────────────────────────────────
  // One failure path hands us the id: a 200 carrying `agentBattleId` whose client
  // handoff then threw. That id is EXACT attribution — strictly stronger than the
  // status heuristic — so it both admits the 200 and pins the reveal to that
  // document. A 200 on its own must never buy a reveal: decide.js:748-758 returns
  // 200 + success:true carrying only `existingBattleId`, for a battle this deploy
  // did not create.
  const HANDOFF_THREW = {
    deployStatus: 'error', deployPostIssued: true, deployHttpStatus: 200, deployBattleId: FOUND_BATTLE.id,
  };

  // DIES UNDER: dropping deployBattleId from the gate (200 is not otherwise
  // eligible, so the reveal never happens).
  it('R3 — a handoff failure after a 200 reveals the battle the server named', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR, ...HANDOFF_THREW });
    await flush();
    expect(seen.phase).toBe('reveal');
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  // The id is a KEY, not a permission slip. If the document the check found is not
  // the one the server named, the reveal would open a battle this deploy did not
  // create — the mirror defect, reached through the 200 door.
  // DIES UNDER: admitting 200 on the status alone (dropping the id match).
  it('R3 — a 200 whose id does not match the found battle never reveals', async () => {
    verify.mockResolvedValue({ found: true, battle: { id: 'battle-someone-elses', status: 'active' } });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR, ...HANDOFF_THREW });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.recoveredBattle).toBeNull();
  });

  // The decide.js:748-758 branch: 200, success:true, `existingBattleId` only. No
  // id reaches the machine, so 200 falls back to being an ordinary refusal status.
  // DIES UNDER: widening the gate to admit httpStatus === 200.
  it('R3 — a 200 with no battle id is not eligible, however loud the query', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR,
           deployStatus: 'error', deployPostIssued: true, deployHttpStatus: 200, deployBattleId: null });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
    expect(seen.recoveredBattle).toBeNull();
  });

  // The 500 path carries no id, so the match is vacuous and the status heuristic
  // (plus the verifier's league filter) is all the narrowing there is. Guards
  // against the match being written as a REQUIREMENT rather than a refinement.
  it('R3 — the id match does not gate the paths that never have an id', async () => {
    verify.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    armBaseline(PRIOR);
    step({ ...T, stage: 'complete', deployId: PRIOR, updatedAt: PRIOR, ...COULD_HAVE_COMMITTED });
    await flush();
    expect(seen.phase).toBe('reveal');
  });

  // §3 — the bounded retry absorbs CLIENT propagation lag. It retries an EMPTY
  // answer only; it is not a poll and must stay inside the budget.
  it('a second attempt absorbs propagation lag: empty, then found → reveal', async () => {
    verify
      .mockResolvedValueOnce({ found: false, battle: null })
      .mockResolvedValueOnce({ found: true, battle: FOUND_BATTLE });
    armBaseline();
    pinOurDeploy();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, ...COULD_HAVE_COMMITTED });
    await flush();
    expect(verify).toHaveBeenCalledTimes(2);
    expect(seen.phase).toBe('reveal');
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  it('stops at two attempts — the budget is a cap, not a poll', async () => {
    armBaseline();
    pinOurDeploy();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, deployStatus: 'error' });
    await flush(5000);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(seen.phase).toBe('error');
  });

  // A LATER attempt failing must not erase an EARLIER completed answer: the
  // retry only exists to absorb propagation lag, so a completed "not found" is
  // real evidence that only a FOUND answer could improve on.
  // DIES UNDER: letting attempt 2's rejection propagate unconditionally.
  it('a completed "not found" survives a throwing second attempt', async () => {
    verify
      .mockResolvedValueOnce({ found: false, battle: null })
      .mockRejectedValueOnce(new Error('transient'));
    armBaseline();
    step({ ...T, stage: 'error', deployId: OURS, updatedAt: `${OURS}-e`, errorPhase: 'pre_decision' });
    await flush();
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('confirmed');   // attempt 1's answer still counts
  });

  // The checker is read PER ATTEMPT, never once per check: `targetAgentId` can
  // resolve (ranked → clone) inside the 400ms gap, and a second attempt against
  // the previous document is the "right answer, wrong document" failure this
  // whole PR exists to prevent.
  // DIES UNDER: hoisting `const verify = verifyRef.current` out of the loop.
  it('a mid-check target change is honoured on the next attempt', async () => {
    const rankedChecker = vi.fn().mockResolvedValue({ found: false, battle: null });
    const cloneChecker = vi.fn().mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    verify = rankedChecker;
    armBaseline();
    pinOurDeploy();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, ...COULD_HAVE_COMMITTED });
    expect(seen.phase).toBe('verifying');
    // The clone resolves during the 400ms gap.
    verify = cloneChecker;
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, ...COULD_HAVE_COMMITTED }, 0);
    await flush();
    expect(cloneChecker).toHaveBeenCalled();
    expect(seen.phase).toBe('reveal');
    expect(seen.recoveredBattle).toEqual(FOUND_BATTLE);
  });

  // A check belongs to the effect that started it. Its cleanup abandons the
  // in-flight resolution, but `phaseRef` is a COMPONENT ref and survives — so
  // without an explicit release the latch would hold a remounted machine still
  // forever, waiting on an answer that can never arrive. React StrictMode
  // mounts → destroys → remounts the effect in one dev commit, and src/main.jsx
  // wraps the app in StrictMode.
  // DIES UNDER: removing the `phaseRef` release at the top of the effect.
  it('StrictMode double-invoke does not freeze the machine in verifying', async () => {
    function StrictProbe(props) { seen = useCeremonyStageMachine(props); return null; }
    const props = {
      ...BASE, ...T, deployStatus: 'error',
      stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`,
      verifyBattle: verify,
    };
    act(() => { root.render(<StrictMode><StrictProbe {...props} /></StrictMode>); });
    await flush(3000);
    expect(seen.phase).not.toBe('verifying');   // pre-fix: stuck here forever
    expect(seen.phase).toBe('error');
    expect(seen.errorTone).toBe('lost_contact');
  });

  // The check must not keep working against a tree that is gone: no state write,
  // and no second Firestore read from a straggler gap timer.
  // DIES UNDER: removing the `!alive` guards, or not clearing the gap timer.
  it('unmount mid-check abandons the work rather than finishing it', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    delete window.__ceremonyTiming;
    ceremonyTiming.startRun();
    armBaseline();
    pinOurDeploy();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, deployStatus: 'error' });
    expect(seen.phase).toBe('verifying');
    expect(verify).toHaveBeenCalledTimes(1);

    // Let attempt 1 actually COMPLETE, so the 400ms inter-attempt gap timer
    // exists. Unmounting before it is armed would leave nothing to cancel and the
    // assertion below could not fail.
    await flush(50);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(1);   // interval + budget + gap

    act(() => { root.render(<div key="gone" />); });
    // Teardown leaves NO pending work: the machine's interval and both of the
    // check's timers (the 2s budget and the 400ms inter-attempt gap) are all
    // cancelled with the effect, rather than left to fire into a dead tree.
    expect(vi.getTimerCount()).toBe(0);
    await flush(3000);

    // No second attempt: the gap timer is cancelled with the effect and the loop
    // re-checks liveness after every await.
    expect(verify).toHaveBeenCalledTimes(1);
  });

  // The other half: an answer that is ALREADY IN when the tree comes down. The
  // cancellations above mean an abandoned check usually never completes at all,
  // so the liveness guard at the commit is only reachable in this narrow window —
  // the checker resolves, and the teardown lands before the continuation runs.
  // React silently drops setState on a dead tree, so the observable half of the
  // commit is the record-only instrumentation it also drives: a ceremony the user
  // dismissed must not stamp a terminal record from a check nobody is waiting on.
  // DIES UNDER: removing `if (!alive) return;` before the commit block.
  it('an answer that lands after teardown is discarded, not committed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    delete window.__ceremonyTiming;
    ceremonyTiming.startRun();
    let release;
    verify.mockReturnValue(new Promise((r) => { release = r; }));
    armBaseline();
    pinOurDeploy();
    step({ ...T, stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1`, deployStatus: 'error' });
    expect(seen.phase).toBe('verifying');

    // Answer first, teardown immediately after — before the continuation runs.
    release({ found: true, battle: FOUND_BATTLE });
    act(() => { root.render(<div key="gone" />); });
    await flush(100);

    expect(window.__ceremonyTiming).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The entry-precedence rule
// ═══════════════════════════════════════════════════════════════════════════
describe('pickCeremonyEntry — which battle the CTA opens', () => {
  const STASH = { id: 'built-at-deploy-time' };

  // DIES UNDER: preferring the stash when a recovered battle is present.
  it('the recovered battle beats a stash left behind by a dismissed reveal', () => {
    expect(pickCeremonyEntry(STASH, FOUND_BATTLE)).toEqual({ kind: 'recovered', battle: FOUND_BATTLE });
  });

  it('the ordinary reveal still uses the battle built at deploy time', () => {
    expect(pickCeremonyEntry(STASH, null)).toEqual({ kind: 'stash', battle: STASH });
  });

  // In the :929 scenario there is no stash at all — the POST never returned.
  it('the recovered path works with no stash whatsoever', () => {
    expect(pickCeremonyEntry(null, FOUND_BATTLE)).toEqual({ kind: 'recovered', battle: FOUND_BATTLE });
  });

  // A battle with no id cannot be opened; saying so beats navigating nowhere.
  it('a battle with no id is not an entry', () => {
    expect(pickCeremonyEntry(null, { status: 'active' }).kind).toBe('none');
    expect(pickCeremonyEntry(null, null).kind).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The error surface, rendered directly
// ═══════════════════════════════════════════════════════════════════════════
describe('CeremonyError — the outcome selects the headline', () => {
  const render = (props) => {
    act(() => { root.render(<CeremonyError agentName="Nova" {...props} />); });
    return container.textContent;
  };

  // DIES UNDER: defaulting errorTone to 'confirmed'. An unstated outcome must
  // fail toward the WEAKER claim — the whole point of the PR.
  it('an unstated outcome falls back to lost contact, never to a non-creation claim', () => {
    const text = render({ errorKind: 'server' });
    expect(text).not.toMatch(NON_CREATION_CLAIM);
    expect(text).toContain(LOST_CONTACT_HEADLINE);
  });

  // DIES UNDER: always rendering HEADLINE.deploy, i.e. errorKind no longer
  // selecting among the confirmed headlines.
  it('errorKind still selects among the CONFIRMED headlines', () => {
    expect(render({ errorTone: 'confirmed', errorKind: 'server_post' }))
      .toContain('Nova made its picks, but the battle couldn’t be created.');
    expect(render({ errorTone: 'confirmed', errorKind: 'timeout' }))
      .toContain('Deployment timed out — no battle was created.');
    expect(render({ errorTone: 'confirmed', errorKind: 'deploy' }))
      .toContain('Deployment failed — no battle was created.');
  });

  // Lost contact overrides every kind — including server_post, whose confirmed
  // headline is itself a full-strength non-creation claim.
  it('lost contact suppresses the non-creation claim for EVERY kind', () => {
    ['deploy', 'server', 'server_post', 'timeout'].forEach((errorKind) => {
      const text = render({ errorTone: 'lost_contact', errorKind });
      expect(text).not.toMatch(NON_CREATION_CLAIM);
      expect(text).toContain(LOST_CONTACT_HEADLINE);
      expect(text).toContain('will appear on your hub');
    });
  });

  it('errorKind still rides alongside details as diagnostic context', () => {
    const text = render({ errorTone: 'lost_contact', errorKind: 'deploy', details: 'HTTP 500 boom' });
    expect(text).toContain('HTTP 500 boom');
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
    // DELIBERATELY ABSENT. On the recovered path the write that sets this IS the
    // statement that threw (FAILURE MODEL, services/agentBattleVerify.js), so any
    // CTA that reads it dead-ends the user in exactly the recovered case.
    activeBattleId: undefined,
    lastDeployedAt: null,
  };

  // Key-sensitive on purpose: the mock answers for the DEPLOY TARGET only. Revert
  // the caller's key to the ranked `agent.id` and this returns empty, which is
  // precisely the production failure — "no battle" with total confidence.
  const battleOnTargetOnly = () => verifyMock.mockImplementation(async (id) => (
    id === CLONE ? { found: true, battle: FOUND_BATTLE } : { found: false, battle: null }
  ));

  const renderWith = (deployProgress, deployResult, targetProgress, extraProps, targetAgentId = CLONE) => {
    targetProgressState.value = {
      deployProgress, lastDeployedAt: null, lastDecision: null, targetKnown: true, ...targetProgress,
    };
    act(() => {
      root.render(
        <DeployCeremony
          agent={rankedAgent}
          agentName="Nova"
          targetAgentId={targetAgentId}
          deployResult={deployResult}
          onRetry={() => {}}
          onDismiss={() => {}}
          {...extraProps}
        />,
      );
    });
  };

  // Poll rather than sleep a fixed span: the real duration is the next 100ms tick
  // plus attempt 1, the 400ms gap and attempt 2, and a fixed sleep tuned to that
  // is one slow CI box away from a flake — and silently couples rows that say
  // nothing about the attempt count to its value.
  const settle = async (timeoutMs = 5000) => {
    const done = () => /Deployment (complete|failed|unconfirmed)/.test(document.body.textContent || '');
    const start = Date.now();
    while (!done() && Date.now() - start < timeoutMs) {
      await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    }
    if (!done()) throw new Error(`ceremony never reached a terminal surface within ${timeoutMs}ms`);
  };
  const tick = async (ms = 150) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

  // THREE renders, deliberately. (1) mount clean — that payload is the §5
  // baseline. (2) the server BEGINS our deploy: a deployId differing from the
  // baseline, which the machine pins and which is what lets a recovered reveal be
  // attributed to this deploy. (3) this deploy's outcome. Collapsing (1) and (3)
  // would make every "confirmed" row silently test the lost-contact path instead.
  const OUR_PROGRESS = { stage: 'strategy_running', deployId: OURS, updatedAt: `${OURS}-1` };
  // Default outcome: the POST reached the server and came back 500 — the only
  // status decide.js can return after the battle commit at :910, i.e. the
  // canonical :929 failure. `httpStatus` overrides it to model a refusal.
  const renderCeremony = async ({ targetProgress = {}, serverError = null, httpStatus = 500, ...extraProps } = {}) => {
    renderWith(null, { status: 'pending' }, targetProgress, extraProps);
    renderWith(OUR_PROGRESS, { status: 'pending' }, targetProgress, extraProps);
    await tick();
    renderWith(
      serverError ?? OUR_PROGRESS,
      { status: 'error', error: 'deploy_http_500', postIssued: true, httpStatus },
      targetProgress, extraProps,
    );
    await settle();
    return document.body.textContent;
  };

  const buttonWithText = (text) => [...document.body.querySelectorAll('button')]
    .find((b) => (b.textContent || '').includes(text));

  // ── ROW 1 ────────────────────────────────────────────────────────────────
  // DIES UNDER: reverting the query key to `agent.id` (the mock answers empty).
  it('row 1 — a battle exists → reveal, not error', async () => {
    battleOnTargetOnly();
    const text = await renderCeremony();
    expect(text).toContain('Nova is ready for battle.');
    expect(text).not.toMatch(NON_CREATION_CLAIM);
  });

  // ── ROW 2 — THE TRAP ─────────────────────────────────────────────────────
  // DIES UNDER: (a) reverting the query key to `agent.id`; (b) passing
  // `agent.activeBattleId` on the recovered path instead of the found battle.
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
  it('row 3 — the check is keyed on targetAgentId, never on the ranked agent.id', async () => {
    battleOnTargetOnly();
    await renderCeremony();
    expect(verifyMock).toHaveBeenCalled();
    expect(verifyMock.mock.calls.every(([id]) => id === CLONE)).toBe(true);
    expect(verifyMock).not.toHaveBeenCalledWith(RANKED);
  });

  // The verifier must follow `targetAgentId` when it resolves AFTER mount, which
  // is the production order: the ranked id is reported first, the clone second.
  // DIES UNDER: a `useCallback` with an empty dependency array.
  it('the checker follows targetAgentId when the clone resolves after mount', async () => {
    battleOnTargetOnly();
    renderWith(null, { status: 'pending' }, {}, {}, RANKED);          // ranked first
    renderWith(null, { status: 'pending' }, {}, {}, CLONE);           // clone resolves, pre-deploy
    await tick();
    renderWith(OUR_PROGRESS, { status: 'pending' }, {}, {}, CLONE);   // the server begins our deploy
    await tick();
    renderWith(OUR_PROGRESS, { status: 'error', error: 'boom', postIssued: true, httpStatus: 500 }, {}, {}, CLONE);
    await settle();
    expect(verifyMock).toHaveBeenCalledWith(CLONE);
    expect(document.body.textContent).toContain('Nova is ready for battle.');
  });

  // ── THE CENTRAL RENDERING CONTRACT ───────────────────────────────────────
  // `verifying` renders as THEATER — no new screen, and above all no terminal
  // claim while the check is still running. Sampling only after the check
  // resolves cannot see this, which is how it went unguarded until review.
  // DIES UNDER: routing `verifying` to the error surface (or to the reveal).
  it('verifying renders as theater — no terminal claim while the check runs', async () => {
    verifyMock.mockReturnValue(new Promise(() => {}));   // hold the check open
    renderWith(null, { status: 'pending' }, {}, {});
    renderWith(OUR_PROGRESS, { status: 'pending' }, {}, {});
    await tick();
    renderWith(OUR_PROGRESS, { status: 'error', error: 'boom', postIssued: true, httpStatus: 500 }, {}, {});
    await tick(300);

    const text = document.body.textContent;
    expect(verifyMock).toHaveBeenCalled();               // the check IS running
    expect(text).not.toMatch(NON_CREATION_CLAIM);
    expect(text).not.toContain(LOST_CONTACT_HEADLINE);
    expect(text).not.toContain('Deployment failed');
    expect(text).not.toContain('Deployment complete');
    expect(text).toContain('Contrarian');                // CeremonyTheater's archetype chip —
                                                         // theater-only, unlike the stage label,
                                                         // which the live region also carries
    // Still dismissible. During the theater the escape hatch is the overlay's
    // icon button (aria-labelled), not the text button the terminal surfaces use.
    expect(document.querySelector('button[aria-label="Back to hub"]')).toBeTruthy();
  });

  // ── R5 · THE CONTINUITY GUARD ────────────────────────────────────────────
  // "Renders as theater" is a claim about what the theater KEEPS, and the row
  // above cannot see that: it asserts on the presence of copy and of the overlay's
  // own dismiss button, both of which survive any amount of loss around them. The
  // mutation that broke this — `canSkip` gated on `phase === 'theater'` alone —
  // reddened ZERO of 111 rows while the Skip control vanished for the whole 2s
  // budget, in the one window a user is most likely to be reaching for it.
  //
  // So compare the CONTROLS either side of the transition, not the prose.
  // DIES UNDER: dropping 'verifying' from canSkip (useCeremonyStageMachine.js).
  const controls = () => [...document.body.querySelectorAll('button')]
    .map((b) => b.getAttribute('aria-label') || (b.textContent || '').trim())
    .sort();

  it('R5 — the theater keeps every control across the theater → verifying transition', async () => {
    verifyMock.mockReturnValue(new Promise(() => {}));   // hold the check open
    const AT_COMPLETE = { stage: 'strategy_complete', deployId: OURS, updatedAt: `${OURS}-2` };

    renderWith(null, { status: 'pending' }, {}, {});
    renderWith(OUR_PROGRESS, { status: 'pending' }, {}, {});
    await tick();
    // strategy_complete is what puts Skip on screen (spec §5.2), so the row has
    // something to lose. Assert that first — otherwise it could pass vacuously.
    renderWith(AT_COMPLETE, { status: 'pending' }, {}, {});
    await tick(300);
    const before = controls();
    expect(before).toContain('Skip to reveal');

    // The deploy fails. The machine enters 'verifying', which renders as theater.
    renderWith(AT_COMPLETE, { status: 'error', error: 'boom', postIssued: true, httpStatus: 500 }, {}, {});
    await tick(300);

    expect(verifyMock).toHaveBeenCalled();               // the check IS running
    expect(document.body.textContent).not.toMatch(/Deployment (complete|failed|unconfirmed)/);
    expect(controls()).toEqual(before);                  // nothing gained, nothing lost
  });

  // The live region must not out-claim the headline it accompanies: a screen
  // reader hearing "Deployment failed." beside a "Couldn't confirm" headline is
  // the same dishonesty in another channel.
  // DIES UNDER: reverting liveText to an unconditional 'Deployment failed.'
  it('the live region matches the honesty of the headline', async () => {
    verifyMock.mockResolvedValue({ found: false, battle: null });
    await renderCeremony();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live.textContent).not.toContain('Deployment failed.');
    expect(live.textContent).toContain('confirm');
  });

  // The copy contract. Confirmed may assert non-creation; lost contact may not.
  it('row 4/5 copy — confirmed asserts non-creation, lost contact does not', async () => {
    verifyMock.mockResolvedValue({ found: false, battle: null });

    const confirmed = await renderCeremony({
      serverError: { stage: 'error', deployId: OURS, errorPhase: 'pre_decision' },
    });
    expect(confirmed).toMatch(NON_CREATION_CLAIM);

    act(() => { root.render(<div key="reset" />); });

    const lost = await renderCeremony();
    expect(lost).not.toMatch(NON_CREATION_CLAIM);
    expect(lost).toContain(LOST_CONTACT_HEADLINE);
    expect(lost).toContain('will appear on your hub');
  });

  // ── ROW 7 (surface half) ─────────────────────────────────────────────────
  it('row 7 — a thrown check never renders a non-creation claim', async () => {
    verifyMock.mockRejectedValue(new Error('permission-denied'));
    const text = await renderCeremony({
      serverError: { stage: 'error', deployId: OURS, errorPhase: 'post_decision' },
    });
    expect(text).not.toMatch(NON_CREATION_CLAIM);
    expect(text).toContain(LOST_CONTACT_HEADLINE);
  });

  // ── ATTRIBUTION (surface half) ───────────────────────────────────────────
  // A refused deploy must not be announced as a success just because the agent
  // already had a battle.
  it('a refused deploy (429) never reveals a battle it did not create', async () => {
    verifyMock.mockResolvedValue({ found: true, battle: FOUND_BATTLE });
    const text = await renderCeremony({ httpStatus: 429 });
    expect(text).not.toContain('Nova is ready for battle.');
    expect(text).toContain(LOST_CONTACT_HEADLINE);
  });

  // ── ROW 10 ───────────────────────────────────────────────────────────────
  // §6: retry needs NO new mechanism. `canRetry` derives from cooldownUntil
  // (target lastDeployedAt + 120s) and is independent of the outcome — which is
  // what produces the spec's table in practice:
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
      expect(text).toMatch(NON_CREATION_CLAIM);
      expect(text).toContain('Try again');
    });

    it('lost contact after a landed deploy → retry cooldown-gated', async () => {
      const text = await renderCeremony({
        targetProgress: { lastDeployedAt: new Date(Date.now() - 20000).toISOString() },
      });
      expect(text).toContain(LOST_CONTACT_HEADLINE);
      expect(text).toMatch(/Retry available in \d+s/);
      expect(text).not.toContain('Try again');
    });

    // The mechanism, stated: the gate is the cooldown, not the tone. A tone-keyed
    // gate would pass both rows above and fail this one.
    it('lost contact with no deploy recorded → retry enabled (the gate is the cooldown, not the tone)', async () => {
      const text = await renderCeremony({ targetProgress: { lastDeployedAt: null } });
      expect(text).toContain(LOST_CONTACT_HEADLINE);
      expect(text).toContain('Try again');
    });
  });
});
