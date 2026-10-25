# BaggerBomb measured thresholds — broad release build report (BR-1 to BR-4)

October 25, 2026. Fable (Claude.ai) wrote the prompt and Flash blessed the rulings; Claude Code (Opus 5.5) built it.

**For Flash, in five lines**

1. **Pilot health is good.** There were 6 measured battles. The 4 that finished settled with verified scores and replayed inputs, and Friday's 2 settle on Monday morning. Nothing is stuck, no score was written as 0 for "unavailable", and no lock was left behind.
2. **When a battle can start and when it plays.** A battle can start at any time except 4:00–4:15 PM ET (1:00–1:15 PM on early-close days). Before 3:15 PM ET it plays that day. From 3:15 PM ET (12:15 PM on early closes), in the evening and at weekends it plays the next trading day, and a crypto roster runs to 8 PM ET that day.
3. **The stock list.** The 11 dead tickers can no longer be picked; 228 stocks remain and none were added. Old battles that hold them are untouched. Switching on waits until Monday's rankings refresh drops them, and the switch script enforces that.
4. **Data cost.** A battle uses about 174 EODHD calls (144 to start, 12 per stock swap). At 24 battles a day that is about 4,200 calls, roughly 4% of the 100K daily cap.
5. **Three things to know when you switch on** (§5): an agent whose equipped watchlist holds an ETF (KRE today, 5 agents) is refused whenever it picks it; a battle started 3:15–3:44 PM ET also plays that day's last checks; and an agent can't start its next battle until its last measured one settles, at 9 AM ET the next weekday (8 AM from Nov 1).

## Verdict

| Item | Status | Evidence |
| --- | --- | --- |
| Pilot health (step 1) | **PASS.** None of the STOP conditions occurred. | §1 |
| BR-2: late-day starts play the next trading day | **BUILT.** Fence contact as approved: one branch line in `createAgentBattle` and a private helper. Tournaments are unchanged. | §2.1 |
| BR-3: the 11 dead tickers retired | **BUILT.** The labels are kept for existing data. Wire generation v24. | §2.2 |
| BR-4: `{ mode: 'all' }` and `enable --all` | **BUILT.** `enable --all --apply` also refuses while the rankings still list a retired ticker. | §2.3 |
| Hashed v2 policy | **Unchanged.** No hashed field had to change; the reading is recorded in the approval document. | §2.3 |
| Approval record and runbook | **UPDATED.** BR-1 to BR-4, Flash's time, and BR-2 superseding Ruling 2 and P2. | §2.4 |
| Full Linux suite at the code-final head | **PASS.** Test Files 1172 passed, 8 skipped (1180); Tests 25362 passed, 89 skipped; EXIT=0 (`6e60e76a`, quiet run) | §3 |
| `lint:gate` / `vite build` | **PASS.** EXIT=0 / EXIT=0 at `6e60e76a` (also at `36f4bf86` and `527113ba`) | §3 |
| Review (BUILD_RULES §2) | **Done.** 3 lenses on isolated snapshots, then an independent refuter on every finding: 10 CONFIRMED, 2 PARTLY, 1 REFUTED. 51 mutant runs: every non-equivalent mutant was killed except one NIT. | §4 |
| Switch-on (step 3) | **NOT DONE.** It runs when you say "deployed", once the rankings refresh has dropped the 11 (the script enforces that). | §6 |

## Preamble

- **Branch:** `claude/baggerbomb-thresholds-broad-release-9b1474`, cut from `main` `27514b1a`.
- **State:** the tree was clean at the start.
- **First step:** `git fetch origin`, at 14:29:22 America/Chicago (`2026-10-25T19:29:22Z`).
- **Main did not move:** I fetched again before the final checks, and `origin/main` was still `27514b1a`. So the tested tree is the merged tree.
- **Commits:**
  - `024a6e9f` — the build
  - `36f4bf86` — Wire baseline (regenerated on Linux) and the docs
  - `527113ba` — review fixes
  - `6e60e76a` — refuter fixes; this is the **code-final head**
  - a docs-only commit adds this report
- **Production access:** Admin SDK document reads only, in step 1 and for two follow-up checks (the rankings document and the watchlists). There were no writes.
- **Owner labels:** the founder and FT_QA uids come from the git-ignored Oct 9 raw dump. They were never printed or committed.
- **Credentials:** `.env.local` was copied into the worktree, where it is git-ignored, so the scripts could reach Firestore.
- **Line citations:** at `6e60e76a` unless stated. VERIFIED means I read the line in this session.

## 1. Pilot health (production, read-only)

Read on Sun Oct 25, 2026, about 19:40Z, with Admin SDK document reads only. No writes and no provider calls. The owner labels come from the uids in the Oct 9 week-1 raw dump (`Documents/FantasyTrades/reads-raw-archive`), which were never printed.

**Battles carrying `scoring.stockThresholdModel`.** I scanned the 30 battles created since Oct 15 00:00Z, and 6 carry the stamp. Ids are cut to 5 characters, and all times are ET.

| Battle | Owner | Created | Expires | Status | Completion | Swaps | Ticks with an unavailable frame |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vrLxf | founder | Mon Oct 19 12:51 | Mon Oct 19 20:00 | completed Oct 20 09:00 | result: agent 21 vs CPU 40 (loss) | 3 | 0 of 12 |
| 1TX5f | FT_QA | Tue Oct 20 14:51 | Tue Oct 20 20:00 | completed Oct 21 09:00 | result: agent −2 vs CPU −9 (win) | 0 | 0 of 4 |
| KKrp7 | founder | Wed Oct 21 12:38 | Wed Oct 21 20:00 | completed Oct 22 09:00 | result: agent −58 vs CPU 16 (loss) | 3 | 0 of 13 |
| LcDdW | founder | Thu Oct 22 09:19 | Thu Oct 22 20:00 | completed Oct 23 09:00 | result: agent 173 vs CPU 191 (loss) | 4 | 1 of 26 |
| ny4mm | founder | Fri Oct 23 10:44 | Fri Oct 23 20:00 | active (settles Mon Oct 26, first run) | — (now 31 vs 98) | 3 | 1 of 21 |
| 5abyF | FT_QA | Fri Oct 23 11:17 | Fri Oct 23 20:00 | active (settles Mon Oct 26, first run) | — (now 53 vs −35) | 2 | 0 of 18 |

- **Completion context.** All four completed battles settled with a result: their latest stored frame was valid and their inputs replayed, through `completeBattle` (`api/cron/agent-evaluate.js:6906`, Ruling 4 decision at `:6922`). None ended "result unavailable". The battle documents have no `result` field; win or loss is read from the final committed `currentScore` against `opponentScore`. Every completed battle also carries a `reflectionOutcome`, evidence that the normal completion side effects ran.
- **Ticks.** Counted from each battle's `ticks` subcollection: a tick whose `scores.stockModel.evidence` is not `valid`. Every tick had a committed frame row.
- **Rosters.** Every battle holds 7 positions a side, 6 stocks and 1 crypto, so 12 stocks per battle. All 15 swaps brought a stock in.

**Verify script.** `scripts/stock-threshold-pilot-verify.mjs` ran on each completed battle (vrLxf, 1TX5f, KKrp7, LcDdW). All four report committed scores valid, inputs replay `ok`, and both sides **AGREES**. There were no disagreements and no replay failures.

**Counts.**

| Check | Count |
| --- | --- |
| Battles still active past expiry plus one weekday | **0**. ny4mm and 5abyF expired Friday 20:00 ET. They settle at Monday's first evaluation run (about 09:00 ET), inside expiry plus one weekday, because the evaluation cron runs only on weekdays. |
| A score written as 0 on an unavailable frame | **0**, across the battle documents, their daily records and every tick row |
| `cronState.evaluatingAt` left unreleased | **0** |

**Result: no stuck battle, no replay or verify disagreement, no 0 for "unavailable". The build proceeded.**

**EODHD cost (the measured model's extra calls).** EODHD bills a fundamentals call as 10 and an eod or real-time call as 1. The collector makes those three GETs per stock (`api/_utils/stockThresholdMeasurementProvider.js`).

| Item | Calls |
| --- | --- |
| Per measured creation: 12 stocks × (eod 1 + fundamentals 10 + real-time 1) | **144** |
| Per corrected stock swap: one collector run for the incoming stock | **12** |
| Pilot average: 15 swaps over 6 battles, all stock-in | **2.5 swaps** = 30 calls per battle |
| Per battle | 174 |
| **Projected daily total at 24 BaggerBomb battles a day** | **≈ 4,176 calls, about 4.2% of the 100K daily cap** |

A refused creation that gets past the window checks still spends its GETs. Examples are a provider failure on the 12th stock, or the commit-time ranked-membership check. The projection excludes such retries.

## 2. What the build changes

### 2.1 BR-2 — late-day starts play the next trading day

**The rule** is `tieredFullDayTarget(atMs, hasCrypto)` (`src/utils/stockAdmissionWindow.js:66`). VERIFIED.
- It finds the creation instant's ET date (Intl) and that date's session (`getSessionForDate`).
- On a trading day before `closeMs − 45 min`, the battle plays that session. Otherwise it plays the next trading session, found by walking the calendar's tables.
- The expiry is that session's close. A crypto roster instead gets the 20:00 ET Night Game close, unless that session closes early (`NIGHT_GAME_CLOSE`, `:22`; the old `getNextMarketClose` rule).
- `effectiveCloseHour` is read back from the expiry instant through Intl. So `expiresAt`, `timing.tradingDays = [targetDateStr]` and `timing.localClose = 'HH:00'` all come from one instant.
- No process time zone is involved: no `getETDate`, `setHours` or `getHours`.
- `LATE_DAY_START_MINUTES = 45` (`:26`) is a code constant, recorded and not hashed.
- `SESSIONS` (`:38`) caches each date's frozen session once per process. The calendar's tables are constants, so this changes nothing but repeated Intl work.
- `src/utils/marketCalendar.js` is not touched: its source SHA is pinned by the hashed policy.

**The fence splice (approved contact),** `api/_utils/agentBattleService.js`. VERIFIED.
- `:34` imports the rule.
- `:128`: `gameMode === TIERED_GAME_MODE ? tieredFullDay(portfolio, Date.parse(now)) : computeFullDayExpiry(portfolio)`. The tiered path reads the same instant as `createdAt`.
- `tieredFullDay` (`:420`) throws a retriable `StockThresholdRefusal(<status>)` (`:422`) when the calendar cannot place the creation. In practice that is `calendar_missing`, from Fri 2027-12-31 15:15 ET, because the next session is in 2028.
- `computeFullDayExpiry` (`:434`) is byte-identical to `main` and still serves tournaments.
- **Fenced functions edited:** `createAgentBattle`, one line, plus the new private helper beside it.
- **Called, not edited:** `computeFullDayExpiry`, `hasCryptoInPortfolio`, `commitBattleDocWithPin`. No other fenced file is touched.

**The refusals are gone.**
- `prepareStockCreation` (`api/_utils/stockThresholdAdmission.js:47`) no longer runs a late-start or evening-window check.
- `lateStartRefusal`, `STOCK_LATE_START_CUTOFF_MINUTES`, `eveningWindowRefusal` and `stockAdmissionRetryAt` are deleted. No code importer remains.
- Its unused `now` option was dropped. Ten test call sites still pass it, harmlessly (recorded, BRC-4g).

**The publication wait stays** in the collector, unchanged (`api/_utils/stockThresholdMeasurementProvider.js:37`).
- The player line is "Measured battles open again at 4:15 PM ET." (1:15 PM ET on early closes), from `stockAdmissionLine` (`src/services/agentDeploy.js:56`).
- The time comes from `stockPublicationOpensAt` (`stockAdmissionWindow.js:81`), read off the browser's clock. On a day that is not a trading day the old plain line is shown.
- `calendar_missing` has its own line (`agentDeploy.js:54`), because no retry helps until the 2028 tables land.
- The two retired reasons fall back to the generic line.
- I added the final period to Fable's quoted line, to match the neighbouring lines.

**Legacy creations follow the same rule.** The splice comes before selection. So the evening 0–0 draws end: a legacy crypto battle created 16:15–20:00 ET used to expire unplayed at 20:00, and it now plays the next session.

### 2.2 BR-3 — the 11 dead tickers

**The universe shrinks.** `STOCK_UNIVERSE` loses AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA and WBD (`api/_utils/rankingConfig.js`). `ALL_TICKERS` (`:379`) goes from 239 to 228. No successors were added.

**Labels stay.** `RETIRED_STOCKS` (`:98`) keeps each ticker's last sector. The loop at `:479` writes it into `TICKER_TO_SECTOR`, `TICKER_TO_TYPE` and `TICKER_TO_INDUSTRY`.
- Every consumer that labels or validates existing data reads those maps. VERIFIED: Film Room `tapeAssemble.js:1177` and `candleInputs.js:85`, `wireValidator.js:70`, `injectionGuard.js:86`, `tickerValidation.js`.
- Battles, tapes, watchlists and Wire documents that hold one of the 11 therefore read exactly as before.
- Removing the names from the label maps as well would have nulled the stored sector on the next tape re-merge and re-queued or expired those tapes (survey of `tapeMerge.js:520`, `:654`). That is why the removal and the labels are split.

**Every consumer was listed and sorted** (survey of 47 files):
- **(A) Build the fetched or pickable set** (the intended change): `compute-index-intelligence` (the `stockRankings` builder, `:891`, `:899`), `compute-rankings`, `compute-estimates`, `compute-institutional-intelligence`, `intraday/universe.js` and the Forge add search.
- **(B) Label or validate:** the consumers listed above. They are unchanged because the labels stay.
- **(C) One-off scripts:** noted only.
- **Lists that stay unchanged** (the player modes keep their contract): `src/constants/sectors.js`, `src/App.jsx` and the earnings priority lists. This is a deliberate drift from the "keep in sync" comment, now recorded in `rankingConfig.js`.

**New picks are refused.**
- `validateTickers` (`api/_utils/tickerValidation.js:31`) returns the 11 as unsupported. This covers the watchlist dialogue's `propose` and parse-signal.
- The Forge manual-add search (`src/components/Forge/Watchlist/tickerSearchMatch.js:18`) no longer offers them.
- The watchlist save endpoints check shape only (BRB-2). No committed production watchlist held one on Oct 25 (read-only check), and a measured creation refuses all 11 (`catalog_unavailable`).

**Wire lock.** The `ALL_TICKERS` value lock moved, so `WIRE_GENERATION_VERSION` goes 23 → 24 (`api/_utils/wireContracts.js:195`, with a history note). I regenerated the baseline on an LF Linux checkout; a CRLF Windows tree hashes differently.
- Exactly four entries moved: the version, the aggregate hash, `wireContracts.js` and `value:…#ALL_TICKERS`.
- `TICKER_TO_SECTOR`'s hash is unchanged (`1875fff2…`; keys are sorted before hashing). So the Wire universe and `WIRE_VALIDATOR_VERSION` do not move, and the caveat guard does not fire.

**Count pins:**
- `rankingConfig.test.js`: `ALL_TICKERS` 239 → 228 (V-1, V-11). V-9 and V-15 stay at 278 because the labels are kept.
- `intraday/universe.test.js`: 255 → 244. The intraday sweep stops polling the 11; held and bench names are still polled.

**The pools.**
- **CPU:** the CPU opponent draws only from `indexIntelligence/stockRankings` (`decide.js:366`, `cpuOpponentGenerator.js`). That document is rebuilt from `ALL_TICKERS` alone and fully replaced on each run (`compute-index-intelligence.js:1524`).
- **Agent, ranked pool:** the same document.
- **Agent, equipped watchlist:** a watchlist that already holds a ticker can still offer it to the agent (`watchlistEquip.js` `foldEquippedTickers`, "Option 8C"). See above for why none can arrive now.
- **Production state:** on Oct 25 the rankings document still lists 7 of the 11 (AVB, CTRA, EA, EQR, MMC, PARA, WBD). They leave at the next weekday run (Mon 10:30 UTC). Until then a measured creation that draws one is refused retriably. `enable --all --apply` refuses to run in that state (§2.3).

### 2.3 BR-4 — the switch

**Registry** (`api/_utils/stockThresholdPolicyRegistry.js`):
- `isAllAudience` (`:20`) accepts a plain object with exactly one key, `mode: 'all'`.
- `validStockAdmissionControl` (`:25`) opens on that audience or on a valid allowlist.
- `stockAdmissionSelects` (`:31`) selects every owner under `all`, but still needs a non-empty string owner id.
- These stay closed (legacy): disabled, old schema, an `all` carrying `ownerIds` or any other key, `'ALL'`, `'everyone'`, an array.
- Tournaments never reach the control read: the scope check comes first (`stockThresholdAdmission.js:49`).
- A switch between allowlist and `all` mid-flight is refused at commit by the whole-document re-read, which is now tested.

**Control script** (`scripts/stock-threshold-pilot-control.mjs`):
- `enable --all` builds `{ mode: 'all' }`. `--all` and `--owner` are exclusive (`parseArgs`, `:51`).
- `disable` keeps an `all` audience (`:83`) rather than rewriting it as an empty allowlist.
- `describeControl` (`:91`) says "enabled for every owner".
- `enable --all` reads `indexIntelligence/stockRankings` (`:108`, `rankingsBlocker` `:41`). `--apply` refuses, before anything is announced or written, while the document is missing or empty or lists a retired ticker; the dry run says why. The pilot form and `disable` never read it.

**Hashed policy: no field had to change, so the v2 model and hashes stay.**
- The hashed `rollout` entries say activation is the allowlist pilot, only allowlist mode selects, and `broadRelease: later_code_change_and_owner_decision`.
- BR-4 is exactly that later code change and owner decision, and no code reads `rollout`. The approval record carries the superseding reading, as it carried P2's narrowing of `offHoursCreation`.
- `offHoursCreation` itself is unchanged by BR-2.
- Re-versioning to v3 would have needed a registry holding two models, to keep the two live v2 pilot battles settling.

**`STOCK_APPROVAL` text.** Its unhashed text moves: `version` 2, `decision`, and `activationScope: 'control_document_audience_allowlist_or_all'` (`:11`). Only new input documents carry it. Replay compares `collectorId` and the model tuple, never these fields (`readCorrectedInputs`, `stockThresholdAdmission.js:197`, `:209`), so the live pilot battles still settle (refuter-verified).

**The flag** stays `true`, so no flag pin moves. Its docstring now names the `all` audience.

### 2.4 Approval record and runbook

**`docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md`:**
- the BR-1 to BR-4 text;
- the receipt time (`2026-10-25T19:29:22Z`, recorded as the best evidence, as with Rulings 6–16);
- "BR-2 supersedes Ruling 2 and P2", marked at both;
- the hashed-policy reading;
- build readings: rest-of-day play, the stale rankings, equipped off-list tickers, and the calendar horizon.

**`docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_ADMISSION_RUNBOOK_V1_20261013.md`:** rewritten for the broad release:
- the `all` schema;
- the accurate refusal list;
- the start and play table;
- the retired tickers;
- "Switching on for everyone": `show`, the `enable --all` dry run, `--apply`, `show`, with the rankings precondition;
- rollback (`disable --apply`, which keeps the audience; BR-2 and BR-3 are code and are not rolled back by the switch).

**The policy JSON:** only its unhashed `unhashedCodeConstants` changed, to name `LATE_DAY_START_MINUTES`. The policy hash is unchanged.

## 3. Tests and checks

**New file: `api/_utils/stockThresholdBroadRelease.test.js`** (32 rows). It deliberately carries **no** time-zone pin.

*BR-2 rows through the real `createAgentBattle`:*
- creations at 15:14, 15:15, 15:59, 16:00, 16:05, 16:14, 16:15, 19:59 and 20:00 ET, for crypto and stock-only rosters, asserting `expiresAt`, `tradingDays` and `localClose`. The days are:
  - a regular day (Wed Oct 21, 2026);
  - an early close (Fri Nov 27, 2026, cutoff 12:15);
  - a Friday (Oct 23);
  - two holiday eves (Nov 25, whose next session is the Nov 27 early close, and Dec 31, 2026 → Jan 4, 2027);
  - four DST Fridays (Mar 6 and Oct 30, 2026; Mar 12 and Nov 5, 2027);
- the cutoff ±1 ms, including Dec 24;
- both DST Sundays (including both passes of 01:30 on Nov 1);
- by-construction agreement of the three fields;
- the 2027-12-31 horizon refusal, before any write;
- tournament identity: at 9 instants, including the late window, a tournament document equals the old rule's output in the same zone, makes zero control reads and is identical with and without an `all` control;
- five measured creations under an `all` control, end to end through the real collector;
- the publication wait;
- the retired refusals no longer exist;
- legacy evening creations now play the next session;
- `all` selects every tiered owner and never a tournament.

*Sweeps, every 15 minutes from Oct 25, 2026 through Dec 31, 2027:*
- **Rule sweep.** Outside the late-day window, the tiered target equals the old rule's date and close hour in any zone. Inside it, the next session. **Every target is scorable**, meaning at least one evaluating quarter-hour tick falls inside a session before expiry. The 35 horizon instants are refused.
- **UTC row.** It switches the process to UTC and shows the old conversion gives the same instant outside the window.
- **Kolkata row.** It shows the ET date governs, not the local one.
- **Measured sweep.** A measured creation is refused only at each session's close quarter-hour (the publication wait) and at the horizon. The player line's time is the first instant the collector accepts again.

*BR-3 rows:* universe membership and per-sector counts; labels kept and the Wire universe hash unchanged; the validator and the search refuse; the rankings cron fetches `ALL_TICKERS` only, and the CPU never draws a retired name from a rebuilt pool (300 draws); the collector refuses all 11 before any GET.

**Edited files:**
- `stockThresholdV2.test.js`: Ruling 2 and P2 rows retired; Ruling 6 closed list updated (exact `all` opens; `all` with ids or extra keys, `ALL`, `everyone`, array or disabled stay closed); mid-flight allowlist → all refused.
- `scripts/stock-threshold-pilot.test.js`: `--all` parsing, document, run, disable keeping `all`, and the rankings guard.
- `agentDeploy.stockAdmission.test.js` and `agentDeploy.outcomes.test.js`: the 4:15 / 1:15 line under a pinned clock, DST Mondays, the plain fallback, retired reasons and `calendar_missing`.
- `rankingConfig.test.js` and `intraday/universe.test.js`: count pins, each with its reason.
- `tickerValidation.test.js` and `tickerSearchMatch.test.js`: retired refusal.

**Zones.** The new file passed 31/31 (before the Kolkata row was added) under UTC and America/Chicago here, the Kolkata row was then run under America/Chicago and UTC, and the reviewer also ran it under Pacific/Chatham and Asia/Kolkata.

**Runs:**

| Run | Head | Result |
| --- | --- | --- |
| Full Linux suite (WSL Ubuntu, Node 20.20.2, `CI=true TZ=UTC --maxWorkers=8`, exit code asserted) | `36f4bf86` | Test Files 1172 passed, 8 skipped (1180); Tests 25358 passed, 89 skipped; **EXIT=0**; 325 s |
| Full Linux suite, same shape, while a Windows-side refuter was also running tests | `527113ba` | 2 failed rows, both 5 s timeouts on files this build does not touch: `film-tape-backfill.e2e` "next candle morning…" (5,078 ms; 3,162 ms in the green run) and `leagueRawIds.guard` "every League seat surface…" (6,161 ms; 3,764 ms). Run alone at the same head, both pass (2,562 ms and 1,712 ms). Load, not this build. |
| **Full Linux suite, quiet, the record** | **`6e60e76a`** | Test Files 1172 passed, 8 skipped (1180); Tests 25362 passed, 89 skipped (25451); **EXIT=0**; 321 s. The new file: 32 tests, 141 s. |
| `lint:gate` | `36f4bf86`, `527113ba`, `6e60e76a` | EXIT=0 at all three |
| `vite build` | `36f4bf86`, `527113ba`, `6e60e76a` | EXIT=0 at all three |

## 4. Review (BUILD_RULES §2: 23+ files, about 1,000 lines)

**Method.**
- **Isolation.** Each lens worked in its own `git archive` LF snapshot with a `node_modules` junction, read-only on git and on the build worktree. Every mutant was restored by sha256.
- **Lens A, the BR-2 refuter.** It ran a literal-instant probe in six exotic zones and 147,288 (instant, roster) pairs against the base `computeFullDayExpiry` under UTC, with zero differences outside the window.
- **Lens B:** BR-3 and BR-4 correctness and wiring.
- **Lens C:** player line, docs against code, pins, cross-arc effects, and a real-clock time-bomb scan of 36 files at five instants.
- **Independent refuter.** Every finding then went to a refuter told to refute it with a repro.

| Id | Finding | Refuter verdict | Disposition |
| --- | --- | --- | --- |
| BRA-1 | A battle created 15:15–15:44 ET plays that day's 15:30/15:45 checks. Its night-D `day1` record, swaps and badges appear on no Film Room tape. On the **legacy route only**, the night reset clears a day-1 swap's entry price (`agent-daily-scores.js:158-172`), so on D+1 that position scores from the creation quote, or 0 for a hot-bench swap (`agent-evaluate.js:1201`; verified by reading). | CONFIRMED (understated on legacy) | **Question for Flash (Q2).** Measured battles skip that reset. Under `all` the legacy route applies only before the switch or after a rollback. |
| BRA-2 | At the horizon a legacy player saw "try again in a minute", and a comment claimed only selected creations can be refused. | CONFIRMED | Fixed: `calendar_missing` line, comment corrected |
| BRA-3 | The day rows took the cutoff from the imported constant, so a 45 → 46 mutant survived them (other rows killed it). | PARTLY | Fixed: literal 45; MR1 killed |
| BRA-4 | A local-date mutant survives under UTC and Chicago. | CONFIRMED | Fixed: Asia/Kolkata row; MR2 killed even when launched under UTC |
| BRB-1 | Under `all`, an equipped watchlist ticker off the ranked list (ETF KRE: 5 agents on Oct 25) refuses the measured creation whenever the agent places it, after the model calls. | CONFIRMED | **Question for Flash (Q1)** before switch-on |
| BRB-2 | Retired tickers can still reach the agent through an equipped watchlist: save endpoints check shape only, and docs overclaimed. | CONFIRMED | Docs and comments corrected. No list holds one, new adds are refused in the UI and validator, and a measured creation refuses them. Residual: a crafted save request. Optional follow-up below. |
| BRB-3 | The rankings precondition was prose only. | CONFIRMED | Fixed: `enable --all --apply` refuses (missing, empty or stale list), with no "WRITING" line before refusing; MR5–MR7 killed |
| BRB-H | Under `all`, an unsettled measured battle also holds back that agent's **tournament** deploy (`decide.js:1351`). | CONFIRMED, narrower | Recorded. With casual-clone concurrency on, Command Center battles run on the clone's id. The orchestrator retries every 10 min, and settlement (13:00 UTC) lands 30–90 min before the open. |
| BRC-1 | The dashboard pod-conflict warning uses today's close, wrong from 15:15 ET. | **REFUTED** as a production defect | It renders only when `CASUAL_CLONE_CONCURRENCY_ENABLED` is off (`featureFlags.js:237` ships true; `CommandDashboard.jsx:607`). It is latent if that flag is ever rolled back. Recorded. |
| BRC-2 | Film Room tapes skip a late-day battle's creation-day ticks. | CONFIRMED | Part of Q2 |
| BRC-3 | From 2027-12-31 20:15Z real-clock tests that create a tiered battle go red (14 rows in 3 files, reproduced). | CONFIRMED | Recorded. The fix is the 2028 calendar tables (TODO in `marketCalendar.js:13`). |
| BRC-4 | Docs and comments: (a) stale Ruling 2 constant; (b) incomplete refusal list; (c) settlement 09:00 is 08:00 ET in winter; (d) `rollout.activation` omitted; (e) a stale header; (f) a stale fenced comment (`agentBattleService.js:351-354`); (g) inert `now:` arguments in tests. | CONFIRMED | (a)–(e) fixed; (f) recorded, outside the approved contact; (g) recorded |
| BRC-5 | A past opening time if the browser clock is beyond close + 15; the hub row shows only "ends 8:00 PM ET" (the hours-left figure implies the next day). | PARTLY | Recorded (NIT) |

**Mutation.**

| Lens | Runs | Killed | Equivalent survivors | Other survivors |
| --- | --- | --- | --- | --- |
| A | 21 | 18 | 3 (M17u, M18u, M18c) | — |
| B | 12 | 12 | — | Two survived their own unit files and were caught by the combined BR-3 row; unit rows added since (MR3, MR4 killed) |
| C | 7 | 5 | 1 | 1 (a past opening-time line, BRC-5, NIT) |
| Coordinator re-check of review rows | 8 | 8 | — | — |
| Refuter | 3 | 3 | — | — |

- Lens A's M9 (the old zone-dependent function used for tiered) is killed under America/Chicago by 18 rows, including the DST Sundays row.
- Every restore was sha256-verified.

**Checked clean:**
- the tiered target at every literal instant and zone tried;
- `expiresAt` / `tradingDays` / `localClose` agreement;
- no allowed-but-unscorable creation through 2027-12-31;
- tournament `computeFullDayExpiry` byte-identical;
- no code reference to the removed refusals;
- the registry against odd inputs;
- no control read for tournaments;
- the mid-flight refusal;
- the live pilot battles' replay unaffected by the `STOCK_APPROVAL` text;
- an honest Wire regeneration;
- Film Room, Wire validator and injection guard unchanged for the 11;
- no 15:15–24:00 real-clock time bomb in 36 files at 5 instants.

## 5. Questions for Flash

None of these is a data-integrity problem, and switching on shrinks Q2's legacy exposure. Saying "deployed" alone runs step 3. Say "wait" instead if you want a Q1 or Q2 change first.

**Q1 — Equipped ETFs.** decide.js lets an agent place a ticker from its equipped watchlist even when it is not a ranked stock ("Option 8C"). The measured model cannot measure such a ticker (an ETF fails the Common Stock identity check), so once everyone is measured, that deploy is refused retriably every time the agent picks it, after the model calls ran. Today 5 agents' equipped watchlists hold KRE. Options:
- (a) Accept it, and tell those players.
- (b) Stop folding off-list equipped tickers for tiered battles. That is a decide.js-path change and needs fence authorization.
- (c) Make a battle whose roster holds an unmeasurable equipped ticker play on the old math. That is a non-fenced admission change, but it bends BR-1.
- My lean is (a) for now plus (b) as a follow-up.

**Q2 — The rest of the creation day.** BR-2's battle targets the next session, but nothing holds it back on its creation day. A battle created 15:15–15:44 ET also plays that day's last one or two checks. Those checks and any swaps are scored but appear on no Film Room tape. On the old-math (legacy) route, a swap made in those checks is mis-scored the next day.
- Measured battles are scored correctly either way.
- Options: (a) accept, since everyone is measured once `all` is on; or (b) a follow-up that skips a battle before its first trading day in `api/cron/agent-evaluate.js`. That file is not fenced, but it is a behaviour change Fable should write.
- My lean is (b), soon. Until then, switch on promptly after the deploy so the legacy route sees few late-day starts.

**Q3 — Redeploying the same agent.** An agent whose measured battle expired at 20:00 ET cannot start its next battle until that battle settles, at the next weekday's first run (13:00 UTC: 9:00 AM ET until Oct 30, 8:00 AM ET from Nov 1). Old-math battles were settled on the spot at deploy. So after `all`, a player cannot redeploy the same agent that evening or over the weekend; other agents are unaffected. This is pre-existing pilot behaviour that `all` extends to everyone. Accept, or ask for an evening settlement run?

**Q4 — The 2028 calendar.** From Fri Dec 31, 2027, 3:15 PM ET, every BaggerBomb creation is refused until the 2028 NYSE tables are added (some tests go red from the same instant). Adding them is a small calendar task; I suggest scheduling it for early December 2027.

**Q5 — The hashed policy.** I kept the v2 model and hashes. The hashed `rollout` lines describe the pilot ("allowlist only"), and their own `broadRelease` line says broad release comes by a later code change plus your decision, which this is. Nothing reads them. The approval record carries the superseding reading. Is that acceptable, or do you want a v3 re-hash (bigger: the registry must keep v2 for the live battles)?

## 6. What happens next

1. **Merge the PR.** When Vercel shows it deployed, come back to this session and say "deployed".
2. **Then (step 3, the one authorized production write):**
   - I confirm production is at or after the merge commit.
   - I check that `indexIntelligence/stockRankings` no longer lists any of the 11. The script also refuses otherwise. The first weekday rebuild after the deploy is Mon 10:30 UTC.
   - I run `show`, then `enable --all` (dry run, showing the document), then `--apply`, then `show`.
3. **"deployed" alone is enough** to run step 3, with the rankings check still enforced. Say "wait" if you want the (b) follow-up for Q1 or Q2 first.

## 7. Reported, not changed

- **Two stale comments:** the fenced `agentBattleService.js:351-354` ("allowlist names this owner"), and `src/constants/leagueTournament.js:752` ("expires at the next market close"; dormant, see BRC-1).
- **Inert test arguments:** the `now:` option passed to `prepareStockCreation` in 10 test call sites.
- **Pre-existing allowlist looseness:** an allowlist audience with extra keys still opens.
- **`compute-rankings`** still appends price-history closes for retired symbols but never ranks them.
- **The tournament settlement gate's timing margin** (BRB-H).
- **Optional BR-3 hardening:** refuse new retired tickers at the watchlist save endpoints (compare against the stored list so existing lists still read). That closes the crafted-request path.
- **Windows-only test noise,** not this build: `archetypeRegistry` ratchet backslash paths, and the `fantasyTimesConsensus.n4` path-separator row. Linux is green.
