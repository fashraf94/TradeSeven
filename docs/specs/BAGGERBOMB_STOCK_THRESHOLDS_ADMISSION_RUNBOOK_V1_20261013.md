# Stock threshold admission and rollback runbook

| Verdict | Meaning |
| --- | --- |
| BROAD RELEASE BUILT (Oct 25, 2026) | BR-1 to BR-4. The registry accepts the audience `{ mode: 'all' }`, and `enable --all` writes it: every new tiered full-day BaggerBomb battle is then measured. Tournaments and League battles are untouched. |
| SWITCH | The code selector ships `true`. The server document `stockThresholdControl/admission` is the only on-switch. While it is missing, disabled or malformed, everyone gets legacy creation. |
| PRODUCTION | The pilot ran from Oct 16 with an allowlist (Flash and FT_QA). Switching on for everyone is the separate, authorized step below, after Flash merges and Vercel shows the deploy. |

Decisions: [the v2 approval](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md). It holds Rulings 1–16 (Oct 15) and BR-1 to BR-4 (Oct 25); BR-2 supersedes Ruling 2 and the pilot's P2. The v1 dormant adoption is [here](../approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md), for history only; the v1 model is retired.

## Server-owned control schema (v2)

`api/_utils/stockThresholdPolicyRegistry.js` defines:
- the Admin SDK path `stockThresholdControl/admission`;
- the schema (`STOCK_ADMISSION_CONTROL_SCHEMA = 2`);
- two checks: `validStockAdmissionControl` (the document is open) and `stockAdmissionSelects` (it selects this owner).

Firestore rules deny all client access to the collection (catch-all).

The broad-release shape (`enable --all`) is:

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
  "audience": { "mode": "all" }
}
```

The pilot shape (`enable --owner <uid>`) carries `"audience": { "mode": "allowlist", "ownerIds": ["<owner uid>"] }` instead.

- **Two audiences select:**
  - exactly `{ mode: 'all' }` selects every owner. Any other key, or leftover `ownerIds`, closes the document.
  - `{ mode: 'allowlist', ownerIds: [...] }` with a non-empty list of non-empty ids selects those owners only.
- **Any other mode is closed.** So are a missing, disabled (`enabled: false`), unparseable, old-schema (`schemaVersion: 1`), unregistered-model or unreadable control. Closed means **legacy for everyone, with no measurement reads.**
- **`epoch` is a positive integer.** A selected creation re-reads the whole document inside its creation transaction. It is refused (`creation_selection_changed`, retriable) if anything changed: disabling, a new epoch, a removed owner, or a switch between allowlist and all.
- **Selection runs in `prepareStockCreation`** (`api/_utils/stockThresholdAdmission.js`), after the game-mode scope check:
  - tournaments and other modes never read the control document;
  - every tiered full-day creation reads it once;
  - an unselected owner returns `null` before any measurement GET, so its creation and its errors are exactly today's legacy ones (`createAgentBattle` keys its refusal wrapper on that per-battle selection).
- **A selected creation is refused retriably in only these cases:**
  - during the collector's publication wait, from the calendar close to 15 minutes after it (16:00–16:15 ET; 13:00–13:15 ET on early-close days);
  - whenever the collector cannot qualify both sides' stocks: provider failure, identity, catalog exception, `current_ranked_membership_missing`;
  - when the previous measured battle of the same agent has expired but not yet settled (`prior_corrected_battle_requires_settlement`, decide.js). Settlement runs at the next weekday's first evaluation run, so an agent whose measured battle expired at 20:00 ET cannot redeploy until about 09:00 ET on the next weekday.
- **Refused for every tiered creation, legacy too:** from Fri Dec 31, 2027, 15:15 ET (`calendar_missing`). The next session is in 2028, outside the calendar's tables. Adding the 2028 tables to `src/utils/marketCalendar.js` removes it.
- The player sees one short line (`src/services/agentDeploy.js` `stockAdmissionLine`). The publication wait reads "Measured battles open again at 4:15 PM ET." (1:15 PM on early-close days). The time comes from the browser's clock when the refusal arrives, because the fenced `decide.js` 503 carries only the reason.

## When a battle can start and when it plays (BR-2)

There is no time-of-day block any more. The late-start (`late_start_cutoff`) and evening-window (`evening_window`) refusals and their player lines are gone. The fenced `createAgentBattle` takes a tiered battle's full day from `tieredFullDayTarget` (`src/utils/stockAdmissionWindow.js`):
- it is computed from the calendar at the creation instant, through Intl only, so the process time zone plays no part;
- `expiresAt`, `timing.tradingDays` and `timing.localClose` come from one instant.

| Created (ET) | Plays | Expires |
| --- | --- | --- |
| Trading day, before 15:15 (12:15 on an early close) | that session | its close: 16:00, or 20:00 for a crypto roster; 13:00 on an early close |
| Trading day, from 15:15 (12:15 on an early close) to midnight | the next session | the next session's close, with the Night Game rule that session gets: 20:00 for crypto unless it closes early |
| Weekend or holiday | the next session | the same |

- **Every tiered roster carries crypto**, so on a regular day a battle created from 15:15 ET runs to 20:00 ET of the next session. A Friday battle created from 15:15 ET plays Monday. A battle created the day before Thanksgiving plays the Friday early close and ends at 13:00 ET (no Night Game).
- **Legacy creations follow the same rule.** That ends the old evening 0–0 draws, where a crypto battle created 16:15–20:00 ET expired unplayed.
- **The rest of the creation day still counts.** Nothing holds a late-day battle's evaluation until its session, so one created 15:15–15:59 ET is also evaluated by that day's 15:30 and 15:45 ticks. The daily cron records `day1` that evening (approval record, build readings).
- **Tournament creation is unchanged.** It keeps `computeFullDayExpiry`, which still derives its instant from the process zone (UTC on Vercel and CI).
- **Each refused attempt costs model calls.** A refusal comes at battle creation, after `decide.js` has run its model calls and replaced the agent's shown decision. The cooldown is restored, so the player can retry at once.

## Security identity (ruled: ISIN, else a well-formed FIGI)

The collector (`api/_utils/stockThresholdMeasurementProvider.js`) builds `securityId` this way (ruling P1, approval §"Switch-on preconditions" 1):
- `EODHD:<SYM>.US:<ISIN>` when `ISIN` is a non-empty string;
- otherwise `EODHD:<SYM>.US:FIGI:<OpenFigi>`, only when `OpenFigi` is a well-formed FIGI (`wellFormedFigi`: shape, reserved prefixes, check digit);
- otherwise `security_identity_unqualified`.

CIK and LEI are never used. The rule is not hashed and the v2 policy hash does not move.

**Universe record** (real collector path, GET only, concurrency 1, no Firestore; Oct 15, 23:09 ET): **228 of 239 qualify**, 8 with the ISIN form and 220 with the FIGI form. The other 11 were the catalog exclusions. **BR-3 (Oct 25) removed those 11 from the universe** (AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA, WBD), so the universe is now the 228 that qualify.

## The retired tickers (BR-3)

- **They are out of `STOCK_UNIVERSE` and `ALL_TICKERS`** (`api/_utils/rankingConfig.js`). No cron fetches or ranks them, and no successors were added.
- **They keep their labels.** Each stays in `RETIRED_STOCKS` with its last sector, and in `TICKER_TO_SECTOR` / `TYPE` / `INDUSTRY`. Existing battles, Film Room tapes, watchlists and Wire documents that hold one read as before. The ticker validator and the Forge add search refuse new picks of them.
- **The CPU's and the agent's pool is `indexIntelligence/stockRankings`.** That document keeps its old list until `compute-index-intelligence` next runs on a weekday after the deploy (10:30 and 11:30 UTC, then hourly 14:00–20:00 UTC). It lists 7 of the 11 as of Oct 25 (AVB, CTRA, EA, EQR, MMC, PARA, WBD). Until the rebuild, a measured creation that draws one is refused retriably (`catalog_unavailable`). Hence the precondition below.

## Switching on for everyone (a separate, authorized step)

1. **Confirm the deploy.** Vercel production must be at or after the broad-release merge commit, and crons must run (they do not on preview).
2. **Have the credentials.** `.env.local` with the Admin credentials must be present in the checkout you run from (`scripts/loadLocalEnv.js`).
3. **Confirm `indexIntelligence/stockRankings` no longer lists any of the 11.** It is a read-only check. If it still does, wait for the next weekday rankings run.
4. **Read the current document:**

   ```bash
   node scripts/stock-threshold-pilot-control.mjs show
   ```

5. **Dry run, and read the exact document it prints.** It must show `enabled: true`, a fresh epoch (one more than the current one), the v2 model above and `audience: { mode: 'all' }`:

   ```bash
   node scripts/stock-threshold-pilot-control.mjs enable --all
   ```

6. **Apply.** The script writes and reads back:

   ```bash
   node scripts/stock-threshold-pilot-control.mjs enable --all --apply
   ```

7. **Confirm it reads "enabled for every owner":**

   ```bash
   node scripts/stock-threshold-pilot-control.mjs show
   ```

8. **Check a live battle read-only** after its first evaluation tick:

   ```bash
   node scripts/stock-threshold-pilot-verify.mjs <battleId>
   ```

   For both sides it prints each position's receipt %, fill and fill-quote time, the six exact targets, the committed reward context and its points. It also prints each side's score agreement, the committed-score validity and a replay of every bound input. It writes nothing.

The pilot form is still available: `enable --owner <uid> [--owner <uid>]`. Owner ids are passed on the command line only, and the script writes them to no file. `--all` and `--owner` cannot be combined. The epoch advances on every write.

## Rollback

- **Stop new measured battles (no deploy needed):**

  ```bash
  node scripts/stock-threshold-pilot-control.mjs disable --apply
  ```

  The document stays, disabled, with a fresh epoch and its audience kept. Every warm worker sees it on its next creation, and a creation prepared before the write is refused at commit. New battles are legacy from then on. Re-enabling is a deliberate `enable --all --apply`.
- **Existing measured battles keep their pinned model.** Turning admission off is not a kill switch for corrected scoring, swaps, banking, completion or readers. They dispatch from the battle's own stamp (`src/utils/stockThresholdModel.js` `stockModelRoute`), independently of the flag and the control document.
- **BR-2 and BR-3 are not rolled back by the switch.** They are code: late-day starts still play the next session, and the 11 stay retired, whatever the control document says.
- **A code-only rollback** (the selector back to `false`, its pins in the same commit) also returns every creation to legacy, with zero control reads. The control document then has no effect.
- **Removing the registry, the saved tuple, the collector or the readers is not a rollback.** Existing measured games still need qualified swaps and scoring until they complete.

## Existing games and unavailable evidence

- An absent stamp is legacy. A present null, malformed, unsupported (the retired v1 tuple included) or hash-mismatched stamp is unavailable — never legacy or the newest model.
- Ruling 3: a tick whose corrected frame is unavailable still runs the calibrated risk pass, forced exits and the deployed guardrails (the R11 deterministic pass), writes `null` (never 0) wherever a score appears, withholds the discretionary model call, and finalizes cron state with the normal final write.
- Ruling 4: an expired battle settles on its latest stored frame when that frame is valid and its inputs replay. Otherwise it completes as **result unavailable**:
  - **Written:** status, `completedAt`, `completionContext: 'corrected_score_unavailable'`, `pendingReflection` and `reviewPending` false, the lock release, a null-score feed line and the retired vision. The agent's pointer is released only while it still names the battle.
  - **Never written:** a result, stats, reflection, review, mastery stamp, settlement record, pattern log, `completionReason` or `lastDeployedAt`.
- Create-only `stockThresholdInputs/<snapshotId>` documents keep the raw rows, identity, original quote and attestation; score, daily and completion transactions re-read and replay them.

No production write, migration or historical rescoring is part of the build. The one production write is the control document, in the switch-on step above.
