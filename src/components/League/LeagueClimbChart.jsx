// src/components/League/LeagueClimbChart.jsx
//
// THE ALTITUDE CLIMB — the colorful, kinetic five-day pod standing: four climbers
// in vivid identity colors on the dark obsidian stage, altitude carrying hue
// energy, gold on the leader, glow that fires on rising tracks and rests
// otherwise. Ported from the Claude Design prototype (league-climb.jsx) into the
// redesign's tokens/parts; keyframes live in league.css; JS-driven motion (the
// line draw) is reduced-motion-gated via clbReduce(). Height = the CUMULATIVE
// combined score of record — never a daily delta, and never a combine formula.

import React from 'react';
import { LTOKENS, LX, alpha, MONO } from './leagueTokens';
import { Mono, LIcon, CountScore } from './LeagueParts';
import {
  climbSeats, CLB_ORDER, CLB_YOU, CLB_DAYS, clbColor, clbHi, clbLo, clbReduce,
} from './leagueClimbFixtures';

// chip-label vertical de-collision: keep order, enforce a min gap, clamp to range
function clbSpread(items, minGap, top, bottom) {
  const out = items.map((it) => ({ ...it, y: it.target }));
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < minGap) out[i].y = out[i - 1].y + minGap;
  const over = out[out.length - 1].y - bottom;
  if (over > 0) out.forEach((it) => { it.y -= over; });
  if (out[0].y < top) { const d = top - out[0].y; out.forEach((it) => { it.y += d; }); }
  return out;
}

// ── geometry — taller than a chart, a dramatic vertical range ───────────────
const CW = 352, CH = 332;
const CPADL = 22, CPADR = 96, CPADT = 22, CPADB = 48;
const cX = (i) => CPADL + (i / 4) * (CW - CPADL - CPADR);
const CPLOT_T = CPADT, CPLOT_B = CH - CPADB;
const CDOMAIN = [-3.6, 11.6];
const cY = (s) => CPLOT_B - ((s - CDOMAIN[0]) / (CDOMAIN[1] - CDOMAIN[0])) * (CPLOT_B - CPLOT_T);

// detect order-swaps (overtakes) in the visible range → spark coordinates
function clbOvertakes(seats, lastIdx) {
  const out = [];
  for (let i = 0; i < lastIdx; i++) {
    for (let a = 0; a < seats.length; a++) {
      for (let b = a + 1; b < seats.length; b++) {
        const A = seats[a], B = seats[b];
        const d0 = A.scores[i] - B.scores[i], d1 = A.scores[i + 1] - B.scores[i + 1];
        if (d0 === 0 || d1 === 0 || (d0 < 0) === (d1 < 0)) continue;       // no swap
        const t = -d0 / (d1 - d0);
        const x = cX(i) + t * (cX(i + 1) - cX(i));
        const sc = A.scores[i] + t * (A.scores[i + 1] - A.scores[i]);
        const climber = (A.scores[i + 1] - A.scores[i]) > (B.scores[i + 1] - B.scores[i]) ? A : B;
        out.push({ x, y: cY(sc), seg: i, you: A.you || B.you, climber: climber.id });
      }
    }
  }
  return out;
}

const linePath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const segPath = (a, b) => `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
const risingSegs = (pts) => {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].y <= pts[i].y) segs.push([pts[i], pts[i + 1]]);
  return segs;
};

// ════════════════════ THE ALTITUDE CLIMB ════════════════════════════════════
export function AltitudeClimb({ mode, focusLine, onDay, onPlayer }) {
  const reduce = clbReduce();
  const live = mode === 'live';
  const lastIdx = live ? 3 : 4;
  const solidThrough = live ? 2 : 4;
  const seats = climbSeats();

  const atLast = (s) => s.scores[lastIdx];
  const ranked = [...seats].sort((a, b) => atLast(b) - atLast(a));
  const leaderId = ranked[0].id;
  const youSeat = seats.find((s) => s.you);
  const youRank = ranked.findIndex((s) => s.id === CLB_YOU);
  const above = youRank > 0 ? ranked[youRank - 1] : null;
  const gapToAbove = above ? +(atLast(above) - atLast(youSeat)).toFixed(1) : 0;

  const dimmed = (s) => focusLine && focusLine !== s.id;           // solo only; no default graying
  const roleWidth = (s) => (s.you ? 3.4 : s.id === leaderId ? 3 : 2.4);

  // per-line point sets (solid banked run + live leading edge)
  const lineData = seats.map((s) => {
    const solid = [];
    for (let i = 0; i <= Math.min(solidThrough, lastIdx); i++) solid.push({ x: cX(i), y: cY(s.scores[i]), s: s.scores[i] });
    const edge = live ? [{ x: cX(solidThrough), y: cY(s.scores[solidThrough]) }, { x: cX(3), y: cY(s.scores[3]) }] : null;
    return { seat: s, solid, edge, head: { x: cX(lastIdx), y: cY(s.scores[lastIdx]), s: s.scores[lastIdx] } };
  });

  // head chip column (de-collided)
  const chips = {};
  clbSpread(
    [...lineData].sort((a, b) => a.head.y - b.head.y).map((l) => ({ id: l.seat.id, target: l.head.y })),
    30, CPLOT_T + 6, CPLOT_B - 4,
  ).forEach((c) => { chips[c.id] = c.y; });

  const zeroY = cY(0), summitY = cY(8);
  const overtakes = clbOvertakes(seats, lastIdx).filter((o) => o.you);   // show the ones that touch you

  return (
    <div style={{ position: 'relative', width: CW, height: CH, margin: '0 auto' }}>
      <svg width={CW} height={CH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          {/* altitude hue: each climber's stroke cools toward sea level, brightens toward the summit */}
          {seats.map((s) => (
            <linearGradient key={s.id} id={`clbgrad-${s.id}`} gradientUnits="userSpaceOnUse" x1="0" y1={CPLOT_B} x2="0" y2={CPLOT_T}>
              <stop offset="0" stopColor={clbLo(s.color)} />
              <stop offset="0.4" stopColor={s.color} />
              <stop offset="1" stopColor={clbHi(s.color)} />
            </linearGradient>
          ))}
          {/* the slope wash — cool deep base → warm energized summit */}
          <linearGradient id="clbSlope" x1="0" y1={CPLOT_B} x2="0" y2={CPLOT_T} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#10131C" />
            <stop offset="0.5" stopColor="#141019" />
            <stop offset="1" stopColor="#1A1614" />
          </linearGradient>
          <radialGradient id="clbSummit" cx="0.5" cy="0" r="0.9">
            <stop offset="0" stopColor={alpha(LTOKENS.gold, 0.16)} />
            <stop offset="1" stopColor={alpha(LTOKENS.gold, 0)} />
          </radialGradient>
        </defs>

        {/* slope backdrop + summit glow + below-sea-level band */}
        <rect x={CPADL} y={CPLOT_T} width={CW - CPADL - CPADR} height={CPLOT_B - CPLOT_T} fill="url(#clbSlope)" rx="10" />
        <rect x={CPADL} y={CPLOT_T} width={CW - CPADL - CPADR} height={summitY - CPLOT_T} fill="url(#clbSummit)" />
        <rect x={CPADL} y={zeroY} width={CW - CPADL - CPADR} height={CPLOT_B - zeroY} fill={alpha(LX.neg, 0.05)} />

        {/* altitude contour lines (topographic, hairline) */}
        {[10, 5, 0, -3].map((g) => (
          <g key={g}>
            <line x1={CPADL} y1={cY(g)} x2={CW - CPADR} y2={cY(g)}
              stroke={g === 0 ? alpha(LTOKENS.teal, 0.22) : 'rgba(255,255,255,0.05)'} strokeWidth={g === 0 ? 1.2 : 1}
              strokeDasharray={g === 0 ? '0' : '1 5'} />
            <text x={CPADL - 5} y={cY(g) + 3} textAnchor="end" fontFamily={MONO} fontSize="8"
              fill={g === 0 ? alpha(LTOKENS.teal, 0.7) : LTOKENS.ink3}>{g === 0 ? '0' : (g > 0 ? `+${g}` : g)}</text>
          </g>
        ))}
        <text x={CPADL - 5} y={CPLOT_T + 8} textAnchor="end" fontFamily={MONO} fontSize="7" fill={alpha(LTOKENS.gold, 0.6)} letterSpacing="0.1em">PEAK</text>

        {/* day gates — checkpoints the climbers pass through */}
        {CLB_DAYS.map((_, i) => {
          const ghost = live && i > 3, isLive = live && i === 3, banked = !live || i < 3;
          const gc = isLive ? alpha(LTOKENS.teal, 0.5) : ghost ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)';
          return (
            <g key={i}>
              <line x1={cX(i)} y1={CPLOT_T} x2={cX(i)} y2={CPLOT_B} stroke={gc} strokeWidth={1} strokeDasharray={ghost ? '2 5' : '0'} />
              <circle cx={cX(i)} cy={CPLOT_T - 1} r={isLive ? 3 : 2} fill={isLive ? LTOKENS.teal : banked ? LTOKENS.ink3 : 'transparent'}
                stroke={ghost ? LTOKENS.ink3 : 'none'} strokeWidth={1} strokeDasharray={ghost ? '1 2' : '0'} />
            </g>
          );
        })}

        {/* you's tether to sea level */}
        {(() => { const yl = lineData.find((l) => l.seat.you); return (
          <line x1={yl.head.x} y1={yl.head.y} x2={yl.head.x} y2={zeroY} stroke={alpha(LTOKENS.teal, 0.28)} strokeWidth={1} strokeDasharray="2 3" />
        ); })()}

        {/* tracks — background climbers first, you + leader painted on top */}
        {lineData.slice().sort((a, b) => {
          const w = (l) => (l.seat.you ? 2 : l.seat.id === leaderId ? 1 : 0);
          return w(a) - w(b);
        }).map((l) => {
          const s = l.seat, dim = dimmed(s);
          const baseOp = dim ? 0.14 : (s.you || s.id === leaderId ? 1 : 0.9);
          const idx = CLB_ORDER.indexOf(s.id);
          return (
            <g key={s.id} style={{ opacity: baseOp, transition: 'opacity .3s ease' }}>
              {/* glow underlay — only on rising segments (a fall loses its glow) */}
              {!dim && risingSegs(l.solid).map(([a, b], k) => (
                <path key={k} d={segPath(a, b)} fill="none" stroke={s.color} strokeWidth={roleWidth(s) + 6}
                  strokeLinecap="round" className="clb-glow" style={{ '--go': s.you ? 0.6 : 0.42, filter: 'blur(5px)' }} />
              ))}
              {/* the solid banked climb */}
              <path d={linePath(l.solid)} fill="none" stroke={`url(#clbgrad-${s.id})`} strokeWidth={roleWidth(s)}
                strokeLinecap="round" strokeLinejoin="round" className="clb-draw"
                ref={(el) => {
                  if (!el) return;
                  // reduced motion: render solid, no draw — set the dash explicitly
                  // rather than relying on an unset --len resolving to "none".
                  if (reduce) { el.style.strokeDasharray = 'none'; return; }
                  const len = el.getTotalLength();
                  el.style.setProperty('--len', len);
                  el.style.animationDelay = `${idx * 80}ms`;
                }} />
              {/* live leading edge — still climbing */}
              {l.edge && (
                <path d={linePath(l.edge)} fill="none" stroke={s.color} strokeWidth={roleWidth(s)} strokeLinecap="round"
                  strokeOpacity={0.9} style={{ strokeDasharray: '2.5 5', animation: reduce ? 'none' : 'otDashFlow 1s linear infinite' }} />
              )}
              {/* banked waypoint nodes */}
              {l.solid.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={s.you ? 3 : 2.4} fill={LTOKENS.bg} stroke={s.color} strokeWidth={s.you ? 2 : 1.6} />
              ))}
            </g>
          );
        })}

        {/* overtake flares — the hero moment, gated to events that touch you */}
        {!reduce && overtakes.map((o, i) => (
          <g key={i}>
            <circle cx={o.x} cy={o.y} r={7} fill="none" stroke={clbColor(o.climber)} strokeWidth={1.5}
              style={{ transformOrigin: `${o.x}px ${o.y}px`, animation: `clbFlare 2.2s ease-out ${1 + i * 0.3}s infinite` }} />
            <circle cx={o.x} cy={o.y} r={2.2} fill={clbColor(o.climber)} />
          </g>
        ))}

        {/* climber heads — glowing node; leader carries a gold aura ring on top */}
        {lineData.map((l) => {
          const s = l.seat, dim = dimmed(s), isLead = s.id === leaderId;
          return (
            <g key={s.id} className="clb-head" style={{ opacity: dim ? 0.2 : 1, transformOrigin: `${l.head.x}px ${l.head.y}px`,
              animationDelay: `${0.5 + CLB_ORDER.indexOf(s.id) * 0.08}s` }}>
              {/* connector to the chip */}
              <line x1={l.head.x} y1={l.head.y} x2={l.head.x + 13} y2={chips[s.id]} stroke={s.color} strokeWidth={1} strokeOpacity={0.45} />
              {/* breathing aura on you + leader while live */}
              {live && (s.you || isLead) && !reduce && (
                <circle cx={l.head.x} cy={l.head.y} r={6} fill={s.color}
                  style={{ transformOrigin: `${l.head.x}px ${l.head.y}px`, animation: 'clbBreathe 2.6s ease-in-out infinite' }} />
              )}
              {/* gold leader aura layered on top of their identity color */}
              {isLead && <circle cx={l.head.x} cy={l.head.y} r={s.you ? 9 : 8} fill="none" stroke={LTOKENS.gold} strokeWidth={2} strokeOpacity={0.85} />}
              <circle cx={l.head.x} cy={l.head.y} r={s.you ? 6 : 5} fill={s.color} stroke={LTOKENS.bg} strokeWidth={1.5} />
              {/* generous tap target */}
              {onPlayer && <circle cx={l.head.x} cy={l.head.y} r={15} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPlayer(s.id)} />}
            </g>
          );
        })}
      </svg>

      {/* head chips — vivid identity + crisp score (HTML overlay) */}
      {lineData.map((l) => {
        const s = l.seat, isLead = s.id === leaderId, dim = dimmed(s);
        const c = s.color, top = chips[s.id];
        return (
          <div key={s.id} className="clb-glow" style={{ position: 'absolute', left: l.head.x + 16, top: top - 12,
            display: 'flex', alignItems: 'center', gap: 5, opacity: dim ? 0.3 : 1, pointerEvents: 'none', '--go': 1,
            animationDelay: `${0.55 + CLB_ORDER.indexOf(s.id) * 0.08}s` }}>
            {(s.you || isLead) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 5,
                background: alpha(isLead ? LTOKENS.gold : c, 0.18), border: `1px solid ${alpha(isLead ? LTOKENS.gold : c, 0.45)}` }}>
                {isLead && <LIcon name="crown" size={9} color={LTOKENS.gold} stroke={2.2} />}
                <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: isLead ? LTOKENS.gold : c }}>{s.you ? 'YOU' : 'LEAD'}</Mono>
              </span>
            )}
            <CountScore value={l.head.s} size={s.you ? 14.5 : isLead ? 13.5 : 12} weight={s.you || isLead ? 700 : 600} />
          </div>
        );
      })}

      {/* gate labels (tappable) */}
      {CLB_DAYS.map((day, i) => {
        const ghost = live && i > 3, isLive = live && i === 3;
        const col = ghost ? LTOKENS.ink3 : isLive ? LTOKENS.teal : LTOKENS.ink2;
        const tappable = onDay && !ghost;
        return (
          <div key={i} className={tappable ? 'lg-tap' : ''} onClick={tappable ? () => onDay(i) : undefined}
            style={{ position: 'absolute', left: cX(i), top: CPLOT_B + 9, transform: 'translateX(-50%)', textAlign: 'center',
              opacity: ghost ? 0.5 : 1, cursor: tappable ? 'pointer' : 'default', padding: '2px 7px 0' }}>
            <Mono style={{ fontSize: 9, fontWeight: 700, color: col, letterSpacing: '0.04em', display: 'block' }}>{day.wd}</Mono>
            <Mono style={{ fontSize: 7.5, color: LTOKENS.ink3, display: 'block', marginTop: 1 }}>{day.d}</Mono>
            {isLive && <span style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', background: LTOKENS.teal, margin: '3px auto 0', animation: reduce ? 'none' : 'lgLiveDot 1.6s infinite' }} />}
          </div>
        );
      })}

      {/* gap callout — you ↔ the climber directly above */}
      {above && (() => {
        const yl = lineData.find((l) => l.seat.you);
        return (
          <div style={{ position: 'absolute', left: yl.head.x - 6, top: yl.head.y - 27, transform: 'translateX(-100%)', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6,
              background: alpha(LTOKENS.teal, 0.12), border: `1px solid ${alpha(LTOKENS.teal, 0.32)}` }}>
              <LIcon name="long" size={9} color={LTOKENS.teal} stroke={2.4} />
              <Mono style={{ fontSize: 8.5, fontWeight: 700, color: LTOKENS.teal }}>{gapToAbove.toFixed(1)} to climb</Mono>
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ── legend / solo control — four vivid identity swatches ────────────────────
export function ClimbLegend({ mode, focusLine, onFocus }) {
  const lastIdx = mode === 'live' ? 3 : 4;
  const seats = climbSeats();
  const ranked = [...seats].sort((a, b) => b.scores[lastIdx] - a.scores[lastIdx]);
  const leaderId = ranked[0].id;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 }}>
      {seats.map((s) => {
        const sel = focusLine === s.id, on = !focusLine || sel;
        const c = s.color, isLead = s.id === leaderId;
        return (
          <button key={s.id} className="lg-tap" onClick={() => onFocus(sel ? null : s.id)}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px',
              borderRadius: 999, opacity: on ? 1 : 0.4, transition: 'opacity .2s ease',
              background: sel ? alpha(c, 0.14) : LTOKENS.surface, border: `1px solid ${sel ? alpha(c, 0.45) : LTOKENS.hair}` }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0,
              boxShadow: `0 0 7px ${alpha(c, 0.7)}`, border: isLead ? `1.5px solid ${LTOKENS.gold}` : 'none' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: LTOKENS.ink }}>{s.name}</span>
            {s.you && <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: c }}>YOU</Mono>}
            {s.kind === 'cpu' && <Mono style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: LX.cpu }}>CPU</Mono>}
          </button>
        );
      })}
    </div>
  );
}
