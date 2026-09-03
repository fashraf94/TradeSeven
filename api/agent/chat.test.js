// api/agent/chat.test.js
//
// Targeted integration coverage for the parseError → 502 banner path
// and the catch-block shadow-logging gap closure added by the Voice
// Layer Snag Bug Fix. Like workshop-chat.test.js, this file is scoped
// narrowly: it does NOT cover the many other handler branches
// (elicitation target, directive normalization, mode detection,
// review lessons, etc.). Those are exercised by manual / E2E tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TOURNAMENT_GAME_MODE, GROUP_STATUS } from '../../src/constants/leagueTournament.js';

// ==================== HOISTED MOCK STATE ====================
const {
  authReturnValue,
  gateArgs,
  authDelayMs,
  callGemmaVoiceImpl,
  parseVoiceLayerResponseImpl,
  shadowLogCalls,
  archetypeFlag,
  voiceLayerArgs,
  leagueChatFlag,
  budget,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gateArgs: { current: [] },     // pass-through capture of gateDirective's args
  authDelayMs: { current: 0 },   // simulates a slow prologue (auth + Firestore reads)
  callGemmaVoiceImpl: { current: async () => '{"response":"hi"}' },
  parseVoiceLayerResponseImpl: { current: (c) => JSON.parse(c) },
  shadowLogCalls: { current: [] },
  archetypeFlag: { mode: 'off' },
  voiceLayerArgs: { current: [] }, // Phase E2 — capture buildVoiceLayerPrompt args
  // League arena two-way ask — the kill-switch flag + a controllable budget module.
  leagueChatFlag: { on: false },
  budget: {
    resolveImpl: () => ({ groupId: 'group-xyz', dayN: 1 }),
    readImpl: async () => ({ count: 0, remaining: 10 }),
    chargeImpl: async () => ({ charged: true, remaining: 9, count: 1 }),
    resolveCalls: [],
    readCalls: [],
    chargeCalls: [],
  },
}));

// ==================== MOCKS ====================

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => activeFirestore,
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authDelayMs.current > 0) await new Promise((r) => setTimeout(r, authDelayMs.current));
    if (authReturnValue.current === null) {
      res.status(401).json({ error: 'auth required' });
      return null;
    }
    return authReturnValue.current;
  },
}));

vi.mock('../_utils/shadowLogger.js', () => ({
  logConversation: async (record) => {
    shadowLogCalls.current.push(record);
  },
}));

vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildVoiceLayerPrompt: (args) => { voiceLayerArgs.current.push(args); return 'system-prompt-stub'; },
}));

// Phase E2 — deterministic ET-clock helpers so the manifest's claim-window /
// flip-reset reads do not depend on the wall clock. chat.js is the only unit under
// test that imports these, so the mock is inert for every other handler path.
vi.mock('../_utils/tournamentTime.js', () => ({
  getTournamentClaimWindow: () => ({ isOpen: true, etTime: '12:00', reason: null }),
  formatEtDate: () => '2026-06-26',
}));

// Pass-through spy on the directive gate. importOriginal keeps the REAL
// implementation — the ten archetype tests below still exercise it unchanged —
// while making its arguments observable, which is the only way to prove
// TURN_DEADLINE_MS is actually WIRED and not merely pinned.
vi.mock('../_utils/directiveGate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    gateDirective: (args) => { gateArgs.current.push(args); return actual.gateDirective(args); },
  };
});

vi.mock('../_utils/marketSchedule.js', () => ({
  getMarketState: () => ({ state: 'OPEN', isOpen: true }),
}));

vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: (opts) => callGemmaVoiceImpl.current(opts),
  parseVoiceLayerResponse: (c) => parseVoiceLayerResponseImpl.current(c),
}));

// The REAL gemmaClient, bypassing the mock above. Used by the abort row so the
// handler's timeout classification is exercised through the actual
// _callGemmaOnce catch rather than a hand-shaped error object — see the comment
// on that test for why the distinction is the whole point.
const realGemmaClient = await vi.importActual('../_utils/gemmaClient.js');

// Phase E1 — flip ARCHETYPE_INTEGRITY_MODE per-test via a live getter (real flags
// preserved). chat.js reads the flag inside the handler, so the getter takes
// effect at call time. Default 'off' so every pre-existing test stays flag-OFF.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
  get LEAGUE_AGENT_CHAT_ENABLED() { return leagueChatFlag.on; },
}));

// The per-day budget module is exercised in agentChatBudget.test.js; here it is
// mocked so these tests assert chat.js's BRANCHING (bypass / gate / charge / fail-open)
// without a second Firestore fake. Calls are captured for no-charge assertions.
vi.mock('../_utils/agentChatBudget.js', () => ({
  AGENT_CHAT_DAILY_LIMIT: 10,
  resolveBudgetDay: async (_db, battle) => { budget.resolveCalls.push(battle); return budget.resolveImpl(battle); },
  readAgentChatBudget: async (_db, args) => { budget.readCalls.push(args); return budget.readImpl(args); },
  chargeAgentChatBudget: async (_db, args) => { budget.chargeCalls.push(args); return budget.chargeImpl(args); },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

const { default: handler, GEMMA_TIMEOUT_MS, TURN_DEADLINE_MS } = await import('./chat.js');

// ==================== Test fixture helpers ====================

function makeFakeFirestore({
  agent, battle, marketCtx = null, drb = null, voiceCache = null,
  // Phase E2 — tournament group + pending-claims aggregate, with injectable failures.
  group = null, pendingClaimCount = 0, groupReadError = false, claimsReadError = false,
}) {
  const written = { setCalls: [], updateCalls: [] };

  // The claims aggregate query: .where().where().count().get() → { data: () => ({ count }) }.
  const claimsQuery = {
    where: () => claimsQuery,
    count: () => ({
      get: async () => {
        if (claimsReadError) throw new Error('claims aggregate read failed');
        return { data: () => ({ count: pendingClaimCount }) };
      },
    }),
  };

  const collection = (name) => ({
    doc: (idArg) => {
      const docId = idArg || `auto-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: docId,
        get: async () => {
          if (name === 'agents') return { exists: !!agent, data: () => agent };
          if (name === 'agentBattles') return { exists: !!battle, data: () => battle };
          if (name === 'indexIntelligence' && docId === 'marketContext') {
            return { exists: !!marketCtx, data: () => marketCtx };
          }
          if (name === 'indexIntelligence' && docId === 'dailyRegimeBrief') {
            return { exists: !!drb, data: () => drb };
          }
          if (name === 'voiceLayerCache') {
            return { exists: !!voiceCache, data: () => voiceCache };
          }
          if (name === 'tournamentGroups') {
            if (groupReadError) throw new Error('group doc read failed');
            return { exists: !!group, data: () => group };
          }
          return { exists: false, data: () => null };
        },
        update: async (updates) => {
          written.updateCalls.push({ id: docId, updates });
        },
        collection: (subName) => (subName === 'claims' ? claimsQuery : { where: () => ({}) }),
      };
    },
  });

  return { db: { collection }, written };
}

function makeReqRes(body) {
  const req = { method: 'POST', body, headers: { authorization: 'Bearer x' } };
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}

const VALID_AGENT = {
  ownerId: 'test-user',
  name: 'Gemma',
  archetype: 'strategist',
  partnerProfile: {},
};

const VALID_BATTLE = {
  ownerId: 'test-user',
  status: 'active',
  gameMode: 'standard',
  chatBudgetUsed: 0,
  reviewBudgetUsed: 0,
  chatExchanges: [],
  recentElicitationTargets: [],
  portfolio: { star: [], core: [], support: [] },
  scoreState: { currentScore: 0, opponentScore: 0 },
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  authDelayMs.current = 0;
  gateArgs.current = [];
  callGemmaVoiceImpl.current = async () => '{"response":"hi"}';
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  shadowLogCalls.current = [];
  activeFirestore = null;
  archetypeFlag.mode = 'off';
  voiceLayerArgs.current = [];
  leagueChatFlag.on = false;
  budget.resolveImpl = () => ({ groupId: 'group-xyz', dayN: 1 });
  budget.readImpl = async () => ({ count: 0, remaining: 10 });
  budget.chargeImpl = async () => ({ charged: true, remaining: 9, count: 1 });
  budget.resolveCalls = [];
  budget.readCalls = [];
  budget.chargeCalls = [];
});

// The abort row spies on globalThis.fetch to drive the real gemmaClient; without
// this the stub would leak into every subsequent test in the file.
afterEach(() => {
  vi.restoreAllMocks();
});

// ==================== TESTS ====================

describe('agent/chat — parseError 502 banner path', () => {
  it('returns 502 + shadow logs raw text when parser returns parseError', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    callGemmaVoiceImpl.current = async () =>
      'I have hit a snag, could you repeat the question?';
    parseVoiceLayerResponseImpl.current = (c) => ({
      parseError: true,
      errorReason: 'plaintext_passthrough',
      rawText: c,
    });

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('gemma_invalid_shape');
    // Prefixed errorReason matches workshop-chat / watchlist-dialogue so a
    // single dashboard query (`errorReason LIKE 'parse_%'`) catches every
    // surface's parser failures (Q4-1 standardization).
    expect(res.body.errorReason).toBe('parse_plaintext_passthrough');
    expect(res.body.message).toBe('Agent returned an unexpected response. Try again.');

    // No write to the battle doc — failed turn doesn't burn budget.
    expect(fixture.written.updateCalls).toHaveLength(0);

    // Shadow log captured the raw plaintext for diagnostics.
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].turnError).toBe(true);
    expect(shadowLogCalls.current[0].errorReason).toBe('parse_plaintext_passthrough');
    expect(shadowLogCalls.current[0].rawGemmaContent).toContain('I have hit a snag');
    expect(shadowLogCalls.current[0].userMessage).toBe('hi');
  });

  it('parseError with empty_content surfaces as 502 with parse_empty_content', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    callGemmaVoiceImpl.current = async () => '';
    parseVoiceLayerResponseImpl.current = () => ({
      parseError: true,
      errorReason: 'empty_content',
      rawText: '',
    });

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.errorReason).toBe('parse_empty_content');
    expect(shadowLogCalls.current[0].errorReason).toBe('parse_empty_content');
  });

  it('valid Gemma JSON still passes through normally (no regression)', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    callGemmaVoiceImpl.current = async () => '{"response":"hello there"}';
    // Default parser delegates to JSON.parse.

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    expect(fixture.written.updateCalls).toHaveLength(1); // exchange written
  });
});

describe('agent/chat — catch-block shadow logging (gap closure)', () => {
  // Gap closure: previously the catch block returned 500/504 without
  // calling logConversation. Production lost visibility into AbortError
  // timeouts and other handler exceptions.

  // REWRITTEN Sep 3 2026 (voice-timeout incident). This row previously mocked
  // callGemmaVoice to throw an error with `name` hand-set to 'AbortError'. It
  // passed for months while production returned 500 on every timeout, because
  // hand-setting the name bypasses the only code that decides it:
  // _callGemmaOnce's `.json()` catch. A timeout that fires while the body is
  // still arriving leaves the response resolved (200) and rejects the body
  // read, and that catch — written for malformed JSON — used to rewrite the
  // abort as a plain Error. So `isAbort` below was false in production and
  // never false in the test.
  //
  // It now drives the REAL callGemmaVoice against a fetch whose body read
  // rejects with a genuine AbortError, so the classification under test runs
  // through _callGemmaOnce's real classifier — where the bug actually lived.
  //
  // Scope, stated honestly: the Response here is still a stub. No
  // AbortController fires and undici is not involved, so this row proves the
  // HANDLER wiring (classifier → 504 → gemma_timeout), not that a real undici
  // body-read abort produces that classification. THAT is proven separately in
  // gemmaClient.test.js, against a real http server and a real signal, with an
  // assertion on which abort window actually fired.
  //
  // MUTATION CHECK: reverting the abort branch in gemmaClient._callGemmaOnce
  // makes this row fail with 500 / handler_exception — the production symptom.
  it('a timeout during the body read → 504 + shadow logs gemma_timeout (real abort path)', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    // A resolved 200 response whose body read rejects mid-stream: the exact
    // production shape. DOMException named 'AbortError' is what undici throws.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new DOMException('This operation was aborted', 'AbortError')),
      text: () => Promise.resolve(''),
    });
    callGemmaVoiceImpl.current = realGemmaClient.callGemmaVoice;

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe('Agent response timed out. Try again.');
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].turnError).toBe(true);
    expect(shadowLogCalls.current[0].errorReason).toBe('gemma_timeout');
    expect(shadowLogCalls.current[0].userMessage).toBe('hi');
    expect(shadowLogCalls.current[0].agentId).toBe('agent-1');
    expect(shadowLogCalls.current[0].battleId).toBe('battle-1');
    // A timed-out turn is exactly the case p50/p95 must not be blind to, so the
    // latency stamp has to survive the throw, not just the happy path.
    expect(typeof shadowLogCalls.current[0].gemmaLatencyMs).toBe('number');
  });

  it('non-Abort error → 500 + shadow logs handler_exception with errorMessage', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    callGemmaVoiceImpl.current = async () => {
      throw new Error('OpenRouter 502: gateway down');
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Agent unavailable. Try again in a moment.');
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].turnError).toBe(true);
    expect(shadowLogCalls.current[0].errorReason).toBe('handler_exception');
    expect(shadowLogCalls.current[0].errorMessage).toContain('OpenRouter 502');
  });

  it('error message is truncated to 500 chars in shadow log', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    const longMessage = 'x'.repeat(900);
    callGemmaVoiceImpl.current = async () => {
      throw new Error(longMessage);
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      battleId: 'battle-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(shadowLogCalls.current[0].errorMessage).toHaveLength(500);
  });
});

describe('agent/chat — Catalog #9 round-boundary Film Room tagging', () => {
  // The durable chatExchanges write (api/agent/chat.js) is the catalog-event
  // surface; the fire-and-forget shadow log is NOT. A tournament battle's
  // review exchanges carry groupId so round-boundary analysis can join
  // groupId → the group doc (bracketGameId/roundNumber are intentionally NOT
  // stamped on the battle doc — that's fenced createAgentBattle doc-shape).
  function exchangeFromWrite(written) {
    const call = written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
    return call?.updates.chatExchanges.items[0];
  }

  it('tournament battle: the durable exchange is tagged with groupId', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const exchange = exchangeFromWrite(fixture.written);
    expect(exchange).toBeTruthy();
    expect(exchange.groupId).toBe('group-xyz'); // rides the awaited write
    // The tag is signal capture only — never the fire-and-forget shadow log.
    expect(shadowLogCalls.current[0].groupId).toBeUndefined();
  });

  it('tiered battle: no groupId tag on the exchange (omitted for non-tournament)', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE }); // gameMode 'standard'
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const exchange = exchangeFromWrite(fixture.written);
    expect(exchange).toBeTruthy();
    expect('groupId' in exchange).toBe(false);
  });
});

// ==================== League arena two-way ask — per-day budget ====================

describe('agent/chat — League arena per-day ask (leagueAsk + LEAGUE_AGENT_CHAT_ENABLED)', () => {
  const TOURNEY_BATTLE = { ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' };
  // resolveBudgetDay (the group-read + dayN derivation) is mocked here; its own group-
  // read-failure path is unit-tested in agentChatBudget.test.js. These tests drive its
  // resolved key (or null) to exercise chat.js's branching.
  const KEY = { groupId: 'group-xyz', dayN: 1 };

  const mainUpdate = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');

  it('flag OFF: a leagueAsk is IGNORED — falls to the legacy per-battle path (kill-switch)', async () => {
    leagueChatFlag.on = false;
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Not even the day resolver runs; the legacy per-battle increment runs; no `remaining`.
    expect(budget.resolveCalls).toHaveLength(0);
    expect(budget.chargeCalls).toHaveLength(0);
    expect(mainUpdate(fixture.written).updates.chatBudgetUsed).toEqual({ __op: 'increment', n: 1 });
    expect('remaining' in res.body).toBe(false);
  });

  it('flag ON: a League ask bypasses the per-battle budget and charges the per-day store', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => KEY;
    budget.readImpl = async () => ({ count: 4, remaining: 6 });
    budget.chargeImpl = async () => ({ charged: true, remaining: 5, count: 5 });
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'whats the plan', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hi');
    // Server-authoritative remaining flows back to the counter.
    expect(res.body.remaining).toBe(5);
    // The per-day store was charged ONCE, keyed on the resolved game-day + group + uid.
    expect(budget.chargeCalls).toHaveLength(1);
    expect(budget.chargeCalls[0]).toMatchObject({ groupId: 'group-xyz', uid: 'test-user', dayN: 1 });
    // The exchange is still written durably, but the per-battle counter is NOT touched.
    const upd = mainUpdate(fixture.written).updates;
    expect(upd.chatExchanges.__op).toBe('arrayUnion');
    expect('chatBudgetUsed' in upd).toBe(false);
  });

  it('at zero: a 200 in-voice exhausted line, NO agent call, NO charge', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => KEY;
    budget.readImpl = async () => ({ count: 10, remaining: 0 });
    let gemmaCalled = false;
    callGemmaVoiceImpl.current = async () => { gemmaCalled = true; return '{"response":"should not run"}'; };
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'one more?', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);            // NOT a 403/429 error shape
    expect(res.body.exhausted).toBe(true);
    expect(res.body.remaining).toBe(0);
    expect(res.body.agentMessage).toMatch(/all the questions i can take today/i);
    expect(gemmaCalled).toBe(false);             // no agent call
    expect(budget.chargeCalls).toHaveLength(0);  // no charge
    expect(fixture.written.updateCalls).toHaveLength(0); // no battle-doc write
  });

  it('no-charge-on-failure: a timed-out ask returns 504 and NEVER charges', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => KEY;
    budget.readImpl = async () => ({ count: 2, remaining: 8 });
    callGemmaVoiceImpl.current = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'plan?', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(budget.chargeCalls).toHaveLength(0);           // failed call did NOT charge
    expect(fixture.written.updateCalls).toHaveLength(0);  // no write at all
  });

  it('FAIL-OPEN: an unkeyable budget (resolveBudgetDay → null) still ANSWERS and does NOT charge', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => null; // a group-read failure / non-keyable battle
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'plan?', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hi');   // the ask still answered
    expect(budget.readCalls).toHaveLength(0);    // no key → no budget read
    expect(budget.chargeCalls).toHaveLength(0);  // count did NOT move
    // The answer is recorded, but neither budget was charged (fail-open = free).
    const upd = mainUpdate(fixture.written).updates;
    expect('chatBudgetUsed' in upd).toBe(false);
    expect('remaining' in res.body).toBe(false); // no authoritative update → client keeps its count
  });

  it('existing-chat untouched: a standard (non-League) ask is byte-identical (no remaining field)', async () => {
    leagueChatFlag.on = true; // flag on, but NO leagueAsk in the body
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE }); // gameMode 'standard'
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(budget.resolveCalls).toHaveLength(0);
    expect(budget.chargeCalls).toHaveLength(0);
    expect(mainUpdate(fixture.written).updates.chatBudgetUsed).toEqual({ __op: 'increment', n: 1 });
    expect('remaining' in res.body).toBe(false);
  });
});

// ==================== Phase E1 — the deterministic gate ====================

describe('agent/chat — archetype integrity gate (Phase E1)', () => {
  const MOMENTUM_AGENT = { ...VALID_AGENT, archetype: 'momentum_chaser' };
  const TF02 = 'Require stronger confirmation before entering';
  const TF03 = 'Narrow to the single strongest sector(s)';

  const gemma = (obj) => JSON.stringify(obj);
  const seq = (...replies) => { let i = 0; return async () => replies[Math.min(i++, replies.length - 1)]; };
  const mainUpdate = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
  const exchangeOf = (written) => mainUpdate(written)?.updates.chatExchanges.items[0];
  const run = async (battleOver = {}, body = {}) => {
    const fixture = makeFakeFirestore({ agent: body.agent ?? MOMENTUM_AGENT, battle: { ...VALID_BATTLE, ...battleOver } });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi', ...body.req });
    await handler(req, res);
    return { res, written: fixture.written };
  };

  it('flag-OFF is the legacy path: no gate fields, model directive flows through (keystone regression)', async () => {
    archetypeFlag.mode = 'off';
    callGemmaVoiceImpl.current = async () => gemma({ response: 'ok', hasDirective: true, directive: { text: 'lean tech', expiry: 'end_of_battle' } });
    const { res, written } = await run();
    expect(res.statusCode).toBe(200);
    expect(res.body.hasDirective).toBe(true);
    expect(res.body.directive.text).toBe('lean tech');
    expect('directiveStatus' in res.body).toBe(false);   // gate-ran riders absent in OFF
    expect('directiveStatusLine' in res.body).toBe(false);
    expect('directiveFallback' in res.body).toBe(false);
    expect(mainUpdate(written).updates.directive.text).toBe('lean tech'); // legacy write unchanged
    expect('archetypeGate' in exchangeOf(written)).toBe(false);
  });

  it('ENFORCE core_conflict → null, 200 (never 502), status honest despite prose', async () => {
    archetypeFlag.mode = 'enforce';
    callGemmaVoiceImpl.current = async () => gemma({ response: 'Done, locked in!', hasDirective: true, _archetypeProposal: { classification: 'core_conflict', selectedAdjustmentId: null, rejectionReason: 'reverses core' } });
    const { res, written } = await run();
    expect(res.statusCode).toBe(200);
    expect(res.body.hasDirective).toBe(false);
    expect(res.body.directive).toBeNull();
    // BACKSTOP: prose says "Done, locked in!" but the gate wrote null → the
    // AUTHORITATIVE status is deterministically 'no_change', regardless of the prose.
    expect(res.body.directiveStatus).toBe('no_change');
    expect(res.body.directiveStatusLine).toBe('No change made to your strategy this turn.');
    expect('directive' in mainUpdate(written).updates).toBe(false); // no battle.directive write
    expect(exchangeOf(written).archetypeGate.status).toBe('no_change');
  });

  it('ENFORCE valid id → canonical verbatim + threadId + write', async () => {
    archetypeFlag.mode = 'enforce';
    callGemmaVoiceImpl.current = async () => gemma({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02' } });
    const { res, written } = await run();
    expect(res.body.directive.text).toBe(TF02);
    expect(res.body.hasDirective).toBe(true);
    expect(res.body.directiveStatus).toBe('committed');
    expect(res.body.directiveStatusLine).toBeNull(); // committed → the `directive` text carries the change
    expect(mainUpdate(written).updates.directive.text).toBe(TF02);
    expect(mainUpdate(written).updates.directive.directiveThreadId).toBeTruthy();
    expect(exchangeOf(written).archetypeGate.status).toBe('committed');
    expect(exchangeOf(written).directiveThreadId).toBeTruthy();
  });

  it('OBSERVE evaluates + logs on the exchange but writes NO directive', async () => {
    archetypeFlag.mode = 'observe';
    callGemmaVoiceImpl.current = async () => gemma({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02' } });
    const { res, written } = await run();
    expect(res.body.hasDirective).toBe(false);
    expect(res.body.directive).toBeNull();
    expect(res.body.directiveStatus).toBe('no_change'); // OBSERVE forces null → authoritative no_change
    expect('directive' in mainUpdate(written).updates).toBe(false); // observe never writes a directive
    expect(exchangeOf(written).archetypeGate.status).toBe('committed'); // but it logged what it WOULD have done
    expect(exchangeOf(written).archetypeGate.repairUsed).toBe(false);
  });

  it('ENFORCE unknown archetype → null + integrity log', async () => {
    archetypeFlag.mode = 'enforce';
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    callGemmaVoiceImpl.current = async () => gemma({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02' } });
    const { res, written } = await run({}, { agent: VALID_AGENT }); // archetype 'strategist' (unknown)
    expect(res.statusCode).toBe(200);
    expect(res.body.directive).toBeNull();
    expect(res.body.directiveStatus).toBe('no_change'); // unknown archetype → null → authoritative no_change
    expect(exchangeOf(written).archetypeGate.status).toBe('no_archetype');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('ENFORCE repair-retry: invalid id then valid → committed via 2nd Gemma call', async () => {
    archetypeFlag.mode = 'enforce';
    callGemmaVoiceImpl.current = seq(
      gemma({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-99' } }),  // call 1 (initial) — invalid
      gemma({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-03' } }),  // call 2 (repair) — valid
    );
    const spy = vi.spyOn({ f: callGemmaVoiceImpl.current }, 'f');
    callGemmaVoiceImpl.current = spy;
    const { res, written } = await run();
    expect(res.body.directive.text).toBe(TF03);
    expect(exchangeOf(written).archetypeGate.repairUsed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2); // initial + one repair
  });

  it('review mode is unchanged — gate never runs even flag-ON', async () => {
    archetypeFlag.mode = 'enforce';
    const spy = vi.fn(async () => gemma({ response: 'ok', hasDirective: true, directive: { text: 'x', expiry: 'end_of_battle' }, _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02' } }));
    callGemmaVoiceImpl.current = spy;
    const { res, written } = await run({}, { req: { mode: 'review' } });
    expect(res.body.directive).toBeNull();           // review strips directives (legacy)
    expect('directiveStatus' in res.body).toBe(false); // gate did not run
    expect('directiveStatusLine' in res.body).toBe(false);
    expect('archetypeGate' in (exchangeOf(written) || {})).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);            // no repair path
  });
});

// ==================== Phase E2 — capabilities manifest wiring ====================

describe('agent/chat — capabilities manifest → USER LEVERS wiring (Phase E2)', () => {
  const MOMENTUM_AGENT = { ...VALID_AGENT, archetype: 'momentum_chaser' };
  // A tournament group where the user has one pick with no flips used today (stale
  // flipCountDate → full flip capacity) and the claim window is mocked open.
  const TOURNEY_GROUP = {
    status: GROUP_STATUS.BATTLE,
    players: [
      { odUserId: 'test-user', picks: [{ symbol: 'NVDA', flipCountToday: 0, flipCountDate: '2020-01-01' }] },
    ],
  };
  const validGemma = () => JSON.stringify({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02' } });

  const run = async (fixtureOpts, { mode } = {}) => {
    callGemmaVoiceImpl.current = async () => validGemma();
    const fixture = makeFakeFirestore({ agent: MOMENTUM_AGENT, ...fixtureOpts });
    activeFirestore = fixture.db;
    const reqBody = { agentId: 'agent-1', battleId: 'battle-1', message: 'hi', ...(mode ? { mode } : {}) };
    const { req, res } = makeReqRes(reqBody);
    await handler(req, res);
    return { res, written: fixture.written, manifest: voiceLayerArgs.current[0]?.capabilitiesManifest };
  };

  const tournamentBattle = (over = {}) => ({ ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz', ...over });

  it('flag-ON tournament battle → manifest reflects live levers (short + claim true)', async () => {
    archetypeFlag.mode = 'enforce';
    const { res, manifest } = await run({ battle: tournamentBattle(), group: TOURNEY_GROUP, pendingClaimCount: 0 });
    expect(res.statusCode).toBe(200);
    expect(manifest).toBeTruthy();
    expect(manifest.user_can_short).toBe(true);        // a pick has full flip capacity today
    expect(manifest.user_can_make_claims).toBe(true);  // window open + 0 pending
    expect(manifest.flipsRemaining).toBe(5);
    expect(manifest.claimsRemaining).toBe(3);
  });

  it('flag-ON standard battle → all-false manifest, no tournament reads needed', async () => {
    archetypeFlag.mode = 'enforce';
    const { res, manifest } = await run({ battle: { ...VALID_BATTLE } }); // gameMode 'standard'
    expect(res.statusCode).toBe(200);
    expect(manifest).toBeTruthy();
    expect(manifest.user_can_short).toBe(false);
    expect(manifest.user_can_make_claims).toBe(false);
    expect(manifest.flipsRemaining).toBeNull();
    expect(manifest.claimsRemaining).toBeNull();
  });

  it('flag-ON tournament, claims aggregate read FAILS → all-false manifest, turn still 200 (degraded-read guard)', async () => {
    archetypeFlag.mode = 'enforce';
    const { res, manifest } = await run({ battle: tournamentBattle(), group: TOURNEY_GROUP, claimsReadError: true });
    expect(res.statusCode).toBe(200);                  // never blocks the turn
    expect(manifest).toBeTruthy();
    expect(manifest.user_can_short).toBe(false);       // whole group nulled on any read failure
    expect(manifest.user_can_make_claims).toBe(false);
    expect(manifest.flipsRemaining).toBeNull();
  });

  it('flag-ON tournament, group doc read FAILS → all-false manifest, turn still 200', async () => {
    archetypeFlag.mode = 'enforce';
    const { res, manifest } = await run({ battle: tournamentBattle(), groupReadError: true });
    expect(res.statusCode).toBe(200);
    expect(manifest).toBeTruthy();
    expect(manifest.user_can_short).toBe(false);
    expect(manifest.user_can_make_claims).toBe(false);
  });

  it('flag-OFF tournament battle → NO manifest built (dark is a true no-op, no extra reads)', async () => {
    archetypeFlag.mode = 'off';
    const { res, manifest } = await run({ battle: tournamentBattle(), group: TOURNEY_GROUP });
    expect(res.statusCode).toBe(200);
    expect(manifest ?? null).toBeNull();               // capabilitiesManifest stays the null default
  });
});

// ==========================================================================
// TIMEOUT WIRING — Sep 3 2026 voice-timeout incident.
//
// chat.timeout.test.js pins the VALUE of GEMMA_TIMEOUT_MS and its arithmetic
// against TURN_DEADLINE_MS and maxDuration. This row pins that the constant is
// what actually arms the live AbortController: without it, replacing
// `GEMMA_TIMEOUT_MS` at the call site with a bare literal would leave every
// pin green while the real timeout drifted.
// ==========================================================================

describe('agent/chat — the timeout constant arms the real AbortController', () => {
  it('does not abort before GEMMA_TIMEOUT_MS, and does at it', async () => {
    vi.useFakeTimers();
    try {
      const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
      activeFirestore = fixture.db;

      // Hold the call open and hand the signal back so the abort can be observed
      // directly, rather than inferred from a downstream status code.
      let captured = null;
      callGemmaVoiceImpl.current = (opts) => {
        captured = opts.signal;
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const e = new Error('This operation was aborted');
            e.name = 'AbortError';
            reject(e);
          }, { once: true });
        });
      };

      const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
      const done = handler(req, res);

      // Let the handler's pre-call awaits (auth + the Firestore reads) settle so
      // the timer is actually armed before the clock is advanced.
      await vi.advanceTimersByTimeAsync(0);
      expect(captured).not.toBeNull();

      await vi.advanceTimersByTimeAsync(GEMMA_TIMEOUT_MS - 1);
      expect(captured.aborted).toBe(false);   // still inside the budget

      await vi.advanceTimersByTimeAsync(1);
      expect(captured.aborted).toBe(true);    // armed by GEMMA_TIMEOUT_MS exactly

      await done;
      expect(res.statusCode).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ==========================================================================
// THE ABSOLUTE CLAMP — found by adversarial review of the 15s→20s raise.
//
// GEMMA_TIMEOUT_MS is RELATIVE and its timer is armed after the prologue (auth
// + 4 sequential Firestore round trips, 6 on the League ask path), so an
// unclamped timer fires at `overhead + 20s` — unrelated to the absolute
// deadline the gate is held to. Past ~4s of prologue that breaches
// TURN_DEADLINE_MS; past ~10s it fires after maxDuration, i.e. after the
// platform already killed the function — the bare gateway 504 with no shadow
// log and no honest string that this change exists to prevent. The 15s value
// tolerated 15.1s of prologue; 20s alone tolerates 10.1s.
//
// MUTATION CHECK: dropping the Math.min clamp at chat.js:439-443 reddens the
// 8s row (abort fires at 28s, past the 24s deadline).
// ==========================================================================

describe('agent/chat — the voice call is clamped to the absolute turn deadline', () => {
  afterEach(() => { vi.useRealTimers(); });

  async function abortTimeUnderOverhead(overheadMs) {
    vi.useFakeTimers();
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    authDelayMs.current = overheadMs;

    const turnStart = Date.now();
    let abortedAt = null;
    callGemmaVoiceImpl.current = (opts) => new Promise((_res, reject) => {
      opts.signal.addEventListener('abort', () => {
        abortedAt = Date.now() - turnStart;
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        reject(e);
      }, { once: true });
    });

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    const done = handler(req, res);
    await vi.advanceTimersByTimeAsync(overheadMs + GEMMA_TIMEOUT_MS + 5_000);
    await done;
    return { abortedAt, status: res.statusCode };
  }

  it('a fast prologue still gets the full GEMMA_TIMEOUT_MS', async () => {
    const { abortedAt, status } = await abortTimeUnderOverhead(0);
    expect(abortedAt).toBe(GEMMA_TIMEOUT_MS);
    expect(status).toBe(504);
  });

  it('an 8s prologue does NOT push the abort past TURN_DEADLINE_MS', async () => {
    // Unclamped this fires at 28s — 4s past the deadline, and the writes that
    // follow would run against a budget that no longer exists.
    const { abortedAt, status } = await abortTimeUnderOverhead(8_000);
    expect(abortedAt).toBeLessThanOrEqual(TURN_DEADLINE_MS);
    expect(status).toBe(504);
  });

  it('a prologue that has already eaten the deadline gives the call ~no budget, not a fresh 20s', async () => {
    // Unclamped this fires at 45s — long after the platform killed the function
    // at 30s. Clamped, the budget floors at 0 and the call aborts on the next
    // tick, so the turn still returns a real 504 with a shadow log.
    const OVERHEAD = 25_000;
    const { abortedAt, status } = await abortTimeUnderOverhead(OVERHEAD);
    expect(abortedAt - OVERHEAD).toBeLessThanOrEqual(100);   // immediate, not +20s
    expect(status).toBe(504);
  });
});

// ==========================================================================
// TURN_DEADLINE_MS IS WIRED, not merely pinned.
//
// chat.timeout.test.js pins the VALUE of TURN_DEADLINE_MS and four rows reason
// about it, but nothing proved the gate actually receives it: replacing
// `turnStartMs + TURN_DEADLINE_MS` at chat.js:519 with a bare `99_000` left
// every one of those pins green while the real deadline drifted. That is the
// same hole the GEMMA_TIMEOUT_MS wiring row above closes; this closes its twin.
// ==========================================================================

describe('agent/chat — the turn deadline handed to the directive gate is wired', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('gateDirective receives turnStartMs + TURN_DEADLINE_MS', async () => {
    vi.useFakeTimers();
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    archetypeFlag.mode = 'enforce';   // the gate only runs outside 'off'
    callGemmaVoiceImpl.current = async () => '{"response":"hi","hasDirective":false}';

    const turnStart = Date.now();
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(req, res);

    expect(gateArgs.current).toHaveLength(1);
    // Absolute, and exactly TURN_DEADLINE_MS from the turn's start — the gate
    // clamps its repair against this, so a wrong value silently un-budgets it.
    expect(gateArgs.current[0].deadlineMs - turnStart).toBe(TURN_DEADLINE_MS);
  });
});
