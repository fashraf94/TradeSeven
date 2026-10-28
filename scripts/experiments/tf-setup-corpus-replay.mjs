#!/usr/bin/env node
// scripts/experiments/tf-setup-corpus-replay.mjs
//
// Measured Trend Evidence, slice 1 (P3) — the historical replay of the
// Trend Follower evaluator over the SAVED 13 Oct 2026 tick capture
// (V3 build prompt §10, resolution point 5). NO MODEL CALLS. NO FIRESTORE.
//
// READ-ONLY BY CONSTRUCTION, in the shape of
// scripts/experiments/growth-replay/changedMomentsScore.js:
//   - Population: the locally saved capture only —
//     %USERPROFILE%/ft-experiment-exhibits/archetype-ablation-run/records.json
//     (2,823 permanent records, 22 Sep–13 Oct 2026). No production store is
//     read in this run; production capture expansion is a later run with its
//     own scope statement. The `owner` field is never read into any output.
//   - Product code is IMPORTED, never copied: the evaluator and the adapter
//     (api/_utils/setupEvaluator/*), mapDailyRows and the symbol helpers
//     (api/_utils/marketDataCache.js), the calendar (api/_utils/marketSchedule.js).
//     Fenced functions CALLED: none. EDITED: none.
//   - EODHD: plain fetch to /eod/, ONE request per distinct equity symbol, at
//     most CALL_CAP = 60 over the whole run, counted and written to the
//     manifest BEFORE each request. The key is read by name from the
//     environment / .env.local and never printed. Crypto names are not fetched.
//   - Everything it writes lands in %USERPROFILE%/tf-setup-replay-runs/<runId>/,
//     outside the repo. Files named *.local.* carry battle and tick ids and are
//     never committed; summary.json and report.md carry neither owner nor raw
//     battle ids (battle ids appear only as a 12-hex sha256 prefix).
//
// THE INFORMATION CUTOFF WITH DATE-ONLY EVIDENCE. The capture's only time
// field is `etDate` (verified on 28 Oct and re-verified here before the path
// is defined). asOf = the last trading session STRICTLY BEFORE the check's ET
// date, never the check's own session. `now` = the run instant, so every
// asOf is in the past and the adapter's expected session equals asOf. Each
// row carries decisionInstant { etDate, precision: 'date' } — no instant is
// invented — and evidenceClass { decision: 'contemporaneous', bars:
// 'later_reconstruction', verdict: 'derived' }. Verdicts are what the rule
// says on the series as served at fetchedAt, dated to the prior session,
// never what the agent could have known.
//
// USAGE (repo root), in order:
//   node scripts/experiments/tf-setup-corpus-replay.mjs selftest
//   node scripts/experiments/tf-setup-corpus-replay.mjs plan        # reads the saved file; counts, pairs, call count; no fetch
//   node scripts/experiments/tf-setup-corpus-replay.mjs bars        # one counted /eod/ request per symbol [--symbol X --asOf D --fixture]
//   node scripts/experiments/tf-setup-corpus-replay.mjs evaluate    # refuses without `plan` on the same run
//   node scripts/experiments/tf-setup-corpus-replay.mjs report
// Every command but `selftest` and `plan` acts on the newest run; --run <runId> picks another.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateTfEntry, evaluateTfHolding } from '../../api/_utils/setupEvaluator/tfSetupV1.js';
import { buildDailyEvidence, attachAdjustedClose } from '../../api/_utils/setupEvaluator/dailyBarsAdapter.js';
import { describeRuleSet, MIN_COMPLETED_BARS } from '../../api/_utils/setupEvaluator/thresholds.js';
import { mapDailyRows, isCryptoSymbol, getCleanSymbol, formatEODHDSymbol } from '../../api/_utils/marketDataCache.js';
import { getPreviousSessionDate } from '../../api/_utils/marketSchedule.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------- frozen constants

export const CALL_CAP = 60;
export const FROM_PAD_DAYS = 130;
export const TARGET_ARCHETYPE = 'momentum_chaser';
export const SOURCE = 'eodhd_eod';
export const RECEIPT_COUNT = 10;
export const MIN_JOINED_ROWS = 20;
export const UNKNOWN_SHARE_LIMIT = 0.25;
/** The permanent record's keys the first run reads; anything else is never read into an output. */
export const CAPTURE_FIELDS = Object.freeze(['archetype', 'battleId', 'tickId', 'etDate', 'woken', 'ownerClass', 'decision']);
export const DECISION_FIELDS = Object.freeze(['original', 'final', 'originalSymbolIn', 'finalSymbolIn', 'originalSymbolOut', 'finalSymbolOut']);
const RUNS_ROOT = path.join(os.homedir(), 'tf-setup-replay-runs');
const RUN_PREFIX = 'tfs-';
const CAPTURE_PATH = path.join(os.homedir(), 'ft-experiment-exhibits', 'archetype-ablation-run', 'records.json');
const SCORER_ROOT = path.join(os.homedir(), 'growth-replay-runs');
const EODHD = 'https://eodhd.com/api';
const MODULES = Object.freeze({
  thresholds: 'api/_utils/setupEvaluator/thresholds.js',
  volumePolicy: 'api/_utils/setupEvaluator/volumePolicy.js',
  tfSetupV1: 'api/_utils/setupEvaluator/tfSetupV1.js',
  dailyBarsAdapter: 'api/_utils/setupEvaluator/dailyBarsAdapter.js',
});

// ---------------------------------------------------------------- small helpers
//
// parseEnvText, primaryCheckoutRoot and redactSecrets are the growth replay's
// (scripts/experiments/growth-replay/growthReplay.js), restated here because
// that script cannot be imported under vitest (its hermetic test imports this
// file). Same behaviour, no product dependency.

/** KEY=value lines; quotes stripped; comments and blanks skipped. */
export function parseEnvText(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

/** An app worktree (<root>/.claude/worktrees/<name>) resolves to <root>; anything else to null. */
export function primaryCheckoutRoot(projectRoot) {
  const parts = path.resolve(projectRoot).split(path.sep);
  const i = parts.lastIndexOf('worktrees');
  if (i >= 1 && parts[i - 1] === '.claude') return parts.slice(0, i - 1).join(path.sep) || path.sep;
  return null;
}

export function redactSecrets(text) {
  return String(text)
    .replace(/sk-ant-[^\s"'`]*/g, 'sk-ant-[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/"private_key"\s*:\s*"[^"]*"?/g, '"private_key":"[REDACTED]"');
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 1)}\n`);
  renameSync(tmp, p);
}
/** An EODHD URL carries the key as a query parameter: never let one reach a log. */
export function redactEodhd(text) {
  return String(text).replace(/api_token=[^&\s"']*/g, 'api_token=[REDACTED]');
}
function stop(message, code = 2) {
  console.error(`\nSTOP: ${redactEodhd(redactSecrets(message))}`);
  process.exit(code);
}
export const hashBattleId = (id) => sha256(String(id)).slice(0, 12);
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const sortedCounts = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

// ---------------------------------------------------------------- the capture's fields (re-verified before the path is defined)

/**
 * The capture's top-level keys and time fields. The replay defines its cutoff
 * only after this says that `etDate` is the ONLY time-shaped field and that
 * `tickId` is `<battleId>:<seq>`.
 */
export function verifyCaptureFields(records) {
  const problems = [];
  if (!Array.isArray(records) || records.length === 0) return { ok: false, problems: ['records.json is not a non-empty array'], keys: [], timeFields: [] };
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r)) keys.add(k);
  const keyList = [...keys].sort();
  const timeFields = keyList.filter((k) => /date|time|instant|capturedAt|At$|Ms$/i.test(k));
  if (timeFields.length !== 1 || timeFields[0] !== 'etDate') problems.push(`time-shaped fields are ${JSON.stringify(timeFields)}; the cutoff rule assumes etDate alone`);
  for (const f of CAPTURE_FIELDS) if (!keys.has(f)) problems.push(`field ${f} is absent from every record`);
  let badDate = 0; let badTick = 0; let badDecision = 0;
  for (const r of records) {
    if (typeof r.etDate !== 'string' || !DATE_RE.test(r.etDate)) badDate += 1;
    if (typeof r.tickId !== 'string' || typeof r.battleId !== 'string' || !r.tickId.startsWith(`${r.battleId}:`)) badTick += 1;
    if (r.decision && typeof r.decision === 'object') { for (const f of DECISION_FIELDS) if (!(f in r.decision)) { badDecision += 1; break; } }
  }
  if (badDate) problems.push(`${badDate} records have a non-date etDate`);
  if (badTick) problems.push(`${badTick} records have a tickId that is not <battleId>:<seq>`);
  if (badDecision) problems.push(`${badDecision} records lack a decision field the filter reads`);
  return { ok: problems.length === 0, problems, keys: keyList, timeFields, records: records.length };
}

// ---------------------------------------------------------------- population

/**
 * The Trend Follower's woken checks with a SWAP: proposed (decision.original
 * with originalSymbolIn) and executed (decision.final with finalSymbolIn),
 * both evaluated when they differ, labelled. Reads `owner` never.
 */
export function selectPopulation(records) {
  const rows = [];
  const counts = { tfRecords: 0, woken: 0, proposed: 0, executed: 0, coincide: 0, battles: 0 };
  const battles = new Set();
  const distinctIn = new Set();
  const distinctOut = new Set();
  const perMonth = {};
  for (const r of records) {
    if (r?.archetype !== TARGET_ARCHETYPE || r?.ownerClass === 'cpu') continue;
    counts.tfRecords += 1;
    if (r.woken !== true) continue;
    counts.woken += 1;
    battles.add(r.battleId);
    inc(perMonth, String(r.etDate).slice(0, 7));
    const d = r.decision || {};
    const proposed = d.original === 'SWAP' && typeof d.originalSymbolIn === 'string' && d.originalSymbolIn
      ? { kind: 'proposed', symbolIn: d.originalSymbolIn.toUpperCase(), symbolOut: typeof d.originalSymbolOut === 'string' && d.originalSymbolOut ? d.originalSymbolOut.toUpperCase() : null }
      : null;
    const executed = d.final === 'SWAP' && typeof d.finalSymbolIn === 'string' && d.finalSymbolIn
      ? { kind: 'executed', symbolIn: d.finalSymbolIn.toUpperCase(), symbolOut: typeof d.finalSymbolOut === 'string' && d.finalSymbolOut ? d.finalSymbolOut.toUpperCase() : null }
      : null;
    if (proposed && executed && proposed.symbolIn === executed.symbolIn && proposed.symbolOut === executed.symbolOut) counts.coincide += 1;
    for (const swap of [proposed, executed]) {
      if (!swap) continue;
      counts[swap.kind] += 1;
      distinctIn.add(swap.symbolIn);
      if (swap.symbolOut) distinctOut.add(swap.symbolOut);
      rows.push({
        battleId: r.battleId,
        tickId: r.tickId,
        tickSeq: String(r.tickId).slice(String(r.battleId).length + 1),
        etDate: r.etDate,
        kind: swap.kind,
        symbolIn: swap.symbolIn,
        symbolOut: swap.symbolOut,
        asOf: asOfFor(r.etDate),
        decisionInstant: { etDate: r.etDate, precision: 'date' },
        evidenceClass: { decision: 'contemporaneous', bars: 'later_reconstruction', verdict: 'derived' },
      });
    }
  }
  counts.battles = battles.size;
  counts.distinctIn = distinctIn.size;
  counts.distinctOut = distinctOut.size;
  counts.perMonth = sortedCounts(perMonth);
  return { rows, counts, symbolsIn: [...distinctIn].sort(), symbolsOut: [...distinctOut].sort() };
}

/** The last trading session strictly before the check's ET date; null when the calendar cannot say. */
export function asOfFor(etDate) {
  return getPreviousSessionDate(etDate);
}

/** A row with no owner and no raw battle id: what summary.json and report.md may carry. */
export function redactRow(row) {
  const { battleId, tickId, ...rest } = row;
  void tickId;
  return { ...rest, battleHash: hashBattleId(battleId) };
}

const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The symbol × asOf pairs to evaluate, the symbols to fetch, and the planned call count. */
export function planFor(rows) {
  const pairs = new Map();
  const crypto = new Set();
  const calendarMissing = [];
  for (const row of rows) {
    if (!row.asOf) { calendarMissing.push({ etDate: row.etDate, kind: row.kind, symbolIn: row.symbolIn }); continue; }
    for (const [symbol, role] of [[row.symbolIn, 'entry'], [row.symbolOut, 'holding']]) {
      if (!symbol) continue;
      if (isCryptoSymbol(symbol)) { crypto.add(symbol); continue; }
      const key = `${symbol}|${row.asOf}|${role}`;
      if (!pairs.has(key)) pairs.set(key, { symbol, asOf: row.asOf, role, rows: 0 });
      pairs.get(key).rows += 1;
    }
  }
  const list = [...pairs.values()].sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : a.role < b.role ? -1 : 1));
  const symbols = [...new Set(list.map((p) => p.symbol))].sort();
  const asOfs = list.map((p) => p.asOf).sort();
  const from = asOfs.length ? addDays(asOfs[0], -FROM_PAD_DAYS) : null;
  const to = asOfs.length ? asOfs[asOfs.length - 1] : null;
  return { pairs: list, symbols, calls: symbols.length, from, to, cryptoSkipped: [...crypto].sort(), calendarMissing };
}

// ---------------------------------------------------------------- the call counter and the fetch

/** Refuses a request past the cap BEFORE it is made; records every request it lets through. */
export function makeCounter(state, cap = CALL_CAP, persist = () => {}) {
  return {
    get used() { return state.calls; },
    take(symbol) {
      if (state.calls >= cap) return false;
      state.calls += 1;
      state.log.push({ symbol, at: new Date().toISOString() });
      persist();
      return true;
    },
  };
}

export function eodUrl(symbol, key, from, to) {
  const eod = formatEODHDSymbol(getCleanSymbol(symbol), false);
  return { eod, url: `${EODHD}/eod/${eod}?api_token=${key}&fmt=json&period=d&order=d&from=${from}&to=${to}` };
}

async function fetchEod(symbol, key, from, to) {
  const { eod, url } = eodUrl(symbol, key, from, to);
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, eod, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data)) return { ok: false, eod, error: 'not an array' };
    return { ok: true, eod, payload: data };
  } catch (err) {
    return { ok: false, eod, error: redactEodhd(String(err?.message || err)).slice(0, 160) };
  }
}

// ---------------------------------------------------------------- receipts, summary, report

export const verdictClass = (rec) => (rec.verdict === 'valid' ? `valid/${rec.pattern}` : `${rec.verdict}/${rec.reason}`);

/**
 * Ten receipts: the earliest check (by asOf, then symbol) per verdict class,
 * classes in sorted order, round-robin until `n`.
 */
export function pickReceipts(evaluatedRows, n = RECEIPT_COUNT) {
  const byClass = {};
  for (const row of evaluatedRows) {
    if (!row.entry) continue;
    (byClass[verdictClass(row.entry)] ||= []).push(row);
  }
  const classes = Object.keys(byClass).sort();
  for (const c of classes) byClass[c].sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  const out = [];
  const seen = new Set();
  for (let round = 0; out.length < n; round++) {
    let any = false;
    for (const c of classes) {
      const row = byClass[c][round];
      if (!row) continue;
      any = true;
      const key = `${row.symbol}|${row.asOf}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= n) break;
    }
    if (!any) break;
  }
  return out;
}

function receiptOf(row) {
  const e = row.entry;
  return {
    symbol: row.symbol,
    asOf: row.asOf,
    verdict: e.verdict,
    reason: e.reason,
    pattern: e.pattern,
    regime: e.regime,
    facts: Object.fromEntries(Object.entries(e.factsUsed).map(([k, v]) => [k, v.value])),
    checks: e.checks.map((c) => ({ id: c.id, lhs: c.lhs, op: c.op, rhs: c.rhs, result: c.result })),
    volume: e.evidence.volume,
    adjustment: e.evidence.adjustment,
    splitCheck: row.checks?.splitCheck ?? null,
    missing: e.missing,
    patterns: e.patterns,
  };
}

/** The join to the Oct 14 scorer's control rows (swap vs holding), by battleId + tickId + the swap's call. */
export function joinScorer(rows, scorer) {
  if (!scorer) return { available: false, joined: 0, byClass: {} };
  const index = new Map();
  const add = (k, call, points) => { if (k && call) index.set(`${k}|${call}`, points); };
  for (const r of scorer.controlRows || []) add(r.k, r.call, r.primary?.points);
  for (const r of scorer.controlMainRows || []) add(r.k, r.call, r.primary?.points);
  const byClass = {};
  let joined = 0;
  for (const row of rows) {
    if (!row.entry || !row.symbolOut) continue;
    const key = `${row.battleId}__${row.tickId}|SWAP:${row.symbolOut}>${row.symbolIn}`;
    const points = index.get(key);
    if (!points || points.status !== 'scored' || typeof points.delta !== 'number') continue;
    joined += 1;
    const cls = verdictClass(row.entry);
    const b = (byClass[cls] ||= { beat: 0, lost: 0, tied: 0 });
    if (points.delta > 1) b.beat += 1; else if (points.delta < -1) b.lost += 1; else b.tied += 1;
  }
  return { available: true, joined, byClass: sortedCounts(byClass), sufficient: joined >= MIN_JOINED_ROWS };
}

export function summarize({ rows, pairs, counts, plan, join, manifest }) {
  const entryRows = rows.filter((r) => r.entry);
  const verdicts = {}; const regimes = {}; const patterns = {}; const unknownReasons = {}; const invalidReasons = {}; const validPatterns = {}; const missingFacts = {};
  for (const r of entryRows) {
    inc(verdicts, verdictClass(r.entry));
    inc(regimes, r.entry.regime);
    inc(patterns, `breakout ${r.entry.patterns.breakout} / pullback_resume ${r.entry.patterns.pullback_resume}`);
    if (r.entry.verdict === 'unknown') inc(unknownReasons, r.entry.reason);
    if (r.entry.verdict === 'invalid') inc(invalidReasons, r.entry.reason);
    if (r.entry.verdict === 'valid') inc(validPatterns, r.entry.pattern);
    for (const m of r.entry.missing) inc(missingFacts, m);
  }
  const holdingRows = rows.filter((r) => r.holding);
  const chartLeg = {}; const holdingReasons = {};
  for (const r of holdingRows) { inc(chartLeg, r.holding.chartLeg); for (const reason of r.holding.reasons) inc(holdingReasons, reason); }
  const entryPairs = pairs.filter((p) => p.role === 'entry');
  const attempted = entryPairs.filter((p) => p.result).length;
  const unknownPairs = entryPairs.filter((p) => p.result && p.result.verdict === 'unknown').length;
  const share = attempted > 0 ? unknownPairs / attempted : null;
  return {
    runId: manifest.runId,
    at: new Date().toISOString(),
    provenance: { head: manifest.head, dirty: manifest.dirty, scriptSha256: manifest.scriptSha256, moduleSha256: manifest.moduleSha256, ruleSet: manifest.ruleSet, capture: manifest.capture, runInstant: manifest.runInstant },
    coverage: { ...counts, rows: rows.length, entryEvaluations: entryRows.length, holdingEvaluations: holdingRows.length, pairs: pairs.length, symbols: plan.symbols.length },
    eodhd: { cap: manifest.eodhd.cap, calls: manifest.eodhd.calls, failures: manifest.eodhd.failures, cryptoSkipped: plan.cryptoSkipped, calendarMissing: plan.calendarMissing.length },
    verdicts: sortedCounts(verdicts),
    validByPattern: sortedCounts(validPatterns),
    invalidByReason: sortedCounts(invalidReasons),
    unknownByReason: sortedCounts(unknownReasons),
    regimes: sortedCounts(regimes),
    patterns: sortedCounts(patterns),
    missingFacts: sortedCounts(missingFacts),
    holding: { chartLeg: sortedCounts(chartLeg), reasons: sortedCounts(holdingReasons), anchor: 'absent throughout (structure_break unknown on every row)' },
    dataUnknown: { unknown: unknownPairs, attempted, share, limit: UNKNOWN_SHARE_LIMIT, aboveLimit: share !== null && share > UNKNOWN_SHARE_LIMIT, note: 'denominator = equity (symbol, asOf) entry evaluations attempted; crypto and calendar_missing reported separately' },
    receipts: pickReceipts(rows).map(receiptOf),
    join,
  };
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const table = (title, obj, head = ['Key', 'Count']) => {
  const lines = [`| ${head[0]} | ${head[1]} |`, '|---|---|'];
  const entries = Object.entries(obj);
  if (!entries.length) lines.push('| (none) | 0 |');
  for (const [k, v] of entries) lines.push(`| \`${k}\` | ${v} |`);
  return [`**${title}**`, '', ...lines, ''].join('\n');
};

export function renderReport(s) {
  const out = [];
  out.push(`# tf-setup-v1 corpus replay — run ${s.runId}`, '');
  out.push(`Generated ${s.at}. Counts only; no owner, no raw battle id. Verdicts are what the rule says on the EOD series as served at fetch time, dated to the session before each check, never what the agent could have known.`, '');
  out.push('## Provenance', '', `- HEAD \`${s.provenance.head}\`${s.provenance.dirty ? ' (working tree DIRTY)' : ' (clean)'}; run instant ${s.provenance.runInstant}`);
  out.push(`- rule set: \`${s.provenance.ruleSet.setupVersion}\` / \`${s.provenance.ruleSet.thresholdsHash}\` / \`${s.provenance.ruleSet.semanticsId}\``);
  out.push(`- script sha256 \`${s.provenance.scriptSha256.slice(0, 12)}\`; modules: ${Object.entries(s.provenance.moduleSha256).map(([k, v]) => `${k} \`${v.slice(0, 12)}\``).join(', ')}`);
  out.push(`- capture: \`${s.provenance.capture.file}\`, ${s.provenance.capture.records} records, sha256 \`${s.provenance.capture.sha256.slice(0, 12)}\`, time fields ${JSON.stringify(s.provenance.capture.timeFields)}`, '');
  out.push('## Coverage', '');
  out.push(`| Measure | Count |`, `|---|---|`, `| Trend Follower records (non-CPU) | ${s.coverage.tfRecords} |`, `| Woken checks | ${s.coverage.woken} |`, `| Battles | ${s.coverage.battles} |`, `| Proposed swap-ins | ${s.coverage.proposed} |`, `| Executed swap-ins | ${s.coverage.executed} |`, `| Proposed and executed coincide | ${s.coverage.coincide} |`, `| Distinct incoming names | ${s.coverage.distinctIn} |`, `| Distinct outgoing names | ${s.coverage.distinctOut} |`, `| Rows (proposed + executed) | ${s.coverage.rows} |`, `| Entry evaluations (rows with a result) | ${s.coverage.entryEvaluations} |`, `| Holding evaluations | ${s.coverage.holdingEvaluations} |`, `| Distinct (symbol, asOf, role) pairs | ${s.coverage.pairs} |`, `| Distinct symbols fetched | ${s.coverage.symbols} |`, '');
  out.push(table('Woken checks per month', s.coverage.perMonth, ['Month', 'Checks']));
  out.push('## EODHD', '', `- calls made ${s.eodhd.calls} of cap ${s.eodhd.cap}; failures ${JSON.stringify(s.eodhd.failures)}; crypto skipped ${JSON.stringify(s.eodhd.cryptoSkipped)}; calendar_missing rows ${s.eodhd.calendarMissing}`, '');
  out.push('## Entry verdicts', '');
  out.push(table('Verdict classes', s.verdicts, ['Class', 'Rows']));
  out.push(table('valid by pattern', s.validByPattern, ['Pattern', 'Rows']));
  out.push(table('invalid by reason', s.invalidByReason, ['Reason', 'Rows']));
  out.push(table('unknown by reason', s.unknownByReason, ['Reason', 'Rows']));
  out.push(table('Regime', s.regimes, ['Regime', 'Rows']));
  out.push(table('Pattern assessments', s.patterns, ['breakout / pullback_resume', 'Rows']));
  out.push(table('Missing facts (rows naming each)', s.missingFacts, ['Fact', 'Rows']));
  out.push('## Holding (outgoing name, anchor absent)', '');
  out.push(table('chartLeg', s.holding.chartLeg, ['chartLeg', 'Rows']));
  out.push(table('Reasons', s.holding.reasons, ['Reason', 'Rows']));
  out.push(`- ${s.holding.anchor}`, '');
  out.push('## Data-unknown share', '', `- unknown verdicts ${s.dataUnknown.unknown} ÷ equity (symbol, asOf) entry evaluations attempted ${s.dataUnknown.attempted} = **${pct(s.dataUnknown.share)}** (limit one quarter: ${s.dataUnknown.aboveLimit ? '**ABOVE — reject the adapter or the input path, fix, never the definition**' : 'within'}). ${s.dataUnknown.note}.`, '');
  out.push('## Receipts (the earliest check per verdict class, up to ten)', '');
  s.receipts.forEach((r, i) => {
    out.push(`### Receipt ${i + 1}: ${r.symbol} as of ${r.asOf} — ${r.verdict}${r.reason ? `(${r.reason})` : ''}${r.pattern ? ` / ${r.pattern}` : ''}, regime ${r.regime}`, '');
    out.push(`- facts: ${Object.entries(r.facts).map(([k, v]) => `${k}=${v === null ? 'null' : v}`).join(', ')}`);
    out.push(`- missing: ${JSON.stringify(r.missing)}; patterns: ${JSON.stringify(r.patterns)}`);
    out.push(`- checks: ${r.checks.map((c) => `${c.id} ${JSON.stringify(c.lhs)} ${c.op} ${JSON.stringify(c.rhs)} → ${c.result}`).join('; ')}`);
    out.push(`- volume: bar0 ${JSON.stringify(r.volume.bar0)}; avg ${JSON.stringify({ value: r.volume.avg.value, barsUsable: r.volume.avg.barsUsable, unusable: r.volume.avg.unusable })}`);
    out.push(`- adjustment: ${JSON.stringify(r.adjustment)}; splitCheck ${r.splitCheck}`, '');
  });
  out.push('## Join to the Oct 14 scorer', '');
  if (!s.join.available) out.push('- join unavailable (no `growth-replay-runs/cms-*/results.local.json` found); nothing reinterpreted.', '');
  else {
    out.push(`- joined rows: ${s.join.joined} (battleId + tickId + the swap's call, scored swaps only)`);
    if (!s.join.sufficient) out.push(`- **coverage insufficient for any behavioral statement** (fewer than ${MIN_JOINED_ROWS} joined rows); no statement is made.`, '');
    else out.push(table('Swap vs holding by verdict class (points, tie = within 1)', Object.fromEntries(Object.entries(s.join.byClass).map(([k, v]) => [k, `beat ${v.beat} / lost ${v.lost} / tied ${v.tied}`])), ['Class', 'beat / lost / tied']));
  }
  out.push('## Reconstruction limits', '');
  out.push('- Bars are a later reconstruction: the EOD series as EODHD served it at fetch time; a restated series is invisible; the split heuristic needs the vendor adjustment already applied, trips on a special dividend above 10%, and is not proof of split-free data.');
  out.push('- The decision instant is date-only (`etDate`); asOf is the previous session. No instant is invented.');
  out.push('- The holding anchor swing low is absent on every row (ID-1 is unbuilt), so `structure_break` is unknown throughout.');
  out.push('- Volume facts come from the EOD series, never from the rankings document the agent was shown (ID-6).');
  out.push('- Nothing here measures behavioral differentiation, partnership usefulness or market performance.');
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------- env, provenance, runs

function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const env = {};
  for (const f of files) if (existsSync(f)) for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (env[k] === undefined) env[k] = v;
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  return env;
}

function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}
function treeDirty() {
  try { return execFileSync('git', ['status', '--porcelain'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim().length > 0; } catch { return null; }
}
const scriptSha = () => sha256(readFileSync(SCRIPT_PATH));
const moduleShas = () => Object.fromEntries(Object.entries(MODULES).map(([k, rel]) => [k, sha256(readFileSync(path.join(PROJECT_ROOT, rel)))]));
function stamp(manifest, cmd) {
  (manifest.commands ||= []).push({ cmd, at: new Date().toISOString(), scriptSha256: scriptSha(), head: headSha() });
}
function resolveRun(flags) {
  let runId = flags.run;
  if (!runId) {
    const all = existsSync(RUNS_ROOT) ? readdirSync(RUNS_ROOT).filter((d) => d.startsWith(RUN_PREFIX)).sort() : [];
    runId = all[all.length - 1];
  }
  if (!runId || !/^tfs-\d{8}T\d{6}$/.test(runId)) stop('no replay run — run `plan` first');
  const dir = path.join(RUNS_ROOT, runId);
  return { runId, dir, manifestPath: path.join(dir, 'manifest.json') };
}
function loadRun(flags) {
  const { runId, dir, manifestPath } = resolveRun(flags);
  if (!existsSync(manifestPath)) stop(`run ${runId} has no manifest`);
  const manifest = readJson(manifestPath);
  if (!manifest.commands?.some((c) => c.cmd === 'plan')) stop(`run ${runId} was not planned`);
  const rows = readJson(path.join(dir, 'rows.local.json'));
  return { runId, dir, manifestPath, manifest, rows };
}
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[k] = v;
    }
  }
  return flags;
}

// ---------------------------------------------------------------- commands

function plan() {
  if (!existsSync(CAPTURE_PATH)) stop(`the saved capture is missing at ${CAPTURE_PATH}; this run reads no production store`);
  const bytes = readFileSync(CAPTURE_PATH);
  const records = JSON.parse(bytes.toString('utf8'));
  const fields = verifyCaptureFields(records);
  if (!fields.ok) stop(`the capture's fields differ from the verified shape: ${fields.problems.join('; ')} — the replay path is not defined until they are re-derived`);
  const population = selectPopulation(records);
  const thePlan = planFor(population.rows);
  const runId = `${RUN_PREFIX}${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const dir = path.join(RUNS_ROOT, runId);
  mkdirSync(dir, { recursive: true });
  const manifest = {
    runId,
    createdAt: new Date().toISOString(),
    runInstant: null,
    head: headSha(),
    dirty: treeDirty(),
    scriptSha256: scriptSha(),
    moduleSha256: moduleShas(),
    ruleSet: describeRuleSet(),
    constants: { CALL_CAP, FROM_PAD_DAYS, MIN_COMPLETED_BARS, TARGET_ARCHETYPE, SOURCE, RECEIPT_COUNT, MIN_JOINED_ROWS, UNKNOWN_SHARE_LIMIT },
    capture: { file: 'ft-experiment-exhibits/archetype-ablation-run/records.json', bytes: bytes.length, sha256: sha256(bytes), records: records.length, keys: fields.keys, timeFields: fields.timeFields, mtime: statSync(CAPTURE_PATH).mtime.toISOString() },
    population: population.counts,
    symbolsIn: population.symbolsIn,
    symbolsOut: population.symbolsOut,
    plan: { pairs: thePlan.pairs.map((p) => ({ symbol: p.symbol, asOf: p.asOf, role: p.role, rows: p.rows })), symbols: thePlan.symbols, calls: thePlan.calls, cap: CALL_CAP, from: thePlan.from, to: thePlan.to, cryptoSkipped: thePlan.cryptoSkipped, calendarMissing: thePlan.calendarMissing },
    eodhd: { cap: CALL_CAP, calls: 0, log: [], failures: {} },
    scope: 'the saved 13 Oct 2026 capture only; no Firestore read; production capture expansion is a later run with its own scope statement',
  };
  stamp(manifest, 'plan');
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
  writeJsonAtomic(path.join(dir, 'rows.local.json'), population.rows);
  const printed = { ...manifest, commands: undefined, eodhd: undefined };
  console.log(JSON.stringify(printed, null, 1));
  if (thePlan.calls > CALL_CAP) console.log(`\nNOTE: ${thePlan.calls} symbols exceed the cap of ${CALL_CAP}; \`bars\` stops at the cap and the uncovered symbols are reported as unfetched.`);
  console.log(`\nplanned: ${thePlan.pairs.length} (symbol, asOf, role) pairs over ${thePlan.symbols.length} symbols → ${thePlan.calls} EODHD calls (cap ${CALL_CAP}); run ${runId}`);
}

async function bars(flags) {
  const { dir, manifestPath, manifest } = loadRun(flags);
  stamp(manifest, 'bars');
  writeJsonAtomic(manifestPath, manifest);
  const env = loadEnv();
  const cacheDir = path.join(dir, 'bars');
  mkdirSync(cacheDir, { recursive: true });
  const counter = makeCounter(manifest.eodhd, CALL_CAP, () => writeJsonAtomic(manifestPath, manifest));
  const only = typeof flags.symbol === 'string' ? flags.symbol.toUpperCase() : null;
  const symbols = only ? [only] : manifest.plan.symbols;
  const from = manifest.plan.from; const to = typeof flags.asOf === 'string' && only ? flags.asOf : manifest.plan.to;
  for (const symbol of symbols) {
    const file = path.join(cacheDir, `${symbol}.json`);
    if (existsSync(file) && !flags.refetch) { console.log(`[bars] ${symbol}: cached`); continue; }
    if (isCryptoSymbol(symbol)) { console.log(`[bars] ${symbol}: crypto, not fetched`); continue; }
    if (!env.EODHD_API_KEY) stop('EODHD_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s).');
    if (!counter.take(symbol)) { manifest.eodhd.failures[symbol] = 'call cap reached'; writeJsonAtomic(manifestPath, manifest); console.log(`[bars] ${symbol}: call cap reached`); continue; }
    const r = await fetchEod(symbol, env.EODHD_API_KEY, from, to);
    if (!r.ok) { manifest.eodhd.failures[symbol] = r.error; writeJsonAtomic(manifestPath, manifest); console.log(`[bars] ${symbol}: fetch failed: ${r.error}`); continue; }
    const fetchedAt = new Date().toISOString();
    writeJsonAtomic(file, { symbol, eodSymbol: r.eod, fetchedAt, from, to, rawCount: r.payload.length, payloadSha256: sha256(JSON.stringify(r.payload)), payload: r.payload });
    console.log(`[bars] ${symbol}: ${r.payload.length} rows (${manifest.eodhd.calls}/${CALL_CAP} calls)`);
    if (flags.fixture && only && typeof flags.asOf === 'string') {
      const fixDir = path.join(PROJECT_ROOT, 'api', '_utils', 'setupEvaluator', '__fixtures__', 'historical');
      mkdirSync(fixDir, { recursive: true });
      const fixture = { label: 'historical_development_case', symbol, eodSymbol: r.eod, asOf: flags.asOf, provenance: { source: SOURCE, fetchedAt, from, to, payloadSha256: sha256(JSON.stringify(r.payload)), head: headSha() }, payload: r.payload };
      writeJsonAtomic(path.join(fixDir, `${symbol}-${flags.asOf}.json`), fixture);
      console.log(`[bars] wrote the historical fixture ${symbol}-${flags.asOf}.json`);
    }
  }
  writeJsonAtomic(manifestPath, manifest);
  console.log(`eodhd calls: ${manifest.eodhd.calls} of ${CALL_CAP}`);
}

function evaluate(flags) {
  const { dir, manifestPath, manifest, rows } = loadRun(flags);
  stamp(manifest, 'evaluate');
  const now = new Date();
  manifest.runInstant = now.toISOString();
  const cacheDir = path.join(dir, 'bars');
  const results = {};
  const pairResults = [];
  for (const pair of manifest.plan.pairs) {
    const file = path.join(cacheDir, `${pair.symbol}.json`);
    let evidence;
    let sourceMeta = null;
    if (!existsSync(file)) {
      evidence = { ok: false, reason: 'missing_bar', detail: { expected: pair.asOf, latest: null, why: manifest.eodhd.failures[pair.symbol] || 'not fetched' }, asOf: pair.asOf, basis: 'raw', source: SOURCE, symbol: pair.symbol };
    } else {
      const cached = readJson(file);
      sourceMeta = { fetchedAt: cached.fetchedAt, from: cached.from, to: cached.to };
      const { rows: mapped, dropped } = mapDailyRows(cached.payload);
      const withAdj = attachAdjustedClose(mapped, cached.payload);
      evidence = buildDailyEvidence({ rows: withAdj, asOf: pair.asOf, now, minBars: MIN_COMPLETED_BARS, source: SOURCE, sourceMeta, symbol: pair.symbol, barsClass: 'later_reconstruction' });
      evidence.mapperDropped = dropped;
    }
    const key = `${pair.symbol}|${pair.asOf}|${pair.role}`;
    const record = pair.role === 'entry' ? evaluateTfEntry(evidence) : evaluateTfHolding(evidence, { anchorSwingLow: null });
    results[key] = { symbol: pair.symbol, asOf: pair.asOf, role: pair.role, adapter: evidence.ok ? { ok: true, checks: evidence.checks, dropped: evidence.dropped, mapperDropped: evidence.mapperDropped ?? null, bars: evidence.bars.length } : { ok: false, reason: evidence.reason, detail: evidence.detail, checks: evidence.checks ?? null }, record };
    pairResults.push({ ...pair, result: pair.role === 'entry' ? { verdict: record.verdict, reason: record.reason, pattern: record.pattern, regime: record.regime } : { chartLeg: record.chartLeg, reasons: record.reasons } });
  }
  for (const row of rows) {
    if (!row.asOf) { row.entry = null; row.holding = null; row.unevaluated = 'calendar_missing'; continue; }
    const e = results[`${row.symbolIn}|${row.asOf}|entry`];
    const h = row.symbolOut ? results[`${row.symbolOut}|${row.asOf}|holding`] : null;
    row.symbol = row.symbolIn;
    row.entry = e ? e.record : null;
    row.checks = e?.adapter.checks ?? null;
    row.holding = h ? h.record : null;
    if (!e) row.unevaluated = isCryptoSymbol(row.symbolIn) ? 'crypto' : 'no_pair';
  }
  manifest.evaluate = { at: manifest.runInstant, pairs: pairResults.length, scriptSha256: scriptSha(), head: headSha() };
  manifest.plan.pairs = pairResults;
  writeJsonAtomic(path.join(dir, 'evaluations.json'), results);
  writeJsonAtomic(path.join(dir, 'rows.local.json'), rows);
  writeJsonAtomic(manifestPath, manifest);
  const tally = {};
  for (const p of pairResults) if (p.role === 'entry') inc(tally, p.result.verdict === 'valid' ? `valid/${p.result.pattern}` : `${p.result.verdict}/${p.result.reason}`);
  console.log(JSON.stringify({ pairs: pairResults.length, entryVerdicts: sortedCounts(tally), runInstant: manifest.runInstant }, null, 1));
}

function findScorerResults() {
  if (!existsSync(SCORER_ROOT)) return null;
  const runs = readdirSync(SCORER_ROOT).filter((d) => d.startsWith('cms-') && existsSync(path.join(SCORER_ROOT, d, 'results.local.json'))).sort();
  if (!runs.length) return null;
  const run = runs[runs.length - 1];
  return { run, results: readJson(path.join(SCORER_ROOT, run, 'results.local.json')) };
}

function report(flags) {
  const { dir, manifestPath, manifest, rows } = loadRun(flags);
  if (!manifest.evaluate) stop('run `evaluate` first');
  stamp(manifest, 'report');
  const scorer = findScorerResults();
  const join = joinScorer(rows, scorer?.results ?? null);
  if (scorer) join.scorerRun = scorer.run;
  const summary = summarize({ rows, pairs: manifest.plan.pairs, counts: manifest.population, plan: manifest.plan, join, manifest });
  writeJsonAtomic(path.join(dir, 'summary.json'), summary);
  writeFileSync(path.join(dir, 'report.md'), renderReport(summary));
  manifest.report = { at: summary.at, scriptSha256: scriptSha(), head: headSha() };
  writeJsonAtomic(manifestPath, manifest);
  console.log(renderReport(summary));
  console.log(`\nwritten: ${path.join(dir, 'summary.json')} and report.md`);
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const checks = [];
  const check = (name, ok) => { checks.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
  check('S1 the frozen cap is 60', CALL_CAP === 60);
  const rec = (over) => ({ archetype: 'momentum_chaser', battleId: 'b1', tickId: 'b1:3', etDate: '2026-10-13', woken: true, ownerClass: 'non_cpu', owner: 'never-read', decision: { original: 'SWAP', final: 'HOLD', originalSymbolIn: 'MU', originalSymbolOut: 'GOOGL', finalSymbolIn: null, finalSymbolOut: null }, ...over });
  const pop = selectPopulation([rec(), rec({ ownerClass: 'cpu' }), rec({ woken: false }), rec({ archetype: 'contrarian' })]);
  check('S2 the population filter keeps one proposed row of four records', pop.rows.length === 1 && pop.counts.proposed === 1 && pop.counts.executed === 0);
  check('S3 asOf is the previous session (13 Oct → 12 Oct)', pop.rows[0].asOf === '2026-10-12' && pop.rows[0].decisionInstant.precision === 'date');
  const red = redactRow(pop.rows[0]);
  check('S4 redaction drops the battle and tick ids and never carries an owner', !('battleId' in red) && !('tickId' in red) && !('owner' in red) && red.battleHash === hashBattleId('b1'));
  const state = { calls: 0, log: [] };
  const counter = makeCounter(state, CALL_CAP);
  let taken = 0; for (let i = 0; i < 61; i++) if (counter.take(`S${i}`)) taken += 1;
  check('S5 the counter refuses the 61st request', taken === 60 && state.calls === 60);
  check('S6 the capture field check accepts the verified shape', verifyCaptureFields([rec()]).ok === true);
  check('S7 the capture field check refuses a second time field', verifyCaptureFields([rec({ capturedAt: '2026-10-13T14:00:00Z' })]).ok === false);
  const failed = checks.filter((c) => !c.ok);
  console.log(`\nselftest: ${checks.length - failed.length}/${checks.length} passed`);
  return failed.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------- main

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case 'selftest': process.exit(selftest()); break;
    case 'plan': plan(); break;
    case 'bars': await bars(flags); break;
    case 'evaluate': evaluate(flags); break;
    case 'report': report(flags); break;
    default:
      console.log('tf-setup-corpus-replay — subcommands: selftest | plan | bars [--symbol X --asOf D --fixture] | evaluate | report  (options: --run <runId>)');
      process.exit(cmd ? 2 : 0);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((err) => stop(String(err?.stack || err)));
}
