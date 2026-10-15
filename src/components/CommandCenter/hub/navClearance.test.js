// src/components/CommandCenter/hub/navClearance.test.js
//
// Command Center hub, slice S1 — the mobile strip's clearance from MEASURED
// heights (spec V1.2 §10; prompt §4.5): the strip sits on the nav's measured
// outer height, the safe-area inset is counted once, and the scroll area
// clears both.

import { describe, expect, it } from 'vitest';
import { BOTTOM_NAV_ATTRIBUTE, navClearance } from './navClearance';

describe('navClearance', () => {
  it('a 64 px nav and a 63 px strip: the strip sits at 64, the scroll area clears 127', () => {
    expect(navClearance({ navHeight: 64, stripHeight: 63 })).toEqual({ stripBottom: 64, stripPadsSafeArea: false, scrollClearance: 127 });
  });

  it('uses the measured nav height, never the CSS 64: a 98 px nav (64 + a 34 px inset) lifts the strip to 98', () => {
    const out = navClearance({ navHeight: 98, stripHeight: 66 });
    expect(out.stripBottom).toBe(98);
    expect(out.scrollClearance).toBe(164);
  });

  it('counts the safe area once: with a nav, the strip adds no inset of its own', () => {
    expect(navClearance({ navHeight: 98, stripHeight: 66 }).stripPadsSafeArea).toBe(false);
  });

  it('with no nav on screen the strip sits at the bottom and pads the inset itself; its measured height carries it', () => {
    expect(navClearance({ navHeight: 0, stripHeight: 97 })).toEqual({ stripBottom: 0, stripPadsSafeArea: true, scrollClearance: 97 });
    expect(navClearance({ navHeight: null, stripHeight: 63 })).toEqual({ stripBottom: 0, stripPadsSafeArea: true, scrollClearance: 63 });
  });

  it('a strip that grows to two lines raises the clearance with it', () => {
    expect(navClearance({ navHeight: 64, stripHeight: 69 }).scrollClearance).toBe(133);
  });

  it.each([undefined, NaN, -5, '64', Infinity])('an unmeasured height (%s) reads as zero, never a guess', (bad) => {
    expect(navClearance({ navHeight: bad, stripHeight: bad })).toEqual({ stripBottom: 0, stripPadsSafeArea: true, scrollClearance: 0 });
  });

  it('names the attribute App\'s BottomNav carries', async () => {
    expect(BOTTOM_NAV_ATTRIBUTE).toBe('data-ft-bottom-nav');
    const { readFileSync } = await import('node:fs');
    const nav = readFileSync(new URL('../../Navigation/BottomNav.jsx', import.meta.url), 'utf8');
    expect(nav).toMatch(/<nav\s+data-ft-bottom-nav=""/);
  });
});
