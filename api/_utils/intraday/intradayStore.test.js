// api/_utils/intraday/intradayStore.test.js — contract §7.1, §7.2, §7.4 and §5.3 step 4.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
import {
  acquireLease, releaseLease, recordUnits, publishSweep, serializeActionable, parseActionable,
  loadCalcState, loadActionableDocs, loadSnapshot, firestoreDocBytes,
} from './intradayStore.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T0 = 1_789_652_000_000;
const clock = (t) => () => t;

const snapshotDoc = (sweepId, symbols = { AAPL: { price: { value: 1 } } }) => ({ sweepId, sweepAt: T0, calcVersion: 1, anomalies: {}, counters: {}, symbols });
const actionable = { AAPL: { ring: { buckets: [{ key: 1 }] }, state: { segmentLen: 1 }, log: [{ sweepAt: T0 }], seedStatus: null } };

describe('§7.4 lease', () => {
  it('acquires when no lease exists, refuses (lease_busy) while another owner\'s lease is unexpired, re-acquires after expiry', async () => {
    const { db } = makeInMemoryDb();
    const a = await acquireLease(db, { owner: 'A', now: clock(T0), leaseMs: 90_000 });
    expect(a.ok).toBe(true);
    expect(a.lease).toEqual({ owner: 'A', expiresAt: T0 + 90_000, acquiredAt: T0 });
    const b = await acquireLease(db, { owner: 'B', now: clock(T0 + 10_000), leaseMs: 90_000 });
    expect(b).toMatchObject({ ok: false, reason: 'lease_busy' });
    const again = await acquireLease(db, { owner: 'A', now: clock(T0 + 20_000), leaseMs: 90_000 });
    expect(again.ok).toBe(true); // same owner may renew
    const late = await acquireLease(db, { owner: 'B', now: clock(T0 + 20_000 + 90_000), leaseMs: 90_000 });
    expect(late.ok).toBe(true);
  });
  it('`now` is evaluated per attempt (a function, never a captured instant)', async () => {
    const { db } = makeInMemoryDb();
    let calls = 0;
    await acquireLease(db, { owner: 'A', now: () => { calls += 1; return T0; }, leaseMs: 1 });
    expect(calls).toBe(1);
  });
  it('releaseLease outside the transaction is conditioned on owner === me', async () => {
    const { db } = makeInMemoryDb();
    await acquireLease(db, { owner: 'A', now: clock(T0), leaseMs: 90_000 });
    expect(await releaseLease(db, { owner: 'B' })).toEqual({ released: false });
    expect((await loadSnapshot(db)).lease.owner).toBe('A');
    expect(await releaseLease(db, { owner: 'A' })).toEqual({ released: true });
    expect((await loadSnapshot(db)).lease).toBeNull();
  });
});

describe('§7.4 atomic publication', () => {
  it('writes the snapshot, the universe state and every actionable document with ONE generation and releases the lease, in one transaction', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await acquireLease(db, { owner: 'A', now: clock(T0), leaseMs: 90_000 });
    writeLog.length = 0;
    const res = await publishSweep(db, {
      owner: 'A', now: clock(T0 + 5_000), etDate: '2026-09-17', snapshotDoc: snapshotDoc('s1'),
      universeState: { accumulators: { AAPL: { num: 1, den: 1 } } }, actionableDocs: actionable, generation: 7,
    });
    expect(res).toMatchObject({ ok: true, generation: 7, actionableWritten: 1 });
    expect(writeLog.every(([op]) => op === 'tx.set')).toBe(true);
    const snap = store.get('intradaySnapshots/latest');
    expect(snap.generation).toBe(7);
    expect(snap.lease).toBeNull();
    expect(snap.lastSuccessfulSweepAt).toBe(T0);
    expect(store.get('intradayCalcState/2026-09-17')).toMatchObject({ generation: 7, accumulators: { AAPL: { num: 1, den: 1 } } });
    const a = store.get('intradayCalcState/2026-09-17/actionable/AAPL');
    expect(a.generation).toBe(7);
    expect(typeof a.ringJson).toBe('string');
    expect(typeof a.stateJson).toBe('string');
    expect(typeof a.logJson).toBe('string');
  });
  it('aborts with nothing written when the lease was lost to another owner or expired', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    await acquireLease(db, { owner: 'A', now: clock(T0), leaseMs: 90_000 });
    // Expired before publish.
    writeLog.length = 0;
    const expired = await publishSweep(db, { owner: 'A', now: clock(T0 + 90_000), etDate: '2026-09-17', snapshotDoc: snapshotDoc('s1'), universeState: {}, actionableDocs: actionable, generation: 1 });
    expect(expired).toEqual({ ok: false, reason: 'lease_expired' });
    expect(writeLog).toEqual([]);
    expect(store.has('intradayCalcState/2026-09-17')).toBe(false);
    // Lost to B.
    await acquireLease(db, { owner: 'B', now: clock(T0 + 90_000), leaseMs: 90_000 });
    writeLog.length = 0;
    const lost = await publishSweep(db, { owner: 'A', now: clock(T0 + 91_000), etDate: '2026-09-17', snapshotDoc: snapshotDoc('s1'), universeState: {}, actionableDocs: actionable, generation: 1 });
    expect(lost).toEqual({ ok: false, reason: 'lease_lost' });
    expect(writeLog).toEqual([]);
    expect(store.get('intradaySnapshots/latest').lease.owner).toBe('B');
  });
});

describe('§5.3 step 4 — the budget counter is a read-add-write transaction (D-105: no FieldValue.increment)', () => {
  it('adds units and sweeps by reading, adding and writing', async () => {
    const { db, store, readLog, writeLog } = makeInMemoryDb();
    const a = await recordUnits(db, { etDate: '2026-09-17', units: 285, unitsBySource: { live_v2: 285 }, sweepId: 's1', now: clock(T0) });
    expect(a).toMatchObject({ unitsRequested: 285, sweeps: 1, unitsBySource: { live_v2: 285 } });
    const b = await recordUnits(db, { etDate: '2026-09-17', units: 30, unitsBySource: { live_v2: 28, live_v1_crypto: 2 }, sweepId: 's2', now: clock(T0 + 60_000) });
    expect(b).toMatchObject({ unitsRequested: 315, sweeps: 2, unitsBySource: { live_v2: 313, live_v1_crypto: 2 } });
    expect(store.get('intradayBudget/2026-09-17').unitsRequested).toBe(315);
    expect(readLog.filter(([ch, p]) => ch === 'tx.get' && p === 'intradayBudget/2026-09-17')).toHaveLength(2);
    expect(writeLog.filter(([op, p]) => op === 'tx.set' && p === 'intradayBudget/2026-09-17')).toHaveLength(2);
  });
  it('the store source contains no FieldValue and no Date.now(); no pure module reads the clock (comments stripped)', () => {
    const code = (f) => readFileSync(path.join(HERE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code('intradayStore.js')).not.toMatch(/FieldValue/);
    expect(code('intradayStore.js')).not.toMatch(/Date\.now\(/);
    for (const f of ['sweepCalc.js', 'accumulator.js', 'buckets.js', 'facts.js', 'seed.js', 'observation.js', 'stepIndicators.js']) {
      expect(code(f), `${f} must not read the clock`).not.toMatch(/Date\.now\(/);
    }
  });
});

describe('§7.1 / §7.2 shapes and strings', () => {
  it('serialize/parse round-trips ring, state, log and seedStatus; a malformed string parses to the empty shape', () => {
    const doc = { ring: { buckets: [{ key: 5, close: 1.5 }] }, state: { segmentLen: 3, sma20: null }, log: [{ sweepAt: 1, strikeKey: 'k' }], seedStatus: 'seeded' };
    const s = serializeActionable(doc, 9);
    expect(Object.keys(s)).toEqual(['ringJson', 'stateJson', 'logJson', 'generation', 'seedStatus']);
    expect(parseActionable(s)).toEqual({ ...doc, generation: 9 });
    expect(parseActionable({ ringJson: '{bad', stateJson: 'x', logJson: '[', generation: 1 })).toEqual({ ring: { buckets: [] }, state: null, log: [], seedStatus: null, generation: 1 });
    expect(parseActionable(null)).toBeNull();
  });
  it('loaders read the calc state and the actionable docs back', async () => {
    const { db } = makeInMemoryDb();
    await acquireLease(db, { owner: 'A', now: clock(T0), leaseMs: 90_000 });
    await publishSweep(db, { owner: 'A', now: clock(T0 + 1), etDate: '2026-09-17', snapshotDoc: snapshotDoc('s1'), universeState: { accumulators: { X: { num: 2 } } }, actionableDocs: actionable, generation: 3 });
    expect(await loadCalcState(db, '2026-09-17')).toEqual({ accumulators: { X: { num: 2 } }, generation: 3 });
    expect(await loadCalcState(db, '2026-09-18')).toEqual({ accumulators: {}, generation: 0 });
    const docs = await loadActionableDocs(db, '2026-09-17', ['AAPL', 'MSFT']);
    expect(Object.keys(docs)).toEqual(['AAPL']);
    expect(docs.AAPL.ring).toEqual(actionable.AAPL.ring);
  });
  it('firestoreDocBytes follows the documented accounting', () => {
    // "intradayBudget/2026-09-17" → 14+1 + 10+1 + 16 = 42; fields: etDate (6+1 + 10+1) + n (1+1 + 8) + 32
    expect(firestoreDocBytes('intradayBudget/2026-09-17', { etDate: '2026-09-17', n: 1 })).toBe(42 + 18 + 10 + 32);
  });
});
