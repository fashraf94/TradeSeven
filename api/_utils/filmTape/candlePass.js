// api/_utils/filmTape/candlePass.js
//
// Film Room tape — THE CANDLE PASS (spec §6). The cron handler
// (api/cron/film-tape-candles.js) is auth + flag + wiring; the fetcher, the
// database and the clock are arguments here.
//
// SELECTION AND RETRY: a collection-group query on `tape` for the NON-TERMINAL
// statuses `passes.candles.status ∈ {pending, partial, failed}` from a lower
// etDate bound, oldest first; a tape is PROCESSED when it is at most 10
// sessions old (candleWindowStart). Each run increments `attempts`; the third
// unsuccessful attempt ends `exhausted` (reason `attempts_exhausted`). A tape
// that aged out of the window while still waiting ends `expired` (reason
// `retry_window_elapsed`) — so nothing reads as scheduled that is not. There
// is no other retry path. BA-32: `expired` and `exhausted` are TERMINAL, and
// no candle query selects them, so a terminal tape never occupies a query
// result; `failed` means retryable only.
//
// THE EXPIRY SWEEP (BA-29, BA-32): the selection reaches back only five
// sessions past the window, so a tape left waiting through a longer outage or
// a writer-off period would fall behind it forever. Each run therefore first
// sweeps, in a bounded batch (EXPIRY_SWEEP: close-outs, page size, documents
// read), the non-terminal tapes older than the scan — pending, partial and
// failed, over their whole history. Each close-out makes its tape terminal
// and so removes it from every query: the sweep resumes where it stopped
// without a cursor. It runs before the fetches, so a busy morning can never
// starve it — and it has its own clock (BA-33): the time is checked before
// every close-out, not only before each page, and the sweep spends at most its
// 60 s share of the run, so a sustained backlog can never starve the morning's
// own work either. The founder's repair path for such a day is the backfill
// entry's refresh mode.
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
//
// WHAT EACH OUTPUT WAS BUILT FROM (BA-31): every unit this pass builds — each
// action's replay, each plan's price, each series document — carries
// `builtFrom`, the identity of that unit's own inputs (candleInputs.js). A
// unit kept from an earlier attempt keeps its own `builtFrom`; when that no
// longer matches its inputs on the tape now, the unit is STALE: its section's
// coverage is at most `partial` and names it, and the pass stays queued. A
// retry that could not rebuild a unit never relabels it current. The stored
// `passes.candles.inputFingerprint` is the inputs this pass read — the close
// pass's re-queue trigger — and is never read as proof that any unit was
// rebuilt.

import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import {
  TAPE_VERSION, SERIES_NUMBER_CLASSES, CANDLE_SELECTABLE_STATUSES, CANDLE_MAX_ATTEMPTS,
  NON_CHECK_STATES, SERIES_INTERVAL, SERIES_SUBCOLLECTION, TAPE_SUBCOLLECTION,
} from '../../../src/constants/filmTape.js';
import { FILM_TAPE_WRITE_ENABLED } from '../../../src/config/featureFlags.js';
import { sessionBars, sampleAt, sampleCanExist, expectedSeriesBars, sessionOpenOf, aggregate10m } from './bars.js';
import { replayAction, REPLAY_LABEL } from './tapeReplay.js';
import { coverageOf } from './tapeAssemble.js';
import { sanitizeForFirestore, stableStringify } from './tapeMerge.js';
import { tapeRef } from './tapeSources.js';
import { symbolPlan, candleInputFingerprint, replayBuiltFrom, priceBuiltFrom, seriesBuiltFrom } from './candleInputs.js';

export { symbolPlan };
import { etDateOf, sessionFor, sessionsBack, candleWindowStart, toMs } from './tapeTime.js';

export const TIME_FLOOR_MS = 30_000;
/** EODHD's intraday endpoint costs 5 API units per request (validationRunner / intradayFetch.js G1). */
export const UNITS_PER_REQUEST = 5;
/** How far past the window the scan looks, to close out tapes that aged out while waiting. */
export const EXPIRY_SCAN_MARGIN_SESSIONS = 5;
/**
 * BA-29 — the expiry sweep's bounds per run: close-outs, documents per page,
 * documents read, and (BA-33) the share of the run it may spend — 60 s; the
 * rest belongs to enrichment. (BA-32 removed the 60-session look-back for
 * retryable `failed` tapes: it only bounded re-reads of terminal ones, which
 * no query returns any more.)
 */
export const EXPIRY_SWEEP = Object.freeze({ maxMarks: 100, page: 100, maxReads: 1000, shareMs: 60_000 });
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

/**
 * A plan's price point (BA-10, BA-24): the last completed minute's close when
 * that minute closed within 5 minutes of the instant; a stale bar gives
 * `{ value: null, at: <its close>, basis: 'stale_bar' }` — the null with its
 * age beside it; no completed minute at all gives null.
 */
const pricePoint = (smp) => (!smp ? null : smp.valid
  ? { value: smp.price, at: iso(smp.barClosedAt), basis: 'last_completed_minute' }
  : { value: null, at: iso(smp.barClosedAt), basis: 'stale_bar' });

function planPrice(plan, bars, session) {
  if (isCryptoSymbol(plan.symbol)) return { atPlan: null, atClose: null, note: PLAN_PRICE_NOTE, missingInputs: ['crypto_not_supported'], retryableInputs: [] };
  if (!bars) return { atPlan: null, atClose: null, note: PLAN_PRICE_NOTE, missingInputs: [`bars:${plan.symbol}`], retryableInputs: [`bars:${plan.symbol}`] };
  const atPlanMs = toMs(plan.at);
  const p = atPlanMs === null ? null : sampleAt(bars, atPlanMs);
  const c = sampleAt(bars, session.closeMs);
  const missing = [];
  const retryable = [];
  if (!p?.valid) { missing.push(`price:${plan.symbol}@plan`); if (sampleCanExist(session, atPlanMs)) retryable.push(`price:${plan.symbol}@plan`); }
  if (!c?.valid) { missing.push(`price:${plan.symbol}@close`); retryable.push(`price:${plan.symbol}@close`); }
  return { atPlan: pricePoint(p), atClose: pricePoint(c), note: PLAN_PRICE_NOTE, missingInputs: missing, retryableInputs: retryable };
}

/** The checks a series prices: every row that records a check the battle ran, with its time. */
const seriesChecks = (tape) => (Array.isArray(tape.checks) ? tape.checks : []).filter((c) => !NON_CHECK_STATES.includes(c.state) && toMs(c.at) !== null);
const checkKey = (tickSeq, at) => `${Number.isInteger(tickSeq) ? tickSeq : ''}|${at}`;

function seriesDoc({ tape, entry, bars, session, nowIso, builtFrom }) {
  const checks = seriesChecks(tape);
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
    // BA-24: a stale bar's price never stands for the check — null, with that bar's close time beside it.
    atChecks: checks.map((c) => {
      const p = sampleAt(bars, toMs(c.at));
      return { tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, at: c.at, price: p?.valid ? p.price : null, barClosedAt: p ? iso(p.barClosedAt) : null };
    }),
    numberClasses: SERIES_NUMBER_CLASSES,
    builtFrom,
    writtenAt: nowIso,
  });
}

/** BA-31: the label a kept unit carries while its inputs have changed since it was built. */
const staleLabel = (what, names) => `${what} built before its inputs changed, kept (not rebuilt this attempt): ${names.join(', ')}`;

function replayCoverage(tape, replays, session, stale = []) {
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  if (!actions.length) return coverageOf('complete', { sources: ['eodhd_1m'], note: `no actions this day · ${REPLAY_LABEL}` });
  const outOfScope = actions.filter((a) => a.replayReason === 'crypto_not_supported').length;
  const inScope = actions.length - outOfScope;
  const full = [...replays.values()].filter((r) => r && r.gapPoints !== null && r.missingInputs.length === 0).length;
  const reasons = [];
  if (outOfScope) reasons.push(`${outOfScope} crypto leg(s) not replayed (crypto_not_supported)`);
  const missing = [...new Set([...replays.values()].flatMap((r) => (r ? r.missingInputs : [])))];
  if (missing.length) reasons.push(`missing inputs: ${missing.join(', ')}`);
  // BA-31: a replay is complete only while it is current — built from the inputs the tape holds now.
  if (stale.length) reasons.push(staleLabel('replay', stale.map((a) => `${a.symbolOut} → ${a.symbolIn}`)));
  const whole = full === inScope && !outOfScope && !stale.length;
  const status = whole ? 'complete' : (full > 0 || [...replays.values()].some((r) => r && (r.ghost || r.bought)) ? 'partial' : 'unavailable');
  const spanFrom = actions.map((a) => toMs(a.at)).filter((v) => v !== null).sort((a, b) => a - b)[0];
  return coverageOf(status, {
    span: spanFrom !== undefined ? { from: iso(spanFrom), to: iso(session.closeMs) } : null,
    sources: ['eodhd_1m', 'actions[].replayInputs'],
    note: [REPLAY_LABEL, ...reasons].join('; '),
  });
}

/**
 * BA-24 — what a series document lacks against a whole session: fewer
 * 10-minute bars than the calendar's count, or a check with no fresh price at
 * an instant a minute could have closed by. Empty when whole.
 */
export function seriesGaps(doc, session) {
  const gaps = [];
  const expected = expectedSeriesBars(session);
  const have = Array.isArray(doc?.bars) ? doc.bars.length : 0;
  if (have < expected) gaps.push(`${have} of ${expected} ten-minute bars`);
  const stale = (Array.isArray(doc?.atChecks) ? doc.atChecks : []).filter((a) => a && a.price === null && sampleCanExist(session, toMs(a.at))).length;
  if (stale) gaps.push(`no fresh price at ${stale} check(s)`);
  return gaps;
}

/** A kept series priced fewer checks than the tape now has: built before those checks were recorded. */
function uncoveredChecks(doc, checks) {
  const have = new Set((Array.isArray(doc?.atChecks) ? doc.atChecks : []).map((a) => checkKey(a?.tickSeq, a?.at)));
  const n = checks.filter((c) => !have.has(checkKey(c.tickSeq, c.at))).length;
  return n ? [`built before ${n} check(s) were recorded`] : [];
}

/** The 1-minute bars a 10-minute bar was built from (BA-34). */
const barMinutes = (b) => (Number.isFinite(b?.m) ? b.m : 0);
/** The minutes a series document's 10-minute bars hold. */
const seriesMinutes = (doc) => (Array.isArray(doc?.bars) ? doc.bars.reduce((n, b) => n + barMinutes(b), 0) : 0);
const factsOf = (doc) => stableStringify({ bars: doc?.bars ?? [], atChecks: doc?.atChecks ?? [], sessionOpen: doc?.sessionOpen ?? null });

/**
 * BA-34 — per symbol, the series a retry writes, merged FACT BY FACT from the
 * SAVED document and the one this attempt built (never by counting):
 *
 *   · per 10-minute bucket, the bar built from more 1-minute bars (`m`) wins,
 *     and a tie keeps the stored bar; a bucket only one side has is kept;
 *   · per check, a saved price is never replaced by null, and is replaced by
 *     another price only when that price's bar completed LATER — the new
 *     price is non-null, so its bar is inside BA-24's freshness rule;
 *   · the checks are the tape's checks NOW, which the new build samples every
 *     one of: a saved sample for a check the tape no longer has — an entry
 *     row its tick record superseded — is no fact about any check, and goes
 *     with the row (review R1-5);
 *   · the session open: the stored one unless it has none.
 *
 * A merge that keeps any earlier fact is `kept` (the caller marks it
 * preservedFrom); a new build that holds every saved fact — a true superset —
 * replaces the saved one cleanly. A saved series with no new response simply
 * stands. The new build's description (roles, `builtFrom`, `writtenAt`) is
 * the merged document's: it covers the checks the tape has now (BA-31).
 */
export function keepSeries(saved, fresh) {
  if (!saved) return { doc: fresh ?? null, kept: false };
  if (!fresh) return { doc: saved, kept: true, why: 'no bars this attempt' };
  const savedBars = new Map((Array.isArray(saved.bars) ? saved.bars : []).filter(isObj).map((b) => [b.t, b]));
  const freshBars = new Map((Array.isArray(fresh.bars) ? fresh.bars : []).filter(isObj).map((b) => [b.t, b]));
  const bars = [...new Set([...savedBars.keys(), ...freshBars.keys()])].sort().map((t) => {
    const s = savedBars.get(t);
    const f = freshBars.get(t);
    return !s ? f : (!f ? s : (barMinutes(f) > barMinutes(s) ? f : s));
  });
  const keyOf = (a) => checkKey(a?.tickSeq, a?.at);
  const savedAt = new Map((Array.isArray(saved.atChecks) ? saved.atChecks : []).filter(isObj).map((a) => [keyOf(a), a]));
  const atChecks = (Array.isArray(fresh.atChecks) ? fresh.atChecks : []).map((f) => {
    const s = savedAt.get(keyOf(f));
    if (typeof s?.price !== 'number') return f;                          // a null is no fact to keep
    if (typeof f.price !== 'number') return s;                           // never a price replaced by null
    return (toMs(f.barClosedAt) ?? -Infinity) > (toMs(s.barClosedAt) ?? -Infinity) ? f : s;
  });
  const merged = { ...fresh, bars, atChecks, sessionOpen: saved.sessionOpen ?? fresh.sessionOpen ?? null };
  if (factsOf(merged) === factsOf(fresh)) return { doc: fresh, kept: false };
  return { doc: merged, kept: true, why: seriesMinutes(fresh) < seriesMinutes(saved) ? 'a shorter response' : 'facts this response lacked' };
}

/**
 * The series section: the series documents, and — since plan prices have no
 * section of their own (spec §4 lists nine) — the plans' prices, the other
 * market samples this pass takes. BA-31: plan-price coverage is complete only
 * when every price is current, and — as a replay's (replayCoverage) — only when
 * no price lacks an input (review R1-2): a price missing a sample is named,
 * and holds the section at most `partial`.
 */
function seriesCoverage(requested, missing, gapsBySymbol, session, keptFrom = [], stalePrices = [], unpricedPlans = []) {
  const incomplete = Object.keys(gapsBySymbol).sort();
  const whole = missing.length === 0 && incomplete.length === 0 && stalePrices.length === 0 && unpricedPlans.length === 0;
  const status = whole ? 'complete' : (missing.length < requested.length ? 'partial' : 'unavailable');
  const notes = [];
  if (missing.length) notes.push(`no bars for: ${missing.join(', ')}`);
  // symbolsMissing empty is not evidence that bars were complete (BA-24)
  if (incomplete.length) notes.push(`incomplete — ${incomplete.map((sym) => `${sym}: ${gapsBySymbol[sym].join(', ')}`).join('; ')}`);
  if (keptFrom.length) notes.push(`kept from an earlier attempt: ${keptFrom.map((k) => `${k.symbol} (${k.why})`).join(', ')}`);
  if (stalePrices.length) notes.push(staleLabel('plan price', stalePrices.map((p) => p.symbol)));
  if (unpricedPlans.length) notes.push(`plan price missing inputs: ${unpricedPlans.map((p) => `${p.symbol} (${p.price.missingInputs.join(', ')})`).join('; ')}`);
  const cov = coverageOf(status, {
    span: { from: iso(session.openMs), to: iso(session.closeMs) },
    sources: ['eodhd_1m'],
    note: notes.join('; ') || null,
  });
  // The section holds series an earlier attempt built (BA-25): say from when.
  return { ...cov, preservedFrom: keptFrom.map((k) => k.since).filter(Boolean).sort()[0] ?? null };
}

/**
 * The next `passes.candles` after a run. `missing` is the symbols NO attempt
 * has obtained; `incomplete` the symbols whose kept series is not a whole
 * session (BA-24); `retryable` is true while a kept replay or price still
 * lacks an input a later fetch could supply — bars obtained on different
 * mornings, or a stale sample (BA-24) — so the pass is not `written` yet.
 */
export function nextCandleState({ prev, requested, missing, incomplete = [], retryable = false, stale = false, inputFingerprint = null, nowIso }) {
  const attempts = (Number.isInteger(prev?.attempts) ? prev.attempts : 0) + 1;
  let status;
  let reason = null;
  if (missing.length === 0 && incomplete.length === 0 && !retryable && !stale) status = 'written';
  else if (attempts >= CANDLE_MAX_ATTEMPTS) { status = 'exhausted'; reason = 'attempts_exhausted'; }   // BA-32: terminal
  else if (missing.length > 0 && missing.length === requested.length) { status = 'failed'; reason = 'fetch_failed'; }
  else if (missing.length > 0) { status = 'partial'; reason = 'symbols_missing'; }
  else if (incomplete.length > 0) { status = 'partial'; reason = 'bars_incomplete'; }
  else if (stale) { status = 'partial'; reason = 'built_before_inputs_changed'; }   // BA-31: a kept unit not rebuilt
  else { status = 'partial'; reason = 'replay_incomplete'; }
  return {
    status, writtenAt: nowIso, attempts, reason, source: 'eodhd_1m', symbolsRequested: requested, symbolsMissing: missing, symbolsIncomplete: incomplete,
    // BA-25: what this output was built from; the close pass compares it with the merged tape's.
    ...(inputFingerprint ? { inputFingerprint } : {}),
  };
}

/** How complete a replay is: a gap first, then legs, then fewer missing inputs. */
const replayRank = (r) => (r ? (r.gapPoints !== null ? 1000 : 0) + ((r.ghost ? 1 : 0) + (r.bought ? 1 : 0)) * 100 - (r.missingInputs || []).length : -1);
/** How complete a plan's prices are: how many of the two points carry a (fresh) value. */
const priceRank = (p) => (p ? (typeof p.atPlan?.value === 'number' ? 1 : 0) + (typeof p.atClose?.value === 'number' ? 1 : 0) : -1);
/** The stored result unless the fresh one is at least as complete (review L2-F1). */
const keepBetter = (stored, fresh, rank) => (stored && rank(stored) > rank(fresh) ? stored : fresh);
const needsBars = (missingInputs) => (missingInputs || []).some((m) => m.startsWith('bars:'));
/** Several documents in one transaction read — getAll when the SDK has it (one round trip). */
const readAll = (tx, refs) => (!refs.length ? Promise.resolve([]) : (typeof tx.getAll === 'function' ? tx.getAll(...refs) : Promise.all(refs.map((r) => tx.get(r)))));
/** Does a kept replay or price lack an input a later fetch could still supply (bars, or a stale sample — BA-24)? */
const awaitsBars = (x) => (Array.isArray(x?.retryableInputs) ? x.retryableInputs.length > 0 : needsBars(x?.missingInputs));

/**
 * Will no candle pass ever select this tape again? Its own status says so
 * (BA-32): anything but a non-terminal status — expired, exhausted, written,
 * skipped — is never selected.
 */
export function candlesTerminal(c) {
  return !isObj(c) || !CANDLE_SELECTABLE_STATUSES.includes(c.status);
}

/**
 * THE CLOSE-OUT WRITER (spec §6; BA-23, BA-32): a tape that aged out of the
 * candle window while still waiting is marked `expired`,
 * `retry_window_elapsed`, so nothing reads as scheduled that is not — and it
 * leaves every candle query. The reference is built from the validated ids,
 * and the tape is re-read inside the transaction and marked only while it is
 * still waiting — a close pass that re-queued or finished it meanwhile is
 * never overwritten. Resolves to whether it marked.
 */
export async function markRetryWindowElapsed(db, { battleId, etDate }, nowIso) {
  const ref = tapeRef(db, battleId, etDate);
  let marked = false;
  await db.runTransaction(async (tx) => {
    marked = false;
    const snap = await tx.get(ref);
    if (!snap.exists || candlesTerminal(snap.data()?.passes?.candles)) return;
    tx.update(ref, { 'passes.candles.status': 'expired', 'passes.candles.reason': 'retry_window_elapsed', 'passes.candles.writtenAt': nowIso });
    marked = true;
  });
  return marked;
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

    // The saved series, read in the same transaction (BA-25). All reads come
    // before any write.
    const seriesRef = (sym) => ref.collection(SERIES_SUBCOLLECTION).doc(sym);
    const savedSnaps = await readAll(tx, curPlan.map((e) => seriesRef(e.symbol)));
    const saved = new Map();
    savedSnaps.forEach((sn, i) => { if (sn?.exists) saved.set(curPlan[i].symbol, typeof sn.data === 'function' ? sn.data() : sn.data); });

    // A retry never loses what an earlier attempt saved (§8 invariant 7,
    // BA-19, BA-25; reviews L2-F1, F3): per action and per plan the more
    // complete of the stored and the fresh result is kept, and per symbol the
    // better series — a saved one is never replaced by a poorer response.
    // BA-31: each fresh unit carries the identity of the inputs it was built
    // from; a kept one keeps its own, and is stale when that is no longer its
    // inputs' identity on the tape now.
    const replays = new Map();
    const stale = { replays: [], prices: [] };
    const actions = (Array.isArray(cur.actions) ? cur.actions : []).map((a) => {
      const builtFrom = replayBuiltFrom(cur, a, session);
      const built = replayAction({ action: a, checks: cur.checks, barsBySymbol, session, sectors: cur.comparables?.sectors || {}, tierStamp: resolveModeConfig(cur.gameMode).flatMultiplier });
      const kept = keepBetter(a.replay ?? null, built ? { ...built, builtFrom } : null, replayRank);
      replays.set(a.key, kept);
      if (kept && kept.builtFrom !== builtFrom) stale.replays.push(a);
      return { ...a, replay: kept };
    });
    const plans = (Array.isArray(cur.plans) ? cur.plans : []).map((p) => {
      const builtFrom = priceBuiltFrom(p);
      const kept = keepBetter(p.price ?? null, { ...planPrice(p, barsBySymbol[p.symbol] || null, session), builtFrom }, priceRank);
      if (kept && kept.builtFrom !== builtFrom) stale.prices.push(p);
      return { ...p, price: kept };
    });
    const prev = cur.passes?.candles;
    const retryable = [...replays.values()].some((r) => r && awaitsBars(r)) || plans.some((p) => p.price && awaitsBars(p.price));
    // Per symbol, the kept series (BA-25) and what it lacks against a whole
    // session and against the checks the tape has now (BA-24). A symbol with
    // no series at all — saved or new — is missing.
    const checksNow = seriesChecks(cur);
    const gapsBySymbol = {};
    const keptFrom = [];
    const missing = [];
    const writes = [];
    for (const entry of curPlan) {
      const bars = barsBySymbol[entry.symbol];
      const builtFrom = seriesBuiltFrom(cur, entry.symbol);
      const fresh = bars ? seriesDoc({ tape: cur, entry, bars, session, nowIso, builtFrom }) : null;
      const old = saved.get(entry.symbol) ?? null;
      const { doc, kept, why } = keepSeries(old, fresh);
      if (!doc) { missing.push(entry.symbol); continue; }
      let out = doc;
      if (kept) {
        // It holds a fact an earlier attempt saved (BA-34): say from when.
        const since = old.preservedFrom ?? old.writtenAt ?? null;
        keptFrom.push({ symbol: entry.symbol, why, since });
        if (doc !== old) { out = { ...doc, preservedFrom: since }; writes.push({ entry, doc: out }); }
        else if ((old.preservedFrom ?? null) !== since) { out = { ...old, preservedFrom: since }; writes.push({ entry, doc: out }); }
      } else {
        writes.push({ entry, doc: out });
      }
      const gaps = [...seriesGaps(out, session), ...uncoveredChecks(out, checksNow)];
      // BA-31: a kept series built from other inputs is stale — named once (a
      // missing check already says "built before …").
      if (out.builtFrom !== builtFrom && !gaps.some((g) => g.startsWith('built before'))) gaps.push('built before its inputs changed');
      if (gaps.length) gapsBySymbol[entry.symbol] = gaps;
    }
    const candles = nextCandleState({
      prev, requested, missing, incomplete: Object.keys(gapsBySymbol).sort(), retryable,
      stale: stale.replays.length > 0 || stale.prices.length > 0, inputFingerprint: candleInputFingerprint(cur), nowIso,
    });
    for (const { entry, doc } of writes) tx.set(seriesRef(entry.symbol), doc);
    tx.update(ref, sanitizeForFirestore({
      actions,
      plans,
      'passes.candles': candles,
      'coverage.replay': replayCoverage(cur, replays, session, stale.replays),
      'coverage.series': seriesCoverage(requested, missing, gapsBySymbol, session, keptFrom, stale.prices,
        plans.filter((p) => Array.isArray(p.price?.missingInputs) && p.price.missingInputs.length > 0)),
    }));
    const series = writes.length;
    result = { status: candles.status, attempts: candles.attempts, requested: requested.length, missing, series };
  });
  return result;
}

const docData = (d) => (typeof d?.data === 'function' ? d.data() : d?.data);
const idOfResult = (d) => {
  const id = tapeIdOf(d?.ref?.path);
  const tape = docData(d);
  return id && isObj(tape) && tape.battleId === id.battleId && tape.etDate === id.etDate ? { id, tape } : null;
};

/**
 * BA-29 — close out, in a bounded batch, the non-terminal tapes older than
 * `before` (the scan's lower edge). One query per NON-TERMINAL status (BA-32),
 * oldest first, paged with a cursor; every result's path validated (BA-23).
 * A close-out makes its tape terminal, which takes it out of every query, so
 * the next run resumes past it. BA-33: before every page AND every close-out
 * it checks its own bounds — close-outs, documents read, its 60 s share of the
 * run, and the run's time floor — and stops at the first one reached, saying
 * it is not `complete` and which bound stopped it (`stoppedBy`).
 */
async function sweepExpired({ db, before, nowIso, limits, summary, clock, startMs, budgetMs }) {
  const sweepStart = clock();
  const out = { reads: 0, expired: 0, complete: true, stoppedBy: null };
  const timeUp = () => (clock() - sweepStart >= limits.shareMs ? 'share' : (budgetMs - (clock() - startMs) < TIME_FLOOR_MS ? 'floor' : null));
  const closeOutBound = () => (out.expired >= limits.maxMarks ? 'marks' : timeUp());
  const pageBound = () => closeOutBound() ?? (out.reads >= limits.maxReads ? 'reads' : null);
  const stop = (why) => { out.complete = false; out.stoppedBy = why; return out; };
  for (const status of CANDLE_SELECTABLE_STATUSES) {
    let cursor = null;
    for (;;) {
      const bound = pageBound();
      if (bound) return stop(bound);
      let q = db.collectionGroup('tape').where('passes.candles.status', '==', status).where('etDate', '<', before);
      q = q.orderBy('etDate', 'asc');
      if (cursor) q = q.startAfter(cursor);
      const size = Math.min(limits.page, limits.maxReads - out.reads);
      const docs = (await q.limit(size).get())?.docs || [];
      out.reads += docs.length;
      for (const d of docs) {
        const ok = idOfResult(d);
        if (!ok) { summary.invalid.push(String(d?.ref?.path ?? '(no path)')); continue; }
        if (candlesTerminal(ok.tape.passes?.candles)) continue;
        const bound = closeOutBound();                                   // BA-33: the clock, before every close-out
        if (bound) return stop(bound);
        const path = `agentBattles/${ok.id.battleId}/${TAPE_SUBCOLLECTION}/${ok.id.etDate}`;
        try {
          if (await markRetryWindowElapsed(db, ok.id, nowIso)) { out.expired += 1; summary.expired.push(path); }
        } catch (err) {
          summary.failed.push({ path, error: `close-out: ${String(err?.message || err).slice(0, 160)}` });
          console.error(`[film-tape-candles] ${path} close-out failed: ${err?.message || err}`);
        }
      }
      if (docs.length < size) break;            // this status has nothing older left
      cursor = docs[docs.length - 1];
    }
  }
  return out;
}

/**
 * The morning run.
 *
 * @param {object} p
 * @param {object} p.db
 * @param {(symbol: string, opts: object) => Promise<Array>} p.fetchCandles
 * @param {() => number} p.clock
 */
export async function runCandlePass({ db, fetchCandles, clock = Date.now, startMs = clock(), budgetMs = 300_000, sweep = {} }) {
  // The writer flag at CALL time, here too — not only in the handler — so no
  // caller can write a tape while the writer is dark (review L3-F4).
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const nowMs = clock();
  const runEtDate = etDateOf(nowMs);
  if (!sessionFor(runEtDate)) {
    // Outside the maintained market calendar the window cannot be counted:
    // fail loudly, never build a query on a null date (review L3-F7).
    console.error(`[film-tape-candles] calendar_missing: the market calendar has no entry for ${runEtDate} — no candle pass until it is maintained`);
    return { runEtDate, skipped: true, reason: 'calendar_missing', selected: 0, written: [], partial: [], failed: [], requeued: [], expired: [], closeOutsDeferred: [], notReached: [], invalid: [], sweep: null, units: 0, requests: 0, fetchErrors: [] };
  }
  const windowStart = candleWindowStart(runEtDate);
  const scanStart = sessionsBack(runEtDate, 10 + EXPIRY_SCAN_MARGIN_SESSIONS) ?? windowStart;
  const summary = { runEtDate, windowStart, selected: 0, written: [], partial: [], failed: [], requeued: [], expired: [], closeOutsDeferred: [], notReached: [], invalid: [], sweep: null, units: 0, requests: 0, fetchErrors: [] };
  // BA-33: every close-out this run makes — the sweep's, and the selection's
  // for a tape that aged out inside the scan — shares one clock: together at
  // most `shareMs` of the run and `maxMarks` close-outs, and never past the
  // floor. A close-out a bound defers waits, still waiting, for a later run
  // (review R1-4).
  const limits = { ...EXPIRY_SWEEP, ...sweep };
  const closeOuts = { ms: 0, marks: 0 };
  // BA-29: the bounded sweep behind the scan, FIRST — so no morning's work can starve it.
  if (scanStart) {
    const began = clock();
    summary.sweep = await sweepExpired({ db, before: scanStart, nowIso: iso(nowMs), limits, summary, clock, startMs, budgetMs });
    closeOuts.ms += clock() - began;
    closeOuts.marks += summary.sweep.expired;
  }
  const snap = await db.collectionGroup('tape')
    .where('passes.candles.status', 'in', [...CANDLE_SELECTABLE_STATUSES])
    .where('etDate', '>=', scanStart)
    .orderBy('etDate', 'asc')
    .get();
  // BA-23: validate every result's path BEFORE anything else touches it, and
  // build its reference from the validated ids — the query's own reference is
  // never written to.
  const found = [];
  for (const d of snap?.docs || []) {
    const ok = idOfResult(d);
    if (!ok) { summary.invalid.push(String(d?.ref?.path ?? '(no path)')); continue; }
    const { id, tape } = ok;
    if (!isObj(tape.passes?.candles)) continue;
    found.push({ id, path: `agentBattles/${id.battleId}/${TAPE_SUBCOLLECTION}/${id.etDate}`, ref: tapeRef(db, id.battleId, id.etDate), tape });
  }
  found.sort((a, b) => (a.id.etDate < b.id.etDate ? -1 : a.id.etDate > b.id.etDate ? 1 : (a.path < b.path ? -1 : 1)));
  if (summary.invalid.length) {
    console.error(`[film-tape-candles] skipped ${summary.invalid.length} tape reference(s) outside agentBattles/{battleId}/tape/{etDate}: ${summary.invalid.slice(0, 20).join(', ')}`);
  }

  const usage = { requests: 0, errors: [] };
  const memo = new Map();
  for (const [i, { id, path, ref, tape }] of found.entries()) {
    if (candlesTerminal(tape.passes.candles)) continue;                 // terminal — its own status says so
    if (!windowStart || id.etDate < windowStart) {
      // Aged out while still waiting: close it out, so no reader sees a retry
      // that is not scheduled — within the close-outs' shared bounds (BA-33).
      // Isolated: one failed marker never costs the morning (review L2-F6) —
      // the tape is simply seen again tomorrow.
      const bound = closeOuts.marks >= limits.maxMarks ? 'marks'
        : closeOuts.ms >= limits.shareMs ? 'share'
          : budgetMs - (clock() - startMs) < TIME_FLOOR_MS ? 'floor' : null;
      if (bound) { summary.closeOutsDeferred.push({ path, bound }); continue; }
      const began = clock();
      try {
        if (await markRetryWindowElapsed(db, id, iso(nowMs))) { summary.expired.push(path); closeOuts.marks += 1; }
      } catch (err) {
        summary.failed.push({ path, error: `close-out: ${String(err?.message || err).slice(0, 160)}` });
        console.error(`[film-tape-candles] ${path} close-out failed: ${err?.message || err}`);
      }
      closeOuts.ms += clock() - began;
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
          const spent = next >= CANDLE_MAX_ATTEMPTS;                       // BA-32: the third attempt is terminal
          tx.update(ref, {
            'passes.candles.attempts': next,
            'passes.candles.status': spent ? 'exhausted' : 'failed',
            'passes.candles.reason': spent ? 'attempts_exhausted' : `error: ${reason}`,
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
