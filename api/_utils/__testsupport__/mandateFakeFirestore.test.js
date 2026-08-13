// api/_utils/__testsupport__/mandateFakeFirestore.test.js
//
// Proves the transaction-faithful fake honors the exact Admin-SDK contract the
// P4 lifecycle (three revision writers) and the P3 harness debt assert against:
// optimistic-concurrency retry, emergent revision precondition, create-if-absent
// arbitration, atomicity, and faithful merge/update semantics + the query engine
// the sweeps use. A bug HERE would silently pass the whole phase, so these are
// the substrate's own mutation guards.

import { describe, it, expect } from 'vitest';
import { makeMandateFakeDb } from './mandateFakeFirestore.js';

describe('mandateFakeFirestore — merge/update semantics', () => {
  it('set({merge:true}) deep-merges nested maps, keeping siblings', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { health: { a: 1, b: 2 }, revision: 0 } });
    await db.doc('mandates/m1').set({ health: { b: 9, c: 3 } }, { merge: true });
    expect(db._get('mandates/m1')).toEqual({ health: { a: 1, b: 9, c: 3 }, revision: 0 });
  });
  it('update writes dotted leaves (keep siblings) and replaces a plain map value', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { health: { a: 1, b: 2 }, scoring: { old: true }, revision: 0 } });
    await db.doc('mandates/m1').update({ 'health.b': 9, revision: 1, scoring: { fresh: true } });
    expect(db._get('mandates/m1')).toEqual({ health: { a: 1, b: 9 }, scoring: { fresh: true }, revision: 1 });
  });
  it('every committed write bumps the doc version', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { x: 1 } });
    expect(db._versionOf('mandates/m1')).toBe(1);
    await db.doc('mandates/m1').update({ x: 2 });
    expect(db._versionOf('mandates/m1')).toBe(2);
  });
});

describe('mandateFakeFirestore — optimistic concurrency (the emergent revision precondition)', () => {
  it('a txn whose read-doc changes before commit ABORTS and re-invokes against the winner state', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { revision: 5, note: 'A' } });
    let observedRevisions = [];

    // Writer A reads revision 5; the barrier commits a rival write (rev→6) before
    // A's commit-check, so A must abort and retry, re-reading rev 6.
    db.setBarrier(async () => {
      await db.doc('mandates/m1').update({ revision: 6, note: 'B' });
    });

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.doc('mandates/m1'));
      observedRevisions.push(snap.data().revision);
      tx.update(db.doc('mandates/m1'), { revision: snap.data().revision + 1, note: 'A' });
    });

    // First attempt read 5 (barrier bumped to 6 → abort); retry read 6 → wrote 7.
    expect(observedRevisions).toEqual([5, 6]);
    expect(db._get('mandates/m1')).toEqual({ revision: 7, note: 'A' });
    expect(db._txAttempts()).toBe(2); // one abort + one success
  });

  it('two writers, revision precondition, EXACTLY ONE logical mutation per commit (no lost update)', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { revision: 0, counter: 0 } });
    const bump = () => db.runTransaction(async (tx) => {
      const s = await tx.get(db.doc('mandates/m1'));
      const d = s.data();
      tx.update(db.doc('mandates/m1'), { revision: d.revision + 1, counter: d.counter + 1 });
    });
    // Force B to commit inside A's window, so A retries over B's state.
    db.setBarrier(async () => { await bump(); });
    await bump();
    // Both increments landed exactly once — no lost update, revision advanced by 2.
    expect(db._get('mandates/m1')).toEqual({ revision: 2, counter: 2 });
  });
});

describe('mandateFakeFirestore — create-if-absent arbitration', () => {
  it('two concurrent creates of one path yield one winner + one ALREADY_EXISTS (code 6)', async () => {
    const db = makeMandateFakeDb({});
    db.setBarrier(async () => {
      await db.runTransaction(async (tx) => { tx.create(db.doc('c/x'), { who: 'B' }); });
    });
    let err = null;
    try {
      await db.runTransaction(async (tx) => {
        await tx.get(db.doc('c/x')); // A observes absent
        tx.create(db.doc('c/x'), { who: 'A' });
      });
    } catch (e) { err = e; }
    expect(err?.code).toBe(6);
    expect(db._get('c/x')).toEqual({ who: 'B' }); // B won
  });
  it('non-txn create throws ALREADY_EXISTS on an existing doc', async () => {
    const db = makeMandateFakeDb({ 'c/x': { v: 1 } });
    await expect(db.doc('c/x').create({ v: 2 })).rejects.toMatchObject({ code: 6 });
  });
});

describe('mandateFakeFirestore — update is NOT an upsert (NOT_FOUND on absent, never a silent create)', () => {
  it('non-txn update on an absent doc throws NOT_FOUND (code 5) and writes nothing', async () => {
    const db = makeMandateFakeDb({});
    await expect(db.doc('c/missing').update({ v: 1 })).rejects.toMatchObject({ code: 5 });
    expect(db._get('c/missing')).toBeUndefined(); // never fabricated
  });
  it('txn update on an absent doc aborts the WHOLE commit atomically (NOT_FOUND, no partial state)', async () => {
    const db = makeMandateFakeDb({ 'c/present': { v: 0 } });
    let err = null;
    try {
      await db.runTransaction(async (tx) => {
        tx.set(db.doc('c/present/child/ok'), { written: true }); // a sibling write in the same commit
        tx.update(db.doc('c/absent'), { v: 1 });                 // the offending update
      });
    } catch (e) { err = e; }
    expect(err?.code).toBe(5);                              // NOT_FOUND surfaced
    expect(db._get('c/absent')).toBeUndefined();            // update target never fabricated
    expect(db._get('c/present/child/ok')).toBeUndefined();  // sibling write rolled back — atomic
  });
});

describe('mandateFakeFirestore — atomicity', () => {
  it('a callback that throws mid-way commits NOTHING', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { revision: 0 } });
    await expect(db.runTransaction(async (tx) => {
      tx.update(db.doc('mandates/m1'), { revision: 1 });
      tx.set(db.doc('mandates/m1/dailyRows/2026-01-01'), { totalValue: 100 });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(db._get('mandates/m1')).toEqual({ revision: 0 }); // unchanged
    expect(db._get('mandates/m1/dailyRows/2026-01-01')).toBeUndefined(); // never written
  });
});

describe('mandateFakeFirestore — query engine (what the sweeps use)', () => {
  it('where(==) + orderBy(dotted asc) + limit, with __name__ tiebreak', async () => {
    const db = makeMandateFakeDb({
      'mandates/b': { status: 'active', health: { lastCloseAttemptAt: new Date('2026-01-02') } },
      'mandates/a': { status: 'active', health: { lastCloseAttemptAt: new Date('2026-01-02') } },
      'mandates/c': { status: 'active', health: { lastCloseAttemptAt: new Date('2026-01-01') } },
      'mandates/z': { status: 'closed', health: { lastCloseAttemptAt: new Date('2020-01-01') } },
    });
    const snap = await db.collection('mandates')
      .where('status', '==', 'active')
      .orderBy('health.lastCloseAttemptAt', 'asc')
      .orderBy('__name__', 'asc')
      .limit(10).get();
    expect(snap.docs.map((d) => d.id)).toEqual(['c', 'a', 'b']); // c oldest; a<b by name tiebreak; z excluded
  });

  it('where(<= Date) due-filter + startAfter cursor walk reaches every due doc', async () => {
    const now = new Date('2026-04-01T12:00:00Z');
    const db = makeMandateFakeDb({
      'mandates/d1': { status: 'active', nextRolloverAt: new Date('2026-01-10T21:00:00Z') },
      'mandates/d2': { status: 'active', nextRolloverAt: new Date('2026-02-10T21:00:00Z') },
      'mandates/d3': { status: 'active', nextRolloverAt: new Date('2026-03-10T21:00:00Z') },
      'mandates/future': { status: 'active', nextRolloverAt: new Date('2026-09-10T21:00:00Z') },
    });
    const page1 = await db.collection('mandates')
      .where('status', '==', 'active').where('nextRolloverAt', '<=', now)
      .orderBy('nextRolloverAt', 'asc').orderBy('__name__', 'asc').limit(2).get();
    expect(page1.docs.map((d) => d.id)).toEqual(['d1', 'd2']); // future excluded by <= filter
    const last = page1.docs[page1.docs.length - 1];
    const page2 = await db.collection('mandates')
      .where('status', '==', 'active').where('nextRolloverAt', '<=', now)
      .orderBy('nextRolloverAt', 'asc').orderBy('__name__', 'asc')
      .startAfter(last.data().nextRolloverAt, last.id).limit(2).get();
    expect(page2.docs.map((d) => d.id)).toEqual(['d3']); // cursor walked past d1,d2
  });

  it('subcollection query returns only direct children, ordered', async () => {
    const db = makeMandateFakeDb({
      'mandates/m1/dailyRows/2026-01-03': { date: '2026-01-03', totalValue: 103 },
      'mandates/m1/dailyRows/2026-01-01': { date: '2026-01-01', totalValue: 101 },
      'mandates/m1/dailyRows/2026-01-02': { date: '2026-01-02', totalValue: 102 },
      'mandates/m2/dailyRows/2026-01-01': { date: '2026-01-01', totalValue: 999 },
    });
    const snap = await db.collection('mandates/m1/dailyRows').orderBy('date', 'asc').get();
    expect(snap.docs.map((d) => d.data().totalValue)).toEqual([101, 102, 103]); // m2 excluded
  });
});
