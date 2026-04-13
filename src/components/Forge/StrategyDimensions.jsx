// src/components/Forge/StrategyDimensions.jsx
//
// The primary configuration surface for launching an experiment: 7
// expandable panels, each representing a strategic question. Panels
// display a live posture badge ("Conservative", "Balanced", etc.) that
// updates as the user moves sliders, and reveal 2–4 knobs (sliders,
// toggles, segmented selectors) when expanded.
//
// Reuses ParamSlider / ParamToggle / ParamPicker primitives from
// src/components/Forge/ParamControls/* so the look-and-feel matches the
// existing Rule Config Drawer.
//
// Props:
//   values     — dimensionValues object (see DIMENSION_DEFAULTS)
//   onChange   — (dimensionKey, paramKey, newValue) => void
//   disabled   — bool, lock all controls (e.g. during submit)

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Target,
  DoorOpen,
  PieChart,
  Zap,
  Globe,
  Scale,
  ChevronDown,
} from 'lucide-react';
import ParamSlider from './ParamControls/ParamSlider';
import ParamToggle from './ParamControls/ParamToggle';
import ParamPicker from './ParamControls/ParamPicker';
import { getPostureLabel } from '../../utils/dimensionMapper';

// ─────────────────────────────────────────────────────────────
// Design tokens (local — mirror ForgeLanding.jsx convention)
// ─────────────────────────────────────────────────────────────

const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const BORDER_SUBTLE = '#21262D';
const BORDER_OPEN = '#2A2D35';
const TEXT_PRIMARY = '#E6EDF3';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';

// ─────────────────────────────────────────────────────────────
// Panel primitive
// ─────────────────────────────────────────────────────────────

function DimensionPanel({
  config,
  values,
  onParamChange,
  disabled,
  isOpen,
  onToggleOpen,
}) {
  const Icon = config.icon;
  const posture = getPostureLabel(config.key, values);

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${isOpen ? BORDER_OPEN : BORDER_SUBTLE}`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggleOpen}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Icon chip */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${config.color}1F`, // ~12% opacity
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={config.color} />
        </div>

        {/* Title + question */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              lineHeight: 1.3,
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
            }}
          >
            {config.question}
          </div>
        </div>

        {/* Posture badge (animated label) */}
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: `${config.color}1F`,
            flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={posture.label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: config.color,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              {posture.label}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ flexShrink: 0, color: TEXT_MUTED }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isOpen && (
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
                padding: '4px 16px 12px',
                borderTop: `1px solid ${BORDER_SUBTLE}`,
              }}
            >
              {config.controls.map((control) => (
                <DimensionControl
                  key={control.paramKey}
                  control={control}
                  dimensionKey={config.key}
                  value={values[control.paramKey]}
                  color={config.color}
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

function DimensionControl({ control, value, color, onChange, disabled }) {
  // Reuse the Forge param primitives. Wrap in a disabled overlay so
  // controls can't fire during submit.
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
          categoryColor={color}
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
          categoryColor={color}
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
          categoryColor={color}
        />
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Dimension configuration
// ─────────────────────────────────────────────────────────────
//
// These control both the rendered UI and the schema of the
// dimensionValues object. paramKey names match the keys in
// DIMENSION_DEFAULTS in src/utils/dimensionMapper.js.

const DIMENSION_CONFIGS = [
  {
    key: 'riskPosture',
    title: 'Risk Posture',
    question: 'How much drawdown can you stomach?',
    icon: Shield,
    color: '#EF4444',
    controls: [
      {
        paramKey: 'stopLoss',
        type: 'slider',
        label: 'Stop-loss',
        min: 3,
        max: 20,
        step: 1,
        unit: '%',
        hint: 'Exit a position once it drops this far below entry.',
      },
      {
        paramKey: 'trailingStop',
        type: 'slider',
        label: 'Trailing stop',
        min: 3,
        max: 25,
        step: 1,
        unit: '%',
        hint: 'Lock gains — sell when price drops this far from peak.',
      },
    ],
  },
  {
    key: 'entryAggression',
    title: 'Entry Aggression',
    question: 'How picky are your filters?',
    icon: Target,
    color: '#5EEAD4',
    controls: [
      {
        paramKey: 'rsiUpper',
        type: 'slider',
        label: 'Max RSI',
        min: 50,
        max: 80,
        step: 1,
        unit: 'RSI',
        hint: 'Skip stocks that are already overbought.',
      },
      {
        paramKey: 'volumeConfirm',
        type: 'toggle',
        label: 'Volume confirmation',
        hint: 'Require ≥1.2× average 20-day volume before entry.',
      },
      {
        paramKey: 'fundamentalFloor',
        type: 'slider',
        label: 'Fundamental floor',
        min: 20,
        max: 80,
        step: 5,
        unit: '',
        hint: 'Minimum composite fundamental score (0–100 scale).',
      },
    ],
  },
  {
    key: 'exitDiscipline',
    title: 'Exit Discipline',
    question: 'When do you take profits or cut?',
    icon: DoorOpen,
    color: '#F0C75E',
    controls: [
      {
        paramKey: 'profitTarget',
        type: 'slider',
        label: 'Profit target',
        min: 5,
        max: 50,
        step: 1,
        unit: '%',
        hint: 'Lock in gains once a position reaches this return.',
      },
      {
        paramKey: 'timeExit',
        type: 'slider',
        label: 'Time-based exit',
        min: 2,
        max: 15,
        step: 1,
        unit: 'days',
        hint: 'Close flat positions that haven’t moved within this window.',
      },
      {
        paramKey: 'technicalExit',
        type: 'toggle',
        label: 'Technical exit signals',
        hint: 'Exit on RSI-overbought breakdown (default trigger).',
      },
    ],
  },
  {
    key: 'sectorStrategy',
    title: 'Sector Strategy',
    question: 'Concentrate or diversify?',
    icon: PieChart,
    color: '#8B5CF6',
    controls: [
      {
        paramKey: 'maxSectorWeight',
        type: 'slider',
        label: 'Max sector weight',
        min: 15,
        max: 50,
        step: 5,
        unit: '%',
        hint: 'Block entries into sectors already at this weight.',
      },
      {
        paramKey: 'sectorDriftTolerance',
        type: 'slider',
        label: 'Sector drift tolerance',
        min: 5,
        max: 20,
        step: 1,
        unit: '%',
        hint: 'Rebalance when a sector drifts this far from initial weight.',
      },
      {
        paramKey: 'rebalanceOnDrift',
        type: 'toggle',
        label: 'Rebalance on drift',
        hint: 'Off = accept market-driven drift without rebalancing.',
      },
    ],
  },
  {
    key: 'momentumSensitivity',
    title: 'Momentum Sensitivity',
    question: 'Chase momentum or buy dips?',
    icon: Zap,
    color: '#38BDF8',
    controls: [
      {
        paramKey: 'momentumThreshold',
        type: 'slider',
        label: 'Momentum threshold',
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: '%',
        hint: 'Minimum 10-day price change required before entry.',
      },
      {
        paramKey: 'addToWinners',
        type: 'toggle',
        label: 'Add to winners',
        hint: 'Pyramid into positions already up ≥10%.',
      },
      {
        paramKey: 'cutUnderperformers',
        type: 'toggle',
        label: 'Cut underperformers',
        hint: 'Trim positions lagging the benchmark.',
      },
    ],
  },
  {
    key: 'macroAwareness',
    title: 'Macro Awareness',
    question: 'How much do events change behavior?',
    icon: Globe,
    color: '#FB923C',
    controls: [
      {
        paramKey: 'earningsAvoidance',
        type: 'slider',
        label: 'Earnings avoidance window',
        min: 0,
        max: 10,
        step: 1,
        unit: 'days',
        hint: 'Skip entries this many days before earnings (0 = ignore).',
      },
      {
        paramKey: 'fomcDefensive',
        type: 'toggle',
        label: 'FOMC defensive rotation',
        hint: 'Reduce high-beta exposure ahead of Fed / CPI events.',
      },
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
    icon: Scale,
    color: '#34D399',
    controls: [
      {
        paramKey: 'maxPosition',
        type: 'slider',
        label: 'Max single position',
        min: 10,
        max: 30,
        step: 1,
        unit: '%',
        hint: 'Hard cap on any one holding.',
      },
      {
        paramKey: 'cashDeploymentTrigger',
        type: 'slider',
        label: 'Cash deployment trigger',
        min: 5,
        max: 40,
        step: 5,
        unit: '%',
        hint: 'Deploy cash once idle balance exceeds this.',
      },
      {
        paramKey: 'trimThreshold',
        type: 'slider',
        label: 'Trim threshold',
        min: 3,
        max: 20,
        step: 1,
        unit: '%',
        hint: 'Target trim back this far below the max position cap.',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function StrategyDimensions({ values, onChange, disabled }) {
  // First panel open by default; rest collapsed. Multiple can be open.
  const [openSet, setOpenSet] = useState(() => new Set([DIMENSION_CONFIGS[0].key]));

  function toggleOpen(key) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      {DIMENSION_CONFIGS.map((config) => (
        <DimensionPanel
          key={config.key}
          config={config}
          values={values[config.key] || {}}
          onParamChange={onChange}
          disabled={disabled}
          isOpen={openSet.has(config.key)}
          onToggleOpen={() => toggleOpen(config.key)}
        />
      ))}
    </div>
  );
}

