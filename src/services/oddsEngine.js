// src/services/oddsEngine.js
// Market-Informed Odds Engine v1.0
//
// Calculates beat/miss probabilities using transparent, verifiable data:
// - Historical earnings beat rate (40% weight)
// - Price momentum into earnings (25% weight)
// - Analyst estimate revisions (20% weight)
// - Sector baseline performance (15% weight)

// ===========================================
// SECTOR BEAT RATES (Historical averages from S&P 500)
// ===========================================
export const SECTOR_BEAT_RATES = {
  technology: { beatRate: 0.78, description: 'Tech beats often but may be priced in' },
  financial: { beatRate: 0.74, description: 'Financials are steady performers' },
  healthcare: { beatRate: 0.76, description: 'Healthcare is predictable' },
  consumer_cyclical: { beatRate: 0.71, description: 'Depends on economic conditions' },
  consumer_defensive: { beatRate: 0.73, description: 'Consistent but smaller moves' },
  industrial: { beatRate: 0.70, description: 'Economy-sensitive' },
  energy: { beatRate: 0.65, description: 'Volatile with commodity exposure' },
  utilities: { beatRate: 0.69, description: 'Rarely surprises' },
  materials: { beatRate: 0.67, description: 'Tied to global demand' },
  real_estate: { beatRate: 0.68, description: 'REITs are predictable' },
  communication: { beatRate: 0.75, description: 'Media/telecom beat often' },
  default: { beatRate: 0.70, description: 'Market average' }
};

// ===========================================
// FACTOR WEIGHTS
// ===========================================
export const FACTOR_WEIGHTS = {
  historical: 0.40,      // 40% - Past earnings track record
  priceMomentum: 0.25,   // 25% - Stock price action into earnings
  analystMomentum: 0.20, // 20% - Estimate revision trends
  sectorBaseline: 0.15   // 15% - Sector average performance
};

// ===========================================
// FACTOR 1: Historical Beat Rate
// ===========================================
export function calculateHistoricalBeatRate(earningsHistory) {
  if (!earningsHistory || earningsHistory.length === 0) {
    return {
      rate: 0.70,
      beats: 0,
      total: 0,
      confidence: 'none',
      display: 'No history'
    };
  }

  // Use up to last 12 quarters
  const quarters = earningsHistory.slice(0, 12);

  let beats = 0;
  let total = 0;

  quarters.forEach(q => {
    const actual = q.epsActual ?? q.actualEPS ?? q.actual;
    const estimate = q.epsEstimate ?? q.estimatedEPS ?? q.estimate;

    if (actual !== null && actual !== undefined &&
        estimate !== null && estimate !== undefined) {
      total++;
      if (actual > estimate) {
        beats++;
      }
    }
  });

  if (total === 0) {
    return {
      rate: 0.70,
      beats: 0,
      total: 0,
      confidence: 'none',
      display: 'No comparable data'
    };
  }

  const rate = beats / total;

  // Confidence based on sample size
  let confidence;
  if (total >= 10) confidence = 'high';
  else if (total >= 6) confidence = 'medium';
  else if (total >= 3) confidence = 'low';
  else confidence = 'very_low';

  return {
    rate,
    beats,
    total,
    confidence,
    display: `${Math.round(rate * 100)}% (${beats}/${total})`
  };
}

// ===========================================
// FACTOR 2: Price Momentum (30-day)
// ===========================================
export function calculatePriceMomentum(currentPrice, price30DaysAgo) {
  if (!currentPrice || !price30DaysAgo || price30DaysAgo === 0) {
    return {
      factor: 1.0,
      change: 0,
      signal: 'no_data',
      confidence: 'none',
      display: 'No price data'
    };
  }

  const changePercent = ((currentPrice - price30DaysAgo) / price30DaysAgo) * 100;

  let factor, signal;

  if (changePercent >= 15) {
    factor = 1.12;
    signal = 'strong_bullish';
  } else if (changePercent >= 8) {
    factor = 1.07;
    signal = 'bullish';
  } else if (changePercent >= 3) {
    factor = 1.03;
    signal = 'slight_bullish';
  } else if (changePercent <= -15) {
    factor = 0.88;
    signal = 'strong_bearish';
  } else if (changePercent <= -8) {
    factor = 0.93;
    signal = 'bearish';
  } else if (changePercent <= -3) {
    factor = 0.97;
    signal = 'slight_bearish';
  } else {
    factor = 1.0;
    signal = 'neutral';
  }

  return {
    factor,
    change: changePercent,
    signal,
    confidence: 'high',
    display: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% (30d)`
  };
}

// ===========================================
// FACTOR 3: Analyst Momentum
// ===========================================
export function calculateAnalystMomentum(analystData) {
  // If we have estimate revision data
  if (analystData?.estimateChange !== undefined) {
    const change = analystData.estimateChange;

    let factor, signal;

    if (change >= 5) {
      factor = 1.08;
      signal = 'estimates_rising_fast';
    } else if (change >= 2) {
      factor = 1.04;
      signal = 'estimates_rising';
    } else if (change <= -5) {
      factor = 0.92;
      signal = 'estimates_falling_fast';
    } else if (change <= -2) {
      factor = 0.96;
      signal = 'estimates_falling';
    } else {
      factor = 1.0;
      signal = 'estimates_stable';
    }

    return {
      factor,
      change,
      signal,
      confidence: 'high',
      display: `${change >= 0 ? '+' : ''}${change.toFixed(1)}% revision`
    };
  }

  // Fallback: Use analyst ratings if available
  if (analystData?.ratings) {
    const { buy = 0, hold = 0, sell = 0 } = analystData.ratings;
    const total = buy + hold + sell;

    if (total === 0) {
      return {
        factor: 1.0,
        signal: 'no_coverage',
        confidence: 'none',
        display: 'No analyst coverage'
      };
    }

    const bullishRatio = buy / total;

    let factor, signal;

    if (bullishRatio >= 0.7) {
      factor = 1.06;
      signal = 'analysts_bullish';
    } else if (bullishRatio >= 0.5) {
      factor = 1.02;
      signal = 'analysts_positive';
    } else if (bullishRatio <= 0.3) {
      factor = 0.94;
      signal = 'analysts_bearish';
    } else {
      factor = 1.0;
      signal = 'analysts_mixed';
    }

    return {
      factor,
      signal,
      ratings: { buy, hold, sell },
      confidence: total >= 5 ? 'medium' : 'low',
      display: `${buy} Buy, ${hold} Hold, ${sell} Sell`
    };
  }

  // No analyst data
  return {
    factor: 1.0,
    signal: 'no_data',
    confidence: 'none',
    display: 'No analyst data'
  };
}

// ===========================================
// FACTOR 4: Sector Baseline
// ===========================================
export function getSectorBaseline(sector) {
  const key = (sector || 'default')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z_]/g, '');

  const data = SECTOR_BEAT_RATES[key] || SECTOR_BEAT_RATES.default;

  return {
    ...data,
    name: sector || 'Unknown',
    display: `${Math.round(data.beatRate * 100)}% sector avg`
  };
}

// ===========================================
// MASTER CALCULATION
// ===========================================
export function calculateBeatProbability({
  earningsHistory,
  currentPrice,
  price30DaysAgo,
  analystData,
  sector
}) {
  // Calculate all factors
  const historical = calculateHistoricalBeatRate(earningsHistory);
  const priceMomentum = calculatePriceMomentum(currentPrice, price30DaysAgo);
  const analystMomentum = calculateAnalystMomentum(analystData);
  const sectorData = getSectorBaseline(sector);

  // Determine base rate
  let baseRate;
  if (historical.confidence !== 'none' && historical.total >= 3) {
    baseRate = historical.rate;
  } else {
    baseRate = sectorData.beatRate;
  }

  // Apply momentum factors (multiplicative)
  let adjustedRate = baseRate;
  adjustedRate *= priceMomentum.factor;
  adjustedRate *= analystMomentum.factor;

  // Blend with sector baseline
  const blendedRate = (adjustedRate * (1 - FACTOR_WEIGHTS.sectorBaseline)) +
                      (sectorData.beatRate * FACTOR_WEIGHTS.sectorBaseline);

  // Clamp to reasonable range
  const finalProbability = Math.min(0.95, Math.max(0.15, blendedRate));

  // Calculate overall confidence
  const confidenceScores = { high: 3, medium: 2, low: 1, very_low: 0.5, none: 0 };
  const avgConfidence = (
    (confidenceScores[historical.confidence] || 0) * 0.5 +
    (confidenceScores[priceMomentum.confidence] || 0) * 0.3 +
    (confidenceScores[analystMomentum.confidence] || 0) * 0.2
  );

  let overallConfidence;
  if (avgConfidence >= 2.5) overallConfidence = 'high';
  else if (avgConfidence >= 1.5) overallConfidence = 'medium';
  else if (avgConfidence >= 0.5) overallConfidence = 'low';
  else overallConfidence = 'very_low';

  return {
    probability: finalProbability,
    probabilityPercent: Math.round(finalProbability * 100),
    missOdds: 1 - finalProbability,
    confidence: overallConfidence,

    // Full breakdown for transparency UI
    breakdown: {
      historical: { ...historical, weight: FACTOR_WEIGHTS.historical },
      priceMomentum: { ...priceMomentum, weight: FACTOR_WEIGHTS.priceMomentum },
      analystMomentum: { ...analystMomentum, weight: FACTOR_WEIGHTS.analystMomentum },
      sector: { ...sectorData, weight: FACTOR_WEIGHTS.sectorBaseline }
    },

    // Metadata
    methodology: 'market_informed_v1',
    calculatedAt: new Date().toISOString()
  };
}

// ===========================================
// SIMPLIFIED CALCULATION (for inline use in serverless)
// ===========================================
export function calculateBeatProbabilitySimple({
  beatRate,
  totalQuarters,
  priceChange30d,
  sector
}) {
  // Base rate from history or sector
  let baseRate = 0.70;
  let confidence = 'low';

  // Minimum 4 quarters (1 full year) required for stock-specific confidence
  if (beatRate !== null && totalQuarters >= 4) {
    baseRate = beatRate;
    confidence = totalQuarters >= 10 ? 'high' : totalQuarters >= 6 ? 'medium' : 'low';
  } else {
    // Use sector average (insufficient historical data)
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    baseRate = SECTOR_BEAT_RATES[sectorKey]?.beatRate || 0.70;
  }

  // Apply price momentum
  let priceFactor = 1.0;
  if (priceChange30d !== null && priceChange30d !== undefined) {
    if (priceChange30d >= 15) priceFactor = 1.12;
    else if (priceChange30d >= 8) priceFactor = 1.07;
    else if (priceChange30d >= 3) priceFactor = 1.03;
    else if (priceChange30d <= -15) priceFactor = 0.88;
    else if (priceChange30d <= -8) priceFactor = 0.93;
    else if (priceChange30d <= -3) priceFactor = 0.97;
  }

  // Calculate final probability
  let probability = baseRate * priceFactor;

  // Blend with sector baseline (15%)
  const sectorRate = SECTOR_BEAT_RATES[(sector || 'default').toLowerCase().replace(/\s+/g, '_')]?.beatRate || 0.70;
  probability = (probability * 0.85) + (sectorRate * 0.15);

  // Clamp
  probability = Math.min(0.95, Math.max(0.15, probability));

  return {
    probability,
    probabilityPercent: Math.round(probability * 100),
    missOdds: 1 - probability,
    confidence,
    priceFactor,
    baseRate
  };
}

// ===========================================
// EXPORTS
// ===========================================
export default {
  calculateBeatProbability,
  calculateBeatProbabilitySimple,
  calculateHistoricalBeatRate,
  calculatePriceMomentum,
  calculateAnalystMomentum,
  getSectorBaseline,
  SECTOR_BEAT_RATES,
  FACTOR_WEIGHTS
};
