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
//     fixtures) can supply the same shapes.
//   - No background of its own: App's starfield stays behind the hub at both
//     sites; hub surfaces sit on bg-card / bg-agent over it.
//
// Its only subscriptions are the ResizeObservers that measure it (its width,
// the stage connector, and on the phone the strip and BottomNav) and the
// signed-in user from useUser() for the header line. OS reduced motion comes
// from framer-motion's useReducedMotion, the house precedent.
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
import { deployDisplay } from './hub/deployDisplay';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { formatHubDate, headerName } from './hub/hubDate';
import { HUB_S1_SECTIONS, splitGames } from './hub/hubModel';
import { C, HUB_LAYERS, HUB_SCOPED_CSS } from './hub/hubStyle';
import { shadowTierFor } from './hub/shadowGeometry';
import { useHubWidth } from './hub/useHubWidth';
import { useNavClearance } from './hub/useNavClearance';
import { areaPanelId, areaTabId } from './AreaControls';
import DeployStrip from './DeployStrip';
import HistorySheet from './HistorySheet';
import HubHeader from './HubHeader';
import { HubLayoutContext } from './HubParts';
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
  return [
    COPY.partnership.summary,
    of(sections.research, COPY.research.summaryLoading),
    of(sections.loadout, COPY.loadout.summaryLoading),
  ];
}

export function loadoutLineOf(loadout) {
  if (loadout?.status === 'ready' && loadout.archetype?.name && loadout.watchlist?.name) {
    return COPY.loadout.line(loadout.archetype.name, loadout.watchlist.name);
  }
  return COPY.loadout.lineLoading;
}

const rootStyle = { position: 'relative', zIndex: HUB_LAYERS.page, color: C.ink, outline: 'none' };

/** The phone's sticky tab row (4 + 46 + 1 px) and a little air: the pane's top scroll padding. */
const PHONE_TAB_ROW_CLEARANCE = 56;

function useShared(sections) {
  const { user } = useUser();
  const reducedMotion = Boolean(useReducedMotion());
  const idBase = `hub${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { live, completed } = splitGames(sections.games);
  const liveGame = live[0] || null;
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

/**
 * The History sheet's state. `open(kind)` is a click handler: it keeps the
 * control that was clicked, so focus returns there when the sheet closes
 * (Safari does not focus a clicked button), and the hub root is the fallback
 * if that control is gone by then (S1 review L3-3).
 */
function useHubSheet(rootRef) {
  const [sheet, setSheet] = useState(null);
  const openerRef = useRef(null);
  return {
    sheet,
    open: (kind) => (event) => { openerRef.current = event?.currentTarget ?? null; setSheet(kind); },
    close: () => setSheet(null),
    opener: openerRef.current,
    fallback: rootRef.current,
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

/** The mobile site: header → compact stage → sticky tabs → section, and the strip above BottomNav. */
function PhoneHub({ sections }) {
  const shared = useShared(sections);
  const rootRef = useRef(null);
  const stripRef = useRef(null);
  const width = useHubWidth(rootRef);
  const placement = useNavClearance(stripRef);
  const [tab, setTab] = useState(DEFAULT_PHONE_TAB);
  const sheet = useHubSheet(rootRef);
  const composition = HUB_COMPOSITIONS.PHONE;
  const actions = {
    openHistory: shared.completed.length ? sheet.open('history') : undefined,
  };
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
        tabIndex={-1}
        style={{
          ...rootStyle, height: '100dvh', overflowY: 'auto', overflowX: 'hidden', paddingBottom: placement.scrollClearance,
          // Focus scrolling keeps a focused row clear of the sticky tab row and of the strip and nav (S1 review L3-5).
          scrollPaddingTop: PHONE_TAB_ROW_CLEARANCE, scrollPaddingBottom: placement.scrollClearance,
        }}
      >
        <HubHeader phone dateText={shared.dateText} name={shared.name} />
        <div style={{ padding: '10px 14px 12px' }}>
          <PhoneStage
            size={shadowSizeFor(composition, width)}
            tier={shadowTierFor(composition)}
            status={shared.status}
            processing={shared.display.processing}
            selectedArea={AREA_FOR_PHONE_TAB[tab]}
            summaries={shared.summaries}
            reducedMotion={shared.reducedMotion}
          />
        </div>
        <PhoneTabRow idBase={shared.idBase} tab={tab} onSelect={setTab} />
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
        onOpenLoadout={() => setTab(PHONE_TABS.LOADOUT)}
      />
      {sheet.sheet === 'history' && (
        <HistorySheet games={sections.games} career={sections.career} phone onClose={sheet.close} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} />
      )}
    </HubLayoutContext.Provider>
  );
}

/** The desktop site: Desktop, Tablet or Stacked by the hub's own width. */
function WideHub({ sections }) {
  const shared = useShared(sections);
  const rootRef = useRef(null);
  const width = useHubWidth(rootRef);
  const composition = composeHub({ site: HUB_SITES.DESKTOP, width });
  const [area, setArea] = useState(DEFAULT_AREA);
  const sheet = useHubSheet(rootRef);
  const actions = {
    openHistory: shared.completed.length ? sheet.open('history') : undefined,
  };
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
      onSelectArea={setArea}
      summaries={shared.summaries}
      idBase={shared.idBase}
      reducedMotion={shared.reducedMotion}
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
    games: <GamesSection games={sections.games} onOpenHistory={actions.openHistory} />,
    deploy: <DeploySection deploy={sections.deploy} loadoutLine={shared.loadoutLine} onOpenLoadout={() => setArea(HUB_AREAS.ARCHETYPE)} />,
    activity: <ActivitySection activity={sections.activity} />,
    brief: <BriefSection brief={sections.brief} />,
  };
  const hasNext = sections.nextAction?.status === 'ready' && Boolean(sections.nextAction.candidate);
  const grid = wideGrid(composition, hasNext);
  const body = (
    <div data-hub-body={composition} style={{ padding: `14px ${gutter}px ${desktop ? 30 : 28}px`, ...grid.body }}>
      <div data-hub-slot="next" style={{ gridArea: 'next', minWidth: 0, display: hasNext ? 'block' : 'none' }}>
        <NextActionCard nextAction={sections.nextAction} deploy={sections.deploy} />
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
        tabIndex={-1}
        style={{ ...rootStyle, minHeight: '100vh', overflowX: 'hidden' }}
      >
        <HubHeader dateText={shared.dateText} name={shared.name} gutter={desktop || tablet ? 28 : gutter} />
        {body}
      </section>
      {sheet.sheet === 'history' && (
        <HistorySheet games={sections.games} career={sections.career} onClose={sheet.close} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={shared.reducedMotion} />
      )}
    </HubLayoutContext.Provider>
  );
}

/**
 * @param {'mobile'|'desktop'} props.site     App's pick, through the gate (ruling R-S1-3)
 * @param {object}             [props.sections] the section props (hub/hubModel.js); S1 passes the loading state
 */
export default function CommandCenterHub({ site, sections = HUB_S1_SECTIONS }) {
  // Keyed by site: a hub handed the other site starts from that site's defaults (ruling R-S1-5).
  return site === HUB_SITES.MOBILE
    ? <PhoneHub key={HUB_SITES.MOBILE} sections={sections} />
    : <WideHub key={HUB_SITES.DESKTOP} sections={sections} />;
}
