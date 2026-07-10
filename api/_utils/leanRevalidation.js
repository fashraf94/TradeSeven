// api/_utils/leanRevalidation.js
//
// Release 2 (Fenced Customization Bundle V1.1) — battle-creation lean
// revalidation (spec Phase 1 item 7 / changelog #17). PURE: called with the
// agent's at-rest standingLeans + the archetype about to be snapshotted;
// returns what may enter the snapshot and what must be omitted, with reasons.
//
// FAIL CLOSED — never trust future UI (spec changelog #17): a lean that is
// not in the to-be-snapshotted archetype's menu, or whose pinned version is
// no longer the live canonicalTextVersion, or that is malformed, is OMITTED
// from the snapshot and reported (the Phase-2 caller writes the durable
// status record + event). Lean DATA on the agent doc is never mutated here —
// leans are durable desired state (an archetype switch-back revalidates them
// right back in).
//
// Consumers:
//   - Phase-2 fenced site 1 (createAgentBattle): valid[] becomes
//     agentContext.standingLeans (id + version + RESOLVED CURRENT text —
//     master spec §3.1 snapshot shape).
//   - change-archetype.js lean-invalidation rider: invalidated[] under the
//     NEW archetype rides the existing rescan event.

import { isValidAdjustmentId, getCanonicalText, getCanonicalTextVersion } from '../../src/data/archetypeAdjustments.js';

export const LEAN_INVALIDATION_REASONS = Object.freeze({
  MALFORMED: 'malformed',
  NOT_IN_MENU: 'not_in_menu',
  DEPRECATED_VERSION: 'deprecated_version',
});

/**
 * @param {Object} p
 * @param {Array<{adjustmentId: string, version: number, equippedAt?: string}>} p.standingLeans
 *   agent.standingLeans (ids-at-rest).
 * @param {string} p.archetypeCodeId the archetype about to be snapshotted.
 * @returns {{
 *   valid: Array<{adjustmentId: string, version: number, text: string}>,
 *   invalidated: Array<{adjustmentId: string|null, version: number|null, reason: string}>,
 * }}
 */
export function revalidateStandingLeans({ standingLeans = [], archetypeCodeId } = {}) {
  const valid = [];
  const invalidated = [];
  for (const lean of Array.isArray(standingLeans) ? standingLeans : []) {
    const wellFormed =
      lean && typeof lean === 'object' &&
      typeof lean.adjustmentId === 'string' && lean.adjustmentId &&
      typeof lean.version === 'number';
    if (!wellFormed) {
      invalidated.push({
        adjustmentId: typeof lean?.adjustmentId === 'string' ? lean.adjustmentId : null,
        version: typeof lean?.version === 'number' ? lean.version : null,
        reason: LEAN_INVALIDATION_REASONS.MALFORMED,
      });
      continue;
    }
    // Menu membership under the archetype being snapshotted (no fallback —
    // an unknown archetype invalidates everything, fail closed).
    if (!isValidAdjustmentId(archetypeCodeId, lean.adjustmentId)) {
      invalidated.push({
        adjustmentId: lean.adjustmentId,
        version: lean.version,
        reason: LEAN_INVALIDATION_REASONS.NOT_IN_MENU,
      });
      continue;
    }
    // Version currency: the equipped pin must match the LIVE text version —
    // a bumped canonical means the user confirmed different wording; never
    // render stale text (they re-confirm by re-equipping at current).
    const liveVersion = getCanonicalTextVersion(archetypeCodeId, lean.adjustmentId);
    if (lean.version !== liveVersion) {
      invalidated.push({
        adjustmentId: lean.adjustmentId,
        version: lean.version,
        reason: LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION,
      });
      continue;
    }
    valid.push({
      adjustmentId: lean.adjustmentId,
      version: lean.version,
      text: getCanonicalText(archetypeCodeId, lean.adjustmentId),
    });
  }
  return { valid, invalidated };
}
