// src/components/Forge/RadarChart.jsx
//
// Spider/radar chart rendered as inline SVG. Supports two modes:
//
//   mode="categories" (default)
//     Legacy Mech Bay / ForgeScreen visualization of equipped bundle
//     category weights. 8 hardcoded BaggerBomb axes. Static SVG with
//     useMemo optimization, teal #5EEAD4.
//
//   mode="dimensions"
//     New Season Entry / StrategyDimensions visualization of the 7
//     strategy dimensions (Risk, Entry, Exit, Sector, Momentum, Macro,
//     Sizing). Darker teal #0F6E56, larger label font, and a spring
//     animation on the polygon that morphs smoothly as the user moves
//     sliders or switches Trading Style presets.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// Axis definitions
// ─────────────────────────────────────────────────────────────

const CATEGORY_AXES = [
  { id: 'technical', label: 'TECH' },
  { id: 'fundamental', label: 'FUND' },
  { id: 'risk', label: 'RISK' },
  { id: 'allocation', label: 'ALLOC' },
  { id: 'mid_battle', label: 'TRADE' },
  { id: 'game_state', label: 'GAME' },
  { id: 'threshold', label: 'THRESH' },
  { id: 'tier_strategy', label: 'TIER' },
];

const DIMENSION_AXES = [
  { id: 'riskPosture', label: 'Risk' },
  { id: 'entryAggression', label: 'Entry' },
  { id: 'exitDiscipline', label: 'Exit' },
  { id: 'sectorStrategy', label: 'Sector' },
  { id: 'momentumSensitivity', label: 'Momentum' },
  { id: 'eventRisk', label: 'Events' },
  { id: 'positionSizing', label: 'Sizing' },
];

const TEAL_CATEGORIES = '#5EEAD4';
const TEAL_DIMENSIONS = '#0F6E56';

const SPRING = { type: 'spring', stiffness: 300, damping: 25 };

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

// ─────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────

export default function RadarChart({
  mode = 'categories',
  weights = {},
  dimensions = null,
  size,
}) {
  if (mode === 'dimensions') {
    return <DimensionsRadar dimensions={dimensions || {}} size={size ?? 220} />;
  }
  return <CategoriesRadar weights={weights} size={size ?? 80} />;
}

// ─────────────────────────────────────────────────────────────
// Categories mode (existing behavior, untouched)
// ─────────────────────────────────────────────────────────────

function CategoriesRadar({ weights, size }) {
  const showLabels = size >= 140;
  const center = size / 2;
  const radius = showLabels ? size / 2 - 24 : size / 2 - 8;
  const labelOffset = radius + 14;

  const points = useMemo(() => {
    return CATEGORY_AXES.map((axis, i) => {
      const angle = (Math.PI * 2 * i) / CATEGORY_AXES.length - Math.PI / 2;
      const value = clamp(weights[axis.id] || 0, 0, 1);
      return {
        ...axis,
        angle,
        ox: center + radius * Math.cos(angle),
        oy: center + radius * Math.sin(angle),
        vx: center + radius * Math.max(value, 0.05) * Math.cos(angle),
        vy: center + radius * Math.max(value, 0.05) * Math.sin(angle),
        lx: center + labelOffset * Math.cos(angle),
        ly: center + labelOffset * Math.sin(angle),
      };
    });
  }, [weights, center, radius, labelOffset]);

  const polygonPoints = points.map((p) => `${p.vx},${p.vy}`).join(' ');
  const hasData = Object.values(weights).some((v) => v > 0);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={TEAL_CATEGORIES}
        strokeWidth="1"
        strokeDasharray="3 3"
        fill="none"
        opacity="0.2"
      />
      <circle cx={center} cy={center} r={radius * 0.66} stroke={TEAL_CATEGORIES} strokeWidth="0.5" fill="none" opacity="0.1" />
      <circle cx={center} cy={center} r={radius * 0.33} stroke={TEAL_CATEGORIES} strokeWidth="0.5" fill="none" opacity="0.1" />

      {points.map((p, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={p.ox}
          y2={p.oy}
          stroke={TEAL_CATEGORIES}
          strokeWidth="0.5"
          opacity="0.15"
        />
      ))}

      {hasData && (
        <polygon
          points={polygonPoints}
          fill="rgba(94,234,212,0.2)"
          stroke={TEAL_CATEGORIES}
          strokeWidth="1.5"
        />
      )}

      {hasData && points.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p.vx}
          cy={p.vy}
          r="2"
          fill={TEAL_CATEGORIES}
          opacity={(weights[p.id] || 0) > 0 ? 0.9 : 0.2}
        />
      ))}

      {showLabels && points.map((p, i) => (
        <text
          key={`label-${i}`}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#718096"
          fontSize="7"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="0.5"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Dimensions mode (new — Strategy Dimensions)
// ─────────────────────────────────────────────────────────────

function computeTargets(dimensions) {
  return DIMENSION_AXES.map((axis) => clamp(dimensions?.[axis.id] ?? 0, 0.05, 1));
}

function DimensionsRadar({ dimensions, size }) {
  const reducedMotion = useReducedMotion();
  const center = size / 2;
  const radius = size / 2 - 30;
  const labelOffset = radius + 16;

  // Serialize target values so object-reference churn from the parent
  // doesn't needlessly restart the animation.
  const targetKey = useMemo(
    () =>
      DIMENSION_AXES.map((a) =>
        Math.round((dimensions?.[a.id] ?? 0) * 1000)
      ).join(','),
    [dimensions]
  );

  const [values, setValues] = useState(() => computeTargets(dimensions));
  const currentRef = useRef(values);

  useEffect(() => {
    const target = computeTargets(dimensions);

    if (reducedMotion) {
      currentRef.current = target;
      setValues(target);
      return undefined;
    }

    const start = [...currentRef.current];
    const controls = animate(0, 1, {
      ...SPRING,
      onUpdate: (t) => {
        const next = start.map((s, i) => s + (target[i] - s) * t);
        currentRef.current = next;
        setValues(next);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, reducedMotion]);

  const geometry = useMemo(() => {
    return DIMENSION_AXES.map((axis, i) => {
      const angle = (Math.PI * 2 * i) / DIMENSION_AXES.length - Math.PI / 2;
      const v = values[i] ?? 0.05;
      return {
        ...axis,
        angle,
        ox: center + radius * Math.cos(angle),
        oy: center + radius * Math.sin(angle),
        vx: center + radius * v * Math.cos(angle),
        vy: center + radius * v * Math.sin(angle),
        lx: center + labelOffset * Math.cos(angle),
        ly: center + labelOffset * Math.sin(angle),
      };
    });
  }, [values, center, radius, labelOffset]);

  const polygonPoints = geometry.map((p) => `${p.vx},${p.vy}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      {/* Guide rings at 33 / 66 / 100% */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={TEAL_DIMENSIONS}
        strokeWidth="1"
        fill="none"
        opacity="0.35"
      />
      <circle
        cx={center}
        cy={center}
        r={radius * 0.66}
        stroke={TEAL_DIMENSIONS}
        strokeWidth="0.5"
        fill="none"
        opacity="0.22"
      />
      <circle
        cx={center}
        cy={center}
        r={radius * 0.33}
        stroke={TEAL_DIMENSIONS}
        strokeWidth="0.5"
        fill="none"
        opacity="0.12"
      />

      {/* Axis lines */}
      {geometry.map((p, i) => (
        <line
          key={`axis-${i}`}
          x1={center}
          y1={center}
          x2={p.ox}
          y2={p.oy}
          stroke={TEAL_DIMENSIONS}
          strokeWidth="0.5"
          opacity="0.2"
        />
      ))}

      {/* Value polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(15,110,86,0.15)"
        stroke={TEAL_DIMENSIONS}
        strokeWidth="1.5"
      />

      {/* Value dots */}
      {geometry.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p.vx}
          cy={p.vy}
          r="2.5"
          fill={TEAL_DIMENSIONS}
          opacity="0.9"
        />
      ))}

      {/* Axis labels */}
      {geometry.map((p, i) => (
        <text
          key={`label-${i}`}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#8B949E"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="0.3"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
