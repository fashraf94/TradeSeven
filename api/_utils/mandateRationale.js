// api/_utils/mandateRationale.js
//
// T0b — the manager's written reason on every Mandate decision record
// (Practice Field concept V6.1 §2 and ruling 16; Astra V5 review B7).
//
// The decision tool requires a `rationale` and allows a `conviction`
// (mandateDecisionTool.js); normalizeDecisionInput keeps both. Before T0b the
// decision record dropped both. This module turns them into bounded,
// attributed record fields. It is STORAGE ONLY:
//   • the text is the model's outward explanation (the tool input's
//     `rationale`; free text outside the tool call is never stored), quoted
//     and unverified. It is never evidence, and no code re-reads it into a
//     prompt, memory, consolidation or screen (tripwire:
//     mandateRationale.imports.test.js). The book's owner can read decision
//     records from the client by rule (firestore.rules, decisions/{id}); that
//     is access, not a reader in code;
//   • conviction is the model's self-reported confidence, uncalibrated, kept
//     as a DIAGNOSTIC: never shown or used as confidence or as a probability.
//     The field name says so;
//   • the tool's "2–5 sentences" is an instruction to the model, not a
//     validator. A one-sentence reason is still a reason;
//   • quoted, not rewritten, with two stated exceptions: outer whitespace is
//     dropped, and a lone UTF-16 surrogate becomes U+FFFD (a string Firestore
//     can store as UTF-8). Neither is flagged; a cut to the bound is.
//
// buildDecision (mandateSchema.js) calls boundRationale and
// convictionDiagnosticOf itself, and caps the record's other model- or
// provider-lengthened strings with capStoredString, so every decision document
// is bounded BY CONSTRUCTION, whatever its writer passes. Pure and Node-clean
// (node:crypto through canonicalHash.js only).

import { canonicalContentHash } from './canonicalHash.js';
import { MANDATE_RATIONALE_MAX_CHARS } from './mandateConfig.js';

/**
 * rationaleStatus — 'present' (stored whole), 'truncated' (cut to the bound at
 * a grapheme boundary), 'absent' (no text stored). Absent covers: the model's
 * tool input carried no reason; no model response existed when the record was
 * written (modelId null: result-less and lifecycle terminals); or a response
 * existed but carried no readable decision tool input (modelId set; the
 * record's failCondition says why, e.g. no_decision_tool_use).
 */
export const RATIONALE_STATUSES = Object.freeze(['present', 'truncated', 'absent']);

/**
 * rationaleAtBasis — which clock `rationaleAt` was read from:
 *   'direct_response' — direct transport: when the model's response reached the engine;
 *   'batch_ended'     — batch transport: the provider's batch end time, a batch-level
 *                       time (each response in the batch existed by then);
 *   'batch_harvested' — batch transport with no readable provider end time: the
 *                       harvest fire's clock, read at the fire's start.
 */
export const RATIONALE_AT_BASES = Object.freeze(['direct_response', 'batch_ended', 'batch_harvested']);

/** The record fields T0b adds to decisions/{decisionId}, named once. */
export const DECISION_RATIONALE_FIELDS = Object.freeze([
  'rationale',
  'rationaleStatus',
  'convictionDiagnostic',
  'modelId',
  'generationConfigVersion',
  'rationaleAt',
  'rationaleAtBasis',
]);

let graphemeSegmenter;
function segmenter() {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter = typeof Intl?.Segmenter === 'function'
      ? new Intl.Segmenter('en', { granularity: 'grapheme' })
      : null;
  }
  return graphemeSegmenter;
}

/**
 * The longest prefix of whole grapheme clusters whose UTF-16 length is at most
 * `maxUnits`. A first cluster longer than the bound on its own (a pathological
 * combining run), or a runtime without Intl.Segmenter, falls back to a
 * code-point cut: never half a surrogate pair, and never empty.
 *
 * Only the first maxUnits + 2 units are segmented: every grapheme-break rule
 * (UAX #29) needs left context plus ONE code point to the right, so the
 * boundaries up to the bound are the same as on the whole text, and the cost
 * stays fixed (ICU on Node 20 took 3.5 s on a 2-million-character input,
 * inside the execution transaction; the prefix takes 2 ms).
 */
function cutAtGrapheme(text, maxUnits) {
  const seg = segmenter();
  if (seg) {
    let end = 0;
    for (const { segment, index } of seg.segment(text.slice(0, maxUnits + 2))) {
      const next = index + segment.length;
      if (next > maxUnits) break;
      end = next;
    }
    if (end > 0) return text.slice(0, end);
  }
  let end = maxUnits;
  const edge = text.charCodeAt(end - 1);
  if (edge >= 0xd800 && edge <= 0xdbff) end -= 1; // a high surrogate at the edge stays with its pair
  return text.slice(0, end);
}

/**
 * Bound the model's reason for storage. Non-string or blank input is absent
 * (null, never an empty string standing in for text). Outer whitespace is
 * dropped; an ill-formed UTF-16 string (a lone surrogate) is made well-formed,
 * so every stored unit costs at most 3 UTF-8 bytes. Text longer than
 * `maxChars` UTF-16 units is cut at a grapheme boundary and marked truncated.
 *
 * @returns {{ rationale: string|null, rationaleStatus: 'present'|'truncated'|'absent' }}
 */
export function boundRationale(raw, { maxChars = MANDATE_RATIONALE_MAX_CHARS } = {}) {
  if (!Number.isInteger(maxChars) || maxChars < 2) {
    throw new Error(`boundRationale: maxChars must be an integer ≥ 2 (got ${maxChars})`);
  }
  if (typeof raw !== 'string') return { rationale: null, rationaleStatus: 'absent' };
  const wellFormed = typeof raw.toWellFormed === 'function' ? raw.toWellFormed() : raw;
  const text = wellFormed.trim();
  if (text === '') return { rationale: null, rationaleStatus: 'absent' };
  if (text.length <= maxChars) return { rationale: text, rationaleStatus: 'present' };
  return { rationale: cutAtGrapheme(text, maxChars), rationaleStatus: 'truncated' };
}

/**
 * Cap one stored string at `maxUnits` UTF-16 units: well-formed, never half a
 * surrogate pair. For the record's short strings (ticker, failing condition):
 * real values never reach the cap, so no status flag rides with it. A
 * non-string passes through (null stays null).
 */
export function capStoredString(value, maxUnits) {
  if (typeof value !== 'string') return value ?? null;
  const text = typeof value.toWellFormed === 'function' ? value.toWellFormed() : value;
  if (text.length <= maxUnits) return text;
  let end = maxUnits;
  const edge = text.charCodeAt(end - 1);
  if (edge >= 0xd800 && edge <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

/**
 * The self-reported conviction as a diagnostic integer 0–100, or null. Same
 * rule as normalizeDecisionInput (finite numbers only, rounded, clamped), so
 * re-applying it is idempotent.
 */
export function convictionDiagnosticOf(raw) {
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : null;
}

/**
 * The generation config's version: a content address of the pinned model seat
 * (provider, model id, sampling params). mandateGenerationConfig.js carries no
 * version constant, and a live constant would mis-attribute a reason produced
 * under an older vintage's seat; the seat frozen in the vintage is what built
 * the request, so it is hashed directly. null when no seat is known.
 */
export function generationConfigVersionOf(modelSeat) {
  if (!modelSeat || typeof modelSeat !== 'object' || !modelSeat.model) return null;
  return `seat_${canonicalContentHash(modelSeat).slice(0, 16)}`;
}

/**
 * Attribution for a decision built from a model RESPONSE: the model and
 * generation settings that produced the reason, and when it arrived. The
 * model id comes from the pinned seat (the submit-time copy when the seat is
 * unreadable).
 */
export function responseAttribution({ modelSeat = null, modelId = null, rationaleAt = null, rationaleAtBasis = null } = {}) {
  return {
    modelId: modelSeat?.model || modelId || null,
    generationConfigVersion: generationConfigVersionOf(modelSeat),
    rationaleAt,
    rationaleAtBasis,
  };
}

/**
 * The buildDecision inputs for the reason fields. `rationale` and
 * `conviction` are raw (buildDecision bounds and sanitizes them); no
 * attribution means no model response stands behind the record.
 */
export function rationaleRecordInputs({ rationale = null, conviction = null, attribution = null } = {}) {
  return {
    rationale,
    convictionDiagnostic: conviction,
    modelId: attribution?.modelId ?? null,
    generationConfigVersion: attribution?.generationConfigVersion ?? null,
    rationaleAt: attribution?.rationaleAt ?? null,
    rationaleAtBasis: attribution?.rationaleAtBasis ?? null,
  };
}
