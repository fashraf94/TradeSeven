// api/_utils/eodhdFetchGuard.test.js
//
// Capacity Build 1, Part 2 — the EODHD fetch guard, and the EODHD counters of
// Part 4 (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md). The flag is a getter
// each row sets, so both states run against one module graph.
//
//   · flag off is the bare request: the promise `fetch(url)` returned, one
//     argument, no signal; counting never touches the body or the rejection;
//   · flag on: a hung request — headers OR body — is aborted at 10 s (fake
//     timers); the clock starts at dispatch, not in the queue; the limiter
//     never exceeds 32 under 200 concurrent calls, and reaches 32;
//   · a timeout reaches the SAME path a network error reaches, through the
//     real getStockAnalysisData: the daily path (no bars on a forced call; the
//     stale fallback on a cached call) and the real-time path (the existing
//     `fallback: true` daily close on a daily+price call; no price on a
//     price-only call) — compared field for field with a network error.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ guard: false }));
const cache = vi.hoisted(() => ({ docs: new Map() }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EODHD_FETCH_GUARD_ENABLED() { return flags.guard; },
}));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: cache.docs.has(id), data: () => cache.docs.get(id) }),
        set: async () => {},
      }),
    }),
  }),
}));

const guard = await import('./eodhdFetchGuard.js');
const { eodhdFetch, readEodhdCounters, eodhdCounterDelta, readEodhdGuardState, EODHD_FETCH_TIMEOUT_MS, EODHD_FETCH_CONCURRENCY, EODHD_TIMEOUT_ERROR_NAME } = guard;
const { getStockAnalysisData } = await import('./marketDataCache.js');

const realFetch = globalThis.fetch;
const KEY = 'test-eodhd-key-do-not-log';
let savedKey;

beforeEach(() => {
  flags.guard = false;
  cache.docs.clear();
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = KEY;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetch that never answers until its signal aborts (as undici does). */
const hungFetch = () => vi.fn((url, init) => new Promise((_, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')));
}));

describe('flag OFF — the bare request, counted', () => {
  it('returns the very promise fetch(url) returned; fetch gets exactly ONE argument; no signal', async () => {
    const response = json({ ok: 1 });
    const pending = Promise.resolve(response);
    globalThis.fetch = vi.fn(() => pending);
    const out = eodhdFetch('https://eodhd.com/api/eod/AAPL.US?x=1', 'eod');
    expect(out).toBe(pending);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0]).toEqual(['https://eodhd.com/api/eod/AAPL.US?x=1']);
    expect(await out).toBe(response);
  });

  it('a rejection is the SAME error object, and is not swallowed', async () => {
    const boom = new TypeError('fetch failed');
    globalThis.fetch = vi.fn(() => Promise.reject(boom));
    await expect(eodhdFetch('https://eodhd.com/api/real-time/AAPL.US', 'realTime')).rejects.toBe(boom);
  });

  it('counts requests by kind and non-2xx by class (429, 5xx, other); 2xx is not a non-2xx', async () => {
    const before = readEodhdCounters();
    const statuses = [200, 429, 503, 404, 200];
    let i = 0;
    globalThis.fetch = vi.fn(async () => json({}, statuses[i++]));
    for (const kind of ['eod', 'realTime', 'intraday', 'other', 'nonsense']) await eodhdFetch('https://eodhd.com/api/x', kind);
    await Promise.resolve();
    const delta = eodhdCounterDelta(before, readEodhdCounters());
    expect(delta).toEqual({
      requests: { eod: 1, realTime: 1, intraday: 1, other: 2 },
      timeouts: 0,
      non2xx: { 429: 1, '5xx': 1, other: 1 },
    });
  });

  it('a hung request is NOT bounded with the flag off (today\'s behaviour, unchanged)', async () => {
    vi.useFakeTimers();
    globalThis.fetch = hungFetch();
    let settled = false;
    eodhdFetch('https://eodhd.com/api/eod/X.US', 'eod').then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(EODHD_FETCH_TIMEOUT_MS * 3);
    expect(settled).toBe(false);
  });

  it('eodhdCounterDelta reads a missing "before" as zeros and never throws', () => {
    expect(eodhdCounterDelta(null, null)).toEqual({ requests: { eod: 0, realTime: 0, intraday: 0, other: 0 }, timeouts: 0, non2xx: { 429: 0, '5xx': 0, other: 0 } });
  });
});

describe('flag ON — the 10 s timeout', () => {
  it('the bound is 10 s (the intraday poller\'s precedent), and the cap 32', () => {
    expect(EODHD_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(EODHD_FETCH_CONCURRENCY).toBe(32);
  });

  it('a request that never answers is aborted at 10 s, not before; it throws EodhdTimeoutError and is counted', async () => {
    flags.guard = true;
    vi.useFakeTimers();
    globalThis.fetch = hungFetch();
    const before = readEodhdCounters();
    let outcome = null;
    eodhdFetch('https://eodhd.com/api/eod/X.US', 'eod').then(() => { outcome = 'ok'; }, (e) => { outcome = e; });
    await vi.advanceTimersByTimeAsync(EODHD_FETCH_TIMEOUT_MS - 1);
    expect(outcome).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.name).toBe(EODHD_TIMEOUT_ERROR_NAME);
    expect(eodhdCounterDelta(before, readEodhdCounters()).timeouts).toBe(1);
    expect(globalThis.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(readEodhdGuardState()).toEqual({ active: 0, queued: 0 }); // the slot is released
  });

  it('a body that never ends is aborted too — the caller\'s response.json() cannot hang', async () => {
    flags.guard = true;
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (url, init) => new Response(new ReadableStream({
      start(controller) { init.signal.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError'))); },
    }), { status: 200 }));
    let outcome = null;
    eodhdFetch('https://eodhd.com/api/eod/X.US', 'eod').then(() => { outcome = 'ok'; }, (e) => { outcome = e; });
    await vi.advanceTimersByTimeAsync(EODHD_FETCH_TIMEOUT_MS);
    expect(outcome?.name).toBe(EODHD_TIMEOUT_ERROR_NAME);
  });

  it('an answer inside the bound comes back as a usable response (status, ok, json)', async () => {
    flags.guard = true;
    globalThis.fetch = vi.fn(async () => json({ close: 12.5 }, 200));
    const response = await eodhdFetch('https://eodhd.com/api/real-time/X.US', 'realTime');
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ close: 12.5 });
    const bad = await (globalThis.fetch = vi.fn(async () => json({}, 503)), eodhdFetch('https://eodhd.com/api/real-time/X.US', 'realTime'));
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(503);
  });

  it('the clock starts at DISPATCH: a request that waited in the queue still gets its full 10 s', async () => {
    flags.guard = true;
    vi.useFakeTimers();
    // 32 requests hold every slot for 9 s; the 33rd waits, then takes 5 s itself (done at 14 s < 9 + 10).
    let n = 0;
    globalThis.fetch = vi.fn((url, init) => new Promise((resolve, reject) => {
      n += 1;
      const ms = n <= EODHD_FETCH_CONCURRENCY ? 9_000 : 5_000;
      const t = setTimeout(() => resolve(json({ n })), ms);
      init.signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
    }));
    const all = Array.from({ length: EODHD_FETCH_CONCURRENCY + 1 }, () => eodhdFetch('https://eodhd.com/api/eod/X.US', 'eod').then((r) => r.status, (e) => e.name));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(readEodhdGuardState()).toEqual({ active: 1, queued: 0 }); // the 33rd is now in flight
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await Promise.all(all)).toEqual(Array(EODHD_FETCH_CONCURRENCY + 1).fill(200));
  });
});

describe('flag ON — the process-wide limiter', () => {
  it(`never more than ${EODHD_FETCH_CONCURRENCY} in flight under 200 concurrent calls; reaches the cap; all complete`, async () => {
    flags.guard = true;
    expect(EODHD_FETCH_CONCURRENCY).toBe(32);
    vi.useFakeTimers();
    let active = 0;
    let peak = 0;
    globalThis.fetch = vi.fn(() => {
      active += 1;
      peak = Math.max(peak, active);
      const ms = 50 + ((active * 37) % 200);
      return new Promise((resolve) => setTimeout(() => { active -= 1; resolve(json({})); }, ms));
    });
    const calls = Array.from({ length: 200 }, (_, i) => eodhdFetch(`https://eodhd.com/api/eod/S${i}.US`, 'eod'));
    for (let t = 0; t < 40 && readEodhdGuardState().active + readEodhdGuardState().queued > 0; t++) {
      expect(readEodhdGuardState().active).toBeLessThanOrEqual(EODHD_FETCH_CONCURRENCY);
      await vi.advanceTimersByTimeAsync(100);
    }
    const results = await Promise.all(calls);
    expect(results).toHaveLength(200);
    expect(peak).toBe(EODHD_FETCH_CONCURRENCY);
    expect(globalThis.fetch).toHaveBeenCalledTimes(200);
    expect(readEodhdGuardState()).toEqual({ active: 0, queued: 0 });
  });
});

// ---------------------------------------------------------------------------
// A timeout reaches the same path a network error reaches (real getStockAnalysisData)

const RT = { code: 'ZZZ.US', timestamp: 1792006920, open: 10, high: 11, low: 9, close: 10.5, volume: 1000, previousClose: 10, change: 0.5, change_p: 5 };
const EOD = [
  { date: '2026-11-13', open: 10, high: 10.2, low: 9.8, close: 10, adjusted_close: 10, volume: 100 },
  { date: '2026-11-12', open: 9.9, high: 10.1, low: 9.7, close: 9.95, adjusted_close: 9.95, volume: 100 },
];

/** EODHD double: `fail` = 'network' | 'timeout' | null for the endpoint named by `on`. */
function eodhdDouble({ on, fail }) {
  return vi.fn((url, init) => {
    const endpoint = /\/api\/(real-time|eod)\//.exec(String(url))?.[1];
    if (endpoint === on && fail === 'network') return Promise.reject(new TypeError('fetch failed'));
    if (endpoint === on && fail === 'timeout') {
      return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    return Promise.resolve(json(endpoint === 'eod' ? EOD : RT));
  });
}

async function outcome({ on, fail, opts }) {
  globalThis.fetch = eodhdDouble({ on, fail });
  vi.useFakeTimers();
  const p = getStockAnalysisData('ZZZ', opts);
  await vi.advanceTimersByTimeAsync(EODHD_FETCH_TIMEOUT_MS + 1);
  const result = await p;
  vi.useRealTimers();
  const { fetchedAt, errors, ...rest } = result; // the instant and the error TEXT differ by design
  return { ...rest, errorFields: Object.keys(errors).sort() };
}

describe('a timeout takes the network-error path, caller by caller', () => {
  beforeEach(() => { flags.guard = true; });

  it('daily on a FORCED call (the evaluator\'s): no bars either way — forceRefresh never fills a stale backup', async () => {
    const opts = { forceRefresh: true, fields: ['daily'] };
    const net = await outcome({ on: 'eod', fail: 'network', opts });
    const to = await outcome({ on: 'eod', fail: 'timeout', opts });
    expect(to).toEqual(net);
    expect(to.daily).toBeUndefined();
    expect(to.errorFields).toEqual(['daily']);
  });

  it('daily on a CACHED call with a stale document: the stale fallback either way', async () => {
    cache.docs.set('ZZZ_daily', { data: [{ date: '2026-01-02', close: 1, high: 1, low: 1 }], cachedAt: new Date('2026-01-02T00:00:00Z') });
    const opts = { fields: ['daily'] };
    const net = await outcome({ on: 'eod', fail: 'network', opts });
    const to = await outcome({ on: 'eod', fail: 'timeout', opts });
    expect(to).toEqual(net);
    expect(to.cacheStatus.daily).toBe('stale_fallback');
    expect(to.staleData).toBe(true);
  });

  it('real-time on a daily+price call: the existing fallback (latest daily close, fallback: true) either way — refused for held symbols by the quote guard', async () => {
    const opts = { forceRefresh: true, fields: ['daily', 'price'] };
    const net = await outcome({ on: 'real-time', fail: 'network', opts });
    const to = await outcome({ on: 'real-time', fail: 'timeout', opts });
    expect(to).toEqual(net);
    expect(to.price).toEqual({ current: 10, fallback: true });
  });

  it('real-time on a price-only call: no price either way', async () => {
    const opts = { forceRefresh: true, fields: ['price'] };
    const net = await outcome({ on: 'real-time', fail: 'network', opts });
    const to = await outcome({ on: 'real-time', fail: 'timeout', opts });
    expect(to).toEqual(net);
    expect(to.price).toBeUndefined();
  });
});
