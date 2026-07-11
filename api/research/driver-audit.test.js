/**
 * driver-audit endpoint boundary test (V3 Sub-build 3 — the liquidity gate).
 *
 * Direct-handler invocation (the correlation-scan boundary-test idiom): the REAL
 * handler + the REAL fetchEodCloses (so the additive volume/OHLC mapping is
 * exercised end-to-end), a stubbed wire, mocked security/auth, and a live-getter
 * featureFlags mock. Fixtures exercise every criterion — a clean symbol that
 * passes all five, a CEW-like shell that fails volume + zero-volume, a
 * single-print symbol, and a calendar-gap symbol — plus never-cached, the
 * flag-404, auth, and validation guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authReturnValue, labFlag } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  labFlag: { on: true },
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) {
      res.status(401).json({ error: 'auth required' });
      return null;
    }
    return authReturnValue.current;
  },
}));

// Live getter so a test can flip CORRELATION_LAB_ENABLED; real flags preserved.
// This real import (and the unmocked handler import below) is also the
// BUILD_RULES §4 dependency-surface guard for the api→src flag import.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CORRELATION_LAB_ENABLED() { return labFlag.on; },
}));

// ==================== Deterministic fixtures ====================

// `count` weekday YYYY-MM-DD strings ending at `end` (inclusive), oldest-first.
function weekdayDates(count, end) {
  const out = [];
  const d = new Date(`${end}T00:00:00Z`);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

// One EODHD /eod wire bar. singlePrint ⇒ open==high==low==close (a dead print).
function bar(date, price, volume, { singlePrint = false } = {}) {
  if (singlePrint) {
    return { date, adjusted_close: price, close: price, open: price, high: price, low: price, volume };
  }
  return { date, adjusted_close: price, close: price, open: price - 0.5, high: price + 1, low: price - 1, volume };
}

// Build a wire series (NEWEST-FIRST, the order=d wire order) from an oldest-first
// date list + a per-index bar builder.
function wireSeries(dates, build) {
  return dates.map((date, i) => build(date, i)).reverse();
}

const END = '2026-07-10';
const CLEAN_DATES = weekdayDates(504, END);

// CLEAN — passes all five: 504 rows, ~1M volume, real OHLC, contiguous weekdays.
const CLEAN_WIRE = wireSeries(CLEAN_DATES, (date, i) => bar(date, 100 + (i % 7), 1_000_000));

// CEW-LIKE shell — fails Gate 2: median volume ~2k (< 50k) AND 5 zero-volume
// days inside the trailing 250. rowCount/singlePrint/gap still pass.
const CEW_WIRE = wireSeries(CLEAN_DATES, (date, i) => {
  const inTrailing250 = i >= CLEAN_DATES.length - 250;
  const zero = inTrailing250 && i % 50 === 0; // a handful of zero-volume days
  return bar(date, 25 + (i % 3), zero ? 0 : 2000);
});

// SINGLE-PRINT — good volume, but 3 dead-print days in the trailing 250.
const PRINT_WIRE = wireSeries(CLEAN_DATES, (date, i) => {
  const inTrailing250 = i >= CLEAN_DATES.length - 250;
  const dead = inTrailing250 && i % 80 === 0;
  return bar(date, 40, 900_000, { singlePrint: dead });
});

// CALENDAR GAP — drop ~2 weeks of consecutive bars in the middle so a
// weekday-distance between two present bars exceeds 5.
const GAP_DATES = CLEAN_DATES.filter((_, i) => i < 250 || i >= 260);
const GAP_WIRE = wireSeries(GAP_DATES, (date) => bar(date, 55, 800_000));

const WIRES = {
  'CLEAN.US': CLEAN_WIRE,
  'CEW.US': CEW_WIRE,
  'PRINT.US': PRINT_WIRE,
  'GAP.US': GAP_WIRE,
};

const fetchCalls = { symbols: [] };
vi.stubGlobal('fetch', async (url) => {
  const match = String(url).match(/\/eod\/([^?]+)\?/);
  const symbol = match ? decodeURIComponent(match[1]) : '';
  fetchCalls.symbols.push(symbol);
  const wire = WIRES[symbol];
  if (!wire) {
    return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) };
  }
  return { ok: true, status: 200, json: async () => wire };
});

vi.stubEnv('EODHD_API_KEY', 'test-key');

// Real handler (unmocked) → real fetchEodCloses volume mapping under test.
const { default: handler } = await import('./driver-audit.js');

function makeReqRes(body) {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
  return { req: { method: 'POST', body }, res };
}

async function runAudit(body) {
  const { req, res } = makeReqRes(body);
  await handler(req, res);
  return res;
}

beforeEach(() => {
  fetchCalls.symbols = [];
  labFlag.on = true;
  authReturnValue.current = { uid: 'test-user' };
});

describe('driver-audit — the two gates', () => {
  it('a clean symbol passes all five criteria (verdict: pass)', async () => {
    const res = await runAudit({ symbols: ['CLEAN.US'] });
    expect(res.statusCode).toBe(200);
    const r = res.body.results[0];
    expect(r.symbol).toBe('CLEAN.US');
    expect(r.httpOk).toBe(true);
    expect(r.rowCount).toBe(504);
    expect(r.firstDate).toBe(CLEAN_DATES[0]);
    expect(r.lastDate).toBe(CLEAN_DATES[CLEAN_DATES.length - 1]);
    expect(r.medianDailyVolume).toBe(1_000_000);
    expect(r.zeroVolumeDays).toBe(0);
    expect(r.singlePrintDays).toBe(0);
    expect(r.maxCalendarGapTradingDays).toBe(1);
    expect(r.criteria).toEqual({
      rowCount: true,
      medianDailyVolume: true,
      zeroVolumeDays: true,
      singlePrintDays: true,
      maxCalendarGapTradingDays: true,
    });
    expect(r.verdict).toBe('pass');
    // the pinned thresholds ride back for the checklist-idiom UI
    expect(res.body.thresholds).toMatchObject({ rowCount: 450, medianDailyVolume: 50000, zeroVolumeDays: 0, singlePrintDays: 0, maxCalendarGapTradingDays: 5 });
  });

  it('the CEW-like shell fails Gate 2 (low median volume + zero-volume days), verdict: fail', async () => {
    const res = await runAudit({ symbols: ['CEW.US'] });
    const r = res.body.results[0];
    expect(r.httpOk).toBe(true);
    expect(r.rowCount).toBe(504);
    expect(r.medianDailyVolume).toBeLessThan(50_000);
    expect(r.zeroVolumeDays).toBeGreaterThan(0);
    expect(r.criteria.medianDailyVolume).toBe(false);
    expect(r.criteria.zeroVolumeDays).toBe(false);
    // Gate 1 (availability) is fine — it's Gate 2 that catches CEW.
    expect(r.criteria.rowCount).toBe(true);
    expect(r.verdict).toBe('fail');
  });

  it('a single-print symbol fails the single-print criterion (trailing 250), verdict: fail', async () => {
    const res = await runAudit({ symbols: ['PRINT.US'] });
    const r = res.body.results[0];
    expect(r.singlePrintDays).toBeGreaterThan(0);
    expect(r.criteria.singlePrintDays).toBe(false);
    expect(r.criteria.medianDailyVolume).toBe(true); // volume is fine — only the dead prints fail
    expect(r.verdict).toBe('fail');
  });

  it('a calendar gap over 5 trading days fails the gap criterion, verdict: fail', async () => {
    const res = await runAudit({ symbols: ['GAP.US'] });
    const r = res.body.results[0];
    expect(r.maxCalendarGapTradingDays).toBeGreaterThan(5);
    expect(r.criteria.maxCalendarGapTradingDays).toBe(false);
    expect(r.verdict).toBe('fail');
  });

  it('an unavailable symbol → httpOk:false, null metrics, verdict:fail (Gate 1 caught it)', async () => {
    const res = await runAudit({ symbols: ['NOPE.US'] });
    const r = res.body.results[0];
    expect(r.httpOk).toBe(false);
    expect(r.rowCount).toBeNull();
    expect(r.medianDailyVolume).toBeNull();
    expect(r.verdict).toBe('fail');
  });

  it('audits multiple symbols in one call, order preserved', async () => {
    const res = await runAudit({ symbols: ['CLEAN.US', 'CEW.US'] });
    expect(res.body.results.map((r) => r.symbol)).toEqual(['CLEAN.US', 'CEW.US']);
    expect(res.body.results[0].verdict).toBe('pass');
    expect(res.body.results[1].verdict).toBe('fail');
  });
});

describe('driver-audit — never cached', () => {
  it('two identical requests both hit the wire (no Firestore, no app cache short-circuit)', async () => {
    await runAudit({ symbols: ['CLEAN.US'] });
    const afterFirst = fetchCalls.symbols.length;
    expect(afterFirst).toBeGreaterThan(0);
    await runAudit({ symbols: ['CLEAN.US'] });
    // The second call fetched again — the endpoint has no cache layer at all.
    expect(fetchCalls.symbols.length).toBe(afterFirst * 2);
  });
});

describe('driver-audit — posture + validation guards', () => {
  it('flag off → 404, reveals nothing, spends no quota', async () => {
    labFlag.on = false;
    const res = await runAudit({ symbols: ['CLEAN.US'] });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(fetchCalls.symbols.length).toBe(0);
  });

  it('unauthenticated → 401 (auth runs after the flag gate)', async () => {
    authReturnValue.current = null;
    const res = await runAudit({ symbols: ['CLEAN.US'] });
    expect(res.statusCode).toBe(401);
    expect(fetchCalls.symbols.length).toBe(0);
  });

  it('non-POST → 405', async () => {
    const res = { statusCode: 200, body: null, setHeader() { return this; }, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
    await handler({ method: 'GET', body: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it.each([
    [{ symbols: [] }, 'invalid_symbols'],
    [{ symbols: Array.from({ length: 11 }, (_, i) => `S${i}.US`) }, 'invalid_symbols'],
    [{ symbols: 'CLEAN.US' }, 'invalid_symbols'],
    [{ symbols: ['aa$a'] }, 'invalid_symbol'],
    [{ symbols: ['1BAD'] }, 'invalid_symbol'],
  ])('400s on bad input: %j → %s', async (body, expectedError) => {
    const res = await runAudit(body);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(expectedError);
  });

  it('dedupes symbols before auditing', async () => {
    const res = await runAudit({ symbols: ['CLEAN.US', 'clean.us', 'CLEAN.US'] });
    expect(res.body.results).toHaveLength(1);
    expect(fetchCalls.symbols).toEqual(['CLEAN.US']);
  });
});
