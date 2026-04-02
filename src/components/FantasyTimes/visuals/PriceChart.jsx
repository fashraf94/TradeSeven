// src/components/FantasyTimes/visuals/PriceChart.jsx
// Sentiment-aware area sparkline for Alex's price action stories.
// Phase 1: Synthetic sparkline shaped by percentChange + sentiment.
// Phase 2 (future): Annotated chart with keyLevel, triggerType, MA overlays.
// Phase 3 (future): Real OHLCV via historicalData in config.

import React, { useMemo, useId } from 'react';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const GREEN = '#10b981';
const RED = '#ef4444';
const NEUTRAL = '#64748b';

const CHART_WIDTHS = { micro: 120, compact: 280, hero: 600, expanded: 600 };

function buildSparkline(w, h, percentChange, isPositive, numPoints) {
  const pad = 4;
  const pts = [];
  const magnitude = Math.min(Math.abs(percentChange) / 5, 1);

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);

    // Base trend biased by direction
    const trendOffset = isPositive
      ? -(t * t * h * 0.5)      // curves upward (lower y = higher on screen)
      : (t * t * h * 0.5);       // curves downward

    // Organic noise — bell-shaped amplitude (more in middle, less at edges)
    const noiseAmp = h * 0.06 * Math.sin(t * Math.PI);
    const noise = Math.sin(i * 3.7 + percentChange) * noiseAmp
                + Math.cos(i * 2.3) * noiseAmp * 0.5;

    const base = h * 0.5;
    const magnitudeScale = 0.5 + magnitude * 0.5;
    const y = base + trendOffset * magnitudeScale + noise;

    pts.push({
      x: (t * w).toFixed(1),
      y: Math.max(pad, Math.min(h - pad, y)).toFixed(1),
    });
  }
  return pts;
}

export default function PriceChart({ config = {}, size = 'compact' }) {
  const gradientId = useId();

  const percentChange = config.percentChange ?? 0;
  const sentiment = config.sentiment || 'neutral';
  const isPositive = sentiment === 'bullish' || (sentiment !== 'bearish' && percentChange >= 0);
  const color = sentiment === 'neutral' || sentiment === 'mixed' ? NEUTRAL
    : isPositive ? GREEN : RED;

  const w = CHART_WIDTHS[size] || CHART_WIDTHS.compact;
  const h = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const numPoints = size === 'micro' ? 12 : size === 'compact' ? 20 : 30;

  const points = useMemo(
    () => buildSparkline(w, h, percentChange, isPositive, numPoints),
    [w, h, percentChange, isPositive, numPoints],
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  // Phase 2 preview: dashed key-level line if config provides one
  const hasKeyLevel = config.keyLevel != null;
  const keyLevelY = hasKeyLevel ? h * (isPositive ? 0.65 : 0.35) : null;

  const strokeWidth = size === 'micro' ? 1 : size === 'compact' ? 1.5 : 2;

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      aria-label={`${config.ticker || 'Stock'} price trend, ${isPositive ? 'up' : 'down'} ${Math.abs(percentChange).toFixed(1)}%`}
    >
      <defs>
        <linearGradient id={`pc-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#pc-fill-${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Phase 2: key level annotation */}
      {keyLevelY != null && (
        <>
          <line x1="0" y1={keyLevelY} x2={w} y2={keyLevelY}
            stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          {size !== 'micro' && config.keyLevelLabel && (
            <text x={w - 4} y={keyLevelY - 6} textAnchor="end"
              fill={color} fontSize="9" opacity="0.6" fontFamily="'SF Mono', monospace">
              {config.keyLevelLabel}
            </text>
          )}
        </>
      )}

      {/* Ticker label — compact and above */}
      {size !== 'micro' && config.ticker && (
        <text x="8" y="16" fill="#8b949e" fontSize="10" opacity="0.5"
          fontFamily="'SF Mono', monospace">
          {config.ticker}
        </text>
      )}
    </svg>
  );
}
