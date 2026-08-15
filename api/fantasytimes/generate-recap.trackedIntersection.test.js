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
// WIRE_WRITES is LIVE in production (PR #763): pin writes ON so these seams
// exercise the real publishStoryWithWire write-through, not the retired
// writes-off `.add()` surface. wireFlags is read by both the handler and
// wireWriteThrough, so one mock covers both.
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({
    metricsEnabled: false, writesEnabled: true, continuityEnabled: false,
    newslineEnabled: false, editorialEnabled: false,
  }),
}));

import handler, { RECAP_MAX_STORIES_PER_FIRING } from './generate-recap.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  CAPTURED_TRACKED_ROWS,
  NONTRACKED_SHAPE_FILLERS,
  TRACKED_UNRELEASED_FILLER,
} from '../_utils/__fixtures__/earningsCalendarCapture.js';
import { makeWireDb, writtenStories, wireDay, stubRecapModel } from './__fixtures__/recapWireHarness.js';

function makeRes() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

const cronReq = { headers: { 'x-vercel-cron': '1' }, method: 'POST', query: {}, body: {} };

function stubToolResponse() {
  // Extended-tool response carrying a PASSED agentFacts payload per symbol, so
  // the writes-ON path renders a real wire entry (the gate-corpus coverage).
  stubRecapModel(wireModelCall);
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
    const db = makeWireDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    // Exactly the two tracked rows survive; the three non-tracked fillers
    // (SGE.F, CAP.PA, CAPMF.US) are excluded by the symbol clause.
    expect(loggedLines().some((l) => l.includes('outcome=wrote fetched=5 tracked=2'))).toBe(true);
    expect(res.body.success).toBe(true);
    // Post-expansion: BOTH tracked reporters are recapped in one firing,
    // surprise-first — AAPL (−16.5%) outranks AMZN (−8.2%), so it is written
    // first; AMZN follows.
    expect(res.body.count).toBe(2);
    expect(res.body.stories[0].symbol).toBe('AAPL');
    expect(res.body.stories[0].outcome).toBe('miss'); // 1.57 actual < 1.88 estimate
    expect(res.body.stories[1].symbol).toBe('AMZN');

    // Both stories persist through the LIVE write-through (batch + transaction),
    // surprise-first; the story doc carries its cleared wirePending stamp.
    const stories = writtenStories(db);
    expect(stories).toHaveLength(2);
    const story = stories[0];
    expect(story.primaryTicker).toBe('AAPL');
    expect(story.referentDate).toBe('2026-07-30');
    expect(story.beforeAfterMarket).toBe('AMC');
    expect(story.dataSnapshot.epsActual).toBe(1.57);  // from `actual`, not `actual_eps`
    expect(story.dataSnapshot.epsEstimate).toBe(1.88); // from `estimate`
    expect(story.wireValidation.outcome).toBe('passed');
    expect(story.wirePending).toBe(false);

    // The gate corpus: one wire entry per story, surprise-first, honest ticker.
    const day = wireDay(db);
    expect(day.entries.map((e) => e.agentFacts.primaryTicker)).toEqual(['AAPL', 'AMZN']);

    // companyName falls back to the symbol (no `name` field in the feed).
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Company: AAPL');
    expect(prompt).toContain('EPS Actual: 1.57');
    expect(prompt).toContain('EPS Estimate: 1.88');
  });

  it('an unreleased tracked row (actual null) is held by the data gate, not counted or errored', async () => {
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    stubFetch([TRACKED_UNRELEASED_FILLER]); // MSFT, actual null, report_date today
    const db = makeWireDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.body.code).toBe('empty_window');
    expect(writtenStories(db)).toHaveLength(0);
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(loggedLines().some((l) => l.includes('outcome=empty_window fetched=1 tracked=0'))).toBe(true);
  });

  it('referent dedup still holds post-fix: a prior story for the same (symbol, reportDate) → zero model calls', async () => {
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    stubFetch([...CAPTURED_TRACKED_ROWS]);
    const db = makeWireDb([
      { type: 'earnings_recap', primaryTicker: 'AAPL', referentDate: '2026-07-30', status: 'published' },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    // AAPL covered → AMZN is the only uncovered candidate → exactly one story.
    expect(res.body.count).toBe(1);
    expect(res.body.stories[0].symbol).toBe('AMZN');
    expect(res.body.stories[0].outcome).toBe('miss'); // 1.68 < 1.83
    // Exactly one story written through the wire; AAPL never regenerated.
    const stories = writtenStories(db);
    expect(stories).toHaveLength(1);
    expect(stories[0].primaryTicker).toBe('AMZN');
  });
});

// ── Throughput: the founder-ruled surprise-first DROP property ─────────────
// "When a ceiling binds, the dropped names are the LEAST newsworthy." This is
// the property the founder ruled must be preserved, and the only test that
// feeds MORE candidates than the per-firing budget (all prior tests feed ≤2).
describe('THROUGHPUT — a binding per-firing budget drops the least-newsworthy candidates', () => {
  it('feeds 6 same-day reporters into a budget of 4 → the 4 highest-|surprise| survive, in order; the 2 lowest drop', async () => {
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
    // Six tracked reporters, all AMC 2026-07-30, distinct |EPS surprise %|
    // (all well inside the plausibility band, EPS_SURPRISE_BAND_ABS=20):
    //   NVDA 16.7% > AAPL 13.3% > GOOGL 11.1% > MSFT 6.7% > AMZN 2.0% > META 0.5%
    // Input order is DELIBERATELY SHUFFLED (not surprise order) so the test
    // also fails if the surprise-first sort is removed entirely, not just
    // reversed.
    const row = (code, actual, estimate) => ({
      code, report_date: '2026-07-30', before_after_market: 'AfterMarket', actual, estimate,
    });
    stubFetch([
      row('META.US', 1.005, 1.00),  // +0.5%  — least newsworthy
      row('NVDA.US', 1.50, 1.80),   // -16.7% — most newsworthy
      row('AMZN.US', 1.02, 1.00),   // +2.0%
      row('AAPL.US', 1.30, 1.50),   // -13.3%
      row('MSFT.US', 1.44, 1.35),   // +6.7%
      row('GOOGL.US', 1.20, 1.35),  // -11.1%
    ]);
    const db = makeWireDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    const N = RECAP_MAX_STORIES_PER_FIRING; // 4 (no prior stories → budget = min(12, 4))
    expect(res.body.count).toBe(N);
    expect(writtenStories(db)).toHaveLength(N);
    // Every survivor lands one wire entry — the whole budget feeds the corpus.
    expect(wireDay(db).entries).toHaveLength(N);
    // The N most newsworthy survive, surprise-first; the 2 least newsworthy drop.
    expect(res.body.stories.map((s) => s.symbol)).toEqual(['NVDA', 'AAPL', 'GOOGL', 'MSFT']);
    const survived = new Set(res.body.stories.map((s) => s.symbol));
    expect(survived.has('AMZN')).toBe(false); // +2.0%  dropped
    expect(survived.has('META')).toBe(false); // +0.5%  dropped (least newsworthy)
    // Exactly one firing-level outcome line, carrying the story count.
    expect(loggedLines().filter((l) => l.includes('outcome=wrote'))).toHaveLength(1);
    expect(loggedLines().some((l) => l.includes(`stories=${N}`))).toBe(true);
  });
});
