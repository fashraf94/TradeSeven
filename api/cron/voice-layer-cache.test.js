// api/cron/voice-layer-cache.test.js
// Tier 0 Item 1: bench data exposure — buildBenchBriefs unit tests.

import { describe, it, expect } from 'vitest';
import { buildBenchBriefs } from './voice-layer-cache.js';

// ==================== FIXTURES ====================

const FROZEN_NOW = new Date('2026-05-04T15:00:00Z');

function fullPrice(close, change_p) {
  return {
    close,
    previousClose: close - 1,
    change: change_p / 100 * close,
    change_p,
    volume: 1_000_000,
    open: close - 0.5,
    high: close + 0.3,
    low: close - 0.7,
    timestamp: FROZEN_NOW.getTime() / 1000,
  };
}

function fullTechScore({
  technicalScore = 70,
  rsiContext = 8,
  macdScore = 9,
  volumeConfirmation = 9,
  factors = {},
} = {}) {
  return {
    technicalScore,
    rsiContext,
    macdScore,
    volumeConfirmation,
    factors: {
      aboveSMA200: true,
      aboveSMA50: true,
      aboveSMA20: true,
      rsPercentile: 80,
      upDayVolRatio: 1.8,
      ...factors,
    },
  };
}

function fullRanking({ technicalScore = 70, technicalRank = 25, atrPercentile = 0.55 } = {}) {
  return { technicalScore, technicalRank, atrPercentile };
}

const STOCK_AMD = { symbol: 'AMD', name: 'AMD', baseATR: 3.0, isCrypto: false, sector: 'Technology' };
const STOCK_PLTR = { symbol: 'PLTR', name: 'Palantir', baseATR: 4.0, isCrypto: false, sector: 'Technology' };
const CRYPTO_BTC = { symbol: 'BTC-USD', name: 'Bitcoin', baseATR: 5.0, isCrypto: true, sector: 'Crypto' };

// ==================== TESTS ====================

describe('buildBenchBriefs — empty / missing inputs', () => {
  it('returns [] when portfolio is null/undefined', () => {
    expect(buildBenchBriefs(null, {}, {}, {}, FROZEN_NOW)).toEqual([]);
    expect(buildBenchBriefs(undefined, {}, {}, {}, FROZEN_NOW)).toEqual([]);
  });

  it('returns [] when bench is missing', () => {
    expect(buildBenchBriefs({}, {}, {}, {}, FROZEN_NOW)).toEqual([]);
  });

  it('returns [] when bench has neither stocks nor crypto', () => {
    const portfolio = { bench: { stocks: [], crypto: null } };
    expect(buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW)).toEqual([]);
  });
});

describe('buildBenchBriefs — full data path', () => {
  it('emits a complete brief for a stock with full data', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const priceMap = { AMD: fullPrice(150.5, 2.34) };
    const rankingsMap = { AMD: fullRanking({ technicalScore: 72, technicalRank: 18, atrPercentile: 0.55 }) };
    const techScoresMap = { AMD: fullTechScore() };

    const briefs = buildBenchBriefs(portfolio, priceMap, rankingsMap, techScoresMap, FROZEN_NOW);

    expect(briefs).toHaveLength(1);
    expect(briefs[0]).toMatchObject({
      symbol: 'AMD',
      assetClass: 'stock',
      price: 150.5,
      changePercent: 2.34,
      technicalScore: 72,
      technicalRank: 18,
      rsPercentile: 80,
      sector: 'Technology',
      cooldownUntil: null,
      cooldownActive: false,
      atrPercent: 0.55,
    });
    expect(briefs[0].trendSummary).toContain('Strong uptrend');
    expect(briefs[0].trendSummary).toContain('RS vs SPY rising');
    expect(briefs[0].momentumSummary).toContain('RSI healthy');
    expect(briefs[0].momentumSummary).toContain('MACD expanding');
    expect(briefs[0].momentumSummary).toContain('Volume 1.8x avg');
  });
});

describe('buildBenchBriefs — degraded data paths', () => {
  it('emits a degraded stock brief when priceMap entry is missing', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);

    expect(briefs).toHaveLength(1);
    expect(briefs[0]).toMatchObject({
      symbol: 'AMD',
      assetClass: 'stock',
      price: null,
      changePercent: null,
      technicalScore: null,
      technicalRank: null,
      rsPercentile: null,
      atrPercent: null,
      sector: 'Technology',
      cooldownUntil: null,
      cooldownActive: false,
    });
    expect(briefs[0]).not.toHaveProperty('trendSummary');
    expect(briefs[0]).not.toHaveProperty('momentumSummary');
  });

  it('emits a degraded crypto brief with assetClass: crypto and sector: Crypto', () => {
    const portfolio = { bench: { stocks: [], crypto: CRYPTO_BTC } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);

    expect(briefs).toHaveLength(1);
    expect(briefs[0]).toMatchObject({
      symbol: 'BTC-USD',
      assetClass: 'crypto',
      sector: 'Crypto',
      price: null,
      changePercent: null,
      cooldownActive: false,
    });
    expect(briefs[0]).not.toHaveProperty('trendSummary');
    expect(briefs[0]).not.toHaveProperty('momentumSummary');
  });

  it('falls back to sector "Crypto" for crypto missing the field', () => {
    const cryptoNoSector = { symbol: 'ETH-USD', name: 'Ethereum', baseATR: 5.0, isCrypto: true };
    const portfolio = { bench: { stocks: [], crypto: cryptoNoSector } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);
    expect(briefs[0].sector).toBe('Crypto');
  });

  it('falls back to sector "Unknown" for stock missing the field', () => {
    const stockNoSector = { symbol: 'XYZ', name: 'Xyz', baseATR: 3.0, isCrypto: false };
    const portfolio = { bench: { stocks: [stockNoSector], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);
    expect(briefs[0].sector).toBe('Unknown');
  });
});

describe('buildBenchBriefs — cooldown handling', () => {
  it('cooldownActive: true when cooldownUntil is in the future', () => {
    const future = new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000).toISOString();
    const stock = { ...STOCK_AMD, cooldownUntil: future };
    const portfolio = { bench: { stocks: [stock], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);

    expect(briefs[0].cooldownUntil).toBe(future);
    expect(briefs[0].cooldownActive).toBe(true);
  });

  it('cooldownActive: false when cooldownUntil is in the past', () => {
    const past = new Date(FROZEN_NOW.getTime() - 60 * 60 * 1000).toISOString();
    const stock = { ...STOCK_AMD, cooldownUntil: past };
    const portfolio = { bench: { stocks: [stock], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);

    expect(briefs[0].cooldownUntil).toBe(past);
    expect(briefs[0].cooldownActive).toBe(false);
  });

  it('cooldownActive: false when cooldownUntil is null/missing', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);
    expect(briefs[0].cooldownUntil).toBeNull();
    expect(briefs[0].cooldownActive).toBe(false);
  });
});

describe('buildBenchBriefs — multi-position + ordering', () => {
  it('emits stocks first, then crypto, in input order', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD, STOCK_PLTR], crypto: CRYPTO_BTC } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);
    expect(briefs.map(b => b.symbol)).toEqual(['AMD', 'PLTR', 'BTC-USD']);
    expect(briefs.map(b => b.assetClass)).toEqual(['stock', 'stock', 'crypto']);
  });

  it('skips bench entries without a symbol', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD, null, { name: 'noSymbol' }], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);
    expect(briefs).toHaveLength(1);
    expect(briefs[0].symbol).toBe('AMD');
  });
});

describe('buildBenchBriefs — partial techScore data', () => {
  it('omits trendSummary when factors lack SMA flags', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const priceMap = { AMD: fullPrice(150, 1) };
    const techScoresMap = { AMD: { technicalScore: 60, factors: { rsPercentile: 60 } } };
    const briefs = buildBenchBriefs(portfolio, priceMap, {}, techScoresMap, FROZEN_NOW);
    expect(briefs[0]).not.toHaveProperty('trendSummary');
  });

  it('emits momentumSummary even when only one of rsi/macd/volume is present', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const priceMap = { AMD: fullPrice(150, 1) };
    const techScoresMap = { AMD: { volumeConfirmation: 9, factors: {} } };
    const briefs = buildBenchBriefs(portfolio, priceMap, {}, techScoresMap, FROZEN_NOW);
    expect(briefs[0].momentumSummary).toContain('Volume confirming');
  });
});
