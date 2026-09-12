// api/cron/indexIntelligenceHygiene.test.js
//
// The universe cron's daily feed, and the basis its SMA comparisons are made
// on. Two batteries, one file, because they defend the same pipeline:
//
//   PART A — the daily mapper. `fetchOHLCV` used to carry a second, weaker copy
//   of the daily-row mapping: `close: d.adjusted_close`, with no finite check
//   and — unlike the research mapper it was forked from — no `|| d.close`
//   fallback. The defect is not a crash and not a null, it is a FINITE WRONG
//   NUMBER: `null + x === x`, so `calculateSMA`'s `reduce((a, b) => a + b, 0)`
//   (technicalCalculations.js:22) turns one null close into an average low by
//   close/period that nothing downstream can distinguish from a measurement.
//   An ABSENT field is the loud one — `undefined + x === NaN` — and it does not
//   stop at its own symbol: a NaN reaching a cross-sectional comparator breaks
//   sort transitivity and re-ranks the universe.
//
//   PART B — the index SMA basis (appended in the second commit).
//
// Every row here is a MUTATION CHECK as well as an assertion: each one is
// accompanied by the value the pre-change code produced, and that value is
// asserted to be finite and different. A row that could only catch a NaN could
// not fail under this defect.
//
// STYLE-A source assertions, per the in-file convention this directory already
// uses (compute-index-intelligence.axes.test.js:1-12,
// compute-index-intelligence.fundamentalsMirror.test.js): the cron's
// `fetchOHLCV` and `computeIndexTechnicals` are not exported, so the WIRING is
// pinned against the real cron source while the behaviour is proven against the
// same functions the cron calls. The handler battery below then drives the real
// handler end to end, so the two halves cannot drift apart silently.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL imports of
// compute-index-intelligence.js, marketDataCache.js and indexIntelligence.js
// are the runtime guard for those modules' import graphs — they explode in the
// Node test env if a browser dep ever enters one. NEVER mock them.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapDailyRows } from '../_utils/marketDataCache.js';
import { computeTechnicalScore, computeRS, classifyRegime, resolveSmaBasis } from '../_utils/indexIntelligence.js';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
} from '../_utils/technicalCalculations.js';
import { eodPayloadOldestFirst } from '../_utils/__fixtures__/eodPayload.js';

const CRON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compute-index-intelligence.js');
const SOURCE = readFileSync(CRON_PATH, 'utf8');

// ── The mapper, as the cron performs it ───────────────────────────────────
// Pinned to the cron source below, so this helper cannot drift from the code
// it stands in for.
const cronMap = (payload) => mapDailyRows(payload).rows.reverse();

// The mapper the cron shipped BEFORE this build, transcribed verbatim from
// `compute-index-intelligence.js:155-163` at fcace00d. Present only so every
// row can show what the defect produced — it is the mutation check.
const legacyMap = (payload) => payload.slice().reverse().map(d => ({
  date: d.date,
  open: d.open,
  high: d.high,
  low: d.low,
  close: d.adjusted_close,
  rawClose: d.close,
  volume: d.volume || 0,
}));

// Exactly the indicator set the cron computes off a mapped series
// (compute-index-intelligence.js:889-935), so "equals the clean payload" means
// equal where it is read, not merely equal in the array.
function indicators(rows) {
  const closes = rows.map(d => d.close);
  const highs = rows.map(d => d.high);
  const lows = rows.map(d => d.low);
  const atr = calculateATR(highs, lows, closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes);
  return {
    sma20: calculateSMA(closes, 20),
    rsi14: calculateRSI(closes, 14)?.value ?? null,
    macdHist: macd?.histogram ?? null,
    atrPercent: atr?.percent ?? null,
    bbPercentB: bb?.percentB ?? null,
  };
}

// The cron's own call shape (compute-index-intelligence.js:938-953).
function scoreOf(rows) {
  const closes = rows.map(d => d.close);
  const highs = rows.map(d => d.high);
  const lows = rows.map(d => d.low);
  const volumes = rows.map(d => d.volume);
  return computeTechnicalScore({
    closes,
    highs,
    lows,
    volumes,
    spyCloses: closes,
    rsPercentile: 50,
    rsTrend: 'flat',
    technicals: {
      rsi: calculateRSI(closes, 14),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      sma200: calculateSMA(closes, 200),
      macd: calculateMACD(closes),
    },
    sectorRSPercentile: null,
    rawCloses: rows.map(o => o.rawClose ?? null),   // the cron's expression
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PART A — the daily mapper
// ══════════════════════════════════════════════════════════════════════════

describe('A-0 — the cron maps its daily rows through the ONE shared mapper', () => {
  it('imports mapDailyRows and maps with it, keeping the reverse its oldest-first endpoint needs', () => {
    expect(SOURCE).toMatch(/import \{ mapDailyRows \} from '\.\.\/_utils\/marketDataCache\.js';/);
    expect(SOURCE).toContain('const { rows, dropped } = mapDailyRows(data);');
    expect(SOURCE).toContain('const ohlcv = rows.reverse();');
    // And the local copy it replaces is gone — no second contract in the tree.
    expect(SOURCE).not.toContain('close: d.adjusted_close,');
  });

  it('maps then reverses identically to reversing then mapping (dropping is order-agnostic)', () => {
    const payload = eodPayloadOldestFirst(90);
    payload[40].adjusted_close = null;
    payload[41].high = null;
    expect(mapDailyRows(payload).rows.reverse())
      .toEqual(mapDailyRows(payload.slice().reverse()).rows);
  });
});

describe('A-1 — the mapper, on the production payload shape', () => {
  const clean = () => eodPayloadOldestFirst(90);
  // The payload is OLDEST-first (the cron's endpoint carries no `order=`), and
  // every indicator reads the NEWEST bars, so the victim is placed by its
  // newest-first index: 12, #833's own victim and the row Phase 0 §4.2
  // measured. In a 90-row oldest-first array that is index 89 - 12 = 77.
  const VICTIM_NEWEST = 12;
  const VICTIM = 89 - VICTIM_NEWEST;

  it('(α) a null adjusted_close with the raw print intact is KEPT, at the raw price', () => {
    const payload = clean();
    payload[VICTIM].adjusted_close = null;

    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(0);
    expect(rows).toHaveLength(90);

    const mapped = rows.reverse();
    const victimOut = mapped.find(r => r.date === payload[VICTIM].date);
    expect(victimOut.close).toBe(payload[VICTIM].close);   // recovered via the `||` fallback

    // The series is the clean series: nothing was lost and nothing was zeroed.
    const reference = cronMap(clean());
    expect(mapped).toEqual(reference);

    // Every reading the cron takes off it is the clean reading.
    expect(indicators(mapped)).toEqual(indicators(reference));
    const got = scoreOf(mapped);
    const want = scoreOf(reference);
    expect(got.technicalScore).toBe(want.technicalScore);
    expect(got.factors.aboveSMA20).toBe(want.factors.aboveSMA20);

    // MUTATION CHECK — the shipped mapper's numbers were FINITE and DIFFERENT.
    const legacy = legacyMap(payload);
    const legacyInd = indicators(legacy);
    const cleanInd = indicators(reference);
    for (const key of ['sma20', 'rsi14', 'macdHist', 'atrPercent', 'bbPercentB']) {
      expect(Number.isFinite(legacyInd[key])).toBe(true);   // nothing downstream could tell
      expect(legacyInd[key]).not.toBe(cleanInd[key]);
    }
    const legacyScore = scoreOf(legacy);
    expect(Number.isFinite(legacyScore.technicalScore)).toBe(true);
    expect(legacyScore.smaScore).not.toBe(want.smaScore);
  });

  it('(β) a row with BOTH closes absent is dropped, not zeroed and not NaN-ed', () => {
    const payload = clean();
    delete payload[VICTIM].adjusted_close;
    delete payload[VICTIM].close;

    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(1);
    expect(rows).toHaveLength(89);
    expect(rows.some(r => r.date === payload[VICTIM].date)).toBe(false);

    // Dropping and never-having-been-there agree: the drop introduced nothing.
    const mapped = rows.reverse();
    const reference = cronMap(clean().filter((_, i) => i !== VICTIM));
    expect(mapped).toEqual(reference);
    expect(indicators(mapped)).toEqual(indicators(reference));

    // MUTATION CHECK — the shipped mapper produced NaN, and kept the bar.
    const legacy = legacyMap(payload);
    expect(legacy).toHaveLength(90);
    expect(Number.isNaN(calculateSMA(legacy.map(d => d.close), 20))).toBe(true);
  });

  it('(γ) a numeric-string high is coerced and the row KEPT', () => {
    const payload = clean();
    payload[VICTIM].high = String(payload[VICTIM].high);

    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(0);
    const mapped = rows.reverse();
    const reference = cronMap(clean());
    expect(mapped).toEqual(reference);
    expect(indicators(mapped)).toEqual(indicators(reference));
    const got = scoreOf(mapped);
    const want = scoreOf(reference);
    expect(got.technicalScore).toBe(want.technicalScore);
    expect(got.factors.aboveSMA20).toBe(want.factors.aboveSMA20);

    // MUTATION CHECK, part 1 — the shipped mapper carried the STRING through.
    // It survives `high - low` because `-` coerces, which is precisely why a
    // string was never caught: the type is wrong and the arithmetic looks fine.
    const legacy = legacyMap(payload);
    expect(typeof legacy.find(r => r.date === payload[VICTIM].date).high).toBe('string');
    expect(typeof mapped.find(r => r.date === payload[VICTIM].date).high).toBe('number');

    // MUTATION CHECK, part 2 — the same string on a SUMMED field is the loud
    // half of the same defect: `+` concatenates where `-` coerces, so
    // `calculateSMA`'s `reduce((a, b) => a + b, 0)` builds a string.
    const strClose = clean();
    strClose[VICTIM].adjusted_close = String(strClose[VICTIM].adjusted_close);
    const legacyStrSma = calculateSMA(legacyMap(strClose).map(d => d.close), 20);
    expect(legacyStrSma).not.toBe(indicators(reference).sma20);
    // The mapper coerces it instead, and the series is the clean series.
    expect(cronMap(strClose)).toEqual(reference);
  });

  it('(δ) a trading day simply absent yields the clean payload minus that day', () => {
    const payload = clean().filter((_, i) => i !== VICTIM);
    const { rows, dropped } = mapDailyRows(payload);
    expect(dropped).toBe(0);
    expect(rows).toHaveLength(89);

    const mapped = rows.reverse();
    expect(mapped.some(r => r.date === clean()[VICTIM].date)).toBe(false);
    expect(mapped).toEqual(cronMap(clean().filter((_, i) => i !== VICTIM)));
    // One bar shorter shifts every bar-offset lookback by a trading day — the
    // disclosed trade. It does NOT poison anything: every value stays a real
    // measurement of a real (shorter) series.
    expect(Number.isFinite(indicators(mapped).sma20)).toBe(true);
    expect(indicators(mapped).sma20).not.toBe(indicators(cronMap(clean())).sma20);
  });
});

describe('A-2 — Case D: one non-finite rs20.change re-ranked the universe', () => {
  // The cron's percentile block, reproduced verbatim from
  // compute-index-intelligence.js:878-886 — `guarded` is the shipped filter
  // after this build, `unguarded` is the one it replaces.
  const rank = (rsData, guarded) => {
    const sorted = [...rsData]
      .filter(d => guarded ? (d.rs20 && Number.isFinite(d.rs20.change)) : d.rs20)
      .sort((a, b) => (a.rs20.change) - (b.rs20.change));
    const map = {};
    sorted.forEach((d, idx) => {
      map[d.sym] = Math.round((idx / Math.max(sorted.length - 1, 1)) * 100);
    });
    return { map, order: sorted.map(d => d.sym) };
  };

  it('pins the guard to the cron source — the NUMBER is tested, not the container', () => {
    expect(SOURCE).toContain('.filter(d => d.rs20 && Number.isFinite(d.rs20.change))');
    expect(SOURCE).not.toContain('.filter(d => d.rs20)\n');
  });

  // 239 = ALL_TICKERS at HEAD. Deterministic shuffle so a failure is reproducible.
  const N = 239;
  const build = () => {
    let seed = 20260912;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = Array.from({ length: N }, (_, i) => ({
      sym: `S${String(i).padStart(3, '0')}`,
      rs20: { value: 1, change: Number(((rand() - 0.5) * 40).toFixed(4)) },
    }));
    return rows;
  };

  const without119 = (order) => order.filter(sym => sym !== 'S119');

  it('unguarded: one NaN gives OTHER, finite symbols a different percentile than they earned', () => {
    const clean = rank(build(), false);

    const poisoned = build();
    poisoned[119].rs20 = { value: NaN, change: NaN };     // Phase 0 §4.2's worst index
    const got = rank(poisoned, false);

    const moved = Object.keys(clean.map)
      .filter(sym => sym !== 'S119')
      .filter(sym => got.map[sym] !== clean.map[sym]);
    expect(moved.length).toBeGreaterThan(0);              // the universe-wide re-rank
    // Not a re-labelling — the finite symbols' ORDER itself is broken, which is
    // what a comparator returning NaN does to the whole array.
    expect(without119(got.order)).not.toEqual(without119(clean.order));
    // And the poisoned symbol was still ranked and still persisted.
    expect(got.map['S119']).toBeDefined();
  });

  it('guarded: the NaN symbol is excluded and every finite symbol keeps its clean percentile', () => {
    const clean = rank(build(), true);

    const poisoned = build();
    poisoned[119].rs20 = { value: NaN, change: NaN };
    const got = rank(poisoned, true);

    // Excluded from the cohort, exactly as a symbol with no rs20 already is.
    expect(got.map['S119']).toBeUndefined();

    // The finite symbols' ORDER is untouched by the poison.
    expect(got.order).toEqual(without119(clean.order));

    // And each one's percentile is byte-for-byte the percentile it gets in a
    // universe where that symbol simply was not fetched — the shape the shipped
    // code already produces for a symbol whose rs20 is null.
    expect(got).toEqual(rank(build().filter((_, i) => i !== 119), true));
  });

  it('the other cross-sectional sorts order a non-finite metric LAST rather than shuffling', () => {
    expect(SOURCE).toContain("sectorSnapshot.sort(finiteLast(s => s.changePercent, 'desc'));");
    expect(SOURCE).toContain("stockScores.sort(finiteLast(s => s.technicalScore, 'desc'));");
    expect(SOURCE).toContain("sectorStocks.sort(finiteLast(s => s.technicalScore, 'desc'));");
    expect(SOURCE).toContain("rankingStocks.sort(finiteLast(s => s.compositeScore, 'desc'));");
    expect(SOURCE).toContain('.filter(s => Number.isFinite(s.atrPercent))');
    expect(SOURCE).toContain('.filter(s => Number.isFinite(s.bBandwidth))');
    expect(SOURCE).toContain('if (sectorRS && Number.isFinite(sectorRS.change))');
  });

  it('computeRS on a real series is a real ratio; the null the old mapper left is -100%', () => {
    // newest-first: index 0 is today, index 20 is twenty sessions ago.
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.1);
    const spy = Array.from({ length: 60 }, (_, i) => 100 + i * 0.05);
    const honest = computeRS(closes, spy, 20).change;
    expect(Number.isFinite(honest)).toBe(true);
    expect(Math.abs(honest)).toBeLessThan(5);          // a real, small RS move

    // MUTATION CHECK — the two shapes the old mapper produced at index 0.
    // `:189` guards `stockCloses[0] === 0`, but `null !== 0`, so a null close
    // divided straight through to a ratio of 0 and a change of -100%: bottom of
    // the universe, for a symbol that merely had one unusable print.
    expect(computeRS([null, ...closes.slice(1)], spy, 20).change).toBe(-100);
    // And an ABSENT field reached the cross-sectional comparator as NaN.
    expect(Number.isNaN(computeRS([undefined, ...closes.slice(1)], spy, 20).change)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// A-3 / A-4 — the REAL handler, end to end
// ══════════════════════════════════════════════════════════════════════════
//
// Everything above proves the mapper and the comparators. This drives the
// actual exported handler so the WIRING is proven too: firebase-admin and
// `fetch` are the only things replaced, and nothing in the cron is mocked.

const { getFirestoreMock } = vi.hoisted(() => {
  const state = { db: null };
  return { getFirestoreMock: state };
});

vi.mock('firebase-admin/app', () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],            // already initialized ⇒ no credential path
  cert: () => ({}),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => getFirestoreMock.db,
  FieldValue: { serverTimestamp: () => '<serverTimestamp>' },
  Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
}));

// A Firestore stand-in with exactly the surface this handler uses: batched
// sets, a doc read for the snapshot-ops toggle, and `where(...).get()` for
// peerRankings. Writes land in `store` keyed by `collection/doc`.
function makeDb() {
  const store = new Map();
  const makeQuery = () => ({
    where: () => makeQuery(),
    get: async () => ({ forEach: () => {}, docs: [], empty: true, size: 0 }),
  });
  const db = {
    store,
    collection: (name) => ({
      doc: (id) => ({
        path: `${name}/${id}`,
        get: async () => ({ exists: false, id, data: () => undefined }),
      }),
      where: () => makeQuery(),
      get: async () => ({ forEach: () => {}, docs: [], empty: true, size: 0 }),
    }),
    batch: () => ({
      set: (ref, data) => { store.set(ref.path, data); },
      commit: async () => { db.committed = true; },
    }),
    committed: false,
  };
  return db;
}

// An oldest-first EODHD payload for one symbol. 40 bars keeps SPY under the
// cron's `spyCloses.length < 50` gate (compute-index-intelligence.js:826), so
// the 239-symbol stock pass is skipped and this battery stays fast — the index
// path under test runs in full either way.
function indexPayload(n, base) {
  return Array.from({ length: n }, (_, i) => {
    const close = Number((base + i * 0.4 + Math.sin(i / 3) * 1.1).toFixed(4));
    return {
      date: new Date(Date.UTC(2026, 5, 15) - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
      open: Number((close - 0.2).toFixed(4)),
      high: Number((close + 0.9).toFixed(4)),
      low: Number((close - 0.9).toFixed(4)),
      close,
      adjusted_close: close,
      volume: 3_000_000 + (i % 4) * 90_000,
    };
  });
}

// Serves every symbol the cron fetches; `mutate` may poison one payload.
function stubEodhd(mutate = () => {}) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const sym = decodeURIComponent(String(url).split('/eod/')[1].split('?')[0]);
    const rows = indexPayload(40, 400 + (sym.charCodeAt(0) % 20));
    mutate(sym, rows);
    return { ok: true, status: 200, json: async () => rows };
  }));
}

const runHandler = async () => {
  const mod = await import('./compute-index-intelligence.js');
  const res = { code: null, body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; } };
  await mod.default({ headers: { 'x-vercel-cron': '1' }, query: {} }, res);
  return res;
};

describe('A-3 — an index row with no closes: a 500 before, a completed run after', () => {
  beforeEach(() => { getFirestoreMock.db = makeDb(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('drops the unusable newest bar and the run completes with the batch written', async () => {
    stubEodhd((sym, rows) => {
      if (sym !== 'QQQ.US') return;
      delete rows[rows.length - 1].close;            // newest bar ⇒ closes[0]
      delete rows[rows.length - 1].adjusted_close;
    });

    const res = await runHandler();
    expect(res.code).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getFirestoreMock.db.committed).toBe(true);
    expect(res.body.indexesProcessed).toBe(5);

    // The poisoned symbol is one bar shorter and its price is a real price.
    const qqq = getFirestoreMock.db.store.get('indexIntelligence/QQQ');
    expect(Number.isFinite(qqq.price)).toBe(true);
    expect(qqq.sma20.value).toBeGreaterThan(0);
    // Its unpoisoned siblings are untouched.
    expect(getFirestoreMock.db.store.get('indexIntelligence/SPY').price).toBeGreaterThan(0);
  });

  it('MUTATION CHECK — the same payload through the pre-change mapper throws at :394', () => {
    // `Number(currentPrice.toFixed(2))` on `closes[0]`, with the mapper that
    // kept the bar: the exact expression the cron ran before this build. The
    // throw is caught at the handler's catch and returned as HTTP 500, aborting
    // the WHOLE run — no index doc, no stockRankings, readers left on
    // yesterday's feed.
    const rows = indexPayload(40, 400);
    delete rows[rows.length - 1].close;
    delete rows[rows.length - 1].adjusted_close;
    const legacy = legacyMap(rows);
    expect(legacy).toHaveLength(40);                   // kept, not dropped
    expect(() => Number(legacy[0].close.toFixed(2))).toThrow(TypeError);
    // And the mapper under test makes that expression unreachable.
    expect(() => Number(cronMap(rows)[0].close.toFixed(2))).not.toThrow();
  });

  it('(α, end to end) a null adjusted_close on an index bar reads the RAW print, not a zero', async () => {
    // The α case through the REAL handler, on the index path — the one place a
    // bad bar used to abort the entire run. The poisoned bar keeps its raw
    // print, so every reading on the persisted doc must equal the clean run's.
    const cleanDb = makeDb();
    getFirestoreMock.db = cleanDb;
    stubEodhd();
    expect((await runHandler()).code).toBe(200);
    const cleanSpy = cleanDb.store.get('indexIntelligence/SPY');

    vi.unstubAllGlobals();
    getFirestoreMock.db = makeDb();
    stubEodhd((sym, rows) => {
      if (sym !== 'SPY.US') return;
      rows[rows.length - 14].adjusted_close = null;   // inside SMA20/RSI14/ATR14
    });
    expect((await runHandler()).code).toBe(200);
    const gotSpy = getFirestoreMock.db.store.get('indexIntelligence/SPY');

    expect(gotSpy.price).toBe(cleanSpy.price);
    expect(gotSpy.sma20).toEqual(cleanSpy.sma20);
    expect(gotSpy.rsi).toEqual(cleanSpy.rsi);
    expect(gotSpy.macd).toEqual(cleanSpy.macd);
    expect(gotSpy.atr).toEqual(cleanSpy.atr);
    expect(gotSpy.range52w).toEqual(cleanSpy.range52w);

    // MUTATION CHECK — the pre-change mapper left `close: null` on that bar,
    // which sums as 0. Every reading below stays FINITE and moves, which is why
    // nothing downstream could ever detect it.
    const poisonedRows = indexPayload(40, 400 + ('S'.charCodeAt(0) % 20));
    poisonedRows[poisonedRows.length - 14].adjusted_close = null;
    const legacyCloses = legacyMap(poisonedRows).map(d => d.close);
    const cleanCloses = cronMap(indexPayload(40, 400 + ('S'.charCodeAt(0) % 20))).map(d => d.close);
    const legacySma = calculateSMA(legacyCloses, 20);
    expect(Number.isFinite(legacySma)).toBe(true);
    expect(legacySma).not.toBe(calculateSMA(cleanCloses, 20));
    expect(calculateRSI(legacyCloses, 14).value)
      .not.toBe(calculateRSI(cleanCloses, 14).value);
  });

  it('a clean run drops nothing and logs kept/dropped per symbol', async () => {
    const logs = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a) => { logs.push(a.join(' ')); });
    stubEodhd();
    const res = await runHandler();
    spy.mockRestore();

    expect(res.code).toBe(200);
    const droppedLines = logs.filter(l => / kept, \d+ dropped$/.test(l));
    expect(droppedLines.length).toBe(17);              // 5 indices + TNX + 11 sector ETFs
    expect(droppedLines.every(l => l.endsWith('0 dropped'))).toBe(true);
    expect(droppedLines.every(l => l.includes('[IndexIntelligence]'))).toBe(true);
  });
});

describe('A-4 — the stockRankings payload and the persisted basis', () => {
  // The full-universe pass: 60 bars clears the cron's `length < 50` gate, so
  // all 239 tickers score and stockRankings is built. `fetchBatch`'s 500 ms
  // inter-batch rate-limit delay is skipped — it is a courtesy to EODHD, and
  // this test has no EODHD.
  let realSetTimeout;
  beforeEach(() => {
    getFirestoreMock.db = makeDb();
    realSetTimeout = globalThis.setTimeout;
    vi.stubGlobal('setTimeout', (fn, ms) => (ms === 500 ? (fn(), 0) : realSetTimeout(fn, ms)));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const sym = decodeURIComponent(String(url).split('/eod/')[1].split('?')[0]);
      const rows = indexPayload(60, 50 + (sym.charCodeAt(0) % 40));
      return { ok: true, status: 200, json: async () => rows };
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.process.env.VERCEL_GIT_COMMIT_SHA;
  });

  it('carries deploySha (the env value when set) and droppedRows', async () => {
    globalThis.process.env.VERCEL_GIT_COMMIT_SHA = 'deadbeefcafe';
    const res = await runHandler();
    expect(res.code).toBe(200);

    const rankings = getFirestoreMock.db.store.get('indexIntelligence/stockRankings');
    expect(rankings).toBeDefined();
    expect(rankings.deploySha).toBe('deadbeefcafe');
    expect(rankings.droppedRows).toBe(0);            // a clean day
    expect(rankings.mode).toBe('premarket');
    expect(rankings.stocks.length).toBeGreaterThan(0);
    // Additive: the fields that were already there are untouched.
    expect(rankings.arch_scores_version).toBe(1);
    expect(rankings.totalTechStocks).toBe(rankings.stocks.length);
  }, 30_000);

  it('carries deploySha: null when the env var is absent, and counts real drops', async () => {
    delete globalThis.process.env.VERCEL_GIT_COMMIT_SHA;
    // Poison one bar on one ticker; it must be counted, not hidden.
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const sym = decodeURIComponent(String(url).split('/eod/')[1].split('?')[0]);
      const rows = indexPayload(60, 50 + (sym.charCodeAt(0) % 40));
      if (sym === 'AAPL.US') { rows[10].close = null; rows[10].adjusted_close = null; }
      return { ok: true, status: 200, json: async () => rows };
    }));

    const res = await runHandler();
    expect(res.code).toBe(200);
    const rankings = getFirestoreMock.db.store.get('indexIntelligence/stockRankings');
    expect(rankings.deploySha).toBeNull();
    expect(rankings.droppedRows).toBe(1);
  }, 30_000);

  it('A-5 — factors.basis carries all three period keys on every persisted symbol', async () => {
    const res = await runHandler();
    expect(res.code).toBe(200);

    const aapl = getFirestoreMock.db.store.get('stockTechnicalScores/AAPL');
    expect(aapl).toBeDefined();
    expect(Object.keys(aapl.factors.basis).sort()).toEqual(['sma20', 'sma200', 'sma50']);
    for (const key of ['sma20', 'sma50', 'sma200']) {
      expect(['raw', 'adjusted']).toContain(aapl.factors.basis[key]);
    }
    // §9: the basis is the basis of the average published beside it, not a
    // parallel label — `resolveSmaBasis` returns both from one pass.
    expect(aapl.factors.sma20).not.toBeUndefined();

    // And the 14 shipped factor keys are all still there, unrenamed.
    for (const key of [
      'rsPercentile', 'sectorRSPercentile', 'aboveSMA20', 'aboveSMA50', 'aboveSMA200',
      'sma20', 'sma50', 'sma200', 'distTo52wkHigh', 'upDayVolRatio', 'rsi',
      'macdHistogram', 'macdAboveSignal', 'macdFreshBullishCross', 'macdFreshBearishCross',
    ]) {
      expect(aapl.factors).toHaveProperty(key);
    }
  }, 30_000);
});

// ══════════════════════════════════════════════════════════════════════════
// PART B — the index SMA basis
// ══════════════════════════════════════════════════════════════════════════
//
// #833 gave the 239-name stock universe one rule: the price and the average it
// is compared against come from the SAME series, or neither. The five index
// documents never got it. `computeIndexTechnicals` computed sma20/50/200 on the
// ADJUSTED closes and compared `currentPrice > smaVal` against them — while
// intraday mode splices a RAW live quote into `closes[0]` for indices too.
// Dividend adjustment only ever scales bars DOWN, so the error is one-signed:
// systematically BULLISH, four times a year per payer, and it propagates into
// `classifyRegime` → `breadthComposite`/`breadthTier` → `marketContext` → the
// eval cron and the Daily Regime Brief.
//
// The fixture is the one #833 used (rawVsAdjustedSmaFlags.test.js:42-60,
// re-derived here for the bar shape `computeIndexTechnicals` takes): a real
// dividend, with the adjusted series DERIVED from the raw one the way EODHD
// derives `adjusted_close`. A hand-written pair could only pin an assumption.

const SESSIONS = 59;
const FLAT_PRICE = 100;
const DIVIDEND = 1;
const EX_DATE_INDEX = 30;        // bars 30..N are on or before the ex-date
const LIVE_QUOTE = 99.7;
const FACTOR = (FLAT_PRICE - DIVIDEND) / FLAT_PRICE;

// Newest-first raw closes: what the tape printed, plus the live quote at 0.
const rawSeries = (sessions = SESSIONS) =>
  [LIVE_QUOTE, ...Array.from({ length: sessions }, () => FLAT_PRICE)];

// The same bars as EODHD's `adjusted_close`. Index 0 is the live quote, which
// is never adjusted — it has not been through a corporate action yet.
const adjustedFrom = (raw, exIndex = EX_DATE_INDEX) =>
  raw.map((c, i) => (i >= exIndex ? Number((c * FACTOR).toFixed(4)) : c));

// Newest-first bars in the shape the cron's mapper produces.
const barsFrom = (adj, raw) => adj.map((close, i) => ({
  date: new Date(Date.UTC(2026, 5, 15) - i * 86_400_000).toISOString().slice(0, 10),
  open: close,
  high: close + 0.5,
  low: close - 0.5,
  close,
  rawClose: raw[i],
  volume: 1e6,
}));

describe('B-1 — the index SMA basis', () => {
  const raw = rawSeries();
  const adj = adjustedFrom(raw);

  it('the cron resolves the index averages through resolveSmaBasis', async () => {
    expect(SOURCE).toMatch(/^\s+resolveSmaBasis,$/m);
    // Both raw-series sites, index and stock, pinned together: `?? null`, never
    // `?? o.close` — see the comment at each site for why the difference matters.
    expect(SOURCE).toContain('const rawCloses = ohlcv.map(o => o.rawClose ?? null);');
    expect(SOURCE).toContain('const rawCloses = d.ohlcv.map(o => o.rawClose ?? null);');
    expect(SOURCE).not.toContain('o.rawClose ?? o.close');
    expect(SOURCE).toContain('const smaBasis = resolveSmaBasis({');
    expect(SOURCE).toContain('sma20: smaInfo(smaBasis.sma20),');
    expect(SOURCE).toContain('sma50: smaInfo(smaBasis.sma50),');
    expect(SOURCE).toContain('sma200: smaInfo(smaBasis.sma200),');
  });

  it('with raw closes present the averages resolve RAW, and the comparison lands where the shipped one did not', async () => {
    const { computeIndexTechnicals } = await import('./compute-index-intelligence.js');
    const got = computeIndexTechnicals(barsFrom(adj, raw), 'S&P 500');

    // Raw 50-day average: the stock has gone nowhere, so it is ~the flat price.
    expect(got.sma50.value).toBe(Number(calculateSMA(raw, 50).toFixed(2)));
    expect(got.basis.sma50).toBe('raw');
    // 99.70 is BELOW its own 50-day average. That is the honest reading.
    expect(got.sma50.position).toBe('below');

    // MUTATION CHECK — the shipped comparison, on the adjusted average.
    const shippedSma50 = calculateSMA(adj, 50);
    expect(Number(shippedSma50.toFixed(2))).not.toBe(got.sma50.value);
    expect(shippedSma50).toBeLessThan(LIVE_QUOTE);          // reads "above"
    expect(calculateSMA(raw, 50)).toBeGreaterThan(LIVE_QUOTE); // truly "below"
    // The gap is the payout: one ordinary ~1% quarterly dividend.
    expect(calculateSMA(raw, 50) - shippedSma50).toBeCloseTo(0.4, 2);

    // The 20-day window has no ex-date in it, so both bases agree — the basis
    // is chosen PER PERIOD, not per symbol.
    expect(got.basis.sma20).toBe('raw');
    expect(got.sma20.value).toBe(Number(calculateSMA(raw, 20).toFixed(2)));
    expect(Number(calculateSMA(adj, 20).toFixed(2))).toBe(got.sma20.value);

    // 60 bars is short of 200, so that period falls back and stays null.
    expect(got.basis.sma200).toBe('adjusted');
    expect(got.sma200.value).toBeNull();

    // §9: position, distance and the published price all come from one price
    // and the average published beside them.
    expect(got.sma50.distance)
      .toBe(Number((((got.price - got.sma50.value) / got.sma50.value) * 100).toFixed(2)));
  });

  it('a re-denominated (split) window falls back to the SHIPPED result, byte for byte', async () => {
    const { computeIndexTechnicals } = await import('./compute-index-intelligence.js');

    // A 2:1 split 25 sessions back: the raw print before it is double the raw
    // print after, so the raw closes in the 50-day window are not comparable to
    // each other and their average is not a price anything can be above.
    const splitRaw = raw.map((c, i) => (i >= 25 ? c * 2 : c));
    const got = computeIndexTechnicals(barsFrom(adj, splitRaw), 'S&P 500');

    expect(got.basis.sma50).toBe('adjusted');               // guard fired
    expect(got.sma50.value).toBe(Number(calculateSMA(adj, 50).toFixed(2)));

    // Byte for byte the shipped document: falling back is never a new failure.
    const shipped = { ...got, sma20: null, sma50: null, sma200: null, basis: null };
    const reference = computeIndexTechnicals(
      barsFrom(adj, adj), 'S&P 500');                        // no raw series delta
    expect(shipped).toEqual({ ...reference, sma20: null, sma50: null, sma200: null, basis: null });
    expect(got.sma50).toEqual({
      value: Number(calculateSMA(adj, 50).toFixed(2)),
      position: LIVE_QUOTE > calculateSMA(adj, 50) ? 'above' : 'below',
      distance: Number((((LIVE_QUOTE - calculateSMA(adj, 50)) / calculateSMA(adj, 50)) * 100).toFixed(2)),
    });
  });

  it('a missing rawClose falls the WHOLE symbol back to adjusted, and basis says so', async () => {
    const { computeIndexTechnicals } = await import('./compute-index-intelligence.js');
    // `mapDailyRows` already yields `rawClose: null` for a non-finite raw print
    // (marketDataCache.js:337), so `o.rawClose ?? null` hands `resolveSmaBasis`
    // a series it can judge: one null fails `rawCloses.every(Number.isFinite)`
    // (indexIntelligence.js:348) and EVERY period reverts to the shipped
    // adjusted comparison — which `basis` then reports.
    // The hole sits at bar 35 — INSIDE the 50-day window and PAST the ex-date,
    // so the adjusted and raw closes genuinely differ there. (At a bar before
    // the ex-date they are the same number and the substitution below would be
    // invisible, which is exactly how this stayed unnoticed.)
    const HOLE = 35;
    const holed = raw.map((c, i) => (i === HOLE ? null : c));
    const got = computeIndexTechnicals(barsFrom(adj, holed), 'S&P 500');

    // EVERY period, not just the one containing the hole: the usability check is
    // over the whole series (indexIntelligence.js:344-351), so the 20-day window
    // reverts too even though bar 35 is nowhere near it.
    expect(got.basis).toEqual({ sma20: 'adjusted', sma50: 'adjusted', sma200: 'adjusted' });
    expect(got.sma50.value).toBe(Number(calculateSMA(adj, 50).toFixed(2)));
    expect(got.sma20.value).toBe(Number(calculateSMA(adj, 20).toFixed(2)));

    // MUTATION CHECK — what `?? o.close` did instead: it substituted that bar's
    // ADJUSTED close into the RAW window, so the symbol stayed on a 'raw' basis
    // computed from a series that was not entirely raw, and nothing said so.
    const substituted = raw.map((c, i) => (i === HOLE ? adj[HOLE] : c));
    const mixed = Number(calculateSMA(substituted, 50).toFixed(2));
    expect(adj[HOLE]).not.toBe(raw[HOLE]);                          // the bar really differs
    expect(mixed).not.toBe(got.sma50.value);                        // not the adjusted average
    expect(mixed).not.toBe(Number(calculateSMA(raw, 50).toFixed(2))); // nor the raw one
  });

  it('the other two degradations — a wrong-length and an absent raw series — also revert to shipped', async () => {
    // The null case belongs to the row above; these are the two remaining
    // branches of `resolveSmaBasis`'s usability check (indexIntelligence.js:344-351),
    // asserted on it directly because the cron always passes a same-length map
    // built by the one expression pinned above.
    const technicals = {
      sma20: calculateSMA(adj, 20), sma50: calculateSMA(adj, 50), sma200: null,
    };
    for (const rawCloses of [raw.slice(0, 10), undefined]) {
      const shipped = resolveSmaBasis({ closes: adj, rawCloses, technicals });
      expect(shipped.basis).toEqual({ sma20: 'adjusted', sma50: 'adjusted', sma200: 'adjusted' });
      expect(shipped.sma50).toBe(calculateSMA(adj, 50));
      expect(shipped.price).toBe(adj[0]);
    }
  });
});

describe('B-2 — the regime label the market context ships', () => {
  // 260 sessions so SMA200 exists. Same dividend construction; the ex-date sits
  // inside BOTH the 50- and the 200-day windows, which is where the two bases
  // disagree about the 50/200 boundary classifyRegime reads.
  const raw = rawSeries(260);
  const adj = adjustedFrom(raw);

  it('classifyRegime receives the RAW-resolved values, and the label changes', async () => {
    const { computeIndexTechnicals } = await import('./compute-index-intelligence.js');
    const spyT = computeIndexTechnicals(barsFrom(adj, raw), 'S&P 500');

    // The seam, reproduced verbatim from compute-index-intelligence.js:788 —
    // the three arguments are exactly the fields computeIndexTechnicals
    // publishes, so this IS the call the handler makes.
    expect(SOURCE).toContain('regime = classifyRegime(spyT.price, spyT.sma50.value, spyT.sma200.value);');
    const got = classifyRegime(spyT.price, spyT.sma50.value, spyT.sma200.value);

    // THE ASSERTION, first, so it is what fails under the defect: the label the
    // whole market context ships. MUTATION CHECK alongside it — the shipped
    // adjusted averages, and the label they produced.
    const shipped = classifyRegime(
      spyT.price,
      Number(calculateSMA(adj, 50).toFixed(2)),
      Number(calculateSMA(adj, 200).toFixed(2)),
    );
    expect(shipped.regime).toBe('bull');       // the one-signed bullish skew
    expect(got.regime).toBe('bear');           // the right number
    expect(got.regime).not.toBe(shipped.regime);

    // And the values it received are the raw-resolved ones.
    expect(spyT.sma50.value).toBe(Number(calculateSMA(raw, 50).toFixed(2)));
    expect(spyT.sma200.value).toBe(Number(calculateSMA(raw, 200).toFixed(2)));
    expect(spyT.basis.sma50).toBe('raw');
    expect(spyT.basis.sma200).toBe('raw');
  });

  it('the downstream shapes are unchanged — only the values move', async () => {
    const { computeIndexTechnicals } = await import('./compute-index-intelligence.js');
    const spyT = computeIndexTechnicals(barsFrom(adj, raw), 'S&P 500');
    for (const key of ['name', 'price', 'change', 'changePercent', 'ytdReturn',
      'sma20', 'sma50', 'sma200', 'rsi', 'macd', 'atr', 'volumeRatio', 'range52w']) {
      expect(spyT).toHaveProperty(key);
    }
    for (const key of ['value', 'position', 'distance']) {
      expect(spyT.sma50).toHaveProperty(key);
    }
    // B-2 additive field only.
    expect(Object.keys(spyT.basis).sort()).toEqual(['sma20', 'sma200', 'sma50']);
  });
});

describe('B-3 — what each index document resolves to on the handler fixture', () => {
  beforeEach(() => { getFirestoreMock.db = makeDb(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('every index document carries a basis, and says why', async () => {
    stubEodhd();                                   // 40 bars, adjusted === raw
    expect((await runHandler()).code).toBe(200);

    for (const sym of ['SPY', 'QQQ', 'DIA', 'IWM', 'RSP']) {
      const doc = getFirestoreMock.db.store.get(`indexIntelligence/${sym}`);
      expect(doc).toBeDefined();
      // adjusted === raw on every bar ⇒ factor spread 1.0, under the 1.15 split
      // guard ⇒ the 20-day window resolves RAW.
      expect(doc.basis.sma20).toBe('raw');
      // 40 bars < 50 and < 200 ⇒ those two periods fall back and stay null.
      expect(doc.basis.sma50).toBe('adjusted');
      expect(doc.basis.sma200).toBe('adjusted');
      expect(doc.sma50.value).toBeNull();
      expect(doc.sma200.value).toBeNull();
    }
  });
});
