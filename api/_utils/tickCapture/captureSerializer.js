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
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
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
  'guardrail.evaluated': 'bool',
  'guardrail.deployedCount': 'number',
  'guardrail.suppressionPassRan': 'bool',
  'guardrail.suppressionPassFaulted': 'bool',

  'risk.verdicts.*.action': 'id',
  'risk.verdicts.*.reason': 'id',
  'risk.lockedCount': 'number',
  'risk.forcedExitCount': 'number',
  'risk.evaluatedCount': 'number',

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

  'controls.rendered': 'id',
  'controls.suppressedControlCount': 'number',
  'controls.activeRuleRendered': 'id',
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

  'capture.preCommitMs': 'number',
  'capture.bodyMs': 'number',
  'capture.deadlineMs': 'number',
  'capture.minRemainingBudgetMs': 'number',
  'capture.remainingBudgetMs': 'number',
  'capture.disposition': 'enum:CAPTURE_DISPOSITIONS',
  'capture.rejectedFieldCount': 'number',
});

/**
 * DECLARED CONTAINERS (Astra round 1, F2). The walk below only descends a path
 * that appears here, and only when the value's own SHAPE matches. Everything
 * else — a container where a leaf is declared, an array where an object is,
 * an undeclared key inside a declared object — is rejected WHOLE into the TTL
 * body rather than descended.
 *
 * The previous walk recursed first and consulted the declared kind only at the
 * leaves, so an object at a leaf path (an invalid model decision such as
 * `{"PRIVATE-CANARY": {}}` under `decision.original`, which is declared
 * `enum:DECISIONS`) survived by having a well-formed key and never reaching
 * `leafOk`. Default-deny has to be checked BEFORE the descent, not after it.
 */
/**
 * KEY KINDS (Astra round 2, G5). A map whose KEYS carry meaning needs its keys
 * admitted the same way its values are. `risk.verdicts` is keyed by SYMBOL, so
 * a key must pass universe admission — identifier syntax plus a declared path
 * is not enough, and without this `risk.verdicts = {"PRIVATE-CANARY": {}}`
 * survived even with an EMPTY universe.
 *
 * A container absent from this table keeps the default: keys are structure and
 * must be bounded identifiers naming a declared path.
 */
export const PERMANENT_KEY_KINDS = Object.freeze({
  'risk.verdicts': 'symbol',
});

export const PERMANENT_CONTAINER_KINDS = Object.freeze({
  '': 'object',
  'model': 'object',
  'guardrail': 'object',
  'risk': 'object',
  'risk.verdicts': 'object',
  'risk.verdicts.*': 'object',
  'checks': 'object',
  'checks.*': 'object',
  'decision': 'object',
  'actions': 'array',
  'actions.*': 'object',
  'controls': 'object',
  'controls.standingLeanIds': 'array',
  'controls.standingLeanVersions': 'array',
  'controls.standingLeanTextHashes': 'array',
  'controls.activeRuleIds': 'array',
  'controls.activeRuleTextHashes': 'array',
  'manifest': 'object',
  'manifest.evidenceKeys': 'array',
  'manifest.vintages': 'object',
  'manifest.vintageLabels': 'object',
  'manifest.notRenderedFields': 'array',
  'callEnvelope': 'object',
  'body': 'object',
  'scores': 'object',
  'capture': 'object',
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

/** Every candidate lookup key for a concrete path, most specific first. */
function pathProbes(path) {
  const probes = [path];
  const parts = path.split('.');
  for (let i = 0; i < parts.length; i++) {
    const probe = [...parts];
    probe[i] = '*';
    probes.push(probe.join('.'));
    for (let j = i + 1; j < parts.length; j++) {
      const probe2 = [...probe];
      probe2[j] = '*';
      probes.push(probe2.join('.'));
    }
  }
  return probes;
}

/** The declared LEAF kind at a path, or null. */
function kindFor(path) {
  for (const probe of pathProbes(path)) {
    if (Object.hasOwn(PERMANENT_FIELD_KINDS, probe)) return PERMANENT_FIELD_KINDS[probe];
  }
  return null;
}

/** The declared CONTAINER kind at a path ('object' | 'array'), or null. */
function containerFor(path) {
  for (const probe of pathProbes(path)) {
    if (Object.hasOwn(PERMANENT_CONTAINER_KINDS, probe)) return PERMANENT_CONTAINER_KINDS[probe];
  }
  return null;
}

/** Is anything at all declared at this path? */
function isDeclaredPath(path) {
  return kindFor(path) !== null || containerFor(path) !== null;
}

/** The declared KEY kind of a container's own keys, or null. */
function keyKindFor(containerPath) {
  for (const probe of pathProbes(containerPath)) {
    if (Object.hasOwn(PERMANENT_KEY_KINDS, probe)) return PERMANENT_KEY_KINDS[probe];
  }
  return null;
}

/** Is this key admissible as a key of `containerPath`? */
function keyOk(containerPath, key, universe) {
  if (!ID_RE.test(key)) return false;
  const declared = keyKindFor(containerPath);
  if (declared === 'symbol') return admitSymbol(key, universe) !== null;
  return true;
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

  /** Reject a value WHOLE — never descended, never partially kept. */
  const reject = (path, value, reason) => { rejected.push({ path, value, reason }); return null; };

  const walk = (value, path) => {
    if (value === undefined) return reject(path, null, 'undefined');

    // THE DECLARED SHAPE IS CHECKED FIRST (F2). A path is either a declared
    // container, a declared leaf, or nothing at all.
    const container = containerFor(path);
    if (container !== null) {
      if (container === 'array') {
        if (!Array.isArray(value)) return reject(path, value, 'not_array');
        return value.map((v, i) => walk(v, path ? `${path}.${i}` : String(i)));
      }
      if (!isPlainObject(value)) return reject(path, value, 'not_object');
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const childPath = path ? `${path}.${k}` : k;
        // A key is structure, never data: it must be a bounded identifier AND
        // it must name something this schema declares. An undeclared key is
        // dropped with its whole subtree, never walked into. G5: where the
        // container declares a KEY KIND, the key is admitted by that kind too —
        // a symbol key goes through the tick's own universe like any other.
        if (!keyOk(path, k, universe)) { reject(childPath, v, 'key_not_admissible'); continue; }
        if (!isDeclaredPath(childPath)) { reject(childPath, v, 'undeclared_path'); continue; }
        out[k] = walk(v, childPath);
      }
      return out;
    }

    const kind = kindFor(path);
    if (kind === null) return reject(path, value, 'undeclared_path');
    // A CONTAINER where a leaf is declared is rejected whole — this is the
    // case the old walk descended into.
    if (Array.isArray(value) || isPlainObject(value)) return reject(path, value, `not_${kind}`);
    if (!leafOk(kind, value, universe)) return reject(path, value, `not_${kind}`);
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
    if (value === undefined || value === null) return;
    const container = containerFor(path);
    if (container !== null) {
      if (container === 'array') {
        if (!Array.isArray(value)) { bad.push(path); return; }
        value.forEach((v, i) => walk(v, path ? `${path}.${i}` : String(i)));
        return;
      }
      if (!isPlainObject(value)) { bad.push(path); return; }
      for (const [k, v] of Object.entries(value)) {
        const childPath = path ? `${path}.${k}` : k;
        // KEYS TOO (F2), and by their DECLARED KIND (G5): an undeclared key, a
        // non-identifier key, or a symbol key outside the tick's universe is a
        // finding — even when its value is an empty object with nothing to read.
        if (!keyOk(path, k, universe) || !isDeclaredPath(childPath)) { bad.push(childPath); continue; }
        walk(v, childPath);
      }
      return;
    }
    const kind = kindFor(path);
    if (kind === null) { bad.push(path); return; }
    if (Array.isArray(value) || isPlainObject(value)) { bad.push(path); return; }
    if (!leafOk(kind, value, universe)) bad.push(path);
  };
  walk(doc, '');
  return bad;
}
