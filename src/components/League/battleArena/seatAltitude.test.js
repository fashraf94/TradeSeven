// src/components/League/battleArena/seatAltitude.test.js
//
// The ONE altitude ruler (Option X). Pins the per-seat resolution both ClimbArena's
// `at` and buildArenaModel's scoresAtLast read through — see b3Lockstep.test.js for
// the "both call sites move together" guarantee.

import { describe, it, expect } from 'vitest';
import { seatAltitude, seatHasLiveSample } from './seatAltitude';

const CTX = (over = {}) => ({
  youId: 'u-you', youLiveScore: 93, liveComposites: { 'u-riv': 41, 'cpu-1': 8 }, banked: 5, ...over,
});

describe('seatAltitude', () => {
  it('YOU → youLiveScore (the per-tick client path), never the endpoint map', () => {
    // Even if the endpoint map carries your id, Option X ignores it for you.
    expect(seatAltitude('u-you', CTX({ liveComposites: { 'u-you': 999, 'u-riv': 41 } }))).toBe(93);
  });

  it('YOU → banked when youLiveScore is null/non-finite (orb off-gate)', () => {
    expect(seatAltitude('u-you', CTX({ youLiveScore: null }))).toBe(5);
    expect(seatAltitude('u-you', CTX({ youLiveScore: NaN }))).toBe(5);
  });

  it('a RIVAL → its endpoint live composite when present', () => {
    expect(seatAltitude('u-riv', CTX())).toBe(41);
    expect(seatAltitude('cpu-1', CTX())).toBe(8);
  });

  it('a RIVAL → banked when the map is null, absent, or non-finite (off-gate / degraded)', () => {
    expect(seatAltitude('u-riv', CTX({ liveComposites: null }))).toBe(5);       // flag off
    expect(seatAltitude('u-riv', CTX({ liveComposites: {} }))).toBe(5);          // empty map
    expect(seatAltitude('u-riv', CTX({ liveComposites: { 'u-riv': NaN } }))).toBe(5); // degraded value
    expect(seatAltitude('cpu-9', CTX())).toBe(5);                                // id not in map
  });

  it('banked floor guards non-finite → 0 (never NaN into the climb)', () => {
    expect(seatAltitude('u-riv', CTX({ liveComposites: null, banked: undefined }))).toBe(0);
    expect(seatAltitude('u-you', CTX({ youLiveScore: null, banked: NaN }))).toBe(0);
  });

  it('a live composite of exactly 0 is honored (0 is a real altitude, not "absent")', () => {
    expect(seatAltitude('u-riv', CTX({ liveComposites: { 'u-riv': 0 }, banked: 5 }))).toBe(0);
  });
});

// ── the sampling predicate (Phase 2) ────────────────────────────────────────
// seatHasLiveSample must branch on EXACTLY the conditions seatAltitude branches
// on. These rows pin them TOGETHER: the truth table below is derived from the
// resolver's own behaviour, so changing one branch without the other fails here.
describe('seatHasLiveSample — pinned to seatAltitude\'s branches', () => {
  it('is true exactly when the resolver returns a LIVE reading rather than the floor', () => {
    // Each row: a context where the answer is unambiguous because the live value
    // and the banked floor differ. live ⇔ resolver !== floor.
    const rows = [
      ['u-you', CTX()],                                              // you, live
      ['u-you', CTX({ youLiveScore: null })],                        // you, off-gate
      ['u-you', CTX({ youLiveScore: NaN })],                         // you, degraded
      ['u-riv', CTX()],                                              // rival, live
      ['u-riv', CTX({ liveComposites: null })],                      // rival, flag off
      ['u-riv', CTX({ liveComposites: {} })],                        // rival, failed fetch
      ['u-riv', CTX({ liveComposites: { 'u-riv': NaN } })],          // rival, degraded value
      ['cpu-9', CTX()],                                              // rival, absent from map
    ];
    for (const [id, ctx] of rows) {
      const resolvedIsLive = seatAltitude(id, ctx) !== ctx.banked;
      expect(seatHasLiveSample(id, ctx), `${id} / ${JSON.stringify(ctx.liveComposites)}`)
        .toBe(resolvedIsLive);
    }
  });

  it('YOUR seat is never live off the endpoint map, even when it carries your id', () => {
    expect(seatHasLiveSample('u-you', CTX({ youLiveScore: null, liveComposites: { 'u-you': 999 } }))).toBe(false);
  });

  it('a live composite of exactly 0 counts as a real sample (not "absent")', () => {
    // The zero-coercion trap: 0 is a real altitude. Treating it as absent would
    // make the trail carry a seat forward through a genuine flat-to-zero move.
    expect(seatHasLiveSample('u-riv', CTX({ liveComposites: { 'u-riv': 0 } }))).toBe(true);
    expect(seatHasLiveSample('u-you', CTX({ youLiveScore: 0 }))).toBe(true);
  });
});
