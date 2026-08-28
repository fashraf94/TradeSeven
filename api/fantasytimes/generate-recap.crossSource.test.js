// api/fantasytimes/generate-recap.crossSource.test.js
// A6 for the NVDA cross-source operand-integrity gate (2026-08-28).
//
// The defect: Doug's recap printed a calendar `actual` of 0.99 vs a correct
// 2.09 estimate — a clean, self-consistent −52.6% "miss" — while the true
// actual (~2.22) was a beat. deriveRecapSurprise, the STRICT editorial adapter,
// AND assessEpsPlausibility all re-derive from the SAME wrong operand, so none
// can see it. The fix: BEFORE the surprise-first sort, corroborate the printed
// calendar actual against the INDEPENDENT /fundamentals actual (getEarningsResult,
// already fetched) under a ratio tolerance, fail-open when the second feed can't
// corroborate, and HOLD (distinct outcome code, candidate terminal) on a
// material same-quarter disagreement.
//
// Every "held" row below is RED under a handler WITHOUT the gate (the story
// publishes the −52.6% miss) and GREEN under the fix (held, zero model calls).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: vi.fn() }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: vi.fn(() => false) }));
vi.mock('../_utils/wireModelCall.js', () => ({ wireModelCall: vi.fn() }));
vi.mock('../earnings/_helpers/getEarningsResult.js', () => ({ getEarningsResult: vi.fn(async () => null) }));
vi.mock('../_utils/ingestedClaims.js', () => ({
  getClaimsForReporter: vi.fn(async () => []),
  formatClaimsForPrompt: vi.fn(() => ''),
}));
vi.mock('../_utils/wireContinuity.js', () => ({ buildContinuityContext: vi.fn(async () => '') }));
vi.mock('../_utils/wireMetrics.js', () => ({ recordWireSample: vi.fn(async () => {}) }));
vi.mock('../_utils/fantasyTimesConsensus.js', () => ({
  appendEarningsResult: vi.fn(async () => {}),
  appendEconomics: vi.fn(async () => {}),
}));
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({
    metricsEnabled: false, writesEnabled: true, continuityEnabled: false,
    newslineEnabled: false, editorialEnabled: false,
  }),
}));

import handler from './generate-recap.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { getEarningsResult } from '../earnings/_helpers/getEarningsResult.js';
import { makeWireDb, writtenStories, stubRecapModel } from './__fixtures__/recapWireHarness.js';

function makeRes() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const cronReq = { headers: { 'x-vercel-cron': '1' }, method: 'POST', query: {}, body: {} };

function stubFetch(earnings) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/calendar/earnings')) return { ok: true, json: async () => ({ earnings }) };
    if (String(url).includes('/real-time/')) return { ok: true, json: async () => ({ close: 202.5, change_p: -1.1 }) };
    throw new Error(`unexpected fetch ${url}`);
  }));
}

// A /calendar/earnings row carrying the 9-key schema. `date` is the fiscal
// period-end; `report_date` the announcement date.
function calRow(code, actual, estimate, reportDate = '2026-07-30', periodEnd = '2026-06-30') {
  return {
    code: `${code}.US`, actual, estimate,
    report_date: reportDate, date: periodEnd,
    before_after_market: 'AfterMarket', currency: 'USD', difference: null, percent: null,
  };
}

let logSpy; let errSpy;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-31T13:00:00Z')); // Fri morning fire, window [Thu 07-30, Fri 07-31]
  process.env.CLAUDE_API_KEY = 'test-claude-key';
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  stubRecapModel(wireModelCall);
  getEarningsResult.mockReset();
  getEarningsResult.mockResolvedValue(null);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  logSpy.mockRestore();
  errSpy.mockRestore();
});
const loggedLines = () => logSpy.mock.calls.map((c) => c.join(' ')).concat(errSpy.mock.calls.map((c) => c.join(' ')));

async function runOne(rows) {
  stubFetch(rows);
  const db = makeWireDb();
  getFirebaseAdmin.mockReturnValue(db);
  const res = makeRes();
  await handler({ ...cronReq }, res);
  return { res, db, stories: writtenStories(db) };
}

describe('cross-source disagree-hold (PRIMARY operand gate)', () => {
  it('HOLDS NVDA when the fundamentals feed disagrees (0.99 vs 2.22, same quarter) — zero model calls, distinct code', async () => {
    getEarningsResult.mockResolvedValue({ resolved: true, epsActual: 2.22, reportDate: '2026-07-30' });
    const { res, stories } = await runOne([calRow('NVDA', 0.99, 2.09)]);

    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe('cross_source_disagreement'); // distinct outcome code
    expect(res.body.skipped).toBe(true);
    expect(stories).toHaveLength(0);                          // never published
    expect(wireModelCall).not.toHaveBeenCalled();            // held before the model call
    // Both operands + the ratio are logged for diagnosis.
    const line = loggedLines().find((l) => l.includes('cross_source_disagreement symbol=NVDA'));
    expect(line).toBeTruthy();
    expect(line).toContain('calendarActual=0.99');
    expect(line).toContain('fundamentalsActual=2.22');
    expect(line).toContain('ratio=0.4459');
    expect(line).toContain('relDiff=0.5541');
    expect(line).toContain('periodEnd=2026-06-30'); // the ignored fiscal column, captured for diagnosis
  });

  it('FAIL-OPEN: an unresolved fundamentals feed never holds — the recap still publishes', async () => {
    getEarningsResult.mockResolvedValue(null); // /fundamentals hasn't posted
    const { res, stories } = await runOne([calRow('NVDA', 0.99, 2.09)]);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(stories).toHaveLength(1);
    expect(stories[0].dataSnapshot.surprise).toBe('-52.6%'); // published (fail-open) — the calendar operand governs
  });

  it('FAIL-OPEN: a fundamentals row from a DIFFERENT quarter does not hold (matcher fallback / split confound)', async () => {
    getEarningsResult.mockResolvedValue({ resolved: true, epsActual: 2.22, reportDate: '2026-04-30' });
    const { res, stories } = await runOne([calRow('NVDA', 0.99, 2.09)]);

    expect(res.body.success).toBe(true);
    expect(stories).toHaveLength(1);
    expect(loggedLines().some((l) => l.includes('cross_source_disagreement'))).toBe(false);
  });

  it('AGREE: matching feeds publish normally (AAPL 1.57 vs fundamentals 1.57)', async () => {
    getEarningsResult.mockResolvedValue({ resolved: true, epsActual: 1.57, reportDate: '2026-07-30' });
    const { res, stories } = await runOne([calRow('AAPL', 1.57, 1.88)]);

    expect(res.body.count).toBe(1);
    expect(stories[0].primaryTicker).toBe('AAPL');
    expect(stories[0].dataSnapshot.surprise).toBe('-16.5%');
  });

  it('INELIGIBLE BEFORE THE SORT: a disagreeing extreme operand cannot outrank/evict a correct beat', async () => {
    // NVDA's fabricated −52.6% would rank ABOVE AAPL's real −16.5% and, on a
    // no-gate handler, both would publish (NVDA first). With the gate NVDA is
    // removed before the sort, so only AAPL survives.
    getEarningsResult.mockImplementation(async (sym) => ({
      NVDA: { resolved: true, epsActual: 2.22, reportDate: '2026-07-30' }, // disagrees with calendar 0.99
      AAPL: { resolved: true, epsActual: 1.57, reportDate: '2026-07-30' }, // agrees with calendar 1.57
    }[sym] ?? null));

    const { res, stories } = await runOne([
      calRow('NVDA', 0.99, 2.09), // -52.6% (fabricated, disagrees)
      calRow('AAPL', 1.57, 1.88), // -16.5% (real, agrees)
    ]);

    expect(res.body.count).toBe(1);
    expect(stories).toHaveLength(1);
    expect(stories[0].primaryTicker).toBe('AAPL');
    expect(res.body.stories.map((s) => s.symbol)).not.toContain('NVDA');
    expect(loggedLines().some((l) => l.includes('cross_source_disagreement symbol=NVDA'))).toBe(true);
  });
});
