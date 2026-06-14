// api/_utils/tournamentRank.test.js
//
// P6a battery for the career-rank writer. Blocks: the apply path (signed
// math through the founder-signed B-2 functions, audit event shape),
// per-(player, group) idempotency (re-run = no double application), the
// CPU-farm guard live in the writer, ratchet floor permanence across
// applied weeks, the dev namespace (ruling A-4), the entry-variant used by
// the bracket sweep (ranking recomputed with the lockTopTwo tie-break), and
// the readRank empty shape.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentRank.js IS the runtime guard that its transitive import surface
// stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyGroupWeekToRanks, applyLockedGameToRanks } from './tournamentRank.js';

const NOW = new Date('2026-06-19T22:30:00.000Z');

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (the house idiom) ====================

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writeLog = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        path: `${name}/${id}`,
        get: async () => {
          const data = store.get(`${name}/${id}`);
          return { exists: data !== undefined, id, data: () => structuredClone(data) };
        },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
    }),
  };
  return { db, store, writeLog };
}

// One human + three CPUs (the padded-bracket launch shape) and a 2+2 mix.
const PADDED_SEATS = [
  { odUserId: 'founder' },
  { odUserId: 'cpu-1', isCpu: true },
  { odUserId: 'cpu-2', isCpu: true },
  { odUserId: 'cpu-3', isCpu: true },
];
const MIXED_SEATS = [
  { odUserId: 'alice' },
  { odUserId: 'bob' },
  { odUserId: 'cpu-1', isCpu: true },
  { odUserId: 'cpu-2', isCpu: true },
];

describe('applyGroupWeekToRanks', () => {
  it('applies the signed week to every seat with the full audit event', async () => {
    const { db, store } = makeDb({ 'users/alice': { username: 'Alice' } });
    const summary = await applyGroupWeekToRanks(db, {
      groupId: 'g1',
      seats: MIXED_SEATS,
      compositeByPlayer: { alice: 60, bob: -20, 'cpu-1': 10, 'cpu-2': 0 },
      ranking: ['alice', 'cpu-1', 'cpu-2', 'bob'],
      now: NOW,
    });
    expect(summary).toEqual({ applied: 4, skipped: 0, errors: 0 });

    // alice: raw 60+100=160, two CPU opponents → guard ⅓.
    const alice = store.get('tournamentRanks/alice');
    expect(alice).toMatchObject({ odUserId: 'alice', displayName: 'Alice', isCpu: false, tier: 1 });
    expect(alice.rp).toBeCloseTo(160 / 3, 2);
    expect(alice.appliedGroups.g1).toMatchObject({
      weeklyComposite: 60, placement: 1, cpuOpponents: 2, raw: 160, guard: 0.33,
    });
    expect(alice.history).toHaveLength(1);

    // bob: 4th place, raw −20+0 — negative, NEVER discounted; no debt → rp 0.
    const bob = store.get('tournamentRanks/bob');
    expect(bob.appliedGroups.g1.delta).toBe(-20);
    expect(bob.rp).toBe(0);

    // CPUs accrue too, marked — no exclusion (the guard is the protection).
    expect(store.get('tournamentRanks/cpu-1')).toMatchObject({ isCpu: true });
    expect(store.get('tournamentRanks/cpu-1').displayName).toMatch(/^CPU/);
  });

  it('FULLY PADDED GROUPS EARN ZERO POSITIVE RP (B-2, consciously noted): the human winner nets 0', async () => {
    const { db, store } = makeDb({});
    await applyGroupWeekToRanks(db, {
      groupId: 'g1',
      seats: PADDED_SEATS,
      compositeByPlayer: { founder: 80, 'cpu-1': 10, 'cpu-2': 5, 'cpu-3': 0 },
      ranking: ['founder', 'cpu-1', 'cpu-2', 'cpu-3'],
      now: NOW,
    });
    const founder = store.get('tournamentRanks/founder');
    expect(founder.appliedGroups.g1).toMatchObject({ raw: 180, guard: 0, delta: 0 });
    expect(founder.rp).toBe(0);
  });

  it('IDEMPOTENT per (player, group): a re-run skips every seat, totals unchanged', async () => {
    const { db, store } = makeDb({});
    const args = {
      groupId: 'g1',
      seats: MIXED_SEATS,
      compositeByPlayer: { alice: 60, bob: 10, 'cpu-1': 5, 'cpu-2': 0 },
      ranking: ['alice', 'bob', 'cpu-1', 'cpu-2'],
      now: NOW,
    };
    await applyGroupWeekToRanks(db, args);
    const rpAfterFirst = store.get('tournamentRanks/alice').rp;
    const second = await applyGroupWeekToRanks(db, args);
    expect(second).toEqual({ applied: 0, skipped: 4, errors: 0 });
    expect(store.get('tournamentRanks/alice').rp).toBe(rpAfterFirst);
    expect(Object.keys(store.get('tournamentRanks/alice').appliedGroups)).toEqual(['g1']);
  });

  it('RATCHET ACROSS WEEKS: floors achieved in week N hold against week N+1 collapses', async () => {
    const { db, store } = makeDb({});
    const seats = MIXED_SEATS;
    // Week 1: alice wins big, un-CPU'd enough to cross Analyst (250).
    await applyGroupWeekToRanks(db, {
      groupId: 'g1', seats,
      compositeByPlayer: { alice: 400, bob: 10, 'cpu-1': 5, 'cpu-2': 0 },
      ranking: ['alice', 'bob', 'cpu-1', 'cpu-2'], now: NOW,
    });
    // raw 500, guard ⅓ (2 CPU opponents) → 166.67. Not enough — week 2 too.
    await applyGroupWeekToRanks(db, {
      groupId: 'g2', seats,
      compositeByPlayer: { alice: 400, bob: 10, 'cpu-1': 5, 'cpu-2': 0 },
      ranking: ['alice', 'bob', 'cpu-1', 'cpu-2'], now: NOW,
    });
    let alice = store.get('tournamentRanks/alice');
    expect(alice.tier).toBe(2); // 333.33 — Analyst achieved
    expect(alice.floorRp).toBe(250);

    // Week 3: catastrophic negative week — slides to the FLOOR, not past it.
    await applyGroupWeekToRanks(db, {
      groupId: 'g3', seats,
      compositeByPlayer: { alice: -10000, bob: 10, 'cpu-1': 5, 'cpu-2': 0 },
      ranking: ['bob', 'cpu-1', 'cpu-2', 'alice'], now: NOW,
    });
    alice = store.get('tournamentRanks/alice');
    expect(alice.rp).toBe(250);
    expect(alice.tier).toBe(2);
    expect(alice.tierName).toBe('Analyst');
    expect(alice.peakRp).toBeCloseTo(333.33, 1);
  });

  it('§7.1 CPU NON-RATCHET: a CPU crosses a tier line for display but NEVER ratchets the floor — and slides fully back', async () => {
    const { db, store } = makeDb({});
    const seats = MIXED_SEATS; // alice, bob (human) + cpu-1, cpu-2 (CPU)
    // Week 1: cpu-1 wins big (1 CPU opponent → guard ⅔): raw 500 → 333.33,
    // crossing Analyst (250). For a HUMAN this would lock floorRp 250.
    await applyGroupWeekToRanks(db, {
      groupId: 'g1', seats,
      compositeByPlayer: { 'cpu-1': 400, alice: 10, bob: 5, 'cpu-2': 0 },
      ranking: ['cpu-1', 'alice', 'bob', 'cpu-2'], now: NOW,
    });
    let cpu = store.get('tournamentRanks/cpu-1');
    expect(cpu).toMatchObject({ isCpu: true, tier: 2, tierName: 'Analyst', floorRp: 0 }); // RP shown, floor frozen
    expect(cpu.rp).toBeCloseTo(333.33, 1);

    // Week 2: catastrophic loss — no permanent floor catches a bot; it slides
    // all the way to 0 (the human ratchet would have held it at 250 — proven
    // by the RATCHET ACROSS WEEKS test above).
    await applyGroupWeekToRanks(db, {
      groupId: 'g2', seats,
      compositeByPlayer: { 'cpu-1': -10000, alice: 10, bob: 5, 'cpu-2': 0 },
      ranking: ['alice', 'bob', 'cpu-2', 'cpu-1'], now: NOW,
    });
    cpu = store.get('tournamentRanks/cpu-1');
    expect(cpu).toMatchObject({ rp: 0, tier: 1, floorRp: 0 });
  });

  it('DEV NAMESPACE (ruling A-4): dev applications land at dev-{uid}, production docs untouched', async () => {
    const { db, store } = makeDb({});
    await applyGroupWeekToRanks(db, {
      groupId: 'g1', seats: PADDED_SEATS,
      compositeByPlayer: { founder: 10, 'cpu-1': 0, 'cpu-2': 0, 'cpu-3': 0 },
      ranking: ['founder', 'cpu-1', 'cpu-2', 'cpu-3'],
      dev: true, now: NOW,
    });
    expect(store.get('tournamentRanks/dev-founder')).toBeDefined();
    expect(store.get('tournamentRanks/founder')).toBeUndefined();
  });

  it('history is capped at RANK_TUNING.HISTORY_CAP; appliedGroups keeps every key', async () => {
    const { db, store } = makeDb({});
    for (let i = 1; i <= 25; i++) {
      await applyGroupWeekToRanks(db, {
        groupId: `g${i}`, seats: MIXED_SEATS,
        compositeByPlayer: { alice: 1, bob: 0, 'cpu-1': 0, 'cpu-2': 0 },
        ranking: ['alice', 'bob', 'cpu-1', 'cpu-2'], now: NOW,
      });
    }
    const alice = store.get('tournamentRanks/alice');
    expect(alice.history).toHaveLength(20);
    expect(Object.keys(alice.appliedGroups)).toHaveLength(25);
  });
});

describe('applyLockedGameToRanks — the sweep/terminal variant (bracket entry alone)', () => {
  it('recomputes the ranking from finalScores with the seat-order tie-break and applies', async () => {
    const { db, store } = makeDb({});
    const entry = {
      bracketGameId: 'b-r1-g1',
      groupId: 'b-r1-g1',
      seats: MIXED_SEATS,
      finalScores: { alice: 10, bob: 10, 'cpu-1': 50, 'cpu-2': -5 }, // tie alice/bob → seat order
      advancers: ['cpu-1', 'alice'],
    };
    const summary = await applyLockedGameToRanks(db, { entry, now: NOW });
    expect(summary.applied).toBe(4);
    // cpu-1 first (1 CPU opponent for it: cpu-2): raw 50+100=150, guard ⅔ → 100.
    expect(store.get('tournamentRanks/cpu-1').rp).toBe(100);
    // alice 2nd by tie-break: raw 10+66=76, guard ⅓ → 25.33.
    expect(store.get('tournamentRanks/alice').appliedGroups['b-r1-g1'].placement).toBe(2);
    expect(store.get('tournamentRanks/bob').appliedGroups['b-r1-g1'].placement).toBe(3);
  });

  it('no-op on an unlocked entry', async () => {
    const { db, writeLog } = makeDb({});
    const summary = await applyLockedGameToRanks(db, {
      entry: { groupId: 'x', seats: MIXED_SEATS, finalScores: null, advancers: null },
      now: NOW,
    });
    expect(summary).toEqual({ applied: 0, skipped: 0, errors: 0 });
    expect(writeLog).toHaveLength(0);
  });
});

describe('applyLockedGameToRanks — completeness guard (code review)', () => {
  it('REFUSES an entry whose finalScores miss a seat — loud error, zero writes', async () => {
    const { db, writeLog } = makeDb({});
    const summary = await applyLockedGameToRanks(db, {
      entry: {
        bracketGameId: 'b-r1-g1',
        groupId: 'b-r1-g1',
        seats: MIXED_SEATS,
        finalScores: { alice: 10, bob: 10, 'cpu-1': 50 }, // cpu-2 missing
        advancers: ['cpu-1', 'alice'],
      },
      now: NOW,
    });
    expect(summary).toEqual({ applied: 0, skipped: 0, errors: 1 });
    expect(writeLog).toHaveLength(0);
  });
});
