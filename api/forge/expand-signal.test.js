// api/forge/expand-signal.test.js
//
// Sprint 6 Phase 3.6 PR 3 — handler-level coverage for the expand-signal
// endpoint. Closes Phase 3.5 Finding 6 (V1.1's expansion endpoint had no
// test file at all). Six tests targeting unique-to-expand-signal logic:
// happy path (cache write + dropRecord update + shadow log), cache hit
// (skip Gemma), recompute flag (bypass cache), Tier-4 wrong-shape → 502,
// hard rejection from validateExpansionOutput → 502, drop record missing → 404.
//
// Per Phase 3.6 PR 3 audit decision D3: validateExpansionOutput is mocked
// to give precise control over hardRejection / warning / clean branches
// without constructing branch-specific expansion shapes. Other pure
// helpers in injectionGuard (wrapWithDelimiters, detectInjectionAttempts)
// stay real via partial mock.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================

const {
  authReturnValue,
  gemmaResult,
  parseVoiceLayerResponseImpl,
  validateExpansionOutputImpl,
  shadowLogCalls,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gemmaResult: {
    current: {
      success: true,
      content: JSON.stringify({
        thesisSummary: 'Apple AI inference is a supply-chain story.',
        apparentDriver: 'Apple silicon ramp',
        relatedTickers: [
          { symbol: 'TSM', role: 'beneficiary' },
          { symbol: 'AVGO', role: 'beneficiary' },
        ],
        invalidationConditions: ['Apple slips silicon ramp'],
        suggestedWatchlistName: 'Apple AI Supply Chain',
        confidence: 'medium',
      }),
    },
  },
  parseVoiceLayerResponseImpl: { current: (c) => JSON.parse(c) },
  validateExpansionOutputImpl: {
    current: () => ({
      valid: true,
      hardRejection: false,
      reason: null,
      warning: null,
    }),
  },
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

vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildVoiceLayerPrompt: () => 'system-prompt-stub',
}));

vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async () => gemmaResult.current,
  parseVoiceLayerResponse: (c) => parseVoiceLayerResponseImpl.current(c),
}));

// Partial-mock injectionGuard: keep wrapWithDelimiters and
// detectInjectionAttempts real (used by signalDropPrompt's pure helpers),
// override validateExpansionOutput per-test.
vi.mock('../_utils/injectionGuard.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    validateExpansionOutput: (...args) =>
      validateExpansionOutputImpl.current(...args),
  };
});

vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms, _ms: ms }),
  },
}));

const { default: handler } = await import('./expand-signal.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({
  agent,
  drop,
  cache = {},
  marketContext = null,
  drb = null,
} = {}) {
  const state = {
    drop: drop ? { ...drop } : null,
    cache: { ...cache },
    dropUpdates: [],
  };

  const buildAgentRef = (id) => ({
    id,
    get: async () => ({ exists: !!agent, data: () => agent }),
  });

  const buildDropRef = () => ({
    get: async () => ({ exists: !!state.drop, data: () => state.drop }),
    update: async (updates) => {
      state.dropUpdates.push(updates);
      state.drop = { ...state.drop, ...updates };
    },
  });

  const buildUserDocRef = () => ({
    collection: (subName) => {
      if (subName === 'signalDrops') {
        return { doc: () => buildDropRef() };
      }
      throw new Error(`Unmocked sub-collection: users/${subName}`);
    },
  });

  const buildCacheRef = (key) => ({
    get: async () => ({
      exists: !!state.cache[key],
      data: () => state.cache[key],
    }),
    set: async (data) => {
      state.cache[key] = data;
    },
  });

  const buildIndexRef = (docName) => ({
    get: async () => {
      if (docName === 'marketContext') {
        return { exists: !!marketContext, data: () => marketContext };
      }
      if (docName === 'dailyRegimeBrief') {
        return { exists: !!drb, data: () => drb };
      }
      return { exists: false, data: () => null };
    },
  });

  const collection = (name) => {
    if (name === 'agents') {
      return { doc: (id) => buildAgentRef(id) };
    }
    if (name === 'users') {
      return { doc: () => buildUserDocRef() };
    }
    if (name === 'signalDropCache') {
      return { doc: (key) => buildCacheRef(key) };
    }
    if (name === 'indexIntelligence') {
      return { doc: (n) => buildIndexRef(n) };
    }
    throw new Error(`Unmocked collection: ${name}`);
  };

  return { db: { collection }, state };
}

// ==================== TEST HELPERS ====================

function makeReqRes(body, method = 'POST') {
  const req = { method, body };
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

const VALID_AGENT = {
  ownerId: 'test-user',
  name: 'Gemma',
  archetype: 'strategist',
};

const VALID_DROP_RECORD = {
  dropId: 'drop-1',
  userId: 'test-user',
  contentHash: 'hash-abc-123',
  parse: {
    extractedText: 'Apple is going hard on AI inference',
    topic: 'Apple AI inference push',
    tickers: ['AAPL'],
  },
};

const VALID_PARSED_SIGNAL = {
  extractedText: 'Apple is going hard on AI inference',
  topic: 'Apple AI inference push',
  tickers: ['AAPL'],
  impliedTickers: [],
  contentType: 'tweet',
  signalDirection: 'bullish',
  timeHorizon: 'positional',
  referencedDate: '',
  dataPoints: [],
  confidence: 0.85,
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  validateExpansionOutputImpl.current = () => ({
    valid: true,
    hardRejection: false,
    reason: null,
    warning: null,
  });
  gemmaResult.current = {
    success: true,
    content: JSON.stringify({
      thesisSummary: 'Apple AI inference is a supply-chain story.',
      apparentDriver: 'Apple silicon ramp',
      relatedTickers: [
        { symbol: 'TSM', role: 'beneficiary' },
        { symbol: 'AVGO', role: 'beneficiary' },
      ],
      invalidationConditions: ['Apple slips silicon ramp'],
      suggestedWatchlistName: 'Apple AI Supply Chain',
      confidence: 'medium',
    }),
  };
  shadowLogCalls.current = [];
  activeFirestore = null;
});

// ==================== TESTS ====================

describe('expand-signal — happy path', () => {
  it('returns expansion, writes cache, updates drop record, fires shadow log', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: VALID_DROP_RECORD,
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.expansion.thesisSummary).toBe(
      'Apple AI inference is a supply-chain story.',
    );
    expect(res.body.expansion.relatedTickers).toEqual([
      { symbol: 'TSM', role: 'beneficiary' },
      { symbol: 'AVGO', role: 'beneficiary' },
    ]);
    expect(res.body.validationWarning).toBeNull();

    // Cache row written keyed by `expand:{contentHash}:{day}`
    const cacheKeys = Object.keys(fixture.state.cache);
    expect(cacheKeys).toHaveLength(1);
    expect(cacheKeys[0]).toMatch(/^expand:hash-abc-123:\d{4}-\d{2}-\d{2}$/);

    // Drop record updated with expansion + expansionExpandedAt
    expect(fixture.state.dropUpdates).toHaveLength(1);
    expect(fixture.state.dropUpdates[0].expansion).toBeDefined();
    expect(typeof fixture.state.dropUpdates[0].expansionExpandedAt).toBe(
      'string',
    );

    // Shadow log fired
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].stage).toBe('expand');
    expect(shadowLogCalls.current[0].cacheHit).toBe(false);
    expect(shadowLogCalls.current[0].contentHash).toBe('hash-abc-123');
  });
});

describe('expand-signal — cache behavior', () => {
  it('returns cached expansion when cache hit, skipping Gemma', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `expand:hash-abc-123:${today}`;
    const cachedExpansion = {
      thesisSummary: 'Cached thesis',
      apparentDriver: 'cached driver',
      relatedTickers: [{ symbol: 'NVDA', role: 'anchor' }],
      invalidationConditions: [],
      suggestedWatchlistName: 'Cached',
      confidence: 'high',
    };
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: VALID_DROP_RECORD,
      cache: {
        [cacheKey]: {
          cacheKey,
          contentHash: 'hash-abc-123',
          marketContextDay: today,
          expansion: cachedExpansion,
          validationWarning: null,
          createdAt: { _ms: Date.now() },
          // Cache row hasn't expired
          expiresAt: { toMillis: () => Date.now() + 60_000 },
        },
      },
    });
    activeFirestore = fixture.db;
    // If Gemma is called, fail loudly
    gemmaResult.current = null;

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.expansion).toEqual(cachedExpansion);
    // Drop record still updated on cache hit (per handler line 249-252)
    expect(fixture.state.dropUpdates).toHaveLength(1);
    expect(fixture.state.dropUpdates[0].expansion).toEqual(cachedExpansion);
    // Shadow log captures cacheHit=true
    expect(shadowLogCalls.current[0].cacheHit).toBe(true);
  });

  it('bypasses cache when isRecompute=true', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `expand:hash-abc-123:${today}`;
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: VALID_DROP_RECORD,
      cache: {
        [cacheKey]: {
          cacheKey,
          contentHash: 'hash-abc-123',
          marketContextDay: today,
          expansion: { thesisSummary: 'STALE' },
          validationWarning: null,
          createdAt: { _ms: Date.now() },
          expiresAt: { toMillis: () => Date.now() + 60_000 },
        },
      },
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
      isRecompute: true,
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.cached).toBe(false);
    // The new expansion was computed fresh (not the STALE cache value)
    expect(res.body.expansion.thesisSummary).toBe(
      'Apple AI inference is a supply-chain story.',
    );
    expect(shadowLogCalls.current[0].isRecompute).toBe(true);
  });
});

describe('expand-signal — schema validation', () => {
  it('returns 502 when Gemma returns a wrong-shape response (Tier-4)', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: VALID_DROP_RECORD,
    });
    activeFirestore = fixture.db;

    // parseVoiceLayerResponse returns a parseError shape (no thesisSummary,
    // no relatedTickers) — handler's isExpansionShape check fails.
    parseVoiceLayerResponseImpl.current = () => ({
      parseError: true,
      errorReason: 'plaintext_passthrough',
      rawText: 'I have hit a snag.',
    });

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/schema check/);
    // No cache write, no drop record update on schema-failure 502
    expect(Object.keys(fixture.state.cache)).toHaveLength(0);
    expect(fixture.state.dropUpdates).toHaveLength(0);
  });

  it('returns 502 when validateExpansionOutput hard-rejects', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: VALID_DROP_RECORD,
    });
    activeFirestore = fixture.db;
    // Validator hard-rejects (e.g., expansion contains tickers that don't
    // appear in parsedSignal — congruity failure).
    validateExpansionOutputImpl.current = () => ({
      valid: false,
      hardRejection: true,
      reason: 'expansion_contains_invented_tickers',
      warning: null,
    });

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/congruity check/);
    expect(res.body.reason).toBe('expansion_contains_invented_tickers');
    // No cache write, no drop record update on hard rejection
    expect(Object.keys(fixture.state.cache)).toHaveLength(0);
    expect(fixture.state.dropUpdates).toHaveLength(0);
  });
});

describe('expand-signal — lookup failures', () => {
  it('returns 404 when the drop record does not exist', async () => {
    const fixture = makeFakeFirestore({
      agent: VALID_AGENT,
      drop: null, // no drop record
    });
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-missing',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Drop record not found/);
  });
});

// ==========================================================================
// SIBLING TIMEOUT-CLASS ROW — Sep 3 2026 voice-timeout incident.
//
// gemmaClient now reports an abort that fires DURING THE BODY READ as
// `aborted: true`. It previously came back as a generic failure with
// `aborted` undefined, so this handler answered its non-abort status on a turn
// that had actually timed out. This row pins that the new class is handled and
// does not crash the handler. The classification itself is guarded at source in
// api/_utils/gemmaClient.test.js.
// ==========================================================================

describe('expand-signal — gemmaClient timeout class (aborted:true)', () => {
  it('an aborted Gemma call returns 504, not 502', async () => {
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, drop: VALID_DROP_RECORD });
    activeFirestore = fixture.db;
    gemmaResult.current = { success: false, error: 'Request aborted', aborted: true, fallbackResponse: null };

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL,
      dropId: 'drop-1',
      agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe('Expansion timed out');
  });

  it('a NON-aborted Gemma failure still returns 502 (no over-classification)', async () => {
    // Companion to the row above — pins the fallback arm of
    // `gemmaResult.aborted ? 504 : 502` so a plain failure cannot drift into
    // being reported as a timeout.
    const fixture = makeFakeFirestore({ agent: VALID_AGENT, drop: VALID_DROP_RECORD });
    activeFirestore = fixture.db;
    gemmaResult.current = { success: false, error: 'OpenRouter 500: upstream', aborted: false, fallbackResponse: null };

    const { req, res } = makeReqRes({
      parsedSignal: VALID_PARSED_SIGNAL, dropId: 'drop-1', agentId: 'agent-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('Expansion failed');
  });
});
