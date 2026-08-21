// src/components/Tournament/awaitingOpen/AwaitWire.jsx
//
// Awaiting-the-Open redesign — the waiver-wire panel (build spec §4.1 item 5,
// §5, §6.1). Full width, rows two-up on desktop, claims state inline in the
// head. Every row carries its own Claim, which opens the swap sheet pre-filled
// with that ticker — this is what replaces the standalone two-dropdown panel.
//
// LOCKED STATE (§6.1) — a HINT, never a gate (founder ruling):
//   • When the wire looks shut the Claim button takes the locked treatment —
//     dimmed, lock glyph, LOCKED label, reopen time legible in the head. Users
//     should not see a live button on a wire that looks closed.
//   • But the button still OPENS, and the sheet still SUBMITS. The window
//     mirror is a client clock; a device running twenty minutes slow would
//     otherwise silently block a claim the server would accept, costing the
//     user a move they were entitled to. ClaimFlipWindow.jsx:6-14 states the
//     invariant — "NEVER gate a submit on the WINDOW mirror" — and it governs
//     here. (The live arena's ClaimSheet does gate on claim.open; that is prior
//     art carrying the same defect, not a licence to repeat it.)
//   • The genuine client-side blocks stay: a duplicate pending claim, the
//     3-pending cap, and having no picks to drop. Those derive from the
//     authoritative claims subscription and the roster, not from a clock.
//   • Rows stay fully readable and every ticker stays tappable for research.
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
import { Search, Gavel, Lock, Check, Clock, ListFilter } from 'lucide-react';
import { alpha, WPOD } from './awaitTokens';
import { Mono, WSurf, BandHead, WChip, ClaimsMeter, useAwaitPalette } from './awaitPrimitives';
import AwaitWireRow from './AwaitWireRow';

/** The wire's per-row action: place a claim. `locked` dims but never blocks —
 *  the window mirror is a hint, the server is the gate (see the header). */
function claimAction({ stock, queued, locked, capReached, hasPicks, onClaim }) {
  const disabled = queued || capReached || !hasPicks;
  const [title, label] = queued
    ? [`A claim for ${stock.symbol} is already pending`, 'QUEUED']
    : capReached
      ? ['You have the maximum pending claims — wait for tonight’s processing', 'CAP FULL']
      : !hasPicks
        ? ['You have no picks to drop for a claim', 'NO PICKS']
        : locked
          ? [`Claim ${stock.symbol} — the wire looks closed, but you can still place it; the server decides`, 'LOCKED']
          : [`Claim ${stock.symbol}`, 'Claim'];
  return {
    label,
    title,
    icon: queued ? Clock : (disabled || locked) ? Lock : Gavel,
    disabled,
    tone: queued ? 'on' : (disabled || locked) ? 'dim' : 'live',
    onAction: onClaim,
  };
}

/**
 * The caller's own claims, every status — the ledger the classic body gets from
 * ClaimFlipWindow (:200-211). Without it a claim's DROP side is invisible (so
 * two claims can silently stake the same pick) and an approved or denied claim
 * — with its denialReason — is surfaced nowhere once the processing pass runs.
 * Self-scoped: the caller's claims only, never another seat's.
 */
function ClaimsLedger({ claims, compact, pal }) {
  if (!claims || !claims.length) return null;
  const statusColor = { pending: pal.gold, approved: pal.teal, denied: pal.copper };
  return (
    <div style={{
      marginTop: 12, paddingTop: 11, borderTop: `1px solid ${pal.hair}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', color: pal.ink3 }}>
        YOUR CLAIMS
      </Mono>
      {claims.map((c) => (
        <div key={c.id || `${c.dropSymbol}-${c.addSymbol}`} style={{
          display: 'flex', alignItems: 'baseline', gap: 8, fontSize: compact ? 11 : 11.5,
        }}>
          <Mono style={{ flex: 1, minWidth: 0, color: pal.ink2 }}>
            {c.dropSymbol} → {c.addSymbol}
          </Mono>
          <Mono style={{
            fontWeight: 700, fontSize: 10, textTransform: 'uppercase', textAlign: 'right',
            color: statusColor[c.status] || pal.ink3,
          }}>
            {c.status}{c.status === 'denied' && c.denialReason ? ` · ${c.denialReason}` : ''}
          </Mono>
        </div>
      ))}
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
  claims = null,
  poolCount = 0,      // every claimable name, not just the wire's twelve
  beyondWire = 0,     // claimable names the wire does NOT show
  onClaim,
  onBrowse = null,    // open the free-agent browser (§7.0)
  onResearch,
  compact = false,
}) {
  const pal = useAwaitPalette();
  const empty = !board.length;

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
      {board.map((stock, i) => {
        const queued = pendingSymbols ? pendingSymbols.has(stock.symbol) : false;
        const lead = i === 0 && !queued;
        return (
          <AwaitWireRow
            key={stock.symbol}
            stock={stock}
            highlight={lead}
            queued={queued}
            badge={lead
              ? <WChip icon={<Check size={11} color={pal.teal} strokeWidth={2.4} />} color={pal.teal} solid>TOP FIT</WChip>
              : queued
                ? <WChip icon={<Clock size={11} color={pal.teal} strokeWidth={2.4} />} color={pal.teal} solid>QUEUED</WChip>
                : null}
            action={claimAction({ stock, queued, locked, capReached, hasPicks, onClaim })}
            onResearch={onResearch}
            compact={compact}
          />
        );
      })}
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

      {empty ? (
        <div style={{
          padding: '14px 12px', borderRadius: 12, textAlign: 'center',
          background: alpha(pal.white, 0.014), border: `1px dashed ${pal.hair2}`,
        }}>
          <Mono style={{ fontSize: 10.5, color: pal.ink3, letterSpacing: '0.06em' }}>
            NO FREE AGENTS AVAILABLE RIGHT NOW
          </Mono>
        </div>
      ) : rows}

      {/* Shown whenever a claimable name sits past the wire. Comparing the
          claim-filtered pool count against the raw slice length would hide the
          button exactly when pending claims shrink the count below twelve —
          re-opening the unreachable-name regression this closes. */}
      {onBrowse && beyondWire > 0 && (
        <button
          type="button"
          className="aw-btn"
          onClick={onBrowse}
          title={`Browse and search all ${poolCount} claimable free agents`}
          aria-label={`Claim a different name — browse and search all ${poolCount} claimable free agents`}
          style={{
            font: 'inherit', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': compact ? '10px' : '10.5px',
            fontWeight: 700, letterSpacing: '0.1em', width: '100%', marginTop: compact ? 8 : 9,
            padding: compact ? '11px 12px' : '11px 14px', borderRadius: 12, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: pal.gold, background: alpha(pal.gold, 0.08),
            border: `1px dashed ${alpha(pal.gold, 0.38)}`,
          }}
        >
          <ListFilter size={12} color={pal.gold} strokeWidth={2.2} />
          CLAIM A DIFFERENT NAME · {poolCount} AVAILABLE
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <Mono style={{ fontSize: 9.5, color: pal.ink3, letterSpacing: '0.06em', marginLeft: 'auto' }}>
          {WPOD.flips.toUpperCase()}
        </Mono>
      </div>

      <p style={{ margin: '9px 0 0', fontSize: 11, color: pal.ink3, lineHeight: 1.5, maxWidth: 900 }}>
        {WPOD.note}
      </p>

      <ClaimsLedger claims={claims} compact={compact} pal={pal} />
    </WSurf>
  );
}
