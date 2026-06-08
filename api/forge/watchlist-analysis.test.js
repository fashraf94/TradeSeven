// api/forge/watchlist-analysis.test.js
//
// Handler-level coverage for the cohort-analysis endpoint. buildCohortDigest
// and extractTickerSymbols run for real (pure); the Gemma client, prompt
// builder, auth, firestore, and shadow logger are mocked. Mirrors the
// workshop-chat.test.js mock shape.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================
const { authReturnValue, gemmaResult, parseImpl, shadowLogCalls, gemmaCalls, peerQueryCount } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gemmaResult: { current: { success: true, content: '{"_scratchpad":"reasoning","message":"They cluster in Technology and most are above their 200-day line.","suggestedActions":["how do their P/Es compare"]}' } },
  parseImpl: { current: (c) => JSON.parse(c) },
  shadowLogCalls: { current: [] },
  gemmaCalls: { current: 0 },
  peerQueryCount: { current: 0 },
}));

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) { res.status(401).json({ error: 'auth required' }); return null; }
    return authReturnValue.current;
  },
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logConversation: async (record) => { shadowLogCalls.current.push(record); },
}));
vi.mock('../_utils/voiceLayerPrompt.js', () => ({ buildVoiceLayerPrompt: () => 'system-prompt-stub' }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async () => { gemmaCalls.current += 1; return gemmaResult.current; },
  parseVoiceLayerResponse: (c) => parseImpl.current(c),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

const { default: handler } = await import('./watchlist-analysis.js');

// ==================== FIRESTORE MOCK ====================
const STOCKS = [
  { symbol: 'AAA', sectorName: 'Technology', industryName: 'Software', return1M: 10, return3M: 20, momentumScore: 80, sma200_position: 5, baggerBombFit: 70, nr7Flag: true },
  { symbol: 'BBB', sectorName: 'Technology', industryName: 'Software', return1M: 5, return3M: 8, momentumScore: 60, sma200_position: 2 },
  { symbol: 'CCC', sectorName: 'Healthcare', industryName: 'Biotechnology', return1M: -3, return3M: -10, momentumScore: 30, sma200_position: -4 },
  { symbol: 'DDD', sectorName: 'Technology', industryName: 'Software', return1M: -8, return3M: -15, momentumScore: 20, sma200_position: -6 },
];
const PEER = {
  AAA: { ticker: 'AAA', metrics: { trailingPE: 20, debtToEquity: 1, marketCap: 1e11 } },
  BBB: { ticker: 'BBB', metrics: { trailingPE: 30, debtToEquity: 0.5, marketCap: 2e11 } },
};

function makeFirestore({ watchlistDocs = {}, sessionDocs = {}, hasRankings = true, allocatedSessionId = 'sess-new' } = {}) {
  const state = { watchlistDocs, sessionDocs, allocatedSessionId };

  const docRef = (coll, id) => ({
    id,
    get: async () => {
      if (coll === 'watchlists') return { exists: !!state.watchlistDocs[id], data: () => state.watchlistDocs[id] };
      if (coll === 'analysisSessions') return { exists: !!state.sessionDocs[id], data: () => state.sessionDocs[id] };
      if (coll === 'indexIntelligence') return { exists: hasRankings, data: () => ({ stocks: STOCKS, updatedAt: '2026-06-08T00:00:00.000Z' }) };
      return { exists: false, data: () => null };
    },
    set: async (body) => { if (coll === 'analysisSessions') state.sessionDocs[id] = body; },
    update: async (u) => { if (coll === 'analysisSessions') state.sessionDocs[id] = { ...state.sessionDocs[id], ...u }; },
  });

  const collection = (name) => ({
    doc: (id) => docRef(name, id || (name === 'analysisSessions' ? state.allocatedSessionId : undefined)),
    where: (field, op, chunk) => ({
      get: async () => {
        peerQueryCount.current += 1;
        const matches = (name === 'peerRankings')
          ? Object.values(PEER).filter((d) => chunk.includes(d.ticker))
          : [];
        return { forEach: (cb) => matches.forEach((d) => cb({ data: () => d })) };
      },
    }),
  });

  const runTransaction = async (fn) => fn({
    get: async (ref) => ref.get(),
    update: async (ref, u) => { state.sessionDocs[ref.id] = { ...state.sessionDocs[ref.id], ...u }; },
  });

  return { db: { collection, runTransaction }, state };
}

function makeReqRes(body) {
  const req = { method: 'POST', body, query: {} };
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}

const COMMITTED_WL = {
  watchlistId: 'wl-1',
  userId: 'test-user',
  status: 'committed',
  tickers: [{ symbol: 'AAA' }, { symbol: 'BBB' }, { symbol: 'CCC' }, { symbol: 'DDD' }],
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  gemmaResult.current = { success: true, content: '{"_scratchpad":"reasoning","message":"They cluster in Technology.","suggestedActions":["how do their P/Es compare"]}' };
  parseImpl.current = (c) => JSON.parse(c);
  shadowLogCalls.current = [];
  gemmaCalls.current = 0;
  peerQueryCount.current = 0;
  activeFirestore = null;
});

describe('watchlist-analysis — open turn (no userMessage)', () => {
  it('returns the Tier-1 digest + opening narration with NO model call', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: '' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.digest.size).toBe(4);
    expect(res.body.digest.sectors[0]).toEqual({ name: 'Technology', count: 3 });
    expect(typeof res.body.message).toBe('string');
    expect(res.body.sessionId).toBe('sess-new');
    expect(res.body.tier2Included).toBe(false);
    expect(gemmaCalls.current).toBe(0);
    expect(peerQueryCount.current).toBe(0);
  });
});

describe('watchlist-analysis — question turn (Tier-1 only)', () => {
  it('calls Gemma, returns its message, and does NOT read peerRankings', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what do these have in common?' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('Technology');
    expect(gemmaCalls.current).toBe(1);
    expect(peerQueryCount.current).toBe(0);
    expect(res.body.tier2Included).toBe(false);
    expect(res.body.digest.fundamentals).toBeNull();
    // _scratchpad never leaks to the client.
    expect(res.body._scratchpad).toBeUndefined();
    // scratchpad reaches the shadow log only.
    expect(shadowLogCalls.current[0].scratchpad).toBe('reasoning');
  });

  it('persists the new session with one exchange', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what do these share?' });
    await handler(req, res);
    const sess = fx.state.sessionDocs['sess-new'];
    expect(sess.messagesUsed).toBe(1);
    expect(sess.exchanges).toHaveLength(1);
    expect(sess.watchlistId).toBe('wl-1');
  });
});

describe('watchlist-analysis — fundamentals turn (lazy Tier-2)', () => {
  it('reads peerRankings and includes fundamentals when the message is fundamentals-flavoured', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'how do their P/E ratios compare?' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(peerQueryCount.current).toBeGreaterThan(0);
    expect(res.body.tier2Included).toBe(true);
    expect(res.body.digest.fundamentals.trailingPE.count).toBe(2);
    expect(res.body.digest.fundamentals.trailingPE.lowName).toBe('AAA');
  });
});

describe('watchlist-analysis — auth + ownership + state', () => {
  it('401 without auth', async () => {
    authReturnValue.current = null;
    activeFirestore = makeFirestore().db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('404 when the watchlist is missing', async () => {
    activeFirestore = makeFirestore().db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('403 when the watchlist belongs to another user', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': { ...COMMITTED_WL, userId: 'someone-else' } } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('404 when the watchlist is soft-deleted', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': { ...COMMITTED_WL, deletedAt: '2026-06-01T00:00:00.000Z' } } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns a graceful message for an empty cohort', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': { ...COMMITTED_WL, tickers: [] } } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.digest).toBeNull();
    expect(gemmaCalls.current).toBe(0);
  });

  it('400 when a session belongs to a different watchlist', async () => {
    const fx = makeFirestore({
      watchlistDocs: { 'wl-1': COMMITTED_WL },
      sessionDocs: { 'sess-x': { userId: 'test-user', watchlistId: 'wl-OTHER', messagesUsed: 1, messageBudget: 30, exchanges: [] } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi', sessionId: 'sess-x' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('watchlist-analysis — Gemma resilience', () => {
  it('routes parseError to the snag fallback (no plain-text passthrough)', async () => {
    parseImpl.current = () => ({ parseError: true, errorReason: 'plaintext_passthrough', rawText: 'oops' });
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what do these share?' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.message).not.toContain('oops');
  });

  it('handles a Gemma failure gracefully', async () => {
    gemmaResult.current = { success: false, error: 'boom', aborted: false };
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what do these share?' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
  });

  it('503 when the rankings universe is unavailable', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL }, hasRankings: false });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'hi' });
    await handler(req, res);
    expect(res.statusCode).toBe(503);
  });
});

describe('watchlist-analysis — budget', () => {
  it('returns sessionEnded when the soft budget is consumed', async () => {
    const fx = makeFirestore({
      watchlistDocs: { 'wl-1': COMMITTED_WL },
      sessionDocs: { 'sess-x': { userId: 'test-user', watchlistId: 'wl-1', messagesUsed: 30, messageBudget: 30, exchanges: [] } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'one more', sessionId: 'sess-x' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sessionEnded).toBe(true);
    expect(gemmaCalls.current).toBe(0);
  });
});
