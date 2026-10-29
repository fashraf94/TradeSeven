// src/components/AgentForm/engine/armor.js
//
// The six armor sets, ported from the design's af3-armor.js (docs/design/agent-identity-v2/
// af3-standalone.js.txt:161-316). Each returns { group, plates, frame, update(t, S, pal, fit, off) }.
// Plates are dark glass-metal with lit edges; fit (0..1) is the equip progress, order staggers the lock
// sequence, `off` is the unequip curve. The geometry, stagger and motion are the design's, line for line;
// the port passes the unequip mode as an argument and builds sprites and fade lines through the form's kit
// (core.js makeBuildKit) so the render context owns and disposes them.

import * as THREE from 'three';
import { TAU, rng, hash, lo, clamp, fitK } from './vocab.js';
import { V3, Q, sphShell, sphSurface, polyPrism, polyFlat, ringBand, ringSurface, basis, inset, makePlate, setAway, applyFit } from './core.js';

// Scratch colours: each update sets them before use, so no state carries from one render to the next.
const near = new THREE.Color(), hot = new THREE.Color(), tmp = new THREE.Color();
const setCol = (L, j, c, a) => { tmp.copy(c).multiplyScalar(Math.max(0, a)); L.col[j * 3] = tmp.r; L.col[j * 3 + 1] = tmp.g; L.col[j * 3 + 2] = tmp.b; };

// 1 Trend Follower — swept hull. Plates ride a teardrop around +x, the rear is open; threads stream out of the vents.
function buildTrend(E) {
  const r = rng(E.seed * 7 + 1), A = E.A, g = new THREE.Group(), plates = [], n = 4 + A.more, gap = .22, post = p => [p[1] * 1.45 - .25, p[0] * .74, p[2] * .74];
  g.rotation.y = .4; g.position.x = .14;
  for (let i = 0; i < n; i++) {
    const phi0 = TAU * i / n + gap / 2 + .35, phiLen = TAU / n - gap, th0 = .16 * Math.PI, thLen = .46 * Math.PI, etch = [];
    for (let e = 0; e < A.etch; e++) { const k = .05 * (e + 1); etch.push(sphSurface(1.006, phi0 + k, phiLen - 2 * k, th0 + k * 1.4, thLen - 2 * k * 1.4, 12, 8, post)); }
    const p = makePlate(sphShell(1, phi0, phiLen, th0, thLen, .045, 16, 10, post), E.mat, etch, { order: .15 + .6 * i / n }); setAway(p, 1.3, 1.2, r); plates.push(p); g.add(p);
  }
  { const p = makePlate(sphShell(1, 0, TAU, 0, .1 * Math.PI, .045, 24, 5, post), E.mat, [], { order: 0 }); p.userData.nose = true; setAway(p, 1.4, .6, r); plates.push(p); g.add(p); }
  [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3].forEach((a, fi) => {
    const d = V3(0, Math.sin(a), Math.cos(a)), pt = (x, rad) => V3(x - .25, 0, 0).addScaledVector(d, rad), pts = [pt(.05, .6), pt(-.5, .62), pt(-1.0, .9), pt(-.68, .82)], side = V3(0, -Math.cos(a), Math.sin(a));
    const p = makePlate(polyPrism(pts, side, .035), E.mat, A.etch ? [polyFlat(inset(pts, .22, 0, side.clone().negate()))] : [], { order: .75 + .08 * fi, thresh: 10 }); p.userData.fin = true; p.userData.dir.copy(d); setAway(p, 1.1, 1, r); plates.push(p); g.add(p);
  });
  const M = 12 + 4 * A.more, NS = 22, streams = [];
  for (let i = 0; i < M; i++) { const L = E.kit.fadeLine(NS); g.add(L.line); streams.push({ a: r() * TAU, rad: .2 + .32 * r(), ph: r() * TAU, f: 1.1 + .8 * r(), amp: .05 + .06 * r(), L }); }
  function update(t, S, pal, fit, off) {
    const stress = Math.max(0, -S.open), op = Math.max(0, S.open), fray = lo(S) * .25, worry = Math.max(0, -S.lean);
    for (const p of plates) { const u = p.userData; applyFit(p, fitK(fit, u.order), off); if (!u.nose) p.position.addScaledVector(u.dir, (u.fin ? .04 : .06) * op - (u.fin ? .03 : .035) * stress); }
    near.set(pal.near);
    for (const { a, rad, ph, f, amp, L } of streams) {
      const len = 1.15 * (1 + .25 * S.lean) * (.8 + .2 * S.speed), vis = fit * fit * S.bright;
      for (let j = 0; j < NS; j++) { const u = j / (NS - 1), env = .3 + .7 * u, w = TAU * f * u - t * 2.2 * S.speed + ph, rr = rad * (1 - .3 * u) + amp * env * Math.sin(w) + fray * env * Math.sin(u * 9 + t * 2.3 + ph * 3); L.pos[j * 3] = -.72 - len * u; L.pos[j * 3 + 1] = rr * Math.sin(a) + amp * env * Math.cos(w) * .5 - worry * .35 * u * u + S.lift * .3 * u * u; L.pos[j * 3 + 2] = rr * Math.cos(a); setCol(L, j, near, Math.pow(1 - u, 1.3) * (.35 + .65 * Math.sin(Math.PI * Math.min(1, u * 3 + .1))) * vis * .9); }
      L.flag();
    }
  }
  return { group: g, plates, frame: .74, update };
}

// 2 Contrarian — gimbals. Two (then three) rings tumble on their own diameters in opposite directions; light spirals inward against the outer spin.
function buildContra(E) {
  const r = rng(E.seed * 7 + 2), A = E.A, g = new THREE.Group(), plates = [];
  const defs = [{ R: 1, w: .17, baseQ: Q(V3(1, 0, 0), Math.PI / 2), pivot: V3(1, 0, 0), spin: .55, order: 0 }, { R: .8, w: .14, baseQ: Q(V3(0, 1, 0), .35), pivot: V3(0, 1, 0), spin: -.8, order: .45 }];
  if (A.more >= 1) defs.push({ R: .62, w: .1, baseQ: Q(V3(0, 0, 1), .9).multiply(Q(V3(1, 0, 0), Math.PI / 2)), pivot: V3(1, 0, 0), spin: .95, order: .8 });
  defs.forEach(d => {
    const p = makePlate(ringBand(d.R, d.R - .055, d.w), E.mat, A.etch ? [ringSurface(d.R - .027, d.w * .5)] : [], { order: d.order }); const u = p.userData; u.ring = d; u.ph = r() * TAU; u.axisW = d.pivot.clone().applyQuaternion(d.baseQ).normalize(); u.homeQ.copy(d.baseQ); u.dir.set(0, 0, 0); u.studs = [];
    [1, -1].forEach(s => { const stud = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .11, 12).rotateZ(Math.PI / 2), E.mat); stud.position.copy(d.pivot).multiplyScalar(s * (d.R - .028)); p.add(stud); u.studs.push(stud); });
    u.away = V3((r() - .5) * .6, (r() - .5) * .6, (r() - .5) * .6).addScaledVector(u.axisW, 1.3 * (r() < .5 ? -1 : 1)); u.awayQ = d.baseQ.clone().multiply(Q(V3(0, 1, 0), 1.2)); plates.push(p); g.add(p);
  });
  const K = 7, parts = []; for (let k = 0; k < K; k++) { const s = E.kit.sprite(.085); g.add(s); parts.push(s); }
  const q1 = new THREE.Quaternion();
  function update(t, S, pal, fit, off) {
    const stress = Math.max(0, -S.open), op = Math.max(0, S.open), wob = lo(S) * .3;
    plates.forEach((p, i) => { const u = p.userData, d = u.ring; u.homeQ.copy(d.baseQ).premultiply(q1.setFromAxisAngle(u.axisW, t * d.spin * S.speed + u.ph)); if (op) u.homeQ.premultiply(q1.setFromAxisAngle(i % 2 ? V3(1, 0, 0) : V3(0, 0, 1), .14 * op * (i % 2 ? -1 : 1))); if (wob) u.homeQ.premultiply(q1.setFromAxisAngle(V3(0, 0, 1), wob * Math.sin(t * 1.7 + u.ph))); u.homeS = 1 - .05 * stress + .03 * op; applyFit(p, fitK(fit, u.order, .5), off); });
    hot.set(pal.core); const cnt = Math.round(K * clamp(S.signals, 0, 1.4) / 1.4);
    parts.forEach((s, k) => { if (k >= cnt || fit < .6) { s.material.opacity = 0; return; } const p = ((t * .16 * S.speed + k / K) % 1 + 1) % 1, rad = .98 - .82 * p, ang = -(t * .55 * S.speed) - p * 6.5 + k * 2.1; s.position.set(rad * Math.cos(ang), .06 * Math.sin(ang * 2 + t), rad * Math.sin(ang)); s.material.color.copy(hot); s.material.opacity = Math.sin(Math.PI * p) * .95 * S.bright; });
  }
  return { group: g, plates, frame: .95, update };
}

// 3 Speculator — broken shards around a bare core. Shards twitch; arcs re-strike between jagged edges.
function buildSpec(E) {
  const r = rng(E.seed * 7 + 3), A = E.A, g = new THREE.Group(), plates = [], N = 10 + 2 * A.more, RS = .95;
  for (let i = 0; i < N; i++) {
    const k = i + .5, phi = Math.acos(1 - 2 * k / N), th = Math.PI * (1 + Math.sqrt(5)) * k, dir = V3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)), [e1, e2] = basis(dir), m = 4 + (r() < .5 ? 1 : 0), rot0 = r() * TAU;
    const angs = Array.from({ length: m }, (_, q) => TAU * q / m + rot0 + (r() - .5) * .6).sort((a, b) => a - b), pts = angs.map(a => { const rho = .3 + .17 * r(); return dir.clone().multiplyScalar(RS).addScaledVector(e1, rho * Math.cos(a)).addScaledVector(e2, rho * Math.sin(a)).normalize().multiplyScalar(RS); });
    const p = makePlate(polyPrism(pts, dir.clone().negate(), .055), E.mat, A.etch ? [polyFlat(inset(pts, .25, RS + .006))] : [], { order: r(), thresh: 12 }); p.userData.dir.copy(dir); p.userData.i = i; setAway(p, 1.4, 1.6, r); plates.push(p); g.add(p);
  }
  const K = 3 + A.more, arcs = []; for (let a = 0; a < K; a++) { const L = E.kit.fadeLine(9), tA = E.kit.sprite(.11), tB = E.kit.sprite(.11); g.add(L.line, tA, tB); arcs.push({ L, tA, tB, ph: r() * 10, rate: 1.6 + r() }); }
  const c = V3(), e1 = V3(), e2 = V3(), q1 = new THREE.Quaternion();
  function update(t, S, pal, fit, off) {
    const stress = Math.max(0, -S.open), op = Math.max(0, S.open), jit = .012 + .02 * lo(S);
    for (const p of plates) { const u = p.userData; applyFit(p, fitK(fit, u.order, .9), off); p.position.addScaledVector(u.dir, jit * Math.sin(t * 9 + u.i * 1.7) + .06 * op + .18 * S.lift * Math.max(0, Math.sin(t * 2.6 + u.i)) - .09 * stress); p.quaternion.premultiply(q1.setFromAxisAngle(u.dir, .035 * Math.sin(t * 7 + u.i))); }
    hot.set(pal.core); near.set(pal.near);
    arcs.forEach((arc, ai) => {
      const step = t * arc.rate * S.speed + arc.ph, k0 = Math.floor(step), fr = step - k0, i1 = Math.floor((hash(ai, k0, 1) * .5 + .5) * N) % N, i2 = (i1 + 1 + Math.floor((hash(ai, k0, 2) * .5 + .5) * (N - 2))) % N, P1 = plates[i1].position, P2 = plates[i2].position, on = fit > .5 && fr < .5 && plates[i1].visible && plates[i2].visible && !(S.signals < .6 && ai > 0);
      const al = on ? Math.pow(1 - fr / .5, .8) * S.bright * (S.bloom > 1 ? 1.3 : 1) : 0;
      c.subVectors(P2, P1); e1.copy(P1).cross(c).normalize(); e2.copy(c).cross(e1).normalize(); const amp = .1 + .12 * lo(S);
      for (let j = 0; j < 9; j++) { const u = j / 8, o1 = j && j < 8 ? hash(ai, j, k0) * amp : 0, o2 = j && j < 8 ? hash(ai, j + 20, k0) * amp : 0, bul = 1.02 + .1 * Math.sin(Math.PI * u); arc.L.pos[j * 3] = (P1.x + c.x * u) * bul + e1.x * o1 + e2.x * o2; arc.L.pos[j * 3 + 1] = (P1.y + c.y * u) * bul + e1.y * o1 + e2.y * o2; arc.L.pos[j * 3 + 2] = (P1.z + c.z * u) * bul + e1.z * o1 + e2.z * o2; tmp.lerpColors(near, hot, .6); setCol(arc.L, j, tmp, al); }
      arc.L.flag(); arc.tA.position.copy(P1).multiplyScalar(1.04); arc.tB.position.copy(P2).multiplyScalar(1.04); arc.tA.material.color.copy(hot); arc.tB.material.color.copy(hot); arc.tA.material.opacity = arc.tB.material.opacity = al * .9;
    });
  }
  return { group: g, plates, frame: .9, update };
}

// 4 Capital Preserver — overlapping shield rows and two caps. Slow pulse; stress closes the rows and dims the seams.
function buildPreserve(E) {
  const r = rng(E.seed * 7 + 4), A = E.A, g = new THREE.Group(), plates = [], gap = .16, thick = .045;
  const rows = [{ th0: .17, th1: .43, n: 6 + 2 * A.more, R: 1, order: .3, off: 0 }, { th0: .41, th1: .63, n: 8 + 2 * A.more, R: .965, order: .55, off: .5 }, { th0: .61, th1: .84, n: 6 + 2 * A.more, R: .93, order: .8, off: 0 }];
  rows.forEach((row, ri) => { const span = TAU / row.n; for (let i = 0; i < row.n; i++) {
    const phi0 = span * (i + row.off) + gap / 2, phiLen = span - gap, th0 = row.th0 * Math.PI, thLen = (row.th1 - row.th0) * Math.PI, etch = [];
    for (let e = 0; e < A.etch; e++) { const k = .045 * (e + 1); etch.push(sphSurface(row.R + .006, phi0 + k, phiLen - 2 * k, th0 + k, thLen - 2 * k, 10, 6)); }
    const p = makePlate(sphShell(row.R, phi0, phiLen, th0, thLen, thick, 12, 8), E.mat, etch, { order: row.order + .15 * i / row.n }); p.userData.row = ri; setAway(p, 1.1, 1.4, r); plates.push(p); g.add(p);
  } });
  [[0, .19, 1.02, .05], [.82, 1, .9, .97]].forEach(([a, b, R, order]) => {
    const etch = A.etch ? [sphSurface(R + .006, 0, TAU, a === 0 ? 0 : (a + .04) * Math.PI, a === 0 ? (b - .05) * Math.PI : (b - a - .04) * Math.PI, 24, 4)] : [];
    const p = makePlate(sphShell(R, 0, TAU, a * Math.PI, (b - a) * Math.PI, thick, 24, 5), E.mat, etch, { order }); p.userData.cap = true; setAway(p, 1.2, .5, r); plates.push(p); g.add(p);
  });
  function update(t, S, pal, fit, off) {
    const stress = Math.max(0, -S.open), op = Math.max(0, S.open), pulse = 1 + .022 * (1 - .4 * stress) * Math.sin(t * .9 * S.speed * (1 + .6 * stress)), Rk = pulse * (1 - .07 * stress) * (1 + .05 * op) * (1 + .06 * S.lift * Math.max(0, Math.sin(t * 2.6)));
    for (const p of plates) { const u = p.userData; applyFit(p, fitK(fit, u.order, .5), off); p.position.multiplyScalar(Rk); p.scale.multiplyScalar(1 + .07 * stress - .04 * op); u.edgeK *= 1 - .35 * stress; }
  }
  return { group: g, plates, frame: .95, update };
}

// 5 Diversifier — pods in formation. Two saddle plates hold the brain; hex pods orbit on a tilted ring, tethered to the core.
function buildDivers(E) {
  const r = rng(E.seed * 7 + 5), A = E.A, g = new THREE.Group(), plates = [], K = 5 + A.more, tiltQ = Q(V3(1, 0, 0), .32), orbitR = .9, hr = E.brainR + .08;
  [[0, .17, .06], [.83, 1, .93]].forEach(([a, b, order]) => {
    const etch = A.etch ? [sphSurface(hr + .005, 0, TAU, a === 0 ? 0 : (a + .05) * Math.PI, a === 0 ? (b - .06) * Math.PI : (b - a - .05) * Math.PI, 24, 4)] : [];
    const p = makePlate(sphShell(hr, 0, TAU, a * Math.PI, (b - a) * Math.PI, .04, 24, 5), E.mat, etch, { order }); p.userData.saddle = true; setAway(p, .9, .4, r); plates.push(p); g.add(p);
  });
  const pods = [];
  for (let k = 0; k < K; k++) {
    const etch = A.etch ? [new THREE.CylinderGeometry(.134, .134, .2, 6, 1, true).rotateZ(Math.PI / 2)] : [];
    const p = makePlate(new THREE.CylinderGeometry(.13, .13, .32, 6, 1).rotateZ(Math.PI / 2), E.mat, etch, { order: .3 + .6 * k / K, thresh: 30 }); p.userData.pod = k; p.userData.ph = r() * TAU; p.userData.spin = (.9 + .4 * r()) * (k % 2 ? -1 : 1); p.userData.away = V3(); p.userData.awayQ = new THREE.Quaternion(); plates.push(p); pods.push(p); g.add(p);
  }
  const tethers = pods.map(() => { const L = E.kit.fadeLine(14); g.add(L.line); return L; }), sigs = pods.map(() => { const s = E.kit.sprite(.08); g.add(s); return s; });
  const tan = V3(), q1 = new THREE.Quaternion(), X = V3(1, 0, 0);
  function orbit(t, S, k, out) { const th = TAU * k / K + t * .18 * S.speed, wob = lo(S) * .12, rad = orbitR * S.spread * (1 - .08 * Math.max(0, -S.open) + .05 * Math.max(0, S.open)) + wob * Math.sin(t * 1.3 + k * 2); out.set(rad * Math.cos(th), wob * Math.cos(t * 1.1 + k) + S.lift * .12 * Math.max(0, Math.sin(t * 2.6 + k)), rad * Math.sin(th)).applyQuaternion(tiltQ); return th; }
  function update(t, S, pal, fit, off) {
    for (const p of plates) if (p.userData.saddle) { applyFit(p, fitK(fit, p.userData.order, .5), off); p.position.addScaledVector(p.userData.dir, .04 * Math.max(0, S.open) - .03 * Math.max(0, -S.open)); }
    near.set(pal.near); hot.set(pal.core); const cnt = Math.min(K, Math.round(K * clamp(S.signals, 0, 2) / 2));
    pods.forEach((p, k) => {
      const u = p.userData, th = orbit(t, S, k, u.home); tan.set(-Math.sin(th), 0, Math.cos(th)).applyQuaternion(tiltQ); u.homeQ.setFromUnitVectors(X, tan).premultiply(q1.setFromAxisAngle(tan, t * u.spin * S.speed * (1 + .6 * S.lift) + u.ph)); u.away.copy(u.home).multiplyScalar(1.9); u.awayQ.copy(u.homeQ).multiply(q1.setFromAxisAngle(V3(0, 1, 0), 1.3)); applyFit(p, fitK(fit, u.order, .6), off);
      const L = tethers[k], vis = p.visible ? u.edgeK * S.bright : 0, sx = u.home.x, sy = u.home.y, sz = u.home.z, len = Math.hypot(sx, sy, sz) || 1, ax = sx / len * hr, ay = sy / len * hr, az = sz / len * hr;
      for (let j = 0; j < 14; j++) { const v = j / 13, sag = .06 * Math.sin(Math.PI * v); L.pos[j * 3] = ax + (p.position.x - ax) * v; L.pos[j * 3 + 1] = ay + (p.position.y - ay) * v - sag; L.pos[j * 3 + 2] = az + (p.position.z - az) * v; setCol(L, j, near, (.2 + .45 * Math.sin(Math.PI * v) + .35 * v) * vis * .8); }
      L.flag();
      const s = sigs[k]; if (k >= cnt || !p.visible) { s.material.opacity = 0; return; } const v = ((t * .3 * S.speed + k / K) % 1 + 1) % 1; s.position.set(ax + (p.position.x - ax) * v, ay + (p.position.y - ay) * v - .06 * Math.sin(Math.PI * v), az + (p.position.z - az) * v); s.material.color.copy(hot); s.material.opacity = .9 * vis;
    });
  }
  return { group: g, plates, frame: .95, update };
}

// 6 Fundamental Investor — crystal. Icosahedral facets, inset for seams, locking top-back to bottom-front.
// The icosahedron is pure data (vectors, face order), cached across builds; resetIcosaCache() clears it at the
// engine's teardown.
let ICO = null;
export function resetIcosaCache() { ICO = null; }
export function icosaCached() { return ICO !== null; }
function icosa() {
  if (ICO) return ICO;
  const p = (1 + Math.sqrt(5)) / 2, verts = [[0, 1, p], [0, -1, p], [0, 1, -p], [0, -1, -p], [1, p, 0], [-1, p, 0], [1, -p, 0], [-1, -p, 0], [p, 0, 1], [-p, 0, 1], [p, 0, -1], [-p, 0, -1]].map(v => V3(...v).normalize());
  const adj = (a, b) => Math.abs(verts[a].distanceTo(verts[b]) - 1.0515) < .02, faces = [];
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) if (adj(a, b) && adj(b, c) && adj(a, c)) { const f = [a, b, c], n = verts[b].clone().sub(verts[a]).cross(verts[c].clone().sub(verts[a])); if (n.dot(verts[a]) < 0) { f[1] = c; f[2] = b; } faces.push(f); }
  const cen = f => verts[f[0]].clone().add(verts[f[1]]).add(verts[f[2]]).multiplyScalar(1 / 3), seed = V3(-.3, .9, -.3).normalize(), score = f => cen(f).dot(seed);
  let si = 0, best = -9; faces.forEach((f, i) => { const s = score(f); if (s > best) { best = s; si = i; } });
  const order = [faces[si]], used = new Set([si]); let qi = 0;
  while (order.length < faces.length && qi < order.length) { const f = order[qi++]; faces.map((g, i) => ({ g, i })).filter(o => !used.has(o.i) && f.filter(v => o.g.includes(v)).length === 2).sort((a, b) => score(b.g) - score(a.g)).forEach(o => { used.add(o.i); order.push(o.g); }); }
  ICO = { verts, faces: order }; return ICO;
}
function buildFund(E) {
  const r = rng(E.seed * 7 + 6), A = E.A, g = new THREE.Group(), plates = [], I = icosa(), cnt = [15, 20, 20][E.stage] || 20;
  I.faces.slice(0, cnt).forEach((f, fi) => {
    const vs = f.map(i => I.verts[i].clone()), c = vs[0].clone().add(vs[1]).add(vs[2]).multiplyScalar(1 / 3), dir = c.clone().normalize(), pts = vs.map(v => v.clone().lerp(c, .06)), etch = [];
    for (let e = 0; e < A.etch; e++) etch.push(polyFlat(pts.map(v => v.clone().lerp(c, .3 + .3 * e).addScaledVector(dir, .005))));
    const p = makePlate(polyPrism(pts, dir.clone().negate(), .07), E.mat, etch, { order: fi / cnt, thresh: 12 }); p.userData.dir.copy(dir); p.userData.fi = fi; setAway(p, 1.2, 1, r); plates.push(p); g.add(p);
  });
  function update(t, S, pal, fit, off) {
    const stress = Math.max(0, -S.open), op = Math.max(0, S.open);
    for (const p of plates) { const u = p.userData; applyFit(p, fitK(fit, u.order, .9), off); p.position.addScaledVector(u.dir, .09 * op - .05 * stress + .1 * S.lift * Math.max(0, Math.sin(t * 2.6 - u.fi * .5))); if (S.lift) u.edgeK *= .55 + .45 * Math.max(0, Math.sin(t * 3 - u.fi * .55)); }
  }
  return { group: g, plates, frame: .95, update };
}

export const BUILDERS = Object.freeze({ trend: buildTrend, contra: buildContra, spec: buildSpec, preserve: buildPreserve, divers: buildDivers, fund: buildFund });
