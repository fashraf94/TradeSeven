// src/components/League/battleArena/mobileHeroHeight.test.js
//
// Phase 6 / C5 / Amendment G — the mobile hero's height rule.
//
// The constants under test were MEASURED in headless Chromium against the real
// ArenaMobile tree, not estimated: the estimates in the Phase 6 report were off
// by ±12 in opposite directions on the chrome, and by 2× on the dock row, which
// is the error that changes the answer.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MOBILE_STICKY_CHROME, MOBILE_DOCK_ROW, MOBILE_HERO_MIN, MOBILE_HERO_MAX,
  mobileHeroHeight, dockRowsVisible, mobileHeroCss,
} from './mobileHeroHeight';

const SE_USABLE = 553;   // iPhone SE with Safari chrome showing (G1)
const SE_DEVICE = 667;   // the slab — the WRONG denominator

describe('G1 — usable viewport governs, not device height', () => {
  it('sizing off DEVICE height over-sizes the hero and costs real dock room', () => {
    const usable = mobileHeroHeight({ usableVh: SE_USABLE });
    const device = mobileHeroHeight({ usableVh: SE_DEVICE });
    expect(device).toBeGreaterThan(usable);
    // What matters is not the pixel delta but what it costs on real glass: a
    // hero sized for the slab leaves materially less dock visible on the 553
    // the user actually has.
    const rowsFromDevice = dockRowsVisible({ usableVh: SE_USABLE, heroH: device });
    const rowsFromUsable = dockRowsVisible({ usableVh: SE_USABLE, heroH: usable });
    expect(rowsFromUsable - rowsFromDevice).toBeGreaterThan(0.5); // over half a row
    expect(rowsFromDevice).toBeLessThan(1.25);
  });

  it('the hero never exceeds its ceiling or drops below its floor', () => {
    for (const vh of [400, 553, 667, 812, 844, 1200]) {
      const h = mobileHeroHeight({ usableVh: vh });
      expect(h).toBeGreaterThanOrEqual(MOBILE_HERO_MIN);
      expect(h).toBeLessThanOrEqual(MOBILE_HERO_MAX);
    }
    expect(mobileHeroHeight({ usableVh: NaN })).toBe(MOBILE_HERO_MAX);
  });
});

describe('G3 — two full dock rows ARE achievable (render refuted the arithmetic)', () => {
  it('the shortest usable viewport leaves 185 for the hero, above the measured floor', () => {
    const room = SE_USABLE - MOBILE_STICKY_CHROME - 2 * MOBILE_DOCK_ROW;
    expect(room).toBe(185);
    expect(room).toBeGreaterThan(MOBILE_HERO_MIN); // 185 > 180 — the clamp does not bind
  });

  it('so the hero takes 185 and TWO FULL ROWS are visible — the requirement holds', () => {
    const h = mobileHeroHeight({ usableVh: SE_USABLE, rows: 2 });
    expect(h).toBe(185);
    expect(dockRowsVisible({ usableVh: SE_USABLE, heroH: h })).toBeGreaterThanOrEqual(2);
  });

  it('the floor is the MEASURED head stack plus the x-label band, not an estimate', () => {
    // Chromium: the four-seat head stack bottoms out at 151.5 at EVERY height
    // (spreadLabels clamps to the top bound, which does not depend on h);
    // + compact padB 26 ⇒ 177.5 ⇒ 180.
    expect(MOBILE_HERO_MIN).toBe(180);
    expect(151.5 + 26).toBeLessThanOrEqual(MOBILE_HERO_MIN);
  });

  it('shorter-than-SE viewports clamp to the floor rather than collapsing', () => {
    const h = mobileHeroHeight({ usableVh: 450 });
    expect(h).toBe(MOBILE_HERO_MIN);
    expect(dockRowsVisible({ usableVh: 450, heroH: h })).toBeLessThan(2); // honest shortfall
  });

  it('taller phones keep two rows and a bigger hero', () => {
    for (const vh of [812, 844]) {
      const h = mobileHeroHeight({ usableVh: vh });
      expect(h).toBeGreaterThan(185);
      expect(dockRowsVisible({ usableVh: vh, heroH: h })).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('G2 — the unit is svh, with a vh fallback, scoped to the hero', () => {
  const CSS = readFileSync(new URL('./battleArena.css', import.meta.url), 'utf8');

  it('the stylesheet ships an @supports svh rule over a vh fallback', () => {
    expect(CSS).toMatch(/\.bv2-fuse-hero-m\s*\{[^}]*100vh/);
    expect(CSS).toMatch(/@supports \(height: 100svh\)/);
    expect(CSS).toMatch(/@supports \(height: 100svh\)\s*\{\s*\.bv2-fuse-hero-m\s*\{[^}]*100svh/);
  });

  it('it NEVER uses dvh — a dynamic unit would resize the sticky hero mid-scroll', () => {
    // Declarations only: the header comment names dvh to explain why it is
    // rejected, and a prose mention must not read as usage.
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations).not.toMatch(/dvh/);
  });

  it('the rule is scoped to the hero class only — no app-wide viewport refactor', () => {
    const rules = CSS.match(/^[^@\n][^{\n]*\{[^}]*100s?vh[^}]*\}/gm) || [];
    for (const r of rules) expect(r).toContain('.bv2-fuse-hero-m');
  });

  it('the JS mirror reserves the same measured budget as the CSS', () => {
    const { preferred, fallback } = mobileHeroCss();
    const reserved = MOBILE_STICKY_CHROME + 2 * MOBILE_DOCK_ROW;
    expect(reserved).toBe(368);
    expect(preferred).toContain(`100svh - ${reserved}px`);
    expect(fallback).toContain(`100vh - ${reserved}px`);
    expect(CSS).toContain(`100svh - ${reserved}px`);
  });
});

describe('H1 — two rows is RULED, and there is no longer a knob', () => {
  // The founder compared 185 / 237 / 314 on a real phone and ruled two rows.
  // The comparison instrument (?heroRows= → --fh-reserve) was deleted with the
  // ruling; these rows keep the ruled numbers, and the absence of the knob,
  // from drifting back in.
  it('the shipped default is two full rows on the shortest usable viewport', () => {
    expect(mobileHeroHeight({ usableVh: SE_USABLE })).toBe(185);
    expect(dockRowsVisible({ usableVh: SE_USABLE, heroH: 185 })).toBeGreaterThanOrEqual(2);
  });

  it('the alternatives the ruling rejected are what they were judged as', () => {
    // Kept as a record of what 185 was chosen OVER, not as selectable targets.
    expect(mobileHeroHeight({ usableVh: SE_USABLE, rows: 1.6 })).toBeCloseTo(236.6, 1);
    expect(mobileHeroHeight({ usableVh: SE_USABLE, rows: 1 })).toBe(314);
  });

  it('nothing overrides the reserve at runtime — no param, no custom property', () => {
    const css = readFileSync(new URL('./battleArena.css', import.meta.url), 'utf8');
    expect(css).not.toContain('--fh-reserve');
    const gate = readFileSync(new URL('./fuseHeroGate.js', import.meta.url), 'utf8');
    expect(gate).not.toMatch(/heroRows/);
    const mobile = readFileSync(new URL('./ArenaMobile.jsx', import.meta.url), 'utf8');
    expect(mobile).not.toMatch(/fh-reserve|heroReservePx|FUSE_HERO_ROWS/);
  });

  it("H1's concern was real and is accepted, not designed away", () => {
    // The measured four-seat stack bottoms at 151.5 regardless of height, so at
    // 185 it is ~82% of the hero. Ruled acceptable on glass; the remedy, if one
    // is ever wanted, is the compact headGap ticket — not a shorter dock.
    const HEAD_STACK = 151.5;
    expect(HEAD_STACK / 185).toBeGreaterThan(0.8);
    expect(HEAD_STACK / 314).toBeLessThan(0.5);
  });
});
