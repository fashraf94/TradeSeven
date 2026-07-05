/**
 * useWatchlistGroup — reader unit suite (V2 Build 6). Tests the pure async
 * reader with a mocked Firestore getDoc (the ruleCompatMatrix/dimensionFieldAccess
 * idiom). No renderHook (not a house pattern): the hook wrapper is trivial glue
 * over useUser/useAgent, so we exercise readWatchlistGroup directly. Config/
 * context/agent modules are stubbed so the module graph loads clean in Node.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: { doc: undefined, getDocCalls: 0 } }));

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
vi.mock('./useAgent', () => ({ default: () => ({ agent: null }) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ __path: segments.join('/') }),
  getDoc: async () => {
    store.getDocCalls += 1;
    return { exists: () => store.doc !== undefined, data: () => store.doc };
  },
}));

import { readWatchlistGroup } from './useWatchlistGroup';

beforeEach(() => {
  store.doc = undefined;
  store.getDocCalls = 0;
});

describe('readWatchlistGroup', () => {
  it('projects tickers[].symbol into a source group with label + asOf', async () => {
    store.doc = {
      tickers: [{ symbol: 'XOM' }, { symbol: 'CVX' }, { symbol: 'COP' }],
      updatedAt: '2026-07-05T18:30:00Z',
    };
    const g = await readWatchlistGroup('wl1');
    expect(g.symbols).toEqual(['XOM', 'CVX', 'COP']);
    expect(g.label).toBe('My watchlist');
    expect(g.asOf).toBe(Date.UTC(2026, 6, 5, 18, 30));
  });

  it('takes the FIRST 10 in doc order when a watchlist exceeds the cap', async () => {
    store.doc = { tickers: Array.from({ length: 13 }, (_, i) => ({ symbol: `EQ${i}` })) };
    const g = await readWatchlistGroup('wl1');
    expect(g.symbols).toHaveLength(10);
    expect(g.symbols[0]).toBe('EQ0');
    expect(g.symbols[9]).toBe('EQ9');
    expect(g.truncatedFrom).toBe(13);
  });

  it('filters crypto with exclusion metadata (never silent)', async () => {
    store.doc = { tickers: [{ symbol: 'XOM' }, { symbol: 'BTC' }, { symbol: 'CVX' }] };
    const g = await readWatchlistGroup('wl1');
    expect(g.symbols).toEqual(['XOM', 'CVX']);
    expect(g.excludedCrypto).toEqual(['BTC']);
  });

  it('returns null on an absent doc, an all-crypto/empty list, or a null id', async () => {
    store.doc = undefined; // !exists()
    expect(await readWatchlistGroup('wl1')).toBeNull();

    store.doc = { tickers: [{ symbol: 'BTC' }] };
    expect(await readWatchlistGroup('wl1')).toBeNull();

    store.doc = { tickers: [{ symbol: 'XOM' }] };
    const before = store.getDocCalls;
    expect(await readWatchlistGroup(null)).toBeNull(); // no id → no read
    expect(store.getDocCalls).toBe(before);
  });
});
