// @vitest-environment jsdom
//
// Command Center hub, slice S7 — the still's flash never lifts a stroke past full opacity (the design's min(1, …)).
// At the still's pinned moment the brightest strand is below 0.7, so the cap cannot be reached with the real geometry
// (ShadowStill.jsdom.test.jsx says so); here `stillPaths` hands back strands bright enough that 1.25× would pass 1, so
// the cap is exercised, and a build that drops it reds (the lens T review).

import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const bright = vi.hoisted(() => ({ on: false }));
vi.mock('./hub/shadowGeometry', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    stillPaths: (tier, sel) => {
      const real = actual.stillPaths(tier, sel);
      return bright.on ? real.map((p, i) => ({ ...p, alpha: [0.5, 0.8, 0.95, 1][i % 4] })) : real;
    },
  };
});

import ShadowStill from './ShadowStill';
import { injectTokens, mount } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; bright.on = false; });

const strokeOpacities = (flash) => {
  const m = mount(<ShadowStill size={200} tier="low" flash={flash} />);
  mounted.push(m);
  return [...m.host.querySelectorAll('[data-shadow-strand] path:last-child')].map((p) => Number(p.getAttribute('stroke-opacity')));
};

describe('ShadowStill — the flash is capped at full opacity', () => {
  it('a strand already near full lights to exactly 1, never beyond; the dimmer ones lift by 1.25', () => {
    bright.on = true;
    const rest = strokeOpacities(false);
    const lit = strokeOpacities(true);
    expect(rest.slice(0, 4)).toEqual([0.5, 0.8, 0.95, 1]);
    expect(lit.slice(0, 4)).toEqual([0.625, 1, 1, 1]);
    expect(Math.max(...lit)).toBe(1);
  });
});
