// src/components/League/LeagueRecapEntry.jsx
//
// League Score History — the SURVIVES-THE-BANK entry. When a member's ranked
// battle completes, the group drops out of selectMyGroup's active allowlist (by
// design — that inertness is load-bearing), so the League tab would otherwise
// show only the bare "no active group" poster and the just-finished battle would
// vanish. This card is the recap doorway: fed a COMPLETED group + the caller's
// own daily battle chain by a DEDICATED most-recent-completed read
// (subscribeMyMostRecentCompletedGroup) — never by loosening selectMyGroup — it
// opens the Film Room recap (Level 1 composite timeline + the per-day swap
// ledger) as a full-screen overlay.
//
// The EXACT sibling of LeagueVoidedNotice: same no-group-region placement, same
// dark self-contained card, same durable auto-expiry (it clears the moment a
// newer group appears). Flag-gated at the call site — flag-off, this is never
// rendered (byte-identical). Read-only / display-layer; the history is a pure
// read (buildScoreHistory) over already-banked data.

import React from 'react';
import { Eyebrow, LIcon, Icon, Mono } from './LeagueParts';
import { LTOKENS, alpha } from './leagueTokens';
import { FilmRoomOverlay } from './battleArena/ArenaOverlays';
import { buildScoreHistory } from './battleArena/buildScoreHistory';

export default function LeagueRecapEntry({ group = null, battleChain = [], uid = null }) {
  const [open, setOpen] = React.useState(false);
  const history = React.useMemo(
    () => buildScoreHistory({ group, battleChain, uid }),
    [group, battleChain, uid],
  );
  // Never surface an empty recap — if there is neither a banked climb nor a swap,
  // there is nothing to review (the card would be a dead end).
  const hasContent = (((history.timeline?.length) || 0) > 0) || ((history.swapCount || 0) > 0);
  if (!group || !hasContent) return null;

  return (
    <div
      style={{
        width: '100%', maxWidth: 460, boxSizing: 'border-box',
        borderRadius: 16, padding: '16px 17px',
        background: `linear-gradient(160deg, ${alpha(LTOKENS.gold, 0.1)}, ${alpha(LTOKENS.bg, 0.7)} 70%)`,
        border: `1px solid ${alpha(LTOKENS.gold, 0.34)}`,
        display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <LIcon name="crown" size={16} color={LTOKENS.gold} stroke={2} />
        <Eyebrow color={LTOKENS.gold}>Last battle · the week in review</Eyebrow>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>
        Your climb and every swap, unrolled
      </div>
      <Mono style={{ fontSize: 10.5, lineHeight: 1.55, color: LTOKENS.ink2 }}>
        The battle banked, but the recap stays — the day-by-day composite and each swap your agent made this week. It clears when your next group forms.
      </Mono>
      <button
        className="bv2-tap"
        onClick={() => setOpen(true)}
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 11,
          background: alpha(LTOKENS.gold, 0.16), border: `1px solid ${alpha(LTOKENS.gold, 0.45)}`,
        }}
      >
        <Mono style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>Open the Film Room</Mono>
        <Icon name="chevR" size={13} color={LTOKENS.gold} />
      </button>
      {open && <FilmRoomOverlay fixed history={history} onClose={() => setOpen(false)} />}
    </div>
  );
}
