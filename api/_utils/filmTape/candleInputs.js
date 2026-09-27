// api/_utils/filmTape/candleInputs.js
//
// Film Room tape — WHAT THE CANDLE PASS READS from a tape, in one place, so the
// candle pass that builds from it and the close pass that merges into it see
// the same thing (spec §6; BA-25). PURE: a tape document in, values out.
//
//   symbolPlan              the symbol set and each symbol's roles (spec §6)
//   candleInputFingerprint  a digest of every input the candle output depends
//                           on — check ids and times, their states and
//                           stageReached, evidence presence, action ids and
//                           their replay-input presence, plan ids and times,
//                           the symbol-role set. Never a candle-owned field
//                           (replay, price, series), so the candle pass's own
//                           write never moves it.
//
// The candle pass stores the fingerprint of the tape it built from in
// `passes.candles.inputFingerprint`; the close pass compares it with the
// merged tape's (tapeMerge.js mergeCandles). A difference re-queues the candle
// pass inside its window, or — outside it — lowers a `written` pass to
// `partial`, names what changed, and labels the output built before it.

import { createHash } from 'node:crypto';
import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import { MARKET_COMPARABLES, NON_CHECK_STATES } from '../../../src/constants/filmTape.js';
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

/** BA-25 — one digest per input part the candle output depends on (strings only; no number to class). */
export function candleInputFingerprint(tape) {
  const checks = rows(tape?.checks).filter((c) => !NON_CHECK_STATES.includes(c.state) && toMs(c.at) !== null);
  return {
    checks: digest(checks.map((c) => [orNull(c.key), orNull(c.tickSeq), c.at, orNull(c.state), orNull(c.stageReached), orNull(c.rowSource)])),
    evidence: digest(checks.filter((c) => isObj(c.evidence)).map((c) => [orNull(c.key), c.at,
      Object.keys(c.evidence).filter((s) => typeof c.evidence[s]?.px === 'number').sort()])),
    actions: digest(rows(tape?.actions).map((a) => [orNull(a.key), orNull(a.at), orNull(a.tickSeq), orNull(a.symbolOut), orNull(a.symbolIn),
      orNull(a.replayReason), Boolean(a.replayInputs?.ghost), Boolean(a.replayInputs?.bought), typeof a.lockedPoints === 'number',
      orNull(a.subsequentTradesInSlot)])),
    plans: digest(rows(tape?.plans).map((p) => [orNull(p.key), orNull(p.at), orNull(p.symbol)])),
    symbols: digest(symbolPlan(tape || {}).map((e) => [e.symbol, e.roles.join('+')])),
  };
}

/** The parts of two fingerprints that differ, in CANDLE_INPUT_PARTS order. */
export function changedInputParts(before, now) {
  if (!isObj(before) || !isObj(now)) return [];
  return CANDLE_INPUT_PARTS.filter((k) => before[k] !== now[k]);
}
