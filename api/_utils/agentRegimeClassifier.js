// api/_utils/agentRegimeClassifier.js
// Per-stock regime classification + market posture detection.
// Pure logic — no API calls, no Firestore, no side effects.

// ATR regime thresholds (mirrored from technicalCalculations.js)
export function getATRRegime(atrPercent) {
  if (atrPercent == null) return 'normal';
  if (atrPercent > 4) return 'extreme';
  if (atrPercent > 3) return 'high';
  if (atrPercent > 1.5) return 'normal';
  return 'low';
}

const HIGH_VOL_REGIMES = new Set(['high', 'extreme']);
const LOW_VOL_REGIMES = new Set(['low', 'normal']);

/**
 * Classify a stock into one of four regimes based on its technical factors.
 *
 * @param {Object} stockData - A stockTechnicalScores document
 * @param {Object} stockData.factors - { aboveSMA20, aboveSMA50, aboveSMA200, rsi, macdHistogram, macdAboveSignal, upDayVolRatio }
 * @param {number} stockData.atrPercent - ATR as percent of price
 * @returns {'directional_expansion'|'directional_contraction'|'choppy'|'distressed'}
 */
export function classifyStockRegime(stockData) {
  if (!stockData || !stockData.factors) return 'choppy';

  const factors = stockData.factors;
  const atrRegime = getATRRegime(stockData.atrPercent);
  const isHighVol = HIGH_VOL_REGIMES.has(atrRegime);
  const isLowVol = LOW_VOL_REGIMES.has(atrRegime);
  const aboveSMA20 = factors.aboveSMA20 === true;
  const aboveSMA50 = factors.aboveSMA50 === true;
  const rsi = factors.rsi ?? 50;
  const macdHist = factors.macdHistogram ?? 0;
  const volRatio = factors.upDayVolRatio ?? 1.0;

  // Priority 1: Distressed — high volatility + below SMA20 + negative MACD
  if (isHighVol && !aboveSMA20 && macdHist < 0) {
    return 'distressed';
  }

  // Priority 2: Directional Expansion — high vol + above SMAs + strong volume
  if (isHighVol && aboveSMA20 && aboveSMA50 && volRatio >= 1.2) {
    return 'directional_expansion';
  }

  // Priority 3: Directional Contraction — low vol + above SMAs + RSI 45-65
  if (isLowVol && aboveSMA20 && aboveSMA50 && rsi >= 45 && rsi <= 65) {
    return 'directional_contraction';
  }

  // Fallback: Choppy / range-bound
  return 'choppy';
}

/**
 * Classify market-wide posture using pre-computed market intelligence.
 * Uses SPY ATR regime as VIX proxy (no VIX data in codebase).
 *
 * @param {Object} marketContext - indexIntelligence/marketContext document
 * @param {string} marketContext.regime - 'bull'|'correction'|'bear'|'recovery'
 * @param {string} marketContext.volatilityRegime - 'extreme'|'high'|'normal'|'low'
 * @param {Object} spyData - indexIntelligence/SPY document
 * @param {Object} spyData.sma200 - { value, position: 'above'|'below', distance: number }
 * @returns {'risk_on'|'selective'|'defensive'}
 */
export function classifyMarketPosture(marketContext, spyData) {
  if (!marketContext || !spyData) return 'selective';

  const regime = marketContext.regime || 'unknown';
  const volRegime = marketContext.volatilityRegime || 'normal';
  const sma200Pos = spyData.sma200?.position || 'unknown';
  const sma200Dist = Math.abs(spyData.sma200?.distance ?? 0);
  const isHighVol = HIGH_VOL_REGIMES.has(volRegime);
  const isLowVol = LOW_VOL_REGIMES.has(volRegime);

  // Priority 1: Defensive — bear market or below SMA200 + high volatility
  if (regime === 'bear' || (sma200Pos === 'below' && isHighVol)) {
    return 'defensive';
  }

  // Priority 2: Risk-On — bull + above SMA200 + low volatility
  if (regime === 'bull' && sma200Pos === 'above' && isLowVol) {
    return 'risk_on';
  }

  // Priority 3: Selective — correction/recovery, or SPY near SMA200
  return 'selective';
}

/**
 * Get the valid strategies for a given stock regime.
 * Used for prompt injection so Haiku knows which strategies to consider.
 *
 * @param {string} regime - Stock regime
 * @returns {string[]} Array of strategy names
 */
export function getStrategiesForRegime(regime) {
  switch (regime) {
    case 'directional_expansion':
      return ['volatility_squeeze_breakout', '52w_high_breakout'];
    case 'directional_contraction':
      return ['rs_momentum_vwap_pullback'];
    case 'choppy':
      return ['vwap_mean_reversion'];
    case 'distressed':
      return []; // No buy strategies — exit only
    default:
      return [];
  }
}

/**
 * Get strategies adjusted by the user's strategy preset.
 * Wraps getStrategiesForRegime with preset-specific overrides.
 *
 * @param {string} regime - Stock regime
 * @param {Object} presetConfig - From agentPresetConfig.js
 * @returns {string[]} Array of strategy names (empty = HOLD_ONLY)
 */
export function getPresetAdjustedStrategies(regime, presetConfig) {
  if (!presetConfig) return getStrategiesForRegime(regime);

  const regimeConfig = presetConfig.regime || {};

  // If preset blocks this regime entirely, return empty (HOLD_ONLY)
  if (regimeConfig.holdOnlyRegimes && regimeConfig.holdOnlyRegimes.includes(regime)) {
    return [];
  }

  const baseStrategies = getStrategiesForRegime(regime);

  // If preset has no favored strategies, use base as-is
  if (!regimeConfig.favoredStrategies) return baseStrategies;

  // If base has strategies, intersect with favored (keep order of favored)
  if (baseStrategies.length > 0) {
    const baseSet = new Set(baseStrategies);
    const intersection = regimeConfig.favoredStrategies.filter(s => baseSet.has(s));
    return intersection.length > 0 ? intersection : baseStrategies;
  }

  // Don't override distressed — exit-only should remain exit-only
  if (regime === 'distressed') return [];

  // For empty-base regimes (e.g., choppy with aggressive), allow favored strategies
  return regimeConfig.favoredStrategies;
}
