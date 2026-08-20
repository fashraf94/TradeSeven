// api/_utils/__fixtures__/ask1PromptFixtures.js
// Exit-Behavior Rebalance Tier 2, Ask 1 — shared deterministic fixtures for
// the prompt-honesty build. ONE source for both the golden-capture script and
// the test suite, so the byte-identity goldens and the assertions can never
// drift on inputs.
//
// assetScores come from the REAL fenced scorer (calling fenced exports is
// permitted, BUILD_RULES §1/§4) — the same call shape the eval cron uses — so
// the Phase-B cost-decomposition assertions are §9-true by construction: the
// CSV's numbers and the scorer's basePoints/bonusPoints/totalPoints are one
// computation, not a re-derivation.

import { calculateAssetScoreServer } from '../agentScoring.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../../src/constants/agentGameModes.js';

export { TIERED_GAME_MODE, FLAT6_GAME_MODE };

export const SYSTEM_PROMPT_ARGS = Object.freeze({
  agentName: 'TestAgent',
  archetype: 'Speculator',
  archetypeKey: 'degen',
});

// Two held positions: a winner deep past its first bonus (badges + positive
// base) and a loser (negative base, no badges) — exercises both signs of the
// decomposition and a real Δ-to-next-bonus on each.
// tierMultiplier: 1.0 — the D2 flat6 stamp (agentBattleService stamps every
// tournament asset flat; /code-review CR-3: the fixture models the STAMPED
// doc shape, so the §9 assertions validate the intended flat6 point values).
// NOTE (review C-2, escalated in the audit record): the LIVE cron currently
// DROPS this stamp when rebuilding assets for the scorer — a pre-existing
// engine defect outside this fence. The fixture models the design, not the
// bug; C-2's ruling decides which one production converges to before flip.
const NVDA = { symbol: 'NVDA', name: 'NVIDIA', tier: 'star', tierMultiplier: 1.0, baseATR: 3.0, isCrypto: false, sector: 'Technology', swapPrice: 100, swappedInDay: 1 };
const MSFT = { symbol: 'MSFT', name: 'Microsoft', tier: 'core', tierMultiplier: 1.0, baseATR: 2.0, isCrypto: false, sector: 'Technology', swapPrice: 200, swappedInDay: 2 };

export const PRICES = Object.freeze({
  NVDA: { current: 104.5, changePercent: 1.9, previousClose: 102.1 },
  MSFT: { current: 197.0, changePercent: -0.8, previousClose: 199.2 },
});

// thresholdHistory: NVDA peaked at 1.62x ATR (bagger + doubleBagger crossed);
// MSFT dipped but never crossed a penalty band.
export const THRESHOLD_HISTORY = Object.freeze({
  NVDA: { maxMultiplier: 1.62, minMultiplier: -0.2 },
  MSFT: { maxMultiplier: 0.3, minMultiplier: -0.9 },
});

function scoreOf(asset, currentPrice) {
  const entry = asset.swapPrice;
  const priceChange = ((currentPrice - entry) / entry) * 100;
  // Swapped-in assets use swapPrice as the threshold baseline too (the cron's
  // rule: no retroactive badge credit) — one baseline, both halves.
  return calculateAssetScoreServer(
    { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, tierMultiplier: asset.tierMultiplier, direction: null },
    priceChange,
    THRESHOLD_HISTORY[asset.symbol] || {},
    {},
    priceChange,
  );
}

export function makeBattle(gameMode) {
  return {
    id: 'battle_ask1_fixture',
    gameMode,
    portfolio: {
      star: [{ ...NVDA }],
      core: [{ ...MSFT }],
      support: [],
      bench: { stocks: [], crypto: null },
      startingPrices: { NVDA: 100, MSFT: 200 },
    },
    thresholdHistory: { ...THRESHOLD_HISTORY },
    agentContext: {
      agentName: 'TestAgent',
      archetype: 'degen',
      riskTolerance: 55,
      evaluationInterval: 15,
      strategyBrief: 'Fixture brief: momentum with discipline.',
      // PRODUCTION item shape (review C-5): both live projection writers emit
      // `ruleId` (never `id`), and the sx-04 param key in every rule store is
      // `pct` (never the dimension-field name). An invented shape here let a
      // dead render pass its tests once — never again.
      activeRules: [
        { ruleId: 'rk-01', text: 'Never hold a position past -1.5x ATR.', category: 'risk', hardness: 'hard' },
        { ruleId: 'sx-04', text: 'Sell any position that gains 15% from entry.', category: 'exit', hardness: 'soft', paramValues: { pct: 15 } },
      ],
      // The store the ENGINE fires on (agentGuardrails byType.profitTarget) —
      // the §9-true source for the SX-04 render's X (review C-6).
      deployedGuardrails: [
        { type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' },
      ],
    },
  };
}

export function makeAssetScores() {
  return [scoreOf(NVDA, PRICES.NVDA.current), scoreOf(MSFT, PRICES.MSFT.current)];
}

// rankingsMap slice for the held-position Levels render (data-add #3):
// NVDA carries a full levels read; MSFT deliberately has NONE (the R12
// honest-null case — absent reads render nothing).
export const RANKINGS_MAP = Object.freeze({
  NVDA: {
    levels: {
      nearestSupport: 101.2,
      distanceToSupportPct: -3.16,
      nearestResistance: 108.0,
      distanceToResistancePct: 3.35,
    },
  },
});
