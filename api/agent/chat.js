import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 15 };

// ==================== ELICITATION TARGET ====================

const ELICITATION_INSTRUCTIONS = {
  risk_appetite: "Create an opening for the user to reveal their comfort with risk. Present options that range from safe to aggressive.",
  concentration_tolerance: "Present a concentrated vs diversified choice. The user's preference reveals their position-sizing philosophy.",
  sector_convictions: "Mention 2-3 different sectors in your options. Note which sector the user gravitates toward or avoids.",
  loss_reaction: "Reference a position that's losing. The user's response reveals whether they cut or hold.",
  win_reaction: "Reference a position that's winning. The user's response reveals whether they take profit or let it ride.",
  tier_philosophy: "Frame a decision around tier placement. Which tier the user prioritizes reveals their scoring strategy.",
  momentum_vs_value: "Present a momentum play alongside a value/contrarian play. The user's choice reveals their market philosophy.",
  news_sensitivity: "Reference a news catalyst. Whether the user engages or dismisses it reveals their news sensitivity.",
  time_of_day_preference: "Include a time element in your options (e.g., 'act now at open' vs 'wait for confirmation'). Reveals urgency preference.",
  macro_awareness: "Mention a macro factor (regime, yields, breadth). Whether the user engages or ignores reveals their macro awareness.",
  communication_frequency: "Note whether the user seems to want more or less detail in your updates.",
  autonomy_preference: "Present a decision the agent could make independently. Whether the user engages or defers reveals autonomy preference.",
  feedback_style: "Pay attention to HOW the user responds — do they explain their reasoning or just give a direction?",
  competitive_focus: "Reference the score differential. Whether the user focuses on the opponent or their own portfolio reveals competitive focus.",
  learning_orientation: "Include a brief educational note. Whether the user engages with it reveals learning orientation.",
};

const DIMENSIONS = [
  'risk_appetite', 'concentration_tolerance', 'sector_convictions',
  'loss_reaction', 'win_reaction', 'tier_philosophy', 'momentum_vs_value',
  'news_sensitivity', 'time_of_day_preference', 'macro_awareness',
  'communication_frequency', 'autonomy_preference', 'feedback_style',
  'competitive_focus', 'learning_orientation',
];

function selectElicitationTarget(partnerProfile, recentTargets = []) {
  const candidates = DIMENSIONS
    .filter(d => !recentTargets.includes(d))
    .map(d => ({
      dimension: d,
      confidence: partnerProfile?.[d]?.confidence ?? 0,
    }))
    .sort((a, b) => a.confidence - b.confidence);

  const target = candidates[0] || { dimension: DIMENSIONS[0] };

  return {
    dimension: target.dimension,
    instruction: ELICITATION_INSTRUCTIONS[target.dimension],
  };
}

// ==================== OPENROUTER CALL ====================

async function callOpenRouter(systemPrompt, conversationHistory, userMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fantasytrades.io',
        'X-Title': 'FantasyTrades Voice Layer',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it',
        messages,
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`OpenRouter ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

// ==================== RESPONSE PARSER ====================

function parseVoiceLayerResponse(rawText) {
  // Try direct JSON parse
  try {
    return JSON.parse(rawText);
  } catch (_) { /* fall through */ }

  // Try extracting from ```json ... ``` blocks
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/);
  if (fencedMatch) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch (_) { /* fall through */ }
  }

  // Try extracting any {...} object
  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (_) { /* fall through */ }
  }

  // Final fallback — treat raw text as response
  const cleanedText = rawText.replace(/```[\s\S]*?```/g, '').trim();
  return {
    _scratchpad: null,
    response: cleanedText || 'I had trouble forming a response. Can you try again?',
    hasDirective: false,
    directive: null,
    suggestedActions: null,
  };
}

// ==================== RESPONSE SANITIZERS ====================

const ELICITATION_DIMENSIONS = /(?:risk_appetite|concentration_tolerance|sector_convictions?|loss_reaction|win_reaction|tier_philosophy|momentum_vs_value|news_sensitivity|time_of_day_preference|macro_awareness|communication_frequency|autonomy_preference|feedback_style|competitive_focus|learning_orientation)/gi;

function sanitizeScratchpad(raw) {
  if (!raw) return null;
  return raw
    .replace(/Server target[\s:]+(?:was\s+)?[\w_]+/gi, '')
    .replace(/target was [\w_]+/gi, '')
    .replace(/Elicitation target[:\s]?[^.]+\./gi, '')
    .replace(/Target this turn[:\s]?[^.]+\./gi, '')
    .replace(ELICITATION_DIMENSIONS, '[internal]')
    .replace(/\s{2,}/g, ' ')
    .trim() || null;
}

function normalizeDirective(parsed) {
  if (parsed.directive && typeof parsed.directive === 'object' && parsed.directive.text) {
    return { text: parsed.directive.text, expiry: parsed.directive.expiry || 'end_of_battle' };
  }
  if (parsed.directive && typeof parsed.directive === 'string') {
    return { text: parsed.directive, expiry: 'end_of_battle' };
  }
  return null;
}

// ==================== HANDLER ====================

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
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
  const sanitizedMessage = String(message).slice(0, 2000).replace(/[\n\r\t]/g, ' ').replace(/[<>{}]/g, '').trim();

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

    // 9. Read agent doc
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentDoc.data();

    // 10. Budget check — flat 10 per battle
    const chatBudget = 10;
    if ((battle.chatBudgetUsed || 0) >= chatBudget) {
      return res.status(403).json({
        error: 'chat_budget_exceeded',
        message: "We've had a solid session. Let's let things play out and regroup later.",
      });
    }

    // 11. Fetch market context for anchor + voiceLayerCache in parallel
    let anchorContext = null;
    let marketSnapshot = null;
    try {
      const [marketCtxDoc, cacheDoc] = await Promise.all([
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('voiceLayerCache').doc(battleId).get(),
      ]);
      if (marketCtxDoc.exists) {
        const ctx = marketCtxDoc.data();
        anchorContext = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
      }
      if (cacheDoc.exists) {
        marketSnapshot = cacheDoc.data();
      }
    } catch (err) {
      console.error('[VoiceLayer] Failed to fetch market context:', err.message);
    }

    // 12. Compute elicitation target
    const elicitationTarget = selectElicitationTarget(
      agent.partnerProfile,
      battle.recentElicitationTargets || [],
    );

    // 13. Build conversation history — last 10 exchanges as messages
    const previousExchanges = (battle.chatExchanges || []).slice(-10);
    const conversationHistory = previousExchanges.flatMap(ex => [
      { role: 'user', content: ex.userMessage },
      { role: 'assistant', content: ex.agentResponse || ex.agentMessage || '' },
    ]);

    // 14. Build system prompt
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      battle,
      elicitationTarget,
      conversationHistory,
      anchorContext,
      marketSnapshot,
    });

    // 15. Call OpenRouter (Gemma 4)
    const rawResponse = await callOpenRouter(systemPrompt, conversationHistory, sanitizedMessage);

    // 16. Parse response
    const parsed = parseVoiceLayerResponse(rawResponse);

    // 17. Normalize and sanitize parsed fields
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);
    const normalizedDirective = normalizeDirective(parsed);

    // 18. Map to client contract
    const clientResponse = {
      agentMessage: parsed.response,
      extractedRule: normalizedDirective
        ? { text: normalizedDirective.text, targetType: 'general', targetValue: null, rationale: normalizedDirective.text }
        : null,
      suggestedActions: parsed.suggestedActions || null,
      exchangeNumber: (battle.chatBudgetUsed || 0) + 1,
      budgetTotal: chatBudget,
      scratchpad: cleanScratchpad,
      hasDirective: parsed.hasDirective || false,
      directive: normalizedDirective,
    };

    // Shadow log (fire-and-forget)
    logConversation({
      userId: user.uid,
      agentId,
      battleId,
      archetype: agent.archetype || null,
      gameMode: battle.gameMode || null,
      exchangeNumber: (battle.chatBudgetUsed || 0) + 1,
      userMessage: sanitizedMessage,
      agentMessage: parsed.response,
      scratchpad: cleanScratchpad,
      directive: normalizedDirective,
      suggestedActions: parsed.suggestedActions || null,
      elicitationTarget: elicitationTarget.dimension,
      anchorContext: anchorContext || null,
      hasDirective: parsed.hasDirective || false,
      tokenUsage: null,
    }).catch(() => {});

    // 19. Write exchange to battle doc
    const exchange = {
      userMessage: sanitizedMessage,
      agentResponse: parsed.response,
      scratchpad: cleanScratchpad,
      hasDirective: parsed.hasDirective || false,
      directive: normalizedDirective,
      suggestedActions: parsed.suggestedActions || null,
      elicitationTarget: elicitationTarget.dimension,
      timestamp: new Date().toISOString(),
    };

    const recentTargets = [...(battle.recentElicitationTargets || []), elicitationTarget.dimension].slice(-3);

    await battleRef.update({
      chatExchanges: FieldValue.arrayUnion(exchange),
      chatBudgetUsed: FieldValue.increment(1),
      recentElicitationTargets: recentTargets,
    });

    // 20. Write directive to agent doc (only if hasDirective)
    if (parsed.hasDirective && normalizedDirective) {
      const directive = {
        id: `voice_${Date.now()}`,
        text: normalizedDirective.text,
        source: 'voice_layer',
        expiry: normalizedDirective.expiry || 'end_of_battle',
        battleId,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      await db.collection('agents').doc(agentId).update({
        directives: FieldValue.arrayUnion(directive),
      });
    }

    // 21. Return response
    return res.status(200).json(clientResponse);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[VoiceLayer] Request timed out');
      return res.status(504).json({ error: 'Agent response timed out. Try again.' });
    }
    console.error('[VoiceLayer] Error:', error);
    return res.status(500).json({ error: 'Agent unavailable. Try again in a moment.' });
  }
}
