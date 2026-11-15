// api/_utils/evalMarketData.test.js
//
// Capacity Build 1, Part 3 — the evaluator's market-data cuts, module level
// (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md). The REAL marketDataCache
// runs; only the network (global fetch) and Firestore are doubles. Rows:
//   · /eod/ once per symbol per ET session, across checks, battles and a cold
//     instance; the quote every time;
//   · the result is what the evaluator's daily+price call returned;
//   · a new session refetches;
//   · a NARROW document (window stamp ≠ 90, or < 55 rows) or a stale stamp is
//     never used;
//   · a series missing the prior-session bar is never stored: every check
//     fetches, as before;
//   · a failed or hung session read falls back to the fetch as it was;
//   · a FAILED quote takes its fallback close from FRESH bars, never from the
//     stored series;
//   · crypto keys on the UTC day; the first fetch is single-flight;
//   · the run's macro share: once per run, a deep per-battle copy with the
//     run fetch's instant, never for a symbol the battle owns.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => undefined }) }) }) }),
}));

const mod = await import('./evalMarketData.js');
const {
  fetchEvalSymbolData, sessionDailySeries, resetSessionDailyMemo, sessionKeyFor, expectedPriorBarDate,
  prepareRunMarketShare, sharedMacroQuote, SESSION_DAILY_COLLECTION, SESSION_DAILY_MIN_ROWS, SESSION_DAILY_IO_TIMEOUT_MS,
} = mod;
const { getStockAnalysisData, DAILY_WINDOW_CALENDAR_DAYS } = await import('./marketDataCache.js');
const { selectPriorSessionBar } = await import('./baselineValidation.js');

const realFetch = globalThis.fetch;
const MON = new Date('2026-11-16T15:00:00.000Z'); // Monday, 10:00 ET; previous session Fri 2026-11-13
const TUE = new Date('2026-11-17T15:00:00.000Z'); // previous session Mon 2026-11-16

/** `n` weekday bars, newest first, ending on `endDate`, in EODHD's own field names. */
function eodRows(endDate, n = 62, { closeOf = (i) => 100 + i } = {}) {
  const rows = [];
  let t = Date.parse(`${endDate}T12:00:00Z`);
  while (rows.length < n) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const c = closeOf(rows.length);
      rows.push({ date: d.toISOString().slice(0, 10), open: c, high: c + 1, low: c - 1, close: c, adjusted_close: c, volume: 1000 });
    }
    t -= 86_400_000;
  }
  return rows;
}
const RT = (close = 150) => ({ code: 'X', timestamp: 1, open: close, high: close, low: close, close, volume: 1, previousClose: close - 1, change: 1, change_p: 0.7 });

/** The network: `eod[sym]` rows (or a status number), `rt[sym]` body (or a status). Counts by endpoint and symbol. */
function stubNetwork(net) {
  const counts = { eod: {}, rt: {} };
  globalThis.fetch = vi.fn(async (url) => {
    const m = /\/api\/(real-time|eod)\/([^?]+)\?/.exec(String(url));
    const kind = m[1] === 'eod' ? 'eod' : 'rt';
    const sym = decodeURIComponent(m[2]);
    counts[kind][sym] = (counts[kind][sym] || 0) + 1;
    const entry = (kind === 'eod' ? net.eod : net.rt)[sym];
    const value = typeof entry === 'function' ? entry() : entry;
    if (value === undefined) return new Response('{}', { status: 404 });
    if (typeof value === 'number') return new Response('{}', { status: value });
    return new Response(JSON.stringify(value), { status: 200 });
  });
  return counts;
}

/** The session store: a Map per document id; `reads`/`writes` recorded; `getError`/`getHang` per row. */
function makeStoreDb({ getError = null, getHang = false } = {}) {
  const docs = new Map();
  const reads = [];
  const writes = [];
  const db = {
    collection(col) {
      expect(col).toBe(SESSION_DAILY_COLLECTION);
      return {
        doc: (id) => ({
          get: async () => {
            reads.push(id);
            if (getHang) return new Promise(() => {});
            if (getError) throw getError;
            return { exists: docs.has(id), data: () => JSON.parse(JSON.stringify(docs.get(id))) };
          },
          set: async (data) => { writes.push(id); docs.set(id, JSON.parse(JSON.stringify(data))); },
        }),
      };
    },
    __docs: docs, __reads: reads, __writes: writes,
  };
  return db;
}

let savedKey;
beforeEach(() => {
  resetSessionDailyMemo();
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = 'test-key';
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

const BOTH = { forceRefresh: true, fields: ['daily', 'price'] };
const strip = ({ fetchedAt, ...rest }) => rest; // the call instant differs by construction

describe('session keys', () => {
  it('a stock keys on the ET date and expects the previous NYSE session; crypto on the UTC day and expects yesterday', () => {
    const s = sessionKeyFor('BRK.B', MON);
    expect(s).toMatchObject({ eodSymbol: 'BRK-B.US', etDate: '2026-11-16', cutoffDate: '2026-11-16', docId: 'BRK-B.US_2026-11-16' });
    expect(expectedPriorBarDate(s)).toBe('2026-11-13');
    const c = sessionKeyFor('BTC-USD.CC', MON);
    expect(c).toMatchObject({ eodSymbol: 'BTC-USD.CC', isCrypto: true, cutoffDate: '2026-11-16', docId: 'BTC-USD.CC_2026-11-16' });
    expect(expectedPriorBarDate(c)).toBe('2026-11-15');
  });
});

describe('daily bars once per symbol per ET session', () => {
  it('across checks, concurrent battles and a cold instance: ONE /eod/, a quote every time', async () => {
    const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': RT() } });
    const db = makeStoreDb();
    await fetchEvalSymbolData(db, 'AAPL', MON);
    await Promise.all([fetchEvalSymbolData(db, 'AAPL', MON), fetchEvalSymbolData(db, 'AAPL', MON)]);
    resetSessionDailyMemo(); // a cold instance: the process memo is gone, the document is not
    await fetchEvalSymbolData(db, 'AAPL', MON);
    expect(counts.eod['AAPL.US']).toBe(1);
    expect(counts.rt['AAPL.US']).toBe(4);
    expect(db.__writes).toEqual(['AAPL.US_2026-11-16']);
    const doc = db.__docs.get('AAPL.US_2026-11-16');
    expect(doc).toMatchObject({ eodSymbol: 'AAPL.US', etDate: '2026-11-16', cutoffDate: '2026-11-16', priorBarDate: '2026-11-13', windowDays: DAILY_WINDOW_CALENDAR_DAYS, rowCount: 62 });
  });

  it('the first fetch of a symbol is single-flight: two concurrent first checks make one /eod/', async () => {
    const counts = stubNetwork({ eod: { 'MSFT.US': eodRows('2026-11-13') }, rt: { 'MSFT.US': RT() } });
    const db = makeStoreDb();
    await Promise.all([fetchEvalSymbolData(db, 'MSFT', MON), fetchEvalSymbolData(db, 'MSFT', MON)]);
    expect(counts.eod['MSFT.US']).toBe(1);
    expect(db.__writes).toHaveLength(1);
  });

  it('the result is what the evaluator\'s daily+price call returned — the quote, the bars, Guard 2\'s bar', async () => {
    stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': RT(151.5) } });
    const today = strip(await getStockAnalysisData('AAPL', BOTH));
    const db = makeStoreDb();
    const first = strip(await fetchEvalSymbolData(db, 'AAPL', MON)); // fetched the series itself
    const later = strip(await fetchEvalSymbolData(db, 'AAPL', MON)); // served from the series
    expect(first.price).toEqual(today.price);
    expect(later.price).toEqual(today.price);
    expect(first.daily).toEqual(today.daily);
    expect(later.daily).toEqual(today.daily);
    expect(selectPriorSessionBar(later.daily, '2026-11-16')).toEqual(selectPriorSessionBar(today.daily, '2026-11-16'));
  });

  it('a new session refetches', async () => {
    let end = '2026-11-13';
    const counts = stubNetwork({ eod: { 'AAPL.US': () => eodRows(end) }, rt: { 'AAPL.US': RT() } });
    const db = makeStoreDb();
    await fetchEvalSymbolData(db, 'AAPL', MON);
    await fetchEvalSymbolData(db, 'AAPL', MON);
    end = '2026-11-16';
    await fetchEvalSymbolData(db, 'AAPL', TUE);
    await fetchEvalSymbolData(db, 'AAPL', TUE);
    expect(counts.eod['AAPL.US']).toBe(2);
    expect(db.__writes).toEqual(['AAPL.US_2026-11-16', 'AAPL.US_2026-11-17']);
  });

  it('a series MISSING the prior-session bar is never stored: every check fetches, as before', async () => {
    const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-12') }, rt: { 'AAPL.US': RT() } });
    const db = makeStoreDb();
    const today = strip(await getStockAnalysisData('AAPL', BOTH));
    const a = strip(await fetchEvalSymbolData(db, 'AAPL', MON));
    const b = strip(await fetchEvalSymbolData(db, 'AAPL', MON));
    expect(counts.eod['AAPL.US']).toBe(3); // today's call + one per check
    expect(db.__writes).toEqual([]);
    expect(a.daily).toEqual(today.daily);
    expect(b.price).toEqual(today.price);
  });
});

describe('a NARROW or foreign document is never used', () => {
  const seed = (db, patch) => {
    const rows = eodRows('2026-11-13').map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, rawClose: r.close, volume: r.volume }));
    db.__docs.set('AAPL.US_2026-11-16', { eodSymbol: 'AAPL.US', etDate: '2026-11-16', cutoffDate: '2026-11-16', windowDays: DAILY_WINDOW_CALENDAR_DAYS, rowCount: rows.length, rows, ...patch(rows) });
  };
  const cases = {
    'a 30-day window stamp': () => ({ windowDays: 30 }),
    [`fewer than ${SESSION_DAILY_MIN_ROWS} rows (the old 30-day payload)`]: (rows) => ({ rows: rows.slice(0, 21), rowCount: 21 }),
    'no window stamp at all': () => ({ windowDays: undefined }),
    'another session\'s stamp': () => ({ etDate: '2026-11-13' }),
    'another symbol\'s stamp': () => ({ eodSymbol: 'AAPL.MX' }),
    'a series without the prior-session bar': (rows) => ({ rows: rows.slice(1) }),
  };
  for (const [name, patch] of Object.entries(cases)) {
    it(`${name} → fetched fresh, and replaced by a full series`, async () => {
      const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13', 62, { closeOf: (i) => 200 + i }) }, rt: { 'AAPL.US': RT() } });
      const db = makeStoreDb();
      seed(db, patch);
      const out = await fetchEvalSymbolData(db, 'AAPL', MON);
      expect(counts.eod['AAPL.US']).toBe(1);
      expect(out.daily[0].close).toBe(200); // the fresh series, not the stored one
      expect(db.__docs.get('AAPL.US_2026-11-16').windowDays).toBe(DAILY_WINDOW_CALENDAR_DAYS);
      expect(db.__docs.get('AAPL.US_2026-11-16').rowCount).toBe(62);
    });
  }
});

describe('a failed session read falls back to the fetch as it was', () => {
  it('a read that throws: this check fetches, and gets what the daily+price call returns', async () => {
    const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': RT() } });
    const today = strip(await getStockAnalysisData('AAPL', BOTH));
    const db = makeStoreDb({ getError: new Error('14 UNAVAILABLE') });
    const out = strip(await fetchEvalSymbolData(db, 'AAPL', MON));
    expect(out.price).toEqual(today.price);
    expect(out.daily).toEqual(today.daily);
    expect(counts.eod['AAPL.US']).toBe(2);
  });

  it(`a read that hangs is bounded at ${SESSION_DAILY_IO_TIMEOUT_MS} ms, then the check fetches`, async () => {
    vi.useFakeTimers();
    const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': RT() } });
    const db = makeStoreDb({ getHang: true });
    let out = null;
    fetchEvalSymbolData(db, 'AAPL', MON).then((r) => { out = r; });
    await vi.advanceTimersByTimeAsync(SESSION_DAILY_IO_TIMEOUT_MS - 1);
    expect(out).toBeNull();
    expect(counts.eod['AAPL.US']).toBeUndefined();
    await vi.advanceTimersByTimeAsync(SESSION_DAILY_IO_TIMEOUT_MS + 10);
    expect(out?.price?.current).toBe(150);
    expect(counts.eod['AAPL.US']).toBe(1);
  });

  it('a waiter on a first fetch that came back unusable fetches for itself (daily+price), as before', async () => {
    const counts = stubNetwork({ eod: { 'AAPL.US': 503 }, rt: { 'AAPL.US': RT() } });
    const db = makeStoreDb();
    const [a, b] = await Promise.all([fetchEvalSymbolData(db, 'AAPL', MON), fetchEvalSymbolData(db, 'AAPL', MON)]);
    expect(a.daily).toBeUndefined();
    expect(b.daily).toBeUndefined();
    expect(a.price.current).toBe(150);
    expect(counts.eod['AAPL.US']).toBe(2); // the first caller's, and the waiter's own daily+price call
  });
});

describe('a FAILED quote takes its fallback from FRESH bars, never the stored series', () => {
  it('served from the series, then the quote fails: the fallback is the fresh newest close (= today\'s call)', async () => {
    let closeBase = 100;
    let rtStatus = 200;
    const counts = stubNetwork({
      eod: { 'AAPL.US': () => eodRows('2026-11-13', 62, { closeOf: (i) => closeBase + i }) },
      rt: { 'AAPL.US': () => (rtStatus === 200 ? RT() : rtStatus) },
    });
    const db = makeStoreDb();
    await fetchEvalSymbolData(db, 'AAPL', MON); // the series: newest close 100
    closeBase = 300; // /eod/ now answers differently (a same-day row would, if EODHD sent one)
    rtStatus = 503;
    const today = strip(await getStockAnalysisData('AAPL', BOTH));
    const out = strip(await fetchEvalSymbolData(db, 'AAPL', MON));
    expect(today.price).toEqual({ current: 300, fallback: true });
    expect(out.price).toEqual(today.price);
    expect(out.daily).toEqual(today.daily); // Guard 2 reads the same fresh bars on this path
    expect(counts.eod['AAPL.US']).toBe(3);
  });

  it('the caller that fetched the series in this check uses THOSE bars for its fallback — no second /eod/', async () => {
    const counts = stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': 503 } });
    const db = makeStoreDb();
    const out = await fetchEvalSymbolData(db, 'AAPL', MON);
    expect(out.price).toEqual({ current: 100, fallback: true });
    expect(counts.eod['AAPL.US']).toBe(1);
  });

  it('a 200 with an unusable price still sets NO price and no fallback (as today)', async () => {
    stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: { 'AAPL.US': { ...RT(), close: 'NA', previousClose: 'NA' } } });
    const today = strip(await getStockAnalysisData('AAPL', BOTH));
    const db = makeStoreDb();
    await fetchEvalSymbolData(db, 'AAPL', MON);
    const out = strip(await fetchEvalSymbolData(db, 'AAPL', MON));
    expect(today.price).toBeUndefined();
    expect(out.price).toBeUndefined();
  });
});

describe('crypto keys on the UTC day', () => {
  it('BTC-USD.CC is reused when its series holds yesterday (UTC)', async () => {
    const rows = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(Date.parse('2026-11-15T12:00:00Z') - i * 86_400_000).toISOString().slice(0, 10);
      rows.push({ date: d, open: 1, high: 2, low: 0.5, close: 1.5, adjusted_close: 1.5, volume: 1 });
    }
    const counts = stubNetwork({ eod: { 'BTC-USD.CC': rows }, rt: { 'BTC-USD.CC': RT(67000) } });
    const db = makeStoreDb();
    await fetchEvalSymbolData(db, 'BTC-USD.CC', MON);
    await fetchEvalSymbolData(db, 'BTC-USD.CC', MON);
    expect(counts.eod['BTC-USD.CC']).toBe(1);
    expect(db.__docs.get('BTC-USD.CC_2026-11-16').priorBarDate).toBe('2026-11-15');
  });
});

describe('the run\'s shared macro quotes', () => {
  const macroNet = () => stubNetwork({
    eod: { 'SPY.US': eodRows('2026-11-13'), 'QQQ.US': eodRows('2026-11-13'), 'BTC-USD.CC': 503 },
    rt: { 'SPY.US': RT(560), 'QQQ.US': RT(480), 'BTC-USD.CC': RT(67000) },
  });

  it('fetched ONCE per run; each battle gets a deep copy stamped with the run fetch\'s instant', async () => {
    const counts = macroNet();
    const db = makeStoreDb();
    const run = {};
    await prepareRunMarketShare(db, run, MON);
    expect(counts.rt['SPY.US']).toBe(1);
    const a = sharedMacroQuote(run, 'SPY', new Set());
    const b = sharedMacroQuote(run, 'SPY', new Set());
    expect(a.data.price.current).toBe(560);
    expect(Number.isFinite(a.fetchedAtMs)).toBe(true);
    expect(b.fetchedAtMs).toBe(a.fetchedAtMs);
    a.data.price.current = -1;
    a.data.daily.push({ junk: true });
    expect(b.data.price.current).toBe(560); // battle A's copy never reaches battle B
    expect(sharedMacroQuote(run, 'SPY', new Set()).data.daily).toHaveLength(62);
    for (let i = 0; i < 5; i++) sharedMacroQuote(run, 'QQQ', null);
    expect(counts.rt['QQQ.US']).toBe(1); // handing out copies fetches nothing
  });

  it('never for a symbol the battle holds, benches or scores, never for a non-macro, never without a run share', async () => {
    macroNet();
    const run = {};
    await prepareRunMarketShare(makeStoreDb(), run, MON);
    expect(sharedMacroQuote(run, 'SPY', new Set(['SPY']))).toBeNull();
    expect(sharedMacroQuote(run, 'AAPL', new Set())).toBeNull();
    expect(sharedMacroQuote({}, 'SPY', new Set())).toBeNull();
    expect(sharedMacroQuote(null, 'SPY', new Set())).toBeNull();
  });

  it('a symbol the run could not price is not shared — each battle fetches its own', async () => {
    const counts = stubNetwork({ eod: {}, rt: { 'SPY.US': 503, 'QQQ.US': RT(480), 'BTC-USD.CC': RT(67000) } });
    const run = {};
    await prepareRunMarketShare(makeStoreDb(), run, MON);
    expect(counts.rt['SPY.US']).toBe(1);
    expect(sharedMacroQuote(run, 'SPY', new Set())).toBeNull();
    expect(sharedMacroQuote(run, 'QQQ', new Set())).not.toBeNull();
  });

  it('the copy is what a per-battle fetch would have returned (price and bars)', async () => {
    macroNet();
    const db = makeStoreDb();
    const run = {};
    await prepareRunMarketShare(db, run, MON);
    const own = strip(await fetchEvalSymbolData(db, 'SPY', MON));
    const shared = strip(sharedMacroQuote(run, 'SPY', new Set()).data);
    expect(shared.price).toEqual(own.price);
    expect(shared.daily).toEqual(own.daily);
  });
});

describe('sessionDailySeries — the contract the fetch relies on', () => {
  it('first caller: fetchedHere with its rows; later caller: rows from the memo, not fetchedHere', async () => {
    stubNetwork({ eod: { 'AAPL.US': eodRows('2026-11-13') }, rt: {} });
    const db = makeStoreDb();
    const first = await sessionDailySeries(db, 'AAPL', MON);
    const later = await sessionDailySeries(db, 'AAPL', MON);
    expect(first.fetchedHere).toBe(true);
    expect(later.fetchedHere).toBe(false);
    expect(later.rows).toEqual(first.rows);
  });
});
