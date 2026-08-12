// api/fantasytimes/generate-recap.recapRestoration.test.js
// S5 acceptance rows (Recap Restoration spec V1.1 §5 + Jul 30 rulings):
// C2 window fixtures (Monday-morning → Friday; day-after-holiday →
// pre-holiday; 00:30 UTC boundary), the C8 A6 rows (already-written →
// second firing skips with ZERO model calls; unknown-timing eligible in
// both windows → exactly one story), the R-B3 UTC-midnight consensus
// coherence row, the R-B6 skip-log taxonomy + dual-count line, the R-B5
// deterministic price-move labels, and the R-B2(ii) cron re-aim fixture.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

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
import { appendEarningsResult } from '../_utils/fantasyTimesConsensus.js';

// ── fakes ────────────────────────────────────────────────────────────────

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

// Route the handler's two inline fetches: EODHD earnings calendar + the
// real-time quote. Captures the calendar URL for window assertions.
function stubFetch({ earnings = [] } = {}) {
  const calendarCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/calendar/earnings')) {
      calendarCalls.push(String(url));
      return { ok: true, json: async () => ({ earnings }) };
    }
    if (String(url).includes('/real-time/')) {
      return { ok: true, json: async () => ({ close: 100.5, change_p: 1.25 }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
  return calendarCalls;
}

const MSFT_AMC_TODAY = {
  code: 'MSFT.US', name: 'Microsoft', report_date: '2026-07-30',
  actual_eps: 3.1, eps_estimate: 2.9, before_after_market: 'AfterMarket',
};

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

// ── the rows ─────────────────────────────────────────────────────────────

describe('S5 windows (R-B2)', () => {
  it('evening fire queries [today, today] in ET, and writes the AMC recap with honest labels', async () => {
    vi.setSystemTime(new Date('2026-07-30T21:00:00Z')); // 17:00 ET Thursday
    const calendarCalls = stubFetch({ earnings: [MSFT_AMC_TODAY] });
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(calendarCalls[0]).toContain('from=2026-07-30&to=2026-07-30');
    expect(res.body.stories[0].outcome).toBe('beat');
    expect(added).toHaveLength(1);
    const story = added[0].doc;
    expect(story.referentDate).toBe('2026-07-30');       // R-B4 top-level
    expect(story.beforeAfterMarket).toBe('AMC');         // R-B5 top-level
    expect(story.dataSnapshot.reportDate).toBeUndefined(); // C1: never inside dataSnapshot

    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Report timing: AMC (reports today)');
    expect(prompt).toContain("Into-earnings session move (pre-reaction — the report drops after today's close)");
    expect(prompt).not.toMatch(/Current price:/);
    expect(loggedLines().some((l) => l.includes('outcome=wrote fetched=1 tracked=1'))).toBe(true);
  });

  it('C2 fixture: Monday 07:00 ET morning fire queries [Friday, Monday] and labels prior-session AMC as early reaction', async () => {
    vi.setSystemTime(new Date('2026-07-27T11:00:00Z')); // Monday 07:00 ET (EDT)
    const fridayAmc = { ...MSFT_AMC_TODAY, code: 'NVDA.US', name: 'NVIDIA', report_date: '2026-07-24' };
    const calendarCalls = stubFetch({ earnings: [fridayAmc] });
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler({ ...cronReq }, makeRes());

    expect(calendarCalls[0]).toContain('from=2026-07-24&to=2026-07-27'); // Friday, via the walker
    expect(added[0].doc.referentDate).toBe('2026-07-24');
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Report timing: AMC (reported the prior session)');
    // 07:00 ET is pre-open (review H1): the quote may still reflect the
    // prior close, so the label forbids attribution instead of claiming an
    // early reaction.
    expect(prompt).toContain('Pre-open quote');
    expect(prompt).not.toContain('Early reaction session move');
  });

  it('post-open morning firing labels prior-session AMC as early reaction (R-B5)', async () => {
    vi.setSystemTime(new Date('2026-07-27T14:00:00Z')); // Monday 10:00 ET — market open
    const fridayAmc = { ...MSFT_AMC_TODAY, code: 'NVDA.US', name: 'NVIDIA', report_date: '2026-07-24' };
    stubFetch({ earnings: [fridayAmc] });
    const { db } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler({ ...cronReq }, makeRes());

    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Early reaction session move (first session after the report)');
  });

  it('C2 fixture: day-after-holiday morning fire walks to the pre-holiday session', async () => {
    vi.setSystemTime(new Date('2026-06-22T11:00:00Z')); // Monday after Juneteenth Friday
    const calendarCalls = stubFetch({ earnings: [] });
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    await handler({ ...cronReq }, makeRes());

    expect(calendarCalls[0]).toContain('from=2026-06-18&to=2026-06-22'); // pre-holiday Thursday
  });

  it('C2 fixture: 00:30 UTC boundary — the window is the ET day, not the UTC day', async () => {
    vi.setSystemTime(new Date('2026-07-31T00:30:00Z')); // 20:30 ET Thu Jul 30 → evening fire
    const calendarCalls = stubFetch({ earnings: [] });
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    await handler({ ...cronReq }, makeRes());

    expect(calendarCalls[0]).toContain('from=2026-07-30&to=2026-07-30');
    expect(calendarCalls[0]).not.toContain('2026-07-31');
  });
});

describe('R-B3: UTC-midnight consensus coherence (replacement acceptance row)', () => {
  it("the 8pm-ET fire's operand write and story land coherently — one instant, the locked UTC expression", async () => {
    vi.setSystemTime(new Date('2026-07-31T00:30:00Z')); // 20:30 ET Jul 30; UTC day is Jul 31
    stubFetch({ earnings: [MSFT_AMC_TODAY] });
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler({ ...cronReq }, makeRes());

    expect(added).toHaveLength(1);
    const story = added[0].doc;
    const consensusKey = appendEarningsResult.mock.calls[0][0];
    // The locked join: adapter applies the same UTC expression to
    // story.publishedAt — must land on the doc the writer keyed.
    expect(consensusKey).toBe(story.publishedAt.toISOString().split('T')[0]);
    expect(consensusKey).toBe('2026-07-31'); // UTC firing date, NOT the ET day or event date
  });
});

describe('C8 A6 rows + referent dedup (R-B4)', () => {
  it('already-written: second firing skips with ZERO model calls', async () => {
    vi.setSystemTime(new Date('2026-07-30T22:00:00Z'));
    stubFetch({ earnings: [MSFT_AMC_TODAY] });
    const { db } = makeFakeDb([
      { type: 'earnings_recap', primaryTicker: 'MSFT', referentDate: '2026-07-30', status: 'published' },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.body.code).toBe('already_written');
    expect(wireModelCall).not.toHaveBeenCalled(); // zero model calls on a hit
    expect(loggedLines().some((l) => l.includes('outcome=already_written fetched=1 tracked=1'))).toBe(true);
  });

  it('unknown-timing row eligible in BOTH windows → exactly one story across the two firings', async () => {
    const unknownTiming = { ...MSFT_AMC_TODAY, before_after_market: null };

    // Firing 1: same-day evening → writes.
    vi.setSystemTime(new Date('2026-07-30T21:00:00Z'));
    stubFetch({ earnings: [unknownTiming] });
    const { db: db1, added: added1 } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db1);
    await handler({ ...cronReq }, makeRes());
    expect(added1).toHaveLength(1);
    expect(added1[0].doc.beforeAfterMarket).toBeNull();
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Session move (report timing unconfirmed — do not attribute it to the report)');

    // Firing 2: next-morning window still sees the Jul-30 row — the
    // referent dedup, not the window, guarantees exactly-once.
    vi.clearAllMocks();
    stubToolResponse();
    vi.setSystemTime(new Date('2026-07-31T13:00:00Z')); // 09:00 ET Friday, morning fire
    stubFetch({ earnings: [unknownTiming] });
    const { db: db2, added: added2 } = makeFakeDb([{ ...added1[0].doc }]);
    getFirebaseAdmin.mockReturnValue(db2);
    const res2 = makeRes();
    await handler({ ...cronReq }, res2);

    expect(res2.body.code).toBe('already_written');
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(added2).toHaveLength(0);
  });

  it('a superseded story does NOT satisfy the dedup (C8(b) non-superseded)', async () => {
    vi.setSystemTime(new Date('2026-07-30T22:00:00Z'));
    stubFetch({ earnings: [MSFT_AMC_TODAY] });
    const { db, added } = makeFakeDb([
      { type: 'earnings_recap', primaryTicker: 'MSFT', referentDate: '2026-07-30', status: 'published', wireSuperseded: true },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    await handler({ ...cronReq }, makeRes());

    expect(wireModelCall).toHaveBeenCalledTimes(1);
    expect(added).toHaveLength(1);
  });
});

describe('R-B6 skip-log taxonomy', () => {
  it('fetch_failed: an EODHD outage is distinguishable from a quiet window', async () => {
    vi.setSystemTime(new Date('2026-07-30T21:00:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/calendar/earnings')) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({}) };
    }));
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe('fetch_failed');
    expect(loggedLines().some((l) => l.includes('outcome=fetch_failed'))).toBe(true);
    expect(wireModelCall).not.toHaveBeenCalled();
  });

  it('empty_window: dual-count line fires on the zero path', async () => {
    vi.setSystemTime(new Date('2026-07-30T21:00:00Z'));
    stubFetch({ earnings: [] });
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.body.code).toBe('empty_window');
    expect(loggedLines().some((l) => l.includes('outcome=empty_window fetched=0 tracked=0'))).toBe(true);
  });

  it('operand_implausible: cents-for-dollars EPS is held loudly, zero model calls', async () => {
    vi.setSystemTime(new Date('2026-07-30T21:00:00Z'));
    stubFetch({ earnings: [{ ...MSFT_AMC_TODAY, actual_eps: 310, eps_estimate: 3.1 }] });
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler({ ...cronReq }, res);

    expect(res.body.code).toBe('operand_implausible');
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(loggedLines().some((l) => l.includes('operand_implausible symbol=MSFT'))).toBe(true);
  });
});

describe('R-B2(ii) cron re-aim fixture', () => {
  it('one morning slot (~13:00 UTC) replaced the 0-UTC firing; entry count unchanged (C3)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const recapCron = vercel.crons.find((c) => c.path === '/api/fantasytimes/generate-recap');
    expect(recapCron.schedule).toBe('0 13,20,21,22,23 * * 1-5');
    const econCron = vercel.crons.find((c) => c.path === '/api/fantasytimes/generate-econ?mode=recap');
    expect(econCron.schedule).toBe('0,30 13,14,15,16,17,18,19,20,21 * * 1-5');
  });
});
