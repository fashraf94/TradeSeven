// @vitest-environment jsdom
//
// Command Center hub, slice S4 (ruling R-S4-4; spec V1.2 §3, §8.3) — the Daily Regime Brief hook gains ONE field, additively: the
// cron's recorded `generatedAt`, as stored, or null when the document carries none. Its two legacy readers (CommandDashboard.jsx,
// desktop/ReadColumn.jsx) must be unchanged: every field they read keeps its name and its value, and neither file is touched.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleepReal } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `gate`: a promise the next read waits on before it answers (a read still in flight). `unmounted` is set by the rows that
// unmount the reader; `lateSetterCalls` counts the hook's state setters called after that (see the react mock below).
const fs = vi.hoisted(() => ({ snapshot: null, throws: false, reads: 0, gate: null, unmounted: false, lateSetterCalls: 0 }));
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => {
    fs.reads += 1;
    if (fs.gate) await fs.gate.promise;
    if (fs.throws) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    return fs.snapshot;
  }),
}));
// The hook's useState is the only one this file's components call (the rows' own bare setters use React.useState, below), so
// wrapping it counts exactly the setters the hook owns: setData, setLoading and setError. react-dom requires its own React,
// so there is still one React.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: function useState(initial) {
      const [value, set] = actual.useState(initial);
      const counted = (...args) => {
        if (fs.unmounted) fs.lateSetterCalls += 1;
        return set(...args);
      };
      return [value, counted];
    },
  };
});

import useDailyRegimeBrief from './useDailyRegimeBrief';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LEGACY_KEYS = ['dailyBrief', 'keyEvents', 'themes', 'forDate', 'isStale', 'loading', 'error', 'refetch'];
const doc = (data) => ({ exists: () => data !== null, data: () => data });

let host;
let root;
let seen;
function Probe() {
  seen.push(useDailyRegimeBrief());
  return null;
}
async function mountHook() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  seen = [];
  await act(async () => { root.render(<Probe />); });
  await act(async () => {});
  return seen[seen.length - 1];
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  fs.snapshot = null;
  fs.throws = false;
  fs.reads = 0;
  fs.gate = null;
  fs.unmounted = false;
  fs.lateSetterCalls = 0;
  vi.restoreAllMocks();
});

describe('generatedAt, additively', () => {
  it('returns the stored generatedAt as it is, beside every legacy field', async () => {
    const stamp = { seconds: 1791000000, nanoseconds: 0 };
    fs.snapshot = doc({ dailyBrief: 'Heavy macro week.', keyEvents: [{ t: 'CPI' }], themes: ['rates'], forDate: '2026-10-07', generatedAt: stamp, sourceFailures: ['x'] });
    const result = await mountHook();
    expect(result.generatedAt).toBe(stamp);
    expect(result).toMatchObject({ dailyBrief: 'Heavy macro week.', keyEvents: [{ t: 'CPI' }], themes: ['rates'], forDate: '2026-10-07', loading: false, error: null });
    expect(typeof result.refetch).toBe('function');
  });

  it('a document that carries no generatedAt gives null — never the time the page fetched it', async () => {
    fs.snapshot = doc({ dailyBrief: 'Heavy macro week.', forDate: '2026-10-07' });
    const result = await mountHook();
    expect(result.generatedAt).toBeNull();
  });

  it('no document at all: null brief, null generatedAt, empty lists (the legacy defaults)', async () => {
    fs.snapshot = doc(null);
    const result = await mountHook();
    expect(result).toMatchObject({ dailyBrief: null, forDate: null, generatedAt: null, keyEvents: [], themes: [], isStale: false, loading: false });
  });

  it('every legacy key is still returned, with the value it had, and the only new key is generatedAt', async () => {
    fs.snapshot = doc({ dailyBrief: 'b', forDate: '2020-01-02' });
    const result = await mountHook();
    expect(Object.keys(result).sort()).toEqual([...LEGACY_KEYS, 'generatedAt'].sort());
    expect(result.isStale).toBe(true);
    expect(result.forDate).toBe('2020-01-02');
  });

  it('a read that fails twice gives the legacy error and a null generatedAt', async () => {
    vi.useFakeTimers();
    try {
      fs.throws = true;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      seen = [];
      await act(async () => { root.render(<Probe />); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      const result = seen[seen.length - 1];
      expect(fs.reads).toBe(2);
      expect(result).toMatchObject({ error: 'unavailable', loading: false, generatedAt: null, dailyBrief: null });
    } finally {
      vi.useRealTimers();
    }
  });
});

// The S8 review's S8-13 (ruling R-S8F-4): after a failed first read the hook waits 1.5 s and reads once more. A reader that
// unmounts inside that wait (the hub, or either legacy shell) must not start that read afterwards.
describe('the one retry, and an unmount inside its wait (S8-13)', () => {
  it('an unmount during the 1.5 s wait starts no second read', async () => {
    vi.useFakeTimers();
    try {
      fs.throws = true;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      seen = [];
      await act(async () => { root.render(<Probe />); });
      expect(fs.reads).toBe(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(700); });
      act(() => root.unmount());
      root = null;
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(fs.reads).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still mounted, the retry runs once and its answer is shown (the retry itself is unchanged)', async () => {
    vi.useFakeTimers();
    try {
      fs.throws = true;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      seen = [];
      await act(async () => { root.render(<Probe />); });
      fs.throws = false;
      fs.snapshot = doc({ dailyBrief: 'Second try.', forDate: '2026-10-07' });
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(fs.reads).toBe(2);
      expect(seen[seen.length - 1]).toMatchObject({ dailyBrief: 'Second try.', error: null, loading: false });
    } finally {
      vi.useRealTimers();
    }
  });
});

// Film Room's report on PR #1003 (run 40821686892): "ReferenceError: window is not defined" at dispatchSetState <- this hook's
// `finally { setLoading(false) }`, under CommandCenterHub.s8.jsdom.test.jsx. S8-13's aliveRef stopped the retry after an unmount,
// but the `finally` and the setters after an await still ran: once a test file's environment was torn down, React's update path
// (it reads `window.event`) threw. So: after the reader unmounts, the hook calls no state setter, on any of its three paths.
describe('an unmount before the read answers: no state update after it (the #1003 CI flake)', () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  };
  const mountProbe = async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    seen = [];
    await act(async () => { root.render(<Probe />); });
  };
  const unmountProbe = () => {
    act(() => root.unmount());
    root = null;
    fs.unmounted = true;
  };
  /** Fake timers on; the first read fails and the reader is gone 700 ms into the 1.5 s wait. */
  const unmountInsideTheWait = async () => {
    fs.throws = true;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mountProbe();
    expect(fs.reads).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    unmountProbe();
    return logged;
  };

  it('the first read fails, the reader unmounts inside the 1.5 s wait, the timers run: no setter is called after the unmount', async () => {
    vi.useFakeTimers();
    try {
      const logged = await unmountInsideTheWait();
      await vi.advanceTimersByTimeAsync(2000);
      expect(fs.reads).toBe(1);
      expect(logged).toHaveBeenCalledTimes(1);
      expect(fs.lateSetterCalls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the read is still out when the reader unmounts and then answers: setData and setLoading are not called', async () => {
    fs.snapshot = doc({ dailyBrief: 'Too late.', forDate: '2026-10-07' });
    fs.gate = deferred();
    await mountProbe();
    expect(fs.reads).toBe(1);
    unmountProbe();
    fs.gate.resolve();
    await sleepReal(10);
    expect(fs.lateSetterCalls).toBe(0);
  });

  it('the retry is out when the reader unmounts and then fails: setError and setLoading are not called, and the retry still logs', async () => {
    vi.useFakeTimers();
    try {
      fs.throws = true;
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      await mountProbe();
      fs.gate = deferred();
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(fs.reads).toBe(2);
      unmountProbe();
      fs.gate.resolve();
      await vi.advanceTimersByTimeAsync(10);
      expect(logged).toHaveBeenCalledTimes(2);
      expect(logged.mock.calls[1][0]).toContain('Firestore read failed (retry)');
      expect(fs.lateSetterCalls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // The CI shape itself: the test file's environment is gone when the late update lands. Vitest deletes the jsdom globals at
  // teardown, so `window` is not a binding at all there; deleting it here reproduces that, and React's update path then throws.
  const tearDownWindow = () => {
    const kept = Object.getOwnPropertyDescriptor(globalThis, 'window');
    delete globalThis.window;
    return () => Object.defineProperty(globalThis, 'window', kept);
  };
  /** Runs `scenario`, then gives Node a real turn to report any rejection nobody awaited; returns the reasons (the vitest-designed-unhandled-rejection swap). */
  const unhandledDuring = async (scenario) => {
    const vitestListeners = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    const reasons = [];
    const collect = (reason) => { reasons.push(reason); };
    process.on('unhandledRejection', collect);
    try {
      await scenario();
      await sleepReal(20);
    } finally {
      process.removeListener('unhandledRejection', collect);
      for (const listener of vitestListeners) process.on('unhandledRejection', listener);
    }
    return reasons;
  };

  it('control: with the window gone, a state update after an unmount is the CI error ("window is not defined")', async () => {
    let bareSetter;
    function Bare() {
      const [, set] = React.useState(0);
      bareSetter = set;
      return null;
    }
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Bare />); });
    act(() => root.unmount());
    root = null;
    const restoreWindow = tearDownWindow();
    try {
      expect(() => bareSetter(1)).toThrow(/window is not defined/);
    } finally {
      restoreWindow();
    }
  });

  it('the CI shape: unmounted inside the wait, the environment torn down, the timers run — no unhandled error follows', async () => {
    vi.useFakeTimers();
    try {
      await unmountInsideTheWait();
      const reasons = await unhandledDuring(async () => {
        const restoreWindow = tearDownWindow();
        try {
          await vi.advanceTimersByTimeAsync(2000);
        } finally {
          restoreWindow();
        }
      });
      expect(reasons.map(String)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the two legacy readers are unchanged and read only fields that already existed', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const read = (rel) => readFileSync(path.join(HERE, '..', rel), 'utf8').replace(/\r\n/g, '\n');
  it.each(['components/Dashboard/CommandDashboard.jsx', 'components/Dashboard/desktop/ReadColumn.jsx'])('%s reads drb.<legacy field> only', (rel) => {
    const fields = [...new Set([...read(rel).matchAll(/\bdrb\.(\w+)/g)].map((m) => m[1]))];
    expect(fields.length).toBeGreaterThan(3);
    for (const field of fields) expect(LEGACY_KEYS, `${rel} reads drb.${field}`).toContain(field);
    expect(fields).not.toContain('generatedAt');
  });
});
