// src/components/CommandCenter/hub/composition.js
//
// Command Center hub, slice S1 — the pure width → composition function
// (founder ruling R-S1-3; spec V1.2 §1, §10).
//
// The hub lays out by its OWN measured content width, never the window's. The
// app keeps its navigation: the desktop sidebar on the desktop site (the gate
// already places the hub in the sidebar offset), BottomNav on the mobile site.
// So the composition takes two inputs:
//
//   site  — App's pick, passed down through the gate: 'mobile' (App's
//           isMobile, a ≤ 768 px window) or 'desktop'. It cannot be inferred
//           from the hub's width: a 614 px hub is Phone on the mobile site and
//           Stacked on the desktop site (an 834 px tablet with the sidebar
//           expanded).
//   width — the hub's measured content width in px (useHubWidth), or null
//           before the first measurement.
//
//   | site    | width        | composition |
//   |---------|--------------|-------------|
//   | mobile  | any          | phone       |
//   | desktop | ≥ 1080       | desktop     |
//   | desktop | 700 – 1079   | tablet      |
//   | desktop | < 700 / null | stacked     |
//
// Anything but site 'mobile' takes the desktop site's rows: an absent site
// never yields the phone composition (its fixed strip assumes BottomNav).
// An unmeasured width is Stacked, the one column that cannot scroll sideways.
//
// Defaults (spec §1): the phone opens on Overview; desktop, tablet and stacked
// open on the Equipped Archetype area (the phone's "Loadout"). Crossing App's
// 768 px split remounts the hub at the other site, so it starts again from
// that site's default (ruling R-S1-5); width changes within one site keep the
// selection.

export const HUB_SITES = Object.freeze({ MOBILE: 'mobile', DESKTOP: 'desktop' });

export const HUB_COMPOSITIONS = Object.freeze({
  PHONE: 'phone',
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  STACKED: 'stacked',
});

/** The desktop site's band edges, in px of hub content width (ruling R-S1-3). */
export const DESKTOP_MIN_WIDTH = 1080;
export const TABLET_MIN_WIDTH = 700;

/**
 * @param {{ site: string, width: number|null }} inputs
 * @returns {'phone'|'desktop'|'tablet'|'stacked'}
 */
export function composeHub({ site, width }) {
  if (site === HUB_SITES.MOBILE) return HUB_COMPOSITIONS.PHONE;
  if (typeof width !== 'number' || !Number.isFinite(width)) return HUB_COMPOSITIONS.STACKED;
  if (width >= DESKTOP_MIN_WIDTH) return HUB_COMPOSITIONS.DESKTOP;
  if (width >= TABLET_MIN_WIDTH) return HUB_COMPOSITIONS.TABLET;
  return HUB_COMPOSITIONS.STACKED;
}

/** The three relationship areas, in the design's order (ff-stage.jsx FF_AREAS). */
export const HUB_AREAS = Object.freeze({ PARTNERSHIP: 0, RESEARCH: 1, ARCHETYPE: 2 });
export const HUB_AREA_ORDER = Object.freeze([HUB_AREAS.PARTNERSHIP, HUB_AREAS.RESEARCH, HUB_AREAS.ARCHETYPE]);

/** The phone's four tabs, in the design's order (ff-mobile.jsx M_TABS), and the area each selects. */
export const PHONE_TABS = Object.freeze({
  OVERVIEW: 'overview',
  RESEARCH: 'research',
  PARTNERSHIP: 'partnership',
  LOADOUT: 'loadout',
});
export const PHONE_TAB_ORDER = Object.freeze([
  PHONE_TABS.OVERVIEW,
  PHONE_TABS.RESEARCH,
  PHONE_TABS.PARTNERSHIP,
  PHONE_TABS.LOADOUT,
]);
export const AREA_FOR_PHONE_TAB = Object.freeze({
  [PHONE_TABS.OVERVIEW]: null,
  [PHONE_TABS.RESEARCH]: HUB_AREAS.RESEARCH,
  [PHONE_TABS.PARTNERSHIP]: HUB_AREAS.PARTNERSHIP,
  [PHONE_TABS.LOADOUT]: HUB_AREAS.ARCHETYPE,
});

/** The phone opens on Overview (spec §1). Partnership is never a default (spec §8.3). */
export const DEFAULT_PHONE_TAB = PHONE_TABS.OVERVIEW;
/** Desktop, tablet and stacked open on the Equipped Archetype area (spec §1). */
export const DEFAULT_AREA = HUB_AREAS.ARCHETYPE;

/**
 * Where a roving-focus list moves for a key, or null if the key is not one of
 * its keys. `vertical` lists take Up/Down as well as Left/Right (the design's
 * area tablist takes all four; the phone's horizontal tab row, Left/Right).
 */
export function rovingIndex(key, index, count, { vertical = false } = {}) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const next = key === 'ArrowRight' || (vertical && key === 'ArrowDown');
  const prev = key === 'ArrowLeft' || (vertical && key === 'ArrowUp');
  if (next) return (index + 1) % count;
  if (prev) return (index + count - 1) % count;
  return null;
}
