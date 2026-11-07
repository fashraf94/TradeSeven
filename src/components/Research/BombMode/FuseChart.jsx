// src/components/Research/BombMode/FuseChart.jsx
//
// Research Modal Build A — THE FUSE (spec §4.3; Amendment A R-11′(a), R-11′(d);
// batch-1 design screen 5a for structure only — the skin is the shipped
// tokens, the numbers are the record's). Plain React + SVG, no chart library.
//
// A vertical rail from the baseline to the top rung; the three scoring rungs on
// it with their points and prices; the downside tiers as ticks in a compressed
// region below; the live price as a bead whose halo brightens as the distance
// to the next rung shrinks; beside the rail, a ghost line of the 30-minute
// closes (closed bars only — the synthesizer is off in Bomb mode) with the
// scoring checks as dots. History and the live price are never the same mark.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { BT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { kOf, brickPlan } from './ladder.js';
import { RED_ZONE_ENTER_PCT } from './redZone.js';
import { etClock } from './checkClock.js';
import { barMs } from './bombView.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const ET_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric' });
const dayLabel = (ms) => ET_DAY.format(new Date(ms)).replace(',', '').toUpperCase();
const ET_WHEN = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });
/** 'Tue 9:45 AM' for the entry line. */
export const entryWhen = (ms) => (finite(ms) ? ET_WHEN.format(new Date(ms)).replace(/ /g, ' ') : null);

/** The to-go pill's text: brick wording when bricks are on, the live number inside the band (R-11′(d)). */
export function toGoText(ladder, go) {
  if (!go) return ladder?.next ? null : BOMB_COPY.allBanked;
  const base = go.distance <= 0
    ? BOMB_COPY.toGoAt(go.rung.points)
    : go.bricks != null ? BOMB_COPY.toGoBricks(go.pct, go.bricks, go.rung.points) : BOMB_COPY.toGoPlain(go.pct, go.rung.points);
  return go.pct <= RED_ZONE_ENTER_PCT ? BOMB_COPY.toGoWithLive(base, money(go.liveShown, go.decimals)) : base;
}

/** The label of the line the rail starts from — never "entry" on a preview. */
export function baselineText(ladder, d) {
  const b = ladder.baseline;
  if (ladder.model === 'v4') return BOMB_COPY.baselineV4(b.price, d);
  if (ladder.kind === 'preview') return BOMB_COPY.baselinePreview(b.price, d);
  if (b.source === 'previous_close') return BOMB_COPY.baselineFromClose(b.price, d);
  return BOMB_COPY.baselineHeld(b.price, d, entryWhen(b.atMs));
}

export default function FuseChart({ ladder, live, decimals, go, ghost = [], checkDots = [], bankedTimes = {}, width = 360, height = 300 }) {
  const reduced = useReducedMotion() === true;
  const W = Math.max(280, width);
  const H = Math.max(220, height);
  const d = decimals;
  const railX = W - 96;
  const labelX = railX + 14;
  const x0 = 12;
  const x1 = railX - 16;
  const plotTop = 38;
  const plotBot = H - 22;
  const yEntry = plotTop + (plotBot - plotTop) * 0.74;
  const kLive = kOf(ladder, live);
  const topK = Math.max(2, Math.min(finite(kLive) ? kLive : 0, 2.8)) + 0.22;
  const botK = Math.max(2, Math.min(finite(kLive) ? -kLive : 0, 2.8)) + 0.12;
  const Y = (k) => (k >= 0
    ? yEntry - (Math.min(k, topK) / topK) * (yEntry - plotTop)
    : yEntry + (Math.min(-k, botK) / botK) * (plotBot - yEntry));
  const base = ladder.baseline.price;
  const pctOf = (price) => ((price - base) / base) * 100;

  // The ghost: closed 30-minute closes, by index (no overnight gaps).
  const pts = ghost.map((b) => ({ t: barMs(b), c: Number(b?.close) })).filter((p) => finite(p.t) && p.c > 0);
  const n = pts.length;
  const X = (i) => (n <= 1 ? x1 : x0 + (i / (n - 1)) * (x1 - x0));
  const idxAt = (ms) => { let found = -1; for (let i = 0; i < n; i += 1) { if (pts[i].t <= ms) found = i; else break; } return found; };
  // A held ladder with a dated entry splits the ghost there: before entry in
  // ink, since entry in teal (the bar holding the entry instant starts both).
  const dated = ladder.kind === 'held' && finite(ladder.baseline.atMs);
  const entryIdx = dated ? idxAt(ladder.baseline.atMs) : -1;
  const path = (from, to) => pts.slice(from, to).map((p, i) => `${i ? 'L' : 'M'}${X(from + i).toFixed(1)},${Y(kOf(ladder, p.c)).toFixed(1)}`).join(' ');
  const pre = !dated ? path(0, n) : entryIdx >= 0 ? path(0, entryIdx + 1) : '';
  const post = !dated ? '' : entryIdx >= 0 ? path(entryIdx, n) : path(0, n);
  const dots = n ? checkDots.map((c) => ({ i: idxAt(c.atMs), px: c.px })).filter((c) => c.i >= 0) : [];

  const nextKey = ladder.next?.key ?? null;
  const rungs = ladder.up.map((r) => ({ ...r, y: Y(r.k), state: r.banked ? 'banked' : r.key === nextKey ? 'next' : 'later' }));
  const top = rungs[rungs.length - 1];
  const liveY = finite(kLive) ? Y(Math.max(-botK + 0.04, Math.min(kLive, topK - 0.04))) : null;
  const inBand = !!go && go.pct <= RED_ZONE_ENTER_PCT;
  // R-11′(d): inside the band the live label yields to the rung label.
  const liveLabelY = (() => {
    if (liveY === null || inBand) return null;
    const clash = (y) => rungs.some((r) => Math.abs(r.y + 6 - y) < 22) || Math.abs(yEntry + 4 - y) < 18;
    if (!clash(liveY + 4)) return liveY + 4;
    if (!clash(liveY + 30)) return liveY + 30;
    return liveY - 18;
  })();
  // The halo brightens as the distance to the next rung shrinks (0 % → full, 3 % or more → faint).
  const halo = go ? 0.2 + 0.65 * Math.max(0, 1 - Math.max(0, go.pct) / 3) : 0.2;
  const pill = toGoText(ladder, go);
  const plan = brickPlan(ladder);
  const pillY = ladder.next ? Y(ladder.next.k) : (top ? top.y : plotTop);
  const pillW = pill ? Math.min(x1 - x0, pill.length * 5.7 + 18) : 0;
  const lastPt = n ? { x: X(n - 1), y: Y(kOf(ladder, pts[n - 1].c)) } : null;
  const beadMotion = motionToken('smooth', { reducedMotion: reduced });

  return (
    <div data-bomb-view="fuse" style={{ position: 'relative', width: '100%', height: H, background: BT.bg, overflow: 'hidden' }}>
      <svg width={W} height={H} style={{ display: 'block', fontFamily: MONO }} aria-label="Bomb chart: the ladder from the baseline to the top rung, with the live price">
        <defs>
          <radialGradient id="bombFuseHalo"><stop offset="0" style={{ stopColor: BT.teal, stopOpacity: 0.6 }} /><stop offset="1" style={{ stopColor: BT.teal, stopOpacity: 0 }} /></radialGradient>
        </defs>
        <text x={x0} y={14} fontSize="8" letterSpacing="0.8" style={{ fill: BT.ink3 }}>{BOMB_COPY.ghostCaption.toUpperCase()}</text>
        {ladder.kind === 'preview' && (
          <g data-bomb-preview-chip="1">
            <rect x={x0} y={20} width={58} height={14} rx={4} style={{ fill: tint(BT.gold, 14), stroke: tint(BT.gold, 45) }} />
            <text x={x0 + 29} y={30} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1" style={{ fill: BT.gold }}>{BOMB_COPY.previewChip.toUpperCase()}</text>
          </g>
        )}
        <rect x={x0} y={yEntry} width={x1 - x0} height={plotBot - yEntry} style={{ fill: tint(BT.red, 4) }} />

        {rungs.map((r) => (
          <g key={r.key} data-fuse-rung={r.key} data-rung-state={r.state}>
            <line x1={x0} y1={r.y} x2={x1} y2={r.y} strokeDasharray="4 4" style={{ stroke: r.state === 'banked' ? tint(BT.green, 45) : tint(BT.gold, r.state === 'next' ? 60 : 30) }} />
            <text x={x0} y={r.y - 5} fontSize="8.5" fontWeight="700" letterSpacing="1" style={{ fill: r.state === 'banked' ? BT.green : r.state === 'next' ? BT.gold : tint(BT.gold, 60) }}>
              {BOMB_COPY.rungTitle(r.label, pctOf(r.price))}
            </text>
          </g>
        ))}
        <line x1={x0} y1={yEntry} x2={x1} y2={yEntry} style={{ stroke: tint(BT.ink, 30) }} />
        <text data-fuse-baseline="1" x={x0} y={yEntry - 5} fontSize="8.5" letterSpacing="0.6" style={{ fill: BT.ink2 }}>{baselineText(ladder, d).toUpperCase()}</text>
        <text x={x0} y={yEntry + 12} fontSize="7.5" fontWeight="700" letterSpacing="1" style={{ fill: tint(BT.red, 75) }}>{BOMB_COPY.belowCompressed.toUpperCase()}</text>

        {pre && <path d={pre} fill="none" strokeWidth="1.2" strokeLinejoin="round" style={{ stroke: BT.ink3, strokeOpacity: 0.7 }} />}
        {post && <path d={post} fill="none" strokeWidth="1.1" strokeLinejoin="round" style={{ stroke: BT.teal, strokeOpacity: 0.5 }} />}
        {dots.map((c, i) => <circle key={i} data-fuse-check-dot="1" cx={X(c.i)} cy={Y(kOf(ladder, c.px))} r="1.4" style={{ fill: BT.teal, fillOpacity: 0.9 }} />)}
        {entryIdx >= 0 && <circle cx={X(entryIdx)} cy={yEntry} r="3.5" strokeWidth="1.5" style={{ fill: BT.bg, stroke: BT.ink2 }} />}
        {lastPt && liveY !== null && <line x1={lastPt.x} y1={lastPt.y} x2={railX - 7} y2={liveY} strokeDasharray="2 3" style={{ stroke: BT.teal, strokeOpacity: 0.85 }} />}

        {pill && (
          <g data-fuse-togo="1">
            <rect x={x1 - pillW} y={pillY - 22} width={pillW} height={16} rx={8} style={{ fill: tint(BT.bg, 92), stroke: tint(BT.gold, 45) }} />
            <text x={x1 - 9} y={pillY - 10.5} textAnchor="end" fontSize="9" fontWeight="700" letterSpacing="0.4" style={{ fill: BT.gold }}>{pill.toUpperCase()}</text>
          </g>
        )}

        {/* The rail */}
        {top && <rect x={railX - 3} y={top.y - 8} width={6} height={yEntry - top.y + 8} rx={3} style={{ fill: tint(BT.bg, 60), stroke: tint(BT.ink, 12) }} />}
        {liveY !== null && liveY < yEntry && <rect x={railX - 3} y={liveY} width={6} height={yEntry - liveY} rx={3} style={{ fill: BT.teal, opacity: 0.8 }} />}
        {(() => { const yb = rungs.filter((r) => r.banked).reduce((m, r) => Math.min(m, r.y), yEntry); return yb < yEntry ? <rect x={railX - 3} y={yb} width={6} height={yEntry - yb} rx={3} style={{ fill: BT.green }} /> : null; })()}
        <rect x={railX - 9} y={yEntry - 1} width={18} height={2.5} rx={1} style={{ fill: BT.ink2 }} />
        {plan && top && Array.from({ length: plan.total - 1 }, (_, i) => i + 1).filter((b) => !Object.values(plan.rungBricks).includes(b)).map((b) => (
          <rect key={b} data-fuse-brick={b} x={railX - 5} y={Y(b / 6) - 0.5} width={10} height={1} style={{ fill: tint(BT.gold, 35) }} />
        ))}
        {rungs.map((r) => (r.state === 'banked'
          ? <g key={`m${r.key}`}><circle cx={railX} cy={r.y} r={8} style={{ fill: BT.green }} /><path d={`M${railX - 4} ${r.y}l3 3 5.5-6.5`} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: BT.bg }} /></g>
          : r.state === 'next'
            ? <circle key={`m${r.key}`} cx={railX} cy={r.y} r={6.5} strokeWidth="2" style={{ fill: BT.bg, stroke: BT.gold }} />
            : <rect key={`m${r.key}`} x={railX - 7} y={r.y - 1.5} width={14} height={3} rx={1.5} style={{ fill: tint(BT.gold, 55) }} />))}
        {ladder.down.map((r) => (
          <g key={`d${r.key}`} data-fuse-down={r.key} data-down-hit={r.banked ? '1' : '0'}>
            {r.banked
              ? <circle cx={railX} cy={Y(r.k)} r={4} style={{ fill: BT.red }} />
              : <rect x={railX - 5} y={Y(r.k) - 1} width={10} height={2} rx={1} style={{ fill: tint(BT.red, 55) }} />}
            <text x={labelX} y={Y(r.k) + 3} fontSize="8.5" fontWeight="700" style={{ fill: r.banked ? BT.red : tint(BT.red, 60) }}>{BOMB_COPY.rungPoints(r.points, false)}</text>
          </g>
        ))}
        {rungs.map((r) => (
          <g key={`l${r.key}`} data-fuse-rung-label={r.key}>
            <text x={labelX} y={r.y + 4.5} fontSize="13" fontWeight="800" style={{ fill: r.state === 'banked' ? BT.green : r.state === 'next' ? BT.gold : tint(BT.gold, 60) }}>{BOMB_COPY.rungPoints(r.points, r.banked)}</text>
            <text x={labelX} y={r.y + 15.5} fontSize="8.5" style={{ fill: BT.ink3 }}>{money(r.price, d)}</text>
            {r.banked && finite(bankedTimes[r.key]) && <text data-fuse-banked-at={r.key} x={labelX} y={r.y + 25} fontSize="7.5" fontWeight="700" letterSpacing="0.4" style={{ fill: BT.green }}>{BOMB_COPY.bankedAt(etClock(bankedTimes[r.key])).toUpperCase()}</text>}
          </g>
        ))}

        {/* The live bead */}
        {liveY !== null && (
          <g data-fuse-bead="1" data-halo={halo.toFixed(2)}>
            <motion.circle cx={railX} r={16} initial={false} animate={{ cy: liveY }} transition={beadMotion} style={{ fill: 'url(#bombFuseHalo)', opacity: halo }} />
            <motion.circle cx={railX} r={4.5} initial={false} animate={{ cy: liveY }} transition={beadMotion} style={{ fill: BT.core }} />
          </g>
        )}
        {liveLabelY !== null && (
          <g data-fuse-live-label="1">
            <text x={labelX} y={liveLabelY} fontSize="11" fontWeight="700" style={{ fill: BT.ink }}>{money(live, d)}</text>
            <text x={labelX} y={liveLabelY + 11} fontSize="8.5" fontWeight="700" style={{ fill: BT.teal }}>{BOMB_COPY.livePct(pctOf(live)).toUpperCase()}</text>
          </g>
        )}
        {n > 0 && <text x={x0} y={H - 6} fontSize="8.5" fontWeight="700" letterSpacing="0.6" style={{ fill: BT.ink3 }}>{dayLabel(pts[0].t)}</text>}
        {n > 1 && <text x={x1} y={H - 6} textAnchor="end" fontSize="8.5" fontWeight="700" letterSpacing="0.6" style={{ fill: BT.ink2 }}>{dayLabel(pts[n - 1].t)}</text>}
      </svg>
    </div>
  );
}
