// api/_utils/eligibility.js
//
// Backing Beta PR 0 — the eligibility attestation READ side (spec V1.3 §6 /
// §8 / §12 PR 0; ruling D-z).
//
// `eligibility/{uid}` is SERVER-WRITTEN and owner-read (`write: if false` in
// firestore.rules — the tournamentRanks pattern). It cannot live on
// `users/{uid}`, which is owner-writable and therefore not authoritative
// (addendum §2 Q3). The only writer is POST /api/eligibility/attest
// (api/eligibility/attest.js); this module is the read every backing endpoint
// gates on at Confirm (§8: the stake transaction reads wallet + ELIGIBILITY +
// …; §12 PR 2: backingEligibility.js → requireEligibility).
//
// NOT CALLED BY ANY ROUTE IN PR 0. The first caller is PR 2. The attestation is
// an attestation, not verification (§8): a present doc means this uid affirmed
// both statements under the recorded terms version, nothing more.
//
// AMENDMENT A §A2 (D-aa) LIVES HERE, in `requireEligibility`, because §A2 names
// this function: "requireEligibility (PR 2) treats an attestation whose
// `termsVersion` differs from the current TERMS_VERSION as absent → 403
// `eligibility_required`". Putting the comparison in PR 2's backing-specific
// checker instead would give the rule two homes, and the NEXT consumer of this
// primitive (§11 gate 2 offers it to tournament entry later) would silently get
// pre-A2 behaviour — the §9 display-agreement failure mode applied to a gate.

import { TERMS_VERSION } from '../../src/constants/eligibility.js';

/** The collection; the doc id is the Firebase Auth uid. */
export const ELIGIBILITY_COLLECTION = 'eligibility';

/** The code the backing endpoints map to 403 (§12 PR 2). */
export const ELIGIBILITY_REQUIRED_CODE = 'eligibility_required';

/**
 * Thrown by requireEligibility when no attestation exists. Typed (the
 * EpochClosedError shape) so a caller can `instanceof` it — or read `.code` /
 * `.statusCode` — and answer 403 without string-matching a message. A read
 * FAILURE is deliberately not this error: an outage must never read as "not
 * eligible".
 */
export class EligibilityRequiredError extends Error {
  constructor(uid = null) {
    super(ELIGIBILITY_REQUIRED_CODE);
    this.name = 'EligibilityRequiredError';
    this.code = ELIGIBILITY_REQUIRED_CODE;
    this.statusCode = 403;
    this.uid = uid;
  }
}

/** The `eligibility/{uid}` document reference. */
export function eligibilityRef(db, uid) {
  return db.collection(ELIGIBILITY_COLLECTION).doc(uid);
}

/**
 * The attestation doc's data, or null when the user has never attested.
 * A plain read — no transaction; the stake path re-reads inside its own.
 * A missing or non-string uid is null without a read (an empty doc id would
 * throw inside the Admin SDK, and there is nothing to look up).
 */
export async function getEligibility(db, uid) {
  if (typeof uid !== 'string' || uid.length === 0) return null;
  const snap = await eligibilityRef(db, uid).get();
  if (!snap.exists) return null;
  return snap.data() ?? null;
}

/**
 * The attestation doc, or throws EligibilityRequiredError (→ 403 at the
 * endpoint that maps it). Never returns null.
 */
export async function requireEligibility(db, uid) {
  const doc = await getEligibility(db, uid);
  // A STALE TERMS VERSION COUNTS AS ABSENT (§A2, D-aa): same error, same code,
  // same 403, so a caller needs no second branch and PR 4's AttestationStep
  // re-presents the terms for either case. The 18+ affirmation does not expire
  // — the attest endpoint keeps `adultAttestedAt` across a re-attestation — but
  // the terms acceptance does.
  if (!doc || doc.termsVersion !== TERMS_VERSION) throw new EligibilityRequiredError(uid);
  return doc;
}
