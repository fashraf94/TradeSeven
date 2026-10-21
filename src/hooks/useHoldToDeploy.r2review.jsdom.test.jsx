// @vitest-environment jsdom
//
// src/hooks/useHoldToDeploy.r2review.jsdom.test.jsx
//
// Command Center repair R2 — the rows from the build's BUILD_RULES §2 review
// (docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md §8), ported from the
// lenses' own repros. Each failed on the pre-fix build (27d70178) and passes
// after the fix round; the record is in that report's §4.
//
// Harness as in useHoldToDeploy.r2.jsdom.test.jsx, plus an act-less mode for
// L2-1: an update rendered OUTSIDE act runs on React's real scheduler, which
// paints between a non-event commit and its passive effects — the window a
// queued frame or the beat timer could use.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
}));

import { DEPLOY_INTENT_EVENT } from '../components/warpStateMachine';
import useHoldToDeploy from './useHoldToDeploy';
import { currentHold, releaseHold, __resetHoldClaim } from './holdClaim';
import HoldToDeployButton from '../components/Dashboard/deployCeremony/HoldToDeployButton';

const T0 = 1_800_000_000_000;
let frames;
let frameSeq;
let frameRequests;
let nowMs;
let seen;
let buzz;
let container;
let root;

const onIntent = (event) => seen.push(event.detail);

beforeEach(() => {
  __resetHoldClaim();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  frames = new Map();
  frameSeq = 0;
  frameRequests = 0;
  nowMs = T0;
  seen = [];
  buzz = [];
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
  window.addEventListener(DEPLOY_INTENT_EVENT, onIntent);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.unmount());
  container.remove();
  window.removeEventListener(DEPLOY_INTENT_EVENT, onIntent);
  delete navigator.vibrate;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- harness ----------------------------------------------------------------

const render = (ui) => act(() => { root.render(ui); });
const ev = {
  down: (b, init) => b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, ...init })),
  up: (b) => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
  key: (b) => b.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' })),
};
function frameAt(ms) {
  nowMs = T0 + ms;
  const due = [...frames.entries()];
  frames.clear();
  for (const [, cb] of due) cb(nowMs);
}
const step = (ms) => act(() => { frameAt(ms); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const kinds = () => seen.map((d) => (d.progress === null ? d.reason : 'progress'));
const count = (k) => kinds().filter((x) => x === k).length;

/** The hook alone, for the S2b seam props HoldToDeployButton does not pass. */
function H(props) {
  const { phase, bind } = useHoldToDeploy({ enabled: true, controlId: 'c1', ...props });
  return <button type="button" data-phase={phase} {...bind}>hold</button>;
}
const btn = (i = 0) => container.querySelectorAll('button')[i];
function holdToCommit(b) { act(() => { ev.down(b); }); step(200); step(600); step(1000); step(1300); }

// act-less: let the real scheduler run one task (the render and its commit).
const immediate = () => new Promise((r) => { setImmediate(r); });
async function commitOutsideAct(fn) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  fn();
  await Promise.resolve();
  await Promise.resolve();
  await immediate();
}
async function settleScheduler() {
  for (let i = 0; i < 6; i += 1) { await Promise.resolve(); await immediate(); }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

// ===========================================================================
// L2-1 — the unmount cancel lands in the commit that removes the button
// ===========================================================================

describe('L2-1 — an unmount from a non-event update cancels in its own commit', () => {
  it('the claim is free and the stream closed right after the removing commit; a frame queued before it commits nothing', async () => {
    const onComplete = vi.fn();
    render(<HoldToDeployButton label="Deploy" onComplete={onComplete} />);
    const b = btn();
    act(() => { ev.down(b); });
    step(200); step(600); step(1000);
    await commitOutsideAct(() => root.render(<div />));
    expect(container.contains(b)).toBe(false);
    expect(currentHold()).toBeNull();
    expect(count('abort')).toBe(1);
    frameAt(1300); // the browser's next frame
    await settleScheduler();
    advance(1000);
    expect(count('commit')).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('a beat timer due in the same window does not deploy from the removed button (R-R2-8)', async () => {
    const onComplete = vi.fn();
    render(<HoldToDeployButton label="Deploy" onComplete={onComplete} />);
    holdToCommit(btn());
    advance(449);
    await commitOutsideAct(() => root.render(<div />));
    vi.advanceTimersByTime(1);
    await settleScheduler();
    expect(onComplete).not.toHaveBeenCalled();
    expect(currentHold()).toBeNull();
  });

  it('with a beatOwner, a control removed before its threshold hands the owner nothing', async () => {
    const onComplete = vi.fn();
    const beatOwner = { commit: vi.fn() };
    render(<H onComplete={onComplete} beatOwner={beatOwner} />);
    act(() => { ev.down(btn()); });
    step(600); step(1000);
    await commitOutsideAct(() => root.render(<div />));
    frameAt(1300);
    await settleScheduler();
    expect(beatOwner.commit).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// L2-2 — an onCommit that unmounts its own control
// ===========================================================================

describe('L2-2 — an onCommit that unmounts the control synchronously cancels the legacy beat', () => {
  it('pointer path: no deploy, the claim freed', () => {
    const onComplete = vi.fn();
    const onCommit = () => { flushSync(() => { root.render(<div />); }); };
    render(<H onComplete={onComplete} onCommit={onCommit} />);
    holdToCommit(btn());
    expect(container.querySelector('button')).toBeNull();
    advance(450);
    expect(onComplete).not.toHaveBeenCalled();
    expect(currentHold()).toBeNull();
  });

  it('key path: no deploy, the claim freed', () => {
    const onComplete = vi.fn();
    const onCommit = () => { flushSync(() => { root.render(<div />); }); };
    render(<H onComplete={onComplete} onCommit={onCommit} />);
    act(() => { ev.key(btn()); });
    advance(450);
    expect(onComplete).not.toHaveBeenCalled();
    expect(currentHold()).toBeNull();
  });
});

// ===========================================================================
// L2-3 / L4-1 — a beatOwner whose commit throws
// ===========================================================================

describe('L2-3 / L4-1 — an owner that throws does not take the beat; the hook keeps it', () => {
  it('the error surfaces, the deploy still completes once after 450 ms, and the claim is released', async () => {
    const onComplete = vi.fn();
    const beatOwner = { commit: () => { throw new Error('owner boom'); } };
    render(<><H key="a" controlId="a" onComplete={onComplete} beatOwner={beatOwner} /><H key="b" controlId="b" /></>);
    act(() => { ev.down(btn(0)); });
    step(600);
    expect(() => step(1300)).toThrow('owner boom');
    act(() => {}); // flush what the throwing frame queued
    expect(btn(0).dataset.phase).toBe('locked');
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(currentHold()).toBeNull();
    const before = frameRequests;
    act(() => { ev.down(btn(1)); });
    expect(frameRequests).toBe(before + 1);
  });
});

describe('BI-6 — an onCommit that throws cannot strand the commitment', () => {
  it('legacy beat: the error surfaces, the deploy completes once, the claim is released', async () => {
    const onComplete = vi.fn();
    render(<H onComplete={onComplete} onCommit={() => { throw new Error('commit boom'); }} />);
    act(() => { ev.down(btn()); });
    step(600);
    expect(() => step(1300)).toThrow('commit boom');
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(currentHold()).toBeNull();
  });

  it('owned beat: the owner still receives it, and the first error is the one surfaced', () => {
    const beatOwner = { commit: vi.fn(() => { throw new Error('owner boom'); }) };
    render(<H onComplete={() => {}} onCommit={() => { throw new Error('commit boom'); }} beatOwner={beatOwner} />);
    act(() => { ev.down(btn()); });
    step(600);
    expect(() => step(1300)).toThrow('commit boom');
    expect(beatOwner.commit).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// L2-4 / L4-3a — a claim revoked during the beat
// ===========================================================================

describe('L2-4 / L4-3a — every continuation validates its token: a beat revoked before it runs deploys nothing', () => {
  it('no onComplete, the control back to idle, and a second control then deploys alone', () => {
    const a = vi.fn();
    const bFn = vi.fn();
    render(<><H key="a" controlId="a" onComplete={a} /><H key="b" controlId="b" onComplete={bFn} /></>);
    holdToCommit(btn(0));
    releaseHold(currentHold().holdToken); // e.g. S2b's provider revoking on an account change
    advance(450);
    expect(a).not.toHaveBeenCalled();
    expect(btn(0).dataset.phase).toBe('idle');
    act(() => { ev.key(btn(1)); });
    advance(450);
    expect(bFn).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('the revoked owned beat deploys nothing either, whenever the owner runs it', () => {
    const onComplete = vi.fn();
    const handed = [];
    const beatOwner = { commit: (token, run) => { handed.push({ token, run }); } };
    render(<H onComplete={onComplete} beatOwner={beatOwner} />);
    holdToCommit(btn());
    releaseHold(handed[0].token);
    act(() => { handed[0].run(); });
    expect(onComplete).not.toHaveBeenCalled();
    expect(btn().dataset.phase).toBe('idle');
  });
});

// ===========================================================================
// L4-2 / L3-4 — a charging claim revoked from outside ends at the next frame
// ===========================================================================

describe('L4-2 / L3-4 — a charge revoked from outside ends at its next frame, not at its threshold', () => {
  it('one abort at the next frame; a second control then charges alone, one progress stream', () => {
    const a = vi.fn();
    const bFn = vi.fn();
    render(<><H key="a" controlId="a" onComplete={a} /><H key="b" controlId="b" onComplete={bFn} /></>);
    act(() => { ev.down(btn(0)); });
    step(600);
    releaseHold(currentHold().holdToken);
    step(800);
    expect(btn(0).dataset.phase).toBe('idle');
    expect(kinds()).toEqual(['progress', 'abort']);
    expect(frames.size).toBe(0);
    act(() => { ev.down(btn(1)); });
    const before = seen.length;
    step(1000);
    expect(seen.length - before).toBe(1);
    step(2200);
    advance(450);
    expect(bFn).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('a claim revoked inside the threshold frame itself cannot commit: one abort, no commit, no deploy', () => {
    const onComplete = vi.fn();
    render(<H onComplete={onComplete} />);
    const revokeAtFull = (event) => {
      if (event.detail.progress === 1) releaseHold(currentHold()?.holdToken);
    };
    window.addEventListener(DEPLOY_INTENT_EVENT, revokeAtFull);
    try {
      act(() => { ev.down(btn()); });
      step(600); step(1300);
    } finally {
      window.removeEventListener(DEPLOY_INTENT_EVENT, revokeAtFull);
    }
    expect(count('commit')).toBe(0);
    expect(count('abort')).toBe(1);
    expect(btn().dataset.phase).toBe('idle');
    advance(1000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// L3-3 — a cancel delivered inside a tick ends that frame
// ===========================================================================

describe('L3-3 — a listener that cancels mid-frame: nothing more from that frame', () => {
  it('no progress after the abort, no haptic after it, and no next frame queued', () => {
    render(<H onComplete={() => {}} />);
    const blurPastAThird = (event) => {
      if (typeof event.detail.progress === 'number' && event.detail.progress > 0.3) window.dispatchEvent(new Event('blur'));
    };
    window.addEventListener(DEPLOY_INTENT_EVENT, blurPastAThird);
    try {
      act(() => { ev.down(btn()); });
      step(200);
      step(600);
    } finally {
      window.removeEventListener(DEPLOY_INTENT_EVENT, blurPastAThird);
    }
    expect(kinds()).toEqual(['progress', 'progress', 'abort']);
    expect(buzz).toEqual([]);
    expect(frames.size).toBe(0);
    expect(btn().dataset.phase).toBe('idle');
  });

  it('a listener that cancels AND re-presses inside the frame leaves one frame chain, the new one (RL3)', () => {
    render(<H onComplete={() => {}} />);
    let done = false;
    const cancelAndRepress = (event) => {
      if (done || typeof event.detail.progress !== 'number' || event.detail.progress <= 0.3) return;
      done = true;
      window.dispatchEvent(new Event('blur'));
      ev.down(btn());
    };
    window.addEventListener(DEPLOY_INTENT_EVENT, cancelAndRepress);
    try {
      act(() => { ev.down(btn()); });
      step(600);
    } finally {
      window.removeEventListener(DEPLOY_INTENT_EVENT, cancelAndRepress);
    }
    expect(btn().dataset.phase).toBe('charging');
    expect(frames.size).toBe(1);
    const before = seen.length;
    step(800);
    expect(seen.length - before).toBe(1);
  });
});

// ===========================================================================
// L5 — rows the mutating lens found missing (its probes P1–P9, H2)
// ===========================================================================

describe('L5-5 — a Locked-in control whose deploy has settled ignores input until re-enabled, as before R2', () => {
  it('pointer: no new charge', async () => {
    render(<HoldToDeployButton label="Deploy" onComplete={() => {}} />);
    holdToCommit(btn());
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(currentHold()).toBeNull();
    expect(btn().textContent).toBe('Locked in');
    const before = frameRequests;
    act(() => { ev.down(btn()); });
    expect(frameRequests).toBe(before);
    expect(btn().textContent).toBe('Locked in');
  });

  it('key: no second deploy', async () => {
    const onComplete = vi.fn();
    render(<HoldToDeployButton label="Deploy" onComplete={onComplete} />);
    act(() => { ev.key(btn()); });
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(currentHold()).toBeNull();
    act(() => { ev.key(btn()); });
    advance(450);
    expect(count('commit')).toBe(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('L5-2 — disabled from a non-event update cancels in its own commit (BI-4)', () => {
  it('a frame queued before the passive effects cannot commit on the now-disabled control', async () => {
    const onComplete = vi.fn();
    render(<HoldToDeployButton label="Deploy" onComplete={onComplete} />);
    act(() => { ev.down(btn()); });
    step(600); step(1000);
    await commitOutsideAct(() => root.render(<HoldToDeployButton label="Deploy" onComplete={onComplete} disabled />));
    frameAt(1300);
    await settleScheduler();
    advance(1000);
    expect(count('commit')).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('L5-3 — a deploy whose promise rejects still frees the claim', () => {
  it('the slot is empty once the rejection settles, and the rejection still surfaces once', async () => {
    // The hook keeps a rejected deploy visible as ONE unhandled rejection (as
    // before R2, when the promise was dropped). This row listens for it in
    // place of vitest's own listener, for its duration only.
    const surfaced = [];
    const theirs = process.listeners('unhandledRejection');
    const mine = (reason) => { surfaced.push(reason?.message); };
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', mine);
    try {
      let fail;
      const inFlight = new Promise((_, reject) => { fail = reject; });
      render(<><H key="a" controlId="a" onComplete={() => inFlight} /><H key="b" controlId="b" /></>);
      holdToCommit(btn(0));
      advance(450);
      expect(currentHold()).not.toBeNull();
      await act(async () => { fail(new Error('deploy boom')); });
      await immediate();
      expect(currentHold()).toBeNull();
      expect(surfaced).toEqual(['deploy boom']);
      const before = frameRequests;
      act(() => { ev.down(btn(1)); });
      expect(frameRequests).toBe(before + 1);
    } finally {
      process.off('unhandledRejection', mine);
      for (const l of theirs) process.on('unhandledRejection', l);
    }
  });
});

describe('L5-6 — a beat revoked from outside leaves a usable, drained control', () => {
  it('the same control can hold again afterwards', () => {
    render(<H onComplete={() => {}} />);
    holdToCommit(btn());
    releaseHold(currentHold().holdToken);
    advance(450);
    expect(btn().dataset.phase).toBe('idle');
    const before = frameRequests;
    act(() => { ev.down(btn()); });
    expect(frameRequests).toBe(before + 1);
  });

  it('through the button: label and fill back to idle', () => {
    render(<HoldToDeployButton label="Deploy" onComplete={() => {}} />);
    holdToCommit(btn());
    releaseHold(currentHold().holdToken);
    advance(450);
    expect(btn().textContent).toBe('Deploy');
    expect(btn().querySelector('span[aria-hidden]').style.width).toBe('0%');
  });
});

describe('L5-7 — the settle releases its own token, even after a re-enable cleared the control', () => {
  it('hold → beat → disable → re-enable mid-flight → settle: the slot is free', async () => {
    let settle;
    const inFlight = new Promise((resolve) => { settle = resolve; });
    render(<H onComplete={() => inFlight} />);
    holdToCommit(btn());
    advance(450);
    render(<H onComplete={() => inFlight} disabled />);
    render(<H onComplete={() => inFlight} />);
    expect(btn().dataset.phase).toBe('idle');
    expect(currentHold()).toMatchObject({ phase: 'locked' });
    await act(async () => { settle({ success: true }); });
    expect(currentHold()).toBeNull();
  });
});

describe('L5-9 — each button is its own control id (R-R2-1), stable across renders', () => {
  it('two buttons claim under distinct ids; a re-render keeps the id', () => {
    const two = (n) => (<><HoldToDeployButton label={`A${n}`} onComplete={() => {}} /><HoldToDeployButton label="B" onComplete={() => {}} /></>);
    render(two(1));
    act(() => { ev.down(btn(0)); });
    const idA = currentHold().controlId;
    act(() => { ev.up(btn(0)); });
    act(() => { ev.down(btn(1)); });
    const idB = currentHold().controlId;
    act(() => { ev.up(btn(1)); });
    expect(idA).not.toBe(idB);
    render(two(2));
    act(() => { ev.down(btn(0)); });
    expect(currentHold().controlId).toBe(idA);
    act(() => { ev.up(btn(0)); });
  });
});

describe('L5-11 — the act-less helper really splits a commit from its passive effects', () => {
  it('returns after the layout effect and before the passive one (the L2-1, L2-5 and BI-4 rows rest on it)', async () => {
    const log = [];
    function Probe({ n }) {
      React.useLayoutEffect(() => { log.push(`layout${n}`); }, [n]);
      React.useEffect(() => { log.push(`passive${n}`); }, [n]);
      return <i>{n}</i>;
    }
    render(<Probe n={1} />);
    log.length = 0;
    await commitOutsideAct(() => root.render(<Probe n={2} />));
    const atReturn = [...log];
    await settleScheduler();
    expect({ atReturn, after: [...log] }).toEqual({ atReturn: ['layout2'], after: ['layout2', 'passive2'] });
  });
});

// ===========================================================================
// L2-5 — the re-enable reset never overwrites a live charge
// ===========================================================================

describe('L2-5 — a press between a re-enable render and its reset keeps its charge on screen', () => {
  it('the phase stays charging and the fill snaps per frame through the charge', async () => {
    render(<HoldToDeployButton label="Deploy" onComplete={() => {}} disabled />);
    await commitOutsideAct(() => root.render(<HoldToDeployButton label="Deploy" onComplete={() => {}} />));
    const b = btn();
    ev.down(b);
    await settleScheduler();
    step(600);
    const fill = b.querySelector('span[aria-hidden]');
    expect(fill.style.transition).toBe('none');
    expect(parseFloat(fill.style.width)).toBeGreaterThan(40);
    step(1300);
    advance(450);
  });
});
