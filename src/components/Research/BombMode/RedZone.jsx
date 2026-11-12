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
// THE DANGER ZONE (refinement 2026-11-10, BD-5) is this layout with side="down":
// the next unhit DOWNSIDE rung is the goal line (below the price, in the
// downside levels' own red, --ft-neg since BP-2; no amber heat), the distance above it is the big number, the chip reads
// "Danger zone" (BombPlot's chip). A hit plays NO moment: one quiet line names a
// hit the modal saw ("Bust · −10 · hit at the 1:15 check"), and the zone
// re-bases or leaves.
//
// The trace (BA-6): the minute bars as a line to their last bar, then the quotes
// observed while the modal is open as separate dots — the gap is drawn, never
// interpolated, and the line's end is labelled with its bars' real interval.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { BT, HEAT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { priceText } from '../priceFormat.js';
import { etClock, etClockAmPm } from './checkClock.js';
import { checkNameAt } from './bombView.js';
import { rungShown } from './ladder.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const HOUR_MS = 60 * 60 * 1000;

/** The big numeral and the line under it, from the displayed values (ladder.toGo). */
export function distanceText(go) {
  if (!go) return null;
  if (go.side === 'down') {
    if (go.distance <= 0) return { big: money(Math.abs(go.distance), go.decimals), sub: BOMB_COPY.dangerBelowSub(go.rung.label, go.rung.points) };
    return { big: money(go.distance, go.decimals), sub: BOMB_COPY.dangerDistanceSub(go.rung.label, go.rung.points, go.pctShown) };
  }
  if (go.distance <= 0) return { big: money(Math.abs(go.distance), go.decimals), sub: BOMB_COPY.aboveSub(go.rung.points) };
  return { big: money(go.distance, go.decimals), sub: BOMB_COPY.distanceSub(go.rung.points, go.pctShown) };
}

/** BD-5: the Danger Zone's one quiet line for the deepest hit the modal SAW (BA-4: its check only when seen). */
export function hitLineText(ladder, hitTimes = {}) {
  const seen = [...(ladder?.down || [])].reverse().find((r) => r.hit && Object.prototype.hasOwnProperty.call(hitTimes, r.key));
  return seen ? BOMB_COPY.downHitLine(seen.label, seen.points, checkNameAt(hitTimes[seen.key])) : null;
}

export default function RedZone({ ladder, go, live, decimals, mode, trace, clock, scoredText, moment = null, nowMs, side = 'up', hitTimes = {}, width = 360, height = 300 }) {
  const reduced = useReducedMotion() === true;
  const W = Math.max(280, width);
  const H = Math.max(200, height);
  const d = decimals;
  const down = side === 'down';
  const frozen = mode === 'closed' || mode === 'dangerClosed';
  const showMoment = !down && mode === 'banked' && !!moment;
  const goalRung = down ? ladder.nextDown : ladder.next;
  // BP-2 (2026-11-11): ONE red. The Danger Zone draws in BT.red (--ft-neg), the red
  // the downside levels use in the Fuse, the bar and the table; BT.risk stays only
  // in the red zone's heat mix (HEAT), where Build A used it.
  const accent = down ? BT.red : HEAT;
  // Review D1–D4 (2026-11-11; refuter D's tested layout), and BP-4 for the red zone
  // (side up): the text is one flow column — the tags (which may wrap), then the
  // numeral, its sub-line and (down) the quiet hit line — and the trace's plot
  // starts under the column's measured bottom, so neither a wrapped tag row, the
  // hit line nor a trace can land on the numeral. The red zone's banked moment
  // keeps Build A's plot (its column holds only the tags; the moment is centred).
  const colRef = React.useRef(null);
  const [colBottom, setColBottom] = React.useState(null);
  React.useLayoutEffect(() => {
    if (!colRef.current) return;
    const b = colRef.current.offsetTop + colRef.current.offsetHeight;
    if (b !== colBottom) setColBottom(b);
  });
  const top = showMoment ? 46 : Math.max(46, (colBottom ?? 100) + 10);
  const bot = H - 70;
  const x0 = 16;
  const x1 = W - 34;

  const goal = go ? go.rungShown : goalRung ? rungShown(goalRung, d) : null;
  const lastBanked = down ? null : [...ladder.up].reverse().find((r) => r.banked) || null;
  const values = [...trace.line.map((p) => p.c), ...trace.dots.map((o) => o.price), ...(finite(live) ? [live] : [])];
  let hi;
  let lo;
  if (down) {
    // The mirror: the goal is the window's floor, with a ceiling 1 % over the live price.
    lo = Math.min(goal ?? Infinity, ...values);
    hi = Math.max(goal ?? 0, finite(live) ? live * 1.01 : 0, ...values); // the goal always in the window (review D4)
    if (!(lo < hi)) hi = lo * 1.01;
  } else {
    // The goal is the window's ceiling; BP-4 (review D4's mirror): it is also never
    // above the floor, so a live price over the rung keeps the goal line in the plot.
    const floor = Math.max(finite(live) ? live * 0.99 : 0, lastBanked ? lastBanked.price : 0);
    hi = Math.max(goal ?? 0, ...values);
    lo = Math.min(floor > 0 ? floor : hi, goal ?? Infinity, ...values);
    if (!(lo < hi)) lo = hi * 0.99;
  }
  const Y = (v) => top + ((hi - v) / (hi - lo)) * (bot - top);

  const lastDotMs = trace.dots.length ? trace.dots[trace.dots.length - 1].atMs : null;
  const endMs = frozen
    ? Math.max(trace.lastBarMs ?? 0, lastDotMs ?? 0) || nowMs
    : Math.max(trace.lastBarMs ?? 0, lastDotMs ?? 0, finite(nowMs) ? nowMs : 0);
  const startMs = trace.line.length ? Math.min(trace.line[0].t, endMs - HOUR_MS) : endMs - HOUR_MS;
  const X = (t) => x0 + ((t - startMs) / Math.max(1, endMs - startMs)) * (x1 - x0);
  const linePath = trace.line.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.c).toFixed(1)}`).join(' ');
  const lastLine = trace.line.length ? trace.line[trace.line.length - 1] : null;
  // "Last tick" names a tick: a minute bar or a quote seen while open — never a
  // 30-minute bar's open (review A8: "last tick 3:30 PM" for a bar that closed at 4:00).
  const lastTickBarMs = trace.intervalMin === 1 ? trace.lastBarMs : null;
  const lastTickMs = Math.max(lastTickBarMs ?? 0, lastDotMs ?? 0) || null;
  const dist = distanceText(go);
  // The floor's distance from the DISPLAYED live price (it is live × 0.99 only when no trace value is lower).
  const floorPct = !down && finite(live) ?((Number(priceText(lo, d)) - Number(priceText(live, d))) / Number(priceText(live, d))) * 100 : null;
  const goalY = goal !== null ? Math.max(top, Math.min(bot, Y(goal))) : down ? bot : top;
  const hitLine = down ? hitLineText(ladder, hitTimes) : null;
  const momentRung = showMoment ? ladder.up.find((r) => r.key === moment.key) : null;
  const pop = motionToken('bouncy', { reducedMotion: reduced });

  return (
    <div data-bomb-view={down ? 'dangerzone' : 'redzone'} {...(down ? { 'data-dangerzone-state': frozen ? 'closed' : 'live' } : { 'data-redzone-state': showMoment ? 'banked' : frozen ? 'closed' : 'approaching' })}
      style={{ position: 'relative', width: '100%', height: H, background: BT.bg, overflow: 'hidden', fontFamily: MONO }}>
      <svg width={W} height={H} style={{ display: 'block', position: 'absolute', inset: 0 }} aria-label={down ? BOMB_COPY.dangerAriaZone : BOMB_COPY.ariaRedZone}>
        {!down && (
          <defs>
            <linearGradient id="bombRzHeat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: HEAT, stopOpacity: showMoment ? 0.07 : frozen ? 0.1 : 0.26 }} />
              <stop offset="1" style={{ stopColor: HEAT, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
        )}
        {!down && <rect x="0" y={goalY} width={W} height={Math.max(0, bot - goalY)} style={{ fill: 'url(#bombRzHeat)' }} />}
        {!down && (lastBanked && Math.abs(lo - lastBanked.price) < 1e-9
          ? <rect x="0" y={bot - 2} width={W} height={4} style={{ fill: BT.green }} />
          : <line x1="0" y1={bot} x2={W} y2={bot} strokeDasharray="3 4" style={{ stroke: tint(BT.ink, 28) }} />)}
        {linePath && <path data-rz-trace-line="1" d={linePath} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: BT.teal }} />}
        {trace.dots.map((o, i) => <circle key={i} data-rz-observation="1" cx={X(o.atMs)} cy={Y(o.price)} r="2.4" style={{ fill: frozen ? BT.ink3 : accent }} />)}
        {lastLine && (
          <text data-rz-trace-end="1" x={W - 12} y={bot + 12} textAnchor="end" fontSize="8" letterSpacing="0.5" style={{ fill: BT.ink3 }}>
            {BOMB_COPY.traceEnd(BOMB_COPY.traceInterval(trace.intervalMin ?? 1), etClock(lastLine.t)).toUpperCase()}
          </text>
        )}
        {!lastLine && <text x={W - 12} y={bot + 12} textAnchor="end" fontSize="8" letterSpacing="0.5" style={{ fill: BT.ink3 }}>{BOMB_COPY.noBars.toUpperCase()}</text>}
        {!frozen && finite(live) && (
          <g data-rz-bead="1">
            <circle cx={x1 + 12} cy={Y(live)} r="14" style={{ fill: accent, opacity: 0.25 }} />
            <circle cx={x1 + 12} cy={Y(live)} r="4.5" style={{ fill: BT.core }} />
          </g>
        )}
        {frozen && lastLine && <circle cx={X(lastLine.t)} cy={Y(lastLine.c)} r="4.5" strokeWidth="1.5" style={{ fill: BT.bg, stroke: BT.ink2 }} />}
        <rect data-rz-goal={down ? 'down' : 'up'} x="0" y={goalY - 2} width={W} height={4} style={{ fill: down ? BT.red : BT.gold }} />
      </svg>

      <div ref={colRef} style={{ position: 'absolute', left: 12, top: 10, right: 12 }}>
      <div data-rz-tags="1" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag color={BT.teal}>{BOMB_COPY.yourPosition}</Tag>
        {frozen && <Tag color={BT.ink2} dim>{lastTickMs ? BOMB_COPY.marketClosed(etClockAmPm(lastTickMs)) : BOMB_COPY.marketClosedNoTick}</Tag>}
      </div>
      {dist && !showMoment && (
        <div data-rz-distance="1" style={{ marginTop: 11 }}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: frozen ? BT.ink2 : accent }}>{dist.big}</div>
          <div style={{ marginTop: 5, fontSize: 12, color: BT.ink2 }}>{dist.sub}</div>
          {hitLine && <div data-dz-hit-line="1" style={{ marginTop: 3, fontSize: 9.5, color: BT.ink2 }}>{hitLine}</div>}
        </div>
      )}
      {down && !dist && hitLine && <div data-dz-hit-line="1" style={{ marginTop: 8, fontSize: 9.5, color: BT.ink2 }}>{hitLine}</div>}
      </div>
      {goalRung && (
        // The goal's tag hugs the goal line inside the plot: the Danger Zone's above
        // its floor goal when there is room, the red zone's under its ceiling goal
        // (BP-4: held inside the plot, so it never reaches the text column).
        <div data-rz-goal-tag={down ? 'down' : 'up'} style={{ position: 'absolute', left: 12, top: down
          ? (goalY - 30 >= top - 2 ? Math.min(goalY - 30, bot - 26) : Math.min(goalY + 8, bot - 26))
          // (The banked moment keeps Build A's tag place, as it keeps Build A's plot — review D1.)
          : showMoment ? Math.min(goalY + 8, bot - 90) : (goalY + 8 <= bot - 26 ? goalY + 8 : Math.max(top, goalY - 30)) }}>
          <Tag color={down ? BT.red : BT.gold} solid>{down
            ? BOMB_COPY.dangerRungTag(goalRung.emoji, goalRung.label, goalRung.points, rungShown(goalRung, d), d)
            : BOMB_COPY.rungTag(goalRung.emoji, goalRung.label, goalRung.points, rungShown(goalRung, d), d)}</Tag>
        </div>
      )}
      {!down && <div data-rz-floor="1" style={{ position: 'absolute', left: 12, top: bot + 4, fontSize: 8, letterSpacing: '0.1em', fontWeight: 700, color: lastBanked && Math.abs(lo - lastBanked.price) < 1e-9 ? BT.green : BT.ink3 }}>
        {lastBanked && Math.abs(lo - lastBanked.price) < 1e-9 ? BOMB_COPY.floorBanked(lastBanked.label, lastBanked.points) : BOMB_COPY.floorLabel(lo, d, floorPct)}
      </div>}

      {showMoment && momentRung && (
        <motion.div data-rz-banked-moment="1" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={pop}
          style={{ position: 'absolute', left: 0, right: 0, top: (top + bot) / 2 - 56, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, color: BT.green }}>{BOMB_COPY.bankedBig(Number.isFinite(moment.points) && moment.points > 0 ? moment.points : momentRung.points)}</div>
          <div style={{ marginTop: 8, fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, color: BT.green }}>
            {BOMB_COPY.bankedLine(finite(moment.atMs) ? etClock(moment.atMs) : null, moment.price, d).toUpperCase()}
          </div>
        </motion.div>
      )}

      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        {scoredText
          ? <span data-rz-scored="1" style={{ fontSize: 10, fontWeight: 700, padding: '5px 8px', borderRadius: 7, background: tint(BT.bg, 92), border: `1px solid ${tint(BT.ink, 12)}`, color: BT.ink2, whiteSpace: 'normal', lineHeight: 1.25, minWidth: 0 }}>{scoredText}</span>
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
