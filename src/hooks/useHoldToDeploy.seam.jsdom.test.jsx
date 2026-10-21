// @vitest-environment jsdom
//
// src/hooks/useHoldToDeploy.seam.jsdom.test.jsx
//
// Command Center repair R2, ruling R-R2-8 — the seam S2b's provider builds on:
// onCommit(token), called synchronously at the commitment boundary, and
// beatOwner ({ commit(token, run) }), which takes the committed beat from the
// hook. HoldToDeployButton passes neither (its props are unchanged), so these
// rows drive the hook directly. Also here: the slot as currentHold() reads it
// through a real gesture, and a claim revoked from outside the hook.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
}));

import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';
import useHoldToDeploy from './useHoldToDeploy';
import { currentHold, releaseHold, __resetHoldClaim } from './holdClaim';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_800_000_000_000;
let frames;
let nowMs;
let seen;
let container;
let root;

const onIntent = (event) => seen.push(event.detail);

beforeEach(() => {
  __resetHoldClaim();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  frames = [];
  nowMs = T0;
  seen = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  window.addEventListener(DEPLOY_INTENT_EVENT, onIntent);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(DEPLOY_INTENT_EVENT, onIntent);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Props spread OVER the defaults, so an explicit controlId={undefined} reaches the hook.
function Harness(props) {
  const { phase, bind } = useHoldToDeploy({ enabled: true, controlId: 'c1', ...props });
  return <button type="button" data-phase={phase} {...bind}>hold</button>;
}

const render = (ui) => act(() => { root.render(ui); });
const button = () => container.querySelector('button');
const fire = (type) => button().dispatchEvent(new Event(type, { bubbles: true }));
const key = () => button().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
const step = (ms) => act(() => {
  nowMs = T0 + ms;
  const due = frames;
  frames = [];
  for (const cb of due) cb(nowMs);
});
const holdToCommit = () => { act(() => { fire('pointerdown'); }); step(600); step(1300); };
const reasons = () => seen.filter((d) => d.progress === null).map((d) => d.reason);

describe('currentHold() through a real gesture', () => {
  it('charging on press, empty on release; locked at the threshold, empty once onComplete settles', async () => {
    render(<Harness onComplete={() => {}} />);
    expect(currentHold()).toBeNull();
    act(() => { fire('pointerdown'); });
    expect(currentHold()).toMatchObject({ controlId: 'c1', phase: 'charging' });
    act(() => { fire('pointerup'); });
    expect(currentHold()).toBeNull();
    holdToCommit();
    expect(currentHold()).toMatchObject({ controlId: 'c1', phase: 'locked' });
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(currentHold()).toBeNull();
  });

  for (const controlId of [undefined, null, '']) {
    it(`a control with no controlId (${JSON.stringify(controlId) ?? 'undefined'}) claims nothing: no charge, no key deploy (fails closed)`, () => {
      const onComplete = vi.fn();
      render(<Harness controlId={controlId} onComplete={onComplete} />);
      act(() => { fire('pointerdown'); });
      expect(frames).toHaveLength(0);
      act(() => { key(); });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(seen).toEqual([]);
      expect(button().dataset.phase).toBe('idle');
      expect(onComplete).not.toHaveBeenCalled();
      expect(currentHold()).toBeNull();
    });
  }
});

describe('onCommit(token) — once, synchronously, at the commitment boundary', () => {
  it('pointer: called once inside the threshold frame with the slot\'s token, after the slot is locked', () => {
    const calls = [];
    const onCommit = vi.fn((token) => { calls.push({ token, hold: currentHold(), reasons: reasons() }); });
    render(<Harness onComplete={() => {}} onCommit={onCommit} />);
    act(() => { fire('pointerdown'); });
    step(600);
    expect(onCommit).not.toHaveBeenCalled();
    step(1300);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [{ token, hold, reasons: atCall }] = calls;
    expect(typeof token).toBe('string');
    expect(hold).toEqual({ controlId: 'c1', holdToken: token, phase: 'locked' });
    expect(atCall).toEqual(['commit']); // the one commit terminal precedes it
    act(() => { vi.advanceTimersByTime(450); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('keyboard: called once, synchronously, with the token', () => {
    const onCommit = vi.fn();
    render(<Harness onComplete={() => {}} onCommit={onCommit} />);
    act(() => { key(); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toBe(currentHold().holdToken);
  });

  it('a reentrant release inside onCommit cannot undo the commitment', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} onCommit={() => { fire('pointerup'); fire('pointercancel'); }} />);
    holdToCommit();
    expect(button().dataset.phase).toBe('locked');
    expect(reasons()).toEqual(['commit']);
    act(() => { vi.advanceTimersByTime(450); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('beatOwner — the committed beat handed to its owner', () => {
  const owner = () => {
    const handed = [];
    return { handed, commit: vi.fn((token, run) => { handed.push({ token, run }); }) };
  };

  it('the owner gets (token, run) once; the hook schedules no timer of its own; run fires onComplete once', async () => {
    const onComplete = vi.fn();
    const onCommit = vi.fn();
    const beatOwner = owner();
    render(<Harness onComplete={onComplete} onCommit={onCommit} beatOwner={beatOwner} />);
    act(() => { fire('pointerdown'); });
    step(600);
    const timersBefore = vi.getTimerCount();
    step(1300);
    expect(beatOwner.commit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(timersBefore);
    const [{ token, run }] = beatOwner.handed;
    expect(token).toBe(onCommit.mock.calls[0][0]);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => { run(); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => { run(); });
    expect(onComplete).toHaveBeenCalledTimes(1); // one-shot
    expect(currentHold()).toBeNull();
  });

  it('keyboard: the owner gets the beat too', () => {
    const beatOwner = owner();
    render(<Harness onComplete={() => {}} beatOwner={beatOwner} />);
    act(() => { key(); });
    expect(beatOwner.commit).toHaveBeenCalledTimes(1);
    expect(beatOwner.handed[0].token).toBe(currentHold().holdToken);
  });

  it('unmounting the control does not cancel an owned beat: the claim stays until run settles', async () => {
    const onComplete = vi.fn();
    const beatOwner = owner();
    render(<Harness onComplete={onComplete} beatOwner={beatOwner} />);
    holdToCommit();
    render(<div />);
    expect(currentHold()).toMatchObject({ phase: 'locked' });
    await act(async () => { beatOwner.handed[0].run(); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(currentHold()).toBeNull();
  });

  it('without beatOwner the legacy behaviour holds: an unmount during the beat cancels the deploy and frees the claim', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    holdToCommit();
    render(<div />);
    expect(currentHold()).toBeNull();
    act(() => { vi.advanceTimersByTime(450); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('without beatOwner, an unmount after onComplete has run keeps the claim until its promise settles', async () => {
    let settle;
    const inFlight = new Promise((resolve) => { settle = resolve; });
    render(<Harness onComplete={() => inFlight} />);
    holdToCommit();
    act(() => { vi.advanceTimersByTime(450); });
    render(<div />);
    expect(currentHold()).toMatchObject({ phase: 'locked' });
    await act(async () => { settle({ success: true }); });
    expect(currentHold()).toBeNull();
  });
});

describe('a claim revoked from outside the hook', () => {
  it('a charge whose token was released elsewhere cannot commit: one abort, back to idle, no deploy', () => {
    const onComplete = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onComplete={onComplete} onCommit={onCommit} />);
    act(() => { fire('pointerdown'); });
    step(600);
    releaseHold(currentHold().holdToken); // e.g. S2b's provider revoking on an overlay or account change
    step(1300);
    expect(reasons()).toEqual(['abort']);
    expect(button().dataset.phase).toBe('idle');
    expect(onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
