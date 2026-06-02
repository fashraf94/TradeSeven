// src/components/shared/AgentOrb.jsx
//
// The agent-identity motif for the Command Dashboard — a living presence rather
// than a solid sphere: a glowing core that breathes, with concentric rings that
// pulse outward from it. Tinted by the agent's color (primaryColor upstream,
// passed in as colors[0]). Pure gradient + framer-motion; no asset, no global
// keyframes. Rings expand only to the container edge, so it never overflows the
// layout it sits in.
//
// states: 'ready' (slow idle breathe) · 'reading' (faster pulse) · 'live'

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

  // Faster motion while the agent is "reading"; calm idle otherwise.
  const breath = live ? 1.8 : reading ? 2.0 : 3.6; // core breathe period (s)
  const ripple = live ? 1.5 : reading ? 1.9 : 3.4; // ring pulse period (s)
  const rings = [0, 1, 2];

  // Centering: inset:0 + margin:auto centers a fixed-size box in the container,
  // leaving framer-motion's transform free for scale (origin = center).
  const layer = (w) => ({
    position: 'absolute', inset: 0, margin: 'auto',
    width: w, height: w, borderRadius: '50%',
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      {/* Concentric rings pulsing outward from the core to the edge */}
      {rings.map((i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{ scale: [0.4, 1], opacity: [0.55, 0] }}
          transition={{ duration: ripple, repeat: Infinity, ease: 'easeOut', delay: i * (ripple / rings.length) }}
          style={{ ...layer(size), border: `1.5px solid ${hexToRgba(c1, 0.6)}` }}
        />
      ))}

      {/* Soft aura that breathes with the core */}
      <motion.div
        initial={false}
        animate={{ opacity: [0.22, 0.46, 0.22], scale: [0.9, 1.06, 0.9] }}
        transition={{ duration: breath, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          ...layer(size * 0.82),
          background: `radial-gradient(circle, ${hexToRgba(c1, 0.4)} 0%, ${hexToRgba(c2, 0.14)} 52%, transparent 72%)`,
          filter: `blur(${size * 0.07}px)`,
        }}
      />

      {/* Breathing, glowing core */}
      <motion.div
        initial={false}
        animate={{ scale: [1, 1.16, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: breath, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          ...layer(size * 0.42),
          background: `radial-gradient(circle at 38% 34%, #ffffff 0%, ${c1} 46%, ${c2} 100%)`,
          boxShadow: `0 0 ${size * 0.16}px ${hexToRgba(c1, 0.7)}, 0 0 ${size * 0.34}px ${hexToRgba(c1, 0.3)}`,
        }}
      />
    </div>
  );
}
