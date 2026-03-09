/**
 * Story Signal Detection Layer
 *
 * Pure JavaScript — no API calls, no AI. Analyzes stocksData + sectorData and
 * produces an "editorial brief" string that tells Claude Sonnet what the story
 * is before it writes a Daily Story chapter.
 *
 * Sector mapping source of truth: rankingConfig.js (server-side copy of
 * src/constants/sectors.js).
 */

import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from './rankingConfig.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNAL_TYPES = {
  DOMINANT_MOVER:  'DOMINANT_MOVER',
  THEME_CLUSTER:   'THEME_CLUSTER',
  CONTRADICTION:   'CONTRADICTION',
  MOMENTUM_SHIFT:  'MOMENTUM_SHIFT',
  SEMI_CANARY:     'SEMI_CANARY',
  QUIET_DAY:       'QUIET_DAY',
  CONSUMER_SIGNAL: 'CONSUMER_SIGNAL',
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Signal-type editorial rank for deterministic tie-breaking within the same
// priority level. Lower number = preferred lead story (a coordinated theme
// cluster is editorially richer than a single dominant mover).
const SIGNAL_TYPE_RANK = {
  [SIGNAL_TYPES.THEME_CLUSTER]:   0,
  [SIGNAL_TYPES.DOMINANT_MOVER]:  1,
  [SIGNAL_TYPES.CONTRADICTION]:   2,
  [SIGNAL_TYPES.MOMENTUM_SHIFT]:  3,
  [SIGNAL_TYPES.SEMI_CANARY]:     4,
  [SIGNAL_TYPES.CONSUMER_SIGNAL]: 5,
  [SIGNAL_TYPES.QUIET_DAY]:       6,
};

// Theme clusters — each member must exist in TICKER_TO_SECTOR
const THEME_CLUSTERS = {
  Semiconductors:         ['NVDA', 'AMD', 'AVGO'],
  'FAANG+':               ['AAPL', 'AMZN', 'META', 'GOOGL', 'MSFT', 'NVDA'],
  Banks:                  ['JPM', 'BAC', 'WFC', 'GS'],
  'Big Oil':              ['XOM', 'CVX', 'COP'],
  'Consumer Bellwethers': ['WMT', 'COST', 'HD', 'MCD'],
  Payments:               ['V', 'MA', 'AXP'],
};

// Cyclical vs Defensive sector classification
const CYCLICAL_SECTORS  = ['XLK', 'XLY', 'XLF', 'XLI', 'XLE', 'XLB'];
const DEFENSIVE_SECTORS = ['XLV', 'XLP', 'XLU'];
// Excluded (ambiguous): XLRE, XLC

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSectorName(sectorId) {
  return STOCK_UNIVERSE[sectorId]?.name || sectorId;
}

function findStockInData(stocksData, symbol) {
  return stocksData.find(s => s.symbol === symbol);
}

function findSectorInData(sectorData, sectorId) {
  return sectorData.find(s => s.id === sectorId);
}

// ---------------------------------------------------------------------------
// Signal Detectors
// ---------------------------------------------------------------------------

/**
 * a) Detect a single stock with |percentChange| > 4%.
 *    If multiple qualify, pick the largest absolute move.
 */
export function detectDominantMover(stocksData) {
  let best = null;
  let bestAbs = 0;

  for (const stock of stocksData) {
    const abs = Math.abs(stock.percentChange || 0);
    if (abs > 4 && abs > bestAbs) {
      best = stock;
      bestAbs = abs;
    }
  }

  if (!best) return null;

  const direction = best.percentChange > 0 ? 'up' : 'down';
  const sectorId = TICKER_TO_SECTOR[best.symbol];
  const sectorCtx = sectorId ? ` in ${getSectorName(sectorId)}` : '';

  return {
    signal: SIGNAL_TYPES.DOMINANT_MOVER,
    priority: 'high',
    detail: `${best.symbol} is ${direction} ${Math.abs(best.percentChange).toFixed(1)}%${sectorCtx}`,
    magnitude: bestAbs,
  };
}

/**
 * b) Detect theme clusters where 2+ members are all moving >1.5% in the same
 *    direction (all positive or all negative).
 */
export function detectThemeClusters(stocksData) {
  const stockMap = new Map(stocksData.map(s => [s.symbol, s]));
  let bestCluster = null;
  let bestAvg = 0;

  for (const [clusterName, members] of Object.entries(THEME_CLUSTERS)) {
    // Validate members exist in universe
    const validMembers = members.filter(sym => {
      if (!TICKER_TO_SECTOR[sym]) {
        console.warn(`[storySignals] Theme cluster "${clusterName}": ${sym} not found in TICKER_TO_SECTOR`);
        return false;
      }
      return true;
    });

    // Get members with price data and moves > 1.5%
    const movers = [];
    for (const sym of validMembers) {
      const stock = stockMap.get(sym);
      if (stock && Math.abs(stock.percentChange || 0) > 1.5) {
        movers.push(stock);
      }
    }

    if (movers.length < 2) continue;

    // Check same direction
    const allPositive = movers.every(s => s.percentChange > 0);
    const allNegative = movers.every(s => s.percentChange < 0);
    if (!allPositive && !allNegative) continue;

    const avgMove = movers.reduce((sum, s) => sum + Math.abs(s.percentChange), 0) / movers.length;

    if (avgMove > bestAvg) {
      const direction = allPositive ? 'up' : 'down';
      const tickerList = movers.map(s => `${s.symbol} ${s.percentChange > 0 ? '+' : ''}${s.percentChange.toFixed(1)}%`).join(', ');

      bestCluster = {
        signal: SIGNAL_TYPES.THEME_CLUSTER,
        priority: avgMove > 3 ? 'high' : 'medium',
        detail: `${clusterName} stocks are moving together (${direction}) — ${tickerList}`,
        magnitude: avgMove,
      };
      bestAvg = avgMove;
    }
  }

  return bestCluster;
}

/**
 * c) Detect contradictions: sector trending one way, its top stock the other.
 */
export function detectContradictions(sectorData, stocksData) {
  const results = [];

  for (const sector of sectorData) {
    const week1 = sector.performance?.week1;
    if (week1 == null) continue;

    // Find top holding: first from leadership array, else first in STOCK_UNIVERSE
    let topSymbol = sector.leadership?.[0]?.symbol;
    if (!topSymbol) {
      const universe = STOCK_UNIVERSE[sector.id];
      topSymbol = universe?.stocks?.[0];
    }
    if (!topSymbol) continue;

    const topStock = findStockInData(stocksData, topSymbol);
    if (!topStock) continue;

    const pctChange = topStock.percentChange || 0;

    // Sector up but top stock down, or vice versa
    if (week1 > 1 && pctChange < -1) {
      results.push({
        signal: SIGNAL_TYPES.CONTRADICTION,
        priority: 'medium',
        detail: `${sector.name} is up ${week1.toFixed(1)}% this week but ${topSymbol} is bucking the trend at ${pctChange.toFixed(1)}% today`,
        magnitude: Math.abs(week1) + Math.abs(pctChange),
      });
    } else if (week1 < -1 && pctChange > 1) {
      results.push({
        signal: SIGNAL_TYPES.CONTRADICTION,
        priority: 'medium',
        detail: `${sector.name} is down ${week1.toFixed(1)}% this week but ${topSymbol} is bucking the trend at +${pctChange.toFixed(1)}% today`,
        magnitude: Math.abs(week1) + Math.abs(pctChange),
      });
    }
  }

  if (results.length === 0) return null;
  // Return the strongest contradiction
  return results.sort((a, b) => b.magnitude - a.magnitude)[0];
}

/**
 * d) Detect momentum shifts: week1 vs month1 divergence.
 */
export function detectMomentumShifts(sectorData) {
  const results = [];

  for (const sector of sectorData) {
    const week1 = sector.performance?.week1;
    const month1 = sector.performance?.month1;
    if (week1 == null || month1 == null) continue;

    if (week1 < -1 && month1 > 3) {
      results.push({
        signal: SIGNAL_TYPES.MOMENTUM_SHIFT,
        priority: 'medium',
        detail: `${sector.name} is showing a momentum shift — sharp pullback (${week1.toFixed(1)}% this week) in a strong trend (+${month1.toFixed(1)}% this month)`,
        magnitude: Math.abs(week1) + month1,
      });
    } else if (week1 > 2 && month1 < 0) {
      results.push({
        signal: SIGNAL_TYPES.MOMENTUM_SHIFT,
        priority: 'medium',
        detail: `${sector.name} is showing a momentum shift — potential reversal (+${week1.toFixed(1)}% this week) from a downtrend (${month1.toFixed(1)}% this month)`,
        magnitude: week1 + Math.abs(month1),
      });
    }
  }

  if (results.length === 0) return null;
  return results.sort((a, b) => b.magnitude - a.magnitude)[0];
}

/**
 * e) Detect semiconductor canary: semis avg vs broader tech sector.
 */
export function detectSemiCanary(stocksData, sectorData) {
  const semiTickers = ['NVDA', 'AMD', 'AVGO'];
  const semiStocks = semiTickers
    .map(sym => findStockInData(stocksData, sym))
    .filter(Boolean);

  if (semiStocks.length === 0) return null;

  const semiAvg = semiStocks.reduce((sum, s) => sum + (s.percentChange || 0), 0) / semiStocks.length;

  const techSector = findSectorInData(sectorData, 'XLK');
  const techWeek1 = techSector?.performance?.week1;
  if (techWeek1 == null) return null;

  const diff = semiAvg - techWeek1;

  if (diff > 2) {
    return {
      signal: SIGNAL_TYPES.SEMI_CANARY,
      priority: 'medium',
      detail: `Semiconductors are leading the broader tech sector (semis avg ${semiAvg > 0 ? '+' : ''}${semiAvg.toFixed(1)}% vs XLK ${techWeek1 > 0 ? '+' : ''}${techWeek1.toFixed(1)}% weekly)`,
      magnitude: diff,
    };
  } else if (diff < -2) {
    return {
      signal: SIGNAL_TYPES.SEMI_CANARY,
      priority: 'medium',
      detail: `Semiconductors are lagging the broader tech sector (semis avg ${semiAvg > 0 ? '+' : ''}${semiAvg.toFixed(1)}% vs XLK ${techWeek1 > 0 ? '+' : ''}${techWeek1.toFixed(1)}% weekly)`,
      magnitude: Math.abs(diff),
    };
  }

  return null;
}

/**
 * f) Detect unusually quiet day. Mutually exclusive with dominant mover and
 *    theme clusters — if those fire, quiet day should not.
 */
export function detectQuietDay(stocksData, sectorData) {
  const anyBigStock = stocksData.some(s => Math.abs(s.percentChange || 0) > 1);
  if (anyBigStock) return null;

  const anyBigSector = sectorData.some(s => Math.abs(s.performance?.week1 || 0) > 0.5);
  if (anyBigSector) return null;

  return {
    signal: SIGNAL_TYPES.QUIET_DAY,
    priority: 'low',
    detail: 'Unusually quiet day — low volatility across the board',
    magnitude: 0,
  };
}

/**
 * g) Detect consumer confidence/caution via XLY vs XLP spread.
 */
export function detectConsumerSignal(sectorData) {
  const xly = findSectorInData(sectorData, 'XLY');
  const xlp = findSectorInData(sectorData, 'XLP');

  const xlyWeek1 = xly?.performance?.week1;
  const xlpWeek1 = xlp?.performance?.week1;
  if (xlyWeek1 == null || xlpWeek1 == null) return null;

  const spread = xlyWeek1 - xlpWeek1;

  if (spread > 2) {
    return {
      signal: SIGNAL_TYPES.CONSUMER_SIGNAL,
      priority: 'low',
      detail: `Consumer spending patterns suggest confidence — discretionary (XLY ${xlyWeek1 > 0 ? '+' : ''}${xlyWeek1.toFixed(1)}%) outpacing staples (XLP ${xlpWeek1 > 0 ? '+' : ''}${xlpWeek1.toFixed(1)}%)`,
      magnitude: spread,
    };
  } else if (spread < -2) {
    return {
      signal: SIGNAL_TYPES.CONSUMER_SIGNAL,
      priority: 'low',
      detail: `Consumer spending patterns suggest caution — staples (XLP ${xlpWeek1 > 0 ? '+' : ''}${xlpWeek1.toFixed(1)}%) outpacing discretionary (XLY ${xlyWeek1 > 0 ? '+' : ''}${xlyWeek1.toFixed(1)}%)`,
      magnitude: Math.abs(spread),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Narrative Guidance
// ---------------------------------------------------------------------------

function buildStoryGuidance(signalType) {
  const guidance = {
    [SIGNAL_TYPES.DOMINANT_MOVER]:  'Lead with this stock. Explain why it matters to the broader market and what it signals for its sector.',
    [SIGNAL_TYPES.THEME_CLUSTER]:   'This is a sector story, not a single-stock story. Explain the theme connecting these stocks and what it means.',
    [SIGNAL_TYPES.CONTRADICTION]:   'There\'s tension here — explore why things don\'t match. The contradiction is the story.',
    [SIGNAL_TYPES.MOMENTUM_SHIFT]:  'Something is changing — explain what\'s different now versus the recent trend.',
    [SIGNAL_TYPES.SEMI_CANARY]:     'Semiconductors are a leading indicator for tech and the broader market — connect to the bigger picture.',
    [SIGNAL_TYPES.QUIET_DAY]:       'The calm is the story. What are people waiting for? What catalysts are ahead?',
    [SIGNAL_TYPES.CONSUMER_SIGNAL]: 'This tells you about how confident people are feeling about spending — connect to the economic mood.',
  };
  return guidance[signalType] || 'Analyze the market data and find the most interesting story.';
}

// ---------------------------------------------------------------------------
// Market Mood (Cyclical vs Defensive Tilt)
// ---------------------------------------------------------------------------

function computeMarketMood(sectorData) {
  let cyclicalSum = 0;
  let cyclicalCount = 0;
  let defensiveSum = 0;
  let defensiveCount = 0;

  for (const sector of sectorData) {
    const week1 = sector.performance?.week1;
    if (week1 == null) continue;

    if (CYCLICAL_SECTORS.includes(sector.id)) {
      cyclicalSum += week1;
      cyclicalCount++;
    } else if (DEFENSIVE_SECTORS.includes(sector.id)) {
      defensiveSum += week1;
      defensiveCount++;
    }
  }

  const cyclicalAvg = cyclicalCount > 0 ? cyclicalSum / cyclicalCount : 0;
  const defensiveAvg = defensiveCount > 0 ? defensiveSum / defensiveCount : 0;
  const tilt = cyclicalAvg - defensiveAvg;

  // ±1% deadband
  if (tilt > 1) {
    return 'MARKET MOOD: Investors are chasing growth — cyclical sectors leading defensives';
  } else if (tilt < -1) {
    return 'MARKET MOOD: Investors are playing it safe — defensive sectors leading cyclicals';
  }
  return 'MARKET MOOD: Mixed — no clear tilt between cyclical and defensive sectors';
}

// ---------------------------------------------------------------------------
// Signal Sorting (deterministic)
// ---------------------------------------------------------------------------

/**
 * Sort signals by: priority (high > medium > low), then signal-type editorial
 * rank (theme clusters > dominant movers > ...), then magnitude (highest first).
 */
function sortSignals(signals) {
  return signals.sort((a, b) => {
    // 1. Priority
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;

    // 2. Signal-type rank (lower = preferred lead)
    const tDiff = (SIGNAL_TYPE_RANK[a.signal] ?? 99) - (SIGNAL_TYPE_RANK[b.signal] ?? 99);
    if (tDiff !== 0) return tDiff;

    // 3. Magnitude (higher = preferred)
    return (b.magnitude || 0) - (a.magnitude || 0);
  });
}

// ---------------------------------------------------------------------------
// Main Export: buildEditorialBrief
// ---------------------------------------------------------------------------

/**
 * Analyze stocksData + sectorData and produce an editorial brief string.
 *
 * @param {Array} stocksData  - Array of stock objects from EODHD
 * @param {Array} sectorData  - Array of sector objects from sectorDataService
 * @param {string} economicEvents - Upcoming economic events context (optional)
 * @param {string} sonarNews  - Recent news from Sonar (optional)
 * @returns {string} Editorial brief for Sonnet
 */
export function buildEditorialBrief(stocksData, sectorData, economicEvents = '', sonarNews = '') {
  const stocks = stocksData || [];
  const sectors = sectorData || [];

  // Run all detectors
  const rawSignals = [
    detectDominantMover(stocks),
    detectThemeClusters(stocks),
    detectContradictions(sectors, stocks),
    detectMomentumShifts(sectors),
    detectSemiCanary(stocks, sectors),
    detectQuietDay(stocks, sectors),
    detectConsumerSignal(sectors),
  ].filter(Boolean);

  // If dominant mover or theme clusters fired, remove quiet day
  const hasDominant = rawSignals.some(s => s.signal === SIGNAL_TYPES.DOMINANT_MOVER);
  const hasCluster  = rawSignals.some(s => s.signal === SIGNAL_TYPES.THEME_CLUSTER);
  const signals = (hasDominant || hasCluster)
    ? rawSignals.filter(s => s.signal !== SIGNAL_TYPES.QUIET_DAY)
    : rawSignals;

  // Market mood
  const mood = computeMarketMood(sectors);

  // No signals — generic brief
  if (signals.length === 0) {
    const lines = [
      'EDITORIAL BRIEF:',
      '',
      'LEAD STORY: Balanced market day — no dominant signals detected.',
      '',
      'NARRATIVE GUIDANCE: Look for subtle shifts in sector rotation or individual stock stories. Focus on what\'s ahead rather than what happened today.',
    ];
    if (economicEvents) lines.push('', `UPCOMING EVENTS: ${economicEvents}`);
    if (sonarNews) lines.push('', `RECENT NEWS CONTEXT: ${sonarNews}`);
    lines.push('', mood);
    return lines.join('\n');
  }

  // Sort and pick lead + supporting
  sortSignals(signals);
  const lead = signals[0];
  const supporting = signals.slice(1, 4); // up to 3 supporting signals

  const lines = [
    'EDITORIAL BRIEF:',
    '',
    `LEAD STORY: ${lead.detail}`,
  ];

  if (supporting.length > 0) {
    lines.push('', 'SUPPORTING CONTEXT:');
    for (const s of supporting) {
      lines.push(`- ${s.detail}`);
    }
  }

  lines.push('', `NARRATIVE GUIDANCE: ${buildStoryGuidance(lead.signal)}`);

  if (economicEvents) lines.push('', `UPCOMING EVENTS: ${economicEvents}`);
  if (sonarNews) lines.push('', `RECENT NEWS CONTEXT: ${sonarNews}`);

  lines.push('', mood);

  return lines.join('\n');
}
