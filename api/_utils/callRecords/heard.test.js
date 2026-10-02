// api/_utils/callRecords/heard.test.js
//
// Cockpit Build 1a — THE HEARD WRITER and the acted / no-match receipts (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §2, §7, §15.6), and the events the Build 0
// phase now creates inside its own transactions at resolved 'on' (§10, §11):
// the `declared` event with `promptDirectiveThreadId` ONLY from an unsuppressed
// heard, the `expired` event atomic with the flip (with the answer-expired
// line), none of it at shadow.
//
// Driven against the general store double (api/_utils/__fixtures__/callsFirestore.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, stored, storedUnder, touches } from '../__fixtures__/callsFirestore.js';
import { makeTickBattle, makeDeclarations, makeObservation, FROZEN_NOW } from '../__fixtures__/tickStampsHarness.js';
import { runHeardPhase, planHeard, heardThreadOf, legMatches, executorResultPresent, answerIsLate, selectedPickOf, directiveRecordOf } from './heard.js';
import { runCallFlips, resetFlipIndexMemo } from './flip.js';
import { publishDeclarations, runModelCallsPhase } from './publish.js';
import { buildMintCandidate } from './candidate.js';
import { createCallsContext } from './mode.js';

const T = (iso) => Date.parse(iso);
const NOW = T(FROZEN_NOW); // 2026-09-09 15:00Z — 11:00 ET
const PROMPT_AT = '2026-09-09T15:00:00.000Z';
const CLOSE = T('2026-09-09T20:00:00.000Z');
const BATTLE_ID = 'battle-tick-1';
const EVAL = 'eval_007';
const THREAD = 'thread-call-0001';
const CALL = `${BATTLE_ID}:eval_001:call:0`;
const PICK = `${BATTLE_ID}:eval_001:call:2`;
const P = (sub, id) => `agentBattles/${BATTLE_ID}/${sub}/${id}`;

const shot = (callId = CALL, over = {}) => ({
  callId, kind: 'called_shot', battleId: BATTLE_ID, evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 3_600_000,
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'x',
  evidence: { tickId: null, availability: 'off', priceAsOf: null }, hypothesisRef: null, origin: 'agent_initiative',
  state: 'open', stateChangedAt: NOW - 3_600_000, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
const answered = (callId = CALL, over = {}, pr = {}) => shot(callId, {
  playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: THREAD, callId, filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null, ...pr },
  directiveThreadId: THREAD, ...over,
});
const callSlot = (over = {}) => ({
  text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: THREAD, createdAt: '2026-09-09T14:20:00.000Z',
  family: 'call', expiresAtMs: CLOSE, basis: 'this_session', callId: CALL, kind: 'call_hold',
  action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' }, answerId: `${CALL}:answer:hold:`,
  filedAt: '2026-09-09T14:20:00.000Z', textVersion: 'callActions.v1', ...over,
});
const exchangeFor = (slot) => { const { createdAt, ...record } = slot; return { userMessage: null, agentResponse: '', hasDirective: true, directive: record, directiveThreadId: slot.directiveThreadId, timestamp: createdAt, mode: 'battle', messageType: 'directive_filed', source: 'cockpit', groundingVersion: 1, callId: slot.callId }; };
const HEARD = { directiveThreadId: THREAD, suppressed: null };
const SWAP_AMD_FOR_KO = { symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 };

function makeDb({ battle = makeTickBattle({ directive: callSlot(), chatExchanges: [exchangeFor(callSlot())] }), calls = { [CALL]: answered() }, extra = {} } = {}) {
  return makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: battle, ...Object.fromEntries(Object.entries(calls).map(([id, c]) => [P('calls', id), c])), ...extra } });
}
const ctxOn = () => ({ ...createCallsContext({ mode: 'on', handlerStartMs: NOW }), exit: 'model_result', evalIdentity: { evalId: EVAL, evalSeq: 7 } });
const run = (db, over = {}) => runHeardPhase(over.ctx ?? ctxOn(), { db, battleId: BATTLE_ID, evalId: EVAL, promptBuiltAt: PROMPT_AT, heard: HEARD, executorResult: null, deadlineMs: Date.now() + 5_000, ...over });
const events = (db) => storedUnder(db, `agentBattles/${BATTLE_ID}/callEvents`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW + 30_000));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetFlipIndexMemo();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the pure helpers', () => {
  it('heardThreadOf: an UNSUPPRESSED stamp only', () => {
    expect(heardThreadOf(HEARD)).toBe(THREAD);
    expect(heardThreadOf({ directiveThreadId: THREAD, suppressed: 'mode_not_enforce' })).toBeNull();
    expect(heardThreadOf({ directiveThreadId: THREAD })).toBeNull(); // undefined ≠ null: not the composer's shape
    expect(heardThreadOf(null)).toBeNull();
  });
  it('executorResultPresent / legMatches / answerIsLate / selectedPickOf', () => {
    expect(executorResultPresent(SWAP_AMD_FOR_KO)).toBe(true);
    expect(executorResultPresent({ symbolOut: null, symbolIn: 'AMD', tier: 'support', slotIndex: 0 })).toBe(false);
    expect(executorResultPresent(null)).toBe(false);
    expect(legMatches(shot(), SWAP_AMD_FOR_KO)).toBe(true);
    expect(legMatches(shot(), { symbolOut: 'PG', symbolIn: 'AMD', tier: 'support', slotIndex: 1 })).toBe(true); // the entry leg, another counterpart
    expect(legMatches(shot(), { symbolOut: 'KO', symbolIn: 'JPM', tier: 'support', slotIndex: 0 })).toBe(false);
    expect(legMatches(shot(CALL, { direction: 'exit', symbol: 'KO' }), { symbolOut: 'KO', symbolIn: 'JPM', tier: 'support', slotIndex: 0 })).toBe(true);
    expect(answerIsLate({ filedAt: '2026-09-09T15:00:01.000Z' }, PROMPT_AT)).toBe(true);
    expect(answerIsLate({ filedAt: '2026-09-09T15:00:00.000Z' }, PROMPT_AT)).toBe(false);
    expect(answerIsLate({ filedAt: 'garbage' }, PROMPT_AT)).toBe(false);
    const pickSlot = callSlot({ directiveThreadId: 'thread-pick', callId: PICK, kind: 'call_pick', action: { direction: null, symbol: null, slot: 'support', pickSymbol: 'JPM', swapOut: 'KO' } });
    expect(selectedPickOf({ directive: pickSlot }, 'thread-pick')).toBe('JPM');
    expect(selectedPickOf({ directive: null, chatExchanges: [exchangeFor(pickSlot)] }, 'thread-pick')).toBe('JPM'); // durable after the slot is replaced
    expect(selectedPickOf({ directive: callSlot() }, THREAD)).toBeNull();
    expect(directiveRecordOf({ directive: callSlot() }, 'unknown')).toBeNull();
  });
});

describe('planHeard — scope and the three facts', () => {
  const parent = makeTickBattle({ directive: callSlot(), chatExchanges: [exchangeFor(callSlot())] });
  const args = { thread: THREAD, evalId: EVAL, promptBuiltAt: PROMPT_AT, executorResult: null, flippedIds: new Set() };

  it('skips: another thread, an ack, a late answer, a terminal call not flipped this phase', () => {
    expect(planHeard(answered(CALL, {}, { directiveThreadId: 'other' }), parent, args)).toEqual({ skip: 'not_this_thread' });
    expect(planHeard(answered(CALL, {}, { kind: 'ack' }), parent, args)).toEqual({ skip: 'not_this_thread' });
    expect(planHeard(answered(CALL, {}, { filedAt: '2026-09-09T15:00:00.001Z' }), parent, args)).toEqual({ skip: 'late_answer' });
    expect(planHeard(answered(CALL, { state: 'hit' }), parent, args)).toEqual({ skip: 'post_terminal' });
    expect(planHeard(answered(CALL, { state: 'hit' }), parent, { ...args, flippedIds: new Set([CALL]) })).toMatchObject({ stampHeard: true });
  });

  it('heard is first-confirmed; acted needs a WHOLE-trade match; no-match needs a PRESENT result that misses the affected leg; a null result is unknown', () => {
    expect(planHeard(answered(), parent, args)).toMatchObject({ stampHeard: true, acted: false, noMatch: false, retire: false });
    expect(planHeard(answered(CALL, {}, { heardEvalId: 'eval_003' }), parent, args)).toMatchObject({ stampHeard: false, acted: false, noMatch: false });
    expect(planHeard(answered(), parent, { ...args, executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ stampHeard: true, acted: true, noMatch: false, retire: false }); // a hold is not retired by action
    expect(planHeard(answered(), parent, { ...args, executorResult: { symbolOut: 'PG', symbolIn: 'JPM', tier: 'support', slotIndex: 1 } })).toMatchObject({ acted: false, noMatch: true });
    expect(planHeard(answered(), parent, { ...args, executorResult: { symbolOut: 'PG', symbolIn: 'AMD', tier: 'support', slotIndex: 1 } })).toMatchObject({ acted: false, noMatch: false }); // the leg happened with another counterpart: neither claim
    expect(planHeard(answered(), parent, { ...args, executorResult: { symbolOut: null, symbolIn: null, tier: null, slotIndex: null } })).toMatchObject({ acted: false, noMatch: false });
    expect(planHeard(answered(CALL, { outcome: { actedEvalId: 'eval_002' } }), parent, { ...args, executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ acted: false });
  });

  it('a go directive acted on is retired; a pick is matched on the SELECTED option and retired', () => {
    const goSlot = callSlot({ kind: 'call_go', answerId: `${CALL}:answer:go_now:` });
    const goParent = makeTickBattle({ directive: goSlot });
    expect(planHeard(answered(CALL, { defaultAction: 'hold' }, { answer: 'go_now' }), goParent, { ...args, executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ acted: true, retire: true, answerId: `${CALL}:answer:go_now:` });
    const pickSlot = callSlot({ callId: PICK, kind: 'call_pick', answerId: `${PICK}:answer:pick:JPM`, action: { direction: null, symbol: null, slot: 'support', pickSymbol: 'JPM', swapOut: 'KO' } });
    const pickParent = makeTickBattle({ directive: pickSlot });
    const pick = shot(PICK, { kind: 'pick', symbol: null, direction: null, counterpart: null, swapOut: 'KO', options: [{ symbol: 'AMD' }, { symbol: 'JPM' }], condition: null, defaultAction: null, horizon: { phrase: 'next_check', expiresAt: NOW + 900_000, basis: 'next_check' }, playerResponse: { answer: 'pick', kind: 'directive', directiveThreadId: THREAD, callId: PICK, filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null }, directiveThreadId: THREAD });
    expect(planHeard(pick, pickParent, { ...args, executorResult: { symbolOut: 'KO', symbolIn: 'JPM', tier: 'support', slotIndex: 0 } })).toMatchObject({ acted: true, retire: true, pick: 'JPM' });
    // AMD came in instead of the selected JPM: an option, but not the selection → not acted; the leg (KO out of support) happened → not "no match" either.
    expect(planHeard(pick, pickParent, { ...args, executorResult: { symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 } })).toMatchObject({ acted: false, noMatch: false });
  });
});

describe('runHeardPhase — one transaction per call, at resolved on (spec §7)', () => {
  it('stamps heardEvalId FIRST-CONFIRMED and creates the heard event; a second check stamps nothing and creates nothing', async () => {
    const db = makeDb();
    const diag = await run(db);
    expect(diag).toMatchObject({ thread: THREAD, scanned: 1, heard: 1, acted: 0, noMatch: 0, unconfirmed: 0, failed: 0 });
    const call = stored(db, P('calls', CALL));
    expect(call.playerResponse.heardEvalId).toBe(EVAL);
    expect(call.playerResponse.answer).toBe('hold'); // nothing else on the response moved
    expect(events(db)).toEqual({
      [`${CALL}:heard:${EVAL}`]: { kind: 'heard', at: NOW + 30_000, callIds: [CALL], text: 'Heard at the 11:00 check', saidOk: null, evidence: { evalId: EVAL, promptBuiltAt: PROMPT_AT, checkLabel: 'the 11:00 check' } },
    });
    expect(db.__txAttempts).toBe(1);
    // A later check that hears the same thread: monotonic — the first stamp stands, no second event.
    const again = await run(db, { evalId: 'eval_008' });
    expect(again).toMatchObject({ scanned: 1, heard: 0, skipped: { nothing_to_do: 1 } });
    expect(stored(db, P('calls', CALL)).playerResponse.heardEvalId).toBe(EVAL);
    expect(Object.keys(events(db))).toEqual([`${CALL}:heard:${EVAL}`]);
  });

  it('a SUPPRESSED stamp never writes; no stamp never writes; below resolved on nothing runs — and no call is read', async () => {
    for (const [heard, stopped] of [[{ directiveThreadId: THREAD, suppressed: 'epoch_killed' }, 'suppressed'], [null, 'no_heard']]) {
      const db = makeDb();
      expect(await run(db, { heard })).toMatchObject({ stopped, scanned: 0 });
      expect(touches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    }
    for (const mode of ['off', 'shadow']) {
      const db = makeDb();
      expect(await run(db, { ctx: { ...ctxOn(), mode } })).toMatchObject({ stopped: 'inactive' });
      expect(touches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    }
  });

  it('a LATE answer (filed after the prompt) is not heard by this check', async () => {
    const db = makeDb({ calls: { [CALL]: answered(CALL, {}, { filedAt: '2026-09-09T15:00:00.500Z' }) } });
    expect(await run(db)).toMatchObject({ scanned: 1, heard: 0, skipped: { late_answer: 1 } });
    expect(stored(db, P('calls', CALL)).playerResponse.heardEvalId).toBeNull();
    expect(events(db)).toEqual({});
  });

  it('ACTED: a whole-trade match writes outcome.actedEvalId and the acted event from the executor symbols; a hold directive is not retired', async () => {
    const db = makeDb();
    const diag = await run(db, { executorResult: SWAP_AMD_FOR_KO });
    expect(diag).toMatchObject({ heard: 1, acted: 1, noMatch: 0, retired: 0 });
    const call = stored(db, P('calls', CALL));
    expect(call.outcome).toEqual({ actedEvalId: EVAL });
    expect(events(db)[`${CALL}:acted:${EVAL}`]).toMatchObject({ kind: 'acted', text: 'The agent exited KO for AMD at the 11:00 check', evidence: { evalId: EVAL, promptBuiltAt: PROMPT_AT } });
    expect(stored(db, `agentBattles/${BATTLE_ID}`).directive).toEqual(callSlot()); // a hold stays until its lifetime
  });

  it('ACTED on a go directive RETIRES it (compare-and-clear on the fresh parent); a newer slot is never touched', async () => {
    const goSlot = callSlot({ kind: 'call_go', answerId: `${CALL}:answer:go_now:` });
    const db = makeDb({ battle: makeTickBattle({ directive: goSlot, chatExchanges: [exchangeFor(goSlot)] }), calls: { [CALL]: answered(CALL, { defaultAction: 'hold' }, { answer: 'go_now' }) } });
    expect(await run(db, { executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ acted: 1, retired: 1 });
    expect(stored(db, `agentBattles/${BATTLE_ID}`).directive).toBeNull();
    // The same, but a newer (chat) slot replaced it meanwhile: the slot stays.
    const newer = { text: 'x', expiry: 'end_of_battle', directiveThreadId: 'thread-newer', createdAt: 'c' };
    const db2 = makeDb({ battle: makeTickBattle({ directive: newer, chatExchanges: [exchangeFor(goSlot)] }), calls: { [CALL]: answered(CALL, { defaultAction: 'hold' }, { answer: 'go_now' }) } });
    expect(await run(db2, { executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ acted: 1, retired: 0 });
    expect(stored(db2, `agentBattles/${BATTLE_ID}`).directive).toEqual(newer);
  });

  it('NO MATCHING TRADE only with a present, parsed result that misses the affected leg; a null result writes nothing beyond heard', async () => {
    const db = makeDb();
    expect(await run(db, { executorResult: { symbolOut: 'PG', symbolIn: 'JPM', tier: 'support', slotIndex: 1 } })).toMatchObject({ heard: 1, acted: 0, noMatch: 1 });
    expect(events(db)[`${CALL}:no_match:${EVAL}`]).toMatchObject({ kind: 'no_matching_trade', text: 'No matching trade recorded at the 11:00 check' });
    expect(stored(db, P('calls', CALL)).outcome).toBeNull();
    const db2 = makeDb();
    expect(await run(db2, { executorResult: null })).toMatchObject({ heard: 1, acted: 0, noMatch: 0 });
    expect(Object.keys(events(db2))).toEqual([`${CALL}:heard:${EVAL}`]);
  });

  it('scope: a call that HIT in this same phase is still reconciled (flippedIds); one that hit earlier is post-terminal — 1b', async () => {
    const db = makeDb({ calls: { [CALL]: answered(CALL, { state: 'hit', stateSource: 'check' }) } });
    expect(await run(db, { flippedIds: new Set([CALL]), executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ heard: 1, acted: 1 });
    const db2 = makeDb({ calls: { [CALL]: answered(CALL, { state: 'hit', stateSource: 'check' }) } });
    expect(await run(db2, { executorResult: SWAP_AMD_FOR_KO })).toMatchObject({ scanned: 1, heard: 0, acted: 0, skipped: { post_terminal: 1 } });
  });

  it('a competing write between the reads and the commit re-runs the body: one stamp, one event', async () => {
    const db = makeDb();
    let injected = false;
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt === 1 && !injected) { injected = true; await db.doc(P('calls', CALL)).update({ said: 'moved' }); }
    };
    expect(await run(db)).toMatchObject({ heard: 1 });
    expect(db.__txAttempts).toBe(2);
    expect(Object.keys(events(db))).toEqual([`${CALL}:heard:${EVAL}`]);
  });

  it('a transaction that outlasts its ceiling is UNCONFIRMED, never failed, never a second write; past the deadline nothing starts', async () => {
    vi.useRealTimers();
    const db = makeDb();
    db.__hooks.beforeCommit = () => new Promise((r) => setTimeout(r, 1_000));
    const diag = await runHeardPhase(ctxOn(), { db, battleId: BATTLE_ID, evalId: EVAL, promptBuiltAt: PROMPT_AT, heard: HEARD, executorResult: null, deadlineMs: Date.now() + 150 });
    expect(diag.unconfirmed + (diag.stopped === 'deadline' ? 1 : 0)).toBeGreaterThan(0);
    expect(diag.failed).toBe(0);
    await new Promise((r) => setTimeout(r, 1_200));
    const db2 = makeDb();
    expect(await runHeardPhase(ctxOn(), { db: db2, battleId: BATTLE_ID, evalId: EVAL, promptBuiltAt: PROMPT_AT, heard: HEARD, executorResult: null, deadlineMs: Date.now() - 1 })).toMatchObject({ stopped: 'deadline' });
    expect(touches(db2).writes).toBe(0);
  });
});

describe('the events the Build 0 phase creates inside its transactions at resolved on (spec §10, §11)', () => {
  const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
  const committedBattle = (over = {}) => makeTickBattle({ cronState: { ...makeTickBattle().cronState, evalSeq: 1 }, directive: callSlot(), chatExchanges: [exchangeFor(callSlot())], ...over });
  const candidateOf = () => buildMintCandidate({
    battleId: BATTLE_ID, evalId: EVAL, evalSeq: 1, mintedAtMs: NOW + 20_000, raw: makeDeclarations(), universe: UNIVERSE,
    observation: makeObservation(), promptBuiltAt: PROMPT_AT, tickId: `${BATTLE_ID}:1`, battle: committedBattle(),
  });
  const far = () => Date.now() + 5_000;

  it("publication creates the `declared` event in the SAME transaction, with promptDirectiveThreadId ONLY from an unsuppressed heard — and the inclusion line, never 'In response to'", async () => {
    const db = makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: committedBattle() } });
    const candidate = candidateOf();
    const res = await publishDeclarations({ db, battleId: BATTLE_ID, candidate, evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, events: { enabled: true, nowMs: NOW + 20_000, promptBuiltAt: PROMPT_AT, promptDirectiveThreadId: THREAD, promptDirectiveText: callSlot().text } });
    expect(res.wire).toBe('written');
    const ev = events(db)[`${EVAL}:declared`];
    expect(ev).toMatchObject({ kind: 'declared', at: NOW + 20_000, callIds: candidate.calls.map((c) => c.callId), promptDirectiveThreadId: THREAD, evidence: { evalId: EVAL, promptBuiltAt: PROMPT_AT } });
    expect(ev.text).toMatch(/^Called: /);
    expect(ev.text).toContain("Directive in this check's prompt: Hold off on the AMD entry until today's close.");
    expect(ev.text).not.toMatch(/In response to/);
    // A suppressed stamp or no stamp: no promptDirectiveThreadId, no inclusion line.
    const db2 = makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: committedBattle() } });
    await publishDeclarations({ db: db2, battleId: BATTLE_ID, candidate: candidateOf(), evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, events: { enabled: true, nowMs: NOW + 20_000, promptBuiltAt: PROMPT_AT, promptDirectiveThreadId: null, promptDirectiveText: null } });
    expect(events(db2)[`${EVAL}:declared`]).not.toHaveProperty('promptDirectiveThreadId');
    expect(events(db2)[`${EVAL}:declared`].text).not.toContain('Directive in this check');
  });

  it('a publication that ABORTS leaves no declared event (atomic); an identical retry creates no second one; at shadow (events null) none at all', async () => {
    const terminal = makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: committedBattle({ status: 'completed' }) } });
    const res = await publishDeclarations({ db: terminal, battleId: BATTLE_ID, candidate: candidateOf(), evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, events: { enabled: true, nowMs: NOW } });
    expect(res.phaseResult).toBe('parent_terminal');
    expect(events(terminal)).toEqual({});
    const db = makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: committedBattle() } });
    const candidate = candidateOf();
    const ev = { enabled: true, nowMs: NOW + 20_000, promptBuiltAt: PROMPT_AT, promptDirectiveThreadId: null, promptDirectiveText: null };
    await publishDeclarations({ db, battleId: BATTLE_ID, candidate, evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, events: ev });
    const again = await publishDeclarations({ db, battleId: BATTLE_ID, candidate, evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500, events: ev });
    expect(again.phaseResult).toBe('idempotent');
    expect(Object.keys(events(db))).toEqual([`${EVAL}:declared`]);
    const shadow = makeCallsFirestore({ docs: { [`agentBattles/${BATTLE_ID}`]: committedBattle() } });
    await publishDeclarations({ db: shadow, battleId: BATTLE_ID, candidate: candidateOf(), evalSeq: 1, txDeadlineMs: far(), rereadDeadlineMs: far() + 500 });
    expect(events(shadow)).toEqual({});
  });

  it('the flip creates the `expired` event in ITS transaction at on — with the answer-expired line when a never-heard directive\'s lifetime ended before this observation; nothing at shadow', async () => {
    const lifetimeOver = callSlot({ expiresAtMs: NOW - 10 });
    const expired = answered(CALL, { horizon: { phrase: 'explicit', expiresAt: NOW - 5, basis: 'explicit' } });
    const battle = makeTickBattle({ directive: null, chatExchanges: [exchangeFor(lifetimeOver)] });
    const db = makeDb({ battle, calls: { [CALL]: expired } });
    const ctx = { ...createCallsContext({ mode: 'on', handlerStartMs: NOW }), exit: 'model_result', evalIdentity: { evalId: EVAL, evalSeq: 7 }, observation: makeObservation({ observedAtMs: NOW }) };
    const res = await runCallFlips(ctx, { db, battle: stored(db, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: { enabled: true, promptBuiltAt: PROMPT_AT, nowMs: NOW } });
    expect(res.diag.expired).toBe(1);
    expect([...res.flippedIds]).toEqual([CALL]);
    expect(stored(db, P('calls', CALL)).state).toBe('expired_unresolved');
    expect(events(db)[`${CALL}:expired`]).toMatchObject({ kind: 'expired', at: NOW, callIds: [CALL], text: 'Expired — a check observed it past its deadline · Answer expired before the 11:00 check', evidence: { evalId: EVAL, promptBuiltAt: PROMPT_AT } });
    // Heard before: no answer-expired line.
    const db2 = makeDb({ battle, calls: { [CALL]: answered(CALL, { horizon: { phrase: 'explicit', expiresAt: NOW - 5, basis: 'explicit' } }, { heardEvalId: 'eval_002' }) } });
    await runCallFlips({ ...ctx }, { db: db2, battle: stored(db2, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: { enabled: true, promptBuiltAt: PROMPT_AT, nowMs: NOW } });
    expect(events(db2)[`${CALL}:expired`].text).toBe('Expired — a check observed it past its deadline');
    // Shadow: the transition, no event.
    const db3 = makeDb({ battle, calls: { [CALL]: expired } });
    await runCallFlips({ ...ctx, mode: 'shadow' }, { db: db3, battle: stored(db3, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: null });
    expect(stored(db3, P('calls', CALL)).state).toBe('expired_unresolved');
    expect(events(db3)).toEqual({});
  });

  it('the flip binds the SELECTED pick: an option that was not the selection no longer counts as the called trade (Build 0 counted any option)', async () => {
    const pickSlot = callSlot({ callId: PICK, kind: 'call_pick', answerId: `${PICK}:answer:pick:JPM`, action: { direction: null, symbol: null, slot: 'support', pickSymbol: 'JPM', swapOut: 'KO' } });
    const pick = shot(PICK, { kind: 'pick', symbol: null, direction: null, counterpart: null, swapOut: 'KO', options: [{ symbol: 'AMD' }, { symbol: 'JPM' }], condition: null, defaultAction: null, horizon: { phrase: 'next_check', expiresAt: NOW + 900_000, basis: 'next_check' }, playerResponse: { answer: 'pick', kind: 'directive', directiveThreadId: THREAD, callId: PICK, filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null }, directiveThreadId: THREAD });
    const ctxFor = (executorResult) => ({ ...createCallsContext({ mode: 'on', handlerStartMs: NOW }), exit: 'model_result', evalIdentity: { evalId: EVAL, evalSeq: 7 }, observation: makeObservation({ observedAtMs: NOW }), executorResult });
    const battle = makeTickBattle({ directive: pickSlot, chatExchanges: [exchangeFor(pickSlot)] });
    const amdIn = makeDb({ battle, calls: { [PICK]: pick } });
    const r1 = await runCallFlips(ctxFor({ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 }), { db: amdIn, battle: stored(amdIn, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: null });
    expect(r1.diag.acted).toBe(0);
    expect(stored(amdIn, P('calls', PICK)).outcome).toBeNull();
    const jpmIn = makeDb({ battle, calls: { [PICK]: pick } });
    const r2 = await runCallFlips(ctxFor({ symbolOut: 'KO', symbolIn: 'JPM', tier: 'support', slotIndex: 0 }), { db: jpmIn, battle: stored(jpmIn, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: null });
    expect(r2.diag.acted).toBe(1);
    expect(stored(jpmIn, P('calls', PICK)).outcome).toEqual({ actedEvalId: EVAL });
    // An UNANSWERED pick keeps Build 0's rule: any option counts.
    const unanswered = makeDb({ battle: makeTickBattle({ directive: null }), calls: { [PICK]: { ...pick, playerResponse: null, directiveThreadId: null } } });
    const r3 = await runCallFlips(ctxFor({ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 }), { db: unanswered, battle: stored(unanswered, `agentBattles/${BATTLE_ID}`), deadlineMs: Date.now() + 5_000, events: null });
    expect(r3.diag.acted).toBe(1);
  });

  it('runModelCallsPhase at on with a SUPPRESSED heard stamp: the declared event carries NO promptDirectiveThreadId and no inclusion line; the heard phase stops at "suppressed"', async () => {
    const db = makeDb({ battle: committedBattle() });
    const ctx = { ...ctxOn(), evalIdentity: { evalId: EVAL, evalSeq: 1 }, observation: makeObservation(), executorResult: null, universe: UNIVERSE, declarations: { raw: makeDeclarations(), phase: 'expected', validation: { removed: [] } } };
    const suppressed = { directiveThreadId: THREAD, suppressed: 'mode_not_enforce' };
    const res = await runModelCallsPhase(ctx, { db, battle: stored(db, `agentBattles/${BATTLE_ID}`), timeBudgetMs: 290_000, promptBuiltAt: PROMPT_AT, tickId: null, flips: runCallFlips, heardWriter: runHeardPhase, heard: suppressed });
    expect(res.wire).toBe('written');
    const ev = events(db)[`${EVAL}:declared`];
    expect(ev).toBeDefined();
    expect(ev).not.toHaveProperty('promptDirectiveThreadId');
    expect(ev.text).not.toContain("Directive in this check's prompt");
    expect(res.heard).toMatchObject({ stopped: 'suppressed' });
    // The unsuppressed twin carries the inclusion fact.
    const db2 = makeDb({ battle: committedBattle() });
    const res2 = await runModelCallsPhase({ ...ctx }, { db: db2, battle: stored(db2, `agentBattles/${BATTLE_ID}`), timeBudgetMs: 290_000, promptBuiltAt: PROMPT_AT, tickId: null, flips: runCallFlips, heardWriter: runHeardPhase, heard: HEARD });
    expect(res2.wire).toBe('written');
    expect(events(db2)[`${EVAL}:declared`]).toMatchObject({ promptDirectiveThreadId: THREAD });
    expect(events(db2)[`${EVAL}:declared`].text).toContain("Directive in this check's prompt: Hold off on the AMD entry until today's close.");
  });

  it('runModelCallsPhase at on: the flips, then the heard phase under the same deadline; the diag carries heard; at shadow no heard key, no heard writer call', async () => {
    const db = makeDb({ battle: committedBattle() });
    const ctx = { ...ctxOn(), declarations: null, observation: makeObservation({ observedAtMs: NOW }), executorResult: SWAP_AMD_FOR_KO };
    const writer = vi.fn(runHeardPhase);
    const res = await runModelCallsPhase(ctx, { db, battle: stored(db, `agentBattles/${BATTLE_ID}`), timeBudgetMs: 290_000, promptBuiltAt: PROMPT_AT, tickId: null, flips: runCallFlips, heardWriter: writer, heard: HEARD });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(res.heard).toMatchObject({ thread: THREAD, heard: 1, acted: 1 });
    expect(stored(db, `agentBattles/${BATTLE_ID}`).cronState.callsDiag.heard).toMatchObject({ heard: 1, acted: 1 });
    const shadowDb = makeDb({ battle: committedBattle() });
    const writer2 = vi.fn(runHeardPhase);
    const res2 = await runModelCallsPhase({ ...ctx, mode: 'shadow' }, { db: shadowDb, battle: stored(shadowDb, `agentBattles/${BATTLE_ID}`), timeBudgetMs: 290_000, promptBuiltAt: PROMPT_AT, tickId: null, flips: runCallFlips, heardWriter: writer2, heard: HEARD });
    expect(writer2).not.toHaveBeenCalled();
    expect(res2.heard).toBeNull();
    expect(stored(shadowDb, `agentBattles/${BATTLE_ID}`).cronState.callsDiag).not.toHaveProperty('heard');
    expect(events(shadowDb)).toEqual({});
  });
});
