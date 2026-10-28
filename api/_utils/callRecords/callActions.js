// api/_utils/callRecords/callActions.js
//
// Cockpit Build 1a — THE CALL DIRECTIVE FAMILY'S REGISTRY (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §6; contract Amendment B §12). SERVER ONLY.
//
// Three kinds — call_hold, call_go, call_pick — each with ONE canonical
// template, versioned `callActions.v1`, rendered from the STORED CALL only
// (never from player text). The same text is shown to the player and to the
// model. These kinds are NEVER in getAllowlist() or any menu projection
// (src/data/archetypeAdjustments.js is untouched; callActions.test.js pins the
// menus byte-identical) — a call directive is filed by the answer endpoint
// alone, against a stored call, never by id from a chip or a chat reply.
//
// Amendment B §12, the literal templates:
//   hold   — `Hold off on the ${symbol} ${direction === 'exit' ? 'exit' : 'entry'} until ${deadlineText}.`
//   go_now — `If ${symbol} ${side} ${fmtPrice(level)} ${deadlineText}, go ahead and ${…exit for X | bring it in for X}.`
//   pick   — `Bring in ${pickSymbol} for ${swapOut} at the next check.`
// ONE READING, STATED FOR THE AMENDMENT'S BLESSING: §4's `deadlineText` is a
// prepositional phrase ("by today's close", "before the battle ends"), which
// reads naturally after "If … above $161.00" but not after "until". The hold
// template therefore takes the SAME phrase with its leading preposition
// removed ("until today's close", "until the battle ends", "until the next
// check", "until 15:45") — untilText() below; nothing else differs from §12.
// The build report records this as a wording question for the framework chat.
//
// COACHING, NOT ENFORCEMENT: a filed directive is a request the agent reads
// at a later check. Nothing here, or anywhere in Build 1a, enforces an answer
// in any execution path.
//
// Cockpit Build 2b — `callActions.v2` (contract Amendment D, D-4 and D-7; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-4). The three v1 templates are untouched
// (callActions.test.js pins them byte for byte). v2 adds, behind the flag
// argument `{ v2 }` the endpoint passes from isCockpit2bOn():
//   call_replace              `If you exit ${OUT} ${deadlineText}, bring in ${IN}.`
//   call_go with a chosen IN  v1's call_go template with IN in the counterpart
//                             clause — rendered BY that template (the call with
//                             its counterpart set to IN), so the two are equal
//                             byte for byte by construction: "…go ahead and
//                             exit for DHR." is the sentence the agent already
//                             reads when it names its own replacement
// and every v2 filing carries `textVersion: 'callActions.v2'`. A filing with
// the flag off is v1's exactly — its kind, text, action, answerId and
// `textVersion: 'callActions.v1'` (the flag-off endpoint behaves as at HEAD).
// The chosen name lives in the directive's own record (`action.pickSymbol`),
// never on the call's playerResponse (D-4; the pick precedent).
//
// ELIGIBILITY (D-7, one "can this name come in?" test — swappable.js):
//   · the chosen name (`call_replace`; `call_go` with a name) must pass
//     canComeIn against OUT at the filing instant (pick_* reasons);
//   · FROM MERGE, flag or not: the agent's OWN exit counterpart on a call_go
//     must still pass it → otherwise `counterpart_unavailable`.
//
// Pure. No I/O.

import { fmtPrice, deadlineText } from './copy.js';
import { answerIdOf } from './events.js';
import { canComeIn } from './swappable.js';

export const CALL_DIRECTIVE_FAMILY = 'call';
export const CALL_ACTIONS_TEXT_VERSION = 'callActions.v1';
export const CALL_ACTION_KINDS = Object.freeze(['call_hold', 'call_go', 'call_pick']);
/** Build 2b (D-4): the registry version every filing made with the 2b flag on carries. */
export const CALL_ACTIONS_TEXT_VERSION_V2 = 'callActions.v2';
/** Build 2b (D-4): the v2 registry's kinds — v1's three and `call_replace`. */
export const CALL_ACTION_KINDS_V2 = Object.freeze([...CALL_ACTION_KINDS, 'call_replace']);
/** The bounded advisory lifetime's grace for next_check (Amendment B §4): the slot plus 15 minutes. */
export const NEXT_CHECK_LIFETIME_GRACE_MS = 900_000;
/** The slot expiry word the family uses (spec §6). */
export const CALL_DIRECTIVE_EXPIRY = 'until_ms';

const TIERS = Object.freeze(['star', 'core', 'support']);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** §4's deadline phrase after "until": the same phrase, its leading preposition dropped. */
export function untilText(horizon, { nowMs = Date.now() } = {}) {
  const phrase = deadlineText(horizon, { nowMs });
  if (!phrase) return null;
  if (phrase === 'before the battle ends') return 'the battle ends';
  return phrase.replace(/^(by|before) /, '');
}

/** The call directive's lifetime end (Amendment B §4): the horizon's expiry, plus 15 minutes for next_check. */
export function callDirectiveExpiresAtMs(call) {
  const expiresAt = call?.horizon?.expiresAt;
  if (!finite(expiresAt)) return null;
  return call.horizon.basis === 'next_check' ? expiresAt + NEXT_CHECK_LIFETIME_GRACE_MS : expiresAt;
}

/**
 * Which kind an answer files against a call, or null when the answer files
 * nothing for this call (an acknowledgment, or an illegal pairing — the
 * endpoint decides legality; this only names the directive kind).
 *   hold    on an act-default shot/confirmation → call_hold
 *   go_now  on a hold-default shot             → call_go
 *   pick    on a pick                          → call_pick
 *   replace on an act-default exit (v2 only)   → call_replace
 */
export function directiveKindFor(call, answer, { v2 = false } = {}) {
  if (!call || typeof call !== 'object') return null;
  if (call.kind === 'pick') return answer === 'pick' ? 'call_pick' : null;
  if (answer === 'hold' && call.defaultAction === 'act') return 'call_hold';
  if (answer === 'go_now' && call.defaultAction === 'hold') return 'call_go';
  if (v2 && answer === 'replace' && call.defaultAction === 'act' && call.direction === 'exit') return 'call_replace';
  return null;
}

/** The canonical text for a kind, from the stored call (and the selected pick / chosen name). Null when a stored field is missing. */
export function renderCallActionText(kind, call, { pickSymbol = null, nowMs = Date.now() } = {}) {
  if (!call || typeof call !== 'object') return null;
  if (kind === 'call_hold') {
    const until = untilText(call.horizon, { nowMs });
    if (!nonEmpty(call.symbol) || !until) return null;
    return `Hold off on the ${call.symbol} ${call.direction === 'exit' ? 'exit' : 'entry'} until ${until}.`;
  }
  if (kind === 'call_go') {
    // v2 (D-4): a chosen name rides v1's own counterpart clause — the same template, IN substituted.
    if (nonEmpty(pickSymbol)) return renderCallActionText('call_go', { ...call, counterpart: pickSymbol }, { nowMs });
    const side = call.condition?.side;
    const level = call.condition?.level;
    const deadline = deadlineText(call.horizon, { nowMs });
    if (!nonEmpty(call.symbol) || (side !== 'above' && side !== 'below') || !finite(level) || !deadline) return null;
    const counterpart = nonEmpty(call.counterpart) ? ` for ${call.counterpart}` : '';
    const action = call.direction === 'exit' ? `exit${counterpart}` : `bring it in${counterpart}`;
    return `If ${call.symbol} ${side} ${fmtPrice(level)} ${deadline}, go ahead and ${action}.`;
  }
  if (kind === 'call_pick') {
    if (!nonEmpty(pickSymbol) || !nonEmpty(call.swapOut)) return null;
    return `Bring in ${pickSymbol} for ${call.swapOut} at the next check.`;
  }
  if (kind === 'call_replace') {
    const deadline = deadlineText(call.horizon, { nowMs });
    if (!nonEmpty(call.symbol) || !nonEmpty(pickSymbol) || !deadline) return null;
    return `If you exit ${call.symbol} ${deadline}, bring in ${pickSymbol}.`;
  }
  return null;
}

/** The symbols held in one tier of the battle's book. */
function heldIn(battle, tier) {
  const rows = battle?.portfolio?.[tier];
  return Array.isArray(rows) ? rows.map((r) => r?.symbol).filter(nonEmpty) : null;
}

/**
 * Is the stored action eligible NOW (spec §5 row 7)? A dead slot or a symbol
 * already moved must not receive text implying a still-available trade.
 *   call_hold / call_go — the slot tier exists; an exit's symbol is still held
 *     there; an entry's counterpart (when declared) is still held there.
 *   call_pick — the selected option is one of the stored options, not held
 *     anywhere; the slot tier exists and still holds the stored swapOut; and
 *     (BaggerBomb cleanup C3) the selected name can come in for that swapOut —
 *     canComeIn, the swap's own lists, the test an exit's replacement already
 *     passes. The battle universe is not the test: it holds the equipped
 *     snapshot, so an equipped-only ticker (KRE) was in it and could be
 *     offered, filed and then refused by the executor.
 * Build 2b (D-7):
 *   call_go on an exit whose agent counterpart no longer passes canComeIn →
 *     counterpart_unavailable (from merge);
 *   call_replace, and call_go with a chosen name (v2) — the exit's symbol
 *     still held in the slot, then the chosen name through canComeIn (the
 *     pick_* reasons). `atMs` is the filing instant (Date.now() by default).
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function isCallActionEligible(kind, call, battle, { pickSymbol = null, atMs = Date.now() } = {}) {
  if (!CALL_ACTION_KINDS_V2.includes(kind)) return { ok: false, reason: 'unknown_kind' };
  const slot = call?.slot;
  if (!TIERS.includes(slot)) return { ok: false, reason: 'slot_unknown' };
  const held = heldIn(battle, slot);
  if (!held) return { ok: false, reason: 'slot_missing' };
  if (kind === 'call_pick') {
    const options = Array.isArray(call?.options) ? call.options.map((o) => o?.symbol) : [];
    if (!nonEmpty(pickSymbol) || !options.includes(pickSymbol)) return { ok: false, reason: 'pick_not_an_option' };
    if (TIERS.some((t) => (heldIn(battle, t) || []).includes(pickSymbol))) return { ok: false, reason: 'pick_already_held' };
    if (!nonEmpty(call?.swapOut) || !held.includes(call.swapOut)) return { ok: false, reason: 'swap_out_not_held' };
    // The two book reasons above stay first (retire.js reads them as D-6 book reasons); the rest is canComeIn's.
    const verdict = canComeIn({ battle, out: call.swapOut, slot, inSymbol: pickSymbol, atMs });
    return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
  }
  if (call?.direction === 'exit') {
    if (!held.includes(call.symbol)) return { ok: false, reason: 'symbol_not_held' };
    // D-4 / D-7: a chosen name (call_replace always carries one; call_go may) must be able to come in now.
    if (kind === 'call_replace' || (kind === 'call_go' && nonEmpty(pickSymbol))) {
      const verdict = canComeIn({ battle, out: call.symbol, slot, inSymbol: pickSymbol, atMs });
      return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
    }
    // D-7 (from merge): the agent's own replacement on a call_go must still be able to come in.
    if (kind === 'call_go' && nonEmpty(call.counterpart) && !canComeIn({ battle, out: call.symbol, slot, inSymbol: call.counterpart, atMs }).ok) {
      return { ok: false, reason: 'counterpart_unavailable' };
    }
    return { ok: true };
  }
  if (kind === 'call_replace') return { ok: false, reason: 'direction_unknown' };
  if (call?.direction === 'entry') {
    if (nonEmpty(call.counterpart) && !held.includes(call.counterpart)) return { ok: false, reason: 'counterpart_not_held' };
    return { ok: true };
  }
  return { ok: false, reason: 'direction_unknown' };
}

/**
 * The validated filing plan the shared writer takes (spec §6): the slot's
 * call fields and the canonical text, from the stored call only. Null when
 * the kind, the text or the lifetime cannot be derived.
 *
 * `pickSymbol` is the selected pick (call_pick) or, with `{ v2: true }`, the
 * chosen name of a call_replace or a named call_go (D-4): the slot's
 * `action` then carries `{ direction: 'exit', symbol: OUT, slot, pickSymbol: IN }`
 * and the answerId names IN.
 */
export function buildCallDirectivePlan({ call, answer, pickSymbol = null, nowMs = Date.now(), filedAt, v2 = false }) {
  const kind = directiveKindFor(call, answer, { v2 });
  if (!kind) return null;
  // Without v2 a chosen name exists only for a pick (HEAD's wire drops it for every other answer).
  const chosen = kind === 'call_pick' || (v2 && (kind === 'call_replace' || kind === 'call_go') && call.direction === 'exit' && nonEmpty(pickSymbol)) ? pickSymbol : null;
  const text = renderCallActionText(kind, call, { pickSymbol: chosen, nowMs });
  const expiresAtMs = callDirectiveExpiresAtMs(call);
  if (!text || !finite(expiresAtMs)) return null;
  const named = kind !== 'call_pick' && nonEmpty(chosen);
  const action = named
    ? { direction: 'exit', symbol: call.symbol ?? null, slot: call.slot ?? null, pickSymbol: chosen }
    : {
      direction: call.direction ?? null,
      symbol: call.symbol ?? null,
      slot: call.slot ?? null,
      ...(nonEmpty(call.counterpart) ? { counterpart: call.counterpart } : {}),
      ...(kind === 'call_pick' ? { pickSymbol, swapOut: call.swapOut ?? null } : {}),
    };
  return {
    kind,
    text,
    normalized: {
      text,
      expiry: CALL_DIRECTIVE_EXPIRY,
      family: CALL_DIRECTIVE_FAMILY,
      expiresAtMs,
      basis: call.horizon?.basis ?? null,
      callId: call.callId,
      kind,
      action,
      answerId: answerIdOf(call.callId, answer, chosen),
      filedAt,
      textVersion: v2 ? CALL_ACTIONS_TEXT_VERSION_V2 : CALL_ACTIONS_TEXT_VERSION,
    },
  };
}
