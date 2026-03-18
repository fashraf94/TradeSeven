/**
 * AI Strategy Service
 * Generates written strategy insights using Claude AI
 * Uses existing /api/ai-advisor endpoint
 */

import { fetchWithAuth } from '../utils/fetchWithAuth';

/**
 * Get current trading session based on Eastern Time
 */
export const getCurrentSession = () => {
  const now = new Date();
  // Convert to ET (approximate - proper timezone handling would use a library)
  const etOffset = -5; // EST, -4 for EDT
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const etDate = new Date(utc + 3600000 * etOffset);
  const hours = etDate.getHours();
  const minutes = etDate.getMinutes();
  const time = hours + minutes / 60;

  if (time >= 9.5 && time < 11.5) {
    return {
      id: 'MORNING_BELL',
      name: 'Morning Bell',
      description: 'Gap up plays, pre-market volume, earnings movers',
      emoji: '🌅'
    };
  } else if (time >= 11.5 && time < 14) {
    return {
      id: 'MIDDAY',
      name: 'Midday',
      description: 'Momentum continuation, stable performers',
      emoji: '☀️'
    };
  } else if (time >= 14 && time < 16) {
    return {
      id: 'POWER_HOUR',
      name: 'Power Hour',
      description: 'Afternoon volatility, closing auction movers',
      emoji: '⚡'
    };
  } else {
    return {
      id: 'NIGHT_GAME',
      name: 'Night Game',
      description: 'After hours - crypto focus',
      emoji: '🌙'
    };
  }
};

/**
 * Generate AI strategy for BaggerBomb Game Plan
 * @param {Object} params
 * @param {string} params.riskStyle - 'aggressive' | 'balanced' | 'conservative'
 * @param {string[]} params.selectedSectors - Sector IDs
 * @param {Object[]} params.mustHavePicks - User's required stocks
 * @param {Object[]} params.breakoutCandidates - AI-scored breakout picks
 * @param {Object[]} params.safePlays - Lower risk picks
 * @param {Object} params.cryptoRecommendation - Crypto pick
 * @param {Object} params.sectorData - Sector performance data
 * @returns {Promise<string>} AI-generated strategy text
 */
export const generateAIStrategy = async ({
  riskStyle,
  selectedSectors,
  mustHavePicks,
  breakoutCandidates,
  safePlays,
  cryptoRecommendation,
  sectorData
}) => {
  try {
    // Build context for Claude
    const sectorSummary = selectedSectors.map(sectorId => {
      const data = sectorData?.[sectorId];
      if (!data) return `${sectorId}: No data`;
      return `${data.name}: ${data.performance?.month1?.toFixed(1) || 0}% (1M), Trend: ${data.trend?.label || 'Unknown'}, Breadth: ${data.breadth?.percent || 50}%`;
    }).join('\n');

    const breakoutList = breakoutCandidates?.slice(0, 5).map(s =>
      `${s.symbol} (Score: ${s.breakoutScore}, Threshold: ${s.threshold}%)`
    ).join(', ') || 'None';

    const safeList = safePlays?.slice(0, 3).map(s =>
      `${s.symbol} (Bust Risk: ${s.bustRisk}%)`
    ).join(', ') || 'None';

    const mustHaveList = mustHavePicks?.map(p => p.symbol).join(', ') || 'None';

    const prompt = `You are the BaggerBomb Strategy Advisor for FantasyTrades, a competitive stock trading game.

CONTEXT:
- Game Mode: BaggerBomb (session-based scoring with breakout bonuses)
- Risk Style: ${riskStyle}
- Selected Sectors: ${selectedSectors.join(', ')}
- User's Must-Have Picks: ${mustHaveList}
- Top Breakout Candidates: ${breakoutList}
- Safe Plays: ${safeList}
- Crypto Pick: ${cryptoRecommendation?.symbol || 'BTC'}

SECTOR DATA:
${sectorSummary}

SCORING RULES:
- Base: +10 points per 1% gain, -10 per 1% loss
- BaggerBomb Bonus: +15 points when a stock crosses its volatility threshold
- Bust Penalty: -10 to -35 points for negative threshold crosses
- Session Win: +10 bonus for winning each session (Morning Bell, Midday, Power Hour, Night Game)

TASK:
Write a brief, actionable game plan strategy (3-4 sentences max) that:
1. Highlights the key opportunity based on sector trends
2. Explains why the breakout candidates are promising
3. Notes any risk factors to watch
4. Gives a confident but not arrogant tone

Keep it conversational and exciting - this is a game! Use specific stock symbols when relevant.
Do NOT use bullet points or headers. Write in flowing prose.`;

    const response = await fetchWithAuth('/api/ai-advisor', {
      method: 'POST',
      body: JSON.stringify({
        advisorType: 'gameplan',
        prompt: prompt,
        maxTokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.message || 'Strategy generation complete. Good luck with your battle!';

  } catch (error) {
    console.error('Error generating AI strategy:', error);
    // Return fallback strategy
    return generateFallbackStrategy(riskStyle, selectedSectors, breakoutCandidates);
  }
};

/**
 * Generate wildcard and time-based picks using AI
 */
export const generateAIPicks = async ({
  riskStyle,
  selectedSectors,
  mustHavePicks,
  allAvailableStocks,
  currentSession
}) => {
  try {
    const excludeSymbols = mustHavePicks.map(p => p.symbol);
    const availableSymbols = allAvailableStocks
      .filter(s => !excludeSymbols.includes(s.symbol))
      .map(s => s.symbol)
      .slice(0, 50);

    const session = currentSession || getCurrentSession();

    const prompt = `You are picking stocks for a BaggerBomb game plan.

CONTEXT:
- Risk Style: ${riskStyle}
- Sectors: ${selectedSectors.join(', ')}
- User already picked: ${excludeSymbols.join(', ')}
- Current market session: ${session.id || 'MORNING_BELL'}

AVAILABLE STOCKS (pick from these):
${availableSymbols.join(', ')}

TASK:
Pick exactly 4 stocks as JSON:
- 2 "wildcard" picks (unexpected but smart choices based on correlations or contrarian plays)
- 2 "session" picks (stocks that tend to perform well during ${session.name || 'morning'} trading)

Response format (JSON only, no explanation):
{
  "wildcards": ["SYMBOL1", "SYMBOL2"],
  "sessionPicks": ["SYMBOL3", "SYMBOL4"],
  "reasoning": "Brief one-sentence explanation"
}`;

    const response = await fetchWithAuth('/api/ai-advisor', {
      method: 'POST',
      body: JSON.stringify({
        advisorType: 'gameplan',
        prompt: prompt,
        maxTokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`AI picks request failed: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response || data.message || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        wildcards: parsed.wildcards || [],
        sessionPicks: parsed.sessionPicks || [],
        reasoning: parsed.reasoning || ''
      };
    }

    throw new Error('Could not parse AI picks response');

  } catch (error) {
    console.error('Error generating AI picks:', error);
    // Return fallback picks
    return generateFallbackPicks(allAvailableStocks, mustHavePicks, riskStyle);
  }
};

/**
 * Fallback strategy when AI is unavailable
 */
const generateFallbackStrategy = (riskStyle, sectors, breakoutCandidates) => {
  const topPicks = breakoutCandidates?.slice(0, 3).map(s => s.symbol).join(', ') || 'your selected stocks';

  const styleText = {
    aggressive: `Going aggressive with high-volatility plays targeting those BaggerBomb bonuses.`,
    balanced: `Taking a balanced approach mixing breakout potential with stability.`,
    conservative: `Playing it safe with consistent performers while still hunting for breakouts.`
  };

  return `${styleText[riskStyle] || styleText.balanced} Focus on ${topPicks} as your primary breakout candidates - they're showing strong technical setups above their moving averages. Keep an eye on sector momentum and be ready to capitalize on any session wins for those bonus points!`;
};

/**
 * Fallback picks when AI is unavailable
 */
const generateFallbackPicks = (allStocks, mustHavePicks, riskStyle) => {
  const excluded = new Set(mustHavePicks.map(p => p.symbol));
  const available = allStocks.filter(s => !excluded.has(s.symbol));

  // Sort by change and pick
  const sorted = [...available].sort((a, b) => (b.change1W || 0) - (a.change1W || 0));

  // Wildcards: pick from middle of the pack (unexpected)
  const midIndex = Math.floor(sorted.length / 2);
  const wildcards = sorted.slice(midIndex, midIndex + 2).map(s => s.symbol);

  // Session: pick top performers
  const sessionPicks = sorted.slice(0, 2).map(s => s.symbol);

  return {
    wildcards,
    sessionPicks,
    reasoning: 'Picks based on recent performance and momentum.'
  };
};

export default {
  generateAIStrategy,
  generateAIPicks,
  getCurrentSession
};
