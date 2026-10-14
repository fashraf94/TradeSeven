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
//
// Part 2 (P-OUT-2, founder rulings O5, O7, O9, 14 Oct 2026): an account-wide
// refusal is named on the record and, within the backstop, does not use up a
// try (O7); a game that finishes without a lesson leaves ONE honest no-lesson
// marker in the learning window (O9); the five-game consolidation runs only
// when that window holds MIN_REAL_LESSONS_FOR_CONSOLIDATION real lessons, and
// below it spends nothing — no call, no milestone, no pendingConsolidation (O5).
// See docs/audits/20261014_BUILD_REFLECTION_OUTAGE_FIX_2.md.

import Anthropic from '@anthropic-ai/sdk';
import {
  REFLECTION_TOOL,
  buildReflectionSystemPrompt,
  buildReflectionUserMessage,
} from '../_utils/agentReflectionUtils.js';
import { logReflection, logConsolidation } from '../_utils/shadowLogger.js';
import { consolidateAgentEvolution } from '../_utils/agentConsolidationApply.js';
import {
  REFLECTION_MODEL,
  REFLECTION_TIMEOUT_MS,
  REFLECTION_MAX_TOKENS,
  MAX_REFLECTION_ATTEMPTS,
  classifyReflectionError,
  isAccountWideRefusal,
  isCountedAttempt,
  errorNameOf,
  usageOf,
  buildReflectionOutcome,
} from '../_utils/reflectionOutcome.js';
import {
  isRealLesson,
  isNoLessonMarker,
  countRealLessons,
  MIN_REAL_LESSONS_FOR_CONSOLIDATION,
} from '../_utils/memoryLessons.js';
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
 *   { outcome: 'failed', record, counted [, deferToRecovery] }
 *                                  — no lesson was written and no consolidation
 *                                    ran; record.failureClass says why. counted
 *                                    false = an account-wide refusal within the
 *                                    backstop (O7): the try is not used up. When
 *                                    the game finishes without a lesson here (the
 *                                    third counted failure, or the recovery pass)
 *                                    its no-lesson marker is written (O9);
 *                                    deferToRecovery = a third attempt that could
 *                                    not write it, left for the recovery pass;
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

  // This game's REAL lesson in a window — a no-lesson marker never counts, so a
  // marker can never turn a later attempt into a success (O9) — and ANY entry
  // for this game (a marker, or a legacy failure line), which blocks a marker
  // exactly as the casual transaction does (review WR-9).
  const lessonRecordedIn = (memory) => (memory || []).some((m) => m?.gameId === battleId && isRealLesson(m));
  const gameRecordedIn = (memory) => (memory || []).some((m) => m?.gameId === battleId);

  // A retry after a success whose battle write was lost (or whose memory write
  // committed but reported an error): this game's lesson is already in the
  // window. No second call — it would only duplicate the lesson — but the
  // attempt is a success, and the consolidation gate below still runs (the
  // milestone claim keeps it to one run per milestone).
  let alreadyRecorded = lessonRecordedIn(learningDoc.memory);
  let record;
  if (alreadyRecorded) {
    console.log(`${LOG_PREFIX} Battle ${battleId}: lesson already recorded on agent ${learningDoc.id} — no new call`);
    record = buildReflectionOutcome({ outcome: 'ok', model: null, attempt, at: new Date().toISOString() });
  } else {
    // 3. Call Sonnet for reflection (never throws: a failure comes back named) —
    //    except on the cron's recovery pass for a battle whose attempts are all
    //    spent (modelCall false): no new call, and no lesson exists.
    if (!modelCall) console.warn(`${LOG_PREFIX} Battle ${battleId}: attempts spent and no lesson recorded — no new call`);
    const call = modelCall ? await callSonnetReflection(battleDoc, agentDoc) : null;
    let failure = !call
      ? { failureClass: 'unknown', errorName: null, accountWide: false }
      : (call.ok ? null : { failureClass: call.failureClass, errorName: call.errorName, accountWide: call.accountWide === true });
    let counted = true;
    let deferToRecovery = false;

    // 4. What this attempt writes into agent.memory[] (the rolling 5-game
    //    window) — at most ONE entry, through the existing memory writers
    //    (casual forward → the PARENT's window, transactional merge; else →
    //    this agent):
    //    • a usable answer → this game's lesson, exactly as before;
    //    • a failure that finishes the game without a lesson — the third
    //      COUNTED failure (O7), or the recovery pass — → the game's no-lesson
    //      marker (O9), looked up on a fresh read first, so it never lands
    //      beside a real lesson for this game and never twice;
    //    • any other failure → nothing (O3).
    let entry = call?.ok ? buildMemoryEntry(battleDoc, call.selfReflection) : null;
    let baseMemory = agentDoc.memory || [];
    if (failure) {
      counted = isCountedAttempt({ outcome: 'failed', accountWide: failure.accountWide }, { completedAt: battleDoc.completedAt, nowMs: Date.now() });
      if (!modelCall || (counted && attempt >= MAX_REFLECTION_ATTEMPTS)) {
        try {
          const freshSnap = await learningRef.get();
          const freshMemory = (freshSnap.exists ? freshSnap.data().memory : []) || [];
          if (lessonRecordedIn(freshMemory)) {
            // This game's lesson landed while the call ran — only a writer
            // running at the same time can do that (an earlier attempt's
            // write is found by the check above): the attempt is a success,
            // never a marker beside the lesson (review WR-4).
            console.warn(`${LOG_PREFIX} Battle ${battleId}: the call failed (${failure.failureClass}) but this game's lesson is already in the window — recorded as ok`);
            failure = null;
            alreadyRecorded = true;
          } else if (!gameRecordedIn(freshMemory)) {
            entry = buildNoLessonMarker(battleDoc);
            baseMemory = freshMemory;
          }
        } catch (err) {
          console.error(`${LOG_PREFIX} Battle ${battleId}: could not read the learning window for the no-lesson row:`, err?.message || err);
          deferToRecovery = modelCall;
        }
      }
    }
    if (entry) {
      try {
        if (isCasualForward) {
          await appendMemoryReflectionForwardTx(db, learningRef, entry);
        } else {
          await writeMemoryReflection(agentRef, agentDoc.id, baseMemory, entry);
        }
      } catch (err) {
        if (isNoLessonMarker(entry)) {
          console.error(`${LOG_PREFIX} Failed to write the no-lesson marker for battle ${battleId}:`, err.message);
        } else {
          // A lesson write that throws leaves no lesson: a failed attempt the cron retries.
          console.error(`${LOG_PREFIX} Failed to write memory for agent ${battleDoc.agentId}:`, err.message);
          failure = { failureClass: 'unknown', errorName: errorNameOf(err), accountWide: false };
        }
        // A third attempt that could not leave its row (the lesson or the
        // marker) waits one tick for the no-call recovery pass, which looks for
        // the lesson and writes the marker; that pass always finishes the battle.
        deferToRecovery = modelCall && attempt >= MAX_REFLECTION_ATTEMPTS;
      }
    }

    record = buildReflectionOutcome({
      outcome: failure ? 'failed' : 'ok',
      failureClass: failure?.failureClass ?? null,
      accountWide: failure?.accountWide === true,
      errorName: failure?.errorName ?? null,
      // A lesson found already recorded is an `ok` with no call metrics, like
      // the already-recorded path above — never the failed call's time and
      // tokens on a success (review WR-4).
      ...(call && !alreadyRecorded ? call.meta : { model: null }),
      attempt,
      at: new Date().toISOString(),
    });

    // Shadow log (fire-and-forget), mirroring the outcome record (O4), for an
    // attempt that made a call. The lesson travels only with a success; a
    // failure line carries no agent text.
    if (call) logReflection({
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
      selfReflection: !failure && call.ok ? call.selfReflection : null,
      ...record,
    }).catch(() => {});

    if (failure) {
      console.error(`${LOG_PREFIX} Reflection failed for battle ${battleId} (attempt ${attempt}${counted ? '' : ', not counted: account-wide refusal'}): ${record.failureClass}${record.errorName ? ` (${record.errorName})` : ''} after ${record.elapsedMs ?? '?'}ms — no lesson written`);
      return { outcome: 'failed', record, counted, ...(deferToRecovery ? { deferToRecovery: true } : {}) };
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
    // P-OUT-2 (O5) — the floor: counted on a FRESH read of the learning
    // target's window, the one this game's lesson has just joined, BEFORE the
    // milestone claim and the pendingConsolidation write. Below it nothing is
    // spent or written — no call, no claim, no flag — and the agent keeps its
    // current paragraph; one shadow line records the skip (counts, no text).
    // Known limit (review WR-3): if a second run on the SAME agent (a manual
    // run during a tick) lands a no-lesson marker between this read and the
    // driver's own re-read, the driver refuses but the milestone stays claimed;
    // the rewrite waits for the next milestone. No call is made.
    let belowFloor = false;
    if (gamesPlayed > 0 && gamesPlayed % 5 === 0) {
      const windowSnap = await learningRef.get();
      const window = (windowSnap.exists ? windowSnap.data().memory : []) || [];
      const realLessons = countRealLessons(window);
      if (realLessons < MIN_REAL_LESSONS_FOR_CONSOLIDATION) {
        belowFloor = true;
        console.log(`${LOG_PREFIX} consolidation at game ${gamesPlayed} skipped for agent ${learningDoc.id}: ${realLessons} real lesson(s) of ${window.length} in the window (floor ${MIN_REAL_LESSONS_FOR_CONSOLIDATION})`);
        logConsolidation({
          agentId: learningDoc.id,
          success: false,
          reason: 'insufficient_real_lessons',
          realLessons,
          totalEntries: window.length,
        }).catch(() => {});
      }
    }
    if (!belowFloor && gamesPlayed > 0 && gamesPlayed % 5 === 0) {
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
    return {
      ok: false,
      failureClass: classifyReflectionError(err, { timedOut }),
      // Our own deadline settles the race with ReflectionDeadlineError, which is
      // never an API refusal — so a timeout is never account-wide.
      accountWide: isAccountWideRefusal(err),
      errorName: errorNameOf(err),
      meta,
    };
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
// Pure: the game fields every window entry carries (gameId, gameMode, result,
// score, opponentScore) — shared by a lesson entry and a no-lesson marker.
function gameFieldsOf(battleDoc) {
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
  };
}

// Pure: the rolling-window memory entry for a completed battle. Extracted so the
// plain write and the casual transactional forward build the SAME entry.
function buildMemoryEntry(battleDoc, selfReflection) {
  return {
    ...gameFieldsOf(battleDoc),
    lesson: selfReflection.lesson || '',
    adjustment: selfReflection.adjustment || '',
    hypothesisGrades: selfReflection.hypothesisGrades || [],
    confidenceCalibration: selfReflection.confidenceCalibration || '',
    date: new Date().toISOString(),
  };
}

// Pure (P-OUT-2, O9): the no-lesson marker for a battle that finished without a
// lesson — the usual game fields, an empty lesson and noLesson: true. The
// timeline shows it as "No lesson was recorded for this game."; the
// consolidation filter and alreadyRecorded ignore it (memoryLessons.js).
function buildNoLessonMarker(battleDoc) {
  return {
    ...gameFieldsOf(battleDoc),
    lesson: '',
    noLesson: true,
    date: new Date().toISOString(),
  };
}

// The plain write into the rolling 5-game window (keep the last 4 + the new
// entry): this game's lesson on a success, or — P-OUT-2 (O9) — its no-lesson
// marker, on the window read just before (currentMemory).
async function writeMemoryReflection(agentRef, agentId, currentMemory, memoryEntry) {
  const updatedMemory = [...(currentMemory || []).slice(-4), memoryEntry];

  await agentRef.update({ memory: updatedMemory });
  console.log(`${LOG_PREFIX} Wrote memory ${isNoLessonMarker(memoryEntry) ? 'no-lesson marker' : 'reflection'} for agent ${agentId} (${updatedMemory.length} entries)`);
}

// Casual copy-forward of a reflection into the PARENT ranked agent's rolling
// memory window — TRANSACTIONAL, so the merge base is the parent's CURRENT memory
// (fresh read), never the clone's stale/empty memory, and a concurrent parent
// memory write is not clobbered (design lock: "copy-forward-with-merge → must
// merge, not clobber"). P-OUT-2 (O9): a no-lesson marker is appended only when
// the fresh window holds no entry at all for its game — never beside the
// game's lesson, never twice.
async function appendMemoryReflectionForwardTx(db, targetRef, memoryEntry) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(targetRef);
    const currentMemory = (snap.exists ? snap.data().memory : []) || [];
    if (isNoLessonMarker(memoryEntry) && currentMemory.some((m) => m?.gameId === memoryEntry.gameId)) return;
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
