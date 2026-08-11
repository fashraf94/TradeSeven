// api/fantasytimes/generate-recap.recapSurprise.test.js
// A6 for the Doug earnings-recap SURPRISE SPLIT (diagnosis Part 4).
//
// The defect: dataSnapshot.surprise / outcome came from EODHD /fundamentals
// via getEarningsResult(symbol) with NO targetDate → entries[0] (the most
// recent history row, not the recapped quarter), while epsActual/epsEstimate
// came from /calendar/earnings for the report date. Two feeds, no date match:
// the AMD story printed 1.44 vs 1.35 (a +6.7% beat) next to a −80% surprise,
// and outcome inherited the foreign feed's sign. Because earnings_recap is an
// S5 STRICT verification slot whose editorial adapter recomputes the surprise
// from the stored operands, every such split scored VERIFIED_WRONG on a
// plumbing bug rather than a model defect.
//
// The fix: (1) pass earning.reportDate as targetDate; (2) derive the printed
// surprise + outcome from the SAME calendar epsActual/epsEstimate the story
// prints, matching the adapter's '(a − e)/|e|×100' recomputation (§9).
//
// Every row below is RED under the pre-fix handler (it read the foreign feed)
// and GREEN under the fix — see the mutation note in the build report.

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

import handler, { deriveRecapSurprise, RECAP_OUTCOME_UNVERIFIABLE } from './generate-recap.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { getEarningsResult } from '../earnings/_helpers/getEarningsResult.js';

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

// A /calendar/earnings row (the feed that carries the PRINTED operands).
// `estimate: undefined` omits the field, modelling a null-consensus report.
function calRow(code, actual, estimate, reportDate = '2026-07-30') {
  return {
    code: `${code}.US`, actual, estimate,
    report_date: reportDate, date: reportDate,
    before_after_market: 'AfterMarket', currency: 'USD', difference: null, percent: null,
  };
}

let logSpy; let errSpy;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Fri 2026-07-31 09:00 ET (morning fire) — the proven window in the
  // tracked-intersection harness; getEarningsResult is mocked, so no live call.
  vi.setSystemTime(new Date('2026-07-31T13:00:00Z'));
  process.env.CLAUDE_API_KEY = 'test-claude-key';
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  stubToolResponse();
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

async function runOne(rows) {
  stubFetch(rows);
  const { db, added } = makeFakeDb();
  getFirebaseAdmin.mockReturnValue(db);
  const res = makeRes();
  await handler({ ...cronReq }, res);
  return { res, story: added[0]?.doc, prompt: wireModelCall.mock.calls[0]?.[1]?.messages?.[0]?.content };
}

// ── A6 rows — handler level (RED under the pre-fix foreign-feed read) ───────
describe('A6 — recap surprise/outcome follow the PRINTED calendar operands', () => {
  it('Row 1 — AMD: 1.44 vs 1.35 → +6.7% BEAT, never the −80% the /fundamentals feed carried', async () => {
    // The foreign feed disagrees hard (wrong quarter): −80% / miss.
    getEarningsResult.mockResolvedValue({
      resolved: true, surprisePercent: -80, outcome: 'miss', priceMove: 2.1, magnitude: 'up',
    });
    const { res, story, prompt } = await runOne([calRow('AMD', 1.44, 1.35)]);

    expect(res.statusCode).toBe(200);
    expect(res.body.symbol).toBe('AMD');
    expect(res.body.outcome).toBe('beat');
    expect(story.dataSnapshot.surprise).toBe('+6.7%');
    expect(story.dataSnapshot.outcome).toBe('beat');
    expect(story.dataSnapshot.epsActual).toBe(1.44);
    expect(story.dataSnapshot.epsEstimate).toBe(1.35);
    // The prompt the model sees carries the reconciled number, not −80.
    expect(prompt).toContain('Surprise: +6.7%');
    expect(prompt).toContain('Outcome: BEAT');
    expect(prompt).not.toContain('-80.0%'); // the pre-fix foreign-feed render
    // Lever 1: the recapped quarter is requested by date (7-day matcher).
    expect(getEarningsResult).toHaveBeenCalledWith('AMD', '2026-07-30');
  });

  it('Row 2 — a genuine miss (1.20 vs 1.35) computes −11.1% / MISS even when the feed is unresolved', async () => {
    getEarningsResult.mockResolvedValue(null); // EODHD /fundamentals hasn't posted
    const { res, story, prompt } = await runOne([calRow('NVDA', 1.20, 1.35)]);

    expect(res.body.outcome).toBe('miss');
    expect(story.dataSnapshot.surprise).toBe('-11.1%'); // pre-fix: 'N/A'
    expect(story.dataSnapshot.outcome).toBe('miss');
    expect(prompt).toContain('Surprise: -11.1%');
  });

  it('Row 3 — null estimate DEGRADES to NOT_VERIFIABLE (not a fabricated beat, not a crash)', async () => {
    getEarningsResult.mockResolvedValue(null);
    const { res, story } = await runOne([calRow('AAPL', 1.44, undefined)]); // no consensus

    expect(res.statusCode).toBe(200);          // not a crash
    expect(res.body.success).toBe(true);
    expect(res.body.outcome).toBe(RECAP_OUTCOME_UNVERIFIABLE); // pre-fix fabricated 'beat'
    expect(story.dataSnapshot.outcome).toBe(RECAP_OUTCOME_UNVERIFIABLE);
    expect(story.dataSnapshot.surprise).toBe('N/A');
  });

  it('Row 4 — feed disagreement: printed number follows the CALENDAR operands, not /fundamentals', async () => {
    // Calendar: 5.20 vs 5.00 → +4.0% beat. Foreign feed insists −30% / miss.
    getEarningsResult.mockResolvedValue({ resolved: true, surprisePercent: -30, outcome: 'miss' });
    const { story, prompt } = await runOne([calRow('MSFT', 5.20, 5.00)]);

    expect(story.dataSnapshot.surprise).toBe('+4.0%'); // calendar, not −30
    expect(story.dataSnapshot.outcome).toBe('beat');
    expect(prompt).toContain('Surprise: +4.0%');
    expect(prompt).not.toContain('-30.0%'); // the pre-fix foreign-feed render
  });
});

// ── Pure-helper guards (forward): formula + degrade boundaries ──────────────
describe('deriveRecapSurprise — matches the STRICT adapter formula + degrade', () => {
  it('AMD beat: (1.44−1.35)/|1.35|×100 ≈ +6.7%, outcome beat', () => {
    const r = deriveRecapSurprise(1.44, 1.35);
    expect(r.verifiable).toBe(true);
    expect(r.surprisePercent).toBeCloseTo(6.6667, 3);
    expect(r.surprise).toBe('+6.7%');
    expect(r.outcome).toBe('beat');
  });

  it('miss: negative surprise, outcome miss', () => {
    const r = deriveRecapSurprise(1.20, 1.35);
    expect(r.surprise).toBe('-11.1%');
    expect(r.outcome).toBe('miss');
  });

  it('meet: exact match → 0.0%, outcome meet', () => {
    expect(deriveRecapSurprise(1.35, 1.35)).toMatchObject({ surprise: '0.0%', outcome: 'meet' });
  });

  it('negative estimate: |e| denominator keeps the sign correct (a smaller loss is a beat)', () => {
    const r = deriveRecapSurprise(-0.30, -0.50); // beat: -0.30 > -0.50
    expect(r.surprise).toBe('+40.0%');
    expect(r.outcome).toBe('beat');
  });

  it('degrades on null / undefined / zero estimate and non-number actual (never throws)', () => {
    for (const bad of [
      deriveRecapSurprise(1.44, null),
      deriveRecapSurprise(1.44, undefined),
      deriveRecapSurprise(1.44, 0),
      deriveRecapSurprise(null, 1.35),
      deriveRecapSurprise('n/a', 1.35),
    ]) {
      expect(bad.verifiable).toBe(false);
      expect(bad.surprisePercent).toBeNull();
      expect(bad.surprise).toBe('N/A');
      expect(bad.outcome).toBe(RECAP_OUTCOME_UNVERIFIABLE);
    }
  });
});
