// api/research/setup-read.test.js
//
// GET /api/research/setup-read — the chart's evidence, read only (spec
// docs/specs/CHART_EVIDENCE_SPEC_V1.md §4, RR-1 – RR-9): the order of checks (each status
// in turn), the flag off, 'allowlist' and 'on', the symbol (case, the store's form, crypto,
// the ranked list), the server's session (a client `session` is ignored), the three answers
// and `behind`, the body's exact keys, the 60-second cache, and READ ONLY.
//
// READ ONLY, IN A FORM THAT CAN FAIL: the store is NOT mocked. The route's real
// readSnapshot runs over an in-memory Admin SDK whose every write verb, transaction, batch
// and getAll throws and is recorded, and whose claims collection throws on any touch;
// global fetch throws and is recorded. A route that called getOrAcquireSnapshot (a claim
// transaction), read the claims, wrote anything or fetched would fail the afterEach.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file imports the route — and through it
// src/components/Research/Sheet/chartReadMode.js, setupReadContract.js and
// src/config/researchModalFlags.js — UNMOCKED (the flag module is spread from the original;
// only CHART_READ_MODE is a getter). A browser dependency entering that graph explodes here,
// in Node. Never mock them.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readRecordSet } from '../_utils/setupRead/__fixtures__/readRecords.js';
import { SETUP_READ_BODY_KEYS, SETUP_READ_FIELDS, SETUP_READ_PREVIOUS_FIELDS, SETUP_READ_PREVIOUS_CHECK_FIELDS } from '../../src/components/Research/Sheet/setupReadContract.js';
import { projectSetupRecord } from '../_utils/setupRead/projection.js';

const state = vi.hoisted(() => ({ uid: 'player-uid-1', authFails: false, mode: 'on', allow: ['player-uid-1'], middlewareHandles: false, docs: {}, reads: [], touches: [], throwOnRead: false }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: (_q, _r, opts) => { state.secOpts = opts; return state.middlewareHandles; } }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return { uid: state.uid };
  },
}));
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => state.allow }));
vi.mock('../../src/config/researchModalFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CHART_READ_MODE() { return state.mode; },
}));
vi.mock('../_utils/firebaseAdmin.js', () => {
  const forbid = (what) => () => { state.touches.push(what); throw new Error(`read-only route touched ${what}`); };
  const docRef = (path) => {
    const ref = {
      get: async () => {
        state.reads.push(path);
        if (state.throwOnRead) throw state.readError ?? Object.assign(new Error('firestore down'), { code: 14 });
        const data = state.docs[path];
        return { exists: data !== undefined, data: () => (data === undefined ? undefined : structuredClone(data)) };
      },
      collection: (sub) => collectionRef(`${path}/${sub}`),
    };
    for (const verb of ['set', 'update', 'delete', 'create']) ref[verb] = forbid(`${verb}:${path}`);
    return ref;
  };
  const collectionRef = (name) => {
    if (/(^|\/)setupEvidenceClaims$/.test(name)) return forbid(`claims:${name}`)();
    return { doc: (id) => docRef(`${name}/${id}`), add: forbid(`add:${name}`), where: forbid(`query:${name}`), get: forbid(`list:${name}`) };
  };
  const db = {
    collection: (name) => collectionRef(name),
    doc: forbid('db.doc'),
    getAll: forbid('getAll'),
    batch: forbid('batch'),
    bulkWriter: forbid('bulkWriter'),
    runTransaction: forbid('runTransaction'),
    recursiveDelete: forbid('recursiveDelete'),
  };
  return { getFirebaseAdmin: () => db };
});

const route = await import('./setup-read.js');
const { default: handler, resetSetupReadState, SETUP_READ_CACHE_MS, SETUP_READ_USER_RATE_LIMIT, symbolOf, sessionsToTry, sessionBefore } = route;

// Mon 16 Nov 2026, 5:00 PM ET: Monday's session has closed.
const AFTER_CLOSE = Date.parse('2026-11-16T22:00:00.000Z');
const LATEST = '2026-11-16';
const PRIOR = '2026-11-13'; // the Friday before
const EARLIER = '2026-11-12'; // the Thursday before that: `previous` of a `behind` read (RD-1)
const SYMBOL = 'BRK-B';
const ROUTE_SRC = readFileSync(fileURLToPath(new URL('./setup-read.js', import.meta.url)), 'utf8');

let latest;
let prior;
let earlier;
let other;
let otherPrior;
beforeAll(async () => {
  latest = await readRecordSet({ session: LATEST, symbol: SYMBOL, fetchedAt: '2026-11-16T22:31:00.000Z' });
  prior = await readRecordSet({ session: PRIOR, symbol: SYMBOL, fetchedAt: '2026-11-13T22:31:00.000Z' });
  earlier = await readRecordSet({ session: EARLIER, symbol: SYMBOL, fetchedAt: '2026-11-12T22:31:00.000Z' });
  other = await readRecordSet({ session: LATEST, symbol: 'AAPL', fetchedAt: '2026-11-16T22:31:00.000Z' });
  otherPrior = await readRecordSet({ session: PRIOR, symbol: 'AAPL', fetchedAt: '2026-11-13T22:31:00.000Z' });
});

const put = ({ id, record }) => { state.docs[`setupEvidence/${id}`] = record; };
const req = (over = {}) => ({ method: 'GET', query: { symbol: SYMBOL }, headers: {}, ...over });
function res() {
  const r = { statusCode: null, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const call = async (over) => { const r = res(); await handler(req(over), r); return r; };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AFTER_CLOSE));
  resetSetupReadState();
  Object.assign(state, { uid: 'player-uid-1', authFails: false, mode: 'on', allow: ['player-uid-1'], middlewareHandles: false, docs: {}, reads: [], touches: [], throwOnRead: false, readError: null });
  // ZERO PROVIDER CALLS: any network call fails the row that makes it.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('a provider call — the read route never makes one'); }));
});
afterEach(() => {
  expect(state.touches).toEqual([]); // no write, transaction, batch, getAll, query or claims access
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the order of checks (RR-8), each status in turn', () => {
  it('1 — the security middleware answering ends the request before anything else, with the per-IP window', async () => {
    state.middlewareHandles = true;
    const r = await call();
    expect(r.statusCode).toBeNull();
    expect(state.reads).toEqual([]);
    expect(state.secOpts).toEqual({ rateLimit: { limit: 60, windowMs: 60_000 } });
  });
  it('2 — not GET → 405, before auth, no read', async () => {
    state.authFails = true;
    const r = await call({ method: 'POST' });
    expect(r.statusCode).toBe(405);
    expect(state.reads).toEqual([]);
  });
  it('3 — no verified token → 401, before the flag (flag off still says 401), no read', async () => {
    state.authFails = true;
    state.mode = 'off';
    const r = await call();
    expect(r.statusCode).toBe(401);
    expect(state.reads).toEqual([]);
  });
  it("4 — the flag off → 404 chart_read_unavailable for every player, the allowlisted included, before the symbol (a bad one still says 404)", async () => {
    state.mode = 'off';
    for (const query of [{ symbol: SYMBOL }, { symbol: 'NOT A SYMBOL' }, { symbol: 'BTC' }, {}]) {
      const r = await call({ query });
      expect([r.statusCode, r.body]).toEqual([404, { error: 'chart_read_unavailable' }]);
    }
    expect(state.reads).toEqual([]);
  });
  it("4 — 'allowlist': a player the server allowlist does not name → 404; one it names → 200", async () => {
    state.mode = 'allowlist';
    put(latest.VALID_PULLBACK);
    state.allow = ['someone-else'];
    expect((await call()).statusCode).toBe(404);
    expect(state.reads).toEqual([]);
    state.allow = ['someone-else', 'player-uid-1']; // read at CALL time, never cached
    expect((await call()).statusCode).toBe(200);
  });
  it("4 — 'on': any signed-in player; a value outside the walked states reads 'off'", async () => {
    put(latest.VALID_PULLBACK);
    state.allow = [];
    expect((await call()).statusCode).toBe(200);
    for (const mode of ['ON', 'true', true, undefined, '']) {
      state.mode = mode;
      expect((await call()).statusCode).toBe(404);
    }
  });
  it('5 — a symbol that is not one of the ranked stocks → 400 invalid_symbol, before the limiter and any read', async () => {
    for (const symbol of ['ZZZZ', 'SPY', 'BRK/B', 'AAPL.US']) {
      const r = await call({ query: { symbol } });
      expect([r.statusCode, r.body]).toEqual([400, { error: 'invalid_symbol' }]);
    }
    expect(state.reads).toEqual([]);
  });
  it('5 — no symbol, an empty one, a list of none or a long one → 400 invalid_request', async () => {
    for (const query of [{}, { symbol: '' }, { symbol: '   ' }, { symbol: [] }, { symbol: 'A'.repeat(25) }, { symbol: { x: 1 } }]) {
      const r = await call({ query });
      expect([r.statusCode, r.body]).toEqual([400, { error: 'invalid_request' }]);
    }
    expect(state.reads).toEqual([]);
  });
  it('5 — crypto → 400 unsupported_symbol_class, in any case or form', async () => {
    for (const symbol of ['BTC', 'btc', 'BTC-USD.CC', 'eth-usd.cc', 'SOL.CC']) {
      const r = await call({ query: { symbol } });
      expect([r.statusCode, r.body]).toEqual([400, { error: 'unsupported_symbol_class' }]);
    }
    expect(state.reads).toEqual([]);
  });
  it('6 — the per-user limiter answers 429 BEFORE any read', async () => {
    put(latest.VALID_PULLBACK);
    for (let i = 0; i < SETUP_READ_USER_RATE_LIMIT.limit; i += 1) expect((await call()).statusCode).toBe(200);
    const readsBefore = state.reads.length;
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([429, { error: 'rate_limited' }]);
    expect(state.reads.length).toBe(readsBefore);
    state.uid = 'player-uid-2'; // the window is per player
    expect((await call()).statusCode).toBe(200);
  });
  it('8 — Cache-Control: private, no-store on every answer the route writes', async () => {
    put(latest.VALID_PULLBACK);
    for (const over of [{ method: 'POST' }, {}, { query: { symbol: 'ZZZZ' } }]) expect((await call(over)).headers['Cache-Control']).toBe('private, no-store');
  });
});

describe('the symbol (RR-3)', () => {
  it('matched without regard to case, "." read as "-": the store\'s form is what is read', async () => {
    put(latest.VALID_PULLBACK);
    for (const symbol of ['BRK-B', 'brk-b', 'BRK.B', ' brk.b ', ['brk.b', 'AAPL']]) {
      resetSetupReadState();
      state.reads = [];
      const r = await call({ query: { symbol } });
      expect([r.statusCode, r.body.symbol, r.body.answer]).toEqual([200, 'BRK-B', 'measured']);
      // `read`, then `previous`'s one more read (RD-3) — both in the store's form.
      expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`, `setupEvidence/${prior.VALID_PULLBACK.id}`]);
    }
  });
  it('symbolOf, pure', () => {
    expect(symbolOf('aapl')).toEqual({ symbol: 'AAPL' });
    expect(symbolOf('Brk.b')).toEqual({ symbol: 'BRK-B' });
    expect(symbolOf('BTC')).toEqual({ error: 'unsupported_symbol_class' });
    expect(symbolOf('QQQ')).toEqual({ error: 'invalid_symbol' });
    expect(symbolOf(42)).toEqual({ error: 'invalid_request' });
  });
});

describe('the session is the server\'s (RR-4) and the three answers (RR-5)', () => {
  it('measured: the last completed session\'s record, behind false; the session before is read once more, as `previous` (RD-3)', async () => {
    put(latest.VALID_PULLBACK);
    put(prior.SPLIT); // never `read` — only `previous` (RD-1)
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.body)).toEqual([...SETUP_READ_BODY_KEYS]);
    expect(r.body).toMatchObject({ answer: 'measured', symbol: SYMBOL, servedAt: AFTER_CLOSE, sessionsTried: [LATEST] });
    expect(Object.keys(r.body.read)).toEqual([...SETUP_READ_FIELDS]);
    expect(r.body.read).toMatchObject({ session: LATEST, asOf: LATEST, behind: false, verdict: 'valid', pattern: 'pullback_resume' });
    expect(r.body.previous).toMatchObject({ session: PRIOR, verdict: 'unknown', reason: 'basis_discontinuity' });
    expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`, `setupEvidence/${prior.SPLIT.id}`]);
  });
  it('refused: a record that says the evidence could not be used, with its reason', async () => {
    put(latest.SPLIT);
    const r = await call();
    expect(r.body).toMatchObject({ answer: 'refused', sessionsTried: [LATEST] });
    expect(r.body.read).toMatchObject({ verdict: 'unknown', reason: 'basis_discontinuity', behind: false });
  });
  it('measured, though the verdict is unknown: usable evidence that lacked one fact', async () => {
    put(latest.UNKNOWN_V);
    const r = await call();
    expect(r.body).toMatchObject({ answer: 'measured', read: { verdict: 'unknown', reason: 'missing_fact', missing: ['V'] } });
  });
  it('behind: only the session before has a record → that one, behind true, two reads in order, then `previous`\'s third (RD-3)', async () => {
    put(prior.EXTENDED);
    const r = await call();
    expect(r.body).toMatchObject({ answer: 'measured', sessionsTried: [LATEST, PRIOR] });
    expect(r.body.read).toMatchObject({ session: PRIOR, asOf: PRIOR, behind: true, verdict: 'invalid', reason: 'extended', patternsSatisfied: ['pullback_resume'] });
    expect(r.body.previous).toBeNull(); // the session before PRIOR has no record
    expect(state.reads).toEqual([`setupEvidence/${latest.EXTENDED.id}`, `setupEvidence/${prior.EXTENDED.id}`, `setupEvidence/${earlier.EXTENDED.id}`]);
  });
  it('absent: no record for either session → read null, previous null, exactly two reads (no third)', async () => {
    put(other.VALID_PULLBACK); // another symbol's record is not this one's
    put(earlier.VALID_PULLBACK); // a record two sessions back is never `previous` of nothing (RD-1)
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ answer: 'absent', symbol: SYMBOL, servedAt: AFTER_CLOSE, sessionsTried: [LATEST, PRIOR], read: null, previous: null });
    expect(state.reads).toHaveLength(2);
  });
  it('a client `session` (and any other query key) is ignored: the server picks the session', async () => {
    put(prior.VALID_PULLBACK);
    const r = await call({ query: { symbol: SYMBOL, session: PRIOR, asOf: PRIOR, ruleSet: 'x' } });
    expect(r.body.sessionsTried).toEqual([LATEST, PRIOR]);
    expect(r.body.read.behind).toBe(true);
  });
  it('before the close the last completed session is the day before', async () => {
    vi.setSystemTime(new Date('2026-11-16T15:00:00.000Z')); // Mon 10:00 AM ET
    put(prior.VALID_PULLBACK);
    const r = await call();
    expect(r.body).toMatchObject({ answer: 'measured', sessionsTried: [PRIOR] });
    expect(r.body.read.behind).toBe(false);
    expect(sessionsToTry(Date.parse('2026-11-16T15:00:00.000Z'))).toEqual([PRIOR, '2026-11-12']);
    expect(sessionsToTry(Date.parse('2026-11-15T15:00:00.000Z'))).toEqual([PRIOR, '2026-11-12']); // a Sunday
  });
  it('a calendar that cannot name the session → 503, no read', async () => {
    vi.setSystemTime(new Date('2029-03-05T22:00:00.000Z'));
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([503, { error: 'calendar_missing' }]);
    expect(state.reads).toEqual([]);
  });
});

describe('failures are never an answer', () => {
  it('a record the projection cannot read → 500, never absent, never part of it', async () => {
    put({ ...latest.VALID_PULLBACK, record: { ...latest.VALID_PULLBACK.record, schemaVersion: 2 } });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([500, { error: 'Could not read the record.' }]);
    expect(errors.mock.calls.flat().join(' ')).not.toContain(SYMBOL);
    errors.mockRestore();
  });
  it('a failed read → 500', async () => {
    state.throwOnRead = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call();
    expect(r.statusCode).toBe(500);
    errors.mockRestore();
  });
});

describe('review lens 2 (docs/audits/20261116_BUILD_CHART_EVIDENCE.md §4): rows that bite', () => {
  it('L2-2: with the window full, a call for an UNCACHED symbol answers 429 and reads nothing', async () => {
    put(latest.VALID_PULLBACK);
    put(other.VALID_PULLBACK);
    for (let i = 0; i < SETUP_READ_USER_RATE_LIMIT.limit; i += 1) expect((await call()).statusCode).toBe(200);
    const readsBefore = state.reads.length;
    const r = await call({ query: { symbol: 'AAPL' } }); // never read before: a read here would be a real read
    expect([r.statusCode, r.body]).toEqual([429, { error: 'rate_limited' }]);
    expect(state.reads.length).toBe(readsBefore);
  });
  it('L2-3: with the window full, a bad symbol still answers 400 — the symbol is checked before the limiter', async () => {
    put(latest.VALID_PULLBACK);
    for (let i = 0; i < SETUP_READ_USER_RATE_LIMIT.limit; i += 1) await call();
    const r = await call({ query: { symbol: 'ZZZZ' } });
    expect([r.statusCode, r.body]).toEqual([400, { error: 'invalid_symbol' }]);
  });
  it('L2-3: across the close, thirty seconds apart, the cache never serves the session before', async () => {
    put(prior.VALID_PULLBACK);
    put(latest.VALID_PULLBACK);
    vi.setSystemTime(new Date('2026-11-16T20:59:50.000Z')); // Mon 3:59:50 PM ET: Friday is the last completed session
    expect((await call()).body.read.session).toBe(PRIOR);
    vi.setSystemTime(new Date('2026-11-16T21:00:20.000Z')); // 4:00:20 PM ET: Monday has closed
    const after = await call();
    expect(after.body.read.session).toBe(LATEST);
    expect(after.body.read.behind).toBe(false);
  });
  it('L2-8: a failed read whose message names the symbol never puts it in the log or the body', async () => {
    state.throwOnRead = true;
    state.readError = Object.assign(new Error(`read failed for ${SYMBOL} at 200.37`), { code: 14 });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call();
    expect([r.statusCode, r.body]).toEqual([500, { error: 'Could not read the record.' }]);
    expect(errors.mock.calls.flat().map(String).join(' ')).not.toMatch(/BRK-B|200.37/);
    errors.mockRestore();
  });
});

describe('the cache (RR-8): per instance, keyed by symbol and session, at most 60 seconds', () => {
  it('a second call inside 60 s reads nothing; at 60 s it reads again', async () => {
    put(latest.VALID_PULLBACK);
    put(prior.EXTENDED);
    expect((await call()).body.answer).toBe('measured');
    expect(state.reads).toHaveLength(2); // `read` and `previous`
    vi.setSystemTime(new Date(AFTER_CLOSE + SETUP_READ_CACHE_MS - 1));
    const second = await call();
    expect(second.body.answer).toBe('measured');
    expect(second.body.previous).toMatchObject({ session: PRIOR, reason: 'extended' }); // `previous` comes from the cache too
    expect(second.body.servedAt).toBe(AFTER_CLOSE + SETUP_READ_CACHE_MS - 1);
    expect(state.reads).toHaveLength(2);
    vi.setSystemTime(new Date(AFTER_CLOSE + SETUP_READ_CACHE_MS));
    await call();
    expect(state.reads).toHaveLength(4);
  });
  it('an absent answer expires too: a record written meanwhile is read within 60 s', async () => {
    expect((await call()).body.answer).toBe('absent');
    put(latest.VALID_PULLBACK);
    expect((await call()).body.answer).toBe('absent'); // cached
    vi.setSystemTime(new Date(AFTER_CLOSE + SETUP_READ_CACHE_MS));
    expect((await call()).body.answer).toBe('measured');
  });
  it('another symbol is another key; another session is another key', async () => {
    put(latest.VALID_PULLBACK);
    put(other.VALID_PULLBACK);
    await call();
    await call({ query: { symbol: 'AAPL' } });
    expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`, `setupEvidence/${prior.VALID_PULLBACK.id}`, `setupEvidence/${other.VALID_PULLBACK.id}`, `setupEvidence/${otherPrior.VALID_PULLBACK.id}`]);
    // Tuesday after the close: the last completed session moves on, so the cached Monday answer is not used.
    vi.setSystemTime(new Date('2026-11-17T22:00:30.000Z'));
    state.reads = [];
    const r = await call();
    expect(r.body.sessionsTried).toEqual(['2026-11-17', LATEST]);
    expect(state.reads).toHaveLength(3); // Tuesday (none), Monday (behind), and Monday's `previous`
  });
  it('a cached body is a copy: changing one answer changes nothing in the next', async () => {
    put(latest.VALID_PULLBACK);
    const first = await call();
    first.body.sessionsTried.push('x');
    const second = await call();
    expect(second.body.sessionsTried).toEqual([LATEST]);
  });
});

describe('previous (the Chart view\'s read build, RD-1 – RD-5; docs/specs/CHART_READ_SPEC_V1.md)', () => {
  it('present: the session before `read`\'s, its exact closed list of fields, every value the record\'s own copy', async () => {
    put(latest.VALID_PULLBACK);
    put(prior.EXTENDED);
    const r = await call();
    expect(Object.keys(r.body)).toEqual([...SETUP_READ_BODY_KEYS]);
    expect(Object.keys(r.body.previous)).toEqual([...SETUP_READ_PREVIOUS_FIELDS]);
    for (const c of r.body.previous.checks) expect(Object.keys(c)).toEqual([...SETUP_READ_PREVIOUS_CHECK_FIELDS]);
    const full = projectSetupRecord(prior.EXTENDED.record, { session: PRIOR, symbol: SYMBOL, behind: false });
    expect(r.body.previous).toEqual({
      session: PRIOR, verdict: full.verdict, reason: full.reason, pattern: full.pattern, regime: full.regime,
      patternsSatisfied: full.patternsSatisfied, checks: full.checks.map((c) => ({ id: c.id, result: c.result })),
    });
    expect(r.body.previous).toMatchObject({ verdict: 'invalid', reason: 'extended', pattern: null, regime: 'uptrend', patternsSatisfied: ['pullback_resume'] });
    expect(r.body.previous.checks).toHaveLength(9);
  });
  it('no facts and no prices leave in `previous`: no number anywhere in it, no side, no facts', async () => {
    put(latest.VALID_PULLBACK);
    put(prior.VALID_PULLBACK);
    const r = await call();
    const walk = (v) => (Array.isArray(v) ? v.flatMap(walk) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...walk(x)]) : [v]);
    const leaves = walk(r.body.previous);
    expect(leaves.filter((x) => typeof x === 'number')).toEqual([]);
    expect(leaves).not.toContain('facts');
    expect(leaves).not.toContain('lhs');
    expect(leaves).not.toContain('rhs');
  });
  it('null when the session before has no record, and null when `read` is null', async () => {
    put(latest.VALID_PULLBACK);
    expect((await call()).body.previous).toBeNull();
    resetSetupReadState();
    state.docs = {};
    put(earlier.VALID_PULLBACK);
    const r = await call();
    expect([r.body.answer, r.body.read, r.body.previous]).toEqual(['absent', null, null]);
  });
  it('a `behind` read: `previous` is the session before ITS session, the third read', async () => {
    put(prior.VALID_PULLBACK);
    put(earlier.EXTENDED);
    const r = await call();
    expect(r.body.read).toMatchObject({ session: PRIOR, behind: true });
    expect(r.body.previous).toMatchObject({ session: EARLIER, verdict: 'invalid', reason: 'extended' });
    expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`, `setupEvidence/${prior.VALID_PULLBACK.id}`, `setupEvidence/${earlier.EXTENDED.id}`]);
  });
  it('a refused `read` still carries the session before\'s record (RD-1 names only a null read)', async () => {
    put(latest.SPLIT);
    put(prior.VALID_PULLBACK);
    const r = await call();
    expect(r.body.answer).toBe('refused');
    expect(r.body.previous).toMatchObject({ session: PRIOR, verdict: 'valid', pattern: 'pullback_resume' });
  });
  it('an unknown field planted at every level of the earlier record never leaves', async () => {
    const MARK = 'PLANTED-previous-7731';
    const rec = structuredClone(prior.VALID_PULLBACK.record);
    rec.planted = MARK;
    rec.key.planted = MARK;
    rec.entry.planted = MARK;
    rec.entry.checks = rec.entry.checks.map((c) => ({ ...c, planted: MARK }));
    rec.entry.factsUsed.C.planted = MARK;
    rec.entry.evidence.planted = MARK;
    put(latest.VALID_PULLBACK);
    put({ id: prior.VALID_PULLBACK.id, record: rec });
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(JSON.stringify(r.body.previous)).not.toContain(MARK);
    expect(JSON.stringify(r.body)).not.toContain(MARK);
  });
  it('an earlier record the projection cannot read → 500, never a null `previous` and never part of one', async () => {
    put(latest.VALID_PULLBACK);
    put({ id: prior.VALID_PULLBACK.id, record: { ...prior.VALID_PULLBACK.record, schemaVersion: 99 } });
    const r = await call();
    expect(r.statusCode).toBe(500);
    expect(r.body).toEqual({ error: 'Could not read the record.' });
  });
  it('sessionBefore, pure: the session before a session; null outside the calendar', () => {
    expect(sessionBefore(LATEST)).toBe(PRIOR);
    expect(sessionBefore(PRIOR)).toBe(EARLIER);
    expect(sessionBefore('2026-11-27')).toBe('2026-11-25'); // the day after Thanksgiving: Thursday is a holiday
    expect(sessionBefore('2026-01-02')).toBeNull(); // 2025 is outside the maintained calendar
  });
});

describe('READ ONLY (RR-1), from the source as well', () => {
  const code = ROUTE_SRC.replace(/\/\/.*$/gm, '');
  it('the store is reached through readSnapshot and lastCompletedSessionAt only; never getOrAcquireSnapshot or the claims', () => {
    const storeImport = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/_utils\/setupEvidence\/([^']+)'/g)];
    expect(storeImport.map((m) => [m[2], m[1].split(',').map((s) => s.trim()).filter(Boolean).sort()])).toEqual([['index.js', ['lastCompletedSessionAt', 'readSnapshot']]]);
    expect(code).not.toMatch(/getOrAcquireSnapshot|claimSnapshot|createFinal|settleConfirmation|releaseClaimLease|Claims/);
    expect(code.match(/\breadSnapshot\(/g)).toHaveLength(1);
  });
  it('no provider client, no fetch, no model client, no write verb, no transaction', () => {
    const specifiers = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const s of specifiers) expect(s).not.toMatch(/eodhd|provider|anthropic|gemma|gemini|openai|claude|llm|model/i);
    const fromCache = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/_utils\/marketDataCache\.js'/g)].map((m) => m[1].trim());
    expect(fromCache).toEqual(['isCryptoSymbol']); // a pure predicate; nothing that fetches
    // The route names no collection and no document itself (readSnapshot does its one read); Map#set on the
    // limiter and the cache is the only `.set(` in it, so the Admin SDK's verbs are proven by the db above.
    expect(code).not.toMatch(/\bfetch\s*\(|\.collection\(|\.doc\(|runTransaction|\.batch\(|bulkWriter|recursiveDelete|\.commit\(|\.getAll\(/);
  });
});
