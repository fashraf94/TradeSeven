// src/components/Research/BombMode/RedZone.jsx
//
// Research Modal Build A — THE RED ZONE (spec §1, §3.5, §4.3; concept V1.1
// §2.6; batch-1 design screens 6a–6c for structure only). A mode, not a chart
// style: the next rung is the goal line, the last hour is one pulse trace, the
// distance to the rung is the biggest number on screen, and a clock counts to
// the scoring check — because points bank only at a check.
//
//   (a) approaching  goal line · trace · distance · % · clock · LIVE·SCORED · your position
//   (b) banked       the one loud moment (motion token `bouncy`; reduced motion: a static state)
//   (c) closed       the trace frozen · "Market closed · last tick {time}" · the next check's day and time
//
// The trace (BA-6): the minute bars as a line to their last bar, then the quotes
// observed while the modal is open as separate dots — the gap is drawn, never
// interpolated, and the line's end is labelled with its bars' real interval.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { BT, HEAT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { etClock, etClockAmPm } from './checkClock.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const HOUR_MS = 60 * 60 * 1000;

/** The big numeral and the line under it, from the displayed values (ladder.toGo). */
export function distanceText(go) {
  if (!go) return null;
  if (go.distance <= 0) return { big: money(Math.abs(go.distance), go.decimals), sub: BOMB_COPY.aboveSub(go.rung.points) };
  return { big: money(go.distance, go.decimals), sub: BOMB_COPY.distanceSub(go.rung.points, go.pct) };
}

export default function RedZone({ ladder, go, live, decimals, mode, trace, clock, scoredText, moment = null, nowMs, width = 360, height = 300 }) {
  const reduced = useReducedMotion() === true;
  const W = Math.max(280, width);
  const H = Math.max(240, height);
  const d = decimals;
  const frozen = mode === 'closed';
  const showMoment = mode === 'banked' && !!moment;
  const top = 46;
  const bot = H - 50;
  const x0 = 16;
  const x1 = W - 34;

  const goal = go ? go.rungShown : ladder.next?.price ?? null;
  const lastBanked = [...ladder.up].reverse().find((r) => r.banked) || null;
  const values = [...trace.line.map((p) => p.c), ...trace.dots.map((o) => o.price), ...(finite(live) ? [live] : [])];
  const floor = Math.max(finite(live) ? live * 0.99 : 0, lastBanked ? lastBanked.price : 0);
  const hi = Math.max(goal ?? 0, ...values);
  let lo = Math.min(floor > 0 ? floor : hi, ...values);
  if (!(lo < hi)) lo = hi * 0.99;
  const Y = (v) => top + ((hi - v) / (hi - lo)) * (bot - top);

  const lastDotMs = trace.dots.length ? trace.dots[trace.dots.length - 1].atMs : null;
  const endMs = frozen
    ? Math.max(trace.lastBarMs ?? 0, lastDotMs ?? 0) || nowMs
    : Math.max(trace.lastBarMs ?? 0, lastDotMs ?? 0, finite(nowMs) ? nowMs : 0);
  const startMs = trace.line.length ? Math.min(trace.line[0].t, endMs - HOUR_MS) : endMs - HOUR_MS;
  const X = (t) => x0 + ((t - startMs) / Math.max(1, endMs - startMs)) * (x1 - x0);
  const linePath = trace.line.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.c).toFixed(1)}`).join(' ');
  const lastLine = trace.line.length ? trace.line[trace.line.length - 1] : null;
  const lastTickMs = Math.max(trace.lastBarMs ?? 0, lastDotMs ?? 0) || null;
  const dist = distanceText(go);
  const goalY = goal !== null ? Y(goal) : top;
  const momentRung = showMoment ? ladder.up.find((r) => r.key === moment.key) : null;
  const pop = motionToken('bouncy', { reducedMotion: reduced });

  return (
    <div data-bomb-view="redzone" data-redzone-state={showMoment ? 'banked' : frozen ? 'closed' : 'approaching'}
      style={{ position: 'relative', width: '100%', height: H, background: BT.bg, overflow: 'hidden', fontFamily: MONO }}>
      <svg width={W} height={H} style={{ display: 'block', position: 'absolute', inset: 0 }} aria-label="Red zone: the next rung as the goal line and the last hour of prices">
        <defs>
          <linearGradient id="bombRzHeat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: HEAT, stopOpacity: showMoment ? 0.07 : frozen ? 0.1 : 0.26 }} />
            <stop offset="1" style={{ stopColor: HEAT, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <rect x="0" y={goalY} width={W} height={Math.max(0, bot - goalY)} style={{ fill: 'url(#bombRzHeat)' }} />
        {lastBanked && Math.abs(lo - lastBanked.price) < 1e-9
          ? <rect x="0" y={bot - 2} width={W} height={4} style={{ fill: BT.green }} />
          : <line x1="0" y1={bot} x2={W} y2={bot} strokeDasharray="3 4" style={{ stroke: tint(BT.ink, 28) }} />}
        {linePath && <path data-rz-trace-line="1" d={linePath} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: BT.teal }} />}
        {trace.dots.map((o, i) => <circle key={i} data-rz-observation="1" cx={X(o.atMs)} cy={Y(o.price)} r="2.4" style={{ fill: frozen ? BT.ink3 : HEAT }} />)}
        {lastLine && (
          <text data-rz-trace-end="1" x={Math.min(X(lastLine.t), x1) - 4} y={Math.max(top + 54, Y(lastLine.c) - 8)} textAnchor="end" fontSize="8" letterSpacing="0.5" style={{ fill: BT.ink3 }}>
            {BOMB_COPY.traceEnd(BOMB_COPY.traceInterval(trace.intervalMin ?? 1), etClock(lastLine.t)).toUpperCase()}
          </text>
        )}
        {!lastLine && <text x={x0} y={(top + bot) / 2} fontSize="9" style={{ fill: BT.ink3 }}>{BOMB_COPY.noBars.toUpperCase()}</text>}
        {!frozen && finite(live) && (
          <g data-rz-bead="1">
            <circle cx={x1 + 12} cy={Y(live)} r="14" style={{ fill: HEAT, opacity: 0.25 }} />
            <circle cx={x1 + 12} cy={Y(live)} r="4.5" style={{ fill: BT.core }} />
          </g>
        )}
        {frozen && lastLine && <circle cx={X(lastLine.t)} cy={Y(lastLine.c)} r="4.5" strokeWidth="1.5" style={{ fill: BT.bg, stroke: BT.ink2 }} />}
        <rect data-rz-goal="1" x="0" y={goalY - 2} width={W} height={4} style={{ fill: BT.gold }} />
      </svg>

      <div style={{ position: 'absolute', left: 12, top: 10, display: 'flex', gap: 6, flexWrap: 'wrap', right: 12 }}>
        <Tag color={BT.teal}>{BOMB_COPY.yourPosition}</Tag>
        {frozen && <Tag color={BT.ink2} dim>{lastTickMs ? BOMB_COPY.marketClosed(etClockAmPm(lastTickMs)) : BOMB_COPY.marketClosedNoTick}</Tag>}
      </div>
      {ladder.next && (
        <div style={{ position: 'absolute', left: 12, top: Math.min(goalY + 8, bot - 90) }}>
          <Tag color={BT.gold} solid>{BOMB_COPY.rungTag(ladder.next.emoji, ladder.next.label, ladder.next.points, ladder.next.price, d)}</Tag>
        </div>
      )}
      {dist && !showMoment && (
        <div data-rz-distance="1" style={{ position: 'absolute', left: 12, top: Math.min(goalY + 34, bot - 64) }}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: frozen ? BT.ink2 : HEAT }}>{dist.big}</div>
          <div style={{ marginTop: 5, fontSize: 12, color: BT.ink2 }}>{dist.sub}</div>
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, top: bot - 16, fontSize: 8, letterSpacing: '0.1em', fontWeight: 700, color: lastBanked && Math.abs(lo - lastBanked.price) < 1e-9 ? BT.green : BT.ink3 }}>
        {lastBanked && Math.abs(lo - lastBanked.price) < 1e-9 ? BOMB_COPY.floorBanked(lastBanked.label, lastBanked.points) : BOMB_COPY.floorLabel(lo, d)}
      </div>

      {showMoment && momentRung && (
        <motion.div data-rz-banked-moment="1" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={pop}
          style={{ position: 'absolute', left: 0, right: 0, top: (top + bot) / 2 - 56, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, color: BT.green }}>{BOMB_COPY.bankedBig(momentRung.points)}</div>
          <div style={{ marginTop: 8, fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, color: BT.green }}>
            {BOMB_COPY.bankedLine(finite(moment.atMs) ? etClock(moment.atMs) : null, moment.price, d).toUpperCase()}
          </div>
        </motion.div>
      )}

      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {scoredText
          ? <span data-rz-scored="1" style={{ fontSize: 10, fontWeight: 700, padding: '5px 8px', borderRadius: 7, background: tint(BT.bg, 92), border: `1px solid ${tint(BT.ink, 12)}`, color: BT.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{scoredText}</span>
          : <span />}
        {clock && clock.state !== 'none' && (
          <span data-rz-clock={clock.state} style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flexShrink: 0, textAlign: 'right' }}>
            <span style={{ fontSize: 7.5, letterSpacing: '0.16em', color: BT.ink3, fontWeight: 700 }}>{BOMB_COPY.nextCheck.toUpperCase()}</span>
            <span style={{ fontSize: clock.state === 'later' ? 11 : 15, fontWeight: 700, color: clock.state === 'later' ? BT.ink2 : BT.ink }}>{clock.label}</span>
          </span>
        )}
        {clock && clock.state === 'none' && <span style={{ fontSize: 9, color: BT.ink3 }}>{BOMB_COPY.noCheckLeft}</span>}
      </div>
    </div>
  );
}

function Tag({ children, color, dim = false, solid = false }) {
  return (
    <span style={{
      fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap',
      color: dim ? BT.ink2 : color, background: solid ? tint(BT.bg, 92) : dim ? tint(BT.ink, 5) : tint(color, 14),
      border: `1px solid ${dim ? tint(BT.ink, 12) : tint(color, 40)}`, padding: '3px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center',
    }}>
      {children}
    </span>
  );
}
