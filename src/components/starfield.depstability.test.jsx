// @vitest-environment jsdom
//
// R-T2-S12 — THE POLL-IDENTITY HAZARD, and nothing else.
// Delight Layer arc, Task 2 (Phase 2).
//
// Deliberately NARROW per the ruling: this is not a general canvas
// draw-testing rig. It asserts exactly one property, the one that Phase 2's
// prop threading makes reachable and that no other test in the repo can see:
//
//     a NEW `liveGames` array identity must NOT restart the field.
//
// WHY THIS EXISTS. `App.jsx:3903` calls setActiveAgentBattles(battles) on every
// 120s poll, so `starfieldLiveGames` is a fresh array roughly every two minutes
// even when the battles are unchanged. The component therefore holds it in a ref
// and keeps it OUT of the mount effect's dependency array. Add it to those deps
// — which `react-hooks/exhaustive-deps` would happily accept — and the effect
// re-runs every poll: the star field is recreated (a visible teleport) and the
// warp state resets to RESTING, restarting the 15s ease. Since the endgame ramp
// needs minutes, THE SKY WOULD NEVER REACH PEAK, and CI would not notice,
// because `renderToString` runs no effects and schedules no frames.
//
// Precedent for the harness itself: CharacterArea.scrollreset.test.jsx — same
// jsdom docblock, createRoot + act, per-file mocks, NO setupFiles. That file
// existing is what falsified ruling S8's original premise (recorded in the
// Phase 1 report, accepted as R-T2-S12).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import StarfieldBackground from './StarfieldBackground';
import { toLiveGames } from './warpBattleAdapter';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- canvas + rAF instrumentation -------------------------------------------
// jsdom returns null from getContext (2D is unimplemented) and the `canvas`
// package is not a dependency, so the context is stubbed. Every call is counted
// so "did the field restart?" becomes an assertion rather than an impression.

// The stub models REAL cancellation semantics — cancelAnimationFrame actually
// dequeues the callback. A counter-only stub would let a cancelled frame still
// run on the next flush, which silently turns the unmount assertion into a
// tautology (it did, on the first run of this file).
let rafHandles;
let rafNextId;
let rafScheduled;
let rafCancelled;
let contextsHandedOut;

function makeContextStub() {
  contextsHandedOut += 1;
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalCompositeOperation: '',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
  };
}

/** Run n queued animation frames, oldest first. */
function flushFrames(n = 1) {
  for (let i = 0; i < n; i += 1) {
    const entry = rafHandles.entries().next();
    if (entry.done) return;
    const [id, cb] = entry.value;
    rafHandles.delete(id);
    cb(performance.now());
  }
}

/** Frames currently queued — one means exactly one loop is in flight. */
const pendingFrames = () => rafHandles.size;

let container;
let root;

beforeEach(() => {
  rafHandles = new Map();
  rafNextId = 0;
  rafScheduled = 0;
  rafCancelled = 0;
  contextsHandedOut = 0;

  vi.stubGlobal('requestAnimationFrame', (cb) => {
    rafNextId += 1;
    rafScheduled += 1;
    rafHandles.set(rafNextId, cb);
    return rafNextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => {
    rafCancelled += 1;
    rafHandles.delete(id);
  });

  HTMLCanvasElement.prototype.getContext = makeContextStub;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));
});

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

const mount = async (props) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<StarfieldBackground mode="desktop" seed={7} {...props} />);
  });
};

const rerender = async (props) => {
  await act(async () => {
    root.render(<StarfieldBackground mode="desktop" seed={7} {...props} />);
  });
};

/** A live doc, shaped as api/_utils/agentBattleService.js writes it. */
const doc = (id, msFromNow) => ({
  id,
  status: 'active',
  activatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + msFromNow).toISOString(),
});

describe('R-T2-S12 — a poll refresh must not restart the field', () => {
  it('schedules exactly one loop on mount', async () => {
    await mount({ liveGames: toLiveGames([doc('b1', 60 * 60 * 1000)]) });
    expect(rafScheduled).toBe(1);
  });

  it('does NOT re-run the mount effect when liveGames gets a new identity', async () => {
    const battles = [doc('b1', 60 * 60 * 1000)];
    await mount({ liveGames: toLiveGames(battles) });

    flushFrames(3);
    const scheduledAfterFrames = rafScheduled;
    const contextsAfterMount = contextsHandedOut;

    // Simulate 5 poll cycles: same battles, brand-new array identity each time,
    // exactly what App.jsx's useMemo produces when setActiveAgentBattles fires.
    for (let i = 0; i < 5; i += 1) {
      await rerender({ liveGames: toLiveGames(battles) });
    }

    // The effect must not have torn down and restarted: no extra cancel, and no
    // second scheduling burst beyond the frames we pumped ourselves.
    expect(rafCancelled, 'a re-run effect would cancel the in-flight loop').toBe(0);
    expect(rafScheduled).toBe(scheduledAfterFrames);
    expect(contextsHandedOut).toBe(contextsAfterMount);
  });

  it('keeps the SAME loop running across a poll refresh (still exactly one)', async () => {
    const battles = [doc('b1', 60 * 60 * 1000)];
    await mount({ liveGames: toLiveGames(battles) });

    for (let i = 0; i < 3; i += 1) {
      flushFrames(1);
      await rerender({ liveGames: toLiveGames(battles) });
    }

    // One frame in flight, never two loops racing.
    expect(pendingFrames()).toBe(1);
  });

  it('picks up NEW battle content through the ref, without a restart', async () => {
    await mount({ liveGames: toLiveGames([doc('b1', 5 * 60 * 60 * 1000)]) });
    flushFrames(2);
    const before = rafCancelled;

    // A second battle appears on the next poll — the loop must see it without
    // the effect re-running (that is the ref's whole job).
    await rerender({
      liveGames: toLiveGames([doc('b1', 5 * 60 * 60 * 1000), doc('b2', 60 * 1000)]),
    });
    flushFrames(2);

    expect(rafCancelled).toBe(before);
    expect(pendingFrames()).toBe(1);
  });

  it('cancels the loop and leaves nothing scheduled on unmount', async () => {
    await mount({ liveGames: toLiveGames([doc('b1', 60 * 60 * 1000)]) });
    flushFrames(2);

    await act(async () => root.unmount());
    root = null;

    expect(rafCancelled).toBeGreaterThan(0);
    const afterUnmount = rafScheduled;
    flushFrames(3); // any survivor would reschedule itself here
    expect(rafScheduled).toBe(afterUnmount);
  });

  it('never schedules a loop under prefers-reduced-motion', async () => {
    window.matchMedia = (q) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    });

    await mount({ liveGames: toLiveGames([doc('b1', 60 * 60 * 1000)]) });
    expect(rafScheduled).toBe(0);
    expect(contextsHandedOut).toBeGreaterThan(0); // ...but it DID draw one frame

    // ...and a poll refresh must not start one either.
    await rerender({ liveGames: toLiveGames([doc('b1', 60 * 60 * 1000)]) });
    expect(rafScheduled).toBe(0);
  });
});
