// api/fantasytimes/generate-econ.recapRestoration.test.js
// S3 acceptance rows (Recap Restoration spec V1.1 §5 + Jul 30 rulings):
// R-A1 array-driven Tier-1 (jobless claims included, priority high-first),
// R-B1 deterministic operands + R-B1a settle/plausibility gates, the C8 A6
// already-written row (zero model calls), R-B4 referent dedup closing the
// S3 multi-day 5×, R-B6 taxonomy + dual-count on EVERY firing including
// the zero path, R-B3 consensus coherence, and the R2 degrade row live
// (missing estimate publishes honestly instead of rejecting).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: vi.fn() }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: vi.fn(() => false) }));
vi.mock('../_utils/wireModelCall.js', () => ({ wireModelCall: vi.fn() }));
vi.mock('../_utils/ingestedClaims.js', () => ({
  getClaimsForReporter: vi.fn(async () => []),
  formatClaimsForPrompt: vi.fn(() => ''),
}));
vi.mock('../_utils/wireContinuity.js', () => ({ buildContinuityContext: vi.fn(async () => '') }));
vi.mock('../_utils/wireMetrics.js', () => ({ recordWireSample: vi.fn(async () => {}) }));
vi.mock('../_utils/fantasyTimesConsensus.js', () => ({
  appendEconomics: vi.fn(async () => {}),
  appendEarningsResult: vi.fn(async () => {}),
}));
vi.mock('../helpers/sonar.js', () => ({ querySonar: vi.fn(async () => ({ text: '{}', citations: [] })) }));
vi.mock('../_utils/fetchEconomicEventsEODHD.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchEconomicEventsEODHD: vi.fn() };
});

import handler from './generate-econ.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { appendEconomics } from '../_utils/fantasyTimesConsensus.js';
import { fetchEconomicEventsEODHD } from '../_utils/fetchEconomicEventsEODHD.js';

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

const recapReq = () => ({ headers: { 'x-vercel-cron': '1' }, method: 'POST', query: { mode: 'recap' }, body: {} });

function stubToolResponse() {
  wireModelCall.mockResolvedValue({
    response: {
      content: [{ type: 'tool_use', input: { headline: 'H', subheadline: 'S', body: 'B', themes: [], sentiment: 'neutral', recommended_action: 'RESEARCH' } }],
      stop_reason: 'tool_use',
    },
    generationConfig: { seam: 'neta_econ_recap' },
  });
}

function stubQuoteFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/real-time/')) {
      return { ok: true, json: async () => ({ close: 500.25, change_p: -0.8 }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

// Thu 2026-07-30 window [2026-07-29, 2026-07-30]: PCE(high) + GDP(high) +
// Jobless Claims(medium) release on 7-30 (8:30 AM ET). Row types/units are
// the LITERAL captured feed strings (Econ Capture rulings §1: exact-type
// matching; counts in feed thousands; operands numeric).
const GDP_ROW = { type: 'GDP Growth Rate', comparison: 'qoq', country: 'US', date: '2026-07-30 12:30:00', actual: 3.0, previous: 2.4, estimate: 2.5 };
const CLAIMS_ROW = { type: 'Initial Jobless Claims', comparison: null, country: 'US', date: '2026-07-30 12:30:00', actual: 218, previous: 224, estimate: 225 };

let logSpy;
let errSpy;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  process.env.CLAUDE_API_KEY = 'test-claude-key';
  process.env.EODHD_API_KEY = 'test-eodhd-key';
  stubToolResponse();
  stubQuoteFetch();
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

describe('S3 deterministic recap path (R-A1 + R-B1)', () => {
  it('writes a VERIFIED recap from array event + EODHD operands — prompt, snapshot and consensus share the parsed numbers', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z')); // 15:00 ET
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('recap');
    expect(fetchEconomicEventsEODHD).toHaveBeenCalledWith({ fromDate: '2026-07-29', toDate: '2026-07-30' });

    const story = added[0].doc;
    expect(story.type).toBe('econ_recap');
    expect(story.referentDate).toBe('2026-07-30');       // R-B4 top-level, the EVENT date
    expect(story.dataSnapshot.eventName).toBe('GDP Q2 2026 advance estimate');
    expect(story.dataSnapshot.actual).toBe(3.0);          // parsed number, not string
    expect(story.dataSnapshot.estimate).toBe(2.5);

    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Actual: 3');
    expect(prompt).toContain('Estimate: 2.5');
    expect(prompt).toContain('Print verification: VERIFIED');

    // R-B3 coherence: consensus key = locked UTC expression on the publish instant.
    const consensusKey = appendEconomics.mock.calls[0][0];
    expect(consensusKey).toBe(story.publishedAt.toISOString().split('T')[0]);
    expect(appendEconomics.mock.calls[0][1].actual).toBe(3.0);

    expect(loggedLines().some((l) => l.includes('outcome=wrote fetched=1 tier1=1'))).toBe(true);
  });

  it('priority: high-impact categories generate before medium (R-A1)', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([CLAIMS_ROW, GDP_ROW]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler(recapReq(), makeRes());

    // GDP (high) wins over Jobless Claims (medium) even though claims
    // sorted first in the fetch.
    expect(added[0].doc.dataSnapshot.eventName).toBe('GDP Q2 2026 advance estimate');
  });

  it('jobless claims IS recappable by array membership (R-A1) — the medium-impact keyword gap is closed', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([CLAIMS_ROW]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler(recapReq(), makeRes());

    expect(added).toHaveLength(1);
    expect(added[0].doc.dataSnapshot.eventName).toBe('Initial Jobless Claims');
    expect(added[0].doc.dataSnapshot.actual).toBe(218); // feed thousands, numeric passthrough
  });

  it('R2 degrade row live: missing estimate publishes honestly, never rejects wholesale', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([{ ...GDP_ROW, estimate: null }]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);

    await handler(recapReq(), makeRes());

    expect(added).toHaveLength(1);
    expect(added[0].doc.dataSnapshot.estimate).toBeNull();
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('Estimate: not available');
    expect(prompt).toContain('Print verification: NOT VERIFIABLE (missing consensus estimate)');
  });
});

describe('R-B1a gates', () => {
  it('settle delay: a print inside release+30min is not yet eligible', async () => {
    vi.setSystemTime(new Date('2026-07-30T12:45:00Z')); // 08:45 ET < 09:00 settle
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler(recapReq(), res);
    expect(res.body.code).toBe('empty_window');

    // One tick later it settles and writes.
    vi.clearAllMocks();
    stubToolResponse();
    stubQuoteFetch();
    vi.setSystemTime(new Date('2026-07-30T13:05:00Z')); // 09:05 ET
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    const { db, added } = makeFakeDb();
    getFirebaseAdmin.mockReturnValue(db);
    await handler(recapReq(), makeRes());
    expect(added).toHaveLength(1);
    // 09:05 ET is pre-open (review H1): the SPY/QQQ block is relabeled a
    // snapshot with a do-not-attribute instruction, not a "reaction".
    const prompt = wireModelCall.mock.calls[0][1].messages[0].content;
    expect(prompt).toContain('MARKET SNAPSHOT (pre-open');
    expect(prompt).not.toContain('MARKET REACTION:');
  });

  it('operand_implausible: a unit-mismatched print is held loudly with zero model calls', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([{ ...GDP_ROW, actual: 300, estimate: 2.5 }]);
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(res.body.code).toBe('operand_implausible');
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(loggedLines().some((l) => l.includes('operand_implausible category=GDP'))).toBe(true);
  });
});

describe('R-B6 taxonomy + F1 dual count', () => {
  it('fetch_failed: an EODHD outage never reproduces the silent zero', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockRejectedValue(new Error('EODHD economic-events responded HTTP 503'));
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe('fetch_failed');
    expect(loggedLines().some((l) => l.includes('outcome=fetch_failed'))).toBe(true);
    expect(wireModelCall).not.toHaveBeenCalled();
  });

  it('empty_window: the dual-count line fires on the zero path (the old silent zero)', async () => {
    vi.setSystemTime(new Date('2026-07-28T19:00:00Z')); // Tue: JOLTS(7-28) unreleased in rows
    fetchEconomicEventsEODHD.mockResolvedValue([]);
    getFirebaseAdmin.mockReturnValue(makeFakeDb().db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(res.body.code).toBe('empty_window');
    expect(loggedLines().some((l) => l.match(/outcome=empty_window fetched=0 tier1=0/))).toBe(true);
  });
});

describe('C8 A6 + R-B4: referent dedup closes the S3 multi-day 5×', () => {
  it('already-written: a prior firing’s story for the same (slug, referentDate) skips with ZERO model calls', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    const { db } = makeFakeDb([
      {
        type: 'econ_recap', referentDate: '2026-07-30', status: 'published',
        dataSnapshot: { eventName: 'GDP Q2 2026 advance estimate' },
      },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(res.body.code).toBe('already_written');
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(loggedLines().some((l) => l.includes('outcome=already_written fetched=1 tier1=1'))).toBe(true);
  });

  it('the dedup keys on the referent, not the firing day: next-morning re-exposure of the same release skips', async () => {
    // Friday morning fire re-sees Thursday's GDP release in the two-session
    // window; the Thursday story (a different FIRING day) must block it.
    vi.setSystemTime(new Date('2026-07-31T13:30:00Z')); // Fri 09:30 ET
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    const { db, added } = makeFakeDb([
      {
        type: 'econ_recap', referentDate: '2026-07-30', status: 'published',
        dataSnapshot: { eventName: 'GDP Q2 2026 advance estimate' },
      },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler(recapReq(), res);

    expect(fetchEconomicEventsEODHD).toHaveBeenCalledWith({ fromDate: '2026-07-30', toDate: '2026-07-31' });
    expect(res.body.code).toBe('already_written');
    expect(wireModelCall).not.toHaveBeenCalled();
    expect(added).toHaveLength(0);
  });

  it('an alias of the same release converges on one slug and still dedups', async () => {
    vi.setSystemTime(new Date('2026-07-30T19:00:00Z'));
    fetchEconomicEventsEODHD.mockResolvedValue([GDP_ROW]);
    const { db } = makeFakeDb([
      { type: 'econ_recap', referentDate: '2026-07-30', status: 'published', dataSnapshot: { eventName: 'GDP Growth Q2 (Advance)' } },
    ]);
    getFirebaseAdmin.mockReturnValue(db);

    const res = makeRes();
    await handler(recapReq(), res);
    expect(res.body.code).toBe('already_written');
  });
});
