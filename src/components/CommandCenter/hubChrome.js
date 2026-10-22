// src/components/CommandCenter/hubChrome.js
//
// Command Center hub, slice S5 — the two small decisions App makes AROUND the
// hub, as pure functions App and the tests share (App.jsx is imported by one
// suite, at desktop width, so a decision left inline in it cannot be tested).
// Statically imported by App, so it stays tiny: the flag accessor and constants.
//
// 1. hubOwnsDashboard — is the hub the dashboard on screen? (ruling R-S5-7)
//    App withholds the floating ClashBot button and the active-season banner
//    exactly then: both are fixed-position chrome that would sit on the phone
//    strip's action (S1 founder questions Q2, Q3). It is the picker's own rule
//    (pickDashboardShell names the hub only for `hubOn === true`, at either
//    site, whatever the other inputs), on the dashboard screen, with no Forge
//    covering it (App renders the Forge INSTEAD of every screen). With the hub
//    flag off it is false for every screen, so today's screens are untouched.
//    A hub chunk that fails to load falls back to the legacy shell WITHOUT the
//    floating button (the gate decides that, not this): see the S5 report.
//
// 2. forgeAreaOf — which Forge area an `onOpenForge` request names (ruling
//    R-S5-5). ForgeWorkshop opens on an AREA, read once at mount (`initialArea`
//    in its useState initializer): 'overview', 'watchlists' (the "Lists" tab),
//    'rules' and 'traits' (the "Character" tab while RELEASE3_CHARACTER_TAB_ENABLED
//    is on, else "Traits"). It cannot open on a particular list, and the
//    watchlist editor's close goes to App's 'home' screen rather than the
//    dashboard, so a `watchlistId` is honoured only as far as the Lists area.
//    No usable area is `null`: App then does exactly what it does today.

import { isCommandCenterHubOn } from '../../config/featureFlags';

/** ForgeWorkshop's area ids (its navItems). */
export const FORGE_AREAS = Object.freeze({ OVERVIEW: 'overview', LISTS: 'watchlists', RULES: 'rules', CHARACTER: 'traits' });
/** The only return the bridge knows: closing the Forge returns to the screen under it, the dashboard. */
export const FORGE_RETURN = Object.freeze({ DASHBOARD: 'dashboard' });

const AREA_IDS = new Set(Object.values(FORGE_AREAS));

/**
 * @param {object}  p
 * @param {string}  p.screen    App's current screen
 * @param {boolean} p.showForge App's Forge flag
 * @param {boolean} [p.hubOn]   the hub flag; read through its accessor at call time unless handed in
 */
export function hubOwnsDashboard({ screen, showForge, hubOn = isCommandCenterHubOn() }) {
  return hubOn === true && screen === 'dashboard' && !showForge;
}

/**
 * @param {{ area?: string, watchlistId?: string, returnTo?: string }|undefined} request
 * @returns {string|null} the Forge area to open on, or null for the Forge as it opens today
 */
export function forgeAreaOf(request) {
  const r = request !== null && typeof request === 'object' ? request : {};
  if (AREA_IDS.has(r.area)) return r.area;
  const listId = typeof r.watchlistId === 'string' && r.watchlistId.trim() !== '';
  return listId ? FORGE_AREAS.LISTS : null;
}
