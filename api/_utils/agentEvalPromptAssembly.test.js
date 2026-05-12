// api/_utils/agentEvalPromptAssembly.test.js
// Spec A Phase 2a: tests for buildVisionStateBlock.

import { describe, it, expect } from 'vitest';
import { buildVisionStateBlock, buildBenchTechnicalBlock } from './agentEvalPromptAssembly.js';

// ==================== FIXTURES ====================

function makeVisionState({
  state = 'active',
  thesisStatement = 'Tech leadership rotates into AI infra over the next two weeks.',
  direction = 'long',
  scope = ['NVDA', 'AMD'],
  drivers = ['datacenter capex', 'guidance raise'],
  confidence = 'high',
  confidenceFloat = 0.85,
  activeConstraints = [],
} = {}) {
  return {
    present: true,
    state,
    thesis: {
      statement: thesisStatement,
      structuredSummary: { direction, scope, drivers },
    },
    confidence,
    confidenceFloat,
    activeConstraints,
  };
}

function makeConstraint(type, payload, id = 'c1') {
  return { id, type, payload };
}

// ==================== TESTS ====================

describe('buildVisionStateBlock', () => {
  it('returns empty string when visionState is missing', () => {
    expect(buildVisionStateBlock(null)).toBe('');
    expect(buildVisionStateBlock(undefined)).toBe('');
  });

  it('returns empty string when present is false', () => {
    expect(buildVisionStateBlock({ present: false })).toBe('');
  });

  it('returns empty string for unknown state', () => {
    expect(buildVisionStateBlock({ present: true, state: 'mystery' })).toBe('');
  });

  it('renders unformed state', () => {
    const out = buildVisionStateBlock({ present: true, state: 'unformed' });
    expect(out).toContain('## Vision State');
    expect(out).toContain('No active Vision');
    expect(out).toContain('conservatively');
  });

  it('renders proposed state with thesis', () => {
    const vs = makeVisionState({ state: 'proposed', thesisStatement: 'Buy the dip in semis.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('PROPOSED');
    expect(out).toContain('Buy the dip in semis.');
    expect(out).toContain('awaiting confirmation');
  });

  it('renders active state with thesis, direction, scope, drivers, confidence', () => {
    const vs = makeVisionState();
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('ACTIVE thesis');
    expect(out).toContain('confidence: high / 0.85');
    expect(out).toContain('Direction: long');
    expect(out).toContain('Scope: NVDA, AMD');
    expect(out).toContain('Drivers: datacenter capex, guidance raise');
    expect(out).toContain('Active constraints (0):');
    expect(out).toContain('  (none)');
  });

  it('renders active state with user_carveout constraints', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('user_carveout', { statement: 'never short crypto' }, 'c1'),
        makeConstraint('user_carveout', { statement: 'avoid TSLA' }, 'c2'),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Active constraints (2):');
    expect(out).toContain('[user_carveout] never short crypto');
    expect(out).toContain('[user_carveout] avoid TSLA');
  });

  it('truncates thesis statements over 500 chars with ellipsis', () => {
    const long = 'A'.repeat(600);
    const vs = makeVisionState({ thesisStatement: long });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('A'.repeat(500) + '…');
    expect(out).not.toContain('A'.repeat(501));
  });

  it('summarizes more than 10 constraints with overflow line', () => {
    const constraints = Array.from({ length: 13 }, (_, i) =>
      makeConstraint('user_carveout', { statement: `rule ${i}` }, `c${i}`)
    );
    const vs = makeVisionState({ activeConstraints: constraints });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Active constraints (13):');
    expect(out).toContain('rule 0');
    expect(out).toContain('rule 9');
    expect(out).not.toContain('rule 10');
    expect(out).toContain('(3 additional constraints not shown)');
  });

  it('renders category_b_forge constraints with ruleKind and ruleId', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('category_b_forge', { ruleKind: 'stop_loss', ruleId: 'r_42' }),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('[category_b_forge] stop_loss: r_42');
  });

  it('renders system_injected constraints with scope and cause', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('system_injected', { scope: 'position', eventCause: 'earnings_blackout' }),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('[system_injected] position: earnings_blackout');
  });

  it('renders under_debate state', () => {
    const vs = makeVisionState({ state: 'under_debate', thesisStatement: 'Rates pivot mid-quarter.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('UNDER DEBATE');
    expect(out).toContain('Rates pivot mid-quarter.');
    expect(out).toContain('raise conviction floors');
  });

  it('renders stale state', () => {
    const vs = makeVisionState({ state: 'stale', thesisStatement: 'Old thesis.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('STALE');
    expect(out).toContain('Old thesis.');
    expect(out).toContain('Trade conservatively');
  });

  it('renders retired state defensively', () => {
    const vs = makeVisionState({ state: 'retired' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Battle is ending');
    expect(out).toContain('No new directional decisions');
  });

  it('handles missing confidenceFloat gracefully in active state', () => {
    const vs = makeVisionState();
    delete vs.confidenceFloat;
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('confidence: high / —');
  });

  it('handles missing scope/drivers in active state', () => {
    const vs = makeVisionState({ scope: [], drivers: [] });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Scope: (unscoped)');
    expect(out).toContain('Drivers: (no named drivers)');
  });
});

// ==================== buildBenchTechnicalBlock — Workstream B ====================

function makeRanking({
  symbol = 'NVDA',
  sectorName = 'Technology',
  trend = { shortTerm: 'up', intermediate: 'up', longTerm: 'up' },
  sma200_position = 5.4,
  momentum = { divergence: 'none' },
  levels = { nearestSupport: 89.2, nearestResistance: 97.8, distanceToSupportPct: -4.5, distanceToResistancePct: 4.6 },
  recentAction = { lastCandlePattern: null },
  technicalScore = 78,
  technicalRank = 23,
} = {}) {
  return {
    symbol,
    sectorName,
    trend,
    sma200_position,
    momentum,
    levels,
    recentAction,
    technicalScore,
    technicalRank,
  };
}

function makeTech({
  factors = {
    rsi: 58,
    macdAboveSignal: true,
    macdFreshBullishCross: false,
    macdFreshBearishCross: false,
    rsPercentile: 72,
    sectorRSPercentile: 85,
  },
  bbPercentB = 0.65,
  atrPercent = 2.5,
  volumeProfile = { tier: 'NORMAL', ratio: 1.1, avgVolume: 50000000 },
} = {}) {
  return { factors, bbPercentB, atrPercent, volumeProfile };
}

function makeBench({ stocks = [], crypto = null } = {}) {
  return { stocks, crypto };
}

describe('buildBenchTechnicalBlock', () => {
  it('returns null for null bench', () => {
    expect(buildBenchTechnicalBlock(null, {}, {})).toBeNull();
  });

  it('returns null for empty bench', () => {
    expect(buildBenchTechnicalBlock(makeBench(), {}, {})).toBeNull();
  });

  it('returns null when bench has only a crypto entry (no rankings/tech to render)', () => {
    const bench = makeBench({ crypto: { symbol: 'BTC-USD', sector: 'Crypto', isCrypto: true } });
    expect(buildBenchTechnicalBlock(bench, {}, {})).toBeNull();
  });

  it('renders a single stock with full data — all eight sections present', () => {
    const bench = makeBench({
      stocks: [{ symbol: 'NVDA', sector: 'Technology', baseATR: 3.5 }],
    });
    const rankingsMap = {
      NVDA: makeRanking({
        symbol: 'NVDA',
        recentAction: { lastCandlePattern: 'hammer' },
        momentum: { divergence: 'bullish' },
      }),
    };
    const techScoresMap = { NVDA: makeTech() };

    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);

    expect(out).toContain('BENCH TECHNICAL CONTEXT:');
    expect(out).toContain('NVDA (Technology):');
    expect(out).toContain('Trend: short=up, intermediate=up, long=up | sma200_position=+5.40%');
    expect(out).toContain('Momentum: RSI=58, MACD above signal (no fresh cross), divergence=bullish');
    expect(out).toContain('Volatility: BB %B=0.65 (upper-middle) | ATR regime: normal');
    expect(out).toContain('Volume: NORMAL tier | RVOL=1.10');
    expect(out).toContain('Relative strength: rsPercentile=72 (leading) | sector RS=85');
    expect(out).toContain('Levels: support 89.20 (-4.50%), resistance 97.80 (+4.60%)');
    expect(out).toContain('Recent action: hammer');
    expect(out).toContain('Composite: technicalScore=78, technicalRank=23');
  });

  it('omits per-section lines when their source data is null', () => {
    const bench = makeBench({
      stocks: [{ symbol: 'AMD', sector: 'Technology', baseATR: 4.2 }],
    });
    const rankingsMap = {
      AMD: makeRanking({
        symbol: 'AMD',
        sectorName: 'Technology',
        momentum: { divergence: null },
        levels: { nearestSupport: null, nearestResistance: null, distanceToSupportPct: null, distanceToResistancePct: null },
        recentAction: { lastCandlePattern: null },
      }),
    };
    const techScoresMap = { AMD: makeTech() };

    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);

    expect(out).toContain('AMD (Technology):');
    expect(out).toContain('Trend:');
    expect(out).toContain('Momentum: RSI=58, MACD above signal');
    // Divergence omitted entirely from the momentum line when null
    expect(out).not.toContain('divergence=');
    // Levels block omitted entirely when both endpoints null
    expect(out).not.toContain('Levels:');
    // Recent action omitted when no pattern
    expect(out).not.toContain('Recent action:');
  });

  it('renders ranking-only data when techScores entry is missing', () => {
    const bench = makeBench({
      stocks: [{ symbol: 'TSLA', sector: 'Consumer Cyclical', baseATR: 5.0 }],
    });
    const rankingsMap = {
      TSLA: makeRanking({
        symbol: 'TSLA',
        sectorName: 'Consumer Cyclical',
        // null divergence so Momentum line is purely tech-driven (and therefore absent)
        momentum: { divergence: null },
        recentAction: { lastCandlePattern: 'doji' },
      }),
    };
    const techScoresMap = {}; // no tech entry for TSLA

    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);

    expect(out).toContain('TSLA (Consumer Cyclical):');
    expect(out).toContain('Trend:');
    expect(out).toContain('Levels:');
    expect(out).toContain('Recent action: doji');
    expect(out).toContain('Composite: technicalScore=78');
    // tech-derived lines must be absent
    expect(out).not.toContain('Momentum:');
    expect(out).not.toContain('Volatility:');
    expect(out).not.toContain('Volume:');
    expect(out).not.toContain('Relative strength:');
  });

  it('renders Momentum line with only divergence when tech is missing but ranking.momentum has data', () => {
    const bench = makeBench({ stocks: [{ symbol: 'AAPL', sector: 'Technology' }] });
    const rankingsMap = {
      AAPL: makeRanking({ symbol: 'AAPL', momentum: { divergence: 'bearish' } }),
    };
    const out = buildBenchTechnicalBlock(bench, rankingsMap, {});
    expect(out).toContain('Momentum: divergence=bearish');
  });

  // F3.4 — compound snake_case pattern names are normalized via PATTERN_DISPLAY_NAMES.
  it('renders "Recent action: bullish engulfing" for snake_case bullish_engulfing', () => {
    const bench = makeBench({ stocks: [{ symbol: 'NVDA', sector: 'Technology' }] });
    const rankingsMap = {
      NVDA: makeRanking({ symbol: 'NVDA', recentAction: { lastCandlePattern: 'bullish_engulfing' } }),
    };
    const out = buildBenchTechnicalBlock(bench, rankingsMap, {});
    expect(out).toContain('Recent action: bullish engulfing');
    expect(out).not.toContain('bullish_engulfing');
  });

  it('renders "Recent action: shooting star" for snake_case shooting_star', () => {
    const bench = makeBench({ stocks: [{ symbol: 'NVDA', sector: 'Technology' }] });
    const rankingsMap = {
      NVDA: makeRanking({ symbol: 'NVDA', recentAction: { lastCandlePattern: 'shooting_star' } }),
    };
    const out = buildBenchTechnicalBlock(bench, rankingsMap, {});
    expect(out).toContain('Recent action: shooting star');
    expect(out).not.toContain('shooting_star');
  });

  it('skips a symbol entirely when both ranking and tech are missing', () => {
    const bench = makeBench({
      stocks: [
        { symbol: 'NVDA', sector: 'Technology' },
        { symbol: 'GHOST', sector: 'Unknown' },
      ],
    });
    const rankingsMap = { NVDA: makeRanking() };
    const techScoresMap = { NVDA: makeTech() };

    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);

    expect(out).toContain('NVDA (Technology):');
    expect(out).not.toContain('GHOST');
  });

  it('renders multiple stocks separated by blank lines and excludes crypto', () => {
    const bench = makeBench({
      stocks: [
        { symbol: 'NVDA', sector: 'Technology', baseATR: 3.5 },
        { symbol: 'NEE', sector: 'Utilities', baseATR: 1.8 },
      ],
      crypto: { symbol: 'BTC-USD', sector: 'Crypto', isCrypto: true },
    });
    const rankingsMap = {
      NVDA: makeRanking({ symbol: 'NVDA' }),
      NEE: makeRanking({ symbol: 'NEE', sectorName: 'Utilities', sma200_position: 12.5, technicalScore: 65, technicalRank: 40 }),
    };
    const techScoresMap = { NVDA: makeTech(), NEE: makeTech() };

    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);

    expect(out).toContain('NVDA (Technology):');
    expect(out).toContain('NEE (Utilities):');
    // Crypto must NOT appear
    expect(out).not.toContain('BTC-USD');
    // Two blocks separated by a blank line
    const nvdaIdx = out.indexOf('NVDA (Technology):');
    const neeIdx = out.indexOf('NEE (Utilities):');
    expect(nvdaIdx).toBeGreaterThanOrEqual(0);
    expect(neeIdx).toBeGreaterThan(nvdaIdx);
    expect(out.slice(nvdaIdx, neeIdx)).toContain('\n\n');
  });

  it('renders fresh-cross MACD phrase and rsPercentile leading/lagging labels', () => {
    const bench = makeBench({ stocks: [{ symbol: 'PLTR', sector: 'Technology' }] });
    const rankingsMap = { PLTR: makeRanking({ symbol: 'PLTR' }) };
    const techScoresMap = {
      PLTR: makeTech({
        factors: {
          rsi: 28,
          macdAboveSignal: false,
          macdFreshBullishCross: false,
          macdFreshBearishCross: true,
          rsPercentile: 18,
          sectorRSPercentile: 30,
        },
        bbPercentB: 0.05,
        atrPercent: 4.5,
      }),
    };
    const out = buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap);
    expect(out).toContain('MACD below signal (fresh bearish cross)');
    expect(out).toContain('rsPercentile=18 (lagging)');
    expect(out).toContain('BB %B=0.05 (lower band)');
    expect(out).toContain('ATR regime: extreme');
  });
});
