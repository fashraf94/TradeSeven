// api/forge/watchlist-analysis.test.js
//
// Handler-level coverage for the cohort-analysis endpoint. buildCohortDigest
// and extractTickerSymbols run for real (pure); the Gemma client, prompt
// builder, auth, firestore, and shadow logger are mocked. Mirrors the
// workshop-chat.test.js mock shape.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================
const { authReturnValue, gemmaResult, parseImpl, shadowLogCalls, gemmaCalls, peerQueryCount, estimatesQueryCount } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gemmaResult: { current: { success: true, content: '{"_scratchpad":"reasoning","message":"They cluster in Technology and most are above their 200-day line.","suggestedActions":["how do their P/Es compare"]}' } },
  parseImpl: { current: (c) => JSON.parse(c) },
  shadowLogCalls: { current: [] },
  gemmaCalls: { current: 0 },
  peerQueryCount: { current: 0 },
  estimatesQueryCount: { current: 0 },
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
// peerRankings.metrics fixture. The five EODHD pass-through fields
// (revenueGrowthYOY, earningsGrowthYOY, grossMargin, opMarginTTM, profitMarginTTM)
// are stored as raw decimal FRACTIONS — the endpoint's readPeerMetrics ×100-scales
// them to percent at the read. BBB.profitMarginTTM is null to exercise null-stays-
// null; trailingPE / debtToEquity / marketCap are NOT percents and must pass through
// unscaled.
const PEER = {
  AAA: { ticker: 'AAA', metrics: { trailingPE: 20, debtToEquity: 1, marketCap: 1e11, revenueGrowthYOY: 0.15, earningsGrowthYOY: 0.08, grossMargin: 0.40, opMarginTTM: 0.25, profitMarginTTM: 0.18 } },
  BBB: { ticker: 'BBB', metrics: { trailingPE: 30, debtToEquity: 0.5, marketCap: 2e11, revenueGrowthYOY: 0.25, earningsGrowthYOY: 0.30, grossMargin: 0.55, opMarginTTM: 0.35, profitMarginTTM: null } },
};
// Forward-estimates cache fixture — the NESTED, raw-EODHD shape (growth as a
// STRING fraction) so the endpoint's readEstimates flattening + numeric coercion
// + fraction→percent scaling are all exercised. CCC is the thin / sparse name.
const ESTIMATES = {
  AAA: {
    rsr: 0.8, emsPercentile: 70,
    estimateSpread: { currentQtr: 5, currentYear: 8 },
    forwardEstimates: {
      currentYear: { growth: '0.12', numAnalysts: '18' },
      nextYear: { growth: '0.18', numAnalysts: '20' },
    },
  },
  BBB: {
    rsr: 0.6, emsPercentile: 90,
    estimateSpread: { currentQtr: 9, currentYear: 15 },
    forwardEstimates: {
      currentYear: { growth: '0.22', numAnalysts: '24' },
      nextYear: { growth: '0.30', numAnalysts: '25' },
    },
  },
  CCC: {
    rsr: null, emsPercentile: null,
    estimateSpread: { currentQtr: null, currentYear: null },
    forwardEstimates: { currentYear: null, nextYear: null },
  },
};

function makeFirestore({ watchlistDocs = {}, sessionDocs = {}, hasRankings = true, allocatedSessionId = 'sess-new' } = {}) {
  const state = { watchlistDocs, sessionDocs, allocatedSessionId };

  const docRef = (coll, id) => ({
    id,
    get: async () => {
      if (coll === 'watchlists') return { exists: !!state.watchlistDocs[id], data: () => state.watchlistDocs[id] };
      if (coll === 'analysisSessions') return { exists: !!state.sessionDocs[id], data: () => state.sessionDocs[id] };
      if (coll === 'indexIntelligence') return { exists: hasRankings, data: () => ({ stocks: STOCKS, updatedAt: '2026-06-08T00:00:00.000Z' }) };
      if (coll === 'estimatesCache') { estimatesQueryCount.current += 1; return { exists: true, data: () => ({ stocks: ESTIMATES }) }; }
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
  estimatesQueryCount.current = 0;
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

  it('triggers Tier-2 on plural fundamentals nouns (caps / multiples / valuations)', async () => {
    for (const q of ['how do the caps compare?', 'are their multiples stretched?', 'compare their valuations']) {
      const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
      activeFirestore = fx.db;
      peerQueryCount.current = 0;
      const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: q });
      await handler(req, res);
      expect(res.body.tier2Included, `"${q}" should trigger Tier-2`).toBe(true);
      expect(peerQueryCount.current).toBeGreaterThan(0);
    }
  });

  it('stays Tier-1 only for a non-fundamentals turn', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what sectors are these in?' });
    await handler(req, res);
    expect(res.body.tier2Included).toBe(false);
    expect(peerQueryCount.current).toBe(0);
  });
});

describe('watchlist-analysis — Tier-2 fraction→percent scaling (REV_GR / MARGIN fix)', () => {
  it('×100-scales the five fraction fields at the read; null stays null; non-pct fields unchanged', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'how do their margins and revenue growth compare?' });
    await handler(req, res);
    expect(res.body.tier2Included).toBe(true);

    const aaa = res.body.rows.find((r) => r.symbol === 'AAA');
    const bbb = res.body.rows.find((r) => r.symbol === 'BBB');
    // Fraction → percent (×100): the five EODHD pass-through fields.
    expect(aaa.revenueGrowthYOY).toBe(15);   // 0.15
    expect(aaa.earningsGrowthYOY).toBe(8);    // 0.08
    expect(aaa.grossMargin).toBe(40);         // 0.40
    expect(aaa.opMarginTTM).toBe(25);         // 0.25
    expect(aaa.profitMarginTTM).toBe(18);     // 0.18
    expect(bbb.revenueGrowthYOY).toBe(25);    // 0.25
    // null stays null — NOT 0 (Number(null) === 0 would fabricate a value).
    expect(bbb.profitMarginTTM).toBeNull();
    // Non-percent fundamentals pass through UNSCALED (only the five fields scale).
    expect(aaa.trailingPE).toBe(20);
    expect(aaa.debtToEquity).toBe(1);
    expect(aaa.marketCap).toBe(1e11);

    // The digest medians reflect the scaled values and exclude the null name.
    expect(res.body.digest.fundamentals.revenueGrowthYOY).toMatchObject({ min: 15, max: 25, median: 20, count: 2 });
    expect(res.body.digest.fundamentals.profitMarginTTM).toMatchObject({ count: 1, median: 18 }); // BBB null excluded
    // trailingPE median unchanged (NOT ×100) — proves scaling is field-scoped.
    expect(res.body.digest.fundamentals.trailingPE.median).toBe(25);
  });

  it('regression: Tier-2 scaling does NOT double-scale Tier-3 forward growth (≈ tens of %, not thousands)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    // A turn that loads BOTH tiers (margins → Tier-2; "grow … next year" → Tier-3),
    // so the two independent reads run side by side and we prove they don't interfere.
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'how do their margins compare, and which grow most next year?' });
    await handler(req, res);
    expect(res.body.tier2Included).toBe(true);
    expect(res.body.tier3Included).toBe(true);

    // Tier-3 growth is scaled EXACTLY ONCE in readEstimates ("0.18"/"0.30" → 18/30).
    // It must stay tens-of-percent — never ×100 a second time (→ 1800/3000): the
    // double-scale the audit flagged as "+22.5% → +2250%". readPeerMetrics is Tier-2-only.
    const fwd = res.body.digest.forward;
    expect(fwd.consensusGrowthNextYear.min).toBe(18);
    expect(fwd.consensusGrowthNextYear.max).toBe(30);
    expect(fwd.consensusGrowthNextYear.max).toBeLessThan(100);
    // …and the Tier-2 fractions in the SAME response are scaled (both paths ran).
    const aaa = res.body.rows.find((r) => r.symbol === 'AAA');
    expect(aaa.profitMarginTTM).toBe(18);
  });
});

describe('watchlist-analysis — Tier-3 forward consensus (lazy)', () => {
  it('reads estimatesCache and flags tier3 on a forward-flavoured turn', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'which are expected to grow the most next year?' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(estimatesQueryCount.current).toBeGreaterThan(0);
    expect(res.body.tier3Included).toBe(true);
  });

  it('flattens + percent-scales the nested cache into the forward digest block', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what is the consensus growth outlook next year?' });
    await handler(req, res);
    const fwd = res.body.digest.forward;
    // AAA "0.18", BBB "0.30" → ×100 → 18, 30; CCC null → count 2, range 18..30.
    expect(fwd.consensusGrowthNextYear.min).toBe(18);
    expect(fwd.consensusGrowthNextYear.max).toBe(30);
    expect(fwd.consensusGrowthNextYear.count).toBe(2);
    expect(fwd.consensusGrowthNextYear.lowName).toBe('AAA');
    expect(fwd.consensusGrowthNextYear.highName).toBe('BBB');
    // numAnalysts strings "20"/"25" coerced to numbers.
    expect(fwd.numAnalystsNextYear.max).toBe(25);
  });

  it('keeps explicit-null forward fields null (not 0) for thin names', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what is the consensus growth outlook next year?' });
    await handler(req, res);
    // CCC has rsr / emsPercentile / estimateSpread = null in the cache — they must
    // stay null, NOT coerce to 0 (Number(null) === 0), which would pollute the
    // forward stats, mis-mark a standout, and defeat the nulls-last sort.
    const ccc = res.body.rows.find((r) => r.symbol === 'CCC');
    expect(ccc.rsr).toBeNull();
    expect(ccc.emsPercentile).toBeNull();
    expect(ccc.estimateSpread).toBeNull();
    expect(ccc.consensusGrowthNextYear).toBeNull();
    // The digest stats therefore exclude the null name (count 2 of AAA/BBB, not 3).
    expect(res.body.digest.forward.rsr.count).toBe(2);
    expect(res.body.digest.forward.emsPercentile.count).toBe(2);
    expect(res.body.digest.forward.estimateSpread.count).toBe(2);
  });

  it('sorts the visible list by consensus growth (deterministic forward focus)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'which are expected to grow most next year?' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('consensusGrowthNextYear');
    const bbb = res.body.rows.find((r) => r.symbol === 'BBB');
    expect(bbb.consensusGrowthNextYear).toBe(30); // real value carried for the UI sort
  });

  it('a forward focusDimension forces the estimatesCache read without a forward keyword (coupling)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    estimatesQueryCount.current = 0;
    // "being raised or cut" → emsPercentile (a forward dim) but no FORWARD_KEYWORDS hit.
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'whose numbers are being raised or cut?' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('emsPercentile');
    expect(estimatesQueryCount.current).toBeGreaterThan(0);
    expect(res.body.tier3Included).toBe(true);
  });

  it('a bare "revenue growth" question still sorts by trailing revenueGrowthYOY (fence)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'how does their revenue growth compare?' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('revenueGrowthYOY'); // trailing dim unchanged
    expect(res.body.tier2Included).toBe(true);
  });

  it('a plain sector question reads no estimates and reports tier3Included:false', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'what sectors are these in?' });
    await handler(req, res);
    expect(res.body.tier3Included).toBe(false);
    expect(estimatesQueryCount.current).toBe(0);
  });

  it('open turn does not read estimatesCache (tier3Included:false, key absent on rows)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: '' });
    await handler(req, res);
    expect(res.body.tier3Included).toBe(false);
    expect(estimatesQueryCount.current).toBe(0);
    expect(res.body.rows[0]).not.toHaveProperty('consensusGrowthNextYear');
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

// ── Per-name layer (A + C): rows, focusDimension, characterization trigger ────

describe('watchlist-analysis — per-name rows + focusDimension', () => {
  it('open turn returns a rows array and null focusDimension', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: '' });
    await handler(req, res);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows).toHaveLength(4);
    expect(res.body.rows[0]).not.toHaveProperty('trailingPE'); // Tier-1 only on open
    expect(res.body.focusDimension).toBeNull();
  });

  it('derives focusDimension=debtToEquity and surfaces the column for "rank by leverage"', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'rank these by leverage' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('debtToEquity');
    expect(res.body.tier2Included).toBe(true);
    expect(res.body.rows[0]).toHaveProperty('debtToEquity');
  });

  it('a fundamental focusDimension forces the Tier-2 read even without a fundamental keyword (coupling)', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    peerQueryCount.current = 0;
    // "indebted" maps to debtToEquity but is NOT matched by FUNDAMENTAL_KEYWORDS
    // (\bdebt won't fire inside "indebted") nor by CHARACTERIZATION_KEYWORDS.
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'which look the most indebted?' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('debtToEquity');
    expect(peerQueryCount.current).toBeGreaterThan(0);
    expect(res.body.tier2Included).toBe(true);
  });

  it('characterization questions pull Tier-2 (C): "which are the outliers?"', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    peerQueryCount.current = 0;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'which are the outliers?' });
    await handler(req, res);
    expect(peerQueryCount.current).toBeGreaterThan(0);
    expect(res.body.tier2Included).toBe(true);
  });

  it('a non-fundamental focus (momentum) stays Tier-1 only', async () => {
    const fx = makeFirestore({ watchlistDocs: { 'wl-1': COMMITTED_WL } });
    activeFirestore = fx.db;
    peerQueryCount.current = 0;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'which have the strongest momentum?' });
    await handler(req, res);
    expect(res.body.focusDimension).toBe('momentumScore');
    expect(res.body.tier2Included).toBe(false);
    expect(peerQueryCount.current).toBe(0);
  });

  it('budget-exhausted turn carries rows:null and focusDimension:null', async () => {
    const fx = makeFirestore({
      watchlistDocs: { 'wl-1': COMMITTED_WL },
      sessionDocs: { 'sess-x': { userId: 'test-user', watchlistId: 'wl-1', messagesUsed: 30, messageBudget: 30, exchanges: [] } },
    });
    activeFirestore = fx.db;
    const { req, res } = makeReqRes({ watchlistId: 'wl-1', userMessage: 'one more', sessionId: 'sess-x' });
    await handler(req, res);
    expect(res.body.sessionEnded).toBe(true);
    expect(res.body.rows).toBeNull();
    expect(res.body.focusDimension).toBeNull();
  });
});
