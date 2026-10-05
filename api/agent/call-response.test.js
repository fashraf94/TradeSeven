// api/agent/call-response.test.js
//
// POST /api/agent/call-response — THE ORDERED DECISION TABLE (Cockpit Build 1a
// spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §5, §15.4; contract Amendment B §1–§6).
// Every row in order; an identical repeat after a hit succeeds without belief
// or budget; a different answer conflicts; acks on completed parents; every
// directive guard; a pick with an ineligible option; `refused` written ONLY for
// directive_pending; the budget charged exactly once; 429; and the 404 that
// lands BEFORE any call read at off and for a non-allowlisted owner.
//
// The store is the general double (api/_utils/__fixtures__/callsFirestore.js):
// an optimistic transaction with a conflict set, create-once events, and an
// access log keyed by path.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCallsFirestore, stored, storedUnder, touches, FieldValueDouble } from '../_utils/__fixtures__/callsFirestore.js';
import { makeTickBattle } from '../_utils/__fixtures__/tickStampsHarness.js';

const state = vi.hoisted(() => ({ uid: 'owner-uid-1', callsMode: 'on', allow: ['owner-uid-1'], resolveImpl: () => ({ groupId: 'group-xyz', dayN: 3 }) }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) } }));
// Cockpit Build 2a (spec S-5): the allowlist is the SERVER-SIDE environment reader now (allowlist.js),
// no longer a featureFlags export — driven here from the suite's row state, exactly as the getter was.
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => state.allow }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return state.callsMode; },
}));
vi.mock('../_utils/agentChatBudget.js', async (importOriginal) => ({ ...(await importOriginal()), resolveBudgetDay: async (_db, battle) => state.resolveImpl(battle) }));
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));

// Dependency-surface guard (BUILD_RULES §4): the import of the module under test is never mocked.
const { default: handler, classifyAnswer, buildCockpitExchange, resetCallResponseRateLimit, ANSWERS_1A, DEFERRED_ANSWERS, REFUSAL_REASONS, CALL_RESPONSE_RATE_LIMIT } = await import('./call-response.js');
const { BATTLE_CHAT_BUDGET } = await import('../_utils/directiveFiling.js');

const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z'); // Wed Sep 9 2026, 11:00 ET
const CLOSE = T('2026-09-09T20:00:00.000Z');
const SLOT = T('2026-09-09T15:15:00.000Z');
const BATTLE_ID = 'battle-tick-1';
const CALL = `${BATTLE_ID}:eval_001:call:0`;   // AMD entry, act-default
const HOLD_CALL = `${BATTLE_ID}:eval_001:call:1`; // KO exit, hold-default
const PICK = `${BATTLE_ID}:eval_001:call:2`;   // pick AMD|JPM for KO
const P = (sub, id) => `agentBattles/${BATTLE_ID}/${sub}/${id}`;

const shot = (callId, over = {}) => ({
  callId, kind: 'called_shot', battleId: BATTLE_ID, evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 60_000,
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'AMD above $161 by the close.',
  evidence: { tickId: null, availability: 'off', priceAsOf: null }, hypothesisRef: null, origin: 'agent_initiative',
  state: 'open', stateChangedAt: NOW - 60_000, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
const pickCall = (over = {}) => shot(PICK, {
  kind: 'pick', symbol: null, direction: null, counterpart: null, swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }],
  condition: null, horizon: { phrase: 'next_check', expiresAt: SLOT, basis: 'next_check' }, defaultAction: null, said: 'AMD or JPM for KO.', ...over,
});

function makeDb({ battle = makeTickBattle({ directive: null }), calls = {}, queue = null, agent = { archetype: 'analyst', name: 'Photo Agent' }, extra = {} } = {}) {
  const docs = {
    [`agentBattles/${BATTLE_ID}`]: battle,
    'agents/agent-1': agent,
    [P('calls', CALL)]: shot(CALL),
    [P('calls', HOLD_CALL)]: shot(HOLD_CALL, { symbol: 'KO', direction: 'exit', counterpart: 'AMD', condition: { side: 'below', level: 62.5 }, defaultAction: 'hold' }),
    [P('calls', PICK)]: pickCall(),
    ...Object.fromEntries(Object.entries(calls).map(([id, c]) => [P('calls', id), c])),
    ...(queue ? { [`callSweepQueue/${BATTLE_ID}`]: queue } : {}),
    ...extra,
  };
  return makeCallsFirestore({ docs });
}
const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body) => { const res = mkRes(); await handler({ method: 'POST', body }, res); return res; };
const answerBody = (over = {}) => ({ battleId: BATTLE_ID, callId: CALL, answer: 'hold', expectedDirectiveThreadId: null, ...over });
const callReads = (db) => db.__access.reads.filter((p) => p.includes('/calls/')).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.uid = 'owner-uid-1';
  state.callsMode = 'on';
  state.allow = ['owner-uid-1'];
  state.resolveImpl = () => ({ groupId: 'group-xyz', dayN: 3 });
  resetCallResponseRateLimit();
  activeDb = makeDb();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the wire (spec §5)', () => {
  it('405 on non-POST; 400 on a missing battleId / callId / answer, an unknown answer, a missing belief key, a pick without pickSymbol — before any read', async () => {
    const res = mkRes(); await handler({ method: 'GET', body: {} }, res); expect(res.statusCode).toBe(405);
    for (const body of [{}, answerBody({ battleId: '' }), answerBody({ callId: null }), answerBody({ answer: 'yes' }), answerBody({ answer: 'pick', callId: PICK })]) {
      expect((await post(body)).statusCode, JSON.stringify(body)).toBe(400);
    }
    const noBelief = answerBody(); delete noBelief.expectedDirectiveThreadId;
    expect((await post(noBelief)).statusCode).toBe(400);
    expect((await post(answerBody({ expectedDirectiveThreadId: 7 }))).statusCode).toBe(400);
    expect(activeDb.__access.reads).toEqual([]);
    expect(ANSWERS_1A).toEqual(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
    expect(REFUSAL_REASONS).toEqual(['directive_pending', 'already_answered', 'expired', 'belief_mismatch', 'budget', 'parent_not_active']);
  });

  it('ask and keep → 400 deferred, nothing read, nothing written (Amendment B §2)', async () => {
    for (const answer of DEFERRED_ANSWERS) {
      const res = await post(answerBody({ answer }));
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: 'deferred', answer });
    }
    expect(activeDb.__access.reads).toEqual([]);
    expect(activeDb.__access.writes).toEqual([]);
  });

  it('429 after 20 requests on one battle within a minute (process-local), other battles unaffected', async () => {
    // The window is PINNED (spec §5: 20 per 60 s), never derived from the constant — a drifted limit fails here (mutation M16).
    expect(CALL_RESPONSE_RATE_LIMIT).toEqual({ limit: 20, windowMs: 60_000 });
    for (let i = 0; i < 20; i++) expect((await post(answerBody({ answer: 'go' }))).statusCode).not.toBe(429);
    const res = await post(answerBody({ answer: 'go' }));
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    const other = await post(answerBody({ battleId: 'battle-other', answer: 'go' }));
    expect(other.statusCode).not.toBe(429);
  });

  it("the window is the OWNER's: 20 requests by another signed-in user (each 403) never lock the owner out (review L1-1 / L6-4)", async () => {
    state.uid = 'somebody-else';
    for (let i = 0; i < 20; i++) expect((await post(answerBody({ answer: 'go' }))).statusCode).toBe(403);
    expect((await post(answerBody({ answer: 'go' }))).statusCode).toBe(429); // the stranger's own window is full
    state.uid = 'owner-uid-1';
    const owner = await post(answerBody({ answer: 'go' }));
    expect(owner.statusCode).toBe(200);
  });
});

describe('rows 1–2: owner and the resolved mode — the 404 lands before any call read', () => {
  it('a missing battle → 404; another owner → 403; neither reads a call', async () => {
    activeDb = makeCallsFirestore({ docs: {} });
    expect((await post(answerBody())).statusCode).toBe(404);
    activeDb = makeDb();
    state.uid = 'somebody-else';
    const res = await post(answerBody());
    expect(res.statusCode).toBe(403);
    expect(callReads(activeDb)).toBe(0);
    expect(activeDb.__access.writes).toEqual([]);
  });

  it("global 'off', global 'shadow', and 'on' for a NON-allowlisted owner → 404 cockpit_unavailable after the parent read, no call read, nothing written", async () => {
    for (const [mode, allow] of [['off', ['owner-uid-1']], ['shadow', ['owner-uid-1']], ['on', ['somebody-else']], ['on', []]]) {
      state.callsMode = mode; state.allow = allow;
      activeDb = makeDb();
      const res = await post(answerBody());
      expect(res.statusCode, `${mode}/${allow}`).toBe(404);
      expect(res.body).toEqual({ error: 'cockpit_unavailable' });
      expect(activeDb.__access.reads).toEqual([`agentBattles/${BATTLE_ID}`]);
      expect(callReads(activeDb)).toBe(0);
      expect(touches(activeDb)).toEqual({ reads: 0, writes: 0, queries: 0 });
    }
  });
});

describe('rows 3–5: the call, the identical repeat, a different answer', () => {
  it('an unknown call → 400 unknown_call', async () => {
    const res = await post(answerBody({ callId: 'nope' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'unknown_call' });
  });

  it('an IDENTICAL repeat returns the stored response and event with 200 — even after the call HIT, with a stale belief, over budget and with another call pending', async () => {
    const first = await post(answerBody());
    expect(first.statusCode).toBe(200);
    const stored1 = stored(activeDb, P('calls', CALL));
    // The call hits; the parent moves on (a new slot, no budget left).
    activeDb.__docs.set(P('calls', CALL), { ...stored1, state: 'hit', stateSource: 'check' });
    activeDb.__docs.set(`agentBattles/${BATTLE_ID}`, { ...stored(activeDb, `agentBattles/${BATTLE_ID}`), chatBudgetUsed: 10, directive: { text: 'x', expiry: 'end_of_battle', directiveThreadId: 'thread-newer', createdAt: 'c' } });
    const writesBefore = activeDb.__access.writes.length;
    const again = await post(answerBody({ expectedDirectiveThreadId: 'wrong-belief' }));
    expect(again.statusCode).toBe(200);
    expect(again.body.repeat).toBe(true);
    expect(again.body.playerResponse).toEqual(stored1.playerResponse);
    expect(again.body.directiveThreadId).toBe(stored1.directiveThreadId);
    expect(again.body.event).toEqual(first.body.event);
    expect(activeDb.__access.writes.length).toBe(writesBefore); // nothing written, nothing charged
  });

  it('a DIFFERENT answer after one stands → 409 already_answered, nothing written; a pick with a different symbol is a different answer', async () => {
    expect((await post(answerBody())).statusCode).toBe(200);
    const writesBefore = activeDb.__access.writes.length;
    const res = await post(answerBody({ answer: 'go' }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'refused', reason: 'already_answered' });
    expect(activeDb.__access.writes.length).toBe(writesBefore);
    // Pick: AMD then JPM.
    activeDb = makeDb();
    expect((await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'AMD' }))).statusCode).toBe(200);
    const other = await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'JPM', expectedDirectiveThreadId: stored(activeDb, P('calls', PICK)).directiveThreadId }));
    expect(other.statusCode).toBe(409);
    expect(other.body.reason).toBe('already_answered');
    const same = await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'amd' })); // normalized symbol, identical
    expect(same.statusCode).toBe(200);
    expect(same.body.repeat).toBe(true);
  });
});

describe('row 6: acknowledgments — uncharged, no directive, no pending check (Amendment B §1)', () => {
  it('go on an act-default open call: playerResponse{kind:ack} + the answered event; no slot, no exchange, no charge, no queue work', async () => {
    const res = await post(answerBody({ answer: 'go', expectedDirectiveThreadId: 'ignored-for-acks' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.playerResponse).toEqual({ answer: 'go', kind: 'ack', callId: CALL, filedAt: new Date(NOW).toISOString() });
    expect(res.body.directiveThreadId).toBeNull();
    const call = stored(activeDb, P('calls', CALL));
    expect(call.playerResponse.kind).toBe('ack');
    expect(call.directiveThreadId).toBeNull();
    expect(call.refused).toBeNull();
    const parent = stored(activeDb, `agentBattles/${BATTLE_ID}`);
    expect(parent.directive).toBeNull();
    expect(parent.chatExchanges).toEqual([]);
    expect(parent.chatBudgetUsed).toBe(0);
    expect(stored(activeDb, `callSweepQueue/${BATTLE_ID}`)).toBeNull();
    const events = storedUnder(activeDb, `agentBattles/${BATTLE_ID}/callEvents`);
    expect(Object.keys(events)).toEqual([`${CALL}:answered:${CALL}:answer:go:`]);
    expect(events[`${CALL}:answered:${CALL}:answer:go:`]).toMatchObject({ kind: 'answered', at: NOW, callIds: [CALL], text: 'Answered: Go' });
  });

  it('hold on a hold-default open call is an acknowledgment too', async () => {
    const res = await post(answerBody({ callId: HOLD_CALL, answer: 'hold' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.playerResponse.kind).toBe('ack');
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).directive).toBeNull();
  });

  it('an ack on a call past its deadline or no longer open → 409 expired, nothing written', async () => {
    vi.setSystemTime(new Date(CLOSE + 1));
    expect((await post(answerBody({ answer: 'go' }))).body).toEqual({ error: 'refused', reason: 'expired' });
    vi.setSystemTime(new Date(NOW));
    activeDb = makeDb({ calls: { [CALL]: shot(CALL, { state: 'expired_unresolved' }) } });
    expect((await post(answerBody({ answer: 'go' }))).body).toEqual({ error: 'refused', reason: 'expired' });
    expect(stored(activeDb, P('calls', CALL)).playerResponse).toBeNull();
  });

  it('agree / disagree: a TERMINAL pick whose outcome shows the agent\'s own choice — allowed on a COMPLETED parent; an open pick or one without a choice is not an answer', async () => {
    const resolved = pickCall({ state: 'expired_unresolved', outcome: { actedEvalId: 'eval_003', receiptRef: 'r' } });
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, status: 'completed' }), calls: { [PICK]: resolved } });
    const res = await post(answerBody({ callId: PICK, answer: 'disagree' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.playerResponse).toMatchObject({ answer: 'disagree', kind: 'ack' });
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatBudgetUsed).toBe(0);
    activeDb = makeDb();
    expect((await post(answerBody({ callId: PICK, answer: 'agree' }))).body).toEqual({ error: 'illegal_answer', reason: 'pick_not_resolved' });
    activeDb = makeDb({ calls: { [PICK]: pickCall({ state: 'expired_unresolved', outcome: { receiptRef: 'r' } }) } });
    expect((await post(answerBody({ callId: PICK, answer: 'agree' }))).body).toEqual({ error: 'illegal_answer', reason: 'pick_outcome_shows_no_choice' });
  });

  it('illegal pairings → 400 illegal_answer: go_now on act-default, go on hold-default, agree on a shot, hold on a pick', async () => {
    for (const [callId, answer] of [[CALL, 'go_now'], [HOLD_CALL, 'go'], [CALL, 'agree'], [PICK, 'hold']]) {
      const res = await post(answerBody({ callId, answer }));
      expect(res.statusCode, `${callId} ${answer}`).toBe(400);
      expect(res.body.error).toBe('illegal_answer');
    }
    expect(classifyAnswer(shot(CALL), 'hold')).toBe('directive');
    expect(classifyAnswer(shot(CALL), 'go')).toBe('ack');
    expect(classifyAnswer(pickCall(), 'pick')).toBe('directive');
    expect(classifyAnswer(pickCall(), 'disagree')).toBe('ack');
    expect(classifyAnswer(shot(CALL, { defaultAction: null }), 'go')).toBeNull();
  });
});

describe('rows 7–8: directive answers — the guards in order, then one commit', () => {
  it('hold on an act-default call FILES: playerResponse{kind:directive}, the top-level thread, the slot, the cockpit exchange, the charge, the answered event, the queue enrollment — one message, one transaction', async () => {
    const res = await post(answerBody());
    expect(res.statusCode).toBe(200);
    const thread = res.body.directiveThreadId;
    expect(thread).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.playerResponse).toEqual({ answer: 'hold', kind: 'directive', directiveThreadId: thread, callId: CALL, filedAt: new Date(NOW).toISOString(), heardEvalId: null });
    expect(res.body.remaining).toBe(BATTLE_CHAT_BUDGET.limit - 1);
    const call = stored(activeDb, P('calls', CALL));
    expect(call.playerResponse).toEqual(res.body.playerResponse);
    expect(call.directiveThreadId).toBe(thread);
    expect(call.refused).toBeNull();
    const parent = stored(activeDb, `agentBattles/${BATTLE_ID}`);
    expect(parent.directive).toEqual({
      text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: thread, createdAt: new Date(NOW).toISOString(),
      family: 'call', expiresAtMs: CLOSE, basis: 'this_session', callId: CALL, kind: 'call_hold',
      action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' }, answerId: `${CALL}:answer:hold:`, filedAt: new Date(NOW).toISOString(), textVersion: 'callActions.v1',
    });
    expect(res.body.directive).toEqual(parent.directive);
    expect(parent.chatBudgetUsed).toBe(1);
    expect(parent.chatExchanges).toHaveLength(1);
    const ex = parent.chatExchanges[0];
    expect(ex).toMatchObject({ userMessage: null, agentResponse: '', hasDirective: true, directiveThreadId: thread, messageType: 'directive_filed', source: 'cockpit', groundingVersion: 1, callId: CALL, mode: 'battle', elicitationTarget: 'directive_filed' });
    expect(ex.directive).toEqual({ ...parent.directive, createdAt: undefined, });
    expect(ex.directive).not.toHaveProperty('createdAt');
    expect(ex).not.toHaveProperty('supersedes');
    const events = storedUnder(activeDb, `agentBattles/${BATTLE_ID}/callEvents`);
    expect(events[`${CALL}:answered:${CALL}:answer:hold:`]).toMatchObject({ kind: 'answered', at: NOW, callIds: [CALL], text: "Answered: Hold off — Hold off on the AMD entry until today's close." });
    expect(res.body.event).toEqual(events[`${CALL}:answered:${CALL}:answer:hold:`]);
    expect(stored(activeDb, `callSweepQueue/${BATTLE_ID}`)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: null, pendingHeard: [CALL], updatedAt: NOW });
    expect(activeDb.__txAttempts).toBe(1);
  });

  it('go_now on a hold-default call and a pick with a stored option file their kinds; the pick\'s selection lives in the directive record (action.pickSymbol) and the exchange is durable', async () => {
    const go = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    expect(go.statusCode).toBe(200);
    expect(go.body.directive.kind).toBe('call_go');
    expect(go.body.directive.text).toBe("If KO below $62.50 by today's close, go ahead and exit for AMD.");
    expect(stored(activeDb, `callSweepQueue/${BATTLE_ID}`).pendingHeard).toEqual([HOLD_CALL]);
    // A fresh battle for the pick (the go directive above would be PENDING — the row below proves that refusal).
    activeDb = makeDb({ queue: { battleId: BATTLE_ID, nextExpiresAt: CLOSE, updatedAt: NOW - 1 } }); // a legacy Build 0 row, normalized on read
    const pick = await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'JPM' }));
    expect(pick.statusCode).toBe(200);
    expect(pick.body.directive).toMatchObject({ kind: 'call_pick', text: 'Bring in JPM for KO at the next check.', expiresAtMs: SLOT + 900_000, basis: 'next_check', action: { pickSymbol: 'JPM', swapOut: 'KO', slot: 'support' } });
    const parent = stored(activeDb, `agentBattles/${BATTLE_ID}`);
    expect(parent.chatExchanges).toHaveLength(1);
    expect(parent.chatExchanges[0].directive.action.pickSymbol).toBe('JPM');
    expect(parent.chatBudgetUsed).toBe(1);
    expect(stored(activeDb, `callSweepQueue/${BATTLE_ID}`)).toEqual({ battleId: BATTLE_ID, nextExpiresAt: CLOSE, pendingHeard: [PICK], updatedAt: NOW });
  });

  it('a legal answer is rejected in order: not open → expired; past the deadline → expired; parent not active → parent_not_active; stale belief → belief_mismatch', async () => {
    activeDb = makeDb({ calls: { [CALL]: shot(CALL, { state: 'hit' }) } });
    expect((await post(answerBody())).body).toEqual({ error: 'refused', reason: 'expired' });
    activeDb = makeDb();
    vi.setSystemTime(new Date(CLOSE));
    expect((await post(answerBody())).body).toEqual({ error: 'refused', reason: 'expired' });
    vi.setSystemTime(new Date(NOW));
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, status: 'completed' }) });
    expect((await post(answerBody())).body).toEqual({ error: 'refused', reason: 'parent_not_active' });
    activeDb = makeDb({ battle: makeTickBattle({ directive: { text: 'x', expiry: 'end_of_battle', directiveThreadId: 'thread-cur', createdAt: 'c' } }) });
    const res = await post(answerBody({ expectedDirectiveThreadId: null }));
    expect(res.body).toEqual({ error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: 'thread-cur' });
    expect((await post(answerBody({ expectedDirectiveThreadId: 'thread-cur' }))).statusCode).toBe(200); // the right belief over an ORDINARY slot files
    for (const db of [activeDb]) expect(stored(db, P('calls', CALL)).refused).toBeNull();
  });

  it('an INELIGIBLE action → 400: a pick option not stored / not in the universe / already held / swap-out moved; an exit whose symbol moved', async () => {
    expect((await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'MSFT' }))).body).toEqual({ error: 'ineligible_action', reason: 'pick_not_an_option' });
    activeDb = makeDb({ calls: { [PICK]: pickCall({ options: [{ symbol: 'ZZZZ', why: 'x' }] }) } });
    expect((await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'ZZZZ' }))).body).toEqual({ error: 'ineligible_action', reason: 'pick_outside_universe' });
    const held = makeTickBattle({ directive: null }); held.portfolio.core.push({ symbol: 'JPM', name: 'JPMorgan' });
    activeDb = makeDb({ battle: held });
    expect((await post(answerBody({ callId: PICK, answer: 'pick', pickSymbol: 'JPM' }))).body).toEqual({ error: 'ineligible_action', reason: 'pick_already_held' });
    const moved = makeTickBattle({ directive: null }); moved.portfolio.support = moved.portfolio.support.filter((r) => r.symbol !== 'KO');
    activeDb = makeDb({ battle: moved });
    expect((await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }))).body).toEqual({ error: 'ineligible_action', reason: 'symbol_not_held' });
    expect(stored(activeDb, P('calls', HOLD_CALL)).playerResponse).toBeNull();
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatBudgetUsed).toBe(0);
  });

  it("the battle's agent: a missing agent doc or an underivable archetype files nothing (the request carries no agentId to bind — review L4-10)", async () => {
    activeDb = makeDb({ agent: null });
    activeDb.__docs.delete('agents/agent-1');
    expect((await post(answerBody())).body).toEqual({ error: 'agent_binding', reason: 'agent_not_found' });
    const noArch = makeTickBattle({ directive: null }); noArch.agentContext = { ...noArch.agentContext, archetype: null };
    activeDb = makeDb({ battle: noArch, agent: { name: 'x' } });
    expect((await post(answerBody())).body).toEqual({ error: 'agent_binding', reason: 'archetype_unknown' });
  });

  it('the guards are ORDERED, not just present: one state that trips several resolves to the FIRST — expired, then parent_not_active, then belief_mismatch, then directive_pending (review L4-2)', async () => {
    const first = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    expect(first.statusCode).toBe(200);
    const pendingThread = first.body.directiveThreadId;
    const battleRef = `agentBattles/${BATTLE_ID}`;
    // The target call HIT, the parent completed, the belief stale, another directive pending: expired wins.
    activeDb.__docs.set(P('calls', CALL), { ...stored(activeDb, P('calls', CALL)), state: 'hit' });
    activeDb.__docs.set(battleRef, { ...stored(activeDb, battleRef), status: 'completed' });
    expect((await post(answerBody({ expectedDirectiveThreadId: null }))).body).toEqual({ error: 'refused', reason: 'expired' });
    activeDb.__docs.set(P('calls', CALL), { ...stored(activeDb, P('calls', CALL)), state: 'open' });
    expect((await post(answerBody({ expectedDirectiveThreadId: null }))).body).toEqual({ error: 'refused', reason: 'parent_not_active' });
    activeDb.__docs.set(battleRef, { ...stored(activeDb, battleRef), status: 'active' });
    expect((await post(answerBody({ expectedDirectiveThreadId: null }))).body).toEqual({ error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: pendingThread });
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
    expect((await post(answerBody({ expectedDirectiveThreadId: pendingThread }))).body).toEqual({ error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: pendingThread, pendingCallId: HOLD_CALL });
    expect(stored(activeDb, P('calls', CALL)).refused).toMatchObject({ reason: 'directive_pending' });
  });

  it('a pending call-family slot whose thread the control epoch KILLED no longer blocks: the new answer files and `refused` stays null (review L4-3)', async () => {
    const first = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    const pendingThread = first.body.directiveThreadId;
    const battleRef = `agentBattles/${BATTLE_ID}`;
    activeDb.__docs.set(battleRef, { ...stored(activeDb, battleRef), controlEpochLog: [{ suppressedDirectiveIds: [pendingThread] }] });
    const res = await post(answerBody({ callId: CALL, answer: 'hold', expectedDirectiveThreadId: pendingThread }));
    expect(res.statusCode).toBe(200);
    expect(res.body.directiveThreadId).toBeTruthy();
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
    expect(stored(activeDb, battleRef).directive.directiveThreadId).toBe(res.body.directiveThreadId);
  });

  it('replacing an EXPIRED call-family slot from the endpoint creates the `superseded` event in the same transaction, at the prior thread\'s id (review L4-4)', async () => {
    const first = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    const pendingThread = first.body.directiveThreadId;
    const battleRef = `agentBattles/${BATTLE_ID}`;
    const parent = stored(activeDb, battleRef);
    activeDb.__docs.set(battleRef, { ...parent, directive: { ...parent.directive, expiresAtMs: NOW - 1 } }); // the pending directive's lifetime is over
    const later = await post(answerBody({ callId: CALL, answer: 'hold', expectedDirectiveThreadId: pendingThread }));
    expect(later.statusCode).toBe(200);
    expect(storedUnder(activeDb, `agentBattles/${BATTLE_ID}/callEvents`)[`${pendingThread}:superseded`]).toMatchObject({ kind: 'superseded', callIds: [HOLD_CALL], supersededBy: later.body.directiveThreadId, supersededDirectiveThreadId: pendingThread });
    expect(stored(activeDb, battleRef).chatExchanges[1].supersedes).toEqual({ directiveThreadId: pendingThread, at: expect.any(String) });
  });

  it('boundary instants (review L4-8): an ack or a directive answer at EXACTLY the deadline is expired; one millisecond before, it lands', async () => {
    vi.setSystemTime(new Date(CLOSE));
    expect((await post(answerBody({ answer: 'go' }))).body).toEqual({ error: 'refused', reason: 'expired' });
    expect((await post(answerBody({ answer: 'hold' }))).body).toEqual({ error: 'refused', reason: 'expired' });
    vi.setSystemTime(new Date(CLOSE - 1));
    expect((await post(answerBody({ answer: 'go' }))).statusCode).toBe(200);
  });

  it('ANOTHER call-family directive pending in the slot → 409 directive_pending, and `refused` is written on THIS call — the only persisted refusal', async () => {
    const first = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    expect(first.statusCode).toBe(200);
    const pendingThread = first.body.directiveThreadId;
    const res = await post(answerBody({ callId: CALL, answer: 'hold', expectedDirectiveThreadId: pendingThread }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: pendingThread, pendingCallId: HOLD_CALL });
    const call = stored(activeDb, P('calls', CALL));
    expect(call.refused).toEqual({ at: new Date(NOW).toISOString(), reason: 'directive_pending', pendingDirectiveThreadId: pendingThread, pendingCallId: HOLD_CALL });
    expect(call.playerResponse).toBeNull();
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatBudgetUsed).toBe(1); // the first filing only
    // Past the pending directive's lifetime the slot no longer blocks (it is replaced, latest-wins, with the right belief).
    vi.setSystemTime(new Date(CLOSE - 1));
    activeDb.__docs.set(`agentBattles/${BATTLE_ID}`, { ...stored(activeDb, `agentBattles/${BATTLE_ID}`), directive: { ...stored(activeDb, `agentBattles/${BATTLE_ID}`).directive, expiresAtMs: NOW + 1 } });
    const later = await post(answerBody({ callId: CALL, answer: 'hold', expectedDirectiveThreadId: pendingThread }));
    expect(later.statusCode).toBe(200);
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatExchanges[1].supersedes.directiveThreadId).toBe(pendingThread);
  });

  it('an ACKNOWLEDGMENT on another call is accepted while a call directive is pending: the pending check guards the directive rows only, and the slot is untouched (Amendment C rev 3, standing conditions)', async () => {
    const first = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    expect(first.statusCode).toBe(200);
    const pendingThread = first.body.directiveThreadId;
    const res = await post(answerBody({ callId: CALL, answer: 'go', expectedDirectiveThreadId: null }));
    expect(res.statusCode).toBe(200);
    expect(res.body.playerResponse).toMatchObject({ answer: 'go', kind: 'ack' });
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).directive.directiveThreadId).toBe(pendingThread);
  });

  it('no refusal but directive_pending is ever persisted: expired, belief_mismatch, parent_not_active, budget, already_answered leave `refused` null', async () => {
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, chatBudgetUsed: 10 }) });
    expect((await post(answerBody())).body).toEqual({ error: 'refused', reason: 'budget' });
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
    activeDb = makeDb({ battle: makeTickBattle({ directive: { text: 'x', expiry: 'end_of_battle', directiveThreadId: 't', createdAt: 'c' } }) });
    expect((await post(answerBody())).body.reason).toBe('belief_mismatch');
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
  });

  it('the budget: a standard battle charges chatBudgetUsed once per accepted directive and refuses at the cap; a League battle charges the League store inside the same transaction', async () => {
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, chatBudgetUsed: 9 }) });
    const ok = await post(answerBody());
    expect(ok.statusCode).toBe(200);
    expect(ok.body.remaining).toBe(0);
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatBudgetUsed).toBe(10);
    // At the cap (a fresh battle with no directive pending — the pending guard precedes the budget in the table).
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, chatBudgetUsed: 10 }) });
    const next = await post(answerBody({ callId: HOLD_CALL, answer: 'go_now' }));
    expect(next.body).toEqual({ error: 'refused', reason: 'budget' });
    expect(stored(activeDb, P('calls', HOLD_CALL)).playerResponse).toBeNull();
    // League.
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, gameMode: 'baggerbomb_tournament', groupId: 'group-xyz' }) });
    const league = await post(answerBody());
    expect(league.statusCode).toBe(200);
    expect(league.body.remaining).toBe(9);
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatBudgetUsed).toBe(0);
    expect(stored(activeDb, 'agentChatBudget/group-xyz_owner-uid-1_3')).toMatchObject({ count: 1, uid: 'owner-uid-1', dayN: 3 });
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).chatExchanges[0].groupId).toBe('group-xyz');
  });

  it('the League cap is >= the daily limit: a budget doc already AT 10 refuses (409 budget) and writes nothing; one below files and lands exactly at 10 (mutation M15)', async () => {
    const budgetDoc = (count) => ({ 'agentChatBudget/group-xyz_owner-uid-1_3': { groupId: 'group-xyz', uid: 'owner-uid-1', dayN: 3, count, updatedAt: '2026-09-09T13:00:00.000Z' } });
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, gameMode: 'baggerbomb_tournament', groupId: 'group-xyz' }), extra: budgetDoc(10) });
    const atCap = await post(answerBody());
    expect(atCap.statusCode).toBe(409);
    expect(atCap.body).toEqual({ error: 'refused', reason: 'budget' });
    expect(stored(activeDb, P('calls', CALL)).playerResponse).toBeNull();
    expect(stored(activeDb, P('calls', CALL)).refused).toBeNull();
    expect(stored(activeDb, `agentBattles/${BATTLE_ID}`).directive).toBeNull();
    expect(stored(activeDb, 'agentChatBudget/group-xyz_owner-uid-1_3').count).toBe(10);
    activeDb = makeDb({ battle: makeTickBattle({ directive: null, gameMode: 'baggerbomb_tournament', groupId: 'group-xyz' }), extra: budgetDoc(9) });
    const below = await post(answerBody());
    expect(below.statusCode).toBe(200);
    expect(below.body.remaining).toBe(0);
    expect(stored(activeDb, 'agentChatBudget/group-xyz_owner-uid-1_3').count).toBe(10);
  });

  it('a competing write between the reads and the commit: the body re-runs against the changed documents (one charge, one event, no double filing)', async () => {
    let injected = false;
    activeDb.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt === 1 && !injected) {
        injected = true;
        // A chat turn lands a directive in the slot meanwhile.
        const parent = stored(activeDb, `agentBattles/${BATTLE_ID}`);
        await activeDb.doc(`agentBattles/${BATTLE_ID}`).update({ directive: { text: 'x', expiry: 'end_of_battle', directiveThreadId: 'thread-chat', createdAt: 'c' } });
        void parent;
      }
    };
    const res = await post(answerBody());
    expect(activeDb.__txAttempts).toBe(2);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'refused', reason: 'belief_mismatch', currentDirectiveThreadId: 'thread-chat' });
    expect(stored(activeDb, P('calls', CALL)).playerResponse).toBeNull();
    expect(Object.keys(storedUnder(activeDb, `agentBattles/${BATTLE_ID}/callEvents`))).toEqual([]);
  });

  it('the cockpit exchange builder is the one the route writes (chip-shaped, source cockpit, the call id)', () => {
    const ex = buildCockpitExchange({ record: { text: 't', expiry: 'until_ms', directiveThreadId: 'th', family: 'call' }, directiveThreadId: 'th', createdAt: 'c', callId: CALL, groupId: 'g' });
    expect(ex).toEqual({
      userMessage: null, agentResponse: '', scratchpad: null, hasDirective: true, directive: { text: 't', expiry: 'until_ms', directiveThreadId: 'th', family: 'call' },
      directiveThreadId: 'th', suggestedActions: null, elicitationTarget: 'directive_filed', timestamp: 'c', mode: 'battle', messageType: 'directive_filed', source: 'cockpit', groundingVersion: 1, callId: CALL, groupId: 'g',
    });
  });
});

describe('nothing in the endpoint enforces an answer or trades (spec §1 "Out: enforcement")', () => {
  it("the pending guard carries the renderer's suppression state (integrity mode not 'enforce' → never pending), source-pinned (review L1-3 / L5-10)", async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), './call-response.js'), 'utf8');
    expect(src).toContain("suppressed: ARCHETYPE_INTEGRITY_MODE !== 'enforce'");
    expect(src).toContain("import { ARCHETYPE_INTEGRITY_MODE } from '../../src/config/featureFlags.js';");
  });

  it('the module imports no executor, no trade validator and no fenced module; it never calls executeSwapServer', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'call-response.js'), 'utf8');
    expect(src).not.toMatch(/agentSwapExecution|executeSwapServer|agentEvalToolResultValidation|agent\/decide|agentPromptAssembly|agentEvalPromptAssembly|agentScoring|agentRiskManager|agentGuardrails|archetypeScoring|agentArchetypeConfig|agentBattleService/);
  });
});

// ---------------------------------------------------------------------------
// Cockpit Build 2a — Amendment C-2 and the shared legality table (spec S-4).
describe('Build 2a: an upside call accepts NO answer, and the legality table has one home', () => {
  const UPSIDE = `${BATTLE_ID}:eval_001:call:9`;
  const upside = (over = {}) => shot(UPSIDE, { symbol: 'TSLA', heldAtMint: true, slot: 'star', counterpart: null, condition: { side: 'above', level: 250 }, ...over });

  it('every 1a answer on a heldAtMint call → 400 illegal_answer (reason upside_call), nothing written — whatever its default', async () => {
    for (const defaultAction of ['act', 'hold']) {
      activeDb = makeDb({ calls: { [UPSIDE]: upside({ defaultAction }) } });
      for (const answer of ANSWERS_1A) {
        resetCallResponseRateLimit();
        const res = await post(answerBody({ callId: UPSIDE, answer, ...(answer === 'pick' ? { pickSymbol: 'AMD' } : {}) }));
        expect(res.statusCode, `${defaultAction}/${answer}`).toBe(400);
        expect(res.body, `${defaultAction}/${answer}`).toEqual({ error: 'illegal_answer', reason: 'upside_call' });
      }
      expect(activeDb.__access.writes, defaultAction).toEqual([]);
    }
  });

  it('a record minted before the amendment (no heldAtMint) reads as false: its answers are judged exactly as before', async () => {
    const legacy = shot(UPSIDE, { symbol: 'AMD' });
    expect('heldAtMint' in legacy).toBe(false);
    activeDb = makeDb({ calls: { [UPSIDE]: legacy } });
    const res = await post(answerBody({ callId: UPSIDE, answer: 'go' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.playerResponse).toMatchObject({ answer: 'go', kind: 'ack' });
  });

  it("the endpoint's table IS the shared module's (re-exported, never copied)", async () => {
    const shared = await import('../_utils/callRecords/answers.js');
    expect(classifyAnswer).toBe(shared.classifyAnswer);
    expect(ANSWERS_1A).toBe(shared.ANSWERS_1A);
    expect(DEFERRED_ANSWERS).toBe(shared.DEFERRED_ANSWERS);
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'call-response.js'), 'utf8');
    expect(src).not.toMatch(/export function classifyAnswer/);
    expect(src).toContain("from '../_utils/callRecords/answers.js'");
  });
});
