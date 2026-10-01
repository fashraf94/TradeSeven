// api/_utils/filmTape/candleInputs.js
//
// Film Room tape — WHAT THE CANDLE PASS READS from a tape, in one place, so the
// candle pass that builds from it and the close pass that merges into it see
// the same thing (spec §6; BA-25). PURE: a tape document in, values out.
//
//   symbolPlan              the symbol set and each symbol's roles (spec §6)
//   candleInputFingerprint  a digest, part by part, of the VALUES the candle
//                           output consumes (BA-31, value-sensitive): per
//                           check its id, time, state and stageReached; the
//                           evidence prices and changes the reconciliation
//                           reads; per action both legs' replay-input values
//                           (entry, ATR, tier, direction, threshold history,
//                           baseline), lockedPoints, the swap instant and
//                           subsequentTradesInSlot; per plan its id, instant
//                           and symbol; the symbol-role set and the sector
//                           each symbol is compared with. Never a candle-owned
//                           field (replay, price, series) and never provenance
//                           or bookkeeping (preservedFrom, writtenAt, copiedAt,
//                           `sources`, coverage), so neither the candle pass's
//                           own write nor preserving a fact moves it.
//
// The candle pass stores the fingerprint of the tape it read in
// `passes.candles.inputFingerprint`; the close pass compares it with the
// merged tape's (tapeMerge.js mergeCandles). A difference re-queues the candle
// pass inside its window, or — outside it — expires a `written` pass (BA-25
// amended), names what changed, and labels the output built before it. The
// review's DF1: a digest of which inputs were PRESENT let a corrected entry
// price or evidence price leave a replay built from the old value "written".
//
//   replayBuiltFrom / priceBuiltFrom / seriesBuiltFrom — BA-31: the identity
//                           of ONE output unit's own inputs (an action's
//                           replay, a plan's price, a symbol's series), from
//                           the same values. The candle pass stores it on the
//                           unit as `builtFrom`; a unit is current only while
//                           it equals the hash of its inputs on the tape now,
//                           so a unit kept from an earlier attempt is known
//                           for what it is (the review's DF2).
//   laterChecks, scoredCheck — the checks a replay samples, shared with the
//                           replay itself (tapeReplay.js) so the identity and
//                           the replay can never disagree on them.

import { createHash } from 'node:crypto';
import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import { MARKET_COMPARABLES, NON_CHECK_STATES } from '../../../src/constants/filmTape.js';
import { STAGES } from '../tickCapture/captureConfig.js';
import { toMs } from './tapeTime.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const rows = (v) => (Array.isArray(v) ? v.filter(isObj) : []);

/** The symbol set and each symbol's roles for one tape (spec §6). */
export function symbolPlan(tape) {
  const roles = new Map();
  const add = (sym, role) => {
    if (typeof sym !== 'string' || !sym || isCryptoSymbol(sym)) return;
    if (!roles.has(sym)) roles.set(sym, new Set());
    roles.get(sym).add(role);
  };
  for (const c of Array.isArray(tape.checks) ? tape.checks : []) {
    for (const s of Object.keys(isObj(c.risk) ? c.risk : {})) add(s, 'held');
    for (const s of Object.keys(isObj(c.evidence) ? c.evidence : {})) add(s, 'held');
  }
  for (const a of Array.isArray(tape.actions) ? tape.actions : []) { add(a.symbolOut, 'sold'); add(a.symbolIn, 'held'); }
  for (const p of Array.isArray(tape.plans) ? tape.plans : []) add(p.symbol, 'plan');
  for (const s of Object.keys(isObj(tape.comparables?.sectors) ? tape.comparables.sectors : {})) if (!roles.has(s)) add(s, 'held');
  const named = [...roles.keys()];
  for (const s of named) add(TICKER_TO_SECTOR[s], 'sector');
  for (const s of MARKET_COMPARABLES) add(s, 'market');
  const primary = (set) => (set.has('sold') ? 'sold' : set.has('held') ? 'held' : set.has('plan') ? 'plan' : set.has('market') ? 'market' : 'sector');
  return [...roles.entries()].map(([symbol, set]) => ({ symbol, role: primary(set), roles: [...set].sort() }))
    .sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
}

/** The fingerprint's parts, in the words the tape uses to name what changed. */
export const CANDLE_INPUT_PARTS = Object.freeze(['checks', 'evidence', 'actions', 'plans', 'symbols']);

const digest = (list) => createHash('sha256')
  .update(JSON.stringify([...list].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))))
  .digest('hex').slice(0, 16);
const orNull = (v) => (v === undefined ? null : v);

// ── the canonical values (BA-31) — one extraction, read by every digest ────

/** A row that records a check the battle ran, at a known time: what the series and the replay sample. */
export const isCheck = (c) => isObj(c) && !NON_CHECK_STATES.includes(c.state) && toMs(c.at) !== null;
/** A check's identity: id, time, and what decides whether a replay samples it (state, stageReached, rowSource). */
export const checkValues = (c) => [orNull(c.key), orNull(c.tickSeq), orNull(c.at), orNull(c.state), orNull(c.stageReached), orNull(c.rowSource)];
/** The evidence values the reconciliation (boughtVsEvidence) reads for one symbol at one check: its price and its change. */
export const evidenceValues = (ev) => (isObj(ev) ? [orNull(ev.px), orNull(ev.chg)] : null);
/** One leg's replay-input VALUES — never its `sources`, which say where each came from. */
const legValues = (leg) => (isObj(leg)
  ? [orNull(leg.entryPrice), orNull(leg.atr), orNull(leg.tier), orNull(leg.direction),
    orNull(leg.thresholdHistory?.maxMultiplier), orNull(leg.thresholdHistory?.minMultiplier), orNull(leg.thresholdBaseline?.value)]
  : null);
/** Everything the replay reads from its action row: both legs' values, lockedPoints, the swap instant, subsequentTradesInSlot, and its key, check, symbols and stated gaps. */
export const actionValues = (a) => [orNull(a.key), orNull(a.at), orNull(a.tickSeq), orNull(a.symbolOut), orNull(a.symbolIn),
  orNull(a.replayReason), Array.isArray(a.replayMissing) ? a.replayMissing : [],
  legValues(a.replayInputs?.ghost), legValues(a.replayInputs?.bought), orNull(a.lockedPoints), orNull(a.subsequentTradesInSlot)];
/** What a plan's price reads: its id, its instant, its symbol. */
export const planValues = (p) => [orNull(p.key), orNull(p.at), orNull(p.symbol)];

/**
 * BA-31 — one digest per input part, over the VALUES the candle output
 * consumes (strings only; no number to class). The parts keep the names the
 * tape uses to say what changed (`changedInputs`).
 */
export function candleInputFingerprint(tape) {
  const checks = rows(tape?.checks).filter(isCheck);
  const sectors = isObj(tape?.comparables?.sectors) ? tape.comparables.sectors : {};
  return {
    checks: digest(checks.map(checkValues)),
    evidence: digest(checks.filter((c) => isObj(c.evidence)).map((c) => [orNull(c.key), orNull(c.at),
      Object.keys(c.evidence).sort().map((s) => [s, evidenceValues(c.evidence[s])])])),
    actions: digest(rows(tape?.actions).map(actionValues)),
    plans: digest(rows(tape?.plans).map(planValues)),
    symbols: digest([
      ...symbolPlan(tape || {}).map((e) => ['role', e.symbol, e.roles.join('+')]),
      ...Object.keys(sectors).sort().map((s) => ['sector', s, orNull(sectors[s])]),
    ]),
  };
}

// ── BA-31: each output unit's own identity ──────────────────────────────────

const SCORED_FROM = STAGES.indexOf('scores_marked');
const unitHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

/** Did this check's tick score the book (so the live history ratcheted)? */
export function scoredCheck(row) {
  if (!row || NON_CHECK_STATES.includes(row.state) || toMs(row.at) === null) return false;
  if (row.rowSource === 'entry') return true; // an entry is written only on the full path
  const idx = STAGES.indexOf(row.stageReached);
  return idx >= SCORED_FROM;
}

/**
 * The checks a replay samples after its swap: every check that scored the
 * book, after the swap instant and through the session close — never the
 * check that made the swap (its capture falls inside the same minute).
 */
export function laterChecks(checks, action, session) {
  const swapMs = toMs(action?.at);
  const ownSeq = Number.isInteger(action?.tickSeq) ? action.tickSeq : null;
  return (Array.isArray(checks) ? checks : []).filter((c) => scoredCheck(c) && toMs(c.at) > swapMs && toMs(c.at) <= session.closeMs
    && !(ownSeq !== null && c.tickSeq === ownSeq));
}

/**
 * BA-31 — what one action's replay is built from: the action's own values, the
 * checks it samples, the evidence the reconciliation reads at them, and the
 * sector each leg is compared with.
 */
export function replayBuiltFrom(tape, action, session) {
  const later = laterChecks(tape?.checks, action, session);
  const sectors = isObj(tape?.comparables?.sectors) ? tape.comparables.sectors : {};
  return unitHash(['replay', actionValues(action), later.map(checkValues),
    later.map((c) => evidenceValues(isObj(c.evidence) ? c.evidence[action.symbolIn] : null)),
    [orNull(sectors[action.symbolOut]), orNull(sectors[action.symbolIn])]]);
}

/** BA-31 — what one plan's price is built from: its id, instant and symbol. */
export const priceBuiltFrom = (plan) => unitHash(['price', planValues(plan)]);

/** BA-31 — what one symbol's series is built from: the symbol, and the checks it prices (their numbers and times). */
export const seriesBuiltFrom = (tape, symbol) => unitHash(['series', symbol,
  rows(tape?.checks).filter(isCheck).map((c) => [Number.isInteger(c.tickSeq) ? c.tickSeq : null, c.at])]);

/** The parts of two fingerprints that differ, in CANDLE_INPUT_PARTS order. */
export function changedInputParts(before, now) {
  if (!isObj(before) || !isObj(now)) return [];
  return CANDLE_INPUT_PARTS.filter((k) => before[k] !== now[k]);
}
