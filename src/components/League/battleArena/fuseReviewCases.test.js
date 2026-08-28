// src/components/League/battleArena/fuseReviewCases.test.js
//
// The review instrument must actually exercise what it claims. A fixture pod
// that quietly fails to trigger compression (or to bunch the seats) would send
// the founder to look at an ordinary board and report "looks fine" — the worst
// possible outcome for a visual gate. Each row asserts the case reaches its
// target condition through the REAL geometry.

import { describe, it, expect } from 'vitest';
import { FUSE_REVIEW_CASES, FUSE_REVIEW_KEYS, fuseReviewOverlay } from './fuseReviewCases';
import { makeScale, latestTrailSnapshot, spreadLabels, fuseFrame, sessionFraction } from './fuseGeometry';

const IDS = ['vela', 'atlas', 'helios', 'ember'];
const GEO = { plotT: 42, floorY: 358 };
const BUNCHED_LAST_CLOSE_HELIOS = 12.2;
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

  // PIN MOVED, DELIBERATELY. This row used to assert `trail === null` and that
  // every cold-mount value equalled the BANKED SEED — which is precisely the
  // defect the founder caught on a phone: for the first minute of every session
  // your seat printed 0.0 in Today while the decomposition strip already showed
  // the live number. The fixture now carries a seeded trail with NO samples and
  // a live HEAD, which is what a real fresh mount holds, and the row asserts the
  // corrected reading.
  it('reload has NO sampled history but a LIVE head — the corrected cold-mount', () => {
    const { trail, climb } = FUSE_REVIEW_CASES.reload;
    const banked = Object.fromEntries(IDS.map((id) => [id, climb[id][climb[id].length - 1]]));
    const snap = latestTrailSnapshot(trail, IDS, banked);
    expect(snap.hasSamples).toBe(false);                    // nothing observed yet
    expect(trail.samples).toEqual({});                      // …genuinely nothing
    for (const id of IDS) {
      expect(snap.values[id]).toBe(trail.head.values[id]);  // the tip is the model's NOW
      expect(Number.isFinite(snap.values[id])).toBe(true);  // never zero, never absent
    }
    // At least one seat has actually moved off its close, or the case cannot
    // show what it exists to show.
    expect(IDS.some((id) => snap.values[id] !== banked[id])).toBe(true);
  });

  it('the trailed cases carry REAL accumulator output: one shared x per tick, all four seats', () => {
    for (const key of ['underwater', 'extremes', 'bunched']) {
      const { trail } = FUSE_REVIEW_CASES[key];
      expect(trail.ticks, key).toBe(10);
      for (let k = 0; k < trail.ticks; k++) {
        const xs = IDS.map((id) => trail.samples[id][k].t);
        expect(new Set(xs).size, `${key} tick ${k}`).toBe(1);
      }
    }
  });

  // ── D1 regression: the instrument must SPAN the session ──────────────────
  // The defect the founder saw was these pods spanning ten minutes of a
  // 390-minute axis, so every fuse sat in the leftmost ~4% and the board looked
  // like it was mapping by index. A pod that silently reverts to a narrow span
  // would reproduce that false signal on the next review.
  it('every trailed case spans most of the session and ENDS mid-afternoon', () => {
    for (const key of ['underwater', 'extremes', 'bunched']) {
      const { trail } = FUSE_REVIEW_CASES[key];
      const ts = trail.samples.vela.map((x) => x.t);
      const first = sessionFraction(ts[0]);
      const last = sessionFraction(ts[ts.length - 1]);
      expect(first, `${key} first`).toBeLessThan(0.05);
      expect(last, `${key} last`).toBeGreaterThan(0.6);   // fills the board
      expect(last, `${key} last`).toBeLessThan(1);        // still burning, not at CLOSE
    }
  });

  it('the ticks are NON-uniform, so a gap visibly renders as a gap (D1)', () => {
    const ts = FUSE_REVIEW_CASES.bunched.trail.samples.vela.map((x) => sessionFraction(x.t));
    const gaps = ts.slice(1).map((f, i) => f - ts[i]);
    const widest = Math.max(...gaps);
    const narrowest = Math.min(...gaps);
    expect(widest / narrowest).toBeGreaterThan(2); // an index mapping would give exactly 1
  });

  it('bunched exercises carry-forward on screen: helios holds through a dropped poll', () => {
    const h = FUSE_REVIEW_CASES.bunched.trail.samples.helios;
    expect(h[5].v).toBe(h[4].v);                       // held, not floored
    expect(h[5].v).not.toBe(BUNCHED_LAST_CLOSE_HELIOS); // and not the banked close
  });
});

// ── D2: each case must OPEN in the scope its question can be answered in ────
describe('fuse review cases — forced scope (D2)', () => {
  it('every case declares a scope, and the compressed cases open in THE WEEK', () => {
    for (const k of FUSE_REVIEW_KEYS) {
      expect(['day', 'week'], k).toContain(FUSE_REVIEW_CASES[k].scope);
      expect(fuseReviewOverlay(k).scope, k).toBe(FUSE_REVIEW_CASES[k].scope);
    }
    // basement is week-only by construction — opening these in Today disabled
    // the exact behaviour they exist to show (the D2 defect).
    expect(FUSE_REVIEW_CASES.underwater.scope).toBe('week');
    expect(FUSE_REVIEW_CASES.extremes.scope).toBe('week');
  });

  it("each case's forced scope actually ENABLES the behaviour its banner asks about", () => {
    for (const k of ['underwater', 'extremes']) {
      const { climb, scope } = FUSE_REVIEW_CASES[k];
      const day = scope === 'day';
      const s = makeScale({ values: weekValues(climb), day, ...GEO });
      expect(s.basement, `${k} in its own scope`).toBe(0.2);
      // and the scope it is NOT opened in would have hidden it
      expect(makeScale({ values: weekValues(climb), day: !day, ...GEO }).basement).toBe(0);
    }
  });
});

describe('CR4 — the case key is validated against the published list', () => {
  it('inherited prototype members never resolve (an unvalidated param would white-screen)', () => {
    for (const k of ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(fuseReviewOverlay(k), k).toBeNull();
    }
  });
  it('real keys still resolve', () => {
    for (const k of FUSE_REVIEW_KEYS) expect(fuseReviewOverlay(k)).toBeTruthy();
  });
});
