/* eslint-disable react-refresh/only-export-components -- shared League primitives: the small presentation components and the clockStr helper are co-located here by design (the commandUI command-bridge precedent) */
// src/components/League/LeagueParts.jsx
//
// Shared League primitives — honest CPU/human marks, kept-negative scores, the
// six-holding portfolio mini, status badges. Transcribed from the Claude Design
// prototype (league-parts.jsx + components.jsx).
//
// REUSE: Eyebrow/Mono come from the shared command-bridge (commandUI); the agent
// disc composes the existing AgentOrb. NET-NEW here: Tag, the CPU/human KindMark
// badge, Score (mono kept-negative), StatusBadge, Watchers, PortfolioMini.

import React from 'react';
import { Eyebrow, Mono } from '../Dashboard/commandUI';
import AgentOrb from '../shared/AgentOrb';
import { Icon, LIcon } from './LeagueIcons';
import { LTOKENS, LX, alpha, MONO } from './leagueTokens';

// re-export the reused primitives so League files import from one place
export { Eyebrow, Mono, Icon, LIcon };

// ── Tag — small uppercase mono chip ─────────────────────────────────────────
export function Tag({ children, color = LTOKENS.ink2, bg }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
      color, background: bg || alpha(color, 0.12), border: `1px solid ${alpha(color, 0.25)}`,
      padding: '3px 7px', borderRadius: 6, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Agent avatar — composes the existing AgentOrb, then overlays the identity
//    ring (human blue / CPU violet) + the kind badge. Identity is never
//    ambiguous; only the ring + badge are League-specific. ───────────────────
export function AgentAvatar({ agent, size = 38, live = false }) {
  const ring = agent.kind === 'cpu' ? LX.cpu : LX.human;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <AgentOrb color={agent.color} size={size} state={live ? 'live' : 'ready'} />
      {/* identity ring — the honesty marker */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${alpha(ring, 0.7)}`, pointerEvents: 'none' }} />
      {/* kind badge */}
      <div style={{
        position: 'absolute', bottom: -2, right: -3, width: size * 0.46, height: size * 0.46,
        borderRadius: '50%', background: LTOKENS.bg, border: `1px solid ${alpha(ring, 0.6)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <LIcon name={agent.kind === 'cpu' ? 'cpu' : 'user'} size={size * 0.28} color={ring} stroke={2.2} />
      </div>
    </div>
  );
}

// ── CPU / human text mark — always shown next to a name. Honest by default. ──
export function KindMark({ agent, style }) {
  if (agent.kind === 'cpu') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 9,
        letterSpacing: '0.12em', textTransform: 'uppercase', color: LX.cpu, background: alpha(LX.cpu, 0.13),
        border: `1px solid ${alpha(LX.cpu, 0.3)}`, padding: '2px 6px', borderRadius: 5, fontWeight: 600, ...style,
      }}>
        <LIcon name="cpu" size={10} color={LX.cpu} stroke={2.2} /> CPU
      </span>
    );
  }
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, color: agent.you ? LX.energy : LTOKENS.ink3,
      letterSpacing: '0.04em', fontWeight: agent.you ? 700 : 500, ...style,
    }}>
      {agent.you ? 'YOU' : agent.owner}
    </span>
  );
}

// ── Kept-negative score. Red as information, never hidden, never shamed. ─────
export function Score({ v, size = 20, weight = 700, showSign = true }) {
  const up = v >= 0;
  const c = v === 0 ? LTOKENS.ink2 : up ? LX.pos : LX.neg;
  const str = `${up && showSign ? '+' : ''}${v.toFixed(1)}%`;
  return <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color: c, lineHeight: 1, letterSpacing: '-0.01em' }}>{str}</span>;
}

// ── Count-up score — the kept-negative Score, animated: rolls from the prior
//    value to the new one on a cubic ease (the daily-close "magnitude registers"
//    beat). Reduced motion snaps instantly — matchMedia is the JS guard the
//    global CSS reduced-motion rule can't cover for a rAF counter. ────────────
export function CountScore({ value, size = 14, weight = 700, dur = 950, showSign = true }) {
  const [v, setV] = React.useState(value);
  const prev = React.useRef(value);
  React.useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(value); prev.current = value; return undefined; }
    const from = prev.current, to = value, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  const up = v >= 0;
  const c = Math.abs(v) < 0.05 ? LTOKENS.ink2 : up ? LX.pos : LX.neg;
  return <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color: c, lineHeight: 1, letterSpacing: '-0.01em' }}>{`${up && showSign ? '+' : ''}${v.toFixed(1)}%`}</span>;
}

// clock from seconds — mm:ss for short, "Xd Yh" / "Xh Ym" for round-scale
export function clockStr(s) {
  if (s >= 86400) { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return `${d}d ${h}h`; }
  if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; }
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Status badge — LIVE clock / FINAL / DRAFTS MON ─────────────────────────
export function StatusBadge({ status, clock, compact = false }) {
  if (status === 'live') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '3px 8px' : '4px 10px',
        borderRadius: 999, background: alpha(LX.energy, 0.12), border: `1px solid ${alpha(LX.energy, 0.3)}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: LX.energy, animation: 'lgLiveDot 1.6s infinite' }} />
        <Mono style={{ fontSize: compact ? 10.5 : 11, color: LX.energy, fontWeight: 600, letterSpacing: '0.06em' }}>{clock != null ? clockStr(clock) : 'LIVE'}</Mono>
      </span>
    );
  }
  if (status === 'final') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
        background: alpha(LTOKENS.gold, 0.1), border: `1px solid ${alpha(LTOKENS.gold, 0.26)}`,
      }}>
        <LIcon name="crown" size={11} color={LTOKENS.gold} stroke={2} />
        <Mono style={{ fontSize: 10.5, color: LTOKENS.gold, fontWeight: 600, letterSpacing: '0.1em' }}>FINAL</Mono>
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
      background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`,
    }}>
      <Icon name="clock" size={11} color={LTOKENS.ink3} />
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, fontWeight: 600, letterSpacing: '0.08em' }}>DRAFTS MON</Mono>
    </span>
  );
}

// ── presence chip — "47 watching" ─────────────────────────────────────────
export function Watchers({ n, style }) {
  if (!n) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...style }}>
      <LIcon name="eyeR" size={12} color={LTOKENS.ink3} />
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{n} watching</Mono>
    </span>
  );
}

// ── Portfolio mini — the full six-holding book as a tight column. ──────────
export function PortfolioMini({ book, accent }) {
  if (!book.length) {
    return <div style={{ fontSize: 12, color: LTOKENS.ink3, fontFamily: MONO, padding: '8px 0' }}>Book drafts Monday — seat reserved.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {book.map((h, i) => {
        const up = h.c >= 0;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
            borderBottom: i < book.length - 1 ? `1px solid ${LTOKENS.hair}` : 'none',
          }}>
            <LIcon name={h.dir === 'short' ? 'short' : 'long'} size={13} color={h.dir === 'short' ? LX.alert : alpha(accent || LTOKENS.ink2, 0.9)} stroke={2.2} />
            <Mono style={{ fontSize: 12.5, color: LTOKENS.ink, fontWeight: 600, width: 46 }}>{h.tk}</Mono>
            {h.w != null && <Mono style={{ fontSize: 10, color: LTOKENS.ink3, width: 30 }}>{h.w}%</Mono>}
            <Mono style={{ fontSize: 11.5, color: LTOKENS.ink2, marginLeft: 'auto' }}>{h.p}</Mono>
            <Mono style={{ fontSize: 11.5, color: up ? LX.pos : LX.neg, width: 44, textAlign: 'right' }}>{up ? '+' : ''}{h.c.toFixed(1)}%</Mono>
          </div>
        );
      })}
    </div>
  );
}

// section eyebrow with an optional right-aligned element
export function SectionLabel({ label, color = LTOKENS.ink3, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, ...style }}>
      <Eyebrow color={color}>{label}</Eyebrow>
      {right}
    </div>
  );
}
