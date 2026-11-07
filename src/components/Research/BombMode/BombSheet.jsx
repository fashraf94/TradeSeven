// src/components/Research/BombMode/BombSheet.jsx
//
// Research Modal Build A — ONE SHEET for both Bomb views (spec §4.3;
// Amendment A R-11′(c)): the ladder rail (baseline → three rungs, banked lit,
// brick ticks, the to-go label above the next rung, the live bead) and one
// line of what has to happen, from templates only. The ENTRY / BANKED / NEXT
// tiles of the batch-1 design are retired; their numbers live on the rail.
// It replaces BaggerBombTab's content when Bomb mode is on.

import React from 'react';
import { BT, tint, MONO } from './bombTheme.js';
import { BOMB_COPY, money } from './bombCopy.js';
import { brickPlan, kOf } from './ladder.js';
import { baselineText, toGoText } from './FuseChart.jsx';
import { ladderStateCopy } from './BombPlot.jsx';
import useMeasuredWidth from './useMeasuredWidth.js';

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
  const W = Math.max(260, measured);
  const x0 = 14;
  const x1 = W - 22;
  const topK = Math.max(...ladder.up.map((r) => r.k));
  const fx = (k) => x0 + (Math.max(0, Math.min(k, topK)) / topK) * (x1 - x0);
  const kLive = kOf(ladder, view.live);
  const plan = brickPlan(ladder);
  const nextKey = ladder.next?.key ?? null;
  const label = toGoText(ladder, go);
  return (
    <section ref={ref} data-bomb-sheet={ladder.kind} aria-label="Bomb ladder" style={{ padding: '8px 2px 4px', fontFamily: MONO, color: BT.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span data-bomb-sheet-baseline="1" style={{ fontSize: 11, color: BT.ink2 }}>{baselineText(ladder, d)}</span>
        {ladder.kind === 'held' && ladder.bankedPoints > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: BT.green }}>{BOMB_COPY.sheetBankedSoFar(ladder.bankedPoints)}</span>}
      </div>
      <svg width={W} height={80} style={{ display: 'block', marginTop: 6, overflow: 'visible' }} aria-label="The ladder rail">
        <rect x={x0} y={34} width={x1 - x0} height={4} rx={2} style={{ fill: tint(BT.ink, 8), stroke: tint(BT.ink, 7) }} />
        {kLive !== null && kLive > 0 && <rect data-sheet-fill="1" x={x0} y={34} width={fx(kLive) - x0} height={4} rx={2} style={{ fill: BT.teal }} />}
        <rect x={x0 - 1.5} y={29} width={3} height={14} rx={1} style={{ fill: BT.ink2 }} />
        {plan && Array.from({ length: plan.total - 1 }, (_, i) => i + 1).filter((b) => !Object.values(plan.rungBricks).includes(b)).map((b) => (
          <rect key={b} data-sheet-brick={b} x={fx(b / 6) - 0.5} y={31} width={1} height={10} style={{ fill: tint(BT.gold, 40) }} />
        ))}
        {ladder.up.map((r) => {
          const x = fx(r.k);
          const isNext = r.key === nextKey;
          const anchor = r.k === topK ? 'end' : 'middle';
          const tx = r.k === topK ? Math.min(x + 6, W - 2) : x;
          return (
            <g key={r.key} data-sheet-rung={r.key} data-rung-banked={r.banked ? '1' : '0'}>
              {r.banked
                ? <g><circle cx={x} cy={36} r={9} style={{ fill: BT.green }} /><path d={`M${x - 4.5} 36l3 3 6-6.5`} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: BT.bg }} /></g>
                : <circle cx={x} cy={36} r={isNext ? 8 : 6} strokeWidth={isNext ? 2 : 1.5} style={{ fill: BT.bg, stroke: BT.gold, opacity: isNext ? 1 : 0.55 }} />}
              <text x={tx} y={60} textAnchor={anchor} fontSize="10" fontWeight="800" style={{ fill: r.banked ? BT.green : isNext ? BT.gold : tint(BT.gold, 55) }}>{BOMB_COPY.rungPoints(r.points, r.banked)}</text>
              <text x={tx} y={72} textAnchor={anchor} fontSize="8.5" style={{ fill: BT.ink3 }}>{money(r.price, d)}</text>
              {isNext && label && <text data-sheet-togo="1" x={Math.max(x0 + 60, Math.min(x, x1 - 60))} y={14} textAnchor="middle" fontSize="8.5" fontWeight="700" letterSpacing="0.5" style={{ fill: BT.gold }}>{label.toUpperCase()}</text>}
            </g>
          );
        })}
        {kLive !== null && <circle data-sheet-bead="1" cx={fx(kLive)} cy={36} r={4} style={{ fill: kLive < 0 ? BT.red : BT.core }} />}
        <text x={x0} y={72} fontSize="8.5" style={{ fill: BT.ink2 }}>{money(ladder.baseline.price, d)}</text>
      </svg>
      {view.sheetLine && (
        <div data-bomb-what="1" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: BT.ink2, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: BT.ink3, fontWeight: 700, marginRight: 8 }}>{BOMB_COPY.whatHasToHappen}</span>
          {view.sheetLine}
        </div>
      )}
      {view.sheetScored && <div data-bomb-sheet-scored="1" style={{ marginTop: 8, fontSize: 10.5, color: BT.ink2 }}>{view.sheetScored}</div>}
    </section>
  );
}
