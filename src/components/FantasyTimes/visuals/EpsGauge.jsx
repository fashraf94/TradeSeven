// src/components/FantasyTimes/visuals/EpsGauge.jsx
// Doug's earnings visual — Recharts bar for EPS beat/miss or preview card.

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts';
import { DARK_TOKENS } from '../../../theme/tokens';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const GRAY = '#6e7681';
const GREEN = '#10b981';
const RED = '#ef4444';
const GOLD = '#FFD700';

export default function EpsGauge({ config, size }) {
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const quarters = config.quarters || [];
  const hasQuarters = quarters.length > 0 && quarters[0]?.epsActual != null;

  // Preview mode: simple consensus card
  if (!hasQuarters) {
    const consensus = config.consensus || {};
    const ariaLabel = `${config.ticker || ''} earnings preview`;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{
          height,
          width: '100%',
          background: 'rgba(255,215,0,0.06)',
          borderLeft: `3px solid ${GOLD}`,
          borderRadius: 8,
          padding: size === 'micro' ? '10px 12px' : '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
        role="img"
        aria-label={ariaLabel}
      >
        {size !== 'micro' && (
          <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Earnings Preview
          </div>
        )}
        <div style={{ color: '#e6edf3', fontSize: size === 'micro' ? 12 : 14, fontWeight: 600 }}>
          {config.ticker || 'Earnings'}
        </div>
        {size === 'expanded' && consensus.epsEstimate != null && (
          <div style={{ color: '#8b949e', fontSize: 12, marginTop: 6 }}>
            Consensus EPS: <span style={{ color: '#e6edf3', fontWeight: 600 }}>${consensus.epsEstimate}</span>
          </div>
        )}
      </motion.div>
    );
  }

  // Recap mode: bar chart
  const displayQuarters = size === 'micro' ? quarters.slice(0, 1) : quarters;

  const data = displayQuarters.map(q => ({
    label: q.label || 'Q',
    estimate: Number(q.epsEstimate) || 0,
    actual: Number(q.epsActual) || 0,
    outcome: q.outcome,
  }));

  const q0 = quarters[0] || {};
  const ariaLabel = `${config.ticker || ''} earnings: EPS ${q0.epsActual} vs estimate ${q0.epsEstimate}, ${q0.outcome}`;

  if (size === 'micro') {
    // Single bar pair, centered
    const d = data[0];
    if (!d) return null;
    const barColor = d.outcome === 'beat' ? GREEN : d.outcome === 'miss' ? RED : GRAY;

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
          <BarChart data={[d]} margin={{ top: 16, bottom: 16, left: 20, right: 20 }} barGap={-20}>
            <XAxis hide />
            <YAxis hide />
            <Bar dataKey="estimate" isAnimationActive={false} fill={GRAY} opacity={0.4} barSize={24} radius={[4, 4, 4, 4]} />
            <Bar dataKey="actual" isAnimationActive={false} barSize={24} radius={[4, 4, 4, 4]}>
              <Cell fill={barColor} />
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
          <BarChart data={data} margin={{ top: 16, bottom: 8, left: 16, right: 16 }} barGap={-16}>
            <XAxis hide />
            <YAxis hide />
            <Bar dataKey="estimate" isAnimationActive={false} fill={GRAY} opacity={0.4} barSize={20} radius={[4, 4, 4, 4]} />
            <Bar dataKey="actual" isAnimationActive={false} barSize={20} radius={[4, 4, 4, 4]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.outcome === 'beat' ? GREEN : d.outcome === 'miss' ? RED : GRAY} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    );
  }

  // Expanded: bars with labels
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
        <BarChart data={data} margin={{ top: 20, bottom: 24, left: 16, right: 16 }} barGap={-18}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: DARK_TOKENS.textFaint || '#64748b', fontSize: 11 }}
          />
          <YAxis hide />
          <Bar dataKey="estimate" isAnimationActive={false} fill={GRAY} opacity={0.4} barSize={22} radius={[4, 4, 4, 4]} />
          <Bar dataKey="actual" isAnimationActive={false} barSize={22} radius={[4, 4, 4, 4]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.outcome === 'beat' ? GREEN : d.outcome === 'miss' ? RED : GRAY} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
