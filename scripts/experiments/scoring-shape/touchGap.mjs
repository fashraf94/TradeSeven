#!/usr/bin/env node
// scripts/experiments/scoring-shape/touchGap.mjs
//
// STEP 2, the sampling gap (prompt §4): a battle sees a quote every 15 minutes, so daily highs and lows overstate
// touches. Estimated from the only stored intraday series on this machine: the film tape in the trader-game replay
// export (agentBattles/{id}/tape/{day}/series — 10-minute bars and the price each 15-minute check saw, atChecks).
//
// For every distinct (symbol, session) in the tape with a check near the open and one near the close:
//   1. agreement: the 10-minute bars' extremes against the EOD daily high/low on disk (same provider);
//   2. touch: from the EOD open with the one-day unit, each tier reached on the EOD high/low vs at the checks;
//   3. the close: the last check against the 16:00 close (what a bank-at-the-bell shape sees), in units and in
//      +1.0 / −1.0 verdicts.
// The tape ids are pseudonymized ordinals (battle-NNN); none is printed. Raw (unadjusted) prices throughout: the tape
// is raw, and a one-day comparison needs no adjustment.
//
// USAGE: node scripts/experiments/scoring-shape/touchGap.mjs [--tape <replay dir>] [--bars <run dir>] [--out <dir>]

import path from 'node:path';
import { readdirSync } from 'node:fs';
import { getSessionForDate } from '../../../src/utils/marketCalendar.js';
import { admitted, argOf, crossed, DEFAULT_BARS_RUN, DEFAULT_TAPE_DIR, DEFAULT_V2_DIR, loadSeries, mdTable, median, oneDayUnitAt, outDirOf,
  quantile, readJson, TIER_KEYS, TIER_LABEL, v2Universe, writeJson } from './lib.mjs';

const argv = process.argv;
const tapeDir = argOf(argv, '--tape', DEFAULT_TAPE_DIR);
const barsRun = argOf(argv, '--bars', DEFAULT_BARS_RUN);
const out = outDirOf(argv);
const { symbols } = v2Universe(argOf(argv, '--v2', DEFAULT_V2_DIR));
const OPEN_SLACK_MIN = 20;   // first check within 20 minutes of the open
const CLOSE_SLACK_MIN = 30;  // last check within 30 minutes of the close

const manifest = readJson(path.join(tapeDir, 'manifest.json'));
const series = new Map();
let raw = 0;
for (const row of manifest.battles) {
  const bundle = readJson(path.join(tapeDir, row.file));
  for (const day of bundle.tape || []) for (const s of day.series || []) {
    raw++;
    const key = `${s.symbol}|${s.etDate}`;
    const prev = series.get(key);
    // Several battles can hold the same name on the same day; keep the series with the most checks.
    if (!prev || (s.atChecks?.length || 0) > (prev.atChecks?.length || 0)) series.set(key, s);
  }
}

const seriesCache = new Map();
const barsOf = (sym) => { if (!seriesCache.has(sym)) seriesCache.set(sym, loadSeries(barsRun, sym)); return seriesCache.get(sym); };
const drop = {};
const kept = [];
for (const s of series.values()) {
  const why = (r) => { drop[r] = (drop[r] || 0) + 1; };
  if (!symbols.includes(s.symbol)) { why('not_in_v2_universe'); continue; }
  if (s.interval !== '10m' || !Array.isArray(s.bars) || !s.bars.length || !Array.isArray(s.atChecks) || s.atChecks.length < 2) { why('no_bars_or_checks'); continue; }
  const sess = getSessionForDate(s.etDate);
  if (!sess?.isTradingDay) { why('not_a_session'); continue; }
  const checks = s.atChecks.filter((c) => Number.isFinite(c.price) && c.price > 0).map((c) => ({ ms: Date.parse(c.barClosedAt || c.at), price: c.price })).sort((a, b) => a.ms - b.ms);
  if (!checks.length || checks[0].ms > sess.openMs + OPEN_SLACK_MIN * 60_000 || checks.at(-1).ms < sess.closeMs - CLOSE_SLACK_MIN * 60_000) { why('checks_do_not_span_the_session'); continue; }
  const b = barsOf(s.symbol);
  if (b.status !== 'valid') { why('no_daily_bars'); continue; }
  const i = b.rows.findIndex((r) => r.date === s.etDate);
  if (i < 15) { why('no_daily_bar_or_history'); continue; }
  const unit = admitted(oneDayUnitAt(b.rows, i));
  if (!unit) { why('unit_unavailable'); continue; }
  const eod = b.rows[i].raw;
  kept.push({ s, checks, sess, unit, eod: { open: Number(eod.open), high: Number(eod.high), low: Number(eod.low), close: Number(eod.close) } });
}

const tierCount = () => Object.fromEntries(TIER_KEYS.map((k) => [k, 0]));
const daily = tierCount(), atChecks = tierCount();
const hiGap = [], loGap = [], lastCheckMin = [], closeGapUnits = [];
let plusDisagree = 0, minusDisagree = 0, plusCloseClears = 0, minusCloseClears = 0;
for (const k of kept) {
  const F = k.eod.open;
  const barHigh = Math.max(...k.s.bars.map((x) => x.h)), barLow = Math.min(...k.s.bars.map((x) => x.l));
  hiGap.push((barHigh - k.eod.high) / k.eod.high * 100);
  loGap.push((barLow - k.eod.low) / k.eod.low * 100);
  for (const t of crossed(F, k.unit, { high: k.eod.high, low: k.eod.low, price: k.eod.close })) daily[t]++;
  const cp = k.checks.map((c) => c.price);
  const last = cp.at(-1);
  for (const t of crossed(F, k.unit, { high: Math.max(...cp), low: Math.min(...cp), price: last })) atChecks[t]++;
  lastCheckMin.push((k.sess.closeMs - k.checks.at(-1).ms) / 60_000);
  closeGapUnits.push(Math.abs(last - k.eod.close) / F * 100 / k.unit.scoringPct);
  const atClose = crossed(F, k.unit, { high: k.eod.close, low: k.eod.close, price: k.eod.close });
  const atLast = crossed(F, k.unit, { high: last, low: last, price: last });
  if (atClose.includes('bagger')) plusCloseClears++;
  if (atClose.includes('bust')) minusCloseClears++;
  if (atClose.includes('bagger') !== atLast.includes('bagger')) plusDisagree++;
  if (atClose.includes('bust') !== atLast.includes('bust')) minusDisagree++;
}

// Secondary, larger sample: every universe symbol-session whose 10-minute bars span the session, sampled at the
// bars' CLOSES (every 10 minutes — denser than the 15-minute checks, so its ratio sits ABOVE the check ratio).
const dailyB = tierCount(), atBarCloses = tierCount();
let nB = 0;
for (const s of series.values()) {
  if (!symbols.includes(s.symbol) || s.interval !== '10m' || !Array.isArray(s.bars) || !s.bars.length) continue;
  const sess = getSessionForDate(s.etDate);
  if (!sess?.isTradingDay) continue;
  const ts = s.bars.map((x) => Date.parse(x.t)).sort((a, b) => a - b);
  if (ts[0] > sess.openMs || ts.at(-1) < sess.closeMs - 10 * 60_000) continue;
  const b = barsOf(s.symbol);
  if (b.status !== 'valid') continue;
  const i = b.rows.findIndex((r) => r.date === s.etDate);
  if (i < 15) continue;
  const unit = admitted(oneDayUnitAt(b.rows, i));
  if (!unit) continue;
  const e = b.rows[i].raw;
  const F = Number(e.open);
  nB++;
  for (const t of crossed(F, unit, { high: Number(e.high), low: Number(e.low), price: Number(e.close) })) dailyB[t]++;
  const cl = s.bars.map((x) => x.c);
  for (const t of crossed(F, unit, { high: Math.max(...cl), low: Math.min(...cl), price: cl.at(-1) })) atBarCloses[t]++;
}

const n = kept.length;
const ratio = Object.fromEntries(TIER_KEYS.map((t) => [t, daily[t] ? atChecks[t] / daily[t] : null]));
const ratioB = Object.fromEntries(TIER_KEYS.map((t) => [t, dailyB[t] ? atBarCloses[t] / dailyB[t] : null]));
const result = { tapeSeries: raw, distinctSymbolSessions: series.size, kept: n, dropped: drop, symbols: new Set(kept.map((k) => k.s.symbol)).size, sessions: new Set(kept.map((k) => k.s.etDate)).size,
  agreement: { highGapPct: { median: median(hiGap), p05: quantile(hiGap, 0.05), min: Math.min(...hiGap) }, lowGapPct: { median: median(loGap), p95: quantile(loGap, 0.95), max: Math.max(...loGap) } },
  touch: { daily, atChecks, ratio }, barCloses: { symbolSessions: nB, daily: dailyB, atBarCloses, ratio: ratioB },
  close: { lastCheckMinutesBeforeClose: { median: median(lastCheckMin), max: Math.max(...lastCheckMin) }, gapUnits: { median: median(closeGapUnits), p90: quantile(closeGapUnits, 0.9) },
    plus1: { closeClears: plusCloseClears, verdictDiffers: plusDisagree }, minus1: { closeClears: minusCloseClears, verdictDiffers: minusDisagree } } };
writeJson(path.join(out, 'touch-gap.json'), result);

console.log(`# The 15-minute sampling gap (film tape)\n`);
console.log(`${raw} tape series → ${series.size} distinct symbol-sessions → ${n} kept (${result.symbols} symbols, ${result.sessions} sessions). Dropped: ${JSON.stringify(drop)}.`);
console.log(`10-minute bars vs EOD: highs median ${result.agreement.highGapPct.median.toFixed(4)}% (5th pct ${result.agreement.highGapPct.p05.toFixed(4)}%); lows median ${result.agreement.lowGapPct.median.toFixed(4)}% (95th pct ${result.agreement.lowGapPct.p95.toFixed(4)}%).\n`);
console.log(mdTable(['Tier', 'Touched on EOD high/low', 'Touched at a 15-min check', 'Check / daily'],
  TIER_KEYS.map((t) => [TIER_LABEL[t], String(daily[t]), String(atChecks[t]), ratio[t] == null ? '—' : ratio[t].toFixed(2)])));
console.log(`\nSecondary sample (${nB} symbol-sessions, sampled at 10-minute bar closes — denser than the checks):\n`);
console.log(mdTable(['Tier', 'Touched on EOD high/low', 'Touched at a 10-min close', 'Close / daily'],
  TIER_KEYS.map((t) => [TIER_LABEL[t], String(dailyB[t]), String(atBarCloses[t]), ratioB[t] == null ? '—' : ratioB[t].toFixed(2)])));
console.log(`\nLast check: median ${result.close.lastCheckMinutesBeforeClose.median.toFixed(0)} min before the close (max ${result.close.lastCheckMinutesBeforeClose.max.toFixed(0)}). |last check − close|: median ${result.close.gapUnits.median.toFixed(3)} units, 90th pct ${result.close.gapUnits.p90.toFixed(3)}.`);
console.log(`+1.0 cleared at the close: ${plusCloseClears}; the last check's verdict differs on ${plusDisagree}. −1.0: ${minusCloseClears}; differs on ${minusDisagree}.`);
