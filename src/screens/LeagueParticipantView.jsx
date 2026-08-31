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
import DraftBoardRoom from '../components/League/draft/DraftBoardRoom';
import LiveDraftPicker from '../components/League/liveDraft/LiveDraftPicker';
import LiveDraftGlimpse from '../components/League/liveDraft/LiveDraftGlimpse';
import LiveDraftAwaiting from '../components/League/liveDraft/LiveDraftAwaiting';
import { releaseSlot } from '../services/liveDraftActions';
import { LEAGUE_LOBBY_ENABLED, LEAGUE_LIVE_DRAFT, LEAGUE_SCORE_HISTORY_ON } from '../config/featureFlags';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import usePreOpenPhase from '../hooks/usePreOpenPhase';
import { useIsMobile } from '../hooks/useIsMobile';
import LeagueBattleArenaLive from '../components/League/battleArena/LeagueBattleArenaLive';
import { ARENA_LIVE_ON } from '../components/League/battleArena/arenaLiveGate';
import LeagueVoidedNotice from '../components/League/LeagueVoidedNotice';
import LeagueRecapEntry from '../components/League/LeagueRecapEntry';
import {
  subscribeMyGroup,
  subscribeMyMostRecentVoidedGroup,
  subscribeMyMostRecentCompletedGroup,
  subscribeBracket,
  subscribeRank,
} from '../services/tournamentGroupService';
import { resolveRoundBoundary } from '../utils/roundBoundary';
import { participantStatusFraming } from './leagueParticipantFraming';
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

export default function LeagueParticipantView({ agentLoadout = null, onOpenForge = null } = {}) {
  const { tokens } = useTheme();
  const { user } = useUser();
  const uid = user?.uid;

  const [group, setGroup] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Leave-slot feedback for the FORMING glimpse; the subscribeMyGroup snapshot
  // drives the UI away once the seat is released (reset on error).
  const [leaving, setLeaving] = useState(false);

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

  // L-A follow-up (B) — the member voided-card. A DEDICATED most-recent-voided
  // read, kept separate from subscribeMyGroup so the active allowlist stays inert
  // to VOIDED. Only surfaced in the no-active-group region below (auto-expiry: it
  // clears when the member's next group forms and `group` goes non-null).
  const [voidedGroup, setVoidedGroup] = useState(null);
  useEffect(() => {
    if (!uid) { setVoidedGroup(null); return undefined; }
    return subscribeMyMostRecentVoidedGroup(uid, setVoidedGroup);
  }, [uid]);

  // League Score History (flag-gated): the DEDICATED most-recent-completed read
  // behind the survives-the-bank recap card — the exact twin of the voided read,
  // kept separate from subscribeMyGroup so the active allowlist stays inert to
  // COMPLETE. Flag-off, this subscription is never created (byte-identical). Like
  // the voided read it auto-expires when a newer group appears.
  const [completedGroup, setCompletedGroup] = useState(null);
  useEffect(() => {
    if (!LEAGUE_SCORE_HISTORY_ON || !uid) { setCompletedGroup(null); return undefined; }
    return subscribeMyMostRecentCompletedGroup(uid, setCompletedGroup);
  }, [uid]);

  // Participant mode reads the player's OWN battle live (owner-scoped rule
  // allows it); null until a battle week is underway. `chain` (all daily docs)
  // feeds the live arena's Score-History recap (the swap ledger); existing
  // consumers ignore it.
  const { battle: myBattle, chain: myChain } = useMyTournamentBattle(group?.id);

  // PRE-OPEN PHASE (PREOPEN_PHASE_ROUTING_ENABLED): BATTLE, but the market has not
  // opened yet on this pod's anchor date. Ranked reaches this two ways — the
  // Mon 08:45 slot completes straight into BATTLE ~40min pre-open, and an
  // overnight pod is flipped by the ~06:00 orchestrator sweep — and BOTH carry a
  // startAnchor, which is what this derivation keys on. A single-shot ranked pod
  // is resolved WITHOUT a startAnchor (api/tournament/resolve-user-draft.js:182
  // writes it only when given), so the derivation is inert there by construction.
  // The hook owns its ticker, so the view re-renders at the bell. Flag-off it is a
  // constant false and every expression below reduces to today's.
  const preOpen = usePreOpenPhase(group);

  // The completed group's OWN daily chain for the recap card — only subscribed
  // when the flag is on AND there is no active group (the recap interlude).
  const { chain: completedChain } = useMyTournamentBattle(
    LEAGUE_SCORE_HISTORY_ON && !group ? completedGroup?.id : null,
  );

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
    // L-A follow-up (B): the member voided-card. Only when signed-in + loaded +
    // there IS a most-recent voided group (never for the signed-out / still-loading
    // states). Renders in whichever no-active-group surface follows, so the member
    // whose battle was voided gets the explanation instead of a bare poster.
    const voidedNotice = uid && loaded && voidedGroup ? <LeagueVoidedNotice group={voidedGroup} /> : null;
    // League Score History (flag-gated): the survives-the-bank recap card. Sits
    // beside the voided card in the no-group region; the two are mutually
    // exclusive (a group's most-recent terminal state is one or the other), and
    // both auto-expire when a newer group forms. Null off-gate (byte-identical).
    const recapEntry = LEAGUE_SCORE_HISTORY_ON && uid && loaded && completedGroup
      ? <LeagueRecapEntry group={completedGroup} battleChain={completedChain} uid={uid} />
      : null;
    // P10b — the lobby front door replaces the dead "no active group" poster
    // for a signed-in, loaded player with no group, ONLY when the flag is on.
    // Flag-off renders the poster below byte-unchanged (regression-safe); the
    // signed-out / still-loading states keep their copy either way.
    if (uid && loaded && !group && (LEAGUE_LOBBY_ENABLED || LEAGUE_LIVE_DRAFT)) {
      // Competitive Live Draft: the slot picker sits behind the same "Enter
      // tournament" no-group surface. Flag-off LEAGUE_LIVE_DRAFT this reduces to
      // the existing LeagueLobby path (byte-identical).
      return (
        <div style={page}>
          {voidedNotice}
          {recapEntry}
          {LEAGUE_LIVE_DRAFT && (
            <LiveDraftPicker tokens={tokens} currentUserId={uid} displayName={user?.displayName} />
          )}
          {LEAGUE_LOBBY_ENABLED && <LeagueLobby uid={uid} displayName={user?.displayName} />}
        </div>
      );
    }
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {voidedNotice}
        {recapEntry}
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
  // One derivation for the header tone, the header copy and the four body guards
  // below (BUILD_RULES §9) — see leagueParticipantFraming.js. With `preOpen` false
  // this is byte-identical to the `isForming ? … : …` binary it replaces (the
  // local `isForming` it retires had no other consumer in this file).
  const framing = participantStatusFraming(group.status, { preOpen });

  // Battle View V2 — the battle takeover. Reached ONLY once the agent battle has
  // deployed (myBattle), with the gate on and not dropped to classic. The viewport
  // picks the arena: desktop → the scale-to-fit ArenaDesktop (with a back-to-classic
  // affordance); mobile → the pinned-hero ArenaMobile (no classic toggle — the flag
  // is the rollback). Everything else (flag-off, forming/drafting, the round-
  // boundary/no-group states above) falls through to today's column, byte-identical
  // on BOTH viewports — the gate short-circuits on ARENA_LIVE_ON before isDesktop.
  // The arena subsumes Flat6BattleView + ClaimFlipWindow + GroupFeed; draft replay /
  // board-commit are lifecycle chrome and stay in the classic view.
  // DELIBERATELY NOT gated on the pre-open phase. Suppressing this takeover was
  // tried twice and reverted twice, for the same reason both times: the arena is
  // the DEFAULT ranked surface AND it carries its own claim doorway
  // (buildArenaModel.js:458-465, :543 — the wire, open on getClaimWindowDisplay).
  // Diverting a pre-open pod off it demoted the user onto the legacy column, which
  // is exactly the capability loss the claim-window revert undid; and once the
  // ladder no longer routes to LiveDraftAwaiting there is no awaiting surface on
  // this route to preempt, so the gate would only trade one live body for another
  // — under an awaiting header, with a Flips tab the practice pre-open surface
  // deliberately hides.
  //
  // CONSEQUENCE, STATED PLAINLY: ranked is NOT fixed pre-open. Once the agent
  // deploys (~06:00) the arena takes over and reads live until the bell, exactly as
  // today. Only the classic column — the pre-deploy window, where myBattle is null
  // and no Flat6 "Live" pill renders — gets the honest header below. Fixing ranked
  // properly needs either claim controls on LiveDraftAwaiting or an awaiting state
  // in the arena itself; both are rulings, not improvisations. See the Phase 5
  // audit record.
  if (ARENA_LIVE_ON && myBattle && !classic) {
    return (
      <div style={{ minHeight: '100vh', background: '#050609', padding: isDesktop ? 16 : 0, boxSizing: 'border-box' }}>
        <LeagueBattleArenaLive
          group={group}
          battle={myBattle}
          battleChain={myChain}
          mode="ranked"
          uid={uid}
          compositeContext={compositeContext}
          onBack={isDesktop ? () => setClassic(true) : null}
          viewport={isDesktop ? 'desktop' : 'mobile'}
        />
      </div>
    );
  }

  // Competitive Live Draft (LEAGUE_LIVE_DRAFT): a slot pod passes FORMING
  // (awaiting fire) → DRAFTING (the live room) → AWAITING_OPEN (holding) → BATTLE.
  // selectMyGroup observes these in-flight states (Phase 3). A regular ranked pod
  // is NEVER isLiveDraft, so this whole block is inert flag-off (byte-identical);
  // BATTLE/COMPLETE fall through to the existing battle view untouched.
  if (group.isLiveDraft) {
    if (group.status === GROUP_STATUS.DRAFTING) {
      return (
        <div style={{ minHeight: '100vh', background: tokens.bgApp }}>
          <DraftBoardRoom user={user} groupId={group.id} mode="competitive" />
        </div>
      );
    }
    if (group.status === GROUP_STATUS.FORMING) {
      // The seated-status glimpse owns its full obsidian page (dark-only,
      // LTOKENS/LX) — mounted full-screen, not inside the light useTheme column.
      return (
        <LiveDraftGlimpse
          group={group} currentUserId={uid}
          agentLoadout={agentLoadout} onOpenForge={onOpenForge}
          onLeave={() => {
            setLeaving(true);
            releaseSlot({ groupId: group.id }).catch(() => setLeaving(false));
          }}
          leaving={leaving}
          compact={!isDesktop}
        />
      );
    }
    // NOT `|| preOpen`. Diverting a pre-open BATTLE pod here was tried and
    // REVERTED: LiveDraftAwaiting carries no claim controls, and the pre-open
    // window is the only day-1 claim window a competitive pod has (place-claim.js:
    // 96-97 requires BATTLE; the wire shuts 09:24 ET). Routing there fixed a label
    // by removing a capability. A pre-open pod therefore falls through to the
    // classic column, which keeps ClaimFlipWindow and reads awaiting copy via
    // leagueParticipantFraming. See the Phase 5 audit record.
    if (group.status === GROUP_STATUS.AWAITING_OPEN) {
      return (
        <LiveDraftAwaiting
          group={group} currentUserId={uid}
          agentLoadout={agentLoadout} onOpenForge={onOpenForge}
          compact={!isDesktop}
        />
      );
    }
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Trophy size={20} color={tokens.medalGold} />
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', flex: 1 }}>League</div>
        <span style={{ fontSize: 11, color: tokens.textMuted }}>{roundLabel}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tokens.textMuted }}>
        <Swords size={13} color={framing.tone === 'pending' ? tokens.amber : tokens.teal} />
        {framing.sub}
        <span style={{ marginLeft: 'auto', color: tokens.textFaint }}>
          {(group.groupMembers || []).length} players
        </span>
      </div>

      {framing.showBattleBody && myBattle && (
        <Flat6BattleView
          battle={myBattle}
          isOwner
          compositeContext={compositeContext}
        />
      )}

      {framing.showBattleBody && <ClaimFlipWindow group={group} uid={uid} />}

      {framing.showBattleBody && (
        <DraftPlaybackTheater groupId={group.id} group={group} uid={uid} />
      )}

      <BoardCommitFlow groupId={group.id} group={group} uid={uid} />

      {framing.showBattleBody && <GroupFeed feed={group.feed} uid={uid} />}
    </div>
  );
}
