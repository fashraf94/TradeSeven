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

// tier → meter tick size + label weight.
//
// PHASE 5a / R1 — FLAT ACROSS ALL THREE TIERS. Star used to render larger
// (19/15.5) and Support dimmer (0.82), which on a scoring surface reads as
// WEIGHT: bigger and brighter says "this one counts for more". In the League it
// does not. flat6 stamps tierMultiplier 1.0 on every agent pick
// (agentGameModes.js) and user picks carry no tier at all
// (tournamentUserScoring.js), so all nine holdings score at ×1.0 and any size
// hierarchy is a false claim — a §9 display-agreement violation.
//
// Tier stays as IDENTITY: the label is kept, and StarGlyph's non-scalar
// star/half/dot shapes are untouched. Only the scalar signals — tick size and
// dim — are flattened. No tier multiplier is rendered anywhere.
//
// Re-activating tiered scoring for the League is a game-design change requiring
// the §7 gated process (R1); if that ever happens, this is where the hierarchy
// comes back.
function tierProminence(tier, big) {
  return { tick: big ? 16.5 : 14, dim: 1, weight: 700 };
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

// ── canonical-open SETTLEMENT states (Spec §1.1, Phase 5 Deliverable 2) ──
// A display axis orthogonal to the disposition `state`. `pending`/`void` are
// "no number" muted cells (the ABSENCE of a multiplier is the signal — it
// replaces the old +0.0× that read as broken); `estimated`/`official` annotate
// the live cell (dashed "est" vs solid "banked"). Neutral/grey, never P&L-tinted
// — pending has taken no direction, and a void is ABSENCE, not a loss (a real
// loss is coral with a number; void is grey with an em-dash). Legacy rounds
// carry settleState null and skip all of this → byte-identical to today.
const SETTLE_ANNO = Object.freeze({
  estimated: { tag: 'est', caption: 'estimate until banked' },
  official: { tag: 'banked', caption: 'official · counts in standings' },
});

// The small provisional/confirmed tag beside the headline multiplier.
function SettleTag({ kind, color }) {
  if (kind === 'official') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5,
        background: alpha(ST_GOOD, 0.14), border: `1px solid ${alpha(ST_GOOD, 0.5)}`, fontFamily: MONO }}>
        <Icon name="check" size={9} color={ST_GOOD} stroke={2.8} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: ST_GOOD, textTransform: 'uppercase' }}>banked</span>
      </span>
    );
  }
  // estimated — dashed (provisional), tinted to the live P&L color. The dashed
  // border IS the est/official contrast, and doubles as the ATR-drift disclosure
  // (the live preview-ATR number shifts to the banked percentile-ATR overnight).
  return (
    <span style={{ padding: '2px 6px', borderRadius: 5, background: 'transparent', border: `1px dashed ${alpha(color, 0.65)}`, fontFamily: MONO }}>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: alpha(color, 0.95), textTransform: 'uppercase' }}>est</span>
    </span>
  );
}

// The muted "no number" cell shared by `pending` (waiting for the open) and
// `void` (terminal, didn't count). Structurally the dormant cell: identity head,
// an em-dash where the multiplier would be, an INACTIVE meter (no positioned dot
// — a dot implies a value), and a status line. pending keeps a subtle owner-tint
// + gentle pulse (it's live-awaiting); void is fully grey and dimmed (absence).
function SettleMutedCell({ star, owner, tg, tm, shownDir, pad, capH, dense, footer, style }) {
  const isPending = star.settleState === 'pending';
  const tickCol = isPending ? alpha(owner, 0.9) : LTOKENS.ink3;
  const cls = isPending && !prefersReducedMotion() ? 'bv2-heat' : '';
  return (
    <div className={cls} style={{ '--bv2-ring': isPending ? alpha(owner, 0.28) : LTOKENS.hair2, '--bv2-gl': isPending ? alpha(owner, 0.18) : 'transparent',
      position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 14, padding: pad, minWidth: 0,
      background: LTOKENS.surface, border: `1px solid ${alpha(owner, isPending ? 0.30 : 0.16)}`, opacity: isPending ? 0.92 : 0.6, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <StarGlyph kind={tm.glyph} color={isPending ? alpha(owner, 0.7) : LTOKENS.ink3} size={12} />
        <Mono style={{ fontSize: tg.tick, fontWeight: tg.weight, color: tickCol, letterSpacing: '-0.01em' }}>{star.tk}</Mono>
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>{shownDir}</span>
        <span style={{ marginLeft: 'auto', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>{tm.label}</span>
      </div>
      {/* NO multiplier — the em-dash is the signal (neutral, never P&L-tinted) */}
      <Mono style={{ fontSize: dense ? 19 : 21, fontWeight: 700, lineHeight: 1, color: LTOKENS.ink3, marginTop: 6 }}>—</Mono>
      {/* inactive meter — centre hair only, no bead */}
      <div style={{ position: 'relative', width: '100%', height: 7, borderRadius: 9, background: LTOKENS.raised, marginTop: 8, opacity: isPending ? 1 : 0.5 }}>
        <span style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, transform: 'translateX(-50%)', background: LTOKENS.hair2 }} />
      </div>
      <div style={{ marginTop: 7, minHeight: capH, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name={isPending ? 'clock' : 'x'} size={10} color={LTOKENS.ink3} stroke={2} />
        <Mono style={{ fontSize: 9.5, fontWeight: 600, color: LTOKENS.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isPending ? 'settles at the open' : 'no open · didn’t count · no penalty'}
        </Mono>
      </div>
      {footer}
    </div>
  );
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
// `dense` (mobile stacked rows): tighter padding + headline type so the cells
// aren't oversized at full phone width. Every dense delta is gated below; default
// off → the desktop dock cell is byte-identical (and `dense` does NOT reuse the
// `big` meter path — that stays false here).
export function StarCell({ star, dormant = false, complete = false, headline = 'mult', owner = OWN_AGENT, dir, bump = 0, footer, dense = false, style }) {
  const tg = tierProminence(star.tier, false);
  const tm = tierMeta(star.tier);
  const shownDir = dir || star.dir;
  const capH = dense ? 15 : 17;
  const pad = dense ? '9px 11px' : '10px 12px';

  if (dormant) {
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 14, padding: pad, minWidth: 0,
        background: LTOKENS.surface, border: `1px solid ${alpha(owner, 0.22)}`, opacity: 0.7, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <StarGlyph kind={tm.glyph} color={alpha(owner, 0.7)} size={12} />
          <Mono style={{ fontSize: tg.tick, fontWeight: tg.weight, color: alpha(owner, 0.85), letterSpacing: '-0.01em' }}>{star.tk}</Mono>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>{shownDir}</span>
          <span style={{ marginLeft: 'auto', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>{tm.label}</span>
        </div>
        <Mono style={{ fontSize: dense ? 19 : 21, fontWeight: 700, lineHeight: 1, color: LTOKENS.ink3, marginTop: 6 }}>—</Mono>
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

  // Canonical-open settlement states (null for legacy rounds → unchanged below).
  // pending/void are the muted "no number" cells; estimated/official annotate
  // the live cell rendered further down.
  const settle = star.settleState;
  if (settle === 'pending' || settle === 'void') {
    return <SettleMutedCell star={star} owner={owner} tg={tg} tm={tm} shownDir={shownDir} pad={pad} capH={capH} dense={dense} footer={footer} style={style} />;
  }
  const settleAnno = settle === 'estimated' || settle === 'official' ? SETTLE_ANNO[settle] : null;

  const climbing = star.mult >= 0;
  const m = stateMotion(star.state);
  const animClass = prefersReducedMotion() ? '' : m.cls;
  // estimated/official replace the disposition caption with the settlement
  // status ("estimate until banked" / "official · counts in standings").
  const cap = settleAnno
    ? { txt: settleAnno.caption, col: settle === 'official' ? LTOKENS.ink2 : LTOKENS.ink3 }
    : captionFor(star);
  const pnlCol = climbing ? ST_GOOD : ST_BAD;
  const lit = ['hit', 'busted', 'edge', 'heating', 'danger'].includes(star.state);
  const tinted = star.state === 'busted' ? alpha(ST_BAD, 0.04) : star.state === 'hit' ? alpha(ST_GOOD, 0.05) : LTOKENS.surface;

  return (
    <div className={animClass} style={{ '--bv2-ring': m.ring, '--bv2-gl': m.glow, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0,
      borderRadius: 14, padding: pad, background: tinted, border: `1px solid ${alpha(owner, 0.42)}`, opacity: tg.dim,
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

      {/* headline — multiplier (drama) or POINTS (the currency that sums to the orb).
          Points-led (Rulings B/C) leads with star.points = this holding's contribution
          to the composite: for the six, today's agent points (base + today's badges);
          for the three, the pick's total (banked closed legs + the live leg). It is
          NOT star.banked (closed-legs-only — would undercount the live leg). The ×
          meter + "to BaggerBomb" caption below stay as secondary texture. */}
      {headline === 'pts' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5, position: 'relative' }}>
          <Mono style={{ fontSize: dense ? 16 : 18, fontWeight: 700, lineHeight: 1, color: star.points > 0 ? ST_GOOD : star.points < 0 ? ST_BAD : LTOKENS.ink2,
            textShadow: star.points !== 0 ? `0 0 16px ${alpha(star.points > 0 ? ST_GOOD : ST_BAD, 0.45)}` : 'none' }}>{fmtPoints(star.points)}</Mono>
          <Mono style={{ fontSize: 9, fontWeight: 700, color: LTOKENS.ink3, letterSpacing: '0.06em' }}>PTS</Mono>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Mono style={{ fontSize: 11, fontWeight: 700, color: climbing ? ST_GOOD : ST_BAD }}>{star.mult >= 0 ? '+' : ''}{star.mult.toFixed(1)}×</Mono>
            <LIcon name={climbing ? 'long' : 'short'} size={10} color={climbing ? ST_GOOD : ST_BAD} stroke={2.6} />
          </span>
          {star.justIn && <JustIn owner={owner} />}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5, position: 'relative' }}>
          <Mono style={{ fontSize: dense ? 20 : 22, fontWeight: 700, lineHeight: 1, color: climbing ? ST_GOOD : ST_BAD,
            textShadow: `0 0 16px ${alpha(climbing ? ST_GOOD : ST_BAD, star.state === 'hit' || star.state === 'busted' || star.state === 'edge' ? 0.55 : 0.3)}`,
            // estimated → dashed underline (provisional); official → solid.
            ...(settle === 'estimated' ? { textDecoration: 'underline dashed', textDecorationColor: alpha(pnlCol, 0.6), textUnderlineOffset: 4 } : {}) }}>
            {star.mult >= 0 ? '+' : ''}{star.mult.toFixed(1)}×
          </Mono>
          <LIcon name={climbing ? 'long' : 'short'} size={11} color={climbing ? ST_GOOD : ST_BAD} stroke={2.6} />
          {settleAnno && <SettleTag kind={settle} color={pnlCol} />}
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
