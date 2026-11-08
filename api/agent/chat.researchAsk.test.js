// api/agent/chat.researchAsk.test.js
//
// Research Modal Build C — THE ASK through chat.js (spec BC-7, §4.3): one
// message from the per-battle chat 10, the pack as a named prompt input, the
// exchange id minted once (before the write, so the shared writer's retry
// re-sends the same object), the id on the response for a sheet Ask only, and
// every refusal BEFORE the one write (nothing charged). The harness is
// chat.test.js's (Firestore, auth, the model and the prompt builder are fakes;
// the shared slot writer is REAL).

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const H = vi.hoisted(() => ({
  gemma: { impl: async () => '{"response":"Item 1 carries it: the +15 is banked."}' },
  promptArgs: [],
  archetype: { mode: 'off' },
  market: { state: 'OPEN' },
}));
let activeFirestore = null;
// Counts node:crypto randomUUID calls in chat.js (the exchange id is minted once per sheet Ask).
const CRYPTO = vi.hoisted(() => ({ calls: 0 }));
vi.mock('node:crypto', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, randomUUID: () => { CRYPTO.calls += 1; return actual.randomUUID(); } }; });

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'test-user' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async () => true }));
vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildVoiceLayerPrompt: (args) => { H.promptArgs.push(args); return 'system-prompt-stub'; },
}));
vi.mock('../_utils/tournamentTime.js', () => ({ getTournamentClaimWindow: () => ({ isOpen: true, etTime: '12:00', reason: null }), formatEtDate: () => '2026-06-26' }));
// Only the market state is driven; the calendar (horizon.js, the banked item's next check) is the real one.
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), getMarketState: () => ({ state: H.market.state, isOpen: H.market.state === 'OPEN' }) }));
vi.mock('../_utils/gemmaClient.js', () => ({ callGemmaVoice: (o) => H.gemma.impl(o), parseVoiceLayerResponse: (c) => JSON.parse(c) }));
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return H.archetype.mode; },
  get LEAGUE_AGENT_CHAT_ENABLED() { return true; },
  getVoiceGroundingMode: () => 'off',
  get SHOW_IT_ENABLED() { return false; },
  get DIRECTIVE_FIT_CHECK_ENABLED() { return false; },
  get CALL_RECORDS_MODE() { return 'off'; },
}));
vi.mock('../_utils/agentChatBudget.js', () => ({
  AGENT_CHAT_DAILY_LIMIT: 10,
  resolveBudgetDay: async () => null,
  readAgentChatBudget: async () => ({ count: 0, remaining: 10 }),
  chargeAgentChatBudget: async () => ({ charged: true, remaining: 9, count: 1 }),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { default: handler } = await import('./chat.js');
const { buildPacks } = await import('../../src/components/Research/Sheet/packs.js');
const { measuredSheetBattle, SHEET_NOW, AAPL_DAILY, RANKINGS } = await import('../../src/components/Research/Sheet/__fixtures__/sheetBattles.js');

const AGENT = { ownerId: 'test-user', name: 'Juno', archetype: 'momentum_chaser', partnerProfile: {} };
let BATTLE;
let PACK;
beforeAll(async () => {
  BATTLE = { ...(await measuredSheetBattle({ archetype: 'momentum_chaser' })), ownerId: 'test-user', agentId: 'agent-1', recentElicitationTargets: [] };
  PACK = buildPacks({ battle: BATTLE, symbol: 'AAPL', nowMs: SHEET_NOW, row: { positionId: 'position-agent' }, live: 103.2, dailyBars: AAPL_DAILY, rankings: RANKINGS, standing: { player: 62, opponent: 68 }, directive: BATTLE.directive, battleId: 'battle-1' }).packs.protect_lead;
});

/** A Firestore double: update() records; batch() records; `failFirstCommit` makes the shared writer's batch throw ALREADY_EXISTS once (its retry path). */
function fakeFirestore({ battle, failFirstCommit = false }) {
  const writes = [];
  let commits = 0;
  const collection = (name) => ({
    doc: (id) => ({
      id,
      get: async () => (name === 'agents' ? { exists: true, data: () => AGENT } : name === 'agentBattles' ? { exists: true, data: () => JSON.parse(JSON.stringify(battle)) } : { exists: false, data: () => null }),
      update: async (u) => { writes.push({ kind: 'update', id, updates: u }); },
      collection: () => ({ where: () => ({}), doc: (sub) => ({ id: sub, path: `${name}/${id}/x/${sub}` }) }),
    }),
  });
  const batch = () => {
    const ops = [];
    return {
      update: (ref, u) => ops.push({ id: ref.id, updates: u }), create: () => {},
      commit: async () => { commits += 1; if (failFirstCommit && commits === 1) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; } writes.push(...ops.map((o) => ({ kind: 'batch', ...o }))); },
    };
  };
  return { db: { collection, batch }, writes };
}
const call = async (body, battle = BATTLE, opts = {}) => {
  H.promptArgs.length = 0;
  const fx = fakeFirestore({ battle, ...opts });
  activeFirestore = fx.db;
  const req = { method: 'POST', body, headers: { authorization: 'Bearer x' } };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler(req, res);
  return { res, writes: fx.writes };
};
const askBody = (over = {}) => ({ agentId: 'agent-1', battleId: 'battle-1', message: 'Does this protect the lead? — AAPL', researchAsk: { symbol: 'AAPL', questionId: 'protect_lead', items: PACK.items }, ...over });
const exchangesOf = (writes) => writes.flatMap((w) => w.updates?.chatExchanges?.items ?? []);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  H.archetype.mode = 'off';
  H.market.state = 'OPEN';
  H.gemma.impl = async () => '{"response":"Item 1 carries it: the +15 is banked."}';
});

describe('a sheet Ask is one ordinary chat turn that spends one message', () => {
  it('one write: the exchange AND the per-battle charge, together', async () => {
    const { res, writes } = await call(askBody());
    expect(res.statusCode).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0].updates.chatBudgetUsed).toEqual({ __op: 'increment', n: 1 });
    expect(exchangesOf(writes)).toHaveLength(1);
  });
  it('the exchange carries a v4 exchangeId, source research_modal and the question; the response carries the same id', async () => {
    const { res, writes } = await call(askBody());
    const [ex] = exchangesOf(writes);
    expect(ex.exchangeId).toMatch(UUID);
    expect(ex.source).toBe('research_modal');
    expect(ex.researchAsk).toEqual({ symbol: 'AAPL', questionId: 'protect_lead' });
    expect(ex.userMessage).toBe('Does this protect the lead? — AAPL');
    expect(ex.agentResponse).toBe('Item 1 carries it: the +15 is banked.');
    expect(res.body.exchangeId).toBe(ex.exchangeId);
    expect(res.body.agentMessage).toBe(ex.agentResponse);
  });
  it('a different id on every Ask', async () => {
    const a = exchangesOf((await call(askBody())).writes)[0].exchangeId;
    const b = exchangesOf((await call(askBody())).writes)[0].exchangeId;
    expect(a).not.toBe(b);
  });
  it('the pack reaches the prompt builder as the named input `researchAsk`, its items re-read by the server', async () => {
    await call(askBody());
    const [args] = H.promptArgs;
    expect(args.researchAsk.symbol).toBe('AAPL');
    expect(args.researchAsk.question).toBe('Does this protect the lead?');
    expect(args.researchAsk.items.map((i) => [i.kind, i.status])).toEqual([['banked', 'verified'], ['drawdown', 'unverified'], ['risk_lever', 'verified'], ['idea', 'verified'], ['told_it', 'verified']]);
  });
  it('a non-research turn: no researchAsk input, no exchangeId, no source, nothing on the response', async () => {
    const { res, writes } = await call({ agentId: 'agent-1', battleId: 'battle-1', message: 'How is AAPL?' });
    expect('researchAsk' in H.promptArgs[0]).toBe(false);
    const [ex] = exchangesOf(writes);
    expect(ex).not.toHaveProperty('exchangeId');
    expect(ex).not.toHaveProperty('source');
    expect(ex).not.toHaveProperty('researchAsk');
    expect(res.body).not.toHaveProperty('exchangeId');
  });
});

describe('the exchange id is minted once — the shared writer\'s retry re-sends the same object', () => {
  it('chat.js mints it ONCE per sheet Ask (no directive filed: one randomUUID call), on the object it hands the writer', async () => {
    CRYPTO.calls = 0;
    const { res, writes } = await call(askBody());
    expect(CRYPTO.calls).toBe(1);
    expect(exchangesOf(writes).map((e) => e.exchangeId)).toEqual([res.body.exchangeId]);
  });
  it('a non-research turn mints none', async () => {
    CRYPTO.calls = 0;
    await call({ agentId: 'agent-1', battleId: 'battle-1', message: 'How is AAPL?' });
    expect(CRYPTO.calls).toBe(0);
  });
  it('the real shared writer, on its ALREADY_EXISTS retry, stores that same object — the id survives the retry', async () => {
    const { fileDirectiveTransactional } = await import('../_utils/directiveWriter.js');
    const slot = { family: 'call', text: 'Exit AAPL at the 1:15 check', directiveThreadId: 'call-thread-1', callId: 'c1' };
    const updates = [];
    const battleRef = { id: 'battle-1', get: async () => ({ exists: true, data: () => ({ directive: slot }) }), update: async (u) => { updates.push(u); } };
    let commits = 0;
    const db = { batch: () => ({ update() {}, create() {}, commit: async () => { commits += 1; const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; } }), collection: () => ({ doc: () => ({ collection: () => ({ doc: (id) => ({ id }) }) }) }) };
    const exchange = { userMessage: 'Does this protect the lead? — AAPL', agentResponse: 'x', directiveThreadId: 'new-thread', timestamp: '2026-10-14T17:07:00.000Z', exchangeId: '6f1c2d4e-8a9b-4c0d-9e1f-2a3b4c5d6e7f', source: 'research_modal' };
    await fileDirectiveTransactional(null, battleRef, { db, battleId: 'battle-1', arrayUnion: (...items) => ({ items }), exchange, filed: true, priorSlot: slot, callsMode: 'on', fields: { chatBudgetUsed: { __op: 'increment', n: 1 } } });
    expect(commits).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].chatExchanges.items.map((e) => e.exchangeId)).toEqual([exchange.exchangeId]);
    expect(updates[0].chatBudgetUsed).toEqual({ __op: 'increment', n: 1 });
  });
});

describe('every refusal comes before the one write: nothing charged', () => {
  it('an invalid researchAsk is a 400 and writes nothing', async () => {
    const { res, writes } = await call(askBody({ researchAsk: { symbol: 'AAPL', questionId: 'what_now', items: PACK.items } }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_research_ask', reason: 'question' });
    expect(writes).toEqual([]);
    const six = await call(askBody({ researchAsk: { symbol: 'AAPL', questionId: 'protect_lead', items: [...PACK.items, PACK.items[0]] } }));
    expect([six.res.statusCode, six.res.body.reason, six.writes]).toEqual([400, 'items', []]);
  });
  it('a sheet Ask never draws the League per-day budget: refused with leagueAsk', async () => {
    const { res, writes } = await call(askBody({ leagueAsk: true }));
    expect([res.statusCode, res.body.error, writes]).toEqual([400, 'research_ask_battle_only', []]);
  });
  it('a sheet Ask in review mode (after the close, a review for today) is refused — never the review budget', async () => {
    H.market.state = 'CLOSED_AFTERHOURS';
    const reviewed = { ...BATTLE, dailyReviews: [{ tradingDay: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) }] };
    const { res, writes } = await call(askBody(), reviewed);
    expect([res.statusCode, res.body.error, writes]).toEqual([400, 'research_ask_battle_only', []]);
  });
  it('budget spent: the ordinary 403, nothing written', async () => {
    const { res, writes } = await call(askBody(), { ...BATTLE, chatBudgetUsed: 10 });
    expect([res.statusCode, res.body.error, writes]).toEqual([403, 'chat_budget_exceeded', []]);
  });
  it('the model answers badly (502) or not at all (504): nothing written', async () => {
    H.gemma.impl = async () => 'not json at all';
    const bad = await call(askBody());
    expect(bad.res.statusCode).toBeGreaterThanOrEqual(500);
    expect(bad.writes).toEqual([]);
    H.gemma.impl = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    const timeout = await call(askBody());
    expect([timeout.res.statusCode, timeout.writes]).toEqual([504, []]);
  });
});
