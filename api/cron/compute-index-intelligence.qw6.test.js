// @vitest-environment node
//
// api/cron/compute-index-intelligence.qw6.test.js
//
// EODHD Quick Wins QW-6 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2):
// the cron's daily histories are fetched once per session date and reused.
//
// THE PROOF the prompt names: the outputs written to indexIntelligence/* and
// stockTechnicalScores/* are IDENTICAL whether the histories come from the
// per-session store or a fresh fetch, given the same bars. This file drives the
// REAL handler end to end (the other suites beside it say the handler "cannot
// be exercised here" — this harness is the first that does): firebase-admin is
// an in-memory fake that records every batch write, the vendor is a stub that
// serves deterministic bars and quotes and counts requests, and the clock is
// pinned (Wed 2026-10-07, prior session Tue 2026-10-06) so every timestamp the
// cron stamps is the same in every run. The stock universe is cut to 12 names
// (rankingConfig ALL_TICKERS, mocked through importOriginal) to keep the run
// short; every index, sector ETF and TNX is real.
//
//   run A — flag OFF: today's path, every history fetched;
//   run B — flag ON, store cold: every history fetched AND stored;
//   run C — flag ON, store warm (the second pre-market wake, every hourly run):
//           ZERO history fetches;
// and the writes of A, B and C are deep-equal — including `droppedRows`, which
// a stored history replays. The same holds in intraday mode, where the live
// quotes are still fetched every run.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { isMarketHoliday } from '../../src/utils/marketCalendar.js';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get EODHD_QUICK_WINS_ENABLED() { return flag.on; } };
});
vi.mock('../_utils/rankingConfig.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, ALL_TICKERS: real.ALL_TICKERS.slice(0, 12) };
});

// ── firebase-admin: an in-memory store that records the cron's writes ───────
const fs = vi.hoisted(() => ({ docs: new Map(), writes: [] }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => {}, cert: () => ({}) }));
vi.mock('firebase-admin/firestore', () => {
  // Real Firestore returns map fields in key order, not insertion order: the
  // fake sorts on read so a stored history comes back the way production
  // would hand it back.
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
    : v && typeof v === 'object' && !(v instanceof Date)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
  const ref = (col, id) => ({
    path: `${col}/${id}`,
    get: async () => {
      const v = fs.docs.get(`${col}/${id}`);
      return { exists: v !== undefined, data: () => (v === undefined ? undefined : sortKeys(structuredClone(v))) };
    },
    set: async (d) => { fs.docs.set(`${col}/${id}`, structuredClone(d)); },
  });
  const db = {
    collection: (col) => ({
      doc: (id) => ref(col, id),
      where: (field, op, values) => ({
        get: async () => {
          const hits = [...fs.docs.entries()]
            .filter(([p, d]) => p.startsWith(`${col}/`) && op === 'in' && values.includes(d[field]))
            .map(([, d]) => ({ data: () => structuredClone(d) }));
          return { docs: hits, forEach: (fn) => hits.forEach(fn) };
        },
      }),
    }),
    batch: () => {
      const pending = [];
      return {
        set: (r, d) => { pending.push([r.path, structuredClone(d)]); },
        commit: async () => { for (const [p, d] of pending) { fs.writes.push([p, d]); fs.docs.set(p, d); } },
      };
    },
  };
  return {
    getFirestore: () => db,
    FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
    Timestamp: { fromMillis: (ms) => ({ __timestampMs: ms }) },
  };
});

// ── The vendor: deterministic bars per symbol, quotes for intraday mode ─────
const PRIOR = '2026-10-06';
function seedOf(sym) { let h = 7; for (const c of sym) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; }
// The vendor's newest bar: PRIOR unless a test makes it time-aware (E3-1 rows).
const vendorClock = { newest: () => PRIOR };
// A bar is a function of its DATE (never of its position in the answer), and
// NYSE holidays have none — so two answers that end on different days carry the
// SAME bar for every date they share, as the real vendor does (review E5-1: a
// position-derived stub and a Thanksgiving bar let the prior-close check mask
// the after-close rule).
function rawBarsOldestFirst(sym, newestDate = vendorClock.newest()) {
  const s = seedOf(sym);
  const out = [];
  const d = new Date(`${newestDate}T12:00:00Z`);
  while (out.length < 380) {
    const dow = d.getUTCDay();
    const date = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !isMarketHoliday(date)) {
      const k = Math.round(d.getTime() / 86_400_000); // absolute day index
      const close = +(40 + (s % 60) + Math.sin((k + s) / 7) * 6 + Math.cos(k / 17) * 3 + (k % 400) * 0.01).toFixed(2);
      // One malformed row (AAPL, XLK) that trips mapDailyRows' drop rule, so
      // droppedRows is non-zero and its replay from the store is actually tested.
      const malformed = (sym === 'AAPL.US' || sym === 'XLK.US') && date === '2026-08-03';
      out.push({
        date, open: +(close - 0.3).toFixed(2), high: +(close + 1.2).toFixed(2),
        low: +(close - 1.4).toFixed(2), close: malformed ? null : close, adjusted_close: malformed ? null : +(close * 0.99).toFixed(4),
        volume: 500_000 + ((k * 7919 + s) % 300_000),
      });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}
let eodCalls;
let rtCalls;
function installVendor() {
  eodCalls = 0;
  rtCalls = 0;
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    let m = u.match(/\/api\/eod\/([^?]+)\?/);
    if (m) {
      eodCalls++;
      return { ok: true, status: 200, json: async () => rawBarsOldestFirst(decodeURIComponent(m[1])) };
    }
    m = u.match(/\/api\/real-time\/([^?]+)\?(.*)$/);
    if (m) {
      rtCalls++;
      const rest = (new URLSearchParams(m[2]).get('s') || '').split(',').filter(Boolean);
      const codes = [decodeURIComponent(m[1]), ...rest];
      return {
        ok: true, status: 200,
        json: async () => codes.map((code) => {
          const s = seedOf(code);
          const close = +(41 + (s % 60) + 0.7).toFixed(2);
          // The quote's previousClose is the vendor's own prior-session close —
          // the newest COMPLETED bar's raw close, as the real feed reports it.
          const bars = rawBarsOldestFirst(code);
          const completed = bars.filter((b) => b.date < new Date().toISOString().slice(0, 10));
          const previousClose = completed[completed.length - 1].close;
          return { code, close, open: close - 0.4, high: close + 0.9, low: close - 1.1, previousClose, change: 0.5, change_p: 1.1, volume: 123456 };
        }),
      };
    }
    throw new Error(`unexpected request ${u}`);
  });
}

let handler;
beforeAll(async () => {
  process.env.EODHD_API_KEY = 'test-key'; // read at module scope by the cron
  ({ default: handler } = await import('./compute-index-intelligence.js'));
});

beforeEach(() => {
  vendorClock.newest = () => PRIOR;
  fs.docs.clear();
  fs.writes.length = 0;
  flag.on = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T14:00:00.000Z')); // Wed 10:00 ET
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  installVendor();
  // A few peerRankings docs so the composite / pillar / game-mode path runs.
  for (const [i, t] of ['AAPL', 'MSFT', 'NVDA'].entries()) {
    fs.docs.set(`peerRankings/${t}`, {
      ticker: t, compositeRank: i + 1, compositeScore: 80 - i * 7, totalPeers: 20, sectorName: 'Technology',
      pillars: { valuation: { percentile: 40 + i * 10 }, growth: { percentile: 70 - i * 5 }, momentum: { percentile: 55 } },
    });
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function run(mode) {
  fs.writes.length = 0;
  const before = { eod: eodCalls, rt: rtCalls };
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await handler({ headers: { 'x-vercel-cron': '1' }, query: mode ? { mode } : {} }, res);
  expect(res.statusCode).toBe(200);
  const outputs = Object.fromEntries(fs.writes
    .filter(([p]) => p.startsWith('indexIntelligence/') || p.startsWith('stockTechnicalScores/'))
    .map(([p, d]) => [p, d]));
  return { outputs, eod: eodCalls - before.eod, rt: rtCalls - before.rt, body: res.body };
}

describe('QW-6 — outputs are identical whether histories come from the store or a fresh fetch', () => {
  it('pre-market: A (flag off) = B (flag on, store cold) = C (flag on, store warm), and C fetches no history', async () => {
    const a = await run();
    flag.on = true;
    const b = await run();
    const c = await run();

    // 5 index docs + marketContext + 12 stockTechnicalScores + stockRankings.
    expect(Object.keys(a.outputs).length).toBe(5 + 1 + 12 + 1);
    expect(a.outputs['indexIntelligence/stockRankings'].droppedRows).toBeGreaterThan(0);
    expect(b.outputs).toEqual(a.outputs);
    expect(c.outputs).toEqual(a.outputs);

    const histories = 5 + 1 + 11 + 12; // indices + TNX + sector ETFs + stocks
    expect(a.eod).toBe(histories);
    expect(b.eod).toBe(histories);
    expect(c.eod).toBe(1); // TNX.INDX only: a non-NYSE calendar is never stored (review EV3)
    expect(fs.docs.get('indexHistoryCache/AAPL.US')).toEqual(expect.objectContaining({ etDate: '2026-10-07', newestBarDate: PRIOR, daysBack: 252, dropped: 1 }));
    expect(fs.docs.get('indexHistoryCache/TNX.INDX')).toBeUndefined();
    expect(fs.docs.get('indexHistoryCache/XLK.US')).toEqual(expect.objectContaining({ daysBack: 50, dropped: 1 }));
  });

  it('intraday: A (flag off) = C (flag on, store warm); the live quotes are still fetched every run', async () => {
    const a = await run('intraday');
    flag.on = true;
    await run();                     // the pre-market wake fills the store
    const c = await run('intraday');
    expect(c.outputs).toEqual(a.outputs);
    expect(c.eod).toBe(1); // TNX.INDX only
    expect(c.rt).toBe(a.rt);
    expect(c.rt).toBeGreaterThan(0);
  });

  it('a NEW session date never reuses yesterday\'s store', async () => {
    flag.on = true;
    await run();
    vi.setSystemTime(new Date('2026-10-08T14:00:00.000Z')); // Thu: prior session is now 10-07
    const next = await run();
    expect(next.eod).toBe(29); // every history re-fetched (and the vendor still ends at 10-06, so nothing is stored)
  });

  it('flag OFF never touches the store', async () => {
    await run();
    await run();
    expect([...fs.docs.keys()].some((k) => k.startsWith('indexHistoryCache/'))).toBe(false);
  });
});

describe('QW-6 review rows (docs/audits/20261007_EODHD_QUICK_WINS_BUILD_REVIEW.md)', () => {
  it('E3-1 — after an EARLY close the store is skipped, so a vendor that already publishes the same-day bar gives flag-on = flag-off', async () => {
    // Fri 2026-11-27: early close 13:00 ET (18:00Z); prior session Wed 11-25.
    // The vendor publishes today's bar from 18:30Z (the reviewer's assumption).
    vendorClock.newest = () => (Date.now() >= Date.parse('2026-11-27T18:30:00Z') ? '2026-11-27' : '2026-11-25');
    vi.setSystemTime(new Date('2026-11-27T19:00:00.000Z'));
    const a = await run('intraday');
    flag.on = true;
    vi.setSystemTime(new Date('2026-11-27T16:00:00.000Z')); // 11:00 ET, in session — inside the 4 h TTL at 19:00Z, so only the after-close rule can refuse it (review E5-1)
    await run();                                   // an in-session wake fills the store
    vi.setSystemTime(new Date('2026-11-27T19:00:00.000Z'));
    const c = await run('intraday');
    expect(c.eod).toBe(29);                        // after the close: every history fetched fresh
    expect(c.outputs).toEqual(a.outputs);
  });

  it('E3-5 — a stored history older than the 4 h TTL is re-fetched within the session', async () => {
    flag.on = true;
    vi.setSystemTime(new Date('2026-10-07T10:30:00.000Z'));
    await run();
    vi.setSystemTime(new Date('2026-10-07T14:00:00.000Z')); // 3.5 h — served
    expect((await run('intraday')).eod).toBe(1); // TNX.INDX only
    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z')); // 4.5 h — re-fetched
    expect((await run('intraday')).eod).toBe(29);
  });

  it('E1-1 rule — in intraday mode a stored bar the live quote does not vouch for is re-fetched', async () => {
    flag.on = true;
    await run();
    const doc = fs.docs.get('indexHistoryCache/AAPL.US');
    doc.rows[0] = { ...doc.rows[0], rawClose: doc.rows[0].rawClose * 0.96 }; // a glitched copy
    fs.docs.set('indexHistoryCache/AAPL.US', doc);
    const c = await run('intraday');
    expect(c.eod).toBe(2);                         // the glitched symbol + TNX.INDX (never stored)
  });
});
