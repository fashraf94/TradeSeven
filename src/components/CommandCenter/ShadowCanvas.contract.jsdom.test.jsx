// @vitest-environment jsdom
//
// Command Center hub, slice S7 — ShadowCanvas's contract with its box and its colours, and what it must never do
// (rulings R-S7-1 … R-S7-5; the lens T review of the first test pass). ShadowCanvas.jsdom.test.jsx proves the routes,
// the loop's lifetime and the response; these rows pin the parts a stand-in could otherwise hide:
//
//   - which TOKEN plays which ROLE (near, far, core), read from the gradient stops and strokes the context received;
//   - that a resize of the backing store comes BEFORE the transform that scales it (a real context loses its
//     transform on a resize, so the other order draws at 1×);
//   - the box: the observed element and its options, the fixed size, flexShrink 0;
//   - R-S7-2: no device probe, no clock of its own, no second media query, no frame-cost downgrade — behaviour and source;
//   - the default `random`, and a flash owed behind the cover that the canvas's own route must not keep.

import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ShadowCanvas from './ShadowCanvas';
import { injectTokens, mount } from './__fixtures__/hubTestKit';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let kit;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => { kit = installFakeCanvas(); });
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  kit.restore();
  for (const name of ['--ft-teal', '--ft-teal-2', '--ft-white']) document.documentElement.style.removeProperty(name);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const quiet = () => 0.99;
const element = (props = {}) => <ShadowCanvas size={200} tier="low" random={quiet} {...props} />;
function draw(props) {
  const m = mount(element(props));
  mounted.push(m);
  return m;
}
const box = (m) => m.host.querySelector('[data-shadow-box]');
const tick = (n = 1, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };

describe('colour roles — the three tokens, each in its own role', () => {
  // Three tokens bound to colours that share no channel value, so a swapped role cannot pass as another.
  const NEAR = [10, 20, 30];
  const FAR = [40, 60, 80];
  const CORE = [80, 90, 100];
  const bind = () => {
    const root = document.documentElement.style;
    root.setProperty('--ft-teal', '#0a141e');
    root.setProperty('--ft-teal-2', '#283c50');
    root.setProperty('--ft-white', '#505a64');
  };
  const rgbaOf = (s) => {
    const m = /^rgba\((\d+),(\d+),(\d+),([^)]+)\)$/.exec(s);
    return m ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) } : null;
  };

  it('the halo, the core and the echo nodes: teal is the near colour everywhere but the cores of the glows, which are the white token', () => {
    bind();
    draw({ tier: 'low' });
    const roles = kit.log.stops.map((s) => s.base);
    const n = NEAR.join(',');
    const c = CORE.join(',');
    // The frame the mount draws, in order: the halo (3 stops), the core (3), then the two eyes and the crown (3 each).
    expect(roles).toEqual([n, n, n, c, n, n, c, n, n, c, n, n, c, n, n]);
    expect(kit.log.stops.map((s) => s.offset)).toEqual([0, 0.55, 1, 0, 0.35, 1, 0, 0.35, 1, 0, 0.35, 1, 0, 0.35, 1]);
    expect(kit.log.stops.map((s) => s.alpha).slice(0, 3)).toEqual([0.1, 0.035, 0]);
    expect(kit.log.stops.map((s) => s.alpha).slice(3, 6)).toEqual([0.95, 0.55, 0]);
    const node = kit.log.stops.slice(6, 9).map((s) => s.alpha);
    expect(node[0]).toBeCloseTo(0.855, 10);
    expect(node[1]).toBeCloseTo(0.45, 10);
    expect(node[2]).toBe(0);
  });

  it('every strand runs from the far colour to the near colour by depth — the deeper (brighter) the run, the nearer its colour', () => {
    bind();
    draw({ tier: 'low' });
    expect(kit.log.strokeStyles).toHaveLength(30);
    let discriminating = 0;
    for (const style of kit.log.strokeStyles) {
      const { rgb, a } = rgbaOf(style);
      // No selection, no lift: a = 0.16 + 0.68 · depth.
      const dep = (a - 0.16) / 0.68;
      expect(dep).toBeGreaterThanOrEqual(-1e-9);
      expect(dep).toBeLessThanOrEqual(1 + 1e-9);
      const want = rgb.map((_, k) => FAR[k] + (NEAR[k] - FAR[k]) * dep);
      const swapped = rgb.map((_, k) => NEAR[k] + (FAR[k] - NEAR[k]) * dep);
      rgb.forEach((v, k) => expect(Math.abs(v - want[k])).toBeLessThanOrEqual(1));
      if (rgb.some((v, k) => Math.abs(v - swapped[k]) > 3)) discriminating += 1;
    }
    // The check can tell the roles apart: most strokes are far from their swapped colour.
    expect(discriminating).toBeGreaterThan(10);
  });

  it('the signals\' dots are filled in the core colour', () => {
    bind();
    draw({ tier: 'low', random: () => 0 });
    tick(60);
    const dots = kit.log.fills.filter((f) => typeof f === 'string' && f.startsWith('rgba('));
    expect(dots.length).toBeGreaterThan(0);
    for (const f of dots) expect(rgbaOf(f).rgb).toEqual(CORE);
  });

  it('a stroke is never drawn in a colour no token gave: with all three rebound, no other triple appears in a frame\'s gradients', () => {
    bind();
    draw({ tier: 'mid' });
    tick(40);
    const allowed = new Set([NEAR.join(','), CORE.join(',')]);
    for (const s of kit.log.stops) expect(allowed.has(s.base), s.color).toBe(true);
  });
});

describe('the backing store — resized, then scaled (a resize clears the transform)', () => {
  it('width, height, then setTransform, at mount', () => {
    draw({});
    expect(kit.log.ops).toEqual(['resize', 'resize', 'transform']);
  });

  it('and again in that order for a new size and for a new tier, each run building the store before scaling it', () => {
    kit.setDpr(2);
    const m = draw({ size: 200, tier: 'low' });
    m.rerender(element({ size: 300, tier: 'low' }));
    expect(kit.log.ops).toEqual(['resize', 'resize', 'transform', 'resize', 'resize', 'transform']);
    m.rerender(element({ size: 300, tier: 'mid' }));
    expect(kit.log.ops).toHaveLength(9);
    for (let i = 0; i < 9; i += 3) expect(kit.log.ops.slice(i, i + 3)).toEqual(['resize', 'resize', 'transform']);
    // The scale follows the tier's own cap each time: low 1.5, mid 2.
    expect(kit.log.setTransform).toEqual([[1.5, 0, 0, 1.5, 0, 0], [1.5, 0, 0, 1.5, 0, 0], [2, 0, 0, 2, 0, 0]]);
    expect(box(m).querySelector('canvas').width).toBe(600);
  });
});

describe('the box — what the stage measures and what the observer watches', () => {
  it('observes the canvas itself, once, with threshold 0', () => {
    const m = draw({});
    expect(kit.observers).toHaveLength(1);
    expect(kit.observers[0].options).toEqual({ threshold: 0 });
    expect([...kit.observers[0].targets]).toEqual([box(m).querySelector('canvas')]);
  });

  it('the box is fixed: size × size, never shrunk by a flex parent, holding a block canvas of the same size', () => {
    const m = draw({ size: 260, tier: 'mid' });
    expect(box(m).style.width).toBe('260px');
    expect(box(m).style.height).toBe('260px');
    expect(box(m).style.flexShrink).toBe('0');
    const canvas = box(m).querySelector('canvas');
    expect(canvas.style.display).toBe('block');
    expect(canvas.style.width).toBe('260px');
    expect(canvas.style.height).toBe('260px');
  });
});

describe('R-S7-2 — no device probe, no clock of its own, no second media query, no downgrade', () => {
  it('nothing about the device is read while it mounts, runs, pauses and resumes', () => {
    const reads = [];
    for (const name of ['hardwareConcurrency', 'deviceMemory', 'connection', 'maxTouchPoints']) {
      Object.defineProperty(navigator, name, { configurable: true, get() { reads.push(name); return 2; } });
    }
    const asked = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const had = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    window.matchMedia = asked;
    try {
      const m = draw({ tier: 'mid' });
      tick(120);
      m.rerender(element({ tier: 'mid', paused: true }));
      m.rerender(element({ tier: 'mid', paused: false, areaEvent: 1, status: 'processing' }));
      tick(40);
      kit.setHidden(true);
      kit.setHidden(false);
      tick(10);
    } finally {
      for (const name of ['hardwareConcurrency', 'deviceMemory', 'connection', 'maxTouchPoints']) delete navigator[name];
      if (had) Object.defineProperty(window, 'matchMedia', had); else delete window.matchMedia;
    }
    expect(reads).toEqual([]);
    expect(asked).not.toHaveBeenCalled();
  });

  it('frames that arrive slowly never thin the strands or change the tier: every frame draws the whole tier (no self-downgrade)', () => {
    const m = draw({ tier: 'mid' });
    for (let i = 0; i < 40; i += 1) kit.tick(300);
    // The loop never gave up on slow frames: the mount's draw and one frame per tick.
    expect(kit.log.frames).toHaveLength(41);
    expect(kit.log.frames.every((f) => f.strokes === 126)).toBe(true);
    expect(kit.log.ops).toEqual(['resize', 'resize', 'transform']);
    expect(kit.observers).toHaveLength(1);
    expect(box(m).querySelector('canvas').width).toBe(Math.round(200 * Math.min(window.devicePixelRatio || 1, 2)));
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const code = (rel) => readFileSync(path.resolve(here, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const BANNED = /\b(?:navigator|hardwareConcurrency|deviceMemory|performance|PerformanceObserver|matchMedia|getBattery|shPickTier|Date)\b/;

  it('the canvas, its pure modules and the status words name none of them (a source scan)', () => {
    for (const rel of ['ShadowCanvas.jsx', 'hub/shadowCanvas.js', 'hub/shadowBloom.js', 'hub/shadowStatus.js']) {
      expect(BANNED.exec(code(rel))?.[0] ?? null, rel).toBeNull();
    }
  });

  it('the scan is not vacuous: it flags each of them when planted', () => {
    for (const line of ['performance.now()', 'navigator.hardwareConcurrency', 'navigator.deviceMemory', 'window.matchMedia(q)', 'shPickTier(s)', 'new PerformanceObserver(f)', 'Date.now()']) {
      expect(BANNED.test(line), line).toBe(true);
    }
  });
});

describe('the default random', () => {
  it('with none given the ambient flares and signals come from Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const m = mount(<ShadowCanvas size={200} tier="low" />);
    mounted.push(m);
    expect(spy).not.toHaveBeenCalled();
    tick(150);
    expect(spy.mock.calls.length).toBeGreaterThan(2);
  });

  it('and a given one replaces it entirely, including after a re-render with another', () => {
    const spy = vi.spyOn(Math, 'random');
    const first = vi.fn(() => 0.5);
    const second = vi.fn(() => 0.5);
    const m = draw({ random: first });
    tick(150);
    expect(first.mock.calls.length).toBeGreaterThan(2);
    m.rerender(element({ random: second }));
    const before = first.mock.calls.length;
    tick(150);
    expect(first.mock.calls.length).toBe(before);
    expect(second.mock.calls.length).toBeGreaterThan(2);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('a flash owed behind the cover is the still\'s debt, not the canvas\'s', () => {
  const flashing = (m) => box(m).hasAttribute('data-shadow-flash');

  it('when the canvas takes the route back, the debt is dropped: it is not paid later, when the still returns and the cover lifts', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const m = draw({ reducedMotion: true, paused: true });
    m.rerender(element({ reducedMotion: true, paused: true, areaEvent: 1 }));
    expect(flashing(m)).toBe(false);
    // The player turns reduced motion off while the ceremony still covers the page: the canvas draws, the cover lifts.
    m.rerender(element({ reducedMotion: false, paused: true, areaEvent: 1 }));
    expect(m.host.querySelector('canvas')).not.toBeNull();
    m.rerender(element({ reducedMotion: false, paused: false, areaEvent: 1 }));
    expect(vi.getTimerCount()).toBe(0);
    // And back to the still: a pause and a release flash nothing — that response was answered by the canvas's route.
    m.rerender(element({ reducedMotion: true, paused: false, areaEvent: 1 }));
    m.rerender(element({ reducedMotion: true, paused: true, areaEvent: 1 }));
    m.rerender(element({ reducedMotion: true, paused: false, areaEvent: 1 }));
    expect(flashing(m)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the debt of the still route that stays the still is still paid once on release (the existing contract)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const m = draw({ reducedMotion: true, paused: true });
    m.rerender(element({ reducedMotion: true, paused: true, areaEvent: 1 }));
    m.rerender(element({ reducedMotion: true, paused: false, areaEvent: 1 }));
    expect(flashing(m)).toBe(true);
  });
});
