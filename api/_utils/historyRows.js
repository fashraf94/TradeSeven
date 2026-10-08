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
// One product import: the pure capping helper (api/_utils/executorMetadata.js).

import { clientToken } from './executorMetadata.js';

/**
 * Outcome fields: what the server writes on a history row as the result of
 * resolving it (P6's honest-record markers, the identity check's records, the
 * launch guard's note, the resolution-time scores and veto prices), plus the
 * result fields history readers consume as outcomes (the voice layer's
 * counterfactual and outcome points, api/_utils/voiceLayerPrompt.js).
 * Integrity follow-up 2 adds the meeting's held legs (Part A) and the
 * retry-safe markers (Part D) — written by the server only.
 */
export const HISTORY_OUTCOME_KEYS = Object.freeze([
  'executionFailed', 'executionRefusal', 'verification', 'legRefusals',
  'systemNote', 'scoreAtResolution', 'scoreAtVeto', 'vetoedAtPrice', 'vetoedAtTimestamp',
  'counterfactualPoints', 'outcomePoints', 'lockedPoints', 'closedTrade',
  'heldLegs', 'heldLegCount', 'executionOutcome', 'executionLanded',
]);

const OUTCOME = new Set(HISTORY_OUTCOME_KEYS);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** `record` without its outcome fields, in its own key order. A non-object is returned as it is (a leg). */
function withoutOutcomes(record) {
  if (!isPlainObject(record)) return record;
  const out = {};
  for (const key of Object.keys(record)) {
    if (!OUTCOME.has(key)) out[key] = record[key];
  }
  return out;
}

/**
 * The base of a `proposalHistory[]` row: the pending proposal minus every
 * outcome field. A record that is not a plain object contributes nothing — the
 * callers spread the base, and a spread string becomes one field per character
 * (review I1-3: a 150 KB planted string grew past Firestore's 1 MiB limit).
 */
export function proposalHistoryBase(proposal) {
  return isPlainObject(proposal) ? withoutOutcomes(proposal) : {};
}

/** The fields of a cleared proposal the launch-guard row keeps: what it named, never what it claimed. */
export const LAUNCH_GUARD_RECORD_KEYS = Object.freeze(['proposalId', 'symbolOut', 'symbolIn', 'mode', 'createdAt', 'expiresAt']);

/**
 * The base of the LAUNCH-GUARD row — the one proposal branch production runs
 * (F1: every pending proposal is cleared here, and no server path has created
 * one since 2026-05-20, so the record is a client's). The server keeps only
 * what the proposal NAMED, as capped strings, then adds its own result: never
 * its ids, evaluation metadata, snapshot, numbers or text (review I1-3 / I1-4:
 * the whole record filed into the server-only history let a planted proposal
 * grow the battle document past its limit, and lent a planted evaluation id to
 * the P6 census's belief join). Key order: LAUNCH_GUARD_RECORD_KEYS.
 */
export function launchGuardRecord(proposal) {
  if (!isPlainObject(proposal)) return {};
  const out = {};
  for (const key of LAUNCH_GUARD_RECORD_KEYS) {
    if (Object.hasOwn(proposal, key)) out[key] = clientToken(proposal[key]);
  }
  return out;
}

/**
 * The base of a `gameplanMeetingHistory[]` row: the meeting minus every
 * outcome field — on the meeting and on each of its legs.
 */
export function meetingHistoryBase(meeting) {
  if (!isPlainObject(meeting)) return {};
  const base = withoutOutcomes(meeting);
  if (!Array.isArray(base.suggestedSwaps)) return base;
  return { ...base, suggestedSwaps: base.suggestedSwaps.map(withoutOutcomes) };
}
