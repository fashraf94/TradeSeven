// src/components/Forge/DeployToAgent.jsx
//
// Phase 4A — Deploy a proven Proving Ground experiment to the BaggerBomb
// agent. Preview → Confirm → Success state machine in a CenteredModal.
//
// The experiment's bundle is already materialized under agents/{id}/bundles;
// Deploy reuses the existing equipBundle pipeline via deployStrategyService
// so activeRules stays the single source of truth for prompt assembly.
//
// Guardrails are stored on agent.deployedStrategy for Phase 4B enforcement;
// in 4A they display with a "Coming in Phase 4B" badge.

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import CenteredModal from '../shared/CenteredModal';
import { deployExperimentToAgent } from '../../services/deployStrategyService';
import { COLLECTION_DEFS } from '../../utils/dimensionMapper';

// Palette matches ForgeLanding.jsx so the modal feels native.
const TROPHY_GOLD = '#F0C75E';
const TEAL = '#5EEAD4';
const RED = '#EF4444';
const CARD_BG = '#15171E';
const DEEP_BG = '#0D0E12';
const BORDER_SUBTLE = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F5F5F5';
const TEXT_SECONDARY = '#B8BCC8';
const TEXT_MUTED = '#8A8F9C';

function formatPct(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function collectionLabel(id) {
  if (!id) return null;
  const def = COLLECTION_DEFS.find((c) => c.id === id);
  return def?.label || null;
}

export default function DeployToAgent({
  isOpen,
  onClose,
  agent,
  season,
  entry,
  dimensionValues,
  bundleId,
  directives = [],
  guardrails = [],
  dimensionsInferred = false,
  onDeployed,
}) {
  const [mode, setMode] = useState('preview'); // 'preview' | 'deploying' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const prev = agent?.deployedStrategy || null;
  const isReplacing = Boolean(prev && prev.bundleId && prev.bundleId !== bundleId);
  const isSameBundle = Boolean(prev && prev.bundleId === bundleId);

  const alpha = entry?.seasonState?.alphaVsSpy;
  const rank = entry?.seasonState?.finalRank ?? entry?.seasonState?.rank;
  const ruleCount = Array.isArray(entry?.algorithm?.rules)
    ? entry.algorithm.rules.length
    : 0;
  const sourceCollectionName = useMemo(
    () => collectionLabel(dimensionValues?._sourceCollection),
    [dimensionValues]
  );

  const experimentInProgress = !entry?.completedAt;

  async function handleConfirm() {
    setMode('deploying');
    setErrorMsg('');
    try {
      const { deployedStrategy } = await deployExperimentToAgent({
        agent,
        season,
        entry,
        dimensionValues,
        bundleId,
        directives,
        guardrails,
      });
      setMode('success');
      if (onDeployed) onDeployed(deployedStrategy);
      setTimeout(() => {
        onClose?.();
      }, 1500);
    } catch (err) {
      setErrorMsg(err?.message || 'Deploy failed — please try again.');
      setMode('error');
    }
  }

  function handleClose() {
    if (mode === 'deploying') return; // Block close during write
    setMode('preview');
    setErrorMsg('');
    onClose?.();
  }

  return (
    <CenteredModal isOpen={isOpen} onClose={handleClose} title="Deploy to BaggerBomb">
      <div
        style={{
          padding: '4px 20px 20px',
          overflowY: 'auto',
          color: TEXT_PRIMARY,
        }}
      >
        <AnimatePresence mode="wait">
          {mode === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {/* Experiment summary */}
              <div
                style={{
                  background: CARD_BG,
                  border: `1px solid ${BORDER_SUBTLE}`,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: TEXT_MUTED,
                    marginBottom: 8,
                  }}
                >
                  Proven Experiment
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    marginBottom: 8,
                  }}
                >
                  {sourceCollectionName
                    ? `${sourceCollectionName} · ${entry?.algorithm?.description || 'Custom'}`
                    : entry?.algorithm?.description || 'Custom Strategy'}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <StatPill label="Alpha" value={formatPct(alpha)} tone={
                    typeof alpha === 'number' && alpha >= 0 ? 'pos' : 'neg'
                  } />
                  {rank ? <StatPill label="Rank" value={`#${rank}`} /> : null}
                  <StatPill label="Rules" value={String(ruleCount)} />
                </div>
              </div>

              {experimentInProgress && (
                <Callout tone="warn">
                  This experiment hasn't completed yet. Results may still change before
                  the final debrief.
                </Callout>
              )}

              {dimensionsInferred && (
                <Callout tone="info">
                  Strategy knobs were inferred from rule snapshots — deployed directives
                  reflect the experiment's effective configuration.
                </Callout>
              )}

              {isReplacing && (
                <Callout tone="warn">
                  This will replace your currently deployed strategy
                  {prev?.sourceCollection ? ` (${collectionLabel(prev.sourceCollection) || 'Custom'})` : ''}.
                </Callout>
              )}

              {isSameBundle && (
                <Callout tone="info">
                  This exact strategy is already deployed. Confirming will refresh the
                  deployment metadata.
                </Callout>
              )}

              {/* Directives */}
              <Section
                icon={<Rocket size={14} color={TEAL} />}
                title="Directives"
                subtitle="Soft preferences the agent reasons about during battles"
                accent={TEAL}
              >
                {directives.length === 0 ? (
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                    No directives generated — configure at least one strategy dimension.
                  </div>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 180,
                      overflowY: 'auto',
                    }}
                  >
                    {directives.map((d) => (
                      <li
                        key={d.id}
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                          color: TEXT_SECONDARY,
                          paddingLeft: 10,
                          borderLeft: `2px solid ${TEAL}33`,
                        }}
                      >
                        {d.text}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Guardrails */}
              <Section
                icon={<Shield size={14} color={TROPHY_GOLD} />}
                title="Guardrails"
                subtitle="Hard thresholds — enforcement in Phase 4B"
                accent={TROPHY_GOLD}
                badge="Coming in Phase 4B"
              >
                {guardrails.length === 0 ? (
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                    No guardrails configured.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {guardrails.map((g) => (
                      <div
                        key={g.type}
                        style={{
                          padding: '6px 10px',
                          background: DEEP_BG,
                          border: `1px solid ${TROPHY_GOLD}33`,
                          borderRadius: 8,
                          fontSize: 11,
                          color: TEXT_PRIMARY,
                          fontWeight: 600,
                        }}
                      >
                        {labelForGuardrail(g.type)}:{' '}
                        <span style={{ color: TROPHY_GOLD }}>
                          {g.value}
                          {g.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={handleClose}
                  style={btnSecondary}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={directives.length === 0 && guardrails.length === 0}
                  style={{
                    ...btnPrimary,
                    opacity:
                      directives.length === 0 && guardrails.length === 0 ? 0.5 : 1,
                    cursor:
                      directives.length === 0 && guardrails.length === 0
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                  type="button"
                >
                  Deploy to Agent →
                </button>
              </div>
            </motion.div>
          )}

          {mode === 'deploying' && (
            <motion.div
              key="deploying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center',
                padding: '40px 10px',
              }}
            >
              <Loader2
                size={40}
                color={TROPHY_GOLD}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              <div
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Deploying to BaggerBomb…
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: TEXT_MUTED }}>
                Writing strategy to your agent.
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          )}

          {mode === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '40px 10px' }}
            >
              <CheckCircle2 size={48} color={TEAL} />
              <div
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                }}
              >
                Strategy deployed!
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  lineHeight: 1.5,
                }}
              >
                Your agent will use this strategy in the next BaggerBomb battle.
              </div>
            </motion.div>
          )}

          {mode === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 0 0' }}
            >
              <Callout tone="error">
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Deploy failed</div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>{errorMsg}</div>
              </Callout>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={handleClose} style={btnSecondary} type="button">
                  Close
                </button>
                <button
                  onClick={() => {
                    setMode('preview');
                    setErrorMsg('');
                  }}
                  style={btnPrimary}
                  type="button"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CenteredModal>
  );
}

function StatPill({ label, value, tone }) {
  const valueColor =
    tone === 'pos' ? TEAL : tone === 'neg' ? RED : TEXT_PRIMARY;
  return (
    <div
      style={{
        padding: '6px 10px',
        background: DEEP_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: TEXT_MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

function Section({ icon, title, subtitle, accent, badge, children }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: accent,
            }}
          >
            {title}
          </div>
        </div>
        {badge && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '3px 6px',
              borderRadius: 6,
              background: `${accent}22`,
              color: accent,
            }}
          >
            {badge}
          </div>
        )}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </div>
  );
}

function Callout({ tone, children }) {
  const color =
    tone === 'error' ? RED : tone === 'warn' ? TROPHY_GOLD : TEAL;
  return (
    <div
      style={{
        padding: 10,
        marginBottom: 12,
        background: `${color}14`,
        border: `1px solid ${color}44`,
        borderRadius: 10,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <AlertTriangle
        size={14}
        color={color}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ fontSize: 12, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

const GUARDRAIL_LABELS = {
  stopLoss: 'Stop-loss',
  trailingStop: 'Trailing stop',
  maxSectorWeight: 'Max sector',
  maxPosition: 'Max position',
  profitTarget: 'Profit target',
};

function labelForGuardrail(type) {
  return GUARDRAIL_LABELS[type] || type;
}

const btnPrimary = {
  flex: 1,
  padding: '12px 16px',
  background: TROPHY_GOLD,
  color: DEEP_BG,
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `0 0 20px ${TROPHY_GOLD}33`,
};

const btnSecondary = {
  flex: 1,
  padding: '12px 16px',
  background: 'transparent',
  color: TEXT_SECONDARY,
  border: `1px solid ${BORDER_SUBTLE}`,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
