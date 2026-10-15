#!/usr/bin/env node
// scripts/experiments/growth-replay/changedMomentsScore.js
//
// Changed-moments score — did the learning help? (Fable, 14 Oct 2026)
//
// The growth replay (docs/audits/20261008_GROWTH_REPLAY_EXPERIMENT.md) found
// that removing an agent's learned paragraph changes its usual call on 29 of
// 280 moments (the batch-check addendum). It measured whether calls CHANGE.
// This scores whether the learned call or the unlearned call did BETTER,
// using what the market did next. NO MODEL CALLS.
//
// READ-ONLY BY CONSTRUCTION.
//   - Firestore: the Admin SDK through .collection / .doc / .get / .getAll /
//     .where only. There is no write call of any kind in this file.
//   - Product code is IMPORTED, never copied or edited (BUILD_RULES §1, §4):
//     the tape's replay (replayAction, api/_utils/filmTape/tapeReplay.js) and
//     through it the fenced scorer calculateAssetScoreServer; the tape's bar
//     rules (bars.js); the tape's check-state rule (tickState); the mode
//     config. Fenced functions CALLED: calculateAssetScoreServer (directly for
//     the hypothetical sale's lock, and inside replayAction). EDITED: none.
//   - EODHD: plain fetch to the intraday endpoint, at most CALL_CAP requests
//     over the whole run, counted in the run manifest BEFORE each request.
//     The key is read from the environment / .env.local and never printed.
//   - Everything it writes lands in %USERPROFILE%/growth-replay-runs/<runId>/,
//     outside the repo. Files named *.local.* carry ids or player text and
//     are never committed; summary.json carries neither.
//
// USAGE (repo root), in order:
//   node scripts/experiments/growth-replay/changedMomentsScore.js selftest
//   node scripts/experiments/growth-replay/changedMomentsScore.js plan          # Firestore reads, inputs, call count; no bars
//   node scripts/experiments/growth-replay/changedMomentsScore.js known-answer  # bars for the tape's swaps; the 90% gate
//   node scripts/experiments/growth-replay/changedMomentsScore.js score         # refuses unless the gate passed
// Every command but `selftest` and `plan` acts on the newest run; --run <runId> picks another.
//
// ============================================================================
// THE METHOD (pre-declared; mirrored in the report's §3, committed before any
// bar was fetched or any outcome was read)
// ============================================================================
//
// M1 MOMENTS. Usual call = the modal fine key (HOLD | SWAP:OUT>IN | malformed)
//    under the replay's key of record (growthReplay.js decisionKey) and its
//    tie rule (modal: lexically smallest). "With learning" = the verbatim
//    request; "without" = the `strip` variant.
//    - Set of record: the batch check's fresh baseline vs fresh strip, modal
//      calls differ (expected 29).
//    - Second set: the main run's baseline vs strip flips not in the set of
//      record, scored the same way and reported separately; they set no label.
//    - Kind: stopped (with HOLD, without SWAP) · caused (with SWAP, without
//      HOLD) · changed pick (both SWAP, different keys; a different OUT is
//      flagged) · unscorable (malformed on either side).
//
// M2 WHAT A CALL IS WORTH. Per horizon h, over the slots either call touches:
//      V(call) = Σ over those slots of [ the swap path at h if the call swaps
//                that slot, else the hold path at h ]
//      difference = V(with learning) − V(without)   (positive = learning better)
//    Points: the hold path and the swap path are replayAction's own (the
//    tape's arithmetic, BA-11): hold = the held name scored from its ORIGINAL
//    entry with its threshold history continued; swap = the lock the sale
//    banks + the bought name scored from the swap with its history at zero.
//    Price: the % move, from the price the agent was SHOWN at the check, of
//    the name the call leaves in the slot.
//    For a stopped moment this is hold − swap; for a changed pick with the
//    same OUT it is swap_Y − swap_Z (the held name cancels, so its leg is not
//    needed).
//
// M3 INPUTS of a swap X→Y at a check (one builder for hypothetical AND, in the
//    known-answer layer 2, recorded swaps):
//    - instant: the check's capturedAt (the tape's check instant; a recorded
//      swap's own instant falls seconds before it, inside the same minute).
//    - X's entry: the exact record — the fill of the swap that brought X in
//      (the tick action's entryPrice, else the later trade's entryPrice, else
//      the final slot's swapPrice / previousSwapPrice), else startingPrices[X]
//      — accepted only when it renders to the request body's $Entry at 2 dp.
//    - X's threshold baseline: the tape's own rule (ghostBaseline): the swap
//      price if X came in that day, the starting price on the activation day,
//      else the previous close, which no record holds → points not_scored.
//    - X's threshold history: the band of the body's Badges column (none → 0,
//      bagger → 1.0, doubleBagger → 1.5, tenBagger → 2.0; bust → −1.0, crash →
//      −1.5, meltdown → −2.0). The scorer reads history only through
//      max/min against the thresholds, so any history inside the same band
//      gives the same points on every later sample (self-test row S7).
//    - X's ATR: the held asset's baseATR (final slot, else the receipt's
//      outgoingBaseATR, else the bench record) — accepted when it renders to
//      the body's ATR% at 1 dp; else the body's 1-dp value with a
//      sensitivity test (M7).
//    - the lock: calculateAssetScoreServer exactly as executeSwapServer builds
//      it (ATR = scoring.thresholds[X].threshold || baseATR || 2.5, the mode's
//      flat stamp, history as above) at X's EVIDENCE price (the capture's px,
//      the platform's delayed quote the agent was shown). The body's LockNow
//      is reported beside it.
//    - Y's entry: the body's bench $Current for Y (2 dp); Y absent from the
//      shown bench → not_scored. Y's ATR: scoring.thresholds[Y].threshold,
//      else the bench record's baseATR, else the body's 1-dp ATR% (M7) —
//      executeSwapServer's incoming literal. Y's history zero, baseline =
//      its entry (the executor's reset).
//    - the state shown: the battle as it stood when the prompt was built (the
//      evaluation entry's promptBuiltAt) — the final portfolio with every
//      trade made after that instant undone, so a swap the check itself made
//      is not yet in it. tier = X's slot in it; tierStamp =
//      resolveModeConfig(gameMode).flatMultiplier.
//    - later checks: the battle's ticks of that ET day plus its evaluation
//      entries with no tick (the tape's rows), sampled by the tape's own
//      scoredCheck / laterChecks.
//    - crypto on either leg → not_scored (the tape's crypto_not_supported).
//
// M4 BARS. EODHD 1-minute bars, one request per symbol spanning every ET day
//    that symbol is needed (from the first needed open − 1 h to the last
//    needed close + 1 h), filtered exactly as the candle pass's fetcher
//    (finite OHLC; the null-volume zero-range close print) and cut by the
//    tape's sessionBars. The tape's stored series are 10-minute bars
//    (SERIES_INTERVAL '10m'), too coarse for the replay's 1-minute sampling
//    (BA-11, BA-24), so they are a cross-check only: aggregate10m of the
//    fetched minutes must equal each stored series bar.
//    Cap: CALL_CAP = 400 requests, counted before each request; a symbol
//    that cannot be fetched leaves its dependants not_scored with the reason.
//    Fetch order: known-answer, set of record, second set, control, main-run
//    control.
//
// M5 HORIZONS. Primary: the session close (the replay's close sample).
//    Secondary: the next check (the replay's first later sample in the same
//    session; none → not_scored), and the end of the battle — every battle
//    in this corpus is a one-session battle, so it is the same close; the
//    figure is marked hypothetical when the slot traded again later in the
//    real battle.
//
// M6 TIES AND THE LABEL. Tie: |points difference| ≤ 1, or |price difference|
//    ≤ 0.10 percentage points. The label of record is set on the primary
//    horizon, over the set of record's moments scored on BOTH measures:
//      too few to read   fewer than 15 such moments
//      learning helped   among them, on each measure separately, the learned
//                        call did better on at least 2 in 3 of the non-tied
//      learning hurt     the same, did worse
//      no clear effect   anything else
//    Descriptive: helped / hurt / tied per measure, summed differences, and a
//    two-sided exact sign test per measure (ties dropped).
//
// M7 PRECISION. When an ATR is known only to 0.1 (the body's rendering), the
//    moment is scored at that value and again at ±0.05; if any verdict
//    (helped / hurt / tie, at any horizon) differs, its points are
//    not_scored ("ATR known to 0.1 only and the verdict depends on it").
//
// M8 THE CONTROL. Over all 280 batch-check moments, every distinct SWAP that
//    is the usual call of either condition: the swap against holding,
//    scored by M2–M7 (points = swap − hold; price = move(in) − move(out)).
//    It sets no label. The main run's swaps are a second, descriptive control
//    when the call cap allows.
//
// M9 VALIDATION. The known-answer check: every recorded swap with a stored
//    replay on the 29 battle-days of the replay (the 7 tiered days — the tape
//    never replays flat6, BA-3).
//    - Layer 1 runs replayAction on the tape's own action row and checks with
//      the fetched bars: it validates the bars and the replay call. Domain:
//      every such swap. Exact match (0.005) expected.
//    - Layer 2 rebuilds each swap with THIS builder (M3) and this check-row
//      construction, and must match the tape's gapPoints and every hold- and
//      swap-path point within KA_TOLERANCE_POINTS (the tape stores whole
//      points; a 2-dp entry can move the scorer's rounding by one). Domain:
//      the swaps the builder can express — the sold name is on the positions
//      the check showed. That is every model-proposed swap; a deterministic
//      exit (archetype rule, risk manager) is taken BEFORE the prompt is
//      built, so the check never shows its sold name (and no moment scored
//      here is such an exit).
//    - THE GATE: on each layer, at least KA_MATCH_SHARE (90%) of its domain
//      matches, and each domain is non-empty. Otherwise STOP: nothing is
//      scored.
//    Beside it, the sale reconciliation (plan): over every recorded model
//    swap on the 29 battle-days, tiered and flat6, the builder's lock, exit
//    price and fill against the platform's recorded ones.
//
// ============================================================================
// CHANGES AFTER THE RUN (the BUILD_RULES §2 review; M1–M9 above are unchanged)
// ============================================================================
// The run of record (cms-20261014T202814) used this file at SHA-256 bd6b7a3e.
// The review's confirmed findings changed guards, records and tests only; the
// re-run of known-answer and score from the same bar cache reproduces every
// scored number. Ids are the review's (docs/audits/20261014_EXPERIMENT_CHANGED_MOMENTS_SCORE.md §8).
//   B3   M7 now unscores the moment's points at every horizon when a verdict moves at
//        any horizon, as M7 declares (it applied per horizon; no effect on the run).
//   B7   layer 2's domain is every model-proposed swap (source 'haiku') plus any swap the
//        check showed; a model swap without a body counts as unmatched.
//   B13  layer 2 records exact equality beside the 1-point gate.
//   B5   the series cross-check records every series read, compared, equal and skipped.
//   B2   the sale reconciliation is a gate before any bar (≥ 90% lock / exit / fill, and a
//        flat6 swap when flat6 battles exist); score stops if the lock and the replay
//        disagree at the sale with the same ATR (a stamp mismatch).
//   B6   the one-session rule (M5) is checked and gated in plan, known-answer and score.
//   B16  score stops if known-answer ran another script; honest reasons for a cache miss
//        and for a later check no path reached.
//   B8   a bench record is "exact" only when it renders to the shown bench ATR%.
//   A2 A3 B11 A6  descriptive additions to summary.postReview (none sets the label): the
//        control split, the opposite tie rule, points-vs-price agreement, the lag window.
//   B1 B9 B10 B11 B14 + the above: self-test rows S1–S22 added (78 rows).

import { hash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import { decisionKey, counts, modal, MALFORMED, parseEnvText, primaryCheckoutRoot, redactSecrets } from './growthReplay.js';
import { replayAction, composeLegs } from '../../../api/_utils/filmTape/tapeReplay.js';
import { sessionBars, sampleAt, aggregate10m } from '../../../api/_utils/filmTape/bars.js';
import { sessionFor, etDateOf, toMs } from '../../../api/_utils/filmTape/tapeTime.js';
import { tickState, ghostBaseline } from '../../../api/_utils/filmTape/tapeAssemble.js';
import { laterChecks } from '../../../api/_utils/filmTape/candleInputs.js';
import { calculateAssetScoreServer, THRESHOLD_MULTIPLIERS, getBadgesFromHistoryServer } from '../../../api/_utils/agentScoring.js';
import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { isCryptoSymbol, getCleanSymbol, formatEODHDSymbol } from '../../../api/_utils/marketDataCache.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------- frozen constants (M1–M9)

export const SOURCE_RUN = 'gr-20261008T181724';
export const BATCHCHECK_RUN = `${SOURCE_RUN}-batchcheck`;
export const CALL_CAP = 400;
export const TIE = Object.freeze({ points: 1, pricePp: 0.10 });
export const MIN_SCORED = 15;
export const KA_MATCH_SHARE = 0.9;
export const KA_TOLERANCE_POINTS = 1;
const FETCH_PAD_MS = 60 * 60 * 1000;
/** The vintage lag search (descriptive): the minute, 0–40 back from the check, whose bar close best matches the shown price (review A6: stated, not widened — a wider window finds coincidental repeats). */
export const LAG_WINDOW_MIN = 40;
const EPS = 1e-9;
const RUNS_ROOT = path.join(os.homedir(), 'growth-replay-runs');
const RUN_PREFIX = 'cms-';
const EODHD = 'https://eodhd.com/api';

// ---------------------------------------------------------------- small helpers

const sha256 = (s) => hash('sha256', s, 'hex');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (x, d = 2) => (isNum(x) ? Number(x.toFixed(d)) : null);
const iso = (ms) => new Date(ms).toISOString();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 1)}\n`);
  renameSync(tmp, p);
}
function stop(message, code = 2) {
  console.error(`\nSTOP: ${redactEodhd(redactSecrets(message))}`);
  process.exit(code);
}
/** An EODHD URL carries the key as a query parameter: never let one reach a log. */
export function redactEodhd(text) {
  return String(text).replace(/api_token=[^&\s"']*/g, 'api_token=[REDACTED]');
}

// ---------------------------------------------------------------- M1: moments

/** 'SWAP:X>Y' → { out: 'X', in: 'Y' }; anything else → null. */
export function parseSwap(fine) {
  const m = typeof fine === 'string' ? /^SWAP:([^>]+)>(.+)$/.exec(fine) : null;
  return m ? { out: m[1], in: m[2] } : null;
}

/** The kind of a flipped moment, from its two usual calls. */
export function classify(withL, withoutL) {
  if (withL === MALFORMED || withoutL === MALFORMED) return 'unscorable';
  if (withL === withoutL) throw new Error('classify: not a changed moment');
  const a = parseSwap(withL); const b = parseSwap(withoutL);
  if (withL === 'HOLD' && b) return 'stopped';
  if (a && withoutL === 'HOLD') return 'caused';
  if (a && b) return 'changed_pick';
  throw new Error(`classify: unknown calls ${withL} / ${withoutL}`);
}

/** Every returned decision of a replay run under the key of record, by tick and condition. */
function loadRunKeys(runId) {
  const dir = path.join(RUNS_ROOT, runId);
  if (!existsSync(path.join(dir, 'manifest.json'))) stop(`the replay run folder ${dir} is missing (rule 7)`);
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const sources = {};
  for (const l of readFileSync(path.join(dir, 'source-requests.jsonl'), 'utf8').split('\n')) { if (!l.trim()) continue; const s = JSON.parse(l); sources[s.k] = s; }
  const results = {};
  for (const f of readdirSync(path.join(dir, 'results')).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(path.join(dir, 'results', f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      if (r.result?.type === 'succeeded') results[Number(r.custom_id.slice(3))] = r.result.message;
    }
  }
  const keys = {};
  manifest.runPlan.tasks.forEach((task, i) => {
    const [k, arm, variant] = task;
    if (arm !== 'base' && arm !== 'memory') return;
    const cond = arm === 'memory' ? `memory:${variant}` : 'base';
    if (!results[i]) return;
    ((keys[k] ||= {})[cond] ||= []).push(decisionKey(results[i], sources[k].request.tools[0].input_schema).fine);
  });
  return { dir, manifest, sources, keys };
}

/** The usual calls of each tick, and the ticks whose usual call differs between the two conditions. */
export function usualCalls(keys, tickKeys) {
  const out = [];
  for (const k of tickKeys) {
    const base = keys[k]?.base; const strip = keys[k]?.['memory:strip'];
    if (!base?.length || !strip?.length) continue;
    const cb = counts(base); const cs = counts(strip);
    const withL = modal(cb); const withoutL = modal(cs);
    out.push({ k, withL, withoutL, voteWith: { n: base.length, modal: cb[withL], dist: cb }, voteWithout: { n: strip.length, modal: cs[withoutL], dist: cs }, flipped: withL !== withoutL });
  }
  return out;
}

// ---------------------------------------------------------------- the request body (what the agent was shown)

/** Split one CSV row, keeping a bracketed cell ([bagger,doubleBagger]) whole. */
export function splitRow(line) {
  const cells = []; let cur = ''; let depth = 0;
  for (const ch of line) {
    if (ch === '[') depth += 1;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}
const money = (s) => { const m = /^\$(-?[0-9.]+)$/.exec(String(s ?? '').trim()); return m ? Number(m[1]) : null; };
const pct = (s) => { const m = /^([+-]?[0-9.]+)%$/.exec(String(s ?? '').trim()); return m ? Number(m[1]) : null; };

/**
 * The ACTIVE POSITIONS and BENCH tables of the live context, exactly as
 * buildPortfolioCSV / buildBenchCSV render them (agentEvalPromptAssembly.js):
 * the held rows by symbol (tier, $Entry, $Current, Badges, ATR%, LockNow) and
 * the bench rows by symbol ($Current, ATR%, Status).
 */
export function parseBody(content) {
  const out = { positions: {}, bench: {}, problems: [] };
  if (typeof content !== 'string') { out.problems.push('no_live_context'); return out; }
  const lines = content.split('\n');
  const tableAfter = (headerLine) => {
    const i = lines.findIndex((l) => l === headerLine);
    if (i === -1) return null;
    const header = splitRow(lines[i + 1] || '');
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim() !== ''; j += 1) rows.push(splitRow(lines[j]));
    return { header, rows };
  };
  const pos = tableAfter('ACTIVE POSITIONS:');
  if (!pos) out.problems.push('no_positions_table');
  else {
    const col = (name) => pos.header.indexOf(name);
    for (const r of pos.rows) {
      const sym = r[col('Symbol')];
      if (!sym) continue;
      const badgesCell = r[col('Badges')] ?? '';
      const lock = /^([+-]?\d+)\(/.exec(r[col('LockNow(base/badges)')] ?? '');
      out.positions[sym] = {
        tier: col('Tier') >= 0 ? r[col('Tier')] : null,
        entry: money(r[col('$Entry')]),
        current: money(r[col('$Current')]),
        badges: badgesCell.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean),
        atrPct: pct(r[col('ATR%')]),
        lockNow: lock ? Number(lock[1]) : null,
        entryCell: r[col('$Entry')] ?? null,
      };
    }
  }
  const bench = tableAfter('BENCH (available for swap):');
  if (bench) {
    const col = (name) => bench.header.indexOf(name);
    for (const r of bench.rows) {
      const sym = r[col('Symbol')];
      if (!sym) continue;
      out.bench[sym] = { current: money(r[col('$Current')]), atrPct: pct(r[col('ATR%')]), status: r[col('Status')] ?? null };
    }
  }
  return out;
}

// ---------------------------------------------------------------- M3: the threshold history from the badges

const UP = ['tenBagger', 'doubleBagger', 'bagger'];
const DOWN = ['meltdown', 'crash', 'bust'];
/** A history inside the band the shown badges name (M3; self-test S7). Unknown badge → null. */
export function historyFromBadges(badges) {
  if (!Array.isArray(badges) || badges.some((b) => !UP.includes(b) && !DOWN.includes(b))) return null;
  const up = UP.find((b) => badges.includes(b));
  const down = DOWN.find((b) => badges.includes(b));
  return { maxMultiplier: up ? THRESHOLD_MULTIPLIERS[up] : 0, minMultiplier: down ? THRESHOLD_MULTIPLIERS[down] : 0 };
}

// ---------------------------------------------------------------- M3: the battle at the check

/**
 * The slots at instant `atMs`: the final portfolio with every LATER trade
 * undone, newest first. Each slot: { tier, slotIndex, symbol, asset (the
 * final record when the occupant never changed after atMs, else null) }.
 */
export function slotsAt(battle, atMs) {
  const slots = [];
  for (const tier of ['star', 'core', 'support']) (battle.finalSlots || []).filter((s) => s.tier === tier).forEach((s) => slots.push({ ...s, asset: s }));
  const later = (battle.trades || []).filter((t) => toMs(t.swappedOutAt) > atMs).sort((a, b) => toMs(b.swappedOutAt) - toMs(a.swappedOutAt));
  const problems = [];
  for (const t of later) {
    const slot = slots.find((s) => s.tier === t.tier && s.slotIndex === t.slotIndex);
    if (!slot) { problems.push(`no slot ${t.tier}[${t.slotIndex}]`); continue; }
    if (slot.symbol !== t.symbolIn) problems.push(`slot ${t.tier}[${t.slotIndex}] holds ${slot.symbol}, trade brought ${t.symbolIn}`);
    slot.symbol = t.symbolOut; slot.asset = null; slot.undoneTrade = t;
  }
  return { slots, problems };
}

/** The exact entry candidates for X held at atMs, best first (M3). */
function entryCandidates(battle, x, atMs, slot) {
  const c = [];
  const bought = (battle.tickActions || []).filter((a) => a.committed && a.symbolIn === x && toMs(a.swappedOutAt) < atMs && isNum(a.entryPrice) && a.entryPrice > 0)
    .sort((a, b) => toMs(b.swappedOutAt) - toMs(a.swappedOutAt))[0];
  const boughtTrade = (battle.trades || []).filter((t) => t.symbolIn === x && toMs(t.swappedOutAt) < atMs).sort((a, b) => toMs(b.swappedOutAt) - toMs(a.swappedOutAt))[0];
  if (boughtTrade || bought) {
    if (bought) c.push({ value: bought.entryPrice, source: 'ticks.actions.entryPrice (the fill that brought X in)', swappedInAt: bought.swappedOutAt });
    const soldLater = (battle.trades || []).filter((t) => t.symbolOut === x && toMs(t.swappedOutAt) > atMs && isNum(t.entryPrice) && t.entryPrice > 0).sort((a, b) => toMs(a.swappedOutAt) - toMs(b.swappedOutAt))[0];
    if (soldLater) c.push({ value: soldLater.entryPrice, source: 'trades.entryPrice (the later sale of X)', swappedInAt: boughtTrade?.swappedOutAt ?? bought?.swappedOutAt });
    const a = slot?.asset;
    if (a && isNum(a.swapPrice) && a.swapPrice > 0) c.push({ value: a.swapPrice, source: 'portfolio swapPrice', swappedInAt: a.swappedInAt });
    if (a && isNum(a.previousSwapPrice) && a.previousSwapPrice > 0) c.push({ value: a.previousSwapPrice, source: 'portfolio previousSwapPrice', swappedInAt: a.swappedInAt });
    return { swappedIn: true, swappedInAt: boughtTrade?.swappedOutAt ?? bought?.swappedOutAt, candidates: c };
  }
  if (isNum(battle.startingPrices?.[x]) && battle.startingPrices[x] > 0) c.push({ value: battle.startingPrices[x], source: 'portfolio.startingPrices' });
  return { swappedIn: false, swappedInAt: null, candidates: c };
}

/** X's held-asset baseATR candidates, best first (M3). */
function atrCandidates(battle, x, atMs, slot) {
  const c = [];
  if (slot?.asset && isNum(slot.asset.baseATR)) c.push({ value: slot.asset.baseATR, source: 'portfolio baseATR' });
  const rec = (battle.receipts || []).filter((r) => r.symbolOut === x && toMs(r.timestamp) > atMs && isNum(r.outgoingBaseATR)).sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp))[0];
  if (rec) c.push({ value: rec.outgoingBaseATR, source: 'receipt outgoingBaseATR' });
  const bench = (battle.bench || []).find((b) => b.symbol === x && isNum(b.baseATR));
  if (bench) c.push({ value: bench.baseATR, source: 'bench baseATR' });
  return c;
}

const rendersAs = (value, cell, dp) => isNum(value) && isNum(cell) && value.toFixed(dp) === cell.toFixed(dp);

/**
 * M3 — everything one swap X→Y at one check needs, or the reasons it cannot
 * be built. `check` = { tickSeq, capturedAt, shownAt (the prompt's build instant), evidence (X → {px}) }; `body` =
 * parseBody of that check's live context.
 */
export function buildSwapInputs({ battle, check, body, out: x, in: y }) {
  const missing = [];
  // The state the agent was SHOWN: the battle as it stood when the prompt was built — before any swap this check made.
  const atMs = toMs(check.shownAt ?? check.capturedAt);
  const session = sessionFor(etDateOf(check.capturedAt));
  const gameMode = battle.gameMode;
  const tierStamp = resolveModeConfig(gameMode).flatMultiplier;
  const flags = [];
  if (isCryptoSymbol(x) || isCryptoSymbol(y)) return { ok: false, missing: ['crypto_not_supported'], flags };
  const shown = body?.positions?.[x];
  if (!shown) return { ok: false, missing: [body ? 'X not on the shown positions' : 'no request body'], flags };
  const benchY = body.bench[y];
  if (!benchY || !isNum(benchY.current) || benchY.current <= 0) missing.push('Y not on the shown bench');
  if (benchY?.status && benchY.status !== 'available') flags.push('Y shown with a cooldown lock');
  const { slots, problems } = slotsAt(battle, atMs);
  if (problems.length) flags.push('slot reconstruction disagreed with a trade');
  const slot = slots.find((s) => s.symbol === x) || null;
  if (!slot) missing.push('X not in a reconstructed slot');
  if (slot && shown.tier && shown.tier !== slot.tier) missing.push('X tier disagrees with the shown tier');

  // X's entry: the exact record that renders to the shown $Entry.
  const ent = entryCandidates(battle, x, atMs, slot);
  const entry = ent.candidates.find((c) => rendersAs(c.value, shown.entry, 2)) || null;
  if (!entry) missing.push('X entry: no record renders to the shown $Entry');
  // X's baseline: the tape's own rule (ghostBaseline).
  const baseline = entry ? ghostBaseline({
    receipt: ent.swappedIn ? { guardrailReplay: { outgoingSwappedInDay: etDateOf(ent.swappedInAt) === etDateOf(check.capturedAt) ? 1 : null } } : {},
    entryPrice: entry.value, swappedOutAt: check.capturedAt, activatedAt: battle.activatedAt,
  }) : { value: null, basis: null };
  if (entry && !(isNum(baseline.value) && baseline.basis)) missing.push('ghost.thresholdBaseline: the previous close, which no record holds');
  // X's history: the band the shown badges name.
  const history = historyFromBadges(shown.badges);
  if (!history) missing.push('X badges unreadable');
  // X's ATR.
  const atrC = atrCandidates(battle, x, atMs, slot);
  let ghostAtr = atrC.find((c) => rendersAs(c.value, shown.atrPct, 1)) || null;
  if (!ghostAtr && isNum(shown.atrPct)) { ghostAtr = { value: shown.atrPct, source: 'body ATR% (1 dp)', coarse: true }; }
  if (!ghostAtr) missing.push('ghost.atr');
  // The sale's price: the capture's evidence price (the delayed quote shown).
  const px = isNum(check.evidence?.[x]?.px) ? check.evidence[x].px : null;
  if (px === null) missing.push('evidence px for X missing');
  if (px !== null && isNum(shown.current) && px.toFixed(2) !== shown.current.toFixed(2)) flags.push('evidence px differs from the shown $Current');
  // Y's ATR: executeSwapServer's incoming literal.
  const thrY = battle.thresholds?.[y];
  // A persisted bench record is accepted only when it renders to the shown bench ATR% (review B8):
  // a synthetic bench name's ATR is rebuilt at every check, so a later record may not be the shown one.
  const benchRec = (battle.bench || []).find((b) => b.symbol === y && isNum(b.baseATR) && rendersAs(b.baseATR, benchY?.atrPct, 1));
  const boughtAtr = isNum(thrY) && thrY > 0 ? { value: thrY, source: 'scoring.thresholds[Y].threshold' }
    : (benchRec ? { value: benchRec.baseATR, source: 'bench baseATR' } : (isNum(benchY?.atrPct) ? { value: benchY.atrPct, source: 'body bench ATR% (1 dp)', coarse: true } : null));
  if (!boughtAtr) missing.push('bought.atr');

  if (missing.length) return { ok: false, missing, flags };
  const tier = slot.tier;
  const ghost = { entryPrice: entry.value, atr: ghostAtr.value, tier, direction: slot.asset?.direction ?? null, thresholdHistory: history, thresholdBaseline: { value: baseline.value, basis: baseline.basis } };
  const thrX = isNum(battle.thresholds?.[x]) && battle.thresholds[x] > 0 ? battle.thresholds[x] : null;
  const lockParams = { symbol: x, entryPrice: ghost.entryPrice, baseline: ghost.thresholdBaseline.value, history, atr: thrX ?? (ghost.atr || 2.5), tier, direction: ghost.direction, tierStamp, px };
  const lockedPoints = lockAt(lockParams);
  const bought = { entryPrice: benchY.current, atr: boughtAtr.value, tier, direction: null, thresholdHistory: { maxMultiplier: 0, minMultiplier: 0 }, thresholdBaseline: { value: benchY.current, basis: 'swap_price' } };
  if (isNum(shown.lockNow) && shown.lockNow !== lockedPoints) flags.push('lock differs from the shown LockNow');
  return {
    ok: true, missing: [], flags,
    coarseAtr: { ghost: Boolean(ghostAtr.coarse), bought: Boolean(boughtAtr.coarse), lock: thrX === null && Boolean(ghostAtr.coarse) },
    lockParams,
    sources: { entry: entry.source, ghostAtr: ghostAtr.source, boughtAtr: boughtAtr.source, lockAtr: thrX !== null ? 'scoring.thresholds[X].threshold' : ghostAtr.source, baseline: baseline.basis },
    session, tierStamp,
    action: {
      key: `hyp:${check.tickSeq}|${x}|${y}`, at: check.capturedAt, tickSeq: check.tickSeq, symbolOut: x, symbolIn: y,
      lockedPoints, exitPrice: px, inBasis: { price: benchY.current, at: check.capturedAt },
      replayInputs: { ghost, bought }, replayMissing: [], subsequentTradesInSlot: null,
    },
    shownPx: { out: px, in: benchY.current },
    slot: { tier, slotIndex: slot.slotIndex },
  };
}

/** The lock a sale of X at `px` banks: executeSwapServer's own scorer call (M3). */
export function lockAt({ symbol, entryPrice, baseline, history, atr, tier, direction, tierStamp, px }) {
  const asset = { symbol, baseATR: atr, tier, direction: direction ?? null, ...(tierStamp != null ? { tierMultiplier: tierStamp } : {}) };
  const priceChange = ((px - entryPrice) / entryPrice) * 100;
  const tpc = isNum(baseline) && baseline > 0 ? ((px - baseline) / baseline) * 100 : null;
  return Math.round(calculateAssetScoreServer(asset, priceChange, history, {}, tpc).totalPoints * 100) / 100;
}

/**
 * M7 — with a coarse ATR, the same inputs with the held name's ATR moved by
 * `dGhost` (and the lock's, when the lock read the same coarse value) and the
 * bought name's by `dBought`.
 */
export function withAtrShift(inputs, dGhost, dBought) {
  const a = JSON.parse(JSON.stringify(inputs.action));
  if (inputs.coarseAtr.ghost) a.replayInputs.ghost.atr = round(a.replayInputs.ghost.atr + dGhost, 4);
  if (inputs.coarseAtr.bought) a.replayInputs.bought.atr = round(a.replayInputs.bought.atr + dBought, 4);
  if (inputs.coarseAtr.lock) a.lockedPoints = lockAt({ ...inputs.lockParams, atr: round(inputs.lockParams.atr + dGhost, 4) });
  return { ...inputs, action: a };
}

/** M7 — the corners of the coarse ATRs' rounding box: ±0.05 on each coarse leg. */
export function atrCorners(coarseAtr) {
  const g = coarseAtr.ghost || coarseAtr.lock ? [-0.05, 0.05] : [0];
  const b = coarseAtr.bought ? [-0.05, 0.05] : [0];
  return g.flatMap((dg) => b.map((db) => [dg, db])).filter(([dg, db]) => dg !== 0 || db !== 0);
}

// ---------------------------------------------------------------- M2: path values at a horizon

/**
 * A swap's values at the close and at the next check, from replayAction's
 * output: hold = the held name's path, swap = lock + the bought name's path.
 */
export function pathValues(replay) {
  const at = (list, i) => (Array.isArray(list) && list[i] && isNum(list[i].points) ? list[i].points : null);
  const holdN = replay?.holdPath?.length ?? 0;
  const swapN = replay?.swapPath?.length ?? 0;
  const hasNext = holdN > 2 || swapN > 2;
  return {
    close: { hold: at(replay?.holdPath, holdN - 1), swap: at(replay?.swapPath, swapN - 1) },
    next: hasNext ? { hold: at(replay?.holdPath, 1), swap: at(replay?.swapPath, 1), at: replay?.holdPath?.[1]?.at ?? replay?.swapPath?.[1]?.at ?? null } : null,
  };
}

/** % move from `from` to the fresh 1-minute price at `atMs` (BA-24), or null with the reason. */
export function moveAt(bars, from, atMs, sym) {
  if (!bars) return { v: null, why: `bars:${sym}` };
  const s = sampleAt(bars, atMs);
  if (!s?.valid) return { v: null, why: `price:${sym}@${iso(atMs)}` };
  return { v: ((s.price - from) / from) * 100, why: null };
}

/**
 * M2 — the difference between two calls at one horizon, for one measure.
 * `legs[call]` = per swap call { hold, swap } (points) or { holdMove, swapMove } (price).
 * Returns { status: 'scored', delta } or { status: 'not_scored', reason }.
 */
export function callDifference(withL, withoutL, comp) {
  const a = parseSwap(withL); const b = parseSwap(withoutL);
  const outs = [...new Set([a?.out, b?.out].filter(Boolean))];
  const value = (call, sw) => {
    let v = 0;
    for (const x of outs) {
      if (sw && sw.out === x) {
        const c = comp[call];
        if (!c || !isNum(c.swap)) return { why: c?.swapWhy || `no swap value for ${call}` };
        v += c.swap;
      } else {
        // The held name's leg — from whichever call swaps that slot (the same hold path).
        const owner = [withL, withoutL].find((k) => parseSwap(k)?.out === x);
        const c = comp[owner];
        if (!c || !isNum(c.hold)) return { why: c?.holdWhy || `no hold value for ${x}` };
        v += c.hold;
      }
    }
    return { v };
  };
  // A changed pick with the same OUT: both swap the slot; the held leg is not needed.
  const va = value(withL, a); const vb = value(withoutL, b);
  if (va.why || vb.why) return { status: 'not_scored', reason: va.why || vb.why };
  return { status: 'scored', delta: va.v - vb.v };
}

// ---------------------------------------------------------------- M6: verdicts, label, sign test

export function verdict(delta, band) {
  if (!isNum(delta)) return null;
  if (delta > band + EPS) return 'helped';
  if (delta < -band - EPS) return 'hurt';
  return 'tie';
}

/** M6 — the label of record from the primary-horizon rows of the set of record. */
export function labelOf(rows) {
  const both = rows.filter((r) => r.points?.status === 'scored' && r.price?.status === 'scored');
  const tally = (m, band) => {
    const t = { helped: 0, hurt: 0, tie: 0 };
    for (const r of both) t[verdict(r[m].delta, band)] += 1;
    return t;
  };
  const pts = tally('points', TIE.points); const prc = tally('price', TIE.pricePp);
  const twoInThree = (n, of) => of > 0 && 3 * n >= 2 * of;
  const helped = (t) => twoInThree(t.helped, t.helped + t.hurt);
  const hurt = (t) => twoInThree(t.hurt, t.helped + t.hurt);
  let label;
  if (both.length < MIN_SCORED) label = 'too few to read';
  else if (helped(pts) && helped(prc)) label = 'learning helped';
  else if (hurt(pts) && hurt(prc)) label = 'learning hurt';
  else label = 'no clear effect';
  return { label, scoredBoth: both.length, points: pts, price: prc };
}

/** Two-sided exact sign test (ties dropped): p = min(1, 2·P(X ≤ min(h, u))), X ~ Bin(h+u, ½). */
export function signTest(h, u) {
  const n = h + u;
  if (n === 0) return null;
  const k = Math.min(h, u);
  let c = 1; let s = 0; // C(n, 0)
  for (let i = 0; i <= k; i += 1) { s += c; c = (c * (n - i)) / (i + 1); }
  return Math.min(1, (2 * s) / 2 ** n);
}

/** Descriptive tallies of one measure over the rows scored on it. */
export function describe(rows, m, band) {
  const scored = rows.filter((r) => r[m]?.status === 'scored');
  const t = { scored: scored.length, helped: 0, hurt: 0, tie: 0, sum: 0, notScored: rows.length - scored.length };
  for (const r of scored) { t[verdict(r[m].delta, band)] += 1; t.sum += r[m].delta; }
  t.sum = round(t.sum, 2);
  t.signTestP = signTest(t.helped, t.hurt);
  return t;
}

/**
 * M9 — the known-answer gate. rows: [{ layer1: { match }, layer2: { inDomain, match } }].
 * Each layer needs a non-empty domain and at least KA_MATCH_SHARE of it matching.
 */
export function kaGate(rows) {
  const d1 = rows.length; const m1 = rows.filter((r) => r.layer1.match).length;
  const dom2 = rows.filter((r) => r.layer2.inDomain); const m2 = dom2.filter((r) => r.layer2.match).length;
  const ok = (m, d) => d > 0 && m / d >= KA_MATCH_SHARE - EPS;
  return { layer1: { domain: d1, matched: m1 }, layer2: { domain: dom2.length, matched: m2 }, pass: ok(m1, d1) && ok(m2, dom2.length) };
}

// ---------------------------------------------------------------- M4: bars, with the call counter

/**
 * The call counter: refuses a request past the cap BEFORE it is made, and
 * records every request it lets through (manifest.eodhd), whatever its result.
 */
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

/** The candle pass's own filters on raw EODHD rows (marketDataCache.js fetchIntradayCandles). */
export function cleanCandles(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((d) => [d.open, d.high, d.low, d.close].every(Number.isFinite))
    .filter((d) => !((d.volume === null || d.volume === undefined) && d.open === d.high && d.high === d.low && d.low === d.close))
    .map((d) => ({ datetime: d.datetime || new Date(d.timestamp * 1000).toISOString(), open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume || 0 }));
}

/**
 * M4 — one request per symbol spanning every day it is needed, in priority
 * order: `stages` is a list of need-lists (known-answer first); a symbol's
 * priority is the first stage that needs it, then its name.
 */
export function fetchPlan(stages) {
  const bySym = {};
  stages.forEach((needs, stage) => {
    for (const { symbol, etDate } of needs) {
      const e = (bySym[symbol] ||= { days: {}, stage });
      e.days[etDate] = true;
    }
  });
  return Object.entries(bySym).map(([symbol, e]) => {
    const ds = Object.keys(e.days).sort();
    const s0 = sessionFor(ds[0]); const s1 = sessionFor(ds[ds.length - 1]);
    return { symbol, stage: e.stage, days: ds, fromMs: s0.openMs - FETCH_PAD_MS, toMs: s1.closeMs + FETCH_PAD_MS };
  }).sort((a, b) => a.stage - b.stage || (a.symbol < b.symbol ? -1 : 1));
}

async function fetchSymbol(plan, key) {
  const eod = formatEODHDSymbol(getCleanSymbol(plan.symbol), false);
  const url = `${EODHD}/intraday/${eod}?api_token=${key}&fmt=json&interval=1m&from=${Math.floor(plan.fromMs / 1000)}&to=${Math.floor(plan.toMs / 1000)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data)) return { ok: false, error: 'not an array' };
    return { ok: true, rows: cleanCandles(data), rawCount: data.length };
  } catch (err) {
    return { ok: false, error: redactEodhd(String(err?.message || err)).slice(0, 120) };
  }
}

/**
 * Bars for every needed (symbol, day), from the run's cache or one counted
 * request per symbol. Returns barsOf(symbol, etDate) → session bars | null,
 * and why a symbol has none.
 */
async function ensureBars(dir, manifest, manifestPath, stages, env, { allowFetch = true } = {}) {
  const cacheDir = path.join(dir, 'bars');
  mkdirSync(cacheDir, { recursive: true });
  manifest.eodhd ||= { cap: CALL_CAP, calls: 0, log: [], failures: {} };
  const counter = makeCounter(manifest.eodhd, CALL_CAP, () => writeJsonAtomic(manifestPath, manifest));
  const plans = fetchPlan(stages);
  const why = {};
  for (const p of plans) {
    const file = path.join(cacheDir, `${p.symbol}.json`);
    if (existsSync(file)) {
      const c = readJson(file);
      if (p.days.every((d) => c.days.includes(d))) continue;
    }
    // A cache-only read names the real cause (review B16c): a recorded failure, the cap, or simply not fetched.
    if (!allowFetch) { why[p.symbol] = manifest.eodhd.failures[p.symbol] ? `fetch failed: ${manifest.eodhd.failures[p.symbol]}` : (manifest.eodhd.calls >= CALL_CAP ? 'call cap reached' : 'not in the cache (not fetched)'); continue; }
    if (!env.EODHD_API_KEY) stop('EODHD_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s).');
    if (!counter.take(p.symbol)) { why[p.symbol] = 'call cap reached'; continue; }
    const r = await fetchSymbol(p, env.EODHD_API_KEY);
    if (!r.ok) { why[p.symbol] = `fetch failed: ${r.error}`; manifest.eodhd.failures[p.symbol] = r.error; writeJsonAtomic(manifestPath, manifest); continue; }
    const prior = existsSync(file) ? readJson(file) : { days: [], rows: [] };
    const rows = [...prior.rows, ...r.rows];
    writeJsonAtomic(file, { symbol: p.symbol, days: [...new Set([...prior.days, ...p.days])].sort(), rows });
  }
  const memo = {};
  const barsOf = (symbol, etDate) => {
    const k = `${symbol}|${etDate}`;
    if (k in memo) return memo[k];
    const file = path.join(cacheDir, `${symbol}.json`);
    if (!existsSync(file)) { memo[k] = null; return null; }
    const bars = sessionBars(readJson(file).rows, etDate, sessionFor(etDate));
    memo[k] = bars.length ? bars : null;
    return memo[k];
  };
  // A fetch that returned no session bars for a needed day is named too (review B16, related gap).
  for (const p of plans) {
    if (why[p.symbol]) continue;
    const empty = p.days.filter((d) => !barsOf(p.symbol, d));
    if (empty.length) why[p.symbol] = `no session bars for ${empty.join(', ')}`;
  }
  return { barsOf, why };
}

// ---------------------------------------------------------------- env + Firestore (read-only)

function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const env = {};
  for (const f of files) if (existsSync(f)) for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (env[k] === undefined) env[k] = v;
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  return env;
}

async function openFirestore(env) {
  let sa = null;
  if (env.FIREBASE_ADMIN_CREDENTIALS) { try { sa = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS); } catch { sa = null; } }
  if (!sa && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    sa = { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  }
  if (!sa || typeof sa.private_key !== 'string') stop('no Firebase service account (value not printed).');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  let credential;
  try { credential = cert(sa); } catch { stop('the Firebase service account was rejected (value not printed).'); }
  return getFirestore(initializeApp({ credential }, 'changed-moments-score'));
}

const plain = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);

/** READ-ONLY: one battle's facts this experiment reads, for the ET days it needs. */
async function readBattle(db, battleId, etDates) {
  const ref = db.collection('agentBattles').doc(battleId);
  const d = (await ref.get()).data();
  const days = new Set(etDates);
  const finalSlots = [];
  for (const tier of ['star', 'core', 'support']) (d.portfolio?.[tier] || []).forEach((a, i) => finalSlots.push({ tier, slotIndex: i, symbol: a.symbol, baseATR: a.baseATR ?? null, swapPrice: a.swapPrice ?? null, previousSwapPrice: a.previousSwapPrice ?? null, swappedInAt: plain(a.swappedInAt) ?? null, direction: a.direction ?? null, isCrypto: a.isCrypto === true }));
  const bench = [...(d.portfolio?.bench?.stocks || []), ...(d.portfolio?.bench?.crypto ? [d.portfolio.bench.crypto] : [])].map((a) => ({ symbol: a.symbol, baseATR: a.baseATR ?? null }));
  const thresholds = Object.fromEntries(Object.entries(d.scoring?.thresholds || {}).map(([s, v]) => [s, v?.threshold ?? null]));
  const trades = (d.trades || []).map((t) => ({ tier: t.tier, slotIndex: t.slotIndex, symbolOut: t.symbolOut, symbolIn: t.symbolIn, entryPrice: t.entryPrice ?? null, exitPrice: t.exitPrice ?? null, lockedPoints: t.lockedPoints ?? null, swappedOutAt: plain(t.swappedOutAt), source: t.source ?? null, isCrypto: t.isCrypto === true, evaluationId: t.evaluationId ?? null }));
  const evaluations = (d.evaluations || []).filter((e) => days.has(etDateOf(e.timestamp))).map((e) => ({
    evalId: e.evalId ?? null, timestamp: plain(e.timestamp), promptBuiltAt: plain(e.promptBuiltAt) ?? null,
    evidence: Object.fromEntries(Object.entries(e.evidence || {}).map(([s, v]) => [s, { px: v?.px ?? null }])),
    haikuFailureClass: e.haikuError?.failureClass ?? null,
  }));
  const tickDocs = (await ref.collection('ticks').get()).docs.map((t) => t.data()).filter((t) => days.has(etDateOf(t.capturedAt)));
  const entryByEval = new Map((d.evaluations || []).filter((e) => e.evalId).map((e) => [e.evalId, e]));
  const ticks = tickDocs.map((t) => ({
    tickSeq: t.tickSeq, tickId: t.tickId, evalId: t.evalId ?? null, capturedAt: t.capturedAt, stageReached: t.stageReached ?? null,
    state: tickState(t, t.evalId ? entryByEval.get(t.evalId) : null),
    decision: { original: t.decision?.original ?? null, final: t.decision?.final ?? null, finalSymbolOut: t.decision?.finalSymbolOut ?? null, finalSymbolIn: t.decision?.finalSymbolIn ?? null },
    actions: (t.actions || []).map((a) => ({ symbolOut: a.symbolOut, symbolIn: a.symbolIn, swappedOutAt: a.swappedOutAt, entryPrice: a.entryPrice ?? null, lockedPoints: a.lockedPoints ?? null, committed: a.committed === true, source: a.source ?? null, kind: a.kind ?? null })),
    body: { requestSha256: t.body?.requestSha256 ?? null, requestBytes: t.body?.requestBytes ?? null, status: t.body?.status ?? null },
  })).sort((a, b) => a.tickSeq - b.tickSeq);
  const receipts = (await db.collection('learningReceipts').doc(battleId).collection('receipts').get()).docs.map((r) => r.data())
    .map((r) => ({ symbolOut: r.symbolOut, symbolIn: r.symbolIn, timestamp: plain(r.timestamp), outgoingBaseATR: r.guardrailReplay?.outgoingBaseATR ?? null, entryATR: r.entryATR ?? null, entryMark: r.entryMark ?? null }));
  return {
    battleId, gameMode: d.gameMode ?? null, duration: d.duration ?? null, activatedAt: plain(d.activatedAt) ?? null, completedAt: plain(d.completedAt) ?? null,
    tradingDays: d.timing?.tradingDays ?? null, startingPrices: d.portfolio?.startingPrices || {}, thresholds, finalSlots, bench, trades, evaluations, ticks, receipts,
    tickActions: ticks.flatMap((t) => t.actions),
  };
}

/** The check rows of one ET day, as the tape builds them: ticks, plus evaluation entries with no tick. */
export function checkRows(battle, etDate) {
  const ticks = battle.ticks.filter((t) => etDateOf(t.capturedAt) === etDate);
  const tickEval = new Set(ticks.map((t) => t.evalId).filter(Boolean));
  const rows = ticks.map((t) => ({ key: `seq:${t.tickSeq}`, rowSource: 'tick', tickSeq: t.tickSeq, at: t.capturedAt, state: t.state, stageReached: t.stageReached }));
  for (const e of battle.evaluations.filter((x) => etDateOf(x.timestamp) === etDate && !(x.evalId && tickEval.has(x.evalId)))) {
    rows.push({ key: e.evalId ? `eval:${e.evalId}` : `eval-ts:${e.timestamp}`, rowSource: 'entry', tickSeq: null, at: e.timestamp, state: e.haikuFailureClass === 'budget_skipped' ? 'budget_skipped' : 'completed', stageReached: null });
  }
  return rows.sort((a, b) => toMs(a.at) - toMs(b.at));
}

/** The check a tick is: its instant, its sequence, and the evidence prices its evaluation entry stamped. */
function checkOf(battle, tick) {
  const e = tick.evalId ? battle.evaluations.find((x) => x.evalId === tick.evalId) : null;
  return { tickSeq: tick.tickSeq, capturedAt: tick.capturedAt, shownAt: e?.promptBuiltAt ?? null, evidence: e?.evidence || null };
}

/** What the live battle did at that check: its committed swaps, else its final decision. */
function liveDid(tick) {
  const sw = tick.actions.filter((a) => a.committed).map((a) => `SWAP ${a.symbolOut}→${a.symbolIn}${a.source && a.source !== 'haiku' ? ` (${a.source})` : ''}`);
  return sw.length ? sw.join(' + ') : (tick.decision.final ?? 'unrecorded');
}

// ---------------------------------------------------------------- runs

function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}
const scriptSha = () => sha256(readFileSync(SCRIPT_PATH));
function stamp(manifest, cmd) {
  (manifest.commands ||= []).push({ cmd, at: new Date().toISOString(), scriptSha256: scriptSha(), head: headSha() });
}
function resolveRun(flags) {
  let runId = flags.run;
  if (!runId) {
    const all = existsSync(RUNS_ROOT) ? readdirSync(RUNS_ROOT).filter((x) => x.startsWith(RUN_PREFIX)).sort() : [];
    runId = all[all.length - 1];
  }
  if (!runId || !/^cms-\d{8}T\d{6}$/.test(runId)) stop('no changed-moments run — run `plan` first');
  const dir = path.join(RUNS_ROOT, runId);
  return { runId, dir, manifestPath: path.join(dir, 'manifest.json') };
}

/** The (symbol, ET day) pairs a list of swap calls needs bars for; crypto legs are not scored. */
function unitNeeds(meta, units) {
  return units.flatMap(({ k, call }) => {
    const sw = parseSwap(call);
    if (!sw || isCryptoSymbol(sw.out) || isCryptoSymbol(sw.in)) return [];
    return [{ symbol: sw.out, etDate: meta[k].day }, { symbol: sw.in, etDate: meta[k].day }];
  });
}
const swapUnits = (rows) => rows.flatMap((r) => [r.withL, r.withoutL].filter(parseSwap).map((call) => ({ k: r.k, call })));
/** Every swap call the run scores: the set of record's, the second set's, and both controls'. */
const allUnits = (snap) => [...swapUnits(snap.moments.record), ...swapUnits(snap.moments.second), ...snap.control, ...snap.controlMain];
/** The recorded, committed, non-crypto swaps on the tiered battle-days: the known-answer's bars. */
function recordedSwapNeeds(battles) {
  const out = [];
  for (const b of Object.values(battles)) {
    if (b.gameMode !== 'baggerbomb_agent') continue;
    for (const t of b.ticks) for (const a of t.actions.filter((x) => x.committed)) {
      if (!isCryptoSymbol(a.symbolOut) && !isCryptoSymbol(a.symbolIn)) out.push({ symbol: a.symbolOut, etDate: etDateOf(a.swappedOutAt) }, { symbol: a.symbolIn, etDate: etDateOf(a.swappedOutAt) });
    }
  }
  return out;
}
/** M4's fetch order: known-answer, set of record, second set, control, main-run control. */
export const STAGE_NAMES = Object.freeze(['known_answer', 'record', 'second', 'control', 'control_main']);
function stagesOf(snap, extraKa = []) {
  return [
    [...recordedSwapNeeds(snap.battles), ...extraKa],
    unitNeeds(snap.meta, swapUnits(snap.moments.record)),
    unitNeeds(snap.meta, swapUnits(snap.moments.second)),
    unitNeeds(snap.meta, snap.control),
    unitNeeds(snap.meta, snap.controlMain),
  ];
}

/**
 * The sale reconciliation (M9, beside the gate): over every committed, non-crypto recorded swap
 * whose check showed its sold name, the builder's lock, exit price and fill against the
 * platform's records. Inputs at the sale only — no later price.
 */
export function saleReconciliation(battles, bodies) {
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const recon = { swaps: 0, crypto: 0, bodyMissing: 0, built: 0, builtFlat6: 0, lockMatch: 0, lockDiffs: [], exitMatch: 0, exitOff: 0, fillMatch: 0, fillOff: 0, notBuilt: {} };
  for (const b of Object.values(battles)) {
    for (const t of b.ticks) {
      const k = `${b.battleId}__${t.tickId}`;
      for (const a of t.actions.filter((x) => x.committed)) {
        recon.swaps += 1;
        if (isCryptoSymbol(a.symbolOut) || isCryptoSymbol(a.symbolIn)) { recon.crypto += 1; continue; }
        if (!bodies[k]) { recon.bodyMissing += 1; continue; }
        const inp = buildSwapInputs({ battle: b, check: checkOf(b, t), body: parseBody(bodies[k].messages?.[2]?.content), out: a.symbolOut, in: a.symbolIn });
        if (!inp.ok) { for (const w of inp.missing) inc(recon.notBuilt, w); continue; }
        recon.built += 1;
        if (b.gameMode === 'baggerbomb_tournament') recon.builtFlat6 += 1;
        const trade = b.trades.find((x) => x.swappedOutAt === a.swappedOutAt && x.symbolOut === a.symbolOut);
        if (isNum(a.lockedPoints) && Math.abs(a.lockedPoints - inp.action.lockedPoints) < EPS) recon.lockMatch += 1; else recon.lockDiffs.push(round((a.lockedPoints ?? NaN) - inp.action.lockedPoints, 2));
        if (trade && isNum(trade.exitPrice) && trade.exitPrice.toFixed(2) === inp.shownPx.out.toFixed(2)) recon.exitMatch += 1; else recon.exitOff += 1;
        if (isNum(a.entryPrice) && a.entryPrice.toFixed(2) === inp.shownPx.in.toFixed(2)) recon.fillMatch += 1; else recon.fillOff += 1;
      }
    }
  }
  return recon;
}

/** Review B2: the reconciliation as a gate — something built, ≥ 90% on each of lock / exit / fill, and a flat6 swap when flat6 battles exist. */
export function reconGate(recon, hasFlat6) {
  const share = (n) => (recon.built ? n / recon.built : 0);
  if (!recon.built) return { pass: false, why: 'no recorded swap could be rebuilt' };
  for (const [name, n] of [['lock', recon.lockMatch], ['exit', recon.exitMatch], ['fill', recon.fillMatch]]) {
    if (share(n) < KA_MATCH_SHARE - EPS) return { pass: false, why: `${name} ${n}/${recon.built}` };
  }
  if (hasFlat6 && !recon.builtFlat6) return { pass: false, why: 'no flat6 recorded swap could be rebuilt' };
  return { pass: true, why: null };
}

/**
 * M5 (review B6): every battle is ONE session that is a real trading day with a close, completed at
 * or after that close; and every unit's check falls on its battle's trading day.
 */
export function oneSessionCheck(battles, meta, units) {
  const okBattle = (b) => {
    const day = b.tradingDays?.length === 1 ? b.tradingDays[0] : null;
    const s = day ? sessionFor(day) : null;
    return Boolean(s?.isTradingDay) && Number.isFinite(s.closeMs) && toMs(b.completedAt) >= s.closeMs;
  };
  const list = Object.values(battles);
  const ok = list.filter(okBattle).length;
  const unitsOff = units.filter(({ k }) => { const m = meta[k]; const b = battles[m?.battleId]; return !b || b.tradingDays?.[0] !== m.day; }).length;
  return { battles: list.length, ok, unitsOff, pass: ok === list.length && unitsOff === 0 };
}

/** The builder's domain for known-answer layer 2 (M9, review B7): every model-proposed swap, and any other swap the check showed. */
export const MODEL_SWAP_SOURCE = 'haiku';
export function kaInDomain(source, shown) {
  return source === MODEL_SWAP_SOURCE || Boolean(shown);
}

/** The archetype's display name (the replay report's words). */
const ARCHETYPE = { momentum_chaser: 'Trend Follower', contrarian: 'Contrarian', diversifier: 'Diversifier' };
const MODE = { baggerbomb_agent: 'tiered', baggerbomb_tournament: 'flat6' };

// ---------------------------------------------------------------- plan

async function plan() {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed — not planning: ${JSON.stringify(st.failed)}`);
  const bc = loadRunKeys(BATCHCHECK_RUN);
  const main = loadRunKeys(SOURCE_RUN);
  const tickKeys = bc.manifest.runPlan.sampleKeys;
  const meta = Object.fromEntries(bc.manifest.sample.ticks.map((t) => [t.k, t]));
  const bcCalls = usualCalls(bc.keys, tickKeys);
  const mainCalls = usualCalls(main.keys, tickKeys);
  const record = bcCalls.filter((r) => r.flipped);
  const recordKeys = new Set(record.map((r) => r.k));
  const second = mainCalls.filter((r) => r.flipped && !recordKeys.has(r.k));
  // Cross-check against the replay's own published counts (not parsed from its exhibits).
  const addendum = readJson(path.join(bc.dir, 'addendum.json'));
  const mainAnalysis = readJson(path.join(main.dir, 'analysis.json'));
  const crossCheck = {
    recordCount: record.length, addendumLearningFlipped: addendum.comparisons?.learning?.flipped ?? null,
    mainFlips: mainCalls.filter((r) => r.flipped).length, mainAnalysisStripFlipRate: mainAnalysis.arm2?.strip?.flipRate ?? null,
  };
  if (crossCheck.recordCount !== crossCheck.addendumLearningFlipped) stop(`set of record ${crossCheck.recordCount} ≠ the addendum's ${crossCheck.addendumLearningFlipped}`);
  if (Math.abs(crossCheck.mainFlips / mainCalls.length - crossCheck.mainAnalysisStripFlipRate) > 1e-9) stop('main-run flips disagree with analysis.json');

  // The control: every distinct SWAP that is a usual call of either condition (M8).
  const controlUnits = (calls, tag) => calls.flatMap((r) => [...new Set([r.withL, r.withoutL].filter((c) => parseSwap(c)))].map((call) => ({ k: r.k, call, tag })));
  const control = controlUnits(bcCalls, 'control');
  const controlMain = controlUnits(mainCalls, 'control_main');

  const env = loadEnv();
  const db = await openFirestore(env);
  const battleDays = {};
  for (const t of bc.manifest.sample.ticks) (battleDays[t.battleId] ||= {})[t.day] = true;
  const battles = {};
  for (const [b, days] of Object.entries(battleDays)) battles[b] = await readBattle(db, b, Object.keys(days));

  // Bodies of recorded-swap ticks outside the replay sample (the known-answer layer 2 and the reconciliation).
  const bodies = {};
  for (const [k, s] of Object.entries(bc.sources)) bodies[k] = s.request;
  for (const [k, s] of Object.entries(main.sources)) bodies[k] ||= s.request;
  const swapTicks = [];
  for (const b of Object.values(battles)) for (const t of b.ticks) if (t.actions.some((a) => a.committed)) swapTicks.push({ b, t });
  const extra = {};
  for (const { b, t } of swapTicks) {
    const k = `${b.battleId}__${t.tickId}`;
    if (bodies[k]) continue;
    const snap = await db.collection('agentBattles').doc(b.battleId).collection('tickBodies').doc(t.tickId).get();
    const body = snap.exists ? snap.data() : null;
    const text = body?.request?.body;
    if (typeof text !== 'string' || body.bodyIncomplete || body.request?.truncated) { extra[k] = { missing: body ? 'incomplete' : 'absent' }; continue; }
    if (sha256(text) !== t.body.requestSha256) { extra[k] = { missing: 'sha_mismatch' }; continue; }
    extra[k] = { request: JSON.parse(text) };
    bodies[k] = extra[k].request;
  }

  // Build every swap call's inputs (no bars, no outcome).
  const bodyOf = (k) => (bodies[k] ? parseBody(bodies[k].messages?.[2]?.content) : null);
  const tickOf = (k) => { const m = meta[k]; const b = battles[m.battleId]; return { b, t: b.ticks.find((x) => x.tickId === m.tickId) }; };
  const inputStatus = { units: 0, built: 0, coarseAtr: 0, notScored: {}, flags: {}, sources: {} };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const tally = (inp) => {
    inputStatus.units += 1;
    if (inp.ok) {
      inputStatus.built += 1;
      if (inp.coarseAtr.ghost || inp.coarseAtr.bought || inp.coarseAtr.lock) inputStatus.coarseAtr += 1;
      for (const [k, v] of Object.entries(inp.sources)) inc(inputStatus.sources, `${k}: ${v}`);
    } else for (const w of inp.missing) inc(inputStatus.notScored, w);
    for (const f of inp.flags || []) inc(inputStatus.flags, f);
  };
  const seen = {};
  for (const u of [...swapUnits(record), ...swapUnits(second), ...control, ...controlMain]) {
    const id = `${u.k}|${u.call}`;
    if (seen[id]) continue;
    seen[id] = true;
    const { b, t } = tickOf(u.k);
    const sw = parseSwap(u.call);
    tally(buildSwapInputs({ battle: b, check: checkOf(b, t), body: bodyOf(u.k), out: sw.out, in: sw.in }));
  }

  // Reconciliation over every recorded swap: the builder's sale against the platform's (inputs at the sale only — no later price).
  const recon = saleReconciliation(battles, bodies);

  const moments = { record: record.map((r) => ({ ...r, kind: classify(r.withL, r.withoutL) })), second: second.map((r) => ({ ...r, kind: classify(r.withL, r.withoutL) })) };
  const snap = { battles, meta, moments, control, controlMain, bcCalls, mainCalls };
  // M5 (review B6): every battle is one completed session, and every unit's check is on that session's day.
  const oneSession = oneSessionCheck(battles, meta, [...swapUnits(record), ...swapUnits(second), ...control, ...controlMain]);
  if (!oneSession.pass) stop(`M5: the end of the battle is not the session close for ${oneSession.battles - oneSession.ok} battle(s) / ${oneSession.unitsOff} unit(s)`);
  // The sale reconciliation is a gate before any bar (review B2).
  const rg = reconGate(recon, Object.values(battles).some((b) => b.gameMode === 'baggerbomb_tournament'));
  if (!rg.pass) stop(`sale reconciliation gate failed: ${rg.why}`);
  // The requests each stage costs, cumulative, in M4 order.
  const stages = stagesOf(snap);
  const fetchCounts = STAGE_NAMES.map((name, i) => ({ stage: name, cumulativeRequests: fetchPlan(stages.slice(0, i + 1)).length }));

  const runId = `${RUN_PREFIX}${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const dir = path.join(RUNS_ROOT, runId);
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(path.join(dir, 'snapshot.local.json'), snap);
  writeFileSync(path.join(dir, 'bodies.local.jsonl'), `${Object.entries(bodies).map(([k, request]) => JSON.stringify({ k, request })).join('\n')}\n`);
  const kindsOf = (list) => list.reduce((o, r) => { inc(o, r.kind); return o; }, {});
  const manifest = {
    runId, createdAt: new Date().toISOString(), head: headSha(), sources: [SOURCE_RUN, BATCHCHECK_RUN],
    constants: { CALL_CAP, TIE, MIN_SCORED, KA_MATCH_SHARE, KA_TOLERANCE_POINTS },
    crossCheck, kinds: { record: kindsOf(moments.record), second: kindsOf(moments.second) },
    controlUnits: control.length, controlMainUnits: controlMain.length,
    battles: Object.values(battles).reduce((o, b) => { inc(o, `${MODE[b.gameMode] ?? b.gameMode}|${b.duration}|days=${b.tradingDays?.length ?? '?'}`); return o; }, {}),
    oneSession: { battles: oneSession.battles, ok: oneSession.ok, unitsOff: oneSession.unitsOff },
    extraBodies: Object.values(extra).reduce((o, v) => { inc(o, v.missing ?? 'read'); return o; }, {}),
    inputStatus, reconciliation: { ...recon, lockDiffs: recon.lockDiffs.slice(0, 60) }, fetchCounts,
    eodhd: { cap: CALL_CAP, calls: 0, log: [], failures: {} },
  };
  stamp(manifest, 'plan');
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
  console.log(JSON.stringify({ ...manifest, commands: undefined, eodhd: undefined }, null, 1));
}

// ---------------------------------------------------------------- shared loading for known-answer / score

function loadRun(flags) {
  const { runId, dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  const snap = readJson(path.join(dir, 'snapshot.local.json'));
  const bodies = {};
  for (const l of readFileSync(path.join(dir, 'bodies.local.jsonl'), 'utf8').split('\n')) { if (!l.trim()) continue; const s = JSON.parse(l); bodies[s.k] = s.request; }
  return { runId, dir, manifestPath, manifest, snap, bodies };
}

/** One swap call at one check, replayed: values at the close and the next check, both measures. */
function scoreSwap({ battle, tick, body, call, barsOf }) {
  const sw = parseSwap(call);
  const check = checkOf(battle, tick);
  const inputs = buildSwapInputs({ battle, check, body, out: sw.out, in: sw.in });
  const etDate = etDateOf(tick.capturedAt);
  const res = { call, inputs: { ok: inputs.ok, missing: inputs.missing, flags: inputs.flags, sources: inputs.sources ?? null, coarseAtr: inputs.coarseAtr ?? null, lockedPoints: inputs.action?.lockedPoints ?? null, lockAtr: inputs.lockParams?.atr ?? null, ghostAtr: inputs.action?.replayInputs?.ghost?.atr ?? null } };
  const bars = { [sw.out]: barsOf(sw.out, etDate), [sw.in]: barsOf(sw.in, etDate) };
  const session = sessionFor(etDate);
  // Price measure: from the shown prices, the X and Y moves (M2).
  const pxOut = isNum(check.evidence?.[sw.out]?.px) ? check.evidence[sw.out].px : (body.positions[sw.out]?.current ?? null);
  const pxIn = body.bench[sw.in]?.current ?? null;
  const priceAt = (atMs) => {
    if (isCryptoSymbol(sw.out) || isCryptoSymbol(sw.in)) return { hold: null, swap: null, holdWhy: 'crypto_not_supported', swapWhy: 'crypto_not_supported' };
    const h = isNum(pxOut) ? moveAt(bars[sw.out], pxOut, atMs, sw.out) : { v: null, why: `shown price ${sw.out}` };
    const s = isNum(pxIn) ? moveAt(bars[sw.in], pxIn, atMs, sw.in) : { v: null, why: `Y ${sw.in} not on the shown bench` };
    return { hold: h.v, swap: s.v, holdWhy: h.why, swapWhy: s.why };
  };
  // The next check: the first later check that scored the book, in the same session (the replay's own rule).
  const checks = checkRows(battle, etDate);
  const next = laterChecks(checks, { at: tick.capturedAt, tickSeq: tick.tickSeq }, session)[0] || null;
  res.nextAt = next ? next.at : null;
  res.price = { close: priceAt(session.closeMs), next: next ? priceAt(toMs(next.at)) : null };
  if (!inputs.ok) {
    const miss = { hold: null, swap: null, holdWhy: inputs.missing[0], swapWhy: inputs.missing[0] };
    res.points = { close: miss, next: next ? miss : null };
    return res;
  }
  const run = (inp) => replayAction({ action: inp.action, checks, barsBySymbol: Object.fromEntries(Object.entries(bars).filter(([, v]) => v)), session, sectors: {}, tierStamp: inp.tierStamp });
  const replay = run(inputs);
  const pv = pathValues(replay);
  // The replay's comparables (SPY, RSP, sector ETFs) are not fetched: their gaps are not this score's.
  const legMissing = (replay.missingInputs || []).filter((n) => n.includes(`:${sw.out}`) || n.includes(`:${sw.in}`) || !/^(bars|price):/.test(n));
  const why = (leg) => legMissing.join(',') || `no ${leg} value`;
  if (next && pv.next && toMs(pv.next.at) !== toMs(next.at)) throw new Error('the replay sampled a different next check');
  res.points = {
    close: { hold: pv.close.hold, swap: pv.close.swap, holdWhy: why('hold'), swapWhy: why('swap') },
    // A later check that no replayed path reached carries the replay's own reason, not "no later check" (review B16b).
    next: pv.next ? { hold: pv.next.hold, swap: pv.next.swap, holdWhy: why('hold'), swapWhy: why('swap') } : (next ? { hold: null, swap: null, holdWhy: why('hold'), swapWhy: why('swap') } : null),
  };
  res.sale = replay.reconciliation?.soldAtSale ?? null;
  res.missingInputs = replay.missingInputs;
  // M7: a coarse ATR is replayed at the corners of its rounding box; kept for the verdict check.
  const corners = atrCorners(inputs.coarseAtr);
  if (corners.length) {
    res.atrVariants = corners.map(([dg, db]) => { const p = pathValues(run(withAtrShift(inputs, dg, db))); return { close: p.close, next: p.next }; });
  }
  res.subsequentTradesInSlot = battle.trades.filter((t) => t.tier === inputs.slot.tier && t.slotIndex === inputs.slot.slotIndex && toMs(t.swappedOutAt) > toMs(tick.capturedAt)).length;
  return res;
}

/** M2 + M7 — both measures at both horizons for one moment (or one control unit). */
function differences(withL, withoutL, comps) {
  const at = (measure, h) => {
    const comp = {};
    for (const [call, c] of Object.entries(comps)) {
      const v = measure === 'points' ? c.points?.[h] : c.price?.[h];
      if (v === undefined || v === null) comp[call] = { hold: null, swap: null, holdWhy: h === 'next' ? 'no later check that session' : 'missing', swapWhy: h === 'next' ? 'no later check that session' : 'missing' };
      else comp[call] = v;
    }
    return callDifference(withL, withoutL, comp);
  };
  const out = {};
  for (const h of ['close', 'next']) {
    out[h] = { points: at('points', h), price: at('price', h) };
  }
  // M7: every combination of each coarse component's corners. A points verdict that moves at ANY
  // horizon unscores the moment's points at EVERY horizon, as M7 declares (review B3: this
  // applied per horizon before, which the declared text does not).
  const unstable = ['close', 'next'].some((h) => out[h].points.status === 'scored' && !atrStable(withL, withoutL, comps, h, out[h].points.delta));
  if (unstable) for (const h of ['close', 'next']) out[h].points = { status: 'not_scored', reason: 'ATR known to 0.1 only and the verdict depends on it' };
  return out;
}

/**
 * M7 — does the points verdict at horizon `h` hold at every corner of every
 * coarse component's ATR box (all combinations across components)?
 */
export function atrStable(withL, withoutL, comps, h, baseDelta) {
  const entries = Object.entries(comps);
  const options = entries.map(([, c]) => [c.points?.[h], ...(c.atrVariants || []).map((v) => v[h])]);
  if (options.every((o) => o.length === 1)) return true;
  const base = verdict(baseDelta, TIE.points);
  const pick = (i, chosen) => {
    if (i === entries.length) {
      const comp = Object.fromEntries(entries.map(([call], j) => [call, chosen[j] ? { ...chosen[j], holdWhy: 'missing', swapWhy: 'missing' } : { hold: null, swap: null, holdWhy: 'missing', swapWhy: 'missing' }]));
      const alt = callDifference(withL, withoutL, comp);
      return alt.status === 'scored' && verdict(alt.delta, TIE.points) === base;
    }
    return options[i].every((v) => pick(i + 1, [...chosen, v]));
  };
  return pick(0, []);
}

// ---------------------------------------------------------------- known-answer

async function knownAnswer(flags) {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed: ${JSON.stringify(st.failed)}`);
  const { dir, manifestPath, manifest, snap, bodies } = loadRun(flags);
  stamp(manifest, 'known-answer');
  // Before any bar (reviews B2, B6): the one-session rule and the sale reconciliation, from this run's own snapshot.
  const os = oneSessionCheck(snap.battles, snap.meta, allUnits(snap));
  if (!os.pass) stop(`M5: the end of the battle is not the session close for ${os.battles - os.ok} battle(s) / ${os.unitsOff} unit(s)`);
  const recon = saleReconciliation(snap.battles, bodies);
  const rg = reconGate(recon, Object.values(snap.battles).some((b) => b.gameMode === 'baggerbomb_tournament'));
  manifest.preBarGates = { oneSession: { battles: os.battles, ok: os.ok, unitsOff: os.unitsOff }, reconciliation: { built: recon.built, builtFlat6: recon.builtFlat6, lockMatch: recon.lockMatch, exitMatch: recon.exitMatch, fillMatch: recon.fillMatch }, pass: rg.pass };
  writeJsonAtomic(manifestPath, manifest);
  if (!rg.pass) stop(`sale reconciliation gate failed: ${rg.why}`);
  const env = loadEnv();
  const db = await openFirestore(env);
  const battles = snap.battles;
  // The tape's recorded swaps with a stored replay, on the replay's battle-days (M9).
  const ka = [];
  const series = [];
  for (const [battleId, b] of Object.entries(battles)) {
    const days = [...new Set(b.ticks.map((t) => etDateOf(t.capturedAt)))];
    for (const day of days) {
      const ref = db.collection('agentBattles').doc(battleId).collection('tape').doc(day);
      const tape = (await ref.get()).data();
      if (!tape) continue;
      for (const a of tape.actions || []) if (a.replay && a.replayReason !== 'crypto_not_supported') ka.push({ battleId, day, action: a, checks: tape.checks || [], sectors: tape.comparables?.sectors || {} });
      if ((tape.actions || []).some((a) => a.replay)) for (const s of (await ref.collection('series').get()).docs) series.push({ battleId, day, symbol: s.id, bars: s.data().bars || [] });
    }
  }
  // Every stage's bars are fetched here, in M4 order (one request per symbol); score then reads the cache only.
  const kaNeeds = ka.flatMap((x) => [{ symbol: x.action.symbolOut, etDate: x.day }, { symbol: x.action.symbolIn, etDate: x.day }]);
  const { barsOf, why } = await ensureBars(dir, manifest, manifestPath, stagesOf(snap, kaNeeds), env);

  // Bars cross-check against the stored 10-minute series (M4). Descriptive, not part of the gate:
  // a stored series is merged bucket by bucket across the candle pass's retries, so equality is
  // expected, not guaranteed (review B5). Every series read is accounted for.
  const seriesCheck = { read: series.length, compared: 0, equal: 0, differ: [], skipped: [] };
  for (const s of series) {
    const bars = barsOf(s.symbol, s.day);
    if (!bars) { seriesCheck.skipped.push({ symbol: s.symbol, day: s.day, why: 'not fetched (no moment, control or known-answer swap needs it)' }); continue; }
    seriesCheck.compared += 1;
    const mine = aggregate10m(bars, sessionFor(s.day)).map((x) => [x.t, x.o, x.h, x.l, x.c, x.v].join('|'));
    const theirs = s.bars.map((x) => [x.t, x.o, x.h, x.l, x.c, x.v].join('|'));
    if (JSON.stringify(mine) === JSON.stringify(theirs)) seriesCheck.equal += 1;
    else seriesCheck.differ.push({ symbol: s.symbol, mine: mine.length, theirs: theirs.length, firstDiff: [...Array(Math.max(mine.length, theirs.length)).keys()].find((i) => mine[i] !== theirs[i]) });
  }

  const pts = (list) => (Array.isArray(list) ? list.map((p) => (isNum(p?.points) ? p.points : null)) : null);
  const compare = (mine, stored, tol) => {
    const fields = [['gapPoints', [mine?.gapPoints ?? null], [stored?.gapPoints ?? null]], ['holdPath', pts(mine?.holdPath), pts(stored?.holdPath)], ['swapPath', pts(mine?.swapPath), pts(stored?.swapPath)]];
    const diffs = [];
    for (const [name, a, b] of fields) {
      if (!a || !b || a.length !== b.length) { diffs.push(`${name}: shape ${a?.length ?? 'null'} vs ${b?.length ?? 'null'}`); continue; }
      a.forEach((x, i) => { const y = b[i]; if ((x === null) !== (y === null) || (x !== null && Math.abs(x - y) > tol + EPS)) diffs.push(`${name}[${i}]: ${x} vs ${y}`); });
    }
    return diffs;
  };
  const rows = [];
  for (const x of ka) {
    const session = sessionFor(x.day);
    const tierStamp = resolveModeConfig(battles[x.battleId].gameMode).flatMultiplier;
    const barsBySymbol = Object.fromEntries([x.action.symbolOut, x.action.symbolIn].map((s) => [s, barsOf(s, x.day)]).filter(([, v]) => v));
    // Layer 1: the tape's own row and checks, our bars.
    const l1 = replayAction({ action: x.action, checks: x.checks, barsBySymbol, session, sectors: x.sectors, tierStamp });
    const d1 = compare(l1, x.action.replay, 0.005);
    // Layer 2: our builder (M3), our checks, our bars.
    const b = battles[x.battleId];
    const tick = b.ticks.find((t) => t.tickSeq === x.action.tickSeq) || b.ticks.find((t) => t.actions.some((a) => a.swappedOutAt === x.action.at && a.symbolOut === x.action.symbolOut));
    // The builder's domain (M9): every model-proposed swap, and any other swap whose sold name the
    // check showed. A model swap with no tick or no body is IN the domain and unmatched, so the gate
    // fails loudly instead of the domain shrinking (review B7).
    const k = tick ? `${x.battleId}__${tick.tickId}` : null;
    const body = k && bodies[k] ? parseBody(bodies[k].messages?.[2]?.content) : null;
    const shown = Boolean(body?.positions[x.action.symbolOut]);
    const inDomain = kaInDomain(x.action.source, shown);
    let d2; let l2why = null; let built = null; let exact = null;
    if (!shown) {
      l2why = !tick ? 'no tick' : (body ? 'not shown' : 'no body');
      d2 = [inDomain ? `cannot build (${l2why}): a model swap the check did not show` : 'outside the builder\'s domain: a deterministic exit the check never showed'];
    } else {
      const inp = buildSwapInputs({ battle: b, check: checkOf(b, tick), body, out: x.action.symbolOut, in: x.action.symbolIn });
      if (!inp.ok) { d2 = inp.missing.map((m) => `input: ${m}`); l2why = 'inputs'; } else {
        built = { lockedPoints: inp.action.lockedPoints, recordedLockedPoints: x.action.lockedPoints, sources: inp.sources, coarseAtr: inp.coarseAtr };
        const l2 = replayAction({ action: inp.action, checks: checkRows(b, x.day), barsBySymbol, session, sectors: {}, tierStamp: inp.tierStamp });
        d2 = compare(l2, x.action.replay, KA_TOLERANCE_POINTS);
        // Recorded beside the 1-point gate: does every number agree exactly (review B13)?
        exact = compare(l2, x.action.replay, 0).length === 0;
      }
    }
    rows.push({ key: `${x.battleId}|${x.action.key}`, symbols: `${x.action.symbolOut}→${x.action.symbolIn}`, day: x.day, source: x.action.source ?? null, layer1: { match: d1.length === 0, diffs: d1 }, layer2: { inDomain, shown, match: inDomain && d2.length === 0, exact, diffs: d2, why: l2why, built } });
  }
  const gate = { total: rows.length, ...kaGate(rows), layer2Exact: rows.filter((r) => r.layer2.exact === true).length, barsMissing: why };
  writeJsonAtomic(path.join(dir, 'knownAnswer.local.json'), { gate, seriesCheck, rows, scriptSha256: scriptSha() });
  manifest.knownAnswer = { ...gate, seriesCheck: { read: seriesCheck.read, compared: seriesCheck.compared, equal: seriesCheck.equal, skipped: seriesCheck.skipped.length }, scriptSha256: scriptSha() };
  writeJsonAtomic(manifestPath, manifest);
  console.log(JSON.stringify({ gate, seriesCheck: { ...seriesCheck, differ: seriesCheck.differ.slice(0, 10) }, rows: rows.map((r) => ({ symbols: r.symbols, day: r.day, layer1: r.layer1, layer2: r.layer2 })), eodhdCalls: manifest.eodhd.calls }, null, 1));
  if (!gate.pass) stop(`known-answer gate failed (layer 1 ${gate.layer1.matched}/${gate.layer1.domain}, layer 2 ${gate.layer2.matched}/${gate.layer2.domain}; each needs ≥ ${KA_MATCH_SHARE * 100}%) — nothing is scored`, 4);
}

// ---------------------------------------------------------------- score

async function score(flags) {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed: ${JSON.stringify(st.failed)}`);
  const { dir, manifestPath, manifest, snap, bodies } = loadRun(flags);
  if (!manifest.knownAnswer?.pass) stop('the known-answer gate has not passed on this run — run `known-answer` first');
  // The gate must have been passed by THIS script (reviews B16a, B11): an edit after the gate re-runs it.
  if (manifest.knownAnswer.scriptSha256 !== scriptSha()) stop('the known-answer gate was passed by a different script — run `known-answer` again');
  // M5 (review B6): the end of the battle is the session close only for one-session battles.
  const os = oneSessionCheck(snap.battles, snap.meta, allUnits(snap));
  if (!os.pass) stop(`M5: the end of the battle is not the session close for ${os.battles - os.ok} battle(s) / ${os.unitsOff} unit(s)`);
  stamp(manifest, 'score');
  writeJsonAtomic(manifestPath, manifest);
  const { battles, meta, moments, control, controlMain } = snap;
  const tickOf = (k) => { const m = meta[k]; const b = battles[m.battleId]; return { b, t: b.ticks.find((x) => x.tickId === m.tickId) }; };
  const callsOf = (r) => [r.withL, r.withoutL].filter(parseSwap);
  // The cache only: every request was made (and counted) by known-answer.
  const { barsOf, why } = await ensureBars(dir, manifest, manifestPath, stagesOf(snap), {}, { allowFetch: false });
  const memo = {};
  const scoreUnit = (k, call) => {
    const id = `${k}|${call}`;
    if (memo[id]) return memo[id];
    const { b, t } = tickOf(k);
    const body = parseBody(bodies[k]?.messages?.[2]?.content);
    memo[id] = scoreSwap({ battle: b, tick: t, body, call, barsOf: (s, d) => { const v = barsOf(s, d); return v; } });
    const sw = parseSwap(call);
    for (const s of [sw.out, sw.in]) if (why[s]) memo[id].barsWhy = { ...(memo[id].barsWhy || {}), [s]: why[s] };
    return memo[id];
  };
  const momentRow = (r) => {
    const { b, t } = tickOf(r.k);
    const m = meta[r.k];
    const comps = Object.fromEntries(callsOf(r).map((call) => [call, scoreUnit(r.k, call)]));
    const unscorable = r.kind === 'unscorable';
    const d = unscorable ? { close: { points: { status: 'not_scored', reason: 'malformed usual call' }, price: { status: 'not_scored', reason: 'malformed usual call' } }, next: { points: { status: 'not_scored', reason: 'malformed usual call' }, price: { status: 'not_scored', reason: 'malformed usual call' } } } : differences(r.withL, r.withoutL, comps);
    const later = Object.values(comps).some((c) => c.subsequentTradesInSlot > 0);
    return {
      k: r.k, battleId: m.battleId, tickId: m.tickId, capturedAt: t.capturedAt, day: m.day,
      kind: r.kind, differentOuts: r.kind === 'changed_pick' && parseSwap(r.withL).out !== parseSwap(r.withoutL).out,
      archetype: ARCHETYPE[m.archetype] ?? m.archetype, mode: MODE[b.gameMode] ?? b.gameMode, paragraph: (m.learnedHash || '').slice(0, 8),
      withL: r.withL, withoutL: r.withoutL, voteWith: r.voteWith, voteWithout: r.voteWithout,
      live: liveDid(t), primary: d.close, next: d.next, endOfBattle: { sameAsClose: true, hypothetical: later },
      comps,
    };
  };
  const ordered = (list) => [...list].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : toMs(tickOf(a.k).t.capturedAt) - toMs(tickOf(b.k).t.capturedAt)));
  const recordRows = ordered(moments.record).map(momentRow).map((r, i) => ({ id: `M${String(i + 1).padStart(2, '0')}`, ...r }));
  const secondRows = ordered(moments.second).map(momentRow).map((r, i) => ({ id: `S${String(i + 1).padStart(2, '0')}`, ...r }));
  const controlRow = (u) => {
    const c = scoreUnit(u.k, u.call);
    const d = differences(u.call, 'HOLD', { [u.call]: c });
    return { k: u.k, call: u.call, mode: MODE[tickOf(u.k).b.gameMode], primary: d.close, next: d.next, comp: c };
  };
  const controlRows = control.map(controlRow);
  const controlMainRows = controlMain.map(controlRow);

  // ---- Added after the run, at review (descriptive; none sets the label) ----
  // Review A3 — the same set of record under the OPPOSITE modal tie rule (lexically largest key),
  // as the replay's own review B9 reported for its labels.
  const oppositeRecord = snap.bcCalls
    .map((r) => ({ ...r, withL: modal(r.voteWith.dist, { largest: true }), withoutL: modal(r.voteWithout.dist, { largest: true }) }))
    .filter((r) => r.withL !== r.withoutL)
    .map((r) => ({ ...r, kind: classify(r.withL, r.withoutL), voteWith: { ...r.voteWith, modal: r.voteWith.dist[r.withL] }, voteWithout: { ...r.voteWithout, modal: r.voteWithout.dist[r.withoutL] } }));
  const oppositeRows = ordered(oppositeRecord).map(momentRow);
  const recordKeys = new Set(moments.record.map((r) => `${r.k}|${r.withL}|${r.withoutL}`));
  const oppositeKeys = new Set(oppositeRecord.map((r) => `${r.k}|${r.withL}|${r.withoutL}`));
  // Review A2 — the control split: the changed moments' own legs against the swaps both conditions made.
  const flippedIn = (calls) => Object.fromEntries(calls.map((r) => [r.k, r.flipped]));
  const split = (rows, calls) => {
    const f = flippedIn(calls);
    return { legsOfFlips: controlSummary(rows.filter((r) => f[r.k])), bothConditions: controlSummary(rows.filter((r) => !f[r.k])) };
  };
  // Review B11 — do the two measures agree, moment by moment (a sign error in one would show here)?
  const agreement = (rows) => {
    const both = rows.filter((r) => r.primary.points.status === 'scored' && r.primary.price.status === 'scored');
    return { both: both.length, sameVerdict: both.filter((r) => verdict(r.primary.points.delta, TIE.points) === verdict(r.primary.price.delta, TIE.pricePp)).length };
  };

  // Review B2 — the lock and the replay must share the scorer's inputs: where the lock's ATR is the
  // held leg's own, the replay's rescore at the recorded price must equal the lock exactly. A nonzero
  // difference there is a stamp or input mismatch between the two paths; stop before writing anything.
  const allComps = Object.values(memo);
  const stampChecked = allComps.filter((c) => c.inputs.ok && isNum(c.sale?.inputsDelta) && c.inputs.lockAtr === c.inputs.ghostAtr);
  const stampOff = stampChecked.filter((c) => Math.abs(c.sale.inputsDelta) > 0.005);
  if (stampOff.length) stop(`the lock and the replay disagree at the sale on ${stampOff.length} swap call(s) (inputsDelta ≠ 0 with the same ATR) — a stamp or input mismatch`);
  const stampCheck = { comps: allComps.filter((c) => c.inputs.ok).length, checked: stampChecked.length, nonzero: 0, otherNonzero: allComps.filter((c) => c.inputs.ok && isNum(c.sale?.inputsDelta) && Math.abs(c.sale.inputsDelta) > 0.005).length };

  const primaryOf = (rows) => rows.map((r) => ({ points: r.primary.points, price: r.primary.price }));
  const nextOf = (rows) => rows.map((r) => ({ points: r.next.points, price: r.next.price }));
  const summarize = (rows) => ({
    n: rows.length,
    label: labelOf(primaryOf(rows)),
    primary: { points: describe(primaryOf(rows), 'points', TIE.points), price: describe(primaryOf(rows), 'price', TIE.pricePp) },
    next: { points: describe(nextOf(rows), 'points', TIE.points), price: describe(nextOf(rows), 'price', TIE.pricePp) },
  });
  const byGroup = (rows, keyOf) => Object.fromEntries(Object.entries(rows.reduce((o, r) => { (o[keyOf(r)] ||= []).push(r); return o; }, {})).map(([k, list]) => [k, { n: list.length, primary: { points: describe(primaryOf(list), 'points', TIE.points), price: describe(primaryOf(list), 'price', TIE.pricePp) } }]));
  // The measured vintage gap at the sale (BA-38 soldAtSale): shown price vs the 1-minute bar at the check.
  const vintage = recordRows.flatMap((r) => Object.values(r.comps)).map((c) => c.sale).filter((s) => s && isNum(s.recordedPx) && isNum(s.rebuiltPx)).map((s) => ((s.recordedPx - s.rebuiltPx) / s.rebuiltPx) * 100);
  const lagMinutes = recordRows.flatMap((r) => {
    const c = Object.values(r.comps)[0];
    const sw = parseSwap(Object.keys(r.comps)[0]);
    const px = c?.sale?.recordedPx;
    const bars = sw ? barsOf(sw.out, r.day) : null;
    if (!isNum(px) || !bars) return [];
    const at = toMs(r.capturedAt);
    let best = null;
    for (let k = 0; k <= LAG_WINDOW_MIN; k += 1) { const s = sampleAt(bars, at - k * 60_000); if (s?.valid) { const e = Math.abs(s.price - px); if (!best || e < best.e - EPS) best = { k, e }; } }
    return best ? [best.k] : [];
  });
  const quant = (xs) => { const s = [...xs].sort((a, b) => a - b); const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null); return { n: s.length, min: round(s[0], 3), median: round(q(0.5), 3), max: round(s[s.length - 1], 3) }; };

  const controlSummary = (rows) => ({
    units: rows.length,
    primary: { points: describe(primaryOf(rows), 'points', TIE.points), price: describe(primaryOf(rows), 'price', TIE.pricePp) },
    byMode: byGroup(rows, (r) => r.mode),
  });
  const notScored = [...recordRows, ...secondRows].flatMap((r) => ['primary', 'next'].flatMap((h) => ['points', 'price'].filter((m) => r[h][m].status !== 'scored').map((m) => ({ id: r.id, horizon: h, measure: m, reason: r[h][m].reason }))));
  const summary = {
    runId: manifest.runId, at: new Date().toISOString(), scriptSha256: scriptSha(), head: headSha(),
    eodhdCalls: manifest.eodhd.calls, barsMissing: Object.keys(why).length,
    record: { ...summarize(recordRows), byKind: byGroup(recordRows, (r) => r.kind), byParagraph: byGroup(recordRows, (r) => r.paragraph), byArchetype: byGroup(recordRows, (r) => r.archetype), byMode: byGroup(recordRows, (r) => r.mode) },
    second: summarize(secondRows),
    control: controlSummary(controlRows),
    controlMain: controlSummary(controlMainRows),
    vintage: { shownMinusBarPct: quant(vintage), bestLagMinutes: { ...quant(lagMinutes), windowMinutes: LAG_WINDOW_MIN, basis: 'the first swap call of each moment' } },
    table: recordRows.map((r) => tableRow(r)),
    secondTable: secondRows.map((r) => tableRow(r)),
    notScored,
    postReview: {
      note: 'added after the run, at review; descriptive; none sets the label',
      tieRuleOpposite: { ...summarize(oppositeRows), shared: oppositeRecord.filter((r) => recordKeys.has(`${r.k}|${r.withL}|${r.withoutL}`)).length, onlyUnderOpposite: oppositeRecord.filter((r) => !recordKeys.has(`${r.k}|${r.withL}|${r.withoutL}`)).length, onlyUnderRecordRule: moments.record.filter((r) => !oppositeKeys.has(`${r.k}|${r.withL}|${r.withoutL}`)).length, byKind: byGroup(oppositeRows, (r) => r.kind) },
      controlSplit: split(controlRows, snap.bcCalls),
      controlMainSplit: split(controlMainRows, snap.mainCalls),
      agreement: { record: agreement(recordRows), control: agreement(controlRows), controlMain: agreement(controlMainRows) },
      stampCheck,
    },
  };
  writeJsonAtomic(path.join(dir, 'summary.json'), summary);
  writeJsonAtomic(path.join(dir, 'results.local.json'), { recordRows, secondRows, controlRows, controlMainRows, why });
  writeExhibits(dir, recordRows, secondRows, bodies);
  manifest.score = { at: summary.at, label: summary.record.label.label, scriptSha256: summary.scriptSha256, eodhdCalls: manifest.eodhd.calls };
  writeJsonAtomic(manifestPath, manifest);
  console.log(JSON.stringify({ ...summary, table: undefined, secondTable: undefined }, null, 1));
}

/** One committed table row: no ids, no agent text (rule 6). */
function tableRow(r) {
  const cell = (x) => (x.status === 'scored' ? { v: round(x.delta, 2) } : { ns: x.reason });
  return {
    id: r.id, kind: r.kind, differentOuts: r.differentOuts, archetype: r.archetype, mode: r.mode, paragraph: r.paragraph,
    withL: r.withL, withoutL: r.withoutL,
    voteWith: `${r.voteWith.modal}/${r.voteWith.n}`, voteWithout: `${r.voteWithout.modal}/${r.voteWithout.n}`,
    live: r.live,
    primary: { points: cell(r.primary.points), price: cell(r.primary.price) },
    next: { points: cell(r.next.points), price: cell(r.next.price) },
    endOfBattleHypothetical: r.endOfBattle.hypothetical,
    flags: [...new Set(Object.values(r.comps).flatMap((c) => c.inputs.flags || []))].map((f) => f.replace(/\d+(\.\d+)?/g, 'n')).slice(0, 4),
    coverage: Object.values(r.comps).map((c) => (c.inputs.ok ? `inputs ok (${c.inputs.sources.ghostAtr === 'body ATR% (1 dp)' || c.inputs.sources.boughtAtr?.includes('1 dp') ? 'ATR 1 dp' : 'exact'})` : `inputs: ${c.inputs.missing[0]}`)).join('; '),
  };
}

/** LOCAL ONLY: the per-moment detail with ids (rule 6). Never committed. */
function writeExhibits(dir, recordRows, secondRows) {
  const out = ['# Changed-moments score — exhibits (LOCAL ONLY: ids; never commit)', ''];
  for (const r of [...recordRows, ...secondRows]) {
    out.push(`## ${r.id} — ${r.kind} — ${r.withL} (with) vs ${r.withoutL} (without)`, '', `- battle \`${r.battleId}\`, tick \`${r.tickId}\`, at ${r.capturedAt}`, `- live battle did: ${r.live}`);
    for (const [call, c] of Object.entries(r.comps)) out.push(`- ${call}: inputs ${c.inputs.ok ? JSON.stringify(c.inputs.sources) : c.inputs.missing.join('; ')}; lock ${c.inputs.lockedPoints}; close points hold ${c.points?.close?.hold} swap ${c.points?.close?.swap}; close moves hold ${round(c.price?.close?.hold, 3)}% swap ${round(c.price?.close?.swap, 3)}%; flags ${(c.inputs.flags || []).join(' | ') || '—'}`);
    out.push(`- primary: points ${JSON.stringify(r.primary.points)}, price ${JSON.stringify(r.primary.price)}`, `- next: points ${JSON.stringify(r.next.points)}, price ${JSON.stringify(r.next.price)}`, '');
  }
  writeFileSync(path.join(dir, 'EXHIBITS.local.md'), out.join('\n'));
}

// ---------------------------------------------------------------- selftest

export function runSelftest() {
  const rows = [];
  const check = (name, cond) => rows.push({ name, pass: Boolean(cond) });
  // S1 tie bands.
  check('S1 points +1 is a tie', verdict(1, TIE.points) === 'tie');
  check('S1 points +1.01 helped', verdict(1.01, TIE.points) === 'helped');
  check('S1 points −1 is a tie', verdict(-1, TIE.points) === 'tie');
  check('S1 points −1.01 hurt', verdict(-1.01, TIE.points) === 'hurt');
  check('S1 price +0.10 is a tie', verdict(0.10, TIE.pricePp) === 'tie');
  check('S1 price +0.11 helped', verdict(0.11, TIE.pricePp) === 'helped');
  check('S1 price −0.11 hurt', verdict(-0.11, TIE.pricePp) === 'hurt');
  // S2 label boundaries.
  const mk = (pts, prc) => ({ points: { status: 'scored', delta: pts }, price: { status: 'scored', delta: prc } });
  const ns = { points: { status: 'not_scored', reason: 'x' }, price: { status: 'scored', delta: 1 } };
  const set = (h, u, t, extra = []) => [...Array(h).fill(mk(5, 1)), ...Array(u).fill(mk(-5, -1)), ...Array(t).fill(mk(0, 0)), ...extra];
  check('S2 exactly 2 in 3 → helped', labelOf(set(10, 5, 0)).label === 'learning helped');
  check('S2 9 of 14 decided → no clear effect', labelOf(set(9, 5, 1)).label === 'no clear effect');
  check('S2 exactly 2 in 3 worse → hurt', labelOf(set(5, 10, 0)).label === 'learning hurt');
  check('S2 14 scored → too few', labelOf(set(10, 4, 0)).label === 'too few to read');
  check('S2 15 scored → read', labelOf(set(10, 5, 0)).label !== 'too few to read');
  check('S2 not_scored rows do not count toward 15', labelOf(set(10, 4, 0, [ns, ns])).label === 'too few to read');
  check('S2 ties leave the share to the decided', labelOf(set(2, 1, 12)).label === 'learning helped');
  check('S2 one measure only → no clear effect', labelOf([...Array(10).fill(mk(5, -1)), ...Array(5).fill(mk(-5, 1))]).label === 'no clear effect');
  check('S2 all tied → no clear effect', labelOf(set(0, 0, 15)).label === 'no clear effect');
  // S3 classification.
  check('S3 stopped', classify('HOLD', 'SWAP:A>B') === 'stopped');
  check('S3 caused', classify('SWAP:A>B', 'HOLD') === 'caused');
  check('S3 changed pick', classify('SWAP:A>B', 'SWAP:A>C') === 'changed_pick');
  check('S3 unscorable', classify(MALFORMED, 'HOLD') === 'unscorable' && classify('SWAP:A>B', MALFORMED) === 'unscorable');
  let threw = false; try { classify('HOLD', 'HOLD'); } catch { threw = true; }
  check('S3 an unchanged moment is refused', threw);
  // S4 the not_scored path and the difference formula.
  const comp = { 'SWAP:A>B': { hold: 10, swap: 4 } };
  check('S4 stopped = hold − swap', callDifference('HOLD', 'SWAP:A>B', comp).delta === 6);
  check('S4 caused = swap − hold', callDifference('SWAP:A>B', 'HOLD', comp).delta === -6);
  check('S4 changed pick, same out: no hold leg needed', callDifference('SWAP:A>B', 'SWAP:A>C', { 'SWAP:A>B': { hold: null, swap: 7 }, 'SWAP:A>C': { hold: null, swap: 3 } }).delta === 4);
  check('S4 changed pick, different outs', callDifference('SWAP:A>B', 'SWAP:C>D', { 'SWAP:A>B': { hold: 1, swap: 5 }, 'SWAP:C>D': { hold: 2, swap: 3 } }).delta === (5 + 2) - (1 + 3));
  const nsr = callDifference('HOLD', 'SWAP:A>B', { 'SWAP:A>B': { hold: 10, swap: null, swapWhy: 'bars:B' } });
  check('S4 a missing leg is not_scored with its reason', nsr.status === 'not_scored' && nsr.reason === 'bars:B');
  check('S4 not_scored rows are excluded from the tallies', describe([{ points: nsr }], 'points', 1).scored === 0);
  // S5 the call cap.
  const state = { calls: 0, log: [] };
  const counter = makeCounter(state, 3);
  const took = [counter.take('A'), counter.take('B'), counter.take('C'), counter.take('D')];
  check('S5 the 4th request past a cap of 3 is refused, the counter stops at 3', took.join() === 'true,true,true,false' && state.calls === 3 && state.log.length === 3);
  check('S5 the frozen cap is 400', CALL_CAP === 400);
  // S6 the sign test.
  check('S6 sign test 10–0', Math.abs(signTest(10, 0) - 2 / 1024) < 1e-12);
  check('S6 sign test 5–5 = 1', signTest(5, 5) === 1);
  check('S6 sign test symmetric', signTest(3, 9) === signTest(9, 3));
  check('S6 sign test n = 0', signTest(0, 0) === null);
  check('S6 sign test 8–2', Math.abs(signTest(8, 2) - (2 * (1 + 10 + 45)) / 1024) < 1e-12);
  // S7 the badge band carries every scoring fact of the history (imported scorer).
  const path1 = (h) => { let hist = h; const out = []; for (const chg of [0.5, 3.2, 7.4, 4.1, -2, -8.1, 1]) { const r = calculateAssetScoreServer({ symbol: 'T', baseATR: 4, tier: 'core' }, chg, hist, {}, chg); hist = r.history; out.push(r.totalPoints); } return out.join(); };
  check('S7 two histories in the no-badge band give one path', path1({ maxMultiplier: 0, minMultiplier: 0 }) === path1({ maxMultiplier: 0.9, minMultiplier: -0.4 }));
  check('S7 two histories in the bagger band give one path', path1({ maxMultiplier: 1.0, minMultiplier: 0 }) === path1({ maxMultiplier: 1.49, minMultiplier: -0.99 }));
  check('S7 adjacent bands differ', path1({ maxMultiplier: 0.99, minMultiplier: 0 }) !== path1({ maxMultiplier: 1.0, minMultiplier: 0 }));
  check('S7 the band of each badge set round-trips', [[], ['bagger'], ['bagger', 'doubleBagger'], ['bagger', 'doubleBagger', 'tenBagger'], ['bust'], ['bust', 'crash', 'meltdown'], ['bagger', 'bust']]
    .every((bs) => { const h = historyFromBadges(bs); return h && JSON.stringify(getBadgesFromHistoryServer(h).sort()) === JSON.stringify([...bs].sort()); }));
  check('S7 an unknown badge is refused', historyFromBadges(['moonshot']) === null);
  // S8 the body parser (bracketed badges, both table shapes).
  const body = ['ACTIVE POSITIONS:', 'Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%,LockNow(base/badges),NextBonus,Levels',
    'star,AAA,Tech,Day1,$10.50,$11.00,+4.76%,+1.20x,[bagger,doubleBagger],4.0%,+64(+19/+45),+1%,-', '', 'BENCH (available for swap):', 'Symbol,Sector,$Current,Daily%,ATR%,Status', 'BBB,Tech,$20.25,+1.00%,3.5%,available', ''].join('\n');
  const pb = parseBody(body);
  check('S8 positions parsed', pb.positions.AAA?.entry === 10.5 && pb.positions.AAA.badges.join() === 'bagger,doubleBagger' && pb.positions.AAA.atrPct === 4 && pb.positions.AAA.lockNow === 64 && pb.positions.AAA.tier === 'star');
  check('S8 bench parsed', pb.bench.BBB?.current === 20.25 && pb.bench.BBB.atrPct === 3.5);
  // S9 the candle filters and the redaction.
  const cc = cleanCandles([{ datetime: 'x', open: 1, high: 1, low: 1, close: 1, volume: null }, { datetime: 'y', open: 1, high: 2, low: 1, close: 2, volume: 5 }, { datetime: 'z', open: null, high: 2, low: 1, close: 2, volume: 5 }]);
  check('S9 synthetic close print and partial bar dropped', cc.length === 1 && cc[0].datetime === 'y');
  check('S9 the EODHD key never survives a message', !redactEodhd('GET https://eodhd.com/api/intraday/A.US?api_token=abc123&fmt=json').includes('abc123'));
  // S11 M7, the coarse-ATR corners.
  check('S11 one coarse leg → two corners', JSON.stringify(atrCorners({ ghost: false, bought: true, lock: false })) === JSON.stringify([[0, -0.05], [0, 0.05]]));
  check('S11 two coarse legs → four corners', atrCorners({ ghost: true, bought: true, lock: false }).length === 4);
  check('S11 no coarse leg → no corners', atrCorners({ ghost: false, bought: false, lock: false }).length === 0);
  const coarseComp = (variants) => ({ 'SWAP:A>B': { points: { close: { hold: 10, swap: 4 } }, atrVariants: variants.map((v) => ({ close: v })) } });
  check('S11 a corner that keeps the verdict is stable', atrStable('HOLD', 'SWAP:A>B', coarseComp([{ hold: 10, swap: 3 }, { hold: 10, swap: 5 }]), 'close', 6) === true);
  check('S11 a corner that moves the verdict to a tie is unstable', atrStable('HOLD', 'SWAP:A>B', coarseComp([{ hold: 10, swap: 4 }, { hold: 10, swap: 9 }]), 'close', 6) === false);
  check('S11 combinations across two components', atrStable('SWAP:A>B', 'SWAP:A>C', {
    'SWAP:A>B': { points: { close: { hold: null, swap: 6 } }, atrVariants: [{ close: { hold: null, swap: 5 } }] },
    'SWAP:A>C': { points: { close: { hold: null, swap: 3 } }, atrVariants: [{ close: { hold: null, swap: 4 } }] },
  }, 'close', 3) === false);
  // S10 the known-answer gate.
  const ka = (m1, n1, m2, n2) => kaGate([...Array(n1).keys()].map((i) => ({ layer1: { match: i < m1 }, layer2: { inDomain: i < n2, match: i < m2 } })));
  check('S10 9 of 9 and 4 of 4 pass', ka(9, 9, 4, 4).pass === true);
  check('S10 8 of 9 on layer 1 (88.9%) fails', ka(8, 9, 4, 4).pass === false);
  check('S10 3 of 4 on layer 2 fails', ka(9, 9, 3, 4).pass === false);
  check('S10 9 of 10 (exactly 90%) passes', ka(9, 10, 9, 10).pass === true);
  check('S10 an empty layer-2 domain fails', ka(9, 9, 0, 0).pass === false);
  // ---- Rows added at review (each kills a mutant the review found surviving) ----
  // B9: the frozen tie bands; a points-only row; a missing hold leg; atrStable's exact and mixed cases; the coarse lock.
  check('S1 the frozen tie bands', TIE.points === 1 && TIE.pricePp === 0.10);
  const nsPrice = { points: { status: 'scored', delta: 5 }, price: { status: 'not_scored', reason: 'x' } };
  const l6 = labelOf(set(10, 4, 0, [nsPrice]));
  check('S2 a row scored on points only does not count toward 15', l6.label === 'too few to read' && l6.scoredBoth === 14);
  const nsHold = callDifference('HOLD', 'SWAP:A>B', { 'SWAP:A>B': { hold: null, swap: 4, holdWhy: 'bars:A' } });
  check('S4 a missing hold leg is not_scored with its reason', nsHold.status === 'not_scored' && nsHold.reason === 'bars:A');
  check('S11 every component exact → stable', atrStable('HOLD', 'SWAP:A>B', { 'SWAP:A>B': { points: { close: { hold: 10, swap: 4 } } } }, 'close', 6) === true);
  check('S11 one exact and one coarse component: the coarse corner still decides', atrStable('SWAP:A>B', 'SWAP:C>D', {
    'SWAP:A>B': { points: { close: { hold: 1, swap: 5 } } },
    'SWAP:C>D': { points: { close: { hold: 2, swap: 3 } }, atrVariants: [{ close: { hold: 2, swap: 3 } }, { close: { hold: 2, swap: 6 } }] },
  }, 'close', 3) === false);
  // px 10.402 straddles the bagger line between ATR 4 and 4.05 — do not simplify it.
  const lp = { symbol: 'T', entryPrice: 10, baseline: 10, history: { maxMultiplier: 0, minMultiplier: 0 }, atr: 4, tier: 'core', direction: null, tierStamp: null, px: 10.402 };
  const shIn = { coarseAtr: { ghost: true, bought: false, lock: true }, lockParams: lp, action: { lockedPoints: lockAt(lp), replayInputs: { ghost: { atr: 4 }, bought: { atr: 3 } } } };
  const sh = withAtrShift(shIn, 0.05, 0);
  check('S11 a coarse lock moves with the held name\'s corner', sh.action.replayInputs.ghost.atr === 4.05 && sh.action.lockedPoints === lockAt({ ...lp, atr: 4.05 }) && sh.action.lockedPoints !== shIn.action.lockedPoints);
  // B3: a verdict that moves at the NEXT check unscores the moment's points at the close too (M7 as declared).
  const m7 = differences('HOLD', 'SWAP:A>B', { 'SWAP:A>B': {
    points: { close: { hold: 10, swap: -20 }, next: { hold: 10, swap: 5 } }, price: { close: { hold: 1, swap: -2 }, next: { hold: 1, swap: 0.5 } },
    atrVariants: [{ close: { hold: 10, swap: -20 }, next: { hold: 10, swap: 9.5 } }],
  } });
  check('S11 M7 is moment-wide: a moved next-check verdict unscores the close points', m7.close.points.status === 'not_scored' && m7.next.points.status === 'not_scored' && m7.close.price.status === 'scored');
  // B14 / B2: the flat6 positions table has no Tier column.
  const body6 = ['ACTIVE POSITIONS:', 'Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%,LockNow(base/badges),NextBonus,Levels',
    'AAA,Tech,Day1,$10.50,$11.00,+4.76%,+1.20x,[bagger],4.0%,+64(+19/+45),+1%,-', ''].join('\n');
  const p6 = parseBody(body6).positions.AAA;
  check('S8 flat6 positions parsed (no Tier column)', p6?.tier === null && p6.entry === 10.5 && p6.current === 11 && p6.badges.join() === 'bagger' && p6.atrPct === 4 && p6.lockNow === 64);
  // B10: every key, every character, redacted.
  check('S9 every EODHD key in a message is redacted whole', redactEodhd('x?api_token=Ab1.2c&fmt=json y?api_token=Zz9&q') === 'x?api_token=[REDACTED]&fmt=json y?api_token=[REDACTED]&q');
  // B1: pathValues reads composeLegs' own paths — close = the last point, next = index 1.
  const leg = (pts) => pts.map(([at, points]) => ({ tickSeq: null, at, points }));
  const synth = (ghost, bought) => composeLegs({ ghostPts: leg(ghost), boughtPts: leg(bought), locked: 100, swap: { tickSeq: 1, at: 'a' } });
  const pv4 = pathValues(synth([['a', 10], ['b', 20], ['c', 25], ['d', 30]], [['b', 5], ['c', 6], ['d', 8]]));
  check('S12 close = the last point of each path', pv4.close.hold === 30 && pv4.close.swap === 108);
  check('S12 next = the first later check of each path', pv4.next?.hold === 20 && pv4.next?.swap === 105 && pv4.next?.at === 'b');
  check('S12 no later check → no next', pathValues(synth([['a', 10], ['d', 30]], [['d', 8]])).next === null);
  // B10: one request per symbol, spanning its days, in stage order; the counter is taken before the request.
  const fp = fetchPlan([[{ symbol: 'A', etDate: '2026-10-12' }, { symbol: 'A', etDate: '2026-10-13' }], [{ symbol: 'A', etDate: '2026-10-14' }, { symbol: 'B', etDate: '2026-10-13' }]]);
  check('S13 one request per symbol, spanning its days, in stage order', fp.length === 2 && fp[0].symbol === 'A' && fp[0].stage === 0 && fp[0].days.join() === '2026-10-12,2026-10-13,2026-10-14' && fp[1].symbol === 'B' && fp[1].stage === 1
    && fp[0].fromMs === sessionFor('2026-10-12').openMs - FETCH_PAD_MS && fp[0].toMs === sessionFor('2026-10-14').closeMs + FETCH_PAD_MS);
  const eb = ensureBars.toString();
  check('S14 ensureBars counts a request before making it', eb.indexOf('counter.take(') > -1 && eb.indexOf('counter.take(') < eb.indexOf('fetchSymbol('));
  // B11: slotsAt undoes a later trade; checkRows keeps entry-only rows; the $Entry render check; moveAt's sign.
  const sl = slotsAt({ finalSlots: [{ tier: 'core', slotIndex: 0, symbol: 'B', baseATR: 3 }], trades: [{ tier: 'core', slotIndex: 0, symbolOut: 'A', symbolIn: 'B', swappedOutAt: '2026-09-29T15:00:00.000Z' }] }, Date.parse('2026-09-29T14:59:00Z'));
  const sl2 = slotsAt({ finalSlots: [{ tier: 'core', slotIndex: 0, symbol: 'B', baseATR: 3 }], trades: [{ tier: 'core', slotIndex: 0, symbolOut: 'A', symbolIn: 'B', swappedOutAt: '2026-09-29T15:00:00.000Z' }] }, Date.parse('2026-09-29T15:01:00Z'));
  check('S15 slotsAt undoes a trade made after the instant, and only that', sl.slots[0].symbol === 'A' && sl.slots[0].asset === null && sl.problems.length === 0 && sl2.slots[0].symbol === 'B' && sl2.slots[0].asset !== null);
  const cr = checkRows({ ticks: [{ tickSeq: 1, evalId: 'e1', capturedAt: '2026-09-29T15:00:00.000Z', state: 'completed', stageReached: 'finalized' }],
    evaluations: [{ evalId: 'e1', timestamp: '2026-09-29T14:59:50.000Z', haikuFailureClass: null }, { evalId: 'e2', timestamp: '2026-09-29T15:10:00.000Z', haikuFailureClass: null }] }, '2026-09-29');
  check('S16 checkRows keeps an evaluation entry with no tick', cr.length === 2 && cr[1].rowSource === 'entry' && cr[1].key === 'eval:e2');
  const bodyT = ['ACTIVE POSITIONS:', 'Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%,LockNow(base/badges),NextBonus,Levels',
    'star,AAA,Tech,Day1,$10.50,$11.00,+4.76%,+1.20x,[],4.0%,+95(+95/+0),+1%,-', '', 'BENCH (available for swap):', 'Symbol,Sector,$Current,Daily%,ATR%,Status', 'BBB,Tech,$20.25,+1.00%,3.5%,available', ''].join('\n');
  const synthBattle = (start) => ({ gameMode: 'baggerbomb_agent', activatedAt: '2026-09-29T13:00:00.000Z', startingPrices: { AAA: start }, thresholds: {},
    finalSlots: [{ tier: 'star', slotIndex: 0, symbol: 'AAA', baseATR: 4 }], bench: [], trades: [], evaluations: [], ticks: [], receipts: [], tickActions: [] });
  const chk = { tickSeq: 1, capturedAt: '2026-09-29T15:00:00.000Z', shownAt: '2026-09-29T14:59:40.000Z', evidence: { AAA: { px: 11 } } };
  const okIn = buildSwapInputs({ battle: synthBattle(10.5), check: chk, body: parseBody(bodyT), out: 'AAA', in: 'BBB' });
  const badIn = buildSwapInputs({ battle: synthBattle(10.4), check: chk, body: parseBody(bodyT), out: 'AAA', in: 'BBB' });
  check('S17 an entry is accepted only when it renders to the shown $Entry', okIn.ok && okIn.sources.entry === 'portfolio.startingPrices' && !badIn.ok && badIn.missing.includes('X entry: no record renders to the shown $Entry'));
  // B8: a later bench record that does not render to the shown bench ATR% is not "exact" — the 1-dp body value, under M7.
  const benchLater = { ...synthBattle(10.5), bench: [{ symbol: 'BBB', baseATR: 3.92 }] };
  const benchNow = { ...synthBattle(10.5), bench: [{ symbol: 'BBB', baseATR: 3.46 }] };
  const bl = buildSwapInputs({ battle: benchLater, check: chk, body: parseBody(bodyT), out: 'AAA', in: 'BBB' });
  const bn = buildSwapInputs({ battle: benchNow, check: chk, body: parseBody(bodyT), out: 'AAA', in: 'BBB' });
  check('S17 a bench record is exact only when it renders to the shown ATR%', bl.sources.boughtAtr === 'body bench ATR% (1 dp)' && bl.coarseAtr.bought === true && bn.sources.boughtAtr === 'bench baseATR' && bn.coarseAtr.bought === false);
  const mv = moveAt([{ t: Date.parse('2026-09-29T15:00:00Z'), o: 100, h: 101, l: 99, c: 101, v: 1 }], 100, Date.parse('2026-09-29T15:01:00Z'), 'A');
  check('S18 moveAt: up from the shown price is positive', Math.abs(mv.v - 1) < 1e-9);
  // B2: the flat6 stamp reaches the lock (the C-2 bug class): a flat6 star slot locks like a 1x slot, not 2x.
  const lp6 = { symbol: 'T', entryPrice: 100, baseline: 100, history: { maxMultiplier: 0, minMultiplier: 0 }, atr: 8, tier: 'star', direction: null, px: 103 };
  check('S19 the flat6 stamp reaches the lock', lockAt({ ...lp6, tierStamp: 1.0 }) === lockAt({ ...lp6, tier: 'support', tierStamp: null }) && lockAt({ ...lp6, tierStamp: null }) === 2 * lockAt({ ...lp6, tierStamp: 1.0 }));
  // B7: every model-proposed swap is in layer 2's domain; another swap only when the check showed it.
  check('S20 the layer-2 domain', kaInDomain('haiku', false) && kaInDomain('haiku', true) && kaInDomain('archetype', true) && !kaInDomain('archetype', false) && !kaInDomain('risk_manager', false));
  // B6: one completed session, and every unit on its battle's day.
  const osB = (days, completedAt) => ({ b1: { tradingDays: days, completedAt } });
  const osM = { k1: { battleId: 'b1', day: '2026-09-29' } };
  check('S21 one-session check passes a real one-session battle', oneSessionCheck(osB(['2026-09-29'], '2026-09-29T21:00:00.000Z'), osM, [{ k: 'k1' }]).pass === true);
  check('S21 a weekend day, an early completion, two days, or a unit on another day fail', !oneSessionCheck(osB(['2026-09-27'], '2026-09-29T21:00:00.000Z'), { k1: { battleId: 'b1', day: '2026-09-27' } }, [{ k: 'k1' }]).pass
    && !oneSessionCheck(osB(['2026-09-29'], '2026-09-29T18:00:00.000Z'), osM, [{ k: 'k1' }]).pass
    && !oneSessionCheck(osB(['2026-09-29', '2026-09-30'], '2026-09-30T21:00:00.000Z'), osM, [{ k: 'k1' }]).pass
    && !oneSessionCheck(osB(['2026-09-29'], '2026-09-29T21:00:00.000Z'), { k1: { battleId: 'b1', day: '2026-09-30' } }, [{ k: 'k1' }]).pass);
  // B2: the reconciliation gate.
  const rc = (o) => ({ built: 20, builtFlat6: 16, lockMatch: 20, exitMatch: 20, fillMatch: 20, ...o });
  check('S22 the reconciliation gate', reconGate(rc({}), true).pass && reconGate(rc({ lockMatch: 18 }), true).pass && !reconGate(rc({ lockMatch: 17 }), true).pass
    && !reconGate(rc({ builtFlat6: 0 }), true).pass && reconGate(rc({ builtFlat6: 0 }), false).pass && !reconGate(rc({ built: 0, lockMatch: 0, exitMatch: 0, fillMatch: 0 }), false).pass);
  const failed = rows.filter((r) => !r.pass).map((r) => r.name);
  return { pass: failed.length === 0, rows: rows.length, failed };
}

// ---------------------------------------------------------------- CLI

export function parseArgs(argv) {
  const flags = { cmd: argv[2] };
  for (let i = 3; i < argv.length; i += 1) if (argv[i] === '--run') { flags.run = argv[i + 1]; i += 1; }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv);
  switch (flags.cmd) {
    case 'plan': return plan();
    case 'known-answer': return knownAnswer(flags);
    case 'score': return score(flags);
    case 'selftest': {
      const r = runSelftest();
      console.log(JSON.stringify(r, null, 1));
      if (!r.pass) process.exitCode = 1;
      return undefined;
    }
    default:
      console.log('changedMomentsScore — subcommands: selftest | plan | known-answer | score  (options: --run <runId>)');
      return undefined;
  }
}

// CLI entrypoint only — importing this module runs nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((err) => { console.error(redactEodhd(redactSecrets(err?.stack || String(err)))); process.exit(1); });
}
