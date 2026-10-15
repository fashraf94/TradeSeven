// src/components/CommandCenter/pickDashboardShell.js
//
// Command Center hub, slice S0 — THE dashboard mount picker (spec
// docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md §2, §4).
//
// App.jsx has two dashboard mount sites, one per width (`isMobile` there is
// rawIsMobile || isTablet, so ≤ 768 px is the mobile site). Both call this ONE
// function with the same four inputs and render what it names:
//
//   hub on   → the hub, at whichever site is mounting;
//   hub off  → the legacy shell that site rendered before S0 — CommandDashboard
//              or DashboardLoop on mobile by COMMAND_DASHBOARD_ENABLED,
//              CommandDashboardDesktop or DashboardDesktop on desktop by
//              COMMAND_DASHBOARD_DESKTOP_ENABLED. The two legacy branches stay
//              distinct; neither fallback is collapsed into the other.
//
// It also names `legacyShell`, the shell the hub-off pick would be, whatever
// the hub flag says. That is the shell CommandCenterHubGate falls back to when
// the hub chunk fails to load, so the fallback and the flag-off render come
// from one function and cannot drift apart.
//
// Pure: it reads only its argument — no flag module, no window, no clock. App
// owns the wrappers (the desktop sidebar offset), the starfield and the
// background; the picker never sees them.
//
// `hubOn` must be exactly `true` to pick the hub, so an undefined flag (a bare
// featureFlags vi.mock factory, say) fails closed to the legacy shell. The
// other three inputs keep the truthiness App's own `if (isMobile)` and the
// pre-S0 ternaries used, so the legacy pick is the pre-S0 pick for any value.

/** The five shells a dashboard site can render. Keys App and the gate share. */
export const DASHBOARD_SHELLS = Object.freeze({
  HUB: 'hub',
  COMMAND_DASHBOARD: 'commandDashboard',
  DASHBOARD_LOOP: 'dashboardLoop',
  COMMAND_DASHBOARD_DESKTOP: 'commandDashboardDesktop',
  DASHBOARD_DESKTOP: 'dashboardDesktop',
});

/**
 * @param {object}  inputs
 * @param {boolean} inputs.hubOn               isCommandCenterHubOn(), read at render
 * @param {boolean} inputs.isMobile            App's mobile-site test (≤ 768 px)
 * @param {boolean} inputs.mobileDashboardOn   COMMAND_DASHBOARD_ENABLED
 * @param {boolean} inputs.desktopDashboardOn  COMMAND_DASHBOARD_DESKTOP_ENABLED
 * @returns {{ shell: string, legacyShell: string }} frozen; `shell` is what the
 *   site renders, `legacyShell` what it renders with the hub off (and what the
 *   gate falls back to). With the hub off they are equal.
 */
export function pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn }) {
  let legacyShell;
  if (isMobile) {
    legacyShell = mobileDashboardOn ? DASHBOARD_SHELLS.COMMAND_DASHBOARD : DASHBOARD_SHELLS.DASHBOARD_LOOP;
  } else {
    legacyShell = desktopDashboardOn ? DASHBOARD_SHELLS.COMMAND_DASHBOARD_DESKTOP : DASHBOARD_SHELLS.DASHBOARD_DESKTOP;
  }
  return Object.freeze({
    shell: hubOn === true ? DASHBOARD_SHELLS.HUB : legacyShell,
    legacyShell,
  });
}
