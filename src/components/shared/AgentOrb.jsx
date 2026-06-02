// src/components/shared/AgentOrb.jsx
//
// The agent-identity Orb — a living state element, ported from the Command
// Dashboard prototype (components.jsx). Structure: an outer glow, a rotating
// masked conic-gradient ring, a counter-rotating inner ring, and a luminous
// core, with a gentle breathing pulse on the whole. CSS gradients + masks for
// the ring structure; framer-motion drives the rotation and the pulse (so no
// global keyframes are needed). Tinted by the agent's color.
//
// states: 'ready' (slow) · 'reading' (faster) · 'live' (most intense)

import React from 'react';
import { motion } from 'framer-motion';

function alpha(hex, a) {
  if (!hex || typeof hex !== 'string') return `rgba(94,234,212,${a})`;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(94,234,212,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Mask that keeps only a thin ring at the outer edge of a padded gradient box.
const ringMask = (outer, inner) =>
  `radial-gradient(farthest-side, transparent calc(100% - ${outer}px), #000 calc(100% - ${inner}px))`;

export default function AgentOrb({ colors, color, size = 56, state = 'ready' }) {
  const hue = state === 'review' ? '#F0C75E' : (color || colors?.[0] || '#5EEAD4');
  const live = state === 'live';
  const reading = state === 'reading';
  const intensity = live ? 0.7 : reading ? 0.5 : 0.34;

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: live ? 2.2 : 3.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
    >
      {/* outer glow */}
      <div style={{
        position: 'absolute', inset: -size * 0.28, borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(hue, intensity)} 0%, transparent 68%)`,
        filter: 'blur(2px)', pointerEvents: 'none',
      }} />

      {/* rotating ring */}
      <motion.div
        initial={false}
        animate={{ rotate: 360 }}
        transition={{ duration: live ? 4 : reading ? 7 : 14, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', padding: Math.max(2, size * 0.05),
          background: `conic-gradient(from 0deg, ${alpha(hue, 0)}, ${alpha(hue, 0.95)}, ${alpha(hue, 0)} 55%, ${alpha(hue, 0)})`,
          WebkitMask: ringMask(2.5, 2), mask: ringMask(2.5, 2),
        }}
      />

      {/* counter-rotating inner ring */}
      <motion.div
        initial={false}
        animate={{ rotate: -360 }}
        transition={{ duration: live ? 6 : 10, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: size * 0.16, borderRadius: '50%', padding: Math.max(1.5, size * 0.03),
          background: `conic-gradient(from 180deg, ${alpha(hue, 0)}, ${alpha(hue, 0.6)}, ${alpha(hue, 0)} 40%)`,
          WebkitMask: ringMask(2, 1.5), mask: ringMask(2, 1.5),
        }}
      />

      {/* luminous core */}
      <div style={{
        position: 'absolute', inset: size * 0.26, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${alpha(hue, 0.95)}, ${alpha(hue, 0.22)} 70%, ${alpha(hue, 0.08)})`,
        boxShadow: `inset 0 0 ${size * 0.12}px ${alpha(hue, 0.5)}`,
      }} />
    </motion.div>
  );
}
