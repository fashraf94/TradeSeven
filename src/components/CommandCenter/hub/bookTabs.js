// src/components/CommandCenter/hub/bookTabs.js
//
// The portfolio hub's slice 3 — THE BOOK LAYOUT'S TABS, pure (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §2, §4 slice 3; Amendment A, docs/specs/20261127_COMMAND_CENTER_PORTFOLIO_HUB_SPEC_V1_AMENDMENT_A.md, PH-25 and PH-28). Used only
// when the layout decision (hub/hubLayout.js) is 'book':
//   - the four tabs, in the design's order and ids: Overview · Ideas · Setups · Partnership. Loadout is not a tab (PH-17);
//   - where the book layout opens. The decision arrives after today's hub has drawn (PH-9), so the player may already have picked
//     today's tab or area: Research becomes Ideas, Partnership stays, anything else (the Overview, the Loadout, the wide default
//     Equipped Archetype) becomes the Overview;
//   - the tab a desk row opens: Setups for the archetype's desk, Ideas for the agent's (spec §4 slice 3);
//   - the Idea book parts' layout from the hub's own composition and measured width (PH-28): the desktop composition draws the
//     parts' desktop table; the phone under 360 px draws their 320 layout (the parts' own edge, ideaBookCopy.js layoutOfWidth);
//     everything else their 390 layout. Nothing here measures: the width is the hub's own (hub/useHubWidth.js), handed in;
//   - the sheet the loadout opens in, now that it is no tab (PH-17): a key of its own beside hub/useHubSheets.js's, so that table
//     is untouched.
// Reads only its arguments. No clock, no I/O.

import { HUB_AREAS, HUB_COMPOSITIONS, PHONE_TABS } from './composition';

export const BOOK_TABS = /* @__PURE__ */ Object.freeze({ OVERVIEW: 'overview', IDEAS: 'ideas', SETUPS: 'setups', PARTNERSHIP: 'partnership' });
// Literals, not reads of BOOK_TABS: a property read at module level survives tree-shaking (portfolioHub.flagOffBundle.test.js).
// bookTabs.test.js pins the order to the ids above.
export const BOOK_TAB_ORDER = /* @__PURE__ */ Object.freeze(['overview', 'ideas', 'setups', 'partnership']);

/**
 * The book layout's first tab, from today's selection when the layout arrives: a phone tab id ('overview', 'research',
 * 'partnership', 'loadout'), a wide area (HUB_AREAS), or nothing.
 */
export function bookTabOf(selection) {
  if (selection === PHONE_TABS.RESEARCH || selection === HUB_AREAS.RESEARCH) return BOOK_TABS.IDEAS;
  if (selection === PHONE_TABS.PARTNERSHIP || selection === HUB_AREAS.PARTNERSHIP) return BOOK_TABS.PARTNERSHIP;
  return BOOK_TABS.OVERVIEW;
}

/** A desk row's tab: Setups for the archetype's desk, Ideas for the agent's. The desk ids are the view's (never shown). */
export function bookTabForDesk(desk) {
  return desk === 'archetype' ? BOOK_TABS.SETUPS : BOOK_TABS.IDEAS;
}

/** The parts' width edge for their 320 layout (ideaBookCopy.js layoutOfWidth: under 360 px). bookTabs.test.js pins the two equal. */
export const BOOK_PARTS_P320_BELOW = 360;

/** PH-28: the Idea book parts' layout ('p320' | 'p390' | 'desk') from the hub's composition and its measured width. */
export function bookPartsLayoutOf(composition, width) {
  if (composition === HUB_COMPOSITIONS.DESKTOP) return 'desk';
  if (composition === HUB_COMPOSITIONS.PHONE && typeof width === 'number' && width > 0 && width < BOOK_PARTS_P320_BELOW) return 'p320';
  return 'p390';
}

/** The loadout's sheet in the book layout (hub/useHubSheets.js opens any key; this one is a HubSheet, which registers itself). */
export const BOOK_SHEETS = /* @__PURE__ */ Object.freeze({ LOADOUT: 'loadout' });
