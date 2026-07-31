// api/cron/process-pending-reflections.editorial.test.js
// Phase 2 N3 — the host tenancy rows (V1.3 D-P2-12; V1.5 R4-M5). Matrix:
//   P2-36 — editorial host isolation: runEditorialReview THROWING leaves
//           reflections and the Wire sweep untouched that tick.
//   P2-47 — the sweep floor is inviolable: a tick whose earlier tenants
//           consumed the budget DEFERS the editorial (never the sweep —
//           which runs BEFORE it by pinned order), and the editorial is
//           not called at all.
// Plus the gates: flag off → editorial never consulted; non-Sunday → same.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const reflectCalls = [];
vi.mock('../agent/reflect.js', () => ({
  generateReflection: vi.fn(async (...args) => { reflectCalls.push(args); }),
}));

const flagState = { metricsEnabled: false, writesEnabled: false, continuityEnabled: false, newslineEnabled: false, editorialEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

const sweepBehavior = { result: { replayed: 0 }, burnMs: 0 };
const sweepCalls = [];
vi.mock('../_utils/wireReplaySweep.js', () => ({
  runWireReplaySweep: vi.fn(async (db, opts) => {
    sweepCalls.push(opts);
    if (sweepBehavior.burnMs > 0) {
      // Under fake timers, advancing the system clock is how a tenant
      // "consumes" wall budget deterministically.
      vi.setSystemTime(new Date(Date.now() + sweepBehavior.burnMs));
    }
    return { ...sweepBehavior.result };
  }),
}));

const editorialBehavior = { mode: 'ok' };
const editorialCalls = [];
vi.mock('../_utils/wireEditorialRun.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runEditorialReview: vi.fn(async (db, opts) => {
      editorialCalls.push(opts);
      if (editorialBehavior.mode === 'throw') throw new Error('editorial exploded');
      return { action: 'ran', isoWeek: '2026-W31', status: 'complete', passed: true };
    }),
  };
});

const dbRef = { db: null };
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => dbRef.db,
}));

const handler = (await import('./process-pending-reflections.js')).default;

// Minimal db: the reflections query chain returning an empty snapshot.
const emptyQueryDb = () => ({
  collection: () => ({
    where: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({ get: async () => ({ empty: true, size: 0, docs: [] }) }),
        }),
      }),
    }),
  }),
});

function makeRes() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}
const cronReq = () => ({ method: 'GET', headers: { 'x-vercel-cron': '1' } });

const SUNDAY = new Date('2026-08-02T18:00:00Z');
const MONDAY = new Date('2026-08-03T18:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SUNDAY);
  dbRef.db = emptyQueryDb();
  reflectCalls.length = 0;
  sweepCalls.length = 0;
  editorialCalls.length = 0;
  sweepBehavior.result = { replayed: 0 };
  sweepBehavior.burnMs = 0;
  editorialBehavior.mode = 'ok';
  flagState.writesEnabled = false;
  flagState.editorialEnabled = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('gating', () => {
  it('flag off → the editorial tenant is never consulted and the response carries no editorial key', async () => {
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(editorialCalls).toHaveLength(0);
    expect('editorial' in res.body).toBe(false);
  });

  it('flag on but not UTC Sunday → not consulted', async () => {
    vi.setSystemTime(MONDAY);
    flagState.editorialEnabled = true;
    const res = makeRes();
    await handler(cronReq(), res);
    expect(editorialCalls).toHaveLength(0);
  });

  it('flag on + Sunday → runs LAST with the host deadline threaded', async () => {
    flagState.editorialEnabled = true;
    const res = makeRes();
    await handler(cronReq(), res);
    expect(editorialCalls).toHaveLength(1);
    expect(typeof editorialCalls[0].deadline).toBe('number');
    expect(res.body.editorial).toMatchObject({ action: 'ran', status: 'complete' });
  });
});

describe('P2-36 — editorial failure is isolated', () => {
  it('runEditorialReview throwing leaves reflections + sweep results intact and the tick returns 200', async () => {
    flagState.editorialEnabled = true;
    flagState.writesEnabled = true; // sweep tenant active
    sweepBehavior.result = { replayed: 3, exhausted: 0 };
    editorialBehavior.mode = 'throw';

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(sweepCalls).toHaveLength(1);                       // sweep ran (before editorial, pinned order)
    expect(res.body.wireSweep).toEqual({ replayed: 3, exhausted: 0 }); // …and its result survived
    expect(res.body.editorial).toMatchObject({ action: 'error' });
    expect(res.body.editorial.error).toContain('editorial exploded');
  });
});

describe('P2-47 — the sweep floor is inviolable; the editorial defers, never the sweep', () => {
  it('a tick whose sweep consumed the budget → sweep completes, editorial DEFERRED without being called', async () => {
    flagState.editorialEnabled = true;
    flagState.writesEnabled = true;
    sweepBehavior.result = { replayed: 12 };
    sweepBehavior.burnMs = 47_000; // long sweep: 50s budget − 47s < the 20s editorial floor

    const res = makeRes();
    await handler(cronReq(), res);

    expect(sweepCalls).toHaveLength(1);
    expect(res.body.wireSweep).toEqual({ replayed: 12 });     // sweep throughput untouched
    expect(editorialCalls).toHaveLength(0);                    // editorial never invoked
    expect(res.body.editorial).toMatchObject({ action: 'deferred' });
    expect(res.body.editorial.remaining).toBeLessThan(20_000);
  });

  it('order is structural: the editorial cannot starve the sweep because the sweep is already done when the editorial starts', async () => {
    flagState.editorialEnabled = true;
    flagState.writesEnabled = true;
    // Even a "long" editorial changes nothing for the sweep — it ran first.
    const res = makeRes();
    await handler(cronReq(), res);
    expect(sweepCalls).toHaveLength(1);
    expect(editorialCalls).toHaveLength(1);
    expect(res.body.wireSweep).toEqual({ replayed: 0 });
  });
});
