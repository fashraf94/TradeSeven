// api/_utils/ingestedClaims.test.js
// Catalyst-path defects (Aug 10) — A6 acceptance row C2 for getClaimsForReporter.
//   C2 — getClaimsForReporter(reporter, {ticker}) returns the reporter's
//        primary- AND linked-ticker claims. Pre-fix the linked query chained
//        two array-contains filters (relevantReporters + linkedTickers), which
//        Firestore rejects ("max 1 ARRAY_CONTAINS per disjunction"); the throw
//        was swallowed to [], so the feature was silently dead for Alex.
//
// The fake db reproduces the two real Firestore constraints the fix must
// respect: (1) a query with >1 array-contains throws at get(); (2) a query
// combining relevantReporters array-contains with a ticker == and an orderBy
// needs a composite index that is NOT declared (the uncommitted-index throw the
// array-contains error masked). Both make the OLD ticker path fail; only the
// restructured path (single array-contains / committed indexes, reporter scoped
// in memory) returns claims.

import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import { getClaimsForReporter } from './ingestedClaims.js';

// Committed ingestedClaims composite indexes (firestore.indexes.json).
const COMMITTED = [
  ['relevantReporters:array-contains', 'sourceDate'],
  ['ticker:==', 'sourceDate'],
  ['linkedTickers:array-contains', 'sourceDate'],
  ['ticker:==', 'source:==', 'sourceDate'],
  ['source:==', 'sourceDate'],
];

function makeClaimsDb(docs) {
  function run(filters) {
    const arrayContains = filters.filter((f) => f.op === 'array-contains');
    if (arrayContains.length > 1) {
      throw new Error("3 INVALID_ARGUMENT: A maximum of 1 'ARRAY_CONTAINS' filter per disjunction");
    }
    // A filter/orderBy combination beyond a committed index is a missing-index
    // failure in production — model it so an unindexed query cannot silently
    // "work" in the test and hide a regression.
    const ordered = filters.some((f) => f.orderBy);
    if (ordered) {
      const key = [
        ...filters.filter((f) => f.op).map((f) => `${f.field}:${f.op}`),
        'sourceDate',
      ];
      const ok = COMMITTED.some((idx) =>
        key.every((k) => idx.includes(k)) && key.length <= idx.length);
      if (!ok) {
        throw new Error(`9 FAILED_PRECONDITION: The query requires an index (unindexed: ${key.join(',')})`);
      }
    }
    let rows = docs.filter((d) => filters.filter((f) => f.op).every((f) => {
      const v = d[f.field];
      if (f.op === '==') return v === f.value;
      if (f.op === '>=') return (v || '') >= f.value;
      if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.value);
      return true;
    }));
    rows.sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''));
    const lim = filters.find((f) => f.limit != null);
    if (lim) rows = rows.slice(0, lim.limit);
    return { docs: rows.map((d) => ({ data: () => d })), empty: rows.length === 0 };
  }
  function makeQuery(filters) {
    return {
      where(field, op, value) { return makeQuery([...filters, { field, op, value }]); },
      orderBy(field) { return makeQuery([...filters, { orderBy: field }]); },
      limit(n) { return makeQuery([...filters, { limit: n }]); },
      async get() { return run(filters); },
    };
  }
  return { collection: () => makeQuery([]) };
}

const SEED = [
  { claimId: 'c_primary', relevantReporters: ['alex'], ticker: 'NVDA', linkedTickers: [], sourceDate: '2026-08-08', source: 'earnings_call', claim: 'alex primary NVDA' },
  { claimId: 'c_linked', relevantReporters: ['alex'], ticker: 'AMD', linkedTickers: ['NVDA'], sourceDate: '2026-08-09', source: 'analyst_commentary', claim: 'AMD/NVDA read-through, relevant to alex' },
  { claimId: 'c_otherrep', relevantReporters: ['doug'], ticker: 'NVDA', linkedTickers: [], sourceDate: '2026-08-10', source: 'earnings_call', claim: 'NVDA but not alex' },
];

describe('C2 — getClaimsForReporter ticker path returns primary + linked claims', () => {
  it('surfaces the alex primary AND linked-ticker claims, excludes other reporters', async () => {
    h.db = makeClaimsDb(SEED);
    const claims = await getClaimsForReporter('alex', { ticker: 'NVDA', limit: 5 });
    const ids = claims.map((c) => c.claimId).sort();
    // Pre-fix: linkedQuery's double array-contains throws -> [] -> this FAILS.
    expect(ids).toEqual(['c_linked', 'c_primary']);
  });

  it('honors the source option on the ticker path (doug earnings_call)', async () => {
    h.db = makeClaimsDb([
      { claimId: 'd1', relevantReporters: ['doug'], ticker: 'AAPL', linkedTickers: [], sourceDate: '2026-08-09', source: 'earnings_call', claim: 'doug earnings' },
      { claimId: 'd2', relevantReporters: ['doug'], ticker: 'AAPL', linkedTickers: [], sourceDate: '2026-08-10', source: 'analyst_commentary', claim: 'doug wrong source' },
    ]);
    const claims = await getClaimsForReporter('doug', { ticker: 'AAPL', source: 'earnings_call', limit: 8 });
    expect(claims.map((c) => c.claimId)).toEqual(['d1']);
  });

  it('returns [] (not a throw) when the reporter has no ticker claims', async () => {
    h.db = makeClaimsDb(SEED);
    const claims = await getClaimsForReporter('kim', { ticker: 'NVDA', limit: 5 });
    expect(claims).toEqual([]);
  });
});
