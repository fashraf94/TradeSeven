// src/components/Tournament/awaitingOpen/AwaitWire.jsx
//
// Awaiting-the-Open redesign — the waiver-wire panel (build spec §4.1 item 5,
// §5, §6.1). Full width, rows two-up on desktop, claims state inline in the
// head. Every row carries its own Claim, which opens the swap sheet pre-filled
// with that ticker — this is what replaces the standalone two-dropdown panel.
//
// LOCKED STATE (§6.1) — a genuine treatment, not a hidden button:
//   • Claim buttons disable with a visible lock affordance and a title that
//     names the reason, gated on the live getClaimWindowDisplay() mirror.
//   • The reopen time is legible in the head (and repeated in the sheet).
//   • Rows stay fully readable and every ticker stays tappable for research —
//     only CLAIMING is gated. The lock is client-side UX; the server's 403
//     window_closed remains the sole authority on any submit.
//
// QUEUED ROWS: a name with a pending claim shows a non-interactive QUEUED
// state. The build spec asked for an undo affordance here, but the tournament
// claim API has no cancel/withdraw path — placeClaim is the only claim mutation
// (tournamentActions.js:44-49), and the cancelClaim that exists belongs to the
// separate BaggerBomb free-agency service (claimFreeAgencyService.js:319), a
// different subsystem keyed by draftId/claimId. A local "undo" would clear the
// row while the real claim still processed overnight, so it is deliberately not
// built (§8: report a missing field rather than fake it). This matches today's
// behaviour — FreeAgentsList.jsx:74-84 already renders a disabled Pending pill.
//
// Mobile renders ALL rows (the §6.2 five-row cap + expander was withdrawn:
// twelve is a small fixed number, so the expander was friction without benefit).

import React from 'react';
import { Search, Gavel, Lock, Check, Clock } from 'lucide-react';
import { alpha, WPOD } from './awaitTokens';
import {
  Mono, WSurf, BandHead, WChip, TickerPlate, TickRail, ClaimsMeter, useAwaitPalette,
} from './awaitPrimitives';

/** Fit readout — the mono headline number over its own ticked rail. Both come
 *  from the single `fit` value, so the bar can never disagree with the number. */
function FitScore({ fit, lead, compact, pal }) {
  const c = lead ? pal.teal : pal.ink;
  const v = Number.isFinite(fit) ? Math.round(fit) : null;
  return (
    <div style={{ width: compact ? 46 : 56, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <Mono style={{
          fontSize: compact ? 24 : 27, fontWeight: 700, lineHeight: 1, color: c, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          textShadow: lead ? `0 0 20px ${alpha(pal.teal, 0.5)}` : 'none',
        }}>
          {v == null ? '—' : v}
        </Mono>
        <Mono style={{ fontSize: 8.5, fontWeight: 700, color: pal.ink3, letterSpacing: '0.1em' }}>FIT</Mono>
      </div>
      <div style={{ marginTop: 7 }}>
        <TickRail pct={v || 0} ticks={6} h={5} color={lead ? pal.teal : alpha(pal.teal, 0.75)} />
      </div>
    </div>
  );
}

/** MOM / 1W / VOL — the same three signals the classic list shows. */
function StatStrip({ stock, compact, pal }) {
  const cell = (k, v, c) => (
    <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <Mono style={{ fontSize: compact ? 8.5 : 9, fontWeight: 600, color: pal.ink3, letterSpacing: '0.12em' }}>{k}</Mono>
      <Mono style={{ fontSize: compact ? 10.5 : 11, fontWeight: 700, color: c || pal.ink2 }}>{v}</Mono>
    </span>
  );
  const w = stock.return1W;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? 11 : 14, flexWrap: 'wrap' }}>
      {cell('MOM', stock.momentumRank != null ? `#${stock.momentumRank}` : '—')}
      {cell('1W', w == null ? '—' : `${w >= 0 ? '+' : ''}${w.toFixed(1)}%`, w == null ? null : (w >= 0 ? pal.teal : pal.copper))}
      {cell('VOL', stock.volTxt || '—')}
    </div>
  );
}

function WireRow({ stock, rank, queued, locked, capReached, hasPicks, onClaim, onResearch, compact, pal }) {
  const lead = rank === 1 && !queued;
  const disabled = queued || locked || capReached || !hasPicks;

  const claimTitle = queued
    ? `A claim for ${stock.symbol} is already pending`
    : locked
      ? 'The claim wire is closed right now'
      : capReached
        ? 'You have the maximum pending claims — wait for tonight’s processing'
        : !hasPicks
          ? 'You have no picks to drop for a claim'
          : `Claim ${stock.symbol}`;

  const claimColor = queued ? pal.teal : disabled ? pal.ink3 : pal.teal;

  return (
    <div className={disabled ? undefined : 'aw-row'} style={{
      display: 'flex', alignItems: 'center', gap: compact ? 11 : 14,
      padding: compact ? '10px 12px' : '11px 14px', borderRadius: 14, minWidth: 0,
      background: queued ? alpha(pal.teal, 0.075) : lead ? alpha(pal.white, 0.028) : alpha(pal.white, 0.014),
      border: `1px solid ${queued ? alpha(pal.teal, 0.34) : lead ? alpha(pal.teal, 0.18) : pal.hair}`,
    }}>
      <FitScore fit={stock.fit} lead={lead} compact={compact} pal={pal} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* research stays live even when the wire is locked (§6.1) */}
          <TickerPlate symbol={stock.symbol} sector={stock.sectorName} size="md" onResearch={onResearch} />
          {lead && <WChip icon={<Check size={11} color={pal.teal} strokeWidth={2.4} />} color={pal.teal} solid>TOP FIT</WChip>}
          {queued && <WChip icon={<Clock size={11} color={pal.teal} strokeWidth={2.4} />} color={pal.teal} solid>QUEUED</WChip>}
        </div>
        {stock.reason && (
          <div style={{ fontSize: compact ? 11 : 11.5, color: pal.ink2, margin: '6px 0 5px', lineHeight: 1.35 }}>
            {stock.reason}
          </div>
        )}
        <StatStrip stock={stock} compact={compact} pal={pal} />
      </div>

      <button
        type="button"
        className="aw-btn"
        onClick={() => !disabled && onClaim(stock)}
        disabled={disabled}
        title={claimTitle}
        aria-label={claimTitle}
        style={{
          font: 'inherit', fontFamily: 'var(--ld-mono)', fontSize: compact ? 10 : 10.5, fontWeight: 700,
          letterSpacing: '0.1em', padding: compact ? '9px 12px' : '10px 15px', borderRadius: 10,
          whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: claimColor,
          background: queued ? alpha(pal.teal, 0.1) : disabled ? alpha(pal.white, 0.03) : alpha(pal.teal, 0.1),
          border: `1px solid ${queued ? alpha(pal.teal, 0.34) : disabled ? pal.hair2 : alpha(pal.teal, 0.45)}`,
          boxShadow: disabled ? 'none' : `0 0 24px -14px ${alpha(pal.teal, 1)}`,
        }}
      >
        {queued
          ? <><Clock size={12} color={claimColor} strokeWidth={2.2} /> QUEUED</>
          : locked || !hasPicks
            ? <><Lock size={12} color={claimColor} strokeWidth={2.2} /> LOCKED</>
            : <><Gavel size={12} color={claimColor} strokeWidth={2.2} /> Claim</>}
      </button>
    </div>
  );
}

export default function AwaitWire({
  board = [],
  pendingSymbols = null,
  pendingCount = 0,
  claimCap = 3,
  windowLine = '',
  wireOpen = false,
  hasPicks = true,
  onClaim,
  onResearch,
  compact = false,
}) {
  const pal = useAwaitPalette();
  if (!board.length) return null;

  const capReached = pendingCount >= claimCap;
  const locked = !wireOpen;

  const windowChip = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      {locked
        ? <Lock size={11} color={pal.gold} strokeWidth={2.1} />
        : <Clock size={11} color={pal.teal} strokeWidth={2.1} />}
      <span style={{ fontSize: 11.5, color: pal.ink2, lineHeight: 1.35 }}>{windowLine}</span>
    </span>
  );

  const rows = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0,1fr))',
      gap: compact ? 7 : 8,
    }}>
      {board.map((stock, i) => (
        <WireRow
          key={stock.symbol}
          stock={stock}
          rank={i + 1}
          queued={pendingSymbols ? pendingSymbols.has(stock.symbol) : false}
          locked={locked}
          capReached={capReached}
          hasPicks={hasPicks}
          onClaim={onClaim}
          onResearch={onResearch}
          compact={compact}
          pal={pal}
        />
      ))}
    </div>
  );

  return (
    <WSurf pad={compact ? 14 : 16}>
      <BandHead
        compact={compact}
        icon={<Search size={compact ? 13 : 15} color={pal.gold} strokeWidth={2.1} />}
        color={pal.gold}
        eyebrow={WPOD.wire.eyebrow}
        title={WPOD.wire.title}
        sub={WPOD.wire.sub}
        right={<ClaimsMeter used={pendingCount} max={claimCap} compact={compact} />}
      />

      {/* the window line — the reopen time is legible whether open or locked */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10,
        background: locked ? alpha(pal.gold, 0.07) : alpha(pal.teal, 0.07),
        border: `1px solid ${locked ? alpha(pal.gold, 0.26) : alpha(pal.teal, 0.26)}`,
        marginBottom: 11,
      }}>
        {windowChip}
      </div>

      {capReached && (
        <div style={{ fontSize: 11, color: pal.gold, marginBottom: 10, lineHeight: 1.45 }}>
          You have {claimCap} pending claims — wait for tonight’s processing before lining up another.
        </div>
      )}

      {rows}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <Mono style={{ fontSize: 9.5, color: pal.ink3, letterSpacing: '0.06em', marginLeft: 'auto' }}>
          {WPOD.flips.toUpperCase()}
        </Mono>
      </div>

      <p style={{ margin: '9px 0 0', fontSize: 11, color: pal.ink3, lineHeight: 1.5, maxWidth: 900 }}>
        {WPOD.note}
      </p>
    </WSurf>
  );
}
