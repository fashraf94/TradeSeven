// api/_utils/callRecords/copy.js
//
// Cockpit Build 1a — COPY AND LINT (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §4;
// contract Amendment B §9 — the receipt vocabulary). The canonical directive
// templates live beside this in callActions.js (Amendment B §12).
//
// EVERY LINE HERE RENDERS FROM TYPED EVIDENCE ONLY — the stored call's own
// paths (`condition.side`, `condition.level`, `horizon.expiresAt`,
// `horizon.basis`, `options[].symbol`, `swapOut`), a committed executor
// result's `symbolOut` / `symbolIn`, a committed check's `promptBuiltAt`. An
// acted line is never derived from intent; a declaration is never an acted
// receipt; a pick has a request line and NO intent line (its stored
// `defaultAction` is null). Readers label an intent line "intent", never a
// promise. A check's time is the instant its prompt was built ("at the 10:30
// check") — no executor timestamp exists, so none is invented.
//
// THE LINT is the round-2 lexical rule, copied VERBATIM from
// scripts/declarations-wording-experiment.mjs:376-397 (copy.test.js proves the
// two blocks identical). It is a LEXICAL FILTER ONLY: it rejects a `said` that
// names a condition the typed fields do not hold (volume, candles, closes,
// confirmations, …); it cannot prove a sentence true, and a sentence that adds
// a condition in other words passes it. Readers therefore show a passing
// `said` only under the label "agent's own wording (unverified)" — never as a
// tile or receipt assertion — and never show a failing one.
//
// Pure. No I/O.
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-3, S-7): the
// CLIENT imports this module — `renderCallLine`, `renderUpsideLine`,
// `deadlineText` and `checkLabel` are the cockpit's tile lines, so the tile and
// the chat calls block read one renderer (BUILD_RULES §9). Every import below
// is Node-clean AND browser-clean (no `process`, no `Buffer`, no SDK). The
// `clock: '12h'` option is the client's: 12-hour ET, and a CHECK named by its
// cron SLOT (D-83 — the Battle View's one rule for naming a check, so the
// cockpit never calls a check "1:31 PM" that the chat card beside it calls
// "1:30 PM"). The default, 24-hour clock is the server's and is model-visible:
// its output is byte-for-byte what it was (copy.test.js pins it).
//
// THE UPSIDE LINE (Amendment C-2): an `entry` call on a name already held at
// mint is an upside call — symbol, side, level and deadline, NO action clause
// ("AMD above $625.00 by today's close"). `renderCallLine` routes a
// `heldAtMint` call through `renderUpsideLine` and `renderIntentLine` (the one
// action-clause renderer here) renders nothing for it.

import { formatPrice } from '../../../src/utils/formatters.js';
// Zero-import src module (BUILD_RULES §4; guarded by copy.test.js's import of
// this module): the client's ET clock and its slot rule, so the 12-hour path
// is the Battle View's own formatting, never a second copy of it.
import { etTime, etSlotTime } from '../../../src/components/Dashboard/desk/deskCopy.js';
import { etDateOf } from './horizon.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** The two clocks a line can render in: the server's (default, model-visible) and the client's. */
export const CLOCKS = Object.freeze(['24h', '12h']);

/** The pinned price formatter (src/utils/formatters.js:47-50): `$123.45`. */
export function fmtPrice(level) {
  return formatPrice(level, 2);
}

const ET_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ET_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' });

const msOf = (instant) => (typeof instant === 'string' ? Date.parse(instant) : instant);

/**
 * An instant as ET wall-clock `HH:MM` (24-hour), or null. Accepts epoch ms or
 * an ISO string. `clock: '12h'` → the client's `1:31 PM` (deskCopy's etTime).
 */
export function fmtTimeEt(instant, { clock = '24h' } = {}) {
  const ms = msOf(instant);
  if (!finite(ms)) return null;
  return clock === '12h' ? etTime(new Date(ms).toISOString()) : ET_TIME.format(new Date(ms));
}

/** The ET weekday name of an instant, or null. */
export function fmtWeekdayEt(instant) {
  const ms = msOf(instant);
  return finite(ms) ? ET_WEEKDAY.format(new Date(ms)) : null;
}

/**
 * "the 10:30 check" from a committed check's promptBuiltAt (ISO string or ms),
 * or null. `clock: '12h'` → "the 1:30 PM check", the check named by its SLOT
 * (deskCopy's etSlotTime, D-83) — the client's label for the same check.
 */
export function checkLabel(promptBuiltAt, { clock = '24h' } = {}) {
  if (clock === '12h') {
    const ms = msOf(promptBuiltAt);
    const slot = finite(ms) ? etSlotTime(new Date(ms).toISOString()) : null;
    return slot ? `the ${slot} check` : null;
  }
  const t = fmtTimeEt(promptBuiltAt);
  return t ? `the ${t} check` : null;
}

/**
 * The deadline phrase from the stored horizon (spec §4):
 *   next_check   → "by the next check"
 *   this_session → "by today's close" only when `expiresAt` falls on today's ET
 *                  date (relative to `nowMs`), else "by <Weekday>'s close"
 *   this_battle  → "before the battle ends"
 *   explicit     → "by HH:MM" (ET; `clock: '12h'` → "by 2:30 PM", the exact
 *                  minute — a deadline is an instant, never a check slot)
 * Null when the horizon cannot be read.
 */
export function deadlineText(horizon, { nowMs = Date.now(), clock = '24h' } = {}) {
  const basis = horizon?.basis;
  const expiresAt = horizon?.expiresAt;
  switch (basis) {
    case 'next_check':
      return 'by the next check';
    case 'this_session': {
      if (!finite(expiresAt) || !finite(nowMs)) return null;
      return etDateOf(expiresAt) === etDateOf(nowMs) ? "by today's close" : `by ${fmtWeekdayEt(expiresAt)}'s close`;
    }
    case 'this_battle':
      return 'before the battle ends';
    case 'explicit':
      return finite(expiresAt) ? `by ${fmtTimeEt(expiresAt, { clock })}` : null;
    default:
      return null;
  }
}

/** The pick's request line: `support: AMD or JPM for KO`. */
function renderPickLine(call) {
  const options = Array.isArray(call?.options) ? call.options.map((o) => o?.symbol).filter(nonEmpty) : [];
  if (!nonEmpty(call?.slot) || options.length === 0 || !nonEmpty(call?.swapOut)) return null;
  return `${call.slot}: ${options.join(' or ')} for ${call.swapOut}`;
}

/** Is this an upside call (Amendment C-2)? Records without the field read as false. */
export function isUpsideCall(call) {
  return !!call && typeof call === 'object' && call.kind !== 'pick' && call.heldAtMint === true;
}

/** symbol · side · level · deadline — the shared core of the call and upside lines. Null when a field is missing. */
function conditionLine(call, { nowMs, clock }) {
  const side = call.condition?.side;
  const level = call.condition?.level;
  if (!nonEmpty(call.symbol) || (side !== 'above' && side !== 'below') || !finite(level)) return null;
  const deadline = deadlineText(call.horizon, { nowMs, clock });
  return `${call.symbol} ${side} ${fmtPrice(level)}${deadline ? ` ${deadline}` : ''}`;
}

/**
 * THE UPSIDE LINE (Amendment C-2): an upside call's symbol, side, level and
 * deadline — `AMD above $625.00 by today's close` — and NO action clause, ever.
 * Null for anything that is not an upside call, or when a stored field is
 * missing.
 */
export function renderUpsideLine(call, { nowMs = Date.now(), clock = '24h' } = {}) {
  if (!isUpsideCall(call)) return null;
  return conditionLine(call, { nowMs, clock });
}

/**
 * THE CALL LINE, from the stored record (spec §4). Shots and confirmations:
 * `AMD above $161.00 by today's close`; picks: the request line. Null when a
 * required stored field is missing — never a guess. An upside call is
 * rendered by renderUpsideLine — never with an action clause (C-2).
 */
export function renderCallLine(call, { nowMs = Date.now(), clock = '24h' } = {}) {
  if (!call || typeof call !== 'object') return null;
  if (call.kind === 'pick') return renderPickLine(call);
  if (isUpsideCall(call)) return renderUpsideLine(call, { nowMs, clock });
  return conditionLine(call, { nowMs, clock });
}

/**
 * THE INTENT LINE — shots and confirmations only, from the stored
 * `defaultAction` / `direction` / `counterpart`; readers label it intent,
 * never a promise. A pick has none (its `defaultAction` is null), and neither
 * has an upside call: "bring in" a name already held is the action clause
 * Amendment C-2 forbids.
 */
export function renderIntentLine(call) {
  if (!call || typeof call !== 'object' || call.kind === 'pick') return null;
  if (isUpsideCall(call)) return null;
  const act = call.defaultAction === 'act';
  if (!act && call.defaultAction !== 'hold') return null;
  if (!act) return 'Intent: hold';
  const counterpart = nonEmpty(call.counterpart) ? ` for ${call.counterpart}` : '';
  return `Intent: ${call.direction === 'exit' ? `exit${counterpart}` : `bring in${counterpart}`}`;
}

// ---------------------------------------------------------------------------
// Event renderers (spec §4, §10) — one per event kind, typed inputs only.

/** The player-facing word for an answer. */
export const ANSWER_WORDS = Object.freeze({
  go: 'Go', hold: 'Hold off', go_now: 'Go now', pick: 'Pick', agree: 'Agree', disagree: 'Disagree',
});

/** `declared`: up to three call lines; the rest counted. Null with nothing to say. */
export function renderDeclaredEvent({ calls, nowMs = Date.now() } = {}) {
  const lines = (Array.isArray(calls) ? calls : []).map((c) => renderCallLine(c, { nowMs })).filter(Boolean);
  if (lines.length === 0) return null;
  const shown = lines.slice(0, 3);
  const more = lines.length - shown.length;
  return `Called: ${shown.join(' · ')}${more > 0 ? ` … ${more} more` : ''}`;
}

/** `answered`: the answer word (and the pick), then the canonical text when one was filed. */
export function renderAnsweredEvent({ answer, pickSymbol = null, canonicalText = null } = {}) {
  const word = ANSWER_WORDS[answer];
  if (!word) return null;
  const head = answer === 'pick' && nonEmpty(pickSymbol) ? `Answered: ${word} ${pickSymbol}` : `Answered: ${word}`;
  return nonEmpty(canonicalText) ? `${head} — ${canonicalText}` : head;
}

/** `heard`: in that check's prompt (spec §2) — never comprehension or agreement. */
export function renderHeardEvent({ promptBuiltAt } = {}) {
  const label = checkLabel(promptBuiltAt);
  return label ? `Heard at ${label}` : 'Heard (check time unavailable)';
}

/** `acted`: from the committed executor result's own symbols — NEVER from intent. Null without both symbols. */
export function renderActedEvent({ executorResult, promptBuiltAt } = {}) {
  const out = executorResult?.symbolOut;
  const inn = executorResult?.symbolIn;
  if (!nonEmpty(out) || !nonEmpty(inn)) return null;
  const label = checkLabel(promptBuiltAt);
  return `The agent exited ${out} for ${inn}${label ? ` at ${label}` : ''}`;
}

/** `no_matching_trade`: the check heard the thread and its present, parsed result did not match the call's leg. */
export function renderNoMatchingTradeEvent({ promptBuiltAt, executorResult = null, selectedSymbol = null } = {}) {
  const label = checkLabel(promptBuiltAt);
  // A pick whose slot the agent traded for something other than the selection: the committed
  // executor symbols (never intent) and the selection it was not (review L6-3 / V2-G2).
  const out = executorResult?.symbolOut;
  const inn = executorResult?.symbolIn;
  if (nonEmpty(out) && nonEmpty(inn) && nonEmpty(selectedSymbol) && inn !== selectedSymbol) {
    return `The agent exited ${out} for ${inn}${label ? ` at ${label}` : ''} — not the selected ${selectedSymbol}`;
  }
  return `No matching trade recorded${label ? ` at ${label}` : ' at this check'}`;
}

/** The sweep's and the check's expiry reasons, in words. */
export const EXPIRY_REASON_TEXT = Object.freeze({
  unobserved: 'no check observed it before its session closed',
  past_deadline: 'the deadline passed before a check observed it',
  check: 'a check observed it past its deadline',
  slot_judged: 'the check at its slot found the condition unmet',
  pick_chosen: "the check at its slot recorded the agent's own choice",
  pick_unchosen: 'the check at its slot recorded no choice',
});

/** `expired`: the reason, in words. */
export function renderExpiredEvent({ reason } = {}) {
  const text = EXPIRY_REASON_TEXT[reason];
  return text ? `Expired — ${text}` : 'Expired';
}

/** `ended_with_battle`. */
export function renderEndedWithBattleEvent() {
  return 'Ended with the battle';
}

/** `superseded`: a later filing replaced this directive — the time; the replacing thread rides the event's fields. */
export function renderSupersededEvent({ at } = {}) {
  const t = fmtTimeEt(at);
  return t ? `Superseded by a later filing at ${t} ET` : 'Superseded by a later filing';
}

/**
 * A judgment that reaches a call after its directive's bounded lifetime ended
 * (spec §6; Amendment B §4): the answer expired before this check. Never
 * implies the answer was heard.
 */
export function renderAnswerExpiredLine({ promptBuiltAt } = {}) {
  const label = checkLabel(promptBuiltAt);
  return `Answer expired before ${label ?? 'this check'}`;
}

// ---------------------------------------------------------------------------
// THE LINT — scripts/declarations-wording-experiment.mjs:376-397, verbatim.
// (copy.test.js holds the two source blocks side by side; a drift here is red.)

/**
 * The round-2 rule ("added conditions in said"), as frozen in the brief. Each
 * entry is [label, pattern]; a line is flagged when any applicable pattern
 * matches. Bare thesis language ("would confirm the breakout") matches none.
 */
const SAID_R2_ANY = [
  ['volume', /\bvolume/i],
  ['rvol', /\brvol/i],
  ['candle', /\bcandle/i],
  ['consecutive', /\bconsecutive/i],
  ['if confirmed', /\bif confirmed\b/i],
  ['on confirmation', /\bon confirmation\b/i],
  ['confirmation of', /\bconfirmation of\b/i],
  ['close(s) above/below', /\bcloses? (above|below)\b/i],
  ['holds/holding above/below … for/through', /\bhold(s|ing) (above|below)\b.*\b(for|through)\b/i],
];
const SAID_R2_NEXT_CHECK = [
  ['by/before the close (next_check)', /\b(by|before) the close\b/i],
  ['end of (the) day/session (next_check)', /\bend of (the )?(day|session)\b/i],
  ['on the day (next_check)', /\bon the day\b/i],
];
const SAID_R2_OTHER = [['next check/eval (not next_check)', /next check|next eval/i]];
/** The labels of every round-2 pattern the line trips (empty = not flagged). */
export function saidFlagsRound2(row) {
  if (typeof row?.said !== 'string') return [];
  const rules = [...SAID_R2_ANY, ...(row.horizonPhrase === 'next_check' ? SAID_R2_NEXT_CHECK : SAID_R2_OTHER)];
  return rules.filter(([, re]) => re.test(row.said)).map(([label]) => label);
}

/** Every label the rule can emit, for the corpus pin. */
export const SAID_LINT_LABELS = Object.freeze([...SAID_R2_ANY, ...SAID_R2_NEXT_CHECK, ...SAID_R2_OTHER].map(([label]) => label));

/** The terms a stored call's `said` trips under its horizon basis (the rule keys on `next_check`). */
export function saidLintTerms(said, basis) {
  return saidFlagsRound2({ said, horizonPhrase: basis });
}

/** Does the `said` pass the lexical filter? A non-string never does. */
export function saidPassesLint(said, basis) {
  return typeof said === 'string' && said.length > 0 && saidLintTerms(said, basis).length === 0;
}

/** The label a passing `said` is shown under — and the only way it is shown. */
export const SAID_UNVERIFIED_LABEL = "agent's own wording (unverified)";

/** The `said` line for a reader: labelled unverified when it passes; null (never shown) when it fails. */
export function renderSaidLine(call) {
  const said = call?.said;
  const basis = call?.horizon?.basis ?? call?.horizon?.phrase;
  if (!saidPassesLint(said, basis)) return null;
  return `${SAID_UNVERIFIED_LABEL}: "${said}"`;
}
