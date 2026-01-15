// api/earnings/odds.js
// Calculate beat probability for a single stock using Market-Informed Odds Engine v1.1
//
// Endpoint: GET /api/earnings/odds?symbol=NVDA&sector=technology
//
// Returns calculated beat probability based on:
// - Historical earnings beat rate (35% weight)
// - 30-day price momentum (20% weight)
// - Options IV / Expected move (15% weight) - NEW
// - Sector baseline (15% weight)

import { applySecurityMiddleware } from '../_utils/security.js';

// Sector beat rates (inlined to avoid import issues in serverless)
const SECTOR_BEAT_RATES = {
  technology: 0.78,
  financial: 0.74,
  healthcare: 0.76,
  consumer_cyclical: 0.71,
  consumer_defensive: 0.73,
  industrial: 0.70,
  energy: 0.65,
  utilities: 0.69,
  materials: 0.67,
  real_estate: 0.68,
  communication: 0.75,
  default: 0.70
};

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
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
    const fallbackRate = SECTOR_BEAT_RATES[sectorKey] || 0.70;

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
 * Inline odds calculation (since we can't easily import ES modules in Vercel serverless)
 * Market-Informed Odds Engine v1.1 with IV Factor
 */
function calculateOddsInline({ beatRate, totalQuarters, priceChange30d, expectedMovePercent, sector }) {
  // Determine base rate from historical data
  let baseRate = 0.70;
  let confidence = 'low';

  if (beatRate !== null && totalQuarters >= 3) {
    baseRate = beatRate;
    if (totalQuarters >= 10) confidence = 'high';
    else if (totalQuarters >= 6) confidence = 'medium';
    else confidence = 'low';
  } else {
    // Use sector average
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    baseRate = SECTOR_BEAT_RATES[sectorKey] || 0.70;
    confidence = 'sector_default';
  }

  // Apply price momentum factor
  let priceFactor = 1.0;
  let priceSignal = 'neutral';

  if (priceChange30d !== null && priceChange30d !== undefined) {
    if (priceChange30d >= 15) {
      priceFactor = 1.12;
      priceSignal = 'strong_bullish';
    } else if (priceChange30d >= 8) {
      priceFactor = 1.07;
      priceSignal = 'bullish';
    } else if (priceChange30d >= 3) {
      priceFactor = 1.03;
      priceSignal = 'slight_bullish';
    } else if (priceChange30d <= -15) {
      priceFactor = 0.88;
      priceSignal = 'strong_bearish';
    } else if (priceChange30d <= -8) {
      priceFactor = 0.93;
      priceSignal = 'bearish';
    } else if (priceChange30d <= -3) {
      priceFactor = 0.97;
      priceSignal = 'slight_bearish';
    }
  }

  // Apply IV / Expected Move factor
  // High expected move = market uncertainty = regress toward 50%
  // Low expected move = market confidence = trust other signals
  let ivFactor = 1.0;
  let ivSignal = 'no_data';

  if (expectedMovePercent !== null && expectedMovePercent !== undefined) {
    if (expectedMovePercent >= 12) {
      // Very high expected move - lots of uncertainty, regress toward 50%
      ivFactor = 0.85;
      ivSignal = 'high_uncertainty';
    } else if (expectedMovePercent >= 8) {
      ivFactor = 0.92;
      ivSignal = 'elevated_uncertainty';
    } else if (expectedMovePercent >= 5) {
      ivFactor = 0.97;
      ivSignal = 'moderate';
    } else if (expectedMovePercent <= 3) {
      // Low expected move - market confident, amplify signal
      ivFactor = 1.05;
      ivSignal = 'high_confidence';
    } else {
      ivFactor = 1.0;
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

  // Blend with sector baseline (15% weight)
  const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
  const sectorRate = SECTOR_BEAT_RATES[sectorKey] || 0.70;
  probability = (probability * 0.85) + (sectorRate * 0.15);

  // Clamp to reasonable range
  probability = Math.min(0.95, Math.max(0.15, probability));

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
