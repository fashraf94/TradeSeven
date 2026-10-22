// api/agent/cockpit-bench.test.js
//
// GET /api/agent/cockpit-bench — the bench sheet's read (Cockpit Build 2b,
// spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-10, §11 "S-10"): the full gate in
// order; the scoped rows (the swap's lists of OUT's class, held names omitted,
// status from canComeIn at Date.now(), no_price for a stock with no usable
// price, crypto exempt); browse mode (status from the lock alone); each field
// from its cited source, missing → null; no write, no model call, no-store.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ uid: 'owner-uid-1', authFails: false, callsMode: 'on', allow: ['owner-uid-1'], v2: true, middlewareHandles: false, docs: {}, reads: [], writes: [], throwOnRead: false }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => state.middlewareHandles }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return { uid: state.uid };
  },
}));
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => state.allow }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return state.callsMode; },
  isCockpit2bOn: () => state.v2,
}));
vi.mock('../_utils/firebaseAdmin.js', () => {
  const docRef = (path) => ({
    get: async () => {
      state.reads.push(path);
      if (state.throwOnRead) throw new Error('firestore down');
      const data = state.docs[path];
      // The data as stored (a Timestamp-shaped field carries a function, which structuredClone refuses).
      return { exists: data !== undefined, data: () => data };
    },
    set: async () => { state.writes.push(path); },
    update: async () => { state.writes.push(path); },
    collection: (sub) => ({ doc: (id) => docRef(`${path}/${sub}/${id}`) }),
  });
  return { getFirebaseAdmin: () => ({ collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }) }) };
});

const { default: handler, resetCockpitBenchRateLimit, buildBenchRows, benchPriceRows, COCKPIT_BENCH_USER_RATE_LIMIT, BENCH_ROW_STATUSES } = await import('./cockpit-bench.js');

const NOW = Date.parse('2026-10-15T17:00:00.000Z');
const LOCKED = '2026-10-15T19:00:00.000Z';
const BATTLE = 'battle-1';
const EXIT = 'battle-1:eval_004:call:0';
const battleDoc = (over = {}) => ({
  ownerId: 'owner-uid-1', status: 'active',
  portfolio: {
    star: [{ symbol: 'AMD', isCrypto: false }],
    core: [{ symbol: 'MSFT', isCrypto: false }],
    support: [{ symbol: 'KO', isCrypto: false }, { symbol: 'BTC-USD.CC', isCrypto: true }],
    bench: {
      stocks: [
        { symbol: 'DHR', name: 'Danaher', isCrypto: false, sector: 'Healthcare' },
        { symbol: 'CEG', name: 'Constellation', isCrypto: false, cooldownUntil: LOCKED },
        { symbol: 'EA', name: 'Electronic Arts', isCrypto: false },
        { symbol: 'MSFT', name: 'Microsoft (stale bench copy)', isCrypto: false },
      ],
      crypto: { symbol: 'ETH-USD.CC', name: 'Ethereum', isCrypto: true },
    },
  },
  watchlist: { hotBench: ['PLTR', 'KO'] },
  ...over,
});
const rankings = { stocks: [
  { symbol: 'DHR', technicalRank: 75, sectorName: 'Health Care', techRaw: { atrPercent: 1.9 } },
  { symbol: 'CEG', technicalRank: 212, sectorName: 'Utilities', techRaw: { atrPercent: 3.1 } },
  { symbol: 'EA', technicalRank: 130, sectorName: 'Communication', techRaw: { atrPercent: 1.2 } },
  { symbol: 'PLTR', technicalRank: 3 },
] };
const cache = { updatedAt: { toDate: () => new Date('2026-10-15T16:45:00.000Z') }, benchBriefs: [
  { symbol: 'DHR', price: 258.7, changePercent: 2.1 },
  { symbol: 'CEG', price: 236.9, changePercent: 3.4 },
  { symbol: 'EA', price: 'NA', changePercent: null },
  { symbol: 'ETH-USD.CC', price: null, changePercent: null },
] };
const exitCall = (over = {}) => ({ callId: EXIT, kind: 'confirmation', symbol: 'AMD', direction: 'exit', slot: 'star', counterpart: null, ...over });

const mkRes = () => ({ statusCode: null, body: null, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const get = async (query = { battleId: BATTLE }, method = 'GET') => { const res = mkRes(); await handler({ method, query }, res); return res; };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(state, { uid: 'owner-uid-1', authFails: false, callsMode: 'on', allow: ['owner-uid-1'], v2: true, middlewareHandles: false, reads: [], writes: [], throwOnRead: false });
  state.docs = {
    [`agentBattles/${BATTLE}`]: battleDoc(),
    [`agentBattles/${BATTLE}/calls/${EXIT}`]: exitCall(),
    [`agentBattles/${BATTLE}/calls/entry-1`]: exitCall({ callId: 'entry-1', direction: 'entry' }),
    'indexIntelligence/stockRankings': rankings,
    [`voiceLayerCache/${BATTLE}`]: cache,
  };
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-uid-1';
  resetCockpitBenchRateLimit();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); });

describe('the gate, in order', () => {
  it('405 for anything but GET; 401 unauthenticated; 400 without a battleId — before any read', async () => {
    expect((await get({ battleId: BATTLE }, 'POST')).statusCode).toBe(405);
    state.authFails = true;
    expect((await get()).statusCode).toBe(401);
    state.authFails = false;
    expect((await get({})).statusCode).toBe(400);
    expect(state.reads).toEqual([]);
  });
  it('429 past the per-user window, before any read', async () => {
    for (let i = 0; i < COCKPIT_BENCH_USER_RATE_LIMIT.limit; i += 1) await get();
    state.reads = [];
    expect((await get()).statusCode).toBe(429);
    expect(state.reads).toEqual([]);
  });
  it('404 for a missing battle; 403 for a non-owner — no calls, rankings or cache read', async () => {
    expect((await get({ battleId: 'nope' })).statusCode).toBe(404);
    state.uid = 'someone-else';
    resetCockpitBenchRateLimit();
    state.reads = [];
    const res = await get();
    expect(res.statusCode).toBe(403);
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('404 cockpit_unavailable when the mode is not on, the owner is off the allowlist, or the 2b flag is off', async () => {
    for (const set of [() => { state.callsMode = 'shadow'; }, () => { process.env.COCKPIT_ALLOWLIST_UIDS = 'someone-else'; state.allow = ['someone-else']; }, () => { state.v2 = false; }]) {
      Object.assign(state, { callsMode: 'on', allow: ['owner-uid-1'], v2: true });
      process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-uid-1';
      set();
      resetCockpitBenchRateLimit();
      state.reads = [];
      const res = await get();
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'cockpit_unavailable' });
      expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
    }
  });
  it('400 invalid_call when the callId names no call, or an entry', async () => {
    expect((await get({ battleId: BATTLE, callId: 'missing' })).body).toEqual({ error: 'invalid_call' });
    expect((await get({ battleId: BATTLE, callId: 'entry-1' })).body).toEqual({ error: 'invalid_call' });
  });
  it('every answer is no-store; nothing is ever written', async () => {
    const res = await get({ battleId: BATTLE, callId: EXIT });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(state.writes).toEqual([]);
    expect(state.reads.sort()).toEqual([`agentBattles/${BATTLE}`, `agentBattles/${BATTLE}/calls/${EXIT}`, 'indexIntelligence/stockRankings', `voiceLayerCache/${BATTLE}`].sort());
  });
  it('500 when a read fails', async () => {
    state.throwOnRead = true;
    expect((await get()).statusCode).toBe(500);
  });
});

describe('scoped rows (a callId): the swap\'s lists of OUT\'s class, held names omitted, status from canComeIn', () => {
  it('the rows, their statuses and their fields; asOf is the price read\'s own instant', async () => {
    const res = await get({ battleId: BATTLE, callId: EXIT });
    expect(res.body.asOf).toBe('2026-10-15T16:45:00.000Z');
    expect(res.body.out).toEqual({ symbol: 'AMD', slot: 'star' });
    expect(res.body.rows).toEqual([
      { symbol: 'DHR', name: 'Danaher', sector: 'Health Care', rank: 75, price: 258.7, changePct: 2.1, atrPct: 1.9, status: 'available', lockedUntil: null },
      { symbol: 'CEG', name: 'Constellation', sector: 'Utilities', rank: 212, price: 236.9, changePct: 3.4, atrPct: 3.1, status: 'locked', lockedUntil: LOCKED },
      // A delisted-style name: on the bench, no usable price → no_price (never offered).
      { symbol: 'EA', name: 'Electronic Arts', sector: 'Communication', rank: 130, price: null, changePct: null, atrPct: 1.2, status: 'no_price', lockedUntil: null },
      // The hot bench: a stock, never in the cache's bench briefs → no_price; its rank still from the rankings.
      { symbol: 'PLTR', name: null, sector: null, rank: 3, price: null, changePct: null, atrPct: null, status: 'no_price', lockedUntil: null },
    ]);
    // Held names are omitted (MSFT on a stale bench copy, KO on the hot bench); crypto is not OUT's class.
    expect(res.body.rows.map((r) => r.symbol)).not.toContain('MSFT');
    expect(res.body.rows.map((r) => r.symbol)).not.toContain('ETH-USD.CC');
  });
  it('a crypto OUT lists the crypto names; crypto is exempt from no_price and shows null (rendered "—")', async () => {
    state.docs[`agentBattles/${BATTLE}/calls/${EXIT}`] = exitCall({ symbol: 'BTC-USD.CC', slot: 'support' });
    const res = await get({ battleId: BATTLE, callId: EXIT });
    expect(res.body.rows).toEqual([{ symbol: 'ETH-USD.CC', name: 'Ethereum', sector: null, rank: null, price: null, changePct: null, atrPct: null, status: 'available', lockedUntil: null }]);
  });
  it('the lock is judged at Date.now(): once it passes, the name is available', async () => {
    vi.setSystemTime(Date.parse(LOCKED) + 1);
    const res = await get({ battleId: BATTLE, callId: EXIT });
    expect(res.body.rows.find((r) => r.symbol === 'CEG').status).toBe('available');
  });
  it('no cache document: every stock row is no_price, asOf null', async () => {
    delete state.docs[`voiceLayerCache/${BATTLE}`];
    const res = await get({ battleId: BATTLE, callId: EXIT });
    expect(res.body.asOf).toBeNull();
    expect(res.body.rows.filter((r) => r.status !== 'locked').every((r) => r.status === 'no_price')).toBe(true);
  });
});

describe('browse rows (no callId): every bench-list name, status from the lock alone', () => {
  it('stocks and crypto alike, held names omitted, out null; no no_price in browse', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.out).toBeNull();
    expect(res.body.rows.map((r) => [r.symbol, r.status])).toEqual([['DHR', 'available'], ['CEG', 'locked'], ['EA', 'available'], ['ETH-USD.CC', 'available'], ['PLTR', 'available']]);
    expect(BENCH_ROW_STATUSES).toEqual(['available', 'locked', 'not_swappable', 'no_price']);
  });
});

describe('the pure parts', () => {
  it('not_swappable for a name the test refuses for any other reason', () => {
    const battle = battleDoc();
    // Review CB1-8: an exit whose stock already LEFT the book can bring nobody in — every scoped row is
    // not_swappable (the filing would be 400 symbol_not_held), never "available" with Pick enabled.
    const out = buildBenchRows({ battle, call: exitCall({ symbol: 'GONE' }), rankingsBySymbol: {}, prices: { asOf: null, bySymbol: { DHR: { price: 1, changePct: 0 } } }, nowMs: NOW });
    expect(out.rows.find((r) => r.symbol === 'DHR').status).toBe('not_swappable');
    expect(out.rows.every((r) => r.status === 'not_swappable')).toBe(true);
    const held = buildBenchRows({ battle, call: exitCall(), rankingsBySymbol: {}, prices: { asOf: null, bySymbol: { DHR: { price: 1, changePct: 0 } } }, nowMs: NOW });
    expect(held.rows.find((r) => r.symbol === 'DHR').status).toBe('available');
    const own = buildBenchRows({ battle: battleDoc({ watchlist: { hotBench: ['AMD'] } }), call: exitCall(), rankingsBySymbol: {}, prices: { asOf: null, bySymbol: {} }, nowMs: NOW });
    expect(own.rows.map((r) => r.symbol)).not.toContain('AMD'); // held → omitted before any status
  });
  it('benchPriceRows: a non-finite price or change is null; a missing document reads empty', () => {
    expect(benchPriceRows(cache).bySymbol).toEqual({ DHR: { price: 258.7, changePct: 2.1 }, CEG: { price: 236.9, changePct: 3.4 }, EA: { price: null, changePct: null }, 'ETH-USD.CC': { price: null, changePct: null } });
    expect(benchPriceRows(null)).toEqual({ asOf: null, bySymbol: {} });
  });
});
