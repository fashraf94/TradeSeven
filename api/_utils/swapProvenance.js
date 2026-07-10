// api/_utils/swapProvenance.js
//
// Release 2 (Fenced Customization Bundle V1.1) — the structured swap
// provenance SIBLING (spec changelog #14, as amended by the founder's Phase-0
// acceptance: site 4 is NO-EDIT — buildSwapReceiptSource, its exact three-key
// return, and the Gate-7 regex-locked call forms in agent-evaluate.js are
// never touched).
//
// At Phase 2 the four swap origin paths spread this ALONGSIDE the receipt:
//
//   const evaluationMetadata = {
//     ...buildSwapReceiptSource({ source: swapSource, archetype: ctx.archetype }), // untouched
//     ...buildSwapProvenance(clampResult.provenance),                              // NEW sibling
//     …
//   };
//
// The provenance nests under ONE key (swapProvenance) so no future receipt
// field can collide with it, and the Gate-7 assertions (exactly 4
// ...buildSwapReceiptSource({ spreads with byte-pinned args;
// agentRiskManager.test.js's exact-three-keys shape lock) stay green by
// construction.

/**
 * @param {{tempoDesired: string, tempoEffective: string, selectionSource: string,
 *          dialBandVersion: number, knobConfigVersion: number,
 *          suppressionReason?: string}|null|undefined} provenance
 *   The tempo clamp's provenance object (tempoDialClamp.js), already
 *   Firestore-safe (suppressionReason omitted, never undefined).
 * @returns {{swapProvenance: Object}|{}} spreadable sibling — {} when no
 *   provenance exists (pre-PR-b paths), so spreading is always safe.
 */
export function buildSwapProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object') return {};
  const out = {
    tempoDesired: provenance.tempoDesired ?? 'standard',
    tempoEffective: provenance.tempoEffective ?? 'standard',
    selectionSource: provenance.selectionSource ?? 'default',
    dialBandVersion: provenance.dialBandVersion ?? null,
    knobConfigVersion: provenance.knobConfigVersion ?? null,
  };
  // Firestore rejects undefined — the key exists only when a suppression
  // actually happened (mirrors the clamp's omit-when-clean contract).
  if (typeof provenance.suppressionReason === 'string') {
    out.suppressionReason = provenance.suppressionReason;
  }
  return { swapProvenance: out };
}
