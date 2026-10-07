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
} from '../../../src/constants/hypothesisRecords.js';

export {
  HYPOTHESIS_STATUSES, TERMINAL_STATUSES, PRE_DEPLOY_STATUSES, HORIZON_ENUMS, HORIZON_SOURCES, STATE_REASONS,
  PLAYER_TRANSITIONS, PLAYER_ACTIONS, CLOSING_ACTIONS, legalTransition, legalActionsFor,
};

export const WATCHLISTS_COLLECTION = 'watchlists';
export const VERSIONS_SUBCOLLECTION = 'hypothesisVersions';

export const ORIGINS = Object.freeze(['signaldrop', 'theme', 'screener', 'manual']);
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

/**
 * The content object, validated in full. Every field is required here — the
 * callers resolve inheritance first. Throws HypothesisInputError.
 */
export function buildContent(c) {
  if (!isPlainObject(c)) throw new HypothesisInputError('invalid_content');
  if (!HORIZON_ENUMS.includes(c.horizonEnum)) throw new HypothesisInputError('invalid_horizon', `horizonEnum must be one of ${HORIZON_ENUMS.join(', ')}.`);
  if (!HORIZON_SOURCES.includes(c.horizonSource)) throw new HypothesisInputError('invalid_horizon', 'horizonSource is not a known source.');
  if (!ORIGINS.includes(c.origin)) throw new HypothesisInputError('invalid_origin');
  if (!Array.isArray(c.evidenceRefs) || !c.evidenceRefs.every(nonEmptyString)) throw new HypothesisInputError('invalid_evidence_refs');
  if (!(c.publishedAt === null || nonEmptyString(c.publishedAt))) throw new HypothesisInputError('invalid_published_at');
  return {
    statement: normalizeStatement(c.statement),
    horizonEnum: c.horizonEnum,
    horizonSource: c.horizonSource,
    activation: normalizeConditions(c.activation),
    invalidation: normalizeConditions(c.invalidation),
    evidenceRefs: [...c.evidenceRefs],
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
 * The origin of a saved list (spec §2.8), from the list itself and — for a
 * session-derived list — the dialogue session's own discriminant (`source:
 * 'theme'` lives only on the session; a paste session carries none).
 */
export function originOf(watchlist, session = null) {
  const w = isPlainObject(watchlist) ? watchlist : {};
  if (nonEmptyString(w.sourceSessionId)) return isPlainObject(session) && session.source === 'theme' ? 'theme' : 'signaldrop';
  if (w.sourceScreenSpec != null) return 'screener';
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
 * Null when the thesis is empty (no version is created).
 */
export function buildSaveVersion({ session, watchlistId, userId, sessionId, nowIso }) {
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
      activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin,
    },
    status: 'researched', stateSource: 'research', stateReason: STATE_REASONS.dialogueCompleted,
  });
}
