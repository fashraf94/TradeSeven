// src/types/vision/visionFactory.js
// Initial-value factory for a fresh Vision at battle creation.
// Source of truth: SPEC_A_VISION_REFERENCE_V1_0 §2.4.
//
// Design notes:
//   - SDK-agnostic: callers pass `nowTimestamp` so this module does not need
//     to import from either firebase or firebase-admin.
//   - FLAG C approved refinement: `conditionSnapshot` is passed through as-is,
//     including null. No defaulting. Callers at battle creation typically pass
//     null; later writers populate it when the state leaves 'unformed'.

/**
 * @typedef {import('./visionTypes.js').Vision} Vision
 * @typedef {import('./visionTypes.js').VisionConditionSnapshot} VisionConditionSnapshot
 * @typedef {import('./visionTypes.js').FirestoreTimestampLike} FirestoreTimestampLike
 */

/**
 * Produce the initial Vision object for a freshly-created battle.
 *
 * Only called from the battle-creation write path. `conditionSnapshot` is
 * passed through verbatim — including `null` when Layer 1 is not yet
 * producing live readings at creation time.
 *
 * @param {VisionConditionSnapshot|null} conditionSnapshot  Layer-1 snapshot, or null.
 * @param {FirestoreTimestampLike} nowTimestamp  Caller-supplied current time.
 * @returns {Vision}
 */
export function createInitialVision(conditionSnapshot, nowTimestamp) {
  return {
    thesis: {
      statement: '',
      structuredSummary: {
        direction: 'neutral',
        scope: [],
        drivers: [],
      },
      authoredBy: 'gemma',
    },
    confidence: 'low',
    source: 'agent-generated-fallback',
    state: 'unformed',
    constraints: [],
    evidenceTrail: [],
    conflicts: [],
    lastUserTouchAt: nowTimestamp,
    conditionSnapshot,
    nextCheckInAt: null,
    transitionHistory: [],
    createdAt: nowTimestamp,
    lastTransitionAt: nowTimestamp,
    version: 1,
  };
}
