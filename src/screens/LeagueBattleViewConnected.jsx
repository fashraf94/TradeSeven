// src/screens/LeagueBattleViewConnected.jsx
//
// League Battleview Routing (Spec V1.1, Phase A) — the connected wrapper the
// Command Center live-game card path dispatches to for a flat-6 LEAGUE battle, so
// a tapped league game opens the SAME Arena the League tab renders
// (LeagueBattleArenaLive) instead of the BaggerBomb AgentBattleScreen.
//
// It owns the same data derivation the League hosts already do (LeagueParticipant-
// View / LeagueTrainingBattleView) — subscribeMyGroup (the player's group) +
// useMyTournamentBattle (the live battle doc) + the composite context — so the
// Arena renders live, decomposable scoring. The whitelisted card battle is used
// ONLY as the routing discriminator upstream (BattleViewScreen); this wrapper
// re-reads the full live doc rather than trusting that stripped-down object.
//
// mode is derived from the group doc (isTraining:true → a practice pod) so a
// training pod is never mislabeled ranked and vice-versa (Spec V1.1 D1c).
//
// Mounted only when LEAGUE_BATTLEVIEW_ROUTING_ENABLED is on AND the gameMode
// discriminator matched (both gated at BattleViewScreen), so it never renders for
// a BaggerBomb battle.

import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import LeagueBattleViewRender from './leagueBattleViewRender';
import { subscribeMyGroup } from '../services/tournamentGroupService';
import { getWeeklyComposite, getWeeklyScore, round2 } from '../constants/leagueTournament';

const shell = (children) => (
  <div style={{
    minHeight: '100vh', background: '#050609', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
    color: '#8b949e', fontFamily: 'monospace', fontSize: 12,
  }}>
    {children}
  </div>
);

export default function LeagueBattleViewConnected({ onBack = null }) {
  // uid via useUser() (NOT the passed-through card user) so it is the Firebase
  // auth uid the arena data layer keys on — identical to the League hosts.
  const { user } = useUser();
  const uid = user?.uid;
  const { isDesktop } = useIsMobile();

  const [group, setGroup] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!uid) { setLoaded(true); return undefined; }
    return subscribeMyGroup(uid, (g) => { setGroup(g); setLoaded(true); });
  }, [uid]);

  // The player's OWN live battle for this group (owner-scoped rule; the hook uses
  // the auth uid internally). Null until the agent layer has deployed.
  const { battle } = useMyTournamentBattle(group?.id);

  // Composite context — identical derivation to LeagueParticipantView (the 1.5×
  // weighting is single-homed inside computeComposite). getWeekly* return 0 for a
  // null group, so this stays null-safe before the group resolves.
  const compositeContext = useMemo(
    () => ({ composite: round2(getWeeklyComposite(group, uid)), userPoints: round2(getWeeklyScore(group, uid)) }),
    [group, uid],
  );

  // Live-league vs training pod (D1c): both carry gameMode='baggerbomb_tournament';
  // the pod doc is the discriminator (isTraining:true → a practice pod).
  const mode = group?.isTraining ? 'training' : 'ranked';

  if (!loaded || (uid && !group)) {
    return shell('Loading the arena…');
  }
  if (!group || !battle) {
    // Group resolved to nothing (no active league game) or the agent layer has not
    // deployed yet — an honest card rather than an endless spinner.
    return shell(
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 320 }}>
        <span>This league game isn’t live right now.</span>
        {onBack && (
          <button
            onClick={onBack}
            style={{ all: 'unset', cursor: 'pointer', color: '#00d9ff', fontSize: 13 }}
          >
            ← Back
          </button>
        )}
      </div>,
    );
  }

  // Delegate to the node-clean render split: Arena when ARENA_LIVE_ON, else the
  // classic Flat6BattleView — mirroring the League hosts (Spec V1.2 Correction 1).
  return (
    <LeagueBattleViewRender
      group={group}
      battle={battle}
      mode={mode}
      uid={uid}
      compositeContext={compositeContext}
      isDesktop={isDesktop}
      onBack={onBack}
    />
  );
}
