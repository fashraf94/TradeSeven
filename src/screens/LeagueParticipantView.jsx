// src/screens/LeagueParticipantView.jsx
//
// The League participant flow — extracted verbatim from the original
// LeagueScreen (P5) so the redesign front door (LeagueScreen) can render it
// unchanged when the redesign flag is OFF (byte-identical, regression-safe) and
// push it full-screen when "Open my game" is tapped with the flag ON.
//
// States: signed-out / no active group → the coming-soon poster (or LeagueLobby
// when LEAGUE_LOBBY_ENABLED); FORMING → the board-commit flow; BATTLE → the
// playback theater + locked board + group feed. Reads only (tournamentGroups is
// client-read-only by rules).

import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Swords } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import BoardCommitFlow from '../components/Tournament/BoardCommitFlow';
import DraftPlaybackTheater from '../components/Tournament/DraftPlaybackTheater';
import GroupFeed from '../components/Tournament/GroupFeed';
import Flat6BattleView from '../components/Tournament/Flat6BattleView';
import ClaimFlipWindow from '../components/Tournament/ClaimFlipWindow';
import RoundBoundaryView from '../components/Tournament/RoundBoundaryView';
import LeagueLobby from '../components/Tournament/LeagueLobby';
import { LEAGUE_LOBBY_ENABLED } from '../config/featureFlags';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import { useIsMobile } from '../hooks/useIsMobile';
import LeagueBattleArenaLive from '../components/League/battleArena/LeagueBattleArenaLive';
import { ARENA_LIVE_ON } from '../components/League/battleArena/arenaLiveGate';
import { subscribeMyGroup, subscribeBracket, subscribeRank } from '../services/tournamentGroupService';
import { resolveRoundBoundary } from '../utils/roundBoundary';
import {
  isRoundBoundaryAcknowledged,
  acknowledgeRoundBoundary,
  rememberBracketGameId,
  getRememberedBracketGameId,
} from '../utils/roundBoundaryAck';
import {
  GROUP_STATUS,
  parseBracketGameId,
  rankDocId,
  getWeeklyComposite,
  getWeeklyScore,
  round2,
} from '../constants/leagueTournament';

export default function LeagueParticipantView() {
  const { tokens } = useTheme();
  const { user } = useUser();
  const uid = user?.uid;

  const [group, setGroup] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Battle View V2 (desktop-only): when on, an active battle takes over full-width
  // as the new arena; `classic` lets a desktop user drop back to today's view.
  // These hooks run unconditionally (rules of hooks) and are inert when the gate
  // is off — flag-off / mobile / pre-battle render today's column byte-identically.
  const { isDesktop } = useIsMobile();
  const [classic, setClassic] = useState(false);
  // Memoized so a fresh object each render doesn't churn the arena's model memo
  // (or Flat6BattleView's). Value is identical to the prior inline form — pure of
  // group/uid; getWeeklyComposite/Score return 0 for a null group.
  const compositeContext = useMemo(
    () => ({ composite: round2(getWeeklyComposite(group, uid)), userPoints: round2(getWeeklyScore(group, uid)) }),
    [group, uid],
  );

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyGroup(uid, (g) => {
      setGroup(g);
      setLoaded(true);
    });
  }, [uid]);

  // Participant mode reads the player's OWN battle live (owner-scoped rule
  // allows it); null until a battle week is underway.
  const { battle: myBattle } = useMyTournamentBattle(group?.id);

  // C — the round-boundary read surface. The bracketId is recovered from the
  // current group OR (for an eliminated player, whose subscribeMyGroup returns
  // null) the last-seen bracket game in localStorage.
  const [bracket, setBracket] = useState(null);
  const [rankDoc, setRankDoc] = useState(null);
  const [ackedGameId, setAckedGameId] = useState(null);

  useEffect(() => { rememberBracketGameId(group?.bracketGameId); }, [group?.bracketGameId]);

  const bracketGameId = group?.bracketGameId ?? getRememberedBracketGameId();
  const bracketId = bracketGameId ? parseBracketGameId(bracketGameId)?.bracketId : null;

  useEffect(() => {
    if (!bracketId) { setBracket(null); return undefined; }
    return subscribeBracket(bracketId, setBracket);
  }, [bracketId]);

  useEffect(() => {
    if (!uid) { setRankDoc(null); return undefined; }
    return subscribeRank(rankDocId(uid), setRankDoc);
  }, [uid]);

  const boundary = useMemo(() => resolveRoundBoundary(bracket, uid), [bracket, uid]);
  const showBoundary = !!boundary
    && ackedGameId !== boundary.gameId
    && !isRoundBoundaryAcknowledged(boundary.gameId);

  const dismissBoundary = () => {
    if (boundary) { acknowledgeRoundBoundary(boundary.gameId); setAckedGameId(boundary.gameId); }
  };

  const page = {
    minHeight: '100vh',
    background: tokens.bgApp,
    color: tokens.textPrimary,
    padding: '24px 16px calc(env(safe-area-inset-bottom, 0px) + 130px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 560,
    margin: '0 auto',
  };

  // The round-boundary interstitial takes priority — it must show even for an
  // ELIMINATED player (group === null), so it's checked BEFORE the no-group
  // poster. An advancer dismisses it into the forming → BoardCommitFlow route
  // below; the eliminated/champion dismiss back to the season.
  if (showBoundary) {
    return (
      <div style={page}>
        <RoundBoundaryView
          bracket={bracket}
          uid={uid}
          boundary={boundary}
          rankDoc={rankDoc}
          onContinue={dismissBoundary}
        />
      </div>
    );
  }

  if (!uid || !loaded || !group) {
    // P10b — the lobby front door replaces the dead "no active group" poster
    // for a signed-in, loaded player with no group, ONLY when the flag is on.
    // Flag-off renders the poster below byte-unchanged (regression-safe); the
    // signed-out / still-loading states keep their copy either way.
    if (LEAGUE_LOBBY_ENABLED && uid && loaded && !group) {
      return (
        <div style={page}>
          <LeagueLobby uid={uid} displayName={user?.displayName} />
        </div>
      );
    }
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`,
        }}>
          <Trophy size={28} color={tokens.medalGold} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>League</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: tokens.textMuted, maxWidth: 360, margin: 0 }}>
          {!uid
            ? 'Sign in to see your tournament.'
            : !loaded
              ? 'Checking your tournament…'
              : 'No active tournament group yet. When your group forms, your draft board lives here.'}
        </p>
      </div>
    );
  }

  const roundLabel = group.bracketGameId
    ? `Bracket round ${parseBracketGameId(group.bracketGameId)?.roundNumber ?? group.roundNumber}`
    : `Base week ${group.baseLayerWeek ?? ''}`;
  const isForming = group.status === GROUP_STATUS.FORMING;

  // Battle View V2 — desktop battle takeover. Reached ONLY once the agent battle
  // has deployed (myBattle), on a desktop viewport, with the gate on and not
  // dropped to classic. Everything else (flag-off, mobile, forming/drafting, the
  // round-boundary/no-group states above) falls through to today's column,
  // byte-identical. The arena subsumes Flat6BattleView + ClaimFlipWindow +
  // GroupFeed; draft replay / board-commit are lifecycle chrome and stay in the
  // classic view.
  if (ARENA_LIVE_ON && isDesktop && myBattle && !classic) {
    return (
      <div style={{ minHeight: '100vh', background: '#050609', padding: 16, boxSizing: 'border-box' }}>
        <LeagueBattleArenaLive
          group={group}
          battle={myBattle}
          mode="ranked"
          uid={uid}
          compositeContext={compositeContext}
          onBack={() => setClassic(true)}
        />
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Trophy size={20} color={tokens.medalGold} />
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', flex: 1 }}>League</div>
        <span style={{ fontSize: 11, color: tokens.textMuted }}>{roundLabel}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tokens.textMuted }}>
        <Swords size={13} color={isForming ? tokens.amber : tokens.teal} />
        {isForming
          ? 'Group forming — commit your draft board before Monday\'s draft.'
          : 'Battle week — your group drafted Monday.'}
        <span style={{ marginLeft: 'auto', color: tokens.textFaint }}>
          {(group.groupMembers || []).length} players
        </span>
      </div>

      {!isForming && myBattle && (
        <Flat6BattleView
          battle={myBattle}
          isOwner
          compositeContext={compositeContext}
        />
      )}

      {!isForming && <ClaimFlipWindow group={group} uid={uid} />}

      {!isForming && (
        <DraftPlaybackTheater groupId={group.id} group={group} uid={uid} />
      )}

      <BoardCommitFlow groupId={group.id} group={group} uid={uid} />

      {!isForming && <GroupFeed feed={group.feed} uid={uid} />}
    </div>
  );
}
