// src/components/AgentForm/engine/coreLevel.test.js
//
// The A1 fix pass, founder rulings D-B and D-C (Nov 6, 2026): a softer core that breathes. In Node, on the real pose
// (no GPU), with AGENT_FORM_ARMORY_ENABLED held on here (it is dark on main) and off for the controls.
//   - D-B: the core (its sphere, its glow and its halo) draws at CORE_LEVEL of today's light, wherever it draws: bare
//     Shadow, a set's core, the copper opponent. It stays clearly the brightest point of the form.
//   - D-C: it breathes, down to 1 − BREATH_DEPTH of that and back every BREATH_S seconds, as a pure function of the
//     pose's own `t` (never a clock); a held pose (a still, reduced motion) sits at the midpoint; the moods multiply on
//     top of it, and R19's response rides above its top.
// The pure curve is vocab.test.js's; the engine's own clock, pause and reduced motion are engine.breath.jsdom.test.js's.

import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_ARMORY_ENABLED() { return flag.on; } }));

import { buildForm, poseForm } from './form.js';
import { BREATH_DEPTH, BREATH_S, CORE_LEVEL, MOODS, RESPONSE_PEAK, STATES, breath, clamp, coreLevel } from './vocab.js';

afterEach(() => { flag.on = true; vi.restoreAllMocks(); });

function context() {
  const C = { theme: { plate: '#151b28' }, env: new THREE.Texture(), glow: new THREE.Texture(), fadeMat: new THREE.LineBasicMaterial(), camera: new THREE.PerspectiveCamera(30, 1, .1, 40), scene: new THREE.Scene() };
  C.scene.fog = new THREE.Fog(0x000000, 4, 7.8);
  return C;
}
const TEAL = { near: '#5eead4', far: '#7fd4ff', core: '#ecfffb' };
const COPPER = { near: '#e8927c', far: '#f6c496', core: '#fff3ec' };
const BARE = { kind: 'none', core: 0, armor: 0, seed: 1, size: 240, state: 'idle', fit: 1, batched: false };
const lum = (c) => .2126 * c.r + .7152 * c.g + .0722 * c.b;

/** The core's three emitters after a pose: the sphere's colour, the glow's and the halo's opacity. */
function coreOf(F) {
  let sphere = null; const sprites = [];
  F.brain.group.traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) sphere = o; else if (o.isSprite) sprites.push(o); });
  return { colour: sphere.material.color.clone(), glow: sprites[0].material.opacity, halo: sprites[1].material.opacity, near: sprites[0].material.color.clone() };
}
function pose(spec, t, pal = TEAL) {
  const C = context(), F = buildForm(spec, C);
  poseForm(F, spec, t, C, pal);
  return { F, C, core: coreOf(F) };
}
const today = (pal) => new THREE.Color(pal.core);
/** What a pose's core draws at `level`, in the mood of `state`, under no response. */
function expected(pal, level, state = 'idle') {
  const S = STATES[state], hot = S.bloom > 1 ? 1 + .12 * S.bloom : 1;
  return { colour: today(pal).multiplyScalar(level), glow: clamp(.95 * S.bright * hot * level, 0, 1), halo: clamp(.18 * S.bright * hot * level, 0, 1) };
}
function expectCore(core, want, what) {
  for (const k of ['r', 'g', 'b']) expect(core.colour[k], `${what}: colour.${k}`).toBeCloseTo(want.colour[k], 12);
  expect(core.glow, `${what}: glow`).toBeCloseTo(want.glow, 12);
  expect(core.halo, `${what}: halo`).toBeCloseTo(want.halo, 12);
}

describe('D-B: the core at CORE_LEVEL of today\'s light, the flag on; today\'s with it off', () => {
  it('the control: with the flag off the core draws exactly as main draws it, at every t', () => {
    flag.on = false;
    for (const t of [0, 1.1, BREATH_S / 2, 7.3]) expectCore(pose(BARE, t).core, expected(TEAL, 1), `off, t=${t}`);
  });

  it('flag on, at the breath\'s top: the sphere, the glow and the halo each at CORE_LEVEL of today\'s source light', () => {
    // .6 at the source is 26 % less on screen, glow included (today's centre is blown out past white; vocab.js)
    expect(CORE_LEVEL).toBe(.6);
    const { core } = pose(BARE, 0);
    expectCore(core, expected(TEAL, CORE_LEVEL), 'on, t=0');
    expect(lum(core.colour) / lum(today(TEAL))).toBeCloseTo(CORE_LEVEL, 12);
  });

  it('wherever the core draws: bare Shadow, a set\'s core at every stage, and the copper opponent, the same ratio', () => {
    for (const pal of [TEAL, COPPER]) {
      for (const spec of [BARE, { ...BARE, kind: 'trend', armor: 0 }, { ...BARE, kind: 'fund', core: 2, armor: 2 }, { ...BARE, kind: 'spec', size: 48 }]) {
        for (const t of [0, 1.7]) {
          flag.on = false; const off = pose(spec, t, pal).core;
          flag.on = true; const on = pose(spec, t, pal).core;
          const what = `${spec.kind}/${spec.core}/${pal === TEAL ? 'teal' : 'copper'} t=${t}`;
          expect(lum(on.colour) / lum(off.colour), what).toBeCloseTo(coreLevel(t, false), 12);
          expect(on.glow / off.glow, what).toBeCloseTo(coreLevel(t, false), 12);
          expect(on.halo / off.halo, what).toBeCloseTo(coreLevel(t, false), 12);
        }
      }
    }
  });

  it('the core stays clearly the brightest point: at the breath\'s floor, on the most lit armor, its light is well above any edge\'s or thread\'s', () => {
    const spec = { ...BARE, kind: 'fund', core: 2, armor: 2 };
    const { F, core } = pose(spec, BREATH_S / 2);
    expect(core.glow).toBeCloseTo(expected(TEAL, CORE_LEVEL * (1 - BREATH_DEPTH)).glow, 12);
    // the core's centre: the sphere, plus the glow's and the halo's centres (their textures' peak is 1), tinted by `near`
    const centre = lum(core.colour) + (core.glow + core.halo) * lum(core.near);
    let other = 0;
    F.group.traverse((o) => {
      if (o.isLineSegments && o.material.color) other = Math.max(other, lum(o.material.color) * o.material.opacity);
      if (o.isLine && !o.isLineSegments && o.geometry.attributes.color) {
        const c = o.geometry.attributes.color;
        for (let i = 0; i < c.count; i += 1) other = Math.max(other, .2126 * c.getX(i) + .7152 * c.getY(i) + .0722 * c.getZ(i));
      }
    });
    expect(other).toBeGreaterThan(.3); // non-vacuous: the armor's edges are lit
    expect(centre).toBeGreaterThan(1.25 * other);
  });
});

describe('D-C: the breath, on the pose\'s own t', () => {
  it('a pure function of t: the same pose at the same t gives the same core, whatever the wall clock says', () => {
    const C = context(), F = buildForm(BARE, C);
    const clock = vi.spyOn(performance, 'now');
    clock.mockReturnValue(1_000);
    poseForm(F, BARE, 2.2, C, TEAL); const a = coreOf(F);
    clock.mockReturnValue(1_000 + 1_700);
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    poseForm(F, { ...BARE, state: 'worried' }, 9.9, C, TEAL);
    poseForm(F, BARE, 2.2, C, TEAL); const b = coreOf(F);
    expect(b.colour.equals(a.colour)).toBe(true);
    expect(b.glow).toBe(a.glow);
    expect(b.halo).toBe(a.halo);
  });

  it('at each t the core is CORE_LEVEL × breath(t): the top at t = 0, the floor half a cycle on, the top again a cycle on', () => {
    for (const t of [0, BREATH_S / 4, BREATH_S / 2, .75 * BREATH_S, BREATH_S, 3.3, 11.05]) expectCore(pose(BARE, t).core, expected(TEAL, CORE_LEVEL * breath(t)), `t=${t}`);
    expect(pose(BARE, BREATH_S / 2).core.glow).toBeCloseTo(expected(TEAL, CORE_LEVEL * (1 - BREATH_DEPTH)).glow, 12);
  });

  it('its range over a cycle: never above the toned level, never below 1 − BREATH_DEPTH of it, and it reaches both', () => {
    const C = context(), F = buildForm(BARE, C), levels = [];
    for (let i = 0; i <= 270; i += 1) { poseForm(F, BARE, (i * BREATH_S) / 270, C, TEAL); levels.push(lum(coreOf(F).colour) / lum(today(TEAL))); }
    const top = Math.max(...levels), floor = Math.min(...levels);
    expect(top).toBeLessThanOrEqual(CORE_LEVEL + 1e-12);
    expect(floor).toBeGreaterThanOrEqual(CORE_LEVEL * (1 - BREATH_DEPTH) - 1e-12);
    expect(top).toBeCloseTo(CORE_LEVEL, 6);
    expect(floor).toBeCloseTo(CORE_LEVEL * (1 - BREATH_DEPTH), 6);
  });

  it('a held pose (a still, or reduced motion) sits at the breath\'s midpoint, whatever its t', () => {
    for (const t of [0, BREATH_S / 2, 7.3, 4.1]) expectCore(pose({ ...BARE, held: true }, t).core, expected(TEAL, CORE_LEVEL * (1 - BREATH_DEPTH / 2)), `held, t=${t}`);
  });

  it('the moods layer over it: each mood\'s light multiplies the breathing level, it never replaces it', () => {
    for (const state of MOODS) {
      for (const t of [0, BREATH_S / 2, 1.3]) {
        const spec = { ...BARE, state };
        expectCore(pose(spec, t).core, expected(TEAL, CORE_LEVEL * breath(t), state), `${state} t=${t}`);
        flag.on = false;
        const off = pose(spec, t).core;
        flag.on = true;
        // where the glow is not at its clamp, the mood's own light is kept, times the level
        if (off.glow < 1) expect(pose(spec, t).core.glow / off.glow, `${state} t=${t}`).toBeCloseTo(CORE_LEVEL * breath(t), 12);
      }
    }
  });

  it('R19 rides on top: at the response\'s peak the core reads above the breath\'s top; an armor response leaves the core breathing', () => {
    const peak = 1 + RESPONSE_PEAK, t = BREATH_S / 2;
    const lifted = pose({ ...BARE, response: { part: 'core', lift: peak } }, t).core;
    const top = expected(TEAL, CORE_LEVEL);
    expect(lum(lifted.colour)).toBeGreaterThan(lum(top.colour) * 1.2);
    expect(lifted.glow).toBeGreaterThan(top.glow);
    expect(lifted.halo).toBeGreaterThan(top.halo);
    for (const k of ['r', 'g', 'b']) expect(lifted.colour[k]).toBeCloseTo(today(TEAL)[k] * CORE_LEVEL * breath(t) * peak, 12);
    const armor = pose({ ...BARE, kind: 'trend', response: { part: 'armor', lift: peak } }, t).core;
    expectCore(armor, expected(TEAL, CORE_LEVEL * breath(t)), 'armor response');
  });
});
