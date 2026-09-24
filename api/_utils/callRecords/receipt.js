// api/_utils/callRecords/receipt.js
//
// Cockpit Build 0 — THE COMPANION RECEIPT (spec docs/design/COCKPIT_SPEC_V1_3.md
// §3.8; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §4 `outcome`, §6).
//
// On a call's FIRST observed transition (`hit` or `expired_unresolved`) the
// flip transaction creates `agentBattles/{battleId}/callObservations/{callId}`
// and points `outcome.receiptRef` at it. The receipt holds exactly what the
// check observed — the instant, the quote (or null when the symbol was not in
// the observation), where the observation came from, and whether the prompt
// showed the name at an execution price — so the call's own wire is not
// widened (the contract's `outcome` shape is unchanged). A receipt never
// claims what the check did not observe: `px` is null rather than a stored or
// global price, and the instant is the observation's, never the write's.
//
// Pure. No I/O.

/** The receipt subcollection under a battle. */
export const RECEIPTS_SUBCOLLECTION = 'callObservations';

/** The receipt's document path — the value `outcome.receiptRef` carries. */
export function receiptPathOf(battleId, callId) {
  return `agentBattles/${battleId}/${RECEIPTS_SUBCOLLECTION}/${callId}`;
}

/**
 * The receipt document, in the spec's key order:
 * `{ callId, evalId, observedAtMs, px, source, replacedInPrompt }`.
 *
 * @param {object} p
 * @param {object} p.call          the call as re-read inside the flip transaction
 * @param {string|null} p.evalId   the check's committed identity, or null (no-entry exits)
 * @param {{ observedAtMs: number, source: string, symbols: Record<string, { px: number, replacedInPrompt?: boolean }> }} p.observation
 */
export function buildReceipt({ call, evalId, observation }) {
  const entry = typeof call?.symbol === 'string' ? observation?.symbols?.[call.symbol] : undefined;
  const px = entry && typeof entry.px === 'number' && Number.isFinite(entry.px) ? entry.px : null;
  return {
    callId: call.callId,
    evalId: evalId ?? null,
    observedAtMs: observation.observedAtMs,
    px,
    source: observation.source,
    replacedInPrompt: entry?.replacedInPrompt === true,
  };
}
