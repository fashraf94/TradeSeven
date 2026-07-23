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

import React, { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { CMD } from '../commandUI';
import useModalFocus from '../../../hooks/useModalFocus';
import useMarketContext from '../../Research/useMarketContext';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import useCeremonyStageMachine from './useCeremonyStageMachine';
import { flattenPicks, getMonologueQuote, useEquippedWatchlistSymbols } from './ceremonyData';
import CeremonyTheater from './CeremonyTheater';
import CeremonyChecklist from './CeremonyChecklist';
import CeremonyReveal from './CeremonyReveal';
import CeremonyError from './CeremonyError';

const Z_INDEX = 1010; // above EquipSheet/ScoutingBoardSheet (1000), below tour/watchlist (10000)
const DEPLOY_LOCK_MS = 120000; // server's per-agent deploy cooldown

export default function DeployCeremony({
  agent, accent = CMD.teal, agentName = 'Your agent', directiveCount = 0,
  deployResult, onEnterBattle, onDismiss, onRetry,
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef(null);
  useModalFocus({ isOpen: true, autoFocusRef: containerRef, containerRef });

  // deployProgress primitives (spec §5.5)
  const dp = agent?.deployProgress || {};
  const machine = useCeremonyStageMachine({
    stage: dp.stage,
    deployId: dp.deployId,
    updatedAt: dp.updatedAt,
    errorPhase: dp.errorPhase,
    deployStatus: deployResult?.status,
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

  // Reveal data — real artifacts of this deploy (§7/§9).
  const lastDecision = agent?.lastDecision || null;
  const picks = useMemo(() => flattenPicks(lastDecision?.portfolio), [lastDecision]);
  const monologue = getMonologueQuote(lastDecision, dp.fallbackKind);
  const fullBrief = lastDecision?.strategyBrief || null;

  // Retry cooldown (spec §8): respect the server's 120s lock.
  const cooldownRemainingMs = useMemo(() => {
    if (!agent?.lastDeployedAt) return 0;
    const since = Date.now() - new Date(agent.lastDeployedAt).getTime();
    return Math.max(0, DEPLOY_LOCK_MS - since);
  }, [agent?.lastDeployedAt]);

  // Polite live-region announcement (§9).
  const liveText = machine.phase === 'error'
    ? 'Deployment failed.'
    : machine.phase === 'reveal'
      ? `${agentName} is ready for battle.`
      : {
          loadout: 'Loading the loadout',
          scanning: 'Scanning the market',
          brief: 'Reading the strategy brief',
          portfolio: 'Constructing the portfolio',
        }[machine.stageKey];

  const showBack = machine.phase !== 'reveal'; // reveal has its own explicit CTAs

  let body;
  if (machine.phase === 'error') {
    body = (
      <CeremonyError
        accent={accent}
        agentName={agentName}
        errorKind={machine.errorKind}
        details={deployResult?.details}
        cooldownRemainingMs={cooldownRemainingMs}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    );
  } else if (machine.phase === 'reveal') {
    body = (
      <CeremonyReveal
        accent={accent}
        agentName={agentName}
        picks={picks}
        monologue={monologue}
        onEnterBattle={onEnterBattle}
        onDismiss={onDismiss}
        reduce={reduce}
      />
    );
  } else if (reduce) {
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
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Deploying your agent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.28 }}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_INDEX, outline: 'none',
        background: 'rgba(8,9,12,0.94)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 0 calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
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
