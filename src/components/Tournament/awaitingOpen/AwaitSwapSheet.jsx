// src/components/Tournament/awaitingOpen/AwaitSwapSheet.jsx
//
// Awaiting-the-Open redesign — the swap sheet (build spec §5). This REPLACES
// the standalone two-dropdown claims panel: the ADD symbol arrives pre-filled
// from the row the user tapped, so the only decision left in the sheet is which
// of their three picks it replaces.
//
// It changes the UI that calls the claim function, never the call:
//   placeClaim({ groupId, dropSymbol, addSymbol })
// — the same signature ClaimFlipWindow.jsx:143 uses, unchanged, and the same
// discipline around it, lifted from the two shipped callers:
//   • never optimistic — a claim lands as `pending` via the claims
//     subscription, never by local state (ClaimFlipWindow.jsx:141)
//   • a synchronous inFlight ref, because a `disabled` prop cannot stop a
//     same-tick double click and two POSTs would follow (:132-134)
//   • errors surfaced through mapTournamentActionError, never swallowed
//   • canSubmit includes the window's open state — the client-side gate the
//     live arena's ClaimSheet already applies (ArenaOverlays.jsx:99), with the
//     server's 403 window_closed remaining the sole authority.
//
// Bottom-nav clearance (spec §4.2): on mobile the sheet is pinned ABOVE the
// fixed 64px nav plus the safe-area inset, so its confirm button is never
// underneath it. It is position:fixed and escapes the host's bounded-height
// desktop scroll frame, which carries no transform/filter/contain.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { placeClaim, mapTournamentActionError } from '../../../services/tournamentActions';
import { actionReducer, initialActionState, isActionPending, ACTION_STATUS } from '../../../utils/tournamentActionMachine';
import { FONT_VARS } from '../../League/draft/draftTokens';
import { alpha, readableOn, WPOD } from './awaitTokens';
import { Mono, TickerPlate, useAwaitPalette, usePrefersReducedMotion } from './awaitPrimitives';

// The fixed bottom nav (Navigation/BottomNav.jsx:53-59) — 64px plus its
// safe-area inset. The sheet clears both.
// 64px + its 1px borderTop (the app ships no box-sizing reset) + the inset.
const NAV_CLEARANCE = 'calc(65px + env(safe-area-inset-bottom, 0px))';

export default function AwaitSwapSheet({
  row,                 // the wire row being claimed: { symbol, sectorName, fit }
  picks = [],          // the user's three picks: [{ symbol, sector, round }]
  groupId,
  open = true,         // whether the claim wire is open (client-side gate)
  windowLine = '',     // the honest window copy, when closed
  capReached = false,
  claimCap = 3,
  pendingCount = 0,
  compact = false,
  onClose,
  onPlaced = null,     // fired after a confirmed server 200
}) {
  const pal = useAwaitPalette();
  const reduced = usePrefersReducedMotion();
  const [drop, setDrop] = useState(null);
  const [state, dispatch] = useReducer(actionReducer, undefined, initialActionState);
  const inFlight = useRef(false);
  const panelRef = useRef(null);

  const symbol = row?.symbol || null;
  const pending = isActionPending(state);

  // A new row resets the choice and any prior error — the sheet never carries a
  // stale selection or a stale failure across tickers.
  useEffect(() => {
    setDrop(null);
    dispatch({ type: 'reset' });
  }, [symbol]);

  // A submit in flight holds the sheet open: closing mid-flight would unmount
  // before the server answers and the rejection would land nowhere, leaving a
  // failed claim with no error, no queued row and no meter change — exactly the
  // swallowed failure this file's contract forbids.
  const requestClose = useCallback(() => {
    if (inFlight.current) return;
    if (onClose) onClose();
  }, [onClose]);

  // Focus moves into the sheet once per ticker — keyed on `symbol`, NOT on the
  // onClose identity, which the parent recreates on every render (its 30s
  // window timer would otherwise yank focus back here every 30 seconds).
  // The element that opened the sheet is remembered and refocused on close, so
  // a keyboard user is returned to where they were rather than to <body>.
  useEffect(() => {
    if (!symbol) return undefined;
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        // The opener may now be disabled (a placed claim greys its row's Claim
        // button); focusing a disabled element is a no-op, not an error.
        opener.focus();
      }
    };
  }, [symbol]);

  // aria-modal="true" promises the rest of the page is inert, so Tab must not
  // walk out of the dialog into the wire behind the scrim or the fixed bottom
  // nav. Cycle within the panel; Escape closes. Both read through a ref so the
  // listener binds once per open rather than on every parent render.
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    if (!symbol) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) { e.preventDefault(); panel.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [symbol]);

  // Lock the page behind the sheet — without this a touch drag on the scrim
  // scrolls the wire underneath on mobile.
  useEffect(() => {
    if (!symbol || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [symbol]);

  const placed = state.status === ACTION_STATUS.CONFIRMED;
  const canSubmit = !!(drop && symbol && groupId && open && !capReached && !pending && !placed);

  const submit = useCallback(async () => {
    // Synchronous guard: `disabled` cannot stop a same-tick double click.
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true;
    dispatch({ type: 'submit' }); // claims are never applied optimistically
    try {
      await placeClaim({ groupId, dropSymbol: drop, addSymbol: symbol });
      // The sheet HOLDS on success rather than closing: closing silently gave
      // the user no confirmation at all, and until the claims snapshot lands
      // the meter still reads the old count and the row still offers a live
      // Claim — so a re-tap would spend a second cap slot on the same name.
      dispatch({ type: 'confirm' });
      if (onPlaced) onPlaced(symbol);
    } catch (err) {
      dispatch({ type: 'reject', error: mapTournamentActionError(err) });
    } finally {
      inFlight.current = false;
    }
  }, [canSubmit, groupId, drop, symbol, onPlaced]);

  const dropPick = useMemo(() => picks.find((p) => p.symbol === drop) || null, [picks, drop]);

  // Only a press that BEGINS on the scrim dismisses it.
  const scrimPress = useRef(false);

  if (!row) return null;

  const confirmLabel = placed
    ? 'CLAIM PLACED'
    : pending
      ? 'Placing…'
      : drop
        ? `${WPOD.place.toUpperCase()} · ${symbol} FOR ${drop}`
        : 'PICK A NAME TO DROP';

  return (
    <div
      onMouseDown={(e) => { scrimPress.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && scrimPress.current) requestClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, display: 'flex',
        alignItems: compact ? 'flex-end' : 'center', justifyContent: 'center',
        padding: compact ? 0 : 20, paddingBottom: compact ? NAV_CLEARANCE : 20,
        background: alpha(pal.bg, 0.72),
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', ...FONT_VARS,
        animation: reduced ? 'none' : 'awOpenDim .18s ease-out both',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Claim ${symbol}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: compact ? 'none' : 560, maxHeight: '100%', overflowY: 'auto',
          borderRadius: compact ? '20px 20px 0 0' : 20,
          padding: compact ? '16px 15px 20px' : '20px 22px', outline: 'none', boxSizing: 'border-box',
          background: `linear-gradient(172deg, ${alpha(pal.teal, 0.09)}, ${alpha(pal.bg, 0.6)} 46%), ${pal.surface}`,
          border: `1px solid ${alpha(pal.teal, 0.28)}`,
          boxShadow: `0 -30px 80px -30px ${alpha(pal.bg, 0.9)}, inset 0 1px 0 ${alpha(pal.white, 0.07)}`,
          animation: reduced ? 'none' : 'awOpenSheet .24s cubic-bezier(.2,.8,.25,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <TickerPlate symbol={symbol} sector={row.sectorName} size="lg" />
          <div style={{ minWidth: 0 }}>
            {Number.isFinite(row.fit) && (
              <Mono style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.2em', color: pal.ink3 }}>FIT {row.fit}</Mono>
            )}
            <div style={{ fontSize: 11.5, color: pal.ink2, marginTop: 3 }}>{row.sectorName}</div>
          </div>
          <button
            type="button" className="aw-btn" onClick={requestClose} aria-label="Close" disabled={pending}
            style={{
              marginLeft: 'auto', background: alpha(pal.white, 0.05), border: `1px solid ${pal.hair2}`,
              borderRadius: 9, padding: 7, lineHeight: 0, cursor: 'pointer',
            }}
          >
            <X size={13} color={pal.ink2} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{ fontSize: compact ? 12.5 : 13.5, color: pal.ink, fontWeight: 600, marginBottom: 4 }}>
          Which pick does {symbol} replace?
        </div>
        <p style={{ margin: '0 0 13px', fontSize: compact ? 11 : 11.5, color: pal.ink2, lineHeight: 1.5 }}>
          {WPOD.note}
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0,1fr))',
          gap: 8, marginBottom: 14,
        }}>
          {picks.map((p) => {
            const on = drop === p.symbol;
            return (
              <button
                key={p.symbol}
                type="button"
                className="aw-pick"
                onClick={() => setDrop(p.symbol)}
                aria-pressed={on}
                disabled={pending}
                style={{
                  font: 'inherit', textAlign: 'left', padding: '10px 11px', borderRadius: 12, cursor: 'pointer',
                  background: on ? alpha(pal.you, 0.14) : alpha(pal.white, 0.025),
                  border: `1px solid ${on ? alpha(pal.you, 0.5) : pal.hair}`,
                  boxShadow: on ? `0 0 28px -14px ${alpha(pal.you, 1)}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: pal.ink3 }}>{p.round}</Mono>
                  {on && <Check size={12} color={pal.you} strokeWidth={2.6} />}
                </div>
                <div style={{ marginTop: 7 }}>
                  <TickerPlate symbol={p.symbol} sector={p.sector} size="sm" />
                </div>
                <div style={{ fontSize: 10, color: pal.ink3, marginTop: 6 }}>{p.sector}</div>
              </button>
            );
          })}
        </div>

        {/* Honest gates, in the order the server would reject them. */}
        {!open && windowLine && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10,
            background: alpha(pal.gold, 0.08), border: `1px solid ${alpha(pal.gold, 0.28)}`, marginBottom: 10,
          }}>
            <AlertCircle size={13} color={pal.gold} />
            <span style={{ fontSize: 11.5, color: pal.ink2, lineHeight: 1.4 }}>{windowLine}</span>
          </div>
        )}
        {capReached && (
          <div style={{ fontSize: 11, color: pal.gold, marginBottom: 10, lineHeight: 1.45 }}>
            You have {claimCap} pending claims — wait for tonight’s processing before lining up another.
          </div>
        )}

        <button
          type="button"
          className="aw-btn"
          disabled={!canSubmit}
          onClick={submit}
          style={{
            font: 'inherit', width: '100%', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': '11.5px', fontWeight: 700,
            letterSpacing: '0.1em', padding: '13px 16px', borderRadius: 12,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            color: canSubmit ? readableOn(pal.teal) : pal.ink3,
            background: canSubmit ? `linear-gradient(180deg, ${alpha(pal.teal, 0.85)}, ${pal.teal})` : alpha(pal.white, 0.04),
            border: `1px solid ${canSubmit ? alpha(pal.teal, 0.6) : pal.hair2}`,
            boxShadow: canSubmit ? `0 0 32px -12px ${alpha(pal.teal, 0.95)}` : 'none',
          }}
        >
          {confirmLabel}
        </button>

        {placed && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <Check size={13} color={pal.teal} strokeWidth={2.6} />
            <span style={{ fontSize: 11.5, color: pal.teal, lineHeight: 1.4 }}>
              Claim placed — it resolves at the 9:24 AM ET processing pass.
            </span>
          </div>
        )}

        {state.error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <AlertCircle size={13} color={pal.copper} />
            <span style={{ fontSize: 11.5, color: pal.copper, lineHeight: 1.4 }}>{state.error}</span>
          </div>
        )}

        {placed && (
          <button
            type="button" className="aw-btn" onClick={requestClose}
            style={{
              font: 'inherit', width: '100%', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': '11px',
              fontWeight: 700, letterSpacing: '0.1em', padding: '11px 16px', borderRadius: 11,
              marginTop: 10, cursor: 'pointer', color: pal.ink2,
              background: alpha(pal.white, 0.04), border: `1px solid ${pal.hair2}`,
            }}
          >
            DONE
          </button>
        )}

        {/* The count, not the flip copy: "Flips open when the battle starts" is a
            FLIP-mechanic string, and under a disabled claim button it reads as
            the reason claiming is unavailable, which is false. */}
        <Mono style={{
          display: 'block', textAlign: 'center', fontSize: 9.5, color: pal.ink3,
          letterSpacing: '0.06em', marginTop: 9,
        }}>
          {dropPick
            ? `${symbol} REPLACES ${dropPick.symbol} · ${pendingCount}/${claimCap} PENDING`
            : `${pendingCount}/${claimCap} PENDING`}
        </Mono>
      </div>
    </div>
  );
}
