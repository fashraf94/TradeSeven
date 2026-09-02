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
// committed and AWAITED before `decide.js:929` can throw — so the only thing a
// second attempt absorbs is CLIENT propagation lag, not a still-running server.
// Never extend this to wait one out.
const VERIFY_BUDGET_MS = 2000;
const VERIFY_ATTEMPTS = 2;
const VERIFY_RETRY_GAP_MS = 400;
// Sentinel for the budget arm of the race — distinguishable from any resolution
// the checker itself could produce.
const VERIFY_TIMED_OUT = Symbol('verify-timed-out');

export default function useCeremonyStageMachine({
  stage, deployId, updatedAt, errorPhase, deployStatus,
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
  const inRef = useRef({ stage, deployId, updatedAt, errorPhase, deployStatus, targetKnown, targetAgentId });
  inRef.current = { stage, deployId, updatedAt, errorPhase, deployStatus, targetKnown, targetAgentId };
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
  // NOT evidence of non-creation (decide.js:690 writes stage:'complete' before
  // battle creation at :910, and the catch at :1004 fires for a throw anywhere
  // after it), which is why it is only ever read alongside an empty query.
  const serverErrorSeenRef = useRef(false);
  stageIndexRef.current = stageIndex;

  const requestSkip = () => { skipRef.current = true; };

  useEffect(() => {
    const now = performance.now();
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
    const attemptCheck = async (verify) => {
      for (let n = 0; n < VERIFY_ATTEMPTS; n += 1) {
        const r = await verify();
        if (r && r.found) return r;
        if (n + 1 < VERIFY_ATTEMPTS) {
          await new Promise((resolve) => { setTimeout(resolve, VERIFY_RETRY_GAP_MS); });
        }
      }
      return { found: false, battle: null };
    };

    // Resolve the check into a terminal state. The ONLY path that may assert
    // non-creation is `found === false` AND a server terminal-error signal; every
    // other path — a throw, a timeout, an absent checker, an empty query with no
    // server signal — commits to "lost contact".
    const runVerification = async (kind) => {
      const verify = verifyRef.current;
      let outcome = null;
      let checkFailed = false;

      if (typeof verify !== 'function') {
        // No checker wired is a check that could not run, not a "no".
        checkFailed = true;
      } else {
        let budgetTimer = null;
        try {
          const budget = new Promise((resolve) => {
            budgetTimer = setTimeout(() => resolve(VERIFY_TIMED_OUT), VERIFY_BUDGET_MS);
          });
          const raced = await Promise.race([attemptCheck(verify), budget]);
          if (raced === VERIFY_TIMED_OUT) checkFailed = true;
          else outcome = raced;
        } catch (err) {
          console.warn('[Ceremony] battle existence check failed:', err?.message || err);
          checkFailed = true;
        } finally {
          if (budgetTimer != null) clearTimeout(budgetTimer);
        }
      }

      if (!alive) return;

      if (!checkFailed && outcome && outcome.found) {
        // A durable battle exists. The failure was downstream of the commit —
        // decide.js:929 is the canonical case — so the honest terminal state is
        // the reveal, carrying the id the query found.
        setRecoveredBattle(outcome.battle || null);
        setErrorTone(null);
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
      // The founding incident: decide.js:929 rejects, the client sees a 500, and
      // the battle committed at :910 is durable. Verify before claiming.
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
    return () => { alive = false; clearInterval(iv); };
    // Mount-once: the interval reads live inputs via inRef; deliberately not
    // re-subscribing per snapshot tick (spec §5.5).
  }, []);

  // canSkip: after strategy_complete, before the reveal (spec §5.2).
  const canSkip = serverRank >= SERVER_RANK.strategy_complete && phase === 'theater';

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
