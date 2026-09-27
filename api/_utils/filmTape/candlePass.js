// api/_utils/filmTape/candlePass.js
//
// Film Room tape — THE CANDLE PASS (spec §6). The cron handler
// (api/cron/film-tape-candles.js) is auth + flag + wiring; the fetcher, the
// database and the clock are arguments here.
//
// SELECTION AND RETRY: a collection-group query on `tape` for
// `passes.candles.status ∈ {pending, partial, failed}` from a lower etDate
// bound, oldest first; a tape is PROCESSED when it is at most 10 sessions old
// (candleWindowStart) and has attempts < 3. Each run increments `attempts`;
// the third unsuccessful attempt ends in `failed` with a reason. A tape that
// aged out of the window while still waiting is marked `failed`,
// `retry_window_elapsed` — so nothing reads as scheduled that is not. There is
// no other retry path.
//
// WRITE-PATH BOUNDARY (BA-23): the query returns every collection named `tape`
// anywhere in the database, so a result is never trusted by its collection
// name. Before any expiry, failure record, fetch or write, its path must be
// exactly agentBattles/{battleId}/tape/{etDate} with a well-formed etDate, and
// the document must name that battle and that day; every downstream reference
// is then BUILT from those validated ids (tapeRef), never taken from the query.
// A result that fails is skipped and counted (`invalid`), never written.
//
// SYMBOLS PER TAPE: held at any check ∪ actions[].symbolOut ∪ symbolIn ∪
// plans[].symbol ∪ SPY, RSP ∪ TICKER_TO_SECTOR of each held, sold or planned
// name. Crypto is out of scope (BA-3).
//
// FETCH: the generic fetcher (fetchIntradayCandles, marketDataCache.js) at
// interval '1m' with a window reaching back to the session's open — its
// window is NOW-anchored (`hoursBack`), so bars.js cuts the target session out
// of it. One request per (symbol, session) per run. A symbol that fails or
// returns no session bars goes to `symbolsMissing`; its dependents are marked
// `missingInputs` — never guessed. No shared 1-minute bar cache exists at
// HEAD (build report §1.1 item 6), so `source` is always `eodhd_1m`.
//
// WRITE: ONE transaction on the tape that writes the series documents under
// tape/{etDate}/series/{symbol} and rewrites only `actions[].replay`,
// `plans[].price`, `passes.candles`, `coverage.replay` and `coverage.series`
// — every other field of every row is written back exactly as read inside the
// transaction, so a close pass that commits first is kept, and one that
// commits second keeps these (tapeMerge.js never takes candle fields from its
// own read). A close pass that GREW the tape's symbol set mid-run leaves it
// queued for the next morning (`requeued`). A retry keeps the more complete of
// the stored and the fresh result, so no attempt loses what an earlier one
// saved (§8 invariant 7). The writer flag is read at call time here too.

import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import {
  TAPE_VERSION, SERIES_NUMBER_CLASSES, CANDLE_SELECTABLE_STATUSES, CANDLE_MAX_ATTEMPTS, MARKET_COMPARABLES,
  NON_CHECK_STATES, SERIES_INTERVAL, SERIES_SUBCOLLECTION, TAPE_SUBCOLLECTION,
} from '../../../src/constants/filmTape.js';
import { FILM_TAPE_WRITE_ENABLED } from '../../../src/config/featureFlags.js';
import { sessionBars, priceAt, sessionOpenOf, aggregate10m } from './bars.js';
import { replayAction, REPLAY_LABEL } from './tapeReplay.js';
import { coverageOf } from './tapeAssemble.js';
import { sanitizeForFirestore } from './tapeMerge.js';
import { tapeRef } from './tapeSources.js';
import { etDateOf, sessionFor, sessionsBack, candleWindowStart, toMs } from './tapeTime.js';

export const TIME_FLOOR_MS = 30_000;
/** EODHD's intraday endpoint costs 5 API units per request (validationRunner / intradayFetch.js G1). */
export const UNITS_PER_REQUEST = 5;
/** How far past the window the scan looks, to close out tapes that aged out while waiting. */
export const EXPIRY_SCAN_MARGIN_SESSIONS = 5;
export const PLAN_PRICE_NOTE = "prices shown to the day's close, which is not the plan's horizon";

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const iso = (ms) => new Date(ms).toISOString();

/** A real calendar date written YYYY-MM-DD (2026-02-30 and 2026-9-24 are not). */
function wellFormedEtDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s;
}

/**
 * BA-23 — the battle and day of a tape reference, from its PATH, or null when
 * the path is not exactly agentBattles/{battleId}/tape/{etDate} with a
 * well-formed etDate (a foreign parent, a wrong depth, a malformed date).
 */
export function tapeIdOf(path) {
  const seg = typeof path === 'string' ? path.split('/') : [];
  if (seg.length !== 4 || seg[0] !== 'agentBattles' || seg[2] !== TAPE_SUBCOLLECTION) return null;
  const [, battleId, , etDate] = seg;
  return battleId && wellFormedEtDate(etDate) ? { battleId, etDate } : null;
}

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

/**
 * Fetch one symbol's bars for one session, through `fetchCandles` (the
 * generic fetcher in production), memoised for the run.
 */
async function barsFor({ symbol, etDate, session, nowMs, fetchCandles, memo, usage }) {
  const key = `${symbol}|${etDate}`;
  if (memo.has(key)) return memo.get(key);
  const hoursBack = Math.ceil((nowMs - session.openMs) / 3_600_000) + 1;
  let bars = [];
  try {
    usage.requests += 1;
    const candles = await fetchCandles(symbol, { interval: '1m', hoursBack });
    bars = sessionBars(candles, etDate, session);
  } catch (err) {
    usage.errors.push(`${symbol}: ${String(err?.message || err).slice(0, 120)}`);
    bars = [];
  }
  const out = bars.length ? bars : null;
  memo.set(key, out);
  return out;
}

function planPrice(plan, bars, session) {
  if (isCryptoSymbol(plan.symbol)) return { atPlan: null, atClose: null, note: PLAN_PRICE_NOTE, missingInputs: ['crypto_not_supported'] };
  if (!bars) return { atPlan: null, atClose: null, note: PLAN_PRICE_NOTE, missingInputs: [`bars:${plan.symbol}`] };
  const atPlanMs = toMs(plan.at);
  const p = atPlanMs === null ? null : priceAt(bars, atPlanMs);
  const c = priceAt(bars, session.closeMs);
  const missing = [];
  if (!p) missing.push(`price:${plan.symbol}@plan`);
  if (!c) missing.push(`price:${plan.symbol}@close`);
  return {
    atPlan: p ? { value: p.price, at: iso(p.barClosedAt), basis: 'last_completed_minute' } : null,
    atClose: c ? { value: c.price, at: iso(c.barClosedAt), basis: 'last_completed_minute' } : null,
    note: PLAN_PRICE_NOTE,
    missingInputs: missing,
  };
}

function seriesDoc({ tape, entry, bars, session, nowIso }) {
  const checks = (Array.isArray(tape.checks) ? tape.checks : []).filter((c) => !NON_CHECK_STATES.includes(c.state) && toMs(c.at) !== null);
  return sanitizeForFirestore({
    tapeVersion: TAPE_VERSION,
    battleId: tape.battleId,
    etDate: tape.etDate,
    symbol: entry.symbol,
    ownerId: tape.ownerId ?? null,
    role: entry.role,
    roles: entry.roles,
    interval: SERIES_INTERVAL,
    sessionOpen: sessionOpenOf(bars, session),
    provenance: 'market',
    bars: aggregate10m(bars, session),
    atChecks: checks.map((c) => {
      const p = priceAt(bars, toMs(c.at));
      return { tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at, price: p ? p.price : null, barClosedAt: p ? iso(p.barClosedAt) : null };
    }),
    numberClasses: SERIES_NUMBER_CLASSES,
    writtenAt: nowIso,
  });
}

function replayCoverage(tape, replays, session) {
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  if (!actions.length) return coverageOf('complete', { sources: ['eodhd_1m'], note: `no actions this day · ${REPLAY_LABEL}` });
  const outOfScope = actions.filter((a) => a.replayReason === 'crypto_not_supported').length;
  const inScope = actions.length - outOfScope;
  const full = [...replays.values()].filter((r) => r && r.gapPoints !== null && r.missingInputs.length === 0).length;
  const reasons = [];
  if (outOfScope) reasons.push(`${outOfScope} crypto leg(s) not replayed (crypto_not_supported)`);
  const missing = [...new Set([...replays.values()].flatMap((r) => (r ? r.missingInputs : [])))];
  if (missing.length) reasons.push(`missing inputs: ${missing.join(', ')}`);
  const status = full === inScope && !outOfScope ? 'complete' : (full > 0 || [...replays.values()].some((r) => r && (r.ghost || r.bought)) ? 'partial' : 'unavailable');
  const spanFrom = actions.map((a) => toMs(a.at)).filter((v) => v !== null).sort((a, b) => a - b)[0];
  return coverageOf(status, {
    span: spanFrom !== undefined ? { from: iso(spanFrom), to: iso(session.closeMs) } : null,
    sources: ['eodhd_1m', 'actions[].replayInputs'],
    note: [REPLAY_LABEL, ...reasons].join('; '),
  });
}

function seriesCoverage(requested, missing, session) {
  const status = missing.length === 0 ? 'complete' : (missing.length < requested.length ? 'partial' : 'unavailable');
  return coverageOf(status, {
    span: { from: iso(session.openMs), to: iso(session.closeMs) },
    sources: ['eodhd_1m'],
    note: missing.length ? `no bars for: ${missing.join(', ')}` : null,
  });
}

/**
 * The next `passes.candles` after a run. `missing` is the symbols NO attempt
 * has obtained; `retryable` is true while a kept replay or price still lacks
 * bars (its symbols obtained on different mornings) — a later attempt can
 * complete it, so the pass is not `written` yet.
 */
export function nextCandleState({ prev, requested, missing, retryable = false, nowIso }) {
  const attempts = (Number.isInteger(prev?.attempts) ? prev.attempts : 0) + 1;
  let status;
  let reason = null;
  if (missing.length === 0 && !retryable) status = 'written';
  else if (attempts >= CANDLE_MAX_ATTEMPTS) { status = 'failed'; reason = 'attempts_exhausted'; }
  else if (missing.length > 0 && missing.length === requested.length) { status = 'failed'; reason = 'fetch_failed'; }
  else if (missing.length > 0) { status = 'partial'; reason = 'symbols_missing'; }
  else { status = 'partial'; reason = 'replay_incomplete'; }
  return { status, writtenAt: nowIso, attempts, reason, source: 'eodhd_1m', symbolsRequested: requested, symbolsMissing: missing };
}

/** How complete a replay is: a gap first, then legs, then fewer missing inputs. */
const replayRank = (r) => (r ? (r.gapPoints !== null ? 1000 : 0) + ((r.ghost ? 1 : 0) + (r.bought ? 1 : 0)) * 100 - (r.missingInputs || []).length : -1);
/** How complete a plan's prices are: how many of the two points exist. */
const priceRank = (p) => (p ? (p.atPlan ? 1 : 0) + (p.atClose ? 1 : 0) : -1);
/** The stored result unless the fresh one is at least as complete (review L2-F1). */
const keepBetter = (stored, fresh, rank) => (stored && rank(stored) > rank(fresh) ? stored : fresh);
const needsBars = (missingInputs) => (missingInputs || []).some((m) => m.startsWith('bars:'));

/**
 * Process one tape document: fetch, replay, price the plans, write the series
 * and the targeted update. Returns what it did.
 */
export async function processTape({ db, ref, tape, nowMs, fetchCandles, memo, usage }) {
  const nowIso = iso(nowMs);
  const session = sessionFor(tape.etDate);
  if (!session?.isTradingDay) throw new Error(`not_a_session: ${tape.etDate}`);
  const plan = symbolPlan(tape);
  const barsBySymbol = {};
  for (const entry of plan) {
    const bars = await barsFor({ symbol: entry.symbol, etDate: tape.etDate, session, nowMs, fetchCandles, memo, usage });
    if (bars) barsBySymbol[entry.symbol] = bars;
  }
  const requested = plan.map((e) => e.symbol);

  // ONE transaction on the tape: the targeted update AND the series documents,
  // both computed from the tape as it stands at commit (review L2-F4).
  let result = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { result = { status: 'gone' }; return; }
    const cur = snap.data();
    // The close pass may have re-merged this tape while its bars were being
    // fetched (a backfill request, say). A symbol the tape NOW needs that this
    // run never planned would be written as missing under a pass claiming
    // `written`; instead the tape is left exactly as the close pass left it
    // (pending, sources_changed) and the next morning plans from it as it stands.
    const curPlan = symbolPlan(cur);
    const unplanned = curPlan.map((e) => e.symbol).filter((sym) => !requested.includes(sym));
    if (unplanned.length) { result = { status: 'requeued', unplanned }; return; }

    // A retry never loses what an earlier attempt saved (§8 invariant 7,
    // BA-19; review L2-F1): per action and per plan the more complete of the
    // stored and the fresh result is kept, and a symbol an earlier attempt
    // obtained keeps its series document and is not missing.
    const replays = new Map();
    const actions = (Array.isArray(cur.actions) ? cur.actions : []).map((a) => {
      const fresh = replayAction({ action: a, checks: cur.checks, barsBySymbol, session, sectors: cur.comparables?.sectors || {}, tierStamp: resolveModeConfig(cur.gameMode).flatMultiplier });
      const kept = keepBetter(a.replay ?? null, fresh, replayRank);
      replays.set(a.key, kept);
      return { ...a, replay: kept };
    });
    const plans = (Array.isArray(cur.plans) ? cur.plans : []).map((p) => ({ ...p, price: keepBetter(p.price ?? null, planPrice(p, barsBySymbol[p.symbol] || null, session), priceRank) }));
    const prev = cur.passes?.candles;
    const obtainedBefore = new Set((prev?.symbolsRequested || []).filter((sym) => !(prev?.symbolsMissing || []).includes(sym)));
    const missing = requested.filter((sym) => !barsBySymbol[sym] && !obtainedBefore.has(sym));
    const retryable = [...replays.values()].some((r) => r && needsBars(r.missingInputs)) || plans.some((p) => p.price && needsBars(p.price.missingInputs));
    const candles = nextCandleState({ prev, requested, missing, retryable, nowIso });
    let series = 0;
    for (const entry of curPlan) {
      const bars = barsBySymbol[entry.symbol];
      if (!bars) continue;
      tx.set(ref.collection(SERIES_SUBCOLLECTION).doc(entry.symbol), seriesDoc({ tape: cur, entry, bars, session, nowIso }));
      series += 1;
    }
    tx.update(ref, sanitizeForFirestore({
      actions,
      plans,
      'passes.candles': candles,
      'coverage.replay': replayCoverage(cur, replays, session),
      'coverage.series': seriesCoverage(requested, missing, session),
    }));
    result = { status: candles.status, attempts: candles.attempts, requested: requested.length, missing, series };
  });
  return result;
}

/**
 * The morning run.
 *
 * @param {object} p
 * @param {object} p.db
 * @param {(symbol: string, opts: object) => Promise<Array>} p.fetchCandles
 * @param {() => number} p.clock
 */
export async function runCandlePass({ db, fetchCandles, clock = Date.now, startMs = clock(), budgetMs = 300_000 }) {
  // The writer flag at CALL time, here too — not only in the handler — so no
  // caller can write a tape while the writer is dark (review L3-F4).
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const nowMs = clock();
  const runEtDate = etDateOf(nowMs);
  if (!sessionFor(runEtDate)) {
    // Outside the maintained market calendar the window cannot be counted:
    // fail loudly, never build a query on a null date (review L3-F7).
    console.error(`[film-tape-candles] calendar_missing: the market calendar has no entry for ${runEtDate} — no candle pass until it is maintained`);
    return { runEtDate, skipped: true, reason: 'calendar_missing', selected: 0, written: [], partial: [], failed: [], requeued: [], expired: [], notReached: [], invalid: [], units: 0, requests: 0, fetchErrors: [] };
  }
  const windowStart = candleWindowStart(runEtDate);
  const scanStart = sessionsBack(runEtDate, 10 + EXPIRY_SCAN_MARGIN_SESSIONS) ?? windowStart;
  const snap = await db.collectionGroup('tape')
    .where('passes.candles.status', 'in', [...CANDLE_SELECTABLE_STATUSES])
    .where('etDate', '>=', scanStart)
    .orderBy('etDate', 'asc')
    .get();
  // BA-23: validate every result's path BEFORE anything else touches it, and
  // build its reference from the validated ids — the query's own reference is
  // never written to.
  const found = [];
  const invalid = [];
  for (const d of snap?.docs || []) {
    const id = tapeIdOf(d?.ref?.path);
    const tape = typeof d?.data === 'function' ? d.data() : d?.data;
    if (!id || !isObj(tape) || tape.battleId !== id.battleId || tape.etDate !== id.etDate) { invalid.push(String(d?.ref?.path ?? '(no path)')); continue; }
    if (!isObj(tape.passes?.candles)) continue;
    found.push({ id, path: `agentBattles/${id.battleId}/${TAPE_SUBCOLLECTION}/${id.etDate}`, ref: tapeRef(db, id.battleId, id.etDate), tape });
  }
  found.sort((a, b) => (a.id.etDate < b.id.etDate ? -1 : a.id.etDate > b.id.etDate ? 1 : (a.path < b.path ? -1 : 1)));
  if (invalid.length) {
    console.error(`[film-tape-candles] skipped ${invalid.length} tape reference(s) outside agentBattles/{battleId}/tape/{etDate}: ${invalid.slice(0, 20).join(', ')}`);
  }

  const summary = { runEtDate, windowStart, selected: 0, written: [], partial: [], failed: [], requeued: [], expired: [], notReached: [], invalid, units: 0, requests: 0, fetchErrors: [] };
  const usage = { requests: 0, errors: [] };
  const memo = new Map();
  for (const [i, { id, path, ref, tape }] of found.entries()) {
    const c = tape.passes.candles;
    const attempts = Number.isInteger(c.attempts) ? c.attempts : 0;
    if (attempts >= CANDLE_MAX_ATTEMPTS) continue;                       // terminal — its own status says so
    if (!windowStart || id.etDate < windowStart) {
      // Aged out while still waiting: close it out, so no reader sees a retry
      // that is not scheduled. Isolated: one failed marker never costs the
      // morning (review L2-F6) — the tape is simply seen again tomorrow.
      try {
        await ref.update({ 'passes.candles.status': 'failed', 'passes.candles.reason': 'retry_window_elapsed', 'passes.candles.writtenAt': iso(nowMs) });
        summary.expired.push(path);
      } catch (err) {
        summary.failed.push({ path, error: `close-out: ${String(err?.message || err).slice(0, 160)}` });
        console.error(`[film-tape-candles] ${path} close-out failed: ${err?.message || err}`);
      }
      continue;
    }
    if (id.etDate >= runEtDate) continue;                                // the session is not over
    if (budgetMs - (clock() - startMs) < TIME_FLOOR_MS) {
      summary.notReached = found.slice(i).map((x) => x.path);
      break;
    }
    summary.selected += 1;
    try {
      const r = await processTape({ db, ref, tape, nowMs: clock(), fetchCandles, memo, usage });
      const row = { path, ...r };
      if (r.status === 'written') summary.written.push(row);
      else if (r.status === 'partial') summary.partial.push(row);
      else if (r.status === 'requeued') summary.requeued.push(path);
      else summary.failed.push(row);
    } catch (err) {
      const reason = String(err?.message || err).slice(0, 200);
      summary.failed.push({ path, error: reason });
      console.error(`[film-tape-candles] ${path} failed: ${reason}`);
      // A thrown run is still an attempt: count it, so a persistent failure
      // reaches its terminal state on the third morning instead of retrying
      // until it ages out — counted from the tape AS IT STANDS, inside a
      // transaction, never from the selection's snapshot (review L2-F4).
      try {
        await db.runTransaction(async (tx) => {
          const cur = await tx.get(ref);
          const c = cur.exists ? cur.data()?.passes?.candles : null;
          if (!isObj(c) || !CANDLE_SELECTABLE_STATUSES.includes(c.status)) return;
          const next = (Number.isInteger(c.attempts) ? c.attempts : 0) + 1;
          tx.update(ref, {
            'passes.candles.attempts': next,
            'passes.candles.status': 'failed',
            'passes.candles.reason': next >= CANDLE_MAX_ATTEMPTS ? 'attempts_exhausted' : `error: ${reason}`,
            'passes.candles.writtenAt': iso(clock()),
          });
        });
      } catch (markErr) {
        console.error(`[film-tape-candles] ${path} failure could not be recorded: ${markErr?.message || markErr}`);
      }
    }
  }
  summary.requests = usage.requests;
  summary.units = usage.requests * UNITS_PER_REQUEST;
  summary.fetchErrors = usage.errors;
  return summary;
}
