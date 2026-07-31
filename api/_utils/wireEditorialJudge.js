// api/_utils/wireEditorialJudge.js
// FantasyTimes Wire — N3.3 advisory judge + N3.6 completeness (Spec V1.2
// N3.3 F-B2, N3.6 M13; V1.3 D-P2-12 chunking).
//
// THE PARTITION (F-B2). The judge is ADVISORY-ONLY: causality,
// level-interaction, and any prose↔facts dimension lacking a deterministic
// check. It never touches a gate-bearing verdict — those come from the
// deterministic adapters (wireEditorialAdapters.js) and from nothing else.
// Advisory flags are reported in every memo and are NEVER period-fatal.
//
// THE MECHANICAL HALLUCINATION CHECK (N3.3): a flag's cited excerpt must be
// a VERBATIM substring of the story's prose, and its cited typed field must
// exist with the stated value — otherwise the flag is DISCARDED as judge
// error and counted as such. The judge can surface, never adjudicate.
//
// COMPLETENESS (M13): structured output keyed to every sample ID; unknown /
// duplicate / missing IDs reject the chunk; stop reason + token usage
// recorded; incomplete ⇒ the run's gateEligible is false. Chunking is
// deterministic (fixed size, sample order) with aggregation across chunks.
//
// TRANSPORT: the model call rides wireModelCall — the sole Anthropic-client
// importer in the Wire context (P2-48 auto-covers this file by name). The
// judge execution object below is frozen and is the SAME object the
// recorded judgeModelId derives from (P11: provenance binds to execution).
// The judge is NOT a generation seam: it stamps no Wire entry, so the
// generation-tuple fields are explicit nulls.

import { wireModelCall } from './wireModelCall.js';

export const EDITORIAL_JUDGE_EXECUTION = Object.freeze({
  seam: 'editorial_judge',
  model: 'claude-sonnet-4-6',
  maxTokens: 3000,
  temperature: 0,
  // The repo's Sonnet-4.6 latency pin (wireGenerationConfig precedent):
  // thinking disabled + low effort — a bounded verification pass inside a
  // 60s host lambda, not an open-ended reasoning task.
  thinking: Object.freeze({ type: 'disabled' }),
  outputConfig: Object.freeze({ effort: 'low' }),
  generationVersion: null,
  continuityEnabled: null,
});

export const EDITORIAL_JUDGE_CHUNK_SIZE = 10;
export const EDITORIAL_ADVISORY_DIMENSIONS = Object.freeze(['causality', 'level_interaction', 'other']);
const EXCERPT_CAP = 200;
const BODY_CAP = 1800;

export const EDITORIAL_JUDGE_TOOL = Object.freeze({
  name: 'submit_editorial_review',
  description:
    'Submit the advisory editorial review. One review object per story id, '
    + 'in any order, EVERY listed id exactly once. flags may be empty.',
  input_schema: {
    type: 'object',
    properties: {
      reviews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            storyId: { type: 'string' },
            flags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dimension: { type: 'string', enum: [...EDITORIAL_ADVISORY_DIMENSIONS] },
                  excerpt: { type: 'string', description: `VERBATIM substring of the story prose, ≤${EXCERPT_CAP} chars` },
                  citedField: { type: 'string', description: 'dotted path into the typed facts, e.g. magnitude.value' },
                  citedValue: { type: 'string', description: 'the typed value the excerpt disagrees with, as a string' },
                  note: { type: 'string' },
                },
                required: ['dimension', 'excerpt', 'citedField', 'citedValue'],
              },
            },
          },
          required: ['storyId', 'flags'],
        },
      },
    },
    required: ['reviews'],
  },
});

const JUDGE_SYSTEM = [
  'You are the FantasyTimes editorial fact-desk. You review PUBLISHED stories against their TYPED FACTS.',
  '',
  'Your scope is ADVISORY dimensions ONLY:',
  '- causality: prose asserts a cause-effect the typed facts do not support.',
  '- level_interaction: prose claims a level was reached/approached/broken beyond what the typed keyLevel/figures state.',
  '- other: any prose claim that contradicts or materially overreaches a typed field and has no deterministic check.',
  '',
  'NEVER flag: numeric magnitude accuracy, tickers, direction, units, or beat/miss status — those are verified deterministically elsewhere. Style, tone, and voice are out of scope.',
  '',
  'For every flag: excerpt must be a VERBATIM substring of the story prose (copy characters exactly); citedField must name the typed field it disagrees with; citedValue must be that field\'s value as shown. If a story has no advisory issue, return it with an empty flags array.',
  'Return EVERY listed story id exactly once via the submit_editorial_review tool.',
].join('\n');

/** The prose surface the judge reads and excerpts must match against. */
export function judgeProseOf(storyDoc) {
  const headline = storyDoc?.headline ?? '';
  const body = String(storyDoc?.body ?? '').slice(0, BODY_CAP);
  return `${headline}\n${body}`;
}

function storyBlock({ sampleItem, storyDoc, entry }) {
  const facts = entry?.agentFacts || {};
  return [
    `STORY ${sampleItem.storyId} — ${sampleItem.reporter} / ${facts.eventType} / ${sampleItem.marketDate}`,
    `TYPED FACTS: ${JSON.stringify({
      digest: facts.digest ?? null,
      direction: facts.direction ?? null,
      magnitude: facts.magnitude ?? null,
      keyLevel: facts.keyLevel ?? null,
      figures: facts.figures ?? [],
      qualifiers: facts.qualifiers ?? [],
      subjectRef: facts.subjectRef ?? null,
      primaryTicker: facts.primaryTicker ?? null,
    })}`,
    'PROSE:',
    judgeProseOf(storyDoc),
  ].join('\n');
}

/** Deterministic chunking: fixed size over the sample order (N3.6). */
export function judgeChunks(stories, size = EDITORIAL_JUDGE_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < stories.length; i += size) chunks.push(stories.slice(i, i + size));
  return chunks;
}

export function buildJudgeContent(chunkStories) {
  const ids = chunkStories.map((s) => s.sampleItem.storyId);
  return {
    system: JUDGE_SYSTEM,
    messages: [{
      role: 'user',
      content:
        `Review these ${ids.length} stories. Return every id exactly once: ${ids.join(', ')}\n\n`
        + chunkStories.map(storyBlock).join('\n\n---\n\n'),
    }],
    tools: [EDITORIAL_JUDGE_TOOL],
    tool_choice: { type: 'tool', name: EDITORIAL_JUDGE_TOOL.name },
  };
}

/**
 * M13 chunk validation: every expected id exactly once; nothing unknown.
 */
export function validateJudgeChunk(expectedIds, toolInput) {
  const reviews = Array.isArray(toolInput?.reviews) ? toolInput.reviews : [];
  const seen = new Map();
  const unknown = [];
  for (const r of reviews) {
    const id = r?.storyId;
    if (!expectedIds.includes(id)) { unknown.push(String(id)); continue; }
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  const missing = expectedIds.filter((id) => !seen.has(id));
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  return {
    ok: missing.length === 0 && unknown.length === 0 && duplicates.length === 0,
    missing, unknown, duplicates,
  };
}

/**
 * The mechanical hallucination check (N3.3). Returns { ok } or
 * { ok: false, code } — a failed flag is DISCARDED and counted, never kept
 * and never escalated.
 */
export function checkAdvisoryFlag(flag, { storyDoc, entry }) {
  if (!EDITORIAL_ADVISORY_DIMENSIONS.includes(flag?.dimension)) {
    return { ok: false, code: 'unknown_dimension' };
  }
  const excerpt = flag?.excerpt;
  if (typeof excerpt !== 'string' || excerpt.length === 0 || excerpt.length > EXCERPT_CAP) {
    return { ok: false, code: 'excerpt_invalid' };
  }
  if (!judgeProseOf(storyDoc).includes(excerpt)) {
    return { ok: false, code: 'excerpt_not_verbatim' };
  }
  // Cited typed field must exist with the stated value.
  const facts = entry?.agentFacts || {};
  let cursor = facts;
  for (const segment of String(flag.citedField).split('.')) {
    if (cursor === null || typeof cursor !== 'object' || !(segment in cursor)) {
      return { ok: false, code: 'cited_field_missing' };
    }
    cursor = cursor[segment];
  }
  const stated = String(flag.citedValue);
  const actual = typeof cursor === 'object' ? JSON.stringify(cursor) : String(cursor);
  if (stated !== actual) return { ok: false, code: 'cited_value_mismatch' };
  return { ok: true };
}

/**
 * Run the judge over the full sample: deterministic chunks, one model call
 * each, M13 validation per chunk, hallucination check per flag.
 *
 * @param {Array<{sampleItem, storyDoc, entry}>} stories
 * @param {object} o
 * @param {number} o.deadline — epoch ms; a chunk is only issued with
 *   PER_CALL_RESERVE headroom, else BudgetExceeded (the caller leaves the
 *   run resumable — budget exhaustion is not a judge failure)
 * @param {Function} [o.callModel] — injection seam for tests; production
 *   passes nothing and gets wireModelCall
 * @returns {Promise<{complete, incompleteReason, reviewsByStoryId, judgeErrors,
 *                    discardedFlags, chunks, judgeModelId}>}
 */
export const PER_CALL_RESERVE_MS = 10_000;

export class EditorialBudgetExceeded extends Error {
  constructor(remaining) {
    super(`editorial judge budget exhausted (${remaining}ms remaining)`);
    this.code = 'budget_exhausted';
  }
}

export async function runJudgePass(stories, { deadline, callModel = wireModelCall } = {}) {
  const reviewsByStoryId = new Map();
  const discardedFlags = [];
  const chunkRecords = [];

  for (const chunk of judgeChunks(stories)) {
    const remaining = deadline - Date.now();
    if (remaining < PER_CALL_RESERVE_MS) throw new EditorialBudgetExceeded(remaining);

    const expectedIds = chunk.map((s) => s.sampleItem.storyId);
    const { response } = await callModel(EDITORIAL_JUDGE_EXECUTION, buildJudgeContent(chunk));

    const toolBlock = (response?.content || []).find((b) => b.type === 'tool_use');
    const record = {
      ids: expectedIds,
      stopReason: response?.stop_reason ?? null,
      usage: response?.usage ?? null,
    };
    chunkRecords.push(record);

    if (!toolBlock || response?.stop_reason !== 'tool_use') {
      return {
        complete: false,
        incompleteReason: `chunk_no_tool_use:${response?.stop_reason ?? 'none'}`,
        reviewsByStoryId, judgeErrors: discardedFlags.length, discardedFlags,
        chunks: chunkRecords, judgeModelId: EDITORIAL_JUDGE_EXECUTION.model,
      };
    }

    const validation = validateJudgeChunk(expectedIds, toolBlock.input);
    record.validation = validation;
    if (!validation.ok) {
      return {
        complete: false,
        incompleteReason: `chunk_ids_invalid:missing=${validation.missing.length},unknown=${validation.unknown.length},dup=${validation.duplicates.length}`,
        reviewsByStoryId, judgeErrors: discardedFlags.length, discardedFlags,
        chunks: chunkRecords, judgeModelId: EDITORIAL_JUDGE_EXECUTION.model,
      };
    }

    const byId = new Map(chunk.map((s) => [s.sampleItem.storyId, s]));
    for (const review of toolBlock.input.reviews) {
      const story = byId.get(review.storyId);
      const kept = [];
      for (const flag of review.flags || []) {
        const check = checkAdvisoryFlag(flag, story);
        if (check.ok) {
          kept.push({
            dimension: flag.dimension,
            excerpt: flag.excerpt,
            citedField: flag.citedField,
            citedValue: String(flag.citedValue),
            note: typeof flag.note === 'string' ? flag.note.slice(0, 300) : null,
          });
        } else {
          discardedFlags.push({ storyId: review.storyId, code: check.code, dimension: flag?.dimension ?? null });
        }
      }
      reviewsByStoryId.set(review.storyId, kept);
    }
  }

  return {
    complete: true,
    incompleteReason: null,
    reviewsByStoryId,
    judgeErrors: discardedFlags.length,
    discardedFlags,
    chunks: chunkRecords,
    judgeModelId: EDITORIAL_JUDGE_EXECUTION.model,
  };
}
