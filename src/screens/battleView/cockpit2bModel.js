// src/screens/battleView/cockpit2bModel.js
//
// THE V5 SCREEN'S VIEW MODEL — Cockpit Build 2b, flag on (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5–§7; the V5 mockup
// docs/design/COCKPIT_V5_MOCKUP.html, with §1's seven corrections). PURE:
// the feed's cards (cockpitModel buildCockpitFeed, with `v2`) and the records
// in; the Now card, the Also-live strip, the day line, Earlier and the commands
// meter out. No React, no clock (the caller hands the SERVER's `nowMs` in), no I/O.
//
// THE CARDS ARE THE FEED'S. Every tag, button legality, coverage decision,
// moved line and "Who comes in?" state comes from cockpitModel (from merge,
// the same model the 2a feed renders); this module only chooses which card is
// the Now card, words the plan from record fields, and lays the rest out.
//
//   meter        7 commands per battle, DERIVED from the raw chatExchanges
//                (callRecords/commands.js — the very count the endpoint
//                refuses the eighth by)
//   now          the first match by priority (§5.2): 1 an unanswered exit +
//                act call with no counterpart (the Who comes in case); 2 any
//                other unanswered act-default call; 3 an unanswered
//                hold-default called shot; 4 the live command's own card.
//                Within a priority, the card whose OLDEST call was minted
//                earliest, then the lowest callId — a newer call never pushes
//                an older one aside. A spotlighted card (client state) leads
//                until it is answered or resolved; a card held after "Confirm
//                exit" (V5-6) leads until a pick, Done, or the call resolves
//   strip        every other open card as a chip; phone 4, desktop 6, then
//                "+{n} more"
//   dayLine      calls · hit · expired · answered over the battle's 'on' records
//   earlier      resolved calls, collapsed, "{SYM} {↑|↓} {level} · {tag}"
//
// No sentence is attributed to the agent (V5-7): the plan is the record's
// symbol, side, level, deadline and default, in the platform's words.

import { fmtPrice, deadlineText, isUpsideCall, checkLabel } from '../../../api/_utils/callRecords/copy.js';
import { canComeIn } from '../../../api/_utils/callRecords/swappable.js';
import { cockpitCommandsLeft, COCKPIT_COMMANDS_LIMIT } from '../../../api/_utils/callRecords/commands.js';
import { etTime, etSlotTime } from '../../components/Dashboard/desk/deskCopy';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS } from './battleViewCopy';
import { cockpitCalls, citedPriceOf, chosenNameOf, liveCallSlotOf, eventsByCall, promptBuiltAtOf } from './cockpitModel';

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
const checkOf = (instant) => checkLabel(instant, CLOCK);

/** The strip's chip budget per shell (§5.4). */
export const STRIP_SHOWN = Object.freeze({ phone: 4, desktop: 6 });

/** The commands meter (§5.1), from the RAW battle document's exchanges; none in a league battle (chat's budget is its own there). */
export function meterOf(rawExchanges, { league = false } = {}) {
  if (league) return null;
  const left = cockpitCommandsLeft(rawExchanges);
  return { left, limit: COCKPIT_COMMANDS_LIMIT, zero: left === 0, text: COPY.cockpit2bMeterLeft(left), aria: COPY.cockpit2bMeterAria(left, COCKPIT_COMMANDS_LIMIT) };
}

/** A card's stable identity: its OLDEST call (a restatement is not a new card — discovery C1). */
export const cardKeyOf = (tile) => tile?.calls?.[tile.calls.length - 1]?.callId ?? tile?.id ?? null;

/** "↑" above, "↓" below. */
export const arrowOf = (side) => (side === 'above' ? '↑' : side === 'below' ? '↓' : '');

/** The level as a chip shows it — the shared renderer's price without "$" and without a trailing ".00". */
export function chipLevelOf(level) {
  if (!finite(level)) return '';
  return fmtPrice(level).replace(/^\$/, '').replace(/\.00$/, '');
}

/** The priority a card qualifies for as the Now card (§5.2), or null. Upside calls and restatements never lead. */
export function nowPriorityOf(tile, { commandKey = null } = {}) {
  if (!tile || tile.group === 'earlier') return null;
  const target = tile.target ?? tile.call;
  if (isUpsideCall(target)) return null;
  if (tile.group === 'needsYou') {
    if (target.direction === 'exit' && target.defaultAction === 'act' && !nonEmpty(target.counterpart)) return 1;
    if (target.defaultAction === 'act') return 2;
    if (target.defaultAction === 'hold' && target.kind === 'called_shot') return 3;
  }
  if (commandKey && cardKeyOf(tile) === commandKey) return 4;
  return null;
}

/** Order within a priority: the card whose oldest call was minted earliest, then the lowest callId. */
function stableOrder(a, b) {
  const oa = a.calls[a.calls.length - 1];
  const ob = b.calls[b.calls.length - 1];
  return (msOf(oa.mintedAt) ?? 0) - (msOf(ob.mintedAt) ?? 0) || String(oa.callId).localeCompare(String(ob.callId));
}

/**
 * THE NOW CARD (§5.2): a card held after Confirm exit while its step stands,
 * else a spotlight while its card needs you, else the first match by
 * priority. Returns the tile or null.
 */
export function chooseNow(tiles, { spotlightKey = null, heldKey = null, commandKey = null } = {}) {
  const open = (Array.isArray(tiles) ? tiles : []).filter((t) => t.group !== 'earlier');
  if (heldKey) {
    const held = open.find((t) => cardKeyOf(t) === heldKey);
    if (held && held.step === 'on_card') return held;
  }
  if (spotlightKey) {
    const spot = open.find((t) => cardKeyOf(t) === spotlightKey);
    if (spot && spot.group === 'needsYou' && !isUpsideCall(spot.target ?? spot.call)) return spot;
  }
  const ranked = open.map((t) => ({ t, p: nowPriorityOf(t, { commandKey }) })).filter((x) => x.p !== null);
  ranked.sort((x, y) => x.p - y.p || stableOrder(x.t, y.t));
  return ranked[0]?.t ?? null;
}

/** The kind eyebrow (§5.2): Exit call · Hold call · Entry call; a hold default of either direction is a Hold call. */
function kindOf(call) {
  if (isUpsideCall(call)) return COPY.cockpit2bKindUpside;
  if (call.defaultAction === 'hold') return COPY.cockpit2bKindHold;
  return call.direction === 'exit' ? COPY.cockpit2bKindExit : COPY.cockpit2bKindEntry;
}

/** The plan as one sentence, the silence line, the facts line — record fields only (§5.2). Null parts when a field is missing. */
export function planLinesOf(call, { agent, nowMs, evaluations = [] }) {
  const side = call?.condition?.side;
  const level = finite(call?.condition?.level) ? fmtPrice(call.condition.level) : null;
  if (!call || isUpsideCall(call) || !level || (side !== 'above' && side !== 'below') || !nonEmpty(call.symbol)) return { plan: null, silence: null, facts: null };
  const deadline = deadlineText(call.horizon, { nowMs, ...CLOCK });
  const sym = call.symbol;
  let plan;
  let verb;
  if (call.direction === 'exit' && call.defaultAction === 'act') { plan = COPY.cockpit2bPlanExitAct(agent, sym, side, level, deadline); verb = 'exits'; }
  else if (call.direction === 'exit' && call.defaultAction === 'hold') { plan = COPY.cockpit2bPlanExitHold(agent, sym, side, level, deadline); verb = 'holds'; }
  else if (call.direction === 'entry' && call.defaultAction === 'act') { plan = COPY.cockpit2bPlanEntryAct(agent, sym, nonEmpty(call.counterpart) ? call.counterpart : null, side, level, deadline); verb = 'brings it in'; }
  else if (call.direction === 'entry' && call.defaultAction === 'hold') { plan = COPY.cockpit2bPlanEntryHold(agent, sym, side, level, deadline); verb = 'waits'; }
  else return { plan: null, silence: null, facts: null };
  const cited = citedPriceOf(call, evaluations);
  return { plan, silence: COPY.cockpit2bSilence(verb), facts: COPY.cockpit2bFacts(deadline, sym, cited?.price ?? null, cited?.check ?? null) };
}

/** A button's 2b label (§6.2), from the shared table's answer and the call's shape. */
export function buttonLabelOf(call, answer) {
  if (answer === 'go') return call.direction === 'exit' ? COPY.cockpit2bConfirmExit : COPY.cockpit2bGoIfTriggers;
  if (answer === 'hold') return call.defaultAction === 'hold' ? COPY.cockpit2bHold : COPY.cockpit2bHoldOff;
  if (answer === 'go_now') return call.direction === 'exit' ? COPY.cockpit2bExitInstead : COPY.cockpit2bBringItIn;
  return null;
}

/** The card's buttons in 2b's words: agreeing free, every override with one bullet; none left → "No commands left", disabled. */
function buttonsOf(tile, { meter, pending }) {
  const target = tile.target ?? tile.call;
  return (tile.buttons || []).map((b) => {
    const override = b.row === 'directive';
    const noneLeft = override && Boolean(meter?.zero);
    const sending = Boolean(pending) && pending.callId === b.callId && pending.answer === b.answer && !nonEmpty(pending.pickSymbol);
    const label = sending ? COPY.cockpit2bSending : (noneLeft ? COPY.cockpit2bNoCommands : buttonLabelOf(target, b.answer));
    return {
      answer: b.answer,
      row: b.row,
      callId: b.callId,
      label,
      dot: override && !noneLeft,
      aria: override && !noneLeft ? COPY.cockpit2bOneCommandAria(label) : label,
      disabled: b.disabled || noneLeft,
      // "Exit instead" with no usable counterpart opens the step (§6.2, V5-4) instead of filing.
      opensStep: b.answer === 'go_now' && tile.step === 'after_exit_instead',
    };
  });
}

/** A chip's state at the server's now, by the one test (D-7). */
function chipOf(option, call, { battle, nowMs, locked }) {
  const verdict = battle ? canComeIn({ battle, out: call.symbol, slot: call.slot, inSymbol: option.symbol, atMs: nowMs }) : { ok: true };
  let note = null;
  if (!verdict.ok) note = verdict.reason === 'pick_locked' ? COPY.cockpit2bChipLocked : (verdict.reason === 'pick_already_held' ? COPY.cockpit2bChipHeld : COPY.cockpit2bChipCant);
  return { symbol: option.symbol, source: option.source, note, disabled: !verdict.ok || locked, picked: false };
}

function groupsOf(call, agent, chipFor) {
  const options = Array.isArray(call.replacementOptions) ? call.replacementOptions.filter((o) => o && nonEmpty(o.symbol)) : [];
  return [
    { key: 'agent', label: COPY.cockpit2bAgentLists(agent), chips: options.filter((o) => o.source === 'agent').map(chipFor) },
    { key: 'bench', label: COPY.cockpit2bByRank, chips: options.filter((o) => o.source === 'bench').map(chipFor) },
  ].filter((g) => g.chips.length > 0);
}

/**
 * The "Who comes in?" step (§5.3), while it asks: the call's STORED options
 * (a call minted before 2b has none — only "Browse the bench →"), each judged
 * at the server's now. At zero commands or while an answer is in flight every
 * chip waits.
 */
export function stepOf(tile, { battle, nowMs, agent, meter, pending = null, held = false }) {
  const call = tile.target ?? tile.call;
  if (!tile.step) return null;
  const locked = Boolean(meter?.zero) || Boolean(pending);
  const sendingPick = Boolean(pending) && pending.callId === call.callId && nonEmpty(pending.pickSymbol) ? pending.pickSymbol : null;
  const groups = groupsOf(call, agent, (o) => ({ ...chipOf(o, call, { battle, nowMs, locked }), sending: o.symbol === sendingPick }));
  return {
    state: tile.step,
    title: COPY.cockpit2bWho(call.symbol),
    browse: COPY.cockpit2bBrowse,
    groups,
    filedLine: null,
    noneLeft: meter?.zero ? COPY.cockpit2bNoCommands : null,
    // After "Exit instead" (V5-4): the foot files go_now with no name, or cancels.
    letChoose: tile.step === 'after_exit_instead' ? COPY.cockpit2bLetChoose(agent) : null,
    letChooseDisabled: Boolean(meter?.zero) || Boolean(pending),
    cancel: tile.step === 'after_exit_instead' ? COPY.cockpit2bCancel : null,
    // After "Confirm exit" (V5-6) the card stays until a pick or Done.
    done: held ? COPY.cockpit2bDone : null,
    callId: call.callId,
    symbol: call.symbol,
  };
}

/** The step once a name is filed (§5.3 "After a filing"): every chip disabled, the chosen one marked, the filed line. */
function filedStepOf(call, name, { agent }) {
  const groups = groupsOf(call, agent, (o) => ({ symbol: o.symbol, source: o.source, note: null, disabled: true, picked: o.symbol === name, sending: false }));
  return { state: 'filed', title: COPY.cockpit2bWho(call.symbol), browse: null, groups, filedLine: COPY.cockpit2bComesIn(name, call.symbol), noneLeft: null, letChoose: null, letChooseDisabled: true, cancel: null, done: null, callId: call.callId, symbol: call.symbol };
}

/** The directive record filed under a member's thread: the slot when it is that thread, else the thread's exchange. */
export function recordOf(member, { directive = null, exchanges = [] } = {}) {
  const thread = member?.playerResponse?.directiveThreadId;
  if (member?.playerResponse?.kind !== 'directive' || !nonEmpty(thread)) return null;
  if (directive?.directiveThreadId === thread) return directive;
  const ex = (Array.isArray(exchanges) ? exchanges : []).find((e) => e?.directiveThreadId === thread && e.directive && typeof e.directive === 'object');
  return ex?.directive ?? null;
}

/** The command card's receipts (§5.2): Filed {t} → Heard at the {t} check | not yet heard | no check left today → the outcome. */
export function commandReceiptsOf(member, tag, { events = [], evaluations = [] } = {}) {
  const pr = member.playerResponse;
  const out = [COPY.cockpit2bFiled(etTime(isoOf(pr?.filedAt)))];
  const fact = tag?.fact ?? null;
  if (nonEmpty(pr?.heardEvalId)) {
    const heard = [...events].reverse().find((e) => e?.kind === 'heard') ?? null;
    const at = promptBuiltAtOf(evaluations, pr.heardEvalId) ?? isoOf(heard?.evidence?.promptBuiltAt);
    out.push(COCKPIT_FACT_TAGS['event:heard'].text({ check: checkOf(at) }));
  } else if (fact === 'answer:directive_no_check') out.push(COPY.cockpit2bNoCheckLeft);
  else if (fact === 'answer:directive') out.push(COPY.cockpit2bNotYetHeard);
  else out.push(COPY.cockpit2bNotHeard);
  if (fact === 'event:acted' || fact === 'event:no_matching_trade' || fact === 'event:retired' || fact === 'event:superseded') out.push(tag.text);
  return out;
}

/**
 * One card's anatomy (§5.2; an expanded strip chip, §5.4): the call card while
 * it asks; the command card once a directive answer stands on it (V5-2: the
 * canonical text verbatim from the directive record; no "Change" — V5-3); the
 * upside line alone for an upside call (V5-1).
 */
export function cardViewOf(tile, ctx) {
  const { agent, nowMs, evaluations = [], directive = null, exchanges = [], battle = null, meter = null, pending = null, eventsMap = new Map(), heldKey = null, slotThread = null } = ctx;
  const target = tile.target ?? tile.call;
  const oldest = tile.calls[tile.calls.length - 1];
  const key = cardKeyOf(tile);
  const base = {
    key,
    tileId: tile.id,
    callId: target.callId,
    symbol: target.symbol,
    tag: tile.tag,
    followTag: tile.followTag,
    from: COPY.cockpit2bFrom(checkOf(oldest.evidence?.priceAsOf)),
    latestLine: tile.lineMoved ? tile.restated : null,
    lineMoved: tile.lineMoved,
    earlierLevels: tile.earlierLevels || [],
    commandLine: tile.commandLine,
    answerLine: tile.answerLine ?? null,
    refusalLine: tile.refusalLine ?? null,
    needsYou: tile.group === 'needsYou',
  };
  if (isUpsideCall(target)) return { ...base, mode: 'upside', eyebrow: COPY.cockpit2bKindUpside, upsideLine: tile.line, buttons: [], step: null };
  // The directive answer standing on the card: the live command's member, else any open member's filing.
  const filed = tile.calls.find((c) => c.state === 'open' && c.playerResponse?.kind === 'directive' && c.playerResponse.directiveThreadId === slotThread)
    ?? tile.calls.find((c) => c.state === 'open' && c.playerResponse?.kind === 'directive') ?? null;
  if (filed && !tile.newAsk) {
    const record = recordOf(filed, { directive, exchanges });
    const name = chosenNameOf(filed, { directive, exchanges });
    return {
      ...base,
      mode: 'command',
      eyebrow: COPY.cockpit2bKindCommand(etSlotTime(isoOf(filed.evidence?.priceAsOf))),
      text: nonEmpty(record?.text) ? record.text : null,
      receipts: commandReceiptsOf(filed, tile.tag, { events: eventsMap.get(filed.callId) ?? [], evaluations }),
      buttons: [],
      step: name && filed.direction === 'exit' ? filedStepOf(filed, name, { agent }) : null,
    };
  }
  const lines = planLinesOf(target, { agent, nowMs, evaluations });
  return {
    ...base,
    mode: 'call',
    eyebrow: kindOf(target),
    plan: lines.plan,
    silence: lines.silence,
    facts: lines.facts,
    buttons: buttonsOf(tile, { meter, pending }),
    step: stepOf(tile, { battle, nowMs, agent, meter, pending, held: heldKey === key && tile.step === 'on_card' }),
    // A command standing beside a new ask (D-12 condition 1) keeps its own words under the ask.
    commandText: tile.newAsk && filed ? (recordOf(filed, { directive, exchanges })?.text ?? null) : null,
  };
}

/** A strip chip's word (§5.4). */
export function chipWordOf(tile, { commandKey = null } = {}) {
  const target = tile.target ?? tile.call;
  if (isUpsideCall(target)) return { word: COPY.cockpit2bWordUpside, yours: false };
  if (commandKey && cardKeyOf(tile) === commandKey && !tile.newAsk) {
    const following = Array.isArray(tile.following) && tile.following.includes(tile.call.callId);
    return { word: following ? COPY.cockpit2bWordFollowing : COPY.cockpit2bWordCommand, yours: true };
  }
  if ((tile.buttons || []).length === 0 && tile.calls.some((c) => c.state === 'open' && c.playerResponse?.kind === 'ack')) return { word: COPY.cockpit2bWordAgreed, yours: false };
  if (target.direction === 'exit') return { word: target.defaultAction === 'hold' ? COPY.cockpit2bWordHold : COPY.cockpit2bWordExit, yours: false };
  return { word: target.defaultAction === 'hold' ? COPY.cockpit2bWordWait : COPY.cockpit2bWordEnter, yours: false };
}

/** One strip chip: "{SYM} {↑|↓} {level} · {word}" (+ "· line moved"), with the newest call's level. */
export function stripChipOf(tile, { commandKey = null } = {}) {
  const call = tile.call;
  const { word, yours } = chipWordOf(tile, { commandKey });
  const parts = [`${call.symbol} ${arrowOf(call.condition?.side)} ${chipLevelOf(call.condition?.level)}`, word];
  if (tile.lineMoved) parts.push(COPY.cockpit2bLineMovedShort);
  const text = parts.join(' · ');
  return {
    key: cardKeyOf(tile),
    text,
    aria: COPY.cockpit2bChipAria(text),
    side: call.condition?.side ?? null,
    yours,
    needsYou: tile.group === 'needsYou',
    upside: isUpsideCall(tile.target ?? call),
    // "Spotlight →" only where it can lead: a card that needs you (§5.2).
    spotlight: tile.group === 'needsYou' && !isUpsideCall(tile.target ?? call),
  };
}

/** The day line (§5.5): over the battle's 'on' records (picks included — every record). A zero part is still shown. */
export function dayLineOf(calls) {
  const on = cockpitCalls(calls);
  const hit = on.filter((c) => c.state === 'hit').length;
  const expired = on.filter((c) => c.state === 'expired_unresolved').length;
  const answered = on.filter((c) => c.playerResponse && typeof c.playerResponse === 'object').length;
  return COPY.cockpit2bDayLine(on.length, hit, expired, answered);
}

/** Earlier (§5.6): every resolved call, "{SYM} {↑|↓} {level} · {tag}". */
export function earlierOf(feed) {
  const rows = (feed?.earlier || []).map((t) => ({
    key: t.id,
    tileId: t.id,
    tone: t.tag?.tone ?? 'muted',
    text: COPY.cockpit2bEarlierRow(t.call.symbol, arrowOf(t.call.condition?.side), chipLevelOf(t.call.condition?.level), t.tag?.text ?? null),
  }));
  return { count: feed?.earlierTotal ?? rows.length, rows };
}

/**
 * THE V5 VIEW (§5): everything the screen draws, from the feed and the records.
 *
 * @param {object} p
 * @param {object} p.feed            buildCockpitFeed({ ..., v2: true })
 * @param {object[]} p.calls         the raw call records (the day line counts them)
 * @param {object[]} p.events        the call events (the command card's receipts)
 * @param {object[]} p.rawExchanges  the RAW battle document's chatExchanges (the meter, the records' texts)
 * @param {object} p.battle          the battle document (the step's live test, D-7; the slot)
 * @param {string} p.agent           the agent's name
 * @param {number} p.nowMs           the SERVER's now
 * @param {boolean} p.phone
 * @param {object} p.ui              client state: { spotlightKey, heldKey, expandedKey, overflow, pending }
 */
export function buildCockpit2bView({
  feed, calls = [], events = [], rawExchanges = [], battle = null, agent = 'Your Agent', nowMs, phone = false,
  evaluations = [], nextDecisionAt = null, league = false, controlEpochLog = null, suppressed = false, ui = {},
}) {
  if (!feed) return null;
  const meter = meterOf(rawExchanges, { league });
  const tiles = [...feed.needsYou, ...feed.waiting];
  const command = feed.command ?? null;
  const commandTile = command ? tiles.find((t) => t.calls.some((c) => c.callId === command.call?.callId)) ?? null : null;
  const commandKey = commandTile ? cardKeyOf(commandTile) : null;
  const nowTile = chooseNow(tiles, { spotlightKey: ui.spotlightKey ?? null, heldKey: ui.heldKey ?? null, commandKey });
  const ctx = {
    agent, nowMs, evaluations, directive: battle?.directive ?? null, exchanges: rawExchanges, battle, meter,
    pending: ui.pending ?? null, eventsMap: eventsByCall(events), heldKey: ui.heldKey ?? null,
    slotThread: liveCallSlotOf({ directive: battle?.directive ?? null, nowMs, controlEpochLog, suppressed })?.directiveThreadId ?? null,
  };
  const others = tiles.filter((t) => t !== nowTile);
  const limit = phone ? STRIP_SHOWN.phone : STRIP_SHOWN.desktop;
  const chips = others.map((t) => ({ ...stripChipOf(t, { commandKey }), card: ui.expandedKey === cardKeyOf(t) ? cardViewOf(t, ctx) : null }));
  const shown = ui.overflow ? chips : chips.slice(0, limit);
  return {
    meter,
    nowCount: feed.needsYouCount,
    now: nowTile ? cardViewOf(nowTile, ctx) : null,
    nowKey: nowTile ? cardKeyOf(nowTile) : null,
    quietLine: nowTile ? null : COPY.cockpit2bQuiet(agent, nextDecisionAt),
    strip: {
      header: COPY.cockpit2bAlsoLive(chips.length),
      count: chips.length,
      chips: shown,
      hidden: chips.length - shown.length,
      more: chips.length > shown.length ? COPY.cockpit2bMore(chips.length - shown.length) : null,
      fewer: ui.overflow && chips.length > limit ? COPY.cockpit2bFewer : null,
    },
    dayLine: dayLineOf(calls),
    earlier: earlierOf(feed),
    empty: feed.empty,
    commandKey,
  };
}

/** The live slot's command symbol: `action.symbol`, or `swapOut` for a pick (§5.8). */
function bookSymbolOf(slot) {
  if (!slot) return null;
  const sym = slot.kind === 'call_pick' ? slot.action?.swapOut : slot.action?.symbol;
  return nonEmpty(sym) ? sym : null;
}

/**
 * The live call-family command (§4 "Live slot"), for the replace confirmation
 * (§6.3) and the composer line (§5.9) — the endpoint's own predicate
 * (liveCallSlotOf: not expired, not killed, not suppressed).
 */
export function liveCommandOf({ directive, nowMs, controlEpochLog = null, suppressed = false }) {
  const slot = liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed });
  if (!slot) return null;
  return { symbol: bookSymbolOf(slot), text: slot.text ?? null, threadId: slot.directiveThreadId, callId: slot.callId ?? null };
}

/**
 * Does an override on `callId` need the replace confirmation first (§6.3)? A
 * live call-family command on ANOTHER call (the endpoint exempts the slot's own
 * call). A live chat directive the client does not judge: the endpoint's 409
 * `replace_unconfirmed` opens the same prompt.
 */
export function needsReplaceConfirm(live, callId) {
  return Boolean(live) && live.callId !== callId;
}

/** The replace confirmation's line (§6.3): a cockpit command (from the slot) or a chat directive (from a 409 body's currentText). */
export function replaceLineOf({ kind, symbol = null, text, agent }) {
  if (!nonEmpty(text)) return null;
  return kind === 'cockpit' ? COPY.cockpit2bReplaceCommand(nonEmpty(symbol) ? symbol : null, text, agent) : COPY.cockpit2bReplaceChat(text, agent);
}

/** The board-row marks (§5.8): 'command' for the live command's book symbol, 'open' for any other open call's. */
export function rowMarksOf({ feed, directive, nowMs, controlEpochLog = null, suppressed = false }) {
  const marks = {};
  for (const t of [...(feed?.needsYou || []), ...(feed?.waiting || [])]) {
    for (const c of t.calls) if (nonEmpty(c.symbol) && c.state === 'open') marks[c.symbol] = 'open';
  }
  const sym = bookSymbolOf(liveCallSlotOf({ directive, nowMs, controlEpochLog, suppressed }));
  if (sym) marks[sym] = 'command';
  return marks;
}

// ---------------------------------------------------------------------------
// The bench sheet (§5.7, V5's 6A) — rows from the bench endpoint (S-10), as read.

/** The sorts, Rank first (the default). */
export const BENCH_SORTS = Object.freeze(['rank', 'move', 'sector']);

const nullsLast = (a, b, cmp) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b);
};
const numOrNull = (v) => (finite(v) ? v : null);
const strOrNull = (v) => (nonEmpty(v) ? v : null);

/** Rank ascending · today's move descending · sector A→Z then rank — unknowns last, then the symbol. */
export function sortBenchRows(rows, sort = 'rank') {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const bySym = (a, b) => String(a.symbol).localeCompare(String(b.symbol));
  const byRank = (a, b) => nullsLast(Number.isInteger(a.rank) ? a.rank : null, Number.isInteger(b.rank) ? b.rank : null, (x, y) => x - y);
  if (sort === 'move') return list.sort((a, b) => nullsLast(numOrNull(a.changePct), numOrNull(b.changePct), (x, y) => y - x) || byRank(a, b) || bySym(a, b));
  if (sort === 'sector') return list.sort((a, b) => nullsLast(strOrNull(a.sector), strOrNull(b.sector), (x, y) => x.localeCompare(y)) || byRank(a, b) || bySym(a, b));
  return list.sort((a, b) => byRank(a, b) || bySym(a, b));
}

/** "+1.2%" / "−0.8%" / "0.0%"; null without a number. */
export function pctText(v) {
  if (!finite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

/**
 * The agent's own names, live (§4's eyeing names — labelled by their lists): the newest evaluation's
 * `candidates` stamp and the newest 'on' declarations `watching` (the
 * Monitoring reader's record). The sheet's "On {Agent}'s list" marker only;
 * a card's chips use the call's STORED options.
 */
export function agentListsOf({ evaluations = [], monitoring = null } = {}) {
  const out = new Set();
  const newest = Array.isArray(evaluations) && evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;
  for (const c of Array.isArray(newest?.candidates) ? newest.candidates : []) if (nonEmpty(c?.symbol)) out.add(c.symbol);
  for (const s of Array.isArray(monitoring?.symbols) ? monitoring.symbols : []) if (nonEmpty(s)) out.add(s);
  return out;
}

/**
 * The agent's note on a row (§5.7, V5-7): its OWN sentence about that name
 * from its last check that carries words — the Bench pane's selector
 * (selectBench `cards`), the first sentence naming the symbol, verbatim.
 * Null when no sentence names it.
 */
export function benchNoteOf(benchState, symbol) {
  const card = (Array.isArray(benchState?.cards) ? benchState.cards : []).find((c) => Array.isArray(c?.symbols) && c.symbols.includes(symbol));
  return nonEmpty(card?.text) ? card.text : null;
}

/** What a pick on this call files (§5.7): `replace` on the card's step, `go_now` with the name after "Exit instead"; null otherwise. */
export function pickAnswerFor(step) {
  if (step === 'on_card') return 'replace';
  if (step === 'after_exit_instead') return 'go_now';
  return null;
}

/**
 * The sheet (§5.7): scoped to a call's step ("Who comes in for {SYM}?") or
 * browsing ("The bench"). Every number is the endpoint's; a missing one is
 * "—". A Pick carries one bullet; at zero commands, while an answer is in
 * flight, or once a pick is filed, every Pick waits.
 *
 * @param {object} p
 * @param {'loading'|'ready'|'error'} p.status
 * @param {object|null} p.data       the endpoint's 200 body { asOf, out, rows }
 * @param {object|null} p.call       the scoped call (null = browse)
 * @param {string|null} p.step       the call's step (replacementStepFor)
 * @param {Set<string>} p.agentLists agentListsOf(...)
 * @param {object|null} p.benchState selectBench(battle)
 * @param {string|null} p.filedText  the filed command's canonical text once a pick lands
 */
export function benchSheetOf({ status = 'loading', data = null, call = null, step = null, agent = 'Your Agent', agentLists = new Set(), benchState = null, sort = 'rank', meter = null, pending = null, filedText = null }) {
  const scoped = Boolean(call);
  const answer = scoped ? pickAnswerFor(step) : null;
  const filed = nonEmpty(filedText);
  const waits = Boolean(meter?.zero) || Boolean(pending) || filed || !answer;
  const rows = sortBenchRows(Array.isArray(data?.rows) ? data.rows : [], BENCH_SORTS.includes(sort) ? sort : 'rank').map((r) => {
    let action;
    if (r.status === 'locked') action = { kind: 'locked', label: COPY.cockpit2bLockedUntil(etTime(r.lockedUntil ?? null)) };
    else if (r.status === 'not_swappable') action = { kind: 'not_swappable', label: COPY.cockpit2bNotSwappable };
    else if (r.status === 'no_price') action = { kind: 'no_price', label: COPY.cockpit2bNoPrice };
    else if (scoped) {
      const sending = Boolean(pending) && pending.callId === call.callId && pending.pickSymbol === r.symbol;
      const label = sending ? COPY.cockpit2bSending : COPY.cockpit2bPick;
      action = { kind: 'pick', label, answer, disabled: waits, dot: !waits, aria: COPY.cockpit2bOneCommandAria(`${COPY.cockpit2bPick} ${r.symbol}`) };
    } else action = { kind: 'available', label: COPY.cockpit2bAvailable };
    return {
      symbol: r.symbol,
      rank: Number.isInteger(r.rank) ? String(r.rank) : '—',
      sector: nonEmpty(r.sector) ? r.sector : '—',
      day: pctText(r.changePct) ?? '—',
      dayTone: finite(r.changePct) ? (r.changePct > 0 ? 'up' : r.changePct < 0 ? 'down' : 'flat') : 'flat',
      atr: finite(r.atrPct) ? COPY.cockpit2bAtr(`${r.atrPct.toFixed(1)}%`) : '—',
      onAgentList: agentLists.has(r.symbol),
      note: benchNoteOf(benchState, r.symbol),
      action,
    };
  });
  const available = (Array.isArray(data?.rows) ? data.rows : []).filter((r) => r.status === 'available').length;
  return {
    scoped,
    title: scoped ? COPY.cockpit2bWho(call.symbol) : COPY.cockpit2bBenchTitle,
    sub: status === 'ready' ? COPY.cockpit2bBenchSub(rows.length, available, etTime(data?.asOf ?? null)) : null,
    agentListLabel: COPY.cockpit2bAgentListMark(agent),
    sorts: BENCH_SORTS.map((key) => ({ key, label: key === 'rank' ? COPY.cockpit2bSortRank : key === 'move' ? COPY.cockpit2bSortMove : COPY.cockpit2bSortSector, on: key === (BENCH_SORTS.includes(sort) ? sort : 'rank') })),
    rows: status === 'ready' ? rows : [],
    loading: status === 'loading' ? COPY.cockpit2bBenchLoading : null,
    error: status === 'error' ? COPY.cockpit2bBenchError : null,
    noneLeft: scoped && meter?.zero ? COPY.cockpit2bNoCommands : null,
    filedBar: filed ? COPY.cockpit2bFiledBar(filedText) : null,
    done: filed ? COPY.cockpit2bDone : null,
    callId: call?.callId ?? null,
  };
}
