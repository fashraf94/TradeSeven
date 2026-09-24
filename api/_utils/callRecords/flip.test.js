// api/_utils/callRecords/flip.test.js
//
// Cockpit Build 0 — ENCOUNTER FLIPS (spec V1.3 §3.8; §3.12 row 9 "flips", the
// non-model half of row 6 "budget"). Driven against the calls store fixture:
// the ordered `calls` query with cursors, the optimistic per-call transaction,
// create-once receipts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  runCallFlips, runExitCallsHook, decideFlip, matchesWholeTrade, planFlip, cursorOf, resetFlipIndexMemo, flipIndexState,
  FLIP_PAGE_SIZE, FLIP_QUERY, INDEX_RECHECK_MS, NON_MODEL_FLIP_EXITS,
} from './flip.js';
import { buildReceipt, receiptPathOf } from './receipt.js';
import { buildMintCandidate, MUTABLE_CALL_FIELDS } from './candidate.js';
import { createCallsContext } from './mode.js';
import { TAIL_RESERVE_MS, NON_MODEL_PHASE_MS } from './publish.js';
import { FROZEN_NOW, makeTickBattle, makeDeclarations, makeObservation, makeExecutorResult } from '../__fixtures__/tickStampsHarness.js';
import { makeCallsDb, storedDoc, storedCollection, callsTouches, MAX_CALLS_QUERIES } from '../__fixtures__/callRecordsStore.js';

const TIME_BUDGET_MS = 290_000;
const BATTLE_ID = 'battle-tick-1';
const NOW = Date.parse(FROZEN_NOW);
// An earlier check, 50 minutes ago (14:10 UTC — deliberately off the :00/:15/:30/:45
// slot grid, so a next_check horizon lands on the following slot, 14:15).
const EARLIER_MINT = NOW - 50 * 60_000;
const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
/** The harness block with BOTH shots on this_session, so neither has expired by NOW. */
const liveDeclarations = () => {
  const [amd, tsla] = makeDeclarations().calledShots;
  return makeDeclarations({ calledShots: [amd, { ...tsla, horizonPhrase: 'this_session' }] });
};

/** Calls minted by an EARLIER check (eval_000), stored as publication would store them. */
function earlierCalls(raw = liveDeclarations(), { evalId = 'eval_000', mintedAtMs = EARLIER_MINT } = {}) {
  return buildMintCandidate({
    battleId: BATTLE_ID, evalId, evalSeq: 0, mintedAtMs, raw, universe: UNIVERSE,
    observation: makeObservation({ observedAtMs: mintedAtMs - 5_000 }), promptBuiltAt: new Date(mintedAtMs - 5_000).toISOString(),
    tickId: null, battle: makeTickBattle(),
  }).calls.map((c) => JSON.parse(JSON.stringify(c)));
}
const seedOf = (calls) => ({ calls: Object.fromEntries(calls.map((c) => [c.callId, c])) });
const amdShot = () => earlierCalls()[0];   // entry AMD above 163.5, support, counterpart KO, this_session
const tslaShot = () => earlierCalls()[1];  // exit TSLA below 240, star, this_session (act → confirmation)

function ctxFor({ exit = 'model_result', observation = makeObservation(), evalId = 'eval_001', executorResult = null, mode = 'shadow', handlerStartMs = NOW - 60_000 } = {}) {
  const ctx = createCallsContext({ mode, handlerStartMs });
  ctx.exit = exit;
  ctx.observation = observation;
  ctx.evalIdentity = evalId ? { evalId, evalSeq: 1 } : null;
  ctx.executorResult = executorResult;
  return ctx;
}
const obsWith = (symbols, observedAtMs = NOW) => makeObservation({ observedAtMs, symbols });
const flipsOf = (db, ctx, over = {}) => runCallFlips(ctx, { db, battle: db.__store.battle, deadlineMs: Date.now() + 5_000, ...over });
const callWrites = (db) => db.__callsAccess.writes.filter((w) => w.path.includes('/calls/'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW + 30_000);
  resetFlipIndexMemo();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
describe('the transition rule (contract §6)', () => {
  const call = () => amdShot();
  it('above: px > level is a hit; px = level is not', () => {
    expect(decideFlip(call(), obsWith({ AMD: { px: 163.51, fetchedAtMs: NOW - 1 } }))).toBe('hit');
    expect(decideFlip(call(), obsWith({ AMD: { px: 163.5, fetchedAtMs: NOW - 1 } }))).toBeNull();
  });
  it('below: px < level is a hit', () => {
    expect(decideFlip(tslaShot(), obsWith({ TSLA: { px: 239.99, fetchedAtMs: NOW - 1 } }))).toBe('hit');
    expect(decideFlip(tslaShot(), obsWith({ TSLA: { px: 240, fetchedAtMs: NOW - 1 } }))).toBeNull();
  });
  it('expiry wins outside the horizon; the exact expiry instant is still inside it', () => {
    const c = call();
    const hot = { AMD: { px: 170, fetchedAtMs: 0 } };
    expect(decideFlip(c, obsWith(hot, c.horizon.expiresAt + 1))).toBe('expired_unresolved');
    expect(decideFlip(c, obsWith(hot, c.horizon.expiresAt))).toBe('hit');
    expect(decideFlip(c, obsWith({}, c.horizon.expiresAt + 1))).toBe('expired_unresolved');
  });
  it('no hit without the symbol in the observation, or with a non-positive quote', () => {
    expect(decideFlip(call(), makeObservation({ omit: ['AMD'] }))).toBeNull();
    expect(decideFlip(call(), obsWith({ AMD: { px: 0, fetchedAtMs: NOW - 1 } }))).toBeNull();
  });
  it('a pick never hits — only expiry resolves it (its next_check slot included: the first check there expires it)', () => {
    const [pick] = earlierCalls({ fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM?' } });
    expect(pick.kind).toBe('pick');
    expect(pick.horizon).toMatchObject({ basis: 'next_check', expiresAt: EARLIER_MINT + 5 * 60_000 }); // the 14:15 slot
    expect(decideFlip(pick, obsWith({ AMD: { px: 999, fetchedAtMs: 0 } }, pick.horizon.expiresAt - 1))).toBeNull();
    expect(decideFlip(pick, obsWith({ AMD: { px: 999, fetchedAtMs: 0 } }, pick.horizon.expiresAt))).toBe('expired_unresolved');
    expect(decideFlip(pick, obsWith({}, pick.horizon.expiresAt + 1))).toBe('expired_unresolved');
  });

  // FOUNDER RULING E-3, as clarified by branch review BR-1: expiresAt is a
  // next_check call's JUDGMENT boundary. An observation at or after it judges
  // the still-open call once — hit if met, else expired_unresolved — and WHICH
  // check judges is decided per call, by the transaction that commits. No
  // battle-level scan clock enters the decision. Other bases are unchanged.
  const nextCheckUnit = () => earlierCalls(makeDeclarations({ calledShots: [{ ...makeDeclarations().calledShots[0], horizonPhrase: 'next_check' }], watching: [] }))[0];

  it('next_check (E-3 / BR-1): at or after the slot the condition is judged from THIS observation — hit if met, else expired; before it, the ordinary rule', () => {
    const nc = nextCheckUnit();
    expect(nc.horizon).toMatchObject({ basis: 'next_check', expiresAt: EARLIER_MINT + 5 * 60_000 });
    const slot = nc.horizon.expiresAt;
    const hot = { AMD: { px: 170, fetchedAtMs: 0 } };   // above 163.5: met
    const cold = { AMD: { px: 160, fetchedAtMs: 0 } };  // not met
    // Exactly at the slot (>=) or after it: hit if met, else expired.
    expect(decideFlip(nc, obsWith(hot, slot))).toBe('hit');
    expect(decideFlip(nc, obsWith(cold, slot))).toBe('expired_unresolved');
    expect(decideFlip(nc, obsWith(hot, slot + 20_000))).toBe('hit');
    expect(decideFlip(nc, obsWith(cold, slot + 20_000))).toBe('expired_unresolved');
    expect(decideFlip(nc, obsWith({}, slot + 20_000))).toBe('expired_unresolved'); // unobserved: not met
    // A first reach long after the slot still judges from its own observation.
    expect(decideFlip(nc, obsWith(hot, slot + 15 * 60_000))).toBe('hit');
    expect(decideFlip(nc, obsWith(cold, slot + 45 * 60_000))).toBe('expired_unresolved');
    // Before the slot, the ordinary rule.
    expect(decideFlip(nc, obsWith(hot, slot - 1))).toBe('hit');
    expect(decideFlip(nc, obsWith(cold, slot - 1))).toBeNull();
  });

  it('no battle clock: a prior scan instant — before, at or after the slot — cannot change a judgment, whatever a caller passes (BR-1)', () => {
    const nc = nextCheckUnit();
    const slot = nc.horizon.expiresAt;
    const obs = obsWith({ AMD: { px: 170, fetchedAtMs: 0 } }, slot + 15 * 60_000);
    for (const priorScanAtMs of [null, slot - 1, slot, slot + 20_000, slot + 15 * 60_000]) {
      expect(decideFlip(nc, obs, { priorScanAtMs })).toBe('hit');
      expect(planFlip(nc, { observation: obs, evalId: 'eval_002', executorResult: null, priorScanAtMs })).toEqual({ next: 'hit', acted: false });
    }
  });

  it('other bases are unchanged (the next_check rule is next_check only): past the expiry → expired even when met; the exact instant is inside', () => {
    const c = amdShot();
    expect(c.horizon.basis).toBe('this_session');
    const hot = { AMD: { px: 170, fetchedAtMs: 0 } };
    const cold = { AMD: { px: 160, fetchedAtMs: 0 } };
    expect(decideFlip(c, obsWith(hot, c.horizon.expiresAt + 1))).toBe('expired_unresolved');
    expect(decideFlip(c, obsWith(cold, c.horizon.expiresAt))).toBeNull(); // not met at the exact instant: still open
    expect(decideFlip(c, obsWith(hot, c.horizon.expiresAt))).toBe('hit');
  });
});

describe('the whole-trade match (R3-4)', () => {
  const entry = () => amdShot();                // AMD in, support, counterpart KO
  const exit = () => ({ ...tslaShot(), counterpart: 'JPM' }); // TSLA out of star for JPM
  const pick = () => earlierCalls({ fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM?' } })[0];

  it('entry: incoming symbol + resolved slot + declared counterpart', () => {
    expect(matchesWholeTrade(entry(), makeExecutorResult())).toBe(true);
    expect(matchesWholeTrade(entry(), makeExecutorResult({ symbolOut: 'PG' }))).toBe(false);              // wrong counterpart
    expect(matchesWholeTrade(entry(), makeExecutorResult({ tier: 'core' }))).toBe(false);                 // wrong slot
    expect(matchesWholeTrade(entry(), makeExecutorResult({ symbolIn: 'KO', symbolOut: 'AMD' }))).toBe(false); // opposite leg
    expect(matchesWholeTrade({ ...entry(), counterpart: null }, makeExecutorResult({ symbolOut: 'PG' }))).toBe(true); // none declared
  });
  it('exit: outgoing symbol + resolved slot + declared counterpart', () => {
    const r = { symbolOut: 'TSLA', symbolIn: 'JPM', tier: 'star', slotIndex: 1 };
    expect(matchesWholeTrade(exit(), r)).toBe(true);
    expect(matchesWholeTrade(exit(), { ...r, symbolIn: 'AMD' })).toBe(false);   // wrong counterpart
    expect(matchesWholeTrade(exit(), { ...r, tier: 'core' })).toBe(false);      // wrong slot
    expect(matchesWholeTrade(exit(), { ...r, symbolOut: 'JPM', symbolIn: 'TSLA' })).toBe(false); // opposite leg
  });
  it('pick: incoming option + declared swapOut + resolved slot (+ the selected option when bound)', () => {
    expect(matchesWholeTrade(pick(), makeExecutorResult({ symbolIn: 'JPM' }))).toBe(true);
    expect(matchesWholeTrade(pick(), makeExecutorResult({ symbolIn: 'NVDA' }))).toBe(false);     // not an option
    expect(matchesWholeTrade(pick(), makeExecutorResult({ symbolOut: 'PG' }))).toBe(false);      // wrong swapOut
    expect(matchesWholeTrade(pick(), makeExecutorResult({ tier: 'star' }))).toBe(false);         // wrong slot
    expect(matchesWholeTrade(pick(), makeExecutorResult({ symbolIn: 'JPM' }), { selectedSymbol: 'AMD' })).toBe(false);
    expect(matchesWholeTrade(pick(), makeExecutorResult({ symbolIn: 'AMD' }), { selectedSymbol: 'AMD' })).toBe(true);
  });
  it('an unresolved slot or a missing executor result never matches', () => {
    expect(matchesWholeTrade(entry(), makeExecutorResult({ slotIndex: null }))).toBe(false);
    expect(matchesWholeTrade(entry(), null)).toBe(false);
  });
});

describe('planFlip — the skips', () => {
  const o = makeObservation({ symbols: { AMD: { px: 170, fetchedAtMs: NOW - 1 } } });
  it('not open / minting check / observation at or before the mint / nothing to do', () => {
    expect(planFlip({ ...amdShot(), state: 'hit' }, { observation: o, evalId: 'eval_001', executorResult: null })).toEqual({ skip: 'not_open' });
    expect(planFlip({ ...amdShot(), evalId: 'eval_001' }, { observation: o, evalId: 'eval_001', executorResult: null })).toEqual({ skip: 'minting_check' });
    expect(planFlip({ ...amdShot(), mintedAt: NOW }, { observation: o, evalId: 'eval_001', executorResult: null })).toEqual({ skip: 'before_mint' });
    expect(planFlip(amdShot(), { observation: makeObservation(), evalId: 'eval_001', executorResult: null })).toEqual({ skip: 'no_change' });
    expect(planFlip(amdShot(), { observation: o, evalId: null, executorResult: null })).toEqual({ next: 'hit', acted: false });
  });
});

// ---------------------------------------------------------------------------
describe('runCallFlips — one transaction per call, the receipt with the first transition', () => {
  it('a hit: state/stateChangedAt/stateSource flip, the receipt is created and referenced, nothing immutable moves', async () => {
    const [amd, tsla] = earlierCalls();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd, tsla]) });
    const observation = obsWith({ AMD: { px: 164.2, fetchedAtMs: NOW - 900, replacedInPrompt: true } });
    const res = await flipsOf(db, ctxFor({ observation }));
    expect(res.diag).toMatchObject({ hit: 1, receipts: 1, scanned: 2, complete: true });
    const after = storedDoc(db, 'calls', amd.callId);
    expect(after).toMatchObject({ state: 'hit', stateChangedAt: NOW, stateSource: 'check' });
    expect(after.outcome).toEqual({ receiptRef: receiptPathOf(BATTLE_ID, amd.callId) });
    for (const k of Object.keys(amd)) if (!MUTABLE_CALL_FIELDS.includes(k)) expect(after[k]).toEqual(amd[k]);
    expect(after.playerResponse).toBeNull();
    expect(storedDoc(db, 'callObservations', amd.callId)).toEqual({
      callId: amd.callId, evalId: 'eval_001', observedAtMs: NOW, px: 164.2, source: 'model_prompt', replacedInPrompt: true,
    });
    expect(Object.keys(storedDoc(db, 'callObservations', amd.callId))).toEqual(['callId', 'evalId', 'observedAtMs', 'px', 'source', 'replacedInPrompt']);
    // The untouched call stays exactly as stored.
    expect(storedDoc(db, 'calls', tsla.callId)).toEqual(tsla);
    // Never merge on a call; the call write is an update.
    expect(callWrites(db).map((w) => [w.op, w.merge])).toEqual([['update', false]]);
    expect(res.status).toEqual({ evalId: 'eval_001', cursor: null, scanned: 2, total: 2, complete: true });
  });

  it('expired_unresolved: the receipt says what was (not) observed — px null for an unobserved symbol', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const at = amd.horizon.expiresAt + 60_000;
    vi.setSystemTime(at + 1_000);
    await flipsOf(db, ctxFor({ exit: 'no_trigger', evalId: null, observation: makeObservation({ observedAtMs: at, source: 'no_trigger', omit: ['AMD'] }) }));
    expect(storedDoc(db, 'calls', amd.callId)).toMatchObject({ state: 'expired_unresolved', stateChangedAt: at, stateSource: 'check' });
    expect(storedDoc(db, 'callObservations', amd.callId)).toEqual({
      callId: amd.callId, evalId: null, observedAtMs: at, px: null, source: 'no_trigger', replacedInPrompt: false,
    });
  });

  // FOUNDER RULING E-3, as clarified by branch review BR-1: the first scan that
  // REACHES a still-open next_check call at or after its slot judges it once,
  // from its own observation, inside the transaction — state and receipt
  // together. "Judged" means that transaction committed. Nothing about the
  // battle's earlier scans — reached or not, failed or skipped — decides it.
  const nextCheckCall = () => earlierCalls(makeDeclarations({ calledShots: [{ ...makeDeclarations().calledShots[0], horizonPhrase: 'next_check' }], watching: [] }))[0];
  const hotAt = (at) => obsWith({ AMD: { px: 170, fetchedAtMs: at - 1 } }, at);   // above 163.5: met
  const coldAt = (at) => obsWith({ AMD: { px: 160, fetchedAtMs: at - 1 } }, at);  // not met
  /** The call's ONE terminal state, and its receipt, both from the observation at `at`. */
  const expectJudged = (db, call, state, at, px) => {
    expect(storedDoc(db, 'calls', call.callId)).toMatchObject({ state, stateChangedAt: at, stateSource: 'check' });
    expect(storedDoc(db, 'callObservations', call.callId)).toMatchObject({ callId: call.callId, observedAtMs: at, px });
  };

  it('next_check, HIT at the next check: the first scan to reach it after the slot (slot + 20 s) finds the condition met → hit, with its receipt', async () => {
    const amd = nextCheckCall();
    const slot = amd.horizon.expiresAt;
    expect(slot).toBe(EARLIER_MINT + 5 * 60_000); // 14:10 → the 14:15 slot
    const at = slot + 20_000;
    vi.setSystemTime(at + 1_000);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const res = await flipsOf(db, ctxFor({ observation: hotAt(at) }));
    expect(res.diag).toMatchObject({ hit: 1, expired: 0, receipts: 1 });
    expectJudged(db, amd, 'hit', at, 170);
    expect(res.status).not.toHaveProperty('observedAtMs'); // the status carries no scan clock (BR-1)
  });

  it('next_check, MISS at the next check: the condition not met at the first reach after the slot → expired_unresolved, with the observed px', async () => {
    const amd = nextCheckCall();
    const at = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(at + 1_000);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const res = await flipsOf(db, ctxFor({ observation: coldAt(at) }));
    expect(res.diag).toMatchObject({ hit: 0, expired: 1, receipts: 1 });
    expectJudged(db, amd, 'expired_unresolved', at, 160);
  });

  it('first REACHED only by a later check: the scan after the slot never got to it; the next scan to reach it judges from its own observation → hit (BR-1)', async () => {
    const amd = nextCheckCall();
    // An older open this_session call sorts first and takes the first scan's whole deadline.
    const [older] = earlierCalls(makeDeclarations({ calledShots: [makeDeclarations().calledShots[0]], watching: [] }), { evalId: 'eval_00a', mintedAtMs: EARLIER_MINT - 60_000 });
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([older, amd]) });
    db.__hooks.afterTxBody = async () => { vi.setSystemTime(Date.now() + 400); };
    const firstRes = await flipsOf(db, ctxFor({ observation: hotAt(first) }), { deadlineMs: Date.now() + 300 });
    expect(firstRes.diag).toMatchObject({ hit: 1, stopped: 'deadline' });
    expect(storedDoc(db, 'calls', older.callId).state).toBe('hit');
    expect(storedDoc(db, 'calls', amd.callId).state).toBe('open'); // never reached
    expect(firstRes.status).toMatchObject({ complete: false });
    expect(firstRes.status).not.toHaveProperty('observedAtMs');
    // Persist the status the way the phase does; the next check runs a slot later.
    db.__store.battle.cronState.callFlips = firstRes.status;
    db.__hooks.afterTxBody = null;
    const later = first + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    const laterRes = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(later) }));
    expect(laterRes.diag).toMatchObject({ hit: 1, expired: 0 });
    expectJudged(db, amd, 'hit', later, 170);
  });

  it('a persisted scan status — even one carrying a scan instant after the slot — never decides the judgment (BR-1)', async () => {
    const amd = nextCheckCall();
    const at = amd.horizon.expiresAt + 15 * 60_000 + 20_000;
    vi.setSystemTime(at + 1_000);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__store.battle.cronState.callFlips = { evalId: 'eval_001', cursor: null, scanned: 0, total: 0, complete: true, observedAtMs: amd.horizon.expiresAt + 20_000 };
    await flipsOf(db, ctxFor({ evalId: 'eval_003', observation: hotAt(at) }));
    expectJudged(db, amd, 'hit', at, 170);
  });

  it('a FAILED first query judges nothing: the scan after the slot read zero calls; the next scan judges from its own observation → hit (BR-1)', async () => {
    const amd = nextCheckCall();
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.failQuery = new Error('14 UNAVAILABLE: read failed');
    const firstRes = await flipsOf(db, ctxFor({ observation: hotAt(first) }));
    expect(firstRes.diag).toMatchObject({ scanned: 0, stopped: 'query_failed' });
    db.__store.battle.cronState.callFlips = firstRes.status;
    db.__hooks.failQuery = null;
    const later = first + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(later) }));
    expectJudged(db, amd, 'hit', later, 170);
  });

  it('a MISSING index judges nothing: scans are skipped until it re-validates; the first scan after recovery judges from its own observation → hit (BR-1)', async () => {
    const amd = nextCheckCall();
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.failQuery = Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
    const a = await flipsOf(db, ctxFor({ observation: hotAt(first) }));
    expect(a.diag.stopped).toBe('index_missing');
    db.__store.battle.cronState.callFlips = a.status;
    db.__hooks.failQuery = null; // the index is created
    // Inside the re-check window the scan is still skipped: no query, nothing judged.
    const second = first + 5 * 60_000;
    vi.setSystemTime(second + 1_000);
    const b = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(second) }));
    expect(b.diag.stopped).toBe('index_missing');
    expect(storedDoc(db, 'calls', amd.callId).state).toBe('open');
    db.__store.battle.cronState.callFlips = b.status;
    const recovered = first + INDEX_RECHECK_MS + 60_000;
    vi.setSystemTime(recovered + 1_000);
    const c = await flipsOf(db, ctxFor({ evalId: 'eval_003', observation: hotAt(recovered) }));
    expect(c.diag.stopped).toBeNull();
    expectJudged(db, amd, 'hit', recovered, 170);
  });

  it('a BUDGET-SKIPPED hook judges nothing: under 2,000 ms nothing starts; the next check that runs its scan judges → hit (BR-1)', async () => {
    const amd = nextCheckCall();
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const starved = ctxFor({ exit: 'no_trigger', evalId: null, observation: hotAt(first), handlerStartMs: Date.now() - (TIME_BUDGET_MS - TAIL_RESERVE_MS - (NON_MODEL_PHASE_MS - 1)) });
    const skipped = await runExitCallsHook(starved, { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(skipped).toMatchObject({ skipped: 'budget' });
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    const later = first + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    const fed = ctxFor({ exit: 'no_trigger', evalId: null, observation: hotAt(later), handlerStartMs: Date.now() - 60_000 });
    const res = await runExitCallsHook(fed, { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(res.status).toBe('written');
    expectJudged(db, amd, 'hit', later, 170);
  });

  it('a FAILED status write changes no judgment: the committed transition stands, and a later check never judges the call again (BR-1)', async () => {
    const amd = nextCheckCall();
    const at = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(at + 1_000);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    // The battle document refuses the calls status write, and only that write.
    const collection = db.collection.bind(db);
    db.collection = (col) => {
      const c = collection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, async update(payload) { if ('cronState.callsDiag' in payload) throw new Error('14 UNAVAILABLE: status write'); return ref.update(payload); } };
        },
      };
    };
    const res = await runExitCallsHook(ctxFor({ exit: 'no_trigger', evalId: null, observation: coldAt(at) }), { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(res.status).toBe('failed');
    expect(db.__store.battle.cronState).not.toHaveProperty('callFlips');
    expectJudged(db, amd, 'expired_unresolved', at, 160);
    // A later check, with the condition now met, finds the call terminal: no second judgment.
    db.collection = collection;
    const later = at + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    const again = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(later) }));
    expect(again.diag).toMatchObject({ hit: 0, expired: 0 });
    expectJudged(db, amd, 'expired_unresolved', at, 160);
  });

  it('an ABORTED transaction judges nothing: no state, no receipt; the next scan judges from its own observation → hit (BR-1)', async () => {
    const amd = nextCheckCall();
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.beforeCommit = async () => { throw Object.assign(new Error('10 ABORTED: Too much contention on these documents.'), { code: 10 }); };
    const firstRes = await flipsOf(db, ctxFor({ observation: coldAt(first) }));
    expect(firstRes.diag).toMatchObject({ failed: 1, expired: 0, receipts: 0 });
    expect(storedDoc(db, 'calls', amd.callId)).toEqual(amd);
    expect(storedCollection(db, 'callObservations')).toEqual({});
    db.__store.battle.cronState.callFlips = firstRes.status;
    db.__hooks.beforeCommit = null;
    const later = first + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(later) }));
    expectJudged(db, amd, 'hit', later, 170);
  });

  it('an UNCONFIRMED transaction that commits late IS the judgment: the next check finds the call terminal and never judges it again (BR-1)', async () => {
    const amd = nextCheckCall();
    const first = amd.horizon.expiresAt + 20_000;
    vi.setSystemTime(first);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    // The commit (150 ms, real) outlasts this flip's 60 ms ceiling: the scan gives up, the commit still lands.
    db.__hooks.beforeCommit = async () => { await new Promise((r) => { setTimeout(r, 150); }); };
    const firstRes = await flipsOf(db, ctxFor({ observation: coldAt(first) }), { deadlineMs: Date.now() + 60 });
    expect(firstRes.diag).toMatchObject({ unconfirmed: 1, expired: 0 });
    await new Promise((r) => { setTimeout(r, 300); });
    expectJudged(db, amd, 'expired_unresolved', first, 160);
    db.__hooks.beforeCommit = null;
    const later = first + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    const again = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hotAt(later) }));
    expect(again.diag).toMatchObject({ hit: 0, expired: 0 });
    expectJudged(db, amd, 'expired_unresolved', first, 160);
  });

  it('two COMPETING judgments leave ONE terminal state and ONE receipt: the loser re-reads a terminal call and skips it (BR-1)', async () => {
    const amd = nextCheckCall();
    const slot = amd.horizon.expiresAt;
    vi.setSystemTime(slot + 60_000);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    let raced = false;
    let rival = null;
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (raced || attempt !== 1) return;
      raced = true;
      // Check B reaches the same call between check A's reads and A's commit, and commits first.
      rival = await flipsOf(db, ctxFor({ evalId: 'eval_00b', observation: coldAt(slot + 25_000) }));
    };
    const a = await flipsOf(db, ctxFor({ evalId: 'eval_00a', observation: hotAt(slot + 20_000) }));
    expect(rival.diag).toMatchObject({ expired: 1, receipts: 1 });
    expect(a.diag).toMatchObject({ hit: 0, receipts: 0, skipped: { not_open: 1 } });
    expectJudged(db, amd, 'expired_unresolved', slot + 25_000, 160);
    expect(callWrites(db).filter((w) => w.path.endsWith(amd.callId))).toHaveLength(1);
    expect(db.__callsAccess.writes.filter((w) => w.path.includes('/callObservations/'))).toHaveLength(1);
  });

  it('never a hit on the minting check; an observation at or before the mint is skipped', async () => {
    const minted = earlierCalls(makeDeclarations(), { evalId: 'eval_001', mintedAtMs: NOW - 10_000 });
    const early = earlierCalls(makeDeclarations(), { evalId: 'eval_000', mintedAtMs: NOW + 5 });
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([...minted, ...early]) });
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 }, TSLA: { px: 200, fetchedAtMs: NOW - 1 } }) }));
    expect(res.diag.skipped).toEqual({ minting_check: 2, before_mint: 2 });
    expect(callWrites(db)).toEqual([]);
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });

  it('a stale open read cannot overwrite a completed call: the transaction re-reads and skips', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const run = db.runTransaction.bind(db);
    db.runTransaction = async (cb) => {
      // Between the page read and the flip, the sweep resolves the call.
      await db.collection('agentBattles').doc(BATTLE_ID).collection('calls').doc(amd.callId).update({ state: 'expired_unresolved', stateSource: 'sweep' });
      return run(cb);
    };
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(res.diag.skipped).toEqual({ not_open: 1 });
    expect(storedDoc(db, 'calls', amd.callId)).toMatchObject({ state: 'expired_unresolved', stateSource: 'sweep' });
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });

  it('an answered call keeps its playerResponse and outcome fields; the flip only adds the receipt reference', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const run = db.runTransaction.bind(db);
    const response = { answer: 'hold', kind: 'directive', callId: amd.callId, filedAt: NOW - 5 };
    db.runTransaction = async (cb) => {
      await db.collection('agentBattles').doc(BATTLE_ID).collection('calls').doc(amd.callId).update({ playerResponse: response, outcome: { heldOff: true } });
      return run(cb);
    };
    await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    const after = storedDoc(db, 'calls', amd.callId);
    expect(after.state).toBe('hit');
    expect(after.playerResponse).toEqual(response);
    expect(after.outcome).toEqual({ heldOff: true, receiptRef: receiptPathOf(BATTLE_ID, amd.callId) });
  });

  it('a terminal parent stops the scan: nothing flips once the battle has completed', async () => {
    const calls = earlierCalls();
    const db = makeCallsDb({ battle: makeTickBattle({ status: 'completed' }), seed: seedOf(calls) });
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 }, TSLA: { px: 200, fetchedAtMs: NOW - 1 } }) }));
    expect(res.diag.stopped).toBe('parent_terminal');
    expect(res.status.complete).toBe(false);
    expect(callWrites(db)).toEqual([]);
  });

  // The transaction is the authority, not the page read: a competing write that
  // lands BETWEEN the transaction's own reads and its commit conflicts the
  // attempt, and the retry reads what is now there (review D-3).
  it('a sweep resolves the call after the transaction read it: the attempt conflicts, the retry reads it closed — no transition, no receipt', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.afterTxBody = async ({ attempt, readPaths }) => {
      if (attempt !== 1 || !readPaths.includes(`agentBattles/${BATTLE_ID}/calls/${amd.callId}`)) return;
      await db.collection('agentBattles').doc(BATTLE_ID).collection('calls').doc(amd.callId).update({ state: 'expired_unresolved', stateChangedAt: NOW - 1, stateSource: 'sweep' });
    };
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(db.__txAttempts).toBe(2);
    expect(res.diag).toMatchObject({ hit: 0, receipts: 0, skipped: { not_open: 1 } });
    expect(storedDoc(db, 'calls', amd.callId)).toMatchObject({ state: 'expired_unresolved', stateChangedAt: NOW - 1, stateSource: 'sweep' });
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });

  it('the battle completes after the transaction read it: the retry reads the terminal parent — nothing flips, the scan stops', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.afterTxBody = async ({ attempt, readPaths }) => {
      if (attempt !== 1 || !readPaths.includes(`agentBattles/${BATTLE_ID}`)) return;
      await db.collection('agentBattles').doc(BATTLE_ID).update({ status: 'completed' });
    };
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(db.__txAttempts).toBe(2);
    expect(res.diag).toMatchObject({ hit: 0, receipts: 0, stopped: 'parent_terminal' });
    expect(storedDoc(db, 'calls', amd.callId)).toEqual(amd);
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });

  it('reads that outlast the 800 ms ceiling issue no commit: the flip is unconfirmed, the call stays open, no receipt (review E-1)', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const run = db.runTransaction.bind(db);
    db.runTransaction = (cb) => run(async (tx) => {
      const get = tx.get;
      // The call read returns 900 ms of the shared clock later — past the ceiling.
      tx.get = async (ref) => { const snap = await get(ref); if (ref.path.includes('/calls/')) vi.setSystemTime(Date.now() + 900); return snap; };
      return cb(tx);
    });
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(res.diag).toMatchObject({ unconfirmed: 1, hit: 0, receipts: 0, failed: 0 });
    expect(storedDoc(db, 'calls', amd.callId)).toEqual(amd);
    expect(storedCollection(db, 'callObservations')).toEqual({});
    expect(callWrites(db)).toEqual([]);
  });

  it('the receipt is created atomically with the transition: a failing commit leaves neither', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    db.__hooks.beforeCommit = async () => { throw new Error('14 UNAVAILABLE'); };
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(res.diag.failed).toBe(1);
    expect(storedDoc(db, 'calls', amd.callId)).toEqual(amd);
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });
});

describe('outcome.actedEvalId — the model-result row, a committed executor result, the whole trade', () => {
  const hot = () => obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } });
  const run = async (ctxOver, callOver = {}) => {
    const amd = { ...amdShot(), ...callOver };
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    await flipsOf(db, ctxFor({ observation: hot(), ...ctxOver }));
    return storedDoc(db, 'calls', amd.callId);
  };

  it('a matching committed swap on the model row sets actedEvalId beside the hit', async () => {
    const after = await run({ executorResult: makeExecutorResult() });
    expect(after.outcome).toEqual({ receiptRef: receiptPathOf(BATTLE_ID, after.callId), actedEvalId: 'eval_001' });
  });
  it('each mismatch fails independently: wrong counterpart, wrong slot, opposite leg', async () => {
    for (const r of [makeExecutorResult({ symbolOut: 'PG' }), makeExecutorResult({ tier: 'core' }), makeExecutorResult({ symbolIn: 'KO', symbolOut: 'AMD' })]) {
      expect((await run({ executorResult: r })).outcome).not.toHaveProperty('actedEvalId');
    }
  });
  it('blocked swap / proposal only (no committed executor result) → never acted', async () => {
    expect((await run({ executorResult: null })).outcome).not.toHaveProperty('actedEvalId');
  });
  it('a non-model exit never sets it, even with an executor result in the context', async () => {
    for (const exit of NON_MODEL_FLIP_EXITS) {
      expect((await run({ exit, executorResult: makeExecutorResult() })).outcome ?? {}).not.toHaveProperty('actedEvalId');
    }
  });
  it('acting without a transition records the act and leaves the call open (no receipt)', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    await flipsOf(db, ctxFor({ observation: makeObservation(), executorResult: makeExecutorResult() }));
    expect(storedDoc(db, 'calls', amd.callId)).toMatchObject({ state: 'open', outcome: { actedEvalId: 'eval_001' } });
    expect(storedCollection(db, 'callObservations')).toEqual({});
  });
  it('an existing actedEvalId is never rewritten', async () => {
    const after = await run({ executorResult: makeExecutorResult() }, { outcome: { actedEvalId: 'eval_000' } });
    expect(after.outcome.actedEvalId).toBe('eval_000');
  });
});

// ---------------------------------------------------------------------------
describe('the cursor — continuation, wraparound, ties, > 50 open calls, the deadline', () => {
  /** n open AMD entry shots from earlier checks; `sameMint` gives them one mint instant. */
  function manyCalls(n, { sameMint = false } = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const [c] = earlierCalls(makeDeclarations({ calledShots: [makeDeclarations().calledShots[0]], watching: [] }), {
        evalId: `eval_${String(i).padStart(3, '0')}x`, mintedAtMs: sameMint ? EARLIER_MINT : EARLIER_MINT + i,
      });
      out.push(c);
    }
    return out;
  }
  const order = (calls) => [...calls].sort((a, b) => (a.mintedAt - b.mintedAt) || (a.callId < b.callId ? -1 : 1));

  it('the exact query: state == open, ordered by mintedAt then __name__, pages of 50', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(manyCalls(3)) });
    await flipsOf(db, ctxFor());
    const [q] = db.__callsAccess.queries;
    expect(q.collectionPath).toBe(`agentBattles/${BATTLE_ID}/calls`);
    expect(q.filters).toEqual([{ field: 'state', op: '==', value: 'open' }]);
    expect(q.orders).toEqual([{ field: 'mintedAt', dir: 'asc' }, { field: '__name__', dir: 'asc' }]);
    expect(q.limit).toBe(FLIP_PAGE_SIZE);
    expect(FLIP_QUERY.orderBy.map((o) => o.fieldPath)).toEqual(['mintedAt', '__name__']);
  });

  it('> 50 open calls: every page is scanned when time allows; total only when complete', async () => {
    const calls = manyCalls(120);
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    const res = await flipsOf(db, ctxFor());
    expect(res.diag).toMatchObject({ scanned: 120, pages: 3, complete: true });
    expect(res.status).toMatchObject({ total: 120, complete: true, cursor: null });
  });

  it('deadline interruption: complete false, the cursor at the last examined call; the next check resumes after it with ITS OWN observation', async () => {
    const calls = order(manyCalls(8));
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    // Every call hits, so each needs a transaction; each transaction costs 400 ms of the shared clock.
    db.__hooks.afterTxBody = async () => { vi.setSystemTime(Date.now() + 400); };
    const first = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }), { deadlineMs: Date.now() + 1_000 });
    expect(first.status.complete).toBe(false);
    expect(first.diag.stopped).toBe('deadline');
    const flipped = Object.values(storedCollection(db, 'calls')).filter((c) => c.state === 'hit').length;
    expect(flipped).toBe(first.diag.hit);
    expect(first.status.cursor).toEqual({ mintedAt: calls[flipped - 1].mintedAt, callId: calls[flipped - 1].callId });
    expect(first.status.total).toBeNull();
    // Persist the status the way the phase does; the next check observes later.
    db.__store.battle.cronState.callFlips = first.status;
    const later = NOW + 15 * 60_000;
    vi.setSystemTime(later + 1_000);
    db.__hooks.afterTxBody = null;
    const second = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: obsWith({ AMD: { px: 171, fetchedAtMs: later - 1 } }, later) }));
    expect(second.status.complete).toBe(true);
    const receipts = Object.values(storedCollection(db, 'callObservations'));
    expect(receipts).toHaveLength(8);
    // Each receipt carries the instant of the check that observed it — never the previous check's.
    expect(receipts.filter((r) => r.observedAtMs === NOW)).toHaveLength(flipped);
    expect(receipts.filter((r) => r.observedAtMs === later)).toHaveLength(8 - flipped);
  });

  it('wraparound: resume after the persisted cursor to the end, then the start up to the cursor — each call once', async () => {
    const calls = order(manyCalls(6));
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    db.__store.battle.cronState.callFlips = { evalId: 'eval_000', cursor: { mintedAt: calls[2].mintedAt, callId: calls[2].callId }, scanned: 3, total: null, complete: false };
    const res = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    const seen = db.__callsAccess.queries.map((q) => ({ startAfter: q.startAfter, endAt: q.endAt }));
    expect(res.diag).toMatchObject({ wrapped: true, complete: true, scanned: 6, hit: 6 });
    expect(seen[0].startAfter).toEqual([calls[2].mintedAt, calls[2].callId]);
    expect(seen[1]).toEqual({ startAfter: null, endAt: [calls[2].mintedAt, calls[2].callId] });
    expect(res.status.cursor).toBeNull();
  });

  it('identical mint times: the document-id tie-break keeps continuation exact (no skip, no repeat)', async () => {
    const calls = order(manyCalls(5, { sameMint: true }));
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    db.__hooks.afterTxBody = async () => { vi.setSystemTime(Date.now() + 400); };
    const first = await flipsOf(db, ctxFor({ observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }), { deadlineMs: Date.now() + 700 });
    const k = first.diag.hit;
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(5);
    expect(first.status.cursor).toEqual({ mintedAt: EARLIER_MINT, callId: calls[k - 1].callId });
    db.__store.battle.cronState.callFlips = first.status;
    db.__hooks.afterTxBody = null;
    const second = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: obsWith({ AMD: { px: 170, fetchedAtMs: NOW - 1 } }) }));
    expect(second.diag.hit).toBe(5 - k);
    expect(Object.values(storedCollection(db, 'calls')).every((c) => c.state === 'hit')).toBe(true);
  });

  // The rows below keep every examined call OPEN, so a scan that ignored the
  // persisted cursor (or cut the id tie-break) would re-read calls it had
  // already examined — and the reads say so (review D-4).
  const callReadsSince = (db, from) => db.__callsAccess.reads.slice(from).filter((p) => p.includes('/calls/')).map((p) => p.split('/').pop());
  const noQuote = () => makeObservation({ observedAtMs: NOW, omit: ['AMD'] });

  it('continuation with examined calls still OPEN (act only, no transition): the next check starts after the cursor and wraps to it — each call once, in index order', async () => {
    const calls = order(manyCalls(8));
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    // No quote, so no transition; the committed swap matches every call, so each needs one transaction (400 ms).
    db.__hooks.afterTxBody = async () => { vi.setSystemTime(Date.now() + 400); };
    const first = await flipsOf(db, ctxFor({ observation: noQuote(), executorResult: makeExecutorResult() }), { deadlineMs: Date.now() + 1_000 });
    const k = first.diag.acted;
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(8);
    expect(first.diag).toMatchObject({ hit: 0, receipts: 0, stopped: 'deadline' });
    expect(first.status.cursor).toEqual({ mintedAt: calls[k - 1].mintedAt, callId: calls[k - 1].callId });
    expect(Object.values(storedCollection(db, 'calls')).every((c) => c.state === 'open')).toBe(true);
    db.__store.battle.cronState.callFlips = first.status;
    db.__hooks.afterTxBody = null;
    const from = db.__callsAccess.reads.length;
    const second = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: noQuote() }));
    expect(second.diag).toMatchObject({ wrapped: true, complete: true, scanned: 8 });
    expect(callReadsSince(db, from)).toEqual([...calls.slice(k), ...calls.slice(0, k)].map((c) => c.callId));
  });

  it('120 calls with ONE mint instant: the id tie-break carries the scan across page boundaries and the persisted cursor — each call exactly once, in index order', async () => {
    const calls = order(manyCalls(120, { sameMint: true }));
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(calls) });
    const full = await flipsOf(db, ctxFor({ observation: noQuote() }));
    expect(full.diag).toMatchObject({ scanned: 120, pages: 3, complete: true });
    expect(callReadsSince(db, 0)).toEqual(calls.map((c) => c.callId));
    expect(db.__callsAccess.queries[1].startAfter).toEqual([EARLIER_MINT, calls[49].callId]);
    // A cursor persisted mid-page-two (call 59): the tail leg, then the head leg up to and including it.
    db.__store.battle.cronState.callFlips = { evalId: 'eval_000', cursor: { mintedAt: EARLIER_MINT, callId: calls[59].callId }, scanned: 60, total: null, complete: false };
    const from = db.__callsAccess.reads.length;
    const resumed = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: noQuote() }));
    expect(resumed.diag).toMatchObject({ scanned: 120, wrapped: true, complete: true });
    expect(callReadsSince(db, from)).toEqual([...calls.slice(60), ...calls.slice(0, 60)].map((c) => c.callId));
  });

  it('an unresolved prefix cannot monopolize the deadline: the check it exhausts leaves the cursor past it, and the next check reaches the call behind it', async () => {
    // 60 old calls that never resolve (no quote for them), then one that hits.
    const stuck = order(manyCalls(60).map((c) => ({ ...c, symbol: 'JPM', condition: { side: 'above', level: 999 } })));
    const [late] = earlierCalls(makeDeclarations({ calledShots: [makeDeclarations().calledShots[0]], watching: [] }), { evalId: 'eval_zzz', mintedAtMs: EARLIER_MINT + 10_000 });
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([...stuck, late]) });
    // Every page read costs 1,500 ms of the shared clock; each check has 2,000 ms — one page.
    db.__hooks.afterQuery = async () => { vi.setSystemTime(Date.now() + 1_500); };
    const hot = () => obsWith({ AMD: { px: 170, fetchedAtMs: Date.now() - 1 } }, Date.now());
    const first = await flipsOf(db, ctxFor({ observation: hot() }), { deadlineMs: Date.now() + 2_000 });
    expect(first.diag).toMatchObject({ scanned: 50, hit: 0, stopped: 'deadline', complete: false });
    expect(first.status.cursor).toEqual({ mintedAt: stuck[49].mintedAt, callId: stuck[49].callId });
    expect(storedDoc(db, 'calls', late.callId).state).toBe('open');
    db.__store.battle.cronState.callFlips = first.status;
    vi.setSystemTime(Date.now() + 15 * 60_000);
    const second = await flipsOf(db, ctxFor({ evalId: 'eval_002', observation: hot() }), { deadlineMs: Date.now() + 2_000 });
    expect(second.diag.hit).toBe(1);
    expect(storedDoc(db, 'calls', late.callId).state).toBe('hit');
  });

  it('the store double refuses a runaway scan: a cursor that never advances fails its row instead of hanging the worker', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(manyCalls(3)) });
    const q = db.collection('agentBattles').doc(BATTLE_ID).collection('calls').where('state', '==', 'open').limit(1);
    for (let i = 0; i < MAX_CALLS_QUERIES; i++) await q.get();
    await expect(q.get()).rejects.toThrow(/runaway scan/);
  });

  it('cursorOf rejects a malformed persisted cursor', () => {
    expect(cursorOf({ mintedAt: 5, callId: 'x' })).toEqual({ mintedAt: 5, callId: 'x' });
    expect(cursorOf({ mintedAt: 'x', callId: 'x' })).toBeNull();
    expect(cursorOf({ mintedAt: 5, callId: '' })).toBeNull();
    expect(cursorOf(null)).toBeNull();
  });
});

describe('the index — validated once per process, a missing one skipped loudly', () => {
  it('FAILED_PRECONDITION marks the index missing; later checks inside the window issue no query; it re-validates after', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(earlierCalls()) });
    const missing = Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
    db.__hooks.failQuery = missing;
    const a = await flipsOf(db, ctxFor());
    expect(a.diag.stopped).toBe('index_missing');
    expect(flipIndexState()).toBe('missing');
    expect(console.error.mock.calls.map((c) => c.join(' ')).join('\n')).toMatch(/flip index MISSING/);
    const queries = db.__callsAccess.queries.length;
    const b = await flipsOf(db, ctxFor());
    expect(b.diag.stopped).toBe('index_missing');
    expect(db.__callsAccess.queries.length).toBe(queries);
    db.__hooks.failQuery = null;
    vi.setSystemTime(Date.now() + INDEX_RECHECK_MS + 1);
    const c = await flipsOf(db, ctxFor({ observation: makeObservation({ observedAtMs: Date.now() - 1 }) }));
    expect(c.diag.stopped).toBeNull();
    expect(flipIndexState()).toBe('ok');
  });

  it('any other query failure stops the scan without condemning the index', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf(earlierCalls()) });
    db.__hooks.failQuery = new Error('14 UNAVAILABLE');
    const res = await flipsOf(db, ctxFor());
    expect(res.diag.stopped).toBe('query_failed');
    expect(flipIndexState()).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
describe('runExitCallsHook — the non-model rule (row 6)', () => {
  const exitCtx = (over = {}) => ctxFor({ exit: 'no_trigger', evalId: null, observation: makeObservation({ source: 'no_trigger', symbols: { AMD: { px: 170, fetchedAtMs: NOW - 1 } } }), ...over });

  it('available ≥ 2,000: the flips, then one status write — callFlips + callsDiag, no evalId fabricated', async () => {
    const amd = amdShot();
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amd]) });
    const res = await runExitCallsHook(exitCtx(), { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(res.status).toBe('written');
    expect(storedDoc(db, 'calls', amd.callId).state).toBe('hit');
    const statusWrites = db.__updates.filter((u) => 'cronState.callsDiag' in u);
    expect(statusWrites).toHaveLength(1);
    expect(statusWrites[0]['cronState.callFlips']).toEqual({ evalId: null, cursor: null, scanned: 1, total: 1, complete: true });
    expect(statusWrites[0]['cronState.callsDiag']).toMatchObject({ evalId: null, exit: 'no_trigger', phaseResult: 'none' });
    expect(JSON.stringify(statusWrites)).not.toMatch(/declarationsPhase/);
  });

  it('available < 2,000: NOTHING starts — no query, no transaction, no status write', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amdShot()]) });
    const handlerStartMs = Date.now() - (TIME_BUDGET_MS - TAIL_RESERVE_MS - (NON_MODEL_PHASE_MS - 1));
    const res = await runExitCallsHook(exitCtx({ handlerStartMs }), { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(res).toMatchObject({ skipped: 'budget', available: NON_MODEL_PHASE_MS - 1 });
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    expect(db.__updates).toEqual([]);
  });

  it('the deadline is clipped to the tail boundary (R3-3: 12.1 s left never spends the tail)', async () => {
    const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amdShot()]) });
    const handlerStartMs = Date.now() - (TIME_BUDGET_MS - 12_100);
    const res = await runExitCallsHook(exitCtx({ handlerStartMs }), { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS });
    expect(res.skipped).toBe('budget');
    expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
  });

  it('inert at off, on the model row (the phase owns it), on excluded rows, and without a usable observation', async () => {
    for (const ctx of [
      exitCtx({ mode: 'off' }),
      exitCtx({ exit: 'model_result' }),
      exitCtx({ exit: 'refresh_failed' }),
      exitCtx({ exit: 'prompt_build_failed' }),
      exitCtx({ observation: null }),
    ]) {
      const db = makeCallsDb({ battle: makeTickBattle(), seed: seedOf([amdShot()]) });
      expect(await runExitCallsHook(ctx, { db, battle: db.__store.battle, timeBudgetMs: TIME_BUDGET_MS })).toBeNull();
      expect(callsTouches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    }
  });

  it('the non-model rows are exactly the §3.4 flip rows minus the model result', () => {
    expect(NON_MODEL_FLIP_EXITS).toEqual(['transport_failed_after_prompt', 'budget_skipped', 'no_trigger', 'proposal_pending', 'gameplan_pending', 'gameplan_created', 'passive']);
  });
});

describe('the receipt shape', () => {
  it('buildReceipt: the observed quote or null — never a stored price', () => {
    const amd = amdShot();
    expect(buildReceipt({ call: amd, evalId: null, observation: makeObservation({ omit: ['AMD'] }) }).px).toBeNull();
    expect(buildReceipt({ call: amd, evalId: 'e', observation: makeObservation() }).px).toBe(162);
    expect(receiptPathOf('b', 'c')).toBe('agentBattles/b/callObservations/c');
  });
});
