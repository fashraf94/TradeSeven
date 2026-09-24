// api/_utils/callRecords/publish.test.js
//
// Cockpit Build 0 — PUBLICATION (spec V1.3 §3.7; §3.12 rows 6 "budget", 7
// "publication", 8 "phase wire"). Driven against the calls store fixture: an
// optimistic transaction with a conflict set, create-once ALREADY_EXISTS, and
// the race / latency hooks a real Firestore commit can exhibit.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  publishDeclarations, runModelCallsPhase, callsBudget, callsReserveMsFor, composeCallsDiag, captureRefsFor, writeCallsStatus,
  CALLS_RESERVE_MS, TAIL_RESERVE_MS, MODEL_PHASE_MS, NON_MODEL_PHASE_MS, STATUS_RESERVE_MS, DIAG_LIST_CAP, PHASE_WIRE_VALUES,
} from './publish.js';
import { buildMintCandidate } from './candidate.js';
import { createCallsContext } from './mode.js';
import { captureDeclarations } from './validate.js';
import { bindHorizon, battleExpiryMs } from './horizon.js';
import { shouldStartHaikuCall, PROMPT_BUILD_CEILING_MS, HAIKU_CALL_CEILING_MS, HAIKU_POST_CALL_ALLOWANCE_MS } from '../agentEvalTransport.js';
import { FROZEN_NOW, makeTickBattle, makeDeclarations, makeObservation } from '../__fixtures__/tickStampsHarness.js';
import { makeCallsDb, storedDoc, storedCollection, callsTouches, QUEUE_COLLECTION } from '../__fixtures__/callRecordsStore.js';

const TIME_BUDGET_MS = 290_000; // agent-evaluate.js TIME_BUDGET_MS
const BATTLE_ID = 'battle-tick-1';
const EVAL_ID = 'eval_001';
const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
const PROMPT_MS = Date.parse(FROZEN_NOW);
const MINT = PROMPT_MS + 20_000;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const committedBattle = (over = {}) => makeTickBattle({
  cronState: { ...makeTickBattle().cronState, evalSeq: 1 },
  ...over,
});
const candidateOf = (raw = makeDeclarations(), over = {}) => buildMintCandidate({
  battleId: BATTLE_ID, evalId: EVAL_ID, evalSeq: 1, mintedAtMs: MINT, raw, universe: UNIVERSE,
  observation: makeObservation(), promptBuiltAt: FROZEN_NOW, tickId: `${BATTLE_ID}:1`, battle: committedBattle(), ...over,
});
const far = () => Date.now() + 5_000;
const publish = (db, candidate, over = {}) => publishDeclarations({
  db, battleId: BATTLE_ID, candidate, evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, ...over,
});
const writesOn = (db, pred) => db.__callsAccess.writes.filter(pred);
const queueTouches = (db) => ({
  reads: db.__callsAccess.reads.filter((p) => p.startsWith(`${QUEUE_COLLECTION}/`)).length,
  writes: writesOn(db, (w) => w.path.startsWith(`${QUEUE_COLLECTION}/`)).length,
});

let errSpy;
let logSpy;
beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  errSpy.mockRestore();
  logSpy.mockRestore();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('the budget — one clock (row 6)', () => {
  it('admission: the calls reserve is 4,000 ms at shadow/on and 0 at off — 48,000 vs 44,000 required', () => {
    expect(callsReserveMsFor('off')).toBe(0);
    expect(callsReserveMsFor('shadow')).toBe(CALLS_RESERVE_MS);
    expect(callsReserveMsFor('on')).toBe(CALLS_RESERVE_MS);
    const off = shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs: TIME_BUDGET_MS, callsReserveMs: callsReserveMsFor('off') });
    const shadow = shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs: TIME_BUDGET_MS, callsReserveMs: callsReserveMsFor('shadow') });
    expect(off.requiredMs).toBe(44_000);
    expect(off.requiredMs).toBe(PROMPT_BUILD_CEILING_MS + HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS);
    expect(shadow.requiredMs).toBe(48_000);
    // The scheduling effect, stated: 46 s left admits the model at off, not at shadow.
    const at46 = (mode) => shouldStartHaikuCall({ elapsedMs: TIME_BUDGET_MS - 46_000, timeBudgetMs: TIME_BUDGET_MS, callsReserveMs: callsReserveMsFor(mode) }).proceed;
    expect(at46('off')).toBe(true);
    expect(at46('shadow')).toBe(false);
    // The default (no reserve passed) is today's number exactly.
    expect(shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs: TIME_BUDGET_MS }).requiredMs).toBe(44_000);
  });

  it('model path: runs only at available ≥ 4,000; the deadline is min(now + 4,000, the tail boundary)', () => {
    const start = 1_000_000;
    const boundary = start + TIME_BUDGET_MS - TAIL_RESERVE_MS;
    const at = (available) => callsBudget({ handlerStartMs: start, timeBudgetMs: TIME_BUDGET_MS, nowMs: boundary - available, phaseMs: MODEL_PHASE_MS });
    expect(at(4_000)).toMatchObject({ run: true, available: 4_000, tailBoundaryMs: boundary, deadlineMs: boundary });
    // Below the threshold the clip is what binds: the formula's deadline is the tail boundary, never past it.
    expect(at(3_999)).toMatchObject({ run: false, available: 3_999, deadlineMs: boundary });
    expect(at(60_000)).toMatchObject({ run: true, deadlineMs: boundary - 60_000 + MODEL_PHASE_MS });
    expect(at(-5)).toMatchObject({ run: false });
  });

  it('non-model hooks: the same protected tail — run only at available ≥ 2,000, deadline clipped to the boundary', () => {
    const start = 5_000;
    const boundary = start + TIME_BUDGET_MS - TAIL_RESERVE_MS;
    const at = (available) => callsBudget({ handlerStartMs: start, timeBudgetMs: TIME_BUDGET_MS, nowMs: boundary - available, phaseMs: NON_MODEL_PHASE_MS });
    expect(at(2_000)).toMatchObject({ run: true, deadlineMs: boundary });
    expect(at(1_999)).toMatchObject({ run: false, deadlineMs: boundary });
    // R3-3's case: an exit reached with 12.1 s left has 100 ms available — skipped, the tail untouched.
    expect(at(100)).toMatchObject({ run: false });
    expect(at(30_000).deadlineMs).toBe(boundary - 30_000 + NON_MODEL_PHASE_MS);
  });
});

// ---------------------------------------------------------------------------
describe('the transaction (row 7)', () => {
  it('publishes the record and every call create-once, arms the queue with the open calls\' minimum, and writes nothing with merge on a call', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const c = candidateOf();
    const res = await publish(db, c);
    expect(res).toMatchObject({ phaseResult: 'written', wire: 'written' });
    expect(res.perId).toEqual([
      { id: `declarations/${EVAL_ID}`, result: 'confirmed' },
      ...c.calls.map((call) => ({ id: call.callId, result: 'confirmed' })),
    ]);
    expect(res.confirmedCallIds).toEqual(c.calls.map((call) => call.callId));
    expect(storedDoc(db, 'declarations', EVAL_ID)).toEqual(c.record);
    expect(storedCollection(db, 'calls')).toEqual(Object.fromEntries(c.calls.map((call) => [call.callId, call])));
    const callWrites = writesOn(db, (w) => w.path.includes('/calls/') || w.path.includes('/declarations/'));
    expect(callWrites.map((w) => w.op)).toEqual(['create', 'create', 'create']);
    expect(callWrites.every((w) => w.merge === false)).toBe(true);
    const minOpen = Math.min(...c.newOpen.map((call) => call.horizon.expiresAt));
    expect(storedDoc(db, QUEUE_COLLECTION)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: minOpen, updatedAt: MINT });
    expect(writesOn(db, (w) => w.path.startsWith(QUEUE_COLLECTION))).toEqual([
      expect.objectContaining({ op: 'set', merge: true }),
    ]);
  });

  it('a completion committing between the parent read and the commit aborts the attempt; the retry reads `completed` → parent_terminal, nothing written', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt === 1) await db.collection('agentBattles').doc(BATTLE_ID).update({ status: 'completed' });
    };
    const res = await publish(db, candidateOf());
    expect(res).toMatchObject({ phaseResult: 'parent_terminal', wire: 'failed' });
    expect(res.perId.every((p) => p.result === 'rejected' && p.reason === 'parent_terminal')).toBe(true);
    expect(res.confirmedCallIds).toEqual([]);
    expect(db.__txAttempts).toBe(2);
    expect(storedCollection(db, 'calls')).toEqual({});
    expect(storedDoc(db, 'declarations', EVAL_ID)).toBeNull();
    expect(storedDoc(db, QUEUE_COLLECTION)).toBeNull();
  });

  it('late-timeout variant: the attempt outlives the deadline while completion lands — the re-read finds nothing (failed, per-id unconfirmed), and no later attempt starts', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt !== 1) return;
      await sleep(120);
      await db.collection('agentBattles').doc(BATTLE_ID).update({ status: 'completed' });
    };
    const now = Date.now();
    const res = await publish(db, candidateOf(), { txDeadlineMs: now + 40, rereadDeadlineMs: now + 400 });
    expect(res).toMatchObject({ phaseResult: 'timeout_absent', wire: 'failed' });
    expect(res.perId.every((p) => p.result === 'unconfirmed')).toBe(true);
    expect(res.confirmedCallIds).toEqual([]);
    await sleep(200); // let the abandoned attempt settle
    expect(storedCollection(db, 'calls')).toEqual({});
    expect(storedDoc(db, 'declarations', EVAL_ID)).toBeNull();
    // The retry after the deadline never read (it refused before any read).
    expect(db.__txAttempts).toBe(2);
    expect(db.__counts.battleDocGets).toBe(1);
  });

  it('an identical retry is idempotent success: nothing written, the queue untouched', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const c = candidateOf();
    await publish(db, c);
    const writesBefore = db.__callsAccess.writes.length;
    const queueBefore = storedDoc(db, QUEUE_COLLECTION);
    const again = await publish(db, candidateOf());
    expect(again).toMatchObject({ phaseResult: 'idempotent', wire: 'written' });
    expect(again.perId.every((p) => p.result === 'confirmed')).toBe(true);
    expect(db.__callsAccess.writes.length).toBe(writesBefore);
    expect(storedDoc(db, QUEUE_COLLECTION)).toEqual(queueBefore);
  });

  it('a different payload for the same identity → call_conflict: originals preserved, both ids logged', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const first = candidateOf();
    await publish(db, first);
    const originals = { record: storedDoc(db, 'declarations', EVAL_ID), calls: storedCollection(db, 'calls') };
    const different = candidateOf(makeDeclarations({ watching: ['AMD'] }));
    const res = await publish(db, different);
    expect(res).toMatchObject({ phaseResult: 'call_conflict', wire: 'failed' });
    expect(res.perId.every((p) => p.result === 'rejected' && p.reason === 'call_conflict')).toBe(true);
    expect(storedDoc(db, 'declarations', EVAL_ID)).toEqual(originals.record);
    expect(storedCollection(db, 'calls')).toEqual(originals.calls);
    const logged = errSpy.mock.calls.map((a) => a.join(' ')).join('\n');
    expect(logged).toContain('call_conflict');
    for (const id of res.perId.map((p) => p.id)) expect(logged).toContain(id);
  });

  it('a stray call under a candidate id (no record) is a conflict too — never overwritten', async () => {
    const c = candidateOf();
    const stray = { ...c.calls[0], said: 'someone else wrote this' };
    const db = makeCallsDb({ battle: committedBattle(), seed: { calls: { [stray.callId]: stray } } });
    const res = await publish(db, c);
    expect(res.phaseResult).toBe('call_conflict');
    expect(storedCollection(db, 'calls')).toEqual({ [stray.callId]: stray });
  });

  it('declarations-only (watching / playerAsk): the record alone — no queue read, no queue write, an existing queue left unchanged', async () => {
    const queue = { battleId: BATTLE_ID, nextExpiresAt: MINT + 99_000, updatedAt: MINT - 5 };
    const db = makeCallsDb({ battle: committedBattle(), seed: { queue } });
    const c = candidateOf({ calledShots: [], watching: ['JPM'], playerAsk: { question: 'Hold KO?', options: ['yes', 'no'] }, fork: null });
    expect(c.calls).toEqual([]);
    const res = await publish(db, c);
    expect(res).toMatchObject({ phaseResult: 'written', wire: 'written', confirmedCallIds: [] });
    expect(storedDoc(db, 'declarations', EVAL_ID)).toEqual(c.record);
    expect(queueTouches(db)).toEqual({ reads: 0, writes: 0 });
    expect(storedDoc(db, QUEUE_COLLECTION)).toEqual(queue);
  });

  it('all-invalidated: the calls mint `invalidated` — no queue read, no queue write, no queue document born', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const c = candidateOf(makeDeclarations(), { observation: makeObservation({ omit: ['AMD', 'TSLA'] }) });
    expect(c.calls.map((x) => x.state)).toEqual(['invalidated', 'invalidated']);
    expect(c.newOpen).toEqual([]);
    const res = await publish(db, c);
    expect(res.phaseResult).toBe('written');
    expect(Object.values(storedCollection(db, 'calls')).map((x) => x.state)).toEqual(['invalidated', 'invalidated']);
    expect(queueTouches(db)).toEqual({ reads: 0, writes: 0 });
    expect(storedDoc(db, QUEUE_COLLECTION)).toBeNull();
  });

  it('mixed: the queue arms at the OPEN calls\' minimum — an invalidated call\'s earlier expiry never counts', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    // TSLA (next_check, the earlier expiry) is invalidated; AMD (this_session) stays open.
    const c = candidateOf(makeDeclarations(), { observation: makeObservation({ omit: ['TSLA'] }) });
    const [amd, tsla] = c.calls;
    expect([amd.state, tsla.state]).toEqual(['open', 'invalidated']);
    expect(tsla.horizon.expiresAt).toBeLessThan(amd.horizon.expiresAt);
    await publish(db, c);
    expect(storedDoc(db, QUEUE_COLLECTION).nextExpiresAt).toBe(amd.horizon.expiresAt);
  });

  it('a pre-existing EARLIER queue value is preserved; a later one is lowered to the new minimum', async () => {
    const c = candidateOf();
    const minOpen = Math.min(...c.newOpen.map((call) => call.horizon.expiresAt));
    const earlier = makeCallsDb({ battle: committedBattle(), seed: { queue: { battleId: BATTLE_ID, nextExpiresAt: minOpen - 60_000, updatedAt: 1 } } });
    await publish(earlier, c);
    expect(storedDoc(earlier, QUEUE_COLLECTION)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: minOpen - 60_000, updatedAt: MINT });
    const later = makeCallsDb({ battle: committedBattle(), seed: { queue: { battleId: BATTLE_ID, nextExpiresAt: minOpen + 60_000, updatedAt: 1, other: 'kept' } } });
    await publish(later, c);
    expect(storedDoc(later, QUEUE_COLLECTION)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: minOpen, updatedAt: MINT, other: 'kept' });
  });

  it('never Infinity / null / undefined in the queue: a non-finite open expiry and a corrupt existing value are both ignored', async () => {
    const c = candidateOf();
    const poisoned = { ...c, newOpen: c.newOpen.map((call) => ({ ...call, horizon: { ...call.horizon, expiresAt: Infinity } })) };
    const db = makeCallsDb({ battle: committedBattle(), seed: { queue: { battleId: BATTLE_ID, nextExpiresAt: null, updatedAt: 1 } } });
    const res = await publish(db, poisoned);
    expect(res.phaseResult).toBe('written');
    // Nothing finite to arm → no queue write at all; the corrupt value is not "repaired" with a sentinel.
    expect(queueTouches(db).writes).toBe(0);
    expect(storedDoc(db, QUEUE_COLLECTION)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: null, updatedAt: 1 });
  });

  it('the committed identity is required: a parent whose evalSeq is behind, a missing parent, or a non-active parent → parent_terminal', async () => {
    for (const battle of [
      makeTickBattle(),                                    // no committed evalSeq
      committedBattle({ cronState: { ...makeTickBattle().cronState, evalSeq: 0 } }),
      committedBattle({ status: 'completed' }),
      committedBattle({ status: 'pending' }),
    ]) {
      const db = makeCallsDb({ battle });
      const res = await publish(db, candidateOf());
      expect(res).toMatchObject({ phaseResult: 'parent_terminal', wire: 'failed' });
      expect(storedCollection(db, 'calls')).toEqual({});
    }
  });

  it('a thrown transaction → `threw`, wire failed, everything rejected', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.afterTxBody = async () => { throw new Error('14 UNAVAILABLE: backend'); };
    const res = await publish(db, candidateOf());
    expect(res).toMatchObject({ phaseResult: 'threw', wire: 'failed' });
    expect(res.perId.every((p) => p.result === 'rejected')).toBe(true);
  });

  it('no attempt starts after the deadline: a contended retry past it refuses before reading', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt !== 1) return;
      await sleep(30);
      // An unrelated write to the parent — contention, not completion.
      await db.collection('agentBattles').doc(BATTLE_ID).update({ 'cronState.evaluatingAt': null });
    };
    const now = Date.now();
    const res = await publish(db, candidateOf(), { txDeadlineMs: now + 20, rereadDeadlineMs: now + 20 });
    // The timeout fired first; with no re-read budget the wire is unchanged.
    expect(res).toMatchObject({ phaseResult: 'unconfirmed', wire: null });
    await sleep(80);
    expect(db.__txAttempts).toBe(2);
    expect(db.__counts.battleDocGets).toBe(1);
    expect(storedCollection(db, 'calls')).toEqual({});
  });

  it('an exhausted budget at entry is skipped_budget: no transaction, wire failed', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const res = await publish(db, candidateOf(), { txDeadlineMs: Date.now() - 1 });
    expect(res).toMatchObject({ phaseResult: 'skipped_budget', wire: 'failed' });
    expect(db.__txAttempts).toBe(0);
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('the phase wire (row 8)', () => {
  it('a timeout whose commit LANDED (late acknowledgement): the re-read finds the identical documents → written, confirmed', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.afterCommit = async () => { await sleep(120); };
    const now = Date.now();
    const c = candidateOf();
    const res = await publish(db, c, { txDeadlineMs: now + 40, rereadDeadlineMs: now + 400 });
    expect(res).toMatchObject({ phaseResult: 'timeout_present', wire: 'written' });
    expect(res.perId.every((p) => p.result === 'confirmed')).toBe(true);
    expect(res.confirmedCallIds).toEqual(c.calls.map((x) => x.callId));
    await sleep(150);
  });

  it('a timeout whose commit has NOT landed: absent → failed, per-id unconfirmed, no capture reference', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    db.__hooks.beforeCommit = async () => { await sleep(120); };
    const now = Date.now();
    const c = candidateOf();
    const res = await publish(db, c, { txDeadlineMs: now + 40, rereadDeadlineMs: now + 400 });
    expect(res).toMatchObject({ phaseResult: 'timeout_absent', wire: 'failed', confirmedCallIds: [] });
    expect(captureRefsFor(c, res.confirmedCallIds)).toEqual([]);
    await sleep(150); // the late commit lands after the phase gave up — still never referenced
    expect(storedDoc(db, 'declarations', EVAL_ID)).toEqual(c.record);
  });

  it('a timeout that cannot be re-read: the wire is LEFT UNCHANGED (null) and the diagnostics say unconfirmed', async () => {
    const noBudget = makeCallsDb({ battle: committedBattle() });
    noBudget.__hooks.beforeCommit = async () => { await sleep(80); };
    const now = Date.now();
    const a = await publish(noBudget, candidateOf(), { txDeadlineMs: now + 30, rereadDeadlineMs: now + 30 });
    expect(a).toMatchObject({ phaseResult: 'unconfirmed', wire: null });
    expect(a.perId.every((p) => p.result === 'unconfirmed')).toBe(true);

    const failingReread = makeCallsDb({ battle: committedBattle() });
    failingReread.__hooks.beforeCommit = async () => { await sleep(80); };
    failingReread.getAll = async () => { throw new Error('14 UNAVAILABLE'); };
    const t = Date.now();
    const b = await publish(failingReread, candidateOf(), { txDeadlineMs: t + 30, rereadDeadlineMs: t + 400 });
    expect(b).toMatchObject({ phaseResult: 'unconfirmed', wire: null });
    expect(b.perId.every((p) => p.result === 'unconfirmed' && p.reason === 'reread_failed')).toBe(true);
    await sleep(120);
  });

  it('a timeout whose re-read finds DIFFERENT documents → failed (timeout_conflict)', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const other = candidateOf(makeDeclarations({ watching: ['AMD'] }));
    db.__hooks.beforeCommit = async ({ attempt }) => {
      if (attempt !== 1) return;
      // Another writer's record lands while this commit is slow.
      await db.collection('agentBattles').doc(BATTLE_ID).collection('declarations').doc(EVAL_ID).create(other.record);
      await sleep(80);
    };
    const now = Date.now();
    const res = await publish(db, candidateOf(), { txDeadlineMs: now + 30, rereadDeadlineMs: now + 400 });
    expect(res).toMatchObject({ phaseResult: 'timeout_conflict', wire: 'failed' });
    await sleep(120);
  });

  it('`written` never precedes the commit: at commit time the battle carries no written wire for this check', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MINT);
    const db = makeCallsDb({ battle: committedBattle() });
    const seenAtCommit = [];
    db.__hooks.beforeCommit = async () => { seenAtCommit.push(db.__store.battle.cronState.declarationsPhase ?? null); };
    const ctx = modelCtx();
    const res = await runModelCallsPhase(ctx, phaseArgs(db));
    expect(res.wire).toBe('written');
    expect(seenAtCommit).toEqual([null]);
    expect(db.__store.battle.cronState.declarationsPhase).toEqual({ evalId: EVAL_ID, phase: 'written' });
  });

  it('the wire carries only the contract\'s two values, keyed to the committed evalId', () => {
    expect(PHASE_WIRE_VALUES).toEqual(['written', 'failed']);
    expect(Object.isFrozen(PHASE_WIRE_VALUES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The model-path phase (publication → flips → ONE status write).

function modelCtx({ mode = 'shadow', raw = makeDeclarations(), handlerStartMs = MINT - 60_000, exit = 'model_result', identity = { evalId: EVAL_ID, evalSeq: 1 } } = {}) {
  const ctx = createCallsContext({ mode, handlerStartMs });
  ctx.universe = Object.freeze([...UNIVERSE]);
  ctx.observation = makeObservation();
  ctx.declarations = captureDeclarations(raw, {
    universe: ctx.universe,
    resolveHorizon: bindHorizon({ promptBuiltAtMs: PROMPT_MS, mintedAtMs: MINT, battleExpiresAtMs: battleExpiryMs(committedBattle()) }),
  });
  ctx.exit = exit;
  ctx.evalIdentity = identity;
  return ctx;
}
const phaseArgs = (db, over = {}) => ({
  db, battle: committedBattle(), timeBudgetMs: TIME_BUDGET_MS, promptBuiltAt: FROZEN_NOW, tickId: `${BATTLE_ID}:1`, ...over,
});
const statusWrites = (db) => db.__updates.filter((u) => Object.keys(u).some((k) => k.startsWith('cronState.callsDiag')));

describe('runModelCallsPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MINT);
  });

  it('expected → publication, then ONE status write: the wire, the bounded diagnostics, confirmed capture references', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const res = await runModelCallsPhase(modelCtx(), phaseArgs(db));
    expect(res).toMatchObject({ phaseResult: 'written', wire: 'written', status: 'written' });
    expect(res.captureRefs).toEqual([
      { callId: `${BATTLE_ID}:${EVAL_ID}:call:0`, n: 0, kind: 'called_shot' },
      { callId: `${BATTLE_ID}:${EVAL_ID}:call:1`, n: 1, kind: 'confirmation' },
    ]);
    const writes = statusWrites(db);
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0]).sort()).toEqual(['cronState.callsDiag', 'cronState.declarationsPhase']);
    expect(writes[0]['cronState.declarationsPhase']).toEqual({ evalId: EVAL_ID, phase: 'written' });
    expect(writes[0]['cronState.callsDiag']).toMatchObject({ evalId: EVAL_ID, exit: 'model_result', phaseResult: 'written', truncated: false });
  });

  it('phase `none` (no block) → no publication and no wire; flips still run; diagnostics written', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const flips = vi.fn(async () => ({ status: { evalId: EVAL_ID, cursor: null, scanned: 0, total: null, complete: true }, diag: { scanned: 0 } }));
    const res = await runModelCallsPhase(modelCtx({ raw: null }), phaseArgs(db, { flips }));
    expect(res).toMatchObject({ phaseResult: 'none', wire: null, captureRefs: [] });
    expect(flips).toHaveBeenCalledTimes(1);
    expect(storedDoc(db, 'declarations', EVAL_ID)).toBeNull();
    const [w] = statusWrites(db);
    expect(w).not.toHaveProperty('cronState.declarationsPhase');
    expect(w['cronState.callFlips']).toEqual({ evalId: EVAL_ID, cursor: null, scanned: 0, total: null, complete: true });
  });

  it('flips share the deadline: they receive a work deadline that keeps the status slice, inside the tail boundary', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const flips = vi.fn(async () => null);
    const ctx = modelCtx();
    await runModelCallsPhase(ctx, phaseArgs(db, { flips }));
    const [, opts] = flips.mock.calls[0];
    const boundary = ctx.handlerStartMs + TIME_BUDGET_MS - TAIL_RESERVE_MS;
    expect(opts.deadlineMs).toBe(Math.min(MINT + MODEL_PHASE_MS, boundary) - STATUS_RESERVE_MS);
    expect(opts.battleId).toBe(BATTLE_ID);
    expect(opts.battle.id).toBe(BATTLE_ID);
  });

  it('skipped at available < 4,000: no publication, no flips; the wire says failed through a status-only write inside the boundary', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const flips = vi.fn();
    const handlerStartMs = MINT - (TIME_BUDGET_MS - TAIL_RESERVE_MS - 3_999);
    const res = await runModelCallsPhase(modelCtx({ handlerStartMs }), phaseArgs(db, { flips }));
    expect(res).toMatchObject({ phaseResult: 'skipped_budget', wire: 'failed', captureRefs: [] });
    expect(flips).not.toHaveBeenCalled();
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    const [w] = statusWrites(db);
    expect(w['cronState.declarationsPhase']).toEqual({ evalId: EVAL_ID, phase: 'failed' });
  });

  it('past the tail boundary nothing starts — not even the status write', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    const handlerStartMs = MINT - (TIME_BUDGET_MS - TAIL_RESERVE_MS + 1);
    const res = await runModelCallsPhase(modelCtx({ handlerStartMs }), phaseArgs(db));
    expect(res).toMatchObject({ phaseResult: 'skipped_budget', status: 'skipped' });
    expect(statusWrites(db)).toEqual([]);
  });

  it('expected at the commit but emptied at mint (the explicit expiry crossed) → nothing written, wire failed', async () => {
    const expiresAtMs = MINT - 1; // after promptBuiltAt, before the mint
    const raw = { calledShots: [{ ...makeDeclarations().calledShots[0], horizonPhrase: 'explicit', expiresAtMs }], watching: [], playerAsk: null, fork: null };
    const ctx = createCallsContext({ mode: 'shadow', handlerStartMs: MINT - 60_000 });
    ctx.universe = Object.freeze([...UNIVERSE]);
    ctx.observation = makeObservation();
    // At the tool-result seam (before the mint) the explicit horizon was valid.
    ctx.declarations = captureDeclarations(raw, {
      universe: ctx.universe,
      resolveHorizon: bindHorizon({ promptBuiltAtMs: PROMPT_MS, mintedAtMs: PROMPT_MS + 1_000, battleExpiresAtMs: battleExpiryMs(committedBattle()) }),
    });
    expect(ctx.declarations.phase).toBe('expected');
    ctx.exit = 'model_result';
    ctx.evalIdentity = { evalId: EVAL_ID, evalSeq: 1 };
    const db = makeCallsDb({ battle: committedBattle() });
    const res = await runModelCallsPhase(ctx, phaseArgs(db));
    expect(res).toMatchObject({ phaseResult: 'nothing_to_write', wire: 'failed' });
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    expect(statusWrites(db)[0]['cronState.callsDiag'].removed).toEqual([{ source: 'calledShots', index: 0, reason: 'explicit_invalid' }]);
  });

  it('inert without a committed identity, off the model row, or at off — no evalId fabricated, nothing touched', async () => {
    for (const ctx of [
      modelCtx({ identity: null }),
      modelCtx({ exit: 'transport_failed_after_prompt' }),
      modelCtx({ exit: 'budget_skipped' }),
      (() => { const c = modelCtx(); c.mode = 'off'; return c; })(),
    ]) {
      const db = makeCallsDb({ battle: committedBattle() });
      expect(await runModelCallsPhase(ctx, phaseArgs(db))).toBeNull();
      expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
      expect(db.__updates).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
describe('diagnostics, status, capture references', () => {
  it('composeCallsDiag bounds every list to 8', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, result: 'confirmed' }));
    const removed = Array.from({ length: 20 }, (_, i) => ({ source: 'calledShots', index: i, reason: 'malformed', extra: 'dropped' }));
    const d = composeCallsDiag({ evalId: 'e', perId: many, removed, faults: many });
    expect(d.perId).toHaveLength(DIAG_LIST_CAP);
    expect(d.removed).toHaveLength(DIAG_LIST_CAP);
    expect(d.removed[0]).toEqual({ source: 'calledShots', index: 0, reason: 'malformed' });
    expect(d.faults).toHaveLength(DIAG_LIST_CAP);
  });

  it('writeCallsStatus: skipped past the deadline, unconfirmed on a timeout, failed on an error', async () => {
    const db = makeCallsDb({ battle: committedBattle() });
    expect(await writeCallsStatus({ db, battleId: BATTLE_ID, fields: { 'cronState.callsDiag': {} }, deadlineMs: Date.now() - 1 })).toBe('skipped');
    expect(db.__updates).toEqual([]);
    const slow = { collection: () => ({ doc: () => ({ update: () => sleep(100) }) }) };
    expect(await writeCallsStatus({ db: slow, battleId: BATTLE_ID, fields: { a: 1 }, deadlineMs: Date.now() + 20 })).toBe('unconfirmed');
    const broken = { collection: () => ({ doc: () => ({ update: async () => { throw new Error('boom'); } }) }) };
    expect(await writeCallsStatus({ db: broken, battleId: BATTLE_ID, fields: { a: 1 }, deadlineMs: Date.now() + 500 })).toBe('failed');
    await sleep(120);
  });

  it('captureRefsFor: confirmed calls only, as { callId, n, kind }', () => {
    const c = candidateOf();
    expect(captureRefsFor(c, [c.calls[1].callId])).toEqual([{ callId: c.calls[1].callId, n: 1, kind: 'confirmation' }]);
    expect(captureRefsFor(c, [])).toEqual([]);
    expect(captureRefsFor({ record: null }, ['x'])).toEqual([]);
  });
});
