// api/_utils/hypothesisRecords/model.js
//
// Pilot P1a — THE HYPOTHESIS VERSION RECORD (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §2.1, §2.2,
// §2.5; founder decision D1, 7 Oct 2026). PURE: no I/O, no clock.
//
// A player's idea lives at `watchlists/{watchlistId}/hypothesisVersions/v{n}`,
// owned by the player (the parent list's `userId`). The list's `agentId` is
// provenance and is never read here. A version document has three parts:
//
//   IDENTITY (write-once)   version, watchlistId, userId (denormalized from the
//                           parent for collection-group reads), opId,
//                           opFingerprint, createdAt
//   CONTENT (write-once,    statement, horizonEnum, horizonSource, activation[],
//   hashed into contentHash) invalidation[], evidenceRefs[], publishedAt, origin
//   LIFECYCLE (mutable,     status, stateChangedAt, stateSource, stateReason,
//   never hashed)           missingEvidence, successorVersion, firstDeployedAt,
//                           lastDeployedAt, lastDeployedBattleId, reviewDueAt
//
// `opFingerprint` is the hash of the creating REQUEST (its kind and payload as
// sent), so a replay of the same `opId` is recognised as the same request even
// after the record's lifecycle moved — the spec's "same opId with the same
// payload returns the existing version". It is identity, never content.
//
// Editing content ALWAYS means a new version: nothing here (or in any route)
// rewrites a content field. The four deploy fields are defined now and written
// by P1b; they are null on every version this build creates.

import { canonicalContentHash } from '../canonicalHash.js';
// The vocabulary the Forge renders from — statuses, horizons, the transition
// table — lives in ONE Node-clean src/ module (BUILD_RULES §4; this file's
// test imports are the dependency-surface guard) and is re-exported here.
import {
  HYPOTHESIS_STATUSES, TERMINAL_STATUSES, PRE_DEPLOY_STATUSES, HORIZON_ENUMS, HORIZON_SOURCES, STATE_REASONS,
  PLAYER_TRANSITIONS, PLAYER_ACTIONS, CLOSING_ACTIONS, legalTransition, legalActionsFor,
  // Pilot P1b (founder rulings B2, B4).
  REAFFIRM_SUCCESSOR_STATUSES, CARRIABLE_STATUSES, reaffirmableGiven,
} from '../../../src/constants/hypothesisRecords.js';

// Pilot P2: a version cites the research behind it as a typed evidence ref
// `{ kind: 'researchWork', id }` (the research record's id scheme lives there).
// The Research Record Extension (7 Nov 2026) adds two more kinds — an item of
// a source record, and a host session's exchange — whose record kinds, host
// collections and id shapes are the research record's own.
import {
  RESEARCH_EVIDENCE_KIND, isResearchWorkId, researchRefOf, isRecordRef, HOST_COLLECTIONS, isHostId, isUuid,
  RECORD_ID_MAX_LEN, EVIDENCE_ITEM_RECORD_KINDS, RESEARCH_WORK_RECORD_KIND, isFindingId, researchWorkIdFor,
  SHARED_RESEARCH_ORIGIN, RESEARCH_STATES, currentFindingsOf,
} from '../researchRecords/model.js';
import { stableStringify } from '../canonicalHash.js';

export {
  HYPOTHESIS_STATUSES, TERMINAL_STATUSES, PRE_DEPLOY_STATUSES, HORIZON_ENUMS, HORIZON_SOURCES, STATE_REASONS,
  PLAYER_TRANSITIONS, PLAYER_ACTIONS, CLOSING_ACTIONS, legalTransition, legalActionsFor,
  // Pilot P1b (founder rulings B2, B4).
  REAFFIRM_SUCCESSOR_STATUSES, CARRIABLE_STATUSES, reaffirmableGiven,
};

export const WATCHLISTS_COLLECTION = 'watchlists';
export const VERSIONS_SUBCOLLECTION = 'hypothesisVersions';

/**
 * Where an idea came from — always DERIVED (originOf, buildSaveVersion), never
 * sent by a caller. `shared_research` (the Research Record Extension): a list
 * carrying the server-written SHARED_RESEARCH_LIST_MARKER. `huddle` and
 * `reporter` arrive with the first build that creates a list from that source;
 * until then their influence on a version is recorded through evidenceRefs.
 */
export const ORIGINS = Object.freeze(['signaldrop', 'theme', 'screener', 'manual', 'shared_research']);
/** The list field, server-written by the Shared Research route at save, that makes a list's origin `shared_research`. */
export const SHARED_RESEARCH_LIST_MARKER = 'sourceSharedResearchSessionId';
export const STATE_SOURCES = Object.freeze(['player', 'research', 'deploy', 'review_pass']);
export const CONDITION_SIDES = Object.freeze(['above', 'below']);
export const CONDITION_BASES = Object.freeze(['daily_close']);

export const CONTENT_FIELDS = Object.freeze([
  'statement', 'horizonEnum', 'horizonSource', 'activation', 'invalidation', 'evidenceRefs', 'publishedAt', 'origin',
]);
export const LIFECYCLE_FIELDS = Object.freeze([
  'status', 'stateChangedAt', 'stateSource', 'stateReason', 'missingEvidence', 'successorVersion',
  'firstDeployedAt', 'lastDeployedAt', 'lastDeployedBattleId', 'reviewDueAt',
]);
export const IDENTITY_FIELDS = Object.freeze(['version', 'watchlistId', 'userId', 'opId', 'opFingerprint', 'createdAt']);

/** The statement cap — the dialogue anatomy's own thesis cap (watchlist-dialogue.js ANATOMY_THESIS_MAX_LEN). */
export const STATEMENT_MAX_LEN = 1000;
export const MISSING_EVIDENCE_MAX_LEN = 300;
export const CONDITIONS_MAX_COUNT = 10;
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;

export const versionDocId = (n) => `v${n}`;

/** A typed validation failure: `code` is the route's 400 error string. */
export class HypothesisInputError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.hypothesisInput = true;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** A positive integer (a version number). */
export const isVersionNumber = (v) => Number.isInteger(v) && v > 0;

/** The statement: a non-empty string after trimming, at most STATEMENT_MAX_LEN. Throws invalid_statement. */
export function normalizeStatement(raw) {
  if (typeof raw !== 'string') throw new HypothesisInputError('invalid_statement', 'statement must be a string.');
  const s = raw.trim();
  if (!s) throw new HypothesisInputError('invalid_statement', 'statement must not be empty.');
  if (s.length > STATEMENT_MAX_LEN) throw new HypothesisInputError('invalid_statement', `statement must be at most ${STATEMENT_MAX_LEN} characters.`);
  return s;
}

/** One condition `{symbol, side, level, basis}`, validated (never coerced beyond trimming and upper-casing the symbol). */
export function normalizeCondition(raw) {
  if (!isPlainObject(raw)) throw new HypothesisInputError('invalid_condition', 'each condition must be an object.');
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim().toUpperCase() : '';
  if (!SYMBOL_RE.test(symbol)) throw new HypothesisInputError('invalid_condition', 'condition symbol is malformed.');
  if (!CONDITION_SIDES.includes(raw.side)) throw new HypothesisInputError('invalid_condition', "condition side must be 'above' or 'below'.");
  if (typeof raw.level !== 'number' || !Number.isFinite(raw.level) || raw.level <= 0) throw new HypothesisInputError('invalid_condition', 'condition level must be a positive number.');
  if (!CONDITION_BASES.includes(raw.basis)) throw new HypothesisInputError('invalid_condition', "condition basis must be 'daily_close'.");
  const extra = Object.keys(raw).filter((k) => !['symbol', 'side', 'level', 'basis'].includes(k));
  if (extra.length) throw new HypothesisInputError('invalid_condition', `unknown condition field(s): ${extra.join(', ')}.`);
  return { symbol, side: raw.side, level: raw.level, basis: raw.basis };
}

/** A condition array (empty allowed). Throws invalid_condition. */
export function normalizeConditions(raw) {
  if (!Array.isArray(raw)) throw new HypothesisInputError('invalid_condition', 'conditions must be an array.');
  if (raw.length > CONDITIONS_MAX_COUNT) throw new HypothesisInputError('invalid_condition', `at most ${CONDITIONS_MAX_COUNT} conditions.`);
  return raw.map(normalizeCondition);
}

/** The missing-evidence note a waiting_for_evidence transition requires. Throws missing_evidence_required. */
export function normalizeMissingEvidence(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) throw new HypothesisInputError('missing_evidence_required', 'Name the missing evidence.');
  if (s.length > MISSING_EVIDENCE_MAX_LEN) throw new HypothesisInputError('missing_evidence_required', `missingEvidence must be at most ${MISSING_EVIDENCE_MAX_LEN} characters.`);
  return s;
}

/** An evidence ref's kind. Closed: grows only with a new schema version. */
export const EVIDENCE_ITEM_KIND = 'evidenceItem';
export const EXCHANGE_EVIDENCE_KIND = 'exchange';
export const EVIDENCE_REF_KINDS = Object.freeze([RESEARCH_EVIDENCE_KIND, EVIDENCE_ITEM_KIND, EXCHANGE_EVIDENCE_KIND]);
/** Each kind's keys, exactly — the canonical form the content hash covers (every key present, `itemId` null for a whole record). */
export const EVIDENCE_REF_KEYS = Object.freeze({
  [RESEARCH_EVIDENCE_KIND]: Object.freeze(['kind', 'id']),
  [EVIDENCE_ITEM_KIND]: Object.freeze(['kind', 'recordKind', 'recordId', 'itemId']),
  [EXCHANGE_EVIDENCE_KIND]: Object.freeze(['kind', 'hostCollection', 'hostId', 'exchangeId']),
});
const HOST_COLLECTION_NAMES = Object.freeze(Object.values(HOST_COLLECTIONS));
const exactKeys = (r, keys) => Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));
const isItemId = (v) => v === null || (typeof v === 'string' && v.length > 0 && v.length <= RECORD_ID_MAX_LEN && !/[\u0000-\u001f\u007f]/.test(v)); // eslint-disable-line no-control-regex
/**
 * The most refs ONE server batch may carry (follow-up ruling Q10b: a battle's copy stays small) — what
 * serverEvidenceRefsOf accepts, and so every ref of an adopted first version (buildSharedResearchVersion).
 * It does not cap a version's total: createPlayerVersion also merges the list's research refs, uncapped
 * as before this extension (review V2B-3; a question for the Command Center arc's B1).
 */
export const SERVER_EVIDENCE_REFS_MAX = 30;

/**
 * One evidence ref, exactly its kind's keys:
 *   { kind: 'researchWork', id }                              a research record (Pilot P2)
 *   { kind: 'evidenceItem', recordKind, recordId, itemId }    an item of a source record — for a
 *       symbolDayEvidence news item, recordId `{etDate}_{SYMBOL}` and itemId its newsId; for a
 *       finding, recordKind 'researchWork', recordId the research record and itemId the findingId;
 *       itemId null for the whole record. Never an `exchange` or a `retrieval` (follow-up ruling Q1).
 *   { kind: 'exchange', hostCollection, hostId, exchangeId }  one exchange of a host session (the extension)
 * Refs are SERVER-merged: no route accepts one from a caller.
 */
export function isEvidenceRef(r) {
  if (!isPlainObject(r) || !EVIDENCE_REF_KINDS.includes(r.kind) || !exactKeys(r, EVIDENCE_REF_KEYS[r.kind])) return false;
  if (r.kind === RESEARCH_EVIDENCE_KIND) return isResearchWorkId(r.id);
  if (r.kind === EVIDENCE_ITEM_KIND) {
    if (!EVIDENCE_ITEM_RECORD_KINDS.includes(r.recordKind) || !isRecordRef(r.recordKind, r.recordId)) return false;
    return r.recordKind === RESEARCH_WORK_RECORD_KIND ? (r.itemId === null || isFindingId(r.itemId)) : isItemId(r.itemId);
  }
  return HOST_COLLECTION_NAMES.includes(r.hostCollection) && isHostId(r.hostId) && isUuid(r.exchangeId);
}

/** A valid ref in its canonical form: a fresh object with exactly its kind's keys, in the table's order. */
export function canonicalEvidenceRef(r) {
  if (!isEvidenceRef(r)) throw new HypothesisInputError('invalid_evidence_refs');
  return Object.fromEntries(EVIDENCE_REF_KEYS[r.kind].map((k) => [k, r[k]]));
}

/** The ref citing one item of a source record (itemId null → the whole record). Throws on a malformed one. */
export const evidenceItemRefOf = ({ recordKind, recordId, itemId = null }) => canonicalEvidenceRef({ kind: EVIDENCE_ITEM_KIND, recordKind, recordId, itemId });
/** The ref citing one exchange of a host session. Throws on a malformed one. */
export const exchangeRefOf = ({ hostCollection, hostId, exchangeId }) => canonicalEvidenceRef({ kind: EXCHANGE_EVIDENCE_KIND, hostCollection, hostId, exchangeId });

/** Union of evidence-ref lists, first-seen order, each ref once (by its canonical form); a malformed entry is dropped. */
export function mergeEvidenceRefs(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const r of Array.isArray(list) ? list : []) {
      if (!isEvidenceRef(r)) continue;
      const ref = canonicalEvidenceRef(r);
      const key = stableStringify(ref);
      if (!seen.has(key)) { seen.add(key); out.push(ref); }
    }
  }
  return out;
}

/**
 * The SERVER's refs for a version it saves (the Shared Research route's
 * helper): each validated — one malformed ref refuses the whole list
 * (invalid_evidence_refs), never silently drops a citation — and canonical.
 * At most SERVER_EVIDENCE_REFS_MAX (too_many_evidence_refs; follow-up Q10b).
 */
export function serverEvidenceRefsOf(refs) {
  if (!Array.isArray(refs)) throw new HypothesisInputError('invalid_evidence_refs');
  if (refs.length > SERVER_EVIDENCE_REFS_MAX) throw new HypothesisInputError('too_many_evidence_refs', `at most ${SERVER_EVIDENCE_REFS_MAX} evidence refs.`);
  return refs.map(canonicalEvidenceRef);
}

/**
 * The content object, validated in full. Every field is required here — the
 * callers resolve inheritance first. Throws HypothesisInputError.
 */
export function buildContent(c) {
  if (!isPlainObject(c)) throw new HypothesisInputError('invalid_content');
  if (!HORIZON_ENUMS.includes(c.horizonEnum)) throw new HypothesisInputError('invalid_horizon', `horizonEnum must be one of ${HORIZON_ENUMS.join(', ')}.`);
  if (!HORIZON_SOURCES.includes(c.horizonSource)) throw new HypothesisInputError('invalid_horizon', 'horizonSource is not a known source.');
  if (!ORIGINS.includes(c.origin)) throw new HypothesisInputError('invalid_origin');
  if (!Array.isArray(c.evidenceRefs) || !c.evidenceRefs.every(isEvidenceRef)) throw new HypothesisInputError('invalid_evidence_refs');
  if (!(c.publishedAt === null || nonEmptyString(c.publishedAt))) throw new HypothesisInputError('invalid_published_at');
  return {
    statement: normalizeStatement(c.statement),
    horizonEnum: c.horizonEnum,
    horizonSource: c.horizonSource,
    activation: normalizeConditions(c.activation),
    invalidation: normalizeConditions(c.invalidation),
    evidenceRefs: c.evidenceRefs.map(canonicalEvidenceRef),
    publishedAt: c.publishedAt,
    origin: c.origin,
  };
}

/** The content of a stored version (exactly CONTENT_FIELDS — what contentHash covers). */
export function contentOf(version) {
  const v = isPlainObject(version) ? version : {};
  return Object.fromEntries(CONTENT_FIELDS.map((k) => [k, v[k]]));
}

/** contentHash = canonicalContentHash over exactly the eight content fields (canonicalHash.js). */
export function contentHashOf(content) {
  return canonicalContentHash(contentOf(content));
}

/** The creating request's fingerprint (identity; never content). */
export function opFingerprintOf({ kind, payload }) {
  return canonicalContentHash({ kind, payload });
}

/**
 * A complete version document. `createdAt` is also the first `stateChangedAt`.
 * The deploy fields and the successor pointer start null.
 */
export function buildVersionDoc({ version, watchlistId, userId, opId, opFingerprint, createdAt, content, status, stateSource, stateReason }) {
  if (!isVersionNumber(version)) throw new Error('hypothesisRecords: version must be a positive integer');
  if (!nonEmptyString(watchlistId) || !nonEmptyString(userId) || !nonEmptyString(opId) || !nonEmptyString(opFingerprint) || !nonEmptyString(createdAt)) {
    throw new Error('hypothesisRecords: identity fields are required');
  }
  if (!HYPOTHESIS_STATUSES.includes(status) || !STATE_SOURCES.includes(stateSource) || !nonEmptyString(stateReason)) {
    throw new Error('hypothesisRecords: a typed initial state is required');
  }
  const c = buildContent(content);
  return {
    version, watchlistId, userId, opId, opFingerprint, createdAt,
    ...c,
    contentHash: contentHashOf(c),
    status, stateChangedAt: createdAt, stateSource, stateReason,
    missingEvidence: null, successorVersion: null,
    firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
  };
}

/**
 * The parent list's pointer: 0 when the list has no version yet. A present but
 * malformed pointer is a corrupt parent (never silently reset to 0 — that
 * would let allocation overwrite v1).
 * @returns {number}
 */
export function currentVersionOf(watchlist) {
  const p = isPlainObject(watchlist) ? watchlist.currentHypothesisVersion : undefined;
  if (p === undefined || p === null) return 0;
  if (!isVersionNumber(p)) throw new Error('hypothesisRecords: the parent pointer is corrupt');
  return p;
}

/**
 * A list saved from a DIALOGUE session: it names the session and the drop
 * that started it (the save path writes both, server-trusted). Pilot P2: a
 * list saved from a screener session also names its session in
 * `sourceSessionId` (a researchSessions id) but never a drop — so the session
 * id alone no longer says "dialogue".
 */
export const isDialogueList = (watchlist) => isPlainObject(watchlist)
  && nonEmptyString(watchlist.sourceSessionId) && nonEmptyString(watchlist.sourceDropId);

/**
 * The origin of a saved list (spec §2.8), from the list itself and — for a
 * dialogue list — the dialogue session's own discriminant (`source: 'theme'`
 * lives only on the session; a paste session carries none). A list linked to
 * a screener session (P2) is screener-origin even when its screen spec was
 * dropped by the size guard.
 *
 * The Research Record Extension: a list carrying the server-written marker
 * `sourceSharedResearchSessionId` is `shared_research` — checked FIRST, before
 * every existing branch. No caller ever supplies an origin.
 */
export function originOf(watchlist, session = null) {
  const w = isPlainObject(watchlist) ? watchlist : {};
  if (nonEmptyString(w[SHARED_RESEARCH_LIST_MARKER])) return 'shared_research';
  if (isDialogueList(w)) return isPlainObject(session) && session.source === 'theme' ? 'theme' : 'signaldrop';
  if (w.sourceScreenSpec != null || nonEmptyString(w.sourceSessionId)) return 'screener';
  return 'manual';
}

/**
 * The horizon a session carries (spec §2.5): a theme session is the constant
 * `unspecified` (`theme_default`); a paste session carries the parse's
 * `timeHorizon` (`parse`) — validated against the enum, and `unspecified` /
 * `default` when the session has no usable parse (never guessed).
 */
export function sessionHorizonOf(session) {
  const s = isPlainObject(session) ? session : {};
  if (s.source === 'theme') return { horizonEnum: 'unspecified', horizonSource: 'theme_default' };
  const h = s.parseResult?.parse?.timeHorizon;
  return HORIZON_ENUMS.includes(h) ? { horizonEnum: h, horizonSource: 'parse' } : { horizonEnum: 'unspecified', horizonSource: 'default' };
}

/**
 * The automatic v1 at dialogue save (the build prompt; spec §2.5, §2.8): the
 * anatomy thesis as the statement, the session's horizon, status `researched`
 * with reason `dialogue_completed` — the completed dialogue IS the research.
 * Pilot P2: when the session carries a research record, v1 cites it
 * (`evidenceRefs: [{ kind: 'researchWork', id }]`); with none, v1 cites
 * nothing, exactly as before. Null when the thesis is empty (no version).
 */
export function buildSaveVersion({ session, watchlistId, userId, sessionId, nowIso, researchWorkId = null }) {
  const thesis = isPlainObject(session?.anatomy) && typeof session.anatomy.thesis === 'string' ? session.anatomy.thesis.trim() : '';
  if (!thesis) return null;
  const origin = session.source === 'theme' ? 'theme' : 'signaldrop';
  const opId = `save_${sessionId}`;
  return buildVersionDoc({
    version: 1, watchlistId, userId, opId,
    opFingerprint: opFingerprintOf({ kind: 'save', payload: { sessionId } }),
    createdAt: nowIso,
    content: {
      statement: thesis.slice(0, STATEMENT_MAX_LEN),
      ...sessionHorizonOf(session),
      activation: [], invalidation: [],
      evidenceRefs: researchWorkId === null ? [] : [researchRefOf(researchWorkId)],
      publishedAt: null, origin,
    },
    status: 'researched', stateSource: 'research', stateReason: STATE_REASONS.dialogueCompleted,
  });
}

/**
 * The Research Record Extension follow-up (§4; concept
 * SHARED_RESEARCH_WORK_AN_IDEA_CONCEPT_V1 §4.6) — the FIRST version an adopted
 * Shared Research investigation creates. PURE. Like the dialogue's automatic
 * v1 it is born `researched` (stateSource 'research', reason
 * `shared_research_completed`); "use it in my next game" is the existing
 * `ready` action (researched → ready). No route calls this yet (the Command
 * Center arc's B1).
 *
 * Refused (HypothesisInputError):
 *   list_not_from_session   the list is not this owner's, not `shared_research`
 *                           by origin, or its marker names another session
 *   record_not_from_session the record is not this owner's `shared_research`
 *                           record for this session (`sr_<sessionId>`)
 *   record_not_open         the record is not open (adoption closes it; a
 *                           closed investigation is read-only)
 *   question_missing        the record has no question
 *   invalid_kept_findings   keptFindingIds empty, repeated, or naming anything
 *                           that is not a CURRENT finding on the record
 *   plus buildContent's own refusals (a statement over the cap is refused,
 *   never cut; a horizon outside the enum; a malformed condition) and
 *   serverEvidenceRefsOf's (a malformed exchange id; more than 30 refs, i.e.
 *   more than 28 kept findings).
 *
 * evidenceRefs, in order: the research record; each kept finding as an
 * evidence item of that record; the confirming exchange. The fingerprint
 * covers everything the player previewed.
 */
export function buildSharedResearchVersion({
  list, watchlistId, record, userId, sessionId, statement, horizonEnum, activation = [], invalidation = [],
  keptFindingIds, confirmExchangeId, nowIso,
}) {
  const fail = (code) => new HypothesisInputError(code);
  // The list is the owner's Shared Research list for this session — and the very list the version is
  // written under (review V2A-3: `watchlistId` is never trusted apart from the list it names).
  if (!isPlainObject(list) || list.userId !== userId || list.watchlistId !== watchlistId || originOf(list) !== SHARED_RESEARCH_ORIGIN
    || list[SHARED_RESEARCH_LIST_MARKER] !== sessionId) throw fail('list_not_from_session');
  let recordId = null;
  try { recordId = researchWorkIdFor({ collection: 'sharedResearchSessions', id: sessionId }); } catch { /* a malformed session id names no record */ }
  if (!isPlainObject(record) || recordId === null || record.researchWorkId !== recordId || record.userId !== userId
    || record.origin !== SHARED_RESEARCH_ORIGIN || !RESEARCH_STATES.includes(record.state)) throw fail('record_not_from_session');
  // Adoption completes the record (saved_to_list) in the same transaction, and a closed record never moves:
  // a concluded, abandoned or failed investigation is read-only (the closing-rules fix, 7 Nov 2026).
  if (record.state !== 'open') throw fail('record_not_open');
  if (!nonEmptyString(record.question)) throw fail('question_missing');
  const current = new Set(currentFindingsOf(record).map((f) => f?.findingId));
  if (!Array.isArray(keptFindingIds) || keptFindingIds.length === 0 || new Set(keptFindingIds).size !== keptFindingIds.length
    || !keptFindingIds.every((id) => isFindingId(id) && current.has(id))) throw fail('invalid_kept_findings');
  const evidenceRefs = serverEvidenceRefsOf([
    researchRefOf(recordId),
    ...keptFindingIds.map((itemId) => ({ kind: EVIDENCE_ITEM_KIND, recordKind: RESEARCH_WORK_RECORD_KIND, recordId, itemId })),
    { kind: EXCHANGE_EVIDENCE_KIND, hostCollection: 'sharedResearchSessions', hostId: sessionId, exchangeId: confirmExchangeId },
  ]);
  return buildVersionDoc({
    version: 1, watchlistId, userId, opId: `adopt_${sessionId}`,
    opFingerprint: opFingerprintOf({ kind: 'adopt', payload: { sessionId, statement, horizonEnum, activation, invalidation, keptFindingIds, confirmExchangeId } }),
    createdAt: nowIso,
    content: {
      statement, horizonEnum, horizonSource: 'player', activation, invalidation,
      evidenceRefs, publishedAt: null, origin: originOf(list),
    },
    status: 'researched', stateSource: 'research', stateReason: STATE_REASONS.sharedResearchCompleted,
  });
}

/**
 * Pilot P1c (founder ruling E2): every battle that carried the version, in
 * deploy order — written by the creation transaction beside lastDeployed*,
 * additive and outside contentHash and LIFECYCLE_FIELDS (as reviewClockFault).
 * The review reads the FIRST for the frozen names and the LAST for a
 * battle-end window; the void unwind (ruling E3) steps back through it.
 */
export const DEPLOYED_BATTLE_IDS_FIELD = 'deployedBattleIds';
/** The most ids kept: the first carrying battle, then the newest 49 (a 60-session idea redeployed daily outgrows 50). */
export const DEPLOYED_BATTLE_IDS_CAP = 50;

/**
 * The carrying battles a version records, oldest first: its `deployedBattleIds`,
 * or — for a version activated before P1c wrote them — its `lastDeployedBattleId`
 * alone (the NEWEST carrying battle: the only one that record names). Pure.
 */
export function carryingBattleIdsOf(v) {
  const ids = Array.isArray(v?.[DEPLOYED_BATTLE_IDS_FIELD]) ? v[DEPLOYED_BATTLE_IDS_FIELD].filter(nonEmptyString) : [];
  if (ids.length > 0) return ids.filter((id, i) => ids.indexOf(id) === i);
  return nonEmptyString(v?.lastDeployedBattleId) ? [v.lastDeployedBattleId] : [];
}

/** The ids with one more carrying battle, under the cap: the first is kept, then the newest. Pure. */
export function withCarryingBattle(ids, battleId) {
  const next = ids.includes(battleId) ? [...ids] : [...ids, battleId];
  if (next.length <= DEPLOYED_BATTLE_IDS_CAP) return next;
  return [next[0], ...next.slice(next.length - (DEPLOYED_BATTLE_IDS_CAP - 1))];
}
