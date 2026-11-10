// api/_utils/huddle/gate.js
//
// Huddle — the server's one read of DRB_HUDDLE_ENABLED (Amendment A §A10) and of the Huddle's own cohort,
// `HUDDLE_PLAYER_UIDS` (Amendment E §E7, amending Fable's ruling R-21). Every server path asks here: the brief handler's
// enqueue and drain stages, the worker, every /api/huddle/* route, the check-start sweep and the settle reconcile.
//
// THE COHORT FAILS CLOSED (E7): unset or blank means NO ONE, replacing S1's "unset means every active player". How
// "everyone" is expressed is ruled at the public flip (R-10). The cohort is separate from COCKPIT_ALLOWLIST_UIDS, so the
// Huddle never couples to the cockpit, calls or Film Room cards (R-21).
//
//   isHuddleOn()       the flag alone (anything but exactly `true` is off). Tests turn it on by mocking
//                      src/config/huddleFlags.js.
//   isHuddleLive(env)  "on for anyone": the flag on AND a non-empty cohort. Off, every server path behaves as with the
//                      flag off — the worker exits at once, every route is a 404 before any read, the brief writes only
//                      its huddleRuns marker (E7; build prompt hard rule 2).
//   huddleAdmits(uid)  "on for this player": the flag on and the uid in the cohort. Outside, a route answers exactly the
//                      flag-off 404, the enqueue skips the player, the sweep returns before any read.
// The env is read on every call (no cache): the founder sets the cohort in Vercel and the next invocation obeys it.

import { DRB_HUDDLE_ENABLED } from '../../../src/config/huddleFlags.js';

export const COHORT_ENV = 'HUDDLE_PLAYER_UIDS';

export function isHuddleOn() {
  return DRB_HUDDLE_ENABLED === true;
}

/** The cohort: the comma-separated uids of HUDDLE_PLAYER_UIDS, trimmed. Unset, blank or not a string → the EMPTY set. */
export function huddleCohortOf(env = process.env) {
  const raw = env?.[COHORT_ENV];
  if (typeof raw !== 'string') return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

/** On for anyone: the flag on and at least one uid in the cohort. */
export function isHuddleLive(env = process.env) {
  return isHuddleOn() && huddleCohortOf(env).size > 0;
}

/** On for this player: the flag on and the uid in the cohort. A missing or empty uid is never admitted. */
export function huddleAdmits(uid, env = process.env) {
  return isHuddleOn() && typeof uid === 'string' && uid.length > 0 && huddleCohortOf(env).has(uid);
}
