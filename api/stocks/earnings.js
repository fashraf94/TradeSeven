// Vercel Serverless Function - Stock Earnings Data
// Endpoint: /api/stocks/earnings?symbol=AAPL

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const tickerWithExchange = upperSymbol.includes('.') ? upperSymbol : `${upperSymbol}.US`;

    console.log(`[API] Fetching earnings for: ${tickerWithExchange}`);

    const response = await fetch(
      `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${API_KEY}&fmt=json`
    );

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    // Log raw data for debugging
    console.log(`[API] Raw EODHD fundamentals for ${upperSymbol}:`, JSON.stringify({
      hasEarnings: !!data?.Earnings,
      hasHistory: !!data?.Earnings?.History,
      historyCount: data?.Earnings?.History ? Object.keys(data.Earnings.History).length : 0,
      highlights: data?.Highlights ? Object.keys(data.Highlights) : [],
      general: data?.General ? Object.keys(data.General) : []
    }));

    // Extract earnings history
    const earningsHistory = data?.Earnings?.History;

    if (!earningsHistory || Object.keys(earningsHistory).length === 0) {
      console.log(`[API] No earnings history found for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        error: 'No earnings history available',
        symbol: upperSymbol
      });
    }

    // Convert to array and sort by report date (most recent first)
    const earningsArray = Object.entries(earningsHistory)
      .map(([key, value]) => ({ ...value, key }))
      .filter(e => e.reportDate) // Only entries with report dates
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    if (earningsArray.length === 0) {
      console.log(`[API] No valid earnings entries for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        error: 'No valid earnings data',
        symbol: upperSymbol
      });
    }

    const latest = earningsArray[0];
    console.log(`[API] Latest earnings for ${upperSymbol}:`, JSON.stringify(latest));

    // Get previous year's same quarter for YoY comparison
    const previousYear = earningsArray.find(e => {
      if (!e.reportDate || !latest.reportDate) return false;
      const latestDate = new Date(latest.reportDate);
      const eDate = new Date(e.reportDate);
      const monthsDiff = (latestDate - eDate) / (1000 * 60 * 60 * 24 * 30);
      return monthsDiff >= 10 && monthsDiff <= 14; // ~1 year ago
    });

    // Calculate YoY EPS growth
    let yoyGrowth = null;
    if (previousYear && previousYear.epsActual != null && latest.epsActual != null && previousYear.epsActual !== 0) {
      yoyGrowth = ((latest.epsActual - previousYear.epsActual) / Math.abs(previousYear.epsActual)) * 100;
    }

    // Format currency values
    const formatCurrency = (value) => {
      if (value == null) return null;
      if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      return `$${value.toFixed(2)}`;
    };

    // Format date nicely
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Determine quarter string
    const getQuarterString = (item) => {
      if (item.fiscalQuarter && item.fiscalYear) {
        return `Q${item.fiscalQuarter} ${item.fiscalYear}`;
      }
      // Try to derive from date
      if (item.reportDate) {
        const date = new Date(item.reportDate);
        const month = date.getMonth();
        const quarter = Math.ceil((month + 1) / 3);
        return `Q${quarter} ${date.getFullYear()}`;
      }
      return 'Latest Quarter';
    };

    // Get revenue data - might be in different places
    const revenueActual = latest.revenue || data?.Highlights?.Revenue || null;
    const revenueEstimate = latest.revenueEstimate || null;

    const result = {
      symbol: upperSymbol,
      reportDate: formatDate(latest.reportDate),
      reportDateRaw: latest.reportDate,
      quarter: getQuarterString(latest),

      // EPS data
      epsActual: latest.epsActual != null ? `$${latest.epsActual.toFixed(2)}` : 'N/A',
      epsEstimate: latest.epsEstimate != null ? `$${latest.epsEstimate.toFixed(2)}` : 'N/A',
      epsActualRaw: latest.epsActual,
      epsEstimateRaw: latest.epsEstimate,
      epsBeat: latest.epsActual != null && latest.epsEstimate != null
        ? latest.epsActual > latest.epsEstimate
        : null,
      epsDifference: latest.epsDifference != null
        ? `$${latest.epsDifference.toFixed(2)}`
        : null,

      // Revenue data
      revenueActual: formatCurrency(revenueActual),
      revenueEstimate: formatCurrency(revenueEstimate),
      revenueActualRaw: revenueActual,
      revenueEstimateRaw: revenueEstimate,
      revenueBeat: revenueActual != null && revenueEstimate != null
        ? revenueActual > revenueEstimate
        : null,

      // YoY comparison
      yoyGrowth: yoyGrowth != null
        ? `${yoyGrowth >= 0 ? '+' : ''}${yoyGrowth.toFixed(0)}%`
        : 'N/A',
      yoyGrowthRaw: yoyGrowth,
      previousYearEps: previousYear?.epsActual != null
        ? `$${previousYear.epsActual.toFixed(2)}`
        : null,

      // Next earnings
      nextEarningsDate: data?.General?.NextEarningsDate || findNextEarnings(earningsArray) || 'TBD',

      // Metadata
      dataSource: 'EODHD',
      fetchedAt: new Date().toISOString()
    };

    console.log(`[API] Returning earnings for ${upperSymbol}`);
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Earnings fetch error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings',
      message: error.message
    });
  }
}

// Find the next upcoming earnings date from history
function findNextEarnings(earningsArray) {
  const now = new Date();

  // Look for any future earnings dates in the array
  for (const item of earningsArray) {
    if (item.reportDate) {
      const reportDate = new Date(item.reportDate);
      if (reportDate > now) {
        return item.reportDate;
      }
    }
  }

  return null;
}
