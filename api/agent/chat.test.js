// api/agent/chat.test.js
//
// Targeted integration coverage for the parseError → 502 banner path
// and the catch-block shadow-logging gap closure added by the Voice
// Layer Snag Bug Fix. Like workshop-chat.test.js, this file is scoped
// narrowly: it does NOT cover the many other handler branches
// (elicitation target, directive normalization, mode detection,
// review lessons, etc.). Those are exercised by manual / E2E tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

// ==================== HOISTED MOCK STATE ====================
const {
  authReturnValue,
  callGemmaVoiceImpl,
  parseVoiceLayerResponseImpl,
  shadowLogCalls,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  callGemmaVoiceImpl: { current: async () => '{"response":"hi"}' },
  parseVoiceLayerResponseImpl: { current: (c) => JSON.parse(c) },
  shadowLogCalls: { current: [] },
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
  buildVoiceLayerPrompt: () => 'system-prompt-stub',
}));

vi.mock('../_utils/marketSchedule.js', () => ({
  getMarketState: () => ({ state: 'OPEN', isOpen: true }),
}));

vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: (opts) => callGemmaVoiceImpl.current(opts),
  parseVoiceLayerResponse: (c) => parseVoiceLayerResponseImpl.current(c),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

const { default: handler } = await import('./chat.js');

// ==================== Test fixture helpers ====================

function makeFakeFirestore({ agent, battle, marketCtx = null, drb = null, voiceCache = null }) {
  const written = { setCalls: [], updateCalls: [] };

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
          return { exists: false, data: () => null };
        },
        update: async (updates) => {
          written.updateCalls.push({ id: docId, updates });
        },
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
  callGemmaVoiceImpl.current = async () => '{"response":"hi"}';
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  shadowLogCalls.current = [];
  activeFirestore = null;
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

  it('AbortError → 504 + shadow logs gemma_timeout', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, battle: VALID_BATTLE });
    activeFirestore = fixture.db;

    callGemmaVoiceImpl.current = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };

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
