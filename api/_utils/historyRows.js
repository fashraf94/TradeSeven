// api/_utils/historyRows.js
//
// Integrity build — client-forged proposal data (7 Oct 2026; founder decision
// F3, verifier SV3 of the P6 review). The base of every `proposalHistory[]`
// and `gameplanMeetingHistory[]` row the cron writes.
//
// A pending proposal and a pending gameplan meeting live in owner-writable
// fields (firestore.rules, the agentBattles update allowlist). When the cron
// resolves one it files the record into history — and, before this build, it
// copied the record whole, so an owner could plant `executionFailed`,
// `executionRefusal`, `verification`, a `systemNote` or a score and have the
// server file it as its own result (the P6 census counts those fields).
//
// The rule: a history row keeps the record's own fields (what was proposed,
// and the player's own act on it — status, resolution, resolvedAt, resolvedBy,
// userReason), MINUS every outcome field below. The cron then adds the
// outcome fields of THIS resolution from its own results only.
//
// ZERO product imports.

/**
 * Outcome fields: what the server writes on a history row as the result of
 * resolving it (P6's honest-record markers, the identity check's records, the
 * launch guard's note, the resolution-time scores and veto prices), plus the
 * result fields history readers consume as outcomes (the voice layer's
 * counterfactual and outcome points, api/_utils/voiceLayerPrompt.js).
 */
export const HISTORY_OUTCOME_KEYS = Object.freeze([
  'executionFailed', 'executionRefusal', 'verification', 'legRefusals',
  'systemNote', 'scoreAtResolution', 'scoreAtVeto', 'vetoedAtPrice', 'vetoedAtTimestamp',
  'counterfactualPoints', 'outcomePoints', 'lockedPoints', 'closedTrade',
]);

const OUTCOME = new Set(HISTORY_OUTCOME_KEYS);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** `record` without its outcome fields, in its own key order. A non-object is returned as it is. */
function withoutOutcomes(record) {
  if (!isPlainObject(record)) return record;
  const out = {};
  for (const key of Object.keys(record)) {
    if (!OUTCOME.has(key)) out[key] = record[key];
  }
  return out;
}

/** The base of a `proposalHistory[]` row: the pending proposal minus every outcome field. */
export function proposalHistoryBase(proposal) {
  return withoutOutcomes(proposal);
}

/**
 * The base of a `gameplanMeetingHistory[]` row: the meeting minus every
 * outcome field — on the meeting and on each of its legs.
 */
export function meetingHistoryBase(meeting) {
  const base = withoutOutcomes(meeting);
  if (!isPlainObject(base) || !Array.isArray(base.suggestedSwaps)) return base;
  return { ...base, suggestedSwaps: base.suggestedSwaps.map(withoutOutcomes) };
}
