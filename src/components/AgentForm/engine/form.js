// src/components/AgentForm/engine/form.js
//
// One built form (bare Shadow, or Shadow in a set) and its pose for a spec at time t — the CPU half of the
// design's render (docs/design/agent-identity-v2/af3-standalone.js.txt:340-368). Posing writes every
// transform, colour, opacity and uniform from (spec, t) and nothing else, so a frame is a pure function of
// them: there is no wall clock, no random and no carried state here.
//
// Build order. three.js gives every object, material and geometry a global id in creation order, and its
// default sorts break ties on those ids. The port numbers each form's objects and materials in build order
// (`order`) and the render context sorts with these build-local numbers instead (engine.js
// sortTransparent / sortOpaque), so a frame does not depend on which forms were built before it.

import * as THREE from 'three';
import { STATES, CORE, ARMOR, FRAME_SCALE, RESPONSE_PEAK, clamp, frameShift } from './vocab.js';
import { plateMaterial, makeBuildKit, buildBrain } from './core.js';
import { BUILDERS } from './armor.js';
import { attachBatch } from './batch.js';

/** The cache key of the geometry a spec needs (mood, fit and palette are per frame, not per build). */
export function formKey(spec) {
  return [spec.kind || 'none', spec.core | 0, spec.armor | 0, spec.brain === false ? 0 : 1, spec.seed | 0, spec.batched ? 1 : 0].join('|');
}

/**
 * Build a form for `spec` in a render context `C` ({ theme, env, glow, fadeMat }). Returns
 * { key, group, mat, brain, armor, kit, batch, order }.
 */
export function buildForm(spec, C) {
  const kind = spec.kind || 'none', core = spec.core | 0, armor = spec.armor | 0, brain = spec.brain !== false, seed = spec.seed | 0;
  const group = new THREE.Group(), mat = plateMaterial(C.theme.plate, C.env), kit = makeBuildKit({ glow: C.glow, fadeMat: C.fadeMat });
  const F = { key: formKey(spec), kind, group, mat, kit, brain: null, armor: null, batch: null, order: new Map() };
  if (brain) { F.brain = buildBrain(core, seed, kit); group.add(F.brain.group); }
  if (kind !== 'none' && BUILDERS[kind]) { F.armor = BUILDERS[kind]({ stage: armor, A: ARMOR[armor] || ARMOR[0], seed, mat, brainR: (CORE[core] || CORE[0]).R, kit }); group.add(F.armor.group); }
  if (spec.batched && F.armor) F.batch = attachBatch(F, C);
  numberForm(F);
  return F;
}

/** Build-local order: every object and every material, numbered in a fixed depth-first traversal. */
function numberForm(F) {
  let n = 0;
  F.group.traverse((o) => {
    F.order.set(o, n++);
    const m = o.material;
    if (m && !F.order.has(m)) F.order.set(m, n++);
  });
}

const camDir = new THREE.Vector3(), invQ = new THREE.Quaternion(), edgeNear = new THREE.Color(), edgeCore = new THREE.Color();
const YAW = .55, PITCH = .25;

/**
 * Pose form `F` for `spec` at time `t` (seconds) in context `C` ({ camera, scene }). `pal` is the resolved
 * palette ({ near, far, core } colours). Returns the edge brightness the render used (`eb`).
 */
export function poseForm(F, spec, t, C, pal) {
  const S = STATES[spec.state] || STATES.idle, size = spec.size, small = size < 90, fit = spec.fit == null ? 1 : spec.fit, A = ARMOR[spec.armor | 0] || ARMOR[0];
  // The response (build S2, ruling R19): the part it lights draws brighter this frame, the rest as the mood draws it. An
  // edge at rest is already close to full light, so a brighter one also runs part of the way to the core's white.
  const R = spec.response, coreLift = R && R.part !== 'armor' ? R.lift : 1, armorLift = R && R.part !== 'core' ? R.lift : 1;
  const edges = armorLift === 1 ? pal : { ...pal, near: edgeNear.set(pal.near).lerp(edgeCore.set(pal.core), .6 * clamp((armorLift - 1) / RESPONSE_PEAK, 0, 1)) };
  F.group.rotation.set(0, .16 * Math.sin(t * .27 + (spec.seed | 0)) + S.scan * .3 * Math.sin(t * .9) + (spec.turn || 0), -.14 * S.lean);
  // The form's own frame, or — mid-swap (build S1, ruling R5) — the scale and shift the swap's tween has reached.
  const shift = Number.isFinite(spec.shift) ? spec.shift : frameShift(F.kind);
  F.group.position.set(shift * Math.cos(YAW), S.lift * .07 * Math.max(0, Math.sin(t * 2.6)), -shift * Math.sin(YAW)); F.group.scale.setScalar(Number.isFinite(spec.scale) ? spec.scale : (F.armor ? F.armor.frame : FRAME_SCALE.none));
  const camera = C.camera, D = 4.7 * (spec.zoom || 1); camera.position.set(D * Math.sin(YAW) * Math.cos(PITCH), D * Math.sin(PITCH), D * Math.cos(YAW) * Math.cos(PITCH)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  C.scene.fog.near = D - .7; C.scene.fog.far = D + 3.1;
  camDir.copy(camera.position).normalize().applyQuaternion(invQ.copy(F.group.quaternion).invert());
  if (F.brain) F.brain.update(t, coreLift === 1 ? S : { ...S, bright: S.bright * coreLift, lifted: coreLift }, pal, camDir);
  let eb = 0;
  if (F.armor) {
    F.armor.update(t, S, pal, fit, !!spec.unfit);
    eb = .95 * A.edge * S.bright * armorLift * (small ? 1.4 : 1) * (spec.brain === false ? .8 : 1);
    for (const p of F.armor.plates) { const u = p.userData; u.em.color.set(edges.near); u.em.opacity = clamp(eb * u.edgeK, 0, 1); u.em2.color.set(edges.near); u.em2.opacity = clamp(.42 * eb * u.edgeK, 0, 1); }
  }
  F.mat.userData.rim.value.set(edges.near); F.mat.userData.rimK.value = .6 * A.rim * S.bright * armorLift * (small ? 1.5 : 1) * (spec.brain === false ? .6 : 1) * (.6 + .4 * fit);
  if (F.batch) F.batch.sync(eb, edges, camera);
  return eb;
}

/** Every geometry, material and texture reachable from a form, each once (the context's shared ones excluded). */
export function formResources(F, shared) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  F.group.traverse((o) => {
    if (o.geometry && !o.isSprite) geometries.add(o.geometry);
    const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of list) if (!shared.has(m)) materials.add(m);
  });
  // Made at build but drawn by no object, so no traversal finds them: bare Shadow's plate material (it has
  // no plates), and a plate's etch material when its stage has no etch lines.
  materials.add(F.mat);
  if (F.armor) for (const p of F.armor.plates) { materials.add(p.userData.em); materials.add(p.userData.em2); }
  for (const m of materials) for (const v of Object.values(m)) if (v && v.isTexture && !shared.has(v)) textures.add(v);
  if (F.batch) for (const t of F.batch.textures()) textures.add(t);
  return { geometries, materials, textures };
}

/** Dispose everything a form owns, each resource once. The context's glow texture, fade material and environment are not its own. */
export function disposeForm(F, shared) {
  const { geometries, materials, textures } = formResources(F, shared);
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) t.dispose();
  F.group.clear();
}
