// src/components/League/draft/draftPrimitives.jsx
//
// Small presentational primitives for the League draft board — ported from the
// design (components.jsx + draft-parts.jsx). Typography uses the scope's CSS
// vars (--ld-mono / --ld-ui), set on the board's root container.

import React from 'react';
import { TOKENS, DX, alpha, fitColor } from './draftTokens';
import { Icon } from './draftIcons';
import { archMeta } from './boardModel';

export function Mono({ children, style }) {
  return <span style={{ fontFamily: 'var(--ld-mono)', ...style }}>{children}</span>;
}

export function Eyebrow({ children, color = TOKENS.ink3, style }) {
  return (
    <div style={{ fontFamily: 'var(--ld-mono)', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color, fontWeight: 500, ...style }}>
      {children}
    </div>
  );
}

export function SectorTag({ sector }) {
  return (
    <span style={{ fontFamily: 'var(--ld-mono)', fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.ink3, background: TOKENS.bg, border: `1px solid ${TOKENS.hair}`, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
      {sector}
    </span>
  );
}

export function ReturnPct({ v, size = 11 }) {
  if (v == null) return <Mono style={{ fontSize: size, color: TOKENS.ink3 }}>—</Mono>;
  const up = v >= 0;
  return <Mono style={{ fontSize: size, color: up ? DX.pos : DX.neg, fontWeight: 600 }}>{up ? '+' : ''}{v.toFixed(1)}%</Mono>;
}

// fit meter — the ADP signal. A teal track + the big number.
export function FitBar({ fit, tier, w = 110 }) {
  const c = fitColor(tier);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 5, borderRadius: 5, background: TOKENS.bg, overflow: 'hidden', width: w }}>
          <div style={{ width: `${Math.max(0, Math.min(100, fit))}%`, height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${alpha(c, 0.55)}, ${c})` }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, width: 44, justifyContent: 'flex-end' }}>
        <Mono style={{ fontSize: 19, fontWeight: 700, color: c, lineHeight: 1, letterSpacing: '-0.02em' }}>{fit}</Mono>
        <Mono style={{ fontSize: 9, color: TOKENS.ink3 }}>fit</Mono>
      </div>
    </div>
  );
}

// the color-shifting pick clock
export function ClockRing({ seconds, total = 20, size = 84 }) {
  const sec = seconds == null ? 0 : seconds;
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, sec) / total;
  const low = sec <= 5, mid = sec <= 10;
  const c = low ? DX.neg : mid ? DX.gold : DX.you;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, animation: low ? 'ldOrbPulse 0.9s ease-in-out infinite' : 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TOKENS.hair} strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Mono style={{ fontSize: size * 0.34, fontWeight: 700, color: c, lineHeight: 1 }}>{Math.max(0, sec)}</Mono>
        <Mono style={{ fontSize: 8.5, letterSpacing: '0.18em', color: TOKENS.ink3, marginTop: 2 }}>SEC</Mono>
      </div>
    </div>
  );
}

// the agent Orb — a living state element, CSS-only motion.
export function Orb({ state = 'ready', size = 38, color = DX.you }) {
  const hue = color;
  const live = state === 'live';
  const reading = state === 'reading';
  const intensity = live ? 0.7 : reading ? 0.5 : 0.34;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, animation: `ldOrbPulse ${live ? 2.2 : 3.4}s ease-in-out infinite` }}>
      <div style={{ position: 'absolute', inset: -size * 0.28, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(hue, intensity)} 0%, transparent 68%)`, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', padding: Math.max(2, size * 0.05),
        background: `conic-gradient(from 0deg, ${alpha(hue, 0)}, ${alpha(hue, 0.95)}, ${alpha(hue, 0)} 55%, ${alpha(hue, 0)})`,
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
        animation: `${live ? 'ldOrbSpin 4s' : reading ? 'ldOrbSpin 7s' : 'ldOrbSpin 14s'} linear infinite` }} />
      <div style={{ position: 'absolute', inset: size * 0.26, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${alpha(hue, 0.95)}, ${alpha(hue, 0.22)} 70%, ${alpha(hue, 0.08)})`,
        boxShadow: `inset 0 0 ${size * 0.12}px ${alpha(hue, 0.5)}` }} />
    </div>
  );
}

// seat avatar — you ring teal, CPU ring violet, never ambiguous.
export function SeatAvatar({ isCpu, color, size = 32, live = false }) {
  const ring = isCpu ? DX.cpu : DX.you;
  const base = color || (isCpu ? DX.cpu : DX.you);
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${alpha(base, 0.95)}, ${alpha(base, 0.28)} 68%, ${alpha(base, 0.1)})`,
        boxShadow: `inset 0 0 ${size * 0.14}px ${alpha(base, 0.55)}`, border: `1.5px solid ${alpha(ring, 0.7)}` }} />
      {live && <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${alpha(base, 0.5)}`, animation: 'ldOrbPulse 2.2s ease-in-out infinite' }} />}
      <div style={{ position: 'absolute', bottom: -2, right: -3, width: size * 0.44, height: size * 0.44, borderRadius: '50%', background: TOKENS.bg, border: `1px solid ${alpha(ring, 0.6)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={isCpu ? 'cpu' : 'user'} size={size * 0.27} color={ring} stroke={2.2} />
      </div>
    </div>
  );
}

// archetype lens chip
export function ArchChip({ archKey, size = 'd' }) {
  const a = archMeta(archKey);
  const big = size === 'd';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 8 : 6, padding: big ? '6px 11px 6px 8px' : '4px 9px 4px 6px', borderRadius: 999, background: alpha(a.tint, 0.12), border: `1px solid ${alpha(a.tint, 0.34)}` }}>
      <span style={{ width: big ? 22 : 18, height: big ? 22 : 18, borderRadius: '50%', background: alpha(a.tint, 0.18), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={a.icon} size={big ? 13 : 11} color={a.tint} stroke={2} />
      </span>
      <Mono style={{ fontSize: big ? 11 : 10, letterSpacing: '0.08em', color: a.tint, fontWeight: 600, textTransform: 'uppercase' }}>{a.name}</Mono>
    </span>
  );
}
