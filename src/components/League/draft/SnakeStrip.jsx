// src/components/League/draft/SnakeStrip.jsx
//
// Horizontal snake strip — the turn order, always legible. Ported from the
// design (draft-desktop.jsx). Wired to the real snake: the back-to-back bridge
// is derived from the live snakeOrder (consecutive human picks), not hardcoded
// to #8/#9, so it tracks whatever seat the human holds (verified seat 0 → the
// #8/#9 pair, but derived for safety).

import React from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { Mono } from './draftPrimitives';

// picksByOverall[o] = { symbol, human, sniped } | null
export function SnakeStrip({ snakeOrder = [], picksByOverall = [], onClockIndex = -1, humanSeatIdx = 0 }) {
  const isHumanBackToBackStart = (o) => snakeOrder[o] === humanSeatIdx && snakeOrder[o + 1] === humanSeatIdx;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
      {snakeOrder.map((seatIdx, o) => {
        const pick = picksByOverall[o] || null;
        const mine = seatIdx === humanSeatIdx;
        const onClock = o === onClockIndex;
        const cellColor = pick ? (pick.human ? DX.you : DX.cpu) : null;
        return (
          <div key={o} style={{ position: 'relative' }}>
            {isHumanBackToBackStart(o) && (
              <div style={{ position: 'absolute', top: -15, left: 2, right: -52, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1, height: 1, background: alpha(DX.you, 0.4) }} />
                <Mono style={{ fontSize: 8, color: DX.you, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>BACK-TO-BACK</Mono>
                <div style={{ flex: 1, height: 1, background: alpha(DX.you, 0.4) }} />
              </div>
            )}
            <div style={{ width: 30, height: 34, borderRadius: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: pick ? alpha(cellColor, pick.human ? 0.18 : 0.1) : onClock ? alpha(DX.you, 0.14) : mine ? alpha(DX.you, 0.05) : TOKENS.surface,
              border: `1px solid ${pick ? alpha(cellColor, 0.4) : onClock ? DX.you : mine ? alpha(DX.you, 0.32) : TOKENS.hair}`,
              boxShadow: onClock ? `0 0 0 3px ${alpha(DX.you, 0.14)}` : 'none', animation: onClock ? 'ldBlink 1.4s infinite' : 'none' }}>
              <Mono style={{ fontSize: 8, color: pick ? alpha(cellColor, 0.95) : mine ? DX.you : TOKENS.ink3, fontWeight: 700 }}>{o + 1}</Mono>
              {pick
                ? <Mono style={{ fontSize: 8.5, fontWeight: 700, color: TOKENS.ink, lineHeight: 1 }}>{pick.symbol}</Mono>
                : <span style={{ width: 5, height: 5, borderRadius: '50%', marginTop: 2, background: mine ? DX.you : alpha(DX.cpu, 0.5) }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SnakeStrip;
