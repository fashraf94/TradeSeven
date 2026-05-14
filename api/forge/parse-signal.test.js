// api/forge/parse-signal.test.js
//
// Sprint 6 Phase 3.6 PR 3 — handler-level coverage for the parse-signal
// endpoint. Closes Phase 3.5 Finding 6: parse-signal previously had no
// standalone tests; the only coverage was the integration test added for
// the P0 fix. This file exercises the full handler surface — bailout
// classification, cache hit, URL fetch failure modes, image-mode
// validation, body validation 400s, contentHash regression guard, shadow
// log shape.
//
// Mock minimization: keep pure helpers (buildParsePromptInputs,
// validateTickers, hashText/hashUrl/hashImage, detectInjectionAttempts,
// sanitizeParsedOutput) REAL — they're deterministic and tightening their
// coverage is a free side-benefit. Mock only what's expensive or
// non-deterministic (Anthropic SDK, Firestore, fetch, shadow logger).
//
// URL fetch timeout coverage is intentionally deferred per Phase 3.6 PR 3
// audit Finding B — testing the real 3000ms AbortController would either
// require waiting that long or refactoring URL_FETCH_TIMEOUT_MS for DI.
// Coverage here targets fetch-throws and HTTP-non-OK only.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================

const { authReturnValue, haikuResult, shadowLogCalls } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  haikuResult: { current: null },
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

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = { create: async () => haikuResult.current };
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms, _ms: ms }),
  },
}));

const { default: handler } = await import('./parse-signal.js');

// ==================== FIRESTORE MOCK ====================

function makeFakeFirestore({ cache = {}, drops = {} } = {}) {
  const state = { cache: { ...cache }, drops: { ...drops } };

  const buildCacheRef = (contentHash) => ({
    get: async () => ({
      exists: !!state.cache[contentHash],
      data: () => state.cache[contentHash],
    }),
    set: async (data) => {
      state.cache[contentHash] = data;
    },
  });

  const buildDropRef = (uid, dropId) => {
    const key = `${uid}/${dropId}`;
    return {
      get: async () => ({
        exists: !!state.drops[key],
        data: () => state.drops[key],
      }),
      set: async (data) => {
        state.drops[key] = data;
      },
    };
  };

  const buildUserDocRef = (uid) => ({
    collection: (subName) => {
      if (subName === 'signalDrops') {
        return { doc: (dropId) => buildDropRef(uid, dropId) };
      }
      throw new Error(`Unmocked sub-collection: users/${uid}/${subName}`);
    },
  });

  const collection = (name) => {
    if (name === 'signalDropCache') {
      return { doc: (h) => buildCacheRef(h) };
    }
    if (name === 'users') {
      return { doc: (uid) => buildUserDocRef(uid) };
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

// Build a Haiku tool_use response. The handler reads
// haikuResponse.content.find((c) => c.type === 'tool_use').input — so the
// shape needs `.content` as an array containing a `tool_use` entry with
// `.input` set to the parsed-signal object.
function makeHaikuResponse(parseInput) {
  return {
    content: [{ type: 'tool_use', input: parseInput }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// Default parse — high confidence, real ticker, specific topic. Used as
// the baseline; tests override fields to flip bailout / checkpoint paths.
function makeBaselineParse(overrides = {}) {
  return {
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
    ...overrides,
  };
}

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  haikuResult.current = makeHaikuResponse(makeBaselineParse());
  shadowLogCalls.current = [];
  activeFirestore = makeFakeFirestore().db;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ==================== BAILOUT CLASSIFICATION MATRIX ====================
//
// Bailout fires when ALL three are true:
//   - confidence < 0.5
//   - validatedCount === 0 AND impliedCount === 0
//   - topic empty/short OR matches GENERIC_TOPIC_REGEX
// HardCheckpoint fires when not bailing AND confidence < 0.6.

describe('parse-signal — bailout classification', () => {
  it('flags shouldBailout=true on low confidence + no tickers + generic topic', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    haikuResult.current = makeHaikuResponse(
      makeBaselineParse({
        confidence: 0.3,
        tickers: [],
        impliedTickers: [],
        topic: 'general',
      }),
    );

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'random market chatter',
      dropId: 'drop-bailout-1',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.shouldBailout).toBe(true);
    expect(res.body.shouldHardCheckpoint).toBe(false);
  });

  it('does NOT bail when one element of the bailout triad is missing (has tickers)', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    haikuResult.current = makeHaikuResponse(
      makeBaselineParse({
        confidence: 0.3,
        tickers: ['AAPL'],
        topic: 'general',
      }),
    );

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'AAPL chatter',
      dropId: 'drop-bailout-2',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.shouldBailout).toBe(false);
    // confidence < 0.6 → hard checkpoint fires instead
    expect(res.body.shouldHardCheckpoint).toBe(true);
  });

  it('flags shouldHardCheckpoint=true on mid-confidence band (0.5-0.6)', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    haikuResult.current = makeHaikuResponse(
      makeBaselineParse({
        confidence: 0.55,
        tickers: ['AAPL'],
      }),
    );

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'AAPL maybe news',
      dropId: 'drop-checkpoint',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.shouldBailout).toBe(false);
    expect(res.body.shouldHardCheckpoint).toBe(true);
  });

  it('clean pass: high confidence + tickers + specific topic = no flags', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    // baseline parse (confidence 0.85, AAPL, specific topic)
    const { req, res } = makeReqRes({
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId: 'drop-clean',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.shouldBailout).toBe(false);
    expect(res.body.shouldHardCheckpoint).toBe(false);
  });
});

// ==================== CACHE HIT PATH ====================

describe('parse-signal — cache', () => {
  it('returns cached parse on cache hit without calling Haiku', async () => {
    // Pre-populate cache with a result whose contentHash matches what the
    // handler will compute for the input text. We compute it via the
    // public hashText helper indirectly: just stage the cache entry
    // post-call by capturing the hash from a first call's response.
    // Simpler: do two calls with the same input — first writes, second
    // reads. Asserts the shape is `cached: true` on the second.
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;

    const body = {
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId: 'drop-cache-1',
    };
    // First call — writes cache row
    const { req: req1, res: res1 } = makeReqRes(body);
    await handler(req1, res1);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.cached).toBe(false);

    // Second call with the SAME text but a different dropId — same
    // contentHash (text-derived), so cache hits.
    haikuResult.current = null; // would crash if Haiku is called again
    const { req: req2, res: res2 } = makeReqRes({
      ...body,
      dropId: 'drop-cache-2',
    });
    await handler(req2, res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.cached).toBe(true);
    expect(res2.body.contentHash).toBe(res1.body.contentHash);
    expect(res2.body.parse).toEqual(res1.body.parse);
  });

  it('writes a per-user drop record on cache hit too', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    const body = {
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId: 'drop-warm',
    };
    // Warm cache
    await handler(...Object.values(makeReqRes(body)));

    // Second call with new dropId — should still write a per-user drop record
    const { req, res } = makeReqRes({ ...body, dropId: 'drop-cache-record' });
    await handler(req, res);

    expect(res.body.cached).toBe(true);
    const persistedDrop = fixture.state.drops['test-user/drop-cache-record'];
    expect(persistedDrop).toBeDefined();
    expect(persistedDrop.cacheHit).toBe(true);
    expect(persistedDrop.contentHash).toBe(res.body.contentHash);
  });
});

// ==================== URL FETCH MODES ====================

describe('parse-signal — URL fetch failure paths', () => {
  it('handles fetch-throws by setting urlFetchSucceeded=false in shadow log', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unreachable')),
    );

    const { req, res } = makeReqRes({
      type: 'url',
      url: 'https://example.com/article',
      dropId: 'drop-url-fail',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Per the handler contract, fetch failure doesn't reject the request —
    // it just lowers Haiku's input quality. The shadow log captures the
    // urlFetchSucceeded flag so we can audit fetch reliability.
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0].urlFetchSucceeded).toBe(false);
  });

  it('handles HTTP-non-OK response by setting urlFetchSucceeded=false', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      }),
    );

    const { req, res } = makeReqRes({
      type: 'url',
      url: 'https://example.com/missing',
      dropId: 'drop-url-404',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(shadowLogCalls.current[0].urlFetchSucceeded).toBe(false);
  });

  it('records urlFetchSucceeded=true when fetch returns OK', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'page body content',
      }),
    );

    const { req, res } = makeReqRes({
      type: 'url',
      url: 'https://example.com/article',
      dropId: 'drop-url-ok',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(shadowLogCalls.current[0].urlFetchSucceeded).toBe(true);
  });
});

// ==================== IMAGE MODE VALIDATION ====================

describe('parse-signal — image mode', () => {
  it('rejects 400 when imageBase64 is missing for type=image', async () => {
    const { req, res } = makeReqRes({
      type: 'image',
      dropId: 'drop-img-missing',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/imageBase64 is required/);
  });

  it('accepts a valid small image base64 and returns 200', async () => {
    // 1x1 transparent PNG (smallest valid PNG)
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      type: 'image',
      imageBase64: tinyPngBase64,
      imageMime: 'image/png',
      dropId: 'drop-img-ok',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.contentHash).toBeTruthy();
    // Drop record persists with imagePresent flag, not raw bytes.
    const persistedDrop = fixture.state.drops['test-user/drop-img-ok'];
    expect(persistedDrop.input.type).toBe('image');
    expect(persistedDrop.input.imagePresent).toBe(true);
    expect(persistedDrop.input.imageBase64).toBeUndefined();
  });
});

// ==================== BODY VALIDATION 400s ====================

describe('parse-signal — body validation', () => {
  it('rejects 400 when type is invalid', async () => {
    const { req, res } = makeReqRes({
      type: 'unsupported',
      dropId: 'drop-bad-type',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/type must be one of/);
  });

  it('rejects 400 when dropId is missing', async () => {
    const { req, res } = makeReqRes({ type: 'text', text: 'something' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/dropId is required/);
  });

  it('rejects 400 when text exceeds TEXT_INPUT_CAP_CHARS (5000)', async () => {
    const { req, res } = makeReqRes({
      type: 'text',
      text: 'x'.repeat(5001),
      dropId: 'drop-text-oversize',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/text must be a non-empty string/);
  });

  it('rejects 400 when url is malformed', async () => {
    const { req, res } = makeReqRes({
      type: 'url',
      url: 'not-a-url',
      dropId: 'drop-bad-url',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/url is malformed/);
  });

  it('returns 405 for non-POST methods', async () => {
    const { req, res } = makeReqRes(
      { type: 'text', text: 'x', dropId: 'drop-x' },
      'GET',
    );
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ==================== contentHash REGRESSION GUARD ====================
//
// THIS IS THE MOST IMPORTANT SINGLE TEST IN PR 3. The original P0 (PR #392)
// was a contract drift between parse-signal's response shape and what
// watchlist-dialogue's first-turn verifier expected — parse-signal stopped
// echoing contentHash, and the equality check at watchlist-dialogue.js:673
// always failed with parse_result_mismatch. This test directly guards that
// regression at the parse-signal endpoint's response surface, complementing
// the integration test's pipe-through assertion in signal-drop-integration.test.js.

describe('parse-signal — P0 regression guard (Phase 3.6 PR 3)', () => {
  it('echoes a non-empty contentHash in the 200 response (guards the original P0)', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId: 'drop-p0-guard',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // The exact failure mode of the original P0:
    //   - response was missing contentHash
    //   - watchlist-dialogue then 400'd with parse_result_mismatch
    expect(typeof res.body.contentHash).toBe('string');
    expect(res.body.contentHash.length).toBeGreaterThan(0);
    // The contentHash in the response MUST match what was persisted to
    // the drop record AND the cache row — same value end-to-end.
    const persistedDrop = fixture.state.drops['test-user/drop-p0-guard'];
    expect(persistedDrop.contentHash).toBe(res.body.contentHash);
    const cachedRow = fixture.state.cache[res.body.contentHash];
    expect(cachedRow).toBeDefined();
    expect(cachedRow.contentHash).toBe(res.body.contentHash);
  });
});

// ==================== SHADOW LOG ====================

describe('parse-signal — shadow log', () => {
  it('fires logSignalDrops with stage=parse on happy path', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({
      type: 'text',
      text: 'Apple is going hard on AI inference',
      dropId: 'drop-log',
    });
    await handler(req, res);

    // Baseline parse has all-validated tickers (AAPL), so only the parse-stage
    // log fires (not the off-universe one).
    expect(shadowLogCalls.current).toHaveLength(1);
    const logged = shadowLogCalls.current[0];
    expect(logged.stage).toBe('parse');
    expect(logged.dropId).toBe('drop-log');
    expect(logged.userId).toBe('test-user');
    expect(logged.cacheHit).toBe(false);
    expect(logged.contentHash).toBe(res.body.contentHash);
  });
});

// ==================== OFF-UNIVERSE OBSERVABILITY (PHASE 4.5a) ====================

describe('parse-signal — off-universe shadow log (Phase 4.5a)', () => {
  it('V-21/22: fires off_universe_ticker_seen event with stage=parse when unsupported.length > 0', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    haikuResult.current = makeHaikuResponse(
      makeBaselineParse({
        tickers: ['GK', 'ARKK'],
        topic: 'Cathie Wood picks',
        confidence: 0.45,
      }),
    );

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'Cathie Wood ARKK GK piece',
      dropId: 'drop-offuniverse',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const offUniverseEvent = shadowLogCalls.current.find(
      (r) => r.event === 'off_universe_ticker_seen',
    );
    expect(offUniverseEvent).toBeDefined();
    expect(offUniverseEvent.stage).toBe('parse');
    expect(offUniverseEvent.tickers).toEqual(['GK', 'ARKK']);
    expect(offUniverseEvent.dropId).toBe('drop-offuniverse');
    expect(offUniverseEvent.userId).toBe('test-user');
    expect(offUniverseEvent.contentHash).toBe(res.body.contentHash);
    expect(offUniverseEvent.topic).toBe('Cathie Wood picks');
    expect(offUniverseEvent.contentType).toBe('tweet');
    expect(offUniverseEvent.signalDirection).toBe('bullish');
    expect(typeof offUniverseEvent.capturedAt).toBe('string');
  });

  it('V-24: does NOT fire off_universe event when all tickers validate', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    // Baseline parse has tickers=['AAPL'] which validates
    const { req, res } = makeReqRes({
      type: 'text',
      text: 'Apple AI inference',
      dropId: 'drop-allvalid',
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const offUniverseEvent = shadowLogCalls.current.find(
      (r) => r.event === 'off_universe_ticker_seen',
    );
    expect(offUniverseEvent).toBeUndefined();
  });

  it('V-21 (ETFs validate now): SMH + XLK + GK partition produces off-universe log only for GK', async () => {
    const fixture = makeFakeFirestore();
    activeFirestore = fixture.db;
    haikuResult.current = makeHaikuResponse(
      makeBaselineParse({
        tickers: ['SMH', 'XLK', 'GK'],
        topic: 'Semis + ARK basket',
      }),
    );

    const { req, res } = makeReqRes({
      type: 'text',
      text: 'semis + GK',
      dropId: 'drop-mix',
    });
    await handler(req, res);

    const offUniverseEvent = shadowLogCalls.current.find(
      (r) => r.event === 'off_universe_ticker_seen',
    );
    expect(offUniverseEvent).toBeDefined();
    expect(offUniverseEvent.tickers).toEqual(['GK']);
  });
});

// ==================== AUTH ====================

describe('parse-signal — auth', () => {
  it('returns 401 when no auth token is present', async () => {
    authReturnValue.current = null;
    const { req, res } = makeReqRes({
      type: 'text',
      text: 'x',
      dropId: 'drop-auth',
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
