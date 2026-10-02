// api/_utils/callRecords/sweep.test.js
//
// Cockpit Build 1a — THE SWEEP (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §8,
// §15.7; contract V1.4 §9 H2 as amended by Amendment B §7, §10): the global
// gate (zero reads below on), the starvation log, traversal order and the
// cursor phases, legacy row normalization, the terminal rule (completion
// untouched), the H2 cutoff with the REAL calendar (missed slot, late check,
// failed transaction, late commit, early close, DST, next-session slot,
// terminal race, check-vs-sweep race, calendar unresolvable), full-shape null
// receipts, deletion only when empty and re-read, reconciliation, heard
// repair, retirement past the lifetime, and the handler's budget.
//
// Driven against the general store double (api/_utils/__fixtures__/callsFirestore.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const flag = vi.hoisted(() => ({ mode: 'on', allow: ['owner-on'], stamps: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return flag.mode; },
  get COCKPIT_ALLOWLIST_UIDS() { return flag.allow; },
  get TICK_STAMPS_ENABLED() { return flag.stamps; },
}));

const { makeCallsFirestore, stored, storedUnder, touches, resetAccess } = await import('../__fixtures__/callsFirestore.js');
const {
  runCallSweep, sweepDeadline, normalizeSweepState, nextPhase, decideSweepExpiry, nextCheckCutoff, buildSweepReceipt, findHeardEvaluation,
  SWEEP_BRANCH_MS, SWEEP_HANDLER_CAP_MS, SWEEP_STARVATION_MS, SWEEP_PHASES, SWEEP_PAGE,
} = await import('./sweep.js');
const { runCallFlips, resetFlipIndexMemo } = await import('./flip.js');
const { createCallsContext } = await import('./mode.js');
const { makeTickBattle, makeObservation } = await import('../__fixtures__/tickStampsHarness.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z'); // Wed Sep 9 2026, 11:00 ET
const CLOSE = T('2026-09-09T20:00:00.000Z');
const SLOT = T('2026-09-09T15:15:00.000Z');
const THREAD = 'thread-call-0001';
const B1 = 'battle-on-1';
const B2 = 'battle-off-2';

const battleDoc = (id, over = {}) => ({ ...makeTickBattle({ directive: null }), id: undefined, ownerId: 'owner-on', expiresAt: '2026-09-10T00:00:00.000Z', ...over });
const call = (battleId, n, over = {}) => ({
  callId: `${battleId}:eval_001:call:${n}`, kind: 'called_shot', battleId, evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 3_600_000,
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'x',
  evidence: { tickId: null, availability: 'off', priceAsOf: null }, hypothesisRef: null, origin: 'agent_initiative',
  state: 'open', stateChangedAt: NOW - 3_600_000, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
const nextCheck = (battleId, n, slotMs, over = {}) => call(battleId, n, { horizon: { phrase: 'next_check', expiresAt: slotMs, basis: 'next_check' }, ...over });
const callSlot = (battleId, callId, over = {}) => ({
  text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: THREAD, createdAt: '2026-09-09T14:20:00.000Z',
  family: 'call', expiresAtMs: CLOSE, basis: 'this_session', callId, kind: 'call_hold', action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' },
  answerId: `${callId}:answer:hold:`, filedAt: '2026-09-09T14:20:00.000Z', textVersion: 'callActions.v1', ...over,
});
const P = (b, sub, id) => `agentBattles/${b}/${sub}/${id}`;
const Q = (b) => `callSweepQueue/${b}`;
const STATE = 'callSweepState/singleton';
const run = (db, over = {}) => runCallSweep({ db, handlerStartMs: NOW, nowMs: NOW, ...over });
const events = (db, b) => storedUnder(db, `agentBattles/${b}/callEvents`);
const receipts = (db, b) => storedUnder(db, `agentBattles/${b}/callObservations`);
const callsOf = (db, b) => storedUnder(db, `agentBattles/${b}/calls`);

function makeDb(docs) { return makeCallsFirestore({ docs }); }
/** A battle with open calls and a queue row, ready for one pass. */
function oneBattle({ battle = battleDoc(B1), calls = [call(B1, 0)], queue = { battleId: B1, nextExpiresAt: CLOSE, pendingHeard: [], updatedAt: NOW - 1 }, extra = {} } = {}) {
  return makeDb({
    [`agentBattles/${B1}`]: battle,
    ...Object.fromEntries(calls.map((c) => [P(B1, 'calls', c.callId), c])),
    ...(queue ? { [Q(B1)]: queue } : {}),
    ...extra,
  });
}

let logSpy;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  flag.mode = 'on'; flag.allow = ['owner-on']; flag.stamps = true;
  resetFlipIndexMemo();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the global gate, the budget and the cursor (spec §8, §15.1)', () => {
  it("global 'off' and 'shadow': the sweep returns BEFORE any read — zero reads, zero queries, zero writes", async () => {
    for (const mode of ['off', 'shadow']) {
      flag.mode = mode;
      const db = oneBattle();
      const res = await run(db);
      expect(res).toEqual({ skipped: mode, reads: 0 });
      expect(db.__access.reads).toEqual([]);
      expect(db.__access.queries).toEqual([]);
      expect(db.__access.writes).toEqual([]);
    }
  });

  it('the deadline is min(now + 20 s, handlerStart + 45 s); under 2 s the branch is STARVED — logged, nothing read', async () => {
    expect(sweepDeadline({ nowMs: 1_000_000, handlerStartMs: 1_000_000 })).toBe(1_000_000 + SWEEP_BRANCH_MS);
    expect(sweepDeadline({ nowMs: 1_000_000 + 30_000, handlerStartMs: 1_000_000 })).toBe(1_000_000 + SWEEP_HANDLER_CAP_MS);
    expect(SWEEP_STARVATION_MS).toBe(2_000);
    const db = oneBattle();
    const res = await run(db, { handlerStartMs: NOW - (SWEEP_HANDLER_CAP_MS - 1_500) });
    expect(res.starved).toBe(true);
    expect(res.availableMs).toBe(1_500);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes('[calls] sweep starved'))).toBe(true);
    expect(db.__access.reads).toEqual([]);
  });

  it('the cursor: phases in order with a deterministic wrap; a missing or malformed state doc starts at due', () => {
    expect(SWEEP_PHASES).toEqual(['due', 'nullOnly', 'reconcile']);
    expect(nextPhase('due')).toBe('nullOnly');
    expect(nextPhase('nullOnly')).toBe('reconcile');
    expect(nextPhase('reconcile')).toBe('due');
    expect(normalizeSweepState(null)).toEqual({ phase: 'due', lastNextExpiresAt: null, lastDocId: null });
    expect(normalizeSweepState({ phase: 'bogus', lastNextExpiresAt: 'x', lastDocId: 7 })).toEqual({ phase: 'due', lastNextExpiresAt: 'x', lastDocId: null });
    expect(normalizeSweepState({ phase: 'nullOnly', lastDocId: 'b' })).toEqual({ phase: 'nullOnly', lastNextExpiresAt: null, lastDocId: 'b' });
  });

  it("traversal: due rows by nextExpiresAt then id, then the null rows by id, then reconciliation, then the wrap — frozen (per-owner off) rows advance the cursor and are only discovered (their queue row and parent read; nothing else)", async () => {
    const db = makeDb({
      [`agentBattles/${B1}`]: battleDoc(B1),
      [`agentBattles/${B2}`]: battleDoc(B2, { ownerId: 'owner-off' }),
      [`agentBattles/battle-on-3`]: battleDoc('battle-on-3'),
      [P(B1, 'calls', `${B1}:eval_001:call:0`)]: call(B1, 0),
      [P(B2, 'calls', `${B2}:eval_001:call:0`)]: call(B2, 0, { horizon: { phrase: 'this_session', expiresAt: NOW - 1, basis: 'this_session' } }),
      [Q(B1)]: { battleId: B1, nextExpiresAt: CLOSE, pendingHeard: [], updatedAt: 1 },
      [Q(B2)]: { battleId: B2, nextExpiresAt: NOW - 1, pendingHeard: [], updatedAt: 1 },
      [Q('battle-on-3')]: { battleId: 'battle-on-3', nextExpiresAt: null, pendingHeard: [], updatedAt: 1 },
    });
    const res = await run(db);
    expect(res.rows).toBeGreaterThanOrEqual(3);
    // Discovered and skipped twice: once from its queue row (due), once from the battles page (reconcile).
    expect(res.skippedOff).toBe(2);
    // The due query in index order: B2 (earlier expiry) before B1; then the null row; then the battles page.
    const shapes = db.__access.queries.map((q) => `${q.collectionPath}:${q.filters.map((f) => `${f.field}${f.op}${f.value}`).join(',')}`);
    expect(shapes[0]).toBe('callSweepQueue:nextExpiresAt>0');
    expect(shapes.some((s) => s === 'callSweepQueue:nextExpiresAt==null')).toBe(true);
    expect(shapes.some((s) => s.startsWith('agentBattles:expiresAt>='))).toBe(true);
    const queueReads = db.__access.reads.filter((p) => p.startsWith('callSweepQueue/'));
    expect(queueReads.indexOf(Q(B2))).toBeLessThan(queueReads.indexOf(Q(B1)));
    // B2 (owner off): its queue row and parent were read; NOT its calls — and nothing of its was written.
    expect(db.__access.reads.filter((p) => p.includes(`/${B2}/calls`))).toEqual([]);
    expect(db.__access.writes.filter((w) => w.path && w.path.includes(B2))).toEqual([]);
    expect(stored(db, P(B2, 'calls', `${B2}:eval_001:call:0`)).state).toBe('open');
    // The wrap: every phase completed, the cursor is back at due with nothing consumed.
    expect(res.phaseAfter).toEqual({ phase: 'due', lastNextExpiresAt: null, lastDocId: null });
    expect(stored(db, STATE)).toMatchObject({ phase: 'due', lastNextExpiresAt: null, lastDocId: null, updatedAt: NOW });
  });

  it('the cursor RESUMES: a pass cut by the deadline persists the last row it finished; the next pass continues after it', async () => {
    const docs = {};
    for (let i = 0; i < 3; i++) {
      const b = `battle-on-${i}`;
      docs[`agentBattles/${b}`] = battleDoc(b);
      docs[P(b, 'calls', `${b}:eval_001:call:0`)] = call(b, 0);
      docs[Q(b)] = { battleId: b, nextExpiresAt: CLOSE + i, pendingHeard: [], updatedAt: 1 };
    }
    const db = makeDb(docs);
    // After the first battle's open-calls query, the clock jumps past the deadline.
    let seen = 0;
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath.endsWith('/calls') && ++seen === 1) vi.setSystemTime(new Date(NOW + SWEEP_BRANCH_MS + 1));
    };
    const first = await run(db);
    expect(first.cut).toBe(true);
    expect(first.phaseAfter).toEqual({ phase: 'due', lastNextExpiresAt: CLOSE, lastDocId: 'battle-on-0' });
    db.__hooks.afterQuery = null;
    vi.setSystemTime(new Date(NOW));
    resetAccess(db);
    const second = await run(db, { nowMs: NOW });
    const dueQuery = db.__access.queries.find((q) => q.collectionPath === 'callSweepQueue' && q.filters[0]?.op === '>');
    expect(dueQuery.startAfter).toEqual([CLOSE, 'battle-on-0']);
    expect(second.cut).toBe(false);
  });
});

describe('the terminal rule — open calls under a terminal parent end with the battle; completion itself writes nothing (Amendment B §7)', () => {
  it('ended_with_battle for every OPEN call, hit outcomes preserved, full-shape null receipts, one event per call, the queue row deleted', async () => {
    const hit = call(B1, 1, { state: 'hit', stateSource: 'check', outcome: { receiptRef: 'r', actedEvalId: 'eval_003' } });
    const db = oneBattle({ battle: battleDoc(B1, { status: 'completed' }), calls: [call(B1, 0), hit, call(B1, 2)] });
    const res = await run(db);
    expect(res.ended).toBe(2);
    const after = callsOf(db, B1);
    expect(after[`${B1}:eval_001:call:0`]).toMatchObject({ state: 'ended_with_battle', stateChangedAt: NOW, stateSource: 'sweep', outcome: { receiptRef: `agentBattles/${B1}/callObservations/${B1}:eval_001:call:0` } });
    expect(after[`${B1}:eval_001:call:1`]).toEqual(hit);
    expect(receipts(db, B1)[`${B1}:eval_001:call:0`]).toEqual({ callId: `${B1}:eval_001:call:0`, evalId: null, observedAtMs: NOW, px: null, source: 'sweep', replacedInPrompt: false, reason: 'battle_ended' });
    expect(events(db, B1)[`${B1}:eval_001:call:0:ended`]).toMatchObject({ kind: 'ended_with_battle', at: NOW, callIds: [`${B1}:eval_001:call:0`], text: 'Ended with the battle', source: 'sweep', reason: 'battle_ended' });
    expect(stored(db, Q(B1))).toBeNull();
    expect(res.deleted).toBe(1);
  });

  it('completeBattle is UNTOUCHED: the cron\'s completion transaction writes nothing to calls, receipts, events or the queue', () => {
    const src = readFileSync(resolve(HERE, '../../cron/agent-evaluate.js'), 'utf8');
    const start = src.indexOf('export async function completeBattle(');
    const end = src.indexOf('\n}\n', src.indexOf('return { committed: true', start));
    const body = src.slice(start, end);
    expect(body.length).toBeGreaterThan(2000);
    expect(body).not.toMatch(/collection\('calls'\)|callSweepQueue|callEvents|callObservations|ended_with_battle|callRecords/);
  });
});

describe('expiry by basis and the H2 cutoff with the real calendar (spec §8; contract H2)', () => {
  it('this_session / this_battle / explicit: past the deadline → expired_unresolved (past_deadline) with the sweep receipt and the expired event; before it → left open', () => {
    for (const basis of ['this_session', 'this_battle', 'explicit']) {
      const c = call(B1, 0, { horizon: { phrase: basis, expiresAt: NOW - 1, basis } });
      expect(decideSweepExpiry(c, NOW)).toEqual({ next: 'expired_unresolved', reason: 'past_deadline' });
      expect(decideSweepExpiry({ ...c, horizon: { ...c.horizon, expiresAt: NOW } }, NOW)).toEqual({ next: null, reason: 'before_deadline' }); // the exact instant is inside
    }
    expect(decideSweepExpiry(call(B1, 0, { horizon: null }), NOW)).toEqual({ next: null, reason: 'no_deadline' });
  });

  it('a this_session call past its deadline, end to end: the transition, the receipt, the event, the queue recomputed from the remaining open calls', async () => {
    const expired = call(B1, 0, { horizon: { phrase: 'this_session', expiresAt: NOW - 1, basis: 'this_session' } });
    const later = call(B1, 1, { horizon: { phrase: 'this_battle', expiresAt: CLOSE + 10, basis: 'this_battle' } });
    const db = oneBattle({ calls: [expired, later], queue: { battleId: B1, nextExpiresAt: NOW - 1, updatedAt: 1 } }); // a LEGACY row
    const res = await run(db);
    expect(res.expired).toBe(1);
    expect(callsOf(db, B1)[expired.callId]).toMatchObject({ state: 'expired_unresolved', stateSource: 'sweep' });
    expect(callsOf(db, B1)[later.callId].state).toBe('open');
    expect(receipts(db, B1)[expired.callId]).toMatchObject({ source: 'sweep', px: null, evalId: null, observedAtMs: NOW, reason: 'past_deadline' });
    expect(events(db, B1)[`${expired.callId}:expired`]).toMatchObject({ kind: 'expired', text: 'Expired — the deadline passed before a check observed it' });
    // The legacy row, normalized and recomputed: the remaining open call's expiry, pendingHeard present and empty.
    expect(stored(db, Q(B1))).toEqual({ battleId: B1, nextExpiresAt: CLOSE + 10, pendingHeard: [], updatedAt: NOW });
  });

  it("next_check: the cutoff is the close of the regular ET session containing the slot — a missed slot stays open until then (a late check may still judge); at the close it expires 'unobserved'", () => {
    const c = nextCheck(B1, 0, SLOT);
    expect(nextCheckCutoff(SLOT)).toEqual({ closeMs: CLOSE });
    expect(decideSweepExpiry(c, SLOT + 1)).toEqual({ next: null, reason: 'before_session_close' });           // the slot passed, no check reached it
    expect(decideSweepExpiry(c, CLOSE - 1)).toEqual({ next: null, reason: 'before_session_close' });          // a late check may still judge
    expect(decideSweepExpiry(c, CLOSE)).toEqual({ next: 'expired_unresolved', reason: 'unobserved' });        // the session has closed
    expect(decideSweepExpiry(c, CLOSE + 3_600_000)).toEqual({ next: 'expired_unresolved', reason: 'unobserved' });
  });

  it('early close: a Friday-after-Thanksgiving slot cuts off at 13:00 ET; a slot after that close belongs to the NEXT session (Monday)', () => {
    const halfDaySlot = T('2026-11-27T16:00:00.000Z'); // 11:00 ET on the half day
    expect(nextCheckCutoff(halfDaySlot)).toEqual({ closeMs: T('2026-11-27T18:00:00.000Z') });
    expect(decideSweepExpiry(nextCheck(B1, 0, halfDaySlot), T('2026-11-27T17:59:59.000Z'))).toMatchObject({ next: null });
    expect(decideSweepExpiry(nextCheck(B1, 0, halfDaySlot), T('2026-11-27T18:00:00.000Z'))).toMatchObject({ next: 'expired_unresolved', reason: 'unobserved' });
    const afterEarlyClose = T('2026-11-27T18:30:00.000Z');
    expect(nextCheckCutoff(afterEarlyClose)).toEqual({ closeMs: T('2026-11-30T21:00:00.000Z') }); // Monday Nov 30, EST close 16:00 ET
    expect(decideSweepExpiry(nextCheck(B1, 0, afterEarlyClose), T('2026-11-30T20:59:59.000Z'))).toMatchObject({ next: null });
    expect(decideSweepExpiry(nextCheck(B1, 0, afterEarlyClose), T('2026-11-30T21:00:00.000Z'))).toMatchObject({ next: 'expired_unresolved' });
  });

  it('DST: the close is 20:00Z under EDT (Oct 30 2026) and 21:00Z under EST (Nov 2 2026) — the calendar, never a fixed offset', () => {
    expect(nextCheckCutoff(T('2026-10-30T15:15:00.000Z'))).toEqual({ closeMs: T('2026-10-30T20:00:00.000Z') });
    expect(nextCheckCutoff(T('2026-11-02T15:15:00.000Z'))).toEqual({ closeMs: T('2026-11-02T21:00:00.000Z') });
    expect(decideSweepExpiry(nextCheck(B1, 0, T('2026-11-02T15:15:00.000Z')), T('2026-11-02T20:30:00.000Z'))).toMatchObject({ next: null }); // 15:30 ET under EST: still open
    expect(decideSweepExpiry(nextCheck(B1, 0, T('2026-11-02T15:15:00.000Z')), T('2026-11-02T21:00:00.000Z'))).toMatchObject({ next: 'expired_unresolved' });
  });

  it('a slot outside any session (a weekend) resolves to the next session; a slot the calendar cannot resolve is LEFT and logged', async () => {
    expect(nextCheckCutoff(T('2026-09-12T15:15:00.000Z'))).toEqual({ closeMs: T('2026-09-14T20:00:00.000Z') }); // Saturday → Monday's close
    expect(nextCheckCutoff(T('2030-01-07T15:15:00.000Z'))).toEqual({ reason: 'calendar_unavailable' });     // outside the maintained years
    expect(decideSweepExpiry(nextCheck(B1, 0, T('2030-01-07T15:15:00.000Z')), T('2031-01-01T00:00:00.000Z'))).toEqual({ next: null, reason: 'calendar_unresolvable' });
    const db = oneBattle({ calls: [nextCheck(B1, 0, T('2030-01-07T15:15:00.000Z'))], queue: { battleId: B1, nextExpiresAt: T('2030-01-07T15:15:00.000Z'), pendingHeard: [], updatedAt: 1 } });
    const res = await run(db);
    expect(res.calendarUnresolvable).toBe(1);
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].state).toBe('open');
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes('sweep calendar unresolvable'))).toBe(true);
    expect(stored(db, Q(B1))).toMatchObject({ nextExpiresAt: T('2030-01-07T15:15:00.000Z') }); // the row stays
  });

  it('TERMINAL RACE: the parent completes between the sweep\'s parent read and the transition — the fresh read wins: ended_with_battle, not expired', async () => {
    const db = oneBattle({ calls: [call(B1, 0, { horizon: { phrase: 'this_session', expiresAt: NOW - 1, basis: 'this_session' } })] });
    let injected = false;
    db.__hooks.afterTxBody = async ({ attempt, writes }) => {
      if (!injected && attempt === 1 && writes.some((w) => w.path.includes('/calls/'))) {
        injected = true;
        await db.doc(`agentBattles/${B1}`).update({ status: 'completed' });
      }
    };
    const res = await run(db);
    expect(res.ended).toBe(1);
    expect(res.expired).toBeUndefined();
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].state).toBe('ended_with_battle');
    expect(Object.keys(receipts(db, B1))).toHaveLength(1);
    expect(Object.keys(events(db, B1))).toEqual([`${B1}:eval_001:call:0:ended`]);
  });

  it('CHECK-VS-SWEEP RACE: a check judges the call between the sweep\'s reads and its commit — one terminal state, one receipt; the sweep skips', async () => {
    const c = nextCheck(B1, 0, SLOT);
    const db = oneBattle({ calls: [c], queue: { battleId: B1, nextExpiresAt: SLOT, pendingHeard: [], updatedAt: 1 } });
    let injected = false;
    db.__hooks.afterTxBody = async ({ attempt, writes }) => {
      if (!injected && attempt === 1 && writes.some((w) => w.path.includes('/calls/'))) {
        injected = true;
        // The check's own transition lands (a hit at its observation).
        const ctx = { ...createCallsContext({ mode: 'on', handlerStartMs: NOW }), exit: 'model_result', evalIdentity: { evalId: 'eval_009', evalSeq: 9 }, observation: makeObservation({ observedAtMs: CLOSE - 1, symbols: { AMD: { px: 170, fetchedAtMs: CLOSE - 2 } } }) };
        db.__hooks.afterTxBody = null;
        await runCallFlips(ctx, { db, battle: { ...stored(db, `agentBattles/${B1}`), id: B1 }, deadlineMs: Date.now() + 5_000, events: null });
      }
    };
    const res = await run(db, { nowMs: CLOSE, handlerStartMs: CLOSE });
    expect(callsOf(db, B1)[c.callId]).toMatchObject({ state: 'hit', stateSource: 'check' });
    expect(Object.keys(receipts(db, B1))).toHaveLength(1);
    expect(receipts(db, B1)[c.callId].source).toBe('model_prompt');
    expect(res.expired).toBeUndefined();
  });

  it('a FAILED transaction writes nothing (the call stays open, no receipt, no event); the next pass retries it', async () => {
    const db = oneBattle({ calls: [call(B1, 0, { horizon: { phrase: 'this_session', expiresAt: NOW - 1, basis: 'this_session' } })] });
    db.__hooks.beforeCommit = async ({ writes }) => { if (writes.some((w) => w.path.includes('/calls/'))) throw new Error('commit exploded'); };
    const res = await run(db);
    expect(res.failed).toBeGreaterThanOrEqual(1);
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].state).toBe('open');
    expect(receipts(db, B1)).toEqual({});
    expect(events(db, B1)).toEqual({});
    db.__hooks.beforeCommit = null;
    const again = await run(db);
    expect(again.expired).toBe(1);
  });

  it('a LATE COMMIT: a transition that outlasts its ceiling is UNCONFIRMED (never counted as failed) — it may land; the next pass finds the call already closed and skips', async () => {
    vi.useRealTimers();
    const db = oneBattle({ calls: [call(B1, 0, { horizon: { phrase: 'this_session', expiresAt: Date.now() - 1, basis: 'this_session' } })], queue: { battleId: B1, nextExpiresAt: Date.now() - 1, pendingHeard: [], updatedAt: 1 } });
    db.__hooks.beforeCommit = async ({ writes }) => { if (writes.some((w) => w.path.includes('/calls/'))) await new Promise((r) => setTimeout(r, 1_800)); };
    const res = await runCallSweep({ db, handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(res.unconfirmed).toBeGreaterThanOrEqual(1);
    expect(res.failed ?? 0).toBe(0);
    await new Promise((r) => setTimeout(r, 2_000)); // the late commit lands
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].state).toBe('expired_unresolved');
    db.__hooks.beforeCommit = null;
    const again = await runCallSweep({ db, handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(again.expired).toBeUndefined();
    expect(Object.keys(receipts(db, B1))).toHaveLength(1);
  }, 10_000);

  it('the sweep receipt is the FULL receipt shape plus reason', () => {
    expect(buildSweepReceipt(call(B1, 0), NOW, 'unobserved')).toEqual({ callId: `${B1}:eval_001:call:0`, evalId: null, observedAtMs: NOW, px: null, source: 'sweep', replacedInPrompt: false, reason: 'unobserved' });
  });
});

describe('heard repair, retirement and the queue row (spec §7, §8)', () => {
  const answered = (over = {}) => call(B1, 0, { playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: THREAD, callId: `${B1}:eval_001:call:0`, filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null }, directiveThreadId: THREAD, ...over });
  const heardEntry = (evalId, promptBuiltAt, suppressed = null) => ({ evalId, timestamp: promptBuiltAt, promptBuiltAt, decision: 'HOLD', heard: { directiveThreadId: THREAD, suppressed } });

  it('findHeardEvaluation: the EARLIEST retained unsuppressed stamp for the exact thread at or after the answer; none → null; stamps disabled → null', () => {
    const evs = [heardEntry('eval_002', '2026-09-09T14:00:00.000Z'), heardEntry('eval_003', '2026-09-09T14:30:00.000Z', 'epoch_killed'), heardEntry('eval_004', '2026-09-09T14:45:00.000Z'), heardEntry('eval_005', '2026-09-09T15:00:00.000Z')];
    expect(findHeardEvaluation(evs, { directiveThreadId: THREAD, filedAt: '2026-09-09T14:20:00.000Z' }).evalId).toBe('eval_004'); // eval_002 predates the answer; eval_003 suppressed
    expect(findHeardEvaluation(evs, { directiveThreadId: 'other', filedAt: '2026-09-09T14:20:00.000Z' })).toBeNull();
    expect(findHeardEvaluation([], { directiveThreadId: THREAD, filedAt: 'x' })).toBeNull();
    flag.stamps = false;
    expect(findHeardEvaluation(evs, { directiveThreadId: THREAD, filedAt: '2026-09-09T14:20:00.000Z' })).toBeNull();
  });

  it('repair within the retained window: heardEvalId stamped (only if null) with the heard event; the pending entry settles; the row is then deleted when nothing else remains', async () => {
    const battle = battleDoc(B1, { directive: callSlot(B1, `${B1}:eval_001:call:0`), evaluations: [heardEntry('eval_004', '2026-09-09T14:45:00.000Z')] });
    const db = oneBattle({ battle, calls: [answered({ state: 'hit', stateSource: 'check' })], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: 1 } });
    const res = await run(db);
    expect(res.heardRepaired).toBe(1);
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].playerResponse.heardEvalId).toBe('eval_004');
    expect(events(db, B1)[`${B1}:eval_001:call:0:heard:eval_004`]).toMatchObject({ kind: 'heard', text: 'Heard at the 10:45 check', evidence: { evalId: 'eval_004', promptBuiltAt: '2026-09-09T14:45:00.000Z', checkLabel: 'the 10:45 check' }, source: 'sweep' });
    expect(stored(db, Q(B1))).toBeNull();
    // A cron stamp already there: monotonic — untouched, the entry settles, no event.
    const db2 = oneBattle({ battle, calls: [answered({ state: 'hit', stateSource: 'check' }, )], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: 1 } });
    db2.__docs.set(P(B1, 'calls', `${B1}:eval_001:call:0`), { ...answered({ state: 'hit', stateSource: 'check' }), playerResponse: { ...answered().playerResponse, heardEvalId: 'eval_002' } });
    const res2 = await run(db2);
    expect(res2.heardSettled).toBe(1);
    expect(callsOf(db2, B1)[`${B1}:eval_001:call:0`].playerResponse.heardEvalId).toBe('eval_002');
    expect(events(db2, B1)).toEqual({});
  });

  it('not found: an OPEN call stays pending (the row kept); a TERMINAL call stays pending until a retained check postdates the lifetime, then "not confirmed heard" settles it — nothing written to the call; TICK_STAMPS_ENABLED false never stamps', async () => {
    const battle = battleDoc(B1, { directive: callSlot(B1, `${B1}:eval_001:call:0`), evaluations: [heardEntry('eval_002', '2026-09-09T14:00:00.000Z')] });
    const db = oneBattle({ battle, calls: [answered()], queue: { battleId: B1, nextExpiresAt: CLOSE, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: 1 } });
    const res = await run(db);
    expect(res.heardRepaired).toBeUndefined();
    expect(stored(db, Q(B1))).toEqual({ battleId: B1, nextExpiresAt: CLOSE, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: NOW });
    expect(callsOf(db, B1)[`${B1}:eval_001:call:0`].playerResponse.heardEvalId).toBeNull();
    // Terminal, lifetime over, a later retained check that could not have heard it: settled, not stamped.
    const later = battleDoc(B1, { directive: null, chatExchanges: [{ directiveThreadId: THREAD, directive: callSlot(B1, `${B1}:eval_001:call:0`) }], evaluations: [heardEntry('eval_002', '2026-09-09T14:00:00.000Z'), { evalId: 'eval_030', promptBuiltAt: '2026-09-09T20:15:00.000Z', decision: 'HOLD' }] });
    const db2 = oneBattle({ battle: later, calls: [answered({ state: 'expired_unresolved', stateSource: 'sweep' })], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: 1 } });
    const res2 = await run(db2, { nowMs: CLOSE + 3_600_000, handlerStartMs: CLOSE + 3_600_000 });
    expect(res2.heardSettled).toBe(1);
    expect(callsOf(db2, B1)[`${B1}:eval_001:call:0`].playerResponse.heardEvalId).toBeNull();
    expect(stored(db2, Q(B1))).toBeNull();
    // Stamps disabled: never, the entry stays pending.
    flag.stamps = false;
    const db3 = oneBattle({ battle: battleDoc(B1, { evaluations: [heardEntry('eval_004', '2026-09-09T14:45:00.000Z')] }), calls: [answered()], queue: { battleId: B1, nextExpiresAt: CLOSE, pendingHeard: [`${B1}:eval_001:call:0`], updatedAt: 1 } });
    await run(db3);
    expect(callsOf(db3, B1)[`${B1}:eval_001:call:0`].playerResponse.heardEvalId).toBeNull();
    expect(stored(db3, Q(B1)).pendingHeard).toEqual([`${B1}:eval_001:call:0`]);
  });

  it('a call-family slot past its lifetime is retired by compare-and-clear; one within its lifetime, an ordinary slot, or a slot replaced meanwhile is untouched', async () => {
    const over = callSlot(B1, `${B1}:eval_001:call:0`, { expiresAtMs: NOW - 1 });
    const db = oneBattle({ battle: battleDoc(B1, { directive: over }), calls: [] , queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    const res = await run(db);
    expect(res.retired).toBe(1);
    expect(stored(db, `agentBattles/${B1}`).directive).toBeNull();
    const within = oneBattle({ battle: battleDoc(B1, { directive: callSlot(B1, `${B1}:eval_001:call:0`) }), calls: [], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    await run(within);
    expect(stored(within, `agentBattles/${B1}`).directive).toEqual(callSlot(B1, `${B1}:eval_001:call:0`));
    const ordinary = { text: 'x', expiry: 'end_of_battle', directiveThreadId: 'thread-old', createdAt: 'c' };
    const ord = oneBattle({ battle: battleDoc(B1, { directive: ordinary }), calls: [], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    await run(ord);
    expect(stored(ord, `agentBattles/${B1}`).directive).toEqual(ordinary);
    // Replaced meanwhile: the fresh parent holds a newer slot → nothing cleared.
    const replaced = oneBattle({ battle: battleDoc(B1, { directive: over }), calls: [], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    replaced.__docs.get(`agentBattles/${B1}`).directive = ordinary; // the parent read by the pass had `over`? no — simulate via a hook instead:
    const r2 = oneBattle({ battle: battleDoc(B1, { directive: over }), calls: [], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    let injected = false;
    r2.__hooks.afterTxBody = async ({ attempt, writes }) => {
      if (!injected && attempt === 1 && writes.some((w) => w.path === `agentBattles/${B1}` && w.data?.directive === null)) { injected = true; await r2.doc(`agentBattles/${B1}`).update({ directive: ordinary }); }
    };
    const res2 = await run(r2);
    expect(res2.retired).toBeUndefined();
    expect(stored(r2, `agentBattles/${B1}`).directive).toEqual(ordinary);
  });

  it('the queue row is deleted ONLY when empty, inside a transaction that re-read it: work enrolled meanwhile (a pendingHeard answer, a newer expiry) survives a stale pass', async () => {
    const db = oneBattle({ calls: [], queue: { battleId: B1, nextExpiresAt: null, pendingHeard: [], updatedAt: 1 } });
    let injected = false;
    db.__hooks.afterTxBody = async ({ attempt, writes }) => {
      if (!injected && attempt === 1 && writes.some((w) => w.path === Q(B1) && w.op === 'delete')) {
        injected = true;
        // The endpoint enrolls an answer, and a publication arms a new expiry, between the pass's read and its commit.
        await db.doc(Q(B1)).set({ battleId: B1, nextExpiresAt: CLOSE + 5, pendingHeard: ['late-call'], updatedAt: NOW }, { merge: true });
      }
    };
    const res = await run(db);
    expect(res.deleted).toBeUndefined();
    expect(db.__txAttempts).toBeGreaterThanOrEqual(2);
    expect(stored(db, Q(B1))).toEqual({ battleId: B1, nextExpiresAt: CLOSE + 5, pendingHeard: ['late-call'], updatedAt: NOW });
  });

  it('an orphaned queue row (no parent) is settled away', async () => {
    const db = makeDb({ [Q('gone')]: { battleId: 'gone', nextExpiresAt: NOW - 1, updatedAt: 1 } });
    const res = await run(db);
    expect(res.deleted).toBe(1);
    expect(stored(db, Q('gone'))).toBeNull();
  });
});

describe('reconciliation — open calls lacking a queue row are enrolled (spec §8)', () => {
  it('pages the last seven days of parents by expiresAt (single-field), filters status in memory, enrolls the minimum open expiry; a present row is left; a per-owner-off or other-status parent is skipped without a calls read', async () => {
    const db = makeDb({
      [`agentBattles/${B1}`]: battleDoc(B1),
      [P(B1, 'calls', `${B1}:eval_001:call:0`)]: call(B1, 0, { horizon: { phrase: 'this_session', expiresAt: CLOSE + 7, basis: 'this_session' } }),
      [P(B1, 'calls', `${B1}:eval_001:call:1`)]: call(B1, 1, { horizon: { phrase: 'this_battle', expiresAt: CLOSE + 3, basis: 'this_battle' } }),
      [`agentBattles/${B2}`]: battleDoc(B2, { ownerId: 'owner-off' }),
      [P(B2, 'calls', `${B2}:eval_001:call:0`)]: call(B2, 0),
      ['agentBattles/battle-gc']: battleDoc('battle-gc', { status: 'expired' }),
      [P('battle-gc', 'calls', 'battle-gc:eval_001:call:0')]: call('battle-gc', 0),
      ['agentBattles/battle-old']: battleDoc('battle-old', { expiresAt: '2026-08-01T00:00:00.000Z' }),
      [P('battle-old', 'calls', 'battle-old:eval_001:call:0')]: call('battle-old', 0),
      ['agentBattles/battle-queued']: battleDoc('battle-queued'),
      [P('battle-queued', 'calls', 'battle-queued:eval_001:call:0')]: call('battle-queued', 0),
      [Q('battle-queued')]: { battleId: 'battle-queued', nextExpiresAt: CLOSE, pendingHeard: [], updatedAt: 1 },
    });
    const res = await run(db);
    expect(res.enrolled).toBe(1);
    expect(stored(db, Q(B1))).toEqual({ battleId: B1, nextExpiresAt: CLOSE + 3, pendingHeard: [], updatedAt: NOW });
    expect(stored(db, Q(B2))).toBeNull();
    expect(stored(db, Q('battle-gc'))).toBeNull();
    expect(stored(db, Q('battle-old'))).toBeNull();
    expect(db.__access.reads.filter((p) => p.includes(`/${B2}/calls`) || p.includes('/battle-gc/calls') || p.includes('/battle-old/calls'))).toEqual([]);
    const battlesQuery = db.__access.queries.find((q) => q.collectionPath === 'agentBattles');
    expect(battlesQuery.filters).toEqual([{ field: 'expiresAt', op: '>=', value: new Date(NOW - 7 * 86_400_000).toISOString() }]);
    expect(battlesQuery.orders.map((o) => o.field)).toEqual(['expiresAt', '__name__']);
    expect(SWEEP_PAGE).toBe(20);
  });
});
