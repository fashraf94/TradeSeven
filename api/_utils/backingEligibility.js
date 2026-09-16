// api/_utils/backingEligibility.js
//
// Backing Beta PR 2 — MAY THIS ACCOUNT BACK THIS SEAT? (spec V1.3 §8 integrity,
// §5 the attestation at Confirm, §12 PR 2; Amendment A §A2 D-aa and §A3 D-ab.)
//
// ONE FUNCTION, FIVE CHECKS, EVERY ONE SERVER-SIDE. The client renders copy from
// the reason; it never decides. Each reason is a STABLE STRING PR 4 maps to that
// copy — this module ships no UI text, and the vocabulary below is the single
// source both the endpoint and its tests name (§9 display-agreement applied to a
// status word, the `POOL_INELIGIBLE` shape from PR 1).
//
// THE ORDER IS DELIBERATE and the tests pin it:
//   1. `account_required` — an ANONYMOUS Firebase account cannot back (D-ab). It
//      is a property of the CALLER, costs no read, and is checked first so an
//      anonymous caller is told the thing it can actually act on rather than
//      being sent to attest a consent record it may not hold.
//   2. `eligibility_required` — no attestation, or one recorded under a DIFFERENT
//      `TERMS_VERSION` (D-aa: a terms revision forces re-attestation, so a stale
//      version counts as ABSENT). One `eligibility/{uid}` read.
//   3. `own_pod` — the caller is seated in this pod, so NO seat in it is backable
//      by them: not their own, and not a rival's (§8). The account-level rule.
//   4. `seat_not_present` — the named team is not in `players[]` AT STAKE TIME.
//      Slot-pod seats are mutable until fire (§1), so a seat can vanish between
//      the pod list and Confirm.
//   5. `no_completed_battle` — the §8 detective speed bump: one completed battle
//      on the account, through the EXISTING `agentBattles (ownerId, status,
//      completedAt)` composite. ONE query, bounded to 1 — zero new indexes.
//
// THE SIGN-IN PROVIDER IS READ FROM THE VERIFIED TOKEN, NEVER FROM THE BODY
// (D-ab, §8). `requireAuth` returns the decoded token; its
// `firebase.sign_in_provider` claim is minted by Firebase Auth and cannot be
// forged by the caller. A body field would be the caller asserting their own
// eligibility, which is exactly what §9 forbids.
//
// WHICH READS ARE TRANSACTIONAL, STATED EXACTLY. The stake endpoint calls this
// INSIDE its single transaction, before any write (§8). The two checks that must
// be transactionally consistent — own-pod and seat-present — read the GROUP DOC
// THE CALLER ALREADY READ IN THE TRANSACTION, which is why `group` is a
// parameter and not something this module fetches: a seat that leaves between
// the check and the write must abort the stake, and only the caller's own
// `tx.get` can make that true. The attestation and the completed-battle probe
// are PLAIN reads: neither is contended (the attestation has one writer and is
// append-only in practice; a battle completing mid-transaction can only ever
// admit a caller who was about to become eligible anyway), and making them
// transactional would put every stake on the same two documents for no
// guarantee.
//
// AN ATTESTATION IS NOT VERIFICATION (§8) and this module does not pretend
// otherwise: a present, current-version doc means this uid affirmed both
// statements. Own-pod is likewise an ACCOUNT-level rule (§8) — it does not stop
// a person with a second account from backing their own team, and the spec says
// so plainly rather than claiming a protection that does not exist.
//
// Imports the zero-import constants module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS module
// is the dependency-surface guard — never mock it.

import { getEligibility } from './eligibility.js';
import { seatedIdsFor } from './backingPools.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';

/** The collection the speed bump queries (§8). Reused, never written here. */
export const AGENT_BATTLES_COLLECTION = 'agentBattles';

/** The completed-battle status the speed bump keys on (`agentBattles.status`). */
export const COMPLETED_BATTLE_STATUS = 'completed';

/** The Firebase sign-in provider an anonymous account carries (D-ab). */
export const ANONYMOUS_SIGN_IN_PROVIDER = 'anonymous';

/**
 * Every reason this module can return. Stable strings PR 4 maps to copy; no UI
 * text lives here (§5 — the build ships copy in PR 4, counsel owns the
 * attestation strings).
 */
export const BACKING_INELIGIBLE = Object.freeze({
  ACCOUNT_REQUIRED: 'account_required',
  ELIGIBILITY_REQUIRED: 'eligibility_required',
  OWN_POD: 'own_pod',
  SEAT_NOT_PRESENT: 'seat_not_present',
  NO_COMPLETED_BATTLE: 'no_completed_battle',
});

/**
 * The sign-in provider off a VERIFIED decoded token, or null.
 *
 * `verifyIdToken` returns the provider at `firebase.sign_in_provider`; the
 * top-level `provider_id` is present on some token shapes and is read as a
 * fallback so a future SDK shape cannot silently turn an anonymous account into
 * an unknown (and therefore ADMITTED) one. Fail-closed is not available here —
 * an unknown provider must not refuse every real caller — so the fallback is the
 * guard instead, and the endpoint test pins both shapes.
 */
export function signInProviderOf(decodedToken) {
  const nested = decodedToken?.firebase?.sign_in_provider;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  const flat = decodedToken?.provider_id;
  return typeof flat === 'string' && flat.length > 0 ? flat : null;
}

/**
 * Has this account completed at least one battle? (§8 detective control.)
 *
 * The EXISTING `(ownerId ASC, status ASC, completedAt DESC)` composite serves it
 * exactly — the same index `useRecentCompletedAgentBattles` uses on the client —
 * so the beta adds NO index for this check (§6: zero new indexes beyond the two
 * stake composites). Bounded to 1: the question is existence, not a list.
 *
 * A READ FAILURE IS NOT "NOT ELIGIBLE". It throws, and the endpoint answers 500,
 * because an outage that silently read as ineligible would refuse every stake in
 * the beta and look like a product decision (the `requireEligibility` posture,
 * eligibility.js).
 */
export async function hasCompletedBattle(db, uid) {
  const snap = await db.collection(AGENT_BATTLES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('status', '==', COMPLETED_BATTLE_STATUS)
    .orderBy('completedAt', 'desc')
    .limit(1)
    .get();
  return snap.size > 0;
}

/**
 * May `uid` stake on `teamOdUserId` in this pod? (§8.)
 *
 * @param {Object} db
 * @param {Object} args
 * @param {string} args.uid                the caller, from the verified token.
 * @param {Object} args.decodedToken       the verified token (for the provider).
 * @param {Object} args.group              the group doc the CALLER read — see the
 *                                         module header on transactional reads.
 * @param {string} args.teamOdUserId       the seat being backed.
 * @returns {Promise<{allowed: boolean, reason: string|null}>} `reason` is null
 *   exactly when `allowed` is true.
 */
export async function checkBackingEligibility(db, { uid, decodedToken, group, teamOdUserId } = {}) {
  // 1. The account itself (D-ab) — no read.
  if (signInProviderOf(decodedToken) === ANONYMOUS_SIGN_IN_PROVIDER) {
    return { allowed: false, reason: BACKING_INELIGIBLE.ACCOUNT_REQUIRED };
  }

  // 2. The attestation, at the CURRENT terms version (D-aa). A doc recorded
  //    under a superseded version counts as ABSENT — the same 403 and the same
  //    reason, so PR 4's AttestationStep re-presents the terms without needing a
  //    second code path.
  const attestation = await getEligibility(db, uid);
  if (!attestation || attestation.termsVersion !== TERMS_VERSION) {
    return { allowed: false, reason: BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED };
  }

  // 3. Own-pod, then 4. seat-present — both off the caller's transactional read.
  const seated = seatedIdsFor(group);
  if (seated.has(uid)) return { allowed: false, reason: BACKING_INELIGIBLE.OWN_POD };
  if (!seated.has(teamOdUserId)) {
    return { allowed: false, reason: BACKING_INELIGIBLE.SEAT_NOT_PRESENT };
  }

  // 5. The speed bump — last, because it is the only remaining query and the
  //    four cheaper refusals above have already answered most callers.
  if (!(await hasCompletedBattle(db, uid))) {
    return { allowed: false, reason: BACKING_INELIGIBLE.NO_COMPLETED_BATTLE };
  }

  return { allowed: true, reason: null };
}
