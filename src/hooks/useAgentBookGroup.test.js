/**
 * useAgentBookGroup — reader unit suite (V2 Build 6). Mocked-Firestore getDoc;
 * exercises readAgentBookGroup directly (no renderHook). Asserts the fence-clean
 * projection: SYMBOLS ONLY from portfolio.{star,core,support}, slot-order
 * truncation (star before support), crypto exclusion via the Lab's own isCrypto,
 * and null on absent / empty book.
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

import { readAgentBookGroup } from './useAgentBookGroup';

beforeEach(() => {
  store.doc = undefined;
  store.getDocCalls = 0;
});

describe('readAgentBookGroup', () => {
  it('flattens star→core→support into symbols with the agent-name label', async () => {
    store.doc = {
      portfolio: {
        star: [{ symbol: 'NVDA' }],
        core: [{ symbol: 'MSFT' }, { symbol: 'AAPL' }],
        support: [{ symbol: 'AMD' }],
      },
      updatedAt: '2026-07-05T18:30:00Z',
    };
    const g = await readAgentBookGroup('b1', 'Viper');
    expect(g.symbols).toEqual(['NVDA', 'MSFT', 'AAPL', 'AMD']);
    expect(g.label).toBe("Viper's book");
    expect(g.agentName).toBe('Viper');
    expect(g.asOf).toBe(Date.UTC(2026, 6, 5, 18, 30));
  });

  it('truncates in slot order — star survives, tail support is dropped', async () => {
    store.doc = {
      portfolio: {
        star: [{ symbol: 'STAR' }],
        core: Array.from({ length: 9 }, (_, i) => ({ symbol: `CORE${i}` })),
        support: [{ symbol: 'DROPME' }],
      },
    };
    const g = await readAgentBookGroup('b1', 'Viper');
    expect(g.symbols).toHaveLength(10);
    expect(g.symbols[0]).toBe('STAR');
    expect(g.symbols).not.toContain('DROPME');
    expect(g.truncatedFrom).toBe(11);
  });

  it('excludes crypto by the Lab\'s own classifier, never the doc flag', async () => {
    store.doc = {
      portfolio: {
        star: [{ symbol: 'NVDA' }],
        core: [],
        // support[2] carries crypto in the real shape; the doc flag is ignored.
        // BNB is a valid agent crypto pick that stockHelpers.isCrypto omits — it
        // must still be excluded (crypto-pool union), or it would leak as equity.
        support: [{ symbol: 'BTC', isCrypto: false }, { symbol: 'BNB', isCrypto: false }],
      },
    };
    const g = await readAgentBookGroup('b1', 'Viper');
    expect(g.symbols).toEqual(['NVDA']);
    expect(g.excludedCrypto).toEqual(['BTC', 'BNB']);
  });

  it('returns null on an absent doc, an empty/missing portfolio, or a null id', async () => {
    store.doc = undefined;
    expect(await readAgentBookGroup('b1', 'Viper')).toBeNull();

    store.doc = { portfolio: {} };
    expect(await readAgentBookGroup('b1', 'Viper')).toBeNull();

    store.doc = { portfolio: { star: [{ symbol: 'NVDA' }] } };
    const before = store.getDocCalls;
    expect(await readAgentBookGroup(null, 'Viper')).toBeNull();
    expect(store.getDocCalls).toBe(before);
  });

  it('falls back to "Agent" when no name is available', async () => {
    store.doc = { portfolio: { star: [{ symbol: 'NVDA' }] } };
    const g = await readAgentBookGroup('b1', null);
    expect(g.label).toBe("Agent's book");
    expect(g.agentName).toBe('Agent');
  });
});
