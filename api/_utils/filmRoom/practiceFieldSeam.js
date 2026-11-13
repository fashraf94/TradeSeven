// api/_utils/filmRoom/practiceFieldSeam.js
//
// Film Room C1 — THE PRACTICE FIELD SEAM (build prompt refinement R-C1-3; Build C spec
// docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md §4, §9, §13 items 1 and 2). The Film Room's nomination path
// reaches the Practice Field's book through exactly two helpers, both THE PRACTICE FIELD'S, reached through this one
// module so the path is complete and tested before the book exists:
//
//   bookForOwner(db, { uid, attributionAgentId })  → { bookId, status } | null
//       The owner's idea book for that attribution agent: ONE read, server-side. The Film Room offers a nomination only
//       to a book whose `status` is 'active' (spec §4 precondition 4); anything else is `book_not_open`.
//       DEFAULT: null — no book exists for anyone until the Practice Field's T1a lands, so every nomination is refused
//       and the form never offers the Offer route. The default reads nothing.
//       OWNER: the Practice Field's T1a replaces it (spec §13 item 1 asks T1a to add it and name its path).
//
//   buildNominationDoc({ entryId, situationId, questionId, questionVersion, nowIso, expiresAfterSessions })
//       → the nomination record, shared contract V2 §5.2's shape, written by the card endpoint's ONE transaction at
//       `mandates/{bookId}/nominations/{nominationId}` beside the entry's move to `nominated` (spec §4) — one writer
//       owns the shape (spec §13 item 2).
//       DEFAULT: `{ state: 'queued', source: { kind: 'film_room_card', entryId, situationId, questionId,
//       questionVersion }, queuedAt, expiresAt, stateHistory }`, `expiresAt` the CLOSE of the `expiresAfterSessions`-th
//       session after the anchor session (the session holding `queuedAt`, else the next one; the anchor is session 0),
//       on the calendar of record (api/_utils/marketSchedule.js getSessionForDate, the hypothesis review clock's
//       convention). A walk the calendar cannot place — a year outside MAINTAINED_HOLIDAY_YEARS — throws
//       `calendar_unavailable`: an expiry is never guessed.
//       OWNER: the Practice Field's T2 replaces it (the nominations rule is declared there too, spec §9).
//
//   bookIsForAgent(bookDoc, attributionAgentId) → boolean   (Amendment A CA-12)
//       Pure: is the book document (re-read inside the nominate and Offer transactions) the attribution agent's?
//       DEFAULT: compares a field named `attributionAgentId`. A throw, or any answer but `true`, refuses book_not_open.
//       OWNER: the Practice Field's T1a, which names the book's real attribution field.
//
//   buildWithdrawal(record, { nowIso })   (Amendment A CA-2)
//       → the record withdrawn by the player's retire of a nominated card the agent has not taken (`queued`,
//       `considered` or `deferred`): written by the retire's ONE transaction beside the entry's move to `retired`.
//       DEFAULT: the record with `state: 'withdrawn'`, `withdrawnAt` and a `stateHistory` row `{ state: 'withdrawn', at,
//       by: 'player' }`. Pure. OWNER: the Practice Field, as for buildNominationDoc.
//
// The Practice Field owns the book: nothing in the Film Room writes a book document except the nomination record this
// builder shapes, inside the card endpoint's transaction, and CA-2's withdrawal, inside the retire's. setPracticeFieldSeam swaps either helper FOR TESTS ONLY — it
// throws outside the vitest runner, so production can never call it.

import { getSessionForDate } from '../marketSchedule.js';

/** The nomination record's source kind for a Film Room card (contract V2 §5.2). */
export const NOMINATION_SOURCE_KIND = 'film_room_card';
/** The state a nomination is filed at. */
export const NOMINATION_QUEUED = 'queued';

const DAY_MS = 86_400_000;
/** Calendar days a session walk may cover before it is called runaway (ten sessions span at most ~16 days; holidays included). */
const MAX_WALK_DAYS = 60;
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const nextEtDate = (etDate) => { const [y, m, d] = etDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12) + DAY_MS).toISOString().slice(0, 10); };

/** A typed seam failure: `code` ∈ invalid_nomination | calendar_unavailable. */
export class PracticeFieldSeamError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.practiceFieldSeam = true;
  }
}

function sessionOrThrow(etDate) {
  const s = getSessionForDate(etDate);
  if (!s) throw new PracticeFieldSeamError('calendar_unavailable', `the calendar of record cannot place ${etDate}`);
  return s;
}

/**
 * The close of the `n`-th trading session after the anchor session of `atMs` (the session holding it, else the next
 * one; the anchor is session 0), early closes honoured. Pure, epoch ms; throws calendar_unavailable off the calendar.
 */
export function closeOfSessionsAfter(atMs, n) {
  if (!Number.isFinite(atMs)) throw new PracticeFieldSeamError('invalid_nomination', 'the instant is not a finite epoch-ms number');
  if (!Number.isInteger(n) || n < 1) throw new PracticeFieldSeamError('invalid_nomination', 'the session count must be a positive integer');
  let etDate = ET_DATE.format(new Date(atMs));
  let anchored = false;
  for (let i = 0; i < MAX_WALK_DAYS && !anchored; i += 1) {
    const s = sessionOrThrow(etDate);
    if (s.isTradingDay && atMs < s.closeMs) anchored = true;
    else etDate = nextEtDate(etDate);
  }
  if (!anchored) throw new PracticeFieldSeamError('calendar_unavailable', 'no session found after the instant');
  let counted = 0;
  for (let i = 0; i < MAX_WALK_DAYS; i += 1) {
    etDate = nextEtDate(etDate);
    const s = sessionOrThrow(etDate);
    if (!s.isTradingDay) continue;
    counted += 1;
    if (counted === n) return s.closeMs;
  }
  throw new PracticeFieldSeamError('calendar_unavailable', `no ${n}th session within ${MAX_WALK_DAYS} days`);
}

const idOk = (v) => typeof v === 'string' && v.length > 0;

/** The default builder: contract V2 §5.2's record, `queued`. */
function defaultBuildNominationDoc({ entryId, situationId, questionId, questionVersion, nowIso, expiresAfterSessions }) {
  if (!idOk(entryId) || !idOk(situationId) || !idOk(questionId) || !Number.isInteger(questionVersion)) throw new PracticeFieldSeamError('invalid_nomination', 'the source reference is incomplete');
  const queuedMs = typeof nowIso === 'string' ? Date.parse(nowIso) : NaN;
  if (!Number.isFinite(queuedMs)) throw new PracticeFieldSeamError('invalid_nomination', 'nowIso is not an instant');
  const expiresAt = new Date(closeOfSessionsAfter(queuedMs, expiresAfterSessions)).toISOString();
  return {
    state: NOMINATION_QUEUED,
    source: { kind: NOMINATION_SOURCE_KIND, entryId, situationId, questionId, questionVersion },
    queuedAt: nowIso,
    expiresAt,
    stateHistory: [{ state: NOMINATION_QUEUED, at: nowIso }],
  };
}

/**
 * Amendment A CA-2 — the default withdrawal: the record as it stands, `state: 'withdrawn'`, `withdrawnAt`, and a
 * `stateHistory` row `{ state: 'withdrawn', at, by: 'player' }`. Pure — it runs inside the retire transaction. The
 * Practice Field owns the shape, as it owns buildNominationDoc's.
 */
function defaultBuildWithdrawal(record, { nowIso }) {
  const history = Array.isArray(record?.stateHistory) ? record.stateHistory : [];
  return { ...record, state: 'withdrawn', withdrawnAt: nowIso, stateHistory: [...history, { state: 'withdrawn', at: nowIso, by: 'player' }] };
}

/**
 * Amendment A CA-12 — the default: the book names the attribution agent in a field called `attributionAgentId`. Pure
 * (it runs inside the nominate and Offer transactions). T1a names the real field and replaces it.
 */
const defaultBookIsForAgent = (bookDoc, attributionAgentId) => bookDoc !== null && typeof bookDoc === 'object' && typeof bookDoc.attributionAgentId === 'string' && bookDoc.attributionAgentId.length > 0 && bookDoc.attributionAgentId === attributionAgentId;

/** The defaults: no book for anyone (no read at all), the contract's record, its withdrawal, and the book's agent. */
export const PRACTICE_FIELD_SEAM_DEFAULTS = Object.freeze({
  bookForOwner: async () => null,
  bookIsForAgent: defaultBookIsForAgent,
  buildNominationDoc: defaultBuildNominationDoc,
  buildWithdrawal: defaultBuildWithdrawal,
});

let live = { ...PRACTICE_FIELD_SEAM_DEFAULTS };

/** The owner's book for the attribution agent, `{ bookId, status }`, or null (the default until T1a). */
export const bookForOwner = (db, { uid, attributionAgentId }) => live.bookForOwner(db, { uid, attributionAgentId });

/** The nomination record, contract V2 §5.2's shape (the default until T2). */
export const buildNominationDoc = (args) => live.buildNominationDoc(args);

/** Amendment A CA-12: is this book document the attribution agent's? (the default until T1a replaces it) */
export const bookIsForAgent = (bookDoc, attributionAgentId) => live.bookIsForAgent(bookDoc, attributionAgentId);

/** Amendment A CA-2: the record withdrawn by the player's retire (the default until the Practice Field replaces it). */
export const buildWithdrawal = (record, opts) => live.buildWithdrawal(record, opts);

/** Is this process a test run (the vitest runner sets VITEST; production never does)? */
const isTestRun = () => typeof process !== 'undefined' && Boolean(process.env?.VITEST) && process.env?.NODE_ENV !== 'production';

/**
 * TESTS ONLY — swap either helper; returns the restore. Throws outside the vitest runner, so production can never
 * inject a book or a record shape.
 */
export function setPracticeFieldSeam(overrides = {}) {
  if (!isTestRun()) throw new Error('setPracticeFieldSeam is for tests only');
  const unknown = Object.keys(overrides).filter((k) => !Object.prototype.hasOwnProperty.call(PRACTICE_FIELD_SEAM_DEFAULTS, k));
  if (unknown.length) throw new Error(`setPracticeFieldSeam: unknown helper ${unknown.join(', ')}`);
  live = { ...live, ...overrides };
  return resetPracticeFieldSeam;
}

/** TESTS ONLY — back to the defaults. */
export function resetPracticeFieldSeam() {
  if (!isTestRun()) throw new Error('resetPracticeFieldSeam is for tests only');
  live = { ...PRACTICE_FIELD_SEAM_DEFAULTS };
}
