// src/components/CommandCenter/pickDashboardShell.test.js
//
// Command Center hub, slice S0 — the mount picker (spec V1.2 §4, §11.3
// "Disabled hub: picker all mobile/desktop flag combinations").
//
// Every combination of the four inputs, written out as a table rather than
// computed, so a row is the expected answer and not a second copy of the
// picker. The hub-off rows are the pre-S0 sites: App.jsx's mobile ternary
// (COMMAND_DASHBOARD_ENABLED ? CommandDashboard : DashboardLoop) and desktop
// ternary (COMMAND_DASHBOARD_DESKTOP_ENABLED ? CommandDashboardDesktop :
// DashboardDesktop) as they stood at 495ee07b.

import { describe, it, expect } from 'vitest';
import { pickDashboardShell, DASHBOARD_SHELLS as S } from './pickDashboardShell';

// [hubOn, isMobile, mobileDashboardOn, desktopDashboardOn] → [shell, legacyShell]
const TABLE = [
  // hub OFF — the legacy shell at each site, by that site's own flag
  [false, true, true, true, S.COMMAND_DASHBOARD, S.COMMAND_DASHBOARD],
  [false, true, true, false, S.COMMAND_DASHBOARD, S.COMMAND_DASHBOARD],
  [false, true, false, true, S.DASHBOARD_LOOP, S.DASHBOARD_LOOP],
  [false, true, false, false, S.DASHBOARD_LOOP, S.DASHBOARD_LOOP],
  [false, false, true, true, S.COMMAND_DASHBOARD_DESKTOP, S.COMMAND_DASHBOARD_DESKTOP],
  [false, false, false, true, S.COMMAND_DASHBOARD_DESKTOP, S.COMMAND_DASHBOARD_DESKTOP],
  [false, false, true, false, S.DASHBOARD_DESKTOP, S.DASHBOARD_DESKTOP],
  [false, false, false, false, S.DASHBOARD_DESKTOP, S.DASHBOARD_DESKTOP],
  // hub ON — the hub at either site; legacyShell is still the hub-off pick
  [true, true, true, true, S.HUB, S.COMMAND_DASHBOARD],
  [true, true, true, false, S.HUB, S.COMMAND_DASHBOARD],
  [true, true, false, true, S.HUB, S.DASHBOARD_LOOP],
  [true, true, false, false, S.HUB, S.DASHBOARD_LOOP],
  [true, false, true, true, S.HUB, S.COMMAND_DASHBOARD_DESKTOP],
  [true, false, false, true, S.HUB, S.COMMAND_DASHBOARD_DESKTOP],
  [true, false, true, false, S.HUB, S.DASHBOARD_DESKTOP],
  [true, false, false, false, S.HUB, S.DASHBOARD_DESKTOP],
];

describe('pickDashboardShell — every mobile / desktop / hub flag combination', () => {
  it('the table covers all sixteen input combinations exactly once', () => {
    const keys = new Set(TABLE.map((r) => r.slice(0, 4).join('/')));
    expect(keys.size).toBe(16);
  });

  it.each(TABLE)(
    'hubOn=%s isMobile=%s mobileDashboardOn=%s desktopDashboardOn=%s → %s (legacy %s)',
    (hubOn, isMobile, mobileDashboardOn, desktopDashboardOn, shell, legacyShell) => {
      expect(pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn }))
        .toEqual({ shell, legacyShell });
    },
  );

  it('with the hub off the site renders its fallback shell itself (shell === legacyShell)', () => {
    for (const [, isMobile, mobileDashboardOn, desktopDashboardOn] of TABLE) {
      const pick = pickDashboardShell({ hubOn: false, isMobile, mobileDashboardOn, desktopDashboardOn });
      expect(pick.shell).toBe(pick.legacyShell);
    }
  });

  it('the mobile site never names a desktop shell and the desktop site never a mobile one', () => {
    const MOBILE = new Set([S.HUB, S.COMMAND_DASHBOARD, S.DASHBOARD_LOOP]);
    const DESKTOP = new Set([S.HUB, S.COMMAND_DASHBOARD_DESKTOP, S.DASHBOARD_DESKTOP]);
    for (const [hubOn, isMobile, mobileDashboardOn, desktopDashboardOn] of TABLE) {
      const { shell, legacyShell } = pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn });
      const allowed = isMobile ? MOBILE : DESKTOP;
      expect(allowed.has(shell) && allowed.has(legacyShell) && legacyShell !== S.HUB).toBe(true);
    }
  });
});

describe('pickDashboardShell — the hub fails closed, the legacy pick keeps pre-S0 truthiness', () => {
  it.each([undefined, null, 1, 'true', {}])('hubOn=%s is not exactly true → the legacy shell', (hubOn) => {
    expect(pickDashboardShell({ hubOn, isMobile: true, mobileDashboardOn: true, desktopDashboardOn: true }).shell)
      .toBe(S.COMMAND_DASHBOARD);
    expect(pickDashboardShell({ hubOn, isMobile: false, mobileDashboardOn: true, desktopDashboardOn: false }).shell)
      .toBe(S.DASHBOARD_DESKTOP);
  });

  it('an undefined legacy flag picks the same shell the pre-S0 ternary did (the falsy branch)', () => {
    // A bare featureFlags vi.mock factory resolves these to undefined; the
    // pre-S0 `FLAG ? A : B` then rendered B, and so does the picker.
    expect(pickDashboardShell({ hubOn: false, isMobile: true }).shell).toBe(S.DASHBOARD_LOOP);
    expect(pickDashboardShell({ hubOn: false, isMobile: false }).shell).toBe(S.DASHBOARD_DESKTOP);
    // ...and an undefined width is App's desktop branch (`if (isMobile)` is falsy).
    expect(pickDashboardShell({ hubOn: false, desktopDashboardOn: true }).shell).toBe(S.COMMAND_DASHBOARD_DESKTOP);
  });
});

describe('pickDashboardShell — pure', () => {
  it('returns a frozen answer and leaves its argument untouched', () => {
    const input = Object.freeze({ hubOn: true, isMobile: false, mobileDashboardOn: true, desktopDashboardOn: true });
    const pick = pickDashboardShell(input);
    expect(Object.isFrozen(pick)).toBe(true);
    expect(input).toEqual({ hubOn: true, isMobile: false, mobileDashboardOn: true, desktopDashboardOn: true });
  });

  it('the same inputs give the same answer, call after call', () => {
    for (const [hubOn, isMobile, mobileDashboardOn, desktopDashboardOn] of TABLE) {
      const a = pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn });
      const b = pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn });
      expect(b).toEqual(a);
    }
  });

  it('names exactly the five shells, as frozen keys', () => {
    expect(Object.isFrozen(S)).toBe(true);
    expect(Object.values(S).sort()).toEqual(
      ['commandDashboard', 'commandDashboardDesktop', 'dashboardDesktop', 'dashboardLoop', 'hub'],
    );
  });
});
