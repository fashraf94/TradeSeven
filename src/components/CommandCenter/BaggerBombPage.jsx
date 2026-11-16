// src/components/CommandCenter/BaggerBombPage.jsx
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — the BaggerBomb page, version 1. With
// LEAGUE_HIDE_ENABLED on, App's 'league' route renders this in place of LeagueScreen, so the nav slot, the "back" target
// after a training battle (unreachable with the flag on) and every other setter of that screen id land here. Four parts and
// nothing else:
//
//   1. Deploy        the hub's own press-and-hold card (DeploySection), wired through the deploy provider App already
//                    mounts around every screen (hub/useHubDeploy.js): the same control, the same admission table, the
//                    same ceremony, and the card's own lines, with its "Next deploy carries …" line and its door to the Loadout
//                    tab. NOT on this card: the hub's connected-only extras — "Deploying with" (the idea line), the Huddle's
//                    reconfirm line and the Scouting Board link — which need the hub's runtime (a founder question).
//   2. Live game     the live BaggerBomb rows, each with "Open game" (App's handleOpenAgentBattle, through the hub's reader).
//   3. Finished      the hub's completed window and its History sheet, league rows excluded.
//   4. Record        wins, losses and games played from the agent's stored stats (the hub's own agent read).
//
// WHY IT LIVES HERE. commandCenterHub.mount.guard.test.js keeps the hub's modules out of the main chunk: App may reach this
// directory only through a short permitted list. This page needs the hub's readers, sections and sheet, so it is housed in
// the directory and App loads it lazily (one more permitted entry, a deliberate change recorded in the build report) rather
// than the hub's modules being pulled out into shared code. The League-only pieces the hub carries are not shown here: the
// loadout scope IS mounted (the Deploy card's loadout line reads it) but, with the league hidden, it hands the League lock
// read no owner, so that read subscribes to nothing; the League card is never rendered; and the games section is filtered
// before anything reads it (baggerBombPageModel.js).
//
// What it deliberately is NOT: no mode picker, no length picker, no dollars (those arrive with trader v1); no new
// endpoint and no new query shape (every read is the hub's); no new colour (hub/hubStyle.js maps the --ft-* tokens). The
// layout is one plain column of sections, kept simple to restyle: a design round replaces it later.
//
// No effect, timer or listener lives in this file; every hook it calls is the hub's own.

import React, { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useDeployAttempt } from '../../contexts/DeployAttemptContext';
import { DISPLAY_ACTIONS } from './hub/deployDisplay';
import { HUB_COMPOSITIONS, HUB_SITES } from './hub/composition';
import { HubOverlayProvider, useHubModalOpen } from './hub/HubOverlays';
import { HUB_DEPLOY_CONTROLS, useHubDeploy } from './hub/useHubDeploy';
import { HUB_SHEETS } from './hub/useHubSheets';
import useHubReaders from './hub/useHubReaders';
import useHubResearch from './hub/useHubResearch';
import { useHubRuntime } from './hub/useHubRuntime';
import { hubFlags } from './hub/hubFlags';
import { huddleMemberOf, needsReconfirmOf } from './hub/huddleView';
import { DRB_HUDDLE_ENABLED } from '../../config/huddleFlags';
import useHuddleToday from '../../hooks/useHuddleToday';
import useHuddleHistory from '../../hooks/useHuddleHistory';
import HuddleSheet from './HuddleSheet';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR, HUB_LAYERS, HUB_SCOPED_CSS } from './hub/hubStyle';
import { EmptyNote, Eyebrow, HubButton, HubLayoutContext, HubLink, LoadingLine, Mono, Section, Card } from './HubParts';
import DeploySection from './sections/DeploySection';
import { GameRow, GamesLiveNote, GamesLoadingLine, GamesReadNote, gamesNoteDue } from './sections/GamesSection';
import HistorySheet from './HistorySheet';
import PerGameLoadoutScope from './PerGameLoadoutScope';
import { BAGGERBOMB_PAGE_COPY as PAGE } from '../../constants/baggerBombPageCopy';
import { RECORD_STATUS, baggerBombGames, baggerBombRecord, careerOf, liveBaggerBombRows, pageFinished } from './baggerBombPageModel';

const rootStyle = { position: 'relative', zIndex: HUB_LAYERS.page, color: C.ink, outline: 'none', minHeight: '100dvh' };

/** One stat of the record: a number and its word. */
function Stat({ value, label, id }) {
  return (
    <div data-bb-record-stat={id} style={{ flex: '1 1 0', minWidth: 0 }}>
      <Mono style={{ display: 'block', fontSize: 26, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>{value}</Mono>
      <span style={{ display: 'block', fontSize: 12.5, color: C.ink3, marginTop: 4 }}>{label}</span>
    </div>
  );
}

/** Part 4: the agent's record, from its stored stats. */
function RecordSection({ record }) {
  const ready = record.status === RECORD_STATUS.READY;
  return (
    <Section label={PAGE.record.label} data-bb-part="record">
      <Card data-bb-record={record.status}>
        {ready ? (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <Stat id="wins" value={record.wins} label={PAGE.record.wins} />
              <Stat id="losses" value={record.losses} label={PAGE.record.losses} />
              {record.draws !== null && <Stat id="draws" value={record.draws} label={PAGE.record.draws} />}
              {record.gamesPlayed !== null && <Stat id="gamesPlayed" value={record.gamesPlayed} label={PAGE.record.gamesPlayed} />}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${HAIR}`, fontSize: 12.5, color: C.ink3 }}>{PAGE.record.caption}</div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.ink2 }}>
            {record.status === RECORD_STATUS.LOADING ? PAGE.record.loading : PAGE.record.unavailable}
          </div>
        )}
      </Card>
    </Section>
  );
}

/** Part 2: the live BaggerBomb game, with Open game. */
function LiveSection({ games, onOpenGame }) {
  const rows = liveBaggerBombRows(games);
  return (
    <Section label={PAGE.live.label} data-bb-part="live">
      {/* The hub's own rule (GamesSection, T0R-2): an unanswered live poll is "checking", never "none" — whatever the
          finished window has read. `liveResolved` is the readers' word that the poll answered for this owner. */}
      {rows.length === 0 && games?.liveResolved !== true && <LoadingLine>{COPY.games.loading}</LoadingLine>}
      {/* The poll's age after a failed run, with or without a live row: the Deploy card says it too (BUILD_RULES §9). */}
      {games?.liveResolved === true && <GamesLiveNote games={games} />}
      {rows.length === 0 && games?.liveResolved === true && (
        <EmptyNote icon="sword" title={PAGE.live.none} sub={PAGE.live.noneSub} />
      )}
      {rows.map((game) => (
        <div key={game.id} data-bb-live={game.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GameRow game={game} onOpen={onOpenGame} />
          <HubButton kind="accent" full onPress={onOpenGame ? () => onOpenGame(game) : undefined}>{PAGE.live.openGame}</HubButton>
        </div>
      ))}
    </Section>
  );
}

/** Part 3: the finished BaggerBomb games, the hub's window; History is the hub's sheet. */
function FinishedSection({ games, allGames, onOpenGame, onOpenTape, onRetry, onOpenHistory }) {
  const ready = games?.status === 'ready';
  const { shown, more, otherKind } = pageFinished(games, allGames);
  return (
    <Section
      label={PAGE.finished.label}
      data-bb-part="finished"
      right={ready && more && onOpenHistory ? <HubLink onPress={onOpenHistory}>{PAGE.finished.history}</HubLink> : null}
    >
      {games?.status !== 'ready' && games?.status !== 'error' && <GamesLoadingLine games={games} />}
      {gamesNoteDue(games) && <GamesReadNote games={games} onRetry={onRetry} />}
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map((game) => <GameRow key={game.id} game={game} onOpen={onOpenGame} onOpenTape={onOpenTape} />)}
        </div>
      )}
      {ready && games.stale !== true && shown.length === 0 && (otherKind > 0
        ? <EmptyNote icon="sword" title={PAGE.finished.emptyRecent} sub={PAGE.finished.emptyRecentSub} />
        : <EmptyNote icon="sword" title={PAGE.finished.empty} sub={PAGE.finished.emptySub} />)}
    </Section>
  );
}

function ConnectedPage({ site, hub, onOpenLoadout }) {
  const deployAttempt = useDeployAttempt();
  const modalOpen = useHubModalOpen();
  const readers = useHubReaders(hub, deployAttempt, modalOpen);
  const deploy = useHubDeploy({ deployAttempt, readers, hub });
  const rootRef = useRef(null);
  const auth = readers.inputs?.auth ?? null;
  // The hub's own idea reader and runtime, as ConnectedHub / PhoneHub call them: the runtime derives the Deploy card's
  // "Deploying with" idea line from the idea read and the Loadout's list, and holds the one open sheet (hub/useHubSheets.js).
  const research = useHubResearch({ auth, listId: readers.agent?.agent?.equippedWatchlistId ?? null, gateOn: hubFlags().hypothesisRecordsOn });
  const runtime = useHubRuntime({ hub, agentRead: readers.agent, sections: readers.sections, rootRef, researchRead: research });
  const sheets = runtime.sheets;
  const deployingWith = runtime.sections.deployingWith ?? null;
  // The Huddle's Reconfirm line (Huddle C §C15; Amendment E §E1, §E7), through the hub's own readers and rule: only a player the
  // readers show inside the cohort has a `huddle`; the line and its door exist only while an archetype in play has no
  // confirmation, and the door opens the Huddle sheet (this page mounts it below). Nothing blocks or delays a deploy.
  const huddleToday = useHuddleToday({ auth, enabled: DRB_HUDDLE_ENABLED });
  const huddleHistory = useHuddleHistory({ auth, enabled: DRB_HUDDLE_ENABLED && huddleToday.read.status === 'ready' });
  let huddle = null;
  let reconfirm = null;
  if (DRB_HUDDLE_ENABLED && huddleMemberOf(huddleToday.read, huddleHistory.read)) {
    const needsReconfirm = needsReconfirmOf(huddleToday.read, Date.now());
    huddle = {
      read: huddleToday.read,
      refresh: huddleToday.refresh,
      retry: () => { huddleToday.refresh(); huddleHistory.refresh(); },
      confirm: async (args) => { const r = await huddleToday.confirm(args); huddleHistory.refresh(); return r; },
      skip: async () => { const r = await huddleToday.skip(); huddleHistory.refresh(); return r; },
      needsReconfirm,
      focusPlan: needsReconfirm,
    };
    if (needsReconfirm) {
      const openSheet = sheets.open(HUB_SHEETS.HUDDLE);
      reconfirm = { onReconfirm: (event) => { huddleToday.refresh(); openSheet(event); } };
    }
  }
  // Membership lapsing while the Huddle sheet is open frees the slot, so a later answer never reopens it without a tap (HU-4).
  if (DRB_HUDDLE_ENABLED && !huddle && sheets.sheet === HUB_SHEETS.HUDDLE) runtime.closeSheet();
  const reducedMotion = Boolean(useReducedMotion());
  const phone = site === HUB_SITES.MOBILE;
  const composition = phone ? HUB_COMPOSITIONS.PHONE : HUB_COMPOSITIONS.DESKTOP;

  // The league's rows come out before anything reads the section: the live part, the finished part and the history sheet
  // all see the same league-free section (BUILD_RULES §9).
  const allGames = readers.sections.games;
  const games = baggerBombGames(allGames);
  const record = baggerBombRecord(readers.agent);

  // The deploy card, as the hub's ConnectedHub wires it (CommandCenterHub.jsx): the provider's recovered read joins the
  // state when it is for this attempt, and the card's one action runs through the attempt unless it is a read's Retry.
  let deploySection = readers.sections.deploy;
  let onDeployAction = readers.actions.deployAction;
  if (deploy) {
    const existingRead = deploy.existingRead && deploy.existingRead.attemptId === readers.inputs.attempt?.attemptId ? deploy.existingRead : null;
    deploySection = existingRead ? { ...readers.sections.deploy, existingRead } : readers.sections.deploy;
    onDeployAction = (kind) => (kind === DISPLAY_ACTIONS.RETRY_READ ? readers.actions.deployAction(kind) : deploy.attemptAction(kind));
  }

  const { openGame, openTape, retryGames, refreshHistory } = readers.actions;
  return (
    // The loadout scope is here for ONE reason: the Deploy card's "Next deploy carries …" line reads it (the hub's own card
    // shows it). With the league hidden the scope hands the League lock read no owner (PerGameLoadoutScope.jsx), so it asks
    // the lock for nothing; and the League card is never rendered on this page.
    <PerGameLoadoutScope agentRead={readers.agent} activeBattles={hub?.activeBattles ?? null}>
    <HubLayoutContext.Provider value={composition}>
      <style data-hub-css="">{HUB_SCOPED_CSS}</style>
      <section
        ref={rootRef}
        aria-label={PAGE.region}
        // The hub's own root marker: the scoped box model and focus ring (hub/hubStyle.js), the overlay stack's focus
        // fallback and the deploy ceremony's return focus all find the hub by it. Without it this page is content-box.
        data-hub="shell"
        data-bb-page=""
        data-bb-site={site}
        tabIndex={-1}
        style={{
          ...rootStyle,
          // Clear the phone's bottom nav (64 px and the safe area) so the last part is never behind it.
          padding: phone ? '16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 24px)' : '28px 28px 40px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <header data-bb-part="title">
            <Eyebrow>{PAGE.eyebrow}</Eyebrow>
            <h1 style={{ margin: '6px 0 0', fontSize: phone ? 22 : 26, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{PAGE.title}</h1>
          </header>
          <DeploySection
            deploy={deploySection}
            onOpenLoadout={onOpenLoadout}
            idea={deployingWith}
            reconfirm={reconfirm}
            onAction={onDeployAction}
            holdWiring={deploy?.hold(HUB_DEPLOY_CONTROLS.CARD) ?? null}
            holding={deploy?.holdControlId === HUB_DEPLOY_CONTROLS.CARD ? deploy.holdPhase : null}
          />
          <LiveSection games={games} onOpenGame={openGame} />
          <FinishedSection
            games={games}
            allGames={allGames}
            onOpenGame={openGame}
            onOpenTape={openTape}
            onRetry={retryGames}
            onOpenHistory={sheets.open(HUB_SHEETS.HISTORY)}
          />
          <RecordSection record={record} />
        </div>
      </section>
      {DRB_HUDDLE_ENABLED && huddle && sheets.sheet === HUB_SHEETS.HUDDLE ? (
        <HuddleSheet huddle={huddle} phone={phone} onClose={runtime.closeSheet} opener={sheets.opener} fallbackFocus={sheets.fallback} reducedMotion={reducedMotion} ceremonyActive={deployAttempt?.snapshot?.overlayOpen === true} />
      ) : null}
      {sheets.sheet === HUB_SHEETS.HISTORY && (
        <HistorySheet
          games={games}
          career={careerOf(record)}
          phone={phone}
          onClose={sheets.close}
          opener={sheets.opener}
          fallbackFocus={sheets.fallback}
          reducedMotion={reducedMotion}
          onOpenGame={openGame}
          onOpenTape={openTape}
          onRetry={retryGames}
          onRefresh={refreshHistory}
        />
      )}
    </HubLayoutContext.Provider>
    </PerGameLoadoutScope>
  );
}

/**
 * @param {'mobile'|'desktop'} props.site  App's own isDesktop branch, as the hub's gate takes it
 * @param {object}             props.hub   App's one hub object (`hubProps`: the active poll's list and metadata, its
 *                                         refresh, openGame, openFilmRoom, …), handed to the hub's readers unread
 * @param {Function}           [props.onOpenLoadout] the Deploy card's "Next deploy carries …" door: App takes the player to
 *                                         the Command Center's Loadout tab (utils/hubEntryIntent.js, which App alone marks)
 */
export default function BaggerBombPage({ site, hub, onOpenLoadout }) {
  const deployAttempt = useDeployAttempt();
  // An overlay opening cancels an uncommitted hold in the same task, as on the hub (spec §10; R2 FR2-4).
  const cancelCharging = deployAttempt ? deployAttempt.api.cancelCharging : null;
  return (
    <HubOverlayProvider onOpen={cancelCharging}>
      {/* Keyed by site, as the hub's shells are: a width flip across 768 px starts from that site's defaults. */}
      <ConnectedPage key={site} site={site} hub={hub} onOpenLoadout={onOpenLoadout} />
    </HubOverlayProvider>
  );
}
