// src/components/Forge/StrategyDimensions.jsx
//
// The primary configuration surface for launching an experiment. The
// component is organized around three visual layers:
//
//   1. Trading Style chips (CollectionPicker) — preset strategies that
//      reshape all 7 dimensions in one tap.
//   2. Radar chart — a 7-axis spider that visualizes the user's current
//      strategy as a polygon. Morphs with every slider move.
//   3. Dimension grid — 7 compact cards arranged 3 / 2 / 2. Tap a card
//      to expand it inline to full-width with the underlying sliders,
//      toggles, and selectors.
//
// Control primitives (ParamSlider / ParamToggle / ParamPicker) are reused
// from src/components/Forge/ParamControls/* so the look-and-feel matches
// the Rule Config Drawer.
//
// Props:
//   values              — dimensionValues object (see DIMENSION_DEFAULTS)
//   onChange            — (dimensionKey, paramKey, newValue) => void
//   disabled            — bool, lock all controls (e.g. during submit)
//   selectedCollection  — string | null, current Trading Style id
//   onSelectCollection  — (collectionId) => void
//   isDirty             — bool, user has edited since last preset apply

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ParamSlider from './ParamControls/ParamSlider';
import ParamToggle from './ParamControls/ParamToggle';
import ParamPicker from './ParamControls/ParamPicker';
import CollectionPicker from './CollectionPicker';
import RadarChart from './RadarChart';
import { getPostureLabel, DIMENSION_DEFAULTS } from '../../utils/dimensionMapper';
import { dimensionToRadarScore } from '../../utils/dimensionRadarScore';
import { readDimensionField } from '../../utils/dimensionFieldAccess';

// ─────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────

const CARD_BG = '#15171E';
const BORDER_SUBTLE = '#21262D';
const BORDER_OPEN = '#30363D';
const TEXT_PRIMARY = '#E6EDF3';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const ACCENT_TEAL = '#0F6E56';

const TONE_STYLES = {
  cool: {
    bg: 'rgba(56,189,248,0.12)',
    text: '#38BDF8',
  },
  neutral: {
    bg: 'rgba(240,199,94,0.12)',
    text: '#F0C75E',
  },
  hot: {
    bg: 'rgba(239,68,68,0.12)',
    text: '#EF4444',
  },
};

// ─────────────────────────────────────────────────────────────
// Dimension configuration
// ─────────────────────────────────────────────────────────────
//
// Per control:
//   paramKey         — matches a key in dimensionValues (new or legacy schema)
//   legacyKey        — legacy paramKey read for backward-compat on old bundles
//   type             — 'slider' | 'toggle' | 'segmented' | 'chipPicker'
//                      | 'select' | 'multiSelect'
//   tier             — 'baseline' (default visible) | 'advanced' (behind toggle)
//   requires         — { [siblingKey]: value | value[] } — render only when
//                      the sibling's current value matches
//   options          — enum/segmented/chipPicker option list
//   itemOptions      — multiSelect allowed values
//   min/max/maxItems — slider / multiSelect constraints
//
// The control dispatcher (`DimensionControl`) reads `type` and routes to
// ParamSlider / ParamToggle / ParamPicker / new inline components.

const SECTOR_UNIVERSE = [
  'Technology', 'Healthcare', 'Financials', 'Energy',
  'Consumer Discretionary', 'Consumer Staples', 'Industrials',
  'Materials', 'Utilities', 'Real Estate', 'Communication Services',
];

const DIMENSION_CONFIGS = [
  {
    key: 'riskPosture',
    title: 'Risk Posture',
    question: 'How much drawdown can you stomach?',
    span: 2,
    controls: [
      { paramKey: 'stopLossPct', legacyKey: 'stopLoss', type: 'slider', tier: 'baseline', label: 'Stop-loss', min: 3, max: 20, step: 1, unit: '%', hint: 'Exit a position once it drops this far below entry.' },
      { paramKey: 'trailingStopPct', legacyKey: 'trailingStop', type: 'slider', tier: 'baseline', label: 'Trailing stop', min: 3, max: 25, step: 1, unit: '%', hint: 'Lock gains — sell when price drops this far from peak.' },
    ],
  },
  {
    key: 'entryAggression',
    title: 'Entry Aggression',
    question: 'How picky are your filters?',
    span: 2,
    controls: [
      { paramKey: 'rsiCeiling', legacyKey: 'rsiUpper', type: 'slider', tier: 'baseline', label: 'Max RSI', min: 50, max: 80, step: 1, unit: 'RSI', hint: 'Skip stocks that are already overbought.' },
      { paramKey: 'volumeConfirmEnabled', legacyKey: 'volumeConfirm', type: 'toggle', tier: 'baseline', label: 'Volume confirmation', hint: 'Require volume above the multiplier × 20-day average before entry.' },
      { paramKey: 'volumeMultiplier', type: 'chipPicker', tier: 'advanced', label: 'Volume multiplier', options: [1.2, 1.5, 2.0, 3.0], formatChip: (v) => `${v}×`, requires: { volumeConfirmEnabled: true }, hint: 'How much above average volume the entry requires.' },
      { paramKey: 'trendAlignmentEnabled', type: 'toggle', tier: 'baseline', label: 'Trend alignment', hint: 'Require price above a moving average before entry.' },
      { paramKey: 'trendAlignmentSmaPeriod', type: 'chipPicker', tier: 'baseline', label: 'SMA period', options: [20, 50, 100, 200], formatChip: (v) => `${v}`, requires: { trendAlignmentEnabled: true }, hint: 'Which moving average defines "the trend."' },
      { paramKey: 'momentumThresholdPct', legacyKey: 'momentumThreshold', type: 'slider', tier: 'baseline', label: 'Momentum threshold', min: 0.5, max: 10, step: 0.5, unit: '%', hint: 'Minimum price change over the lookback window required before entry.' },
      { paramKey: 'momentumLookbackDays', type: 'chipPicker', tier: 'advanced', label: 'Momentum lookback', options: [5, 10, 20], formatChip: (v) => `${v}d`, hint: 'Days over which the momentum threshold is measured.' },
      { paramKey: 'fundamentalFloor', type: 'slider', tier: 'baseline', label: 'Fundamental floor', min: 20, max: 80, step: 5, unit: '', hint: 'Minimum composite fundamental score (0–100 scale).' },
      { paramKey: 'institutionalEnabled', type: 'toggle', tier: 'advanced', label: 'Institutional sentiment filter', hint: 'Only enter when institutional ownership is moving the right way.' },
      {
        paramKey: 'institutionalDirection', type: 'segmented', tier: 'advanced', label: 'Ownership direction',
        options: [
          { value: 'any', label: 'Any' },
          { value: 'increased', label: 'Increased' },
          { value: 'stable_or_increased', label: 'Stable+' },
        ],
        requires: { institutionalEnabled: true },
        hint: 'Required direction of institutional ownership change.',
      },
      { paramKey: 'institutionalQuarters', type: 'chipPicker', tier: 'advanced', label: 'Lookback quarters', options: [1, 2, 4], formatChip: (v) => `${v}Q`, requires: { institutionalEnabled: true }, hint: 'How many quarters of ownership history to consider.' },
    ],
  },
  {
    key: 'exitDiscipline',
    title: 'Exit Discipline',
    question: 'When do you take profits or cut?',
    span: 2,
    controls: [
      { paramKey: 'profitTargetPct', legacyKey: 'profitTarget', type: 'slider', tier: 'baseline', label: 'Profit target', min: 5, max: 50, step: 1, unit: '%', hint: 'Lock in gains once a position reaches this return.' },
      { paramKey: 'timeExitDays', legacyKey: 'timeExit', type: 'slider', tier: 'baseline', label: 'Time-based exit', min: 2, max: 15, step: 1, unit: 'days', hint: 'Close flat positions that haven’t moved within this window.' },
      { paramKey: 'timeExitMinGainPct', type: 'chipPicker', tier: 'advanced', label: 'Time-exit minimum gain', options: [0, 1, 3, 5], formatChip: (v) => `${v}%`, hint: 'Minimum gain to count as a successful hold — below this, the position is closed.' },
      { paramKey: 'technicalExitEnabled', legacyKey: 'technicalExit', type: 'toggle', tier: 'baseline', label: 'Technical exit signal', hint: 'Exit on a chart-based breakdown signal.' },
      {
        paramKey: 'technicalExitTrigger', type: 'segmented', tier: 'baseline', label: 'Exit trigger',
        options: [
          { value: 'rsi_overbought', label: 'RSI' },
          { value: 'macd_bearish', label: 'MACD' },
          { value: 'either_rsi_or_macd', label: 'Either' },
          { value: 'below_sma', label: 'Below SMA' },
        ],
        requires: { technicalExitEnabled: true },
        hint: 'Which technical breakdown signals an exit.',
      },
      { paramKey: 'technicalExitRsiThreshold', type: 'chipPicker', tier: 'baseline', label: 'RSI threshold', options: [65, 70, 75, 80, 85], formatChip: (v) => `${v}`, requires: { technicalExitEnabled: true, technicalExitTrigger: ['rsi_overbought', 'either_rsi_or_macd'] }, hint: 'RSI value that fires the exit.' },
      { paramKey: 'technicalExitSmaPeriod', type: 'chipPicker', tier: 'advanced', label: 'SMA period', options: [20, 50, 100, 200], formatChip: (v) => `${v}`, requires: { technicalExitEnabled: true, technicalExitTrigger: 'below_sma' }, hint: 'Moving average whose breach fires the exit.' },
      { paramKey: 'earningsExitEnabled', type: 'toggle', tier: 'baseline', label: 'Earnings exit', hint: 'Close positions ahead of earnings announcements.' },
      { paramKey: 'earningsExitDays', type: 'chipPicker', tier: 'baseline', label: 'Days before earnings', options: [1, 2, 3, 5], formatChip: (v) => `${v}d`, requires: { earningsExitEnabled: true }, hint: 'How many trading days before the event to close.' },
      { paramKey: 'earningsExitOnlyIfProfitable', type: 'toggle', tier: 'advanced', label: 'Only if profitable', requires: { earningsExitEnabled: true }, hint: 'Skip the exit when the position is still at a loss.' },
    ],
  },
  {
    key: 'sectorStrategy',
    title: 'Sector Strategy',
    question: 'Concentrate or diversify?',
    span: 3,
    controls: [
      { paramKey: 'maxSectorWeightPct', legacyKey: 'maxSectorWeight', type: 'slider', tier: 'baseline', label: 'Max sector weight', min: 15, max: 50, step: 5, unit: '%', hint: 'Block entries into sectors already at this weight.' },
      { paramKey: 'sectorDriftTolerancePct', legacyKey: 'sectorDriftTolerance', type: 'slider', tier: 'baseline', label: 'Sector drift tolerance', min: 5, max: 20, step: 1, unit: '%', hint: 'Rebalance when a sector drifts this far from initial weight.' },
      { paramKey: 'rebalanceOnDrift', type: 'toggle', tier: 'baseline', label: 'Rebalance on drift', hint: 'Off = accept market-driven drift without rebalancing.' },
      { paramKey: 'sectorFilterEnabled', type: 'toggle', tier: 'baseline', label: 'Sector universe filter', hint: 'Narrow the tradable universe to specific sectors.' },
      {
        paramKey: 'sectorFilterMode', type: 'segmented', tier: 'baseline', label: 'Filter mode',
        options: [
          { value: 'top_n', label: 'Top N momentum' },
          { value: 'specific_sectors', label: 'Specific sectors' },
        ],
        requires: { sectorFilterEnabled: true },
        hint: 'Dynamic top-N ranking or an explicit sector list.',
      },
      {
        paramKey: 'sectorFilterTimeframe', type: 'segmented', tier: 'baseline', label: 'Ranking timeframe',
        options: [
          { value: '1D', label: '1D' },
          { value: '1W', label: '1W' },
          { value: '1M', label: '1M' },
        ],
        requires: { sectorFilterEnabled: true, sectorFilterMode: 'top_n' },
        hint: 'Momentum timeframe used to rank sectors.',
      },
      { paramKey: 'sectorFilterTopN', type: 'chipPicker', tier: 'baseline', label: 'Top sectors', options: [1, 2, 3, 5], formatChip: (v) => `${v}`, requires: { sectorFilterEnabled: true, sectorFilterMode: 'top_n' }, hint: 'How many top-ranked sectors to include.' },
      { paramKey: 'sectorFilterSelected', type: 'multiSelect', tier: 'baseline', label: 'Allowed sectors', itemOptions: SECTOR_UNIVERSE, minItems: 1, maxItems: 5, requires: { sectorFilterEnabled: true, sectorFilterMode: 'specific_sectors' }, hint: 'Pick 1–5 sectors to trade.' },
    ],
  },
  {
    key: 'momentumSensitivity',
    title: 'Momentum Sensitivity',
    question: 'Chase momentum or buy dips?',
    span: 3,
    // Vestigial per spec §4.5 — kept in the radar for visual continuity
    // but its only active control (momentumThresholdPct) duplicates the
    // same value under entryAggression, so the card exposes no controls.
    controls: [],
  },
  {
    key: 'eventRisk',
    title: 'Event Risk',
    question: 'How much do events change behavior?',
    span: 3,
    controls: [
      { paramKey: 'earningsAvoidanceDays', legacyKey: 'earningsAvoidance', legacyDim: 'macroAwareness', type: 'slider', tier: 'baseline', label: 'Earnings avoidance window', min: 0, max: 10, step: 1, unit: 'days', hint: 'Skip entries this many days before earnings (0 = ignore).' },
    ],
  },
  {
    key: 'positionSizing',
    title: 'Position Sizing',
    question: 'Equal weight or conviction?',
    span: 3,
    controls: [
      { paramKey: 'maxPositionWeightPct', legacyKey: 'maxPosition', type: 'slider', tier: 'baseline', label: 'Max single position', min: 10, max: 30, step: 1, unit: '%', hint: 'Preferred ceiling for any one holding — guidance the agent weighs, not an enforced limit.' },
      { paramKey: 'cashDeploymentTriggerPct', legacyKey: 'cashDeploymentTrigger', type: 'slider', tier: 'baseline', label: 'Cash deployment trigger', min: 5, max: 40, step: 5, unit: '%', hint: 'Deploy cash once idle balance exceeds this.' },
      { paramKey: 'trimThreshold', type: 'slider', tier: 'baseline', label: 'Trim threshold', min: 3, max: 20, step: 1, unit: '%', hint: 'Target trim back this far below the max position cap.' },
      { paramKey: 'addToWinnersEnabled', legacyKey: 'addToWinners', legacyDim: 'momentumSensitivity', type: 'toggle', tier: 'baseline', label: 'Add to winners', hint: 'Pyramid into positions that keep running.' },
      { paramKey: 'winnerReturnTrigger', type: 'chipPicker', tier: 'advanced', label: 'Winner return trigger', options: [5, 10, 15, 20], formatChip: (v) => `${v}%`, requires: { addToWinnersEnabled: true }, hint: 'Return % that triggers adding to a winner.' },
      { paramKey: 'winnerAddWeight', type: 'chipPicker', tier: 'advanced', label: 'Weight per add', options: [1, 2, 3, 5], formatChip: (v) => `${v}%`, requires: { addToWinnersEnabled: true }, hint: 'Weight increment per add-to-winner event.' },
      { paramKey: 'cutUnderperformersEnabled', legacyKey: 'cutUnderperformers', legacyDim: 'momentumSensitivity', type: 'toggle', tier: 'baseline', label: 'Cut underperformers', hint: 'Trim positions lagging the benchmark.' },
      { paramKey: 'loserUnderperformanceTrigger', type: 'chipPicker', tier: 'advanced', label: 'Underperformance trigger', options: [3, 5, 8, 10], formatChip: (v) => `${v}%`, requires: { cutUnderperformersEnabled: true }, hint: 'Alpha gap vs. SPY that triggers a cut.' },
      { paramKey: 'loserLookbackDays', type: 'chipPicker', tier: 'advanced', label: 'Lookback window', options: [3, 5, 10, 15], formatChip: (v) => `${v}d`, requires: { cutUnderperformersEnabled: true }, hint: 'Days over which the underperformance is measured.' },
      { paramKey: 'loserReduceWeight', type: 'chipPicker', tier: 'advanced', label: 'Weight per reduction', options: [1, 2, 3, 5], formatChip: (v) => `${v}%`, requires: { cutUnderperformersEnabled: true }, hint: 'Weight decrement per cut event.' },
      { paramKey: 'correlationExitEnabled', type: 'toggle', tier: 'advanced', label: 'Correlation exit', hint: 'Trim one of any pair of holdings whose prices move too closely together.' },
      { paramKey: 'correlationThreshold', type: 'chipPicker', tier: 'advanced', label: 'Correlation threshold', options: [0.7, 0.8, 0.9], formatChip: (v) => v.toFixed(1), requires: { correlationExitEnabled: true }, hint: 'Pair correlation above this triggers the trim.' },
      { paramKey: 'correlationLookbackDays', type: 'chipPicker', tier: 'advanced', label: 'Correlation window', options: [20, 30, 60, 90], formatChip: (v) => `${v}d`, requires: { correlationExitEnabled: true }, hint: 'Days of price history used to compute the correlation.' },
    ],
  },
];

// Phase 4.5: both resolve via the canonical reader. The per-control
// `legacyKey` / `legacyDim` hints in DIMENSION_CONFIGS are retained for
// DOC purposes only — FIELD_REGISTRY is the authoritative legacy map.
function readControlValue(dimensionValues, _dimKey, control) {
  return readDimensionField(dimensionValues, control.paramKey);
}

function requirementsMet(requires, dimensionValues /*, _dimKey */) {
  if (!requires) return true;
  for (const [siblingKey, expected] of Object.entries(requires)) {
    const allowed = Array.isArray(expected) ? expected : [expected];
    const siblingValue = readDimensionField(dimensionValues, siblingKey);
    if (!allowed.includes(siblingValue)) return false;
  }
  return true;
}

// Radar scoring formulas live in src/utils/dimensionRadarScore.js so that
// ForgeLanding's mini radar and StrategyDimensions' full-size radar share
// the same normalization.

// Short phrase per dimension at each extreme — used in the strategy
// summary line below the radar. Picked at most 3 dimensions whose score
// is furthest from 0.5.
const SUMMARY_PHRASES = {
  riskPosture: { high: 'tight stops', low: 'loose stops' },
  entryAggression: { high: 'aggressive entries', low: 'strict entries' },
  exitDiscipline: { high: 'quick exits', low: 'patient exits' },
  sectorStrategy: { high: 'concentrated sectors', low: 'diversified sectors' },
  momentumSensitivity: { high: 'momentum-heavy', low: 'contrarian' },
  eventRisk: { high: 'event-aware', low: 'event-agnostic' },
  positionSizing: { high: 'concentrated sizing', low: 'spread thin' },
};

function summarizeStrategy(values, scores) {
  const ranked = DIMENSION_CONFIGS.map((c) => ({
    key: c.key,
    score: scores[c.key] ?? 0.5,
  }))
    .map((s) => ({ ...s, extremity: Math.abs(s.score - 0.5) }))
    .filter((s) => s.extremity > 0.15)
    .sort((a, b) => b.extremity - a.extremity)
    .slice(0, 3);

  if (ranked.length === 0) {
    return 'Balanced across all dimensions.';
  }

  const phrases = ranked.map((s) => {
    const table = SUMMARY_PHRASES[s.key];
    return s.score >= 0.5 ? table.high : table.low;
  });
  const joined = phrases.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

// ─────────────────────────────────────────────────────────────
// Dimension card
// ─────────────────────────────────────────────────────────────

function DimensionCard({
  config,
  dimensionValues,
  onParamChange,
  disabled,
  isExpanded,
  onToggleExpanded,
  isNarrow,
  showAdvanced,
}) {
  // Phase 4.5: getPostureLabel now takes the full dimensionValues blob so
  // posture functions can use the canonical reader (legacy fallback +
  // cross-dimension reads for relocated fields like eventRisk).
  const posture = getPostureLabel(config.key, dimensionValues);
  const tone = TONE_STYLES[posture.tone] || TONE_STYLES.neutral;
  // On narrow viewports (≤420px) force every card to span 3 of the 6-col
  // grid, giving all 7 dimensions a full half-row so the title + pill are
  // never starved for width. Desktop keeps the per-config span (2/2/2 row
  // followed by 3/3 rows).
  const collapsedSpan = isNarrow ? 3 : config.span;

  return (
    <div
      style={{
        gridColumn: isExpanded ? '1 / -1' : `span ${collapsedSpan}`,
        background: CARD_BG,
        border: `0.5px solid ${isExpanded ? BORDER_OPEN : BORDER_SUBTLE}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Header — always visible, tap to toggle */}
      <button
        onClick={onToggleExpanded}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: 12,
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {config.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              marginTop: 2,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {config.question}
          </div>
        </div>

        {/* Level pill */}
        <div
          style={{
            padding: '3px 6px',
            borderRadius: 5,
            background: tone.bg,
            flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={posture.label}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.15 }}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: tone.text,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {posture.label}
            </motion.div>
          </AnimatePresence>
        </div>

        {isExpanded && (
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 180 }}
            style={{ flexShrink: 0, color: TEXT_MUTED }}
          >
            <ChevronDown size={14} />
          </motion.div>
        )}
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '4px 14px 12px',
                borderTop: `0.5px solid ${BORDER_SUBTLE}`,
              }}
            >
              <DimensionBody
                config={config}
                dimensionValues={dimensionValues}
                onParamChange={onParamChange}
                disabled={disabled}
                showAdvanced={showAdvanced}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Splits a dimension's controls into baseline + advanced tiers, filters both
// by `requires` gating against current values, and renders each list with
// a subtle divider between tiers when `showAdvanced` is on. Vestigial
// dimensions (no controls) render a short note.
function DimensionBody({ config, dimensionValues, onParamChange, disabled, showAdvanced }) {
  if (!config.controls || config.controls.length === 0) {
    return (
      <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 0', lineHeight: 1.5 }}>
        This dimension has no user-configurable controls right now — its
        signal lives under other dimensions. Shape shown in the radar for
        visual continuity.
      </div>
    );
  }

  const baseline = config.controls.filter(
    (c) => c.tier !== 'advanced' && requirementsMet(c.requires, dimensionValues, config.key)
  );
  const advanced = showAdvanced
    ? config.controls.filter(
        (c) => c.tier === 'advanced' && requirementsMet(c.requires, dimensionValues, config.key)
      )
    : [];

  return (
    <>
      {baseline.map((control) => (
        <DimensionControl
          key={control.paramKey}
          control={control}
          value={readControlValue(dimensionValues, config.key, control)}
          disabled={disabled}
          onChange={(newValue) => onParamChange(config.key, control.paramKey, newValue)}
        />
      ))}

      {advanced.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 10,
            borderTop: `0.5px dashed ${BORDER_SUBTLE}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: TEXT_MUTED,
              marginBottom: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            Advanced
          </div>
          {advanced.map((control) => (
            <DimensionControl
              key={control.paramKey}
              control={control}
              value={readControlValue(dimensionValues, config.key, control)}
              disabled={disabled}
              onChange={(newValue) => onParamChange(config.key, control.paramKey, newValue)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Inline control primitives ──────────────────────────────
// These complement ParamSlider / ParamToggle / ParamPicker for the new
// Phase 4 control types (enumNumber chip picker and stringArray multi-
// select checkbox grid). They match the tight visual style of the
// existing Forge controls.

function ChipPicker({ label, hint, options, value, formatChip, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 14, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <button
              key={String(opt)}
              onClick={(e) => { e.stopPropagation(); onChange(opt); }}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: selected ? ACCENT_TEAL : TEXT_SECONDARY,
                background: selected ? `${ACCENT_TEAL}1A` : '#15171E',
                border: `1px solid ${selected ? ACCENT_TEAL : '#2A2D35'}`,
                borderRadius: 8,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {formatChip ? formatChip(opt) : String(opt)}
            </button>
          );
        })}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  );
}

function MultiSelectChips({
  label, hint, itemOptions, value, onChange, disabled, minItems = 0, maxItems = Infinity,
}) {
  const selected = Array.isArray(value) ? value : [];
  const atMax = selected.length >= maxItems;
  const toggle = (item) => {
    if (selected.includes(item)) {
      if (selected.length <= minItems) return;  // floor — don't drop below min via UI
      onChange(selected.filter((s) => s !== item));
    } else {
      if (atMax) return;
      onChange([...selected, item]);
    }
  };
  return (
    <div style={{ marginBottom: 14, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>{label}</div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {selected.length} / {Math.min(maxItems, itemOptions.length)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {itemOptions.map((item) => {
          const isSel = selected.includes(item);
          const isDisabled = !isSel && atMax;
          return (
            <button
              key={item}
              onClick={(e) => { e.stopPropagation(); toggle(item); }}
              disabled={isDisabled}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isSel ? ACCENT_TEAL : (isDisabled ? TEXT_MUTED : TEXT_SECONDARY),
                background: isSel ? `${ACCENT_TEAL}1A` : '#15171E',
                border: `1px solid ${isSel ? ACCENT_TEAL : '#2A2D35'}`,
                borderRadius: 6,
                padding: '6px 8px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                opacity: isDisabled ? 0.55 : 1,
              }}
            >
              {isSel ? '✓ ' : ''}{item}
            </button>
          );
        })}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  );
}

function DimensionControl({ control, value, onChange, disabled }) {
  const wrapperStyle = disabled
    ? { opacity: 0.55, pointerEvents: 'none' }
    : undefined;

  if (control.type === 'slider') {
    const effective = typeof value === 'number' ? value : control.min;
    return (
      <div style={wrapperStyle}>
        <ParamSlider
          param={{
            label: control.label,
            min: control.min,
            max: control.max,
            step: control.step || 1,
            unit: control.unit || '',
            hint: control.hint,
          }}
          value={effective}
          onChange={onChange}
          categoryColor={ACCENT_TEAL}
        />
      </div>
    );
  }
  if (control.type === 'toggle') {
    return (
      <div style={wrapperStyle}>
        <ParamToggle
          param={{ label: control.label, hint: control.hint }}
          value={!!value}
          onChange={onChange}
          categoryColor={ACCENT_TEAL}
        />
      </div>
    );
  }
  if (control.type === 'select' || control.type === 'segmented') {
    return (
      <div style={wrapperStyle}>
        <ParamPicker
          param={{
            label: control.label,
            hint: control.hint,
            options: control.options,
          }}
          value={value}
          onChange={onChange}
          categoryColor={ACCENT_TEAL}
        />
      </div>
    );
  }
  if (control.type === 'chipPicker') {
    return (
      <ChipPicker
        label={control.label}
        hint={control.hint}
        options={control.options}
        value={value}
        formatChip={control.formatChip}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (control.type === 'multiSelect') {
    return (
      <MultiSelectChips
        label={control.label}
        hint={control.hint}
        itemOptions={control.itemOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        minItems={control.minItems}
        maxItems={control.maxItems}
      />
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function StrategyDimensions({
  values,
  onChange,
  disabled,
  selectedCollection,
  onSelectCollection,
  isDirty,
  showAdvanced = false,
  onToggleAdvanced,
}) {
  const [expandedKey, setExpandedKey] = useState(null);
  const reducedMotion = useReducedMotion();

  // Track narrow-viewport state so the dimension grid can switch to a
  // 2-column layout on mobile (≤420px) — at the default 3-column top row
  // span-2 cards don't have enough width for their title + pill.
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 420px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia('(max-width: 420px)');
    const handler = (e) => setIsNarrow(e.matches);
    setIsNarrow(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Radar scores + summary recompute on every value change. Phase 4.5:
  // dimensionToRadarScore now takes the full dv blob and reads via the
  // canonical layer, which handles legacy fallback + cross-dim reads
  // transparently. We merge over DIMENSION_DEFAULTS once so partial
  // Workshop prefill can't leave required fields undefined.
  const radarScores = useMemo(() => {
    // Merge defaults under values at the dimension level so every
    // dimension is present in the blob passed to the scorer.
    const hydrated = {};
    for (const [dimKey, defaults] of Object.entries(DIMENSION_DEFAULTS)) {
      hydrated[dimKey] = { ...defaults, ...(values?.[dimKey] || {}) };
    }
    const out = {};
    DIMENSION_CONFIGS.forEach((c) => {
      out[c.key] = dimensionToRadarScore(c.key, hydrated);
    });
    return out;
  }, [values]);

  const summary = useMemo(
    () => summarizeStrategy(values, radarScores),
    [values, radarScores]
  );

  // One-shot pulse on chip tap. We track the previous collection and
  // increment a tick when it changes — the motion.div below keys off
  // this tick so each chip tap re-mounts the wrapper with its initial
  // scale, producing a brief 0.95 → 1 pulse.
  const [pulseTick, setPulseTick] = useState(0);
  const prevCollectionRef = useRef(selectedCollection);
  useEffect(() => {
    if (
      prevCollectionRef.current !== selectedCollection &&
      selectedCollection
    ) {
      setPulseTick((t) => t + 1);
    }
    prevCollectionRef.current = selectedCollection;
  }, [selectedCollection]);

  return (
    <div>
      {/* Trading Style chips */}
      <CollectionPicker
        selected={selectedCollection}
        onSelect={onSelectCollection}
        isDirty={isDirty}
      />

      {/* Radar chart */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '4px 0 6px',
        }}
      >
        <motion.div
          key={pulseTick}
          initial={{ scale: reducedMotion ? 1 : 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          style={{ transformOrigin: 'center' }}
        >
          <RadarChart mode="dimensions" dimensions={radarScores} size={220} />
        </motion.div>
      </div>

      {/* Strategy summary */}
      <div
        style={{
          fontSize: 12,
          color: TEXT_SECONDARY,
          textAlign: 'center',
          marginBottom: 10,
          lineHeight: 1.4,
          padding: '0 12px',
        }}
      >
        {summary}
      </div>

      {/* Hint + Show-advanced toggle row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          {expandedKey === null ? 'Tap any dimension to tune it' : ''}
        </div>
        {onToggleAdvanced && (
          <button
            type="button"
            onClick={() => onToggleAdvanced(!showAdvanced)}
            disabled={disabled}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: showAdvanced ? ACCENT_TEAL : TEXT_SECONDARY,
              background: showAdvanced ? `${ACCENT_TEAL}1A` : 'transparent',
              border: `1px solid ${showAdvanced ? ACCENT_TEAL : BORDER_SUBTLE}`,
              borderRadius: 6,
              padding: '4px 10px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {showAdvanced ? '◉ Advanced on' : '◯ Show advanced'}
          </button>
        )}
      </div>

      {/* Dimension grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridAutoFlow: 'row dense',
          gap: 8,
          alignItems: 'start',
        }}
      >
        {DIMENSION_CONFIGS.map((config) => (
          <DimensionCard
            key={config.key}
            config={config}
            dimensionValues={values}
            onParamChange={onChange}
            disabled={disabled}
            isExpanded={expandedKey === config.key}
            onToggleExpanded={() =>
              setExpandedKey((prev) => (prev === config.key ? null : config.key))
            }
            isNarrow={isNarrow}
            showAdvanced={showAdvanced}
          />
        ))}
      </div>
    </div>
  );
}
