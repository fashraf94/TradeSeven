// api/agent/chat.test.js
//
// Targeted integration coverage for the parseError → 502 banner path
// and the catch-block shadow-logging gap closure added by the Voice
// Layer Snag Bug Fix. Like workshop-chat.test.js, this file is scoped
// narrowly: it does NOT cover the many other handler branches
// (elicitation target, directive normalization, mode detection,
// review lessons, etc.). Those are exercised by manual / E2E tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOURNAMENT_GAME_MODE, GROUP_STATUS } from '../../src/constants/leagueTournament.js';

// ==================== HOISTED MOCK STATE ====================
const {
  authReturnValue,
  gateArgs,
  authDelayMs,
  callGemmaVoiceImpl,
  parseVoiceLayerResponseImpl,
  shadowLogCalls,
  shadowLog,
  archetypeFlag,
  voiceLayerArgs,
  leagueChatFlag,
  showIt,
  grounding,
  promptBuilder,
  budget,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gateArgs: { current: [] },     // pass-through capture of gateDirective's args
  authDelayMs: { current: 0 },   // simulates a slow prologue (auth + Firestore reads)
  callGemmaVoiceImpl: { current: async () => '{"response":"hi"}' },
  parseVoiceLayerResponseImpl: { current: (c) => JSON.parse(c) },
  shadowLogCalls: { current: [] },
  // The logger's RESULT, per row: true = persisted, false = the GCS-disabled /
  // swallowed-write no-op, a never-settling promise = a hanging write.
  shadowLog: { impl: async () => true },
  archetypeFlag: { mode: 'off' },
  voiceLayerArgs: { current: [] }, // Phase E2 — capture buildVoiceLayerPrompt args
  // League arena two-way ask — the kill-switch flag + a controllable budget module.
  leagueChatFlag: { on: false },
  // Phase C §1/§5 — SHOW_IT_ENABLED, settable per row; the real value is false.
  showIt: { on: false },
  // Voice-layer grounding — the per-caller accessor, controllable per test;
  // the uids it was asked about are captured (the route must ask for the
  // TOKEN's uid, never the body's).
  grounding: { mode: 'off', calls: [] },
  // The prompt-builder stub: distinguishable per build (old / new), and a
  // per-test way to make one side THROW (the shadow-assembly rows).
  promptBuilder: { throwWhen: null },
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

// The REAL logger resolves to a boolean and never throws (shadowLogger.js);
// this double keeps that contract and makes the result settable per row, so the
// handler's durability wrapper can be driven through persisted / not-persisted /
// still-writing without a GCS fake.
vi.mock('../_utils/shadowLogger.js', () => ({
  logConversation: (record) => {
    shadowLogCalls.current.push(record);
    return shadowLog.impl(record);
  },
}));

vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildVoiceLayerPrompt: (args) => {
    voiceLayerArgs.current.push(args);
    if (promptBuilder.throwWhen && promptBuilder.throwWhen(args)) throw new Error(`builder exploded (grounded=${args.grounded})`);
    // Distinguishable per build, so the shadow record's two prompts are two (review R-06).
    return `system-prompt-stub:${args.grounded ? 'new' : 'old'}`;
  },
}));

// Phase E2 — deterministic ET-clock helpers so the manifest's claim-window /
// flip-reset reads do not depend on the wall clock. chat.js is the only unit under
// test that imports these, so the mock is inert for every other handler path.
vi.mock('../_utils/tournamentTime.js', () => ({
  getTournamentClaimWindow: () => ({ isOpen: true, etTime: '12:00', reason: null }),
  formatEtDate: () => '2026-06-26',
  // B2 — the shared filing transaction stamps the League counter's updatedAt
  // through this helper, so the mock must carry it too.
  toIso: (d) => new Date(d).toISOString(),
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
  getVoiceGroundingMode: (uid) => { grounding.calls.push(uid); return grounding.mode; },
  // Phase C §1/§5 — SHOW_IT_ENABLED, settable per row. The real value is false
  // (dark), which is what every pre-existing row keeps.
  get SHOW_IT_ENABLED() { return showIt.on; },
}));

// The per-day budget module is exercised in agentChatBudget.test.js; here it is
// mocked so these tests assert chat.js's BRANCHING (bypass / gate / charge / fail-open)
// without a second Firestore fake. Calls are captured for no-charge assertions.
vi.mock('../_utils/agentChatBudget.js', () => ({
  AGENT_CHAT_DAILY_LIMIT: 10,
  // B2: the shared filing transaction reads and writes the per-day doc ITSELF
  // (cross-document, in the same transaction), so the key helpers are real
  // here while the group-read/day derivation stays driveable per row.
  AGENT_CHAT_BUDGET_COLLECTION: 'agentChatBudget',
  agentChatBudgetDocId: (groupId, uid, dayN) => `${groupId}_${uid}_${dayN}`,
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

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { default: handler, GEMMA_TIMEOUT_MS, TURN_DEADLINE_MS, SHADOW_LOG_CAP_MS, SHADOW_SETTLE_DEADLINE_MS } = await import('./chat.js');


// ==================== Test fixture helpers ====================

function makeFakeFirestore({
  agent, battle, marketCtx = null, drb = null, voiceCache = null,
  // Phase E2 — tournament group + pending-claims aggregate, with injectable failures.
  group = null, pendingClaimCount = 0, groupReadError = false, claimsReadError = false,
  // B2 — the shared filing transaction's own surface: the League per-day counter
  // docs it reads and writes, and a one-shot contention barrier (the
  // `db.setBarrier` two-writer shape from api/_utils/mandateEscape.test.js) that
  // lets another writer land between the transaction's reads and its commit.
  budgetDocs = {},
  // …and a way to make the POST-COMMIT `agents` write at step 20b throw, which
  // is what ruling 7's third shape (committed, then threw) needs to be reached.
  agentUpdateError = false,
}) {
  const written = { setCalls: [], updateCalls: [], txAttempts: 0 };
  // The battle the fake SERVES, so a committed write is visible to the next read
  // (a transaction retry re-reads) without ever mutating the shared fixture
  // object the caller passed in.
  const battleState = battle
    ? {
      ...battle,
      ...(Array.isArray(battle.chatExchanges) ? { chatExchanges: [...battle.chatExchanges] } : {}),
      ...(Array.isArray(battle.recentElicitationTargets) ? { recentElicitationTargets: [...battle.recentElicitationTargets] } : {}),
    }
    : null;
  const budgetState = { ...budgetDocs };
  const barrier = { current: null };
  const failCommit = { current: null };

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
        __col: name,
        get: async () => {
          if (name === 'agents') return { exists: !!agent, data: () => agent };
          // A SNAPSHOT per read, as Firestore's is: a write that lands between
          // the pre-model read and the transaction must be invisible to the
          // value the handler already holds, or the contention rows below
          // cannot be written at all.
          if (name === 'agentBattles') return { exists: !!battleState, data: () => ({ ...battleState }) };
          if (name === 'agentChatBudget') {
            const doc = budgetState[docId];
            return { exists: !!doc, data: () => doc };
          }
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
          if (name === 'agents' && agentUpdateError) throw new Error('agents write failed');
          written.updateCalls.push({ id: docId, updates });
        },
        collection: (subName) => (subName === 'claims' ? claimsQuery : { where: () => ({}) }),
      };
    },
  });

  // Apply a committed write to the served documents, so a retry (and any later
  // read) sees what landed. The recorded call keeps the RAW ops, which is what
  // every assertion in this file reads.
  const applyWrite = (w) => {
    if (w.kind === 'update' && w.col === 'agentBattles' && battleState) {
      for (const [k, v] of Object.entries(w.data)) {
        if (v && v.__op === 'arrayUnion') battleState[k] = [...(battleState[k] || []), ...v.items];
        else if (v && v.__op === 'increment') battleState[k] = (battleState[k] || 0) + v.n;
        else battleState[k] = v;
      }
    } else if (w.kind === 'set' && w.col === 'agentChatBudget') {
      budgetState[w.id] = { ...(budgetState[w.id] || {}), ...w.data };
    }
  };

  const db = {
    collection,
    // The contention seam: the callback runs after the body's reads and before
    // its commit, then the buffer is discarded and the body re-runs against the
    // changed documents — Firestore's own retry, made deterministic.
    setBarrier: (fn) => { barrier.current = fn; },
    // Refuse the commit when the predicate matches the buffered writes.
    failCommitWhen: (fn) => { failCommit.current = fn; },
    runTransaction: async (fn) => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        written.txAttempts += 1;
        const buffer = [];
        const tx = {
          // Firestore's contract: every read precedes every write.
          get: async (ref) => {
            if (buffer.length > 0) throw new Error('transaction read after write');
            return ref.get();
          },
          update: (ref, data) => buffer.push({ kind: 'update', col: ref.__col, id: ref.id, data }),
          set: (ref, data, opts) => buffer.push({ kind: 'set', col: ref.__col, id: ref.id, data, opts }),
        };
        const result = await fn(tx);
        if (failCommit.current && failCommit.current(buffer)) {
          // Firestore's atomicity: the commit is refused and NOT ONE of the
          // buffered writes lands.
          throw new Error('transaction commit failed');
        }
        if (barrier.current) {
          const hit = barrier.current;
          barrier.current = null;
          await hit();
          continue; // the buffer is discarded; the body re-runs against the changed doc
        }
        for (const w of buffer) {
          applyWrite(w);
          if (w.kind === 'update') written.updateCalls.push({ id: w.id, updates: w.data });
          else written.setCalls.push({ id: w.id, data: w.data, opts: w.opts });
        }
        return result;
      }
      throw new Error('transaction contention exhausted');
    },
  };

  return { db, written, battleState, budgetState };
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
  // The battle's own agent, set once at creation (agentBattleService.js:105).
  // Every row in this file posts `agentId: 'agent-1'`, which is what the
  // agent-binding check at chat.js step 7b now requires them to.
  agentId: 'agent-1',
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
  shadowLog.impl = async () => true;
  activeFirestore = null;
  archetypeFlag.mode = 'off';
  voiceLayerArgs.current = [];
  leagueChatFlag.on = false;
  showIt.on = false;
  grounding.mode = 'off';
  grounding.calls = [];
  promptBuilder.throwWhen = null;
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
  // surface; the GCS shadow log is NOT (it is durable now — see THE SHADOW
  // RECORD'S DURABILITY — but durable is not the same as being the catalog). A tournament battle's
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
    // The tag is signal capture only — it rides the durable chatExchanges
    // write, never the GCS shadow record.
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
    // B2 / D-105: an EXPLICIT in-transaction count, never FieldValue.increment.
    // The battle was seeded at chatBudgetUsed 0, so the write is a literal 1.
    expect(mainUpdate(fixture.written).updates.chatBudgetUsed).toBe(1);
    expect('remaining' in res.body).toBe(false);
  });

  // B2 / spec ruling 5: "The League charge moves inside the same transaction
  // (cross-document; D-105)." It used to be a SECOND transaction after the
  // battle write (chargeAgentChatBudget) whose failure was caught and
  // swallowed. The charge is now the filing transaction's own `tx.set` on
  // agentChatBudget/{groupId}_{uid}_{dayN}, so the row reads the WRITE rather
  // than a mocked charge helper's return.
  it('flag ON: a League ask bypasses the per-battle budget and charges the per-day store — in the SAME transaction', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => KEY;
    budget.readImpl = async () => ({ count: 4, remaining: 6 });
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: TOURNEY_BATTLE,
      budgetDocs: { 'group-xyz_test-user_1': { groupId: 'group-xyz', uid: 'test-user', dayN: 1, count: 4 } },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'whats the plan', leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hi');
    // Server-authoritative remaining flows back to the counter, from the count
    // the TRANSACTION read (4 → 5 of 10 → 5 left).
    expect(res.body.remaining).toBe(5);
    // The per-day store was charged ONCE, keyed on the resolved game-day + group
    // + uid, by an explicit count — and the old second transaction is gone.
    expect(budget.chargeCalls).toHaveLength(0);
    expect(fixture.written.setCalls).toHaveLength(1);
    expect(fixture.written.setCalls[0].id).toBe('group-xyz_test-user_1');
    expect(fixture.written.setCalls[0].data).toMatchObject({ groupId: 'group-xyz', uid: 'test-user', dayN: 1, count: 5 });
    // ONE transaction — the battle write and the charge committed together.
    expect(fixture.written.txAttempts).toBe(1);
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
    // B2 / D-105: an EXPLICIT in-transaction count, never FieldValue.increment.
    expect(mainUpdate(fixture.written).updates.chatBudgetUsed).toBe(1);
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

// ==================== Voice-layer grounding — the chat turn under the flag (G2) ====================

describe('agent/chat — the agent must belong to this battle (step 7b)', () => {
  // Ownership proves the battle is the caller's; it does not prove the agent
  // they named is the one this battle is bound to. A caller who owns two
  // battles could name battle A and agent B, and every read below step 7 would
  // answer for the wrong agent. `POST /api/agent/file-directive` has carried
  // this check since it shipped; these two rows are the chat route's.
  const post = async (body, battleOverrides = {}) => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: { ...VALID_BATTLE, ...battleOverrides } });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi', ...body });
    await handler(req, res);
    return { res, fixture };
  };

  it('MISMATCH: a body naming an agent this battle is not bound to → 403, no model call, no write', async () => {
    let calls = 0;
    callGemmaVoiceImpl.current = async () => { calls++; return '{"response":"hi"}'; };

    const { res, fixture } = await post({ agentId: 'agent-2' });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    // Refused before step 10's agent read and step 15's voice call: nothing was
    // assembled from the wrong agent and nothing was persisted.
    expect(calls).toBe(0);
    expect(voiceLayerArgs.current).toEqual([]);
    expect(fixture.written.updateCalls).toEqual([]);
    expect(shadowLogCalls.current).toEqual([]);
  });

  it('MATCH: the battle\'s own agent answers exactly as before', async () => {
    const { res, fixture } = await post({});

    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hi');
    expect(fixture.written.updateCalls.length).toBeGreaterThan(0);
  });

  it('a battle doc carrying no agentId binds nothing, so every id is a mismatch', async () => {
    const { res } = await post({}, { agentId: undefined });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
  });
});

describe('agent/chat — voice-layer grounding: the grounded turn (spec §3.4, ruling 23)', () => {
  const GROUNDED_ANTICIPATION = {
    userMessage: null, agentResponse: 'At the 11:15 AM check my trading process flagged NOW on the bench as a potential entry.',
    messageType: 'anticipation', timestamp: '2026-09-08T15:16:00.000Z', mode: 'battle', groundingVersion: 1,
  };
  const LEGACY_ANTICIPATION = {
    userMessage: null, agentResponse: 'Eyeing AVGO on the bench.', messageType: 'anticipation', timestamp: '2026-09-08T14:16:00.000Z', mode: 'battle',
  };
  const USER_PAIR = { userMessage: 'How are we looking?', agentResponse: 'CF is carrying the book.', timestamp: '2026-09-08T14:05:00.000Z', mode: 'battle' };
  const HISTORY_BATTLE = { ...VALID_BATTLE, chatExchanges: [LEGACY_ANTICIPATION, USER_PAIR, GROUNDED_ANTICIPATION] };
  // Every dimension confident except time_of_day_preference → it is the target.
  const PROFILE_TARGETING_TIME = Object.fromEntries(
    ['risk_appetite', 'concentration_tolerance', 'sector_convictions', 'loss_reaction', 'win_reaction', 'tier_philosophy', 'momentum_vs_value',
      'news_sensitivity', 'macro_awareness', 'communication_frequency', 'autonomy_preference', 'feedback_style', 'competitive_focus', 'learning_orientation']
      .map((d) => [d, { value: 'x', confidence: 0.9 }]),
  );
  let gemmaOpts;
  const run = async (battle, body = {}) => {
    gemmaOpts = [];
    callGemmaVoiceImpl.current = async (opts) => { gemmaOpts.push(opts); return '{"response":"ok"}'; };
    const fixture = makeFakeFirestore({ agent: { ...VALID_AGENT, partnerProfile: PROFILE_TARGETING_TIME }, battle });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi', ...body });
    await handler(req, res);
    return { res, written: fixture.written };
  };
  const exchangeOf = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion').updates.chatExchanges.items[0];

  it("asks the accessor once, with the caller's uid, at call time (the owner check precedes it, so the token's and the owner's uid are one here)", async () => {
    await run(VALID_BATTLE);
    expect(grounding.calls).toEqual(['test-user']);
  });

  it("'off': the shipped path — prompt not grounded, legacy history, no marker on the exchange", async () => {
    grounding.mode = 'off';
    const { res, written } = await run(HISTORY_BATTLE);
    expect(res.statusCode).toBe(200);
    expect(voiceLayerArgs.current[0].grounded).toBe(false);
    expect(voiceLayerArgs.current[0].elicitationTarget.instruction).toContain("'act now at open' vs 'wait for confirmation'");
    // The legacy filter: only the user pair, untagged, exactly as shipped.
    expect(gemmaOpts[0].conversationHistory).toEqual([
      { role: 'user', content: 'How are we looking?' },
      { role: 'assistant', content: 'CF is carrying the book.' },
    ]);
    expect('groundingVersion' in exchangeOf(written)).toBe(false);
  });

  it("'shadow' (G2): still the shipped path for what is SENT — grounded is false, no marker", async () => {
    grounding.mode = 'shadow';
    const { written } = await run(HISTORY_BATTLE);
    expect(voiceLayerArgs.current[0].grounded).toBe(false);
    expect('groundingVersion' in exchangeOf(written)).toBe(false);
  });

  it("'on': the grounded prompt is built, the grounded history is sent (tagged pairs only), the exchange carries the marker", async () => {
    grounding.mode = 'on';
    const { res, written } = await run(HISTORY_BATTLE);
    expect(res.statusCode).toBe(200);
    expect(voiceLayerArgs.current[0].grounded).toBe(true);
    // Site 27: the grounded elicitation line replaces the discovered one.
    expect(voiceLayerArgs.current[0].elicitationTarget.dimension).toBe('time_of_day_preference');
    expect(voiceLayerArgs.current[0].elicitationTarget.instruction).toContain("'file it before the next check'");
    expect(voiceLayerArgs.current[0].elicitationTarget.instruction).not.toContain("'act now at open'");
    // The history window: the user pair, tagged by its code-default type; the
    // grounded anticipation rides the system prompt (the builder gets the
    // battle), and the legacy one is nowhere.
    expect(gemmaOpts[0].conversationHistory).toEqual([
      { role: 'user', content: 'How are we looking?' },
      { role: 'assistant', content: '[user_initiated] CF is carrying the book.' },
    ]);
    expect(voiceLayerArgs.current[0].battle.chatExchanges).toContain(GROUNDED_ANTICIPATION);
    const ex = exchangeOf(written);
    expect(ex.groundingVersion).toBe(1);
    // The persisted shape is otherwise the shipped one: no messageType (ruling 23).
    expect('messageType' in ex).toBe(false);
  });

  it("'on' in REVIEW mode: not grounded — the review prompt is untouched by this arc", async () => {
    grounding.mode = 'on';
    const { res, written } = await run({ ...VALID_BATTLE, status: 'completed' }, { mode: 'review' });
    expect(res.statusCode).toBe(200);
    expect(voiceLayerArgs.current[0].mode).toBe('review');
    expect(voiceLayerArgs.current[0].grounded).toBe(false);
    expect('groundingVersion' in exchangeOf(written)).toBe(false);
  });

  it("'on': a League ask is grounded too — one endpoint, one prompt (spec §8)", async () => {
    grounding.mode = 'on';
    leagueChatFlag.on = true;
    const { res, written } = await run({ ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' }, { leagueAsk: true });
    expect(res.statusCode).toBe(200);
    expect(voiceLayerArgs.current[0].grounded).toBe(true);
    expect(exchangeOf(written).groundingVersion).toBe(1);
  });
});

// ==================== Voice-layer grounding — chips minted by id (G5, spec §6.2 / §6.3) ====================

describe('agent/chat — voice-layer grounding: chips minted by id (spec §6.2 / §6.3)', () => {
  const MOMENTUM_AGENT = { ...VALID_AGENT, archetype: 'momentum_chaser' };
  const MODEL_CHIPS = [
    { kind: 'directive', id: 'TF-02', text: 'whatever the model wrote' },
    { kind: 'directive', id: 'DV-02' },          // another archetype's menu → dropped
    { kind: 'directive', id: 'TF-02' },          // duplicate → dropped
    { kind: 'ask', text: 'Why confirmation?' },
    'Show me the checks',                        // legacy string → a question
    { kind: 'weather', text: 'sunny' },          // unknown kind → dropped
  ];
  const run = async (battle, body = {}, agent = MOMENTUM_AGENT) => {
    callGemmaVoiceImpl.current = async () => JSON.stringify({ response: 'Two ways to shape the next checks.', suggestedActions: MODEL_CHIPS });
    const fixture = makeFakeFirestore({ agent, battle });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'What would you file?', ...body });
    await handler(req, res);
    return { res, written: fixture.written };
  };
  const exchangeOf = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion').updates.chatExchanges.items[0];

  it("'on': the chips are normalized by the SERVER-DERIVED archetype — canonical text, off-menu/duplicate/unknown dropped — on the response, the exchange and the shadow log", async () => {
    grounding.mode = 'on';
    const { res, written } = await run(VALID_BATTLE);
    expect(res.statusCode).toBe(200);
    const expected = [
      { kind: 'directive', id: 'TF-02', text: 'Require stronger confirmation before entering' },
      { kind: 'ask', text: 'Why confirmation?' },
      { kind: 'ask', text: 'Show me the checks' },
    ];
    expect(res.body.suggestedActions).toEqual(expected);
    expect(exchangeOf(written).suggestedActions).toEqual(expected);
    expect(shadowLogCalls.current[0].suggestedActions).toEqual(expected);
  });

  it("'on': the response says it is grounded and carries the CURRENT directive thread — the slot's when this turn filed nothing, this turn's when it did", async () => {
    grounding.mode = 'on';
    const slot = { text: 'Require stronger confirmation before entering', directiveThreadId: 'thread-tf02-0001', createdAt: '2026-09-08T15:20:00.000Z', expiry: 'end_of_battle' };
    const { res } = await run({ ...VALID_BATTLE, directive: slot });
    expect(res.body.grounded).toBe(true);
    expect(res.body.currentDirectiveThreadId).toBe('thread-tf02-0001');
    // No slot → null (the belief the client must send for a first filing).
    const { res: none } = await run(VALID_BATTLE);
    expect(none.body.currentDirectiveThreadId).toBeNull();
    // This turn files → its own thread, which is also the exchange's and the slot's.
    callGemmaVoiceImpl.current = async () => JSON.stringify({ response: 'Filed.', hasDirective: true, directive: { text: 'Require stronger confirmation before entering', expiry: 'end_of_battle' } });
    const fixture = makeFakeFirestore({ agent: MOMENTUM_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    const { req, res: filed } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'Do it.' });
    await handler(req, filed);
    expect(filed.statusCode).toBe(200);
    expect(filed.body.currentDirectiveThreadId).toBe(exchangeOf(fixture.written).directiveThreadId);
    expect(filed.body.currentDirectiveThreadId).toEqual(expect.any(String));
  });

  it("the archetype is the BATTLE's frozen snapshot when it has one — a diversifier snapshot over a momentum_chaser agent doc keeps DV-02 and drops TF-02 (review R-07)", async () => {
    grounding.mode = 'on';
    const { res } = await run({ ...VALID_BATTLE, agentContext: { archetype: 'diversifier' } });
    expect(res.body.suggestedActions).toEqual([
      { kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' },
      { kind: 'ask', text: 'Why confirmation?' },
      { kind: 'ask', text: 'Show me the checks' },
    ]);
  });

  it("'on' with an archetype that has no menu: every directive chip is dropped, the questions stay", async () => {
    grounding.mode = 'on';
    const { res } = await run(VALID_BATTLE, {}, VALID_AGENT); // 'strategist' — no allowlist
    expect(res.body.suggestedActions).toEqual([
      { kind: 'ask', text: 'Why confirmation?' },
      { kind: 'ask', text: 'Show me the checks' },
    ]);
  });

  it("'off' / 'shadow': the model's chips pass through untouched and the response gains no field", async () => {
    for (const mode of ['off', 'shadow']) {
      grounding.mode = mode;
      const { res, written } = await run(VALID_BATTLE);
      expect(res.statusCode).toBe(200);
      expect(res.body.suggestedActions).toEqual(MODEL_CHIPS);
      expect(exchangeOf(written).suggestedActions).toEqual(MODEL_CHIPS);
      expect('grounded' in res.body).toBe(false);
      expect('currentDirectiveThreadId' in res.body).toBe(false);
    }
  });
});

// ==================== Voice-layer grounding — the shadow assembly (G6, spec §9) ====================

describe('agent/chat — voice-layer grounding: the shadow assembly (spec §9, G6)', () => {
  const GROUNDED_ANTICIPATION = {
    userMessage: null, agentResponse: 'At the 11:15 AM check my trading process flagged NOW on the bench as a potential entry.',
    messageType: 'anticipation', timestamp: '2026-09-08T15:16:00.000Z', mode: 'battle', groundingVersion: 1,
  };
  const LEGACY_ANTICIPATION = {
    userMessage: null, agentResponse: 'Eyeing AVGO on the bench.', messageType: 'anticipation', timestamp: '2026-09-08T14:16:00.000Z', mode: 'battle',
  };
  const USER_PAIR = { userMessage: 'How are we looking?', agentResponse: 'CF is carrying the book.', timestamp: '2026-09-08T14:05:00.000Z', mode: 'battle' };
  const HISTORY_BATTLE = { ...VALID_BATTLE, chatExchanges: [LEGACY_ANTICIPATION, USER_PAIR, GROUNDED_ANTICIPATION] };
  const LEGACY_WINDOW = [
    { role: 'user', content: 'How are we looking?' },
    { role: 'assistant', content: 'CF is carrying the book.' },
  ];
  const GROUNDED_WINDOW = [
    { role: 'user', content: 'How are we looking?' },
    { role: 'assistant', content: '[user_initiated] CF is carrying the book.' },
  ];
  const PROFILE_TARGETING_TIME = Object.fromEntries(
    ['risk_appetite', 'concentration_tolerance', 'sector_convictions', 'loss_reaction', 'win_reaction', 'tier_philosophy', 'momentum_vs_value',
      'news_sensitivity', 'macro_awareness', 'communication_frequency', 'autonomy_preference', 'feedback_style', 'competitive_focus', 'learning_orientation']
      .map((d) => [d, { value: 'x', confidence: 0.9 }]),
  );
  let gemmaOpts;
  const run = async (battle, body = {}) => {
    gemmaOpts = [];
    callGemmaVoiceImpl.current = async (opts) => { gemmaOpts.push(opts); return '{"response":"ok"}'; };
    const fixture = makeFakeFirestore({ agent: { ...VALID_AGENT, partnerProfile: PROFILE_TARGETING_TIME }, battle });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi', ...body });
    await handler(req, res);
    return { res, written: fixture.written };
  };
  const exchangeOf = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion').updates.chatExchanges.items[0];
  const GROUNDING_FIELDS = ['voiceGroundingMode', 'systemPromptOld', 'systemPromptNew', 'conversationHistoryOld', 'conversationHistoryNew'];

  it("'shadow': both prompts assembled — the shipped one SENT (built first), the grounded counterpart second — both on the record with the mode and both windows; no marker on the exchange", async () => {
    grounding.mode = 'shadow';
    const { res, written } = await run(HISTORY_BATTLE);
    expect(res.statusCode).toBe(200);
    const [sent, counterpart] = voiceLayerArgs.current;
    expect(voiceLayerArgs.current).toHaveLength(2);
    expect(sent.grounded).toBe(false);
    expect(counterpart.grounded).toBe(true);
    // The same dimension, each prompt's own instruction table (site 27).
    expect(counterpart.elicitationTarget.dimension).toBe('time_of_day_preference');
    expect(sent.elicitationTarget.dimension).toBe('time_of_day_preference');
    expect(sent.elicitationTarget.instruction).toContain("'act now at open'");
    expect(counterpart.elicitationTarget.instruction).toContain("'file it before the next check'");
    // Each prompt's own history window; the model got the shipped one.
    expect(sent.conversationHistory).toEqual(LEGACY_WINDOW);
    expect(counterpart.conversationHistory).toEqual(GROUNDED_WINDOW);
    expect(gemmaOpts).toHaveLength(1);
    expect(gemmaOpts[0].conversationHistory).toEqual(LEGACY_WINDOW);
    // The record: the mode, both prompts, both windows.
    const record = shadowLogCalls.current[0];
    expect(record.voiceGroundingMode).toBe('shadow');
    expect(record.systemPromptOld).toBe('system-prompt-stub:old');
    expect(record.systemPromptNew).toBe('system-prompt-stub:new');
    expect(gemmaOpts[0].systemPrompt).toBe('system-prompt-stub:old');
    expect(record.conversationHistoryOld).toEqual(LEGACY_WINDOW);
    expect(record.conversationHistoryNew).toEqual(GROUNDED_WINDOW);
    expect(record.turnError).toBeUndefined();
    // Sent the old → the exchange is the shipped shape.
    expect('groundingVersion' in exchangeOf(written)).toBe(false);
  });

  it("'on': the grounded prompt SENT (built first), the shipped counterpart second; the record says 'on' and carries both", async () => {
    grounding.mode = 'on';
    const { written } = await run(HISTORY_BATTLE);
    const [sent, counterpart] = voiceLayerArgs.current;
    expect(voiceLayerArgs.current).toHaveLength(2);
    expect(sent.grounded).toBe(true);
    expect(counterpart.grounded).toBe(false);
    expect(sent.conversationHistory).toEqual(GROUNDED_WINDOW);
    expect(counterpart.conversationHistory).toEqual(LEGACY_WINDOW);
    expect(counterpart.elicitationTarget.instruction).toContain("'act now at open'");
    expect(gemmaOpts[0].conversationHistory).toEqual(GROUNDED_WINDOW);
    const record = shadowLogCalls.current[0];
    expect(record.voiceGroundingMode).toBe('on');
    expect(record.systemPromptOld).toBe('system-prompt-stub:old');
    expect(record.systemPromptNew).toBe('system-prompt-stub:new');
    expect(gemmaOpts[0].systemPrompt).toBe('system-prompt-stub:new');
    expect(record.conversationHistoryOld).toEqual(LEGACY_WINDOW);
    expect(record.conversationHistoryNew).toEqual(GROUNDED_WINDOW);
    expect(exchangeOf(written).groundingVersion).toBe(1);
  });

  it("'shadow': a COUNTERPART assembly that throws is recorded and the shipped turn goes on — 200, the old prompt sent (review R-05)", async () => {
    grounding.mode = 'shadow';
    promptBuilder.throwWhen = (args) => args.grounded === true;
    const { res, written } = await run(HISTORY_BATTLE);
    expect(res.statusCode).toBe(200);
    expect(gemmaOpts).toHaveLength(1);
    expect(gemmaOpts[0].systemPrompt).toBe('system-prompt-stub:old');
    expect('groundingVersion' in exchangeOf(written)).toBe(false);
    const record = shadowLogCalls.current[0];
    expect(record.voiceGroundingMode).toBe('shadow');
    expect(record.systemPromptOld).toBe('system-prompt-stub:old');
    expect(record.systemPromptNew).toBeNull();
    expect(record.conversationHistoryNew).toEqual(GROUNDED_WINDOW);
    expect(record.shadowAssemblyError).toContain('builder exploded (grounded=true)');
  });

  it("'on': the OLD counterpart throwing is recorded, the grounded turn goes on; the SENT (grounded) prompt throwing still fails the turn", async () => {
    grounding.mode = 'on';
    promptBuilder.throwWhen = (args) => args.grounded === false;
    const { res } = await run(HISTORY_BATTLE);
    expect(res.statusCode).toBe(200);
    expect(gemmaOpts[0].systemPrompt).toBe('system-prompt-stub:new');
    expect(shadowLogCalls.current[0].systemPromptOld).toBeNull();
    expect(shadowLogCalls.current[0].shadowAssemblyError).toContain('grounded=false');
    // The sent side is never guarded: a broken grounded prompt must not be silently swapped for the old one.
    promptBuilder.throwWhen = (args) => args.grounded === true;
    const { res: failed } = await run(HISTORY_BATTLE);
    expect(failed.statusCode).toBe(500);
    expect(gemmaOpts).toHaveLength(0);
  });

  it("'off': ONE build, and the record carries none of the five fields — the shipped record, byte for byte", async () => {
    grounding.mode = 'off';
    await run(HISTORY_BATTLE);
    expect(voiceLayerArgs.current).toHaveLength(1);
    expect(voiceLayerArgs.current[0].grounded).toBe(false);
    for (const field of GROUNDING_FIELDS) expect(field in shadowLogCalls.current[0]).toBe(false);
  });

  it("'shadow' in REVIEW mode: one build, no grounding fields — the review prompt is untouched by this arc", async () => {
    grounding.mode = 'shadow';
    const { res } = await run({ ...HISTORY_BATTLE, status: 'completed' }, { mode: 'review' });
    expect(res.statusCode).toBe(200);
    expect(voiceLayerArgs.current).toHaveLength(1);
    expect(voiceLayerArgs.current[0].mode).toBe('review');
    for (const field of GROUNDING_FIELDS) expect(field in shadowLogCalls.current[0]).toBe(false);
  });

  it("a turn that fails AFTER assembly (a parse failure, a thrown call) still records the mode and both prompts", async () => {
    grounding.mode = 'shadow';
    // The 502 parse path.
    await run(HISTORY_BATTLE);
    shadowLogCalls.current = [];
    callGemmaVoiceImpl.current = async () => 'I have hit a snag';
    parseVoiceLayerResponseImpl.current = (c) => ({ parseError: true, errorReason: 'plaintext_passthrough', rawText: c });
    let fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: HISTORY_BATTLE });
    activeFirestore = fixture.db;
    let rr = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(502);
    expect(shadowLogCalls.current[0].turnError).toBe(true);
    expect(shadowLogCalls.current[0].voiceGroundingMode).toBe('shadow');
    expect(shadowLogCalls.current[0].systemPromptNew).toBe('system-prompt-stub:new');
    expect(shadowLogCalls.current[0].conversationHistoryNew).toEqual(GROUNDED_WINDOW);
    // The catch path (the call threw after the prompts were built).
    shadowLogCalls.current = [];
    parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
    callGemmaVoiceImpl.current = async () => { throw new Error('boom'); };
    fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: HISTORY_BATTLE });
    activeFirestore = fixture.db;
    rr = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(500);
    expect(shadowLogCalls.current[0].errorReason).toBe('handler_exception');
    expect(shadowLogCalls.current[0].voiceGroundingMode).toBe('shadow');
    expect(shadowLogCalls.current[0].systemPromptOld).toBe('system-prompt-stub:old');
    expect(shadowLogCalls.current[0].conversationHistoryOld).toEqual(LEGACY_WINDOW);
  });
});

// ==================== THE SHADOW RECORD'S DURABILITY ====================
//
// NOT a §5 catalog claim: these records are NOT catalog events — the durable
// `chatExchanges` write is (see the Catalog #9 block above), and the
// Implementation Spec §2 rules the shadow logger out of that role in as many
// words. §5 PERMITS fire-and-forget here. They are settled anyway because two
// of the three are the only trace a failed turn leaves and a frozen invocation
// dropped them silently — §5's cautionary tale, not its rule. These rows hold
// the two ways the handler now gives the write a chance to finish, the cap that
// bounds what the second one costs, and the clamp that keeps the cap from
// spending budget the awaited writes need.
describe('agent/chat — the shadow record finishes before the function can be frozen', () => {
  const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
  // The REAL @vercel/functions waitUntil resolves this symbol and calls
  // `context.waitUntil?.(promise)` (its get-context.js), so installing a context
  // here drives the shipped package rather than a double of it — and with no
  // context installed, the package's own no-op is what the fallback path is
  // measured against.
  const installRequestContext = () => {
    const waited = [];
    globalThis[REQUEST_CONTEXT] = { get: () => ({ waitUntil: (p) => { waited.push(p); return undefined; } }) };
    return waited;
  };
  afterEach(() => {
    delete globalThis[REQUEST_CONTEXT];
    vi.useRealTimers();
  });

  const okTurn = () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => '{"response":"hello there"}';
    return { fixture, ...makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' }) };
  };

  it('a normal turn: the record is WRITTEN by the time the handler returns (not merely started)', async () => {
    let persistedAt = null;
    shadowLog.impl = async () => {
      await new Promise((r) => setTimeout(r, 5)); // a write that takes real time
      persistedAt = 'settled';
      return true;
    };
    const { req, res, fixture } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    expect(shadowLogCalls.current).toHaveLength(1);
    // The point of the whole change: a fire-and-forget call leaves this null.
    expect(persistedAt).toBe('settled');
    expect(fixture.written.updateCalls).toHaveLength(1);
  });

  it('the 502 parse path and the catch path settle their records too — all three sites', async () => {
    const settled = [];
    shadowLog.impl = async (record) => {
      await new Promise((r) => setTimeout(r, 5));
      settled.push(record.errorReason ?? 'ok');
      return true;
    };
    // (1) the parse failure → 502
    let fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => 'I have hit a snag';
    parseVoiceLayerResponseImpl.current = (c) => ({ parseError: true, errorReason: 'plaintext_passthrough', rawText: c });
    let rr = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(502);
    expect(settled).toEqual(['parse_plaintext_passthrough']);

    // (2) the handler exception → 500
    parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
    callGemmaVoiceImpl.current = async () => { throw new Error('boom'); };
    fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    rr = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hi' });
    await handler(rr.req, rr.res);
    expect(rr.res.statusCode).toBe(500);
    expect(settled).toEqual(['parse_plaintext_passthrough', 'handler_exception']);
  });

  it('a SLOW logger cannot delay the response past the 2s cap', async () => {
    // A write that never settles — a hung GCS call, the worst case the cap
    // exists for. The turn must still answer, and answer at the cap.
    shadowLog.impl = () => new Promise(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    const { req, res } = okTurn();
    let done = false;
    const turn = handler(req, res).then(() => { done = true; });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(done).toBe(false);           // still inside the cap
    await vi.advanceTimersByTimeAsync(1);
    await turn;
    expect(done).toBe(true);            // released AT the cap, not later
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    const capLines = warn.mock.calls.filter(([m]) => String(m).includes('still writing after'));
    expect(capLines).toHaveLength(1);
    expect(capLines[0][0]).toContain(`after ${SHADOW_LOG_CAP_MS}ms`);
    // …and it names the battle, like its two siblings: an unattributable line is
    // the same silence one step removed.
    expect(capLines[0]).toContain('battle-1');
  });

  it('with the runtime hook installed the write is handed to waitUntil — no wait at all, even for a hung logger', async () => {
    const waited = installRequestContext();
    shadowLog.impl = () => new Promise(() => {});
    const { req, res } = okTurn();
    const startedAt = Date.now();
    await handler(req, res);
    const elapsedMs = Date.now() - startedAt;
    expect(res.statusCode).toBe(200);
    expect(waited).toHaveLength(1);                 // the platform owns the write
    expect(elapsedMs).toBeLessThan(SHADOW_LOG_CAP_MS / 2); // and the turn never paid the cap
  });

  it('the cap is CLAMPED to the absolute deadline — a turn already at the ceiling waits zero', async () => {
    // The cap is spent at the tail, after the awaited Firestore writes. Unclamped,
    // a flat 2s there is 2s the writes' headroom no longer has, and on a turn that
    // is already near maxDuration it is the difference between answering and a
    // platform kill (a bare gateway 504 — no shadow log, no honest client string).
    shadowLog.impl = () => new Promise(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    // Burn the whole settle window before the handler ever reaches the settle:
    // the prologue takes longer than SHADOW_SETTLE_DEADLINE_MS.
    authDelayMs.current = SHADOW_SETTLE_DEADLINE_MS + 1_000;
    const { req, res } = okTurn();
    let done = false;
    handler(req, res).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(authDelayMs.current);
    // The prologue is over; the settle must now cost NOTHING rather than 2s.
    // 100ms is generous for the remaining awaits and far short of the unclamped
    // cap, so an unclamped settle leaves `done` false here.
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    // A zero-length cap still reports the loss — and reports it as zero, not 2000.
    const capLines = warn.mock.calls.filter(([m]) => String(m).includes('still writing after'));
    expect(capLines).toHaveLength(1);
    expect(capLines[0][0]).toContain('after 0ms');
  });

  it('a runtime hook that THROWS cannot leave the turn with no response — it falls back to the in-request settle', async () => {
    // captureConversation is called FROM the handler's catch block, so a throw
    // escaping it escapes the catch too and the handler answers with nothing at
    // all. The hook is the one statement in that function outside the promise
    // chain, so it is the one that has to be contained.
    globalThis[REQUEST_CONTEXT] = { get: () => ({ waitUntil: () => { throw new Error('invocation already ended'); } }) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { req, res } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    expect(warn.mock.calls.filter(([m]) => String(m).includes('runtime waitUntil hook unusable'))).toHaveLength(1);
    // The record is not dropped by the fallback — it is settled in-request.
    expect(shadowLogCalls.current).toHaveLength(1);
  });

  it('a request context whose get() throws is contained the same way', async () => {
    globalThis[REQUEST_CONTEXT] = { get: () => { throw new Error('context store unavailable'); } };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { req, res } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(shadowLogCalls.current).toHaveLength(1);
  });

  it('a record that did NOT persist is reported, once, and never fails the turn', async () => {
    // The logger's silent no-op stays: no GCS_CREDENTIALS → false, never a
    // throw, never a 500. What is new is that the handler says so — one line.
    shadowLog.impl = async () => false;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { req, res } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe('hello there');
    const lines = warn.mock.calls.filter(([m]) => String(m).includes('shadow conversation record NOT persisted'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('battle-1');
  });

  it('a logger that THROWS is contained too — reported, no unhandled rejection, turn unchanged', async () => {
    shadowLog.impl = async () => { throw new Error('gcs exploded'); };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { req, res } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('shadow conversation record threw'))).toHaveLength(1);
  });

  it('the retired shape cannot come back: exactly ONE logConversation call site, inside the wrapper', () => {
    // Structural, over the source with COMMENTS STRIPPED — the header quotes the
    // retired `logConversation({…}).catch(() => {})` shape in prose, and a
    // tripwire that a decoy comment can satisfy (or that a reflow can red) is
    // not a guard. Anchoring on line starts was the earlier mistake: `void
    // logConversation({…})` and `return logConversation({…})` both slipped it.
    const src = readFileSync(new URL('./chat.js', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(src.match(/\blogConversation\s*\(/g)).toHaveLength(1); // the wrapper's own call
    expect(src).toContain('.then(() => logConversation(record))');
    expect(src).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\}\)/);  // no fire-and-forget anywhere
    // B2 adds a FOURTH record site: a refusal decided inside the filing
    // transaction returns rather than throwing, so the turnError row the catch
    // block used to produce for that case is written explicitly beside the
    // composed record. Four sites, still one logConversation call.
    expect(src.match(/captureConversation\s*\(\{/g)).toHaveLength(4);
  });

  it('a persisted record says nothing (the warning is a signal, not noise)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { req, res } = okTurn();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('shadow conversation record'))).toHaveLength(0);
  });
});

// ============================================================================
// Phase C §5 — THE RESEARCH FOLLOW-UP'S REPLY LINT (D-121; discovery item 13)
//
// The lint is applied IN CODE, on the route, to a turn whose prompt actually
// carried a PLATFORM RESEARCH block — and to no other turn in the product. A
// breach is WITHHELD, not voiced: the reply is replaced by a code-owned line
// (the renderDirectiveStatus precedent) and the record says so.
// ============================================================================

describe('agent/chat — the research follow-up reply lint (Phase C §5)', () => {
  const CARD = {
    symbol: 'MPC',
    eyebrow: 'Research',
    platformDataLabel: 'Platform data · not what the check saw',
    technicals: { facts: ['RSI 62.4 · neutral'], label: 'Technicals · daily indicators as of Sep 8' },
    fundamentals: { facts: ['P/E 14.2 · sector median 19.6'], label: 'Fundamentals · as of Sep 5' },
    standing: { place: 'bench', line: 'On the bench', facts: [] },
  };
  const RESEARCH_EXCHANGE = { messageType: 'research', symbol: 'MPC', card: CARD, agentResponse: '', timestamp: '2026-09-09T14:00:00.000Z' };
  const WITHHELD = "That answer didn't hold to the rules this conversation runs under, so it wasn't sent. Ask again and I'll stick to what the record and the platform's own dated data say.";

  const run = async (reply, { cards = [RESEARCH_EXCHANGE], chips = ['Tell me more'] } = {}) => {
    callGemmaVoiceImpl.current = async () => JSON.stringify({ response: reply, suggestedActions: chips });
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: { ...VALID_BATTLE, chatExchanges: cards } });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'what do you think about those numbers?' });
    await handler(req, res);
    const union = fixture.written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
    return { res, exchange: union?.updates.chatExchanges.items[0] ?? null };
  };

  it('a reply that describes the card at its dates is sent unchanged', async () => {
    grounding.mode = 'on';
    showIt.on = true;
    const good = 'The card puts MPC at a P/E of 14.2 against a sector median of 19.6, as of Sep 5.';
    const { res, exchange } = await run(good);
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe(good);
    expect(exchange.agentResponse).toBe(good);
    expect(exchange.researchLint).toBeUndefined();
  });

  it('a VERDICT is withheld — the response, the exchange and the chips all', async () => {
    grounding.mode = 'on';
    showIt.on = true;
    const { res, exchange } = await run('Cheap against the sector — I would buy it here.');
    expect(res.statusCode).toBe(200);
    expect(res.body.agentMessage).toBe(WITHHELD);
    expect(res.body.suggestedActions).toBeNull();
    expect(exchange.agentResponse).toBe(WITHHELD);
    expect(exchange.suggestedActions).toBeNull();
    // The record says WHY the line is there, rather than leaving it looking
    // like a sentence the character chose.
    expect(exchange.researchLint).toBe('withheld');
  });

  it('WITHHOLDS THE WHOLE TURN: no directive is filed from a sentence that was not sent (review B-1)', async () => {
    grounding.mode = 'on';
    showIt.on = true;
    callGemmaVoiceImpl.current = async () => JSON.stringify({
      response: 'Cheap against the sector — I would buy it here.',
      hasDirective: true,
      directive: { text: 'Lean into refiners on valuation', expiry: 'end_of_battle' },
    });
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: { ...VALID_BATTLE, chatExchanges: [RESEARCH_EXCHANGE] } });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'what do you think?' });
    await handler(req, res);
    const union = fixture.written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
    const exchange = union.updates.chatExchanges.items[0];

    expect(res.body.agentMessage).toBe(WITHHELD);
    expect(res.body.extractedRule).toBeNull();
    expect(res.body.hasDirective).toBe(false);
    expect(res.body.directive).toBeNull();
    expect(exchange.hasDirective).toBe(false);
    expect(exchange.directive).toBeNull();
    expect(exchange.directiveThreadId).toBeNull();
    // …and no directive SLOT is written onto the battle either.
    const slotWrite = fixture.written.updateCalls.find(c => c.updates?.directive);
    expect(slotWrite).toBeUndefined();
  });

  it('the shadow record keeps the MODEL’s own text, not the code-authored line (review B-6)', async () => {
    grounding.mode = 'on';
    showIt.on = true;
    const breach = 'Cheap against the sector — I would buy it here.';
    await run(breach);
    const record = shadowLogCalls.current[0];
    expect(record.agentMessage).toBe(breach);
    expect(record.researchLint).toBe('withheld');
    expect(record.researchLintSent).toBe(WITHHELD);
  });

  it('the same verdict is UNTOUCHED on a battle with no research card — the lint is scoped', async () => {
    grounding.mode = 'on';
    showIt.on = true;
    const verdict = 'Cheap against the sector — I would buy it here.';
    const { res, exchange } = await run(verdict, { cards: [] });
    expect(res.body.agentMessage).toBe(verdict);
    expect(exchange.researchLint).toBeUndefined();
  });

  it('and is UNTOUCHED while the flag is dark, card or no card', async () => {
    grounding.mode = 'on';
    showIt.on = false;
    const verdict = 'Cheap against the sector — I would buy it here.';
    const { res, exchange } = await run(verdict);
    expect(res.body.agentMessage).toBe(verdict);
    expect(exchange.researchLint).toBeUndefined();
  });

  it('and is UNTOUCHED on an ungrounded turn', async () => {
    grounding.mode = 'off';
    showIt.on = true;
    const verdict = 'Cheap against the sector — I would buy it here.';
    const { res, exchange } = await run(verdict);
    expect(res.body.agentMessage).toBe(verdict);
    expect(exchange.researchLint).toBeUndefined();
  });
});

// ============================================================================
// B2 — THE SHARED FILING TRANSACTION (PHASE_B_TICK_STAMPS_SPEC_V1.md §2)
//
// The typed path's durable write used to be a single unconditioned
// `battleRef.update()` ~630 lines after the only battle read. Every row here
// names the defect it guards (Phase 0 §2.4) and fails against the pre-change
// route — each was run against it first.
// ============================================================================

describe('agent/chat — B2: the write is a transaction (spec §2)', () => {
  const TOURNEY_BATTLE = { ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' };

  const mainUpdate = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
  const post = (body) => makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hold the line', ...body });

  // B-1 — Phase 0 §2.4(a): "The write is not conditioned on the battle still
  // being open." `battle.status` was read once, ~630 lines and one model call
  // before the write, and the write carried no precondition — so a typed turn
  // that overlapped the close cron landed a directive in a COMPLETED battle.
  // research.js:341-345 states the same hazard for its own route in so many
  // words: "agent-evaluate flips a battle to `completed` on its own schedule".
  it('B-1 (a): a battle the close cron completes DURING the model call is refused INSIDE the transaction — nothing written', async () => {
    grounding.mode = 'on';
    archetypeFlag.mode = 'enforce';
    const fixture = makeFakeFirestore({ agent: { ...VALID_AGENT, archetype: 'diversifier' }, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    // The close cron lands while the model is answering — after the pre-model
    // status check at step 9 has already passed.
    callGemmaVoiceImpl.current = async () => {
      fixture.battleState.status = 'completed';
      return JSON.stringify({ response: 'widening out', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'DV-02' } });
    };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('battle_not_active');
    // NOTHING persisted: no exchange, no directive slot, no charge.
    expect(fixture.written.updateCalls).toHaveLength(0);
    expect(fixture.written.setCalls).toHaveLength(0);
    expect(fixture.battleState.chatExchanges).toHaveLength(0);
    expect(fixture.battleState.directive).toBeUndefined();
    expect(fixture.battleState.chatBudgetUsed).toBe(0);
  });

  it('B-1b: review mode is still valid on a completed battle — the in-transaction check follows step 9s own rule', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, status: 'completed', reviewBudgetUsed: 0 },
    });
    activeFirestore = fixture.db;

    const { req, res } = post({ mode: 'review' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mainUpdate(fixture.written).updates.reviewBudgetUsed).toBe(1);
  });

  // B-2 — Phase 0 §2.4(b) + (e1): the budget check read a pre-model snapshot and
  // the charge was `FieldValue.increment(1)` — a blind server-side increment
  // with no read-back and no cap comparison, which D-105 names as forbidden.
  // Two turns starting in the same model-call window both read used = 9, both
  // passed, both incremented → 11 of 10.
  //
  // The two-writer shape is api/_utils/mandateEscape.test.js:137-152's: a
  // barrier lands the other writer between this transaction's reads and its
  // commit, and the body re-runs against the changed document.
  it('B-2 (b, e1): two turns that both read used = 9 → the eleventh COMMITS with overBudget, and the doc reads 10', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, chatBudgetUsed: 9 },
    });
    activeFirestore = fixture.db;
    // The other turn commits its tenth message inside this one's window.
    fixture.db.setBarrier(async () => { fixture.battleState.chatBudgetUsed = 10; });

    const { req, res } = post({});
    await handler(req, res);

    // Ruling 5: "a race that produces an eleventh COMMITS and stamps
    // `overBudget: true` on the exchange — never fail a turn after the model
    // answered."
    expect(res.statusCode).toBe(200);
    expect(fixture.written.txAttempts).toBe(2);       // the retry re-read the doc
    const upd = mainUpdate(fixture.written).updates;
    expect(upd.chatExchanges.items[0].overBudget).toBe(true);
    // …and the cap is authoritative: the eleventh does not increment.
    expect('chatBudgetUsed' in upd).toBe(false);
    expect(fixture.battleState.chatBudgetUsed).toBe(10);
    // D-105, in terms: an explicit count, never FieldValue.increment.
    const raw = readFileSync(new URL('./chat.js', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(raw).not.toContain('FieldValue.increment(1)');
  });

  it('B-2b: a turn within budget charges exactly one, counted from the IN-TRANSACTION read', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, chatBudgetUsed: 3 },
    });
    activeFirestore = fixture.db;
    // Another turn lands its own message inside this one's window: the retry
    // re-reads 4, so this turn writes 5 — not the 4 a pre-model count would.
    fixture.db.setBarrier(async () => { fixture.battleState.chatBudgetUsed = 4; });

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mainUpdate(fixture.written).updates.chatBudgetUsed).toBe(5);
    expect(mainUpdate(fixture.written).updates.chatExchanges.items[0].overBudget).toBeUndefined();
  });

  // B-3 — Phase 0 §2.4(e2): "A typed filing can persist while charging nothing
  // (League)." The exchange write and the League charge were separate
  // transactions, the charge was second, and its failure was caught and
  // swallowed at chat.js:1111-1115 — a filing that landed and cost nothing.
  it('B-3 (e2): a League charge that fails takes the whole filing with it — nothing persists', async () => {
    leagueChatFlag.on = true;
    budget.resolveImpl = () => ({ groupId: 'group-xyz', dayN: 1 });
    budget.readImpl = async () => ({ count: 1, remaining: 9 });
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: TOURNEY_BATTLE });
    activeFirestore = fixture.db;
    // The cross-document commit is refused: Firestore lands NEITHER write.
    fixture.db.failCommitWhen((buffer) => buffer.some((w) => w.col === 'agentChatBudget'));

    const { req, res } = post({ leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    // The whole filing is gone — not the exchange without the charge.
    expect(fixture.written.updateCalls).toHaveLength(0);
    expect(fixture.written.setCalls).toHaveLength(0);
    expect(fixture.battleState.chatExchanges).toHaveLength(0);
    expect(fixture.budgetState['group-xyz_test-user_1']).toBeUndefined();
    // The second transaction is gone from the route entirely.
    expect(budget.chargeCalls).toHaveLength(0);
    const raw = readFileSync(new URL('./chat.js', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(raw).not.toContain('chargeAgentChatBudget(');
  });

  // B-4 — Phase 0 §2.4(e3): "The typed path has no conflict detection at all."
  // A typed directive silently overwrote a chip filing that landed during the
  // model call and no surface was told. Spec ruling 4 rules this deliberately:
  // latest-wins files anyway; the outcome records the ACTUAL replaced thread
  // from the in-transaction read.
  it('B-4 (e3): a chip filing that lands during the model call is REPLACED, not refused (ruling 4 latest-wins)', async () => {
    grounding.mode = 'on';
    archetypeFlag.mode = 'enforce';
    const fixture = makeFakeFirestore({ agent: { ...VALID_AGENT, archetype: 'diversifier' }, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => {
      // The player tapped a chip while the model was answering.
      fixture.battleState.directive = {
        text: 'Tighten the spread', expiry: 'end_of_battle', directiveThreadId: 'chip-thread-1', createdAt: 'now',
      };
      return JSON.stringify({ response: 'widening out', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'DV-02' } });
    };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const upd = mainUpdate(fixture.written).updates;
    // It FILED — the typed turn is not refused after the model answered.
    expect(upd.directive.directiveThreadId).toEqual(expect.any(String));
    expect(upd.directive.directiveThreadId).not.toBe('chip-thread-1');
    expect(upd.directive.adjustmentId).toBe('DV-02');
    // …and the current-thread answer is this turn's, not the chip's.
    expect(res.body.currentDirectiveThreadId).toBe(upd.directive.directiveThreadId);
  });

  it('B-4b: a turn that replaces the directive the caller ALREADY knew about is not reported as a surprise', async () => {
    grounding.mode = 'on';
    archetypeFlag.mode = 'enforce';
    const known = { text: 'Tighten the spread', expiry: 'end_of_battle', directiveThreadId: 'known-thread', createdAt: 'now' };
    const fixture = makeFakeFirestore({
      agent: { ...VALID_AGENT, archetype: 'diversifier' },
      battle: { ...VALID_BATTLE, directive: known },
    });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => JSON.stringify({ response: 'widening out', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'DV-02' } });

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mainUpdate(fixture.written).updates.directive.directiveThreadId).not.toBe('known-thread');
  });

  it('B-4c: a turn that files NO directive leaves the slot alone and still answers the current thread', async () => {
    grounding.mode = 'on';
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, directive: { text: 'standing', expiry: 'end_of_battle', directiveThreadId: 'standing-1', createdAt: 'now' } },
    });
    activeFirestore = fixture.db;

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect('directive' in mainUpdate(fixture.written).updates).toBe(false);
    expect(res.body.currentDirectiveThreadId).toBe('standing-1');
  });

  // The belief the client feeds straight back into file-directive's check 4.
  // The pre-change route answered it from the PRE-MODEL slot — a value a whole
  // model call old — so a chip filed during the call left the chat holding a
  // thread id the server had already replaced, and its next tap 409'd.
  it('B-4d (e3): with no directive filed this turn, the current-thread answer is the slot the COMMITTING attempt read', async () => {
    grounding.mode = 'on';
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, directive: { text: 'standing', expiry: 'end_of_battle', directiveThreadId: 'standing-1', createdAt: 'now' } },
    });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => {
      fixture.battleState.directive = {
        text: 'Tighten the spread', expiry: 'end_of_battle', directiveThreadId: 'chip-thread-1', createdAt: 'now',
      };
      return '{"response":"noted"}';
    };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.currentDirectiveThreadId).toBe('chip-thread-1');
  });
});

// ============================================================================
// B2 — THE ATTESTATION (spec §2 ruling 7)
//
// "the handler knows three outcomes — threw before the transaction (nothing
// persisted, nothing charged), rejected inside it (same), committed then threw
// (persisted and charged); the error body carries `persisted` / `charged`."
// ============================================================================

describe('agent/chat — B2: every response attests persisted / charged (ruling 7)', () => {
  const mainUpdate = (written) => written.updateCalls.find(c => c.updates?.chatExchanges?.__op === 'arrayUnion');
  const post = (body) => makeReqRes({ agentId: 'agent-1', battleId: 'battle-1', message: 'hold the line', ...body });

  it('C-1a: THREW BEFORE the transaction — a timed-out model call attests false / false', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.persisted).toBe(false);
    expect(res.body.charged).toBe(false);
    expect(res.body.reason).toBe('gemma_timeout');
    expect(fixture.written.updateCalls).toHaveLength(0);
  });

  it('C-1b: REFUSED INSIDE the transaction — the closed battle attests false / false with the reason', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => { fixture.battleState.status = 'completed'; return '{"response":"hi"}'; };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.persisted).toBe(false);
    expect(res.body.charged).toBe(false);
    expect(res.body.reason).toBe('battle_not_active');
    expect(fixture.written.updateCalls).toHaveLength(0);
  });

  // THE ROW THAT PROVES THE FIX. Phase 0 §2.4(c-inverse): three awaits sat
  // after the landed write inside the same `try`, so a throw in any of them
  // answered 504/500 for a filing that persisted and charged — and
  // battleViewCopy.js:671-681 records the founder's own smoke of exactly this
  // ("`1/10` and 'nothing was sent' on screen together").
  it('C-1c: COMMITTED THEN THREW — the doc holds the exchange and the charge, and the body says so', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, status: 'completed', reviewBudgetUsed: 1 },
      // The post-commit `agents` write at step 20b fails.
      agentUpdateError: true,
    });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => JSON.stringify({
      response: 'that was the lesson', _lesson: { text: 'size down into a downgrade' },
    });

    const { req, res } = post({ mode: 'review' });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    // The body tells the truth about a turn that DID happen.
    expect(res.body.persisted).toBe(true);
    expect(res.body.charged).toBe(true);
    expect(res.body.reason).toBe('failed_after_commit');
    // …and the document agrees: the exchange landed and the message was spent.
    expect(mainUpdate(fixture.written)).toBeTruthy();
    expect(mainUpdate(fixture.written).updates.reviewBudgetUsed).toBe(2);
    expect(fixture.battleState.chatExchanges).toHaveLength(1);
    expect(fixture.battleState.reviewBudgetUsed).toBe(2);
  });

  it('C-1d: the transaction itself throwing says it does NOT KNOW — never a false claim', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    // A commit that fails is indistinguishable from one that landed and lost
    // its reply: runTransaction retries, and only the route knows it cannot
    // tell. It says so rather than claiming nothing happened.
    fixture.db.failCommitWhen(() => true);

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.persisted).toBeNull();
    expect(res.body.charged).toBeNull();
    expect(res.body.reason).toBe('handler_exception');
  });

  it('C-1e: a clean success attests persisted / charged too', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.persisted).toBe(true);
    expect(res.body.charged).toBe(true);
    expect(res.body.reason).toBeNull();
  });

  it('C-1f: a filing that lands and costs NOTHING says so — charged is not persisted', async () => {
    // The League fail-open: no keyable game day, so the answer is free.
    leagueChatFlag.on = true;
    budget.resolveImpl = () => null;
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      battle: { ...VALID_BATTLE, gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' },
    });
    activeFirestore = fixture.db;

    const { req, res } = post({ leagueAsk: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.persisted).toBe(true);
    expect(res.body.charged).toBe(false);
  });

  // C-2 — Phase 0 §2.4(e4): "the 502 at :814 is post-model, pre-write — and is
  // the one failure status that is honestly attestable today… A free correct
  // answer the contract currently throws away."
  it('C-2 (e4): the 502 parse path is post-model and PRE-write — it attests false / false', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => 'I have hit a snag, could you repeat the question?';
    parseVoiceLayerResponseImpl.current = (c) => ({ parseError: true, errorReason: 'plaintext_passthrough', rawText: c });

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.persisted).toBe(false);
    expect(res.body.charged).toBe(false);
    expect(res.body.reason).toBe('parse_plaintext_passthrough');
    expect(fixture.written.updateCalls).toHaveLength(0);
  });

  // B-4's report half (Phase 0 §2.4 e3, ruling 4): "the outcome records the
  // ACTUAL replaced thread from the in-transaction read." The typed path used
  // to overwrite a chip filing in silence and no surface was told.
  it('C-1g (e3): a typed filing that replaced a chip filing NAMES the thread it replaced', async () => {
    grounding.mode = 'on';
    archetypeFlag.mode = 'enforce';
    const fixture = makeFakeFirestore({ agent: { ...VALID_AGENT, archetype: 'diversifier' }, battle: VALID_BATTLE });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => {
      fixture.battleState.directive = {
        text: 'Tighten the spread', expiry: 'end_of_battle', directiveThreadId: 'chip-thread-1', createdAt: 'now',
      };
      return JSON.stringify({ response: 'widening out', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'DV-02' } });
    };

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.persisted).toBe(true);
    expect(res.body.replacedThreadId).toBe('chip-thread-1');
  });

  it('C-1h: replacing the directive the caller ALREADY knew about carries no replacedThreadId', async () => {
    grounding.mode = 'on';
    archetypeFlag.mode = 'enforce';
    const fixture = makeFakeFirestore({
      agent: { ...VALID_AGENT, archetype: 'diversifier' },
      battle: { ...VALID_BATTLE, directive: { text: 'Tighten', expiry: 'end_of_battle', directiveThreadId: 'known-1', createdAt: 'now' } },
    });
    activeFirestore = fixture.db;
    callGemmaVoiceImpl.current = async () => JSON.stringify({
      response: 'widening out', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'DV-02' },
    });

    const { req, res } = post({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect('replacedThreadId' in res.body).toBe(false);
  });
});
