// src/types/vision/visionValidators.js
// Write-path validators for the Vision object.
// Source of truth: SPEC_A_VISION_REFERENCE_V1_0 §2.6 (invariants).
//
// Every exported validator returns { valid: boolean, errors: string[] } and
// never throws. Callers decide how to react.
//
// Phase 1 enforcement scope (cheap, single-object checks):
//   - validateVisionShape              structural well-formedness
//   - validateTransition               state-machine edge + housekeeping deltas
//   - validateConstraintMutation       mutation allowed in current state
//   - validateVisionInvariants         read-side corruption check
//
// NOT enforced by these validators (left to callers / Phase 3 rules):
//   - "one non-retired Vision per battle" (battle-level, multi-doc)
//   - overwrite semantics on Vision replacement
//   - cross-battle or multi-Vision concerns
//
// FLAG B: Timestamps are duck-typed. A valid timestamp has finite numeric
// `seconds` and `nanoseconds`. `toDate()` is not required.
//
// FLAG C: `conditionSnapshot` may be null ONLY while state === 'unformed'.
// validateVisionShape enforces the state-gated rule. validateTransition
// additionally requires that any transition OUT of 'unformed' supplies a
// non-null conditionSnapshot on the next Vision.

import {
  VISION_CONFIDENCE_LEVELS,
  VISION_SOURCES,
  VISION_LIFECYCLE_STATES,
  VISION_TRANSITION_CAUSES,
  VISION_TRANSITION_ACTORS,
  VISION_CONSTRAINT_TYPES,
  VISION_LIFECYCLE_BINDINGS,
  VISION_CONFLICT_TYPES,
  VISION_CONFLICT_STATUSES,
  VISION_THESIS_DIRECTIONS,
  VISION_THESIS_AUTHORS,
  VISION_EVIDENCE_TYPES,
  VISION_EVIDENCE_AUTHORS,
  VISION_MARKET_PHASES,
  VISION_CONSTRAINT_AUTHORS,
  VISION_CATEGORY_B_RULE_KINDS,
  VISION_SYSTEM_INJECTED_SCOPES,
  VISION_CONFLICT_WINNERS,
  VISION_CONFLICT_ARBITERS,
  CONSTRAINT_MUTATION_STATES,
} from '../../constants/visionEnums.js';
import { isValidTransition } from './visionTransitions.js';

/**
 * @typedef {import('./visionTypes.js').Vision} Vision
 * @typedef {import('./visionTypes.js').VisionConstraint} VisionConstraint
 * @typedef {import('./visionTypes.js').VisionTransitionActor} VisionTransitionActor
 * @typedef {import('./visionTypes.js').VisionTransitionCause} VisionTransitionCause
 * @typedef {import('./visionTypes.js').FirestoreTimestampLike} FirestoreTimestampLike
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

// ============================================================================
// Primitive checks
// ============================================================================

function isPlainObject(v) {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v)
  );
}

function isNonEmptyString(v) {
  return typeof v === 'string';
}

function isTimestampLike(v) {
  return (
    isPlainObject(v) &&
    typeof v.seconds === 'number' &&
    Number.isFinite(v.seconds) &&
    typeof v.nanoseconds === 'number' &&
    Number.isFinite(v.nanoseconds)
  );
}

/**
 * Compare two timestamps. Returns negative if a < b, 0 if equal, positive if
 * a > b. Assumes both are valid per `isTimestampLike`.
 */
function compareTimestamps(a, b) {
  if (a.seconds !== b.seconds) return a.seconds - b.seconds;
  return a.nanoseconds - b.nanoseconds;
}

function timestampsEqual(a, b) {
  return (
    isTimestampLike(a) &&
    isTimestampLike(b) &&
    a.seconds === b.seconds &&
    a.nanoseconds === b.nanoseconds
  );
}

function inSet(value, set, fieldName, errors) {
  if (!set.includes(value)) {
    errors.push(`${fieldName}: expected one of [${set.join(', ')}], got ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

function requireTimestamp(value, fieldName, errors, { nullable = false } = {}) {
  if (value === null) {
    if (nullable) return true;
    errors.push(`${fieldName}: timestamp required, got null`);
    return false;
  }
  if (!isTimestampLike(value)) {
    errors.push(`${fieldName}: not a Firestore-timestamp-like value (missing numeric seconds/nanoseconds)`);
    return false;
  }
  return true;
}

function requireString(value, fieldName, errors) {
  if (!isNonEmptyString(value)) {
    errors.push(`${fieldName}: expected string, got ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

function requireArray(value, fieldName, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${fieldName}: expected array, got ${typeof value}`);
    return false;
  }
  return true;
}

function requireStringArray(value, fieldName, errors) {
  if (!requireArray(value, fieldName, errors)) return false;
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      errors.push(`${fieldName}[${i}]: expected string`);
      return false;
    }
  }
  return true;
}

// ============================================================================
// Sub-shape validators
// ============================================================================

function validateThesis(thesis, path, errors) {
  if (!isPlainObject(thesis)) {
    errors.push(`${path}: expected object`);
    return;
  }
  if (typeof thesis.statement !== 'string') {
    errors.push(`${path}.statement: expected string`);
  }
  const ss = thesis.structuredSummary;
  if (!isPlainObject(ss)) {
    errors.push(`${path}.structuredSummary: expected object`);
  } else {
    inSet(ss.direction, VISION_THESIS_DIRECTIONS, `${path}.structuredSummary.direction`, errors);
    requireStringArray(ss.scope, `${path}.structuredSummary.scope`, errors);
    requireStringArray(ss.drivers, `${path}.structuredSummary.drivers`, errors);
  }
  inSet(thesis.authoredBy, VISION_THESIS_AUTHORS, `${path}.authoredBy`, errors);
}

function validateEvidenceEntry(e, path, errors) {
  if (!isPlainObject(e)) {
    errors.push(`${path}: expected object`);
    return;
  }
  requireString(e.id, `${path}.id`, errors);
  inSet(e.type, VISION_EVIDENCE_TYPES, `${path}.type`, errors);
  requireString(e.reference, `${path}.reference`, errors);
  if (e.note !== null && typeof e.note !== 'string') {
    errors.push(`${path}.note: expected string or null`);
  }
  requireTimestamp(e.addedAt, `${path}.addedAt`, errors);
  inSet(e.addedBy, VISION_EVIDENCE_AUTHORS, `${path}.addedBy`, errors);
}

function validateConditionSnapshot(cs, path, errors) {
  if (!isPlainObject(cs)) {
    errors.push(`${path}: expected object`);
    return;
  }
  if (typeof cs.vix !== 'number' || !Number.isFinite(cs.vix)) {
    errors.push(`${path}.vix: expected finite number`);
  }
  if (typeof cs.pointDifferential !== 'number' || !Number.isFinite(cs.pointDifferential)) {
    errors.push(`${path}.pointDifferential: expected finite number`);
  }
  inSet(cs.marketPhase, VISION_MARKET_PHASES, `${path}.marketPhase`, errors);
  requireTimestamp(cs.takenAt, `${path}.takenAt`, errors);
}

function validateTransitionEntry(t, path, errors) {
  if (!isPlainObject(t)) {
    errors.push(`${path}: expected object`);
    return;
  }
  inSet(t.fromState, VISION_LIFECYCLE_STATES, `${path}.fromState`, errors);
  inSet(t.toState, VISION_LIFECYCLE_STATES, `${path}.toState`, errors);
  requireTimestamp(t.timestamp, `${path}.timestamp`, errors);
  inSet(t.actor, VISION_TRANSITION_ACTORS, `${path}.actor`, errors);
  inSet(t.cause, VISION_TRANSITION_CAUSES, `${path}.cause`, errors);
}

function validateConstraintPayload(c, path, errors) {
  const p = c.payload;
  if (!isPlainObject(p)) {
    errors.push(`${path}.payload: expected object`);
    return;
  }
  if (c.type === 'user_carveout') {
    requireString(p.statement, `${path}.payload.statement`, errors);
    if (!isPlainObject(p.tags)) {
      errors.push(`${path}.payload.tags: expected object`);
    } else {
      requireStringArray(p.tags.tickers, `${path}.payload.tags.tickers`, errors);
      requireStringArray(p.tags.sectors, `${path}.payload.tags.sectors`, errors);
      requireStringArray(p.tags.behaviors, `${path}.payload.tags.behaviors`, errors);
    }
  } else if (c.type === 'category_b_forge') {
    requireString(p.ruleId, `${path}.payload.ruleId`, errors);
    if (!isPlainObject(p.ruleSnapshot)) {
      errors.push(`${path}.payload.ruleSnapshot: expected object`);
    }
    inSet(p.ruleKind, VISION_CATEGORY_B_RULE_KINDS, `${path}.payload.ruleKind`, errors);
  } else if (c.type === 'system_injected') {
    requireString(p.eventCause, `${path}.payload.eventCause`, errors);
    inSet(p.scope, VISION_SYSTEM_INJECTED_SCOPES, `${path}.payload.scope`, errors);
    if (p.target !== null && typeof p.target !== 'string') {
      errors.push(`${path}.payload.target: expected string or null`);
    }
    requireString(p.reason, `${path}.payload.reason`, errors);
  }
  // Unknown type is already reported by the enclosing constraint check.
}

function validateConstraint(c, path, errors) {
  if (!isPlainObject(c)) {
    errors.push(`${path}: expected object`);
    return;
  }
  requireString(c.id, `${path}.id`, errors);
  if (inSet(c.type, VISION_CONSTRAINT_TYPES, `${path}.type`, errors)) {
    validateConstraintPayload(c, path, errors);
  }
  requireString(c.source, `${path}.source`, errors);
  requireTimestamp(c.createdAt, `${path}.createdAt`, errors);
  requireTimestamp(c.expiresAt, `${path}.expiresAt`, errors, { nullable: true });
  inSet(c.lifecycleBinding, VISION_LIFECYCLE_BINDINGS, `${path}.lifecycleBinding`, errors);
  inSet(c.createdBy, VISION_CONSTRAINT_AUTHORS, `${path}.createdBy`, errors);
}

function validateConflictResolution(r, path, errors) {
  if (!isPlainObject(r)) {
    errors.push(`${path}: expected object`);
    return;
  }
  inSet(r.winner, VISION_CONFLICT_WINNERS, `${path}.winner`, errors);
  inSet(r.arbiter, VISION_CONFLICT_ARBITERS, `${path}.arbiter`, errors);
  if (r.note !== null && typeof r.note !== 'string') {
    errors.push(`${path}.note: expected string or null`);
  }
}

function validateConflict(c, path, errors) {
  if (!isPlainObject(c)) {
    errors.push(`${path}: expected object`);
    return;
  }
  requireString(c.id, `${path}.id`, errors);
  requireString(c.constraintIdA, `${path}.constraintIdA`, errors);
  requireString(c.constraintIdB, `${path}.constraintIdB`, errors);
  inSet(c.type, VISION_CONFLICT_TYPES, `${path}.type`, errors);
  inSet(c.status, VISION_CONFLICT_STATUSES, `${path}.status`, errors);
  requireTimestamp(c.detectedAt, `${path}.detectedAt`, errors);
  requireTimestamp(c.resolvedAt, `${path}.resolvedAt`, errors, { nullable: true });
  if (c.resolution === null) {
    // ok
  } else {
    validateConflictResolution(c.resolution, `${path}.resolution`, errors);
  }
}

// ============================================================================
// Public validators
// ============================================================================

/**
 * Validate the structural shape of a Vision object.
 *
 * Checks every required field, type, and enum membership. Enforces the
 * FLAG C state-gated `conditionSnapshot` rule:
 *   - null iff state === 'unformed'
 *   - non-null (and fully shaped) otherwise
 *
 * Does NOT check:
 *   - valid transitions (use validateTransition)
 *   - that a particular mutation is allowed in the current state
 *     (use validateConstraintMutation)
 *   - cross-document invariants (caller's responsibility)
 *
 * @param {unknown} vision
 * @returns {ValidationResult}
 */
export function validateVisionShape(vision) {
  const errors = [];

  if (!isPlainObject(vision)) {
    return { valid: false, errors: ['vision: expected object'] };
  }

  const v = /** @type {Record<string, unknown>} */ (vision);

  // Thesis
  validateThesis(v.thesis, 'vision.thesis', errors);

  // Confidence / source / state
  inSet(v.confidence, VISION_CONFIDENCE_LEVELS, 'vision.confidence', errors);
  inSet(v.source, VISION_SOURCES, 'vision.source', errors);
  inSet(v.state, VISION_LIFECYCLE_STATES, 'vision.state', errors);

  // Arrays
  if (requireArray(v.constraints, 'vision.constraints', errors)) {
    v.constraints.forEach((c, i) => validateConstraint(c, `vision.constraints[${i}]`, errors));
  }
  if (requireArray(v.evidenceTrail, 'vision.evidenceTrail', errors)) {
    v.evidenceTrail.forEach((e, i) => validateEvidenceEntry(e, `vision.evidenceTrail[${i}]`, errors));
  }
  if (requireArray(v.conflicts, 'vision.conflicts', errors)) {
    v.conflicts.forEach((c, i) => validateConflict(c, `vision.conflicts[${i}]`, errors));
  }

  // Timestamps
  requireTimestamp(v.lastUserTouchAt, 'vision.lastUserTouchAt', errors);
  requireTimestamp(v.nextCheckInAt, 'vision.nextCheckInAt', errors, { nullable: true });
  requireTimestamp(v.createdAt, 'vision.createdAt', errors);
  requireTimestamp(v.lastTransitionAt, 'vision.lastTransitionAt', errors);

  // FLAG C: state-gated conditionSnapshot
  if (v.conditionSnapshot === null) {
    if (v.state !== 'unformed') {
      errors.push(
        `vision.conditionSnapshot: may only be null when state === 'unformed' (got state=${JSON.stringify(v.state)})`,
      );
    }
  } else {
    validateConditionSnapshot(v.conditionSnapshot, 'vision.conditionSnapshot', errors);
  }

  // Transition history
  if (requireArray(v.transitionHistory, 'vision.transitionHistory', errors)) {
    v.transitionHistory.forEach((t, i) =>
      validateTransitionEntry(t, `vision.transitionHistory[${i}]`, errors),
    );
  }

  // Version
  if (typeof v.version !== 'number' || !Number.isInteger(v.version) || v.version < 1) {
    errors.push(`vision.version: expected integer >= 1, got ${JSON.stringify(v.version)}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a proposed state transition.
 *
 * - If prevVision is null this is battle creation; nextVision.state MUST be
 *   'unformed' and nextVision.transitionHistory MUST be empty.
 * - Otherwise prev.state -> next.state must be a valid edge in
 *   VALID_TRANSITIONS under the given actor and cause, AND housekeeping
 *   invariants (history delta, lastTransitionAt, createdAt immutability,
 *   FLAG C conditionSnapshot) must hold.
 *
 * @param {Vision|null} prevVision
 * @param {Vision} nextVision
 * @param {VisionTransitionActor} actor
 * @param {VisionTransitionCause} cause
 * @returns {ValidationResult}
 */
export function validateTransition(prevVision, nextVision, actor, cause) {
  const errors = [];

  if (!isPlainObject(nextVision)) {
    return { valid: false, errors: ['nextVision: expected object'] };
  }

  // Battle-creation path ---------------------------------------------------
  if (prevVision === null) {
    if (nextVision.state !== 'unformed') {
      errors.push(
        `initial state must be 'unformed', got ${JSON.stringify(nextVision.state)}`,
      );
    }
    if (!Array.isArray(nextVision.transitionHistory) || nextVision.transitionHistory.length !== 0) {
      errors.push(
        `initial Vision must have empty transitionHistory, got length=${
          Array.isArray(nextVision.transitionHistory) ? nextVision.transitionHistory.length : 'not-array'
        }`,
      );
    }
    // V3: the initial edge must also match VALID_TRANSITIONS on (cause, actor).
    // Only 'battle_creation'/'layer1' actors + 'battle_start' cause are allowed.
    if (!isValidTransition(null, 'unformed', cause, actor)) {
      errors.push(
        `invalid initial transition: (actor=${JSON.stringify(actor)}, cause=${JSON.stringify(cause)}) is not allowed on the battle-creation edge`,
      );
    }
    return { valid: errors.length === 0, errors };
  }

  // Post-creation transitions ---------------------------------------------
  if (!isPlainObject(prevVision)) {
    return { valid: false, errors: ['prevVision: expected object or null'] };
  }

  if (!isValidTransition(prevVision.state, nextVision.state, cause, actor)) {
    errors.push(
      `invalid transition: ${prevVision.state} -> ${nextVision.state} (actor=${actor}, cause=${cause})`,
    );
  }

  // createdAt immutable
  if (!timestampsEqual(prevVision.createdAt, nextVision.createdAt)) {
    errors.push('vision.createdAt: must not change after initial write');
  }

  // transitionHistory length must grow by exactly 1
  const prevLen = Array.isArray(prevVision.transitionHistory) ? prevVision.transitionHistory.length : -1;
  const nextLen = Array.isArray(nextVision.transitionHistory) ? nextVision.transitionHistory.length : -1;
  if (prevLen < 0 || nextLen < 0) {
    errors.push('vision.transitionHistory: expected array on both prev and next');
  } else if (nextLen !== prevLen + 1) {
    errors.push(
      `vision.transitionHistory: expected length ${prevLen + 1} on next, got ${nextLen}`,
    );
  } else {
    const newEntry = nextVision.transitionHistory[nextLen - 1];
    const entryErrors = [];
    validateTransitionEntry(newEntry, 'vision.transitionHistory[last]', entryErrors);
    errors.push(...entryErrors);
    if (entryErrors.length === 0) {
      if (newEntry.fromState !== prevVision.state) {
        errors.push(
          `transitionHistory[last].fromState: expected ${prevVision.state}, got ${newEntry.fromState}`,
        );
      }
      if (newEntry.toState !== nextVision.state) {
        errors.push(
          `transitionHistory[last].toState: expected ${nextVision.state}, got ${newEntry.toState}`,
        );
      }
      if (newEntry.actor !== actor) {
        errors.push(
          `transitionHistory[last].actor: expected ${actor}, got ${newEntry.actor}`,
        );
      }
      if (newEntry.cause !== cause) {
        errors.push(
          `transitionHistory[last].cause: expected ${cause}, got ${newEntry.cause}`,
        );
      }
      if (!timestampsEqual(newEntry.timestamp, nextVision.lastTransitionAt)) {
        errors.push(
          'vision.lastTransitionAt must equal transitionHistory[last].timestamp',
        );
      }
    }
  }

  // FLAG C: leaving 'unformed' requires a non-null conditionSnapshot on next
  if (prevVision.state === 'unformed' && nextVision.state !== 'unformed') {
    if (nextVision.conditionSnapshot === null || nextVision.conditionSnapshot === undefined) {
      errors.push(
        "transition out of 'unformed' requires a non-null conditionSnapshot on next Vision",
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a proposed constraint mutation against the current state.
 *
 * Rules:
 *   - No constraint mutations allowed when prev state === 'retired'.
 *   - System-injected constraints may be added/removed in any non-retired state.
 *   - Non-system-injected constraint changes require prev state in
 *     { 'proposed', 'active', 'under_debate' }.
 *
 * "Change" is detected by comparing constraint id sets partitioned by type.
 *
 * @param {Vision} prevVision
 * @param {Vision} nextVision
 * @returns {ValidationResult}
 */
export function validateConstraintMutation(prevVision, nextVision) {
  const errors = [];

  if (!isPlainObject(prevVision) || !isPlainObject(nextVision)) {
    return { valid: false, errors: ['prevVision/nextVision: expected objects'] };
  }
  if (!Array.isArray(prevVision.constraints) || !Array.isArray(nextVision.constraints)) {
    return { valid: false, errors: ['constraints: expected array on both versions'] };
  }

  const prevIds = new Map(prevVision.constraints.map((c) => [c.id, c]));
  const nextIds = new Map(nextVision.constraints.map((c) => [c.id, c]));

  let nonSystemChanged = false;
  let anyChanged = false;

  // Additions and modifications
  for (const [id, nc] of nextIds) {
    const pc = prevIds.get(id);
    if (!pc) {
      anyChanged = true;
      if (nc.type !== 'system_injected') nonSystemChanged = true;
    } else if (JSON.stringify(pc) !== JSON.stringify(nc)) {
      anyChanged = true;
      if (nc.type !== 'system_injected' || pc.type !== 'system_injected') {
        nonSystemChanged = true;
      }
    }
  }

  // Removals
  for (const [id, pc] of prevIds) {
    if (!nextIds.has(id)) {
      anyChanged = true;
      if (pc.type !== 'system_injected') nonSystemChanged = true;
    }
  }

  if (!anyChanged) {
    return { valid: true, errors: [] };
  }

  if (prevVision.state === 'retired') {
    errors.push('constraint mutations are not allowed when state === \'retired\'');
    return { valid: false, errors };
  }

  if (nonSystemChanged) {
    if (!CONSTRAINT_MUTATION_STATES.includes(prevVision.state)) {
      errors.push(
        `non-system-injected constraint mutations require state in [${CONSTRAINT_MUTATION_STATES.join(', ')}], got ${JSON.stringify(prevVision.state)}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Read-side corruption check. Intended for data just loaded from Firestore.
 *
 * Enforces §2.6 invariants that are cheap to check on a single Vision object:
 *   - (6) transitionHistory empty iff no transition has occurred
 *   - (7) lastTransitionAt === transitionHistory[last].timestamp when history
 *         is non-empty
 *   - (8) createdAt <= lastTransitionAt
 *
 * Does NOT duplicate validateVisionShape's structural checks; callers that
 * need both should run shape first and short-circuit on failure.
 *
 * @param {Vision} vision
 * @returns {ValidationResult}
 */
export function validateVisionInvariants(vision) {
  const errors = [];

  if (!isPlainObject(vision)) {
    return { valid: false, errors: ['vision: expected object'] };
  }

  const history = Array.isArray(vision.transitionHistory) ? vision.transitionHistory : null;
  if (history === null) {
    errors.push('vision.transitionHistory: expected array');
  } else if (history.length > 0) {
    const last = history[history.length - 1];
    if (!isPlainObject(last) || !isTimestampLike(last.timestamp)) {
      errors.push('vision.transitionHistory[last]: missing well-formed timestamp');
    } else if (isTimestampLike(vision.lastTransitionAt)) {
      if (!timestampsEqual(last.timestamp, vision.lastTransitionAt)) {
        errors.push(
          'invariant 7: vision.lastTransitionAt must equal transitionHistory[last].timestamp',
        );
      }
    }
  } else if (vision.state !== 'unformed') {
    // Invariant 6 (read-side): every state transition writes a history entry,
    // so reaching any non-'unformed' state requires a non-empty history.
    errors.push(
      `invariant 6: state=${JSON.stringify(vision.state)} requires non-empty transitionHistory`,
    );
  }

  if (isTimestampLike(vision.createdAt) && isTimestampLike(vision.lastTransitionAt)) {
    if (compareTimestamps(vision.createdAt, vision.lastTransitionAt) > 0) {
      errors.push('invariant 8: vision.createdAt must be <= vision.lastTransitionAt');
    }
  }

  return { valid: errors.length === 0, errors };
}
