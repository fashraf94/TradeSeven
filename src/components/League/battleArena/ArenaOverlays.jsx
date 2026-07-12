// src/components/League/battleArena/ArenaOverlays.jsx
//
// League Battle View V2 — the arena's modal overlays:
//   • FreeAgencyDoorway — the "Claim a name" doorway. Per Phase-0 Gate 4, claiming
//     happens on its OWN surface (you pick up a free agent AND choose which pick to
//     drop there); the battle view is only the doorway. In this preview the CTA is
//     inert (the real nav lands with the live-wiring phase).
//   • OpponentSnapshot — tap a rival on the climb: a WHAT-only, SEALED snapshot.
//     Their book + reasoning stay sealed until the battle completes (the Film
//     Room). The full ticker book renders with the Film Room phase.
//   • FilmRoomOverlay — the complete-state "break the seal" entry. A faithful
//     placeholder here; the dossier room is a later phase.
//
// Translated from the locked Claude Design (battle-arena-desktop / battle-kit).

import React from 'react';
import { Mono, Eyebrow, LIcon, Icon } from '../LeagueParts';
import { LTOKENS, alpha, MONO } from '../leagueTokens';
import { fmtPoints } from '../../../utils/leagueFormat';
import { ArenaCount } from './ArenaPrimitives';
import { OWN_AGENT, OWN_YOU, ST_GOOD, ST_BAD } from './arenaTheme';
import { prefersReducedMotion } from './arenaEngineCore';

// a centred modal frame with a dimmed, click-to-close backdrop. `maxWidth`
// (mobile) caps the fixed `width` to the viewport; default undefined → desktop
// byte-identical (the literal `width` stands alone, as before). `fixed` (mobile)
// pins to the VIEWPORT instead of the arena box — on the mobile arena the root is a
// tall page-scrolling container, so an `absolute; inset:0` modal would center on the
// full scroll height (off-screen); default 'absolute' → desktop byte-identical.
export function AFocus({ children, onClose, width = 440, maxWidth, fixed = false }) {
  return (
    <div style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bv2-tap bv2-fadein" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.74)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div className="bv2-scroll" style={{ position: 'relative', width, maxWidth, maxHeight: '86%', overflowY: 'auto', borderRadius: 22, padding: '20px 22px',
        background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair2}`, boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
        <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', position: 'absolute', top: 16, right: 16, cursor: 'pointer', width: 28, height: 28, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
          <Icon name="x" size={15} color={LTOKENS.ink2} />
        </button>
        {children}
      </div>
    </div>
  );
}

// The "Claim a name" doorway. With real claim props it IS the claim SHEET (drop one
// of your three + add a free agent → placeClaim), per the founder ruling (a
// modal/sheet, not a separate page). Without them (the ?battleViewV2=1 preview) it
// keeps the inert doorway copy. The claim controls re-implement ClaimFlipWindow's
// ClaimsTab DISCIPLINE (canonical pool-minus-held — already enforced in the bridge;
// in-flight guard; never-optimistic; server-authoritative error) in the League
// palette — ClaimFlipWindow.jsx is NOT imported/edited.
export function FreeAgencyDoorway({ onClose, claim = null, onClaim = null, maxWidth, fixed = false }) {
  const c = OWN_AGENT;
  const real = !!(claim && onClaim);
  return (
    <div style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, zIndex: 82, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bv2-tap bv2-fadein" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.78)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} />
      <div className={prefersReducedMotion() ? '' : 'bv2-rise'} style={{ position: 'relative', width: 460, maxWidth, borderRadius: 22, padding: '26px 26px 24px',
        background: `linear-gradient(160deg, ${alpha(c, 0.12)}, ${LTOKENS.bg} 62%)`, border: `1px solid ${alpha(c, 0.34)}`, boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
        {real ? (
          <ClaimSheet claim={claim} onClaim={onClaim} onClose={onClose} c={c} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.14), border: `1px solid ${alpha(c, 0.4)}` }}>
              <LIcon name="arrowUpRight" size={26} color={c} stroke={2} />
            </div>
            <Eyebrow color={c}>Leaving the battle · Free Agency</Eyebrow>
            <div style={{ fontSize: 21, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 8 }}>Open the Free Agency board</div>
            <div style={{ fontSize: 13, color: LTOKENS.ink2, lineHeight: 1.6, marginTop: 10 }}>
              Claiming happens on its own surface. There you pick up a free-agent name <b style={{ color: LTOKENS.ink }}>and</b> choose which of your three to drop — a claim is one move, finalized there. The battle view is only the doorway.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', flex: 1, textAlign: 'center', cursor: 'pointer', padding: '11px', borderRadius: 11,
                background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2, fontWeight: 600, fontSize: 12.5 }}>Stay in the battle</button>
              <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', flex: 1.4, textAlign: 'center', cursor: 'pointer', padding: '11px', borderRadius: 11,
                background: c, color: LTOKENS.bg, fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                Go to Free Agency <LIcon name="arrowUpRight" size={13} color={LTOKENS.bg} stroke={2.4} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimSheet({ claim, onClaim, onClose, c }) {
  const [dropSymbol, setDrop] = React.useState('');
  const [addSymbol, setAdd] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const inFlight = React.useRef(false);
  const picks = claim.picks || [];
  const pool = claim.poolNames || [];
  const capReached = (claim.claimsUsed ?? 0) >= (claim.claimsTotal ?? 3);
  const canSubmit = dropSymbol && addSymbol && claim.open && !capReached && !submitting;

  const submit = async () => {
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true; setSubmitting(true); setError(null);
    try {
      await onClaim({ dropSymbol, addSymbol }); // → placeClaim; lands as 'pending' (never optimistic)
      setDone(true); setDrop(''); setAdd('');
    } catch (err) {
      setError(err?.message || 'Claim failed — try again.'); // already-mapped by useArenaModel
    } finally {
      inFlight.current = false; setSubmitting(false);
    }
  };

  const sel = { fontFamily: MONO, flex: 1, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, borderRadius: 9, color: LTOKENS.ink, padding: '9px 10px', fontSize: 13 };
  return (
    <div>
      <Eyebrow color={c}>Claim a name · Free Agency</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 7 }}>Drop one, claim one</div>
      <div style={{ fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.5, marginTop: 8 }}>
        A claim is one move — drop a pick and claim a free-agent name. It resolves at the next processing pass; the dropped name keeps its banked points.
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
        <select style={sel} value={dropSymbol} onChange={(e) => { setDrop(e.target.value); setDone(false); setError(null); }} disabled={!claim.open || submitting}>
          <option value="">Drop a pick…</option>
          {picks.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
        </select>
        <select style={sel} value={addSymbol} onChange={(e) => { setAdd(e.target.value); setDone(false); setError(null); }} disabled={!claim.open || submitting || pool.length === 0}>
          <option value="">Claim a name…</option>
          {pool.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {claim.open && pool.length === 0 && (
        <Mono style={{ display: 'block', marginTop: 9, fontSize: 10.5, color: LTOKENS.ink3 }}>No free agents available to claim right now.</Mono>
      )}
      <button className="bv2-tap" onClick={submit} disabled={!canSubmit}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', textAlign: 'center', marginTop: 12, padding: '11px', borderRadius: 11,
          cursor: canSubmit ? 'pointer' : 'not-allowed', background: canSubmit ? c : LTOKENS.surface, border: canSubmit ? 'none' : `1px solid ${LTOKENS.hair}`,
          color: canSubmit ? LTOKENS.bg : LTOKENS.ink3, fontWeight: 800, fontSize: 13 }}>
        {submitting ? 'Placing…' : `Place claim · ${claim.claimsUsed ?? 0}/${claim.claimsTotal ?? 3} pending`}
      </button>
      {!claim.open && <Mono style={{ display: 'block', marginTop: 9, fontSize: 10.5, color: LTOKENS.ink3 }}>The claim wire is closed — it reopens at the next market open.</Mono>}
      {capReached && <Mono style={{ display: 'block', marginTop: 9, fontSize: 10.5, color: LTOKENS.gold }}>You have {claim.claimsTotal ?? 3} pending claims — wait for tonight&rsquo;s processing.</Mono>}
      {error && <Mono style={{ display: 'block', marginTop: 9, fontSize: 10.5, color: '#F2766B' }}>{error}</Mono>}
      {done && <Mono style={{ display: 'block', marginTop: 9, fontSize: 10.5, color: LTOKENS.teal }}>Claim placed — it resolves at the next processing pass.</Mono>}
      <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', display: 'block', width: '100%', textAlign: 'center', marginTop: 14, cursor: 'pointer',
        color: LTOKENS.ink3, fontFamily: MONO, fontSize: 11 }}>Back to the battle</button>
    </div>
  );
}

export function OpponentSnapshot({ seat, composite, onClose, maxWidth, fixed = false }) {
  return (
    <AFocus onClose={onClose} maxWidth={maxWidth} fixed={fixed}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 38% 32%, ${alpha(seat.color, 0.95)}, ${alpha(seat.color, 0.28)} 68%, ${alpha(seat.color, 0.1)})`,
          border: `1.5px solid ${alpha(seat.color, 0.7)}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: LTOKENS.ink }}>{seat.name}</div>
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>
            {[seat.arch, seat.kind === 'cpu' ? 'CPU agent' : seat.owner].filter(Boolean).join(' · ')}
          </Mono>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ArenaCount value={composite} size={20} showSign={false} />
          <Mono style={{ fontSize: 8, color: LTOKENS.ink3, display: 'block', marginTop: 2, letterSpacing: '0.1em' }}>COMPOSITE</Mono>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 14px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <Icon name="lock" size={15} color={LTOKENS.ink3} style={{ marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
          A sealed snapshot — <b style={{ color: LTOKENS.ink }}>what</b> {seat.name} is climbing, not why. Their six-stock book, their three picks, their points and their agent&rsquo;s reasoning stay <b style={{ color: LTOKENS.ink }}>sealed until the battle completes</b> — then the Film Room opens.
        </div>
      </div>
    </AFocus>
  );
}

// The DEPARTED-POINTS ledger — the item breakdown behind a DepartedChip. A
// SETTLED, past-tense list of banked points that have left the live star grid
// but the banked close still counts:
//   • kind 'swap' — the agent's subbed-out positions (symbolOut → symbolIn, each
//     with its locked exit points).
//   • kind 'drop' — your dropped picks (each with its banked points). A SAME-DAY
//     drop's final leg banks post-close, so it shows as "banks at close" with NO
//     number (honest absence, never a fake 0) — bounded to the drop day.
// Display-only; every number here is already earned. Reuses the AFocus modal.
export function DepartedLedger({ kind, departed, onClose, maxWidth, fixed = false }) {
  const isSwap = kind === 'swap';
  const c = isSwap ? OWN_AGENT : OWN_YOU;
  const items = departed?.items || [];
  const total = departed?.total || 0;
  const pendingCount = departed?.pendingCount || 0;
  const tintOf = (v) => (v > 0 ? ST_GOOD : v < 0 ? ST_BAD : LTOKENS.ink2);
  const rowBase = { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 10,
    background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
  return (
    <AFocus onClose={onClose} width={400} maxWidth={maxWidth} fixed={fixed}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: alpha(c, 0.12), border: `1px solid ${alpha(c, 0.34)}` }}>
          <LIcon name={isSwap ? 'scissors' : 'flag'} size={19} color={c} stroke={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow color={c}>{isSwap ? 'Banked from swaps' : 'Dropped picks · banked'}</Eyebrow>
          <div style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 3 }}>
            {isSwap ? 'Positions your agent subbed out' : 'Picks you dropped'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ArenaCount value={total} size={20} showSign />
          <Mono style={{ fontSize: 8, color: LTOKENS.ink3, display: 'block', marginTop: 2, letterSpacing: '0.1em' }}>BANKED</Mono>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
        These points are <b style={{ color: LTOKENS.ink }}>earned and no longer moving</b> — settled into your standing.{' '}
        {isSwap
          ? 'Each swap locked its exit when the agent subbed the name out.'
          : 'A dropped pick keeps its banked points — the standing never forgets them.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((it, i) => {
          if (isSwap) {
            return (
              <div key={`${it.out}-${it.in}-${i}`} style={rowBase}>
                <LIcon name="scissors" size={13} color={LTOKENS.ink3} stroke={2} />
                <Mono style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: LTOKENS.ink2 }}>
                  <span style={{ color: LTOKENS.ink3, textDecoration: 'line-through' }}>{it.out ?? '—'}</span>
                  <span style={{ color: c, margin: '0 6px' }}>→</span>
                  <span style={{ color: LTOKENS.ink }}>{it.in ?? '—'}</span>
                </Mono>
                <Mono style={{ fontSize: 12.5, fontWeight: 800, color: alpha(tintOf(it.pts), 0.95), fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(it.pts)}</Mono>
              </div>
            );
          }
          // drop row — a same-day pending leg shows honest absence, not a 0
          return (
            <div key={`${it.tk}-${i}`} style={{ ...rowBase, opacity: it.pending ? 0.72 : 1 }}>
              <Mono style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>{it.tk ?? '—'}</Mono>
              {it.pending ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="clock" size={11} color={LTOKENS.ink3} stroke={2.2} />
                  <Mono style={{ fontSize: 9.5, fontWeight: 700, color: LTOKENS.ink3, letterSpacing: '0.02em' }}>banks at close</Mono>
                  <Mono style={{ fontSize: 12.5, fontWeight: 800, color: LTOKENS.ink3 }}>—</Mono>
                </span>
              ) : (
                <Mono style={{ fontSize: 12.5, fontWeight: 800, color: alpha(tintOf(it.banked), 0.95), fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(it.banked)}</Mono>
              )}
            </div>
          );
        })}
      </div>

      {pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: alpha(LTOKENS.ink3, 0.08), border: `1px solid ${LTOKENS.hair2}` }}>
          <Icon name="clock" size={13} color={LTOKENS.ink3} style={{ marginTop: 1 }} />
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
            {pendingCount} pick{pendingCount === 1 ? '' : 's'} dropped today {pendingCount === 1 ? 'banks' : 'bank'} at tonight&rsquo;s close — its exit isn&rsquo;t settled yet, so it counts then, not now.
          </Mono>
        </div>
      )}
    </AFocus>
  );
}

export function FilmRoomOverlay({ onClose, fixed = false }) {
  return (
    <div style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(8,9,13,0.9)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} className="bv2-fadein">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 26px', flexShrink: 0 }}>
        <LIcon name="crown" size={22} color={LTOKENS.gold} stroke={2} />
        <div>
          <Eyebrow color={LTOKENS.gold}>The Film Room</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 2 }}>Everything sealed, now open</div>
        </div>
        <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', marginLeft: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 14px', borderRadius: 10, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2 }}>
          <LIcon name="arrowL" size={14} color={LTOKENS.ink2} /> <Mono style={{ fontSize: 11 }}>Back to the arena</Mono>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px 28px' }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <Mono style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.6 }}>
            The seal breaks here — every rival&rsquo;s full book, their points, and their agent&rsquo;s reasoning, unrolled across the week. The dossier room lands in the next phase of this build.
          </Mono>
        </div>
      </div>
    </div>
  );
}
