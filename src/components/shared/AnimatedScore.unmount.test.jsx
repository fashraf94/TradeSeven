// @vitest-environment jsdom
//
// src/components/shared/AnimatedScore.unmount.test.jsx
//
// F1 — the flash-clear timer must not outlive the component.
//
// THE DEFECT: the value-change branch ends the rAF ramp by arming
// `setTimeout(() => setFlash(null), 300)` (AnimatedScore.jsx:55 as it stood
// before the fix; :81 now). The handle was never captured and the effect returned no cleanup,
// so unmounting inside that 300 ms window left the callback armed on a dead
// component — a queued state update on unmounted state, and a retained closure
// over the component's scope until the clock caught up.
//
// WHY THE ROWS ARE SHAPED THIS WAY (the honest instrument):
//
//   React 19 makes a post-unmount setState a SILENT no-op. Measured in this
//   repo at react 19.2.4 / vitest 4.0.17: the armed callback runs, setFlash is
//   called on the unmounted component, and console.error, console.warn and
//   throw are ALL silent. So `expect(...).not.toThrow()` and a console.error
//   spy CANNOT fail under this defect — as guards they would be vacuous
//   (BUILD_RULES §2: "a row that cannot fail under the defect it names is not
//   a guard"). They are kept below only as forward-guards, and labelled as
//   such — never as the thing that catches this bug.
//
//   The two rows with teeth observe the timer itself:
//     1. nothing is left pending after unmount (vi.getTimerCount() === 0) —
//        the state update is then not merely harmless, it is IMPOSSIBLE;
//     2. the armed callback never executes — the direct reading of "no state
//        update after unmount".
//   Both fail on the unfixed component and pass on the fixed one.
//
//   Precedent for row 1's shape: useSessionCompositeTrail.test.jsx:224-230
//   ("clears its timer on unmount (no orphaned clock)").
//
// THE rAF RAMP — was §5A, NOW CLOSED (addendum). The effect originally never
// cancelled its requestAnimationFrame ramp, so unmounting MID-RAMP let the loop
// keep ticking on a dead component, reach p === 1, and arm a fresh flash-clear
// AFTER cleanup had already run. Cancelling the timer alone did NOT close the
// leak. Both channels are now torn down together (AnimatedScore.jsx:40-43), and
// the two ramp rows below cover it — one per loop, because the count-up and the
// value-change ramp schedule independently.
//
// Every rAF site assigns the ref, the in-loop re-schedules included. Capturing
// only where each loop is kicked off leaves the ref holding an already-fired id
// and makes the cancel a no-op from frame two — measured, not assumed: the
// two-site version reddens both ramp rows.
//
// REMAINING RESIDUAL, STILL NOT ASSERTED HERE (separately reported): because the
// cleanup is unmount-scoped, a flash-clear armed by one animation is NOT
// cancelled when a new value arrives inside its 300 ms window, so it fires
// partway through the new ramp and nulls that flash early — a visible flicker
// back to the resting colour while the number is still climbing. Demonstrated
// while building this file (pre-fix run: expected 'rgb(148, 163, 184)' to be
// 'rgb(94, 234, 212)'). Fixing it means cancelling on value change too, which
// re-opens the stranded-flash hazard described in AnimatedScore.jsx:36-39 and
// needs its own task. NOT pinned as a row here: asserting today's wrong colour
// would redden the moment someone fixes it.
//
// THE PRECONDITION ROWS ARE LOAD-BEARING. `getTimerCount() === 1` alone is
// ambiguous: a still-running rAF ramp also counts as 1 pending timer, which
// would let the post-unmount rows pass for the wrong reason (loop never
// reached the arming site, so no timeout was ever armed). So before unmounting we
// prove, from what the DOM actually shows, that the ramp finished (text is the
// target value) and that the flash window is still OPEN (the flash colour is
// still applied, i.e. setFlash(null) has NOT run yet). Only then is the single
// pending timer necessarily the flash-clear, and the unmount necessarily
// "inside the 300 ms window".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import AnimatedScore from './AnimatedScore.jsx';

const UP = '#5eead4';        // activeUp default (AnimatedScore.jsx:9)
const DEFAULT_COLOR = '#94a3b8';

// jsdom normalises style.color to rgb(). DERIVED from the hex above rather than
// written out a second time, so the expectation and the colour it stands for
// cannot drift apart (BUILD_RULES §9).
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const UP_RGB = rgb(UP);
const RESTING_RGB = rgb(DEFAULT_COLOR);
const MOUNT_RAMP_MS = 900;   // initial count-up duration (:26)
const CHANGE_RAMP_MS = 500;  // value-change ramp duration (:45)
const FLASH_HOLD_MS = 300;   // the window under test (:81)

let container;
let root;

/** Callbacks armed at exactly FLASH_HOLD_MS, and whether each has fired. */
let flashHold;
/** How many frames the component has scheduled. Frozen after unmount iff the
 *  ramp was cancelled — the direct observable for "the loop stopped". */
let rafCalls;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();

  // Instrument ONLY the 300 ms timeout — the component's flash-clear is the
  // sole timer at that delay. Installed after useFakeTimers(), so `scheduled`
  // is sinon's fake and the handle we hand back is the one the component's
  // clearTimeout can cancel. `ran` is the direct observable for row 2.
  flashHold = { armed: 0, ran: 0 };
  const scheduled = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...rest) => {
    if (ms !== FLASH_HOLD_MS) return scheduled(fn, ms, ...rest);
    flashHold.armed += 1;
    return scheduled((...a) => { flashHold.ran += 1; return fn(...a); }, ms, ...rest);
  });

  // Same trick for the ramp: count every frame the component schedules. Installed
  // after useFakeTimers(), so the id we hand back is sinon's and the component's
  // cancelAnimationFrame can actually cancel it.
  rafCalls = { scheduled: 0 };
  const nextFrame = globalThis.requestAnimationFrame;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCalls.scheduled += 1;
    return nextFrame(cb);
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container.remove();
  // restoreAllMocks BEFORE useRealTimers, deliberately. The spy's saved original
  // IS sinon's fake, so restoring it after uninstalling the clock would leave a
  // detached fake sitting on globalThis.setTimeout.
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const render = (value) =>
  act(() => root.render(<AnimatedScore value={value} defaultColor={DEFAULT_COLOR} />));
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const span = () => container.querySelector('span');

/**
 * Drive the component to the instant the flash-clear is armed and no further:
 * mount, drain the count-up ramp, change the value, drain the change ramp.
 * Leaves the clock INSIDE the 300 ms flash window.
 */
function armFlashClear() {
  render(10);
  advance(MOUNT_RAMP_MS + 100);      // count-up ramp completes; it arms no timeout
  expect(flashHold.armed, 'the mount path must arm no flash-clear').toBe(0);

  render(20);                        // value change -> flash + change ramp
  advance(CHANGE_RAMP_MS + 100);     // ramp reaches p === 1, arming the flash-clear
}

describe('AnimatedScore — flash-clear timer lifecycle (F1)', () => {
  it('arms the flash-clear once the value-change ramp completes', () => {
    armFlashClear();

    // Preconditions, read off the DOM rather than assumed:
    expect(span().textContent, 'ramp must have reached the target').toBe('+20');
    expect(span().style.color, 'flash window must still be OPEN').toBe(UP_RGB);
    expect(flashHold.armed, 'exactly one flash-clear armed').toBe(1);
    expect(flashHold.ran, 'and it must not have fired yet').toBe(0);
    expect(vi.getTimerCount(), 'ramp drained, so the 1 pending timer IS the flash-clear').toBe(1);

    // Sanity: left mounted, it does its job and clears the flash.
    advance(FLASH_HOLD_MS + 50);
    expect(flashHold.ran).toBe(1);
    expect(span().style.color).toBe(RESTING_RGB);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the flash-clear timer when unmounted inside the 300 ms window', () => {
    armFlashClear();
    expect(flashHold.armed, 'precondition: flash-clear armed').toBe(1);
    expect(vi.getTimerCount(), 'precondition: it is pending').toBe(1);
    expect(span().style.color, 'precondition: still inside the flash window').toBe(UP_RGB);

    act(() => root.unmount());
    root = null;

    // ROW 1 (fails pre-fix): nothing survives the unmount, so no post-unmount
    // state update is even reachable.
    expect(vi.getTimerCount(), 'unmount must leave no orphaned timer').toBe(0);

    // ROW 2 (fails pre-fix): the armed callback never executes — "no state
    // update after unmount", read directly.
    const drain = () => advance(FLASH_HOLD_MS * 4);
    expect(drain, 'draining the clock past the window must not throw').not.toThrow();
    expect(flashHold.ran, 'the flash-clear callback must never run after unmount').toBe(0);
  });

  it('cancels the ramp when unmounted MID-ramp, before any flash-clear is armed', () => {
    // §5A, now closed. Pre-fix this row was red: the rAF ramp was never
    // cancelled, so after unmount it kept ticking on a dead component, reached
    // p === 1, and armed a FRESH flash-clear *after* the unmount cleanup had
    // already run — which then fired. Three independent readings of that.
    render(10);
    advance(MOUNT_RAMP_MS + 100);      // drain the count-up
    render(20);                        // start the change ramp
    advance(100);                      // ~p 0.2 — mid-ramp, nothing armed yet

    expect(flashHold.armed, 'precondition: mid-ramp, so no flash-clear yet').toBe(0);
    expect(vi.getTimerCount(), 'precondition: a frame is pending').toBeGreaterThan(0);

    const framesAtUnmount = rafCalls.scheduled;
    act(() => root.unmount());
    root = null;

    expect(vi.getTimerCount(), 'unmount must leave no pending frame').toBe(0);

    advance(FLASH_HOLD_MS * 4);        // long past where the ramp would have ended

    expect(rafCalls.scheduled, 'the ramp must schedule no further frames').toBe(framesAtUnmount);
    expect(flashHold.armed, 'a dead ramp must not reach the arming site').toBe(0);
    expect(flashHold.ran, 'and nothing can therefore fire').toBe(0);
  });

  it('cancels the COUNT-UP ramp when unmounted during it', () => {
    // The mount path has its own loop, so it needs its own row: every rAF site
    // in the file must be cancellable, not just the value-change ones. This is
    // also the shape that bites in real suites — a test that freezes Date (e.g.
    // AgentBattleScreen.pane.jsdom.test.jsx: vi.useFakeTimers({ toFake:
    // ['Date'] }) with a pinned system time) holds `elapsed` at 0, so p never
    // reaches 1 and the count-up becomes an UNBOUNDED loop. Uncancelled, it
    // outlives the unmount with no owner.
    render(10);
    advance(200);                      // ~p 0.22 of the 900 ms count-up

    expect(vi.getTimerCount(), 'precondition: count-up still running').toBeGreaterThan(0);

    const framesAtUnmount = rafCalls.scheduled;
    act(() => root.unmount());
    root = null;

    expect(vi.getTimerCount(), 'unmount must leave no pending frame').toBe(0);

    advance(MOUNT_RAMP_MS * 2);        // long past where the count-up would have ended
    expect(rafCalls.scheduled, 'the count-up must schedule no further frames').toBe(framesAtUnmount);
  });

  it('FORWARD-GUARD ONLY — silent on React 19, kept for a future React that is not', () => {
    // Documented as executable prose: this row CANNOT fail under the F1 defect
    // on react 19.2.4 (measured: no throw, no console.error). It exists so that
    // a React version which starts erroring on post-unmount setState, or a
    // cleanup that itself throws, reddens here instead of in production.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    armFlashClear();
    act(() => root.unmount());
    root = null;
    advance(FLASH_HOLD_MS * 4);

    expect(errSpy, 'no React error logged across unmount + drain').not.toHaveBeenCalled();
  });
});
