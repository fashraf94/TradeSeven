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
