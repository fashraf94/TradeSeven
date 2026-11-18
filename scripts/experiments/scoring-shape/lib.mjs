// scripts/experiments/scoring-shape/lib.mjs
//
// Scoring shape and the three-day threshold unit — SHARED HELPERS (experiment prompt of 18 Nov 2026, Fable).
//
// Offline and deterministic: no network, no Firestore, no clock read. Every input is a file already on this machine:
//   - the 17 Nov 2026 setup-frequency bar export (one EODHD daily series per symbol, 20 Dec 2025 → 17 Nov 2026);
//   - the 12 Oct 2026 measurement-closeout evidence (V2's published cross-section and its 228 qualified symbols);
//   - the trader-game replay export (film-tape 10-minute bars and the prices each 15-minute check saw).
// Every output lands in a run folder outside the repository.
//
// NO SCORING MATH IS COPIED HERE (BUILD_RULES §4). Each number below comes from a real module:
//   - the one-day unit:     calculateMeasuredATR + normalizeRawSnapshot  (api/_utils/measuredStockThreshold.js)
//   - the 6-dp unit:        effectiveStockPercentage                     (api/_utils/stockThresholdAdmission.js)
//   - tier levels/crossing: stockRewardContext                           (src/utils/stockThresholdModel.js)
//   - points:               calculateAssetScoreServer — FENCED (api/_utils/agentScoring.js), CALLED, never edited.
// The scripts decide only WHICH prices the scorer is shown (the shape's touch record). Precedent: the replay pack's
// ruling Q20, "a script may hand the real scorer a reset touch record" (docs/audits/20261115_REPLAY_PACK_TRADER_GAME.md:26).
// The S4 carry (C points per session close beyond the +1.0 line) is a parameter of the shape under test; it exists
// in no scorer, and is added outside it.

import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRawSnapshot, calculateMeasuredATR } from '../../../api/_utils/measuredStockThreshold.js';
import { effectiveStockPercentage } from '../../../api/_utils/stockThresholdAdmission.js';
import { STOCK_MODEL, stockRewardContext } from '../../../src/utils/stockThresholdModel.js';
import { calculateAssetScoreServer } from '../../../api/_utils/agentScoring.js';
import { getSessionForDate } from '../../../src/utils/marketCalendar.js';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');

// ---- inputs and outputs ---------------------------------------------------------------------------------------
export const DEFAULT_BARS_RUN = 'C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117';
export const DEFAULT_V2_DIR = 'C:/Users/fashr/.codex/visualizations/2026/10/12/01a131ef-f52d-7340-b38d-0e11fedd8d19/baggerbomb-measurement-closeout-evidence';
export const DEFAULT_TAPE_DIR = 'C:/Users/fashr/Documents/FantasyTrades/BaggerBombTraderGame/replay';
export const DEFAULT_OUT = 'C:/Users/fashr/Documents/FantasyTrades/ScoringShape/run-20261118';

// ---- the fixed design (written before any result was seen) ------------------------------------------------------
/** "V2's sessions plus every session since": entries from the first session of V2's published measurement window
 *  (22 Sep 2026; its 15 bars ran 22 Sep → 12 Oct) to the last entry whose three sessions end on the last session on
 *  disk (17 Nov 2026). The one-session baseline uses the SAME entries, so the two are compared on one sample. */
export const V2_WINDOW_FIRST_ENTRY = '2026-09-22';
/** Candidate three-day units, as multiples of the one-day unit (U6 is measured directly). */
export const UNIT_SCALES = Object.freeze({ U1: 1, U2: 1.25, U3: 1.5, U4: Math.sqrt(3), U5: 2 });
export const UNIT_IDS = Object.freeze(['U1', 'U2', 'U3', 'U4', 'U5', 'U6']);
/** U6: the average of 14 true ranges of NON-OVERLAPPING three-session bars ending at the last completed session
 *  before entry (15 block bars = 45 sessions), as a share of the last close — the V2 calculator run on block bars. */
export const U6_BLOCK = 3;
export const U6_BLOCKS = 15;
/** The recommendation criterion (fixed before running, advisor point 6): the candidate whose THREE-session +1.0
 *  touch rate on daily highs is nearest, in percentage points, to V2's ONE-session +1.0 touch rate on the same
 *  entries; ties broken by the mean absolute gap over all six tiers' touch rates. */
export const RECOMMENDATION_RULE = 'nearest_three_session_plus1_touch_rate_to_v2_one_session_plus1_touch_rate_then_mean_abs_gap_six_tiers';
/** A 7-position match: Star ×2, Core ×2, Support ×3 (Phase 0 H1). Bonuses are flat; base points scale by tier. */
export const MATCH_SLOTS = Object.freeze(['star', 'star', 'core', 'core', 'support', 'support', 'support']);
export const CONVICTION_TIERS = Object.freeze(['star', 'core', 'support']);
/** Seeded draws: matches per entry session. */
export const MATCHES_PER_SESSION = 400;
export const RNG_SEED = 20261118;
export const CARRY_VALUES = Object.freeze([5, 10, 15]);
export const TIER_KEYS = Object.freeze(['bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown']);
export const BONUS_KEYS = Object.freeze(['bagger', 'doubleBagger', 'tenBagger']);
export const PENALTY_KEYS = Object.freeze(['bust', 'crash', 'meltdown']);
export const TIER_LABEL = Object.freeze({ bagger: '+1.0', doubleBagger: '+1.5', tenBagger: '+2.0', bust: '−1.0', crash: '−1.5', meltdown: '−2.0' });

// ---- io -----------------------------------------------------------------------------------------------------------
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}
export function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}
export function argOf(argv, flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : fallback;
}
/** This checkout and, for a worktree, its main checkout (read from the .git file's gitdir line). */
function repoRoots() {
  const roots = [realpathSync(PROJECT_ROOT)];
  const dotGit = path.join(PROJECT_ROOT, '.git');
  if (existsSync(dotGit) && !statSync(dotGit).isDirectory()) {
    const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\s*$/m);
    const common = m && m[1].replace(/[\\/]worktrees[\\/][^\\/]+$/, '');
    if (common) roots.push(realpathSync(path.dirname(path.resolve(PROJECT_ROOT, common))));
  }
  return roots.map((r) => r.toLowerCase());
}
/** The run folder, refused inside this checkout or its main checkout (outputs never land in a repository tree). */
export function outDirOf(argv) {
  const dir = path.resolve(argOf(argv, '--out', DEFAULT_OUT));
  mkdirSync(dir, { recursive: true });
  const real = realpathSync(dir).toLowerCase();
  if (repoRoots().some((r) => real === r || real.startsWith(r + path.sep))) die(`the run folder must be outside the repository: ${dir}`);
  return dir;
}

// ---- the universe and the bars ------------------------------------------------------------------------------------
/** V2's universe: the 228 symbols the Oct 12 closeout qualified (closeout-qualified-audit/threshold-audit.json). */
export function v2Universe(v2Dir = DEFAULT_V2_DIR) {
  const audit = readJson(path.join(v2Dir, 'closeout-qualified-audit', 'threshold-audit.json'));
  const symbols = audit.distribution?.qualifiedSymbols;
  if (!Array.isArray(symbols) || symbols.length !== 228) die('the closeout audit does not list 228 qualified symbols');
  return { symbols: [...symbols], audit };
}

/** One symbol's series from the bar export, oldest first, fully adjusted by the V2 normalizer. */
export function loadSeries(barsRun, symbol) {
  const file = path.join(barsRun, 'bars', `${symbol}.json`);
  if (!existsSync(file)) return { status: 'missing' };
  const doc = readJson(file);
  const snapshot = { id: `bars-export-20261117-${symbol}`, providerSymbol: `${symbol}.US`, capturedAt: doc.receivedAt, basis: 'raw_ohlc_adjusted_close', rows: doc.payload };
  const normalized = normalizeRawSnapshot(snapshot, null);
  if (normalized.status !== 'valid') return { status: 'invalid', reason: normalized.reason, date: normalized.date };
  return { status: 'valid', rows: normalized.rows, requestedAt: doc.requestedAt, receivedAt: doc.receivedAt };
}

/** The sessions of record between two dates, walked on the pinned calendar (V2's calendar module). Cached. */
const SESSION_CACHE = new Map();
export function calendarSessions(first, last) {
  const key = `${first}..${last}`;
  if (SESSION_CACHE.has(key)) return SESSION_CACHE.get(key);
  const out = [];
  SESSION_CACHE.set(key, out);
  let d = new Date(`${first}T12:00:00Z`);
  const end = new Date(`${last}T12:00:00Z`);
  while (d <= end) {
    const ds = d.toISOString().slice(0, 10);
    if (getSessionForDate(ds)?.isTradingDay) out.push(ds);
    d = new Date(d.getTime() + 86_400_000);
  }
  return out;
}

// ---- units ----------------------------------------------------------------------------------------------------------
/** V2's one-day unit for an entry at rows[i]: the 15 bars ending at the session BEFORE entry (no look-ahead). */
export function oneDayUnitAt(rows, i) {
  if (i < 15) return null;
  const m = calculateMeasuredATR(rows.slice(i - 15, i).map(({ date, open, high, low, close }) => ({ date, open, high, low, close })));
  return m.status === 'valid' ? m.measuredPct : null;
}

/** U6 for an entry at rows[i]: 15 non-overlapping 3-session block bars ending at rows[i-1], through the V2 calculator. */
export function threeSessionUnitAt(rows, i) {
  const need = U6_BLOCK * U6_BLOCKS;
  if (i < need) return null;
  const blocks = [];
  for (let b = U6_BLOCKS - 1; b >= 0; b--) {
    const seg = rows.slice(i - U6_BLOCK * (b + 1), i - U6_BLOCK * b);
    blocks.push({ date: seg.at(-1).date, open: seg[0].open, high: Math.max(...seg.map((r) => r.high)), low: Math.min(...seg.map((r) => r.low)), close: seg.at(-1).close });
  }
  const m = calculateMeasuredATR(blocks);
  return m.status === 'valid' ? m.measuredPct : null;
}

/** The admitted (6-dp, half-even) effective percentage, exactly as admission computes it. */
export function admitted(measuredPct) {
  try {
    return effectiveStockPercentage(measuredPct);
  } catch {
    return null;
  }
}

/** The admitted unit of a hold under a candidate (U1–U5 scale the measured one-day unit BEFORE the 6-dp admission
 *  quantization, as admission would quantize the effective percentage once; U6 is measured on three-session bars). */
export function unitOf(hold, id) {
  if (id === 'U6') return admitted(hold.u6);
  if (!(id in UNIT_SCALES)) throw new Error(`unknown unit ${id}`);
  return admitted(hold.u1[0] * UNIT_SCALES[id]);
}

/** Holds from the run folder, optionally only V2's window (entries on or after V2_WINDOW_FIRST_ENTRY). */
export function loadHolds(out, { window = 'v2' } = {}) {
  const doc = readJson(path.join(out, 'holds.json'));
  const holds = window === 'v2' ? doc.holds.filter((h) => h.d >= V2_WINDOW_FIRST_ENTRY) : doc.holds;
  return { meta: doc.meta, holds };
}
export const windowOf = (argv) => (argv.includes('--long') ? 'long' : 'v2');
/** Output-name suffix for a window, so a --long run never overwrites V2's files. */
export const suffixOf = (window) => (window === 'long' ? '-long' : '');

// ---- the real reward context and the real scorer --------------------------------------------------------------------
const FILL_AT = '2026-01-02T15:00:00.000Z';
const LATER = '2026-01-02T15:15:00.000Z';
const HEX = '0'.repeat(64);

/**
 * A synthetic one-position battle that passes validateStockReceipt, so stockRewardContext can be CALLED with any
 * anchor, unit and touch record. Its duration is 'fullday' only because the measured route refuses any other
 * (src/utils/stockThresholdModel.js:30); the levels it returns depend on the anchor and unit alone.
 */
function syntheticBattle(fill, unit) {
  const receipt = {
    ...STOCK_MODEL, battleId: 'experiment', side: 'agent', tier: 'support', slot: 0, symbol: 'X', positionId: 'p', slotVersion: 1,
    fill, scoringPct: unit.scoringPct, measuredPct: unit.scoringPct, atr14Dollars: 1, scoringPctDecimal: unit.scoringPctDecimal,
    enteredAt: FILL_AT, snapshotCapturedAt: FILL_AT, inputHash: HEX, receiptHash: HEX, inputRef: 'stockThresholdInputs/s', snapshotId: 's',
    securityId: 'X', sourceSession: '2026-01-01',
    fillQuote: { provider: 'EODHD', source: 'real-time', validation: 'accepted_original_quote', price: fill, quoteAsOf: FILL_AT, observedAt: FILL_AT },
  };
  const asset = { symbol: 'X', positionId: 'p', slotVersion: 1, stockThresholdReceipt: receipt };
  const history = { positionId: 'p', side: 'agent', receiptHash: HEX, high: fill, low: fill, observedAt: FILL_AT, crossedTiers: [] };
  const battle = { id: 'experiment', gameMode: 'baggerbomb_agent', duration: 'fullday', opponent: { portfolio: {} }, portfolio: { support: [asset] },
    scoring: { stockThresholdModel: { ...STOCK_MODEL, admittedAt: FILL_AT }, stockRewardHistory: { agent: { p: history } } } };
  return { battle, asset, history };
}

/**
 * The real reward context for a position anchored at `fill` with `unit`, given the touch record the shape allows:
 * `high` (the highest price the shape lets count toward a bonus), `low` (the lowest toward a penalty) and the
 * quote `price`. The model widens the record by the quote itself (max/min), exactly as in a live check.
 */
export function rewardContext(fill, unit, { high, low, price }) {
  const { battle, asset, history } = syntheticBattle(fill, unit);
  history.high = Math.max(high, fill);
  history.low = Math.min(low, fill);
  const ctx = stockRewardContext(battle, asset, 'agent', 'support', 0, { price, asOf: LATER, observedAt: LATER });
  if (ctx.status !== 'valid') throw new Error(`reward context refused: ${ctx.reason}`);
  return ctx;
}

/** The six real levels (prices) for an anchor and unit, keyed by tier. */
export function levelsOf(fill, unit) {
  const ctx = rewardContext(fill, unit, { high: fill, low: fill, price: fill });
  return Object.fromEntries(ctx.targets.map((t) => [t.key, t.target]));
}

/** The tiers the real model counts as crossed for this touch record. */
export function crossed(fill, unit, rec) {
  return rewardContext(fill, unit, rec).crossedTiers;
}

/** Points from the FENCED scorer (called): base from fill to `price` at a conviction tier, plus the tiers banked. */
export function points(fill, unit, conviction, price, crossedTiers) {
  const ctx = rewardContext(fill, unit, { high: fill, low: fill, price });
  const s = calculateAssetScoreServer({ symbol: 'X', tier: conviction }, null, {}, {}, null, { ...ctx, crossedTiers: [...crossedTiers] });
  if (s.status !== 'valid') throw new Error(`scorer refused: ${s.reason}`);
  return { total: s.totalPoints, base: s.basePoints, bonus: s.bonusPoints };
}

/** The legacy (dormant daily-reset) scorer path, for one day: the cross-check for S5 (api/cron/agent-daily-scores.js:144). */
export function legacyDay({ fill, baseline, unitPct, conviction, close, high, low }) {
  const priceChange = (close - fill) / fill * 100;
  const thresholdPriceChange = (close - baseline) / baseline * 100;
  return calculateAssetScoreServer({ symbol: 'X', tier: conviction, baseATR: unitPct }, priceChange, {},
    { highChange: (high - baseline) / baseline * 100, lowChange: (low - baseline) / baseline * 100 }, thresholdPriceChange);
}

// ---- deterministic randomness and statistics ------------------------------------------------------------------------
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
/** k distinct indices from [0, n), Fisher–Yates on a copy (draw order is the slot order). */
export function drawDistinct(rng, n, k) {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, k);
}
/** The seeded 7-position matches: MATCHES_PER_SESSION draws per entry session, seven distinct stocks entered at the
 *  same open, slots in draw order (MATCH_SLOTS). Same holds + same seed → the same matches in every step. */
export function drawMatches(holds) {
  const bySession = new Map();
  holds.forEach((h, i) => { if (!bySession.has(h.d)) bySession.set(h.d, []); bySession.get(h.d).push(i); });
  const rng = mulberry32(RNG_SEED);
  const matches = [];
  for (const [session, idx] of [...bySession.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (idx.length < MATCH_SLOTS.length) continue;
    for (let m = 0; m < MATCHES_PER_SESSION; m++) matches.push({ session, holds: drawDistinct(rng, idx.length, MATCH_SLOTS.length).map((k) => idx[k]) });
  }
  return matches;
}
export const sum = (xs) => xs.reduce((n, x) => n + x, 0);
export const mean = (xs) => (xs.length ? sum(xs) / xs.length : NaN);
/** Quantile by linear interpolation between order statistics (type 7). */
export function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const median = (xs) => quantile(xs, 0.5);
export const pct = (n, d, dp = 1) => (d ? `${(100 * n / d).toFixed(dp)}%` : '—');
export const fx = (x, dp = 2) => (Number.isFinite(x) ? x.toFixed(dp) : '—');
export function mdTable(head, rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}
