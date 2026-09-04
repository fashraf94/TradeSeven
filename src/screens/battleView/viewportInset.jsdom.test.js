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
    setLayout(0);
    expect(viewportInsetFrom(600)).toBe(0);
  });
});
