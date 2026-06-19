// src/components/League/draft/RevealRow.jsx
//
// Opponent-reveal atoms — ported from the design (draft-parts.jsx). A RevealRow
// per CPU pick in the run-up feed, plus the dramatic center SnipeCallout. A
// "snipe" = a CPU took a name that sat in your pre-pick top tier (#1–6).

import React from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, SeatAvatar } from './draftPrimitives';

// pick: { seatLabel, isCpu, symbol, overall (1-based), sniped, humanRank }
export function RevealRow({ pick, fresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11,
      background: pick.sniped ? alpha(DX.snipe, 0.1) : TOKENS.surface,
      border: `1px solid ${pick.sniped ? alpha(DX.snipe, 0.4) : TOKENS.hair}`,
      animation: fresh ? 'ldRise .35s ease both' : 'none' }}>
      <SeatAvatar isCpu={pick.isCpu} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.ink }}>{pick.seatLabel}</span>
          <Mono style={{ fontSize: 9, color: DX.cpu, letterSpacing: '0.06em' }}>· auto-drafting</Mono>
        </div>
        <div style={{ fontSize: 11.5, color: TOKENS.ink2, marginTop: 1 }}>
          took <span style={{ color: TOKENS.ink, fontWeight: 700 }}>{pick.symbol}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Mono style={{ fontSize: 10, color: TOKENS.ink3 }}>#{pick.overall}</Mono>
        {pick.sniped && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Icon name="snipe" size={11} color={DX.snipe} stroke={2.2} />
            <Mono style={{ fontSize: 9, color: DX.snipe, fontWeight: 700, letterSpacing: '0.06em' }}>
              SNIPED{pick.humanRank != null ? ` #${pick.humanRank}` : ''}
            </Mono>
          </div>
        )}
      </div>
    </div>
  );
}

// the dramatic center snipe callout (skipped under reduced motion by the caller)
export function SnipeCallout({ symbol, seatLabel }) {
  if (!symbol) return null;
  return (
    <div style={{ position: 'absolute', top: '36%', left: 0, right: 0, margin: '0 auto', zIndex: 60, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderRadius: 16, width: 'fit-content',
      background: alpha(TOKENS.bg, 0.92), border: `1px solid ${alpha(DX.snipe, 0.5)}`, boxShadow: `0 12px 50px ${alpha(DX.snipe, 0.3)}`,
      animation: 'ldRise .3s ease both' }}>
      <Icon name="snipe" size={26} color={DX.snipe} stroke={2} />
      <div>
        <Mono style={{ fontSize: 10, letterSpacing: '0.16em', color: DX.snipe, fontWeight: 700 }}>SNIPED</Mono>
        <div style={{ fontSize: 17, fontWeight: 700, color: TOKENS.ink, marginTop: 2 }}>{seatLabel} grabbed {symbol}</div>
      </div>
    </div>
  );
}

export default RevealRow;
