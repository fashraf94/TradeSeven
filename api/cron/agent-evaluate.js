// api/cron/agent-evaluate.js
// Mid-battle evaluation cron for AI trading agents.
// Runs every 15 minutes during market hours (weekdays).
// Queries agentBattles collection, computes scores, optionally calls Haiku for trade decisions.
//
// Schedule: */15 13,14,15,16,17,18,19,20,21 * * 1-5

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isMarketOpen } from '../_utils/marketSchedule.js';
import { getStockAnalysisData, fetchIntradayBatch } from '../_utils/marketDataCache.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import {
  calculateAssetScoreServer,
  flattenPortfolioServer,
  flattenBenchServer,
} from '../_utils/agentScoring.js';
import { calculateVWAP } from '../_utils/technicalCalculations.js';
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
import { classifyStockRegime, classifyMarketPosture, getPresetAdjustedStrategies } from '../_utils/agentRegimeClassifier.js';
import { evaluateRisk, calculate5minSMA20, pickEmergencyReplacement, findPortfolioSlot } from '../_utils/agentRiskManager.js';
import { getPresetConfig } from '../_utils/agentPresetConfig.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[AgentEval]';
const EVALUATING_LOCK_TIMEOUT_MS = 120_000; // 2 minutes
const TIME_BUDGET_MS = 50_000; // 50 seconds — leave 10s buffer for cleanup/response

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

    // ---- 4. Process each battle sequentially (with time budget) ----
    for (const battle of battles) {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIME_BUDGET_MS) {
        const remaining = battles.length - summary.evaluated - summary.errors;
        console.log(`${LOG_PREFIX} Time budget exceeded (${elapsed}ms). ${remaining} agent(s) deferred to next tick.`);
        summary.skipped += remaining;
        break;
      }

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

  // ---- Idempotency: atomically check and acquire evaluatingAt lock ----
  const lockAcquired = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(battleRef);
    const data = doc.data();
    const currentLock = data?.cronState?.evaluatingAt;

    if (currentLock) {
      const lockAge = Date.now() - new Date(currentLock).getTime();
      if (lockAge < EVALUATING_LOCK_TIMEOUT_MS) {
        return false; // Lock held by another process
      }
    }

    // Atomically claim the lock
    transaction.update(battleRef, {
      'cronState.evaluatingAt': new Date().toISOString(),
    });
    return true;
  });

  if (!lockAcquired) {
    console.log(`${LOG_PREFIX} Battle ${battle.id} already being evaluated — skipping`);
    summary.skipped++;
    return;
  }

  try {
    // Migration guard for pre-Sprint 2/3/4 battles
    const migrationFields = {};
    if (battle.executionMode === undefined) migrationFields.executionMode = 'copilot';
    if (battle.pendingProposal === undefined) migrationFields.pendingProposal = null;
    if (battle.proposalHistory === undefined) migrationFields.proposalHistory = [];
    if (battle.battleLedger === undefined) migrationFields.battleLedger = [];
    if (battle.statusFeed === undefined) migrationFields.statusFeed = [];
    if (battle.strategyPreset === undefined) migrationFields.strategyPreset = 'balanced';
    if (battle.gameplanMeeting === undefined) migrationFields.gameplanMeeting = null;
    if (battle.gameplanMeetingHistory === undefined) migrationFields.gameplanMeetingHistory = [];
    if (battle.chatExchanges === undefined) migrationFields.chatExchanges = [];
    if (battle.chatBudgetUsed === undefined) migrationFields.chatBudgetUsed = 0;

    if (Object.keys(migrationFields).length > 0) {
      console.log(`${LOG_PREFIX} Migrating battle ${battle.id}: adding ${Object.keys(migrationFields).join(', ')}`);
      await battleRef.update(migrationFields);
      Object.assign(battle, migrationFields);
    }

    const ctx = battle.agentContext || {};
    const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);

    // ---- Strategy preset config (Sprint 4) ----
    const presetConfig = getPresetConfig(battle.strategyPreset || 'balanced');

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

    // ---- Parallel data fetch: intraday + rankings + technicalScores + marketContext ----
    const momentumData = { vwap: {}, rankings: {} };
    const technicalScoresMap = {};
    let marketContext = null;
    let spyData = null;

    const allTechSymbols = [...new Set([...portfolioSymbols, ...benchSymbols])];
    const techRefs = allTechSymbols.map(s => db.collection('stockTechnicalScores').doc(s));

    const [intradayResult, rankingsResult, techScoresResult, intelligenceResult] = await Promise.allSettled([
      fetchIntradayBatch(portfolioSymbols, { interval: '5m' }),
      db.collection('indexIntelligence').doc('stockRankings').get(),
      techRefs.length > 0 ? db.getAll(...techRefs) : Promise.resolve([]),
      db.getAll(
        db.collection('indexIntelligence').doc('marketContext'),
        db.collection('indexIntelligence').doc('SPY')
      ),
    ]);

    // Process intraday candles → VWAP + 5min SMA20
    if (intradayResult.status === 'fulfilled') {
      const intradayMap = intradayResult.value;
      for (const symbol of portfolioSymbols) {
        const candles = intradayMap[symbol];
        if (candles && candles.length > 0) {
          const vwapResult = calculateVWAP(candles);
          if (vwapResult) {
            const sma20_5m = calculate5minSMA20(candles);
            momentumData.vwap[symbol] = { ...vwapResult, sma20_5m };
          }
        }
      }
    } else {
      console.warn(`${LOG_PREFIX} Intraday fetch failed:`, intradayResult.reason?.message);
    }

    // Process stockRankings → bandwidth/NR7
    if (rankingsResult.status === 'fulfilled' && rankingsResult.value.exists) {
      const stocksArray = rankingsResult.value.data()?.stocks || [];
      for (const stock of stocksArray) {
        if (portfolioSymbols.includes(stock.symbol) || benchSymbols.includes(stock.symbol)) {
          momentumData.rankings[stock.symbol] = {
            bBandwidthPercentile: stock.bBandwidthPercentile ?? null,
            nr7Flag: stock.nr7Flag ?? false,
            dailyRange: stock.dailyRange ?? null,
          };
        }
      }
    }

    // Process stockTechnicalScores → regime classification input
    if (techScoresResult.status === 'fulfilled') {
      for (const doc of techScoresResult.value) {
        if (doc.exists) technicalScoresMap[doc.id] = doc.data();
      }
    }

    // Process marketContext + SPY index docs
    if (intelligenceResult.status === 'fulfilled') {
      const [mcDoc, spyDoc] = intelligenceResult.value;
      if (mcDoc.exists) marketContext = mcDoc.data();
      if (spyDoc.exists) spyData = spyDoc.data();
    }

    // ---- Regime classification ----
    const marketPosture = (marketContext && spyData)
      ? classifyMarketPosture(marketContext, spyData)
      : 'selective';

    const stockRegimes = {};
    for (const symbol of allTechSymbols) {
      const techScore = technicalScoresMap[symbol];
      if (techScore) stockRegimes[symbol] = classifyStockRegime(techScore);
    }

    momentumData.regimes = stockRegimes;
    momentumData.marketPosture = marketPosture;

    // ---- Risk evaluation layer (runs BEFORE trigger gate) ----
    const riskStatus = {};
    const riskSwaps = [];
    const lockedPositions = new Set();
    const statusFeedEntries = [];
    const vwapTicks = { ...(battle.cronState?.vwapTicks || {}) };

    for (const score of assetScores) {
      const asset = flatPortfolio.find(a => a.symbol === score.symbol);
      const currentPrice = prices[score.symbol]?.current;
      const entryPrice = asset?.swapPrice || startingPrices[score.symbol] || 0;
      const vwapInfo = momentumData.vwap[score.symbol] || null;

      // Update VWAP tick counter
      if (vwapInfo && vwapInfo.vwapDeviation < 0) {
        vwapTicks[score.symbol] = (vwapTicks[score.symbol] || 0) + 1;
      } else {
        vwapTicks[score.symbol] = 0;
      }

      const intradaySnapshot = vwapInfo ? {
        vwap: vwapInfo.vwap,
        vwapDeviation: vwapInfo.vwapDeviation,
        sma20_5m: vwapInfo.sma20_5m || null,
      } : null;

      const riskResult = evaluateRisk(
        { symbol: score.symbol, tier: asset?.tier, baseATR: score.baseATR },
        currentPrice, entryPrice, score.baseATR,
        intradaySnapshot,
        { ticksBelowVwap: vwapTicks[score.symbol] },
        presetConfig.risk
      );

      riskStatus[score.symbol] = riskResult;

      if (['EMERGENCY_SWAP', 'SWAP_OUT', 'TRAIL_STOP'].includes(riskResult.action)) {
        riskSwaps.push({ score, asset, riskResult });
      }
      if (riskResult.action === 'LOCK') {
        lockedPositions.add(score.symbol);
      }
    }

    momentumData.riskStatus = riskStatus;

    // ---- Execute risk-triggered swaps (no Haiku needed) ----
    for (const { score, asset, riskResult } of riskSwaps) {
      const allBench = flattenBenchServer(battle.portfolio?.bench);
      const replacement = pickEmergencyReplacement(allBench, prices, asset?.isCrypto === true);

      if (!replacement) {
        console.warn(`${LOG_PREFIX} No bench replacement for risk swap of ${score.symbol} — skipping`);
        continue;
      }

      const slot = findPortfolioSlot(battle.portfolio, score.symbol);
      if (!slot) {
        console.warn(`${LOG_PREFIX} Could not find portfolio slot for ${score.symbol}`);
        continue;
      }

      try {
        const riskTradeId = `trade_${String((battle.scoreState?.tradeCount || 0) + 1 + statusFeedEntries.filter(e => e.action !== 'hold').length).padStart(3, '0')}`;
        const evaluationMetadata = {
          id: riskTradeId,
          action: 'SWAP',
          trigger: riskResult.reason,
          rationale: `Risk manager: ${riskResult.detail}`,
          hypothesis: null,
          evaluationId: `risk_${riskResult.reason}_${score.symbol}`,
          tradingDay: currentDay,
        };

        await executeSwapServer(
          db, battle.id, battle,
          slot.tier, slot.slotIndex,
          replacement, currentDay, prices, evaluationMetadata
        );

        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Risk: ${riskResult.detail}`,
          pvpContext: null,
          action: riskResult.action.toLowerCase(),
          regime: stockRegimes[score.symbol] || null,
          score: Math.round(currentScore * 100) / 100,
          citedRules: [riskResult.reason],
          triggeredBy: `risk_${riskResult.reason}`,
          source: 'risk_manager',
          evalId: null,
          symbolOut: score.symbol,
          symbolIn: replacement.symbol,
        });

        summary.swapped++;

        // Re-read battle doc after swap for accurate state in subsequent processing
        const updatedDoc = await battleRef.get();
        Object.assign(battle, updatedDoc.data());
      } catch (err) {
        console.error(`${LOG_PREFIX} Risk swap failed for ${score.symbol}:`, err.message);
      }
    }

    // ---- Proposal lifecycle check (after risk evaluation, before triggers/Haiku) ----
    const proposalHandled = await handlePendingProposal(db, battleRef, battle, prices, statusFeedEntries, summary);
    if (proposalHandled === 'skip_haiku') {
      // Proposal is pending and not expired — write scores/risk but skip trigger gate + Haiku
      scoreUpdate['cronState.lastEvaluatedAt'] = new Date().toISOString();
      scoreUpdate['cronState.evaluatingAt'] = null;
      scoreUpdate['cronState.vwapTicks'] = vwapTicks;
      const existingFeed = battle.statusFeed || [];
      scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-50);
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Gameplan meeting lifecycle check (after proposals, before triggers) ----
    const gameplanHandled = await handleGameplanMeeting(db, battleRef, battle, prices, statusFeedEntries, summary);
    if (gameplanHandled === 'skip_haiku') {
      scoreUpdate['cronState.lastEvaluatedAt'] = new Date().toISOString();
      scoreUpdate['cronState.evaluatingAt'] = null;
      scoreUpdate['cronState.vwapTicks'] = vwapTicks;
      const existingFeed = battle.statusFeed || [];
      scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-50);
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Gameplan meeting trigger detection (only if no meeting pending) ----
    if (!battle.gameplanMeeting) {
      const gameplanTrigger = detectGameplanMeetingTrigger(battle, assetScores, prices, flatPortfolio, benchAssets, technicalScoresMap);
      if (gameplanTrigger) {
        const todayET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Gameplan Meeting: ${gameplanTrigger.diagnosis} Proposing rotation to ${gameplanTrigger.toSectors.join('/')}.`,
          action: 'gameplan_meeting', source: 'gameplan_meeting',
        });
        scoreUpdate.gameplanMeeting = gameplanTrigger;
        scoreUpdate['cronState.lastGameplanDate'] = todayET;
        // Write and skip Haiku — gameplan IS the evaluation
        scoreUpdate['cronState.lastEvaluatedAt'] = new Date().toISOString();
        scoreUpdate['cronState.evaluatingAt'] = null;
        scoreUpdate['cronState.vwapTicks'] = vwapTicks;
        const existingFeed = battle.statusFeed || [];
        scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-50);
        await battleRef.update(scoreUpdate);
        summary.evaluated++;
        return;
      }
    }

    // ---- Fetch news for trigger gate ----
    const news = await fetchRecentNews(db, portfolioSymbols);

    // ---- Evaluate triggers ----
    const { shouldEvaluate, triggers } = evaluateTriggers(battle, assetScores, prices, news, momentumData);

    if (!shouldEvaluate) {
      // No triggers — update scores, VWAP ticks, and status feed, then move on
      scoreUpdate['cronState.lastEvaluatedAt'] = new Date().toISOString();
      scoreUpdate['cronState.triggerGatePassCount'] = (battle.cronState?.triggerGatePassCount || 0) + 1;
      scoreUpdate['cronState.evaluatingAt'] = null;
      scoreUpdate['cronState.vwapTicks'] = vwapTicks;
      if (statusFeedEntries.length > 0) {
        const existingFeed = battle.statusFeed || [];
        scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-50);
      }
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
          max_tokens: 1024,
          temperature: 0.4,
          system: buildEvalSystemPrompt(agentName, archetype),
          messages: [
            { role: 'user', content: buildAgentIdentityBlock(battle) },
            { role: 'assistant', content: 'I understand my identity and strategic context. Show me the live battle state.' },
            {
              role: 'user',
              content: buildLiveContextBlock(
                battle, prices, macroPrices, assetScores,
                triggers, news, battle.evaluations, momentumData, presetConfig
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

    // Block Haiku from swapping out LOCKED positions
    if (decision === 'SWAP' && haikuResult && lockedPositions.has(haikuResult.symbolOut)) {
      validationErrors.push(`${haikuResult.symbolOut} is LOCKED (near bonus threshold) — swap blocked`);
      decision = 'HOLD';
      downgraded = true;
      console.warn(`${LOG_PREFIX} SWAP blocked by risk LOCK for ${haikuResult.symbolOut}`);
    }

    // Block Haiku from swapping IN distressed stocks
    if (decision === 'SWAP' && haikuResult && stockRegimes[haikuResult.symbolIn] === 'distressed') {
      validationErrors.push(`${haikuResult.symbolIn} is DISTRESSED regime — swap blocked`);
      decision = 'HOLD';
      downgraded = true;
      console.warn(`${LOG_PREFIX} SWAP blocked: ${haikuResult.symbolIn} is distressed`);
    }

    let pendingProposalUpdate = null;

    if (decision === 'SWAP' && haikuResult) {
      const validation = validateTradeDecision(haikuResult, battle);
      if (!validation.valid) {
        validationErrors = [...validationErrors, ...validation.errors];
        decision = 'HOLD';
        downgraded = true;
        console.warn(`${LOG_PREFIX} SWAP downgraded to HOLD for battle ${battle.id}:`, validation.errors);
      } else {
        const mode = battle.executionMode || 'copilot';

        if (mode === 'autopilot') {
          // Autopilot: execute immediately (original behavior)
          try {
            const benchAsset = findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn);
            const evaluationMetadata = {
              id: `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`,
              action: 'SWAP',
              trigger: triggers.map(t => t.type).join(', '),
              rationale: haikuResult.rationale || null,
              hypothesis: haikuResult.hypothesis || null,
              evaluationId: evalId,
              tradingDay: currentDay,
            };
            await executeSwapServer(
              db, battle.id, battle,
              validation.resolvedTier, validation.resolvedSlotIndex,
              benchAsset, currentDay, prices, evaluationMetadata
            );
            summary.swapped++;
          } catch (swapErr) {
            console.error(`${LOG_PREFIX} Swap execution failed for battle ${battle.id}:`, swapErr.message);
            validationErrors.push(`Swap execution failed: ${swapErr.message}`);
            decision = 'HOLD';
            downgraded = true;
          }
        } else {
          // Co-Pilot or Manual: write proposal instead of executing
          const ttlMinutes = mode === 'copilot' ? 10 : 15;
          const proposalId = `prop_${String((battle.proposalHistory || []).length + 1).padStart(3, '0')}`;

          pendingProposalUpdate = {
            proposalId,
            evalId,
            symbolOut: haikuResult.symbolOut,
            symbolIn: haikuResult.symbolIn,
            tier: validation.resolvedTier,
            slotIndex: validation.resolvedSlotIndex,
            conviction: haikuResult.conviction || 0,
            rationale: haikuResult.rationale || null,
            hypothesis: haikuResult.hypothesis || null,
            riskAssessment: haikuResult.riskAssessment || 'low',
            triggers: triggers.map(t => t.type),
            regime: stockRegimes[haikuResult.symbolOut] || null,
            marketPosture,
            scoreAtProposal: Math.round(currentScore * 100) / 100,
            createdAt: now,
            expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
            mode,
            resolvedAt: null,
            resolution: null,
            resolvedBy: null,
            benchAsset: findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn),
            evaluationMetadata: {
              id: `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`,
              action: 'SWAP',
              trigger: triggers.map(t => t.type).join(', '),
              rationale: haikuResult.rationale || null,
              hypothesis: haikuResult.hypothesis || null,
              evaluationId: evalId,
              tradingDay: currentDay,
            },
          };

          decision = 'PROPOSAL';
          console.log(`${LOG_PREFIX} ${mode} mode: Created proposal ${proposalId} for ${haikuResult.symbolOut}→${haikuResult.symbolIn} (${ttlMinutes}min TTL)`);
        }
      }
    }

    if (decision === 'HOLD') {
      summary.held++;
    } else if (decision === 'PROPOSAL') {
      summary.held++; // Not swapped yet — count as held
    }

    // ---- Build status feed entry from Haiku result ----
    if (decision === 'PROPOSAL' && pendingProposalUpdate) {
      const mode = battle.executionMode || 'copilot';
      const ttl = mode === 'copilot' ? '10' : '15';
      statusFeedEntries.push({
        timestamp: now,
        message: haikuResult?.status_feed_update || `Proposing: Swap ${haikuResult.symbolOut} → ${haikuResult.symbolIn}. Awaiting Coach approval (${ttl}min).`,
        pvpContext: haikuResult?.pvp_context || null,
        action: 'proposal',
        regime: stockRegimes[haikuResult?.symbolOut] || null,
        score: Math.round(currentScore * 100) / 100,
        citedRules: haikuResult?.cited_rules || [],
        triggeredBy: triggers.map(t => t.type).join(', '),
        source: 'haiku',
        evalId,
        symbolOut: haikuResult?.symbolOut,
        symbolIn: haikuResult?.symbolIn,
      });
    } else if (haikuResult?.status_feed_update || decision === 'SWAP') {
      statusFeedEntries.push({
        timestamp: now,
        message: haikuResult?.status_feed_update || null,
        pvpContext: haikuResult?.pvp_context || null,
        action: decision === 'SWAP' ? 'swap' : 'hold',
        regime: stockRegimes[haikuResult?.symbolOut] || null,
        score: Math.round(currentScore * 100) / 100,
        citedRules: haikuResult?.cited_rules || [],
        triggeredBy: triggers.map(t => t.type).join(', '),
        source: 'haiku',
        evalId,
        symbolOut: decision === 'SWAP' ? haikuResult?.symbolOut : null,
        symbolIn: decision === 'SWAP' ? haikuResult?.symbolIn : null,
      });
    }

    // ---- Build evaluation record ----
    const isSwapOrProposal = decision === 'SWAP' || decision === 'PROPOSAL';
    const evaluation = {
      evalId,
      timestamp: now,
      day: currentDay,
      battlePhase: phase,
      decision,
      symbolOut: isSwapOrProposal ? haikuResult?.symbolOut : null,
      symbolIn: isSwapOrProposal ? haikuResult?.symbolIn : null,
      tier: isSwapOrProposal ? validateTradeDecision(haikuResult, battle).resolvedTier : null,
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
      marketPosture,
    };

    // ---- Write everything ----
    const evaluations = [...(battle.evaluations || []), evaluation].slice(-150);
    const consecutiveHolds = decision === 'HOLD'
      ? (battle.cronState?.consecutiveHolds || 0) + 1
      : 0;

    // Cap statusFeed at 50 entries
    const existingFeed = battle.statusFeed || [];
    const updatedFeed = [...existingFeed, ...statusFeedEntries].slice(-50);

    const finalUpdate = {
      ...scoreUpdate,
      evaluations,
      statusFeed: updatedFeed,
      'scoreState.evaluationCount': evaluations.length,
      'scoreState.holdCount': (decision === 'HOLD' || decision === 'PROPOSAL')
        ? (battle.scoreState?.holdCount || 0) + 1
        : (battle.scoreState?.holdCount || 0),
      'cronState.lastEvaluatedAt': now,
      'cronState.lastTriggeredAt': now,
      'cronState.totalHaikuCalls': (battle.cronState?.totalHaikuCalls || 0) + 1,
      'cronState.totalTokens.input': (battle.cronState?.totalTokens?.input || 0) + inputTokens,
      'cronState.totalTokens.output': (battle.cronState?.totalTokens?.output || 0) + outputTokens,
      'cronState.consecutiveHolds': consecutiveHolds,
      'cronState.vwapTicks': vwapTicks,
      'cronState.evaluatingAt': null,
    };

    // Write pending proposal if mode branching created one
    if (pendingProposalUpdate) {
      finalUpdate.pendingProposal = pendingProposalUpdate;
    }

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

/**
 * Fetch fresh prices for a pending proposal's symbols.
 */
async function fetchPricesForProposal(proposal) {
  const symbols = [proposal.symbolOut, proposal.symbolIn].filter(Boolean);
  const prices = {};
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] });
      if (data?.price) prices[symbol] = data.price;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Price fetch for proposal symbol ${symbol} failed:`, err.message);
    }
  }));
  return prices;
}

/**
 * Handle pending proposal lifecycle: expiry, approved, vetoed.
 * Runs AFTER risk evaluation, BEFORE trigger gate/Haiku.
 * Returns 'skip_haiku' if a pending proposal is still active, 'continue' otherwise.
 */
async function handlePendingProposal(db, battleRef, battle, prices, statusFeedEntries, summary) {
  const proposal = battle.pendingProposal;
  if (!proposal) return 'continue';

  // Already resolved by client — execute or clear
  if (proposal.resolvedAt && proposal.resolution) {
    if (proposal.resolution === 'approved') {
      // Execute the approved swap
      try {
        const freshPrices = await fetchPricesForProposal(proposal);
        // Verify bench asset still exists
        const benchAsset = findBenchAsset(battle.portfolio?.bench, proposal.symbolIn);
        if (!benchAsset) {
          console.warn(`${LOG_PREFIX} Bench asset ${proposal.symbolIn} no longer available — lapsing approved proposal`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Approved swap ${proposal.symbolOut} → ${proposal.symbolIn} could not execute — bench asset no longer available.`,
            action: 'hold', source: 'proposal_system',
            symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
          });
        } else {
          await executeSwapServer(
            db, battle.id, battle,
            proposal.tier, proposal.slotIndex,
            benchAsset, proposal.evaluationMetadata?.tradingDay || 1,
            freshPrices, proposal.evaluationMetadata || {}
          );
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Coach approved: Swap ${proposal.symbolOut} → ${proposal.symbolIn}`,
            action: 'swap', source: 'proposal_system',
            symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
          });
          summary.swapped++;
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Approved proposal execution failed:`, err.message);
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Approved swap failed: ${err.message}`,
          action: 'hold', source: 'proposal_system',
        });
      }
      // Move to history and clear (cap at 50)
      const history = [...(battle.proposalHistory || []), proposal].slice(-50);
      await battleRef.update({ pendingProposal: null, proposalHistory: history });
      const updatedDoc = await battleRef.get();
      Object.assign(battle, updatedDoc.data());
      return 'continue';
    }

    if (proposal.resolution === 'vetoed') {
      statusFeedEntries.push({
        timestamp: new Date().toISOString(),
        message: `Coach vetoed: Swap ${proposal.symbolOut} → ${proposal.symbolIn}${proposal.userReason ? ` (${proposal.userReason})` : ''}`,
        action: 'hold', source: 'proposal_system',
        symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
      });
      // Enrich with veto-time prices for counterfactual tracking
      const vetoEnriched = {
        ...proposal,
        vetoedAtPrice: {
          [proposal.symbolIn]: prices[proposal.symbolIn]?.current || null,
          [proposal.symbolOut]: prices[proposal.symbolOut]?.current || null,
        },
        vetoedAtTimestamp: new Date().toISOString(),
      };
      const history = [...(battle.proposalHistory || []), vetoEnriched].slice(-50);
      await battleRef.update({ pendingProposal: null, proposalHistory: history });
      const updatedDoc = await battleRef.get();
      Object.assign(battle, updatedDoc.data());
      summary.held++;
      return 'continue';
    }
  }

  // Not resolved — check expiry
  const now = Date.now();
  const expiresAt = new Date(proposal.expiresAt).getTime();

  if (now < expiresAt) {
    // Still pending and not expired — skip trigger gate + Haiku (risk already ran)
    console.log(`${LOG_PREFIX} Battle ${battle.id} has pending proposal (${proposal.proposalId}) — skipping Haiku`);
    return 'skip_haiku';
  }

  // Expired — handle based on mode
  if (proposal.mode === 'copilot') {
    // Auto-execute on expiry
    try {
      const freshPrices = await fetchPricesForProposal(proposal);
      const benchAsset = findBenchAsset(battle.portfolio?.bench, proposal.symbolIn);
      if (!benchAsset) {
        console.warn(`${LOG_PREFIX} Bench asset ${proposal.symbolIn} gone — lapsing expired copilot proposal`);
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Proposal expired but ${proposal.symbolIn} no longer on bench. Lapsed.`,
          action: 'hold', source: 'proposal_system',
        });
      } else {
        await executeSwapServer(
          db, battle.id, battle,
          proposal.tier, proposal.slotIndex,
          benchAsset, proposal.evaluationMetadata?.tradingDay || 1,
          freshPrices, proposal.evaluationMetadata || {}
        );
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Auto-executed: Swap ${proposal.symbolOut} → ${proposal.symbolIn} (proposal expired, Co-Pilot mode)`,
          action: 'swap', source: 'proposal_system',
          symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
        });
        summary.swapped++;
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Expired copilot proposal execution failed:`, err.message);
    }
  } else {
    // Manual mode — lapse without executing
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: `Proposal lapsed: Swap ${proposal.symbolOut} → ${proposal.symbolIn} (no Coach action within 15min, Manual mode)`,
      action: 'hold', source: 'proposal_system',
      symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
    });
    summary.held++;
  }

  // Move expired proposal to history and clear
  const resolvedProposal = {
    ...proposal,
    resolvedAt: new Date().toISOString(),
    resolution: proposal.mode === 'copilot' ? 'auto_executed' : 'lapsed',
    resolvedBy: 'system',
  };
  const history = [...(battle.proposalHistory || []), resolvedProposal].slice(-50);
  await battleRef.update({ pendingProposal: null, proposalHistory: history });
  const updatedDoc = await battleRef.get();
  Object.assign(battle, updatedDoc.data());
  return 'continue';
}

// ==================== GAMEPLAN MEETING ====================

/**
 * Handle existing gameplan meeting lifecycle: approved, rejected, expired.
 * Mirrors handlePendingProposal pattern.
 * Returns 'skip_haiku' if a pending meeting blocks evaluation, 'continue' otherwise.
 */
async function handleGameplanMeeting(db, battleRef, battle, prices, statusFeedEntries, summary) {
  const meeting = battle.gameplanMeeting;
  if (!meeting) return 'continue';

  // Already resolved by client
  if (meeting.status === 'approved') {
    // Execute suggested swaps
    for (const swap of (meeting.suggestedSwaps || [])) {
      try {
        const benchAsset = findBenchAsset(battle.portfolio?.bench, swap.symbolIn);
        if (!benchAsset) {
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Gameplan swap ${swap.symbolOut} → ${swap.symbolIn} skipped — bench asset unavailable.`,
            action: 'hold', source: 'gameplan_meeting',
          });
          continue;
        }
        const slot = findPortfolioSlot(battle.portfolio, swap.symbolOut);
        if (!slot) continue;

        const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
        const tradeId = `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`;
        await executeSwapServer(
          db, battle.id, battle,
          slot.tier, slot.slotIndex,
          benchAsset, currentDay, prices,
          { id: tradeId, action: 'SWAP', trigger: 'gameplan_rotation', rationale: swap.rationale, tradingDay: currentDay }
        );
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Gameplan approved: ${swap.symbolOut} → ${swap.symbolIn}`,
          action: 'swap', source: 'gameplan_meeting',
          symbolOut: swap.symbolOut, symbolIn: swap.symbolIn,
        });
        summary.swapped++;
        // Re-read battle after swap
        const updatedDoc = await battleRef.get();
        Object.assign(battle, updatedDoc.data());
      } catch (err) {
        console.error(`${LOG_PREFIX} Gameplan swap failed for ${swap.symbolOut}:`, err.message);
      }
    }
    // Move to history and clear
    const history = [...(battle.gameplanMeetingHistory || []), meeting];
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    const updatedDoc = await battleRef.get();
    Object.assign(battle, updatedDoc.data());
    return 'continue';
  }

  if (meeting.status === 'rejected') {
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: 'Gameplan rejected by Coach. Holding current positions.',
      action: 'hold', source: 'gameplan_meeting',
    });
    const history = [...(battle.gameplanMeetingHistory || []), meeting];
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    const updatedDoc = await battleRef.get();
    Object.assign(battle, updatedDoc.data());
    return 'continue';
  }

  // Still pending — check expiry
  const now = Date.now();
  const expiresAt = new Date(meeting.expiresAt).getTime();

  if (now >= expiresAt) {
    // Expired
    const expired = { ...meeting, status: 'expired', resolvedAt: new Date().toISOString(), resolvedBy: 'system' };
    const history = [...(battle.gameplanMeetingHistory || []), expired];
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: 'Gameplan meeting expired. Continuing with current strategy.',
      action: 'hold', source: 'gameplan_meeting',
    });
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    const updatedDoc = await battleRef.get();
    Object.assign(battle, updatedDoc.data());
    return 'continue';
  }

  // Pending and not expired — skip trigger gate (like proposal pending), but risk still ran
  console.log(`${LOG_PREFIX} Battle ${battle.id} has pending gameplan meeting — skipping Haiku`);
  return 'skip_haiku';
}

/**
 * Detect whether a gameplan meeting should be triggered.
 * Triggers on:
 * 1. 3+ consecutive losing trades
 * 2. One sector responsible for >60% of total negative P&L
 *
 * Frequency cap: max 1 per trading day.
 */
function detectGameplanMeetingTrigger(battle, assetScores, prices, flatPortfolio, benchAssets, technicalScoresMap) {
  // Frequency cap: 1 per calendar day (ET)
  const todayET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  if (battle.cronState?.lastGameplanDate === todayET) return null;

  const startingPrices = battle.portfolio?.startingPrices || {};
  let triggered = false;
  let diagnosis = '';
  let fromSector = '';

  // --- Trigger 1: 3 consecutive losing trades ---
  const trades = battle.trades || [];
  if (trades.length >= 3) {
    const last3 = trades.slice(-3);
    const allLosing = last3.every(t => {
      const pnl = (t.lockedPoints ?? t.points ?? 0);
      return pnl < 0;
    });
    if (allLosing) {
      triggered = true;
      diagnosis = `3 consecutive losing trades. Last 3 swaps all resulted in negative points.`;
    }
  }

  // --- Trigger 2: Sector drag >60% of total negative P&L ---
  if (!triggered) {
    const sectorPnL = {};
    let totalNegativePnL = 0;

    for (const score of assetScores) {
      const asset = flatPortfolio.find(a => a.symbol === score.symbol);
      if (!asset) continue;
      const sector = asset.sector || 'Unknown';
      const currentPrice = prices[score.symbol]?.current;
      const entryPrice = asset.swapPrice || startingPrices[score.symbol] || 0;
      if (!currentPrice || !entryPrice) continue;

      const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
      if (pnl < 0) {
        sectorPnL[sector] = (sectorPnL[sector] || 0) + pnl;
        totalNegativePnL += pnl;
      }
    }

    if (totalNegativePnL < -1) { // At least -1% aggregate loss to trigger
      for (const [sector, pnl] of Object.entries(sectorPnL)) {
        const share = pnl / totalNegativePnL; // Both negative, so share is positive
        if (share > 0.6) {
          triggered = true;
          fromSector = sector;
          diagnosis = `${sector} sector dragging performance (${Math.abs(pnl).toFixed(1)}% loss, ${(share * 100).toFixed(0)}% of total negative P&L).`;
          break;
        }
      }
    }
  }

  if (!triggered) return null;

  // --- Find opportunity: leading sectors from bench ---
  const benchSectorScores = {};
  for (const benchAsset of benchAssets) {
    const techScore = technicalScoresMap?.[benchAsset.symbol];
    if (!techScore) continue;
    const sector = benchAsset.sector || 'Unknown';
    if (sector === fromSector) continue; // Skip the dragging sector
    if (!benchSectorScores[sector]) benchSectorScores[sector] = [];
    benchSectorScores[sector].push({ symbol: benchAsset.symbol, score: techScore.technicalScore || 0, name: benchAsset.name || benchAsset.symbol });
  }

  // Sort sectors by average technical score
  const rankedSectors = Object.entries(benchSectorScores)
    .map(([sector, stocks]) => ({
      sector,
      avgScore: stocks.reduce((sum, s) => sum + s.score, 0) / stocks.length,
      bestStock: stocks.sort((a, b) => b.score - a.score)[0],
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const toSectors = rankedSectors.slice(0, 2).map(s => s.sector);
  const opportunity = toSectors.length > 0
    ? `${toSectors.join(' and ')} showing strength. Top bench candidates: ${rankedSectors.slice(0, 2).map(s => `${s.bestStock.symbol} (${s.sector}, Score ${s.bestStock.score})`).join(', ')}.`
    : 'Bench stocks available for rotation.';

  // --- Build suggested swaps ---
  const suggestedSwaps = [];
  if (fromSector) {
    // Find worst active positions from dragging sector
    const draggingPositions = assetScores
      .filter(s => {
        const asset = flatPortfolio.find(a => a.symbol === s.symbol);
        return asset?.sector === fromSector;
      })
      .map(s => {
        const asset = flatPortfolio.find(a => a.symbol === s.symbol);
        const currentPrice = prices[s.symbol]?.current;
        const entryPrice = asset?.swapPrice || startingPrices[s.symbol] || 0;
        const pnl = entryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
        return { symbol: s.symbol, pnl };
      })
      .sort((a, b) => a.pnl - b.pnl); // Worst first

    const topBenchCandidates = rankedSectors.slice(0, 2).map(s => s.bestStock);

    for (let i = 0; i < Math.min(draggingPositions.length, topBenchCandidates.length); i++) {
      suggestedSwaps.push({
        symbolOut: draggingPositions[i].symbol,
        symbolIn: topBenchCandidates[i].symbol,
        rationale: `${draggingPositions[i].symbol} down ${draggingPositions[i].pnl.toFixed(1)}%, ${topBenchCandidates[i].symbol} (${rankedSectors[i].sector}) has tech score ${topBenchCandidates[i].score}.`,
      });
    }
  }

  // Build EOD expiry
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const todayDate = new Date(nowET);
  todayDate.setHours(16, 0, 0, 0); // 4:00 PM ET
  const expiresAt = todayDate.toISOString();

  return {
    id: `gpm_${Date.now()}`,
    createdAt: new Date().toISOString(),
    diagnosis,
    opportunity,
    proposedAction: 'rotate_sector',
    fromSector: fromSector || null,
    toSectors,
    suggestedSwaps,
    status: 'pending',
    expiresAt,
    resolvedAt: null,
    resolvedBy: null,
  };
}
