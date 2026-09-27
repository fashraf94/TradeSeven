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
// WRITE: the series documents under tape/{etDate}/series/{symbol}, then ONE
// transaction on the tape that rewrites only `actions[].replay`,
// `plans[].price`, `passes.candles`, `coverage.replay` and `coverage.series`
// — every other field of every row is written back exactly as read inside the
// transaction, so a close pass that commits first is kept, and one that
// commits second keeps these (tapeMerge.js never takes candle fields from its
// own read).

import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import {
  TAPE_VERSION, SERIES_NUMBER_CLASSES, CANDLE_SELECTABLE_STATUSES, CANDLE_MAX_ATTEMPTS, MARKET_COMPARABLES,
  NON_CHECK_STATES, SERIES_INTERVAL,
} from '../../../src/constants/filmTape.js';
import { sessionBars, priceAt, sessionOpenOf, aggregate10m } from './bars.js';
import { replayAction, REPLAY_LABEL } from './tapeReplay.js';
import { coverageOf } from './tapeAssemble.js';
import { sanitizeForFirestore } from './tapeMerge.js';
import { etDateOf, sessionFor, sessionsBack, candleWindowStart, toMs } from './tapeTime.js';

export const TIME_FLOOR_MS = 30_000;
/** EODHD's intraday endpoint costs 5 API units per request (validationRunner / intradayFetch.js G1). */
export const UNITS_PER_REQUEST = 5;
/** How far past the window the scan looks, to close out tapes that aged out while waiting. */
export const EXPIRY_SCAN_MARGIN_SESSIONS = 5;
export const PLAN_PRICE_NOTE = "prices shown to the day's close, which is not the plan's horizon";

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const iso = (ms) => new Date(ms).toISOString();

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

/** The next `passes.candles` after a run. */
export function nextCandleState({ prev, requested, missing, nowIso }) {
  const attempts = (Number.isInteger(prev?.attempts) ? prev.attempts : 0) + 1;
  let status;
  let reason = null;
  if (missing.length === 0) status = 'written';
  else if (attempts >= CANDLE_MAX_ATTEMPTS) { status = 'failed'; reason = 'attempts_exhausted'; }
  else if (missing.length < requested.length) { status = 'partial'; reason = 'symbols_missing'; }
  else { status = 'failed'; reason = 'fetch_failed'; }
  return { status, writtenAt: nowIso, attempts, reason, source: 'eodhd_1m', symbolsRequested: requested, symbolsMissing: missing };
}

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
  const missing = requested.filter((s) => !barsBySymbol[s]);

  // Series documents (candle-owned; one per symbol with bars), one batch.
  const batch = db.batch();
  const seriesRefs = [];
  for (const entry of plan) {
    const bars = barsBySymbol[entry.symbol];
    if (!bars) continue;
    const sref = ref.collection('series').doc(entry.symbol);
    batch.set(sref, seriesDoc({ tape, entry, bars, session, nowIso }));
    seriesRefs.push(sref.path);
  }
  if (seriesRefs.length) await batch.commit();

  // The targeted update, inside a transaction on the tape.
  let result = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { result = { status: 'gone' }; return; }
    const cur = snap.data();
    const replays = new Map();
    const actions = (Array.isArray(cur.actions) ? cur.actions : []).map((a) => {
      const r = replayAction({ action: a, checks: cur.checks, barsBySymbol, session, sectors: cur.comparables?.sectors || {}, tierStamp: resolveModeConfig(cur.gameMode).flatMultiplier });
      replays.set(a.key, r);
      return { ...a, replay: r };
    });
    const plans = (Array.isArray(cur.plans) ? cur.plans : []).map((p) => ({ ...p, price: planPrice(p, barsBySymbol[p.symbol] || null, session) }));
    const candles = nextCandleState({ prev: cur.passes?.candles, requested, missing, nowIso });
    tx.update(ref, sanitizeForFirestore({
      actions,
      plans,
      'passes.candles': candles,
      'coverage.replay': replayCoverage(cur, replays, session),
      'coverage.series': seriesCoverage(requested, missing, session),
    }));
    result = { status: candles.status, attempts: candles.attempts, requested: requested.length, missing };
  });
  return { ...result, series: seriesRefs.length };
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
  const nowMs = clock();
  const runEtDate = etDateOf(nowMs);
  const windowStart = candleWindowStart(runEtDate);
  const scanStart = sessionsBack(runEtDate, 10 + EXPIRY_SCAN_MARGIN_SESSIONS) ?? windowStart;
  const snap = await db.collectionGroup('tape')
    .where('passes.candles.status', 'in', [...CANDLE_SELECTABLE_STATUSES])
    .where('etDate', '>=', scanStart)
    .orderBy('etDate', 'asc')
    .get();
  const found = (snap?.docs || []).map((d) => ({ ref: d.ref, tape: typeof d.data === 'function' ? d.data() : d.data }))
    .filter((x) => isObj(x.tape?.passes?.candles))
    .sort((a, b) => (a.tape.etDate < b.tape.etDate ? -1 : a.tape.etDate > b.tape.etDate ? 1 : (a.ref.path < b.ref.path ? -1 : 1)));

  const summary = { runEtDate, windowStart, selected: 0, written: [], partial: [], failed: [], expired: [], notReached: [], units: 0, requests: 0, fetchErrors: [] };
  const usage = { requests: 0, errors: [] };
  const memo = new Map();
  for (const [i, { ref, tape }] of found.entries()) {
    const c = tape.passes.candles;
    const attempts = Number.isInteger(c.attempts) ? c.attempts : 0;
    if (attempts >= CANDLE_MAX_ATTEMPTS) continue;                       // terminal — its own status says so
    if (!windowStart || tape.etDate < windowStart) {
      // Aged out while still waiting: close it out, so no reader sees a retry that is not scheduled.
      await ref.update({ 'passes.candles.status': 'failed', 'passes.candles.reason': 'retry_window_elapsed', 'passes.candles.writtenAt': iso(nowMs) });
      summary.expired.push(ref.path);
      continue;
    }
    if (tape.etDate >= runEtDate) continue;                              // the session is not over
    if (budgetMs - (clock() - startMs) < TIME_FLOOR_MS) {
      summary.notReached = found.slice(i).map((x) => x.ref.path);
      break;
    }
    summary.selected += 1;
    try {
      const r = await processTape({ db, ref, tape, nowMs: clock(), fetchCandles, memo, usage });
      const row = { path: ref.path, ...r };
      if (r.status === 'written') summary.written.push(row);
      else if (r.status === 'partial') summary.partial.push(row);
      else summary.failed.push(row);
    } catch (err) {
      const reason = String(err?.message || err).slice(0, 200);
      summary.failed.push({ path: ref.path, error: reason });
      console.error(`[film-tape-candles] ${ref.path} failed: ${reason}`);
      // A thrown run is still an attempt: count it, so a persistent failure
      // reaches its terminal state on the third morning instead of retrying
      // until it ages out.
      try {
        const next = attempts + 1;
        await ref.update({
          'passes.candles.attempts': next,
          'passes.candles.status': 'failed',
          'passes.candles.reason': next >= CANDLE_MAX_ATTEMPTS ? 'attempts_exhausted' : `error: ${reason}`,
          'passes.candles.writtenAt': iso(clock()),
        });
      } catch (markErr) {
        console.error(`[film-tape-candles] ${ref.path} failure could not be recorded: ${markErr?.message || markErr}`);
      }
    }
  }
  summary.requests = usage.requests;
  summary.units = usage.requests * UNITS_PER_REQUEST;
  summary.fetchErrors = usage.errors;
  return summary;
}
