// @vitest-environment jsdom
//
// src/screens/battleView/useServerClock.jsdom.test.jsx
//
// Cockpit Build 2b — the server's clock for deadlines (spec §8, from merge):
// the offset at receipt; one timer at the next open deadline on SERVER time;
// the instant it fires the render-time "now" passes the deadline, so the card
// loses its buttons then — never at the next 60-second coarse tick.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useServerNow, nextDeadlineDelay, clockOffsetFrom, MAX_TIMER_MS } from './useServerClock';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let seen;

function Probe(props) {
  seen.push(useServerNow(props));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = (props) => act(() => { root.render(<Probe {...props} />); });
const latest = () => seen[seen.length - 1];

describe('the pure parts', () => {
  it('clockOffsetFrom: server minus client at receipt; 0 when either is unknown', () => {
    expect(clockOffsetFrom(10_500, 10_000)).toBe(500);
    expect(clockOffsetFrom(9_000, 10_000)).toBe(-1_000);
    expect(clockOffsetFrom(null, 10_000)).toBe(0);
    expect(clockOffsetFrom(10_000, Number.NaN)).toBe(0);
  });
  it('nextDeadlineDelay: the earliest deadline strictly after the SERVER now, in client ms; null when none is ahead', () => {
    expect(nextDeadlineDelay([5_000, 3_000, 9_000], { clientNowMs: 1_000, offsetMs: 0 })).toBe(2_000);
    // The server runs 1.5 s ahead: the deadline arrives 1.5 s sooner on the client's clock.
    expect(nextDeadlineDelay([5_000], { clientNowMs: 1_000, offsetMs: 1_500 })).toBe(2_500);
    expect(nextDeadlineDelay([500, 900], { clientNowMs: 1_000, offsetMs: 0 })).toBeNull();
    expect(nextDeadlineDelay([1_000], { clientNowMs: 1_000, offsetMs: 0 })).toBeNull(); // at the deadline: no longer ahead
    expect(nextDeadlineDelay([null, 'x', Number.NaN], { clientNowMs: 0 })).toBeNull();
    expect(nextDeadlineDelay([1e15], { clientNowMs: 0 })).toBe(MAX_TIMER_MS);
  });
});

describe('useServerNow — one timer at the next deadline', () => {
  it('the coarse instant plus the offset; at the deadline the timer moves "now" past it, without waiting for the coarse tick', () => {
    vi.setSystemTime(100_000);
    const deadline = 100_000 + 500 + 30_000; // server-time deadline, 30 s after the server's now
    mount({ enabled: true, coarseNowMs: 100_000, offsetMs: 500, deadlines: [deadline] });
    expect(latest()).toBe(100_500);
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(latest()).toBe(100_500); // the coarse clock has not moved; nothing fired yet
    act(() => { vi.advanceTimersByTime(1_100); });
    expect(latest() >= deadline).toBe(true);
  });

  it('disabled: no timer and no offset — the coarse clock alone', () => {
    vi.setSystemTime(100_000);
    mount({ enabled: false, coarseNowMs: 100_000, offsetMs: 500, deadlines: [130_000] });
    expect(latest()).toBe(100_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-arms for the NEXT deadline after one fires', () => {
    vi.setSystemTime(0);
    mount({ enabled: true, coarseNowMs: 0, offsetMs: 0, deadlines: [10_000, 20_000] });
    act(() => { vi.advanceTimersByTime(10_100); });
    expect(latest() >= 10_000).toBe(true);
    expect(latest() < 20_000).toBe(true);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(latest() >= 20_000).toBe(true);
    expect(vi.getTimerCount()).toBe(0); // nothing left ahead
  });
});
