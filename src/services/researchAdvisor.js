// /src/services/researchAdvisor.js
// Claude-powered recommendation enhancement

/**
 * Safe number formatting helper
 */
const safeToFixed = (val, decimals = 2) => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? '0' : num.toFixed(decimals);
};

/**
 * Enhance recommendations with Claude-generated explanations
 * Called in background after instant recommendations are shown
 *
 * @param {Array} recommendations - Top assets from scoring algorithm
 * @param {Object} thesis - User's thesis
 * @param {Object} marketContext - Current market data
 * @returns {Promise<Array>} - Same assets with enhanced explanations
 */
export async function enhanceRecommendations(recommendations, thesis, marketContext) {
  try {
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'research',
        action: 'enhance_recommendations',
        params: {
          recommendations: recommendations.map(r => ({
            symbol: r.symbol,
            name: r.name,
            sector: r.sector || r.category,
            price: r.price,
            change24h: r.percentChange || r.change24h,
            change7d: r.priceChange7d,
            thesisScore: r.thesisScore?.score,
            alignment: r.thesisScore?.alignment,
          })),
          thesis: {
            battleType: thesis.battleType,
            stance: thesis.stance,
            sectors: thesis.sectors,
            risk: thesis.risk,
          },
          marketContext: {
            date: new Date().toISOString(),
            ...marketContext,
          }
        },
        messages: [{
          role: 'user',
          content: buildEnhancementPrompt(recommendations, thesis)
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse Claude's response and merge with recommendations
    return parseEnhancedExplanations(recommendations, data.response);

  } catch (error) {
    console.warn('[ResearchAdvisor] Enhancement failed, using generic:', error);
    // Return original recommendations unchanged
    return recommendations;
  }
}

/**
 * Build the prompt for Claude to enhance recommendations
 */
function buildEnhancementPrompt(recommendations, thesis) {
  const assetList = recommendations.map(r =>
    `- ${r.symbol} (${r.name}): ${r.thesisScore?.alignment || 'unknown'} alignment, ` +
    `${parseFloat(r.percentChange || 0) > 0 ? '+' : ''}${safeToFixed(r.percentChange || 0, 1)}% today`
  ).join('\n');

  return `
You are a MarketClash research advisor helping a user build their battle portfolio.

USER'S THESIS:
- Battle Type: ${thesis.battleType} (${thesis.battleType === 'head-to-head' ? '24-hour' : 'week-long'})
- Market Stance: ${thesis.stance}
- Sector Focus: ${thesis.sectors?.join(', ') || 'No preference'}
- Risk Tolerance: ${thesis.risk}

TOP RECOMMENDED ASSETS (based on thesis alignment scoring):
${assetList}

For each asset, write a 1-2 sentence explanation of WHY it fits their thesis.
- Use probability language ("should", "tends to", "may")
- Reference specific data points when relevant
- Keep each explanation under 40 words
- Be conversational, not robotic

Format your response as JSON:
{
  "explanations": {
    "SYMBOL1": "explanation text",
    "SYMBOL2": "explanation text",
    ...
  }
}
`.trim();
}

/**
 * Parse Claude's response and merge with recommendations
 */
function parseEnhancedExplanations(recommendations, response) {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[ResearchAdvisor] Could not find JSON in response');
      return recommendations;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const explanations = parsed.explanations || {};

    return recommendations.map(rec => ({
      ...rec,
      enhancedExplanation: explanations[rec.symbol] || null,
      isEnhanced: !!explanations[rec.symbol],
    }));

  } catch (error) {
    console.warn('[ResearchAdvisor] Failed to parse response:', error);
    return recommendations;
  }
}

/**
 * Get detailed analysis for a single asset
 * Called when user taps "Explore" on an asset
 */
export async function getAssetDeepDive(asset, thesis) {
  try {
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'research',
        action: 'asset_deep_dive',
        params: {
          asset: {
            symbol: asset.symbol,
            name: asset.name,
            sector: asset.sector || asset.category,
            price: asset.price,
            change24h: asset.percentChange || asset.change24h,
            change7d: asset.priceChange7d,
            change30d: asset.priceChange30d,
            beta: asset.beta,
            week52High: asset.week52High,
            week52Low: asset.week52Low,
            analystRating: asset.analystRating,
            earningsDate: asset.earningsDate,
          },
          thesis,
        },
        messages: [{
          role: 'user',
          content: buildDeepDivePrompt(asset, thesis)
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return parseDeepDiveResponse(data.response);

  } catch (error) {
    console.warn('[ResearchAdvisor] Deep dive failed:', error);
    return null;
  }
}

function buildDeepDivePrompt(asset, thesis) {
  const isCrypto = asset.category !== undefined;

  return `
Analyze ${asset.symbol} (${asset.name}) for a MarketClash battle.

ASSET DATA:
- Current Price: $${safeToFixed(asset.price, 2)}
- 24h Change: ${safeToFixed(asset.percentChange || asset.change24h || 0, 2)}%
- 7d Change: ${safeToFixed(asset.priceChange7d || 0, 2)}%
${!isCrypto ? `- Beta: ${asset.beta || 'N/A'}` : ''}
${!isCrypto ? `- 52-Week Range: $${safeToFixed(asset.week52Low, 2)} - $${safeToFixed(asset.week52High, 2)}` : ''}
- Type: ${isCrypto ? 'Cryptocurrency' : 'Stock'}
- Sector/Category: ${asset.sector || asset.category}

USER'S THESIS:
- Battle Type: ${thesis.battleType}
- Stance: ${thesis.stance}
- Risk: ${thesis.risk}

Provide analysis in this JSON format:
{
  "momentumInsight": "1-2 sentences about recent price action",
  "riskInsight": "1-2 sentences about volatility/risk profile",
  "thesisAlignment": "1-2 sentences about fit with user's thesis",
  "watchFor": ["risk factor 1", "risk factor 2"],
  "alignmentScore": "strong|moderate|weak"
}

Use probability language. Be concise.
`.trim();
}

function parseDeepDiveResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Generate the final Game Plan using Claude
 */
export async function generateGamePlan(thesis, convictionData, pinnedInsights, recommendations) {
  try {
    const response = await fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'research',
        action: 'generate_game_plan',
        params: {
          thesis,
          convictionData,
          pinnedInsights,
          recommendations: recommendations.slice(0, 10).map(r => ({
            symbol: r.symbol,
            name: r.name,
            sector: r.sector || r.category,
            price: r.price,
            percentChange: r.percentChange || r.change24h,
            priceChange7d: r.priceChange7d,
            thesisScore: r.thesisScore?.score,
            beta: r.beta,
          })),
        },
        messages: [{
          role: 'user',
          content: buildGamePlanPrompt(thesis, convictionData, pinnedInsights, recommendations)
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return parseGamePlanResponse(data.response, convictionData);

  } catch (error) {
    console.error('[ResearchAdvisor] Game plan generation failed:', error);
    // Return fallback game plan based on scoring algorithm
    return generateFallbackGamePlan(thesis, convictionData, recommendations);
  }
}

// Known crypto symbols for type detection
const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK'];

function buildGamePlanPrompt(thesis, convictionData, pinnedInsights, recommendations) {
  // Extract selections by category from selectedStocks
  const selectedStocks = convictionData.selectedStocks || {};
  const cryptoPicks = selectedStocks.crypto || [];
  const stockPicks = [
    ...(selectedStocks.momentum || []),
    ...(selectedStocks.steady || []),
    ...(selectedStocks.wildcard || []),
  ];

  const mustHaveList = convictionData.mustHave?.length > 0
    ? convictionData.mustHave.join(', ')
    : 'None specified';

  const mustAvoidList = convictionData.mustAvoid?.length > 0
    ? convictionData.mustAvoid.join(', ')
    : 'None specified';

  const pinnedList = pinnedInsights?.length > 0
    ? pinnedInsights.map(p => `- ${p.symbol}: ${p.metricName} = ${p.metricValue}`).join('\n')
    : 'None';

  const assetList = recommendations.slice(0, 10).map(r =>
    `- ${r.symbol} (${r.name}): Score ${r.thesisScore?.score || 'N/A'}, ` +
    `${(r.percentChange || 0) > 0 ? '+' : ''}${safeToFixed(r.percentChange || 0, 1)}% today, ` +
    `${(r.priceChange7d || 0) > 0 ? '+' : ''}${safeToFixed(r.priceChange7d || 0, 1)}% 7d`
  ).join('\n');

  // Build crypto requirement message
  const cryptoRequirement = cryptoPicks.length > 0
    ? `\n\nCRITICAL - CRYPTO REQUIREMENT:\nUser explicitly selected these crypto assets: ${cryptoPicks.join(', ')}\nThese MUST be included in the portfolio with "type": "crypto" field.`
    : '';

  return `
You are a MarketClash strategy advisor. Generate a personalized Game Plan.

USER'S THESIS:
- Battle Type: ${thesis.battleType} (${thesis.battleType === 'head-to-head' ? '24-hour' : 'week-long'})
- Market Stance: ${thesis.stance}
- Sector Focus: ${thesis.sectors?.join(', ') || 'No preference'}
- Risk Tolerance: ${thesis.risk}

USER'S SELECTED ASSETS BY CATEGORY:
- Momentum Stocks: ${stockPicks.length > 0 ? stockPicks.slice(0, 4).join(', ') : 'None'}
- Crypto Picks: ${cryptoPicks.length > 0 ? cryptoPicks.join(', ') : 'None'}

USER'S CONVICTION:
- Confidence Level: ${convictionData.confidence}
- Must-Have Assets: ${mustHaveList}
- Must-Avoid Assets: ${mustAvoidList}
${cryptoRequirement}

USER'S PINNED INSIGHTS:
${pinnedList}

TOP SCORING ASSETS (from thesis alignment algorithm):
${assetList}

PORTFOLIO RULES:
- Must have 7-13 assets total
- Each position: 7.5% minimum, 20% maximum
- Total must equal 100%
- ALL Must-have assets MUST be included (especially crypto if selected)
- Must-avoid assets MUST be excluded
- Higher confidence = more concentrated positions allowed
- Lower confidence = more diversified positions recommended

Generate a portfolio with this JSON structure:
{
  "strategySummary": "2-3 sentence overview of the strategy approach",
  "portfolio": [
    {
      "symbol": "NVDA",
      "type": "stock",
      "allocation": 15,
      "rationale": "One sentence why this allocation"
    },
    {
      "symbol": "ETH",
      "type": "crypto",
      "allocation": 10,
      "rationale": "One sentence why this allocation"
    }
  ],
  "risks": [
    "Risk statement 1",
    "Risk statement 2",
    "Risk statement 3"
  ],
  "insightConnections": "2-3 sentences connecting portfolio to user's pinned insights"
}

IMPORTANT: Include "type" field as "stock" or "crypto" for each asset.
Use probability language ("should", "may", "tends to"). Never guarantee returns.
`.trim();
}

function parseGamePlanResponse(response, convictionData) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[ResearchAdvisor] Could not find JSON in game plan response');
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure each portfolio item has a type field
    if (parsed.portfolio) {
      parsed.portfolio = parsed.portfolio.map(item => ({
        ...item,
        type: item.type || (CRYPTO_SYMBOLS.includes(item.symbol) ? 'crypto' : 'stock'),
      }));

      // Validate that selected crypto is included
      const selectedCrypto = convictionData?.selectedStocks?.crypto || [];
      const portfolioSymbols = parsed.portfolio.map(p => p.symbol);

      selectedCrypto.forEach(cryptoSymbol => {
        if (!portfolioSymbols.includes(cryptoSymbol)) {
          console.warn(`[ResearchAdvisor] Adding missing crypto: ${cryptoSymbol}`);
          // Add missing crypto with default allocation
          parsed.portfolio.push({
            symbol: cryptoSymbol,
            type: 'crypto',
            allocation: 10,
            rationale: 'Included per your selection',
          });
        }
      });

      // Rebalance if crypto was added
      if (parsed.portfolio.length > portfolioSymbols.length) {
        const total = parsed.portfolio.reduce((sum, p) => sum + p.allocation, 0);
        if (total > 100) {
          const factor = 100 / total;
          parsed.portfolio.forEach(p => {
            p.allocation = Math.round(p.allocation * factor * 10) / 10;
          });
        }
      }
    }

    return parsed;
  } catch (error) {
    console.warn('[ResearchAdvisor] Failed to parse game plan:', error);
    return null;
  }
}

/**
 * Fallback game plan if Claude API fails
 */
function generateFallbackGamePlan(thesis, convictionData, recommendations) {
  // Extract selected assets by category
  const selectedStocks = convictionData.selectedStocks || {};
  const cryptoPicks = selectedStocks.crypto || [];
  const stockPicks = [
    ...(selectedStocks.momentum || []),
    ...(selectedStocks.steady || []),
    ...(selectedStocks.wildcard || []),
  ];

  // Filter out must-avoid assets
  let availableAssets = recommendations.filter(
    r => !convictionData.mustAvoid?.includes(r.symbol)
  );

  const portfolio = [];
  const usedSymbols = new Set();

  // 1. Add crypto picks FIRST (these are critical to include)
  cryptoPicks.forEach(symbol => {
    if (!usedSymbols.has(symbol)) {
      portfolio.push({
        symbol,
        type: 'crypto',
        allocation: 12,
        rationale: 'Selected crypto asset for portfolio diversification',
      });
      usedSymbols.add(symbol);
    }
  });

  // 2. Add stock picks from selections
  stockPicks.forEach(symbol => {
    if (!usedSymbols.has(symbol)) {
      const asset = recommendations.find(r => r.symbol === symbol);
      portfolio.push({
        symbol,
        type: 'stock',
        allocation: 14,
        rationale: asset?.thesisScore?.alignment
          ? `High thesis alignment (${asset.thesisScore.alignment})`
          : 'Included per your selection',
      });
      usedSymbols.add(symbol);
    }
  });

  // 3. Fill remaining slots with top-scoring stocks if needed (min 7 assets)
  const remainingSlots = Math.max(0, 7 - portfolio.length);
  const topAssets = availableAssets
    .filter(a => !usedSymbols.has(a.symbol) && !CRYPTO_SYMBOLS.includes(a.symbol))
    .slice(0, remainingSlots);

  topAssets.forEach(asset => {
    portfolio.push({
      symbol: asset.symbol,
      type: 'stock',
      allocation: 12.5,
      rationale: `High thesis alignment (${asset.thesisScore?.alignment || 'moderate'})`,
    });
    usedSymbols.add(asset.symbol);
  });

  // 4. Normalize allocations to 100%
  const totalAllocation = portfolio.reduce((sum, p) => sum + p.allocation, 0);
  if (totalAllocation > 0) {
    portfolio.forEach(p => {
      p.allocation = Math.round((p.allocation / totalAllocation) * 100 * 10) / 10;
    });
  }

  // 5. Adjust to exactly 100%
  const finalTotal = portfolio.reduce((sum, p) => sum + p.allocation, 0);
  if (finalTotal !== 100 && portfolio.length > 0) {
    portfolio[0].allocation += (100 - finalTotal);
    portfolio[0].allocation = Math.round(portfolio[0].allocation * 10) / 10;
  }

  // Build summary including crypto mention if present
  const cryptoCount = portfolio.filter(p => p.type === 'crypto').length;
  const stockCount = portfolio.filter(p => p.type === 'stock').length;
  const cryptoMention = cryptoCount > 0 ? ` Includes ${cryptoCount} crypto position${cryptoCount > 1 ? 's' : ''} for diversification.` : '';

  return {
    strategySummary: `A ${thesis.risk} ${thesis.stance} portfolio with ${stockCount} stocks${cryptoMention} Built for a ${thesis.battleType === 'head-to-head' ? '24-hour' : 'week-long'} battle.`,
    portfolio,
    risks: [
      `${thesis.stance === 'bullish' ? 'Market downturn' : 'Market rally'} would work against this thesis`,
      `${thesis.risk === 'aggressive' ? 'High volatility may cause significant swings' : 'Conservative positioning may limit upside'}`,
      cryptoCount > 0 ? 'Crypto assets add volatility and 24/7 market exposure' : 'Correlated positions may move together, reducing diversification benefit',
    ],
    insightConnections: 'Portfolio constructed based on your thesis alignment scoring and stated preferences.',
  };
}

export default {
  enhanceRecommendations,
  getAssetDeepDive,
  generateGamePlan,
};
