// src/components/FantasyTimes/visuals/StatCard.jsx
// Neta's econ_preview visual — styled stat card for week-ahead previews.

import React from 'react';
import { motion } from 'framer-motion';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';

const AMBER = '#F59E0B';
const AMBER_BG = 'rgba(245,158,11,0.06)';

export default function StatCard({ config, size }) {
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;
  const { weekHighlight, totalEvents, highImpactCount } = config;

  const ariaLabel = `Economic preview: ${totalEvents || 0} events this week, ${highImpactCount || 0} high impact. ${weekHighlight || ''}`;

  const pillStyle = (bg) => ({
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  });

  if (size === 'micro') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{
          height,
          width: '100%',
          background: AMBER_BG,
          borderLeft: `3px solid ${AMBER}`,
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
        role="img"
        aria-label={ariaLabel}
      >
        <div style={{ color: '#e6edf3', fontSize: 12, fontWeight: 500 }}>
          {totalEvents || 0} events this week
        </div>
        <div style={{ color: AMBER, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
          {highImpactCount || 0} high impact
        </div>
      </motion.div>
    );
  }

  if (size === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        style={{
          height,
          width: '100%',
          background: AMBER_BG,
          borderLeft: `3px solid ${AMBER}`,
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
        role="img"
        aria-label={ariaLabel}
      >
        <div style={{
          color: '#e6edf3',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {weekHighlight || 'Economic week ahead'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <span style={{ ...pillStyle(), backgroundColor: 'rgba(255,255,255,0.06)', color: '#8b949e' }}>
            {totalEvents || 0} events
          </span>
          <span style={{ ...pillStyle(), backgroundColor: 'rgba(245,158,11,0.15)', color: AMBER }}>
            {highImpactCount || 0} high impact
          </span>
        </div>
      </motion.div>
    );
  }

  // Expanded
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
      style={{
        height,
        width: '100%',
        background: AMBER_BG,
        borderLeft: `3px solid ${AMBER}`,
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <div style={{
        color: AMBER,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        WEEK AHEAD
      </div>
      <div style={{
        color: '#e6edf3',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4,
        flex: 1,
        marginTop: 8,
      }}>
        {weekHighlight || 'Economic week ahead'}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <span style={{ ...pillStyle(), backgroundColor: 'rgba(255,255,255,0.06)', color: '#8b949e', padding: '4px 10px', fontSize: 12 }}>
          {totalEvents || 0} events
        </span>
        <span style={{ ...pillStyle(), backgroundColor: 'rgba(245,158,11,0.15)', color: AMBER, padding: '4px 10px', fontSize: 12 }}>
          {highImpactCount || 0} high impact
        </span>
      </div>
    </motion.div>
  );
}
