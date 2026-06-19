// src/components/League/draft/SeatCard.jsx
//
// A seat in the left rail (a "team" with its roster). Ported from the design
// (draft-desktop.jsx). The human seat shows the practice agent's archetype; CPU
// seats auto-draft (the real CPUs don't expose an archetype to the client, so
// they read "CPU · auto-drafting" rather than inventing one).

import React from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, SeatAvatar } from './draftPrimitives';
import { archMeta } from './boardModel';

export function SeatCard({ seat, archKey, active, picksPerPlayer = 3 }) {
  const cpu = seat.isCpu;
  const color = cpu ? DX.cpu : DX.you;
  const subLabel = cpu ? 'Auto-drafting' : archMeta(archKey).name;
  return (
    <div style={{ borderRadius: 13, padding: '11px 12px',
      background: active ? alpha(color, 0.08) : TOKENS.surface,
      border: `1px solid ${active ? alpha(color, 0.5) : TOKENS.hair}`,
      boxShadow: active ? `0 0 0 3px ${alpha(color, 0.1)}` : 'none', transition: 'all .2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SeatAvatar isCpu={cpu} size={32} live={active} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: seat.isYou ? DX.you : TOKENS.ink }}>{seat.label}</span>
            {cpu ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 4, background: alpha(DX.cpu, 0.13), border: `1px solid ${alpha(DX.cpu, 0.3)}` }}>
                <Icon name="cpu" size={9} color={DX.cpu} stroke={2.2} /><Mono style={{ fontSize: 8, color: DX.cpu, fontWeight: 700, letterSpacing: '0.06em' }}>CPU</Mono>
              </span>
            ) : (
              <Mono style={{ fontSize: 8.5, color: DX.you, fontWeight: 700, letterSpacing: '0.08em' }}>YOU</Mono>
            )}
          </div>
          <Mono style={{ fontSize: 9.5, color: TOKENS.ink3, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subLabel}</Mono>
        </div>
        {active && <Mono style={{ fontSize: 8.5, color, fontWeight: 700, letterSpacing: '0.08em', animation: 'ldBlink 1.4s infinite' }}>ON CLOCK</Mono>}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 9, minHeight: 22 }}>
        {Array.from({ length: picksPerPlayer }).map((_, i) => {
          const sym = seat.picks[i];
          return sym ? (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 6, background: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.28)}` }}>
              <Mono style={{ fontSize: 10.5, fontWeight: 700, color: TOKENS.ink }}>{sym}</Mono>
            </div>
          ) : (
            <div key={i} style={{ flex: 1, padding: '3px 0', borderRadius: 6, border: `1px dashed ${TOKENS.hair2}`, textAlign: 'center' }}>
              <Mono style={{ fontSize: 10, color: TOKENS.ink3 }}>·</Mono>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// your lineup — the 3 slots filling (the design's LineupSlots, ticker-only).
export function LineupSlots({ picks = [], picksPerPlayer = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: picksPerPlayer }).map((_, i) => {
        const sym = picks[i] || null;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12,
            background: sym ? alpha(DX.you, 0.07) : TOKENS.surface, border: `1px ${sym ? 'solid' : 'dashed'} ${sym ? alpha(DX.you, 0.3) : TOKENS.hair2}` }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: sym ? alpha(DX.you, 0.16) : TOKENS.bg, border: `1px solid ${sym ? alpha(DX.you, 0.3) : TOKENS.hair}` }}>
              <Mono style={{ fontSize: 11, fontWeight: 700, color: sym ? DX.you : TOKENS.ink3 }}>{i + 1}</Mono>
            </div>
            {sym ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>{sym}</div>
                </div>
                <Icon name="check" size={15} color={DX.you} stroke={2.4} />
              </>
            ) : <Mono style={{ fontSize: 12, color: TOKENS.ink3, letterSpacing: '0.04em' }}>Open slot</Mono>}
          </div>
        );
      })}
    </div>
  );
}

export default SeatCard;
