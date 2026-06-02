/* eslint-disable react-refresh/only-export-components -- shared command-bridge primitives: the obsidian tokens/helpers and the small label components are co-located here by design */
// src/components/Dashboard/commandUI.jsx
//
// Shared design language for the Command Dashboard "command bridge" — the
// obsidian palette, the mono label treatment, and the small label primitives,
// transcribed from the prototype (Command Dashboard.html / components.jsx) so
// the five stations read as one composed sequence rather than isolated blocks.
//
// The loop-home is dark-only by design; these obsidian values match
// DARK_TOKENS for bg/surface/raised, with the prototype's refined ink/hair.
// Per-user accent comes from agent.primaryColor (passed in); red stays reserved
// for downside via GainLossBadge only.

import React from 'react';

export const CMD = {
  bg: '#0D0E12',
  surface: '#15171E',
  raised: '#1C1A27',
  hair: 'rgba(255,255,255,0.07)',
  hair2: 'rgba(255,255,255,0.12)',
  ink: '#F4F5F8',
  ink2: '#9A9DAB',
  ink3: '#5E6170',
  teal: '#5EEAD4',
  gold: '#F0C75E',
  copper: '#E8927C',
  // Forge category colors (watchlist/rule-bundle accents)
  technical: '#5EEAD4',
  fundamental: '#F59E0B',
  risk: '#EF4444',
  allocation: '#8B5CF6',
};

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// hex (3 or 6 digit) + alpha → rgba; falls back to teal on bad input.
export function alpha(hex, a) {
  if (!hex || typeof hex !== 'string') return `rgba(94,234,212,${a})`;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(94,234,212,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Legible text color for a filled button of any agent hue.
export function readableOn(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return CMD.bg;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return CMD.bg;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? CMD.bg : '#FFFFFF';
}

export function Eyebrow({ children, color = CMD.ink3, style }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color, fontWeight: 500, ...style }}>
      {children}
    </div>
  );
}

export function Mono({ children, style }) {
  return <span style={{ fontFamily: MONO, ...style }}>{children}</span>;
}

// "01  READ · TODAY'S READ" with an optional right-aligned element (date, slot count).
export function SectionLabel({ n, label, color = CMD.ink3, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 11px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', color, fontWeight: 600 }}>{n}</span>
        <Eyebrow color={CMD.ink2}>{label}</Eyebrow>
      </div>
      {right}
    </div>
  );
}
