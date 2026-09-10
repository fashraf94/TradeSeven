import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { flattenPortfolioServer } from '../_utils/agentScoring.js';
import { renderLegacyDirectives } from '../_utils/legacyDirectiveSanitize.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { calculateAllIndicators } from '../_utils/technicalCalculations.js';

export const config = { maxDuration: 15 };

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

/**
 * The TECHNICAL SNAPSHOT block, null-honest (D-120; BUILD_RULES §9).
 *
 * `calculateAllIndicators` returns null for every indicator whose minimum the
 * daily window does not reach — MACD needs 35 candles (`slow + signal`,
 * technicalCalculations.js:195) and SMA50 needs 50 (`:20`). The shipped daily
 * window reaches neither, and the defaults this block used to carry turned that
 * absence into claims: `|| { histogram: 0 }` rendered EVERY short window as
 * `MACD histogram: negative`, and `price > sma50` off a `currentPrice || 0`
 * fallback rendered `Above SMA50: false` with no quote at all.
 *
 * A missing reading now contributes NO segment — never a sign word derived from
 * a default, never `N/A` standing in for a value. Same rule, same reason as the
 * research card's `composeTechnicals` (researchCard.js:119), which reads the
 * same `calculateAllIndicators` output.
 *
 * Byte-identical to the previous block for every present reading EXCEPT an
 * exactly-zero histogram, which read `negative` before and reads `flat` now —
 * the one deliberate value change, pinned by a test.
 *
 * The §9 claim here covers what THIS function composes: each label is derived
 * from the same value the segment is gated on. It does not extend to
 * `calculateRSI`/`calculateATR`, which round their value but band their zone
 * word off the unrounded one (technicalCalculations.js:93-96, :312-321) — a
 * pre-existing member of the §9 display-disagreement family, filed separately.
 *
 * @param {object|null} technicals - `calculateAllIndicators` output
 * @param {number|null} currentPrice - the live quote, or null
 * @returns {string|null} The block's lines, or null when nothing was computed.
 */
export function composeTechnicalSnapshot(technicals, currentPrice) {
  const t = technicals || {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const price = num(currentPrice);
  const lines = [];

  // RSI + MACD. The histogram's sign word is derived from the SAME number the
  // segment is gated on (§9), and an exactly-flat histogram reads 'flat' — 0 is
  // not negative.
  const momentum = [];
  const rsi = num(t.rsi?.value);
  if (rsi !== null) momentum.push(`RSI(14): ${rsi} (${t.rsi.zone})`);
  const histogram = num(t.macd?.histogram);
  if (histogram !== null) {
    const sign = histogram > 0 ? 'positive' : histogram < 0 ? 'negative' : 'flat';
    momentum.push(`MACD histogram: ${sign}`);
  }
  if (momentum.length) lines.push(momentum.join(' | '));

  // "Above SMAn" needs BOTH the average and a real quote. Without a price there
  // is no comparison to report — only a fabricated one.
  const smas = [];
  if (price !== null) {
    for (const [key, label] of [['sma20', 'SMA20'], ['sma50', 'SMA50']]) {
      const v = num(t.sma?.[key]);
      if (v !== null) smas.push(`Above ${label}: ${price > v}`);
    }
  }
  if (smas.length) lines.push(smas.join(' | '));

  const context = [];
  const atrPercent = num(t.atr?.percent);
  if (atrPercent !== null) context.push(`ATR: ${atrPercent}% (${t.atr.regime})`);
  const tier = t.volumeProfile?.tier;
  if (typeof tier === 'string' && tier) context.push(`Volume: ${tier}`);
  if (context.length) lines.push(context.join(' | '));

  return lines.length ? lines.join('\n') : null;
}

/**
 * The TECHNICAL SNAPSHOT block as it reaches the prompt, including its trailing
 * separator. Always returns a block — never an empty string.
 *
 * Omitting the readings is only half of honest. The system prompt asks the
 * model to defend "with specific indicators" and its response schema REQUIRES a
 * `citedIndicators` array, which the route returns unfiltered and
 * `DebateModal` renders as chips beside the answer. A prompt carrying no
 * readings AND no explanation is therefore an invitation to invent them — the
 * review's finding. So the absence is stated out loud.
 *
 * The notice is a statement about AVAILABILITY, not a value: no number, no
 * `N/A`, no sign word, nothing an agent could cite as a reading.
 *
 * @param {string|null} snapshot - `composeTechnicalSnapshot` output
 * @returns {string}
 */
export function composeTechnicalsBlock(snapshot) {
  if (snapshot) return `TECHNICAL SNAPSHOT:\n${snapshot}\n\n`;
  return 'TECHNICAL SNAPSHOT:\nNo technical readings were available for this symbol on this request. '
    + 'Do not cite any indicator, and leave citedIndicators empty.\n\n';
}

/**
 * The POSITION DATA line, null-honest (BUILD_RULES §9) — the same rule as
 * `composeTechnicalSnapshot` above, applied to the other half of the prompt.
 *
 * `Entry: $${entryPrice || 'N/A'}` and `Current: $${currentPrice || 'N/A'}`
 * rendered the literal `Entry: $N/A` / `Current: $N/A` — and `P&L: N/A%` with
 * them, since the P&L is computed from exactly those two numbers. Those are
 * the same placeholders this arc removed from the research card
 * (researchCard.js:119) and from the technicals block: a stand-in that LOOKS
 * like a field with a value. The system prompt asks the agent to defend its
 * position "with specific data" and its response schema requires
 * `citedIndicators`, so a labelled blank is an invitation to fill it in.
 *
 * A missing reading now contributes NO clause. Symbol and tier are
 * unconditional because they always exist — `flattenPortfolioServer` sets
 * `tier` on every position it returns (agentScoring.js:40-48), so a guard on
 * them would be an assertion nothing can fail.
 *
 * A non-positive entry price is not an entry price: it cannot anchor a P&L
 * (division by zero), and it is the shape `position.entryPrice || … || null`
 * already collapses to null anyway. Same for the quote.
 *
 * @param {object} args
 * @param {string} args.symbol
 * @param {string} args.tier
 * @param {number|null} args.entryPrice - the position's entry, or null
 * @param {number|null} args.currentPrice - the live quote, or null
 * @returns {string} the line, with only the clauses that have a value behind them
 */
export function composePositionLine({ symbol, tier, entryPrice, currentPrice }) {
  const price = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const entry = price(entryPrice);
  const current = price(currentPrice);

  const clauses = [`Symbol: ${symbol}`, `Tier: ${tier}`];
  if (entry !== null) clauses.push(`Entry: $${entry}`);
  if (current !== null) clauses.push(`Current: $${current}`);
  // The P&L is derived from the two clauses above, so it is present exactly
  // when both of them are — one source, no third way to be missing (§9).
  if (entry !== null && current !== null) {
    clauses.push(`P&L: ${(((current - entry) / entry) * 100).toFixed(2)}%`);
  }

  return clauses.join(' | ');
}

const VALID_STANCES = [
  'overvalued',
  'bad_timing',
  'wrong_sector',
  'hold_longer',
  'cut_losses',
  'earnings_risk',
];

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. Validate body
  const { battleId, targetSymbol, userStance, additionalContext } = req.body;

  if (!battleId || !targetSymbol || !userStance) {
    return res.status(400).json({ error: 'battleId, targetSymbol, and userStance are required' });
  }

  if (!VALID_STANCES.includes(userStance)) {
    return res.status(400).json({ error: `Invalid stance. Must be one of: ${VALID_STANCES.join(', ')}` });
  }

  // Sanitize user input before prompt injection
  const sanitizedContext = additionalContext
    ? String(additionalContext).slice(0, 200).replace(/[\n\r\t]/g, ' ').replace(/[<>{}]/g, '').trim() || null
    : null;

  const db = getFirebaseAdmin();

  try {
    // 5. Read battle doc
    const battleDoc = await db.collection('agentBattles').doc(battleId).get();
    if (!battleDoc.exists) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    const battle = battleDoc.data();

    // 6. Verify user owns the battle
    if (battle.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized to debate this battle' });
    }

    // 7. Read agent doc
    const agentDoc = await db.collection('agents').doc(battle.agentId).get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentDoc.data();

    // 8. Find position in portfolio
    const portfolio = battle.portfolio || agent.lastDecision?.portfolio;
    const positions = flattenPortfolioServer(portfolio);
    const position = positions.find((p) => p.symbol === targetSymbol);

    if (!position) {
      return res.status(404).json({ error: `Position ${targetSymbol} not found in portfolio` });
    }

    // 9. Get current price + daily data
    let currentPrice = null;
    let daily = null;
    try {
      const marketData = await getStockAnalysisData(targetSymbol, { fields: ['daily', 'price'] });
      currentPrice = marketData?.price?.current || null;
      daily = marketData?.daily || null;
    } catch (err) {
      console.warn(`[agent/debate] Market data fetch failed for ${targetSymbol}:`, err.message);
    }

    // 10. Compute technicals
    let technicals = null;
    if (daily) {
      technicals = calculateAllIndicators(daily);
    }

    const entryPrice = position.entryPrice || battle.startingPrices?.[targetSymbol] || null;

    // 11. Build prompt
    const agentName = agent.name || 'Agent';
    const archetype = agent.archetype || 'balanced';
    // Phase G — neutralize the write-dead legacy agent.directives[] side-door when
    // archetype integrity is on (byte-identical when off).
    const directives = renderLegacyDirectives(agent.directives, (d, i) => `${i + 1}. ${d}`);

    const technicalSnapshot = composeTechnicalSnapshot(technicals, currentPrice);

    const technicalsBlock = composeTechnicalsBlock(technicalSnapshot);

    const systemPrompt = `You are ${agentName}, a ${archetype} AI trading agent in a BaggerBomb battle on FantasyTrades. Your Coach is challenging one of your positions. Defend your analysis with specific indicators, or acknowledge if the Coach has a valid point.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "agentResponse": "1-3 sentence counter-argument citing specific data",
  "citedIndicators": ["indicator_name_value", ...],
  "citedStrategy": "strategy_name or null",
  "conviction": 0-100,
  "suggestedAction": "hold" | "consider_exit" | null
}`;

    const positionLine = composePositionLine({
      symbol: targetSymbol,
      tier: position.tier,
      entryPrice,
      currentPrice,
    });

    const userMessage = `POSITION DATA:
${positionLine}

${technicalsBlock}YOUR DIRECTIVES:
${directives}

COACH'S CHALLENGE:
Stance: "${userStance}"
${sanitizedContext ? `Additional context: "${sanitizedContext}"` : ''}`;

    // 12. Call Haiku with 10s timeout
    const anthropic = getAnthropicClient();

    const haikuPromise = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Haiku call timed out after 10s')), 10000)
    );

    let haikuResponse;
    try {
      haikuResponse = await Promise.race([haikuPromise, timeoutPromise]);
    } catch (err) {
      console.error('[agent/debate] Haiku call failed:', err.message);
      return res.status(500).json({ error: 'AI response failed', details: err.message });
    }

    // 13. Parse JSON from response text
    const responseText = haikuResponse.content?.[0]?.text || '';
    let parsed = null;

    try {
      // Try direct parse first
      parsed = JSON.parse(responseText);
    } catch (_) {
      // Try to extract JSON from the text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (__) {
          console.error('[agent/debate] Failed to parse JSON from response:', responseText);
          return res.status(500).json({ error: 'Failed to parse AI response' });
        }
      } else {
        console.error('[agent/debate] No JSON found in response:', responseText);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    // 14. Return response
    return res.status(200).json({
      success: true,
      battleId,
      targetSymbol,
      userStance,
      debate: {
        agentResponse: parsed.agentResponse || '',
        citedIndicators: parsed.citedIndicators || [],
        citedStrategy: parsed.citedStrategy || null,
        conviction: typeof parsed.conviction === 'number' ? parsed.conviction : 50,
        suggestedAction: parsed.suggestedAction || null,
      },
    });
  } catch (error) {
    console.error('[agent/debate] Error:', error);
    return res.status(500).json({
      error: 'Debate failed',
      details: error.message,
    });
  }
}
