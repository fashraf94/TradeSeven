// api/_utils/mandateUniverseSnapshot.topUp.test.js
//
// Practice Field T1a-2b-2 §3 (Astra T1A-06) — THE ENGINE'S DAILY TOP-UP CANNOT LOSE NEWLY FETCHED DATA. A day doc built
// for idea books alone (`candidateUniverseOmitted`) is rebuilt once with the candidate universe. Two such rebuilds can
// both read the omitted doc; the slower one's blind `set` used to erase a corporate action the faster one fetched for a
// newly added symbol. The top-up now publishes in a transaction and reconciles. The first build and `force` — the paths
// quarterly books take — publish exactly as before.
//
// On the engine's transaction-faithful in-memory Firestore: a transaction whose read changed under it is run again.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { ensureDailySnapshot, reconcileDailyEntry } from './mandateUniverseSnapshot.js';

const DATE = '2026-11-18';
const PATH = `mandateUniverseDaily/${DATE}`;
const AAPL_DIV = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: '2026-11-17', amount: 0.26, source: 'eodhd_dividends' };
const MSFT_DIV = { type: 'cash_dividend', ticker: 'MSFT', effectiveDate: '2026-11-19', amount: 0.91, source: 'eodhd_dividends' };
const CLASS = { AAPL: { sector: 'Technology', industry: 'Hardware', marketCap: 3.4e12 }, MSFT: { sector: 'Technology', industry: 'Software', marketCap: 3.1e12 }, JPM: { sector: 'Financials', industry: 'Banks', marketCap: 6.8e11 } };

/** The omitted doc the morning's idea-only build left: AAPL, with its dividend. */
const OMITTED = Object.freeze({
  schemaVersion: 1, date: DATE, builtAt: new Date('2026-11-18T14:31:00.000Z'), heldCount: 0, symbolCount: 1, completeCount: 1, missing: [],
  caWindow: { from: '2026-11-13', to: '2026-11-20' }, caFailedCount: 0, candidateUniverseOmitted: true,
  symbols: { AAPL: { sector: 'Technology', industry: 'Hardware', marketCap: 3.4e12, source: 'eodhd_fundamentals', complete: true, corporateActions: [AAPL_DIV] } },
});

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const fundamentals = (fail = new Set()) => async (sym) => {
  if (fail.has(sym)) throw new Error('fundamentals down');
  return { fundamentals: CLASS[sym] || { sector: 'S', industry: 'I', marketCap: 1e11 }, cacheStatus: { fundamentals: 'cache' } };
};
const ok = (actions) => ({ actions, calls: 2, failed: false });
const FAILED = Object.freeze({ actions: [], calls: 2, failed: true });

/** A rebuild that needs the universe (MSFT), carrying AAPL; its MSFT answer waits for `gate`. */
function rebuild(db, { msft, gate = null, failFundamentals = new Set(), candidateUniverse = ['MSFT'] }) {
  return ensureDailySnapshot(db, {
    date: DATE, heldTickers: ['AAPL'], candidateUniverse, now: new Date('2026-11-18T15:46:00.000Z'),
    getFundamentals: fundamentals(failFundamentals),
    fetchCorporateActions: async (sym) => {
      if (sym === 'MSFT' && gate) await gate.promise;
      return sym === 'MSFT' ? msft : ok([]);
    },
  });
}
const seeded = () => makeMandateFakeDb({ [PATH]: OMITTED });
const day = (db) => db._get(PATH);

/**
 * Astra's race: two rebuilds both read the omitted doc; `first` and `second` are their MSFT answers, in COMMIT order.
 * Returns the stored doc.
 */
async function race(first, second, opts = {}) {
  const db = seeded();
  const gates = [deferred(), deferred()];
  const a = rebuild(db, { msft: first, gate: gates[0], ...opts });
  const b = rebuild(db, { msft: second, gate: gates[1], ...opts });
  await new Promise((r) => setTimeout(r, 0)); // both have read the omitted doc and are waiting on MSFT
  gates[0].resolve();
  const ra = await a;
  gates[1].resolve();
  const rb = await b;
  return { db, doc: day(db), ra, rb };
}

let log;
beforeEach(() => { log = vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('Astra T1A-06 — the race, in both commit orders', () => {
  for (const [name, first, second] of [
    ['the writer that fetched the dividend commits first', ok([MSFT_DIV]), ok([])],
    ['the writer that fetched none commits first', ok([]), ok([MSFT_DIV])],
  ]) {
    it(`${name}: AAPL is kept exactly, MSFT's dividend survives, and the mark is gone`, async () => {
      const { doc, ra, rb } = await race(first, second);
      expect(doc.symbols.AAPL).toEqual(OMITTED.symbols.AAPL);
      expect(doc.symbols.MSFT.corporateActions).toEqual([MSFT_DIV]);
      expect(doc).not.toHaveProperty('candidateUniverseOmitted');
      expect(doc).toMatchObject({ symbolCount: 2, completeCount: 2, missing: [], caFailedCount: 0 });
      // The first publishes; the second adopts when it has nothing to add, and publishes the reconciled doc when it has.
      expect(ra.built).toBe(true);
      expect(rb.built).toBe(name.endsWith('none commits first'));
      expect(log.mock.calls.flat().filter((l) => /built without the candidate universe/.test(l))).toHaveLength(2);
    });
  }
});

describe('divergent, empty and failed new-symbol answers, in both orders', () => {
  const both = async (x, y) => [(await race(x, y)).doc, (await race(y, x)).doc];

  it('divergent: two different answers for MSFT are both kept, whichever commits first — the ledger\'s conflict rule decides between rows of one id', async () => {
    const other = { ...MSFT_DIV, amount: 0.92 }; // same id, another amount
    const later = { ...MSFT_DIV, effectiveDate: '2026-11-20' }; // another id
    for (const doc of await both(ok([MSFT_DIV]), ok([other, later]))) {
      expect(doc.symbols.MSFT.corporateActions).toHaveLength(3);
      expect(doc.symbols.MSFT.corporateActions).toEqual(expect.arrayContaining([MSFT_DIV, other, later]));
      expect(doc.symbols.AAPL).toEqual(OMITTED.symbols.AAPL);
    }
    // The same row twice is one row, whatever its key order.
    const reordered = Object.fromEntries(Object.entries(MSFT_DIV).reverse());
    for (const doc of await both(ok([MSFT_DIV]), ok([reordered]))) expect(doc.symbols.MSFT.corporateActions).toEqual([MSFT_DIV]);
  });

  it('empty: both answer nothing — MSFT carries no action and no failure', async () => {
    for (const doc of await both(ok([]), ok([]))) {
      expect(doc.symbols.MSFT).toEqual({ ...CLASS.MSFT, source: 'eodhd_fundamentals', complete: true });
    }
  });

  it('failed: one fetch fails — the other\'s dividend stands and the symbol is not marked failed; both fail — it is, and counted', async () => {
    for (const doc of await both(ok([MSFT_DIV]), FAILED)) {
      expect(doc.symbols.MSFT.corporateActions).toEqual([MSFT_DIV]);
      expect(doc.symbols.MSFT).not.toHaveProperty('caFetchFailed');
      expect(doc.caFailedCount).toBe(0);
    }
    for (const doc of await both(ok([]), FAILED)) expect(doc.symbols.MSFT).not.toHaveProperty('caFetchFailed');
    for (const doc of await both(FAILED, FAILED)) {
      expect(doc.symbols.MSFT.caFetchFailed).toBe(true);
      expect(doc.caFailedCount).toBe(1);
    }
  });

  it('a classification only one rebuild obtained is kept, whichever commits first', async () => {
    for (const order of [[0, 1], [1, 0]]) {
      const db = seeded();
      const gates = [deferred(), deferred()];
      const runs = [
        rebuild(db, { msft: ok([]), gate: gates[0], failFundamentals: new Set(['MSFT']) }),
        rebuild(db, { msft: ok([]), gate: gates[1] }),
      ];
      await new Promise((r) => setTimeout(r, 0));
      gates[order[0]].resolve(); await runs[order[0]];
      gates[order[1]].resolve(); await runs[order[1]];
      expect(day(db).symbols.MSFT, String(order)).toMatchObject({ ...CLASS.MSFT, complete: true });
      expect(day(db), String(order)).toMatchObject({ completeCount: 2, missing: [] });
    }
  });
});

describe('the transaction is the precondition: a top-up that commits between another\'s read and its write is not overwritten', () => {
  it('A reads the omitted doc in its transaction; B\'s whole top-up commits; A is run again against B\'s result and adds its dividend to it', async () => {
    const db = seeded();
    // A's publish reads the doc, then — before A commits — B runs from start to finish (it read the omitted doc too).
    const bRead = deferred();
    let bRun = null;
    db.setBarrier(async () => { bRun = rebuild(db, { msft: ok([]) }); await bRun; bRead.resolve(); });
    const ra = await rebuild(db, { msft: ok([MSFT_DIV]) });
    await bRead.promise;
    expect((await bRun).built).toBe(true);
    expect(ra.built).toBe(true);
    const doc = day(db);
    expect(doc.symbols.MSFT.corporateActions).toEqual([MSFT_DIV]);
    expect(doc.symbols.AAPL).toEqual(OMITTED.symbols.AAPL);
    expect(doc).not.toHaveProperty('candidateUniverseOmitted');
  });
});

describe('every prior entry is kept', () => {
  it('an uncontended top-up keeps every entry of the omitted doc exactly — one outside its own build set too — and recomputes the counts', async () => {
    const db = makeMandateFakeDb({ [PATH]: { ...OMITTED, symbolCount: 2, symbols: { ...OMITTED.symbols, JPM: { ...CLASS.JPM, source: 'eodhd_fundamentals', complete: false, caFetchFailed: true } } } });
    const r = await rebuild(db, { msft: ok([MSFT_DIV]) });
    const doc = day(db);
    expect(doc.symbols.AAPL).toEqual(OMITTED.symbols.AAPL);
    expect(doc.symbols.JPM).toEqual({ ...CLASS.JPM, source: 'eodhd_fundamentals', complete: false, caFetchFailed: true });
    expect(doc.symbols.MSFT.corporateActions).toEqual([MSFT_DIV]);
    expect(doc).toMatchObject({ symbolCount: 3, completeCount: 2, missing: ['JPM'], caFailedCount: 1 });
    expect(r).toMatchObject({ built: true, symbolCount: 3, completeCount: 2, caFailedCount: 1 });
  });

  it('reconcileDailyEntry: the stored entry is kept; the newer fetch adds only what it lacks', () => {
    const stored = { ...CLASS.MSFT, source: 's', complete: true, corporateActions: [MSFT_DIV] };
    expect(reconcileDailyEntry(stored, { sector: 'Other', industry: 'Other', marketCap: 1, source: 'f', complete: true })).toEqual(stored);
    expect(reconcileDailyEntry({ sector: null, industry: null, marketCap: null, source: 's', complete: false, caFetchFailed: true }, { ...CLASS.MSFT, source: 'f', complete: true, corporateActions: [MSFT_DIV] }))
      .toEqual({ ...CLASS.MSFT, source: 'f', complete: true, corporateActions: [MSFT_DIV] });
  });
});

describe('the quarterly paths are unchanged: the first build and `force` publish exactly as before, with no transaction on the day doc', () => {
  /** A db that records every document a transaction reads. */
  const recording = (seed = {}) => {
    const db = makeMandateFakeDb(seed);
    const reads = [];
    const run = db.runTransaction;
    db.runTransaction = (fn, opts) => run((tx) => fn({ ...tx, get: (ref) => { reads.push(ref.path); return tx.get(ref); } }), opts);
    return { db, reads };
  };
  const quarterly = (db, opts = {}) => ensureDailySnapshot(db, {
    date: DATE, heldTickers: ['AAPL'], candidateUniverse: ['MSFT', 'JPM'], now: new Date('2026-11-18T14:31:00.000Z'),
    getFundamentals: fundamentals(), fetchCorporateActions: async (sym) => ok(sym === 'MSFT' ? [MSFT_DIV] : []), ...opts,
  });

  it('a first build creates the document as built; no transaction reads it', async () => {
    const { db, reads } = recording();
    const r = await quarterly(db);
    expect(r).toMatchObject({ built: true, symbolCount: 3, completeCount: 3, caFailedCount: 0 });
    expect(reads).not.toContain(PATH);
    expect(day(db)).toEqual({
      schemaVersion: 1, date: DATE, builtAt: new Date('2026-11-18T14:31:00.000Z'), heldCount: 1, symbolCount: 3, completeCount: 3, missing: [],
      caWindow: { from: '2026-11-13', to: '2026-11-20' }, caFailedCount: 0,
      symbols: {
        AAPL: { ...CLASS.AAPL, source: 'eodhd_fundamentals', complete: true },
        MSFT: { ...CLASS.MSFT, source: 'eodhd_fundamentals', complete: true, corporateActions: [MSFT_DIV] },
        JPM: { ...CLASS.JPM, source: 'eodhd_fundamentals', complete: true },
      },
    });
  });

  it('two first builds race: the loser adopts the winner\'s document exactly — nothing of its own is merged in', async () => {
    const { db, reads } = recording();
    const gate = deferred();
    const slow = ensureDailySnapshot(db, {
      date: DATE, heldTickers: ['AAPL'], candidateUniverse: ['MSFT', 'JPM'], now: new Date('2026-11-18T14:32:00.000Z'), getFundamentals: fundamentals(),
      fetchCorporateActions: async (sym) => { await gate.promise; return ok(sym === 'JPM' ? [{ type: 'cash_dividend', ticker: 'JPM', effectiveDate: '2026-11-19', amount: 1.4, source: 'x' }] : []); },
    });
    await new Promise((r) => setTimeout(r, 0));
    await quarterly(db);
    const winner = JSON.stringify(day(db));
    gate.resolve();
    expect((await slow).built).toBe(false);
    expect(JSON.stringify(day(db))).toBe(winner);
    expect(reads).not.toContain(PATH);
  });

  it('a FORCE build replaces the document exactly — an omitted doc\'s entries are not carried — and no transaction reads it', async () => {
    const { db, reads } = recording({ [PATH]: OMITTED });
    const r = await quarterly(db, { force: true });
    expect(r.built).toBe(true);
    expect(reads).not.toContain(PATH);
    expect(day(db).symbols.AAPL).toEqual({ ...CLASS.AAPL, source: 'eodhd_fundamentals', complete: true }); // fetched again, its dividend not carried
    expect(day(db)).not.toHaveProperty('candidateUniverseOmitted');
  });

  it('a document without the mark is adopted at once: no fetch, no write', async () => {
    const { db } = recording({ [PATH]: { ...OMITTED, candidateUniverseOmitted: undefined } });
    const fetchSpy = vi.fn();
    const before = JSON.stringify(day(db));
    const r = await quarterly(db, { fetchCorporateActions: fetchSpy, getFundamentals: fetchSpy });
    expect(r).toMatchObject({ built: false, upstreamCalls: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(day(db))).toBe(before);
  });
});
