// @vitest-environment jsdom
//
// src/hooks/useHoldToDeploy.r2.jsdom.test.jsx
//
// Command Center repair R2 — the hold claim, the atomic commitment and
// charging cancellation (spec V1.2 §5.5, §11.3 "Hold C4"), driven through the
// REAL HoldToDeployButton, the hook's only importer.
//
// Each defect row (D1–D7 in the R2 prompt §3) was run against the pre-R2 hook
// first and failed there; the parity rows pass on both. The record is in
// docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md §4. This file imports
// nothing R2 added, so it runs unchanged against either hook.
//
// Harness (precedent starfield.intent.test.jsx): createRoot + act, a hand-run
// animation-frame queue, performance.now on one controllable clock, fake
// setTimeout for the 450 ms beat. A "frame" runs every callback queued before
// it, as a browser frame does, so two charging controls both tick in it.
//
// NO SLOT RESET BETWEEN ROWS, on purpose: every row must leave the app-wide
// claim free (released, unmounted or settled), so a leaked claim fails the
// row after it rather than hiding.
//
// SAME-FRAME ORDERINGS. React handles a native event with the props of the
// last COMMITTED render. Two inputs dispatched inside one act() therefore land
// with no render between them — exactly the window the pre-R2 hook's
// render-derived phase could not see (D1, D3, D6).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
}));

import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';
import HoldToDeployButton from '../components/Dashboard/deployCeremony/HoldToDeployButton';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_800_000_000_000;

let frames;
let frameSeq;
let frameRequests;
let nowMs;
let seen;
let buzz;
let hidden;
let container;
let root;

const onIntent = (event) => seen.push(event.detail);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  frames = new Map();
  frameSeq = 0;
  frameRequests = 0;
  nowMs = T0;
  seen = [];
  buzz = [];
  hidden = false;
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    frameSeq += 1;
    frameRequests += 1;
    frames.set(frameSeq, cb);
    return frameSeq;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => { frames.delete(id); });
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true, writable: true, value: (ms) => { buzz.push(ms); return true; },
  });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => (hidden ? 'hidden' : 'visible'),
  });
  window.addEventListener(DEPLOY_INTENT_EVENT, onIntent);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(DEPLOY_INTENT_EVENT, onIntent);
  delete navigator.vibrate;
  delete document.hidden;
  delete document.visibilityState;
  delete Element.prototype.setPointerCapture;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- harness ----------------------------------------------------------------

const render = (ui) => act(() => { root.render(ui); });
const Hold = (props) => <HoldToDeployButton accent="#5EEAD4" label="Deploy" onComplete={() => {}} {...props} />;
const buttons = () => [...container.querySelectorAll('button')];
const fill = (b) => b.querySelector('span[aria-hidden]');

/** Native inputs. None wraps itself in act, so two can share one frame. */
const ev = {
  down: (b, init) => b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, ...init })),
  up: (b) => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
  // React synthesizes onPointerLeave from pointerout (EnterLeaveEventPlugin).
  leave: (b) => b.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })),
  cancel: (b) => b.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })),
  lost: (b) => b.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true })),
  blur: () => window.dispatchEvent(new Event('blur')),
  hide: () => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); },
  show: () => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); },
  key: (b, init) => b.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', ...init })),
  keyUp: (b) => b.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' })),
};

/** Set the clock to T0 + ms and run one frame: every callback queued before it. */
function frameAt(ms) {
  nowMs = T0 + ms;
  const due = [...frames.entries()];
  frames.clear();
  for (const [, cb] of due) cb(nowMs);
  return due.length;
}
const step = (ms) => act(() => { frameAt(ms); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

const kinds = () => seen.map((d) => (d.progress === null ? d.reason : 'progress'));
const count = (kind) => kinds().filter((k) => k === kind).length;

/** Press and hold `b` to its 1300 ms threshold, one rendered frame at a time. */
function holdToCommit(b) {
  act(() => { ev.down(b); });
  step(200); step(600); step(1000); step(1300);
}

// ===========================================================================
// Parity — single-hold behaviour is today's (passes on the pre-R2 hook too)
// ===========================================================================

describe('parity — one ordinary hold, an early release and a key behave exactly as today', () => {
  it('an ordinary hold: the same progress frames, one commit, both haptics, one onComplete at 1300 + 450 ms', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(200); step(600); step(1000);
    expect(b.textContent).toBe('Deploy');
    step(1300);
    expect(seen).toEqual([
      { progress: 200 / 1300 }, { progress: 600 / 1300 }, { progress: 1000 / 1300 },
      { progress: 1 }, { progress: null, reason: 'commit' },
    ]);
    expect(b.textContent).toBe('Locked in');
    expect(fill(b).style.width).toBe('100%');
    expect(buzz).toEqual([12, 12, 12, 60, 60]); // the ladder's last rung, then the lock
    expect(frames.size).toBe(0);
    advance(449);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // An ordinary release after the lock changes nothing.
    act(() => { ev.up(b); });
    expect(b.textContent).toBe('Locked in');
    expect(count('abort')).toBe(0);
  });

  it('an early release: one abort, the fill drains, nothing deploys', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(200); step(600);
    act(() => { ev.up(b); });
    expect(kinds()).toEqual(['progress', 'progress', 'abort']);
    expect(seen.at(-1)).toEqual({ progress: null, reason: 'abort' });
    expect(b.textContent).toBe('Deploy');
    expect(fill(b).style.width).toBe('0%');
    expect(frames.size).toBe(0);
    act(() => { ev.up(b); ev.leave(b); }); // the release's trailing events
    expect(count('abort')).toBe(1);
    advance(5000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  for (const key of ['Enter', ' ']) {
    it(`${key === ' ' ? 'Space' : key}: an immediate lock, one commit with no progress stream, one onComplete after 450 ms`, () => {
      const onComplete = vi.fn();
      render(<Hold onComplete={onComplete} />);
      const [b] = buttons();
      act(() => { ev.key(b, { key }); });
      expect(b.textContent).toBe('Locked in');
      expect(fill(b).style.width).toBe('100%');
      expect(seen).toEqual([{ progress: null, reason: 'commit' }]);
      expect(frameRequests).toBe(0);
      expect(buzz).toEqual([60]);
      advance(449);
      expect(onComplete).not.toHaveBeenCalled();
      advance(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  }

  it('a key release does not cancel a keyboard deploy (no held-key requirement)', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.key(b); });
    act(() => { ev.keyUp(b); });
    expect(b.textContent).toBe('Locked in');
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('with motion allowed the fill still snaps while charging and drains over 250 ms after', () => {
    render(<Hold />);
    const [b] = buttons();
    expect(fill(b).style.transition).toBe('width 250ms ease');
    act(() => { ev.down(b); });
    step(600);
    expect(fill(b).style.transition).toBe('none');
    act(() => { ev.up(b); });
    expect(fill(b).style.transition).toBe('width 250ms ease');
  });

  it('a mid-charge unmount closes the stream with one abort', () => {
    render(<Hold />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(600);
    render(<div />);
    expect(seen.at(-1)).toEqual({ progress: null, reason: 'abort' });
    expect(count('abort')).toBe(1);
  });
});

// ===========================================================================
// D1 — commitment and a release processed in the same frame
// ===========================================================================

describe('D1 — the threshold frame and a release in one frame: event order decides', () => {
  for (const [name, fire] of [['pointerup', ev.up], ['pointerleave', ev.leave], ['pointercancel', ev.cancel], ['lostpointercapture', ev.lost]]) {
    it(`commitment first, then ${name} before a render: Locked in is kept, one commit, no abort, one deploy`, () => {
      const onComplete = vi.fn();
      render(<Hold onComplete={onComplete} />);
      const [b] = buttons();
      act(() => { ev.down(b); });
      step(200); step(600); step(1000);
      act(() => { frameAt(1300); fire(b); });
      expect(b.textContent).toBe('Locked in');
      expect(fill(b).style.width).toBe('100%');
      expect(count('commit')).toBe(1);
      expect(count('abort')).toBe(0);
      advance(450);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  }

  it('cancellation first, then the threshold frame: zero deploys and exactly one abort', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(200); step(600); step(1000);
    act(() => { ev.up(b); frameAt(1300); });
    expect(count('commit')).toBe(0);
    expect(count('abort')).toBe(1);
    expect(b.textContent).toBe('Deploy');
    advance(2000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// D2 — two holds on two controls
// ===========================================================================

describe('D2 — one hold at a time, app-wide', () => {
  const two = (a, b) => (
    <>
      <Hold label="A" onComplete={a} />
      <Hold label="B" onComplete={b} />
    </>
  );

  it('a second control pressed while the first charges is denied with zero effects; only the first deploys', () => {
    const a = vi.fn();
    const bFn = vi.fn();
    render(two(a, bFn));
    const [ba, bb] = buttons();
    act(() => { ev.down(ba); });
    step(200);
    const before = { frames: frameRequests, events: seen.length, buzz: buzz.length, timers: vi.getTimerCount() };
    act(() => { ev.down(bb); });
    expect(frameRequests).toBe(before.frames);   // no rAF
    expect(seen.length).toBe(before.events);     // no sky event
    expect(buzz.length).toBe(before.buzz);       // no haptic
    expect(vi.getTimerCount()).toBe(before.timers); // no timer
    for (const ms of [600, 1000]) {
      const eventsBefore = seen.length;
      step(ms);
      expect(seen.length - eventsBefore, `one progress event per frame at ${ms}`).toBe(1);
    }
    step(1300);
    expect(count('commit')).toBe(1);
    expect(buzz).toEqual([12, 12, 12, 60, 60]);
    expect(ba.textContent).toBe('Locked in');
    expect(bb.textContent).toBe('B');
    expect(fill(bb).style.width).toBe('0%');
    advance(450);
    expect(a).toHaveBeenCalledTimes(1);
    expect(bFn).not.toHaveBeenCalled();
  });

  it('both pressed in the same tick: the first claims, the second is denied', () => {
    const a = vi.fn();
    const bFn = vi.fn();
    render(two(a, bFn));
    const [ba, bb] = buttons();
    act(() => { ev.down(ba); ev.down(bb); });
    expect(frameRequests).toBe(1);
    step(600); step(1300);
    expect(count('commit')).toBe(1);
    advance(450);
    expect(a).toHaveBeenCalledTimes(1);
    expect(bFn).not.toHaveBeenCalled();
  });

  it('Enter on a second control while the first charges is denied', () => {
    const a = vi.fn();
    const bFn = vi.fn();
    render(two(a, bFn));
    const [ba, bb] = buttons();
    act(() => { ev.down(ba); });
    step(600);
    act(() => { ev.key(bb); });
    expect(bb.textContent).toBe('B');
    expect(count('commit')).toBe(0);
    step(1300);
    advance(450);
    expect(a).toHaveBeenCalledTimes(1);
    expect(bFn).not.toHaveBeenCalled();
  });

  it('unmounting the denied control emits no abort and leaves the owner charging', () => {
    const a = vi.fn();
    render(two(a, vi.fn()));
    const [ba, bb] = buttons();
    act(() => { ev.down(ba); });
    step(200);
    act(() => { ev.down(bb); });
    step(600);
    render(<Hold label="A" onComplete={a} />);
    expect(count('abort')).toBe(0);
    step(1000); step(1300);
    expect(count('commit')).toBe(1);
    advance(450);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('after the first hold is released, a second control can claim', () => {
    render(two(vi.fn(), vi.fn()));
    const [ba, bb] = buttons();
    act(() => { ev.down(ba); });
    step(600);
    act(() => { ev.up(ba); });
    const before = frameRequests;
    act(() => { ev.down(bb); });
    expect(frameRequests).toBe(before + 1);
  });
});

// ===========================================================================
// D3 — two inputs on one control
// ===========================================================================

describe('D3 — one control, two inputs: only one starts', () => {
  it('two pointers down on one control in the same tick start one charge', () => {
    render(<Hold />);
    const [b] = buttons();
    act(() => { ev.down(b, { pointerId: 1 }); ev.down(b, { pointerId: 2 }); });
    expect(frameRequests).toBe(1);
  });

  it('a pointer charging, then Enter in the same tick: the key is denied and the hold commits once at its threshold', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); ev.key(b); });
    expect(b.textContent).toBe('Deploy');
    expect(count('commit')).toBe(0);
    step(600); step(1000); step(1300);
    expect(count('commit')).toBe(1);
    expect(kinds().at(-1)).toBe('commit'); // no progress after the commit
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Enter first, then a pointer in the same tick: the pointer is denied', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.key(b); ev.down(b); });
    expect(frameRequests).toBe(0);
    expect(seen).toEqual([{ progress: null, reason: 'commit' }]);
    expect(b.textContent).toBe('Locked in');
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('pointer down captures the pointer on the button when the platform supports it', () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, writable: true, value: capture });
    render(<Hold />);
    const [b] = buttons();
    act(() => { ev.down(b, { pointerId: 7 }); });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(7);
    expect(capture.mock.contexts[0]).toBe(b);
  });

  it('a denied pointer is never captured', () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, writable: true, value: capture });
    render(<><Hold label="A" /><Hold label="B" /></>);
    const [ba, bb] = buttons();
    act(() => { ev.down(ba, { pointerId: 7 }); });
    act(() => { ev.down(bb, { pointerId: 9 }); });
    expect(capture.mock.calls).toEqual([[7]]);
  });

  it('a capture the platform refuses does not break the hold', () => {
    const onComplete = vi.fn();
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true, writable: true, value: () => { throw new DOMException('no such pointer', 'NotFoundError'); },
    });
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    holdToCommit(b);
    expect(count('commit')).toBe(1);
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// D4 — a hidden tab cannot commit
// ===========================================================================

describe('D4 — switching away mid-hold cannot deploy on return', () => {
  it('going hidden mid-hold cancels with one abort; returning and waiting deploys nothing', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(600);
    act(() => { ev.hide(); });
    expect(count('abort')).toBe(1);
    expect(b.textContent).toBe('Deploy');
    act(() => { ev.show(); });
    step(5000); // the first frame back, long past the threshold
    advance(1000);
    expect(count('commit')).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('a frame that runs while hidden cancels instead of committing, even with no visibilitychange', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(600);
    hidden = true;
    step(5000);
    expect(count('commit')).toBe(0);
    expect(count('abort')).toBe(1);
    hidden = false;
    step(6000);
    advance(1000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// D5 — blur and lost capture cancel a charge
// ===========================================================================

describe('D5 — window blur and lost pointer capture cancel a charge', () => {
  for (const [name, fire] of [['window blur', () => ev.blur()], ['lost pointer capture', (b) => ev.lost(b)]]) {
    it(`${name} mid-hold: one abort, the display drains, no deploy`, () => {
      const onComplete = vi.fn();
      render(<Hold onComplete={onComplete} />);
      const [b] = buttons();
      act(() => { ev.down(b); });
      step(600);
      act(() => { fire(b); });
      expect(count('abort')).toBe(1);
      expect(b.textContent).toBe('Deploy');
      expect(fill(b).style.width).toBe('0%');
      expect(frames.size).toBe(0);
      step(2000);
      advance(1000);
      expect(onComplete).not.toHaveBeenCalled();
    });
  }

  it('a capture hand-over from the touched label to the button is not a loss: the hold carries on and deploys once', () => {
    // On touch the pointer is implicitly captured by the element touched, and
    // the button's own setPointerCapture moves it. Chromium never fires the
    // label's lostpointercapture for that (measured in headless Edge); an
    // engine that did would bubble it to the button, which must not cancel.
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    const labelSpan = [...b.querySelectorAll('span')].find((s) => s.textContent === 'Deploy');
    act(() => { labelSpan.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3 })); });
    act(() => { labelSpan.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 3 })); });
    expect(count('abort')).toBe(0);
    step(600); step(1300);
    expect(count('commit')).toBe(1);
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('the blur and visibility listeners are attached only while charging and removed on every exit', () => {
    render(<Hold />);
    const [b] = buttons();
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');
    const live = () => ({
      blur: winAdd.mock.calls.filter(([t]) => t === 'blur').length - winRemove.mock.calls.filter(([t]) => t === 'blur').length,
      visibility: docAdd.mock.calls.filter(([t]) => t === 'visibilitychange').length
        - docRemove.mock.calls.filter(([t]) => t === 'visibilitychange').length,
    });
    expect(live()).toEqual({ blur: 0, visibility: 0 });
    // exit 1: release
    act(() => { ev.down(b); });
    expect(live()).toEqual({ blur: 1, visibility: 1 });
    act(() => { ev.up(b); });
    expect(live()).toEqual({ blur: 0, visibility: 0 });
    // exit 2: commitment
    holdToCommit(b);
    expect(live()).toEqual({ blur: 0, visibility: 0 });
    // the same listener is removed that was added
    const added = winAdd.mock.calls.filter(([t]) => t === 'blur').map(([, fn]) => fn);
    const removed = winRemove.mock.calls.filter(([t]) => t === 'blur').map(([, fn]) => fn);
    expect(removed).toEqual(added);
  });

  it('the listeners are removed when the control unmounts mid-charge', () => {
    render(<Hold />);
    const [b] = buttons();
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');
    act(() => { ev.down(b); });
    render(<div />);
    const added = winAdd.mock.calls.filter(([t]) => t === 'blur').length;
    const removed = winRemove.mock.calls.filter(([t]) => t === 'blur').length;
    expect(added).toBe(1);
    expect(removed).toBe(1);
  });
});

// ===========================================================================
// D6 — repeated keydown
// ===========================================================================

describe('D6 — repeated keydown fires one deploy', () => {
  it('a keydown and its auto-repeat before a render: one commit, one haptic, one deploy', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.key(b); ev.key(b, { repeat: true }); });
    expect(count('commit')).toBe(1);
    expect(buzz).toEqual([60]);
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('two plain keydowns before a render are still one deploy', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.key(b); ev.key(b, { key: ' ' }); });
    expect(count('commit')).toBe(1);
    expect(buzz).toEqual([60]);
    advance(450);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('an auto-repeat keydown on its own never deploys (a key held as focus arrives)', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.key(b, { repeat: true }); });
    expect(seen).toEqual([]);
    expect(b.textContent).toBe('Deploy');
    advance(1000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// After the commitment boundary nothing cancels (R-R2-5)
// ===========================================================================

describe('after commitment, release, leave, cancel, capture loss, blur and hidden do nothing', () => {
  const exits = [
    ['pointerup', ev.up], ['pointerleave', ev.leave], ['pointercancel', ev.cancel],
    ['lostpointercapture', ev.lost], ['window blur', () => ev.blur()], ['hidden tab', () => ev.hide()],
  ];
  for (const [name, fire] of exits) {
    it(`${name} after the lock: Locked in stays, no abort, one deploy`, () => {
      const onComplete = vi.fn();
      render(<Hold onComplete={onComplete} />);
      const [b] = buttons();
      holdToCommit(b);
      act(() => { fire(b); });
      expect(b.textContent).toBe('Locked in');
      expect(count('abort')).toBe(0);
      expect(count('commit')).toBe(1);
      advance(450);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  }
});

// ===========================================================================
// A control that stops being live mid-charge cancels (R-R2-4)
// ===========================================================================

describe('disabled or disabled-by-enabled mid-charge cancels', () => {
  it('disabled → true mid-charge: one abort, no deploy, and the claim is free for another control', () => {
    const onComplete = vi.fn();
    render(<Hold key="a" onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(600);
    render(<Hold key="a" onComplete={onComplete} disabled />);
    expect(count('abort')).toBe(1);
    expect(frames.size).toBe(0);
    advance(2000);
    expect(onComplete).not.toHaveBeenCalled();
    render(<><Hold key="a" onComplete={onComplete} disabled /><Hold key="b" label="B" /></>);
    const before = frameRequests;
    act(() => { ev.down(buttons()[1]); });
    expect(frameRequests).toBe(before + 1);
  });

  it('enabled → false mid-charge: one abort, no deploy', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    act(() => { ev.down(b); });
    step(600);
    render(<Hold onComplete={onComplete} enabled={false} />);
    expect(count('abort')).toBe(1);
    step(2000);
    advance(2000);
    expect(count('commit')).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// The claim is held through the deploy request (R-R2-7)
// ===========================================================================

describe('the claim lasts through the beat and the deploy request', () => {
  it('a second control is denied during the 450 ms beat', () => {
    render(<><Hold label="A" /><Hold label="B" /></>);
    const [ba, bb] = buttons();
    holdToCommit(ba);
    const before = frameRequests;
    act(() => { ev.down(bb); });
    expect(frameRequests).toBe(before);
    expect(bb.textContent).toBe('B');
  });

  it('a second control is denied while the first deploy is in flight, and can claim once it settles', async () => {
    let settle;
    const inFlight = new Promise((resolve) => { settle = resolve; });
    const a = vi.fn(() => inFlight);
    render(<><Hold label="A" onComplete={a} /><Hold label="B" /></>);
    const [ba, bb] = buttons();
    holdToCommit(ba);
    advance(450);
    expect(a).toHaveBeenCalledTimes(1);
    let before = frameRequests;
    act(() => { ev.down(bb); });
    expect(frameRequests, 'denied while the deploy is in flight').toBe(before);
    await act(async () => { settle({ success: true }); });
    before = frameRequests;
    act(() => { ev.down(bb); });
    expect(frameRequests, 'free once it settles').toBe(before + 1);
  });

  it('unmounting the first control mid-deploy does not free the slot early', async () => {
    let settle;
    const inFlight = new Promise((resolve) => { settle = resolve; });
    render(<Hold key="a" label="A" onComplete={() => inFlight} />);
    holdToCommit(buttons()[0]);
    advance(450);
    render(<Hold key="b" label="B" />); // A unmounts, as the post-deploy settle unmounts it
    let before = frameRequests;
    act(() => { ev.down(buttons()[0]); });
    expect(frameRequests).toBe(before);
    await act(async () => { settle({ success: true }); });
    before = frameRequests;
    act(() => { ev.down(buttons()[0]); });
    expect(frameRequests).toBe(before + 1);
  });

  it('a deploy handler that throws synchronously still frees the claim', () => {
    render(<><Hold label="A" onComplete={() => { throw new Error('boom'); }} /><Hold label="B" /></>);
    const [ba, bb] = buttons();
    holdToCommit(ba);
    expect(() => advance(450)).toThrow('boom');
    const before = frameRequests;
    act(() => { ev.down(bb); });
    expect(frameRequests).toBe(before + 1);
  });

  it('legacy beat: unmounting during the 450 ms cancels the deploy, as today, and frees the claim', () => {
    const a = vi.fn();
    render(<Hold key="a" label="A" onComplete={a} />);
    holdToCommit(buttons()[0]);
    render(<Hold key="b" label="B" />);
    advance(450);
    expect(a).not.toHaveBeenCalled();
    const before = frameRequests;
    act(() => { ev.down(buttons()[0]); });
    expect(frameRequests).toBe(before + 1);
  });
});

// ===========================================================================
// The re-enable reset
// ===========================================================================

describe('the re-enable reset returns the display to idle — never while a committed beat is pending', () => {
  it('after a deploy cycle, a re-enabled control is idle and can hold again', async () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    holdToCommit(b);
    // Async: the claim is released when onComplete's result settles, a microtask.
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    render(<Hold onComplete={onComplete} disabled />); // the shell's deploying flag
    render(<Hold onComplete={onComplete} />);
    expect(b.textContent).toBe('Deploy');
    expect(fill(b).style.width).toBe('0%');
    const before = frameRequests;
    act(() => { ev.down(b); });
    expect(frameRequests).toBe(before + 1);
  });

  it('a disabled blip during the beat keeps Locked in, and the deploy still completes once', () => {
    const onComplete = vi.fn();
    render(<Hold onComplete={onComplete} />);
    const [b] = buttons();
    holdToCommit(b);
    advance(100);
    render(<Hold onComplete={onComplete} disabled />);
    render(<Hold onComplete={onComplete} />);
    expect(b.textContent).toBe('Locked in');
    advance(350);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
