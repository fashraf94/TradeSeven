// src/components/FantasyTimes/visuals/ComparisonBar.jsx
// Neta's econ_recap visual — pure inline SVG showing Expected vs Actual.

import React from 'react';
import { motion } from 'framer-motion';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const GRAY = '#6e7681';
const GREEN = '#10b981';
const RED = '#ef4444';

export default function ComparisonBar({ config, size }) {
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const actual = Number(config.actual);
  const expected = Number(config.expected);

  // If data is missing or non-numeric, render nothing
  if (isNaN(actual) || isNaN(expected) || expected === 0) return null;

  const isBeat = actual >= expected;
  const actualColor = isBeat ? GREEN : RED;
  const ratio = Math.min(actual / expected, 2); // cap at 2x for display
  const delta = actual - expected;
  const deltaStr = `${delta >= 0 ? '+' : ''}${typeof config.actual === 'string' ? delta : delta.toFixed(2)}${config.unit || ''}`;

  const ariaLabel = `${config.label}: Actual ${config.actual} vs Expected ${config.expected}`;

  if (size === 'micro') {
    // Bars only, no text
    const w = 200;
    const h = 40;
    const barH = 12;
    const barY = (h - barH) / 2;
    const maxBarW = w - 20;
    const expectedW = maxBarW;
    const actualW = Math.max(4, maxBarW * Math.min(ratio, 1.5));
    const barX = 10;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        role="img"
        aria-label={ariaLabel}
      >
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect x={barX} y={barY} width={expectedW} height={barH} rx={4} fill={GRAY} opacity={0.4} />
          <rect x={barX} y={barY} width={actualW} height={barH} rx={4} fill={actualColor} />
        </svg>
      </motion.div>
    );
  }

  if (size === 'compact') {
    const w = 300;
    const h = 60;
    const barH = 16;
    const barY = (h - barH) / 2;
    const maxBarW = w - 80;
    const expectedW = maxBarW;
    const actualW = Math.max(4, maxBarW * Math.min(ratio, 1.5));
    const barX = 10;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        role="img"
        aria-label={ariaLabel}
      >
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect x={barX} y={barY} width={expectedW} height={barH} rx={4} fill={GRAY} opacity={0.4} />
          <rect x={barX} y={barY} width={actualW} height={barH} rx={4} fill={actualColor} />
          <text
            x={barX + maxBarW + 10}
            y={h / 2}
            fill={actualColor}
            fontSize={12}
            fontWeight={700}
            dominantBaseline="middle"
            fontFamily="monospace"
          >
            {deltaStr}
          </text>
        </svg>
      </motion.div>
    );
  }

  // Expanded
  const w = 400;
  const h = 100;
  const barH = 20;
  const barY1 = 36;
  const maxBarW = w - 100;
  const expectedW = maxBarW;
  const actualW = Math.max(4, maxBarW * Math.min(ratio, 1.5));
  const barX = 10;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
      style={{ height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Event name */}
        <text x={barX} y={16} fill="#8b949e" fontSize={11} fontFamily="sans-serif">
          {config.label}
        </text>

        {/* Expected bar */}
        <rect x={barX} y={barY1} width={expectedW} height={barH} rx={4} fill={GRAY} opacity={0.4} />
        {/* Actual bar overlapping */}
        <rect x={barX} y={barY1} width={actualW} height={barH} rx={4} fill={actualColor} />

        {/* Delta label */}
        <text
          x={barX + maxBarW + 10}
          y={barY1 + barH / 2}
          fill={actualColor}
          fontSize={13}
          fontWeight={700}
          dominantBaseline="middle"
          fontFamily="monospace"
        >
          {deltaStr}
        </text>

        {/* Legend */}
        <rect x={barX} y={barY1 + barH + 12} width={10} height={10} rx={2} fill={GRAY} opacity={0.5} />
        <text x={barX + 14} y={barY1 + barH + 21} fill="#8b949e" fontSize={10} dominantBaseline="middle">
          Expected
        </text>
        <rect x={barX + 80} y={barY1 + barH + 12} width={10} height={10} rx={2} fill={actualColor} />
        <text x={barX + 94} y={barY1 + barH + 21} fill="#8b949e" fontSize={10} dominantBaseline="middle">
          Actual
        </text>
      </svg>
    </motion.div>
  );
}
