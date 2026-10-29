// src/components/AgentForm/engine/builders.test.js
//
// Build S0 — the form builders and the pose, in Node (no GPU). Two properties the bit-exact frame rests on:
//   1. the builders are deterministic — every form at every stage gives the same geometry, byte for byte, in
//      whatever order the forms are built (the seeded rng is the only randomness, at build time);
//   2. a pose is a pure function of (spec, t) — no clock, random or carried state — so draw(spec, t) is.
// The GPU half (pixels at a given t across build orders) is measured headless in the build report.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildForm, poseForm, formKey } from './form.js';
import { FORM_ORDER } from './vocab.js';

function context() {
  const C = { theme: { plate: '#151b28' }, env: new THREE.Texture(), glow: new THREE.Texture(), fadeMat: new THREE.LineBasicMaterial(), camera: new THREE.PerspectiveCamera(30, 1, .1, 40), scene: new THREE.Scene() };
  C.scene.fog = new THREE.Fog(0x000000, 4, 7.8);
  return C;
}
const PAL = { near: '#5eead4', far: '#7fd4ff', core: '#ecfffb' };

/** Every geometry's attributes, in traversal order, as one fingerprint string (exact float bits via hex). */
function geometryPrint(F) {
  const parts = [];
  F.group.traverse((o) => {
    if (!o.geometry) return;
    for (const [name, attr] of Object.entries(o.geometry.attributes)) parts.push(`${o.type}:${name}:${Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength).toString('hex')}`);
    if (o.geometry.index) parts.push(`idx:${Array.from(o.geometry.index.array).join(',')}`);
  });
  return parts.join('|');
}
/**
 * Every transform, colour, opacity and visibility a pose writes (and the fade lines' arrays), exactly. A
 * sprite at zero opacity is printed as hidden only: the design leaves a hidden signal where it last was, and
 * an additive sprite at zero opacity adds nothing to a frame wherever it sits.
 */
function posePrint(F) {
  const parts = [];
  F.group.traverse((o) => {
    if (o.isSprite && o.material.opacity === 0) { parts.push('hidden-sprite'); return; }
    o.updateMatrix();
    parts.push(Array.from(o.matrix.elements).join(','), o.visible ? 1 : 0, o.renderOrder);
    const m = o.material;
    if (m && !Array.isArray(m)) parts.push(m.color ? m.color.getHex() : '', m.opacity);
    if (o.isLine || o.isLineSegments) for (const a of Object.values(o.geometry.attributes)) parts.push(Array.from(a.array).join(','));
  });
  parts.push(F.mat.userData.rimK.value, F.mat.userData.rim.value.getHex());
  return parts.join(';');
}
const SPECS = FORM_ORDER.flatMap((kind) => [0, 1, 2].map((armor) => ({ kind, core: armor, armor, seed: 1, size: 200, state: 'idle', batched: false })));

describe('builders are deterministic (bit-exact geometry, any build order)', () => {
  it('every form at every stage builds the same geometry twice', () => {
    for (const spec of SPECS) expect(geometryPrint(buildForm(spec, context())), formKey(spec)).toBe(geometryPrint(buildForm(spec, context())));
  });

  it('building the forms in reverse order (and after others) gives the same geometry', () => {
    const C = context(), forward = new Map(), reverse = new Map();
    for (const spec of SPECS) forward.set(formKey(spec), geometryPrint(buildForm(spec, C)));
    for (const spec of [...SPECS].reverse()) reverse.set(formKey(spec), geometryPrint(buildForm(spec, C)));
    for (const [key, print] of forward) expect(reverse.get(key), key).toBe(print);
  });

  it('the plate counts per set and stage are the design\'s', () => {
    const plates = (kind, armor) => buildForm({ kind, core: 1, armor, seed: 1 }, context()).armor?.plates.length ?? 0;
    expect([0, 1, 2].map((a) => plates('trend', a))).toEqual([8, 9, 10]);
    expect([0, 1, 2].map((a) => plates('contra', a))).toEqual([2, 3, 3]);
    expect([0, 1, 2].map((a) => plates('spec', a))).toEqual([10, 12, 14]);
    expect([0, 1, 2].map((a) => plates('preserve', a))).toEqual([22, 28, 34]);
    expect([0, 1, 2].map((a) => plates('divers', a))).toEqual([7, 8, 9]);
    expect([0, 1, 2].map((a) => plates('fund', a))).toEqual([15, 20, 20]);
    expect(plates('none', 0)).toBe(0);
  });

  it('every object and material of a form carries a build-local number (the render sort\'s tie-break)', () => {
    const F = buildForm({ kind: 'preserve', core: 1, armor: 2, seed: 1, batched: true }, context());
    const seen = new Set();
    F.group.traverse((o) => { expect(F.order.has(o)).toBe(true); seen.add(F.order.get(o)); if (o.material) expect(F.order.has(o.material)).toBe(true); });
    expect(seen.size).toBeGreaterThan(100);
  });
});

describe('a pose is a pure function of (spec, t)', () => {
  it.each(['none', 'trend', 'contra', 'spec', 'preserve', 'divers', 'fund'])('%s: posing at t, then elsewhere, then at t again writes exactly the same state', (kind) => {
    const C = context();
    for (const batched of [false, true]) {
      const F = buildForm({ kind, core: 1, armor: 2, seed: 1, batched }, C);
      const spec = { kind, core: 1, armor: 2, seed: 1, size: 200, state: 'researching', fit: .55, unfit: false, batched };
      poseForm(F, spec, 3.3, C, PAL); const first = posePrint(F);
      poseForm(F, { ...spec, state: 'celebrating', fit: 1 }, 9.1, C, { near: '#e8927c', far: '#f6c496', core: '#fff3ec' });
      poseForm(F, { ...spec, state: 'worried', unfit: true, fit: .2 }, 0.4, C, PAL);
      poseForm(F, spec, 3.3, C, PAL);
      expect(posePrint(F)).toBe(first);
    }
  });

  it('a freshly built form posed at t matches a form that has been posed a hundred times before', () => {
    const C = context(), spec = { kind: 'spec', core: 1, armor: 1, seed: 1, size: 200, state: 'confident', fit: 1, batched: false };
    const used = buildForm(spec, C);
    for (let i = 0; i < 100; i += 1) poseForm(used, { ...spec, state: i % 2 ? 'idle' : 'worried' }, i * .37, C, PAL);
    poseForm(used, spec, 5.5, C, PAL);
    const fresh = buildForm(spec, C); poseForm(fresh, spec, 5.5, C, PAL);
    expect(posePrint(used)).toBe(posePrint(fresh));
  });

  it('every fade line\'s bounding sphere (three\'s sort key for a line) is the sphere of the pose just written, not of an earlier one', () => {
    const C = context();
    for (const kind of ['spec', 'divers', 'trend']) {
      const F = buildForm({ kind, core: 1, armor: 2, seed: 1 }, C), spec = { kind, core: 1, armor: 2, seed: 1, size: 200, fit: 1 };
      poseForm(F, { ...spec, state: 'worried' }, 1.1, C, PAL);
      poseForm(F, { ...spec, state: 'celebrating' }, 6.4, C, PAL);
      for (const L of F.kit.lines) {
        expect(L.geo.boundingSphere, kind).not.toBeNull();
        const centre = new THREE.Box3().setFromBufferAttribute(L.geo.attributes.position).getCenter(new THREE.Vector3()); // three's own sphere centre
        expect(L.geo.boundingSphere.center.toArray()).toEqual(centre.toArray());
      }
    }
  });

  it('the batched variant poses each plate exactly as the unbatched one does', () => {
    const C = context(), spec = { kind: 'fund', core: 1, armor: 2, seed: 1, size: 200, state: 'celebrating', fit: .7 };
    const U = buildForm({ ...spec, batched: false }, C), B = buildForm({ ...spec, batched: true }, C);
    poseForm(U, { ...spec, batched: false }, 2.2, C, PAL); poseForm(B, { ...spec, batched: true }, 2.2, C, PAL);
    U.armor.plates.forEach((p, i) => { p.updateMatrix(); expect(Array.from(B.armor.plates[i].matrix.elements)).toEqual(Array.from(p.matrix.elements)); expect(B.armor.plates[i].visible).toBe(p.visible); });
  });
});
