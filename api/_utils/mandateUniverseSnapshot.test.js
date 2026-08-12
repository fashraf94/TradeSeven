// api/_utils/mandateUniverseSnapshot.test.js
// Spec 1 §3.0 — two-layer snapshot builder: build-set priority, completeness,
// the I11 candidate floor, the size budget, and per-symbol freshness.

import { describe, it, expect, vi } from 'vitest';
import {
  assembleBuildSet,
  assembleFastEntries,
  countCompleteCandidates,
  fitToByteBudget,
  docByteSize,
  classifyHeldFreshness,
  isSymbolActionable,
  markFor,
  ensureUniverseSnapshot,
  bumpUpstreamCounter,
} from './mandateUniverseSnapshot.js';
import { MANDATE_MARK_MAX_AGE_MS } from './mandateConfig.js';

// ── Minimal in-memory Firestore fake (get/set + runTransaction) ──────────────
function makeFakeDb() {
  const store = new Map(); // path -> data
  const docApi = (path) => ({
    path,
    async get() {
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    async set(data, opts) {
      if (opts?.merge && store.has(path)) store.set(path, { ...store.get(path), ...data });
      else store.set(path, data);
    },
  });
  const db = {
    _store: store,
    collection: (col) => ({ doc: (id) => docApi(`${col}/${id}`) }),
    async runTransaction(fn) {
      const tx = {
        async get(ref) { return ref.get(); },
        set(ref, data, opts) { return ref.set(data, opts); },
        update(ref, data) { return ref.set(data, { merge: true }); },
      };
      return fn(tx);
    },
  };
  return db;
}

describe('assembleBuildSet — held priority + cap (§3.0)', () => {
  it('unions candidates and held, held first', () => {
    const { symbols, heldSet } = assembleBuildSet(['aapl', 'ZZZ'], { candidateUniverse: ['AAPL', 'MSFT'] });
    expect(symbols[0]).toBe('AAPL');
    expect(symbols).toContain('ZZZ'); // carry-over held, not a candidate
    expect(symbols).toContain('MSFT');
    expect(heldSet.has('AAPL')).toBe(true);
  });

  it('carry-overs are held-but-not-candidate', () => {
    const { carryOverHeld } = assembleBuildSet(['AAPL', 'DEAD'], { candidateUniverse: ['AAPL', 'MSFT'] });
    expect(carryOverHeld).toEqual(['DEAD']);
  });

  it('caps candidates but never drops held; dropped candidates counted', () => {
    const cands = Array.from({ length: 10 }, (_, i) => `C${i}`);
    const { symbols, droppedCandidates, candidateCapacity } = assembleBuildSet(['H1', 'H2'], { candidateUniverse: cands, cap: 5 });
    // 2 held + up to 3 candidates == cap 5
    expect(symbols.length).toBe(5);
    expect(symbols).toContain('H1');
    expect(symbols).toContain('H2');
    expect(droppedCandidates).toBe(7);
    expect(candidateCapacity).toBe(3);
  });

  it('held beyond the cap are all still included (exits are sacrosanct)', () => {
    const held = Array.from({ length: 8 }, (_, i) => `H${i}`);
    const { symbols, candidateCapacity } = assembleBuildSet(held, { candidateUniverse: ['C1', 'C2'], cap: 5 });
    expect(symbols.length).toBe(8); // all held survive
    expect(candidateCapacity).toBe(0); // no room for candidates → degraded
  });
});

describe('assembleFastEntries — completeness (F11)', () => {
  const now = new Date('2026-08-12T14:00:00Z');
  const ts = Math.floor(now.getTime() / 1000); // a fresh upstream timestamp (epoch seconds)
  it('marks positive RAW-close prices complete; previousClose fallback never becomes the mark', () => {
    // BADFALLBACK: no live `close`, only previousClose — must FREEZE (not trade
    // yesterday's close). PricedZero: close 0. NULLP: null close. ABSENT: no quote.
    const quotes = {
      AAPL: { close: 200, current: 200, timestamp: ts },
      BADFALLBACK: { close: null, previousClose: 190, current: 190 },
      PRICEDZERO: { close: 0, current: 0 },
      NULLP: { close: null, current: null },
    };
    const { entries, completeCount, missing } = assembleFastEntries(['AAPL', 'BADFALLBACK', 'PRICEDZERO', 'NULLP', 'ABSENT'], quotes, { now });
    expect(entries.AAPL.complete).toBe(true);
    expect(entries.AAPL.price).toBe(200);
    expect(entries.AAPL.priceAsOf).toBe(new Date(ts * 1000).toISOString()); // from the upstream quote time
    expect(entries.BADFALLBACK.complete).toBe(false); // yesterday's close does NOT count
    expect(entries.PRICEDZERO.complete).toBe(false);
    expect(entries.NULLP.complete).toBe(false);
    expect(entries.ABSENT.complete).toBe(false);
    expect(entries.ABSENT.priceAsOf).toBe(null);
    expect(completeCount).toBe(1);
    expect(missing.sort()).toEqual(['ABSENT', 'BADFALLBACK', 'NULLP', 'PRICEDZERO']);
  });

  it('denormalizes daily sector/marketCap when supplied', () => {
    const quotes = { AAPL: { close: 200, timestamp: ts } };
    const dailyEntries = { AAPL: { sector: 'Technology', industry: 'X', marketCap: 3e12 } };
    const { entries } = assembleFastEntries(['AAPL'], quotes, { now, dailyEntries });
    expect(entries.AAPL.sector).toBe('Technology');
    expect(entries.AAPL.marketCap).toBe(3e12);
  });
});

describe('countCompleteCandidates + floor', () => {
  it('counts only complete non-held candidates', () => {
    const entries = {
      HELD: { complete: true }, C1: { complete: true }, C2: { complete: false }, C3: { complete: true },
    };
    expect(countCompleteCandidates(entries, new Set(['HELD']))).toBe(2);
  });
});

describe('fitToByteBudget — §3.0 size discipline', () => {
  it('drops candidates before held, never held', () => {
    const heldSet = new Set(['H1']);
    const entries = {};
    entries.H1 = { price: 1, complete: true, blob: 'x'.repeat(50) };
    for (let i = 0; i < 20; i++) entries[`C${i}`] = { price: 1, complete: true, blob: 'y'.repeat(50) };
    const base = { tickKey: 't' };
    const full = docByteSize({ ...base, symbols: entries });
    const { entries: fitted, dropped } = fitToByteBudget(base, entries, heldSet, { maxBytes: Math.floor(full / 2) });
    expect(dropped).toBeGreaterThan(0);
    expect(fitted.H1).toBeDefined(); // held survives
  });

  it('throws (fails loud) if held-only exceeds the budget', () => {
    const heldSet = new Set(['H1', 'H2']);
    const entries = { H1: { blob: 'x'.repeat(500) }, H2: { blob: 'y'.repeat(500) } };
    expect(() => fitToByteBudget({ tickKey: 't' }, entries, heldSet, { maxBytes: 100 })).toThrow(/held symbols alone/);
  });
});

describe('classifyHeldFreshness — per-symbol (I2)', () => {
  const now = new Date('2026-08-12T14:00:00Z');
  it('actionable iff present, complete, and fresh; others frozen', () => {
    const fresh = new Date(now.getTime() - 1000).toISOString();
    const stale = new Date(now.getTime() - MANDATE_MARK_MAX_AGE_MS - 1000).toISOString();
    const snapshot = {
      symbols: {
        FRESH: { complete: true, priceAsOf: fresh },
        STALE: { complete: true, priceAsOf: stale },
        INCOMPLETE: { complete: false, priceAsOf: fresh },
      },
    };
    const { actionable, frozen } = classifyHeldFreshness(snapshot, ['FRESH', 'STALE', 'INCOMPLETE', 'ABSENT'], { now, maxAgeMs: MANDATE_MARK_MAX_AGE_MS });
    expect([...actionable]).toEqual(['FRESH']);
    expect(frozen.has('STALE')).toBe(true);
    expect(frozen.has('INCOMPLETE')).toBe(true);
    expect(frozen.has('ABSENT')).toBe(true);
  });
});

describe('isSymbolActionable + markFor', () => {
  const snapshot = { symbols: { AAPL: { complete: true, price: 200 }, BAD: { complete: false, price: null } } };
  it('BUY eligibility requires present-and-complete (F16)', () => {
    expect(isSymbolActionable(snapshot, 'aapl')).toBe(true);
    expect(isSymbolActionable(snapshot, 'BAD')).toBe(false);
    expect(isSymbolActionable(snapshot, 'ABSENT')).toBe(false);
  });
  it('markFor returns the fill price only for complete symbols', () => {
    expect(markFor(snapshot, 'AAPL')).toBe(200);
    expect(markFor(snapshot, 'BAD')).toBe(null);
  });
});

describe('ensureUniverseSnapshot — I/O, idempotency, degraded floor', () => {
  it('builds, writes, counts upstream calls, and flags degraded below the floor', async () => {
    const db = makeFakeDb();
    const cands = Array.from({ length: 5 }, (_, i) => `C${i}`);
    const fetchQuotes = vi.fn(async (syms) => Object.fromEntries(syms.map((s) => [s, { close: 100 }])));
    const res = await ensureUniverseSnapshot(db, {
      tickKey: '2026-08-12_open30', sessionDate: '2026-08-12', heldTickers: ['H1'],
      candidateUniverse: cands, fetchQuotes, batchSize: 100, now: new Date('2026-08-12T14:00:00Z'),
    });
    expect(res.built).toBe(true);
    expect(res.degraded).toBe(true); // 5 candidates < floor 100
    expect(res.upstreamCalls).toBe(1); // 6 symbols / batch 100 == 1 call
    expect(fetchQuotes).toHaveBeenCalledOnce();
    expect(db._store.get('mandateUniverseSnapshots/2026-08-12_open30')).toBeDefined();
    // upstream counter incremented
    expect(db._store.get('mandateUpstreamCalls/2026-08-12').count).toBe(1);
  });

  it('is idempotent on tickKey (no refetch)', async () => {
    const db = makeFakeDb();
    const fetchQuotes = vi.fn(async (syms) => Object.fromEntries(syms.map((s) => [s, { close: 100 }])));
    const opts = { tickKey: 'T', sessionDate: '2026-08-12', heldTickers: ['H1'], candidateUniverse: ['C1'], fetchQuotes };
    await ensureUniverseSnapshot(db, opts);
    fetchQuotes.mockClear();
    const second = await ensureUniverseSnapshot(db, opts);
    expect(second.built).toBe(false);
    expect(fetchQuotes).not.toHaveBeenCalled();
  });
});

describe('bumpUpstreamCounter — alert crossing', () => {
  it('alerts exactly once when crossing the threshold fraction', async () => {
    const db = makeFakeDb();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // ceiling 100, fraction 0.5 → threshold 50
    await bumpUpstreamCounter(db, '2026-08-12', 40, { ceiling: 100, alertFraction: 0.5 });
    expect(spy).not.toHaveBeenCalled();
    await bumpUpstreamCounter(db, '2026-08-12', 20, { ceiling: 100, alertFraction: 0.5 }); // 40→60 crosses 50
    expect(spy).toHaveBeenCalledOnce();
    await bumpUpstreamCounter(db, '2026-08-12', 10, { ceiling: 100, alertFraction: 0.5 }); // already over — no re-alert
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
