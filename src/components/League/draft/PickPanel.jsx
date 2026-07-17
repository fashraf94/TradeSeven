// src/components/League/draft/PickPanel.jsx
//
// The right rail: the clock + two-step confirm when it's your turn, a calm
// "opponents drafting" state otherwise, the advisor Orb + coach line always, and
// the locked-lineup summary at the end. Ported from the design's PickPanel
// (draft-desktop.jsx). Phase 1 shows opponents' picks post-pick (no animated
// reveal yet — that's Phase 2); the waiting state covers the CPU run-up.

import React from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, Orb, ClockRing, FitBar, SectorTag } from './draftPrimitives';
import { LineupSlots } from './SeatCard';
import { RevealRow } from './RevealRow';

export function PickPanel({
  phase, pickClock, pickNo, backToBack, selected, coach, orbState = 'ready',
  onConfirm, onClear, submitting = false, error = null, myPicks = [],
  onExit = null, onClockLabel = null, clockTotalSec = 20,
  revealRows = [], onSkip = null,
  // L3 (V2): when false, the Confirm/Clear footer moves to the shared viewport-
  // pinned action bar (the panel keeps only the selected-pick preview + coach).
  // Default true → flag-off renders today's in-panel confirm byte-identically.
  showFooterConfirm = true,
}) {
  const yourTurn = phase === 'your-turn';
  const waiting = phase === 'waiting';
  const revealing = phase === 'revealing';
  const done = phase === 'done';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 13, overflow: 'hidden' }}>
      {/* status header */}
      {!done && (
        <div style={{ borderRadius: 14, padding: '14px 15px', background: (waiting || revealing) ? alpha(DX.cpu, 0.07) : alpha(DX.you, 0.06), border: `1px solid ${(waiting || revealing) ? alpha(DX.cpu, 0.28) : alpha(DX.you, 0.26)}` }}>
          {revealing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: DX.cpu, animation: 'ldLiveDot 1.4s infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Mono style={{ fontSize: 10, letterSpacing: '0.14em', color: DX.cpu, fontWeight: 700 }}>OPPONENTS DRAFTING</Mono>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.ink, marginTop: 2 }}>The table is on the clock</div>
              </div>
              {onSkip && (
                <button className="ld-tap" onClick={onSkip} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}`, color: TOKENS.ink2 }}>
                  <Mono style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>SKIP</Mono>
                  <Icon name="arrowR" size={12} color={TOKENS.ink2} />
                </button>
              )}
            </div>
          ) : waiting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: DX.cpu, animation: 'ldLiveDot 1.4s infinite', flexShrink: 0 }} />
              <div>
                <Mono style={{ fontSize: 10, letterSpacing: '0.14em', color: DX.cpu, fontWeight: 700 }}>OPPONENTS DRAFTING</Mono>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.ink, marginTop: 2 }}>{onClockLabel ? `${onClockLabel} is on the clock` : 'The table is on the clock'}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ClockRing seconds={pickClock} total={clockTotalSec} size={84} />
              <div style={{ minWidth: 0 }}>
                <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color: DX.you, fontWeight: 700 }}>YOU'RE ON THE CLOCK</Mono>
                <div style={{ fontSize: 19, fontWeight: 700, color: TOKENS.ink, marginTop: 2 }}>Pick #{pickNo} overall</div>
                {backToBack && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 8px', borderRadius: 999, background: alpha(DX.you, 0.13), border: `1px solid ${alpha(DX.you, 0.35)}` }}>
                    <Icon name="bolt" size={11} color={DX.you} /><Mono style={{ fontSize: 9, color: DX.you, fontWeight: 700, letterSpacing: '0.06em' }}>BACK-TO-BACK</Mono>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* body */}
      <div className="ld-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <div style={{ borderRadius: 12, padding: '9px 12px', background: alpha(DX.neg, 0.1), border: `1px solid ${alpha(DX.neg, 0.4)}`, color: '#ffd7de', fontSize: 12.5 }}>{error}</div>
        )}

        {revealing && (
          <>
            {revealRows.slice().reverse().map((p, i) => <RevealRow key={p.overall} pick={p} fresh={i === 0} />)}
            <div style={{ textAlign: 'center', padding: '6px' }}><Mono style={{ fontSize: 10.5, color: TOKENS.ink3 }}>re-ranking your best available…</Mono></div>
          </>
        )}

        {yourTurn && (
          selected ? (
            <div style={{ borderRadius: 14, padding: '14px 15px', background: alpha(DX.you, 0.07), border: `1px solid ${alpha(DX.you, 0.3)}` }}>
              <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: DX.you, fontWeight: 700 }}>SELECTED</Mono>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: TOKENS.ink }}>{selected.symbol}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <SectorTag sector={selected.sectorName} />
                <FitBar fit={selected.fit} tier={selected.tier} w={90} />
              </div>
              <div style={{ fontSize: 12.5, color: TOKENS.ink2, lineHeight: 1.45, marginTop: 10 }}>{selected.reason}</div>
            </div>
          ) : (
            <div style={{ borderRadius: 14, padding: '16px 15px', background: TOKENS.surface, border: `1px dashed ${TOKENS.hair2}`, textAlign: 'center' }}>
              <Icon name="trend" size={20} color={TOKENS.ink3} style={{ margin: '0 auto' }} />
              <div style={{ fontSize: 13, color: TOKENS.ink2, marginTop: 8, lineHeight: 1.45 }}>Select a name from the board to draft it.</div>
              <Mono style={{ fontSize: 10, color: TOKENS.ink3, marginTop: 6, display: 'block' }}>Clock expires → auto-picks your top fit</Mono>
            </div>
          )
        )}

        {done && (
          <div style={{ borderRadius: 14, padding: '16px', background: alpha(DX.you, 0.06), border: `1px solid ${alpha(DX.you, 0.26)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <Icon name="check" size={18} color={DX.you} stroke={2.4} />
              <div style={{ fontSize: 17, fontWeight: 700, color: TOKENS.ink }}>Lineup locked</div>
            </div>
            <LineupSlots picks={myPicks} />
          </div>
        )}

        {/* advisor — always present */}
        {coach && (
          <div style={{ borderRadius: 14, padding: '13px 14px', background: TOKENS.surface, border: `1px solid ${TOKENS.hair}`, display: 'flex', gap: 11 }}>
            <Orb state={orbState} size={38} color={DX.you} />
            <div style={{ minWidth: 0 }}>
              <Mono style={{ fontSize: 9.5, letterSpacing: '0.1em', color: DX.you, fontWeight: 600 }}>{String(coach.title || '').toUpperCase()}</Mono>
              <div style={{ fontSize: 12.5, color: TOKENS.ink2, lineHeight: 1.45, marginTop: 4 }}>{coach.body}</div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      {yourTurn && showFooterConfirm && (
        <div style={{ display: 'flex', gap: 9 }}>
          {selected && (
            <button className="ld-tap" onClick={onClear} disabled={submitting} style={{ all: 'unset', cursor: submitting ? 'default' : 'pointer', padding: '15px 16px', borderRadius: 13, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}`, color: TOKENS.ink2, fontWeight: 600, fontSize: 13.5 }}>Clear</button>
          )}
          <button className="ld-tap" onClick={selected && !submitting ? onConfirm : undefined} disabled={!selected || submitting} style={{ all: 'unset', cursor: selected && !submitting ? 'pointer' : 'default',
            flex: 1, textAlign: 'center', padding: '15px', borderRadius: 13, fontWeight: 700, fontSize: 15,
            background: selected ? DX.you : TOKENS.surface, color: selected ? TOKENS.bg : TOKENS.ink3,
            border: selected ? 'none' : `1px solid ${TOKENS.hair}`, boxShadow: selected ? `0 8px 24px ${alpha(DX.you, 0.3)}` : 'none', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Drafting…' : selected ? `Confirm — draft ${selected.symbol}` : 'Select a name to draft'}
          </button>
        </div>
      )}
      {done && onExit && (
        <button className="ld-tap" onClick={onExit} style={{ all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '15px', borderRadius: 13, background: DX.you, color: TOKENS.bg, fontWeight: 700, fontSize: 15, boxShadow: `0 8px 24px ${alpha(DX.you, 0.3)}` }}>
          Open the battle view →
        </button>
      )}
    </div>
  );
}

export default PickPanel;
