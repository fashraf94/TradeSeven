// api/_utils/practiceField/dailyCoverage.js
//
// Practice Field T1a-2b-3 — THE DAY'S CORPORATE-ACTION DATA, ONE RULE FOR EVERY PATH (Amendment F-1, F-2, F-6). A held
// stock's share count is only as good as the corporate-action data behind it. The daily layer
// (`mandateUniverseDaily/{session}`, built by the engine's slow layer before every snapshot) is the ONE record of
// whether the day's action fetch for a symbol succeeded, and it lists the day's action rows (its fetch window reaches
// MANDATE_CA_FETCH_LOOKBACK_DAYS calendar days back, `caWindow`). Admission, the sales and the close read it the same
// way, through this module:
//
//   F-6  ONE RULE FOR A DAILY ENTRY. A daily document counts as MISSING unless it is a plain object whose own `date` is
//        its key (the session). An entry COVERS its symbol only when it is a plain object (never an array, a string, a
//        number, a boolean or null) and its `caFetchFailed` is absent or exactly `false` — any other value (`true`,
//        `'true'`, `1`, `0`, `''`, `null`, an array…) is not covered. Read as an OWN property, never through a prototype.
//
//   F-2  ROWS COME FROM THE DAILY DOCUMENT. A symbol's action rows are the UNION of the session's daily document, read
//        in the same transaction, and the price snapshot's own copy: nothing is dropped (two rows of one id with two
//        payloads stay two rows — the ledger's conflict rule then applies neither). Duplicates are told apart by content
//        only. And a price snapshot is used only when its `dailyRef` names that session's daily document: admission
//        refuses, a sale waits, and the close carries the mark otherwise.
//
//   F-1  A DAY WITH NO DATA IS A DAY OF DOUBT. Each idea keeps, per held symbol, the last session its corporate-action
//        data covered (`caCoveredThrough`). A session covers a symbol when the data presented to its close is continuous
//        from the day after `caCoveredThrough` through the session: the session's own daily entry (valid by F-6, its
//        window reaching back to that day), joined if need be by a successful BACKFILL — the symbol's actions fetched
//        later, stored where only the idea book reads them (`practiceFieldCaBackfill/{SYM}_{from}`, caBackfill.js).
//        Otherwise the symbol's share basis is in doubt (`caCoverageGaps`), as the T1a-2a class rule holds any doubt.
//
// Pure. The collection names appear as literals where they are read (admissionMarks.js, exits.js, close.js), for the
// protected-store scan.

import { MANDATE_CA_FETCH_LOOKBACK_DAYS } from '../mandateConfig.js';

/** The daily layer's collection — named here for the comparisons below; every READ names it by its literal. */
export const DAILY_COLLECTION_NAME = 'mandateUniverseDaily';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const DAY_MS = 86_400_000;
/** YYYY-MM-DD ± calendar days (UTC-safe on the date string). */
export function shiftCalendarDate(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Why a held symbol is not covered by a session's daily layer (F-6), in admission's refusal words. */
export const DAILY_COVERAGE_REFUSAL = Object.freeze({
  DAILY_MISSING: 'ca_daily_missing', COVERAGE_MISSING: 'ca_coverage_missing', FETCH_FAILED: 'ca_fetch_failed',
});

/**
 * F-6: the daily document as stored (`data`), as THE daily layer of `session` — or null when it counts as missing: it is
 * not a plain object, or its own `date` is not its key.
 */
export function dailyDocOf(data, session) {
  if (!isPlainObject(data) || !isDate(session) || data.date !== session) return null;
  return data;
}

/** F-6: one entry of a daily layer's `symbols` (an own property only). Undefined when there is none. */
function ownEntry(daily, symbol) {
  const symbols = daily?.symbols;
  return isPlainObject(symbols) && Object.hasOwn(symbols, symbol) ? symbols[symbol] : undefined;
}

/**
 * F-6: does a daily layer cover `symbol`? `daily` is dailyDocOf's answer (null: missing).
 * @returns {{ covered: boolean, fetchSucceeded: boolean|null, refusal: string|null }}
 */
export function dailyCoverageOf(daily, symbol) {
  if (daily === null || daily === undefined) return { covered: false, fetchSucceeded: null, refusal: DAILY_COVERAGE_REFUSAL.DAILY_MISSING };
  const entry = ownEntry(daily, symbol);
  if (!isPlainObject(entry)) return { covered: false, fetchSucceeded: null, refusal: DAILY_COVERAGE_REFUSAL.COVERAGE_MISSING };
  const flag = Object.hasOwn(entry, 'caFetchFailed') ? entry.caFetchFailed : undefined;
  if (flag !== undefined && flag !== false) return { covered: true, fetchSucceeded: false, refusal: DAILY_COVERAGE_REFUSAL.FETCH_FAILED };
  return { covered: true, fetchSucceeded: true, refusal: null };
}

/** F-2: does a price snapshot name the daily layer of `session` (`dailyRef`)? */
export function snapshotNamesDaily(snapshot, session) {
  return isDate(session) && snapshot?.dailyRef === `${DAILY_COLLECTION_NAME}/${session}`;
}

/**
 * The first calendar day a valid daily layer's action rows reach back to: its own `caWindow.from` when that is a real
 * date no later than the session, never earlier than the engine's lookback (the narrower of the two — a window the
 * document claims beyond what the builder fetches is not taken on trust).
 */
export function dailyWindowFrom(daily, session) {
  const byConfig = shiftCalendarDate(session, -MANDATE_CA_FETCH_LOOKBACK_DAYS);
  const own = daily?.caWindow?.from;
  return isDate(own) && own <= session && own > byConfig ? own : byConfig;
}

const actionKeyOf = (a) => JSON.stringify(Object.keys(a || {}).sort().map((k) => [k, a[k]]));
const upper = (s) => String(s || '').trim().toUpperCase();

/**
 * F-2: one symbol → its action rows, the union of every source given (`[{ SYM: [rows] }, …]`), by content: a row two
 * sources carry identically is one row; two rows that differ are both kept. Keys are upper-cased.
 */
export function unionActionsBySymbol(...sources) {
  const out = {};
  const seen = {};
  for (const src of sources) {
    for (const [rawSym, rows] of Object.entries(src || {})) {
      if (!Array.isArray(rows)) continue;
      const sym = upper(rawSym);
      for (const a of rows) {
        if (!isPlainObject(a)) continue;
        const k = actionKeyOf(a);
        seen[sym] = seen[sym] || new Set();
        if (seen[sym].has(k)) continue;
        seen[sym].add(k);
        (out[sym] = out[sym] || []).push(a);
      }
    }
  }
  return out;
}

/**
 * F-2: a valid daily layer's action rows by symbol. NO ROW IS DROPPED: an entry whose fetch failed in part still lists
 * the rows its other leg returned (the builder keeps them), and they are rows — the coverage rule (F-1) separately says
 * the session is not covered, so whatever depends on the count waits, recorded.
 */
export function dailyActionsBySymbol(daily) {
  const out = {};
  if (!daily || !isPlainObject(daily.symbols)) return out;
  for (const sym of Object.keys(daily.symbols)) {
    const entry = daily.symbols[sym];
    if (!isPlainObject(entry)) continue;
    const rows = entry.corporateActions;
    if (Array.isArray(rows) && rows.length > 0) out[sym] = rows;
  }
  return out;
}

// ── F-1: coverage continuity ──────────────────────────────────────────────────────────────────────────────────────

/** The type, and the id prefix, of a coverage gap's item in the idea's hold set and in a held action's `heldBecause`. */
export const CA_COVERAGE_GAP = 'ca_coverage_gap';
export const coverageGapIdOf = (symbol, coveredThrough) => `${CA_COVERAGE_GAP}_${upper(symbol)}_${coveredThrough}`;

/**
 * The key of a symbol's backfill document: the symbol. ONE document per symbol holds the latest successful range
 * (`from` … `to`), so a catch-up that moves `caCoveredThrough` forward session by session keeps reading the same one,
 * and two ideas waiting from different days (SPY is in every idea) share the widest fetch (caBackfill.js).
 */
export const backfillIdOf = (symbol) => upper(symbol);

/**
 * A backfill document as stored, if it is a SUCCESSFUL fetch of `symbol` (both legs answered) that reaches back to
 * `from` or earlier: its range and its rows. Null otherwise (absent, failed, another symbol's, or starting later).
 */
export function successfulBackfill(data, symbol, from) {
  if (!isPlainObject(data) || data.symbol !== upper(symbol) || data.failed !== false || !isDate(data.from) || !isDate(data.to) || !Array.isArray(data.actions)) return null;
  if (isDate(from) && data.from > from) return null;
  return { from: data.from, to: data.to, actions: data.actions.filter((a) => isPlainObject(a) && upper(a.ticker) === upper(symbol)) };
}

/**
 * The last session a symbol's corporate-action data covered, for one idea: its own record, or — for a symbol it has no
 * record of yet (the first close after the entry, or after a ticker change moved the holding to it) — the session it
 * was opened on: nothing dated on or before it is owed to the holding (an action is due to a holding opened BEFORE its
 * effective date — the engine's entitlement), so nothing before it can be missed. Null when neither can be told.
 */
export function coveredThroughOf(idea, symbol) {
  const sym = upper(symbol);
  const own = idea?.caCoveredThrough?.[sym];
  if (isDate(own)) return own;
  let opened = null;
  for (const f of ['ledger', 'comparisonLedger', 'spyLedger']) {
    const h = idea?.[f]?.holdings?.[sym];
    if (isDate(h?.openedAt) && (opened === null || h.openedAt < opened)) opened = h.openedAt;
  }
  return opened ?? (isDate(idea?.entry?.sessionDate) ? idea.entry.sessionDate : null);
}

/**
 * F-1: does the data presented to the close of `session` cover `symbol` from the day after `coveredThrough`? The
 * session's snapshot must name its daily layer (`dailyRefOk`, F-2), and the rows known must reach back, without a hole,
 * to the day after `coveredThrough`: the session's own valid entry (from its window's first day), joined by a
 * successful backfill whose range reaches the day before that window (or covers the session itself).
 *
 * @returns {{ covered: boolean, reason: string|null, from: string|null, readBackfill: boolean, needsBackfill: boolean, viaBackfill: boolean }}
 *   `reason`: null, or 'snapshot_daily_mismatch' | DAILY_COVERAGE_REFUSAL.* | 'gap_beyond_window'
 *   `readBackfill`: the session's own layer does not cover the symbol, so a stored backfill could (the close reads one)
 *   `needsBackfill`: the gap is longer than any daily window reaches: only a backfill (or the founder) can clear it
 */
export function sessionCoverage({ symbol, session, coveredThrough, daily, dailyRefOk, backfill = null }) {
  const none = { readBackfill: false, needsBackfill: false, viaBackfill: false };
  if (!isDate(coveredThrough)) return { covered: false, reason: 'covered_through_unknown', from: null, ...none };
  const from = shiftCalendarDate(coveredThrough, 1);
  if (coveredThrough >= session) return { covered: true, reason: null, from, ...none };
  if (!dailyRefOk) return { covered: false, reason: 'snapshot_daily_mismatch', from, ...none };
  const usable = backfill !== null && isDate(backfill.from) && backfill.from <= from;
  const beyondAnyWindow = from < shiftCalendarDate(session, -MANDATE_CA_FETCH_LOOKBACK_DAYS);
  const entry = dailyCoverageOf(daily, symbol);
  if (entry.refusal !== null) {
    // The session's own layer does not cover the symbol: only a backfill that covers the session itself does.
    const viaBackfill = usable && backfill.to >= session;
    return { covered: viaBackfill, reason: viaBackfill ? null : entry.refusal, from, readBackfill: true, needsBackfill: !viaBackfill && beyondAnyWindow, viaBackfill };
  }
  const windowFrom = dailyWindowFrom(daily, session);
  if (windowFrom <= from) return { covered: true, reason: null, from, ...none };
  const viaBackfill = usable && backfill.to >= shiftCalendarDate(windowFrom, -1);
  return { covered: viaBackfill, reason: viaBackfill ? null : 'gap_beyond_window', from, readBackfill: true, needsBackfill: !viaBackfill, viaBackfill };
}

/** Every symbol an idea holds, on any of its three ledgers, upper-cased and sorted. */
export function heldSymbolsOf(idea) {
  const out = new Set();
  for (const f of ['ledger', 'comparisonLedger', 'spyLedger']) for (const sym of Object.keys(idea?.[f]?.holdings || {})) out.add(upper(sym));
  return [...out].sort();
}

/** The idea's open coverage gap for a symbol (`caCoverageGaps[SYM]`), or null. */
export function openCoverageGap(idea, symbol) {
  const g = idea?.caCoverageGaps?.[upper(symbol)];
  return isPlainObject(g) ? g : null;
}
