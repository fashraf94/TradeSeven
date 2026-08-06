// api/agent/reflect.js
// Post-battle reflection: Sonnet analyzes battle history and produces
// self-reflection (→ agent.memory[]) and game design feedback (→ gameDesignFeedback collection).
//
// Called directly from the cron via generateReflection(db, battleId).
// Does NOT update agent stats (completeBattle handles that).

import Anthropic from '@anthropic-ai/sdk';
import {
  REFLECTION_TOOL,
  buildReflectionSystemPrompt,
  buildReflectionUserMessage,
} from '../_utils/agentReflectionUtils.js';
import { CURRENT_SCHEMA_VERSION, getCategoriesForMode } from '../_utils/gameDesignCategoryConfig.js';
import { logReflection } from '../_utils/shadowLogger.js';
import { flattenPortfolioServer } from '../_utils/agentScoring.js';
import { consolidateAgentEvolution } from '../_utils/agentConsolidationApply.js';
// Per-Battle Loadout + Concurrency Phase 1 — learning attribution redirect: a
// casual-clone battle's memory + consolidation belong to the PARENT ranked agent.
// resolveRecordTargetId is pure (the clone doc is already read as agentDoc); the
// forward writes merge transactionally so a concurrent parent write is not lost.
import { resolveRecordTargetId } from '../_utils/casualClone.js';
// Ruling 1 (consolidation milestone-claim): gated so it is INERT when no casual
// clone can exist (flag off) — flag-off behavioral equivalence, not literal
// byte-identity (the agent doc gains lastConsolidatedGamesPlayed only on the
// guarded path). featureFlags.js is Node-clean (BUILD_RULES §4).
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../../src/config/featureFlags.js';

const LOG_PREFIX = '[REFLECT]';

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

// ==================== MAIN ENTRY POINT ====================

/**
 * Generate post-battle reflection for a completed agent battle.
 * Called from the cron after completeBattle() finishes.
 *
 * @param {FirebaseFirestore.Firestore} db - Firebase Admin Firestore instance
 * @param {string} battleId - The agentBattles document ID
 */
export async function generateReflection(db, battleId) {
  console.log(`${LOG_PREFIX} Starting reflection for battle ${battleId}`);

  // 1. Read battle document
  const battleRef = db.collection('agentBattles').doc(battleId);
  const battleSnap = await battleRef.get();
  if (!battleSnap.exists) {
    console.warn(`${LOG_PREFIX} Battle ${battleId} not found, skipping reflection`);
    return;
  }
  const battleDoc = { id: battleSnap.id, ...battleSnap.data() };

  if (battleDoc.status !== 'completed') {
    console.warn(`${LOG_PREFIX} Battle ${battleId} is not completed (status: ${battleDoc.status}), skipping reflection`);
    return;
  }

  // 2. Read agent document (for writing memory[] and checking gamesPlayed)
  const agentRef = db.collection('agents').doc(battleDoc.agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) {
    console.warn(`${LOG_PREFIX} Agent ${battleDoc.agentId} not found, skipping reflection`);
    return;
  }
  const agentDoc = { id: agentSnap.id, ...agentSnap.data() };

  // Phase 1 learning attribution redirect: a BaggerBomb battle runs on the
  // persistent casual clone, but its memory + consolidation belong to the PARENT
  // ranked agent. Resolve the target from the clone doc (agentDoc); for a
  // non-casual battle learningRef === agentRef and learningDoc === agentDoc, so
  // the memory write + consolidation gate below are byte-identical.
  let learningRef = agentRef;
  let learningDoc = agentDoc;
  const recordTargetId = resolveRecordTargetId(battleDoc.agentId, agentDoc);
  if (recordTargetId !== battleDoc.agentId) {
    const parentSnap = await db.collection('agents').doc(recordTargetId).get();
    // Security guard (review CONFIRMED-1): only forward learning to a target owned
    // by the CLONE's owner — a squat with a poisoned rankedAgentId must never write
    // memory/lessons onto a victim. Same-owner is a legit-clone invariant.
    if (parentSnap.exists && parentSnap.data().ownerId === agentDoc.ownerId) {
      learningRef = db.collection('agents').doc(recordTargetId);
      learningDoc = { id: parentSnap.id, ...parentSnap.data() };
    } else {
      console.warn(`${LOG_PREFIX} casual learning redirect refused for battle ${battleId} — parent ${recordTargetId} missing or not same-owner; memory/consolidation stay on the clone`);
    }
  }
  const isCasualForward = learningRef !== agentRef;

  // 3. Call Sonnet for reflection
  let reflectionResult = null;
  try {
    reflectionResult = await callSonnetReflection(battleDoc, agentDoc);
  } catch (err) {
    console.error(`${LOG_PREFIX} Sonnet call failed for battle ${battleId}:`, err.message);
    // Write minimal fallback reflection
    reflectionResult = {
      selfReflection: {
        lesson: 'Reflection generation failed.',
        adjustment: 'N/A',
        hypothesisGrades: [],
        confidenceCalibration: 'N/A',
      },
      gameDesignFeedback: null,
    };
  }

  // Shadow log (fire-and-forget)
  logReflection({
    battleId,
    agentId: battleDoc.agentId,
    userId: battleDoc.ownerId || null,
    archetype: agentDoc.archetype || null,
    gameMode: battleDoc.gameMode || null,
    score: {
      current: battleDoc.scoreState?.currentScore || 0,
      opponent: battleDoc.scoreState?.opponentScore || 0,
    },
    turnCount: (battleDoc.chatExchanges || []).length,
    tradeCount: (battleDoc.trades || []).length,
    evaluationCount: (battleDoc.evaluations || []).length,
    selfReflection: reflectionResult.selfReflection || null,
    gameDesignFeedback: reflectionResult.gameDesignFeedback || null,
  }).catch(() => {});

  // 4. Write self-reflection to agent.memory[] (rolling 5-game window). Casual
  //    forward → the PARENT's window (transactional merge); else → this agent.
  try {
    if (isCasualForward) {
      await appendMemoryReflectionForwardTx(db, learningRef, buildMemoryEntry(battleDoc, reflectionResult.selfReflection));
    } else {
      await writeMemoryReflection(db, agentRef, agentDoc, battleDoc, reflectionResult.selfReflection);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to write memory for agent ${battleDoc.agentId}:`, err.message);
  }

  // 5. Write game design feedback to collection
  if (reflectionResult.gameDesignFeedback) {
    try {
      await writeGameDesignFeedback(db, battleDoc, agentDoc, reflectionResult.gameDesignFeedback);
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to write game design feedback for battle ${battleId}:`, err.message);
    }
  }

  // 6. Check if consolidation is due (every 5 games). Sprint 1 — Dossier funnel:
  //    consolidation is the ONLY writer of agent.disciplines. The driver re-reads
  //    the agent doc internally so it sees the just-written memory entry, then
  //    calls Sonnet, validates, and applies via a single atomic update.
  //    Awaited (post-Sprint-1-fix): generateReflection itself is now invoked
  //    from the process-pending-reflections cron, which awaits this function
  //    on its own maxDuration budget. Awaiting consolidation here keeps the
  //    full reflection→consolidation chain inside one cron iteration, so the
  //    funnel writes are not subject to the same lambda-freeze race that
  //    motivated the cron split.
  try {
    // Casual forward: gate on the PARENT's gamesPlayed (the settlement redirect
    // increments the parent, not the clone) and consolidate the PARENT with a
    // TRANSACTIONAL apply. Non-casual: this agent, plain apply — byte-identical.
    const stats = learningDoc.stats || {};
    const gamesPlayed = stats.gamesPlayed || 0;
    if (gamesPlayed > 0 && gamesPlayed % 5 === 0) {
      // Ruling 1 — milestone-claim: when the feature is ON, only the reflection
      // that first stamps lastConsolidatedGamesPlayed=gamesPlayed consolidates, so
      // two reflections at the same %5 milestone (a casual settlement + a ranked
      // reflection, both targeting the parent) cannot both fire (evolutionCycle
      // double-increment). INERT when off — no claim, and no casual clone exists,
      // so the parent's counter has a single writer exactly as before.
      const wonMilestone = CASUAL_CLONE_CONCURRENCY_ENABLED
        ? await claimConsolidationMilestone(db, learningRef, gamesPlayed)
        : true;
      if (!wonMilestone) {
        console.log(`${LOG_PREFIX} consolidation milestone ${gamesPlayed} already claimed for agent ${learningDoc.id} — skipping duplicate`);
      } else {
      await learningRef.update({ pendingConsolidation: true });
      console.log(`${LOG_PREFIX} Flagged agent ${learningDoc.id} for consolidation (game ${gamesPlayed})`);

      try {
        await consolidateAgentEvolution(db, learningRef, { transactionalApply: isCasualForward });
      } catch (consolidationErr) {
        // Consolidation failure must not propagate up — reflection itself
        // already succeeded (memory and gameDesignFeedback are written by
        // this point). pendingConsolidation stays true; the next 5-game gate
        // will retry. Logged for shadow-trace visibility.
        console.error(
          `${LOG_PREFIX} Consolidation failed for agent ${battleDoc.agentId}:`,
          consolidationErr?.message || consolidationErr,
        );
      }
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to check consolidation for agent ${battleDoc.agentId}:`, err.message);
  }

  console.log(`${LOG_PREFIX} Reflection complete for battle ${battleId}`);
}

// ==================== SONNET CALL ====================

async function callSonnetReflection(battleDoc, agentDoc) {
  const anthropic = getAnthropicClient();

  const systemPrompt = buildReflectionSystemPrompt();
  const userMessage = buildReflectionUserMessage(battleDoc, agentDoc);

  const response = await Promise.race([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.3,
      // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
      // preserve the prior Sonnet-4 (no-thinking) latency profile.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [REFLECTION_TOOL],
      tool_choice: { type: 'tool', name: 'submit_reflection' },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Sonnet reflection timeout (30s)')), 30_000)),
  ]);

  // Extract tool use result
  const toolUse = response.content?.find(c => c.type === 'tool_use');
  if (!toolUse?.input) {
    throw new Error('Sonnet did not use submit_reflection tool');
  }

  const result = toolUse.input;

  // Validate required keys
  if (!result.selfReflection || !result.gameDesignFeedback) {
    throw new Error('Reflection response missing required keys (selfReflection or gameDesignFeedback)');
  }

  return result;
}

// ==================== FIRESTORE WRITES ====================

/**
 * Write self-reflection to agent.memory[] with rolling 5-game window.
 * Uses Admin SDK directly — not the client-side agentService.js.
 */
// Pure: the rolling-window memory entry for a completed battle. Extracted so the
// plain write and the casual transactional forward build the SAME entry.
function buildMemoryEntry(battleDoc, selfReflection) {
  const scoreState = battleDoc.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  const opponentScore = scoreState.opponentScore || 0;
  const result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');
  return {
    gameId: battleDoc.id,
    gameMode: battleDoc.gameMode || 'baggerbomb',
    result,
    score: Math.round(currentScore * 100) / 100,
    opponentScore: Math.round(opponentScore * 100) / 100,
    lesson: selfReflection.lesson || '',
    adjustment: selfReflection.adjustment || '',
    hypothesisGrades: selfReflection.hypothesisGrades || [],
    confidenceCalibration: selfReflection.confidenceCalibration || '',
    date: new Date().toISOString(),
  };
}

async function writeMemoryReflection(db, agentRef, agentDoc, battleDoc, selfReflection) {
  const memoryEntry = buildMemoryEntry(battleDoc, selfReflection);
  // Rolling 5-game window: keep last 4 + new entry
  const currentMemory = agentDoc.memory || [];
  const updatedMemory = [...currentMemory.slice(-4), memoryEntry];

  await agentRef.update({ memory: updatedMemory });
  console.log(`${LOG_PREFIX} Wrote memory reflection for agent ${agentDoc.id} (${updatedMemory.length} entries)`);
}

// Casual copy-forward of a reflection into the PARENT ranked agent's rolling
// memory window — TRANSACTIONAL, so the merge base is the parent's CURRENT memory
// (fresh read), never the clone's stale/empty memory, and a concurrent parent
// memory write is not clobbered (design lock: "copy-forward-with-merge → must
// merge, not clobber").
async function appendMemoryReflectionForwardTx(db, targetRef, memoryEntry) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(targetRef);
    const currentMemory = (snap.exists ? snap.data().memory : []) || [];
    const updatedMemory = [...currentMemory.slice(-4), memoryEntry];
    tx.update(targetRef, { memory: updatedMemory });
  });
}

// Ruling 1: transactionally CLAIM a consolidation milestone so the (now SHARED)
// parent gamesPlayed counter is consolidated at most ONCE per %5 value. Only the
// caller that first stamps lastConsolidatedGamesPlayed=gamesPlayed wins (returns
// true); a duplicate reflection at the same milestone sees it and returns false,
// preventing the evolutionCycle double-increment the RECORD redirect makes
// reachable (a casual settlement + a ranked reflection both landing on the same
// %5). Exported for the unit battery.
export async function claimConsolidationMilestone(db, agentRef, gamesPlayed) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(agentRef);
    const data = snap.exists ? snap.data() : {};
    if (data.lastConsolidatedGamesPlayed === gamesPlayed) return false;
    tx.update(agentRef, { lastConsolidatedGamesPlayed: gamesPlayed });
    return true;
  });
}

/**
 * Write game design feedback to the gameDesignFeedback collection.
 * Server-populated fields ensure data integrity.
 */
async function writeGameDesignFeedback(db, battleDoc, agentDoc, feedback) {
  const scoreState = battleDoc.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  const opponentScore = scoreState.opponentScore || 0;
  const battleResult = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');

  const gameMode = battleDoc.gameMode || 'baggerbomb';
  const categoryConfig = getCategoriesForMode(gameMode);

  // Extract asset tickers from portfolio
  const flatPortfolio = flattenPortfolioServer(battleDoc.portfolio);
  const assetContext = flatPortfolio.map(a => a.symbol).filter(Boolean);

  const feedbackDoc = {
    // Server-populated metadata (not from AI response)
    schemaVersion: CURRENT_SCHEMA_VERSION,
    gameMode,
    battleId: battleDoc.id,
    agentId: battleDoc.agentId,
    ownerId: battleDoc.ownerId,
    agentArchetype: battleDoc.agentContext?.archetype || agentDoc?.archetype || 'unknown',
    battleResult,
    opponentType: 'bot_random',
    assetContext,
    duration: battleDoc.duration || 'unknown',
    finalScore: Math.round(currentScore * 100) / 100,
    finalOpponentScore: Math.round(opponentScore * 100) / 100,
    createdAt: new Date().toISOString(),

    // AI-generated category ratings (validated by Tool Use schema)
    categories: {},
    mechanicHighlight: feedback.mechanicHighlight || '',
    mechanicFriction: feedback.mechanicFriction || '',
    wouldPlayAgain: feedback.wouldPlayAgain ?? true,
  };

  // Extract category ratings from feedback
  for (const categoryKey of categoryConfig.categories) {
    const categoryData = feedback[categoryKey];
    if (categoryData) {
      feedbackDoc.categories[categoryKey] = {
        rating: Math.max(1, Math.min(5, categoryData.rating || 3)),
        observation: categoryData.observation || '',
        suggestion: categoryData.suggestion || null,
      };
    }
  }

  await db.collection('gameDesignFeedback').add(feedbackDoc);
  console.log(`${LOG_PREFIX} Wrote game design feedback for battle ${battleDoc.id}`);
}
