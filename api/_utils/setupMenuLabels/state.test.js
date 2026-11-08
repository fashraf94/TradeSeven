// api/_utils/setupMenuLabels/state.test.js
//
// Slice 2 — the reservation protocol on the state document (spec V2 §6.3–§6.5; Correction B): one token
// per operation, transitions applied once and only under the active token, durable recovery of a
// reservation whose outcome was never saved, the due-time table, the key cap without eviction, and
// governed-session retention that only moves forward. Against an in-memory transactional store whose
// commits can be lost, re-run or refused.

import { describe, it, expect } from 'vitest';
import { makeMemoryDb } from './__fixtures__/memoryDb.js';
import {
  cancelKey, completeKey, dueAtOf, emptyState, finishRun, normalizeState, readLabelState, refusalOf, reserveKey, typedReasonOf,
} from './state.js';
import { NEXT_RUN_MS, RECOVERY_DUE_MS, STATE_MAX_KEYS, STORE_CONFIRM_AFTER_MS, CONFIRM_MARGIN_MS, IN_FLIGHT_MS } from './constants.js';

const PATH = 'setupMenuLabelState/main';
const ID = '2026-09-08__CRM__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1';
const SESSION = '2026-09-08';
const T0 = Date.parse('2026-09-09T13:00:00.000Z');
const MIN = 60_000;
const entryOf = (db, id = ID) => normalizeState(db.read(PATH)).attempts[id] ?? null;

describe('reserve: refusals write nothing, a reservation counts once', () => {
  it('a new key is reserved: n 1, the token active, in flight for the store\'s lease', async () => {
    const db = makeMemoryDb();
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 })).toEqual({ status: 'reserved', replay: false, n: 1 });
    expect(entryOf(db)).toMatchObject({ session: SESSION, n: 1, activeToken: 'tok-a', reservedAt: T0, inFlightUntil: T0 + IN_FLIGHT_MS });
  });
  it('B-1 transaction callback retry: a callback the SDK re-runs after its commit landed finds its own token — counted once', async () => {
    const db = makeMemoryDb();
    db.planTransactions('rerun');
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 })).toEqual({ status: 'reserved', replay: true, n: 1 });
    expect(entryOf(db).n).toBe(1);
  });
  it('a contended attempt that aborted is simply re-run: counted once', async () => {
    const db = makeMemoryDb();
    db.planTransactions('abort_once');
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 });
    expect(entryOf(db).n).toBe(1);
  });
  it.each([
    ['in_flight', { n: 1, activeToken: 'other', inFlightUntil: T0 + 1 }],
    ['done', { n: 1, done: true }],
    ['exhausted', { n: 3 }],
    ['not_due', { n: 1, dueAt: T0 + 1 }],
  ])('%s → refused, nothing written', async (reason, entry) => {
    const db = makeMemoryDb({ docs: { [PATH]: { ...emptyState(), attempts: { [ID]: { session: SESSION, ...entry } } } } });
    const before = db.read(PATH);
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 })).toEqual({ status: 'refused', reason });
    expect(db.read(PATH)).toEqual(before);
  });
  it('2.2 at eligibility: due at 09:31:05 → refused at 09:31:04.999, reserved at 09:31:05', async () => {
    const due = Date.parse('2026-09-09T13:31:05.000Z');
    const db = makeMemoryDb({ docs: { [PATH]: { ...emptyState(), attempts: { [ID]: { session: SESSION, n: 1, dueAt: due } } } } });
    expect((await reserveKey({ db, id: ID, session: SESSION, token: 't1', nowMs: due - 1 })).status).toBe('refused');
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 't2', nowMs: due })).toMatchObject({ status: 'reserved', n: 2 });
  });
  it('2.9 at the key cap a NEW key is refused state_full; nothing is evicted, an exhausted key stays exhausted', async () => {
    const attempts = {};
    for (let i = 0; i < STATE_MAX_KEYS; i++) attempts[`k${i}`] = { session: SESSION, n: 3 };
    const db = makeMemoryDb({ docs: { [PATH]: { ...emptyState(), attempts } } });
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 't', nowMs: T0 })).toEqual({ status: 'refused', reason: 'state_full' });
    expect(Object.keys(normalizeState(db.read(PATH)).attempts)).toHaveLength(STATE_MAX_KEYS);
    expect(await reserveKey({ db, id: 'k7', session: SESSION, token: 't', nowMs: T0 })).toEqual({ status: 'refused', reason: 'exhausted' });
  });
});

describe('outcomes: applied once, only under the active token (Correction B)', () => {
  const reserved = async (db, token = 'tok-a', nowMs = T0) => reserveKey({ db, id: ID, session: SESSION, token, nowMs });

  it('the due-time table (rows 2.4, 2.5): transient → next run; adapter-class and UNLISTED → 31 min; pending and throw → next run; final/excluded → done', () => {
    expect(dueAtOf('retryable', 'fetch_failed', T0)).toBe(T0 + NEXT_RUN_MS);
    expect(dueAtOf('retryable', 'insufficient_history', T0)).toBe(T0 + STORE_CONFIRM_AFTER_MS + CONFIRM_MARGIN_MS);
    expect(dueAtOf('retryable', 'a_reason_nobody_listed', T0)).toBe(T0 + 31 * MIN);
    expect(dueAtOf('pending', null, T0)).toBe(T0 + NEXT_RUN_MS);
    expect(dueAtOf('threw', null, T0)).toBe(T0 + NEXT_RUN_MS);
    expect(dueAtOf('final', null, T0)).toBeNull();
  });
  it('2.4 the due time follows lastAt — the instant the call RESOLVED, not when it started', async () => {
    const db = makeMemoryDb();
    await reserved(db);
    const resolvedAt = T0 + 5_000;
    await completeKey({ db, id: ID, token: 'tok-a', outcome: 'retryable', reason: 'insufficient_history', nowMs: resolvedAt });
    expect(entryOf(db)).toMatchObject({ lastAt: resolvedAt, dueAt: resolvedAt + 31 * MIN, lastOutcome: 'retryable', lastReason: 'insufficient_history', activeToken: null, lastToken: 'tok-a', inFlightUntil: null, n: 1 });
  });
  it('B-2 duplicate outcome: the second completion is already_applied and changes nothing', async () => {
    const db = makeMemoryDb();
    await reserved(db);
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'final', nowMs: T0 + 1 })).toEqual({ status: 'applied' });
    const after = db.read(PATH);
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'threw', nowMs: T0 + 9 })).toEqual({ status: 'already_applied' });
    expect(db.read(PATH)).toEqual(after);
    expect(entryOf(db)).toMatchObject({ done: true, lastOutcome: 'final' });
  });
  it('2.7 / B-3 a pending refund, repeated, decrements once', async () => {
    const db = makeMemoryDb();
    await reserved(db);
    await completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 1 });
    await completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 2 });
    expect(entryOf(db)).toMatchObject({ n: 0, lastOutcome: 'pending', dueAt: T0 + 1 + NEXT_RUN_MS });
  });
  it('2.7 a refund whose write fails leaves the reservation counted (conservative)', async () => {
    const db = makeMemoryDb();
    await reserved(db);
    db.planTransactions('fail');
    await expect(completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 1 })).rejects.toThrow();
    expect(entryOf(db)).toMatchObject({ n: 1, activeToken: 'tok-a' });
  });
  it('a completion whose acknowledgement was lost still landed once; its retry is already_applied', async () => {
    const db = makeMemoryDb();
    await reserved(db);
    db.planTransactions('lost_ack');
    await expect(completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 1 })).rejects.toThrow();
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 2 })).toEqual({ status: 'already_applied' });
    expect(entryOf(db).n).toBe(0);
  });
  it('an unknown reason is stored typed as `other`; a reason is stored only for retryable', () => {
    expect([typedReasonOf('insufficient_history'), typedReasonOf('weird thing'), typedReasonOf(null)]).toEqual(['insufficient_history', 'other', null]);
  });
});

describe('recovery: a reservation whose outcome was never saved (Correction B)', () => {
  const crashed = async () => {
    const db = makeMemoryDb();
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 }); // then the run dies: no outcome
    return db;
  };
  it('B-5 crash after reservation: in flight for 120 s, then RECOVERED once — not retryable, due 31 min after the observation, still counted', async () => {
    const db = await crashed();
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-b', nowMs: T0 + IN_FLIGHT_MS - 1 })).toEqual({ status: 'refused', reason: 'in_flight' });
    const seen = T0 + 15 * MIN;
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-b', nowMs: seen })).toEqual({ status: 'refused', reason: 'recovered' });
    expect(entryOf(db)).toMatchObject({ n: 1, activeToken: null, lastOutcome: 'unresolved', lastAt: seen, dueAt: seen + RECOVERY_DUE_MS, recoveredAt: seen });
  });
  it('B-7 / B-8 recovery without an early fetch: +30 min refused not_due (and the due time is NOT extended); +46 min reservable', async () => {
    const db = await crashed();
    const seen = T0 + 15 * MIN;
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-b', nowMs: seen });
    const recovered = db.read(PATH);
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-c', nowMs: T0 + 30 * MIN })).toEqual({ status: 'refused', reason: 'not_due' });
    expect(db.read(PATH)).toEqual(recovered);
    expect(await reserveKey({ db, id: ID, session: SESSION, token: 'tok-d', nowMs: seen + RECOVERY_DUE_MS })).toEqual({ status: 'reserved', replay: false, n: 2 });
  });
  it('B-4 the recovered token\'s late completion is stale: it cannot shorten the backoff, refund, or mark the key done', async () => {
    const db = await crashed();
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-b', nowMs: T0 + 15 * MIN });
    const recovered = db.read(PATH);
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'final', nowMs: T0 + 16 * MIN })).toEqual({ status: 'stale' });
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'pending', nowMs: T0 + 16 * MIN })).toEqual({ status: 'stale' });
    expect(await cancelKey({ db, id: ID, token: 'tok-a', nowMs: T0 + 16 * MIN })).toEqual({ status: 'stale' });
    expect(db.read(PATH)).toEqual(recovered);
  });
  it('B-4 taken over: a successor reserved after recovery; the old token\'s completion erases nothing of the successor\'s', async () => {
    const db = await crashed();
    const seen = T0 + 15 * MIN;
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-b', nowMs: seen });
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-succ', nowMs: seen + RECOVERY_DUE_MS });
    const successor = db.read(PATH);
    expect(await completeKey({ db, id: ID, token: 'tok-a', outcome: 'final', nowMs: seen + RECOVERY_DUE_MS + 1 })).toEqual({ status: 'stale' });
    expect(db.read(PATH)).toEqual(successor);
    expect(entryOf(db)).toMatchObject({ activeToken: 'tok-succ', n: 2, done: false });
  });
});

describe('cancel: no store call started (Correction B)', () => {
  it('B-9 / B-10 refunds only our active reservation, once; a lost-ack reservation is refunded by its token', async () => {
    const db = makeMemoryDb();
    db.planTransactions('lost_ack');
    await expect(reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 })).rejects.toThrow();
    expect(entryOf(db)).toMatchObject({ n: 1, activeToken: 'tok-a' }); // the commit landed
    expect(await cancelKey({ db, id: ID, token: 'tok-a', nowMs: T0 + 1 })).toEqual({ status: 'applied' });
    expect(entryOf(db)).toMatchObject({ n: 0, activeToken: null, lastToken: 'tok-a' });
    expect(await cancelKey({ db, id: ID, token: 'tok-a', nowMs: T0 + 2 })).toEqual({ status: 'already_applied' });
    expect(entryOf(db).n).toBe(0);
  });
  it('a reservation that never landed: the cancel finds nothing of ours', async () => {
    const db = makeMemoryDb();
    db.planTransactions('fail');
    await expect(reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 })).rejects.toThrow();
    expect(await cancelKey({ db, id: ID, token: 'tok-a', nowMs: T0 + 1 })).toEqual({ status: 'missing' });
  });
  it('a cancel cannot touch a later outcome\'s due time', async () => {
    const db = makeMemoryDb();
    await reserveKey({ db, id: ID, session: SESSION, token: 'tok-a', nowMs: T0 });
    await completeKey({ db, id: ID, token: 'tok-a', outcome: 'retryable', reason: 'missing_fact', nowMs: T0 + 1 });
    const after = db.read(PATH);
    expect(await cancelKey({ db, id: ID, token: 'tok-a', nowMs: T0 + 2 })).toEqual({ status: 'already_applied' });
    expect(db.read(PATH)).toEqual(after);
  });
});

describe('governed sessions only move forward (Correction B; row 2.9)', () => {
  const at = (session, n = 1) => ({ session, n });
  it('entries older than the previous governed session are pruned; the governed two stay', async () => {
    const db = makeMemoryDb({ docs: { [PATH]: { ...emptyState(), attempts: { old: at('2026-09-03'), prev: at('2026-09-04'), cur: at('2026-09-08') } } } });
    const r = await finishRun({ db, governed: { previous: '2026-09-04', current: '2026-09-08' }, ownersCursor: 'owner-1', nowMs: T0 });
    expect(r.pruned).toBe(1);
    expect(Object.keys(normalizeState(db.read(PATH)).attempts).sort()).toEqual(['cur', 'prev']);
    expect(normalizeState(db.read(PATH)).cursors.owners).toBe('owner-1');
  });
  it('B-11 overlapping rollover: an OLDER run finishing after a newer one never deletes the newer session\'s counters nor moves the sessions back', async () => {
    const db = makeMemoryDb();
    // The newer run (current 09-09) reserved its keys and finished first.
    await reserveKey({ db, id: 'new-key', session: '2026-09-09', token: 'n1', nowMs: T0 });
    await finishRun({ db, governed: { previous: '2026-09-08', current: '2026-09-09' }, ownersCursor: null, nowMs: T0 });
    // The older run (current 09-08, previous 09-04) finishes LATER.
    await finishRun({ db, governed: { previous: '2026-09-04', current: '2026-09-08' }, ownersCursor: null, nowMs: T0 + 1 });
    const s = normalizeState(db.read(PATH));
    expect(s.governedSessions).toEqual({ previous: '2026-09-08', current: '2026-09-09' });
    expect(s.attempts['new-key']).toMatchObject({ session: '2026-09-09', n: 1, activeToken: 'n1' });
  });
  it('a new session prunes the session before last, and nothing governed', async () => {
    const db = makeMemoryDb({ docs: { [PATH]: { ...emptyState(), governedSessions: { previous: '2026-09-04', current: '2026-09-08' }, attempts: { a: at('2026-09-04', 3), b: at('2026-09-08', 3) } } } });
    await finishRun({ db, governed: { previous: '2026-09-08', current: '2026-09-09' }, ownersCursor: null, nowMs: T0 });
    expect(Object.keys(normalizeState(db.read(PATH)).attempts)).toEqual(['b']);
  });
});

describe('the plain read', () => {
  it('absent → empty, read → normalised, unreadable → empty, never rejects', async () => {
    expect(await readLabelState(makeMemoryDb())).toEqual({ status: 'absent', state: emptyState() });
    const db = makeMemoryDb({ docs: { [PATH]: { schemaVersion: 1, attempts: { [ID]: { session: SESSION, n: 2, junk: 'x' } } } } });
    expect((await readLabelState(db)).state.attempts[ID]).toMatchObject({ session: SESSION, n: 2 });
    const bad = makeMemoryDb();
    bad.onGet(PATH, async () => { throw new Error('permission'); });
    expect((await readLabelState(bad)).status).toBe('unreadable');
  });
  it('refusalOf (the tenant\'s pre-filter) agrees with the transaction', () => {
    expect(refusalOf({ n: 1, activeToken: 'x', inFlightUntil: T0 - 1, done: false, dueAt: null }, { nowMs: T0 })).toBe('recover');
    expect(refusalOf(null, { nowMs: T0, isNewKey: true, keyCount: STATE_MAX_KEYS - 1 })).toBeNull();
  });
});
