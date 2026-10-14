// api/_utils/agentConsolidationApply.js
// Validator + applyConsolidation + driver for the Sonnet-driven consolidation
// writer. Funnel principle: this is the ONLY writer of agent.disciplines.
//
// Memory is NOT touched here. Lessons are flagged consumed but not removed.
//
// Reflection outage fix, part 2 (P-OUT-2, founder rulings O5 and O8, 14 Oct
// 2026; build report docs/audits/20261014_BUILD_REFLECTION_OUTAGE_FIX_2.md):
//   • the driver re-checks the floor on its own re-read — fewer than
//     MIN_REAL_LESSONS_FOR_CONSOLIDATION real lessons → it returns
//     { success: false, reason: 'insufficient_real_lessons' } and writes nothing;
//   • the call gets the part-1 fix (api/agent/reflect.js callSonnetReflection):
//     an AbortController signal CANCELS it when our deadline fires; only
//     stop_reason 'tool_use' is parsed; 'max_tokens' is a named failure;
//   • the shadow line carries the part-1 vocabulary (reflectionOutcome.js) —
//     outcome, failureClass, accountWide, errorName, elapsedMs, stopReason,
//     usage, model — and no agent text on any failure.

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { SUBMIT_CONSOLIDATION_TOOL } from './agentConsolidationToolSchema.js';
import { buildConsolidationPrompt } from './agentConsolidationPrompt.js';
import { logConsolidation } from './shadowLogger.js';
import { countRealLessons, MIN_REAL_LESSONS_FOR_CONSOLIDATION } from './memoryLessons.js';
import { classifyReflectionError, isAccountWideRefusal, errorNameOf, usageOf } from './reflectionOutcome.js';

const LOG_PREFIX = '[CONSOLIDATION]';
const SONNET_MODEL = 'claude-sonnet-4-6';
// Chosen by measurement (P-OUT-2, O8): four calls with the filtered request on
// the real windows holding the most real lessons (3, 2, 2, 2) ran 25.6–36.1 s
// for 1,131–1,655 output tokens, all valid tool calls — the old 30 s race would
// have cut off two of the four. Deadline >= 1.5x the slowest call (54.1 s);
// ceiling >= 2x the largest answer (3,310). At the measured ~50 tokens a
// second, 60 s writes under 4,096, so a runaway answer is named timeout.
export const CONSOLIDATION_TIMEOUT_MS = 60_000;
export const CONSOLIDATION_MAX_TOKENS = 4096;

// Word-count thresholds. Soft = target; hard = validation failure.
const INSIGHT_HARD_LIMIT_WORDS = 400;
const NARRATIVE_HARD_LIMIT_WORDS = 300;
const HEADLINE_HARD_LIMIT_CHARS = 80;
const STATEMENT_HARD_LIMIT_CHARS = 250; // statement spec is ≤200; allow some slack

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

// ==================== VALIDATION ====================

/**
 * Hand-rolled validator for the consolidation tool output. Mirrors the pattern
 * in agentSwapExecution.js — returns { valid, errors }.
 *
 * @param {object} output - the tool_use.input from Sonnet
 * @param {object} agent - the post-reflection agent doc
 */
export function validateConsolidationOutput(output, agent) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['output is not an object'] };
  }

  // --- Top-level required keys ---
  const requiredTopLevel = [
    'disciplines',
    'consolidatedInsightText',
    'cycleNarrative',
    'evolutionEvent',
    'lessonsAbsorbed',
    'lessonsCarriedForward',
    'cycleSummary',
  ];
  for (const key of requiredTopLevel) {
    if (!(key in output)) errors.push(`missing required key: ${key}`);
  }

  // --- Disciplines ---
  if (output.disciplines && typeof output.disciplines === 'object') {
    if (!Array.isArray(output.disciplines.selection)) {
      errors.push('disciplines.selection must be an array');
    } else {
      output.disciplines.selection.forEach((d, i) =>
        validateDiscipline(d, 'selection', i, errors),
      );
    }
    if (!Array.isArray(output.disciplines.execution)) {
      errors.push('disciplines.execution must be an array');
    } else {
      output.disciplines.execution.forEach((d, i) =>
        validateDiscipline(d, 'execution', i, errors),
      );
    }
  } else if (output.disciplines !== undefined) {
    errors.push('disciplines must be an object');
  }

  // --- Text length checks ---
  if (typeof output.consolidatedInsightText === 'string') {
    const wc = countWords(output.consolidatedInsightText);
    if (wc > INSIGHT_HARD_LIMIT_WORDS) {
      errors.push(`consolidatedInsightText exceeds hard limit (${wc} > ${INSIGHT_HARD_LIMIT_WORDS} words)`);
    }
  } else if (output.consolidatedInsightText !== undefined) {
    errors.push('consolidatedInsightText must be a string');
  }

  if (typeof output.cycleNarrative === 'string') {
    const wc = countWords(output.cycleNarrative);
    if (wc > NARRATIVE_HARD_LIMIT_WORDS) {
      errors.push(`cycleNarrative exceeds hard limit (${wc} > ${NARRATIVE_HARD_LIMIT_WORDS} words)`);
    }
  } else if (output.cycleNarrative !== undefined) {
    errors.push('cycleNarrative must be a string');
  }

  // --- Evolution event ---
  if (output.evolutionEvent && typeof output.evolutionEvent === 'object') {
    const { headline, narrative } = output.evolutionEvent;
    if (typeof headline !== 'string' || headline.trim().length === 0) {
      errors.push('evolutionEvent.headline must be a non-empty string');
    } else if (headline.length > HEADLINE_HARD_LIMIT_CHARS) {
      errors.push(`evolutionEvent.headline exceeds hard limit (${headline.length} > ${HEADLINE_HARD_LIMIT_CHARS} chars)`);
    }
    if (typeof narrative !== 'string' || narrative.trim().length === 0) {
      errors.push('evolutionEvent.narrative must be a non-empty string');
    }
  } else if (output.evolutionEvent !== undefined) {
    errors.push('evolutionEvent must be an object');
  }

  // --- Lesson IDs ---
  const knownLessonIds = new Set((agent?.lessons || []).map(l => l?.id).filter(Boolean));
  const consumedLessonIds = new Set(
    (agent?.lessons || []).filter(l => l?.consumed === true).map(l => l?.id).filter(Boolean),
  );

  validateLessonIdArray(
    output.lessonsAbsorbed,
    'lessonsAbsorbed',
    knownLessonIds,
    consumedLessonIds,
    errors,
  );
  validateLessonIdArray(
    output.lessonsCarriedForward,
    'lessonsCarriedForward',
    knownLessonIds,
    consumedLessonIds,
    errors,
  );

  // --- Cycle summary ---
  if (output.cycleSummary && typeof output.cycleSummary === 'object') {
    const { cyclesCompleted, keyShift, confidenceLevel } = output.cycleSummary;
    if (!Number.isInteger(cyclesCompleted) || cyclesCompleted < 1) {
      errors.push('cycleSummary.cyclesCompleted must be a positive integer');
    }
    if (typeof keyShift !== 'string' || keyShift.trim().length === 0) {
      errors.push('cycleSummary.keyShift must be a non-empty string');
    } else if (keyShift.length > 100) {
      errors.push(`cycleSummary.keyShift exceeds hard limit (${keyShift.length} > 100 chars)`);
    }
    if (!['forming', 'consolidating', 'crystallized'].includes(confidenceLevel)) {
      errors.push(`cycleSummary.confidenceLevel must be one of forming|consolidating|crystallized (got ${confidenceLevel})`);
    }
  } else if (output.cycleSummary !== undefined) {
    errors.push('cycleSummary must be an object');
  }

  return { valid: errors.length === 0, errors };
}

function validateDiscipline(d, expectedCategory, index, errors) {
  const prefix = `disciplines.${expectedCategory}[${index}]`;
  if (!d || typeof d !== 'object') {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof d.id !== 'string' || d.id.trim().length === 0) {
    errors.push(`${prefix}.id must be a non-empty string`);
  }
  if (typeof d.statement !== 'string' || d.statement.trim().length === 0) {
    errors.push(`${prefix}.statement must be a non-empty string`);
  } else if (d.statement.length > STATEMENT_HARD_LIMIT_CHARS) {
    errors.push(`${prefix}.statement exceeds hard limit (${d.statement.length} > ${STATEMENT_HARD_LIMIT_CHARS} chars)`);
  }
  if (!Number.isInteger(d.formedInCycle) || d.formedInCycle < 1) {
    errors.push(`${prefix}.formedInCycle must be a positive integer`);
  }
  if (!Array.isArray(d.reinforcedInCycles) || d.reinforcedInCycles.some(c => !Number.isInteger(c))) {
    errors.push(`${prefix}.reinforcedInCycles must be an array of integers`);
  }
  if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1) {
    errors.push(`${prefix}.confidence must be a number in [0, 1]`);
  }
  if (d.source !== 'consolidation') {
    errors.push(`${prefix}.source must be "consolidation"`);
  }
  if (d.category !== expectedCategory) {
    errors.push(`${prefix}.category must be "${expectedCategory}" (got ${d.category})`);
  }
}

function validateLessonIdArray(arr, name, knownIds, consumedIds, errors) {
  if (arr === undefined) return;
  if (!Array.isArray(arr)) {
    errors.push(`${name} must be an array`);
    return;
  }
  arr.forEach((id, i) => {
    if (typeof id !== 'string') {
      errors.push(`${name}[${i}] must be a string`);
      return;
    }
    if (!knownIds.has(id)) {
      errors.push(`${name}[${i}] references unknown lesson id: ${id}`);
      return;
    }
    if (consumedIds.has(id)) {
      errors.push(`${name}[${i}] references already-consumed lesson id: ${id}`);
    }
  });
}

function countWords(s) {
  if (typeof s !== 'string') return 0;
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// ==================== APPLY (atomic Firestore write) ====================

/**
 * Apply a validated consolidation to the agent doc. Single atomic update.
 *
 * @param {FirebaseFirestore.DocumentReference} agentRef
 * @param {object} agent - the pre-update agent doc snapshot data
 * @param {object} consolidation - validated tool output
 * @returns {Promise<{ newCycle: number, evolutionEvent: object, nowIso: string }>}
 */
// Pure: the evolution timeline event for a consolidation cycle. Shared by the
// plain apply and the transactional variant so the two can never drift.
function buildEvolutionEvent(consolidation, newCycle, now) {
  return {
    id: `evo_${randomUUID()}`,
    type: 'consolidation',
    cycle: newCycle,
    headline: consolidation.evolutionEvent.headline,
    narrative: consolidation.evolutionEvent.narrative,
    timestamp: now,
    metadata: {
      cyclesCompleted: consolidation.cycleSummary.cyclesCompleted,
      keyShift: consolidation.cycleSummary.keyShift,
      confidenceLevel: consolidation.cycleSummary.confidenceLevel,
      lessonsAbsorbedCount: (consolidation.lessonsAbsorbed || []).length,
      lessonsCarriedForwardCount: (consolidation.lessonsCarriedForward || []).length,
      disciplinesCount: {
        selection: (consolidation.disciplines.selection || []).length,
        execution: (consolidation.disciplines.execution || []).length,
      },
    },
  };
}

// Pure: mark absorbed lessons consumed; preserve all other fields (incl. any
// concurrently-added lesson when called against a fresh read).
function markAbsorbedLessons(lessons, consolidation, nowIso) {
  const absorbedSet = new Set(consolidation.lessonsAbsorbed || []);
  return (lessons || []).map(lesson => {
    if (!lesson || !lesson.id || !absorbedSet.has(lesson.id)) return lesson;
    return { ...lesson, consumed: true, consumedInConsolidation: nowIso };
  });
}

export async function applyConsolidation(agentRef, agent, consolidation) {
  const newCycle = (agent?.evolutionCycle || 0) + 1;
  const now = Timestamp.now();
  const nowIso = new Date(now.toMillis()).toISOString();
  const evolutionEvent = buildEvolutionEvent(consolidation, newCycle, now);
  // Mark absorbed lessons as consumed; preserve all other fields.
  const updatedLessons = markAbsorbedLessons(agent?.lessons, consolidation, nowIso);

  await agentRef.update({
    disciplines: consolidation.disciplines,
    consolidatedInsight: consolidation.consolidatedInsightText,
    evolutionCycle: newCycle,
    lessons: updatedLessons,
    pendingConsolidation: false,
    evolutionTimeline: FieldValue.arrayUnion(evolutionEvent),
    updatedAt: now,
  });

  return { newCycle, evolutionEvent, nowIso };
}

// TRANSACTIONAL variant of applyConsolidation. Re-reads evolutionCycle + lessons
// INSIDE the transaction and applies against that fresh state, so a
// concurrently-arrayUnion'd lesson — e.g. the casual-clone DRB redirect writing
// to the SAME parent ranked agent — is never clobbered by the stale-read
// overwrite plain applyConsolidation would do. Design lock: "wrap the
// consolidation copy-forward in a transaction; don't inherit the existing
// non-transactional get→update race." Used ONLY for the casual copy-forward
// (transactionalApply option); the non-casual path keeps the plain apply, so
// flag-off is byte-identical. Returns the same shape as applyConsolidation.
export async function applyConsolidationTx(db, agentRef, consolidation) {
  const now = Timestamp.now();
  const nowIso = new Date(now.toMillis()).toISOString();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(agentRef);
    const fresh = snap.exists ? snap.data() : {};
    const newCycle = (fresh.evolutionCycle || 0) + 1;
    const evolutionEvent = buildEvolutionEvent(consolidation, newCycle, now);
    const updatedLessons = markAbsorbedLessons(fresh.lessons, consolidation, nowIso);
    tx.update(agentRef, {
      disciplines: consolidation.disciplines,
      consolidatedInsight: consolidation.consolidatedInsightText,
      evolutionCycle: newCycle,
      lessons: updatedLessons,
      pendingConsolidation: false,
      evolutionTimeline: FieldValue.arrayUnion(evolutionEvent),
      updatedAt: now,
    });
    return { newCycle, evolutionEvent, nowIso };
  });
}

// ==================== DRIVER ====================

/**
 * Full consolidation driver: re-read agent, build prompt, call Sonnet, validate,
 * apply, shadow-log. Designed to be invoked fire-and-forget from reflect.js.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference} agentRef
 * @returns {Promise<{ success: boolean, reason?: string, errors?: string[] }>}
 */
export async function consolidateAgentEvolution(db, agentRef, { transactionalApply = false } = {}) {
  const startTime = Date.now();

  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) {
    return { success: false, reason: 'agent_not_found' };
  }
  const agent = { id: agentSnap.id, ...agentSnap.data() };

  // P-OUT-2 (O5): the driver's own floor, on its own re-read. reflect.js checks
  // it before the milestone claim; this second check writes nothing at all.
  const window = Array.isArray(agent.memory) ? agent.memory : [];
  const realLessons = countRealLessons(window);
  if (realLessons < MIN_REAL_LESSONS_FOR_CONSOLIDATION) {
    console.log(`${LOG_PREFIX} skipped for agent ${agent.id}: ${realLessons} real lesson(s) of ${window.length} in the window (floor ${MIN_REAL_LESSONS_FOR_CONSOLIDATION})`);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'insufficient_real_lessons',
      realLessons,
      totalEntries: window.length,
    }).catch(() => {});
    return { success: false, reason: 'insufficient_real_lessons' };
  }

  const { systemPrompt, userMessage } = buildConsolidationPrompt(agent);

  // The call never throws: a failure comes back named, and nothing is written.
  // Its shadow line carries the call's fields and NO agent text.
  const call = await callSonnetConsolidation(systemPrompt, userMessage);
  if (!call.ok) {
    console.warn(`${LOG_PREFIX} consolidation call failed for agent ${agent.id}: ${call.reason} (${call.failureClass}${call.errorName ? `, ${call.errorName}` : ''}) after ${call.meta.elapsedMs ?? '?'}ms`);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: call.reason,
      ...consolidationCallFields(call),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return { success: false, reason: call.reason };
  }

  const consolidation = call.consolidation;
  const validation = validateConsolidationOutput(consolidation, agent);
  if (!validation.valid) {
    console.warn(`${LOG_PREFIX} Validation failed for agent ${agent.id}:`, validation.errors);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'validation_failed',
      ...consolidationCallFields({ ...call, ok: false, failureClass: 'missing_keys' }),
      validationErrorCount: validation.errors.length,
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return { success: false, reason: 'validation_failed', errors: validation.errors };
  }

  let applyResult;
  try {
    // Casual copy-forward uses the transactional apply (fresh-read merge) so a
    // concurrent lesson write to the parent is not clobbered; the non-casual path
    // keeps the plain apply (byte-identical).
    applyResult = transactionalApply
      ? await applyConsolidationTx(db, agentRef, consolidation)
      : await applyConsolidation(agentRef, agent, consolidation);
  } catch (err) {
    console.error(`${LOG_PREFIX} Firestore apply failed for agent ${agent.id}:`, err.message);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'firestore_apply_failed',
      ...consolidationCallFields({ ...call, ok: false, failureClass: 'unknown', errorName: errorNameOf(err) }),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return { success: false, reason: 'firestore_apply_failed' };
  }

  logConsolidation({
    agentId: agent.id,
    success: true,
    cycle: applyResult.newCycle,
    input: { systemPrompt, userMessage },
    output: consolidation,
    ...consolidationCallFields(call),
    durationMs: Date.now() - startTime,
  }).catch(() => {});

  console.log(
    `${LOG_PREFIX} Cycle ${applyResult.newCycle} complete for agent ${agent.id} ` +
      `(${applyResult.evolutionEvent.metadata.lessonsAbsorbedCount} absorbed, ` +
      `${applyResult.evolutionEvent.metadata.lessonsCarriedForwardCount} carried).`,
  );

  return { success: true };
}

// ==================== THE CALL (P-OUT-2, O8) ====================

class ConsolidationDeadlineError extends Error {
  constructor() {
    super(`Sonnet consolidation deadline (${CONSOLIDATION_TIMEOUT_MS / 1000}s)`);
    this.name = 'ConsolidationDeadlineError';
  }
}

/**
 * One consolidation call. NEVER throws — resolves to
 *   { ok: true, consolidation, meta } or
 *   { ok: false, reason, failureClass, accountWide, errorName, meta }
 * where meta = { elapsedMs, stopReason, usage, model } and reason keeps the
 * driver's existing names (sonnet_call_failed, no_tool_use) plus max_tokens.
 *
 * The part-1 pattern (api/agent/reflect.js callSonnetReflection): our deadline
 * settles the race and then ABORTS the request, so a timed-out call is
 * cancelled, not left running and billed; a timeout is classified by our own
 * fired flag. Under the forced tool choice a completed answer IS
 * stop_reason 'tool_use' — an answer cut at the ceiling is 'max_tokens', and any
 * other stop reason is no_tool_use, even with a tool block; neither is parsed.
 */
async function callSonnetConsolidation(systemPrompt, userMessage) {
  const meta = { elapsedMs: null, stopReason: null, usage: null, model: SONNET_MODEL };
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  let timer = null;
  let response;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new ConsolidationDeadlineError()); // settles the race first …
        controller.abort();                       // … then cancels the request
      }, CONSOLIDATION_TIMEOUT_MS);
    });
    response = await Promise.race([
      getAnthropicClient().messages.create({
        model: SONNET_MODEL,
        max_tokens: CONSOLIDATION_MAX_TOKENS,
        temperature: 0.3,
        // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
        // preserve the prior Sonnet-4 (no-thinking) latency profile.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [SUBMIT_CONSOLIDATION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_consolidation' },
      }, { signal: controller.signal }),
      deadline,
    ]);
  } catch (err) {
    meta.elapsedMs = Date.now() - startedAt;
    return {
      ok: false,
      reason: 'sonnet_call_failed',
      failureClass: classifyReflectionError(err, { timedOut }),
      // Our deadline settles the race with ConsolidationDeadlineError, never an
      // API refusal — so a timeout is never account-wide.
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

  if (meta.stopReason === 'max_tokens') {
    return { ok: false, reason: 'max_tokens', failureClass: 'max_tokens', accountWide: false, errorName: null, meta };
  }
  if (meta.stopReason !== 'tool_use') {
    return { ok: false, reason: 'no_tool_use', failureClass: 'no_tool_use', accountWide: false, errorName: null, meta };
  }
  const toolUse = response?.content?.find?.(c => c.type === 'tool_use');
  if (!toolUse?.input) {
    return { ok: false, reason: 'no_tool_use', failureClass: 'no_tool_use', accountWide: false, errorName: null, meta };
  }
  return { ok: true, consolidation: toolUse.input, meta };
}

/**
 * The call's fields on the consolidation shadow line, in the part-1 vocabulary
 * (reflectionOutcome.js). Classes, a class name, timings, token counts and the
 * model id only — never agent text.
 */
function consolidationCallFields(call) {
  return {
    outcome: call.ok ? 'ok' : 'failed',
    failureClass: call.ok ? null : (call.failureClass ?? 'unknown'),
    accountWide: !call.ok && call.accountWide === true,
    errorName: call.ok ? null : (call.errorName ?? null),
    elapsedMs: call.meta?.elapsedMs ?? null,
    stopReason: call.meta?.stopReason ?? null,
    usage: call.meta?.usage ?? null,
    model: call.meta?.model ?? null,
  };
}
