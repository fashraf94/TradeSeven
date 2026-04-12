// src/components/Forge/RuleModeBadge.jsx
// Small pill badge indicating whether a rule applies to CLASH, SEASON, or BOTH.
// BOTH uses a quieter ghost-outline style since it's the most common tag.

import React from 'react';
import { motion } from 'framer-motion';

const BADGE_STYLES = {
  clash: {
    background: 'rgba(0, 217, 255, 0.2)',
    color: '#00D9FF',
    border: 'none',
    label: 'CLASH',
  },
  season: {
    background: 'rgba(240, 199, 94, 0.2)',
    color: '#F0C75E',
    border: 'none',
    label: 'EXPERIMENT',
  },
  both: {
    background: 'transparent',
    color: '#8B949E',
    border: '1px solid #8B949E',
    label: 'BOTH',
  },
};

export default function RuleModeBadge({ mode = 'both' }) {
  const config = BADGE_STYLES[mode] || BADGE_STYLES.both;
  const { label, ...style } = config;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        lineHeight: 1,
        ...style,
      }}
    >
      {label || mode.toUpperCase()}
    </motion.span>
  );
}
