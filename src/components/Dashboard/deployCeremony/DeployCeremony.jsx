// src/components/Dashboard/deployCeremony/DeployCeremony.jsx
//
// Deploy Ceremony — the full-screen overlay orchestrator (spec §5–§9). A NEW
// full-bleed surface (no EquipSheet bending — founder ruling), portaled to
// <body> at z:1010 so it sits above an open ScoutingBoardSheet (z:1000, left
// untouched — ruling #2). Owns the stage machine, the reduced-motion switch, the
// focus trap + live region (§9), and routes to theater / reveal / error.
//
// Re-render hygiene (§5.5): deployProgress sub-fields are read as PRIMITIVES and
// handed to the machine, so the ~5 snapshot ticks over a deploy never key effects
// on the whole agent object.

import React, { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { CMD } from '../commandUI';
import useModalFocus from '../../../hooks/useModalFocus';
import useMarketContext from '../../Research/useMarketContext';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import useDeployTargetProgress from '../../../hooks/useDeployTargetProgress';
import { findActiveBattleForAgent } from '../../../services/agentBattleVerify';
import useCeremonyStageMachine from './useCeremonyStageMachine';
import { flattenPicks, getMonologueQuote, useEquippedWatchlistSymbols } from './ceremonyData';
import CeremonyTheater from './CeremonyTheater';
import CeremonyChecklist from './CeremonyChecklist';
import CeremonyReveal from './CeremonyReveal';
import CeremonyError from './CeremonyError';
import CeremonyExisting from './CeremonyExisting';
// Pilot P1c (founder ruling E1): the "running without your idea" notice and its link.
import { HYPOTHESIS_NOTICES } from '../../../constants/hypothesisRecords';
import { LIFECYCLE_LINES } from '../../Forge/Watchlist/ideaCopy';
import { requestOpenIdea } from '../../Forge/Watchlist/ideaNavigation';
import { DEPLOY_IN_PROGRESS_LINE, DEPLOY_REFUSAL_REASON_IN_PROGRESS } from '../../../constants/deployOutcomes';

const Z_INDEX = 1010; // above EquipSheet/ScoutingBoardSheet (1000), below tour/watchlist (10000)
const DEPLOY_LOCK_MS = 120000; // server's per-agent deploy cooldown

// Command Center repair R1 (ruling R-R1-6) — additive props, all optional:
//   - `deployResult.status === 'existing'` with `existingBattleId`: the server's
//     "already has a running battle" answer. The stage machine commits to its
//     own `existing` terminal (CeremonyExisting), never the reveal or the error.
//   - `liveBattles` / `onOpenBattle`: the shell's own live list and the open
//     handler that terminal's one action uses (the shells wire it to
//     handleOpenAgentBattle). Never onEnterBattle, never onCreateAgentBattle.
//   - `attemptId` / `onPhaseChange({ attemptId, phase, errorTone })`: fired on
//     mount and at every stage-machine transition, echoing the id held at that
//     moment, so the hub's bridge (S2b) can carry attempt identity. A stale
//     notification is the consumer's to ignore; the ceremony only echoes.
export default function DeployCeremony({
  agent, accent = CMD.teal, agentName = 'Your agent', directiveCount = 0,
  deployResult, targetAgentId = null, onEnterBattle, onDismiss, onRetry,
  liveBattles = null, onOpenBattle, attemptId = null, onPhaseChange,
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef(null);
  useModalFocus({ isOpen: true, autoFocusRef: containerRef, containerRef });

  // ── Identity vs deploy state ──────────────────────────────────────────────
  // `agent` is the RANKED agent (subscribeToUserAgent excludes clones) and is the
  // source of IDENTITY only — name, archetype, equipped loadout, maturity copy.
  //
  // DEPLOY STATE comes from the deploy TARGET, which on the casual-clone path is
  // a different document: the server writes deployProgress / lastDeployedAt /
  // lastDecision to agents/{deployAgentId} (decide.js:150). Reading deploy state
  // off the ranked doc meant watching a document that never receives progress,
  // which stalled every clone-path ceremony at stage 1. `targetAgentId` is
  // reported up from deployAgent as soon as it resolves — never reconstructed
  // client-side, because the ensure-casual-clone fallback deploys the RANKED
  // agent and a derived id would be wrong in exactly that branch.
  //
  // We subscribe UNIFORMLY: when the fallback fires and the target IS the ranked
  // agent, this still subscribes to the target rather than branching to read the
  // `agent` prop. Two listeners on one document share Firestore's local cache, so
  // the cost is negligible — and branching on WHICH document to read is the shape
  // of the bug being fixed.
  const {
    deployProgress, lastDeployedAt: targetLastDeployedAt, lastDecision: targetLastDecision, targetKnown,
  } = useDeployTargetProgress(targetAgentId);

  // ── The existence check (PR 2 §3) ─────────────────────────────────────────
  // Keyed on `targetAgentId`, NEVER `agent.id`. The battle's `agentId` is the
  // deploy target (agentBattleService.js:130 writes `agentData.id`), which on the
  // casual-clone path is the clone. Keyed on the ranked id this returns empty
  // every time and would report "no battle" with total confidence — the PR 1 bug
  // one layer up, in exactly the case this check exists to prevent.
  //
  // A null target throws inside the service, which resolves to "lost contact" —
  // the honest answer for a check that could not be expressed.
  const verifyBattle = useCallback(
    () => findActiveBattleForAgent(targetAgentId),
    [targetAgentId],
  );

  // R1 (R-R1-6): the phase notification. The machine reports every transition
  // as it happens; this echoes the attempt id held at that moment.
  const phaseNoteRef = useRef({ attemptId, onPhaseChange });
  phaseNoteRef.current = { attemptId, onPhaseChange };
  const notePhase = ({ phase, errorTone }) => {
    const { attemptId: id, onPhaseChange: note } = phaseNoteRef.current;
    if (typeof note === 'function') note({ attemptId: id, phase, errorTone });
  };

  // deployProgress primitives (spec §5.5)
  const dp = deployProgress || {};
  const machine = useCeremonyStageMachine({
    stage: dp.stage,
    deployId: dp.deployId,
    updatedAt: dp.updatedAt,
    errorPhase: dp.errorPhase,
    deployStatus: deployResult?.status,
    // What the client's own POST learned. The recovered reveal turns on it —
    // see the attribution block in the machine.
    deployHttpStatus: deployResult?.httpStatus ?? null,
    deployPostIssued: deployResult?.postIssued === true,
    // Present only when the server 200'd with a real battle id and the client
    // handoff then threw (agentDeploy.js). It names the battle THIS deploy made,
    // so the machine pins the reveal to it instead of inferring from the status.
    deployBattleId: deployResult?.battleId ?? null,
    // Baseline scoping (§5): until a snapshot for the target has been observed,
    // these primitives are all null and MUST NOT establish a baseline.
    targetKnown,
    targetAgentId,
    verifyBattle,
    onPhaseChange: notePhase,
  });

  // Stage 1 chip data — all best-effort (§5.4).
  const archetype = getArchetypeDisplayName(agent?.archetype);
  const watchlistName = agent?.equippedWatchlistName || null;
  const { symbols: watchlistSymbols } = useEquippedWatchlistSymbols(agent?.equippedWatchlistId || null);
  // Regime tag = marketContext.regime (discovery Q7 correction; ruling #4 — two
  // getDoc reads, no listener). 'SPY' is a stable market proxy; the regime lives
  // on the global marketContext doc regardless of the per-index doc.
  const { marketContext } = useMarketContext('SPY');
  const regime = marketContext?.regime || null;

  // Reveal data — real artifacts of this deploy (§7/§9). lastDecision is deploy
  // state, not identity: decide.js writes it to the deploy TARGET in the same
  // awaited update as lastDeployedAt and deployProgress.stage:'complete'
  // (decide.js:664-694), so on the clone path it never lands on the ranked doc.
  // Sourcing it from `agent` would leave the reveal empty on exactly the path
  // this fix exists for. Falls back to the ranked agent while the target is
  // unresolved, for the same fail-open reason as the cooldown below.
  const lastDecision = (targetKnown ? targetLastDecision : agent?.lastDecision) || null;
  const picks = useMemo(() => flattenPicks(lastDecision?.portfolio), [lastDecision]);
  const monologue = getMonologueQuote(lastDecision, dp.fallbackKind);
  const fullBrief = lastDecision?.strategyBrief || null;

  // Retry cooldown (spec §8): respect the server's 120s lock. Pass the ABSOLUTE
  // unlock instant; the error surface ticks its own countdown off it (a memo'd
  // remaining would freeze — the machine stops setState-ing once in 'error').
  //
  // Sourced from the deploy TARGET: lastDeployedAt is written to agents/{target}
  // (decide.js:675), and the server enforces the cooldown by reading it back off
  // that same document (decide.js:184-188) — so client and server now gate on one
  // field of one document, per the display-agreement rule.
  //
  // While the target is unresolved, fall back to the ranked agent's value rather
  // than disabling retry. The client cooldown is a UX affordance, not a safety
  // gate — the server enforces it with a 429 regardless. Failing OPEN degrades to
  // today's behavior and risks nothing; failing closed could strand the retry
  // button permanently if resolution never completes.
  const cooldownSource = (targetKnown ? targetLastDeployedAt : agent?.lastDeployedAt) || null;
  const cooldownUntil = useMemo(() => (
    cooldownSource ? new Date(cooldownSource).getTime() + DEPLOY_LOCK_MS : 0
  ), [cooldownSource]);

  // Polite live-region announcement (§9). 'verifying' is deliberately absent:
  // it renders as theater, so it keeps announcing the stage on screen rather
  // than telling the user about a check they were never shown.
  // Command Center slice S2b (ruling R-S2b-9b): decide's 429 "Deploy already in
  // progress" is a refusal of this request, said as one (CeremonyError.jsx).
  const inProgress = deployResult?.status === 'error' && deployResult?.reason === DEPLOY_REFUSAL_REASON_IN_PROGRESS;
  const liveText = machine.phase === 'error'
    ? (inProgress ? `${DEPLOY_IN_PROGRESS_LINE}.` : machine.errorTone === 'confirmed' ? 'Deployment failed.' : 'Couldn’t confirm the deployment.')
    : machine.phase === 'reveal'
      ? `${agentName} is ready for battle.`
      : machine.phase === 'existing'
        ? `${agentName} already has a game running.`
      : {
          loadout: 'Loading the loadout',
          scanning: 'Scanning the market',
          brief: 'Reading the strategy brief',
          portfolio: 'Constructing the portfolio',
        }[machine.stageKey];

  const showBack = machine.phase !== 'reveal'; // reveal has its own explicit CTAs

  // PR 2 §5 — the trap. On the recovered path `agent.activeBattleId` is guaranteed
  // ABSENT (the FAILURE MODEL block in services/agentBattleVerify.js says why: the
  // write that sets it is the statement that threw), so the reveal MUST carry the
  // id the verification query found and must never fall back to it. On the
  // ordinary reveal path this is null and the app falls through to the battle it
  // already built at deploy time.
  const enterBattle = () => onEnterBattle?.(machine.recoveredBattle || null);

  // Pilot P1c (founder ruling E1): the deploy's own success response said the
  // battle carries nothing because the equipped idea is due for review (a
  // `success` deployResult, or — review L4-7 — an `error` one pinned to the
  // battle the server created when the client handoff threw; deployResult.js).
  // Shown only on a reveal. The line links to the equipped list's Idea panel;
  // the ceremony closes as it opens.
  const ideaListId = typeof agent?.equippedWatchlistId === 'string' && agent.equippedWatchlistId ? agent.equippedWatchlistId : null;
  const noticeCarrier = deployResult?.status === 'success' || (deployResult?.status === 'error' && Boolean(deployResult?.battleId));
  const ideaNotice = noticeCarrier && deployResult?.hypothesisNotice === HYPOTHESIS_NOTICES.reviewDue
    ? {
        line: LIFECYCLE_LINES.deployRanWithout,
        onOpen: ideaListId ? () => { onDismiss?.(); requestOpenIdea(ideaListId); } : null,
      }
    : null;

  let body;
  if (machine.phase === 'error') {
    body = (
      <CeremonyError
        accent={accent}
        agentName={agentName}
        // The VERIFICATION outcome selects the headline; errorKind is retained
        // as diagnostic context and still feeds `details`.
        errorTone={machine.errorTone}
        errorKind={machine.errorKind}
        details={deployResult?.details}
        cooldownUntil={cooldownUntil}
        onRetry={onRetry}
        onDismiss={onDismiss}
        inProgress={inProgress}
      />
    );
  } else if (machine.phase === 'reveal') {
    body = (
      <CeremonyReveal
        accent={accent}
        agentName={agentName}
        picks={picks}
        monologue={monologue}
        onEnterBattle={enterBattle}
        onDismiss={onDismiss}
        reduce={reduce}
        ideaNotice={ideaNotice}
      />
    );
  } else if (machine.phase === 'existing') {
    // R1: the agent's running battle, not a new one. Its action opens the owned
    // server document the server named; nothing here enters or creates.
    body = (
      <CeremonyExisting
        accent={accent}
        agentName={agentName}
        existingBattleId={deployResult?.existingBattleId ?? null}
        liveBattles={liveBattles}
        verifyBattle={verifyBattle}
        onOpenBattle={onOpenBattle}
        onDismiss={onDismiss}
      />
    );
  } else if (reduce) {
    // 'verifying' reaches here (and the theater below) on purpose — no new
    // screen. The ceremony visibly continues while the check runs.
    body = (
      <CeremonyChecklist
        accent={accent}
        agentName={agentName}
        stageIndex={machine.stageIndex}
        serverRank={machine.serverRank}
        archetype={archetype}
        watchlistName={watchlistName}
        watchlistSymbols={watchlistSymbols}
        directiveCount={directiveCount}
        regime={regime}
        scanCount={dp.scanCount}
        briefExcerpt={dp.briefExcerpt}
        shortlistCount={dp.shortlistCount}
        fallbackKind={dp.fallbackKind}
        fullBrief={fullBrief}
        picks={picks}
      />
    );
  } else {
    body = (
      <CeremonyTheater
        accent={accent}
        agentName={agentName}
        stageKey={machine.stageKey}
        stageIndex={machine.stageIndex}
        slow={machine.slow}
        canSkip={machine.canSkip}
        onSkip={machine.requestSkip}
        archetype={archetype}
        watchlistName={watchlistName}
        watchlistSymbols={watchlistSymbols}
        directiveCount={directiveCount}
        regime={regime}
        scanCount={dp.scanCount}
        briefExcerpt={dp.briefExcerpt}
        shortlistCount={dp.shortlistCount}
        fallbackKind={dp.fallbackKind}
        fullBrief={fullBrief}
        picks={picks}
      />
    );
  }

  return createPortal(
    <motion.div
      ref={containerRef}
      className="deploy-ceremony-overlay"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Deploying your agent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.28 }}
      style={{
        // Explicit offsets (not `inset`) + box-sizing so the full-viewport scrim
        // and its padded, width:100% children never overflow — the app has no
        // global border-box reset, which otherwise shifts the centered content
        // right on mobile.
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_INDEX, outline: 'none',
        boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto',
        background: 'rgba(8,9,12,0.94)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 0 calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
      {/* Scope a border-box reset to the whole overlay subtree (no global reset
          exists — see EquipSheet's per-element boxSizing). */}
      <style>{`.deploy-ceremony-overlay, .deploy-ceremony-overlay * { box-sizing: border-box; }`}</style>

      {/* Polite live region — announces stage transitions (§9). */}
      <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {liveText}
      </div>

      {showBack && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Back to hub"
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', right: 18,
            width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: CMD.surface, border: `1px solid ${CMD.hair}`, cursor: 'pointer',
          }}
        >
          <X size={17} color={CMD.ink2} />
        </button>
      )}

      {body}
    </motion.div>,
    document.body
  );
}
