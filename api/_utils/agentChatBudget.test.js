// api/_utils/agentChatBudget.test.js
//
// The League arena per-day question budget: the pure key builder, the plain read,
// and the transactional charge (double-spend guard, cap, new-dayN fresh pocket).
// Mirrors the tournamentBanking.test.js makeDb() runTransaction-fake idiom.

import { describe, it, expect } from 'vitest';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import {
  AGENT_CHAT_BUDGET_COLLECTION,
  AGENT_CHAT_DAILY_LIMIT,
  agentChatBudgetDocId,
  resolveBudgetDay,
  readAgentChatBudget,
  chargeAgentChatBudget,
} from './agentChatBudget.js';

// An in-memory Firestore fake: a docId → data store, a plain doc().get(), and a
// runTransaction that hands a tx with get()/set({merge}) — capturing writes.
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const captured = { sets: [] };
  const makeRef = (docId) => ({
    id: docId,
    get: async () => {
      const data = store.get(docId);
      return { exists: data !== undefined, data: () => data };
    },
  });
  const db = {
    collection: (name) => {
      expect(name).toBe(AGENT_CHAT_BUDGET_COLLECTION); // the counter lives ONLY here
      return { doc: (docId) => makeRef(docId) };
    },
    runTransaction: async (fn) => fn({
      get: async (ref) => {
        const data = store.get(ref.id);
        return { exists: data !== undefined, data: () => data };
      },
      set: (ref, data, opts) => {
        captured.sets.push({ id: ref.id, data, opts });
        const prev = opts?.merge ? (store.get(ref.id) || {}) : {};
        store.set(ref.id, { ...prev, ...data });
      },
    }),
  };
  return { db, store, captured };
}

const KEY = agentChatBudgetDocId('g1', 'u1', 2); // 'g1_u1_2'

// A group-doc-only fake for resolveBudgetDay (which reads tournamentGroups + derives
// the day via the real deriveCurrentTradingDay/formatEtDate).
function makeGroupDb({ group = null, throwOnRead = false } = {}) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => {
          if (throwOnRead) throw new Error('group read failed');
          return { exists: group !== null, data: () => group };
        },
      }),
    }),
  };
}

describe('resolveBudgetDay (group read + game-day derivation — the shared key)', () => {
  const TOURNEY = { gameMode: TOURNAMENT_GAME_MODE, groupId: 'g1' };

  it('null for a missing battle / non-tournament / no groupId (not keyable)', async () => {
    expect(await resolveBudgetDay(makeGroupDb(), null)).toBeNull();
    expect(await resolveBudgetDay(makeGroupDb(), { gameMode: 'standard', groupId: 'g1' })).toBeNull();
    expect(await resolveBudgetDay(makeGroupDb(), { gameMode: TOURNAMENT_GAME_MODE })).toBeNull();
  });

  it('null when the group doc is missing (fail-open, no placeholder day)', async () => {
    expect(await resolveBudgetDay(makeGroupDb({ group: null }), TOURNEY)).toBeNull();
  });

  it('null when the group read THROWS (fail-open — the founder-required path)', async () => {
    expect(await resolveBudgetDay(makeGroupDb({ throwOnRead: true }), TOURNEY)).toBeNull();
  });

  it('resolves { groupId, dayN } for a healthy tournament battle (dayN 1 pre-banking)', async () => {
    const key = await resolveBudgetDay(makeGroupDb({ group: { dailyScores: {} } }), TOURNEY);
    expect(key).toEqual({ groupId: 'g1', dayN: 1 });
  });
});

describe('agentChatBudgetDocId', () => {
  it('is the flat groupId_uid_dayN composite key', () => {
    expect(agentChatBudgetDocId('g1', 'u1', 2)).toBe('g1_u1_2');
  });
  it('a new dayN yields a DIFFERENT key (the implicit daily reset)', () => {
    expect(agentChatBudgetDocId('g1', 'u1', 3)).not.toBe(agentChatBudgetDocId('g1', 'u1', 2));
  });
});

describe('readAgentChatBudget (plain read — the early gate / on-open counter)', () => {
  it('a missing doc reads as 0 spent, full remaining', async () => {
    const { db } = makeDb();
    const r = await readAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ count: 0, remaining: AGENT_CHAT_DAILY_LIMIT });
  });

  it('reflects a partial spend', async () => {
    const { db } = makeDb({ [KEY]: { count: 3 } });
    const r = await readAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ count: 3, remaining: 7 });
  });

  it('at the cap reports remaining 0 (the exhausted gate condition)', async () => {
    const { db } = makeDb({ [KEY]: { count: 10 } });
    const r = await readAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ count: 10, remaining: 0 });
  });

  it('a poisoned/negative count degrades to 0 spent (never locks the user out)', async () => {
    const { db } = makeDb({ [KEY]: { count: -5 } });
    const r = await readAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r.remaining).toBe(AGENT_CHAT_DAILY_LIMIT);
  });
});

describe('chargeAgentChatBudget (transactional charge — after a successful answer)', () => {
  it('the first charge of the day: missing doc → count 1, remaining 9', async () => {
    const { db, store } = makeDb();
    const r = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ charged: true, remaining: 9, count: 1 });
    expect(store.get(KEY).count).toBe(1);
  });

  it('the 10th question (at 9) charges to 10, remaining 0', async () => {
    const { db, store } = makeDb({ [KEY]: { count: 9 } });
    const r = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ charged: true, remaining: 0, count: 10 });
    expect(store.get(KEY).count).toBe(10);
  });

  it('at the cap does NOT charge and reports remaining 0 (soft cap, no over-charge)', async () => {
    const { db, store, captured } = makeDb({ [KEY]: { count: 10 } });
    const r = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(r).toEqual({ charged: false, remaining: 0, count: 10 });
    expect(store.get(KEY).count).toBe(10); // unchanged
    expect(captured.sets).toHaveLength(0); // no write past the cap
  });

  it('writes an explicit count+1 (not a blind increment) so the in-tx cap is authoritative', async () => {
    const { db, captured } = makeDb({ [KEY]: { count: 4 } });
    await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(captured.sets).toHaveLength(1);
    expect(captured.sets[0].data.count).toBe(5); // a concrete number, never { __op: 'increment' }
    expect(captured.sets[0].opts).toEqual({ merge: true });
    expect(captured.sets[0].data).toMatchObject({ groupId: 'g1', uid: 'u1', dayN: 2 });
  });

  it('double-spend guard: two sequential charges from 9 stop at the cap (never 11)', async () => {
    const { db, store } = makeDb({ [KEY]: { count: 9 } });
    const first = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    const second = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 2 });
    expect(first).toMatchObject({ charged: true, remaining: 0 });
    expect(second).toMatchObject({ charged: false, remaining: 0 });
    expect(store.get(KEY).count).toBe(10); // capped, not 11
  });

  it('a new game-day (dayN) charges a FRESH pocket — the implicit reset', async () => {
    const { db, store } = makeDb({ [KEY]: { count: 10 } }); // day 2 spent out
    const r = await chargeAgentChatBudget(db, { groupId: 'g1', uid: 'u1', dayN: 3 });
    expect(r).toEqual({ charged: true, remaining: 9, count: 1 });
    expect(store.get('g1_u1_3').count).toBe(1); // new key, fresh 10
    expect(store.get(KEY).count).toBe(10);       // day 2 untouched
  });
});
