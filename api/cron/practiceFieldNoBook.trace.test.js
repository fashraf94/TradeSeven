// api/cron/practiceFieldNoBook.trace.test.js
//
// Practice Field T1a-2a — Astra T2A-02: WITH NO IDEA BOOK, MODE 'on' CHANGES NO QUARTERLY FIRE (Amendment E §4).
//
// The engine's two sweeps, fired against the engine's in-memory store with every database operation recorded IN
// ORDER (each document get, query, write and transaction step), beside the HTTP response, every stored document at
// the end, every log line, and every upstream and model call. The same twenty quarterly scenarios as Astra's traced
// differential (probe/astra-cron-trace.test.js), each fired at 'off' and at 'on' on THIS tree:
//
//   'off'                       the base: the Practice Field reads nothing;
//   'on', no idea book          IDENTICAL to 'off' but for exactly one database operation, the fire's one read of the
//                               founder-cap registry (`practiceFieldBooks/_registry`), first. The registry is missing
//                               or lists no open book. This includes Astra's retention case — a completed close
//                               replay with two expired documents, which must be deleted with `complete: true,
//                               errors: 0` — and her three draining-query-failure cases, which cannot occur now:
//                               no discovery query runs;
//   'on', the registry unreadable, or listing a book     discovery runs as before (the controls below).
//
// The base-against-head form of this comparison (origin/main against this branch) is a scratch harness reported by
// hash in the build report's fix-round section; this file pins the invariant on the tree itself.

import { describe, it, expect, vi, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ calls: [], mode: 'hold', quoteTime: 0, failQuotes: false, failFundamentals: false }));
vi.mock('../_utils/mandateLease.js', async (importActual) => ({ ...(await importActual()), mintOwnerToken: () => 'inv_trace_fixed' }));
vi.mock('../_utils/tournamentPrices.js', async (importActual) => ({
  ...(await importActual()),
  fetchBatchQuotes: async (syms) => {
    state.calls.push(['quotes', syms]);
    if (state.failQuotes) throw new Error('quote outage');
    return Object.fromEntries(syms.map((s) => [s, { close: 100 + s.charCodeAt(0) / 100, timestamp: state.quoteTime }]));
  },
}));
vi.mock('../_utils/marketDataCache.js', async (importActual) => ({
  ...(await importActual()),
  getStockAnalysisData: async (sym) => {
    state.calls.push(['fundamentals', sym]);
    if (state.failFundamentals) throw new Error('fundamentals outage');
    return { fundamentals: { sector: 'Technology', industry: 'Synthetic', marketCap: 3e12 }, cacheStatus: { fundamentals: 'fresh' } };
  },
}));
vi.mock('../_utils/mandateModelCall.js', async (importActual) => ({
  ...(await importActual()),
  callMandateModelDirect: async (args) => {
    state.calls.push(['model', args]);
    const input = state.mode === 'buy' ? { verb: 'BUY', ticker: 'AAPL', sizeUsd: 5000, rationale: 'Synthetic buy', conviction: 70 }
      : state.mode === 'sell' ? { verb: 'SELL', ticker: 'AAPL', rationale: 'Synthetic exit', conviction: 70 }
        : { verb: 'HOLD', rationale: 'Synthetic hold', conviction: 50 };
    return { decision: { ok: true, input }, usage: null };
  },
}));

import { runEvalSweep, runCloseSweep } from './mandate-evaluate.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';
import { setPracticeFieldModeForTests } from '../_utils/practiceField/mode.js';
import { seedBook } from '../_utils/practiceField/__testsupport__/fixtures.js';

const REGISTRY = 'practiceFieldBooks/_registry';
const VINTAGE = {
  archetype: 'analyst', displayName: 'Synthetic',
  gateConfig: { sectorCapConversionVersion: 1, cashFloorPct: 0.1, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.5, sectorCapSlots: 3, sectorCapDenominator: 6, minPositions: 0, decisionVerbs: ['BUY', 'ADD', 'SELL', 'TRIM', 'HOLD'] },
  modelSeat: { model: 'synthetic' },
};
const POSITION = { shares: 100, costBasisTotal: 10000, avgCost: 100, lastMark: 100, lastMarkAsOf: '2026-11-16T21:00:00Z', lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-11-16' };
const EXPIRED = ['mandateUniverseSnapshots/2026-01-01_open30', 'mandateUniverseDaily/2026-01-01'];

function quarterlyBook() {
  return buildNewMandateDoc({
    mandateId: 'q', userId: 'q-owner', archetype: 'analyst', managerAgentId: 'q-agent', vintageRef: 'archetypeVintages/q', cadenceTier: 'fast',
    createdAt: new Date('2026-09-01T14:00:00Z'), quarterStartAt: new Date('2026-09-01T14:00:00Z'),
    nextRolloverAt: new Date('2026-12-01T21:00:00Z'), escapeHatchEligibleUntil: new Date('2026-09-15T14:00:00Z'),
  });
}

/** The store a scenario starts from (Astra's twenty), plus how the registry stands: missing, or present and empty. */
function seed(s) {
  const registry = s.registry === 'empty' ? { [REGISTRY]: { openBooks: {}, cap: 4, updatedAt: '2026-11-13T14:00:00.000Z' } } : {};
  if (s.empty) return { ...registry };
  const b = quarterlyBook();
  if (s.held) { b.portfolio.positions = { AAPL: { ...POSITION } }; b.portfolio.cash = 90000; b.portfolio.totalValue = 100000; }
  if (s.alreadyClosed) b.execState.lastCloseKey = '2026-11-17';
  if (s.quarantine) b.health.quarantined = true;
  if (s.slow) b.cadenceTier = 'slow';
  if (s.stamped) b.execState.lastEvalTickKey = '2026-11-17_open30';
  return {
    ...registry,
    ...(s.alreadyClosed ? Object.fromEntries(EXPIRED.map((p) => [p, { old: true }])) : {}),
    'mandates/q': b,
    ...(s.noVintage ? {} : { 'archetypeVintages/q': VINTAGE }),
  };
}

const stable = (db) => [...db._store.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, e]) => [p, e.data]);

/**
 * The store, with every operation recorded in order. A query whose filters include `status == 'draining'` throws
 * when the scenario says so (Astra's draining-query outage); the registry's get throws when it says so.
 */
function traceDb(raw, s) {
  const trace = [];
  const snap = (x) => (x && Array.isArray(x.docs) ? { ...x, docs: x.docs.map(snap) } : x && x.ref ? { ...x, ref: ref(x.ref) } : x);
  function ref(r) {
    return new Proxy(r, {
      get(target, k) {
        if (k === 'collection') return (name) => query(target.collection(name), `${target.path}/${name}`, []);
        if (k === 'get') {
          return async () => {
            trace.push(['get', target.path]);
            if (s.failRegistry && target.path === REGISTRY) throw new Error('synthetic registry read unavailable');
            return snap(await target.get());
          };
        }
        if (['set', 'update', 'create', 'delete'].includes(k)) return async (...args) => { trace.push([k, target.path, ...structuredClone(args)]); return target[k](...args); };
        return target[k];
      },
    });
  }
  function query(q, path, parts) {
    return new Proxy(q, {
      get(target, k) {
        if (k === 'doc') return (id) => ref(target.doc(id));
        if (['where', 'orderBy', 'limit', 'startAfter'].includes(k)) {
          return (...args) => {
            const mapped = args.map((a) => (a && Array.isArray(a.segments) && a.segments.length === 1 && a.segments[0] === '__name__' ? '__name__' : a));
            return query(target[k](...mapped), path, [...parts, [k, ...mapped]]);
          };
        }
        if (k === 'get') {
          return async () => {
            trace.push(['query', path, parts]);
            if (s.failDraining && parts.some((p) => p[0] === 'where' && p[1] === 'status' && p[3] === 'draining')) throw new Error('synthetic draining query unavailable');
            return snap(await target.get());
          };
        }
        return target[k];
      },
    });
  }
  return {
    ...raw,
    trace,
    doc: (path) => ref(raw.doc(path)),
    collection: (name) => query(raw.collection(name), name, []),
    runTransaction: async (fn) => {
      trace.push(['transaction']);
      return raw.runTransaction((tx) => fn(new Proxy(tx, {
        get(target, k) {
          if (k === 'get') return async (r) => { trace.push(['tx.get', r.path]); return snap(await target.get(r)); };
          if (['set', 'update', 'create', 'delete'].includes(k)) return (r, ...args) => { trace.push([`tx.${k}`, r.path, ...structuredClone(args)]); return target[k](r, ...args); };
          return target[k];
        },
      })));
    },
  };
}

/** One fire of one sweep at one mode, recorded. `prepare(db)` may add documents before the fire (the controls). */
async function fire(s, mode, prepare = null) {
  const restore = setPracticeFieldModeForTests(mode);
  const raw = makeMandateFakeDb(seed(s));
  if (prepare) { const r = setPracticeFieldModeForTests('on'); try { await prepare(raw); } finally { r(); } }
  const db = traceDb(raw, s);
  const logs = [];
  state.calls = [];
  state.mode = s.action || 'hold';
  state.failQuotes = !!s.failQuotes;
  state.failFundamentals = !!s.failFundamentals;
  const now = new Date(s.close ? '2026-11-17T21:30:00Z' : s.final ? '2026-11-17T20:31:00Z' : '2026-11-17T15:02:00Z');
  state.quoteTime = Date.parse(s.stale ? '2026-11-16T21:00:00Z' : s.close ? '2026-11-17T21:00:00Z' : s.final ? '2026-11-17T20:15:00Z' : '2026-11-17T14:45:00Z') / 1000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.stubEnv('EODHD_API_KEY', 'synthetic');
  vi.stubGlobal('fetch', async (url) => { state.calls.push(['ca', String(url)]); return { ok: true, json: async () => [] }; });
  const log = vi.spyOn(console, 'log').mockImplementation((...x) => logs.push(['log', ...x]));
  const err = vi.spyOn(console, 'error').mockImplementation((...x) => logs.push(['error', ...x]));
  const response = {};
  const res = { status(n) { response.status = n; return this; }, json(x) { response.body = x; return this; } };
  const req = { headers: { 'x-vercel-cron': '1' }, method: 'POST' };
  try {
    if (s.close) await runCloseSweep(req, res, { db, now, closeTick: { date: '2026-11-17', closeKey: '2026-11-17_close' } });
    else {
      await runEvalSweep(req, res, {
        db, now,
        tick: { date: '2026-11-17', slot: s.final ? 'preClose' : 'open30', tickKey: s.final ? '2026-11-17_preClose' : '2026-11-17_open30' },
        transport: s.final ? 'batch' : 'direct',
      });
    }
    return { response, store: stable(raw), calls: structuredClone(state.calls), logs, firestore: db.trace };
  } finally {
    log.mockRestore();
    err.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    restore();
  }
}

/** Astra's twenty scenarios, by her names. */
const SCENARIOS = [
  { name: 'empty-eval', empty: true }, { name: 'empty-close', empty: true, close: true }, { name: 'hold' }, { name: 'buy', action: 'buy' },
  { name: 'sell', held: true, action: 'sell' }, { name: 'held-hold', held: true }, { name: 'stale-held', held: true, stale: true },
  { name: 'quarantined', held: true, quarantine: true }, { name: 'slow', slow: true }, { name: 'already-evaluated', stamped: true },
  { name: 'missing-vintage', noVintage: true }, { name: 'quote-outage', held: true, failQuotes: true },
  { name: 'fundamentals-outage', failFundamentals: true }, { name: 'close-cash', close: true }, { name: 'close-held', close: true, held: true },
  { name: 'close-stale', close: true, held: true, stale: true }, { name: 'batch-final', final: true },
  { name: 'draining-query-outage-eval', failDraining: true }, { name: 'draining-query-outage-close', close: true, failDraining: true },
  { name: 'draining-query-outage-close-replay', close: true, failDraining: true, alreadyClosed: true },
];

const isRegistryRead = (op) => op[0] === 'get' && op[1] === REGISTRY;
const withoutRegistryRead = (rec) => ({ ...rec, firestore: rec.firestore.filter((op) => !isRegistryRead(op)) });
const discoveryQueries = (rec) => rec.firestore.filter((op) => op[0] === 'query' && op[2].some((p) => p[0] === 'where' && p[1] === 'kind' && p[3] === 'idea_book'));

afterEach(() => { vi.restoreAllMocks(); });

describe('Astra T2A-02 — at mode \'on\' with no idea book, every quarterly fire is the \'off\' fire plus ONE registry read', () => {
  for (const registry of ['missing', 'empty']) {
    for (const s of SCENARIOS) {
      it(`${s.name} (registry ${registry})`, async () => {
        const scenario = { ...s, registry };
        const off = await fire(scenario, 'off');
        const on = await fire(scenario, 'on');
        // 'off' reads nothing of the Practice Field; 'on' reads the registry exactly once, as its first operation.
        expect(off.firestore.filter(isRegistryRead)).toEqual([]);
        expect(on.firestore.filter(isRegistryRead)).toEqual([['get', REGISTRY]]);
        expect(on.firestore[0]).toEqual(['get', REGISTRY]);
        expect(discoveryQueries(on)).toEqual([]);
        // Everything else — response, stored documents, logs, upstream and model calls, every other operation in
        // order — is the 'off' fire's.
        expect(withoutRegistryRead(on)).toEqual(off);
      });
    }
  }

  it('Astra\'s retention case: a completed close replay deletes both expired documents and answers complete: true, errors: 0 — at \'on\' as at \'off\'', async () => {
    const s = SCENARIOS.find((x) => x.name === 'draining-query-outage-close-replay');
    for (const mode of ['off', 'on']) {
      const rec = await fire(s, mode);
      expect(rec.response.body, mode).toMatchObject({ ok: true, complete: true, errors: 0 });
      expect(rec.response.body, mode).not.toHaveProperty('drainingIdeaBooks');
      for (const path of EXPIRED) expect(rec.store.some(([p]) => p === path), `${mode} ${path}`).toBe(false);
    }
  });
});

describe('Astra T2A-02 — the controls: where the registry cannot say "none", discovery runs as before', () => {
  it('the registry read FAILS: discovery runs (the draining query is made), and a discovery failure still counts', async () => {
    const replay = SCENARIOS.find((x) => x.name === 'draining-query-outage-close-replay');
    const ok = await fire({ ...replay, failDraining: false, failRegistry: true }, 'on');
    expect(ok.firestore.filter(isRegistryRead)).toHaveLength(1);
    expect(discoveryQueries(ok).length).toBeGreaterThan(0);
    expect(ok.logs.some((l) => l[0] === 'error' && /PRACTICE_FIELD_REGISTRY_READ_FAILED/.test(l[1]))).toBe(true);
    expect(ok.response.body).toMatchObject({ complete: true, errors: 0 }); // the queries found no book: nothing owed
    const failing = await fire({ ...replay, failRegistry: true }, 'on');
    expect(failing.response.body).toMatchObject({ complete: false, errors: 1, drainingIdeaBooks: { failed: true } });
    for (const path of EXPIRED) expect(failing.store.some(([p]) => p === path), path).toBe(true); // no retention
  });

  it('a registry that is not the registry\'s shape (openBooks missing) answers "unknown": discovery runs', async () => {
    const s = SCENARIOS.find((x) => x.name === 'close-cash');
    const rec = await fire(s, 'on', async (db) => { await db.doc(REGISTRY).set({ cap: 4 }); });
    expect(discoveryQueries(rec).length).toBeGreaterThan(0);
  });

  it('the registry lists a book that is DRAINING: discovery runs, and the draining book is closed by the Practice Field\'s own query', async () => {
    const s = SCENARIOS.find((x) => x.name === 'close-cash');
    const rec = await fire(s, 'on', async (db) => {
      const book = await seedBook({ db, uid: 'owner-d', opId: 'c-d' });
      await book.bookRef.update({ status: 'draining' }); // nothing sets the status yet (T1a-2b): a fixture stands in
    });
    expect(discoveryQueries(rec).some((op) => op[2].some((p) => p[1] === 'status' && p[3] === 'draining'))).toBe(true);
    expect(rec.response.body).toMatchObject({ drainingIdeaBooks: { books: 1 } });
  });

  it('one ACTIVE and one DRAINING idea book: the fire differs from \'off\' beyond the registry read, as it must', async () => {
    const s = SCENARIOS.find((x) => x.name === 'hold');
    const prepare = async (db) => {
      await seedBook({ db, uid: 'owner-a', opId: 'c-a' });
      const d = await seedBook({ db, uid: 'owner-d', opId: 'c-d' });
      await d.bookRef.update({ status: 'draining' });
    };
    const off = await fire(s, 'off', prepare);
    const on = await fire(s, 'on', prepare);
    expect(on.firestore.filter(isRegistryRead)).toHaveLength(1);
    expect(discoveryQueries(on).length).toBeGreaterThan(0);
    expect(withoutRegistryRead(on)).not.toEqual(off);
    expect(on.response.body).toHaveProperty('ideaBooks');
  });
});
