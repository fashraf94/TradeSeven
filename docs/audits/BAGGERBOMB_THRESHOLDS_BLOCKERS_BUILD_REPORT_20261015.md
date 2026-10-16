# BaggerBomb stock thresholds: the two pilot switch-on blockers (build report)

October 15–16, 2026. Built by Claude Code (Opus) from Fable's prompt carrying Flash's rulings P1–P3. Branch `claude/baggerbomb-thresholds-blockers-a70d58` (the prompt named no branch; this is the app-made worktree branch, pushed under its own name). Input: `docs/audits/BAGGERBOMB_THRESHOLDS_V2_BUILD_REPORT_20261015.md` §5, §6a, §6b and §8. This report's byte-exact copy: `docs/audits/BAGGERBOMB_THRESHOLDS_BLOCKERS_BUILD_REPORT_20261015.md`.

## For Flash, in plain English

- **Stocks:** 228 of the 239 stocks now qualify for measured scoring (up from 8). The other 11 are the stocks we already exclude on purpose.
- **When a pilot battle can start (every pilot roster holds crypto):** any time from 8:00 PM ET (7:00 PM CT) until 3:15 PM ET (2:15 PM CT) the next trading day. That includes overnight, before the open, during the session, weekends and holidays.
- **When it cannot:** from 3:15 PM to 8:00 PM ET (2:15–7:00 PM CT) on a trading day, Fridays included. On a 1:00 PM early-close day the block is 12:15–1:15 PM ET (11:15 AM–12:15 PM CT); after that the battle plays the next session.
- **What a refused player sees:** "Measured battles can't start this late in the day. Try again after 8:00 PM ET." On an early-close day it says 1:15 PM ET.
- **Also fixed:** the "Why" panel on a measured stock now points to the nearest penalty when the stock is below its entry, as the old scoring does.
- **Safety:** nothing changes for anyone outside the pilot list, and nothing was written to production. It is pushed for your review; switching the pilot on is a separate step.

## Verdict table

| # | Ruling | Verdict | Where (HEAD) | Proof |
| --- | --- | --- | --- | --- |
| P1 | Identity: non-empty ISIN keeps `EODHD:<SYM>.US:<ISIN>`; else a well-formed 12-char FIGI gives `EODHD:<SYM>.US:FIGI:<OpenFigi>`; neither refuses; CIK and LEI never used; not hashed; nothing migrated | DONE | `api/_utils/stockThresholdMeasurementProvider.js:25` (`wellFormedFigi`), `:31` (`securityIdentity`), `:57–58`, `:73` | `stockThresholdV2.test.js:388` describe (17 rows); policy hash pinned unchanged |
| P2 | Evening window: selected creations only, after selection and before any measurement GET, refused retriably `evening_window` when outside a session and the battle's own `expiresAt` falls before the next session's open; from the calendar, no clock literal; no gap with the 45-minute late start; the player line names the retry time from the same rule | DONE (two readings, §5) | `src/utils/stockAdmissionWindow.js:46` (`eveningWindowRefusal`), `:66` (`stockAdmissionRetryAt`); `api/_utils/stockThresholdAdmission.js:73–74`; `src/services/agentDeploy.js:29`, `:35–39` | `stockThresholdV2.test.js:448` describe (22 rows, incl. the sweep at `:544`); `agentDeploy.stockAdmission.test.js:32`, `:38` |
| P3 | Measured Why proximity follows direction: approaching a penalty shows `penaltyProximity`, a reward `proximity`; committed context only; legacy unchanged | DONE | `src/utils/stockThresholdModel.js:108–117` | `stockThresholdRendered.test.jsx:98`, `:121` |
| — | Approval doc and runbook record P1 and P2 (P2 narrows Ruling 7 for the pilot only) | DONE | `docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md` "Switch-on preconditions"; `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_ADMISSION_RUNBOOK_V1_20261013.md` | §3 |
| — | Universe on the real collector path (GET only, concurrency 1, no Firestore) | DONE: 228 qualified, 11 catalog exclusions, UNP, HUM and ACN named | §4 and Appendix A | live record |
| — | Fence | No fenced file edited | §2 | `git diff --stat` over the §1 list is empty |

| Check | Head | Result |
| --- | --- | --- |
| Full suite, Linux (WSL Ubuntu, Node 20.20.2, `CI=true TZ=UTC --maxWorkers=2`, exit code asserted) | `e3fd3413` (branch merged with `main` `1d6d5d4a`) | Test Files 1008 passed, 7 skipped (1015). Tests 21630 passed, 88 skipped (21718). EXIT=0 |
| `npm run lint:gate` | `e3fd3413` | exit 0 |
| `vite build` | `e3fd3413` | exit 0, 3998 modules, built in 17.71 s |
| BUILD_RULES §2 review | — | Applies: the branch diff is 13 files (12 plus this report) at +466/−47 against `main`; the 1,500-line threshold is not met. Three lenses, three refuting verifiers, mutation lens last (§6). |

## 1. Preamble

- `git fetch origin` ran first. Branch `claude/baggerbomb-thresholds-blockers-a70d58`, HEAD `9a8dd351` = `origin/main` (PR #972's merge), clean tree.
- #972 is on `main`: `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true` (`src/config/featureFlags.js:3263`) and `modelId: 'stock_measured_atr14_fullday_v2'` (`src/utils/stockThresholdModel.js:8`). No STOP.
- `docs/BUILD_RULES.md` and the v2 build report's §5, §6a, §6b and §8 were read. Every anchor was re-verified before editing.
- `main` moved once during the build (PR #974, Command Center hub S1, `1d6d5d4a`). It shares no file with this branch, and none of its code imports a changed module. It was merged with the app's sync tool at `6cdbf381` before the final checks.
- Commits:
  - `9a02cd64` P1, P2 and P3 with their rows
  - `2c7e975b` approval doc, runbook and the control script's stale note
  - `3a1ea0a3` review fixes
  - `a60da184` a stale comment (review BK2-6)
  - `6cdbf381` merge of `main`
  - `e3fd3413` the mutation-lens kill row (BKM-P4)
  - `87924cf6` the review ids renamed BK… in comments (below)
  - the commit that adds this report

## 2. Fence contact

None edited. `git diff --stat origin/main HEAD` touches none of the eleven §1 files.

Fenced functions **called or affected** through approved hooks, none modified:
- `createAgentBattle` (`api/_utils/agentBattleService.js`). It calls `prepareStockCreation` (v2 Ruling 6 contact), which can now throw `evening_window` for allowlisted owners. The refusal is thrown before `stockCreation` is assigned, so it reaches `decide.js` raw, not wrapped as `corrected_creation_failed`.
- `computeFullDayExpiry` (same file). Unchanged; its `expiresAt` is what the evening check reads. The P2 rows drive the real one through `createAgentBattle` under a faked clock.
- `executeSwapServer` (`api/_utils/agentSwapExecution.js:228`) → `executeCorrectedStockSwap` → the collector. A corrected swap now admits a FIGI-identified stock.
- `decide.js:1073` (read only). The 503 carries `{ error, reason, retriable }` and nothing else, which is why the player's retry time is computed in the browser (§5).

## 3. What changed, by ruling

### P1 (identity)

- `wellFormedFigi` (`api/_utils/stockThresholdMeasurementProvider.js:25`) checks four things:
  - the OpenFIGI shape: two consonants, `G`, eight consonants or digits, a digit;
  - the reserved prefixes BS, BM, GG, GB, GH, KY and VG are refused;
  - the check digit (letters 10–35, every second character doubled, digits summed);
  - it was validated on six real FIGIs, and review lens BK1 confirmed it on seventeen against an independent implementation.
- `securityIdentity` (`:31`) decides the id:
  - a non-empty ISIN string gives `<ISIN>`;
  - otherwise a well-formed `OpenFigi` gives `FIGI:<OpenFigi>`;
  - otherwise `security_identity_unqualified`.
- Every other identity check runs first, exactly as before (`:57`). The id goes into `securityId` (`:73`).
- Receipts carry the id, and `readCorrectedInputs` compares it by equality (`stockThresholdAdmission.js:224`), so both forms replay. No reader parses it.
- The provider's `OpenFigi` is the US composite FIGI, one per security: BRK-A `BBG000DWDMY4`, BRK-B `BBG000DWH8Q0`, with one shared CIK.
- The v2 policy hash (`22a81598…`), the publication-rule hash, the approved reference and `approvedAt` are unchanged, and a row pins the policy hash. No receipt existed, so nothing was migrated.

### P2 (evening window)

- **The rule.** `eveningWindowRefusal(began, expiresAt)` (`src/utils/stockAdmissionWindow.js:46`):
  - Before or during the current session, it returns null without reading the expiry.
  - After the close, or on a weekend or holiday, it walks the calendar to the next trading session (`nextSessionAfter`, through `getSessionForDate`). It refuses `evening_window` when the battle's own `expiresAt` is strictly before that session's `openMs`.
  - A malformed instant refuses `invalid_creation_instant`, an unreadable expiry `invalid_battle_expiry`, and a walk outside the maintained calendar `calendar_missing`.
- **The wiring.** `prepareStockCreation` runs `lateStartRefusal(began) || eveningWindowRefusal(began, battleDoc.expiresAt)` on one instant (`api/_utils/stockThresholdAdmission.js:73–74`): after selection, before the collector loop.
- **No gap.** The late start ends at the close, exactly where the evening window begins.
- **One publication delay.** The collector's 15-minute delay is now the shared `STOCK_PUBLICATION_DELAY_MINUTES` (`stockThresholdMeasurementProvider.js:37`, `:83`), with the same value. A row ties it to the hashed `publicationRule.minimumMinutesAfterScheduledClose`.
- **The player line** (`src/services/agentDeploy.js:35–39`). For `late_start_cutoff` and `evening_window` it reads "Measured battles can't start this late in the day. Try again after {time} ET."
  - `{time}` is `stockAdmissionRetryAt(now)` (`stockAdmissionWindow.js:66`): on a regular day the Night Game close (`NIGHT_GAME_CLOSE`, 20:00); on an early-close day the end of the publication window (13:15).
  - The publication line now reads the shared constant.
  - A null retry time (a non-trading-day clock) falls back to the generic line.
- **Unchanged.** Non-selected owners, legacy creation and tournaments: lens BK2's repro compared 8 instants × 5 control states, byte-identical with zero fetch.

### P3 (Why proximity)

- `measuredProximity` (`src/utils/stockThresholdModel.js:108`) picks the side by direction:
  - Below the fill (`multiplier < 0`) it returns the committed `penaltyProximity` with the line "📉 0.8% to Bust", over the committed price.
  - When every penalty tier is crossed, it returns "🔥 MAX", mirroring the measured reward side's "MAX".
  - At or above the fill it returns the reward side, as before. Zero looks up, as legacy's `priceChange >= 0` does.
- The legacy path never calls it.

### Docs

- The approval doc's "Switch-on preconditions" section records:
  - P1, with the universe counts;
  - P2: the rule, the narrowing of Ruling 7 and of the hashed `offHoursCreation.allowed` entry for the pilot only, pending the legacy evening-draw diagnosis, the start/stop times in ET and CT, the early-close behaviour, the player line and its crypto and browser-clock assumptions;
  - P3.
- The runbook's two precondition sections now read as ruled. It adds a table of start/stop times, the per-attempt cost (BK2-3) and the horizon evening (BK1-1).
- The control script's stale "ISIN is null" precondition note follows.
- The v2 build report is a historical record and is not edited.

## 4. Universe record (real collector path)

- **The run.** Oct 15 2026, 23:09:34–23:10:49 ET: GET only, concurrency 1, no Firestore, the key never printed. Each symbol went through `collectStockObservation` → `qualifyStockObservation` → `bindStockReceipt` → `stockRewardContext` at the fill quote, with no emulation.
- **228 qualified** (8 with the ISIN form: ACN, AON, CB, ETN, LIN, MDT, SHOP, SLB; 220 with the FIGI form). All 228 identities are distinct.
- **11 refused `catalog_unavailable`:** AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA, WBD. That matches the expectation.
- **Fills.** Every fill stamp fell between 16:00 and 16:44 ET, at or after the close. Measured % ranged 1.039 to 11.303, median 2.458.

| Named | Identity | Fill | Stamp (ET) | Scoring % | Bagger / Double / Ten | Bust / Crash / Meltdown |
| --- | --- | --- | --- | --- | --- | --- |
| UNP | FIGI `BBG000BW3299` | 288.705 | 16:03 | 1.420481 | 292.81 / 294.86 / 296.91 | 284.60 / 282.55 / 280.50 |
| HUM | FIGI `BBG000BLKK03` | 432.13 | 16:23 | 4.584848 | 451.94 / 461.85 / 471.76 | 412.32 / 402.41 / 392.50 |
| ACN | ISIN `IE00B4BNMY34` | 224.9 | 16:04 | 4.560302 | 235.16 / 240.28 / 245.41 | 214.64 / 209.52 / 204.39 |

**Difference recorded.** The qualified set is identical to the v2 build's FIGI emulation at 17:35 ET, and so is every fill and fill stamp. But 99 of the 228 scoring percentages moved: median 0.018% relative, largest WELL +2.14%, VZ +1.48%, TMO +0.84%. UNP moved 1.420234 → 1.420481 and ACN 4.560461 → 4.560302.

The provider revised the Oct 15 daily bars after 17:35 ET; a re-read of BLK's and FMC's bars shows updated volumes. So a measured % depends on when the collector runs after the close. A battle's receipt freezes its own snapshot, so replay is unaffected. This is a reading for Fable, not a defect in this build.

## 5. Readings and deviations (flagged, not relitigated)

1. **Early close ("refused … until its evening expiry").** On an early-close day the fenced expiry gives a crypto roster the 13:00 close itself; there is no Night Game. From 13:00 the battle expires at the next session's 20:00. So the derived rule refuses:
   - 12:15–13:00 ET (late start);
   - then the collector's publication window, 13:00–13:15 ET;
   - and allows from 13:15 ET.

   The rows assert exactly that (`stockThresholdV2.test.js` "early-close day (Nov 27)"). The rule was followed rather than the prose.
2. **The retry time is computed in the browser.** The fenced 503 carries only the reason, so `stockAdmissionLine` derives the time from the browser's clock when the refusal arrives, assuming the roster holds crypto. That assumption holds: a tiered decision without its support crypto is refused at `decide.js:1172`, and the fallback hard-codes BTC (verifier BKV2).
   - A browser clock on another day gets the generic line or that day's time.
   - A later option, with no fence edit, is to read the response's HTTP `Date` header (verifier BKV1).
3. **"Before the next open" is strict.** An expiry exactly at the next open is allowed. The fence only produces close-time expiries, so the edge never occurs in practice. It is pinned by a boundary row.
4. **Process zone.** The fenced `computeFullDayExpiry` derives its instant from the process zone: under Chicago it returns 19:00Z instead of 00:00Z. Production and CI run UTC.
   - The `stockThresholdV2.test.js` suite now imports the repo's `pinTimezoneUtc.js` first (forks pool).
   - A named row fails first if a pool ever ignores the pin.
   - The fenced behaviour is pre-existing and out of scope.
5. **Per-attempt cost (BK2-3).** The refusal comes at battle creation, after `decide.js` has made its model calls and overwritten `lastDecision`, and the cooldown is restored. That matches the late start's existing shape, but the refused window grows from 45 minutes to 4 h 45 min a day. It is recorded in the runbook; no fix is possible without fence contact.

## 6. Review record (BUILD_RULES §2)

**Shape.**
- Three lenses, each on its own LF `git archive` tree of `2c7e975b`:
  - BK1 domain and model;
  - BK2 wiring, fence, legacy guarantee and docs;
  - BK3 test integrity and display.
- Then three refuting verifiers, BKV1–BKV3, one per lens, each on its own tree, instructed to refute every finding with a repro.
- Then the mutation lens last, on its own tree of the final code head `a60da184`: 41 mutants applied in memory through a vitest `load` hook, with no file edited.
- No reviewer wrote to the worktree or git. Hand mutants in BK3 and BKV3 were restored byte-exactly (`cmp` against `git show`).

**Ids.** This review uses its own ids: lenses BK1-n, BK2-n and BK3-n, verifiers BKV1–BKV3, mutants BKM-…. They are distinct from the v2 build review's B1-n/B2-n/B3-n, which the code, the prompt and this report's §8 cite (for example ruling P3 is the v2 review's B3-7). Commits `3a1ea0a3`, `a60da184` and `e3fd3413` were written before the rename and cite these findings as B…-n and "mutation lens P4"; read B1-n as BK1-n, and so on.

**Outcome: 22 findings.** 14 CONFIRMED, 8 PARTLY, 0 REFUTED. None HIGH. One MED, local only.
- Dispositions: 12 fixed (BK1-6 and BK3-1 to BK3-4 in code or tests; BK1-5, BK2-1, BK2-2, BK2-4, BK2-6, BK2-7 and BK2-9 in wording or a tie row).
- 10 recorded as readings or notes with no code change (BK1-1 to BK1-4, BK2-3, BK2-5, BK2-8, BK3-5 to BK3-7).

**Strongest negative evidence.**
- BK1 walked every 15 minutes from 2026-10-15 to 2027-12-31, with a crypto roster and a stock-only one, through the real refusal chain and the fence's own expiry. It found **0 gaps** (allowed but unplayable) and **0 over-refusals**. The walk covered both DST weekends, Thanksgiving, Christmas, Good Friday and all three early closes.
- BK2 found creation byte-identical with zero fetch for every non-selected state at 8 instants.

| Id | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| BK1-1 | At the calendar horizon (Fri 2027-12-31) the late start names 8:00 PM, then 20:00 is refused `calendar_missing` (the next session is in untabled 2028); 20:00–24:00 that evening was accepted at base | CONFIRMED (LOW) | Note: runbook; the fix is the 2028 calendar tables (TODO `marketCalendar.js:13`) |
| BK1-2 | The retry time assumes crypto | CONFIRMED (INFO; unreachable in tiered mode) | Recorded in the approval and runbook |
| BK1-3 | The retry time comes from the browser clock | PARTLY (fixable via the HTTP `Date` header, no fence) | Note (§5.2) |
| BK1-4 | Penalty MAX reads "🔥 MAX"; legacy shows "🔥 Meltdown" | PARTLY (as approved; mirrors measured "MAX") | None |
| BK1-5 | "FIGI is share-class level" is imprecise: the provider gives the composite FIGI | CONFIRMED | Fixed: comment, approval doc, row title |
| BK1-6 | The publication line hard-codes 15 | CONFIRMED | Fixed: the line reads the shared constant |
| BK2-1 | Approval said "collector code unchanged" | CONFIRMED | Fixed |
| BK2-2 | P2 narrows the hashed `offHoursCreation.allowed` entry; the approval did not say so | PARTLY | Fixed: the approval says it; the policy file is not edited |
| BK2-3 | Each refused attempt costs model calls and replaces `lastDecision` | CONFIRMED | Recorded (runbook; §5.5) |
| BK2-4 | Runbook: the publication window shows only on early-close days or for stock-only rosters; the next late start can be 12:15 | PARTLY | Fixed |
| BK2-5 | Horizon `calendar_missing` (same as BK1-1) | PARTLY (wider: includes the false 8 PM promise) | Note |
| BK2-6 | "Computes at the refusal instant" is the browser clock on arrival | CONFIRMED | Fixed: approval, runbook, code comment |
| BK2-7 | The shared delay was not tied to the hashed publication rule | CONFIRMED | Fixed: tie row |
| BK2-8 | Name the fenced functions affected | CONFIRMED | §2 and the PR |
| BK2-9 | Crypto assumption (same as BK1-2) | PARTLY (unreachable) | Recorded |
| BK3-1 | P2 rows fail under a non-UTC machine zone | CONFIRMED (MED, local only) | Fixed: `pinTimezoneUtc.js` first import; under Chicago now 78/78 |
| BK3-2 | Five malformed-FIGI rows failed the check digit, so the shape mutants survived | PARTLY (better values) | Fixed: values with valid check digits |
| BK3-3 | Penalty denominator mutant survived | CONFIRMED | Fixed: "🔥 2.8% to Meltdown" row |
| BK3-4 | The legacy control could not fail on the distance figure | PARTLY | Fixed: literal "📉 0.3% to Bust" |
| BK3-5 | The sweep's oracle reuses the rule; removing the check from `prepareStockCreation` survives the sweep | CONFIRMED (dedicated rows kill it; the count is independent) | None |
| BK3-6 | The `\s` normalization is a no-op on Node 20 and 22 | CONFIRMED | Kept (defensive) |
| BK3-7 | The MAX branch's spread has no visible effect | CONFIRMED | Killed by a row after the mutation lens (BKM-P4) |

**Mutation lens: 41 mutants, 38 KILLED and 3 SURVIVED on the first run.**
- P1 (12, all killed; ids BKM-F1…F12):
  - check digit ignored;
  - reserved prefixes dropped;
  - `^` dropped;
  - vowels allowed;
  - third character not G;
  - case-insensitive;
  - any string accepted;
  - FIGI before ISIN;
  - no `FIGI:` tag;
  - empty ISIN kept;
  - doubling on the wrong positions;
  - CIK fallback added.
- P2 (14; 13 killed; ids BKM-W1…W11, BKM-A1…A3):
  - `<=` against the open;
  - gate dropped;
  - gate `<=`;
  - retry always close + 15;
  - retry ignores the early close;
  - Night Game at 21:00;
  - compare to the next close;
  - delay 16;
  - unreadable expiry accepted;
  - next calendar day;
  - check removed from `prepareStockCreation`;
  - reads `createdAt`;
  - check before selection;
  - BKM-W4 survived (below).
- Client (6; 5 killed; ids BKM-D1…D6):
  - hard-coded 8:00 PM;
  - late start not a retry reason;
  - evening window not a retry reason;
  - real clock instead of the passed instant;
  - publication line off by one;
  - BKM-D2 survived (below).
- P3 (8; 7 killed on the first run, BKM-P4 killed later):
  - `<=` at zero;
  - penalty side never taken;
  - penalty line spreads `proximity`;
  - over-target denominator;
  - MAX emoji from crash;
  - sign swapped;
  - MAX keyed on `nextTarget`.
- Legacy control (1, killed; BKM-L1): legacy Bust distance + 3.

| Survivor | Verdict | Action |
| --- | --- | --- |
| BKM-W4 (`isTradingDay` dropped from the gate) | Equivalent: `closeMs` is null on a non-trading day, so `ms < null` is false either way | None |
| BKM-D2 (space normalization dropped) | Equivalent on Node 20.20.2 and 22 (U+0020 before PM, verified char codes) | None; kept for engines that emit U+202F |
| BKM-P4 (penalty MAX spreads `proximity`) | Real but invisible (WhyPanel reads `.text`) | Row added (`e3fd3413`); re-run KILLED |

Final: **39 of 41 KILLED, 2 equivalent.**

## 7. Checks

**Full suite, Linux.**
- The run used a private WSL tree (`~/pd-bbblk`, synced by full SHA), Node 20.20.2 / npm 10.8.2, `CI=true TZ=UTC`, `--maxWorkers=2`.
- The exit code was captured and the Test Files line read in full. The output was never piped through `tail`.
- Head `e3fd3413` is the code-final branch merged with `main` `1d6d5d4a`: Test Files 1008 passed, 7 skipped (1015); Tests 21630 passed, 88 skipped (21718); EXIT=0; 772 s.

**lint:gate and vite build** at `e3fd3413`.
- `npm run lint:gate` exit 0.
- `vite build` exit 0 (3998 modules, 17.71 s). The CSS-syntax warnings are pre-existing.
- Broad `eslint .` is not a gate here and is not claimed clean.

**The pushed head.** After `e3fd3413` the branch adds two commits:
- `87924cf6`, comment-only id renames;
- the commit that adds this report under `docs/audits/`.

The same Linux suite, `lint:gate` and `vite build` were run again on the exact pushed head; their result is in the PR description.

- Targeted runs on Windows (TZ=UTC and the machine zone) are green for all four touched test files. The Windows full suite has known platform-only rows and is not the record.
- Crons do not run on Vercel preview; nothing here depends on a cron change.

## 8. Out of scope (notes, not changed)

- The v2 review's B2-3: the `no_trigger` exit vocabulary.
- The v2 review's B3-5: the prompt's ATR wording outside the split. It is fence contact (`agentEvalPromptAssembly.js`).
- The legacy evening 0–0 draws are a separate diagnosis task. A legacy battle created 16:15–20:00 ET with crypto still records a 0–0 draw.
- The v2 report's §9 items: CPU flat 2.5%, rank-0 falsy default, legacy modal baseline, intraday rankings drift, the last-30-minutes gap.
- **New, from this build:**
  - The fenced `computeFullDayExpiry` depends on the process zone (§5.4).
  - Scoring percentages move with provider bar revisions after the close (§4).
  - The calendar-horizon evening (BK1-1).
  - `toAssetFromUniverse` checks stocks before crypto (`decide.js:1262–1271`). A future universe ticker equal to a crypto symbol would turn the crypto slot into a stock (verifier BKV1, in passing).

## Appendix A. Universe record (all 239 symbols)

The record files are `universe/run-universe.mjs`, `universe/p1-universe.json` and `universe/p1-universe.log` in this session's scratchpad.

| Symbol | Result | Identity | Fill | Stamp (ET) | Scoring % |
| --- | --- | --- | --- | --- | --- |
| AAPL | qualified | FIGI | 342 | 16:41 | 1.905806 |
| ABBV | qualified | FIGI | 283.37 | 16:35 | 2.464255 |
| ABT | qualified | FIGI | 104.69 | 16:05 | 2.290153 |
| ACN | qualified | ISIN | 224.9 | 16:04 | 4.560302 |
| ADBE | qualified | FIGI | 251.67 | 16:40 | 3.200336 |
| ADP | qualified | FIGI | 285.65 | 16:41 | 1.973194 |
| AEE | qualified | FIGI | 103.77 | 16:00 | 1.531350 |
| AEP | qualified | FIGI | 124.29 | 16:03 | 1.701665 |
| AFRM | qualified | FIGI | 75.92 | 16:26 | 5.010914 |
| ALB | qualified | FIGI | 98.2 | 16:16 | 3.292058 |
| AMAT | qualified | FIGI | 430.01 | 16:43 | 4.688429 |
| AMD | qualified | FIGI | 562.23 | 16:44 | 4.663191 |
| AMGN | qualified | FIGI | 434.03 | 16:41 | 2.455064 |
| AMT | qualified | FIGI | 181.36 | 16:03 | 2.549195 |
| AMZN | qualified | FIGI | 254.76 | 16:44 | 2.260671 |
| AON | qualified | ISIN | 286.77 | 16:03 | 2.191921 |
| APD | qualified | FIGI | 296.34 | 16:23 | 1.760521 |
| ARE | qualified | FIGI | 42.33 | 16:00 | 3.777756 |
| AVB | refused: catalog_unavailable | — | — | — | — |
| AVGO | qualified | FIGI | 344.33 | 16:43 | 3.277587 |
| AWK | qualified | FIGI | 133.03 | 16:00 | 2.005305 |
| AXP | qualified | FIGI | 313.82 | 16:32 | 1.679638 |
| AZO | qualified | FIGI | 3060.92 | 16:03 | 2.585487 |
| BA | qualified | FIGI | 188.68 | 16:42 | 2.941466 |
| BAC | qualified | FIGI | 51.67 | 16:41 | 2.409505 |
| BE | qualified | FIGI | 236.28 | 16:44 | 8.809561 |
| BKNG | qualified | FIGI | 165.8 | 16:42 | 2.879760 |
| BKR | qualified | FIGI | 54.4 | 16:00 | 2.773109 |
| BLK | qualified | FIGI | 1120.81 | 16:16 | 2.277687 |
| BMY | qualified | FIGI | 60.58 | 16:41 | 3.105230 |
| BRK-B | qualified | FIGI | 526 | 16:42 | 1.039470 |
| BSX | qualified | FIGI | 44.155 | 16:41 | 2.496925 |
| C | qualified | FIGI | 123.22 | 16:41 | 2.657484 |
| CAG | qualified | FIGI | 14.18 | 16:07 | 3.279267 |
| CAT | qualified | FIGI | 735.61 | 16:17 | 4.111185 |
| CB | qualified | ISIN | 352.87 | 16:03 | 1.620683 |
| CCI | qualified | FIGI | 80.005 | 16:00 | 3.302679 |
| CE | qualified | FIGI | 46.47 | 16:00 | 3.504522 |
| CEG | qualified | FIGI | 275 | 16:39 | 6.047457 |
| CF | qualified | FIGI | 119.84 | 16:05 | 3.138158 |
| CHTR | qualified | FIGI | 109.99 | 16:41 | 4.266622 |
| CI | qualified | FIGI | 298.83 | 16:39 | 2.749717 |
| CL | qualified | FIGI | 92.63 | 16:23 | 1.746597 |
| CMCSA | qualified | FIGI | 21.77 | 16:42 | 2.255909 |
| CME | qualified | FIGI | 289.46 | 16:03 | 2.049629 |
| CMG | qualified | FIGI | 30.56 | 16:40 | 4.045595 |
| COIN | qualified | FIGI | 183.81 | 16:41 | 5.631852 |
| COP | qualified | FIGI | 141.75 | 16:03 | 2.087470 |
| COST | qualified | FIGI | 978.01 | 16:41 | 1.660984 |
| CRM | qualified | FIGI | 246.715 | 16:41 | 3.418578 |
| CRWD | qualified | FIGI | 244.57 | 16:43 | 4.547109 |
| CRWV | qualified | FIGI | 69.69 | 16:44 | 7.913207 |
| CSCO | qualified | FIGI | 109.85 | 16:39 | 2.687646 |
| CSX | qualified | FIGI | 48.69 | 16:41 | 1.371652 |
| CTRA | refused: catalog_unavailable | — | — | — | — |
| CTVA | qualified | FIGI | 12.865 | 16:34 | 6.678134 |
| CVS | qualified | FIGI | 92.56 | 16:43 | 2.455020 |
| CVX | qualified | FIGI | 219.4 | 16:33 | 1.982101 |
| D | qualified | FIGI | 62.86 | 16:03 | 1.706059 |
| DD | qualified | FIGI | 131.57 | 16:00 | 1.790599 |
| DE | qualified | FIGI | 650.67 | 16:31 | 3.004434 |
| DG | qualified | FIGI | 133.83 | 16:03 | 3.004559 |
| DHI | qualified | FIGI | 139.55 | 16:41 | 2.895532 |
| DHR | qualified | FIGI | 231.48 | 16:03 | 2.857885 |
| DIS | qualified | FIGI | 110.66 | 16:40 | 1.790232 |
| DKNG | qualified | FIGI | 19.31 | 16:41 | 5.139824 |
| DLR | qualified | FIGI | 174.405 | 16:41 | 2.632872 |
| DLTR | qualified | FIGI | 124.41 | 16:20 | 2.932125 |
| DOW | qualified | FIGI | 29.67 | 16:25 | 2.584048 |
| DTE | qualified | FIGI | 128.33 | 16:03 | 1.641972 |
| DUK | qualified | FIGI | 118.92 | 16:41 | 1.371731 |
| DVN | qualified | FIGI | 49.24 | 16:39 | 2.686550 |
| EA | refused: catalog_unavailable | — | — | — | — |
| EBAY | qualified | FIGI | 122.91 | 16:38 | 2.811581 |
| ECL | qualified | FIGI | 290.73 | 16:41 | 1.804244 |
| ED | qualified | FIGI | 109.84 | 16:03 | 1.628696 |
| EIX | qualified | FIGI | 55.63 | 16:41 | 2.952710 |
| ELV | qualified | FIGI | 428.265 | 16:03 | 2.468043 |
| EMR | qualified | FIGI | 162.16 | 16:41 | 2.476543 |
| EOG | qualified | FIGI | 152.67 | 16:11 | 2.115431 |
| EQIX | qualified | FIGI | 996.26 | 16:41 | 2.577782 |
| EQR | refused: catalog_unavailable | — | — | — | — |
| ETN | qualified | ISIN | 402.46 | 16:03 | 3.706129 |
| ETR | qualified | FIGI | 103.95 | 16:41 | 1.840680 |
| EXC | qualified | FIGI | 42.48 | 16:00 | 1.634383 |
| EXR | qualified | FIGI | 137.63 | 16:03 | 1.913200 |
| F | qualified | FIGI | 12.315 | 16:44 | 2.199141 |
| FANG | qualified | FIGI | 195.6 | 16:00 | 2.217718 |
| FCX | qualified | FIGI | 70.02 | 16:09 | 3.764048 |
| FDX | qualified | FIGI | 295.53 | 16:42 | 1.640822 |
| FE | qualified | FIGI | 45.545 | 16:09 | 1.535205 |
| FMC | qualified | FIGI | 5.62 | 16:42 | 11.303100 |
| FOXA | qualified | FIGI | 63.98 | 16:00 | 2.700844 |
| GD | qualified | FIGI | 337.045 | 16:03 | 1.676349 |
| GE | qualified | FIGI | 312.01 | 16:41 | 2.218577 |
| GEV | qualified | FIGI | 926.57 | 16:40 | 4.674659 |
| GILD | qualified | FIGI | 157.37 | 16:03 | 2.446010 |
| GIS | qualified | FIGI | 32.87 | 16:41 | 2.899105 |
| GM | qualified | FIGI | 83.66 | 16:25 | 2.421365 |
| GME | qualified | FIGI | 28.04 | 16:43 | 3.984399 |
| GOOG | qualified | FIGI | 344.91 | 16:44 | 2.409471 |
| GOOGL | qualified | FIGI | 349.22 | 16:43 | 2.418246 |
| GS | qualified | FIGI | 891.52 | 16:41 | 2.406811 |
| HAL | qualified | FIGI | 32.89 | 16:03 | 2.471442 |
| HD | qualified | FIGI | 308.27 | 16:41 | 2.093953 |
| HES | refused: catalog_unavailable | — | — | — | — |
| HON | qualified | FIGI | 210.5 | 16:41 | 1.989141 |
| HOOD | qualified | FIGI | 103.99 | 16:43 | 5.240277 |
| HSY | qualified | FIGI | 168.68 | 16:00 | 2.009723 |
| HUM | qualified | FIGI | 432.13 | 16:23 | 4.584848 |
| IBM | qualified | FIGI | 234.085 | 16:41 | 2.457528 |
| ICE | qualified | FIGI | 158.39 | 16:03 | 1.866314 |
| IFF | qualified | FIGI | 90.29 | 16:03 | 2.067940 |
| INTC | qualified | FIGI | 95.37 | 16:44 | 5.845654 |
| INTU | qualified | FIGI | 330.17 | 16:38 | 3.440010 |
| IPG | refused: catalog_unavailable | — | — | — | — |
| IRM | qualified | FIGI | 112.665 | 16:41 | 2.844338 |
| ISRG | qualified | FIGI | 427.86 | 16:17 | 2.624023 |
| ITW | qualified | FIGI | 271.01 | 16:03 | 2.093516 |
| JNJ | qualified | FIGI | 253.37 | 16:23 | 2.549973 |
| JPM | qualified | FIGI | 335.57 | 16:38 | 1.777660 |
| K | refused: catalog_unavailable | — | — | — | — |
| KHC | qualified | FIGI | 23.27 | 16:43 | 2.405805 |
| KLAC | qualified | FIGI | 174.46 | 16:42 | 4.565283 |
| KMB | qualified | FIGI | 104.07 | 16:26 | 2.109844 |
| KMI | qualified | FIGI | 32.83 | 16:10 | 2.199878 |
| KO | qualified | FIGI | 91.9 | 16:34 | 1.501553 |
| KR | qualified | FIGI | 62.715 | 16:41 | 2.686972 |
| LEN | qualified | FIGI | 77.69 | 16:41 | 4.254451 |
| LIN | qualified | ISIN | 493.22 | 16:03 | 1.660951 |
| LLY | qualified | FIGI | 1252.24 | 16:40 | 2.962467 |
| LMT | qualified | FIGI | 532.865 | 16:33 | 1.847670 |
| LOW | qualified | FIGI | 195.755 | 16:03 | 2.418543 |
| LRCX | qualified | FIGI | 277.46 | 16:40 | 4.883072 |
| LYV | qualified | FIGI | 172.55 | 16:41 | 2.199044 |
| MA | qualified | FIGI | 616.34 | 16:41 | 1.707923 |
| MAA | qualified | FIGI | 116.2 | 16:00 | 1.801189 |
| MAR | qualified | FIGI | 385.71 | 16:03 | 1.932059 |
| MCD | qualified | FIGI | 242.52 | 16:38 | 1.657143 |
| MDLZ | qualified | FIGI | 63.03 | 16:41 | 1.926459 |
| MDT | qualified | ISIN | 95.47 | 16:42 | 2.629649 |
| META | qualified | FIGI | 736.72 | 16:44 | 3.027835 |
| MLM | qualified | FIGI | 491.4 | 16:03 | 2.481962 |
| MMC | refused: catalog_unavailable | — | — | — | — |
| MMM | qualified | FIGI | 165.3 | 16:11 | 2.019338 |
| MO | qualified | FIGI | 73.83 | 16:36 | 1.966424 |
| MOS | qualified | FIGI | 18.95 | 16:25 | 4.413871 |
| MPC | qualified | FIGI | 476.85 | 16:41 | 3.411623 |
| MRK | qualified | FIGI | 145.35 | 16:40 | 2.687296 |
| MS | qualified | FIGI | 182.07 | 16:14 | 2.553150 |
| MSFT | qualified | FIGI | 539.44 | 16:42 | 2.104431 |
| MTCH | qualified | FIGI | 44.1 | 16:00 | 2.373106 |
| MU | qualified | FIGI | 931.24 | 16:44 | 5.046454 |
| NEE | qualified | FIGI | 78.97 | 16:23 | 1.712440 |
| NEM | qualified | FIGI | 115.7 | 16:20 | 2.970279 |
| NFLX | qualified | FIGI | 72.61 | 16:42 | 2.269463 |
| NKE | qualified | FIGI | 37.16 | 16:43 | 3.365644 |
| NOC | qualified | FIGI | 499.525 | 16:41 | 2.230066 |
| NOW | qualified | FIGI | 148.62 | 16:42 | 4.010245 |
| NSC | qualified | FIGI | 324.64 | 16:02 | 1.445699 |
| NUE | qualified | FIGI | 254.59 | 16:03 | 2.651248 |
| NVDA | qualified | FIGI | 217.23 | 16:44 | 2.743573 |
| NVO | qualified | FIGI | 39.24 | 16:26 | 1.937787 |
| NWS | qualified | FIGI | 33.06 | 16:00 | 2.073071 |
| O | qualified | FIGI | 55.555 | 16:42 | 1.573136 |
| OKE | qualified | FIGI | 90.64 | 16:00 | 2.543535 |
| OMC | qualified | FIGI | 80.73 | 16:00 | 2.069765 |
| ORCL | qualified | FIGI | 134.49 | 16:44 | 5.092679 |
| ORLY | qualified | FIGI | 88.5 | 16:20 | 1.898305 |
| OXY | qualified | FIGI | 60.67 | 16:22 | 2.473569 |
| PANW | qualified | FIGI | 370.27 | 16:19 | 4.720964 |
| PARA | refused: catalog_unavailable | — | — | — | — |
| PCG | qualified | FIGI | 12.955 | 16:41 | 3.172475 |
| PEG | qualified | FIGI | 70.2 | 16:28 | 2.005209 |
| PEP | qualified | FIGI | 128.38 | 16:43 | 2.154875 |
| PFE | qualified | FIGI | 29.42 | 16:41 | 1.991945 |
| PG | qualified | FIGI | 157.06 | 16:31 | 1.745244 |
| PGR | qualified | FIGI | 213.7 | 16:03 | 2.644213 |
| PKG | qualified | FIGI | 232.56 | 16:00 | 1.868789 |
| PLD | qualified | FIGI | 126.95 | 16:03 | 2.246562 |
| PLTR | qualified | FIGI | 200.5 | 16:44 | 3.217592 |
| PM | qualified | FIGI | 199.84 | 16:05 | 2.456843 |
| PPG | qualified | FIGI | 107.8 | 16:39 | 2.066466 |
| PPL | qualified | FIGI | 34.49 | 16:37 | 1.530908 |
| PSA | qualified | FIGI | 295.4 | 16:03 | 1.862324 |
| PSX | qualified | FIGI | 289.06 | 16:03 | 3.047323 |
| PWR | qualified | FIGI | 642.22 | 16:00 | 4.363067 |
| QCOM | qualified | FIGI | 178.4 | 16:41 | 3.726778 |
| RKLB | qualified | FIGI | 55.25 | 16:44 | 7.786425 |
| ROST | qualified | FIGI | 234.83 | 16:21 | 2.285848 |
| RTX | qualified | FIGI | 186.915 | 16:13 | 1.756134 |
| SBAC | qualified | FIGI | 183.72 | 16:41 | 3.161643 |
| SBUX | qualified | FIGI | 96.88 | 16:41 | 2.581249 |
| SCHW | qualified | FIGI | 94.21 | 16:41 | 2.082322 |
| SHOP | qualified | ISIN | 178.14 | 16:39 | 4.047820 |
| SHW | qualified | FIGI | 336.98 | 16:21 | 2.363215 |
| SLB | qualified | ISIN | 48.37 | 16:19 | 2.963761 |
| SNOW | qualified | FIGI | 335.07 | 16:41 | 4.415495 |
| SO | qualified | FIGI | 89.18 | 16:38 | 1.593887 |
| SPG | qualified | FIGI | 203.27 | 16:03 | 1.578600 |
| SPGI | qualified | FIGI | 424.89 | 16:41 | 1.942549 |
| SRE | qualified | FIGI | 81.91 | 16:03 | 1.622465 |
| STZ | qualified | FIGI | 129.61 | 16:00 | 2.561021 |
| SYK | qualified | FIGI | 293.32 | 16:02 | 2.592140 |
| SYY | qualified | FIGI | 82.14 | 16:00 | 1.618518 |
| T | qualified | FIGI | 23.51 | 16:41 | 2.699255 |
| TJX | qualified | FIGI | 144.585 | 16:41 | 1.990001 |
| TMO | qualified | FIGI | 696.59 | 16:41 | 2.919230 |
| TMUS | qualified | FIGI | 157.03 | 16:23 | 3.351953 |
| TRGP | qualified | FIGI | 282.56 | 16:03 | 2.601057 |
| TSLA | qualified | FIGI | 362.44 | 16:44 | 2.880083 |
| TSN | qualified | FIGI | 54.02 | 16:10 | 1.701121 |
| TTWO | qualified | FIGI | 209.38 | 16:41 | 3.022188 |
| TXN | qualified | FIGI | 279.12 | 16:41 | 2.905304 |
| UDR | qualified | FIGI | 34.205 | 16:00 | 1.772665 |
| UNH | qualified | FIGI | 406.66 | 16:43 | 2.932704 |
| UNP | qualified | FIGI | 288.705 | 16:03 | 1.420481 |
| UPS | qualified | FIGI | 97.84 | 16:41 | 1.685139 |
| USB | qualified | FIGI | 57.385 | 16:29 | 1.841070 |
| V | qualified | FIGI | 399.71 | 16:41 | 1.779684 |
| VICI | qualified | FIGI | 23.46 | 16:23 | 1.662100 |
| VLO | qualified | FIGI | 444.04 | 16:41 | 3.707671 |
| VMC | qualified | FIGI | 252.35 | 16:41 | 2.504245 |
| VRTX | qualified | FIGI | 508.75 | 16:03 | 2.469077 |
| VTR | qualified | FIGI | 84.86 | 16:02 | 2.188918 |
| VZ | qualified | FIGI | 44.415 | 16:41 | 2.536739 |
| WBA | refused: catalog_unavailable | — | — | — | — |
| WBD | refused: catalog_unavailable | — | — | — | — |
| WEC | qualified | FIGI | 106.04 | 16:00 | 1.652341 |
| WELL | qualified | FIGI | 234.68 | 16:04 | 2.022942 |
| WFC | qualified | FIGI | 82.76 | 16:30 | 2.392749 |
| WM | qualified | FIGI | 224.27 | 16:37 | 1.687026 |
| WMB | qualified | FIGI | 69.24 | 16:18 | 2.796467 |
| WMT | qualified | FIGI | 117.87 | 16:43 | 2.182792 |
| WY | qualified | FIGI | 19.38 | 16:03 | 2.668030 |
| XEL | qualified | FIGI | 75.12 | 16:03 | 1.647840 |
| XOM | qualified | FIGI | 174.65 | 16:41 | 1.950914 |
| YUM | qualified | FIGI | 150.865 | 16:41 | 1.766890 |
| ZS | qualified | FIGI | 220.43 | 16:00 | 4.373303 |
