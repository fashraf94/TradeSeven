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

import { isValidAdjustmentId, getCanonicalText, getCanonicalTextVersion, findEquipConflicts } from '../../src/data/archetypeAdjustments.js';

// Master spec §3.1 — the domain cap lives here (the validity kernel), and the
// equip endpoint imports it, so the write path and the snapshot path can
// never disagree on the limit.
export const STANDING_LEANS_CAP = 2;

export const LEAN_INVALIDATION_REASONS = Object.freeze({
  MALFORMED: 'malformed',
  NOT_IN_MENU: 'not_in_menu',
  DEPRECATED_VERSION: 'deprecated_version',
  // At-rest set violations (re-asserted at snapshot time; see
  // revalidateStandingLeans header): a conflict group adjudicated AFTER two
  // leans were legally equipped, or a cap tightened after the fact.
  CONFLICTING_LEAN: 'conflicting_lean',
  OVER_CAP: 'over_cap',
});

/**
 * THE single per-pin validity rule (menu membership + version currency),
 * shared by the equip write path (api/agent/equip-lean.js maps reasons onto
 * its HTTP sentinels) and the snapshot revalidation below — one authority,
 * so equip can never accept a pin revalidation would omit, or vice versa.
 *
 * @returns {{ok: true}|{ok: false, reason: string}}
 */
export function validateLeanPin(archetypeCodeId, adjustmentId, version) {
  if (typeof adjustmentId !== 'string' || !adjustmentId || typeof version !== 'number') {
    return { ok: false, reason: LEAN_INVALIDATION_REASONS.MALFORMED };
  }
  if (!isValidAdjustmentId(archetypeCodeId, adjustmentId)) {
    return { ok: false, reason: LEAN_INVALIDATION_REASONS.NOT_IN_MENU };
  }
  if (version !== getCanonicalTextVersion(archetypeCodeId, adjustmentId)) {
    return { ok: false, reason: LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION };
  }
  return { ok: true };
}

/**
 * Revalidates the FULL equip-time invariant set, not just per-pin validity:
 * menu membership + version currency (via validateLeanPin), then the at-rest
 * SET checks — conflict-group exclusion and the cap. The set checks exist
 * because the equip-time gate is not sufficient over time: conflict groups
 * are adjudication-gated and WILL change after leans were legally equipped,
 * so the last gate before the prompt must re-assert "never both sides of a
 * contradiction" (spec changelog #8) itself. Deterministic loser on a
 * conflict/cap breach: the LATER-equipped lean is omitted (missing
 * equippedAt loses); "data kept" as everywhere — omission + record only.
 * [Extends the spec Phase-1 item-7 check list (menu + currency) — flagged
 * for founder ratification in the Phase-1 report.]
 *
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
  const invalidated = [];

  // Pass 1 — per-pin validity through the shared rule.
  const pinValid = [];
  for (const lean of Array.isArray(standingLeans) ? standingLeans : []) {
    const verdict = validateLeanPin(archetypeCodeId, lean?.adjustmentId, lean?.version);
    if (!verdict.ok) {
      invalidated.push({
        adjustmentId: typeof lean?.adjustmentId === 'string' ? lean.adjustmentId : null,
        version: typeof lean?.version === 'number' ? lean.version : null,
        reason: verdict.reason,
      });
      continue;
    }
    pinValid.push(lean);
  }

  // Pass 2 — at-rest set checks in deterministic equip order (earlier
  // equippedAt wins; ISO strings compare lexicographically BY CODE POINT —
  // not localeCompare, whose collation can move punctuation before digits;
  // a missing stamp sorts as '~' (after all digits) so it loses ties).
  const sortKey = (l) => String(l.equippedAt ?? '~');
  const ordered = [...pinValid].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const accepted = [];
  for (const lean of ordered) {
    const conflicts = findEquipConflicts(
      archetypeCodeId,
      lean.adjustmentId,
      accepted.map((l) => l.adjustmentId),
    );
    if (conflicts.length > 0) {
      invalidated.push({
        adjustmentId: lean.adjustmentId,
        version: lean.version,
        reason: LEAN_INVALIDATION_REASONS.CONFLICTING_LEAN,
      });
      continue;
    }
    if (accepted.length >= STANDING_LEANS_CAP) {
      invalidated.push({
        adjustmentId: lean.adjustmentId,
        version: lean.version,
        reason: LEAN_INVALIDATION_REASONS.OVER_CAP,
      });
      continue;
    }
    accepted.push(lean);
  }

  // Snapshot shape (master spec §3.1): id + version + RESOLVED CURRENT text,
  // in the original equip order for prompt stability.
  const acceptedIds = new Set(accepted.map((l) => l.adjustmentId));
  const valid = pinValid
    .filter((l) => acceptedIds.has(l.adjustmentId))
    .map((lean) => ({
      adjustmentId: lean.adjustmentId,
      version: lean.version,
      text: getCanonicalText(archetypeCodeId, lean.adjustmentId),
    }));
  return { valid, invalidated };
}
