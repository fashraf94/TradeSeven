// api/agent/battle-research-quotes.test.js
//
// GET /api/agent/battle-research-quotes — Battle Research's one server read
// (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §5, §11 "Route"): the
// order of checks (each status in turn), the owner check, League and inactive
// battles, the flag off and on the server allowlist, the battle's own symbols
// (a client `symbols` list is ignored), values copied never derived, times in
// milliseconds, the 30-second cache keyed by sweepId, and ZERO provider calls:
// any fetch fails the row, and so does any write verb against the Admin SDK.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file imports the route — and
// through it src/data/battleUniverse.js, src/screens/battleViewRouting.js and
// src/components/Research/BattleResearch/battleResearchMode.js — UNMOCKED. A
// browser dependency entering that graph explodes here, in Node. Never mock them.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ uid: 'owner-uid-1', authFails: false, mode: 'on', allow: ['owner-uid-1'], middlewareHandles: false, docs: {}, reads: [], writes: [], throwOnRead: false }));
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
  get BATTLE_RESEARCH_MODE() { return state.mode; },
}));
vi.mock('../_utils/firebaseAdmin.js', () => {
  const WRITE = ['set', 'update', 'delete', 'create', 'add'];
  const docRef = (path) => {
    const ref = {
      get: async () => {
        state.reads.push(path);
        if (state.throwOnRead) throw new Error('firestore down');
        const data = state.docs[path];
        return { exists: data !== undefined, data: () => data };
      },
      collection: (sub) => ({ doc: (id) => docRef(`${path}/${sub}/${id}`) }),
    };
    for (const verb of WRITE) ref[verb] = async () => { state.writes.push(`${verb}:${path}`); };
    return ref;
  };
  const db = {
    collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }),
    batch: () => { state.writes.push('batch'); return { set() {}, update() {}, delete() {}, commit: async () => {} }; },
    runTransaction: async () => { state.writes.push('runTransaction'); },
  };
  return { getFirebaseAdmin: () => db };
});

const { default: handler, resetBattleResearchState, SNAPSHOT_CACHE_MS, BATTLE_RESEARCH_USER_RATE_LIMIT, quoteOf } = await import('./battle-research-quotes.js');

const NOW = Date.parse('2026-11-12T18:45:00.000Z'); // Thu 1:45 PM ET
const BATTLE = 'battle-1';
const battleDoc = (over = {}) => ({
  ownerId: 'owner-uid-1', status: 'active', gameMode: 'baggerbomb_agent',
  portfolio: {
    star: [{ symbol: 'CEG' }], core: [{ symbol: 'MSFT' }], support: [{ symbol: 'BTC-USD.CC', isCrypto: true }],
    bench: { stocks: [{ symbol: 'ANET', name: 'Arista' }, { symbol: 'DHR' }], crypto: { symbol: 'ETH-USD.CC', isCrypto: true } },
  },
  watchlist: { hotBench: ['PLTR'] },
  agentContext: { equippedWatchlist: { tickers: ['NOW'] } },
  ...over,
});
const facts = (over = {}) => ({
  sym: 'X', observationId: 'o', strikeKey: 'k', source: 'eodhd_live_v2', availableAt: NOW - 60_000,
  collectionStalled: false, sessionEtDate: '2026-11-12',
  price: { value: 110, priceAsOf: NOW - 120_000, snapshotTs: NOW - 90_000, previousClose: 100, change: 10, changePercent: 1.24, size: 3 },
  indicators: { vwap: { status: 'completed', value: 108 } },
  ...over,
});
const snapshotDoc = (over = {}) => ({
  sweepId: 'sweep-aaaa', sweepAt: NOW - 30_000, lastSuccessfulSweepAt: NOW - 30_000, generation: 7, lease: null,
  anomalies: [{ sym: 'ANET', kind: 'gap' }], counters: { ok: 3 },
  symbols: {
    ANET: facts(), CEG: facts({ price: { value: 99, priceAsOf: NOW - 180_000, previousClose: 100, changePercent: -0.81 } }),
    // A symbol the battle does not hold or list: never in the body.
    AAPL: facts(),
  },
  ...over,
});

const req = (over = {}) => ({ method: 'GET', query: { battleId: BATTLE }, headers: {}, ...over });
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
  vi.setSystemTime(new Date(NOW));
  resetBattleResearchState();
  Object.assign(state, { uid: 'owner-uid-1', authFails: false, mode: 'on', allow: ['owner-uid-1'], middlewareHandles: false, reads: [], writes: [], throwOnRead: false });
  state.docs = { [`agentBattles/${BATTLE}`]: battleDoc(), 'intradaySnapshots/latest': snapshotDoc() };
  // ZERO PROVIDER CALLS: any network call fails the row that makes it.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('a provider call — Battle Research never makes one'); }));
});
afterEach(() => {
  expect(state.writes).toEqual([]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the order of checks (§5), each status in turn', () => {
  it('1 — the security middleware answering ends the request before anything else', async () => {
    state.middlewareHandles = true;
    const r = await call();
    expect(r.statusCode).toBeNull();
    expect(state.reads).toEqual([]);
  });
  it('2 — not GET → 405, no read', async () => {
    const r = await call({ method: 'POST' });
    expect(r.statusCode).toBe(405);
    expect(state.reads).toEqual([]);
  });
  it('3 — no verified token → 401, no read', async () => {
    state.authFails = true;
    const r = await call();
    expect(r.statusCode).toBe(401);
    expect(state.reads).toEqual([]);
  });
  it('4 — no battleId → 400, no read', async () => {
    const r = await call({ query: {} });
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toBe('invalid_request');
    expect(state.reads).toEqual([]);
  });
  it('5 — the per-user limiter answers 429 BEFORE any read', async () => {
    for (let i = 0; i < BATTLE_RESEARCH_USER_RATE_LIMIT.limit; i += 1) expect((await call()).statusCode).toBe(200);
    state.reads = [];
    const r = await call();
    expect(r.statusCode).toBe(429);
    expect(state.reads).toEqual([]);
  });
  it('6 — a missing battle → 404 not_found, and the snapshot is never read', async () => {
    delete state.docs[`agentBattles/${BATTLE}`];
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('not_found');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('7 — the caller is not the owner → 403, the snapshot never read', async () => {
    state.uid = 'someone-else';
    const r = await call();
    expect(r.statusCode).toBe(403);
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('8 — an inactive battle → 404 battle_research_unavailable, the snapshot never read', async () => {
    state.docs[`agentBattles/${BATTLE}`] = battleDoc({ status: 'completed' });
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('battle_research_unavailable');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('8 — a League battle (isLeagueBattle: baggerbomb_tournament) → 404, the snapshot never read', async () => {
    state.docs[`agentBattles/${BATTLE}`] = battleDoc({ gameMode: 'baggerbomb_tournament' });
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('battle_research_unavailable');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it("9 — the flag 'off' → 404 for the allowlisted owner too, the snapshot never read", async () => {
    state.mode = 'off';
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('battle_research_unavailable');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it("9 — a value outside the walked states reads 'off'", async () => {
    state.mode = 'yes';
    expect((await call()).statusCode).toBe(404);
  });
  it("9 — 'allowlist' admits an owner the server allowlist names (read at call time), and nobody else", async () => {
    state.mode = 'allowlist';
    expect((await call()).statusCode).toBe(200);
    state.allow = [];
    resetBattleResearchState();
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('battle_research_unavailable');
  });
  it("10/11 — 200 with Cache-Control 'private, no-store', after the battle and ONE snapshot read", async () => {
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toBe('private, no-store');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`, 'intradaySnapshots/latest']);
  });
  it('a failed read → 500, nothing written', async () => {
    state.throwOnRead = true;
    const r = await call();
    expect(r.statusCode).toBe(500);
  });
});

describe('the body (§5)', () => {
  it("the symbols are the battle's own universe — book then roster — and a client `symbols` list is ignored", async () => {
    const r = await call({ query: { battleId: BATTLE, symbols: 'AAPL,TSLA' } });
    expect(Object.keys(r.body.quotes)).toEqual(['CEG', 'MSFT', 'BTC-USD.CC', 'ANET', 'DHR', 'ETH-USD.CC', 'PLTR', 'NOW']);
    expect(r.body.quotes.AAPL).toBeUndefined();
    expect(r.body.quotes.TSLA).toBeUndefined();
  });
  it('values are COPIED, never derived: changePercent is the doc\'s, even when the price says otherwise', async () => {
    const r = await call();
    // value 110 against previousClose 100 would derive +10%; the copy is the doc's 1.24.
    expect(r.body.quotes.ANET).toEqual({ price: 110, previousClose: 100, changePercent: 1.24, priceAsOf: NOW - 120_000, sessionEtDate: '2026-11-12', collectionStalled: false });
  });
  it('a null changePercent stays null (never computed from price and previousClose)', async () => {
    state.docs['intradaySnapshots/latest'] = snapshotDoc({ symbols: { ANET: facts({ price: { value: 110, priceAsOf: NOW, previousClose: 100, changePercent: null } }) } });
    const r = await call();
    expect(r.body.quotes.ANET.changePercent).toBeNull();
  });
  it('nothing else leaves the server: no indicators, anomalies, counters, lease, source or ids', async () => {
    const r = await call();
    expect(Object.keys(r.body).sort()).toEqual(['quotes', 'servedAt', 'snapshot']);
    expect(Object.keys(r.body.snapshot).sort()).toEqual(['lastSuccessfulSweepAt', 'sweepAt', 'sweepId']);
    expect(JSON.stringify(r.body)).not.toMatch(/indicators|anomalies|counters|lease|vwap|observationId|strikeKey|eodhd/);
  });
  it('times are normalized to epoch ms: a Timestamp, an ISO string and ms all read the same instant', async () => {
    const at = NOW - 30_000;
    state.docs['intradaySnapshots/latest'] = snapshotDoc({
      sweepAt: { toMillis: () => at }, lastSuccessfulSweepAt: new Date(at).toISOString(),
      symbols: { ANET: facts({ price: { value: 110, priceAsOf: { toMillis: () => at }, previousClose: 100, changePercent: 1 } }), CEG: facts({ price: { value: 99, priceAsOf: new Date(at).toISOString(), previousClose: 100, changePercent: -1 } }) },
    });
    const r = await call();
    expect(r.body.snapshot).toEqual({ sweepId: 'sweep-aaaa', sweepAt: at, lastSuccessfulSweepAt: at });
    expect(r.body.quotes.ANET.priceAsOf).toBe(at);
    expect(r.body.quotes.CEG.priceAsOf).toBe(at);
    expect(r.body.servedAt).toBe(NOW);
  });
  it('a missing snapshot doc → snapshot null and EVERY quote null', async () => {
    delete state.docs['intradaySnapshots/latest'];
    const r = await call();
    expect(r.body.snapshot).toBeNull();
    expect(Object.values(r.body.quotes).every((q) => q === null)).toBe(true);
  });
  it('a name with no entry, or an entry with no price block, is null', async () => {
    state.docs['intradaySnapshots/latest'] = snapshotDoc({ symbols: { ANET: { sym: 'ANET', price: null } } });
    const r = await call();
    expect(r.body.quotes.ANET).toBeNull();
    expect(r.body.quotes.DHR).toBeNull();
  });
  it('collectionStalled is copied as a boolean (true only when the doc says true)', () => {
    expect(quoteOf(facts({ collectionStalled: true })).collectionStalled).toBe(true);
    expect(quoteOf(facts({ collectionStalled: 'yes' })).collectionStalled).toBe(false);
  });
});

describe('the snapshot cache (§5 step 10): at most 30 seconds, keyed by sweepId', () => {
  it('a second request inside 30 s answers from the cache — no second snapshot read', async () => {
    await call();
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS - 1));
    state.reads = [];
    const r = await call();
    expect(r.statusCode).toBe(200);
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('at 30 s the snapshot is read again; a new sweepId is new facts', async () => {
    await call();
    state.docs['intradaySnapshots/latest'] = snapshotDoc({ sweepId: 'sweep-bbbb', symbols: { ANET: facts({ price: { value: 120, priceAsOf: NOW, previousClose: 100, changePercent: 2.5 } }) } });
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS));
    state.reads = [];
    const r = await call();
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`, 'intradaySnapshots/latest']);
    expect(r.body.snapshot.sweepId).toBe('sweep-bbbb');
    expect(r.body.quotes.ANET.changePercent).toBe(2.5);
  });
  it('re-read past 30 s with the SAME sweepId keeps the cached facts (the same sweep is the same facts)', async () => {
    await call();
    state.docs['intradaySnapshots/latest'] = snapshotDoc({ symbols: { ANET: facts({ price: { value: 1, priceAsOf: NOW, previousClose: 1, changePercent: 99 } }) } });
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS + 5));
    const r = await call();
    expect(r.body.quotes.ANET.changePercent).toBe(1.24);
  });
});

describe('cost: no provider, no model, no write — by construction', () => {
  const SRC = readFileSync(fileURLToPath(new URL('./battle-research-quotes.js', import.meta.url)), 'utf8');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  it('no Node network module, no undici, no intraday fetch helper either (review BR3-7)', () => {
    expect(code).not.toMatch(/node:https?|node:net|node:tls|undici|\bhttps?\.(request|get)\(|intradayFetch|fetchQuotes/i);
  });
  it('imports no provider or model client and calls no fetch', () => {
    expect(code).not.toMatch(/eodhd|anthropic|openrouter|openai|fetch\(|axios|got\(|node-fetch|https?:\/\//i);
  });
  it('names no write verb on the Admin SDK (the per-user limiter\'s in-memory Map.set is the one .set)', () => {
    expect(code.match(/\.set\(/g)).toHaveLength(2); // windows.set(uid, kept) — both in userRateLimited
    expect(code.replace(/windows\.set\(/g, '')).not.toMatch(/\.(set|update|delete|create|add|commit|runTransaction|batch)\(/);
  });
});

// ── Review BR3 (lens 3): the rows its mutation battery showed missing (X1–X12), and BR3-6 ──

describe('BR3 — order, limiters, cache, errors', () => {
  it('X1 a non-owner on an INACTIVE battle is 403, never the battle_research_unavailable answer', async () => {
    state.docs[`agentBattles/${BATTLE}`] = battleDoc({ status: 'completed' });
    state.uid = 'someone-else';
    expect((await call()).body).toEqual({ error: 'forbidden' });
  });
  it('X2 a non-owner on a LEAGUE battle is 403', async () => {
    state.docs[`agentBattles/${BATTLE}`] = battleDoc({ gameMode: 'baggerbomb_tournament' });
    state.uid = 'someone-else';
    expect((await call()).body).toEqual({ error: 'forbidden' });
  });
  it("X3 under 'allowlist' a non-owner learns nothing about the owner's admission: 403 either way", async () => {
    state.mode = 'allowlist';
    state.uid = 'someone-else';
    state.allow = [];
    expect((await call()).body).toEqual({ error: 'forbidden' });
    state.allow = ['owner-uid-1'];
    expect((await call()).body).toEqual({ error: 'forbidden' });
  });
  it('X4 the per-user window is per user: a full window for one uid leaves another uid admitted', async () => {
    for (let i = 0; i < BATTLE_RESEARCH_USER_RATE_LIMIT.limit; i += 1) await call();
    expect((await call()).statusCode).toBe(429);
    state.uid = 'someone-else';
    expect((await call()).statusCode).toBe(403);
  });
  it('X5 the per-user window expires after windowMs', async () => {
    for (let i = 0; i < BATTLE_RESEARCH_USER_RATE_LIMIT.limit; i += 1) await call();
    expect((await call()).statusCode).toBe(429);
    vi.setSystemTime(new Date(NOW + BATTLE_RESEARCH_USER_RATE_LIMIT.windowMs));
    expect((await call()).statusCode).toBe(200);
  });
  it('X6 a same-sweepId re-read restarts the 30 s window (one .get() per 30 s overnight, not one per request)', async () => {
    await call();
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS));
    await call();
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS + 1));
    state.reads = [];
    await call();
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });
  it('X7 a missing snapshot is cached like any other answer, and re-read at 30 s', async () => {
    delete state.docs['intradaySnapshots/latest'];
    await call();
    state.reads = [];
    await call();
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
    state.docs['intradaySnapshots/latest'] = snapshotDoc();
    vi.setSystemTime(new Date(NOW + SNAPSHOT_CACHE_MS));
    const r = await call();
    expect(r.body.snapshot.sweepId).toBe('sweep-aaaa');
  });
  it('X8 a 500 says only its error (no internal message)', async () => {
    state.throwOnRead = true;
    expect((await call()).body).toEqual({ error: 'Could not read the quotes.' });
  });
  it('X9 a padded battleId reads the trimmed doc', async () => {
    expect((await call({ query: { battleId: ` ${BATTLE} ` } })).statusCode).toBe(200);
  });
  it('X10 the per-IP limiter is asked for 60 per minute', async () => {
    await call();
    expect(state.secOpts).toEqual({ rateLimit: { limit: 60, windowMs: 60_000 } });
  });
});

describe('BR3 — allowlist at every call', () => {
  it("X11 'allowlist' is read at EVERY call: the owner leaves the list between two calls, no reset in between", async () => {
    state.mode = 'allowlist';
    expect((await call()).statusCode).toBe(200);
    state.allow = [];
    const r = await call();
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe('battle_research_unavailable');
  });
});

describe('BR3 — the battleId', () => {
  it('X12 an array battleId uses its first element; a non-string first element is 400 with no read', async () => {
    const a = await call({ query: { battleId: [BATTLE, 'battle-2'] } });
    expect(a.statusCode).toBe(200);
    expect(state.reads[0]).toBe(`agentBattles/${BATTLE}`);
    state.reads = [];
    const b = await call({ query: { battleId: [{ x: 1 }] } });
    expect(b.statusCode).toBe(400);
    const c = await call({ query: { battleId: '   ' } });
    expect(c.statusCode).toBe(400);
    expect(state.reads).toEqual([]);
  });
});

describe('BR3-6 — a battleId is one document id', () => {
  it('a path (a slash) or an over-long id is 400 before any read — never a 500 the limiter already charged', async () => {
    for (const battleId of ['abc/calls', 'a//b', 'B/tape/2026-11-12', 'x'.repeat(1501)]) {
      state.reads = [];
      const r = await call({ query: { battleId } });
      expect(r.statusCode).toBe(400);
      expect(state.reads).toEqual([]);
    }
  });
});
