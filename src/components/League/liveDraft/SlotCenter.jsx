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

import React from 'react';
import LiveDraftPicker from './LiveDraftPicker';
import AutoDraftFallback from './AutoDraftFallback';
import { PICKER_TOKENS, LTOKENS, MONO } from '../leagueTokens';

export default function SlotCenter({ currentUserId, displayName = null, onEntered = null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 560, margin: '0 auto' }}>
      <LiveDraftPicker tokens={PICKER_TOKENS} currentUserId={currentUserId} displayName={displayName} onEntered={onEntered} />
      <AutoDraftFallback tokens={PICKER_TOKENS} displayName={displayName} onEntered={onEntered} />
      <div style={{ textAlign: 'center', paddingTop: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>
          The monthly bracket opens when the season locks
        </span>
      </div>
    </div>
  );
}
