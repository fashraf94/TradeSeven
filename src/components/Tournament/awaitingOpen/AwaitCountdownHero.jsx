// src/components/Tournament/awaitingOpen/AwaitCountdownHero.jsx
//
// Awaiting-the-Open redesign — the countdown band (build spec §7: "the
// emotional center: large, alive, the one moving element on a still screen").
//
// Targets the SAME instant the classic hero does — pod.startAnchor.anchorIso,
// the persisted 09:30-ET next-open — via the same useCountdown hook, so the two
// bodies can never disagree about when the bell rings. The pod's status flip is
// date-based and runs on the orchestrator sweep, which can land slightly BEFORE
// the anchor, so at expiry this holds an "Opening…" state rather than a frozen
// 0:00 or a negative timer, exactly as PodCountdownHero does today.
//
// Every displayed number is derived from the one `totalSec` the numerals show —
// the wait rail included — so a label can never disagree with its number
// (BUILD_RULES §9). The scoring strip reads the live tuning constants
// (TOURNAMENT_TUNING.USER_LAYER_K, AGENT_PICKS_PER_AGENT, PICKS_PER_PLAYER)
// rather than restating "×1.5" as copy.
//
// Reduced motion: the pulsing bell dot, the blinking colon and the rail bead are
// all gated on usePrefersReducedMotion — under Reduce Motion the hero is still,
// and the layout is unchanged.

import React, { useMemo } from 'react';
import { Clock, Check } from 'lucide-react';
import { useCountdown } from '../../../hooks/useCountdown';
import { TOURNAMENT_TUNING, AGENT_PICKS_PER_AGENT, PICKS_PER_PLAYER } from '../../../constants/leagueTournament';
import { alpha, WPOD, WMODES, modeColor, waitSegments, runStartDay } from './awaitTokens';
import { Mono, WChip, TickRail, useAwaitPalette, usePrefersReducedMotion } from './awaitPrimitives';

// The rail spans the final day of waiting → the bell. Beyond a day out the bead
// simply sits at the start; the numerals remain the truth.
const WAIT_SPAN_SEC = 86400;

function CDNum({ value, label, compact, dense, pal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 4 : 5 }}>
      <Mono style={{
        fontSize: dense ? (compact ? 34 : 40) : (compact ? 50 : 56),
        fontWeight: 700, lineHeight: 0.92, letterSpacing: '-0.045em', color: pal.white,
        fontVariantNumeric: 'tabular-nums',
        textShadow: `0 0 26px ${alpha(pal.teal, 0.55)}, 0 0 60px ${alpha(pal.teal, 0.25)}`,
      }}>
        {String(value).padStart(2, '0')}
      </Mono>
      <Mono style={{ fontSize: compact ? 8.5 : 9, fontWeight: 700, letterSpacing: '0.3em', color: alpha(pal.teal, 0.65) }}>
        {label}
      </Mono>
    </div>
  );
}

function RunStrip({ startDay, compact, pal }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 7 : 9, flexWrap: 'wrap' }}>
      <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', color: pal.ink3 }}>THE RUN</Mono>
      <div style={{ display: 'flex', gap: 4 }}>
        {WPOD.run.map((d) => {
          const on = d === startDay;
          return (
            <span key={d} style={{
              padding: '4px 7px', borderRadius: 6,
              background: on ? alpha(pal.teal, 0.14) : alpha(pal.white, 0.03),
              border: `1px solid ${on ? alpha(pal.teal, 0.36) : pal.hair}`,
            }}>
              <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: on ? pal.teal : pal.ink3 }}>
                {d}
              </Mono>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** How the rehearsal score is built — read from the live tuning constants. */
function MathStrip({ mode, compact, pal }) {
  const m = WMODES[mode] || WMODES.practice;
  const mc = modeColor(pal, mode);
  const chip = (label, mult, body, color) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: compact ? '5px 8px' : '6px 10px',
      borderRadius: 9, background: alpha(color, 0.08), border: `1px solid ${alpha(color, 0.26)}`,
    }}>
      <Mono style={{ fontSize: compact ? 9 : 9.5, fontWeight: 700, letterSpacing: '0.12em', color: alpha(color, 0.95) }}>{label}</Mono>
      <Mono style={{ fontSize: compact ? 9 : 9.5, fontWeight: 700, padding: '2px 5px', borderRadius: 5, background: alpha(color, 0.16), color }}>{mult}</Mono>
      <Mono style={{ fontSize: compact ? 9.5 : 10, fontWeight: 600, color: pal.ink2, letterSpacing: '0.06em' }}>{body}</Mono>
    </span>
  );
  const op = (s) => <Mono style={{ fontSize: compact ? 11 : 12, color: pal.ink3, fontWeight: 700 }}>{s}</Mono>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 7 : 10, flexWrap: 'wrap' }}>
      <Mono style={{ fontSize: compact ? 8.5 : 9, fontWeight: 700, letterSpacing: '0.2em', color: pal.ink3 }}>HOW THIS SCORES</Mono>
      {chip('AGENT', '×1', `${AGENT_PICKS_PER_AGENT}`, pal.teal)}
      {op('+')}
      {chip('USER', `×${TOURNAMENT_TUNING.USER_LAYER_K}`, `${PICKS_PER_PLAYER}`, pal.you)}
      {op('=')}
      <Mono style={{ fontSize: compact ? 10 : 10.5, fontWeight: 700, letterSpacing: '0.1em', color: pal.ink }}>
        {mode === 'ranked' ? 'YOUR SCORE' : 'REHEARSAL SCORE'}
      </Mono>
      <Mono style={{
        fontSize: compact ? 9 : 9.5, fontWeight: 700, letterSpacing: '0.14em', color: mc,
        marginLeft: compact ? 0 : 'auto',
      }}>
        {m.chip}
      </Mono>
    </div>
  );
}

export default function AwaitCountdownHero({ targetIso = null, mode = 'practice', compact = false }) {
  const pal = useAwaitPalette();
  const reduced = usePrefersReducedMotion();
  // Interval ticks every second; onExpire is not needed — the host swaps the
  // whole view on the group-status flip. A null target reports isExpired, which
  // is treated as "no target" below rather than as an expiry.
  const { timeRemaining, isExpired } = useCountdown(targetIso || null, { interval: 1000 });

  const hasTarget = !!targetIso;
  const totalSec = Math.max(0, Math.floor(timeRemaining / 1000));
  const opening = hasTarget && isExpired;
  const segs = useMemo(() => waitSegments(totalSec), [totalSec]);
  const startDay = useMemo(() => runStartDay(targetIso), [targetIso]);
  // Same totalSec as the numerals — one source for the number and its rail.
  const pct = Math.max(2, Math.min(98, (1 - Math.min(totalSec, WAIT_SPAN_SEC) / WAIT_SPAN_SEC) * 100));
  const dense = segs.length > 3;

  return (
    <section style={{
      position: 'relative', overflow: 'hidden', borderRadius: compact ? 18 : 20,
      background: `linear-gradient(150deg, ${alpha(pal.teal, 0.11)}, ${alpha(pal.bg, 0.7)} 46%), ${pal.surface}`,
      border: `1px solid ${alpha(pal.teal, 0.3)}`,
      boxShadow: `inset 0 1px 0 ${alpha(pal.white, 0.07)}, 0 30px 70px -50px ${alpha(pal.teal, 0.9)}, 0 22px 50px -40px ${alpha(pal.bg, 0.9)}`,
    }}>
      {/* the glow above the numerals — decorative, inert */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: compact ? -90 : -130, left: '4%',
        width: compact ? 260 : 380, height: compact ? 200 : 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(pal.teal, 0.18)}, transparent 68%)`, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: compact ? '14px 15px 13px' : '14px 20px 12px' }}>
        <div style={{
          display: 'flex', alignItems: compact ? 'flex-start' : 'center', gap: compact ? 9 : 14,
          flexWrap: 'wrap', marginBottom: compact ? 11 : 10,
        }}>
          <span aria-hidden="true" style={{
            width: 8, height: 8, borderRadius: '50%', background: pal.teal, flexShrink: 0,
            marginTop: compact ? 4 : 0, boxShadow: `0 0 10px ${pal.teal}`,
            animation: reduced ? 'none' : 'awOpenBell 2.4s ease-out infinite',
          }} />
          <Mono style={{
            fontSize: compact ? 9.5 : 10.5, fontWeight: 700, letterSpacing: compact ? '0.2em' : '0.26em',
            textTransform: 'uppercase', color: pal.teal,
          }}>
            {opening ? 'Market opening' : WPOD.cdEyebrow}
          </Mono>
          <div style={{ marginLeft: compact ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
            <WChip icon={<Clock size={11} color={pal.ink2} strokeWidth={2.2} />}>{WPOD.open}</WChip>
            <WChip icon={<Check size={11} color={pal.teal} strokeWidth={2.4} />} color={pal.teal} solid>LOCKED IN</WChip>
          </div>
        </div>

        {!hasTarget ? (
          <div style={{ fontSize: 15, fontWeight: 700, color: pal.ink, lineHeight: 1.4 }}>{WPOD.noTarget}</div>
        ) : opening ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: compact ? 24 : 28, fontWeight: 800, color: pal.ink, letterSpacing: '-0.01em' }}>
              {WPOD.opening}
            </div>
            <div style={{ fontSize: 12.5, color: pal.ink2, lineHeight: 1.45 }}>{WPOD.openingSub}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 14 : 26, flexWrap: compact ? 'wrap' : 'nowrap' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: compact ? 6 : 10, flexShrink: 0,
              margin: compact ? '0 auto' : 0,
            }}>
              {segs.map(([v, lb], i) => (
                <React.Fragment key={lb}>
                  {i > 0 && (
                    <Mono aria-hidden="true" style={{
                      fontSize: dense ? (compact ? 28 : 32) : (compact ? 40 : 44), fontWeight: 400,
                      color: alpha(pal.teal, 0.45), lineHeight: 1, paddingTop: compact ? 3 : 5,
                      animation: reduced ? 'none' : 'awOpenColon 1s steps(1,end) infinite',
                    }}>:</Mono>
                  )}
                  <CDNum value={v} label={lb} compact={compact} dense={dense} pal={pal} />
                </React.Fragment>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: compact ? '100%' : 240 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
                <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', color: pal.ink3 }}>THE WAIT</Mono>
                <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', color: alpha(pal.teal, 0.8) }}>OPENING BELL</Mono>
              </div>
              <TickRail pct={pct} color={pal.teal} ticks={compact ? 10 : 16} h={7} live={!reduced} />
              <p style={{ margin: '10px 0 0', fontSize: compact ? 11 : 11.5, color: pal.ink2, lineHeight: 1.45 }}>
                {WPOD.cdFoot}
              </p>
            </div>

            {!compact && startDay && (
              <div style={{ flexShrink: 0, alignSelf: 'flex-end', paddingBottom: 2 }}>
                <RunStrip startDay={startDay} pal={pal} />
              </div>
            )}
          </div>
        )}

        {compact && startDay && !opening && hasTarget && (
          <div style={{ marginTop: 12 }}><RunStrip startDay={startDay} compact pal={pal} /></div>
        )}

        <div style={{
          marginTop: compact ? 12 : 11, paddingTop: compact ? 11 : 10,
          borderTop: `1px solid ${alpha(pal.teal, 0.14)}`,
        }}>
          <MathStrip mode={mode} compact={compact} pal={pal} />
        </div>
      </div>
    </section>
  );
}
