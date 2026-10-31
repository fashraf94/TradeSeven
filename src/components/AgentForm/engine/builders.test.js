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
import { FORM_ORDER, MOODS } from './vocab.js';

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

  it('batched Contrarian: every ring and stud sits exactly at the centre and files in FRONT of the brain\'s light (the tie rule, review SR-6)', () => {
    // ringBand\'s box is symmetric in float32 and makePlate centres it at the origin, so a seated ring\'s depth equals the
    // form\'s centre bit for bit; a tie counts as in front, as unbatched build order has it (the plates are built after
    // the brain). With `<` instead of `<=` all nine instances file behind the light: the 13–17 % the build report measured.
    const C = context(), spec = { kind: 'contra', core: 1, armor: 2, seed: 1, size: 200, state: 'idle', fit: 1, batched: true };
    const F = buildForm(spec, C); poseForm(F, spec, 4.1, C, PAL);
    const instances = F.armor.plates.length + F.armor.plates.reduce((n, p) => n + p.userData.studs.length, 0);
    expect(instances).toBe(9);
    for (let i = 0; i < instances; i += 1) { expect(F.batch.front.getVisibleAt(i), `instance ${i} front`).toBe(true); expect(F.batch.back.getVisibleAt(i), `instance ${i} back`).toBe(false); }
  });
});

// Build S2 (ruling R19): a response is part of the pose, so a frame is still (spec, t) alone.
describe('a response in the pose', () => {
  const spec = { kind: 'spec', core: 0, armor: 0, seed: 1, size: 200, state: 'idle', fit: 1, batched: false };
  const edgeOf = (F) => { let hex = null; F.group.traverse((o) => { if (hex === null && o.isLineSegments) hex = o.material.color.getHex(); }); return hex; };
  const glowOf = (F) => { let size = 0; F.group.traverse((o) => { if (o.isSprite) size += o.scale.x; }); return size; };

  it('the armor: its edges run toward the core\'s white, part of the way, and the core stays', () => {
    const C = context(), F = buildForm(spec, C);
    poseForm(F, spec, 2, C, PAL);
    const base = { edge: edgeOf(F), glow: glowOf(F) };
    poseForm(F, { ...spec, response: { part: 'armor', lift: 1.7 } }, 2, C, PAL);
    expect(edgeOf(F)).not.toBe(base.edge);
    expect(edgeOf(F)).not.toBe(new THREE.Color(PAL.core).getHex());
    expect(glowOf(F)).toBe(base.glow);
  });

  it('the core: its glow grows, and the edges stay', () => {
    const C = context(), F = buildForm(spec, C);
    poseForm(F, spec, 2, C, PAL);
    const base = { edge: edgeOf(F), glow: glowOf(F) };
    poseForm(F, { ...spec, response: { part: 'core', lift: 1.7 } }, 2, C, PAL);
    expect(glowOf(F)).toBeGreaterThan(base.glow);
    expect(edgeOf(F)).toBe(base.edge);
  });

  it('leaves nothing behind: the next frame without one is the frame that never had one', () => {
    const C = context(), F = buildForm(spec, C);
    poseForm(F, spec, 2, C, PAL);
    const first = posePrint(F);
    poseForm(F, { ...spec, response: { part: 'all', lift: 1.7 } }, 2, C, PAL);
    poseForm(F, spec, 2, C, PAL);
    expect(posePrint(F)).toBe(first);
  });
});

// Build S2 (ruling R18): the frames of the two sets the design cut off. A pose is geometry, so the bounds are computed
// here without a GPU: every vertex a frame lights, projected through the camera the frame uses. Headless Edge measures the
// pixels (the S2 report, §5); this row keeps them in CI. Sprites are left out: the halo's tail is 2 % light at the edge.
describe('ruling R18: every mood and the full motion range stay inside the box', () => {
  const LIT = .03;
  const TIMES = Array.from({ length: 121 }, (_, i) => i * .25).concat(Array.from({ length: 40 }, (_, i) => 31 + i * 22.7));
  const v = new THREE.Vector3();
  /** The widest a form's lit vertices reach from the box's centre, as a share of the half box. */
  function reach({ kind, size, state, armor = 0, zoom = 1 }) {
    const C = context(), spec = { kind, core: 0, armor, seed: 1, size, state, fit: 1, unfit: false, batched: false, zoom };
    const F = buildForm(spec, C);
    C.scene.add(F.group);
    const out = { left: 0, right: 0, up: 0, down: 0 };
    for (const t of TIMES) {
      poseForm(F, spec, t, C, PAL);
      C.camera.updateProjectionMatrix();
      F.group.updateMatrixWorld(true);
      F.group.traverse((o) => {
        if (!o.visible || o.isSprite || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position, col = o.geometry.attributes.color;
        for (let i = 0; i < pos.count; i += 1) {
          if (col && Math.max(col.getX(i), col.getY(i), col.getZ(i)) < LIT) continue;
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(C.camera);
          out.left = Math.max(out.left, -v.x); out.right = Math.max(out.right, v.x); out.up = Math.max(out.up, v.y); out.down = Math.max(out.down, -v.y);
        }
      });
    }
    return out;
  }

  it.each(['trend', 'divers'])('%s: inside the box in all six moods, at every size the forms draw', (kind) => {
    for (const size of [48, 60, 88, 340]) for (const state of MOODS) {
      const r = reach({ kind, size, state });
      for (const [side, value] of Object.entries(r)) expect(value, `${kind} ${state} at ${size} px, ${side}`).toBeLessThan(1);
    }
  }, 60_000);

  it('the row can fail: at the design\'s frames both sets leave the box', () => {
    const trend = { ...reach({ kind: 'trend', size: 48, state: 'confident' }) };
    const shifted = (scale, shift) => {
      const C = context(), spec = { kind: 'trend', core: 0, armor: 0, seed: 1, size: 48, state: 'confident', fit: 1, batched: false, scale, shift };
      const F = buildForm(spec, C);
      C.scene.add(F.group);
      let left = 0;
      for (const t of TIMES) {
        poseForm(F, spec, t, C, PAL);
        C.camera.updateProjectionMatrix();
        F.group.updateMatrixWorld(true);
        F.group.traverse((o) => {
          if (!o.visible || o.isSprite || !o.geometry?.attributes?.position) return;
          const pos = o.geometry.attributes.position, col = o.geometry.attributes.color;
          for (let i = 0; i < pos.count; i += 1) {
            if (col && Math.max(col.getX(i), col.getY(i), col.getZ(i)) < LIT) continue;
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(C.camera);
            left = Math.max(left, -v.x);
          }
        });
      }
      return left;
    };
    expect(trend.left).toBeLessThan(1);
    expect(shifted(.74, 0)).toBeGreaterThan(1);
  }, 30_000);
});
