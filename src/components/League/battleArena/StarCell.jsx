// src/components/League/battleArena/StarCell.jsx
//
// League Battle View V2 — THE STAR CELL, the heart of the command dock. Each
// holding is a living, metered star: a gauge with the live multiplier riding from
// the last bad threshold toward the next good one — heating as it nears a line,
// popping when it hits (the badge sticks), trembling when it slides toward a Bust.
// Conviction tier drives size + glyph.
//
// It consumes the FLAT Phase-1 star row from leagueStarMeter (readAgentStar /
// readUserStar): { tk, tier, dir, mult, banked, points, badge, state, justIn }.
// The disposition (`state`) was already derived by the canonical deriveStarState;
// this file only renders it. Meter geometry comes from arenaMeter (canon-derived).
//
// REDUCED MOTION: the looping state animations are CSS classes (the global
// index.css guard neutralizes them); the transient beat ring is gated in JS so it
// simply does not render — the static cell still reads the full state by color +
// weight (the design's reduced-motion contract).

import React from 'react';
import { Mono, LIcon, Icon } from '../LeagueParts';
import { LTOKENS, alpha, MONO } from '../leagueTokens';
import { fmtPoints } from '../../../utils/leagueFormat';
import { meterPct, meterInfo, meterNear, tickCrossed, METER_TICKS } from './arenaMeter';
import { ST_GOOD, ST_BAD, OWN_AGENT, tierMeta } from './arenaTheme';
import { prefersReducedMotion } from './arenaEngineCore';

// tier → meter tick size + label weight
function tierProminence(tier, big) {
  if (tier === 'star') return { tick: big ? 19 : 15.5, dim: 1, weight: 700 };
  if (tier === 'core') return { tick: big ? 16.5 : 14, dim: 1, weight: 700 };
  return { tick: big ? 14.5 : 12.5, dim: 0.82, weight: 600 };
}

// ── tier glyph — filled star (Star) / half (Core) / dot (Support) ───────────
export function StarGlyph({ kind, color, size = 13 }) {
  // unconditional (rules of hooks) + per-instance, so nine same-tier glyphs never
  // collide on one gradient id (`url(#…)` would otherwise resolve to the first).
  const gid = `bv2sg${React.useId().replace(/:/g, '')}`;
  if (kind === 'dot') return <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: '50%', background: alpha(color, 0.7), display: 'inline-block' }} />;
  const half = kind === 'half';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="50%" stopColor={color} /><stop offset="50%" stopColor={alpha(color, 0.25)} />
        </linearGradient>
      </defs>
      <path d="M12 2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.8 5.9 20.9 7.2 14.2l-5-4.6 6.8-.8z"
        fill={half ? `url(#${gid})` : color} stroke={color} strokeWidth={half ? 1 : 0} strokeLinejoin="round" />
    </svg>
  );
}

// ── THE METER — 0 at centre, good thresholds right, bad left; the bead rides ──
export function Meter({ mult, climbing, big }) {
  const info = meterInfo(mult);
  const x = meterPct(mult);
  const h = big ? 9 : 7;
  const fillFrom = Math.min(50, x); const fillTo = Math.max(50, x);
  const grad = mult >= 0 ? `linear-gradient(90deg, ${alpha(ST_GOOD, 0.5)}, ${ST_GOOD})` : `linear-gradient(90deg, ${ST_BAD}, ${alpha(ST_BAD, 0.5)})`;
  const target = climbing ? info.nextUp : info.nextDown;
  const near = meterNear(mult, climbing);
  const beadClass = near && !prefersReducedMotion() ? (climbing ? 'bv2-marker-edge' : 'bv2-marker') : '';
  return (
    <div style={{ position: 'relative', width: '100%', height: h, borderRadius: h, background: LTOKENS.raised, marginTop: big ? 10 : 8 }}>
      {METER_TICKS.map((t) => {
        const tx = meterPct(t.m);
        const crossed = tickCrossed(t, mult);
        const isTarget = target && t.m === target.m;
        const col = t.m >= 0 ? ST_GOOD : ST_BAD;
        return (
          <span key={t.m} style={{ position: 'absolute', left: `${tx}%`, top: -2, bottom: -2, width: isTarget ? 2 : 1.5,
            transform: 'translateX(-50%)', background: crossed ? col : alpha(col, isTarget && near ? 0.7 : 0.3),
            borderRadius: 2, boxShadow: crossed ? `0 0 6px ${alpha(col, 0.7)}` : 'none' }} />
        );
      })}
      <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, transform: 'translateX(-50%)', background: LTOKENS.hair2 }} />
      <span style={{ position: 'absolute', left: `${fillFrom}%`, width: `${fillTo - fillFrom}%`, top: 0, bottom: 0, borderRadius: h, background: grad,
        boxShadow: `0 0 10px -2px ${alpha(mult >= 0 ? ST_GOOD : ST_BAD, 0.6)}` }} />
      <span className={beadClass} style={{ position: 'absolute', left: `${x}%`, top: '50%', width: big ? 12 : 10, height: big ? 12 : 10,
        borderRadius: '50%', transform: 'translate(-50%,-50%)', background: mult >= 0 ? ST_GOOD : ST_BAD, border: `2px solid ${LTOKENS.bg}`,
        boxShadow: `0 0 10px ${alpha(mult >= 0 ? ST_GOOD : ST_BAD, 0.9)}` }} />
    </div>
  );
}

// state → ring color, glow, looping animation class
function stateMotion(state) {
  switch (state) {
    case 'hit': return { ring: ST_GOOD, glow: alpha(ST_GOOD, 0.5), cls: '' };
    case 'edge': return { ring: ST_GOOD, glow: alpha(ST_GOOD, 0.6), cls: 'bv2-edge' };
    case 'heating': return { ring: alpha(ST_GOOD, 0.6), glow: alpha(ST_GOOD, 0.3), cls: 'bv2-heat' };
    case 'danger': return { ring: ST_BAD, glow: alpha(ST_BAD, 0.5), cls: 'bv2-tremble-fast' };
    case 'busted': return { ring: ST_BAD, glow: alpha(ST_BAD, 0.5), cls: 'bv2-tremble-slow' };
    default: return { ring: LTOKENS.hair2, glow: 'transparent', cls: '' };
  }
}

// caption for a non-dormant star
function captionFor(star) {
  const { state, mult, badge, banked } = star;
  const info = meterInfo(mult);
  if (state === 'hit') return { txt: `${badge || 'Hit'} ${fmtPoints(banked)}`, col: ST_GOOD, badge: true, icon: 'bolt' };
  if (state === 'busted') return { txt: `${badge || 'Bust'} ${fmtPoints(banked)}`, col: ST_BAD, badge: true, icon: 'short' };
  if (state === 'edge' && info.nextUp) return { txt: `${(info.nextUp.m - mult).toFixed(1)}× to ${info.nextUp.name}`, col: ST_GOOD };
  if (state === 'heating' && info.nextUp) return { txt: `${(info.nextUp.m - mult).toFixed(1)}× to ${info.nextUp.name}`, col: alpha(ST_GOOD, 0.85) };
  if (state === 'danger' && info.nextDown) return { txt: `⚠ ${(mult - info.nextDown.m).toFixed(1)}× to ${info.nextDown.name}`, col: ST_BAD };
  return { txt: 'quiet · in range', col: LTOKENS.ink3 };
}

// ── one STAR CELL ───────────────────────────────────────────────────────────
export function StarCell({ star, dormant = false, complete = false, headline = 'mult', owner = OWN_AGENT, dir, bump = 0, footer, style }) {
  const tg = tierProminence(star.tier, false);
  const tm = tierMeta(star.tier);
  const shownDir = dir || star.dir;
  const capH = 17;

  if (dormant) {
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 14, padding: '10px 12px', minWidth: 0,
        background: LTOKENS.surface, border: `1px solid ${alpha(owner, 0.22)}`, opacity: 0.7, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <StarGlyph kind={tm.glyph} color={alpha(owner, 0.7)} size={12} />
          <Mono style={{ fontSize: tg.tick, fontWeight: tg.weight, color: alpha(owner, 0.85), letterSpacing: '-0.01em' }}>{star.tk}</Mono>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>{shownDir}</span>
          <span style={{ marginLeft: 'auto', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>{tm.label}</span>
        </div>
        <Mono style={{ fontSize: 21, fontWeight: 700, lineHeight: 1, color: LTOKENS.ink3, marginTop: 6 }}>—</Mono>
        <div style={{ position: 'relative', width: '100%', height: 7, borderRadius: 9, background: LTOKENS.raised, marginTop: 8 }}>
          <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, transform: 'translateX(-50%)', background: LTOKENS.hair2 }} />
        </div>
        <div style={{ marginTop: 7, minHeight: capH, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="lock" size={10} color={LTOKENS.ink3} stroke={2} />
          <Mono style={{ fontSize: 9.5, fontWeight: 600, color: LTOKENS.ink3 }}>locked · opens at the bell</Mono>
        </div>
        {footer}
      </div>
    );
  }

  const climbing = star.mult >= 0;
  const m = stateMotion(star.state);
  const animClass = prefersReducedMotion() ? '' : m.cls;
  const cap = captionFor(star);
  const lit = ['hit', 'busted', 'edge', 'heating', 'danger'].includes(star.state);
  const tinted = star.state === 'busted' ? alpha(ST_BAD, 0.04) : star.state === 'hit' ? alpha(ST_GOOD, 0.05) : LTOKENS.surface;

  return (
    <div className={animClass} style={{ '--bv2-ring': m.ring, '--bv2-gl': m.glow, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0,
      borderRadius: 14, padding: '10px 12px', background: tinted, border: `1px solid ${alpha(owner, 0.42)}`, opacity: tg.dim,
      boxShadow: `0 0 0 1px ${alpha(owner, 0.18)}, 0 0 16px -6px ${m.glow}`, ...style }}>
      {/* luminous wash — the star's charge, clipped to the cell */}
      {lit && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14, overflow: 'hidden',
          background: `radial-gradient(120% 90% at ${climbing ? '88%' : '12%'} 18%, ${alpha(climbing ? ST_GOOD : ST_BAD, star.state === 'hit' || star.state === 'busted' ? 0.16 : star.state === 'edge' ? 0.14 : 0.08)}, transparent 62%)` }} />
      )}

      {/* head: glyph + ticker + dir + tier (identity reads OWNER color) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, position: 'relative' }}>
        <span style={{ filter: `drop-shadow(0 0 5px ${alpha(owner, 0.6)})` }}><StarGlyph kind={tm.glyph} color={owner} size={12} /></span>
        <Mono style={{ fontSize: tg.tick, fontWeight: tg.weight, color: owner, letterSpacing: '-0.01em' }}>{star.tk}</Mono>
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>{shownDir}</span>
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: star.tier === 'star' ? owner : LTOKENS.ink3 }}>{tm.label}</span>
      </div>

      {/* headline — multiplier (drama) or points (currency) */}
      {headline === 'pts' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5, position: 'relative' }}>
          <Mono style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: star.banked > 0 ? ST_GOOD : star.banked < 0 ? ST_BAD : LTOKENS.ink2,
            textShadow: star.banked !== 0 ? `0 0 16px ${alpha(star.banked > 0 ? ST_GOOD : ST_BAD, 0.45)}` : 'none' }}>{fmtPoints(star.banked)}</Mono>
          <Mono style={{ fontSize: 9, fontWeight: 700, color: LTOKENS.ink3, letterSpacing: '0.06em' }}>PTS</Mono>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Mono style={{ fontSize: 11, fontWeight: 700, color: climbing ? ST_GOOD : ST_BAD }}>{star.mult >= 0 ? '+' : ''}{star.mult.toFixed(1)}×</Mono>
            <LIcon name={climbing ? 'long' : 'short'} size={10} color={climbing ? ST_GOOD : ST_BAD} stroke={2.6} />
          </span>
          {star.justIn && <JustIn owner={owner} />}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5, position: 'relative' }}>
          <Mono style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: climbing ? ST_GOOD : ST_BAD,
            textShadow: `0 0 16px ${alpha(climbing ? ST_GOOD : ST_BAD, star.state === 'hit' || star.state === 'busted' || star.state === 'edge' ? 0.55 : 0.3)}` }}>
            {star.mult >= 0 ? '+' : ''}{star.mult.toFixed(1)}×
          </Mono>
          <LIcon name={climbing ? 'long' : 'short'} size={11} color={climbing ? ST_GOOD : ST_BAD} stroke={2.6} />
          {star.justIn && <JustIn owner={owner} />}
        </div>
      )}

      <div style={{ position: 'relative' }}><Meter mult={star.mult} climbing={climbing} big={false} /></div>

      {/* caption / badge */}
      <div style={{ marginTop: 6, minHeight: capH, display: 'flex', alignItems: 'center', position: 'relative' }}>
        {cap.badge ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 7, whiteSpace: 'nowrap',
            background: alpha(cap.col, 0.14), border: `1px solid ${alpha(cap.col, 0.45)}` }}>
            <LIcon name={cap.icon} size={10} color={cap.col} stroke={2.2} />
            <Mono style={{ fontSize: 10, fontWeight: 700, color: cap.col }}>{cap.txt}</Mono>
          </span>
        ) : (
          <Mono style={{ fontSize: 9.5, fontWeight: 600, color: cap.col, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cap.txt}</Mono>
        )}
      </div>

      {/* beat ring — fires only on the live beat instant (keyed), then gone */}
      {bump > 0 && !complete && !prefersReducedMotion() && (
        <span key={`b${bump}`} className="bv2-beatring" style={{ position: 'absolute', inset: -2, borderRadius: 16, border: `2px solid ${climbing ? ST_GOOD : ST_BAD}`, pointerEvents: 'none' }} />
      )}

      {footer}
    </div>
  );
}

function JustIn({ owner }) {
  return (
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: owner, padding: '2px 6px', borderRadius: 5,
      background: alpha(owner, 0.14), border: `1px solid ${alpha(owner, 0.4)}`, fontFamily: MONO }}>JUST IN</span>
  );
}
