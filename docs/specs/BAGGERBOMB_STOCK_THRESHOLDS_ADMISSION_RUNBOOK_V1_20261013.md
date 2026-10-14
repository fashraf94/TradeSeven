# Dormant stock threshold admission and rollback contract

| Verdict | Meaning |
| --- | --- |
| LOCAL IMPLEMENTATION | The creation selector is `false`. This document describes the implemented control; it does not authorize activation. |
| PRODUCTION ACTIVATION OPEN | A later owner request, technical review and runtime verification are required. No control document was created by this task. |

The owner decision and exact policy adoption are recorded in [the adoption record](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md). Gameplay policy is unchanged from the merged V1 specification. The control below implements its before-commit switch/policy recheck across workers; it adds no reward rule.

## Server-owned control schema

VERIFIED: `api/_utils/stockThresholdPolicyRegistry.js:9` defines the Admin SDK document path `stockThresholdControl/admission`. Selected creation requires this document before any measurement GET. The transaction rereads its whole content before committing the game and immutable inputs (`api/_utils/stockThresholdAdmission.js:39`, `:57`).

The enabled shape is:

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "epoch": 1,
  "model": {
    "modelId": "stock_measured_atr14_fullday_v1",
    "policyHash": "baa2b39688b673c93190540f500307ae7ad4aba7a07228ca23ba1f2afe1bf9f8",
    "publicationRuleId": "eodhd_us_completed_session_observation_v1",
    "publicationRuleHash": "3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f",
    "approvedPolicyRef": "owner_baggerbomb_stock_thresholds_v1_20261013@v1"
  }
}
```

`epoch` must be a positive integer. Disabling, changing the epoch, changing the model or any other control content between preparation and commit refuses that attempt. Missing, disabled or unsupported control refuses selected creation. It never selects legacy as a fallback. The server registry must also resolve the tuple. A client field or offline analyst attestation cannot replace either check.

With `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = false`, new creation uses its existing route and makes zero new control reads or collector calls. This code value and its pins remain false in this PR (`src/config/featureFlags.js:3201`). Thus an enabled database document alone cannot enable this deployment.

## Future cutover procedure

The following is a contract for a later authorized operator, not actions performed by this task:

1. Preserve the exact supported registry and saved-model readers while any corrected game is active. Verify the configured EODHD identity, raw bars, original quote and scheduled publication observation in that environment. Verify both-side committed inputs and receipt replay, the transaction failure/cooldown path and actual cron operation. Resolve the prescribed tournament GC contact identified in the implementation audit before allowing corrected games.
2. Prepare an approved enabled control with a fresh epoch. Enable the code selector only in the later authorized activation change, reconciling its flag pins in that change. Both controls must accept the same exact tuple. No current game is migrated.
3. For rollback, first disable the shared control and advance its epoch in one authorized server write. Then deploy the code selector false. A warm worker with a true code constant observes the disabled/changed control on its creation transaction and refuses an attempt prepared before that cutover.
4. Confirm rollback using a read-only control read plus authorized runtime observation. A creation committed before the control cutover remains a corrected game; already-collected but uncommitted observations cannot create a game afterward.

A code-only redeploy cannot notify a warm worker running an older true module. The shared disable/epoch step is necessary for a cross-worker cutover. Removing the registry, saved tuple, collector or readers is not a rollback: existing corrected games still need qualified swaps and scoring after new admission closes.

## Existing games and unavailable evidence

VERIFIED: `src/utils/stockThresholdModel.js:24` dispatches by the saved model, independently of both admission controls. An absent stamp selects legacy. A present null, malformed, unsupported or hash-mismatched stamp is unavailable. It does not downgrade or adopt a newer policy. Supported corrected swaps continue to collect current qualified observations under the saved policy (`api/_utils/stockThresholdAdmission.js:209`).

Create-only `stockThresholdInputs/<snapshotId>` documents retain raw rows, security identity, original quote, observation hash, input hash and registered collector attestation. Full responses remain distinct when only volume changes. Score, daily and completion transactions reread and replay the bound inputs. Missing or corrupt evidence makes totals/results unavailable, with no default draw, statistics, awards or reflection from incomplete operands.

The eight current catalog exceptions and HES/IPG/WBA exclusions stay closed. D3 catalog reconciliation remains separate. This PR performs no production writes, catalog edits, migration or historical rescoring.
