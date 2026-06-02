// src/components/shared/AgentOrb.jsx
//
// The agent-identity motif for the Command Dashboard — a living, breathing orb
// themed by the agent's avatarColors (the same [primary, secondary] palette
// AgentSidebar reads). Pure gradient + framer-motion (no asset, no dependency
// on global keyframes), so it drops in anywhere and respects the obsidian theme.
//
// states: 'ready' (calm breathe) · 'reading' (quicker shimmer) · 'live' (pulse)

import React from 'react';
import { motion } from 'framer-motion';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function AgentOrb({ colors = ['#5eead4', '#a855f7'], size = 76, state = 'ready' }) {
  const c1 = colors?.[0] || '#5eead4';
  const c2 = colors?.[1] || c1;
  const reading = state === 'reading';
  const live = state === 'live';
  const period = live ? 2.2 : reading ? 2.8 : 4.2; // seconds per breath

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      {/* Ambient glow halo */}
      <motion.div
        initial={false}
        animate={{ opacity: [0.32, 0.58, 0.32], scale: [1, 1.12, 1] }}
        transition={{ duration: period, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -size * 0.28, borderRadius: '50%',
          background: `radial-gradient(circle at 50% 50%, ${hexToRgba(c1, 0.45)} 0%, ${hexToRgba(c2, 0.18)} 45%, transparent 70%)`,
          filter: `blur(${Math.round(size * 0.18)}px)`,
          pointerEvents: 'none',
        }}
      />
      {/* Sphere */}
      <motion.div
        initial={false}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: period, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, ${c1} 30%, ${c2} 78%, #0a0b10 100%)`,
          boxShadow: `inset 0 ${size * 0.08}px ${size * 0.16}px rgba(255,255,255,0.22), inset 0 -${size * 0.1}px ${size * 0.2}px rgba(0,0,0,0.55), 0 0 ${size * 0.3}px ${hexToRgba(c1, 0.4)}`,
        }}
      />
      {/* Specular highlight */}
      <motion.div
        initial={false}
        animate={{ opacity: reading || live ? [0.5, 0.9, 0.5] : [0.4, 0.62, 0.4] }}
        transition={{ duration: period * 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '18%', left: '24%', width: '30%', height: '24%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)',
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
