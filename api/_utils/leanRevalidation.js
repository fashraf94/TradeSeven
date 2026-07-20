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
import { MASTERY_ENFORCEMENT_ENABLED } from './masteryConfig.js';

// Master spec §3.1 — the domain cap lives here (the validity kernel), and the
// equip endpoint imports it, so the write path and the snapshot path can
// never disagree on the limit. Mastery P2: this is the BASELINE (= mastery
// L1's two slots); level-derived caps are grants above it, resolved by
// resolveLeanCap below.
export const STANDING_LEANS_CAP = 2;

// Mastery caps are grants in [baseline .. 4] (§6: L3 → 3, L6 → 4).
const MASTERY_LEAN_CAP_MAX = 4;

/**
 * Mastery P2 (spec §6 D1 dual anchor — the SNAPSHOT/kernel half): the lean
 * cap the revalidation applies for this agent. With enforcement off this is
 * the baseline constant (byte-identical behavior). With enforcement on it
 * reads the server-stamped `agent.masteryLeanCap` — written by the
 * equip-lean chokepoint's transaction from the live masteryProfile (the
 * WRITE half of the dual anchor), client-write-denied by the agents
 * allowlist — failing toward baseline on anything malformed. Grants-only by
 * construction: the resolved cap is never below baseline, so enforcement
 * can only widen what the kernel accepts (unlocks never revoke).
 *
 * All mastery logic stays HERE (non-fence): the fenced createAgentBattle
 * call site passes the same agentData it always has.
 */
export function resolveLeanCap(agentData, enforcementEnabled = MASTERY_ENFORCEMENT_ENABLED) {
  if (enforcementEnabled !== true) return STANDING_LEANS_CAP;
  const stamped = agentData?.masteryLeanCap;
  if (Number.isInteger(stamped) && stamped >= STANDING_LEANS_CAP && stamped <= MASTERY_LEAN_CAP_MAX) {
    return stamped;
  }
  return STANDING_LEANS_CAP;
}

export const LEAN_INVALIDATION_REASONS = Object.freeze({
  MALFORMED: 'malformed',
  NOT_IN_MENU: 'not_in_menu',
  DEPRECATED_VERSION: 'deprecated_version',
  // At-rest set violations (re-asserted at snapshot time; see
  // revalidateStandingLeans header): a conflict group adjudicated AFTER two
  // leans were legally equipped, or a cap tightened after the fact.
  CONFLICTING_LEAN: 'conflicting_lean',
  OVER_CAP: 'over_cap',
  // A same-id pin appearing twice at rest (unreachable via equip-lean, which
  // replaces same-id — but standingLeans is owner-writable via the client
  // SDK, and a duplicate would render one sentence twice at double emphasis
  // AND eat a cap slot; /code-review Phase-5). First occurrence wins.
  DUPLICATE_PIN: 'duplicate_pin',
});

// The invalidated record is bounded (/code-review, Phase-2): agent.standingLeans
// is owner-writable via the client SDK, so a garbage pin's raw strings must
// never flow uncapped into the battle doc (a few 100 KB ids could push
// createAgentBattle past Firestore's 1 MiB doc limit and 500 every deploy —
// the additive keys must NEVER be able to break battle creation). Valid pins
// need no cap: they passed isValidAdjustmentId, so their ids are canonical.
const MAX_INVALIDATED_ID_CHARS = 32;
const MAX_INVALIDATED_RECORDS = 20;
const boundId = (id) => (typeof id === 'string' ? id.slice(0, MAX_INVALIDATED_ID_CHARS) : null);
const boundInvalidated = (records) =>
  records.length <= MAX_INVALIDATED_RECORDS
    ? records
    : [
        ...records.slice(0, MAX_INVALIDATED_RECORDS),
        { adjustmentId: null, version: null, reason: LEAN_INVALIDATION_REASONS.MALFORMED, truncatedCount: records.length - MAX_INVALIDATED_RECORDS },
      ];

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
export function revalidateStandingLeans({ standingLeans = [], archetypeCodeId, leanCap = STANDING_LEANS_CAP } = {}) {
  const invalidated = [];

  // Pass 1 — per-pin validity through the shared rule, plus same-id dedupe
  // (first occurrence wins; conflict groups self-exclude same-id, so without
  // this a duplicate at-rest pin would pass every later check twice).
  const pinValid = [];
  const seenIds = new Set();
  for (const lean of Array.isArray(standingLeans) ? standingLeans : []) {
    const verdict = validateLeanPin(archetypeCodeId, lean?.adjustmentId, lean?.version);
    if (!verdict.ok) {
      invalidated.push({
        adjustmentId: boundId(lean?.adjustmentId),
        version: typeof lean?.version === 'number' ? lean.version : null,
        reason: verdict.reason,
      });
      continue;
    }
    if (seenIds.has(lean.adjustmentId)) {
      invalidated.push({
        adjustmentId: lean.adjustmentId,
        version: lean.version,
        reason: LEAN_INVALIDATION_REASONS.DUPLICATE_PIN,
      });
      continue;
    }
    seenIds.add(lean.adjustmentId);
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
    if (accepted.length >= leanCap) {
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
  return { valid, invalidated: boundInvalidated(invalidated) };
}

/**
 * The Release-2 customization-snapshot builder (fenced site 1 delegates to
 * THIS non-fenced function, so future logic tweaks — log payload, new
 * invalidation reasons, the settingsRev default — are ordinary changes, not
 * fence re-authorizations). Returns the four additive agentContext keys;
 * emits the [LeanRevalidation] event line when pins were omitted.
 *
 * @param {Object} agentData the full agent doc createAgentBattle received
 * @param {string} now       the creation timestamp (caller-owned)
 */
export function buildCustomizationSnapshot(agentData, now) {
  const { valid, invalidated } = revalidateStandingLeans({
    standingLeans: agentData.standingLeans,
    archetypeCodeId: agentData.archetype,
    // Mastery P2 dual anchor (kernel half): level-derived cap via the
    // stamped field; baseline (byte-identical) while enforcement is off.
    leanCap: resolveLeanCap(agentData),
  });
  if (invalidated.length > 0) {
    console.log('[LeanRevalidation]', JSON.stringify({
      agentId: agentData.id ?? null,
      archetype: agentData.archetype ?? null,
      invalidated,
      at: now,
    }));
  }
  return {
    standingLeans: valid,
    standingLeansInvalidated: invalidated,
    // BOUNDED like the invalidated records above (/code-review Phase-5):
    // agent.dials is owner-writable via the client SDK, so only a SHORT
    // STRING may enter the battle doc — a 1 MiB garbage value must never be
    // able to break battle creation. Sliced, not validated-against-the-menu:
    // an unknown-but-short desired value stays VISIBLE and fails closed at
    // the clamp (unknown_tempo_value), preserving desired-vs-effective.
    dials: typeof agentData.dials?.tempo === 'string' && agentData.dials.tempo
      ? { tempo: agentData.dials.tempo.slice(0, MAX_INVALIDATED_ID_CHARS) }
      : null,
    settingsRev: typeof agentData.settingsRev === 'number' ? agentData.settingsRev : 0,
  };
}
