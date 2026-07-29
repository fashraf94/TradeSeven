// api/_utils/wireReader.test.js
// N1.0 — the raw Wire reader's contract (Phase 2 Spec V1.3, Amendment H).
//
// A6 rows here guard the reader's two belts: a quarantined entry referenced
// by a corrupted index must never surface (delete the `quarantined` filter
// → the corruption test goes red), and a dangling storyId must skip rather
// than throw (delete the `!entry` guard → the dangling test goes red).
// The fetch/resolve split is asserted with read accounting: one get per
// requested date, nothing else — N1.2's one-fetch-per-tick budget.

import { describe, it, expect } from 'vitest';
import { fetchWireDays, resolveSymbolEntries } from './wireReader.js';

const entry = (storyId, over = {}) => ({
  storyId,
  reporter: 'alex',
  headline: `H-${storyId}`,
  quarantined: false,
  agentFacts: { digest: `${storyId} digest.`, eventType: 'market_mover', tickers: ['NVDA'] },
  ...over,
});

function dayDoc(entries, bySymbol) {
  return { entries, bySymbol, macroEntries: [], receipts: {}, validationStats: {} };
}

function fakeDb(docs) {
  const reads = [];
  return {
    reads,
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          reads.push(`${col}/${id}`);
          const data = docs[`${col}/${id}`];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
}

describe('fetchWireDays — one batched read per requested date', () => {
  it('returns present days, omits missing ones, reads exactly the requested dates', async () => {
    const d1 = dayDoc([entry('a')], { NVDA: ['a'] });
    const db = fakeDb({ 'fantasyTimesWire/2026-07-28': d1 });

    const days = await fetchWireDays(db, ['2026-07-28', '2026-07-27']);
    expect(days.size).toBe(1);
    expect(days.get('2026-07-28')).toEqual(d1);
    expect(days.has('2026-07-27')).toBe(false);
    expect(db.reads.sort()).toEqual(['fantasyTimesWire/2026-07-27', 'fantasyTimesWire/2026-07-28']);
  });
});

describe('resolveSymbolEntries — pure resolution over fetched days', () => {
  const today = dayDoc(
    [entry('t1'), entry('t2', { agentFacts: { digest: 't2 digest.', eventType: 'gap_event', tickers: ['NVDA'] } })],
    { NVDA: ['t1', 't2'], AAPL: [] },
  );
  const prior = dayDoc([entry('p1')], { NVDA: ['p1'] });
  const days = new Map([['2026-07-28', today], ['2026-07-27', prior]]);

  it('resolves across days in the order given, persisted order within a day', () => {
    const got = resolveSymbolEntries(days, ['2026-07-28', '2026-07-27'], 'NVDA');
    expect(got.map((g) => g.entry.storyId)).toEqual(['t1', 't2', 'p1']);
    expect(got.map((g) => g.marketDate)).toEqual(['2026-07-28', '2026-07-28', '2026-07-27']);
    // Caller-side policy: newest-first is the caller passing dates newest-first.
    const reversed = resolveSymbolEntries(days, ['2026-07-27', '2026-07-28'], 'NVDA');
    expect(reversed[0].entry.storyId).toBe('p1');
  });

  it('unknown symbol, empty index, and missing day all resolve to []', () => {
    expect(resolveSymbolEntries(days, ['2026-07-28'], 'TSLA')).toEqual([]);
    expect(resolveSymbolEntries(days, ['2026-07-28'], 'AAPL')).toEqual([]);
    expect(resolveSymbolEntries(days, ['2026-01-02'], 'NVDA')).toEqual([]);
  });

  it('A6 belt 1: a quarantined entry referenced by a corrupted index never surfaces', () => {
    const corrupted = dayDoc(
      [entry('ok'), entry('bad', { quarantined: true })],
      { NVDA: ['ok', 'bad'] }, // index corruption: quarantined id present
    );
    const got = resolveSymbolEntries(new Map([['2026-07-28', corrupted]]), ['2026-07-28'], 'NVDA');
    expect(got.map((g) => g.entry.storyId)).toEqual(['ok']);
  });

  it('A6 belt 2: a dangling storyId skips — never throws, never yields a hole', () => {
    const dangling = dayDoc([entry('real')], { NVDA: ['ghost', 'real'] });
    const got = resolveSymbolEntries(new Map([['2026-07-28', dangling]]), ['2026-07-28'], 'NVDA');
    expect(got.map((g) => g.entry.storyId)).toEqual(['real']);
  });

  it('returns RAW entries — headline included (stripping is the DTO boundary, not the reader)', () => {
    const got = resolveSymbolEntries(days, ['2026-07-28'], 'NVDA');
    expect(got[0].entry.headline).toBe('H-t1');
  });
});
