// api/_utils/evalMarketData.js
//
// Evaluator capacity, Build 1 — THE EVALUATOR'S MARKET-DATA CUTS (Part 3),
// dark behind EVAL_MARKET_DATA_CUTS_ENABLED (false at merge: nothing here
// runs). Build report docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md §Part 3;
// discovery docs/audits/20261115_PHASE0_EVAL_FANOUT.md §B4 and §9.
//
// (a) DAILY BARS ONCE PER ET SESSION. The evaluator's price fan-out fetched
//     `/eod/` (90 calendar days of daily bars) AND `/real-time/` for every
//     symbol on every check, with forceRefresh — about 41 of an agent-mode
//     check's 117 billed units. The only reader of those bars in the check is
//     Guard 2 (`resolveBadgeBaseline` → `selectPriorSessionBar`,
//     baselineValidation.js), which takes the NEWEST BAR DATED BEFORE TODAY
//     (ET for stocks, UTC for crypto) and nothing else. Within a session that
//     bar does not move, so one series per symbol per session serves every
//     check — PROVIDED the series already holds that bar. So a series is
//     stored and reused only when its prior-session bar IS the expected one
//     (the previous NYSE session for a stock, the previous UTC day for a
//     crypto pair); anything else is fetched per check exactly as before.
//     The other reader of the bars is the real-time fallback
//     (marketDataCache.js `fetchRealTimePrice`: on a FAILED quote request it
//     prices the symbol at `daily[0].close`, the newest row, with no date
//     filter). Whether `/eod/` carries a same-day row during the session is
//     not known (field inventory S2), so that path never reads the stored
//     series: it fetches `/eod/` fresh, as it always did
//     (`loadFallbackDaily`).
//
//     WHERE: `evalSessionDaily/{eodSymbol}_{etDate}` in Firestore, so a cold
//     instance reuses what a warm one fetched, plus a process memo that also
//     makes the first fetch of a symbol single-flight. Not the shared
//     `marketDataCache/{SYM}_daily` document: other paths write that one, its
//     window can be narrower (the pre-D-120 30-day payload) and it carries no
//     session stamp. A NARROW series, for this module, is one whose
//     `windowDays` stamp is not DAILY_WINDOW_CALENDAR_DAYS or that holds fewer
//     than SESSION_DAILY_MIN_ROWS rows; it is never stored and never used.
//     Reads and writes are bounded (1.5 s); a read that fails, times out or
//     finds an invalid document falls back to the fetch as it was.
//
// (b) MACRO QUOTES ONCE PER RUN. SPY, QQQ and BTC-USD.CC were fetched by every
//     battle. With the flag on the handler fetches them once per run, before
//     the first dispatch (bounded, 10 s), and each battle takes a COPY of the
//     run's quote, recorded with the run fetch's own instant — unless the
//     battle holds, benches or scores that symbol itself (its own universe:
//     held ∪ bench ∪ hot bench ∪ the CPU book), in which case the battle's
//     own fetch serves both roles as before, so a run-start quote never
//     reaches its scoring or its risk manager. A symbol the run could not
//     price is fetched by each battle as before.

import { getStockAnalysisData, getCleanSymbol, isCryptoSymbol, formatEODHDSymbol, DAILY_WINDOW_CALENDAR_DAYS } from './marketDataCache.js';
import { getETDate, formatDateString, getPreviousSessionDate } from './marketSchedule.js';
import { selectPriorSessionBar } from './baselineValidation.js';
import { withTimeout } from './intraday/evaluatorHook.js';
import { isSettlementQuoteUsable } from './agentQuoteHealth.js';

/** The macro benchmark symbols — the evaluator's own list (agent-evaluate.js `macroSymbols`). */
export const SHARED_MACRO_SYMBOLS = Object.freeze(['SPY', 'QQQ', 'BTC-USD.CC']);

/** The session series' collection (Admin SDK only; no client rule grants it). */
export const SESSION_DAILY_COLLECTION = 'evalSessionDaily';

/**
 * Below this many rows a series is NARROW and never stored or used. 90
 * calendar days give at least 55 NYSE sessions in any season
 * (marketDataCache.js, DAILY_WINDOW_CALENDAR_DAYS), so a full series always
 * clears it; the previous deploy's 30-day payload (~21 rows) never does.
 */
export const SESSION_DAILY_MIN_ROWS = 55;

/** The bound on one session-series read and on one write. */
export const SESSION_DAILY_IO_TIMEOUT_MS = 1_500;

/** The bound on the run's shared macro fetch, per symbol. */
export const RUN_SHARE_TIMEOUT_MS = 10_000;

/**
 * The bound on a check that WAITS for another check's first fetch of the same
 * symbol (review GC-1). The first fetch is a store read (≤ 1.5 s), one `/eod/`
 * (unbounded with the guard off; ≤ 10 s with it on) and a write (≤ 1.5 s); a
 * waiter gives up after 15 s, drops the pending entry so the next check starts
 * afresh, and makes the daily+price call itself — the fetch as it was.
 */
export const SESSION_DAILY_WAIT_TIMEOUT_MS = 15_000;

/** The instrument EODHD prices for a symbol ('BTC' and 'BTC-USD.CC' are one). */
export function eodSymbolOf(symbol) {
  return formatEODHDSymbol(getCleanSymbol(String(symbol)), isCryptoSymbol(String(symbol)));
}

let horizonLogged = false;
/** Tests only. */
export function resetHorizonLog() { horizonLogged = false; }

// ── session keys ────────────────────────────────────────────────────────────

/** The session a series belongs to and the cutoff Guard 2 applies to it. */
export function sessionKeyFor(symbol, now = new Date()) {
  const isCrypto = isCryptoSymbol(symbol);
  const eodSymbol = formatEODHDSymbol(getCleanSymbol(symbol), isCrypto);
  const etDate = formatDateString(getETDate(now));
  const utcDate = now.toISOString().slice(0, 10);
  const cutoffDate = isCrypto ? utcDate : etDate;
  return { eodSymbol, isCrypto, etDate, cutoffDate, docId: `${eodSymbol}_${etDate}` };
}

/** The date of the bar Guard 2 must find: the previous NYSE session, or the previous UTC day. Null = unknown. */
export function expectedPriorBarDate({ isCrypto, cutoffDate }) {
  if (isCrypto) {
    const ms = Date.parse(`${cutoffDate}T12:00:00Z`);
    return Number.isFinite(ms) ? new Date(ms - 86_400_000).toISOString().slice(0, 10) : null;
  }
  return getPreviousSessionDate(cutoffDate);
}

/**
 * A series this module may store and reuse for the session: wide, and holding
 * the prior-session bar Guard 2 will select. Pure.
 */
export function isReusableSessionSeries(rows, key) {
  if (!Array.isArray(rows) || rows.length < SESSION_DAILY_MIN_ROWS) return false;
  const expected = expectedPriorBarDate(key);
  if (!expected) {
    // Past the calendar's maintained horizon (src/utils/marketCalendar.js
    // MAINTAINED_HOLIDAY_YEARS) no stock series is reusable: the cut stops
    // saving and every check fetches as before. Said once per process (GC-7).
    if (!horizonLogged) {
      horizonLogged = true;
      console.warn(`[evalMarketData] no previous session known for ${key.cutoffDate} (calendar horizon): daily bars are fetched every check, as before the cut`);
    }
    return false;
  }
  return selectPriorSessionBar(rows, key.cutoffDate)?.date === expected;
}

/** A stored document is used only if every stamp matches this session and the series is reusable. Pure. */
export function readableSessionDoc(doc, key) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.eodSymbol !== key.eodSymbol || doc.etDate !== key.etDate || doc.cutoffDate !== key.cutoffDate) return null;
  if (doc.windowDays !== DAILY_WINDOW_CALENDAR_DAYS) return null;
  if (!isReusableSessionSeries(doc.rows, key)) return null;
  return doc.rows;
}

// ── the session series ──────────────────────────────────────────────────────

// Process memo: `${docId}|${cutoffDate}` → Promise<rows|null> (rows only when
// reusable). Entries of another ET date are dropped when a new date appears.
const memo = new Map();
let memoEtDate = null;

/** Tests only. */
export function resetSessionDailyMemo() { memo.clear(); memoEtDate = null; }

async function readStoredSeries(db, key) {
  try {
    // The collection is a LITERAL at both Firestore calls (= SESSION_DAILY_COLLECTION): the
    // protected-store write scan (compositionProtectedStores.scan.test.js) resolves literals only.
    const snap = await withTimeout(db.collection('evalSessionDaily').doc(key.docId).get(), SESSION_DAILY_IO_TIMEOUT_MS, 'session_daily_read');
    const doc = snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    return readableSessionDoc(doc, key);
  } catch (err) {
    console.warn(`[evalMarketData] session series read failed for ${key.docId} (falls back to the per-check fetch): ${err?.message || err}`);
    return null;
  }
}

async function writeStoredSeries(db, key, rows) {
  const doc = {
    eodSymbol: key.eodSymbol,
    etDate: key.etDate,
    cutoffDate: key.cutoffDate,
    priorBarDate: selectPriorSessionBar(rows, key.cutoffDate)?.date ?? null,
    windowDays: DAILY_WINDOW_CALENDAR_DAYS,
    rowCount: rows.length,
    rows,
    fetchedAt: new Date().toISOString(),
    // For a TTL policy if one is ever configured (none is; this build changes
    // no project setting). Three days past the session.
    expiresAt: new Date(Date.parse(`${key.etDate}T12:00:00Z`) + 3 * 86_400_000),
  };
  try {
    await withTimeout(db.collection('evalSessionDaily').doc(key.docId).set(doc), SESSION_DAILY_IO_TIMEOUT_MS, 'session_daily_write');
  } catch (err) {
    console.warn(`[evalMarketData] session series write failed for ${key.docId} (the next check fetches again): ${err?.message || err}`);
  }
}

/** Today's `/eod/` fetch for one symbol, through the one daily path (it also refreshes `{SYM}_daily`, as the fan-out always did). */
async function fetchDailyNow(symbol) {
  const result = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] });
  return Array.isArray(result?.daily) ? result.daily : undefined;
}

/**
 * The daily bars for `symbol` this session.
 * Returns `{ rows, fetchedHere }`:
 *  - `rows` reusable from the memo or the store → `fetchedHere: false`;
 *  - this call fetched `/eod/` itself (the first caller; stored when reusable)
 *    → its rows, possibly undefined on a failed fetch, `fetchedHere: true`;
 *  - another caller's fetch was not reusable or failed → `{ rows: undefined,
 *    fetchedHere: false }`: the caller fetches as before.
 */
export async function sessionDailySeries(db, symbol, now = new Date()) {
  const key = sessionKeyFor(symbol, now);
  if (memoEtDate !== key.etDate) { memo.clear(); memoEtDate = key.etDate; }
  const memoKey = `${key.docId}|${key.cutoffDate}`;
  const inMemo = memo.get(memoKey);
  if (inMemo) {
    // Bounded (GC-1): a first fetch that hangs must not hang every later check
    // of the symbol. On the bound the pending entry is dropped (if it is still
    // the one waited on) and this check fetches for itself.
    try {
      const rows = await withTimeout(inMemo, SESSION_DAILY_WAIT_TIMEOUT_MS, 'session_daily_wait');
      return { rows: rows ?? undefined, fetchedHere: false };
    } catch (err) {
      if (memo.get(memoKey) === inMemo) memo.delete(memoKey);
      console.warn(`[evalMarketData] waited ${SESSION_DAILY_WAIT_TIMEOUT_MS} ms for ${key.docId}'s first fetch (this check fetches its own): ${err?.message || err}`);
      return { rows: undefined, fetchedHere: false };
    }
  }
  let fresh;
  const lookup = (async () => {
    const stored = await readStoredSeries(db, key);
    if (stored) return stored;
    fresh = await fetchDailyNow(symbol);
    if (!isReusableSessionSeries(fresh, key)) return null;
    await writeStoredSeries(db, key, fresh);
    return fresh;
  })();
  memo.set(memoKey, lookup);
  let rows;
  try {
    rows = await lookup;
  } catch {
    rows = null;
  }
  if (!rows) memo.delete(memoKey);
  if (rows && fresh === undefined) return { rows, fetchedHere: false }; // served by the store
  return { rows: fresh, fetchedHere: true };
}

/**
 * THE CUT FETCH (flag on) — what the fan-out's
 * `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] })`
 * returned, with the daily bars from the session series. The quote is always
 * fetched fresh. Its failure path reads fresh bars, never the stored series.
 * When no session series is to be had, it IS that call.
 */
export async function fetchEvalSymbolData(db, symbol, now = new Date()) {
  let session;
  try {
    session = await sessionDailySeries(db, symbol, now);
  } catch {
    session = { rows: undefined, fetchedHere: false };
  }
  if (!session.fetchedHere && !session.rows) {
    return getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
  }
  const rows = session.rows;
  const loadFallbackDaily = session.fetchedHere ? async () => rows : () => fetchDailyNow(symbol);
  const result = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['price'], loadFallbackDaily });
  if (result && result.daily === undefined && rows !== undefined) result.daily = rows;
  return result;
}

// ── the run's shared macro quotes ───────────────────────────────────────────

// One per run, keyed on the run's `summary` object (the setupMenuLabels/reads.js
// precedent): nothing is added to `summary` itself, which the response spreads.
const RUN_SHARES = new WeakMap();

/**
 * Fetch the macro symbols once for the run (flag on; the handler calls it once,
 * before the first dispatch). Each symbol is bounded on its own; a failed or
 * slow one is simply absent. Never throws.
 */
export async function prepareRunMarketShare(db, runKey, now = new Date()) {
  const quotes = {};
  try {
    await Promise.all(SHARED_MACRO_SYMBOLS.map(async (symbol) => {
      try {
        const data = await withTimeout(fetchEvalSymbolData(db, symbol, now), RUN_SHARE_TIMEOUT_MS, 'macro_share');
        // Only a USABLE quote is shared (GC-2): a `fallback: true` daily close
        // or an unpriced result stays out, and each battle fetches its own.
        if (isSettlementQuoteUsable(data?.price)) quotes[symbol] = { data, fetchedAtMs: Date.now() };
      } catch (err) {
        console.warn(`[evalMarketData] shared ${symbol} quote not fetched (each battle fetches its own): ${err?.message || err}`);
      }
    }));
  } catch { /* each symbol already caught its own */ }
  if (runKey && typeof runKey === 'object') RUN_SHARES.set(runKey, { quotes });
  return quotes;
}

/**
 * The run's quote for `symbol`, as THIS battle's own copy — or null when the
 * symbol is not a macro, the battle holds, benches or scores THE SAME
 * INSTRUMENT (`ownSymbols`, compared by the symbol EODHD prices: a held 'BTC'
 * owns 'BTC-USD.CC' — GC-3), or the run has no price for it. The copy is deep:
 * nothing one battle does to its quote can reach another's.
 */
export function sharedMacroQuote(runKey, symbol, ownSymbols) {
  if (!SHARED_MACRO_SYMBOLS.includes(symbol)) return null;
  if (ownSymbols && typeof ownSymbols[Symbol.iterator] === 'function') {
    const instrument = eodSymbolOf(symbol);
    for (const own of ownSymbols) if (eodSymbolOf(own) === instrument) return null;
  }
  const entry = runKey && typeof runKey === 'object' ? RUN_SHARES.get(runKey)?.quotes?.[symbol] : null;
  if (!entry?.data?.price) return null;
  return { data: structuredClone(entry.data), fetchedAtMs: entry.fetchedAtMs };
}
