// api/cron/agent-evaluate.js
// Mid-battle evaluation cron for AI trading agents.
// Runs every 15 minutes during market hours (weekdays).
// Queries agentBattles collection, computes scores, optionally calls Haiku for trade decisions.
//
// Schedule: */15 13,14,15,16,17,18,19,20,21 * * 1-5

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isMarketOpen } from '../_utils/marketSchedule.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import {
  calculateAssetScoreServer,
  flattenPortfolioServer,
} from '../_utils/agentScoring.js';
import {
  buildEvalSystemPrompt,
  buildAgentIdentityBlock,
  buildLiveContextBlock,
  computeBattlePhase,
  getCurrentTradingDayServer,
} from '../_utils/agentEvalPromptAssembly.js';
import { TRADE_DECISION_TOOL } from '../_utils/agentEvalToolSchema.js';
import { evaluateTriggers, fetchRecentNews } from '../_utils/agentTriggerGate.js';
import { validateTradeDecision, executeSwapServer } from '../_utils/agentSwapExecution.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[AgentEval]';
const EVALUATING_LOCK_TIMEOUT_MS = 120_000; // 2 minutes

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  // ---- 1. Auth ----
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- 2. Market hours guard ----
  if (!isMarketOpen()) {
    return res.status(200).json({ skipped: true, reason: 'market_closed' });
  }

  const db = getFirebaseAdmin();
  const startTime = Date.now();
  const summary = { evaluated: 0, triggered: 0, swapped: 0, held: 0, errors: 0, skipped: 0 };

  try {
    // ---- 3. Query active agent battles ----
    const battles = await findActiveAgentBattles(db);

    if (battles.length === 0) {
      return res.status(200).json({ evaluated: 0, message: 'No active agent battles' });
    }

    console.log(`${LOG_PREFIX} Found ${battles.length} active agent battle(s)`);

    // ---- 4. Process each battle sequentially ----
    for (const battle of battles) {
      try {
        await processAgentBattle(db, battle, summary);
      } catch (err) {
        console.error(`${LOG_PREFIX} Error processing battle ${battle.id}:`, err.message);
        summary.errors++;

        // Log error to cronState
        try {
          const battleRef = db.collection('agentBattles').doc(battle.id);
          const cronErrors = (battle.cronState?.cronErrors || []).slice(-19);
          cronErrors.push({
            timestamp: new Date().toISOString(),
            error: err.message,
            stack: (err.stack || '').slice(0, 200),
          });
          await battleRef.update({
            'cronState.cronErrors': cronErrors,
            'cronState.evaluatingAt': null,
          });
        } catch (logErr) {
          console.error(`${LOG_PREFIX} Failed to log error for battle ${battle.id}:`, logErr.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Complete in ${duration}ms:`, summary);

    return res.status(200).json({ ...summary, duration });
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err);
    return res.status(500).json({ error: err.message });
  }
}

// ==================== CORE PROCESSING ====================

async function processAgentBattle(db, battle, summary) {
  const battleRef = db.collection('agentBattles').doc(battle.id);

  // ---- Idempotency: check evaluatingAt lock ----
  if (battle.cronState?.evaluatingAt) {
    const lockAge = Date.now() - new Date(battle.cronState.evaluatingAt).getTime();
    if (lockAge < EVALUATING_LOCK_TIMEOUT_MS) {
      console.log(`${LOG_PREFIX} Battle ${battle.id} already being evaluated (lock age: ${lockAge}ms) — skipping`);
      summary.skipped++;
      return;
    }
  }

  // Set lock
  await battleRef.update({ 'cronState.evaluatingAt': new Date().toISOString() });

  try {
    const ctx = battle.agentContext || {};
    const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);

    // ---- Collect all symbols ----
    const flatPortfolio = flattenPortfolioServer(battle.portfolio);
    const portfolioSymbols = flatPortfolio.map(a => a.symbol).filter(Boolean);
    const benchAssets = [
      ...(battle.portfolio?.bench?.stocks || []),
      ...(battle.portfolio?.bench?.crypto ? [battle.portfolio.bench.crypto] : []),
    ].filter(Boolean);
    const benchSymbols = benchAssets.map(a => a.symbol).filter(Boolean);
    const macroSymbols = ['SPY', 'QQQ', 'BTC-USD.CC'];
    const allSymbols = [...new Set([...portfolioSymbols, ...benchSymbols, ...macroSymbols])];

    // ---- Fetch prices ----
    const prices = {};
    await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] });
          if (data?.price) {
            prices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`${LOG_PREFIX} Price fetch failed for ${symbol}:`, err.message);
        }
      })
    );

    // ---- Compute macro benchmarks (Amendment 4) ----
    const macroPrices = {
      SPY: prices['SPY']?.changePercent || 0,
      QQQ: prices['QQQ']?.changePercent || 0,
      BTC: prices['BTC-USD.CC']?.changePercent || 0,
    };

    // ---- Compute scores for active positions ----
    const startingPrices = battle.portfolio?.startingPrices || {};
    const assetScores = flatPortfolio.map(asset => {
      const currentPrice = prices[asset.symbol]?.current;
      const entryPrice = asset.swapPrice || startingPrices[asset.symbol] || 0;

      if (!currentPrice || entryPrice <= 0) {
        return calculateAssetScoreServer(
          { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
          0,
          battle.thresholdHistory?.[asset.symbol] || {}
        );
      }

      let priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      const previousClose = prices[asset.symbol]?.previousClose;
      const thresholdPriceChange = previousClose && previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : null;

      return calculateAssetScoreServer(
        { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
        priceChange,
        battle.thresholdHistory?.[asset.symbol] || {},
        {},
        thresholdPriceChange
      );
    });

    // ---- Update scores (always, even without Haiku) ----
    const activeScore = assetScores.reduce((sum, s) => sum + s.totalPoints, 0);
    const bankedScore = (battle.trades || []).reduce((sum, t) => sum + (t.lockedPoints || 0), 0);
    const currentScore = activeScore + bankedScore;

    const scoreUpdate = {
      'scoreState.activeScore': Math.round(activeScore * 100) / 100,
      'scoreState.bankedScore': Math.round(bankedScore * 100) / 100,
      'scoreState.currentScore': Math.round(currentScore * 100) / 100,
      'scoreState.lastScoredAt': new Date().toISOString(),
    };

    // Track peak score
    if (currentScore > (battle.scoreState?.peakScore || 0)) {
      scoreUpdate['scoreState.peakScore'] = Math.round(currentScore * 100) / 100;
      scoreUpdate['scoreState.peakScoreAt'] = new Date().toISOString();
    }

    // ---- Update threshold history ----
    const updatedThresholdHistory = { ...(battle.thresholdHistory || {}) };
    for (const score of assetScores) {
      updatedThresholdHistory[score.symbol] = score.history;
    }
    scoreUpdate.thresholdHistory = updatedThresholdHistory;

    // ---- Fetch news for trigger gate ----
    const news = await fetchRecentNews(db, portfolioSymbols);

    // ---- Evaluate triggers ----
    const { shouldEvaluate, triggers } = evaluateTriggers(battle, assetScores, prices, news);

    if (!shouldEvaluate) {
      // No triggers — update scores and move on
      scoreUpdate['cronState.lastEvaluatedAt'] = new Date().toISOString();
      scoreUpdate['cronState.triggerGatePassCount'] = (battle.cronState?.triggerGatePassCount || 0) + 1;
      scoreUpdate['cronState.evaluatingAt'] = null;
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Call Haiku ----
    summary.triggered++;
    const anthropic = getAnthropicClient();
    const agentName = ctx.agentName || 'Agent';
    const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

    let haikuResult = null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const response = await Promise.race([
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          temperature: 0.4,
          system: buildEvalSystemPrompt(agentName, archetype),
          messages: [
            { role: 'user', content: buildAgentIdentityBlock(battle) },
            { role: 'assistant', content: 'I understand my identity and strategic context. Show me the live battle state.' },
            {
              role: 'user',
              content: buildLiveContextBlock(
                battle, prices, macroPrices, assetScores,
                triggers, news, battle.evaluations
              ),
            },
          ],
          tools: [TRADE_DECISION_TOOL],
          tool_choice: { type: 'tool', name: 'submit_trade_decision' },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Haiku timeout')), 10_000)),
      ]);

      inputTokens = response.usage?.input_tokens || 0;
      outputTokens = response.usage?.output_tokens || 0;

      // Extract tool use block
      const toolUse = response.content?.find(c => c.type === 'tool_use');
      if (toolUse?.input) {
        haikuResult = toolUse.input;
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Haiku call failed for battle ${battle.id}:`, err.message);
      // Default to HOLD on timeout or error
    }

    // ---- Process decision ----
    const evalId = `eval_${String((battle.evaluations?.length || 0) + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const phase = computeBattlePhase(battle);

    let decision = haikuResult?.decision || 'HOLD';
    let downgraded = false;
    let validationErrors = [];

    if (decision === 'SWAP' && haikuResult) {
      const validation = validateTradeDecision(haikuResult, battle);
      if (!validation.valid) {
        validationErrors = validation.errors;
        decision = 'HOLD';
        downgraded = true;
        console.warn(`${LOG_PREFIX} SWAP downgraded to HOLD for battle ${battle.id}:`, validation.errors);
      } else {
        // Execute the swap
        try {
          const benchAsset = findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn);
          await executeSwapServer(
            db, battle.id, battle,
            validation.resolvedTier, validation.resolvedSlotIndex,
            benchAsset, currentDay, prices
          );
          summary.swapped++;
        } catch (swapErr) {
          console.error(`${LOG_PREFIX} Swap execution failed for battle ${battle.id}:`, swapErr.message);
          validationErrors.push(`Swap execution failed: ${swapErr.message}`);
          decision = 'HOLD';
          downgraded = true;
        }
      }
    }

    if (decision === 'HOLD') {
      summary.held++;
    }

    // ---- Build evaluation record ----
    const evaluation = {
      evalId,
      timestamp: now,
      day: currentDay,
      battlePhase: phase,
      decision,
      symbolOut: decision === 'SWAP' ? haikuResult?.symbolOut : null,
      symbolIn: decision === 'SWAP' ? haikuResult?.symbolIn : null,
      tier: decision === 'SWAP' ? validateTradeDecision(haikuResult, battle).resolvedTier : null,
      rationale: haikuResult?.rationale || (haikuResult ? null : 'Haiku call failed — defaulting to HOLD'),
      hypothesis: haikuResult?.hypothesis || null,
      conviction: haikuResult?.conviction || 0,
      riskAssessment: haikuResult?.riskAssessment || 'low',
      ignoredDirectiveIds: haikuResult?.ignoredDirectiveIds || [],
      triggers: triggers.map(t => t.type),
      scores: {
        active: Math.round(activeScore * 100) / 100,
        banked: Math.round(bankedScore * 100) / 100,
        total: Math.round(currentScore * 100) / 100,
      },
      validationErrors,
      downgraded,
    };

    // ---- Write everything ----
    const evaluations = [...(battle.evaluations || []), evaluation];
    const consecutiveHolds = decision === 'HOLD'
      ? (battle.cronState?.consecutiveHolds || 0) + 1
      : 0;

    const finalUpdate = {
      ...scoreUpdate,
      evaluations,
      'scoreState.evaluationCount': evaluations.length,
      'scoreState.holdCount': decision === 'HOLD'
        ? (battle.scoreState?.holdCount || 0) + 1
        : (battle.scoreState?.holdCount || 0),
      'cronState.lastEvaluatedAt': now,
      'cronState.lastTriggeredAt': now,
      'cronState.totalHaikuCalls': (battle.cronState?.totalHaikuCalls || 0) + 1,
      'cronState.totalTokens.input': (battle.cronState?.totalTokens?.input || 0) + inputTokens,
      'cronState.totalTokens.output': (battle.cronState?.totalTokens?.output || 0) + outputTokens,
      'cronState.consecutiveHolds': consecutiveHolds,
      'cronState.evaluatingAt': null,
    };

    await battleRef.update(finalUpdate);
    summary.evaluated++;
  } catch (err) {
    // Clear lock on any error
    await battleRef.update({ 'cronState.evaluatingAt': null }).catch(() => {});
    throw err;
  }
}

// ==================== HELPERS ====================

function findBenchAsset(bench, symbol) {
  if (!bench || !symbol) return null;
  const stockMatch = (bench.stocks || []).find(s => s?.symbol === symbol);
  if (stockMatch) return stockMatch;
  if (bench.crypto?.symbol === symbol) return bench.crypto;
  return null;
}
