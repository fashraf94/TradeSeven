// src/components/CommandCenter/hubChrome.test.js
//
// Command Center hub, slice S5 — the two decisions App makes around the hub
// (hubChrome.js): when the floating bug button and the season banner are
// withheld (ruling R-S5-7), and which Forge area an `onOpenForge` request names
// (ruling R-S5-5). App.jsx is imported by one suite, at desktop width, so these
// pure functions are where the decisions are tested; the mount guard pins the
// App text that calls them.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hubFlag } = vi.hoisted(() => ({ hubFlag: { on: false } }));
vi.mock('../../config/featureFlags', () => ({ isCommandCenterHubOn: () => hubFlag.on }));

import { FORGE_AREAS, FORGE_RETURN, forgeAreaOf, hubOwnsDashboard } from './hubChrome';
import { DASHBOARD_SHELLS, pickDashboardShell } from './pickDashboardShell';

beforeEach(() => { hubFlag.on = false; });

const SCREENS = ['dashboard', 'home', 'profile', 'battle', 'builder', 'watchlistEditor', 'filmRoom', 'league', undefined, null, ''];
const FORGE = [true, false, undefined, null, 0, 1];

describe('hubOwnsDashboard — with the hub flag OFF, today\'s screens are untouched (ruling R-S5-7)', () => {
  it('is false for every screen and every Forge state', () => {
    hubFlag.on = false;
    for (const screen of SCREENS) for (const showForge of FORGE) {
      expect(hubOwnsDashboard({ screen, showForge }), JSON.stringify({ screen, showForge })).toBe(false);
    }
  });

  it('is false for every screen when the flag is handed in as anything but exactly true', () => {
    for (const hubOn of [false, undefined, null, 0, 1, 'true', {}, []]) {
      for (const screen of SCREENS) expect(hubOwnsDashboard({ screen, showForge: false, hubOn }), JSON.stringify({ hubOn, screen })).toBe(false);
    }
  });
});

describe('hubOwnsDashboard — with the hub flag ON', () => {
  it('is true on the dashboard with no Forge over it — and only there', () => {
    hubFlag.on = true;
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false })).toBe(true);
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: undefined })).toBe(true);
    for (const screen of SCREENS.filter((s) => s !== 'dashboard')) {
      expect(hubOwnsDashboard({ screen, showForge: false }), String(screen)).toBe(false);
    }
  });

  it('the Forge replaces every screen, so with it open the hub is not the dashboard on screen', () => {
    hubFlag.on = true;
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: true })).toBe(false);
  });

  it('reads the hub flag through its accessor at call time (a flip is seen by the next render)', () => {
    hubFlag.on = false;
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false })).toBe(false);
    hubFlag.on = true;
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false })).toBe(true);
  });

  it('the gate showing its legacy fallback (the hub chunk failed to load) hands the screen back: the hub is not what is on screen (review E1-1)', () => {
    hubFlag.on = true;
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false, hubFailed: true })).toBe(false);
    // and only exactly `true` does: nothing else the signal could carry takes the hub's screen away
    for (const hubFailed of [false, undefined, null, 0, 1, 'true', {}]) {
      expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false, hubFailed }), JSON.stringify(hubFailed)).toBe(true);
    }
    expect(hubOwnsDashboard({ screen: 'dashboard', showForge: false })).toBe(true);
  });

  it('the fallback never makes the flag-off answer anything but false, and never makes a non-dashboard screen the hub\'s', () => {
    for (const hubFailed of [true, false, undefined]) {
      for (const screen of SCREENS) for (const showForge of FORGE) {
        expect(hubOwnsDashboard({ screen, showForge, hubFailed, hubOn: false }), JSON.stringify({ screen, showForge, hubFailed })).toBe(false);
      }
      for (const screen of SCREENS.filter((s) => s !== 'dashboard')) {
        expect(hubOwnsDashboard({ screen, showForge: false, hubFailed, hubOn: true }), String(screen)).toBe(false);
      }
    }
  });

  it('agrees with the picker App uses at both sites, over every input it takes (display agreement, BUILD_RULES §9)', () => {
    for (const hubOn of [true, false, undefined, 'true', 1]) {
      for (const isMobile of [true, false]) {
        for (const mobileDashboardOn of [true, false]) {
          for (const desktopDashboardOn of [true, false]) {
            const picked = pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn }).shell === DASHBOARD_SHELLS.HUB;
            const owns = hubOwnsDashboard({ screen: 'dashboard', showForge: false, hubOn });
            expect(owns, JSON.stringify({ hubOn, isMobile })).toBe(picked);
          }
        }
      }
    }
  });
});

describe('forgeAreaOf — which Forge area a request names (ruling R-S5-5)', () => {
  it('names ForgeWorkshop\'s four area ids, and the bridge\'s constants are those ids', () => {
    expect(FORGE_AREAS).toEqual({ OVERVIEW: 'overview', LISTS: 'watchlists', RULES: 'rules', CHARACTER: 'traits' });
    expect(FORGE_RETURN).toEqual({ DASHBOARD: 'dashboard' });
    for (const area of Object.values(FORGE_AREAS)) expect(forgeAreaOf({ area, returnTo: 'dashboard' })).toBe(area);
  });

  it('a request that names no area is null — App then makes the bare setShowForge(true) it always has', () => {
    for (const request of [undefined, null, {}, { returnTo: 'dashboard' }, 'watchlists', 7, [], () => {}, { area: undefined }, { area: null }]) {
      expect(forgeAreaOf(request), JSON.stringify(request)).toBeNull();
    }
  });

  it('an area ForgeWorkshop does not have is no area (it would normalize to the overview anyway; the bridge says so)', () => {
    for (const area of ['discover', 'WATCHLISTS', 'Lists', 'character', '', ' watchlists', 5, {}, ['traits']]) {
      expect(forgeAreaOf({ area }), JSON.stringify(area)).toBeNull();
    }
  });

  it('a list id alone opens the Lists area — ForgeWorkshop cannot open on a particular list', () => {
    expect(forgeAreaOf({ watchlistId: 'wl-1' })).toBe(FORGE_AREAS.LISTS);
    expect(forgeAreaOf({ watchlistId: 'wl-1', area: 'bogus' })).toBe(FORGE_AREAS.LISTS);
  });

  it('a named area wins over a list id; a blank or non-string id is no id', () => {
    expect(forgeAreaOf({ area: 'rules', watchlistId: 'wl-1' })).toBe('rules');
    for (const watchlistId of ['', '   ', 5, null, undefined, {}, ['wl']]) {
      expect(forgeAreaOf({ watchlistId }), JSON.stringify(watchlistId)).toBeNull();
    }
  });
});
