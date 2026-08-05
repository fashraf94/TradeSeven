// @vitest-environment jsdom
//
// Acceptance rows A1 / A3 / A4 for the DEPLOY-INTENT COUPLING — the two ends of
// the channel, driven through the REAL hold gesture and the REAL starfield.
// Delight Layer arc, Task 4 (Phase 1). Ruling R-T4-ARCH.
// Basis: docs/audits/20260801_DELIGHT_DEPLOY_SKY_COUPLING_PHASE0_DISCOVERY.md
//
// The pure half of the contract (the curve, the exhale, malformed payloads) is
// asserted as plain rows in warpStateMachine.test.js. What CANNOT be seen from
// there, and is therefore what this file exists for:
//
//   A1  flag OFF => the gesture dispatches NOTHING and the sky registers no
//       listener. This is the row that fails if the coupling ever leaks while
//       dark, which is the whole premise of merging it dark.
//   A3  the dispatched payloads are really the shape both ends agreed on —
//       a progress stream while charging, a terminal on abort AND on commit.
//   A4  under prefers-reduced-motion the intent is received and DROPPED: no
//       loop is scheduled and no repaint happens, however many events arrive.
//
// Harness precedent: starfield.depstability.test.jsx (jsdom docblock, createRoot
// + act, per-file mocks, stubbed canvas + rAF, no setupFiles).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// The flag is the subject of row A1, so it has to be switchable per test. Every
// other export stays real (the components depend on them).
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: vi.fn(),
  isDeployCeremonyOn: vi.fn(() => true),
}));

// applyIntent is wrapped in a spy that calls THROUGH, so a row can assert what
// the running loop actually drew with — i.e. that the event reached the
// consumption read, not merely that an event was dispatched.
vi.mock('./warpStateMachine', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, applyIntent: vi.fn(actual.applyIntent) };
});

import { isDeploySkyCouplingOn } from '../config/featureFlags';
import StarfieldBackground from './StarfieldBackground';
import { DEPLOY_INTENT_EVENT, WARP_TUNING, applyIntent, createIntentState } from './warpStateMachine';
import HoldToDeployButton from './Dashboard/deployCeremony/HoldToDeployButton';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- canvas + rAF + clock instrumentation ----------------------------------
// jsdom returns null from getContext and the `canvas` package is not a
// dependency, so the context is stubbed. getContext is also the paint counter:
// both applyCanvasSize and paint acquire a context, so a repaint is visible as
// an increment (which is how A4 proves "no repaint under reduced motion").

let rafHandles;
let rafNextId;
let rafScheduled;
let contextsHandedOut;
let nowMs;

function makeContextStub() {
  contextsHandedOut += 1;
  return {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    globalCompositeOperation: '', globalAlpha: 1, fillStyle: '', strokeStyle: '',
    lineWidth: 1, lineCap: '',
  };
}

/** Run n queued animation frames, oldest first. */
function flushFrames(n = 1) {
  for (let i = 0; i < n; i += 1) {
    const entry = rafHandles.entries().next();
    if (entry.done) return;
    const [id, cb] = entry.value;
    rafHandles.delete(id);
    cb(nowMs);
  }
}

let container;
let root;
/** Every ft-deploy-intent payload seen this test, in order. */
let seen;
let listener;

beforeEach(() => {
  rafHandles = new Map();
  rafNextId = 0;
  rafScheduled = 0;
  contextsHandedOut = 0;
  nowMs = 1_800_000_000_000;
  seen = [];

  isDeploySkyCouplingOn.mockReturnValue(true);
  applyIntent.mockClear();

  vi.stubGlobal('requestAnimationFrame', (cb) => {
    rafNextId += 1;
    rafScheduled += 1;
    rafHandles.set(rafNextId, cb);
    return rafNextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => { rafHandles.delete(id); });
  // The hold measures progress off performance.now; the sky stamps the exhale
  // off Date.now. Both ride one controllable clock so a hold can be walked
  // frame by frame.
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

  HTMLCanvasElement.prototype.getContext = makeContextStub;
  window.matchMedia = (q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });

  listener = (event) => seen.push(event.detail);
  window.addEventListener(DEPLOY_INTENT_EVENT, listener);
});

afterEach(() => {
  window.removeEventListener(DEPLOY_INTENT_EVENT, listener);
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = async (element) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
};

const button = () => container.querySelector('button');

/** React attaches at the root container, so the event has to bubble. */
const fire = async (type) => {
  await act(async () => {
    button().dispatchEvent(new Event(type, { bubbles: true }));
  });
};

/** Advance the shared clock, then run one queued frame. */
const advanceTo = async (ms) => {
  nowMs = 1_800_000_000_000 + ms;
  await act(async () => { flushFrames(1); });
};

const holdButton = (props = {}) => (
  <HoldToDeployButton accent="#5EEAD4" label="Deploy" onComplete={() => {}} {...props} />
);

// ===========================================================================
// A1 — the coupling must not leak while it is dark
// ===========================================================================

describe('A1 flag OFF — the coupling is inert', () => {
  beforeEach(() => { isDeploySkyCouplingOn.mockReturnValue(false); });

  it('dispatches NOTHING across a full hold, an abort and a commit', async () => {
    await mount(holdButton());

    await fire('pointerdown');
    await advanceTo(400);
    await advanceTo(900);
    await fire('pointerup');           // abort
    expect(seen).toEqual([]);

    // ...and again, all the way through to completion.
    await fire('pointerdown');
    await advanceTo(2000);             // past the 1300ms hold => fireComplete
    expect(seen).toEqual([]);
  });

  it('dispatches nothing on the keyboard deploy path either', async () => {
    await mount(holdButton());
    await act(async () => {
      button().dispatchEvent(Object.assign(
        new Event('keydown', { bubbles: true }), { key: 'Enter' },
      ));
    });
    expect(seen).toEqual([]);
  });

  it('registers NO listener on the sky, so intent cannot reach the field', async () => {
    await mount(<StarfieldBackground mode="desktop" seed={7} liveGames={[]} />);
    flushFrames(1);
    applyIntent.mockClear();

    // Even a hand-rolled event — the exact payload the dispatcher would send —
    // must not move the drawn speed while the flag is off.
    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: 1 } }));
    });
    await advanceTo(16);

    expect(applyIntent).toHaveBeenCalled();
    for (const call of applyIntent.mock.calls) {
      // applyIntent(coreSpeed, state, now) — the state is still pristine, i.e.
      // the reducer never ran. Compared against createIntentState() rather than
      // a literal so the row keeps meaning what it says as the state grows.
      expect(call[1]).toEqual(createIntentState());
    }
    for (const result of applyIntent.mock.results) {
      expect(result.value).toBe(WARP_TUNING.SPEED_RESTING);
    }
  });
});

// ===========================================================================
// A3 — the payload contract, as the gesture really emits it
// ===========================================================================

describe('A3 the dispatched contract (flag ON)', () => {
  it('streams progress while charging, rising monotonically from the hold', async () => {
    await mount(holdButton());
    await fire('pointerdown');
    await advanceTo(200);
    await advanceTo(600);
    await advanceTo(1000);

    expect(seen.length).toBe(3);
    const progresses = seen.map((d) => d.progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => a - b));
    for (const p of progresses) {
      expect(typeof p).toBe('number');
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    // 1300ms hold — 600ms in is a bit under halfway.
    expect(progresses[1]).toBeCloseTo(600 / 1300, 6);
  });

  it('sends a terminal {progress: null, reason: "abort"} on an early release', async () => {
    await mount(holdButton());
    await fire('pointerdown');
    await advanceTo(600);
    await fire('pointerup');

    expect(seen.at(-1)).toEqual({ progress: null, reason: 'abort' });
  });

  it('sends a terminal {progress: null, reason: "commit"} when the hold completes', async () => {
    await mount(holdButton());
    await fire('pointerdown');
    await advanceTo(1400); // past HOLD_MS

    expect(seen.at(-1)).toEqual({ progress: null, reason: 'commit' });
    // The frame that completes the hold reports a full charge FIRST, so the
    // commit beat releases from the top of the curve rather than mid-ramp.
    expect(seen.at(-2)).toEqual({ progress: 1 });
  });

  it('sends the commit terminal on the KEYBOARD path too, with no progress stream (R-T4-S4)', async () => {
    await mount(holdButton());
    await act(async () => {
      button().dispatchEvent(Object.assign(
        new Event('keydown', { bubbles: true }), { key: 'Enter' },
      ));
    });
    expect(seen).toEqual([{ progress: null, reason: 'commit' }]);
  });

  it('closes the stream if the button unmounts MID-CHARGE', async () => {
    // Without this the last event the sky ever saw is a live progress, and the
    // overlay only decays on a terminal — a sky pinned fast by a hold that no
    // longer exists.
    await mount(holdButton());
    await fire('pointerdown');
    await advanceTo(600);
    expect(seen.at(-1).progress).toBeGreaterThan(0);

    await act(async () => root.unmount());
    root = null;

    expect(seen.at(-1)).toEqual({ progress: null, reason: 'abort' });
  });

  it('a disabled button neither holds nor dispatches', async () => {
    await mount(holdButton({ disabled: true }));
    await fire('pointerdown');
    await advanceTo(600);
    expect(seen).toEqual([]);
  });
});

// ===========================================================================
// Phase 2 — the commit surge and the button polish
// ===========================================================================

describe('the commit surge reaches the drawn sky (Phase 2, D4 / R-T4-S3)', () => {
  const mountSky = () => mount(<StarfieldBackground mode="desktop" seed={7} liveGames={[]} />);

  it('punches the DRAWN speed to the ceiling inside the surge window', async () => {
    await mountSky();
    flushFrames(1);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: 1 } }));
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
        detail: { progress: null, reason: 'commit' },
      }));
    });

    applyIntent.mockClear();
    await advanceTo(WARP_TUNING.INTENT_SURGE_RISE_MS);
    const drawn = applyIntent.mock.results.at(-1).value;
    expect(drawn).toBeCloseTo(WARP_TUNING.INTENT_SURGE_PEAK, 6);
    // ...which is strictly louder than the hold that preceded it.
    expect(drawn).toBeGreaterThan(WARP_TUNING.INTENT_PEAK);
  });

  it('an unmount abort cannot replace an in-flight commit surge', async () => {
    // Phase 2's settle flips isLive, which unmounts the deploy button and makes
    // the hook close its stream with an abort. That abort must not turn the
    // signature beat into its opposite.
    await mountSky();
    flushFrames(1);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: 1 } }));
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
        detail: { progress: null, reason: 'commit' },
      }));
    });
    nowMs += 60;
    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
        detail: { progress: null, reason: 'abort' },
      }));
    });

    applyIntent.mockClear();
    await advanceTo(WARP_TUNING.INTENT_SURGE_RISE_MS);
    expect(applyIntent.mock.results.at(-1).value).toBeCloseTo(WARP_TUNING.INTENT_SURGE_PEAK, 6);
  });
});

describe('the button charge glow (Phase 2 cosmetic pass)', () => {
  const filledButton = () => container.querySelector('button');

  it('is absent when the coupling flag is OFF — the hold looks exactly as today (A1)', () => {
    // The deploy ceremony is ALREADY live in production, so an ungated cosmetic
    // change here would ship to users ahead of the flip.
    isDeploySkyCouplingOn.mockReturnValue(false);
    return (async () => {
      await mount(holdButton());
      expect(filledButton().style.boxShadow).toBe('');
      await fire('pointerdown');
      await advanceTo(900);
      expect(filledButton().style.boxShadow).toBe('');
    })();
  });

  it('grows with hold progress when the flag is ON', async () => {
    await mount(holdButton());
    const radius = () => {
      const match = filledButton().style.boxShadow.match(/0 0 ([\d.]+)px/);
      return match ? Number(match[1]) : 0;
    };
    const atRest = radius();

    await fire('pointerdown');
    await advanceTo(400);
    const early = radius();
    await advanceTo(1100);
    const late = radius();

    expect(early).toBeGreaterThan(atRest);
    expect(late).toBeGreaterThan(early);
  });

  it('changes nothing about layout or copy', async () => {
    // "Contained polish, not a redesign" — the glow is box-shadow and border
    // colour only, neither of which participates in layout.
    await mount(holdButton({ label: 'Deploy to BaggerBomb' }));
    const before = filledButton().style.cssText;
    await fire('pointerdown');
    await advanceTo(900);
    const after = filledButton().style.cssText;

    expect(filledButton().textContent).toContain('Deploy to BaggerBomb');
    for (const prop of ['padding', 'width', 'height', 'margin', 'font-size', 'gap']) {
      const read = (css) => (css.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]*)`)) || [])[1];
      expect(read(after)).toBe(read(before));
    }
  });
});

// ===========================================================================
// A3 (listener half) + the end-to-end seam
// ===========================================================================

describe('the sky consumes the intent it is sent', () => {
  const mountSky = () => mount(<StarfieldBackground mode="desktop" seed={7} liveGames={[]} />);

  it('raises the DRAWN speed above the battle-state speed while a hold charges', async () => {
    await mountSky();
    flushFrames(1);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: 1 } }));
    });
    applyIntent.mockClear();
    await advanceTo(16);

    const [coreSpeed, , ] = applyIntent.mock.calls.at(-1);
    const drawn = applyIntent.mock.results.at(-1).value;
    expect(coreSpeed).toBe(WARP_TUNING.SPEED_RESTING); // the sky itself is calm...
    expect(drawn).toBe(WARP_TUNING.INTENT_PEAK);       // ...but it leans in.
    expect(drawn).toBeGreaterThan(coreSpeed);
  });

  it('exhales back to the battle-state speed after a terminal', async () => {
    await mountSky();
    flushFrames(1);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: 1 } }));
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
        detail: { progress: null, reason: 'abort' },
      }));
    });

    applyIntent.mockClear();
    await advanceTo(WARP_TUNING.INTENT_EXHALE_MS);
    expect(applyIntent.mock.results.at(-1).value).toBe(WARP_TUNING.SPEED_RESTING);
  });

  it('ignores malformed payloads without disturbing the field', async () => {
    await mountSky();
    flushFrames(1);

    await act(async () => {
      for (const detail of [null, { progress: 'half' }, { progress: NaN }, {}]) {
        window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail }));
      }
    });
    applyIntent.mockClear();
    await advanceTo(16);

    expect(applyIntent.mock.results.at(-1).value).toBe(WARP_TUNING.SPEED_RESTING);
  });

  it('does NOT restart the field when intent arrives (the depstability hazard)', async () => {
    await mountSky();
    flushFrames(1);
    const contextsBefore = contextsHandedOut;
    const scheduledBefore = rafScheduled;

    await act(async () => {
      for (let i = 0; i <= 20; i += 1) {
        window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: i / 20 } }));
      }
    });

    // A listener that setState'd (or re-ran the mount effect) would recreate the
    // star field and reset the warp state — a visible teleport, every hold.
    expect(contextsHandedOut).toBe(contextsBefore);
    expect(rafScheduled).toBe(scheduledBefore);
  });
});

// ===========================================================================
// A4 — reduced motion: received and dropped
// ===========================================================================

describe('A4 reduced motion — intent is inert', () => {
  beforeEach(() => {
    window.matchMedia = (q) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    });
  });

  it('schedules no loop and repaints nothing, however much intent arrives', async () => {
    await mount(<StarfieldBackground mode="desktop" seed={7} liveGames={[]} />);
    expect(rafScheduled).toBe(0);
    const contextsAfterStaticFrame = contextsHandedOut;
    expect(contextsAfterStaticFrame).toBeGreaterThan(0); // it DID draw one frame

    await act(async () => {
      for (let i = 0; i <= 20; i += 1) {
        window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, { detail: { progress: i / 20 } }));
      }
      window.dispatchEvent(new CustomEvent(DEPLOY_INTENT_EVENT, {
        detail: { progress: null, reason: 'commit' },
      }));
    });

    // The ref moved; nothing else did. No loop, no repaint, no re-render.
    expect(rafScheduled).toBe(0);
    expect(contextsHandedOut).toBe(contextsAfterStaticFrame);
    expect(applyIntent).not.toHaveBeenCalled(); // nothing reads it — step never runs
  });

  it('still communicates hold progress through the button fill', async () => {
    // The sky is silent under reduced motion, so the button is the ONLY channel
    // left. Its fill is driven by the raw progress state and must not depend on
    // the motion preference.
    await mount(holdButton());
    await fire('pointerdown');
    await advanceTo(650); // half of the 1300ms hold

    const fill = button().querySelector('span[aria-hidden]');
    const width = parseFloat(fill.style.width);
    expect(width).toBeGreaterThan(40);
    expect(width).toBeLessThan(60);
  });
});
