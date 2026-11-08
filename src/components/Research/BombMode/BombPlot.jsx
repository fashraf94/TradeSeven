// src/components/Research/BombMode/BombPlot.jsx
//
// The plot area StockChart hands over when Bomb mode is on and the 💣 pill is
// selected (spec §4.4): the Fuse, the red zone, or — when the ladder cannot be
// drawn — a short honest state. Never a candle.

import React from 'react';
import FuseChart from './FuseChart.jsx';
import RedZone from './RedZone.jsx';
import useMeasuredWidth from './useMeasuredWidth.js';
import { BOMB_COPY } from './bombCopy.js';
import { BT, MONO, HEAT, tint } from './bombTheme.js';
import { isRedZoneMode } from './redZone.js';

/** The one-line state for a ladder that cannot be drawn. */
export function ladderStateCopy(status) {
  switch (status) {
    case 'entry_unavailable': return [BOMB_COPY.entryUnavailable, BOMB_COPY.entryUnavailableWhy];
    case 'measured_unavailable': return [BOMB_COPY.measuredUnavailable, BOMB_COPY.measuredUnavailableWhy];
    case 'short_unsupported': return [BOMB_COPY.shortUnsupported, ''];
    case 'model_unavailable': return [BOMB_COPY.modelUnavailable, BOMB_COPY.modelUnavailableWhy];
    default: return [BOMB_COPY.previewUnavailable, BOMB_COPY.previewUnavailableWhy];
  }
}

export default function BombPlot({ view, height }) {
  const [ref, width] = useMeasuredWidth();
  const { ladder } = view;
  let body;
  if (!ladder || ladder.status !== 'ok') {
    const [title, why] = ladderStateCopy(ladder?.status);
    body = (
      <div data-bomb-view="state" data-bomb-state={ladder?.status || 'none'} role="status" style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 24px', textAlign: 'center', background: BT.bg, fontFamily: MONO }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: BT.ink }}>{title}</div>
        {why && <div style={{ fontSize: 12, color: BT.ink2, lineHeight: 1.4 }}>{why}</div>}
      </div>
    );
  } else if (isRedZoneMode(view.mode)) {
    body = <RedZone ladder={ladder} go={view.go} live={view.live} decimals={view.decimals} mode={view.mode} trace={view.trace} clock={view.clock} scoredText={view.redZoneScored} moment={view.moment} nowMs={view.nowMs} width={width} height={height} />;
  } else {
    body = <FuseChart ladder={ladder} live={view.live} decimals={view.decimals} go={view.go} ghost={view.ghost} checkDots={view.checkDots} bankedTimes={view.bankedTimes} closed={view.marketOpen === false} width={width} height={height} />;
  }
  return <div ref={ref} data-bomb-plot="1" style={{ width: '100%', height, overflow: 'hidden' }}>{body}</div>;
}

/** The control bar's RED ZONE chip — a state indicator, not a tab (R-11′(e)). */
export function RedZoneChip({ mode }) {
  if (!isRedZoneMode(mode)) return null;
  const frozen = mode === 'closed';
  return (
    <span data-bomb-redzone-chip={mode} style={{
      fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap',
      color: frozen ? BT.ink2 : HEAT, background: frozen ? tint(BT.ink, 5) : tint(HEAT, 14), border: `1px solid ${frozen ? tint(BT.ink, 12) : tint(HEAT, 40)}`,
      padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: frozen ? BT.ink3 : HEAT }} />
      {BOMB_COPY.redZoneChip}
    </span>
  );
}
