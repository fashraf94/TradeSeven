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
// directive. `originalUserAsk` is NEVER read into directive.text — it is
// PERSISTED on the gate record (see result()) so a mis-filing can be traced,
// which is a different thing from being trusted.
//
// Manifest-INDEPENDENT by design: the decision is a function of (effectiveArchetype,
// classification, selectedAdjustmentId) only — `user_lever` maps to null from the
// classification, never from whether the lever is live. (E2 wires the manifest into
// the PROMPT; the gate never reads it back.)

import { getAllowlist, isValidAdjustmentId, getCanonicalText, getCanonicalTextVersion } from '../../src/data/archetypeAdjustments.js';
import { parseVoiceLayerResponse } from './gemmaClient.js';
// The no-change status line lives in the zero-import src/data/decisionRecord.js
// (voice-layer grounding §6.3): the clients render it from the persisted
// exchange, so the string is ONE source for the server's response and both
// surfaces. Re-exported here under its shipped name.
import { NO_CHANGE_STATUS_LINE } from '../../src/data/decisionRecord.js';
// BUILD_RULES §4 — an api/ -> src/ import, so it needs a DEPENDENCY-SURFACE
// GUARD: directiveGate.test.js's own import of this module IS that guard. It
// explodes in the Node test env the day a browser dependency enters this
// graph, and it MUST NEVER BE MOCKED — a `vi.mock` of featureFlags.js added to
// that file would silently disarm it. featureFlags.js is zero-import today, so
// the graph stays Node-clean (the whole graph is six modules, none with a bare
// specifier). Read at CALL time inside evaluate(), never captured at module
// scope.
import { DIRECTIVE_FIT_CHECK_ENABLED } from '../../src/config/featureFlags.js';
// The ONE sanitize path for chat-turn free text — the same transform chat.js
// applies to `userMessage`, so the model's own text on the record is cleaned
// exactly as the player's is (see the forensics fields on result()).
import { sanitizeOptionalChatText } from './chatTextSanitize.js';

// The one-shot repair-retry is BUDGET-AWARE. chat.js clears the first call's
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

// Phase H backstop — the AUTHORITATIVE, code-rendered truth-of-record for a turn.
// Honesty is a GUARANTEE, so it lives in code, not in prompt-following: this status
// is rendered from the gate outcome (hasDirective) ALONE — never from the model's
// prose. A null-write turn ALWAYS reports "no change," even if the prose over-claims.
// This is what makes "claimed-a-change-but-wrote-null" a STRUCTURAL zero. We do NOT
// touch or strip the prose (the R1-rejected path) — the status sits ALONGSIDE it as
// the truth the client surfaces; the prose stays the natural conversation.
export { NO_CHANGE_STATUS_LINE };

export function renderDirectiveStatus(hasDirective) {
  return hasDirective
    ? { directiveStatus: 'committed', directiveStatusLine: null }    // the committed `directive` text carries the change
    : { directiveStatus: 'no_change', directiveStatusLine: NO_CHANGE_STATUS_LINE };
}

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

// THE DIRECTIVE FIT CHECK (Phase 0 Q3/Q5) — the record refuses to file
// anything the agent did not say.
//
// The membership check proves the committed text is ON the archetype's menu.
// It has never proved the committed text is the one the reply was ABOUT: the
// reply and the proposal come out of one model call, the gate runs after, and
// nothing compares them. On Sep 14 the character said "trading Core momentum
// for a heavy Support floor", selected SP-05, and the gate filed "Spread
// across more names (diversify the chaos)" beneath it.
//
// So, under the flag, the id's canonical text must appear VERBATIM in the
// reply — which is exactly what the confirmation rule now asks the model to
// write (voiceLayerPrompt.js, commit B). Prompt and gate are one mechanism on
// one flag: a gate demanding a quote the prompt never requested would
// null-write every filing.
//
// Whitespace is normalized (a model that wraps or double-spaces its own quote
// still filed what it said); CASE IS NOT (the text is the text — a reply that
// re-cases the canonical sentence has paraphrased it).
//
// A paraphrase that files nothing is the mechanism working, not a failure: the
// turn becomes the deliberate null `fit_mismatch`, and on the wire it reports
// exactly what every other null-write turn reports — renderDirectiveStatus
// derives 'no_change' + NO_CHANGE_STATUS_LINE from hasDirective alone.
//
// WHAT THE PLAYER ACTUALLY SEES TODAY IS LESS THAN THAT, and the honest place
// to say so is here. Both client surfaces gate that line on the GROUNDING
// marker, not on the gate: AgentChat.jsx needs `_grounded`
// (= exchange.groundingVersion, stamped by chat.js only when the grounded
// prompt was sent) and useArenaEngine.js reads `grounded ? statusLine : null`.
// VOICE_GROUNDING_MODE is 'shadow', so nobody is grounded, so on the very path
// this check fires the line does not render: the player sees the over-claiming
// reply with no card under it and no "no change" line either. Strictly better
// than the incident — a wrong directive is no longer FILED, and the trading
// brain never reads one — but not yet honest on screen. The grounding walk
// closes it; until then it is a stated limit, not a claim.
// (Build report 20260916 §7, findings A7 / C2.)
const normalizeForQuote = (text) => text.replace(/\s+/g, ' ').trim();

function replyQuotesCanonical(replyText, canonical) {
  if (typeof replyText !== 'string' || typeof canonical !== 'string' || !canonical) return false;
  return normalizeForQuote(replyText).includes(normalizeForQuote(canonical));
}

// Evaluate a (possibly null) proposal against the archetype allowlist.
// Returns either a terminal verdict {directive, hasDirective, status} or
// {needsRepair:true, reason} when a one-shot repair could fix it.
//
// `replyText` is the reply of the FIRST model call — the one chat.js persists
// as `agentResponse` and shows the player. The repair re-asks only for a valid
// proposal ("re-emit the SAME conversational response") and its reply is
// discarded, so the original is the right and only comparand on both passes.
function evaluate(proposal, effectiveArchetype, replyText) {
  if (!proposal) return { needsRepair: true, reason: 'no_proposal' };
  if (DELIBERATE_NULL.has(proposal.classification)) {
    // core_conflict | user_lever | research_only never reach the fit check:
    // there is no id, so there is nothing to have quoted.
    return { directive: null, hasDirective: false, status: 'no_change' };
  }
  // classification is in_archetype | flex → an adjustment is expected.
  const id = proposal.selectedAdjustmentId;
  if (id && isValidAdjustmentId(effectiveArchetype, id)) {
    const canonical = getCanonicalText(effectiveArchetype, id);
    // The fit check runs AFTER membership passes, and only under the flag —
    // flag-off this whole branch is the pre-build code, byte for byte.
    if (DIRECTIVE_FIT_CHECK_ENABLED && !replyQuotesCanonical(replyText, canonical)) {
      return {
        directive: null,
        hasDirective: false,
        status: 'fit_mismatch',
        // What the record keeps about the refusal: the sentence that WOULD
        // have been filed, and that the reply did not carry it. No repair —
        // this is a deliberate null, not a malformed proposal.
        fitCheck: { expected: canonical, quoted: false },
      };
    }
    return {
      directive: {
        text: canonical,
        expiry: 'end_of_battle',
        // Release 2 (spec Phase 1 item 5): the minted id + its live text
        // version ride the directive record, so directive-vs-lean opposition
        // (conflict groups) and override rulings can bind to BOTH
        // canonicalTextVersions. Additive — under observe the caller still
        // discards the whole directive.
        adjustmentId: id,
        canonicalTextVersion: getCanonicalTextVersion(effectiveArchetype, id),
      },
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

// THE FORENSICS ARE THE FIRST CALL'S, ALWAYS (Codex #3).
//
// `attemptRepair` is a SCHEMA-only re-ask: it re-sends the same system prompt
// with a "re-emit the SAME conversational response" suffix and takes back a
// proposal. What comes back is a second model emission — its free-text fields
// are a re-invention of the ask, or absent, and either way they are not what
// the model understood when it first answered the player. Reading them off the
// repaired proposal would put a reconstruction on the record under a field name
// that promises an original.
//
// So the split is: the repaired proposal decides `classification` and
// `selectedAdjustmentId` (that is what the repair is FOR), and the FIRST
// proposal supplies all three forensics fields (that is what they are for).
//
// KNOWN LIMIT, stated rather than papered over: on a `no_proposal` turn the
// first emission failed shape validation, so there is no first proposal to read
// and all three are null — even if the raw object carried text. Recovering that
// would mean reading free text off an object that failed validation, which is a
// wider change than this one and is not in this addendum's scope. Pinned by a
// test row so the loss is visible rather than assumed.
const NO_FORENSICS = Object.freeze({ originalUserAsk: null, counterOfferText: null, rejectionReason: null });

function readForensics(proposal) {
  if (!proposal) return NO_FORENSICS;
  return {
    originalUserAsk: sanitizeOptionalChatText(proposal.originalUserAsk),
    counterOfferText: sanitizeOptionalChatText(proposal.counterOfferText),
    rejectionReason: sanitizeOptionalChatText(proposal.rejectionReason),
  };
}

function result(directive, hasDirective, proposal, status, repairUsed, fallbackLine = null, fitCheck = null, forensics = NO_FORENSICS) {
  return {
    directive,
    hasDirective,
    fallbackLine,
    outcome: {
      classification: proposal?.classification ?? null,
      selectedAdjustmentId: proposal?.selectedAdjustmentId ?? null,
      status,
      repairUsed,
      // THE FORENSICS FIELDS (Phase 0 Q7) — ADDITIVE AND ALWAYS ON, deliberately
      // NOT behind DIRECTIVE_FIT_CHECK_ENABLED.
      //
      // The gate's record has always kept the classification and the id, so one
      // can prove AFTER THE FACT that a directive was mis-filed — but never what
      // the model meant by it. The model's own reading of the ask, its
      // counter-offer and its stated reason for declining were computed, used,
      // and dropped. That is the one-way door in this build: a turn that goes by
      // without them is a turn whose intent can never be recovered, and no later
      // change can go back and fill it in. So they are on from merge, at every
      // flag state.
      //
      // Sanitized through the same path as `userMessage` (chatTextSanitize.js):
      // this is untrusted model text landing on a durable record beside the
      // player's own words. Absent, null, or non-string → null, never a coerced
      // "null" string. NEVER read into directive.text — the module header's
      // `originalUserAsk` rule is unchanged and unchanged-able.
      //
      // No surface renders these in this build; readers null-guard.
      //
      // Taken from the FIRST proposal, captured before any repair ran — NOT
      // from `proposal`, which by this point may be the repaired one. See
      // readForensics above for why.
      ...forensics,
      // Present ONLY on a fit_mismatch, so every other outcome's record shape
      // is unchanged — including every committed turn.
      ...(fitCheck ? { fitCheck } : {}),
    },
  };
}

/**
 * Gate a (battle-mode, flag-ON) chat turn's directive proposal.
 * Caller guarantees mode==='battle' and ARCHETYPE_INTEGRITY_MODE!=='off'.
 *
 * @returns {{ directive:{text,expiry,adjustmentId,canonicalTextVersion}|null,
 *             hasDirective:boolean,
 *             fallbackLine:string|null,
 *             outcome:{classification, selectedAdjustmentId, status, repairUsed,
 *                      originalUserAsk, counterOfferText, rejectionReason,
 *                      fitCheck?:{expected,quoted}} }}
 *
 * On a repaired turn the outcome mixes two emissions on purpose: the REPAIRED
 * proposal supplies `classification` and `selectedAdjustmentId`; the FIRST
 * supplies the three forensics fields (readForensics).
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

  // The reply this turn will persist and show — the fit check's comparand.
  const replyText = typeof parsed?.response === 'string' ? parsed.response : null;

  // The FIRST proposal, and the forensics read off it BEFORE any repair can
  // replace it. `proposal` is reassigned below; `forensics` never is.
  const firstProposal = readProposal(parsed);
  const forensics = readForensics(firstProposal);

  let proposal = firstProposal;
  let verdict = evaluate(proposal, effectiveArchetype, replyText);
  let repairUsed = false;

  // 2 / 4. One-shot repair on a fixable miss (no_proposal | invalid_id).
  if (verdict.needsRepair) {
    repairUsed = true;
    const repaired = await attemptRepair({
      callGemmaVoice, systemPrompt, conversationHistory, userMessage, signal, effectiveArchetype, deadlineMs,
    });
    if (repaired) {
      proposal = repaired;
      verdict = evaluate(repaired, effectiveArchetype, replyText);
    }
  }

  // Still unfixable (or repair skipped) → deterministic null + canned fallback line.
  if (verdict.needsRepair) {
    return result(null, false, proposal, verdict.reason, repairUsed, NO_CHANGE_FALLBACK_LINE, null, forensics);
  }

  // Terminal verdict: a deliberate-null classification, a committed valid id,
  // or (under the flag) the fit_mismatch null when the reply never said it.
  return result(verdict.directive, verdict.hasDirective, proposal, verdict.status, repairUsed, null, verdict.fitCheck ?? null, forensics);
}

export default gateDirective;
