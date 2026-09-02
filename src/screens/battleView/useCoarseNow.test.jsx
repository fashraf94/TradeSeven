// @vitest-environment jsdom
//
// src/screens/battleView/useCoarseNow.test.jsx
//
// Review finding T3: the coarse clock's two promises — once a minute (never
// per second) and inert flag-off — had no executable guard.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useCoarseNow, { COARSE_NOW_INTERVAL_MS } from './useCoarseNow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let renders;

function Probe({ enabled }) {
  const now = useCoarseNow(enabled);
  renders.push(now.getTime());
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  renders = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = (enabled) => act(() => { root.render(<Probe enabled={enabled} />); });

describe('useCoarseNow', () => {
  it('is a 60-second clock: no update at 59 s, one at 60 s', () => {
    expect(COARSE_NOW_INTERVAL_MS).toBe(60_000);
    mount(true);
    const initial = renders.length;
    act(() => { vi.advanceTimersByTime(59_000); });
    expect(renders.length).toBe(initial);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(renders.length).toBe(initial + 1);
    expect(renders[renders.length - 1] - renders[0]).toBe(60_000);
  });

  it('never ticks per second: 59 one-second steps produce no render; ten minute steps produce ten', () => {
    mount(true);
    const initial = renders.length;
    for (let i = 0; i < 59; i += 1) act(() => { vi.advanceTimersByTime(1_000); });
    expect(renders.length - initial).toBe(0);
    for (let i = 0; i < 10; i += 1) act(() => { vi.advanceTimersByTime(60_000); });
    expect(renders.length - initial).toBe(10);
  });

  it('refreshes on visibilitychange (a tab coming back)', () => {
    mount(true);
    const initial = renders.length;
    act(() => { vi.advanceTimersByTime(30_000); });
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(renders.length).toBe(initial + 1);
    expect(renders[renders.length - 1] - renders[0]).toBe(30_000);
  });

  it('is inert flag-off: no interval, no listener, one render', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    mount(false);
    const initial = renders.length;
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(renders.length).toBe(initial);
    expect(addSpy.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(false);
    addSpy.mockRestore();
  });

  it('cleans up on unmount (no tick after)', () => {
    mount(true);
    act(() => root.unmount());
    root = createRoot(container); // keep afterEach's unmount valid
    const after = renders.length;
    act(() => { vi.advanceTimersByTime(5 * 60_000); });
    expect(renders.length).toBe(after);
  });
});
