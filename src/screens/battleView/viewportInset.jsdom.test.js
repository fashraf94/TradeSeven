// @vitest-environment jsdom
//
// src/screens/battleView/viewportInset.jsdom.test.js
//
// A3 F3 — the arithmetic behind the phone mark's `bottom`.
//
// `position: fixed` anchors to the LAYOUT viewport. iOS shrinks the VISUAL
// viewport for its toolbars without firing a window resize (the reason
// readViewportHeight exists at all — review L2-F11), so a mark pinned to
// `bottom: 14` sits 14px above the layout viewport's floor, which is behind the
// toolbar. This is the correction that puts it back on screen.
//
// The mounted behaviour is in AgentBattleScreen.pane.jsdom.test.jsx ("lifts off
// the browser chrome"); these rows pin the edges that a screen test cannot
// reach without contriving a browser.

import { describe, it, expect, afterEach } from 'vitest';
import { viewportInsetFrom } from './useChatSheet';

const LAYOUT = 800;
const setLayout = (px) => Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: px });

afterEach(() => { delete window.visualViewport; setLayout(768); });

describe('viewportInsetFrom — the chrome `fixed` cannot see', () => {
  it('is the gap between the layout viewport and the visual one', () => {
    setLayout(LAYOUT);
    expect(viewportInsetFrom(LAYOUT - 120)).toBe(120);
    expect(viewportInsetFrom(LAYOUT - 1)).toBe(1);
  });

  it('is zero when the two agree — the desktop, and a phone with no chrome up', () => {
    setLayout(LAYOUT);
    expect(viewportInsetFrom(LAYOUT)).toBe(0);
  });

  it('NEVER goes negative', () => {
    // Android reports a visual viewport LARGER than innerHeight in some
    // fullscreen states. A negative inset would push the mark down off the
    // screen — the failure this whole helper exists to prevent, inverted.
    setLayout(LAYOUT);
    expect(viewportInsetFrom(LAYOUT + 200)).toBe(0);
  });

  it('rounds, so React never writes a fractional px', () => {
    setLayout(LAYOUT);
    expect(viewportInsetFrom(LAYOUT - 120.4)).toBe(120);
    expect(viewportInsetFrom(LAYOUT - 120.6)).toBe(121);
  });

  it('falls back to zero on every unusable reading', () => {
    // Each of these would otherwise reach the style as NaN, which the browser
    // drops — silently returning the mark to the corner F3 moved it out of.
    setLayout(LAYOUT);
    expect(viewportInsetFrom(NaN)).toBe(0);
    expect(viewportInsetFrom(undefined)).toBe(0);
    expect(viewportInsetFrom(null)).toBe(0);
    expect(viewportInsetFrom(0)).toBe(0);
    expect(viewportInsetFrom(-10)).toBe(0);
    // A LAYOUT THE CLAMP CANNOT RESCUE (review lens 4). `setLayout(0)` was
    // proved by `Math.max(0, 0 - 600)` rather than by the guard, so dropping
    // `!layout` from the guard left this row green. NaN is the reading that
    // actually reaches the style as `bottom: NaNpx`.
    setLayout(0);
    expect(viewportInsetFrom(600)).toBe(0);
    setLayout(NaN);
    expect(viewportInsetFrom(600)).toBe(0);
    setLayout(undefined);
    expect(viewportInsetFrom(600)).toBe(0);
  });
});

describe('viewportInsetFrom — what the plain subtraction got wrong (review lens 1)', () => {
  const withViewport = (vv) => { window.visualViewport = { addEventListener() {}, removeEventListener() {}, ...vv }; };

  it('measures the BOTTOM gap, not the total — offsetTop is not chrome below', () => {
    // iOS scrolls the visual viewport DOWN to bring a focused input into view,
    // and a pinch-pan moves it too. `layout - visual` counted whatever sat
    // ABOVE the visual viewport a second time at the bottom, so a page with a
    // 50px top bar and a 44px bottom bar lifted the mark by 94 instead of 44.
    setLayout(LAYOUT);
    withViewport({ height: LAYOUT - 94, offsetTop: 50, scale: 1 });
    expect(viewportInsetFrom(LAYOUT - 94)).toBe(44);
  });

  it('is zero at any zoom — a pinch is not browser chrome', () => {
    // Zooming shrinks the visual viewport while innerHeight stays put, so the
    // plain subtraction read a 2x zoom on an 800px page as 400px of chrome and
    // threw the one door back into the pane into the middle of the screen.
    setLayout(LAYOUT);
    withViewport({ height: LAYOUT / 2, offsetTop: 0, scale: 2 });
    expect(viewportInsetFrom(LAYOUT / 2)).toBe(0);
    withViewport({ height: LAYOUT / 1.5, offsetTop: 0, scale: 1.5 });
    expect(viewportInsetFrom(LAYOUT / 1.5)).toBe(0);
  });

  it('still measures chrome when the page is NOT zoomed', () => {
    // The guard must not swallow the case the helper exists for.
    setLayout(LAYOUT);
    withViewport({ height: LAYOUT - 120, offsetTop: 0, scale: 1 });
    expect(viewportInsetFrom(LAYOUT - 120)).toBe(120);
  });

  it('tolerates a browser that reports no offsetTop or no scale', () => {
    setLayout(LAYOUT);
    withViewport({ height: LAYOUT - 60 });
    expect(viewportInsetFrom(LAYOUT - 60)).toBe(60);
  });
});
