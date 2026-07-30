// src/components/starfield.inert.test.jsx
//
// Acceptance row A1 — FLAG OFF ⇒ THE STARFIELD DOES NOT EXIST.
// Delight Layer arc, Task 2 (Phase 1). Spec V2 §6.
//
// The whole task merges dark, so this file's job is to make "dark" mechanically
// checkable rather than asserted in a PR description. It fails if the swap, the
// root transparency, or either flag leaks into the off-state.
//
// House idiom (Phase 0 §2.6): react-dom/server smoke + source-text tripwires.
// The repo ships no jsdom/RTL setup and mocks getContext/rAF nowhere, and the
// two mount sites live inside src/App.jsx which cannot be rendered in a unit
// test — so the conditional at each site is asserted against source text, the
// same technique as api/_utils/.../buildArenaModel.test.js:424 and
// src/theme/tokens.guard.test.js. renderToString never runs effects, so the
// component smoke below touches no canvas and schedules no frame.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';

import StarfieldBackground from './StarfieldBackground';
import {
  STARFIELD_BACKGROUND_ENABLED,
  STARFIELD_MOBILE_ENABLED,
  isStarfieldOn,
  isStarfieldMobileOn,
  getWarpDevOverride,
} from '../config/featureFlags';
import { resolveLoopPlan } from './warpStateMachine';

const readSource = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8');

/**
 * Strip comments before asserting on CODE.
 *
 * A source-text guard that greps raw text false-positives on its own prose —
 * the documented house gotcha (Task 1 discovery §6: "an @layer guard that greps
 * raw CSS text will false-positive on the word inside a comment — strip comments
 * first"). This file's own header quotes `if (!isDesktop) return null` while
 * explaining why the starfield does NOT do that, which tripped the row below
 * before this existed. Full-line `//` comments only, so string literals
 * containing `//` survive.
 */
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const APP = readSource('src/App.jsx');
const DESKTOP_ROOT = readSource('src/components/Dashboard/CommandDashboardDesktop.jsx');
const MOBILE_ROOT = readSource('src/components/Dashboard/CommandDashboard.jsx');
const STARFIELD = readSource('src/components/StarfieldBackground.jsx');
const CORE = readSource('src/components/warpStateMachine.js');

describe('A1 — merged dark: both flags ship false', () => {
  it('STARFIELD_BACKGROUND_ENABLED is false at HEAD', () => {
    expect(
      STARFIELD_BACKGROUND_ENABLED,
      'The desktop starfield must merge dark. Flipping is a separate one-line PR '
        + 'carrying the A7 founder feel sign-off — never a build PR (the PR #510 lesson).'
    ).toBe(false);
  });

  it('STARFIELD_MOBILE_ENABLED is false at HEAD', () => {
    expect(
      STARFIELD_MOBILE_ENABLED,
      'The mobile starfield must merge dark and flip independently of desktop.'
    ).toBe(false);
  });

  it('resolves off in a Node/SSR context, with no window to read', () => {
    expect(typeof window).toBe('undefined'); // default vitest env is node
    expect(isStarfieldOn()).toBe(false);
    expect(isStarfieldMobileOn()).toBe(false);
    expect(getWarpDevOverride()).toBeNull();
  });

  it('the two flags are INDEPENDENT — neither helper reads the other flag', () => {
    // Amendment A1: mobile must be able to go dark without disturbing desktop.
    const flags = readSource('src/config/featureFlags.js');
    const desktopHelper = flags.slice(
      flags.indexOf('export function isStarfieldOn()'),
      flags.indexOf('export const STARFIELD_MOBILE_ENABLED')
    );
    const mobileHelper = flags.slice(
      flags.indexOf('export function isStarfieldMobileOn()'),
      flags.indexOf('export function getWarpDevOverride()')
    );
    expect(desktopHelper).not.toContain('STARFIELD_MOBILE_ENABLED');
    expect(mobileHelper).not.toContain('STARFIELD_BACKGROUND_ENABLED');
    expect(desktopHelper).toContain('STARFIELD_BACKGROUND_ENABLED');
    expect(mobileHelper).toContain('STARFIELD_MOBILE_ENABLED');
  });

  it('flag-off means the loop is never scheduled and nothing is drawn', () => {
    expect(resolveLoopPlan({ flagOn: isStarfieldOn() })).toMatchObject({
      shouldSchedule: false,
      shouldDrawOnce: false,
      reason: 'flag-off',
    });
  });
});

describe('A1 — the mount sites stay conditional, and DesktopBackground survives', () => {
  it('the desktop dashboard mount renders DesktopBackground when the flag is off', () => {
    expect(APP).toContain('isStarfieldOn()');
    expect(APP).toMatch(
      /isStarfieldOn\(\)\s*\?\s*<StarfieldBackground mode="desktop" \/>\s*:\s*<DesktopBackground isDesktop=\{isDesktop\} \/>/
    );
  });

  it('the mobile dashboard mount renders DesktopBackground when the mobile flag is off', () => {
    expect(APP).toMatch(
      /isStarfieldMobileOn\(\)\s*\?\s*<StarfieldBackground mode="mobile" \/>\s*:\s*<DesktopBackground isDesktop=\{isDesktop\} \/>/
    );
  });

  it('renders the starfield at EXACTLY the two dashboard mounts — no third site', () => {
    const mounts = APP.match(/<StarfieldBackground/g) || [];
    expect(
      mounts.length,
      'R-T2-S5 scopes v1 to the two dashboard mounts. A third mount would put the '
        + 'field on a screen the founder has not signed off.'
    ).toBe(2);
  });

  it('leaves the other six DesktopBackground mounts untouched', () => {
    // R-T2-S5: DesktopBackground still renders on the non-dashboard screens.
    for (const rel of [
      'src/screens/HomeScreen.jsx',
      'src/screens/ProfileScreen.jsx',
      'src/screens/BuilderScreen.jsx',
      'src/screens/BattleViewScreen.jsx',
      'src/screens/JoinScreen.jsx',
      'src/screens/PreviousBattlesScreen.jsx',
    ]) {
      const source = readSource(rel);
      expect(source, `${rel} must still mount DesktopBackground`).toContain('<DesktopBackground');
      expect(source, `${rel} must NOT mount the starfield in v1`).not.toContain('StarfieldBackground');
    }
  });

  it('does not edit DesktopBackground.jsx at all (R-T2-S5/S6)', () => {
    const source = readSource('src/components/DesktopBackground.jsx');
    // The price lines must still be there: deleting them is what would force the
    // tokenGuardBaseline 21->18 update, and that belongs to the everywhere-swap
    // follow-on, not to this task or its flip PR.
    expect(source).toContain('stroke="#00d9ff"');
    expect(source).toContain('stroke="#8b5cf6"');
    expect(source).not.toContain('Starfield');
  });
});

describe('A1 — the root paints stay opaque while the flags are off', () => {
  it('the desktop root is transparent ONLY under the flag', () => {
    expect(DESKTOP_ROOT).toContain("background: isStarfieldOn() ? 'transparent' : CMD.bg");
  });

  it('the mobile root is transparent ONLY under the mobile flag', () => {
    expect(MOBILE_ROOT).toContain("background: isStarfieldMobileOn() ? 'transparent' : CMD.bg");
  });

  it('neither root drops CMD.bg outright', () => {
    // A bare `background: 'transparent'` would strip the dashboard's own surface
    // colour in the OFF state — the exact regression this row exists to catch.
    expect(DESKTOP_ROOT).toContain('CMD.bg');
    expect(MOBILE_ROOT).toContain('CMD.bg');
  });
});

describe('A6 — no Firestore reaches the starfield (checked early, finalised in Phase 3)', () => {
  it('neither the component nor the core imports a Firestore API', () => {
    for (const [name, source] of [
      ['StarfieldBackground.jsx', stripComments(STARFIELD)],
      ['warpStateMachine.js', stripComments(CORE)],
    ]) {
      expect(source, `${name} must not import firebase`).not.toMatch(/from\s+['"]firebase/);
      expect(source, `${name} must not import the app's firebase config`).not.toMatch(/firebase\/config/);
      for (const api of ['onSnapshot', 'getDocs', 'collection(', 'setInterval(']) {
        expect(source, `${name} must not call ${api} — R-T2-S1 forbids new reads/polls`)
          .not.toContain(api);
      }
    }
  });
});

describe('A1 — the component itself is inert on a server render', () => {
  it('renders a pointer-events-none canvas in the z0 slot without throwing', () => {
    const html = renderToString(<StarfieldBackground mode="desktop" />);
    expect(html).toContain('<canvas');
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('z-index:0');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders in mobile mode without throwing', () => {
    expect(() => renderToString(<StarfieldBackground mode="mobile" />)).not.toThrow();
  });

  it('does not self-gate on isDesktop the way DesktopBackground does (Amendment A2)', () => {
    // DesktopBackground.jsx:11 early-returns null on mobile, which is exactly why
    // mobile has no background layer today. The starfield must take an explicit
    // mode instead, or the mobile flag would silently render nothing.
    const code = stripComments(STARFIELD);
    expect(code).not.toContain('if (!isDesktop)');
    expect(code).not.toContain('isDesktop');
    expect(code).toContain("mode = 'desktop'");
  });
});
