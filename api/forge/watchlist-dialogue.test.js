// api/forge/watchlist-dialogue.test.js
//
// Sprint 6 Phase 2 — coverage for the watchlist dialogue endpoint.
//
// Split (per Phase 2A audit decision): pure-function tests for the
// exported validators / normalizers (most of the coverage), plus a
// handful of handler-level lifecycle tests using mocked Firestore +
// Gemma to exercise the full first-turn / subsequent-turn / budget /
// structured-error paths.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================
//
// vi.mock() factories are hoisted above all imports. We put mutable
// state inside vi.hoisted() so individual tests can swap behaviour
// without re-mounting the module.
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
        '{"agentMessage":"hi","proposedPhase":"explore","candidateTickerUpdates":[],"suggestedActions":[],"readyToFinalize":false}',
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
  logSignalDrops: async (record) => {
    shadowLogCalls.current.push(record);
  },
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
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

const {
  default: handler,
  validateParseResult,
  applyCandidateTickerUpdates,
  validatePhaseTransition,
  normalizeDialogueOutput,
} = await import('./watchlist-dialogue.js');

// ==================== TEST FIXTURES ====================

const VALID_PARSE_RESULT = {
  contentHash: 'abc123',
  parse: {
    extractedText: 'Apple is going hard on AI inference',
    topic: 'Apple AI inference push',
    tickers: ['AAPL'],
    impliedTickers: [],
    confidence: 0.85,
    contentType: 'tweet',
    signalDirection: 'bullish',
    timeHorizon: 'positional',
    referencedDate: '',
    dataPoints: [],
  },
  validation: { validated: [{ symbol: 'AAPL', sectorId: 'tech' }], unsupported: [] },
  shouldBailout: false,
  shouldHardCheckpoint: false,
};

const HAPPY_GEMMA_REPLY = {
  agentMessage: 'OK so what angle is grabbing you here — chip side or platform side?',
  proposedPhase: 'explore',
  candidateTickerUpdates: [],
  suggestedActions: ['Chip side', 'Platform side'],
  readyToFinalize: false,
};

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ agent, sessionDocs = {}, allocatedSessionId = 'new-session-123' }) {
  const written = { setCalls: [], updateCalls: [], allocatedSessionId };

  const buildSessionRef = (id) => {
    const stored = sessionDocs[id];
    return {
      id,
      get: async () => ({
        exists: !!stored,
        data: () => stored,
      }),
      set: async (data) => {
        written.setCalls.push({ id, data });
        sessionDocs[id] = data;
      },
      update: async (updates) => {
        written.updateCalls.push({ id, updates });
        sessionDocs[id] = { ...sessionDocs[id], ...updates };
      },
    };
  };

  const collection = (name) => {
    if (name === 'agents') {
      return {
        doc: (id) => ({
          id,
          get: async () => ({
            exists: !!agent,
            data: () => agent,
          }),
        }),
      };
    }
    if (name === 'watchlistSessions') {
      return {
        doc: (id) => buildSessionRef(id || written.allocatedSessionId),
      };
    }
    if (name === 'indexIntelligence') {
      // DRB lookup — return non-existent so anchorContext stays null.
      return {
        doc: () => ({
          get: async () => ({ exists: false, data: () => null }),
        }),
      };
    }
    throw new Error(`Unmocked collection: ${name}`);
  };

  return { db: { collection }, written, sessionDocs };
}

function makeReqRes(body) {
  const req = { method: 'POST', body };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return { req, res };
}

const VALID_AGENT = { ownerId: 'test-user', name: 'Gemma', archetype: 'strategist' };

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  gemmaResult.current = {
    success: true,
    content: JSON.stringify(HAPPY_GEMMA_REPLY),
  };
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ==================== validateParseResult ====================

describe('validateParseResult', () => {
  it('accepts the verbatim parse-signal response shape', () => {
    const out = validateParseResult(VALID_PARSE_RESULT);
    expect(out).not.toBeNull();
    expect(out.contentHash).toBe('abc123');
    expect(out.parse.extractedText).toBe('Apple is going hard on AI inference');
    expect(out.shouldBailout).toBe(false);
  });

  it('rejects null / non-object inputs', () => {
    expect(validateParseResult(null)).toBeNull();
    expect(validateParseResult('a string')).toBeNull();
    expect(validateParseResult([])).toBeNull();
  });

  it('rejects when parse object is missing', () => {
    expect(validateParseResult({ contentHash: 'x' })).toBeNull();
    expect(validateParseResult({ parse: 'not-an-object' })).toBeNull();
  });

  it('rejects when extractedText is missing or empty', () => {
    expect(validateParseResult({ parse: {} })).toBeNull();
    expect(validateParseResult({ parse: { extractedText: '' } })).toBeNull();
    expect(validateParseResult({ parse: { extractedText: '   ' } })).toBeNull();
  });

  it('coerces booleans and drops malformed validation envelope', () => {
    const out = validateParseResult({
      parse: { extractedText: 'x' },
      shouldBailout: 1,
      shouldHardCheckpoint: 'truthy',
      validation: 'not-an-object',
    });
    expect(out.shouldBailout).toBe(true);
    expect(out.shouldHardCheckpoint).toBe(true);
    expect(out.validation).toBeNull();
  });
});

// ==================== validatePhaseTransition ====================

describe('validatePhaseTransition', () => {
  it('honors a single forward step', () => {
    expect(validatePhaseTransition('explore', 'propose', null)).toEqual({
      newPhase: 'propose',
      didAdvance: true,
      didReject: false,
    });
  });

  it('rejects a backward jump and preserves the current phase', () => {
    const out = validatePhaseTransition('refine', 'explore', null);
    expect(out.newPhase).toBe('refine');
    expect(out.didReject).toBe(true);
    expect(out.didAdvance).toBe(false);
  });

  it('rejects an invalid proposedPhase value', () => {
    expect(validatePhaseTransition('explore', null, null).didReject).toBe(true);
    expect(validatePhaseTransition('explore', 'completed', null).didReject).toBe(true);
    expect(validatePhaseTransition('explore', 'garbage', null).didReject).toBe(true);
  });

  it('clamps a skip-ahead jump to one step forward', () => {
    const out = validatePhaseTransition('explore', 'finalize', null);
    expect(out.newPhase).toBe('propose');
    expect(out.didAdvance).toBe(true);
    expect(out.didReject).toBe(false);
  });

  it('honors phaseRequest=advance with a successor available', () => {
    const out = validatePhaseTransition('propose', 'propose', 'advance');
    expect(out.newPhase).toBe('refine');
    expect(out.didAdvance).toBe(true);
    expect(out.didReject).toBe(false);
  });

  it('phaseRequest=advance is a no-op at finalize (no successor)', () => {
    const out = validatePhaseTransition('finalize', 'finalize', 'advance');
    expect(out.newPhase).toBe('finalize');
    expect(out.didAdvance).toBe(false);
  });

  it('staying in the same phase is honored without didAdvance', () => {
    const out = validatePhaseTransition('explore', 'explore', null);
    expect(out.newPhase).toBe('explore');
    expect(out.didAdvance).toBe(false);
    expect(out.didReject).toBe(false);
  });

  it('treats an unknown current phase as explore baseline', () => {
    const out = validatePhaseTransition('garbage', 'propose', null);
    expect(out.newPhase).toBe('propose');
    expect(out.didReject).toBe(false);
  });
});

// ==================== applyCandidateTickerUpdates ====================

describe('applyCandidateTickerUpdates', () => {
  const NOW = '2026-05-07T12:00:00.000Z';

  it('adds a new proposed ticker with phase tag and timestamp', () => {
    const out = applyCandidateTickerUpdates(
      [],
      [{ action: 'propose', symbol: 'AAPL', reasoning: 'direct play', category: 'core' }],
      'propose',
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      symbol: 'AAPL',
      reasoning: 'direct play',
      category: 'core',
      status: 'proposed',
      proposedAtPhase: 'propose',
      proposedAt: NOW,
    });
  });

  it('treats a propose duplicate as a no-op (case-insensitive)', () => {
    const existing = [
      { symbol: 'AAPL', status: 'proposed', reasoning: 'old', category: 'core' },
    ];
    const out = applyCandidateTickerUpdates(
      existing,
      [{ action: 'propose', symbol: 'aapl', reasoning: 'NEW reasoning', category: 'redo' }],
      'propose',
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].reasoning).toBe('old');
  });

  it('keep updates status and optionally refreshes reasoning', () => {
    const existing = [{ symbol: 'AAPL', status: 'proposed', reasoning: 'old' }];
    const out = applyCandidateTickerUpdates(
      existing,
      [{ action: 'keep', symbol: 'AAPL', reasoning: 'user defended this' }],
      'refine',
      NOW,
    );
    expect(out[0].status).toBe('kept');
    expect(out[0].reasoning).toBe('user defended this');
  });

  it('remove updates status to removed', () => {
    const existing = [{ symbol: 'AAPL', status: 'proposed', reasoning: 'r' }];
    const out = applyCandidateTickerUpdates(
      existing,
      [{ action: 'remove', symbol: 'AAPL' }],
      'refine',
      NOW,
    );
    expect(out[0].status).toBe('removed');
  });

  it('reorder bumps proposedAt timestamp', () => {
    const existing = [
      { symbol: 'AAPL', status: 'proposed', proposedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const out = applyCandidateTickerUpdates(
      existing,
      [{ action: 'reorder', symbol: 'AAPL' }],
      'refine',
      NOW,
    );
    expect(out[0].proposedAt).toBe(NOW);
  });

  it('silently filters propose actions for invalid tickers (not in universe)', () => {
    const out = applyCandidateTickerUpdates(
      [],
      [
        { action: 'propose', symbol: 'AAPL', reasoning: 'x', category: 'y' },
        { action: 'propose', symbol: 'NOTAREALTICKER', reasoning: 'x', category: 'y' },
      ],
      'propose',
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe('AAPL');
  });

  it('silently skips keep/remove for unknown symbols', () => {
    const existing = [{ symbol: 'AAPL', status: 'proposed' }];
    const out = applyCandidateTickerUpdates(
      existing,
      [
        { action: 'remove', symbol: 'NVDA' },
        { action: 'keep', symbol: 'TSLA' },
      ],
      'refine',
      NOW,
    );
    expect(out).toEqual(existing);
  });

  it('silently skips updates with an unknown action', () => {
    const out = applyCandidateTickerUpdates(
      [],
      [{ action: 'lol', symbol: 'AAPL' }],
      'explore',
      NOW,
    );
    expect(out).toHaveLength(0);
  });

  it('returns a copy when updates is empty / non-array', () => {
    const existing = [{ symbol: 'AAPL', status: 'proposed' }];
    expect(applyCandidateTickerUpdates(existing, [], 'explore', NOW)).toEqual(existing);
    expect(applyCandidateTickerUpdates(existing, null, 'explore', NOW)).toEqual(existing);
    // and proves it's a copy
    const copy = applyCandidateTickerUpdates(existing, [], 'explore', NOW);
    expect(copy).not.toBe(existing);
  });

  it('clamps reasoning and category lengths defensively', () => {
    const longReasoning = 'r'.repeat(800);
    const longCategory = 'c'.repeat(80);
    const out = applyCandidateTickerUpdates(
      [],
      [
        {
          action: 'propose',
          symbol: 'AAPL',
          reasoning: longReasoning,
          category: longCategory,
        },
      ],
      'propose',
      NOW,
    );
    expect(out[0].reasoning).toHaveLength(500);
    expect(out[0].category).toHaveLength(30);
  });
});

// ==================== normalizeDialogueOutput ====================

describe('normalizeDialogueOutput', () => {
  it('passes through a fully-shaped object', () => {
    const out = normalizeDialogueOutput({
      agentMessage: 'hello',
      proposedPhase: 'propose',
      candidateTickerUpdates: [{ action: 'propose', symbol: 'AAPL' }],
      suggestedActions: ['a', 'b'],
      readyToFinalize: true,
    });
    expect(out.agentMessage).toBe('hello');
    expect(out.proposedPhase).toBe('propose');
    expect(out.candidateTickerUpdates).toHaveLength(1);
    expect(out.suggestedActions).toEqual(['a', 'b']);
    expect(out.readyToFinalize).toBe(true);
  });

  it('returns safe defaults for null / non-object input', () => {
    const def = normalizeDialogueOutput(null);
    expect(def).toEqual({
      agentMessage: '',
      proposedPhase: null,
      candidateTickerUpdates: [],
      suggestedActions: [],
      readyToFinalize: false,
    });
    expect(normalizeDialogueOutput('string').agentMessage).toBe('');
    expect(normalizeDialogueOutput([]).candidateTickerUpdates).toEqual([]);
  });

  it('drops invalid proposedPhase values', () => {
    expect(normalizeDialogueOutput({ proposedPhase: 'completed' }).proposedPhase).toBeNull();
    expect(normalizeDialogueOutput({ proposedPhase: 'garbage' }).proposedPhase).toBeNull();
    expect(normalizeDialogueOutput({}).proposedPhase).toBeNull();
  });

  it('clamps suggestedActions to 3 items and 60 chars each', () => {
    const out = normalizeDialogueOutput({
      suggestedActions: ['one', 'two', 'three', 'four', 'a'.repeat(120)],
    });
    expect(out.suggestedActions).toHaveLength(3);
    expect(out.suggestedActions[0]).toBe('one');
  });

  it('clamps agentMessage to 2000 chars', () => {
    const out = normalizeDialogueOutput({ agentMessage: 'x'.repeat(5000) });
    expect(out.agentMessage).toHaveLength(2000);
  });

  it('coerces readyToFinalize to a boolean', () => {
    expect(normalizeDialogueOutput({ readyToFinalize: 'truthy' }).readyToFinalize).toBe(true);
    expect(normalizeDialogueOutput({ readyToFinalize: 0 }).readyToFinalize).toBe(false);
    expect(normalizeDialogueOutput({}).readyToFinalize).toBe(false);
  });

  it('caps candidateTickerUpdates at 8 entries', () => {
    const updates = Array.from({ length: 12 }, (_, i) => ({
      action: 'propose',
      symbol: `T${i}`,
    }));
    const out = normalizeDialogueOutput({ candidateTickerUpdates: updates });
    expect(out.candidateTickerUpdates).toHaveLength(8);
  });
});

// ==================== HANDLER: first-turn happy path ====================

describe('handler — first-turn happy path', () => {
  it('creates a session, persists parseResult, returns sessionId + state', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs: {} });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      message: 'I think this Apple AI thing is huge',
      parseResult: VALID_PARSE_RESULT,
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('new-session-123');
    expect(res.body.phase).toBe('explore');
    expect(res.body.messagesUsed).toBe(1);
    expect(res.body.messageBudget).toBe(20);
    expect(res.body.candidateTickers).toEqual([]);
    expect(res.body.agentMessage).toMatch(/angle/i);

    const setCall = fixture.written.setCalls[0];
    expect(setCall).toBeDefined();
    expect(setCall.data.userId).toBe('test-user');
    expect(setCall.data.parseResult.contentHash).toBe('abc123');
    expect(setCall.data.exchanges).toHaveLength(2);
    expect(setCall.data.exchanges[0].role).toBe('user');
    expect(setCall.data.exchanges[1].role).toBe('agent');
    expect(setCall.data.meta.initialAgentName).toBe('Gemma');

    const log = shadowLogCalls.current.find((r) => r.stage === 'dialogue');
    expect(log).toBeDefined();
    expect(log.sessionId).toBe('new-session-123');
    expect(log.previousPhase).toBe('explore');
  });

  it('rejects malformed parseResult on first turn (400)', async () => {
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT }).db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      message: 'hi',
      parseResult: { not: 'valid' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/malformed/);
  });

  it('rejects when neither parseResult nor sessionId is present (400)', async () => {
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT }).db;
    const { req, res } = makeReqRes({ agentId: 'agent-1', message: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/parseResult is required/);
  });
});

// ==================== HANDLER: subsequent-turn happy path ====================

describe('handler — subsequent-turn happy path', () => {
  it('loads session, advances phase, increments messagesUsed', async () => {
    const sessionDocs = {
      'sess-1': {
        userId: 'test-user',
        agentId: 'agent-1',
        startedAt: '2026-05-07T11:00:00.000Z',
        updatedAt: '2026-05-07T11:00:00.000Z',
        status: 'active',
        phase: 'explore',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [
          { role: 'user', content: 'first', phase: 'explore', timestamp: 't1' },
          { role: 'agent', content: 'reply', phase: 'explore', timestamp: 't2' },
        ],
        candidateTickers: [],
        messagesUsed: 1,
        messageBudget: 20,
        dropListId: null,
        meta: { initialAgentName: 'Gemma' },
      },
    };
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: true,
      content: JSON.stringify({
        agentMessage: 'OK here are some candidates',
        proposedPhase: 'propose',
        candidateTickerUpdates: [
          { action: 'propose', symbol: 'AAPL', reasoning: 'direct', category: 'core' },
        ],
        suggestedActions: ['More'],
        readyToFinalize: false,
      }),
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-1',
      message: 'show me names',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.phase).toBe('propose');
    expect(res.body.candidateTickers).toEqual([
      { symbol: 'AAPL', reasoning: 'direct', category: 'core', status: 'proposed' },
    ]);

    const updateCall = fixture.written.updateCalls[0];
    expect(updateCall).toBeDefined();
    expect(updateCall.updates.phase).toBe('propose');
    expect(updateCall.updates.messagesUsed).toEqual({ __op: 'increment', n: 1 });
    expect(updateCall.updates.exchanges.__op).toBe('arrayUnion');
    expect(updateCall.updates.exchanges.items).toHaveLength(2);
    expect(updateCall.updates.candidateTickers).toHaveLength(1);
  });
});

// ==================== HANDLER: budget exceeded ====================

describe('handler — budget enforcement', () => {
  it('returns 403 when messagesUsed has reached the budget', async () => {
    const sessionDocs = {
      'sess-full': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'active',
        phase: 'refine',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 20,
        messageBudget: 20,
      },
    };
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs }).db;

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-full',
      message: 'one more',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('budget_exceeded');
    expect(res.body.messageBudget).toBe(20);
  });
});

// ==================== HANDLER: session not found / inactive ====================

describe('handler — session lifecycle errors', () => {
  it('returns 404 for an unknown sessionId', async () => {
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs: {} }).db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'never-existed',
      message: 'hi',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 (not 410, per Q3 override) for a closed session', async () => {
    const sessionDocs = {
      'sess-closed': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'completed',
        phase: 'finalize',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 5,
        messageBudget: 20,
      },
    };
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs }).db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-closed',
      message: 'hi',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('session_not_active');
  });

  it('returns 401 when auth fails', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT }).db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      message: 'hi',
      parseResult: VALID_PARSE_RESULT,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when the agent is owned by another user', async () => {
    activeFirestore = makeFakeFirestore({
      agent: { ...VALID_AGENT, ownerId: 'other-user' },
    }).db;
    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      message: 'hi',
      parseResult: VALID_PARSE_RESULT,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });
});

// ==================== HANDLER: phase advancement edge cases ====================

describe('handler — phase advancement', () => {
  function makeActiveSession(phase, extras = {}) {
    return {
      'sess-x': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'active',
        phase,
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 1,
        messageBudget: 20,
        ...extras,
      },
    };
  }

  it('preserves the previous phase when Gemma proposes a backward jump', async () => {
    const sessionDocs = makeActiveSession('refine');
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: true,
      content: JSON.stringify({
        agentMessage: 'going back',
        proposedPhase: 'explore', // backward — must be rejected
        candidateTickerUpdates: [],
        suggestedActions: [],
        readyToFinalize: false,
      }),
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-x',
      message: 'go back',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.phase).toBe('refine');
    const update = fixture.written.updateCalls[0];
    expect(update.updates.phase).toBe('refine');

    const log = shadowLogCalls.current.find((r) => r.stage === 'dialogue');
    expect(log.phaseRejected).toBe(true);
  });

  it('honors phaseRequest=advance even when Gemma stays', async () => {
    const sessionDocs = makeActiveSession('explore');
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: true,
      content: JSON.stringify({
        agentMessage: 'staying',
        proposedPhase: 'explore',
        candidateTickerUpdates: [],
        suggestedActions: [],
        readyToFinalize: false,
      }),
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-x',
      message: 'show me',
      phaseRequest: 'advance',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.phase).toBe('propose');
  });
});

// ==================== HANDLER: structured-error path ====================

describe('handler — structured-error path', () => {
  it('returns 200 with error:true and preserved state when Gemma fails on a continuing turn', async () => {
    const sessionDocs = {
      'sess-x': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'active',
        phase: 'propose',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [{ symbol: 'AAPL', status: 'proposed', reasoning: 'r', category: 'c' }],
        messagesUsed: 5,
        messageBudget: 20,
      },
    };
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: false,
      error: 'OpenRouter 502: gateway down',
      fallbackResponse: null,
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-x',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.errorReason).toBe('gemma_invalid_shape');
    expect(res.body.phase).toBe('propose');
    expect(res.body.messagesUsed).toBe(5);
    expect(res.body.candidateTickers).toHaveLength(1);
    expect(res.body.suggestedActions).toEqual(['retry']);

    // No write should have occurred — failed turn doesn't burn budget.
    expect(fixture.written.updateCalls).toHaveLength(0);
  });

  it('returns 504 when Gemma aborts (timeout) on a continuing turn', async () => {
    const sessionDocs = {
      'sess-x': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'active',
        phase: 'explore',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 1,
        messageBudget: 20,
      },
    };
    activeFirestore = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs }).db;
    gemmaResult.current = { success: false, error: 'aborted', aborted: true };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-x',
      message: 'hi',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe(true);
    expect(res.body.errorReason).toBe('gemma_timeout');
  });
});

// ==================== HANDLER: ticker validation defense ====================

describe('handler — ticker validation', () => {
  it('silently filters proposed tickers that fail validation', async () => {
    const sessionDocs = {
      'sess-x': {
        userId: 'test-user',
        agentId: 'agent-1',
        status: 'active',
        phase: 'propose',
        parseResult: VALID_PARSE_RESULT,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 1,
        messageBudget: 20,
      },
    };
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, sessionDocs });
    activeFirestore = fixture.db;

    gemmaResult.current = {
      success: true,
      content: JSON.stringify({
        agentMessage: 'a batch',
        proposedPhase: 'propose',
        candidateTickerUpdates: [
          { action: 'propose', symbol: 'AAPL', reasoning: 'r', category: 'c' },
          { action: 'propose', symbol: 'NOTAREALTICKER', reasoning: 'r', category: 'c' },
        ],
        suggestedActions: [],
        readyToFinalize: false,
      }),
    };

    const { req, res } = makeReqRes({
      agentId: 'agent-1',
      sessionId: 'sess-x',
      message: 'go',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.candidateTickers).toHaveLength(1);
    expect(res.body.candidateTickers[0].symbol).toBe('AAPL');
  });
});
