// src/components/League/LeagueVoidedNotice.jsx
//
// L-A follow-up (B) — the member VOIDED-CARD. When a member's ranked battle is
// voided, the group drops out of selectMyGroup's active allowlist (by design —
// that inertness is load-bearing), so the League tab would otherwise show only a
// bare "no active group" poster and the player's battle would vanish with NO
// explanation. This card is the explanation: the muted VOIDED pill + the shared
// "Battle voided — no result recorded" headline + a one-line reason.
//
// READ-ONLY / display-layer. It is fed a voided group doc by a DEDICATED
// most-recent-voided read (subscribeMyMostRecentVoidedGroup) — never by loosening
// selectMyGroup. The pill reuses the L-A StatusBadge('voided') so it stays muted
// (no crown, no energy) and never reads as a real finish; the headline and reason
// both derive from the ONE group doc (VOIDED_NO_RESULT_COPY + the group's
// voidedReason via voidReasonLabel), so label and datum cannot drift (§9).
//
// Dismissal/expiry (founder-decidable, stated): DURABLE AUTO-EXPIRY — the card
// surfaces only while the void is the member's MOST-RECENT ranked group (the
// selectMyMostRecentVoidedGroup read anchors on the newest group overall, not the
// newest VOIDED doc). So it shows the moment their battle is voided and clears the
// moment ANY newer group appears — forming (the group view takes over) OR that
// next group later completing (a real result now stands, so the stale void must
// not resurface). No dismiss control / no persisted state: purely informational,
// low-frequency, and self-clearing.

import React from 'react';
import { StatusBadge, Mono } from './LeagueParts';
import { LTOKENS, alpha } from './leagueTokens';
import { VOIDED_NO_RESULT_COPY, voidReasonLabel } from '../../constants/leagueTournament';

export default function LeagueVoidedNotice({ group }) {
  if (!group) return null;
  return (
    <div
      style={{
        width: '100%', maxWidth: 460, boxSizing: 'border-box',
        borderRadius: 16, padding: '16px 17px',
        background: `linear-gradient(160deg, ${alpha(LTOKENS.surface, 0.9)}, ${alpha(LTOKENS.bg, 0.7)} 70%)`,
        border: `1px solid ${LTOKENS.hair2}`,
        display: 'flex', flexDirection: 'column', gap: 9, textAlign: 'left',
      }}
    >
      <StatusBadge status="voided" />
      <div style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>
        {VOIDED_NO_RESULT_COPY}
      </div>
      <Mono style={{ fontSize: 11, lineHeight: 1.55, color: LTOKENS.ink2 }}>
        {voidReasonLabel(group)}
      </Mono>
      <Mono style={{ fontSize: 10, lineHeight: 1.5, color: LTOKENS.ink3 }}>
        Nothing you did caused this — your next group will appear here when it forms.
      </Mono>
    </div>
  );
}
