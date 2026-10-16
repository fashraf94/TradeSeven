// @vitest-environment jsdom
//
// Command Center hub, slice S1 — ShadowStill, the one swappable Shadow
// component (ruling R-S1-1): its props contract, its fixed box, its labels
// (ambient / still / processing, spec §10) and its colours, which are
// computed token hexes, never var() (SVG attributes, hazard H8).

import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import ShadowStill from './ShadowStill';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { mixHex, stillPaths } from './hub/shadowGeometry';
import { injectTokens, mount } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; });

const draw = (props) => {
  const m = mount(<ShadowStill size={200} {...props} />);
  mounted.push(m);
  return m.host;
};

describe('ShadowStill — the box', () => {
  it('is a fixed size × size box holding one SVG of the same size, on the design\'s viewBox', () => {
    const host = draw({ size: 340 });
    const box = host.querySelector('[data-shadow-box]');
    expect(box.style.width).toBe('340px');
    expect(box.style.height).toBe('340px');
    const svg = box.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('340');
    expect(svg.getAttribute('viewBox')).toBe('-1.25 -1.25 2.5 2.5');
  });

  it('hands its box to the stage through boxRef, the one thing the stage measures', () => {
    const ref = React.createRef();
    draw({ boxRef: ref });
    expect(ref.current?.hasAttribute('data-shadow-box')).toBe(true);
  });
});

describe('ShadowStill — the geometry per tier (spec §10: start sparse)', () => {
  it.each([['low', 15, 1], ['mid', 21, 2], ['high', 27, 2]])('%s draws %i strands, %i path(s) each', (tier, strands, pathsEach) => {
    const host = draw({ tier });
    const groups = host.querySelectorAll('[data-shadow-strand]');
    expect(groups).toHaveLength(strands);
    for (const g of groups) expect(g.querySelectorAll('path')).toHaveLength(pathsEach);
  });

  it('draws exactly the geometry module\'s paths, for the selected area', () => {
    const host = draw({ tier: 'mid', selectedArea: 1 });
    const drawn = [...host.querySelectorAll('[data-shadow-strand] path:last-child')].map((p) => p.getAttribute('d'));
    expect(drawn).toEqual(stillPaths('mid', 1).map((p) => p.d));
  });

  it('an out-of-range area draws the unselected form', () => {
    const host = draw({ tier: 'low', selectedArea: 7 });
    const drawn = [...host.querySelectorAll('[data-shadow-strand] path:last-child')].map((p) => p.getAttribute('d'));
    expect(drawn).toEqual(stillPaths('low', null).map((p) => p.d));
  });
});

describe('ShadowStill — colour from the tokens, as computed hexes', () => {
  it('each strand mixes teal-2 (far) into teal (near) by its depth', () => {
    const host = draw({ tier: 'low' });
    const strokes = [...host.querySelectorAll('[data-shadow-strand] path')].map((p) => p.getAttribute('stroke'));
    const expected = stillPaths('low', null).map((p) => mixHex('#7fd4ff', '#5eead4', p.depth));
    expect(strokes).toEqual(expected);
    expect(strokes.every((s) => /^#[0-9a-f]{6}$/.test(s))).toBe(true);
  });

  it('the gradients\' stops are the teal and white tokens, never var()', () => {
    const host = draw({});
    const stops = [...host.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color'));
    expect(new Set(stops)).toEqual(new Set(['#5eead4', '#ffffff']));
    expect(host.innerHTML).not.toMatch(/var\(/);
  });
});

describe('ShadowStill — its label names what it shows', () => {
  it.each([
    ['still', null, 'Shadow — still'],
    ['processing', 2, 'Shadow — processing; Equipped Archetype selected'],
    ['ambient', 0, 'Shadow — ambient; Partnership selected'],
    ['nonsense', 1, 'Shadow — still; Shared Research selected'],
  ])('status %s, area %s → "%s"', (status, selectedArea, label) => {
    const host = draw({ status, selectedArea });
    expect(host.querySelector('svg').getAttribute('role')).toBe('img');
    expect(host.querySelector('svg').getAttribute('aria-label')).toBe(label);
    expect(label.startsWith(COPY.shadow.name)).toBe(true);
  });

  it('defaults to the still (S1 draws no motion) and records reduced motion without changing the drawing', () => {
    const a = draw({ tier: 'mid', reducedMotion: false });
    const b = draw({ tier: 'mid', reducedMotion: true });
    expect(a.querySelector('[data-shadow-box]').getAttribute('data-shadow-status')).toBe('still');
    expect(b.querySelector('[data-shadow-box]').getAttribute('data-shadow-reduced-motion')).toBe('true');
    const paths = (h) => [...h.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(paths(b)).toEqual(paths(a));
  });
});
