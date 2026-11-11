// src/components/Research/BombMode/BombSheet.jsx
//
// Research Modal Build A — ONE SHEET for both Bomb views (spec §4.3;
// Amendment A R-11′(c)): the ladder rail and one line of what has to happen,
// from templates only. The ENTRY / BANKED / NEXT tiles of the batch-1 design are
// retired; their numbers live on the rail. It replaces BaggerBombTab's content
// when Bomb mode is on.
//
// BOTH DIRECTIONS (refinement 2026-11-10):
//   BD-4  the bar at full scale — Meltdown at the left end, TenBagger at the
//         right, the baseline at its true place on one scale; downside marks in
//         red; every rung's points; prices only on the baseline and each side's
//         next rung; ONE to-go line, the lead first (its color and weight), the
//         other quieter; inside the band the lead carries the live number.
//   BD-6  under "What has to happen", the levels table: seven rows top to
//         bottom by price (the three upside rungs, the baseline, the three
//         downside rungs) with one live marker row where the live price sits;
//         each row's % and price from the ONE helper the Fuse and the bar print
//         (bombView.rungFacts); a collapsed Details for a measured position.

import React from 'react';
import { BT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { brickPlan, kOf } from './ladder.js';
import { BUST_TIERS } from '../../../constants/baggerBombScoring.js';
import { baselineText, toGoParts, downToGoParts } from './FuseChart.jsx';
import { ladderStateCopy } from './BombPlot.jsx';
import { rungFacts, liveMovePct } from './bombView.js';
import { etClock } from './checkClock.js';
import { priceText } from '../priceFormat.js';
import useMeasuredWidth from './useMeasuredWidth.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** The to-go text with a no-break space after its arrow (review D9). */
const nbspArrow = (text) => text.replace(/^(\S+) /, '$1\u00a0');

/** One side's to-go text: the lead's in full (with the live number inside its band), the other's short. */
function sideText(ladder, side, g, { lead, closed }) {
  if (side === 'up') {
    if (lead) { const p = toGoParts(ladder, g, { closed }); return p ? (p.suffix ? `${p.base} · ${p.suffix}` : p.base) : null; }
    if (!g) return ladder.next ? null : BOMB_COPY.allBanked;
    if (g.distance <= 0 || g.bricks == null) return toGoParts(ladder, g, { closed, withLive: false }).base;
    return BOMB_COPY.toGoShort(g.pctShown, g.bricks, g.rung.points);
  }
  if (!g) return ladder.nextDown ? null : BOMB_COPY.downEveryRungHit;
  if (lead) { const p = downToGoParts(ladder, g, { closed }); return p.suffix ? `${p.base} · ${p.suffix}` : p.base; }
  if (g.distance <= 0 || g.bricks == null) return downToGoParts(ladder, g, { closed, withLive: false }).base;
  return BOMB_COPY.downToGoShort(g.pctShown, g.bricks, g.rung.label, g.rung.points);
}

/**
 * BD-4 — the sheet's ONE to-go line: `{ lead: { side, text }, other: { side, text } | null }`,
 * e.g. ↓ 3.19% · 5 bricks to Bust −10 · ↑ 4.78% · 8 to +15. Null when neither side has text.
 */
export function sheetToGo(ladder, go, goDown, lead, { closed = false } = {}) {
  if (!ladder || ladder.status !== 'ok') return null;
  const leadSide = lead === 'down' && ladder.nextDown ? 'down' : ladder.next || !ladder.nextDown ? 'up' : 'down';
  const otherSide = leadSide === 'up' ? 'down' : 'up';
  const arrow = (side) => (side === 'up' ? BOMB_COPY.upArrow : BOMB_COPY.downArrow);
  const leadText = sideText(ladder, leadSide, leadSide === 'up' ? go : goDown, { lead: true, closed });
  const otherText = sideText(ladder, otherSide, otherSide === 'up' ? go : goDown, { lead: false, closed });
  if (!leadText && !otherText) return null;
  return {
    lead: leadText ? { side: leadSide, text: `${arrow(leadSide)} ${leadText}` } : null,
    other: otherText ? { side: otherSide, text: `${arrow(otherSide)} ${otherText}` } : null,
  };
}

/**
 * BD-6 — the levels table's rows, top to bottom by price: the upside rungs, the
 * baseline, the downside rungs, and one live marker where the live price sits
 * (by the DISPLAYED prices). A preview carries no states.
 */
export function levelRows(view) {
  const { ladder, decimals: d } = view;
  if (!ladder || ladder.status !== 'ok') return [];
  const held = ladder.kind === 'held';
  const bankedTimes = view.bankedTimes || {};
  const hitTimes = view.hitTimes || {};
  const clockOf = (ms) => (finite(ms) ? etClock(ms) : null);
  const rungRow = (r, side) => {
    const facts = rungFacts(ladder, r, d);
    let state = null;
    let stateText = null;
    if (held && side === 'up' && r.banked) { state = 'banked'; stateText = BOMB_COPY.levelBanked(clockOf(bankedTimes[r.key])); }
    else if (held && side === 'down' && r.hit) { state = 'hit'; stateText = BOMB_COPY.downLevelHit(clockOf(hitTimes[r.key])); }
    else if (held && side === 'up' && ladder.next?.key === r.key) { state = 'next'; stateText = BOMB_COPY.levelNext(view.go?.bricks); }
    else if (held && side === 'down' && ladder.nextDown?.key === r.key) { state = 'next'; stateText = BOMB_COPY.levelNext(view.goDown?.bricks); }
    return {
      key: r.key, side, emoji: r.emoji, name: r.label, price: r.price, priceText: facts.priceText,
      sub: BOMB_COPY.levelSub(facts.pctText, facts.priceText),
      points: side === 'down' ? BOMB_COPY.downPoints(r.points) : BOMB_COPY.levelPoints(r.points),
      state, stateText,
    };
  };
  const rows = [
    ...[...ladder.up].sort((a, b) => b.k - a.k).map((r) => rungRow(r, 'up')),
    { key: 'baseline', side: 'base', emoji: null, name: baselineText(ladder, d), price: ladder.baseline.price, sub: null, points: null, state: null, stateText: null },
    ...[...ladder.down].sort((a, b) => b.k - a.k).map((r) => rungRow(r, 'down')),
  ];
  if (finite(view.live) && view.live > 0) {
    const shown = (p) => Number(priceText(p, d));
    const liveShown = shown(view.live);
    // Review A6: a live price ON a rung sits past it in that rung's award direction —
    // above an upside rung (reaching it is the upside's condition), below a downside one.
    const at = rows.findIndex((r) => (r.side === 'down' ? shown(r.price) < liveShown : shown(r.price) <= liveShown));
    const pct = liveMovePct(ladder, view.live, d);
    const text = (view.marketOpen === false ? BOMB_COPY.levelLast : BOMB_COPY.levelLive)(view.live, d, pct);
    rows.splice(at === -1 ? rows.length : at, 0, { key: 'live', side: 'live', text });
  }
  return rows;
}

const ROW = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '7px 0', minWidth: 0 };

function LevelsTable({ view }) {
  const rows = levelRows(view);
  if (!rows.length) return null;
  const preview = view.ladder.kind === 'preview';
  const divider = `1px solid ${tint(BT.ink, 8)}`;
  return (
    <div data-bomb-levels="1" style={{ marginTop: 14, fontFamily: MONO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: BT.ink3, fontWeight: 700 }}>{BOMB_COPY.levelsTitle}</span>
        {preview && <span data-bomb-levels-preview="1" style={{ fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: BT.gold, fontWeight: 700 }}>{BOMB_COPY.levelsPreview}</span>}
      </div>
      <div style={{ marginTop: 4 }}>
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          if (r.side === 'live') {
            return (
              <div key="live" data-level-live="1" style={{ ...ROW, padding: '5px 0', borderBottom: last ? 'none' : divider }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: BT.teal, overflowWrap: 'anywhere' }}>{r.text}</span>
              </div>
            );
          }
          const color = r.side === 'down' ? BT.red : r.state === 'banked' ? BT.green : BT.gold;
          const stateColor = r.state === 'banked' ? BT.green : r.state === 'hit' ? BT.red : BT.ink2;
          return (
            <div key={r.key} data-level={r.key} data-level-side={r.side} data-level-state={r.state || 'none'} style={{ ...ROW, borderBottom: last ? 'none' : divider }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: r.side === 'base' ? 400 : 700, color: r.side === 'base' ? BT.ink2 : BT.ink, overflowWrap: 'anywhere' }}>{r.emoji ? `${r.emoji} ${r.name}` : r.name}</span>
                {r.sub && <span data-level-sub={r.key} style={{ fontSize: 10.5, color: BT.ink3 }}>{r.sub}</span>}
              </span>
              {r.points && (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span data-level-points={r.key} style={{ fontSize: 13, fontWeight: 800, color }}>{r.points}</span>
                  {r.stateText && <span data-level-state-text={r.key} style={{ fontSize: 10, fontWeight: r.state === 'next' ? 400 : 700, color: stateColor, whiteSpace: 'nowrap' }}>{r.stateText}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {view.details && <Details details={view.details} />}
    </div>
  );
}

/** StockRewardDetails' facts, moved unchanged (BD-6): collapsed. */
function Details({ details }) {
  return (
    <details data-bomb-details="1" style={{ marginTop: 10, fontSize: 10.5, color: BT.ink2, lineHeight: 1.5 }}>
      <summary style={{ cursor: 'pointer', color: BT.ink3, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{BOMB_COPY.detailsTitle}</summary>
      <div style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
        <div>{BOMB_COPY.detailsMeasured(details.scoringPctDecimal)}</div>
        <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
          {details.targets.map((t) => <li key={t.key}>{BOMB_COPY.detailsTarget(t.label, t.target)}</li>)}
        </ul>
        <div>{BOMB_COPY.detailsQuote(details.currentPrice, details.providerAsOf)}</div>
        <div>{BOMB_COPY.detailsPosition(details.positionId)}</div>
        <div>{BOMB_COPY.detailsReceipt(details.receiptHash)}</div>
        <div>{BOMB_COPY.detailsInput(details.inputRef)}</div>
        <div>{BOMB_COPY.detailsModel(details.modelId)}</div>
        <div>{BOMB_COPY.detailsCents}</div>
      </div>
    </details>
  );
}

export default function BombSheet({ view }) {
  const [ref, measured] = useMeasuredWidth(340);
  const { ladder, go, decimals: d } = view;
  if (!ladder || ladder.status !== 'ok') {
    const [title, why] = ladderStateCopy(ladder?.status);
    return (
      <section ref={ref} data-bomb-sheet="state" aria-label="Bomb ladder" style={{ padding: '16px 4px', fontFamily: MONO }}>
        <div role="status" style={{ fontSize: 14, fontWeight: 700, color: BT.ink }}>{title}</div>
        {why && <div style={{ fontSize: 12, marginTop: 6, color: BT.ink2, lineHeight: 1.4 }}>{why}</div>}
      </section>
    );
  }
  const goDown = view.goDown ?? null;
  const W = Math.max(260, measured);
  const x0 = 16;
  const x1 = W - 16;
  // ONE scale for both sides: Meltdown at the left end, TenBagger at the right.
  const kMin = Math.min(...ladder.down.map((r) => r.k), -2);
  const kMax = Math.max(...ladder.up.map((r) => r.k), 2);
  const fx = (k) => x0 + ((Math.max(kMin, Math.min(k, kMax)) - kMin) / (kMax - kMin)) * (x1 - x0);
  const xEntry = fx(0);
  const kLive = kOf(ladder, view.live);
  const planUp = brickPlan(ladder);
  const planDown = brickPlan(ladder, BUST_TIERS);
  const nextKey = ladder.next?.key ?? null;
  const nextDownKey = ladder.nextDown?.key ?? null;
  const togo = sheetToGo(ladder, go, goDown, view.lead, { closed: view.marketOpen === false });
  const ticks = (plan, sign) => (plan ? Array.from({ length: plan.total - 1 }, (_, i) => i + 1).filter((b) => !Object.values(plan.rungBricks).includes(b)).map((b) => sign * b) : []);
  const anchorOf = (k) => (k <= kMin ? 'start' : k >= kMax ? 'end' : 'middle');
  const labelX = (k) => (k <= kMin ? x0 - 6 : k >= kMax ? x1 + 6 : fx(k));
  const priceSize = (text) => (text.length > 9 ? '7' : '8.5');
  const baseText = money(ladder.baseline.price, d);
  const yb = ladder.up.filter((r) => r.banked).reduce((m, r) => Math.max(m, fx(r.k)), xEntry);
  return (
    <section ref={ref} data-bomb-sheet={ladder.kind} aria-label="Bomb ladder" style={{ padding: '8px 2px 4px', fontFamily: MONO, color: BT.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span data-bomb-sheet-baseline="1" style={{ fontSize: 11, color: BT.ink2 }}>{baselineText(ladder, d)}</span>
        {ladder.kind === 'held' && ladder.bankedPoints > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: BT.green }}>{BOMB_COPY.sheetBankedSoFar(ladder.bankedPoints)}</span>}
      </div>
      {togo && (
        <div data-sheet-togo="1" style={{ marginTop: 8, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
          {/* Review D9: no-break spaces bind each arrow to its number and each "·" to the text before it, so a wrap never strands either. */}
          {togo.lead && <span data-sheet-togo-lead={togo.lead.side} style={{ fontWeight: 700, color: togo.lead.side === 'down' ? BT.red : BT.gold }}>{nbspArrow(togo.lead.text)}</span>}
          {togo.lead && togo.other && <span style={{ color: BT.ink3 }}>{'\u00a0· '}</span>}
          {togo.other && <span data-sheet-togo-other={togo.other.side} style={{ fontWeight: 500, color: BT.ink3 }}>{nbspArrow(togo.other.text)}</span>}
        </div>
      )}
      <svg width={W} height={62} style={{ display: 'block', marginTop: 4, overflow: 'visible' }} aria-label={BOMB_COPY.ariaRail}>
        <rect x={x0} y={16} width={xEntry - x0} height={4} rx={2} style={{ fill: tint(BT.red, 10), stroke: tint(BT.red, 8) }} />
        <rect x={xEntry} y={16} width={x1 - xEntry} height={4} rx={2} style={{ fill: tint(BT.ink, 8), stroke: tint(BT.ink, 7) }} />
        {kLive !== null && kLive > 0 && <rect data-sheet-fill="up" x={xEntry} y={16} width={fx(kLive) - xEntry} height={4} rx={2} style={{ fill: BT.teal }} />}
        {kLive !== null && kLive < 0 && <rect data-sheet-fill="down" x={fx(kLive)} y={16} width={xEntry - fx(kLive)} height={4} rx={2} style={{ fill: BT.red }} />}
        {yb > xEntry && <rect x={xEntry} y={16} width={yb - xEntry} height={4} rx={2} style={{ fill: BT.green }} />}
        {ticks(planUp, 1).map((b) => <rect key={`u${b}`} data-sheet-brick={b} x={fx(b / 6) - 0.5} y={13} width={1} height={10} style={{ fill: tint(BT.gold, 40) }} />)}
        {ticks(planDown, -1).map((b) => <rect key={`d${b}`} data-sheet-brick={b} x={fx(b / 6) - 0.5} y={13} width={1} height={10} style={{ fill: tint(BT.red, 40) }} />)}
        <rect x={xEntry - 1.5} y={11} width={3} height={14} rx={1} style={{ fill: BT.ink2 }} />
        <text data-sheet-price="baseline" x={xEntry} y={54} textAnchor="middle" fontSize={priceSize(baseText)} style={{ fill: BT.ink2 }}>{baseText}</text>
        {ladder.up.map((r) => {
          const x = fx(r.k);
          const isNext = r.key === nextKey;
          const price = rungFacts(ladder, r, d).priceText;
          return (
            <g key={r.key} data-sheet-rung={r.key} data-side="up" data-rung-banked={r.banked ? '1' : '0'}>
              {r.banked
                ? <g><circle cx={x} cy={18} r={8} style={{ fill: BT.green }} /><path d={`M${x - 4} 18l3 3 5-6`} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: BT.bg }} /></g>
                : <circle cx={x} cy={18} r={isNext ? 7 : 5} strokeWidth={isNext ? 2 : 1.5} style={{ fill: BT.bg, stroke: BT.gold, opacity: isNext ? 1 : 0.55 }} />}
              <text data-sheet-points={r.key} x={labelX(r.k)} y={41} textAnchor={anchorOf(r.k)} fontSize="10" fontWeight="800" style={{ fill: r.banked ? BT.green : isNext ? BT.gold : tint(BT.gold, 55) }}>{BOMB_COPY.rungPoints(r.points, false) /* review D6: the green check disc marks banked; a ✓ here collided at full scale */}</text>
              {isNext && <text data-sheet-price={r.key} x={labelX(r.k)} y={54} textAnchor={anchorOf(r.k)} fontSize={priceSize(price)} style={{ fill: BT.ink3 }}>{price}</text>}
            </g>
          );
        })}
        {ladder.down.map((r) => {
          const x = fx(r.k);
          const isNext = r.key === nextDownKey;
          const price = rungFacts(ladder, r, d).priceText;
          return (
            <g key={r.key} data-sheet-rung={r.key} data-side="down" data-rung-hit={r.hit ? '1' : '0'}>
              {r.hit
                ? <circle cx={x} cy={18} r={7} style={{ fill: BT.red }} />
                : <circle cx={x} cy={18} r={isNext ? 7 : 5} strokeWidth={isNext ? 2 : 1.5} style={{ fill: BT.bg, stroke: BT.red, opacity: isNext ? 1 : 0.55 }} />}
              <text data-sheet-points={r.key} x={labelX(r.k)} y={41} textAnchor={anchorOf(r.k)} fontSize="10" fontWeight="800" style={{ fill: r.hit || isNext ? BT.red : tint(BT.red, 55) }}>{BOMB_COPY.downPoints(r.points)}</text>
              {isNext && <text data-sheet-price={r.key} x={labelX(r.k)} y={54} textAnchor={anchorOf(r.k)} fontSize={priceSize(price)} style={{ fill: BT.ink3 }}>{price}</text>}
            </g>
          );
        })}
        {kLive !== null && <circle data-sheet-bead="1" cx={fx(kLive)} cy={18} r={4} style={{ fill: kLive < 0 ? BT.red : BT.core }} />}
      </svg>
      {view.sheetLine && (
        <div data-bomb-what="1" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: BT.ink2, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: BT.ink3, fontWeight: 700, marginRight: 8 }}>{BOMB_COPY.whatHasToHappen}</span>
          {view.sheetLine}
        </div>
      )}
      {view.sheetScored && <div data-bomb-sheet-scored="1" style={{ marginTop: 8, fontSize: 10.5, color: BT.ink2 }}>{view.sheetScored}</div>}
      <LevelsTable view={view} />
    </section>
  );
}
