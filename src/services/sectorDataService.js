/**
 * Sector Data Service
 * Fetches and calculates sector-level metrics for Game Plan Generator
 * Uses Vercel proxy endpoints to avoid CORS issues
 */

import { SECTORS, CRYPTO_SECTOR, SECTOR_ORDER } from '../constants/sectors';

// Use proxy endpoints to avoid CORS issues
const API_BASE = '/api/stocks';

// Cache for sector data (refresh every 15 minutes)
let sectorCache = {};
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch historical prices for a symbol via proxy
 */
const fetchHistoricalPrices = async (symbol, days = 180) => {
  try {
    const url = `${API_BASE}/historical?symbol=${encodeURIComponent(symbol)}&days=${days}`;

    console.log(`[SectorData] Fetching ${symbol} via proxy`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[SectorData] Failed to fetch ${symbol}: ${response.status}`);
      return [];
    }

    const result = await response.json();

    if (!result.success) {
      console.error(`[SectorData] API error for ${symbol}:`, result.error);
      return [];
    }

    const data = result.data || [];
    console.log(`[SectorData] ${symbol} returned ${data.length} data points`);

    if (data.length > 0) {
      console.log(`[SectorData] ${symbol} latest price: ${data[data.length - 1]?.adjusted_close || data[data.length - 1]?.close}`);
    }

    return data;
  } catch (error) {
    console.error(`[SectorData] Error fetching ${symbol}:`, error);
    return [];
  }
};

/**
 * Fetch technical indicator (SMA) for a symbol via proxy
 */
const fetchSMA = async (symbol, period = 50) => {
  try {
    const url = `${API_BASE}/technical?symbol=${encodeURIComponent(symbol)}&indicator=sma&period=${period}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[SectorData] Failed to fetch SMA for ${symbol}: ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      console.error(`[SectorData] SMA API error for ${symbol}:`, result.error);
      return null;
    }

    return result.value;
  } catch (error) {
    console.error(`Error fetching SMA for ${symbol}:`, error);
    return null;
  }
};

/**
 * Calculate performance metrics from price history
 */
const calculatePerformance = (prices) => {
  if (!prices || prices.length < 2) {
    return { week1: 0, month1: 0, month3: 0, month6: 0 };
  }

  const currentPrice = prices[prices.length - 1]?.adjusted_close || prices[prices.length - 1]?.close;

  const getReturn = (daysAgo) => {
    const index = Math.max(0, prices.length - 1 - daysAgo);
    const pastPrice = prices[index]?.adjusted_close || prices[index]?.close;
    if (!pastPrice || !currentPrice) return 0;
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  };

  return {
    week1: getReturn(5),
    month1: getReturn(21),
    month3: getReturn(63),
    month6: getReturn(126),
    currentPrice
  };
};

/**
 * Determine trend based on performance
 */
const determineTrend = (performance) => {
  const { week1, month1, month3 } = performance;
  const avgReturn = (week1 + month1 + month3) / 3;

  if (avgReturn > 3) return { label: 'Bullish', emoji: '🟢', color: '#10b981' };
  if (avgReturn > 0) return { label: 'Neutral-Bullish', emoji: '🟢', color: '#22c55e' };
  if (avgReturn > -3) return { label: 'Neutral', emoji: '🟡', color: '#f59e0b' };
  return { label: 'Bearish', emoji: '🔴', color: '#ef4444' };
};

/**
 * Calculate sector breadth (% of stocks above 50-day SMA)
 * Phase 1: Simple implementation
 */
const calculateBreadth = async (holdings) => {
  try {
    let aboveCount = 0;
    let totalChecked = 0;

    // Check first 10 holdings for performance (API call optimization)
    const samplesToCheck = holdings.slice(0, 10);

    for (const symbol of samplesToCheck) {
      const [prices, sma50] = await Promise.all([
        fetchHistoricalPrices(symbol, 7),
        fetchSMA(symbol, 50)
      ]);

      if (prices.length > 0 && sma50) {
        totalChecked++;
        const currentPrice = prices[prices.length - 1]?.adjusted_close || prices[prices.length - 1]?.close;
        if (currentPrice > sma50) aboveCount++;
      }
    }

    const breadthPercent = totalChecked > 0 ? (aboveCount / totalChecked) * 100 : 50;

    return {
      percent: Math.round(breadthPercent),
      interpretation: breadthPercent >= 70 ? 'Strong' : breadthPercent >= 50 ? 'Neutral' : 'Weak',
      color: breadthPercent >= 70 ? '#10b981' : breadthPercent >= 50 ? '#f59e0b' : '#ef4444'
    };
  } catch (error) {
    console.error('Error calculating breadth:', error);
    return { percent: 50, interpretation: 'Unknown', color: '#8b949e' };
  }
};

/**
 * Get leadership stocks for a sector
 * Criteria: Top 7 by market cap that outperform sector over 6 months
 */
const getLeadership = async (sectorId, sectorPerformance6M) => {
  const sector = SECTORS[sectorId];
  if (!sector) return [];

  const leaders = [];
  const holdings = sector.topHoldings.slice(0, 15); // Check top 15 by market cap

  for (const symbol of holdings) {
    try {
      const prices = await fetchHistoricalPrices(symbol, 180);
      if (prices.length < 2) continue;

      const performance = calculatePerformance(prices);
      const [sma50, sma200] = await Promise.all([
        fetchSMA(symbol, 50),
        fetchSMA(symbol, 200)
      ]);

      const currentPrice = performance.currentPrice;
      const relativePerformance = performance.month6 - sectorPerformance6M;

      // Health check criteria
      const above50 = sma50 ? currentPrice > sma50 : true;
      const above200 = sma200 ? currentPrice > sma200 : true;
      const outperforming = relativePerformance > 0;

      // Must be above both MAs
      if (!above50 || !above200) continue;

      const healthScore = [above50, above200, outperforming].filter(Boolean).length;
      const healthStatus = healthScore >= 3 ? '✅' : healthScore >= 2 ? '⚠️' : '❌';

      leaders.push({
        symbol,
        performance6M: performance.month6,
        relativePerformance,
        healthStatus,
        above50,
        above200,
        outperforming
      });
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error);
    }

    // Stop after getting 7 healthy leaders
    if (leaders.filter(l => l.healthStatus === '✅').length >= 7) break;
  }

  // Sort by relative performance and take top 7
  return leaders
    .sort((a, b) => b.relativePerformance - a.relativePerformance)
    .slice(0, 7);
};

/**
 * Get BaggerBomb stats for a sector (from recent battles)
 * Phase 1: Returns mock data - will connect to Firebase in Phase 2
 */
const getBaggerBombStats = async (sectorId) => {
  // TODO: Connect to Firebase to get real battle data
  // For now, return estimated values based on sector volatility

  const volatilityMap = {
    XLK: { breakouts: 12, busts: 5, avgThreshold: 2.6 },
    XLV: { breakouts: 6, busts: 3, avgThreshold: 1.8 },
    XLF: { breakouts: 8, busts: 4, avgThreshold: 2.2 },
    XLE: { breakouts: 14, busts: 8, avgThreshold: 3.5 },
    XLY: { breakouts: 10, busts: 6, avgThreshold: 2.8 },
    XLP: { breakouts: 4, busts: 2, avgThreshold: 1.2 },
    XLI: { breakouts: 7, busts: 4, avgThreshold: 2.0 },
    XLB: { breakouts: 9, busts: 5, avgThreshold: 2.8 },
    XLU: { breakouts: 3, busts: 2, avgThreshold: 1.5 },
    XLRE: { breakouts: 5, busts: 3, avgThreshold: 2.2 },
    XLC: { breakouts: 11, busts: 5, avgThreshold: 2.5 }
  };

  const stats = volatilityMap[sectorId] || { breakouts: 5, busts: 3, avgThreshold: 2.0 };
  const hitRate = Math.round((stats.breakouts / (stats.breakouts + stats.busts)) * 100);

  return {
    breakouts7d: stats.breakouts,
    busts7d: stats.busts,
    hitRate,
    avgThreshold: stats.avgThreshold
  };
};

/**
 * Generate insight text for a sector
 */
const generateInsight = (sectorData) => {
  const { name, performance, trend, breadth, leadership, baggerBombStats } = sectorData;

  const healthyLeaders = leadership.filter(l => l.healthStatus === '✅').length;
  const totalLeaders = leadership.length;

  let insight = '';

  // Trend insight
  if (trend.label === 'Bullish') {
    insight += `${name} is showing strong momentum with ${performance.month1.toFixed(1)}% gains this month. `;
  } else if (trend.label === 'Bearish') {
    insight += `${name} is under pressure, down ${Math.abs(performance.month1).toFixed(1)}% this month. `;
  } else {
    insight += `${name} is consolidating with mixed signals. `;
  }

  // Leadership insight
  if (healthyLeaders >= 5) {
    insight += `Strong leadership with ${healthyLeaders}/${totalLeaders} leaders outperforming. `;
  } else if (healthyLeaders >= 3) {
    insight += `Mixed leadership - ${healthyLeaders}/${totalLeaders} leaders healthy. `;
  } else {
    insight += `Leadership concerns - only ${healthyLeaders}/${totalLeaders} leaders healthy. `;
  }

  // Breadth insight
  if (breadth.percent >= 70) {
    insight += `${breadth.percent}% of stocks above 50-day MA shows broad strength.`;
  } else if (breadth.percent >= 50) {
    insight += `Breadth is neutral with ${breadth.percent}% above 50-day MA.`;
  } else {
    insight += `Weak breadth - only ${breadth.percent}% above 50-day MA.`;
  }

  return insight;
};

/**
 * Fetch ETF technicals (50-day and 200-day MA relationship)
 */
const fetchETFTechnicals = async (etfSymbol) => {
  try {
    const [sma50, sma200, prices] = await Promise.all([
      fetchSMA(etfSymbol, 50),
      fetchSMA(etfSymbol, 200),
      fetchHistoricalPrices(etfSymbol, 7)
    ]);

    const currentPrice = prices.length > 0
      ? (prices[prices.length - 1]?.adjusted_close || prices[prices.length - 1]?.close)
      : null;

    if (!currentPrice) {
      console.log(`[SectorData] ETF technicals: No current price for ${etfSymbol}`);
      return {
        above50SMA: null,
        above200SMA: null,
        distanceFrom50SMA: null,
        distanceFrom200SMA: null
      };
    }

    console.log(`[SectorData] ETF technicals for ${etfSymbol}: price=${currentPrice}, sma50=${sma50}, sma200=${sma200}`);

    return {
      currentPrice,
      sma50,
      sma200,
      above50SMA: sma50 ? currentPrice > sma50 : null,
      above200SMA: sma200 ? currentPrice > sma200 : null,
      distanceFrom50SMA: sma50 ? ((currentPrice - sma50) / sma50) * 100 : null,
      distanceFrom200SMA: sma200 ? ((currentPrice - sma200) / sma200) * 100 : null
    };
  } catch (error) {
    console.error(`[SectorData] ETF technicals failed for ${etfSymbol}:`, error);
    return {
      above50SMA: null,
      above200SMA: null,
      distanceFrom50SMA: null,
      distanceFrom200SMA: null
    };
  }
};

/**
 * Fetch complete sector data
 */
export const fetchSectorData = async (sectorId) => {
  const sector = SECTORS[sectorId];
  if (!sector) throw new Error(`Unknown sector: ${sectorId}`);

  try {
    console.log(`[SectorData] Fetching sector data for ${sectorId}...`);

    // Fetch ETF performance
    const etfPrices = await fetchHistoricalPrices(sectorId, 180);
    const performance = calculatePerformance(etfPrices);
    const trend = determineTrend(performance);

    console.log(`[SectorData] ${sectorId} performance: week1=${performance.week1?.toFixed(2)}%, month1=${performance.month1?.toFixed(2)}%`);

    // Fetch breadth, BaggerBomb stats, and ETF technicals in parallel
    const [breadth, baggerBombStats, etfTechnicals] = await Promise.all([
      calculateBreadth(sector.topHoldings),
      getBaggerBombStats(sectorId),
      fetchETFTechnicals(sectorId)
    ]);

    // Fetch leadership (needs sector performance first)
    const leadership = await getLeadership(sectorId, performance.month6);

    const sectorData = {
      ...sector,
      performance: {
        week1: performance.week1,
        month1: performance.month1,
        month3: performance.month3,
        month6: performance.month6
      },
      trend,
      breadth,
      leadership,
      baggerBombStats,
      etfTechnicals,
      insight: '',
      lastUpdated: Date.now()
    };

    // Generate insight after all data is collected
    sectorData.insight = generateInsight(sectorData);

    return sectorData;
  } catch (error) {
    console.error(`[SectorData] Error fetching sector data for ${sectorId}:`, error);
    throw error;
  }
};

/**
 * Fetch all sectors data with caching
 */
export const fetchAllSectorsData = async (forceRefresh = false) => {
  // Check cache
  if (!forceRefresh && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    if (Object.keys(sectorCache).length > 0) {
      return sectorCache;
    }
  }

  const sectorsData = {};

  // Fetch sectors in parallel (but limit concurrency)
  const batchSize = 3;
  for (let i = 0; i < SECTOR_ORDER.length; i += batchSize) {
    const batch = SECTOR_ORDER.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(sectorId => fetchSectorData(sectorId).catch(err => {
        console.error(`Failed to fetch ${sectorId}:`, err);
        return null;
      }))
    );

    results.forEach((data, index) => {
      if (data) {
        sectorsData[batch[index]] = data;
      }
    });
  }

  // Update cache
  sectorCache = sectorsData;
  cacheTimestamp = Date.now();

  return sectorsData;
};

/**
 * Get stocks for a sector with basic metrics
 */
export const getSectorStocks = async (sectorId) => {
  const sector = SECTORS[sectorId];
  if (!sector) return [];

  const stocks = [];

  for (const symbol of sector.topHoldings) {
    try {
      const prices = await fetchHistoricalPrices(symbol, 30);
      if (prices.length < 2) continue;

      const performance = calculatePerformance(prices);
      const sma50 = await fetchSMA(symbol, 50);

      stocks.push({
        symbol,
        price: performance.currentPrice,
        change1W: performance.week1,
        change1M: performance.month1,
        above50SMA: sma50 ? performance.currentPrice > sma50 : null,
        sector: sectorId
      });
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
    }
  }

  return stocks;
};

/**
 * Get quick sector summary (lighter API calls)
 */
export const getQuickSectorSummary = async (sectorId) => {
  const sector = SECTORS[sectorId];
  if (!sector) return null;

  try {
    const etfPrices = await fetchHistoricalPrices(sectorId, 30);
    const performance = calculatePerformance(etfPrices);
    const trend = determineTrend(performance);

    return {
      id: sectorId,
      name: sector.name,
      emoji: sector.emoji,
      color: sector.color,
      performance1M: performance.month1,
      trend
    };
  } catch (error) {
    console.error(`Error fetching quick summary for ${sectorId}:`, error);
    return null;
  }
};

export { SECTORS, SECTOR_ORDER, CRYPTO_SECTOR };

export default {
  fetchSectorData,
  fetchAllSectorsData,
  getSectorStocks,
  getQuickSectorSummary,
  SECTORS,
  SECTOR_ORDER
};
