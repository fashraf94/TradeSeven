// src/components/starfield.inert.test.jsx
//
// Acceptance row A1 — the flag-conditional wiring stays intact, and the flags
// pin their current state.
// Delight Layer arc, Task 2. Spec V2 §6.
//
// Originally this file proved the merge-dark state (both flags false). The flags
// are now FLIPPED LIVE (founder flip PR #694). Its enduring job is twofold:
//   1. PIN the current flag values, so a future flip (or revert) MUST reconcile
//      this file in the SAME commit — BUILD_RULES §2; and
//   2. mechanically check the flag-OFF contract is still intact — the mount and
//      root-paint ternaries, `DesktopBackground` left untouched, and the flag-off
//      scheduling path (resolveLoopPlan with an explicit flagOn:false) — so a
//      revert or a regression that breaks the off-branch is caught.
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

describe('A1 — flag state + the flag-off contract (flags now flipped LIVE)', () => {
  it('STARFIELD_BACKGROUND_ENABLED pins its live (flipped) state', () => {
    // Flipped false→true in the founder flip PR (#694) after the A7 sign-off.
    // This PINS the live state. Any future flip that turns it back off MUST
    // update this pin in the same commit — BUILD_RULES §2: a flip PR reconciles
    // its own assertions (this pin exists because the flip that did NOT reddened
    // CI on every PR into main).
    expect(STARFIELD_BACKGROUND_ENABLED).toBe(true);
  });

  it('STARFIELD_MOBILE_ENABLED pins its live (flipped) state', () => {
    // Independent of desktop (Amendment A1). Same reconciliation rule: a flip
    // back to false updates this pin in the same commit.
    expect(STARFIELD_MOBILE_ENABLED).toBe(true);
  });

  it('the dev-override reader is SSR-safe in a Node context (flag-independent)', () => {
    // getWarpDevOverride() has no flag short-circuit, so it is the genuine,
    // constant-independent SSR canary: in Node (no window) it returns null and
    // never throws, whatever the flags above are set to.
    expect(typeof window).toBe('undefined'); // default vitest env is node
    expect(getWarpDevOverride()).toBeNull();

    // The gate helpers must also never throw when there is no window. NOTE
    // (reported, not deleted): with the flags flipped TRUE they now short-circuit
    // to `true` BEFORE the `typeof window` guard, so their flag-OFF Node return
    // value (false) is no longer observable here without module-mocking the
    // constants. The flag-off SCHEDULING consequence — the load-bearing part —
    // is pinned by the next row via an explicit flagOn:false.
    expect(() => isStarfieldOn()).not.toThrow();
    expect(() => isStarfieldMobileOn()).not.toThrow();
    expect(typeof isStarfieldOn()).toBe('boolean');
    expect(typeof isStarfieldMobileOn()).toBe('boolean');
  });

  it('the two flags are INDEPENDENT — neither helper reads the other gate', () => {
    // Amendment A1: mobile must be able to go dark without disturbing the
    // desktop verdict, so the two gates may never couple.
    //
    // This asserts on the FUNCTION BODIES with comments stripped, and bans the
    // other gate's IDENTIFIER as well as its const. Banning only the const name
    // would let `isStarfieldOn() { if (isStarfieldMobileOn()) return true; ... }`
    // pass while coupling the two — the exact thing A1 forbids. Reading bodies
    // rather than raw slices also stops a neighbouring docblock that merely
    // mentions the other flag from false-failing the row.
    const flags = stripComments(readSource('src/config/featureFlags.js'));

    /** The body between a function's opening `{` and its closing brace. */
    const bodyOf = (name) => {
      const start = flags.indexOf(`export function ${name}()`);
      expect(start, `${name} must exist in featureFlags.js`).toBeGreaterThan(-1);
      const open = flags.indexOf('{', start);
      let depth = 0;
      for (let i = open; i < flags.length; i += 1) {
        if (flags[i] === '{') depth += 1;
        else if (flags[i] === '}') {
          depth -= 1;
          if (depth === 0) return flags.slice(open, i + 1);
        }
      }
      throw new Error(`unbalanced braces reading ${name}`);
    };

    const desktop = bodyOf('isStarfieldOn');
    const mobile = bodyOf('isStarfieldMobileOn');

    // Each reads its OWN flag...
    expect(desktop).toContain('STARFIELD_BACKGROUND_ENABLED');
    expect(mobile).toContain('STARFIELD_MOBILE_ENABLED');

    // ...and neither the other's const NOR the other's helper.
    expect(desktop, 'desktop gate must not read the mobile flag').not.toContain('STARFIELD_MOBILE_ENABLED');
    expect(desktop, 'desktop gate must not call the mobile gate').not.toContain('isStarfieldMobileOn');
    expect(mobile, 'mobile gate must not read the desktop flag').not.toContain('STARFIELD_BACKGROUND_ENABLED');
    expect(mobile, 'mobile gate must not call the desktop gate').not.toContain('isStarfieldOn(');

    // The URL params are distinct too, so one preview param cannot open both.
    expect(desktop).toContain("get('starfield')");
    expect(mobile).toContain("get('starfieldMobile')");
  });

  it('the flag-OFF path never schedules and draws nothing (explicit input)', () => {
    // Re-expressed to pass flagOn EXPLICITLY rather than reading the live
    // constant (which now returns true), so it keeps asserting the flag-off
    // contract regardless of what the flags are flipped to. The live-on
    // scheduling path is exercised in warpStateMachine.test.js (A2s).
    expect(resolveLoopPlan({ flagOn: false })).toMatchObject({
      shouldSchedule: false,
      shouldDrawOnce: false,
      reason: 'flag-off',
    });
  });
});

describe('A1 — the mount sites stay conditional, and DesktopBackground survives', () => {
  // Phase 2 threaded `liveGames` into both mounts, so these now pin BOTH the
  // off-state fallback AND the prop threading (R-T2-S1): the starfield must be
  // fed from the existing poll projection, never from a source of its own.
  it('the desktop dashboard mount renders DesktopBackground when the flag is off', () => {
    expect(APP).toContain('isStarfieldOn()');
    expect(APP).toMatch(
      /isStarfieldOn\(\)\s*\?\s*<StarfieldBackground mode="desktop" liveGames=\{starfieldLiveGames\} \/>\s*:\s*<DesktopBackground isDesktop=\{isDesktop\} \/>/
    );
  });

  it('the mobile dashboard mount renders DesktopBackground when the mobile flag is off', () => {
    expect(APP).toMatch(
      /isStarfieldMobileOn\(\)\s*\?\s*<StarfieldBackground mode="mobile" liveGames=\{starfieldLiveGames\} \/>\s*:\s*<DesktopBackground isDesktop=\{isDesktop\} \/>/
    );
  });

  it('feeds the starfield from the EXISTING poll, adding no new read (A6/R-T2-S1)', () => {
    const code = stripComments(APP);
    // One projection, memoized off the poll state the card already uses.
    expect(code).toMatch(
      /const starfieldLiveGames = useMemo\(\(\) => toLiveGames\(activeAgentBattles\), \[activeAgentBattles\]\);/
    );
    // ...and the adapter is the only thing standing between the two.
    expect(code).toContain("import { toLiveGames } from './components/warpBattleAdapter'");
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
  // Each root hoists its gate to a local const beside the existing `ceremonyOn`
  // (the file's own idiom) rather than calling it inline in JSX, so both halves
  // are asserted: the const comes from the RIGHT gate, and the paint falls back
  // to CMD.bg when that const is false.
  it('the desktop root is transparent ONLY under the desktop flag', () => {
    const code = stripComments(DESKTOP_ROOT);
    expect(code).toContain('const starfieldOn = isStarfieldOn();');
    expect(code).toContain("background: starfieldOn ? 'transparent' : CMD.bg");
    expect(code, 'desktop root must not key off the mobile gate').not.toContain('isStarfieldMobileOn');
  });

  it('the mobile root is transparent ONLY under the mobile flag', () => {
    const code = stripComments(MOBILE_ROOT);
    expect(code).toContain('const starfieldOn = isStarfieldMobileOn();');
    expect(code).toContain("background: starfieldOn ? 'transparent' : CMD.bg");
    expect(code, 'mobile root must not key off the desktop gate').not.toContain('isStarfieldOn(');
  });

  it('neither root drops CMD.bg outright', () => {
    // A bare `background: 'transparent'` would strip the dashboard's own surface
    // colour in the OFF state — the exact regression this row exists to catch.
    expect(DESKTOP_ROOT).toContain('CMD.bg');
    expect(MOBILE_ROOT).toContain('CMD.bg');
  });
});

// NOTE: row A6 lives in starfield.importguard.test.js, not here. It was a flat
// text check over two files during Phase 1; Phase 3 replaced it with a
// TRANSITIVE walk of the real import graph, which also catches a read smuggled
// one hop away. Keeping a weaker duplicate here would give two answers to one
// question — see that file.

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
