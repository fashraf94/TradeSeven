// api/_utils/huddle/records.js
//
// Huddle S1 — THE RECORDS (spec V1.1 §3; A §A2, §A8; B §B4; C §C1, §C10): collection
// names, document ids and references, the ET date helpers and the session binding.
// Every new collection is SERVER-WRITE ONLY; the client may read only its own huddle
// record (firestore.rules, test/rules/huddleDenials.rules.mjs):
//
//   huddles/{uid}/days/{etDate}          the huddle record, one per player per session
//   huddleQueue/{uid}_{etDate}           the job row: claim, lease, attempts, generation
//   symbolDayEvidence/{etDate}_{SYMBOL}  the shared per-symbol evidence record (C1)
//   huddleRuns/{etDate}                  the run marker: brief / enqueue stages, the
//                                        shared tape layer, and the playback index
//
// The four top-level names are in the protected-store scanner's list
// (compositionProtectedStoresScan.js PROTECTED_COLLECTIONS), so every write site to
// them is counted against compositionProtectedStoresAllowlist.json. References are
// built here and handed to transactions, so a write site resolves `unresolved` and is
// listed by name (the scanner's documented handle-form limit).
//
// `etDate` is ALWAYS the ET trading date (C1), never a UTC date.

import { getSessionForDate } from '../marketSchedule.js';

export const HUDDLES = 'huddles';
export const HUDDLE_DAYS = 'days';
export const HUDDLE_QUEUE = 'huddleQueue';
export const SYMBOL_DAY_EVIDENCE = 'symbolDayEvidence';
export const HUDDLE_RUNS = 'huddleRuns';
export const HUDDLE_TOP_LEVEL_COLLECTIONS = Object.freeze([HUDDLES, HUDDLE_QUEUE, SYMBOL_DAY_EVIDENCE, HUDDLE_RUNS]);

export const RECORD_STATUS = Object.freeze({ QUEUED: 'queued', GENERATING: 'generating', READY: 'ready', FAILED: 'failed' });
export const PLAN_STATUS = Object.freeze({ PROPOSED: 'proposed', CONFIRMED: 'confirmed', SKIPPED: 'skipped', EXPIRED: 'expired' });
export const QUEUE_STATUS = Object.freeze({ PENDING: 'pending', CLAIMED: 'claimed', DONE: 'done', FAILED: 'failed' });

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The ET calendar date of an instant, 'YYYY-MM-DD' (Intl, never offset arithmetic — BUILD_RULES §6). */
export function etDateOfMs(ms) {
  const parts = ET_DATE.formatToParts(new Date(ms));
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const isEtDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const ET_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** The ET wall clock of an instant, "HHmm" (Intl, never offset arithmetic). */
export function etClockOfMs(ms) {
  const parts = ET_CLOCK.formatToParts(new Date(ms));
  const part = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('hour').padStart(2, '0')}${part('minute').padStart(2, '0')}`;
}

/**
 * Amendment E §E2: the regular session's window in ET clock terms, { open: '0930', close: '1600' } (an early close
 * '1300'), from the session's own bounds — or null when the day has none (the event check then fails closed).
 */
export function sessionWindowOf(session) {
  if (!session || typeof session.openMs !== 'number' || typeof session.closeMs !== 'number') return null;
  return { open: etClockOfMs(session.openMs), close: etClockOfMs(session.closeMs) };
}

/** The next trading session after `etDate` (holidays and weekends skipped), or null beyond the calendar's horizon. */
export function nextSessionDateOf(etDate) {
  if (!isEtDate(etDate)) return null;
  const [y, m, d] = etDate.split('-').map(Number);
  let cursor = Date.UTC(y, m - 1, d, 12, 0, 0);
  for (let i = 0; i < 15; i += 1) {
    cursor += 86_400_000;
    const ds = new Date(cursor).toISOString().slice(0, 10);
    const s = getSessionForDate(ds);
    if (!s) return null;
    if (s.isTradingDay) return ds;
  }
  return null;
}
const isUid = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);

/**
 * The session a huddle belongs to (spec V1.1 §3.1): getSessionForDate's bounds, holiday-
 * and early-close-aware. Null outside the calendar's maintained years (the caller exits
 * `calendar_missing` and never guesses).
 */
export function sessionOf(etDate) {
  const s = getSessionForDate(etDate);
  if (!s) return null;
  return { etDate: s.etDate, isTradingDay: s.isTradingDay, isEarlyClose: s.isEarlyClose, openMs: s.openMs, closeMs: s.closeMs, previousEtDate: s.previousEtDate ?? null };
}

export function huddleDayRef(db, uid, etDate) {
  if (!isUid(uid) || !isEtDate(etDate)) throw new Error('huddle record: a uid and an ET date are required');
  return db.collection(HUDDLES).doc(uid).collection(HUDDLE_DAYS).doc(etDate);
}

export const queueRowId = (uid, etDate) => `${uid}_${etDate}`;

export function queueRowRef(db, uid, etDate) {
  if (!isUid(uid) || !isEtDate(etDate)) throw new Error('huddle queue: a uid and an ET date are required');
  return db.collection(HUDDLE_QUEUE).doc(queueRowId(uid, etDate));
}

export const evidenceDocId = (etDate, symbol) => `${etDate}_${symbol}`;

export function symbolDayEvidenceRef(db, etDate, symbol) {
  if (!isEtDate(etDate) || typeof symbol !== 'string' || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(symbol)) {
    throw new Error('symbolDayEvidence: an ET date and a ticker are required');
  }
  return db.collection(SYMBOL_DAY_EVIDENCE).doc(evidenceDocId(etDate, symbol));
}

export function huddleRunRef(db, etDate) {
  if (!isEtDate(etDate)) throw new Error('huddleRuns: an ET date is required');
  return db.collection(HUDDLE_RUNS).doc(etDate);
}

/** The battles collection, for the apply module's reads and its one slot filing. */
export const battleRefOf = (db, battleId) => db.collection('agentBattles').doc(battleId);
