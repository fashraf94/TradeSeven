# FantasyTrades — Backing Beta Spec V1.3: Amendment A

**Date:** September 13, 2026
**Status:** Amends `FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md`, which remains build-governing. Supersedes nothing. Three additions, one correction, two records.
**Sources:** PR 0 review record (`docs/audits/`, PR #843); N1 discovery report and mitigation PR #842; the founder's rulings of September 13.

---

## A1. §11 gate 6 — N1 mitigated and detected before the flip

**Added to §11:** *6. N1 handled: the Mon 08:45 slot disabled in production (PR #842 merged and deployed) and the missing-agent-layer detection landed in banking (tournament-arc durable fix), so a week that plays without an agent layer pauses for review instead of completing.*

Rationale: a beta that asks spectators to back results needs the results of record to be whole. D-x already keeps the slot out of pools; gate 6 covers the defect class (any pod that reaches `battle` after the Monday marker, and the watch ledger's "no agent battle for a day" case). Settlement keys on `complete`, and a paused week never reaches it, so the spec's settlement posture is unchanged.

## A2. D-aa — A terms revision forces re-attestation

- `requireEligibility` (PR 2) treats an attestation whose `termsVersion` differs from the current `TERMS_VERSION` as absent → 403 `eligibility_required`, and the AttestationStep re-presents the terms.
- `POST /api/eligibility/attest` accepts a re-attestation when the recorded version differs: it keeps `adultAttestedAt` (the 18+ affirmation does not expire), updates `termsVersion` and `acceptedAt`, and appends the prior `{ termsVersion, acceptedAt }` to `history[]`. An identical version still returns the doc unchanged — PR 0's idempotency stands.
- Lands in the counsel-copy PR or PR 2, whichever comes first. Not a PR 0 change.

## A3. D-ab — Account eligibility for a consent record

- Anonymous Firebase accounts cannot attest: the endpoint refuses `sign_in_provider === 'anonymous'` with 403 `account_required`. A consent record needs an account that persists.
- Email verification is **not** required for the points beta — an attestation is not verification (§8) — unless counsel requires it at gate 1, in which case the same refusal shape applies to unverified accounts.
- Lands with A2.

## A4. Correction — addendum report path

The addendum discovery report is on `main` at `docs/2026-09-12_BACKING_BETA_PHASE0_ADDENDUM_DISCOVERY.md` (docs root), not `docs/audits/`. Every reference in V1.3 §12 and in the PR 0 brief reads accordingly. PR 0 proceeded on the actual file; no action beyond this note.

## A5. Record — the gate-1 tripwire stays

`src/config/eligibilityFlags.test.js` fails the suite if `ELIGIBILITY_ATTESTATION_ENABLED` is `true` while `src/constants/eligibility.js` still carries a `COUNSEL: replace before flip` marker or a `-draft` terms version. Inert while dark. It is part of the flip discipline — gate 1 enforced by a test rather than by memory — and is **kept**, not struck.

## A6. Build note for PR 1–3 — the write scanner

Every transaction write to a new backing collection (`backingWallets`, `backingPools`, `backingStakes`, `backingEvents`, `eligibility`) needs an entry in `api/_utils/compositionProtectedStoresAllowlist.json` with a human-review note: the deny-by-default scanner reads transaction-handle writes as unresolved. This is an **expected touched file** in PR 1, PR 2, PR 3 and PR 5, not scope creep, and the build prompts will name it.

**Branch order:** PR 1 branches from `main` after #843 merges — the two share `featureFlags.js`, `flagPinGuard.test.js`, `firestore.rules`, and the allowlist.

## A7. Consolidated pre-flip gates (§11 as amended)

1. Jurisdictional review of the points economy, the two placeholder strings, and the terms version (counsel).
2. Eligibility attestation merged (#843), rules block deployed via the Console, counsel's copy in place; D-aa and D-ab implemented.
3. The two honesty fixes landed (fixture reasoning text; `agents` read rule).
4. Founder smoke on a preview URL with a dev pod through attest → open → close → settle → results.
5. Deferral watch in beta week one.
6. N1 mitigated and detected (A1).

## Rulings ledger — additions

| # | Question | Ruling |
|---|---|---|
| D-aa | Terms revision | Forces re-attestation; 18+ timestamp kept; prior acceptance recorded in `history[]`; same version stays idempotent |
| D-ab | Account eligibility | Anonymous accounts cannot attest; email verification not required for the points beta unless counsel requires it |

*Amendment A prepared September 13, 2026. V1.3 §15 D-a–D-z stand unchanged.*
