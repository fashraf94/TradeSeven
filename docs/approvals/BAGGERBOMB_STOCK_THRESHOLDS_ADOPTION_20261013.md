# Stock threshold dormant implementation adoption

Owner decision: October 13, 2026, 18:31:49 America/Chicago (`2026-10-13T23:31:49Z`). The direct task attachment titled “BaggerBomb stock thresholds: owner-approved dormant implementation V1” authorizes the exact policy and sections 1–7, including the section 6 contacts of the merged dormant build specification. It authorizes an implementation PR and isolated verification. Activation remains a later owner decision.

The hashed policy object remains unchanged. Historical pending-approval reports remain historical. Registry reference: `owner_baggerbomb_stock_thresholds_v1_20261013@v1` in `api/_utils/stockThresholdPolicyRegistry.js`.

* Model: `stock_measured_atr14_fullday_v1`
* Policy SHA-256: `baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8`
* Publication rule: `eodhd_us_completed_session_observation_v1`
* Publication SHA-256: `3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f`

SHA-256 uses UTF-8 canonical stableStringify, recursively sorted keys and preserved array order. The approval record is outside those hashes. No client field, offline attestation or unregistered authority can authorize admission. The admission selector ships false and affects new creation only.

## Additional prescribed tournament settlement contact

The owner's direct follow-up reply authorizes: “the additional corrected-only refusal guard in runPrescribedTournamentDeploy, plus directly related tests and documentation.” It specifies expired active corrected models and present invalid/unsupported stamps, stored-model dispatch independent of admission, no battle/score/history/completion/statistics changes, preservation of durable agent metadata, and release of only the temporary deploy lock. The check must precede durable writes, rather than restoring stale metadata. Unstamped tournament behavior remains; merge and activation remain separate decisions.

This narrowly supplements the first approval's prescribed-deploy exclusion. The caller defers only tournament loadout persistence into a server callback. The helper performs its settlement check before invoking that callback and before decision/cooldown writes, leaving settlement to the existing qualified completion writer. The original projection pin, writer and rejection/fail-open handling remain; legacy projection still precedes group/rankings/prescription validation. The exact policy hashes and registry version are unchanged. Verification is recorded in `docs/audits/BAGGERBOMB_TOURNAMENT_STOCK_SETTLEMENT_GUARD_REVIEW_20261013.md`.
