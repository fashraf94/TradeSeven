// @vitest-environment jsdom
//
// src/components/AgentForm/engine/engine.lifecycle.jsdom.test.js
//
// Build S0 — the engine's life cycle, on the REAL engine with a renderer stand-in (the kit's fakeRenderer;
// the GPU is measured headless in the build report). Phase 0 report §4: nothing at load, everything made on
// the first mount and released at zero views; the loop stops when no view is live; context loss shows the
// still and restore rebuilds the environment and clears with alpha; no frame-cost self-downgrade (R-S7-2).

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentFormEngine } from './engine.js';
import { icosaCached } from './armor.js';
import { installCanvasKit, fakeGlPlatform, disposeCensus } from '../__fixtures__/agentFormKit.js';

const THEME = {
  palettes: { teal: { near: '#5eead4', far: '#7fd4ff', core: '#ecfffb' }, copper: { near: '#e8927c', far: '#f6c496', core: '#fff3ec' }, mono: { near: '#e4e8ee', far: '#848c9a', core: '#ffffff' }, unlit: { near: '#aeb6c4', far: '#6e7684', core: '#dde3ec' } },
  plate: '#151b28', fog: '#15171e', studio: { box: '#0f131c', key: '#dfe8ff', fill: '#bfd0e8', top: '#ffffff', under: '#6e7a92' }, lights: { key: '#e6eeff', rim: '#aebbd6', sky: '#7f94b3', ground: '#05060a' },
};

let kit, gl;
beforeEach(() => { kit = installCanvasKit(); gl = fakeGlPlatform(); });
afterEach(() => { kit.restore(); document.body.innerHTML = ''; });

function engine(extra = {}) { return createAgentFormEngine({ ...kit.platform(), ...gl, ...extra }); }
/** A view's elements (the engine sizes them from the spec). */
function els() {
  const box = document.createElement('div'), canvas = document.createElement('canvas'), stillCanvas = document.createElement('canvas'), overlay = document.createElement('canvas'), slot = document.createElement('div');
  box.append(canvas, slot, overlay); document.body.append(box);
  return { box, canvas, stillCanvas, overlay, slot };
}
const statuses = (list) => ({ onStatus: (s, info) => list.push(`${s}:${info.still}`) });

describe('nothing at load; everything on the first mount', () => {
  it('an engine with no view holds no renderer, observer, listener or frame', () => {
    const E = engine();
    expect(gl.made.renderers).toHaveLength(0);
    expect(kit.observers).toHaveLength(0);
    expect(kit.listeners.added).toBe(0);
    expect(kit.raf.requested).toBe(0);
    expect(E.info()).toMatchObject({ views: 0, contexts: 0, looping: false, listening: false, observing: false });
  });

  it('the first mount makes one shared renderer, one environment, one observer and one visibility listener; later mounts share them', () => {
    const E = engine();
    const a = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 2 }, {}, THEME);
    const b = E.mount(els(120), { kind: 'fund', size: 120 }, { dpr: 2 }, {}, THEME);
    expect(gl.made.renderers).toHaveLength(1);
    expect(gl.made.environments).toHaveLength(1);
    expect(kit.observers).toHaveLength(1);
    expect(kit.listeners.added).toBe(1);
    expect(E.info()).toMatchObject({ views: 2, contexts: 1, forms: 2, looping: true });
    a.unmount(); b.unmount();
  });
});

describe('teardown at zero views — the dispose census', () => {
  it('every geometry, material, texture and render target the engine made is disposed exactly once; every singleton is released', () => {
    const census = disposeCensus();
    try {
      census.open();
      const E = engine(), list = [];
      const mount = (spec, opts) => { const e = els(spec.size); const v = E.mount(e, spec, { dpr: 2, ...opts }, {}, THEME); list.push({ e, v, direct: opts.path === 'direct' }); return v; };
      // Every path the engine has: both draw paths, every bloom, batched and not, every rate, an equip, swaps.
      const a = mount({ kind: 'trend', core: 2, armor: 2, size: 200 }, { batched: true, bloom: 'webgl' });
      mount({ kind: 'preserve', core: 0, armor: 2, size: 200 }, { bloom: 'filter' });
      mount({ kind: 'fund', armor: 2, size: 240 }, { bloom: 'css' });
      mount({ kind: 'spec', size: 40 }, { rate: 'half' });
      mount({ kind: 'none', size: 72 }, { rate: 'still' });
      mount({ kind: 'divers', armor: 1, size: 200 }, { path: 'direct', bloom: 'webgl', batched: true });
      mount({ kind: 'contra', armor: 2, size: 200 }, { path: 'direct', bloom: 'filter' });
      for (let i = 0; i < 6; i += 1) kit.tick(16);
      a.update({ kind: 'contra', state: 'worried' }); a.equip(false);
      for (let i = 0; i < 6; i += 1) kit.tick(16);
      a.setOptions({ batched: false }); a.equip(true);
      for (let i = 0; i < 6; i += 1) kit.tick(16);
      const peak = E.info();
      expect(peak).toMatchObject({ views: 7, contexts: 3, looping: true });
      for (const { v } of list) v.unmount();
      census.close();

      const report = census.report();
      // Non-vacuous: the census saw the forms, the bloom passes and the batches (measured: 1,072 geometries,
      // 300 materials, 17 textures of its own, 7 render targets).
      expect(report.geometry.made).toBeGreaterThan(1000);
      expect(report.material.made).toBeGreaterThan(250);
      expect(report.texture.made).toBeGreaterThan(15);
      expect(report.target.made).toBeGreaterThan(5);
      expect(report.geometry.bad).toEqual([]);
      expect(report.material.bad).toEqual([]);
      expect(report.texture.bad).toEqual([]);
      expect(report.target.bad).toEqual([]);

      // The singletons, each exactly once per context.
      expect(gl.made.renderers).toHaveLength(3);
      for (const r of gl.made.renderers) {
        expect(r.record.filter((x) => x === 'dispose')).toHaveLength(1);
        expect(r.record.filter((x) => x === 'forceContextLoss')).toHaveLength(1);
        expect(r.listeners.added.sort()).toEqual(['webglcontextlost', 'webglcontextrestored']);
        expect(r.listeners.removed.sort()).toEqual(['webglcontextlost', 'webglcontextrestored']);
      }
      expect(kit.observers).toHaveLength(1);
      expect(kit.observers[0].disconnected).toBe(1);
      expect(kit.listeners).toEqual({ added: 1, removed: 1 });
      expect(kit.raf.queue).toHaveLength(0);
      expect(icosaCached()).toBe(false);
      expect(E.info()).toMatchObject({ views: 0, contexts: 0, forms: 0, looping: false, listening: false, observing: false });
      // The 2D backing stores are released (iOS caps total canvas memory), and the direct canvases are gone.
      // (A direct view never touches the wrapper's 2D canvas: it draws into a canvas of its own in the slot.)
      for (const { e, direct } of list) { expect(e.canvas.width).toBe(direct ? 300 : 0); expect(e.stillCanvas.width).toBe(0); expect(e.overlay.width).toBe(0); expect(e.slot.children).toHaveLength(0); }
      // Every 2D canvas the engine made for itself (the glow, the bloom scratch buffers) is released too.
      const own = kit.contexts.map((x) => x.ctx.canvas).filter((c) => !list.some(({ e }) => [e.canvas, e.stillCanvas, e.overlay].includes(c)));
      expect(own.length).toBeGreaterThan(3);
      for (const c of own) expect(c.width).toBe(0);
    } finally { census.restore(); }
  });

  it('a form no view draws any more is disposed while other views live on', () => {
    const census = disposeCensus();
    try {
      const E = engine(), keep = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1 }, {}, THEME);
      census.open();
      const v = E.mount(els(), { kind: 'preserve', armor: 2, size: 200 }, { dpr: 1 }, {}, THEME);
      kit.tick(16);
      v.update({ kind: 'fund' }); kit.tick(16);
      v.unmount();
      census.close();
      const report = census.report();
      expect(report.geometry.made).toBeGreaterThan(100);
      expect(report.geometry.bad).toEqual([]);
      expect(report.material.bad).toEqual([]);
      expect(E.info()).toMatchObject({ views: 1, forms: 1 });
      keep.unmount();
    } finally { census.restore(); }
  });

  it('a later first mount builds everything afresh (the engine is reusable after teardown)', () => {
    const E = engine();
    E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME).unmount();
    const v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(gl.made.renderers).toHaveLength(2);
    expect(kit.listeners).toEqual({ added: 2, removed: 1 });
    expect(v.status).toBe('live');
    v.unmount();
  });
});

describe('the frame loop', () => {
  it('stops when no view is live: still, reduced motion, hidden; resumes when one is', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(kit.tick()).toBe(1);
    v.setOptions({ rate: 'still' }); kit.tick();
    expect(kit.tick()).toBe(0);
    expect(E.info().looping).toBe(false);
    v.setOptions({ rate: 'live' }); expect(kit.tick()).toBe(1);
    v.setOptions({ reducedMotion: true }); kit.tick(); expect(kit.tick()).toBe(0);
    v.setOptions({ reducedMotion: false }); expect(kit.tick()).toBe(1);
    kit.setHidden(true); expect(kit.raf.queue).toHaveLength(0); expect(kit.tick()).toBe(0);
    kit.setHidden(false); expect(kit.tick()).toBe(1);
    v.unmount(); expect(kit.tick()).toBe(0);
  });

  it('a frame sample marks the first frame after a stop as resumed (the readout leaves that gap out)', () => {
    const E = engine(), samples = []; E.onFrame((s) => samples.push(s));
    const v = E.mount(els(), { kind: 'spec', size: 200 }, { dpr: 1 }, {}, THEME);
    kit.tick(); kit.tick(); kit.setHidden(true); kit.setHidden(false); kit.tick(5000); kit.tick();
    expect(samples.map((s) => s.resumed)).toEqual([true, false, true, false]);
    expect(samples.every((s) => s.views === 1 && s.calls > 0 && s.cost >= 0)).toBe(true);
    v.unmount();
  });

  it('no frame-cost budget (R-S7-2): twelve 40 px views all draw on every live frame, even when a frame is slow', () => {
    let slow = 0;
    const E = engine({ now: () => (slow += 50) }); // every clock read is 50 ms later: any budget would cut the frame
    const vs = Array.from({ length: 12 }, () => E.mount(els(40), { kind: 'preserve', armor: 2, size: 40 }, { dpr: 3 }, {}, THEME));
    const r = gl.made.renderers[0], before = r.renders;
    kit.tick(); kit.tick(); kit.tick();
    expect(r.renders - before).toBe(36);
    for (const v of vs) v.unmount();
  });

  it('half rate draws every other frame, on purpose; still draws once', () => {
    const E = engine(), r = () => gl.made.renderers[0].renders;
    const v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1, rate: 'half' }, {}, THEME);
    const start = r(); for (let i = 0; i < 10; i += 1) kit.tick();
    expect(r() - start).toBe(5);
    v.unmount();
    const s = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1, rate: 'still' }, {}, THEME), afterMount = gl.made.renderers[1].renders;
    for (let i = 0; i < 10; i += 1) kit.tick();
    expect(gl.made.renderers[1].renders).toBe(afterMount);
    s.unmount();
  });

  it('an offscreen view is skipped, and draws again when it comes back', () => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    kit.observers[0].callback([{ target: e.box, isIntersecting: false }]);
    const n = r.renders; kit.tick(); kit.tick(); expect(r.renders).toBe(n);
    kit.observers[0].callback([{ target: e.box, isIntersecting: true }]);
    kit.tick(); expect(r.renders).toBe(n + 1);
    v.unmount();
  });

  it('an unmounted view is no longer observed while other views live on (review SR-7)', () => {
    const E = engine(), ea = els(), eb = els();
    const a = E.mount(ea, { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME), b = E.mount(eb, { kind: 'fund', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(kit.observers[0].targets.size).toBe(2);
    a.unmount();
    expect(kit.observers[0].targets.has(ea.box)).toBe(false);
    expect(kit.observers[0].targets.size).toBe(1);
    b.unmount();
  });
});

describe('a mutable view: mood, stage, allegiance and size change without a remount; the equip tween', () => {
  it('update() keeps the view, the context and the renderer; a stage change swaps the form', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    v.update({ state: 'celebrating', pal: 'copper', face: -1 }); kit.tick();
    v.update({ armor: 2 }); kit.tick();
    expect(gl.made.renderers).toHaveLength(1);
    expect(E.info()).toMatchObject({ views: 1, forms: 1, formsBuilt: 2 });
    v.unmount();
  });

  it('equip and unequip follow the board\'s keys in time; under reduced motion they snap', () => {
    const E = engine(), v = E.mount(els(), { kind: 'fund', size: 200 }, { dpr: 1 }, {}, THEME);
    v.equip(false);
    kit.tick(180); expect(v.fit).toBeCloseTo(.72, 9);
    kit.tick(170); expect(v.fit).toBeCloseTo(.45, 9);
    kit.tick(350); expect(v.fit).toBe(0);
    v.equip(true);
    kit.tick(220); expect(v.fit).toBeCloseTo(.28, 9);
    kit.tick(230); expect(v.fit).toBeCloseTo(.55, 9);
    kit.tick(450); expect(v.fit).toBe(1);
    v.setOptions({ reducedMotion: true }); v.equip(false); expect(v.fit).toBe(0);
    v.equip(true); expect(v.fit).toBe(1);
    v.unmount();
  });

  it('update() redraws a view that does not animate (rate still, or reduced motion): its still and its live frame', () => {
    // Nothing else draws such a view: the loop skips it and kick() never schedules for it, so without this redraw a
    // mood or form change under Reduce Motion would leave the old picture, and the cached still with it (review SR-3).
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1, rate: 'still' }, {}, THEME), r = gl.made.renderers[0];
    expect(kit.tick()).toBe(0);
    let n = r.renders; v.update({ state: 'worried' });
    expect(r.renders).toBe(n + 2);
    v.setOptions({ rate: 'live', reducedMotion: true });
    n = r.renders; v.update({ kind: 'fund' });
    expect(r.renders).toBe(n + 2);
    expect(kit.tick()).toBe(0);
    v.unmount();
  });

  it('a size change re-sizes the live and still canvases; on the direct path a face or size change re-applies the mirror and the buffer', () => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(e.canvas.width).toBe(200);
    v.update({ size: 260 });
    expect(e.canvas.width).toBe(260); expect(e.stillCanvas.width).toBe(260);
    v.unmount();
    const d = els(), w = E.mount(d, { kind: 'trend', size: 200 }, { dpr: 2, path: 'direct' }, {}, THEME), r = gl.made.renderers[1];
    expect(r.domElement.width).toBe(400); expect(r.domElement.style.transform).toBe('');
    w.update({ face: -1, size: 100 });
    expect(r.domElement.width).toBe(200); // renderRes(2, 100)
    expect(r.domElement.style.transform).toBe('scaleX(-1)'); expect(d.overlay.style.transform).toBe('scaleX(-1)');
    w.unmount();
  });
});

// ── Build S1: a swap plays the change, the size tweened across it (ruling R5); a paused view; the settled still ──
describe('build S1: swap() plays an archetype change, and the size tweens across it (ruling R5)', () => {
  /** Record the form group's scale at every render call: the still's draw and the live frame's, in order. */
  function scalesOf(r) {
    const seen = [], render = r.render.bind(r);
    r.render = (scene, camera) => { seen.push(scene.children.find((o) => o.isGroup)?.scale.x); return render(scene, camera); };
    return seen;
  }
  const frames = (n, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };

  it('bare Shadow → a set: the set suits up from nothing on the 900 ms equip, and the scale runs 1.25 → .65 with no step', () => {
    const E = engine(), v = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(3);
    expect(v.scale).toBe(1.25);
    const scales = [];
    v.swap({ kind: 'trend' });
    expect(v.kind).toBe('trend'); expect(v.fit).toBe(0);
    for (let ms = 0; ms < 900; ms += 16) { kit.tick(16); scales.push(v.scale); }
    kit.tick(16); scales.push(v.scale);
    expect(v.fit).toBe(1);
    // The first frame starts where bare Shadow was drawn; no frame moves the scale by more than a sliver; it ends on the set's own.
    expect(Math.abs(scales[0] - 1.25)).toBeLessThan(.02);
    for (let i = 1; i < scales.length; i += 1) expect(Math.abs(scales[i] - scales[i - 1])).toBeLessThan(.02);
    expect(scales.at(-1)).toBe(.65);
    for (let i = 1; i < scales.length; i += 1) expect(scales[i]).toBeLessThanOrEqual(scales[i - 1]);
    v.unmount();
  });

  it('a set → another set: the new one suits up from nothing, and the scale runs from the old set\'s (.65) to the new one\'s (.95)', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(2);
    v.swap({ kind: 'contra' });
    kit.tick(16);
    expect(v.kind).toBe('contra');
    expect(Math.abs(v.scale - .65)).toBeLessThan(.02);
    frames(60);
    expect(v.fit).toBe(1); expect(v.scale).toBe(.95);
    v.unmount();
  });

  it('a set → bare Shadow: the set comes off on the 700 ms unequip, then bare Shadow shows at 1.25, with no step at the switch', () => {
    const E = engine(), v = E.mount(els(), { kind: 'fund', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(2);
    v.swap({ kind: 'none' });
    kit.tick(350);
    expect(v.kind).toBe('fund'); expect(v.fit).toBeCloseTo(.45, 9);
    expect(v.scale).toBeGreaterThan(.95); expect(v.scale).toBeLessThan(1.25);
    kit.tick(330);
    const before = v.scale; // the last frame of the unequip, a sliver before it ends
    kit.tick(40);
    expect(v.kind).toBe('none'); expect(v.fit).toBe(1); expect(v.scale).toBe(1.25);
    expect(Math.abs(v.scale - before)).toBeLessThan(.02);
    v.unmount();
  });

  it('a change reversed mid-way continues from where the plates are: no jump in fit or in scale', () => {
    const E = engine(), v = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(2);
    v.swap({ kind: 'spec' });
    kit.tick(450);
    const fit = v.fit, scale = v.scale;
    expect(fit).toBeCloseTo(.55, 9);
    v.swap({ kind: 'none' });
    kit.tick(16);
    expect(Math.abs(v.fit - fit)).toBeLessThan(.03); expect(Math.abs(v.scale - scale)).toBeLessThan(.02);
    frames(50);
    expect(v.kind).toBe('none'); expect(v.scale).toBe(1.25);
    v.unmount();
  });

  it('a mood change mid-swap keeps the swap: update() with the kind it is headed for is no change of form', () => {
    const E = engine(), v = E.mount(els(), { kind: 'divers', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(2);
    v.swap({ kind: 'none' });
    kit.tick(200);
    v.update({ kind: 'none', state: 'researching' });
    expect(v.kind).toBe('divers'); expect(v.fit).toBeGreaterThan(0);
    frames(40);
    expect(v.kind).toBe('none');
    v.unmount();
  });

  it('under reduced motion, at the still rate, or before the context lives, a swap is update(): the new form at once, still and live frame redrawn', () => {
    const E = engine(), v = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1, reducedMotion: true }, {}, THEME), r = gl.made.renderers[0];
    let n = r.renders;
    v.swap({ kind: 'preserve' });
    expect(v.kind).toBe('preserve'); expect(v.fit).toBe(1);
    expect(r.renders).toBe(n + 2);
    expect(kit.tick()).toBe(0);
    v.setOptions({ reducedMotion: false, rate: 'still' });
    n = r.renders; v.swap({ kind: 'none' });
    expect(v.kind).toBe('none'); expect(r.renders).toBe(n + 2);
    v.unmount();
  });

  it('a view that stops animating mid-swap settles it: the set is worn (or gone) and drawn at its own scale', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(2);
    v.swap({ kind: 'none' });
    kit.tick(200);
    v.setOptions({ reducedMotion: true });
    expect(v.kind).toBe('none'); expect(v.scale).toBe(1.25);
    v.unmount();
  });

  it('the cached still is drawn where the view is headed: the new set fully on, at its own scale, while the live frame tweens', () => {
    const E = engine(), v = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    frames(2);
    const seen = scalesOf(r);
    v.swap({ kind: 'trend' });
    kit.tick(16);
    // The first frame after the swap: the still (dirty) at the set's own .65, then the live frame near bare Shadow's 1.25.
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(.65);
    expect(Math.abs(seen[1] - 1.25)).toBeLessThan(.02);
    v.unmount();
  });

  it('a set coming off redraws the still once bare Shadow shows', () => {
    const E = engine(), v = E.mount(els(), { kind: 'contra', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    frames(2);
    v.swap({ kind: 'none' });
    const perFrame = [], seen = scalesOf(r);
    for (let i = 0; i < 50; i += 1) { const n = r.renders; kit.tick(16); perFrame.push(r.renders - n); }
    // The swap's first frame redraws the still (the set off), then live frames only, until the frame that settles on
    // bare Shadow (700 ms in), which redraws the still again — bare Shadow, at its own 1.25.
    const settle = perFrame.indexOf(2, 1);
    expect(perFrame[0]).toBe(2);
    expect(settle).toBe(43);
    expect(perFrame.filter((n) => n === 2)).toHaveLength(2);
    const at = perFrame.slice(0, settle).reduce((a, b) => a + b, 0);
    expect(seen.slice(at, at + 2)).toEqual([1.25, 1.25]);
    v.unmount();
  });
});

describe('build S1: a paused view holds its frame (the hub\'s lifetime ruling R-S7-5)', () => {
  const frames = (n, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };

  it('pausing the only live view stops the loop; un-pausing resumes it, and the next sample is marked resumed', () => {
    const E = engine(), v = E.mount(els(), { kind: 'spec', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    const samples = []; E.onFrame((s) => samples.push(s));
    frames(2);
    v.setOptions({ paused: true });
    const n = r.renders;
    expect(kit.tick()).toBe(1); // the frame already requested runs once, draws nothing and asks for no other
    expect(kit.tick()).toBe(0);
    expect(r.renders).toBe(n);
    expect(E.info()).toMatchObject({ looping: false, paused: 1 });
    v.setOptions({ paused: false });
    expect(E.info().looping).toBe(true);
    kit.tick();
    expect(r.renders).toBeGreaterThan(n);
    expect(samples.at(-1).resumed).toBe(true);
    v.unmount();
  });

  it('a paused view is skipped while another view keeps drawing', () => {
    const E = engine(), a = E.mount(els(), { kind: 'spec', size: 200 }, { dpr: 1, paused: true }, {}, THEME), b = E.mount(els(), { kind: 'fund', size: 200 }, { dpr: 1 }, {}, THEME);
    const samples = []; E.onFrame((s) => samples.push(s));
    frames(3);
    expect(samples.map((s) => s.views)).toEqual([1, 1, 1]);
    a.unmount(); b.unmount();
  });
});

// Build S2 (ruling R23, the S1 review's SR-9): a swap asked for while a view is paused.
describe('build S2: a swap while paused starts when the view resumes, with R5\'s smoothing', () => {
  const frames = (n, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };

  it('a set → another set: nothing draws while paused; on resume the 900 ms tween plays whole, from the scale last drawn', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    frames(3);
    v.setOptions({ paused: true });
    kit.tick();
    v.swap({ kind: 'contra' });
    const n = r.renders;
    frames(3, 1000); // the ceremony stays up far longer than the tween
    expect(r.renders).toBe(n);
    expect(v.fit).toBe(0);
    v.setOptions({ paused: false });
    const scales = [];
    for (let ms = 0; ms < 900; ms += 16) { kit.tick(16); scales.push(v.scale); }
    kit.tick(16); scales.push(v.scale);
    // The first frame is at the tween's start, not already elapsed; no frame steps; it ends on the new form's own.
    expect(Math.abs(scales[0] - .65)).toBeLessThan(.02);
    for (let i = 1; i < scales.length; i += 1) expect(Math.abs(scales[i] - scales[i - 1])).toBeLessThan(.02);
    expect(scales.at(-1)).toBe(.95);
    expect(v.fit).toBe(1);
    v.unmount();
  });

  it('a set → bare Shadow: the set still comes off on the 700 ms unequip after the resume', () => {
    const E = engine(), v = E.mount(els(), { kind: 'spec', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(3);
    v.setOptions({ paused: true });
    v.swap({ kind: 'none' });
    frames(4, 1000);
    expect(v.kind).toBe('spec');
    v.setOptions({ paused: false });
    frames(20);
    expect(v.kind).toBe('spec');
    expect(v.fit).toBeLessThan(1);
    frames(40);
    expect(v.kind).toBe('none');
    expect(v.scale).toBe(1.25);
    v.unmount();
  });

  it('a tween running when the pause comes waits too, and goes on from the fit it had', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    frames(3);
    v.swap({ kind: 'contra' });
    frames(20);
    const at = v.fit;
    expect(at).toBeGreaterThan(.2);
    expect(at).toBeLessThan(.8);
    v.setOptions({ paused: true });
    frames(5, 1000);
    expect(v.fit).toBe(at);
    v.setOptions({ paused: false });
    kit.tick(16);
    expect(v.fit).toBeLessThan(at + .03);
    v.unmount();
  });

  it('the first frame of the Trend Follower\'s frame change does not jump sideways, either way', () => {
    const E = engine(), v = E.mount(els(), { kind: 'none', size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
    frames(2);
    const xs = [], render = r.render.bind(r);
    r.render = (scene, camera) => { xs.push(scene.children.find((o) => o.isGroup)?.position.x); return render(scene, camera); };
    v.swap({ kind: 'trend' });
    frames(60);
    const live = xs.slice(1); // the first render is the settled still
    expect(Math.abs(live[0])).toBeLessThan(.01);
    for (let i = 1; i < live.length; i += 1) expect(Math.abs(live[i] - live[i - 1])).toBeLessThan(.01);
    expect(live.at(-1)).toBeCloseTo(.27 * Math.cos(.55), 10);
    v.unmount();
  });
});

// Build S2 (ruling R19): S7's response, on a form. The hub's rows hold the triggers and the numbers equal to S7's.
describe('build S2: respond() brightens the part it names, on S7\'s timing', () => {
  const frames = (n, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };
  /** What a frame lights: the core's light and the plates' rim. */
  function lights(r) {
    const g = r.lastScene.children.find((o) => o.isGroup);
    let core = null, rim = null;
    g.traverse((o) => { if (o.isPointLight) core = o.intensity; if (o.isMesh && o.material?.userData?.rimK) rim = o.material.userData.rimK.value; });
    return { core, rim };
  }
  const mount = (opts = {}, spec = {}) => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'spec', size: 200, state: 'idle', ...spec }, { dpr: 1, ...opts }, {}, THEME);
    return { E, e, v, r: gl.made.renderers[0] };
  };

  it('the core: the core brightens on a 1.2 s curve, the armor stays, and the form ends exactly as it began', () => {
    const { v, r } = mount();
    frames(3);
    const base = lights(r);
    v.respond('core');
    frames(37); // 16 + 36 × 16 ms: about half way
    expect(lights(r).core).toBeGreaterThan(base.core * 1.6);
    expect(lights(r).rim).toBe(base.rim);
    frames(40);
    expect(lights(r)).toEqual(base);
    v.unmount();
  });

  it('the armor: the plates brighten, the core stays', () => {
    const { v, r } = mount();
    frames(3);
    const base = lights(r);
    v.respond('armor');
    frames(37);
    expect(lights(r).rim).toBeGreaterThan(base.rim * 1.6);
    expect(lights(r).core).toBe(base.core);
    v.unmount();
  });

  it('the whole form: both, and any other word for a part is the whole form', () => {
    for (const part of ['all', undefined, 'toString']) {
      const { v, r } = mount();
      frames(3);
      const base = lights(r);
      v.respond(part);
      frames(37);
      expect(lights(r).rim).toBeGreaterThan(base.rim * 1.6);
      expect(lights(r).core).toBeGreaterThan(base.core * 1.6);
      v.unmount();
      gl.made.renderers.length = 0;
    }
  });

  it('a paused view keeps the response on its own clock: nothing plays until the page is back, then all of it', () => {
    const { v, r } = mount();
    frames(3);
    const base = lights(r);
    v.setOptions({ paused: true });
    kit.tick();
    v.respond('core');
    frames(5, 1000);
    expect(lights(r)).toEqual(base);
    v.setOptions({ paused: false });
    frames(37);
    expect(lights(r).core).toBeGreaterThan(base.core * 1.6);
    v.unmount();
  });

  it('a long gap between frames counts as 50 ms at most, as Shadow\'s clock does, so the peak is never skipped', () => {
    const { v, r } = mount();
    frames(3);
    const base = lights(r);
    v.respond('core');
    kit.tick(16);
    kit.tick(5000);
    expect(lights(r).core).toBeLessThan(base.core * 1.3);
    expect(lights(r).core).toBeGreaterThan(base.core);
    v.unmount();
  });

  it('an offscreen view keeps it too: its clock stands still with its frames', () => {
    const { e, v, r } = mount();
    frames(3);
    const base = lights(r);
    v.respond('core');
    kit.observers[0].callback([{ target: e.box, isIntersecting: false }]);
    frames(4, 1000);
    expect(lights(r)).toEqual(base);
    kit.observers[0].callback([{ target: e.box, isIntersecting: true }]);
    frames(37);
    expect(lights(r).core).toBeGreaterThan(base.core * 1.6);
    v.unmount();
  });

  describe('a view that does not animate takes the flash', () => {
    it('reduced motion: ×1.25 at once for 420 ms, then the form again, and the loop stops', () => {
      const { E, v, r } = mount({ reducedMotion: true });
      const base = lights(r), n = r.renders;
      v.respond('all');
      expect(r.renders).toBeGreaterThan(n);
      expect(lights(r).core).toBeCloseTo(base.core * 1.25, 8);
      expect(lights(r).rim).toBeCloseTo(base.rim * 1.25, 8);
      expect(E.info().looping).toBe(true);
      frames(25); // 400 ms
      expect(lights(r).core).toBeCloseTo(base.core * 1.25, 8);
      frames(2); // past 420 ms
      expect(lights(r)).toEqual(base);
      expect(E.info().looping).toBe(false);
      v.unmount();
    });

    it('the still rate takes it too', () => {
      const { v, r } = mount({ rate: 'still' });
      const base = lights(r);
      v.respond('armor');
      expect(lights(r).rim).toBeCloseTo(base.rim * 1.25, 8);
      expect(lights(r).core).toBe(base.core);
      v.unmount();
    });

    it('while paused it is owed, and paid when the page is back', () => {
      const { E, v, r } = mount({ reducedMotion: true, paused: true });
      const base = lights(r), n = r.renders;
      v.respond('core');
      expect(r.renders).toBe(n);
      expect(E.info().looping).toBe(false);
      v.setOptions({ paused: false });
      expect(lights(r).core).toBeCloseTo(base.core * 1.25, 8);
      frames(30);
      expect(lights(r)).toEqual(base);
      v.unmount();
    });

    it('a flash still owed is dropped when the view animates again', () => {
      const { v, r } = mount({ reducedMotion: true, paused: true });
      const base = lights(r);
      v.respond('core');
      v.setOptions({ reducedMotion: false });
      v.setOptions({ paused: false });
      frames(3);
      expect(lights(r).core).toBe(base.core);
      v.unmount();
    });
  });

  it('a view that is not live does nothing', () => {
    const E = engine({ createRenderer: () => { throw new Error('no context'); } });
    const v = E.mount(els(), { kind: 'spec', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(() => v.respond('core')).not.toThrow();
    v.unmount();
  });
});

describe('WebGL context loss and restore', () => {
  it('loss: every view of the context shows its still and nothing renders; restore: the environment is rebuilt, the target cleared with alpha, drawing resumes', () => {
    const E = engine(), seen = [];
    const a = E.mount(els(), { kind: 'preserve', armor: 1, size: 200 }, { dpr: 1 }, statuses(seen), THEME);
    const b = E.mount(els(72), { kind: 'fund', size: 72 }, { dpr: 1 }, statuses(seen), THEME);
    const r = gl.made.renderers[0]; kit.tick();
    r.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(seen.filter((s) => s.startsWith('lost'))).toEqual(['lost:true', 'lost:true']);
    const n = r.renders; kit.tick(); kit.tick(); expect(r.renders).toBe(n);
    const oldEnv = gl.made.environments[0], clearsBefore = r.clears.length;
    r.domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(gl.made.environments).toHaveLength(2);
    const newEnv = gl.made.environments[1].texture;
    // every plate material in the scene graph now reflects the rebuilt studio
    const mats = new Set(); r.lastScene.traverse((o) => { if (o.material && o.material.isMeshPhysicalMaterial) mats.add(o.material); });
    expect(mats.size).toBeGreaterThan(0);
    for (const m of mats) expect(m.envMap).toBe(newEnv);
    expect(oldEnv).not.toBe(gl.made.environments[1]);
    expect(r.clearColors.at(-1)).toEqual([0x000000, 0]);
    expect(r.clears.slice(clearsBefore)[0]).toEqual([true, true, true]);
    expect(seen.slice(-2)).toEqual(['live:true', 'live:true']);
    expect(r.renders).toBeGreaterThan(n);
    kit.tick(); expect(E.info()).toMatchObject({ lost: 1, restored: 1, looping: true });
    a.unmount(); b.unmount();
  });

  it('a lost direct view shows its still too, and only its own context is affected', () => {
    const E = engine(), seen = [], other = [];
    const d = E.mount(els(), { kind: 'divers', size: 200 }, { dpr: 1, path: 'direct' }, statuses(seen), THEME);
    const s = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, statuses(other), THEME);
    const direct = gl.made.renderers[0];
    direct.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(seen.at(-1)).toBe('lost:true');
    expect(other).toEqual(['live:false']); // unchanged since its mount
    d.unmount(); s.unmount();
  });

  it('a loss and restore releases the superseded studio: every render target made is disposed exactly once (review SR-5)', () => {
    const census = disposeCensus();
    try {
      census.open();
      const E = engine(), v = E.mount(els(), { kind: 'preserve', armor: 1, size: 200 }, { dpr: 1 }, {}, THEME), r = gl.made.renderers[0];
      kit.tick();
      r.domElement.dispatchEvent(new Event('webglcontextlost'));
      r.domElement.dispatchEvent(new Event('webglcontextrestored'));
      kit.tick();
      v.unmount();
      census.close();
      const report = census.report();
      expect(gl.made.environments).toHaveLength(2);
      expect(report.target.made).toBeGreaterThanOrEqual(2);
      for (const k of ['target', 'geometry', 'material', 'texture']) expect(report[k].bad, k).toEqual([]);
    } finally { census.restore(); }
  });
});

describe('no WebGL', () => {
  it('a renderer that cannot be made leaves the view on its still ("unavailable"), retries nothing, and leaks nothing', () => {
    let tries = 0;
    const E = engine({ createRenderer: () => { tries += 1; throw new Error('Error creating WebGL context.'); } }), seen = [];
    const a = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, statuses(seen), THEME);
    const b = E.mount(els(), { kind: 'fund', size: 200 }, { dpr: 1 }, statuses(seen), THEME);
    expect(seen).toEqual(['unavailable:false', 'unavailable:false']);
    expect(tries).toBe(1);
    expect(a.status).toBe('unavailable');
    expect(E.info()).toMatchObject({ contexts: 0, looping: false, unavailable: true });
    a.unmount(); b.unmount();
    expect(kit.listeners).toEqual({ added: 1, removed: 1 });
    expect(E.info().unavailable).toBe(false);
  });

  it('a studio that fails after the renderer was made releases that renderer', () => {
    const E = engine({ createEnvironment: () => { throw new Error('PMREM failed'); } });
    const v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    expect(v.status).toBe('unavailable');
    expect(gl.made.renderers[0].record).toEqual(expect.arrayContaining(['dispose', 'forceContextLoss']));
    v.unmount();
  });
});

describe('a pose or render that throws', () => {
  it('drops that view to unavailable and keeps every other view and the loop running (the design\'s draw() guard, review SR-2)', () => {
    let n = 0;
    const E = engine({ createRenderer: (o) => { const r = gl.createRenderer(o); const base = r.render; r.render = (s) => { if (++n === 5) throw new Error('render failed'); return base.call(r, s); }; return r; } }), seen = [], errors = [];
    const a = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, { ...statuses(seen), onError: (e) => errors.push(e.message) }, THEME);
    const b = E.mount(els(), { kind: 'fund', size: 200 }, { dpr: 1 }, statuses(seen), THEME);
    const r = gl.made.renderers[0];
    expect(r.renders).toBe(4); // two views, a still and a live frame each, at mount
    expect(() => kit.tick()).not.toThrow(); // the fifth render is view a\'s live frame: it throws
    expect(a.status).toBe('unavailable'); expect(b.status).toBe('live');
    expect(seen.at(-1)).toBe('unavailable:true'); // a has its still: the wrapper shows it
    expect(errors).toEqual(['render failed']);
    expect(E.info()).toMatchObject({ looping: true, failed: 1 });
    const before = r.renders; kit.tick();
    expect(r.renders).toBe(before + 1); // b draws on; a does not
    a.unmount(); b.unmount();
  });
});

describe('the draw paths and the blooms', () => {
  it('shared: each view copies its scissored corner onto its own 2D canvas; the design\'s bloom blurs with ctx.filter and adds with lighter', () => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'fund', size: 200 }, { dpr: 1, bloom: 'filter' }, {}, THEME);
    kit.tick();
    const log = kit.logOf(e.canvas), r = gl.made.renderers[0];
    expect(log.draws.some((d) => d.src === r.domElement)).toBe(true);
    expect(log.composites).toContain('lighter');
    expect(kit.contexts.some((c) => c.log.filters.some((f) => /^blur\(/.test(f)))).toBe(true);
    expect(e.overlay.style.display).toBe('none');
    v.unmount();
  });

  it('css: the overlay canvas carries the quarter-size copy and the browser blurs it; no ctx.filter anywhere', () => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'fund', size: 200 }, { dpr: 1, bloom: 'css' }, {}, THEME);
    kit.tick();
    expect(e.overlay.width).toBe(50);
    expect(e.overlay.style.display).toBe('');
    expect(e.overlay.style.filter).toMatch(/^blur\(\d+(\.\d+)?px\)$/);
    expect(Number(e.overlay.style.opacity)).toBeCloseTo(.65, 3);
    expect(kit.contexts.every((c) => c.log.filters.length === 0)).toBe(true);
    v.unmount();
  });

  it('no bloom under 160 px or when off (as the design)', () => {
    const E = engine(), e = els(120), v = E.mount(e, { kind: 'fund', size: 120 }, { dpr: 1, bloom: 'css' }, {}, THEME);
    kit.tick();
    expect(e.overlay.style.display).toBe('none');
    v.setOptions({ bloom: 'filter' }); kit.tick();
    expect(kit.logOf(e.canvas).composites).toEqual([]);
    v.unmount();
  });

  it('direct: the view draws into its own WebGL canvas inside the slot, with no copy; the opponent is mirrored by CSS', () => {
    const E = engine(), e = els(), v = E.mount(e, { kind: 'trend', size: 200, face: -1 }, { dpr: 2, path: 'direct' }, {}, THEME);
    kit.tick();
    const r = gl.made.renderers[0];
    expect(e.slot.children[0]).toBe(r.domElement);
    expect(r.domElement.width).toBe(400);
    expect(r.domElement.style.transform).toBe('scaleX(-1)');
    expect(kit.logOf(e.canvas)).toBeNull();
    v.unmount();
    expect(e.slot.children).toHaveLength(0);
  });
});

describe('render order uses build-local numbers, never three\'s global ids', () => {
  it('the transparent sort breaks a depth tie by build order within the form', () => {
    const E = engine(), v = E.mount(els(), { kind: 'trend', size: 200 }, { dpr: 1 }, {}, THEME);
    const r = gl.made.renderers[0], objs = []; r.lastScene.traverse((o) => objs.push(o));
    const [early, late] = [objs.find((o) => o.isLine), objs.findLast((o) => o.isLineSegments)];
    const item = (object) => ({ groupOrder: 0, renderOrder: 0, z: .5, object, material: object.material, id: object.id });
    // Make three's global ids disagree with the build order: the sort must not care.
    expect(r.transparentSort(item(early), item(late))).toBeLessThan(0);
    expect(r.transparentSort({ ...item(early), id: 1e9 }, { ...item(late), id: 0 })).toBeLessThan(0);
    expect(r.transparentSort({ ...item(early), z: .9 }, { ...item(late), z: .1 })).toBeLessThan(0); // farther first
    v.unmount();
  });
});

// three is imported so the census's prototype hooks and the engine share one module instance.
void THREE;
