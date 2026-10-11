// api/agent/reflect.js
// Post-battle reflection: Sonnet analyzes battle history and produces a
// self-reflection (→ agent.memory[]).
//
// Called directly from the cron via generateReflection(db, battleId, { attempt }).
// Does NOT update agent stats (completeBattle handles that).
//
// Reflection outage fix (P-OUT-1, founder rulings O1–O4, 10 Oct 2026): the
// game-design questionnaire is no longer requested or written (O1); the call
// fits a measured budget and is CANCELLED when its deadline fires (O2); a
// failed call is never saved as a lesson — nothing is written and the result
// says why, so the cron can retry with a cap (O3) and record the outcome (O4).

import Anthropic from '@anthropic-ai/sdk';
import {
  REFLECTION_TOOL,
  buildReflectionSystemPrompt,
  buildReflectionUserMessage,
} from '../_utils/agentReflectionUtils.js';
import { logReflection } from '../_utils/shadowLogger.js';
import { consolidateAgentEvolution } from '../_utils/agentConsolidationApply.js';
import {
  REFLECTION_MODEL,
  REFLECTION_TIMEOUT_MS,
  REFLECTION_MAX_TOKENS,
  classifyReflectionError,
  errorNameOf,
  usageOf,
  buildReflectionOutcome,
} from '../_utils/reflectionOutcome.js';
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
 * Returns what happened, for the cron to record on the battle:
 *   { outcome: 'ok', record }      — the lesson is in memory (exactly as before;
 *                                    or already was: reason 'already_recorded');
 *   { outcome: 'failed', record }  — NOTHING was written (no memory entry, no
 *                                    consolidation); record.failureClass says why;
 *   { outcome: 'skipped', reason } — nothing to reflect (battle or agent gone).
 *
 * @param {FirebaseFirestore.Firestore} db - Firebase Admin Firestore instance
 * @param {string} battleId - The agentBattles document ID
 * @param {{ attempt?: number, modelCall?: boolean }} [opts] - the attempt number
 *   the cron claimed; modelCall false = the cron's recovery pass for a battle
 *   whose attempts are spent (look for a landed lesson, never call the model)
 */
export async function generateReflection(db, battleId, { attempt = 1, modelCall = true } = {}) {
  console.log(`${LOG_PREFIX} Starting reflection for battle ${battleId} (attempt ${attempt})`);

  // 1. Read battle document
  const battleRef = db.collection('agentBattles').doc(battleId);
  const battleSnap = await battleRef.get();
  if (!battleSnap.exists) {
    console.warn(`${LOG_PREFIX} Battle ${battleId} not found, skipping reflection`);
    return { outcome: 'skipped', reason: 'battle_missing' };
  }
  const battleDoc = { id: battleSnap.id, ...battleSnap.data() };

  if (battleDoc.status !== 'completed') {
    console.warn(`${LOG_PREFIX} Battle ${battleId} is not completed (status: ${battleDoc.status}), skipping reflection`);
    return { outcome: 'skipped', reason: 'not_completed' };
  }

  // 2. Read agent document (for writing memory[] and checking gamesPlayed)
  const agentRef = db.collection('agents').doc(battleDoc.agentId);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) {
    console.warn(`${LOG_PREFIX} Agent ${battleDoc.agentId} not found, skipping reflection`);
    return { outcome: 'skipped', reason: 'agent_missing' };
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

  // A retry after a success whose battle write was lost (or whose memory write
  // committed but reported an error): this game's lesson is already in the
  // window. No second call — it would only duplicate the lesson — but the
  // attempt is a success, and the consolidation gate below still runs (the
  // milestone claim keeps it to one run per milestone).
  const alreadyRecorded = (learningDoc.memory || []).some((m) => m?.gameId === battleId);
  let record;
  if (alreadyRecorded) {
    console.log(`${LOG_PREFIX} Battle ${battleId}: lesson already recorded on agent ${learningDoc.id} — no new call`);
    record = buildReflectionOutcome({ outcome: 'ok', model: null, attempt, at: new Date().toISOString() });
  } else if (!modelCall) {
    // The cron's recovery pass for a battle whose attempts are all spent and
    // whose last attempt left no record: no new call, and no lesson exists.
    console.warn(`${LOG_PREFIX} Battle ${battleId}: attempts spent and no lesson recorded — no new call`);
    return { outcome: 'failed', record: buildReflectionOutcome({ outcome: 'failed', failureClass: 'unknown', model: null, attempt, at: new Date().toISOString() }) };
  } else {
    // 3. Call Sonnet for reflection. Never throws: a failure comes back named.
    const call = await callSonnetReflection(battleDoc, agentDoc);
    let failure = call.ok ? null : { failureClass: call.failureClass, errorName: call.errorName };

    // 4. Write self-reflection to agent.memory[] (rolling 5-game window) — ONLY on
    //    a usable answer; a failure writes nothing (O3). Casual forward → the
    //    PARENT's window (transactional merge); else → this agent. A write that
    //    throws leaves no lesson, so it is a failed attempt the cron retries.
    if (!failure) {
      try {
        if (isCasualForward) {
          await appendMemoryReflectionForwardTx(db, learningRef, buildMemoryEntry(battleDoc, call.selfReflection));
        } else {
          await writeMemoryReflection(db, agentRef, agentDoc, battleDoc, call.selfReflection);
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Failed to write memory for agent ${battleDoc.agentId}:`, err.message);
        failure = { failureClass: 'unknown', errorName: errorNameOf(err) };
      }
    }

    record = buildReflectionOutcome({
      outcome: failure ? 'failed' : 'ok',
      failureClass: failure?.failureClass ?? null,
      errorName: failure?.errorName ?? null,
      ...call.meta,
      attempt,
      at: new Date().toISOString(),
    });

    // Shadow log (fire-and-forget), mirroring the outcome record (O4). The
    // lesson travels only with a success; a failure line carries no agent text.
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
      selfReflection: failure ? null : call.selfReflection,
      ...record,
    }).catch(() => {});

    if (failure) {
      console.error(`${LOG_PREFIX} Reflection failed for battle ${battleId} (attempt ${attempt}): ${record.failureClass}${record.errorName ? ` (${record.errorName})` : ''} after ${record.elapsedMs ?? '?'}ms — nothing written`);
      return { outcome: 'failed', record };
    }
  }

  // 5. Check if consolidation is due (every 5 games). Sprint 1 — Dossier funnel:
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
        // already succeeded (the memory entry is written by this point, so
        // the outcome stays 'ok': a retry would only duplicate the lesson).
        // pendingConsolidation stays true; the next 5-game gate
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
  return alreadyRecorded ? { outcome: 'ok', record, reason: 'already_recorded' } : { outcome: 'ok', record };
}

// ==================== SONNET CALL ====================

class ReflectionDeadlineError extends Error {
  constructor() {
    super(`Sonnet reflection deadline (${REFLECTION_TIMEOUT_MS / 1000}s)`);
    this.name = 'ReflectionDeadlineError';
  }
}

/**
 * One reflection call. NEVER throws — resolves to
 *   { ok: true, selfReflection, meta } or { ok: false, failureClass, errorName, meta }
 * where meta = { elapsedMs, stopReason, usage, model }.
 *
 * The deadline both ABORTS the request (so an abandoned call is cancelled, not
 * left running and billed) and settles the race: the SDK links the signal into
 * the in-flight fetch and its body read, but not into a retry's backoff sleep,
 * so during a backoff the race is what returns on time. A timeout is
 * classified by our own fired flag.
 */
async function callSonnetReflection(battleDoc, agentDoc) {
  const meta = { elapsedMs: null, stopReason: null, usage: null, model: REFLECTION_MODEL };
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  let timer = null;
  let response;
  try {
    const anthropic = getAnthropicClient();
    const systemPrompt = buildReflectionSystemPrompt();
    const userMessage = buildReflectionUserMessage(battleDoc, agentDoc);
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new ReflectionDeadlineError()); // settles the race first …
        controller.abort();                    // … then cancels the request
      }, REFLECTION_TIMEOUT_MS);
    });
    response = await Promise.race([
      anthropic.messages.create({
        model: REFLECTION_MODEL,
        max_tokens: REFLECTION_MAX_TOKENS,
        temperature: 0.3,
        // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
        // preserve the prior Sonnet-4 (no-thinking) latency profile.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [REFLECTION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_reflection' },
      }, { signal: controller.signal }),
      deadline,
    ]);
  } catch (err) {
    meta.elapsedMs = Date.now() - startedAt;
    return { ok: false, failureClass: classifyReflectionError(err, { timedOut }), errorName: errorNameOf(err), meta };
  } finally {
    clearTimeout(timer);
  }

  meta.elapsedMs = Date.now() - startedAt;
  meta.stopReason = typeof response?.stop_reason === 'string' ? response.stop_reason : null;
  meta.usage = usageOf(response?.usage);
  if (typeof response?.model === 'string' && response.model) meta.model = response.model;

  // An answer cut off at the token ceiling is a named failure — never parsed.
  if (meta.stopReason === 'max_tokens') {
    return { ok: false, failureClass: 'max_tokens', errorName: null, meta };
  }

  // Under the forced tool choice a completed answer IS stop_reason 'tool_use'.
  // Anything else (refusal, end_turn, pause_turn, a context cut …) is not a
  // completed tool call, even if a tool block came back: named no_tool_use,
  // with the stop reason on the record, and never parsed.
  if (meta.stopReason !== 'tool_use') {
    return { ok: false, failureClass: 'no_tool_use', errorName: null, meta };
  }

  // Extract tool use result
  const toolUse = response?.content?.find?.(c => c.type === 'tool_use');
  if (!toolUse?.input) {
    return { ok: false, failureClass: 'no_tool_use', errorName: null, meta };
  }

  // Validate the required key: a self-reflection carrying a lesson.
  const selfReflection = toolUse.input.selfReflection;
  if (!selfReflection || typeof selfReflection !== 'object'
    || typeof selfReflection.lesson !== 'string' || !selfReflection.lesson.trim()) {
    return { ok: false, failureClass: 'missing_keys', errorName: null, meta };
  }

  return { ok: true, selfReflection, meta };
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
