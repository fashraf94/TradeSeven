// api/_utils/directiveGate.js
//
// Archetype-Integrity / "Third Path" — Phase E1, the DETERMINISTIC DIRECTIVE GATE.
// This is the keystone: at the single chat.js directive chokepoint, the ONLY
// directive body that can ever be persisted is a verbatim canonical allowlist
// string for the agent's own archetype. A core-reversing ask can never become a
// directive — there is no id to select for it, and the gate writes null.
//
// The model's `_archetypeProposal` is UNTRUSTED. The gate validates it against
// the archetype's allowlist (src/data/archetypeAdjustments.js — the no-fallback
// directive-write helpers) and decides; it never copies model free-text into a
// directive. `originalUserAsk` is NEVER read into directive.text.
//
// Manifest-INDEPENDENT by design: the decision is a function of (effectiveArchetype,
// classification, selectedAdjustmentId) only — `user_lever` maps to null from the
// classification, never from whether the lever is live. (E2 wires the manifest into
// the PROMPT; the gate never reads it back.)

import { getAllowlist, isValidAdjustmentId, getCanonicalText } from '../../src/data/archetypeAdjustments.js';
import { parseVoiceLayerResponse } from './gemmaClient.js';

// The one-shot repair-retry is BUDGET-AWARE. chat.js clears the first call's 15s
// abort timer the instant it resolves, so the parent signal alone would never bound
// the repair — leaving it free to run up to its own cap and risk overrunning
// maxDuration:30 (killing the awaited Firestore write mid-flight). So the caller
// passes an absolute `deadlineMs` for the whole turn (set well inside maxDuration),
// and the repair is bounded by whichever is smaller: its own cap, or the time left
// to that deadline. If too little remains (a slow first call), the repair is SKIPPED
// and the gate returns the deterministic null. THIS is what makes "best-effort under
// the remaining budget" real.
const REPAIR_TIMEOUT_MS = 8000; // hard cap on a single repair call
const MIN_REPAIR_MS = 1500;     // with less budget than this remaining, don't bother

// The one deterministic, code-owned line (#6): surfaced when a gated turn writes
// no directive after a failed repair, so a null-write turn never *implies* an
// action even if the model's prose is untrustworthy. A single canned string —
// never intent-mapping (which would re-open the R1-rejected surface).
export const NO_CHANGE_FALLBACK_LINE = "Talked it through — I didn't change my strategy on this one.";

const VALID_CLASSIFICATIONS = new Set(['in_archetype', 'flex', 'core_conflict', 'user_lever', 'research_only']);
const DELIBERATE_NULL = new Set(['core_conflict', 'user_lever', 'research_only']);

// Read + shape-validate the untrusted proposal. Returns the proposal object or null.
function readProposal(parsed) {
  const p = parsed && parsed._archetypeProposal;
  if (!p || typeof p !== 'object' || typeof p.classification !== 'string' || !VALID_CLASSIFICATIONS.has(p.classification)) {
    return null;
  }
  return p;
}

// Evaluate a (possibly null) proposal against the archetype allowlist.
// Returns either a terminal verdict {directive, hasDirective, status} or
// {needsRepair:true, reason} when a one-shot repair could fix it.
function evaluate(proposal, effectiveArchetype) {
  if (!proposal) return { needsRepair: true, reason: 'no_proposal' };
  if (DELIBERATE_NULL.has(proposal.classification)) {
    return { directive: null, hasDirective: false, status: 'no_change' };
  }
  // classification is in_archetype | flex → an adjustment is expected.
  const id = proposal.selectedAdjustmentId;
  if (id && isValidAdjustmentId(effectiveArchetype, id)) {
    return {
      directive: { text: getCanonicalText(effectiveArchetype, id), expiry: 'end_of_battle' },
      hasDirective: true,
      status: 'committed',
    };
  }
  return { needsRepair: true, reason: 'invalid_id' };
}

// One-shot schema-only repair. Re-asks Gemma to re-emit a VALID _archetypeProposal,
// keeping the original user-facing response. Returns the repaired proposal or null.
async function attemptRepair({ callGemmaVoice, systemPrompt, conversationHistory, userMessage, signal, effectiveArchetype, deadlineMs }) {
  // Budget gate. The repair runs only if there's real headroom left to the turn
  // deadline: skip on an already-aborted parent, or when less than MIN_REPAIR_MS
  // remains (a slow first call ate the budget) — either way → deterministic null.
  // The repair's own cap is clamped DOWN to whatever the deadline still allows, so
  // it can never push the awaited Firestore write past maxDuration.
  const remaining = typeof deadlineMs === 'number' ? deadlineMs - Date.now() : REPAIR_TIMEOUT_MS;
  if (signal?.aborted || remaining < MIN_REPAIR_MS) return null;
  const budget = Math.min(REPAIR_TIMEOUT_MS, remaining);
  const ids = getAllowlist(effectiveArchetype).map((a) => a.id).join(', ');
  const repairPrompt =
    `${systemPrompt}\n\nREPAIR: your previous reply omitted or mis-formed the _archetypeProposal. ` +
    `Re-emit the SAME conversational response, but include a valid _archetypeProposal: ` +
    `selectedAdjustmentId MUST be exactly one of [${ids}], OR set classification to one of ` +
    `core_conflict | user_lever | research_only with selectedAdjustmentId null. Return the full JSON.`;

  const retryController = new AbortController();
  const timer = setTimeout(() => retryController.abort(), budget);
  const onAbort = () => retryController.abort();
  signal?.addEventListener?.('abort', onAbort);
  try {
    const raw = await callGemmaVoice({
      systemPrompt: repairPrompt,
      conversationHistory,
      userMessage,
      signal: retryController.signal,
    });
    return readProposal(parseVoiceLayerResponse(raw));
  } catch {
    return null; // abort or transport error → deterministic null
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

function result(directive, hasDirective, proposal, status, repairUsed, fallbackLine = null) {
  return {
    directive,
    hasDirective,
    fallbackLine,
    outcome: {
      classification: proposal?.classification ?? null,
      selectedAdjustmentId: proposal?.selectedAdjustmentId ?? null,
      status,
      repairUsed,
    },
  };
}

/**
 * Gate a (battle-mode, flag-ON) chat turn's directive proposal.
 * Caller guarantees mode==='battle' and ARCHETYPE_INTEGRITY_MODE!=='off'.
 *
 * @returns {{ directive:{text,expiry}|null, hasDirective:boolean,
 *             fallbackLine:string|null,
 *             outcome:{classification, selectedAdjustmentId, status, repairUsed} }}
 */
export async function gateDirective({
  parsed,
  effectiveArchetype,
  mode, // caller-guaranteed 'battle'; kept for contract clarity
  callGemmaVoice,
  systemPrompt,
  conversationHistory,
  userMessage,
  signal,
  deadlineMs, // absolute ms ceiling for the whole turn; bounds the repair (see header)
}) {
  // 1. Unknown/missing archetype → null + integrity log (BEFORE any proposal read).
  if (!effectiveArchetype || getAllowlist(effectiveArchetype).length === 0) {
    console.error('[ArchetypeGate] integrity: gated turn with no resolvable archetype', {
      effectiveArchetype: effectiveArchetype ?? null,
      mode,
    });
    return result(null, false, null, 'no_archetype', false);
  }

  let proposal = readProposal(parsed);
  let verdict = evaluate(proposal, effectiveArchetype);
  let repairUsed = false;

  // 2 / 4. One-shot repair on a fixable miss (no_proposal | invalid_id).
  if (verdict.needsRepair) {
    repairUsed = true;
    const repaired = await attemptRepair({
      callGemmaVoice, systemPrompt, conversationHistory, userMessage, signal, effectiveArchetype, deadlineMs,
    });
    if (repaired) {
      proposal = repaired;
      verdict = evaluate(repaired, effectiveArchetype);
    }
  }

  // Still unfixable (or repair skipped) → deterministic null + canned fallback line.
  if (verdict.needsRepair) {
    return result(null, false, proposal, verdict.reason, repairUsed, NO_CHANGE_FALLBACK_LINE);
  }

  // Terminal verdict: deliberate-null classification, or a committed valid id.
  return result(verdict.directive, verdict.hasDirective, proposal, verdict.status, repairUsed);
}

export default gateDirective;
