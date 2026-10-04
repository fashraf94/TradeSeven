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
//   folding     open calls → threads, Amendment C-6 rev 2 (same ET day,
//               symbol, direction, slot, side, default action; levels within
//               1 % of the newer call's) — one tile per thread, the newest
//               call's wording; nothing merged in a record
//   tags        §7.4 — record facts only, by a fixed precedence below
//   buttons     §7.3 — at most two: the agreeing answer, then the override
//               (one message); none on an upside call (C-2) or a pick (not
//               shown in 2a), none on a call already answered, none on a
//               thread holding a live directive answer (C-6); overrides
//               disabled while the answer endpoint would refuse them
//               (`overrideBlockOf` — the endpoint's own pending predicate)
//
// C-5: only records minted under 'on' ever reach this module's tiles — the
// readers (src/hooks/useCockpitRecords.js) drop the rest at the boundary, and
// `cockpitCalls` drops them again here so no caller can forget.

import {
  renderCallLine, isUpsideCall, checkLabel, deadlineText, fmtPrice, SAID_UNVERIFIED_LABEL,
} from '../../../api/_utils/callRecords/copy.js';
import { tileAnswersFor } from '../../../api/_utils/callRecords/answers.js';
import { etDateOf } from '../../../api/_utils/callRecords/horizon.js';
import { deriveKilledDirectiveIds } from '../../../api/_utils/controlPromptRenderer.js';
import { etTime, etSlotTime } from '../../components/Dashboard/desk/deskCopy';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS, cockpitRefusalLine } from './battleViewCopy';

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

/**
 * Open calls → threads (C-6). Two open calls belong to one thread when their
 * keys match and their levels are within 1 % (against the newer level); a
 * thread is every call linked that way (the connected set). Resolved calls
 * never join. Each thread's calls come newest first; threads come newest
 * first by their newest call.
 *
 * @returns {Array<{ key: string, calls: object[] }>}
 */
export function foldThreads(calls) {
  const open = (Array.isArray(calls) ? calls : []).filter((c) => c?.state === 'open').sort(newestFirst);
  const parent = open.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const keys = open.map(threadKeyOf);
  for (let i = 0; i < open.length; i += 1) {
    if (keys[i] === null) continue;
    for (let j = i + 1; j < open.length; j += 1) {
      // `open` is newest first, so open[i] is the NEWER of the pair.
      if (keys[j] === keys[i] && levelsWithin(open[j], open[i])) parent[find(j)] = find(i);
    }
  }
  const groups = new Map();
  open.forEach((call, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(call);
  });
  return [...groups.values()].map((list) => ({ key: keys[open.indexOf(list[0])] ?? list[0].callId, calls: list }));
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
 */
export function callTag(call, { events = [], evaluations = [], nowMs, slotThreadId = null } = {}) {
  if (!call || typeof call !== 'object') return null;
  const deadline = deadlineText(call.horizon, { nowMs, ...CLOCK });
  const kinds = new Set(events.map((e) => e?.kind));
  const lastOf = (kind) => [...events].reverse().find((e) => e?.kind === kind) ?? null;
  switch (call.state) {
    case 'hit': {
      const actedEvalId = call.outcome?.actedEvalId;
      if (nonEmpty(actedEvalId)) {
        const at = promptBuiltAtOf(evaluations, actedEvalId) ?? isoOf(lastOf('acted')?.evidence?.promptBuiltAt);
        return factTag('event:acted', { check: checkOf(at) });
      }
      return factTag('state:hit', { check: checkOf(call.stateChangedAt) });
    }
    case 'expired_unresolved': return factTag('state:expired_unresolved', { deadline });
    case 'ended_with_battle': return factTag('state:ended_with_battle');
    case 'invalidated': return factTag('state:invalidated');
    case 'open': {
      const pr = call.playerResponse;
      const actedEvalId = call.outcome?.actedEvalId;
      if (nonEmpty(actedEvalId)) {
        const at = promptBuiltAtOf(evaluations, actedEvalId) ?? isoOf(lastOf('acted')?.evidence?.promptBuiltAt);
        return factTag('event:acted', { check: checkOf(at) });
      }
      const facts = [];
      const superseded = lastOf('superseded');
      if (superseded) facts.push({ ms: msOf(superseded.at), rank: 0, tag: () => factTag('event:superseded') });
      const noMatch = lastOf('no_matching_trade');
      if (noMatch) {
        const at = noMatch.evidence?.promptBuiltAt;
        facts.push({ ms: msOf(at) ?? msOf(noMatch.at), rank: 1, tag: () => factTag('event:no_matching_trade', { check: checkOf(at) }) });
      }
      if (pr?.kind === 'directive' && nonEmpty(pr.heardEvalId)) {
        const heard = lastOf('heard');
        const at = promptBuiltAtOf(evaluations, pr.heardEvalId) ?? isoOf(heard?.evidence?.promptBuiltAt);
        facts.push({ ms: msOf(at) ?? msOf(heard?.at), rank: 2, tag: () => factTag('event:heard', { check: checkOf(at) }) });
      }
      if (facts.length > 0) {
        facts.sort((a, b) => (b.ms ?? -Infinity) - (a.ms ?? -Infinity) || a.rank - b.rank);
        return facts[0].tag();
      }
      if (pr?.kind === 'directive') {
        const current = nonEmpty(pr.directiveThreadId) && pr.directiveThreadId === slotThreadId;
        return factTag(current ? 'answer:directive' : 'answer:directive_left_slot');
      }
      if (pr?.kind === 'ack') return factTag('answer:ack', { time: etTime(isoOf(pr.filedAt)) });
      return factTag('state:open');
    }
    default:
      return null;
  }
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
 * (integrity mode not 'enforce'), and for a different call. The client cannot
 * import that module (it reaches the calls mode and the server allowlist), so
 * the predicate is restated here and a parity test runs both on one table
 * (cockpitModel.test.js).
 *
 * HEAD DIFFERS FROM THE SPEC'S WORDING ("whose call has no
 * playerResponse.heardEvalId"): a HEARD call directive stays in force — and
 * the endpoint keeps refusing — until it expires, and an expired one blocks
 * nothing even if it was never heard. So the buttons follow the endpoint, and
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

/** Does any call in the thread carry a live directive answer (a filed directive on an open call)? */
function liveDirectiveMember(thread) {
  return thread.find((c) => c.state === 'open' && c.playerResponse?.kind === 'directive') ?? null;
}

const answeredCall = (c) => Boolean(c?.playerResponse && typeof c.playerResponse === 'object');

/**
 * One tile for a thread (or a resolved call, which is a thread of one).
 *
 *   tag      the live directive answer's call when the thread holds one (its
 *            filed / heard state is the thread's operative fact), else the
 *            NEWEST call's own — an agreement on an EARLIER wording is never
 *            worn by the newer one (review L6-2); it is an answer line instead
 *   buttons  the NEWEST call's legal answers (§7.2) — none while any call in
 *            the thread carries a live directive answer (C-6), none when the
 *            newest call is already answered (409 already_answered), none once
 *            the agent acted on it, none past its deadline (the endpoint
 *            refuses every answer then: 409 expired — review L6-7), none on a
 *            resolved call. While ANY answer is in flight every button waits
 *            (one answer at a time; the hook drops a second tap — review L3-7)
 *   group    Earlier when resolved; Needs you when there are buttons and no
 *            answer anywhere on the thread (§7.1); otherwise Waiting — the
 *            answered threads (an agreement on an earlier wording still lets
 *            the restated call be answered, C-6) and the calls with no answer
 *            to give (upside, acted, past the deadline)
 *
 * @param {object[]} thread  calls, newest first
 * @param {object} ctx       { eventsMap, evaluations, nowMs, block, pending: { callId, answer } | null,
 *                             slotThreadId: the slot's live thread (liveCallSlotOf) | null }
 */
export function tileOf(thread, { eventsMap = new Map(), evaluations = [], nowMs, block = null, pending = null, slotThreadId = null } = {}) {
  const newest = thread[0];
  const oldest = thread[thread.length - 1];
  const live = liveDirectiveMember(thread);
  const threadAnswered = thread.some(answeredCall);
  // The agent acting on ANY call of the thread is the thread's weightiest fact
  // (review L6-1 / V2): it is the tag, and no answer is offered after it.
  const actedMember = thread.find((c) => nonEmpty(c.outcome?.actedEvalId)) ?? null;
  const tagSource = actedMember ?? live ?? newest;
  const tag = callTag(tagSource, { events: eventsMap.get(tagSource.callId) ?? [], evaluations, nowMs, slotThreadId });
  // The endpoint's own guard (call-response.js: `!finite(deadline) || deadline <= nowMs` → 409 expired).
  const deadline = newest.horizon?.expiresAt;
  const answerable = finite(deadline) && finite(nowMs) && deadline > nowMs;
  const legal = newest.state === 'open' && !live && !answeredCall(newest) && !actedMember && answerable ? tileAnswersFor(newest) : [];
  // The endpoint exempts the slot's own call (`thisCallId`); every other call's override waits.
  const blocked = Boolean(block) && block.callId !== newest.callId;
  const sendingThis = Boolean(pending) && thread.some((c) => c.callId === pending.callId);
  const buttons = legal.map(({ answer, row }) => ({
    answer,
    row,
    callId: newest.callId,
    label: sendingThis && pending.answer === answer ? COPY.cockpitSending : answerLabelOf(newest, answer),
    disabled: Boolean(pending) || (row === 'directive' && blocked),
  }));
  let group = COCKPIT_GROUP.WAITING;
  if (newest.state !== 'open') group = COCKPIT_GROUP.EARLIER;
  else if (buttons.length > 0 && !threadAnswered) group = COCKPIT_GROUP.NEEDS_YOU;
  // C-6: a live directive answer is shown, naming the wording it was given on;
  // so is an agreement given on an EARLIER wording of the thread.
  const olderAck = !live && !answeredCall(newest) ? (thread.slice(1).find((c) => c.playerResponse?.kind === 'ack') ?? null) : null;
  let answerLine = null;
  if (live) {
    answerLine = COPY.cockpitThreadAnswer(live.playerResponse.answer, etTime(isoOf(live.playerResponse.filedAt)), etSlotTime(isoOf(live.evidence?.priceAsOf)));
  } else if (olderAck) {
    answerLine = COPY.cockpitThreadAgreed(etTime(isoOf(olderAck.playerResponse.filedAt)), etSlotTime(isoOf(olderAck.evidence?.priceAsOf)));
  }
  return {
    id: newest.callId,
    group,
    calls: thread,
    call: newest,
    kindLabel: kindLabelOf(newest),
    upside: isUpsideCall(newest),
    eyebrow: COPY.cockpitEyebrowFrom(checkOf(oldest.evidence?.priceAsOf)),
    restated: thread.length > 1 ? COPY.cockpitRestated(checkOf(newest.evidence?.priceAsOf)) : null,
    line: renderCallLine(newest, { nowMs, ...CLOCK }),
    tag,
    answerLine,
    buttons,
    blockedLine: blocked && buttons.some((b) => b.row === 'directive') ? block.line : null,
  };
}

/**
 * THE FEED (§7.1): the four groups, in order. Picks are not shown in 2a; an
 * upside call is Waiting by construction (it offers no button).
 *
 * @returns {{ needsYou: object[], waiting: object[], earlier: object[], earlierTotal: number, needsYouCount: number, empty: boolean }}
 */
export function buildCockpitFeed({
  calls, events, evaluations, directive, nowMs, pending = null, outcomes = {}, showAllEarlier = false, controlEpochLog = null, suppressed = false,
} = {}) {
  const shown = cockpitCalls(calls).filter((c) => c.kind !== 'pick');
  const eventsMap = eventsByCall(events);
  const block = overrideBlockOf({ directive, calls: shown, nowMs, controlEpochLog, suppressed });
  // The slot's live thread, by the block's own predicate: a filed directive is "not yet heard" only while it is this one.
  const slotThreadId = liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed })?.directiveThreadId ?? null;
  const ctx = { eventsMap, evaluations, nowMs, block, pending, slotThreadId };
  const withRefusal = (tile) => ({ ...tile, refusalLine: refusalLineOf(tile, outcomes?.[tile.id] ?? null, { calls: shown, directive, block, nowMs }) });
  const openTiles = foldThreads(shown).map((t) => withRefusal(tileOf(t.calls, ctx)));
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
export function receiptLineOf(event, call, { evaluations = [], nowMs } = {}) {
  const at = isoOf(event?.at);
  switch (event?.kind) {
    case 'answered':
      return call?.playerResponse?.kind === 'ack'
        ? COCKPIT_FACT_TAGS['answer:ack'].text({ time: etTime(isoOf(call.playerResponse.filedAt) ?? at) })
        : COPY.cockpitReceiptFiled(etTime(isoOf(call?.playerResponse?.filedAt) ?? at));
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
      return COPY.cockpitReceiptReplaced(etTime(at));
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
export function sheetOf(tile, { eventsMap = new Map(), evaluations = [], observation = null, nowMs } = {}) {
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
    .map(({ ev, c }) => ({ key: `${c.callId}|${ev.kind}|${msOf(ev.at) ?? ''}`, text: receiptLineOf(ev, c, { evaluations, nowMs }) }))
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
    blockedLine: tile.blockedLine,
    refusalLine: tile.refusalLine ?? null,
    answerLine: tile.answerLine,
    restatedLine: tile.restated,
  };
}

/** How long a directive_pending refusal stands on its own word once the client no longer sees the block (clock skew, propagation). */
export const PENDING_REFUSAL_GRACE_MS = 30_000;

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
export function refusalLineOf(tile, outcome, { calls = [], directive = null, block = null, nowMs } = {}) {
  if (!tile || !outcome) return null;
  const call = tile.calls.find((c) => c.callId === outcome.callId) ?? tile.call;
  if (call.state !== 'open' || answeredCall(call)) return null;
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
  return cockpitRefusalLine(outcome.status, body, { pendingLine });
}
