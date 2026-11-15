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

import { randomUUID, createHash } from 'node:crypto';
import { STEP_BUDGET, PER_DAY, FRAMINGS_PER_DAY, STEP_INTENTS, STEP_CALLS_PER_DAY } from '../../../src/constants/sharedResearch.js';
// The ET calendar date by Intl (America/New_York) — the same rule as mandateClosePass.js etDateOf (spec §5.3 names
// it), from the import-free intraday helper so the route does not load the mandate graph (parity pinned by test).
import { etDateOf as etDateOfMs } from '../intraday/etTime.js';
import { BASELINE, methodStampOf, methodKeyOf, methodRefOf } from './method.js';

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
 * an undefined field. KB-1 (Amendment A §A4.3, §A4.4): a partner turn's
 * `method` (the method it ran on), `methodChange` (only when it differs from
 * the previous partner turn's), a step's `findingIds` (the findings it
 * appended, in order) and `retrieval` (what it was shown); a confirming
 * exchange's `methodsUsed`. None of them reaches the client (sessionViewOf).
 */
export function exchangeOf({
  who, kind, text, at, stepId = null, intent = null, target = null, lines = null,
  method = null, methodChange = null, findingIds = null, retrieval = null, methodsUsed = null,
}, { mintId = randomUUID } = {}) {
  if (!['player', 'partner'].includes(who) || !EXCHANGE_KINDS.includes(kind)) throw new Error('sharedResearch: an exchange needs a known speaker and kind');
  const ex = { exchangeId: mintId(), who, kind, text: String(text ?? '').slice(0, EXCHANGE_TEXT_MAX), at };
  if (stepId) ex.stepId = stepId;
  if (intent) ex.intent = intent;
  if (target) ex.target = target;
  if (lines) ex.lines = lines;
  if (method) ex.method = method;
  if (methodChange) ex.methodChange = methodChange;
  if (findingIds) ex.findingIds = findingIds;
  if (retrieval) ex.retrieval = retrieval;
  if (methodsUsed) ex.methodsUsed = methodsUsed;
  return ex;
}

// ── the method on every turn (Amendment A §A4.3, KB-1) ────────────────────────

const isPartnerTurn = (e) => e?.who === 'partner' && (e.kind === 'frame' || e.kind === 'step');
const isText = (v) => typeof v === 'string' && v.length > 0;
/** A recorded method (an exchange's `method`, or a stamp) as written, when it is whole: id, version, sha256, a known source. */
const recordedMethodOf = (m) => (m && typeof m === 'object' && isText(m.id) && isText(m.version) && isText(m.sha256) && (m.source === 'kb' || m.source === 'baseline')
  ? methodRefOf(m) : null);
/**
 * The method an exchange records, as recorded. An exchange written before KB-1
 * (no `method`, or no `source`) — or one whose record is not whole — reads as
 * the baseline.
 */
export const exchangeMethodOf = (ex) => recordedMethodOf(ex?.method) ?? methodRefOf(BASELINE);
const sameMethod = (a, b) => a.id === b.id && a.version === b.version && a.sha256 === b.sha256 && a.source === b.source;

/**
 * `{ from, to, reason }` when this turn's method differs from the previous
 * partner turn's (a frame or a step), else null — and null when there is no
 * previous partner turn (the letter of the build prompt; a KB stamp whose FIRST
 * turn falls back records its baseline `method` but no reason — founder
 * question FQ-2). `reason` is the refusal that put this turn on the baseline; a
 * turn back on its KB method has none (null).
 */
export function methodChangeOf(exchanges, method, refusal = null) {
  const prior = (Array.isArray(exchanges) ? exchanges : []).filter(isPartnerTurn).at(-1);
  if (!prior) return null;
  const was = exchangeMethodOf(prior);
  const now = methodRefOf(method);
  return sameMethod(was, now) ? null : { from: methodKeyOf(was), to: methodKeyOf(now), reason: typeof refusal === 'string' && refusal ? refusal : null };
}

/**
 * The confirming exchange's `methodsUsed`: the distinct methods of the partner
 * turns whose `findingIds` hold a kept finding, first seen walking those turns
 * in order (the order the investigation ran — never the player's symbol order).
 * A kept finding written by code at `open` belongs to no turn and contributes
 * none.
 */
export function methodsUsedOf(exchanges, keptFindingIds) {
  const kept = new Set(Array.isArray(keptFindingIds) ? keptFindingIds : []);
  const out = [];
  for (const ex of Array.isArray(exchanges) ? exchanges : []) {
    if (!isPartnerTurn(ex) || !Array.isArray(ex.findingIds) || !ex.findingIds.some((id) => kept.has(id))) continue;
    const m = exchangeMethodOf(ex);
    if (!out.some((o) => sameMethod(o, m))) out.push(m);
  }
  return out;
}

/** SHA-256 (hex) of the retained text: the title, a newline, the highlights joined by newlines. It identifies; it does not preserve. */
export const seenSha256Of = (title, highlights) => createHash('sha256').update(`${title}\n${highlights.join('\n')}`, 'utf8').digest('hex');

/**
 * What a step that retrieved keeps (Amendment A §A4.4, R-KB-4): every item the
 * partner was shown (`items`: the prompt budget's kept items, in the order
 * shown), each with its title and highlights as given to the prompt (B1's
 * bounds: 300 characters; 2 highlights of 600 — the prompt renders them with
 * whitespace collapsed and tickers outside the game universe masked — the
 * record keeps the text before that rendering), the provider's publishedDate as
 * the step was given it (null when it gave none; a date later than the read is
 * treated as absent, spec §16 FQ-2, and the prompt showed "no date"), the hash
 * of that text, and the findings of this step that cite it. The retained text
 * is the record.
 */
export function retainedRetrievalOf({ readAt, items, findings }) {
  const list = Array.isArray(findings) ? findings : [];
  const citing = (url) => list.filter((f) => f?.source?.recordKind === 'retrieval' && f.source.url === url).map((f) => f.findingId);
  const dateOf = (it) => (typeof it.publishedDate === 'string' && it.publishedDate ? it.publishedDate : null);
  return {
    readAt,
    items: (Array.isArray(items) ? items : []).map((it) => {
      const title = typeof it.title === 'string' ? it.title : '';
      const highlights = (Array.isArray(it.highlights) ? it.highlights : []).filter((h) => typeof h === 'string');
      return {
        index: it.index, url: it.url, host: typeof it.host === 'string' ? it.host : null, title, highlights,
        publishedDate: dateOf(it), seenSha256: seenSha256Of(title, highlights), findingIds: citing(it.url),
      };
    }),
  };
}

const emptyRetrieval = () => ({ calls: 0, costDollars: 0, elapsedMs: 0 });
/** A session's stamp when none is given: the baseline, selected now (tests; the route always passes one). */
const baselineStampAt = (nowIso) => methodStampOf(BASELINE, { selectedAt: nowIso });

/**
 * A new session in `framing` (an observation entry before its question is confirmed; spec routine 2). No record yet.
 * `method`: the stamp selectMethod chose (KB-1) — written here once, never rewritten.
 */
export function framingSessionOf({ sessionId, userId, requestId, observation, playerExchange, nowIso, method = null }) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION, sessionId, userId, requestId, createdAt: nowIso, updatedAt: nowIso,
    status: 'framing',
    entry: { kind: 'observation', itemRef: null, observation, direction: null, topic: null, names: [] },
    itemKey: null,
    frame: null, lastError: null, framingStartedAt: nowIso,
    exchanges: [playerExchange],
    stepsUsed: 0, stepBudget: STEP_BUDGET, lastStep: null,
    researchWorkId: null,
    retrieval: emptyRetrieval(),
    method: method ?? baselineStampAt(nowIso),
    attribution: null,
    adoption: null,
  };
}

/**
 * A new session opened from an item or a drop (created at `open`, its record minted in the same transaction).
 * `method`: the baseline stamp selectMethod gives a story or a drop (KB-1).
 */
export function openSessionOf({ sessionId, userId, requestId, entry, exchanges, attribution, researchWorkId, nowIso, method = null }) {
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
    method: method ?? baselineStampAt(nowIso),
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
  // Any earlier step that completed under this stepId — its partner exchange is on the session — is a replay too
  // (review A3). A failed step left at most the player's direction exchange, so it stays retryable.
  const exchanges = Array.isArray(session?.exchanges) ? session.exchanges : [];
  if (exchanges.some((e) => e?.who === 'partner' && e.kind === 'step' && e.stepId === stepId)) return { replay: true };
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

/** A player's counts for `etDate` — reset when the stored day is another day. `stepCalls`: step model calls made today. */
export function playerDayOf(doc, etDate) {
  const same = doc && doc.etDate === etDate;
  return {
    etDate, investigationsOpened: same ? count(doc.investigationsOpened) : 0, framingsRun: same ? count(doc.framingsRun) : 0,
    stepCalls: same ? count(doc.stepCalls) : 0,
  };
}

/** The app's counts for `etDate` — reset when the stored day is another day. `steps` persisted, `stepCalls` made. */
export function globalDayOf(doc, etDate) {
  const same = doc && doc.etDate === etDate;
  return { etDate, steps: same ? count(doc.steps) : 0, framings: same ? count(doc.framings) : 0, stepCalls: same ? count(doc.stepCalls) : 0 };
}

/** The daily-limit line's numbers, as every answer carries them (spec §5.3; the step calls added by the review, C2). */
export const quotaViewOf = (day) => ({
  investigationsToday: count(day?.investigationsOpened), perDay: PER_DAY,
  framingsToday: count(day?.framingsRun), framingsPerDay: FRAMINGS_PER_DAY,
  stepsToday: count(day?.stepCalls), stepsPerDay: STEP_CALLS_PER_DAY,
});

/**
 * A framing whose model call may still be running (review A2): no frame yet, no recorded failure, and started within
 * RUNNING_STALE_MS. A repeated requestId waits on it instead of paying for a second call.
 */
export function isFramingInFlight(session, nowMs) {
  if (session?.status !== 'framing' || session.frame || session.lastError) return false;
  const started = Date.parse(session.framingStartedAt ?? session.createdAt);
  return Number.isFinite(started) && nowMs - started <= RUNNING_STALE_MS;
}

// ── an earlier investigation of the same item (spec §16 FQ-1) ──────────────────

/** The statuses an investigation has ENDED in: concluded or saved as an idea (`completed`), or `abandoned`. */
export const ENDED_STATUSES = Object.freeze(['completed', 'abandoned']);
/** Only an OPEN investigation of the same item answers `existing`; an ended one allows a new one (spec §16 FQ-1). */
export const LIVE_STATUSES = Object.freeze(['open']);

const newestFirst = (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
/** Newest created first, then newest updated: one item's investigations never overlap (only one is open at a time). */
const newestCreatedFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : newestFirst(a, b));

/** The newest OPEN investigation among the owner's sessions on one item, or null. */
export const liveSessionOf = (sessions) => (Array.isArray(sessions) ? sessions : []).filter((s) => s && LIVE_STATUSES.includes(s.status)).sort(newestFirst)[0] ?? null;

/**
 * The newest ENDED investigation among the owner's sessions on one item that
 * came before `current` — never `current` itself (excluded by its sessionId).
 * "Before" is created at or before `current`'s createdAt: a session created in
 * the same millisecond as `current`, other than `current` itself, counts as
 * earlier (a strict `<` lost the earlier one when two creations shared a
 * millisecond). "Newest" is the last created: an item's investigations run one after another
 * (only an open one answers `existing`), so the last created is the last to
 * end — and a late write to an ended session (a step failure landing after its
 * close) cannot reorder them (refuter SI-1). Null when there is none. Sorted in
 * memory: the read is an equality-only query (no index).
 * @param {object[]} sessions   the owner's sessions with this itemKey
 * @param {{ sessionId: string, createdAt: string }} current
 */
export function previousSessionOf(sessions, { sessionId, createdAt }) {
  return (Array.isArray(sessions) ? sessions : [])
    .filter((s) => s && ENDED_STATUSES.includes(s.status) && s.sessionId !== sessionId && typeof s.createdAt === 'string' && s.createdAt <= createdAt)
    .sort(newestCreatedFirst)[0] ?? null;
}

/** What the sheet needs to offer "Open the earlier one": `{ sessionId, endedAt, terminalReason }`, from its record. */
export function previousViewOf(session, record) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    endedAt: typeof record?.endedAt === 'string' ? record.endedAt : (session.updatedAt ?? null),
    terminalReason: typeof record?.terminalReason === 'string' ? record.terminalReason : null,
  };
}

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
