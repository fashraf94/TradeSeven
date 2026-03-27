import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { flattenPortfolioServer } from '../_utils/agentScoring.js';
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

    // Compute P&L
    const entryPrice = position.entryPrice || battle.startingPrices?.[targetSymbol] || null;
    const pnlPct = entryPrice && currentPrice
      ? (((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2)
      : 'N/A';

    // 11. Build prompt
    const agentName = agent.name || 'Agent';
    const archetype = agent.archetype || 'balanced';
    const directives = agent.directives?.length
      ? agent.directives.map((d, i) => `${i + 1}. ${d}`).join('\n')
      : 'No active directives';

    const rsi = technicals?.rsi || { value: 'N/A', zone: 'unknown' };
    const macd = technicals?.macd || { histogram: 0 };
    const sma20 = technicals?.sma?.sma20 || null;
    const sma50 = technicals?.sma?.sma50 || null;
    const atr = technicals?.atr || { percent: 'N/A', regime: 'unknown' };
    const volumeProfile = technicals?.volumeProfile || { tier: 'unknown' };
    const price = currentPrice || 0;

    const systemPrompt = `You are ${agentName}, a ${archetype} AI trading agent in a BaggerBomb battle on FantasyTrades. Your Coach is challenging one of your positions. Defend your analysis with specific indicators, or acknowledge if the Coach has a valid point.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "agentResponse": "1-3 sentence counter-argument citing specific data",
  "citedIndicators": ["indicator_name_value", ...],
  "citedStrategy": "strategy_name or null",
  "conviction": 0-100,
  "suggestedAction": "hold" | "consider_exit" | null
}`;

    const userMessage = `POSITION DATA:
Symbol: ${targetSymbol} | Tier: ${position.tier} | Entry: $${entryPrice || 'N/A'} | Current: $${currentPrice || 'N/A'} | P&L: ${pnlPct}%

TECHNICAL SNAPSHOT:
RSI(14): ${rsi.value} (${rsi.zone}) | MACD histogram: ${macd.histogram > 0 ? 'positive' : 'negative'}
Above SMA20: ${sma20 !== null ? price > sma20 : 'N/A'} | Above SMA50: ${sma50 !== null ? price > sma50 : 'N/A'}
ATR: ${atr.percent}% (${atr.regime}) | Volume: ${volumeProfile.tier}

YOUR DIRECTIVES:
${directives}

COACH'S CHALLENGE:
Stance: "${userStance}"
${additionalContext ? `Additional context: "${additionalContext}"` : ''}`;

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
