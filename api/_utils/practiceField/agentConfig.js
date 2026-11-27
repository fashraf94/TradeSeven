// api/_utils/practiceField/agentConfig.js
//
// Practice Field build B2 (T1b + T1d, launch scope) — THE AGENT'S FIXED NUMBERS AND ITS TWO DESKS, in one place.
// Pure data and two pure lookups; no store, no clock, no client.
//
// THE MODEL (ruling B2-5): one constant, `claude-sonnet-5-5`, priced in api/_utils/modelPriceTable.js from Anthropic's
// official page (read 2026-11-23). The call goes through the Mandate engine's model seam (mandateModelCall.js
// callMandateModelDirect), which is called, never edited: its seat carries the model and `max_tokens` only (no
// temperature — Sonnet 5.5 refuses a non-default one), and its content allowlist (system, messages, tools,
// tool_choice) leaves no way to set thinking or effort, so the model runs its default adaptive thinking, billed as
// output inside `max_tokens`. Sonnet 5.5 refuses a FORCED tool choice, so the request asks with `auto` (at most one
// tool call) and the prompt names the one tool; an answer without it is invalid and falls back to code.
//
// THE MOST ONE CALL CAN COST (spend.js maxCallChargeMicros). The input ceiling is counted in UTF-8 BYTES of everything
// sent — the system blocks, the messages and the tool definition's JSON — because a token always covers at least one
// byte: a prompt of N bytes can never be billed more than N input tokens. To it is added a fixed allowance for the
// tool-use system prompt the API adds and the message framing (published for Sonnet 5.5 with `auto`: 286 tokens; the
// `tool` cell is blank, so 1,000 is allowed). The output ceiling is `max_tokens` itself. So a call can never be billed
// past its reservation, and PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD (constants.js) is this maximum — a test binds them.
//
// THE TWO DESKS (ruling B2-7). The book is managed by a team of two — named here by the engine's own ids, which the model
// is never told (build B6, ruling B6-1: agentPrompt.js describes each desk in plain words): the Shadow desk (medium and long slots; the
// player's Command Center agent under a fixed Practice Field brief; the price list and, behind their sub-switch, the
// owner's saved theses) and the archetype desk (the short slot; the frozen archetype identity of the book's epoch;
// the price list only, and it says it has no chart evidence). A desk drafts only for its slots and acts only on its
// own ideas. Each idea records its desk at admission; an idea admitted without one (the founder's hand-entered
// ideas) belongs to the desk of its slot.

import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';

/** Ruling B2-5: the agent's model, as one constant. */
export const PRACTICE_FIELD_AGENT_MODEL = 'claude-sonnet-5-5';

/**
 * The declared output cap: `max_tokens` on every request, and the reservation's output ceiling. Thinking runs inside it
 * (the seam cannot turn it off), so it is the thinking and the answer together.
 */
export const AGENT_MAX_OUTPUT_TOKENS = 6_000;

/** The fixed input ceiling: UTF-8 bytes of the system blocks + the messages + the tool's JSON. */
export const AGENT_INPUT_BYTES_CEILING = 40_000;

/** The allowance for what the API adds around a tool call (the tool-use system prompt; the message framing). */
export const AGENT_TOOL_OVERHEAD_TOKENS = 1_000;

/** The reservation's input ceiling: every byte at most one token, plus the allowance. */
export const AGENT_MAX_INPUT_TOKENS = AGENT_INPUT_BYTES_CEILING + AGENT_TOOL_OVERHEAD_TOKENS;

/**
 * How long one call may take before it counts as a transport failure. Sized so that a FULL-LENGTH answer fits: 6,000
 * output tokens in 110 s is about 55 tokens a second, and an answer that uses its whole cap at a slower rate times out (and
 * is charged its whole reservation, then retried once). The cron's budget is 290 s of a 300-s function, and the book's
 * lease lasts 300 s: two desks of one call each fit one fire; a retry pushes the second desk to the next close fire
 * (fifteen minutes later — the deadline guard, agentRun.js), never past the lease.
 */
export const AGENT_CALL_TIMEOUT_MS = 110_000;

/** One call and, on a transport failure only, one retry — each reserved under its own operation. */
export const AGENT_MAX_ATTEMPTS = 2;

/** B11: the bounds on the agent's text. */
export const AGENT_NOTE_MAX_CODE_POINTS = 600;
export const AGENT_REASON_MAX_CODE_POINTS = 280;
/** B6: drafts per call. */
export const AGENT_DRAFTS_PER_CALL = PRACTICE_FIELD_SLOTS.B6_DRAFTS_PER_CALL;

/** How many of the desk's own earlier notes the prompt carries. */
export const AGENT_PRIOR_NOTES = 3;
/** How far back (sessions) the prompt looks for those notes before it stops. */
export const AGENT_PRIOR_NOTES_LOOKBACK_SESSIONS = 10;

/** PF-5: the owner's most recent saved theses the Shadow desk may read, and the read's own bound. */
export const AGENT_THESES_MAX = 5;
export const AGENT_THESES_QUERY_LIMIT = 50;
/** Each saved thesis, as quoted to the model, at most (code points per text field; names; price lines). */
export const AGENT_THESIS_TEXT_MAX = 400;
export const AGENT_THESIS_REASONS_MAX = 4;

/** The note code writes when the check could not be completed (§1). */
export const CODE_FALLBACK_NOTE = "The agent could not complete today's check; nothing changed.";

/** Where a desk part's note came from. `no_work`: the desk had no open idea and no slot to fill, and made no call. */
export const AGENT_NOTE_SOURCE = Object.freeze({ MODEL: 'model', CODE_FALLBACK: 'code_fallback', NO_WORK: 'no_work' });

/** The result words the agent's text may never carry (concept V6.1 §4; the honesty rules). */
export const BANNED_AGENT_WORDS = /\b(validated|proven|supported)\b/i;

/** The actions at launch (ruling B2-1). */
export const AGENT_ACTIONS = Object.freeze(['hold', 'exit']);

/** Why an idea's early settlement was asked for: the settlement sale's reason (ruling B2-1). */
export const MANAGER_EXIT_REASON = 'manager_exit';

/** The two desks (ruling B2-7). */
export const DESKS = Object.freeze({
  shadow: Object.freeze({ id: 'shadow', name: 'The Shadow desk', slots: Object.freeze(['medium', 'long']), readsTheses: true }),
  archetype: Object.freeze({ id: 'archetype', name: 'The archetype desk', slots: Object.freeze(['short']), readsTheses: false }),
});
export const DESK_IDS = Object.freeze(['shadow', 'archetype']);

/** The desk a slot belongs to, or null. */
export function deskOfSlot(slot) {
  for (const id of DESK_IDS) if (DESKS[id].slots.includes(slot)) return id;
  return null;
}

/** The desk an idea belongs to: the one frozen with its contract, else the desk of its slot. */
export function deskOfIdea(idea) {
  const frozen = idea?.contract?.desk;
  if (DESK_IDS.includes(frozen)) return frozen;
  return deskOfSlot(idea?.contract?.slot);
}

/**
 * THE SHADOW DESK'S FIXED PRACTICE FIELD BRIEF (ruling B2-7). Fixed text, versioned: it is the desk's identity in the
 * book and nothing of the player's deployed agent (its memory, lessons or conversations) is added to it.
 * Version 2 (build B6, ruling B6-1): the model is told what the desk IS, in plain words — the player's own agent on the
 * medium and long slots — and is never told a desk name. Its first line only; the other two are version 1's, word for word.
 * (`DESKS[].name` stays: it is the engine's record of the desk on the close row and in the founder's script, never sent.)
 */
export const SHADOW_BRIEF_VERSION = 2;
export const SHADOW_BRIEF = [
  'You are the player\'s own agent, their Command Center agent, working the medium (30-session) and long (60-session) slots of this player\'s paper idea book.',
  'You are research-led. You hold a thesis over weeks and judge it against its own comparison (the matched benchmark named on each idea), not against day-to-day swings.',
  'A bad day is not a reason to exit. Exit only when the thesis itself no longer holds or something material changed; otherwise hold.',
].join('\n');
