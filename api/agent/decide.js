import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { STRATEGY_TOOL, PORTFOLIO_TOOL } from '../_utils/agentToolSchema.js';
import { CRYPTO_ASSETS, VALID_CRYPTO_SYMBOLS, getCryptoBySymbol } from '../_utils/agentCryptoAssets.js';
import {
  buildStrategySystemPrompt,
  buildStrategyUserPrompt,
  buildPortfolioSystemPrompt,
  formatMarketCSV,
  formatStoriesSummary,
} from '../_utils/agentPromptAssembly.js';
import { createAgentBattle } from '../_utils/agentBattleService.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';

// Vercel Pro timeout — two-call AI chain needs breathing room
export const config = { maxDuration: 60 };

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  // 1. Security + method check
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 3, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agentId } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'agentId required' });
  }

  const db = getFirebaseAdmin();
  const anthropic = getAnthropicClient();

  try {
    // 2. Idempotency guard — prevent double-deploy
    const agentRef = db.collection('agents').doc(agentId);
    const agentDoc = await agentRef.get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = { id: agentDoc.id, ...agentDoc.data() };

    // Check for in-progress deploy (lock)
    if (agent.deployingAt) {
      const deployAge = Date.now() - new Date(agent.deployingAt).getTime();
      if (deployAge < 120000) {
        return res.status(429).json({ error: 'Deploy already in progress' });
      }
      // Lock is stale (>2 min), proceed anyway
    }

    // Per-agent cooldown: minimum 2 minutes between deploys
    if (agent.lastDeployedAt) {
      const sinceLastDeploy = Date.now() - new Date(agent.lastDeployedAt).getTime();
      if (sinceLastDeploy < 120000) {
        return res.status(429).json({ error: 'Please wait 2 minutes between deploys' });
      }
    }

    // Set deploy lock
    await agentRef.update({ deployingAt: new Date().toISOString() });

    // 3. Fetch stock universe — ONE Firestore read
    const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
    if (!rankingsDoc.exists) {
      await agentRef.update({ deployingAt: null });
      return res.status(503).json({ error: 'Stock rankings not available. Cron may not have run yet.' });
    }
    const stockUniverse = rankingsDoc.data().stocks || [];

    // 4. Fetch recent FantasyTimes stories
    const storiesSnap = await db
      .collection('fantasyTimesStories')
      .orderBy('publishedAt', 'desc')
      .limit(5)
      .get();
    const stories = storiesSnap.docs.map((d) => d.data());

    // 5. Build market data
    const marketCSV = formatMarketCSV(stockUniverse);
    const storiesSummary = formatStoriesSummary(stories);

    // 6. SONNET CALL — Strategic Analysis (with Tool Use)
    const strategySystem = buildStrategySystemPrompt(marketCSV, storiesSummary);
    const strategyUser = buildStrategyUserPrompt(agent);

    const strategyResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: strategySystem,
      messages: [{ role: 'user', content: strategyUser }],
      tools: [STRATEGY_TOOL],
      tool_choice: { type: 'tool', name: 'submit_strategy' },
    });

    // Extract strategy tool result
    const stratToolUse = strategyResponse.content.find((c) => c.type === 'tool_use');
    let strategy;

    if (stratToolUse) {
      strategy = stratToolUse.input;
    } else {
      // Fallback: Sonnet didn't use the tool — use top 35 by baggerBombFit
      console.warn('[agent/decide] Sonnet did not use submit_strategy tool. Using fallback shortlist.');
      strategy = {
        brief: 'Automated selection based on BaggerBomb fitness scores.',
        shortlist: stockUniverse
          .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0))
          .slice(0, 35)
          .map((s) => s.symbol),
      };
    }

    // Validate shortlist — ensure all tickers exist in universe
    const validSymbols = new Set(stockUniverse.map((s) => s.symbol));
    strategy.shortlist = strategy.shortlist.filter((t) => validSymbols.has(t));

    if (strategy.shortlist.length < 15) {
      // Not enough valid tickers — pad with top baggerBombFit stocks
      const existing = new Set(strategy.shortlist);
      const padding = stockUniverse
        .slice()
        .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0))
        .filter((s) => !existing.has(s.symbol))
        .slice(0, 35 - strategy.shortlist.length)
        .map((s) => s.symbol);
      strategy.shortlist.push(...padding);
    }

    // Get detailed data for shortlisted stocks only
    const shortlistSet = new Set(strategy.shortlist);
    const shortlistData = stockUniverse.filter((s) => shortlistSet.has(s.symbol));
    const shortlistCSV = formatMarketCSV(shortlistData);

    // Build crypto list string
    const cryptoListStr = CRYPTO_ASSETS.map(
      (c) => `${c.symbol} (${c.name}, ATR ~${c.baseATR}%)`
    ).join('\n');

    // 7. HAIKU CALL — Portfolio Construction (with Tool Use)
    const portfolioSystem = buildPortfolioSystemPrompt(strategy.brief, shortlistCSV, cryptoListStr);

    const portfolioResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: portfolioSystem,
      messages: [{ role: 'user', content: 'Build the optimal portfolio now. Use the submit_portfolio tool.' }],
      tools: [PORTFOLIO_TOOL],
      tool_choice: { type: 'tool', name: 'submit_portfolio' },
    });

    const portToolUse = portfolioResponse.content.find((c) => c.type === 'tool_use');
    if (!portToolUse) {
      throw new Error('Haiku did not use submit_portfolio tool');
    }

    let portfolioResult = portToolUse.input;

    // 8. Validate portfolio
    const validation = validatePortfolio(portfolioResult, validSymbols);

    if (!validation.valid) {
      console.warn('[agent/decide] Portfolio validation failed:', validation.errors);

      // Retry once with error feedback
      const retryResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: portfolioSystem,
        messages: [
          { role: 'user', content: 'Build the optimal portfolio now. Use the submit_portfolio tool.' },
          { role: 'assistant', content: portfolioResponse.content },
          {
            role: 'user',
            content: `ERROR: Your portfolio has issues: ${validation.errors.join(', ')}. Fix these and resubmit using the submit_portfolio tool.`,
          },
        ],
        tools: [PORTFOLIO_TOOL],
        tool_choice: { type: 'tool', name: 'submit_portfolio' },
      });

      const retryToolUse = retryResponse.content.find((c) => c.type === 'tool_use');
      if (retryToolUse) {
        const retryValidation = validatePortfolio(retryToolUse.input, validSymbols);
        if (retryValidation.valid) {
          portfolioResult = retryToolUse.input;
        } else {
          console.error('[agent/decide] Retry also failed. Using fallback portfolio.');
          portfolioResult = buildFallbackPortfolio(shortlistData);
        }
      } else {
        portfolioResult = buildFallbackPortfolio(shortlistData);
      }
    }

    // 9. Enrich with full asset data (convert tickers to V3 objects)
    const enrichedPortfolio = enrichPortfolio(portfolioResult, stockUniverse);

    // 10. Write to Firestore + clear lock
    await agentRef.update({
      lastDecision: {
        portfolio: enrichedPortfolio.portfolio,
        bench: enrichedPortfolio.bench,
        innerMonologue: portfolioResult.innerMonologue,
        strategyBrief: strategy.brief,
        shortlist: strategy.shortlist,
        createdAt: new Date().toISOString(),
        models: { strategy: 'sonnet-4', portfolio: 'haiku-4.5' },
      },
      lastDeployedAt: new Date().toISOString(),
      deployingAt: null,
      updatedAt: new Date().toISOString(),
    });

    // === PHASE 2: Create Agent Battle ===

    // 11. Check for existing active battle (one per agent)
    const activeBattles = await db.collection('agentBattles')
      .where('agentId', '==', agentDoc.id)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!activeBattles.empty) {
      return res.status(200).json({
        success: true,
        portfolioUpdated: true,
        battleCreated: false,
        reason: 'Agent already has an active battle',
        existingBattleId: activeBattles.docs[0].id,
        portfolio: enrichedPortfolio.portfolio,
        bench: enrichedPortfolio.bench,
        innerMonologue: portfolioResult.innerMonologue,
        strategyBrief: strategy.brief,
      });
    }

    // 12. Build sector map from stockUniverse (already in memory)
    const sectorMap = {};
    stockUniverse.forEach(s => { sectorMap[s.symbol] = s.sectorName || 'Unknown'; });
    CRYPTO_ASSETS.forEach(c => { sectorMap[c.symbol] = 'Crypto'; });

    // 13. Fetch entry prices (rate-limited: 5 concurrent, 200ms between batches)
    const allSymbols = [
      ...enrichedPortfolio.portfolio.star.map(a => a.symbol),
      ...enrichedPortfolio.portfolio.core.map(a => a.symbol),
      ...enrichedPortfolio.portfolio.support.map(a => a.symbol),
      ...enrichedPortfolio.bench.stocks.map(a => a.symbol),
      ...(enrichedPortfolio.bench.crypto ? [enrichedPortfolio.bench.crypto.symbol] : []),
    ].filter(Boolean);

    const startingPrices = {};
    const PRICE_CONCURRENCY = 5;
    for (let i = 0; i < allSymbols.length; i += PRICE_CONCURRENCY) {
      const batch = allSymbols.slice(i, i + PRICE_CONCURRENCY);
      await Promise.allSettled(batch.map(async (symbol) => {
        try {
          const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] });
          if (data?.price?.current) startingPrices[symbol] = data.price.current;
        } catch (err) {
          console.warn(`[agent/decide] Price fetch failed for ${symbol}:`, err.message);
        }
      }));
      if (i + PRICE_CONCURRENCY < allSymbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 14. Build thresholds from baseATR on assets (consistent with scoring engine)
    const thresholds = {};
    const allAssets = [
      ...enrichedPortfolio.portfolio.star,
      ...enrichedPortfolio.portfolio.core,
      ...enrichedPortfolio.portfolio.support,
      ...enrichedPortfolio.bench.stocks,
      ...(enrichedPortfolio.bench.crypto ? [enrichedPortfolio.bench.crypto] : []),
    ].filter(Boolean);
    for (const asset of allAssets) {
      const baseATR = asset.baseATR || (asset.isCrypto ? 5.0 : 2.5);
      thresholds[asset.symbol] = {
        threshold: baseATR,
        rallyThreshold: baseATR * 1.5,
        moonshotThreshold: baseATR * 2.0,
      };
    }

    // 15. Create agent battle
    const agentData = {
      id: agentDoc.id,
      ...agent,
      lastDecision: {
        portfolio: enrichedPortfolio.portfolio,
        bench: enrichedPortfolio.bench,
        innerMonologue: portfolioResult.innerMonologue,
        strategyBrief: strategy.brief,
        shortlist: strategy.shortlist,
      },
    };

    const battleResult = await createAgentBattle(
      db, agentData, thresholds, startingPrices,
      { duration: req.body.duration || '3d', sectorMap }
    );

    // 16. Write activeBattleId back to agent doc
    await agentRef.update({ activeBattleId: battleResult.id });

    // 17. Return to client
    return res.status(200).json({
      success: true,
      portfolioUpdated: true,
      battleCreated: true,
      agentBattleId: battleResult.id,
      portfolio: enrichedPortfolio.portfolio,
      bench: enrichedPortfolio.bench,
      innerMonologue: portfolioResult.innerMonologue,
      strategyBrief: strategy.brief,
    });
  } catch (error) {
    console.error('[agent/decide] Error:', error);
    // Clear deploy lock on error
    try {
      await db.collection('agents').doc(agentId).update({ deployingAt: null });
    } catch (_e) {
      /* ignore cleanup error */
    }

    return res.status(500).json({
      error: 'Failed to generate portfolio',
      details: error.message,
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────

function validatePortfolio(result, validSymbols) {
  const errors = [];

  // Check counts
  if (result.star?.length !== 2) errors.push('Star must have exactly 2 stocks');
  if (result.core?.length !== 2) errors.push('Core must have exactly 2 stocks');
  if (result.support_stocks?.length !== 2) errors.push('Support must have exactly 2 stocks');
  if (result.bench_stocks?.length !== 3) errors.push('Bench must have exactly 3 stocks');
  if (!result.support_crypto) errors.push('Missing support crypto');
  if (!result.bench_crypto) errors.push('Missing bench crypto');

  // Check valid stock symbols
  const allStocks = [
    ...(result.star || []),
    ...(result.core || []),
    ...(result.support_stocks || []),
    ...(result.bench_stocks || []),
  ];
  allStocks.forEach((s) => {
    if (!validSymbols.has(s)) errors.push(`Unknown stock: ${s}`);
  });

  // Check valid crypto
  if (result.support_crypto && !VALID_CRYPTO_SYMBOLS.includes(result.support_crypto)) {
    errors.push(`Invalid crypto: ${result.support_crypto}`);
  }
  if (result.bench_crypto && !VALID_CRYPTO_SYMBOLS.includes(result.bench_crypto)) {
    errors.push(`Invalid crypto: ${result.bench_crypto}`);
  }

  // Check duplicates
  const allSymbols = [...allStocks, result.support_crypto, result.bench_crypto].filter(Boolean);
  const unique = new Set(allSymbols);
  if (unique.size !== allSymbols.length) errors.push('Duplicate symbols detected');

  // Check crypto are different
  if (result.support_crypto && result.support_crypto === result.bench_crypto) {
    errors.push('Support and bench crypto must be different');
  }

  return { valid: errors.length === 0, errors };
}

function buildFallbackPortfolio(shortlistData) {
  // Sort by baggerBombFit descending
  const sorted = shortlistData
    .slice()
    .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0));

  const star = sorted.slice(0, 2).map((s) => s.symbol);

  // Core: pick different sectors from Star for diversity
  const starSectors = new Set(sorted.slice(0, 2).map((s) => s.sectorName));
  const corePool = sorted.slice(2).filter((s) => !starSectors.has(s.sectorName));
  const core =
    corePool.length >= 2
      ? corePool.slice(0, 2).map((s) => s.symbol)
      : sorted.slice(2, 4).map((s) => s.symbol);

  // Support: lowest atrPercentile from remaining
  const usedSymbols = new Set([...star, ...core]);
  const remaining = sorted.filter((s) => !usedSymbols.has(s.symbol));
  const supportSorted = remaining
    .slice()
    .sort((a, b) => (a.atrPercentile || 0) - (b.atrPercentile || 0));
  const supportStocks = supportSorted.slice(0, 2).map((s) => s.symbol);

  // Bench: next 3 from remaining
  const usedAll = new Set([...usedSymbols, ...supportStocks]);
  const benchPool = sorted.filter((s) => !usedAll.has(s.symbol));
  const benchStocks = benchPool.slice(0, 3).map((s) => s.symbol);

  return {
    star,
    core,
    support_stocks: supportStocks,
    support_crypto: 'BTC',
    bench_stocks: benchStocks,
    bench_crypto: 'ETH',
    innerMonologue: {
      strategy: 'Algorithmic selection based on BaggerBomb fitness scores. High-conviction plays in Star, diversified sectors in Core.',
      starRationale: 'Top 2 stocks by BaggerBomb fit score for maximum upside potential.',
      coreRationale: 'Selected from different sectors than Star picks for diversification.',
      supportRationale: 'Lowest volatility stocks from the shortlist for stability.',
      benchRationale: 'Next best available stocks as swap reserves.',
    },
  };
}

function enrichPortfolio(result, stockUniverse) {
  const lookup = {};
  stockUniverse.forEach((s) => {
    lookup[s.symbol] = s;
  });

  const toAsset = (symbol) => {
    // Check stocks first
    const stock = lookup[symbol];
    if (stock) {
      return {
        symbol,
        name: stock.name || symbol,
        baseATR: (stock.atrPercentile || 0.5) * 8,
        isCrypto: false,
      };
    }
    // Check crypto
    const crypto = getCryptoBySymbol(symbol);
    if (crypto) return { ...crypto };
    // Unknown — should not happen after validation
    return { symbol, name: symbol, baseATR: 3.0, isCrypto: false };
  };

  return {
    portfolio: {
      star: result.star.map(toAsset),
      core: result.core.map(toAsset),
      support: [...result.support_stocks.map(toAsset), toAsset(result.support_crypto)],
    },
    bench: {
      stocks: result.bench_stocks.map(toAsset),
      crypto: toAsset(result.bench_crypto),
    },
  };
}
