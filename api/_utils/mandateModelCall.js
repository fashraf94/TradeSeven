// api/_utils/mandateModelCall.js
//
// Spec 1 — Mandate Substrate — the MODEL SEAM (§3.3). THE ONLY MODULE IN THE
// BOOK CONTEXT PERMITTED TO IMPORT THE ANTHROPIC CLIENT (AST/scan-enforced by
// mandateModelCall.imports.test.js — the wireModelCall precedent). Provider,
// model, and params come from the pinned vintage's model seat
// (mandateGenerationConfig.js), never a live config read.
//
// P2 built DIRECT transport + the submission envelope (F1) and deterministic
// requestId (F2). P5 adds the BATCH transport surface (§3.3 / D-20): the
// Message-Batch wrappers below (the wireModelCall/Doug submit→poll precedent —
// batches.create with params nested per request, retrieve, results, cancel) and
// prompt caching (cache_control on the stable scaffold). Batch STATE — docs,
// harvest, dispositions, drain — lives in mandateBatchTransport.js; this module
// stays the transport-agnostic client seam.
//
// PROMPT CACHING (D-20/§3.3): buildMandateRequest marks the system scaffold —
// identity assembled from the pinned vintage, stable per vintage×verb-set —
// with cache_control, which caches the (tools + system) prefix; the per-tick
// context block rides in `messages` and stays UNCACHED. Applied uniformly to
// both transports; whether batch processing actually HITS the cache is never
// assumed — cacheHitTokens is measured per call from the API response (§6.3),
// and at the current Haiku seat the scaffold may sit under the model's minimum
// cacheable prefix, in which case the marker no-ops and the measurement says so.
//
// DENY-UNKNOWN (R4-B2 precedent): content is a closed allowlist
// {system, messages, tools, tool_choice}; an unknown content key THROWS rather
// than passing through, so no caller can smuggle a sampling param around the
// seat. tool_choice forces the decision tool (§3.3) — the model always returns a
// structured decision, never free text.

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { MANDATE_DECISION_TOOL_NAME } from './mandateDecisionTool.js';

const CONTENT_KEYS = Object.freeze(['system', 'messages', 'tools', 'tool_choice']);

// Lazy singleton — constructed exactly once, exactly as the app's other seams do.
let anthropicClient = null;
function getClient() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return anthropicClient;
}

// ── Submission envelope (F1/F2) ──────────────────────────────────────────────

/**
 * The deterministic requestId (F2): hash(mandateId, quarterKey, snapshotTickKey,
 * baseRevision). Two submissions of the same base state under the same tick
 * collapse to one id — the backbone of exactly-once.
 */
export function computeRequestId({ mandateId, quarterKey, snapshotTickKey, baseRevision }) {
  return createHash('sha256')
    .update(`${mandateId}::${quarterKey}::${snapshotTickKey}::${baseRevision}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
}

/**
 * Build the immutable base-state identity every request carries (§3.3). Pure.
 */
export function buildSubmissionEnvelope({
  mandateId, baseRevision, quarterKey, vintageRef, snapshotTickKey,
  bookStatus, submittedAt, sessionDate, mandatePromptTemplateVersion = null,
}) {
  const requestId = computeRequestId({ mandateId, quarterKey, snapshotTickKey, baseRevision });
  return {
    requestId,
    mandateId,
    baseRevision,
    quarterKey,
    vintageRef,
    snapshotTickKey,
    submitTickKey: snapshotTickKey,
    bookStatus,
    submittedAt,
    sessionDate,
    mandatePromptTemplateVersion,
  };
}

// ── Request assembly (deny-unknown) ──────────────────────────────────────────

function assertContentKeys(content) {
  for (const key of Object.keys(content)) {
    if (!CONTENT_KEYS.includes(key)) {
      throw new Error(
        `[MandateModelCall] unknown content key '${key}' — generation params come from `
        + 'the model seat only (deny-unknown, §3.3)',
      );
    }
  }
}

/**
 * Assemble the messages.create request from the model seat + allowlisted content.
 * Forces the decision tool unless the caller supplied a tool_choice.
 */
export function buildMandateRequest(modelSeat, content) {
  if (!modelSeat || !modelSeat.model) throw new Error('buildMandateRequest: model seat required');
  assertContentKeys(content);
  const params = modelSeat.params || {};
  const request = {
    model: modelSeat.model,
    max_tokens: params.maxTokens,
  };
  if (params.temperature !== undefined) request.temperature = params.temperature;
  for (const key of CONTENT_KEYS) if (key in content) request[key] = content[key];
  if (!request.tool_choice) request.tool_choice = { type: 'tool', name: MANDATE_DECISION_TOOL_NAME };
  // D-20 (P5): the string system scaffold becomes a single cache-marked block —
  // the prefix (tools + system) is stable per vintage×verb-set; the context
  // block stays in `messages`, after the breakpoint, uncached. A caller that
  // passes its own block ARRAY owns its cache markers (left untouched).
  if (typeof request.system === 'string') {
    request.system = [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }];
  }
  return request;
}

/**
 * Extract the decision tool input from a model response. Deny-unknown on block
 * types: only `text` and `tool_use` blocks are expected; the decision must arrive
 * as a `tool_use` naming the decision tool.
 *
 * @returns {{ ok:true, input:object, usage } | { ok:false, reason:string }}
 */
export function extractDecisionInput(response) {
  const content = Array.isArray(response?.content) ? response.content : [];
  let toolInput = null;
  for (const block of content) {
    if (block?.type === 'tool_use') {
      if (block.name === MANDATE_DECISION_TOOL_NAME) toolInput = block.input;
    } else if (block?.type !== 'text') {
      return { ok: false, reason: `unexpected_block:${block?.type}` };
    }
  }
  if (!toolInput) return { ok: false, reason: 'no_decision_tool_use' };
  return { ok: true, input: toolInput, usage: response?.usage ?? null };
}

// ── The call (direct transport, P2) ──────────────────────────────────────────

/**
 * Direct-transport model call. Returns the raw response + the decision input +
 * token usage.
 *
 * @param {object} modelSeat  from the pinned vintage / mandateGenerationConfig
 * @param {object} content    { system, messages, tools, tool_choice? }
 */
export async function callMandateModelDirect(modelSeat, content) {
  const request = buildMandateRequest(modelSeat, content);
  const response = await getClient().messages.create(request);
  return { response, decision: extractDecisionInput(response), usage: response?.usage ?? null };
}

// ── The batch transport surface (P5, §3.3) — the Doug submit→poll shape ──────
// Thin client wrappers ONLY (the sole-importer rule is why they live here);
// batch state, harvest validation, and dispositions live in
// mandateBatchTransport.js. Params nest inside requests[].params, built through
// the SAME buildMandateRequest as direct transport (deny-unknown per request,
// cache marker included) — one construction site, byte-equal request params
// across transports.

/**
 * Create one Anthropic Message Batch from per-book request specs. Each spec's
 * customId is the deterministic requestId (F2) — the join key the harvest
 * matches results back on. Seats may differ per request (books pin different
 * vintages); each request carries its own params.
 *
 * @param {Array<{ customId: string, modelSeat: object, content: object }>} requestSpecs
 * @returns {Promise<object>} the provider batch object ({ id, processing_status, ... })
 */
export async function createMandateBatch(requestSpecs) {
  if (!Array.isArray(requestSpecs) || requestSpecs.length === 0) {
    throw new Error('createMandateBatch: at least one request spec required');
  }
  const requests = requestSpecs.map(({ customId, modelSeat, content }) => {
    if (!customId) throw new Error('createMandateBatch: customId (requestId) required per spec');
    return { custom_id: customId, params: buildMandateRequest(modelSeat, content) };
  });
  return getClient().messages.batches.create({ requests });
}

/** Poll one batch's processing status ({ processing_status, request_counts, ended_at, ... }). */
export async function retrieveMandateBatch(providerBatchId) {
  return getClient().messages.batches.retrieve(providerBatchId);
}

/** The per-request results stream (async iterable of { custom_id, result }). */
export async function mandateBatchResults(providerBatchId) {
  return getClient().messages.batches.results(providerBatchId);
}

/**
 * Cancel a batch provider-side (drain protocol F26 / age-out §6.4). Best-effort
 * by contract: requests already processing may still complete provider-side —
 * which is safe, because the caller writes terminal dispositions FIRST and the
 * decision-doc claim makes any late result a no-op.
 */
export async function cancelMandateBatch(providerBatchId) {
  return getClient().messages.batches.cancel(providerBatchId);
}
