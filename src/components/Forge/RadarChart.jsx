// src/components/Forge/RadarChart.jsx
// Category weight spider chart rendered as inline SVG for equipped bundle visualization.

import React, { useMemo } from 'react';

const AXES = [
  { id: 'technical', label: 'TECH' },
  { id: 'fundamental', label: 'FUND' },
  { id: 'risk', label: 'RISK' },
  { id: 'allocation', label: 'ALLOC' },
  { id: 'mid_battle', label: 'TRADE' },
  { id: 'game_state', label: 'GAME' },
  { id: 'threshold', label: 'THRESH' },
  { id: 'tier_strategy', label: 'TIER' },
];

const TEAL = '#5EEAD4';

export default function RadarChart({ weights = {}, size = 80 }) {
  const showLabels = size >= 140;
  const center = size / 2;
  const radius = showLabels ? size / 2 - 24 : size / 2 - 8;
  const labelOffset = radius + 14;

  const points = useMemo(() => {
    return AXES.map((axis, i) => {
      const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
      const value = Math.min(Math.max(weights[axis.id] || 0, 0), 1);
      return {
        ...axis,
        angle,
        // Outer ring point
        ox: center + radius * Math.cos(angle),
        oy: center + radius * Math.sin(angle),
        // Value point (minimum 10% so empty categories still show a small polygon)
        vx: center + radius * Math.max(value, 0.05) * Math.cos(angle),
        vy: center + radius * Math.max(value, 0.05) * Math.sin(angle),
        // Label point
        lx: center + labelOffset * Math.cos(angle),
        ly: center + labelOffset * Math.sin(angle),
      };
    });
  }, [weights, center, radius, labelOffset]);

  const polygonPoints = points.map(p => `${p.vx},${p.vy}`).join(' ');
  const hasData = Object.values(weights).some(v => v > 0);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      {/* Outer dashed ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={TEAL}
        strokeWidth="1"
        strokeDasharray="3 3"
        fill="none"
        opacity="0.2"
      />

      {/* Inner guide rings */}
      <circle cx={center} cy={center} r={radius * 0.66} stroke={TEAL} strokeWidth="0.5" fill="none" opacity="0.1" />
      <circle cx={center} cy={center} r={radius * 0.33} stroke={TEAL} strokeWidth="0.5" fill="none" opacity="0.1" />

      {/* Axis lines */}
      {points.map((p, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={p.ox}
          y2={p.oy}
          stroke={TEAL}
          strokeWidth="0.5"
          opacity="0.15"
        />
      ))}

      {/* Value polygon */}
      {hasData && (
        <polygon
          points={polygonPoints}
          fill={`rgba(94,234,212,0.2)`}
          stroke={TEAL}
          strokeWidth="1.5"
        />
      )}

      {/* Value dots */}
      {hasData && points.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p.vx}
          cy={p.vy}
          r="2"
          fill={TEAL}
          opacity={(weights[p.id] || 0) > 0 ? 0.9 : 0.2}
        />
      ))}

      {/* Axis labels (desktop only) */}
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
