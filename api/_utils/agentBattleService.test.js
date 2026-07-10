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

// ============================================================
// Release 2 PR-a (fenced site 1) — the additive customization-snapshot keys
// ============================================================

describe('createAgentBattle — Release 2 customization snapshot (additive keys)', () => {
  const CREATE_ARGS = [{}, {}, { duration: '1d' }];

  it('a config-less agent stamps the enumerated additive defaults and NOTHING else changes (off-state invariant)', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData(), ...CREATE_ARGS);
    const ctx = db.added[0].agentContext;
    // The enumerated additive keys (spec Build Rule 4)…
    expect(ctx.standingLeans).toEqual([]);
    expect(ctx.standingLeansInvalidated).toEqual([]);
    expect(ctx.dials).toBeNull();
    expect(ctx.settingsRev).toBe(0);
    // …and the pre-Release-2 sibling subtrees are untouched (deep-equal
    // against a doc built from the same fixture with the new keys stripped).
    const db2 = makeFakeDb();
    await createAgentBattle(db2, makeAgentData(), ...CREATE_ARGS);
    const strip = (doc) => {
      const clone = JSON.parse(JSON.stringify(doc, (k, v) => (v === undefined ? null : v)));
      delete clone.agentContext.standingLeans;
      delete clone.agentContext.standingLeansInvalidated;
      delete clone.agentContext.dials;
      delete clone.agentContext.settingsRev;
      delete clone.createdAt; delete clone.startTime; delete clone.endTime; delete clone.activatedAt; delete clone.updatedAt; // wall-clock
      delete clone.timing;
      delete clone.agentContext.equippedWatchlist; // carries snapshotAt wall-clock
      return clone;
    };
    expect(strip(db.added[0])).toEqual(strip(db2.added[0]));
  });

  it('revalidated leans enter the snapshot with CURRENT text; invalid pins go to the durable record instead', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData({
      standingLeans: [
        { adjustmentId: 'TF-02', version: 1, equippedAt: 't1' }, // momentum_chaser ✓
        { adjustmentId: 'CP-04', version: 1, equippedAt: 't2' }, // cross-archetype ✗
        { adjustmentId: 'TF-05', version: 99, equippedAt: 't3' }, // stale version ✗
      ],
      settingsRev: 7,
    }), ...CREATE_ARGS);
    const ctx = db.added[0].agentContext;
    expect(ctx.standingLeans).toEqual([
      { adjustmentId: 'TF-02', version: 1, text: 'Require stronger confirmation before entering' },
    ]);
    expect(ctx.standingLeansInvalidated).toEqual([
      { adjustmentId: 'CP-04', version: 1, reason: 'not_in_menu' },
      { adjustmentId: 'TF-05', version: 99, reason: 'deprecated_version' },
    ]);
    expect(ctx.settingsRev).toBe(7);
  });

  it('dials stamp only when the user set one (absent stays absent → clamp selectionSource stays honest)', async () => {
    const db = makeFakeDb();
    await createAgentBattle(db, makeAgentData({ dials: { tempo: 'aggressive' } }), ...CREATE_ARGS);
    expect(db.added[0].agentContext.dials).toEqual({ tempo: 'aggressive' });

    const db2 = makeFakeDb();
    await createAgentBattle(db2, makeAgentData({ dials: {} }), ...CREATE_ARGS);
    expect(db2.added[0].agentContext.dials).toBeNull();
  });
});
