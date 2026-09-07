// api/_utils/directiveFiling.js
//
// THE ONE SHAPE OF A PERSISTED DIRECTIVE, and the per-battle chat budget it
// is charged against — shared by the two writers that file one:
//
//   · the chat turn (api/agent/chat.js), where the gate mints the id and the
//     canonical text after the model's reply;
//   · the deterministic filing route (api/agent/file-directive.js — voice-layer
//     grounding §6.1), where a chip files an id with no model call.
//
// Phase 0 item 9 note 4: a chip-filed directive is byte-shaped like a
// gate-minted one ONLY if it carries `adjustmentId` and `canonicalTextVersion`
// — the lean/opposition logic in the fenced assembler binds to them — so the
// route must copy the ENFORCE-path shape, never the legacy one, and never a
// parallel schema (spec §9 gate 0b, M4). Two literals in two files is how a
// shape drifts; one function is how it cannot (BUILD_RULES §9). The chat turn's
// output is unchanged field for field — chat.test.js's ENFORCE and flag-OFF
// rows pin it, and the flag-OFF legacy shape (no id, no version) is exactly
// what the conditional spread below still writes.
//
// ZERO imports: consumed by both routes and by their tests.

/**
 * The exchange's `directive` record (chat.js `exchange.directive`).
 *
 * @param {{ text: string, expiry?: string, adjustmentId?: string, canonicalTextVersion?: number }} normalized
 * @param {string} directiveThreadId  minted once per filing (randomUUID)
 */
export function buildDirectiveRecord(normalized, directiveThreadId) {
  return {
    text: normalized.text,
    expiry: normalized.expiry || 'end_of_battle',
    directiveThreadId,
    // Release 2 (spec Phase 1 item 5) — additive id+version from the gate, so
    // directive-vs-lean opposition binds to both canonicalTextVersions. Present
    // ONLY when minted: the legacy (flag-off) normalizeDirective path writes
    // its exact pre-Release-2 shape, keeping the OFF state byte-identical.
    ...(normalized.adjustmentId != null ? {
      adjustmentId: normalized.adjustmentId,
      canonicalTextVersion: normalized.canonicalTextVersion ?? null,
    } : {}),
  };
}

/**
 * The battle's single active-directive slot (`battle.directive`) — the record
 * above plus the filing instant. D-18 latest-wins is by construction: the
 * whole object is set; nothing reads the prior slot.
 */
export function buildDirectiveSlot(normalized, directiveThreadId, createdAt) {
  return {
    text: normalized.text,
    expiry: normalized.expiry || 'end_of_battle',
    directiveThreadId,
    createdAt,
    ...(normalized.adjustmentId != null ? {
      adjustmentId: normalized.adjustmentId,
      canonicalTextVersion: normalized.canonicalTextVersion ?? null,
    } : {}),
  };
}

/**
 * The per-battle chat budget (the Battle View's ten messages) — the field on
 * the battle doc and its cap. chat.js's MODE_BUDGET.battle reads it from here,
 * and so does the filing route (spec §6.4: a filed directive charges one
 * message, the D-31 cost), so the two chargers cannot disagree on the cap.
 */
export const BATTLE_CHAT_BUDGET = Object.freeze({ field: 'chatBudgetUsed', limit: 10 });
