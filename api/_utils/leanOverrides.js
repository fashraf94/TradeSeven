// api/_utils/leanOverrides.js
//
// Release 2 (Fenced Customization Bundle V1.1) — battle.leanOverrides[]
// machinery (spec Phase 1 item 5 / changelog #6). PURE builders + queries;
// nothing here writes Firestore. The Phase-2 PR-a wiring (chat.js confirm
// flow) composes these; the shared renderer already consumes the records
// (controlPromptRenderer.js — override suppression + structural expiry).
//
// RECORD SHAPE (one record per opposed lean; ONE confirmation covers all):
//   battle.leanOverrides[] = [{
//     directiveInstanceId,   // the overriding directive's directiveThreadId
//     directiveAdjustmentId, // its allowlist id
//     directiveVersion,      // its canonicalTextVersion at confirm time
//     leanId,                // the overridden lean's adjustmentId
//     leanVersion,           // the overridden lean's pinned version
//     confirmedAt,           // ISO — the user's one-battle confirmation
//   }]
//
// CARDINALITY + EXPIRY (spec changelog #6): the battle has a single directive
// slot, so overrides bind to ONE directive instance. A superseding directive
// (new directiveThreadId) expires prior overrides WITH the directive it rode —
// structurally: resolution matches directiveInstanceId, so stale records are
// inert without any cleanup write. Writers should still REPLACE the array
// wholesale on a new confirmation (never append across instances) to keep the
// at-rest record readable.

import { getOpposedLeanIds } from '../../src/data/archetypeAdjustments.js';

/**
 * The equipped leans a directive opposes (directed directive→lean edges via
 * the conflict groups). This is the set ONE confirmation covers.
 *
 * @param {string} archetypeCodeId  the battle's snapshotted archetype
 * @param {string} directiveAdjustmentId
 * @param {Array<{adjustmentId: string}>} equippedLeans battle-snapshot leans
 * @returns {Array<{adjustmentId: string}>} the opposed subset, in equip order
 */
export function computeOpposedLeans(archetypeCodeId, directiveAdjustmentId, equippedLeans = []) {
  const leans = Array.isArray(equippedLeans) ? equippedLeans.filter((l) => l && l.adjustmentId) : [];
  const opposedIds = new Set(
    getOpposedLeanIds(archetypeCodeId, directiveAdjustmentId, leans.map((l) => l.adjustmentId)),
  );
  return leans.filter((l) => opposedIds.has(l.adjustmentId));
}

/**
 * Build the full battle.leanOverrides[] replacement for one confirmed
 * directive (one record per opposed lean, all sharing the directive
 * instance). Pure — `confirmedAt` is caller-supplied.
 *
 * @param {Object} p
 * @param {{directiveThreadId: string, adjustmentId: string, canonicalTextVersion: number|null}} p.directive
 * @param {Array<{adjustmentId: string, version?: number}>} p.opposedLeans
 * @param {string} p.confirmedAt ISO timestamp of the user's confirmation
 */
export function buildLeanOverrideRecords({ directive, opposedLeans = [], confirmedAt }) {
  if (!directive || !directive.directiveThreadId || !directive.adjustmentId) return [];
  return opposedLeans
    .filter((l) => l && l.adjustmentId)
    .map((lean) => ({
      directiveInstanceId: directive.directiveThreadId,
      directiveAdjustmentId: directive.adjustmentId,
      directiveVersion: directive.canonicalTextVersion ?? null,
      leanId: lean.adjustmentId,
      leanVersion: typeof lean.version === 'number' ? lean.version : null,
      confirmedAt,
    }));
}

/**
 * The override records that are ACTIVE for a given directive instance —
 * everything else is structurally expired (superseded or directive-less).
 */
export function activeOverridesFor(directiveThreadId, leanOverrides = []) {
  if (!directiveThreadId) return [];
  return (Array.isArray(leanOverrides) ? leanOverrides : []).filter(
    (o) => o && o.directiveInstanceId === directiveThreadId,
  );
}
