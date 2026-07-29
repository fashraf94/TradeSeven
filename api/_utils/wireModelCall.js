// api/_utils/wireModelCall.js
// FantasyTimes Wire — the single-constructor model-call wrapper (Phase 2
// Spec V1.5 R4-B2, Addendum A R-A1).
//
// THE ONLY MODULE IN THE WIRE CONTEXT PERMITTED TO IMPORT THE ANTHROPIC
// CLIENT. Scope per R-A1: the FantasyTimes generation seams
// (api/fantasytimes/**), the Wire _utils modules, and the N3 editorial judge
// call when it lands. Enforced by wireModelCall.imports.test.js (P2-48).
// Fenced decide.js and every other repo importer are OUT of scope and
// untouched — whether Phase 3 routes decide.js through here is a Phase 3
// §7-spec question (R-A1, deferred).
//
// P11 by construction: the request's generation parameters are built from
// the frozen execution object (getGenerationConfig), and the provenance
// stamp returned to the caller is derived FROM THE SAME OBJECT IN THE SAME
// FUNCTION. Divergence between what ran and what gets stamped requires
// editing this one reviewed, golden-covered module (R4-B2: "reconstruction,
// not mutation, was the threat" — there is no second construction site).
//
// Two-direction contract (asserted by wireModelCall.test.js / P2-45/P2-49):
//   direction 1 — every execution-object generation field reaches the
//   request; direction 2 — the request's generation-parameter surface
//   contains NOTHING beyond those fields (deny-unknown). Content keys are an
//   explicit allowlist; an unknown content key THROWS rather than passing
//   through, so a caller cannot smuggle a sampling param around the tuple.
//
// Both call shapes covered: messages.create and the Batch API's
// batches.create, where params nest inside requests[].params — the
// two-direction assertion applies at the params level per request (R4-B2).
//
// Content fields (system/messages/tools/tool_choice) pass BY REFERENCE —
// never cloned — because the M8 payload-equality lock asserts the pristine
// tool singleton BY IDENTITY on flag-off requests (wirePayloadEquality
// .test.js). This wrapper adds no persistence and no metrics: byte-identical
// transport, dark by construction.

import Anthropic from '@anthropic-ai/sdk';

// Content keys a caller may pass — the request allowlist beyond the tuple.
const CONTENT_KEYS = Object.freeze(['system', 'messages', 'tools', 'tool_choice']);

// Lazy singleton, constructed exactly as every pre-P1 seam did.
let anthropicClient = null;
function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

/**
 * Map the execution object's generation fields onto API request params.
 * Explicit field copy in both directions: exactly these fields, no spread.
 */
function generationParams(execution) {
  const params = {
    model: execution.model,
    max_tokens: execution.maxTokens,
  };
  if (execution.temperature !== undefined) params.temperature = execution.temperature;
  if (execution.thinking !== undefined) params.thinking = execution.thinking;
  if (execution.outputConfig !== undefined) params.output_config = execution.outputConfig;
  return params;
}

/** The D-P2-7 provenance tuple, derived from the same frozen object the
 *  request was built from — in this module, nowhere else. */
function provenanceStamp(execution) {
  return Object.freeze({
    generationVersion: execution.generationVersion,
    continuityEnabled: execution.continuityEnabled,
  });
}

function assertContentKeys(content, where) {
  for (const key of Object.keys(content)) {
    if (!CONTENT_KEYS.includes(key)) {
      throw new Error(
        `[WireModelCall] unknown content key '${key}' at ${where} — generation params ` +
        'come from the execution object only (R4-B2 deny-unknown)'
      );
    }
  }
}

/** Assemble one request: tuple-derived params + allowlisted content, content
 *  values BY REFERENCE. */
function buildRequest(execution, content, where) {
  assertContentKeys(content, where);
  const request = generationParams(execution);
  for (const key of CONTENT_KEYS) {
    if (key in content) request[key] = content[key];
  }
  return request;
}

/**
 * The messages.create shape.
 *
 * @param {Readonly<object>} execution — from getGenerationConfig(seam, flags)
 * @param {object} content — { system?, messages, tools?, tool_choice? }
 * @returns {Promise<{ response: object, generationConfig: Readonly<object> }>}
 */
export async function wireModelCall(execution, content) {
  const request = buildRequest(execution, content, `wireModelCall(${execution?.seam})`);
  const response = await getClient().messages.create(request);
  return { response, generationConfig: provenanceStamp(execution) };
}

/**
 * The batches.create shape (Doug's preview seam). One execution object
 * governs every request in the batch — same model, same params — content
 * varies per request. Params nest inside requests[].params (R4-B2: asserted
 * at that level, not the envelope level).
 *
 * The returned generationConfig is what submit-earnings-batch stamps onto
 * the batch doc (flag-gated exactly like wireMarketDate) so poll-batch
 * carries SUBMIT-time provenance, not poll-time (R4-B1) — that stamping is
 * N0 build work; the derivation lives here from day one.
 *
 * @param {Readonly<object>} execution
 * @param {Array<{ customId: string, content: object }>} requestSpecs
 * @returns {Promise<{ batch: object, generationConfig: Readonly<object> }>}
 */
export async function wireBatchSubmit(execution, requestSpecs) {
  const requests = requestSpecs.map(({ customId, content }) => ({
    custom_id: customId,
    params: buildRequest(execution, content, `wireBatchSubmit(${execution?.seam}:${customId})`),
  }));
  const batch = await getClient().messages.batches.create({ requests });
  return { batch, generationConfig: provenanceStamp(execution) };
}

/** Batch retrieval pass-throughs: poll-batch is a result retriever, not a
 *  generation seam — no execution object, no params — but the P2-48
 *  invariant ("sole client importer in the Wire context") holds with no
 *  carve-outs because retrieval also routes through this module. */
export async function wireBatchRetrieve(batchId) {
  return getClient().messages.batches.retrieve(batchId);
}

export async function wireBatchResults(batchId) {
  return getClient().messages.batches.results(batchId);
}
