// src/components/AgentForm/engine/batch.js
//
// The batched variant of a built form (a lab toggle, build S0 §3): the same plates, lines and motion, in
// a handful of draw calls instead of one or more per plate. The builders and their update() run exactly as
// unbatched; each frame, sync() copies what they wrote into the batched objects:
//   - plates (and the Contrarian's studs) → two THREE.BatchedMesh, one holding the plates BEHIND the form's
//     centre and one the plates IN FRONT of it, each sorted back to front per instance. Unbatched, every
//     plate is its own transparent object sorted by depth, so the brain's light (drawn at the centre's
//     depth) lands between the back and the front plates; two batches keep that order. Per-instance
//     matrices and visibility carry each plate's own motion, so the equip tween still moves every plate.
//   - every plate's lit edges and etch lines → one merged LineSegments geometry, drawn twice (back, front)
//     with a per-plate matrix and edge light in a uniform array;
//   - the brain's loops → one LineSegments; the set's own fade lines (streams, arcs, tethers) → another.
// Render order: back plates (-1) < back edges, lines and inner sprites (0) < front plates (1) < front
// edges and outer sprites (2). Sprites stay single objects; a sprite with zero opacity is skipped (it adds
// nothing to an additive frame). The look matches the unbatched form within a small pixel tolerance, not
// bit for bit (measured in the build report): ties inside one depth class no longer interleave.

import * as THREE from 'three';

const ORDER_BACK_PLATES = -1, ORDER_MIDDLE = 0, ORDER_FRONT_PLATES = 1, ORDER_FRONT = 2;

/** One LineSegments drawing a list of fade lines (each a strip of N points) with the context's fade material. */
function mergedLines(list, fadeMat) {
  let total = 0; for (const L of list) total += L.N;
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), idx = [];
  let o = 0; for (const L of list) { for (let j = 0; j < L.N - 1; j++) idx.push(o + j, o + j + 1); o += L.N; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const line = new THREE.LineSegments(geo, fadeMat); line.frustumCulled = false;
  return {
    line,
    sync() { let k = 0; for (const L of list) { pos.set(L.pos, k); col.set(L.col, k); k += L.N * 3; } geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; },
  };
}

/** A plate or stud geometry as BatchedMesh needs it: non-indexed, position and normal only. */
function batchable(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  return g;
}

/** The per-plate edge material: the edge line material with each vertex moved by its plate's matrix and lit by its plate's edge light. */
function edgeBatchMaterial(count) {
  const uPlateM = { value: Array.from({ length: count }, () => new THREE.Matrix4()) }, uEb = { value: 0 };
  const m = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, fog: false });
  m.userData.uPlateM = uPlateM; m.userData.uEb = uEb;
  m.onBeforeCompile = sh => {
    sh.uniforms.uPlateM = uPlateM; sh.uniforms.uEb = uEb;
    sh.vertexShader = sh.vertexShader.replace('void main() {', `attribute float aPlate;\nattribute float aK;\nuniform mat4 uPlateM[${count}];\nuniform float uEb;\nvarying float vA;\nvoid main() {`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmat4 pm = uPlateM[int(aPlate + 0.5)];\nvA = clamp(aK * uEb * pm[0][3], 0.0, 1.0);\npm[0][3] = 0.0;\ntransformed = (pm * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vA;\nvoid main() {').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vA );');
  };
  m.customProgramCacheKey = () => `af3-edges-${count}`;
  return m;
}

/** Every edge and etch segment of every plate in one geometry, tagged with its plate (aPlate) and its share of the edge light (aK). */
function mergedEdges(plates) {
  const pos = [], plate = [], k = [];
  plates.forEach((p, i) => {
    const u = p.userData, add = (line, share) => { const a = line.geometry.attributes.position.array; for (let j = 0; j < a.length; j += 3) { pos.push(a[j], a[j + 1], a[j + 2]); plate.push(i); k.push(share); } };
    add(u.edges, 1);
    for (const e of u.etch) add(e, .42); // em2 runs at .42 of em (form.js poseForm)
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aPlate', new THREE.Float32BufferAttribute(plate, 1)); geo.setAttribute('aK', new THREE.Float32BufferAttribute(k, 1));
  return geo;
}

/** Turn a built, armored form into its batched variant (in place). Returns { sync(eb, pal, camera), textures() }. */
export function attachBatch(F, C) {
  const g = F.armor.group, plates = F.armor.plates;

  const parts = []; // { plate index, geometry, local matrix (relative to the plate) }
  plates.forEach((p, i) => {
    const u = p.userData;
    parts.push({ i, geo: u.mesh.geometry, local: null });
    for (const stud of u.studs || []) { stud.updateMatrix(); parts.push({ i, geo: stud.geometry, local: stud.matrix.clone() }); }
    u.mesh.visible = false; u.edges.visible = false; for (const e of u.etch) e.visible = false; for (const stud of u.studs || []) stud.visible = false;
  });
  const geos = parts.map((q) => batchable(q.geo)), verts = geos.reduce((n, x) => n + x.attributes.position.count, 0);
  const makeBatch = (order) => {
    const bm = new THREE.BatchedMesh(parts.length, verts, verts * 2, F.mat);
    bm.perObjectFrustumCulled = false; bm.frustumCulled = false; bm.sortObjects = true; bm.renderOrder = order;
    const ids = geos.map((x) => bm.addInstance(bm.addGeometry(x)));
    return { bm, ids };
  };
  const back = makeBatch(ORDER_BACK_PLATES), front = makeBatch(ORDER_FRONT_PLATES);
  for (const x of geos) x.dispose(); // BatchedMesh copied them into its own buffers
  g.add(back.bm, front.bm);

  const edgeGeo = mergedEdges(plates), backEdgeMat = edgeBatchMaterial(plates.length), frontEdgeMat = edgeBatchMaterial(plates.length);
  const backEdges = new THREE.LineSegments(edgeGeo, backEdgeMat), frontEdges = new THREE.LineSegments(edgeGeo, frontEdgeMat);
  backEdges.frustumCulled = frontEdges.frustumCulled = false; backEdges.renderOrder = ORDER_MIDDLE; frontEdges.renderOrder = ORDER_FRONT;
  g.add(backEdges, frontEdges);

  const brainLoops = F.brain ? F.brain.loops.map((l) => l.L) : [], armorLines = F.kit.lines.filter((L) => !brainLoops.includes(L));
  const merged = [];
  if (brainLoops.length) { const m = mergedLines(brainLoops, C.fadeMat); F.brain.group.add(m.line); merged.push(m); }
  if (armorLines.length) { const m = mergedLines(armorLines, C.fadeMat); g.add(m.line); merged.push(m); }
  for (const L of F.kit.lines) L.line.visible = false;

  const PS = new THREE.Matrix4(), v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const ndcZ = (obj) => v.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(PS).z;
  const plateZ = (p) => v.copy(p.position).applyMatrix4(g.matrixWorld).applyMatrix4(PS).z;

  function sync(eb, pal, camera) {
    F.group.updateMatrixWorld(true);
    PS.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const centre = ndcZ(F.group);
    // Smaller NDC z is nearer the camera. A plate exactly at the centre's depth (the Contrarian's rings are
    // centred on the brain) counts as in front: unbatched, that tie falls to build order, and the plates are
    // built after the brain, so they draw after its light.
    const isFront = plates.map((p) => plateZ(p) <= centre);
    plates.forEach((p, i) => {
      p.updateMatrix();
      const shown = p.visible, edgeK = p.userData.edgeK;
      const mb = backEdgeMat.userData.uPlateM.value[i], mf = frontEdgeMat.userData.uPlateM.value[i];
      mb.copy(p.matrix); mb.elements[3] = shown && !isFront[i] ? edgeK : 0;
      mf.copy(p.matrix); mf.elements[3] = shown && isFront[i] ? edgeK : 0;
    });
    parts.forEach((q, n) => {
      const p = plates[q.i], shown = p.visible;
      m4.copy(p.matrix); if (q.local) m4.multiply(q.local);
      back.bm.setMatrixAt(back.ids[n], m4).setVisibleAt(back.ids[n], shown && !isFront[q.i]);
      front.bm.setMatrixAt(front.ids[n], m4).setVisibleAt(front.ids[n], shown && isFront[q.i]);
    });
    for (const mat of [backEdgeMat, frontEdgeMat]) { mat.color.set(pal.near); mat.userData.uEb.value = eb; }
    for (const m of merged) m.sync();
    for (const s of F.kit.sprites) { s.visible = s.material.opacity > 0; s.renderOrder = ndcZ(s) < centre ? ORDER_FRONT : ORDER_MIDDLE; }
  }

  /** The BatchedMeshes' own data textures, which no scene traversal reaches (their geometry and material it does). */
  function textures() {
    const out = [];
    for (const { bm } of [back, front]) for (const t of [bm._matricesTexture, bm._indirectTexture, bm._colorsTexture]) if (t) out.push(t);
    return out;
  }
  return { sync, textures, back: back.bm, front: front.bm };
}
