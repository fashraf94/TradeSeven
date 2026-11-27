// scripts/experiments/setup-payoff/lib.mjs
//
// Setup payoff check (experiment prompt of 18 Nov 2026) — THE DEFINITIONS AND THE SHARED HELPERS.
//
// Every definition the analysis uses is fixed in DEFINITIONS below and committed BEFORE the first outcome is computed
// (the prompt's §2: "every definition in this prompt is fixed before any result is seen"). The commit that adds this
// file is the proof; the report cites it. A definition changed after a result was seen would show in git history.
//
// No Firestore, no network, no clock read except where a caller passes one. Everything a step writes lands in the run
// folder, outside the repository. The frequency run's folder is read, never written.
//
// The store's functions are reached only through ../setup-frequency/storeReplay.mjs (already on the store's import
// guard list). No file in this folder names the store's folder or its collections as a path segment, so the guard
// needs no new entry (prompt rule 2).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { repoRoots, insideAny } from '../trader-game-replay/exportReplay.mjs';

export { median, percentile, spread, share, bump, uniq, nextSessionOf, UNIVERSE_SECTOR, FUND_SECTOR, SECTOR_FUNDS, MARKET_SYMBOL } from '../setup-frequency/lib.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');
/** The frequency run's folder: its export, its stored bars, its replay output. Read only. */
export const FREQ_RUN = 'C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117';
/** This check's folder: the long fetch, the enriched replays, the summary. */
export const DEFAULT_RUN_DIR = 'C:/Users/fashr/Documents/FantasyTrades/SetupPayoff/run-20261118';

// ---- The definitions, fixed before any outcome is computed --------------------------------------------------------

export const DEFINITIONS = Object.freeze({
  // Step 0
  reproduce: { medianValid: 18, validBreakout: 31, stockDays: 27_360, storedRecords: 456 },
  // Windows (prompt §2). The short window is the frequency run's 120 sessions on its stored bars. The long window is
  // every session the calendar of record can evaluate up to the same last session: marketSchedule.js maintains 2026
  // and 2027 only, and the store's adapter refuses an asOf outside them (calendar_missing), so the long window starts
  // 2 Jan 2026 (221 sessions), not 500 sessions back. On its last 120 sessions the stored run is used.
  window: { shortSessions: 120, longMax: 500, lastSession: '2026-11-17', developmentShare: 2 / 3 },
  // Rule 5: the one optional fetch.
  fetch: { cap: 260, from: '2024-11-01', to: '2026-11-17' },
  // Part A — the event, the entry, the measures
  event: 'valid at t with pattern pullback_resume (class valid_pullback); not valid in any pattern at t-1; t-1 must be a window session. A valid_both day is named breakout by the rule and is not a Pullback and Resume event.',
  secondaryEvent: 'every valid_pullback day',
  entry: 'the raw open of the next session on the calendar of record (t+1), entered only when open <= the record\'s own extension limit (its extension check rhs). PRIMARY: the filter applies to every arm, comparison groups included ("entered the same way"). SECONDARY: no filter on any arm.',
  horizons: [1, 3],
  outcome: 'move to the raw close of t+1 and of t+3, from the entry; percent and units',
  unit: 'u = ATR / C at t, the record\'s own facts (14-day ATR, raw close). The three-session move uses the same one-day unit (the scaled 3-day unit is not adopted).',
  thresholdUnits: 1.0,
  barrier: 'up = entry x (1 + u), down = entry x (1 - u); sessions t+1..t+h in order, on raw highs and lows; a session reaching both counts the adverse (down) first and is counted; neither when no session reaches either.',
  splitStep: 0.10, // an adjusted-to-raw ratio step above 10% between consecutive rows (the evaluator's own split rule): excluded at that horizon
  dividendStep: 0.0002, // a step above 0.02% and at most 10%: kept, counted, and dropped in one sensitivity row
  groups: {
    G1: 'every universe stock at t with a record that has C, ATR and an extension limit (refused records have none)',
    G2: 'invalid, reason no_setup: an uptrend with neither pattern satisfied',
    G3: 'invalid, reason extended: a pattern satisfied but C above the extension limit',
  },
  test: 'per session t with at least one outcome in each arm: d_t = mean(valid arm) - mean(group); the estimate is the mean of d_t over those sessions; the 90% interval is the 5th and 95th nearest-rank percentiles of 2,000 means of sessions resampled with replacement (mulberry32, seed 20261118, a fresh generator per comparison)',
  labels: { better: 'interval wholly above zero', worse: 'interval wholly below zero', none: 'otherwise' },
  headline: 'the three-session move in units against G2; the percent label is given beside it',
  resamples: 2000,
  seed: 20261118,
  interval: [5, 95],
  splits: {
    spy: 'SPY\'s regime at t (its own replay record)',
    volatility: 'u ranked within the session\'s G1 records, cut in thirds by rank (per session, point in time); both arms restricted to the third',
    archetype: 'today\'s scores, approximate: Speculator atrPercentile > 0.80; Capital Preserver fundamentalScore > 60 and atrPercentile <= 0.75; Fundamental Investor fundamentalScore >= 40, and > 70; both arms restricted',
    small: 100,
  },
  // Part B
  breakoutBase: 'records with ok evidence, regime uptrend and patterns.breakout satisfied, whatever the extension check said',
  candidates: [
    { id: 'L0', kind: 'sma', k: '2.0', note: 'today\'s limit: SMA_fast + 2.0 x ATR' },
    { id: 'L1', kind: 'sma', k: '2.5' },
    { id: 'L2', kind: 'sma', k: '3.0' },
    { id: 'L3', kind: 'sma', k: '3.5' },
    { id: 'L4', kind: 'sma', k: '4.0' },
    { id: 'L5', kind: 'none' },
    { id: 'H1', kind: 'swing', k: '0.5', note: 'swingHigh + 0.5 x ATR; swingHigh is the record\'s own fact, the highest high of bars 1..20 that breakout_close compares C against' },
    { id: 'H2', kind: 'swing', k: '1.0' },
  ],
  candidateLimit: 'exact in decimal from the record\'s own 4-decimal facts, as tfSetupV1.js builds its guard (toDecimal / addDecimal / multiplyDecimal, then the correctly rounded double); C <= limit passes. L0 must reproduce every record\'s own extension result.',
  candidateEvent: 'valid under the candidate at t and not valid under the candidate at t-1; entered when open(t+1) <= the candidate\'s own limit (L5: always)',
  tightness: 'ascending count of candidate-valid stock-days over the development sessions; ties in table order',
  recommendation: 'on each window\'s development sessions: the tightest candidate with a median of at least 3 valid breakouts a morning AND a three-session unit difference against G2 whose estimate is not below zero (>= 0). None if no candidate qualifies. The reading "interval not wholly below zero" is reported beside it. The short window is primary.',
  minMedianBreakouts: 3,
  // Part C
  scoreLevels: [40, 50, 60, 70],
  speculatorAtr: 0.80,
  preserverScore: 60,
  preserverAtrMax: 0.75,
  fundamentalTop: 70,
  // Part D
  squeeze: 'bw(s) = calculateBollingerBands(the mapper\'s closes newest first ending at s, 20, 2).bandwidth, the closes the rankings producer reads (mapDailyRows close = adjusted). At t: the 120 sessions t-119..t must all have a finite bw; idx = how many of the other 119 are strictly below bw(t); pct = round(idx / 119 x 100), the producer\'s cross-sectional formula applied along time; flagged when pct <= 20. A session is counted only when all 228 stocks have that full trailing history (the eligible range is reported). Short window: the stored bars. Long window: the fetched bars.',
  squeezeTrailing: 120,
  squeezePct: 20,
  // Part E
  mornings: 'each window session t with index >= 3 and an open at t+1; candidates are the 228 at the close of t',
  slotReadings: {
    literal: 'valid at the prior close (t) and open(t+1) <= its limit — the prompt\'s words',
    firstDay: 'turned valid at the prior close (valid at t, not at t-1) and enterable',
    shelf3: 'turned valid at t, t-1 or t-2 (valid at d, not at d-1), still valid at t, and enterable',
  },
  slots: 7,
  gates: {
    tf: 'none',
    tfSectors: 'the frequency run\'s stand-in: the three sector funds with the highest one-day move at t (mapper closes), any down more than 1% dropped',
    speculator: 'atrPercentile > 0.80',
    fi40: 'fundamentalScore >= 40',
    fi70: 'fundamentalScore > 70',
    preserver: 'fundamentalScore > 60 and atrPercentile <= 0.75 (per name); secondary: the code\'s "at least 6 sectors" as a book rule, fill = min(7, N, S + 1)',
    diversifier: 'no name gate; a seven-name book spanning at least 5 sectors holds at most S + 2 valid names when the valid names cover S sectors: fill = min(7, N, S + 2). The code\'s own 7-sector rule beside it: fill = min(7, N, S).',
    contrarian: 'not applicable: no detector',
  },
});

export const SEED = DEFINITIONS.seed;

// ---- Run folder, json, write-verb grep ------------------------------------------------------------------------------

export function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

export const argOf = (argv, flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };

/**
 * `--run <dir>` (default DEFAULT_RUN_DIR): an absolute path, refused inside the repository or inside the frequency
 * run's folder (compared through real paths where they exist; review SP-L2-9), created only once it passes.
 */
export function runDirOf(argv) {
  const given = argOf(argv, '--run');
  // Absolute with a drive (or a UNC path): Windows treats a drive-less "\x" as absolute too (delta review DR-8).
  if (given && !(process.platform === 'win32' ? /^(?:[A-Za-z]:[\\/]|\\\\)/.test(given) : path.isAbsolute(given))) die(`--run must be an absolute path with a drive: ${given}`);
  const dir = path.resolve(given || DEFAULT_RUN_DIR);
  const real = (p) => { try { return realpathSync.native(p); } catch { return p; } };
  if (insideAny(dir, repoRoots(PROJECT_ROOT)) || insideAny(real(dir), repoRoots(PROJECT_ROOT))) die(`the run folder must be outside the repository: ${dir}`);
  if (insideAny(dir, [path.resolve(FREQ_RUN)]) || insideAny(real(dir), [real(path.resolve(FREQ_RUN))])) die(`the frequency run's folder is read only: ${dir}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value)}\n`);
}

const WRITE_VERB_RE = /\.(set|update|create|delete|add|commit|batch|runTransaction|bulkWriter|recursiveDelete)\s*\(/g;
const ADMIN_SDK_RE = /['"`](?:firebase-admin|@google-cloud\/)/;
const PROVIDER_RE = /['"`/]eodhdDailyWindow/;
// A global fetch call, the cache's own fetcher, a literal URL, or an import of Node's http(s) or a common HTTP client
// (delta review DR-7). Spelled so it cannot match itself.
const NETWORK_RE = /\bfetch\s*\(|fetchDaily[O]HLCV|\bhttps?:\/\/|['"`](?:node:)?https?['"`]|['"`](?:undici|axios|node-fetch|got)['"`]/;
const STORE_NAME_RE = /['"`/]setup[E]vidence(?:Claims)?['"`/]/; // the import guard's own pattern, spelled so it cannot match itself
const CODE_RE = /\.(js|jsx|mjs|cjs|mts|cts|ts|tsx)$/; // the import guard's extension set

/**
 * Every code file here, as text: no Firestore write verb, no Admin SDK or Google Cloud client, no raw request or URL,
 * the provider only in fetchLong.mjs, no store path. A TRIPWIRE against accidents, not a proof (review SP-L2-4): it
 * reads this folder's own text only, so it cannot see inside imported modules (the bar mapper's module loads the
 * Admin SDK, though nothing here calls it), and it does not see bracket access or names built at run time.
 */
export function writeVerbGrep() {
  const files = readdirSync(HERE).filter((f) => CODE_RE.test(f)).sort();
  const hits = [];
  for (const file of files) {
    const text = readFileSync(path.join(HERE, file), 'utf8');
    for (const m of text.matchAll(WRITE_VERB_RE)) hits.push(`${file}: write verb ${m[0]}`);
    if (ADMIN_SDK_RE.test(text)) hits.push(`${file}: imports the Admin SDK or a Google Cloud client`);
    if (NETWORK_RE.test(text)) hits.push(`${file}: a raw request, a cache fetcher or a URL`);
    if (file !== 'fetchLong.mjs' && PROVIDER_RE.test(text)) hits.push(`${file}: imports the provider request`);
    if (STORE_NAME_RE.test(text)) hits.push(`${file}: names the store as a path segment (the import guard would count it)`);
  }
  if (hits.length > 0) die(`write-verb grep failed:\n  ${hits.join('\n  ')}`);
  return { files };
}

// ---- Sessions -------------------------------------------------------------------------------------------------------

/** Sessions on the calendar of record ending at `last`, oldest first: at most `max`, stopping where the calendar ends. */
export function sessionsBack(last, max) {
  const out = [last];
  while (out.length < max) {
    const prev = getSessionForDate(out[out.length - 1])?.previousEtDate;
    if (!prev || !getSessionForDate(prev)?.isTradingDay) break;
    out.push(prev);
  }
  return out.reverse();
}

/** Development = the first floor(2N/3) sessions; confirmation = the rest. */
export function periodsOf(sessions) {
  const cut = Math.floor(sessions.length * DEFINITIONS.window.developmentShare);
  const period = {};
  sessions.forEach((s, i) => { period[s] = i < cut ? 'dev' : 'conf'; });
  return { cut, period, dev: sessions.slice(0, cut), conf: sessions.slice(cut) };
}

// ---- Seeded resampling ----------------------------------------------------------------------------------------------

/** mulberry32: a small seeded generator, uniform in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nearestRank = (sorted, p) => sorted[Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length))) - 1];

/** Mean of `values` and its interval from DEFINITIONS.resamples resamples of the values (whole sessions), seeded. */
export function bootstrapMean(values) {
  const n = values.length;
  if (n === 0) return { n: 0, est: null, lo: null, hi: null };
  const est = values.reduce((a, b) => a + b, 0) / n;
  const rnd = mulberry32(SEED);
  const means = [];
  for (let r = 0; r < DEFINITIONS.resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(rnd() * n)];
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return { n, est, lo: nearestRank(means, DEFINITIONS.interval[0]), hi: nearestRank(means, DEFINITIONS.interval[1]) };
}

/** The words fixed in advance. */
export function labelOf({ lo, hi }) {
  if (lo === null || hi === null) return 'no data';
  if (lo > 0) return 'better than the comparison';
  if (hi < 0) return 'worse';
  return 'no clear difference';
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
