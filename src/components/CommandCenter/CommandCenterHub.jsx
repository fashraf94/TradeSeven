// src/components/CommandCenter/CommandCenterHub.jsx
//
// Command Center hub — the lazily loaded hub module (spec V1.2 §2). Slice S1:
// the approved shell (spec §11.2), built from the design of record
// (docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html) under the
// founder's S1 rulings R-S1-1 … R-S1-5.
//
//   - Composition by the hub's OWN measured width and App's site (ruling
//     R-S1-3; hub/composition.js): Phone on the mobile site; Desktop, Tablet
//     or Stacked on the desktop site. App's navigation stays — the desktop
//     sidebar (the gate already places the hub in its offset) and BottomNav.
//   - Defaults (spec §1): the phone opens on Overview; the wider compositions
//     on the Equipped Archetype area. Crossing App's 768 px split remounts the
//     hub at the other site, so it starts from that site's default; width
//     changes within one site keep the selection (ruling R-S1-5).
//   - Static states only (ruling R-S1-4): every section receives the state for
//     "no result has resolved" (hub/hubModel.js HUB_S1_SECTIONS). Nothing here
//     reads data, sets a timer, fabricates a row or resolves anything. The
//     `sections` prop exists so S3–S6 readers (and, in tests, the layout
//     fixtures) can supply the same shapes. Since slice S2a the deploy state
//     is deriveHubDeployState's, from S2a's unresolved inputs (ruling R-S2A-3).
//   - No background of its own: App's starfield stays behind the hub at both
//     sites; hub surfaces sit on bg-card / bg-agent over it.
//
// Its only subscriptions are the ResizeObservers that measure it (its width,
// the stage connector, and on the phone the strip and BottomNav) and the
// signed-in user from useUser() for the header line. OS reduced motion comes
// from framer-motion's useReducedMotion, the house precedent.
//
// Slice S3 (ruling R-S3-10): given App's `hub` object through the gate, the
// hub is CONNECTED — hub/useHubReaders.js runs the readers (the identity
// source, the owner-tagged agent, App's active poll, the ten-game window and
// its Film Room reviews) and their Games and Deploy sections replace the
// loading ones, with the actions S3 wires (open a game, open a battle tape,
// a read's Retry). Without it — the layout fixtures, the tests — nothing is
// read, as before.
//
// Slice S2b (rulings R-S2b-1 … R-S2b-7): with App's deploy provider above the
// hub (src/contexts/DeployAttemptContext.jsx — at App's root, so an attempt,
// its committed beat and its ceremony outlive the hub), the strip's, the
// Deploy card's and the first-deployment next action's holds are live through
// the provider's hold seam; "See what it's eyeing" opens the shipped Scouting
// Board, whose deploy is a tap through the same admission; a tab or area
// change and any overlay opening cancel an uncommitted hold; the status line
// announces the hold's phases. Without a provider every hold stays inert.
//
// Slice S5 (rulings R-S5-1 … R-S5-9): with the same object the Loadout and
// the career come from the owner's agent document, the entry points open the
// shipped sheets, and every overlay registers with one hub-level stack
// (hub/overlayStack.js). Without it (the S1 fixtures) the hub is the frame it
// always was.
//
// The two met in one object (the S3 merge with S5): App hands no agent. The
// Loadout reads the same owner-tagged read the deploy selector does, which
// ConnectedHub hands the shells as `agentRead` (hub/useHubReaders.js), so a
// failed read is "Agent unavailable · Retry" and a resolved absence is
// "Create your agent first".
//
// Slice S4 (rulings R-S4-1 … R-S4-5): with the same object, Recent activity, the
// next action with its Later, the Daily Regime Brief and History's Refresh come
// from the records those readers already hold (hub/useHubReaders.js), and the
// brief from its existing hook (hub/useHubBrief.js, run by the readers). "All activity · N" opens
// the activity sheet. The first-deployment card's hold is the deploy provider's, as the
// strip's and the Deploy card's are (`holdWiring` / `holding`, slice S2b); the card
// stays while its own hold charges (hub/nextAction.js firstDeploymentOffer).
//
// Slice S6 (rulings R-S6-1 … R-S6-7): the Research panel shows the equipped list's current idea from the existing list reader
// (hub/useHubResearch.js, called in ConnectedHub beside the readers), with the Forge's Lists area as its only action; the same held
// answer decides whether the watchlist card wears the idea-first labels, whether the Deploy card says "Deploying with", which
// honest line the panel carries, and Activity's two idea rows (hub/researchView.js). Nothing is written. The first-deployment card
// stays under an open sheet and through a failed refresh of an empty window (hub/nextAction.js).
//
// Slice S7 (rulings R-S7-1 … R-S7-7): Shadow is ShadowCanvas, moving — ambient by
// default, quickened only while a hub-started deployment is submitting, answering
// with the response bloom to a new area selection (the wide compositions' area
// controls; the phone's tabs are tab switches and never bloom) and to an
// attempt's created terminal, once per attempt. It draws the still instead for
// reduced motion (this file's one `reducedMotion`), with no canvas, and on the
// phone when hub/hubFlags.js PHONE_SHADOW says 'still'. It pauses while the root
// deploy ceremony covers the page (`coverOpen`, the provider's own overlay
// signal). The status line's words are hub/shadowStatus.js's. This file holds no
// effect, timer or listener for any of it: the loop and its cleanup are
// ShadowCanvas's.
//
// One tree for the three wide compositions. Desktop, tablet and stacked are
// one CSS grid whose areas change with the composition; every part keeps its
// place in the React tree (the stage and panel wrappers switch to
// `display: contents` off the desktop; the side parts are keyed children of one
// wrapper, reordered in place). So a width change within the desktop site — a
// resize, browser zoom, a tablet turned — remounts nothing: focus, the Brief's
// open state and (for S2b) a charging hold all survive (S1 review L3-1; ruling
// R-S1-5; spec §5.5 "keep panels mounted while charging").
//
// Nothing imports this module statically. Only CommandCenterHubGate's dynamic
// import reaches it, so it ships in its own chunk and is requested only when
// the gate renders (the hub flag on).

import React, { use, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useUser } from '../../contexts/UserContext';
import { BATTLE_TYPE_BAGGERBOMB } from '../../utils/commandCenterLiveBattles';
import {
  DEFAULT_AREA,
  DEFAULT_PHONE_TAB,
  HUB_AREAS,
  HUB_COMPOSITIONS,
  HUB_SITES,
  PHONE_TABS,
  AREA_FOR_PHONE_TAB,
  DESKTOP_SIDE_ORDER,
  STACKED_ORDER,
  TABLET_SIDE_ORDER,
  TABLET_TOP_ORDER,
  composeHub,
} from './hub/composition';
import { useDeployAttempt } from '../../contexts/DeployAttemptContext';
import { AGENT_FORM_HUB_ENABLED } from '../../config/agentFormFlags';
import ScoutingBoardSheet from '../Dashboard/ScoutingBoardSheet';
import { DISPLAY_ACTIONS, deployDisplay } from './hub/deployDisplay';
import { waitingLineOf } from './hub/gamesDisplay';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { PHONE_SHADOW, hubFlags, scoutingBoardOn } from './hub/hubFlags';
import { HUB_DEPLOY_CONTROLS, useHubDeploy } from './hub/useHubDeploy';
import { formatHubDate, headerName } from './hub/hubDate';
import { DESKTOP_ACTIVITY_LIMIT, HUB_S1_SECTIONS, HUB_S2A_DEPLOY_INPUTS, liveCountsOf, liveGamesOf, splitGames } from './hub/hubModel';
import { HubOverlayProvider, useHubModalOpen } from './hub/HubOverlays';
import { loadoutLineOf } from './hub/loadoutLine';
import { LOADOUT_STATUS } from './hub/selectors/loadout';
import { HUB_SHEETS } from './hub/useHubSheets';
import { useHubRuntime } from './hub/useHubRuntime';
import { deriveHubDeployState } from './hub/selectors/deployState';
import { C, HUB_LAYERS, HUB_SCOPED_CSS } from './hub/hubStyle';
import { shadowTierFor } from './hub/shadowGeometry';
import { liveReadKnown, shadowStatusWords } from './hub/shadowStatus';
import { useHubWidth } from './hub/useHubWidth';
import useHubReaders from './hub/useHubReaders';
import useHubResearch from './hub/useHubResearch';
import { useNavClearance } from './hub/useNavClearance';
import ActivitySheet from './ActivitySheet';
import { areaPanelId, areaTabId } from './AreaControls';
import DeployStrip from './DeployStrip';
import HistorySheet from './HistorySheet';
import HubHeader from './HubHeader';
import { HubLayoutContext } from './HubParts';
import LoadoutSheets, { SHEET_DOCK, accentOf } from './LoadoutSheets';
import AreaPanel from './panels/AreaPanel';
import { PhonePanel, PhoneTabRow } from './PhoneTabs';
import ActivitySection from './sections/ActivitySection';
import BriefSection from './sections/BriefSection';
import DeploySection from './sections/DeploySection';
import GamesSection from './sections/GamesSection';
import NextActionCard from './sections/NextActionCard';
import { HubAgentFormContext } from './HubAgentForm';
import { PhoneStage, ShadowStage } from './ShadowStage';
import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';
import { PhoneArmoryScope, armoryHeroRead } from './Armory';
import { HOLD_PHASES } from './hub/selectors/attemptVocabulary';
// Huddle S1 (Huddle spec Amendment C V1.2 §C4, §C6–C8, §C15; Command Center spec V1.2 Amendment D): the flag as a literal, so
// with it off every Huddle branch below folds away; the two readers (outside this directory, permitted terminals); the pure view.
import { DRB_HUDDLE_ENABLED } from '../../config/huddleFlags';
import useHuddleToday from '../../hooks/useHuddleToday';
import useHuddleHistory from '../../hooks/useHuddleHistory';
import { deriveNextAction, NEXT_ACTION_KINDS } from './hub/nextAction';
import { HUDDLE_KIND, huddleActivityOf, huddleCandidateOf, huddleChipOf, huddleMemberOf, huddlePartnershipOf, huddlePartnershipSummaryOf, needsReconfirmOf } from './hub/huddleView';
import HuddleChip from './HuddleChip';
import HuddleSheet from './HuddleSheet';
// Build A2 (per-game loadouts): the flag on its own line (agentFormFlags.test.js pins the lines above), the scope and its
// context, and the armory's sheet context (AR-5: the opener reaches HubSheet). Every read below is a literal ternary.
import { PER_GAME_LOADOUT_ENABLED } from '../../config/perGameLoadoutFlags';
import PerGameLoadoutScope from './PerGameLoadoutScope';
import { PerGameLoadoutContext, scopeDeployLine } from './hub/perGameLoadoutContext';
import { ArmorySheetContext } from './Armory';
import { takeLoadoutEntry } from '../../utils/hubEntryIntent';
// Amendment E V1.1 Part 2 (§1, §3; rulings R-D1 to R-D4): the research door. The mode through hub/hubFlags.js (handed to the
// admission hook, which may not import into this directory); the admission hook and the two readers (outside this directory,
// permitted terminals, each called once in ConnectedHub); the story selector (pure, outside it too); the pure door view; and
// the sheet, whose body loads lazily (hub/loadSharedResearch.js). At 'off' none of them reads or renders anything.
import { sharedResearchMode } from './hub/hubFlags';
import useHubResearchAdmission from '../../hooks/useHubResearchAdmission';
import useHubStories from '../../hooks/useHubStories';
import useHubSharedResearch from '../../hooks/useHubSharedResearch';
import { selectStories } from '../../selectors/storySelection';
import { admissionBattleIdOf, equippedListLabelOf, researchDoorOf, researchRecordsOf, researchSheetHeldBy } from './hub/researchDoorView';
import SharedResearchSheet from './SharedResearchSheet';

/** Shadow's box per composition (the design: 340 desktop, 260 tablet, 200 phone — 196 under 375 px). */
export function shadowSizeFor(composition, width) {
  if (composition === HUB_COMPOSITIONS.PHONE) return typeof width === 'number' && width < 375 ? 196 : 200;
  if (composition === HUB_COMPOSITIONS.DESKTOP) return 340;
  return 260;
}

/**
 * The three area summaries, in area order. Partnership's is the reserved line, or — Huddle S1, only while the hub holds a Huddle
 * Partnership section (DRB_HUDDLE_ENABLED on) — that section's state in one line (Huddle C §C8; Amendment D §D5). The others
 * are loading until their reader resolves.
 */
export function areaSummaries(sections) {
  const of = (section, loading) => (section?.status === 'ready' && section.summary ? section.summary : loading);
  // S5: a resolved absence of the agent is an answer, not a wait; since the S3 merge so is a failed read.
  const status = sections.loadout?.status;
  const loadout = status === LOADOUT_STATUS.NONE ? COPY.loadout.noAgent
    : status === LOADOUT_STATUS.ERROR ? COPY.loadout.agentUnavailable
      : of(sections.loadout, COPY.loadout.summaryLoading);
  // S6: every settled Research state has its own one-line summary (hub/researchView.js deriveResearch); a loading one has none.
  const research = sections.research;
  const researchLine = research && research.status !== 'loading' && typeof research.summary === 'string' && research.summary ? research.summary : COPY.research.summaryLoading;
  const partnership = (sections.huddlePartnership ? huddlePartnershipSummaryOf(sections.huddlePartnership) : null) ?? COPY.partnership.summary;
  return [partnership, researchLine, loadout];
}

const rootStyle = { position: 'relative', zIndex: HUB_LAYERS.page, color: C.ink, outline: 'none' };

/** The phone's sticky tab row (4 + 46 + 1 px) and a little air: the pane's top scroll padding. */
const PHONE_TAB_ROW_CLEARANCE = 56;

function useShared(sections, attemptId = null) {
  const { user } = useUser();
  const reducedMotion = Boolean(useReducedMotion());
  const idBase = `hub${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { completed } = splitGames(sections.games);
  // Slice S3 (R-S3-8): the poll's live rows, whatever the completed window's status.
  const live = liveGamesOf(sections.games);
  const liveCounts = liveCountsOf(sections.games);
  // The strip's game (spec §10): a live BaggerBomb game when there is one — it
  // is what blocks the hold, and Open targets it — else the first live game.
  const liveGame = live.find((g) => g.kind === BATTLE_TYPE_BAGGERBOMB) || live[0] || null;
  // The one waiting phrase (ruling Q-S8F-5): the strip, the Games header and the status line say it.
  const waitingLine = waitingLineOf(live);
  const display = deployDisplay(sections.deploy, liveGame, waitingLine);
  return {
    user,
    reducedMotion,
    idBase,
    completed,
    liveGame,
    waitingLine,
    display,
    // Slice S7 (R-S7-3): Shadow moves only while a hub-started deployment is submitting; otherwise it is ambient.
    // Whether it draws the still instead (reduced motion, no canvas, the phone constant) is ShadowCanvas's call.
    status: display.processing ? 'processing' : 'ambient',
    // The response's second trigger (R-S7-3): an attempt's created terminal — the display word `confirmed`, recovered
    // included — named by its attempt id, so Shadow answers once per attempt. An existing, refused or uncertain
    // terminal is never this.
    createdAttemptId: display.displayState === 'confirmed' && typeof attemptId === 'string' && attemptId ? attemptId : null,
    // Slice S7 (review C-1, C-3): the games that have opened, the games deployed and waiting for the open, and whether the
    // owned live read can be said to be known — the line says what the strip and the Games rows say. Counted once, with
    // the Games header, by hub/hubModel.js liveCountsOf (the S8 review's S8-2 and K-1; ruling R-S8F-7).
    liveCount: liveCounts.opened,
    waitingCount: liveCounts.waiting,
    allEnding: liveCounts.allEnding,
    liveKnown: liveReadKnown(sections.games, sections.deploy),
    summaries: areaSummaries(sections),
    loadoutLine: PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? scopeDeployLine(use(PerGameLoadoutContext)) ?? loadoutLineOf(sections.loadout) : loadoutLineOf(sections.loadout),
    dateText: formatHubDate(new Date()),
    name: headerName(user),
  };
}

/** Slice S7 (ruling R-S7-7): the status line's words, from the hold, the deploy display and the owned live read. */
function statusWordsOf(deploy, shared) {
  return shadowStatusWords({ holdPhase: deploy?.holdPhase ?? null, display: shared.display, liveCount: shared.liveCount, waitingCount: shared.waitingCount, waitingLine: shared.waitingLine, allEnding: shared.allEnding, liveKnown: shared.liveKnown });
}

const SIDE_PARTS = new Set(['games', 'deploy', 'activity', 'brief']);
const sideOf = (order) => order.filter((key) => SIDE_PARTS.has(key));
const rows = (list) => list.map((row) => `"${row}"`).join(' ');

/**
 * The wide compositions' one grid (ruling R-S1-3), from the order constants in
 * hub/composition.js. Desktop: [stage + panel] | [next action over the side
 * column]; the next action's row is `auto` and the side's `1fr`, so the side
 * column starts right under the card whatever the stage's height. Tablet: next
 * action and stage across, then [panel | side]. Stacked: one column, every part
 * in its own row. Only CSS changes between them.
 */
export function wideGrid(composition, hasNext) {
  if (composition === HUB_COMPOSITIONS.DESKTOP) {
    return {
      body: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', columnGap: 24, rowGap: 22, alignItems: 'start',
        gridTemplateRows: hasNext ? 'auto 1fr' : 'auto',
        gridTemplateAreas: hasNext ? rows(['main next', 'main side']) : rows(['main side']),
      },
      main: { gridArea: 'main', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 },
      side: { gridArea: 'side', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 },
      sideOrder: sideOf(DESKTOP_SIDE_ORDER),
    };
  }
  if (composition === HUB_COMPOSITIONS.TABLET) {
    const top = TABLET_TOP_ORDER.filter((key) => hasNext || key !== 'next').map((key) => `${key} ${key}`);
    return {
      body: {
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start',
        gridTemplateAreas: rows([...top, 'panel side']),
      },
      main: { display: 'contents' },
      side: { gridArea: 'side', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 },
      sideOrder: TABLET_SIDE_ORDER,
    };
  }
  return {
    body: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, alignItems: 'start',
      gridTemplateAreas: rows(STACKED_ORDER.filter((key) => hasNext || key !== 'next')),
    },
    main: { display: 'contents' },
    side: { display: 'contents' },
    sideOrder: sideOf(STACKED_ORDER),
  };
}

/**
 * Slice S2b: what the deploy provider's wiring (hub/useHubDeploy.js) adds to a shell's actions — the next action's
 * hold, and the Scouting Board's entry (ruling R-S2b-7) when its flag is on and the hub is connected.
 */
function deployActionsOf(deploy, sheet, runtime) {
  if (!deploy) return null;
  return {
    nextActionHold: deploy.hold(HUB_DEPLOY_CONTROLS.NEXT_ACTION),
    nextActionHolding: deploy.holdControlId === HUB_DEPLOY_CONTROLS.NEXT_ACTION ? deploy.holdPhase : null,
    openBoard: runtime.live && scoutingBoardOn() ? sheet.open(HUB_SHEETS.SCOUTING) : undefined,
  };
}

/**
 * Huddle S1: the shell actions the Huddle adds — open the sheet (its open refreshes the status: Huddle C §C7), Retry, the Deploy
 * card's Reconfirm door (C15), and the next action's Open and Later (C6). None without a Huddle.
 *
 * The card ConnectedHub shows is derived WITH the Huddle rule; the readers' own actions were built for the card derived
 * without it, and the two can name different games (a game in session is picked among the opened rows only). So the
 * card's Open and Later always act on the card's own candidate (review L3-1): the Huddle's sheet, a game, a review, or
 * the readers' own handler for the first deployment (its hold is the deploy action, R-S4-8).
 */
export function huddleActionsOf(huddle, sheet, nextAction, base = NO_ACTIONS) {
  if (!huddle) return null;
  const openSheet = sheet.open(HUB_SHEETS.HUDDLE);
  const open = (event) => { huddle.refresh(); openSheet(event); };
  const shown = nextAction?.status === 'ready' ? nextAction.candidate ?? null : null;
  let card = {};
  if (shown?.key === HUDDLE_KIND) card = { nextAction: open, laterNextAction: huddle.laterFor(shown.laterKey) };
  else if (shown) {
    const act = shown.key === NEXT_ACTION_KINDS.OPEN_GAME && base.openGame ? () => base.openGame({ id: shown.id })
      : shown.key === NEXT_ACTION_KINDS.REVIEW && base.openTape ? () => base.openTape({ id: shown.id })
        : base.nextAction;
    card = { nextAction: act, laterNextAction: huddle.laterFor(shown.laterKey) ?? base.laterNextAction };
  }
  return {
    openHuddle: open,
    retryHuddle: huddle.retry,
    reconfirmHuddle: huddle.needsReconfirm ? open : undefined,
    ...card,
  };
}

/**
 * Amendment E V1.1 §3.1–§3.3: the shell actions the research door adds — "Work an idea" (the sheet's start view), Continue
 * (the newest open investigation, mode 'session'), the research read's Retry, and Activity's research rows (each opens the sheet
 * on its investigation; a game row opens its game as before). None without a door (outside admission, or at 'off').
 */
export function researchActionsOf(researchDoor, sheet, door, base = NO_ACTIONS) {
  if (!researchDoor) return null;
  // Each entry names the owner and epoch it was opened for (review B3): the sheet is shown only while the door is that owner's.
  const ownerKey = researchDoor.ownerKey ?? null;
  const openSession = (sessionId) => sheet.open(HUB_SHEETS.RESEARCH, { mode: 'session', sessionId, ownerKey });
  const sessionId = door?.progress?.sessionId ?? null;
  return {
    openResearch: sheet.open(HUB_SHEETS.RESEARCH, { mode: 'start', ownerKey }),
    continueResearch: sessionId ? openSession(sessionId) : undefined,
    retryResearchDoor: researchDoor.retry,
    openActivity: (row, event) => {
      if (row?.sessionId) openSession(row.sessionId)(event);
      else if (typeof base.openActivity === 'function') base.openActivity(row);
    },
  };
}

/**
 * Slice S2b (ruling R-S2b-7): the shipped Scouting Board, registered `within` the hub's stack by useHubSheets. Its
 * footer deploy is a tap through the provider's admission, inside its own modal and nowhere else.
 */
function ScoutingBoard({ open, onClose, dock, agent, deploy, board, sections, processing }) {
  return (
    <ScoutingBoardSheet
      open={open}
      onClose={onClose}
      dock={dock}
      agent={agent}
      accent={accentOf(agent)}
      deploying={processing}
      deployDisabled={board?.canStart !== true}
      isLive={sections.deploy?.gateBlocked === true}
      onDeploy={() => deploy.tap(HUB_DEPLOY_CONTROLS.SCOUTING_BOARD, { exemptOverlay: true })}
    />
  );
}

/** The mobile site: header → compact stage → sticky tabs → section, and the strip above BottomNav. */
function PhoneHub({ hub = null, sections: given, actions: wired = NO_ACTIONS, agentRead = null, researchRead = null, deploy = null, board = null, attemptId = null, coverOpen = false, huddle = null, researchDoor = null }) {
  const rootRef = useRef(null);
  const runtime = useHubRuntime({ hub, agentRead, sections: given, rootRef, researchRead });
  const { sections, sheets: sheet } = runtime;
  const shared = useShared(sections, attemptId);
  const stripRef = useRef(null);
  const width = useHubWidth(rootRef);
  const placement = useNavClearance(stripRef);
  // The armory flip's LD-1: a visit the League door started opens on the Loadout tab, once (utils/hubEntryIntent.js).
  const [tab, setTab] = useState(PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? () => (takeLoadoutEntry() ? PHONE_TABS.LOADOUT : DEFAULT_PHONE_TAB) : DEFAULT_PHONE_TAB);
  const composition = HUB_COMPOSITIONS.PHONE;
  const actions = {
    ...wired,
    ...runtime.actions,
    ...deployActionsOf(deploy, sheet, runtime),
    openHistory: shared.completed.length ? sheet.open(HUB_SHEETS.HISTORY) : undefined,
    openAllActivity: sheet.open(HUB_SHEETS.ACTIVITY),
    ...(DRB_HUDDLE_ENABLED ? huddleActionsOf(huddle, sheet, sections.nextAction, wired) : null),
    ...researchActionsOf(researchDoor, sheet, sections.researchDoor, wired),
  };
  // Changing area before commitment cancels the charge (spec §5.5); the panels stay mounted while it charges.
  // Agent form build A1 follow-up (founder ruling N2(d)): the phone armory is part of the page, so the page stays usable,
  // but it steps aside, its preview discarded and nothing equipped (Armory.jsx PhoneArmoryScope), when the player goes
  // elsewhere: a switch to another tab (the Loadout tab, where it opens, is no switch), a deploy starting (a hold charging
  // or committed, whose phases the stage's status line shows, which the open armory folds away; or the strip's Retry),
  // another sheet opening (the hub's one sheet slot takes it) or the hub going away (its state goes with it).
  const selectTab = AGENT_FORM_ARMORY_ENABLED
    ? (next) => { deploy?.cancelCharging(); if (next !== tab && sheet.sheet === HUB_SHEETS.ARCHETYPE) runtime.closeSheet(); setTab(next); }
    : (next) => { deploy?.cancelCharging(); setTab(next); };
  // While this renders, so a hold's first phase closes it: a sheet of this component's own state, set in its own render.
  // The archetype sheet is not registered with the overlay stack while the armory is on (hub/useHubSheets.js), so the
  // close releases nothing outside this component.
  if (AGENT_FORM_ARMORY_ENABLED && (deploy?.holdPhase === HOLD_PHASES.CHARGING || deploy?.holdPhase === HOLD_PHASES.LOCKED) && sheet.sheet === HUB_SHEETS.ARCHETYPE) runtime.closeSheet();
  // Amendment E §E7 (review HU-4): membership lapsing while the Huddle sheet is open (a 404 refresh, an owner change) frees
  // the sheet slot too, so a later 200 never reopens the sheet without a tap. This component's own state, set in its own render.
  if (DRB_HUDDLE_ENABLED && !huddle && sheet.sheet === HUB_SHEETS.HUDDLE) runtime.closeSheet();
  // Amendment E V1.1 §3.2: admission ending while the research sheet is open closes it, as the Huddle's lapse does — and so does an
  // owner or epoch change (review B3: the open investigation is the former owner's).
  if (sheet.sheet === HUB_SHEETS.RESEARCH && !researchSheetHeldBy(researchDoor, sheet.entry)) runtime.closeSheet();
  return (
    <HubLayoutContext.Provider value={composition}>
      <style data-hub-css="">{HUB_SCOPED_CSS}</style>
      <section
        ref={rootRef}
        aria-label={COPY.regionLabel}
        data-hub="shell"
        data-hub-site={HUB_SITES.MOBILE}
        data-hub-composition={composition}
        data-hub-width={width ?? ''}
        data-hub-modal-open={runtime.modalOpen ? '' : undefined}
        tabIndex={-1}
        style={{
          ...rootStyle, height: '100dvh', overflowY: 'auto', overflowX: 'hidden', paddingBottom: placement.scrollClearance,
          // Focus scrolling keeps a focused row clear of the sticky tab row and of the strip and nav (S1 review L3-5).
          scrollPaddingTop: PHONE_TAB_ROW_CLEARANCE, scrollPaddingBottom: placement.scrollClearance,
        }}
      >
        <HubHeader phone dateText={shared.dateText} name={shared.name} onOpenProfile={actions.openProfile} onReportBug={actions.reportBug} onOpenMenu={actions.openMenu} unreadCount={runtime.unreadCount} />
        <div style={{ padding: '10px 14px 12px' }}>
          {AGENT_FORM_ARMORY_ENABLED ? (
            // Agent form build A1 (FD-8): the phone armory opens in the hero's box, so its state wraps the stage. With the
            // armory on, PhoneStage is the armory's stage, which draws the agent form and never ShadowCanvas (the armory is
            // on only while the hub's form is: agentFormFlags.test.js), so ShadowCanvas's tier and still switch go unread.
            <PhoneArmoryScope open={sheet.sheet === HUB_SHEETS.ARCHETYPE} agent={runtime.agent} onClose={runtime.closeSheet} opener={sheet.opener} reducedMotion={shared.reducedMotion} width={width}>
              <PhoneStage
                size={shadowSizeFor(composition, width)}
                status={shared.status}
                processing={shared.display.processing}
                words={statusWordsOf(deploy, shared)}
                selectedArea={AREA_FOR_PHONE_TAB[tab]}
                summaries={shared.summaries}
                reducedMotion={shared.reducedMotion}
                createdAttemptId={shared.createdAttemptId}
                paused={coverOpen}
                holdPhase={deploy?.holdPhase ?? null}
                progress={deploy?.progress ?? null}
              />
            </PhoneArmoryScope>
          ) : (
            <PhoneStage
              size={shadowSizeFor(composition, width)}
              tier={shadowTierFor(composition)}
              status={shared.status}
              processing={shared.display.processing}
              words={statusWordsOf(deploy, shared)}
              selectedArea={AREA_FOR_PHONE_TAB[tab]}
              summaries={shared.summaries}
              reducedMotion={shared.reducedMotion}
              createdAttemptId={shared.createdAttemptId}
              paused={coverOpen}
              stillOnly={PHONE_SHADOW === 'still'}
              holdPhase={deploy?.holdPhase ?? null}
              progress={deploy?.progress ?? null}
            />
          )}
          {DRB_HUDDLE_ENABLED && huddle ? <HuddleChip chip={huddle.chip} onOpen={actions.openHuddle} /> : null}
        </div>
        <PhoneTabRow idBase={shared.idBase} tab={tab} onSelect={selectTab} />
        <div style={{ padding: '14px 14px 24px' }}>
          {PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (
            // Build A2: the panel's loadout surfaces take the shell's committed lists through the scope's context.
            <PerGameLoadoutContext.Provider value={{ ...use(PerGameLoadoutContext), lists: runtime.lists }}>
              <PhonePanel idBase={shared.idBase} tab={tab} sections={sections} actions={actions} reducedMotion={shared.reducedMotion} />
            </PerGameLoadoutContext.Provider>
          ) : (
            <PhonePanel idBase={shared.idBase} tab={tab} sections={sections} actions={actions} reducedMotion={shared.reducedMotion} />
          )}
        </div>
      </section>
      <DeployStrip
        ref={stripRef}
        deploy={sections.deploy}
        liveGame={shared.liveGame}
        waitingLine={shared.waitingLine}
        loadoutLine={shared.loadoutLine}
        placement={placement}
        onOpenLoadout={() => selectTab(PHONE_TABS.LOADOUT)}
        onOpenGame={actions.openGame}
        onAction={AGENT_FORM_ARMORY_ENABLED && actions.deployAction ? (kind) => { if (kind === DISPLAY_ACTIONS.RETRY && sheet.sheet === HUB_SHEETS.ARCHETYPE) runtime.closeSheet(); actions.deployAction(kind); } : actions.deployAction}
        holdWiring={deploy?.hold(HUB_DEPLOY_CONTROLS.STRIP) ?? null}
        holding={deploy?.holdControlId === HUB_DEPLOY_CONTROLS.STRIP ? deploy.holdPhase : null}
      />
      {deploy && runtime.live && scoutingBoardOn() && (
        <ScoutingBoard
          open={sheet.sheet === HUB_SHEETS.SCOUTING}
          onClose={runtime.closeSheet}
          dock={SHEET_DOCK.PHONE}
          agent={runtime.agent}
          deploy={deploy}
          board={board}
          sections={sections}
          processing={shared.display.processing}
        />
      )}
      {sheet.sheet === HUB_SHEETS.HISTORY && (
        <HistorySheet games={sections.games} career={sections.career} phone onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpenGame={actions.openGame} onOpenTape={actions.openTape} onRetry={actions.retryGames} onRefresh={actions.refreshHistory} />
      )}
      {sheet.sheet === HUB_SHEETS.ACTIVITY && (
        <ActivitySheet activity={sections.activity} phone onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpen={actions.openActivity} />
      )}
      {DRB_HUDDLE_ENABLED && huddle && sheet.sheet === HUB_SHEETS.HUDDLE ? (
        <HuddleSheet huddle={huddle} phone onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} ceremonyActive={coverOpen} />
      ) : null}
      {sheet.sheet === HUB_SHEETS.RESEARCH && researchSheetHeldBy(researchDoor, sheet.entry) ? (
        <SharedResearchSheet
          entry={sheet.entry}
          stories={researchDoor.stories}
          agentName={researchDoor.agentName}
          agentId={researchDoor.agentId}
          equippedListLabel={equippedListLabelOf(use(PerGameLoadoutContext), runtime.lists, sections.loadout)}
          gated={researchDoor.gated}
          phone
          onClose={runtime.closeSheet}
          opener={sheet.opener}
          fallbackFocus={sheet.fallback}
          reducedMotion={shared.reducedMotion}
        />
      ) : null}
      {runtime.live && (AGENT_FORM_ARMORY_ENABLED ? (
        <ArmorySheetContext.Provider value={{ opener: sheet.opener, fallbackFocus: sheet.fallback }}>
          <LoadoutSheets
            sheet={sheet.sheet}
            traitsEpoch={sheet.traitsEpoch}
            onClose={runtime.closeSheet}
            dock={SHEET_DOCK.PHONE}
            agent={runtime.agent}
            agentLoading={runtime.agentLoading}
            lists={runtime.lists}
            onOpenForgeLists={actions.openForgeLists}
          />
        </ArmorySheetContext.Provider>
      ) : (
        <LoadoutSheets
          sheet={sheet.sheet}
          traitsEpoch={sheet.traitsEpoch}
          onClose={runtime.closeSheet}
          dock={SHEET_DOCK.PHONE}
          agent={runtime.agent}
          agentLoading={runtime.agentLoading}
          lists={runtime.lists}
          onOpenForgeLists={actions.openForgeLists}
        />
      ))}
    </HubLayoutContext.Provider>
  );
}

/** The desktop site: Desktop, Tablet or Stacked by the hub's own width. */
function WideHub({ hub = null, sections: given, actions: wired = NO_ACTIONS, agentRead = null, researchRead = null, deploy = null, board = null, attemptId = null, coverOpen = false, huddle = null, researchDoor = null }) {
  const rootRef = useRef(null);
  const runtime = useHubRuntime({ hub, agentRead, sections: given, rootRef, researchRead });
  const { sections, sheets: sheet } = runtime;
  const shared = useShared(sections, attemptId);
  const width = useHubWidth(rootRef);
  const composition = composeHub({ site: HUB_SITES.DESKTOP, width });
  // LD-1: desktop already opens on the Loadout area; it takes the door's intent so the intent cannot outlive the visit.
  const [area, setArea] = useState(PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? () => (takeLoadoutEntry() ? HUB_AREAS.ARCHETYPE : DEFAULT_AREA) : DEFAULT_AREA);
  // Slice S7 (R-S7-3): each selection that CHANGED the area is one response for Shadow; re-selecting the current area is none.
  const [areaEvent, setAreaEvent] = useState(0);
  const actions = {
    ...wired,
    ...runtime.actions,
    ...deployActionsOf(deploy, sheet, runtime),
    openHistory: shared.completed.length ? sheet.open(HUB_SHEETS.HISTORY) : undefined,
    openAllActivity: sheet.open(HUB_SHEETS.ACTIVITY),
    ...(DRB_HUDDLE_ENABLED ? huddleActionsOf(huddle, sheet, sections.nextAction, wired) : null),
    ...researchActionsOf(researchDoor, sheet, sections.researchDoor, wired),
  };
  // Changing area before commitment cancels the charge (spec §5.5).
  const selectArea = (next) => { deploy?.cancelCharging(); if (next !== area) setAreaEvent((n) => n + 1); setArea(next); };
  const desktop = composition === HUB_COMPOSITIONS.DESKTOP;
  const tablet = composition === HUB_COMPOSITIONS.TABLET;
  const gutter = desktop ? 28 : tablet ? 24 : 20;

  // Amendment E §E7 (review HU-4): membership lapsing while the Huddle sheet is open (a 404 refresh, an owner change) frees
  // the sheet slot too, so a later 200 never reopens the sheet without a tap. This component's own state, set in its own render.
  if (DRB_HUDDLE_ENABLED && !huddle && sheet.sheet === HUB_SHEETS.HUDDLE) runtime.closeSheet();
  // Amendment E V1.1 §3.2: admission ending while the research sheet is open closes it, as the Huddle's lapse does — and so does an
  // owner or epoch change (review B3: the open investigation is the former owner's).
  if (sheet.sheet === HUB_SHEETS.RESEARCH && !researchSheetHeldBy(researchDoor, sheet.entry)) runtime.closeSheet();
  const stage = (
    <ShadowStage
      composition={composition}
      size={shadowSizeFor(composition, width)}
      tier={shadowTierFor(composition)}
      status={shared.status}
      processing={shared.display.processing}
      words={statusWordsOf(deploy, shared)}
      selectedArea={area}
      onSelectArea={selectArea}
      summaries={shared.summaries}
      idBase={shared.idBase}
      reducedMotion={shared.reducedMotion}
      areaEvent={areaEvent}
      createdAttemptId={shared.createdAttemptId}
      paused={AGENT_FORM_ARMORY_ENABLED ? coverOpen || sheet.sheet === HUB_SHEETS.ARCHETYPE : coverOpen}
      holdPhase={deploy?.holdPhase ?? null}
      progress={deploy?.progress ?? null}
    />
  );
  const panel = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (
    // Build A2: the panel's loadout cards take the shell's committed lists through the scope's context.
    <PerGameLoadoutContext.Provider value={{ ...use(PerGameLoadoutContext), lists: runtime.lists }}>
      <AreaPanel
        area={area}
        panelId={areaPanelId(shared.idBase)}
        tabId={areaTabId(shared.idBase, area)}
        sections={sections}
        actions={actions}
        reducedMotion={shared.reducedMotion}
      />
    </PerGameLoadoutContext.Provider>
  ) : (
    <AreaPanel
      area={area}
      panelId={areaPanelId(shared.idBase)}
      tabId={areaTabId(shared.idBase, area)}
      sections={sections}
      actions={actions}
      reducedMotion={shared.reducedMotion}
    />
  );
  const side = {
    games: <GamesSection games={sections.games} onOpenHistory={actions.openHistory} onOpenGame={actions.openGame} onOpenTape={actions.openTape} onRetry={actions.retryGames} />,
    deploy: PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (
      // Build A2 (board 2): the Deploy card's loadout line counts the book's names from the shell's committed lists.
      <PerGameLoadoutContext.Provider value={{ ...use(PerGameLoadoutContext), lists: runtime.lists }}>
        <DeploySection
          deploy={sections.deploy}
          loadoutLine={shared.loadoutLine}
          onOpenLoadout={() => selectArea(HUB_AREAS.ARCHETYPE)}
          onAction={actions.deployAction}
          holdWiring={deploy?.hold(HUB_DEPLOY_CONTROLS.CARD) ?? null}
          holding={deploy?.holdControlId === HUB_DEPLOY_CONTROLS.CARD ? deploy.holdPhase : null}
          onOpenBoard={actions.openBoard}
          idea={sections.deployingWith ?? null}
          reconfirm={DRB_HUDDLE_ENABLED && actions.reconfirmHuddle ? { onReconfirm: actions.reconfirmHuddle } : null}
        />
      </PerGameLoadoutContext.Provider>
    ) : (
      <DeploySection
        deploy={sections.deploy}
        loadoutLine={shared.loadoutLine}
        onOpenLoadout={() => selectArea(HUB_AREAS.ARCHETYPE)}
        onAction={actions.deployAction}
        holdWiring={deploy?.hold(HUB_DEPLOY_CONTROLS.CARD) ?? null}
        holding={deploy?.holdControlId === HUB_DEPLOY_CONTROLS.CARD ? deploy.holdPhase : null}
        onOpenBoard={actions.openBoard}
        idea={sections.deployingWith ?? null}
        reconfirm={DRB_HUDDLE_ENABLED && actions.reconfirmHuddle ? { onReconfirm: actions.reconfirmHuddle } : null}
      />
    ),
    activity: <ActivitySection activity={sections.activity} limit={DESKTOP_ACTIVITY_LIMIT} onOpen={actions.openActivity} onAll={actions.openAllActivity} />,
    brief: <BriefSection brief={sections.brief} onRetry={actions.retryBrief} />,
  };
  const hasNext = sections.nextAction?.status === 'ready' && Boolean(sections.nextAction.candidate);
  const grid = wideGrid(composition, hasNext);
  const body = (
    <div data-hub-body={composition} style={{ padding: `14px ${gutter}px ${desktop ? 30 : 28}px`, ...grid.body }}>
      <div data-hub-slot="next" style={{ gridArea: 'next', minWidth: 0, display: hasNext ? 'block' : 'none' }}>
        <NextActionCard nextAction={sections.nextAction} deploy={sections.deploy} onAct={actions.nextAction} onLater={actions.laterNextAction} holdWiring={actions.nextActionHold} holding={actions.nextActionHolding} />
      </div>
      <div data-hub-slot="main" style={grid.main}>
        <div data-hub-slot="stage" style={{ gridArea: 'stage', minWidth: 0 }}>{stage}{DRB_HUDDLE_ENABLED && huddle ? <HuddleChip chip={huddle.chip} onOpen={actions.openHuddle} /> : null}</div>
        <div data-hub-slot="panel" style={{ gridArea: 'panel', minWidth: 0 }}>{panel}</div>
      </div>
      <div data-hub-slot="side" style={grid.side}>
        {grid.sideOrder.map((key) => (
          <div key={key} data-hub-slot={key} style={{ gridArea: key, minWidth: 0 }}>{side[key]}</div>
        ))}
      </div>
    </div>
  );

  return (
    <HubLayoutContext.Provider value={composition}>
      <style data-hub-css="">{HUB_SCOPED_CSS}</style>
      <section
        ref={rootRef}
        aria-label={COPY.regionLabel}
        data-hub="shell"
        data-hub-site={HUB_SITES.DESKTOP}
        data-hub-composition={composition}
        data-hub-width={width ?? ''}
        data-hub-modal-open={runtime.modalOpen ? '' : undefined}
        tabIndex={-1}
        style={{ ...rootStyle, minHeight: '100vh', overflowX: 'hidden' }}
      >
        <HubHeader dateText={shared.dateText} name={shared.name} gutter={desktop || tablet ? 28 : gutter} onOpenProfile={actions.openProfile} onReportBug={actions.reportBug} />
        {body}
      </section>
      {sheet.sheet === HUB_SHEETS.HISTORY && (
        <HistorySheet games={sections.games} career={sections.career} onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpenGame={actions.openGame} onOpenTape={actions.openTape} onRetry={actions.retryGames} onRefresh={actions.refreshHistory} />
      )}
      {sheet.sheet === HUB_SHEETS.ACTIVITY && (
        <ActivitySheet activity={sections.activity} onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpen={actions.openActivity} />
      )}
      {DRB_HUDDLE_ENABLED && huddle && sheet.sheet === HUB_SHEETS.HUDDLE ? (
        <HuddleSheet huddle={huddle} onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} ceremonyActive={coverOpen} />
      ) : null}
      {sheet.sheet === HUB_SHEETS.RESEARCH && researchSheetHeldBy(researchDoor, sheet.entry) ? (
        <SharedResearchSheet
          entry={sheet.entry}
          stories={researchDoor.stories}
          agentName={researchDoor.agentName}
          agentId={researchDoor.agentId}
          equippedListLabel={equippedListLabelOf(use(PerGameLoadoutContext), runtime.lists, sections.loadout)}
          gated={researchDoor.gated}
          onClose={runtime.closeSheet}
          opener={sheet.opener}
          fallbackFocus={sheet.fallback}
          reducedMotion={shared.reducedMotion}
        />
      ) : null}
      {runtime.live && (AGENT_FORM_ARMORY_ENABLED ? (
        // A1 carry AR-5: the dialog's HubSheet returns focus to the control that opened it, as the History sheet's does.
        <ArmorySheetContext.Provider value={{ opener: sheet.opener, fallbackFocus: sheet.fallback }}>
          <LoadoutSheets
            sheet={sheet.sheet}
            traitsEpoch={sheet.traitsEpoch}
            onClose={runtime.closeSheet}
            dock={SHEET_DOCK.WIDE}
            agent={runtime.agent}
            agentLoading={runtime.agentLoading}
            lists={runtime.lists}
            onOpenForgeLists={actions.openForgeLists}
          />
        </ArmorySheetContext.Provider>
      ) : (
        <LoadoutSheets
          sheet={sheet.sheet}
          traitsEpoch={sheet.traitsEpoch}
          onClose={runtime.closeSheet}
          dock={SHEET_DOCK.WIDE}
          agent={runtime.agent}
          agentLoading={runtime.agentLoading}
          lists={runtime.lists}
          onOpenForgeLists={actions.openForgeLists}
        />
      ))}
      {deploy && runtime.live && scoutingBoardOn() && (
        <ScoutingBoard
          open={sheet.sheet === HUB_SHEETS.SCOUTING}
          onClose={runtime.closeSheet}
          dock={SHEET_DOCK.WIDE}
          agent={runtime.agent}
          deploy={deploy}
          board={board}
          sections={sections}
          processing={shared.display.processing}
        />
      )}
    </HubLayoutContext.Provider>
  );
}

/**
 * Slice S2a (ruling R-S2A-3): the deploy state is the selector's, never a
 * hand-written value. S2a's inputs have resolved nothing, so it reads
 * `checking` and nothing a user sees changes; S3 and S2b supply real inputs.
 */
const HUB_S2A_DEPLOY = deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS);
const HUB_DEFAULT_SECTIONS = Object.freeze({ ...HUB_S1_SECTIONS, deploy: HUB_S2A_DEPLOY });
/** No action wired: every control a later slice wires renders disabled. */
const NO_ACTIONS = Object.freeze({});

/**
 * Slice S3 (ruling R-S3-10): the hub given App's `hub` object — the readers
 * run (hub/useHubReaders.js) and their Games and Deploy sections replace the
 * loading ones; every other section keeps its own until its slice. The shells
 * get the same object for S5's runtime, and the readers' owner-tagged agent
 * read as `agentRead`: the one agent source for the deploy state and the
 * Loadout (the S3 merge with S5).
 */
//
// Slice S2b (rulings R-S2b-2 … R-S2b-7): with App's deploy provider above it
// (src/contexts/DeployAttemptContext.jsx), the readers' selector also reads the
// provider's attempt, hold, cooldown and overlays with the hub's own sheets,
// and hub/useHubDeploy.js wires the three hold controls, the Scouting Board's
// tap and the attempt's one action. A read's Retry stays S3's. Without a
// provider nothing is wired: the hold is inert, as before.
function ConnectedHub({ site, hub, sections }) {
  const deployAttempt = useDeployAttempt();
  const hubModalOpen = useHubModalOpen();
  const readers = useHubReaders(hub, deployAttempt, hubModalOpen);
  // Slice S6 (ruling R-S6-2): the equipped list's idea, read for this owner and epoch and the agent's equipped list, once per
  // trigger (hub/useHubResearch.js). Called here beside the readers rather than inside them: the readers' own integration suites
  // render them alone, without the Firebase configuration the idea service's auth wrapper loads. Hub chunk only — nothing the
  // root deploy provider imports reaches it.
  const research = useHubResearch({ auth: readers.inputs?.auth ?? null, listId: readers.agent?.agent?.equippedWatchlistId ?? null, gateOn: hubFlags().hypothesisRecordsOn });
  // Huddle S1 (Huddle C §C7; Command Center Amendment D §D4): the two Huddle readers, called here beside the idea reader for the
  // same reason (their one service loads the Firebase configuration the readers' suites render without). Hub chunk only — nothing
  // the root deploy provider imports reaches them. Off, each is idle: no read, no listener.
  const huddleToday = useHuddleToday({ auth: readers.inputs?.auth ?? null, enabled: DRB_HUDDLE_ENABLED });
  // Amendment E §E7 (review HC-5): the history is read only once today's status read has answered 200 — a player outside the
  // cohort gets the status route's 404 ('outside') and so never pays the history query, whose answer could not admit them.
  const huddleHistory = useHuddleHistory({ auth: readers.inputs?.auth ?? null, enabled: DRB_HUDDLE_ENABLED && huddleToday.read.status === 'ready' });
  // Amendment E V1.1 Part 2 (§1; rulings R-D2, R-D4): the research door's admission and its two readers, called here beside the
  // Huddle readers for the same reason (their services load the Firebase configuration the readers' suites render without). The
  // mode is read through hub/hubFlags.js and handed in; at 'allowlist' the verdict is asked with an owned agentBattles id the hub
  // already holds (hub/researchDoorView.js admissionBattleIdOf). At 'off' all three are idle (no request, no read) and
  // `researchDoor` below stays null, so the hub is today's hub.
  const researchAuth = readers.inputs?.auth ?? null;
  const researchAdmission = useHubResearchAdmission({
    mode: sharedResearchMode(),
    auth: researchAuth,
    battleId: admissionBattleIdOf({ live: readers.liveBattles, completed: readers.inputs?.completed ?? null, auth: researchAuth }),
  });
  const hubStories = useHubStories({ auth: researchAuth, enabled: researchAdmission.admitted });
  const sharedResearch = useHubSharedResearch({ auth: researchAuth, enabled: researchAdmission.admitted });
  const deploy = useHubDeploy({ deployAttempt, readers, hub });
  const live = { ...sections, ...readers.sections };
  // Huddle S1: the section, the next action's rule (C6), Partnership (C8), Activity's rows (C8) and the reconfirm line (E1: from
  // the status answer's plan.reconfirm, the server's own acceptance predicate), all pure derivations of the two readers. A
  // literal false folds this away.
  // Amendment E §E7: only for a player the readers show inside the cohort (hub/huddleView.js huddleMemberOf); outside it —
  // and while today's read is still out (or a member with no record today awaits the history) — `huddle` stays null and
  // `live` untouched, so the hub is its flag-off self.
  let huddle = null;
  if (DRB_HUDDLE_ENABLED && huddleMemberOf(huddleToday.read, huddleHistory.read)) {
    const candidate = huddleCandidateOf(huddleToday.read, Date.now());
    if (readers.next) live.nextAction = deriveNextAction({ ...readers.next.inputs, dismissed: readers.next.dismissed, huddle: candidate });
    const reconfirm = needsReconfirmOf(huddleToday.read, Date.now());
    live.huddlePartnership = huddlePartnershipOf(huddleToday.read, huddleHistory.read, { door: reconfirm });
    if (live.activityInputs) live.activityInputs = { ...live.activityInputs, huddle: huddleActivityOf(huddleHistory.read, readers.inputs?.auth?.uid ?? null) };
    huddle = {
      read: huddleToday.read,
      chip: huddleChipOf(huddleToday.read),
      refresh: huddleToday.refresh,
      retry: () => { huddleToday.refresh(); huddleHistory.refresh(); },
      confirm: async (args) => { const r = await huddleToday.confirm(args); huddleHistory.refresh(); return r; },
      skip: async () => { const r = await huddleToday.skip(); huddleHistory.refresh(); return r; },
      needsReconfirm: reconfirm,
      focusPlan: reconfirm,
      laterFor: readers.next ? readers.next.laterFor : () => undefined,
    };
  }
  // Amendment E V1.1 §3: for an admitted player only: the Research panel's door (the open investigation's line, the read's
  // error), Activity's research rows, and what the sheet is handed (the selector's stories, [] until the stories read answers;
  // the ranked agent's given name and id, the one the Loadout card reads and the server stamps). Outside admission none of it
  // exists, and `live` is untouched.
  let researchDoor = null;
  if (researchAdmission.admitted) {
    live.researchDoor = researchDoorOf({ read: sharedResearch.read, nowMs: Date.now() });
    const records = researchRecordsOf(sharedResearch.read);
    if (live.activityInputs && records) live.activityInputs = { ...live.activityInputs, research: records };
    const rankedAgent = readers.agent?.status === 'ready' ? readers.agent.agent : null;
    researchDoor = {
      // The owner and epoch the door is this render's (review B3): a sheet opened for another is closed.
      ownerKey: researchAuth?.signedIn === true ? `${researchAuth.uid}:${researchAuth.authEpoch ?? ''}` : null,
      retry: sharedResearch.refresh,
      stories: selectStories({ stories: hubStories.read.status === 'ready' ? hubStories.read.stories : [], nowMs: Date.now() }).items,
      agentName: typeof rankedAgent?.name === 'string' && rankedAgent.name.trim() ? rankedAgent.name.trim() : null,
      agentId: typeof rankedAgent?.id === 'string' && rankedAgent.id ? rankedAgent.id : null,
      gated: !researchAdmission.admitted,
    };
  }
  let actions = readers.actions;
  let board = null;
  if (deploy) {
    const existingRead = deploy.existingRead && deploy.existingRead.attemptId === readers.inputs.attempt?.attemptId ? deploy.existingRead : null;
    live.deploy = existingRead ? { ...readers.sections.deploy, existingRead } : readers.sections.deploy;
    actions = {
      ...readers.actions,
      deployAction: (kind) => (kind === DISPLAY_ACTIONS.RETRY_READ ? readers.actions.deployAction(kind) : deploy.attemptAction(kind)),
    };
    // The board's own deploy is inside its modal: its start is the table with the board itself not counted (spec §10).
    board = { canStart: deriveHubDeployState({ ...readers.inputs, modalOpen: deployAttempt.snapshot.overlayOpen === true }).canStart === true };
  }
  // Slice S7: the provider's attempt id and whether its ceremony covers the page — Shadow's response and pause (R-S7-3, R-S7-5).
  const attemptId = readers.inputs?.attempt?.attemptId ?? null;
  const coverOpen = deployAttempt?.snapshot?.overlayOpen === true;
  // Agent form build S1: the armored hero reads the same agent read the Loadout shows, through this scope (a prop
  // through the shells would change today's elements; flag-off this ternary folds to the return below it).
  // Agent form build A1 follow-up (founder ruling N1): with the armory on, outside a game Shadow is neutral, so the hero
  // (wide and phone) reads the same agent wearing nothing: bare Shadow whatever its archetype, and Shadow's own label. The
  // Loadout reads `agentRead` itself, so its Archetype card still names the archetype; only the armory's preview dresses.
  // Build A2: with per-game loadouts on (and the armory, which draws them), the shells sit in the loadout scope: the
  // owner's record, the League lock and the live games, for the cards, the lines and the armory's context. The hero
  // stays bare (N1).
  return AGENT_FORM_HUB_ENABLED ? (
    PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (
    <PerGameLoadoutScope agentRead={readers.agent} activeBattles={hub?.activeBattles ?? null}>
      <HubAgentFormContext.Provider value={armoryHeroRead(readers.agent)}>
        {site === HUB_SITES.MOBILE
          ? <PhoneHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />
          : <WideHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />}
      </HubAgentFormContext.Provider>
    </PerGameLoadoutScope>
  ) : (
    <HubAgentFormContext.Provider value={AGENT_FORM_ARMORY_ENABLED ? armoryHeroRead(readers.agent) : readers.agent}>
      {site === HUB_SITES.MOBILE
        ? <PhoneHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />
        : <WideHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />}
    </HubAgentFormContext.Provider>
    )
  ) : site === HUB_SITES.MOBILE
    ? <PhoneHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />
    : <WideHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} researchRead={research} deploy={deploy} board={board} attemptId={attemptId} coverOpen={coverOpen} huddle={huddle} researchDoor={researchDoor} />;
}

/**
 * @param {'mobile'|'desktop'} props.site     App's pick, through the gate (ruling R-S1-3)
 * @param {object}             [props.hub]    App's data and actions in one object, through the gate
 *   (rulings R-S3-10, R-S5-9; hub/useHubReaders.js and hub/useHubRuntime.js read its keys): with it the
 *   readers run; absent, the sections below are all the hub knows (the S1 frames and their fixtures)
 * @param {object}             [props.sections] the section props (hub/hubModel.js): the loading
 *   state, with the selector's deploy state; a sections prop without `deploy` takes that one too
 */
export default function CommandCenterHub({ site, hub = null, sections = HUB_DEFAULT_SECTIONS }) {
  const resolved = sections.deploy ? sections : { ...sections, deploy: HUB_S2A_DEPLOY };
  const connected = Boolean(hub) && typeof hub === 'object';
  // Slice S2b: an overlay opening cancels an uncommitted hub hold in the same task (spec §10; R2 FR2-4).
  const deployAttempt = useDeployAttempt();
  const cancelCharging = connected && deployAttempt ? deployAttempt.api.cancelCharging : null;
  // Keyed by site: a hub handed the other site starts from that site's defaults (ruling R-S1-5).
  return (
    <HubOverlayProvider onOpen={cancelCharging}>
      {connected
        ? <ConnectedHub key={site} site={site} hub={hub} sections={resolved} />
        : site === HUB_SITES.MOBILE
          ? <PhoneHub key={HUB_SITES.MOBILE} sections={resolved} />
          : <WideHub key={HUB_SITES.DESKTOP} sections={resolved} />}
    </HubOverlayProvider>
  );
}
