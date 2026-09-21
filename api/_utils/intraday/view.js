// api/_utils/intraday/view.js
//
// Intraday Data — Build 1, contract §8.2 (the view schema and the definitions
// document), §9.1 (shadow lines, stored never sent) and the receipt-only
// replay. PURE, no Date.now().
//
//   intradayViews/{evalId} = {
//     evalId, battleId, sweepId, generation, calcVersion, policyVersion, evaluatedAt,
//     presetId, presetBand,          // from battle.strategyPreset → agentPresetConfig dead band
//     providedToDecision: false,     // build 1 constant
//     symbols: { [sym]: { observationId, strikeKey, source, availableAt, collectionStalled,
//                         price: {…}, indicators: { vwap: {…, verdict}, … } } },
//     shadowLines: string[],
//     snapshotSweepAt, missingSymbols
//   }
//
// Definitions that do not vary live in intradayDefinitions/v{calcVersion},
// immutable; `venue: 'vendor_unconfirmed'` until §15.

import { evaluateIntraday, CONSUMERS } from './eligibility.js';
import { CALC_VERSION, POLICY_VERSION, COLLECTION_STALL_MS, CLOSING_ROW_POLICY } from '../intradayConfig.js';
import { renderIntradayDiagnosticLines, INTRADAY_DIAGNOSTIC_HEADER } from '../../../src/data/intradayDiagnosticCopy.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const DEF = (name, params, timeframe, units, session, adjust) => ({ name, params, timeframe, units, session, adjust, venue: 'vendor_unconfirmed' });

/** §8.2 — the immutable definitions document for calcVersion 1. */
export const INTRADAY_DEFINITIONS_V1 = Object.freeze({
  calcVersion: CALC_VERSION,
  policyVersion: POLICY_VERSION,
  indicators: {
    vwap: DEF('Session VWAP estimate (sampled)', { method: 'sampled_estimate', firstSample: 'HLC3×volume', later: 'price×Δvolume' }, 'session', 'price', 'regular', 'none'),
    sessionHL: DEF('Session high / low / open (vendor aggregate)', {}, 'session', 'price', 'regular', 'none'),
    volume: DEF('Session cumulative volume (vendor aggregate)', {}, 'session', 'shares', 'regular', 'none'),
    volumePace: DEF('Linear volume pace vs average volume', { method: 'linear_pace', minElapsedMin: 5 }, 'session', 'ratio', 'regular', 'none'),
    sma20_5m: DEF('SMA(20) of completed 5-minute bucket closes', { period: 20 }, '5m', 'price', 'regular', 'none'),
    macd5m: DEF('MACD(12,26,9) of completed 5-minute bucket closes', { fast: 12, slow: 26, signal: 9, seed: 'sma', signalSeed: 'valid-macd-subsequence' }, '5m', 'price', 'regular', 'none'),
    rsi5m: DEF('Wilder RSI(14) of completed 5-minute bucket closes', { period: 14, seed: 'sma' }, '5m', 'index', 'regular', 'none'),
  },
  buckets: { widthMs: 300_000, keyRule: 'floor(priceAsOf / 300000); exact close → last regular bucket', deadline: 'close + 30 min' },
  // Derived from the constant, never a parallel sentence that can drift from
  // it (BUILD_RULES §9): this line is what a receipt-only replay reads to
  // learn which session the buckets describe.
  closingRow: CLOSING_ROW_POLICY === null
    ? 'unresolved (CLOSING_ROW_POLICY null) — last bucket closeQualified: false'
    : `${CLOSING_ROW_POLICY} — the session ends at the last millisecond before the calendar close; the closing auction is excluded and the last bucket is closeQualified`,
});

/** The evaluation-entry pointer fields (§8.1) — the ONLY intraday keys on an entry. */
export const INTRADAY_ENTRY_FIELDS = Object.freeze([
  'intradaySnapshotId', 'intradayGeneration', 'intradayViewRef', 'intradayViewStatus',
  'intradayEvaluatedAt', 'intradayPolicyVersion', 'decisionStartedAt', 'decisionCompletedAt',
]);

export const VIEW_STATUS = Object.freeze({
  WRITTEN: 'written', NO_SNAPSHOT: 'no_snapshot', SNAPSHOT_INVALID: 'snapshot_invalid', WRITE_FAILED: 'write_failed', READ_FAILED: 'read_failed',
});

/** A snapshot document is usable when it carries a sweepId, a generation and a symbols map. */
export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'no_snapshot' };
  if (typeof snapshot.sweepId !== 'string' || !isNum(snapshot.generation) || !snapshot.symbols || typeof snapshot.symbols !== 'object') {
    return { ok: false, reason: 'snapshot_invalid' };
  }
  return { ok: true };
}

function emptySymbolRecord(sym, consumer) {
  const verdict = { state: 'ineligible', reason: 'not_in_snapshot', consumer };
  const ind = {};
  for (const k of ['vwap', 'sessionHL', 'volume', 'volumePace', 'sma20_5m', 'macd5m', 'rsi5m']) {
    ind[k] = { status: 'absent', value: null, reason: 'not_in_snapshot', verdict };
  }
  return { sym, observationId: null, strikeKey: null, source: null, availableAt: null, collectionStalled: false, missing: true, price: null, indicators: ind };
}

/**
 * Build the view for one evaluation.
 * @param {object} p
 * @param {object} p.snapshot   intradaySnapshots/latest (validated by the caller)
 * @param {string[]} p.symbols  held ∪ bench
 * @param {string} p.evalId
 * @param {string} p.battleId
 * @param {string} p.presetId
 * @param {number} p.presetBand
 * @param {number} p.evaluatedAt  epoch ms (the check's instant)
 * @param {(ms:number)=>string|null} [p.timeText] instant formatter for the shadow lines
 */
export function buildIntradayView({ snapshot, symbols, evalId, battleId, presetId, presetBand, evaluatedAt, policyVersion = POLICY_VERSION, timeText = null }) {
  const consumer = CONSUMERS.DISPLAY;
  const stalled = !isNum(snapshot.lastSuccessfulSweepAt) || (evaluatedAt - snapshot.lastSuccessfulSweepAt) > COLLECTION_STALL_MS;
  const out = {};
  const missing = [];
  for (const sym of symbols) {
    const facts = snapshot.symbols?.[sym];
    if (!facts) { out[sym] = emptySymbolRecord(sym, consumer); missing.push(sym); continue; }
    const record = { ...facts, sym, collectionStalled: stalled, indicators: {} };
    const { verdicts } = evaluateIntraday({ ...facts, collectionStalled: stalled }, { nowMs: evaluatedAt, policyVersion, consumer });
    for (const [k, ind] of Object.entries(facts.indicators || {})) record.indicators[k] = { ...ind, verdict: verdicts[k] };
    out[sym] = record;
  }
  const view = {
    evalId, battleId,
    sweepId: snapshot.sweepId, generation: snapshot.generation, calcVersion: snapshot.calcVersion ?? CALC_VERSION, policyVersion,
    evaluatedAt, presetId, presetBand,
    providedToDecision: false,
    symbols: out,
    snapshotSweepAt: snapshot.sweepAt ?? null,
    missingSymbols: missing,
    shadowLines: [],
  };
  view.shadowLines = renderShadowLines(view, { timeText });
  return view;
}

/**
 * §9.1 — the stage-2 prompt lines, rendered by this non-fenced renderer and
 * STORED on the view as `shadowLines`, never sent. Stage 2 registers this
 * module in PROMPT_CONTRIBUTING_MODULES with its fenced splice; build 1 has
 * no splice and no consumer.
 */
export function renderShadowLines(view, { timeText = null } = {}) {
  const lines = [];
  for (const [sym, rec] of Object.entries(view.symbols || {})) {
    const l = renderIntradayDiagnosticLines(rec, { timeText: timeText || (() => null) });
    for (const line of l) lines.push(`${sym}: ${line}`);
  }
  return lines;
}

/** `estDev` and the strike flag from a stored price and estimate — the stage-4 replay primitive. */
export function strikeFromView(record, presetBand) {
  const price = record?.price?.value;
  const est = record?.indicators?.vwap?.value;
  if (!isNum(price) || !isNum(est) || est <= 0) return { estDev: null, isVwapStrike: false, strikeKey: record?.strikeKey ?? null };
  const estDev = ((price - est) / est) * 100;
  return { estDev, isVwapStrike: isNum(presetBand) && estDev < -presetBand, strikeKey: record.strikeKey ?? null };
}

/**
 * Receipt-only replay (§8.2, V1.1): with intradaySnapshots/latest deleted,
 * every strike computation and every displayed line is reconstructed from a
 * stored view plus its definitions document alone. Takes EXACTLY those two.
 */
export function replayFromView(view, definitions, { nowMs, consumer = CONSUMERS.DISPLAY, timeText = null } = {}) {
  if (!view || typeof view !== 'object') throw new Error('replayFromView: view required');
  if (!definitions || definitions.calcVersion !== view.calcVersion) throw new Error('replayFromView: definitions do not match the view calcVersion');
  const at = isNum(nowMs) ? nowMs : view.evaluatedAt;
  const symbols = {};
  for (const [sym, rec] of Object.entries(view.symbols || {})) {
    const { verdicts } = evaluateIntraday(rec, { nowMs: at, policyVersion: view.policyVersion, consumer });
    symbols[sym] = {
      verdicts,
      strike: { ...strikeFromView(rec, view.presetBand), eligible: verdicts.vwap?.state === 'eligible' },
      lines: renderIntradayDiagnosticLines(rec, { timeText: timeText || (() => null), verdicts }),
      header: INTRADAY_DIAGNOSTIC_HEADER,
      definition: definitions.indicators,
    };
  }
  return { evalId: view.evalId, evaluatedAt: view.evaluatedAt, replayedAt: at, consumer, symbols };
}
