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
// symbolIn, swappedInAt? }] }`. From then on only the copy decides:
//   - a leg runs only when the meeting's id matches the copy and its pair
//     matches a stored leg; each stored leg runs at most once, so at most the
//     stored number of legs run; every other leg is held and recorded
//     (`leg_not_proposed`);
//   - P6's belief is the copy's `swappedInAt`, never the meeting's;
//   - the model waits for a pending meeting only while its id matches the copy
//     and the copy's `expiresAt` has not passed. A meeting with no matching
//     copy — planted, or created before this build — never runs and never
//     makes the agent wait.
// The cron clears the copy whenever it clears the meeting.
//
// One product import: the pure capping helper.

import { clientToken } from './executorMetadata.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The typed reason a held leg is recorded with on the meeting's history row. */
export const LEG_NOT_PROPOSED = 'leg_not_proposed';

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
 */
export function serverMeetingCopy(meeting) {
  return {
    meetingId: meeting.id,
    createdAt: meeting.createdAt,
    expiresAt: meeting.expiresAt,
    legs: meeting.suggestedSwaps.map((leg) => (Object.hasOwn(leg, 'swappedInAt')
      ? { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn, swappedInAt: leg.swappedInAt }
      : { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn })),
  };
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
