// api/earnings/odds.js
// Calculate beat probability for a single stock using Market-Informed Odds Engine v1.1
//
// Endpoint: GET /api/earnings/odds?symbol=NVDA&sector=technology
//
/**
 * Market-Informed Odds Engine v1.1
 *
 * ALGORITHM (Multiplicative Adjustment System):
 *
 * Step 1: BASE RATE
 *   - Start with historical beat rate from EODHD (if ≥4 quarters available)
 *   - Fallback to sector average beat rate if insufficient data
 *
 * Step 2: MOMENTUM ADJUSTMENT (multiplicative)
 *   - Apply price momentum factor (0.88 to 1.12)
 *   - +15% momentum → 1.12x multiplier (12% boost to beat odds)
 *   - -15% momentum → 0.88x multiplier (12% reduction to beat odds)
 *   - Rationale: Stocks running into earnings tend to beat more often
 *
 * Step 3: IV REGRESSION (when options data available)
 *   - High IV → regress probability toward 50% (more uncertainty)
 *   - Low IV → slight boost away from 50% (more certainty)
 *   - Skipped entirely if no options data available
 *
 * Step 4: SECTOR BLEND
 *   - Final = (85% × calculated probability) + (15% × sector baseline)
 *   - Ensures sector context is always factored in
 *
 * Step 5: CLAMPING
 *   - Result clamped to [0.15, 0.95] range
 *   - Prevents extreme probabilities
 *
 * CONFIDENCE LEVELS:
 *   - 'high': ≥10 quarters of historical data (2.5+ years)
 *   - 'medium': 6-9 quarters of historical data (1.5-2.5 years)
 *   - 'low': 4-5 quarters of historical data (1-1.5 years)
 *   - 'sector_default': <4 quarters, using sector defaults with adjustments
 *   - 'none': Pure sector default (API failures)
 */

import { applySecurityMiddleware } from '../_utils/security.js';
import {
  SECTOR_BEAT_RATES,
  DEFAULT_BEAT_RATE,
  MOMENTUM_THRESHOLDS,
  MOMENTUM_FACTORS,
  IV_THRESHOLDS,
  IV_FACTORS,
  PROBABILITY_CONFIG,
  RATE_LIMITS
} from '../../src/config/earningsConfig.js';

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: RATE_LIMITS.ODDS_API })) {
    return;
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, sector } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.error('[Odds] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const upperSymbol = symbol.toUpperCase();
  const tickerWithExchange = `${upperSymbol}.US`;

  console.log(`[Odds] Calculating for ${upperSymbol}, sector=${sector || 'default'}`);

  try {
    // Fetch all needed data in parallel
    const [fundamentalsRes, priceRes, optionsRes] = await Promise.all([
      // Historical earnings from fundamentals
      fetch(`https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${apiKey}&filter=Earnings::History`),
      // Current and historical price (last 35 days to ensure we get 30 trading days)
      fetch(`https://eodhd.com/api/eod/${tickerWithExchange}?api_token=${apiKey}&period=d&order=d&limit=35&fmt=json`),
      // Options data for IV/expected move
      fetch(`https://eodhd.com/api/options/${tickerWithExchange}?api_token=${apiKey}`)
    ]);

    // Parse fundamentals
    let earningsHistory = [];
    let beatRate = null;
    let totalQuarters = 0;

    if (fundamentalsRes.ok) {
      const fundamentalsData = await fundamentalsRes.json();
      const historyObj = fundamentalsData?.Earnings?.History || {};

      // Convert to array and sort by date
      earningsHistory = Object.entries(historyObj)
        .map(([date, values]) => ({
          date,
          epsActual: values.epsActual,
          epsEstimate: values.epsEstimate
        }))
        .filter(q => q.epsActual !== null && q.epsActual !== undefined &&
                     q.epsEstimate !== null && q.epsEstimate !== undefined)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 12);

      // Calculate beat rate
      if (earningsHistory.length > 0) {
        const beats = earningsHistory.filter(q => q.epsActual > q.epsEstimate).length;
        totalQuarters = earningsHistory.length;
        beatRate = beats / totalQuarters;
        console.log(`[Odds] ${upperSymbol}: ${beats}/${totalQuarters} beats = ${Math.round(beatRate * 100)}%`);
      }
    } else {
      console.warn(`[Odds] Fundamentals fetch failed for ${upperSymbol}: ${fundamentalsRes.status}`);
    }

    // Parse prices
    let currentPrice = null;
    let price30DaysAgo = null;
    let priceChange30d = null;

    if (priceRes.ok) {
      const priceData = await priceRes.json();

      if (Array.isArray(priceData) && priceData.length > 0) {
        currentPrice = priceData[0]?.close || priceData[0]?.adjusted_close;
        // Get price from ~21 trading days ago (approximately 30 calendar days)
        const oldPriceIndex = Math.min(21, priceData.length - 1);
        price30DaysAgo = priceData[oldPriceIndex]?.close || priceData[oldPriceIndex]?.adjusted_close;

        if (currentPrice && price30DaysAgo) {
          priceChange30d = ((currentPrice - price30DaysAgo) / price30DaysAgo) * 100;
          console.log(`[Odds] ${upperSymbol}: Price $${price30DaysAgo.toFixed(2)} → $${currentPrice.toFixed(2)} (${priceChange30d >= 0 ? '+' : ''}${priceChange30d.toFixed(1)}%)`);
        }
      }
    } else {
      console.warn(`[Odds] Price fetch failed for ${upperSymbol}: ${priceRes.status}`);
    }

    // Parse options data for expected move / IV
    let expectedMovePercent = null;
    let impliedVolatility = null;

    if (optionsRes.ok && currentPrice) {
      try {
        const optionsData = await optionsRes.json();

        if (optionsData && typeof optionsData === 'object') {
          // Find nearest expiration
          const expirations = Object.keys(optionsData)
            .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
            .sort();

          if (expirations.length > 0) {
            const nearestExpiry = expirations[0];
            const chain = optionsData[nearestExpiry];

            if (chain?.options) {
              const calls = chain.options.CALL || chain.options.call || [];
              const puts = chain.options.PUT || chain.options.put || [];

              // Find ATM strike
              let atmStrike = null;
              let minDiff = Infinity;

              calls.forEach(opt => {
                const strike = opt.strike || opt.strikePrice;
                if (strike) {
                  const diff = Math.abs(strike - currentPrice);
                  if (diff < minDiff) {
                    minDiff = diff;
                    atmStrike = strike;
                  }
                }
              });

              if (atmStrike) {
                const atmCall = calls.find(o => (o.strike || o.strikePrice) === atmStrike);
                const atmPut = puts.find(o => (o.strike || o.strikePrice) === atmStrike);

                if (atmCall && atmPut) {
                  const callPrice = atmCall.lastPrice || atmCall.ask || 0;
                  const putPrice = atmPut.lastPrice || atmPut.ask || 0;
                  const straddlePrice = callPrice + putPrice;

                  if (straddlePrice > 0) {
                    expectedMovePercent = (straddlePrice / currentPrice) * 100;
                    console.log(`[Odds] ${upperSymbol}: Expected Move = ${expectedMovePercent.toFixed(1)}% (straddle: $${straddlePrice.toFixed(2)})`);
                  }

                  // Get average IV
                  const callIV = atmCall.impliedVolatility || atmCall.iv || 0;
                  const putIV = atmPut.impliedVolatility || atmPut.iv || 0;
                  if (callIV > 0 || putIV > 0) {
                    impliedVolatility = ((callIV + putIV) / 2) * 100; // Convert to percentage
                  }
                }
              }
            }
          }
        }
      } catch (optErr) {
        console.warn(`[Odds] Options parsing error for ${upperSymbol}:`, optErr.message);
      }
    } else if (!optionsRes.ok) {
      console.log(`[Odds] No options data for ${upperSymbol} (${optionsRes.status})`);
    }

    // Calculate probability using our engine logic
    const result = calculateOddsInline({
      beatRate,
      totalQuarters,
      priceChange30d,
      expectedMovePercent,
      sector: sector || 'default'
    });

    console.log(`[Odds] ${upperSymbol}: Final probability = ${result.probabilityPercent}% (confidence: ${result.confidence})`);

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      ...result,
      // Include raw data for transparency
      rawData: {
        historicalBeatRate: beatRate !== null ? Math.round(beatRate * 100) : null,
        quartersAnalyzed: totalQuarters,
        priceChange30d: priceChange30d !== null ? Math.round(priceChange30d * 10) / 10 : null,
        expectedMovePercent: expectedMovePercent !== null ? Math.round(expectedMovePercent * 10) / 10 : null,
        impliedVolatility: impliedVolatility !== null ? Math.round(impliedVolatility) : null,
        currentPrice: currentPrice !== null ? Math.round(currentPrice) : null,
        sector: sector || 'default'
      },
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Odds] Error for ${upperSymbol}:`, error);

    // Return default odds on error (graceful fallback)
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    const fallbackRate = SECTOR_BEAT_RATES[sectorKey] || DEFAULT_BEAT_RATE;

    return res.status(200).json({
      success: false,
      symbol: upperSymbol,
      probability: fallbackRate,
      probabilityPercent: Math.round(fallbackRate * 100),
      missOdds: 1 - fallbackRate,
      confidence: 'none',
      error: error.message,
      fallback: true,
      calculatedAt: new Date().toISOString()
    });
  }
}

/**
 * Odds calculation using Market-Informed Odds Engine v1.1 with IV Factor
 * Uses centralized config from src/config/earningsConfig.js
 */
function calculateOddsInline({ beatRate, totalQuarters, priceChange30d, expectedMovePercent, sector }) {
  // Determine base rate from historical data
  let baseRate = DEFAULT_BEAT_RATE;
  let confidence = 'low';

  // Minimum quarters required for stock-specific confidence
  // This captures seasonal patterns in earnings behavior
  if (beatRate !== null && totalQuarters >= PROBABILITY_CONFIG.MIN_QUARTERS_REQUIRED) {
    baseRate = beatRate;
    if (totalQuarters >= 10) confidence = 'high';
    else if (totalQuarters >= 6) confidence = 'medium';
    else confidence = 'low';
  } else {
    // Use sector average (insufficient historical data)
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    baseRate = SECTOR_BEAT_RATES[sectorKey] || DEFAULT_BEAT_RATE;
    confidence = 'sector_default';
  }

  // Apply price momentum factor
  let priceFactor = 1.0;
  let priceSignal = 'neutral';

  if (priceChange30d !== null && priceChange30d !== undefined) {
    if (priceChange30d >= MOMENTUM_THRESHOLDS.STRONG_BULLISH) {
      priceFactor = MOMENTUM_FACTORS.strong_bullish;
      priceSignal = 'strong_bullish';
    } else if (priceChange30d >= MOMENTUM_THRESHOLDS.BULLISH) {
      priceFactor = MOMENTUM_FACTORS.bullish;
      priceSignal = 'bullish';
    } else if (priceChange30d >= MOMENTUM_THRESHOLDS.SLIGHT_BULLISH) {
      priceFactor = MOMENTUM_FACTORS.slight_bullish;
      priceSignal = 'slight_bullish';
    } else if (priceChange30d <= MOMENTUM_THRESHOLDS.STRONG_BEARISH) {
      priceFactor = MOMENTUM_FACTORS.strong_bearish;
      priceSignal = 'strong_bearish';
    } else if (priceChange30d <= MOMENTUM_THRESHOLDS.BEARISH) {
      priceFactor = MOMENTUM_FACTORS.bearish;
      priceSignal = 'bearish';
    } else if (priceChange30d <= MOMENTUM_THRESHOLDS.SLIGHT_BEARISH) {
      priceFactor = MOMENTUM_FACTORS.slight_bearish;
      priceSignal = 'slight_bearish';
    }
  }

  // Apply IV / Expected Move factor
  // High expected move = market uncertainty = regress toward 50%
  // Low expected move = market confidence = trust other signals
  let ivFactor = 1.0;
  let ivSignal = 'no_data';

  if (expectedMovePercent !== null && expectedMovePercent !== undefined) {
    if (expectedMovePercent >= IV_THRESHOLDS.VERY_HIGH) {
      // Very high expected move - lots of uncertainty, regress toward 50%
      ivFactor = IV_FACTORS.very_high;
      ivSignal = 'high_uncertainty';
    } else if (expectedMovePercent >= IV_THRESHOLDS.ELEVATED) {
      ivFactor = IV_FACTORS.elevated;
      ivSignal = 'elevated_uncertainty';
    } else if (expectedMovePercent >= IV_THRESHOLDS.MODERATE) {
      ivFactor = IV_FACTORS.moderate;
      ivSignal = 'moderate';
    } else if (expectedMovePercent <= IV_THRESHOLDS.LOW) {
      // Low expected move - market confident, amplify signal
      ivFactor = IV_FACTORS.high_confidence;
      ivSignal = 'high_confidence';
    } else {
      ivFactor = IV_FACTORS.normal;
      ivSignal = 'normal';
    }
  }

  // Calculate adjusted rate with all factors
  let probability = baseRate * priceFactor;

  // Apply IV factor - regresses extreme probabilities toward 50%
  if (ivFactor !== 1.0) {
    const distanceFrom50 = probability - 0.50;
    probability = 0.50 + (distanceFrom50 * ivFactor);
  }

  // Blend with sector baseline
  const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
  const sectorRate = SECTOR_BEAT_RATES[sectorKey] || DEFAULT_BEAT_RATE;
  probability = (probability * PROBABILITY_CONFIG.CALCULATED_WEIGHT) + (sectorRate * PROBABILITY_CONFIG.SECTOR_BLEND_WEIGHT);

  // Clamp to reasonable range
  probability = Math.min(PROBABILITY_CONFIG.MAX_PROBABILITY, Math.max(PROBABILITY_CONFIG.MIN_PROBABILITY, probability));

  return {
    probability,
    probabilityPercent: Math.round(probability * 100),
    missOdds: 1 - probability,
    confidence,
    breakdown: {
      historical: {
        rate: beatRate,
        quarters: totalQuarters,
        display: beatRate !== null ? `${Math.round(beatRate * 100)}% (${totalQuarters}q)` : 'No data'
      },
      priceMomentum: {
        factor: priceFactor,
        change: priceChange30d,
        signal: priceSignal,
        display: priceChange30d !== null ? `${priceChange30d >= 0 ? '+' : ''}${priceChange30d.toFixed(1)}%` : 'No data'
      },
      optionsIV: {
        factor: ivFactor,
        expectedMove: expectedMovePercent,
        signal: ivSignal,
        display: expectedMovePercent !== null ? `±${expectedMovePercent.toFixed(1)}%` : 'No data'
      },
      sector: {
        rate: sectorRate,
        name: sector || 'default',
        display: `${Math.round(sectorRate * 100)}% avg`
      }
    },
    methodology: 'market_informed_v1.1'
  };
}
