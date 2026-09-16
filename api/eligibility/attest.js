// api/eligibility/attest.js
//
// POST /api/eligibility/attest — Backing Beta PR 0, the eligibility attestation
// (spec V1.3 §5 / §6 / §8 / §12 PR 0; ruling D-z). A PLATFORM PRIMITIVE: the
// first age, terms or consent state the platform has held (addendum §2 Q3 —
// nothing existed). The ONE writer of `eligibility/{uid}`; the read side is
// api/_utils/eligibility.js (getEligibility / requireEligibility), which no
// route calls yet — PR 2's stake path is its first caller.
//
// THE ORDER (the research.js shape):
//   1  security middleware + rate limit
//   2  method — POST only
//   3  auth — the uid from the token, never the body
//   4  THE FLAG — 404 while ELIGIBILITY_ATTESTATION_ENABLED is dark, AFTER
//      auth (research.js review E-3: a 404 in front of the auth check answers
//      an anonymous caller differently while dark and while lit, a free oracle
//      on an unreleased feature's rollout state)
//   4b THE ACCOUNT — Amendment A §A3 (D-ab): an ANONYMOUS Firebase account is
//      refused 403 `account_required`, because a consent record needs an account
//      that persists. Read from the VERIFIED token, never the body.
//   5  body — { adultAttested: true, termsVersion } validated against
//      TERMS_VERSION; 400 with a plain reason
//   6  one transaction on eligibility/{uid}: an existing doc at the CURRENT
//      terms version is returned UNCHANGED (idempotent — no timestamp bump); an
//      existing doc at a SUPERSEDED version is RE-ATTESTED (Amendment A §A2,
//      D-aa — see `applyReattestation`); otherwise the server writes
//      { adultAttestedAt, termsVersion, acceptedAt, source } and returns it
//   7  { eligible: true, attestation: <doc> }
//
// AWAITED (BUILD_RULES §5): the write is the reply's precondition, never
// fire-and-forget. AN ATTESTATION, NOT VERIFICATION (§8): the server records
// that this uid affirmed both statements at this instant under this terms
// version; counsel decides whether more is needed before the flip.
//
// WHY A TRANSACTION for one doc: two first taps racing (a double-submit, two
// tabs) must yield ONE attestation with ONE timestamp of record. `tx.get` then
// `tx.set` serializes them — the loser re-runs against the winner's doc and
// returns it unchanged, so both callers see the same record and the first
// timestamp is never overwritten. A `create()` would also refuse the second
// writer, but would answer it with an error rather than the doc.
//
// THE WRITE IS ALLOWLISTED (compositionProtectedStoresAllowlist.json): the
// deny-by-default protected-store scan never traces the ref argument of a
// transaction-handle write, so this `tx.set(ref, …)` reads as `unresolved`
// whatever the ref's origin — the research.js precedent. `eligibility` is not
// a protected store; the key is pinned at ONE site, with a human-review note,
// so a second write in this transaction fails CI until it is reviewed too.
//
// NO UI, NO CALLER in PR 0 (the AttestationStep lands in PR 4). The
// `eligibility` rules block ships in this PR and is inert until deployed
// manually via the Console (the runbook step).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { eligibilityRef } from '../_utils/eligibility.js';
import { ANONYMOUS_SIGN_IN_PROVIDER, signInProviderOf } from '../_utils/backingEligibility.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';
import { ELIGIBILITY_ATTESTATION_ENABLED } from '../../src/config/featureFlags.js';

/** The `source` every doc this route writes carries (§6). */
export const ATTESTATION_SOURCE = 'backing_beta';

/**
 * The doc the server writes for a RE-ATTESTATION (Amendment A §A2, D-aa).
 *
 * A terms revision forces re-acceptance: `requireEligibility` treats an
 * attestation recorded under a superseded `TERMS_VERSION` as absent, so without
 * this the bump would be a DEAD END — every account that attested under the old
 * version would be refused `eligibility_required` for ever, PR 4 would
 * re-present the terms, the POST would return the same stale doc, and the
 * refusal would repeat. `eligibility/{uid}` is `write: if false`, so no other
 * path exists.
 *
 * KEEPS `adultAttestedAt` — the 18+ affirmation does not expire — updates
 * `termsVersion` and `acceptedAt`, and APPENDS the prior `{ termsVersion,
 * acceptedAt }` to `history[]`, so the record shows what was accepted when.
 * Exported for the tests' exact-shape assertion.
 */
export function applyReattestation(existing, { termsVersion, now = new Date() }) {
  const nowIso = now.toISOString();
  const priorHistory = Array.isArray(existing?.history) ? existing.history : [];
  return {
    ...existing,
    adultAttestedAt: existing?.adultAttestedAt ?? nowIso,
    termsVersion,
    acceptedAt: nowIso,
    source: ATTESTATION_SOURCE,
    history: [
      ...priorHistory,
      { termsVersion: existing?.termsVersion ?? null, acceptedAt: existing?.acceptedAt ?? null },
    ],
  };
}

/**
 * The doc the server writes for a first attestation — the §6 shape, exactly
 * these four fields. Both timestamps are the SAME instant: one request, one
 * affirmation of both statements. ISO strings, the shape the sibling
 * server-written docs carry. Exported for the tests' exact-shape assertion.
 */
export function buildAttestation({ termsVersion, now = new Date() }) {
  const nowIso = now.toISOString();
  return {
    adultAttestedAt: nowIso,
    termsVersion,
    acceptedAt: nowIso,
    source: ATTESTATION_SOURCE,
  };
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit (the research.js shape).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 3. Auth — the uid comes from the token, never the body.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth. Dark ⇒ the route does not exist.
  if (!ELIGIBILITY_ATTESTATION_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 4b. THE ACCOUNT (Amendment A §A3, D-ab). An anonymous account cannot hold a
  //     consent record, so it is refused here rather than being allowed to write
  //     one the backing path would then reject anyway. The provider comes from
  //     the VERIFIED token; a body field would be the caller asserting their own
  //     account type (§9).
  if (signInProviderOf(user) === ANONYMOUS_SIGN_IN_PROVIDER) {
    return res.status(403).json({ error: 'account_required' });
  }

  // 5. Body. Two fields, one accepted value each; a plain reason on refusal.
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.adultAttested !== true) {
    return res.status(400).json({ error: 'adultAttested must be true' });
  }
  if (body.termsVersion !== TERMS_VERSION) {
    return res.status(400).json({ error: `termsVersion must be ${TERMS_VERSION}` });
  }

  // 6. One transaction on eligibility/{uid}. Existing ⇒ returned unchanged;
  //    absent ⇒ written by the server, and awaited.
  const db = getFirebaseAdmin();
  const ref = eligibilityRef(db, user.uid);
  try {
    const attestation = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const existing = snap.data();
        // IDENTICAL VERSION ⇒ unchanged. PR 0's idempotency stands (§A2).
        if (existing?.termsVersion === TERMS_VERSION) return existing;
        // SUPERSEDED VERSION ⇒ re-attestation (§A2, D-aa).
        const updated = applyReattestation(existing, { termsVersion: TERMS_VERSION });
        tx.set(ref, updated);
        return updated;
      }
      const doc = buildAttestation({ termsVersion: TERMS_VERSION });
      tx.set(ref, doc);
      return doc;
    });
    // 7. What comes back is what the doc holds.
    return res.status(200).json({ eligible: true, attestation });
  } catch (err) {
    console.error('[eligibility/attest] transaction failed:', err.message);
    return res.status(500).json({ error: 'Attestation failed' });
  }
}
