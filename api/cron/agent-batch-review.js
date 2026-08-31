// api/cron/agent-batch-review.js
// End-of-day batch review cron for AI trading agents.
// Generates daily film-room reviews via Haiku around the 4:00 PM ET close.
// Fires at 20:25 and 21:25 UTC (collapsed pair covering EDT/EST). Both
// firings run; processBattleReview skips battles that already have a review
// for today's ET date, so the second firing is a per-battle no-op.
//
// Schedule: 25 20,21 * * 1-5

import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';

// P-6 (Command Center Sync Pass 1): completed battles still owed a debrief.
//
// WHY THIS EXISTS. This cron fires at 20:25 and 21:25 UTC and, until now,
// only ever looked at ACTIVE battles. completeBattle can land around 20:00
// UTC, so a fullday battle that expired just before the first run was already
// 'completed' when the query ran and was never reviewed at all — the
// Dashboard's POST_CLOSE card would show "debrief pending" indefinitely. That
// is the liveness half of P-6; the pending card without it would just be a
// prettier way to display a broken pipeline.
//
// SHAPE. Single-field equality, so Firestore auto-indexes it — no composite
// index and no schema deploy, unlike a `status == completed AND completedAt >=
// X` window, which none of the six existing agentBattles composite indexes
// serves. The flag is set by completeBattle (api/cron/agent-evaluate.js) and
// cleared in the same write that appends the review, so a crash between the
// two leaves the battle in the queue for the next run rather than dropping it.
//
// Bounded per run for the same reason process-pending-reflections is: this
// handler makes a model call per battle and runs on a cron budget. A backlog
// drains across runs.
export const REVIEW_PENDING_LIMIT = 5;

export async function findReviewPendingBattles(db) {
  const snapshot = await db
    .collection('agentBattles')
    .where('reviewPending', '==', true)
    .limit(REVIEW_PENDING_LIMIT)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
import { getCurrentTradingDayServer } from '../_utils/agentEvalPromptAssembly.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { renderLegacyDirectives } from '../_utils/legacyDirectiveSanitize.js';
// Per-Battle Loadout + Concurrency Phase 1 — DRB lessons attribution redirect:
// a casual-clone battle's lessons/forgeSuggestions belong to the PARENT ranked
// agent. arrayUnion is merge-safe, so a simple target re-key suffices; non-casual
// resolves to battle.agentId with no read (byte-identical).
import { resolveAttributionAgentId } from '../_utils/casualClone.js';

export const config = { maxDuration: 60 };

// Stop starting new reviews this far into the 60s budget. One review can cost
// ~30s (Haiku 15s + Gemma debrief 15s), so a run that begins one at :50 is
// killed mid-flight; better to defer it to the next tick with its queue flag
// intact.
const TIME_BUDGET_MS = 45_000;

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

/**
 * Leave the P-6 queue without having written a review.
 *
 * A skip is a TERMINAL outcome — "already reviewed" and "no activity" both mean
 * there is nothing left to do for this battle — so the flag must clear here too.
 * An earlier version cleared it only in the review write, which meant every
 * skipped battle stayed in the queue forever; five of those permanently starve
 * a limit-5 drain and no battle ever gets a debrief again. That is strictly
 * worse than the bug P-6 was written to fix.
 *
 * Failures are deliberately NOT drained: a thrown error leaves the flag set so
 * the next run retries, which is the whole point of a queue flag.
 */
export async function releaseReviewPending(db, battleId) {
  try {
    await db.collection('agentBattles').doc(battleId).update({ reviewPending: false });
  } catch (err) {
    // Non-fatal: the battle stays queued and the next run retries it.
    console.error(`${LOG_PREFIX} Battle ${battleId}: failed to clear reviewPending:`, err.message);
  }
}

export async function processBattleReview(db, battle, { clearReviewPending = false } = {}) {
  const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Which day's review would this be?
  //
  // For an ACTIVE battle it is today's. For a QUEUE-SOURCED (completed) battle
  // it is the day the battle ENDED — which is usually yesterday, because the
  // queue exists precisely for battles that completed after the day's last run.
  //
  // Deduping a completed battle against todayStr was a real defect: a battle
  // reviewed while still active on day D, completing overnight, would find no
  // review dated D+1 and be reviewed a SECOND time — a duplicate debrief, a
  // duplicate statusFeed beat, and a duplicate lesson arrayUnion'd onto the
  // agent doc, which feeds prompt assembly. A completed battle gets one final
  // debrief, keyed to its own last day.
  const reviewDate = (clearReviewPending && battle.completedAt)
    ? new Date(battle.completedAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    : todayStr;

  // Check if review already done
  if ((battle.dailyReviews || []).some(r => r.date === reviewDate)) {
    console.log(`${LOG_PREFIX} Battle ${battle.id}: review already exists for ${reviewDate}, skipping`);
    if (clearReviewPending) await releaseReviewPending(db, battle.id);
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
    if (clearReviewPending) await releaseReviewPending(db, battle.id);
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

  // Phase G — neutralize the write-dead legacy directives side-door when archetype
  // integrity is on (byte-identical when off; this source is in practice always
  // absent, but the sanitize guards against any future repopulation).
  const directiveLines = renderLegacyDirectives(battle.agentContext?.directives, (d) => `- ${d}`);

  const bankedBadgePoints = scoreState.bankedBadgePoints?.total ?? 0;
  const userMessage = `TODAY'S PERFORMANCE (Day ${currentDay}):
Score: ${scoreState.currentScore ?? 'N/A'} (Active: ${scoreState.activeScore ?? 'N/A'} + BankedTrades: ${scoreState.bankedScore ?? 'N/A'} + BankedBadges: ${bankedBadgePoints})
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
    // P-6: the queue flag clears in the SAME write that appends the review, so
    // a battle can never be dropped from the queue without having been
    // reviewed (the drain pattern process-pending-reflections.js:87-90 uses).
    // Only for queue-sourced battles: active battles never carried the flag,
    // and writing it onto them would put a completion field on a live doc.
    ...(clearReviewPending ? { reviewPending: false } : {}),
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

        // Append auto-debrief to chatExchanges[] using the typed-message schema
        // (Phase 1 Voice Layer Rework, spec §4.1). userMessage is null because
        // this is an agent-initiated exchange; messageType: 'auto_debrief'
        // identifies the type. isAutoDebrief: true is preserved as a defensive
        // read-fallback for any frontend path that still reads the legacy flag —
        // AgentChat.jsx reads messageType first and falls back to isAutoDebrief.
        const exchange = {
          userMessage: null,
          agentResponse: agentMessage,
          scratchpad: cleanScratchpad,
          hasDirective: false,
          directive: null,
          suggestedActions: parsed.suggestedActions || null,
          elicitationTarget: 'review_debrief',
          timestamp: new Date().toISOString(),
          mode: 'review',
          messageType: 'auto_debrief',
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
          // Phase 1 attribution redirect: casual-clone → parent, else self.
          const lessonTargetId = await resolveAttributionAgentId(db, battle);
          await db.collection('agents').doc(lessonTargetId).update(agentUpdate);
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

    // ---- 2b. P-6: drain the reviewPending queue ----
    // Additive, and deliberately a SECOND query rather than a change to
    // findActiveAgentBattles: that function lives in the §1-fenced
    // api/_utils/agentBattleService.js, and widening it there would be fence
    // contact. This one is local, single-field, and needs no composite index.
    const pending = await findReviewPendingBattles(db);
    if (pending.length > 0) {
      console.log(`${LOG_PREFIX} Found ${pending.length} completed battle(s) awaiting a debrief`);
    }

    if (battles.length === 0 && pending.length === 0) {
      return res.status(200).json({ reviewed: 0, message: 'No active agent battles' });
    }

    console.log(`${LOG_PREFIX} Found ${battles.length} active agent battle(s)`);

    // ---- 3. Process each battle ----
    // Queue-sourced battles run through the SAME review path; the only
    // difference is that their write also clears the flag.
    // De-duped: a battle that completes BETWEEN the two queries above appears in
    // both lists, and reviewing it twice would append two dailyReviews entries
    // for one day. The queue entry wins, because it is the one that also needs
    // its flag cleared.
    // The QUEUE GOES FIRST. One review can cost ~30s of the handler's 60s
    // maxDuration (a Haiku call with a 15s timeout, then a Gemma debrief with
    // another 15s), so whatever is last in this list may not run at all. A
    // queue entry is a battle that has ALREADY missed its debrief once; an
    // active battle gets another chance on the next tick.
    const seen = new Set();
    const work = [];
    for (const b of pending) { seen.add(b.id); work.push({ battle: b, clearReviewPending: true }); }
    for (const b of battles) { if (!seen.has(b.id)) work.push({ battle: b, clearReviewPending: false }); }

    // Stop STARTING new reviews once the handler is close to its budget, rather
    // than being killed mid-write. An unstarted battle keeps its flag (or stays
    // active) and is picked up next run — the queue is designed to drain across
    // runs.
    const deadline = Date.now() + TIME_BUDGET_MS;
    for (const { battle, clearReviewPending } of work) {
      if (Date.now() > deadline) {
        console.log(`${LOG_PREFIX} Time budget reached; ${work.length - summary.reviewed - summary.skipped - summary.errors} battle(s) deferred to the next run`);
        break;
      }
      try {
        const result = await processBattleReview(db, battle, { clearReviewPending });
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
