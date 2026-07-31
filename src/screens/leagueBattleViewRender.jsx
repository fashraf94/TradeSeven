// src/screens/leagueBattleViewRender.jsx
//
// League Battleview Routing (Spec V1.2, Correction 1 / D1b) — the pure
// presentational split of LeagueBattleViewConnected: given resolved league data,
// render the League Arena. Kept in its own node-clean module (no firebase/data
// imports) so the render decision is unit-testable via renderToString without
// pulling firebase — the same testable-seam pattern as flat6BattleEnrichment /
// battleViewRouting.

import React from 'react';
import Flat6BattleView from '../components/Tournament/Flat6BattleView';
import LeagueBattleArenaLive from '../components/League/battleArena/LeagueBattleArenaLive';
import { ARENA_LIVE_ON } from '../components/League/battleArena/arenaLiveGate';

export default function LeagueBattleViewRender({ group, battle, mode, uid, compositeContext, isDesktop, onBack = null }) {
  // Arena gate OFF → classic Flat6BattleView, mirroring the League hosts
  // (LeagueParticipantView / LeagueTrainingBattleView) so the card path shows
  // exactly what the tab shows: if ARENA_LIVE_ON is ever turned off, the card
  // falls back to classic on BOTH surfaces (Spec V1.2 Correction 1 / D1b).
  if (!ARENA_LIVE_ON) {
    return <Flat6BattleView battle={battle} isOwner compositeContext={compositeContext} />;
  }
  return (
    <div style={{ minHeight: '100vh', background: '#050609', padding: isDesktop ? 16 : 0, boxSizing: 'border-box' }}>
      <LeagueBattleArenaLive
        group={group}
        battle={battle}
        mode={mode}
        uid={uid}
        compositeContext={compositeContext}
        onBack={onBack}
        viewport={isDesktop ? 'desktop' : 'mobile'}
      />
    </div>
  );
}
