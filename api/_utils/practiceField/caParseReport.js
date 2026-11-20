// api/_utils/practiceField/caParseReport.js
//
// Practice Field T1a-2b-4 — PARSE COVERAGE (Astra T2D-12). The daily builder's corporate-action fetch
// (mandateUniverseSnapshot.js fetchCorporateActionsEODHD, called, never edited) runs the vendor's answer through the
// engine's parsers (mandateCorporateActions.js) and keeps only the rows that parse. A row the parser REJECTS (a split
// written `5:4`, a dividend with no amount) is logged and dropped, and an answer whose ENVELOPE is not a list (an error
// object, `null`) reads as no rows at all: either way the day's entry says the fetch succeeded with nothing listed, so a
// missed split looked like no split, and the close valued the holding at full quality on the unadjusted count.
//
// THE PARSE REPORT. For the symbols an idea book's coverage requires, a wrapper around the base fetcher records what the
// vendor's answer held, per symbol, in its own server-only collection:
//
//   practiceFieldCaParseReports/{session}   { schemaVersion, session, symbols: { SYM: entry } }
//     entry = { rowsReceived, rowsAccepted, rowsNoOp, rowsRejected, rejects: [{ leg, reason, row }], malformedEnvelope,
//               legs: { splits: leg, dividends: leg }, at }
//     leg   = { answered, status, envelope: 'list' | 'not_a_list' | null, received, accepted, noOp, rejected }
//
// `rowsNoOp` counts the 1:1 split rows the parser drops silently (neither accepted nor rejected). NEVER the request URL:
// it carries the vendor key.
//
// THE WRAPPER'S LIMITS (the build prompt, §5): it calls the base fetcher, observing each HTTP response ONCE through the
// base's own `fetchImpl` seam — the body the base parses is the body it records, read once; it runs the exported parsers
// on that same body to count the rejections; it RETURNS EXACTLY WHAT THE BASE RETURNS (the same object), for every
// symbol; it makes NO SECOND UPSTREAM CALL; and it writes a report only for the symbols it was told an idea book's
// coverage requires. Any other symbol goes to the base untouched, with no seam at all. It never throws into the build: a
// report it cannot write is simply missing, and a missing report counts as uncovered (the founder's fail-closed lean).
//
// It is handed to the daily build only when such a symbol is in the build (sweep.js practiceFieldBuildInputs), so at
// 'off' — and at 'on' with no idea book — the daily build is exactly the engine's own, and the shared daily document is
// never written by it: the report lives in its own collection.
//
// THE COVERAGE CONDITION (Amendment F-6, one more condition; dailyCoverage.js): for a held symbol, the session's parse
// report must exist and show no rejection and no malformed envelope, on both legs. The rows that parsed are still kept
// and recorded (F-2): they reach the close, and wait there behind the doubt, as a failed leg's rows do.
//
// The idea book's own backfill (caBackfill.js) records the same report for what it fetches, on the backfill document
// itself (`parseReport`), and a backfill whose report is not clean covers nothing.

import { parseVendorSplits, parseVendorDividends } from './ledger.js';
import { fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { MANDATE_CA_FETCH_LOOKBACK_DAYS, MANDATE_CA_FETCH_LOOKAHEAD_DAYS } from '../mandateConfig.js';
import { shiftCalendarDate, PARSE_LEGS, parseEntryVerdict, parseReportEntry, actionsHashOf } from './dailyCoverage.js';
import { stableStringify } from '../canonicalHash.js';

export { PARSE_LEGS, parseEntryVerdict, parseReportEntry, actionsHashOf };
/** A report write that has not settled in this long is given up (the symbol reads uncovered — review AR4-B-6). */
export const PARSE_REPORT_WRITE_TIMEOUT_MS = 10_000;

const LOG_PREFIX = '[PracticeFieldParseReport]';
export const PARSE_REPORT_SCHEMA_VERSION = 1;
/** The collection the reports are stored in — named here for readers; every WRITE and READ names it by its literal. */
export const PARSE_REPORT_COLLECTION_NAME = 'practiceFieldCaParseReports';

const upper = (s) => String(s || '').trim().toUpperCase();
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Which leg a request is for, from its path (never stored: the URL carries the key). */
const legOfUrl = (url) => (String(url).includes('/splits/') ? 'splits' : 'dividends');

/** A split row's ratio is exactly 1 (the parser drops it as a no-op, neither accepted nor rejected). */
function isNoOpSplit(row) {
  // (Dated, as the parser requires — a dateless 1:1 row is a rejection, not a no-op: review AR4-B-7.)
  if (!(typeof row?.date === 'string' && row.date.slice(0, 10))) return false; // (the parser's own date test)
  const m = typeof row?.split === 'string' ? row.split.match(/^([\d.]+)\s*\/\s*([\d.]+)$/) : null;
  if (!m) return false;
  const n = Number(m[1]);
  const d = Number(m[2]);
  return Number.isFinite(n) && Number.isFinite(d) && n > 0 && d > 0 && n / d === 1;
}

/**
 * One leg's report from the body the base parsed (or from its failure). Pure.
 * @param {string} symbol
 * @param {string} leg  'splits' | 'dividends'
 * @param {{ answered: boolean, status: number|null, body?: unknown, hasBody: boolean }} seen
 */
export function legReportOf(symbol, leg, seen) {
  const out = { answered: seen?.answered === true, status: Number.isInteger(seen?.status) ? seen.status : null, envelope: null, received: 0, accepted: 0, noOp: 0, rejected: 0, rejects: [] };
  if (!out.answered || seen.hasBody !== true) return out;
  const body = seen.body;
  if (!Array.isArray(body)) {
    // The parsers read a non-list as no rows at all (`Array.isArray(rows) ? rows : []`): the envelope is the failure.
    out.envelope = 'not_a_list';
    return out;
  }
  out.envelope = 'list';
  out.received = body.length;
  const parse = leg === 'splits' ? parseVendorSplits : parseVendorDividends;
  const { actions, rejects } = parse(symbol, body);
  out.accepted = actions.length;
  out.rejected = rejects.length;
  out.rejects = rejects.map((r) => ({ leg, reason: r.reason ?? 'rejected', row: r.row ?? null }));
  if (leg === 'splits') out.noOp = body.filter(isNoOpSplit).length;
  return out;
}

/**
 * A symbol's report entry from its two legs' reports. Pure.
 * @returns {object}  the entry stored under `symbols.SYM`
 */
export function parseReportEntryOf(legs, { at = null, actions = [] } = {}) {
  const l = Object.fromEntries(PARSE_LEGS.map((name) => [name, legs?.[name] ?? { answered: false, status: null, envelope: null, received: 0, accepted: 0, noOp: 0, rejected: 0, rejects: [] }]));
  const sum = (k) => PARSE_LEGS.reduce((n, name) => n + (Number(l[name][k]) || 0), 0);
  return {
    rowsReceived: sum('received'), rowsAccepted: sum('accepted'), rowsNoOp: sum('noOp'), rowsRejected: sum('rejected'),
    rejects: PARSE_LEGS.flatMap((name) => l[name].rejects || []),
    malformedEnvelope: PARSE_LEGS.some((name) => l[name].envelope === 'not_a_list'),
    // The rows THIS build's fetch returned — what it stores as the symbol's daily `corporateActions` (review AR4-B-1).
    actionsHash: actionsHashOf(actions),
    legs: Object.fromEntries(PARSE_LEGS.map((name) => {
      const { rejects: _r, ...rest } = l[name];
      return [name, rest];
    })),
    at,
  };
}

/**
 * T1a-2b-4 fix round (the founder's L-7; Astra T2E-07): PARSE OBSERVATIONS MERGE, AND DOUBT STICKS. Two observations of one
 * symbol in one session — two daily builds racing, a retry — meet in the report's merge. The same observation twice (every
 * figure but its `at`) is one observation: the entry stays as it was. Two that DISAGREE — even when the rows they accepted
 * hash the same (a losing build that saw an empty split list beside the winner's rejected `5:4`) — read UNCOVERED for the
 * session (`observationsDisagree`; parseEntryVerdict). A rejection once recorded STAYS: the merged entry keeps every rejected
 * row and the malformed-envelope flag of either. A later clean backfill covers the symbol through the existing path. Pure.
 * @param {object|undefined} prior  the entry already stored (or waiting in the same write) for the symbol and session
 * @param {object} entry            this observation's entry
 * @returns {object}  the entry to store
 */
export function mergeParseEntries(prior, entry) {
  if (prior === undefined || prior === null || typeof prior !== 'object' || Array.isArray(prior)) return entry;
  const sameAs = (x) => { const { at: _a, ...rest } = x; return stableStringify(rest); };
  if (prior.observationsDisagree !== true && sameAs(prior) === sameAs(entry)) return prior;
  const key = (r) => stableStringify(r);
  const rejects = [...new Map([...(Array.isArray(prior.rejects) ? prior.rejects : []), ...(Array.isArray(entry.rejects) ? entry.rejects : [])].map((r) => [key(r), r])).values()];
  const hashes = [...new Set([...(prior.actionsHashes || [prior.actionsHash]), entry.actionsHash].filter((h) => typeof h === 'string'))].sort();
  return {
    ...prior,
    rowsRejected: Math.max(Number(prior.rowsRejected) || 0, Number(entry.rowsRejected) || 0, rejects.length),
    rejects,
    malformedEnvelope: prior.malformedEnvelope === true || entry.malformedEnvelope === true,
    observationsDisagree: true,
    observations: (Number(prior.observations) || 1) + 1,
    actionsHashes: hashes,
    lastObservation: { at: entry.at ?? null, rowsReceived: entry.rowsReceived ?? null, rowsAccepted: entry.rowsAccepted ?? null, rowsRejected: entry.rowsRejected ?? null, malformedEnvelope: entry.malformedEnvelope ?? null, actionsHash: entry.actionsHash ?? null },
  };
}

/**
 * The session a base fetch's window belongs to: the base asks `[session − LOOKBACK, session + LOOKAHEAD]` calendar
 * days (mandateUniverseSnapshot.js ensureDailySnapshot). Null when the window is not that shape — no report is written
 * then, and a missing report is uncovered.
 */
export function sessionOfWindow(from, to) {
  if (!isDate(from) || !isDate(to)) return null;
  const session = shiftCalendarDate(from, MANDATE_CA_FETCH_LOOKBACK_DAYS);
  return shiftCalendarDate(session, MANDATE_CA_FETCH_LOOKAHEAD_DAYS) === to ? session : null;
}

/**
 * A `fetchImpl` that hands the base each response through, observing it ONCE: the body the base reads (`json()`) is
 * the body recorded. Its legs, as seen, are on `seen` (by leg name). Pure apart from the call it wraps.
 */
export function observingFetch(fetchImpl) {
  const seen = {};
  const wrapped = async (url) => {
    const leg = legOfUrl(url);
    const record = { answered: false, status: null, hasBody: false };
    seen[leg] = record;
    const res = await fetchImpl(url);
    record.status = Number.isInteger(res?.status) ? res.status : null;
    record.answered = res?.ok === true;
    return {
      ok: res?.ok,
      status: res?.status,
      json: async () => {
        const body = await res.json();
        record.body = body;
        record.hasBody = true;
        return body;
      },
    };
  };
  return { fetchImpl: wrapped, seen };
}

/**
 * THE WRAPPER (see the header). `symbols`: the symbols whose report is written (an idea book's coverage). `base`: the
 * fetcher wrapped (the daily builder's own by default), called with the same arguments plus the observing seam.
 * `fetchImpl`: the HTTP fetch the seam wraps (the global `fetch` at call time by default). `onReport(symbol, session,
 * entry)`: where a report goes — by default, the session's document in its own collection.
 * @returns {(symbol: string, opts: { from: string, to: string }) => Promise<object>}  the base's own answer
 */
export function makeParseReportingFetcher(db, { symbols = [], base = fetchCorporateActionsEODHD, fetchImpl = null, onReport = null, now = () => new Date(), writeTimeoutMs = PARSE_REPORT_WRITE_TIMEOUT_MS } = {}) {
  const required = new Set((symbols || []).map(upper));
  // (T1a-2b-4 fix round, L-7: IN A TRANSACTION — each symbol's entry merged with the one already stored for the session
  // (mergeParseEntries): two builds' observations meet, and a rejection one of them recorded is never overwritten by the
  // other's clean one — Astra T2E-07, where the losing build's report replaced the winner's rejection.)
  const writeDoc = onReport ? null : (session, entries) => db.runTransaction(async (tx) => {
    // The collection by its literal name, for the protected-store scan. A merge of the symbols' entries only.
    const ref = db.collection('practiceFieldCaParseReports').doc(session);
    const snap = await tx.get(ref);
    const stored = snap.exists && snap.data()?.symbols && typeof snap.data().symbols === 'object' ? snap.data().symbols : {};
    const merged = Object.fromEntries(Object.entries(entries).map(([sym, e]) => [sym, mergeParseEntries(Object.hasOwn(stored, sym) ? stored[sym] : undefined, e)]));
    tx.set(ref, { schemaVersion: PARSE_REPORT_SCHEMA_VERSION, session, symbols: merged }, { merge: true });
  });
  // ONE WRITER AT A TIME, COALESCED (review AR4-B-6): the build fetches several symbols at once; their entries wait in
  // `pending` and go in one merge per round, never several writes to one document at once. Each symbol's fetch resolves
  // when the round carrying its entry settles — or after `writeTimeoutMs`, given up (its report then reads missing:
  // uncovered) — so a slow write never stalls the shared build for long.
  const pending = new Map(); // session → { [symbol]: { entry, settle } }
  let running = null;
  const pump = async () => {
    while (pending.size > 0) {
      const [session, batch] = pending.entries().next().value;
      pending.delete(session);
      const entries = Object.fromEntries(Object.entries(batch).map(([sym, x]) => [sym, x.entry]));
      try {
        await writeDoc(session, entries);
        for (const x of Object.values(batch)) x.settle(null);
      } catch (err) {
        for (const x of Object.values(batch)) x.settle(err);
      }
    }
    running = null;
  };
  const enqueue = (symbol, session, entry) => new Promise((resolve) => {
    const batch = pending.get(session) || {};
    // (A later entry of the same symbol and session MERGES with the waiting one — L-7: the two observations meet, a
    // rejection sticks; the replaced fetch settles with this round.)
    const prior = batch[symbol];
    batch[symbol] = { entry: mergeParseEntries(prior?.entry, entry), settle: (err) => { prior?.settle(err); resolve(err); } };
    pending.set(session, batch);
    if (!running) running = pump();
  });
  const write = onReport ? (symbol, session, entry) => onReport(symbol, session, entry).then(() => null, (err) => err) : enqueue;
  return async function fetchWithParseReport(symbol, opts = {}) {
    const sym = upper(symbol);
    if (!required.has(sym)) return base(symbol, opts);
    const observer = observingFetch(fetchImpl ?? ((url) => globalThis.fetch(url)));
    const res = await base(symbol, { ...opts, fetchImpl: observer.fetchImpl });
    try {
      const session = sessionOfWindow(opts?.from, opts?.to);
      if (session !== null) {
        const legs = Object.fromEntries(PARSE_LEGS.map((leg) => [leg, legReportOf(sym, leg, observer.seen[leg])]));
        const entry = parseReportEntryOf(legs, { at: now().toISOString(), actions: res?.actions });
        let timer;
        const late = new Promise((resolve) => { timer = setTimeout(() => resolve(new Error(`no answer in ${writeTimeoutMs} ms`)), writeTimeoutMs); });
        const err = await Promise.race([write(sym, session, entry), late]).finally(() => clearTimeout(timer));
        if (err) throw err;
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} PRACTICE_FIELD_PARSE_REPORT_UNWRITTEN ${sym} — ${err?.message ?? err}; the report is missing, so the symbol reads uncovered`);
    }
    return res;
  };
}

/**
 * The backfill's own report (caBackfill.js): the same entry, computed from a fetch the backfill made through the
 * observing seam. Returns `{ res, entry }` — `res` the base's answer, untouched.
 */
export async function fetchObservingParse(symbol, opts, { base = fetchCorporateActionsEODHD, fetchImpl = null, now = () => new Date() } = {}) {
  const sym = upper(symbol);
  const observer = observingFetch(fetchImpl ?? ((url) => globalThis.fetch(url)));
  const res = await base(symbol, { ...opts, fetchImpl: observer.fetchImpl });
  const legs = Object.fromEntries(PARSE_LEGS.map((leg) => [leg, legReportOf(sym, leg, observer.seen[leg])]));
  return { res, entry: parseReportEntryOf(legs, { at: now().toISOString(), actions: res?.actions }) };
}
