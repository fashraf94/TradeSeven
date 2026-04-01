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
import { flattenPortfolioServer } from '../_utils/agentScoring.js';

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

  // 4. Write self-reflection to agent.memory[] (rolling 5-game window)
  try {
    await writeMemoryReflection(db, agentRef, agentDoc, battleDoc, reflectionResult.selfReflection);
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

  // 6. Check if consolidation is due (every 5 games)
  try {
    const stats = agentDoc.stats || {};
    const gamesPlayed = stats.gamesPlayed || 0;
    if (gamesPlayed > 0 && gamesPlayed % 5 === 0) {
      await agentRef.update({ pendingConsolidation: true });
      console.log(`${LOG_PREFIX} Flagged agent ${battleDoc.agentId} for consolidation (game ${gamesPlayed})`);
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.3,
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
async function writeMemoryReflection(db, agentRef, agentDoc, battleDoc, selfReflection) {
  const scoreState = battleDoc.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  const opponentScore = scoreState.opponentScore || 0;
  const result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');

  const memoryEntry = {
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

  // Rolling 5-game window: keep last 4 + new entry
  const currentMemory = agentDoc.memory || [];
  const updatedMemory = [...currentMemory.slice(-4), memoryEntry];

  await agentRef.update({ memory: updatedMemory });
  console.log(`${LOG_PREFIX} Wrote memory reflection for agent ${agentDoc.id} (${updatedMemory.length} entries)`);
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
