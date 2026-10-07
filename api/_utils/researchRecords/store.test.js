// api/_utils/researchRecords/store.test.js
//
// Pilot P2 — the research record's store outside a host's transaction
// (api/_utils/researchRecords/store.js), on the optimistic Firestore double:
//   · recordTurnOutcome is AWAITED but BOUNDED (review R2-2): one attempt, a
//     deadline; past it the caller's answer stands and the write is reported
//     unconfirmed — logged, never thrown;
//   · readListResearch is ONE bounded query (R2-1 / R4-5); a record is
//     attached to a list only when its subject IS that list (R1-1 / R4-4); the
//     list's own record is read by its id when the bounded query left it out;
//   · the Forge's summaries lead with the list's own research, then analysis
//     newest first (R4-1 / R1-4); versions cite every record read.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';
import {
  recordTurnOutcome, readListResearch, researchRefsOf, researchSummariesOf, mintWithHost, safely,
  LIST_RESEARCH_READ_MAX, RESEARCH_SUMMARIES_MAX, TURN_OUTCOME_DEADLINE_MS,
} from './store.js';
import { emptyTelemetry } from './model.js';

const NOW = '2026-10-07T14:00:00.000Z';
const rec = (id, over = {}) => ({
  researchWorkId: id, userId: 'u1', origin: 'analysis', state: 'open', watchlistId: 'wl-1', createdAt: NOW,
  telemetry: emptyTelemetry(), ...over,
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('recordTurnOutcome — awaited, bounded, never thrown', () => {
  it('records the turn in ONE attempt (maxAttempts: 1)', async () => {
    const db = makeCallsFirestore({ docs: { 'researchWork/as_1': rec('as_1') } });
    const spy = vi.spyOn(db, 'runTransaction');
    const out = await recordTurnOutcome(db, { researchWorkId: 'as_1', uid: 'u1', kind: 'failure', elapsedMs: 900, atIso: NOW, label: 't' });
    expect(out).toBe('recorded');
    expect(spy.mock.calls[0][1]).toEqual({ maxAttempts: 1 });
    expect(stored(db, 'researchWork/as_1').telemetry).toMatchObject({ attempts: 1, failures: 1, elapsedMs: 900, tokens: 'unknown' });
  });
  it('a transaction that never settles → \'unconfirmed\' at the deadline (the caller answers on time); a late failure is logged, never thrown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectLate;
    const db = { collection: () => ({ doc: () => ({ path: 'researchWork/as_1' }) }), runTransaction: () => new Promise((_, rej) => { rejectLate = rej; }) };
    const started = Date.now();
    const out = await recordTurnOutcome(db, { researchWorkId: 'as_1', uid: 'u1', kind: 'failure', elapsedMs: 1, atIso: NOW, label: 't', deadlineMs: 25 });
    expect(out).toBe('unconfirmed');
    expect(Date.now() - started).toBeLessThan(1000);
    rejectLate(new Error('14 UNAVAILABLE'));
    await new Promise((r) => setTimeout(r, 0));
    expect(console.error.mock.calls.some(([m]) => /late turn-outcome write failed/.test(m))).toBe(true);
  });
  it('the default deadline is short (well inside a 30 s function after a 25 s model abort)', () => {
    expect(TURN_OUTCOME_DEADLINE_MS).toBeLessThanOrEqual(2000);
  });
  it('a throwing store → \'failed\'; a missing, foreign or malformed record → \'skipped\' — no write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = { collection: () => ({ doc: () => ({}) }), runTransaction: async () => { throw new Error('boom'); } };
    expect(await recordTurnOutcome(boom, { researchWorkId: 'as_1', uid: 'u1', kind: 'failure', atIso: NOW, label: 't' })).toBe('failed');
    const db = makeCallsFirestore({ docs: { 'researchWork/as_2': rec('as_2', { userId: 'someone-else' }) } });
    expect(await recordTurnOutcome(db, { researchWorkId: 'as_1', uid: 'u1', kind: 'failure', atIso: NOW, label: 't' })).toBe('skipped');
    expect(await recordTurnOutcome(db, { researchWorkId: 'as_2', uid: 'u1', kind: 'failure', atIso: NOW, label: 't' })).toBe('skipped');
    expect(await recordTurnOutcome(db, { researchWorkId: 'not-an-id', uid: 'u1', kind: 'failure', atIso: NOW, label: 't' })).toBe('skipped');
    expect(db.__access.writes).toEqual([]);
  });
});

describe('readListResearch — attached = the subject is this list; one bounded query', () => {
  it('the query is bounded (LIST_RESEARCH_READ_MAX) and records come back oldest first', async () => {
    const db = makeCallsFirestore({ docs: {
      'researchWork/as_b': rec('as_b', { createdAt: '2026-10-07T15:00:00.000Z' }),
      'researchWork/as_a': rec('as_a', { createdAt: '2026-10-07T16:00:00.000Z' }),
      'researchWork/ws_x': rec('ws_x', { origin: 'signaldrop', state: 'completed' }),
    } });
    const out = await readListResearch(db, { uid: 'u1', watchlistId: 'wl-1' });
    expect(out.map((r) => r.researchWorkId)).toEqual(['ws_x', 'as_b', 'as_a']);
    expect(db.__access.queries).toEqual([expect.objectContaining({ collectionPath: 'researchWork', limit: LIST_RESEARCH_READ_MAX, filters: [{ field: 'watchlistId', op: '==', value: 'wl-1' }] })]);
  });
  it('a record the list names but whose subject is ANOTHER list is not attached; another player\'s record never is', async () => {
    const db = makeCallsFirestore({ docs: {
      'researchWork/rs_1': rec('rs_1', { origin: 'screener', watchlistId: 'wl-0' }),
      'researchWork/as_9': rec('as_9', { userId: 'intruder' }),
    } });
    expect(await readListResearch(db, { uid: 'u1', watchlistId: 'wl-1', listResearchWorkId: 'rs_1' })).toEqual([]);
  });
  it('the list\'s own record is read by its id when the bounded query left it out', async () => {
    const docs = {};
    for (let i = 0; i < LIST_RESEARCH_READ_MAX; i++) docs[`researchWork/as_${String(i).padStart(4, '0')}`] = rec(`as_${String(i).padStart(4, '0')}`);
    docs['researchWork/ws_own'] = rec('ws_own', { origin: 'signaldrop', state: 'completed', createdAt: '2026-10-01T00:00:00.000Z' });
    const db = makeCallsFirestore({ docs });
    const out = await readListResearch(db, { uid: 'u1', watchlistId: 'wl-1', listResearchWorkId: 'ws_own' });
    expect(out).toHaveLength(LIST_RESEARCH_READ_MAX + 1);
    expect(out[0].researchWorkId).toBe('ws_own'); // oldest first — the list's own research leads the refs
  });
});

describe('what versions cite and what the Forge is given', () => {
  const records = [
    rec('ws_own', { origin: 'signaldrop', state: 'completed', createdAt: '2026-10-07T10:00:00.000Z' }),
    ...Array.from({ length: 25 }, (_, i) => rec(`as_${String(i).padStart(2, '0')}`, { createdAt: `2026-10-07T11:${String(i).padStart(2, '0')}:00.000Z` })),
  ];
  it('versions cite every record read, oldest first', () => {
    expect(researchRefsOf(records).map((r) => r.id)).toEqual(records.map((r) => r.researchWorkId));
    expect(researchRefsOf(records)[0]).toEqual({ kind: 'researchWork', id: 'ws_own' });
  });
  it('the Forge gets the list\'s own research first, then analysis newest first, at most RESEARCH_SUMMARIES_MAX', () => {
    const out = researchSummariesOf(records);
    expect(out).toHaveLength(RESEARCH_SUMMARIES_MAX);
    expect(out[0].researchWorkId).toBe('ws_own');
    expect(out[1].researchWorkId).toBe('as_24');
    expect(out.every((s) => 'completions' in s && !('symbols' in s) && !('telemetry' in s))).toBe(true);
  });
});

describe('mintWithHost and safely', () => {
  it('mint: host and record in one commit; a second mint of the same record writes nothing', async () => {
    const db = makeCallsFirestore();
    const hostRef = db.collection('analysisSessions').doc('s1');
    expect(await mintWithHost(db, { hostRef, hostDoc: { a: 1 }, record: rec('as_s1') })).toEqual({ researchWorkId: 'as_s1', minted: true });
    expect(await mintWithHost(db, { hostRef, hostDoc: { a: 2 }, record: rec('as_s1') })).toEqual({ researchWorkId: 'as_s1', minted: false });
    expect(stored(db, 'analysisSessions/s1')).toEqual({ a: 1 });
  });
  it('safely: a throwing build is logged and becomes null (the host writes as if there were no record)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(safely('t', () => { throw new Error('bad arithmetic'); })).toBeNull();
    expect(safely('t', () => 7)).toBe(7);
  });
});
