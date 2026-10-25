// @vitest-environment jsdom
//
// Command Center hub, slice S7 — ShadowCanvas, the moving form of the one
// swappable Shadow (rulings R-S7-1 … R-S7-5; spec V1.2 §10). jsdom has no
// canvas, frames or observers, so __fixtures__/shadowCanvasKit.js supplies a
// recording 2D context, a controllable requestAnimationFrame, an
// IntersectionObserver and document visibility. These rows prove the routing
// (canvas or still), what is drawn, when the loop runs and stops, that every
// frame, observer, listener and timeout is released, and when the response
// answers. Real frame rates are measured in headless Edge, not here.

import React from 'react';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ShadowCanvas, { FLASH_MS } from './ShadowCanvas';
import { injectTokens, mount } from './__fixtures__/hubTestKit';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let kit;
let mounted = [];
const seeded = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => { kit = installFakeCanvas(); });
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  kit.restore();
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
const R = (size) => size / 2.5;
const tick = (n = 1, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };
/** Arcs drawn in the nth frame the context recorded (0 = the first). */
const arcsOfFrame = (n) => kit.log.frames[n].arcs;
const lastFrameArcs = () => arcsOfFrame(kit.log.frames.length - 1);

describe('routing — the canvas, or the still on every other route (R-S7-1)', () => {
  it('draws one canvas in a fixed size × size box, with the design\'s label for the state', () => {
    const m = draw({ size: 260, tier: 'mid' });
    expect(box(m).style.width).toBe('260px');
    expect(box(m).style.height).toBe('260px');
    expect(box(m).hasAttribute('data-shadow-canvas')).toBe(true);
    const canvas = box(m).querySelector('canvas');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Shadow — ambient');
    expect(canvas.style.width).toBe('260px');
    expect(m.host.querySelector('svg')).toBeNull();
    expect(box(m).getAttribute('data-shadow-reduced-motion')).toBe('false');
  });

  it('names the state and the selected area: ambient, processing, and the area', () => {
    expect(draw({ status: 'processing' }).host.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — processing');
    expect(draw({ selectedArea: 2 }).host.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient; Equipped Archetype selected');
    expect(draw({ status: 'processing', selectedArea: 0 }).host.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — processing; Partnership selected');
    expect(draw({ status: 'nonsense', selectedArea: 7 }).host.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient');
  });

  it('an area that is not 0, 1 or 2 is no area: it draws exactly the unselected form, and names none', () => {
    const run = (selectedArea) => {
      const m = draw({ selectedArea, tier: 'mid' });
      tick(3);
      const out = JSON.stringify([kit.log.strokeStyles, kit.log.arcs]);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      return out;
    };
    const none = run(null);
    expect(run(7)).toBe(none);
    expect(run(-1)).toBe(none);
    expect(run(1)).not.toBe(none);
  });

  it('hands its box to the stage through boxRef, as the still does', () => {
    const ref = React.createRef();
    draw({ boxRef: ref });
    expect(ref.current?.hasAttribute('data-shadow-box')).toBe(true);
  });

  it('is not a live region and carries no aria-live: the status line stays the one', () => {
    const m = draw({});
    expect(m.host.querySelector('[aria-live]')).toBeNull();
    expect(m.host.querySelector('[role="status"]')).toBeNull();
  });

  describe.each([
    ['reduced motion', { reducedMotion: true }],
    ['the phone constant (stillOnly)', { stillOnly: true }],
  ])('%s', (_name, props) => {
    it('draws the ShadowStill — an svg, labelled "still" even while processing — and starts nothing', () => {
      const ref = React.createRef();
      const m = draw({ ...props, status: 'processing', selectedArea: 1, boxRef: ref });
      expect(m.host.querySelector('canvas')).toBeNull();
      expect(m.host.querySelector('svg').getAttribute('aria-label')).toBe('Shadow — still; Shared Research selected');
      expect(box(m).getAttribute('data-shadow-status')).toBe('still');
      expect(ref.current).toBe(box(m));
      expect(kit.contexts).toHaveLength(0);
      expect(kit.raf.requested).toBe(0);
      expect(kit.observers).toHaveLength(0);
      expect(kit.listeners.added).toBe(0);
    });
  });

  it('reduced motion is the still\'s own flag: the box records it', () => {
    expect(box(draw({ reducedMotion: true })).getAttribute('data-shadow-reduced-motion')).toBe('true');
  });

  it.each([['returns nothing', 'null'], ['throws', 'throw']])('getContext("2d") %s: the box swaps to the still, labelled "still", with no frame, observer or listener left', (_what, mode) => {
    kit.state.context = mode;
    const m = draw({ status: 'processing' });
    expect(m.host.querySelector('canvas')).toBeNull();
    expect(m.host.querySelector('svg').getAttribute('aria-label')).toBe('Shadow — still');
    expect(kit.raf.requested).toBe(0);
    expect(kit.observers).toHaveLength(0);
    expect(kit.listeners.added).toBe(0);
  });

  it('once the canvas has failed it stays the still: a new size does not try again', () => {
    kit.state.context = 'null';
    const m = draw({});
    kit.state.context = 'ok';
    m.rerender(element({ size: 300 }));
    expect(m.host.querySelector('canvas')).toBeNull();
    expect(kit.contexts).toHaveLength(0);
  });

  it('a token that does not resolve is not drawn from a guess: the still takes over', () => {
    removeTokens();
    try {
      const m = draw({});
      expect(m.host.querySelector('canvas')).toBeNull();
      expect(m.host.querySelector('svg')).not.toBeNull();
      expect(kit.raf.requested).toBe(0);
    } finally {
      removeTokens = injectTokens();
    }
  });

  it('under reduced motion the canvas never asks for a context: getContext is not even called', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    draw({ reducedMotion: true });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('what is drawn', () => {
  it('draws once at mount, before any frame: low draws 30 strokes, mid 126', () => {
    draw({ tier: 'low' });
    expect(kit.log.frames).toHaveLength(1);
    expect(kit.log.frames[0].strokes).toBe(15 * 2);
    draw({ tier: 'mid' });
    expect(kit.contexts.at(-1).log.frames[0].strokes).toBe(21 * 3 * 2);
  });

  it('sizes the backing store by the device ratio, capped by the tier (low 1.5×, mid 2×), and scales the context to match', () => {
    kit.setDpr(3);
    const low = draw({ size: 200, tier: 'low' });
    expect(box(low).querySelector('canvas').width).toBe(300);
    expect(kit.log.setTransform[0]).toEqual([1.5, 0, 0, 1.5, 0, 0]);
    const mid = draw({ size: 200, tier: 'mid' });
    expect(box(mid).querySelector('canvas').width).toBe(400);
    kit.setDpr(1);
    const one = draw({ size: 200, tier: 'mid' });
    expect(box(one).querySelector('canvas').height).toBe(200);
  });

  it('each frame draws once more, and asks for the next', () => {
    draw({});
    expect(kit.raf.queue).toHaveLength(1);
    tick();
    expect(kit.log.frames).toHaveLength(2);
    expect(kit.raf.queue).toHaveLength(1);
    tick(5);
    expect(kit.log.frames).toHaveLength(7);
  });

  it('draws only in the three token colours: every stroke is a mix of teal-2 and teal', () => {
    draw({ tier: 'mid' });
    tick(3);
    for (const s of kit.log.strokeStyles) {
      const m = /^rgba\((\d+),(\d+),(\d+),/.exec(s);
      expect(m, s).not.toBeNull();
      expect(Number(m[1])).toBeGreaterThanOrEqual(94);
      expect(Number(m[1])).toBeLessThanOrEqual(127);
      expect(Number(m[2])).toBeGreaterThanOrEqual(212);
      expect(Number(m[2])).toBeLessThanOrEqual(234);
    }
  });

  it('ambient: the core holds its size; processing: it pulses on a clock running 1.6× — and only then', () => {
    draw({ size: 200, status: 'ambient' });
    tick();
    expect(kit.log.arcs[arcsOfFrame(0)][2]).toBeCloseTo(R(200) * 0.11, 10);
    draw({ size: 200, status: 'processing' });
    tick();
    const t = 0.016 * 1.6;
    const second = kit.contexts.at(-1).log;
    expect(second.arcs[second.frames[0].arcs][2]).toBeCloseTo(R(200) * 0.11 * (1 + 0.18 * Math.sin(t * 5)), 10);
  });

  it('a status change reaches the running loop without restarting it', () => {
    const m = draw({ status: 'ambient' });
    const observers = kit.observers.length;
    tick();
    m.rerender(element({ status: 'processing' }));
    tick();
    expect(kit.observers).toHaveLength(observers);
    expect(kit.log.setTransform).toHaveLength(1);
    const pulsed = kit.log.arcs[arcsOfFrame(0) + arcsOfFrame(1)][2];
    expect(pulsed).not.toBeCloseTo(R(200) * 0.11, 6);
  });

  it('a long gap between frames advances the clock by at most 0.05 s (a frame after a pause does not jump)', () => {
    draw({ size: 200, status: 'processing' });
    tick(16);
    kit.tick(5000);
    const t = 0.016 * 1.6 * 16 + 0.05 * 1.6;
    const log = kit.log;
    const frameStart = log.frames.slice(0, -1).reduce((n, f) => n + f.arcs, 0);
    expect(log.arcs[frameStart][2]).toBeCloseTo(R(200) * 0.11 * (1 + 0.18 * Math.sin(t * 5)), 10);
  });

  it('ambient signals and flares appear after a moment and are drawn from the injected random, never Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    draw({ random: seeded(5) });
    const baseline = arcsOfFrame(0);
    tick(60);
    expect(Math.max(...kit.log.frames.map((f) => f.arcs))).toBeGreaterThan(baseline);
    expect(spy).not.toHaveBeenCalled();
  });

  it('is deterministic: the same seeded random draws the same frames; another seed does not', () => {
    const run = (seed) => {
      const m = draw({ random: seeded(seed), tier: 'mid' });
      tick(120);
      const out = JSON.stringify([kit.log.strokeStyles, kit.log.arcs]);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      return out;
    };
    const a = run(11);
    const b = run(11);
    const c = run(12);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('with no random given it still runs (Math.random is the default)', () => {
    const m = mount(<ShadowCanvas size={200} tier="low" />);
    mounted.push(m);
    tick(60);
    expect(kit.log.frames.length).toBe(61);
  });
});

describe('lifetime — the loop stops when it cannot be seen, and resumes (R-S7-5)', () => {
  it('a hidden document stops the loop at once, and returning restarts it', () => {
    draw({});
    tick();
    kit.setHidden(true);
    expect(kit.raf.queue).toHaveLength(0);
    const frames = kit.log.frames.length;
    tick(3);
    expect(kit.log.frames).toHaveLength(frames);
    kit.setHidden(false);
    expect(kit.raf.queue).toHaveLength(1);
    tick();
    expect(kit.log.frames).toHaveLength(frames + 1);
  });

  it('an offscreen box stops the loop (IntersectionObserver), and coming back restarts it', () => {
    draw({});
    expect(kit.observers).toHaveLength(1);
    expect(kit.observers[0].targets.size).toBe(1);
    kit.intersect(false);
    expect(kit.raf.queue).toHaveLength(0);
    const frames = kit.log.frames.length;
    tick(3);
    expect(kit.log.frames).toHaveLength(frames);
    kit.intersect(true);
    tick();
    expect(kit.log.frames).toHaveLength(frames + 1);
  });

  it('hidden AND offscreen needs both to clear: one return is not enough', () => {
    draw({});
    kit.setHidden(true);
    kit.intersect(false);
    kit.setHidden(false);
    expect(kit.raf.queue).toHaveLength(0);
    kit.intersect(true);
    expect(kit.raf.queue).toHaveLength(1);
  });

  it('a mount while hidden draws one frame and starts no loop', () => {
    kit.setHidden(true);
    draw({});
    expect(kit.log.frames).toHaveLength(1);
    expect(kit.raf.queue).toHaveLength(0);
  });

  it('paused (the root ceremony covers the page) stops the loop, and releasing it restarts — without rebuilding the canvas', () => {
    const m = draw({});
    tick();
    m.rerender(element({ paused: true }));
    expect(kit.raf.queue).toHaveLength(0);
    const frames = kit.log.frames.length;
    tick(3);
    expect(kit.log.frames).toHaveLength(frames);
    m.rerender(element({ paused: false }));
    expect(kit.raf.queue).toHaveLength(1);
    tick();
    expect(kit.log.frames).toHaveLength(frames + 1);
    expect(kit.observers).toHaveLength(1);
    expect(kit.log.setTransform).toHaveLength(1);
    expect(kit.listeners.added).toBe(1);
  });

  it('a mount while paused draws one frame and starts no loop', () => {
    draw({ paused: true });
    expect(kit.log.frames).toHaveLength(1);
    expect(kit.raf.queue).toHaveLength(0);
  });

  it('never runs two loops: a restart after a stop asks for one frame, not two', () => {
    draw({});
    for (let i = 0; i < 4; i += 1) { kit.setHidden(true); kit.setHidden(false); }
    expect(kit.raf.queue).toHaveLength(1);
    const frames = kit.log.frames.length;
    tick();
    expect(kit.log.frames).toHaveLength(frames + 1);
  });
});

describe('cleanup — an unmount, a size change, a tier change and a route change release everything (R-S7-5)', () => {
  it('an unmount cancels the frame, disconnects the observer and removes the listener', () => {
    const m = draw({});
    tick();
    expect(kit.listeners.added).toBe(1);
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(kit.raf.queue).toHaveLength(0);
    expect(kit.observers.every((o) => o.disconnected)).toBe(true);
    expect(kit.listeners.removed).toBe(kit.listeners.added);
    const frames = kit.log.frames.length;
    tick(3);
    expect(kit.log.frames).toHaveLength(frames);
  });

  it('a size change tears the old loop down and starts exactly one new one', () => {
    const m = draw({ size: 200 });
    tick();
    m.rerender(element({ size: 300 }));
    expect(kit.observers).toHaveLength(2);
    expect(kit.observers[0].disconnected).toBe(true);
    expect(kit.observers[1].disconnected).toBe(false);
    expect(kit.listeners.added).toBe(2);
    expect(kit.listeners.removed).toBe(1);
    expect(kit.raf.queue).toHaveLength(1);
    expect(box(m).querySelector('canvas').width).toBe(Math.round(300 * Math.min(window.devicePixelRatio || 1, 1.5)));
    const frames = kit.log.frames.length;
    tick();
    expect(kit.log.frames).toHaveLength(frames + 1);
  });

  it('a tier change does the same, and draws the new tier', () => {
    const m = draw({ tier: 'low' });
    m.rerender(element({ tier: 'mid' }));
    expect(kit.observers[0].disconnected).toBe(true);
    expect(kit.listeners.added - kit.listeners.removed).toBe(1);
    expect(kit.raf.queue).toHaveLength(1);
    expect(kit.log.frames.at(-1).strokes).toBe(21 * 3 * 2);
    tick();
    expect(kit.log.frames.at(-1).strokes).toBe(21 * 3 * 2);
  });

  it('a tier change drops the effects that name a strand the new tier lacks: nothing is drawn from a missing strand', () => {
    const m = draw({ tier: 'mid' });
    tick(60);
    // The quiet random puts the first signal on the last of mid's 21 strands; low has 15.
    m.rerender(element({ tier: 'low' }));
    tick(3);
    expect(kit.log.arcs.length).toBeGreaterThan(0);
    expect(kit.log.arcs.every((arc) => arc.every(Number.isFinite))).toBe(true);
  });

  it('a re-render with the same size and tier keeps the loop: no observer or listener churn', () => {
    const m = draw({});
    for (let i = 0; i < 4; i += 1) m.rerender(element({ selectedArea: i % 3, status: i % 2 ? 'processing' : 'ambient' }));
    expect(kit.observers).toHaveLength(1);
    expect(kit.listeners.added).toBe(1);
    expect(kit.listeners.removed).toBe(0);
  });

  it('reduced motion switched on mid-run releases the loop and shows the still; switched off, a fresh loop starts', () => {
    const m = draw({});
    tick();
    m.rerender(element({ reducedMotion: true }));
    expect(m.host.querySelector('canvas')).toBeNull();
    expect(m.host.querySelector('svg')).not.toBeNull();
    expect(kit.raf.queue).toHaveLength(0);
    expect(kit.observers.every((o) => o.disconnected)).toBe(true);
    expect(kit.listeners.removed).toBe(kit.listeners.added);
    m.rerender(element({ reducedMotion: false }));
    expect(m.host.querySelector('canvas')).not.toBeNull();
    expect(kit.raf.queue).toHaveLength(1);
    expect(kit.listeners.added - kit.listeners.removed).toBe(1);
  });

  it('the still\'s flash timeout is cleared on unmount', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const m = draw({ reducedMotion: true });
    m.rerender(element({ reducedMotion: true, areaEvent: 1 }));
    expect(vi.getTimerCount()).toBe(1);
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the response — the center bloom, and the still\'s brief flash (R-S7-3)', () => {
  // With a quiet random, 20 frames (0.32 s) hold no signal and no flare: a frame is the core, the three echo nodes, and
  // a response adds its glow and its ring.
  const BASE = 4;

  it('a new area selection (areaEvent moves) blooms: a glow at the center and one ring', () => {
    const m = draw({});
    tick(3);
    expect(lastFrameArcs()).toBe(BASE);
    m.rerender(element({ areaEvent: 1 }));
    tick();
    expect(lastFrameArcs()).toBe(BASE + 2);
    const ring = kit.log.arcs.at(-1);
    expect(ring[0]).toBe(100);
    expect(ring[2]).toBeGreaterThan(R(200) * 0.12);
  });

  // Past 0.6 s ambient signals join the frame, so longer runs compare a Shadow that answered with a control that did not,
  // ticked in lockstep from the same quiet random: the response is exactly the difference between them.
  const pair = (props = {}) => {
    const control = draw(props);
    const subject = draw(props);
    const frames = (m) => kit.contexts[m === control ? 0 : 1].log.frames;
    return { control, subject, diff: () => frames(subject).map((f, i) => f.arcs - frames(control)[i].arcs) };
  };

  it('the ring runs 0.9 s of Shadow\'s clock, the glow 1.2 s, and then the frame is as before', () => {
    const { subject, diff } = pair();
    subject.rerender(element({ areaEvent: 1 }));
    tick(100);
    const d = diff();
    // Frame n is drawn at clock 0.016 n: the ring and the glow (+2) until 0.9 s, the glow alone (+1) until 1.2 s.
    expect(d.slice(1, 55)).toEqual(new Array(54).fill(2));
    expect(d.slice(58, 74)).toEqual(new Array(16).fill(1));
    expect(d.slice(77)).toEqual(new Array(d.length - 77).fill(0));
  });

  it('a response late in a session blooms at once: it is stamped on Shadow\'s clock now, not at zero', () => {
    const { subject, diff } = pair();
    tick(100);
    subject.rerender(element({ areaEvent: 1 }));
    tick();
    expect(diff().at(-1)).toBe(2);
    tick(30);
    expect(diff().at(-1)).toBe(2);
  });

  it('re-rendering with the same areaEvent, or changing only the selected area, is no response (a tab switch, a re-select)', () => {
    const m = draw({ areaEvent: 2 });
    tick(2);
    m.rerender(element({ areaEvent: 2 }));
    m.rerender(element({ areaEvent: 2, selectedArea: 1 }));
    m.rerender(element({ areaEvent: 2, selectedArea: 0 }));
    tick();
    expect(lastFrameArcs()).toBe(BASE);
  });

  it('an attempt\'s created terminal blooms once per attempt id', () => {
    const { subject, diff } = pair();
    tick(2);
    subject.rerender(element({ createdAttemptId: 'attempt-1' }));
    tick();
    expect(diff().at(-1)).toBe(2);
    tick(80);
    expect(diff().at(-1)).toBe(0);
    subject.rerender(element({ createdAttemptId: 'attempt-1' }));
    subject.rerender(element({ createdAttemptId: null }));
    subject.rerender(element({ createdAttemptId: 'attempt-1' }));
    tick();
    expect(diff().at(-1)).toBe(0);
    subject.rerender(element({ createdAttemptId: 'attempt-2' }));
    tick();
    expect(diff().at(-1)).toBe(2);
  });

  it('a terminal that was already created at mount is the past: no bloom, however long it stays', () => {
    const m = draw({ createdAttemptId: 'attempt-1' });
    tick(3);
    expect(lastFrameArcs()).toBe(BASE);
    m.rerender(element({ createdAttemptId: 'attempt-1', status: 'ambient' }));
    tick();
    expect(lastFrameArcs()).toBe(BASE);
  });

  it('never on a status change: processing begins and ends with no bloom of its own', () => {
    const m = draw({});
    tick(2);
    m.rerender(element({ status: 'processing' }));
    tick();
    expect(lastFrameArcs()).toBe(BASE);
    m.rerender(element({ status: 'ambient' }));
    tick();
    expect(lastFrameArcs()).toBe(BASE);
  });

  it('a response asked for while the loop is stopped plays when it resumes, on Shadow\'s own clock', () => {
    const m = draw({});
    tick(2);
    m.rerender(element({ paused: true }));
    m.rerender(element({ paused: true, areaEvent: 1 }));
    tick(5);
    expect(lastFrameArcs()).toBe(BASE);
    m.rerender(element({ paused: false, areaEvent: 1 }));
    tick();
    expect(lastFrameArcs()).toBe(BASE + 2);
  });

  describe.each([
    ['reduced motion', { reducedMotion: true }],
    ['the phone constant', { stillOnly: true }],
  ])('under %s — the still\'s brief flash', (_name, props) => {
    const flashing = (m) => box(m).hasAttribute('data-shadow-flash');
    const opacities = (m) => [...m.host.querySelectorAll('[data-shadow-strand] path:last-child')].map((p) => Number(p.getAttribute('stroke-opacity')));

    it('an area selection lifts the still for FLASH_MS (420 ms) and then lets it down', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw(props);
      const rest = opacities(m);
      expect(flashing(m)).toBe(false);
      m.rerender(element({ ...props, areaEvent: 1 }));
      expect(flashing(m)).toBe(true);
      expect(opacities(m).every((o, i) => o >= rest[i] && o <= 1)).toBe(true);
      expect(opacities(m)).not.toEqual(rest);
      act(() => { vi.advanceTimersByTime(FLASH_MS - 1); });
      expect(flashing(m)).toBe(true);
      act(() => { vi.advanceTimersByTime(1); });
      expect(flashing(m)).toBe(false);
      expect(opacities(m)).toEqual(rest);
      expect(FLASH_MS).toBe(420);
    });

    it('a created terminal flashes once per attempt; the same attempt again does not', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw(props);
      m.rerender(element({ ...props, createdAttemptId: 'a-1' }));
      expect(flashing(m)).toBe(true);
      act(() => { vi.advanceTimersByTime(FLASH_MS); });
      expect(flashing(m)).toBe(false);
      m.rerender(element({ ...props, createdAttemptId: null }));
      m.rerender(element({ ...props, createdAttemptId: 'a-1' }));
      expect(flashing(m)).toBe(false);
    });

    it('a second response inside the window restarts it, with one timer at a time', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw(props);
      m.rerender(element({ ...props, areaEvent: 1 }));
      act(() => { vi.advanceTimersByTime(300); });
      m.rerender(element({ ...props, areaEvent: 2 }));
      expect(vi.getTimerCount()).toBe(1);
      act(() => { vi.advanceTimersByTime(300); });
      expect(flashing(m)).toBe(true);
      act(() => { vi.advanceTimersByTime(120); });
      expect(flashing(m)).toBe(false);
    });

    it('a response behind the ceremony is owed: no flash while paused, one when it releases — however many arrived — and none after', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw(props);
      m.rerender(element({ ...props, paused: true }));
      m.rerender(element({ ...props, paused: true, areaEvent: 1 }));
      m.rerender(element({ ...props, paused: true, areaEvent: 2, createdAttemptId: 'a-1' }));
      expect(flashing(m)).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      act(() => { vi.advanceTimersByTime(5000); });
      expect(flashing(m)).toBe(false);
      m.rerender(element({ ...props, paused: false, areaEvent: 2, createdAttemptId: 'a-1' }));
      expect(flashing(m)).toBe(true);
      expect(vi.getTimerCount()).toBe(1);
      act(() => { vi.advanceTimersByTime(420); });
      expect(flashing(m)).toBe(false);
      // Nothing is owed any more: pausing and releasing again flashes nothing.
      m.rerender(element({ ...props, paused: true, areaEvent: 2, createdAttemptId: 'a-1' }));
      m.rerender(element({ ...props, paused: false, areaEvent: 2, createdAttemptId: 'a-1' }));
      expect(flashing(m)).toBe(false);
    });

    it('an unmount while a flash is owed leaves no timer', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw({ ...props, paused: true });
      m.rerender(element({ ...props, paused: true, areaEvent: 1 }));
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('nothing flashes at mount, on a re-render, or for a selected-area change alone', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const m = draw({ ...props, areaEvent: 3, createdAttemptId: 'a-1' });
      expect(flashing(m)).toBe(false);
      m.rerender(element({ ...props, areaEvent: 3, createdAttemptId: 'a-1', selectedArea: 2 }));
      m.rerender(element({ ...props, areaEvent: 3, createdAttemptId: 'a-1', selectedArea: 0, status: 'processing' }));
      expect(flashing(m)).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('a getContext failure takes the same flash route', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    kit.state.context = 'null';
    const m = draw({});
    m.rerender(element({ areaEvent: 1 }));
    expect(box(m).hasAttribute('data-shadow-flash')).toBe(true);
    act(() => { vi.advanceTimersByTime(FLASH_MS); });
    expect(box(m).hasAttribute('data-shadow-flash')).toBe(false);
  });
});
