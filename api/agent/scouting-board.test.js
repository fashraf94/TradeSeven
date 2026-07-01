// api/agent/scouting-board.test.js
//
// Contract + behavior coverage for the read-only Scouting Board endpoint. The
// ranking (archetypeScoring), watchlist helpers, and archetype config are the
// REAL modules (that behavior is what we assert); only firebaseAdmin, security,
// auth, and the feature flag are mocked. The load-bearing guarantees:
//   * NO Firestore write / NO battle doc (this endpoint deploys nothing)
//   * the watchlist owner guard (IDOR against the rules-bypassing Admin SDK)
//   * archetype-driven boards (degen board != analyst board)
//   * honesty: off-universe watchlist names carry no score/chip.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeArchetypeRankings } from '../_utils/archetypeScoring.js';

// ==================== HOISTED MOCK STATE ====================
const { authReturnValue, boardFlag } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  boardFlag: { on: true }, // default ON so the flag guard doesn't 404 the behavior tests
}));

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

// Live getter so a test can flip SCOUTING_BOARD_ENABLED; real flags preserved.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SCOUTING_BOARD_ENABLED() { return boardFlag.on; },
}));

const { default: handler } = await import('./scouting-board.js');

// ==================== Fixtures ====================

const SECTORS = ['Technology', 'Energy', 'Financials', 'Healthcare', 'Industrials'];

// Seven high-volatility / low-quality names (degen loves, analyst hates) and
// seven high-quality / low-volatility names (analyst loves, degen hates). Fields
// vary monotonically within each group so rankings are deterministic. 14 stocks
// > board size 10, so the top-10 genuinely drops names and the two boards differ.
const HVOL = Array.from({ length: 7 }, (_, i) => ({
  symbol: `HVOL${i + 1}`,
  sectorName: SECTORS[i % SECTORS.length],
  atrPercentile: 0.95 - i * 0.01,   // 0.95 .. 0.89
  fundamentalScore: 15 + i,          // 15 .. 21
  technicalScore: 65 - i,            // 65 .. 59
  compositeScore: 25 + i,
  baggerBombFit: 72 - i,
}));
const QUAL = Array.from({ length: 7 }, (_, i) => ({
  symbol: `QUAL${i + 1}`,
  sectorName: SECTORS[i % SECTORS.length],
  atrPercentile: 0.12 + i * 0.01,    // 0.12 .. 0.18
  fundamentalScore: 92 - i,          // 92 .. 86
  technicalScore: 48 + i,
  compositeScore: 88 - i,
  baggerBombFit: 38 + i,
}));
const STOCKS = [...HVOL, ...QUAL];

const STOCK_RANKINGS = {
  stocks: STOCKS,
  computedAt: { toDate: () => new Date('2026-07-01T13:30:00.000Z') },
};

const OWNED_WATCHLIST = {
  watchlistId: 'wl-1',
  userId: 'test-user',
  name: 'My plays',
  status: 'committed',
  tickers: [{ symbol: 'HVOL1' }, { symbol: 'QUAL1' }, { symbol: 'ZZZZ' }],
};

function makeFakeFirestore({ stockRankings = null, watchlists = {}, watchlistReadError = false } = {}) {
  const written = { setCalls: [], updateCalls: [], addCalls: [] };
  const collection = (name) => ({
    doc: (idArg) => {
      const docId = idArg || `auto-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: docId,
        get: async () => {
          if (name === 'indexIntelligence' && docId === 'stockRankings') {
            return { exists: !!stockRankings, data: () => stockRankings };
          }
          if (name === 'watchlists') {
            if (watchlistReadError) throw new Error('watchlist read failed');
            const wl = watchlists[docId] || null;
            return { exists: !!wl, data: () => wl };
          }
          return { exists: false, data: () => null };
        },
        set: async (data) => { written.setCalls.push({ collection: name, id: docId, data }); },
        update: async (updates) => { written.updateCalls.push({ collection: name, id: docId, updates }); },
      };
    },
    add: async (data) => { written.addCalls.push({ collection: name, data }); return { id: 'new' }; },
  });
  return { db: { collection }, written };
}

function makeReqRes({ method = 'GET', query = {} } = {}) {
  const req = { method, query, headers: { authorization: 'Bearer x' } };
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}

function callBoard({ query, fixture }) {
  activeFirestore = fixture.db;
  const { req, res } = makeReqRes({ query });
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  boardFlag.on = true;
  activeFirestore = null;
});

// ==================== Tests ====================

describe('scouting-board — happy path & shape', () => {
  it('returns the board envelope for a valid archetype (no watchlist)', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const res = await callBoard({ query: { archetype: 'degen' }, fixture });

    expect(res.statusCode).toBe(200);
    expect(res.body.mode).toBe('board');
    expect(res.body.archetype).toBe('degen');
    expect(res.body.archetypeLabel).toBe('Speculator');
    expect(res.body.asOf).toBe('2026-07-01T13:30:00.000Z');
    expect(res.body.empty).toBe(false);
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
    expect(res.body.ranked).toHaveLength(10);
    for (const row of res.body.ranked) {
      expect(row).toEqual(expect.objectContaining({
        symbol: expect.any(String),
        sectorName: expect.any(String),
        archetypeScore: expect.any(Number),
        inWatchlist: false,
      }));
    }
  });

  it('caps at top-10 and returns rows sorted by archetypeScore descending', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const res = await callBoard({ query: { archetype: 'analyst' }, fixture });
    const scores = res.body.ranked.map((r) => r.archetypeScore);
    expect(res.body.ranked).toHaveLength(10);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('different archetypes produce different top-10 over the same universe', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const degen = await callBoard({ query: { archetype: 'degen' }, fixture });
    const analyst = await callBoard({ query: { archetype: 'analyst' }, fixture });

    expect(degen.body.ranked[0].symbol).not.toBe(analyst.body.ranked[0].symbol);
    expect(degen.body.ranked[0].symbol).toMatch(/^HVOL/);   // volatility-led
    expect(analyst.body.ranked[0].symbol).toMatch(/^QUAL/); // fundamentals-led
    const degenSet = degen.body.ranked.map((r) => r.symbol).join(',');
    const analystSet = analyst.body.ranked.map((r) => r.symbol).join(',');
    expect(degenSet).not.toBe(analystSet);
  });
});

describe('scouting-board — watchlist classification (degen board)', () => {
  it('marks in-top-10 watchlist names inline, surfaces below-top-10 with real score, and names-only off-universe', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': OWNED_WATCHLIST } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });

    // (a) HVOL1 ranks in degen's top-10 → marked inline, NOT duplicated in the group.
    const hvol1 = res.body.ranked.find((r) => r.symbol === 'HVOL1');
    expect(hvol1.inWatchlist).toBe(true);
    expect(res.body.watchlist.inUniverse.find((r) => r.symbol === 'HVOL1')).toBeUndefined();

    // (b) QUAL1 is in the universe but below degen's top-10 → inUniverse with its REAL score.
    const fullRanked = computeArchetypeRankings(STOCKS, 'degen');
    const qual1Expected = fullRanked.find((s) => s.symbol === 'QUAL1').archetypeScore;
    const qual1 = res.body.watchlist.inUniverse.find((r) => r.symbol === 'QUAL1');
    expect(qual1).toBeDefined();
    expect(qual1.archetypeScore).toBe(qual1Expected); // no placeholder — the real ranking score
    expect(res.body.ranked.find((r) => r.symbol === 'QUAL1')).toBeUndefined();

    // (c) ZZZZ is outside the universe → symbol only, no score, no chip.
    expect(res.body.watchlist.offUniverse).toEqual([{ symbol: 'ZZZZ' }]);
    expect(res.body.watchlist.offUniverse[0]).not.toHaveProperty('archetypeScore');
    expect(res.body.watchlist.offUniverse[0]).not.toHaveProperty('chip');
  });
});

describe('scouting-board — chips (honesty: only always-present dimensions)', () => {
  it('degen: every in-universe row carries the atrPercentile chip; off-universe carries none', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': OWNED_WATCHLIST } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    const chip = { label: 'high volatility', dim: 'atrPercentile' };
    for (const row of res.body.ranked) expect(row.chip).toEqual(chip);
    for (const row of res.body.watchlist.inUniverse) expect(row.chip).toEqual(chip);
    expect(res.body.watchlist.offUniverse[0]).not.toHaveProperty('chip');
  });

  it('momentum_chaser: technicalScore chip on every ranked row', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const res = await callBoard({ query: { archetype: 'momentum_chaser' }, fixture });
    for (const row of res.body.ranked) {
      expect(row.chip).toEqual({ label: 'strong technicals', dim: 'technicalScore' });
    }
  });

  it.each(['analyst', 'contrarian', 'guardian', 'diversifier'])(
    '%s: no chips (nullable/relational driver — never fabricated)',
    async (archetype) => {
      const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
      const res = await callBoard({ query: { archetype }, fixture });
      for (const row of res.body.ranked) expect(row.chip).toBeNull();
    },
  );
});

describe('scouting-board — read-only contract', () => {
  it('performs NO Firestore writes and creates NO battle doc', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': OWNED_WATCHLIST } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(fixture.written.updateCalls).toHaveLength(0);
    expect(fixture.written.setCalls).toHaveLength(0);
    expect(fixture.written.addCalls).toHaveLength(0);
  });
});

describe('scouting-board — auth, method, flag guards', () => {
  it('unauthenticated → 401', async () => {
    authReturnValue.current = null;
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const res = await callBoard({ query: { archetype: 'degen' }, fixture });
    expect(res.statusCode).toBe(401);
  });

  it('non-GET method → 405', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    activeFirestore = fixture.db;
    const { req, res } = makeReqRes({ method: 'POST', query: { archetype: 'degen' } });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('flag OFF → 404 with no Firestore access', async () => {
    boardFlag.on = false;
    // Any db access would throw (null) and surface as 500; a 404 proves the guard
    // fired before touching Firestore.
    activeFirestore = null;
    const { req, res } = makeReqRes({ query: { archetype: 'degen' } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('scouting-board — validation & degradation', () => {
  it.each([['foo'], [undefined]])('invalid/missing archetype (%s) → 400', async (archetype) => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS });
    const res = await callBoard({ query: archetype === undefined ? {} : { archetype }, fixture });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_archetype');
  });

  it('wrong-owner watchlist degrades to no watchlist (IDOR guard — foreign tickers never appear)', async () => {
    const foreign = { ...OWNED_WATCHLIST, userId: 'other-user', tickers: [{ symbol: 'SECRET' }] };
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': foreign } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
    const asJson = JSON.stringify(res.body);
    expect(asJson).not.toContain('SECRET');
  });

  it('uncommitted watchlist degrades', async () => {
    const draft = { ...OWNED_WATCHLIST, status: 'draft' };
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': draft } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
  });

  it('soft-deleted watchlist degrades', async () => {
    const deleted = { ...OWNED_WATCHLIST, deletedAt: '2026-06-30T00:00:00Z' };
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: { 'wl-1': deleted } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
  });

  it('missing watchlist id degrades (200, empty group)', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlists: {} });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'ghost' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
  });

  it('watchlist read error degrades (board still renders)', async () => {
    const fixture = makeFakeFirestore({ stockRankings: STOCK_RANKINGS, watchlistReadError: true });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(res.body.ranked.length).toBeGreaterThan(0);
    expect(res.body.watchlist).toEqual({ inUniverse: [], offUniverse: [] });
  });

  it('empty stockRankings → empty:true, asOf:null, equipped names fall to offUniverse', async () => {
    const fixture = makeFakeFirestore({ stockRankings: null, watchlists: { 'wl-1': OWNED_WATCHLIST } });
    const res = await callBoard({ query: { archetype: 'degen', watchlistId: 'wl-1' }, fixture });
    expect(res.statusCode).toBe(200);
    expect(res.body.empty).toBe(true);
    expect(res.body.ranked).toEqual([]);
    expect(res.body.asOf).toBeNull();
    expect(res.body.watchlist.inUniverse).toEqual([]);
    expect(res.body.watchlist.offUniverse.map((r) => r.symbol).sort())
      .toEqual(['HVOL1', 'QUAL1', 'ZZZZ']);
  });
});
