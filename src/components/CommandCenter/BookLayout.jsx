// src/components/CommandCenter/BookLayout.jsx
//
// The portfolio hub's slice 3 — THE BOOK LAYOUT'S TABS, PANELS AND LOADOUT SHEET (spec
// docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md §2, §4 slice 3, PH-17, PH-19; Amendment A,
// docs/specs/20261127_COMMAND_CENTER_PORTFOLIO_HUB_SPEC_V1_AMENDMENT_A.md, PH-25 to PH-28). Rendered only when the connected shell's
// book scope (HubBookScope.jsx) decides 'book' — each site in CommandCenterHub.jsx is a literal ternary on the switch, so with it
// off none of this is reached. The hero above stays today's until the band (slice 2): the four tabs sit under it.
//
//   - BookTabRow: Overview · Ideas · Setups · Partnership (hub/bookTabs.js). Today's tab row's behaviour (PhoneTabs.jsx): one tab
//     stop, the arrow keys (and Home, End) move the selection and the focus together, a modified arrow belongs to the browser. On
//     the phone it sticks to the top of the hub's scroll pane, as today's does; on the wide compositions it takes the place of the
//     three-area list (ShadowStage.jsx draws none in this layout) as a row under the hero.
//   - BookPanel: the Overview (sections/BookOverview.jsx); Ideas, today's Research panel; Setups, the Idea book's built Desks
//     content for the archetype's desk alone; Partnership, today's Partnership panel (PH-25).
//   - BookPhoneBody / BookWidePanel: the tab row and the panel, holding the tab, which opens on what today's selection becomes
//     (hub/bookTabs.js bookTabOf). A tab change cancels an uncommitted hold, as today's tab and area changes do (spec V1.2 §5.5); a
//     desk row's tab change moves focus to the new tab, since the row goes away with its panel (review S3W-1).
//     The wide compositions keep today's grid and tree (CommandCenterHub.jsx): BookWidePanel sits in today's panel slot, and
//     bookWideGrid places the hero, then the tabs and their panel, and Deploy alone in the side column (the stacked composition puts
//     Deploy above the panel, as today's does). So the hero and the Deploy card never remount as the layout arrives (review S3W-6).
//   - BookLoadoutSheet: the Loadout is no tab (PH-17), so it opens as a sheet, from the strip's status button on the phone and the
//     Deploy card's loadout line on the wide compositions: today's Loadout area, whole (the phone's Deploy card first, as its Loadout
//     tab drew it). A HubSheet: it registers itself with the hub's overlay stack and returns focus to its opener. A sheet opened
//     from inside it (the armory, the record, the book, the traits, the Scouting Board) takes the hub's one sheet slot, as any
//     sheet opened from a sheet does (hub/useHubSheets.js), and gives focus back to what opened the Loadout.
//   - The phone armory gets its sheet here too (Armory.jsx PhoneArmorySheet): the hero's box no longer hosts it in this layout.
// No effect, timer, listener or observer (commandCenterHub.mount.guard.test.js scans this file).

import React, { use, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { DesksTab } from '../PracticeField/IdeaBookScreen';
import { BOOK_SHEETS, BOOK_TAB_ORDER, BOOK_TABS, bookPartsLayoutOf, bookTabForDesk, bookTabOf } from './hub/bookTabs';
import { HUB_AREAS, HUB_COMPOSITIONS, rovingIndex } from './hub/composition';
import { HubBookReadContext } from './hub/hubBookRead';
import { PORTFOLIO_HUB_COPY as BOOK } from './hub/hubCopy';
import { C, HAIR } from './hub/hubStyle';
import { PerGameLoadoutContext } from './hub/perGameLoadoutContext';
import { PER_GAME_LOADOUT_ENABLED } from '../../config/perGameLoadoutFlags';
import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';
import HubSheet from './HubSheet';
import { Label } from './HubParts';
import { AreaBody } from './panels/AreaPanel';
import { PhoneDeployCard } from './sections/DeploySection';
import BookOverview from './sections/BookOverview';
import { PhoneArmorySheet } from './Armory';

/**
 * The Deploy card's loadout line (LoadoutCards.jsx DeployLoadoutLine), the wide compositions' opener of the loadout's sheet. The line
 * calls its opener with no event, so the hub names its button for the sheet to give focus back to (Safari never focuses a click).
 */
export const DEPLOY_LOADOUT_OPENER = '[data-hub-slot="deploy"] [data-loadout-deploy-next]';

export const bookTabId = (idBase, tab) => `${idBase}-book-tab-${tab}`;
export const bookPanelId = (idBase) => `${idBase}-book-panel`;

/**
 * Each tab's underline, the design's (ccp6-screens.jsx TabRow3): the Overview and Partnership ink, Ideas teal, Setups gold. A function,
 * not a module-level table: a table reading the style's values would be a top-level statement the switch-off build keeps.
 */
function barOf(tab) {
  if (tab === BOOK_TABS.IDEAS) return C.teal;
  if (tab === BOOK_TABS.SETUPS) return C.gold;
  return C.ink;
}

export function BookTabRow({ idBase, tab, onSelect, phone = false, compact = false }) {
  const refs = useRef([]);
  const onKeyDown = (event) => {
    // A modified arrow belongs to the browser (Alt+Left is Back): today's rule (S1 review L3-9).
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = rovingIndex(event.key, BOOK_TAB_ORDER.indexOf(tab), BOOK_TAB_ORDER.length);
    if (next == null) return;
    event.preventDefault();
    onSelect(BOOK_TAB_ORDER[next]);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={BOOK.tabs.listLabel}
      onKeyDown={onKeyDown}
      data-hub-book-tabs={phone ? 'phone' : 'wide'}
      style={phone
        ? { position: 'sticky', top: 0, zIndex: 3, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: '4px 10px 0', background: C.bg, borderBottom: `1px solid ${HAIR}` }
        : { display: 'flex', gap: 4, borderBottom: `1px solid ${HAIR}`, minWidth: 0 }}
    >
      {BOOK_TAB_ORDER.map((key, i) => {
        const on = tab === key;
        return (
          <button
            key={key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={bookTabId(idBase, key)}
            aria-selected={on}
            aria-controls={bookPanelId(idBase)}
            tabIndex={on ? 0 : -1}
            data-hub-book-tab={key}
            onClick={() => onSelect(key)}
            style={{
              appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
              // The tablet's narrowest panel column is 332 px (a 700 px hub): 12 px a side keeps the four in it (review S3W-5).
              minHeight: phone ? 46 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: phone ? 0 : compact ? '0 12px' : '0 16px',
              color: on ? C.ink : C.ink2, whiteSpace: 'nowrap', borderRadius: 8,
            }}
          >
            <Label size={phone ? 12.5 : 14} weight={600}>{BOOK.tabs[key]}</Label>
            {on && <span aria-hidden="true" style={{ position: 'absolute', left: phone ? 6 : 8, right: phone ? 6 : 8, bottom: 0, height: 3, borderRadius: 2, background: barOf(key) }} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A tab change from inside the panel (a desk row): the row goes away with the panel it sits in, so focus moves to the newly
 * selected tab, which stays mounted (review S3W-1). In the handler, not an effect: the hub holds none. On the phone the tab row is
 * sticky inside the pane's scroll padding, where a focus would scroll the pane, so it moves no scroll there (`preventScroll`).
 */
function focusing(select, idBase, preventScroll = false) {
  return (next) => {
    select(next);
    document.getElementById(bookTabId(idBase, next))?.focus({ preventScroll });
  };
}

/** The view's id for the archetype's desk (a key, never shown). */
const ARCHETYPE_DESK = 'archetype';

/** PH-25: the Setups tab — the Idea book's built Desks content, for the archetype's desk alone. */
function SetupsBody({ view }) {
  const desks = view.desks.filter((d) => d.desk === ARCHETYPE_DESK);
  return <div data-hub-book-setups="">{desks.length ? <DesksTab view={{ ...view, desks }} focus={ARCHETYPE_DESK} /> : null}</div>;
}

/**
 * A press on the Idea book's parts, in the hub (review S3F-4; Amendment B PH-33, R12). The parts turn off the browser's tap
 * highlight and press with the screen's own style (ideaBookStyle.js IB_CSS), which moves and so is not loaded here: in the hub a
 * press showed nothing. This shows it at once — the token's scrim laid over the row's own background while it is pressed, with no
 * motion of any kind — for the parts' tappable rows in the Overview and the Setups body only. Today the Overview's desk rows, slot
 * headers and name rows are its rows; the Setups body (the Desks content) draws no tappable row yet, so its scope is for slice 5's.
 * Its own element beside the panel, never the hub's shared style (HUB_SCOPED_CSS): a plain string, so with the switch off nothing of
 * it ships.
 */
const BOOK_PRESS_CSS = '[data-hub-book-overview] .ib-tap:active, [data-hub-book-setups] .ib-tap:active { background-image: linear-gradient(rgba(var(--ft-scrim-rgb), 0.08), rgba(var(--ft-scrim-rgb), 0.08)) !important; }';

export function BookPanel({ idBase, tab, view, layout, sections, actions, onSelectTab, reducedMotion }) {
  return (
    <>
      <style data-hub-book-press="">{BOOK_PRESS_CSS}</style>
      {/* tabIndex 0, as today's panels: Tab reaches the content even when it holds no enabled control (S1 review L3-4). */}
      <div role="tabpanel" tabIndex={0} id={bookPanelId(idBase)} aria-labelledby={bookTabId(idBase, tab)} data-hub-book-panel={tab}>
        <motion.div key={tab} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={motionToken('smooth', { reducedMotion })}>
          {tab === BOOK_TABS.OVERVIEW ? (
            <BookOverview view={view} layout={layout} sections={sections} actions={actions} onDesk={(desk) => onSelectTab(bookTabForDesk(desk))} />
          ) : tab === BOOK_TABS.IDEAS ? (
            <AreaBody area={HUB_AREAS.RESEARCH} sections={sections} actions={actions} />
          ) : tab === BOOK_TABS.SETUPS ? (
            <SetupsBody view={view} />
          ) : (
            <AreaBody area={HUB_AREAS.PARTNERSHIP} sections={sections} actions={actions} />
          )}
        </motion.div>
      </div>
    </>
  );
}

/** The loadout's sheet (PH-17): today's Loadout area, whole. The phone's Deploy card first, as its Loadout tab drew it. */
export function BookLoadoutSheet({ phone = false, sections, actions, lists, onClose, opener, fallbackFocus, reducedMotion }) {
  const body = (
    <>
      {phone ? (
        <div style={{ marginBottom: 16 }}>
          <PhoneDeployCard deploy={sections.deploy} onAction={actions.deployAction} onOpenBoard={actions.openBoard} idea={sections.deployingWith ?? null} reconfirm={actions.reconfirmHuddle ? { onReconfirm: actions.reconfirmHuddle } : null} />
        </div>
      ) : null}
      <AreaBody area={HUB_AREAS.ARCHETYPE} sections={sections} actions={actions} />
    </>
  );
  return (
    <HubSheet title={BOOK.loadoutSheet} phone={phone} width={760} onClose={onClose} opener={opener} fallbackFocus={fallbackFocus} reducedMotion={reducedMotion}>
      <div data-hub-book-loadout={phone ? 'phone' : 'wide'}>
        {PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (
          // Build A2: the loadout cards take the shell's committed lists through the scope's context, as today's panel does.
          <PerGameLoadoutContext.Provider value={{ ...use(PerGameLoadoutContext), lists }}>{body}</PerGameLoadoutContext.Provider>
        ) : body}
      </div>
    </HubSheet>
  );
}

/**
 * The phone: the tab row (sticky) and the panel, where today's tab row and panel were; and the two sheets this layout adds — the
 * loadout's and the armory's. `initialTab` is today's tab when the layout arrives.
 */
export function BookPhoneBody({ idBase, initialTab, width, sections, actions, agent, lists, sheet, onCloseSheet, onTabChange, reducedMotion }) {
  const scope = use(HubBookReadContext);
  const [tab, setTab] = useState(() => bookTabOf(initialTab));
  const select = (next) => { onTabChange?.(); setTab(next); };
  const view = scope.read.book;
  return (
    <>
      <BookTabRow idBase={idBase} tab={tab} onSelect={select} phone />
      <div style={{ padding: '14px 14px 24px' }}>
        <BookPanel idBase={idBase} tab={tab} view={view} layout={bookPartsLayoutOf(HUB_COMPOSITIONS.PHONE, width)} sections={sections} actions={actions} onSelectTab={focusing(select, idBase, true)} reducedMotion={reducedMotion} />
      </div>
      {sheet.sheet === BOOK_SHEETS.LOADOUT ? (
        <BookLoadoutSheet
          phone
          sections={sections}
          // The phone armory opens on the book layout's own key (hub/bookTabs.js BOOK_SHEETS.ARMORY), where today's opens ARCHETYPE.
          actions={{ ...actions, changeArchetype: typeof actions.changeArchetype === 'function' ? sheet.open(BOOK_SHEETS.ARMORY) : undefined }}
          lists={lists}
          onClose={onCloseSheet}
          opener={sheet.opener}
          fallbackFocus={sheet.fallback}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <PhoneArmorySheet open={sheet.sheet === BOOK_SHEETS.ARMORY} agent={agent} onClose={onCloseSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={reducedMotion} width={width} />
    </>
  );
}

/**
 * The wide compositions' grid in this layout, in the shape of today's (CommandCenterHub.jsx wideGrid), whose tree it keeps: the hero
 * and the Deploy card stay where they are, so neither remounts when the layout arrives (review S3W-6). Desktop: [the hero, then the
 * tabs and their panel] beside Deploy. Tablet: the hero across, then [the tabs and their panel | Deploy]. Stacked: the hero, Deploy,
 * then the tabs and their panel. The side column holds Deploy alone: Games, Activity and the brief are the Overview's, under its table.
 */
export function bookWideGrid(composition) {
  const side = { gridArea: 'side', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 };
  if (composition === HUB_COMPOSITIONS.DESKTOP) {
    return {
      body: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', columnGap: 24, rowGap: 22, alignItems: 'start', gridTemplateRows: 'auto', gridTemplateAreas: '"main side"' },
      main: { gridArea: 'main', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 },
      side,
      sideOrder: [DEPLOY_SLOT],
    };
  }
  if (composition === HUB_COMPOSITIONS.TABLET) {
    return {
      body: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start', gridTemplateAreas: '"stage stage" "panel side"' },
      main: { display: 'contents' },
      side,
      sideOrder: [DEPLOY_SLOT],
    };
  }
  return {
    body: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, alignItems: 'start', gridTemplateAreas: '"stage" "deploy" "panel"' },
    main: { display: 'contents' },
    side: { display: 'contents' },
    sideOrder: [DEPLOY_SLOT],
  };
}

/** Today's side part the book layout keeps (CommandCenterHub.jsx's `side` keys). */
const DEPLOY_SLOT = 'deploy';

/**
 * The wide compositions' tabs and their panel, in today's panel slot (CommandCenterHub.jsx), and the loadout's sheet. `initialArea`
 * is today's area when the layout arrives.
 */
export function BookWidePanel({ composition, idBase, initialArea, sections, actions, lists, sheet, onCloseSheet, onTabChange, reducedMotion }) {
  const scope = use(HubBookReadContext);
  const [tab, setTab] = useState(() => bookTabOf(initialArea));
  const select = (next) => { onTabChange?.(); setTab(next); };
  return (
    <div data-hub-book-wide={composition} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <BookTabRow idBase={idBase} tab={tab} onSelect={select} compact={composition !== HUB_COMPOSITIONS.DESKTOP} />
      <BookPanel idBase={idBase} tab={tab} view={scope.read.book} layout={bookPartsLayoutOf(composition, null)} sections={sections} actions={actions} onSelectTab={focusing(select, idBase)} reducedMotion={reducedMotion} />
      {sheet.sheet === BOOK_SHEETS.LOADOUT ? (
        <BookLoadoutSheet sections={sections} actions={actions} lists={lists} onClose={onCloseSheet} opener={sheet.opener} fallbackFocus={sheet.fallback} reducedMotion={reducedMotion} />
      ) : null}
    </div>
  );
}
