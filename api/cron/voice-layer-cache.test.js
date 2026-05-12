// api/cron/voice-layer-cache.test.js
// Tier 0 Item 1: bench data exposure — buildBenchBriefs unit tests.

import { describe, it, expect } from 'vitest';
import { buildBenchBriefs, buildMarketContextBlock, buildPortfolioBriefs, buildScoutAlerts } from './voice-layer-cache.js';

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

// ==================== MARKET CONTEXT BLOCK — SECTOR RS PASS-THROUGH ====================

// Tier 0 Item 5: pass-through tests for the four new sector-RS classifier signals
// surfaced from the indexIntelligence/marketContext Firestore doc into the cache.

function fullMarketContextDoc(overrides = {}) {
  return {
    regime: 'bull',
    regimeDetail: 'SPY above 50-day MA and 50-day above 200-day MA. Strong uptrend.',
    spy: { price: 580.5, change: 2.34, changePercent: 0.41 },
    qqq: { price: 510.2, change: 4.1, changePercent: 0.81 },
    dia: { price: 440.0, change: 0.5, changePercent: 0.11 },
    iwm: { price: 220.3, change: -0.8, changePercent: -0.36 },
    leadership: 'tech_leads',
    divergence: { active: true, type: 'rotation', detail: 'QQQ +0.81% vs IWM -0.36% — rotation into tech.' },
    breadthQuality: {
      spyVsRsp: 0.6,
      signal: 'narrow_leadership',
      detail: 'SPY +0.41% but RSP -0.19% — rally driven by mega-caps.',
    },
    yields: { tnx: 4.25, tnxChange: 0.02, regime: 'neutral', detail: '10Y at 4.25%, +0.02bps — neutral zone.' },
    breadthComposite: 60,
    breadthTier: 'moderate',
    volatilityRegime: 'normal',
    topSectorToday: 'Technology',
    topSectorChange: 1.49,
    worstSectorToday: 'Energy',
    worstSectorChange: -1.34,
    ...overrides,
  };
}

describe('buildMarketContextBlock — sector RS pass-through', () => {
  it('passes through all four new sector-RS fields from a complete Firestore doc', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc());
    expect(out.leadershipSignal).toBe('tech_leads');
    expect(out.divergenceSignal).toBe('rotation');
    expect(out.breadthQualitySignal).toBe('narrow_leadership');
    expect(out.breadthSpyVsRspGap).toBe(0.6);
  });

  it('defaults leadershipSignal to "mixed" when mc.leadership is missing', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({ leadership: undefined }));
    expect(out.leadershipSignal).toBe('mixed');
  });

  it('defaults divergenceSignal to "none" when mc.divergence is missing', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({ divergence: undefined }));
    expect(out.divergenceSignal).toBe('none');
  });

  it('defaults divergenceSignal to "none" when mc.divergence.type is missing', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({ divergence: { active: false } }));
    expect(out.divergenceSignal).toBe('none');
  });

  it('breadthQualitySignal is null when mc.breadthQuality.signal is missing', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({
      breadthQuality: { spyVsRsp: 0.3, detail: 'foo' },
    }));
    expect(out.breadthQualitySignal).toBeNull();
  });

  it('breadthSpyVsRspGap is null when mc.breadthQuality.spyVsRsp is missing', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({
      breadthQuality: { signal: 'broad_participation', detail: 'foo' },
    }));
    expect(out.breadthSpyVsRspGap).toBeNull();
  });

  it('breadthSpyVsRspGap is null when mc.breadthQuality.spyVsRsp is non-numeric', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({
      breadthQuality: { spyVsRsp: 'oops', signal: 'narrow_leadership', detail: '' },
    }));
    expect(out.breadthSpyVsRspGap).toBeNull();
  });

  it('preserves breadthSpyVsRspGap of 0 (does not coerce zero to null)', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc({
      breadthQuality: { spyVsRsp: 0, signal: 'broad_participation', detail: '' },
    }));
    expect(out.breadthSpyVsRspGap).toBe(0);
  });

  it('returns the four new fields with safe defaults when mc is null', () => {
    const out = buildMarketContextBlock(null);
    expect(out.leadershipSignal).toBe('mixed');
    expect(out.divergenceSignal).toBe('none');
    expect(out.breadthQualitySignal).toBeNull();
    expect(out.breadthSpyVsRspGap).toBeNull();
  });

  it('regression guard: existing 12 fields produce expected output for a complete doc', () => {
    const out = buildMarketContextBlock(fullMarketContextDoc());
    expect(out.regime).toBe('bull');
    expect(out.regimeDetail).toContain('Strong uptrend');
    expect(out.spyChange).toBe(0.41);
    expect(out.vixLevel).toBeNull();
    expect(out.volatilityRegime).toBe('normal');
    expect(out.breadthTier).toBe('moderate');
    expect(out.breadthDetail).toContain('mega-caps');
    expect(out.topSector).toBe('Technology');
    expect(out.topSectorChange).toBe(1.49);
    expect(out.worstSector).toBe('Energy');
    expect(out.worstSectorChange).toBe(-1.34);
    expect(out.yieldRegime).toBe('neutral');
  });

  it('regression guard: null mc still emits the existing default field set', () => {
    const out = buildMarketContextBlock(null);
    expect(out.regime).toBe('unknown');
    expect(out.regimeDetail).toBe('Market context unavailable');
    expect(out.spyChange).toBeNull();
    expect(out.breadthTier).toBe('unknown');
    expect(out.topSector).toBe('N/A');
    expect(out.yieldRegime).toBe('unknown');
  });
});

// ==================== PORTFOLIO BRIEFS — THRESHOLD PROXIMITY (Tier 0 Item 4) ====================

// `buildPortfolioBriefs` attaches a quantitative `thresholdProximity` sub-field
// and an `existingBadges` sibling to each active position, derived from the
// ported detectRedZone / isSwapLocked / getBadgesFromHistoryServer helpers.
// `thresholdProximity` is omitted (graceful degradation) on missing baseATR.
// `existingBadges` is always emitted (defaults to []).

function activeStock({ symbol = 'AAPL', baseATR = 2.5, swapPrice = null, direction = 'long' } = {}) {
  const stock = { symbol, name: symbol, baseATR, isCrypto: false, sector: 'Technology', direction };
  if (swapPrice != null) stock.swapPrice = swapPrice;
  return stock;
}

function activePortfolio(stock) {
  return { star: [stock], core: [], support: [] };
}

function priceFromMultiplier(multiplier, baseATR) {
  // Reverse-engineer change_p from multiplier so detectRedZone/isSwapLocked see
  // the requested input. close is arbitrary — change_p (= thresholdPriceChange)
  // drives the canonical formula.
  const change_p = multiplier * baseATR;
  return {
    close: 100,
    previousClose: 100 / (1 + change_p / 100),
    change: change_p,
    change_p,
    volume: 1_000_000,
    open: 99.5,
    high: 100.3,
    low: 99.7,
    timestamp: 0,
  };
}

describe('buildPortfolioBriefs — threshold proximity (Tier 0 Item 4)', () => {
  it('emits thresholdProximity with redZone: null and swapLock unlocked when far from any threshold', () => {
    const stock = activeStock({ symbol: 'AAPL', baseATR: 2.5 });
    const priceMap = { AAPL: priceFromMultiplier(0.5, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs).toHaveLength(1);
    const tp = briefs[0].thresholdProximity;
    expect(tp).toBeDefined();
    expect(tp.currentMultiplier).toBeCloseTo(0.5, 5);
    expect(tp.baseATR).toBe(2.5);
    expect(tp.redZone).toBeNull();
    expect(tp.swapLock).toEqual({ locked: false, direction: null, distancePercent: null, message: null });
    expect(briefs[0].existingBadges).toEqual([]);
  });

  it('detects upside red zone when multiplier is in the 25% band before bagger', () => {
    const stock = activeStock({ symbol: 'NVDA', baseATR: 2.0 });
    const priceMap = { NVDA: priceFromMultiplier(0.85, 2.0) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    const tp = briefs[0].thresholdProximity;
    expect(tp.redZone).not.toBeNull();
    expect(tp.redZone.targetThreshold).toBe('bagger');
    expect(tp.redZone.targetMultiple).toBe(1.0);
    expect(tp.redZone.direction).toBe('positive');
    // zone is [0.75, 1.0]; progress = (0.85 - 0.75) / 0.25 * 100 = 40
    expect(tp.redZone.zoneProgressPercent).toBe(40);
  });

  it('detects swap-lock when multiplier is within 0.5pp of a threshold', () => {
    const stock = activeStock({ symbol: 'TSLA', baseATR: 2.5 });
    const priceMap = { TSLA: priceFromMultiplier(0.95, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    const tp = briefs[0].thresholdProximity;
    expect(tp.swapLock.locked).toBe(true);
    expect(tp.swapLock.direction).toBe('positive');
    // distPct = (1.0 - 0.95) * 2.5 = 0.125
    expect(tp.swapLock.distancePercent).toBeCloseTo(0.125, 5);
    expect(tp.swapLock.message).toBe('approaching BaggerBomb');
  });

  it('redirects target to next uncrossed threshold when an earlier badge is already earned', () => {
    const stock = activeStock({ symbol: 'AMD', baseATR: 2.0 });
    // multiplier 1.20: bagger (1.0) already earned → look at doubleBagger (1.5)
    // doubleBagger zone = [1.125, 1.5], progress = (1.20 - 1.125) / 0.375 * 100 = 20
    const priceMap = { AMD: priceFromMultiplier(1.20, 2.0) };
    const thresholdHistory = { AMD: { maxMultiplier: 1.05, minMultiplier: 0 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, thresholdHistory, {});

    expect(briefs[0].existingBadges).toEqual(['bagger']);
    const tp = briefs[0].thresholdProximity;
    expect(tp.redZone).not.toBeNull();
    expect(tp.redZone.targetThreshold).toBe('doubleBagger');
    expect(tp.redZone.targetMultiple).toBe(1.5);
    expect(tp.redZone.zoneProgressPercent).toBe(20);
  });

  it('detects downside red zone with direction: negative for negative multiplier', () => {
    const stock = activeStock({ symbol: 'GME', baseATR: 4.0 });
    const priceMap = { GME: priceFromMultiplier(-0.85, 4.0) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    const tp = briefs[0].thresholdProximity;
    expect(tp.redZone).not.toBeNull();
    expect(tp.redZone.targetThreshold).toBe('bust');
    expect(tp.redZone.targetMultiple).toBe(-1.0);
    expect(tp.redZone.direction).toBe('negative');
  });

  it('omits thresholdProximity entirely when baseATR is missing (graceful degradation)', () => {
    // Build the stock manually so baseATR is genuinely absent (the activeStock
    // helper's destructuring default would otherwise replace undefined with 2.5).
    const stock = { symbol: 'XYZ', name: 'XYZ', isCrypto: false, sector: 'Technology', direction: 'long' };
    const priceMap = { XYZ: priceFromMultiplier(0.85, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs).toHaveLength(1);
    expect(briefs[0]).not.toHaveProperty('thresholdProximity');
    // existingBadges always emitted
    expect(briefs[0].existingBadges).toEqual([]);
  });

  it('omits thresholdProximity when baseATR is 0', () => {
    const stock = activeStock({ symbol: 'XYZ', baseATR: 0 });
    const priceMap = { XYZ: priceFromMultiplier(0.85, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0]).not.toHaveProperty('thresholdProximity');
    expect(briefs[0].existingBadges).toEqual([]);
  });

  it('omits thresholdProximity when both change_p and entryPrice are unavailable', () => {
    const stock = activeStock({ symbol: 'XYZ', baseATR: 2.5 });
    // No change_p, no swapPrice, no startingPrices entry
    const priceMap = { XYZ: { close: 100, previousClose: 100, change_p: null, change: 0, volume: 0, open: 100, high: 100, low: 100, timestamp: 0 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0]).not.toHaveProperty('thresholdProximity');
    expect(briefs[0].existingBadges).toEqual([]);
  });

  it('falls back to entry-price-based multiplier when change_p is unavailable', () => {
    const stock = activeStock({ symbol: 'XYZ', baseATR: 2.5, swapPrice: 50 });
    // close=53.125, swapPrice=50 → change=6.25%, mult=6.25/2.5=2.5 (past tenBagger)
    // No badges yet, all thresholds < 2.5 → no nextPositive → redZone null
    const priceMap = { XYZ: { close: 53.125, previousClose: 53.125, change_p: null, change: 0, volume: 0, open: 50, high: 53.125, low: 50, timestamp: 0 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0]).toHaveProperty('thresholdProximity');
    expect(briefs[0].thresholdProximity.currentMultiplier).toBeCloseTo(2.5, 5);
    expect(briefs[0].thresholdProximity.redZone).toBeNull();
  });

  it('derives existingBadges from thresholdHistory entries', () => {
    const stock = activeStock({ symbol: 'COIN', baseATR: 5.0 });
    const priceMap = { COIN: priceFromMultiplier(0.0, 5.0) };
    const thresholdHistory = { COIN: { maxMultiplier: 1.6, minMultiplier: -1.1 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, thresholdHistory, {});

    expect(briefs[0].existingBadges).toEqual(expect.arrayContaining(['bagger', 'doubleBagger', 'bust']));
    expect(briefs[0].existingBadges).not.toContain('tenBagger');
    expect(briefs[0].existingBadges).not.toContain('crash');
  });

  it('negates the multiplier for short positions (canonical short-handling parity)', () => {
    const stock = activeStock({ symbol: 'SHRT', baseATR: 2.0, direction: 'short' });
    // Short position: a -1.7% price move is favorable. priceFromMultiplier(-0.85, 2.0)
    // sets change_p = -1.7. Internal raw multiplier = -1.7 / 2.0 = -0.85. The short
    // negation flips the sign → effective currentMultiplier = +0.85, which lands
    // inside the upside red zone toward bagger.
    const priceMap = { SHRT: priceFromMultiplier(-0.85, 2.0) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    const tp = briefs[0].thresholdProximity;
    expect(tp.currentMultiplier).toBeCloseTo(0.85, 5);
    expect(tp.redZone).not.toBeNull();
    expect(tp.redZone.targetThreshold).toBe('bagger');
    expect(tp.redZone.direction).toBe('positive');
  });

  it('regression guard: existing portfolioBriefs fields (tier, price, trendSummary, thresholdNote) are preserved', () => {
    const stock = activeStock({ symbol: 'AAPL', baseATR: 2.5 });
    const priceMap = { AAPL: priceFromMultiplier(0.5, 2.5) };
    const rankingsMap = { AAPL: { technicalScore: 75, technicalRank: 12, atrPercentile: 0.8 } };
    const techScoresMap = { AAPL: {
      technicalScore: 75,
      rsiContext: 8,
      macdScore: 9,
      volumeConfirmation: 9,
      factors: { aboveSMA200: true, aboveSMA50: true, aboveSMA20: true, rsPercentile: 80, upDayVolRatio: 1.8 },
    } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, techScoresMap, {}, {});

    expect(briefs[0].symbol).toBe('AAPL');
    expect(briefs[0].tier).toBe('star');
    expect(briefs[0].technicalScore).toBe(75);
    expect(briefs[0].thresholdNote).toBe('High ATR — volatile, could hit thresholds quickly');
    expect(briefs[0].trendSummary).toContain('Strong uptrend');
    // New fields coexist with old
    expect(briefs[0]).toHaveProperty('thresholdProximity');
    expect(briefs[0]).toHaveProperty('existingBadges');
    // Phase 3 sibling: always emitted (null when omitted by caller)
    expect(briefs[0]).toHaveProperty('intraday');
    expect(briefs[0].intraday).toBeNull();
  });
});

// ==================== PORTFOLIO BRIEFS — INTRADAY MOMENTUM (Phase 3) ====================

// `buildPortfolioBriefs` accepts an optional 7th positional parameter
// `intradayMomentumMap` that overlays per-symbol VWAP / 5m-SMA20 onto each
// brief as `brief.intraday`. The map is sourced from the eval cron's
// `cronState.intradayMomentum` write (see agent-evaluate.test.js for the
// write-side guard). Symbols absent from the map get an explicit `null` so
// downstream readers can distinguish "no data this cycle" from a malformed
// brief. The shape `{ vwap, currentPrice, vwapDeviation, sma20_5m }` is
// passed through verbatim — no transformation in the read path either.

function intradayPayload({ vwap, currentPrice, vwapDeviation, sma20_5m }) {
  return { vwap, currentPrice, vwapDeviation, sma20_5m };
}

describe('buildPortfolioBriefs — intraday momentum overlay (Phase 3)', () => {
  it('attaches brief.intraday with passthrough shape when intradayMomentumMap has the symbol', () => {
    const stock = activeStock({ symbol: 'NVDA', baseATR: 2.0 });
    const priceMap = { NVDA: priceFromMultiplier(0.4, 2.0) };
    const intradayMap = {
      NVDA: intradayPayload({ vwap: 145.50, currentPrice: 146.08, vwapDeviation: 0.40, sma20_5m: 145.92 }),
    };

    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {}, intradayMap);

    expect(briefs).toHaveLength(1);
    expect(briefs[0].intraday).toEqual({
      vwap: 145.50,
      currentPrice: 146.08,
      vwapDeviation: 0.40,
      sma20_5m: 145.92,
    });
  });

  it('sets brief.intraday to null when the symbol is absent from intradayMomentumMap', () => {
    const stock = activeStock({ symbol: 'PLTR', baseATR: 3.0 });
    const priceMap = { PLTR: priceFromMultiplier(0.2, 3.0) };
    // Map has data for a different symbol — PLTR's slot is genuinely absent.
    const intradayMap = {
      AMD: intradayPayload({ vwap: 100.0, currentPrice: 100.5, vwapDeviation: 0.5, sma20_5m: 100.2 }),
    };

    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {}, intradayMap);

    expect(briefs[0].intraday).toBeNull();
  });

  it('sets brief.intraday to null for every brief when intradayMomentumMap is empty {}', () => {
    const stock = activeStock({ symbol: 'AAPL', baseATR: 2.5 });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };

    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {}, {});

    expect(briefs[0].intraday).toBeNull();
  });

  it('sets brief.intraday to null when intradayMomentumMap is omitted (default param applies)', () => {
    // Backwards-compat path: callers that have not yet been updated to pass
    // the 7th argument should still produce well-formed briefs with
    // brief.intraday === null (not undefined, not a thrown error).
    const stock = activeStock({ symbol: 'MSFT', baseATR: 2.0 });
    const priceMap = { MSFT: priceFromMultiplier(0.1, 2.0) };

    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0]).toHaveProperty('intraday');
    expect(briefs[0].intraday).toBeNull();
  });

  it('handles a multi-position portfolio with a mix of populated and absent intraday entries', () => {
    const portfolio = {
      star: [activeStock({ symbol: 'NVDA', baseATR: 2.0 })],
      core: [activeStock({ symbol: 'AMD', baseATR: 3.0 })],
      support: [activeStock({ symbol: 'PLTR', baseATR: 4.0 })],
    };
    const priceMap = {
      NVDA: priceFromMultiplier(0.4, 2.0),
      AMD: priceFromMultiplier(0.3, 3.0),
      PLTR: priceFromMultiplier(0.2, 4.0),
    };
    // NVDA + AMD populated; PLTR's intraday computation didn't run this cycle.
    const intradayMap = {
      NVDA: intradayPayload({ vwap: 145.5, currentPrice: 146.1, vwapDeviation: 0.41, sma20_5m: 145.9 }),
      AMD: intradayPayload({ vwap: 152.0, currentPrice: 151.4, vwapDeviation: -0.39, sma20_5m: 151.7 }),
    };

    const briefs = buildPortfolioBriefs(portfolio, priceMap, {}, {}, {}, {}, intradayMap);

    expect(briefs).toHaveLength(3);
    const bySymbol = Object.fromEntries(briefs.map(b => [b.symbol, b]));
    expect(bySymbol.NVDA.intraday).toEqual(intradayMap.NVDA);
    expect(bySymbol.AMD.intraday).toEqual(intradayMap.AMD);
    expect(bySymbol.PLTR.intraday).toBeNull();
  });

  it('preserves all existing brief fields when intradayMomentumMap is provided (additive, non-mutating)', () => {
    const stock = activeStock({ symbol: 'AAPL', baseATR: 2.5 });
    const priceMap = { AAPL: priceFromMultiplier(0.5, 2.5) };
    const rankingsMap = { AAPL: { technicalScore: 75, technicalRank: 12, atrPercentile: 0.8 } };
    const techScoresMap = { AAPL: {
      technicalScore: 75,
      rsiContext: 8,
      macdScore: 9,
      volumeConfirmation: 9,
      factors: { aboveSMA200: true, aboveSMA50: true, aboveSMA20: true, rsPercentile: 80, upDayVolRatio: 1.8 },
    } };
    const intradayMap = {
      AAPL: intradayPayload({ vwap: 200.0, currentPrice: 201.0, vwapDeviation: 0.5, sma20_5m: 200.5 }),
    };

    const briefs = buildPortfolioBriefs(
      activePortfolio(stock), priceMap, rankingsMap, techScoresMap, {}, {}, intradayMap,
    );

    expect(briefs[0].symbol).toBe('AAPL');
    expect(briefs[0].tier).toBe('star');
    expect(briefs[0].technicalScore).toBe(75);
    expect(briefs[0].thresholdNote).toBe('High ATR — volatile, could hit thresholds quickly');
    expect(briefs[0].trendSummary).toContain('Strong uptrend');
    expect(briefs[0]).toHaveProperty('thresholdProximity');
    expect(briefs[0]).toHaveProperty('existingBadges');
    expect(briefs[0].intraday).toEqual(intradayMap.AAPL);
  });

  it('handles crypto in active tier when intraday data is present (fetchIntradayBatch routes via formatEODHDSymbol)', () => {
    // CRYPTO BEHAVIOUR: fetchIntradayBatch in marketDataCache.js detects
    // crypto via isCryptoSymbol and routes to the `-USD.CC` EODHD endpoint.
    // If a battle places crypto in an active tier (rare but possible),
    // momentumData.vwap[BTC] will be populated and brief.intraday flows
    // through normally. Bench crypto is handled by buildBenchBriefs and is
    // outside this test's scope.
    const cryptoActive = { symbol: 'BTC', name: 'Bitcoin', baseATR: 5.0, isCrypto: true, sector: 'Crypto', direction: 'long' };
    const priceMap = { BTC: priceFromMultiplier(0.3, 5.0) };
    const intradayMap = {
      BTC: intradayPayload({ vwap: 67500.0, currentPrice: 67700.0, vwapDeviation: 0.30, sma20_5m: 67620.0 }),
    };

    const briefs = buildPortfolioBriefs(activePortfolio(cryptoActive), priceMap, {}, {}, {}, {}, intradayMap);

    expect(briefs[0].symbol).toBe('BTC');
    expect(briefs[0].intraday).toEqual(intradayMap.BTC);
  });

  it('handles crypto in active tier when intraday data is absent (graceful null, no throw)', () => {
    // If crypto intraday fetch fails (EODHD outage, unsupported symbol, etc.),
    // momentumData.vwap[BTC] never gets populated and the symbol is absent
    // from the persisted map. The read path must produce a well-formed brief
    // with intraday: null — not throw.
    const cryptoActive = { symbol: 'BTC', name: 'Bitcoin', baseATR: 5.0, isCrypto: true, sector: 'Crypto', direction: 'long' };
    const priceMap = { BTC: priceFromMultiplier(0.3, 5.0) };

    expect(() => {
      const briefs = buildPortfolioBriefs(activePortfolio(cryptoActive), priceMap, {}, {}, {}, {}, {});
      expect(briefs[0].symbol).toBe('BTC');
      expect(briefs[0].intraday).toBeNull();
    }).not.toThrow();
  });
});

// ==================== F3.1 — SENTINEL-ZERO CLEANUP ====================

// Portfolio and bench writers must agree on the missing-data sentinel.
// Cron writes explicit null for missing technicalScore / atrPercent so
// renderers can distinguish "no data" from legitimate bottom-decile values.

describe('buildPortfolioBriefs — null sentinel for missing technicalScore / atrPercent (F3.1)', () => {
  it('writes null technicalScore when both ranking and techScore are missing', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs).toHaveLength(1);
    expect(briefs[0].technicalScore).toBeNull();
  });

  it('writes null atrPercent when ranking lacks atrPercentile', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0].atrPercent).toBeNull();
  });

  it('preserves legitimate technicalScore: 0 (does not coerce to null)', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { technicalScore: 0, technicalRank: 500, atrPercentile: 0.55 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].technicalScore).toBe(0);
  });

  it('preserves legitimate atrPercentile: 0 (rounded to atrPercent: 0, not null)', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { technicalScore: 50, technicalRank: 100, atrPercentile: 0 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].atrPercent).toBe(0);
  });

  it('matches bench-brief writer convention: same input → same null vs value output', () => {
    // Active (portfolio) brief with missing data
    const activeStockObj = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const portfolioBriefs = buildPortfolioBriefs(activePortfolio(activeStockObj), priceMap, {}, {}, {}, {});

    // Bench brief with the same shape — also missing data
    const benchStock = { symbol: 'AAPL', name: 'Apple', baseATR: 2.5, isCrypto: false, sector: 'Technology' };
    const benchPortfolio = { bench: { stocks: [benchStock], crypto: null } };
    const benchBriefs = buildBenchBriefs(benchPortfolio, priceMap, {}, {}, FROZEN_NOW);

    expect(portfolioBriefs[0].technicalScore).toBeNull();
    expect(benchBriefs[0].technicalScore).toBeNull();
    expect(portfolioBriefs[0].atrPercent).toBeNull();
    expect(benchBriefs[0].atrPercent).toBeNull();
  });

  it('does not emit thresholdNote when atrPercentile is null', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0].thresholdNote).toBeNull();
  });
});

describe('buildScoutAlerts — null-safe technicalScore predicate (F3.1)', () => {
  function watchlist(symbols) {
    return { active: symbols.map(s => ({ symbol: s })) };
  }

  it('excludes a watchlist symbol from rs_breakout when technicalScore is null', () => {
    const techScoresMap = {
      XYZ: { factors: { rsPercentile: 90 } },
    };
    const rankingsMap = {}; // no ranking entry → technicalScore resolves to null
    const alerts = buildScoutAlerts(watchlist(['XYZ']), rankingsMap, techScoresMap, 'momentum_chaser', new Set());

    const rsAlerts = alerts.filter(a => a.type === 'rs_breakout');
    expect(rsAlerts).toHaveLength(0);
  });

  it('admits an rs_breakout when technicalScore is a legitimate number >= 75', () => {
    const techScoresMap = {
      XYZ: { factors: { rsPercentile: 90 }, volumeConfirmation: 6 },
    };
    const rankingsMap = { XYZ: { technicalScore: 82, technicalRank: 4 } };
    const alerts = buildScoutAlerts(watchlist(['XYZ']), rankingsMap, techScoresMap, 'momentum_chaser', new Set());

    const rsAlerts = alerts.filter(a => a.type === 'rs_breakout');
    expect(rsAlerts).toHaveLength(1);
    expect(rsAlerts[0].detail).toContain('Technical score 82');
  });

  it('volume_surge alert omits the "Technical score" clause when technicalScore is null', () => {
    const techScoresMap = {
      XYZ: { factors: { rsPercentile: 50 }, volumeConfirmation: 11 },
    };
    const rankingsMap = {};
    const alerts = buildScoutAlerts(watchlist(['XYZ']), rankingsMap, techScoresMap, 'all', new Set());

    const surge = alerts.find(a => a.type === 'volume_surge');
    expect(surge).toBeDefined();
    expect(surge.detail).not.toContain('Technical score');
    expect(surge.detail).not.toContain('null');
  });

  it('game_fit alert reads "ATR percentile N/A." when atrPercentile is missing', () => {
    const rankingsMap = {
      XYZ: { baggerBombFit: 90, baggerBombRank: 5, compositeScore: 75 },
    };
    const alerts = buildScoutAlerts(watchlist(['XYZ']), rankingsMap, {}, 'all', new Set());

    const fit = alerts.find(a => a.type === 'game_fit');
    expect(fit).toBeDefined();
    expect(fit.detail).toContain('ATR percentile N/A.');
  });

  it('game_fit alert shows 0% when atrPercentile is the legitimate value 0', () => {
    const rankingsMap = {
      XYZ: { baggerBombFit: 90, baggerBombRank: 5, compositeScore: 75, atrPercentile: 0 },
    };
    const alerts = buildScoutAlerts(watchlist(['XYZ']), rankingsMap, {}, 'all', new Set());

    const fit = alerts.find(a => a.type === 'game_fit');
    expect(fit).toBeDefined();
    expect(fit.detail).toContain('ATR percentile 0%.');
  });
});

// ==================== PHASE 5A FIELD PROPAGATION ====================

// The brief object literal must surface the fields that Phase 5A's
// buildLevelsLine and buildSignalsLine helpers read from. Without this
// propagation, those helpers return null for every brief in production.
// Source paths are verified against compute-index-intelligence.js:
//   - ranking.sectorName / sectorTechnicalTotal
//   - ranking.levels.{nearestSupport,nearestResistance,distance*Pct}
//   - ranking.nr7Flag (mirrored from techScore.nr7Flag)
//   - techScore.factors.{macdFreshBullishCross,macdFreshBearishCross,distTo52wkHigh}
//   - ranking.momentum.divergence
//   - ranking.recentAction.lastCandlePattern

describe('buildPortfolioBriefs — Phase 5A field propagation (signals)', () => {
  it('propagates nr7Flag from ranking', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { nr7Flag: true } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].nr7Flag).toBe(true);
  });

  it('falls back to techScore.nr7Flag when ranking lacks it', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const techScoresMap = { AAPL: { nr7Flag: true } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, techScoresMap, {}, {});

    expect(briefs[0].nr7Flag).toBe(true);
  });

  it('defaults nr7Flag to false when neither source carries the flag', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0].nr7Flag).toBe(false);
  });

  it('propagates macdFreshBullishCross from techScore.factors', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const techScoresMap = { AAPL: { factors: { macdFreshBullishCross: true } } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, techScoresMap, {}, {});

    expect(briefs[0].macdFreshBullishCross).toBe(true);
    expect(briefs[0].macdFreshBearishCross).toBe(false);
  });

  it('propagates divergence from ranking.momentum', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { momentum: { divergence: 'bullish' } } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].divergence).toBe('bullish');
  });

  it('propagates lastCandlePattern from ranking.recentAction', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { recentAction: { lastCandlePattern: 'shooting_star' } } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].lastCandlePattern).toBe('shooting_star');
  });
});

describe('buildPortfolioBriefs — Phase 5A field propagation (levels)', () => {
  it('propagates levels object from ranking', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = {
      AAPL: {
        levels: {
          nearestSupport: 95,
          nearestResistance: 105,
          distanceToSupportPct: -4.2,
          distanceToResistancePct: 5.6,
        },
      },
    };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].nearestSupport).toBe(95);
    expect(briefs[0].nearestResistance).toBe(105);
    expect(briefs[0].distanceToSupportPct).toBe(-4.2);
    expect(briefs[0].distanceToResistancePct).toBe(5.6);
  });

  it('propagates distTo52wkHigh from techScore.factors', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const techScoresMap = { AAPL: { factors: { distTo52wkHigh: -3.5 } } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, techScoresMap, {}, {});

    expect(briefs[0].distTo52wkHigh).toBe(-3.5);
  });

  it('defaults all level fields to null when sources lack them', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0].nearestSupport).toBeNull();
    expect(briefs[0].nearestResistance).toBeNull();
    expect(briefs[0].distanceToSupportPct).toBeNull();
    expect(briefs[0].distanceToResistancePct).toBeNull();
    expect(briefs[0].distTo52wkHigh).toBeNull();
  });
});

describe('buildPortfolioBriefs — Phase 5A field propagation (header sector context)', () => {
  it('propagates sectorName as brief.sector from ranking', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const rankingsMap = { AAPL: { sectorName: 'Technology', sectorTechnicalTotal: 28 } };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, rankingsMap, {}, {}, {});

    expect(briefs[0].sector).toBe('Technology');
    expect(briefs[0].sectorTechnicalTotal).toBe(28);
  });

  it('falls back to stock.sector when ranking lacks sectorName', () => {
    const stock = activeStock({ symbol: 'AAPL' });
    const priceMap = { AAPL: priceFromMultiplier(0.3, 2.5) };
    const briefs = buildPortfolioBriefs(activePortfolio(stock), priceMap, {}, {}, {}, {});

    expect(briefs[0].sector).toBe('Technology'); // from activeStock default
    expect(briefs[0].sectorTechnicalTotal).toBeNull();
  });
});

describe('buildBenchBriefs — Phase 5A field propagation', () => {
  it('propagates signals and levels onto bench briefs', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const priceMap = { AMD: fullPrice(150.5, 2.34) };
    const rankingsMap = {
      AMD: {
        ...fullRanking({ technicalScore: 72 }),
        sectorName: 'Technology',
        sectorTechnicalTotal: 28,
        nr7Flag: true,
        momentum: { divergence: 'bearish' },
        recentAction: { lastCandlePattern: 'bullish_engulfing' },
        levels: {
          nearestSupport: 145,
          nearestResistance: 155,
          distanceToSupportPct: -3.65,
          distanceToResistancePct: 2.99,
        },
      },
    };
    const techScoresMap = {
      AMD: {
        factors: {
          aboveSMA200: true,
          aboveSMA50: true,
          aboveSMA20: true,
          rsPercentile: 80,
          upDayVolRatio: 1.8,
          macdFreshBullishCross: true,
          distTo52wkHigh: -4.1,
        },
      },
    };
    const briefs = buildBenchBriefs(portfolio, priceMap, rankingsMap, techScoresMap, FROZEN_NOW);

    expect(briefs[0].nr7Flag).toBe(true);
    expect(briefs[0].macdFreshBullishCross).toBe(true);
    expect(briefs[0].macdFreshBearishCross).toBe(false);
    expect(briefs[0].divergence).toBe('bearish');
    expect(briefs[0].lastCandlePattern).toBe('bullish_engulfing');
    expect(briefs[0].nearestSupport).toBe(145);
    expect(briefs[0].nearestResistance).toBe(155);
    expect(briefs[0].distanceToSupportPct).toBeCloseTo(-3.65, 5);
    expect(briefs[0].distanceToResistancePct).toBeCloseTo(2.99, 5);
    expect(briefs[0].distTo52wkHigh).toBe(-4.1);
    expect(briefs[0].sectorTechnicalTotal).toBe(28);
  });

  it('defaults propagated fields to null/false on a degraded bench brief', () => {
    const portfolio = { bench: { stocks: [STOCK_AMD], crypto: null } };
    const briefs = buildBenchBriefs(portfolio, {}, {}, {}, FROZEN_NOW);

    expect(briefs[0].nr7Flag).toBe(false);
    expect(briefs[0].macdFreshBullishCross).toBe(false);
    expect(briefs[0].macdFreshBearishCross).toBe(false);
    expect(briefs[0].divergence).toBeNull();
    expect(briefs[0].lastCandlePattern).toBeNull();
    expect(briefs[0].nearestSupport).toBeNull();
    expect(briefs[0].nearestResistance).toBeNull();
    expect(briefs[0].distanceToSupportPct).toBeNull();
    expect(briefs[0].distanceToResistancePct).toBeNull();
    expect(briefs[0].distTo52wkHigh).toBeNull();
    expect(briefs[0].sectorTechnicalTotal).toBeNull();
  });
});
