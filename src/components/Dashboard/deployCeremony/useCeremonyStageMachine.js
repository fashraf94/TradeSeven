// src/components/Dashboard/deployCeremony/useCeremonyStageMachine.js
//
// Deploy Ceremony · Act 2 — the stage machine. Drives five display stages off
// three real server checkpoints (deployProgress) plus the client's own deploy
// outcome, enforcing every binding rule in spec §5:
//
//   - Monotonic (§5.1 / A.2 D-1): advance to the furthest server checkpoint
//     observed; tolerate missing intermediates; IGNORE any stage that regresses
//     (Phase 1 deliberately permits a late write to regress the persisted stage —
//     absorbed here, load-bearing, not defensive).
//   - Elasticity (§5.2): per-stage minimum floors (2.0/2.5/2.5/2.5s ≈ 9.5s) so a
//     fast pipeline never flashes; gating so we never pass stage 2 without
//     strategy_complete, nor stage 4 without complete.
//   - Slow state 45s / watchdog 90s (§5.2) while the deploy is still pending.
//   - Unsolicited-progress guard (§5.3 / A.1 §7): pin the deployId of OUR deploy
//     and ignore progress from any other deployId (cron write, cross-device,
//     stale map). The baseline it pins against is scoped to (this machine
//     instance, the current DEPLOY TARGET id) — see the guard block below.
//   - Dual-signal reveal (§5.3 / A.2 §8): reveal only when the server stage is
//     'complete' AND our own deployAgent call returned success. Telemetry alone
//     never reveals; a persisted decision whose battle-creation threw (deploy
//     error) routes to the error surface, not a reveal of a battle that does not
//     exist.
//   - Terminal-state honesty (PR 2): the client may not make a claim about server
//     state it has not verified. Every error commit routes to 'verifying' — a
//     FOURTH phase, not a sub-state of theater (a sub-state leaves the machine
//     free to re-enter an error branch on the next tick) — which runs a direct
//     `agentBattles` re-read before committing to any terminal claim. A check
//     that could not complete has learned NOTHING and must not author a stronger
//     claim than the one it replaced: it says "lost contact", never "no battle
//     was created".
//
// What a `decide.js` status does and does not prove — the reasoning the
// attribution gate below rests on — is stated ONCE, in the FAILURE MODEL block at
// the top of `services/agentBattleVerify.js`. It is pinned to line numbers in a
// fenced file, so it lives in one place rather than five. Read it before touching
// the gate.
//
// The deployProgress it consumes comes from the DEPLOY-TARGET document, not the
// ranked agent doc: on the casual-clone path the server writes progress to
// agents/{cloneId}, which the ranked-agent subscription excludes by design.
//
// Consumes deployProgress sub-fields as PRIMITIVES (spec §5.5) so the ~5 snapshot
// ticks over a deploy don't churn effects.

import { useEffect, useRef, useState } from 'react';
// Record-only stage instrumentation (console; no writes, nothing gates on it).
import * as ceremonyTiming from './ceremonyTiming';

// Server checkpoint → monotonic rank.
const SERVER_RANK = {
  strategy_running: 1,
  strategy_complete: 2,
  portfolio_running: 3,
  complete: 4,
};
// Minimum on-screen time per display stage (index 0..3). Reveal (4) has no floor.
const MIN_FLOOR_MS = [2000, 2500, 2500, 2500];
// Server rank required to be IN display stage i (reveal=4 gated additionally on
// the client success signal below).
const REQUIRED_RANK = [0, 1, 2, 3, 4];
const SLOW_MS = 45000;
const WATCHDOG_MS = 90000;
// A returned client success authoritatively means the battle exists AND the
// server wrote stage:'complete' in the same awaited update (decide.js). If that
// checkpoint is never observed for our deployId (lost write, snapshot lag, or a
// mis-pinned deployId), don't strand the user on the theater — treat success as
// complete after this grace. The dual-signal's post-persistence guard is
// unaffected: a client ERROR still routes to the error surface first.
const SUCCESS_GRACE_MS = 4000;
const STAGE_KEYS = ['loadout', 'scanning', 'brief', 'portfolio'];

// ── Existence-check budget (PR 2 §3) ────────────────────────────────────────
// A HARD cap: the user is already waiting, and this is not a poll. Discovery Q4
// established there is no server-side unreadable window — the battle write is
// committed and AWAITED before the post-commit window opens (FAILURE MODEL, in
// services/agentBattleVerify.js) — so the only thing a second attempt absorbs is
// CLIENT propagation lag, not a still-running server. Never extend it to wait one
// out.
const VERIFY_BUDGET_MS = 2000;
const VERIFY_ATTEMPTS = 2;
const VERIFY_RETRY_GAP_MS = 400;
// The check produced no usable answer: the budget expired, no checker was wired,
// the checker broke its contract, or the machine was torn down mid-check. Every
// one of those is "we do not know", never "nothing happened" — so they all
// resolve the same way. Distinguishable from any resolution a checker could
// itself produce, which is the point of a Symbol.
const VERIFY_NO_ANSWER = Symbol('verify-no-answer');

export default function useCeremonyStageMachine({
  stage, deployId, updatedAt, errorPhase, deployStatus,
  // What the client's own POST learned. See the attribution block below.
  deployHttpStatus = null, deployPostIssued = false,
  // The battle id the SERVER returned, on the one failure path that has one: a
  // 200 carrying `agentBattleId` whose client handoff then threw. Absent on every
  // other path, including the 200 that carries only `existingBattleId`. When
  // present it is EXACT attribution — the id names the battle this deploy made —
  // and the gate below leans on it instead of the status heuristic.
  deployBattleId = null,
  // Deploy-target scoping (§5). `targetKnown` is TRUE only once a snapshot for
  // `targetAgentId` has actually been observed — see useDeployTargetProgress.
  targetKnown = true, targetAgentId = null,
  // PR 2: the existence check. `() => Promise<{ found, battle }>`; THROWS when the
  // check cannot complete. Absent (or not a function) is itself a check that could
  // not run, and resolves to "lost contact" — never to a non-creation claim.
  verifyBattle = null,
}) {
  // Public outputs
  const [phase, setPhase] = useState('theater'); // 'theater' | 'verifying' | 'reveal' | 'error'
  const [stageIndex, setStageIndex] = useState(0);
  const [serverRank, setServerRank] = useState(0);
  const [slow, setSlow] = useState(false);
  const [errorKind, setErrorKind] = useState(null); // 'deploy' | 'server' | 'server_post' | 'timeout'
  // What the VERIFICATION concluded — this, not errorKind, selects the headline.
  // 'confirmed'    → a server error signal AND an empty query. Both required
  //                  before the client may assert that no battle was created.
  // 'lost_contact' → anything else. We do not know, and say so.
  const [errorTone, setErrorTone] = useState(null);
  // The battle the check FOUND, carried through to the reveal CTA. In the `:929`
  // scenario `agent.activeBattleId` was never written — that write is the
  // statement that threw — so the CTA must use this and never fall back to it.
  const [recoveredBattle, setRecoveredBattle] = useState(null);

  // Latest inputs, mirrored into refs so the single interval reads fresh values
  // without re-subscribing on every snapshot tick.
  const inRef = useRef({ stage, deployId, updatedAt, errorPhase, deployStatus, targetKnown, targetAgentId, deployHttpStatus, deployPostIssued, deployBattleId });
  inRef.current = { stage, deployId, updatedAt, errorPhase, deployStatus, targetKnown, targetAgentId, deployHttpStatus, deployPostIssued, deployBattleId };
  // Mirrored for the same reason as the inputs: the mount-once effect must call
  // the CURRENT checker, not the one captured at first render.
  const verifyRef = useRef(verifyBattle);
  verifyRef.current = verifyBattle;

  // Internal bookkeeping
  const mountRef = useRef(0);
  // §5 baseline, scoped to (THIS machine instance, the CURRENT target id) — not
  // to mount, and not to a fresh-snapshot event. `null` is a legitimate baseline
  // value (a target that carries no deployProgress at all), so establishment is
  // tracked by its own flag and can never be inferred from the value.
  const baselineDeployIdRef = useRef(null);
  const baselineSetRef = useRef(false);          // has a baseline been established?
  const baselineTargetRef = useRef(null);        // which target it was established for
  const ourDeployIdRef = useRef(null);           // our deploy's pinned deployId
  const maxRankRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const lastUpdatedAtRef = useRef(null);
  const successAtRef = useRef(0); // when the client deploy first returned success
  const stageEnteredAtRef = useRef(0);
  const skipRef = useRef(false);
  const stageIndexRef = useRef(0);
  // INTERVAL-OWNED, deliberately not mirrored from `phase` during render. It is
  // the latch the interval reads, and every transition below sets it
  // synchronously at the moment of commit. A render-time mirror could be written
  // by a render that began BEFORE the latch was taken and still carries the old
  // phase, which would unlatch the machine mid-check — the exact thing the latch
  // exists to prevent. `phase` has no setter outside this hook, so the two can
  // never disagree about anything else.
  const phaseRef = useRef('theater');
  // Whether the SERVER wrote a terminal error for OUR deploy. This is the second
  // of the two conditions a confirmed-failure claim requires; on its own it is
  // NOT evidence of non-creation — see WHY THE CHEAP SIGNALS ARE NOT EVIDENCE in
  // services/agentBattleVerify.js — which is why it is only ever read alongside an
  // empty query.
  const serverErrorSeenRef = useRef(false);
  stageIndexRef.current = stageIndex;

  const requestSkip = () => { skipRef.current = true; };

  useEffect(() => {
    const now = performance.now();
    // A check belongs to the effect that started it: the cleanup below abandons
    // its in-flight resolution (`alive = false`), but `phaseRef` is a COMPONENT
    // ref and survives. React StrictMode mounts → destroys → remounts this effect
    // in one dev commit, so without this release a check started by the mount-time
    // `evaluate()` of pass #1 would leave the latch closed forever and pass #2
    // could never re-arm — the ceremony spins on stage 1 with no reveal, no error
    // and no CTA. Releasing it lets the surviving effect start its own check.
    if (phaseRef.current === 'verifying') phaseRef.current = 'theater';
    mountRef.current = now;
    stageEnteredAtRef.current = now;
    lastProgressAtRef.current = now;
    ceremonyTiming.markStageEnter(0);
    // NO baseline capture here. At mount the deploy target is typically still
    // unresolved, so `deployId` is null — and a null baseline taken now would let
    // the first real payload's deployId look like a change and get pinned as
    // ours, even when it is a STALE id left on the target by a PREVIOUS deploy.
    // The baseline is established below, from the first payload observed for the
    // resolved target.

    // Alive for the life of THIS effect. The existence check resolves
    // asynchronously and may land after unmount (dismiss, retry remount); every
    // resolution path is gated on it so the machine never setStates a dead tree.
    let alive = true;
    // Timers owned by the in-flight check. The cleanup cancels them, so a
    // dismissed or remounted ceremony leaves no straggler that wakes up 400ms
    // later to run a second Firestore read against a tree that is gone.
    const checkTimers = new Set();
    const checkDelay = (ms) => new Promise((resolve) => {
      const id = setTimeout(() => { checkTimers.delete(id); resolve(); }, ms);
      checkTimers.add(id);
    });

    // ── PR 2 §6: the verification seam ───────────────────────────────────────
    // Every error commit comes through here instead of committing to 'error'.
    // phaseRef is set SYNCHRONOUSLY as well as via setPhase: the latch below
    // reads the ref, and the next interval tick can precede React's commit.
    const beginVerification = (kind) => {
      setErrorKind(kind);
      phaseRef.current = 'verifying';
      setPhase('verifying');
      // Deliberately not awaited — `evaluate` runs on an interval and must
      // return. The latch holds the machine still until this resolves, and the
      // budget race below guarantees that it does.
      runVerification(kind);
    };

    // Bounded attempts. The retry absorbs CLIENT propagation lag only, so it
    // retries an EMPTY answer — never a throw. A throw means the check could not
    // complete, which is a conclusion in itself and is not improved by asking
    // again inside a 2s budget.
    const attemptCheck = async () => {
      // The best answer any attempt has actually COMPLETED with, kept so a later
      // failure cannot discard it.
      let completed = null;
      for (let n = 0; n < VERIFY_ATTEMPTS; n += 1) {
        // Read the checker PER ATTEMPT, not once per check. `targetAgentId` can
        // still be resolving (ranked → clone) and the 400ms gap is exactly the
        // window that resolution lands in; a second attempt against the previous
        // document is the "right answer, wrong document" failure this whole PR
        // exists to prevent.
        const verify = verifyRef.current;
        // No checker wired is a check that could not RUN, not a "no".
        if (typeof verify !== 'function') return completed ?? VERIFY_NO_ANSWER;
        let r;
        try {
          r = await verify();
        } catch (err) {
          // A LATER attempt failing does not erase an EARLIER completed answer.
          // The retry exists only to absorb propagation lag, so a completed
          // "not found" is real evidence; only a FOUND answer could improve on
          // it. Throwing away a definitive result because the redundant second
          // look failed would report "lost contact" for a failure the check had
          // already confirmed.
          if (completed) return completed;
          throw err;
        }
        if (!alive) return VERIFY_NO_ANSWER;
        // A checker that resolves something other than its contract has not
        // answered. Treated as a definitive "no", a broken contract would license
        // "no battle was created" — the exact claim this machine may not make
        // without evidence.
        if (!r || typeof r.found !== 'boolean') return VERIFY_NO_ANSWER;
        if (r.found) {
          // "Found" with nothing to open is not an answer either: it would reveal
          // a battle and then dead-end the CTA on a null id.
          return r.battle?.id ? r : VERIFY_NO_ANSWER;
        }
        completed = { found: false, battle: null };
        if (n + 1 < VERIFY_ATTEMPTS) {
          await checkDelay(VERIFY_RETRY_GAP_MS);
          if (!alive) return VERIFY_NO_ANSWER;
        }
      }
      return completed;
    };

    // Resolve the check into a terminal state. The ONLY path that may assert
    // non-creation is `found === false` AND a server terminal-error signal; every
    // other path — a throw, a timeout, an absent checker, an empty query with no
    // server signal — commits to "lost contact".
    const runVerification = async (kind) => {
      let outcome = VERIFY_NO_ANSWER;
      let budgetTimer = null;
      try {
        const budget = new Promise((resolve) => {
          budgetTimer = setTimeout(() => { checkTimers.delete(budgetTimer); resolve(VERIFY_NO_ANSWER); }, VERIFY_BUDGET_MS);
          checkTimers.add(budgetTimer);
        });
        outcome = await Promise.race([attemptCheck(), budget]);
      } catch (err) {
        console.warn('[Ceremony] battle existence check failed:', err?.message || err);
        outcome = VERIFY_NO_ANSWER;
      } finally {
        if (budgetTimer != null) { clearTimeout(budgetTimer); checkTimers.delete(budgetTimer); }
      }
      const checkFailed = outcome === VERIFY_NO_ANSWER;

      if (!alive) return;

      // ATTRIBUTION. A battle on this target is not necessarily a battle THIS
      // deploy created. The query answers "does an active battle exist for this
      // agent", which is not an answer to "did this deploy create one" — and on a
      // deploy the server REFUSED, the battle it finds belongs to a previous one.
      // Revealing then announces "Deployment complete" for a deploy that never
      // ran and walks the user into an unrelated live battle: the honesty
      // invariant inverted, an unverified POSITIVE claim swapped in for the
      // unverified negative one this PR removes.
      //
      // The first tie is the client's own HTTP status: a status OTHER than 500
      // proves the server refused before it could create anything. That inference
      // and — critically — WHERE IT STOPS are stated once, in the FAILURE MODEL
      // block at the top of `services/agentBattleVerify.js`. The short version of
      // the boundary, because the gate below is exactly where it gets misread:
      // decide.js's single catch also returns 500 for a throw ~780 lines BEFORE
      // the commit, so `failureCouldFollowCommit` means "a battle MAY exist",
      // never "a battle from THIS deploy exists". It admits, it does not attribute.
      //
      // A transport failure (postIssued with no status) is genuinely unknowable
      // and stays eligible: the request may have landed and committed. A deploy
      // that never reached the POST at all is not.
      //
      // The second tie is EXACT where we have it. `deployBattleId` is set on the
      // one failure path that returns the server's own battle id — a 200 whose
      // client handoff threw — and it names the battle THIS deploy created. When
      // present it both admits the 200 (which nothing else may do: decide.js's
      // "already has an active battle" branch returns 200 too, and carries no
      // `agentBattleId`) and pins the reveal to that document. This is the
      // battle-id round-trip PR 4 generalises, available for free in this one case.
      //
      // Deliberately NOT keyed on `ourDeployIdRef`: that pin is inferred by
      // DIFFERENCE from a baseline, and review proved it wrong in both
      // directions — a late first snapshot (or a listen error, which
      // subscribeToAgentDoc reports as a delivered null) leaves a real recovery
      // unpinned and silently unrecoverable, while a foreign deployId from a
      // cache-then-server delivery or another device pins as "ours" and buys a
      // false reveal. The §5.3 unsolicited-progress hole belongs to PR 4; the
      // reveal must not be built on top of it.
      const {
        deployHttpStatus: httpStatus, deployPostIssued: postIssued, deployBattleId: knownBattleId,
      } = inRef.current;
      const failureCouldFollowCommit = postIssued
        && (httpStatus == null || httpStatus === 500 || knownBattleId != null);
      // When the server handed us an id, the found document must BE that document.
      // Without an id this is vacuously true and the status heuristic (plus the
      // league filter in the verifier) is all the narrowing there is.
      const matchesKnownBattle = knownBattleId == null
        || (!checkFailed && outcome.found && outcome.battle?.id === knownBattleId);

      if (!checkFailed && outcome.found && failureCouldFollowCommit && matchesKnownBattle) {
        // A durable battle exists AND this deploy reached the server. The failure
        // was downstream of the commit — decide.js:929 is the canonical case — so
        // the honest terminal state is the reveal, carrying the id the query
        // found.
        setRecoveredBattle(outcome.battle);
        // No setErrorTone here: the latch guarantees this branch is reached at
        // most once per machine instance and always from 'verifying', so the tone
        // is still its initial null. A reset would be unfalsifiable dead code.
        stageEnteredAtRef.current = performance.now();
        ceremonyTiming.markReveal();
        phaseRef.current = 'reveal';
        setStageIndex(4);
        setPhase('reveal');
        return;
      }

      // No battle found (or no answer). Re-read the server signal at RESOLUTION
      // time: the latch has held the machine still, so a terminal error that
      // landed during the check would otherwise be missed.
      const { stage: s2, deployId: id2, targetKnown: known2 } = inRef.current;
      const ourErrorNow = known2 && ourDeployIdRef.current != null
        && id2 === ourDeployIdRef.current && s2 === 'error';
      const serverErrorSignal = serverErrorSeenRef.current || ourErrorNow;
      // Both conditions, or nothing. A check that could not complete never
      // qualifies, however loud the server was.
      const tone = (!checkFailed && serverErrorSignal) ? 'confirmed' : 'lost_contact';

      ceremonyTiming.markError(kind);
      setErrorTone(tone);
      phaseRef.current = 'error';
      setPhase('error');
    };

    const evaluate = () => {
      // The latch. 'verifying' belongs here: without it the machine keeps
      // evaluating error branches while a check is in flight and can commit to
      // 'error' underneath its own verification.
      if (phaseRef.current === 'error' || phaseRef.current === 'reveal' || phaseRef.current === 'verifying') return;
      const t = performance.now();
      const { stage: s, deployId: id, updatedAt: up, errorPhase: ep, deployStatus: ds, targetKnown: known, targetAgentId: target } = inRef.current;

      // ── §5 Baseline + unsolicited-progress guard.
      //
      // RULE: the baseline is the deployId present in the FIRST progress payload
      // this machine instance observes FOR THE CURRENT TARGET ID.
      //
      // Everything here is gated on `known`. A "target unknown" payload carries
      // nulls (never the ranked agent's deployProgress) and must not establish a
      // baseline: doing so is what lets a stale deployId — one left on the deploy
      // target by a PREVIOUS deploy — get pinned as ours, after which `ours` is
      // false for every genuine checkpoint that follows and the ceremony stalls
      // exactly as it did when it watched the wrong document.
      //
      // RESIDUAL RACE (deliberately NOT closed here — PR 4): if this machine's
      // first observation of the target somehow arrives AFTER the server's
      // strategy_running write, the baseline becomes the current deploy's OWN
      // deployId, nothing ever differs, and the machine stalls. Subscribing
      // before the POST keeps the window very small — the server must complete a
      // network round trip plus its pre-checks (decide.js:177, :186) before its
      // first write, while the client's first snapshot typically serves from the
      // local cache. The real fix is pinning by IDENTITY — the client knowing its
      // own deployId instead of inferring it by difference — which needs deployId
      // round-tripped through the POST response, a fenced decide.js change that
      // belongs to PR 4. Do not paper over it here.
      if (known) {
        // Re-arm on a target change: nothing learned from the previous target is
        // valid for this one.
        // stageIndex is deliberately NOT rewound with the rank: the display is
        // monotonic (§5.1), so the theater holds its current stage and waits for
        // the new target's checkpoints rather than visibly regressing. In
        // practice the only target change is ranked → clone, which resolves
        // inside the first stage's 2s floor, so nothing has advanced yet.
        if (baselineSetRef.current && baselineTargetRef.current !== target) {
          baselineSetRef.current = false;
          ourDeployIdRef.current = null;
          maxRankRef.current = 0;
          setServerRank(0);
        }
        if (!baselineSetRef.current) {
          baselineSetRef.current = true;
          baselineTargetRef.current = target;
          baselineDeployIdRef.current = id ?? null;
          lastUpdatedAtRef.current = up ?? null;
        }
        // Pin OUR deployId — the first id that differs from that baseline — then
        // ignore all other deployIds (cron write, cross-device, stale map).
        if (!ourDeployIdRef.current && id != null && id !== baselineDeployIdRef.current) {
          ourDeployIdRef.current = id;
        }
      }
      const ours = known && ourDeployIdRef.current != null && id === ourDeployIdRef.current;

      // ── Absorb the checkpoint (monotonic) only from our deploy.
      if (ours) {
        const rank = SERVER_RANK[s] || 0;
        if (rank > maxRankRef.current) {
          maxRankRef.current = rank;
          lastProgressAtRef.current = t;
          setServerRank(rank);
        }
        if (up && up !== lastUpdatedAtRef.current) {
          lastUpdatedAtRef.current = up;
          lastProgressAtRef.current = t;
        }
        // Server-side failure telemetry for our deploy. NOT evidence of
        // non-creation on its own: errorPhase 'post_decision' only means the
        // decision persisted at decide.js:704, which precedes battle creation at
        // :910 — so this routes to the check, not to a claim.
        if (s === 'error') {
          serverErrorSeenRef.current = true;
          beginVerification(ep === 'post_decision' ? 'server_post' : 'server');
          return;
        }
      }

      // ── Client's own deploy outcome (dual-signal / post-persistence failure).
      // The founding incident: the client sees a 500 and the battle is durable
      // anyway (THE POST-COMMIT WINDOW, in services/agentBattleVerify.js). Verify
      // before claiming.
      if (ds === 'error') {
        beginVerification('deploy');
        return;
      }

      // ── Watchdog + slow state — only while the deploy is genuinely pending
      // (a resolved success is imminent-complete; never false-timeout it).
      if (ds === 'success' && successAtRef.current === 0) successAtRef.current = t;
      if (ds !== 'success') {
        const sinceProgress = t - lastProgressAtRef.current;
        if (sinceProgress >= WATCHDOG_MS) {
          // A watchdog firing means we stopped hearing, not that nothing
          // happened. Check before committing to either claim.
          //
          // OPEN-3, named rather than left implicit: this fires while the POST is
          // still in flight, so a found battle here has NO client outcome to
          // corroborate it. It cannot author a reveal only because the shells set
          // `deployResult` to `{ status: 'pending' }` BEFORE the POST
          // (CommandDashboard.jsx / CommandDashboardDesktop.jsx), which leaves
          // `deployPostIssued` false and fails the attribution gate above. That
          // ordering is load-bearing for this path — do not move the assignment
          // after the await, and do not seed `deployResult` from a previous run.
          beginVerification('timeout');
          return;
        }
        setSlow(sinceProgress >= SLOW_MS);
      } else {
        setSlow(false);
      }

      // ── Advancement: min-floor of the current stage elapsed AND the server has
      // reached the rank the NEXT stage requires (skip zeroes the floors but not
      // the gate). Reveal additionally requires the client success signal.
      const i = stageIndexRef.current;
      if (i >= 4) return;
      // H1 safety net: once success has been in for the grace, treat the server as
      // 'complete' so a lost/ignored checkpoint can't strand a real, successful
      // deploy on the theater forever.
      const successGrace = ds === 'success' && successAtRef.current > 0 && (t - successAtRef.current) >= SUCCESS_GRACE_MS;
      const effRank = successGrace ? Math.max(maxRankRef.current, 4) : maxRankRef.current;
      const floor = skipRef.current ? 0 : MIN_FLOOR_MS[i];
      const floorElapsed = (t - stageEnteredAtRef.current) >= floor;
      const nextRankOk = effRank >= REQUIRED_RANK[i + 1];
      const revealSignal = (i + 1 < 4) || ds === 'success';
      if (floorElapsed && nextRankOk && revealSignal) {
        const next = i + 1;
        stageEnteredAtRef.current = t;
        // Record-only: `floor` is what was APPLIED (skip zeroes it), MIN_FLOOR_MS[i]
        // the nominal — the pair is what separates floor-bound from skipped.
        ceremonyTiming.markStageExit(i, floor, MIN_FLOOR_MS[i]);
        if (next >= 4) {
          ceremonyTiming.markReveal();
          phaseRef.current = 'reveal';
          setStageIndex(4);
          setPhase('reveal');
        } else {
          ceremonyTiming.markStageEnter(next);
          setStageIndex(next);
        }
      }
    };

    const iv = setInterval(evaluate, 100);
    evaluate();
    return () => {
      alive = false;
      clearInterval(iv);
      checkTimers.forEach(clearTimeout);
      checkTimers.clear();
    };
    // Mount-once: the interval reads live inputs via inRef; deliberately not
    // re-subscribing per snapshot tick (spec §5.5).
  }, []);

  // canSkip: after strategy_complete, before the reveal (spec §5.2).
  //
  // 'verifying' belongs here BECAUSE it renders as theater. The contract is that
  // the check is invisible — no new screen, no discontinuity — and a Skip control
  // that vanishes for up to the 2s budget and then is replaced by a terminal
  // surface is a discontinuity, in the one window where the user is most likely to
  // be reaching for it. Dropping 'verifying' from this line is the mutation the
  // continuity guard in ceremonyTerminalState.test.jsx exists to kill: it compares
  // the theater's rendered controls either side of the transition, so a control
  // that disappears reds the row rather than passing on the copy that stayed.
  //
  // Skipping during 'verifying' is inert by construction — `requestSkip` only
  // zeroes the stage floors, and the advancement path it feeds is behind the same
  // latch the check holds. So this restores the affordance without giving it a way
  // to race the terminal commit.
  const canSkip = serverRank >= SERVER_RANK.strategy_complete
    && (phase === 'theater' || phase === 'verifying');

  return {
    phase,
    stageIndex,
    stageKey: STAGE_KEYS[Math.min(stageIndex, 3)],
    serverRank,
    slow,
    // Retained as DIAGNOSTIC context (it still feeds `details`); it is no longer
    // the headline selector — errorTone is.
    errorKind,
    errorTone,
    recoveredBattle,
    canSkip,
    requestSkip,
  };
}
