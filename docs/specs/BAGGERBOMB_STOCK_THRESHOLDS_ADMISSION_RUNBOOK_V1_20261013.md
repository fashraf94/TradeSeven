# Stock threshold admission and rollback runbook

| Verdict | Meaning |
| --- | --- |
| v2 ALLOWLIST PILOT (Oct 15, 2026) | The code selector ships `true`. The server document `stockThresholdControl/admission` is the only on-switch, and only an allowlist of account ids (`ownerId`) is selected. Everyone else — and everyone, while the document is missing, disabled or malformed — gets today's legacy creation. |
| PRECONDITIONS RULED | The blockers follow-up settles both switch-on preconditions: security identity (ISIN, else a well-formed FIGI) and the evening window (refused). See the two sections below. Do not enable the control document before that follow-up is merged and deployed; switching on is a separate step. |
| PRODUCTION | No control document has been written by the build. Writing it is a separate, authorized operator step after Flash merges. |

Decisions: [the v2 pilot approval](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md) (Rulings 1–16) supersedes the v1 control contract below where they differ. The v1 dormant adoption is [here](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md) for history; the v1 model is retired.

## Server-owned control schema (v2)

`api/_utils/stockThresholdPolicyRegistry.js` defines the Admin SDK path `stockThresholdControl/admission`, the schema (`STOCK_ADMISSION_CONTROL_SCHEMA = 2`) and the two checks: `validStockAdmissionControl` (the document is open) and `stockAdmissionSelects` (it names this owner). Firestore rules deny all client access to the collection (catch-all).

The enabled shape is:

```json
{
  "schemaVersion": 2,
  "enabled": true,
  "epoch": 1,
  "model": {
    "modelId": "stock_measured_atr14_fullday_v2",
    "publicationRuleId": "eodhd_us_completed_session_observation_v1",
    "policyHash": "22a815985037ddba74526973237817f233e38fd97cb1b1cff5f33e7af345050b",
    "publicationRuleHash": "3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f",
    "approvedPolicyRef": "owner_baggerbomb_stock_thresholds_v2_20261015@v1"
  },
  "audience": { "mode": "allowlist", "ownerIds": ["<owner uid>"] }
}
```

- Only `audience.mode: 'allowlist'` with a non-empty list of non-empty owner ids selects, and only for those owners. Any other mode — a future `'all'` included — is closed. Broad release is a later code change and founder decision.
- Missing, disabled (`enabled: false`), unparseable, old-schema (`schemaVersion: 1`), unregistered-model or unreadable control: **legacy for everyone, with no measurement reads.** This reverses the v1 runbook's "never legacy" for unselected creations (Ruling 6).
- `epoch` is a positive integer. A selected creation re-reads the whole document inside its creation transaction and is refused (`creation_selection_changed`, retriable) if anything in it changed — disabling, a new epoch, a removed owner.
- Selection runs in `prepareStockCreation` (`api/_utils/stockThresholdAdmission.js`) after the game-mode scope check: tournaments and other modes never read the control document. Every tiered full-day creation reads it once. A non-listed owner returns `null` before any measurement GET, so its creation and its errors are exactly today's legacy ones (`createAgentBattle` keys its refusal wrapper on that per-battle selection).
- A selected creation is refused retriably in four cases:
  - from 45 minutes before the calendar close (15:15 ET; 12:15 ET on early-close days; Ruling 2);
  - in the evening window, after the close, when the battle would expire before the next session opens (ruling P2, below);
  - during the 16:00–16:15 ET publication window;
  - whenever the collector cannot qualify both sides' stocks.
- The player sees one short line (`src/services/agentDeploy.js` `stockAdmissionLine`).

## Security identity (ruled: ISIN, else a well-formed FIGI)

Without a fix, the collector (`api/_utils/stockThresholdMeasurementProvider.js`) required a non-empty `General.ISIN`. The provider returns that as null for almost every US-domiciled stock, so 220 of 239 symbols were refused on Oct 15, 2026.

The ruling (P1, approval §"Switch-on preconditions" 1) keeps every other identity check and builds `securityId` as follows:
- `EODHD:<SYM>.US:<ISIN>` when `ISIN` is a non-empty string;
- otherwise `EODHD:<SYM>.US:FIGI:<OpenFigi>`, only when `OpenFigi` is a well-formed FIGI (`wellFormedFigi`: shape, reserved prefixes, check digit);
- otherwise `security_identity_unqualified`.

CIK and LEI are never used. The rule is not hashed and the v2 policy hash does not move.

**Universe record** (real collector path, GET only, concurrency 1, no Firestore; Oct 15, 23:09 ET): **228 of 239 qualify**, 8 with the ISIN form and 220 with the FIGI form. The other 11 are the catalog exclusions (AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA, WBD).

## The evening window (ruled: refused for the pilot)

**The problem.** On a regular trading day, a full-day battle whose roster holds crypto and that is created after the close expires at 20:00 ET the same evening (the fenced `computeFullDayExpiry`, the crypto "Night Game" close). No evaluation runs after 16:00 ET, so it would never get a scored check. Every tiered battle carries crypto.

**The rule** (P2, approval §"Switch-on preconditions" 2):
- For allowlisted creations only, `prepareStockCreation` refuses retriably with `evening_window` when both of these hold:
  - the creation is outside a trading session (after the current session's close, or on a weekend or holiday);
  - the battle's own `expiresAt` falls before the next session's `openMs`.
- It runs after selection and before any measurement GET.
- It is derived from the calendar and the battle's `expiresAt` (`src/utils/stockAdmissionWindow.js`), never from a clock literal.
- It narrows Ruling 7 for the pilot only, pending the separate legacy evening-draw diagnosis.

| Day | Crypto roster refused | Allowed again |
| --- | --- | --- |
| Regular trading day | 15:15–20:00 ET (14:15–19:00 CT): the late start, then the evening window | 20:00 ET (19:00 CT), then all night, pre-open and in session until the next 15:15 ET |
| Friday | 15:15–20:00 ET, the same | 20:00 ET Friday; all weekend |
| Early-close day | 12:15–13:15 ET (11:15–12:15 CT): the late start, then the publication window. There is no Night Game; the expiry is the 13:00 close itself. | 13:15 ET (12:15 CT); the battle plays the next session |

- A refused player reads, for both reasons: "Measured battles can't start this late in the day. Try again after 8:00 PM ET." On an early-close day the time is 1:15 PM ET. The retry time comes from the same module (`stockAdmissionRetryAt`). The browser computes it at the refusal instant, because the fenced `decide.js` 503 carries only the reason.
- Non-allowlisted owners, legacy creation and tournaments are unchanged. A legacy battle created in that window still records a 0–0 draw; that is reported separately and is out of scope here.

## Switching the pilot on (a separate step, after the blockers follow-up is merged and deployed)

1. Confirm the deployed build is the merged v2 build (the registry tuple above) and that crons run (they do not on preview).
2. `.env.local` with the Admin credentials must be present in the checkout you run from (`scripts/loadLocalEnv.js`).
3. Dry run, read the exact document it prints, then apply:

   ```bash
   node scripts/stock-threshold-pilot-control.mjs enable --owner <FT_QA uid>
   ```

   ```bash
   node scripts/stock-threshold-pilot-control.mjs enable --owner <FT_QA uid> --apply
   ```

   Owner ids are passed on the command line only; the script writes them to no file. The epoch advances on every write.
4. FT_QA deploys Cipher (the account is the unit: both agents named Cipher are covered). After the first evaluation tick, check the live battle read-only:

   ```bash
   node scripts/stock-threshold-pilot-verify.mjs <battleId>
   ```

   It prints, for both sides, each position's receipt %, fill and fill-quote time, the six exact targets, the committed reward context and its points, each side's score agreement, the committed-score validity and a replay of every bound input. It writes nothing.

## Rollback

- **Stop new measured battles (no deploy needed):** `node scripts/stock-threshold-pilot-control.mjs disable --apply`. The document stays, disabled, with a fresh epoch: every warm worker sees it on its next creation, and a creation prepared before the write is refused at commit. Everyone is legacy from then on.
- **Existing measured battles keep their pinned model.** Turning admission off is not a kill switch for corrected scoring, swaps, banking, completion or readers: they dispatch from the battle's own stamp (`src/utils/stockThresholdModel.js` `stockModelRoute`), independently of the flag and the control document.
- A code-only rollback (the selector back to `false`, its pins in the same commit) also returns every creation to legacy with zero control reads; the control document then has no effect.
- Removing the registry, the saved tuple, the collector or the readers is not a rollback: existing measured games still need qualified swaps and scoring until they complete.

## Existing games and unavailable evidence

- An absent stamp is legacy. A present null, malformed, unsupported (the retired v1 tuple included) or hash-mismatched stamp is unavailable — never legacy or the newest model.
- Ruling 3: a tick whose corrected frame is unavailable still runs the calibrated risk pass, forced exits and the deployed guardrails (the R11 deterministic pass), writes `null` (never 0) wherever a score appears, withholds the discretionary model call, and finalizes cron state with the normal final write.
- Ruling 4: an expired battle settles on its latest stored frame when that frame is valid and its inputs replay; otherwise it completes as **result unavailable**: status, `completedAt`, `completionContext: 'corrected_score_unavailable'`, `pendingReflection`/`reviewPending` false, the lock release, a null-score feed line and the retired vision; the agent's pointer is released only while it still names the battle. No result, stats, reflection, review, mastery stamp, settlement record, pattern log, `completionReason` or `lastDeployedAt`.
- Create-only `stockThresholdInputs/<snapshotId>` documents keep the raw rows, identity, original quote and attestation; score, daily and completion transactions re-read and replay them.

The eight catalog exceptions and the HES/IPG/WBA exclusions stay closed. No production write, catalog edit, migration or historical rescoring is part of this build.
