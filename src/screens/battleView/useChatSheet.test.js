// src/screens/battleView/useChatSheet.test.js
//
// Phase A (A4) — the sheet's detent machine, the pure half: the keyboard cycle,
// the one-detent pull, the open state, and the heights each detent resolves
// to. The mounted behaviour (focus, the door, the crossing) is in
// AgentBattleScreen.layout.jsdom.test.jsx; these rows pin the arithmetic the
// A4 review found unguarded (L4-M12c / M12d).

import { describe, it, expect } from 'vitest';
import {
  SHEET_DETENT,
  SHEET_PEEK_PX,
  SHEET_FULL_TOP_GAP_PX,
  SHEET_HALF_RATIO,
  DEFAULT_VIEWPORT_HEIGHT,
  isDetent,
  isSheetOpen,
  nextDetent,
  raiseDetent,
  lowerDetent,
  detentHeightPx,
  readViewportHeight,
  viewportInsetFrom,
} from './useChatSheet';

const { PEEK, HALF, FULL } = SHEET_DETENT;

describe('the cycle — peek → half → full → peek', () => {
  it('advances one step and wraps', () => {
    expect(nextDetent(PEEK)).toBe(HALF);
    expect(nextDetent(HALF)).toBe(FULL);
    expect(nextDetent(FULL)).toBe(PEEK);
  });

  it('an unknown detent reads as peek', () => {
    expect(nextDetent('sideways')).toBe(HALF);
    expect(isDetent('sideways')).toBe(false);
    expect(isDetent(HALF)).toBe(true);
  });
});

describe('the pull — one detent at a time, saturating at the ends', () => {
  it('raises peek → half → full and stays at full', () => {
    expect(raiseDetent(PEEK)).toBe(HALF);
    expect(raiseDetent(HALF)).toBe(FULL);
    expect(raiseDetent(FULL)).toBe(FULL);
  });

  it('lowers full → half → peek and stays at peek', () => {
    expect(lowerDetent(FULL)).toBe(HALF);
    expect(lowerDetent(HALF)).toBe(PEEK);
    expect(lowerDetent(PEEK)).toBe(PEEK);
  });

  it('raise and lower are inverses on the middle detent', () => {
    expect(lowerDetent(raiseDetent(HALF))).toBe(HALF);
    expect(raiseDetent(lowerDetent(HALF))).toBe(HALF);
  });
});

describe('open means half or full', () => {
  it('peek is closed; half and full are open', () => {
    expect(isSheetOpen(PEEK)).toBe(false);
    expect(isSheetOpen(HALF)).toBe(true);
    expect(isSheetOpen(FULL)).toBe(true);
    expect(isSheetOpen(undefined)).toBe(false);
  });
});

describe('the heights', () => {
  it('peek is the constant; half is the ratio; full leaves the top gap', () => {
    expect(detentHeightPx(PEEK, 800)).toBe(SHEET_PEEK_PX);
    expect(detentHeightPx(HALF, 800)).toBe(Math.round(800 * SHEET_HALF_RATIO));
    expect(detentHeightPx(HALF, 800)).toBe(400);
    expect(detentHeightPx(FULL, 800)).toBe(800 - SHEET_FULL_TOP_GAP_PX);
    expect(detentHeightPx(FULL, 800)).toBe(744);
  });

  it('never below peek on a tiny viewport; a bad viewport falls back to the default', () => {
    expect(detentHeightPx(HALF, 100)).toBe(SHEET_PEEK_PX);
    expect(detentHeightPx(FULL, 100)).toBe(SHEET_PEEK_PX);
    expect(detentHeightPx(HALF, 0)).toBe(Math.round(DEFAULT_VIEWPORT_HEIGHT * SHEET_HALF_RATIO));
    expect(detentHeightPx(HALF, NaN)).toBe(Math.round(DEFAULT_VIEWPORT_HEIGHT * SHEET_HALF_RATIO));
    expect(detentHeightPx(FULL, undefined)).toBe(DEFAULT_VIEWPORT_HEIGHT - SHEET_FULL_TOP_GAP_PX);
  });

  it('with no window (the server paint) the viewport is the default', () => {
    expect(typeof window).toBe('undefined');
    expect(readViewportHeight()).toBe(DEFAULT_VIEWPORT_HEIGHT);
  });

  it('with no window the F3 inset is zero, not NaN', () => {
    // The server paint reaches viewportInsetFrom too — it is read during
    // render, not in an effect. `window.innerHeight` would throw here and
    // arithmetic on undefined would yield NaN, which React writes into the
    // style as `bottom: NaNpx` and the browser drops, silently returning the
    // mark to the corner F3 moved it out of. The windowed arithmetic is in
    // viewportInset.jsdom.test.js.
    expect(typeof window).toBe('undefined');
    expect(viewportInsetFrom(600)).toBe(0);
  });
});
