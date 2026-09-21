// api/_utils/tickCapture/captureSerializer.js
//
// Tick capture — the C-3 privacy boundary, enforced rather than promised.
//
// THE RULE (spec V1.3 §3). The PERMANENT document holds "no free text: ids,
// enums, numbers, symbols, timestamps, hashes". The BODY document holds every
// piece of text and is deleted whole by a Firestore TTL policy on `expireAt`.
// This module is the enforcement point: it is the only way a permanent
// document is built, and anything it cannot classify is moved to the body as
// text instead of being written to the permanent record.
//
// HOW IT ENFORCES. `PERMANENT_FIELD_KINDS` declares a KIND for every leaf path
// the permanent document may carry. The validator walks the composed object and
// checks each leaf against its declared kind:
//
//   symbol      — an uppercase ticker AND a member of THIS TICK'S OWN universe
//                 (held ∪ bench ∪ rendered candidates). A symbol the tick never
//                 held, benched or rendered is NOT admitted, however
//                 well-formed: the name itself could be model free text.
//   enum:<NAME> — a member of the named closed list in captureConfig.js.
//   id          — a bounded machine identifier (no whitespace, ≤ 120 chars).
//   hash        — 64 lowercase hex characters (SHA-256) or the repo's
//                 canonicalContentHash form.
//   timestamp   — an ISO-8601 instant.
//   number / bool / null — as named.
//
// A leaf at an UNDECLARED path is a violation too, not a pass: the default is
// deny, so a future field cannot leak text by being forgotten here. Every
// violation is nulled in the permanent document and appended to the body's
// `rejectedFields`, so the value still reaches forensics — under the TTL,
// where text belongs — and the permanent record carries only the count.
//
// NO SPREADS. Nothing in this module spreads a battle, chat, receipt, proposal
// or meeting object. Every field is named by an explicit selector at the call
// site (captureContext.js) and re-checked here.
//
// ZERO product imports beyond the sibling constants (the tickStampsHarness
// precedent): no flags, no clock, no Firestore.

import {
  ACTION_KINDS, ACTION_SOURCES, BODY_STATUSES, CAPTURE_DISPOSITIONS, CHECK_RESULTS,
  CHECK_STATUSES, DECISIONS, EXIT_REASONS, GUARDRAIL_FAULT_CLASSES, HOLD_KINDS,
  MODEL_OUTCOMES, STAGES, TIMEOUT_KINDS,
} from './captureConfig.js';

/** The closed lists an `enum:<NAME>` kind can name. */
export const ENUM_LISTS = Object.freeze({
  ACTION_KINDS, ACTION_SOURCES, BODY_STATUSES, CAPTURE_DISPOSITIONS, CHECK_RESULTS,
  CHECK_STATUSES, DECISIONS, EXIT_REASONS, GUARDRAIL_FAULT_CLASSES, HOLD_KINDS,
  MODEL_OUTCOMES, STAGES, TIMEOUT_KINDS,
});

const ID_RE = /^[A-Za-z0-9_:.+\-/]{1,120}$/;
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Every leaf path the permanent document may carry, and its kind. `*` matches
 * exactly one path segment (an array index or a map key). DEFAULT DENY: a path
 * absent from this table is a violation.
 */
export const PERMANENT_FIELD_KINDS = Object.freeze({
  'schemaVersion': 'number',
  'tickId': 'id',
  'battleId': 'id',
  'tickSeq': 'number',
  'evalId': 'id',
  'agentId': 'id',
  'ownerId': 'id',
  'gameMode': 'id',
  'day': 'id',
  'battlePhase': 'id',
  'capturedAt': 'timestamp',
  'stageReached': 'enum:STAGES',
  'exitReason': 'enum:EXIT_REASONS',
  'universeSize': 'number',

  'model.outcome': 'enum:MODEL_OUTCOMES',
  'model.failureClass': 'id',
  'model.invalidField': 'id',
  'model.timeoutKind': 'enum:TIMEOUT_KINDS',
  'model.attempted': 'bool',
  'model.dispatched': 'bool',

  'guardrail.faultClass': 'enum:GUARDRAIL_FAULT_CLASSES',
  'guardrail.sourceNote': 'id',
  'guardrail.overrideCount': 'number',

  'checks.*.status': 'enum:CHECK_STATUSES',
  'checks.*.result': 'enum:CHECK_RESULTS',
  'checks.*.stage': 'enum:STAGES',
  'checks.*.symbolOut': 'symbol',
  'checks.*.symbolIn': 'symbol',
  'checks.*.reason': 'id',

  'decision.original': 'enum:DECISIONS',
  'decision.final': 'enum:DECISIONS',
  'decision.originalSymbolOut': 'symbol',
  'decision.originalSymbolIn': 'symbol',
  'decision.finalSymbolOut': 'symbol',
  'decision.finalSymbolIn': 'symbol',
  'decision.conviction': 'number',
  'decision.tier': 'id',
  'decision.holdKind': 'enum:HOLD_KINDS',
  'decision.downgraded': 'bool',
  'decision.validationErrorCount': 'number',
  'decision.replacedByDeterministic': 'bool',

  'actions.*.actionId': 'id',
  'actions.*.n': 'number',
  'actions.*.kind': 'enum:ACTION_KINDS',
  'actions.*.source': 'enum:ACTION_SOURCES',
  'actions.*.exitReason': 'id',
  'actions.*.symbolOut': 'symbol',
  'actions.*.symbolIn': 'symbol',
  'actions.*.swappedOutAt': 'timestamp',
  'actions.*.lockedPoints': 'number',
  'actions.*.committed': 'bool',
  'actions.*.entryPrice': 'number',

  'controls.directiveThreadId': 'id',
  'controls.directiveAdjustmentId': 'id',
  'controls.directiveCanonicalTextVersion': 'number',
  'controls.directiveTextHash': 'hash',
  'controls.directiveSuppressed': 'id',
  'controls.standingLeanIds.*': 'id',
  'controls.standingLeanVersions.*': 'number',
  'controls.standingLeanTextHashes.*': 'hash',
  'controls.equippedConfigHash': 'hash',
  'controls.controlEpoch': 'number',
  'controls.activeRuleIds.*': 'id',
  'controls.activeRuleTextHashes.*': 'hash',

  'manifest.evidenceKeys.*': 'symbol',
  'manifest.vintages.*': 'number',
  'manifest.vintageLabels.*': 'id',
  'manifest.notRenderedFields.*': 'id',

  'callEnvelope.requestedModel': 'id',
  'callEnvelope.returnedModel': 'id',
  'callEnvelope.temperature': 'number',
  'callEnvelope.maxOutputTokens': 'number',
  'callEnvelope.inputTokens': 'number',
  'callEnvelope.outputTokens': 'number',
  'callEnvelope.buildMs': 'number',
  'callEnvelope.callMs': 'number',
  'callEnvelope.httpStatus': 'number',
  'callEnvelope.promptBuiltAt': 'timestamp',

  'body.status': 'enum:BODY_STATUSES',
  'body.incomplete': 'id',
  'body.requestSha256': 'hash',
  'body.responseSha256': 'hash',
  'body.requestBytes': 'number',
  'body.responseBytes': 'number',
  'body.expireAt': 'timestamp',

  'scores.active': 'number',
  'scores.banked': 'number',
  'scores.total': 'number',
  'scores.opponent': 'number',
  'scores.bankedBadgePoints': 'number',

  'capture.ms': 'number',
  'capture.deadlineMs': 'number',
  'capture.minRemainingBudgetMs': 'number',
  'capture.remainingBudgetMs': 'number',
  'capture.disposition': 'enum:CAPTURE_DISPOSITIONS',
  'capture.rejectedFieldCount': 'number',
});

/** The tick's own symbol universe: held ∪ bench ∪ rendered candidates. */
export function buildUniverse({ heldSymbols = [], benchSymbols = [], candidateSymbols = [] } = {}) {
  const out = new Set();
  for (const list of [heldSymbols, benchSymbols, candidateSymbols]) {
    if (!Array.isArray(list)) continue;
    for (const s of list) if (typeof s === 'string' && s) out.add(s);
  }
  return out;
}

/** A ticker the tick itself held, benched or rendered — or null. */
export function admitSymbol(value, universe) {
  if (typeof value !== 'string' || !SYMBOL_RE.test(value)) return null;
  if (!(universe instanceof Set) || !universe.has(value)) return null;
  return value;
}

/** A member of a closed list — or null. */
export function admitEnum(value, list) {
  if (typeof value !== 'string' || !Array.isArray(list)) return null;
  return list.includes(value) ? value : null;
}

/** A bounded machine identifier — or null. */
export function admitId(value) {
  if (typeof value !== 'string' || !ID_RE.test(value)) return null;
  return value;
}

/** A finite number — or null. */
export function admitNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Turn a dotted concrete path into its wildcard lookup key. */
function kindFor(path) {
  if (Object.hasOwn(PERMANENT_FIELD_KINDS, path)) return PERMANENT_FIELD_KINDS[path];
  const parts = path.split('.');
  // Try every single-segment wildcard substitution, left to right, then pairs.
  for (let i = 0; i < parts.length; i++) {
    const probe = [...parts];
    probe[i] = '*';
    const key = probe.join('.');
    if (Object.hasOwn(PERMANENT_FIELD_KINDS, key)) return PERMANENT_FIELD_KINDS[key];
    for (let j = i + 1; j < parts.length; j++) {
      const probe2 = [...probe];
      probe2[j] = '*';
      const key2 = probe2.join('.');
      if (Object.hasOwn(PERMANENT_FIELD_KINDS, key2)) return PERMANENT_FIELD_KINDS[key2];
    }
  }
  return null;
}

function leafOk(kind, value, universe) {
  if (value === null) return true;
  switch (kind) {
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'bool': return typeof value === 'boolean';
    case 'id': return typeof value === 'string' && ID_RE.test(value);
    case 'symbol': return admitSymbol(value, universe) !== null;
    // Every hash this build writes is a sha256 hex digest: the body copies'
    // own digests and `canonicalContentHash` (api/_utils/canonicalHash.js:44,
    // `.digest('hex')`). Nothing looser is admitted, so a hash FIELD can never
    // become a text channel.
    case 'hash': return typeof value === 'string' && SHA256_RE.test(value);
    case 'timestamp': return typeof value === 'string' && ISO_RE.test(value);
    default:
      if (typeof kind === 'string' && kind.startsWith('enum:')) {
        return admitEnum(value, ENUM_LISTS[kind.slice(5)]) !== null;
      }
      return false;
  }
}

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (v.constructor === Object || v.constructor === undefined);

/**
 * Walk a composed permanent document, null every leaf that is not admissible at
 * its path, and return the offending values for the body.
 *
 * @returns {{doc: object, rejected: Array<{path: string, value: unknown}>}}
 */
export function sanitizePermanentDocument(input, { universe = new Set() } = {}) {
  const rejected = [];

  const walk = (value, path) => {
    if (Array.isArray(value)) {
      return value.map((v, i) => walk(v, path ? `${path}.${i}` : String(i)));
    }
    if (isPlainObject(value)) {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        // A key is structure, never data: a key that is not a bounded
        // identifier cannot name a map field on the permanent record.
        const childPath = path ? `${path}.${k}` : k;
        if (!ID_RE.test(k)) {
          rejected.push({ path: childPath, value: v, reason: 'key_not_id' });
          continue;
        }
        out[k] = walk(v, childPath);
      }
      return out;
    }
    if (value === undefined) {
      rejected.push({ path, value: null, reason: 'undefined' });
      return null;
    }
    const kind = kindFor(path);
    if (kind === null) {
      rejected.push({ path, value, reason: 'undeclared_path' });
      return null;
    }
    if (!leafOk(kind, value, universe)) {
      rejected.push({ path, value, reason: `not_${kind}` });
      return null;
    }
    return value;
  };

  const doc = walk(input, '');
  return { doc, rejected };
}

/**
 * Independent re-check used by the tests and by the writer's own assertion:
 * every string leaf in a sanitized permanent document must be admissible.
 * Returns the offending paths; [] means the no-free-text rule holds.
 */
export function findFreeText(doc, { universe = new Set() } = {}) {
  const bad = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i))); return; }
    if (isPlainObject(value)) { for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k); return; }
    if (typeof value !== 'string') return;
    const kind = kindFor(path);
    if (kind === null || !leafOk(kind, value, universe)) bad.push(path);
  };
  walk(doc, '');
  return bad;
}
