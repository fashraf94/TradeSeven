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
//     stale map).
//   - Dual-signal reveal (§5.3 / A.2 §8): reveal only when the server stage is
//     'complete' AND our own deployAgent call returned success. Telemetry alone
//     never reveals; a persisted decision whose battle-creation threw (deploy
//     error) routes to the error surface, not a reveal of a battle that does not
//     exist.
//
// Consumes deployProgress sub-fields as PRIMITIVES (spec §5.5) so the ~5 snapshot
// ticks over a deploy don't churn effects.

import { useEffect, useRef, useState } from 'react';

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

export default function useCeremonyStageMachine({
  stage, deployId, updatedAt, errorPhase, deployStatus,
}) {
  // Public outputs
  const [phase, setPhase] = useState('theater'); // 'theater' | 'reveal' | 'error'
  const [stageIndex, setStageIndex] = useState(0);
  const [serverRank, setServerRank] = useState(0);
  const [slow, setSlow] = useState(false);
  const [errorKind, setErrorKind] = useState(null); // 'deploy' | 'server' | 'server_post' | 'timeout'

  // Latest inputs, mirrored into refs so the single interval reads fresh values
  // without re-subscribing on every snapshot tick.
  const inRef = useRef({ stage, deployId, updatedAt, errorPhase, deployStatus });
  inRef.current = { stage, deployId, updatedAt, errorPhase, deployStatus };

  // Internal bookkeeping
  const mountRef = useRef(0);
  const baselineDeployIdRef = useRef(undefined); // deployId present at mount (pre our write)
  const ourDeployIdRef = useRef(null);           // our deploy's pinned deployId
  const maxRankRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const lastUpdatedAtRef = useRef(null);
  const successAtRef = useRef(0); // when the client deploy first returned success
  const stageEnteredAtRef = useRef(0);
  const skipRef = useRef(false);
  const stageIndexRef = useRef(0);
  const phaseRef = useRef('theater');
  stageIndexRef.current = stageIndex;
  phaseRef.current = phase;

  const requestSkip = () => { skipRef.current = true; };

  useEffect(() => {
    const now = performance.now();
    mountRef.current = now;
    stageEnteredAtRef.current = now;
    lastProgressAtRef.current = now;
    baselineDeployIdRef.current = inRef.current.deployId ?? null;
    lastUpdatedAtRef.current = inRef.current.updatedAt ?? null;

    const evaluate = () => {
      if (phaseRef.current === 'error' || phaseRef.current === 'reveal') return;
      const t = performance.now();
      const { stage: s, deployId: id, updatedAt: up, errorPhase: ep, deployStatus: ds } = inRef.current;

      // ── Unsolicited-progress guard: pin OUR deployId (the first id that differs
      // from the pre-initiation baseline), then ignore all other deployIds.
      if (!ourDeployIdRef.current && id != null && id !== baselineDeployIdRef.current) {
        ourDeployIdRef.current = id;
      }
      const ours = ourDeployIdRef.current != null && id === ourDeployIdRef.current;

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
        // Server-side failure telemetry for our deploy.
        if (s === 'error') {
          setErrorKind(ep === 'post_decision' ? 'server_post' : 'server');
          setPhase('error');
          return;
        }
      }

      // ── Client's own deploy outcome (dual-signal / post-persistence failure).
      if (ds === 'error') {
        setErrorKind('deploy');
        setPhase('error');
        return;
      }

      // ── Watchdog + slow state — only while the deploy is genuinely pending
      // (a resolved success is imminent-complete; never false-timeout it).
      if (ds === 'success' && successAtRef.current === 0) successAtRef.current = t;
      if (ds !== 'success') {
        const sinceProgress = t - lastProgressAtRef.current;
        if (sinceProgress >= WATCHDOG_MS) {
          setErrorKind('timeout');
          setPhase('error');
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
        if (next >= 4) {
          setStageIndex(4);
          setPhase('reveal');
        } else {
          setStageIndex(next);
        }
      }
    };

    const iv = setInterval(evaluate, 100);
    evaluate();
    return () => clearInterval(iv);
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
    errorKind,
    canSkip,
    requestSkip,
  };
}
