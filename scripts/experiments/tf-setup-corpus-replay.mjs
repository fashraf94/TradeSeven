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
//     The cap is per run folder and per process (review TE4-6): a new `plan`
//     mints a new run with a fresh budget; two `bars` processes on one run
//     each start from the persisted count; a failed symbol is retried (and
//     counted again) on the next `bars`. Run one `bars` at a time.
//   - Everything it writes lands in %USERPROFILE%/tf-setup-replay-runs/<runId>/,
//     outside the repo. Files named *.local.* carry battle and tick ids and are
//     never committed (a naming convention, not a .gitignore rule — review
//     TE4-8); summary.json and report.md carry neither owner nor raw battle ids.
//     manifest.json is the provenance of record for the folder (review TE4-4):
//     every command stamps HEAD, the dirty flag, the script's and the four
//     modules' sha256 and its flags; evaluations.json and the bars files
//     carry the same provenance block; summary.json and report.md carry the
//     plan-time and report-time provenance and a DRIFT line when they differ
//     (review TE4-1). `evaluate` and `report` refuse a dirty tree unless
//     --allow-dirty is given, which is recorded.
//   - The one write into the repo tree is `bars --symbol X --asOf D --fixture`,
//     explicit and recorded: it fetches into its OWN cache file
//     (bars/<SYMBOL>@<asOf>.json, never the planned cache — review TE4-2) and
//     writes api/_utils/setupEvaluator/__fixtures__/historical/<SYMBOL>-<asOf>.json.
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
// ONE ROW PER MOMENT (review TE5-1): a woken check with a proposed SWAP and an
// executed SWAP that coincide is ONE row (kind 'both'); they are two rows,
// labelled 'proposed' and 'executed', only when they differ.
//
// USAGE (repo root), in order:
//   node scripts/experiments/tf-setup-corpus-replay.mjs selftest
//   node scripts/experiments/tf-setup-corpus-replay.mjs plan        # reads the saved file; counts, pairs, call count; no fetch
//   node scripts/experiments/tf-setup-corpus-replay.mjs bars        # one counted /eod/ request per symbol [--symbol X --asOf D --fixture]
//   node scripts/experiments/tf-setup-corpus-replay.mjs evaluate    # refuses without `plan` on the same run; refuses a dirty tree
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
/** A symbol the replay will put into a file name and a URL (review TE4-3). */
export const SYMBOL_RE = /^[A-Z0-9.\-]{1,12}$/;
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
/** A real calendar date (review TE2-9: the regex alone lets 2026-02-30 through, and Date.parse rolls it to 2 March; the UTC round trip does not). */
export function isRealDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d, 12);
  if (!Number.isFinite(ms)) return false;
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 1)}\n`);
  renameSync(tmp, p);
}
/** An EODHD URL carries the key as a query parameter: never let one reach a log. */
export function redactEodhd(text, key = null) {
  let out = String(text).replace(/api_token=[^&\s"']*/g, 'api_token=[REDACTED]');
  if (key && key.length >= 8) out = out.split(key).join('[REDACTED]');
  return out;
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
 * only after this says that `etDate` is the ONLY time-shaped field, every
 * etDate is a real date, and `tickId` is `<battleId>:<seq>`.
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
    if (!isRealDate(r.etDate)) badDate += 1;
    if (typeof r.tickId !== 'string' || typeof r.battleId !== 'string' || !r.tickId.startsWith(`${r.battleId}:`)) badTick += 1;
    if (r.decision && typeof r.decision === 'object') { for (const f of DECISION_FIELDS) if (!(f in r.decision)) { badDecision += 1; break; } }
  }
  if (badDate) problems.push(`${badDate} records have an etDate that is not a real calendar date`);
  if (badTick) problems.push(`${badTick} records have a tickId that is not <battleId>:<seq>`);
  if (badDecision) problems.push(`${badDecision} records lack a decision field the filter reads`);
  return { ok: problems.length === 0, problems, keys: keyList, timeFields, records: records.length };
}

// ---------------------------------------------------------------- population

const symbolOf = (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null);

/**
 * The Trend Follower's woken checks with a SWAP: ONE row per moment — kind
 * 'both' when the proposed (decision.original) and executed (decision.final)
 * swaps coincide, else a 'proposed' row and/or an 'executed' row. Reads
 * `owner` never. A symbol that fails SYMBOL_RE is listed and never fetched.
 */
export function selectPopulation(records) {
  const rows = [];
  const counts = { tfRecords: 0, woken: 0, proposed: 0, executed: 0, coincide: 0, rowsProposedOnly: 0, rowsExecutedOnly: 0, rowsBoth: 0, battles: 0, malformedSymbols: 0 };
  const battles = new Set();
  const distinctIn = new Set();
  const distinctOut = new Set();
  const malformed = new Set();
  const perMonth = {};
  const row = (r, kind, swap) => {
    const bad = [swap.symbolIn, swap.symbolOut].filter((s) => s && !SYMBOL_RE.test(s));
    for (const s of bad) malformed.add(s);
    if (bad.length) counts.malformedSymbols += 1;
    return {
      battleId: r.battleId,
      tickId: r.tickId,
      tickSeq: String(r.tickId).slice(String(r.battleId).length + 1),
      etDate: r.etDate,
      kind,
      symbolIn: swap.symbolIn,
      symbolOut: swap.symbolOut,
      malformedSymbol: bad.length > 0,
      asOf: asOfFor(r.etDate),
      decisionInstant: { etDate: r.etDate, precision: 'date' },
      evidenceClass: { decision: 'contemporaneous', bars: 'later_reconstruction', verdict: 'derived' },
    };
  };
  for (const r of records) {
    if (r?.archetype !== TARGET_ARCHETYPE || r?.ownerClass === 'cpu') continue;
    counts.tfRecords += 1;
    if (r.woken !== true) continue;
    counts.woken += 1;
    battles.add(r.battleId);
    inc(perMonth, String(r.etDate).slice(0, 7));
    const d = r.decision || {};
    const proposed = d.original === 'SWAP' && symbolOf(d.originalSymbolIn) ? { symbolIn: symbolOf(d.originalSymbolIn), symbolOut: symbolOf(d.originalSymbolOut) } : null;
    const executed = d.final === 'SWAP' && symbolOf(d.finalSymbolIn) ? { symbolIn: symbolOf(d.finalSymbolIn), symbolOut: symbolOf(d.finalSymbolOut) } : null;
    if (proposed) counts.proposed += 1;
    if (executed) counts.executed += 1;
    for (const swap of [proposed, executed]) {
      if (!swap) continue;
      distinctIn.add(swap.symbolIn);
      if (swap.symbolOut) distinctOut.add(swap.symbolOut);
    }
    const coincide = proposed && executed && proposed.symbolIn === executed.symbolIn && proposed.symbolOut === executed.symbolOut;
    if (coincide) {
      counts.coincide += 1;
      counts.rowsBoth += 1;
      rows.push(row(r, 'both', proposed));
      continue;
    }
    if (proposed) { counts.rowsProposedOnly += 1; rows.push(row(r, 'proposed', proposed)); }
    if (executed) { counts.rowsExecutedOnly += 1; rows.push(row(r, 'executed', executed)); }
  }
  counts.battles = battles.size;
  counts.distinctIn = distinctIn.size;
  counts.distinctOut = distinctOut.size;
  counts.perMonth = sortedCounts(perMonth);
  return { rows, counts, symbolsIn: [...distinctIn].sort(), symbolsOut: [...distinctOut].sort(), malformedSymbols: [...malformed].sort() };
}

/** The last trading session strictly before the check's ET date; null when the calendar cannot say. */
export function asOfFor(etDate) {
  return isRealDate(etDate) ? getPreviousSessionDate(etDate) : null;
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
  const malformed = new Set();
  const calendarMissing = [];
  for (const row of rows) {
    if (!row.asOf) { calendarMissing.push({ etDate: row.etDate, kind: row.kind, symbolIn: row.symbolIn }); continue; }
    for (const [symbol, role] of [[row.symbolIn, 'entry'], [row.symbolOut, 'holding']]) {
      if (!symbol) continue;
      if (!SYMBOL_RE.test(symbol)) { malformed.add(symbol); continue; }
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
  return { pairs: list, symbols, calls: symbols.length, from, to, cryptoSkipped: [...crypto].sort(), malformedSkipped: [...malformed].sort(), calendarMissing };
}

/**
 * The evidence for a planned pair the adapter never sees (closeout, 28 Oct 2026): no cache file (an unfetched
 * symbol), or a cache whose window ends before asOf. Both are historical replay pairs, so both carry the bars
 * class `later_reconstruction` (the unfetched branch since the fix round, Astra F2). A cache's own fetchedAt /
 * from / to are carried as `sourceMeta`; with no cache there is no provenance to carry, so `sourceMeta` is null —
 * never invented. Neither consulted the calendar, so neither names an expected session.
 */
export function unreadPairEvidence({ pair, cached = null, failure = null }) {
  if (!cached) {
    return { ok: false, reason: 'missing_bar', detail: { expected: pair.asOf, latest: null, why: failure ? `unfetched: ${failure}` : 'unfetched: not fetched' }, asOf: pair.asOf, basis: 'raw', source: SOURCE, sourceMeta: null, symbol: pair.symbol, evidenceClass: { bars: 'later_reconstruction' } };
  }
  return { ok: false, reason: 'missing_bar', detail: { expected: pair.asOf, latest: cached.to, why: 'cache window ends before asOf' }, asOf: pair.asOf, basis: 'raw', source: SOURCE, sourceMeta: { fetchedAt: cached.fetchedAt, from: cached.from, to: cached.to }, symbol: pair.symbol, evidenceClass: { bars: 'later_reconstruction' } };
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
    return { ok: false, eod, error: redactEodhd(String(err?.message || err), key).slice(0, 160) };
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

/** The join to the Oct 14 scorer's control rows (swap vs holding), by battleId + tickId + the swap's call; one row per moment. */
export function joinScorer(rows, scorer) {
  if (!scorer) return { available: false, joined: 0, byClass: {} };
  const index = new Map();
  const add = (k, call, points) => { if (k && call) index.set(`${k}|${call}`, points); };
  for (const r of scorer.controlRows || []) add(r.k, r.call, r.primary?.points);
  for (const r of scorer.controlMainRows || []) add(r.k, r.call, r.primary?.points);
  const byClass = {};
  const seen = new Set();
  let joined = 0;
  for (const row of rows) {
    if (!row.entry || !row.symbolOut) continue;
    const key = `${row.battleId}__${row.tickId}|SWAP:${row.symbolOut}>${row.symbolIn}`;
    if (seen.has(key)) continue;
    const points = index.get(key);
    if (!points || points.status !== 'scored' || typeof points.delta !== 'number') continue;
    seen.add(key);
    joined += 1;
    const cls = verdictClass(row.entry);
    const b = (byClass[cls] ||= { beat: 0, lost: 0, tied: 0 });
    if (points.delta > 1) b.beat += 1; else if (points.delta < -1) b.lost += 1; else b.tied += 1;
  }
  return { available: true, joined, byClass: sortedCounts(byClass), sufficient: joined >= MIN_JOINED_ROWS };
}

const provenanceOf = (m) => ({ head: m?.head ?? null, dirty: m?.dirty ?? null, scriptSha256: m?.scriptSha256 ?? null, moduleSha256: m?.moduleSha256 ?? null });
const sameProvenance = (a, b) => JSON.stringify(provenanceOf(a)) === JSON.stringify(provenanceOf(b));

export function summarize({ rows, pairs, counts, plan, join, manifest, reportProvenance = null }) {
  const entryRows = rows.filter((r) => r.entry);
  const verdicts = {}; const regimes = {}; const patterns = {}; const unknownReasons = {}; const invalidReasons = {}; const validPatterns = {}; const missingFacts = {}; const kinds = {};
  for (const r of rows) inc(kinds, r.kind);
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
  const planProv = provenanceOf(manifest.provenance?.plan ?? manifest);
  const evaluateProv = manifest.provenance?.evaluate ? provenanceOf(manifest.provenance.evaluate) : null;
  const reportProv = reportProvenance ? provenanceOf(reportProvenance) : null;
  const drift = reportProv ? !sameProvenance(planProv, reportProv) || (evaluateProv && !sameProvenance(evaluateProv, reportProv)) || reportProv.dirty === true || reportProv.dirty === null : null;
  const unfetched = Object.keys(manifest.eodhd?.failures ?? {}).length;
  const mapperDropped = pairs.reduce((n, p) => n + (p.mapperDropped || 0), 0);
  return {
    runId: manifest.runId,
    at: new Date().toISOString(),
    provenance: {
      plan: planProv,
      evaluate: evaluateProv,
      report: reportProv,
      drift,
      ruleSet: manifest.ruleSet,
      capture: { file: manifest.capture.file, records: manifest.capture.records, sha256: manifest.capture.sha256, timeFields: manifest.capture.timeFields },
      runInstant: manifest.runInstant,
    },
    coverage: { ...counts, kinds: sortedCounts(kinds), rows: rows.length, entryEvaluations: entryRows.length, holdingEvaluations: holdingRows.length, pairs: pairs.length, symbols: plan.symbols.length },
    eodhd: { cap: manifest.eodhd.cap, calls: manifest.eodhd.calls, failures: manifest.eodhd.failures, unfetched, unfetchedPairs: manifest.evaluate?.unfetchedPairs ?? 0, mapperDropped, cryptoSkipped: plan.cryptoSkipped, malformedSkipped: plan.malformedSkipped ?? [], calendarMissing: plan.calendarMissing.length },
    verdicts: sortedCounts(verdicts),
    validByPattern: sortedCounts(validPatterns),
    invalidByReason: sortedCounts(invalidReasons),
    unknownByReason: sortedCounts(unknownReasons),
    regimes: sortedCounts(regimes),
    patterns: sortedCounts(patterns),
    missingFacts: sortedCounts(missingFacts),
    holding: { chartLeg: sortedCounts(chartLeg), reasons: sortedCounts(holdingReasons), anchor: 'absent throughout (structure_break unknown on every row)' },
    dataUnknown: { unknown: unknownPairs, attempted, share, limit: UNKNOWN_SHARE_LIMIT, aboveLimit: share !== null && share > UNKNOWN_SHARE_LIMIT, note: 'over distinct equity (symbol, asOf) entry pairs attempted, not rows; crypto, malformed symbols and calendar_missing reported separately' },
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
/** Three-state tree rendering: an unknown dirty state is never printed as clean (review TEV4-1). */
const provLine = (label, p) => `- ${label}: HEAD \`${p.head ?? 'unknown'}\`${p.dirty === true ? ' (working tree DIRTY)' : p.dirty === false ? ' (clean)' : ' (tree state unknown)'}; script sha256 \`${String(p.scriptSha256 ?? '').slice(0, 12)}\`; modules: ${Object.entries(p.moduleSha256 ?? {}).map(([k, v]) => `${k} \`${String(v).slice(0, 12)}\``).join(', ') || 'n/a'}`;

export function renderReport(s) {
  const out = [];
  out.push(`# tf-setup-v1 corpus replay — run ${s.runId}`, '');
  out.push(`Generated ${s.at}. Counts only; no owner, no raw battle id; one row per moment. Verdicts are what the rule says on the EOD series as served at fetch time, dated to the session before each check, never what the agent could have known.`, '');
  out.push('## Provenance', '');
  out.push(provLine('plan', s.provenance.plan));
  if (s.provenance.evaluate) out.push(provLine('evaluate', s.provenance.evaluate));
  if (s.provenance.report) out.push(provLine('report', s.provenance.report));
  if (s.provenance.drift === true) out.push('- **DRIFT: the report was produced at a different HEAD, script or module state than the plan, or on a dirty tree. Quote the report-time provenance; re-run `evaluate` and `report` at the committed head before relying on any number.**');
  else if (s.provenance.drift === false) out.push('- plan and report provenance agree; the tree was clean');
  out.push(`- rule set: \`${s.provenance.ruleSet.setupVersion}\` / \`${s.provenance.ruleSet.thresholdsHash}\` / \`${s.provenance.ruleSet.semanticsId}\`; run instant ${s.provenance.runInstant}`);
  out.push(`- capture: \`${s.provenance.capture.file}\`, ${s.provenance.capture.records} records, sha256 \`${s.provenance.capture.sha256.slice(0, 12)}\`, time fields ${JSON.stringify(s.provenance.capture.timeFields)}`, '');
  out.push('## Coverage', '');
  out.push(`| Measure | Count |`, `|---|---|`, `| Trend Follower records (non-CPU) | ${s.coverage.tfRecords} |`, `| Woken checks | ${s.coverage.woken} |`, `| Battles | ${s.coverage.battles} |`, `| Proposed swap-ins | ${s.coverage.proposed} |`, `| Executed swap-ins | ${s.coverage.executed} |`, `| Proposed and executed coincide (one row, kind both) | ${s.coverage.coincide} |`, `| Rows: proposed only / executed only / both | ${s.coverage.rowsProposedOnly} / ${s.coverage.rowsExecutedOnly} / ${s.coverage.rowsBoth} |`, `| Distinct incoming names | ${s.coverage.distinctIn} |`, `| Distinct outgoing names | ${s.coverage.distinctOut} |`, `| Rows (moments) | ${s.coverage.rows} |`, `| Entry evaluations (rows with a result) | ${s.coverage.entryEvaluations} |`, `| Holding evaluations | ${s.coverage.holdingEvaluations} |`, `| Distinct (symbol, asOf, role) pairs | ${s.coverage.pairs} |`, `| Distinct symbols fetched | ${s.coverage.symbols} |`, `| Rows with a malformed symbol (never fetched) | ${s.coverage.malformedSymbols} |`, '');
  out.push(table('Woken checks per month', s.coverage.perMonth, ['Month', 'Checks']));
  out.push('## EODHD', '', `- calls made ${s.eodhd.calls} of cap ${s.eodhd.cap}; unfetched symbols ${s.eodhd.unfetched} (${JSON.stringify(s.eodhd.failures)}), pairs left unfetched ${s.eodhd.unfetchedPairs} (they read as missing_bar below); rows dropped by mapDailyRows before the adapter ${s.eodhd.mapperDropped} (such a session reads as missing_bar, named mapper_dropped_row in evaluations.json); crypto skipped ${JSON.stringify(s.eodhd.cryptoSkipped)}; malformed symbols skipped ${JSON.stringify(s.eodhd.malformedSkipped)}; calendar_missing rows ${s.eodhd.calendarMissing}`, '');
  out.push('## Entry verdicts (per row = per moment)', '');
  out.push(table('Verdict classes', s.verdicts, ['Class', 'Rows']));
  out.push(table('valid by pattern', s.validByPattern, ['Pattern', 'Rows']));
  out.push(table('invalid by reason', s.invalidByReason, ['Reason', 'Rows']));
  out.push(table('unknown by reason (a never-fetched symbol reads missing_bar; see the EODHD line)', s.unknownByReason, ['Reason', 'Rows']));
  out.push(table('Regime', s.regimes, ['Regime', 'Rows']));
  out.push(table('Pattern assessments', s.patterns, ['breakout / pullback_resume', 'Rows']));
  out.push(table('Missing facts (rows naming each)', s.missingFacts, ['Fact', 'Rows']));
  out.push('## Holding (outgoing name, anchor absent)', '');
  out.push(table('chartLeg', s.holding.chartLeg, ['chartLeg', 'Rows']));
  out.push(table('Reasons', s.holding.reasons, ['Reason', 'Rows']));
  out.push(`- ${s.holding.anchor}`, '');
  out.push('## Data-unknown share', '', `- distinct equity (symbol, asOf) entry pairs: ${s.dataUnknown.unknown} unknown of ${s.dataUnknown.attempted} attempted = **${pct(s.dataUnknown.share)}** (limit one quarter: ${s.dataUnknown.aboveLimit ? '**ABOVE — reject the adapter or the input path, fix, never the definition**' : 'within'}). ${s.dataUnknown.note}.`, '');
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
    out.push(`- joined moments: ${s.join.joined} (battleId + tickId + the swap's call against the scorer's CONTROL units — every scored swap vs holding, not its 28 record moments — each moment once)`);
    if (!s.join.sufficient) out.push(`- **coverage insufficient for any behavioral statement** (fewer than ${MIN_JOINED_ROWS} joined moments); no statement is made.`, '');
    else out.push(table('Swap vs holding by verdict class (points, tie = within 1; counts only, no statement)', Object.fromEntries(Object.entries(s.join.byClass).map(([k, v]) => [k, `beat ${v.beat} / lost ${v.lost} / tied ${v.tied}`])), ['Class', 'beat / lost / tied']));
  }
  out.push('## Reconstruction limits', '');
  out.push('- Bars are a later reconstruction: the EOD series as EODHD served it at fetch time; a restated series is invisible; the split heuristic needs the vendor adjustment already applied, trips on a special dividend above 10%, and is not proof of split-free data.');
  out.push('- The decision instant is date-only (`etDate`); asOf is the previous session. No instant is invented.');
  out.push('- The holding anchor swing low is absent on every row (ID-1 is unbuilt), so `structure_break` is unknown throughout.');
  out.push('- Volume facts come from the EOD series, never from the rankings document the agent was shown (ID-6).');
  out.push('- A session whose row mapDailyRows dropped (non-finite close/high/low) reads as `missing_bar`, not `missing_fact`.');
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
/** The provenance of this instant: what every command stamps (review TE4-1). */
function provenanceNow() {
  return { head: headSha(), dirty: treeDirty(), scriptSha256: scriptSha(), moduleSha256: moduleShas() };
}
function stamp(manifest, cmd, flags = {}, wrote = []) {
  (manifest.commands ||= []).push({ cmd, at: new Date().toISOString(), flags, wrote, ...provenanceNow() });
}
function refuseDirty(cmd, flags, prov) {
  if (prov.dirty === true && !flags['allow-dirty']) stop(`${cmd}: the working tree is dirty; commit first so the outputs' provenance names the code that produced them, or pass --allow-dirty (recorded in the manifest)`);
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
const relRun = (p) => path.relative(RUNS_ROOT, p).split(path.sep).join('/');

// ---------------------------------------------------------------- commands

function plan() {
  if (!existsSync(CAPTURE_PATH)) stop(`the saved capture is missing at ${relRun(CAPTURE_PATH)}; this run reads no production store`);
  const bytes = readFileSync(CAPTURE_PATH);
  const records = JSON.parse(bytes.toString('utf8'));
  const fields = verifyCaptureFields(records);
  if (!fields.ok) stop(`the capture's fields differ from the verified shape: ${fields.problems.join('; ')} — the replay path is not defined until they are re-derived`);
  const population = selectPopulation(records);
  const thePlan = planFor(population.rows);
  const prov = provenanceNow();
  if (!prov.head || prov.dirty === null) stop('plan: git could not name HEAD or the tree state; a run without provenance is not started (review TEV4-1)');
  const runId = `${RUN_PREFIX}${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const dir = path.join(RUNS_ROOT, runId);
  mkdirSync(dir, { recursive: true });
  const manifest = {
    runId,
    createdAt: new Date().toISOString(),
    runInstant: null,
    ...prov,
    provenance: { plan: prov },
    ruleSet: describeRuleSet(),
    constants: { CALL_CAP, FROM_PAD_DAYS, MIN_COMPLETED_BARS, TARGET_ARCHETYPE, SOURCE, RECEIPT_COUNT, MIN_JOINED_ROWS, UNKNOWN_SHARE_LIMIT },
    capture: { file: 'ft-experiment-exhibits/archetype-ablation-run/records.json', bytes: bytes.length, sha256: sha256(bytes), records: records.length, keys: fields.keys, timeFields: fields.timeFields, mtime: statSync(CAPTURE_PATH).mtime.toISOString() },
    population: population.counts,
    symbolsIn: population.symbolsIn,
    symbolsOut: population.symbolsOut,
    malformedSymbols: population.malformedSymbols,
    plan: { pairs: thePlan.pairs.map((p) => ({ symbol: p.symbol, asOf: p.asOf, role: p.role, rows: p.rows })), symbols: thePlan.symbols, calls: thePlan.calls, cap: CALL_CAP, from: thePlan.from, to: thePlan.to, cryptoSkipped: thePlan.cryptoSkipped, malformedSkipped: thePlan.malformedSkipped, calendarMissing: thePlan.calendarMissing },
    eodhd: { cap: CALL_CAP, calls: 0, log: [], failures: {} },
    scope: 'the saved 13 Oct 2026 capture only; no Firestore read; production capture expansion is a later run with its own scope statement',
  };
  stamp(manifest, 'plan', {}, ['manifest.json', 'rows.local.json']);
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
  writeJsonAtomic(path.join(dir, 'rows.local.json'), population.rows);
  const printed = { ...manifest, commands: undefined, eodhd: undefined };
  console.log(JSON.stringify(printed, null, 1));
  if (thePlan.calls > CALL_CAP) console.log(`\nNOTE: ${thePlan.calls} symbols exceed the cap of ${CALL_CAP}; \`bars\` stops at the cap and the uncovered symbols are reported as unfetched.`);
  console.log(`\nplanned: ${thePlan.pairs.length} (symbol, asOf, role) pairs over ${thePlan.symbols.length} symbols → ${thePlan.calls} EODHD calls (cap ${CALL_CAP}); run ${runId}`);
}

async function bars(flags) {
  const { dir, manifestPath, manifest } = loadRun(flags);
  const wrote = [];
  stamp(manifest, 'bars', flags, wrote);
  writeJsonAtomic(manifestPath, manifest);
  const env = loadEnv();
  const cacheDir = path.join(dir, 'bars');
  mkdirSync(cacheDir, { recursive: true });
  const counter = makeCounter(manifest.eodhd, CALL_CAP, () => writeJsonAtomic(manifestPath, manifest));
  const only = typeof flags.symbol === 'string' ? flags.symbol.toUpperCase() : null;
  if (only && !SYMBOL_RE.test(only)) stop(`--symbol ${JSON.stringify(flags.symbol)} is not a symbol (${SYMBOL_RE})`);
  const fixture = flags.fixture === true;
  if (fixture && !(only && typeof flags.asOf === 'string')) stop('--fixture needs --symbol X and --asOf D');
  if (typeof flags.asOf === 'string' && !isRealDate(flags.asOf)) stop(`--asOf ${JSON.stringify(flags.asOf)} is not a date`);
  if (only && !fixture && !manifest.plan.symbols.includes(only)) stop(`--symbol ${only} is not in this run's plan; a symbol outside the plan is fetched only with --fixture`);
  const symbols = only ? [only] : manifest.plan.symbols;
  const from = manifest.plan.from;
  const to = fixture ? flags.asOf : manifest.plan.to;
  const provenance = { runId: manifest.runId, ...provenanceOf(provenanceNow()), ruleSet: manifest.ruleSet };
  for (const symbol of symbols) {
    // A fixture fetch has its own cache file and never touches the planned cache (review TE4-2).
    const file = path.join(cacheDir, fixture ? `${symbol}@${flags.asOf}.json` : `${symbol}.json`);
    if (existsSync(file) && !flags.refetch) { console.log(`[bars] ${symbol}: cached`); continue; }
    if (isCryptoSymbol(symbol)) { console.log(`[bars] ${symbol}: crypto, not fetched`); continue; }
    if (!env.EODHD_API_KEY) stop('EODHD_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s).');
    if (!counter.take(symbol)) { manifest.eodhd.failures[symbol] = 'call cap reached'; writeJsonAtomic(manifestPath, manifest); console.log(`[bars] ${symbol}: call cap reached`); continue; }
    const r = await fetchEod(symbol, env.EODHD_API_KEY, from, to);
    if (!r.ok) { manifest.eodhd.failures[symbol] = r.error; writeJsonAtomic(manifestPath, manifest); console.log(`[bars] ${symbol}: fetch failed: ${r.error}`); continue; }
    delete manifest.eodhd.failures[symbol];
    const fetchedAt = new Date().toISOString();
    writeJsonAtomic(file, { provenance, symbol, eodSymbol: r.eod, fetchedAt, from, to, rawCount: r.payload.length, payloadSha256: sha256(JSON.stringify(r.payload)), payload: r.payload });
    wrote.push(relRun(file));
    console.log(`[bars] ${symbol}: ${r.payload.length} rows (${manifest.eodhd.calls}/${CALL_CAP} calls)`);
    if (fixture) {
      const fixDir = path.join(PROJECT_ROOT, 'api', '_utils', 'setupEvaluator', '__fixtures__', 'historical');
      mkdirSync(fixDir, { recursive: true });
      const fixFile = path.join(fixDir, `${symbol}-${flags.asOf}.json`);
      const doc = { label: 'historical_development_case', symbol, eodSymbol: r.eod, asOf: flags.asOf, provenance: { source: SOURCE, fetchedAt, from, to, payloadSha256: sha256(JSON.stringify(r.payload)), ...provenance }, payload: r.payload };
      writeJsonAtomic(fixFile, doc);
      wrote.push(`repo:${path.relative(PROJECT_ROOT, fixFile).split(path.sep).join('/')}`);
      console.log(`[bars] wrote the historical fixture ${symbol}-${flags.asOf}.json into the repo tree (recorded in the manifest)`);
    }
  }
  writeJsonAtomic(manifestPath, manifest);
  console.log(`eodhd calls: ${manifest.eodhd.calls} of ${CALL_CAP}`);
}

function evaluate(flags) {
  const { dir, manifestPath, manifest, rows } = loadRun(flags);
  const prov = provenanceNow();
  refuseDirty('evaluate', flags, prov);
  stamp(manifest, 'evaluate', flags, ['evaluations.json', 'rows.local.json', 'manifest.json']);
  const now = new Date();
  manifest.runInstant = now.toISOString();
  const cacheDir = path.join(dir, 'bars');
  const results = {};
  const pairResults = [];
  let unfetchedPairs = 0;
  for (const pair of manifest.plan.pairs) {
    const file = path.join(cacheDir, `${pair.symbol}.json`);
    let evidence;
    let mapperDropped = null;
    if (!existsSync(file)) {
      evidence = unreadPairEvidence({ pair, failure: manifest.eodhd.failures[pair.symbol] ?? null });
    } else {
      const cached = readJson(file);
      // The cache's integrity hash is checked before any bar is read (review TEV4-2): a hand-edited cache never evaluates as fetched.
      if (cached.payloadSha256 !== sha256(JSON.stringify(cached.payload))) stop(`evaluate: ${relRun(file)} does not match its payloadSha256; the cache was altered after the fetch`);
      if (typeof cached.to === 'string' && cached.to < pair.asOf) {
        evidence = unreadPairEvidence({ pair, cached });
      } else {
        const sourceMeta = { fetchedAt: cached.fetchedAt, from: cached.from, to: cached.to };
        const { rows: mapped, dropped } = mapDailyRows(cached.payload);
        mapperDropped = dropped;
        const withAdj = attachAdjustedClose(mapped, cached.payload);
        evidence = buildDailyEvidence({ rows: withAdj, asOf: pair.asOf, now, minBars: MIN_COMPLETED_BARS, source: SOURCE, sourceMeta, symbol: pair.symbol, barsClass: 'later_reconstruction' });
      }
    }
    // A missing session whose raw row IS in the payload was dropped by mapDailyRows (a non-finite close/high/low): name it (review TE2-3).
    if (!evidence.ok && evidence.reason === 'missing_bar' && existsSync(file) && evidence.detail?.expected) {
      const raw = readJson(file).payload.find((p) => p && p.date === evidence.detail.expected);
      if (raw) evidence.detail = { ...evidence.detail, why: 'mapper_dropped_row', nullFields: ['close', 'adjusted_close', 'high', 'low'].filter((f) => raw[f] === null || raw[f] === undefined || !Number.isFinite(Number(raw[f]))) };
    }
    if (!existsSync(file)) unfetchedPairs += 1;
    const key = `${pair.symbol}|${pair.asOf}|${pair.role}`;
    const record = pair.role === 'entry' ? evaluateTfEntry(evidence) : evaluateTfHolding(evidence, { anchorSwingLow: null });
    results[key] = {
      symbol: pair.symbol, asOf: pair.asOf, role: pair.role,
      adapter: evidence.ok
        ? { ok: true, checks: evidence.checks, dropped: evidence.dropped, mapperDropped, bars: evidence.bars.length }
        : { ok: false, reason: evidence.reason, detail: evidence.detail, checks: evidence.checks ?? null, mapperDropped },
      record,
    };
    pairResults.push({ ...pair, mapperDropped, result: pair.role === 'entry' ? { verdict: record.verdict, reason: record.reason, pattern: record.pattern, regime: record.regime } : { chartLeg: record.chartLeg, reasons: record.reasons } });
  }
  for (const row of rows) {
    if (!row.asOf) { row.entry = null; row.holding = null; row.unevaluated = 'calendar_missing'; continue; }
    const e = results[`${row.symbolIn}|${row.asOf}|entry`];
    const h = row.symbolOut ? results[`${row.symbolOut}|${row.asOf}|holding`] : null;
    row.symbol = row.symbolIn;
    row.entry = e ? e.record : null;
    row.checks = e?.adapter.checks ?? null;
    row.holding = h ? h.record : null;
    if (!e) row.unevaluated = row.malformedSymbol ? 'malformed_symbol' : isCryptoSymbol(row.symbolIn) ? 'crypto' : 'no_pair';
  }
  manifest.provenance.evaluate = prov;
  manifest.evaluate = { at: manifest.runInstant, pairs: pairResults.length, unfetchedPairs, ...prov };
  manifest.plan.pairs = pairResults;
  writeJsonAtomic(path.join(dir, 'evaluations.json'), { provenance: { runId: manifest.runId, ...prov, ruleSet: manifest.ruleSet, runInstant: manifest.runInstant }, results });
  writeJsonAtomic(path.join(dir, 'rows.local.json'), rows);
  writeJsonAtomic(manifestPath, manifest);
  const tally = {};
  for (const p of pairResults) if (p.role === 'entry') inc(tally, p.result.verdict === 'valid' ? `valid/${p.result.pattern}` : `${p.result.verdict}/${p.result.reason}`);
  console.log(JSON.stringify({ pairs: pairResults.length, entryVerdicts: sortedCounts(tally), runInstant: manifest.runInstant, head: prov.head, dirty: prov.dirty }, null, 1));
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
  const prov = provenanceNow();
  refuseDirty('report', flags, prov);
  if (manifest.evaluate.scriptSha256 !== prov.scriptSha256 && !flags['allow-drift']) stop('report: the script changed since `evaluate` (the reference replay stops here too); run `evaluate` again, or pass --allow-drift (recorded; the report then carries a DRIFT line)');
  stamp(manifest, 'report', flags, ['summary.json', 'report.md', 'manifest.json']);
  const scorer = findScorerResults();
  const join = joinScorer(rows, scorer?.results ?? null);
  if (scorer) join.scorerRun = scorer.run;
  const summary = summarize({ rows, pairs: manifest.plan.pairs, counts: manifest.population, plan: manifest.plan, join, manifest, reportProvenance: prov });
  writeJsonAtomic(path.join(dir, 'summary.json'), summary);
  writeFileSync(path.join(dir, 'report.md'), renderReport(summary));
  manifest.provenance.report = prov;
  manifest.report = { at: summary.at, ...prov };
  writeJsonAtomic(manifestPath, manifest);
  console.log(renderReport(summary));
  console.log(`\nwritten: ${relRun(path.join(dir, 'summary.json'))} and ${relRun(path.join(dir, 'report.md'))} (under tf-setup-replay-runs)`);
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
  const both = selectPopulation([rec({ decision: { original: 'SWAP', final: 'SWAP', originalSymbolIn: 'MU', originalSymbolOut: 'GOOGL', finalSymbolIn: 'MU', finalSymbolOut: 'GOOGL' } })]);
  check('S8 a coinciding proposed and executed swap is one row of kind both', both.rows.length === 1 && both.rows[0].kind === 'both' && both.counts.coincide === 1);
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
      console.log('tf-setup-corpus-replay — subcommands: selftest | plan | bars [--symbol X --asOf D --fixture] [--refetch] | evaluate [--allow-dirty] | report [--allow-dirty]  (options: --run <runId>)');
      process.exit(cmd ? 2 : 0);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((err) => stop(String(err?.stack || err)));
}
