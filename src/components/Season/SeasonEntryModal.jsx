// src/components/Season/SeasonEntryModal.jsx
//
// 3-step flow for launching a Proving Ground experiment:
//   0. Overview          — season info, dates, universe, macro events
//   1. Strategy          — Trading Style Collection picker + 7 Strategy
//                          Dimension panels (replaces legacy bundle picker)
//   2. Confirm & Deploy   — dimension summary + POST /api/season/create-entry
//
// Mirrors the multi-step pattern from
// src/components/Agent/AgentCreationFlow.jsx (slideVariants, direction,
// AnimatePresence mode="wait"). Uses CenteredModal as the shell.
//
// Step 1 is the Phase 3 transformation: the raw bundle selector has been
// replaced with Strategy Dimensions. On Deploy we translate dimension
// values into a Firestore bundle + rule docs via
// `materializeDimensionBundle` — the resulting bundleId is passed to the
// existing (protected) create-entry API.
//
// Props:
//   isOpen, onClose, season, user, agent, onBuildInForge, onSuccess

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CenteredModal from '../shared/CenteredModal';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { SEASON_CONFLICT_PAIRS, FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';
import { HOLO_COLORS } from '../../constants/holoTheme';
import StrategyDimensions from '../Forge/StrategyDimensions';
import CompileTransparencyPanel from './CompileTransparencyPanel';
import {
  cloneDefaults,
  applyCollectionPreset,
  dimensionsToRuleSnapshots,
  countPhasesForDimensions,
  materializeDimensionBundle,
  persistDimensionValuesOnBundle,
  persistCompileTransparencyOnBundle,
  COLLECTION_DEFS,
} from '../../utils/dimensionMapper';
import { writeDimensionField } from '../../utils/dimensionFieldAccess';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const AMBER_WARN = '#F59E0B';

// ── Animation ──────────────────────────────────────────────

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
};
const slideTransition = { type: 'spring', stiffness: 300, damping: 28 };

// ── Helpers ────────────────────────────────────────────────

function findConflicts(seasonRuleIds) {
  if (!Array.isArray(seasonRuleIds) || seasonRuleIds.length < 2) return [];
  const set = new Set(seasonRuleIds);
  const matches = [];
  for (const pair of SEASON_CONFLICT_PAIRS) {
    if (set.has(pair.ruleA) && set.has(pair.ruleB)) matches.push(pair);
  }
  return matches;
}

function getRuleHeadline(ruleId) {
  if (!ruleId) return '';
  const lower = String(ruleId).toLowerCase();
  const tpl = FORGE_RULE_TEMPLATES.find(
    (t) => String(t.id).toLowerCase() === lower
  );
  return tpl?.headline || String(ruleId).toUpperCase();
}

function formatDateRange(startDate, endDate) {
  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(s)} — ${fmt(e)}`;
  } catch {
    return '—';
  }
}

// ── Small sub-components ───────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        padding: '4px 0 12px',
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? TROPHY_GOLD : HOLO_COLORS.borderSubtle,
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

function InfoRow({ icon, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        color: HOLO_COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: HOLO_COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ── Step views ─────────────────────────────────────────────

function StepOverview({ season }) {
  const universe = Array.isArray(season.universe) ? season.universe : [];
  const universePreview = universe.slice(0, 5).join(', ');
  const universeMore = universe.length > 5 ? ` and ${universe.length - 5} more` : '';
  const macro = Array.isArray(season.macroEvents) ? season.macroEvents : [];
  const tradingDays = season.tradingDays || season.tradingDayCount;

  return (
    <div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          margin: '0 0 4px',
          textAlign: 'center',
        }}
      >
        {season.name || 'Experiment'}
      </h2>
      <div
        style={{
          height: 3,
          width: 48,
          background: TROPHY_GOLD,
          margin: '0 auto 16px',
          borderRadius: 2,
        }}
      />

      <InfoRow icon="📅">
        {formatDateRange(season.startDate, season.endDate)}
        {tradingDays ? ` (${tradingDays} trading days)` : ''}
      </InfoRow>
      <InfoRow icon="📊">
        Universe: {universe.length || '—'} stocks
        {universePreview ? ` — ${universePreview}${universeMore}` : ''}
      </InfoRow>
      <InfoRow icon="🏦">Starting Capital: $100,000</InfoRow>
      <InfoRow icon="📈">Benchmark: S&amp;P 500</InfoRow>

      <SectionLabel>Weekly Rhythm</SectionLabel>
      <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary, lineHeight: 1.6 }}>
        <div>Mon–Fri: Algorithm runs autonomously</div>
        <div>Sat–Sun: Weekly Review (review &amp; tune)</div>
      </div>

      {macro.length > 0 && (
        <>
          <SectionLabel>Macro Events This Experiment</SectionLabel>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary, lineHeight: 1.6 }}>
            {macro.map((ev, i) => (
              <div key={i}>
                • {ev.name || ev.title || 'Event'}
                {ev.date ? ` — ${ev.date}` : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Phase 4 — solo-session duration picker. Chips in a compact row at the
// top of StepStrategy. `fromWorkshop` displays a subtle "From Workshop"
// badge when the value came from Gemma's recommendation; user overriding
// the chip clears the badge via state in the parent.
const DURATION_OPTIONS = [5, 10, 15, 20];

function DurationPicker({ value, onChange, fromWorkshop, disabled }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 12,
        background: 'rgba(240,199,94,0.04)',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: HOLO_COLORS.textPrimary }}>
          Test duration
        </div>
        {fromWorkshop && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#F0C75E',
              background: 'rgba(240,199,94,0.12)',
              border: '1px solid rgba(240,199,94,0.4)',
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            From Workshop
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DURATION_OPTIONS.map((days) => {
          const weeks = days / 5;
          const selected = value === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => !disabled && onChange(days)}
              disabled={disabled}
              style={{
                flex: '1 1 auto',
                minWidth: 68,
                fontSize: 12,
                fontWeight: 600,
                color: selected ? '#F0C75E' : HOLO_COLORS.textSecondary,
                background: selected ? 'rgba(240,199,94,0.14)' : '#15171E',
                border: `1px solid ${selected ? '#F0C75E' : '#2A2D35'}`,
                borderRadius: 6,
                padding: '8px 10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ lineHeight: 1.2 }}>{weeks} {weeks === 1 ? 'week' : 'weeks'}</div>
              <div style={{ fontSize: 10, color: HOLO_COLORS.textMuted, marginTop: 2 }}>{days} days</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepStrategy({
  dimensionValues,
  selectedCollection,
  isDirty,
  onSelectCollection,
  onParamChange,
  disabled,
  fromConversation,
  compileConfidence = null,
  compileWarnings = [],
  compileMappingNotes = [],
  compileAppliedClamps = [],
  selectedDurationDays,
  onChangeDuration,
  durationFromWorkshop,
  showAdvanced,
  onToggleAdvanced,
}) {
  return (
    <div>
      <DurationPicker
        value={selectedDurationDays}
        onChange={onChangeDuration}
        fromWorkshop={durationFromWorkshop}
        disabled={disabled}
      />

      {fromConversation && selectedCollection === 'from-conversation' ? (
        <CompileTransparencyPanel
          confidence={compileConfidence}
          warnings={compileWarnings}
          mappingNotes={compileMappingNotes}
          appliedClamps={compileAppliedClamps}
        />
      ) : (
        <div
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textSecondary,
            lineHeight: 1.45,
            marginBottom: 12,
          }}
        >
          Pick a Trading Style to set the shape, then tap any dimension to
          tune it.
        </div>
      )}

      <StrategyDimensions
        values={dimensionValues}
        onChange={onParamChange}
        disabled={disabled}
        selectedCollection={selectedCollection}
        onSelectCollection={onSelectCollection}
        isDirty={isDirty}
        showAdvanced={showAdvanced}
        onToggleAdvanced={onToggleAdvanced}
      />
    </div>
  );
}

function StepConfirm({
  season,
  dimensionValues,
  selectedCollection,
  submitting,
  error,
}) {
  const snapshots = useMemo(
    () => dimensionsToRuleSnapshots(dimensionValues),
    [dimensionValues]
  );
  const phaseCounts = useMemo(
    () => countPhasesForDimensions(dimensionValues),
    [dimensionValues]
  );
  const conflicts = useMemo(
    () => findConflicts(snapshots.map((s) => s.sourceRef)),
    [snapshots]
  );
  const styleLabel =
    COLLECTION_DEFS.find((c) => c.id === selectedCollection)?.label ||
    'Custom';

  return (
    <div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: HOLO_COLORS.textPrimary,
          margin: '0 0 12px',
          textAlign: 'center',
        }}
      >
        Confirm Your Entry
      </h3>

      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 12,
        }}
      >
        <SummaryLine label="Experiment" value={season.name || '—'} />
        <SummaryLine label="Starting Style" value={styleLabel} />
        <SummaryLine label="Rules Deployed" value={`${snapshots.length}`} />
        <SummaryLine label="Starting Capital" value="$100,000" />
      </div>

      <SectionLabel>Algorithm Preview</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: '10px 12px',
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: 8,
        }}
      >
        {[
          ['Entry', phaseCounts.entry],
          ['Exit', phaseCounts.exit],
          ['Rebalance', phaseCounts.rebalance],
          ['Strategy', phaseCounts.strategy],
        ].map(([label, count]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: count > 0 ? TROPHY_GOLD : HOLO_COLORS.textMuted,
              }}
            >
              {count}
            </div>
            <div
              style={{
                fontSize: 10,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {conflicts.length > 0 && (
        <>
          <SectionLabel>Conflict Warnings</SectionLabel>
          {conflicts.map((c, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${AMBER_WARN}`,
                borderRadius: 8,
                marginBottom: 6,
                fontSize: 12,
                color: HOLO_COLORS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: AMBER_WARN, marginBottom: 2 }}>
                ⚠️ {getRuleHeadline(c.ruleA)} &amp; {getRuleHeadline(c.ruleB)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: HOLO_COLORS.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 4,
                }}
              >
                {c.ruleA.toUpperCase()} · {c.ruleB.toUpperCase()}
              </div>
              <div>{c.warning}</div>
            </div>
          ))}
        </>
      )}

      <p
        style={{
          fontSize: 12,
          color: HOLO_COLORS.textMuted,
          lineHeight: 1.5,
          margin: '12px 0',
        }}
      >
        Portfolio construction happens automatically at market close on Day
        1. Your Strategy Dimensions compile into season rules and scan the
        universe to build your portfolio.
      </p>

      {error && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid #EF4444',
            borderRadius: 8,
            fontSize: 12,
            color: '#EF4444',
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}

      {submitting && (
        <div
          style={{
            textAlign: 'center',
            padding: 12,
            color: HOLO_COLORS.textMuted,
            fontSize: 12,
          }}
        >
          Deploying algorithm...
        </div>
      )}
    </div>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        fontSize: 13,
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      <span style={{ color: HOLO_COLORS.textMuted }}>{label}</span>
      <span
        style={{
          color: HOLO_COLORS.textPrimary,
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────

export default function SeasonEntryModal({
  isOpen,
  onClose,
  season,
  user, // eslint-disable-line no-unused-vars
  agent,
  onBuildInForge, // eslint-disable-line no-unused-vars -- kept for API compatibility
  onSuccess,
  // Phase 5 — Workshop Mode pre-fill. When these are provided, the modal
  // opens directly on Step 1 (Strategy) with dimensionValues pre-populated
  // from the Haiku compile endpoint, and the CollectionPicker is flagged
  // as "From Conversation".
  initialDimensionValues,
  initialStep,
  fromConversation = false,
  // Phase 6 — optional origin metadata forwarded to create-entry for
  // the strategy_configs shadow log. When sourceExperimentId is set,
  // this launch is recorded as the "B" side of a refinement pair.
  sourceExperimentId = null,
  entrySource = null,
  // Compile transparency — populated by the Workshop compile flow.
  // Defaults make the manual-configure path render identically to today.
  compileConfidence = null,
  compileWarnings = [],
  compileMappingNotes = [],
  compileAppliedClamps = [],
  // Phase 4 — Gemma's recommended backtest duration (null when the launch
  // didn't come from Workshop, or when Haiku didn't emit a recommendation).
  // Pre-selects the duration picker; manual override clears the
  // "From Workshop" badge.
  recommendedDurationDays = null,
}) {
  const startStep = typeof initialStep === 'number' ? initialStep : 0;
  const startDims = initialDimensionValues
    ? { ...cloneDefaults(), ...initialDimensionValues }
    : cloneDefaults();
  const startCollection = fromConversation ? 'from-conversation' : null;

  const VALID_DURATIONS = [5, 10, 15, 20];
  const DEFAULT_DURATION = 20;
  const initialDuration = VALID_DURATIONS.includes(recommendedDurationDays)
    ? recommendedDurationDays
    : DEFAULT_DURATION;

  const [step, setStep] = useState(startStep);
  const [direction, setDirection] = useState(1);
  const [dimensionValues, setDimensionValues] = useState(() => startDims);
  const [selectedCollection, setSelectedCollection] = useState(startCollection);
  // When prefilled from conversation the values are "dirty" relative to any
  // preset — surface that in the picker.
  const [isDirty, setIsDirty] = useState(Boolean(initialDimensionValues));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Phase 4 — duration picker + advanced toggle. `durationFromWorkshop`
  // tracks whether the current picker value equals the recommendation;
  // user override flips it off, which removes the "From Workshop" badge.
  const [selectedDurationDays, setSelectedDurationDays] = useState(initialDuration);
  const [durationFromWorkshop, setDurationFromWorkshop] = useState(
    VALID_DURATIONS.includes(recommendedDurationDays)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when the modal is opened/closed so a second open is clean
  useEffect(() => {
    if (!isOpen) return;
    setStep(typeof initialStep === 'number' ? initialStep : 0);
    setDirection(1);
    setDimensionValues(
      initialDimensionValues
        ? { ...cloneDefaults(), ...initialDimensionValues }
        : cloneDefaults()
    );
    setSelectedCollection(fromConversation ? 'from-conversation' : null);
    setIsDirty(Boolean(initialDimensionValues));
    setSubmitting(false);
    setError(null);
    const resetDuration = VALID_DURATIONS.includes(recommendedDurationDays)
      ? recommendedDurationDays
      : DEFAULT_DURATION;
    setSelectedDurationDays(resetDuration);
    setDurationFromWorkshop(VALID_DURATIONS.includes(recommendedDurationDays));
    setShowAdvanced(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDurationChange = useCallback((days) => {
    setSelectedDurationDays(days);
    // Any user-selected value that disagrees with the recommendation flips
    // off the "From Workshop" badge. Selecting the same value as the
    // recommendation preserves the badge.
    setDurationFromWorkshop(days === recommendedDurationDays);
  }, [recommendedDurationDays]);

  const handleSelectCollection = useCallback((collectionId) => {
    setSelectedCollection(collectionId);
    setDimensionValues(applyCollectionPreset(collectionId));
    setIsDirty(false);
  }, []);

  const handleParamChange = useCallback((_dimensionKey, paramKey, newValue) => {
    // Phase 4.5: writes land at the canonical location via the registry.
    // `_dimensionKey` is ignored — the registry resolves the correct
    // destination for the given `paramKey`. Kept in the signature for
    // backward compatibility with existing call sites.
    setDimensionValues((prev) => writeDimensionField(prev, paramKey, newValue));
    setIsDirty(true);
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => s - 1);
  }, []);

  const enabledRuleCount = useMemo(
    () => dimensionsToRuleSnapshots(dimensionValues).length,
    [dimensionValues]
  );

  const handleDeploy = useCallback(async () => {
    if (!season?.id || !agent?.id) return;
    if (enabledRuleCount === 0) {
      setError('Configure at least one strategy dimension before deploying.');
      return;
    }
    setSubmitting(true);
    setError(null);

    // Step 1: Materialize ephemeral bundle + rule docs in Firestore so the
    // existing create-entry endpoint can consume them via bundleId.
    // Deterministic id → idempotent on retry.
    const bundleName = selectedCollection
      ? `Strategy Dimensions — ${
          COLLECTION_DEFS.find((c) => c.id === selectedCollection)?.label ||
          'Custom'
        }`
      : 'Strategy Dimensions';

    let bundleId;
    try {
      bundleId = await materializeDimensionBundle({
        agentId: agent.id,
        seasonId: season.id,
        dimensionValues,
        bundleName,
      });
    } catch (err) {
      console.error('[SeasonEntryModal] Materialize failed:', err);
      setError("Couldn't save strategy — please try again");
      setSubmitting(false);
      return;
    }

    // Phase 4A: persist the raw dimensionValues onto the bundle doc so the
    // Deploy-to-Agent flow (which runs weeks later, after the experiment
    // completes) can recover the original knob settings. Fire-and-forget —
    // not part of the critical launch path.
    persistDimensionValuesOnBundle(agent.id, bundleId, dimensionValues).catch(
      (err) => console.warn('[SeasonEntryModal] persist dims failed', err)
    );

    // Persist Workshop compile transparency onto the bundle doc for later
    // confidence-vs-outcome auditing. No-ops on manual-configure launches.
    persistCompileTransparencyOnBundle(agent.id, bundleId, {
      confidence: compileConfidence,
      warnings: compileWarnings,
      mappingNotes: compileMappingNotes,
      appliedClamps: compileAppliedClamps,
    }).catch((err) =>
      console.warn('[SeasonEntryModal] persist compile transparency failed', err)
    );

    // Step 2: Call the existing (protected) create-entry API.
    // Phase 6 — forward optional origin metadata so the strategy_configs
    // shadow log captures the creation path (workshop / refinement / etc.)
    // and the refinement pair's source experiment id. The server treats
    // all of these as optional; omitting them preserves legacy behavior.
    try {
      const response = await fetchWithAuth('/api/season/create-entry', {
        method: 'POST',
        body: JSON.stringify({
          // Phase 3 — solo sessions ignore season.id; the server creates
          // a private per-user season on the fly. Tournament path still
          // sends seasonId for explicit season joins (deferred Phase).
          seasonId: season?.id ?? null,
          agentId: agent.id,
          bundleId,
          // Phase 3 — solo mode + user-selected duration. Phase 4 always
          // ships with mode='solo' from the UI; tournament launches still
          // route through this endpoint in future sprints via a separate
          // entry point that overrides mode.
          mode: 'solo',
          durationDays: selectedDurationDays,
          sourceExperimentId,
          entrySource:
            entrySource ||
            (sourceExperimentId
              ? 'refinement_pair'
              : fromConversation
                ? 'workshop'
                : 'manual'),
          // Forward the picked Collection id (e.g. 'swing_trader',
          // 'momentum_rider') so the server can populate
          // creationSource.collectionUsed on the entry doc. Null when
          // the user built dimensions from scratch without a preset.
          sourceCollection:
            selectedCollection && selectedCollection !== 'from-conversation'
              ? selectedCollection
              : null,
          dimensionValues,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(
          data.error || `Couldn't create entry — please try again (${response.status})`
        );
      }

      // Phase 4A belt-and-suspenders: cache dimensionValues keyed by entryId
      // in localStorage so the same device can recover them at Deploy time
      // if the bundle doc is missing `dimensionValues` (e.g., legacy entries
      // created before persistDimensionValuesOnBundle shipped).
      try {
        const raw = localStorage.getItem('forge.lastEntryDims');
        const prev = raw ? JSON.parse(raw) : {};
        prev[data.entryId] = dimensionValues;
        localStorage.setItem('forge.lastEntryDims', JSON.stringify(prev));
      } catch (storageErr) {
        console.warn('[SeasonEntryModal] localStorage write failed', storageErr);
      }

      if (onSuccess) onSuccess(data.entryId);
    } catch (err) {
      console.error('[SeasonEntryModal] Create-entry failed:', err);
      setError(err.message || "Couldn't create entry — please try again");
    } finally {
      setSubmitting(false);
    }
  }, [
    season?.id,
    agent?.id,
    dimensionValues,
    selectedCollection,
    enabledRuleCount,
    onSuccess,
    sourceExperimentId,
    entrySource,
    fromConversation,
    selectedDurationDays,
    compileConfidence,
    compileWarnings,
    compileMappingNotes,
    compileAppliedClamps,
  ]);

  const nextDisabled =
    (step === 1 && enabledRuleCount === 0) ||
    (step === 2 && submitting);

  const titleByStep = ['Launch Experiment', 'Your strategy shape', 'Confirm Entry'];

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title={titleByStep[step]}>
      {/* Body layout: fixed StepDots + scroll area + fixed footer as
          three flex-column siblings. Scroll is constrained to the middle
          region so the footer stays pinned reliably across browsers. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '4px 20px 0', flex: '0 0 auto' }}>
          <StepDots current={step} total={3} />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '0 20px 20px',
          }}
        >
          <div style={{ position: 'relative', minHeight: 240 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`step-${step}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                {step === 0 && <StepOverview season={season} />}
                {step === 1 && (
                  <StepStrategy
                    dimensionValues={dimensionValues}
                    selectedCollection={selectedCollection}
                    isDirty={isDirty}
                    onSelectCollection={handleSelectCollection}
                    onParamChange={handleParamChange}
                    disabled={submitting}
                    fromConversation={fromConversation}
                    compileConfidence={compileConfidence}
                    compileWarnings={compileWarnings}
                    compileMappingNotes={compileMappingNotes}
                    compileAppliedClamps={compileAppliedClamps}
                    selectedDurationDays={selectedDurationDays}
                    onChangeDuration={handleDurationChange}
                    durationFromWorkshop={durationFromWorkshop}
                    showAdvanced={showAdvanced}
                    onToggleAdvanced={setShowAdvanced}
                  />
                )}
                {step === 2 && (
                  <StepConfirm
                    season={season}
                    dimensionValues={dimensionValues}
                    selectedCollection={selectedCollection}
                    submitting={submitting}
                    error={error}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Nav footer — flex-column sibling of the scroll area, so it's
            always pinned at the bottom of the modal card. */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            gap: 10,
            padding: '12px 20px 20px',
            borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
            background: '#0D0E12', // matches tokens.bgApp used by CenteredModal
          }}
        >
          {step > 0 && (
            <button
              onClick={goBack}
              disabled={submitting}
              style={{
                flex: '0 0 auto',
                padding: '12px 18px',
                background: 'transparent',
                color: HOLO_COLORS.textSecondary,
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              ← Back
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={goNext}
              disabled={nextDisabled}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: nextDisabled ? HOLO_COLORS.borderSubtle : TROPHY_GOLD,
                color: nextDisabled ? HOLO_COLORS.textMuted : '#0d1117',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {step === 0 ? 'Next: Configure Strategy →' : 'Next: Confirm →'}
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={nextDisabled}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: nextDisabled ? HOLO_COLORS.borderSubtle : POSITIVE,
                color: nextDisabled ? HOLO_COLORS.textMuted : '#0d1117',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Deploying...' : '🔥 Deploy to Agent'}
            </button>
          )}
        </div>
      </div>
    </CenteredModal>
  );
}
