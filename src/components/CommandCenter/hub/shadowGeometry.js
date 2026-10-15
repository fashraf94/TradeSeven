// src/components/CommandCenter/hub/shadowGeometry.js
//
// Command Center hub, slice S1 — Shadow's filament geometry, ported from the
// design of record (docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html,
// module ff-shadow.jsx: SH_DIRS, SH_TIERS, SH_STILL_T, shRng, shStrands,
// shPoints, shMix, shStillPaths). Pure: no DOM, no clock, no colour literal.
//
// Three families of tilted filament loops, one per relationship area (family
// 0 = Partnership, 1 = Shared Research, 2 = Equipped Archetype), gather at a
// stable centre and swing out along their own axis. The still is the moving
// form at rest: the same strands from the same seed, sampled at t = SH_STILL_T
// with the reduced-motion yaw. S7's canvas animates this same geometry.
//
// Units: every point is in units of R, where the design draws R = size / 2.5,
// so the form fits a viewBox of −1.25 … 1.25 on both axes. Nothing outside
// ShadowStill (or S7's canvas) reads these points — the stage anchors to the
// Shadow box, never to a filament (ruling R-S1-1).
//
// Colour: a strand's colour is a depth mix between the far colour (token
// teal-2) and the near colour (token teal). This module returns the depth;
// the renderer mixes the two computed token hexes with mixHex().

/** Each family's axis: up, then 120° and 240° round from it. */
export const SH_DIRS = Object.freeze([
  -Math.PI / 2,
  -Math.PI / 2 + (2 * Math.PI) / 3,
  -Math.PI / 2 + (4 * Math.PI) / 3,
]);

/** Render tiers: strands per family, points per strand, glow pass. (The design's chunks/dpr are canvas-only.) */
export const SH_TIERS = Object.freeze({
  high: Object.freeze({ per: 9, pts: 44, glow: true }),
  mid: Object.freeze({ per: 7, pts: 36, glow: true }),
  low: Object.freeze({ per: 5, pts: 26, glow: false }),
});

/** The still's moment and its yaw (the design's reduced-motion yaw). */
export const SH_STILL_T = 7.3;
export const SH_STILL_YAW = 0.25;

/** The design's strand seed. */
export const SH_SEED = 11;

/** The mech-echo glow nodes — two eyes and a crown — in units of R, with their radii. */
export const SH_ECHO_NODES = Object.freeze([
  Object.freeze([-0.165, -0.34, 0.084]),
  Object.freeze([0.165, -0.34, 0.084]),
  Object.freeze([0, -1.0, 0.066]),
]);

/** A linear congruential generator, exactly the design's shRng. */
export function shRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** `per` strands for each of the three families, from the seed (the design's shStrands). */
export function shStrands(per, seed = SH_SEED) {
  const rnd = shRng(seed);
  const out = [];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < per; i++) {
      const q = per > 1 ? i / (per - 1) : 0.5;
      out.push({
        fam: k,
        spread: 0.5 + 0.6 * q + (rnd() - 0.5) * 0.1,
        len: 0.8 + 0.3 * rnd(),
        tilt: 0.16 + 0.44 * rnd(),
        rot0: rnd() * Math.PI * 2,
        rotV: (0.07 + 0.09 * rnd()) * (rnd() < 0.5 ? -1 : 1),
        ph: rnd() * Math.PI * 2,
        wob: 0.025 + 0.05 * rnd(),
        wobF: 1 + Math.floor(rnd() * 3),
        br: 0.06 + 0.1 * rnd(),
        w: 0.7 + 0.9 * rnd(),
      });
    }
  }
  return out;
}

/**
 * x, y, z (units of R) of `n` points along strand `s` at time `t`, written into
 * `pts` (length 3n). `sel` is the selected family or null (the design's shPoints).
 */
export function shPoints(s, t, n, sel, yaw, pts) {
  const d = SH_DIRS[s.fam];
  const ax = Math.cos(d);
  const ay = Math.sin(d);
  const px = -ay;
  const py = ax;
  const focus = sel == null ? 0 : sel === s.fam ? 1 : -0.6;
  const L = s.len * (1 + 0.05 * focus) * (1 + 0.035 * Math.sin(t * s.br * 2 + s.ph));
  const spread = s.spread * (1 - 0.12 * focus) * (1 + 0.08 * Math.sin(t * 0.21 + s.ph));
  const beta = s.rot0 + t * s.rotV;
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  for (let j = 0; j < n; j++) {
    const u = j / (n - 1);
    const su = Math.sin(Math.PI * u);
    const r = L * (0.07 + 0.93 * Math.pow(su, 0.85)) * (1 + s.wob * Math.sin(u * Math.PI * 2 * s.wobF + t * 0.6 + s.ph));
    const ang = d + spread * (2 * u - 1);
    const X = r * Math.cos(ang);
    const Y = r * Math.sin(ang);
    const pa = X * ax + Y * ay;
    const pp = X * px + Y * py;
    const z0 = L * s.tilt * Math.sin(Math.PI * 2 * u + s.ph);
    const pp2 = pp * cb - z0 * sb;
    const z1 = pp * sb + z0 * cb;
    const x = pa * ax + pp2 * px;
    const y = pa * ay + pp2 * py;
    pts[j * 3] = x * cy + z1 * sy;
    pts[j * 3 + 1] = y;
    pts[j * 3 + 2] = -x * sy + z1 * cy;
  }
}

/**
 * The still's strands, back to front (the design's shStillPaths, with the
 * colour left as a depth for the renderer to mix):
 *   d          SVG path data in units of R
 *   z          mean depth, the sort key
 *   depth      0 (far) … 1 (near), the colour mix
 *   alpha      stroke opacity
 *   width      stroke width, units of R
 *   glowWidth  the glow pass's stroke width, units of R
 *   glow       whether the tier draws the glow pass
 */
export function stillPaths(tier, sel) {
  const cfg = SH_TIERS[tier] || SH_TIERS.mid;
  const strands = shStrands(cfg.per);
  const n = cfg.pts;
  const pts = new Float32Array(n * 3);
  const out = [];
  for (const s of strands) {
    shPoints(s, SH_STILL_T, n, sel, SH_STILL_YAW, pts);
    let z = 0;
    for (let j = 0; j < n; j++) z += pts[j * 3 + 2];
    z /= n;
    const depth = Math.max(0, Math.min(1, (z / 0.9 + 1) / 2));
    const fam = sel == null ? 1 : sel === s.fam ? 1.35 : 0.62;
    let d = '';
    for (let j = 0; j < n; j++) d += `${j ? 'L' : 'M'}${pts[j * 3].toFixed(3)} ${pts[j * 3 + 1].toFixed(3)}`;
    out.push({
      d,
      z,
      depth,
      alpha: Math.min(1, (0.16 + 0.68 * depth) * fam),
      width: ((0.55 + 1.05 * depth) * s.w) / 150,
      glowWidth: ((3.2 + 2.4 * depth) * s.w) / 150,
      glow: cfg.glow,
    });
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}

const HEX = /^#([0-9a-f]{6})$/i;

/** '#rrggbb' → [r, g, b], or null for anything else (an unresolved token reads as ''). */
export function hexToRgb(hex) {
  const m = HEX.exec(typeof hex === 'string' ? hex.trim() : '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The design's shMix as a hex: far → near by t (0 … 1), each channel rounded.
 * '' if either input is not a 6-digit hex, so an unresolved token draws
 * nothing rather than a guessed colour.
 */
export function mixHex(farHex, nearHex, t) {
  const a = hexToRgb(farHex);
  const b = hexToRgb(nearHex);
  if (!a || !b) return '';
  const k = Math.max(0, Math.min(1, t));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** The render tier by composition (spec §10: start sparse — phone low, tablet and desktop mid; no high default). */
export function shadowTierFor(composition) {
  return composition === 'phone' ? 'low' : 'mid';
}
