// api/forge/workshop-chat.test.js
//
// Targeted integration coverage for the parseError → snag-fallback path
// added by the Voice Layer Snag Bug Fix. The handler has many other
// branches (seedContext validation, thesis normalization, transactions,
// budget enforcement, etc.) that are intentionally NOT covered here —
// this file exists specifically to prove that parseError detection routes
// through the structured-error path with shadow logging, not silently
// passing Gemma's plain text through as agentMessage.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================
const {
  authReturnValue,
  gemmaResult,
  parseVoiceLayerResponseImpl,
  shadowLogCalls,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gemmaResult: {
    current: {
      success: true,
      content:
        '{"_scratchpad":"thinking","response":"hi","activeThesis":{"summary":"s","catalyst":"c","instruments":[],"entryLogic":"e","exitLogic":"x","riskPosture":"r","invalidation":"i","confidence":"low","readyToCompile":false}}',
    },
  },
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

vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async () => gemmaResult.current,
  parseVoiceLayerResponse: (c) => parseVoiceLayerResponseImpl.current(c),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

const { default: handler } = await import('./workshop-chat.js');

// ==================== Test fixture helpers ====================

function makeFakeFirestore({ agent, sessionDocs = {} }) {
  const written = { setCalls: [], updateCalls: [] };
  const docs = { ...sessionDocs };

  const collection = (name) => ({
    doc: (idArg) => {
      const docId = idArg || `auto-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: docId,
        get: async () => {
          if (name === 'agents') {
            return { exists: !!agent, data: () => agent };
          }
          if (name === 'workshopSessions') {
            return { exists: !!docs[docId], data: () => docs[docId] };
          }
          if (name === 'indexIntelligence') {
            return { exists: false, data: () => null };
          }
          return { exists: false, data: () => null };
        },
        set: async (body) => {
          written.setCalls.push({ id: docId, body });
          docs[docId] = body;
        },
        update: async (updates) => {
          written.updateCalls.push({ id: docId, updates });
          docs[docId] = { ...docs[docId], ...updates };
        },
      };
    },
  });

  return {
    db: {
      collection,
      runTransaction: async (fn) => {
        return fn({
          get: async (ref) => ref.get(),
          update: async (ref, u) => {
            written.updateCalls.push({ id: ref.id, updates: u });
            docs[ref.id] = { ...docs[ref.id], ...u };
          },
        });
      },
    },
    written,
    docs,
  };
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

const VALID_AGENT = { ownerId: 'test-user', name: 'Gemma', archetype: 'strategist' };

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  gemmaResult.current = {
    success: true,
    content:
      '{"_scratchpad":"thinking","response":"hi","activeThesis":{"summary":"s","catalyst":"c","instruments":[],"entryLogic":"e","exitLogic":"x","riskPosture":"r","invalidation":"i","confidence":"low","readyToCompile":false}}',
  };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ==================== TESTS ====================

describe('workshop-chat — parseError snag fallback', () => {
  it('returns 200 + snag agentMessage + shadow log when parser returns parseError on first turn', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs: {} });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: true,
      content: 'I have hit a snag, could you repeat the question?',
    };
    parseVoiceLayerResponseImpl.current = (c) => ({
      parseError: true,
      errorReason: 'plaintext_passthrough',
      rawText: c,
    });

    const { req, res } = makeReqRes({ agentId: 'agent-1', message: 'hi' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.errorReason).toBe('parse_plaintext_passthrough');
    expect(res.body.agentMessage).toBe(
      'I hit a snag processing that — could you try that again?',
    );
    // First-turn failure: sessionId is null (session not materialized).
    expect(res.body.sessionId).toBeNull();
    // No write happened — failed turn doesn't burn budget.
    expect(fixture.written.setCalls).toHaveLength(0);
    // Shadow log captured the raw plain text + turnError marker.
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].turnError).toBe(true);
    expect(shadowLogCalls.current[0].errorReason).toBe('parse_plaintext_passthrough');
    expect(shadowLogCalls.current[0].rawGemmaContent).toContain('I have hit a snag');
  });

  it('preserves previous thesis on continuing-turn parseError', async () => {
    const previousThesis = {
      summary: 'prior thesis',
      catalyst: '',
      instruments: [],
      entryLogic: 'e',
      exitLogic: 'x',
      riskPosture: 'r',
      invalidation: '',
      confidence: 'medium',
      readyToCompile: false,
      recommendedDurationDays: null,
    };
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      sessionDocs: {
        'sess-1': {
          userId: 'test-user',
          agentId: 'agent-1',
          status: 'active',
          messagesUsed: 3,
          messageBudget: 25,
          exchanges: [],
          latestThesis: previousThesis,
          seedContext: null,
        },
      },
    });
    activeFirestore = fixture.db;

    gemmaResult.current = { success: true, content: 'I have hit a snag.' };
    parseVoiceLayerResponseImpl.current = (c) => ({
      parseError: true,
      errorReason: 'plaintext_passthrough',
      rawText: c,
    });

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-1',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.errorReason).toBe('parse_plaintext_passthrough');
    expect(res.body.sessionId).toBe('sess-1');
    expect(res.body.agentMessage).toBe(
      'I hit a snag processing that — could you try that again?',
    );
    // Previous thesis preserved.
    expect(res.body.activeThesis).toEqual(previousThesis);
    expect(res.body.messagesUsed).toBe(3); // unchanged — failed turn didn't count
    // No update was written — failed turn is non-burning.
    expect(fixture.written.updateCalls).toHaveLength(0);
  });

  it('passes through normally when parser returns valid JSON', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs: {} });
    activeFirestore = fixture.db;

    // Default gemmaResult.current has valid JSON; parser default reads it.
    const { req, res } = makeReqRes({ agentId: 'agent-1', message: 'hi' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(res.body.agentMessage).toBe('hi');
    expect(res.body.activeThesis).toBeDefined();
  });
});
