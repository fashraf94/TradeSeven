// src/components/Season/SeasonPerformanceChart.jsx
//
// Dual-line area chart (portfolio vs SPY) for the Season Dashboard
// Overview tab. Pure SVG with a responsive viewBox — matches the project
// sparkline convention (see MoverSparkline.jsx). No external chart library.
//
// Visual:
//   - Portfolio cumulative return (%)  — trophy-gold line, 2px
//   - S&P 500 cumulative return (%)    — muted gray dashed line, 1.5px
//   - Area between the two lines shaded green where portfolio > SPY,
//     red where portfolio < SPY. Computed by splitting at each zero
//     crossing so the sign flips cleanly.
//   - Zero line, X-axis day ticks every 5 days, Y-axis min/0/max labels
//   - Lines animate in via framer-motion pathLength on mount (1.2s ease-out)
//
// Props:
//   dailySnapshots  - array from entry.dailySnapshots (uses day,
//                     portfolioReturn, spyReturn fields)
//   onExpand        - optional callback; wraps the chart in a clickable
//                     container when present (tap-to-expand, future)

import React, { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TROPHY_GOLD = '#F0C75E';
const SPY_COLOR = '#8B949E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';

// ─── SVG dimensions ─────────────────────────────────────────
// viewBox is fixed; the svg element scales to 100% of its container
// via width="100%" + preserveAspectRatio="none" (height kept fixed via
// the wrapper for layout stability).
const VIEW_W = 600;
const VIEW_H = 200;
const PAD = { top: 14, right: 14, bottom: 30, left: 42 };
const CHART_W = VIEW_W - PAD.left - PAD.right;
const CHART_H = VIEW_H - PAD.top - PAD.bottom;

// ─── Scale helpers ──────────────────────────────────────────

function computeYDomain(data) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of data) {
    if (Number.isFinite(d.portfolio)) {
      if (d.portfolio < lo) lo = d.portfolio;
      if (d.portfolio > hi) hi = d.portfolio;
    }
    if (Number.isFinite(d.spy)) {
      if (d.spy < lo) lo = d.spy;
      if (d.spy > hi) hi = d.spy;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];

  // Always include zero so the baseline is meaningful
  if (lo > 0) lo = 0;
  if (hi < 0) hi = 0;

  // Ensure a minimum range so tiny movements don't look exaggerated
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }

  // Add 10% headroom on each side
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

function makeXScale(n) {
  // Map index [0..n-1] linearly to [PAD.left, PAD.left + CHART_W]
  if (n <= 1) return () => PAD.left;
  return (i) => PAD.left + (i / (n - 1)) * CHART_W;
}

function makeYScale([lo, hi]) {
  // Map value [lo..hi] to pixel space (inverted so higher value = lower y)
  const range = hi - lo || 1;
  return (v) => PAD.top + (1 - (v - lo) / range) * CHART_H;
}

// ─── Path builders ──────────────────────────────────────────

function buildLinePath(data, xOf, yOf, field) {
  if (data.length === 0) return '';
  const pts = data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d[field]).toFixed(1)}`);
  return `M${pts.join(' L')}`;
}

// Split data into contiguous segments where (portfolio - spy) keeps its
// sign. Returns an array of { sign, path } where path is a closed polygon
// tracing the top line forward and the bottom line backward.
function buildAreaSegments(data, xOf, yOf) {
  if (data.length < 2) return [];

  const segments = [];
  let current = null;

  const signOf = (d) => (d.portfolio - d.spy >= 0 ? 1 : -1);

  const pushPoint = (seg, x, pTopY, pBotY) => {
    seg.points.push({ x, pTopY, pBotY });
  };

  const startSeg = (sign, x, pTopY, pBotY) => {
    current = { sign, points: [] };
    pushPoint(current, x, pTopY, pBotY);
  };

  // Seed with the first point
  const first = data[0];
  startSeg(signOf(first), xOf(0), yOf(first.portfolio), yOf(first.spy));

  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];
    const d1 = p1.portfolio - p1.spy;
    const d2 = p2.portfolio - p2.spy;
    const s1 = d1 >= 0 ? 1 : -1;
    const s2 = d2 >= 0 ? 1 : -1;

    const x2 = xOf(i + 1);
    const topY2 = yOf(p2.portfolio);
    const botY2 = yOf(p2.spy);

    if (s1 === s2) {
      pushPoint(current, x2, topY2, botY2);
      continue;
    }

    // Zero crossing between i and i+1. Find t in [0,1] where
    // (1-t)*d1 + t*d2 = 0 → t = d1 / (d1 - d2)
    const denom = d1 - d2;
    const t = denom === 0 ? 0.5 : d1 / denom;
    const x1 = xOf(i);
    const crossX = x1 + t * (x2 - x1);
    // At the crossing, portfolio == spy → both y values coincide
    const crossPortfolio = p1.portfolio + t * (p2.portfolio - p1.portfolio);
    const crossY = yOf(crossPortfolio);

    pushPoint(current, crossX, crossY, crossY);
    segments.push(current);
    startSeg(s2, crossX, crossY, crossY);
    pushPoint(current, x2, topY2, botY2);
  }

  segments.push(current);

  return segments
    .filter((seg) => seg.points.length >= 2)
    .map((seg) => {
      const top = seg.points.map((p) => `${p.x.toFixed(1)},${p.pTopY.toFixed(1)}`).join(' L');
      const bot = [...seg.points]
        .reverse()
        .map((p) => `${p.x.toFixed(1)},${p.pBotY.toFixed(1)}`)
        .join(' L');
      return { sign: seg.sign, path: `M${top} L${bot} Z` };
    });
}

// ─── Main component ─────────────────────────────────────────

export default function SeasonPerformanceChart({ dailySnapshots, onExpand }) {
  const clipId = useId();

  const data = useMemo(() => {
    if (!Array.isArray(dailySnapshots)) return [];
    return dailySnapshots
      .filter((s) => typeof s?.day === 'number')
      .map((s) => ({
        day: s.day,
        portfolio: Number.isFinite(s.portfolioReturn) ? s.portfolioReturn : 0,
        spy: Number.isFinite(s.spyReturn) ? s.spyReturn : 0,
      }));
  }, [dailySnapshots]);

  // Empty state — need at least 2 points to draw a line
  if (data.length < 2) {
    return (
      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
          color: HOLO_COLORS.textMuted,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Performance chart will appear after Day 1 evaluation.
      </div>
    );
  }

  const [yLo, yHi] = computeYDomain(data);
  const xOf = makeXScale(data.length);
  const yOf = makeYScale([yLo, yHi]);

  const portfolioPath = buildLinePath(data, xOf, yOf, 'portfolio');
  const spyPath = buildLinePath(data, xOf, yOf, 'spy');
  const areaSegments = buildAreaSegments(data, xOf, yOf);

  const zeroY = yOf(0);

  // Y-axis ticks: min, 0, max (only include 0 if it's inside the domain)
  const yTicks = [];
  yTicks.push({ value: yHi, y: yOf(yHi) });
  if (yLo < 0 && yHi > 0) yTicks.push({ value: 0, y: zeroY });
  yTicks.push({ value: yLo, y: yOf(yLo) });

  // X-axis ticks — days 1, 5, 10, 15, 20 that are within the data range
  const maxDay = data[data.length - 1].day;
  const xTickDays = [1, 5, 10, 15, 20].filter((d) => d <= maxDay);
  const xTicks = xTickDays.map((d) => {
    const idx = data.findIndex((p) => p.day === d);
    if (idx === -1) return null;
    return { day: d, x: xOf(idx) };
  }).filter(Boolean);

  const svg = (
    <svg
      width="100%"
      height={VIEW_H}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Portfolio vs S&P 500 performance chart"
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`chart-clip-${clipId}`}>
          <rect x={PAD.left} y={PAD.top} width={CHART_W} height={CHART_H} />
        </clipPath>
      </defs>

      {/* Plot background */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={CHART_W}
        height={CHART_H}
        fill="transparent"
      />

      {/* Y-axis gridlines + labels */}
      {yTicks.map((tick, i) => (
        <g key={`y-${i}`}>
          <line
            x1={PAD.left}
            x2={PAD.left + CHART_W}
            y1={tick.y}
            y2={tick.y}
            stroke={tick.value === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={1}
            strokeDasharray={tick.value === 0 ? '4 4' : undefined}
          />
          <text
            x={PAD.left - 6}
            y={tick.y + 3}
            fill={HOLO_COLORS.textMuted}
            fontSize={10}
            textAnchor="end"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {`${tick.value >= 0 ? '+' : ''}${tick.value.toFixed(1)}%`}
          </text>
        </g>
      ))}

      {/* X-axis day labels */}
      {xTicks.map((tick, i) => (
        <text
          key={`x-${i}`}
          x={tick.x}
          y={PAD.top + CHART_H + 18}
          fill={HOLO_COLORS.textMuted}
          fontSize={10}
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Day {tick.day}
        </text>
      ))}

      {/* Shaded area segments */}
      <g clipPath={`url(#chart-clip-${clipId})`}>
        {areaSegments.map((seg, i) => (
          <motion.path
            key={`area-${i}`}
            d={seg.path}
            fill={seg.sign > 0 ? POSITIVE : NEGATIVE}
            fillOpacity={seg.sign > 0 ? 0.15 : 0.12}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          />
        ))}
      </g>

      {/* SPY line (dashed, under portfolio) */}
      <motion.path
        d={spyPath}
        fill="none"
        stroke={SPY_COLOR}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Portfolio line (solid gold, on top) */}
      <motion.path
        d={portfolioPath}
        fill="none"
        stroke={TROPHY_GOLD}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );

  return (
    <div
      onClick={onExpand}
      role={onExpand ? 'button' : undefined}
      tabIndex={onExpand ? 0 : undefined}
      onKeyDown={(e) => {
        if (onExpand && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onExpand();
        }
      }}
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        padding: '14px 12px 10px',
        cursor: onExpand ? 'pointer' : 'default',
      }}
    >
      {/* Header row: title + legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px 10px',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: HOLO_COLORS.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Portfolio vs S&P 500
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <LegendDot color={TROPHY_GOLD} label="Portfolio" />
          <LegendDot color={SPY_COLOR} label="S&P" dashed />
        </div>
      </div>

      {svg}
    </div>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width={14} height={4} viewBox="0 0 14 4" style={{ display: 'block' }}>
        <line
          x1="0"
          y1="2"
          x2="14"
          y2="2"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '3 2' : undefined}
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 10, color: HOLO_COLORS.textMuted, letterSpacing: '0.3px' }}>
        {label}
      </span>
    </div>
  );
}

SeasonPerformanceChart.displayName = 'SeasonPerformanceChart';
