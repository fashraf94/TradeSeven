import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isMarketOpen } from '../_utils/marketSchedule.js';
import { getCurrentTradingDayServer } from '../_utils/agentEvalPromptAssembly.js';

export const config = { maxDuration: 15 };

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

// Thresholds mirrored from src/constants/agentProgression.js — keep in sync
function getChatBudget(gamesPlayed) {
  if (gamesPlayed >= 15) return 6;  // Partner
  if (gamesPlayed >= 5) return 4;   // Starter
  return 2;                          // Rookie
}

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 3, windowMs: 60000 } })) {
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
  const { agentId, battleId, message } = req.body;

  if (!agentId || !battleId || !message) {
    return res.status(400).json({ error: 'agentId, battleId, and message are required' });
  }

  // 5. Sanitize message
  const sanitizedMessage = String(message).slice(0, 500).replace(/[\n\r\t]/g, ' ').replace(/[<>{}]/g, '').trim();

  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const db = getFirebaseAdmin();

  try {
    // 6. Read battle doc
    const battleRef = db.collection('agentBattles').doc(battleId);
    const battleDoc = await battleRef.get();
    if (!battleDoc.exists) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    const battle = battleDoc.data();

    // 7. Verify ownership
    if (battle.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized to chat in this battle' });
    }

    // 8. Battle status check
    if (battle.status !== 'active') {
      return res.status(400).json({
        error: 'battle_not_active',
        message: 'This battle has ended. Start a new battle to chat with your agent.',
      });
    }

    // 9. Market phase check
    if (isMarketOpen()) {
      return res.status(403).json({
        error: 'market_hours',
        message: 'Strategy chat is available before and after market hours. During live trading, use the Co-Pilot controls.',
      });
    }

    // 10. Read agent doc
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentDoc.data();

    // 11. Budget check
    const chatBudget = getChatBudget(agent.stats?.gamesPlayed || 0);
    if ((battle.chatBudgetUsed || 0) >= chatBudget) {
      return res.status(403).json({
        error: 'chat_budget_exceeded',
        message: "I've given this a lot of thought today, Coach. Let's revisit in the Film Room — I want to process today's action before we dig deeper.",
      });
    }

    // 12. Build conversation history (last 5)
    const previousExchanges = (battle.chatExchanges || []).slice(-5);
    const historyLines = previousExchanges.map(e => `Coach: "${e.userMessage}"\nAgent: "${e.agentMessage}"`).join('\n');

    // 13. Build prompt
    const agentName = agent.name || 'Agent';
    const archetype = agent.archetype || 'balanced';

    const directives = agent.directives?.length
      ? agent.directives.map(d => `- ${d}`).join('\n')
      : 'No active directives';

    const tradingDays = battle.tradingDays || [];
    const currentDay = getCurrentTradingDayServer(tradingDays);
    const totalDays = tradingDays.length || 0;

    const scoreState = battle.scoreState || {};

    // Last 2-3 evaluations
    const evaluations = battle.evaluations || [];
    const recentEvals = evaluations.slice(-3);
    const evalLines = recentEvals.length > 0
      ? recentEvals.map(e => `- [${e.evalId || 'eval'}] ${e.decision || 'unknown'}: ${e.rationale || 'N/A'} (conviction: ${e.conviction ?? 'N/A'})`).join('\n')
      : 'No evaluations yet';

    const systemPrompt = `You are ${agentName}, a ${archetype} trading agent having a strategy conversation with your Coach.
${agent.consolidatedInsight ? `Your strategic wisdom: ${agent.consolidatedInsight}` : ''}

RULE EXTRACTION GUIDANCE:
- Extract a rule ONLY when the Coach explicitly states a preference, philosophy, or constraint
- Examples that SHOULD produce a rule:
  - "I never want to hold biotech over earnings" → Rule: "Never hold biotech over earnings"
  - "When VIX is high, go defensive" → Rule: "When VIX > 25, shift to defensive preset"
- Examples that should NOT produce a rule:
  - "How are we doing today?" → No rule (just a question)
  - "That last trade was rough" → No rule (expression, not a directive)
- When in doubt, do NOT extract. Better to miss a rule than create noise.
- Extracted rules should be concise (under 15 words) and actionable.

Respond naturally in 2-4 sentences. Be a strategic partner, not a yes-man. If the Coach shares a thesis, engage — push back with data if you disagree, build on it if you agree.

Return ONLY valid JSON (no markdown, no backticks):
{
  "agentMessage": "your 2-4 sentence response",
  "extractedRule": null or { "text": "rule text", "targetType": null|"strategy"|"indicator"|"risk"|"tier", "targetValue": "specific target or null", "rationale": "why this rule" }
}`;

    const userMessage = `BATTLE SUMMARY: Day ${currentDay} of ${totalDays}, Score ${scoreState.currentScore}, ${scoreState.tradeCount} trades
YOUR PLAYBOOK: ${directives}
RECENT DECISIONS: ${evalLines}

${historyLines.length > 0 ? `CONVERSATION HISTORY:\n${historyLines}\n` : ''}Coach's new message: "${sanitizedMessage}"`;

    // 14. Call Haiku with 10s timeout
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
      console.error('[agent/chat] Haiku call failed:', err.message);
      return res.status(500).json({ error: 'Agent unavailable. Try again.' });
    }

    // 15. Parse JSON from response text
    const responseText = haikuResponse.content?.[0]?.text || '';
    let result = null;

    try {
      // Try direct parse first
      result = JSON.parse(responseText);
    } catch (_) {
      // Try to extract JSON from the text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (__) {
          console.error('[agent/chat] Failed to parse JSON from response:', responseText);
          return res.status(500).json({ error: 'Agent unavailable. Try again.' });
        }
      } else {
        console.error('[agent/chat] No JSON found in response:', responseText);
        return res.status(500).json({ error: 'Agent unavailable. Try again.' });
      }
    }

    // 16. Write to battle doc (only on success)
    const exchange = {
      userMessage: sanitizedMessage,
      agentMessage: result.agentMessage,
      extractedRule: result.extractedRule || null,
      timestamp: new Date().toISOString(),
    };
    const updatedExchanges = [...(battle.chatExchanges || []), exchange];
    await battleRef.update({
      chatExchanges: updatedExchanges,
      chatBudgetUsed: (battle.chatBudgetUsed || 0) + 1,
    });

    // 17. Return response
    return res.status(200).json({
      agentMessage: result.agentMessage,
      extractedRule: result.extractedRule || null,
      exchangeNumber: (battle.chatBudgetUsed || 0) + 1,
      budgetTotal: chatBudget,
    });
  } catch (error) {
    console.error('[agent/chat] Error:', error);
    return res.status(500).json({ error: 'Agent unavailable. Try again.' });
  }
}
