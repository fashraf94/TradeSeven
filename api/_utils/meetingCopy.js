// api/_utils/meetingCopy.js
//
// Integrity follow-up 2 (8 Oct 2026), Part A — the server's own copy of each
// gameplan meeting it creates (founder decision Q1: M1 plus the deadline).
// Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE HOLE (integrity build §5, review I1-2): the whole `gameplanMeeting` map
// is owner-writable (firestore.rules, the agentBattles update allowlist). A
// crafted client could write `{status: 'approved', suggestedSwaps: [...]}` and
// the next check executed every leg — trades the agent never decided, no cap
// on legs (a 50-leg round trip pushed 50 banked losses out of `trades[]`:
// +497 points) — and a pending meeting with a far `expiresAt` muted the model
// for as long as the player liked.
//
// THE COPY: in the same update that writes `gameplanMeeting`, the cron writes
// `cronState.gameplanMeeting` — a field no player can write — holding only
// server values: `{ meetingId, createdAt, expiresAt, legs: [{ symbolOut,
// symbolIn, rationale, swappedInAt? }] }`. From then on only the copy decides:
//   - a leg runs only when the meeting's id matches the copy and its pair
//     matches a stored leg; each stored leg runs at most once, so at most the
//     stored number of legs run; every other leg is held and recorded
//     (`leg_not_proposed`);
//   - P6's belief is the copy's `swappedInAt`, never the meeting's;
//   - a matched leg's trade row carries the copy's `rationale`, never the
//     meeting's (enforce readiness, founder Q4 — review K1-2 of follow-up 2).
//     A copy stored before that build has no `rationale` key: its legs keep
//     the meeting's own rationale, capped, as before (`legRationaleSource`);
//   - the model waits for a pending meeting only while its id matches the copy
//     and the copy's `expiresAt` has not passed. A meeting with no matching
//     copy — planted, or created before this build — never runs and never
//     makes the agent wait.
// The cron clears the copy whenever it clears the meeting, and retires it the
// moment the meeting it was stored for has gone from the battle (deleted,
// replaced or renamed — review K1-1 / K3-1). An approval of the server's
// meeting runs whenever the cron reaches it, as today: the copy bounds WHICH
// legs run, never WHEN (review KV3 — most meetings are created after their
// own deadline, so a deadline on approvals would hold real ones; report §3).
//
// One product import: the pure capping helpers.

import { clientText, clientToken } from './executorMetadata.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The typed reason a held leg is recorded with on the meeting's history row. */
export const LEG_NOT_PROPOSED = 'leg_not_proposed';

/**
 * The typed marker (`executionOutcome`) on an approved leg the cron did not
 * attempt: an earlier leg's outcome could not be read, and neither could the
 * book after it, so no later leg ran from a picture that may no longer exist
 * (review K3-4 / KV3). No line — the leg simply did not run.
 */
export const LEG_NOT_RUN = 'not_run';

/**
 * At most this many held legs are recorded on one history row (with the total
 * in `heldLegCount`): a planted meeting can carry thousands of legs, and one
 * record per leg would grow the battle document past Firestore's limit — the
 * write would then throw before the check saved its score.
 */
export const HELD_LEG_RECORD_MAX = 20;

/**
 * The copy the cron stores beside a meeting it creates: the meeting's own id,
 * times and legs exactly as the server built them — each leg's pair, and its
 * outgoing position's entry instant exactly when P6 stamped one on the leg
 * (at SWAP_IDENTITY_MODE ≠ off, from the detector's own picture; null for a
 * creation-time position). A leg without one is checked by symbol only, as it
 * always was — so a meeting created at off and approved after a flip is
 * checked exactly as before this build (review K2-2).
 *
 * Each leg also stores its rationale, capped exactly as the trade row has
 * always capped it (`clientText`), so a server meeting approved unedited
 * writes the same row bytes (enforce readiness, founder Q4).
 */
export function serverMeetingCopy(meeting) {
  return {
    meetingId: meeting.id,
    createdAt: meeting.createdAt,
    expiresAt: meeting.expiresAt,
    legs: meeting.suggestedSwaps.map((leg) => (Object.hasOwn(leg, 'swappedInAt')
      ? { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn, rationale: clientText(leg.rationale), swappedInAt: leg.swappedInAt }
      : { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn, rationale: clientText(leg.rationale) })),
  };
}

/**
 * Where a matched leg's rationale comes from: the stored leg (`run`) when the
 * copy carries one — the server's own words, never the owner-writable
 * meeting's — and the meeting's leg only for a copy stored before the copy
 * held rationales. The caller caps the value (`clientText`), as the trade row
 * always has: a no-op on the copy's already-capped string.
 */
export function legRationaleSource(run, leg) {
  return Object.hasOwn(run, 'rationale') ? run.rationale : leg?.rationale;
}

/** The stored copy (`battle.cronState.gameplanMeeting`) when it is well formed, else null. */
export function meetingCopyOf(cronState) {
  const copy = isPlainObject(cronState) ? cronState.gameplanMeeting : null;
  if (!isPlainObject(copy) || typeof copy.meetingId !== 'string' || !copy.meetingId || !Array.isArray(copy.legs)) return null;
  return copy;
}

/** Does the battle's meeting name the meeting the copy was stored for? */
export function meetingMatchesCopy(meeting, copy) {
  return !!copy && isPlainObject(meeting) && typeof meeting.id === 'string' && meeting.id === copy.meetingId;
}

/**
 * The approval plan for `legs` (meetingLegsOf, in the meeting's own order):
 * each leg with the stored leg it runs as (`run`), or `run: null` — held. A
 * leg runs only when the meeting matches the copy and its pair equals a stored
 * leg's (strictly — a planted value can match only the server's own strings)
 * that no earlier leg used: each stored leg runs at most once.
 *
 * @returns {{ index: number, leg: object, run: object|null }[]}
 */
export function planApprovedLegs(meeting, legs, copy) {
  const matches = meetingMatchesCopy(meeting, copy);
  const used = new Set();
  return legs.map(({ index, leg }) => {
    if (matches) {
      const at = copy.legs.findIndex((stored, i) => !used.has(i) && isPlainObject(stored)
        && typeof stored.symbolOut === 'string' && stored.symbolOut === leg.symbolOut
        && typeof stored.symbolIn === 'string' && stored.symbolIn === leg.symbolIn);
      if (at >= 0) {
        used.add(at);
        return { index, leg, run: copy.legs[at] };
      }
    }
    return { index, leg, run: null };
  });
}

/** The history record of a held leg: what it named, capped — never its other values. */
export function heldLegRecord(leg) {
  return { symbolOut: clientToken(leg?.symbolOut), symbolIn: clientToken(leg?.symbolIn), reason: LEG_NOT_PROPOSED };
}

/**
 * The instant (ms) until which a pending meeting makes the model wait, or null
 * when it never does: only a meeting that matches the copy waits, and only
 * until the copy's `expiresAt`. A copy whose deadline cannot be read waits for
 * nothing.
 */
export function meetingWaitUntilMs(meeting, copy) {
  if (!meetingMatchesCopy(meeting, copy)) return null;
  const ms = typeof copy.expiresAt === 'string' ? new Date(copy.expiresAt).getTime() : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}
