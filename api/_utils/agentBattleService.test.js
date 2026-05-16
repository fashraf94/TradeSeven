// api/_utils/agentBattleService.test.js
//
// Phase 5B1 — coverage for the equipped-watchlist snapshot that createAgentBattle
// writes into agentContext (V-15). createAgentBattle is otherwise pure apart
// from a single agentBattles.add() at the end, so a fake db that captures the
// added doc is enough to assert the snapshot shape.

import { describe, it, expect } from 'vitest';
import { createAgentBattle } from './agentBattleService.js';

function makeFakeDb() {
  const added = [];
  return {
    added,
    collection: () => ({
      add: async (doc) => {
        added.push(doc);
        return { id: 'battle-test-1' };
      },
    }),
  };
}

function makeAgentData(overrides = {}) {
  return {
    id: 'agent-1',
    ownerId: 'user-1',
    name: 'Viper',
    archetype: 'momentum_chaser',
    lastDecision: {
      portfolio: {
        star: [
          { symbol: 'AAPL', name: 'Apple', baseATR: 3 },
          { symbol: 'MSFT', name: 'Microsoft', baseATR: 3 },
        ],
        core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
        support: [{ symbol: 'GOOGL' }, { symbol: 'META' }, { symbol: 'BTC', isCrypto: true }],
      },
      bench: {
        stocks: [{ symbol: 'TSLA' }, { symbol: 'NFLX' }, { symbol: 'CRM' }],
        crypto: { symbol: 'ETH', isCrypto: true },
      },
      strategyBrief: 'brief',
      innerMonologue: {},
      watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
    },
    ...overrides,
  };
}

describe('createAgentBattle — equipped watchlist snapshot (V-15)', () => {
  it('snapshots options.equippedWatchlist into agentContext.equippedWatchlist with a stamped snapshotAt', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData(), {}, {}, {
      equippedWatchlist: { watchlistId: 'wl-1', name: 'AI plays', tickers: ['AAPL', 'NVDA'] },
    });

    const battle = db.added[0];
    const snap = battle.agentContext.equippedWatchlist;
    expect(snap).toBeDefined();
    expect(snap.watchlistId).toBe('wl-1');
    expect(snap.name).toBe('AI plays');
    expect(snap.tickers).toEqual(['AAPL', 'NVDA']);
    expect(typeof snap.snapshotAt).toBe('string');
  });

  it('agentContext.equippedWatchlist is null when no watchlist is equipped', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData(), {}, {}, {});
    expect(db.added[0].agentContext.equippedWatchlist).toBeNull();
  });

  it('stamps snapshotAt at battle-creation time, overriding any caller-supplied value', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData(), {}, {}, {
      equippedWatchlist: {
        watchlistId: 'wl-1',
        name: 'AI plays',
        tickers: ['AAPL'],
        snapshotAt: '1999-01-01T00:00:00.000Z',
      },
    });
    expect(db.added[0].agentContext.equippedWatchlist.snapshotAt).not.toBe(
      '1999-01-01T00:00:00.000Z'
    );
  });

  it('does not disturb the existing deployedGuardrails snapshot', async () => {
    const db = makeFakeDb();
    await createAgentBattle(
      db,
      makeAgentData({ deployedStrategy: { guardrails: [{ id: 'g1' }] } }),
      {},
      {},
      { equippedWatchlist: { watchlistId: 'wl-1', name: 'x', tickers: [] } }
    );
    expect(db.added[0].agentContext.deployedGuardrails).toEqual([{ id: 'g1' }]);
  });
});
