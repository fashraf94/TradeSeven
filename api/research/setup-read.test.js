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
import { SETUP_READ_BODY_KEYS, SETUP_READ_FIELDS } from '../../src/components/Research/Sheet/setupReadContract.js';

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
        if (state.throwOnRead) throw Object.assign(new Error('firestore down'), { code: 14 });
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
const { default: handler, resetSetupReadState, SETUP_READ_CACHE_MS, SETUP_READ_USER_RATE_LIMIT, symbolOf, sessionsToTry } = route;

// Mon 16 Nov 2026, 5:00 PM ET: Monday's session has closed.
const AFTER_CLOSE = Date.parse('2026-11-16T22:00:00.000Z');
const LATEST = '2026-11-16';
const PRIOR = '2026-11-13'; // the Friday before
const SYMBOL = 'BRK-B';
const ROUTE_SRC = readFileSync(fileURLToPath(new URL('./setup-read.js', import.meta.url)), 'utf8');

let latest;
let prior;
let other;
beforeAll(async () => {
  latest = await readRecordSet({ session: LATEST, symbol: SYMBOL, fetchedAt: '2026-11-16T22:31:00.000Z' });
  prior = await readRecordSet({ session: PRIOR, symbol: SYMBOL, fetchedAt: '2026-11-13T22:31:00.000Z' });
  other = await readRecordSet({ session: LATEST, symbol: 'AAPL', fetchedAt: '2026-11-16T22:31:00.000Z' });
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
  Object.assign(state, { uid: 'player-uid-1', authFails: false, mode: 'on', allow: ['player-uid-1'], middlewareHandles: false, docs: {}, reads: [], touches: [], throwOnRead: false });
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
      expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`]);
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
  it('measured: the last completed session\'s record, one read, behind false', async () => {
    put(latest.VALID_PULLBACK);
    put(prior.SPLIT); // never reached
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.body)).toEqual([...SETUP_READ_BODY_KEYS]);
    expect(r.body).toMatchObject({ answer: 'measured', symbol: SYMBOL, servedAt: AFTER_CLOSE, sessionsTried: [LATEST] });
    expect(Object.keys(r.body.read)).toEqual([...SETUP_READ_FIELDS]);
    expect(r.body.read).toMatchObject({ session: LATEST, asOf: LATEST, behind: false, verdict: 'valid', pattern: 'pullback_resume' });
    expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`]);
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
  it('behind: only the session before has a record → that one, behind true, two reads in order', async () => {
    put(prior.EXTENDED);
    const r = await call();
    expect(r.body).toMatchObject({ answer: 'measured', sessionsTried: [LATEST, PRIOR] });
    expect(r.body.read).toMatchObject({ session: PRIOR, asOf: PRIOR, behind: true, verdict: 'invalid', reason: 'extended', patternsSatisfied: ['pullback_resume'] });
    expect(state.reads).toEqual([`setupEvidence/${latest.EXTENDED.id}`, `setupEvidence/${prior.EXTENDED.id}`]);
  });
  it('absent: no record for either session → read null, exactly two reads', async () => {
    put(other.VALID_PULLBACK); // another symbol's record is not this one's
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ answer: 'absent', symbol: SYMBOL, servedAt: AFTER_CLOSE, sessionsTried: [LATEST, PRIOR], read: null });
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

describe('the cache (RR-8): per instance, keyed by symbol and session, at most 60 seconds', () => {
  it('a second call inside 60 s reads nothing; at 60 s it reads again', async () => {
    put(latest.VALID_PULLBACK);
    expect((await call()).body.answer).toBe('measured');
    expect(state.reads).toHaveLength(1);
    vi.setSystemTime(new Date(AFTER_CLOSE + SETUP_READ_CACHE_MS - 1));
    const second = await call();
    expect(second.body.answer).toBe('measured');
    expect(second.body.servedAt).toBe(AFTER_CLOSE + SETUP_READ_CACHE_MS - 1);
    expect(state.reads).toHaveLength(1);
    vi.setSystemTime(new Date(AFTER_CLOSE + SETUP_READ_CACHE_MS));
    await call();
    expect(state.reads).toHaveLength(2);
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
    expect(state.reads).toEqual([`setupEvidence/${latest.VALID_PULLBACK.id}`, `setupEvidence/${other.VALID_PULLBACK.id}`]);
    // Tuesday after the close: the last completed session moves on, so the cached Monday answer is not used.
    vi.setSystemTime(new Date('2026-11-17T22:00:30.000Z'));
    state.reads = [];
    const r = await call();
    expect(r.body.sessionsTried).toEqual(['2026-11-17', LATEST]);
    expect(state.reads).toHaveLength(2);
  });
  it('a cached body is a copy: changing one answer changes nothing in the next', async () => {
    put(latest.VALID_PULLBACK);
    const first = await call();
    first.body.sessionsTried.push('x');
    const second = await call();
    expect(second.body.sessionsTried).toEqual([LATEST]);
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
