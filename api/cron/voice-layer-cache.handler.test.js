// api/cron/voice-layer-cache.handler.test.js
// Phase 2 N6 — the FIRST handler-level harness for voice-layer-cache.js.
// The existing 1186-line suite (voice-layer-cache.test.js) is pure-function
// only; P2-1 (newsLine flag-off: ZERO Wire reads + field-wise byte-identical
// cache doc) needs the handler run end-to-end against an accounting fake.
// This file builds that substrate and photographs today's behavior; the N1
// commit extends it with the flag-off/flag-on newsLine rows.
//
// Harness composition:
//   • db — masteryMockDb (read accounting: doc reads by path, queries by
//     collection). findActiveAgentBattles runs REAL against it.
//   • EODHD — global fetch stubbed with the real-time bulk shape; the real
//     fetchBulkPrices logic runs (batching, .US suffix mapping).
//   • marketSchedule — importActual + mutable getMarketState override (the
//     NYSE clock must not decide test outcomes).
//   • Everything else (brief builders, scoring helpers) runs real.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';

const marketState = { state: 'OPEN' };
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMarketState: () => ({ ...marketState }) };
});

const dbRef = { db: null };
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => dbRef.db,
}));

const handler = (await import('./voice-layer-cache.js')).default;

// ── Fixtures ───────────────────────────────────────────────────────────────
vi.stubEnv('CRON_SECRET', 'test-cron-secret');
vi.stubEnv('EODHD_API_KEY', 'test-eodhd-key');

const PRICE_ROWS = [
  { code: 'AMD.US', close: 150.5, previousClose: 148.0, change: 2.5, change_p: 1.69, volume: 55_000_000, open: 149, high: 151, low: 148.5, timestamp: 1_785_000_000 },
  { code: 'PLTR.US', close: 42.1, previousClose: 43.0, change: -0.9, change_p: -2.09, volume: 30_000_000, open: 43, high: 43.2, low: 41.9, timestamp: 1_785_000_000 },
  { code: 'SNOW.US', close: 210.0, previousClose: 205.0, change: 5.0, change_p: 2.44, volume: 8_000_000, open: 206, high: 211, low: 205.5, timestamp: 1_785_000_000 },
];

const fetchCalls = [];
function stubEodhd(rows = PRICE_ROWS, { ok = true } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    fetchCalls.push(String(url));
    return { ok, status: ok ? 200 : 500, json: async () => rows };
  }));
}

const BATTLE = () => ({
  status: 'active',
  agentId: 'agent-1',
  agentContext: { archetype: 'momentum_chaser' },
  portfolio: {
    star: [{ symbol: 'AMD', baseATR: 3.0, sector: 'Technology' }],
    core: [],
    support: [],
    bench: {
      stocks: [{ symbol: 'PLTR', sector: 'Technology', cooldownUntil: null }],
      crypto: { symbol: 'BTC-USD', sector: 'Crypto' },
    },
  },
  watchlist: { active: [{ symbol: 'SNOW' }] },
  thresholdHistory: {},
  startingPrices: { AMD: 100 },
  cronState: { intradayMomentum: { AMD: { vwap: 150.2, sma20: 149.8 } } },
});

const TECH_SCORE = (over = {}) => ({
  technicalScore: 78,
  rsiContext: 8,
  macdScore: 9,
  volumeConfirmation: 9,
  factors: {
    aboveSMA200: true, aboveSMA50: true, aboveSMA20: true,
    rsPercentile: 80, upDayVolRatio: 1.8,
    ...over.factors,
  },
  ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'factors')),
});

async function seedWorld(db, { battle = BATTLE() } = {}) {
  await db.collection('agentBattles').doc('battle-1').set(battle);
  await db.collection('indexIntelligence').doc('marketContext').set({
    regime: 'risk_on', regimeDetail: 'Broad participation', volatilityRegime: 'low',
    breadthTier: 'strong', topSectorToday: 'Technology', topSectorChange: 1.4,
    worstSectorToday: 'Utilities', worstSectorChange: -0.6,
    spy: { changePercent: 0.9 }, yields: { regime: 'stable' },
    leadership: 'growth', breadthQuality: { signal: 'confirming', detail: 'RSP keeping pace', spyVsRsp: 0.1 },
  });
  await db.collection('indexIntelligence').doc('stockRankings').set({
    stocks: [
      { symbol: 'AMD', technicalScore: 82, technicalRank: 3, atrPercentile: 0.8, sectorName: 'Technology', sectorTechnicalTotal: 71, nr7Flag: false },
      { symbol: 'SNOW', technicalScore: 78, technicalRank: 5, atrPercentile: 0.9, baggerBombFit: 90, baggerBombRank: 10, compositeScore: 88 },
    ],
  });
  await db.collection('stockTechnicalScores').doc('AMD').set(TECH_SCORE());
  await db.collection('stockTechnicalScores').doc('PLTR').set(TECH_SCORE({ volumeConfirmation: 5 }));
  await db.collection('stockTechnicalScores').doc('SNOW').set(TECH_SCORE({ volumeConfirmation: 11, factors: { rsPercentile: 90 } }));
  db.__resetReads();
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

const cronReq = () => ({ method: 'GET', headers: { 'x-vercel-cron': '1' } });

/** Field-wise view of a cache doc EXCLUDING the serverTimestamp() sentinel —
 *  the V1.3 byte-identity convention (naive object equality cannot work).
 *  The N1 flag-off photograph compares exactly this. */
export function cacheDocFields(doc) {
  const { updatedAt, ...rest } = doc;
  return rest;
}

beforeEach(() => {
  dbRef.db = makeMockDb();
  marketState.state = 'OPEN';
  fetchCalls.length = 0;
  stubEodhd();
});

// ── Guards ─────────────────────────────────────────────────────────────────
describe('handler guards', () => {
  it('non-cron caller without the secret → 401', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it('market closed → skipped, nothing read, nothing written', async () => {
    await seedWorld(dbRef.db);
    marketState.state = 'CLOSED';
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.body).toMatchObject({ skipped: true, reason: 'market_closed' });
    expect(dbRef.db.__readCounts()).toEqual({});
    expect(dbRef.db.__paths('voiceLayerCache/')).toHaveLength(0);
  });

  it('no active battles → skipped after the battle query only', async () => {
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.body).toMatchObject({ skipped: true, reason: 'no_active_battles' });
    expect(dbRef.db.__readCounts()).toEqual({ 'query:agentBattles': 1 });
  });
});

// ── The end-to-end tick ────────────────────────────────────────────────────
describe('cache tick (one active battle)', () => {
  it('writes voiceLayerCache/{battleId} with the full block set', async () => {
    await seedWorld(dbRef.db);
    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, battlesProcessed: 1, totalSymbols: 3 });

    const doc = dbRef.db.__dump('voiceLayerCache/battle-1');
    expect(doc).toBeDefined();
    expect(doc.battleId).toBe('battle-1');
    expect(doc.agentId).toBe('agent-1');
    expect(doc.forgeSeeds).toBeNull();
    expect(doc.dataFreshness).toEqual({
      prices: 'rest_15min', technicals: 'daily', rankings: 'daily', marketContext: 'daily',
    });
    // updatedAt is the serverTimestamp() SENTINEL (excluded from the
    // field-wise identity view; asserted by sentinel equality here).
    expect(FieldValue.serverTimestamp().isEqual(doc.updatedAt)).toBe(true);

    // Portfolio brief: real builders over the stubbed EODHD prices.
    expect(doc.portfolioBriefs).toHaveLength(1);
    expect(doc.portfolioBriefs[0]).toMatchObject({
      symbol: 'AMD', tier: 'star', price: 150.5, changePercent: 1.69,
      technicalScore: 82, technicalRank: 3, sector: 'Technology',
      intraday: { vwap: 150.2, sma20: 149.8 },
    });
    expect(doc.portfolioBriefs[0].thresholdProximity).toMatchObject({ baseATR: 3.0 });

    // Bench: PLTR priced; BTC-USD degraded (no EODHD coverage) but present.
    const benchBySymbol = Object.fromEntries(doc.benchBriefs.map((b) => [b.symbol, b]));
    expect(benchBySymbol['PLTR']).toMatchObject({ assetClass: 'stock', price: 42.1 });
    expect(benchBySymbol['BTC-USD']).toMatchObject({ assetClass: 'crypto', price: null });

    // Scout alerts fire from watchlist SNOW (rs_breakout + volume_surge +
    // game_fit), archetype-filtered.
    expect(doc.scoutAlerts.map((a) => a.type).sort()).toEqual(['game_fit', 'rs_breakout', 'volume_surge']);
    expect(doc.scoutAlerts.every((a) => a.symbol === 'SNOW')).toBe(true);

    expect(doc.marketContext).toMatchObject({
      regime: 'risk_on', breadthTier: 'strong', topSector: 'Technology', spyChange: 0.9,
    });
  });

  it('EODHD fetches only stock symbols (bench crypto excluded), batched under 20', async () => {
    await seedWorld(dbRef.db);
    await handler(cronReq(), makeRes());
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toContain('AMD.US');
    expect(fetchCalls[0]).toContain('PLTR.US');
    expect(fetchCalls[0]).toContain('SNOW.US');
    expect(fetchCalls[0]).not.toContain('BTC');
  });

  it('read accounting: exactly the expected doc reads — and ZERO Wire reads (the P2-1 substrate)', async () => {
    await seedWorld(dbRef.db);
    await handler(cronReq(), makeRes());

    const counts = dbRef.db.__readCounts();
    expect(counts['query:agentBattles']).toBe(1);
    expect(counts['indexIntelligence/marketContext']).toBe(1);
    expect(counts['indexIntelligence/stockRankings']).toBe(1);
    expect(counts['stockTechnicalScores/AMD']).toBe(1);
    expect(counts['stockTechnicalScores/PLTR']).toBe(1);
    expect(counts['stockTechnicalScores/SNOW']).toBe(1);
    // The Wire day-doc collection is never touched by today's handler; the
    // N1 flag-off row asserts this stays true WITH the newsLine code merged.
    expect(Object.keys(counts).some((k) => k.includes('fantasyTimesWire'))).toBe(false);
  });

  it('EODHD outage degrades (empty priceMap): doc still written, portfolio briefs empty, crypto bench survives', async () => {
    await seedWorld(dbRef.db);
    stubEodhd([], { ok: false });
    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.body).toMatchObject({ success: true, battlesProcessed: 1, pricesFetched: 0 });
    const doc = dbRef.db.__dump('voiceLayerCache/battle-1');
    expect(doc.portfolioBriefs).toEqual([]); // price-gated builder
    const benchBySymbol = Object.fromEntries(doc.benchBriefs.map((b) => [b.symbol, b]));
    expect(benchBySymbol['PLTR'].price).toBeNull(); // degraded, retained
    expect(benchBySymbol['BTC-USD'].price).toBeNull();
  });

  it('two active battles → two cache docs in one committed batch', async () => {
    await seedWorld(dbRef.db);
    const second = BATTLE();
    second.agentId = 'agent-2';
    second.agentContext = { archetype: 'value_hunter' };
    await dbRef.db.collection('agentBattles').doc('battle-2').set(second);
    dbRef.db.__resetReads();

    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.body).toMatchObject({ success: true, battlesProcessed: 2 });
    expect(dbRef.db.__paths('voiceLayerCache/')).toEqual([
      'voiceLayerCache/battle-1', 'voiceLayerCache/battle-2',
    ]);
    // Archetype filter differs per battle: momentum_chaser sees rs_breakout,
    // value_hunter does not (relevance-filtered), proving per-battle builds.
    const doc1 = dbRef.db.__dump('voiceLayerCache/battle-1');
    const doc2 = dbRef.db.__dump('voiceLayerCache/battle-2');
    expect(doc1.scoutAlerts.map((a) => a.type)).toContain('rs_breakout');
    expect(doc2.scoutAlerts.map((a) => a.type)).not.toContain('rs_breakout');
  });
});
