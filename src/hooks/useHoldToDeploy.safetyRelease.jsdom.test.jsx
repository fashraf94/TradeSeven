// @vitest-environment jsdom
//
// src/hooks/useHoldToDeploy.safetyRelease.jsdom.test.jsx
//
// Founder ruling on R2 Q3 — the bounded safety release. When the beat's run
// calls onComplete, the hook arms HOLD_CLAIM_SAFETY_RELEASE_MS (180,000 ms)
// that releases the claim BY TOKEN. The settle clears it and releases as
// before; a throwing onComplete releases at once; an unmount does not clear it
// (a shell remounted mid-request is the case it exists for). Being
// token-scoped it can never free a newer hold. Record:
// docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md §14.
//
// The times below are written as literals on purpose, so a changed constant
// fails a row rather than moving with it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
}));

import useHoldToDeploy, { HOLD_CLAIM_SAFETY_RELEASE_MS } from './useHoldToDeploy';
import { currentHold, releaseHold, __resetHoldClaim } from './holdClaim';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_800_000_000_000;
let frames;
let nowMs;
let container;
let root;

beforeEach(() => {
  __resetHoldClaim();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  frames = new Map();
  nowMs = T0;
  let seq = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { seq += 1; frames.set(seq, cb); return seq; });
  vi.stubGlobal('cancelAnimationFrame', (id) => { frames.delete(id); });
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function H(props) {
  const { phase, bind } = useHoldToDeploy({ enabled: true, controlId: 'c1', ...props });
  return <button type="button" data-phase={phase} {...bind}>hold</button>;
}
const render = (ui) => act(() => { root.render(ui); });
const btn = (i = 0) => container.querySelectorAll('button')[i];
const press = (b) => b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
const key = (b) => b.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
function frameAt(ms) {
  nowMs = T0 + ms;
  const due = [...frames.entries()];
  frames.clear();
  for (const [, cb] of due) cb(nowMs);
}
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const never = () => new Promise(() => {});
function deferred() {
  let settle;
  const promise = new Promise((resolve) => { settle = resolve; });
  return { promise, settle };
}
/** Pointer hold to its threshold, then the 450 ms beat: onComplete has run. */
function holdThroughBeat(b) {
  act(() => { press(b); });
  act(() => { frameAt(600); });
  act(() => { frameAt(1300); });
  advance(450);
}

describe('the bounded safety release (founder ruling on Q3)', () => {
  it('is 180,000 ms', () => {
    expect(HOLD_CLAIM_SAFETY_RELEASE_MS).toBe(180_000);
  });

  it('a never-settling deploy holds the claim at 179,999 ms after onComplete ran and frees it at 180,000; a second control can then claim and deploy', () => {
    const a = vi.fn(never);
    const b = vi.fn();
    render(<><H key="a" controlId="a" onComplete={a} /><H key="b" controlId="b" onComplete={b} /></>);
    holdThroughBeat(btn(0));
    expect(a).toHaveBeenCalledTimes(1);
    const held = currentHold();
    expect(held).toMatchObject({ controlId: 'a', phase: 'locked' });
    advance(179_999);
    expect(currentHold()).toEqual(held);
    act(() => { key(btn(1)); });
    expect(currentHold()).toEqual(held); // still denied one millisecond before the bound
    advance(1);
    expect(currentHold()).toBeNull();
    act(() => { key(btn(1)); });
    expect(currentHold()).toMatchObject({ controlId: 'b', phase: 'locked' });
    advance(450);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('an unmount after onComplete started does not cancel it: the remounted shell can deploy at the bound', () => {
    const a = vi.fn(never);
    const b = vi.fn();
    render(<H key="a" controlId="a" onComplete={a} />);
    holdThroughBeat(btn());
    render(<H key="b" controlId="b" onComplete={b} />); // a unmounts, as on a shell swap
    expect(currentHold()).toMatchObject({ controlId: 'a', phase: 'locked' });
    advance(179_999);
    expect(currentHold()).toMatchObject({ controlId: 'a' });
    advance(1);
    expect(currentHold()).toBeNull();
    act(() => { key(btn()); });
    advance(450);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('an early settle clears it, and a newer hold claimed afterward survives the 180 s mark', async () => {
    const first = deferred();
    const b = vi.fn(never);
    render(<><H key="a" controlId="a" onComplete={() => first.promise} /><H key="b" controlId="b" onComplete={b} /></>);
    holdThroughBeat(btn(0));
    expect(vi.getTimerCount()).toBe(1); // the safety release
    await act(async () => { first.settle({ success: true }); });
    expect(vi.getTimerCount()).toBe(0);
    expect(currentHold()).toBeNull();
    advance(10_000);
    act(() => { key(btn(1)); });
    advance(450); // b's onComplete runs; b's own safety release is armed
    const newer = currentHold();
    expect(newer).toMatchObject({ controlId: 'b', phase: 'locked' });
    advance(180_000 - 10_450 + 1); // past a's 180 s mark, short of b's
    expect(currentHold()).toEqual(newer);
  });

  it('a first request that settles after its safety release does not free the newer hold', async () => {
    const first = deferred();
    const b = vi.fn(never);
    render(<><H key="a" controlId="a" onComplete={() => first.promise} /><H key="b" controlId="b" onComplete={b} /></>);
    holdThroughBeat(btn(0));
    advance(180_000);
    expect(currentHold()).toBeNull();
    act(() => { key(btn(1)); });
    advance(450);
    const newer = currentHold();
    expect(newer).toMatchObject({ controlId: 'b', phase: 'locked' });
    await act(async () => { first.settle({ success: true }); });
    expect(currentHold()).toEqual(newer);
  });

  it('being token-scoped, it never frees a hold claimed after its own was revoked', () => {
    const b = vi.fn(never);
    render(<><H key="a" controlId="a" onComplete={never} /><H key="b" controlId="b" onComplete={b} /></>);
    holdThroughBeat(btn(0));
    releaseHold(currentHold().holdToken); // e.g. S2b's provider revoking mid-request
    act(() => { key(btn(1)); });
    advance(450);
    const newer = currentHold();
    expect(newer).toMatchObject({ controlId: 'b' });
    advance(179_550); // a's 180 s mark (450 ms already elapsed since a's onComplete)
    expect(currentHold()).toEqual(newer);
  });

  // Rows from the rulings review (lens F1, F1-1 and F1-2).
  const toThreshold = (b) => {
    act(() => { press(b); });
    act(() => { frameAt(600); });
    act(() => { frameAt(1300); });
  };

  it('an owned beat run synchronously by its owner gets the safety release too', () => {
    const a = vi.fn(never);
    render(<H controlId="a" onComplete={a} beatOwner={{ commit: (token, run) => { run(); } }} />);
    toThreshold(btn());
    expect(a).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    advance(179_999);
    expect(currentHold()).toMatchObject({ controlId: 'a' });
    advance(1);
    expect(currentHold()).toBeNull();
  });

  it('an owned beat run after the control unmounted: the unmount frees nothing, the bound counts from the run', () => {
    const a = vi.fn(never);
    let run;
    render(<H key="a" controlId="a" onComplete={a} beatOwner={{ commit: (token, r) => { run = r; } }} />);
    toThreshold(btn());
    render(<div />);
    expect(currentHold()).toMatchObject({ controlId: 'a', phase: 'locked' });
    advance(5_000);
    act(() => { run(); });
    expect(a).toHaveBeenCalledTimes(1);
    advance(179_999);
    expect(currentHold()).toMatchObject({ controlId: 'a' });
    advance(1);
    expect(currentHold()).toBeNull();
  });

  it('an owner that runs the beat and then throws: a later unmount does not free the in-flight claim (F1-1)', () => {
    const a = vi.fn(never);
    const owner = { commit: (token, run) => { run(); throw new Error('owner'); } };
    render(<H key="a" controlId="a" onComplete={a} beatOwner={owner} />);
    act(() => { press(btn()); });
    act(() => { frameAt(600); });
    expect(() => act(() => { frameAt(1300); })).toThrow('owner');
    expect(a).toHaveBeenCalledTimes(1);
    advance(10_000);
    render(<div />); // unmount 10 s into the request (BI-1: must not release)
    expect(currentHold()).toMatchObject({ controlId: 'a', phase: 'locked' });
    advance(170_000); // the safety release is the bound
    expect(currentHold()).toBeNull();
  });

  it('…nor can that owner\'s commit lose a LATER committed deploy on the same control (F1-1, refuter RF1)', async () => {
    const first = deferred();
    const syncThenThrow = { commit: (token, run) => { run(); throw new Error('owner'); } };
    render(<H key="a" controlId="a" onComplete={() => first.promise} beatOwner={syncThenThrow} />);
    act(() => { press(btn()); });
    act(() => { frameAt(600); });
    expect(() => act(() => { frameAt(1300); })).toThrow('owner');
    advance(1_000);
    await act(async () => { first.settle({ success: true }); });
    expect(currentHold()).toBeNull();
    render(<H key="a" controlId="a" onComplete={() => first.promise} beatOwner={syncThenThrow} disabled />);
    const handed = [];
    const second = vi.fn(never);
    render(<H key="a" controlId="a" onComplete={second} beatOwner={{ commit: (token, run) => { handed.push(run); } }} />);
    expect(btn().dataset.phase).toBe('idle');
    act(() => { key(btn()); });
    expect(currentHold()).toMatchObject({ controlId: 'a', phase: 'locked' });
    render(<div />); // an owned beat survives unmount
    expect(currentHold()).toMatchObject({ controlId: 'a', phase: 'locked' });
    act(() => { handed[0](); });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a beat revoked before it runs arms no safety release', () => {
    const a = vi.fn(never);
    render(<H controlId="a" onComplete={a} />);
    toThreshold(btn());
    releaseHold(currentHold().holdToken);
    advance(450);
    expect(a).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a synchronously throwing onComplete releases at once and leaves no safety timer behind', () => {
    render(<H onComplete={() => { throw new Error('boom'); }} />);
    act(() => { press(btn()); });
    act(() => { frameAt(600); });
    act(() => { frameAt(1300); });
    expect(() => advance(450)).toThrow('boom');
    expect(currentHold()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
