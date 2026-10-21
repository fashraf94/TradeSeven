// api/_utils/callRecords/retire.test.js
//
// Cockpit Build 2b — RETIRE ON EXIT (contract Amendment D, D-6; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-7, §11 "D-6"): each book reason; a
// non-book failure retires nothing; compare-and-clear against a newer slot;
// the event's id and its idempotence; the trade lookup; a timeout or an error
// leaves the slot and does not throw; the in-memory directive is dropped only
// after a commit. (The cron hook — the directive gone from the prompt — is the
// end-to-end row in api/cron/agent-evaluate.tickStamps.callsOn.test.js.)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retireLeftBook, planRetire, findMovingTrade, movedSymbolOf, RETIRE_TX_MS } from './retire.js';
import { makeCallsFirestore, stored, storedUnder } from '../__fixtures__/callsFirestore.js';
import { makeTickBattle } from '../__fixtures__/tickStampsHarness.js';
import { CallsAbort } from './publish.js';

const BATTLE_ID = 'battle-tick-1';
const NOW = Date.parse('2026-10-15T17:17:00.000Z'); // 13:17 ET
const FILED = '2026-10-15T16:37:00.000Z';
const THREAD = 'thread-retire-1';
const B = `agentBattles/${BATTLE_ID}`;
const callPath = (id) => `${B}/calls/${id}`;

const exitCall = (over = {}) => ({
  callId: `${BATTLE_ID}:eval_004:call:0`, kind: 'called_shot', symbol: 'XOM', direction: 'exit', slot: 'star', counterpart: null,
  condition: { side: 'below', level: 110 }, horizon: { phrase: 'this_session', basis: 'this_session', expiresAt: NOW + 3 * 3_600_000 },
  defaultAction: 'hold', state: 'open', playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: THREAD, filedAt: FILED, heardEvalId: null },
  directiveThreadId: THREAD, ...over,
});
const slotFor = (call, over = {}) => ({
  text: "If XOM below $110.00 by today's close, go ahead and exit.", expiry: 'until_ms', directiveThreadId: THREAD, createdAt: FILED,
  family: 'call', expiresAtMs: call.horizon.expiresAt, basis: 'this_session', callId: call.callId, kind: 'call_go',
  action: { direction: 'exit', symbol: call.symbol, slot: call.slot }, answerId: `${call.callId}:answer:go_now:`, filedAt: FILED, textVersion: 'callActions.v1',
  ...over,
});
/** The tick book (XOM not in it — it left); the battle's trade log has the row that took it out. */
const battleWith = (slot, over = {}) => makeTickBattle({
  directive: slot,
  trades: [
    { symbolOut: 'XOM', symbolIn: 'TSLA', swappedOutAt: '2026-10-15T15:00:00.000Z', source: 'haiku' }, // before the filing: never the one
    { symbolOut: 'XOM', symbolIn: 'NVDA', swappedOutAt: '2026-10-15T17:02:00.000Z', source: 'risk_manager' },
  ],
  ...over,
});
function setup({ call = exitCall(), slot = slotFor(call), battle = battleWith(slot), extra = {} } = {}) {
  const db = makeCallsFirestore({ docs: { [B]: battle, [callPath(call.callId)]: call, ...extra } });
  const memory = { ...battle, id: BATTLE_ID };
  return { db, call, slot, memory, battleRef: db.collection('agentBattles').doc(BATTLE_ID) };
}
const run = ({ db, memory, battleRef }, over = {}) => retireLeftBook({ db, battleRef, battle: memory, nowMs: NOW, evalId: null, promptBuiltAt: null, deadlineMs: Date.now() + 5_000, ...over });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('the book reasons (D-6)', () => {
  it('symbol_not_held — an exit whose stock left the book: the slot cleared, the retired event written, the in-memory directive dropped', async () => {
    const env = setup();
    const res = await run(env);
    expect(res).toEqual({ retired: true, reason: 'symbol_not_held' });
    expect(stored(env.db, B).directive).toBeNull();
    expect(env.memory.directive).toBeNull();
    const events = storedUnder(env.db, `${B}/callEvents`);
    expect(Object.keys(events)).toEqual([`${THREAD}:retired`]);
    expect(events[`${THREAD}:retired`]).toMatchObject({
      kind: 'retired', at: NOW, callIds: [env.call.callId],
      text: 'XOM left the book at the 13:17 check · command retired.',
      evidence: { evalId: null, promptBuiltAt: null, checkLabel: 'the 13:17 check' },
      symbol: 'XOM', reason: 'symbol_not_held',
      trade: { symbolOut: 'XOM', symbolIn: 'NVDA', at: '2026-10-15T17:02:00.000Z', source: 'risk_manager' },
    });
  });

  it('counterpart_not_held — an entry whose counterpart left its slot tier', async () => {
    const call = exitCall({ symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'XOM', defaultAction: 'act', playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: THREAD, filedAt: FILED } });
    const slot = slotFor(call, { kind: 'call_hold', text: "Hold off on the AMD entry until today's close.", action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'XOM' }, answerId: `${call.callId}:answer:hold:` });
    const env = setup({ call, slot });
    expect(await run(env)).toEqual({ retired: true, reason: 'counterpart_not_held' });
    expect(storedUnder(env.db, `${B}/callEvents`)[`${THREAD}:retired`]).toMatchObject({ symbol: 'XOM', text: 'XOM left the book at the 13:17 check · command retired.' });
  });

  it('swap_out_not_held — a pick whose swap-out left the book', async () => {
    const call = { callId: `${BATTLE_ID}:eval_004:call:2`, kind: 'pick', symbol: null, direction: null, slot: 'support', swapOut: 'XOM', options: [{ symbol: 'AMD' }, { symbol: 'JPM' }], horizon: { basis: 'next_check', expiresAt: NOW + 900_000 }, state: 'open', playerResponse: { answer: 'pick', kind: 'directive', directiveThreadId: THREAD, filedAt: FILED } };
    const slot = slotFor(call, { kind: 'call_pick', text: 'Bring in AMD for XOM at the next check.', action: { direction: null, symbol: null, slot: 'support', pickSymbol: 'AMD', swapOut: 'XOM' }, answerId: `${call.callId}:answer:pick:AMD` });
    const env = setup({ call, slot });
    expect(await run(env)).toEqual({ retired: true, reason: 'swap_out_not_held' });
  });

  it('pick_already_held — a CHOSEN name that came into the book another way; the trade is the one that brought it IN', async () => {
    const call = exitCall({ symbol: 'TSLA', playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: THREAD, filedAt: FILED } });
    const slot = slotFor(call, { text: "If TSLA below $110.00 by today's close, go ahead and exit for MSFT.", action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'MSFT' }, answerId: `${call.callId}:answer:go_now:MSFT`, textVersion: 'callActions.v2' });
    const battle = battleWith(slot, { trades: [{ symbolOut: 'AMZN', symbolIn: 'MSFT', swappedOutAt: '2026-10-15T17:00:00.000Z', source: 'haiku' }] });
    const env = setup({ call, slot, battle });
    expect(await run(env)).toEqual({ retired: true, reason: 'pick_already_held' });
    expect(storedUnder(env.db, `${B}/callEvents`)[`${THREAD}:retired`]).toMatchObject({
      symbol: 'MSFT', text: 'MSFT came into the book another way at the 13:17 check · command retired.',
      trade: { symbolOut: 'AMZN', symbolIn: 'MSFT', at: '2026-10-15T17:00:00.000Z', source: 'haiku' },
    });
  });
});

describe('what retires nothing', () => {
  it('an eligible command (its stock still held) — nothing written', async () => {
    const call = exitCall({ symbol: 'TSLA' });
    const env = setup({ call, slot: slotFor(call) });
    expect(await run(env)).toEqual({ retired: false, reason: 'eligible' });
    expect(stored(env.db, B).directive).toEqual(env.slot);
    expect(storedUnder(env.db, `${B}/callEvents`)).toEqual({});
    expect(env.memory.directive).toEqual(env.slot);
  });

  it('a non-book failure (a chosen name locked; the agent\'s counterpart gone off the bench) — nothing retired', async () => {
    const call = exitCall({ symbol: 'TSLA' });
    const lockedSlot = slotFor(call, { action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'AMD' } });
    const lockedBattle = battleWith(lockedSlot);
    lockedBattle.portfolio = { ...lockedBattle.portfolio, bench: { stocks: [{ symbol: 'AMD', isCrypto: false, cooldownUntil: new Date(NOW + 3_600_000).toISOString() }], crypto: null } };
    const env = setup({ call, slot: lockedSlot, battle: lockedBattle });
    expect(await run(env)).toEqual({ retired: false, reason: 'not_a_book_reason:pick_locked' });
    const cpCall = exitCall({ symbol: 'TSLA', counterpart: 'GONE' });
    const env2 = setup({ call: cpCall, slot: slotFor(cpCall, { action: { direction: 'exit', symbol: 'TSLA', slot: 'star', counterpart: 'GONE' } }) });
    expect(await run(env2)).toEqual({ retired: false, reason: 'not_a_book_reason:counterpart_unavailable' });
    expect(storedUnder(env2.db, `${B}/callEvents`)).toEqual({});
    // Review L7 S5: a chosen name that left the bench (on no bench, no hot bench, not in the book) is not a book
    // reason either (D-6) — the command stands; the filing test refuses it at the next filing, not the retire step.
    const goneCall = exitCall({ symbol: 'TSLA' });
    const goneSlot = slotFor(goneCall, { action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'GONE' } });
    const env3 = setup({ call: goneCall, slot: goneSlot, battle: battleWith(goneSlot) });
    expect(await run(env3)).toEqual({ retired: false, reason: 'not_a_book_reason:pick_not_on_bench' });
    expect(stored(env3.db, B).directive).toEqual(goneSlot);
    expect(env3.memory.directive).toEqual(goneSlot);
    expect(storedUnder(env3.db, `${B}/callEvents`)).toEqual({});
  });

  it('COMPARE-AND-CLEAR: a newer slot (another thread filed meanwhile) is never touched', async () => {
    const env = setup();
    const newer = { ...env.slot, directiveThreadId: 'thread-newer', answerId: 'other' };
    env.db.__hooks.afterTxBody = null;
    // The fresh parent holds a newer slot; the in-memory battle still holds the old one.
    const db2 = makeCallsFirestore({ docs: { [B]: battleWith(newer), [callPath(env.call.callId)]: env.call } });
    const res = await run({ db: db2, memory: env.memory, battleRef: db2.collection('agentBattles').doc(BATTLE_ID) });
    expect(res).toEqual({ retired: false, reason: 'slot_changed' });
    expect(stored(db2, B).directive).toEqual(newer);
    expect(env.memory.directive).toEqual(env.slot);
  });

  it('an ordinary (chat) directive, or no directive, is not the step\'s — returned before any read', async () => {
    const env = setup();
    env.memory.directive = { text: 'Stay patient.', directiveThreadId: 't-chat', expiry: 'until_tomorrow' };
    expect(await run(env)).toEqual({ retired: false, reason: 'not_call_family' });
    env.memory.directive = null;
    expect(await run(env)).toEqual({ retired: false, reason: 'not_call_family' });
    expect(env.db.__access.reads).toEqual([]);
  });
});

describe('idempotence, failure and the deadline', () => {
  it('the event id is `${directiveThreadId}:retired`; a second run after the commit finds no slot and writes nothing', async () => {
    const env = setup();
    await run(env);
    const memory2 = { ...battleWith(env.slot), id: BATTLE_ID };
    expect(await run({ ...env, memory: memory2 })).toEqual({ retired: false, reason: 'slot_not_call_family' });
    expect(Object.keys(storedUnder(env.db, `${B}/callEvents`))).toEqual([`${THREAD}:retired`]);
  });

  it('an event already on record (a create-once collision) fails the transaction: the slot is left, nothing thrown', async () => {
    const env = setup({ extra: { [`${B}/callEvents/${THREAD}:retired`]: { kind: 'retired' } } });
    const res = await run(env);
    expect(res).toEqual({ retired: false, reason: 'failed' });
    expect(stored(env.db, B).directive).toEqual(env.slot);
    expect(env.memory.directive).toEqual(env.slot);
  });

  it('a timeout leaves the slot exactly as it was, is unconfirmed, never throws — and never runs past its ceiling', async () => {
    const env = setup();
    env.db.runTransaction = () => new Promise(() => {}); // never settles
    const started = Date.now();
    // The step keeps a 200 ms reserve for settling (review CB1-2): 400 ms leaves the transaction 200.
    const res = await run(env, { deadlineMs: Date.now() + 400 });
    expect(res).toEqual({ retired: false, reason: 'unconfirmed' });
    expect(Date.now() - started).toBeLessThan(RETIRE_TX_MS + 500);
    expect(stored(env.db, B).directive).toEqual(env.slot);
    expect(env.memory.directive).toEqual(env.slot);
  });

  it('a thrown read is a failure, logged, never thrown; a spent deadline starts nothing', async () => {
    const env = setup();
    env.db.runTransaction = async () => { throw new Error('firestore down'); };
    expect(await run(env)).toEqual({ retired: false, reason: 'failed' });
    expect(console.error).toHaveBeenCalled();
    const env2 = setup();
    expect(await run(env2, { deadlineMs: Date.now() - 1 })).toEqual({ retired: false, reason: 'not_started' });
    expect(env2.db.__access.reads).toEqual([]);
  });

  it('review CB1-2: a commit that lands after the transaction\'s budget but inside the reserve settles as RETIRED — the in-memory slot is dropped', async () => {
    const env = setup();
    env.db.__hooks.beforeCommit = async () => { await new Promise((r) => setTimeout(r, 700)); };
    const res = await run(env, { deadlineMs: Date.now() + RETIRE_TX_MS });
    expect(res).toEqual({ retired: true, reason: 'symbol_not_held' });
    expect(env.memory.directive).toBeNull();
    expect(stored(env.db, B).directive).toBeNull();
  });

  it('review CB1-2: a commit still in flight past the WHOLE ceiling stays unconfirmed (the heard pass\'s precedent): logged, never thrown', async () => {
    const env = setup();
    env.db.__hooks.beforeCommit = async () => { await new Promise((r) => setTimeout(r, 1_200)); };
    const res = await run(env, { deadlineMs: Date.now() + RETIRE_TX_MS });
    expect(res).toEqual({ retired: false, reason: 'unconfirmed' });
    expect(env.memory.directive).toEqual(env.slot);
    await new Promise((r) => setTimeout(r, 600));
  });

  it('review L7 S6b: a transaction that ends in a deadline abort is settled by ONE read of the retired event — landed → retired (the in-memory slot dropped); not landed → unconfirmed', async () => {
    const landed = setup({ extra: { [`${B}/callEvents/${THREAD}:retired`]: { kind: 'retired', callIds: [exitCall().callId] } } });
    landed.db.runTransaction = async () => { throw new CallsAbort('deadline'); };
    expect(await run(landed)).toEqual({ retired: true, reason: 'landed_late' });
    expect(landed.memory.directive).toBeNull();
    const missing = setup();
    missing.db.runTransaction = async () => { throw new CallsAbort('deadline'); };
    expect(await run(missing)).toEqual({ retired: false, reason: 'unconfirmed' });
    expect(missing.memory.directive).toEqual(missing.slot);
  });

  it('the ceiling is the heard pass\'s 800 ms', () => {
    expect(RETIRE_TX_MS).toBe(800);
  });
});

describe('the pure parts', () => {
  it('findMovingTrade: the NEWEST row after the filing whose symbolOut (symbolIn for pick_already_held) is the symbol; null when none', () => {
    const trades = [
      { symbolOut: 'XOM', symbolIn: 'A', swappedOutAt: '2026-10-15T15:00:00.000Z', source: 's1' },
      { symbolOut: 'XOM', symbolIn: 'B', swappedOutAt: '2026-10-15T16:50:00.000Z', source: 's2' },
      { symbolOut: 'XOM', symbolIn: 'C', swappedOutAt: '2026-10-15T17:05:00.000Z' },
      { symbolOut: 'Q', symbolIn: 'DHR', swappedOutAt: '2026-10-15T17:06:00.000Z', source: 's4' },
    ];
    expect(findMovingTrade(trades, { symbol: 'XOM', reason: 'symbol_not_held', filedAt: FILED })).toEqual({ symbolOut: 'XOM', symbolIn: 'C', at: '2026-10-15T17:05:00.000Z', source: null });
    expect(findMovingTrade(trades, { symbol: 'DHR', reason: 'pick_already_held', filedAt: FILED })).toEqual({ symbolOut: 'Q', symbolIn: 'DHR', at: '2026-10-15T17:06:00.000Z', source: 's4' });
    expect(findMovingTrade(trades, { symbol: 'XOM', reason: 'symbol_not_held', filedAt: '2026-10-15T18:00:00.000Z' })).toBeNull();
    expect(findMovingTrade([], { symbol: 'XOM', reason: 'symbol_not_held', filedAt: FILED })).toBeNull();
    expect(findMovingTrade(null, { symbol: 'XOM', reason: 'symbol_not_held', filedAt: FILED })).toBeNull();
  });

  it('movedSymbolOf names the symbol per reason; an unknown reason names none', () => {
    const slot = { action: { symbol: 'S', counterpart: 'C', swapOut: 'W', pickSymbol: 'P' } };
    expect(['symbol_not_held', 'counterpart_not_held', 'swap_out_not_held', 'pick_already_held', 'other'].map((r) => movedSymbolOf(slot, r))).toEqual(['S', 'C', 'W', 'P', null]);
  });

  it('planRetire reads the FRESH parent, never the in-memory one', () => {
    const call = exitCall();
    const slot = slotFor(call);
    const freshHeld = makeTickBattle({ directive: slot, portfolio: { ...makeTickBattle().portfolio, star: [{ symbol: 'XOM', isCrypto: false }] } });
    expect(planRetire({ memorySlot: slot, freshParent: freshHeld, call, atMs: NOW })).toEqual({ retire: false, reason: 'eligible' });
    expect(planRetire({ memorySlot: slot, freshParent: battleWith(slot), call: null, atMs: NOW })).toEqual({ retire: false, reason: 'call_missing' });
  });
});
