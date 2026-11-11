// src/components/Research/BombMode/FuseChart.jsx
//
// Research Modal Build A — THE FUSE (spec §4.3; Amendment A R-11′(a), R-11′(d);
// batch-1 design screen 5a for structure only — the skin is the shipped
// tokens, the numbers are the record's). Plain React + SVG, no chart library.
//
// AT FULL SCALE IN BOTH DIRECTIONS (refinement 2026-11-10, BD-3): one vertical
// scale — the same pixels per brick above and below the baseline — whose window
// always shows all six rungs (−2.12 to +2.22 thresholds, stretched when the
// live price is past either end; the baseline lands wherever that puts it).
// The downside rungs are drawn like the upside ones: a dashed line across the
// plot, the title on the left, the points and price right of the rail, in the
// risk red; a crossed downside rung is HIT (solid), never banked. The rail runs
// bottom rung → top rung; the live fill is teal above the baseline and red below
// it; brick ticks on both sides. Two to-go pills — the upside's above its next
// rung, the downside's below its next rung — the LEAD side's strong, the other
// quiet (BD-2). The halo follows the lead side's distance (red when down leads).
// Beside the rail, a ghost line of the 30-minute closes (closed bars only — the
// synthesizer is off in Bomb mode) with the scoring checks as dots. History and
// the live price are never the same mark.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../../theme/motion.js';
import { BT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { kOf, brickPlan, stepLead } from './ladder.js';
import { BUST_TIERS } from '../../../constants/baggerBombScoring.js';
import { RED_ZONE_ENTER_PCT } from './redZone.js';
import { etClock } from './checkClock.js';
import { barMs, rungFacts, liveMovePct } from './bombView.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const ET_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric' });
const dayLabel = (ms) => ET_DAY.format(new Date(ms)).replace(',', '').toUpperCase();
const ET_WHEN = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });
/** 'Tue 9:45 AM' for the entry line. */
export const entryWhen = (ms) => (finite(ms) ? ET_WHEN.format(new Date(ms)).replace(/ /g, ' ') : null);

/** The window's fixed reach (thresholds from the baseline): every rung (±2) with room for its labels. */
export const FUSE_TOP_K = 2.22;
export const FUSE_BOTTOM_K = -2.12;
/** How far past either end the window stretches for the live price (beyond it the bead is held at the edge). */
const FUSE_STRETCH_K = 3;

/**
 * The upside to-go label in two parts: the distance (brick wording when bricks
 * are on) and — inside the band (R-11′(d)), when `withLive` — the live number
 * it carries. A preview at or over a rung says only that: no check scores a
 * stock nobody holds.
 */
export function toGoParts(ladder, go, { closed = false, withLive = true } = {}) {
  if (!go) return ladder?.next ? null : { base: BOMB_COPY.allBanked, suffix: null };
  const base = go.distance <= 0
    ? (ladder.kind === 'preview' ? BOMB_COPY.toGoAtPreview : BOMB_COPY.toGoAt)(go.rung.points)
    : go.bricks != null ? BOMB_COPY.toGoBricks(go.pctShown, go.bricks, go.rung.points) : BOMB_COPY.toGoPlain(go.pctShown, go.rung.points);
  return withLiveSuffix(base, go, closed, withLive);
}

/** BD-3 — the downside's to-go label, the mirror of toGoParts; null when nothing below is left unhit. */
export function downToGoParts(ladder, goDown, { closed = false, withLive = true, short = false } = {}) {
  if (!goDown) return null;
  const r = goDown.rung;
  const base = goDown.distance <= 0
    ? (ladder.kind === 'preview' ? BOMB_COPY.downToGoAtPreview : BOMB_COPY.downToGoAt)(r.label, r.points)
    : goDown.bricks != null
      ? (short ? BOMB_COPY.downToGoBricksShort(goDown.pctShown, goDown.bricks, r.points) : BOMB_COPY.downToGoBricks(goDown.pctShown, goDown.bricks, r.label, r.points))
      : BOMB_COPY.downToGoPlain(goDown.pctShown, r.label, r.points);
  return withLiveSuffix(base, goDown, closed, withLive);
}

function withLiveSuffix(base, go, closed, withLive) {
  if (!withLive || go.pctShown > RED_ZONE_ENTER_PCT) return { base, suffix: null };
  // After the close the quote is the last trade, not a live one.
  const full = (closed ? BOMB_COPY.toGoWithLast : BOMB_COPY.toGoWithLive)(base, money(go.liveShown, go.decimals));
  return { base, suffix: full.slice(base.length + 3) };
}

/** The upside to-go label as one line. */
export function toGoText(ladder, go, opts = {}) {
  const p = toGoParts(ladder, go, opts);
  return p ? (p.suffix ? `${p.base} · ${p.suffix}` : p.base) : null;
}

/** The drawn width of a mono label (≈0.6 em per glyph plus its letter spacing). */
export const monoWidth = (text, fontSize, letterSpacing = 0) => text.length * (fontSize * 0.6 + letterSpacing);
/** A mono text's box: its drawn width, one font size above the baseline and a quarter below. */
export function textBox(x, y, text, fontSize, letterSpacing = 0, anchor = 'start') {
  const w = monoWidth(String(text), fontSize, letterSpacing);
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { x0: left, x1: left + w, y0: y - fontSize, y1: y + fontSize * 0.25 };
}
const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const coverOf = (box, boxes) => boxes.reduce((s, b) => s + overlapArea(box, b), 0);

/** The label of the line the rail starts from — never "entry" on a preview. */
export function baselineText(ladder, d) {
  const b = ladder.baseline;
  if (ladder.model === 'v4') return BOMB_COPY.baselineV4(b.price, d);
  if (ladder.kind === 'preview') return BOMB_COPY.baselinePreview(b.price, d);
  if (b.source === 'previous_close') return BOMB_COPY.baselineFromClose(b.price, d);
  return BOMB_COPY.baselineHeld(b.price, d, entryWhen(b.atMs));
}

/** A rung's left-hand title (both sides): its % move, or — crossed — BANKED / HIT with the check when the modal saw it (BA-4). */
export function rungTitleText(ladder, r, d, { bankedTimes = {}, hitTimes = {} } = {}) {
  if (r.k < 0) {
    if (r.hit) return BOMB_COPY.downHitTitle(r.label, finite(hitTimes[r.key]) ? etClock(hitTimes[r.key]) : null);
    return BOMB_COPY.rungTitle(r.label, rungFacts(ladder, r, d).pct);
  }
  if (r.banked && finite(bankedTimes[r.key])) return `${r.label.toUpperCase()} · ${BOMB_COPY.bankedAt(etClock(bankedTimes[r.key])).toUpperCase()}`;
  return BOMB_COPY.rungTitle(r.label, rungFacts(ladder, r, d).pct);
}

// Right of the rail, a rung's label block: the points (13 px) on the line, the price (8.5 px) under it.
const pointsBox = (x, y, text) => textBox(x, y + 4.5, text, 13);
const priceBox = (x, y, text) => textBox(x, y + 15.5, text, 8.5);

/** Where a rung's price sits when its side is crowded: on the points' own line, right of them. */
export const inlinePriceX = (labelX, pointsText) => labelX + monoWidth(pointsText, 13) + 4;
const inlinePriceBox = (x, y, text) => textBox(x, y + 4.5, text, 8.5);

/**
 * Which rungs keep their price right of the rail, and where (BD-3 legibility):
 * every rung under its points, unless two label blocks on one side would
 * overlap — then that side's NON-NEXT rungs drop their price line first (the
 * levels table carries every price); if the side is still crowded, its next
 * rung's price moves up onto its points' line. A name or the points are never
 * dropped. Returns { keep: Set of keys that keep a price, inline: Set of keys
 * whose price sits on the points' line }.
 */
export function pricedRungs(rungs, labelX) {
  const keep = new Set(rungs.map((r) => r.key));
  const inline = new Set();
  for (const side of ['up', 'down']) {
    const list = rungs.filter((r) => r.side === side).sort((a, b) => a.y - b.y);
    const blocksOf = (r) => [pointsBox(labelX, r.y, r.pointsText), ...(!keep.has(r.key) ? [] : inline.has(r.key) ? [inlinePriceBox(inlinePriceX(labelX, r.pointsText), r.y, r.priceText)] : [priceBox(labelX, r.y, r.priceText)])];
    const crowded = () => {
      const b = list.map(blocksOf);
      for (let i = 0; i < b.length; i += 1) for (let j = i + 1; j < b.length; j += 1) if (b[i].some((x) => b[j].some((y) => overlapArea(x, y) > 0))) return true;
      return false;
    };
    if (!crowded()) continue;
    for (const r of list) if (r.state !== 'next') keep.delete(r.key);
    if (crowded()) for (const r of list) if (keep.has(r.key)) inline.add(r.key);
  }
  return { keep, inline };
}

export default function FuseChart({ ladder, live, decimals, go, goDown = null, lead = null, ghost = [], checkDots = [], bankedTimes = {}, hitTimes = {}, closed = false, width = 360, height = 300 }) {
  const reduced = useReducedMotion() === true;
  const W = Math.max(280, width);
  const H = Math.max(200, height);
  const d = decimals;
  const railX = W - 96;
  const labelX = railX + 14;
  const x0 = 12;
  const x1 = railX - 16;
  const plotTop = 38;
  const plotBot = H - 22;
  // ONE scale: the same pixels per threshold (so per brick) above and below the baseline.
  const kLive = kOf(ladder, live);
  const topK = Math.max(FUSE_TOP_K, finite(kLive) ? Math.min(kLive, FUSE_STRETCH_K) + 0.22 : FUSE_TOP_K);
  const botK = Math.min(FUSE_BOTTOM_K, finite(kLive) ? Math.max(kLive, -FUSE_STRETCH_K) - 0.12 : FUSE_BOTTOM_K);
  const clampK = (k) => Math.max(botK, Math.min(topK, k));
  const Y = (k) => plotTop + ((topK - clampK(k)) / (topK - botK)) * (plotBot - plotTop);
  const yEntry = Y(0);
  // The lead (BD-2): the view's own (the hook holds its band), or — drawn
  // without one — the first look's. A side with no next rung never leads.
  const firstLook = stepLead(null, { up: go ? go.bricksExact : null, down: goDown ? goDown.bricksExact : null });
  const wanted = lead === 'up' || lead === 'down' ? lead : firstLook;
  const leadSide = wanted === 'down' && ladder.nextDown ? 'down' : ladder.next || !ladder.nextDown ? 'up' : 'down';

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

  // Every rung, both sides, with its facts from the ONE helper the bar and the table use.
  const nextKey = ladder.next?.key ?? null;
  const nextDownKey = ladder.nextDown?.key ?? null;
  const rungs = [
    ...ladder.up.map((r) => ({ ...r, side: 'up', state: r.banked ? 'banked' : r.key === nextKey ? 'next' : 'later' })),
    ...ladder.down.map((r) => ({ ...r, side: 'down', state: r.hit ? 'hit' : r.key === nextDownKey ? 'next' : 'later' })),
  ].map((r) => ({
    ...r,
    y: Y(r.k),
    title: rungTitleText(ladder, r, d, { bankedTimes, hitTimes }),
    pointsText: r.side === 'down' ? BOMB_COPY.downPoints(r.points) : BOMB_COPY.rungPoints(r.points, r.banked),
    priceText: rungFacts(ladder, r, d).priceText,
  }));
  const upRungs = rungs.filter((r) => r.side === 'up');
  const downRungs = rungs.filter((r) => r.side === 'down');
  const { keep: keepPrice, inline: inlinePrice } = pricedRungs(rungs, labelX);
  // A kept price: under its points, or — on a crowded side — on the points' own line.
  const priceAt = (r) => (inlinePrice.has(r.key) ? { x: inlinePriceX(labelX, r.pointsText), y: r.y + 4.5 } : { x: labelX, y: r.y + 15.5 });
  const top = upRungs[upRungs.length - 1];
  const bottom = downRungs[downRungs.length - 1];
  const liveY = finite(kLive) ? Y(kLive) : null;
  const leadGo = leadSide === 'down' ? goDown : go;
  const inBand = !!leadGo && leadGo.pctShown <= RED_ZONE_ENTER_PCT;

  // The left-hand labels as boxes (mono: width = monoWidth; height ≈ one font
  // size above the baseline, a quarter below), so the pills and the live label
  // can be placed where they cover none of them (review D2/D7 and their refuter).
  const leftBoxes = [
    textBox(x0, 14, BOMB_COPY.ghostCaption.toUpperCase(), 8, 0.8),
    ...(ladder.kind === 'preview' ? [{ x0, x1: x0 + 58, y0: 20, y1: 34 }] : []),
    ...rungs.map((r) => textBox(x0, r.y - 5, r.title, 8.5, 1)),
    textBox(x0, yEntry - 5, baselineText(ladder, d).toUpperCase(), 8.5, 0.6),
    { x0, x1, y0: H - 15, y1: H }, // the date axis
  ];

  // The two pills. Each tries, in order, one line at its size, two lines (the
  // live number on its own line), smaller sizes, then the short downside
  // wording; at each, its own side of its next rung first (the upside's ABOVE
  // its rung, the downside's BELOW its rung), then the other side. The first
  // that fits the ghost area and covers no label (nor the pill placed before
  // it) wins; if none is clear, the one that covers least. The lead is placed first.
  const placePill = (side, avoid) => {
    const isLead = side === leadSide;
    const variants = side === 'up'
      ? [toGoParts(ladder, go, { closed, withLive: isLead })]
      : [downToGoParts(ladder, goDown, { closed, withLive: isLead }), downToGoParts(ladder, goDown, { closed, withLive: isLead, short: true })];
    if (!variants[0]) return null;
    const anchorY = side === 'up' ? (ladder.next ? Y(ladder.next.k) : (top ? top.y : plotTop)) : Y(ladder.nextDown.k);
    const sizes = isLead ? [{ fs: 9, ls: 0.4 }, { fs: 8, ls: 0.2 }, { fs: 7.5, ls: 0 }] : [{ fs: 8, ls: 0.2 }, { fs: 7.5, ls: 0 }];
    const sets = [];
    for (const v of variants) {
      const one = (v.suffix ? `${v.base} · ${v.suffix}` : v.base).toUpperCase();
      const two = [v.base.toUpperCase(), ...(v.suffix ? [v.suffix.toUpperCase()] : [])];
      for (const s of sizes) { sets.push({ lines: [one], ...s }); if (two.length > 1) sets.push({ lines: two, ...s }); }
    }
    const fits = sets.filter((s) => s.lines.every((l) => monoWidth(l, s.fs, s.ls) + 18 <= x1 - x0));
    const options = [];
    for (const s of fits) {
      const w = Math.max(...s.lines.map((l) => monoWidth(l, s.fs, s.ls))) + 18;
      const h = 4 + (s.fs + 3) * s.lines.length;
      // (…and, above a rung, snug on its title's box — a full-scale window leaves
      // the top rung only the space between the caption and that title.)
      const spots = side === 'up' ? [anchorY - 20 - h, anchorY - 14.5 - h, anchorY + 5] : [anchorY + 5, anchorY - 20 - h, anchorY - 14.5 - h];
      for (const yTop of spots) {
        const box = { x0: x1 - w, x1, y0: yTop, y1: yTop + h };
        if (box.y0 < 2 || box.y1 > plotBot) continue;
        options.push({ ...s, w, h, yTop, cover: coverOf(box, avoid) });
      }
    }
    const chosen = options.find((o) => o.cover === 0) ?? (options.length ? options.reduce((a, b) => (b.cover < a.cover ? b : a)) : null);
    if (!chosen) return null;
    return { ...chosen, side, isLead, box: { x0: x1 - chosen.w, x1, y0: chosen.yTop, y1: chosen.yTop + chosen.h } };
  };
  const firstPill = placePill(leadSide, leftBoxes);
  const secondPill = placePill(leadSide === 'up' ? 'down' : 'up', firstPill ? [...leftBoxes, firstPill.box] : leftBoxes);
  // Drawn upside first (one DOM order whichever side leads).
  const pills = [firstPill, secondPill].filter(Boolean).sort((a, b) => (a.side === b.side ? 0 : a.side === 'up' ? -1 : 1));

  // R-11′(d): inside the lead's band the live label yields to the rung label.
  // Outside it, the label sits right of the rail where it clears every rung's
  // label block (points, and the price where kept) and the baseline's; when no
  // spot there is clear, it moves to the left of the rail, where it must clear
  // the left-hand labels and the pills.
  const liveLabel = (() => {
    if (liveY === null || inBand) return null;
    const blocks = [...rungs.map((r) => [r.y - 11, r.y + (keepPrice.has(r.key) && !inlinePrice.has(r.key) ? 19 : 8)]), [yEntry - 10, yEntry + 12]];
    // The date axis (H − 16 … H) is off limits on both sides.
    const inPlot = (y) => y - 12 > plotTop - 8 && y + 14 < H - 16;
    const clear = (y) => blocks.every(([a, b]) => y + 14 < a || y - 12 > b) && inPlot(y);
    for (const y of [liveY + 4, liveY + 30, liveY - 20]) if (clear(y)) return { x: labelX, y, anchor: 'start' };
    const pctText = (closed ? BOMB_COPY.lastPct : BOMB_COPY.livePct)(liveMovePct(ladder, live, d)).toUpperCase();
    const leftBox = (y) => {
      const a = textBox(railX - 12, y, money(live, d), 11, 0, 'end');
      const b = textBox(railX - 12, y + 11, pctText, 8.5, 0, 'end');
      return { x0: Math.min(a.x0, b.x0), x1: railX - 12, y0: a.y0, y1: b.y1 };
    };
    const avoid = [...leftBoxes, ...pills.map((p) => p.box)];
    const left = [liveY + 4, liveY - 20, liveY + 30, liveY + 44, liveY - 34].filter(inPlot).map((y) => ({ y, cover: coverOf(leftBox(y), avoid) }));
    if (left.length) { const best = left.find((c) => c.cover === 0) ?? left.reduce((a, b) => (b.cover < a.cover ? b : a)); return { x: railX - 12, y: best.y, anchor: 'end' }; }
    return { x: railX - 12, y: Math.max(plotTop + 4, Math.min(liveY + 4, H - 32)), anchor: 'end' };
  })();
  const liveLabelY = liveLabel ? liveLabel.y : null;
  // The halo brightens as the lead side's distance shrinks (0 % → full, 3 % or more → faint).
  const halo = leadGo ? 0.2 + 0.65 * Math.max(0, 1 - Math.max(0, leadGo.pct) / 3) : 0.2;
  const planUp = brickPlan(ladder);
  const planDown = brickPlan(ladder, BUST_TIERS);
  const lastPt = n ? { x: X(n - 1), y: Y(kOf(ladder, pts[n - 1].c)) } : null;
  const beadMotion = motionToken('smooth', { reducedMotion: reduced });
  const ticks = (plan, sign) => (plan ? Array.from({ length: plan.total - 1 }, (_, i) => i + 1).filter((b) => !Object.values(plan.rungBricks).includes(b)).map((b) => sign * b) : []);
  const railTop = top ? top.y - 8 : yEntry - 8;
  const railBot = bottom ? bottom.y + 8 : yEntry + 8;

  return (
    <div data-bomb-view="fuse" data-fuse-lead={leadSide} style={{ position: 'relative', width: '100%', height: H, background: BT.bg, overflow: 'hidden' }}>
      <svg width={W} height={H} style={{ display: 'block', fontFamily: MONO }} aria-label="Bomb chart: the ladder from the bottom rung to the top rung, with the baseline and the live price">
        <defs>
          <radialGradient id="bombFuseHalo"><stop offset="0" style={{ stopColor: BT.teal, stopOpacity: 0.6 }} /><stop offset="1" style={{ stopColor: BT.teal, stopOpacity: 0 }} /></radialGradient>
          <radialGradient id="bombFuseHaloDown"><stop offset="0" style={{ stopColor: BT.red, stopOpacity: 0.6 }} /><stop offset="1" style={{ stopColor: BT.red, stopOpacity: 0 }} /></radialGradient>
        </defs>
        <text x={x0} y={14} fontSize="8" letterSpacing="0.8" style={{ fill: BT.ink3 }}>{BOMB_COPY.ghostCaption.toUpperCase()}</text>
        {ladder.kind === 'preview' && (
          <g data-bomb-preview-chip="1">
            <rect x={x0} y={20} width={58} height={14} rx={4} style={{ fill: tint(BT.gold, 14), stroke: tint(BT.gold, 45) }} />
            <text x={x0 + 29} y={30} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="1" style={{ fill: BT.gold }}>{BOMB_COPY.previewChip.toUpperCase()}</text>
          </g>
        )}
        <rect x={x0} y={yEntry} width={x1 - x0} height={Math.max(0, plotBot - yEntry)} style={{ fill: tint(BT.red, 4) }} />

        {upRungs.map((r) => (
          <g key={r.key} data-fuse-rung={r.key} data-side="up" data-rung-state={r.state}>
            <line x1={x0} y1={r.y} x2={x1} y2={r.y} strokeDasharray="4 4" style={{ stroke: r.state === 'banked' ? tint(BT.green, 45) : tint(BT.gold, r.state === 'next' ? 60 : 30) }} />
            <text x={x0} y={r.y - 5} fontSize="8.5" fontWeight="700" letterSpacing="1" style={{ fill: r.state === 'banked' ? BT.green : r.state === 'next' ? BT.gold : tint(BT.gold, 60) }}>
              {r.banked && finite(bankedTimes[r.key]) ? r.label.toUpperCase() : r.title}
              {r.banked && finite(bankedTimes[r.key]) ? ' · ' : null}
              {r.banked && finite(bankedTimes[r.key]) && <tspan data-fuse-banked-at={r.key}>{BOMB_COPY.bankedAt(etClock(bankedTimes[r.key])).toUpperCase()}</tspan>}
            </text>
          </g>
        ))}
        {downRungs.map((r) => (
          <g key={r.key} data-fuse-rung={r.key} data-side="down" data-rung-state={r.state}>
            <line x1={x0} y1={r.y} x2={x1} y2={r.y} {...(r.state === 'hit' ? {} : { strokeDasharray: '4 4' })} style={{ stroke: r.state === 'hit' ? tint(BT.red, 75) : tint(BT.red, r.state === 'next' ? 60 : 30) }} />
            <text data-fuse-down-title={r.key} x={x0} y={r.y - 5} fontSize="8.5" fontWeight="700" letterSpacing="1" style={{ fill: r.state === 'hit' || r.state === 'next' ? BT.red : tint(BT.red, 60) }}>{r.title}</text>
          </g>
        ))}
        <line x1={x0} y1={yEntry} x2={x1} y2={yEntry} style={{ stroke: tint(BT.ink, 30) }} />
        <text data-fuse-baseline="1" x={x0} y={yEntry - 5} fontSize="8.5" letterSpacing="0.6" style={{ fill: BT.ink2 }}>{baselineText(ladder, d).toUpperCase()}</text>

        {pre && <path d={pre} fill="none" strokeWidth="1.2" strokeLinejoin="round" style={{ stroke: BT.ink3, strokeOpacity: 0.7 }} />}
        {post && <path d={post} fill="none" strokeWidth="1.1" strokeLinejoin="round" style={{ stroke: BT.teal, strokeOpacity: 0.5 }} />}
        {dots.map((c, i) => <circle key={i} data-fuse-check-dot="1" cx={X(c.i)} cy={Y(kOf(ladder, c.px))} r="1.4" style={{ fill: BT.teal, fillOpacity: 0.9 }} />)}
        {entryIdx >= 0 && <circle cx={X(entryIdx)} cy={yEntry} r="3.5" strokeWidth="1.5" style={{ fill: BT.bg, stroke: BT.ink2 }} />}
        {lastPt && liveY !== null && <line x1={lastPt.x} y1={lastPt.y} x2={railX - 7} y2={liveY} strokeDasharray="2 3" style={{ stroke: BT.teal, strokeOpacity: 0.85 }} />}

        {pills.map((p) => {
          const color = p.isLead ? (p.side === 'down' ? BT.red : BT.gold) : BT.ink3;
          return (
            <g key={p.side} data-fuse-togo={p.side} data-togo-lead={p.isLead ? '1' : '0'} data-pill-font={p.fs}>
              <rect x={x1 - p.w} y={p.yTop} width={p.w} height={p.h} rx={8} strokeWidth={p.isLead ? 1 : 0.6} style={{ fill: tint(BT.bg, 92), stroke: p.isLead ? tint(color, 45) : tint(BT.ink, 12) }} />
              {p.lines.map((line, i) => (
                <text key={i} x={x1 - 9} y={p.yTop + p.fs + 3.5 + (p.fs + 3) * i} textAnchor="end" fontSize={p.fs} fontWeight={p.isLead ? 700 : 600} letterSpacing={p.ls} style={{ fill: color }}>{line}</text>
              ))}
            </g>
          );
        })}

        {/* The rail: bottom rung → top rung */}
        <rect x={railX - 3} y={railTop} width={6} height={Math.max(0, railBot - railTop)} rx={3} style={{ fill: tint(BT.bg, 60), stroke: tint(BT.ink, 12) }} />
        {liveY !== null && liveY < yEntry && <rect data-fuse-fill="up" x={railX - 3} y={liveY} width={6} height={yEntry - liveY} rx={3} style={{ fill: BT.teal, opacity: 0.8 }} />}
        {liveY !== null && liveY > yEntry && <rect data-fuse-fill="down" x={railX - 3} y={yEntry} width={6} height={liveY - yEntry} rx={3} style={{ fill: BT.red, opacity: 0.8 }} />}
        {(() => { const yb = upRungs.filter((r) => r.banked).reduce((m, r) => Math.min(m, r.y), yEntry); return yb < yEntry ? <rect x={railX - 3} y={yb} width={6} height={yEntry - yb} rx={3} style={{ fill: BT.green }} /> : null; })()}
        <rect x={railX - 9} y={yEntry - 1} width={18} height={2.5} rx={1} style={{ fill: BT.ink2 }} />
        {ticks(planUp, 1).map((b) => (
          <rect key={`u${b}`} data-fuse-brick={b} x={railX - 5} y={Y(b / 6) - 0.5} width={10} height={1} style={{ fill: tint(BT.gold, 35) }} />
        ))}
        {ticks(planDown, -1).map((b) => (
          <rect key={`d${b}`} data-fuse-brick={b} x={railX - 5} y={Y(b / 6) - 0.5} width={10} height={1} style={{ fill: tint(BT.red, 35) }} />
        ))}
        {upRungs.map((r) => (r.state === 'banked'
          ? <g key={`m${r.key}`}><circle cx={railX} cy={r.y} r={8} style={{ fill: BT.green }} /><path d={`M${railX - 4} ${r.y}l3 3 5.5-6.5`} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: BT.bg }} /></g>
          : r.state === 'next'
            ? <circle key={`m${r.key}`} cx={railX} cy={r.y} r={6.5} strokeWidth="2" style={{ fill: BT.bg, stroke: BT.gold }} />
            : <rect key={`m${r.key}`} x={railX - 7} y={r.y - 1.5} width={14} height={3} rx={1.5} style={{ fill: tint(BT.gold, 55) }} />))}
        {downRungs.map((r) => (r.state === 'hit'
          ? <circle key={`m${r.key}`} cx={railX} cy={r.y} r={6.5} style={{ fill: BT.red }} />
          : r.state === 'next'
            ? <circle key={`m${r.key}`} cx={railX} cy={r.y} r={6.5} strokeWidth="2" style={{ fill: BT.bg, stroke: BT.red }} />
            : <rect key={`m${r.key}`} x={railX - 7} y={r.y - 1.5} width={14} height={3} rx={1.5} style={{ fill: tint(BT.red, 55) }} />))}
        {downRungs.map((r) => (
          <g key={`d${r.key}`} data-fuse-down={r.key} data-down-hit={r.hit ? '1' : '0'} data-side="down">
            <text x={labelX} y={r.y + 4.5} fontSize="13" fontWeight="800" style={{ fill: r.state === 'later' ? tint(BT.red, 60) : BT.red }}>{r.pointsText}</text>
            {keepPrice.has(r.key) && <text data-fuse-price={r.key} x={priceAt(r).x} y={priceAt(r).y} fontSize="8.5" style={{ fill: BT.ink3 }}>{r.priceText}</text>}
          </g>
        ))}
        {upRungs.map((r) => (
          <g key={`l${r.key}`} data-fuse-rung-label={r.key}>
            <text x={labelX} y={r.y + 4.5} fontSize="13" fontWeight="800" style={{ fill: r.state === 'banked' ? BT.green : r.state === 'next' ? BT.gold : tint(BT.gold, 60) }}>{r.pointsText}</text>
            {keepPrice.has(r.key) && <text data-fuse-price={r.key} x={priceAt(r).x} y={priceAt(r).y} fontSize="8.5" style={{ fill: BT.ink3 }}>{r.priceText}</text>}
          </g>
        ))}

        {/* The live bead */}
        {liveY !== null && (
          <g data-fuse-bead="1" data-halo={halo.toFixed(2)} data-halo-side={leadSide}>
            <motion.circle cx={railX} r={16} initial={false} animate={{ cy: liveY }} transition={beadMotion} style={{ fill: leadSide === 'down' ? 'url(#bombFuseHaloDown)' : 'url(#bombFuseHalo)', opacity: halo }} />
            <motion.circle cx={railX} r={4.5} initial={false} animate={{ cy: liveY }} transition={beadMotion} style={{ fill: BT.core }} />
          </g>
        )}
        {liveLabelY !== null && (
          <g data-fuse-live-label="1">
            <text x={liveLabel.x} y={liveLabelY} textAnchor={liveLabel.anchor} fontSize="11" fontWeight="700" style={{ fill: BT.ink }}>{money(live, d)}</text>
            <text x={liveLabel.x} y={liveLabelY + 11} textAnchor={liveLabel.anchor} fontSize="8.5" fontWeight="700" style={{ fill: kLive < 0 ? BT.red : BT.teal }}>{(closed ? BOMB_COPY.lastPct : BOMB_COPY.livePct)(liveMovePct(ladder, live, d)).toUpperCase()}</text>
          </g>
        )}
        {n > 0 && <text x={x0} y={H - 6} fontSize="8.5" fontWeight="700" letterSpacing="0.6" style={{ fill: BT.ink3 }}>{dayLabel(pts[0].t)}</text>}
        {n > 1 && <text x={x1} y={H - 6} textAnchor="end" fontSize="8.5" fontWeight="700" letterSpacing="0.6" style={{ fill: BT.ink2 }}>{dayLabel(pts[n - 1].t)}</text>}
      </svg>
    </div>
  );
}
