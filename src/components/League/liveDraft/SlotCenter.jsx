// src/components/League/liveDraft/SlotCenter.jsx
//
// The no-game League center (Entry-Flow Consolidation P2) — ONE entry story:
// the slot picker IS the center, the Auto-draft fallback lane sits below the
// slots, and the bracket line demotes to a single honest footnote (the copy is
// preserved, not deleted — the display-honesty smokes assert it). Shared by
// the desktop center column and the mobile scroll column so the two viewports
// can't drift. `onEntered` is the claim payoff: the caller passes the
// "Open my game" push so a successful claim (or Auto-draft) lands the user in
// their seated surface, not back on a quiet lobby.
//
// KILL-SWITCH (P2c, /code-review triage #5): LEAGUE_LIVE_DRAFT gates only the
// PICKER here — flag-off, the Auto-draft lane (a lobby feature, not a slot
// feature) and the footnote stay mounted, so the League tab always keeps an
// entry affordance and the flag remains a clean slots-only kill-switch.
//
// Backing desktop layouts — `backingSlot`: the Backing strip's desktop mount
// (LeagueLobbyDesktop), DIRECTLY UNDER the draft-slot picker and the Auto-draft
// card and ABOVE the bracket line (founder ruling: never below the bracket
// line). Rendered BARE — no wrapper, no margin — so a strip that renders null
// (the flag dark, the list loading) leaves no element and no gap; the column's
// own flex gap spaces it when it renders. Mobile passes nothing: its markup is
// the markup main ships (backingMobilePin.test.jsx).
// `services` (optional) replaces the picker's and the Auto-draft lane's calls —
// only the dev preview page passes it (fixture answers, no network); omitted,
// each call is the real service, exactly as before.

import React from 'react';
import LiveDraftPicker from './LiveDraftPicker';
import AutoDraftFallback from './AutoDraftFallback';
import { LEAGUE_LIVE_DRAFT } from '../../../config/featureFlags';
import { PICKER_TOKENS, LTOKENS, MONO } from '../leagueTokens';

export default function SlotCenter({ currentUserId, displayName = null, onEntered = null, backingSlot = null, services = null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 560, margin: '0 auto' }}>
      {LEAGUE_LIVE_DRAFT && (
        <LiveDraftPicker tokens={PICKER_TOKENS} currentUserId={currentUserId} displayName={displayName} onEntered={onEntered} services={services} />
      )}
      <AutoDraftFallback tokens={PICKER_TOKENS} displayName={displayName} onEntered={onEntered} services={services} />
      {backingSlot}
      <div style={{ textAlign: 'center', paddingTop: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>
          The monthly bracket opens when the season locks
        </span>
      </div>
    </div>
  );
}
