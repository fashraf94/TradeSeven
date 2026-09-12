// src/constants/eligibility.js
//
// Backing Beta PR 0 — Eligibility attestation constants (spec V1.3 §5, §11
// gate 1, §12 PR 0; ruling D-z). ZERO IMPORTS by construction: api/ consumes
// this module under the revised import rule (BUILD_RULES §4), so its
// transitive surface must stay Node-clean — the co-located test's real import
// is the dependency-surface guard and locks the zero-import property.
//
// EVERY STRING HERE IS A PLACEHOLDER. Counsel owns the attestation copy and the
// terms version (§11 gate 1); the build ships them marked for replacement and
// the flip PR (ELIGIBILITY_ATTESTATION_ENABLED) does not go out until they are
// replaced. Nothing here is legal copy, and this module makes no legal claim.

/**
 * The terms version the attestation endpoint accepts (api/eligibility/attest.js
 * validates the client's `termsVersion` against it — any other value is a 400)
 * and the value it records on the doc. Counsel's ratified version replaces this
 * draft tag before the flip; a later terms revision bumps it again, which is
 * what invalidates stale clients.
 */
export const TERMS_VERSION = 'beta-2026-09-draft';

/**
 * The two attestation strings the PR 4 AttestationStep renders beside its
 * controls: an 18-or-older confirmation and a beta-terms acceptance. The
 * endpoint records that both were affirmed (§8: an attestation, not
 * verification). Placeholders — not legal copy.
 */
export const ATTESTATION_COPY = Object.freeze({
  // COUNSEL: replace before flip
  adult: 'I confirm that I am 18 years of age or older.',
  // COUNSEL: replace before flip
  terms: 'I have read and accept the FantasyTrades Backing Beta terms.',
});
