// Game Design Feedback Category Registry
// Each game mode defines its own evaluation categories.
// Schema version must be bumped when categories change.

export const CURRENT_SCHEMA_VERSION = 1;

export const FEEDBACK_CATEGORIES = {
  baggerbomb: {
    categories: [
      'threshold_calibration',
      'tier_impact',
      'swap_economy',
      'scoring_tension',
      'decision_density',
      'information_value',
    ],
    botSafeCategories: [
      'threshold_calibration',
      'tier_impact',
      'swap_economy',
      'decision_density',
      'information_value',
    ],
    promptInstructions: `Categories to evaluate:
1. THRESHOLD_CALIBRATION: Were the ATR-based thresholds well-calibrated for the assets in play? Did they create meaningful tension or were they too easy/impossible to trigger?
2. TIER_IMPACT: Did the Star/Core/Support tier assignments create interesting strategic tradeoffs? Did the 2x/1.5x/1x multipliers feel consequential?
3. SWAP_ECONOMY: Did the swap/substitution mechanics create meaningful decisions? Was the timing pressure interesting? Were bench options relevant?
4. SCORING_TENSION: Did the scoring dynamics create competitive engagement? Were there momentum shifts, comeback opportunities, or dramatic swings?
5. DECISION_DENSITY: How many meaningful decisions did you face during this battle? Were there dead periods with nothing to consider?
6. INFORMATION_VALUE: Was the information available (prices, news, thresholds) useful for making decisions? Was anything missing that would have helped?`,
  },
  // snake_draft and gauntlet category sets will be added when those agent integrations ship
};

export function getCategoriesForMode(gameMode) {
  return FEEDBACK_CATEGORIES[gameMode] || FEEDBACK_CATEGORIES.baggerbomb;
}
