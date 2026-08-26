// @vitest-environment jsdom
//
// Phase 2 — the session composite trail, proven on a CONTROLLED clock.
//
// Harness mirrors useArenaPriceContext.restFallback.test.jsx (the sibling hook
// test in this directory): jsdom + createRoot + React 19's `act`, no RTL.
//
// The degraded-input rows drive the hook through the REAL `seatAltitude` /
// `seatHasLiveSample` pair rather than hand-written flags, so `null` / `{}` /
// partial maps flow through the same resolution the model performs. `resolve()`
// below mirrors buildArenaModel's loop (buildArenaModel.js:458-475); the model's
// own exposure of those three keys is pinned in buildArenaModel.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { seatAltitude, seatHasLiveSample } from './seatAltitude';
import { useSessionCompositeTrail, appendTrailSnapshot, emptyTrail, TRAIL_CAPACITY } from './useSessionCompositeTrail';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const YOU = 'you';
const IDS = [YOU, 'r1', 'r2', 'r3'];
const BANKED = { [YOU]: 10, r1: 20, r2: 30, r3: 40 };
const TICK = 60_000;

// Mirrors buildArenaModel's sampling loop, using the REAL resolver + predicate.
function resolve({ youLiveScore = null, liveComposites = null } = {}) {
  const scoresAtLast = {};
  const seatLive = {};
  for (const id of IDS) {
    const ctx = { youId: YOU, youLiveScore, liveComposites, banked: BANKED[id] };
    scoresAtLast[id] = seatAltitude(id, ctx);
    seatLive[id] = seatHasLiveSample(id, ctx);
  }
  return { scoresAtLast, seatLive };
}

let container; let root; let latest;

function Probe(props) {
  latest = useSessionCompositeTrail({ ids: IDS, seatBanked: BANKED, enabled: true, ...props });
  return null;
}

function mount(props) {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => { root.render(<Probe {...props} />); });
}
function update(props) {
  act(() => { root.render(<Probe {...props} />); });
}
function advance(ms) {
  act(() => { vi.advanceTimersByTime(ms); });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  if (root) act(() => root.unmount());
  root = null; container = null; latest = null;
  vi.useRealTimers();
});

describe('useSessionCompositeTrail — one shared clock over out-of-phase upstreams', () => {
  it('samples ALL FOUR seats at the SAME x on every tick, though the two upstreams are offset', () => {
    // The rival stream and the price-context stream each run their own ~60s
    // interval and are mounted at different moments (Phase 0.5 / A3.2). Here the
    // rival map lands on the minute; youLiveScore lands 25s later, permanently.
    let rivals = { r1: 21, r2: 31, r3: 41 };  // rival poll #1 already delivered
    let you = null;                            // your price context has NOT ticked yet

    mount(resolve({ youLiveScore: you, liveComposites: rivals }));

    const seen = [];
    for (let k = 0; k < 3; k++) {
      // +25s: the price-context stream ticks (your composite recomputes)
      advance(25_000);
      you = 11 + k;
      update(resolve({ youLiveScore: you, liveComposites: rivals }));

      // +35s → the shared clock reaches its own 60s boundary and snapshots
      advance(35_000);

      // the rival stream ticks on the minute, just after
      rivals = { r1: 21 + k, r2: 31 + k, r3: 41 + k };
      update(resolve({ youLiveScore: you, liveComposites: rivals }));

      seen.push(latest.ticks);
    }

    expect(latest.ticks).toBe(3);
    for (const id of IDS) expect(latest.samples[id]).toHaveLength(3);

    // THE INVARIANT: at each tick index every seat shares one x.
    for (let k = 0; k < 3; k++) {
      const xs = IDS.map((id) => latest.samples[id][k].t);
      expect(new Set(xs).size, `tick ${k} split across ${xs.length} x positions: ${xs}`).toBe(1);
    }
    // …and x advances by exactly one clock period, never by an upstream's phase.
    const xs = latest.samples[YOU].map((s) => s.t);
    expect(xs[1] - xs[0]).toBe(TICK);
    expect(xs[2] - xs[1]).toBe(TICK);
  });

  it('carries a lagging seat forward at its last OBSERVED value — never back to the banked floor', () => {
    // you climbs to 18 live, then your upstream stops delivering. The banked
    // floor is 10: re-reading scoresAtLast would draw you diving 18 → 10.
    mount(resolve({ youLiveScore: 18, liveComposites: { r1: 21, r2: 31, r3: 41 } }));
    advance(TICK);
    expect(latest.samples[YOU][0].v).toBe(18);

    update(resolve({ youLiveScore: null, liveComposites: { r1: 22, r2: 32, r3: 42 } }));
    advance(TICK);

    expect(latest.samples[YOU]).toHaveLength(2);
    expect(latest.samples[YOU][1].v).toBe(18);      // carried, not floored
    expect(latest.samples[YOU][1].v).not.toBe(10);  // the banked floor
    expect(latest.samples[YOU][1].v).not.toBe(0);
    expect(latest.samples.r1[1].v).toBe(22);        // a live seat still advances
  });
});

describe('useSessionCompositeTrail — degraded inputs append nothing, never a zero', () => {
  // num()'s zero-coercion downstream means a mishandled failure would draw a
  // seat's line diving to zero and read as a catastrophic loss, not a gap.
  const CASES = [
    ['null (off-gate — no poll ever runs)', null],
    ['{} (fetch failed)', {}],
  ];

  for (const [label, liveComposites] of CASES) {
    it(`${label}: with your seat also dark, the trail does not extend at all`, () => {
      mount(resolve({ youLiveScore: null, liveComposites }));
      advance(TICK * 3);
      expect(latest.ticks).toBe(0);
      for (const id of IDS) expect(latest.samples[id] ?? []).toHaveLength(0);
      // the seed still anchors the (empty) trail — the reload state renders a
      // flat spine at the last close, never an empty chart (R3).
      expect(latest.seeds).toEqual(BANKED);
    });

    it(`${label}: with your seat live, rivals carry forward rather than zeroing`, () => {
      mount(resolve({ youLiveScore: 12, liveComposites }));
      advance(TICK);
      expect(latest.ticks).toBe(1);
      expect(latest.samples[YOU][0].v).toBe(12);
      for (const id of ['r1', 'r2', 'r3']) {
        expect(latest.samples[id][0].v).toBe(BANKED[id]); // the seed, its last observed truth
        expect(latest.samples[id][0].v).not.toBe(0);
      }
    });
  }

  it('a PARTIAL map advances the seats it carries and holds the one it omits', () => {
    mount(resolve({ youLiveScore: 12, liveComposites: { r1: 21, r2: 31, r3: 41 } }));
    advance(TICK);

    update(resolve({ youLiveScore: 13, liveComposites: { r1: 25, r3: 45 } })); // r2 missing
    advance(TICK);

    expect(latest.samples.r1[1].v).toBe(25);
    expect(latest.samples.r3[1].v).toBe(45);
    expect(latest.samples.r2[1].v).toBe(31);     // held at its last observation
    expect(latest.samples.r2[1].v).not.toBe(30); // not the banked floor
    expect(latest.samples.r2[1].v).not.toBe(0);
    // still one x across all four
    expect(new Set(IDS.map((id) => latest.samples[id][1].t)).size).toBe(1);
  });
});

describe('useSessionCompositeTrail — seed, capacity, gating, hygiene', () => {
  it('holds the seed OUTSIDE the rolling buffer, so capacity can never evict the anchor', () => {
    // Driven through the pure core: capacity+50 snapshots at a small capacity.
    const CAP = 5;
    let trail = emptyTrail({ ...BANKED });
    for (let k = 0; k < CAP + 50; k++) {
      trail = appendTrailSnapshot(trail, {
        ids: IDS,
        scoresAtLast: Object.fromEntries(IDS.map((id) => [id, 100 + k])),
        seatLive: Object.fromEntries(IDS.map((id) => [id, true])),
        t: k * TICK,
        capacity: CAP,
      });
    }
    for (const id of IDS) {
      expect(trail.samples[id]).toHaveLength(CAP);           // rolled
      expect(trail.samples[id][0].v).toBe(100 + 50);         // oldest dropped
    }
    expect(trail.seeds).toEqual(BANKED);                     // anchor intact after 50 evictions
  });

  it('defaults to a 480-sample cap (a full session at 60s, with headroom)', () => {
    expect(TRAIL_CAPACITY).toBe(480);
  });

  it('disabled (off-gate / not live) runs no timer and accumulates nothing', () => {
    mount({ ...resolve({ youLiveScore: 12, liveComposites: { r1: 21, r2: 31, r3: 41 } }), enabled: false });
    advance(TICK * 5);
    expect(latest.ticks).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(latest.seeds).toEqual(BANKED);
  });

  it('clears its timer on unmount (no orphaned clock)', () => {
    mount(resolve({ youLiveScore: 12, liveComposites: { r1: 21, r2: 31, r3: 41 } }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => root.unmount());
    root = null;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('persists NOTHING and calls NO network (R3 hard requirement)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.fn();
    const priorFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      mount(resolve({ youLiveScore: 12, liveComposites: { r1: 21, r2: 31, r3: 41 } }));
      advance(TICK * 4);
      expect(latest.ticks).toBe(4);
      expect(setItem).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = priorFetch;
      setItem.mockRestore();
    }
  });

  it('the trail never extends past the newest real sample', () => {
    mount(resolve({ youLiveScore: 12, liveComposites: { r1: 21, r2: 31, r3: 41 } }));
    advance(TICK * 2);
    const afterLive = latest.samples[YOU].length;

    // every upstream goes dark; the clock keeps running
    update(resolve({ youLiveScore: null, liveComposites: null }));
    advance(TICK * 10);

    expect(latest.samples[YOU]).toHaveLength(afterLive);
    expect(latest.ticks).toBe(2);
  });
});
