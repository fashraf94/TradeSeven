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

import React, { useId, useRef, useState } from 'react';
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
import ScoutingBoardSheet from '../Dashboard/ScoutingBoardSheet';
import { DISPLAY_ACTIONS, deployDisplay } from './hub/deployDisplay';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { scoutingBoardOn } from './hub/hubFlags';
import { HUB_DEPLOY_CONTROLS, useHubDeploy } from './hub/useHubDeploy';
import { formatHubDate, headerName } from './hub/hubDate';
import { HUB_S1_SECTIONS, HUB_S2A_DEPLOY_INPUTS, liveGamesOf, splitGames } from './hub/hubModel';
import { HubOverlayProvider, useHubModalOpen } from './hub/HubOverlays';
import { loadoutLineOf } from './hub/loadoutLine';
import { LOADOUT_STATUS } from './hub/selectors/loadout';
import { HUB_SHEETS } from './hub/useHubSheets';
import { useHubRuntime } from './hub/useHubRuntime';
import { deriveHubDeployState } from './hub/selectors/deployState';
import { C, HUB_LAYERS, HUB_SCOPED_CSS } from './hub/hubStyle';
import { shadowTierFor } from './hub/shadowGeometry';
import { useHubWidth } from './hub/useHubWidth';
import useHubReaders from './hub/useHubReaders';
import { useNavClearance } from './hub/useNavClearance';
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
import { PhoneStage, ShadowStage } from './ShadowStage';

/** Shadow's box per composition (the design: 340 desktop, 260 tablet, 200 phone — 196 under 375 px). */
export function shadowSizeFor(composition, width) {
  if (composition === HUB_COMPOSITIONS.PHONE) return typeof width === 'number' && width < 375 ? 196 : 200;
  if (composition === HUB_COMPOSITIONS.DESKTOP) return 340;
  return 260;
}

/** The three area summaries, in area order. Partnership's is fixed; the others are loading until their reader resolves. */
export function areaSummaries(sections) {
  const of = (section, loading) => (section?.status === 'ready' && section.summary ? section.summary : loading);
  // S5: a resolved absence of the agent is an answer, not a wait; since the S3 merge so is a failed read.
  const status = sections.loadout?.status;
  const loadout = status === LOADOUT_STATUS.NONE ? COPY.loadout.noAgent
    : status === LOADOUT_STATUS.ERROR ? COPY.loadout.agentUnavailable
      : of(sections.loadout, COPY.loadout.summaryLoading);
  return [COPY.partnership.summary, of(sections.research, COPY.research.summaryLoading), loadout];
}

const rootStyle = { position: 'relative', zIndex: HUB_LAYERS.page, color: C.ink, outline: 'none' };

/** The phone's sticky tab row (4 + 46 + 1 px) and a little air: the pane's top scroll padding. */
const PHONE_TAB_ROW_CLEARANCE = 56;

function useShared(sections) {
  const { user } = useUser();
  const reducedMotion = Boolean(useReducedMotion());
  const idBase = `hub${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { completed } = splitGames(sections.games);
  // Slice S3 (R-S3-8): the poll's live rows, whatever the completed window's status.
  const live = liveGamesOf(sections.games);
  // The strip's game (spec §10): a live BaggerBomb game when there is one — it
  // is what blocks the hold, and Open targets it — else the first live game.
  const liveGame = live.find((g) => g.kind === BATTLE_TYPE_BAGGERBOMB) || live[0] || null;
  const display = deployDisplay(sections.deploy, liveGame);
  return {
    user,
    reducedMotion,
    idBase,
    completed,
    liveGame,
    display,
    status: display.processing ? 'processing' : 'still',
    summaries: areaSummaries(sections),
    loadoutLine: loadoutLineOf(sections.loadout),
    dateText: formatHubDate(new Date()),
    name: headerName(user),
  };
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
function PhoneHub({ hub = null, sections: given, actions: wired = NO_ACTIONS, agentRead = null, deploy = null, board = null }) {
  const rootRef = useRef(null);
  const runtime = useHubRuntime({ hub, agentRead, sections: given, rootRef });
  const { sections, sheets: sheet } = runtime;
  const shared = useShared(sections);
  const stripRef = useRef(null);
  const width = useHubWidth(rootRef);
  const placement = useNavClearance(stripRef);
  const [tab, setTab] = useState(DEFAULT_PHONE_TAB);
  const composition = HUB_COMPOSITIONS.PHONE;
  const actions = {
    ...wired,
    ...runtime.actions,
    ...deployActionsOf(deploy, sheet, runtime),
    openHistory: shared.completed.length ? sheet.open(HUB_SHEETS.HISTORY) : undefined,
  };
  // Changing area before commitment cancels the charge (spec §5.5); the panels stay mounted while it charges.
  const selectTab = (next) => { deploy?.cancelCharging(); setTab(next); };
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
          <PhoneStage
            size={shadowSizeFor(composition, width)}
            tier={shadowTierFor(composition)}
            status={shared.status}
            processing={shared.display.processing}
            selectedArea={AREA_FOR_PHONE_TAB[tab]}
            summaries={shared.summaries}
            reducedMotion={shared.reducedMotion}
            holdPhase={deploy?.holdPhase ?? null}
            progress={deploy?.progress ?? null}
          />
        </div>
        <PhoneTabRow idBase={shared.idBase} tab={tab} onSelect={selectTab} />
        <div style={{ padding: '14px 14px 24px' }}>
          <PhonePanel idBase={shared.idBase} tab={tab} sections={sections} actions={actions} reducedMotion={shared.reducedMotion} />
        </div>
      </section>
      <DeployStrip
        ref={stripRef}
        deploy={sections.deploy}
        liveGame={shared.liveGame}
        loadoutLine={shared.loadoutLine}
        placement={placement}
        onOpenLoadout={() => selectTab(PHONE_TABS.LOADOUT)}
        onOpenGame={actions.openGame}
        onAction={actions.deployAction}
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
        <HistorySheet games={sections.games} career={sections.career} phone onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpenGame={actions.openGame} onOpenTape={actions.openTape} onRetry={actions.retryGames} />
      )}
      {runtime.live && (
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
      )}
    </HubLayoutContext.Provider>
  );
}

/** The desktop site: Desktop, Tablet or Stacked by the hub's own width. */
function WideHub({ hub = null, sections: given, actions: wired = NO_ACTIONS, agentRead = null, deploy = null, board = null }) {
  const rootRef = useRef(null);
  const runtime = useHubRuntime({ hub, agentRead, sections: given, rootRef });
  const { sections, sheets: sheet } = runtime;
  const shared = useShared(sections);
  const width = useHubWidth(rootRef);
  const composition = composeHub({ site: HUB_SITES.DESKTOP, width });
  const [area, setArea] = useState(DEFAULT_AREA);
  const actions = {
    ...wired,
    ...runtime.actions,
    ...deployActionsOf(deploy, sheet, runtime),
    openHistory: shared.completed.length ? sheet.open(HUB_SHEETS.HISTORY) : undefined,
  };
  // Changing area before commitment cancels the charge (spec §5.5).
  const selectArea = (next) => { deploy?.cancelCharging(); setArea(next); };
  const desktop = composition === HUB_COMPOSITIONS.DESKTOP;
  const tablet = composition === HUB_COMPOSITIONS.TABLET;
  const gutter = desktop ? 28 : tablet ? 24 : 20;

  const stage = (
    <ShadowStage
      composition={composition}
      size={shadowSizeFor(composition, width)}
      tier={shadowTierFor(composition)}
      status={shared.status}
      processing={shared.display.processing}
      selectedArea={area}
      onSelectArea={selectArea}
      summaries={shared.summaries}
      idBase={shared.idBase}
      reducedMotion={shared.reducedMotion}
      holdPhase={deploy?.holdPhase ?? null}
      progress={deploy?.progress ?? null}
    />
  );
  const panel = (
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
    deploy: (
      <DeploySection
        deploy={sections.deploy}
        loadoutLine={shared.loadoutLine}
        onOpenLoadout={() => selectArea(HUB_AREAS.ARCHETYPE)}
        onAction={actions.deployAction}
        holdWiring={deploy?.hold(HUB_DEPLOY_CONTROLS.CARD) ?? null}
        holding={deploy?.holdControlId === HUB_DEPLOY_CONTROLS.CARD ? deploy.holdPhase : null}
        onOpenBoard={actions.openBoard}
      />
    ),
    activity: <ActivitySection activity={sections.activity} />,
    brief: <BriefSection brief={sections.brief} />,
  };
  const hasNext = sections.nextAction?.status === 'ready' && Boolean(sections.nextAction.candidate);
  const grid = wideGrid(composition, hasNext);
  const body = (
    <div data-hub-body={composition} style={{ padding: `14px ${gutter}px ${desktop ? 30 : 28}px`, ...grid.body }}>
      <div data-hub-slot="next" style={{ gridArea: 'next', minWidth: 0, display: hasNext ? 'block' : 'none' }}>
        <NextActionCard nextAction={sections.nextAction} deploy={sections.deploy} holdWiring={actions.nextActionHold} holding={actions.nextActionHolding} />
      </div>
      <div data-hub-slot="main" style={grid.main}>
        <div data-hub-slot="stage" style={{ gridArea: 'stage', minWidth: 0 }}>{stage}</div>
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
        <HistorySheet games={sections.games} career={sections.career} onClose={runtime.closeSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} onOpenGame={actions.openGame} onOpenTape={actions.openTape} onRetry={actions.retryGames} />
      )}
      {runtime.live && (
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
      )}
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
  const deploy = useHubDeploy({ deployAttempt, readers, hub });
  const live = { ...sections, ...readers.sections };
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
  return site === HUB_SITES.MOBILE
    ? <PhoneHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} deploy={deploy} board={board} />
    : <WideHub hub={hub} sections={live} actions={actions} agentRead={readers.agent} deploy={deploy} board={board} />;
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
