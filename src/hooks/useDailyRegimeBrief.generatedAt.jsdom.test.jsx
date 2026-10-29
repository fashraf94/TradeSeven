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
import { afterEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ snapshot: null, throws: false, reads: 0 }));
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => {
    fs.reads += 1;
    if (fs.throws) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    return fs.snapshot;
  }),
}));

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
