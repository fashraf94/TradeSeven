// api/_utils/practiceField/admissionMarks.js
//
// Practice Field T1a-2b-2 — WHAT ADMISSION MEASURES AGAINST (Astra T1A-05; T1a-2a C-2; build prompt §1). Admission's
// limits are shares of the book's equity, and its sector cap reads what the book already holds. Until this build both
// came from the last RECORDED values (`portfolio.totalValue`, each position's `lastMark`), so a 20% move since the last
// close let a cap pass by more than $1,000. Two rules replace that:
//
//   ONE SET OF MARKS FOR THE WHOLE DECISION. Equity, every cap's dollar limit, sector exposure, the cash floor and the
//   headroom admission returns all come from one stored snapshot (`readAdmissionMarkSet`):
//     • during a session (its open ≤ now < its scheduled end), the NEWEST snapshot the engine has built in that session
//       — the latest of its slot snapshots (`{date}_{slot}`, the engine's own geometry) built at or before now;
//     • outside a session, the last completed session's close (`{date}_close`).
//   Every held name, on every ledger the caps read (each open idea's own ledger — the book's positions mirror them; the
//   comparison and SPY ledgers are shadows and no cap reads them), needs a FULL-QUALITY mark in that set
//   (`admissionMarksOf`): a complete quote the vendor timed in that session, at or after its open (marks.js
//   closeMarkQuality — the close's own test of a full-quality mark); for an intraday snapshot also no older than the
//   idea book's maximum quote age at the snapshot's build (marks.js quotePastMaxAge — the fills' own age rule); and a
//   holding whose share count that price can be trusted against (ledger.js saleHeldBackBy — the sales' own rule: no
//   action due and unapplied, no unsettled conflict, no held action, no suspected split). FAIL CLOSED: a name that
//   lacks one is refused `admission_marks_unavailable`, by symbol, and nothing falls back to `lastMark` or `totalValue`.
//   The equity is the R-19 basis (ledger.js markedEquityCents) at these marks: the treasury + Σ open ideas' (cash +
//   their holdings at the set's marks, rounded once per idea — the close's own valuation, ledger.js valueLedger), in
//   whole cents.
//
//   THE DAY'S CORPORATE-ACTION COVERAGE (Astra T2C-01). "No action listed" in the snapshot means something only if the
//   day's action fetch for the name SUCCEEDED, and only the daily layer (`mandateUniverseDaily/{session}`) records that:
//   the snapshot builder copies its action rows, never its `caFetchFailed`. A failed fetch read as "no action" let a
//   reverse split's adjusted price (under the gap screen's threshold) be taken against the old share count, and a cap
//   pass by $1,001.80. So `readAdmissionMarkSet` also reads the daily document of the session the marks belong to,
//   inside the same transaction, and before any held name is valued it must have an entry there whose fetch did not
//   fail — the sales' own rule (exits.js planPendingSales, `corporate_action_data_missing`). Refused by symbol:
//   `ca_daily_missing` (no daily document at all — stricter than a sale, on purpose: admission can wait, a sale has a
//   reason to proceed), `ca_coverage_missing` (no entry for the name), `ca_fetch_failed`. A book holding nothing
//   needs none of it. The packet records the document's key and, per held name, whether it was covered and its fetch
//   succeeded (`admissionMarksRecord`).
//
//   NO ADMISSION WHILE A CLOSE IS OWED (C-2; `closeOwedSession`). A session counts as completed at its scheduled end
//   (16:00 Eastern; 13:00 on an early close). If the book has not closed every session it was due that has completed
//   by now — its window ledger's cursor (windowLedger.js firstUnaccountedWindowSession: the later of the valuation's
//   last close and the window ledger's own, else the book's creation session) — admission is refused `close_owed`. So
//   a later admission never appears on a caught-up past row. A cursor that cannot be read is owed (fail closed); a
//   closed book owes nothing (it is never closed again, and admission refuses it as not active).
//
// Pure, except `readAdmissionMarkSet`, which reads (only) inside the caller's transaction.

import { getSessionForDate } from '../marketSchedule.js';
import { resolveSessionSlots } from '../mandateSessionSlots.js';
import { MARK_QUALITY } from './constants.js';
import { quotePastMaxAge, instantMs } from './marks.js';
import { valueLedger, saleHeldBackBy } from './ledger.js';
import { etDateOfMs, sessionCloseMs } from './windows.js';
import { firstUnaccountedWindowSession, WINDOWS_ACCOUNTED_FIELD } from './windowLedger.js';
import { toCents, fromCents } from './money.js';

/** Where admission's marks come from. */
export const ADMISSION_MARK_BASIS = Object.freeze({ SESSION_SNAPSHOT: 'session_snapshot', LAST_CLOSE: 'last_close' });

/** Why a held name's share basis cannot be trusted for want of the day's corporate-action coverage (Astra T2C-01). */
export const CA_COVERAGE_REFUSAL = Object.freeze({
  DAILY_MISSING: 'ca_daily_missing', COVERAGE_MISSING: 'ca_coverage_missing', FETCH_FAILED: 'ca_fetch_failed',
});

/**
 * One held name's coverage in the session's daily layer (`markSet.daily`; absent: none was read — fail closed). Pure.
 * @returns {{ covered: boolean, fetchSucceeded: boolean|null, refusal: string|null }}
 */
function caCoverageOf(daily, symbol) {
  if (daily?.present !== true) return { covered: false, fetchSucceeded: null, refusal: CA_COVERAGE_REFUSAL.DAILY_MISSING };
  const symbols = daily?.symbols;
  // Its own entry only: never one inherited through the object's prototype.
  const entry = symbols !== null && typeof symbols === 'object' && Object.hasOwn(symbols, symbol) ? symbols[symbol] : null;
  if (entry == null) return { covered: false, fetchSucceeded: null, refusal: CA_COVERAGE_REFUSAL.COVERAGE_MISSING };
  if (entry?.caFetchFailed === true) return { covered: true, fetchSucceeded: false, refusal: CA_COVERAGE_REFUSAL.FETCH_FAILED };
  return { covered: true, fetchSucceeded: true, refusal: null };
}

const DAY_MS = 86_400_000;
/** Calendar days a walk back to the last completed session may cover (a long weekend plus a holiday is five). */
const MAX_STEP_DAYS = 12;

/** Whole cents of a stored dollar figure — only a real number is one: a null, a string or NaN is not zero. */
const centsOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? toCents(v) : NaN);

const prevCalendarDate = (etDate) => {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) - DAY_MS).toISOString().slice(0, 10);
};

/**
 * The session `nowMs` lies inside (its open ≤ now < its scheduled end), or null. Pure.
 * @returns {string|null}  the session's ET date
 */
export function sessionInProgressAt(nowMs) {
  const date = etDateOfMs(nowMs);
  const s = getSessionForDate(date);
  return s?.isTradingDay && Number.isFinite(s.openMs) && Number.isFinite(s.closeMs) && nowMs >= s.openMs && nowMs < s.closeMs ? date : null;
}

/**
 * The last session COMPLETED at `nowMs` — the latest one whose scheduled end (16:00 Eastern; 13:00 on an early close)
 * is at or before now — or null when the walk leaves the maintained calendar. Pure.
 */
export function lastCompletedSessionAt(nowMs) {
  let date = etDateOfMs(nowMs);
  for (let i = 0; i <= MAX_STEP_DAYS; i += 1) {
    const s = getSessionForDate(date);
    if (!s) return null;
    if (s.isTradingDay && Number.isFinite(s.closeMs) && s.closeMs <= nowMs) return date;
    date = prevCalendarDate(date);
  }
  return null;
}

/**
 * C-2: the first session the book was due that has COMPLETED by `nowIso` without its close, or null when nothing is
 * owed. Pure. `{ session: null }` when the book's cursor cannot be read (no close, no window cursor, no readable
 * creation time) or leaves the maintained calendar: owed, so admission fails closed.
 *
 * @returns {{ session: string|null, completedAtIso: string|null } | null}
 */
export function closeOwedSession(book, nowIso) {
  const nowMs = Date.parse(nowIso);
  // A closed book is never closed again: it owes nothing (fix-round refuter N2; `book_not_active` says why it admits nothing).
  if (book?.status === 'closed') return null;
  // A cursor that is present but not a real calendar date — not a string, not YYYY-MM-DD, or a day that does not exist
  // (2026-11-99, 2026-02-30) — cannot be read: owed, typed (review A6; fix-round refuter F1, N4) — never a throw.
  const isDate = (v) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const ms = Date.parse(`${v}T12:00:00Z`);
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === v;
  };
  const unreadable = (v) => v !== undefined && v !== null && !isDate(v);
  if (unreadable(book?.execState?.lastCloseKey) || unreadable(book?.execState?.[WINDOWS_ACCOUNTED_FIELD])) return { session: null, completedAtIso: null };
  let first;
  try { first = firstUnaccountedWindowSession(book); } catch { return { session: null, completedAtIso: null }; }
  if (first === null) return { session: null, completedAtIso: null };
  const endMs = sessionCloseMs(first);
  if (endMs === null) return { session: first, completedAtIso: null };
  return nowMs >= endMs ? { session: first, completedAtIso: new Date(endMs).toISOString() } : null;
}

/** The snapshot document ids admission may read at `nowIso`, newest first, and the basis and session they belong to. */
export function admissionMarkSetCandidates(nowIso) {
  const nowMs = Date.parse(nowIso);
  const inSession = sessionInProgressAt(nowMs);
  if (inSession !== null) {
    const geometry = resolveSessionSlots(inSession);
    const s = getSessionForDate(inSession);
    // The engine's slots that have opened by now — a slot not yet open has built nothing — newest first.
    const keys = (geometry?.trading ? geometry.slots : [])
      .filter((slot) => s.openMs + (slot.atMin - geometry.openMin) * 60_000 <= nowMs)
      .map((slot) => `${inSession}_${slot.name}`)
      .reverse();
    return { basis: ADMISSION_MARK_BASIS.SESSION_SNAPSHOT, session: inSession, keys };
  }
  const last = lastCompletedSessionAt(nowMs);
  return { basis: ADMISSION_MARK_BASIS.LAST_CLOSE, session: last, keys: last === null ? [] : [`${last}_close`] };
}

/**
 * Read admission's ONE snapshot, inside the caller's transaction (every read before any write). The collection by its
 * literal name, for the protected-store scan. A stored document is THE one only when its own key and session are the
 * ones asked for and it was built at or before `nowIso` (a snapshot built after the decision's instant — seen by a
 * transaction retried later — is not one it was made against). The first that qualifies, newest first; none is
 * `{ snapshot: null }` and every held name then lacks a mark. A stored document passed over is named with its reason
 * in `passedOver` (review A7): a document built after the decision is a race; one that is not its key's own is not.
 *
 * Astra T2C-01: with it, READ ONLY, the daily layer of the same session (`daily`: its key, whether it exists, its
 * per-symbol entries) — the one record of whether the day's corporate-action fetch succeeded for a name. None is read
 * when the calendar names no session (`daily: null`).
 *
 * @returns {Promise<{ basis: string, session: string|null, snapshotKey: string|null, snapshot: object|null,
 *                     builtAtIso: string|null, considered: string[], passedOver: Array<{ key: string, reason: string }>,
 *                     reason: string|null, daily: { key: string, present: boolean, symbols: object|null }|null }>}
 */
export async function readAdmissionMarkSet(tx, db, { nowIso }) {
  const { basis, session, keys } = admissionMarkSetCandidates(nowIso);
  const nowMs = Date.parse(nowIso);
  let reason = keys.length === 0 ? (session === null ? 'calendar_unsupported' : 'no_snapshot_yet') : 'no_snapshot';
  const passedOver = [];
  // The collection by its literal name, as the sales read it (exits.js), for the protected-store scan.
  let daily = null;
  if (session !== null) {
    const dailySnap = await tx.get(db.collection('mandateUniverseDaily').doc(session));
    daily = { key: session, present: dailySnap.exists, symbols: dailySnap.exists ? (dailySnap.data()?.symbols ?? null) : null };
  }
  for (const key of keys) {
    const snap = await tx.get(db.collection('mandateUniverseSnapshots').doc(key));
    if (!snap.exists) continue;
    const doc = snap.data();
    const builtMs = instantMs(doc?.builtAt);
    if (doc?.tickKey !== key || doc?.sessionDate !== session || !Number.isFinite(builtMs)) { reason = 'snapshot_invalid'; passedOver.push({ key, reason }); continue; }
    if (builtMs > nowMs) { reason = 'snapshot_after_decision'; passedOver.push({ key, reason }); continue; }
    return { basis, session, snapshotKey: key, snapshot: doc, builtAtIso: new Date(builtMs).toISOString(), considered: keys, passedOver, reason: null, daily };
  }
  return { basis, session, snapshotKey: null, snapshot: null, builtAtIso: null, considered: keys, passedOver, reason, daily };
}

/**
 * Admission's marks and equity, from the ONE set. Pure. `ideas` are the book's open ideas as admission's transaction
 * read them; `markSet` is readAdmissionMarkSet's answer (null: no set — a book that holds nothing needs none).
 *
 * @returns {{
 *   ok: boolean,
 *   unavailable: Array<{ symbol: string, ideaId: string|null, reason: string }>,
 *   marks: Object<string, { price: number, quality: string, vendorTimeIso: string, ageAtAdmissionMs: number, snapshotKey: string }>,
 *   caCoverage: Object<string, { covered: boolean, fetchSucceeded: boolean|null }>,
 *   treasuryCents: number, ideasCashCents: number, holdingsCents: number, equityCents: number,
 * }}
 */
export function admissionMarksOf({ book, ideas, markSet, nowIso }) {
  const nowMs = Date.parse(nowIso);
  const snapshot = markSet?.snapshot ?? null;
  const session = markSet?.session ?? null;
  const intraday = markSet?.basis === ADMISSION_MARK_BASIS.SESSION_SNAPSHOT;
  const sinceDate = typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  const unavailable = [];
  const marks = {};
  const caCoverage = {};
  const treasuryCents = centsOf(book?.treasury?.unreservedCash);
  let ideasCashCents = 0;
  let holdingsCents = 0;
  for (const idea of ideas || []) {
    const ledger = idea?.ledger;
    ideasCashCents += centsOf(ledger?.cash);
    const held = Object.keys(ledger?.holdings || {});
    if (held.length === 0) continue;
    if (snapshot === null) {
      for (const symbol of held) unavailable.push({ symbol, ideaId: idea.ideaId ?? null, reason: markSet?.reason ?? 'no_snapshot' });
      continue;
    }
    // A holding whose share count this price cannot be trusted against is valued at nothing here: it is refused.
    const heldBack = new Set();
    for (const symbol of held) {
      // Astra T2C-01: first, the day's corporate-action coverage — without it "no action listed" says nothing.
      const coverage = caCoverageOf(markSet?.daily, symbol);
      caCoverage[symbol] = { covered: coverage.covered, fetchSucceeded: coverage.fetchSucceeded };
      if (coverage.refusal !== null) {
        heldBack.add(symbol);
        unavailable.push({ symbol, ideaId: idea.ideaId ?? null, reason: coverage.refusal });
        continue;
      }
      const why = saleHeldBackBy(ledger, symbol, snapshot, {
        sinceDate, date: session, otherLedgers: [idea.comparisonLedger, idea.spyLedger],
      });
      if (why !== null) {
        heldBack.add(symbol);
        unavailable.push({ symbol, ideaId: idea.ideaId ?? null, reason: why });
      }
    }
    // The close's own valuation of this ledger from this snapshot (frozen names carried — and refused above).
    const v = valueLedger(ledger, snapshot, { sessionDate: session, frozen: heldBack });
    for (const symbol of held) {
      if (heldBack.has(symbol)) continue;
      const m = v.marks[symbol];
      let reason = null;
      if (!m || m.markSource !== 'snapshot') reason = 'no_quote';
      else if (m.quality !== MARK_QUALITY.VENDOR_TIME) reason = m.quality;
      else if (intraday && quotePastMaxAge(snapshot, symbol)) reason = 'stale_quote';
      if (reason !== null) {
        unavailable.push({ symbol, ideaId: idea.ideaId ?? null, reason });
        continue;
      }
      marks[symbol] = {
        price: m.mark, quality: m.quality, vendorTimeIso: m.vendorTimeIso,
        ageAtAdmissionMs: nowMs - Date.parse(m.vendorTimeIso), snapshotKey: markSet.snapshotKey,
      };
    }
    holdingsCents += toCents(v.markedHoldingsValue);
  }
  // Every position of the book must be one of the ideas' holdings with a mark (they reconcile; checked, not assumed).
  for (const symbol of Object.keys(book?.portfolio?.positions || {})) {
    if (!Object.hasOwn(marks, symbol) && !unavailable.some((u) => u.symbol === symbol)) {
      unavailable.push({ symbol, ideaId: book.portfolio.positions[symbol]?.ideaId ?? null, reason: 'no_quote' });
    }
  }
  unavailable.sort((a, b) => (a.symbol === b.symbol ? 0 : (a.symbol < b.symbol ? -1 : 1)));
  const equityCents = treasuryCents + ideasCashCents + holdingsCents;
  return { ok: unavailable.length === 0, unavailable, marks, caCoverage, treasuryCents, ideasCashCents, holdingsCents, equityCents };
}

/**
 * What the admission packet records of the set (T1a-2b-2 §1): its basis, session and snapshot key, each mark with its
 * provenance and its age at admission, and the equity derived from them. Pure; JSON-pure numbers and strings.
 * `caCoverage` (Astra T2C-01): the daily document read (its key — the session — and whether it existed) and, for each
 * held name, whether it was covered there and its corporate-action fetch succeeded.
 */
export function admissionMarksRecord({ markSet, measured, nowIso }) {
  return {
    basis: markSet?.basis ?? null,
    session: markSet?.session ?? null,
    snapshotKey: markSet?.snapshotKey ?? null,
    snapshotBuiltAt: markSet?.builtAtIso ?? null,
    considered: markSet?.considered ?? [],
    passedOver: markSet?.passedOver ?? [],
    caCoverage: {
      dailyKey: markSet?.daily?.key ?? null,
      dailyPresent: typeof markSet?.daily?.present === 'boolean' ? markSet.daily.present : null,
      symbols: Object.fromEntries(Object.keys(measured?.caCoverage || {}).sort().map((s) => [s, { ...measured.caCoverage[s] }])),
    },
    at: nowIso,
    marks: Object.fromEntries(Object.keys(measured?.marks || {}).sort().map((s) => [s, { ...measured.marks[s] }])),
    treasuryUsd: Number.isInteger(measured?.treasuryCents) ? fromCents(measured.treasuryCents) : null,
    ideasCashUsd: Number.isInteger(measured?.ideasCashCents) ? fromCents(measured.ideasCashCents) : null,
    holdingsUsd: Number.isInteger(measured?.holdingsCents) ? fromCents(measured.holdingsCents) : null,
    equityUsd: Number.isInteger(measured?.equityCents) ? fromCents(measured.equityCents) : null,
  };
}

