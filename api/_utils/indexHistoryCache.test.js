// api/_utils/indexHistoryCache.test.js
//
// EODHD Quick Wins QW-6 — the per-session daily-history store, unit rows (the
// handler-level identity proof is api/cron/compute-index-intelligence.qw6.test.js).
// The calendar of record is real: 2026-10-07 is a Wednesday, its prior session
// is 2026-10-06.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionHistoryStore, checkStoredHistory, INDEX_HISTORY_COLLECTION } from './indexHistoryCache.js';

const ET_TODAY = '2026-10-07';
const PRIOR = '2026-10-06';
const rows = (newest, n = 3) => Array.from({ length: n }, (_, i) => ({ date: i === 0 ? newest : `2026-09-${String(30 - i).padStart(2, '0')}`, close: 100 + i }));

function fakeDb({ failRead = false, failWrite = false } = {}) {
  const docs = new Map();
  return {
    docs,
    collection: (col) => ({
      doc: (id) => ({
        get: async () => {
          if (failRead) throw new Error('read down');
          const v = docs.get(`${col}/${id}`);
          return { exists: v !== undefined, data: () => structuredClone(v) };
        },
        set: async (d) => {
          if (failWrite) throw new Error('write down');
          docs.set(`${col}/${id}`, structuredClone(d));
        },
      }),
    }),
  };
}
const stored = (over = {}) => ({ symbol: 'AAPL.US', daysBack: 252, etDate: ET_TODAY, newestBarDate: PRIOR, rows: rows(PRIOR), dropped: 2, ...over });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('checkStoredHistory — the session-currency rule on a stored history', () => {
  const ctx = { daysBack: 252, etToday: ET_TODAY, expected: PRIOR };
  it('serves only this session\'s fetch, for this window, whose newest bar is the prior session', () => {
    expect(checkStoredHistory(stored(), ctx)).toEqual({ ok: true, reason: null });
    expect(checkStoredHistory(stored({ daysBack: 50 }), ctx).reason).toBe('window_mismatch');
    expect(checkStoredHistory(stored({ etDate: '2026-10-06' }), ctx).reason).toBe('other_session_date');
    expect(checkStoredHistory(stored({ rows: rows('2026-10-05') }), ctx).reason).toBe('stale_session');
    expect(checkStoredHistory(stored({ rows: rows(ET_TODAY) }), ctx).reason).toBe('current_day_bar');
    expect(checkStoredHistory(stored({ rows: [] }), ctx).reason).toBe('empty');
    expect(checkStoredHistory(stored(), { ...ctx, expected: null }).reason).toBe('calendar_missing');
  });
});

describe('createSessionHistoryStore — load', () => {
  it('a current stored history is served with its dropped count, and the vendor is not called', async () => {
    const db = fakeDb();
    db.docs.set(`${INDEX_HISTORY_COLLECTION}/AAPL.US`, stored());
    const store = createSessionHistoryStore(db, { etToday: ET_TODAY });
    const fetchFresh = vi.fn();
    const r = await store.load('AAPL.US', 252, fetchFresh);
    expect(fetchFresh).not.toHaveBeenCalled();
    expect(r).toEqual({ rows: rows(PRIOR), dropped: 2, source: 'store' });
    expect(store.stats.served).toBe(1);
  });

  it('a miss fetches fresh and writes through a CURRENT series, stamped with the session date', async () => {
    const db = fakeDb();
    const store = createSessionHistoryStore(db, { etToday: ET_TODAY });
    const r = await store.load('AAPL.US', 252, async () => ({ rows: rows(PRIOR), dropped: 1 }));
    expect(r.source).toBe('fetched');
    expect(db.docs.get(`${INDEX_HISTORY_COLLECTION}/AAPL.US`)).toEqual(expect.objectContaining({ etDate: ET_TODAY, daysBack: 252, newestBarDate: PRIOR, dropped: 1, rows: rows(PRIOR) }));
  });

  it('a fresh series that itself fails the rule is used but NOT stored', async () => {
    const db = fakeDb();
    const store = createSessionHistoryStore(db, { etToday: ET_TODAY });
    const r = await store.load('AAPL.US', 252, async () => ({ rows: rows('2026-10-05'), dropped: 0 }));
    expect(r.rows[0].date).toBe('2026-10-05');
    expect(db.docs.size).toBe(0);
  });

  it('a stale stored history is refused and re-fetched', async () => {
    const db = fakeDb();
    db.docs.set(`${INDEX_HISTORY_COLLECTION}/AAPL.US`, stored({ etDate: '2026-10-06', rows: rows('2026-10-05') }));
    const store = createSessionHistoryStore(db, { etToday: ET_TODAY });
    const fetchFresh = vi.fn(async () => ({ rows: rows(PRIOR), dropped: 0 }));
    await store.load('AAPL.US', 252, fetchFresh);
    expect(fetchFresh).toHaveBeenCalledTimes(1);
    expect(store.stats.reasons).toEqual({ other_session_date: 1 });
  });

  it('a store read or write failure never costs the run its data', async () => {
    const r1 = await createSessionHistoryStore(fakeDb({ failRead: true }), { etToday: ET_TODAY })
      .load('AAPL.US', 252, async () => ({ rows: rows(PRIOR), dropped: 0 }));
    expect(r1.rows[0].date).toBe(PRIOR);
    const r2 = await createSessionHistoryStore(fakeDb({ failWrite: true }), { etToday: ET_TODAY })
      .load('AAPL.US', 252, async () => ({ rows: rows(PRIOR), dropped: 0 }));
    expect(r2.source).toBe('fetched');
  });

  it('outside the maintained calendar nothing is read or stored', async () => {
    const db = fakeDb();
    const store = createSessionHistoryStore(db, { etToday: '2031-01-07' });
    expect(store.expected).toBeNull();
    const r = await store.load('AAPL.US', 252, async () => ({ rows: rows('2031-01-06'), dropped: 0 }));
    expect(r.source).toBe('fetched');
    expect(db.docs.size).toBe(0);
  });

  it('a vendor failure propagates exactly as today\'s fetch does', async () => {
    const store = createSessionHistoryStore(fakeDb(), { etToday: ET_TODAY });
    await expect(store.load('AAPL.US', 252, async () => { throw new Error('EODHD AAPL.US: HTTP 500'); })).rejects.toThrow('HTTP 500');
  });
});
