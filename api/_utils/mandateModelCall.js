// api/_utils/mandateModelCall.js
//
// Spec 1 — Mandate Substrate — the MODEL SEAM (§3.3). THE ONLY MODULE IN THE
// BOOK CONTEXT PERMITTED TO IMPORT THE ANTHROPIC CLIENT (AST/scan-enforced by
// mandateModelCall.imports.test.js — the wireModelCall precedent). Provider,
// model, and params come from the pinned vintage's model seat
// (mandateGenerationConfig.js), never a live config read.
//
// P2 = DIRECT TRANSPORT ONLY (MANDATE_TRANSPORT_MODE 'direct'). The batch
// transport, the drain protocol, prompt caching, and the last-tick rule are P5 —
// not built here. The submission envelope (F1) and its deterministic requestId
// (F2) ARE built now: they are the base-state identity every request carries and
// the harvest validates against (mandateExecution.validateEnvelope).
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
 * token usage. Batch transport is P5.
 *
 * @param {object} modelSeat  from the pinned vintage / mandateGenerationConfig
 * @param {object} content    { system, messages, tools, tool_choice? }
 */
export async function callMandateModelDirect(modelSeat, content) {
  const request = buildMandateRequest(modelSeat, content);
  const response = await getClient().messages.create(request);
  return { response, decision: extractDecisionInput(response), usage: response?.usage ?? null };
}
