// Vercel Serverless Function - Stock Fundamentals
// Endpoint: /api/stocks/fundamentals?symbol=AAPL

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const noCache = req.query?.nocache === '1';
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const cacheKey = `fundamentals_${symbol.toUpperCase()}`;
  const tier = CACHE_TIERS.TECHNICAL;

  if (!noCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
      return res.status(200).json(cached);
    }
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const eohdSymbol = normalizeSymbolForEODHD(upperSymbol);
    console.log(`[API] Fetching fundamentals for: ${upperSymbol}`);

    // Fetch all fundamental data in parallel
    const [fundamentalsRes, historicalRes] = await Promise.all([
      fetch(`https://eodhd.com/api/fundamentals/${eohdSymbol}.US?api_token=${API_KEY}&fmt=json`),
      fetch(`https://eodhd.com/api/eod/${eohdSymbol}.US?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${getDateDaysAgo(365)}`)
    ]);

    if (!fundamentalsRes.ok) {
      throw new Error(`EODHD fundamentals responded with ${fundamentalsRes.status}`);
    }

    const fundamentals = await fundamentalsRes.json();
    const historical = historicalRes.ok ? await historicalRes.json() : [];

    // Extract data from different sections
    const highlights = fundamentals.Highlights || {};
    const technicals = fundamentals.Technicals || {};
    const valuation = fundamentals.Valuation || {};
    const analysts = fundamentals.AnalystRatings || {};
    const earnings = fundamentals.Earnings || {};
    const general = fundamentals.General || {};
    const etfData = fundamentals.ETF_Data || {};

    // Calculate 7-day momentum from historical data
    const momentum7d = calculateMomentum(historical, 7);
    const upDays7d = countUpDays(historical, 7);

    // Calculate moving averages if not provided
    const ma50 = technicals['50DayMA'] || calculateMA(historical, 50);
    const ma200 = technicals['200DayMA'] || calculateMA(historical, 200);

    // Get current price from latest historical or highlights
    const currentPrice = historical[0]?.close || highlights.MarketCapitalization / highlights.SharesOutstanding || 0;

    // Calculate 52-week position
    const week52High = technicals['52WeekHigh'] || Math.max(...historical.slice(0, 252).map(d => d.high || 0));
    const week52Low = technicals['52WeekLow'] || Math.min(...historical.slice(0, 252).filter(d => d.low > 0).map(d => d.low));
    const range52wPosition = week52High > week52Low
      ? ((currentPrice - week52Low) / (week52High - week52Low)) * 100
      : 50;

    // Find next earnings date
    const nextEarnings = findNextEarningsDate(earnings);

    // Build analyst consensus data
    const totalAnalysts = (analysts.StrongBuy || 0) + (analysts.Buy || 0) + (analysts.Hold || 0) + (analysts.Sell || 0) + (analysts.StrongSell || 0);
    const buyCount = (analysts.StrongBuy || 0) + (analysts.Buy || 0);
    const buyPercent = totalAnalysts > 0 ? (buyCount / totalAnalysts) * 100 : 0;

    // Calculate analyst rating (1-5 scale)
    let analystRating = 3; // Default to hold
    if (totalAnalysts > 0) {
      const weightedSum =
        (analysts.StrongBuy || 0) * 5 +
        (analysts.Buy || 0) * 4 +
        (analysts.Hold || 0) * 3 +
        (analysts.Sell || 0) * 2 +
        (analysts.StrongSell || 0) * 1;
      analystRating = weightedSum / totalAnalysts;
    }

    const result = {
      symbol: upperSymbol,
      name: general.Name || upperSymbol,
      description: general.Description || '',
      sector: general.Sector || 'Unknown',
      industry: general.Industry || 'Unknown',

      // Current price data
      currentPrice,
      change: historical[0]?.close && historical[1]?.close
        ? ((historical[0].close - historical[1].close) / historical[1].close) * 100
        : 0,

      // Fundamentals (8 metrics for stocks)
      beta: technicals.Beta || null,
      profitMargin: highlights.ProfitMargin || null,
      revenueGrowthYOY: highlights.QuarterlyRevenueGrowthYOY || null,
      momentum7d,
      upDays7d,

      // Analyst data
      analystRating,
      ratingText: analystRating >= 4.5 ? 'Strong Buy'
        : analystRating >= 3.5 ? 'Buy'
        : analystRating >= 2.5 ? 'Hold'
        : analystRating >= 1.5 ? 'Sell' : 'Strong Sell',
      analystConsensus: {
        rating: analystRating,
        totalAnalysts,
        buyPercent,
        strongBuy: analysts.StrongBuy || 0,
        buy: analysts.Buy || 0,
        hold: analysts.Hold || 0,
        sell: analysts.Sell || 0,
        strongSell: analysts.StrongSell || 0
      },

      // Price target
      targetPrice: analysts.TargetPrice || highlights.WallStreetTargetPrice || null,

      // Valuation
      peRatio: highlights.PERatio || valuation.TrailingPE || null,
      pegRatio: highlights.PEGRatio || null,

      // Technicals
      ma50,
      ma200,
      week52High,
      week52Low,
      range52wPosition,

      // Price above/below MAs
      aboveMA50: currentPrice > ma50,
      aboveMA200: currentPrice > ma200,
      ma50Diff: ma50 > 0 ? ((currentPrice - ma50) / ma50) * 100 : 0,
      ma200Diff: ma200 > 0 ? ((currentPrice - ma200) / ma200) * 100 : 0,

      // Earnings
      nextEarningsDate: nextEarnings?.date || null,
      nextEarningsTime: nextEarnings?.time || null,

      // Market cap for sorting
      marketCap: highlights.MarketCapitalization || 0,

      // Historical prices for charts (last 30 days)
      historicalPrices: historical.slice(0, 30).reverse().map(d => d.close),

      // ETF holdings (only present for ETF symbols)
      etfHoldings: Object.keys(etfData.Top_10_Holdings || {}).length > 0
        ? Object.entries(etfData.Top_10_Holdings).map(([key, data]) => ({
            name: data.Name || key,
            symbol: data.Code || key,
            weight: parseFloat(data.Assets_Percent) || 0,
          })).sort((a, b) => b.weight - a.weight)
        : undefined,
    };

    console.log(`[API] Returning fundamentals for ${upperSymbol}`);
    if (!noCache) {
      setInCache(cacheKey, { success: true, data: result }, tier.memoryTTL);
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
    }
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Stock fundamentals error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch fundamentals',
      message: error.message
    });
  }
}

// Helper functions
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function calculateMomentum(historical, days) {
  if (!historical || historical.length < days) return 0;
  const recent = historical.slice(0, days);
  if (recent.length < 2) return 0;
  const oldPrice = recent[recent.length - 1]?.close || 0;
  const newPrice = recent[0]?.close || 0;
  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function countUpDays(historical, days) {
  if (!historical || historical.length < days) return 0;
  let upDays = 0;
  for (let i = 0; i < Math.min(days, historical.length - 1); i++) {
    if (historical[i]?.close > historical[i + 1]?.close) {
      upDays++;
    }
  }
  return upDays;
}

function calculateMA(historical, period) {
  if (!historical || historical.length < period) return 0;
  const prices = historical.slice(0, period).map(d => d.close || 0);
  const sum = prices.reduce((a, b) => a + b, 0);
  return sum / period;
}

function findNextEarningsDate(earnings) {
  if (!earnings?.History) return null;

  const now = new Date();
  const futureEarnings = Object.entries(earnings.History)
    .filter(([date, data]) => new Date(date) > now)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));

  if (futureEarnings.length === 0) return null;

  const [date, data] = futureEarnings[0];
  return {
    date,
    time: data.beforeAfterMarket || 'Unknown'
  };
}
