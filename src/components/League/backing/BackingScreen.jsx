// src/components/League/backing/BackingScreen.jsx
//
// Backing Beta PR 4 — THE BACKING SCREEN the landing strip opens into (design
// brief rev2 §1 "it opens into the pod list", rev3 §1 "the strip is the door";
// spec V1.3 §5 the MVP cut: one list, one card, one control, one live card).
// Three views inside one screen: the list (Your Backing above the upcoming
// pods), the team card, the stake control. The header carries the week-state
// line the strip carries (rev3 §1 — kept inside the screen too).
//
// DATA: the pod list (useBackingPods), the viewer's own backing for the
// current week (useMyBacking), the wallet (useBackingWallet), the attestation
// status (useEligibility), the viewer's own pitch (useMyPitch), and the team
// card projection for the seat in view (useTeamCard). Every read is one of
// the rules-granted reads backingService.js names; every write is an
// endpoint. The hosts open it only while lit, and the screen reads
// BACKING_BETA_ENABLED at call time itself (the outer component holds no
// hooks; the inner one owns them), so a direct mount while dark renders
// nothing and runs nothing.
//
// PR 5 (spec V1.3 §5, §10): the list view opens on LAST WEEK'S RESULTS
// (BackingResults — the strip's between-state lands here), above Your
// Backing; and the screen emits the funnel's client events — window_viewed
// once the pod list has answered, your_backing_viewed while the viewer has a
// pod in play, team_card_opened with the dwell on leaving a card,
// stake_control_opened on entering the control — through the fire-and-forget,
// per-session-deduplicated emitter (backingTelemetry.js). `stake_confirmed`
// is the server's to write, never this screen's.
//
// THE DESKTOP LAYOUT (`viewport="desktop"` — Backing desktop layouts): the
// same hooks, the same view state and the same events, laid out by
// BackingDesk — three columns during the window, Your Backing and the results
// each taking the whole screen. The funnel's events fire on what is ON SCREEN:
// on mobile the list view shows the pods and Your Backing together; on desktop
// the pods are the window section's (window_viewed) and Your Backing the week
// section's (your_backing_viewed); the results section reads the results and
// the private record only while it is open, and records results_viewed through
// the results section's own hook. Mobile's markup is main's
// (backingMobilePin.test.jsx).

import React, { useEffect, useMemo, useState } from 'react';
import { useBackingLit } from '../../../hooks/useBackingLit';
import { FINE_PRINT } from '../../../constants/backing';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from '../LeagueParts';
import useBackingPods from '../../../hooks/useBackingPods';
import useMyBacking from '../../../hooks/useMyBacking';
import useBackingWallet from '../../../hooks/useBackingWallet';
import useEligibility from '../../../hooks/useEligibility';
import useMyPitch from '../../../hooks/useMyPitch';
import useTeamCard from '../../../hooks/useTeamCard';
import useBackingResults from '../../../hooks/useBackingResults';
import useMyBackingStats from '../../../hooks/useMyBackingStats';
import { MonoAttr, PointsMeter, SealRule } from './BackingParts';
import PodList from './PodList';
import TeamCard from './TeamCard';
import StakeControl from './StakeControl';
import YourBacking, { backedPodsFor } from './YourBacking';
import BackingResults, { useResultsViewed } from './BackingResults';
import BackingDesk, { DESK_SECTION, deskDefaultSection, deskSections } from './BackingDesk';
import { BACKING_EVENT, dwellSince, emitBackingEvent } from '../../../services/backingTelemetry';
import { POD_LIST, SCREEN, screenStateLine } from './backingCopy';
import { backingWeekKeys, deriveStripState } from './backingStripState';
import { announceStakePlaced } from './backingStakeSignal';

/** The shortest card visit worth a record — one frame; below it is StrictMode's mount-time cleanup, not a person. */
const MIN_DWELL_MS = 16;

/** No weeks — a stable empty list for the results hook while the section is not on screen. */
const NO_WEEKS = Object.freeze([]);

/**
 * The desktop screen's own reads: the results, on OPEN — as the mobile screen
 * reads them (its results block heads the list): the reader is the
 * settle-on-read retry for a completed pod whose Friday settlement failed, so
 * its cadence is the mobile build's, never the tab's (WIRE-1, the desktop
 * review record) — while `results_viewed` fires only once the results are ON
 * SCREEN; the private record, only while the results section is open (a pure
 * read, lazy like the tab it is); and the window's own stakes for the rail —
 * the strip's derivation over the pod list alone. Everything else arrives
 * from BackingScreenLive, shared with mobile.
 */
function BackingDeskLive(props) {
  const { uid, pods, section } = props;
  const resultsShown = section === DESK_SECTION.RESULTS;
  const results = useBackingResults({ limit: 1, enabled: Boolean(uid) });
  const myStats = useMyBackingStats(resultsShown && Boolean(uid));
  useResultsViewed(resultsShown ? results.weeks : NO_WEEKS);
  const windowState = useMemo(() => deriveStripState({
    pods: pods.pods, inPlay: null, now: new Date(), backingWeekCloses: pods.data?.backingWeekCloses ?? null,
  }), [pods.pods, pods.data]);
  return <BackingDesk {...props} windowState={windowState} results={results} myStats={myStats} />;
}

// The header says what the strip says — one mapping (screenStateLine, the
// copy module's; R-B-1). The desktop layout's headers read the same line.
const headerLine = screenStateLine;

function TopBar({ label, onBack, accent, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <button type="button" className="lg-tap" data-backing="screen-back" onClick={onBack} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
        <LIcon name="arrowL" size={17} color={LTOKENS.ink2} />
        <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</Mono>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <Eyebrow color={accent}>{SCREEN.eyebrow}</Eyebrow>
      </div>
    </div>
  );
}

function BackingScreenLive({ uid, accent, viewport, onBack, onOpenTape, initialSection }) {
  const pods = useBackingPods(true);
  const upcomingWeek = pods.data?.baseLayerWeek ?? null;
  // Both weeks — see BackingLandingStrip (DOM-1); read each render (DOM-NOTE-5).
  const inPlay = useMyBacking(uid, backingWeekKeys(new Date(), upcomingWeek), Boolean(uid));
  // The wallet document the list names (a smoke session's `dev-{uid}`), else the viewer's own.
  const wallet = useBackingWallet(uid, upcomingWeek, Boolean(uid), pods.data?.walletId ?? null);
  const eligibility = useEligibility(uid, Boolean(uid));
  const myPitch = useMyPitch(uid, Boolean(uid));
  const [view, setView] = useState({ kind: 'list', groupId: null, odUserId: null });
  const cardQuery = useTeamCard(view.groupId, view.odUserId, view.kind !== 'list');
  // Desktop only: the section asked for — the strip's own (the section its
  // state points to, or the window for "Back a team") and then the viewer's
  // tabs. Null — the one the state points to.
  const [deskSection, setDeskSection] = useState(initialSection ?? null);

  const state = useMemo(() => deriveStripState({
    pods: pods.pods, inPlay, now: new Date(), backingWeekCloses: pods.data?.backingWeekCloses ?? null,
  }), [pods.pods, pods.data, inPlay]);

  const pod = view.groupId ? pods.pods.find((p) => p.groupId === view.groupId) ?? null : null;
  const desktop = viewport === 'desktop';
  const inPlayPods = backedPodsFor(inPlay);
  const inPlayWeek = inPlayPods.flatMap((p) => p.stakes).find((s) => typeof s?.weekKey === 'string')?.weekKey ?? null;
  // Desktop: the open section — the one asked for while it is offered, AND
  // while the reads that would offer it are still arriving (the viewer's stake
  // snapshot, each backed pod's pool): the screen opens on the section the
  // strip pointed to and stays there as the snapshots land, rather than
  // opening on the window and jumping (WIRE-2, the desktop review record).
  // Else the one the state points to.
  const sections = deskSections(inPlayPods.length);
  const inPlayArriving = inPlay.loading === true
    || (Array.isArray(inPlay.stakes) && inPlay.stakes.some((st) => typeof st?.groupId === 'string' && !(st.groupId in (inPlay.poolsById ?? {}))));
  const section = desktop
    ? (deskSection != null && (sections.includes(deskSection) || inPlayArriving) ? deskSection : deskDefaultSection(state, inPlayPods.length))
    : null;
  // What is ON SCREEN. Mobile: the list view shows the pods and Your Backing
  // together. Desktop: the pods are the window section's; Your Backing the week's.
  const listShown = desktop ? section === DESK_SECTION.WINDOW : view.kind === 'list';
  const yourBackingShown = desktop ? section === DESK_SECTION.WEEK : view.kind === 'list';

  // THE FUNNEL (§10) — fire-and-forget, deduplicated per session by the
  // emitter, so a re-render or a back-and-forth records nothing twice.
  // window_viewed: the list, once the pod list has answered (its week key).
  useEffect(() => {
    if (!listShown || !pods.data) return;
    emitBackingEvent(BACKING_EVENT.WINDOW_VIEWED, { props: typeof upcomingWeek === 'string' ? { weekKey: upcomingWeek } : {} });
  }, [listShown, pods.data, upcomingWeek]);
  // your_backing_viewed: the list, while Your Backing has a pod to show.
  useEffect(() => {
    if (!yourBackingShown || inPlayPods.length === 0) return;
    emitBackingEvent(BACKING_EVENT.YOUR_BACKING_VIEWED, { props: inPlayWeek ? { weekKey: inPlayWeek } : {} });
  }, [yourBackingShown, inPlayPods.length, inPlayWeek]);
  // team_card_opened: recorded on LEAVING the card (to the list, the control
  // or a closed screen), with the dwell — the one event whose prop needs the
  // whole visit. A dwell under one frame is not a visit: the DEV build's
  // root StrictMode runs setup → cleanup → setup at mount, and that mount-time
  // cleanup would otherwise record a 0 ms dwell and, through the per-session
  // dedup, swallow the real one (WIRE-4, the PR 5 review record). A human
  // cannot leave a card in 16 ms, so no production visit is lost.
  //
  // The visit is keyed on its seat, not on the view object, so re-selecting
  // the open seat is not a new visit (WIRE-3(a), the desktop review record).
  // It ends where this event's contract says, on both viewports: leaving the
  // card for the list or the control, or the screen closing — on desktop also
  // the window section closing (the card lives there). The desktop card stays
  // in view beside the control, but the visit is the reading before "Back",
  // as on mobile (WIRE-3(b) refuted: one meaning for the dwell).
  const cardSeat = (!desktop || section === DESK_SECTION.WINDOW) && view.kind === 'card' && view.groupId && view.odUserId
    ? `${view.groupId}\n${view.odUserId}`
    : null;
  useEffect(() => {
    if (!cardSeat) return undefined;
    const [groupId, odUserId] = cardSeat.split('\n');
    const startedAt = Date.now();
    return () => {
      const dwellMs = dwellSince(startedAt);
      if (dwellMs < MIN_DWELL_MS) return;
      emitBackingEvent(BACKING_EVENT.TEAM_CARD_OPENED, { groupId, odUserId, props: { dwellMs } });
    };
  }, [cardSeat]);
  // stake_control_opened: on entering the control for a seat.
  useEffect(() => {
    if (view.kind !== 'stake' || !view.groupId || !view.odUserId) return;
    emitBackingEvent(BACKING_EVENT.STAKE_CONTROL_OPENED, { groupId: view.groupId, odUserId: view.odUserId });
  }, [view]);

  const toList = () => setView({ kind: 'list', groupId: null, odUserId: null });
  const toCard = () => setView((v) => ({ ...v, kind: 'card' }));
  // A stake the server confirmed — the stake control calls this on the stake
  // route's success reply only: this screen's pod list re-reads the ledger,
  // and the landing strip — still mounted behind the desktop host — hears of
  // it and re-reads its own (PRE-1, the desktop review record).
  const onBacked = (reply) => { pods.refresh(); announceStakePlaced(reply); };
  // Desktop: the card lives in the window section — leaving it by ANY route
  // (a tab, or the section falling back as the data moves) closes the card,
  // so the window never comes back to a stale one (WIRE-2).
  useEffect(() => {
    if (!desktop || section === DESK_SECTION.WINDOW) return;
    setView((v) => (v.kind === 'list' ? v : { kind: 'list', groupId: null, odUserId: null }));
  }, [desktop, section]);

  if (desktop) {
    // Leaving the window section ends a card visit (team_card_opened records on leaving the card).
    const onSection = (next) => {
      setDeskSection(next);
      if (next !== DESK_SECTION.WINDOW && view.kind !== 'list') toList();
    };
    return (
      <BackingDeskLive
        accent={accent}
        uid={uid}
        pods={pods}
        state={state}
        inPlay={inPlay}
        wallet={wallet}
        eligibility={eligibility}
        myPitch={myPitch}
        view={view}
        cardQuery={cardQuery}
        pod={pod}
        section={section}
        sections={sections}
        onSection={onSection}
        onBack={onBack}
        onOpenSeat={(groupId, odUserId) => setView((v) => (v.kind === 'card' && v.groupId === groupId && v.odUserId === odUserId ? v : { kind: 'card', groupId, odUserId }))}
        onToStake={() => setView((v) => ({ ...v, kind: 'stake' }))}
        onToCard={toCard}
        onBacked={onBacked}
        onOpenTape={onOpenTape}
      />
    );
  }

  return (
    <div data-backing="screen" data-view={view.kind} style={{ position: 'relative', padding: '16px 18px calc(env(safe-area-inset-bottom, 0px) + 120px)', maxWidth: 720, margin: '0 auto', color: LTOKENS.ink }}>
      {view.kind === 'list' && (
        <>
          <TopBar label={SCREEN.back} onBack={onBack} accent={accent} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{SCREEN.title}</div>
            <MonoAttr data-backing="screen-state" style={{ display: 'block', marginTop: 7, fontSize: 10.5, color: LTOKENS.ink2 }}>{pods.loading && !pods.data ? SCREEN.loading : headerLine(state)}</MonoAttr>
          </div>

          <BackingResults uid={uid} accent={accent} onOpenTape={onOpenTape} />
          <YourBacking inPlay={inPlay} accent={accent} onOpenTape={onOpenTape} />

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{POD_LIST.sub}</div>
              </div>
              {uid && <PointsMeter left={wallet.left} total={wallet.total} compact />}
            </div>
            <SealRule compact />
            {pods.error && !pods.data
              ? <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.unavailable}</div>
              : <PodList pods={pods.pods} accent={accent} onOpenSeat={(p, team) => setView({ kind: 'card', groupId: p.groupId, odUserId: team.odUserId })} />}
          </div>

          <div style={{ marginTop: 22, padding: '11px 13px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{SCREEN.fineprintLabel}</Mono>
            <div data-backing="fine-print" style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>{FINE_PRINT}</div>
          </div>
        </>
      )}

      {view.kind === 'card' && (
        <>
          <TopBar label={SCREEN.allPods} onBack={toList} accent={accent} />
          {cardQuery.loading && <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{SCREEN.loading}</Mono>}
          {!cardQuery.loading && !cardQuery.card && <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.cardUnavailable}</div>}
          {cardQuery.card && (
            <TeamCard
              card={cardQuery.card}
              pod={pod}
              accent={accent}
              onBack={() => setView((v) => ({ ...v, kind: 'stake' }))}
              onOpenTape={onOpenTape}
              myPitch={cardQuery.card.seat.isViewer ? myPitch : null}
            />
          )}
        </>
      )}

      {view.kind === 'stake' && cardQuery.card && (
        <>
          <TopBar label={SCREEN.toCard} onBack={toCard} accent={accent} />
          <div style={{ borderRadius: 18, padding: '14px 15px', background: `linear-gradient(165deg, ${alpha(accent, 0.06)}, ${LTOKENS.surface} 58%)`, border: `1px solid ${alpha(accent, 0.26)}` }}>
            <StakeControl
              card={cardQuery.card}
              pod={pod}
              wallet={wallet}
              eligibility={eligibility}
              accent={accent}
              onBacked={onBacked}
              onClose={toCard}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Icon name="lock" size={11} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{SCREEN.sealRule}</Mono>
          </div>
        </>
      )}
    </div>
  );
}

/** The screen. Renders nothing — and runs nothing — while the flag is dark. */
export default function BackingScreen({ uid, accent = LX.energy, viewport = 'mobile', onBack, onOpenTape, initialSection = null }) {
  const lit = useBackingLit();
  if (!lit) return null;
  return <BackingScreenLive uid={uid} accent={accent} viewport={viewport} onBack={onBack} onOpenTape={onOpenTape} initialSection={initialSection} />;
}
