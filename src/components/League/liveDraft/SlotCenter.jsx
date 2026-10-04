// src/components/League/liveDraft/SlotCenter.jsx
//
// The no-game League center (Entry-Flow Consolidation P2) — ONE entry story:
// the slot picker IS the center, and the bracket line stays a single honest footnote (the copy is
// preserved, not deleted — the display-honesty smokes assert it). Shared by
// the desktop center column and the mobile scroll column so the two viewports
// can't drift. `onEntered` is the claim payoff: the caller passes the
// "Open my game" push so a successful claim lands the user in
// their seated surface, not back on a quiet lobby.
//
// LEAGUE_LIVE_DRAFT off closes scheduled enrollment. It must not revive the
// retired board-based enrollment path. Existing registrations remain readable.
//
// Backing desktop layouts — `backingSlot`: the Backing strip's mount on BOTH
// viewports (LeagueLobbyDesktop; the mobile lobby since N3, the desktop review
// record), DIRECTLY UNDER the draft-slot picker and
// ABOVE the bracket line (founder ruling: never below the bracket line).
// Rendered BARE — no wrapper, no margin — so a strip that renders null (the
// flag dark, the list loading) leaves no element and no gap; the column's own
// flex gap spaces it when it renders. With no slot passed the markup is the
// markup main ships (backingMobilePin.test.jsx).
// `services` (optional) replaces the picker's calls —
// only the dev preview page passes it (fixture answers, no network); omitted,
// each call is the real service, exactly as before.

import React from 'react';
import LiveDraftPicker from './LiveDraftPicker';
import { LEAGUE_LIVE_DRAFT } from '../../../config/featureFlags';
import { PICKER_TOKENS, LTOKENS, MONO } from '../leagueTokens';

export default function SlotCenter({ currentUserId, displayName = null, onEntered = null, backingSlot = null, services = null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 560, margin: '0 auto' }}>
      {LEAGUE_LIVE_DRAFT ? (
        <LiveDraftPicker tokens={PICKER_TOKENS} currentUserId={currentUserId} displayName={displayName} onEntered={onEntered} services={services} />
      ) : (
        <p role="status" style={{ color: LTOKENS.ink3, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Scheduled draft enrollment is unavailable right now. Please check back later.
        </p>
      )}
      {backingSlot}
      <div style={{ textAlign: 'center', paddingTop: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>
          The monthly bracket opens when the season locks
        </span>
      </div>
    </div>
  );
}
