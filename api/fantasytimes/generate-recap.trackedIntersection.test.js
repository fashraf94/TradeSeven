// api/fantasytimes/generate-recap.trackedIntersection.test.js
// A6 for the Doug tracked-intersection zero (fetched=N tracked=0). Doug's
// morning fire read the reported EPS under `actual_eps`, but EODHD
// /calendar/earnings names it `actual` — so every row failed the released
// clause and the intersection zeroed on every firing, keeping S5 silent
// even after the R-B2 morning window landed. Fixture rows are VERBATIM from
// the founder's 2026-07-31 capture (api/_utils/__fixtures__/
// earningsCalendarCapture.js).
//
// RED  = the production predicate (`actual_eps`) over the captured rows → 0.
// GREEN = the handler over the captured rows → Doug writes a real recap.

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

import handler from './generate-recap.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  CAPTURED_TRACKED_ROWS,
  NONTRACKED_SHAPE_FILLERS,
  TRACKED_UNRELEASED_FILLER,
} from '../_utils/__fixtures__/earningsCalendarCapture.js';

function makeFakeDb(existingStories = []) {
  const added = [];
  function collectionRef(name) {
    const filters = [];
    const ref = {
      where(field, op, value) { filters.push({ field, op, value }); return ref; },
      orderBy() { return ref; },
      limit() { return ref; },
      async get() {
        let rows = name === 'fantasyTimesStories' ? [...existingStories, ...added.map((a) => a.doc)] : [];
        for (const f of filters) {
          if (f.op === '==') rows = rows.filter((s) => s[f.field] === f.value);
          if (f.op === '>') rows = rows.filter((s) => (s[f.field]?.getTime?.() ?? 0) > f.value.getTime());
        }
        return { empty: rows.length === 0, docs: rows.map((r) => ({ data: () => r })) };
      },
      async add(doc) { added.push({ name, doc }); return { id: `story-${added.length}` }; },
      doc() { return { async set() {}, async get() { return { exists: false, data: () => null }; } }; },
    };
    return ref;
  }
  return { db: { collection: collectionRef }, added };
}

function makeRes() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const cronReq = { headers: { 'x-vercel-cron': '1' }, method: 'POST', query: {}, body: {} };

function stubToolResponse() {
  wireModelCall.mockResolvedValue({
    response: {
      content: [{ type: 'tool_use', input: { headline: 'H', subheadline: 'S', body: 'B', themes: [], sentiment: 'neutral', recommended_action: 'EARNINGSGAME' } }],
      stop_reason: 'tool_use',
    },
    generationConfig: { seam: 'doug_earnings_recap' },
  });
}

function stubFetch(earnings) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/calendar/earnings')) return { ok: true, json: async () => ({ earnings }) };
    if (String(url).includes('/real-time/')) return { ok: true, json: async () => ({ close: 202.5, change_p: -1.1 }) };
    throw new Error(`unexpected fetch ${url}`);
  }));
}

let logSpy;
let errSpy;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  process.env.CLAUDE_API_KEY = 'test-claude-key';
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  stubToolResponse();
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

// ── RED: the exact production defect, reproduced over the captured rows ────
describe('RED — the pre-fix field name zeroes the intersection over real captured rows', () => {
  const OLD = (e) => e.actual_eps !== null && e.actual_eps !== undefined;
  const NEW = (e) => { const eps = e.actual ?? e.actual_eps; return eps !== null && eps !== undefined; };

  it('captured rows carry the 9-key schema — no actual_eps / eps_estimate / name', () => {
    for (const row of CAPTURED_TRACKED_ROWS) {
      expect(Object.keys(row).sort()).toEqual([
        'actual', 'before_after_market', 'code', 'currency', 'date', 'difference', 'estimate', 'percent', 'report_date',
      ]);
      expect(row.actual_eps).toBeUndefined();
      expect(row.eps_estimate).toBeUndefined();
      expect(row.name).toBeUndefined();
    }
  });

  it('the OLD `actual_eps` predicate keeps ZERO of the captured tracked rows (the production tracked=0)', () => {
    expect(CAPTURED_TRACKED_ROWS.filter(OLD)).toHaveLength(0);
  });

  it('the NEW `actual`-based predicate keeps BOTH captured tracked rows (the fix)', () => {
    expect(CAPTURED_TRACKED_ROWS.filter(NEW)).toHaveLength(2);
  });
});

// ── GREEN: the handler writes a real recap from the captured rows ──────────
describe('GREEN — Doug writes an earnings recap from the captured intersection', () => {
  it('morning fire over the captured window → AAPL recap with real actual/estimate; fillers excluded', async () => {
    // Fri 2026-07-31 09:00 ET (morning): window [Thu 2026-07-30, Fri 2026-07-31].
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    stubFetch([...CAPTURED_TRACKED_ROWS, ...NONTRACKED_SHAPE_FILLERS]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    // Exactly the two tracked rows survive; the three non-tracked fillers
    // (SGE.F, CAP.PA, CAPMF.US) are excluded by the symbol clause.
    expect(loggedLines().some((l) => l.includes('outcome=wrote fetched=5 tracked=2'))).toBe(true);
    expect(res.body.success).toBe(true);
    // Post-expansion: BOTH tracked reporters are recapped in one firing,
    // surprise-first — AAPL (−16.5%) outranks AMZN (−8.2%), so it is written
    // first (added[0]); AMZN follows.
    expect(res.body.count).toBe(2);
    expect(res.body.stories[0].symbol).toBe('AAPL');
    expect(res.body.stories[0].outcome).toBe('miss'); // 1.57 actual < 1.88 estimate
    expect(res.body.stories[1].symbol).toBe('AMZN');

    expect(added).toHaveLength(2);
    const story = added[0].doc;
    expect(story.primaryTicker).toBe('AAPL');
    expect(story.referentDate).toBe('2026-07-30');
    expect(story.beforeAfterMarket).toBe('AMC');
    expect(story.dataSnapshot.epsActual).toBe(1.57);  // from `actual`, not `actual_eps`
    expect(story.dataSnapshot.epsEstimate).toBe(1.88); // from `estimate`

    // companyName falls back to the symbol (no `name` field in the feed).
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Company: AAPL');
    expect(prompt).toContain('EPS Actual: 1.57');
    expect(prompt).toContain('EPS Estimate: 1.88');
  });

  it('an unreleased tracked row (actual null) is held by the data gate, not counted or errored', async () => {
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    stubFetch([TRACKED_UNRELEASED_FILLER]); // MSFT, actual null, report_date today
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.body.code).toBe('empty_window');
    expect(added).toHaveLength(0);
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(loggedLines().some((l) => l.includes('outcome=empty_window fetched=1 tracked=0'))).toBe(true);
  });

  it('referent dedup still holds post-fix: a prior story for the same (symbol, reportDate) → zero model calls', async () => {
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    stubFetch([...CAPTURED_TRACKED_ROWS]);
    const { db } = makeFakeDb([
      { type: 'earnings_recap', primaryTicker: 'AAPL', referentDate: '2026-07-30', status: 'published' },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    // AAPL covered → AMZN is the only uncovered candidate → exactly one story.
    expect(res.body.count).toBe(1);
    expect(res.body.stories[0].symbol).toBe('AMZN');
    expect(res.body.stories[0].outcome).toBe('miss'); // 1.68 < 1.83
  });
});
