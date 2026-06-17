import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { STRATEGY_TOOL, PORTFOLIO_TOOL } from '../_utils/agentToolSchema.js';
import { CRYPTO_ASSETS, VALID_CRYPTO_SYMBOLS, getCryptoBySymbol } from '../_utils/agentCryptoAssets.js';
import {
  buildStrategySystemPrompt,
  buildStrategyUserPrompt,
  buildPortfolioSystemPrompt,
  buildInstitutionalBlock,
  formatMarketCSV,
  formatStoriesSummary,
} from '../_utils/agentPromptAssembly.js';
import { createAgentBattle } from '../_utils/agentBattleService.js';
import { projectActiveRules } from '../_utils/projectActiveRules.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { validateActivationPrice } from '../_utils/baselineValidation.js';
import { generateCPUOpponent } from '../_utils/cpuOpponentGenerator.js';
import { computeArchetypeRankings, ARCHETYPE_TEMPERATURES } from '../_utils/archetypeScoring.js';
import { logDecision, logFirstMessage } from '../_utils/shadowLogger.js';
import { buildFirstMessagePrompt, getAgentPhase } from '../_utils/voiceLayerPrompt.js';
import { TERM_TOKENS } from '../_utils/termUniverse.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import {
  resolveEquippedWatchlist,
  extractTickerSymbols,
  foldEquippedTickers,
  unionEquippedIntoHotBench,
  buildEquippedSnapshot,
} from '../_utils/watchlistEquip.js';
// P4 mode config (founder ruling D1) — Node-clean src import under the revised
// June 2026 import rule (BUILD_RULES §4); the P4 battery's import of this
// module is the dependency-surface guard.
import { FLAT6_GAME_MODE, resolveModeConfig } from '../../src/constants/agentGameModes.js';

// Vercel Pro timeout — two-call AI chain needs breathing room
export const config = { maxDuration: 60 };

// ── P4 contract #3: deploy auth (Spec §0.3) ─────────────────────────────────

// Tournament intake fields are INTERNAL-ONLY: a client caller presenting any
// of them is refused before authentication (prescribed deploys come from the
// orchestrator with CRON_SECRET, never from browsers).
export const TOURNAMENT_ONLY_FIELDS = Object.freeze([
  'ownerOdUserId',
  'gameMode',
  'groupId',
  'prescribedPortfolio',
  'isCpu',
  'userPicksStance',
  'doubleDownSymbols',
  'userPicks',
]);

/**
 * Internal-caller classification: `Authorization: Bearer CRON_SECRET` (the
 * claims-cron pattern of record). An unset secret can never classify anyone
 * as internal.
 */
export function isInternalDeployCaller(headers, cronSecret = process.env.CRON_SECRET) {
  return Boolean(cronSecret) && headers?.authorization === `Bearer ${cronSecret}`;
}

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  // P4 contract #3: classify the caller BEFORE the middleware so internal
  // orchestrator calls are rate-limit exempt (the 3/min/IP limit would cap
  // the morning fan-out at ~3 deploys/min). Everything else about the
  // middleware is unchanged for client callers.
  const isInternalCaller = isInternalDeployCaller(req.headers);

  // 1. Security + method check
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 3, windowMs: 60000 }, skipRateLimit: isInternalCaller })) {
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
    // P4 contract #3 — deploy auth (Spec §0.3), enforced before any read or
    // state change. Client callers: Firebase ID token + ownership; tournament
    // intake fields refused. Internal callers: CRON_SECRET already verified;
    // ownership asserted against the explicit ownerOdUserId below.
    let clientUser = null;
    if (!isInternalCaller) {
      const offending = TOURNAMENT_ONLY_FIELDS.filter((f) => req.body[f] !== undefined);
      if (offending.length > 0) {
        return res.status(403).json({
          error: 'internal_only_fields',
          message: `Internal-caller credentials required for: ${offending.join(', ')}`,
        });
      }
      clientUser = await requireAuth(req, res);
      if (!clientUser) return; // 401 already sent
    }

    // 2. Idempotency guard — prevent double-deploy
    const agentRef = db.collection('agents').doc(agentId);
    const agentDoc = await agentRef.get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = { id: agentDoc.id, ...agentDoc.data() };

    // P4 contract #3 — the ownership assertion, both caller classes. The
    // orchestrator must never deploy an agent into the wrong seat (this
    // defends against its own bugs, not just outsiders); a client may only
    // deploy their own agent.
    if (isInternalCaller) {
      const { ownerOdUserId } = req.body;
      if (typeof ownerOdUserId !== 'string' || ownerOdUserId.length === 0) {
        return res.status(400).json({ error: 'ownerOdUserId required for internal deploys' });
      }
      if (agent.ownerId !== ownerOdUserId) {
        return res.status(403).json({ error: 'ownership_mismatch', message: 'agent.ownerId does not match ownerOdUserId' });
      }
    } else if (agent.ownerId !== clientUser.uid) {
      return res.status(403).json({ error: 'ownership_mismatch', message: 'You can only deploy your own agent' });
    }

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

    // 2b. Commit the live loadout into activeRules (edit→activate fix).
    // activeRules is re-projected from the CURRENT equipped state at deploy:
    // trait rules (by equippedTraits) + manual/StarterKit rules (by bundle
    // membership), read fresh from the rule docs so trait-strength and equip
    // edits propagate into this battle's snapshot. Prompt assembly
    // (resolveRuleText) re-interpolates textTemplate+paramValues, so current
    // strengths take effect. See api/_utils/projectActiveRules.js.
    // Never blocks deploy — on failure we fall back to the stored activeRules.
    try {
      const [rulesSnap, bundlesSnap] = await Promise.all([
        agentRef.collection('rules').get(),
        agentRef.collection('bundles').get(),
      ]);
      const ruleDocs = rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const bundleDocs = bundlesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const projected = projectActiveRules(agent.equippedTraits, ruleDocs, bundleDocs);
      agent.activeRules = projected; // used by the prompt (:232) + battle snapshot (:119)
      // Persist for Forge-UI consistency, but skip when an active battle exists:
      // that deploy early-returns at the existing-battle check (~:390) without
      // creating a battle, and edits are locked mid-battle, so the write is a
      // redundant no-op. The in-memory value above still feeds the prompt.
      if (!agent.activeBattleId) {
        await agentRef.update({ activeRules: projected });
      }
    } catch (projErr) {
      console.error('[agent/decide] activeRules projection FAILED for agent', agentId,
        '— deploying with stored activeRules (which is empty for a freshly-seeded agent, i.e. an inert loadout):', projErr);
    }

    // === P4: prescribed-portfolio tournament entry (contract #1) ===
    // Deploys never self-select in tournament mode (BUILD_RULES §7): the
    // orchestrator prescribes the six and Sonnet/Haiku are skipped entirely.
    // Any request without the tournament gameMode flows through the legacy
    // path below untouched.
    if (req.body.gameMode === FLAT6_GAME_MODE) {
      return await runPrescribedTournamentDeploy({ db, req, res, agentRef, agent, agentId: agentDoc.id });
    }

    // 3. Fetch stock universe — ONE Firestore read
    const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
    if (!rankingsDoc.exists) {
      await agentRef.update({ deployingAt: null });
      return res.status(503).json({ error: 'Stock rankings not available. Cron may not have run yet.' });
    }
    const stockUniverse = rankingsDoc.data().stocks || [];

    // 3b. Apply archetype-specific scoring and sorting
    const archetype = agent.archetype || 'analyst';
    const rankedStocks = computeArchetypeRankings(stockUniverse, archetype);
    const temps = ARCHETYPE_TEMPERATURES[archetype] || ARCHETYPE_TEMPERATURES.analyst;

    // 3c. [Phase5B1] Read the agent's equipped watchlist, if any. A missing,
    //     soft-deleted, or uncommitted watchlist degrades silently to "no
    //     equip" (Q3 + Q4 locks) — the agent's equippedWatchlistId field is
    //     left untouched so a later re-commit resumes the equip. A read
    //     failure must never break a deploy, so it also degrades.
    let equippedWatchlistData = null;
    let equippedSymbols = [];
    let equippedWatchlistSnapshot = null;
    if (agent.equippedWatchlistId) {
      try {
        const watchlistSnap = await db.collection('watchlists').doc(agent.equippedWatchlistId).get();
        const resolved = resolveEquippedWatchlist(watchlistSnap.exists ? watchlistSnap.data() : null);
        if (resolved) {
          equippedWatchlistData = resolved;
          const rawCount = Array.isArray(resolved.tickers) ? resolved.tickers.length : 0;
          equippedSymbols = extractTickerSymbols(resolved.tickers);
          equippedWatchlistSnapshot = buildEquippedSnapshot(agent.equippedWatchlistId, resolved);
          if (equippedSymbols.length < rawCount) {
            console.warn(`[Phase5B1] Stripped ${rawCount - equippedSymbols.length} invalid tickers from equipped watchlist ${agent.equippedWatchlistId}`);
          }
          console.log(`[Phase5B1] Equipped watchlist ${agent.equippedWatchlistId} read: ${equippedSymbols.length} tickers`);
        } else {
          console.warn(`[Phase5B1] Agent ${agentId} has equippedWatchlistId ${agent.equippedWatchlistId} but the watchlist is missing/deleted/uncommitted — degrading to no equip`);
        }
      } catch (wlErr) {
        console.warn(`[Phase5B1] Equipped watchlist read failed for agent ${agentId}: ${wlErr.message} — degrading to no equip`);
      }
    }

    // 4. Fetch recent FantasyTimes stories.
    // Fetch 10 and post-filter to drop Vera deepdives — Phase 1 keeps
    // Vera out of agent decisioning until Phase 2 wires her in intentionally.
    // Single-line revert when Phase 2 ships (drop the filter, set limit back to 5).
    const storiesSnap = await db
      .collection('fantasyTimesStories')
      .orderBy('publishedAt', 'desc')
      .limit(10)
      .get();
    const stories = storiesSnap.docs
      .map((d) => d.data())
      .filter((s) => s.type !== 'deepdive')
      .slice(0, 5);

    // 5. Build market data
    const marketCSV = formatMarketCSV(rankedStocks);
    const storiesSummary = formatStoriesSummary(stories);

    // 6. SONNET CALL — Strategic Analysis (with Tool Use)
    const strategySystem = buildStrategySystemPrompt(marketCSV, storiesSummary, archetype);
    const strategyUser = buildStrategyUserPrompt(
      agent,
      equippedWatchlistData
        ? {
            name: equippedWatchlistData.name,
            tickers: equippedSymbols,
            thesis: equippedWatchlistData.thesis,
          }
        : null
    );

    const strategyResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: temps.sonnet,
      // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
      // preserve the prior Sonnet-4 (no-thinking) latency profile.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
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
      // Fallback: Sonnet didn't use the tool — use top 35 by archetypeScore
      console.warn('[agent/decide] Sonnet did not use submit_strategy tool. Using fallback shortlist.');
      strategy = {
        brief: 'Automated selection based on archetype fitness scores.',
        shortlist: rankedStocks.slice(0, 35).map((s) => s.symbol),
      };
    }

    // Validate shortlist — ensure all tickers exist in universe
    const validSymbols = new Set(stockUniverse.map((s) => s.symbol));
    // [Phase5B1] Fold equipped tickers into the shortlist. Equipped tickers
    // survive the universe filter even when off-universe (Option 8C);
    // augmentedValidSymbols extends validSymbols so validatePortfolio() below
    // does not reject an off-universe equipped ticker that Haiku picks.
    const fold = foldEquippedTickers({
      shortlist: strategy.shortlist,
      equippedSymbols,
      validSymbols,
    });
    strategy.shortlist = fold.shortlist;
    const augmentedValidSymbols = fold.augmentedValidSymbols;
    if (equippedSymbols.length > 0) {
      console.log(`[Phase5B1] Shortlist fold: ${fold.elevatedTickers.length} elevated (${fold.offUniverseTickers.length} off-universe)`);
    }

    if (strategy.shortlist.length < 15) {
      // Not enough valid tickers — pad with top archetype-scored stocks
      const existing = new Set(strategy.shortlist);
      const padding = rankedStocks
        .filter((s) => !existing.has(s.symbol))
        .slice(0, 35 - strategy.shortlist.length)
        .map((s) => s.symbol);
      strategy.shortlist.push(...padding);
    }

    // Get detailed data for shortlisted stocks only (from rankedStocks to preserve archetypeScore)
    const shortlistSet = new Set(strategy.shortlist);
    const shortlistData = rankedStocks.filter((s) => shortlistSet.has(s.symbol));
    // [Phase5B1] Off-universe equipped tickers have no ranked row — add a
    // synthetic {symbol} so formatMarketCSV emits SYM|Unknown|-|-|-|-|- and
    // Haiku can still see (and pick) them.
    const offUniverseRows = fold.offUniverseTickers
      .filter((t) => shortlistSet.has(t))
      .map((symbol) => ({ symbol }));
    const shortlistCSV = formatMarketCSV([...shortlistData, ...offUniverseRows]);

    // Build crypto list string
    const cryptoListStr = CRYPTO_ASSETS.map(
      (c) => `${c.symbol} (${c.name}, ATR ~${c.baseATR}%)`
    ).join('\n');

    // 7. HAIKU CALL — Portfolio Construction (with Tool Use)
    const instBlock = await buildInstitutionalBlock(agent.activeRules || [], strategy.shortlist);
    const portfolioSystem = buildPortfolioSystemPrompt(
      strategy.brief, shortlistCSV, cryptoListStr, instBlock,
      equippedWatchlistData ? { tickers: equippedSymbols } : null
    );

    const portfolioResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: temps.haiku,
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

    // Normalize crypto fields — Haiku sometimes returns arrays instead of strings
    if (Array.isArray(portfolioResult.support_crypto)) {
      portfolioResult.support_crypto = portfolioResult.support_crypto[0];
    }
    if (Array.isArray(portfolioResult.bench_crypto)) {
      portfolioResult.bench_crypto = portfolioResult.bench_crypto[0];
    }

    // 8. Validate portfolio
    const validation = validatePortfolio(portfolioResult, augmentedValidSymbols);

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
            content: [
              {
                type: 'tool_result',
                tool_use_id: portToolUse.id,
                is_error: true,
                content: `Validation failed: ${validation.errors.join(', ')}. Fix these issues.`,
              },
              {
                type: 'text',
                text: 'Please fix the errors and resubmit using the submit_portfolio tool.',
              },
            ],
          },
        ],
        tools: [PORTFOLIO_TOOL],
        tool_choice: { type: 'tool', name: 'submit_portfolio' },
      });

      const retryToolUse = retryResponse.content.find((c) => c.type === 'tool_use');
      if (retryToolUse) {
        const retryValidation = validatePortfolio(retryToolUse.input, augmentedValidSymbols);
        if (retryValidation.valid) {
          portfolioResult = retryToolUse.input;
          // Normalize crypto fields on retry result too
          if (Array.isArray(portfolioResult.support_crypto)) {
            portfolioResult.support_crypto = portfolioResult.support_crypto[0];
          }
          if (Array.isArray(portfolioResult.bench_crypto)) {
            portfolioResult.bench_crypto = portfolioResult.bench_crypto[0];
          }
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

    // 9b. Construct watchlist from Sonnet shortlist + stockRankings
    const portfolioTickers = [
      ...enrichedPortfolio.portfolio.star.map(a => a.symbol),
      ...enrichedPortfolio.portfolio.core.map(a => a.symbol),
      ...enrichedPortfolio.portfolio.support.map(a => a.symbol),
    ].filter(Boolean);
    const benchTickers = enrichedPortfolio.bench.stocks.map(a => a.symbol).filter(Boolean);
    const selectedSet = new Set([...portfolioTickers, ...benchTickers]);

    // HotBench: remaining shortlist tickers not in portfolio or bench (Sonnet conviction order)
    let hotBench = strategy.shortlist
      .filter(t => !selectedSet.has(t))
      .slice(0, 15);
    // [Phase5B1] Union equipped tickers into the hotBench (soft cap 20) so
    // equipped tickers not picked into the portfolio stay available as swap
    // reserves. Equipped tickers always survive the cap.
    hotBench = unionEquippedIntoHotBench({
      hotBench,
      equippedTickers: equippedSymbols,
      rankings: stockUniverse,
      excludeSymbols: selectedSet,
      cap: 20,
    });
    if (equippedSymbols.length > 0) {
      console.log(`[Phase5B1] Initial hotBench after equip union: ${hotBench.length} tickers`);
    }

    // Monitoring: top baggerBombFit stocks not already selected or in hotBench
    const allSelectedSet = new Set([...selectedSet, ...hotBench]);
    const monitoringPicks = stockUniverse
      .filter(s => !allSelectedSet.has(s.symbol))
      .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0))
      .slice(0, 18)
      .map(s => s.symbol);

    const watchlist = {
      active: portfolioTickers,
      hotBench,
      monitoring: monitoringPicks,
      lastRefreshed: new Date().toISOString(),
      totalStocks: portfolioTickers.length + hotBench.length + monitoringPicks.length,
    };

    // 10. Write to Firestore + clear lock
    await agentRef.update({
      lastDecision: {
        portfolio: enrichedPortfolio.portfolio,
        bench: enrichedPortfolio.bench,
        innerMonologue: portfolioResult.innerMonologue,
        strategyBrief: strategy.brief,
        shortlist: strategy.shortlist,
        watchlist,
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
      const existingBattle = activeBattles.docs[0].data();
      const existingBattleId = activeBattles.docs[0].id;

      // Check if the "active" battle has actually expired
      const expiresAt = existingBattle.expiresAt;
      const isExpired = expiresAt && (
        (expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date()
      );

      if (!isExpired) {
        // Truly active battle exists — sync activeBattleId and return
        await agentRef.update({ activeBattleId: existingBattleId });

        // Shadow log — portfolio updated, no new battle
        logDecision({
          agentId: agentDoc.id,
          userId: agent.ownerId || null,
          battleId: existingBattleId,
          battleCreated: false,
          archetype: agent.archetype || null,
          strategyBrief: strategy.brief,
          shortlistSize: strategy.shortlist?.length || 0,
          portfolio: enrichedPortfolio.portfolio,
          bench: enrichedPortfolio.bench,
          innerMonologue: portfolioResult.innerMonologue || null,
          duration: req.body.duration || '1d',
          tokenUsage: {
            strategy: { input: strategyResponse.usage?.input_tokens || null, output: strategyResponse.usage?.output_tokens || null },
            portfolio: { input: portfolioResponse.usage?.input_tokens || null, output: portfolioResponse.usage?.output_tokens || null },
          },
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          portfolioUpdated: true,
          battleCreated: false,
          reason: 'Agent already has an active battle',
          existingBattleId,
          portfolio: enrichedPortfolio.portfolio,
          bench: enrichedPortfolio.bench,
          innerMonologue: portfolioResult.innerMonologue,
          strategyBrief: strategy.brief,
        });
      }

      // Battle has expired — mark it as completed and proceed to create new one
      await db.collection('agentBattles').doc(existingBattleId).update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        completionReason: 'expired',
      });
    }

    // 12. Build sector map from stockUniverse (already in memory)
    const sectorMap = {};
    stockUniverse.forEach(s => { sectorMap[s.symbol] = s.sectorName || 'Unknown'; });
    CRYPTO_ASSETS.forEach(c => { sectorMap[c.symbol] = 'Crypto'; });

    // 13. Generate CPU opponent portfolio (server-side — eliminates fragile client set-opponent call)
    const agentSymbols = new Set([
      ...enrichedPortfolio.portfolio.star.map(a => a?.symbol),
      ...enrichedPortfolio.portfolio.core.map(a => a?.symbol),
      ...enrichedPortfolio.portfolio.support.map(a => a?.symbol),
      ...enrichedPortfolio.bench.stocks.map(a => a?.symbol),
      ...(enrichedPortfolio.bench.crypto ? [enrichedPortfolio.bench.crypto.symbol] : []),
    ].filter(Boolean));

    const cpuOpponent = generateCPUOpponent(stockUniverse, CRYPTO_ASSETS, agentSymbols);

    // Collect ALL symbols (agent + CPU) for price fetching
    const cpuPortfolioAssets = [
      ...(cpuOpponent.portfolio.star || []),
      ...(cpuOpponent.portfolio.core || []),
      ...(cpuOpponent.portfolio.support || []),
    ].filter(Boolean);
    const cpuBenchAssets = [
      ...(cpuOpponent.bench.stocks || []),
      ...(cpuOpponent.bench.crypto ? [cpuOpponent.bench.crypto] : []),
    ].filter(Boolean);
    const cpuSymbols = [...cpuPortfolioAssets, ...cpuBenchAssets].map(a => a.symbol).filter(Boolean);

    // 14. Fetch entry prices for all symbols (rate-limited: 5 concurrent, 200ms between batches)
    const allSymbols = [...agentSymbols, ...cpuSymbols];

    // Asset roster (agent + CPU). Drives the baseATR lookup used by the
    // activation-price guard below, and the threshold build further down.
    const allAssets = [
      ...enrichedPortfolio.portfolio.star,
      ...enrichedPortfolio.portfolio.core,
      ...enrichedPortfolio.portfolio.support,
      ...enrichedPortfolio.bench.stocks,
      ...(enrichedPortfolio.bench.crypto ? [enrichedPortfolio.bench.crypto] : []),
      ...cpuPortfolioAssets,
      ...cpuBenchAssets,
    ].filter(Boolean);
    const baseATRBySymbol = {};
    for (const asset of allAssets) {
      if (asset.symbol && baseATRBySymbol[asset.symbol] == null) {
        baseATRBySymbol[asset.symbol] = asset.baseATR || (asset.isCrypto ? 5.0 : 2.5);
      }
    }

    const startingPrices = await fetchValidatedStartingPrices(allSymbols, baseATRBySymbol);

    // Update CPU portfolio assets with fetched prices
    ['star', 'core', 'support'].forEach(tier => {
      (cpuOpponent.portfolio[tier] || []).forEach(asset => {
        if (asset?.symbol && startingPrices[asset.symbol]) {
          asset.price = startingPrices[asset.symbol];
        }
      });
    });
    (cpuOpponent.bench.stocks || []).forEach(asset => {
      if (asset?.symbol && startingPrices[asset.symbol]) {
        asset.price = startingPrices[asset.symbol];
      }
    });
    if (cpuOpponent.bench.crypto?.symbol && startingPrices[cpuOpponent.bench.crypto.symbol]) {
      cpuOpponent.bench.crypto.price = startingPrices[cpuOpponent.bench.crypto.symbol];
    }

    // 15. Build thresholds from baseATR on ALL assets (agent + CPU).
    // allAssets is constructed above (also feeds the activation-price guard).
    const thresholds = buildThresholds(allAssets);

    // 16. Create agent battle
    const agentData = {
      id: agentDoc.id,
      ...agent,
      lastDecision: {
        portfolio: enrichedPortfolio.portfolio,
        bench: enrichedPortfolio.bench,
        innerMonologue: portfolioResult.innerMonologue,
        strategyBrief: strategy.brief,
        shortlist: strategy.shortlist,
        watchlist,
      },
    };

    const opponent = {
      portfolio: cpuOpponent.portfolio,
      bench: cpuOpponent.bench,
      username: 'CPU Opponent',
      odUserId: 'cpu',
    };

    const battleResult = await createAgentBattle(
      db, agentData, thresholds, startingPrices,
      {
        duration: req.body.duration || '1d',
        sectorMap,
        opponent,
        // [Phase5B1] Frozen snapshot of the equipped watchlist (null when none).
        equippedWatchlist: equippedWatchlistSnapshot,
      }
    );

    // 17. Write activeBattleId back to agent doc
    await agentRef.update({ activeBattleId: battleResult.id });

    // 17b. First-Message-on-Deploy (Phase 1 Voice Layer Rework)
    // Generate Gemma's opening message to the user, persist it to chatExchanges
    // + statusFeed, and log the path for diagnostics. NEVER throws — any failure
    // here leaves the chat empty (legacy behavior) but does not block the deploy.
    // See FANTASYTRADES_VOICE_LAYER_PHASE_1_SPEC §4.7.
    await generateFirstMessageOnDeploy({
      db,
      agentData,
      battleId: battleResult.id,
    });

    // Shadow log — full decision + new battle
    logDecision({
      agentId: agentDoc.id,
      userId: agent.ownerId || null,
      battleId: battleResult.id,
      battleCreated: true,
      archetype: agent.archetype || null,
      strategyBrief: strategy.brief,
      shortlistSize: strategy.shortlist?.length || 0,
      portfolio: enrichedPortfolio.portfolio,
      bench: enrichedPortfolio.bench,
      innerMonologue: portfolioResult.innerMonologue || null,
      duration: req.body.duration || '1d',
      expiresAt: battleResult.expiresAt || null,
      tokenUsage: {
        strategy: { input: strategyResponse.usage?.input_tokens || null, output: strategyResponse.usage?.output_tokens || null },
        portfolio: { input: portfolioResponse.usage?.input_tokens || null, output: portfolioResponse.usage?.output_tokens || null },
      },
    }).catch(() => {});

    // 18. Return to client
    return res.status(200).json({
      success: true,
      portfolioUpdated: true,
      battleCreated: true,
      agentBattleId: battleResult.id,
      expiresAt: battleResult.expiresAt,
      portfolio: enrichedPortfolio.portfolio,
      bench: enrichedPortfolio.bench,
      opponent: cpuOpponent.portfolio,
      opponentBench: cpuOpponent.bench,
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

/**
 * Fetch + Guard-1-validate activation prices for a symbol list.
 * Verbatim move of the handler's step-14 loop (P4 — shared with the
 * prescribed tournament path); rate-limited 5 concurrent / 200ms between
 * batches.
 */
async function fetchValidatedStartingPrices(allSymbols, baseATRBySymbol) {
  const startingPrices = {};
  const PRICE_CONCURRENCY = 5;
  for (let i = 0; i < allSymbols.length; i += PRICE_CONCURRENCY) {
    const batch = allSymbols.slice(i, i + PRICE_CONCURRENCY);
    await Promise.allSettled(batch.map(async (symbol) => {
      try {
        const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
        const p = data?.price;
        if (p?.current) {
          // Guard 1: validate the activation price against an independent
          // reference (today's [low, high] + the most recent daily close)
          // before freezing it as the scoring baseline. Use the UNADJUSTED
          // rawClose so a split/dividend can't skew the raw-vs-raw comparison
          // (same basis as Guard 2). data.daily is read here only — it is
          // never written to the battle doc.
          const recentClose = Array.isArray(data?.daily) && data.daily.length > 0
            ? (data.daily[0].rawClose ?? data.daily[0].close)
            : null;
          const { value, fired, reason } = validateActivationPrice({
            current: p.current,
            high: p.high,
            low: p.low,
            fallback: p.fallback === true,
            recentClose,
            previousClose: p.previousClose,
            baseATR: baseATRBySymbol[symbol] || 2.5,
          });
          if (fired) {
            console.warn(`[guard1] ${symbol} rejected activation current=${p.current} (${reason}); ${value == null ? 'skipped' : `substituted ${value}`}`);
          }
          if (value != null) startingPrices[symbol] = value;
        }
      } catch (err) {
        console.warn(`[agent/decide] Price fetch failed for ${symbol}:`, err.message);
      }
    }));
    if (i + PRICE_CONCURRENCY < allSymbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return startingPrices;
}

/**
 * baseATR → threshold triple per asset. Verbatim move of the handler's
 * step-15 loop (P4 — shared with the prescribed tournament path). Thresholds
 * are tier-independent by construction, so flat6 changes nothing here.
 */
function buildThresholds(allAssets) {
  const thresholds = {};
  for (const asset of allAssets) {
    const baseATR = asset.baseATR || (asset.isCrypto ? 5.0 : 2.5);
    thresholds[asset.symbol] = {
      threshold: baseATR,
      rallyThreshold: baseATR * 1.5,
      moonshotThreshold: baseATR * 2.0,
    };
  }
  return thresholds;
}

export function validatePortfolio(result, validSymbols) {
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

export function buildFallbackPortfolio(shortlistData) {
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

/**
 * Ticker → V3 asset object from the ranked universe. Hoisted from
 * enrichPortfolio's inner closure in P4 so the prescribed tournament path
 * shares it — output photographed unchanged by the battery.
 */
function toAssetFromUniverse(symbol, lookup) {
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
}

export function enrichPortfolio(result, stockUniverse) {
  const lookup = {};
  stockUniverse.forEach((s) => {
    lookup[s.symbol] = s;
  });

  const toAsset = (symbol) => toAssetFromUniverse(symbol, lookup);

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

// ── P4: flat6 prescription validation + enrichment (contract #2) ────────────

/**
 * The tournament sibling of validatePortfolio: exactly modeConfig.portfolioSize
 * unique, universe-known stocks; crypto excluded (tournament mode is
 * stocks-only — V2.1 §7; the mandatory crypto slots are a tiered-mode
 * property).
 */
export function validatePrescribedPortfolio(symbols, validSymbols, modeConfig) {
  const errors = [];
  if (!Array.isArray(symbols)) {
    return { valid: false, errors: ['prescribedPortfolio must be an array of ticker symbols'] };
  }
  if (symbols.length !== modeConfig.portfolioSize) {
    errors.push(`Prescribed portfolio must have exactly ${modeConfig.portfolioSize} stocks`);
  }
  symbols.forEach((s) => {
    if (typeof s !== 'string' || s.length === 0) {
      errors.push(`Invalid symbol entry: ${s}`);
    } else if (VALID_CRYPTO_SYMBOLS.includes(s)) {
      errors.push(`Crypto not allowed in flat6: ${s}`);
    } else if (!validSymbols.has(s)) {
      errors.push(`Unknown stock: ${s}`);
    }
  });
  const unique = new Set(symbols);
  if (Array.isArray(symbols) && unique.size !== symbols.length) {
    errors.push('Duplicate symbols detected');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Prescription → enriched flat6 portfolio. Slot labels follow prescription
 * order (the draft's conviction order): star[0..1], core[2..3],
 * support[4..5] — LABELS ONLY, all 1x (createAgentBattle stamps the flat
 * multiplier per asset from the mode config). Bench starts empty (founder
 * ruling D5: the eval cron's hotBench refresh populates swap candidates,
 * ledger-filtered by P2).
 */
export function enrichPrescribedPortfolio(symbols, stockUniverse) {
  const lookup = {};
  stockUniverse.forEach((s) => { lookup[s.symbol] = s; });
  const assets = symbols.map((symbol) => toAssetFromUniverse(symbol, lookup));
  return {
    portfolio: {
      star: assets.slice(0, 2),
      core: assets.slice(2, 4),
      support: assets.slice(4, 6),
    },
    bench: { stocks: [], crypto: null },
  };
}

// ── P4: prescribed-portfolio tournament deploy (contract #1) ────────────────
//
// The fence entry's tournament path: validate the orchestrator-prescribed six
// against the flat6 mode config, enrich from the ranked universe, and create
// the stamped battle (contracts #2/#4/#5 + rider #6). No model calls, no
// embedded CPU opponent (founder ruling D4), empty bench/hotBench (D5). A bad
// prescription is a LOUD 4xx, never an improvised portfolio — the orchestrator
// retries on its failure cooldown. The deploy lock is already held by the
// caller; every early return clears it.
async function runPrescribedTournamentDeploy({ db, req, res, agentRef, agent, agentId }) {
  const clearLock = () => agentRef.update({ deployingAt: null }).catch(() => {});
  const modeConfig = resolveModeConfig(FLAT6_GAME_MODE);
  const { groupId, prescribedPortfolio, isCpu, userPicksStance, doubleDownSymbols, userPicks } = req.body;

  // Joint-stamp contract (founder ruling B3): no groupId, no battle.
  if (typeof groupId !== 'string' || groupId.length === 0) {
    await clearLock();
    return res.status(400).json({ error: 'groupId required for tournament deploys (joint-stamp contract)' });
  }

  // Universe read — same source as the legacy path.
  const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
  if (!rankingsDoc.exists) {
    await clearLock();
    return res.status(503).json({ error: 'Stock rankings not available. Cron may not have run yet.' });
  }
  const stockUniverse = rankingsDoc.data().stocks || [];
  const validSymbols = new Set(stockUniverse.map((s) => s.symbol));

  const validation = validatePrescribedPortfolio(prescribedPortfolio, validSymbols, modeConfig);
  if (!validation.valid) {
    console.error(`[agent/decide] Prescribed portfolio rejected for agent ${agentId}:`, validation.errors);
    await clearLock();
    return res.status(400).json({ error: 'invalid_prescribed_portfolio', details: validation.errors });
  }

  const enriched = enrichPrescribedPortfolio(prescribedPortfolio, stockUniverse);

  // Persist the decision onto the agent (the legacy lastDecision shape,
  // model-free) and release the deploy lock in the same write.
  const nowIso = new Date().toISOString();
  const lastDecision = {
    portfolio: enriched.portfolio,
    bench: enriched.bench,
    innerMonologue: { strategy: 'Prescribed tournament deployment — the drafted six.' },
    strategyBrief: 'Prescribed tournament deployment',
    shortlist: [...prescribedPortfolio],
    watchlist: {
      active: [...prescribedPortfolio],
      hotBench: [],
      monitoring: [],
      lastRefreshed: nowIso,
      totalStocks: prescribedPortfolio.length,
    },
    createdAt: nowIso,
    models: { strategy: null, portfolio: 'prescribed' },
  };
  await agentRef.update({
    lastDecision,
    lastDeployedAt: nowIso,
    deployingAt: null,
    updatedAt: nowIso,
  });

  // One active battle per agent — the same check + expiry completion as the
  // legacy path (duplicated deliberately so the legacy handler body stays
  // untouched).
  const activeBattles = await db.collection('agentBattles')
    .where('agentId', '==', agentId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!activeBattles.empty) {
    const existingBattle = activeBattles.docs[0].data();
    const existingBattleId = activeBattles.docs[0].id;
    const expiresAt = existingBattle.expiresAt;
    const isExpired = expiresAt && (
      (expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date()
    );
    if (!isExpired) {
      await agentRef.update({ activeBattleId: existingBattleId });
      return res.status(200).json({
        success: true,
        portfolioUpdated: true,
        battleCreated: false,
        reason: 'Agent already has an active battle',
        existingBattleId,
        portfolio: enriched.portfolio,
        bench: enriched.bench,
      });
    }
    await db.collection('agentBattles').doc(existingBattleId).update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      completionReason: 'expired',
    });
  }

  // Sector map + prices + thresholds for exactly the six (no CPU opponent).
  const sectorMap = {};
  stockUniverse.forEach(s => { sectorMap[s.symbol] = s.sectorName || 'Unknown'; });

  const allAssets = [
    ...enriched.portfolio.star,
    ...enriched.portfolio.core,
    ...enriched.portfolio.support,
  ].filter(Boolean);
  const baseATRBySymbol = {};
  for (const asset of allAssets) {
    if (asset.symbol && baseATRBySymbol[asset.symbol] == null) {
      baseATRBySymbol[asset.symbol] = asset.baseATR || 2.5;
    }
  }
  const startingPrices = await fetchValidatedStartingPrices(allAssets.map(a => a.symbol), baseATRBySymbol);
  const thresholds = buildThresholds(allAssets);

  const agentData = {
    id: agentId,
    ...agent,
    lastDecision,
  };

  const battleResult = await createAgentBattle(
    db, agentData, thresholds, startingPrices,
    {
      duration: '1d',
      sectorMap,
      opponent: null, // founder ruling D4: no embedded CPU opponent in tournament battles
      equippedWatchlist: null,
      gameMode: FLAT6_GAME_MODE,
      groupId,
      isCpu: isCpu === true,
      tournament: {
        userPicksStance: Array.isArray(userPicksStance) ? userPicksStance : [],
        doubleDownSymbols: Array.isArray(doubleDownSymbols) ? doubleDownSymbols : [],
        userPicksAtDeploy: Array.isArray(userPicks) ? userPicks : [],
      },
    }
  );

  await agentRef.update({ activeBattleId: battleResult.id });

  // First message: human-owned battles keep the voice-layer opener (it never
  // blocks); CPU system agents stay silent (contract #5 passivity — founder
  // ruling D11).
  if (isCpu !== true) {
    await generateFirstMessageOnDeploy({ db, agentData, battleId: battleResult.id });
  }

  return res.status(200).json({
    success: true,
    portfolioUpdated: true,
    battleCreated: true,
    agentBattleId: battleResult.id,
    expiresAt: battleResult.expiresAt,
    gameMode: FLAT6_GAME_MODE,
    groupId,
    portfolio: enriched.portfolio,
    bench: enriched.bench,
  });
}

// ── First-Message-on-Deploy (Phase 1 Voice Layer Rework) ────────────────────
//
// Generates Gemma's opening message to the user and writes it to the new
// battle's chatExchanges + statusFeed. Wraps everything in a single try/catch
// so the deploy is NEVER blocked by Voice Layer failure. Logs every failure
// step for post-deploy diagnostics. See spec §4.7.
//
// Failure modes (each logged but never thrown):
//   - read_battle: fresh battle-doc read failed
//   - context_fetch: anchorContext / marketSnapshot fetch failed
//   - prompt_build: buildFirstMessagePrompt threw
//   - gemma_call: callGemmaVoice rejected or aborted
//   - parse: parseVoiceLayerResponse returned parseError
//   - empty_response: parsed.response missing/non-string
//   - firestore_write: battleRef.update() failed
async function generateFirstMessageOnDeploy({ db, agentData, battleId }) {
  let errorStep = null;
  let errorReason = null;
  let systemPrompt = null;
  let rawResponse = null;
  let parsed = null;

  try {
    const battleRef = db.collection('agentBattles').doc(battleId);

    // Parallel fetch — battle doc, market context, DRB, voice-layer cache.
    // The cache will typically be absent on a fresh deploy (cron writes every
    // 15 min); marketSnapshot stays null in that case and the CACHE-COLD RULE
    // in FIRST_MESSAGE_INSTRUCTIONS forbids fabricating intraday technicals.
    let battle, anchorContext = null, marketSnapshot = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [battleDocSnap, marketCtxDoc, drbDoc, cacheDoc] = await Promise.all([
        battleRef.get(),
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
        db.collection('voiceLayerCache').doc(battleId).get(),
      ]);

      if (!battleDocSnap.exists) {
        errorStep = 'read_battle';
        errorReason = 'battle_not_found';
        throw new Error(`Battle ${battleId} not found after createAgentBattle`);
      }
      battle = battleDocSnap.data();

      if (marketCtxDoc.exists) {
        const ctx = marketCtxDoc.data();
        const regimeLine = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
        const drb = drbDoc.exists ? drbDoc.data() : null;
        const briefLine = drb && drb.forDate === today && typeof drb.dailyBrief === 'string'
          ? drb.dailyBrief
          : null;
        anchorContext = [regimeLine, briefLine].filter(Boolean).join(' ');
      }

      if (cacheDoc.exists) {
        marketSnapshot = cacheDoc.data();
      }
    } catch (err) {
      if (!errorStep) {
        errorStep = 'context_fetch';
        errorReason = err.message;
      }
      throw err;
    }

    // Build the first-message system prompt.
    try {
      const currentPhase = getAgentPhase(agentData?.stats?.gamesPlayed || 0);
      systemPrompt = buildFirstMessagePrompt({
        agent: agentData,
        battle,
        anchorContext,
        marketSnapshot,
        currentPhase,
        supportedTerms: TERM_TOKENS,
        executionMode: battle.executionMode || 'autopilot',
      });
    } catch (err) {
      errorStep = 'prompt_build';
      errorReason = err.message;
      throw err;
    }

    // Call Gemma with the same 15s AbortController pattern used in chat.js
    // and agent-batch-review.js. '__FIRST_MESSAGE__' is a kickoff sentinel
    // for Gemma only — it is never persisted to Firestore. The persisted
    // exchange has userMessage: null + messageType: 'first_message'.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      rawResponse = await callGemmaVoice({
        systemPrompt,
        conversationHistory: [],
        userMessage: '__FIRST_MESSAGE__',
        signal: controller.signal,
      });
    } catch (err) {
      errorStep = 'gemma_call';
      errorReason = err.name === 'AbortError' ? 'timeout' : err.message;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse — parseVoiceLayerResponse never throws; it returns
    // { parseError: true, errorReason, rawText } on failure.
    parsed = parseVoiceLayerResponse(rawResponse);
    if (parsed?.parseError === true) {
      errorStep = 'parse';
      errorReason = `parse_${parsed.errorReason}`;
      throw new Error(`Voice Layer parse failed: ${parsed.errorReason}`);
    }

    const agentMessage = parsed?.response;
    if (!agentMessage || typeof agentMessage !== 'string') {
      errorStep = 'empty_response';
      errorReason = 'missing_or_invalid_response_field';
      throw new Error('Gemma returned empty or non-string response');
    }

    const cleanScratchpad = parsed._scratchpad
      ? String(parsed._scratchpad).slice(0, 2000).trim() || null
      : null;

    // Build the typed exchange + statusFeed entry per spec §4.1 / §4.2.
    const exchange = {
      userMessage: null,
      agentResponse: agentMessage,
      scratchpad: cleanScratchpad,
      hasDirective: false,
      directive: null,
      suggestedActions: null,
      elicitationTarget: 'first_message',
      timestamp: new Date().toISOString(),
      mode: 'battle',
      messageType: 'first_message',
    };

    const statusEntry = {
      action: 'first_message',
      source: 'voice_layer',
      message: 'Agent opened the conversation.',
      timestamp: new Date().toISOString(),
    };

    // Single Firestore update — both writes land together so the command-dot
    // (driven by statusFeed.length growth) fires when the chat content
    // arrives. Does NOT touch chatBudgetUsed — agent-initiated messages do
    // not consume the user's 10-turn budget (spec §2 Decision 4).
    try {
      await battleRef.update({
        chatExchanges: FieldValue.arrayUnion(exchange),
        statusFeed: FieldValue.arrayUnion(statusEntry),
      });
    } catch (err) {
      errorStep = 'firestore_write';
      errorReason = err.message;
      throw err;
    }

    // Shadow log — success path.
    logFirstMessage({
      agentId: agentData?.id || null,
      battleId,
      archetype: agentData?.archetype || null,
      phase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
      executionMode: battle.executionMode || 'autopilot',
      systemPrompt,
      rawResponse,
      parsed: {
        response: agentMessage,
        scratchpad: cleanScratchpad,
      },
      exchange,
      hadMarketSnapshot: !!marketSnapshot,
      hadAnchorContext: !!anchorContext,
      success: true,
    }).catch(() => {});
  } catch (err) {
    console.error(
      `[VoiceLayer:first_message] Failed at step=${errorStep || 'unknown'} battleId=${battleId}:`,
      err.message,
    );
    logFirstMessage({
      agentId: agentData?.id || null,
      battleId,
      archetype: agentData?.archetype || null,
      success: false,
      errorStep: errorStep || 'unknown',
      errorReason: errorReason || err.message,
      systemPrompt: systemPrompt ? String(systemPrompt).slice(0, 4000) : null,
      rawResponse: rawResponse ? String(rawResponse).slice(0, 2000) : null,
    }).catch(() => {});
    // Intentionally swallowed — deploy must not be blocked by Voice Layer failure.
  }
}
