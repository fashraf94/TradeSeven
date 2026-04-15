// api/cron/agent-batch-review.js
// End-of-day batch review cron for AI trading agents.
// Fires at 4:15 PM ET to generate daily film-room reviews via Haiku.
//
// Schedule: 15 21 * * 1-5

import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import { getCurrentTradingDayServer } from '../_utils/agentEvalPromptAssembly.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[BatchReview]';

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

const BATCH_REVIEW_TOOL = {
  name: 'submit_batch_review',
  description: 'Submit the end-of-day batch review',
  input_schema: {
    type: 'object',
    required: ['daySummary', 'strategyAnalysis', 'selfGrade', 'selfGradeRationale', 'proposedRules', 'lessonLearned'],
    properties: {
      daySummary: { type: 'string', description: '3-4 sentence summary of the day' },
      strategyAnalysis: { type: 'string', description: 'Which strategies worked/failed and why' },
      selfGrade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'], description: 'Overall grade' },
      selfGradeRationale: { type: 'string', description: '1-sentence justification' },
      proposedRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: ['text', 'rationale'],
        },
        description: '0-2 proposed playbook rules',
      },
      lessonLearned: { type: 'string', description: '1 sentence — what agent would do differently' },
    },
  },
};

function isToday(isoStr, todayStr) {
  if (!isoStr) return false;
  return isoStr.slice(0, 10) === todayStr;
}

async function processBattleReview(db, battle) {
  const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Check if review already done
  if ((battle.dailyReviews || []).some(r => r.date === todayStr)) {
    console.log(`${LOG_PREFIX} Battle ${battle.id}: review already exists for ${todayStr}, skipping`);
    return { status: 'skipped', reason: 'already_reviewed' };
  }

  // Filter today's data
  const todayTrades = (battle.trades || []).filter(t => t.swapDay === currentDay);
  const todayEvals = (battle.evaluations || []).filter(e => e.day === currentDay);
  const todayVetoes = (battle.proposalHistory || []).filter(
    p => p.resolution === 'vetoed' && p.vetoedAtTimestamp && isToday(p.vetoedAtTimestamp, todayStr)
  );
  const todayDebates = (battle.battleLedger || []).filter(
    e => e.type === 'debate' && isToday(e.timestamp, todayStr)
  );

  // If no activity today, skip
  if (todayTrades.length === 0 && todayEvals.length === 0) {
    console.log(`${LOG_PREFIX} Battle ${battle.id}: no activity on day ${currentDay}, skipping`);
    return { status: 'skipped', reason: 'no_activity' };
  }

  // Read user grades
  const grades = battle.dailyGrades?.[todayStr];

  // Compute counterfactuals for vetoed proposals
  const counterfactuals = [];
  for (const veto of todayVetoes) {
    const vetoPrice = veto.vetoedAtPrice?.[veto.symbolIn];
    if (!vetoPrice) continue;
    try {
      const data = await getStockAnalysisData(veto.symbolIn, { fields: ['price'] });
      const closePrice = data?.price?.current;
      if (!closePrice) continue;
      const delta = ((closePrice - vetoPrice) / vetoPrice * 100);
      counterfactuals.push({
        proposalId: veto.proposalId,
        symbolIn: veto.symbolIn,
        vetoPrice,
        closePrice,
        deltaPct: parseFloat(delta.toFixed(2)),
        outcome: delta > 0 ? 'missed_gain' : 'avoided_loss',
        summary: delta > 0
          ? `Your veto on ${veto.symbolIn} cost a potential ${Math.abs(delta).toFixed(1)}% gain.`
          : `Good veto — ${veto.symbolIn} dropped ${Math.abs(delta).toFixed(1)}% after your block.`,
      });
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to fetch counterfactual for ${veto.symbolIn}:`, err.message);
    }
  }

  // Build score state
  const scoreState = battle.scoreState || {};

  // Build user message
  const tradeLines = todayTrades.map(t =>
    `- ${t.symbolOut} → ${t.symbolIn} (${t.tier}): ${t.lockedGainPct}% / ${t.lockedPoints} pts [trigger: ${t.trigger}]`
  ).join('\n');

  const vetoLines = todayVetoes.map(v =>
    `- ${v.symbolOut} → ${v.symbolIn}: reason=${v.userReason || 'none given'}`
  ).join('\n');

  const debateLines = todayDebates.map(d =>
    `- ${d.targetSymbol}: stance=${d.userStance}, outcome=${d.outcome}`
  ).join('\n');

  const counterfactualLines = counterfactuals.map(c =>
    `- Vetoed ${c.symbolIn}: veto price $${c.vetoPrice}, close $${c.closePrice}, delta ${c.deltaPct}%`
  ).join('\n');

  const gradeLines = grades?.trades?.length
    ? grades.trades.map(g => {
        const note = g.note ? ` — Note: "${g.note}"` : '';
        return `- Trade ${(g.tradeIndex ?? 0) + 1} (${g.symbolOut || '?'} → ${g.symbolIn || '?'}): ${g.grade || 'no_opinion'}${note}`;
      }).join('\n')
    : 'No grades submitted';

  const directives = battle.agentContext?.directives;
  const directiveLines = directives && directives.length > 0
    ? directives.map(d => `- ${d}`).join('\n')
    : 'No active directives';

  const userMessage = `TODAY'S PERFORMANCE (Day ${currentDay}):
Score: ${scoreState.currentScore ?? 'N/A'} (Active: ${scoreState.activeScore ?? 'N/A'} + Banked: ${scoreState.bankedScore ?? 'N/A'})
Trades today: ${todayTrades.length}
${tradeLines}

Proposals vetoed by Coach: ${todayVetoes.length}
${vetoLines}

Debates: ${todayDebates.length}
${debateLines}

COUNTERFACTUAL DATA:
${counterfactualLines || 'None'}

USER GRADES:
${gradeLines}

AGENT DIRECTIVES:
${directiveLines}`;

  const agentName = battle.agentContext?.agentName || 'Agent';
  const systemPrompt = `You are ${agentName}, reviewing today's trading activity in your BaggerBomb battle. Analyze the day's performance honestly and produce a review.`;

  // Call Haiku with tool use + 15s timeout
  const client = getAnthropicClient();
  const apiCall = client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: [BATCH_REVIEW_TOOL],
    tool_choice: { type: 'tool', name: 'submit_batch_review' },
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Haiku review call timed out after 15s')), 15_000)
  );

  const response = await Promise.race([apiCall, timeout]);

  // Parse tool_use result
  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock) {
    throw new Error('No tool_use block in Haiku response');
  }
  const result = toolBlock.input;

  // Write to battle doc
  const battleRef = db.collection('agentBattles').doc(battle.id);
  const existingFeed = battle.statusFeed || [];
  const reviewEntry = {
    date: todayStr,
    tradingDay: currentDay,
    ...result,
    // Alias daySummary → summary so buildReviewContext() in voiceLayerPrompt.js
    // (which reads `summary`) picks up the Haiku day summary. Sonnet also reads
    // this at battle end for the Battle Report on multi-day battles.
    summary: result.daySummary,
    counterfactuals,
    createdAt: new Date().toISOString(),
  };

  await battleRef.update({
    dailyReviews: [...(battle.dailyReviews || []), reviewEntry],
    statusFeed: [...existingFeed, {
      timestamp: new Date().toISOString(),
      message: `Game Tape: Day ${currentDay} review complete. Grade: ${result.selfGrade}. ${result.lessonLearned}`,
      action: 'film_room',
      source: 'batch_review',
    }].slice(-50),
  });

  console.log(`${LOG_PREFIX} Battle ${battle.id}: Day ${currentDay} review saved (grade: ${result.selfGrade})`);

  // ── Gemma auto-debrief ───────────────────────────────────────────────
  // Fire-and-forget: generate a voice-layer debrief message and append it
  // to chatExchanges[] so the Film Room chat surfaces a post-market message
  // automatically. Any failure here is logged but MUST NOT fail the cron —
  // the Haiku review above is the critical path.
  try {
    if (!battle.agentId) {
      console.warn(`${LOG_PREFIX} Battle ${battle.id}: missing agentId, skipping auto-debrief`);
    } else {
      const agentDoc = await db.collection('agents').doc(battle.agentId).get();
      if (!agentDoc.exists) {
        console.warn(`${LOG_PREFIX} Battle ${battle.id}: agent ${battle.agentId} not found, skipping auto-debrief`);
      } else {
        const agent = { id: agentDoc.id, ...agentDoc.data() };

        // Include the freshly-written review in the set passed to the prompt.
        const updatedDailyReviews = [...(battle.dailyReviews || []), reviewEntry];
        const updatedBattle = { ...battle, dailyReviews: updatedDailyReviews };

        const systemPrompt = buildVoiceLayerPrompt({
          agent,
          battle: updatedBattle,
          conversationHistory: [],
          anchorContext: null,
          marketSnapshot: null,
          mode: 'review',
          dailyReviews: updatedDailyReviews,
          dailyGrades: battle.dailyGrades || {},
        });

        // 15s timeout via AbortController, matching api/agent/chat.js pattern.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15_000);
        let rawResponse;
        try {
          rawResponse = await callGemmaVoice({
            systemPrompt,
            conversationHistory: [],
            userMessage: '__REVIEW_START__',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const parsed = parseVoiceLayerResponse(rawResponse);
        const agentMessage = parsed.response;
        if (!agentMessage || typeof agentMessage !== 'string') {
          throw new Error('Gemma returned empty response');
        }

        // Minimal scratchpad coercion — preserves the internal rationale without
        // exposing the elicitation scaffolding used in live battle mode (the
        // debrief has no elicitation target, so this is mostly a length cap).
        const cleanScratchpad = parsed._scratchpad
          ? String(parsed._scratchpad).slice(0, 2000).trim() || null
          : null;

        // Append auto-debrief to chatExchanges[] using the EXISTING schema
        // (userMessage / agentResponse). The `isAutoDebrief` flag lets the
        // frontend distinguish system-initiated debriefs from user-prompted
        // exchanges without breaking AgentChat.jsx's existing loader.
        const exchange = {
          userMessage: '__REVIEW_START__',
          agentResponse: agentMessage,
          scratchpad: cleanScratchpad,
          hasDirective: false,
          directive: null,
          suggestedActions: parsed.suggestedActions || null,
          elicitationTarget: 'review_debrief',
          timestamp: new Date().toISOString(),
          mode: 'review',
          isAutoDebrief: true,
        };

        await battleRef.update({
          chatExchanges: FieldValue.arrayUnion(exchange),
        });

        // Persist any lesson / forge suggestion the debrief proposed to the
        // agent doc, mirroring api/agent/chat.js review-mode writes. These are
        // agent-level knowledge, not per-battle state.
        const lessonProposal = parsed._lesson;
        const lesson = (lessonProposal && typeof lessonProposal === 'object' && lessonProposal.text)
          ? {
              id: randomUUID(),
              text: String(lessonProposal.text).slice(0, 500),
              source: 'review_debrief',
              sourceGameId: battle.id,
              sourceTrade: lessonProposal.sourceTrade || null,
              createdAt: new Date().toISOString(),
              consumed: false,
              consumedInConsolidation: null,
            }
          : null;

        const forgeProposal = parsed._forgeSuggestion;
        const forgeSuggestion = (forgeProposal && typeof forgeProposal === 'object' && forgeProposal.text)
          ? {
              id: randomUUID(),
              text: String(forgeProposal.text).slice(0, 500),
              sourceGameId: battle.id,
              sourceTrade: forgeProposal.sourceTrade || null,
              createdAt: new Date().toISOString(),
              status: 'pending',
            }
          : null;

        if (lesson || forgeSuggestion) {
          const agentUpdate = {};
          if (lesson) agentUpdate.lessons = FieldValue.arrayUnion(lesson);
          if (forgeSuggestion) agentUpdate.forgeSuggestions = FieldValue.arrayUnion(forgeSuggestion);
          await db.collection('agents').doc(battle.agentId).update(agentUpdate);
        }

        console.log(`${LOG_PREFIX} Battle ${battle.id}: auto-debrief written to chatExchanges`);
      }
    }
  } catch (debriefErr) {
    // Non-fatal: Haiku review already persisted. Log and continue.
    console.warn(
      `${LOG_PREFIX} Battle ${battle.id}: auto-debrief failed (non-fatal): ${debriefErr?.message || debriefErr}`
    );
  }

  return { status: 'reviewed', grade: result.selfGrade, tradingDay: currentDay };
}

export default async function handler(req, res) {
  // ---- 1. Auth ----
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getFirebaseAdmin();
  const summary = { reviewed: 0, skipped: 0, errors: 0, details: [] };

  try {
    // ---- 2. Find all active battles ----
    const battles = await findActiveAgentBattles(db);

    if (battles.length === 0) {
      return res.status(200).json({ reviewed: 0, message: 'No active agent battles' });
    }

    console.log(`${LOG_PREFIX} Found ${battles.length} active agent battle(s)`);

    // ---- 3. Process each battle ----
    for (const battle of battles) {
      try {
        const result = await processBattleReview(db, battle);
        if (result.status === 'reviewed') {
          summary.reviewed++;
        } else {
          summary.skipped++;
        }
        summary.details.push({ battleId: battle.id, ...result });
      } catch (err) {
        console.error(`${LOG_PREFIX} Error reviewing battle ${battle.id}:`, err.message);
        summary.errors++;
        summary.details.push({ battleId: battle.id, status: 'error', error: err.message });
      }
    }

    // ---- 4. Return summary ----
    return res.status(200).json(summary);
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
