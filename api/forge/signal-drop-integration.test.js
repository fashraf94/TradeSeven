// api/forge/signal-drop-integration.test.js
//
// Cross-endpoint integration test for the Signal Drop V2 first-turn
// handoff. Production smoke-test surfaced a P0: parse-signal's HTTP
// response shape diverged from what watchlist-dialogue's first-turn
// verifier expected (parseResult.contentHash was missing in the
// response, so the equality check at watchlist-dialogue.js:673-680
// always failed with parse_result_mismatch).
//
// Pure-function tests in watchlist-dialogue.test.js never caught it
// because they hand-fabricated parseResult fixtures with contentHash
// set. This integration test pipes parse-signal's actual handler
// output verbatim into watchlist-dialogue's first-turn handler — the
// same wire shape the FE sends — and asserts the contract holds.
//
// The single critical assertion is: NO parse_result_mismatch error.
// If parse-signal stops echoing contentHash (the original bug) or
// starts computing it differently (a future regression), this test
// fails. The other assertions are positive sanity checks on the
// happy-path response shape.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================

const {
  authReturnValue,
  haikuResult,
  gemmaResult,
  parseVoiceLayerResponseImpl,
} = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  haikuResult: { current: null },
  gemmaResult: { current: null },
  parseVoiceLayerResponseImpl: { current: (c) => JSON.parse(c) },
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
  logSignalDrops: async () => {},
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => p,
}));

// Anthropic constructor + messages.create. parse-signal does
// `new Anthropic({...})` and reads `client.messages.create`.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = { create: async () => haikuResult.current };
    }
  },
}));

vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async () => gemmaResult.current,
  parseVoiceLayerResponse: (c) => parseVoiceLayerResponseImpl.current(c),
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms, _ms: ms }),
  },
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

const { default: parseSignalHandler } = await import('./parse-signal.js');
const { default: watchlistDialogueHandler } = await import('./watchlist-dialogue.js');

// ==================== UNIFIED FIRESTORE MOCK ====================
//
// One mock backs both handlers. Crucial property: writes from
// parse-signal's signalDrops .set() must be visible to watchlist-dialogue's
// signalDrops .get() when invoked back-to-back. This is the seam where
// the production bug surfaces, so the mock has to faithfully share state.

function makeIntegrationFirestore({ agent }) {
  const state = {
    signalDropCache: {},                  // contentHash → cache doc
    signalDrops: {},                      // `${uid}/${dropId}` → drop record
    sessionDocs: {},                      // sessionId → session doc
    allocatedSessionId: 'integration-session-123',
  };

  const buildSessionRef = (id) => ({
    id,
    get: async () => ({
      exists: !!state.sessionDocs[id],
      data: () => state.sessionDocs[id],
    }),
    set: async (data) => {
      state.sessionDocs[id] = data;
    },
    update: async (updates) => {
      state.sessionDocs[id] = { ...state.sessionDocs[id], ...updates };
    },
  });

  const buildSignalDropRef = (uid, dropId) => {
    const key = `${uid}/${dropId}`;
    return {
      get: async () => ({
        exists: !!state.signalDrops[key],
        data: () => state.signalDrops[key],
      }),
      set: async (data) => {
        state.signalDrops[key] = data;
      },
    };
  };

  const buildUserDocRef = (uid) => ({
    collection: (subName) => {
      if (subName === 'signalDrops') {
        return { doc: (dropId) => buildSignalDropRef(uid, dropId) };
      }
      throw new Error(`Unmocked sub-collection: users/${uid}/${subName}`);
    },
  });

  const buildCacheRef = (contentHash) => ({
    get: async () => ({
      exists: !!state.signalDropCache[contentHash],
      data: () => state.signalDropCache[contentHash],
    }),
    set: async (data) => {
      state.signalDropCache[contentHash] = data;
    },
  });

  const collection = (name) => {
    if (name === 'signalDropCache') {
      return { doc: (h) => buildCacheRef(h) };
    }
    if (name === 'agents') {
      return {
        doc: () => ({
          get: async () => ({ exists: !!agent, data: () => agent }),
        }),
      };
    }
    if (name === 'watchlistSessions') {
      return {
        doc: (id) => buildSessionRef(id || state.allocatedSessionId),
      };
    }
    if (name === 'users') {
      return { doc: (uid) => buildUserDocRef(uid) };
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

  const runTransaction = async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      update: async (ref, updates) => {
        state.sessionDocs[ref.id] = { ...state.sessionDocs[ref.id], ...updates };
      },
    };
    return fn(tx);
  };

  return { db: { collection, runTransaction }, state };
}

// ==================== TEST HELPERS ====================

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

const HAIKU_TOOL_USE = {
  content: [
    {
      type: 'tool_use',
      input: {
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
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50 },
};

const HAPPY_GEMMA_REPLY = {
  agentMessage: 'OK so what angle is grabbing you here — chip side or platform side?',
  proposedPhase: 'explore',
  candidateTickerUpdates: [],
  suggestedActions: ['Chip side', 'Platform side'],
  readyToFinalize: false,
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  haikuResult.current = HAIKU_TOOL_USE;
  gemmaResult.current = {
    success: true,
    content: JSON.stringify(HAPPY_GEMMA_REPLY),
  };
  parseVoiceLayerResponseImpl.current = (c) => JSON.parse(c);
  activeFirestore = null;
});

// ==================== INTEGRATION TEST ====================

describe('Signal Drop integration: parse-signal → watchlist-dialogue first turn', () => {
  it('pipes parse-signal response verbatim into watchlist-dialogue without parse_result_mismatch', async () => {
    const fixture = makeIntegrationFirestore({ agent: VALID_AGENT });
    activeFirestore = fixture.db;

    // ── Step 1: Call parse-signal exactly as the FE does in production.
    const dropId = 'drop-integration-test-abc';
    const { req: parseReq, res: parseRes } = makeReqRes({
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId,
    });

    await parseSignalHandler(parseReq, parseRes);

    expect(parseRes.statusCode).toBe(200);
    expect(parseRes.body.dropId).toBe(dropId);
    // Regression guard: contentHash MUST be present in the response.
    // This is the field whose absence caused the production P0.
    expect(typeof parseRes.body.contentHash).toBe('string');
    expect(parseRes.body.contentHash.length).toBeGreaterThan(0);

    // Sanity: the persisted drop record contains the same contentHash
    // we're about to echo back through watchlist-dialogue.
    const persistedKey = `test-user/${dropId}`;
    const persistedDrop = fixture.state.signalDrops[persistedKey];
    expect(persistedDrop).toBeDefined();
    expect(persistedDrop.contentHash).toBe(parseRes.body.contentHash);

    // ── Step 2: Pipe the response VERBATIM as parseResult into
    // watchlist-dialogue's first-turn handler. Production FE does
    // exactly this (SignalDropEntry → DiscoverPanel → WatchlistChat,
    // no transformation).
    const parseResultFromHandler = parseRes.body;

    const { req: dlgReq, res: dlgRes } = makeReqRes({
      agentId: 'agent-1',
      message: 'I think this Apple AI thing is huge',
      parseResult: parseResultFromHandler,
      dropId,
    });

    await watchlistDialogueHandler(dlgReq, dlgRes);

    // ── Primary assertion: NO parse_result_mismatch.
    // This is the exact failure mode the production smoke test hit.
    // Without contentHash in parse-signal's response, this assertion
    // fails (validatedParseResult.contentHash === null !==
    // dropRecord.contentHash).
    expect(dlgRes.body?.error).not.toBe('parse_result_mismatch');

    // ── Stronger positive assertions: the happy-path contract holds.
    expect(dlgRes.statusCode).toBe(200);
    expect(dlgRes.body.sessionId).toBeTruthy();
    expect(dlgRes.body.phase).toBe('explore');
    expect(dlgRes.body.messagesUsed).toBe(1);
    expect(dlgRes.body.agentMessage).toMatch(/angle/i);

    // ── Persisted session captured the same contentHash end-to-end.
    const persistedSession = Object.values(fixture.state.sessionDocs)[0];
    expect(persistedSession).toBeDefined();
    expect(persistedSession.parseResult.contentHash).toBe(parseRes.body.contentHash);
  });
});
