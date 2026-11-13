// api/_utils/sharedResearch/session.js
//
// Shared Research — THE HOST SESSION, pure (spec §5.1, §5.3, §6.3, §6.12).
// `sharedResearchSessions/{sessionId}`: server-written, owner-readable. This
// module shapes the document, builds its exchanges (each with its own
// `exchangeId`, minted when the object is built — contract §4), states the
// session's refusals, shapes the daily counts and the client's view. No I/O
// (the id minter is injectable for tests).
//
// Three fields beyond spec §5.1, all routine (build report "Routine choices"):
// `requestId` (the forge id a `frame` or item/drop `open` was sent with — the
// key that makes a retry find the session it made) and `itemKey`
// (`{recordKind}/{recordId}` of the entry's itemRef — the one equality the
// `existing` check queries), neither of which reaches the client; and
// `entry.names` (the names in scope the opening wrote facts for — the GET's
// unwritten ranking rows read them).

import { randomUUID } from 'node:crypto';
import { STEP_BUDGET, PER_DAY, FRAMINGS_PER_DAY, STEP_INTENTS } from '../../../src/constants/sharedResearch.js';
// The ET calendar date by Intl (America/New_York) — the same rule as mandateClosePass.js etDateOf (spec §5.3 names
// it), from the import-free intraday helper so the route does not load the mandate graph (parity pinned by test).
import { etDateOf as etDateOfMs } from '../intraday/etTime.js';
import { METHOD } from './method.js';

export const SESSIONS_COLLECTION = 'sharedResearchSessions';
export const QUOTA_COLLECTION = 'sharedResearchQuota';
/** The app-wide daily counts (spec §6.12 control 4) — a document id no Firebase uid can take. */
export const GLOBAL_QUOTA_ID = '_global';
export const SESSION_SCHEMA_VERSION = 1;
export const SESSION_STATUSES = Object.freeze(['framing', 'open', 'completed', 'abandoned', 'failed']);
export const EXCHANGE_KINDS = Object.freeze(['observation', 'frame', 'direction', 'step', 'turn', 'confirm', 'close']);
/** A `running` step older than this is treated as failed (spec §6.3 step). */
export const RUNNING_STALE_MS = 35_000;
/** An exchange's stored text, at most. */
export const EXCHANGE_TEXT_MAX = 2000;
/** The player's observation and direction: 1–500 characters after trim, `<>{}` stripped (spec §6.3 frame). */
export const OBSERVATION_MAX = 500;
export const DIRECTION_MAX = 500;

/** A typed refusal of a Shared Research action: `code` is what the client reads, `status` its HTTP status. */
export class SharedResearchError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.sharedResearch = true;
  }
}
export const refuse = (status, code, extra) => new SharedResearchError(status, code, extra);

/** The ET calendar date (YYYY-MM-DD) of an ISO instant. */
export const etDateOf = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? etDateOfMs(ms) : null;
};

/** The player's typed words as the server stores them: trimmed, `<>{}` stripped, 1–max characters; null when not. */
export function cleanPlayerText(raw, max = OBSERVATION_MAX) {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- control characters never reach a record
  const s = raw.replace(/[<>{}]/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return s.length > 0 && s.length <= max ? s : null;
}

/** `{recordKind}/{recordId}` — the entry's item, as one queryable value. */
export const itemKeyOf = (itemRef) => (itemRef && typeof itemRef.recordKind === 'string' && typeof itemRef.recordId === 'string'
  ? `${itemRef.recordKind}/${itemRef.recordId}`
  : null);

/**
 * One exchange, its id minted now (contract §4: before the write, so a retried
 * transaction sends the same object). Only the keys given are written — never
 * an undefined field.
 */
export function exchangeOf({ who, kind, text, at, stepId = null, intent = null, target = null, lines = null }, { mintId = randomUUID } = {}) {
  if (!['player', 'partner'].includes(who) || !EXCHANGE_KINDS.includes(kind)) throw new Error('sharedResearch: an exchange needs a known speaker and kind');
  const ex = { exchangeId: mintId(), who, kind, text: String(text ?? '').slice(0, EXCHANGE_TEXT_MAX), at };
  if (stepId) ex.stepId = stepId;
  if (intent) ex.intent = intent;
  if (target) ex.target = target;
  if (lines) ex.lines = lines;
  return ex;
}

const emptyRetrieval = () => ({ calls: 0, costDollars: 0, elapsedMs: 0 });

/** A new session in `framing` (an observation entry before its question is confirmed; spec routine 2). No record yet. */
export function framingSessionOf({ sessionId, userId, requestId, observation, playerExchange, nowIso }) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION, sessionId, userId, requestId, createdAt: nowIso, updatedAt: nowIso,
    status: 'framing',
    entry: { kind: 'observation', itemRef: null, observation, direction: null, topic: null, names: [] },
    itemKey: null,
    frame: null, lastError: null,
    exchanges: [playerExchange],
    stepsUsed: 0, stepBudget: STEP_BUDGET, lastStep: null,
    researchWorkId: null,
    retrieval: emptyRetrieval(),
    method: { id: METHOD.id, version: METHOD.version },
    attribution: null,
    adoption: null,
  };
}

/** A new session opened from an item or a drop (created at `open`, its record minted in the same transaction). */
export function openSessionOf({ sessionId, userId, requestId, entry, exchanges, attribution, researchWorkId, nowIso }) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION, sessionId, userId, requestId, createdAt: nowIso, updatedAt: nowIso,
    status: 'open',
    entry: {
      kind: entry.kind, itemRef: entry.itemRef ?? null, observation: entry.observation ?? null,
      direction: entry.direction ?? null, topic: entry.topic ?? null,
      names: Array.isArray(entry.names) ? entry.names : [],
    },
    itemKey: itemKeyOf(entry.itemRef),
    frame: null, lastError: null,
    exchanges,
    stepsUsed: 0, stepBudget: STEP_BUDGET, lastStep: null,
    researchWorkId,
    retrieval: emptyRetrieval(),
    method: { id: METHOD.id, version: METHOD.version },
    attribution,
    adoption: null,
  };
}

/** Is this stored session the caller's, and readable as a session? */
export const isOwnedSession = (s, uid) => s !== null && typeof s === 'object' && typeof uid === 'string' && uid.length > 0
  && s.userId === uid && SESSION_STATUSES.includes(s.status);

/** A `running` step that has outlived RUNNING_STALE_MS. */
export function isStaleRunning(lastStep, nowMs) {
  if (!lastStep || lastStep.status !== 'running') return false;
  const started = Date.parse(lastStep.startedAt);
  return !Number.isFinite(started) || nowMs - started > RUNNING_STALE_MS;
}

/**
 * What a `step` request meets on the session (spec §6.3), before any call:
 *   { replay: true }          the same stepId already completed — answer it, no model call
 *   { refuse: code }          session_not_open · budget_spent · step_in_flight
 *   { ok: true, rerun }       go (rerun: the same stepId failed or went stale — Try again)
 */
export function stepAdmissionOf(session, { stepId, nowMs }) {
  const last = session?.lastStep ?? null;
  if (last && last.stepId === stepId && last.status === 'completed') return { replay: true };
  if (session?.status !== 'open') return { refuse: 'session_not_open' };
  if (last && last.status === 'running' && !isStaleRunning(last, nowMs)) return { refuse: 'step_in_flight' };
  const used = Number.isSafeInteger(session.stepsUsed) ? session.stepsUsed : 0;
  const budget = Number.isSafeInteger(session.stepBudget) ? session.stepBudget : STEP_BUDGET;
  if (used >= budget) return { refuse: 'budget_spent' };
  return { ok: true, rerun: Boolean(last && last.stepId === stepId) };
}

export const isStepIntent = (v) => STEP_INTENTS.includes(v);

// ── the daily counts (spec §5.3, §6.12) ──────────────────────────────────────

const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);

/** A player's counts for `etDate` — reset when the stored day is another day. */
export function playerDayOf(doc, etDate) {
  const same = doc && doc.etDate === etDate;
  return { etDate, investigationsOpened: same ? count(doc.investigationsOpened) : 0, framingsRun: same ? count(doc.framingsRun) : 0 };
}

/** The app's counts for `etDate` — reset when the stored day is another day. */
export function globalDayOf(doc, etDate) {
  const same = doc && doc.etDate === etDate;
  return { etDate, steps: same ? count(doc.steps) : 0, framings: same ? count(doc.framings) : 0 };
}

/** The daily-limit line's numbers, as every answer carries them (spec §5.3). */
export const quotaViewOf = (day) => ({
  investigationsToday: count(day?.investigationsOpened), perDay: PER_DAY,
  framingsToday: count(day?.framingsRun), framingsPerDay: FRAMINGS_PER_DAY,
});

// ── what the client is shown ────────────────────────────────────────────────

/**
 * The session as the client reads it: never the exchange ids (contract §4: "no
 * response carries it"), the request key, the item key, the owner or the
 * retrieval tally. The provenance stamp is server-only too: the client neither
 * sets it nor needs it.
 */
export function sessionViewOf(s) {
  if (!s) return null;
  return {
    sessionId: s.sessionId,
    status: s.status,
    entry: s.entry ?? null,
    frame: s.frame ? { question: s.frame.question, check: s.frame.check, notEstablished: s.frame.notEstablished } : null,
    lastError: s.lastError ?? null,
    exchanges: (Array.isArray(s.exchanges) ? s.exchanges : []).map((ex) => {
      const v = { who: ex.who, kind: ex.kind, text: ex.text, at: ex.at };
      if (ex.stepId) v.stepId = ex.stepId;
      if (ex.intent) v.intent = ex.intent;
      if (ex.target) v.target = ex.target;
      return v;
    }),
    stepsUsed: count(s.stepsUsed),
    stepBudget: Number.isSafeInteger(s.stepBudget) ? s.stepBudget : STEP_BUDGET,
    lastStep: s.lastStep ?? null,
    researchWorkId: s.researchWorkId ?? null,
    adoption: s.adoption ?? null,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}

/** The latest step's line refs, stored on the last partner exchange that carries them (spec §6.7). */
export function latestLinesOf(session) {
  const exs = Array.isArray(session?.exchanges) ? session.exchanges : [];
  for (let i = exs.length - 1; i >= 0; i--) if (exs[i]?.who === 'partner' && exs[i].lines) return exs[i].lines;
  return { support: null, complication: null, missing: null };
}
