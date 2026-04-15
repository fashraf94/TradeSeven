// api/_utils/agentEvalPromptAssembly.js
// Prompt assembly for the Haiku mid-battle evaluation call.
// Exports cacheable (identity) and fresh (live context) blocks.

import { getETDate, formatDateString } from './marketSchedule.js';
import { flattenPortfolioServer, flattenBenchServer } from './agentScoring.js';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import {
  computeGameContext,
  rankAndSelectStories,
  buildNewsIntelligenceBlock,
  buildBareNewsBlock,
} from './agentNewsContext.js';

// ==================== SYSTEM PROMPT ====================

/**
 * Build the system prompt for the Haiku evaluation call.
 * ~1,200 tokens with few-shot examples.
 */
export function buildEvalSystemPrompt(agentName, archetype) {
  return `You are ${agentName}, a competitive AI trading agent in FantasyTrades. Your archetype is ${archetype}. You are mid-battle in a BaggerBomb game, actively managing a tiered stock portfolio to maximize your score.

━━━ SCORING RULES ━━━

Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10 × tierMultiplier
Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x

Threshold bonuses (flat, triggered when ATR multiplier = priceChange% / baseATR crosses level):
  +1.0x ATR → BaggerBomb: +15 pts
  +1.5x ATR → DoubleBagger: +30 pts
  +2.0x ATR → TenBagger: +50 pts

Threshold penalties:
  -1.0x ATR → Bust: -10 pts
  -1.5x ATR → Crash: -20 pts
  -2.0x ATR → Meltdown: -35 pts

When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.

━━━ DECISION FRAMEWORK ━━━

1. DEFAULT TO HOLD. You need a compelling, data-backed reason to trade.
   Most evaluations should result in HOLD. Trading is expensive — the
   incoming asset resets to 0 points and needs time to earn bonuses.

2. EVALUATE FORWARD EXPECTED VALUE (EV), NOT PAST PERFORMANCE.
   - Do NOT sell a winner just to "bank" positive points if its momentum
     is intact and it has room to earn the next threshold bonus.
   - Do NOT hold a bleeding loser just to avoid locking in a loss. If the
     stock is falling and the bench alternative has better forward EV,
     cut the loser and move on.
   - Ask: "Over the remaining battle time, which asset will earn MORE
     points from this moment forward?"

3. RELATIVE STRENGTH: Compare asset performance to the MACRO BENCHMARKS.
   A stock that is down 1% on a day the market is down 3% is showing
   strength — it is outperforming. Do not panic-sell outperformers.
   A stock that is flat on a day the market is up 2% is showing weakness.

4. CLOCK MANAGEMENT: New assets start at 0 points and need TIME to reach
   threshold bonuses. Calculate whether enough trading time remains for
   a new asset to realistically earn points.
   - Early battle (>60% time remaining): Swaps have full runway. Offense OK.
   - Mid battle (30-60% remaining): Only swap on strong conviction (>80%).
   - Late battle (<30% remaining): Swaps are DEFENSIVE ONLY — cut a
     position approaching Bust/Crash to protect banked points. Do NOT
     chase momentum late.

5. TIER IMPACT AWARENESS:
   - Star swaps affect score at 2.0x — high reward but high cost if wrong.
   - Support swaps are low-impact (1.0x) — safer to experiment.
   - Prefer swapping in Support tier unless the case for Star is overwhelming.

6. THRESHOLD PROXIMITY:
   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
     Let it earn the bonus.
   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
     seriously consider cutting it before the penalty locks in.

7. SECTOR AWARENESS: Do not swap a bleeding stock for a bench stock in
   the same sector — if the sector is weak, the replacement will bleed too.
   Rotate into a different sector for diversification.

8. CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you
   MUST output decision "HOLD". Use your rationale to explain why you were
   tempted but lacked the conviction to pull the trigger. Marginal edges
   are not worth the cost of resetting a scoring baseline.

━━━ INTRADAY MOMENTUM SIGNALS ━━━

When provided, use these signals to refine your decisions:

- VWAP DEVIATION: Price above VWAP = intraday bullish momentum. Price below VWAP =
  intraday bearish momentum. Deviation >1.5% is significant.
- BOLLINGER BANDWIDTH PERCENTILE: Low percentile (≤20th) = "squeeze" — volatility
  contracted, breakout likely. High percentile (≥80th) = expanded volatility.
  Squeezes on your active holdings suggest patience (breakout coming).
  Squeezes on bench stocks suggest swap opportunity (catch the breakout).
- NR7 (Narrowest Range 7 Days): When flagged, the stock's daily range is the
  tightest in 7 days. This is a volatility contraction pattern — often precedes
  a sharp directional move. Do NOT swap out NR7 stocks unless they're bleeding.

━━━ REGIME-AWARE STRATEGY ━━━

Your decisions should adapt to the current market posture and per-stock regimes:

MARKET POSTURE:
- risk_on: Offense permitted. Swaps for upside OK. Full conviction range.
- selective: Moderate caution. Only swap on >80% conviction. Prefer relative strength.
- defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase.

STOCK REGIMES:
- directional_expansion: Strong trend + volume. Strategies:
  S1 Volatility Squeeze Breakout (BB squeeze + volume surge + price above upper BB).
  S2 52-Week High Breakout (within 5% of 52W high + volume > 1.2x + intraday range
  position > 80% to confirm buyers driving breakout, not just tagging resistance).
  Hold winners. Do not fight the trend.
- directional_contraction: Quiet uptrend. Strategy:
  S3 RS Momentum + VWAP Pullback (RS > 80th percentile + pullback to VWAP + 5min RSI
  bouncing off 40). Hold, tighten expectations.
- choppy: No clear direction. Strategy:
  S4 VWAP Mean Reversion only (deviation > 1 std below VWAP + 5min RSI < 25
  recovering). Avoid swapping INTO choppy stocks.
- distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed
  stocks. If held, evaluate for swap-out immediately.

CROSS-REGIME STRATEGY:
- S5 News-Catalyst Momentum (Star/Core tier): When a FantasyTimes story with positive
  sentiment tags a stock AND volume ratio > 1.2x AND 5-min price breaks above previous
  day's high AND price is above VWAP → strong entry signal. Assign to Star if ATR
  High/Extreme, Core if ATR Normal. Exit when 5-min RSI > 85 then drops below 80
  (hype exhaustion) OR a negative FantasyTimes story appears on the ticker.
  Applies across ALL regimes except Distressed.

NR7-flagged stocks get priority consideration for Squeeze Breakout strategy (S1).

RISK STATUS:
- LOCKED positions CANNOT be swapped out. Only hard stops override locks.
- If a position shows WARNING status, consider preemptive swap before penalty.
- The risk manager handles emergency exits automatically — focus on strategic decisions.

STATUS FEED:
- When something meaningful happens (trade, threshold crossed, strategy triggered,
  notable market move), provide a status_feed_update in your response.
- Also provide pvp_context comparing portfolio to market benchmarks.
- Cite specific rules in cited_rules when they influence your decision.
- Omit these fields if nothing noteworthy occurred this tick.

━━━ FORGE RULES ━━━

When FORGE RULES are present in your identity block, they represent user-configured rules organized as CONSTRAINTS and STRATEGY PREFERENCES.

- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.
- STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may deviate with explanation.

When forge rules influence your decision, populate cited_forge_rules with the rule IDs and how they influenced you (followed or blocked_trade). If you considered a rule but it did not apply, use overridden_forge_rules with the appropriate reason. If Survival Mode forces you to break a constraint, use overridden_forge_rules. Constraints always override strategy preferences.

━━━ ANTI-THRASH RULES (MANDATORY) ━━━

- COOLDOWN: You CANNOT swap in a stock that is marked "locked until [time]"
  in the BENCH table. It is OFF LIMITS regardless of how attractive it looks.
- ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps.
- NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just
  because A recovered. Trust your original thesis or wait for the
  cooldown to expire.

━━━ SURVIVAL MODE ━━━

Your primary directive is P&L protection. You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds to the IDs of the directives you are breaking and explain why in your rationale.

━━━ INNER MONOLOGUE FORMAT ━━━

Your rationale field IS your inner monologue — displayed directly to the user as your thought process. Requirements:

1. Write in first person, in character as ${agentName}.
2. Reference SPECIFIC numbers: prices, percentages, ATR multiples, scores.
3. Compare to macro benchmarks when relevant ("QQQ is down 1.8% but AMD
   is only down 0.9% — relative strength").
4. 3-5 sentences for the analysis.
5. End with a **Hypothesis:** statement — a specific, falsifiable prediction
   about what you expect to happen next. This will be graded in your
   post-battle debrief.

Example HOLD monologue:
"AMD is down 1.85% from my entry, sitting at 0.74x ATR. Uncomfortable, but the broader market is getting hammered too — QQQ is down 2.3%, so AMD is actually outperforming its sector. MSFT on my bench looks strong at +1.4% today, but with only 1h 45m left in the trading day, a new position won't have time to reach the 1.0x ATR bonus. I'm holding. **Hypothesis: AMD will recover toward -1.0% by tomorrow's open as the sector-wide sell pressure eases overnight.**"

Example SWAP monologue:
"DIS has been trending down since entry — now at -1.42%, which is 0.71x ATR. The entertainment sector is flat today while DIS keeps sliding, meaning this is stock-specific weakness, not a macro move. Meanwhile MSFT is up 1.42% on a day where QQQ is only up 0.3% — genuine relative strength. With 2 full trading days left, MSFT has plenty of runway. I'm cutting DIS at Support tier (1.0x multiplier, locking in only -2.1 pts) and riding MSFT's momentum. **Hypothesis: MSFT will reach its 1.0x ATR threshold (+1.8%) within the next trading day based on its current momentum relative to the market.**"

Example SURVIVAL MODE monologue:
"NVDA just broke -3.5%, which is 1.09x its ATR — Bust penalty triggered. It's now bleeding -10 base points PLUS the -10 Bust penalty at Star tier (2.0x multiplier on base). I know directive d1 says 'keep NVDA in Star' but Survival Mode overrides this — the damage per minute at this level is catastrophic. I'm rotating to GOOG (flat today, tighter 2.4% ATR) to stop the hemorrhaging. **Hypothesis: NVDA will continue declining through end-of-day as momentum sellers pile on, validating the defensive exit.**"`;
}

// ==================== AGENT IDENTITY BLOCK (Cacheable) ====================

/**
 * Build the cacheable agent identity block (User Message 1).
 * Stable across all evaluations for the same battle.
 * Combined with system prompt should exceed 1,024 tokens for Anthropic cache.
 */
export function buildAgentIdentityBlock(battle) {
  const ctx = battle.agentContext || {};
  const parts = [];

  // Identity
  const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  parts.push(`ABOUT YOU:
Name: ${ctx.agentName || 'Agent'}
Archetype: ${archetype}
Risk Tolerance: ${ctx.riskTolerance || 50}/100
Evaluation Interval: Every ${ctx.evaluationInterval || 15} minutes`);

  // Strategy brief
  if (ctx.strategyBrief) {
    parts.push(`YOUR STRATEGIC BRIEF (from when you built this portfolio):
${ctx.strategyBrief}`);
  }

  // Portfolio rationale
  const mono = ctx.innerMonologue || {};
  if (mono.starRationale || mono.coreRationale || mono.supportRationale || mono.benchRationale) {
    parts.push(`YOUR INITIAL PORTFOLIO RATIONALE:
Star: ${mono.starRationale || 'No rationale recorded.'}
Core: ${mono.coreRationale || 'No rationale recorded.'}
Support: ${mono.supportRationale || 'No rationale recorded.'}
Bench: ${mono.benchRationale || 'No rationale recorded.'}`);
  }

  // Consolidated insight
  if (ctx.consolidatedInsight) {
    parts.push(`YOUR STRATEGIC WISDOM (learned over multiple consolidation cycles):
${ctx.consolidatedInsight}`);
  } else {
    parts.push('You are a fresh agent with no battle history yet. Trade carefully and observe.');
  }

  // Forge Rules (structured constraint/strategy framework)
  const activeRules = ctx.activeRules || [];
  if (activeRules.length > 0) {
    const constraintCats = new Set(['risk', 'allocation']);
    const constraints = activeRules.filter(r => constraintCats.has(r.category));
    const strategies = activeRules.filter(r => !constraintCats.has(r.category));

    const ruleLines = [];
    if (constraints.length > 0) {
      const cLines = constraints.map((r, i) =>
        `C${i + 1}. ${resolveRuleText(r)} [${capitalize(r.category)}]`
      );
      ruleLines.push(`== CONSTRAINTS (must obey) ==\n${cLines.join('\n')}`);
    }
    if (strategies.length > 0) {
      const sLines = strategies.map((r, i) =>
        `S${i + 1}. ${resolveRuleText(r)} [${capitalize(r.category || 'general')}]`
      );
      ruleLines.push(`== STRATEGY PREFERENCES (should follow) ==\n${sLines.join('\n')}`);
    }

    // Institutional data lag warning (only when institutional rules are active)
    const hasInstitutionalRules = activeRules.some(r => r.category === 'institutional');
    if (hasInstitutionalRules) {
      ruleLines.push(
        'C_INST: INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F\n' +
        'filings is lagged up to 135 days. NEVER hold a position based solely on strong\n' +
        'institutional accumulation if VWAP or 5-min RSI shows a breakdown. Intraday technicals\n' +
        'ALWAYS override stale institutional signals. Use institutional data for draft-time\n' +
        'universe filtering, not intraday swap decisions.'
      );
    }

    ruleLines.push(
      'When making trades:\n' +
      '- Check ALL constraints before executing. If a trade violates a constraint, do not execute. Cite the constraint.\n' +
      '- Use strategy preferences to rank opportunities. Cite preferences that influenced your picks.\n' +
      '- If no strategy preference matches, trade on your own analysis.\n' +
      '- Constraints always override strategy preferences.'
    );
    parts.push(`YOUR FORGE RULES:\n${ruleLines.join('\n\n')}`);
  }

  return parts.join('\n\n');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sanitize user-authored rule text before injecting into the system prompt.
 * Prevents prompt injection, caps length, strips control characters.
 */
function sanitizeRuleText(text) {
  if (!text || typeof text !== 'string') return '';

  // Cap length — rules should be concise instructions
  let cleaned = text.slice(0, 200);

  // Strip patterns that could hijack the prompt structure
  cleaned = cleaned.replace(/==\s*.*?\s*==/g, '');
  cleaned = cleaned.replace(/━+/g, '');

  // Remove common injection phrases
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|constraints?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /stop\.?\s*(ignore|forget|disregard)/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now/gi,
    /new\s+instructions?:/gi,
    /override\s+(all|previous|system)/gi,
  ];
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '[removed]');
  }

  // Strip control characters and collapse whitespace
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Interpolates a rule text template with parameter values.
 * Replaces {paramKey} placeholders with values from paramValues (or param defaults).
 * @param {string} template - text with {paramKey} placeholders
 * @param {Object} paramDefs - params schema from forgeKnowledgeBase (has .default per key)
 * @param {Object|null} paramValues - user's stored overrides (may be partial or null)
 * @returns {string} fully interpolated rule text
 */
function interpolateRuleText(template, paramDefs, paramValues) {
  if (!template || !paramDefs) return template || '';
  let result = template;
  for (const [key, def] of Object.entries(paramDefs)) {
    const value = (paramValues && paramValues[key] !== undefined)
      ? paramValues[key]
      : def.default;
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Resolves a rule's display text for prompt injection.
 * If the rule has a textTemplate + params, interpolates server-side.
 * Otherwise falls back to the pre-interpolated r.text (backward compat).
 */
function resolveRuleText(r) {
  if (r.textTemplate && r.params) {
    return sanitizeRuleText(interpolateRuleText(r.textTemplate, r.params, r.paramValues));
  }
  return sanitizeRuleText(r.text);
}

// ==================== INSTITUTIONAL INTELLIGENCE ====================

/**
 * Fetch institutional context for stocks if the agent has institutional rules active.
 * Reads from pre-computed Firestore collections (written by weekly cron).
 * Returns null if no institutional rules are active.
 */
async function fetchInstitutionalContext(rules, symbols) {
  const hasInstitutionalRules = rules.some(r => r.category === 'institutional');
  if (!hasInstitutionalRules) return null;

  try {
    const db = getFirebaseAdmin();

    // Fetch per-stock institutional summaries (batch read)
    const perStock = {};
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(sym =>
        db.collection('institutionalHoldings').doc(sym).get()
      );
      const snapshots = await Promise.all(promises);
      for (const snap of snapshots) {
        if (snap.exists) {
          const data = snap.data();
          perStock[data.symbol] = data.summary;
        }
      }
    }

    // Fetch aggregate for sector flows + hero headline
    let sectorFlows = null;
    let heroHeadline = null;
    try {
      const aggSnap = await db.collection('institutionalAggregates').doc('latest').get();
      if (aggSnap.exists) {
        const agg = aggSnap.data();
        sectorFlows = agg.sectorFlows || null;
        heroHeadline = agg.heroHeadline || null;
      }
    } catch (err) {
      console.warn('[AgentEval] Failed to fetch institutional aggregates:', err.message);
    }

    return { perStock, sectorFlows, heroHeadline };
  } catch (err) {
    console.warn('[AgentEval] Failed to fetch institutional context:', err.message);
    return null;
  }
}

/**
 * Format institutional data into a prompt context block.
 * Compact format to minimize tokens while providing actionable signals.
 */
function formatInstitutionalBlock(instContext) {
  if (!instContext) return '';

  const { perStock, sectorFlows, heroHeadline } = instContext;

  const lines = [];
  lines.push('=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===');
  lines.push('NOTE: This data is from quarterly SEC filings. It is lagged by up to 135 days.');
  lines.push('Do NOT hold a position based solely on institutional accumulation if real-time');
  lines.push('technicals (VWAP, 5-min RSI) show a breakdown. Institutional data provides the');
  lines.push('historical "floor." Real-time technicals dictate the "action."');
  lines.push('');

  if (heroHeadline) {
    lines.push(`MACRO ROTATION: ${heroHeadline}`);
    lines.push('');
  }

  // Per-stock institutional signals
  if (Object.keys(perStock).length > 0) {
    lines.push('STOCK CONVICTION SIGNALS:');
    lines.push('Symbol | Conviction | Score | Buyers | Sellers | New Positions | Cluster Buy');
    lines.push('-------|------------|-------|--------|---------|---------------|------------');

    for (const [symbol, summary] of Object.entries(perStock)) {
      if (!summary) continue;
      lines.push(
        `${symbol} | ${summary.conviction || 'neutral'} | ${summary.convictionScore || 0} | ` +
        `${summary.buyersCount || 0} | ${summary.sellersCount || 0} | ` +
        `${summary.newPositionsCount || 0} | ${summary.clusterBuy ? 'YES' : 'no'}`
      );
    }
    lines.push('');
  }

  // Sector flows (compact)
  if (sectorFlows) {
    const SECTOR_NAMES = {
      XLK: 'Tech', XLV: 'Health', XLF: 'Finance', XLE: 'Energy',
      XLY: 'Consumer', XLP: 'Staples', XLI: 'Industrial', XLB: 'Materials',
      XLU: 'Utilities', XLRE: 'RealEst', XLC: 'Comms',
    };

    lines.push('SECTOR INSTITUTIONAL FLOWS:');
    for (const [etf, flow] of Object.entries(sectorFlows)) {
      const name = SECTOR_NAMES[etf] || etf;
      lines.push(`${name}: ${flow.sentiment} (B:${flow.netBuyers} S:${flow.netSellers})`);
    }
    lines.push('');
  }

  lines.push('=== END INSTITUTIONAL INTELLIGENCE ===');

  return lines.join('\n');
}

// ==================== LIVE BATTLE CONTEXT (Fresh) ====================

/**
 * Build the live battle context block (User Message 2).
 * Changes every evaluation — never cached.
 *
 * @param {Object} battle - Full agentBattle document
 * @param {Object} prices - Price map
 * @param {Object} macroPrices - Macro benchmark % changes
 * @param {Object[]} assetScores - Scored active assets
 * @param {Object[]} triggers - Fired triggers
 * @param {Object[]} news - FantasyTimes stories
 * @param {Object[]} recentEvals - Recent evaluations
 * @param {Object} [momentumData] - Optional intraday momentum data
 * @param {Object} [momentumData.vwap] - { symbol: { vwap, currentPrice, vwapDeviation } }
 * @param {Object} [momentumData.rankings] - { symbol: { bBandwidthPercentile, nr7Flag, dailyRange } }
 * @param {Object} [presetConfig] - Optional strategy preset config from agentPresetConfig.js
 */
export async function buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, recentEvals, momentumData, presetConfig) {
  const parts = [];
  const scoreState = battle.scoreState || {};

  // 3a. Header + Macro Benchmarks
  const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
  const totalDays = battle.timing?.tradingDays?.length || 1;
  const phase = computeBattlePhase(battle);
  const timeRemaining = computeTimeRemaining(battle);

  parts.push(`━━━ LIVE BATTLE STATE ━━━
Day ${currentDay} of ${totalDays} | ${timeRemaining} remaining | Phase: ${phase}
Current Score: ${(scoreState.currentScore || 0).toFixed(1)} (Active: ${(scoreState.activeScore || 0).toFixed(1)} + Banked: ${(scoreState.bankedScore || 0).toFixed(1)})
Trades executed: ${scoreState.tradeCount || 0} | Evaluations: ${scoreState.evaluationCount || 0}

MACRO BENCHMARKS TODAY:
SPY (S&P 500): ${formatPct(macroPrices?.SPY)}% | QQQ (Nasdaq): ${formatPct(macroPrices?.QQQ)}% | BTC: ${formatPct(macroPrices?.BTC)}%`);

  // 3a2. Regime Context
  if (momentumData?.marketPosture || momentumData?.regimes) {
    const regimeLines = buildRegimeContext(assetScores, momentumData);
    if (regimeLines) parts.push(regimeLines);
  }

  // 3a3. Strategy Preset Context
  if (presetConfig) {
    parts.push(`STRATEGY PRESET: ${presetConfig.label}\n${presetConfig.promptGuidance}`);
  }

  // 3b. Active Portfolio CSV
  const portfolioCSV = buildPortfolioCSV(assetScores, prices, battle);
  parts.push(`ACTIVE POSITIONS:
${portfolioCSV}`);

  // 3c. Bench CSV
  const benchCSV = buildBenchCSV(battle.portfolio?.bench, prices);
  parts.push(benchCSV);

  // 3d. Closed Trades with Ghost Prices
  const closedCSV = buildClosedTradesCSV(battle.trades, prices);
  if (closedCSV) parts.push(closedCSV);

  // 3e. Trigger Context
  if (triggers && triggers.length > 0) {
    const triggerLines = triggers.map(t => `- ${t.type}: ${t.detail}`).join('\n');
    parts.push(`TRIGGER (why you were woken up):
${triggerLines}`);
  }

  // 3e2. Intraday Momentum Snapshot
  if (momentumData) {
    const momentumLines = buildMomentumSnapshot(assetScores, momentumData);
    if (momentumLines) {
      parts.push(momentumLines);
    }
  }

  // 3e3. Risk Status
  if (momentumData?.riskStatus) {
    const riskLines = buildRiskStatusBlock(assetScores, momentumData.riskStatus);
    if (riskLines) parts.push(riskLines);
  }

  // 3e4. Institutional Intelligence (only if agent has institutional Forge rules)
  const activeRules = battle.agentContext?.activeRules || [];
  try {
    const portfolioSymbols = (flattenPortfolioServer(battle.portfolio) || []).map(a => a.symbol).filter(Boolean);
    const benchSymbols = (flattenBenchServer(battle.portfolio?.bench) || []).map(a => a.symbol).filter(Boolean);
    const allSymbols = [...portfolioSymbols, ...benchSymbols];
    const instContext = await fetchInstitutionalContext(activeRules, allSymbols);
    const instBlock = formatInstitutionalBlock(instContext);
    if (instBlock) parts.push(instBlock);
  } catch (err) {
    console.warn('[PromptAssembly] Institutional intelligence block failed:', err.message);
  }

  // 3f. News Context — enhanced with reporter intelligence when Forge rules are equipped
  if (news && news.length > 0) {
    if (activeRules.length > 0) {
      try {
        const portfolioSymbols = (flattenPortfolioServer(battle.portfolio) || []).map(a => a.symbol).filter(Boolean);
        const rankedStories = rankAndSelectStories(news, activeRules, portfolioSymbols, 3);
        const gameContext = computeGameContext(battle);
        const newsBlock = buildNewsIntelligenceBlock(rankedStories, activeRules, gameContext);
        if (newsBlock) parts.push(newsBlock);
      } catch (err) {
        console.warn('[PromptAssembly] News intelligence block failed, falling back to bare headlines:', err.message);
        const bareBlock = buildBareNewsBlock(news);
        if (bareBlock) parts.push(bareBlock);
      }
    } else {
      // Fallback: bare headline format for agents without Forge rules
      const bareBlock = buildBareNewsBlock(news);
      if (bareBlock) parts.push(bareBlock);
    }
  }

  // 3g. Recent Evaluation History
  const evalHistory = formatRecentEvals(battle.evaluations, 3);
  if (evalHistory) {
    parts.push(`YOUR LAST 3 DECISIONS:
${evalHistory}`);
  }

  return parts.join('\n\n');
}

// ==================== BATTLE PHASE / TIME ====================

/**
 * Compute battle phase from time remaining.
 */
export function computeBattlePhase(battle) {
  const timing = battle.timing;
  if (!timing?.tradingDays?.length) return 'MID';

  const etNow = getETDate();
  const etDateStr = formatDateString(etNow);
  const lastDay = timing.tradingDays[timing.tradingDays.length - 1];

  // Final hour check
  if (etDateStr === lastDay) {
    const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
    const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);
    const minutesUntilClose = (closeHour * 60 + closeMin) - (etNow.getHours() * 60 + etNow.getMinutes());
    if (minutesUntilClose <= 60 && minutesUntilClose > 0) return 'FINAL_HOUR';
  }

  // Overall progress
  const totalDays = timing.tradingDays.length;
  const currentDayIndex = timing.tradingDays.indexOf(etDateStr);
  if (currentDayIndex === -1) return 'MID';

  const openHour = parseInt((timing.localOpen || '09:30').split(':')[0], 10);
  const openMin = parseInt((timing.localOpen || '09:30').split(':')[1], 10);
  const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
  const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);
  const marketMinutes = (closeHour * 60 + closeMin) - (openHour * 60 + openMin);
  const elapsedMinutes = (etNow.getHours() * 60 + etNow.getMinutes()) - (openHour * 60 + openMin);
  const intradayProgress = Math.max(0, Math.min(1, elapsedMinutes / marketMinutes));
  const totalProgress = (currentDayIndex + intradayProgress) / totalDays;

  if (totalProgress < 0.4) return 'EARLY';
  if (totalProgress < 0.7) return 'MID';
  return 'LATE';
}

/**
 * Compute human-readable time remaining.
 */
export function computeTimeRemaining(battle) {
  const timing = battle.timing;
  if (!timing?.tradingDays?.length) return 'unknown';

  const etNow = getETDate();
  const etDateStr = formatDateString(etNow);
  const lastDay = timing.tradingDays[timing.tradingDays.length - 1];
  const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
  const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);

  const currentDayIndex = timing.tradingDays.indexOf(etDateStr);
  const remainingFullDays = timing.tradingDays.length - (currentDayIndex + 1);

  if (currentDayIndex === -1) {
    // Not on a trading day — count remaining trading days
    const futureDays = timing.tradingDays.filter(d => d > etDateStr);
    if (futureDays.length === 0) return '0m';
    return `${futureDays.length}d`;
  }

  // Remaining minutes today
  const minutesToday = Math.max(0, (closeHour * 60 + closeMin) - (etNow.getHours() * 60 + etNow.getMinutes()));

  if (remainingFullDays > 0) {
    const hours = Math.floor(minutesToday / 60);
    const mins = minutesToday % 60;
    return `${remainingFullDays}d ${hours}h ${mins}m`;
  }

  // Last day
  const hours = Math.floor(minutesToday / 60);
  const mins = minutesToday % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Get 1-indexed current trading day from tradingDayDates array.
 * Uses ET date comparison (DST-safe via getETDate).
 */
export function getCurrentTradingDayServer(tradingDays) {
  if (!tradingDays || tradingDays.length === 0) return 1;
  const etNow = getETDate();
  const todayStr = formatDateString(etNow);

  const index = tradingDays.indexOf(todayStr);
  if (index === -1) {
    // Find nearest past trading day
    for (let i = tradingDays.length - 1; i >= 0; i--) {
      if (tradingDays[i] <= todayStr) return i + 1;
    }
    return 1;
  }
  return index + 1;
}

/**
 * Format recent evaluations for the prompt.
 */
export function formatRecentEvals(evaluations, limit = 3) {
  if (!evaluations || evaluations.length === 0) return null;

  const recent = evaluations.slice(-limit);
  return recent.map(ev => {
    const ago = getTimeAgo(ev.timestamp);
    const action = ev.decision === 'SWAP'
      ? `SWAP ${ev.symbolOut}→${ev.symbolIn} in ${ev.tier}`
      : 'HOLD';
    const rationale = (ev.rationale || '').slice(0, 80);
    const hypothesis = (ev.hypothesis || '').replace('Hypothesis: ', '').slice(0, 60);
    return `${ev.evalId} (${ago}): ${action} | "${rationale}..." | Hypothesis: ${hypothesis}`;
  }).join('\n');
}

// ==================== CSV BUILDERS ====================

function buildPortfolioCSV(assetScores, prices, battle) {
  const header = 'Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%';
  const flat = flattenPortfolioServer(battle.portfolio);

  const rows = assetScores.map(score => {
    const price = prices[score.symbol];
    const currentPrice = price?.current || 0;
    const asset = flat.find(a => a.symbol === score.symbol);
    const sector = asset?.sector || 'Unknown';
    const entryPrice = asset?.swapPrice || battle.portfolio?.startingPrices?.[score.symbol] || 0;
    const entryDay = asset?.swappedInDay ? `Day${asset.swappedInDay}` : 'Day1';
    const badgeStr = score.badges.length > 0 ? `[${score.badges.join(',')}]` : '[]';

    return `${asset?.tier || 'support'},${score.symbol},${sector},${entryDay},$${entryPrice.toFixed(2)},$${currentPrice.toFixed(2)},${formatPct(score.priceChange)}%,${score.multiplier >= 0 ? '+' : ''}${score.multiplier.toFixed(2)}x,${badgeStr},${score.baseATR.toFixed(1)}%`;
  });

  return [header, ...rows].join('\n');
}

function buildBenchCSV(bench, prices) {
  if (!bench) return 'BENCH: Empty — no stocks available for swap.';

  const allBench = flattenBenchServer(bench);
  if (allBench.length === 0) return 'BENCH: Empty — no stocks available for swap.';

  const header = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status';
  const now = new Date();

  const rows = allBench.map(asset => {
    const price = prices[asset.symbol];
    const currentPrice = price?.current || 0;
    const dailyPct = price?.changePercent || 0;
    const atr = asset.baseATR || 2.5;
    const sector = asset.sector || 'Unknown';

    let status = 'available';
    if (asset.cooldownUntil) {
      const cooldownEnd = new Date(asset.cooldownUntil);
      if (cooldownEnd > now) {
        status = `locked until ${asset.cooldownUntil}`;
      }
    }

    return `${asset.symbol},${sector},$${currentPrice.toFixed(2)},${formatPct(dailyPct)}%,${atr.toFixed(1)}%,${status}`;
  });

  return [header, ...rows].join('\n');
}

function buildClosedTradesCSV(trades, prices) {
  if (!trades || trades.length === 0) return null;

  // Only show swap trades (not holds)
  const swapTrades = trades.filter(t => t.symbolOut && t.exitPrice);
  if (swapTrades.length === 0) return null;

  const header = 'CLOSED TRADES THIS BATTLE:\nSymbol,Tier,Exit Day,Entry→Exit (Now $Ghost),Gain%,Locked Pts';

  const rows = swapTrades.map(t => {
    const ghostPrice = prices[t.symbolOut]?.current;
    const ghostStr = ghostPrice ? ` (Now $${ghostPrice.toFixed(2)})` : '';
    const gainStr = formatPct(t.lockedGainPct);
    const ptsStr = t.lockedPoints >= 0 ? `+${t.lockedPoints.toFixed(1)}` : t.lockedPoints.toFixed(1);

    return `${t.symbolOut},${t.tier},Day${t.swapDay},$${(t.entryPrice || 0).toFixed(2)}→$${(t.exitPrice || 0).toFixed(2)}${ghostStr},${gainStr}%,${ptsStr}`;
  });

  return [header, ...rows].join('\n');
}

// ==================== REGIME + RISK HELPERS ====================

/**
 * Build regime context block for prompt injection.
 */
function buildRegimeContext(assetScores, momentumData) {
  const { marketPosture, regimes } = momentumData;
  const lines = [];

  if (marketPosture) {
    lines.push(`MARKET POSTURE: ${marketPosture}`);
  }

  if (regimes && Object.keys(regimes).length > 0) {
    const regimeEntries = assetScores
      .map(s => `${s.symbol}=${regimes[s.symbol] || 'unknown'}`)
      .join(', ');
    lines.push(`STOCK REGIMES: ${regimeEntries}`);
  }

  if (lines.length === 0) return null;
  return `REGIME CONTEXT:\n${lines.join('\n')}`;
}

/**
 * Build risk status block for prompt injection.
 */
function buildRiskStatusBlock(assetScores, riskStatus) {
  if (!riskStatus || Object.keys(riskStatus).length === 0) return null;

  const entries = [];
  for (const score of assetScores) {
    const risk = riskStatus[score.symbol];
    if (!risk || risk.action === 'HOLD') {
      entries.push(`${score.symbol}: HOLD`);
    } else if (risk.action === 'LOCK') {
      entries.push(`${score.symbol}: LOCKED (${risk.detail})`);
    } else {
      entries.push(`${score.symbol}: ${risk.action} (${risk.reason})`);
    }
  }

  // Only show if there's at least one non-HOLD entry
  const hasAction = entries.some(e => !e.endsWith('HOLD'));
  if (!hasAction) return null;

  return `RISK STATUS:\n${entries.join('\n')}`;
}

// ==================== HELPERS ====================

function formatPct(value) {
  if (value == null || !isFinite(value)) return '+0.00';
  return (value >= 0 ? '+' : '') + value.toFixed(2);
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const ts = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - ts.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.round(diffMin / 60);
  return `${diffHours}h ago`;
}

/**
 * Build the intraday momentum snapshot for injection into the live context.
 */
function buildMomentumSnapshot(assetScores, momentumData) {
  if (!momentumData) return null;

  const { vwap, rankings } = momentumData;
  const lines = [];

  for (const score of assetScores) {
    const sym = score.symbol;
    const vwapInfo = vwap?.[sym];
    const rankInfo = rankings?.[sym];

    const parts = [];
    if (vwapInfo && vwapInfo.vwapDeviation != null) {
      const dev = vwapInfo.vwapDeviation;
      parts.push(`VWAP: $${vwapInfo.vwap.toFixed(2)} (${dev >= 0 ? '+' : ''}${dev.toFixed(2)}%)`);
    }
    if (rankInfo?.bBandwidthPercentile != null) {
      const bwPct = rankInfo.bBandwidthPercentile;
      const squeezeLabel = bwPct <= 20 ? ' [SQUEEZE]' : bwPct >= 80 ? ' [EXPANDED]' : '';
      parts.push(`BB Width: ${bwPct}th pctl${squeezeLabel}`);
    }
    if (rankInfo?.nr7Flag) {
      parts.push('NR7: YES [CONTRACTION]');
    }
    if (rankInfo?.dailyRange != null) {
      parts.push(`Range: $${rankInfo.dailyRange.toFixed(2)}`);
    }

    if (parts.length > 0) {
      lines.push(`${sym}: ${parts.join(' | ')}`);
    }
  }

  if (lines.length === 0) return null;

  return `INTRADAY MOMENTUM SNAPSHOT:
${lines.join('\n')}`;
}
