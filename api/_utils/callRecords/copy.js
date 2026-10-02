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

import { formatPrice } from '../../../src/utils/formatters.js';
import { etDateOf } from './horizon.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** The pinned price formatter (src/utils/formatters.js:47-50): `$123.45`. */
export function fmtPrice(level) {
  return formatPrice(level, 2);
}

const ET_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ET_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' });

/** An instant as ET wall-clock `HH:MM` (24-hour), or null. Accepts epoch ms or an ISO string. */
export function fmtTimeEt(instant) {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant;
  return finite(ms) ? ET_TIME.format(new Date(ms)) : null;
}

/** The ET weekday name of an instant, or null. */
export function fmtWeekdayEt(instant) {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant;
  return finite(ms) ? ET_WEEKDAY.format(new Date(ms)) : null;
}

/** "the 10:30 check" from a committed check's promptBuiltAt (ISO string or ms), or null. */
export function checkLabel(promptBuiltAt) {
  const t = fmtTimeEt(promptBuiltAt);
  return t ? `the ${t} check` : null;
}

/**
 * The deadline phrase from the stored horizon (spec §4):
 *   next_check   → "by the next check"
 *   this_session → "by today's close" only when `expiresAt` falls on today's ET
 *                  date (relative to `nowMs`), else "by <Weekday>'s close"
 *   this_battle  → "before the battle ends"
 *   explicit     → "by HH:MM" (ET)
 * Null when the horizon cannot be read.
 */
export function deadlineText(horizon, { nowMs = Date.now() } = {}) {
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
      return finite(expiresAt) ? `by ${fmtTimeEt(expiresAt)}` : null;
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

/**
 * THE CALL LINE, from the stored record (spec §4). Shots and confirmations:
 * `AMD above $161.00 by today's close`; picks: the request line. Null when a
 * required stored field is missing — never a guess.
 */
export function renderCallLine(call, { nowMs = Date.now() } = {}) {
  if (!call || typeof call !== 'object') return null;
  if (call.kind === 'pick') return renderPickLine(call);
  const side = call.condition?.side;
  const level = call.condition?.level;
  if (!nonEmpty(call.symbol) || (side !== 'above' && side !== 'below') || !finite(level)) return null;
  const deadline = deadlineText(call.horizon, { nowMs });
  return `${call.symbol} ${side} ${fmtPrice(level)}${deadline ? ` ${deadline}` : ''}`;
}

/**
 * THE INTENT LINE — shots and confirmations only, from the stored
 * `defaultAction` / `direction` / `counterpart`; readers label it intent,
 * never a promise. A pick has none (its `defaultAction` is null).
 */
export function renderIntentLine(call) {
  if (!call || typeof call !== 'object' || call.kind === 'pick') return null;
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
export function renderNoMatchingTradeEvent({ promptBuiltAt } = {}) {
  const label = checkLabel(promptBuiltAt);
  return `No matching trade recorded${label ? ` at ${label}` : ' at this check'}`;
}

/** The sweep's and the check's expiry reasons, in words. */
export const EXPIRY_REASON_TEXT = Object.freeze({
  unobserved: 'no check observed it before its session closed',
  past_deadline: 'the deadline passed before a check observed it',
  check: 'a check observed it past its deadline',
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
