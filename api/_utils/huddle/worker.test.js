// api/_utils/huddle/worker.test.js
//
// Huddle S1 — the worker's reconcile pass (spec V1.1 §6.5; Amendments A §A6, §A9, B §B3), on injected I/O and an
// in-memory query. Review L1-3: the pass walked the rows in document-id order and stopped at its budget, and nothing
// cleared a row's reconcile flag, so the same leading players took the budget every tick and the tail was never retired
// at the close. Now: least recently reconciled first, every visit stamped, a settled day leaves the set.
// Amendment E §E7: every stage keeps to the cohort (HUDDLE_PLAYER_UIDS, fail closed); the rows below pass theirs.

import { describe, it, expect } from 'vitest';
import { runReconcilePass, runEnqueueStage, drainQueue, runWorkerInvocation, startReached, HUDDLE_START_ET } from './worker.js';
import { sessionOf } from './records.js';
import { rowsToReconcile } from './queue.js';

const ET = '2026-11-09';
function memoryQueue(rows) {
  const q = { where: () => q, get: async () => ({ docs: rows.filter((r) => r.reconcile === true).map((r) => ({ data: () => ({ ...r }) })) }) };
  return { collection: () => q };
}

describe('rowsToReconcile', () => {
  it('least recently reconciled first; a row never visited before any visited one', async () => {
    const db = memoryQueue([
      { uid: 'a', etDate: ET, reconcile: true, reconciledAt: '2026-11-09T15:02:00.000Z' },
      { uid: 'b', etDate: ET, reconcile: true },
      { uid: 'c', etDate: ET, reconcile: true, reconciledAt: '2026-11-09T15:00:00.000Z' },
      { uid: 'd', etDate: ET, reconcile: false },
    ]);
    expect((await rowsToReconcile(db, { etDate: ET })).map((r) => r.uid)).toEqual(['b', 'c', 'a']);
  });
});

describe('runReconcilePass (review L1-3)', () => {
  // A store of rows the injected I/O reads and stamps, and a clock each visit advances by `costMs`.
  function harness(n, { costMs = 400, settledAfterMs = Infinity } = {}) {
    const rows = Array.from({ length: n }, (_, i) => ({ uid: `u${String(i).padStart(2, '0')}`, etDate: ET, reconcile: true }));
    let now = Date.parse('2026-11-09T19:00:00Z');
    const visits = [];
    const deps = {
      rowsToReconcile: async () => rows.filter((r) => r.reconcile).sort((a, b) => String(a.reconciledAt ?? '').localeCompare(String(b.reconciledAt ?? '')) || (a.uid < b.uid ? -1 : 1)),
      reconcileHuddle: async (db, { uid, nowMs }) => { visits.push(uid); now += costMs; return { outcome: 'reconciled', settled: nowMs >= settledAfterMs }; },
      markReconciled: async (db, { uid, settled, nowMs }) => { const r = rows.find((x) => x.uid === uid); r.reconciledAt = new Date(nowMs).toISOString(); if (settled) r.reconcile = false; },
    };
    return { rows, visits, deps, cohort: new Set(rows.map((r) => r.uid)), clock: () => now, tick: (ms) => { now += ms; } };
  }

  it('a pass that runs out of budget resumes on the next tick where it stopped — every row is visited within two ticks', async () => {
    const h = harness(40);
    const first = await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps, cohort: h.cohort });
    expect(first.visited).toBeLessThan(40);
    const seenFirst = new Set(h.visits);
    h.tick(120_000);
    await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps, cohort: h.cohort });
    const seenSecond = h.visits.slice(seenFirst.size);
    expect(seenSecond[0]).not.toBe('u00');
    expect(new Set([...seenFirst, ...seenSecond]).size).toBe(40);
  });

  it('a settled day leaves the set: after the close the passes empty it', async () => {
    const h = harness(40, { settledAfterMs: Date.parse('2026-11-09T21:00:00Z') });
    h.tick(2 * 3_600_000); // past the close
    for (let i = 0; i < 3; i += 1) { await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps, cohort: h.cohort }); h.tick(120_000); }
    expect(h.rows.filter((r) => r.reconcile)).toEqual([]);
  });

  it('a stamp that fails does not stop the pass', async () => {
    const h = harness(3, { costMs: 1 });
    h.deps.markReconciled = async () => { throw new Error('contention'); };
    const r = await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps, cohort: h.cohort });
    expect(r.visited).toBe(3);
  });
});

describe('the enqueue stage and the drain (review L2-7, L2-8)', () => {
  it('no enqueue on a weekday holiday: nothing is built, counted or written', async () => {
    const calls = [];
    const deps = { buildSharedLayer: async () => { calls.push('shared'); return {}; }, enumerateActivePlayers: async () => { calls.push('players'); return { uids: [] }; } };
    expect(await runEnqueueStage(null, { etDate: '2026-11-26', deps })).toEqual({ enqueued: 0, created: 0, skipped: 'not_a_trading_day' });
    expect(calls).toEqual([]);
  });

  it('no job starts once the session has closed', async () => {
    const session = sessionOf('2026-11-09');
    const io = { selectClaimable: async () => { throw new Error('should not be asked'); } };
    const out = await drainQueue(null, { etDate: '2026-11-09', session, shared: null, invocationStartMs: session.closeMs + 60_000, clock: () => session.closeMs + 60_000, io });
    expect(out.started).toBe(0);
  });

  it('a claim that throws is that row\'s outcome: the drain neither rejects nor abandons the other lanes', async () => {
    const session = sessionOf('2026-11-09');
    const at = session.openMs - 3_600_000;
    const io = {
      selectClaimable: async () => ['u1', 'u2', 'u3'].map((uid) => ({ uid })),
      claimRow: async (db, { uid }) => { if (uid === 'u2') throw new Error('UNAVAILABLE'); return { kind: 'claimed', generation: 1, attempt: 1 }; },
    };
    const ran = [];
    const runJob = async (db, { uid }) => { ran.push(uid); return { outcome: 'published' }; };
    const out = await drainQueue(null, { etDate: '2026-11-09', session, shared: null, invocationStartMs: at, clock: () => at, runJob, io, cohort: new Set(['u1', 'u2', 'u3']) });
    expect(ran.sort()).toEqual(['u1', 'u3']);
    expect(out.results.find((r) => r.uid === 'u2')).toEqual({ uid: 'u2', outcome: 'claim_error' });
  });

  it('a reconcile query that throws does not stop the invocation', async () => {
    const at = sessionOf('2026-11-09').openMs - 3_600_000;
    // the reconcile query throws; the claimable queries answer empty; the run marker says the enqueue is done
    const query = { where: (field) => { if (field === 'reconcile') throw new Error('reconcile query failed'); return query; }, get: async () => ({ docs: [] }) };
    const db = { collection: () => ({
      where: () => query,
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ briefStage: 'done', enqueueStage: 'done', shared: null }) }) }),
    }) };
    const out = await runWorkerInvocation(db, { clock: () => at, cohort: new Set(['u1']), deps: { runJob: async () => ({ outcome: 'published' }) } });
    expect(out.reconcile).toHaveProperty('error');
    expect(out.outcome).not.toBe(undefined);
  });
});

// Amendment E §E9 — the two A §A10 items as E9 states them, on the Huddle's own path (the brief's cron entry and handler
// are untouched: `30 12 * * 1-5` is 8:30 AM ET in EDT but 7:30 AM ET in EST). A §A10, quoted: "The DST pin and the
// trading-day skip for the brief move to the flip PR with the brief-card removal".
describe('E9: no enqueue and no job claim before 8:30 AM ET, in either DST state; no huddle on a market holiday', () => {
  const EST_DAY = '2026-11-10'; // EST: 8:30 AM ET is 13:30 UTC; the brief's 12:30 UTC run is 7:30 AM ET
  const EDT_DAY = '2026-10-28'; // EDT: 8:30 AM ET is 12:30 UTC
  const utc = (day, hhmm) => Date.parse(`${day}T${hhmm}:00Z`);
  const enqueueDeps = (calls) => ({ buildSharedLayer: async () => { calls.push('shared'); return {}; }, enumerateActivePlayers: async () => { calls.push('players'); return { uids: ['u1'] }; } });
  const writeDb = { collection: () => ({ doc: () => ({ set: async () => {} }) }), batch: () => ({ set() {}, commit: async () => {} }) };

  it('the pin reads the ET wall clock: 8:30 AM ET is reached at 13:30 UTC in EST and 12:30 UTC in EDT, not a minute before', () => {
    expect(HUDDLE_START_ET).toBe('0830');
    expect(startReached(utc(EST_DAY, '12:30'), EST_DAY)).toBe(false); // 7:30 AM EST — the brief's own run
    expect(startReached(utc(EST_DAY, '13:29'), EST_DAY)).toBe(false);
    expect(startReached(utc(EST_DAY, '13:30'), EST_DAY)).toBe(true);
    expect(startReached(utc(EDT_DAY, '12:29'), EDT_DAY)).toBe(false);
    expect(startReached(utc(EDT_DAY, '12:30'), EDT_DAY)).toBe(true);
    // a later ET day has passed 8:30 of this one; an earlier one has not
    expect(startReached(utc('2026-11-11', '05:00'), EST_DAY)).toBe(true);
    expect(startReached(utc('2026-11-09', '23:00'), EST_DAY)).toBe(false);
  });

  it('EST: the brief\'s 7:30 AM ET run enqueues nothing (no vendor call, the stage left for the worker); at 8:30 AM ET it runs', async () => {
    const calls = [];
    expect(await runEnqueueStage(null, { etDate: EST_DAY, nowMs: utc(EST_DAY, '12:30'), deps: enqueueDeps(calls), cohort: new Set(['u1']) })).toEqual({ enqueued: 0, created: 0, skipped: 'before_start_et' });
    expect(calls).toEqual([]);
    await runEnqueueStage(writeDb, { etDate: EST_DAY, nowMs: utc(EST_DAY, '13:30'), deps: enqueueDeps(calls), cohort: new Set(['u1']) }).catch(() => {});
    expect(calls).toEqual(['players', 'shared']);
  });

  it('EDT: 8:29 AM ET enqueues nothing; 8:30 AM ET (the brief\'s own 12:30 UTC run) does', async () => {
    const calls = [];
    expect((await runEnqueueStage(null, { etDate: EDT_DAY, nowMs: utc(EDT_DAY, '12:29'), deps: enqueueDeps(calls), cohort: new Set(['u1']) })).skipped).toBe('before_start_et');
    await runEnqueueStage(writeDb, { etDate: EDT_DAY, nowMs: utc(EDT_DAY, '12:30'), deps: enqueueDeps(calls), cohort: new Set(['u1']) }).catch(() => {});
    expect(calls).toEqual(['players', 'shared']);
  });

  it.each([[EST_DAY, '13:29', '13:30'], [EDT_DAY, '12:29', '12:30']])('%s: the drain claims nothing at %s UTC (8:29 AM ET) and claims at %s UTC (8:30 AM ET)', async (day, before, at) => {
    const session = sessionOf(day);
    const claimed = [];
    const io = { selectClaimable: async () => [{ uid: 'u1' }], claimRow: async (db, { uid }) => { claimed.push(uid); return { kind: 'claimed', generation: 1, attempt: 1 }; } };
    const runJob = async () => ({ outcome: 'published' });
    const early = await drainQueue(null, { etDate: day, session, shared: null, invocationStartMs: utc(day, before), clock: () => utc(day, before), runJob, io, cohort: new Set(['u1']) });
    expect(early.started).toBe(0);
    expect(claimed).toEqual([]);
    const ok = await drainQueue(null, { etDate: day, session, shared: null, invocationStartMs: utc(day, at), clock: () => utc(day, at), runJob, io, cohort: new Set(['u1']) });
    expect(ok.started).toBe(1);
  });

  it('EST: the worker\'s 13:28 UTC tick (8:28 AM ET) does not recover the enqueue; its 13:30 UTC tick (8:30 AM ET) does', async () => {
    const marker = { briefStage: 'done', enqueueStage: undefined };
    const db = {
      collection: (name) => ({
        doc: () => ({ get: async () => ({ exists: true, data: () => (name === 'huddleRuns' ? { ...marker } : null) }), set: async (fields) => { Object.assign(marker, fields); } }),
        where: () => ({ where: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }),
      }),
      batch: () => ({ set() {}, commit: async () => {} }),
    };
    const deps = { enqueue: { buildSharedLayer: async () => ({}), enumerateActivePlayers: async () => ({ uids: [], counts: {}, skippedCpu: 0 }) }, runJob: async () => ({ outcome: 'published' }) };
    const early = await runWorkerInvocation(db, { clock: () => utc(EST_DAY, '13:28'), cohort: new Set(['u1']), deps });
    expect(early.outcome).toBe('not_enqueued');
    expect(marker.enqueueStage).toBeUndefined();
    const on = await runWorkerInvocation(db, { clock: () => utc(EST_DAY, '13:30'), cohort: new Set(['u1']), deps });
    expect(marker.enqueueStage).toBe('done');
    expect(on).toMatchObject({ outcome: 'drained', recovered: true });
  });

  it('a market holiday (Thanksgiving, Nov 26 2026): no enqueue at any hour and the worker exits at once', async () => {
    const calls = [];
    expect(await runEnqueueStage(null, { etDate: '2026-11-26', nowMs: utc('2026-11-26', '15:00'), deps: enqueueDeps(calls), cohort: new Set(['u1']) })).toEqual({ enqueued: 0, created: 0, skipped: 'not_a_trading_day' });
    expect(calls).toEqual([]);
    const db = { collection: () => { throw new Error('a holiday reads nothing'); } };
    expect(await runWorkerInvocation(db, { clock: () => utc('2026-11-26', '15:00'), cohort: new Set(['u1']) })).toEqual({ etDate: '2026-11-26', outcome: 'not_a_trading_day' });
  });
});

describe('the cohort (E7): every stage keeps to HUDDLE_PLAYER_UIDS', () => {
  const session = sessionOf('2026-11-09');
  const at = session.openMs - 30 * 60_000; // 9:00 AM ET

  // review HC-2: with the cohort empty (unset, blank, or passed empty) no stage reads — the filters alone ran after the queries
  it('an EMPTY cohort: the invocation, the reconcile pass and the drain return before any read', async () => {
    const db = { collection: (name) => { throw new Error(`read ${name} with no cohort`); }, runTransaction: () => { throw new Error('transaction with no cohort'); } };
    const io = { selectClaimable: async () => { throw new Error('claimable read with no cohort'); }, claimRow: async () => { throw new Error('claim with no cohort'); } };
    const deps = { rowsToReconcile: async () => { throw new Error('reconcile read with no cohort'); } };
    for (const cohort of [new Set(), undefined]) {
      const c = cohort ? { cohort } : {};
      expect(await runWorkerInvocation(db, { clock: () => at, ...c })).toEqual({ etDate: '2026-11-09', outcome: 'no_cohort' });
      expect(await runReconcilePass(db, { etDate: '2026-11-09', clock: () => at, deps, ...c })).toEqual({ visited: 0, of: 0, retired: 0 });
      expect(await drainQueue(db, { etDate: '2026-11-09', session, shared: null, invocationStartMs: at, clock: () => at, runJob: async () => { throw new Error('job with no cohort'); }, io, ...c })).toEqual({ started: 0, results: [] });
    }
  });

  it('the enqueue stage with an EMPTY cohort builds nothing, counts nothing, writes nothing', async () => {
    const calls = [];
    const deps = { buildSharedLayer: async () => { calls.push('shared'); return {}; }, enumerateActivePlayers: async () => { calls.push('players'); return { uids: ['u1'] }; } };
    for (const cohort of [new Set(), undefined]) {
      expect(await runEnqueueStage(null, { etDate: '2026-11-09', deps, ...(cohort ? { cohort } : {}) })).toEqual({ enqueued: 0, created: 0, skipped: 'no_cohort' });
    }
    expect(calls).toEqual([]);
  });

  it('a cohort with no active player: the stage is marked done with nobody enqueued, and the shared layer (its vendor call) is never built (review HC-7)', async () => {
    const calls = [];
    const marks = [];
    const deps = { buildSharedLayer: async () => { calls.push('shared'); return {}; }, enumerateActivePlayers: async () => { calls.push('players'); return { uids: [], counts: {}, skippedCpu: 0, outsideCohort: 3 }; } };
    const db = { collection: () => ({ doc: () => ({ set: async (fields) => { marks.push(fields); } }) }), batch: () => ({ set() {}, commit: async () => {} }) };
    expect(await runEnqueueStage(db, { etDate: '2026-11-09', nowMs: at, deps, cohort: new Set(['u7']) })).toEqual({ enqueued: 0, created: 0 });
    expect(calls).toEqual(['players']);
    expect(marks.at(-1)).toMatchObject({ enqueueStage: 'done', playersEnqueued: 0, shared: null });
  });

  it('the enqueue stage hands the cohort to the player enumeration', async () => {
    const seen = [];
    const deps = { buildSharedLayer: async () => ({}), enumerateActivePlayers: async (db, p) => { seen.push([...p.cohort]); return { uids: [] }; } };
    const db = { collection: () => ({ doc: () => ({ set: async () => {} }) }), batch: () => ({ set() {}, commit: async () => {} }) };
    await runEnqueueStage(db, { etDate: '2026-11-09', deps, cohort: new Set(['u7']) }).catch(() => {});
    expect(seen).toEqual([['u7']]);
  });

  it('the drain claims ONLY rows of the cohort (a row left by a removed player is never claimed)', async () => {
    const claimed = [];
    const io = {
      selectClaimable: async () => ['in1', 'out1', 'in2'].map((uid) => ({ uid })),
      claimRow: async (db, { uid }) => { claimed.push(uid); return { kind: 'claimed', generation: 1, attempt: 1 }; },
    };
    await drainQueue(null, { etDate: '2026-11-09', session, shared: null, invocationStartMs: at, clock: () => at, runJob: async () => ({ outcome: 'published' }), io, cohort: new Set(['in1', 'in2']) });
    expect(claimed.sort()).toEqual(['in1', 'in2']);
  });

  it('the drain with the default (unset) cohort claims nothing', async () => {
    const claimed = [];
    const io = { selectClaimable: async () => [{ uid: 'u1' }], claimRow: async (db, { uid }) => { claimed.push(uid); return { kind: 'claimed', generation: 1, attempt: 1 }; } };
    const before = process.env.HUDDLE_PLAYER_UIDS;
    delete process.env.HUDDLE_PLAYER_UIDS;
    try {
      await drainQueue(null, { etDate: '2026-11-09', session, shared: null, invocationStartMs: at, clock: () => at, runJob: async () => ({ outcome: 'published' }), io });
    } finally {
      if (before !== undefined) process.env.HUDDLE_PLAYER_UIDS = before;
    }
    expect(claimed).toEqual([]);
  });

  it('the reconcile pass visits ONLY rows of the cohort', async () => {
    const visited = [];
    const deps = {
      rowsToReconcile: async () => [{ uid: 'in1' }, { uid: 'out1' }, { uid: 'in2' }],
      reconcileHuddle: async (db, { uid }) => { visited.push(uid); return { outcome: 'reconciled', settled: false }; },
      markReconciled: async () => {},
    };
    const r = await runReconcilePass(null, { etDate: ET, clock: () => at, deps, cohort: new Set(['in1', 'in2']) });
    expect(visited).toEqual(['in1', 'in2']);
    expect(r.of).toBe(2);
  });
});
