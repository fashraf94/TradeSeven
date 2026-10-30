// src/screens/battleView/cockpitModel.js
//
// THE COCKPIT'S VIEW MODEL — Cockpit Build 2a (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §7). PURE: records in, tiles out. No
// React, no clock (the caller hands `nowMs` in), no I/O.
//
// EVERY LINE COMES FROM A RECORD FIELD. The plain line is the shared renderer
// (api/_utils/callRecords/copy.js — the very function the chat calls block
// uses); the buttons are the shared legality table
// (api/_utils/callRecords/answers.js — the very table the endpoint enforces);
// the tag is the one fact table in battleViewCopy.js. Nothing is inferred,
// nothing is optimistic: a tile changes when a record does.
//
//   groups      ⚡ Needs you · ⏱ Waiting on the check · 👁 Monitoring · Earlier (§7.1)
//   folding     open calls → cards. Cockpit Build 2b, Amendment D-12 rev 4
//               (from merge): ONE CARD PER STOCK PLAN — same ET day, symbol,
//               direction, slot, side, default action, at ANY level (C-6's
//               key minus the level) — the newest call's wording; nothing
//               merged in a record. D-10: a restatement under your LIVE
//               command joins the answered call's card even across defaults.
//               The 1 % test now decides COVERAGE, not membership: a call more
//               than 1 % from the answered call's level is a NEW ASK on the
//               card, with its own buttons, counted in Needs you
//   tags        §7.4 — record facts only, by a fixed precedence below
//   buttons     §7.3 — at most two: the agreeing answer, then the override
//               (one message); none on an upside call (C-2) or a pick (not
//               shown in 2a), none on a call already answered, none on a
//               thread holding a LIVE directive answer (C-6 rev 3: its
//               directive still the battle's current one, live in the
//               slot); overrides
//               disabled while the answer endpoint would refuse them
//               (`overrideBlockOf` — the endpoint's own pending predicate)
//
// C-5: only records minted under 'on' ever reach this module's tiles — the
// readers (src/hooks/useCockpitRecords.js) drop the rest at the boundary, and
// `cockpitCalls` drops them again here so no caller can forget.

import {
  renderCallLine, isUpsideCall, checkLabel, deadlineText, fmtPrice, SAID_UNVERIFIED_LABEL,
} from '../../../api/_utils/callRecords/copy.js';
import { tileAnswersFor, replacementStepFor, isGoAcknowledgment, isExitNotHeld } from '../../../api/_utils/callRecords/answers.js';
import { etDateOf, sessionCloseAfter, nextEligibleSlot } from '../../../api/_utils/callRecords/horizon.js';
import { deriveKilledDirectiveIds } from '../../../api/_utils/controlPromptRenderer.js';
import { etTime, etSlotTime } from '../../components/Dashboard/desk/deskCopy';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS, COCKPIT_DROPPED_REASON_TEXT, cockpitRefusalLine } from './battleViewCopy';

export const COCKPIT_GROUP = Object.freeze({
  NEEDS_YOU: 'needsYou',
  WAITING: 'waiting',
  MONITORING: 'monitoring',
  EARLIER: 'earlier',
});

/** Amendment C-6's level tolerance, measured against the NEWER call's level. */
export const THREAD_LEVEL_TOLERANCE = 0.01;
/** Earlier shows ten until "Show all" (§7.1). */
export const EARLIER_SHOWN = 10;
/** Monitoring shows at most six names (the validator's own cap). */
export const MONITORING_MAX = 6;

const CLOCK = Object.freeze({ clock: '12h' });
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const msOf = (v) => {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return null;
};
const isoOf = (v) => { const ms = msOf(v); return ms === null ? null : new Date(ms).toISOString(); };

/** The 12-hour check label ("the 1:30 PM check") for an instant, or null. */
export const checkOf = (instant) => checkLabel(instant, CLOCK);

/** C-5: records minted under 'on' only (records without the field predate the amendment and are not shown). */
export function cockpitCalls(calls) {
  return (Array.isArray(calls) ? calls : []).filter((c) => c && typeof c === 'object' && c.mintedMode === 'on' && nonEmpty(c.callId));
}

/** callEvents grouped by every call id they name, each list oldest first. */
export function eventsByCall(events) {
  const map = new Map();
  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev || typeof ev !== 'object') continue;
    for (const id of Array.isArray(ev.callIds) ? ev.callIds : []) {
      if (!nonEmpty(id)) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(ev);
    }
  }
  for (const list of map.values()) list.sort((a, b) => (msOf(a.at) ?? 0) - (msOf(b.at) ?? 0));
  return map;
}

/** A retained check's promptBuiltAt by its evalId (battle.evaluations), or null. */
export function promptBuiltAtOf(evaluations, evalId) {
  if (!nonEmpty(evalId) || !Array.isArray(evaluations)) return null;
  for (let i = evaluations.length - 1; i >= 0; i -= 1) {
    const e = evaluations[i];
    if (e?.evalId === evalId) return isoOf(e.promptBuiltAt);
  }
  return null;
}

/** The newest retained evaluation that built a prompt — the prices' vintage (§5). */
export function latestPromptBuiltAt(evaluations) {
  if (!Array.isArray(evaluations)) return null;
  for (let i = evaluations.length - 1; i >= 0; i -= 1) {
    const iso = isoOf(evaluations[i]?.promptBuiltAt);
    if (iso) return iso;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Folding (Amendment C-6)

/**
 * The C-6 key of an OPEN call: ET day, symbol, direction, slot, side and
 * default action (Amendment C revision 2 — so a Confirmation the player
 * agreed to never folds with a later "I'll hold" call). Null when a part is
 * missing.
 */
export function threadKeyOf(call) {
  const minted = msOf(call?.mintedAt);
  const side = call?.condition?.side;
  if (minted === null || !nonEmpty(call?.symbol) || !nonEmpty(call?.direction) || !nonEmpty(call?.slot) || !nonEmpty(side) || !nonEmpty(call?.defaultAction)) return null;
  return `${etDateOf(minted)}|${call.symbol}|${call.direction}|${call.slot}|${side}|${call.defaultAction}`;
}

/** Are two calls' levels within 1 % of each other, measured against the NEWER call's level? */
export function levelsWithin(older, newer) {
  const a = older?.condition?.level;
  const b = newer?.condition?.level;
  if (!finite(a) || !finite(b) || b === 0) return false;
  return Math.abs(a - b) / Math.abs(b) <= THREAD_LEVEL_TOLERANCE;
}

const newestFirst = (a, b) => (msOf(b.mintedAt) ?? 0) - (msOf(a.mintedAt) ?? 0) || String(b.callId).localeCompare(String(a.callId));

/** Cockpit Build 2b (D-10 / D-12): the 1 % test, measured against the ANSWERED call's level — it decides coverage. */
export const COVERAGE_TOLERANCE = 0.01;

/** Is `call`'s level within 1 % of the answered call's level (D-10 / D-12 condition 1)? */
export function withinCoverage(answered, call) {
  const a = answered?.condition?.level;
  const b = call?.condition?.level;
  if (!finite(a) || !finite(b) || a === 0) return false;
  return Math.abs(b - a) / Math.abs(a) <= COVERAGE_TOLERANCE;
}

/** The default a command asks for (D-10): call_go → act, call_hold → hold, call_replace → act. */
const ASKED_DEFAULT = Object.freeze({ call_go: 'act', call_hold: 'hold', call_replace: 'act' });

/**
 * The battle's LIVE command (D-10; C-6 rev 3's live test, liveCallSlotOf): the
 * slot when it holds a live call directive whose answered call is loaded, with
 * the default it asks for and the name it chose (the slot's own action — never
 * playerResponse). Null otherwise.
 */
export function commandOf({ directive, calls, nowMs, controlEpochLog = null, suppressed = false } = {}) {
  const slot = liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed });
  if (!slot || !nonEmpty(slot.callId)) return null;
  const call = (Array.isArray(calls) ? calls : []).find((c) => c?.callId === slot.callId) ?? null;
  if (!call) return null;
  return {
    slot,
    call,
    threadId: slot.directiveThreadId,
    filedAtMs: msOf(slot.filedAt) ?? msOf(call.playerResponse?.filedAt),
    asksDefault: ASKED_DEFAULT[slot.kind] ?? null,
    chosen: nonEmpty(slot.action?.pickSymbol) ? slot.action.pickSymbol : null,
  };
}

/** The `declared` event of a call's minting check (it names the call in callIds), or null. */
function declaredEventOf(eventsMap, call) {
  return (eventsMap?.get?.(call?.callId) ?? []).find((e) => e?.kind === 'declared') ?? null;
}

/**
 * D-10 rev 2 — is `call` a RESTATEMENT UNDER the live `command`? All of: it is
 * open; minted after the command was filed; on the answered call's symbol,
 * direction, slot and side; within 1 % of its level; with the default the
 * command asked for; for a command that names who comes in, its own
 * counterpart null or that name; and minted at a check whose `declared` event
 * carries `promptDirectiveThreadId` equal to the command's thread — the command
 * was in that check's prompt (publish.js; prompt inclusion, never causation).
 * No `declared` event loaded, or another thread → not a restatement. Never the
 * answered call itself (V5-5).
 */
export function isFollowing(command, call, { eventsMap = new Map() } = {}) {
  if (!command || !call || call.state !== 'open') return false;
  const answered = command.call;
  if (call.callId === answered.callId) return false;
  const minted = msOf(call.mintedAt);
  if (!finite(minted) || !finite(command.filedAtMs) || minted <= command.filedAtMs) return false;
  if (call.symbol !== answered.symbol || call.direction !== answered.direction || call.slot !== answered.slot || call.condition?.side !== answered.condition?.side) return false;
  if (!withinCoverage(answered, call)) return false;
  if (!command.asksDefault || call.defaultAction !== command.asksDefault) return false;
  if (command.chosen && call.counterpart != null && call.counterpart !== command.chosen) return false;
  const declared = declaredEventOf(eventsMap, call);
  return Boolean(declared) && declared.promptDirectiveThreadId === command.threadId;
}

/**
 * Open calls → CARDS (Cockpit Build 2b, Amendment D-12 rev 4 — from merge):
 * ONE CARD PER STOCK PLAN. Two open calls share a card when their plan matches
 * — C-6's key (threadKeyOf: ET day, symbol, direction, slot, side, default
 * action) — at ANY level: the agent moving its line keeps one card. D-10's one
 * exception: a restatement under your LIVE command (isFollowing) joins the
 * answered call's card even when its default differs. Different plans for one
 * stock (an exit and an entry, opposite sides, an act and a hold default) stay
 * apart; a call missing a key part is a card of its own; resolved calls never
 * join. Each card's calls come newest first; cards come newest first by their
 * newest call.
 *
 * The command stays live while its SLOT does, not while its answered call is
 * open (D-10, C-6 rev 3's live test — review CB3-1): once the answered call has
 * hit or expired under a live slot, its restatements still fold together, on a
 * card of the command's own (`command:{thread}`), and still read "Following your
 * call" and offer no answer. A next_check command is judged at the very check
 * that hears it, so without this D-10 could never fire for one.
 *
 * @param {object[]} calls
 * @param {{ command?: object|null, eventsMap?: Map }} [opts]  commandOf(...) and the events (D-10)
 * @returns {Array<{ key: string, calls: object[] }>}
 */
export function foldThreads(calls, { command = null, eventsMap = new Map() } = {}) {
  const open = (Array.isArray(calls) ? calls : []).filter((c) => c?.state === 'open').sort(newestFirst);
  const commandKey = command
    ? (command.call?.state === 'open' ? threadKeyOf(command.call) : (nonEmpty(command.threadId) ? `command:${command.threadId}` : null))
    : null;
  const groups = new Map();
  for (const call of open) {
    let key = threadKeyOf(call) ?? `call:${call.callId}`;
    if (commandKey && isFollowing(command, call, { eventsMap })) key = commandKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(call);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, calls: list }));
}

/** The card's distinct open levels (by the price as shown), newest first, each with the newest call that drew it. */
export function distinctLevelsOf(thread) {
  const seen = new Map();
  for (const c of Array.isArray(thread) ? thread : []) {
    if (c?.state !== 'open' || !finite(c.condition?.level)) continue;
    const shown = fmtPrice(c.condition.level);
    if (!seen.has(shown)) seen.set(shown, c);
  }
  return [...seen.entries()].map(([price, call]) => ({ price, call }));
}

// ---------------------------------------------------------------------------
// Tags (§7.4)

/** The tag a fact row renders, or null (no row → no tag, never a guessed one). */
export function factTag(fact, params = {}) {
  const row = COCKPIT_FACT_TAGS[fact];
  if (!row) return null;
  return { fact, tone: row.tone, text: row.text(params) };
}

/**
 * The tag for ONE call, from its record facts:
 *   a terminal state first (acted · hit · expired · ended · dropped);
 *   an OPEN call the agent already acted on (`outcome.actedEvalId` — the
 *   flip's whole-trade match and the heard pass both stamp it on a call that
 *   stays open) → Acted, first (review L6-1);
 *   then the NEWEST of the event-backed facts about its answer — replaced ·
 *   no matching trade · heard — by the check (or instant) each names, ties in
 *   that order; then the answer itself (filed · agreed); else Live.
 * A filed directive reads "not yet heard" ONLY while it is still the battle's
 * current one — `slotThreadId`, the slot's live thread (liveCallSlotOf), is
 * its own (founder ruling Oct 4). Killed, expired or suppressed in the slot,
 * gone from it, or the slot taken by a later filing whose `superseded` event
 * has not loaded, it reads "not heard": no hearing is promised that cannot
 * come (review L6-11 c). A replacement whose event HAS loaded reads "Replaced
 * by a later instruction" — the event comes first. An EMPTY slot is safe to
 * read this way: only the sweep empties a slot no check heard, past its
 * lifetime, and the heard pass's retirement reaches the client in the same
 * remote event as its own hearing, which Chromium commits as one render
 * (measured; WebKit and Firefox untested — polish review P1-3). Without the
 * slot's thread nothing is promised.
 * An unknown state → no tag.
 *
 * Cockpit Build 2b (spec §7.1 — every row from merge):
 *   ACTED WINS — `outcome.actedEvalId` reads "Acted at the {t} check"
 *   WHATEVER the state (an act the agent made is never hidden by a later
 *   expiry or the battle's end — the week-1 AMZN case, discovery B4);
 *   invalidated with `invalidatedReason` → "Dropped · {reason line}" (D-9);
 *   a `retired` event → "Command retired · {SYM} left the book at the {t}
 *   check" (or "· {IN} came in another way") (D-6);
 *   a `superseded` event names the replacing filing's SOURCE, read from the
 *   battle's own exchange for its `supersededBy` thread (`exchanges`, the RAW
 *   chatExchanges): your later command (source 'cockpit') or a chat
 *   instruction (any other source);
 *   a filing still the battle's current one when no check is left today
 *   (`nextDecisionAt` absent or after the close of the filing's session) →
 *   "Filed · no check left today".
 */
export function callTag(call, { events = [], evaluations = [], nowMs, slotThreadId = null, exchanges = [], nextDecisionAt = null, battleExpiresAtMs = null } = {}) {
  if (!call || typeof call !== 'object') return null;
  const deadline = deadlineText(call.horizon, { nowMs, ...CLOCK });
  const lastOf = (kind) => [...events].reverse().find((e) => e?.kind === kind) ?? null;
  // ACTED WINS (2b §7.1): the record's own act, whatever the state.
  const actedEvalId = call.outcome?.actedEvalId;
  if (nonEmpty(actedEvalId) && ACTABLE_STATES.has(call.state)) {
    const at = promptBuiltAtOf(evaluations, actedEvalId) ?? isoOf(lastOf('acted')?.evidence?.promptBuiltAt);
    return factTag('event:acted', { check: checkOf(at) });
  }
  switch (call.state) {
    case 'hit': return factTag('state:hit', { check: checkOf(call.stateChangedAt) });
    case 'expired_unresolved': return factTag('state:expired_unresolved', { deadline });
    case 'ended_with_battle': return factTag('state:ended_with_battle');
    case 'invalidated': return factTag('state:invalidated', { reason: COCKPIT_DROPPED_REASON_TEXT[call.invalidatedReason] ?? null });
    case 'open': {
      const pr = call.playerResponse;
      const facts = [];
      const retired = lastOf('retired');
      if (retired) facts.push({ ms: msOf(retired.at), rank: 0, tag: () => retiredTag(retired) });
      const superseded = lastOf('superseded');
      if (superseded) facts.push({ ms: msOf(superseded.at), rank: 1, tag: () => factTag('event:superseded', { by: replacedBySource(superseded, exchanges), time: etTime(isoOf(superseded.at)) }) });
      const noMatch = lastOf('no_matching_trade');
      if (noMatch) {
        const at = noMatch.evidence?.promptBuiltAt;
        facts.push({ ms: msOf(at) ?? msOf(noMatch.at), rank: 2, tag: () => factTag('event:no_matching_trade', { check: checkOf(at) }) });
      }
      if (pr?.kind === 'directive' && nonEmpty(pr.heardEvalId)) {
        const heard = lastOf('heard');
        const at = promptBuiltAtOf(evaluations, pr.heardEvalId) ?? isoOf(heard?.evidence?.promptBuiltAt);
        facts.push({ ms: msOf(at) ?? msOf(heard?.at), rank: 3, tag: () => factTag('event:heard', { check: checkOf(at) }) });
      }
      if (facts.length > 0) {
        facts.sort((a, b) => (b.ms ?? -Infinity) - (a.ms ?? -Infinity) || a.rank - b.rank);
        return facts[0].tag();
      }
      if (pr?.kind === 'directive') {
        const current = nonEmpty(pr.directiveThreadId) && pr.directiveThreadId === slotThreadId;
        if (current && noCheckLeftToday(pr.filedAt, nextDecisionAt, { nowMs, battleExpiresAtMs })) return factTag('answer:directive_no_check');
        return factTag(current ? 'answer:directive' : 'answer:directive_left_slot');
      }
      if (pr?.kind === 'ack') return factTag('answer:ack', { time: etTime(isoOf(pr.filedAt)) });
      return factTag('state:open');
    }
    default:
      return null;
  }
}

/** The states a committed act can stand on (an invalidated call was never open to one). */
const ACTABLE_STATES = new Set(['open', 'hit', 'expired_unresolved', 'ended_with_battle']);

/**
 * The `retired` event's tag (D-6): the name that moved, the way it moved, and the check it moved AT — the check
 * of the recorded trade (`trade.at`), else the check whose step retired it. They differ on D-6's deferred routes
 * (an exit after the prompt retires at the next check's step), and the tag says "left the book at" (review CB3-2;
 * the event's own stored text, a prompt-module renderer, is unchanged).
 */
function retiredTag(event) {
  const came = event?.reason === 'pick_already_held';
  const movedAt = isoOf(event?.trade?.at) ?? isoOf(event?.at);
  return factTag('event:retired', { symbol: nonEmpty(event?.symbol) ? event.symbol : null, came, check: checkOf(movedAt) });
}

/**
 * Who replaced a command (2b §7.1): the battle's own exchange for the event's
 * `supersededBy` thread — 'cockpit' for a cockpit filing, 'chat' for any other
 * source, null when that exchange is not in the list (the 2a wording then).
 */
export function replacedBySource(event, exchanges) {
  const by = event?.supersededBy;
  if (!nonEmpty(by) || !Array.isArray(exchanges)) return null;
  const ex = exchanges.find((e) => e && e.directiveThreadId === by);
  if (!ex) return null;
  return ex.source === 'cockpit' ? 'cockpit' : 'chat';
}

/**
 * "No check left today" (2b §7.1): the battle's next check falls after the
 * close of the session the filing falls in (horizon.js sessionCloseAfter), or
 * there is none before the battle ends.
 *
 * HEAD DIFFERS FROM THE SPEC'S WORDING ("nextDecisionAt is absent or after the
 * close"): the turn line's `nextDecisionAt` is ALSO absent while a check runs
 * late and before the first check (baggerbombAdapter.js deriveNextDecisionAt
 * withholds a slot already past), so "absent" alone would claim no check left
 * on every late check. Absent, the next check is read from the registered
 * evaluator schedule instead (horizon.js nextEligibleSlot — the calls' own
 * clock, strictly after `nowMs`, before the battle's end). An unreadable
 * filing time or calendar claims nothing.
 */
export function noCheckLeftToday(filedAt, nextDecisionAt, { nowMs = null, battleExpiresAtMs = null } = {}) {
  const filedMs = msOf(filedAt);
  if (!finite(filedMs)) return false;
  const close = sessionCloseAfter(filedMs);
  if (!close || 'reason' in close) return false;
  let nextMs = msOf(nextDecisionAt);
  if (nextMs === null) {
    if (!finite(nowMs)) return false;
    const slot = nextEligibleSlot(nowMs, { battleExpiresAtMs: finite(battleExpiresAtMs) ? battleExpiresAtMs : Number.MAX_SAFE_INTEGER });
    if ('reason' in slot) return slot.reason === 'no_slot_before_battle_end';
    nextMs = slot.slotMs;
  }
  return nextMs >= close.closeMs;
}

// ---------------------------------------------------------------------------
// Tiles

/** The kind label (§7.3): an upside call is its own kind; a pick is never a tile in 2a. */
export function kindLabelOf(call) {
  if (isUpsideCall(call)) return COPY.cockpitKindUpside;
  if (call?.kind === 'confirmation') return COPY.cockpitKindConfirmation;
  if (call?.kind === 'called_shot') return COPY.cockpitKindCalledShot;
  return null;
}

/** A button's label (§7.3): the agreeing answer free, the override with its cost. */
export function answerLabelOf(call, answer) {
  if (answer === 'go') return call?.kind === 'confirmation' ? COPY.cockpitAnswerConfirm : COPY.cockpitAnswerGoIfTriggers;
  if (answer === 'hold') return call?.defaultAction === 'hold' ? COPY.cockpitAnswerHold : COPY.cockpitAnswerHoldOff;
  if (answer === 'go_now') return COPY.cockpitAnswerGoInstead;
  return null;
}

/**
 * The battle's slot when it holds a LIVE call directive, else null — the
 * answer endpoint's pending predicate without its `thisCallId` exemption: a
 * call-family directive with text and a thread, not past its `expiresAtMs`,
 * not killed, not suppressed. ONE predicate, two readers: the override block
 * below, and the tag — a filed directive is "not yet heard" only while this
 * slot is its own (callTag; founder ruling Oct 4).
 */
export function liveCallSlotOf({ directive, nowMs, controlEpochLog = null, suppressed = false } = {}) {
  if (!directive || typeof directive !== 'object' || directive.family !== 'call') return null;
  if (suppressed === true) return null;
  if (!directive.text || !directive.directiveThreadId) return null;
  if (!finite(nowMs) || !finite(directive.expiresAtMs) || nowMs > directive.expiresAtMs) return null;
  if (deriveKilledDirectiveIds(controlEpochLog).includes(directive.directiveThreadId)) return null;
  return directive;
}

/**
 * "One call at a time" (§7.3) — THE ANSWER ENDPOINT'S OWN PREDICATE, restated.
 * The endpoint refuses an override with 409 `directive_pending` while
 * `isCallDirectivePendingAt` (api/_utils/directiveUtils.js:136-150) holds: the
 * slot is a call-family directive with text and a thread, not past its
 * `expiresAtMs`, not killed (the battle's `controlEpochLog`), not suppressed
 * (the renderer suppresses every directive unless the integrity mode is
 * 'enforce'), and for a different call. The client cannot
 * import that module (it reaches the calls mode and the server allowlist), so
 * the predicate is restated here and a parity test runs both on one table
 * (cockpitModel.test.js).
 *
 * HEAD DIFFERS FROM THE SPEC'S WORDING ("whose call has no
 * playerResponse.heardEvalId"): hearing consumes nothing, so a HEARD call
 * directive keeps the endpoint refusing while it stays live — until it
 * expires, is replaced (a chat or chip filing), is retired (an acted go or
 * pick) or is killed (Amendment C rev 3, standing conditions) — and an expired
 * one blocks nothing even if it was never heard. So the buttons follow the endpoint, and
 * the line says which case it is: the call is loaded and unheard → the
 * spec's line; heard, or its call not loaded → "stays active until {t}" (never a
 * claim about hearing the client cannot see).
 *
 * @returns {{ callId: string|null, line: string } | null}  null = nothing blocked
 */
export function overrideBlockOf({ directive, calls, nowMs, controlEpochLog = null, suppressed = false } = {}) {
  const slot = liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed });
  if (!slot) return null;
  const callId = nonEmpty(slot.callId) ? slot.callId : null;
  const call = callId ? (Array.isArray(calls) ? calls : []).find((c) => c?.callId === callId) ?? null : null;
  const unheard = Boolean(call) && !nonEmpty(call.playerResponse?.heardEvalId);
  return {
    callId,
    line: unheard ? COPY.cockpitWaitingHeard : COPY.cockpitWaitingActive(etTime(isoOf(slot.expiresAtMs))),
  };
}

const answeredCall = (c) => Boolean(c?.playerResponse && typeof c.playerResponse === 'object');

/**
 * Amendment C-6 rev 3: a LIVE directive answer is one whose directive is
 * still the battle's current directive — the slot's live thread
 * (liveCallSlotOf) is its own, the very test "Filed · not yet heard" reads —
 * on ANY call of the thread, not only the newest answered one (review Q1-2).
 * Only a live answer holds the thread's answers back; once its directive
 * leaves the slot, the thread offers answers on its newest call again (the
 * endpoint accepts the agreement; an override still waits on another call's
 * live directive — `overrideBlockOf`).
 */
function liveDirectiveMember(thread, slotThreadId) {
  if (!nonEmpty(slotThreadId)) return null;
  return thread.find((c) => c.state === 'open' && c.playerResponse?.kind === 'directive' && c.playerResponse.directiveThreadId === slotThreadId) ?? null;
}

/**
 * The thread's MOST RECENT answer (by its filing instant; on a tie, the
 * newer wording's), or null. Once a directive answer leaves the slot the
 * newest call can be answered again, so the answer the tile shows is the
 * latest one given, never an older one it replaced (review Q1-1).
 */
function latestAnswerMember(thread) {
  let latest = null;
  for (const c of thread) {
    if (!answeredCall(c)) continue;
    if (!latest || (msOf(c.playerResponse.filedAt) ?? -Infinity) > (msOf(latest.playerResponse.filedAt) ?? -Infinity)) latest = c;
  }
  return latest;
}

/**
 * The name a member's directive chose (Build 1a's pick; Build 2b's replace or
 * named go_now) — from the directive's OWN record: the slot when it is that
 * thread, else the thread's exchange (never playerResponse). Null otherwise.
 */
export function chosenNameOf(member, { directive = null, exchanges = [] } = {}) {
  const thread = member?.playerResponse?.directiveThreadId;
  if (member?.playerResponse?.kind !== 'directive' || !nonEmpty(thread)) return null;
  if (directive?.directiveThreadId === thread) return nonEmpty(directive.action?.pickSymbol) ? directive.action.pickSymbol : null;
  const ex = (Array.isArray(exchanges) ? exchanges : []).find((e) => e?.directiveThreadId === thread && e.directive && typeof e.directive === 'object');
  return nonEmpty(ex?.directive?.action?.pickSymbol) ? ex.directive.action.pickSymbol : null;
}

/**
 * One tile — one CARD (Amendment D-12) — for a thread, or for a resolved call
 * (a card of one).
 *
 *   tag      the call the agent ACTED on, when any (review L6-1); else the
 *            LIVE directive answer's call when the thread holds one; else
 *            the call of the thread's most recent answer when that answer is
 *            a directive, live or not (its filed / heard / replaced state is
 *            the thread's operative fact); else the NEWEST call's own — an
 *            agreement on an EARLIER wording is never worn by the newer one
 *            (review L6-2); it is an answer line instead. An answer that a
 *            later answer followed is no longer shown (review Q1-1)
 *   buttons  the NEWEST call's legal answers (§7.2) — none while any call in
 *            the thread carries a LIVE directive answer (C-6 rev 3: its
 *            directive still the battle's current one, liveCallSlotOf; once it
 *            leaves the slot the newest call is answerable again), none when the
 *            newest call is already answered (409 already_answered), none once
 *            the agent acted on it, none past its deadline (the endpoint
 *            refuses every answer then: 409 expired — review L6-7), none on a
 *            resolved call. While ANY answer is in flight every button waits
 *            (one answer at a time; the hook drops a second tap — review L3-7)
 *   group    Earlier when resolved; Needs you when there are buttons and no
 *            answer anywhere on the thread (§7.1); otherwise Waiting — the
 *            answered threads (an agreement on an earlier wording, or a
 *            directive answer that left the slot, still lets the restated
 *            call be answered, C-6 rev 3) and the calls with no answer to
 *            give (upside, acted, past the deadline)
 *
 * Cockpit Build 2b (Amendment D-12 rev 4, D-10 — from merge):
 *   following  the members that are restatements under your LIVE command
 *              (isFollowing): offered no answer; the card wears "Following your
 *              call" beside its own tag when its newest member is one — never
 *              the answered call (V5-5)
 *   new asks   while the card holds an answer, an open, unanswered, not-
 *              following member MORE than 1 % from the answered call's level
 *              (the coverage test) is a new ask: the newest one LEADS — it
 *              takes the buttons even beside a live command, and the card is
 *              Needs you; the command then names its own line ("Your command ·
 *              on the $L line"), never covering the new one
 *   lines      the headline is the newest call's (the agent's latest line);
 *              with open calls at more than one level the card reads "Latest
 *              line · the {t} check" and "Line moved $A → $B" (the previous
 *              distinct level, then the newest) and keeps the earlier levels,
 *              newest first, for the expand; C-6's "Restated at the {t} check"
 *              stays for a same-level restatement
 *   step       with { v2 }, the "Who comes in?" state of the call the buttons
 *              answer (answers.js replacementStepFor), and its stored options
 *
 * Cockpit exit-not-held (Amendment E rev 2, E-2): while the call the buttons would
 * answer is an EXIT whose stock the battle document holds in NO tier (answers.js
 * isExitNotHeld — the endpoint's own test, so a tile never offers what it would
 * refuse), the tile offers no button and no "Who comes in?" step, and an
 * unanswered, un-acted, Live call reads "Not in your book". A recorded answer, an
 * act and every other tag stand as recorded. `book` is the battle document the
 * screen already reads; without one (or without its portfolio) nothing is claimed.
 *
 * @param {object[]} thread  calls, newest first
 * @param {object} ctx       { eventsMap, evaluations, nowMs, block, pending: { callId, answer } | null,
 *                             slotThreadId: the slot's live thread (liveCallSlotOf) | null,
 *                             command: commandOf(...) | null, exchanges, nextDecisionAt, directive, v2,
 *                             book: the battle document (its `portfolio`) | null }
 */
export function tileOf(thread, {
  eventsMap = new Map(), evaluations = [], nowMs, block = null, pending = null, slotThreadId = null,
  command = null, exchanges = [], nextDecisionAt = null, battleExpiresAtMs = null, directive = null, v2 = false, book = null,
} = {}) {
  const newest = thread[0];
  const oldest = thread[thread.length - 1];
  // Only a LIVE directive answer (C-6 rev 3: still the battle's current
  // directive) holds the newest call's answers back, and it is the answer the
  // tile shows. Otherwise the tile shows the thread's most recent answer: a
  // directive one as its tag and answer line, live or not; an agreement on an
  // earlier wording as an answer line.
  const live = liveDirectiveMember(thread, slotThreadId);
  const shown = live ?? latestAnswerMember(thread);
  const filed = shown && shown.state === 'open' && shown.playerResponse.kind === 'directive' ? shown : null;
  const threadAnswered = thread.some(answeredCall);
  // The agent acting on ANY call of the thread is the thread's weightiest fact
  // (review L6-1 / V2): it is the tag, and no answer is offered after it.
  const actedMember = thread.find((c) => nonEmpty(c.outcome?.actedEvalId)) ?? null;
  const tagCtx = { evaluations, nowMs, slotThreadId, exchanges, nextDecisionAt, battleExpiresAtMs };
  const tagSource = actedMember ?? filed ?? newest;
  const liveTag = callTag(tagSource, { events: eventsMap.get(tagSource.callId) ?? [], ...tagCtx });
  // D-10: the restatements under the live command — whether or not its answered call is still open on this card
  // (the command is live while its slot is; review CB3-1). isFollowing never names the answered call itself.
  const following = new Set(command ? thread.filter((c) => isFollowing(command, c, { eventsMap })).map((c) => c.callId) : []);
  // D-12 condition 1: the new asks beside the answer the card shows.
  const newAsks = shown && newest.state === 'open'
    ? thread.filter((c) => c !== shown && c.state === 'open' && !answeredCall(c) && !following.has(c.callId) && !withinCoverage(shown, c))
    : [];
  const leadAsk = newAsks[0] ?? null;
  // The call the buttons answer: the lead new ask beside a live command; otherwise the newest call, as 2a.
  const target = live && leadAsk ? leadAsk : newest;
  // E-2: the stock the call would exit is in no tier of the book — no answer is legal on it.
  const notHeld = isExitNotHeld(target, book);
  // The endpoint's own guard (call-response.js: `!finite(deadline) || deadline <= nowMs` → 409 expired).
  const deadline = target.horizon?.expiresAt;
  const answerable = finite(deadline) && finite(nowMs) && deadline > nowMs;
  const heldBack = live && target !== leadAsk;
  const legal = target.state === 'open' && !heldBack && !answeredCall(target) && !following.has(target.callId) && !actedMember && answerable && !notHeld
    ? tileAnswersFor(target, { v2 })
    : [];
  // Only the bare "Live" gives way: a recorded answer, an act, a retirement or a replacement keeps its own tag.
  const tag = notHeld && target.state === 'open' && !answeredCall(target) && !actedMember && liveTag?.fact === 'state:open' ? factTag('call:not_held') : liveTag;
  // The endpoint exempts the slot's own call (`thisCallId`); every other call's override waits.
  const blocked = Boolean(block) && block.callId !== target.callId;
  const sendingThis = Boolean(pending) && thread.some((c) => c.callId === pending.callId);
  const buttons = legal.map(({ answer, row }) => ({
    answer,
    row,
    callId: target.callId,
    label: sendingThis && pending.answer === answer ? COPY.cockpitSending : answerLabelOf(target, answer),
    disabled: Boolean(pending) || (row === 'directive' && blocked),
  }));
  // Review (Astra P2, 2026-10-21): the headline stays the newest line's (D-12). When the buttons answer ANOTHER call
  // — an older new ask beside a live command — that call's own labelled row sits directly above them (its line,
  // level and check), so the headline, the moved line and "Your command · on the $L line" never stand in for it. The
  // buttons stay bound to that call; they never move to the newest.
  const targetLine = target !== newest && buttons.length > 0
    ? COPY.cockpitAnswerTarget(target.symbol, target.condition?.side, finite(target.condition?.level) ? fmtPrice(target.condition.level) : null, checkOf(target.evidence?.priceAsOf))
    : null;
  let group = COCKPIT_GROUP.WAITING;
  if (newest.state !== 'open') group = COCKPIT_GROUP.EARLIER;
  else if (buttons.length > 0 && (!threadAnswered || leadAsk)) group = COCKPIT_GROUP.NEEDS_YOU;
  // C-6: the shown directive answer names the wording it was given on, live or
  // not; so does an agreement given on an EARLIER wording, while the newest
  // call is unanswered.
  const olderAck = !filed && shown && shown !== newest && !answeredCall(newest) && shown.playerResponse.kind === 'ack' ? shown : null;
  let answerLine = null;
  if (filed) {
    answerLine = COPY.cockpitThreadAnswer(filed.playerResponse.answer, etTime(isoOf(filed.playerResponse.filedAt)), etSlotTime(isoOf(filed.evidence?.priceAsOf)), chosenNameOf(filed, { directive, exchanges }), { v2, direction: filed.direction });
  } else if (olderAck) {
    answerLine = COPY.cockpitThreadAgreed(etTime(isoOf(olderAck.playerResponse.filedAt)), etSlotTime(isoOf(olderAck.evidence?.priceAsOf)));
  }
  // D-12 rev 4: the moved line and the earlier levels (open calls only — a resolved line has left the card).
  const levels = distinctLevelsOf(thread);
  const moved = levels.length > 1;
  const restated = moved
    ? COPY.cockpitLatestLine(checkOf(newest.evidence?.priceAsOf))
    : (thread.length > 1 ? COPY.cockpitRestated(checkOf(newest.evidence?.priceAsOf)) : null);
  return {
    id: newest.callId,
    group,
    calls: thread,
    call: newest,
    target,
    kindLabel: kindLabelOf(newest),
    upside: isUpsideCall(newest),
    eyebrow: COPY.cockpitEyebrowFrom(checkOf(oldest.evidence?.priceAsOf)),
    restated,
    line: renderCallLine(newest, { nowMs, ...CLOCK }),
    lineMoved: moved ? COPY.cockpitLineMoved(levels[1].price, levels[0].price) : null,
    earlierLevels: moved
      ? levels.slice(1).map(({ price, call }) => ({ key: call.callId, text: COPY.cockpitEarlierLevel(call.condition?.side, price, checkOf(call.evidence?.priceAsOf)) }))
      : [],
    tag,
    followTag: following.has(newest.callId) ? factTag('call:following') : null,
    following: [...following],
    newAsk: Boolean(leadAsk),
    commandLine: leadAsk && shown?.playerResponse?.kind === 'directive' && finite(shown.condition?.level) ? COPY.cockpitCommandOnLine(fmtPrice(shown.condition.level)) : null,
    answerLine,
    buttons,
    targetLine,
    blockedLine: blocked && buttons.some((b) => b.row === 'directive') ? block.line : null,
    // The step offers answers too, so it keeps the buttons' own gates: inside the deadline, and not once the
    // agent acted (the endpoint refuses both — review CB4-5).
    step: v2 && answerable && !actedMember && !notHeld ? replacementStepFor(target, { v2 }) : null,
    options: v2 && Array.isArray(target.replacementOptions) ? target.replacementOptions : null,
  };
}

/**
 * THE FEED (§7.1): the four groups, in order. Picks are not shown in 2a; an
 * upside call is Waiting by construction (it offers no button).
 *
 * Cockpit Build 2b (from merge): the cards fold by plan (D-12) with your live
 * command's restatements joined to it (D-10); the tags read the battle's RAW
 * `exchanges` (who replaced a command) and `nextDecisionAt` (no check left
 * today). `v2` adds each card's "Who comes in?" state (the V5 screen reads it).
 * `book` (Amendment E rev 2) is the battle document the screen reads, for the one
 * any-tier held test every tile asks (tileOf); absent, no tile claims a stock left.
 *
 * @returns {{ needsYou: object[], waiting: object[], earlier: object[], earlierTotal: number, needsYouCount: number, empty: boolean, command: object|null }}
 */
export function buildCockpitFeed({
  calls, events, evaluations, directive, nowMs, pending = null, outcomes = {}, showAllEarlier = false, controlEpochLog = null, suppressed = false,
  exchanges = [], nextDecisionAt = null, battleExpiresAtMs = null, v2 = false, league = false, book = null,
} = {}) {
  const shown = cockpitCalls(calls).filter((c) => c.kind !== 'pick');
  const eventsMap = eventsByCall(events);
  // With v2 (flag on) the endpoint REPLACES the live command after a confirmation (D-2) — nothing blocks.
  const block = v2 ? null : overrideBlockOf({ directive, calls: shown, nowMs, controlEpochLog, suppressed });
  // The slot's live thread, by the block's own predicate: a filed directive is "not yet heard" only while it is this one.
  const slotThreadId = liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed })?.directiveThreadId ?? null;
  const command = commandOf({ directive, calls: shown, nowMs, controlEpochLog, suppressed });
  const ctx = { eventsMap, evaluations, nowMs, block, pending, slotThreadId, command, exchanges, nextDecisionAt, battleExpiresAtMs, directive, v2, book };
  const withRefusal = (tile) => ({ ...tile, refusalLine: refusalLineOf(tile, outcomes?.[tile.target?.callId ?? tile.id] ?? outcomes?.[tile.id] ?? null, { calls: shown, directive, block, nowMs, v2, league }) });
  const openTiles = foldThreads(shown, { command, eventsMap }).map((t) => withRefusal(tileOf(t.calls, ctx)));
  const resolved = shown
    .filter((c) => c.state !== 'open')
    .sort((a, b) => (msOf(b.stateChangedAt) ?? 0) - (msOf(a.stateChangedAt) ?? 0) || newestFirst(a, b))
    .map((c) => withRefusal(tileOf([c], ctx)));
  const needsYou = openTiles.filter((t) => t.group === COCKPIT_GROUP.NEEDS_YOU);
  const waiting = openTiles.filter((t) => t.group === COCKPIT_GROUP.WAITING);
  return {
    needsYou,
    waiting,
    earlier: showAllEarlier ? resolved : resolved.slice(0, EARLIER_SHOWN),
    earlierTotal: resolved.length,
    needsYouCount: needsYou.length,
    empty: shown.length === 0,
    command,
  };
}

/** The Monitoring row (§7.1): "From the {t} check" and at most six names, or null without a record. */
export function monitoringRow(monitoring, evaluations) {
  if (!monitoring || !Array.isArray(monitoring.symbols) || monitoring.symbols.length === 0) return null;
  const at = promptBuiltAtOf(evaluations, monitoring.evalId);
  return {
    from: COPY.cockpitMonitoringFrom(checkOf(at)),
    // React keys must be unique even if the record repeats a name (the validator does not de-duplicate).
    chips: monitoring.symbols.slice(0, MONITORING_MAX).map((symbol, i) => ({ key: `${i}-${symbol}`, symbol })),
  };
}

// ---------------------------------------------------------------------------
// The sheet (§7.5)

/** One receipt line for one event of a call, or null (the declaration is the eyebrow, not a receipt). */
export function receiptLineOf(event, call, { evaluations = [], nowMs, exchanges = [] } = {}) {
  const at = isoOf(event?.at);
  switch (event?.kind) {
    case 'answered': {
      // D-4's second answer keeps the agreement in `after`: ITS event reads as the agreement it was (review CB3-3).
      const after = call?.playerResponse?.after;
      if (after && after.answer === 'go' && msOf(event.at) !== null && msOf(event.at) === msOf(after.filedAt)) {
        return COCKPIT_FACT_TAGS['answer:ack'].text({ time: etTime(isoOf(after.filedAt)) });
      }
      return call?.playerResponse?.kind === 'ack'
        ? COCKPIT_FACT_TAGS['answer:ack'].text({ time: etTime(isoOf(call.playerResponse.filedAt) ?? at) })
        : COPY.cockpitReceiptFiled(etTime(isoOf(call?.playerResponse?.filedAt) ?? at));
    }
    case 'heard':
      return COCKPIT_FACT_TAGS['event:heard'].text({ check: checkOf(isoOf(event.evidence?.promptBuiltAt) ?? promptBuiltAtOf(evaluations, event.evidence?.evalId)) });
    case 'acted':
      return COCKPIT_FACT_TAGS['event:acted'].text({ check: checkOf(isoOf(event.evidence?.promptBuiltAt) ?? promptBuiltAtOf(evaluations, event.evidence?.evalId)) });
    case 'no_matching_trade':
      return COCKPIT_FACT_TAGS['event:no_matching_trade'].text({ check: checkOf(isoOf(event.evidence?.promptBuiltAt)) });
    case 'expired':
      return COCKPIT_FACT_TAGS['event:expired'].text({ deadline: deadlineText(call?.horizon, { nowMs, ...CLOCK }) });
    case 'ended_with_battle':
      return COCKPIT_FACT_TAGS['event:ended_with_battle'].text();
    case 'superseded':
      // Cockpit Build 2b (spec §7.1): the receipt names the replacing filing's source, as the tag does.
      return COPY.cockpitReceiptReplacedBy(replacedBySource(event, exchanges), etTime(at));
    case 'retired':
      // Cockpit Build 2b (Amendment D-6): the command retired because its stock left the book.
      return retiredTag(event)?.text ?? null;
    default:
      return null;
  }
}

/** The observed price of a resolved call (callObservations/{callId}), or null. */
export function observationLineOf(call, observation) {
  if (!call || !observation || !finite(observation.px)) return null;
  const check = checkOf(observation.observedAtMs);
  if (call.state === 'hit') return COPY.cockpitObservedHit(fmtPrice(observation.px), check);
  if (call.state === 'expired_unresolved') return COPY.cockpitObservedExpired(fmtPrice(observation.px), check);
  return null;
}

/** The held price the citing check rendered (its tick-stamp evidence), or null. */
export function citedPriceOf(call, evaluations) {
  if (!Array.isArray(evaluations) || !nonEmpty(call?.evalId)) return null;
  const e = [...evaluations].reverse().find((x) => x?.evalId === call.evalId);
  const px = e?.evidence?.[call.symbol]?.px;
  return finite(px) ? { price: fmtPrice(px), check: checkOf(e.promptBuiltAt) } : null;
}

/**
 * Everything the sheet shows for a tile (§7.5), from records alone.
 */
export function sheetOf(tile, { eventsMap = new Map(), evaluations = [], observation = null, nowMs, exchanges = [] } = {}) {
  if (!tile) return null;
  const call = tile.call;
  const upside = isUpsideCall(call);
  const cited = citedPriceOf(call, evaluations);
  // Each receipt at the CHECK it names when it names one (a sweep-repaired
  // `heard` carries the sweep's instant as `at` — review L6-11), else its
  // instant; oldest first.
  const orderOf = (ev) => msOf(ev?.evidence?.promptBuiltAt) ?? msOf(ev?.at) ?? 0;
  const rows = tile.calls.flatMap((c) => (eventsMap.get(c.callId) ?? []).map((ev) => ({ ev, c, ms: orderOf(ev) })));
  // The flip's whole-trade match stamps `outcome.actedEvalId` WITHOUT an event:
  // the record's own fact still reads as a receipt (review L6-1 / V2).
  for (const c of tile.calls) {
    const actedEvalId = c.outcome?.actedEvalId;
    if (!nonEmpty(actedEvalId) || (eventsMap.get(c.callId) ?? []).some((ev) => ev?.kind === 'acted')) continue;
    const at = promptBuiltAtOf(evaluations, actedEvalId);
    rows.push({ ev: { kind: 'acted', at: msOf(at), evidence: { evalId: actedEvalId, promptBuiltAt: at } }, c, ms: msOf(at) ?? Number.MAX_SAFE_INTEGER });
  }
  const receipts = rows
    .sort((a, b) => a.ms - b.ms)
    .map(({ ev, c }) => ({ key: `${c.callId}|${ev.kind}|${msOf(ev.at) ?? ''}`, text: receiptLineOf(ev, c, { evaluations, nowMs, exchanges }) }))
    .filter((r) => r.text);
  const observed = observationLineOf(call, observation);
  if (observed) receipts.push({ key: `${call.callId}|observation`, text: observed });
  return {
    title: tile.line,
    kindLabel: tile.kindLabel,
    eyebrow: tile.eyebrow,
    tag: tile.tag,
    // C-4: shown ONLY when the record's own verdict passed, under the unverified
    // label — and never on an upside call, whose own sentence may carry the
    // action clause C-2 removes everywhere else (review L6-9).
    said: !upside && call.saidOk === true && nonEmpty(call.said) ? { label: SAID_UNVERIFIED_LABEL, text: call.said } : null,
    facts: [
      { key: 'level', label: COPY.cockpitSheetLevel, value: COPY.cockpitSheetLevelValue(call.condition?.side, finite(call.condition?.level) ? fmtPrice(call.condition.level) : null) },
      { key: 'deadline', label: COPY.cockpitSheetDeadline, value: deadlineText(call.horizon, { nowMs, ...CLOCK }) },
      { key: 'price', label: COPY.cockpitSheetPrice, value: cited ? COPY.cockpitSheetPriceValue(cited.price, cited.check) : null },
    ].filter((f) => f.value),
    // C-2: an upside call has no action clause anywhere — no default line.
    defaultLine: upside ? null : COPY.cockpitSheetDefault(COPY.cockpitIntent(call.defaultAction, call.direction, call.symbol, call.counterpart ?? null)),
    receipts,
    // The thread's EARLIER wordings (the title is the newest), newest first,
    // each with its own check: the original "Called at…", the rest "Restated
    // at…" (review L6-3).
    restated: tile.calls.slice(1).map((c, i, older) => ({
      key: c.callId,
      check: i === older.length - 1 ? COPY.cockpitCalledAt(checkOf(c.evidence?.priceAsOf)) : COPY.cockpitRestated(checkOf(c.evidence?.priceAsOf)),
      line: renderCallLine(c, { nowMs, ...CLOCK }),
    })),
    checkLink: nonEmpty(call.evalId) ? { evalId: call.evalId, label: COPY.cockpitSheetFromCheck(checkOf(call.evidence?.priceAsOf)) } : null,
    buttons: tile.buttons,
    // Review (Astra P2): the row above the buttons when they answer a line other than the title's.
    targetLine: tile.targetLine ?? null,
    targetCallId: tile.targetLine ? (tile.target?.callId ?? null) : null,
    blockedLine: tile.blockedLine,
    refusalLine: tile.refusalLine ?? null,
    answerLine: tile.answerLine,
    restatedLine: tile.restated,
    // Cockpit Build 2b (D-12 / D-10, from merge): the moved line, the earlier levels, the restatement and the command's own line.
    lineMoved: tile.lineMoved ?? null,
    earlierLevels: tile.earlierLevels ?? [],
    followTag: tile.followTag ?? null,
    commandLine: tile.commandLine ?? null,
  };
}

/** How long a directive_pending refusal stands on its own word once the client no longer sees the block (clock skew, propagation). */
export const PENDING_REFUSAL_GRACE_MS = 30_000;

/**
 * The refusals no tile shows any more — the record behind the tile changed
 * (its call resolved or was answered: refusalLineOf says nothing then), the
 * line aged out (a directive_pending refusal past its grace), or the call left
 * the feed (no tile is its own: folded under a restatement, whose tile carries
 * the newest call's outcome only, or no longer read). The screen drops these
 * outcomes, so a cleared line never comes back
 * on a tile that resurfaces (founder ruling Oct 5). Without a feed nothing is
 * known, and nothing is stale.
 *
 * @param {object|null} feed   buildCockpitFeed(...)
 * @param {object} outcomes    callId → outcome (useCockpitAnswer)
 * @returns {string[]}         the callIds whose outcome to drop
 */
export function staleRefusalIds(feed, outcomes) {
  const ids = Object.keys(outcomes && typeof outcomes === 'object' ? outcomes : {});
  if (!feed || ids.length === 0) return [];
  // A card's refusal is keyed by the call its buttons answered — its lead new ask (D-12), else its newest call.
  const shown = new Set([...feed.needsYou, ...feed.waiting, ...feed.earlier].filter((t) => t.refusalLine).flatMap((t) => [t.id, t.target?.callId].filter(Boolean)));
  return ids.filter((id) => !shown.has(id));
}

/**
 * The line a refusal shows under its tile (§8.3), from the response BODY —
 * or null once it no longer describes the tile (review L6-5, L6-6):
 *   - the refused call has resolved or been answered since (the endpoint's
 *     409 `expired` also stands for a call that stopped being open — a tap
 *     that raced a hit must not leave "deadline has passed" under "Hit at …");
 *   - a directive_pending refusal once the client sees no block any more and
 *     the refusal is older than PENDING_REFUSAL_GRACE_MS (the directive
 *     expired, was heard and retired, or left the slot).
 * A directive_pending line claims only what the records show: "hasn't been
 * heard yet" when the pending call (body.pendingCallId) is loaded and
 * unheard; otherwise the evidence-free "still active" line, with the slot's
 * own time when the slot is that directive.
 *
 * @param {object} tile
 * @param {{ status: number|null, body: object|null, at?: number, callId?: string }|null} outcome
 */
export function refusalLineOf(tile, outcome, { calls = [], directive = null, block = null, nowMs, v2 = false, league = false } = {}) {
  if (!tile || !outcome) return null;
  const call = tile.calls.find((c) => c.callId === outcome.callId) ?? tile.call;
  // Cockpit Build 2b (D-4): the one second answer — a refused replace after the go acknowledgment still shows its line.
  if (call.state !== 'open' || (answeredCall(call) && !(v2 && isGoAcknowledgment(call.playerResponse)))) return null;
  const body = outcome.body && typeof outcome.body === 'object' ? outcome.body : null;
  let pendingLine = null;
  if (outcome.status === 409 && body?.reason === 'directive_pending') {
    const age = finite(outcome.at) && finite(nowMs) ? nowMs - outcome.at : 0;
    if (!block && age > PENDING_REFUSAL_GRACE_MS) return null;
    const pendingCall = nonEmpty(body.pendingCallId) ? (calls.find((c) => c.callId === body.pendingCallId) ?? null) : null;
    if (pendingCall && !nonEmpty(pendingCall.playerResponse?.heardEvalId)) {
      pendingLine = COPY.cockpitWaitingHeard;
    } else {
      const slotIsIt = directive?.family === 'call' && nonEmpty(body.pendingDirectiveThreadId) && directive.directiveThreadId === body.pendingDirectiveThreadId;
      pendingLine = COPY.cockpitWaitingActive(slotIsIt && finite(directive.expiresAtMs) ? etTime(isoOf(directive.expiresAtMs)) : null);
    }
  }
  // Cockpit Build 2b (spec §7.3, flag on): the line names the name that can't come in, the agent's counterpart,
  // or the stock that left — the submitted name rides the outcome (useCockpitAnswer), the others the record.
  const names = { pickSymbol: outcome.pickSymbol ?? null, counterpart: call.counterpart ?? null, symbol: call.symbol ?? null, league };
  return cockpitRefusalLine(outcome.status, body, { pendingLine, v2, names });
}
