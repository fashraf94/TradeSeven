// src/components/League/battleArena/ArenaPrimitives.jsx
//
// League Battle View V2 — the small shared building blocks of the desktop arena:
// the points-not-percent count-up, the agent Orb, the mode chip, the threshold
// key, the live waveform, the on-board beat caption, and the top strip.
// Translated from the locked Claude Design (battle-arena-core / battle-kit),
// re-skinned onto the shared League palette + primitives.
//
// POINTS, NEVER PERCENT: ArenaCount formats through the Phase-1 fmtScore — it
// does NOT reuse LeagueParts.Score/CountScore, which append a literal `%` (the
// documented Gate-3 leak this surface must not inherit).

import React from 'react';
import AgentOrb from '../../shared/AgentOrb';
import { Mono, Eyebrow, StatusBadge } from '../LeagueParts';
import { Icon, LIcon } from '../LeagueIcons';
import { LTOKENS, LX, alpha, MONO } from '../leagueTokens';
import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring';
import { fmtScore } from '../../../utils/leagueFormat';
import { prefersReducedMotion } from './arenaEngineCore';
import { ST_GOOD, ST_BAD, beatToneColor, BEAT_GLYPH } from './arenaTheme';

// ── points-not-percent count-up (the climb callouts / composite) ────────────
export function ArenaCount({ value, size = 14, weight = 700, dur = 950, showSign = true }) {
  const [v, setV] = React.useState(value);
  const prev = React.useRef(value);
  React.useEffect(() => {
    if (prefersReducedMotion()) { setV(value); prev.current = value; return undefined; }
    const from = prev.current; const to = value; const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur); const e = 1 - (1 - p) ** 3;
      const cur = from + (to - from) * e;
      setV(cur);
      prev.current = cur; // track the live value so a value change mid-flight resumes here, not from the last completed value
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  const up = v >= 0;
  const c = Math.abs(v) < 0.05 ? LTOKENS.ink2 : up ? LX.pos : LX.neg;
  const str = showSign ? fmtScore(v) : fmtScore(v).replace('+', '');
  return <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color: c, lineHeight: 1, letterSpacing: '-0.01em' }}>{str}</span>;
}

// ── the agent Orb — composes the shared AgentOrb (states ready/live/review) ──
export function ArenaOrb({ state = 'ready', size = 22, color = LTOKENS.teal }) {
  return <AgentOrb color={color} size={size} state={state} />;
}

// ── mode chrome — Training (no stakes) vs Ranked (a verdict) ────────────────
export function ModeChip({ mode }) {
  const ranked = mode === 'ranked';
  const c = ranked ? LTOKENS.gold : LTOKENS.teal;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
      background: alpha(c, 0.1), border: `1px solid ${alpha(c, 0.3)}` }}>
      <LIcon name={ranked ? 'ranked' : 'play'} size={11} color={c} stroke={2} />
      <Mono style={{ fontSize: 10, color: c, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {ranked ? 'Ranked' : 'Training'}
      </Mono>
    </span>
  );
}

// ── the threshold key — derived from canon so the legend can't drift ────────
export function MeterKey({ style }) {
  const good = BAGGER_TIERS.map((t) => `${t.multiplier.toFixed(1)}× ${t.label}`).join(' · ');
  const bad = BUST_TIERS.map((t) => `−${t.multiplier.toFixed(1)}× ${t.label}`).join(' · ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ST_GOOD }} />
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{good}</Mono>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ST_BAD }} />
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{bad}</Mono>
      </span>
    </div>
  );
}

// ── a tiny three-bar equalizer — "talking, live" ────────────────────────────
export function Waveform({ color, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: size }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="bv2-wave" style={{ width: 2.4, height: size, borderRadius: 2, background: color,
          transformOrigin: 'center', animationDelay: `${i * 0.15}s`, animationDuration: `${0.9 + i * 0.25}s` }} />
      ))}
    </span>
  );
}

// ── the on-board beat caption — the surface names what just happened ────────
export function BeatCaption({ beat }) {
  if (!beat) return null;
  const c = beatToneColor(beat.tone, beat.kind);
  return (
    <div className="bv2-beatin" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 16px', borderRadius: 999,
      background: alpha(c, 0.14), border: `1px solid ${alpha(c, 0.42)}`, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      boxShadow: `0 8px 26px -10px ${alpha(c, 0.6)}` }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.2), flexShrink: 0 }}>
        <LIcon name={BEAT_GLYPH[beat.kind] || 'pulse'} size={13} color={c} stroke={2.2} />
      </span>
      <Mono style={{ fontSize: 12, fontWeight: 600, color: LTOKENS.ink, letterSpacing: '0.01em' }}>{beat.text}</Mono>
    </div>
  );
}

// ── the top strip — context around the arena (back · mode · day · status) ───
export function ArenaTopStrip({ mode, state, pod, closeClock, onBack }) {
  const live = state === 'live'; const calm = state === 'awaiting'; const done = state === 'complete';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 4px' }}>
      <button className="bv2-tap" onClick={onBack} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
        <LIcon name="arrowL" size={17} color={LTOKENS.ink2} />
        <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>League</Mono>
      </button>
      <div style={{ width: 1, height: 20, background: LTOKENS.hair2 }} />
      <ModeChip mode={mode} />
      <Mono style={{ fontSize: 11.5, color: LTOKENS.ink2, letterSpacing: '0.03em' }}>
        {done ? 'Battle complete' : calm ? 'Awaiting open' : `Day ${pod.day} of ${pod.days}`}
      </Mono>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="eye" size={14} color={LTOKENS.ink3} />
          <Mono style={{ fontSize: 11, color: LTOKENS.ink2 }}>{pod.watchers}</Mono>
        </span>
        {live && <StatusBadge status="live" clock={closeClock} compact />}
        {calm && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
            <Icon name="clock" size={11} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 10, color: LTOKENS.ink2, fontWeight: 600, letterSpacing: '0.06em' }}>OPENS SOON</Mono>
          </span>
        )}
        {done && <StatusBadge status="final" />}
      </div>
    </div>
  );
}
