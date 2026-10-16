# BaggerBomb stock thresholds v2: build report (FT_QA allowlist pilot)

October 15, 2026. Built by Claude Code (Opus) from Fable's build prompt carrying Flash's Rulings 1–16. Branch `claude/baggerbomb-thresholds-v2-e22124`. Phase 0 input: `docs/audits/BAGGERBOMB_THRESHOLDS_PHASE0_REPORT_20261015.md` (byte-exact, final §C3). This report's byte-exact copy: `docs/audits/BAGGERBOMB_THRESHOLDS_V2_BUILD_REPORT_20261015.md`.

## For Flash, in plain English

- This PR builds the measured-threshold scoring ("v2") for the invite-only pilot. It is safe to merge, but the pilot should not be switched on until you decide two things.
- **First, stock identity.** Our data provider leaves the security ID (ISIN) blank for almost every US company, and the code requires it, so 220 of 239 stocks would be refused. A small follow-up must choose a replacement ID. Using the FIGI code the provider does return, 228 of 239 qualify.
- **Second, evenings.** A battle that holds crypto and starts between 4:15 and 8 PM ET on a weekday expires at 8 PM that same evening without ever being scored. Today's battles already do this (they record a 0–0 draw). Ruling 7 allows after-close starts, so the choice is yours: block that window, move the expiry (a fenced change), or tell players to start after 8 PM.
- **When switched on for FT_QA.** Their new full-day battles score each stock against its own measured daily move, frozen at the fill. The targets, the research modal, chat, the agent's instructions, reflections and history all use that one number.
- **Missing prices.** When a price is missing, the game shows "—", never 0, and risk checks and safety exits still run. If no valid score exists at expiry, the battle ends as "result unavailable", with no stats or reflection.
- **Everyone else.** Nothing changes: with no control document, every battle is created exactly as today, with no extra data calls, and tournaments are untouched. The one visible change for all players is that the stock modal drops the placeholder "Historical (30 days)" block. The default "Buy" rating is already gone on `main` (PR #971).
- **On and off.** Each is one script run, which previews by default, with the account ids given at run time. Turning it off sends new battles back to the old scoring.
- **Checks.** Full test suite on Linux: 993 test files pass and 7 are skipped by design (exit 0). The lint gate and the build are clean. The three-lens review, with refuters, verified 26 findings and one question: 16 are fixed here, 6 go to you or to a ruling, 1 was refuted and the rest are notes. A final mutation pass found 7 weak spots in the tests. Each now has a test that fails if it breaks, and one was a real bug in the pilot check script, now fixed.
- **Production.** Nothing was deployed, switched on or written there.

## Verdict table

| # | Ruling | Verdict | Where (HEAD) | Proof |
| --- | --- | --- | --- | --- |
| 1 | Timing: the fill quote's time is the lower bound; a same-time quote only at the fill price; an exit needs a later quote; Branch A; marker deleted | DONE | `src/utils/stockThresholdModel.js:56`, `:66–70`; `api/_utils/stockThresholdAdmission.js:174–181`, `:274–277` | `stockThresholdV2.test.js` "Ruling 1" (9 rows) |
| 2 | 45-minute late-start cutoff against `closeMs`, before any measurement GET, retriable, clear message | DONE (reading: the check runs after allowlist selection) | `stockThresholdAdmission.js:44–56`, `:73`; `src/services/agentDeploy.js:25`, `:29` | "Ruling 2" (5 rows); `agentDeploy.stockAdmission.test.js` |
| 3 | The four early returns continue the tick; the risk pass, forced exits and guardrails including R11 run; finalize on every exit; a null score is never written or shown as 0; M1 unchanged | DONE (reading: the discretionary model call is withheld on an unavailable frame) | `api/cron/agent-evaluate.js:17`, `:2561–2590`, `:4734` | `agent-evaluate.stockThresholds.test.js` Ruling 3 rows, incl. the new-exit R11 row and the F1b rows |
| 4 | Expiry: latest valid frame, else result unavailable (§E3 terminal set), independent of `readCorrectedInputs`, covers route unavailable; both pattern-logger callers check | DONE | `agent-evaluate.js:6738`, `:6866`, `:6998`, `:7103`, `:341`, `:354`, `:7221` | `agent-evaluate.stockThresholds.expiry.test.js` (3 rows) |
| 5 / 14 | Allowlist keyed on `ownerId` | DONE | `api/_utils/stockThresholdPolicyRegistry.js:15–26` | "Ruling 6" rows |
| 6 | Flag true with pins reconciled. The control document (schema 2, `audience`) is the only switch. Missing, disabled, unparseable or old control means legacy with no reads. `'all'` is rejected. A mid-flight change is refused. Tournaments stay byte-identical. | DONE (reading: an unreadable control is also legacy, with a warning) | `src/config/featureFlags.js:3263`; registry `:15–26`; `stockThresholdAdmission.js:61–85`, `:94–102`; `api/_utils/agentBattleService.js:325–341` (fenced) | "Ruling 6" + "Ruling 6 through createAgentBattle" (15 rows), incl. "flag true, no control document = byte-identical, zero collector calls" |
| 7 | Off-hours creation; the fill is the latest valid real-time quote; the §C3 closing-quote rule, no tolerance; the 16:00–16:15 refusal stays | DONE, **with a switch-on precondition**: a crypto roster created 16:15–20:00 ET is never played (§6b) | collector unchanged (`api/_utils/stockThresholdMeasurementProvider.js:53`, `:71` already enforce §C3); policy `offHoursCreation` | "Ruling 7" (6 rows) |
| 8 | Crypto `fallback: true` incoming fill refused; outgoing crypto entry must be positive | DONE | `stockThresholdAdmission.js:273`, `:281` | "Ruling 8" (3 rows) |
| 9 | Strict close for corrected stocks; additive field on the shared path | DONE | `api/_utils/marketDataCache.js:818`; `stockThresholdAdmission.js:165–167` | "Ruling 9"; `marketDataCache.realTimePrice.test.js` |
| 10 | Fenced prompt contact; the measured text names the frozen measured %; legacy byte-identical; the split renderer is registered in the same commit; crypto slot v2 kept | DONE (one wording item outside the split is routed, §8) | `api/_utils/agentEvalPromptAssembly.js:67–70`, `:209–210`, `:358`, `:370`, `:389`, `:489`, `:532` (fenced); `api/_utils/evalStockRewardBlock.js` | `evalStockRewardBlock.test.js`; prompt goldens unchanged; the review's byte-identity sweep (8 flag sets × 5 modes × 8 archetypes × 3 names) |
| 11 | Result unavailable: the vision is retired; no settlement record, stats, mastery, reflection, review queue or pattern log | DONE | `agent-evaluate.js` `completeBattle` (`:6866`, `:6998`, `:7103`) | expiry suite; VISION rows |
| 12 | Completion timing as-is | NO CHANGE | — | — |
| 13 | v2 policy JSON (Rulings 1, 3, 4, 7, 8, 9 hashed); id, version and ref; publication rule unchanged; 45 minutes unhashed; v1 retired | DONE | `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json`; registry; `src/utils/stockThresholdModel.js` | "v2 identity" row (the registry recomputes both hashes) |
| 15 | Modal: normal layout from the committed context; six targets from the fill; HIT only from crossed tiers; Details collapsed; "Measured reward unavailable"; Why proximity text; every battle loses "Historical (30 days)" and the default "Buy" | DONE (the rating is now PR #971's analyst chip, from `main`) | `src/components/draft/ResearchTabs/BaggerBombTab.jsx`; `AssetResearchModal.jsx`; `src/components/Research/chartUtils.js`; `StockChart.jsx`; `src/screens/AgentBattleScreen.jsx` | `AssetResearchModal.stockReward.test.jsx` (7 rows); `stockThresholdRendered.test.jsx` |
| 16 | Readers use the committed context; "—" for unavailable; legacy unchanged | DONE | §4 | `api/_utils/stockThresholdReaders.test.js` (14 rows), `src/screens/stockThresholdReaders.test.jsx` (6 rows), Film Room check-detail row |
| — | Pilot scripts (control is dry-run by default; verify is read-only) | DONE | `scripts/stock-threshold-pilot-control.mjs`, `scripts/stock-threshold-pilot-verify.mjs` | `scripts/stock-threshold-pilot.test.js` (8 rows) |
| — | Universe on the runtime path (UNP, HUM, ACN named) | DONE, **with a switch-on blocker** (§6a) | §6 and Appendix A | live record, GET only |

| Check | Head | Result |
| --- | --- | --- |
| Full suite, Linux (WSL Ubuntu, Node 20.20.2, `CI=true TZ=UTC --maxWorkers=2`, exit code asserted) | `2b55d54a` (code-final, `main` `83ec3b88` merged) | Test Files 993 passed, 7 skipped (1000). Tests 21124 passed, 88 skipped (21212). EXIT=0 |
| `npm run lint:gate` | `2b55d54a` | exit 0 |
| `vite build` | `2b55d54a` | exit 0, built in 16.59 s (3969 modules) |
| Flag-flip dry run (flag line → `false`, every pin as shipped) | `107767f4` | Only flag-state pins fail (§7) |
| Broad `eslint .` | — | Not run as a gate and **not presented as clean** |

## 1. Preamble

- `git fetch origin` ran first. Branch `claude/baggerbomb-thresholds-v2-e22124`, HEAD `495ee07b` = `origin/main`, clean tree.
- The first commit, `cda11253`, is the byte-exact Phase 0 report (interim). The final Phase 0 copy, with §C3 finalized at 16:50 ET by the other session, landed as `30322ffe` before Ruling 7's closing-quote rule was implemented.
- `main` moved three times during the build, and each move was merged with the app's sync tool:
  - `11ecd41b` (PR #959, docs/scripts) at `9b1a42c6`.
  - `7d26161f` (PRs #968 eval timeout 40 s, #969 Command Center S0, #970 BUILD_RULES) at `599562cb`. The only conflict was the end of `src/config/featureFlags.js`; both flags are kept and S0's flag is still last.
  - `83ec3b88` (PR #971 research modal honesty fixes) at `e18f94ab`. The conflict was `src/components/draft/AssetResearchModal.jsx`. #971 replaced the rating with a Wall Street analyst-consensus chip shown only from a real profile, which already meets Ruling 15's "no default Buy", so the merge kept `main`'s display and this build's measured chart data. The Ruling 15 rating row now pins the chip (`2b55d54a`).
- Anchors from Phase 0 §E were re-verified before each edit. Nothing on `main` contradicted a ruling when the build started, so there was no STOP before writing.
- Commits:
  - `f3b01be6` contract, timing, admission and the switch
  - `be1138b0` evaluator unavailable frames, result-unavailable expiry, measured prompt
  - `493bb932` readers and the research modal
  - `0f2ddb7d` approval record, runbook and the two scripts
  - `107767f4` protected-store allowlist entry for the control script
  - review fixes: `f341fe02` (admission and evaluator rows), `52ca74cf` (readers), `6c1b121c` (second precondition, build readings), `d18ad77a` (expiry count, F1b final write, tape final scores)
  - `599562cb` merge of `main` (`7d26161f`)
  - `6149ee99` mutation-lens kill rows and the verify agreement fix
  - `e18f94ab` merge of `main` (`83ec3b88`); `2b55d54a` the rating row follows #971
  - the commit that adds this report
- Diff against current `main` (`83ec3b88`): 64 files, +4,068/−442, not counting this report.

## 2. Fence contact

Edited (both were approved by the prompt):

| File | Function | Change |
| --- | --- | --- |
| `api/_utils/agentBattleService.js` | `createAgentBattle` (`:69`; edit at `:325–341`, imports `:29–30`) | Removed the process-wide `stockSelected`/`refuseStock('creation_selection_changed')` latch. Selection is now `prepareStockCreation`'s non-null return for this battle. Only a selected creation's non-refusal error is wrapped as the retriable `corrected_creation_failed`, keeping its cause. Tournament and unselected creations run the original code with the original errors. |
| `api/_utils/agentEvalPromptAssembly.js` | `buildEvalSystemPrompt` (`:358`), `renderSurvivalMode` (`:209`) | One import (`:67–70`) and four splices in the tiered template (`:370`, `:389`, `:489`, `:532`) calling the non-fenced `evalStockRewardBlock.js`. A new options argument, `{ measuredStockReward = false }`; the default renders the exact prior text. flat6 is untouched. |

No other fenced file was edited (`git diff --stat` over the §1 list).

Fenced functions **called** by changed code are all pre-existing exports, none modified:
- `calculateAssetScoreServer` (`agentScoring.js`), from `stockThresholdAdmission.js`.
- `flattenPortfolioServer` and `flattenBenchServer` (`agentScoring.js`), from the readers, the film tape and reflection.
- `applyGuardrails` (`agentGuardrails.js`), through the existing `runSuppressionDeterministicPass`, now reached on unavailable frames.
- `evaluateRisk` (`agentRiskManager.js`), an existing call now reached on unavailable frames.
- `executeSwapServer` (`agentSwapExecution.js`), the existing dispatch to `executeCorrectedStockSwap`.
- `buildEvalSystemPrompt`, at `agent-evaluate.js:2958`.
- `computeTimeRemaining` (`agentEvalPromptAssembly.js`) and `getArchetypeLabel` (`agentArchetypeConfig.js`), from `voiceLayerPrompt.js`.
- `findActiveAgentBattles` (`agentBattleService.js`), from `voice-layer-cache.js`.

`api/agent/decide.js` is not edited. Its carriage goldens strip the one new control read (§5).

## 3. What changed, by ruling

### Ruling 1 (timing)
- `initialRewardHistory` seeds `observedAt` at `fillQuote.quoteAsOf` (`src/utils/stockThresholdModel.js:56`), so a fresh history is never "older" than its own fill.
- Validation (`:66–70`):
  - A history older than the fill quote is `invalid_reward_history`.
  - A quote before the fill quote, before the history, or stamped after its own observation is `missing_post_entry_quote`.
  - A quote at the fill quote's provider time with a different price is `fill_time_price_conflict`.
  - `quoteEvidence.kind` is `fill_quote` or `post_fill_quote`.
- Branch A (`api/_utils/stockThresholdAdmission.js:174–181`): when the tick's dated quote predates this receipt's fill quote, the position is valued at its own receipt fill. It is per receipt: one quote can be post-fill for one lifetime and pre-fill for another.
- Exit (`:269–277`): no stand-in (`fillStandIn: false`), plus a post-check that the scoring quote is strictly after the fill quote (`exit_quote_not_after_fill`). A refusal writes nothing.
- The `stockEntryCommit` marker `.then` is deleted, along with the `stockPrices` swap option that only carried it (`agent-evaluate.js` `stockSwapOptions`).

### Ruling 2 (late start)
- `STOCK_LATE_START_CUTOFF_MINUTES = 45` (`stockThresholdAdmission.js:44`).
- `lateStartRefusal` (`:50`) refuses `[closeMs − 45 min, closeMs)` on trading days, using `getSessionForDate(...).closeMs`, so the cutoff is 12:15 ET on early-close days. A malformed instant refuses.
- It runs at `:73`, after selection and before the collector loop.
- The player sees: "Measured battles stop starting 45 minutes before the market close. Try again 15 minutes after the close." (`src/services/agentDeploy.js:25`). That retry hint leads into the evening window (§6b), so it should follow the ruling there.

### Ruling 3 (unavailable frame)
- The four corrected early returns are removed; their commits remain.
- A single exit after the gameplan block (`api/cron/agent-evaluate.js:2561`) handles a corrected game with no refresh failure where either score is not finite. In that case:
  - the R11 deterministic pass (`runSuppressionDeterministicPass`) runs, then `finalizeCronState`;
  - the status feed and the calls record are written (exit `no_trigger` with an observation);
  - the normal final `battleRef.update(scoreUpdate)` happens;
  - the capture closes at `gameplan_handled`.
- The calibrated risk pass and forced exits run earlier in the tick, unchanged. M1 is unchanged.
- `feedScore` (`:17`) maps `null` to `null` at all 18 feed and proposal sites.
- A corrected forced exit whose post-swap re-read failed now re-reads the roster before the final write (`:4734`), so its F1b record lands. This case is newly reachable on unavailable frames.

### Rulings 4 and 11 (expiry and result unavailable)
- `completeBattle` decides `resultUnavailable` from three causes:
  - route `unavailable`;
  - an invalid corrected completion;
  - a `readCorrectedInputs` refusal. Other errors rethrow.
- An unavailable result:
  - sets `completionContext = 'corrected_score_unavailable'` before `resolveCompletionDisposition` (`:6866`);
  - writes the §E3 terminal set with a null score and drops `reflectedAt` (`:6998`);
  - writes no `receiptCoverage`, skips the mastery stamp and writes no settlement record;
  - returns `resultUnavailable: true` (`:7103`).
- The vision is retired through the disposition.
- Both `logBattlePattern` callers skip it (`:341`, `:7221`).
- A run holding a stale "active" listing of such a battle counts it as `completionSkipped` (`:354`).

### Ruling 6 (switch and allowlist)
- `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true` (`src/config/featureFlags.js:3263`). Its pin (`src/utils/stockThresholdModel.test.js`) and the removal of its `flagPinGuard` `DARK_BY_DESIGN` entry landed in the same commit (`f3b01be6`).
- Registry (`api/_utils/stockThresholdPolicyRegistry.js:15–26`):
  - schema 2;
  - `validStockAdmissionControl` requires `enabled`, a positive epoch, the registered v2 model, `audience.mode === 'allowlist'` and a non-empty array of non-empty string ids;
  - `stockAdmissionSelects(control, ownerId)`.
- `prepareStockCreation` (`stockThresholdAdmission.js:61`) runs in this order:
  1. the flag;
  2. the tiered full-day agent scope;
  3. the db;
  4. the control read (a read error is legacy, with a warning that names no owner, `:69`);
  5. selection (a non-listed owner returns `null` before any measurement GET);
  6. the late start;
  7. the collector.
- The commit transaction rereads the control document. It refuses (`creation_selection_changed`, zero writes) if the document is no longer valid or differs in any field (`:94–100`). It then checks the approval instant (`:102`).

### Ruling 7 (off-hours)
- No new code path was needed. The collector (`api/_utils/stockThresholdMeasurementProvider.js`, unchanged) already takes the latest valid real-time quote with a provider timestamp. Its stamp check refuses a quote stamped before the source session's calendar close (`:53`, `:71`), which is exactly the final §C3 rule.
- The 15:59:00 minute bar is refused, retriably, with no tolerance.
- The rule is hashed (`offHoursCreation`) and pinned by six rows.
- What the ruling did not anticipate is in §6b.

### Rulings 8 and 9
- `fallback_incoming_fill` refuses an adjusted-close crypto fill.
- `missing_outgoing_entry` refuses a non-positive outgoing crypto entry.
- An incoming stock fills from its collector receipt, so a fallback tick quote for it does not refuse.
- `marketDataCache.js:818` adds `previousCloseStandIn: true` when the provider had no `close`. `decisionQuote(..., { strictClose: true })` nulls that price for corrected stocks only.

### Ruling 10 (prompt)
- `api/_utils/evalStockRewardBlock.js` holds the legacy text verbatim and the measured text. The measured rules say targets are multiples of "this stock's frozen measured %", fixed at the fill.
- The four renderers are registered in `PROMPT_CONTRIBUTING_MODULES` in the same commit (`be1138b0`).
- Legacy prompt goldens are unchanged, and the crypto-slot block is untouched.

### Ruling 13 (identity)
- Model `stock_measured_atr14_fullday_v2`, `modelVersion` 2.
- Policy SHA-256 `22a815985037ddba74526973237817f233e38fd97cb1b1cff5f33e7af345050b`; publication rule unchanged (`3ad8e14b…`).
- Approved ref `owner_baggerbomb_stock_thresholds_v2_20261015@v1`, `approvedAt` `2026-10-15T20:23:45Z` (§5).
- The registry recomputes both hashes from the JSON at import.

## 4. Readers (Ruling 16)

| Reader | File | Corrected behaviour |
| --- | --- | --- |
| Voice cache | `api/cron/voice-layer-cache.js` | Briefs carry crossed tiers and `thresholdProximity` in frozen measured %, or `measuredRewardUnavailable` |
| Chat and voice prompt | `api/agent/chat.js`, `api/_utils/voiceLayerPrompt.js` | "Score: unavailable", with game state and urgency "unknown"; "Threshold: X× of its frozen measured Y%"; chat passes the battle id |
| Reflection | `api/_utils/agentReflectionUtils.js` | THRESHOLDS from the committed context; crypto (including bare `BTC`) keeps the legacy line |
| Pattern logger | `api/_utils/battlePatternLogger.js` | Hits and penalties from committed crossed tiers |
| Film tape | `api/_utils/filmTape/tapeAssemble.js`, `tapeMerge.js` | Stamped battles carry `stockModel`; final scores are the displayed ones; a measured stamp keeps `atrXUnit`; replay marks measured legs as not recomputable |
| Film Room | `src/screens/filmRoomV2/FilmRoomCheckDetail.jsx`, `filmRoomCopy.js` | A measured `atrX` is labelled "measured reward multiple (frozen measured %)" |
| L1 and tick stamps | `api/_utils/tickStamps.js`, `src/data/decisionRecord.js` | Unit `frozen_measured_pct`; "Measured reward multiple X×" |
| Bagger moment | `src/screens/battleView/deriveBaggerMoment.js` | From crossed tiers. A frame with no valid committed context is "unknown", so an old crossing is never announced again |
| Battle screen and modal | `src/screens/AgentBattleScreen.jsx`, `src/components/draft/AssetResearchModal.jsx` | Footer, Details and Why proximity from `measuredProximity`; chart data keyed on the context's content |
| ManageStation, ReviewStation, BattleHistory, adapter | `src/components/Dashboard/*`, `src/screens/BattleHistoryScreen.jsx`, `src/adapters/baggerbombAdapter.js` | `displayedStockScores`: "—" when unavailable, never 0 |

Legacy battles take the old branch in every reader; the legacy rows in both reader suites pin this.

## 5. Readings and deviations (flagged, not relitigated)

1. **An unavailable frame withholds the model call.** The fenced prompt header renders `(scoreState.currentScore || 0)`, and `computeGameContext` does the same, so calling the model on a null score would show it 0. Instead the tick runs the risk pass, forced exits, the R11 pass and finalize, and records exit `no_trigger` in capture and calls. Hashed as `unavailableFrame.rewardDependentStages`. The review notes that `no_trigger` normally means "the trigger gate did not fire" (§8, routed).
2. **An unreadable control document is legacy**, like a missing one, and now logs a warning that names no owner. The ruling lists missing, disabled, unparseable and old-schema; it does not mention a read error. Refusing on a read error would 503 non-listed owners. Recorded in the approval record.
3. **The late-start check runs after selection**, so it never refuses a non-listed owner. "Before any GET" is read as before any measurement GET; the control read is itself a GET.
4. **`approvedAt` is the prompt receipt instant** (`2026-10-15T20:23:45Z`), because Rulings 6–16 carry no stated time. The approval record says so.
5. **No tick quote means unavailable.** Branch A stands in only for a dated pre-fill quote, as ruled. A 15:45 ET swap whose tick-quote fetch failed can leave the final frame unavailable, so that battle ends as result unavailable. Recorded in the approval record.
6. **The GC-repair pattern-logger check is defensive.** Corrected battles are never GC-completed (`decide.js:811`, `:1468`).
7. **Guard counts moved, with reasons:**
   - R11 sites 2 → 3 (`agent-evaluate.suppressionPass.test.js`);
   - finalize and flush counts 6 → 7, and vwap/intraday, stagnation and fire-guard 5 → 6 (`agent-evaluate.test.js`);
   - each for the one new exit.
   - The two `stockSwapOptions` call-text patterns lost `{ prices }` with the dead option.
8. **The decide carriage goldens strip the one new control read** instead of being regenerated (`api/_utils/__fixtures__/stockAdmissionGolden.js`), so every other byte stays pinned.
9. **L1 capture already carried `stockRewardContract`**; a test was added, no code.
10. **The capture serializer declares four `scores.stockModel` leaves.** The tape adds an optional `atrXUnit` on measured evidence only. The Film Room tape spec V1.2's eight-field list (`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md:98`) is not amended in this PR.
11. **The Film Room copy inventory moves 239 → 240 keys** (348 swept entries) for the measured label.

## 6. Universe on the runtime path, and the two switch-on blockers

### 6a. Universe record and the security-identity rule

Run live on Oct 15 2026, 17:34–17:36 ET: GET only, concurrency 1, no Firestore. For each of the 239 Phase 0 symbols, the script ran the real `collectStockObservation` → `qualifyStockObservation` → `bindStockReceipt` → `stockRewardContext` at the fill quote (Appendix A).

| Run | Qualified | Refused |
| --- | --- | --- |
| As built (ISIN required) | 8 (ACN, AON, CB, ETN, LIN, MDT, SHOP, SLB) | 220 `security_identity_unqualified`; 11 `catalog_unavailable` |
| ISIN-or-FIGI emulation (scratch only) | 228, the same set as Phase 0's arithmetic | 11 `catalog_unavailable` (AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA, WBD) |

Under the emulation every fill stamp fell between 16:00 and 16:44 ET, all at or after the close (§C3). Measured % ranged from 1.039 to 11.309, median 2.458.

| Named | Fill | Stamp (ET) | Measured % | Bagger / Double / Ten | Bust / Crash / Meltdown | Phase 0 (Oct 14) |
| --- | --- | --- | --- | --- | --- | --- |
| UNP | 288.705 | 16:03 | 1.420234 | 292.81 / 294.86 / 296.91 | 284.60 / 282.55 / 280.50 | 1.396128 |
| HUM | 432.13 | 16:23 | 4.584848 | 451.94 / 461.85 / 471.76 | 412.32 / 402.41 / 392.50 | 5.019804 |
| ACN | 224.9 | 16:04 | 4.560461 | 235.16 / 240.28 / 245.41 | 214.64 / 209.52 / 204.39 | 4.485025 |

UNP and HUM qualify only under the emulation; ACN qualifies as built. The Ruling 7 rows use UNP's live fill price (288.705).

**Decision packet: the collector's security-identity rule (blocks switch-on).**

**What happens today.** `collectStockObservation` (`api/_utils/stockThresholdMeasurementProvider.js:42`, unchanged by this build) refuses a stock unless the provider's fundamentals `General` block has `Code === symbol`, `IsDelisted === false`, `Exchange` NYSE/NASDAQ, `Type` "Common Stock", `CountryISO` US/USA **and a non-empty string `ISIN`**. It then builds `securityId = EODHD:<SYM>.US:<ISIN>` (`:57`), which every receipt and immutable input carries and every replay compares (`api/_utils/stockThresholdAdmission.js` `readCorrectedInputs`).

**What the provider returns (live, Oct 15 2026).** `ISIN` and `CUSIP` are `null` for US-domiciled issuers (UNP, HUM, AAPL, MSFT, JPM, XOM, KO, NVDA, DUK, BRK-B probed). `CIK` (10 chars), `OpenFigi` (12 chars) and usually `LEI` (20 chars; null for XOM) are present. Only foreign-domiciled issuers carry an ISIN.

**Effect.** Universe record (real collector path, GET only): 8 of 239 qualify (ACN, AON, CB, ETN, LIN, MDT, SHOP, SLB — Irish, Swiss, Curaçao, Canadian and UK issuers); 220 are refused `security_identity_unqualified`; 11 are the catalog exclusions. A pilot battle needs every stock on both sides to qualify, so an allowlisted creation would almost always be refused (retriably, with the generic player line). The PR is still safe to merge: with no control document every creation is legacy.

**Options for Flash and Fable (no receipt exists yet, so any choice is free today):**

| Option | `securityId` | Notes |
| --- | --- | --- |
| A. OpenFIGI when ISIN is absent (recommended) | `EODHD:<SYM>.US:FIGI:<OpenFigi>` (ISIN form unchanged when present) | FIGI is security-level (share class): BRK-A and BRK-B differ; CIK would not. The scratch emulation of exactly this rule qualified 228 of 239 — the full Phase 0 arithmetic set — with every other gate (measurement, fill validation, the §C3 stamp rule) passing. |
| B. CIK | `EODHD:<SYM>.US:CIK:<CIK>` | Issuer-level: two share classes of one company collide. |
| C. Require ISIN (today) | unchanged | Pilot limited to the 8 foreign issuers; FT_QA's agents would rarely draft only those. |

Either A or B changes only the collector's identity line and its tests; the v2 policy hash does not move unless Flash wants the identity rule hashed (the publication rule object would then be versioned).

### 6b. The evening window (blocks switch-on; founder ruling)

Found by review lens B1 and confirmed by its refuting verifier.

**What happens.** On a regular trading day, a full-day battle whose roster holds crypto and that is created at or after 16:15 ET and before 20:00 ET expires at 20:00 ET that evening and never gets a scored check:
- The crypto "Night Game" close in `computeFullDayExpiry` (fenced `agentBattleService.js`, unchanged) sets the 20:00 expiry.
- The only evaluate cron is `vercel.json:157`, `*/15 13-21 * * 1-5` UTC.
- `isMarketOpen()` (`agent-evaluate.js:406`) stops evaluation at 16:00 ET.

**Sweep.** Creations every 15 minutes for Oct 15–22 (EDT) and Nov 23–29 (EST, with Thanksgiving and the early close) gave 89 and 45 dead instants for crypto rosters and none for stock-only rosters. Pre-open, after 20:00, weekend, holiday and early-close creations all play the next session, as Ruling 7 intends.

**Effect today and under v2.** Every tiered battle carries crypto (Phase 0), so this hits the whole pilot window:
- **Legacy, today:** such a battle records a 0–0 draw, with stats and a reflection. This is pre-existing, reported in §9.
- **Measured, under v2:** it ends as result unavailable at the next weekday's first run. Until then, `decide.js:811–813` refuses the agent's redeploy (Friday evening → Monday 09:00 ET).
- **Phase 0:** §C3 said an evening creation "plays the next session". That holds only for stock-only rosters.

**Why it is not fixed here.** Ruling 7 allows after-close creation, so this build does not refuse the window. The options are for Flash:

| Option | Change | Cost |
| --- | --- | --- |
| (a) Refuse | A retriable refusal in `prepareStockCreation` when `battleDoc.expiresAt` falls before the next session opens | Non-fenced. The verifier prototyped it: the wide stock-threshold set (348 tests) stayed green. It narrows Ruling 7's text. |
| (b) Move the expiry | After-close crypto creations target the next session's 20:00 close | Fenced `createAgentBattle` contact. It also changes legacy unless gated on selection. |
| (c) Accept | Tell pilot players to deploy after 20:00 ET or before the open | No code. |

Ruling 2's retry hint ("15 minutes after the close") should follow the decision.

## 7. Checks

**Full suite, Linux.** Every run used the private WSL tree `~/pd-bbv2`, synced by SHA, with Node 20.20.2, `CI=true TZ=UTC` and `--maxWorkers=2`. The exit code was captured and the Test Files line read in full; output was never piped through `tail`.

| Head | Test Files | Tests | EXIT |
| --- | --- | --- | --- |
| `9b1a42c6` (build + first `main` merge) | 1 failed, 983 passed, 7 skipped (991) | 1 failed, 20967 passed, 88 skipped | 1 |
| `599562cb` (review fixes + second `main` merge) | 989 passed, 7 skipped (996) | 21093 passed, 88 skipped (21181) | 0 |
| `6149ee99` (mutation kill rows) | 989 passed, 7 skipped (996) | 21096 passed, 88 skipped (21184) | 0 |
| `2b55d54a` (code-final, third `main` merge) | 993 passed, 7 skipped (1000) | 21124 passed, 88 skipped (21212) | 0 |

- The one failure at `9b1a42c6` was `api/_utils/compositionProtectedStores.scan.test.js`. The deny-by-default protected-store scan flagged the pilot control script's single `ref.set` on `stockThresholdControl/admission`. The writer was reviewed and allowlisted, with a note, in `107767f4`.
- The pushed head adds only this report (`docs/audits/`), so its `vite build` is recorded in the PR.

**Flag-flip dry run.** At `107767f4`, in the Linux tree, the shipped flag line was set to `false` with every pin left as shipped:
- Test Files: 4 failed, 980 passed, 7 skipped (991). EXIT=1. The tree was then restored.
- All four failing files pin the flag's state:
  - the flag's own pin row (`src/utils/stockThresholdModel.test.js`);
  - `src/config/flagPinGuard.test.js`, which reports the contradiction;
  - `api/agent/decide.carriage.test.js` (3 rows) and `api/agent/decide.carriageOffGolden.test.js` (16 rows). These fail with "Unexpected stock admission control read count: 0/0, expected 1": the golden strip asserts exactly the one control read that the shipped flag makes.
- A code rollback of the flag would move the pin, the guard entry and `STOCK_ADMISSION_CONTROL_READS` together. The runbook's rollback is the control document, which needs no code.

**lint:gate and vite build.**
- `npm run lint:gate` exited 0 at `d18ad77a`, `599562cb`, `6149ee99` and `2b55d54a`.
- `vite build` exited 0 at `6149ee99` and `2b55d54a`. The CSS-syntax and dynamic-import warnings are pre-existing.
- Broad `eslint .` is not a gate here and is not claimed clean.

## 8. Review record

**Shape (BUILD_RULES §2).**
- Three lenses, each on its own `git archive` tree of `9b1a42c6`:
  - B1 domain and model;
  - B2 lifecycle, writers, evaluator and creation;
  - B3 readers, prompt, display and legacy byte identity.
- Then three refuting verifiers, V1–V3, one per lens, each on its own tree, instructed to refute every finding with a repro.
- Then the mutation lens last, on its own tree of the final code head `d18ad77a`.
- No reviewer wrote to the worktree or git. Repro files live under each tree's `_review`, `_verify` or `_mut` folder.

**Outcome: 26 findings verified.** 17 CONFIRMED, 8 PARTLY (the core held but the severity or scope was corrected), 1 REFUTED. One question (Q-1) was confirmed as fact only. Dispositions: 16 fixed in this PR, 5 routed to Flash or recorded as readings (plus Q-1), 4 notes with no change, 1 refuted.

| Id | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| B1-1 | Crypto roster created 16:15–20:00 ET never played | CONFIRMED (predates v2 for legacy) | **Route: founder** (§6b, approval and runbook preconditions) |
| B1-2 | Approval-time gate had no killing row | CONFIRMED | Fixed: row (`f341fe02`) |
| B1-3 | Malformed-allowlist rows tested nothing | CONFIRMED (corrected: R3 changes selection) | Fixed: validator rows plus a mixed-list row |
| B1-4 | No tick quote is no longer filled at the fill | PARTLY (as ruled) | Recorded reading (approval record) |
| B1-5 | Unreadable control is silent | CONFIRMED | Fixed: warning that names no owner, plus a row |
| B1-6 | Future-stamped quote and stock-incoming fallback guards unpinned | CONFIRMED | Fixed: two rows |
| B1-7 | Dead `stockPrices` swap option | CONFIRMED | Fixed: removed; guard patterns follow |
| B1-8 | Same-time, different-price quote after the fill accepted | CONFIRMED (info; as ruled) | None |
| B2-1 | Stale listing of a result-unavailable battle counted as an error | PARTLY (LOW: needs overlapping runs) | Fixed: `completionSkipped` plus a race row (`d18ad77a`) |
| B2-2 | R11-on-unavailable row exited through the meeting site | PARTLY (a static guard covered the wiring) | Fixed: behaviour row for the new exit (`f341fe02`) |
| B2-3 | New exit records `no_trigger` without a trigger evaluation | CONFIRMED | **Route:** capture and Film Room exit vocabulary is a contract decision |
| B2-4 | Forced exit plus failed re-read lost the final write | PARTLY (half pre-existing; half newly reachable under Ruling 3) | Fixed: roster re-read plus two rows (`d18ad77a`) |
| B2-5 | Tape kept finite final scores for a result-unavailable battle | PARTLY (app shows only the basis line) | Fixed: displayed scores plus a row (`d18ad77a`) |
| Q-1 | Transient control-read failure gives a legacy battle | Facts confirmed | Recorded reading (§5.2); ruling text gap noted |
| B3-1 | Bagger moment re-fires after a swap, an unavailable frame or a reload | CONFIRMED (wider than claimed) | Fixed: "unknown" carried forward plus three-case row (`52ca74cf`) |
| B3-2 | Measured chart rebuilt on every parent render | PARTLY (only on the dark gated path) | Fixed: content key plus a chart-count row |
| B3-3 | Reflection dropped bare-symbol crypto on measured games | CONFIRMED | Fixed: plus a bare `BTC` row |
| B3-4 | Chart distance overlay vs Why | PARTLY (legacy has the same split) | None (pre-existing) |
| B3-5 | Measured prompt keeps ATR wording outside the split (`agentEvalPromptAssembly.js:499`, `:524`, CSV header) | PARTLY (ambiguous, not contradictory) | **Route:** a fifth split block is fence contact |
| B3-6 | Tape dropped `atrXUnit`; Film Room said "ATR multiple" | CONFIRMED | Fixed: tape row plus Film Room row |
| B3-7 | Measured Why proximity only looks up (legacy follows direction) | CONFIRMED | **Route:** copy ruling (`penaltyProximity` is already on the context) |
| B3-8 | Chat urgency read from a stale score | CONFIRMED (review-mode chat only) | Fixed: plus a row |
| B3-9 | Shadow assembly omits the measured flag | CONFIRMED (dark: `SHADOW_ASSEMBLY_ENABLED = false`) | None; for whoever lights that flag |
| B3-10a | ManageStation change had no killing row | CONFIRMED | Fixed: stale-score row |
| B3-10b | Two vacuous "no HISTORICAL" assertions on the measured tab | CONFIRMED | Fixed: removed (the legacy-control row is the guard) |
| B3-11 | `{ id, ...battle }` order in chat | REFUTED (no stored `id` field; owner cannot write one) | None |
| B3-11 | Tier % rounding (1.5 × 2.01 shows 3.01); exhaustive-deps; `stockSummary` "-0.00" | CONFIRMED nits | None (presentation nits, no second surface) |

**Negative controls that held across the lenses:**
- **Ruling 10 legacy prompt.** Byte-identical to base across 8 flag sets × 5 game modes × 8 archetypes × 3 names.
- **Ruling 1.** The worked arithmetic, the trap and the Branch A per-receipt rule all hold.
- **Ruling 6.** Ordering is right; tournaments never read the control document; the whole-document re-read refuses any change.
- **Rulings 7, 8 and 9.** Their mutants were killed.
- **Ruling 3.** No null ever reaches the model or the feed as 0.
- **Ruling 4.** The terminal write set is exact, and `completionContext` is not owner-writable.
- **Transactions.** Reads come before writes in every transaction.
- **Golden strip.** It is exact.
- **Fence.** The diff touches only the two approved files.

**Mutation lens:**

The mutation lens ran on tree `m2`, a `git archive` of `d18ad77a`. Each mutant was applied in memory by a vitest `load` hook, so no file was edited. Runs used `TZ=UTC`.

It ran **64 mutants: 55 KILLED and 9 SURVIVED**. None were broken or killed by a timeout.

**Part 1: every review-fix row kills its own mutant (19 of 19).**

| Mutant | Change | Killing row |
| --- | --- | --- |
| A13 | approval-instant refusal deleted | V2 "…before the v2 approval instant…" |
| R2, R3 | allowlist emptiness and id-type checks dropped | V2 Ruling 6 table (document-closed assertion); R3 also by the mixed `['owner-pilot', 42]` row |
| M6 | future-stamped quote accepted | V2 "a quote stamped after its own observation instant…" |
| A17 | stock incoming fallback refused | V2 "an incoming stock fills from its collector receipt…" |
| B1-5 | warning removed | V2 "an unreadable control document is legacy too…" |
| B2-2 | new-exit R11 call disabled | stockThresholds "with no pending meeting…" |
| B2-1 | error branch re-added | expiry "a stale listing…counts as completionSkipped" |
| B2-4 | F1b re-read reverted | both "(review B2-4)" rows |
| B2-5 | raw tape final | readers battle-block row |
| B3-1a/b/c | `0` for unknown; seed-while-unknown removed; freeze removed | each kills a different assertion of the three-case bagger row |
| B3-2 | identity dependency | chart-count row (3 vs 1) |
| B3-3 | bare-symbol crypto filter | reflection row |
| B3-6a/b | tape unit and Film Room label | tape row and check-detail row |
| B3-8 | raw urgency | chat row |
| B3-10a | raw ManageStation score | stale-score row |

**Part 2: build rows (45 mutants).** Killed:
- Ruling 10: renderers, the flag fallback and the splice flag.
- Ruling 9: both directions of the stand-in marker.
- Ruling 3: `feedScore(null) → 0`.
- Rulings 4 and 11: the completion context stamp, `reflectedAt`, the mastery guard and the expiry-loop pattern logger.
- Ruling 6: wrap-every-error and ignore-ownerId.
- Ruling 15: default `'Buy'`, a dropped target, candle HITs, the measured-levels branch.
- Ruling 16 (13 mutants): voice cache, voice prompt, pattern logger, tick-stamp unit, decision-record label, ReviewStation, BattleHistory, adapter, tape merge and replay.
- Pilot scripts: dry-run writes, epoch, verify always-agrees.

Survivors:

| Mutant | Verdict | Action |
| --- | --- | --- |
| R3b (`scoreAtProposal` reverted to raw rounding) | Covered by the static source guard (`agent-evaluate.stockThresholds.test.js`, 18-site count and forbidden pattern) | None |
| R4d (GC-repair pattern logger) | Equivalent: that path never sees a result-unavailable outcome | None |
| R15a, R15a2 (tier status and points from the price) | Real gap: no crossed-then-retreated fixture | Row added (`6149ee99`) |
| R15e (candle markers on a measured chart) | Real gap: the chart mock discarded markers | Mock records markers (`6149ee99`) |
| R6c (carriage race wrapped as a refusal) | Real, minor | Row added (`6149ee99`) |
| R16j (Why distance from the fill) | Equivalent under the fixture | Row with a far price added (`6149ee99`) |
| S3 (control read-back check removed) | Real, minor | Row added (`6149ee99`) |
| S5 (verify recomputed points doubled) | **Real defect in the verify script:** AGREES never used the recomputed stock points | Fixed: a side without crypto must have a zero remainder; a crypto side reports it. Row added (`6149ee99`) |

**Re-check.** After `6149ee99`, the seven survivors (R15a, R15a2, R15e, R6c, R16j, S3, S5) were re-run against the updated rows in the same tree, with the six changed files copied in. **All 7 are KILLED**, each by its new row.

## 9. Out of scope (reported, not changed)

- CPU flat 2.5% (Phase 0 §F3).
- Rank-0 falsy default.
- Legacy modal baseline mismatches (the legacy modal still reads a 30-day baseline; only the placeholder block and the default rating were removed, per Ruling 15).
- Intraday rankings drift.
- The last-30-minutes scoring gap (§C4).
- **New, from the review:** a legacy full-day battle with crypto created between 16:15 and 20:00 ET on a regular trading day expires unplayed and records a 0–0 draw, with stats and a reflection, at base and at head.
- The security-identity rule (§6a) is a contract decision, not a bug in this build.

## 10. Windows-only notes

- The Windows runs show platform-only failures (CRLF and path rows, per the standing note). For example, `api/_utils/filmTape/tapeWiring.test.js` fails to parse on Windows at every head. The Linux run shows none of them.
- Linux is the record: WSL Ubuntu, Node 20.20.2, `CI=true TZ=UTC --maxWorkers=2`, in a private tree.
- `lint:gate` and `vite build` were run on the final head.

## Appendix A. Universe record (all 239 symbols)

Fill, stamp and measured % come from the as-built run where the symbol qualified, otherwise from the FIGI emulation. The record files are `run-universe.mjs`, `strict.json` and `figi-emulated.json` in the build session's scratchpad.

| Symbol | As built (ISIN required) | ISIN-or-FIGI emulation | Fill | Fill stamp (ET) | Measured % |
| --- | --- | --- | --- | --- | --- |
| AAPL | refused: security_identity_unqualified | qualified | 342 | 16:41 | 1.905806 |
| ABBV | refused: security_identity_unqualified | qualified | 283.37 | 16:35 | 2.462919 |
| ABT | refused: security_identity_unqualified | qualified | 104.69 | 16:05 | 2.289907 |
| ACN | qualified | qualified | 224.9 | 16:04 | 4.560461 |
| ADBE | refused: security_identity_unqualified | qualified | 251.67 | 16:40 | 3.200336 |
| ADP | refused: security_identity_unqualified | qualified | 285.65 | 16:41 | 1.973219 |
| AEE | refused: security_identity_unqualified | qualified | 103.77 | 16:00 | 1.531350 |
| AEP | refused: security_identity_unqualified | qualified | 124.29 | 16:03 | 1.699367 |
| AFRM | refused: security_identity_unqualified | qualified | 75.92 | 16:26 | 5.008091 |
| ALB | refused: security_identity_unqualified | qualified | 98.2 | 16:16 | 3.288421 |
| AMAT | refused: security_identity_unqualified | qualified | 430.01 | 16:43 | 4.688429 |
| AMD | refused: security_identity_unqualified | qualified | 562.23 | 16:44 | 4.663191 |
| AMGN | refused: security_identity_unqualified | qualified | 434.03 | 16:41 | 2.455062 |
| AMT | refused: security_identity_unqualified | qualified | 181.36 | 16:03 | 2.549195 |
| AMZN | refused: security_identity_unqualified | qualified | 254.76 | 16:44 | 2.260671 |
| AON | qualified | qualified | 286.77 | 16:03 | 2.191858 |
| APD | refused: security_identity_unqualified | qualified | 296.34 | 16:23 | 1.759076 |
| ARE | refused: security_identity_unqualified | qualified | 42.33 | 16:00 | 3.777756 |
| AVB | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| AVGO | refused: security_identity_unqualified | qualified | 344.33 | 16:43 | 3.277587 |
| AWK | refused: security_identity_unqualified | qualified | 133.03 | 16:00 | 2.005305 |
| AXP | refused: security_identity_unqualified | qualified | 313.82 | 16:32 | 1.679638 |
| AZO | refused: security_identity_unqualified | qualified | 3060.92 | 16:03 | 2.585487 |
| BA | refused: security_identity_unqualified | qualified | 188.68 | 16:42 | 2.941277 |
| BAC | refused: security_identity_unqualified | qualified | 51.67 | 16:41 | 2.409505 |
| BE | refused: security_identity_unqualified | qualified | 236.28 | 16:44 | 8.809561 |
| BKNG | refused: security_identity_unqualified | qualified | 165.8 | 16:42 | 2.879760 |
| BKR | refused: security_identity_unqualified | qualified | 54.4 | 16:00 | 2.773109 |
| BLK | refused: security_identity_unqualified | qualified | 1120.81 | 16:16 | 2.268414 |
| BMY | refused: security_identity_unqualified | qualified | 60.58 | 16:41 | 3.105230 |
| BRK-B | refused: security_identity_unqualified | qualified | 526 | 16:42 | 1.039470 |
| BSX | refused: security_identity_unqualified | qualified | 44.155 | 16:41 | 2.496925 |
| C | refused: security_identity_unqualified | qualified | 123.22 | 16:41 | 2.657484 |
| CAG | refused: security_identity_unqualified | qualified | 14.18 | 16:07 | 3.279267 |
| CAT | refused: security_identity_unqualified | qualified | 735.61 | 16:17 | 4.111185 |
| CB | qualified | qualified | 352.87 | 16:03 | 1.620683 |
| CCI | refused: security_identity_unqualified | qualified | 80.005 | 16:00 | 3.302679 |
| CE | refused: security_identity_unqualified | qualified | 46.47 | 16:00 | 3.502984 |
| CEG | refused: security_identity_unqualified | qualified | 275 | 16:39 | 6.047455 |
| CF | refused: security_identity_unqualified | qualified | 119.84 | 16:05 | 3.138158 |
| CHTR | refused: security_identity_unqualified | qualified | 109.99 | 16:41 | 4.265972 |
| CI | refused: security_identity_unqualified | qualified | 298.83 | 16:39 | 2.749717 |
| CL | refused: security_identity_unqualified | qualified | 92.63 | 16:23 | 1.746597 |
| CMCSA | refused: security_identity_unqualified | qualified | 21.77 | 16:42 | 2.255909 |
| CME | refused: security_identity_unqualified | qualified | 289.46 | 16:03 | 2.049506 |
| CMG | refused: security_identity_unqualified | qualified | 30.56 | 16:40 | 4.045595 |
| COIN | refused: security_identity_unqualified | qualified | 183.81 | 16:41 | 5.631852 |
| COP | refused: security_identity_unqualified | qualified | 141.75 | 16:03 | 2.086462 |
| COST | refused: security_identity_unqualified | qualified | 978.01 | 16:41 | 1.660984 |
| CRM | refused: security_identity_unqualified | qualified | 246.715 | 16:41 | 3.418578 |
| CRWD | refused: security_identity_unqualified | qualified | 244.57 | 16:43 | 4.547109 |
| CRWV | refused: security_identity_unqualified | qualified | 69.69 | 16:44 | 7.913207 |
| CSCO | refused: security_identity_unqualified | qualified | 109.85 | 16:39 | 2.687646 |
| CSX | refused: security_identity_unqualified | qualified | 48.69 | 16:41 | 1.370185 |
| CTRA | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| CTVA | refused: security_identity_unqualified | qualified | 12.865 | 16:34 | 6.678134 |
| CVS | refused: security_identity_unqualified | qualified | 92.56 | 16:43 | 2.455020 |
| CVX | refused: security_identity_unqualified | qualified | 219.4 | 16:33 | 1.982117 |
| D | refused: security_identity_unqualified | qualified | 62.86 | 16:03 | 1.706059 |
| DD | refused: security_identity_unqualified | qualified | 131.57 | 16:00 | 1.790599 |
| DE | refused: security_identity_unqualified | qualified | 650.67 | 16:31 | 3.004434 |
| DG | refused: security_identity_unqualified | qualified | 133.83 | 16:03 | 3.004559 |
| DHI | refused: security_identity_unqualified | qualified | 139.55 | 16:41 | 2.895276 |
| DHR | refused: security_identity_unqualified | qualified | 231.48 | 16:03 | 2.857885 |
| DIS | refused: security_identity_unqualified | qualified | 110.66 | 16:40 | 1.790232 |
| DKNG | refused: security_identity_unqualified | qualified | 19.31 | 16:41 | 5.134941 |
| DLR | refused: security_identity_unqualified | qualified | 174.405 | 16:41 | 2.631439 |
| DLTR | refused: security_identity_unqualified | qualified | 124.41 | 16:20 | 2.932125 |
| DOW | refused: security_identity_unqualified | qualified | 29.67 | 16:25 | 2.584048 |
| DTE | refused: security_identity_unqualified | qualified | 128.33 | 16:03 | 1.637241 |
| DUK | refused: security_identity_unqualified | qualified | 118.92 | 16:41 | 1.370530 |
| DVN | refused: security_identity_unqualified | qualified | 49.24 | 16:39 | 2.686550 |
| EA | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| EBAY | refused: security_identity_unqualified | qualified | 122.91 | 16:38 | 2.811581 |
| ECL | refused: security_identity_unqualified | qualified | 290.73 | 16:41 | 1.804244 |
| ED | refused: security_identity_unqualified | qualified | 109.84 | 16:03 | 1.628696 |
| EIX | refused: security_identity_unqualified | qualified | 55.63 | 16:41 | 2.951491 |
| ELV | refused: security_identity_unqualified | qualified | 428.265 | 16:03 | 2.468043 |
| EMR | refused: security_identity_unqualified | qualified | 162.16 | 16:41 | 2.476543 |
| EOG | refused: security_identity_unqualified | qualified | 152.67 | 16:11 | 2.115427 |
| EQIX | refused: security_identity_unqualified | qualified | 996.26 | 16:41 | 2.577746 |
| EQR | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| ETN | qualified | qualified | 402.46 | 16:03 | 3.706129 |
| ETR | refused: security_identity_unqualified | qualified | 103.95 | 16:41 | 1.840680 |
| EXC | refused: security_identity_unqualified | qualified | 42.48 | 16:00 | 1.634046 |
| EXR | refused: security_identity_unqualified | qualified | 137.63 | 16:03 | 1.913200 |
| F | refused: security_identity_unqualified | qualified | 12.315 | 16:44 | 2.199083 |
| FANG | refused: security_identity_unqualified | qualified | 195.6 | 16:00 | 2.217536 |
| FCX | refused: security_identity_unqualified | qualified | 70.02 | 16:09 | 3.764048 |
| FDX | refused: security_identity_unqualified | qualified | 295.53 | 16:42 | 1.640629 |
| FE | refused: security_identity_unqualified | qualified | 45.545 | 16:09 | 1.535205 |
| FMC | refused: security_identity_unqualified | qualified | 5.62 | 16:42 | 11.309455 |
| FOXA | refused: security_identity_unqualified | qualified | 63.98 | 16:00 | 2.700844 |
| GD | refused: security_identity_unqualified | qualified | 337.045 | 16:03 | 1.676349 |
| GE | refused: security_identity_unqualified | qualified | 312.01 | 16:41 | 2.218577 |
| GEV | refused: security_identity_unqualified | qualified | 926.57 | 16:40 | 4.674661 |
| GILD | refused: security_identity_unqualified | qualified | 157.37 | 16:03 | 2.445102 |
| GIS | refused: security_identity_unqualified | qualified | 32.87 | 16:41 | 2.899105 |
| GM | refused: security_identity_unqualified | qualified | 83.66 | 16:25 | 2.420938 |
| GME | refused: security_identity_unqualified | qualified | 28.04 | 16:43 | 3.981850 |
| GOOG | refused: security_identity_unqualified | qualified | 344.91 | 16:44 | 2.409473 |
| GOOGL | refused: security_identity_unqualified | qualified | 349.22 | 16:43 | 2.417837 |
| GS | refused: security_identity_unqualified | qualified | 891.52 | 16:41 | 2.406491 |
| HAL | refused: security_identity_unqualified | qualified | 32.89 | 16:03 | 2.470356 |
| HD | refused: security_identity_unqualified | qualified | 308.27 | 16:41 | 2.093953 |
| HES | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| HON | refused: security_identity_unqualified | qualified | 210.5 | 16:41 | 1.988972 |
| HOOD | refused: security_identity_unqualified | qualified | 103.99 | 16:43 | 5.240312 |
| HSY | refused: security_identity_unqualified | qualified | 168.68 | 16:00 | 2.009723 |
| HUM | refused: security_identity_unqualified | qualified | 432.13 | 16:23 | 4.584848 |
| IBM | refused: security_identity_unqualified | qualified | 234.085 | 16:41 | 2.457528 |
| ICE | refused: security_identity_unqualified | qualified | 158.39 | 16:03 | 1.866310 |
| IFF | refused: security_identity_unqualified | qualified | 90.29 | 16:03 | 2.062007 |
| INTC | refused: security_identity_unqualified | qualified | 95.37 | 16:44 | 5.845654 |
| INTU | refused: security_identity_unqualified | qualified | 330.17 | 16:38 | 3.440010 |
| IPG | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| IRM | refused: security_identity_unqualified | qualified | 112.665 | 16:41 | 2.844484 |
| ISRG | refused: security_identity_unqualified | qualified | 427.86 | 16:17 | 2.624023 |
| ITW | refused: security_identity_unqualified | qualified | 271.01 | 16:03 | 2.093516 |
| JNJ | refused: security_identity_unqualified | qualified | 253.37 | 16:23 | 2.549832 |
| JPM | refused: security_identity_unqualified | qualified | 335.57 | 16:38 | 1.777660 |
| K | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| KHC | refused: security_identity_unqualified | qualified | 23.27 | 16:43 | 2.405805 |
| KLAC | refused: security_identity_unqualified | qualified | 174.46 | 16:42 | 4.565283 |
| KMB | refused: security_identity_unqualified | qualified | 104.07 | 16:26 | 2.109844 |
| KMI | refused: security_identity_unqualified | qualified | 32.83 | 16:10 | 2.199878 |
| KO | refused: security_identity_unqualified | qualified | 91.9 | 16:34 | 1.501941 |
| KR | refused: security_identity_unqualified | qualified | 62.715 | 16:41 | 2.686972 |
| LEN | refused: security_identity_unqualified | qualified | 77.69 | 16:41 | 4.253991 |
| LIN | qualified | qualified | 493.22 | 16:03 | 1.660879 |
| LLY | refused: security_identity_unqualified | qualified | 1252.24 | 16:40 | 2.962467 |
| LMT | refused: security_identity_unqualified | qualified | 532.865 | 16:33 | 1.847670 |
| LOW | refused: security_identity_unqualified | qualified | 195.755 | 16:03 | 2.418178 |
| LRCX | refused: security_identity_unqualified | qualified | 277.46 | 16:40 | 4.883072 |
| LYV | refused: security_identity_unqualified | qualified | 172.55 | 16:41 | 2.196146 |
| MA | refused: security_identity_unqualified | qualified | 616.34 | 16:41 | 1.707923 |
| MAA | refused: security_identity_unqualified | qualified | 116.2 | 16:00 | 1.801189 |
| MAR | refused: security_identity_unqualified | qualified | 385.71 | 16:03 | 1.932059 |
| MCD | refused: security_identity_unqualified | qualified | 242.52 | 16:38 | 1.656701 |
| MDLZ | refused: security_identity_unqualified | qualified | 63.03 | 16:41 | 1.926459 |
| MDT | qualified | qualified | 95.47 | 16:42 | 2.629739 |
| META | refused: security_identity_unqualified | qualified | 736.72 | 16:44 | 3.027803 |
| MLM | refused: security_identity_unqualified | qualified | 491.4 | 16:03 | 2.481962 |
| MMC | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| MMM | refused: security_identity_unqualified | qualified | 165.3 | 16:11 | 2.018042 |
| MO | refused: security_identity_unqualified | qualified | 73.83 | 16:36 | 1.966424 |
| MOS | refused: security_identity_unqualified | qualified | 18.95 | 16:25 | 4.413871 |
| MPC | refused: security_identity_unqualified | qualified | 476.85 | 16:41 | 3.408928 |
| MRK | refused: security_identity_unqualified | qualified | 145.35 | 16:40 | 2.687296 |
| MS | refused: security_identity_unqualified | qualified | 182.07 | 16:14 | 2.551581 |
| MSFT | refused: security_identity_unqualified | qualified | 539.44 | 16:42 | 2.104472 |
| MTCH | refused: security_identity_unqualified | qualified | 44.1 | 16:00 | 2.373106 |
| MU | refused: security_identity_unqualified | qualified | 931.24 | 16:44 | 5.046454 |
| NEE | refused: security_identity_unqualified | qualified | 78.97 | 16:23 | 1.711988 |
| NEM | refused: security_identity_unqualified | qualified | 115.7 | 16:20 | 2.969662 |
| NFLX | refused: security_identity_unqualified | qualified | 72.61 | 16:42 | 2.269463 |
| NKE | refused: security_identity_unqualified | qualified | 37.16 | 16:43 | 3.365644 |
| NOC | refused: security_identity_unqualified | qualified | 499.525 | 16:41 | 2.230066 |
| NOW | refused: security_identity_unqualified | qualified | 148.62 | 16:42 | 4.010245 |
| NSC | refused: security_identity_unqualified | qualified | 324.64 | 16:02 | 1.445745 |
| NUE | refused: security_identity_unqualified | qualified | 254.59 | 16:03 | 2.641152 |
| NVDA | refused: security_identity_unqualified | qualified | 217.23 | 16:44 | 2.743580 |
| NVO | refused: security_identity_unqualified | qualified | 39.24 | 16:26 | 1.937550 |
| NWS | refused: security_identity_unqualified | qualified | 33.06 | 16:00 | 2.073071 |
| O | refused: security_identity_unqualified | qualified | 55.555 | 16:42 | 1.571850 |
| OKE | refused: security_identity_unqualified | qualified | 90.64 | 16:00 | 2.543141 |
| OMC | refused: security_identity_unqualified | qualified | 80.73 | 16:00 | 2.068438 |
| ORCL | refused: security_identity_unqualified | qualified | 134.49 | 16:44 | 5.071431 |
| ORLY | refused: security_identity_unqualified | qualified | 88.5 | 16:20 | 1.898305 |
| OXY | refused: security_identity_unqualified | qualified | 60.67 | 16:22 | 2.474158 |
| PANW | refused: security_identity_unqualified | qualified | 370.27 | 16:19 | 4.720879 |
| PARA | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| PCG | refused: security_identity_unqualified | qualified | 12.955 | 16:41 | 3.172475 |
| PEG | refused: security_identity_unqualified | qualified | 70.2 | 16:28 | 2.005209 |
| PEP | refused: security_identity_unqualified | qualified | 128.38 | 16:43 | 2.153762 |
| PFE | refused: security_identity_unqualified | qualified | 29.42 | 16:41 | 1.991945 |
| PG | refused: security_identity_unqualified | qualified | 157.06 | 16:31 | 1.745244 |
| PGR | refused: security_identity_unqualified | qualified | 213.7 | 16:03 | 2.644213 |
| PKG | refused: security_identity_unqualified | qualified | 232.56 | 16:00 | 1.868789 |
| PLD | refused: security_identity_unqualified | qualified | 126.95 | 16:03 | 2.246562 |
| PLTR | refused: security_identity_unqualified | qualified | 200.5 | 16:44 | 3.217599 |
| PM | refused: security_identity_unqualified | qualified | 199.84 | 16:05 | 2.456486 |
| PPG | refused: security_identity_unqualified | qualified | 107.8 | 16:39 | 2.066466 |
| PPL | refused: security_identity_unqualified | qualified | 34.49 | 16:37 | 1.530908 |
| PSA | refused: security_identity_unqualified | qualified | 295.4 | 16:03 | 1.861961 |
| PSX | refused: security_identity_unqualified | qualified | 289.06 | 16:03 | 3.047446 |
| PWR | refused: security_identity_unqualified | qualified | 642.22 | 16:00 | 4.363067 |
| QCOM | refused: security_identity_unqualified | qualified | 178.4 | 16:41 | 3.726698 |
| RKLB | refused: security_identity_unqualified | qualified | 55.25 | 16:44 | 7.786425 |
| ROST | refused: security_identity_unqualified | qualified | 234.83 | 16:21 | 2.285848 |
| RTX | refused: security_identity_unqualified | qualified | 186.915 | 16:13 | 1.756134 |
| SBAC | refused: security_identity_unqualified | qualified | 183.72 | 16:41 | 3.161643 |
| SBUX | refused: security_identity_unqualified | qualified | 96.88 | 16:41 | 2.581249 |
| SCHW | refused: security_identity_unqualified | qualified | 94.21 | 16:41 | 2.082322 |
| SHOP | qualified | qualified | 178.14 | 16:39 | 4.047820 |
| SHW | refused: security_identity_unqualified | qualified | 336.98 | 16:21 | 2.363109 |
| SLB | qualified | qualified | 48.37 | 16:19 | 2.963761 |
| SNOW | refused: security_identity_unqualified | qualified | 335.07 | 16:41 | 4.415495 |
| SO | refused: security_identity_unqualified | qualified | 89.18 | 16:38 | 1.593775 |
| SPG | refused: security_identity_unqualified | qualified | 203.27 | 16:03 | 1.577897 |
| SPGI | refused: security_identity_unqualified | qualified | 424.89 | 16:41 | 1.942549 |
| SRE | refused: security_identity_unqualified | qualified | 81.91 | 16:03 | 1.621593 |
| STZ | refused: security_identity_unqualified | qualified | 129.61 | 16:00 | 2.561021 |
| SYK | refused: security_identity_unqualified | qualified | 293.32 | 16:02 | 2.591166 |
| SYY | refused: security_identity_unqualified | qualified | 82.14 | 16:00 | 1.618518 |
| T | refused: security_identity_unqualified | qualified | 23.51 | 16:41 | 2.699255 |
| TJX | refused: security_identity_unqualified | qualified | 144.585 | 16:41 | 1.990001 |
| TMO | refused: security_identity_unqualified | qualified | 696.59 | 16:41 | 2.895027 |
| TMUS | refused: security_identity_unqualified | qualified | 157.03 | 16:23 | 3.351380 |
| TRGP | refused: security_identity_unqualified | qualified | 282.56 | 16:03 | 2.600930 |
| TSLA | refused: security_identity_unqualified | qualified | 362.44 | 16:44 | 2.880083 |
| TSN | refused: security_identity_unqualified | qualified | 54.02 | 16:10 | 1.700460 |
| TTWO | refused: security_identity_unqualified | qualified | 209.38 | 16:41 | 3.022188 |
| TXN | refused: security_identity_unqualified | qualified | 279.12 | 16:41 | 2.904281 |
| UDR | refused: security_identity_unqualified | qualified | 34.205 | 16:00 | 1.773709 |
| UNH | refused: security_identity_unqualified | qualified | 406.66 | 16:43 | 2.932704 |
| UNP | refused: security_identity_unqualified | qualified | 288.705 | 16:03 | 1.420234 |
| UPS | refused: security_identity_unqualified | qualified | 97.84 | 16:41 | 1.684774 |
| USB | refused: security_identity_unqualified | qualified | 57.385 | 16:29 | 1.841070 |
| V | refused: security_identity_unqualified | qualified | 399.71 | 16:41 | 1.779594 |
| VICI | refused: security_identity_unqualified | qualified | 23.46 | 16:23 | 1.662100 |
| VLO | refused: security_identity_unqualified | qualified | 444.04 | 16:41 | 3.707588 |
| VMC | refused: security_identity_unqualified | qualified | 252.35 | 16:41 | 2.503679 |
| VRTX | refused: security_identity_unqualified | qualified | 508.75 | 16:03 | 2.469070 |
| VTR | refused: security_identity_unqualified | qualified | 84.86 | 16:02 | 2.186393 |
| VZ | refused: security_identity_unqualified | qualified | 44.415 | 16:41 | 2.499737 |
| WBA | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| WBD | refused: catalog_unavailable | refused: catalog_unavailable | — | — | — |
| WEC | refused: security_identity_unqualified | qualified | 106.04 | 16:00 | 1.652341 |
| WELL | refused: security_identity_unqualified | qualified | 234.68 | 16:04 | 1.980474 |
| WFC | refused: security_identity_unqualified | qualified | 82.76 | 16:30 | 2.391023 |
| WM | refused: security_identity_unqualified | qualified | 224.27 | 16:37 | 1.687026 |
| WMB | refused: security_identity_unqualified | qualified | 69.24 | 16:18 | 2.795435 |
| WMT | refused: security_identity_unqualified | qualified | 117.87 | 16:43 | 2.182792 |
| WY | refused: security_identity_unqualified | qualified | 19.38 | 16:03 | 2.668030 |
| XEL | refused: security_identity_unqualified | qualified | 75.12 | 16:03 | 1.647840 |
| XOM | refused: security_identity_unqualified | qualified | 174.65 | 16:41 | 1.950914 |
| YUM | refused: security_identity_unqualified | qualified | 150.865 | 16:41 | 1.767127 |
| ZS | refused: security_identity_unqualified | qualified | 220.43 | 16:00 | 4.373303 |
