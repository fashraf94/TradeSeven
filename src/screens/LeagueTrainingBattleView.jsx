// src/screens/LeagueTrainingBattleView.jsx
//
// League Training Slice 5a — THE battle-view host a post-draft training pod
// lands on. A training pod is a `tournamentGroups` doc (isTraining:true); after
// its interactive snake draft resolves it has no destination today (the draft
// screen dead-ends at a "Done → dashboard" card). This view is that destination.
//
// Composition ONLY — it reuses the tournament battle CONTENT components under a
// practice-framed header, with NO ranked chrome (no bracket / career-rank /
// round-boundary / board-commit / lobby):
//   • agent layer (6) ...... Flat6BattleView   (via useMyTournamentBattle)
//   • user layer (3) ....... ClaimFlipWindow   (claims + flips)
//   • draft replay ......... DraftPlaybackTheater
//   • group feed ........... GroupFeed
// The composite (agent + 1.5× user) is shown faithfully but framed as practice.
//
// NOTE: this is NOT BaggerBombTrainingBattleViewV3/V4 — those are a separate 1v1
// game on a `battle` doc. This view reads a League POD by id.
//
// It reads the pod via subscribeGroup (an unfiltered single-doc read — surfaces
// AWAITING_OPEN as well as BATTLE, unlike subscribeMyGroup), and the player's own
// agent battle via useMyTournamentBattle. Dark in 5a: reachable only via the dev
// params (?trainingDraft / ?trainingBattle); the live entry CTA is Slice 5b.

import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Cpu, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import Flat6BattleView from '../components/Tournament/Flat6BattleView';
import ClaimFlipWindow from '../components/Tournament/ClaimFlipWindow';
import DraftPlaybackTheater from '../components/Tournament/DraftPlaybackTheater';
import GroupFeed from '../components/Tournament/GroupFeed';
import AwaitingOpenPodView from '../components/Tournament/awaitingOpen/AwaitingOpenPodView';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import { useIsMobile } from '../hooks/useIsMobile';
import LeagueBattleArenaLive from '../components/League/battleArena/LeagueBattleArenaLive';
import { ARENA_LIVE_ON } from '../components/League/battleArena/arenaLiveGate';
import { subscribeGroup } from '../services/tournamentGroupService';
import { GROUP_STATUS } from '../constants/leagueTournament';
import { isTrainingPodDraftV2On, isTrainingPodDesktopOn } from '../config/featureFlags';
import { trainingStatusFraming, deriveCompositeContext } from './leagueTrainingBattleFraming';

export default function LeagueTrainingBattleView({ podId, user, onBack = null }) {
  const { tokens } = useTheme();
  const uid = user?.uid;

  const [pod, setPod] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Battle View V2 (desktop-only) — runs unconditionally, inert when the gate is
  // off so flag-off / mobile / pre-deploy render today's practice column unchanged.
  const { isDesktop } = useIsMobile();
  // Awaiting-open DESKTOP layout breakpoint. tabletBreakpoint:1023 → isDesktop at
  // width ≥ 1024, matching the lobby's DraftBoardRoom useNarrow(< 1024) split
  // pixel-for-pixel (D2). Separate from the arena's isDesktop above (768) so that
  // path is byte-unchanged.
  const { isDesktop: isWideDesktop } = useIsMobile({ tabletBreakpoint: 1023 });
  const [classic, setClassic] = useState(false);

  // Pod-by-id read: surfaces the pod in AWAITING_OPEN and BATTLE (subscribeMyGroup
  // would filter both out for AWAITING_OPEN, and isn't pod-scoped).
  useEffect(() => {
    if (!podId) { setLoaded(true); return undefined; }
    return subscribeGroup(podId, (g) => { setPod(g); setLoaded(true); });
  }, [podId]);

  // The player's OWN agent battle for this pod (owner-scoped rule; hook uses the
  // auth uid internally). Null until the agent layer has deployed.
  const { battle: myBattle, chain: myChain } = useMyTournamentBattle(podId);

  const framing = useMemo(() => trainingStatusFraming(pod?.status), [pod?.status]);
  const compositeContext = useMemo(() => deriveCompositeContext(pod, uid), [pod, uid]);
  // Training Pod Draft V2 (Phase 2) gate. Flag-off (or non-awaiting-open) →
  // today's video-based composition, byte-identical.
  const v2On = isTrainingPodDraftV2On();
  // Awaiting-open DESKTOP layout gate (TRAINING_POD_DESKTOP_ENABLED or
  // ?trainingPodDesktop=1) — only the V2 awaiting-open body, only at ≥1024. When
  // off / mobile / not-awaiting-open this is false and `page` stays today's
  // single-column, document-scroll column (byte-identical).
  const desktopPod = isTrainingPodDesktopOn() && isWideDesktop
    && v2On && pod?.status === GROUP_STATUS.AWAITING_OPEN;

  const page = {
    background: tokens.bgApp,
    color: tokens.textPrimary,
    padding: '24px 16px calc(env(safe-area-inset-bottom, 0px) + 130px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    margin: '0 auto',
    // Desktop awaiting-open (D1 + D3): widen to the desktop max AND become the
    // ONE bounded-height scroll frame the sticky claims rail pins inside. Plain
    // overflow:auto + height only — deliberately NO transform/filter/contain/
    // will-change/perspective on this element (or any new ancestor) so the
    // position:fixed AssetResearchModal still escapes to the viewport rather than
    // being trapped/clipped inside the scroller. Off-target paths keep
    // minHeight:100vh document scroll at maxWidth 560, byte-identical.
    maxWidth: desktopPod ? 1180 : 560,
    // A bounded scroll frame wants a STABLE height — 100vh (not the dynamic
    // 100dvh; this path is desktop-only, where they're equal, and vh has no
    // no-support fallback that would unbound the frame and un-stick the rail).
    ...(desktopPod
      ? { height: '100vh', overflowY: 'auto' }
      : { minHeight: '100vh' }),
  };

  const backBtn = onBack && (
    <button
      onClick={onBack}
      style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.textMuted, fontSize: 13 }}
    >
      <ArrowLeft size={16} /> Back
    </button>
  );

  if (!loaded) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: tokens.textMuted }}>Loading your practice pod…</p>
      </div>
    );
  }

  if (!pod) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
        <GraduationCap size={28} color={tokens.teal} />
        <p style={{ fontSize: 14, color: tokens.textMuted, maxWidth: 320, margin: 0 }}>
          This practice pod is no longer available.
        </p>
        {backBtn}
      </div>
    );
  }

  // Training-Pod P0 R2: a pod retired pre-BATTLE (EXPIRED) is terminal — never
  // render the live battle body (which would show an empty arena + inert claims).
  // Short-circuit to an honest 'closed' card, mirroring the not-available guard.
  if (pod.status === GROUP_STATUS.EXPIRED) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
        <GraduationCap size={28} color={tokens.textMuted} />
        <p style={{ fontSize: 14, color: tokens.textMuted, maxWidth: 320, margin: 0 }}>
          This practice pod was closed before its battle began. Start a fresh one any time.
        </p>
        {backBtn}
      </div>
    );
  }

  // Battle View V2 — the battle takeover (once the agent battle has deployed). The
  // viewport picks the arena: desktop → scale-to-fit ArenaDesktop (back-to-classic);
  // mobile → pinned-hero ArenaMobile (flag is the rollback). Pre-deploy
  // (awaiting_open), flag-off, or classic → today's practice column, byte-identical
  // on BOTH viewports (the gate short-circuits on ARENA_LIVE_ON before isDesktop).
  // The arena subsumes Flat6 + ClaimFlipWindow + GroupFeed; draft replay stays classic.
  if (ARENA_LIVE_ON && myBattle && !classic) {
    return (
      <div style={{ minHeight: '100vh', background: '#050609', padding: isDesktop ? 16 : 0, boxSizing: 'border-box' }}>
        <LeagueBattleArenaLive
          group={pod}
          battle={myBattle}
          battleChain={myChain}
          mode="training"
          uid={uid}
          compositeContext={compositeContext}
          onBack={isDesktop ? () => setClassic(true) : null}
          viewport={isDesktop ? 'desktop' : 'mobile'}
        />
      </div>
    );
  }

  return (
    <div style={page}>
      {/* Training-framed header (no ranked bracket/round chrome) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GraduationCap size={20} color={tokens.teal} />
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', flex: 1 }}>{framing.label}</div>
        {backBtn}
      </div>
      <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.5 }}>{framing.sub}</div>

      {/* Practice banner — reframes the reused (ranked) content as a rehearsal. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', borderRadius: 12,
        background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`,
      }}>
        <Cpu size={15} color={tokens.teal} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 11.5, color: tokens.textMuted, lineHeight: 1.45 }}>
          Every seat here is a CPU. No stakes, no cut — practice runs don’t feed the leaderboard or the bracket.
          The composite below (agent + 1.5× user) is your rehearsal score.
        </div>
      </div>

      {v2On && pod.status === GROUP_STATUS.AWAITING_OPEN ? (
        // Phase 2 (L4–L8): the rebuilt awaiting-open pod — no user-draft video;
        // countdown → user draftboard → best-remaining free agents → relocated
        // claims. The draft-replay theater is removed from THIS surface only;
        // the agent (Monday) draft spectator show is untouched.
        <AwaitingOpenPodView pod={pod} uid={uid} desktop={desktopPod} />
      ) : (
        <>
          {/* Agent layer (6) — only once the agent battle has deployed. */}
          {myBattle && (
            <Flat6BattleView battle={myBattle} isOwner compositeContext={compositeContext} />
          )}

          {/* User layer (3) — claims + flips. */}
          <ClaimFlipWindow group={pod} uid={uid} />

          {/* Draft replay (training writes userDraft + agentDraft streams + agentBoards). */}
          <DraftPlaybackTheater groupId={pod.id} group={pod} uid={uid} />

          {/* Group feed (null-safe; renders nothing if the pod has no feed). */}
          <GroupFeed feed={pod.feed} uid={uid} />
        </>
      )}
    </div>
  );
}
