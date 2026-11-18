#!/usr/bin/env node
// scripts/experiments/setup-frequency/analyze.mjs
//
// Setup frequency count — THE COUNTS (prompt §3–§6). Offline and deterministic once export.json, replay.json,
// reproduction.json and bars/ exist. It counts setups; it computes no outcome, return or points figure. Its one use of
// a price change is the sector funds' one-day move, which the Trend Follower overlay needs to name "today's top
// sectors" (see SECTOR LEADERS below).
//
// EVIDENCE CLASSES (§2): every figure carries one. `reconstructed` = the replay over bars fetched on the run day;
// `contemporaneous` = the sweep's stored records, written from bars available at the time (their own
// evidenceClass.bars says so; a stored record of another class would be reported apart).
//
// THE ARCHETYPE CONSTRAINTS (§5) are prompt text in the fenced api/_utils/archetypeScoring.js (ARCHETYPE_CONSTRAINTS),
// read here AS TEXT and never imported: each level below is asserted present on its line, and the line is cited.
// SECTOR LEADERS: no code computes "today's top 3 performing sectors" — the model reads it off its prompt. This count
// stands in the three sector funds (the universe's own grouping, rankingConfig.js STOCK_UNIVERSE) with the highest
// one-day move at the session, and drops any of them down more than 1% (the same constraint's second sentence).
//
// USAGE: node scripts/experiments/setup-frequency/analyze.mjs [--run <dir>]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapDailyRows } from '../../../api/_utils/marketDataCache.js';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { ALL_TICKERS } from '../../../api/_utils/rankingConfig.js';
import { bump, die, exists, FUND_SECTOR, MARKET_SYMBOL, median, nextSessionOf, PROJECT_ROOT, readJson, runDirOf, SECTOR_FUNDS, share, spread, UNIVERSE_SECTOR, uniq, writeJson, writeVerbGrep } from './lib.mjs';

// ---- The cited code, checked as text --------------------------------------------------------------------------------

const CITED = [
  { file: 'api/_utils/archetypeScoring.js', key: 'tf_top_sectors', text: "at least 5 stocks from today\\'s top 3 performing sectors. Avoid sectors down more than 1% today." },
  { file: 'api/_utils/archetypeScoring.js', key: 'speculator_atr', text: 'at least 3 stocks with ATR percentile above 0.80' },
  { file: 'api/_utils/archetypeScoring.js', key: 'fundamental_score', text: 'at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40.' },
  { file: 'api/_utils/archetypeScoring.js', key: 'preserver', text: 'at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75.' },
  { file: 'api/_utils/archetypeScoring.js', key: 'diversifier', text: 'MUST span at least 7 different sectors' },
  { file: 'api/_utils/agentTriggerGate.js', key: 'squeeze_alarm', text: 'rankInfo.bBandwidthPercentile != null && rankInfo.bBandwidthPercentile <= 20' },
  { file: 'api/cron/compute-index-intelligence.js', key: 'bw_percentile', text: 'Math.round((idx / (bwValues.length - 1)) * 100)' },
  { file: 'api/cron/compute-index-intelligence.js', key: 'nr7_call', text: 'const nr7Result = calculateNR7(highs, lows);' },
  { file: 'api/cron/compute-index-intelligence.js', key: 'bb_call', text: 'const bbResult = calculateBollingerBands(closes, 20, 2);' },
  { file: 'src/data/archetypeDisplay.js', key: 'display_names', text: "momentum_chaser: 'Trend Follower'," },
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
const SPECULATOR_ATR = 0.80;
const FUNDAMENTAL_SCORE = 70;
const PRESERVER_SCORE = 60;
const PRESERVER_ATR_MAX = 0.75;
const DIVERSIFIER_SECTORS = 7;
const TF_TOP_SECTORS = 3;
const TF_SECTOR_FLOOR = -0.01;
const SQUEEZE_PERCENTILE = 20;

// ---- Classes --------------------------------------------------------------------------------------------------------

/** One record's class (the Step 2 table's rows). Works on a replay compact and on a stored record alike. */
export function classOf(c) {
  if (!c) return 'not_evaluated';
  if (c.failure) return `failure:${c.failure}`;
  if (c.ok === false) return `refused:${c.rf}`;
  if (c.v === 'valid') {
    if (c.ps.includes('breakout') && c.ps.includes('pullback_resume')) return 'valid_both';
    return c.p === 'breakout' ? 'valid_breakout' : 'valid_pullback';
  }
  if (c.v === 'invalid') return `invalid_${c.r}`;
  if (c.r === 'insufficient_history') return 'unknown:insufficient_history';
  return `unknown:${(c.m || []).join('+') || 'none'}`;
}
const isValid = (cls) => cls.startsWith('valid_');

/** A stored record in the compact's shape. */
function compactOfRecord(r) {
  return { v: r.verdict, r: r.reason, p: r.pattern, ps: r.patternsSatisfied || [], rg: r.regime, m: r.missing || [], ok: r.status === 'ok', rf: r.refusal?.reason ?? null, extLimit: r.extLimit };
}

/** One session's universe tally from a symbol → compact lookup. */
function universeTally(lookup, symbols) {
  const classes = {};
  const sectors = {};
  let valid = 0; let breakout = 0; let pullback = 0; let both = 0; let uptrend = 0; let evaluated = 0;
  for (const s of symbols) {
    const c = lookup(s);
    const cls = classOf(c);
    bump(classes, cls);
    if (c) evaluated += 1;
    if (c?.rg === 'uptrend') uptrend += 1;
    if (!isValid(cls)) continue;
    valid += 1;
    if (c.ps.includes('breakout')) breakout += 1;
    if (c.ps.includes('pullback_resume')) pullback += 1;
    if (cls === 'valid_both') both += 1;
    sectors[UNIVERSE_SECTOR[s] || 'Unknown'] = true;
  }
  return { classes, valid, breakout, pullback, both, uptrend, evaluated, sectors: Object.keys(sectors).length, validSymbols: symbols.filter((s) => isValid(classOf(lookup(s)))) };
}

function bandOf(values) {
  return { ...spread(values), under7: share(values.filter((v) => v < 7).length, values.length), under3: share(values.filter((v) => v < 3).length, values.length) };
}

/** Monday (UTC calendar) of a date's week. */
function weekOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

/** The deploy step's bench: exactly three stocks (api/agent/decide.js:1173, "Bench must have exactly 3 stocks"). */
export const CREATION_BENCH_STOCKS = 3;

/**
 * The battle's list at creation: the frozen starting book, and the bench at creation recovered from the revolving bench
 * (`portfolio.bench` is rewritten by every swap; no trade records where its incoming name came from). A final-bench
 * name no swap touched was on the bench from the start. The rest of the three places are filled by names that were
 * swapped in: when exactly that many such names exist the bench is identified; when more exist it is bounded.
 */
export function battleListOf(b) {
  const book = uniq(b.book.filter((a) => !a.crypto && a.symbol).map((a) => a.symbol));
  const crypto = [...b.book.filter((a) => a.crypto), ...b.bench.filter((a) => a.crypto)].length + (b.benchCrypto ? 1 : 0);
  const stockTrades = b.trades.filter((t) => !t.crypto);
  const swappedIn = uniq(stockTrades.map((t) => t.in).filter(Boolean));
  const swappedOut = uniq(stockTrades.map((t) => t.out).filter(Boolean));
  const finalBench = uniq(b.bench.filter((a) => !a.crypto && a.symbol).map((a) => a.symbol));
  const untouched = finalBench.filter((s) => !book.includes(s) && !swappedIn.includes(s) && !swappedOut.includes(s));
  const swappedInElsewhere = swappedIn.filter((s) => !book.includes(s) && !untouched.includes(s));
  const slots = CREATION_BENCH_STOCKS - untouched.length;
  const truncated = Number.isInteger(b.tradeCount) && b.tradeCount > b.trades.length;
  let kind;
  if (truncated || slots < 0 || swappedInElsewhere.length < slots) kind = 'anomaly';
  else if (b.trades.length === 0) kind = 'exact';
  else if (slots === 0 || swappedInElsewhere.length === slots) kind = 'identified'; // three untouched: every swap-in came from elsewhere
  else kind = 'bounded';
  // The names that may have filled the open places: all of them when the count fits, none when no place is open.
  const candidates = kind === 'bounded' || kind === 'identified' ? (slots === 0 ? [] : swappedInElsewhere) : [];
  const sectorOf = {};
  for (const a of [...b.book, ...b.bench]) if (a.symbol && a.sector) sectorOf[a.symbol] = a.sector;
  return { definite: uniq([...book, ...untouched]), candidates, slots: Math.max(0, slots), bookSize: book.length, crypto, kind, swapInsFromElsewhere: slots === 0 ? swappedInElsewhere.length : null, sectorOf };
}

/** Valid, unknown and sectors for a battle list at a session: one number when the list is resolved, a range when bounded. */
function battleCountsOf(list, lookup) {
  const cls = (s) => classOf(lookup(s));
  const isUnknown = (c) => !isValid(c) && !c.startsWith('invalid_');
  const dv = list.definite.filter((s) => isValid(cls(s)));
  const du = list.definite.filter((s) => isUnknown(cls(s))).length;
  const cv = list.candidates.filter((s) => isValid(cls(s)));
  const cu = list.candidates.filter((s) => isUnknown(cls(s))).length;
  const cOther = list.candidates.length - cv.length;
  const resolved = list.kind === 'exact' || list.kind === 'identified';
  const sectorsOf = (names) => uniq(names.map((s) => list.sectorOf[s] || UNIVERSE_SECTOR[s] || 'Unknown')).length;
  if (resolved) return { resolved, size: list.definite.length + list.candidates.length, valid: [dv.length + cv.length, dv.length + cv.length], unknown: [du + cu, du + cu], sectors: sectorsOf([...dv, ...cv]) };
  return {
    resolved,
    size: list.definite.length + list.slots,
    valid: [dv.length + Math.max(0, list.slots - cOther), dv.length + Math.min(list.slots, cv.length)],
    unknown: [du + Math.max(0, list.slots - (list.candidates.length - cu)), du + Math.min(list.slots, cu)],
    sectors: null,
  };
}

// ---- Main -----------------------------------------------------------------------------------------------------------

async function main() {
  writeVerbGrep();
  const runDir = runDirOf(process.argv);
  const exp = readJson(path.join(runDir, 'export.json'));
  const rep = readJson(path.join(runDir, 'replay.json'));
  const repro = readJson(path.join(runDir, 'reproduction.json'));
  const requests = readJson(path.join(runDir, 'requests.json'));
  const cites = citeLines();
  const sessions = rep.window.sessions;
  const last = sessions[sessions.length - 1];
  const U = ALL_TICKERS;
  const R = rep.bySymbol;
  const summary = { window: rep.window, cites, request: { made: requests.made, cap: requests.cap, from: requests.from, to: requests.to }, reproduction: { compared: repro.compared, matched: repro.matched, differing: repro.differing, otherRuleSet: repro.otherRuleSet, mapperDroppedRows: repro.mapperDroppedRows ?? null, recordsWithFactDrift: repro.recordsWithFactDrift, driftFacts: repro.driftFacts } };

  // The first replay of this run went through acquireOnce; the record of record uses the pure chain. Where the first
  // replay's output is kept, every compact field that carries a verdict is compared, symbol by symbol, session by session.
  const priorFile = path.join(runDir, 'replay.acquireOnce.json');
  if (exists(priorFile)) {
    const prior = readJson(priorFile).bySymbol;
    const fields = ['v', 'r', 'p', 'rg', 'ok', 'rf', 'd', 'extLimit'];
    let compared = 0; let identical = 0;
    for (const [sym, bySession] of Object.entries(R)) {
      for (const [s, c] of Object.entries(bySession)) {
        const o = prior[sym]?.[s];
        compared += 1;
        if (o && fields.every((f) => (o[f] ?? null) === (c[f] ?? null)) && JSON.stringify(o.ps) === JSON.stringify(c.ps) && JSON.stringify(o.m) === JSON.stringify(c.m)) identical += 1;
      }
    }
    summary.chainCheck = { against: 'the first replay, through acquireOnce', compared, identical };
  }

  // Raw opens and the funds' closes, from the long series.
  const rowsOf = {};
  for (const s of [...U, ...SECTOR_FUNDS]) {
    const file = readJson(path.join(runDir, 'bars', `${s}.json`));
    rowsOf[s] = {};
    for (const p of file.payload) rowsOf[s][p.date] = p;
  }
  const fundClose = {};
  for (const f of SECTOR_FUNDS) { fundClose[f] = {}; for (const r of mapDailyRows(Object.values(rowsOf[f])).rows) fundClose[f][r.date] = r.close; }

  // ---- Step 2: the universe, per session (reconstructed) ----
  const perSession = {};
  const marketRegime = {};
  for (const s of sessions) {
    perSession[s] = universeTally((sym) => R[sym]?.[s], U);
    marketRegime[s] = R[MARKET_SYMBOL]?.[s]?.rg ?? 'not_evaluated';
  }
  const series = (key, filter = () => true) => sessions.filter(filter).map((s) => perSession[s][key]);
  const universe = {
    class: 'reconstructed',
    valid: bandOf(series('valid')),
    breakout: bandOf(series('breakout')),
    pullback: bandOf(series('pullback')),
    both: spread(series('both')),
    sectorsMedian: median(series('sectors')),
    uptrendShareMedian: median(sessions.map((s) => share(perSession[s].uptrend, U.length))),
    classTotals: {},
    classMedians: {},
  };
  const allClasses = uniq(sessions.flatMap((s) => Object.keys(perSession[s].classes))).sort();
  for (const k of allClasses) {
    const v = sessions.map((s) => perSession[s].classes[k] || 0);
    universe.classTotals[k] = v.reduce((a, b) => a + b, 0);
    universe.classMedians[k] = median(v);
  }
  const dispositions = {};
  const extendedBy = {};
  const refusedBy = {};
  for (const sym of U) {
    for (const s of sessions) {
      const c = R[sym]?.[s];
      bump(dispositions, c?.d ?? 'none');
      if (classOf(c) === 'invalid_extended') bump(extendedBy, c.ps.join('+'));
      if (c && c.ok === false) { refusedBy[c.rf] = refusedBy[c.rf] || {}; bump(refusedBy[c.rf], sym); }
    }
  }
  universe.dispositions = dispositions;
  universe.extendedByPattern = extendedBy;
  universe.refusedByReason = Object.fromEntries(Object.entries(refusedBy).map(([k, v]) => [k, { records: Object.values(v).reduce((a, b) => a + b, 0), stocks: Object.keys(v).sort(), sessionsEach: v }]));
  summary.universe = universe;

  // By market state (SPY under the same regime test).
  summary.byMarket = {};
  for (const state of uniq(sessions.map((s) => marketRegime[s])).sort()) {
    const f = (s) => marketRegime[s] === state;
    summary.byMarket[state] = { sessions: sessions.filter(f).length, valid: bandOf(series('valid', f)), breakout: bandOf(series('breakout', f)), pullback: bandOf(series('pullback', f)), sectorsMedian: median(series('sectors', f)), uptrendShareMedian: median(sessions.filter(f).map((s) => share(perSession[s].uptrend, U.length))) };
  }

  // Weekly table.
  const weeks = {};
  for (const s of sessions) { const w = weekOf(s); weeks[w] = weeks[w] || []; weeks[w].push(s); }
  summary.weekly = Object.entries(weeks).map(([w, ss]) => ({ week: w, sessions: ss.length, medianValid: median(ss.map((s) => perSession[s].valid)), min: Math.min(...ss.map((s) => perSession[s].valid)), max: Math.max(...ss.map((s) => perSession[s].valid)), spy: uniq(ss.map((s) => marketRegime[s])).join('/') }));
  summary.perSession = sessions.map((s) => ({ session: s, valid: perSession[s].valid, breakout: perSession[s].breakout, pullback: perSession[s].pullback, both: perSession[s].both, sectors: perSession[s].sectors, uptrend: perSession[s].uptrend, spy: marketRegime[s] }));

  // Persistence: runs of consecutive valid sessions per stock; a run touching either end of the window is censored.
  const runs = [];
  for (const sym of U) {
    let start = null;
    for (let i = 0; i <= sessions.length; i++) {
      const v = i < sessions.length && isValid(classOf(R[sym]?.[sessions[i]]));
      if (v && start === null) start = i;
      if (!v && start !== null) { runs.push({ len: i - start, left: start === 0, right: i === sessions.length, regime: marketRegime[sessions[start]] }); start = null; }
    }
  }
  const persistenceOf = (all) => {
    const closed = all.filter((r) => !r.left && !r.right);
    const buckets = { 1: 0, 2: 0, 3: 0, '4-5': 0, '6-10': 0, '11+': 0 };
    for (const r of closed) bump(buckets, r.len <= 3 ? String(r.len) : r.len <= 5 ? '4-5' : r.len <= 10 ? '6-10' : '11+');
    return { runs: all.length, censored: all.length - closed.length, closed: closed.length, median: median(closed.map((r) => r.len)), mean: closed.length ? Math.round((closed.reduce((a, r) => a + r.len, 0) / closed.length) * 100) / 100 : null, buckets, shareAtLeast3: share(closed.filter((r) => r.len >= 3).length, closed.length), shareExactly1: share(closed.filter((r) => r.len === 1).length, closed.length) };
  };
  summary.persistence = { class: 'reconstructed', ...persistenceOf(runs), byStartRegime: Object.fromEntries(uniq(runs.map((r) => r.regime)).sort().map((g) => [g, persistenceOf(runs.filter((r) => r.regime === g))])) };

  // Still enterable at the next open: the next session's raw open against the record's own extension limit.
  const enter = (lookup, ss) => {
    const t = { names: 0, enterable: 0, excludedLast: 0, excludedSplit: 0, excludedNoOpen: 0, byPattern: {}, byRegime: {} };
    for (const s of ss) {
      for (const sym of U) {
        const c = lookup(sym, s);
        if (!c || !isValid(classOf(c))) continue;
        const next = nextSessionOf(s);
        if (s === last || !next) { t.excludedLast += 1; continue; }
        const nc = R[sym]?.[next];
        if (nc && nc.ok === false && nc.rf === 'basis_discontinuity' && nc.rfDate === next) { t.excludedSplit += 1; continue; }
        const open = Number(rowsOf[sym]?.[next]?.open);
        if (!Number.isFinite(open) || open <= 0 || !Number.isFinite(c.extLimit)) { t.excludedNoOpen += 1; continue; }
        t.names += 1;
        const ok = open <= c.extLimit;
        if (ok) t.enterable += 1;
        const k = c.ps.length === 2 ? 'both' : c.p;
        t.byPattern[k] = t.byPattern[k] || { names: 0, enterable: 0 };
        t.byPattern[k].names += 1;
        if (ok) t.byPattern[k].enterable += 1;
        const g = marketRegime[s];
        t.byRegime[g] = t.byRegime[g] || { names: 0, enterable: 0 };
        t.byRegime[g].names += 1;
        if (ok) t.byRegime[g].enterable += 1;
      }
    }
    t.share = share(t.enterable, t.names);
    for (const v of [...Object.values(t.byPattern), ...Object.values(t.byRegime)]) v.share = share(v.enterable, v.names);
    return t;
  };
  summary.enterable = { class: 'reconstructed', label: 'approximate: the open price against the record\'s own limit, not a new verdict', ...enter((sym, s) => R[sym]?.[s], sessions) };

  // ---- Provider drift: the stored records' own bars against the run day's bars, field by field ----
  const PAIRS = [['open', 'open'], ['high', 'high'], ['low', 'low'], ['close', 'close'], ['volume', 'volume'], ['adjustedClose', 'adjusted_close']];
  const drift = { barsCompared: 0, barsDiffering: 0, byField: {}, byAge: {}, bySession: {}, volumeRelative: [], priceRelativeMax: 0 };
  for (const r of exp.records) {
    if (!Array.isArray(r.bars)) continue;
    const rows = {};
    for (const p of readJson(path.join(runDir, 'bars', `${r.symbol}.json`)).payload) rows[p.date] = p;
    r.bars.forEach((b, age) => {
      const now = rows[b.date];
      drift.barsCompared += 1;
      let differs = false;
      for (const [sf, nf] of PAIRS) {
        const a = Number(b[sf]); const z = Number(now?.[nf]);
        if (a === z) continue;
        differs = true;
        bump(drift.byField, sf);
        if (sf === 'volume' && a > 0) drift.volumeRelative.push(Math.abs(z - a) / a);
        else if (a > 0) drift.priceRelativeMax = Math.max(drift.priceRelativeMax, Math.abs(z - a) / a);
      }
      if (differs) { drift.barsDiffering += 1; bump(drift.byAge, age === 0 ? 'bar0 (the session)' : age <= 5 ? 'bars 1-5' : 'bars 6+'); bump(drift.bySession, r.session); }
    });
  }
  drift.volumeRelative = { ...spread(drift.volumeRelative.map((x) => Math.round(x * 10000) / 100)), unit: 'percent' };
  drift.priceRelativeMax = Math.round(drift.priceRelativeMax * 1e6) / 1e4;
  summary.reproduction.providerDrift = drift;

  // ---- Contemporaneous: the sweep's stored records alone ----
  const stored = {};
  for (const r of exp.records) { stored[r.session] = stored[r.session] || {}; stored[r.session][r.symbol] = r; }
  summary.contemporaneous = {};
  for (const s of Object.keys(stored).sort()) {
    const recs = Object.values(stored[s]);
    const t = universeTally((sym) => (stored[s][sym] ? compactOfRecord(stored[s][sym]) : null), U);
    const state = exp.sweepState.find((x) => x.session === s) || null;
    summary.contemporaneous[s] = {
      class: 'contemporaneous', records: recs.length, rankedWithRecord: U.filter((sym) => stored[s][sym]).length,
      barsClass: uniq(recs.map((r) => r.barsClass)), writers: uniq(recs.map((r) => r.writer)),
      sweep: state ? { providerRequests: state.providerRequests, runs: state.runs, completedAt: state.completedAt } : null,
      valid: t.valid, breakout: t.breakout, pullback: t.pullback, both: t.both, sectors: t.sectors, uptrend: t.uptrend, classes: t.classes,
      spy: marketRegime[s] ?? null,
    };
  }
  const storedSessions = Object.keys(stored).sort();
  summary.enterableContemporaneous = { class: 'contemporaneous (limit) + run-day bars (next open)', label: 'approximate: the open price against the record\'s own limit, not a new verdict', ...enter((sym, s) => (stored[s]?.[sym] ? compactOfRecord(stored[s][sym]) : null), storedSessions) };

  // ---- Step 3: battle lists (non-League, created since the prompt's date) ----
  const nonLeague = exp.battles.filter((b) => !b.league);
  // The session the list is read at: the completed session before its first trading day (never after use); the
  // creation instant's last completed session is recorded beside it, and any disagreement counted.
  let sessionDisagreements = 0;
  const battleRows = nonLeague.map((b) => {
    const list = battleListOf(b);
    const beforeFirstDay = b.firstDay ? getSessionForDate(b.firstDay)?.previousEtDate ?? null : null;
    const session = beforeFirstDay || b.session;
    if (beforeFirstDay && beforeFirstDay !== b.session) sessionDisagreements += 1;
    const inWindow = sessions.includes(session);
    const k = battleCountsOf(list, (sym) => (inWindow ? R[sym]?.[session] : null));
    return { n: b.n, owner: b.owner, archetype: b.archetype, status: b.status, created: b.createdAt.slice(0, 10), session, inWindow, kind: list.kind, size: k.size, book: list.bookSize, crypto: list.crypto, candidates: list.candidates.length, slots: list.slots, valid: k.valid, unknown: k.unknown, sectors: k.sectors, universeValid: inWindow ? perSession[session].valid : null };
  });
  const resolved = battleRows.filter((r) => r.kind === 'exact' || r.kind === 'identified');
  const lo = (rows) => rows.map((r) => r.valid[0]);
  const hi = (rows) => rows.map((r) => r.valid[1]);
  const kinds = {}; for (const r of battleRows) bump(kinds, r.kind);
  const band = (v) => ({ median: median(v), under7: share(v.filter((x) => x < 7).length, v.length), under3: share(v.filter((x) => x < 3).length, v.length), zero: share(v.filter((x) => x === 0).length, v.length) });
  summary.battles = {
    class: 'reconstructed', label: 'the battle lists were ranked by today\'s rules, which trader v1 will change',
    count: battleRows.length, leagueExcluded: exp.battles.length - nonLeague.length, kinds, sessionDisagreements,
    sizes: uniq(battleRows.map((r) => r.size)).sort(),
    resolved: { battles: resolved.length, valid: band(lo(resolved)), unknownMedian: median(resolved.map((r) => r.unknown[0])), sectorsMedian: median(resolved.map((r) => r.sectors)), validShareMedian: median(resolved.map((r) => share(r.valid[0], r.size))), universeShareSameSessions: median(resolved.map((r) => share(r.universeValid, U.length))) },
    all: { battles: battleRows.length, validLow: band(lo(battleRows)), validHigh: band(hi(battleRows)) },
    byArchetype: Object.fromEntries(uniq(battleRows.map((r) => r.archetype)).sort().map((a) => { const rs = battleRows.filter((r) => r.archetype === a); return [a, { battles: rs.length, medianValidLow: median(lo(rs)), medianValidHigh: median(hi(rs)) }]; })),
    rows: battleRows,
  };

  // ---- Step 3: equipped lists, at every session ----
  summary.equipped = exp.equipped.map((l) => {
    const names = uniq(l.symbols.filter((s) => R[s]));
    const perS = sessions.map((s) => names.filter((sym) => isValid(classOf(R[sym]?.[s]))).length);
    return { n: l.n, owners: l.owners, loadouts: l.loadouts, size: l.symbols.length, evaluated: names.length, offUniverse: names.filter((s) => !U.includes(s)).length, medianValid: median(perS), maxValid: Math.max(...perS), under7: share(perS.filter((v) => v < 7).length, perS.length), zero: share(perS.filter((v) => v === 0).length, perS.length) };
  });

  // ---- Step 4: archetype overlays (today's scores applied to past sessions, approximate) ----
  const score = {};
  for (const r of exp.rankings) score[r.symbol] = r;
  const leadersOf = (s) => {
    const prev = getSessionForDate(s)?.previousEtDate ?? null;
    if (!prev) return null;
    const moves = SECTOR_FUNDS.map((f) => ({ f, m: fundClose[f][s] / fundClose[f][prev] - 1 })).filter((x) => Number.isFinite(x.m)).sort((a, b) => b.m - a.m);
    return moves.slice(0, TF_TOP_SECTORS).filter((x) => x.m >= TF_SECTOR_FLOOR).map((x) => FUND_SECTOR[x.f]);
  };
  const overlay = { tf: [], speculator: [], fundamental: [], preserver: [], diversifier: [] };
  const tfSessions = [];
  for (const s of sessions) {
    const v = perSession[s].validSymbols;
    const leaders = leadersOf(s);
    if (leaders) { tfSessions.push(s); overlay.tf.push(v.filter((sym) => leaders.includes(UNIVERSE_SECTOR[sym])).length); }
    overlay.speculator.push(v.filter((sym) => score[sym]?.atrPercentile > SPECULATOR_ATR).length);
    overlay.fundamental.push(v.filter((sym) => score[sym]?.fundamentalScore > FUNDAMENTAL_SCORE).length);
    overlay.preserver.push(v.filter((sym) => score[sym]?.fundamentalScore > PRESERVER_SCORE && score[sym]?.atrPercentile <= PRESERVER_ATR_MAX).length);
    overlay.diversifier.push(perSession[s].sectors);
  }
  summary.overlays = {
    label: 'today\'s scores applied to past sessions, approximate',
    scoresComputedAt: exp.rankingsMeta?.computedAt ?? null,
    datedSnapshots: exp.snapshots.ids.length,
    universeMatched: U.filter((sym) => score[sym]).length,
    trendFollower: { class: 'reconstructed', sessions: tfSessions.length, ...bandOf(overlay.tf), note: 'sector leaders: the three sector funds with the highest one-day move, any down more than 1% dropped; the code names no function for it' },
    speculator: { class: 'reconstructed + today\'s scores', ...bandOf(overlay.speculator), rule: `atrPercentile > ${SPECULATOR_ATR}`, universeEligible: U.filter((sym) => score[sym]?.atrPercentile > SPECULATOR_ATR).length },
    fundamental: { class: 'reconstructed + today\'s scores', ...bandOf(overlay.fundamental), rule: `fundamentalScore > ${FUNDAMENTAL_SCORE}`, universeEligible: U.filter((sym) => score[sym]?.fundamentalScore > FUNDAMENTAL_SCORE).length },
    preserver: { class: 'reconstructed + today\'s scores', ...bandOf(overlay.preserver), rule: `fundamentalScore > ${PRESERVER_SCORE} and atrPercentile <= ${PRESERVER_ATR_MAX}`, universeEligible: U.filter((sym) => score[sym]?.fundamentalScore > PRESERVER_SCORE && score[sym]?.atrPercentile <= PRESERVER_ATR_MAX).length },
    diversifier: { class: 'reconstructed', distinctSectors: spread(overlay.diversifier), sessionsWithAtLeast7: share(overlay.diversifier.filter((v) => v >= DIVERSIFIER_SECTORS).length, overlay.diversifier.length) },
  };

  // ---- Step 5: the compression precondition ----
  const nr7 = [];
  const squeeze = [];
  for (const s of sessions) {
    const rows = U.map((sym) => ({ sym, ...rep.compression[sym]?.[s] }));
    nr7.push(rows.filter((r) => r.nr7 === true).length);
    const bw = rows.filter((r) => Number.isFinite(r.bw)).sort((a, b) => a.bw - b.bw);
    squeeze.push(bw.filter((r, idx) => (bw.length > 1 ? Math.round((idx / (bw.length - 1)) * 100) : 50) <= SQUEEZE_PERCENTILE).length);
  }
  summary.compression = { class: 'reconstructed', label: 'precondition only', nr7: spread(nr7), squeeze: spread(squeeze) };

  writeJson(path.join(runDir, 'summary.json'), summary);
  console.log(JSON.stringify({ reproduction: { compared: summary.reproduction.compared, matched: summary.reproduction.matched, dropped: summary.reproduction.mapperDroppedRows }, chainCheck: summary.chainCheck ?? null, valid: summary.universe.valid.median, persistence: summary.persistence.median, enterable: summary.enterable.share, battles: { kinds: summary.battles.kinds, resolved: summary.battles.resolved.valid, sessionDisagreements: summary.battles.sessionDisagreements } }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
