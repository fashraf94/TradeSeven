// @vitest-environment jsdom
//
// src/components/AgentForm/engine/engine.breath.jsdom.test.js
//
// The A1 fix pass, founder ruling D-C (Nov 6, 2026): the core's breath on the REAL engine with a renderer stand-in (the
// kit's fakeRenderer and its controllable clock), AGENT_FORM_ARMORY_ENABLED held on here (dark on main), off for the
// control. The breath is the view's own clock: a live view breathes on the `t` its frames are drawn at; one that does not
// move (reduced motion, the still rate) and the cached still hold it at the midpoint; a paused view draws nothing, so its
// breath holds where it was. Each render's core is read as the renderer is handed the scene.

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_ARMORY_ENABLED() { return flag.on; } }));

import { createAgentFormEngine } from './engine.js';
import { BREATH_DEPTH, BREATH_S, CORE_LEVEL, breath, viewT0 } from './vocab.js';
import { installCanvasKit, fakeGlPlatform } from '../__fixtures__/agentFormKit.js';

const THEME = {
  palettes: { teal: { near: '#5eead4', far: '#7fd4ff', core: '#ecfffb' }, copper: { near: '#e8927c', far: '#f6c496', core: '#fff3ec' }, mono: { near: '#e4e8ee', far: '#848c9a', core: '#ffffff' }, unlit: { near: '#aeb6c4', far: '#6e7684', core: '#dde3ec' } },
  plate: '#151b28', fog: '#15171e', studio: { box: '#0f131c', key: '#dfe8ff', fill: '#bfd0e8', top: '#ffffff', under: '#6e7a92' }, lights: { key: '#e6eeff', rim: '#aebbd6', sky: '#7f94b3', ground: '#05060a' },
};
const CORE = new THREE.Color(THEME.palettes.teal.core);
const MID = CORE_LEVEL * (1 - BREATH_DEPTH / 2);
const SPEC = { kind: 'none', size: 240, seed: 1 };

let kit, gl, renders, T0;
beforeEach(() => {
  flag.on = true;
  kit = installCanvasKit(); gl = fakeGlPlatform(); renders = [];
  T0 = kit.state.now;
});
afterEach(() => { kit.restore(); document.body.innerHTML = ''; });

/** An engine whose renderer records, at each render, the level the scene's core is drawn at (its colour over today's). */
function engine() {
  return createAgentFormEngine({
    ...kit.platform(), ...gl,
    createRenderer(opts) {
      const r = gl.createRenderer(opts), render = r.render.bind(r);
      r.render = (scene, camera) => {
        let level = null;
        scene.traverse((o) => { if (level === null && o.isMesh && o.material.isMeshBasicMaterial) level = o.material.color.g / CORE.g; });
        renders.push({ now: kit.state.now, level });
        return render(scene, camera);
      };
      return r;
    },
  });
}
function els() {
  const box = document.createElement('div'), canvas = document.createElement('canvas'), stillCanvas = document.createElement('canvas'), overlay = document.createElement('canvas'), slot = document.createElement('div');
  box.append(canvas, slot, overlay); document.body.append(box);
  return { box, canvas, stillCanvas, overlay, slot };
}
/** Mount a bare Shadow on a fresh engine; its first mount starts the engine's clock (engine.js setup: T0). */
function mount(opts) { T0 = kit.state.now; return engine().mount(els(), SPEC, { dpr: 1, ...opts }, {}, THEME); }
/** The view's own clock at the kit's clock reading `now` (engine.js: t0 + (ts − T0) / 1000). */
const tAt = (now) => viewT0(SPEC) + (now - T0) / 1000;
const last = () => renders.at(-1);

describe('D-C: the breath on the view\'s own clock', () => {
  it('a live view breathes: each frame\'s core is CORE_LEVEL × breath(t) at the frame\'s own t, through a whole cycle', () => {
    const v = mount();
    const seen = [];
    for (let i = 0; i < 300; i += 1) {
      kit.tick(16);
      expect(last().now).toBe(kit.state.now);
      expect(last().level).toBeCloseTo(CORE_LEVEL * breath(tAt(kit.state.now)), 9);
      seen.push(last().level);
    }
    // 4.8 s of frames: over a whole 4.5 s cycle, from about its top to about its floor
    expect(Math.max(...seen)).toBeGreaterThan(CORE_LEVEL * .999);
    expect(Math.min(...seen)).toBeLessThan(CORE_LEVEL * (1 - BREATH_DEPTH) * 1.001);
    v.unmount();
  });

  it('the cached still is held at the midpoint, while the live frame drawn with it breathes', () => {
    kit.state.now += 1234; // a clock reading where the breath is well away from its midpoint
    const v = mount();
    // mount draws the still first, then the live frame
    expect(renders).toHaveLength(2);
    expect(renders[0].level).toBeCloseTo(MID, 12);
    expect(renders[1].level).toBeCloseTo(CORE_LEVEL * breath(tAt(kit.state.now)), 9);
    expect(Math.abs(renders[1].level - MID)).toBeGreaterThan(.01);
    v.unmount();
  });

  it('under reduced motion every draw holds the midpoint, at any clock reading; nothing moves it', () => {
    const v = mount({ reducedMotion: true });
    for (const ms of [0, 700, 1600, 2900]) {
      kit.state.now += ms;
      v.update({ state: ms % 2 ? 'worried' : 'idle' });
      expect(kit.tick(16)).toBe(0); // no loop: it does not move
    }
    expect(renders.length).toBeGreaterThan(4);
    for (const r of renders) expect(r.level).toBeCloseTo(MID, 12);
    v.unmount();
  });

  it('at the still rate too: the midpoint', () => {
    const v = mount({ rate: 'still' });
    kit.state.now += 2100; v.update({ size: 220 });
    for (const r of renders) expect(r.level).toBeCloseTo(MID, 12);
    v.unmount();
  });

  it('a paused view draws nothing, so its breath holds where it was; resumed, it breathes on from the frame\'s t', () => {
    const v = mount();
    for (let i = 0; i < 20; i += 1) kit.tick(16);
    const held = last();
    v.setOptions({ paused: true });
    const before = renders.length;
    for (let i = 0; i < 60; i += 1) kit.tick(16); // a second of clock with the view paused
    expect(renders.length).toBe(before);
    expect(last()).toBe(held);
    v.setOptions({ paused: false });
    kit.tick(16);
    expect(last().level).toBeCloseTo(CORE_LEVEL * breath(tAt(kit.state.now)), 9);
    v.unmount();
  });

  it('the control: with the flag off the core draws at today\'s light, every frame, still or live', () => {
    flag.on = false;
    const v = mount();
    for (let i = 0; i < 40; i += 1) kit.tick(37);
    expect(renders.length).toBeGreaterThan(40);
    for (const r of renders) expect(r.level).toBe(1);
    v.unmount();
  });
});

describe('the breath costs no draw call', () => {
  it('the same renders, flag on and off: a frame is one render of the view, as before', () => {
    const count = () => {
      renders = [];
      const v = mount({ bloom: 'css' });
      for (let i = 0; i < 30; i += 1) kit.tick(16);
      v.unmount();
      return renders.length;
    };
    flag.on = false; const off = count();
    flag.on = true; const on = count();
    expect(on).toBe(off);
    expect(on).toBe(2 + 30); // the still and the first live frame at mount, then one per frame
  });
});

describe('the clock, read', () => {
  it('a breath of BREATH_S seconds is that many seconds of the view\'s frames', () => {
    expect(BREATH_S).toBeGreaterThan(2);
    const v = mount();
    kit.tick(16); const a = last();
    for (let ms = 0; ms < BREATH_S * 1000; ms += 25) kit.tick(25);
    // one cycle on (to the frame's 25 ms), the level is back where it was
    expect(Math.abs(last().level - CORE_LEVEL * breath(tAt(a.now) + (last().now - a.now) / 1000))).toBeLessThan(1e-9);
    expect(Math.abs(last().level - a.level)).toBeLessThan(.002);
    v.unmount();
  });
});
