// src/components/CommandCenter/hub/shadowCanvas.parity.test.js
//
// Command Center hub, slice S7 — the canvas is the design's canvas. hub/shadowCanvas.js (drawShadow, stepFx,
// triggerBloom) was checked against the design of record's own module (ff-shadow.jsx shDraw and its frame loop, decoded
// from docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html): the same seeded random stream, the design's
// own colours (#5EEAD4, #7FD4FF, #ECFFFB), both tiers the hub draws, three selections (none, 0, 2), 420 frames with
// processing from frame 100 to 230 and a response at frame 150 — every 2D-context call and property write of every frame,
// identical, with ONE declared departure: the eyes' x is ±0.165 (the geometry module's, which S1's digest pins and the
// still draws) where the design's canvas draws ±0.17. That check is a scratch run (the decoded file is never committed);
// the digests below pin what it saw, so any drift of a constant, a colour role, a depth shade, an alpha, a width, a radius,
// a flare, a signal or the response's clock from the design reds here. They are the S1 digest's twin for motion.
//
// The log is rounded to 1e-6, so a last-bit difference between engines cannot move a digest.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFx, createShadowRig, drawShadow, fitFx, shadowColors, stepFx, triggerBloom } from './shadowCanvas';

const r6 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);

/** A context that logs every call and every property write, gradients by their order of creation. */
function recorder(log) {
  let g = 0;
  return new Proxy({}, {
    get(_t, name) {
      if (name === 'createRadialGradient') {
        return (...a) => {
          g += 1;
          const id = g;
          log.push(`createRadialGradient(${a.map(r6)})`);
          return { id, addColorStop: (o, c) => log.push(`stop#${id}(${r6(o)},${c})`) };
        };
      }
      return (...a) => { log.push(`${String(name)}(${a.map(r6)})`); };
    },
    set(_t, name, v) {
      log.push(`${String(name)}=${v && typeof v === 'object' && 'id' in v ? `grad#${v.id}` : r6(v)}`);
      return true;
    },
  });
}

const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** The scenario, driven exactly as ShadowCanvas's frame loop drives the pure module. */
function runPort({ tier, size, sel, frames, procFrom, procTo, eventAt, seed }) {
  const log = [];
  const ctx = recorder(log);
  const rig = createShadowRig(tier);
  const colors = shadowColors('#5EEAD4', '#7FD4FF', '#ECFFFB');
  const fx = createFx();
  fitFx(fx, rig.strands.length);
  const random = rnd(seed);
  let t = 0;
  drawShadow(ctx, size, t, rig, { sel, processing: false }, fx, colors);
  for (let f = 0; f < frames; f += 1) {
    const processing = f >= procFrom && f < procTo;
    if (f === eventAt) triggerBloom(fx, t);
    const dt = 0.016;
    const speed = processing ? 1.6 : 1;
    t += dt * speed;
    stepFx(fx, { t, dt, speed, processing, sel, strands: rig.strands }, random);
    drawShadow(ctx, size, t, rig, { sel, processing }, fx, colors);
  }
  return log;
}

const sha = (lines) => createHash('sha256').update(lines.join('\n')).digest('hex');

/** [label, scenario, digest of the port's log, number of logged calls] */
const CASES = [
  ['low · no selection', { tier: 'low', size: 200, sel: null }, '0ea097f4fb9d7671c1a4516b656d7a9aa21b45452bf92492186036e12edd1b73', 260577],
  ['low · Partnership', { tier: 'low', size: 200, sel: 0 }, '8ee371da19c7d1d833a4fc372291690f1052a0d13b2da083c1ed0b38bb9e2381', 262189],
  ['low · Equipped Archetype', { tier: 'low', size: 200, sel: 2 }, 'b08151b7cef04cb41da31922e564c43a09a03edfa6f5b2e6c11e1884c268a3e9', 262189],
  ['mid · no selection', { tier: 'mid', size: 340, sel: null }, 'b4c451770ff58706c3a1356ebd46aa6819880f97c7baab1fef2c67b8354ac402', 561171],
  ['mid · Partnership', { tier: 'mid', size: 340, sel: 0 }, 'c6df74fee7ed21cc2d99a8ceff34f6bde5c00fc92489d4efff96ed96c2fa68e7', 562783],
  ['mid · Equipped Archetype', { tier: 'mid', size: 340, sel: 2 }, 'cb05e255a806ca63dcf77b23e3d634885afac2d24384d9c64be60a43f6efcaa9', 562783],
];
const SCENARIO = { frames: 420, procFrom: 100, procTo: 230, eventAt: 150, seed: 7 };

describe('the canvas draws what the design\'s canvas draws (a digest of 420 frames, six scenarios; the eyes\' x is the one declared departure)', () => {
  it.each(CASES.map((c) => [c[0], c]))('%s', (_label, [, base, digest, calls]) => {
    const log = runPort({ ...base, ...SCENARIO });
    if (process.env.PRINT_SHADOW_DIGESTS === '1') console.log(`DIGEST ${base.tier}/${base.sel}: ${sha(log)} ${log.length}`);
    expect(log.length).toBe(calls);
    expect(sha(log)).toBe(digest);
  });

  it('the scenario exercises everything the digest is meant to pin: flares, signals, the response, processing and the echo nodes', () => {
    const log = runPort({ tier: 'mid', size: 340, sel: 2, ...SCENARIO });
    const text = log.join('\n');
    const R = 340 / 2.5;
    // A center bloom (R × 0.3), a strand flare (R × 0.14), a ring (a stroke with a fading alpha), signals (small filled dots).
    expect(text).toContain(`arc(170,170,${r6(R * 0.3)},0,${r6(Math.PI * 2)})`);
    expect(text).toContain(`,${r6(R * 0.14)},0,${r6(Math.PI * 2)})`);
    expect(log.filter((l) => l.startsWith('lineWidth=')).length).toBeGreaterThan(5000);
    expect(log.filter((l) => l.startsWith('fillStyle=rgba(')).length).toBeGreaterThan(100);
  });
});
