// src/components/CommandCenter/hub/shadowCanvas.test.js
//
// Command Center hub, slice S7 — Shadow's canvas drawing and its effects state
// (hub/shadowCanvas.js), ported from the design of record's ff-shadow.jsx. Pure
// rows: a recording 2D context stands in for the canvas, and `random` is
// injected, so every flare and signal is deterministic (ruling R-S7-3).

import { describe, expect, it } from 'vitest';
import {
  BLOOM_SECONDS, RING_SECONDS, createFx, createShadowRig, drawShadow, fitFx, shadowColors, stepFx, triggerBloom,
} from './shadowCanvas';
import { SH_CANVAS, SH_ECHO_NODES, SH_TIERS, shadowTierFor } from './shadowGeometry';

const NEAR = '#5eead4';
const FAR = '#7fd4ff';
const CORE = '#ffffff';
const COLORS = shadowColors(NEAR, FAR, CORE);

/** A 2D context that records the calls a frame makes. */
function recorder() {
  const log = { strokes: [], arcs: [], stops: [], gradients: [], fillRects: 0, clears: 0, lineWidths: [] };
  const ctx = {
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    clearRect() { log.clears += 1; },
    fillRect() { log.fillRects += 1; },
    beginPath() {}, moveTo() {}, lineTo() {}, fill() {},
    arc(x, y, r) { log.arcs.push([x, y, r]); },
    stroke() { log.strokes.push(ctx.strokeStyle); log.lineWidths.push(ctx.lineWidth); },
    createRadialGradient(...args) { const g = { args, stops: [] }; log.gradients.push(g); return { addColorStop(at, color) { g.stops.push([at, color]); } }; },
  };
  return { ctx, log };
}

const frame = (tier, t, P, fx = createFx(), size = 250) => {
  const rig = createShadowRig(tier);
  const { ctx, log } = recorder();
  drawShadow(ctx, size, t, rig, { sel: null, processing: false, ...P }, fx, COLORS);
  return { rig, log };
};

const alphaOf = (rgba) => Number(/,([\d.]+)\)$/.exec(rgba)[1]);
const rgbOf = (rgba) => /^rgba\((\d+),(\d+),(\d+),/.exec(rgba).slice(1, 4).map(Number);

describe('shadowColors — the three token hexes as RGB triples', () => {
  it('reads each 6-digit hex', () => {
    expect(COLORS).toEqual({ near: [94, 234, 212], far: [127, 212, 255], core: [255, 255, 255] });
  });

  it('an unresolved token (\'\'), a var() string or a short hex gives null: nothing is drawn from a guessed colour', () => {
    expect(shadowColors('', FAR, CORE)).toBeNull();
    expect(shadowColors(NEAR, 'var(--ft-teal-2)', CORE)).toBeNull();
    expect(shadowColors(NEAR, FAR, '#fff')).toBeNull();
  });
});

describe('the rig — the strands of a tier, from the geometry module', () => {
  it.each([['low', 15, 26, 2, 1.5], ['mid', 21, 36, 3, 2]])('%s: %i strands of %i points, drawn in %i runs, backing store capped at %s×', (tier, strands, pts, chunks, dpr) => {
    const rig = createShadowRig(tier);
    expect(rig.strands).toHaveLength(strands);
    expect(rig.cfg.pts).toBe(pts);
    expect(rig.canvasCfg).toEqual({ chunks, dpr });
    expect(rig.pts).toHaveLength(strands * pts * 3);
    expect(rig.order).toEqual([...Array(strands).keys()]);
  });

  it('keeps the design\'s canvas-only numbers apart from SH_TIERS, which S1\'s digest pins', () => {
    expect(SH_CANVAS).toEqual({ high: { chunks: 4, dpr: 2 }, mid: { chunks: 3, dpr: 2 }, low: { chunks: 2, dpr: 1.5 } });
    expect(SH_TIERS.mid).toEqual({ per: 7, pts: 36, glow: true });
    expect(Object.keys(SH_TIERS.mid)).not.toContain('chunks');
  });

  it('an unknown tier draws mid, as the still does', () => {
    const rig = createShadowRig('ultra');
    expect(rig.strands).toHaveLength(21);
    expect(rig.canvasCfg).toEqual(SH_CANVAS.mid);
  });

  it('the hub only ever asks for low (phone) or mid: no composition selects high', () => {
    const tiers = ['phone', 'tablet', 'desktop', 'stacked', undefined, 'anything'].map(shadowTierFor);
    expect(new Set(tiers)).toEqual(new Set(['low', 'mid']));
  });
});

describe('stepFx — ambient signals and flares, deterministic under an injected random', () => {
  const strands = createShadowRig('mid').strands;
  const half = () => 0.5;
  const run = (opts, seconds, random = half) => {
    const fx = createFx();
    let t = 0;
    const seen = { maxSignals: 0 };
    for (let i = 0; i < Math.round(seconds / 0.016); i += 1) {
      t += 0.016;
      stepFx(fx, { t, dt: 0.016, speed: 1, processing: false, sel: null, strands, ...opts }, random);
      seen.maxSignals = Math.max(seen.maxSignals, fx.signals.length);
    }
    return { fx, seen };
  };

  it('nothing before the first spawn (0.6 s), and a signal then starts on a strand at u = 0', () => {
    const fx = createFx();
    stepFx(fx, { t: 0.5, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.signals).toEqual([]);
    stepFx(fx, { t: 0.61, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.signals).toHaveLength(1);
    expect(fx.signals[0].i).toBe(Math.floor(0.5 * strands.length));
    expect(fx.signals[0].v).toBeCloseTo(0.22 + 0.5 * 0.12, 10);
    expect(fx.nextSpawn).toBeCloseTo(0.61 + 1.4 + 0.5 * 1.6, 10);
  });

  it('at rest at most two signals travel; processing allows five, faster, spawned every 0.35 s', () => {
    expect(run({}, 12).seen.maxSignals).toBeLessThanOrEqual(2);
    const busy = run({ processing: true }, 12);
    expect(busy.seen.maxSignals).toBeGreaterThan(2);
    expect(busy.seen.maxSignals).toBeLessThanOrEqual(5);
    const fx = createFx();
    stepFx(fx, { t: 0.61, dt: 0.016, speed: 1, processing: true, sel: null, strands }, half);
    expect(fx.signals[0].v).toBeCloseTo((0.22 + 0.5 * 0.12) * 1.5, 10);
    expect(fx.nextSpawn).toBeCloseTo(0.61 + 0.35, 10);
  });

  it('a signal moves by v × dt × speed and is gone past u = 1.07', () => {
    const fx = createFx();
    fx.signals.push({ i: 0, u: 0.5, v: 0.3 });
    stepFx(fx, { t: 0.1, dt: 0.1, speed: 2, processing: false, sel: null, strands }, half);
    expect(fx.signals[0].u).toBeCloseTo(0.5 + 0.3 * 0.1 * 2, 10);
    fx.signals[0].u = 1.07;
    stepFx(fx, { t: 0.2, dt: 0, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.signals).toEqual([]);
  });

  it('with an area selected, 70% of signals ride that family\'s strands (the design\'s pick)', () => {
    const family = (i) => strands[i].fam;
    const picked = new Array(200).fill(0).map((_, n) => {
      const fx = createFx();
      const draws = [0.1, n / 200, 0.5];
      stepFx(fx, { t: 1, dt: 0.016, speed: 1, processing: false, sel: 2, strands }, () => draws.shift() ?? 0.5);
      return fx.signals[0].i;
    });
    expect(picked.every((i) => family(i) === 2)).toBe(true);
    // ...spread over the whole family (strands 14 to 20), not parked on one.
    expect(new Set(picked)).toEqual(new Set([14, 15, 16, 17, 18, 19, 20]));
    const elsewhere = createFx();
    const draws = [0.9, 0.0, 0.5];
    stepFx(elsewhere, { t: 1, dt: 0.016, speed: 1, processing: false, sel: 2, strands }, () => draws.shift() ?? 0.5);
    expect(elsewhere.signals[0].i).toBe(0);
  });

  it('the cap is a cap: with two ambient signals already travelling none is added (and the spawn clock still moves); processing allows five', () => {
    const live = () => ({ i: 0, u: 0.5, v: 0.01 });
    const at = (existing, processing) => {
      const fx = createFx();
      for (let k = 0; k < existing; k += 1) fx.signals.push(live());
      stepFx(fx, { t: 1, dt: 0, speed: 1, processing, sel: null, strands }, half);
      return fx;
    };
    expect(at(1, false).signals).toHaveLength(2);
    expect(at(2, false).signals).toHaveLength(2);
    expect(at(2, false).nextSpawn).toBeCloseTo(1 + 1.4 + 0.5 * 1.6, 10);
    expect(at(4, true).signals).toHaveLength(5);
    expect(at(5, true).signals).toHaveLength(5);
    expect(at(5, true).nextSpawn).toBeCloseTo(1.35, 10);
  });

  it('the family bias is 70%: a draw under it picks inside the family, a draw over it picks anywhere', () => {
    const pick = (first, second) => {
      const fx = createFx();
      const draws = [first, second, 0.5];
      stepFx(fx, { t: 1, dt: 0, speed: 1, processing: false, sel: 2, strands }, () => draws.shift() ?? 0.5);
      return fx.signals[0].i;
    };
    expect(pick(0.69, 0.3)).toBe(16);
    expect(pick(0.71, 0.3)).toBe(6);
  });

  it('area 0 is an area: the first family is picked from like any other (not mistaken for no selection)', () => {
    const fx = createFx();
    const draws = [0.1, 0.99, 0.5];
    stepFx(fx, { t: 1, dt: 0.016, speed: 1, processing: false, sel: 0, strands }, () => draws.shift() ?? 0.5);
    expect(fx.signals[0].i).toBe(6);
    expect(strands[6].fam).toBe(0);
  });

  it('a strand flare starts at 1.5 s on a strand, and ends after BLOOM_SECONDS', () => {
    const fx = createFx();
    stepFx(fx, { t: 1.49, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.blooms).toEqual([]);
    stepFx(fx, { t: 1.51, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.blooms).toHaveLength(1);
    expect(fx.blooms[0]).toMatchObject({ t0: 1.51, u: 0.3 + 0.5 * 0.4 });
    expect(fx.blooms[0].center).toBeUndefined();
    expect(fx.nextBloom).toBeCloseTo(1.51 + 2.2 + 0.5 * 2.5, 10);
    stepFx(fx, { t: 1.51 + BLOOM_SECONDS - 0.01, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.blooms).toHaveLength(1);
    stepFx(fx, { t: 1.51 + BLOOM_SECONDS + 0.01, dt: 0.016, speed: 1, processing: false, sel: null, strands }, half);
    expect(fx.blooms).toEqual([]);
  });

  it('is a pure function of its inputs: the same random sequence gives the same effects, a different one does not', () => {
    const seeded = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
    const a = run({}, 20, seeded(7)).fx;
    const b = run({}, 20, seeded(7)).fx;
    const c = run({}, 20, seeded(8)).fx;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

describe('the response — the center bloom and its ring', () => {
  it('triggerBloom stamps the clock and adds a center bloom', () => {
    const fx = createFx();
    triggerBloom(fx, 4.2);
    expect(fx.event).toBe(4.2);
    expect(fx.blooms).toEqual([{ center: true, t0: 4.2 }]);
  });

  it('draws a glow at the center and one expanding ring, and nothing once RING_SECONDS have passed', () => {
    const base = frame('mid', 5, {});
    const fx = createFx();
    triggerBloom(fx, 5);
    const half = frame('mid', 5 + RING_SECONDS / 2, {}, fx);
    const R = 250 / 2.5;
    expect(half.log.arcs.length).toBe(base.log.arcs.length + 2);
    const ring = half.log.arcs.at(-1);
    expect(ring[0]).toBe(125);
    expect(ring[1]).toBe(125);
    expect(ring[2]).toBeCloseTo(R * (0.12 + 0.9 * 0.5), 8);
    const glow = half.log.arcs.find(([, , r]) => Math.abs(r - R * 0.3) < 1e-9);
    expect(glow).toBeTruthy();
    const late = frame('mid', 5 + RING_SECONDS + 0.01, {}, fx);
    expect(late.log.arcs.length).toBe(base.log.arcs.length + 1);
  });

  it('the ring fades: its stroke alpha is (1 − p) × 0.55', () => {
    const fx = createFx();
    triggerBloom(fx, 0);
    const { log } = frame('low', RING_SECONDS / 2, {}, fx);
    expect(alphaOf(log.strokes.at(-1))).toBeCloseTo(0.5 * 0.55, 8);
    expect(rgbOf(log.strokes.at(-1))).toEqual([94, 234, 212]);
  });
});

describe('drawShadow — one frame', () => {
  it.each([['low', 15 * 2 * 1], ['mid', 21 * 3 * 2]])('%s strokes %i runs a frame (strands × runs × glow pass)', (tier, strokes) => {
    const { log } = frame(tier, 3, {});
    expect(log.strokes).toHaveLength(strokes);
    expect(log.clears).toBe(1);
  });

  it('every colour is a mix of the three token colours: strokes between far and near, the core white', () => {
    const { log } = frame('mid', 3, {});
    for (const s of log.strokes) {
      const [r, g, b] = rgbOf(s);
      expect(r).toBeGreaterThanOrEqual(94);
      expect(r).toBeLessThanOrEqual(127);
      expect(g).toBeGreaterThanOrEqual(212);
      expect(g).toBeLessThanOrEqual(234);
      expect(b).toBeGreaterThanOrEqual(212);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it('draws the mech-echo nodes — two eyes and a crown — at the geometry module\'s places, yawing with t', () => {
    const t = 7.3;
    const R = 250 / 2.5;
    const { log } = frame('low', t, {});
    const cyaw = Math.cos(0.32 * Math.sin(t * 0.07));
    for (const [nx, ny, nr] of SH_ECHO_NODES) {
      const hit = log.arcs.find(([x, y, r]) => Math.abs(x - (125 + nx * cyaw * R)) < 1e-9 && Math.abs(y - (125 + ny * R)) < 1e-9 && Math.abs(r - nr * R) < 1e-9);
      expect(hit, `node ${nx}, ${ny}`).toBeTruthy();
    }
  });

  it('the core pulses only while processing: ambient is exactly R × 0.11, processing is R × 0.11 × (1 + 0.18 sin 5t)', () => {
    const R = 250 / 2.5;
    const t = 0.4;
    const ambient = frame('low', t, { processing: false });
    const busy = frame('low', t, { processing: true });
    // arcs: the core first (no blooms, no signals), then the three echo nodes.
    expect(ambient.log.arcs[0][2]).toBeCloseTo(R * 0.11, 10);
    expect(busy.log.arcs[0][2]).toBeCloseTo(R * 0.11 * (1 + 0.18 * Math.sin(t * 5)), 10);
    expect(busy.log.arcs[0][2]).not.toBeCloseTo(R * 0.11, 3);
  });

  it('processing lifts the halo and the strands (×1.25, capped at 1); ambient does not', () => {
    const ambient = frame('mid', 3, { processing: false });
    const busy = frame('mid', 3, { processing: true });
    const halo = (f) => Number(/,([\d.]+)\)$/.exec(f.log.gradients[0].stops[0][1])[1]);
    expect(halo(ambient)).toBeCloseTo(0.1, 10);
    expect(halo(busy)).toBeCloseTo(0.125, 10);
    const total = (f) => f.log.strokes.reduce((n, s) => n + alphaOf(s), 0);
    expect(total(busy)).toBeGreaterThan(total(ambient));
    expect(Math.max(...busy.log.strokes.map(alphaOf))).toBeLessThanOrEqual(1);
  });

  it('a selected area leans out: its family draws brighter, the others recede (×1.35, ×0.62)', () => {
    const none = frame('low', 3, { sel: null });
    const one = frame('low', 3, { sel: 1 });
    expect(one.log.strokes.map(alphaOf)).not.toEqual(none.log.strokes.map(alphaOf));
    // Low draws two runs per strand, in the rig's depth order: the selected family's runs against the rest.
    const ratio = (f, sel) => {
      const mean = (list) => list.reduce((s, x) => s + x, 0) / list.length;
      const alphas = f.log.strokes.map(alphaOf);
      const inFamily = [];
      const rest = [];
      f.rig.order.forEach((strand, k) => {
        const bucket = f.rig.strands[strand].fam === sel ? inFamily : rest;
        bucket.push(alphas[2 * k], alphas[2 * k + 1]);
      });
      return mean(inFamily) / mean(rest);
    };
    // The geometry leans a little too, so compare with the unselected ratio: 1.35 / 0.62 is the extra the alpha adds.
    expect(ratio(one, 1) / ratio(none, 1)).toBeGreaterThan(1.8);
  });

  it('a signal draws a head with its glow and four trailing dots; one at the start of its strand has a shorter tail', () => {
    const none = frame('mid', 3, {});
    const fx = createFx();
    fx.signals.push({ i: 3, u: 0.5, v: 0.3 });
    const one = frame('mid', 3, {}, fx);
    expect(one.log.arcs.length).toBe(none.log.arcs.length + 6);
    const fresh = createFx();
    fresh.signals.push({ i: 3, u: 0.02, v: 0.3 });
    const start = frame('mid', 3, {}, fresh);
    // u = 0.02: the head and its glow, then one dot (0.006); the next two would sit before the strand's start.
    expect(start.log.arcs.length).toBe(none.log.arcs.length + 3);
  });

  it('the strands\' stroke widths scale with the box (R / 150)', () => {
    const small = frame('low', 3, {}, createFx(), 125);
    const big = frame('low', 3, {}, createFx(), 250);
    expect(big.log.lineWidths[0]).toBeCloseTo(small.log.lineWidths[0] * 2, 8);
  });

  it('is deterministic: the same inputs give the same calls', () => {
    const a = frame('mid', 4.4, { sel: 2 });
    const b = frame('mid', 4.4, { sel: 2 });
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
  });

  it('fitFx drops effects that name a strand a smaller tier lacks, and keeps the center bloom', () => {
    const fx = createFx();
    fx.signals.push({ i: 20, u: 0.1, v: 0.3 }, { i: 15, u: 0.1, v: 0.3 }, { i: 14, u: 0.1, v: 0.3 }, { i: 3, u: 0.1, v: 0.3 });
    fx.blooms.push({ i: 18, u: 0.5, t0: 0 }, { center: true, t0: 0 }, { i: 15, u: 0.5, t0: 0 }, { i: 14, u: 0.5, t0: 0 }, { i: 2, u: 0.5, t0: 0 });
    fitFx(fx, 15);
    // Strand 15 does not exist in a 15-strand tier (0 to 14).
    expect(fx.signals.map((s) => s.i)).toEqual([14, 3]);
    expect(fx.blooms.map((b) => (b.center ? 'center' : b.i))).toEqual(['center', 14, 2]);
  });

  it('strands are drawn back to front: the order is by mean depth, far first', () => {
    const { rig } = frame('mid', 4.4, { sel: null });
    for (let k = 1; k < rig.order.length; k += 1) expect(rig.depth[rig.order[k - 1]]).toBeLessThanOrEqual(rig.depth[rig.order[k]]);
    expect(rig.order).not.toEqual([...rig.order].sort((a, b) => a - b));
  });

  it('depth shades colour: the nearer the run, the nearer its colour to the near token — and the more opaque it is', () => {
    const red = shadowColors('#ff0000', '#0000ff', '#ffffff');
    const rig = createShadowRig('low');
    const { ctx, log } = recorder();
    drawShadow(ctx, 250, 3, rig, { sel: null, processing: false }, createFx(), red);
    const runs = log.strokes.map((s) => ({ a: alphaOf(s), r: rgbOf(s)[0], b: rgbOf(s)[2] }));
    runs.sort((x, y) => x.a - y.a);
    for (let k = 1; k < runs.length; k += 1) expect(runs[k].r).toBeGreaterThanOrEqual(runs[k - 1].r);
    expect(runs.at(-1).r).toBeGreaterThan(runs[0].r);
    expect(runs.at(-1).b).toBeLessThan(runs[0].b);
  });
});
