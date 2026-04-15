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
// paramKey names match the keys in DIMENSION_DEFAULTS in
// src/utils/dimensionMapper.js. `span` controls the card's grid-column
// span in its collapsed state (in a 6-col grid).

const DIMENSION_CONFIGS = [
  {
    key: 'riskPosture',
    title: 'Risk Posture',
    question: 'How much drawdown can you stomach?',
    span: 2,
    controls: [
      { paramKey: 'stopLoss', type: 'slider', label: 'Stop-loss', min: 3, max: 20, step: 1, unit: '%', hint: 'Exit a position once it drops this far below entry.' },
      { paramKey: 'trailingStop', type: 'slider', label: 'Trailing stop', min: 3, max: 25, step: 1, unit: '%', hint: 'Lock gains — sell when price drops this far from peak.' },
    ],
  },
  {
    key: 'entryAggression',
    title: 'Entry Aggression',
    question: 'How picky are your filters?',
    span: 2,
    controls: [
      { paramKey: 'rsiUpper', type: 'slider', label: 'Max RSI', min: 50, max: 80, step: 1, unit: 'RSI', hint: 'Skip stocks that are already overbought.' },
      { paramKey: 'volumeConfirm', type: 'toggle', label: 'Volume confirmation', hint: 'Require ≥1.2× average 20-day volume before entry.' },
      { paramKey: 'fundamentalFloor', type: 'slider', label: 'Fundamental floor', min: 20, max: 80, step: 5, unit: '', hint: 'Minimum composite fundamental score (0–100 scale).' },
    ],
  },
  {
    key: 'exitDiscipline',
    title: 'Exit Discipline',
    question: 'When do you take profits or cut?',
    span: 2,
    controls: [
      { paramKey: 'profitTarget', type: 'slider', label: 'Profit target', min: 5, max: 50, step: 1, unit: '%', hint: 'Lock in gains once a position reaches this return.' },
      { paramKey: 'timeExit', type: 'slider', label: 'Time-based exit', min: 2, max: 15, step: 1, unit: 'days', hint: 'Close flat positions that haven’t moved within this window.' },
      { paramKey: 'technicalExit', type: 'toggle', label: 'Technical exit signals', hint: 'Exit on RSI-overbought breakdown (default trigger).' },
    ],
  },
  {
    key: 'sectorStrategy',
    title: 'Sector Strategy',
    question: 'Concentrate or diversify?',
    span: 3,
    controls: [
      { paramKey: 'maxSectorWeight', type: 'slider', label: 'Max sector weight', min: 15, max: 50, step: 5, unit: '%', hint: 'Block entries into sectors already at this weight.' },
      { paramKey: 'sectorDriftTolerance', type: 'slider', label: 'Sector drift tolerance', min: 5, max: 20, step: 1, unit: '%', hint: 'Rebalance when a sector drifts this far from initial weight.' },
      { paramKey: 'rebalanceOnDrift', type: 'toggle', label: 'Rebalance on drift', hint: 'Off = accept market-driven drift without rebalancing.' },
    ],
  },
  {
    key: 'momentumSensitivity',
    title: 'Momentum Sensitivity',
    question: 'Chase momentum or buy dips?',
    span: 3,
    controls: [
      { paramKey: 'momentumThreshold', type: 'slider', label: 'Momentum threshold', min: 0.5, max: 10, step: 0.5, unit: '%', hint: 'Minimum 10-day price change required before entry.' },
      { paramKey: 'addToWinners', type: 'toggle', label: 'Add to winners', hint: 'Pyramid into positions already up ≥10%.' },
      { paramKey: 'cutUnderperformers', type: 'toggle', label: 'Cut underperformers', hint: 'Trim positions lagging the benchmark.' },
    ],
  },
  {
    key: 'macroAwareness',
    title: 'Macro Awareness',
    question: 'How much do events change behavior?',
    span: 3,
    controls: [
      { paramKey: 'earningsAvoidance', type: 'slider', label: 'Earnings avoidance window', min: 0, max: 10, step: 1, unit: 'days', hint: 'Skip entries this many days before earnings (0 = ignore).' },
      { paramKey: 'fomcDefensive', type: 'toggle', label: 'FOMC defensive rotation', hint: 'Reduce high-beta exposure ahead of Fed / CPI events.' },
      {
        paramKey: 'benchmarkGapResponse',
        type: 'select',
        label: 'Benchmark gap response',
        hint: 'How to react when trailing or leading the S&P benchmark.',
        options: [
          { value: 'off', label: 'Ignore' },
          { value: 'react', label: 'React' },
          { value: 'aggressive', label: 'Aggressive' },
        ],
      },
    ],
  },
  {
    key: 'positionSizing',
    title: 'Position Sizing',
    question: 'Equal weight or conviction?',
    span: 3,
    controls: [
      { paramKey: 'maxPosition', type: 'slider', label: 'Max single position', min: 10, max: 30, step: 1, unit: '%', hint: 'Hard cap on any one holding.' },
      { paramKey: 'cashDeploymentTrigger', type: 'slider', label: 'Cash deployment trigger', min: 5, max: 40, step: 5, unit: '%', hint: 'Deploy cash once idle balance exceeds this.' },
      { paramKey: 'trimThreshold', type: 'slider', label: 'Trim threshold', min: 3, max: 20, step: 1, unit: '%', hint: 'Target trim back this far below the max position cap.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Radar scoring
// ─────────────────────────────────────────────────────────────
//
// Each formula returns a 0-1 float per dimension. Higher = stronger
// expression of the axis's "character" (tighter risk mgmt, more aggressive
// entries, quicker exits, more concentrated, more momentum-oriented, more
// macro-reactive, larger position sizes). Results are clamped to
// [0.05, 1] so the polygon remains visible even at the extremes.

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

function dimensionToRadarScore(key, v) {
  if (!v) return 0.5;
  switch (key) {
    case 'riskPosture':
      return clamp(1 - (v.stopLoss - 3) / 17, 0.05, 1);
    case 'entryAggression':
      return clamp(
        0.5 * ((v.rsiUpper - 50) / 30) +
          0.5 * (1 - v.fundamentalFloor / 100),
        0.05,
        1
      );
    case 'exitDiscipline':
      return clamp(1 - (v.profitTarget - 5) / 25, 0.05, 1);
    case 'sectorStrategy':
      return clamp((v.maxSectorWeight - 10) / 40, 0.05, 1);
    case 'momentumSensitivity':
      return clamp(
        0.5 * (v.momentumThreshold / 6) +
          0.25 * (v.addToWinners ? 1 : 0) +
          0.25 * (v.cutUnderperformers ? 1 : 0),
        0.05,
        1
      );
    case 'macroAwareness':
      return clamp(
        0.5 * (v.earningsAvoidance / 7) +
          0.3 * (v.fomcDefensive ? 1 : 0) +
          0.2 *
            (v.benchmarkGapResponse === 'aggressive'
              ? 1
              : v.benchmarkGapResponse === 'react'
              ? 0.5
              : 0),
        0.05,
        1
      );
    case 'positionSizing':
      return clamp((v.maxPosition - 5) / 20, 0.05, 1);
    default:
      return 0.5;
  }
}

// Short phrase per dimension at each extreme — used in the strategy
// summary line below the radar. Picked at most 3 dimensions whose score
// is furthest from 0.5.
const SUMMARY_PHRASES = {
  riskPosture: { high: 'tight stops', low: 'loose stops' },
  entryAggression: { high: 'aggressive entries', low: 'strict entries' },
  exitDiscipline: { high: 'quick exits', low: 'patient exits' },
  sectorStrategy: { high: 'concentrated sectors', low: 'diversified sectors' },
  momentumSensitivity: { high: 'momentum-heavy', low: 'contrarian' },
  macroAwareness: { high: 'macro-reactive', low: 'macro-agnostic' },
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
  values,
  onParamChange,
  disabled,
  isExpanded,
  onToggleExpanded,
  isNarrow,
}) {
  const posture = getPostureLabel(config.key, values);
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
              {config.controls.map((control) => (
                <DimensionControl
                  key={control.paramKey}
                  control={control}
                  value={values[control.paramKey]}
                  disabled={disabled}
                  onChange={(newValue) =>
                    onParamChange(config.key, control.paramKey, newValue)
                  }
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DimensionControl({ control, value, onChange, disabled }) {
  const wrapperStyle = disabled
    ? { opacity: 0.55, pointerEvents: 'none' }
    : undefined;

  if (control.type === 'slider') {
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
          value={value}
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
  if (control.type === 'select') {
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

  // Radar scores + summary recompute on every value change. Merge each
  // dimension over its defaults so partial inputs (e.g. Workshop Mode
  // prefill supplying only a subset of sub-keys) can't produce NaN in the
  // formulas — the guard in dimensionToRadarScore only handles a missing
  // dimension object, not a missing sub-key within one.
  const radarScores = useMemo(() => {
    const out = {};
    DIMENSION_CONFIGS.forEach((c) => {
      const merged = { ...DIMENSION_DEFAULTS[c.key], ...(values[c.key] || {}) };
      out[c.key] = dimensionToRadarScore(c.key, merged);
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

      {/* Hint — only when nothing is expanded */}
      {expandedKey === null && (
        <div
          style={{
            fontSize: 12,
            color: TEXT_MUTED,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Tap any dimension to tune it
        </div>
      )}

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
            values={values[config.key] || {}}
            onParamChange={onChange}
            disabled={disabled}
            isExpanded={expandedKey === config.key}
            onToggleExpanded={() =>
              setExpandedKey((prev) => (prev === config.key ? null : config.key))
            }
            isNarrow={isNarrow}
          />
        ))}
      </div>
    </div>
  );
}
