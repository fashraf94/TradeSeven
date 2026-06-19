// src/screens/TrainingDraftRoomScreen.jsx
//
// League Training Slice 2 — the interactive snake-draft pick lobby on the
// tournamentGroups path. The tournamentGroups analog of DraftRoomScreen (which
// is drafts-bound): it MIRRORS the live pick experience — a universal,
// sector-grouped, composite-sorted board that visibly depletes; a per-player
// archetype-fit highlight overlay; a snake turn HUD; a per-pick countdown — but
// reads the server-authoritative live state and submits picks through the
// training-pick endpoint (tournamentGroups is client-read-only). The overlay
// INFORMS, it never constrains: every available name is pickable.
//
// Dark by absence of a CTA (Slice 3.2 owns the entry hero); reached only via
// dev/preview. No flag flip in this slice.

import React, { useState, useEffect } from 'react';
import { useTrainingDraft } from '../hooks/useTrainingDraft';
import { GROUP_STATUS } from '../constants/leagueTournament';

const C = {
  bg: '#0b1220',
  panel: '#111b2e',
  panelAlt: '#0e1626',
  border: '#1e2d44',
  text: '#e6edf6',
  dim: '#8aa0bd',
  accent: '#38bdf8',
  fit: '#f5b14c',
  taken: '#33415a',
  good: '#34d399',
  warn: '#fb7185',
};

function clockColor(seconds) {
  if (seconds == null) return C.dim;
  if (seconds <= 5) return C.warn;
  if (seconds <= 10) return C.fit;
  return C.good;
}

function seatLabel(seat) {
  if (seat.isYou) return 'You';
  if (seat.isCpu) return `CPU ${seat.seatIndex}`;
  return seat.odUserId;
}

export default function TrainingDraftRoomScreen({ user, groupId, onComplete = null, onExit = null }) {
  const {
    boardBySector, highlightSet, seats, myPicks,
    isMyTurn, isComplete, finalStatus,
    currentPickIndex, totalPicks, round, pickClock,
    submitting, error, submitPick, draft,
  } = useTrainingDraft({ user, groupId, active: true });

  const [selected, setSelected] = useState(null);

  // Clear a stale selection when the turn moves on or the name gets sniped.
  useEffect(() => {
    if (!isMyTurn) setSelected(null);
  }, [isMyTurn, currentPickIndex]);

  // Fire the completion callback once the pod leaves DRAFTING.
  useEffect(() => {
    if (isComplete && onComplete) onComplete(finalStatus);
  }, [isComplete, finalStatus, onComplete]);

  const wrap = { minHeight: '100vh', background: C.bg, color: C.text, padding: 16, fontFamily: 'system-ui, sans-serif' };

  if (!draft && !isComplete) {
    return <div style={wrap}><div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading draft…</div></div>;
  }

  if (isComplete) {
    const flipped = finalStatus === GROUP_STATUS.BATTLE;
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 560, margin: '60px auto', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Draft complete</div>
          <div style={{ color: C.dim, marginBottom: 20 }}>
            {flipped
              ? 'Your pod is live — the five-day battle has begun.'
              : 'Your pod is locked in and waiting for the next market open.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {(draft?.picksByUser?.[user?.odUserId || user?.uid] || myPicks).map((s) => (
              <span key={s} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontWeight: 600 }}>{s}</span>
            ))}
          </div>
          {onExit && (
            <button onClick={onExit} style={{ background: C.accent, color: '#04121f', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>
              View your pod
            </button>
          )}
        </div>
      </div>
    );
  }

  const picksRemaining = totalPicks - currentPickIndex;
  const onClockSeat = seats.find(s => s.onClock);

  return (
    <div style={wrap}>
      {/* HUD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Training Draft</div>
          <div style={{ color: C.dim, fontSize: 13 }}>Round {round} · pick {Math.min(currentPickIndex + 1, totalPicks)} of {totalPicks} · {picksRemaining} left</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: C.dim }}>
            {isMyTurn ? 'Your pick' : `${onClockSeat ? seatLabel(onClockSeat) : '—'} is picking…`}
          </div>
          {isMyTurn && (
            <div style={{ fontSize: 26, fontWeight: 800, color: clockColor(pickClock) }}>
              {pickClock != null ? `${pickClock}s` : '—'}
            </div>
          )}
        </div>
      </div>

      {/* Seats / snake HUD */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {seats.map((seat) => (
          <div key={seat.odUserId} style={{
            flex: '1 1 120px', minWidth: 120, background: seat.onClock ? C.panel : C.panelAlt,
            border: `1px solid ${seat.onClock ? C.accent : C.border}`, borderRadius: 10, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: seat.isYou ? C.accent : C.text }}>{seatLabel(seat)}</span>
              <span style={{ fontSize: 12, color: C.dim }}>{seat.picks.length}/3</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {seat.picks.map((s) => (
                <span key={s} style={{ fontSize: 11, color: C.dim, background: C.bg, borderRadius: 5, padding: '2px 6px' }}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#3a1320', border: `1px solid ${C.warn}`, color: '#ffd7de', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Overlay legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: C.dim }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: C.fit, display: 'inline-block' }} />
        Highlights = a strong fit for your agent’s archetype (informational — pick anyone)
      </div>

      {/* Board: sector-grouped, composite-sorted */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {boardBySector.map((group) => (
          <div key={group.sectorName} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {group.sectorName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map((stock) => {
                const isFit = highlightSet.has(stock.symbol);
                const isSel = selected === stock.symbol;
                const pickable = stock.available && isMyTurn && !submitting;
                return (
                  <button
                    key={stock.symbol}
                    disabled={!stock.available}
                    onClick={() => pickable && setSelected(isSel ? null : stock.symbol)}
                    style={{
                      textAlign: 'left',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: !stock.available ? C.taken : (isSel ? C.accent : C.panel),
                      color: !stock.available ? C.dim : (isSel ? '#04121f' : C.text),
                      border: `1px solid ${isFit && stock.available ? C.fit : C.border}`,
                      borderRadius: 8, padding: '8px 10px',
                      opacity: stock.available ? 1 : 0.5,
                      cursor: pickable ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isFit && stock.available && <span style={{ color: isSel ? '#04121f' : C.fit }}>★</span>}
                      <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                    </span>
                    <span style={{ fontSize: 11, color: isSel ? '#04121f' : C.dim }}>
                      {stock.compositeScore != null ? `C ${Math.round(stock.compositeScore)}` : ''}
                      {stock.momentumRank != null ? `  ·  M#${stock.momentumRank}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm bar */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 16, padding: '12px 0',
        background: `linear-gradient(transparent, ${C.bg} 30%)`,
        display: 'flex', justifyContent: 'center', gap: 10,
      }}>
        <button
          disabled={!isMyTurn || !selected || submitting}
          onClick={async () => {
            const ok = await submitPick(selected, false);
            if (ok) setSelected(null);
          }}
          style={{
            background: (!isMyTurn || !selected || submitting) ? C.border : C.accent,
            color: (!isMyTurn || !selected || submitting) ? C.dim : '#04121f',
            border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800,
            cursor: (!isMyTurn || !selected || submitting) ? 'default' : 'pointer',
          }}
        >
          {isMyTurn ? (selected ? `Draft ${selected}` : 'Select a name') : 'Waiting…'}
        </button>
      </div>
    </div>
  );
}
