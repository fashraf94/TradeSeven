#!/usr/bin/env node
// scripts/experiments/setup-payoff/analyze.mjs
//
// Setup payoff check — STEP 0 AND PARTS A TO E. Offline and deterministic once enrich.mjs has written its shards: no
// Firestore, no network, no model. Every definition is lib.mjs DEFINITIONS, committed before this script first ran.
//
//   Step 0  reproduce the frequency count from the re-run (median 18, 31 valid breakouts in 27,360 stock-days, 456 of
//           456 stored records); a difference STOPS the run before any outcome is computed. Then the long window's
//           overlap check: its verdicts on the 120 stored sessions against the stored run's.
//   Part A  Pullback and Resume against three comparison groups, one and three sessions, percent and units.
//   Part B  Trend Breakout under eight extension candidates, from each record's own facts.
//   Part C  the archetypes' own rules, today's scores (approximate).
//   Part D  the squeeze reading against each stock's own trailing 120 sessions.
//   Part E  seven slots from the universe.
//
// It writes summary.json in the run folder; tables.mjs renders it.
//
// USAGE: node scripts/experiments/setup-payoff/analyze.mjs [--run <dir>]

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapDailyRows } from '../../../api/_utils/marketDataCache.js';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { ALL_TICKERS } from '../../../api/_utils/rankingConfig.js';
import { calculateBollingerBands } from '../../../api/_utils/technicalCalculations.js';
import { addDecimal, multiplyDecimal, toDecimal, toNumber } from '../../../api/_utils/setupEvaluator/evidenceValues.js';
import { TF_SETUP_V1_THRESHOLDS } from '../../../api/_utils/setupEvaluator/thresholds.js';
import { classOf } from '../setup-frequency/analyze.mjs';
import {
  bootstrapMean, DEFINITIONS as D, die, mulberry32, FREQ_RUN, FUND_SECTOR, labelOf, MARKET_SYMBOL, mean, median, nextSessionOf, percentile,
  periodsOf, PROJECT_ROOT, readJson, runDirOf, SECTOR_FUNDS, sessionsBack, share, spread, UNIVERSE_SECTOR, uniq, writeJson, writeVerbGrep,
} from './lib.mjs';
import { readFileSync } from 'node:fs';

const U = ALL_TICKERS;
/** The compact record's fields, as enrich.mjs compares them with the frequency run's replay.json. */
const COMPACT_FIELDS = ['v', 'r', 'p', 'ps', 'rg', 'm', 'ok', 'rf', 'rfDate', 'd', 'dr', 'C', 'extLimit', 'dropped'];
const H = D.horizons;
const isValid = (cls) => cls.startsWith('valid_');
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

// ---- Cited code, checked as text at this HEAD (the archetype levels Part C and E apply) ----------------------------

const CITED = [
  { key: 'speculator', file: 'api/_utils/archetypeScoring.js', text: 'at least 3 stocks with ATR percentile above 0.80' },
  { key: 'fundamental', file: 'api/_utils/archetypeScoring.js', text: 'at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40.' },
  { key: 'preserver', file: 'api/_utils/archetypeScoring.js', text: 'at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75.' },
  { key: 'diversifier', file: 'api/_utils/archetypeScoring.js', text: 'MUST span at least 7 different sectors' },
  { key: 'trendFollower', file: 'api/_utils/archetypeScoring.js', text: "top 3 performing sectors. Avoid sectors down more than 1% today." },
  { key: 'bwPercentile', file: 'api/cron/compute-index-intelligence.js', text: 'Math.round((idx / (bwValues.length - 1)) * 100)' },
  { key: 'bbCall', file: 'api/cron/compute-index-intelligence.js', text: 'const bbResult = calculateBollingerBands(closes, 20, 2);' },
  { key: 'extensionGuard', file: 'api/_utils/setupEvaluator/tfSetupV1.js', text: 'const guard = isNum(SMA_fast) && isNum(ATR) ? toNumber(addDecimal(toDecimal(SMA_fast), multiplyDecimal(toDecimal(T.extensionGuardAtrMultiple), toDecimal(ATR)))) : null;' },
  { key: 'calendarMissing', file: 'api/_utils/setupEvaluator/dailyBarsAdapter.js', text: "return { ok: false, reason: 'calendar_missing'" },
  { key: 'adjacencySkipped', file: 'api/_utils/setupEvaluator/dailyBarsAdapter.js', text: 'if (!MAINTAINED_HOLIDAY_YEARS.includes(yearOf(newer)) || !MAINTAINED_HOLIDAY_YEARS.includes(yearOf(older))) { adjacencyAvailable = false; continue; }' },
  { key: 'maintainedYears', file: 'src/utils/marketCalendar.js', text: 'export const MAINTAINED_HOLIDAY_YEARS = [2026, 2027];' },
  { key: 'bandWidthFunction', file: 'api/_utils/technicalCalculations.js', text: 'export function calculateBollingerBands(closes, period = 20, stdDev = 2)' },
];
function citeLines() {
  const out = {};
  for (const c of CITED) {
    const lines = readFileSync(path.join(PROJECT_ROOT, c.file), 'utf8').split(/\r?\n/);
    const i = lines.findIndex((l) => l.includes(c.text));
    if (i < 0) die(`the cited text is gone from ${c.file}: ${c.text}`);
    out[c.key] = `${c.file}:${i + 1}`;
  }
  return out;
}

// ---- Loading --------------------------------------------------------------------------------------------------------

function loadEnriched(runDir, source) {
  const dir = path.join(runDir, 'enriched');
  const files = readdirSync(dir).filter((f) => f.startsWith(`${source}-`)).sort();
  const out = { bySymbol: {}, compared: 0, mismatches: 0, sessions: null, shards: files.length };
  for (const f of files) {
    const j = readJson(path.join(dir, f));
    // Strict merging (review SP-L2-2): every shard has the same sessions, and no symbol appears in two shards.
    if (out.sessions !== null && JSON.stringify(out.sessions) !== JSON.stringify(j.sessions)) die(`${source}: ${f} has different sessions from the other shards`);
    out.sessions = j.sessions;
    for (const sym of Object.keys(j.bySymbol)) if (out.bySymbol[sym]) die(`${source}: ${sym} appears in two shards (${f})`);
    out.compared += j.compared;
    out.mismatches += j.mismatches.length;
    Object.assign(out.bySymbol, j.bySymbol);
  }
  return out;
}

/**
 * Each record's stored extension limit must equal SMA_fast + multiple × ATR rebuilt from its own facts, in exact decimal
 * as the evaluator builds it (review SP-L2-2): this ties ATR and SMA_fast, which replay.json does not carry, to a value
 * it does. Returns the count of records checked and of records that disagree.
 */
function limitIdentity(bySymbol) {
  let checked = 0; let differ = 0;
  for (const bySession of Object.values(bySymbol)) {
    for (const r of Object.values(bySession)) {
      if (!fin(r.F) || !fin(r.A) || !fin(r.extLimit)) continue;
      checked += 1;
      if (decimalLimit(r.F, TF_SETUP_V1_THRESHOLDS.extensionGuardAtrMultiple, r.A) !== r.extLimit) differ += 1;
    }
  }
  return { checked, differ };
}

function loadBars(dir, symbols) {
  const rows = {};
  const payload = {};
  for (const s of symbols) {
    const f = readJson(path.join(dir, `${s}.json`));
    payload[s] = f.payload;
    rows[s] = {};
    for (const p of f.payload) rows[s][p.date] = p;
  }
  return { rows, payload };
}

// ---- Outcomes -------------------------------------------------------------------------------------------------------

const ratioOf = (row) => (row && row.close > 0 && row.adjusted_close > 0 ? row.adjusted_close / row.close : null);
function stepOf(a, b) {
  const x = ratioOf(a); const y = ratioOf(b);
  if (x === null || y === null) return null;
  return 1 - Math.min(x, y) / Math.max(x, y);
}

/** One (symbol, t) from the open of t+1: entry, unit, and per horizon the move, the barrier and the flags. */
function outcomeOf(rowsOfSym, rec, nexts, t) {
  const seq = [rowsOfSym[t] ?? null, ...nexts.map((d) => (d ? rowsOfSym[d] ?? null : null))];
  const b1 = seq[1];
  if (!b1 || !(b1.open > 0)) return null;
  const entry = b1.open;
  const u = rec.A / rec.C;
  const res = { entry, u };
  for (const h of H) {
    const bars = seq.slice(1, h + 1);
    if (bars.some((b) => !b)) { res[h] = { status: 'censored' }; continue; }
    let split = false; let div = false; let noRatio = false;
    for (let i = 0; i < h; i++) {
      const st = stepOf(seq[i], seq[i + 1]);
      if (st === null) noRatio = true;
      else if (st > D.splitStep) split = true;
      else if (st > D.dividendStep) div = true;
    }
    if (split) { res[h] = { status: 'split' }; continue; }
    const move = bars[h - 1].close / entry - 1;
    const up = entry * (1 + u);
    const down = entry * (1 - u);
    let bar = 'none'; let bothSame = false;
    for (const b of bars) {
      const hi = b.high >= up; const lo = b.low <= down;
      if (hi && lo) { bar = 'down'; bothSame = true; break; }
      if (lo) { bar = 'down'; break; }
      if (hi) { bar = 'up'; break; }
    }
    res[h] = { status: 'ok', mp: move * 100, mu: move / u, bar, bothSame, div, noRatio };
  }
  return res;
}

// ---- Arms, measures and the session-paired test ---------------------------------------------------------------------

/**
 * An arm is a function (x, t) → false | { limit } over a session's member list; `limit` null means no entry filter.
 * obsOf gives the value an arm member contributes at a horizon, or null when it contributes none.
 */
function obsOf(x, member, h, kind, { filter = true, exclDiv = false } = {}) {
  const o = x.o;
  if (!o) return null;
  if (filter && member.limit !== null && !(o.entry <= member.limit)) return null;
  const r = o[h];
  if (!r || r.status !== 'ok') return null;
  if (exclDiv && r.div) return null;
  return kind === 'u' ? r.mu : r.mp;
}

function measure(W, sessions, arm, { filter = true, pred = null } = {}) {
  const m = { events: 0, noNextOpen: 0, removedByEntry: 0, entered: 0, sessionsWithEvents: 0 };
  const per = {};
  for (const h of H) per[h] = { censored: 0, split: 0, div: 0, noRatio: 0, mu: [], mp: [], up: 0, down: 0, none: 0, bothSame: 0 };
  for (const t of sessions) {
    let any = false;
    for (const x of W.members[t]) {
      if (pred && !pred(x, t)) continue;
      const member = arm(x, t);
      if (!member) continue;
      m.events += 1; any = true;
      if (!x.o) { m.noNextOpen += 1; continue; }
      if (filter && member.limit !== null && !(x.o.entry <= member.limit)) { m.removedByEntry += 1; continue; }
      m.entered += 1;
      for (const h of H) {
        const r = x.o[h];
        const p = per[h];
        if (r.status === 'censored') { p.censored += 1; continue; }
        if (r.status === 'split') { p.split += 1; continue; }
        if (r.div) p.div += 1;
        if (r.noRatio) p.noRatio += 1;
        p.mu.push(r.mu); p.mp.push(r.mp);
        p[r.bar] += 1;
        if (r.bothSame) p.bothSame += 1;
      }
    }
    if (any) m.sessionsWithEvents += 1;
  }
  m.h = {};
  for (const h of H) {
    const p = per[h];
    const n = p.mu.length;
    m.h[h] = {
      n, censored: p.censored, split: p.split, div: p.div, noRatio: p.noRatio,
      meanPct: mean(p.mp), meanUnits: mean(p.mu), medianUnits: median(p.mu),
      atOrAbovePlus1: share(p.mu.filter((v) => v >= D.thresholdUnits).length, n),
      atOrBelowMinus1: share(p.mu.filter((v) => v <= -D.thresholdUnits).length, n),
      upFirst: share(p.up, n), downFirst: share(p.down, n), neither: share(p.none, n), bothSameSession: p.bothSame,
    };
  }
  return m;
}

function compare(W, sessions, armA, armB, h, kind, { filter = true, exclDiv = false, pred = null } = {}) {
  const diffs = [];
  const sessMeanA = []; const sessMeanB = [];
  let nA = 0; let nB = 0;
  for (const t of sessions) {
    const a = []; const b = [];
    for (const x of W.members[t]) {
      if (pred && !pred(x, t)) continue;
      const ma = armA(x, t);
      if (ma) { const v = obsOf(x, ma, h, kind, { filter, exclDiv }); if (v !== null) a.push(v); }
      const mb = armB(x, t);
      if (mb) { const v = obsOf(x, mb, h, kind, { filter, exclDiv }); if (v !== null) b.push(v); }
    }
    if (a.length === 0 || b.length === 0) continue;
    nA += a.length; nB += b.length;
    diffs.push(mean(a) - mean(b));
    sessMeanA.push(mean(a)); sessMeanB.push(mean(b));
  }
  const bs = bootstrapMean(diffs);
  // Added after the review (SP-L1-3, SP-L3-2): the two arms' means on the paired sessions, each session weighted
  // equally, so the estimate reads as their difference. Not a label; the fixed fields above are unchanged.
  const out = { sessions: bs.n, nA, nB, est: bs.est, lo: bs.lo, hi: bs.hi, label: labelOf(bs), small: nA < D.splits.small || nB < D.splits.small, sessionMeanA: mean(sessMeanA), sessionMeanB: mean(sessMeanB) };
  Object.defineProperty(out, 'diffs', { value: diffs, enumerable: false });
  return out;
}

/**
 * POST REVIEW (SP-L1-1), a sensitivity, not a label: a moving-block bootstrap of the per-session differences, so the
 * overlap of adjacent three-session windows is allowed for. Blocks of `block` consecutive sessions, wrapping at the
 * end (a circular block bootstrap); the same 2,000 resamples, seed and nearest-rank 5th / 95th as the fixed test.
 */
function blockInterval(values, block) {
  const n = values.length;
  if (n < block) return { block, lo: null, hi: null };
  const rnd = mulberry32(D.seed);
  const means = [];
  for (let r = 0; r < D.resamples; r++) {
    let sum = 0; let k = 0;
    while (k < n) { const start = Math.floor(rnd() * n); for (let j = 0; j < block && k < n; j++, k++) sum += values[(start + j) % n]; }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const at = (p) => means[Math.min(means.length, Math.max(1, Math.ceil((p / 100) * means.length))) - 1];
  return { block, lo: at(D.interval[0]), hi: at(D.interval[1]) };
}
function lag1(values) {
  const n = values.length; if (n < 3) return null;
  const m = mean(values); let num = 0; let den = 0;
  for (let i = 0; i < n; i++) { den += (values[i] - m) ** 2; if (i > 0) num += (values[i] - m) * (values[i - 1] - m); }
  return den > 0 ? num / den : null;
}

const PERIODS = ['dev', 'conf', 'whole'];
const sessionsOfPeriod = (W, p) => (p === 'whole' ? W.sessions : W[p]);

/** Every period × horizon × kind for one arm pair. */
function compareAll(W, armA, armB, opts = {}) {
  const out = {};
  for (const p of PERIODS) {
    out[p] = {};
    for (const h of H) for (const kind of ['u', 'p']) out[p][`${h}${kind}`] = compare(W, sessionsOfPeriod(W, p), armA, armB, h, kind, opts);
  }
  return out;
}

// ---- Part B limits --------------------------------------------------------------------------------------------------

/** base + k × ATR, exact in decimal, as the evaluator builds its guard (tfSetupV1.js, the extension guard). */
const decimalLimit = (base, k, atr) => (fin(base) && fin(atr) ? toNumber(addDecimal(toDecimal(base), multiplyDecimal(toDecimal(k), toDecimal(atr)))) : null);
function candidateLimit(c, rec) {
  if (c.kind === 'none') return null;
  return decimalLimit(c.kind === 'sma' ? rec.F : rec.H, Number(c.k), rec.A);
}
const breakoutBase = (rec) => Boolean(rec && rec.ok && rec.rg === 'uptrend' && rec.pb === 'satisfied' && fin(rec.C));
function candidateValid(c, rec) {
  if (!breakoutBase(rec)) return false;
  if (c.kind === 'none') return true;
  const lim = candidateLimit(c, rec);
  return lim !== null && rec.C <= lim;
}

// ---- Main -----------------------------------------------------------------------------------------------------------

async function main() {
  writeVerbGrep();
  const runDir = runDirOf(process.argv);
  const cites = citeLines();
  const exp = readJson(path.join(FREQ_RUN, 'export.json'));
  const repro = readJson(path.join(FREQ_RUN, 'reproduction.json'));
  const plan = readJson(path.join(FREQ_RUN, 'plan.json'));
  const summary = { definitions: D, cites, runDir };

  // ---- Step 0: reproduce the frequency count from the re-run, BEFORE anything the fetch produced is read (review
  // SP-L2-1). Every compact record is compared here with the frequency run's own replay.json, field for field, rather
  // than trusting each shard's self-report (review SP-L2-2). ----
  const stored = loadEnriched(runDir, 'stored');
  const S = stored.sessions;
  const freqReplay = readJson(path.join(FREQ_RUN, 'replay.json'));
  if (JSON.stringify(freqReplay.window.sessions) !== JSON.stringify(S)) die('the stored re-run and replay.json disagree on the window');
  let compactCompared = 0; let compactMismatches = 0;
  for (const sym of plan.all) {
    for (const s of S) {
      compactCompared += 1;
      const a = stored.bySymbol[sym]?.[s]; const b = freqReplay.bySymbol[sym]?.[s];
      if (!a || !b || COMPACT_FIELDS.some((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))) compactMismatches += 1;
    }
  }
  const recS = (sym, s) => stored.bySymbol[sym]?.[s];
  const validPerSession = S.map((s) => U.filter((sym) => isValid(classOf(recS(sym, s)))).length);
  let validBreakout = 0;
  for (const sym of U) for (const s of S) { const c = recS(sym, s); if (isValid(classOf(c)) && c.ps.includes('breakout')) validBreakout += 1; }
  const sameList = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  let storedMatched = 0;
  const storedDiffs = [];
  for (const r of exp.records) {
    const c = recS(r.symbol, r.session);
    const ok = c && c.v === r.verdict && (c.r ?? null) === (r.reason ?? null) && (c.p ?? null) === (r.pattern ?? null) && sameList(c.ps, r.patternsSatisfied);
    if (ok) storedMatched += 1; else storedDiffs.push({ symbol: r.symbol, session: r.session });
  }
  const step0 = {
    sessions: S.length, first: S[0], last: S.at(-1),
    medianValid: median(validPerSession), validBreakout, stockDays: U.length * S.length,
    storedRecords: exp.records.length, storedMatched, storedDiffs,
    compactEqual: { compared: compactCompared, mismatches: compactMismatches, shardsSelfReport: { compared: stored.compared, mismatches: stored.mismatches } },
    limitIdentity: limitIdentity(stored.bySymbol),
    frequencyRunReproduction: { compared: repro.compared, matched: repro.matched },
  };
  step0.pass = step0.medianValid === D.reproduce.medianValid && validBreakout === D.reproduce.validBreakout && step0.stockDays === D.reproduce.stockDays
    && storedMatched === D.reproduce.storedRecords && step0.storedRecords === D.reproduce.storedRecords
    && compactMismatches === 0 && compactCompared === plan.all.length * S.length && stored.mismatches === 0 && step0.limitIdentity.differ === 0;
  summary.step0 = step0;
  if (!step0.pass) {
    writeJson(path.join(runDir, 'summary.json'), summary);
    die(`STEP 0 DOES NOT REPRODUCE — STOP. ${JSON.stringify({ ...step0, storedDiffs: storedDiffs.length })}`);
  }
  console.log(`step 0 reproduced: median ${step0.medianValid}, valid breakouts ${validBreakout} of ${step0.stockDays}, stored ${storedMatched} of ${exp.records.length}, compact ${compactCompared - compactMismatches} of ${compactCompared}`);

  // ---- Only now: the fetch's outputs. Every plan symbol must have a fetched record at every long-window session. ----
  const requests = readJson(path.join(runDir, 'requests.json'));
  summary.requests = { made: requests.made, cap: requests.cap, from: requests.from, to: requests.to, failed: requests.log.filter((e) => !e.outcome.startsWith('rows:')).length, first: requests.log[0]?.requestedAt, last: requests.log.at(-1)?.requestedAt, rowCounts: tally(requests.log.map((e) => e.outcome)) };
  const ENR = { stored, fetched: loadEnriched(runDir, 'fetched') };
  const L = ENR.fetched.sessions;
  if (JSON.stringify(L) !== JSON.stringify(sessionsBack(D.window.lastSession, D.window.longMax))) die('the fetched re-run is not the long window');
  const uncovered = plan.all.reduce((n, sym) => n + L.filter((s) => !ENR.fetched.bySymbol[sym]?.[s]).length, 0);
  if (uncovered > 0) die(`the fetched re-run lacks ${uncovered} of ${plan.all.length * L.length} records`);
  summary.fetchedLimitIdentity = limitIdentity(ENR.fetched.bySymbol);
  if (summary.fetchedLimitIdentity.differ > 0) die(`the fetched re-run: ${summary.fetchedLimitIdentity.differ} records whose extension limit is not SMA_fast + 2 x ATR`);
  const BARS = { stored: loadBars(path.join(FREQ_RUN, 'bars'), plan.all), fetched: loadBars(path.join(runDir, 'bars'), plan.all) };

  // ---- The long window's overlap check ----
  const recF = (sym, s) => ENR.fetched.bySymbol[sym]?.[s];
  const overlap = { compared: 0, verdictFieldsDiffer: 0, diffs: [], factsDiffer: 0, limitDiffer: 0 };
  for (const sym of plan.all) {
    for (const s of S) {
      const a = recS(sym, s); const b = recF(sym, s);
      overlap.compared += 1;
      const differing = ['v', 'r', 'p', 'ps', 'rg', 'ok', 'rf'].filter((k) => JSON.stringify(a?.[k] ?? null) !== JSON.stringify(b?.[k] ?? null));
      if (differing.length > 0) { overlap.verdictFieldsDiffer += 1; overlap.diffs.push({ symbol: sym, session: s, differing, stored: { v: a?.v, r: a?.r, p: a?.p, ok: a?.ok, rf: a?.rf }, fetched: { v: b?.v, r: b?.r, p: b?.p, ok: b?.ok, rf: b?.rf } }); }
      if (['C', 'F', 'A', 'H'].some((k) => (a?.[k] ?? null) !== (b?.[k] ?? null))) overlap.factsDiffer += 1;
      if ((a?.extLimit ?? null) !== (b?.extLimit ?? null)) overlap.limitDiffer += 1;
    }
  }
  overlap.universeDiffs = overlap.diffs.filter((d) => U.includes(d.symbol)).length;
  summary.overlap = overlap;
  // The long window's earlier sessions: refusals by reason, and how many reach 2025 bars (no split adjacency check there).
  const early = L.filter((s) => s < S[0]);
  const refusals = {};
  for (const sym of U) for (const s of early) { const c = recF(sym, s); if (!c.ok) refusals[c.rf || 'unknown'] = (refusals[c.rf || 'unknown'] || 0) + 1; }
  summary.longWindow = { sessions: L.length, first: L[0], last: L.at(-1), fetchedSessions: early.length, refusalsBeforeOverlap: refusals, sessionsWhoseBarsReach2025: L.filter((s) => (recF(MARKET_SYMBOL, s)?.n55 ?? '9999') < '2026-01-01').length };
  // Added after the first results (a disclosure, not a definition): the adapter's missing-bar check is not available for
  // rows dated 2025 (outside the maintained years), so a gap there would not be refused. Each universe series is compared
  // date by date with SPY's over the 2025 rows the long window's 55-bar windows read.
  {
    const oldest = L.map((s) => recF(MARKET_SYMBOL, s)?.n55).filter(Boolean).sort()[0];
    const spyDates = Object.keys(BARS.fetched.rows[MARKET_SYMBOL]).filter((d) => d >= oldest && d < '2026-01-01');
    let missing = 0; let extra = 0; const symbolsWithGap = [];
    for (const sym of U) {
      const own = Object.keys(BARS.fetched.rows[sym]).filter((d) => d >= oldest && d < '2026-01-01');
      const miss = spyDates.filter((d) => !BARS.fetched.rows[sym][d]).length;
      const ext = own.filter((d) => !BARS.fetched.rows[MARKET_SYMBOL][d]).length;
      missing += miss; extra += ext;
      if (miss + ext > 0) symbolsWithGap.push(sym);
    }
    summary.longWindow.gaps2025 = { from: oldest, to: '2025-12-31', spyRows: spyDates.length, missingAgainstSpy: missing, extraAgainstSpy: extra, symbolsWithGap };
  }

  // ---- Windows ----
  const NEXT = {};
  for (const s of L) { const n1 = nextSessionOf(s); const n2 = n1 ? nextSessionOf(n1) : null; const n3 = n2 ? nextSessionOf(n2) : null; NEXT[s] = [n1, n2, n3]; }
  const score = {};
  for (const r of exp.rankings) score[r.symbol] = r;
  function buildWindow(name, sessions, srcOf) {
    const W = { name, sessions, srcOf, ...periodsOf(sessions), idx: {}, members: {} };
    sessions.forEach((s, i) => { W.idx[s] = i; });
    const rec = (sym, s) => ENR[srcOf(s)].bySymbol[sym]?.[s];
    W.rec = rec;
    for (let i = 0; i < sessions.length; i++) {
      const t = sessions[i];
      const prev = i > 0 ? sessions[i - 1] : null;
      W.members[t] = U.map((sym) => {
        const r = rec(sym, t);
        const cls = classOf(r);
        const hasFacts = Boolean(r && r.ok && fin(r.C) && r.C > 0 && fin(r.A) && r.A > 0 && fin(r.extLimit));
        const pr = prev ? rec(sym, prev) : null;
        return { sym, rec: r, cls, hasFacts, prevKnown: prev !== null, prevRec: pr, prevValid: pr ? isValid(classOf(pr)) : false, o: hasFacts ? outcomeOf(BARS[srcOf(t)].rows[sym], r, NEXT[t], t) : null };
      });
      // The volatility third, per session, among the G1 records.
      const g1 = W.members[t].filter((x) => x.hasFacts).sort((a, b) => (a.rec.A / a.rec.C) - (b.rec.A / b.rec.C) || (a.sym < b.sym ? -1 : 1));
      g1.forEach((x, k) => { x.third = Math.floor((3 * k) / g1.length); });
    }
    return W;
  }
  const WS = {
    short: buildWindow('short', S, () => 'stored'),
    long: buildWindow('long', L, (s) => (s >= S[0] ? 'stored' : 'fetched')),
  };

  // ---- Part A ----
  const ARM = {
    validFirst: (x) => (x.hasFacts && x.cls === 'valid_pullback' && x.prevKnown && !x.prevValid ? { limit: x.rec.extLimit } : false),
    validEvery: (x) => (x.hasFacts && x.cls === 'valid_pullback' ? { limit: x.rec.extLimit } : false),
    G1: (x) => (x.hasFacts ? { limit: x.rec.extLimit } : false),
    G2: (x) => (x.hasFacts && x.rec.v === 'invalid' && x.rec.r === 'no_setup' ? { limit: x.rec.extLimit } : false),
    G3: (x) => (x.hasFacts && x.rec.v === 'invalid' && x.rec.r === 'extended' ? { limit: x.rec.extLimit } : false),
  };
  const spyRegime = (W, t) => W.rec(MARKET_SYMBOL, t)?.rg ?? 'unknown';
  const SPLITS = [
    ...['uptrend', 'no_trend', 'downtrend'].map((rg) => ({ id: `spy_${rg}`, group: 'SPY regime', pred: (W) => (x, t) => spyRegime(W, t) === rg })),
    ...[0, 1, 2].map((k) => ({ id: `vol_${['low', 'mid', 'high'][k]}`, group: 'volatility third', pred: () => (x) => x.third === k })),
    { id: 'speculator', group: 'archetype rule', pred: () => (x) => score[x.sym]?.atrPercentile > D.speculatorAtr },
    { id: 'preserver', group: 'archetype rule', pred: () => (x) => score[x.sym]?.fundamentalScore > D.preserverScore && score[x.sym]?.atrPercentile <= D.preserverAtrMax },
    { id: 'fi40', group: 'archetype rule', pred: () => (x) => score[x.sym]?.fundamentalScore >= 40 },
    { id: 'fi70', group: 'archetype rule', pred: () => (x) => score[x.sym]?.fundamentalScore > D.fundamentalTop },
  ];
  summary.partA = {};
  for (const W of Object.values(WS)) {
    const A = { sessions: W.sessions.length, dev: W.dev.length, conf: W.conf.length, first: W.sessions[0], last: W.sessions.at(-1), measures: {}, tests: {}, splits: {} };
    for (const p of PERIODS) {
      const ss = sessionsOfPeriod(W, p);
      const eventSessions = ss.filter((t) => W.members[t].some((x) => ARM.validFirst(x, t)));
      A.measures[p] = {};
      for (const [armName, filter] of [['validFirst', true], ['validEvery', true], ['validFirst', false]]) {
        A.measures[p][`${armName}${filter ? '' : '_unfiltered'}`] = measure(W, ss, ARM[armName], { filter });
      }
      for (const g of ['G1', 'G2', 'G3']) {
        A.measures[p][g] = measure(W, eventSessions, ARM[g], { filter: true });
        A.measures[p][`${g}_unfiltered`] = measure(W, eventSessions, ARM[g], { filter: false });
      }
    }
    for (const g of ['G1', 'G2', 'G3']) {
      A.tests[`validFirst_vs_${g}`] = compareAll(W, ARM.validFirst, ARM[g]);
      A.tests[`validEvery_vs_${g}`] = compareAll(W, ARM.validEvery, ARM[g]);
      A.tests[`validFirst_vs_${g}_unfiltered`] = compareAll(W, ARM.validFirst, ARM[g], { filter: false });
    }
    A.tests.headline_exclDividendSteps = compareAll(W, ARM.validFirst, ARM.G2, { exclDiv: true });
    for (const sp of SPLITS) {
      const pred = sp.pred(W);
      const counts = {};
      for (const p of PERIODS) counts[p] = { events: measure(W, sessionsOfPeriod(W, p), ARM.validFirst, { pred }).entered };
      A.splits[sp.id] = { group: sp.group, counts, vsG2: compareAll(W, ARM.validFirst, ARM.G2, { pred }), vsG1: compareAll(W, ARM.validFirst, ARM.G1, { pred }) };
    }
    summary.partA[W.name] = A;
  }
  // POST HOC (added after the first results were seen; not one of the fixed labels): the long window's sessions before
  // the short window, 2 Jan – 28 May, the only stretch the fetch adds. Same arms, same test, same words.
  {
    const W = WS.long;
    const pre = W.sessions.filter((s) => s < S[0]);
    const out = { sessions: pre.length, first: pre[0], last: pre.at(-1), tests: {}, measures: { validFirst: measure(W, pre, ARM.validFirst), G1: null, G2: null } };
    const eventSessions = pre.filter((t) => W.members[t].some((x) => ARM.validFirst(x, t)));
    out.measures.G1 = measure(W, eventSessions, ARM.G1);
    out.measures.G2 = measure(W, eventSessions, ARM.G2);
    for (const g of ['G1', 'G2', 'G3']) {
      out.tests[`validFirst_vs_${g}`] = {};
      for (const h of H) for (const kind of ['u', 'p']) out.tests[`validFirst_vs_${g}`][`${h}${kind}`] = compare(W, pre, ARM.validFirst, ARM[g], h, kind);
    }
    summary.postHocJanToMay = out;
  }
  // POST REVIEW (SP-L1-1): the overlap sensitivity for the headline comparisons and the post-hoc row.
  {
    const rows = [];
    const add = (label, t) => rows.push({ label, est: t.est, wholeSession: [t.lo, t.hi], label90: t.label, lag1: lag1(t.diffs), block3: blockInterval(t.diffs, 3), block5: blockInterval(t.diffs, 5) });
    for (const [wn, W] of Object.entries(WS)) for (const p of PERIODS) {
      add(`${wn} ${p} event vs G2, 3-session units`, compare(W, sessionsOfPeriod(W, p), ARM.validFirst, ARM.G2, 3, 'u'));
      add(`${wn} ${p} event vs G1, 1-session units`, compare(W, sessionsOfPeriod(W, p), ARM.validFirst, ARM.G1, 1, 'u'));
    }
    const pre = WS.long.sessions.filter((s) => s < S[0]);
    add('post hoc Jan-May event vs G2, 3-session units', compare(WS.long, pre, ARM.validFirst, ARM.G2, 3, 'u'));
    add('post hoc Jan-May event vs G2, 3-session percent', compare(WS.long, pre, ARM.validFirst, ARM.G2, 3, 'p'));
    summary.overlapSensitivity = rows;
  }

  // ---- Part B ----
  summary.partB = {};
  for (const W of Object.values(WS)) {
    const B = { base: {}, l0Check: { base: 0, agree: 0, limitEqual: 0, validUnderL0: 0 }, candidates: {} };
    for (const t of W.sessions) for (const x of W.members[t]) {
      if (!breakoutBase(x.rec)) continue;
      B.l0Check.base += 1;
      const l0 = candidateLimit(D.candidates[0], x.rec);
      if ((l0 !== null && x.rec.C <= l0) === (x.rec.x === true)) B.l0Check.agree += 1;
      if (l0 === x.rec.extLimit) B.l0Check.limitEqual += 1;
      if (candidateValid(D.candidates[0], x.rec)) B.l0Check.validUnderL0 += 1;
    }
    let anyRegimeBreakout = 0;
    for (const t of W.sessions) for (const x of W.members[t]) if (x.rec?.ok && x.rec.pb === 'satisfied') anyRegimeBreakout += 1;
    B.base = { uptrendBreakoutSatisfied: B.l0Check.base, breakoutSatisfiedAnyRegime: anyRegimeBreakout };
    // Added after the review (SP-L3-14): the base by period.
    B.baseByPeriod = Object.fromEntries(PERIODS.map((p) => [p, sessionsOfPeriod(W, p).reduce((n, t) => n + W.members[t].filter((x) => breakoutBase(x.rec)).length, 0)]));
    for (const c of D.candidates) {
      // Each record's verdict and limit under the candidate, computed once.
      const cv = {};
      for (const t of W.sessions) { cv[t] = {}; for (const x of W.members[t]) cv[t][x.sym] = candidateValid(c, x.rec) ? { limit: candidateLimit(c, x.rec) } : false; }
      const arm = (x, t) => {
        const i = W.idx[t];
        if (!x.hasFacts || !cv[t][x.sym] || i === 0) return false;
        if (cv[W.sessions[i - 1]][x.sym]) return false;
        return cv[t][x.sym];
      };
      const perMorning = {};
      for (const p of PERIODS) {
        const counts = sessionsOfPeriod(W, p).map((t) => W.members[t].filter((x) => cv[t][x.sym]).length);
        perMorning[p] = { ...spread(counts), noneShare: share(counts.filter((v) => v === 0).length, counts.length), stockDays: counts.reduce((a, b) => a + b, 0) };
      }
      const measures = {};
      for (const p of PERIODS) measures[p] = measure(W, sessionsOfPeriod(W, p), arm, { filter: true });
      B.candidates[c.id] = { candidate: c, perMorning, measures, vsG2: compareAll(W, arm, ARM.G2), vsG1: compareAll(W, arm, ARM.G1) };
    }
    // The recommendation, by the rule fixed in advance, on development data only.
    const order = D.candidates.map((c, i) => ({ id: c.id, i, devDays: B.candidates[c.id].perMorning.dev.stockDays })).sort((a, b) => a.devDays - b.devDays || a.i - b.i);
    const qualifies = (id, reading) => {
      const k = B.candidates[id];
      const t3 = k.vsG2.dev['3u'];
      const enough = k.perMorning.dev.median >= D.minMedianBreakouts;
      const notBelow = reading === 'estimate' ? t3.est !== null && t3.est >= 0 : t3.hi !== null && !(t3.hi < 0);
      return enough && notBelow;
    };
    B.tightness = order.map((o) => o.id);
    B.recommendation = { estimateReading: order.find((o) => qualifies(o.id, 'estimate'))?.id ?? null, intervalReading: order.find((o) => qualifies(o.id, 'interval'))?.id ?? null };
    summary.partB[W.name] = B;
  }

  // ---- Part C ----
  const scores = U.map((s) => score[s]?.fundamentalScore).filter(fin);
  const atrs = U.map((s) => score[s]?.atrPercentile).filter(fin);
  const bins = {};
  for (const v of scores) { const b = Math.min(90, Math.floor(v / 10) * 10); bins[b] = (bins[b] || 0) + 1; }
  const GATES_C = [
    ...D.scoreLevels.map((lv) => ({ id: `score>=${lv}`, test: (s) => score[s]?.fundamentalScore >= lv })),
    { id: 'score>70 (FI code)', test: (s) => score[s]?.fundamentalScore > D.fundamentalTop },
    { id: 'CP: score>60', test: (s) => score[s]?.fundamentalScore > D.preserverScore },
    { id: 'CP: atrPct<=0.75', test: (s) => score[s]?.atrPercentile <= D.preserverAtrMax },
    { id: 'CP: both', test: (s) => score[s]?.fundamentalScore > D.preserverScore && score[s]?.atrPercentile <= D.preserverAtrMax },
    { id: 'Speculator: atrPct>0.80', test: (s) => score[s]?.atrPercentile > D.speculatorAtr },
  ];
  summary.partC = {
    label: 'today\'s scores, approximate', computedAt: exp.rankingsMeta?.computedAt ?? null, matched: U.filter((s) => score[s]).length,
    scoreSpread: { n: scores.length, min: Math.min(...scores), max: Math.max(...scores), median: median(scores), deciles: [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => percentile(scores, p)), bins },
    atrSpread: { n: atrs.length, median: median(atrs) },
    gates: {},
  };
  for (const g of GATES_C) {
    const names = U.filter(g.test);
    const perWindow = {};
    for (const W of Object.values(WS)) {
      perWindow[W.name] = {};
      for (const p of PERIODS) {
        const counts = sessionsOfPeriod(W, p).map((t) => W.members[t].filter((x) => isValid(x.cls) && g.test(x.sym)).length);
        perWindow[W.name][p] = { ...spread(counts), noneShare: share(counts.filter((v) => v === 0).length, counts.length) };
      }
    }
    summary.partC.gates[g.id] = { stocks: names.length, perMorningValid: perWindow };
  }

  // ---- Part D ----
  function bandWidths(payload) {
    const rows = mapDailyRows(payload.map((r) => ({ ...r }))).rows; // newest first, close = adjusted
    const closes = rows.map((r) => r.close);
    const out = {};
    rows.forEach((r, i) => {
      if (i + 20 > closes.length) return;
      const bb = calculateBollingerBands(closes.slice(i, i + 20), 20, 2);
      if (bb && fin(bb.bandwidth)) out[r.date] = { i, bw: bb.bandwidth };
    });
    return { rows, out };
  }
  function squeezeFor(W, src) {
    const perSession = [];
    const cache = {};
    for (const sym of U) cache[sym] = bandWidths(BARS[src].payload[sym]);
    for (const t of W.sessions) {
      let flagged = 0; let eligible = 0;
      for (const sym of U) {
        const { rows, out } = cache[sym];
        const at = out[t];
        if (!at) continue;
        const trail = rows.slice(at.i, at.i + D.squeezeTrailing).map((r) => out[r.date]?.bw);
        if (trail.length < D.squeezeTrailing || trail.some((v) => !fin(v))) continue;
        eligible += 1;
        const idx = trail.slice(1).filter((v) => v < at.bw).length;
        if (Math.round((idx / (D.squeezeTrailing - 1)) * 100) <= D.squeezePct) flagged += 1;
      }
      perSession.push({ session: t, flagged, eligible });
    }
    const full = perSession.filter((r) => r.eligible === U.length);
    const weeks = {};
    for (const r of full) { const w = weekOf(r.session); (weeks[w] = weeks[w] || []).push(r.flagged); }
    const byPeriod = {};
    for (const p of PERIODS) { const ss = sessionsOfPeriod(W, p); const rows = full.filter((r) => ss.includes(r.session)); byPeriod[p] = { sessions: rows.length, ...spread(rows.map((r) => r.flagged)) }; }
    return { source: src, sessionsWithFullHistory: full.length, sessionsWithoutFullHistory: perSession.length - full.length, eligibleRange: [Math.min(...perSession.map((r) => r.eligible)), Math.max(...perSession.map((r) => r.eligible))], byPeriod, weekly: Object.entries(weeks).map(([week, xs]) => ({ week, sessions: xs.length, median: median(xs), min: Math.min(...xs), max: Math.max(...xs) })), perSession };
  }
  summary.partD = { label: 'a precondition only', short: squeezeFor(WS.short, 'stored'), long: squeezeFor(WS.long, 'fetched') };
  // The two sources on the SAME sessions: those the short window counts (changed after the first results, which put the
  // long source's 120 sessions beside the short source's 90).
  {
    const counted = summary.partD.short.perSession.filter((r) => r.eligible === U.length);
    const longBy = {};
    for (const r of summary.partD.long.perSession) longBy[r.session] = r.flagged;
    const diffs = counted.map((r) => longBy[r.session] - r.flagged);
    summary.partD.sameSessions = { sessions: counted.length, stored: spread(counted.map((r) => r.flagged)), fetched: spread(counted.map((r) => longBy[r.session])), sessionsDiffering: diffs.filter((d) => d !== 0).length, largestDifference: Math.max(...diffs.map(Math.abs)) };
  }

  // ---- Part E ----
  const fundClose = { stored: {}, fetched: {} };
  for (const src of ['stored', 'fetched']) for (const f of SECTOR_FUNDS) { fundClose[src][f] = {}; for (const r of mapDailyRows(BARS[src].payload[f].map((x) => ({ ...x }))).rows) fundClose[src][f][r.date] = r.close; }
  const leadersOf = (W, t) => {
    const prev = getSessionForDate(t)?.previousEtDate ?? null;
    const fc = fundClose[W.srcOf(t)];
    const moves = SECTOR_FUNDS.map((f) => ({ f, m: fc[f][t] / fc[f][prev] - 1 })).filter((x) => fin(x.m)).sort((a, b) => b.m - a.m);
    return moves.slice(0, 3).filter((x) => x.m >= -0.01).map((x) => FUND_SECTOR[x.f]);
  };
  const GATES_E = [
    { id: 'Trend Follower (no gate)', test: () => true },
    { id: 'Trend Follower (top sectors)', test: (sym, t, ctx) => ctx.leaders.includes(UNIVERSE_SECTOR[sym]) },
    { id: 'Speculator', test: (sym) => score[sym]?.atrPercentile > D.speculatorAtr },
    { id: 'Fundamental Investor (>=40)', test: (sym) => score[sym]?.fundamentalScore >= 40 },
    { id: 'Fundamental Investor (>70)', test: (sym) => score[sym]?.fundamentalScore > D.fundamentalTop },
    { id: 'Capital Preserver', test: (sym) => score[sym]?.fundamentalScore > D.preserverScore && score[sym]?.atrPercentile <= D.preserverAtrMax },
    { id: 'Capital Preserver (6 sectors)', test: (sym) => score[sym]?.fundamentalScore > D.preserverScore && score[sym]?.atrPercentile <= D.preserverAtrMax, fill: (names) => Math.min(D.slots, names.length, sectorsOf(names) + 1) },
    { id: 'Diversifier (5 sectors)', test: () => true, fill: (names) => Math.min(D.slots, names.length, sectorsOf(names) + 2) },
    { id: 'Diversifier (code: 7 sectors)', test: () => true, fill: (names) => Math.min(D.slots, names.length, sectorsOf(names)) },
  ];
  summary.partE = {};
  for (const W of Object.values(WS)) {
    const E = { mornings: 0, readings: {} };
    const validAt = (sym, i) => i >= 0 && isValid(classOf(W.rec(sym, W.sessions[i])));
    const turnedAt = (sym, i) => i >= 1 && validAt(sym, i) && !validAt(sym, i - 1);
    const fills = {};
    for (const rd of Object.keys(D.slotReadings)) { fills[rd] = {}; for (const g of GATES_E) fills[rd][g.id] = []; }
    const morningPeriod = [];
    const quota = { speculator: [], fundamental: [], preserver: [] };
    for (let i = 3; i < W.sessions.length - 1; i++) {
      const t = W.sessions[i];
      E.mornings += 1;
      morningPeriod.push(W.period[t]);
      const ctx = { leaders: leadersOf(W, t) };
      const enterable = (x) => x.o !== null && x.hasFacts && x.o.entry <= x.rec.extLimit;
      const sets = {
        literal: W.members[t].filter((x) => isValid(x.cls) && enterable(x)).map((x) => x.sym),
        firstDay: W.members[t].filter((x) => isValid(x.cls) && enterable(x) && !validAt(x.sym, i - 1)).map((x) => x.sym),
        shelf3: W.members[t].filter((x) => isValid(x.cls) && enterable(x) && (turnedAt(x.sym, i) || turnedAt(x.sym, i - 1) || turnedAt(x.sym, i - 2))).map((x) => x.sym),
      };
      for (const rd of Object.keys(sets)) for (const g of GATES_E) {
        const names = sets[rd].filter((sym) => g.test(sym, t, ctx));
        fills[rd][g.id].push(g.fill ? g.fill(names) : Math.min(D.slots, names.length));
      }
      // POST REVIEW (SP-L3-4), a second reading, not a fixed figure: the code's levels read as quotas over the seven
      // slots ("at least N stocks with …", archetypeScoring.js:89, :91, :93) instead of a gate on every slot. A name
      // must pass the per-name rule (the Fundamental Investor's "exclude below 40", the Capital Preserver's "avoid ATR
      // percentile above 0.75"); when fewer than N valid names meet the quota level, the missing ones must be names with
      // no setup, so valid setups fill at most 7 - (N - met). The Capital Preserver's sector rule is not applied here.
      const quotaFill = (perName, meets, quota) => {
        const pn = sets.literal.filter(perName);
        const met = pn.filter(meets).length;
        return met >= quota ? Math.min(D.slots, pn.length) : Math.min(pn.length, D.slots - (quota - met));
      };
      quota.speculator.push(quotaFill(() => true, (s) => score[s]?.atrPercentile > D.speculatorAtr, 3));
      quota.fundamental.push(quotaFill((s) => score[s]?.fundamentalScore >= 40, (s) => score[s]?.fundamentalScore > D.fundamentalTop, 5));
      quota.preserver.push(quotaFill((s) => score[s]?.atrPercentile <= D.preserverAtrMax, (s) => score[s]?.fundamentalScore > D.preserverScore, 5));
    }
    E.quotaReading = {};
    for (const [k, xs0] of Object.entries(quota)) {
      E.quotaReading[k] = {};
      for (const p of PERIODS) {
        const xs = xs0.filter((_, j) => p === 'whole' || morningPeriod[j] === p);
        E.quotaReading[k][p] = { mornings: xs.length, median: median(xs), all7: share(xs.filter((v) => v >= D.slots).length, xs.length), atLeast4: share(xs.filter((v) => v >= 4).length, xs.length), none: share(xs.filter((v) => v === 0).length, xs.length) };
      }
    }
    for (const rd of Object.keys(fills)) {
      E.readings[rd] = {};
      for (const g of GATES_E) {
        E.readings[rd][g.id] = {};
        for (const p of PERIODS) {
          const xs = fills[rd][g.id].filter((_, k) => p === 'whole' || morningPeriod[k] === p);
          E.readings[rd][g.id][p] = { mornings: xs.length, median: median(xs), all7: share(xs.filter((v) => v >= D.slots).length, xs.length), atLeast4: share(xs.filter((v) => v >= 4).length, xs.length), none: share(xs.filter((v) => v === 0).length, xs.length) };
        }
      }
    }
    summary.partE[W.name] = E;
  }

  writeJson(path.join(runDir, 'summary.json'), summary);
  console.log(`wrote ${path.join(runDir, 'summary.json')}`);
}

function sectorsOf(names) { return uniq(names.map((s) => UNIVERSE_SECTOR[s] || 'Unknown')).length; }
function weekOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}
function tally(xs) { const o = {}; for (const x of xs) o[x] = (o[x] || 0) + 1; return o; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
