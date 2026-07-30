// src/screens/LeagueBattleViewConnected.jsx
//
// League Battleview Routing (Spec V1.2, Phase A) — the connected wrapper the
// Command Center live-game card path dispatches to for a flat-6 LEAGUE battle, so
// a tapped league game opens the SAME Arena the League tab renders instead of the
// BaggerBomb AgentBattleScreen.
//
// It resolves the group from the TAPPED battle's own `groupId` (propagated through
// the card mappers) via subscribeGroup — an unfiltered pod-scoped read (the same
// primitive LeagueTrainingBattleView uses), NOT subscribeMyGroup (which filters
// training pods out via selectMyGroup and would surface "my current group" rather
// than the game the user actually tapped). This makes the D1c mode derivation real
// — a training pod resolves to isTraining:true → mode 'training', a ranked group to
// 'ranked' — and guarantees the Arena shows the tapped game, never a sibling.
// tournamentGroups reads are authenticated-only (firestore.rules), so the by-id
// read is permitted for the owner. The battle doc comes from useMyTournamentBattle
// (owner-scoped by the auth uid internally), keyed on the same groupId.
//
// Mounted only when LEAGUE_BATTLEVIEW_ROUTING_ENABLED is on AND the gameMode
// discriminator matched (both gated at BattleViewScreen), so it never renders for
// a BaggerBomb battle.

import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import LeagueBattleViewRender from './leagueBattleViewRender';
import { subscribeGroup } from '../services/tournamentGroupService';
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

export default function LeagueBattleViewConnected({ groupId = null, onBack = null }) {
  // uid via useUser() (the Firebase auth uid the arena data layer keys on —
  // identical to the League hosts). Used for the composite context + the Arena.
  const { user } = useUser();
  const uid = user?.uid;
  const { isDesktop } = useIsMobile();

  // Resolve the tapped game's group by its own id (not "my current group").
  const [group, setGroup] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!groupId) { setLoaded(true); return undefined; }
    setLoaded(false);
    return subscribeGroup(groupId, (g) => { setGroup(g); setLoaded(true); });
  }, [groupId]);

  // The player's OWN live battle for this group (owner-scoped rule; the hook uses
  // the auth uid internally). Null until the agent layer has deployed.
  const { battle } = useMyTournamentBattle(groupId);

  // Composite context — identical derivation to LeagueParticipantView (the 1.5×
  // weighting is single-homed inside computeComposite). getWeekly* return 0 for a
  // null group, so this stays null-safe before the group resolves.
  const compositeContext = useMemo(
    () => ({ composite: round2(getWeeklyComposite(group, uid)), userPoints: round2(getWeeklyScore(group, uid)) }),
    [group, uid],
  );

  // Live-league vs training pod (D1c): both carry gameMode='baggerbomb_tournament';
  // the resolved pod doc is the discriminator (isTraining:true → a practice pod).
  const mode = group?.isTraining ? 'training' : 'ranked';

  // Only the pre-subscription window is "loading"; once the snapshot fires, a null
  // group means the game isn't live (falls through to the honest card below) — the
  // guard must NOT re-enter loading on a resolved-null group (that was an endless
  // spinner). See code-review finding #1.
  if (!loaded) {
    return shell('Loading the arena…');
  }
  if (!group || !battle) {
    // Group resolved to nothing (no such live game) or the agent layer has not
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
