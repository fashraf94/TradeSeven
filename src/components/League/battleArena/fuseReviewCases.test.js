// src/components/League/battleArena/fuseReviewCases.test.js
//
// The review instrument must actually exercise what it claims. A fixture pod
// that quietly fails to trigger compression (or to bunch the seats) would send
// the founder to look at an ordinary board and report "looks fine" — the worst
// possible outcome for a visual gate. Each row asserts the case reaches its
// target condition through the REAL geometry.

import { describe, it, expect } from 'vitest';
import { FUSE_REVIEW_CASES, FUSE_REVIEW_KEYS, fuseReviewOverlay } from './fuseReviewCases';
import { makeScale, latestTrailSnapshot, spreadLabels, fuseFrame } from './fuseGeometry';

const IDS = ['vela', 'atlas', 'helios', 'ember'];
const GEO = { plotT: 42, floorY: 358 };
const weekValues = (climb) => IDS.flatMap((id) => climb[id]);

describe('fuse review cases — each reaches the condition it exists to show', () => {
  it('every case is selectable and carries reviewer guidance', () => {
    expect(FUSE_REVIEW_KEYS).toEqual(['underwater', 'extremes', 'bunched', 'reload']);
    for (const k of FUSE_REVIEW_KEYS) {
      const o = fuseReviewOverlay(k);
      expect(o.climb, k).toBeTruthy();
      expect(o.label, k).toMatch(/\S/);
      expect(o.look, k).toMatch(/\?/); // a question for the reviewer to answer
    }
    expect(fuseReviewOverlay('nope')).toBeNull();
    expect(fuseReviewOverlay(undefined)).toBeNull();
  });

  it('underwater ENGAGES the labelled basement in week scope (and not in day scope)', () => {
    const { climb } = FUSE_REVIEW_CASES.underwater;
    const week = makeScale({ values: weekValues(climb), day: false, ...GEO });
    expect(week.basement).toBe(0.2);
    expect(week.linear).toBe(false);
    // day scope is always linear — the same pod must NOT compress there
    expect(makeScale({ values: weekValues(climb), day: true, ...GEO }).basement).toBe(0);
  });

  it('extremes is BOTH an extreme range AND compressed, and its y-labels survive thinning', () => {
    const { climb } = FUSE_REVIEW_CASES.extremes;
    const s = makeScale({ values: weekValues(climb), day: false, ...GEO });
    expect(s.HI).toBeGreaterThanOrEqual(44000);
    expect(s.LO).toBeLessThanOrEqual(-18000);
    expect(s.basement).toBe(0.2);
    // top / zero / floor stay far enough apart to all render
    const ys = [s.Y(s.HI), s.Y(0), s.Y(s.LO)];
    for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1])).toBeGreaterThanOrEqual(14);
  });

  it('bunched puts all four tips inside a few points AND forces the de-collider to displace heads', () => {
    const { climb, trail } = FUSE_REVIEW_CASES.bunched;
    const snap = latestTrailSnapshot(trail, IDS, {});
    const vals = IDS.map((id) => snap.values[id]);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2);

    const s = makeScale({ values: weekValues(climb).concat(vals), day: false, ...GEO });
    const F = fuseFrame({ w: 1316, h: 420 });
    const tipY = IDS.map((id) => ({ id, y: s.Y(snap.values[id]) }));
    const spread = spreadLabels(tipY, F.headGap, F.plotT + 20, F.floorY - 4);
    // at least one head is pushed clear of its tip → an elbow connector draws
    const displaced = tipY.filter((t) => Math.abs(spread[t.id] - t.y) > 4);
    expect(displaced.length).toBeGreaterThan(0);
  });

  it('reload supplies NO trail — the cold-mount spine state, seeded from the closes', () => {
    const { trail, climb } = FUSE_REVIEW_CASES.reload;
    expect(trail).toBeNull();
    const banked = Object.fromEntries(IDS.map((id) => [id, climb[id][climb[id].length - 1]]));
    const snap = latestTrailSnapshot(trail, IDS, banked);
    expect(snap.hasSamples).toBe(false);
    for (const id of IDS) expect(snap.values[id]).toBe(banked[id]); // never zero, never absent
  });

  it('the trailed cases carry REAL accumulator output: one shared x per tick, all four seats', () => {
    for (const key of ['underwater', 'extremes', 'bunched']) {
      const { trail } = FUSE_REVIEW_CASES[key];
      expect(trail.ticks, key).toBe(3);
      for (let k = 0; k < 3; k++) {
        const xs = IDS.map((id) => trail.samples[id][k].t);
        expect(new Set(xs).size, `${key} tick ${k}`).toBe(1);
      }
    }
  });
});
