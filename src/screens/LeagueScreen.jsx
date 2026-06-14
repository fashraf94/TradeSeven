// src/screens/LeagueScreen.jsx
//
// P5 — the League tab home (behind TOURNAMENT_TAB_ENABLED, flag off in
// production until P9): the first real tournament surface, replacing the
// Closeout-era placeholder. Self-served from contexts (the
// TournamentDevScreen idiom — App.jsx passes nothing).
//
// States: signed-out / no active group → the coming-soon poster; FORMING →
// the board-commit flow (ratified proposal C — prefill, curate, confirm the
// lock semantics, re-commit until the draft runs, the autoCommitted badge
// when the Monday deadline defaulted it); BATTLE → the two-act playback
// theater (Monday's headline per V2.1's weekly rhythm) + the locked board +
// the group feed (flips, auto-commits). Battle VIEW composition is P7's —
// the feed card is the modest battle-week stand-in.
//
// Reads only (tournamentGroups is client-read-only by rules); the my-group
// query is subscribeMyGroup (groupMembers array-contains — if the console
// prompts for an index during smoke, FLAG it, never improvise).

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

export default function LeagueScreen() {
  const { tokens } = useTheme();
  const { user } = useUser();
  const uid = user?.uid;

  const [group, setGroup] = useState(null);
  const [loaded, setLoaded] = useState(false);

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
  const compositeContext = {
    composite: round2(getWeeklyComposite(group, uid)),
    userPoints: round2(getWeeklyScore(group, uid)),
  };

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
