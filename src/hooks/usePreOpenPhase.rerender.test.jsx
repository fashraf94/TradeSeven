// @vitest-environment jsdom
//
// src/hooks/usePreOpenPhase.rerender.test.jsx
//
// The LIVE-BEHAVIOUR half of the hook's coverage. usePreOpenPhase.test.jsx mounts
// with renderToString, which never runs effects — so it cannot see the two things
// that make this hook different from a bare predicate:
//
//   1. that it re-evaluates the clock on a LATER render (the stale-clock defect),
//   2. that its own ticker flips the phase with no prop change at all.
//
// Both rows below FAIL against the code this suite was written for:
//   - holding `now` in state (seeded at mount) reds the first row;
//   - deleting the useEffect reds the second.
// That is the point — the renderToString suite stays green under both mutations.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const { flagState } = vi.hoisted(() => ({ flagState: { on: true } }));
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isPreOpenPhaseRoutingOn: () => flagState.on };
});

const { default: usePreOpenPhase, PREOPEN_TICK_MS } = await import('./usePreOpenPhase.js');
const { GROUP_STATUS } = await import('../constants/leagueTournament.js');

const ANCHOR = '2026-08-27';                              // Thu
const NIGHT_BEFORE = '2026-08-27T03:50:00.000Z';          // ET Wed 08-26 23:50
const MORNING_FLIP = '2026-08-27T10:00:00.000Z';          // ET Thu 08-27 06:00
const JUST_BEFORE_BELL = '2026-08-27T13:29:00.000Z';      // ET Thu 09:29
const AFTER_BELL = '2026-08-27T13:31:00.000Z';            // ET Thu 09:31

const awaitingPod = { status: GROUP_STATUS.AWAITING_OPEN, startAnchor: { anchorEtDate: ANCHOR } };
const battlePod = { status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate: ANCHOR } };

let container; let root; let seen;

function Probe({ group }) { seen = usePreOpenPhase(group); return null; }

const mount = (group) => act(() => { root.render(<Probe group={group} />); });
const rerender = (group) => act(() => { root.render(<Probe group={group} />); });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  flagState.on = true;
  seen = undefined;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('usePreOpenPhase — the clock is read at RENDER, not seeded at mount', () => {
  it('a tab open since last night ENTERS the phase when the morning status flip arrives', () => {
    // The regression: with `now` held in state the hook still carried Wednesday
    // 23:50 at this point, compared it against a Thursday anchor, and returned
    // false — showing the live surface for the whole pre-open window.
    vi.setSystemTime(new Date(NIGHT_BEFORE));
    mount(awaitingPod);
    expect(seen, 'AWAITING_OPEN the night before is not pre-open').toBe(false);

    vi.setSystemTime(new Date(MORNING_FLIP));
    rerender(battlePod); // the ~06:00 sweep lands as a Firestore snapshot
    expect(seen, 'the pod must enter the pre-open phase on the morning flip').toBe(true);
  });

  it('a long-lived mount still leaves the phase at the bell', () => {
    vi.setSystemTime(new Date(NIGHT_BEFORE));
    mount(awaitingPod);
    vi.setSystemTime(new Date(MORNING_FLIP));
    rerender(battlePod);
    expect(seen).toBe(true);

    vi.setSystemTime(new Date(AFTER_BELL));
    act(() => { vi.advanceTimersByTime(PREOPEN_TICK_MS + 1000); });
    expect(seen, 'the ticker must carry it past the bell').toBe(false);
  });
});

describe('usePreOpenPhase — the ticker flips the phase with no prop change', () => {
  it('mounted pre-open, it goes live at the bell without any re-render from the caller', () => {
    // Deleting the useEffect reds this row. Nothing writes to the group doc at
    // 09:30, so the ticker is the ONLY thing that can move this surface.
    vi.setSystemTime(new Date(JUST_BEFORE_BELL));
    mount(battlePod);
    expect(seen).toBe(true);

    vi.setSystemTime(new Date(AFTER_BELL));
    act(() => { vi.advanceTimersByTime(PREOPEN_TICK_MS + 1000); });
    expect(seen, 'no prop changed — only the hook’s own clock').toBe(false);
  });

  it('arms NO timer when the phase is false (flag off) — the off-flag cadence is unchanged', () => {
    flagState.on = false;
    vi.setSystemTime(new Date(JUST_BEFORE_BELL));
    mount(battlePod);
    expect(seen).toBe(false);
    expect(vi.getTimerCount(), 'an off-flag site must arm no interval').toBe(0);
  });

  it('arms a timer while pre-open, and tears it down once past the bell', () => {
    vi.setSystemTime(new Date(JUST_BEFORE_BELL));
    mount(battlePod);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    vi.setSystemTime(new Date(AFTER_BELL));
    act(() => { vi.advanceTimersByTime(PREOPEN_TICK_MS + 1000); });
    expect(seen).toBe(false);
    expect(vi.getTimerCount(), 'the interval must be torn down once the phase ends').toBe(0);
  });
});
