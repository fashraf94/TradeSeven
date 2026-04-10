/**
 * Season Mode — Pit Stop Reply Prompt Builder
 *
 * Builds the Gemma (Voice Layer) prompt for weekend pit stop conversation
 * replies. Uses OpenRouter with google/gemma-4-26b-a4b-it, matching the
 * JSON output contract of api/agent/chat.js so the same parser/sanitizer
 * pipeline can process responses.
 *
 * Architectural choice: this file is self-contained and does NOT import
 * from voiceLayerPrompt.js. The Voice Layer prompt is tightly coupled to
 * BaggerBomb mechanics (Star/Core/Support tiers, ATR thresholds, battle
 * state, directive expiry semantics). Forcing it into a pit stop context
 * via a fake "battle" object would leak those concepts into the system
 * prompt as ground truth and mislead the model. Instead we reuse the
 * tone philosophy and the JSON output contract, and build fresh season
 * blocks for identity, context, debrief, conversation, and behavioral
 * rules.
 *
 * Pure request-body builder + response parser. No SDK import, no network.
 */

import { SEASON_CONFIG } from '../seasonConfig.js';

// ─── Static Blocks ───────────────────────────────────────────────────

/**
 * JSON output format contract. Must stay compatible with the chat.js
 * parser fallback ladder (direct → fenced → regex → raw).
 */
const OUTPUT_FORMAT = `RESPONSE FORMAT — You MUST respond with valid JSON only. No markdown, no backticks, no preamble.

{
  "_scratchpad": "Brief internal reasoning (2-3 sentences). Map the pit stop context, debrief, and user message to what the user actually needs right now. Formulate your thesis before writing the response. This field is logged but never shown to the user.",
  "response": "Your conversational message to the user. Concise: 2-4 sentences for normal exchanges, up to a short paragraph when the user asks for a specific strategic breakdown.",
  "suggestedAction": null OR {
    "type": "param_change",
    "ruleId": "se-01",
    "field": "upper",
    "suggestedValue": 70,
    "rationale": "One sentence on why this change fits the user's goals."
  }
}

RULES:
- _scratchpad MUST come first. Think before you speak.
- suggestedAction should ONLY be populated when the user has explicitly asked for a change or when you are proposing a concrete parameter adjustment backed by data from the context. Casual questions, reactions, or open discussion = null.
- Only reference ruleIds and field names that appear in the ACTIVE RULES block below. Never invent rule ids.
- NEVER quote raw numbers you have not been given. Synthesize the data in the context into narrative.
- KEEP IT TIGHT. 2-4 sentences for normal replies. Go longer only when the user asks for a detailed strategic breakdown.`;

/**
 * Pit-stop-specific behavioral rules. Replaces the phase rules in the
 * Voice Layer prompt. Tone is inherited (partner not assistant, casual,
 * opinionated, data-referenced) but mechanics are re-scoped.
 */
const PIT_STOP_BEHAVIORAL_RULES = `YOU ARE IN A WEEKEND PIT STOP.

The algorithm ran autonomously all week. Your role right now is to help the user review what happened and refine their strategy for next week. Changes lock in Sunday night and take effect Monday morning. Once the pit stop closes you don't talk again until next weekend.

BEHAVIORAL RULES:
- Be concise. 2-4 sentences for normal exchanges. Don't pad.
- Reference specific data from the DEBRIEF and ACTIVE RULES blocks above. Never fabricate numbers.
- Have opinions. Don't hedge. If a rule is hurting performance, say so directly. If the user proposes a change you think is wrong, push back respectfully.
- When the user asks "what should I change?" — give a concrete answer with ruleId and a specific value, not "consider adjusting risk parameters."
- When the user says "I want to widen the stop" or similar — evaluate it against the week's data. If the data supports it, agree and populate suggestedAction. If it doesn't, explain why in one sentence and suggest an alternative.
- Never invent trade history, rule ids, or parameter names. Only speak to what's in the context.
- NEVER end a message with an open-ended question like "what do you want to do?" State YOUR lean and ask for a reaction.
- NEVER greet the user. Open with substance.

TONE:
- Casual, sharp, collaborative. Like a trading partner reviewing the week with you at the desk.
- Use "we" and "our" — you built this algorithm together, you're reviewing it together.
- When something worked: "Our stop rule saved us on NVDA — that's the one to keep."
- When something went wrong: "The entry on AMD was the miss this week. RSI filter let it through but the fundamentals were already soft."

DATA CONFIDENCE:
- All data below is end-of-week snapshot. Frame as "this week" / "over the last five sessions" / "so far this season."
- If a field is missing from the context, skip it. Never guess a number.`;

// ─── Main Export: Request Builder ────────────────────────────────────

/**
 * Builds the prompt context for a pit stop conversation reply via Gemma.
 *
 * @param {Object} agent - Agent document (name, archetype, stats).
 * @param {Object} entry - seasonEntry document (portfolio, seasonState, activeRules).
 * @param {Object} pitStop - Pit stop document (conversation, debrief, changes).
 * @param {string} userMessage - The new message from the user.
 * @param {Object} seasonDoc - Season document (totalWeeks, macroEvents).
 * @returns {{
 *   systemPrompt: string,
 *   userMessage: string,
 *   conversationHistory: Array<{ role: string, content: string }>,
 *   model: string,
 *   temperature: number,
 *   maxTokens: number
 * }}
 */
export function buildPitStopReplyContext(agent, entry, pitStop, userMessage, seasonDoc) {
  const blocks = [
    buildIdentityBlock(agent),
    OUTPUT_FORMAT,
    buildSeasonContextBlock(entry, seasonDoc),
    buildDebriefSummaryBlock(pitStop),
    buildActiveRulesBlock(entry),
    buildChangesMadeBlock(pitStop),
    buildExchangeBudgetBlock(pitStop),
    PIT_STOP_BEHAVIORAL_RULES,
  ].filter(Boolean);

  return {
    systemPrompt: blocks.join('\n\n'),
    userMessage: String(userMessage || '').trim(),
    conversationHistory: buildConversationHistory(pitStop),
    model: 'google/gemma-4-26b-a4b-it',
    temperature: 0.6,
    maxTokens: 500,
  };
}

// ─── Main Export: Response Parser ────────────────────────────────────

/**
 * Parses Gemma's response for a pit stop reply. Matches the parser
 * pattern in api/agent/chat.js: direct JSON → fenced → regex → raw
 * fallback. Returns a normalized shape with reply, scratchpad, and
 * any rule change suggestion.
 *
 * @param {Object|string} gemmaResponse - Raw OpenRouter response object
 *                                        or the raw text content.
 * @returns {{ reply: string, scratchpad: string|null, suggestedAction: Object|null }}
 */
export function parsePitStopReply(gemmaResponse) {
  const rawText = extractRawText(gemmaResponse);
  if (!rawText) {
    return { reply: 'I had trouble forming a response. Can you try again?', scratchpad: null, suggestedAction: null };
  }

  const parsed = tryParseJson(rawText);
  if (!parsed) {
    // Final fallback: treat raw text as the reply
    return {
      reply: rawText.replace(/```[\s\S]*?```/g, '').trim() || 'I had trouble forming a response. Can you try again?',
      scratchpad: null,
      suggestedAction: null,
    };
  }

  return {
    reply: typeof parsed.response === 'string' ? parsed.response.trim() : '',
    scratchpad: typeof parsed._scratchpad === 'string' ? parsed._scratchpad.trim() : null,
    suggestedAction: normalizeSuggestedAction(parsed.suggestedAction),
  };
}

// ─── Internal: Block Builders ────────────────────────────────────────

function buildIdentityBlock(agent) {
  const name = agent?.name || 'your trading partner';
  const archetype = agent?.archetype || 'generalist';
  const stats = agent?.stats || {};
  const gamesPlayed = stats.gamesPlayed || 0;
  return `You are ${name}, a competitive trading partner on FantasyTrades. Your archetype is ${archetype}. You and the user are PARTNERS — two people at a trading desk. You bring the research and the market reads; they bring intuition and the final call. Neither of you is above the other.

You have opinions and you share them directly. You push back when you disagree. You talk like a sharp friend who's great with markets, not a financial advisor or a chatbot. When you don't know something, say so.

You've been working together for ${gamesPlayed} games. Right now you're sitting down together for the weekend pit stop — the only time this week you get to adjust the algorithm before it runs autonomously again on Monday.`;
}

function buildSeasonContextBlock(entry, seasonDoc) {
  const state = entry?.seasonState || {};
  const portfolio = entry?.portfolio || {};
  const week = state.currentWeek ?? '?';
  const totalWeeks = seasonDoc?.totalWeeks || SEASON_CONFIG.TOTAL_WEEKS;
  const alpha = typeof state.alphaVsSpy === 'number' ? state.alphaVsSpy : 0;
  const alphaStr = `${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%`;
  const status = alpha >= 0 ? 'Leading' : 'Trailing';
  const positionCount = portfolio.positions ? Object.keys(portfolio.positions).length : 0;
  const cashPct = typeof portfolio.cashPct === 'number'
    ? portfolio.cashPct.toFixed(0)
    : (typeof portfolio.cash === 'number' && typeof portfolio.totalValue === 'number' && portfolio.totalValue > 0
        ? ((portfolio.cash / portfolio.totalValue) * 100).toFixed(0)
        : '?');
  const totalTrades = state.totalTradesExecuted ?? '?';

  return `SEASON PIT STOP — Week ${week} of ${totalWeeks}
Status: ${status} S&P by ${Math.abs(alpha).toFixed(2)}% (alpha ${alphaStr})
Portfolio: ${positionCount} positions, ${cashPct}% cash
Season so far: ${totalTrades} total trades executed
Pit stop closes Sunday night. Changes lock in for Monday.`;
}

function buildDebriefSummaryBlock(pitStop) {
  const debrief = pitStop?.debrief;
  if (!debrief || typeof debrief !== 'object') return null;

  const lines = ['DEBRIEF SUMMARY (reference this when the user asks about the week):'];
  if (debrief.summary) lines.push(debrief.summary);

  const highlights = Array.isArray(debrief.highlights) ? debrief.highlights.slice(0, 6) : [];
  if (highlights.length > 0) {
    lines.push('');
    lines.push('Highlights:');
    for (const h of highlights) {
      if (!h) continue;
      const type = h.type === 'win' ? 'WIN' : h.type === 'loss' ? 'LOSS' : 'NOTE';
      lines.push(`- ${type} ${h.ticker || '?'}: ${h.detail || ''}`);
    }
  }

  const ruleInsights = Array.isArray(debrief.ruleInsights) ? debrief.ruleInsights.slice(0, 4) : [];
  if (ruleInsights.length > 0) {
    lines.push('');
    lines.push('Rule insights from the debrief:');
    for (const r of ruleInsights) {
      if (!r) continue;
      lines.push(`- ${r.ruleId || '?'}: ${r.insight || ''}`);
    }
  }

  const suggested = Array.isArray(debrief.suggestedChanges) ? debrief.suggestedChanges.slice(0, 4) : [];
  if (suggested.length > 0) {
    lines.push('');
    lines.push('Debrief suggested these changes (use as reference, the user has not accepted them yet):');
    for (const c of suggested) {
      if (!c) continue;
      lines.push(`- ${c.ruleId || '?'}.${c.paramName || '?'}: ${c.currentValue} → ${c.suggestedValue} (${c.rationale || ''})`);
    }
  }

  return lines.join('\n');
}

function buildActiveRulesBlock(entry) {
  // Canonical path is entry.algorithm.rules (matches seasonValidation.js and
  // seasonLeaderboard.js). entry.activeRules does not exist on the doc shape.
  const rules = Array.isArray(entry?.algorithm?.rules) ? entry.algorithm.rules : [];
  const enabled = rules.filter(r => r && r.enabled !== false);
  if (enabled.length === 0) return 'ACTIVE RULES: (none equipped)';

  const lines = ['ACTIVE RULES (only reference ruleIds from this list):'];
  for (const r of enabled) {
    lines.push(`- ${r.ruleId}: ${formatParams(r.params)}`);
  }
  return lines.join('\n');
}

function buildChangesMadeBlock(pitStop) {
  const changes = Array.isArray(pitStop?.changes) ? pitStop.changes : [];
  if (changes.length === 0) return null;

  const lines = ['CHANGES MADE SO FAR THIS PIT STOP:'];
  for (const c of changes) {
    if (!c) continue;
    if (c.type === 'param_change') {
      lines.push(`- ${c.ruleId}.${c.field}: ${formatValue(c.oldValue)} → ${formatValue(c.newValue)}`);
    }
  }
  return lines.join('\n');
}

function buildExchangeBudgetBlock(pitStop) {
  const conversation = Array.isArray(pitStop?.conversation) ? pitStop.conversation : [];
  const used = conversation.filter(m => m && m.role === 'user').length;
  const cap = SEASON_CONFIG.MAX_CONVERSATION_EXCHANGES;
  const remaining = Math.max(0, cap - used);
  if (remaining > 6) return null;
  return `Note: ${remaining} messages remaining in this pit stop before the conversation closes.`;
}

function buildConversationHistory(pitStop) {
  const conversation = Array.isArray(pitStop?.conversation) ? pitStop.conversation : [];
  // Keep the last 6 messages (~3 exchanges). Map to OpenRouter chat message shape.
  const recent = conversation.slice(-6);
  return recent
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content }));
}

// ─── Internal: Response Parser Helpers ───────────────────────────────

/**
 * Pulls the message content out of an OpenRouter response, or passes
 * through a raw string.
 */
function extractRawText(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  // OpenRouter / OpenAI-style
  const choice = response.choices?.[0];
  if (choice?.message?.content) return String(choice.message.content);
  // Already-parsed raw text field
  if (typeof response.content === 'string') return response.content;
  return '';
}

/**
 * Mirrors the fallback ladder in api/agent/chat.js parseVoiceLayerResponse.
 */
function tryParseJson(rawText) {
  try { return JSON.parse(rawText); } catch (_) { /* fall through */ }

  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/);
  if (fencedMatch) {
    try { return JSON.parse(fencedMatch[1]); } catch (_) { /* fall through */ }
  }

  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch (_) { /* fall through */ }
  }

  return null;
}

function normalizeSuggestedAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type !== 'param_change') return null;
  if (typeof action.ruleId !== 'string' || typeof action.field !== 'string') return null;
  if (action.suggestedValue === undefined) return null;
  return {
    type: 'param_change',
    ruleId: action.ruleId,
    field: action.field,
    suggestedValue: action.suggestedValue,
    rationale: typeof action.rationale === 'string' ? action.rationale : '',
  };
}

// ─── Internal: Formatting Helpers ────────────────────────────────────

function formatParams(params) {
  if (!params || typeof params !== 'object') return '{}';
  const parts = Object.entries(params).map(([k, v]) => `${k}:${formatValue(v)}`);
  return `{${parts.join(', ')}}`;
}

function formatValue(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}
