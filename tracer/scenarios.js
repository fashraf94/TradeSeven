// Three fixture scenarios for the Tracer Bullet per Tracer plan §3.
// Each scenario is a complete EvaluationContext (Stage 0 input).
// Scenario 2's universe includes TICKER_X (the held losing position) so the Aggregator
// produces a candidate row for it — required by §6 universe-equality invariant.

const TICK_TIMESTAMP = 1714867200000;
const COMMON_AGENT_ID = 'agent_tracer_001';
const COMMON_BATTLE_ID = 'battle_tracer_001';
const SHARED_REGIME = { regimeLabel: 'neutral', confidence: 0.5 };

function commonMarketState(extraSnapshots = {}) {
  return {
    timestamp: TICK_TIMESTAMP,
    regimeContext: SHARED_REGIME,
    tickerSnapshots: {
      TICKER_A: { ticker: 'TICKER_A', price: 150, priceTimestamp: TICK_TIMESTAMP, dayOpen: 148, dayHigh: 152, dayLow: 147, dayVolume: 5_200_000, averageVolume30d: 5_000_000, rsi14: 55, sector: 'Information Technology', marketCap: 50_000_000_000 },
      TICKER_B: { ticker: 'TICKER_B', price:  80, priceTimestamp: TICK_TIMESTAMP, dayOpen:  79, dayHigh:  81, dayLow:  78, dayVolume: 3_100_000, averageVolume30d: 3_000_000, rsi14: 45, sector: 'Health Care',            marketCap: 30_000_000_000 },
      TICKER_C: { ticker: 'TICKER_C', price: 220, priceTimestamp: TICK_TIMESTAMP, dayOpen: 218, dayHigh: 222, dayLow: 217, dayVolume: 1_500_000, averageVolume30d: 1_500_000, rsi14: 70, sector: 'Financials',             marketCap: 80_000_000_000 },
      TICKER_D: { ticker: 'TICKER_D', price:  45, priceTimestamp: TICK_TIMESTAMP, dayOpen:  45, dayHigh:  46, dayLow:  44, dayVolume:   800_000, averageVolume30d:   800_000, rsi14: 30, sector: 'Consumer Discretionary', marketCap:  5_000_000_000 },
      TICKER_E: { ticker: 'TICKER_E', price:  12, priceTimestamp: TICK_TIMESTAMP, dayOpen:  12, dayHigh:  13, dayLow:  11, dayVolume:   200_000, averageVolume30d:   200_000, rsi14: 50, sector: 'Energy',                 marketCap:    800_000_000 },
      ...extraSnapshots,
    },
  };
}

// === Scenario 1: Happy Path ===
// Two convergent buys on TICKER_A; single buy on TICKER_C; Tilt Aware does not fire.
const happyPath = {
  name: 'Happy Path',
  evaluationContext: {
    evaluationId: 'eval_happy_001',
    battleId: COMMON_BATTLE_ID,
    agentId: COMMON_AGENT_ID,
    tickTimestamp: TICK_TIMESTAMP,
    tickReason: 'scheduled',
    universe: {
      tickers: ['TICKER_A', 'TICKER_B', 'TICKER_C', 'TICKER_D', 'TICKER_E'],
      source: 'archetype_default',
    },
    marketState: commonMarketState(),
    agentState: {
      portfolioValue: 100_000,
      cashAvailable: 50_000,
      currentPositions: [
        {
          ticker: 'TICKER_X', sharesHeld: 100, averageEntryPrice: 100, currentPrice: 105,
          unrealizedPnL: 500, unrealizedPnLPct: 5,
          sector: 'Industrials', openedAt: TICK_TIMESTAMP - 86_400_000,
          sizePct: 10.5, marketValue: 10_500,
        },
      ],
      sessionPnL: 250,
      sessionPnLPct: 0.25,
      recentTradeOutcomes: [],
      lossStreakCount: 0,
      winStreakCount: 1,
      tradesThisSession: 1,
      sectorExposures: { Industrials: 10.5 },
    },
    loadout: {
      constraints: {
        constraintSetVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        maxDrawdownTrigger: { enabled: true, maxDrawdownPct: 8, appliesTo: 'new_buys_only' },
        liquidityFloor:     { enabled: true, minDollarVolume30d: 2_000_000, appliesTo: 'all' },
        maxOpenPositions:   { enabled: true, maxCount: 8, countingMethod: 'all_positions' },
        minCashReserve:     { enabled: true, minCashReservePct: 15 },
        maxSectorExposure:  { enabled: true, maxSectorPct: 35, taxonomy: 'GICS_sector' },
        maxPositionSize:    { enabled: true, maxSizePct: 12, appliesTo: 'new_positions' },
      },
      sizingPolicy: {
        sizingPolicyVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        method: 'linear', baseSizePct: 3, maxSizePct: 10,
        convictionFloor: 40, agreementWeight: 0.5,
      },
      quantSkills: [
        { instanceId: 'qs_01', templateId: 'breakout_hunter', name: 'Breakout Hunter', userWeight: 1.0, parameters: {}, equippedAt: 0 },
        { instanceId: 'qs_02', templateId: 'momentum_rider',  name: 'Momentum Rider',  userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
      behavioralSkills: [
        { instanceId: 'bs_01', templateId: 'tilt_aware', name: 'Tilt Aware', userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
    },
  },
};

// === Scenario 2: Behavioral Veto ===
// Mean Reversion produces sell on TICKER_X (held at -8.5% loss); Diamond Hands vetoes.
const tickerXSnapshot = {
  TICKER_X: { ticker: 'TICKER_X', price: 91.5, priceTimestamp: TICK_TIMESTAMP, dayOpen: 92, dayHigh: 93, dayLow: 91, dayVolume: 1_000_000, averageVolume30d: 1_000_000, rsi14: 28, sector: 'Industrials', marketCap: 20_000_000_000 },
};
const behavioralVeto = {
  name: 'Behavioral Veto',
  evaluationContext: {
    evaluationId: 'eval_veto_001',
    battleId: COMMON_BATTLE_ID,
    agentId: COMMON_AGENT_ID,
    tickTimestamp: TICK_TIMESTAMP,
    tickReason: 'scheduled',
    universe: {
      tickers: ['TICKER_A', 'TICKER_B', 'TICKER_C', 'TICKER_D', 'TICKER_E', 'TICKER_X'],
      source: 'archetype_default',
    },
    marketState: commonMarketState(tickerXSnapshot),
    agentState: {
      portfolioValue: 100_000,
      cashAvailable: 50_000,
      currentPositions: [
        {
          ticker: 'TICKER_X', sharesHeld: 100, averageEntryPrice: 100, currentPrice: 91.5,
          unrealizedPnL: -850, unrealizedPnLPct: -8.5,
          sector: 'Industrials', openedAt: TICK_TIMESTAMP - 86_400_000,
          sizePct: 9.15, marketValue: 9_150,
        },
      ],
      sessionPnL: -200,
      sessionPnLPct: -0.2,
      recentTradeOutcomes: [],
      lossStreakCount: 0,
      winStreakCount: 0,
      tradesThisSession: 1,
      sectorExposures: { Industrials: 9.15 },
    },
    loadout: {
      constraints: {
        constraintSetVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        maxDrawdownTrigger: { enabled: true, maxDrawdownPct: 8, appliesTo: 'new_buys_only' },
        liquidityFloor:     { enabled: true, minDollarVolume30d: 2_000_000, appliesTo: 'all' },
        maxOpenPositions:   { enabled: true, maxCount: 8, countingMethod: 'all_positions' },
        minCashReserve:     { enabled: true, minCashReservePct: 15 },
        maxSectorExposure:  { enabled: true, maxSectorPct: 35, taxonomy: 'GICS_sector' },
        maxPositionSize:    { enabled: true, maxSizePct: 12, appliesTo: 'new_positions' },
      },
      sizingPolicy: {
        sizingPolicyVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        method: 'linear', baseSizePct: 3, maxSizePct: 10,
        convictionFloor: 40, agreementWeight: 0.5,
      },
      quantSkills: [
        { instanceId: 'qs_01', templateId: 'mean_reversion', name: 'Mean Reversion', userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
      behavioralSkills: [
        { instanceId: 'bs_01', templateId: 'diamond_hands', name: 'Diamond Hands', userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
    },
  },
};

// === Scenario 3: Constraint Clamp ===
// Strong buy on TICKER_A (Tech). Existing 28% Tech exposure forces sector clamp to 7%.
const constraintClamp = {
  name: 'Constraint Clamp',
  evaluationContext: {
    evaluationId: 'eval_clamp_001',
    battleId: COMMON_BATTLE_ID,
    agentId: COMMON_AGENT_ID,
    tickTimestamp: TICK_TIMESTAMP,
    tickReason: 'scheduled',
    universe: {
      tickers: ['TICKER_A', 'TICKER_B', 'TICKER_C', 'TICKER_D', 'TICKER_E'],
      source: 'archetype_default',
    },
    marketState: commonMarketState(),
    agentState: {
      portfolioValue: 100_000,
      cashAvailable: 72_000,
      currentPositions: [
        {
          ticker: 'TICKER_W', sharesHeld: 50, averageEntryPrice: 200, currentPrice: 220,
          unrealizedPnL: 1_000, unrealizedPnLPct: 10,
          sector: 'Information Technology', openedAt: TICK_TIMESTAMP - 86_400_000,
          sizePct: 11.0, marketValue: 11_000,
        },
        {
          ticker: 'TICKER_Y', sharesHeld: 200, averageEntryPrice: 80, currentPrice: 85,
          unrealizedPnL: 1_000, unrealizedPnLPct: 6.25,
          sector: 'Information Technology', openedAt: TICK_TIMESTAMP - 86_400_000,
          sizePct: 17.0, marketValue: 17_000,
        },
      ],
      sessionPnL: 100,
      sessionPnLPct: 0.1,
      recentTradeOutcomes: [],
      lossStreakCount: 0,
      winStreakCount: 1,
      tradesThisSession: 0,
      sectorExposures: { 'Information Technology': 28.0 },
    },
    loadout: {
      constraints: {
        constraintSetVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        maxDrawdownTrigger: { enabled: true, maxDrawdownPct: 8, appliesTo: 'new_buys_only' },
        liquidityFloor:     { enabled: true, minDollarVolume30d: 2_000_000, appliesTo: 'all' },
        maxOpenPositions:   { enabled: true, maxCount: 8, countingMethod: 'all_positions' },
        minCashReserve:     { enabled: true, minCashReservePct: 15 },
        maxSectorExposure:  { enabled: true, maxSectorPct: 35, taxonomy: 'GICS_sector' },
        maxPositionSize:    { enabled: true, maxSizePct: 12, appliesTo: 'new_positions' },
      },
      sizingPolicy: {
        sizingPolicyVersion: 1, archetypeId: 'balanced_v1', archetypeVersion: 1,
        method: 'linear', baseSizePct: 3, maxSizePct: 10,
        convictionFloor: 40, agreementWeight: 0.5,
      },
      quantSkills: [
        { instanceId: 'qs_01', templateId: 'breakout_hunter', name: 'Breakout Hunter', userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
      behavioralSkills: [
        { instanceId: 'bs_01', templateId: 'tilt_aware', name: 'Tilt Aware', userWeight: 1.0, parameters: {}, equippedAt: 0 },
      ],
    },
  },
};

// Constraint Clamp overrides Breakout Hunter's TICKER_A from default conviction=75 to 85
// (strong tech buy) to drive sector-cap clamping. Tracer plan §3.3.
constraintClamp.stubOverrides = {
  breakout_hunter: {
    TICKER_A: { conviction: 85, signal: 'buy', reasonFragment: 'Strong tech breakout', triggeredCriteria: ['volume_breakout', 'rsi_confirm'], ignoredCriteria: [] },
  },
};

export const all = [happyPath, behavioralVeto, constraintClamp];
