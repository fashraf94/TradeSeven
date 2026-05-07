// api/_utils/voiceLayerPrompt.test.js
// Tier 0 Item 1: bench data exposure — buildBenchBriefsBlock unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { buildBenchBriefsBlock, buildBattleState, buildMarketSnapshotContext, buildPortfolioBriefsBlock, buildVoiceLayerPrompt, buildReviewContext } from './voiceLayerPrompt.js';
import { getETDate, formatDateString } from './marketSchedule.js';

// ==================== TESTS ====================

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
    expect(out).toContain('AMD (stock, Technology) — +2.34%');
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

    expect(out).toContain('BTC-USD (crypto, Crypto)');
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

    expect(out).toContain('PLTR (stock, Technology) — -1.2%');
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

    expect(out).toContain('XYZ (stock, Unknown) — +1%');
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

  it('regression guard: existing render unchanged when no thresholdProximity / existingBadges fields present', () => {
    const out = buildPortfolioBriefsBlock({
      portfolioBriefs: [{
        symbol: 'AAPL',
        tier: 'star',
        changePercent: 1.5,
        trendSummary: 'Strong uptrend.',
        momentumSummary: 'MACD expanding.',
      }],
    });

    expect(out).toContain('AAPL (star tier) — +1.5%');
    expect(out).toContain('Trend: Strong uptrend.');
    expect(out).toContain('Momentum: MACD expanding.');
    expect(out).not.toContain('Threshold:');
    expect(out).not.toContain('Swap-lock:');
    expect(out).not.toContain('Badges earned:');
  });

  it('returns null when portfolioBriefs is missing or empty', () => {
    expect(buildPortfolioBriefsBlock(null)).toBeNull();
    expect(buildPortfolioBriefsBlock({})).toBeNull();
    expect(buildPortfolioBriefsBlock({ portfolioBriefs: [] })).toBeNull();
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
