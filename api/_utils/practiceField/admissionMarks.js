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
//   NO ADMISSION WHILE A CLOSE IS OWED (C-2; `closeOwedSession`). A session counts as completed at its scheduled end
//   (16:00 Eastern; 13:00 on an early close). If the book has not closed every session it was due that has completed
//   by now — its window ledger's cursor (windowLedger.js firstUnaccountedWindowSession: the later of the valuation's
//   last close and the window ledger's own, else the book's creation session) — admission is refused `close_owed`. So
//   a later admission never appears on a caught-up past row. A cursor that cannot be read is owed (fail closed).
//
// Pure, except `readAdmissionMarkSet`, which reads (only) inside the caller's transaction.

import { getSessionForDate } from '../marketSchedule.js';
import { resolveSessionSlots } from '../mandateSessionSlots.js';
import { MARK_QUALITY } from './constants.js';
import { quotePastMaxAge, instantMs } from './marks.js';
import { valueLedger, saleHeldBackBy } from './ledger.js';
import { etDateOfMs, sessionCloseMs } from './windows.js';
import { firstUnaccountedWindowSession } from './windowLedger.js';
import { toCents, fromCents } from './money.js';

/** Where admission's marks come from. */
export const ADMISSION_MARK_BASIS = Object.freeze({ SESSION_SNAPSHOT: 'session_snapshot', LAST_CLOSE: 'last_close' });

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
  const first = firstUnaccountedWindowSession(book);
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
 * `{ snapshot: null }` and every held name then lacks a mark.
 *
 * @returns {Promise<{ basis: string, session: string|null, snapshotKey: string|null, snapshot: object|null,
 *                     builtAtIso: string|null, considered: string[], reason: string|null }>}
 */
export async function readAdmissionMarkSet(tx, db, { nowIso }) {
  const { basis, session, keys } = admissionMarkSetCandidates(nowIso);
  const nowMs = Date.parse(nowIso);
  let reason = keys.length === 0 ? (session === null ? 'calendar_unsupported' : 'no_snapshot_yet') : 'no_snapshot';
  for (const key of keys) {
    const snap = await tx.get(db.collection('mandateUniverseSnapshots').doc(key));
    if (!snap.exists) continue;
    const doc = snap.data();
    const builtMs = instantMs(doc?.builtAt);
    if (doc?.tickKey !== key || doc?.sessionDate !== session || !Number.isFinite(builtMs)) { reason = 'snapshot_invalid'; continue; }
    if (builtMs > nowMs) { reason = 'snapshot_after_decision'; continue; }
    return { basis, session, snapshotKey: key, snapshot: doc, builtAtIso: new Date(builtMs).toISOString(), considered: keys, reason: null };
  }
  return { basis, session, snapshotKey: null, snapshot: null, builtAtIso: null, considered: keys, reason };
}

/**
 * Admission's marks and equity, from the ONE set. Pure. `ideas` are the book's open ideas as admission's transaction
 * read them; `markSet` is readAdmissionMarkSet's answer (null: no set — a book that holds nothing needs none).
 *
 * @returns {{
 *   ok: boolean,
 *   unavailable: Array<{ symbol: string, ideaId: string|null, reason: string }>,
 *   marks: Object<string, { price: number, quality: string, vendorTimeIso: string, ageAtAdmissionMs: number, snapshotKey: string }>,
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
  return { ok: unavailable.length === 0, unavailable, marks, treasuryCents, ideasCashCents, holdingsCents, equityCents };
}

/**
 * What the admission packet records of the set (T1a-2b-2 §1): its basis, session and snapshot key, each mark with its
 * provenance and its age at admission, and the equity derived from them. Pure; JSON-pure numbers and strings.
 */
export function admissionMarksRecord({ markSet, measured, nowIso }) {
  return {
    basis: markSet?.basis ?? null,
    session: markSet?.session ?? null,
    snapshotKey: markSet?.snapshotKey ?? null,
    snapshotBuiltAt: markSet?.builtAtIso ?? null,
    considered: markSet?.considered ?? [],
    at: nowIso,
    marks: Object.fromEntries(Object.keys(measured?.marks || {}).sort().map((s) => [s, { ...measured.marks[s] }])),
    treasuryUsd: Number.isInteger(measured?.treasuryCents) ? fromCents(measured.treasuryCents) : null,
    ideasCashUsd: Number.isInteger(measured?.ideasCashCents) ? fromCents(measured.ideasCashCents) : null,
    holdingsUsd: Number.isInteger(measured?.holdingsCents) ? fromCents(measured.holdingsCents) : null,
    equityUsd: Number.isInteger(measured?.equityCents) ? fromCents(measured.equityCents) : null,
  };
}

