// api/_utils/__fixtures__/voiceGroundingFixtures.js
//
// Voice-layer grounding — the DETERMINISTIC fixtures every golden and every
// flag-on row in the arc renders from. One module, so the off-state goldens
// (voiceLayerPrompt.grounding.goldens.test.js) and the grounded-prompt rows
// (voiceLayerPrompt.grounding.test.js) describe the same battle and cannot
// drift on what "the record" contains.
//
// Everything a prompt builder reads off these objects is fixed: the clock is
// frozen by the tests to FROZEN_NOW (a Tuesday, 11:47 ET, the market open),
// the battle's trading days include that date, and every timestamp is an ISO
// string. The record carries the cases the spec names: a HOLD with an inline
// `**Hypothesis: …**` duplicate of the `hypothesis` field (§3.2a's known
// pair), a SWAP with a distinct hypothesis, a guardrail-authored rationale
// (D-72: "The system's reason"), a timed-out tick and a budget-skipped tick
// (D-65 / D-69: the absence lines), and a fifth, oldest entry that the
// three-entry window must drop.
//
// The cache briefs carry a `fundamentals` field the pre-grounding renderer
// does not know: under 'off' it must be ignored (the golden proves it), under
// the flag it renders as the §3.5 line.
//
// ZERO imports on purpose (the promptHonestyRegistry precedent): this module
// must never join a mocked graph.

export const FROZEN_NOW = '2026-09-08T15:47:00.000Z'; // Tue Sep 8 2026, 11:47 AM ET

export const CANARY_UID = 'owner-uid-1';

export function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    ownerId: CANARY_UID,
    name: 'Vega',
    archetype: 'momentum_chaser',
    stats: { gamesPlayed: 4, wins: 2, losses: 2 },
    partnerProfile: {
      risk_appetite: { value: 'aggressive', confidence: 0.6 },
      sector_convictions: { value: 'semis', confidence: 0.5 },
      loss_reaction: { value: 'cuts fast', confidence: 0.2 },
    },
    convictions: [
      { text: 'Semis lead when breadth confirms', confidence: 0.7, condition: 'breadth widening' },
      { text: 'Energy fades into the close on down days', confidence: 0.4 },
      { text: 'Below threshold', confidence: 0.2 },
    ],
    consolidatedInsight: 'Trend continuation beats mean reversion in this book.',
    ...overrides,
  };
}

export const EVALUATIONS = Object.freeze([
  // Oldest — outside the three-entry window; also budget-skipped (D-69).
  {
    evalId: 'eval_001',
    timestamp: '2026-09-08T14:30:12.000Z', // 10:30 ET
    decision: 'HOLD',
    symbolOut: null,
    symbolIn: null,
    tier: null,
    rationale: 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.',
    hypothesis: null,
    conviction: 0,
    triggers: ['forced_open'],
    haikuError: { failureClass: 'budget_skipped', message: 'budget', timestamp: '2026-09-08T14:30:12.000Z', evalId: 'eval_001' },
  },
  // A timed-out tick (D-65): the cron's placeholder words, never the agent's.
  {
    evalId: 'eval_002',
    timestamp: '2026-09-08T14:45:20.000Z', // 10:45 ET
    decision: 'HOLD',
    symbolOut: null,
    symbolIn: null,
    tier: null,
    rationale: 'Haiku call failed — defaulting to HOLD',
    hypothesis: null,
    conviction: 0,
    triggers: ['threshold_proximity'],
    haikuError: { failureClass: 'timeout', message: 'aborted', timestamp: '2026-09-08T14:45:20.000Z', evalId: 'eval_002' },
  },
  // A guardrail-forced swap that EXECUTED: engine-authored rationale (D-72).
  {
    evalId: 'eval_003',
    timestamp: '2026-09-08T15:00:41.000Z', // 11:00 ET
    decision: 'SWAP',
    symbolOut: 'GILD',
    symbolIn: 'MOS',
    tier: 'core',
    rationale: 'Guardrail override (guardrail_stopLoss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.',
    hypothesis: 'Hypothesis: deterministic guardrail enforcement — stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.',
    conviction: 70,
    triggers: ['price_drop', 'vwap_deviation'],
    haikuError: null,
    guardrailOverrides: [{ action: 'forced_exit', symbol: 'GILD', replacementSymbol: 'MOS' }],
    guardrailSourceNote: 'guardrail_stopLoss',
  },
  // The model's own SWAP with a hypothesis distinct from the rationale.
  {
    evalId: 'eval_004',
    timestamp: '2026-09-08T15:15:33.000Z', // 11:15 ET
    decision: 'SWAP',
    symbolOut: 'KO',
    symbolIn: 'AVGO',
    tier: 'support',
    rationale: "KO has gone dead money for three sessions while the semis keep leading. AVGO's relative strength is the cleanest on the bench and volume confirmed the push. I'll rotate the support slot into strength and keep the star untouched.",
    hypothesis: 'Hypothesis: AVGO closes above its 20-day within two sessions and holds the support slot.',
    conviction: 78,
    triggers: ['bench_outperformance'],
    haikuError: null,
  },
  // Newest — a HOLD whose rationale ends with the SAME hypothesis inline, bold
  // (§3.2a's known pair: field vs `**Hypothesis: …**`).
  {
    evalId: 'eval_005',
    timestamp: '2026-09-08T15:30:27.000Z', // 11:30 ET
    decision: 'HOLD',
    symbolOut: null,
    symbolIn: null,
    tier: null,
    rationale: 'CF is pressing its Level 2 line with the sector still leading; nothing on the bench outranks what I hold. Holding the book as it stands. If CF breaks the threshold I would consider tightening the stop. **Hypothesis: CF will break out above its 2x ATR line before the close and bank the bonus tier.**',
    hypothesis: 'Hypothesis: CF will break out above its 2x ATR line before the close and bank the bonus tier.',
    conviction: 64,
    triggers: ['threshold_proximity', 'news_catalyst'],
    haikuError: null,
  },
]);

export const CHAT_EXCHANGES = Object.freeze([
  {
    userMessage: null,
    agentResponse: "Agent's live. I'm leaning into semis today — CF and AVGO specifically.",
    scratchpad: null,
    hasDirective: false,
    directive: null,
    suggestedActions: null,
    elicitationTarget: 'first_message',
    timestamp: '2026-09-08T13:31:00.000Z',
    mode: 'battle',
    messageType: 'first_message',
  },
  {
    userMessage: 'How are we looking?',
    agentResponse: 'CF is carrying the book; KO is the drag.',
    scratchpad: null,
    hasDirective: false,
    directive: null,
    directiveThreadId: null,
    suggestedActions: ['Widen the spread', 'Stay concentrated'],
    elicitationTarget: 'risk_appetite',
    timestamp: '2026-09-08T14:05:00.000Z',
    mode: 'battle',
  },
  {
    userMessage: null,
    agentResponse: 'Eyeing AVGO on the bench. If it holds the 20-day I would rotate it into Core.',
    scratchpad: null,
    hasDirective: false,
    directive: null,
    suggestedActions: null,
    elicitationTarget: 'anticipation',
    timestamp: '2026-09-08T14:16:00.000Z',
    mode: 'battle',
    messageType: 'anticipation',
    anticipationSource: 'haiku',
    anticipationContext: { symbol: 'AVGO', direction: 'potential_entry', threshold: 'If it holds the 20-day', evaluationId: 'eval_001' },
  },
  {
    userMessage: 'Tighten up — stronger confirmation before you add anything.',
    agentResponse: "Got it — that's the bias I'm carrying into my next read.",
    scratchpad: null,
    hasDirective: true,
    directive: {
      text: 'Require stronger confirmation before entering',
      expiry: 'end_of_battle',
      directiveThreadId: 'thread-tf02-0001',
      adjustmentId: 'TF-02',
      canonicalTextVersion: 1,
    },
    directiveThreadId: 'thread-tf02-0001',
    suggestedActions: null,
    elicitationTarget: 'concentration_tolerance',
    timestamp: '2026-09-08T15:20:00.000Z',
    mode: 'battle',
    archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'TF-02', status: 'committed', repairUsed: false },
  },
]);

export const TRADES = Object.freeze([
  {
    action: 'SWAP',
    symbolOut: 'GILD',
    symbolIn: 'MOS',
    tier: 'core',
    rationale: 'Guardrail override (guardrail_stopLoss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.',
    evaluationId: 'eval_003',
    swappedOutAt: '2026-09-08T15:00:50.000Z',
    lockedPoints: -8.2,
    source: 'guardrail',
  },
  {
    action: 'SWAP',
    symbolOut: 'KO',
    symbolIn: 'AVGO',
    tier: 'support',
    rationale: "KO has gone dead money for three sessions while the semis keep leading. AVGO's relative strength is the cleanest on the bench and volume confirmed the push. I'll rotate the support slot into strength and keep the star untouched.",
    evaluationId: 'eval_004',
    swappedOutAt: '2026-09-08T15:15:40.000Z',
    lockedPoints: 1.5,
    source: 'haiku',
  },
]);

export function makeBattle(overrides = {}) {
  return {
    id: 'battle-1',
    ownerId: CANARY_UID,
    agentId: 'agent-1',
    status: 'active',
    gameMode: 'baggerbomb_agent',
    executionMode: 'autopilot',
    agentContext: { archetype: 'momentum_chaser' },
    timing: { tradingDays: ['2026-09-08', '2026-09-09'], localClose: '16:00' },
    portfolio: {
      star: [{ symbol: 'CF', sector: 'Materials', tier: 'star' }],
      core: [{ symbol: 'MOS', sector: 'Materials', tier: 'core' }, { symbol: 'PANW', sector: 'Technology', tier: 'core' }],
      support: [{ symbol: 'AVGO', sector: 'Technology', tier: 'support' }],
      bench: { stocks: [{ symbol: 'NOW', sector: 'Technology' }, { symbol: 'TSLA', sector: 'Consumer Discretionary' }], crypto: null },
    },
    scoreState: { currentScore: 12.5, opponentScore: 4, lastScoredAt: '2026-09-08T15:30:30.000Z' },
    trades: [...TRADES],
    evaluations: [...EVALUATIONS],
    chatExchanges: [...CHAT_EXCHANGES],
    directive: {
      text: 'Require stronger confirmation before entering',
      expiry: 'end_of_battle',
      directiveThreadId: 'thread-tf02-0001',
      createdAt: '2026-09-08T15:20:00.000Z',
      adjustmentId: 'TF-02',
      canonicalTextVersion: 1,
    },
    chatBudgetUsed: 2,
    reviewBudgetUsed: 0,
    recentElicitationTargets: ['risk_appetite', 'concentration_tolerance'],
    cronState: {
      consecutiveEvalFailures: 0,
      intradayMomentum: {
        CF: { vwap: 88.1, currentPrice: 89.2, vwapDeviation: 1.25, sma20_5m: 88.8, sessionDate: '2026-09-08' },
      },
    },
    dailyReviews: [],
    dailyGrades: {},
    proposalHistory: [],
    ...overrides,
  };
}

/** The League Tournament variant: same book, tournament game mode + group. */
export function makeTournamentBattle(overrides = {}) {
  return makeBattle({ gameMode: 'baggerbomb_tournament', groupId: 'group-xyz', ...overrides });
}

export function makeMarketSnapshot(overrides = {}) {
  return {
    battleId: 'battle-1',
    agentId: 'agent-1',
    capturedAt: '2026-09-08T15:45:00.000Z',
    portfolioBriefs: [
      {
        symbol: 'CF',
        tier: 'star',
        price: 89.2,
        changePercent: 2.4,
        technicalScore: 84,
        technicalRank: 6,
        rsPercentile: 88,
        trendSummary: 'Above all major moving averages — strong uptrend',
        momentumSummary: 'Momentum accelerating',
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote: 'High ATR — volatile, could hit thresholds quickly',
        atrPercent: 3.1,
        atrPercentile: 0.82,
        sector: 'Materials',
        sectorTechnicalTotal: 18,
        nearestSupport: 86.0,
        nearestResistance: 91.5,
        distanceToSupportPct: -3.6,
        distanceToResistancePct: 2.6,
        distTo52wkHigh: -1.2,
        nr7Flag: false,
        macdFreshBullishCross: true,
        macdFreshBearishCross: false,
        divergence: 'none',
        lastCandlePattern: 'bullish_engulfing',
        existingBadges: ['Level 1'],
        thresholdProximity: { currentMultiplier: 1.6, baseATR: 3.1, redZone: { targetThreshold: 2.0, zoneProgressPercent: 60 }, swapLock: { locked: true, distancePercent: 1.2, message: 'approaching Level 2' } },
        intraday: { vwap: 88.1, currentPrice: 89.2, vwapDeviation: 1.25, sma20_5m: 88.8, sessionDate: '2026-09-08' },
        // §3.5 — the fundamentals mirror the cache copies under the flag. The
        // pre-grounding renderer never reads it (the off golden proves it).
        fundamentals: { trailingPE: { value: 18.2, sectorMedian: 22.1 }, revenueGrowthPct: 12.0, earningsRevisions30d: 47.2, marketCapClass: 'large', computedAt: 1757030400000 },
      },
      {
        symbol: 'MOS',
        tier: 'core',
        price: 31.4,
        changePercent: -0.8,
        technicalScore: 55,
        technicalRank: 41,
        rsPercentile: 52,
        trendSummary: 'Above 200-day, below 50-day — pullback within uptrend',
        momentumSummary: 'Momentum fading',
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote: null,
        atrPercent: 2.2,
        atrPercentile: 0.44,
        sector: 'Materials',
        sectorTechnicalTotal: 18,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: -14.8,
        nr7Flag: true,
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: 'bearish',
        lastCandlePattern: null,
        existingBadges: [],
        thresholdProximity: null,
        intraday: null,
        fundamentals: { trailingPE: { value: 11.4 }, beatRate: 75, computedAt: 1756425600000 },
      },
      {
        symbol: 'PANW',
        tier: 'core',
        price: 201.7,
        changePercent: 0.3,
        technicalScore: 71,
        technicalRank: 15,
        rsPercentile: 70,
        trendSummary: 'Above all major moving averages — strong uptrend',
        momentumSummary: 'Momentum steady',
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote: null,
        atrPercent: null,
        atrPercentile: null,
        sector: 'Technology',
        sectorTechnicalTotal: 60,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
        nr7Flag: false,
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: null,
        lastCandlePattern: null,
        existingBadges: [],
        thresholdProximity: null,
        intraday: null,
        // no fundamentals key — the null-honest case
      },
      {
        symbol: 'AVGO',
        tier: 'support',
        price: 172.9,
        changePercent: 1.9,
        technicalScore: 90,
        technicalRank: 2,
        rsPercentile: 94,
        trendSummary: 'Above all major moving averages — strong uptrend',
        momentumSummary: 'Momentum accelerating',
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote: null,
        atrPercent: 2.7,
        atrPercentile: 0.71,
        sector: 'Technology',
        sectorTechnicalTotal: 60,
        nearestSupport: 168.0,
        nearestResistance: 175.0,
        distanceToSupportPct: -2.8,
        distanceToResistancePct: 1.2,
        distTo52wkHigh: -0.4,
        nr7Flag: false,
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: 'none',
        lastCandlePattern: null,
        existingBadges: [],
        thresholdProximity: { currentMultiplier: 0.4, baseATR: 2.7, redZone: null, swapLock: { locked: false } },
        intraday: null,
        fundamentals: { trailingPE: { value: 33.0, sectorMedian: 28.5 }, priceBookMRQ: 9.8, revenueGrowthPct: 20.5, marketCapClass: 'large', earningsRevisions30d: 5.1, beatRate: 92, surpriseMagPercentile: 81, computedAt: 1757030400000 },
      },
    ],
    benchBriefs: [
      {
        symbol: 'NOW',
        assetClass: 'stock',
        price: 640.5,
        changePercent: 1.1,
        technicalScore: 77,
        technicalRank: 9,
        rsPercentile: 80,
        trendSummary: 'Above all major moving averages — strong uptrend',
        momentumSummary: 'Momentum accelerating',
        atrPercent: 2.9,
        atrPercentile: 0.66,
        sector: 'Technology',
        sectorTechnicalTotal: 60,
        cooldownUntil: null,
        cooldownActive: false,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
        nr7Flag: true,
        macdFreshBullishCross: true,
        macdFreshBearishCross: false,
        divergence: null,
        lastCandlePattern: 'hammer',
        fundamentals: { trailingPE: { value: 58.0, sectorMedian: 28.5 }, revenueGrowthPct: 22.3, computedAt: 1757030400000 },
      },
      {
        symbol: 'TSLA',
        assetClass: 'stock',
        price: 250.2,
        changePercent: -2.2,
        technicalScore: null,
        technicalRank: null,
        rsPercentile: null,
        trendSummary: null,
        momentumSummary: null,
        atrPercent: null,
        atrPercentile: null,
        sector: 'Consumer Discretionary',
        sectorTechnicalTotal: null,
        cooldownUntil: '2026-09-09',
        cooldownActive: true,
        nearestSupport: null,
        nearestResistance: null,
        distanceToSupportPct: null,
        distanceToResistancePct: null,
        distTo52wkHigh: null,
        nr7Flag: false,
        macdFreshBullishCross: false,
        macdFreshBearishCross: false,
        divergence: null,
        lastCandlePattern: null,
      },
    ],
    scoutAlerts: [
      { symbol: 'NOW', headline: 'NOW: relative strength building vs XLK', detail: 'RS 80th %ile, NR7 day, fresh MACD bullish cross.' },
    ],
    marketContext: {
      regime: 'bull',
      regimeDetail: 'broad participation, low volatility',
      spyChange: 0.6,
      volatilityRegime: 'low',
      breadthTier: 'strong',
      breadthDetail: '72% of names above their 50-day',
      breadthQualitySignal: 'confirmed',
      breadthSpyVsRspGap: -0.3,
      leadershipSignal: 'growth',
      divergenceSignal: 'none',
      topSector: 'Technology',
      topSectorChange: 1.4,
      worstSector: 'Utilities',
      worstSectorChange: -0.9,
      yieldRegime: 'stable',
    },
    dataFreshness: { prices: 'rest_15min', technicals: 'daily', rankings: 'daily', marketContext: 'daily' },
    forgeSeeds: null,
    ...overrides,
  };
}

export const ELICITATION_TARGET = Object.freeze({
  dimension: 'time_of_day_preference',
  instruction: "Include a time element in your options (e.g., 'act now at open' vs 'wait for confirmation'). Reveals urgency preference.",
});

export const CAPABILITIES_MANIFEST = Object.freeze({ user_can_short: true, user_can_make_claims: false });

export const ANCHOR_CONTEXT = 'Regime: bull. Broad participation, low volatility. Semis lead; energy lags into the afternoon.';

export const SUPPORTED_TERMS = Object.freeze(['VWAP', 'ATR', 'relative strength', 'NR7']);

/** An anticipation candidate as the decider emits it (agentEvalToolSchema.js). */
export function makeCandidate(overrides = {}) {
  return {
    symbol: 'NOW',
    direction: 'potential_entry',
    signalSummary: 'Relative strength building against XLK and volume is confirming.',
    threshold: 'If it holds above the 20-day on the next test, I would rotate it into Core.',
    rationale: 'The cleanest setup on the bench this session.',
    signalSource: 'relative_strength',
    ...overrides,
  };
}

/** The closed trade a narration is asked to explain. */
export function makeClosedTrade(overrides = {}) {
  return { ...TRADES[1], ...overrides };
}

export function makeDailyReviews() {
  return [
    {
      tradingDay: '2026-09-08',
      date: '2026-09-08',
      createdAt: '2026-09-08T20:30:00.000Z',
      summary: 'Two swaps, one forced. The book finished ahead.',
      keyMoments: ['GILD stopped out at 11:00', 'AVGO in for KO at 11:15'],
      finalScore: 14.2,
      grade: 'B+',
    },
  ];
}
