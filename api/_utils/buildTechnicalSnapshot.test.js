// api/_utils/buildTechnicalSnapshot.test.js
// Phase 4 — unit tests for the technical snapshot builder.

import { describe, it, expect } from 'vitest';
import { buildTechnicalSnapshot } from './buildTechnicalSnapshot.js';

function makeRanking(overrides = {}) {
  return {
    symbol: 'MU',
    sectorName: 'Technology',
    trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'up' },
    momentum: { divergence: 'none' },
    levels: {
      nearestSupport: 173.75,
      nearestResistance: 182.92,
      distanceToSupportPct: -2.94,
      distanceToResistancePct: 2.18,
    },
    pivots: { r1: 180.5, s1: 175.2 },
    recentAction: { lastCandlePattern: 'doji' },
    sma200_position: -24.22,
    bBandwidthPercentile: 26,
    nr7Flag: false,
    dailyRange: 3.25,
    technicalScore: 78,
    technicalRank: 23,
    sectorTechnicalRank: 26,
    sectorTechnicalTotal: 28,
    ...overrides,
  };
}

function makeTechScores(overrides = {}) {
  return {
    bbPercentB: 0.65,
    bbUpper: 200.17,
    bbLower: 171.29,
    atrPercent: 3.59,
    volumeProfile: { avgVolume: 5094215, ratio: 1.0, tier: 'NORMAL' },
    factors: {
      rsi: 58,
      macdAboveSignal: true,
      macdFreshBullishCross: false,
      macdFreshBearishCross: false,
      macdHistogram: 0.123,
      upDayVolRatio: 1.1,
      aboveSMA20: false,
      aboveSMA50: true,
      aboveSMA200: true,
      distTo52wkHigh: -5.4,
      rsPercentile: 72,
      sectorRSPercentile: 85,
    },
    ...overrides,
  };
}

function makeMomentumData(symbol = 'MU', vwapEntry = null) {
  const entry = vwapEntry === null
    ? { vwap: 433.57, currentPrice: 640.20, vwapDeviation: 47.66, sma20_5m: 641.22 }
    : vwapEntry;
  return {
    vwap: entry === undefined ? {} : { [symbol]: entry },
    rankingsMap: {},
    techScoresMap: {},
  };
}

describe('buildTechnicalSnapshot', () => {
  it('returns a fully populated snapshot when all maps have data for the symbol', () => {
    const symbol = 'MU';
    const snap = buildTechnicalSnapshot(symbol, {
      momentumData: makeMomentumData(symbol),
      technicalScoresMap: { [symbol]: makeTechScores() },
      rankingsMap: { [symbol]: makeRanking() },
    });

    expect(snap.symbol).toBe('MU');
    expect(snap.sectorName).toBe('Technology');

    expect(snap.trend).toEqual({ shortTerm: 'up', intermediate: 'up', longTerm: 'up' });

    expect(snap.momentum).toEqual({
      rsi: 58,
      macdAboveSignal: true,
      macdFreshBullishCross: false,
      macdFreshBearishCross: false,
      macdHistogram: 0.123,
      divergence: 'none',
      upDayVolRatio: 1.1,
    });

    expect(snap.volatility).toEqual({
      bbPercentB: 0.65,
      bbUpper: 200.17,
      bbLower: 171.29,
      bBandwidthPercentile: 26,
      atrPercent: 3.59,
    });

    expect(snap.volume).toEqual({
      avgVolume: 5094215,
      ratio: 1.0,
      tier: 'NORMAL',
      nr7Flag: false,
      dailyRange: 3.25,
    });

    expect(snap.smaStack).toEqual({
      aboveSMA20: false,
      aboveSMA50: true,
      aboveSMA200: true,
      sma200_position: -24.22,
      distTo52wkHigh: -5.4,
    });

    expect(snap.rs).toEqual({ rsPercentile: 72, sectorRSPercentile: 85 });

    expect(snap.levels).toEqual({
      nearestSupport: 173.75,
      nearestResistance: 182.92,
      distanceToSupportPct: -2.94,
      distanceToResistancePct: 2.18,
    });

    expect(snap.pivots).toEqual({ r1: 180.5, s1: 175.2 });
    expect(snap.recentAction).toEqual({ lastCandlePattern: 'doji' });

    expect(snap.intraday).toEqual({
      vwap: 433.57,
      currentPrice: 640.20,
      vwapDeviation: 47.66,
      sma20_5m: 641.22,
    });

    expect(snap.composite).toEqual({
      technicalScore: 78,
      technicalRank: 23,
      sectorTechnicalRank: 26,
      sectorTechnicalTotal: 28,
    });
  });

  it('null-fills intraday for bench symbols (no Phase 3 data)', () => {
    const symbol = 'AMD';
    const snap = buildTechnicalSnapshot(symbol, {
      momentumData: { vwap: {} }, // empty — bench symbols don't get intraday
      technicalScoresMap: { [symbol]: makeTechScores() },
      rankingsMap: { [symbol]: makeRanking({ symbol: 'AMD' }) },
    });

    expect(snap.intraday).toEqual({
      vwap: null,
      currentPrice: null,
      vwapDeviation: null,
      sma20_5m: null,
    });

    // Other fields remain populated
    expect(snap.momentum.rsi).toBe(58);
    expect(snap.trend.shortTerm).toBe('up');
    expect(snap.composite.technicalScore).toBe(78);
  });

  it('returns a sparse snapshot when symbol is absent from every map', () => {
    const snap = buildTechnicalSnapshot('GHOST', {
      momentumData: { vwap: {} },
      technicalScoresMap: {},
      rankingsMap: {},
    });

    expect(snap.symbol).toBe('GHOST');
    expect(snap.sectorName).toBeNull();
    expect(typeof snap.capturedAt).toBe('string');

    // Every sub-object must still be present, with all null leaves
    expect(snap.trend).toEqual({ shortTerm: null, intermediate: null, longTerm: null });
    expect(snap.momentum).toEqual({
      rsi: null, macdAboveSignal: null, macdFreshBullishCross: null,
      macdFreshBearishCross: null, macdHistogram: null, divergence: null, upDayVolRatio: null,
    });
    expect(snap.volatility).toEqual({
      bbPercentB: null, bbUpper: null, bbLower: null,
      bBandwidthPercentile: null, atrPercent: null,
    });
    expect(snap.volume).toEqual({
      avgVolume: null, ratio: null, tier: null, nr7Flag: null, dailyRange: null,
    });
    expect(snap.smaStack).toEqual({
      aboveSMA20: null, aboveSMA50: null, aboveSMA200: null,
      sma200_position: null, distTo52wkHigh: null,
    });
    expect(snap.rs).toEqual({ rsPercentile: null, sectorRSPercentile: null });
    expect(snap.levels).toEqual({
      nearestSupport: null, nearestResistance: null,
      distanceToSupportPct: null, distanceToResistancePct: null,
    });
    expect(snap.pivots).toBeNull();
    expect(snap.recentAction).toEqual({ lastCandlePattern: null });
    expect(snap.intraday).toEqual({
      vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null,
    });
    expect(snap.composite).toEqual({
      technicalScore: null, technicalRank: null,
      sectorTechnicalRank: null, sectorTechnicalTotal: null,
    });
  });

  it('null-fills tech-derived fields when only rankings are present', () => {
    const symbol = 'NVDA';
    const snap = buildTechnicalSnapshot(symbol, {
      momentumData: { vwap: {} },
      technicalScoresMap: {}, // empty
      rankingsMap: { [symbol]: makeRanking({ symbol: 'NVDA', sectorName: 'Semiconductors' }) },
    });

    // Ranking-derived fields populated
    expect(snap.sectorName).toBe('Semiconductors');
    expect(snap.trend.shortTerm).toBe('up');
    expect(snap.levels.nearestSupport).toBe(173.75);
    expect(snap.composite.technicalScore).toBe(78);
    expect(snap.smaStack.sma200_position).toBe(-24.22);

    // Tech-derived fields null
    expect(snap.momentum.rsi).toBeNull();
    expect(snap.momentum.macdAboveSignal).toBeNull();
    expect(snap.volatility.bbPercentB).toBeNull();
    expect(snap.volatility.atrPercent).toBeNull();
    expect(snap.volume.avgVolume).toBeNull();
    expect(snap.volume.tier).toBeNull();
    expect(snap.smaStack.aboveSMA20).toBeNull();
    expect(snap.rs.rsPercentile).toBeNull();
  });

  it('sets capturedAt to a fresh ISO timestamp', () => {
    const before = Date.now();
    const snap = buildTechnicalSnapshot('SPY', {
      momentumData: { vwap: {} }, technicalScoresMap: {}, rankingsMap: {},
    });
    const after = Date.now();

    const parsed = Date.parse(snap.capturedAt);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
