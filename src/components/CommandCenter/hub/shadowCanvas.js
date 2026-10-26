// src/components/CommandCenter/hub/shadowCanvas.js
//
// Command Center hub, slice S7 — Shadow's canvas drawing and its small effects
// state, ported from the design of record (docs/design/
// 20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html, module ff-shadow.jsx:
// shDraw, shGlowDot, and the frame loop's signal / bloom bookkeeping). Pure: no
// DOM of its own (the caller hands in a 2D context), no clock (time arrives as
// an argument) and no randomness of its own (a `random` function arrives as an
// argument, so a test can make every flare deterministic). The loop, the
// observers and the cleanup are ShadowCanvas.jsx's.
//
// The geometry is hub/shadowGeometry.js's, the module the still is drawn from
// (S1's parity digest pins it): this file only strokes those points in motion.
//
// What moves (spec §10; ruling R-S7-3):
//   - the traveling signals and the small strand flares are AMBIENT: Shadow's
//     identity, tied to no event. Two signals at most at rest;
//   - `processing` quickens the clock, raises the glow and allows five signals.
//     The hub passes it only while a hub-started deployment is submitting;
//   - the center bloom (`triggerBloom`) is the response: a glow at the center
//     and one expanding ring, fired by the caller on its two triggers only.
//
// Colour: the caller passes three RGB triples read from the same tokens the
// still reads (teal near, teal-2 far, white core); nothing here names a colour.

import { SH_CANVAS, SH_ECHO_NODES, SH_TIERS, hexToRgb, shPoints, shStrands } from './shadowGeometry';

/** The still's yaw swings with t in motion; the design's range and rate. */
const YAW_SWING = 0.32;
const YAW_RATE = 0.07;

/** The center bloom's length, and the ring's, in seconds of Shadow's clock. */
export const BLOOM_SECONDS = 1.2;
export const RING_SECONDS = 0.9;

/**
 * The three colours as RGB triples, from the tokens' computed hexes (readToken). Null if any is not a 6-digit hex:
 * an unresolved token draws nothing rather than a guessed colour, so the caller takes the still.
 */
export function shadowColors(nearHex, farHex, coreHex) {
  const near = hexToRgb(nearHex);
  const far = hexToRgb(farHex);
  const core = hexToRgb(coreHex);
  return near && far && core ? Object.freeze({ near, far, core }) : null;
}

/** Far → near by t (0 … 1), as the design's shMix: the 'r,g,b' of a composed colour. */
function mix(a, b, t) {
  return `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`;
}

/** The strands of a tier with their working buffers: points, mean depths, and the back-to-front order (re-sorted each frame). */
export function createShadowRig(tier) {
  const cfg = SH_TIERS[tier] || SH_TIERS.mid;
  const canvasCfg = SH_CANVAS[SH_TIERS[tier] ? tier : 'mid'];
  const strands = shStrands(cfg.per);
  return {
    cfg,
    canvasCfg,
    strands,
    pts: new Float32Array(strands.length * cfg.pts * 3),
    depth: new Float32Array(strands.length),
    order: strands.map((_, i) => i),
  };
}

/** The effects state a loop keeps across a size or tier change: live signals, flares, the last response. */
export function createFx() {
  return { signals: [], blooms: [], event: null, nextSpawn: 0.6, nextBloom: 1.5 };
}

/** A tier change keeps the effects it can and drops those naming a strand the new tier does not have. */
export function fitFx(fx, strandCount) {
  fx.signals = fx.signals.filter((sg) => sg.i < strandCount);
  fx.blooms = fx.blooms.filter((b) => b.center || b.i < strandCount);
}

/** A signal's strand: mostly the selected area's family, else any (the design's `pick`). */
function pickStrand(strands, sel, random) {
  if (sel != null && random() < 0.7) {
    const family = [];
    for (let i = 0; i < strands.length; i++) if (strands[i].fam === sel) family.push(i);
    return family[Math.floor(random() * family.length)];
  }
  return Math.floor(random() * strands.length);
}

/**
 * One frame's effects step (the design's frame loop, minus the drawing): spawn and move signals, spawn and expire
 * flares. `t` is Shadow's clock after this frame, `dt` the frame's own seconds, `speed` the clock's rate.
 */
export function stepFx(fx, { t, dt, speed, processing, sel, strands }, random) {
  if (t > fx.nextSpawn) {
    if (fx.signals.length < (processing ? 5 : 2)) {
      fx.signals.push({ i: pickStrand(strands, sel, random), u: 0, v: (0.22 + random() * 0.12) * (processing ? 1.5 : 1) });
    }
    fx.nextSpawn = t + (processing ? 0.35 : 1.4 + random() * 1.6);
  }
  for (let q = 0; q < fx.signals.length; q++) fx.signals[q].u += fx.signals[q].v * dt * speed;
  fx.signals = fx.signals.filter((sg) => sg.u < 1.07);
  if (t > fx.nextBloom) {
    fx.blooms.push({ i: Math.floor(random() * strands.length), u: 0.3 + random() * 0.4, t0: t });
    fx.nextBloom = t + 2.2 + random() * 2.5;
  }
  fx.blooms = fx.blooms.filter((b) => t - b.t0 < BLOOM_SECONDS);
}

/** The response: a bloom at the center and one ring, from Shadow's clock now. */
export function triggerBloom(fx, t) {
  fx.event = t;
  fx.blooms.push({ center: true, t0: t });
}

const rgba = (rgb, a) => `rgba(${rgb},${a})`;

function glowDot(ctx, x, y, r, a, colors) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(colors.core.join(','), 0.95 * a));
  g.addColorStop(0.35, rgba(colors.near.join(','), 0.5 * a));
  g.addColorStop(1, rgba(colors.near.join(','), 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One frame (the design's shDraw): the halo, the strands back to front in depth-shaded runs, the blooms, the core, the
 * echo nodes (the eyes and the crown), the signals, and the response's ring.
 *
 * @param ctx   a 2D context, already scaled to CSS px (setTransform(dpr, …))
 * @param size  the box's side, px
 * @param t     Shadow's clock, seconds
 * @param rig   createShadowRig's result
 * @param P     { sel: 0|1|2|null, processing: boolean }
 * @param fx    createFx's state
 * @param colors shadowColors' result
 */
export function drawShadow(ctx, size, t, rig, P, fx, colors) {
  const { cfg, canvasCfg, strands, pts: all, depth } = rig;
  const n = cfg.pts;
  const R = size / 2.5;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  const yaw = YAW_SWING * Math.sin(t * YAW_RATE);
  const lift = P.processing ? 1.25 : 1;
  const near = colors.near.join(',');
  const far = colors.far;

  let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
  g.addColorStop(0, rgba(near, 0.1 * lift));
  g.addColorStop(0.55, rgba(near, 0.035));
  g.addColorStop(1, rgba(near, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < strands.length; i++) {
    const sub = all.subarray(i * n * 3, (i + 1) * n * 3);
    shPoints(strands[i], t, n, P.sel, yaw, sub);
    let z = 0;
    for (let j = 0; j < n; j++) z += sub[j * 3 + 2];
    depth[i] = z / n;
  }
  rig.order.sort((a, b) => depth[a] - depth[b]);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scale = R / 150;
  const chunkN = canvasCfg.chunks;
  const per = Math.floor((n - 1) / chunkN);
  for (let oi = 0; oi < rig.order.length; oi++) {
    const i = rig.order[oi];
    const s = strands[i];
    const sub = all.subarray(i * n * 3, (i + 1) * n * 3);
    const fam = P.sel == null ? 1 : P.sel === s.fam ? 1.35 : 0.62;
    for (let c = 0; c < chunkN; c++) {
      const j0 = c * per;
      const j1 = c === chunkN - 1 ? n - 1 : (c + 1) * per;
      let z = 0;
      for (let j = j0; j <= j1; j++) z += sub[j * 3 + 2];
      z /= j1 - j0 + 1;
      const dep = Math.max(0, Math.min(1, (z / 0.9 + 1) / 2));
      const a = Math.min(1, (0.16 + 0.68 * dep) * fam * lift);
      const col = mix(far, colors.near, dep);
      ctx.beginPath();
      ctx.moveTo(cx + sub[j0 * 3] * R, cy + sub[j0 * 3 + 1] * R);
      for (let j = j0 + 1; j <= j1; j++) ctx.lineTo(cx + sub[j * 3] * R, cy + sub[j * 3 + 1] * R);
      if (cfg.glow) {
        ctx.strokeStyle = rgba(col, a * 0.16);
        ctx.lineWidth = (3.2 + 2.4 * dep) * s.w * scale;
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = (0.55 + 1.05 * dep) * s.w * scale;
      ctx.stroke();
    }
  }

  for (let b = 0; b < fx.blooms.length; b++) {
    const bl = fx.blooms[b];
    const p = Math.min(1, (t - bl.t0) / BLOOM_SECONDS);
    const a = Math.sin(Math.PI * p) * 0.9;
    let x = cx;
    let y = cy;
    if (!bl.center) {
      const sub = all.subarray(bl.i * n * 3, (bl.i + 1) * n * 3);
      const j = Math.round(bl.u * (n - 1));
      x = cx + sub[j * 3] * R;
      y = cy + sub[j * 3 + 1] * R;
    }
    glowDot(ctx, x, y, R * (bl.center ? 0.3 : 0.14), a, colors);
  }

  const pulse = P.processing ? 1 + 0.18 * Math.sin(t * 5) : 1;
  g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.11 * pulse);
  g.addColorStop(0, rgba(colors.core.join(','), 0.95));
  g.addColorStop(0.35, rgba(near, Math.min(1, 0.55 * lift)));
  g.addColorStop(1, rgba(near, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.11 * pulse, 0, Math.PI * 2);
  ctx.fill();

  const cyaw = Math.cos(yaw);
  for (let k = 0; k < SH_ECHO_NODES.length; k++) {
    const [nx, ny, nr] = SH_ECHO_NODES[k];
    glowDot(ctx, cx + nx * cyaw * R, cy + ny * R, nr * R, 0.9, colors);
  }

  for (let q = 0; q < fx.signals.length; q++) {
    const sg = fx.signals[q];
    const sub = all.subarray(sg.i * n * 3, (sg.i + 1) * n * 3);
    for (let k = 0; k < 5; k++) {
      const u = sg.u - k * 0.014;
      if (u < 0 || u > 1) continue;
      const f = u * (n - 1);
      const j = Math.floor(f);
      const fr = f - j;
      const j2 = Math.min(n - 1, j + 1);
      const x = cx + (sub[j * 3] + (sub[j2 * 3] - sub[j * 3]) * fr) * R;
      const y = cy + (sub[j * 3 + 1] + (sub[j2 * 3 + 1] - sub[j * 3 + 1]) * fr) * R;
      const rr = (k === 0 ? 2.6 : 1.8) * scale;
      if (k === 0) glowDot(ctx, x, y, rr * 4, 0.9, colors);
      ctx.fillStyle = rgba(colors.core.join(','), (1 - k / 5) * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fx.event != null && t - fx.event < RING_SECONDS) {
    const p = (t - fx.event) / RING_SECONDS;
    ctx.strokeStyle = rgba(near, (1 - p) * 0.55);
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.12 + 0.9 * p), 0, Math.PI * 2);
    ctx.stroke();
  }
}
