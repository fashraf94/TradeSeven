// src/components/FantasyTimes/visuals/MarketBar.jsx
// Kai's market index bars — Recharts vertical BarChart for SPY/QQQ/DIA.

import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, ResponsiveContainer, LabelList,
} from 'recharts';
import { DARK_TOKENS } from '../../../theme/tokens';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const GREEN = '#10b981';
const RED = '#ef4444';

export default function MarketBar({ config, size }) {
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const indices = config.indices || [];
  if (indices.length === 0) return null;

  const data = indices.map(d => ({
    symbol: d.symbol,
    pctChange: Number(d.pctChange) || 0,
  }));

  const ariaLabel = `Market indices: ${data.map(d => `${d.symbol} ${d.pctChange >= 0 ? '+' : ''}${d.pctChange.toFixed(2)}%`).join(', ')}`;

  // Custom label renderer for compact/expanded
  const renderLabel = (props) => {
    const { x, y, width, height: barH, value } = props;
    if (value === undefined || value === null) return null;
    const sign = value >= 0 ? '+' : '';
    return (
      <text
        x={x + width + 6}
        y={y + barH / 2}
        fill="#e6edf3"
        fontSize={11}
        fontWeight={600}
        dominantBaseline="middle"
      >
        {sign}{value.toFixed(2)}%
      </text>
    );
  };

  if (size === 'micro') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{ height, width: '100%' }}
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, bottom: 8, left: 0, right: 0 }}
            barSize={8}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="symbol" hide />
            <Bar dataKey="pctChange" isAnimationActive={false} radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.pctChange >= 0 ? GREEN : RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    );
  }

  if (size === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{ height, width: '100%' }}
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, bottom: 8, left: 0, right: 50 }}
            barSize={14}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="symbol" hide />
            <Bar
              dataKey="pctChange"
              isAnimationActive={false}
              radius={[0, 4, 4, 0]}
              background={{ fill: DARK_TOKENS.bgCard }}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.pctChange >= 0 ? GREEN : RED} />
              ))}
              <LabelList dataKey="pctChange" content={renderLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    );
  }

  // Expanded
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
      style={{ height, width: '100%' }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 12, bottom: 12, left: 40, right: 55 }}
          barSize={20}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="symbol"
            axisLine={false}
            tickLine={false}
            tick={{ fill: DARK_TOKENS.textMuted || '#94a3b8', fontSize: 12, fontWeight: 600 }}
            width={36}
          />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <Bar
            dataKey="pctChange"
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            background={{ fill: DARK_TOKENS.bgCard }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.pctChange >= 0 ? GREEN : RED} />
            ))}
            <LabelList dataKey="pctChange" content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
