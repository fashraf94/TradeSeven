// src/components/AgentForm/engine/core.js
//
// Ported from the design's af3-core.js (docs/design/agent-identity-v2/af3-standalone.js.txt:48-159):
// plate geometry, the dark glass-metal plate material (fresnel edge light), the additive line and sprite
// materials, plates and their fit, and Shadow's brain. The geometry and motion are the design's, line for
// line; what changed for the port:
//   - three.js is the bundled npm release (`import * as THREE from 'three'`), never a CDN or a blob URL;
//   - no module-level GPU state: the fade-line material, the glow texture and the environment belong to a
//     render context (`kit`, engine.js) and are disposed with it;
//   - no colour literal: plate and palette colours arrive from tokens (theme), and every colour the brain
//     and plates draw with is set each frame from the palette before rendering;
//   - the fit mode is an argument (applyFit(p, k, off)), not a module variable.

import * as THREE from 'three';
import { TAU, CORE, rng, lo, clamp } from './vocab.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const Q = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);

// ── geometry: thick plates with real rims ──
function fixWinding(g, outward) {
  g.computeVertexNormals(); const n = g.attributes.normal, p = g.attributes.position; let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i) + n.getZ(i) * p.getZ(i);
  if ((s > 0) !== outward) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
}
function mergeNonIndexed(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}
function paramGrid(P, rad, segU, segV, outward) {
  const pos = [], idx = [];
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) pos.push(...P(i / segU, j / segV, rad));
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); fixWinding(g, outward); return g;
}
const nonIndexed = (g) => { const out = g.toNonIndexed(); g.dispose(); return out; };
// Shell with thickness: outer surface, inner surface and four rim strips (the strips make the lit rim).
function paramThick(P, rOut, rIn, segU, segV) {
  const edge = (rad, side) => { const M = side < 2 ? segV : segU, pts = []; for (let k = 0; k <= M; k++) { const q = k / M; pts.push(side === 0 ? P(0, q, rad) : side === 1 ? P(1, q, rad) : side === 2 ? P(q, 0, rad) : P(q, 1, rad)); } return pts; };
  const strip = (A, B) => { const pos = []; for (let i = 0; i < A.length - 1; i++) { const a = A[i], b = A[i + 1], c = B[i], d = B[i + 1]; pos.push(...a, ...b, ...c, ...b, ...d, ...c); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
  const geos = [nonIndexed(paramGrid(P, rOut, segU, segV, true)), nonIndexed(paramGrid(P, rIn, segU, segV, false))];
  for (let s = 0; s < 4; s++) geos.push(strip(edge(rOut, s), edge(rIn, s)));
  return mergeNonIndexed(geos);
}
const sph = (phi0, phiLen, th0, thLen, post) => (u, v, rad) => { const phi = phi0 + phiLen * u, th = th0 + thLen * v, p = [rad * Math.sin(th) * Math.sin(phi), rad * Math.cos(th), rad * Math.sin(th) * Math.cos(phi)]; return post ? post(p) : p; };
export function sphShell(r, phi0, phiLen, th0, thLen, thick, segU = 16, segV = 10, post) { return paramThick(sph(phi0, phiLen, th0, thLen, post), r, r - thick, segU, segV); }
export function sphSurface(r, phi0, phiLen, th0, thLen, segU = 12, segV = 8, post) { return paramGrid(sph(phi0, phiLen, th0, thLen, post), r, segU, segV, true); }
export function polyPrism(pts, inward, thick) {
  const inner = pts.map(p => p.clone().addScaledVector(inward, thick)), pos = [], tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1]);
  for (let i = 1; i < inner.length - 1; i++) tri(inner[0], inner[i + 1], inner[i]);
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; tri(pts[i], inner[i], pts[j]); tri(pts[j], inner[i], inner[j]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
export function polyFlat(pts) { const pos = []; for (let i = 1; i < pts.length - 1; i++) pos.push(pts[0].x, pts[0].y, pts[0].z, pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; }
export function ringBand(R, r, w) { const s = new THREE.Shape(); s.absarc(0, 0, R, 0, TAU, false); const h = new THREE.Path(); h.absarc(0, 0, r, 0, TAU, true); s.holes.push(h); const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 40 }); g.translate(0, 0, -w / 2); return g; }
export function ringSurface(R, w) { return new THREE.CylinderGeometry(R, R, w, 48, 1, true).rotateX(Math.PI / 2); }
export function basis(d) { const a = Math.abs(d.y) > .9 ? V3(1, 0, 0) : V3(0, 1, 0), e1 = a.clone().cross(d).normalize(), e2 = d.clone().cross(e1).normalize(); return [e1, e2]; }
export function inset(pts, k, rad, dir) { const c = pts.reduce((s, p) => s.add(p), V3()).multiplyScalar(1 / pts.length); return pts.map(p => { const q = p.clone().lerp(c, k); if (rad) q.normalize().multiplyScalar(rad); else if (dir) q.addScaledVector(dir, .005); return q; }); }

// ── materials ──
/** The plate material: dark glass-metal with a fresnel rim. `plate` is the plate colour token, `env` the studio. */
export function plateMaterial(plate, env) {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(plate), metalness: .78, roughness: .3, clearcoat: 1, clearcoatRoughness: .14, envMap: env, envMapIntensity: .75, side: THREE.DoubleSide, transparent: true, opacity: .93 });
  const rim = { value: new THREE.Color() }, rimK = { value: 1 }; m.userData.rim = rim; m.userData.rimK = rimK;
  m.onBeforeCompile = sh => { sh.uniforms.uRim = rim; sh.uniforms.uRimK = rimK; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uRimK;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.2); totalEmissiveRadiance += uRim * (fr * uRimK); }'); };
  m.customProgramCacheKey = () => 'af3-rim'; return m;
}
// Sprites (and any shader without the chunk) must write premultiplied rgb, or the shared transparent GL canvas composites them as white haze.
export function premul(m) { m.onBeforeCompile = sh => { if (!sh.fragmentShader.includes('premultiplied_alpha_fragment')) sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, 'gl_FragColor.rgb *= gl_FragColor.a;\n}'); }; m.customProgramCacheKey = () => 'af3-premul'; return m; }
export function edgeMaterial(op = .9) { return premul(new THREE.LineBasicMaterial({ transparent: true, opacity: op, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, fog: false })); }
/** The additive vertex-colour material every fade line shares (one per render context). */
export function fadeMaterial() { return premul(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, fog: false })); }
/**
 * The glow sprite's falloff, drawn once per render context on a 2D canvas. It is a LUMINANCE MASK, not a
 * colour: white at the centre fading to transparent, tinted by each sprite's material colour (the palette's
 * near or core token) when drawn — the stated exception in the build report's token section.
 */
export function glowTexture(createCanvas) {
  const c = createCanvas(); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.22, 'rgba(255,255,255,.55)'); g.addColorStop(.55, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/**
 * The per-form build kit: the render context's shared texture and material, and the lists the batched path
 * and the teardown read (every fade line and sprite the form made, in build order).
 */
export function makeBuildKit({ glow, fadeMat }) {
  const lines = [], sprites = [];
  return {
    lines, sprites,
    sprite(scale) { const s = new THREE.Sprite(premul(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, fog: false }))); s.scale.setScalar(scale); sprites.push(s); return s; },
    // flag() also refreshes the line's bounding sphere: three sorts a line by that sphere's centre and computes
    // it only once, so a line rewritten every frame would keep sorting where it first was — the frame then
    // depended on the form's earlier poses (measured on Speculator's arcs and Diversifier's tethers, in the
    // design's engine too). Refreshed, a frame is (spec, t) alone.
    fadeLine(N) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); const line = new THREE.Line(geo, fadeMat); line.frustumCulled = false; const L = { line, geo, N, pos: geo.attributes.position.array, col: geo.attributes.color.array, flag() { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeBoundingSphere(); } }; lines.push(L); return L; },
  };
}

// ── plates: mesh + lit edges (+ etched inset lines that come with armor growth) ──
export function makePlate(geo, mat, etchGeos, opts = {}) {
  geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(V3()); geo.translate(-c.x, -c.y, -c.z);
  const g = new THREE.Group(), em = edgeMaterial(.9), em2 = edgeMaterial(.4), thr = opts.thresh || 24;
  const mesh = new THREE.Mesh(geo, mat), edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, thr), em), etch = [];
  g.add(mesh, edges);
  (etchGeos || []).forEach(e => { e.translate(-c.x, -c.y, -c.z); const l = new THREE.LineSegments(new THREE.EdgesGeometry(e, thr), em2); e.dispose(); etch.push(l); g.add(l); });
  g.userData = { em, em2, edgeK: 1, home: c.clone(), homeQ: new THREE.Quaternion(), homeS: 1, away: null, awayQ: null, order: opts.order == null ? .5 : opts.order, dir: c.lengthSq() > 1e-6 ? c.clone().normalize() : V3(0, 1, 0), mesh, edges, etch };
  g.position.copy(c); return g;
}
export function setAway(p, dist, rot, r) { const u = p.userData; u.away = u.home.clone().addScaledVector(u.dir, dist).add(V3((r() - .5) * .4, (r() - .5) * .4, (r() - .5) * .4)); u.awayQ = u.homeQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - .5) * rot, (r() - .5) * rot, (r() - .5) * rot))); }
// k: 0 = away, 1 = seated. Equip ('on') eases in and shrinks from 40%; unequip ('off') drifts out at full size and dims early.
export function applyFit(p, k, off) {
  const u = p.userData;
  if (!u.away || k >= 1) { p.position.copy(u.home); p.quaternion.copy(u.homeQ); p.scale.setScalar(u.homeS); u.edgeK = 1; p.visible = true; return; }
  const e = off ? Math.pow(k, 1.6) : 1 - Math.pow(1 - k, 3);
  p.position.lerpVectors(u.away, u.home, e); p.quaternion.slerpQuaternions(u.awayQ, u.homeQ, e); p.scale.setScalar(u.homeS * (off ? 1 : .4 + .6 * e)); u.edgeK = off ? e * e * e : e * e; p.visible = k > .002;
}

// ── Shadow's brain: three loop families, core, glow, inner light ──
export function buildBrain(stage, seed, kit) {
  const C = CORE[stage] || CORE[0], r = rng(seed * 13 + stage + 5), group = new THREE.Group(), N = 44, loops = [], R = C.R, DIRS = [-Math.PI / 2, -Math.PI / 2 + TAU / 3, -Math.PI / 2 + 2 * TAU / 3];
  for (let k = 0; k < 3; k++) for (let i = 0; i < C.loops; i++) {
    const q = i / (C.loops - 1), s = { fam: k, spread: .5 + .6 * q + (r() - .5) * .1, len: .8 + .3 * r(), tilt: .16 + .44 * r(), rot0: r() * TAU, rotV: (.07 + .09 * r()) * (r() < .5 ? -1 : 1), ph: r() * TAU, wob: .025 + .05 * r(), wobF: 1 + Math.floor(r() * 3), br: .06 + .1 * r(), w: .7 + .9 * r() };
    const L = kit.fadeLine(N); group.add(L.line); loops.push({ s, L });
  }
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false })); group.add(coreMesh);
  const glow = kit.sprite(.7 * C.glow), halo = kit.sprite(2.1 * C.glow); halo.material.depthTest = false; group.add(glow, halo);
  const light = new THREE.PointLight(undefined, 9 * C.light, 3.4, 2); group.add(light);
  const sigs = [0, 1, 2, 3].map(() => { const s = kit.sprite(.09); group.add(s); return s; });
  const near = new THREE.Color(), far = new THREE.Color(), tmp = new THREE.Color();
  function update(t, S, pal, camDir) {
    near.set(pal.near); far.set(pal.far); const fray = lo(S);
    for (const { s, L } of loops) {
      const pos = L.pos, col = L.col, d = DIRS[s.fam], ax = Math.cos(d), ay = Math.sin(d), px = -ay, py = ax, Ln = s.len * (1 + .035 * Math.sin(t * s.br * 2 + s.ph)) * S.spread, sp = s.spread * (1 + .08 * Math.sin(t * .21 + s.ph)), beta = s.rot0 + t * s.rotV * S.speed, cb = Math.cos(beta), sb = Math.sin(beta);
      for (let j = 0; j < N; j++) {
        const u = j / (N - 1), su = Math.sin(Math.PI * u), rr = Ln * (.07 + .93 * Math.pow(su, .85)) * (1 + (s.wob + fray * .12) * Math.sin(u * TAU * s.wobF + t * .6 + s.ph)), ang = d + sp * (2 * u - 1), X = rr * Math.cos(ang), Y = rr * Math.sin(ang), pa = X * ax + Y * ay, pp = X * px + Y * py, z0 = Ln * s.tilt * Math.sin(TAU * u + s.ph), pp2 = pp * cb - z0 * sb, z1 = pp * sb + z0 * cb, x = (pa * ax + pp2 * px) * R, y = -(pa * ay + pp2 * py) * R, z = z1 * R;
        pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
        const dep = clamp(((x * camDir.x + y * camDir.y + z * camDir.z) / (R * 1.1) + 1) / 2, 0, 1), a = (.22 + .78 * dep) * S.bright * (.5 + .5 * s.w / 1.6) * .6;
        tmp.lerpColors(far, near, dep).multiplyScalar(a); col[j * 3] = tmp.r; col[j * 3 + 1] = tmp.g; col[j * 3 + 2] = tmp.b;
      }
      L.flag();
    }
    const beacon = S.beacon ? 1 + .35 * Math.max(0, Math.sin(t * Math.PI)) : S.scan ? 1 + .12 * Math.sin(t * 5) : 1, hot = S.bloom > 1 ? 1 + .12 * S.bloom : 1;
    coreMesh.scale.setScalar(C.core * beacon); coreMesh.material.color.set(pal.core);
    glow.material.color.set(pal.near); glow.material.opacity = clamp(.95 * S.bright * hot, 0, 1); glow.scale.setScalar(.7 * C.glow * beacon * (1 + .08 * Math.sin(t * 1.3)) * hot);
    halo.material.color.set(pal.near); halo.material.opacity = clamp(.18 * S.bright * hot, 0, 1);
    light.color.set(pal.near); light.intensity = 9 * C.light * S.bright * beacon * hot;
    const cnt = Math.min(4, Math.round(2 * S.signals));
    sigs.forEach((sp, q) => { if (q >= cnt) { sp.material.opacity = 0; return; } const lp = loops[(q * 5) % loops.length].L, pos = lp.pos, u = ((t * (.25 + .07 * q) * S.speed + q * .37) % 1 + 1) % 1, f = u * (N - 1), j = Math.floor(f), fr = f - j, j2 = Math.min(N - 1, j + 1); sp.position.set(pos[j * 3] + (pos[j2 * 3] - pos[j * 3]) * fr, pos[j * 3 + 1] + (pos[j2 * 3 + 1] - pos[j * 3 + 1]) * fr, pos[j * 3 + 2] + (pos[j2 * 3 + 2] - pos[j * 3 + 2]) * fr); sp.material.color.set(pal.core); sp.material.opacity = .9 * S.bright; });
  }
  return { group, update, light, loops };
}
