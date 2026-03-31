// src/components/FantasyTimes/visuals/MoverSparkline.jsx
// Lightweight SVG sparkline for mover ticker cards (60×24 default).

import React, { useId } from 'react';

const GREEN = '#10b981';
const RED = '#ef4444';

// Generate a synthetic 12-point trend line biased up or down
function buildPath(w, h, isPositive) {
  const pts = 12;
  const stepX = w / (pts - 1);
  const pad = 4;
  const range = h - pad * 2;

  const points = [];
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1);
    const trend = isPositive ? t * range * 0.6 : (1 - t) * range * 0.6;
    const noise = Math.sin(i * 2.3 + 1.7) * range * 0.15;
    const y = h - pad - trend - noise;
    points.push(`${(i * stepX).toFixed(1)},${Math.max(pad, Math.min(h - pad, y)).toFixed(1)}`);
  }

  return `M${points.join(' L')}`;
}

export default function MoverSparkline({ isPositive = true, width = 60, height = 24, responsive = false }) {
  const id = useId();
  const color = isPositive ? GREEN : RED;
  const linePath = buildPath(width, height, isPositive);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={responsive ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? 'none' : undefined}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id={`spark-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-fill-${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
