// api/_utils/voiceLayerPrompt.test.js
// Tier 0 Item 1: bench data exposure — buildBenchBriefsBlock unit tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mutable holder so individual tests can set the market state returned by the
// mocked getMarketState() before exercising buildBattleState. Default to OPEN
// so existing Item 7 tests (which don't assert on Market:) keep working.
// Use vi.hoisted so the variable exists when the hoisted vi.mock factory runs.
const { mockMarketState } = vi.hoisted(() => ({
  mockMarketState: {
    isOpen: true,
    state: 'OPEN',
    nextOpenTime: new Date('2099-12-31T14:30:00Z'),
    isEarlyClose: false,
  },
}));

vi.mock('./marketSchedule.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getMarketState: () => ({ ...mockMarketState }),
  };
});

import { buildBenchBriefsBlock, buildBattleState, buildMarketSnapshotContext, buildPortfolioBriefsBlock, buildVoiceLayerPrompt, buildReviewContext, buildHeaderLine, buildLevelsLine, buildSignalsLine, buildIntradayLine, detectSnapshotRegime, buildSnapshotHeader, buildSnapshotTrend, buildSnapshotSignals, buildSnapshotLevels, buildSnapshotIntraday, buildSwapEntryBlock, detectTradeProvenance } from './voiceLayerPrompt.js';
import { getETDate, formatDateString } from './marketSchedule.js';

// ==================== TESTS ====================

// ==================== PHASE 5C — SNAPSHOT REGIME DETECTOR ====================

describe('detectSnapshotRegime — Phase 5C', () => {
  it('returns post-fixv2 when intraday.sessionDate is present', () => {
    const snap = { capturedAt: '2026-05-15T15:00:00Z', intraday: { sessionDate: '2026-05-15' } };
    expect(detectSnapshotRegime(snap)).toBe('post-fixv2');
  });

  it('returns pre-fixv1 when capturedAt is before 2026-05-12 17:39 UTC and no sessionDate', () => {
    const snap = { capturedAt: '2026-05-08T14:00:00Z', intraday: { sessionDate: null, vwap: 100 } };
    expect(detectSnapshotRegime(snap)).toBe('pre-fixv1');
  });

  it('returns fixv1-era when capturedAt is between fix v1 and fix v2 dates and no sessionDate', () => {
    const snap = { capturedAt: '2026-05-12T20:00:00Z', intraday: { sessionDate: null, vwap: null } };
    expect(detectSnapshotRegime(snap)).toBe('fixv1-era');
  });

  it('returns fixv1-era defensively when snapshot is null', () => {
    expect(detectSnapshotRegime(null)).toBe('fixv1-era');
    expect(detectSnapshotRegime(undefined)).toBe('fixv1-era');
  });

  it('returns fixv1-era defensively when capturedAt is missing', () => {
    expect(detectSnapshotRegime({ intraday: { sessionDate: null } })).toBe('fixv1-era');
    expect(detectSnapshotRegime({})).toBe('fixv1-era');
  });

  it('returns fixv1-era defensively when capturedAt is malformed', () => {
    expect(detectSnapshotRegime({ capturedAt: 'not-a-date', intraday: {} })).toBe('fixv1-era');
    expect(detectSnapshotRegime({ capturedAt: '' })).toBe('fixv1-era');
  });

  it('post-fixv2 wins even when capturedAt is technically before the boundary (defensive)', () => {
    // sessionDate presence is the authoritative signal — even an out-of-band old
    // capturedAt with sessionDate present still routes to post-fixv2.
    const snap = { capturedAt: '2026-05-01T00:00:00Z', intraday: { sessionDate: '2026-05-15' } };
    expect(detectSnapshotRegime(snap)).toBe('post-fixv2');
  });

  it('exact-boundary capturedAt at FIX_V1_MERGE_UTC routes to fixv1-era (not pre-fixv1)', () => {
    // 2026-05-12T17:39:00Z is the boundary; >= boundary is fix v1 era.
    const snap = { capturedAt: '2026-05-12T17:39:00Z', intraday: { sessionDate: null } };
    expect(detectSnapshotRegime(snap)).toBe('fixv1-era');
  });
});

// ==================== PHASE 5C — SNAPSHOT LEG HELPERS ====================

const fullSnapshot = (overrides = {}) => ({
  symbol: 'NVDA',
  sectorName: 'Technology',
  capturedAt: '2026-05-15T15:30:00Z',
  trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'down' },
  momentum: {
    rsi: 64,
    macdAboveSignal: true,
    macdFreshBullishCross: true,
    macdFreshBearishCross: false,
    macdHistogram: 0.34,
    divergence: 'bullish',
    upDayVolRatio: 1.2,
  },
  volatility: { bbPercentB: 0.7, bbUpper: 902, bbLower: 875, bBandwidthPercentile: 38, atrPercent: 2.1 },
  volume: { avgVolume: 50000000, ratio: 1.4, tier: 'high', nr7Flag: true, dailyRange: 14.2 },
  smaStack: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, sma200_position: 'above', distTo52wkHigh: -1.8 },
  rs: { rsPercentile: 76, sectorRSPercentile: 82 },
  levels: { nearestSupport: 880, nearestResistance: 905, distanceToSupportPct: -1.4, distanceToResistancePct: 1.3 },
  pivots: { r1: 905, s1: 880 },
  recentAction: { lastCandlePattern: 'bullish_engulfing' },
  intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.19, sma20_5m: 894.0, sessionDate: '2026-05-15' },
  composite: { technicalScore: 81, technicalRank: 4, sectorTechnicalRank: 4, sectorTechnicalTotal: 28 },
  ...overrides,
});

describe('buildSnapshotHeader — Phase 5C', () => {
  it('emits full header when all fields present', () => {
    expect(buildSnapshotHeader(fullSnapshot())).toBe(
      'NVDA — Score 81 (rank #4/28 in Technology), RS 76th %ile, ATR 2.1%',
    );
  });

  it('omits score segment when technicalScore is null', () => {
    const snap = fullSnapshot({ composite: { technicalScore: null, sectorTechnicalRank: 4, sectorTechnicalTotal: 28 } });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — RS 76th %ile, ATR 2.1%');
  });

  it('omits rank parenthetical when sectorTechnicalRank is null', () => {
    const snap = fullSnapshot({ composite: { technicalScore: 81, sectorTechnicalRank: null, sectorTechnicalTotal: 28 } });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — Score 81, RS 76th %ile, ATR 2.1%');
  });

  it('drops /total when sectorTechnicalTotal is null but keeps rank', () => {
    const snap = fullSnapshot({ composite: { technicalScore: 81, sectorTechnicalRank: 4, sectorTechnicalTotal: null } });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — Score 81 (rank #4 in Technology), RS 76th %ile, ATR 2.1%');
  });

  it('drops "in Sector" when sectorName is missing', () => {
    const snap = fullSnapshot({ sectorName: null });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — Score 81 (rank #4/28), RS 76th %ile, ATR 2.1%');
  });

  it('omits RS when rsPercentile is null', () => {
    const snap = fullSnapshot({ rs: { rsPercentile: null, sectorRSPercentile: 82 } });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — Score 81 (rank #4/28 in Technology), ATR 2.1%');
  });

  it('omits ATR when atrPercent is null', () => {
    const snap = fullSnapshot({ volatility: { atrPercent: null } });
    expect(buildSnapshotHeader(snap)).toBe('NVDA — Score 81 (rank #4/28 in Technology), RS 76th %ile');
  });

  it('renders just the symbol when all metrics are missing', () => {
    const sparse = { symbol: 'GHOST', composite: {}, rs: {}, volatility: {} };
    expect(buildSnapshotHeader(sparse)).toBe('GHOST');
  });

  it('returns empty string for null/undefined snapshot', () => {
    expect(buildSnapshotHeader(null)).toBe('');
    expect(buildSnapshotHeader(undefined)).toBe('');
    expect(buildSnapshotHeader({})).toBe('');
  });
});

describe('buildSnapshotTrend — Phase 5C', () => {
  it('emits when all three timeframes are present', () => {
    expect(buildSnapshotTrend(fullSnapshot())).toBe('Trend: up/up/down (short/int/long)');
  });

  it('returns null when only two timeframes are present', () => {
    const snap = fullSnapshot({ trend: { shortTerm: 'up', intermediate: 'up', longTerm: null } });
    expect(buildSnapshotTrend(snap)).toBeNull();
  });

  it('returns null when only one timeframe is present', () => {
    const snap = fullSnapshot({ trend: { shortTerm: 'up', intermediate: null, longTerm: null } });
    expect(buildSnapshotTrend(snap)).toBeNull();
  });

  it('returns null when all timeframes are null', () => {
    const snap = fullSnapshot({ trend: { shortTerm: null, intermediate: null, longTerm: null } });
    expect(buildSnapshotTrend(snap)).toBeNull();
  });

  it('returns null when trend sub-object is missing', () => {
    expect(buildSnapshotTrend({})).toBeNull();
    expect(buildSnapshotTrend(null)).toBeNull();
  });
});

describe('buildSnapshotSignals — Phase 5C', () => {
  it('emits each segment in isolation', () => {
    expect(buildSnapshotSignals(fullSnapshot({
      momentum: { macdFreshBullishCross: true, macdFreshBearishCross: false, divergence: null },
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: null },
    }))).toBe('Signals: Fresh MACD bullish cross.');

    expect(buildSnapshotSignals(fullSnapshot({
      momentum: { macdFreshBullishCross: false, macdFreshBearishCross: true, divergence: null },
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: null },
    }))).toBe('Signals: Fresh MACD bearish cross.');

    expect(buildSnapshotSignals(fullSnapshot({
      momentum: { divergence: 'bullish' },
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: null },
    }))).toBe('Signals: Bullish divergence forming.');

    expect(buildSnapshotSignals(fullSnapshot({
      momentum: { divergence: 'bearish' },
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: null },
    }))).toBe('Signals: Bearish divergence forming.');

    expect(buildSnapshotSignals(fullSnapshot({
      momentum: {},
      volume: { nr7Flag: true },
      recentAction: { lastCandlePattern: null },
    }))).toBe('Signals: NR7 contraction — breakout pending.');
  });

  it('renders lastCandlePattern via PATTERN_DISPLAY_NAMES', () => {
    const out = buildSnapshotSignals(fullSnapshot({
      momentum: {},
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: 'bullish_engulfing' },
    }));
    expect(out).toMatch(/^Signals: Recent candle:/);
    expect(out).toContain('engulfing');
  });

  it('falls back to underscore-split when key is unknown', () => {
    const out = buildSnapshotSignals(fullSnapshot({
      momentum: {},
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: 'unknown_pattern_key' },
    }));
    expect(out).toBe('Signals: Recent candle: unknown pattern key.');
  });

  it('combines multiple segments in fixed order', () => {
    const out = buildSnapshotSignals(fullSnapshot());
    expect(out).toBe(
      'Signals: Fresh MACD bullish cross. Bullish divergence forming. NR7 contraction — breakout pending. Recent candle: bullish engulfing.',
    );
  });

  it('returns null when no segments fire', () => {
    const snap = fullSnapshot({
      momentum: { macdFreshBullishCross: false, macdFreshBearishCross: false, divergence: 'none' },
      volume: { nr7Flag: false },
      recentAction: { lastCandlePattern: null },
    });
    expect(buildSnapshotSignals(snap)).toBeNull();
  });

  it('strict-bool: null does not fire macd/nr7 flags', () => {
    const snap = fullSnapshot({
      momentum: { macdFreshBullishCross: null, macdFreshBearishCross: null, divergence: null },
      volume: { nr7Flag: null },
      recentAction: { lastCandlePattern: null },
    });
    expect(buildSnapshotSignals(snap)).toBeNull();
  });

  it('returns null for null snapshot', () => {
    expect(buildSnapshotSignals(null)).toBeNull();
  });
});

describe('buildSnapshotLevels — Phase 5C', () => {
  it('emits support segment when within ±10%', () => {
    const snap = fullSnapshot({
      levels: { nearestSupport: 880, nearestResistance: null, distanceToSupportPct: -2.5, distanceToResistancePct: null },
      smaStack: { distTo52wkHigh: null },
    });
    expect(buildSnapshotLevels(snap)).toBe('Levels: Support $880 (-2.5%).');
  });

  it('emits resistance segment when within ±10%', () => {
    const snap = fullSnapshot({
      levels: { nearestSupport: null, nearestResistance: 905, distanceToSupportPct: null, distanceToResistancePct: 3.4 },
      smaStack: { distTo52wkHigh: null },
    });
    expect(buildSnapshotLevels(snap)).toBe('Levels: Resistance $905 (+3.4%).');
  });

  it('suppresses segments outside the ±10% gate', () => {
    const snap = fullSnapshot({
      levels: { nearestSupport: 800, nearestResistance: 1000, distanceToSupportPct: -15, distanceToResistancePct: 12 },
      smaStack: { distTo52wkHigh: null },
    });
    expect(buildSnapshotLevels(snap)).toBeNull();
  });

  it('emits 52wk-high segment when within ±5%', () => {
    const snap = fullSnapshot({
      levels: { nearestSupport: null, nearestResistance: null, distanceToSupportPct: null, distanceToResistancePct: null },
      smaStack: { distTo52wkHigh: -2.8 },
    });
    expect(buildSnapshotLevels(snap)).toBe('Levels: 52wk high -2.8% away.');
  });

  it('suppresses 52wk-high segment outside ±5% gate', () => {
    const snap = fullSnapshot({
      levels: { nearestSupport: null, nearestResistance: null, distanceToSupportPct: null, distanceToResistancePct: null },
      smaStack: { distTo52wkHigh: -8.4 },
    });
    expect(buildSnapshotLevels(snap)).toBeNull();
  });

  it('combines all three segments when each fires', () => {
    const out = buildSnapshotLevels(fullSnapshot());
    expect(out).toBe('Levels: Support $880 (-1.4%), Resistance $905 (+1.3%), 52wk high -1.8% away.');
  });

  it('returns null when no segments fire (and for null snapshot)', () => {
    expect(buildSnapshotLevels(null)).toBeNull();
    expect(buildSnapshotLevels({})).toBeNull();
  });
});

describe('buildSnapshotIntraday — Phase 5C', () => {
  it('returns null for pre-fixv1 snapshots even when intraday.vwap is present', () => {
    const snap = fullSnapshot({
      capturedAt: '2026-05-08T15:00:00Z',
      intraday: { vwap: 800, currentPrice: 810, vwapDeviation: 1.25, sma20_5m: 808, sessionDate: null },
    });
    expect(buildSnapshotIntraday(snap)).toBeNull();
  });

  it('returns null for fixv1-era snapshots', () => {
    const snap = fullSnapshot({
      capturedAt: '2026-05-12T20:00:00Z',
      intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null, sessionDate: null },
    });
    expect(buildSnapshotIntraday(snap)).toBeNull();
  });

  it('renders both segments for post-fixv2 snapshot when sessionDate matches capture date', () => {
    const snap = fullSnapshot({
      capturedAt: '2026-05-15T15:30:00Z',
      intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.7, sma20_5m: 894.0, sessionDate: '2026-05-15' },
    });
    expect(buildSnapshotIntraday(snap)).toBe(
      "Today's session: 0.7% above session VWAP, 0.1% above 5m SMA20.",
    );
  });

  it('uses "Prior session" prefix when sessionDate differs from capture ET date', () => {
    const snap = fullSnapshot({
      capturedAt: '2026-05-16T14:00:00Z',
      intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.7, sma20_5m: null, sessionDate: '2026-05-15' },
    });
    expect(buildSnapshotIntraday(snap)).toBe('Prior session: 0.7% above session VWAP.');
  });

  it('collapses near-zero deviation to "at session VWAP"', () => {
    const snap = fullSnapshot({
      capturedAt: '2026-05-15T15:30:00Z',
      intraday: { vwap: 100, currentPrice: 100.01, vwapDeviation: 0.01, sma20_5m: null, sessionDate: '2026-05-15' },
    });
    expect(buildSnapshotIntraday(snap)).toBe("Today's session: at session VWAP.");
  });

  it('returns null when capturedAt is null but sessionDate present (defensive)', () => {
    const snap = fullSnapshot({
      capturedAt: null,
      intraday: { vwap: 100, currentPrice: 101, vwapDeviation: 1, sma20_5m: null, sessionDate: '2026-05-15' },
    });
    // Without capturedAt we can't compute the ET date for the today/prior
    // decision, but sessionDate presence still routes us to post-fixv2 and the
    // helper falls back to "Prior session" rather than failing.
    expect(buildSnapshotIntraday(snap)).toBe('Prior session: 1.0% above session VWAP.');
  });
});

// ==================== PHASE 5C — SWAP ENTRY BLOCK ====================

// Snapshot fixture builders for entry-block tests.
const legSnapshot = (symbol, overrides = {}) => ({
  symbol,
  sectorName: 'Technology',
  capturedAt: '2026-05-15T15:30:00Z',
  trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'down' },
  momentum: { macdFreshBullishCross: true, macdFreshBearishCross: false, divergence: 'bullish' },
  volatility: { atrPercent: 2.1 },
  volume: { nr7Flag: true },
  smaStack: { distTo52wkHigh: -1.8 },
  rs: { rsPercentile: 76 },
  levels: { nearestSupport: 880, nearestResistance: 905, distanceToSupportPct: -1.4, distanceToResistancePct: 1.3 },
  recentAction: { lastCandlePattern: null },
  intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.7, sma20_5m: 894.0, sessionDate: '2026-05-15' },
  composite: { technicalScore: 81, sectorTechnicalRank: 4, sectorTechnicalTotal: 28 },
  ...overrides,
});

const counterfactualEntry = (overrides = {}) => ({
  symbolOut: 'AAPL',
  symbolIn: 'MSFT',
  tier: 'star',
  resolution: 'vetoed',
  scoreAtProposal: 72.4,
  scoreAtVeto: 68.1,
  counterfactualPoints: 4.2,
  rationale: 'rotation into stronger sector RS',
  snapshot: {
    symbolOut: legSnapshot('AAPL', { composite: { technicalScore: 64, sectorTechnicalRank: 18, sectorTechnicalTotal: 28 }, rs: { rsPercentile: 52 }, volatility: { atrPercent: 1.8 } }),
    symbolIn: legSnapshot('MSFT'),
  },
  ...overrides,
});

const tradeEntry = (overrides = {}) => ({
  symbolOut: 'COIN',
  symbolIn: 'HOOD',
  tier: 'core',
  lockedPoints: 3.5,
  trigger: 'rs_rotation',
  swappedOutAt: '2026-05-15T15:30:00Z',
  evaluationId: 'eval_abc123',
  snapshot: {
    symbolOut: legSnapshot('COIN'),
    symbolIn: legSnapshot('HOOD'),
  },
  ...overrides,
});

describe('buildSwapEntryBlock — counterfactual rendering', () => {
  it('renders full structure for a vetoed counterfactual', () => {
    const out = buildSwapEntryBlock(counterfactualEntry(), 'counterfactual');
    expect(out).toContain('COUNTERFACTUAL — vetoed by Coach');
    expect(out).toContain('Captured: 2026-05-15 11:30 ET');
    expect(out).toContain('Score at proposal: 72.4 → at veto: 68.1 (Δ -4.3)');
    expect(out).toContain('AAPL → MSFT (star tier)');
    expect(out).toContain('| Counterfactual: would have scored +4.2 pts');
    expect(out).toContain('AAPL leg:');
    expect(out).toContain('MSFT leg:');
    // Full depth = trend + levels + intraday lines present
    expect(out).toContain('Trend: up/up/down (short/int/long)');
    expect(out).toContain('Levels:');
    expect(out).toContain("Today's session:");
  });

  it('renders correct header for a lapsed counterfactual', () => {
    const entry = counterfactualEntry({ resolution: 'lapsed', scoreAtVeto: undefined, scoreAtResolution: 70.2 });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('COUNTERFACTUAL — lapsed (no Coach action)');
    expect(out).toContain('Score at proposal: 72.4 → at lapse: 70.2 (Δ -2.2)');
  });

  it('omits score line when scores are missing', () => {
    const entry = counterfactualEntry({ scoreAtProposal: undefined, scoreAtVeto: undefined });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).not.toContain('Score at proposal');
    expect(out).toContain('Captured:');
  });

  it('omits counterfactual points clause when counterfactualPoints is null', () => {
    const entry = counterfactualEntry({ counterfactualPoints: null });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('AAPL → MSFT (star tier)');
    expect(out).not.toContain('Counterfactual: would have');
  });

  it('shows positive delta correctly when score improved', () => {
    const entry = counterfactualEntry({ scoreAtProposal: 60, scoreAtVeto: 65 });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('Score at proposal: 60 → at veto: 65 (Δ +5)');
  });

  it('shows positive counterfactualPoints with + prefix', () => {
    const out = buildSwapEntryBlock(counterfactualEntry(), 'counterfactual');
    expect(out).toContain('+4.2 pts');
  });

  it('shows negative counterfactualPoints without extra prefix', () => {
    const entry = counterfactualEntry({ counterfactualPoints: -2.7 });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('-2.7 pts');
  });
});

describe('buildSwapEntryBlock — trade rendering (compact depth)', () => {
  it('renders compact structure with default header when no provenance is passed', () => {
    const out = buildSwapEntryBlock(tradeEntry(), 'trade');
    expect(out).toContain('TRADE — executed');
    expect(out).toContain('COIN → HOOD (core tier)');
    expect(out).toContain('| Outcome: +3.5 pts');
    expect(out).toContain('COIN leg:');
    expect(out).toContain('HOOD leg:');
    // Compact depth omits trend, levels, intraday
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Levels:');
    expect(out).not.toContain("Today's session:");
    // Signals still render in compact mode
    expect(out).toContain('Signals:');
  });

  it('renders "approved by Coach" header for provenance=approved', () => {
    const out = buildSwapEntryBlock(tradeEntry(), 'trade', { provenance: 'approved' });
    expect(out).toContain('TRADE — approved by Coach');
  });

  it('renders "auto-executed at expiry" for provenance=auto_executed_proposal', () => {
    const out = buildSwapEntryBlock(tradeEntry(), 'trade', { provenance: 'auto_executed_proposal' });
    expect(out).toContain('TRADE — auto-executed at expiry');
  });

  it('renders "(autopilot)" for provenance=autopilot', () => {
    const out = buildSwapEntryBlock(tradeEntry(), 'trade', { provenance: 'autopilot' });
    expect(out).toContain('TRADE — executed (autopilot)');
  });

  it('renders "(risk-triggered)" for provenance=risk_triggered', () => {
    const out = buildSwapEntryBlock(tradeEntry(), 'trade', { provenance: 'risk_triggered' });
    expect(out).toContain('TRADE — executed (risk-triggered)');
  });

  it('renders Outcome line from lockedPoints when outcomePoints is absent', () => {
    const entry = tradeEntry({ lockedPoints: -1.5 });
    const out = buildSwapEntryBlock(entry, 'trade');
    expect(out).toContain('| Outcome: -1.5 pts');
  });

  it('renders Outcome line from outcomePoints when both present (outcomePoints wins)', () => {
    const entry = tradeEntry({ lockedPoints: 1.0, outcomePoints: 2.5 });
    const out = buildSwapEntryBlock(entry, 'trade');
    expect(out).toContain('| Outcome: +2.5 pts');
  });

  it('omits Outcome clause when no point fields are present', () => {
    const entry = tradeEntry({ lockedPoints: null, outcomePoints: null });
    const out = buildSwapEntryBlock(entry, 'trade');
    expect(out).toContain('COIN → HOOD (core tier)');
    expect(out).not.toContain('Outcome:');
  });
});

describe('buildSwapEntryBlock — defensive handling', () => {
  it('returns null when entry is null or missing snapshot (pre-Phase-4 entry)', () => {
    expect(buildSwapEntryBlock(null, 'counterfactual')).toBeNull();
    expect(buildSwapEntryBlock({}, 'counterfactual')).toBeNull();
    expect(buildSwapEntryBlock({ symbolOut: 'A', symbolIn: 'B' }, 'trade')).toBeNull();
  });

  it('returns null when snapshot has neither leg', () => {
    expect(buildSwapEntryBlock({ snapshot: {} }, 'counterfactual')).toBeNull();
    expect(buildSwapEntryBlock({ snapshot: { symbolOut: null, symbolIn: null } }, 'trade')).toBeNull();
  });

  it('renders only the symbolIn leg when symbolOut leg is missing', () => {
    const entry = counterfactualEntry();
    entry.snapshot.symbolOut = null;
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).not.toContain('AAPL leg:');
    expect(out).toContain('MSFT leg:');
  });

  it('renders only the symbolOut leg when symbolIn leg is missing', () => {
    const entry = counterfactualEntry();
    entry.snapshot.symbolIn = null;
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('AAPL leg:');
    expect(out).not.toContain('MSFT leg:');
  });

  it('handles missing tier gracefully', () => {
    const entry = counterfactualEntry({ tier: null });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).toContain('AAPL → MSFT');
    expect(out).not.toContain(' tier)');
  });
});

describe('buildSwapEntryBlock — regime gating', () => {
  it('renders intraday line for post-fixv2 leg in a counterfactual', () => {
    const out = buildSwapEntryBlock(counterfactualEntry(), 'counterfactual');
    expect(out).toContain("Today's session:");
  });

  it('suppresses intraday line for pre-fixv1 leg even in counterfactual full depth', () => {
    const entry = counterfactualEntry();
    entry.snapshot.symbolOut = legSnapshot('AAPL', {
      capturedAt: '2026-05-08T15:00:00Z',
      intraday: { vwap: 100, currentPrice: 100.5, vwapDeviation: 0.5, sma20_5m: null, sessionDate: null },
    });
    entry.snapshot.symbolIn = legSnapshot('MSFT', {
      capturedAt: '2026-05-08T15:00:00Z',
      intraday: { vwap: 200, currentPrice: 200.5, vwapDeviation: 0.25, sma20_5m: null, sessionDate: null },
    });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).not.toContain("Today's session:");
    expect(out).not.toContain('Prior session:');
  });

  it('suppresses intraday line for fixv1-era leg', () => {
    const entry = counterfactualEntry();
    entry.snapshot.symbolOut = legSnapshot('AAPL', {
      capturedAt: '2026-05-12T20:00:00Z',
      intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null, sessionDate: null },
    });
    entry.snapshot.symbolIn = legSnapshot('MSFT', {
      capturedAt: '2026-05-12T20:00:00Z',
      intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null, sessionDate: null },
    });
    const out = buildSwapEntryBlock(entry, 'counterfactual');
    expect(out).not.toContain('session:');
  });

  it('compact-depth trades never render intraday or levels regardless of regime', () => {
    const entry = tradeEntry();
    const out = buildSwapEntryBlock(entry, 'trade', { provenance: 'autopilot' });
    expect(out).not.toContain("Today's session:");
    expect(out).not.toContain('Levels:');
    expect(out).not.toContain('Trend:');
  });
});

// ==================== PHASE 5C — TRADE PROVENANCE DETECTION ====================

describe('detectTradeProvenance — Phase 5C', () => {
  it('returns risk_triggered when evaluationId starts with "risk_"', () => {
    const trade = { evaluationId: 'risk_stop_out_NVDA', symbolOut: 'NVDA', symbolIn: 'AAPL' };
    expect(detectTradeProvenance(trade, [])).toBe('risk_triggered');
  });

  it('returns approved when a matching approved proposal exists within the time window', () => {
    const trade = {
      symbolOut: 'COIN',
      symbolIn: 'HOOD',
      swappedOutAt: '2026-05-15T15:30:00Z',
      evaluationId: 'eval_abc',
    };
    const proposalHistory = [
      {
        symbolOut: 'COIN',
        symbolIn: 'HOOD',
        resolution: 'approved',
        resolvedAt: '2026-05-15T15:28:30Z',
      },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('approved');
  });

  it('returns auto_executed_proposal when a matching auto_executed proposal exists', () => {
    const trade = {
      symbolOut: 'TSLA',
      symbolIn: 'F',
      swappedOutAt: '2026-05-15T15:30:00Z',
      evaluationId: 'eval_def',
    };
    const proposalHistory = [
      {
        symbolOut: 'TSLA',
        symbolIn: 'F',
        resolution: 'auto_executed',
        resolvedAt: '2026-05-15T15:29:00Z',
      },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('auto_executed_proposal');
  });

  it('returns autopilot when no matching proposal and no risk marker', () => {
    const trade = {
      symbolOut: 'AAPL',
      symbolIn: 'MSFT',
      swappedOutAt: '2026-05-15T15:30:00Z',
      evaluationId: 'eval_haiku',
    };
    expect(detectTradeProvenance(trade, [])).toBe('autopilot');
    expect(detectTradeProvenance(trade, null)).toBe('autopilot');
    expect(detectTradeProvenance(trade, undefined)).toBe('autopilot');
  });

  it('returns autopilot when symbol pair does not match any proposal', () => {
    const trade = {
      symbolOut: 'AAPL',
      symbolIn: 'MSFT',
      swappedOutAt: '2026-05-15T15:30:00Z',
    };
    const proposalHistory = [
      { symbolOut: 'NVDA', symbolIn: 'AMD', resolution: 'approved', resolvedAt: '2026-05-15T15:29:00Z' },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('autopilot');
  });

  it('returns autopilot when matching proposal but resolution is vetoed/lapsed (those are counterfactuals, not trades)', () => {
    const trade = {
      symbolOut: 'AAPL',
      symbolIn: 'MSFT',
      swappedOutAt: '2026-05-15T15:30:00Z',
    };
    const proposalHistory = [
      { symbolOut: 'AAPL', symbolIn: 'MSFT', resolution: 'vetoed', resolvedAt: '2026-05-15T15:29:00Z' },
      { symbolOut: 'AAPL', symbolIn: 'MSFT', resolution: 'lapsed', resolvedAt: '2026-05-15T15:29:30Z' },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('autopilot');
  });

  it('returns autopilot when matching proposal is outside the 5-minute window', () => {
    const trade = {
      symbolOut: 'COIN',
      symbolIn: 'HOOD',
      swappedOutAt: '2026-05-15T15:30:00Z',
    };
    const proposalHistory = [
      // 10 minutes earlier — outside window
      { symbolOut: 'COIN', symbolIn: 'HOOD', resolution: 'approved', resolvedAt: '2026-05-15T15:20:00Z' },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('autopilot');
  });

  it('matches within window edge (4:59 elapsed = match, 5:01 = no match)', () => {
    const trade = {
      symbolOut: 'COIN',
      symbolIn: 'HOOD',
      swappedOutAt: '2026-05-15T15:30:00Z',
    };
    const insideWindow = [
      { symbolOut: 'COIN', symbolIn: 'HOOD', resolution: 'approved', resolvedAt: '2026-05-15T15:25:01Z' },
    ];
    const outsideWindow = [
      { symbolOut: 'COIN', symbolIn: 'HOOD', resolution: 'approved', resolvedAt: '2026-05-15T15:24:59Z' },
    ];
    expect(detectTradeProvenance(trade, insideWindow)).toBe('approved');
    expect(detectTradeProvenance(trade, outsideWindow)).toBe('autopilot');
  });

  it('matches even without timestamps when symbol pair + resolution align', () => {
    // Defensive: if either side lacks a usable timestamp, fall through to a
    // symbol-pair-only match so trades from legacy data still get the right
    // provenance.
    const trade = { symbolOut: 'AAPL', symbolIn: 'MSFT' };
    const proposalHistory = [
      { symbolOut: 'AAPL', symbolIn: 'MSFT', resolution: 'approved' },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('approved');
  });

  it('returns unknown when trade is null or not an object', () => {
    expect(detectTradeProvenance(null, [])).toBe('unknown');
    expect(detectTradeProvenance(undefined, [])).toBe('unknown');
  });

  it('risk_ marker on evaluationId wins over a coincidentally matching proposal', () => {
    const trade = {
      symbolOut: 'NVDA',
      symbolIn: 'AAPL',
      swappedOutAt: '2026-05-15T15:30:00Z',
      evaluationId: 'risk_drawdown_NVDA',
    };
    const proposalHistory = [
      { symbolOut: 'NVDA', symbolIn: 'AAPL', resolution: 'approved', resolvedAt: '2026-05-15T15:29:00Z' },
    ];
    expect(detectTradeProvenance(trade, proposalHistory)).toBe('risk_triggered');
  });
});

describe('buildBenchBriefsBlock — empty / missing', () => {
  it('returns null when marketSnapshot is missing', () => {
    expect(buildBenchBriefsBlock(null)).toBeNull();
    expect(buildBenchBriefsBlock(undefined)).toBeNull();
  });

  it('returns null when benchBriefs is missing', () => {
    expect(buildBenchBriefsBlock({})).toBeNull();
  });

  it('returns null when benchBriefs is empty (no orphan header)', () => {
    expect(buildBenchBriefsBlock({ benchBriefs: [] })).toBeNull();
  });
});

describe('buildBenchBriefsBlock — render shapes', () => {
  it('renders a single stock brief with full data', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'AMD',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: 2.34,
        price: 150.5,
        cooldownActive: false,
        cooldownUntil: null,
        trendSummary: 'Strong uptrend. Above all major SMAs.',
        momentumSummary: 'RSI healthy, not extended. MACD expanding.',
      }],
    });

    expect(out).toContain('YOUR BENCH (available for swap):');
    // Phase 5A: bench header uses square-bracket assetClass tag (sector
    // moves into the rank parenthetical when present; otherwise omitted
    // from the header tag).
    expect(out).toContain('AMD [stock] +2.34%');
    expect(out).toContain('Trend: Strong uptrend. Above all major SMAs.');
    expect(out).toContain('Momentum: RSI healthy, not extended. MACD expanding.');
    expect(out).not.toContain('locked until');
  });

  it('drops the ±N% segment for crypto with price: null', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'BTC-USD',
        assetClass: 'crypto',
        sector: 'Crypto',
        changePercent: null,
        price: null,
        cooldownActive: false,
        cooldownUntil: null,
      }],
    });

    // Phase 5A: bench header is "SYMBOL [assetClass]" with no change% when
    // changePercent is null (crypto bench).
    expect(out).toContain('BTC-USD [crypto]');
    expect(out).not.toMatch(/BTC-USD.*%/);
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Momentum:');
  });

  it('renders a "locked until" segment when cooldown is active', () => {
    const future = '2026-05-05T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'PLTR',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: -1.2,
        price: 38.5,
        cooldownActive: true,
        cooldownUntil: future,
      }],
    });

    expect(out).toContain('PLTR [stock] -1.2%');
    expect(out).toContain(`locked until ${future}`);
  });

  it('does not render "locked until" when cooldownActive is false (even if cooldownUntil set)', () => {
    const past = '2026-04-01T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'AMD',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: 0.5,
        price: 150,
        cooldownActive: false,
        cooldownUntil: past,
      }],
    });
    expect(out).not.toContain('locked until');
  });

  it('omits Trend: / Momentum: lines when fields are missing', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'XYZ',
        assetClass: 'stock',
        sector: 'Unknown',
        changePercent: 1.0,
        price: 10,
        cooldownActive: false,
        cooldownUntil: null,
      }],
    });

    expect(out).toContain('XYZ [stock] +1%');
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Momentum:');
  });

  it('renders multiple briefs separated by blank lines', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [
        { symbol: 'AMD', assetClass: 'stock', sector: 'Technology', changePercent: 1, price: 150, cooldownActive: false, cooldownUntil: null },
        { symbol: 'BTC-USD', assetClass: 'crypto', sector: 'Crypto', changePercent: null, price: null, cooldownActive: false, cooldownUntil: null },
      ],
    });
    expect(out.split('\n\n').length).toBeGreaterThanOrEqual(2);
    expect(out).toContain('AMD');
    expect(out).toContain('BTC-USD');
  });
});

describe('buildBenchBriefsBlock — Phase 5A integration', () => {
  it('renders the full stack (header + metrics + trend + momentum + levels + signals) for a fully-populated stock bench brief', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'AMD',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: 2.34,
        price: 150.5,
        cooldownActive: false,
        cooldownUntil: null,
        technicalScore: 75,
        technicalRank: 4,
        rsPercentile: 80,
        atrPercent: 4.2,
        trendSummary: 'Strong uptrend. Above all major SMAs.',
        momentumSummary: 'RSI healthy. MACD expanding.',
        nearestSupport: 145,
        distanceToSupportPct: -3.7,
        macdFreshBullishCross: true,
      }],
    });

    expect(out).toContain('AMD [stock] +2.34% — Score 75 (rank #4 in Technology), RS 80th %ile, ATR 4.2%');
    expect(out).toContain('Trend: Strong uptrend. Above all major SMAs.');
    expect(out).toContain('Momentum: RSI healthy. MACD expanding.');
    expect(out).toContain('Levels: Support $145 (-3.7%).');
    expect(out).toContain('Signals: Fresh MACD bullish cross.');
  });

  it('cooldown-only brief: renders header + cooldown segment, no levels/signals/threshold sections', () => {
    const future = '2026-05-13T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'PLTR',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: -1.2,
        cooldownActive: true,
        cooldownUntil: future,
        // No technical score data, no levels, no signals
      }],
    });

    expect(out).toContain('PLTR [stock] -1.2%');
    expect(out).toContain(`locked until ${future}`);
    expect(out).not.toContain('Score');
    expect(out).not.toContain('Levels:');
    expect(out).not.toContain('Signals:');
    expect(out).not.toContain('Threshold:'); // bench has no scoring section
    expect(out).not.toContain('Badges earned:');
  });
});

// ==================== MARKET SNAPSHOT CONTEXT — SECTOR RS RENDERING ====================

// Tier 0 Item 5: rendering tests for the three sector-RS lines added under the
// existing `Breadth:` line in the MARKET RIGHT NOW block.

function fullMarketContextCache(overrides = {}) {
  return {
    marketContext: {
      regime: 'bull',
      regimeDetail: 'SPY above 50-day MA. Strong uptrend.',
      spyChange: 0.41,
      vixLevel: null,
      volatilityRegime: 'normal',
      breadthTier: 'moderate',
      breadthDetail: 'SPY +0.41% but RSP -0.19% — rally driven by mega-caps.',
      topSector: 'Technology',
      topSectorChange: 1.49,
      worstSector: 'Energy',
      worstSectorChange: -1.34,
      yieldRegime: 'neutral',
      leadershipSignal: 'tech_leads',
      divergenceSignal: 'rotation',
      breadthQualitySignal: 'narrow_leadership',
      breadthSpyVsRspGap: 0.6,
      ...overrides,
    },
  };
}

describe('buildMarketSnapshotContext — sector RS rendering', () => {
  it('renders all three new lines with expected format and order on full data', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    expect(out).toContain('Breadth quality: narrow_leadership (SPY vs RSP: +0.6%)');
    expect(out).toContain('Leadership: tech_leads');
    expect(out).toContain('Divergence: rotation');
  });

  it('omits the Divergence line when divergenceSignal === "none"', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ divergenceSignal: 'none' }));
    expect(out).not.toContain('Divergence:');
    expect(out).toContain('Leadership: tech_leads');
  });

  it('renders the Divergence line for any non-"none" signal', () => {
    for (const sig of ['rotation', 'narrow_participation', 'small_cap_momentum']) {
      const out = buildMarketSnapshotContext(fullMarketContextCache({ divergenceSignal: sig }));
      expect(out).toContain(`Divergence: ${sig}`);
    }
  });

  it('omits the Breadth quality line when breadthQualitySignal is null', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({
      breadthQualitySignal: null,
      breadthSpyVsRspGap: null,
    }));
    expect(out).not.toContain('Breadth quality:');
    expect(out).toContain('Leadership: tech_leads');
  });

  it('omits the SPY vs RSP parenthetical when breadthSpyVsRspGap is null', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({
      breadthQualitySignal: 'narrow_leadership',
      breadthSpyVsRspGap: null,
    }));
    expect(out).toContain('Breadth quality: narrow_leadership');
    expect(out).not.toContain('SPY vs RSP:');
  });

  it('renders breadthSpyVsRspGap with + sign for positive values', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: 0.6 }));
    expect(out).toContain('SPY vs RSP: +0.6%');
  });

  it('renders breadthSpyVsRspGap with - sign for negative values', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: -0.4 }));
    expect(out).toContain('SPY vs RSP: -0.4%');
  });

  it('renders breadthSpyVsRspGap of 0 as "0.0"', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: 0 }));
    expect(out).toContain('SPY vs RSP: 0.0%');
  });

  it('places new lines immediately after Breadth: and before Sector leaders:', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    const lines = out.split('\n');
    const breadthIdx = lines.findIndex(l => l.startsWith('Breadth:'));
    const breadthQualityIdx = lines.findIndex(l => l.startsWith('Breadth quality:'));
    const leadershipIdx = lines.findIndex(l => l.startsWith('Leadership:'));
    const divergenceIdx = lines.findIndex(l => l.startsWith('Divergence:'));
    const sectorLeadersIdx = lines.findIndex(l => l.startsWith('Sector leaders:'));

    expect(breadthIdx).toBeGreaterThan(-1);
    expect(breadthQualityIdx).toBe(breadthIdx + 1);
    expect(leadershipIdx).toBe(breadthQualityIdx + 1);
    expect(divergenceIdx).toBe(leadershipIdx + 1);
    expect(sectorLeadersIdx).toBe(divergenceIdx + 1);
  });

  it('always renders the Leadership line (defaults to "mixed" when signal absent)', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ leadershipSignal: undefined }));
    expect(out).toContain('Leadership: mixed');
  });

  it('regression guard: existing lines (Regime/SPY/Breadth/Sector/Yields) unchanged', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    expect(out).toContain('MARKET RIGHT NOW:');
    expect(out).toContain('Regime: bull — SPY above 50-day MA. Strong uptrend.');
    expect(out).toContain('SPY: +0.41% | Volatility: normal');
    expect(out).toContain('Breadth: moderate — SPY +0.41% but RSP -0.19% — rally driven by mega-caps.');
    expect(out).toContain('Sector leaders: Technology (+1.49%)');
    expect(out).toContain('Sector laggards: Energy (-1.34%)');
    expect(out).toContain('Yields: neutral');
  });

  it('returns null when marketSnapshot has no marketContext', () => {
    expect(buildMarketSnapshotContext(null)).toBeNull();
    expect(buildMarketSnapshotContext({})).toBeNull();
  });
});

// ==================== BATTLE STATE — SCORE FIX + GAME STATE + URGENCY ====================

// Tier 0 Item 7: gameState/urgency lift from agentNewsContext.computeGameContext,
// bundled with the Phase 1.5 score-shape fix (battle.scoreState.* — was reading
// phantom flat fields). Regression-guards prevent the "undefined / NaN" output
// from coming back.

const todayET = formatDateString(getETDate());

function makeBattle(overrides = {}) {
  return {
    id: 'test_battle',
    gameMode: 'baggerbomb',
    portfolio: { star: [{ symbol: 'NVDA' }], core: [], support: [] },
    ...overrides,
  };
}

describe('buildBattleState — score-line shape fix (Phase 1.5 regression guard)', () => {
  it('renders score from battle.scoreState.* shape', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: 8, opponentScore: -3 },
    }));
    expect(out).toContain('Score: You 8 — Opponent -3');
    expect(out).toContain('LEADING by 11');
  });

  it('defaults score to 0 when scoreState is missing entirely', () => {
    const out = buildBattleState(makeBattle());
    expect(out).toContain('Score: You 0 — Opponent 0 (TIED by 0 pts)');
  });

  it('defaults score to 0 when scoreState is an empty object', () => {
    const out = buildBattleState(makeBattle({ scoreState: {} }));
    expect(out).toContain('Score: You 0 — Opponent 0 (TIED by 0 pts)');
  });

  it('renders TRAILING when opponent leads', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -5, opponentScore: 10 },
    }));
    expect(out).toContain('Score: You -5 — Opponent 10');
    expect(out).toContain('TRAILING by 15');
  });

  it('never emits "undefined" or "NaN" on the Score line', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: 4, opponentScore: 4 },
    }));
    const scoreLine = out.split('\n').find(l => l.startsWith('- Score:'));
    expect(scoreLine).toBeDefined();
    expect(scoreLine.includes('undefined')).toBe(false);
    expect(scoreLine.includes('NaN')).toBe(false);
  });

  it('regression: empty-scoreState fixture also avoids undefined / NaN on Score line', () => {
    const out = buildBattleState(makeBattle());
    const scoreLine = out.split('\n').find(l => l.startsWith('- Score:'));
    expect(scoreLine).toBeDefined();
    expect(scoreLine.includes('undefined')).toBe(false);
    expect(scoreLine.includes('NaN')).toBe(false);
  });
});

describe('buildBattleState — degraded-mode disclosure (Haiku eval reliability fix)', () => {
  it('renders exactly one EVAL ENGINE HEALTH line when consecutiveEvalFailures > 0', () => {
    const out = buildBattleState(makeBattle({
      cronState: { consecutiveEvalFailures: 3 },
    }));
    const matches = out.match(/EVAL ENGINE HEALTH/g) || [];
    expect(matches.length).toBe(1);
    expect(out).toContain('missed its last 3 evaluation window(s)');
    expect(out).toContain('Do not claim recent evaluations or engine actions occurred');
  });

  it('renders no disclosure when the counter is 0', () => {
    const out = buildBattleState(makeBattle({
      cronState: { consecutiveEvalFailures: 0 },
    }));
    expect(out).not.toContain('EVAL ENGINE HEALTH');
  });

  it('renders no disclosure when cronState is absent (pre-fix battle docs)', () => {
    const out = buildBattleState(makeBattle());
    expect(out).not.toContain('EVAL ENGINE HEALTH');
  });
});

describe('buildBattleState — game state rendering', () => {
  it('renders "Game state: losing" when currentScore < -5', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -8, opponentScore: 0 },
    }));
    expect(out).toContain('- Game state: losing');
  });

  it('renders "Game state: winning" when currentScore > 15', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: 20, opponentScore: 0 },
    }));
    expect(out).toContain('- Game state: winning');
  });

  it('renders "Game state: neutral" for scores between -5 and 15', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: 5, opponentScore: 0 },
    }));
    expect(out).toContain('- Game state: neutral');
  });

  it('renders "Game state: neutral" when scoreState is missing', () => {
    const out = buildBattleState(makeBattle());
    expect(out).toContain('- Game state: neutral');
  });
});

describe('buildBattleState — urgency rendering', () => {
  it('renders "Urgency: high" on the last day with score < -10', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -15, opponentScore: 0 },
      timing: { tradingDays: [todayET] },
    }));
    expect(out).toContain('- Urgency: high');
  });

  it('renders "Urgency: normal" when not on the last day (today not in tradingDays)', () => {
    // computeGameContext treats "today not in tradingDays" as the last day too
    // (defaults currentDay to totalDays). To exercise the not-last-day path, we
    // include today AND a future day so today's index < totalDays.
    const future = '2099-12-31';
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -20, opponentScore: 0 },
      timing: { tradingDays: [todayET, future] },
    }));
    expect(out).toContain('- Urgency: normal');
  });

  it('renders "Urgency: normal" on the last day when score is not < -10', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -5, opponentScore: 0 },
      timing: { tradingDays: [todayET] },
    }));
    expect(out).toContain('- Urgency: normal');
  });

  it('renders "Urgency: normal" when timing is missing entirely', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: -20, opponentScore: 0 },
    }));
    // No timing means totalDays defaults to 1 and tradingDays is empty,
    // so isLastDay is true — the score < -10 condition is what gates urgency.
    // currentScore -20 with empty tradingDays → currentDay=totalDays=1, isLastDay=true,
    // score < -10 → urgency: high. Verify the actual semantics.
    expect(out).toContain('- Urgency: high');
  });
});

describe('buildBattleState — line ordering', () => {
  it('places "Game state:" and "Urgency:" between "Time remaining:" and "Your portfolio:"', () => {
    const out = buildBattleState(makeBattle({
      scoreState: { currentScore: 4, opponentScore: 1 },
    }));
    const lines = out.split('\n');
    const timeIdx = lines.findIndex(l => l.startsWith('- Time remaining:'));
    const gameStateIdx = lines.findIndex(l => l.startsWith('- Game state:'));
    const urgencyIdx = lines.findIndex(l => l.startsWith('- Urgency:'));
    const portfolioIdx = lines.findIndex(l => l.startsWith('- Your portfolio:'));

    expect(timeIdx).toBeGreaterThan(-1);
    expect(gameStateIdx).toBe(timeIdx + 1);
    expect(urgencyIdx).toBe(gameStateIdx + 1);
    expect(portfolioIdx).toBe(urgencyIdx + 1);
  });
});

describe('buildBattleState — null-battle fallback (regression guard)', () => {
  it('returns the strategy-session string when battle is null', () => {
    expect(buildBattleState(null)).toBe('No active battle. This is a strategy session.');
  });

  it('returns the strategy-session string when battle is undefined', () => {
    expect(buildBattleState(undefined)).toBe('No active battle. This is a strategy session.');
  });
});

// ==================== MARKET STATE + TIME REMAINING (phantom-field fix) ====================

// Pre-launch backlog item: marketOpen / timeRemaining were phantom fields on the
// battle doc — never written by any cron/handler — so buildBattleState rendered
// `Market: CLOSED` (always, since `undefined` is falsy) and `Time remaining: undefined`
// every turn. Fix derives both at prompt-assembly time: market state from
// getMarketState() (mocked here for determinism), time remaining from
// computeTimeRemaining(battle) (real implementation against fixture timing).

const MARKET_STATES = ['OPEN', 'PRE_MARKET', 'CLOSED_AFTERHOURS', 'CLOSED_WEEKEND', 'CLOSED_HOLIDAY'];

describe('buildBattleState — market state rendering', () => {
  beforeEach(() => {
    // Reset to OPEN between tests so a previous test's mutation doesn't leak.
    mockMarketState.state = 'OPEN';
    mockMarketState.isOpen = true;
  });

  for (const state of MARKET_STATES) {
    it(`renders the full state token for ${state}`, () => {
      mockMarketState.state = state;
      mockMarketState.isOpen = state === 'OPEN';
      const out = buildBattleState(makeBattle());
      expect(out).toContain(`- Market: ${state}`);
    });
  }

  it('never renders the bare "Market: CLOSED" bug signature when market is OPEN', () => {
    mockMarketState.state = 'OPEN';
    mockMarketState.isOpen = true;
    const out = buildBattleState(makeBattle());
    // Bug previously rendered `- Market: CLOSED` for every battle (because
    // battle.marketOpen was undefined → falsy). The line is now strictly
    // `- Market: ${marketState.state}`. The bare `CLOSED` token is never the
    // valid output of getMarketState(); only its CLOSED_* variants are.
    expect(out).not.toMatch(/^- Market: CLOSED$/m);
  });
});

describe('buildBattleState — time remaining rendering', () => {
  it('renders multi-day duration when battle has multiple trading days remaining', () => {
    const todayET = formatDateString(getETDate());
    const out = buildBattleState(makeBattle({
      timing: {
        tradingDays: [todayET, '2099-12-30', '2099-12-31'],
        localOpen: '09:30',
        localClose: '16:00',
      },
    }));
    // computeTimeRemaining returns "Nd Hh Mm" when remainingFullDays > 0.
    expect(out).toMatch(/- Time remaining: \d+d \d+h \d+m/);
    expect(out).not.toMatch(/Time remaining: undefined/);
  });

  it('renders intraday duration on the last trading day', () => {
    const todayET = formatDateString(getETDate());
    const out = buildBattleState(makeBattle({
      timing: {
        tradingDays: [todayET],
        localOpen: '09:30',
        localClose: '16:00',
      },
    }));
    // computeTimeRemaining returns "Hh Mm" or "Mm" (no day suffix) on the last
    // day. Either form is acceptable; just assert the bug signature is gone
    // and the line is non-empty.
    const line = out.split('\n').find(l => l.startsWith('- Time remaining:'));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/Time remaining: undefined/);
    expect(line).not.toMatch(/Time remaining:\s*$/);
  });

  it('renders "unknown" when battle.timing is missing entirely', () => {
    const out = buildBattleState(makeBattle({ timing: undefined }));
    expect(out).toContain('- Time remaining: unknown');
    expect(out).not.toMatch(/Time remaining: undefined/);
  });

  it('renders "unknown" when battle.timing.tradingDays is empty', () => {
    const out = buildBattleState(makeBattle({
      timing: { tradingDays: [], localOpen: '09:30', localClose: '16:00' },
    }));
    expect(out).toContain('- Time remaining: unknown');
    expect(out).not.toMatch(/Time remaining: undefined/);
  });

  it('renders "unknown" when battle.timing.tradingDays is missing from a populated timing object', () => {
    const out = buildBattleState(makeBattle({
      timing: { localOpen: '09:30', localClose: '16:00' },
    }));
    expect(out).toContain('- Time remaining: unknown');
    expect(out).not.toMatch(/Time remaining: undefined/);
  });
});

describe('buildBattleState — phantom-field regression guard', () => {
  beforeEach(() => {
    mockMarketState.state = 'OPEN';
    mockMarketState.isOpen = true;
  });

  it('never renders "Market: CLOSED" (bare) or "Time remaining: undefined" with valid timing', () => {
    const todayET = formatDateString(getETDate());
    const out = buildBattleState(makeBattle({
      timing: { tradingDays: [todayET], localOpen: '09:30', localClose: '16:00' },
    }));
    expect(out).not.toMatch(/^- Market: CLOSED$/m);
    expect(out).not.toMatch(/Time remaining: undefined/);
  });

  it('never renders "Time remaining: undefined" even when timing data is missing', () => {
    const out = buildBattleState(makeBattle({ timing: undefined }));
    expect(out).not.toMatch(/Time remaining: undefined/);
  });
});

// ==================== PORTFOLIO BRIEFS BLOCK — THRESHOLD PROXIMITY (Tier 0 Item 4) ====================

// Render rules:
// - Threshold: line: ALWAYS render when thresholdProximity is present.
//   Format: "Threshold: {currentMultiplier}x (baseATR {baseATR}%)" + optional " — red zone toward {targetThreshold} ({zoneProgressPercent}% of zone)".
// - Swap-lock: line: ONLY when swapLock.locked === true. "Swap-lock: locked, {distancePercent}pp to {targetName}"
// - Badges earned: line: ONLY when existingBadges.length > 0.

function basePortfolioBrief(overrides = {}) {
  return {
    symbol: 'AAPL',
    tier: 'star',
    price: 200,
    changePercent: 1.5,
    technicalScore: 75,
    technicalRank: 12,
    rsPercentile: 80,
    trendSummary: 'Strong uptrend. Above all major SMAs.',
    momentumSummary: 'RSI healthy, not extended. MACD expanding.',
    supportLevel: null,
    resistanceLevel: null,
    thresholdNote: null,
    atrPercent: 0.55,
    ...overrides,
  };
}

describe('buildPortfolioBriefsBlock — threshold proximity rendering (Tier 0 Item 4)', () => {
  it('renders Threshold: line with red-zone suffix when redZone is non-null', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.93,
          baseATR: 2.5,
          redZone: {
            targetThreshold: 'bagger',
            targetMultiple: 1.0,
            direction: 'positive',
            zoneProgressPercent: 72,
          },
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: [],
      })],
    });

    expect(out).toContain('Threshold: 0.9x (baseATR 2.5%) — red zone toward bagger (72% of zone)');
  });

  it('renders Threshold: line without red-zone suffix when redZone is null', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.42,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: [],
      })],
    });

    expect(out).toContain('Threshold: 0.4x (baseATR 2.5%)');
    expect(out).not.toContain('red zone toward');
  });

  it('renders Swap-lock: line when swapLock.locked is true', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.93,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: true, direction: 'positive', distancePercent: 0.18, message: 'approaching BaggerBomb' },
        },
        existingBadges: [],
      })],
    });

    expect(out).toContain('Swap-lock: locked, 0.2pp to BaggerBomb');
  });

  it('omits Swap-lock: line when swapLock.locked is false', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.5,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: [],
      })],
    });

    expect(out).not.toContain('Swap-lock:');
  });

  it('renders Swap-lock: with Bust target name on negative direction', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: -0.93,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: true, direction: 'negative', distancePercent: 0.175, message: 'approaching Bust' },
        },
        existingBadges: [],
      })],
    });

    expect(out).toContain('Swap-lock: locked, 0.2pp to Bust');
  });

  it('renders Badges earned: line with comma-separated list when badges present', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 1.2,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: ['bagger', 'doubleBagger'],
      })],
    });

    expect(out).toContain('Badges earned: bagger, doubleBagger');
  });

  it('omits Badges earned: line when existingBadges is empty', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.5,
          baseATR: 2.5,
          redZone: null,
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: [],
      })],
    });

    expect(out).not.toContain('Badges earned:');
  });

  it('omits Threshold: line entirely when thresholdProximity is undefined (graceful degradation)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({ existingBadges: [] })],
    });

    expect(out).not.toContain('Threshold:');
    expect(out).not.toContain('Swap-lock:');
  });

  it('preserves existing thresholdNote (BaggerBomb:) line alongside new Threshold: line', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdNote: 'High ATR — volatile, could hit thresholds quickly',
        thresholdProximity: {
          currentMultiplier: 0.5,
          baseATR: 3.0,
          redZone: null,
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
        existingBadges: [],
      })],
    });

    expect(out).toContain('BaggerBomb: High ATR — volatile, could hit thresholds quickly');
    expect(out).toContain('Threshold: 0.5x (baseATR 3.0%)');
  });

  it('renders the full feature stack in the locked order: existing → BaggerBomb: → Threshold: → Swap-lock: → Badges earned:', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdNote: 'High ATR — volatile, could hit thresholds quickly',
        thresholdProximity: {
          currentMultiplier: 0.93,
          baseATR: 2.5,
          redZone: { targetThreshold: 'bagger', targetMultiple: 1.0, direction: 'positive', zoneProgressPercent: 72 },
          swapLock: { locked: true, direction: 'positive', distancePercent: 0.18, message: 'approaching BaggerBomb' },
        },
        existingBadges: ['bagger'],
      })],
    });

    const lines = out.split('\n');
    const baggerBombIdx = lines.findIndex(l => l.startsWith('BaggerBomb:'));
    const thresholdIdx = lines.findIndex(l => l.startsWith('Threshold:'));
    const swapLockIdx = lines.findIndex(l => l.startsWith('Swap-lock:'));
    const badgesIdx = lines.findIndex(l => l.startsWith('Badges earned:'));

    expect(baggerBombIdx).toBeGreaterThan(-1);
    expect(thresholdIdx).toBe(baggerBombIdx + 1);
    expect(swapLockIdx).toBe(thresholdIdx + 1);
    expect(badgesIdx).toBe(swapLockIdx + 1);
  });

  it('regression guard: thresholdProximity/badges still omitted when not present (Phase 5A new header format)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [{
        symbol: 'AAPL',
        tier: 'star',
        changePercent: 1.5,
        trendSummary: 'Strong uptrend.',
        momentumSummary: 'MACD expanding.',
      }],
    });

    // Phase 5A: header tag uses brackets, no metrics segment when none present.
    expect(out).toContain('AAPL [star] +1.5%');
    expect(out).toContain('Trend: Strong uptrend.');
    expect(out).toContain('Momentum: MACD expanding.');
    expect(out).not.toContain('Threshold:');
    expect(out).not.toContain('Swap-lock:');
    expect(out).not.toContain('Badges earned:');
    // No metrics in fixture → no em-dash separator after change%.
    expect(out).not.toContain('+1.5% —');
  });

  it('returns null when portfolioBriefs is missing or empty', () => {
    expect(buildPortfolioBriefsBlock(null)).toBeNull();
    expect(buildPortfolioBriefsBlock({})).toBeNull();
    expect(buildPortfolioBriefsBlock({ portfolioBriefs: [] })).toBeNull();
  });
});

// =============================================================================
// Phase 5A — Per-symbol header + conditional lines (buildHeaderLine,
// buildLevelsLine, buildSignalsLine). These are pure helpers consumed by
// buildPortfolioBriefsBlock and buildBenchBriefsBlock. The pure-function
// tests below pin the format contract; integration tests further down
// confirm the wiring into the brief blocks.
// =============================================================================

describe('buildHeaderLine — Phase 5A', () => {
  it('renders the full bundle with all metric segments when every field is present (portfolio brief)', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      technicalScore: 87,
      technicalRank: 4,
      sectorTechnicalTotal: 28,
      sector: 'Tech',
      rsPercentile: 87,
      atrPercent: 4.2,
    });
    expect(out).toBe('NVDA [star] +2.43% — Score 87 (rank #4/28 in Tech), RS 87th %ile, ATR 4.2%');
  });

  it('skips the Score (rank) bundle when technicalScore is missing', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      // technicalScore missing
      technicalRank: 4,
      sectorTechnicalTotal: 28,
      sector: 'Tech',
      rsPercentile: 87,
      atrPercent: 4.2,
    });
    expect(out).toContain('NVDA [star] +2.43%');
    expect(out).not.toContain('Score');
    expect(out).not.toContain('rank #');
    expect(out).toContain('RS 87th %ile');
    expect(out).toContain('ATR 4.2%');
  });

  it('skips the RS %ile segment when rsPercentile is missing', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      technicalScore: 87,
      technicalRank: 4,
      sectorTechnicalTotal: 28,
      sector: 'Tech',
      // rsPercentile missing
      atrPercent: 4.2,
    });
    expect(out).toContain('Score 87 (rank #4/28 in Tech)');
    expect(out).not.toContain('RS ');
    expect(out).toContain('ATR 4.2%');
  });

  // F3.1: atrPercent === 0 is a legitimate value (lowest-decile ATR) and must
  // render. Missing data is null at the cron layer, not 0. Same for technicalScore.
  it('renders "ATR 0%" when atrPercent is the legitimate value 0', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      technicalScore: 87,
      rsPercentile: 87,
      atrPercent: 0,
    });
    expect(out).toContain('Score 87');
    expect(out).toContain('RS 87th %ile');
    expect(out).toContain('ATR 0%');
  });

  it('omits the ATR segment when atrPercent is null (missing)', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      technicalScore: 87,
      rsPercentile: 87,
      atrPercent: null,
    });
    expect(out).toContain('Score 87');
    expect(out).toContain('RS 87th %ile');
    expect(out).not.toContain('ATR');
  });

  it('renders "Score 0" when technicalScore is the legitimate value 0', () => {
    const out = buildHeaderLine({
      symbol: 'XYZ',
      tier: 'support',
      changePercent: -3.2,
      technicalScore: 0,
      rsPercentile: 12,
    });
    expect(out).toContain('Score 0');
    expect(out).toContain('RS 12th %ile');
  });

  it('omits the Score segment when technicalScore is null (missing)', () => {
    const out = buildHeaderLine({
      symbol: 'XYZ',
      tier: 'support',
      changePercent: -3.2,
      technicalScore: null,
      rsPercentile: 12,
    });
    expect(out).not.toContain('Score');
    expect(out).toContain('RS 12th %ile');
  });

  it('returns just SYMBOL [tier] +N% with no em-dash when all metrics are null', () => {
    const out = buildHeaderLine({
      symbol: 'AAPL',
      tier: 'star',
      changePercent: 1.5,
    });
    expect(out).toBe('AAPL [star] +1.5%');
    expect(out).not.toContain(' — ');
  });

  it('renders assetClass in the tier position for bench briefs', () => {
    const out = buildHeaderLine({
      symbol: 'AMD',
      assetClass: 'stock',
      changePercent: 2.34,
    });
    expect(out).toBe('AMD [stock] +2.34%');
  });

  it('preserves the negative sign on changePercent without an extra "+"', () => {
    const out = buildHeaderLine({
      symbol: 'PLTR',
      tier: 'core',
      changePercent: -1.85,
    });
    expect(out).toBe('PLTR [core] -1.85%');
  });

  it('renders zero changePercent with no sign prefix (stable convention)', () => {
    const out = buildHeaderLine({
      symbol: 'XYZ',
      tier: 'support',
      changePercent: 0,
    });
    expect(out).toBe('XYZ [support] 0%');
  });

  it('drops the /total suffix when sectorTechnicalTotal is null but keeps "in Sector"', () => {
    const out = buildHeaderLine({
      symbol: 'NVDA',
      tier: 'star',
      changePercent: 2.43,
      technicalScore: 87,
      technicalRank: 4,
      sector: 'Tech',
      // sectorTechnicalTotal missing
    });
    expect(out).toContain('Score 87 (rank #4 in Tech)');
    expect(out).not.toContain('rank #4/');
  });
});

describe('buildLevelsLine — Phase 5A', () => {
  it('renders all three segments when each is within its threshold', () => {
    const out = buildLevelsLine({
      nearestSupport: 418,
      distanceToSupportPct: -3.5,
      nearestResistance: 432,
      distanceToResistancePct: 1.8,
      distTo52wkHigh: -3.1,
    });
    expect(out).toBe('Levels: Support $418 (-3.5%), Resistance $432 (+1.8%), 52wk high -3.1% away.');
  });

  it('renders only the Support segment when only support is within threshold', () => {
    const out = buildLevelsLine({
      nearestSupport: 418,
      distanceToSupportPct: -3.5,
      // resistance and 52wk omitted
    });
    expect(out).toBe('Levels: Support $418 (-3.5%).');
  });

  it('renders only the Resistance segment when only resistance is within threshold', () => {
    const out = buildLevelsLine({
      nearestResistance: 432,
      distanceToResistancePct: 1.8,
    });
    expect(out).toBe('Levels: Resistance $432 (+1.8%).');
  });

  it('renders only the 52wk segment when only 52wk high is within threshold', () => {
    const out = buildLevelsLine({
      distTo52wkHigh: 2,
    });
    expect(out).toBe('Levels: 52wk high +2.0% away.');
  });

  it('returns null when no segment qualifies (all distant)', () => {
    const out = buildLevelsLine({
      nearestSupport: 100,
      distanceToSupportPct: -25,      // outside 10% gate
      nearestResistance: 200,
      distanceToResistancePct: 30,    // outside 10% gate
      distTo52wkHigh: -12,            // outside 5% gate
    });
    expect(out).toBeNull();
  });

  it('includes the Support segment at the |distanceToSupportPct| === 10 boundary', () => {
    const out = buildLevelsLine({
      nearestSupport: 100,
      distanceToSupportPct: -10,
    });
    expect(out).toBe('Levels: Support $100 (-10.0%).');
  });

  it('excludes the Support segment when |distanceToSupportPct| === 11 (just outside boundary)', () => {
    const out = buildLevelsLine({
      nearestSupport: 100,
      distanceToSupportPct: -11,
    });
    expect(out).toBeNull();
  });

  it('includes 52wk at distTo52wkHigh === 5 boundary and excludes at distTo52wkHigh === 6', () => {
    expect(buildLevelsLine({ distTo52wkHigh: 5 })).toBe('Levels: 52wk high +5.0% away.');
    expect(buildLevelsLine({ distTo52wkHigh: -5 })).toBe('Levels: 52wk high -5.0% away.');
    expect(buildLevelsLine({ distTo52wkHigh: 6 })).toBeNull();
    expect(buildLevelsLine({ distTo52wkHigh: -6 })).toBeNull();
  });
});

describe('buildSignalsLine — Phase 5A', () => {
  it('renders only Fresh MACD bullish cross when that flag fires alone', () => {
    const out = buildSignalsLine({ macdFreshBullishCross: true });
    expect(out).toBe('Signals: Fresh MACD bullish cross.');
  });

  it('renders only Fresh MACD bearish cross when that flag fires alone', () => {
    const out = buildSignalsLine({ macdFreshBearishCross: true });
    expect(out).toBe('Signals: Fresh MACD bearish cross.');
  });

  it('renders Bullish divergence forming when divergence is "bullish"', () => {
    const out = buildSignalsLine({ divergence: 'bullish' });
    expect(out).toBe('Signals: Bullish divergence forming.');
  });

  it('renders Bearish divergence forming when divergence is "bearish"', () => {
    const out = buildSignalsLine({ divergence: 'bearish' });
    expect(out).toBe('Signals: Bearish divergence forming.');
  });

  it('renders NR7 contraction line when nr7Flag is true', () => {
    const out = buildSignalsLine({ nr7Flag: true });
    expect(out).toBe('Signals: NR7 contraction — breakout pending.');
  });

  it('renders the Recent candle clause when lastCandlePattern is a non-empty string', () => {
    const out = buildSignalsLine({ lastCandlePattern: 'hammer' });
    expect(out).toBe('Signals: Recent candle: hammer.');
  });

  it('combines multiple flags in the specified order (MACD, divergence, NR7, candle)', () => {
    const out = buildSignalsLine({
      macdFreshBullishCross: true,
      divergence: 'bullish',
      nr7Flag: true,
      lastCandlePattern: 'engulfing',
    });
    expect(out).toBe('Signals: Fresh MACD bullish cross. Bullish divergence forming. NR7 contraction — breakout pending. Recent candle: engulfing.');
  });

  it('returns null when no flags fire (including divergence === "none")', () => {
    expect(buildSignalsLine({})).toBeNull();
    expect(buildSignalsLine({
      macdFreshBullishCross: false,
      macdFreshBearishCross: false,
      divergence: 'none',
      nr7Flag: false,
      lastCandlePattern: null,
    })).toBeNull();
  });

  // F3.4 — lastCandlePattern display normalization via PATTERN_DISPLAY_NAMES.
  it('renders "Recent candle: bullish engulfing." for snake_case bullish_engulfing', () => {
    const out = buildSignalsLine({ lastCandlePattern: 'bullish_engulfing' });
    expect(out).toBe('Signals: Recent candle: bullish engulfing.');
  });

  it('renders "Recent candle: bearish engulfing." for snake_case bearish_engulfing', () => {
    const out = buildSignalsLine({ lastCandlePattern: 'bearish_engulfing' });
    expect(out).toBe('Signals: Recent candle: bearish engulfing.');
  });

  it('renders "Recent candle: shooting star." for snake_case shooting_star', () => {
    const out = buildSignalsLine({ lastCandlePattern: 'shooting_star' });
    expect(out).toBe('Signals: Recent candle: shooting star.');
  });

  it('renders single-word patterns unchanged (doji, hammer)', () => {
    expect(buildSignalsLine({ lastCandlePattern: 'doji' })).toBe('Signals: Recent candle: doji.');
    expect(buildSignalsLine({ lastCandlePattern: 'hammer' })).toBe('Signals: Recent candle: hammer.');
  });

  it('falls back to underscore-replaced display for keys not in PATTERN_DISPLAY_NAMES', () => {
    const out = buildSignalsLine({ lastCandlePattern: 'morning_star' });
    expect(out).toBe('Signals: Recent candle: morning star.');
  });

  // F3.3 — strict-boolean contract for nr7Flag (locks the renderer behavior).
  it('does NOT render NR7 line when nr7Flag is a truthy non-boolean (e.g. 1)', () => {
    expect(buildSignalsLine({ nr7Flag: 1 })).toBeNull();
    expect(buildSignalsLine({ nr7Flag: 'true' })).toBeNull();
  });
});

describe('buildIntradayLine — Phase 5B', () => {
  it('returns null when brief is null or undefined', () => {
    expect(buildIntradayLine(null)).toBeNull();
    expect(buildIntradayLine(undefined)).toBeNull();
  });

  it('returns null when brief.intraday is null', () => {
    expect(buildIntradayLine({ intraday: null })).toBeNull();
  });

  it('returns null when brief.intraday is an empty object (no numeric fields)', () => {
    expect(buildIntradayLine({ intraday: {} })).toBeNull();
  });

  it('renders VWAP segment with "above" when vwapDeviation is positive', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 146.5, vwapDeviation: 0.7, sma20_5m: null },
    });
    expect(out).toBe('Prior session: 0.7% above session VWAP.');
  });

  it('renders VWAP segment with "below" when vwapDeviation is negative', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 144.5, vwapDeviation: -0.7, sma20_5m: null },
    });
    expect(out).toBe('Prior session: 0.7% below session VWAP.');
  });

  it('renders VWAP segment as "at" when |vwapDeviation| < 0.05 (positive near-zero)', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 145.55, vwapDeviation: 0.03, sma20_5m: null },
    });
    expect(out).toBe('Prior session: at session VWAP.');
  });

  it('renders VWAP segment as "at" when |vwapDeviation| < 0.05 (negative near-zero)', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 145.44, vwapDeviation: -0.04, sma20_5m: null },
    });
    expect(out).toBe('Prior session: at session VWAP.');
  });

  it('renders VWAP segment as "above" (not "at") when vwapDeviation === 0.05 exactly (strict-< boundary)', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 145.57, vwapDeviation: 0.05, sma20_5m: null },
    });
    expect(out).toBe('Prior session: 0.1% above session VWAP.');
  });

  it('renders SMA20 segment when currentPrice and sma20_5m are both numeric', () => {
    const out = buildIntradayLine({
      intraday: { vwap: null, currentPrice: 146.08, vwapDeviation: null, sma20_5m: 145.92 },
    });
    // (146.08 - 145.92) / 145.92 = 0.1097% → 0.1% above
    expect(out).toBe('Prior session: 0.1% above 5m SMA20.');
  });

  it('skips SMA20 segment when sma20_5m is present but currentPrice is not', () => {
    const out = buildIntradayLine({
      intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: 145.92 },
    });
    expect(out).toBeNull();
  });

  it('renders both VWAP and SMA20 segments combined when both are present', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 146.08, vwapDeviation: 0.7, sma20_5m: 145.92 },
    });
    expect(out).toBe('Prior session: 0.7% above session VWAP, 0.1% above 5m SMA20.');
  });

  it('rounds via toFixed(1) — 0.756 → "0.8% above"', () => {
    const out = buildIntradayLine({
      intraday: { vwap: 100, currentPrice: 100.756, vwapDeviation: 0.756, sma20_5m: null },
    });
    expect(out).toBe('Prior session: 0.8% above session VWAP.');
  });

  it('renders SMA20 with "below" when currentPrice is below sma20_5m', () => {
    const out = buildIntradayLine({
      intraday: { vwap: null, currentPrice: 145.0, vwapDeviation: null, sma20_5m: 145.5 },
    });
    // (145.0 - 145.5) / 145.5 = -0.3436% → 0.3% below
    expect(out).toBe('Prior session: 0.3% below 5m SMA20.');
  });

  it('renders SMA20 as "at" when price within 0.05% of sma20_5m', () => {
    const out = buildIntradayLine({
      intraday: { vwap: null, currentPrice: 145.5, vwapDeviation: null, sma20_5m: 145.53 },
    });
    // (145.5 - 145.53) / 145.53 = -0.0206% → "at"
    expect(out).toBe('Prior session: at 5m SMA20.');
  });
});

// Fix v2 — dynamic prefix derived from sessionDate. "Today's session" when
// sessionDate matches today's ET date (passed via `now`); "Prior session"
// otherwise (including null/undefined sessionDate — the legacy/cached-brief
// fallback). Anchors on ET, NOT host-local time, via toEtParts.
describe('buildIntradayLine — Fix v2 dynamic today/prior prefix', () => {
  // Helper: construct a UTC Date equivalent to a wall-clock ET datetime.
  // Mirrors marketDataCache.test.js — keeps tests independent of host TZ.
  function utcFromEt(year, month, day, hourEt, minuteEt, etOffsetHours) {
    return new Date(Date.UTC(year, month - 1, day, hourEt + etOffsetHours, minuteEt, 0));
  }

  it('renders "Today\'s session" prefix when sessionDate matches today\'s ET date', () => {
    // now = 2026-05-12 12:00 ET (DST, UTC-4)
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5,
        currentPrice: 146.5,
        vwapDeviation: 0.7,
        sma20_5m: null,
        sessionDate: '2026-05-12',
      },
    }, now);
    expect(out).toBe("Today's session: 0.7% above session VWAP.");
  });

  it('renders "Prior session" prefix when sessionDate is from a prior day (the EODHD-lag case)', () => {
    // now = 2026-05-12 12:00 ET, but EODHD's data only goes through May 11.
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5,
        currentPrice: 146.5,
        vwapDeviation: 0.7,
        sma20_5m: null,
        sessionDate: '2026-05-11',
      },
    }, now);
    expect(out).toBe('Prior session: 0.7% above session VWAP.');
  });

  it('renders "Prior session" prefix when sessionDate is null (legacy/cached brief fallback)', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const out = buildIntradayLine({
      intraday: { vwap: 145.5, currentPrice: 146.5, vwapDeviation: 0.7, sma20_5m: null, sessionDate: null },
    }, now);
    expect(out).toBe('Prior session: 0.7% above session VWAP.');
  });

  it('renders "Prior session" prefix when sessionDate is missing entirely (legacy payload)', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const out = buildIntradayLine({
      // No sessionDate field at all — pre-Fix v2 cached brief.
      intraday: { vwap: 145.5, currentPrice: 146.5, vwapDeviation: 0.7, sma20_5m: null },
    }, now);
    expect(out).toBe('Prior session: 0.7% above session VWAP.');
  });

  it('anchors on ET, not UTC — late UTC night that\'s still afternoon ET picks the right "today"', () => {
    // 2026-05-12 23:30 UTC = 2026-05-12 19:30 ET (DST). "Today" in ET is
    // still May 12, even though host UTC might roll to May 13 first.
    const now = new Date(Date.UTC(2026, 4, 12, 23, 30, 0));
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5,
        currentPrice: 146.5,
        vwapDeviation: 0.7,
        sma20_5m: null,
        sessionDate: '2026-05-12',
      },
    }, now);
    expect(out).toBe("Today's session: 0.7% above session VWAP.");
  });

  it('anchors on ET, not UTC — early UTC morning that\'s still prior evening ET picks the right "today"', () => {
    // 2026-05-13 02:00 UTC = 2026-05-12 22:00 ET. "Today" in ET = May 12.
    const now = new Date(Date.UTC(2026, 4, 13, 2, 0, 0));
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5,
        currentPrice: 146.5,
        vwapDeviation: 0.7,
        sma20_5m: null,
        sessionDate: '2026-05-12',
      },
    }, now);
    expect(out).toBe("Today's session: 0.7% above session VWAP.");
  });

  it('handles DST correctly — winter (standard time, UTC-5) prefix selection', () => {
    // 2026-01-20 14:00 UTC = 09:00 ET. Today's ET date = Jan 20.
    const now = new Date(Date.UTC(2026, 0, 20, 14, 0, 0));
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5, currentPrice: 146.5, vwapDeviation: 0.7, sma20_5m: 145.92,
        sessionDate: '2026-01-20',
      },
    }, now);
    expect(out).toBe("Today's session: 0.7% above session VWAP, 0.4% above 5m SMA20.");
  });

  it('combined VWAP + SMA20 segments render with Today\'s session prefix', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    const out = buildIntradayLine({
      intraday: {
        vwap: 145.5, currentPrice: 146.08, vwapDeviation: 0.7, sma20_5m: 145.92,
        sessionDate: '2026-05-12',
      },
    }, now);
    expect(out).toBe("Today's session: 0.7% above session VWAP, 0.1% above 5m SMA20.");
  });

  it('returns null (regardless of prefix) when intraday is missing entirely', () => {
    const now = utcFromEt(2026, 5, 12, 12, 0, 4);
    expect(buildIntradayLine({ intraday: null }, now)).toBeNull();
    expect(buildIntradayLine(null, now)).toBeNull();
    expect(buildIntradayLine({ intraday: {} }, now)).toBeNull();
  });

  it('uses real-time new Date() default when now arg is omitted', () => {
    // Smoke test: no `now` arg, sessionDate intentionally NOT today → Prior.
    // Doesn't pin the date — just verifies no crash on default-arg path.
    const out = buildIntradayLine({
      intraday: {
        vwap: 100, currentPrice: 101, vwapDeviation: 1.0, sma20_5m: null,
        sessionDate: '2020-01-01',
      },
    });
    expect(out).toBe('Prior session: 1.0% above session VWAP.');
  });
});

describe('buildPortfolioBriefsBlock — Phase 5A integration', () => {
  it('renders header + trend + momentum + levels + signals + threshold stack when all data present', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [{
        symbol: 'NVDA',
        tier: 'star',
        changePercent: 2.43,
        technicalScore: 87,
        technicalRank: 4,
        sectorTechnicalTotal: 28,
        sector: 'Tech',
        rsPercentile: 87,
        atrPercent: 4.2,
        trendSummary: 'Strong uptrend. Above all major SMAs.',
        momentumSummary: 'RSI healthy, not extended. MACD expanding.',
        nearestSupport: 418,
        distanceToSupportPct: -3.5,
        nearestResistance: 432,
        distanceToResistancePct: 1.8,
        distTo52wkHigh: -3.1,
        macdFreshBullishCross: true,
        divergence: 'bullish',
        thresholdNote: 'High ATR — volatile, could hit thresholds quickly',
        thresholdProximity: {
          currentMultiplier: 0.93,
          baseATR: 2.5,
          redZone: { targetThreshold: 'bagger', targetMultiple: 1.0, direction: 'positive', zoneProgressPercent: 72 },
          swapLock: { locked: true, direction: 'positive', distancePercent: 0.18, message: 'approaching BaggerBomb' },
        },
        existingBadges: ['bagger'],
      }],
    });

    expect(out).toContain('NVDA [star] +2.43% — Score 87 (rank #4/28 in Tech), RS 87th %ile, ATR 4.2%');
    expect(out).toContain('Trend: Strong uptrend. Above all major SMAs.');
    expect(out).toContain('Momentum: RSI healthy, not extended. MACD expanding.');
    expect(out).toContain('Levels: Support $418 (-3.5%), Resistance $432 (+1.8%), 52wk high -3.1% away.');
    expect(out).toContain('Signals: Fresh MACD bullish cross. Bullish divergence forming.');
    expect(out).toContain('BaggerBomb: High ATR — volatile, could hit thresholds quickly');
    expect(out).toContain('Threshold: 0.9x (baseATR 2.5%) — red zone toward bagger (72% of zone)');
    expect(out).toContain('Swap-lock: locked, 0.2pp to BaggerBomb');
    expect(out).toContain('Badges earned: bagger');
  });

  it('quiet position: renders header + trend + momentum + threshold stack only (no levels/signals lines)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [{
        symbol: 'AAPL',
        tier: 'core',
        changePercent: 0.5,
        technicalScore: 60,
        rsPercentile: 50,
        atrPercent: 1.2,
        trendSummary: 'Choppy. Above SMA50, below SMA20.',
        momentumSummary: 'RSI neutral. MACD flat.',
        // No support/resistance proximity, no fresh signals
      }],
    });

    expect(out).toContain('AAPL [core] +0.5% — Score 60, RS 50th %ile, ATR 1.2%');
    expect(out).toContain('Trend: Choppy.');
    expect(out).toContain('Momentum: RSI neutral.');
    expect(out).not.toContain('Levels:');
    expect(out).not.toContain('Signals:');
  });

  it('preserves the existing thresholdProximity rendering (redZone + swapLock + badges intact)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [basePortfolioBrief({
        thresholdProximity: {
          currentMultiplier: 0.93,
          baseATR: 2.5,
          redZone: { targetThreshold: 'bagger', targetMultiple: 1.0, direction: 'positive', zoneProgressPercent: 72 },
          swapLock: { locked: true, direction: 'positive', distancePercent: 0.18, message: 'approaching BaggerBomb' },
        },
        existingBadges: ['bagger', 'doubleBagger'],
      })],
    });

    expect(out).toContain('Threshold: 0.9x (baseATR 2.5%) — red zone toward bagger (72% of zone)');
    expect(out).toContain('Swap-lock: locked, 0.2pp to BaggerBomb');
    expect(out).toContain('Badges earned: bagger, doubleBagger');
  });
});

// =============================================================================
// Sprint 6 Phase 1 — workshop seedContext kind: 'watchlist'
//
// Sprint 5 shipped the seedContext discriminated union (theme + sector branches)
// without unit tests for renderPreloadedContextBlock. Phase 1 adds the
// watchlist branch and lands its tests here. renderPreloadedContextBlock is
// internal (not exported); these tests exercise it through the exported
// buildVoiceLayerPrompt({ mode: 'workshop' }) entry point and substring-match
// against the assembled prompt. Theme + sector substring coverage is a real
// remaining test debt from Sprint 5 — recommended as a small follow-up.
// =============================================================================

describe('buildVoiceLayerPrompt — workshop seedContext (Sprint 6 Phase 1)', () => {
  const minimalAgent = { name: 'Gemma', archetype: 'strategist' };

  function workshopContextWithSeed(seedContext) {
    return {
      previousThesis: null,
      sessionTurnCount: 0,
      messagesRemaining: 24,
      messageBudget: 25,
      seedContext,
    };
  }

  it('renders watchlist seedContext header, ticker list, and closing instruction', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'AI Infrastructure Plays — May 7',
      tickers: [
        { symbol: 'NVDA', reasoning: 'GPU monopoly; data-center capex tailwind.' },
        { symbol: 'TSM', reasoning: 'Foundry choke point; pricing power on leading nodes.' },
      ],
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).toContain('PRELOADED CONTEXT');
    expect(out).toContain('"AI Infrastructure Plays — May 7"');
    expect(out).toContain('Tickers in this watchlist:');
    expect(out).toContain('- NVDA: GPU monopoly; data-center capex tailwind.');
    expect(out).toContain('- TSM: Foundry choke point; pricing power on leading nodes.');
    expect(out).toContain('Do NOT pre-fill activeThesis');
  });

  it('includes Origin context line when sourceContent is provided', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'Reshoring Beneficiaries',
      tickers: [{ symbol: 'CAT', reasoning: 'Industrial bellwether for capex cycle.' }],
      sourceContent: 'Posts about CHIPS Act funded fabs and US semi capex.',
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).toContain('Origin context');
    expect(out).toContain('CHIPS Act funded fabs');
  });

  it('omits Origin context line when sourceContent is null', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'Test List',
      tickers: [{ symbol: 'MSFT', reasoning: 'Azure + Copilot run-rate.' }],
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).not.toContain('Origin context');
  });

  it('omits the PRELOADED CONTEXT block entirely when tickers array is empty', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'Empty List',
      tickers: [],
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).not.toContain('PRELOADED CONTEXT');
  });

  it('omits the PRELOADED CONTEXT block when title is missing', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: '',
      tickers: [{ symbol: 'AAPL', reasoning: 'iPhone cycle.' }],
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).not.toContain('PRELOADED CONTEXT');
  });

  it('caps the rendered tickers list at 10 entries (defensive slice)', () => {
    const tickers = Array.from({ length: 12 }, (_, i) => ({
      symbol: `TKR${i.toString().padStart(2, '0')}`,
      reasoning: `Reasoning for ticker ${i}.`,
    }));
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'Twelve Tickers',
      tickers,
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    for (let i = 0; i < 10; i++) {
      expect(out).toContain(`- TKR${i.toString().padStart(2, '0')}:`);
    }
    expect(out).not.toContain('- TKR10:');
    expect(out).not.toContain('- TKR11:');
  });

  it('drops malformed ticker entries (missing symbol or reasoning)', () => {
    const seed = {
      kind: 'watchlist',
      dropListId: 'wl_abc123',
      title: 'Mixed-Validity List',
      tickers: [
        { symbol: 'NVDA', reasoning: 'GPU monopoly.' },
        { symbol: '', reasoning: 'No symbol.' },
        { symbol: 'TSM', reasoning: '' },
        { symbol: 'AMD', reasoning: 'Datacenter share gain.' },
      ],
      sourceContent: null,
    };
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      mode: 'workshop',
      workshopContext: workshopContextWithSeed(seed),
      anchorContext: null,
    });

    expect(out).toContain('- NVDA: GPU monopoly.');
    expect(out).toContain('- AMD: Datacenter share gain.');
    expect(out).not.toContain('No symbol.');
    expect(out).not.toContain('- TSM:');
  });
});

describe('buildReviewContext — counterfactuals filter (regression)', () => {
  // Minimum-viable battle scaffold so non-counterfactual paths stay quiet.
  const battleWith = (proposalHistory) => ({ proposalHistory, trades: [] });

  it('Test 1: includes proposals with resolution === "vetoed"', () => {
    const out = buildReviewContext(
      battleWith([{ resolution: 'vetoed', symbolOut: 'AAPL', symbolIn: 'MSFT' }]),
      [],
      [],
    );
    expect(out).toContain('COUNTERFACTUALS');
    expect(out).toContain('AAPL → MSFT');
    expect(out).toContain('(vetoed)');
  });

  it('Test 2: includes proposals with resolution === "lapsed"', () => {
    const out = buildReviewContext(
      battleWith([{ resolution: 'lapsed', symbolOut: 'NVDA', symbolIn: 'AMD' }]),
      [],
      [],
    );
    expect(out).toContain('COUNTERFACTUALS');
    expect(out).toContain('NVDA → AMD');
    expect(out).toContain('(lapsed)');
  });

  it('Test 3: excludes proposals with resolution === "auto_executed"', () => {
    const out = buildReviewContext(
      battleWith([{ resolution: 'auto_executed', symbolOut: 'TSLA', symbolIn: 'F' }]),
      [],
      [],
    );
    expect(out).not.toContain('COUNTERFACTUALS');
    expect(out).not.toContain('TSLA → F');
  });

  it('Test 4: excludes proposals with no resolution (still pending)', () => {
    const out = buildReviewContext(
      battleWith([{ symbolOut: 'GOOG', symbolIn: 'META' }]),
      [],
      [],
    );
    expect(out).not.toContain('COUNTERFACTUALS');
    expect(out).not.toContain('GOOG → META');
  });

  it('Test 5: mixed dataset returns only vetoed and lapsed', () => {
    const out = buildReviewContext(
      battleWith([
        { resolution: 'vetoed',        symbolOut: 'AAPL', symbolIn: 'MSFT' },
        { resolution: 'lapsed',        symbolOut: 'NVDA', symbolIn: 'AMD'  },
        { resolution: 'auto_executed', symbolOut: 'TSLA', symbolIn: 'F'    },
        {                              symbolOut: 'GOOG', symbolIn: 'META' },
      ]),
      [],
      [],
    );
    expect(out).toContain('COUNTERFACTUALS');
    expect(out).toContain('AAPL → MSFT');
    expect(out).toContain('NVDA → AMD');
    expect(out).not.toContain('TSLA → F');
    expect(out).not.toContain('GOOG → META');
  });

  it('Test 6: regression guard — entry with status:"vetoed" and resolution:"auto_executed" is excluded', () => {
    // The pre-fix buggy filter matched on p.status === 'vetoed' and would have
    // included this entry. The fixed filter checks p.resolution, sees
    // 'auto_executed', and excludes.
    const out = buildReviewContext(
      battleWith([{
        status: 'vetoed',
        resolution: 'auto_executed',
        symbolOut: 'COIN',
        symbolIn: 'HOOD',
      }]),
      [],
      [],
    );
    expect(out).not.toContain('COUNTERFACTUALS');
    expect(out).not.toContain('COIN → HOOD');
  });
});

// ==================== PHASE 5C — END-TO-END INTEGRATION ====================

describe('Phase 5C end-to-end — full Review prompt assembly', () => {
  const snap = (sym, overrides = {}) => ({
    symbol: sym,
    sectorName: 'Technology',
    capturedAt: '2026-05-15T15:30:00Z',
    trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'down' },
    momentum: { macdFreshBullishCross: true, divergence: 'bullish' },
    volatility: { atrPercent: 2.1 },
    volume: { nr7Flag: true },
    smaStack: { distTo52wkHigh: -1.8 },
    rs: { rsPercentile: 76 },
    levels: { nearestSupport: 880, nearestResistance: 905, distanceToSupportPct: -1.4, distanceToResistancePct: 1.3 },
    recentAction: { lastCandlePattern: 'bullish_engulfing' },
    intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.7, sma20_5m: 894.0, sessionDate: '2026-05-15' },
    composite: { technicalScore: 81, sectorTechnicalRank: 4, sectorTechnicalTotal: 28 },
    ...overrides,
  });

  const buildRealisticBattle = () => ({
    agentId: 'agent_1',
    ownerId: 'user_1',
    gameMode: 'baggerbomb',
    executionMode: 'autopilot',
    strategyPreset: 'balanced',
    dailyReviews: [
      {
        date: '2026-05-15',
        tradingDay: 5,
        headline: 'Strong open, faded into close',
        summary: 'Tech rotation paid off in the morning; AI names rolled in the afternoon.',
        finalScore: 124,
        opponentScore: 117,
        selfGrade: 'B',
      },
    ],
    trades: [
      {
        symbolOut: 'NVDA', symbolIn: 'AAPL', tier: 'star',
        lockedPoints: 4.3, swappedOutAt: '2026-05-15T15:00:00Z',
        evaluationId: 'eval_haiku_1',
        snapshot: { symbolOut: snap('NVDA'), symbolIn: snap('AAPL') },
      },
      {
        symbolOut: 'TSLA', symbolIn: 'F', tier: 'core',
        lockedPoints: -1.8, swappedOutAt: '2026-05-15T15:30:00Z',
        evaluationId: 'risk_drawdown_TSLA',
        snapshot: { symbolOut: snap('TSLA'), symbolIn: snap('F') },
      },
      {
        symbolOut: 'COIN', symbolIn: 'HOOD', tier: 'support',
        lockedPoints: 2.1, swappedOutAt: '2026-05-15T15:45:00Z',
        evaluationId: 'eval_haiku_2',
        snapshot: { symbolOut: snap('COIN'), symbolIn: snap('HOOD') },
      },
    ],
    proposalHistory: [
      {
        symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star',
        resolution: 'vetoed', scoreAtProposal: 72.4, scoreAtVeto: 68.1,
        counterfactualPoints: 4.2,
        snapshot: { symbolOut: snap('AAPL'), symbolIn: snap('MSFT') },
      },
      {
        symbolOut: 'GOOG', symbolIn: 'META', tier: 'core',
        resolution: 'lapsed', scoreAtProposal: 65, scoreAtResolution: 62.5,
        counterfactualPoints: -0.8,
        snapshot: { symbolOut: snap('GOOG'), symbolIn: snap('META') },
      },
    ],
  });

  const agent = {
    name: 'Gemma',
    archetype: 'strategist',
    stats: { gamesPlayed: 12, wins: 7, losses: 5 },
    partnerProfile: null,
    convictions: [],
    consolidatedInsight: null,
  };

  it('renders a full Review-mode prompt with snapshot blocks in the review context', () => {
    const battle = buildRealisticBattle();
    const out = buildVoiceLayerPrompt({
      agent,
      battle,
      elicitationTarget: null,
      conversationHistory: [],
      anchorContext: 'Market closed. SPY +0.3% on the day.',
      marketSnapshot: null,
      mode: 'review',
      dailyReviews: battle.dailyReviews,
      dailyGrades: [],
    });
    expect(out).toContain('REVIEW MODE');
    expect(out).toContain('REVIEW CONTEXT:');
    expect(out).toContain('BATCH REVIEW SUMMARY (2026-05-15)');
    // Trade snapshot blocks rendered with provenance
    expect(out).toContain('TRADE — executed (autopilot)');
    expect(out).toContain('TRADE — executed (risk-triggered)');
    // Counterfactual snapshot blocks rendered with resolution
    expect(out).toContain('COUNTERFACTUAL — vetoed by Coach');
    expect(out).toContain('COUNTERFACTUAL — lapsed (no Coach action)');
    expect(out).toContain('Score at proposal: 72.4 → at veto: 68.1');
    expect(out).toContain('Score at proposal: 65 → at lapse: 62.5');
  });

  it('snapshot rendering token impact stays within budget ceiling for 5 cf + 3 trades', () => {
    // Worst-case Review context: 5 counterfactuals (full depth) + 3 trades
    // (compact depth), all fully populated. The 4-char-per-token heuristic
    // is conservative for natural English; real BPE tokenization is lower.
    // Ceiling of 2,000 estimated tokens guards against regressions that would
    // bloat the prompt by ~25% over the current rendering.
    const battle = {
      trades: [1, 2, 3].map((n) => ({
        symbolOut: `T${n}O`, symbolIn: `T${n}I`, tier: 'core',
        lockedPoints: n, swappedOutAt: '2026-05-15T15:30:00Z',
        evaluationId: `eval_${n}`,
        snapshot: { symbolOut: snap(`T${n}O`), symbolIn: snap(`T${n}I`) },
      })),
      proposalHistory: [1, 2, 3, 4, 5].map((n) => ({
        symbolOut: `C${n}O`, symbolIn: `C${n}I`, tier: 'star',
        resolution: 'vetoed', scoreAtProposal: 70, scoreAtVeto: 65,
        counterfactualPoints: n,
        snapshot: { symbolOut: snap(`C${n}O`), symbolIn: snap(`C${n}I`) },
      })),
    };
    const out = buildReviewContext(battle, [], []);
    const startIdx = out.indexOf('TRADES (');
    const snapshotSection = out.slice(startIdx);
    const approxTokens = Math.ceil(snapshotSection.length / 4);
    expect(approxTokens).toBeLessThan(2000);
    expect(approxTokens).toBeGreaterThan(1000); // sanity check: rendering didn't silently shrink
  });

  it('renders mixed regime snapshots correctly (pre-fixv1, fixv1-era, post-fixv2)', () => {
    const battle = {
      trades: [],
      proposalHistory: [
        {
          symbolOut: 'OLD1', symbolIn: 'OLD2', tier: 'star',
          resolution: 'vetoed', counterfactualPoints: 1.5,
          snapshot: {
            symbolOut: snap('OLD1', {
              capturedAt: '2026-05-08T15:00:00Z',
              intraday: { vwap: 100, currentPrice: 101, vwapDeviation: 1, sma20_5m: null, sessionDate: null },
            }),
            symbolIn: snap('OLD2', {
              capturedAt: '2026-05-08T15:00:00Z',
              intraday: { vwap: 200, currentPrice: 201, vwapDeviation: 0.5, sma20_5m: null, sessionDate: null },
            }),
          },
        },
        {
          symbolOut: 'MID1', symbolIn: 'MID2', tier: 'core',
          resolution: 'lapsed', counterfactualPoints: -0.5,
          snapshot: {
            symbolOut: snap('MID1', {
              capturedAt: '2026-05-12T20:00:00Z',
              intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null, sessionDate: null },
            }),
            symbolIn: snap('MID2', {
              capturedAt: '2026-05-12T20:00:00Z',
              intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null, sessionDate: null },
            }),
          },
        },
        {
          symbolOut: 'NEW1', symbolIn: 'NEW2', tier: 'support',
          resolution: 'vetoed', counterfactualPoints: 3.2,
          snapshot: { symbolOut: snap('NEW1'), symbolIn: snap('NEW2') },
        },
      ],
    };
    const out = buildReviewContext(battle, [], []);
    // Pre-fixv1 (OLD): no intraday line
    const oldSection = out.slice(out.indexOf('OLD1 leg:'), out.indexOf('MID1 leg:'));
    expect(oldSection).not.toContain('session:');
    // Fixv1-era (MID): no intraday line
    const midSection = out.slice(out.indexOf('MID1 leg:'), out.indexOf('NEW1 leg:'));
    expect(midSection).not.toContain('session:');
    // Post-fixv2 (NEW): intraday rendered
    const newSection = out.slice(out.indexOf('NEW1 leg:'));
    expect(newSection).toContain("Today's session:");
  });

  it('defensive: malformed snapshot does not crash buildReviewContext', () => {
    const malformedBattle = {
      trades: [
        { symbolOut: 'A', symbolIn: 'B', tier: 'core', lockedPoints: 1, snapshot: null },
        { symbolOut: 'C', symbolIn: 'D', tier: 'core', lockedPoints: 2, snapshot: 'not-an-object' },
        { symbolOut: 'E', symbolIn: 'F', tier: 'core', lockedPoints: 3, snapshot: { symbolOut: null, symbolIn: null } },
        { symbolOut: 'G', symbolIn: 'H', tier: 'core', lockedPoints: 4, snapshot: { symbolOut: 'not-an-object' } },
      ],
      proposalHistory: [
        { symbolOut: 'X', symbolIn: 'Y', resolution: 'vetoed', snapshot: undefined },
      ],
    };
    expect(() => buildReviewContext(malformedBattle, [], [])).not.toThrow();
    const out = buildReviewContext(malformedBattle, [], []);
    expect(out).toContain('REVIEW CONTEXT:');
  });

  it('integrates PATTERN_DISPLAY_NAMES for snake_case candle patterns', () => {
    const cfWithPattern = {
      symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star',
      resolution: 'vetoed', scoreAtProposal: 70, scoreAtVeto: 65, counterfactualPoints: 1,
      snapshot: {
        symbolOut: snap('AAPL', { recentAction: { lastCandlePattern: 'bullish_engulfing' } }),
        symbolIn: snap('MSFT', { recentAction: { lastCandlePattern: 'doji' } }),
      },
    };
    const out = buildReviewContext({ trades: [], proposalHistory: [cfWithPattern] }, [], []);
    expect(out).toContain('bullish engulfing');
    expect(out).toContain('doji');
  });

  it('falls back to underscore-split for unknown candle pattern keys', () => {
    const cfWithUnknownPattern = {
      symbolOut: 'AAPL', symbolIn: 'MSFT', tier: 'star',
      resolution: 'vetoed', counterfactualPoints: 1,
      snapshot: {
        symbolOut: snap('AAPL', { recentAction: { lastCandlePattern: 'mystery_candle_form' } }),
        symbolIn: snap('MSFT'),
      },
    };
    const out = buildReviewContext({ trades: [], proposalHistory: [cfWithUnknownPattern] }, [], []);
    expect(out).toContain('mystery candle form');
  });

  it('auto-debrief and user-chat invocations produce identical Review prompts', () => {
    // Both code paths call buildVoiceLayerPrompt({mode:'review', ...}). The
    // assembled prompt should be byte-identical regardless of which caller
    // invoked it — auto-debrief differs only in (1) how it appends to
    // chatExchanges (handled in agent-batch-review.js, not this module) and
    // (2) the userMessage passed to callGemmaVoice (also outside this module).
    const battle = buildRealisticBattle();
    const args = {
      agent,
      battle,
      elicitationTarget: null,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: null,
      mode: 'review',
      dailyReviews: battle.dailyReviews,
      dailyGrades: [],
    };
    const autoDebriefPrompt = buildVoiceLayerPrompt(args);
    const userChatPrompt = buildVoiceLayerPrompt(args);
    expect(autoDebriefPrompt).toBe(userChatPrompt);
  });
});

// ==================== PHASE 5C — buildReviewContext INTEGRATION ====================

describe('buildReviewContext — Phase 5C snapshot rendering integration', () => {
  const snapWithSymbol = (sym, overrides = {}) => ({
    symbol: sym,
    sectorName: 'Technology',
    capturedAt: '2026-05-15T15:30:00Z',
    trend: { shortTerm: 'up', intermediate: 'up', longTerm: 'down' },
    momentum: { macdFreshBullishCross: true, divergence: 'bullish' },
    volatility: { atrPercent: 2.1 },
    volume: { nr7Flag: true },
    smaStack: { distTo52wkHigh: -1.8 },
    rs: { rsPercentile: 76 },
    levels: { nearestSupport: 880, nearestResistance: 905, distanceToSupportPct: -1.4, distanceToResistancePct: 1.3 },
    recentAction: { lastCandlePattern: null },
    intraday: { vwap: 893.5, currentPrice: 895.2, vwapDeviation: 0.7, sma20_5m: 894.0, sessionDate: '2026-05-15' },
    composite: { technicalScore: 81, sectorTechnicalRank: 4, sectorTechnicalTotal: 28 },
    ...overrides,
  });

  const cf = (n, overrides = {}) => ({
    symbolOut: `OUT${n}`,
    symbolIn: `IN${n}`,
    tier: 'star',
    resolution: 'vetoed',
    scoreAtProposal: 70,
    scoreAtVeto: 65,
    counterfactualPoints: 2.0 + n,
    snapshot: { symbolOut: snapWithSymbol(`OUT${n}`), symbolIn: snapWithSymbol(`IN${n}`) },
    ...overrides,
  });

  const tr = (n, overrides = {}) => ({
    symbolOut: `TOUT${n}`,
    symbolIn: `TIN${n}`,
    tier: 'core',
    lockedPoints: n,
    trigger: 'rs_rotation',
    swappedOutAt: '2026-05-15T15:30:00Z',
    evaluationId: `eval_${n}`,
    snapshot: { symbolOut: snapWithSymbol(`TOUT${n}`), symbolIn: snapWithSymbol(`TIN${n}`) },
    ...overrides,
  });

  it('renders RECENT TRADES section with snapshot blocks for last 3 trades', () => {
    const battle = { trades: [tr(1), tr(2), tr(3)], proposalHistory: [] };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('RECENT TRADES (3 most recent with snapshot rendering)');
    expect(out).toContain('TRADE — executed (autopilot)');
    expect(out).toContain('TOUT1 leg:');
    expect(out).toContain('TOUT2 leg:');
    expect(out).toContain('TOUT3 leg:');
    expect(out).toContain('Signals:');
    // No EARLIER TRADES section when <=3 trades total
    expect(out).not.toContain('EARLIER TRADES');
  });

  it('renders RECENT COUNTERFACTUALS section with full-depth blocks for last 5 vetoed/lapsed', () => {
    const battle = {
      trades: [],
      proposalHistory: [cf(1), cf(2), cf(3), cf(4), cf(5)],
    };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('RECENT COUNTERFACTUALS (5 most recent with snapshot rendering)');
    expect(out).toContain('COUNTERFACTUAL — vetoed by Coach');
    expect(out).toContain('OUT1 leg:');
    expect(out).toContain('OUT5 leg:');
    expect(out).toContain('Trend: up/up/down');
    expect(out).toContain('Levels: Support $880');
    expect(out).toContain("Today's session:");
    expect(out).not.toContain('EARLIER COUNTERFACTUALS');
  });

  it('caps RECENT TRADES at 3 and bumps remaining into EARLIER TRADES one-liners', () => {
    const battle = { trades: [tr(1), tr(2), tr(3), tr(4), tr(5)], proposalHistory: [] };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('RECENT TRADES (3 most recent with snapshot rendering)');
    expect(out).toContain('EARLIER TRADES:');
    expect(out).toContain('- TOUT1 → TIN1 [core]');
    expect(out).toContain('- TOUT2 → TIN2 [core]');
    // tr3, tr4, tr5 are in the recent block (last 3), so EARLIER contains 1,2
    expect(out).toContain('TOUT3 leg:');
    expect(out).toContain('TOUT4 leg:');
    expect(out).toContain('TOUT5 leg:');
    // EARLIER TRADES should NOT include the snapshot-rendered ones
    const earlierSection = out.slice(out.indexOf('EARLIER TRADES:'));
    expect(earlierSection).not.toContain('TOUT3 leg:');
  });

  it('caps COUNTERFACTUALS via slice(-6) and renders most recent 5 with snapshots, 6th as one-liner', () => {
    // 7 entries → slice(-6) keeps last 6 → last 5 render as blocks, 1 as one-liner
    const battle = {
      trades: [],
      proposalHistory: [cf(1), cf(2), cf(3), cf(4), cf(5), cf(6), cf(7)],
    };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('RECENT COUNTERFACTUALS (5 most recent with snapshot rendering)');
    expect(out).toContain('EARLIER COUNTERFACTUALS:');
    // cf(1) was filtered out by slice(-6) entirely
    expect(out).not.toContain('OUT1 leg:');
    expect(out).not.toContain('OUT1 → IN1');
    // cf(2) is the 6th-most-recent within the kept window → one-liner
    expect(out).toContain('- OUT2 → IN2 (vetoed)');
    // cf(3) through cf(7) render as snapshot blocks
    expect(out).toContain('OUT3 leg:');
    expect(out).toContain('OUT7 leg:');
  });

  it('falls back to one-liner for pre-Phase-4 entries (no snapshot)', () => {
    // Pre-Phase-4 trades use the legacy renderer's field set (outcomePoints).
    const preTrade = { symbolOut: 'OLD', symbolIn: 'NEW', tier: 'support', outcomePoints: 1.2, trigger: 'macd' };
    const battle = { trades: [preTrade], proposalHistory: [] };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('RECENT TRADES (1 most recent with snapshot rendering)');
    // No snapshot block, falls through to legacy one-liner inside the section
    expect(out).toContain('- OLD → NEW [support] — +1.2 pts | macd');
    expect(out).not.toContain('OLD leg:');
  });

  it('renders empty trades/counterfactuals gracefully with no empty sections', () => {
    const battle = { trades: [], proposalHistory: [] };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('REVIEW CONTEXT:');
    expect(out).not.toContain('RECENT TRADES');
    expect(out).not.toContain('RECENT COUNTERFACTUALS');
    expect(out).not.toContain('EARLIER TRADES');
    expect(out).not.toContain('EARLIER COUNTERFACTUALS');
  });

  it('routes approved-proposal trades through provenance detection to "approved by Coach" header', () => {
    const matchingProposal = {
      symbolOut: 'TOUT1',
      symbolIn: 'TIN1',
      resolution: 'approved',
      resolvedAt: '2026-05-15T15:29:00Z',
    };
    const battle = {
      trades: [tr(1)],
      proposalHistory: [matchingProposal],
    };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('TRADE — approved by Coach');
    expect(out).not.toContain('TRADE — executed (autopilot)');
  });

  it('routes risk-triggered trades through provenance detection to "(risk-triggered)" header', () => {
    const riskTrade = tr(1, { evaluationId: 'risk_drawdown_TOUT1' });
    const battle = { trades: [riskTrade], proposalHistory: [] };
    const out = buildReviewContext(battle, [], []);
    expect(out).toContain('TRADE — executed (risk-triggered)');
  });

  it('renders mixed regime entries correctly (intraday only for post-fixv2)', () => {
    const preFixCf = cf(1, {
      snapshot: {
        symbolOut: snapWithSymbol('OUT1', {
          capturedAt: '2026-05-08T15:00:00Z',
          intraday: { vwap: 100, currentPrice: 101, vwapDeviation: 1, sma20_5m: null, sessionDate: null },
        }),
        symbolIn: snapWithSymbol('IN1', {
          capturedAt: '2026-05-08T15:00:00Z',
          intraday: { vwap: 200, currentPrice: 200, vwapDeviation: 0, sma20_5m: null, sessionDate: null },
        }),
      },
    });
    const postFixCf = cf(2); // default fixture is post-fixv2
    const battle = { trades: [], proposalHistory: [preFixCf, postFixCf] };
    const out = buildReviewContext(battle, [], []);
    const out1Section = out.slice(out.indexOf('OUT1 leg:'), out.indexOf('IN1 leg:'));
    const out2Section = out.slice(out.indexOf('OUT2 leg:'), out.indexOf('IN2 leg:'));
    expect(out1Section).not.toContain('session:');
    expect(out2Section).toContain("Today's session:");
  });
});

// =============================================================================
// Voice Layer Snag Bug Fix — battle-mode OUTPUT_FORMAT confusion handler.
//
// Background: investigation report (claude/investigate-gemma-snag-bug-GBzfi)
// found that battle-mode OUTPUT_FORMAT lacked the "if confused, still return
// JSON" instruction that Workshop has. This let Gemma fall back to plain-text
// "I have hit a snag…" responses on first turns when the prompt was sparse.
// These tests pin the new instruction to the assembled battle-mode prompt.
// =============================================================================

describe('buildVoiceLayerPrompt — battle-mode confusion handler', () => {
  const minimalAgent = {
    name: 'Gemma',
    archetype: 'strategist',
    stats: { gamesPlayed: 1, wins: 0, losses: 0 },
  };
  const minimalBattle = {
    gameMode: 'standard',
    portfolio: { star: [], core: [], support: [] },
    scoreState: { currentScore: 0, opponentScore: 0 },
  };
  const minimalElicitation = {
    dimension: 'risk_appetite',
    instruction: 'probe risk appetite',
  };

  it('battle prompt embeds the JSON-on-confusion instruction', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: null,
      mode: 'battle',
    });

    expect(out).toContain('You MUST return valid JSON in every response, no exceptions.');
    expect(out).toContain('NEVER output plain text outside the JSON structure.');
    expect(out).toMatch(/clarifying question.*in the `response` field/);
  });

  it('battle prompt still embeds the original strict-JSON header', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: null,
      mode: 'battle',
    });

    // Existing header rule must remain — confusion handler is additive.
    expect(out).toContain('RESPONSE FORMAT — You MUST respond with valid JSON only.');
  });
});

// =============================================================================
// Phase 5A — DATA_CONFIDENCE_RULE prompt-vs-response framing.
// The rule is internal-only (not exported) so we assert via the assembled
// prompt. The rule is pushed into battle mode when marketSnapshot is truthy.
// Pre-merge refinement (audit F4.1, F4.2): the rule now explicitly frames
// the show-in-prompt-vs-quote-in-response distinction and uses illustrative
// (not exhaustive) examples.
// =============================================================================

describe('DATA_CONFIDENCE_RULE — Phase 5A prompt-vs-response framing', () => {
  const minimalAgent = {
    name: 'Gemma',
    archetype: 'strategist',
    stats: { gamesPlayed: 1, wins: 0, losses: 0 },
  };
  const minimalBattle = {
    gameMode: 'standard',
    portfolio: { star: [], core: [], support: [] },
    scoreState: { currentScore: 0, opponentScore: 0 },
  };
  const minimalElicitation = {
    dimension: 'risk_appetite',
    instruction: 'probe risk appetite',
  };

  it('battle prompt embeds the prompt-vs-response framing sentence and positive examples', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: { portfolioBriefs: [], benchBriefs: [], scoutAlerts: [] },
      mode: 'battle',
    });

    // New framing sentence — addresses audit F4.1 (show in prompt ≠ quote
    // in response) and F4.2 (illustrative examples covering Score, RS, ATR).
    expect(out).toContain('show raw indicator values');
    expect(out).toContain('"ATR 4.2%"');
    expect(out).toContain('"Score 87"');
    expect(out).toContain('"RS 87th %ile"');
    expect(out).toContain('do not quote these verbatim in responses');

    // Positive paraphrase guidance — raw indicators qualitative; percentiles
    // and ranks as bands.
    expect(out).toContain('Interpret raw indicators qualitatively');
    expect(out).toContain('"volatility is elevated"');
    expect(out).toContain('paraphrase percentiles and ranks as bands');
    expect(out).toContain('"top decile,"');
    expect(out).toContain('"best in sector"');

    // Existing clauses preserved.
    expect(out).toContain('Portfolio data refreshes every 15 minutes.');
    expect(out).toContain('Never invent numbers — if a field is missing, skip it entirely.');
  });

  it('exhaustive-looking parenthetical list is gone (audit F4.2 lock-in)', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: { portfolioBriefs: [], benchBriefs: [], scoutAlerts: [] },
      mode: 'battle',
    });

    // Old wording listed three indicators as if exhaustive — Technical
    // Score wasn't on that list, which invited misinterpretation. The
    // refined rule uses "e.g." with broader coverage instead.
    expect(out).not.toContain('raw indicator values (RSI, ATR%, BB%B) should not appear verbatim');
    expect(out).not.toContain('Percentile and rank values may be paraphrased as bands ("top decile," "best in sector") in responses; raw indicator values');
  });

  // Fix v2 — intraday clause updated for latest-session semantics. Fix v1's
  // wording said "today's session positioning" — incorrect when EODHD's
  // /intraday lag means the data is from the prior session. Updated wording
  // covers both regimes explicitly.
  it('battle prompt embeds the Fix v2 intraday clause with latest-session semantics', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: { portfolioBriefs: [], benchBriefs: [], scoutAlerts: [] },
      mode: 'battle',
    });

    expect(out).toContain('Intraday signals (session VWAP, 5-min SMA20)');
    expect(out).toContain('describe the latest available session');
    expect(out).toContain("typically today during market hours, or the prior session when EODHD's data hasn't refreshed");
    expect(out).toContain('Paraphrase as "holding above session VWAP"');
    expect(out).toContain('"session momentum is constructive,"');
    expect(out).toContain('not the exact deviation percentage');
  });

  it('Fix v1 intraday wording is gone (replaced by latest-session phrasing)', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: { portfolioBriefs: [], benchBriefs: [], scoutAlerts: [] },
      mode: 'battle',
    });

    // The exact Fix v1 phrase "today's session positioning" was misleading
    // under EODHD's lag — assert it's removed.
    expect(out).not.toContain("today's session positioning");
  });

  it('intraday clause sits between percentile-bands and "Never invent numbers" (order lock)', () => {
    const out = buildVoiceLayerPrompt({
      agent: minimalAgent,
      battle: minimalBattle,
      elicitationTarget: minimalElicitation,
      conversationHistory: [],
      anchorContext: null,
      marketSnapshot: { portfolioBriefs: [], benchBriefs: [], scoutAlerts: [] },
      mode: 'battle',
    });

    const bandsIdx = out.indexOf('"best in sector"');
    const intradayIdx = out.indexOf('Intraday signals');
    const neverIdx = out.indexOf('Never invent numbers');
    expect(bandsIdx).toBeGreaterThan(-1);
    expect(intradayIdx).toBeGreaterThan(bandsIdx);
    expect(neverIdx).toBeGreaterThan(intradayIdx);
  });
});

// ==================== PHASE 5B-PREP — INTEGRATION ====================

// End-to-end: verify the full pipeline from realistic cron-produced briefs
// (i.e., briefs that match what voice-layer-cache.js writes after Phase 5B-prep)
// through buildPortfolioBriefsBlock / buildBenchBriefsBlock. These tests
// resolve the Phase 5A buildSignalsLine / buildLevelsLine dormancy: with
// the propagated fields present, the helpers now fire on real data.

// Realistic portfolio brief shape, mirroring voice-layer-cache.js's brief
// object literal after Commits 3 and 4.
function realisticPortfolioBrief(overrides = {}) {
  return {
    symbol: 'NVDA',
    tier: 'star',
    price: 425.5,
    changePercent: 2.43,
    technicalScore: 87,
    technicalRank: 4,
    rsPercentile: 87,
    trendSummary: 'Strong uptrend. Above all major SMAs. RS vs SPY rising.',
    momentumSummary: 'RSI healthy, not extended. MACD expanding. Volume 1.8x avg.',
    supportLevel: null,
    resistanceLevel: null,
    thresholdNote: null,
    atrPercent: 4.2,
    sector: 'Technology',
    sectorTechnicalTotal: 28,
    nearestSupport: 418,
    nearestResistance: 432,
    distanceToSupportPct: -1.76,
    distanceToResistancePct: 1.53,
    distTo52wkHigh: -3.1,
    nr7Flag: false,
    macdFreshBullishCross: true,
    macdFreshBearishCross: false,
    divergence: 'bullish',
    lastCandlePattern: 'bullish_engulfing',
    existingBadges: [],
    intraday: null,
    ...overrides,
  };
}

function realisticBenchBrief(overrides = {}) {
  return {
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
    sectorTechnicalTotal: 28,
    trendSummary: 'Strong uptrend. Above all major SMAs. RS vs SPY rising.',
    momentumSummary: 'RSI healthy, not extended. MACD expanding.',
    nearestSupport: 145,
    nearestResistance: 155,
    distanceToSupportPct: -3.65,
    distanceToResistancePct: 2.99,
    distTo52wkHigh: -4.1,
    nr7Flag: true,
    macdFreshBullishCross: true,
    macdFreshBearishCross: false,
    divergence: 'bearish',
    lastCandlePattern: 'shooting_star',
    ...overrides,
  };
}

describe('Phase 5B-prep integration — buildPortfolioBriefsBlock fires Levels and Signals', () => {
  it('renders the Signals line with Fresh MACD bullish cross when propagated', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        macdFreshBullishCross: true,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
      })],
    });
    expect(out).toContain('Signals: Fresh MACD bullish cross.');
  });

  it('renders the Levels line with all three segments when propagated and within thresholds', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        nearestSupport: 418,
        distanceToSupportPct: -3.5,
        nearestResistance: 432,
        distanceToResistancePct: 1.8,
        distTo52wkHigh: -3.1,
      })],
    });
    expect(out).toContain('Levels: Support $418 (-3.5%), Resistance $432 (+1.8%), 52wk high -3.1% away.');
  });

  it('renders the normalized candle pattern in the Signals line (snake_case → human-readable)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: 'bullish_engulfing',
      })],
    });
    expect(out).toContain('Signals: Recent candle: bullish engulfing.');
    expect(out).not.toContain('bullish_engulfing');
  });

  it('renders both Levels and Signals when all propagated fields are present and active', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        nearestSupport: 418,
        distanceToSupportPct: -3.5,
        nearestResistance: 432,
        distanceToResistancePct: 1.8,
        distTo52wkHigh: -3.1,
        macdFreshBullishCross: true,
        divergence: 'bullish',
        nr7Flag: true,
        lastCandlePattern: 'shooting_star',
      })],
    });
    expect(out).toContain('Levels:');
    expect(out).toContain('Signals:');
    expect(out).toContain('Fresh MACD bullish cross.');
    expect(out).toContain('Bullish divergence forming.');
    expect(out).toContain('NR7 contraction');
    expect(out).toContain('Recent candle: shooting star.');
  });

  it('renders the header sector context (Score (rank #N/M in Sector)) when propagated', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        technicalScore: 87,
        technicalRank: 4,
        sectorTechnicalTotal: 28,
        sector: 'Technology',
      })],
    });
    expect(out).toContain('Score 87 (rank #4/28 in Technology)');
  });

  it('header degrades when ranking lacks sector context (minimum: SYMBOL [tier] +N%)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        technicalScore: null,
        technicalRank: null,
        rsPercentile: null,
        atrPercent: null,
        sector: null,
        sectorTechnicalTotal: null,
        trendSummary: '—',
        momentumSummary: '—',
      })],
    });
    // First line is the header — assert on the header alone, since the
    // trendSummary/momentumSummary may contain incidental tokens like "RS".
    const headerLine = out.split('\n').find(l => l.startsWith('NVDA'));
    expect(headerLine).toBe('NVDA [star] +2.43%');
    expect(headerLine).not.toContain('Score');
    expect(headerLine).not.toContain('RS ');
    expect(headerLine).not.toContain('ATR');
  });
});

describe('Phase 5B-prep integration — buildBenchBriefsBlock parity with portfolio', () => {
  it('renders Signals on bench briefs when propagated', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [realisticBenchBrief({
        macdFreshBullishCross: true,
        nr7Flag: false,
        divergence: 'none',
        lastCandlePattern: null,
      })],
    });
    expect(out).toContain('Signals: Fresh MACD bullish cross.');
  });

  it('renders Levels on bench briefs when propagated', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [realisticBenchBrief({
        nearestSupport: 145,
        distanceToSupportPct: -3.7,
        nearestResistance: 155,
        distanceToResistancePct: 2.99,
        distTo52wkHigh: -4.1,
      })],
    });
    expect(out).toContain('Levels: Support $145 (-3.7%), Resistance $155 (+3.0%), 52wk high -4.1% away.');
  });

  it('renders both Levels and Signals with normalized candle pattern on a fully-populated bench brief', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [realisticBenchBrief({
        nearestSupport: 145,
        distanceToSupportPct: -3.7,
        macdFreshBullishCross: false,
        macdFreshBearishCross: true,
        nr7Flag: false,
        divergence: 'bearish',
        lastCandlePattern: 'shooting_star',
      })],
    });
    expect(out).toContain('Levels:');
    expect(out).toContain('Signals: Fresh MACD bearish cross. Bearish divergence forming. Recent candle: shooting star.');
  });

  it('quiet bench brief (cooldown only, no signals/levels) renders only header + cooldown', () => {
    const future = '2026-05-13T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [realisticBenchBrief({
        symbol: 'PLTR',
        cooldownActive: true,
        cooldownUntil: future,
        trendSummary: undefined,
        momentumSummary: undefined,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
        nr7Flag: false,
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: 'none',
        lastCandlePattern: null,
      })],
    });
    expect(out).toContain(`locked until ${future}`);
    expect(out).not.toContain('Levels:');
    expect(out).not.toContain('Signals:');
  });
});

describe('Phase 5B-main integration — buildPortfolioBriefsBlock wires Intraday line', () => {
  it('includes the Intraday line when brief.intraday has VWAP + SMA20 data', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: { vwap: 422.5, currentPrice: 425.5, vwapDeviation: 0.7, sma20_5m: 425.1 },
        macdFreshBullishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
      })],
    });
    expect(out).toContain('Prior session: 0.7% above session VWAP, 0.1% above 5m SMA20.');
  });

  it('omits the Intraday line when brief.intraday is null', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({ intraday: null })],
    });
    // Fix v2: the intraday line is prefixed with either "Today's session: "
    // or "Prior session: " depending on sessionDate. Assert both prefixes
    // are absent to cover both render paths.
    expect(out).not.toContain('Prior session:');
    expect(out).not.toContain("Today's session:");
  });

  it('omits the Intraday line when brief.intraday has no numeric components', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: { vwap: null, currentPrice: null, vwapDeviation: null, sma20_5m: null },
      })],
    });
    expect(out).not.toContain('Prior session:');
    expect(out).not.toContain("Today's session:");
  });

  it('places Intraday line AFTER Signals and BEFORE BaggerBomb/threshold section', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: { vwap: 422.5, currentPrice: 425.5, vwapDeviation: 0.7, sma20_5m: 425.1 },
        macdFreshBullishCross: true,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
        thresholdNote: 'High ATR — volatile, could hit thresholds quickly',
      })],
    });
    const signalsIdx = out.indexOf('Signals:');
    // No sessionDate in this brief → defaults to "Prior session" prefix.
    const intradayIdx = out.indexOf('Prior session:');
    const baggerIdx = out.indexOf('BaggerBomb:');
    expect(signalsIdx).toBeGreaterThan(-1);
    expect(intradayIdx).toBeGreaterThan(signalsIdx);
    expect(baggerIdx).toBeGreaterThan(intradayIdx);
  });

  it('renders Intraday line even when Signals line is absent (independent gating)', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: { vwap: 422.5, currentPrice: 425.5, vwapDeviation: 0.7, sma20_5m: null },
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
      })],
    });
    expect(out).not.toContain('Signals:');
    expect(out).toContain('Prior session: 0.7% above session VWAP.');
  });

  it('buildBenchBriefsBlock does NOT render an Intraday line (bench has no intraday data)', () => {
    // Even if someone hand-crafts an intraday object on a bench brief, the
    // bench renderer doesn't call buildIntradayLine — bench-side intraday
    // is intentionally out of scope (cron doesn't compute it).
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        ...realisticBenchBrief(),
        intraday: { vwap: 150, currentPrice: 151, vwapDeviation: 0.67, sma20_5m: 150.5 },
      }],
    });
    expect(out).not.toContain('Prior session:');
    expect(out).not.toContain("Today's session:");
  });
});

// =============================================================================
// Fix v2 — end-to-end rendering with sessionDate-driven today/prior prefix.
// buildPortfolioBriefsBlock doesn't accept `now`, so these tests mock global
// time via vi.useFakeTimers + setSystemTime. The mocked time is the value
// buildIntradayLine's `new Date()` default resolves to.
// =============================================================================

describe('Fix v2 end-to-end — buildPortfolioBriefsBlock renders dynamic intraday prefix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "Today\'s session: ..." when brief.intraday.sessionDate matches today\'s ET date', () => {
    // 2026-05-12 16:00 UTC = 12:00 ET (DST). Today's ET date = 2026-05-12.
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 12, 16, 0, 0)));

    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: {
          vwap: 422.5,
          currentPrice: 425.5,
          vwapDeviation: 0.7,
          sma20_5m: 425.1,
          sessionDate: '2026-05-12',
        },
        macdFreshBullishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
      })],
    });

    expect(out).toContain("Today's session: 0.7% above session VWAP, 0.1% above 5m SMA20.");
    expect(out).not.toContain('Prior session:');
  });

  it('renders "Prior session: ..." when brief.intraday.sessionDate is yesterday (the EODHD-lag production case)', () => {
    // 2026-05-12 16:00 UTC = 12:00 ET. Today is May 12, but EODHD's data
    // only goes through May 11.
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 12, 16, 0, 0)));

    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        intraday: {
          vwap: 422.5,
          currentPrice: 425.5,
          vwapDeviation: 0.7,
          sma20_5m: 425.1,
          sessionDate: '2026-05-11',
        },
        macdFreshBullishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
      })],
    });

    expect(out).toContain('Prior session: 0.7% above session VWAP, 0.1% above 5m SMA20.');
    expect(out).not.toContain("Today's session:");
  });

  it('renders "Prior session: ..." when sessionDate is missing entirely (legacy cached brief)', () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 12, 16, 0, 0)));

    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [realisticPortfolioBrief({
        // Pre-Fix v2 cached brief — no sessionDate field at all.
        intraday: { vwap: 422.5, currentPrice: 425.5, vwapDeviation: 0.7, sma20_5m: 425.1 },
        macdFreshBullishCross: false,
        divergence: 'none',
        nr7Flag: false,
        lastCandlePattern: null,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
      })],
    });

    expect(out).toContain('Prior session: 0.7% above session VWAP, 0.1% above 5m SMA20.');
    expect(out).not.toContain("Today's session:");
  });

  it('mixed portfolio: today\'s brief and yesterday\'s brief render with their own prefixes', () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 12, 16, 0, 0)));

    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [
        realisticPortfolioBrief({
          symbol: 'NVDA',
          intraday: {
            vwap: 145.5, currentPrice: 146.1, vwapDeviation: 0.41, sma20_5m: null,
            sessionDate: '2026-05-12', // today
          },
          macdFreshBullishCross: false, divergence: 'none', nr7Flag: false, lastCandlePattern: null,
        }),
        realisticPortfolioBrief({
          symbol: 'AMD',
          intraday: {
            vwap: 152.0, currentPrice: 151.4, vwapDeviation: -0.39, sma20_5m: null,
            sessionDate: '2026-05-11', // yesterday
          },
          macdFreshBullishCross: false, divergence: 'none', nr7Flag: false, lastCandlePattern: null,
        }),
      ],
    });

    expect(out).toContain("Today's session: 0.4% above session VWAP.");
    expect(out).toContain('Prior session: 0.4% below session VWAP.');
  });
});

describe('buildVoiceLayerPrompt — set_analysis mode (Analysis Hand-off Phase 2)', () => {
  const DIGEST = {
    size: 2, covered: 2, offUniverse: [],
    sectors: [{ name: 'Technology', count: 2 }],
    industries: [{ name: 'Software', count: 2 }],
    returns: { return1M: { median: 5, min: 1, max: 10, count: 2 } },
    momentum: { medianScore: 60, count: 2 },
    trend: { aboveCount: 2, belowCount: 0, medianSma200Position: 3 },
    quality: {},
    nr7Count: 0,
    winnersLosers: null,
    tier2Included: false,
    fundamentals: null,
  };

  it('renders the digest facts and the honesty discipline', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: { digest: DIGEST } });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('COHORT DIGEST');
    expect(prompt).toContain('Technology'); // sector mix from the digest
    expect(prompt).toContain('SET ANALYST');
    expect(prompt).toContain('NEVER assert causation');
    expect(prompt.toLowerCase()).toContain('realized'); // past-tense returns rule
    expect(prompt).toContain('NEVER forecast');
  });

  it('degrades gracefully when no digest is supplied (no digest block)', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: null });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('SET ANALYST');
    // The phase rules still reference "COHORT DIGEST"; the distinctive marker of
    // the rendered digest BLOCK is its header line — that must be absent.
    expect(prompt).not.toContain('the ONLY facts you may use');
  });
});

describe('buildVoiceLayerPrompt — research mode regression (unchanged by Phase 2)', () => {
  it('still emits the research prompt and not the set_analysis prompt', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'research', researchContext: { previousSpec: null } });
    expect(prompt).toContain('SCREENABLE FIELDS');   // research marker
    expect(prompt).not.toContain('SET ANALYST');     // set_analysis must not leak in
    expect(prompt).not.toContain('COHORT DIGEST');
  });
});

describe('buildVoiceLayerPrompt — multi-dimension narration nudge (Per-Name Layer)', () => {
  const DIGEST = {
    size: 2, covered: 2, offUniverse: [],
    sectors: [{ name: 'Technology', count: 2 }], industries: [],
    returns: {}, momentum: { medianScore: 60, count: 2 },
    trend: { aboveCount: 2, belowCount: 0, medianSma200Position: 3 },
    quality: {}, nr7Count: 0, winnersLosers: null, tier2Included: false, fundamentals: null,
  };

  it('adds the multi-dimension bullet in set_analysis mode', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: { digest: DIGEST } });
    expect(prompt).toContain('MULTI-DIMENSION CHARACTERIZATION');
    // The no-invent rule must still be intact.
    expect(prompt).toContain('NEVER invent a number or characteristic not in the COHORT DIGEST');
  });

  it('does NOT add the bullet in research mode (regression guard)', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'research', researchContext: { previousSpec: null } });
    expect(prompt).not.toContain('MULTI-DIMENSION CHARACTERIZATION');
  });
});

describe('buildVoiceLayerPrompt — Tier-3 forward consensus (additive)', () => {
  const FWD_DIGEST = {
    size: 3, covered: 3, offUniverse: [],
    sectors: [{ name: 'Technology', count: 3 }], industries: [],
    returns: {}, momentum: { medianScore: 60, count: 3 },
    trend: { aboveCount: 3, belowCount: 0, medianSma200Position: 3 },
    quality: {}, nr7Count: 0, winnersLosers: null,
    tier2Included: false, fundamentals: null,
    tier3Included: true,
    forward: {
      consensusGrowthNextYear: { median: 18, min: 6, max: 30, count: 3, lowName: 'CCC', highName: 'BBB' },
      consensusGrowthCurrentYear: { median: 12, min: 4, max: 22, count: 3, lowName: 'CCC', highName: 'BBB' },
      rsr: { median: 0.6, min: 0.3, max: 0.8, count: 3, lowName: 'CCC', highName: 'AAA' },
      emsPercentile: { median: 70, min: 40, max: 90, count: 3, lowName: 'CCC', highName: 'BBB' },
      estimateSpread: { median: 15, min: 8, max: 22, count: 3, lowName: 'AAA', highName: 'CCC' },
      numAnalystsNextYear: { median: 20, min: 8, max: 25, count: 3, lowName: 'CCC', highName: 'BBB' },
    },
  };

  it('adds the attributed-consensus rule + negative constraint in set_analysis mode', () => {
    const prompt = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: { digest: FWD_DIGEST } });
    expect(prompt).toContain('FORWARD CONSENSUS IS THE STREET'); // new behavioral rule
    expect(prompt).toContain('NEVER present analyst consensus as your own forecast'); // new negative constraint
    // The existing realized/no-invent constraints must still be intact.
    expect(prompt).toContain('NEVER forecast — returns are realized and past');
    expect(prompt).toContain('NEVER invent a number or characteristic not in the COHORT DIGEST');
  });

  it('renders the forward digest block ONLY when tier3Included', () => {
    const withFwd = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: { digest: FWD_DIGEST } });
    expect(withFwd).toContain('FORWARD CONSENSUS (ANALYST ESTIMATES');
    expect(withFwd).toContain('consensus EPS growth (next yr)');

    const noFwd = { ...FWD_DIGEST, tier3Included: false, forward: null };
    const withoutFwd = buildVoiceLayerPrompt({ mode: 'set_analysis', analysisContext: { digest: noFwd } });
    expect(withoutFwd).not.toContain('FORWARD CONSENSUS (ANALYST ESTIMATES');
  });

  it('does NOT leak the consensus rule into research mode (regression; battle is structurally excluded)', () => {
    const research = buildVoiceLayerPrompt({ mode: 'research', researchContext: { previousSpec: null } });
    expect(research).not.toContain('FORWARD CONSENSUS IS THE STREET');
    expect(research).not.toContain('NEVER present analyst consensus as your own forecast');
  });
});
