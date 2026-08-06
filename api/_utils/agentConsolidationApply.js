// api/_utils/agentConsolidationApply.js
// Validator + applyConsolidation + driver for the Sonnet-driven consolidation
// writer. Funnel principle: this is the ONLY writer of agent.disciplines.
//
// Memory is NOT touched here. Lessons are flagged consumed but not removed.

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { SUBMIT_CONSOLIDATION_TOOL } from './agentConsolidationToolSchema.js';
import { buildConsolidationPrompt } from './agentConsolidationPrompt.js';
import { logConsolidation } from './shadowLogger.js';

const LOG_PREFIX = '[CONSOLIDATION]';
const SONNET_MODEL = 'claude-sonnet-4-6';
const SONNET_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 2000;

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

  const { systemPrompt, userMessage } = buildConsolidationPrompt(agent);

  let response;
  try {
    response = await Promise.race([
      getAnthropicClient().messages.create({
        model: SONNET_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.3,
        // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
        // preserve the prior Sonnet-4 (no-thinking) latency profile.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [SUBMIT_CONSOLIDATION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_consolidation' },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sonnet consolidation timeout (30s)')), SONNET_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    console.error(`${LOG_PREFIX} Sonnet call failed for agent ${agent.id}:`, err.message);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'sonnet_call_failed',
      error: err.message,
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return { success: false, reason: 'sonnet_call_failed' };
  }

  const toolUse = response?.content?.find(c => c.type === 'tool_use');
  if (!toolUse?.input) {
    console.warn(`${LOG_PREFIX} Sonnet did not use submit_consolidation tool for agent ${agent.id}`);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'no_tool_use',
      response: safeStringify(response),
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    return { success: false, reason: 'no_tool_use' };
  }

  const consolidation = toolUse.input;
  const validation = validateConsolidationOutput(consolidation, agent);
  if (!validation.valid) {
    console.warn(`${LOG_PREFIX} Validation failed for agent ${agent.id}:`, validation.errors);
    logConsolidation({
      agentId: agent.id,
      success: false,
      reason: 'validation_failed',
      errors: validation.errors,
      output: consolidation,
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
      error: err.message,
      output: consolidation,
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
    usage: response.usage || null,
    durationMs: Date.now() - startTime,
  }).catch(() => {});

  console.log(
    `${LOG_PREFIX} Cycle ${applyResult.newCycle} complete for agent ${agent.id} ` +
      `(${applyResult.evolutionEvent.metadata.lessonsAbsorbedCount} absorbed, ` +
      `${applyResult.evolutionEvent.metadata.lessonsCarriedForwardCount} carried).`,
  );

  return { success: true };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value).slice(0, 5000);
  } catch {
    return '[unserializable]';
  }
}
