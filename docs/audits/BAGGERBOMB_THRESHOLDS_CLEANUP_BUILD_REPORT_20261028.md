# BaggerBomb measured thresholds — cleanup after the broad release: build report (Oct 28, 2026)

**For Flash, in plain words:**
- **Health read:** measured thresholds are on for 2 allowlisted owners only; `enable --all` has not been run. The evening settlement run fires and sweeps cleanly (Oct 28, 02:00:34 UTC: `0 completed, 0 still active`), but it has not met a real battle yet: no tiered battle was created since Oct 24, so nothing expired on Oct 27 or Oct 28 and nothing is stuck. Not a STOP.
- **A battle that starts tomorrow:** it no longer reads LIVE. It says "Starts Tue 9:30 AM ET" (the next real session, from the calendar; Mon for a Friday evening, Fri after Thanksgiving) and its end time says "ends Tue 8:00 PM ET". The nightly scoring job skips it the evening it is created, so its real first night records as day 1, and day 1 is scored from the creation price. Most of the new screens are behind flags that are off today (§5); the turn line on the battle screen and the battle card are live now.
- **KRE in the cockpit:** it stays on the watchlist as a watch name. The cockpit never offers it as a fork option and refuses it as a pick; the ranked bench names are still offered.
- **An old dialogue:** a dialogue that still holds a retired ticker now saves without it, and the chat says which names were left out. If every name was retired, the save is refused as an empty list. In the editor, adding a retired name shows "KRE is no longer available. Remove it to save." and no Retry button.
- **Your rulings are in (Oct 28):** the fenced swap executor and the Film Room ghost baseline now follow the first trading day too, one expression each, on this same PR, so C2 and all its mirrors land together (§2). Q1 later, Q2 and Q4 kept as built. Nothing was written to production.

## Verdict

| Item | Result |
|---|---|
| Branch / PR | [PR #999](https://github.com/fashraf94/TradeSeven/pull/999): local branch `claude/baggerbomb-thresholds-cleanup-fbb502` (the app's suffix), pushed as `claude/baggerbomb-thresholds-cleanup`. Base `24495eba` (= `origin/main`, re-fetched before every suite and every push). Code-final `e94e6b76`; the PR head adds the report and the review record only |
| Health read | §0: on for 2 owners; evening run clean, never exercised; no stuck battle; **not a STOP** |
| C1 nightly job skips a battle before its first day | Built; shared module `src/utils/tieredFirstTradingDay.js` |
| C2 day-1 baseline follows the first day | Built in the evaluate gate **and in all four of its mirrors**: `agent-daily-scores.js`, the battle card (`AgentBattleScreen.jsx`), and — under your Oct 28 sanction — the fenced swap executor's Guard 3 (`agentSwapExecution.js:252`) and the Film Room ghost baseline (`tapeAssemble.js:412`) |
| C3 cockpit never offers a pick that can't come in | Built at the mint, the pre-commit capture, and `call_pick` |
| C4 retired tickers dropped from old dialogues | Built; the editor line and the chat toast included |
| C5 honest status before the first day | Built on the adapter, the Desk, the turn line and the hub row |
| C6 loose ends | Built: `dormant` on the run record; three stale comments |
| Tests and checks | Full Linux suite exit 0 at code-final `e94e6b76`: Test Files 1198 passed, 8 skipped (1206); Tests 26,091 passed, 89 skipped (26,180). `lint:gate` exit 0. `vite build` exit 0 (code-final and the pushed head) |
| Review (BUILD_RULES §2: 55 files, 1,931 lines) | 3 lenses + a refuting verifier on 23 findings (19 CONFIRMED, 2 CONFIRMED-AS-QUESTION, 2 REFUTED; no BLOCKER; 16 fixed here), then a second refuting verifier on the sanctioned executor hunk (hunk SOUND; one red CI guard found and fixed; two thin rows closed). 50 builder mutants, 1 survived at first and was closed (§8) |
| Fenced files | **One fenced file edited, under your Oct 28 sanction and limited to what you named: `api/_utils/agentSwapExecution.js`** — an import, a 3-line comment and Guard 3's activation-day expression (`firstTradingDayOf(battle) ?? <the old activatedAt expression>`, :252); 6 insertions, 2 deletions. No other fenced file is in the diff. Fenced functions *called* by the code paths the diff touches: `getCurrentTradingDayServer` (`agentEvalPromptAssembly.js:1376`), `calculateAssetScoreServer` and `flattenPortfolioServer` (`agentScoring.js`). C1 and C2 change what is fed to the scoring concept (when a night counts and which price a day-1 badge reads from), as ruled, not the scoring code |
| Rulings received | Q1 yes, later (when Command Center sync is switched on); Q2 keep the narrow reading; Q3 sanctioned and done; Q4 keep the fork whole (§10). Nothing open |
| Production | Read-only reads only (§0). No writes |

## Preamble

- `git fetch origin` first. Branch `claude/baggerbomb-thresholds-cleanup-fbb502`, HEAD at start `24495eba` = `origin/main`, clean tree. `origin/main` contains #998 (`beforeFirstTradingDay`, `api/cron/agent-evaluate.js:888` at that head). VERIFIED. Re-fetched before the final suite: `origin/main` still `24495eba`.
- Read: `docs/BUILD_RULES.md`; #998's report §6–§8 (and §1–§3 for the F3 and ordering context).
- The app suffixed the local branch (`-fbb502`); the PR head is `claude/baggerbomb-thresholds-cleanup`, pushed by refspec.
- `.env.local` copied into the git-ignored worktree root for the health read (names never printed); removed afterwards.
- **Continuation, Oct 28 (after the first push):** Flash sanctioned fence contact "limited to the one-line activation-day change in agentSwapExecution.js Guard 3 (firstTradingDayOf(battle) ?? activatedAt) and the matching ghostBaseline line in tapeAssemble.js", on this branch, with rows for both, one refuting verifier on the executor hunk, a full re-run, and this report updated. Done in §2, §7, §8 and §10.

## 0. Health read (production, read-only)

Read on 2026-10-28 about 14:17 UTC. Only Firestore `.get()` queries, `stock-threshold-pilot-control.mjs show`, and `vercel logs` / `vercel inspect` reads. No production write. No uid and no full battle id is printed here.

**Is it on, and for whom?** On, for an allowlist of 2 owner ids (not printed). `stockThresholdControl/admission` is schema 2, `enabled: true`, epoch 1, model `stock_measured_atr14_fullday_v2`, audience mode `allowlist`. It is not on for everyone: #995's step 3 (`enable --all`) has not been run and still waits on your word.

**Did the evening settlement run work on its first nights?** It ran clean; it has not yet met a real battle.
- Nothing tiered expired on either night. No `completedAt` falls in 02:00–02:15 UTC on Oct 27 or Oct 28, for any battle type. The only completions between Oct 26 20:00 UTC and Oct 29 06:00 UTC are 8 tournament battles at 20:00 UTC (`tournament_group_scored`).
- No tiered battle was created since Oct 24: all 12 battles created since then are tournaments (8 completed; 4 active, all ending today 20:00 UTC).
- Oct 28 02:00:34 UTC: the production log reads `[AgentEval] [settle] expiry sweep only: 0 completed, 0 still active`, HTTP 200, on deployment `dpl_6AM14…` (created Oct 26 15:01 UTC, before both nights). So the cron fires, authenticates and sweeps.
- Oct 27 02:00 UTC: the run's log line is outside the retention window of `vercel logs` (the call returns 400, also with exact ISO bounds). Firestore shows nothing to settle that night either.
- Stuck past expiry: none. 4 battles are active, none tiered, none past `expiresAt`.
- Reading of the STOP rule: "the settle run did not complete an expired battle" would mean an expired battle existed and was left. None existed, and none is stuck, so this is not a STOP. The first real proof is the first tiered battle that expires at 20:00 ET on a weekday evening.

**Measured battles since the switch-on.** 6 created, Oct 19–23 (the first at 2026-10-19 16:51 UTC); all 6 are completed; none since Oct 23. The last two (created Oct 23 14:44 and 15:17 UTC, expired Fri Oct 24 00:00 UTC) completed Mon Oct 26 13:00 UTC: the Friday-evening gap F1 closed.
**Refused.** Not recorded in Firestore (a refusal is a thrown error, not a document). No refusal line in the production log window `vercel logs` could read (about the last day). So: no refusal seen; the count is not knowable from records.

## 1. C1 — the nightly scoring job skips a battle before its first trading day

- **What changed.** `beforeFirstTradingDay` moved out of the evaluate cron into a pure, Node-clean module both crons import (`src/utils/tieredFirstTradingDay.js:49`; `firstTradingDayOf` :37). It takes the ET date as an argument and reads no clock. `agent-evaluate.js:902` keeps its exported, clock-defaulting `beforeFirstTradingDay` as a one-line wrapper, so the F3 call site and the existing tests are unchanged. No cron imports the other.
- **The gate.** `agent-daily-scores.js:64`: first thing in `resetBattleDaily`, before the corrected-route branch, so a measured battle writes and refuses nothing. It returns `skipped / before_first_trading_day`: nothing banked, recorded or reset. Tiered battles only (`gameMode` absent or `baggerbomb_agent`); a tournament, another mode and a battle with no usable list are never held back.
- **Why the old behaviour was wrong.** `getCurrentTradingDayServer` (fenced, read) answers "day 1" for a date before the list, so the creation evening recorded `day1` and the real first night logged `already_recorded`.
- **Tests.** `agent-daily-scores.firstDay.test.js` (8 rows): created Mon 15:20 ET gets nothing Monday night and records day 1 Tuesday night; created Fri 15:20 ET is skipped Friday night and records Monday night (across the Nov 1 fall-back); a same-day battle is unchanged; a measured battle is held back with no checkpoint and no write, then checkpoints day 1; no usable list is never held back; a tournament's payload equals a no-list control byte for byte. `tieredFirstTradingDay.test.js` (13 rows) holds the predicate, `etDateOf` and the calendar opens. Mutants: see §8.

## 2. C2 — the day-1 badge baseline follows the first trading day

- **What changed.** `agent-evaluate.js:1241`: a tiered battle's activation day is `firstTradingDayOf(battle)`, else the old `activatedAt` expression. On that day the badge baseline is `portfolio.startingPrices`, the price the score runs from. Tournaments and other modes read `activatedAt` exactly as before (the helper is null for them).
- **Two mirrors of the gate, changed with it** (how I read C2; the reason is that each would otherwise disagree with the day's scoring, BUILD_RULES §9):
  - `agent-daily-scores.js:83` — its comment says it "mirrors agent-evaluate". After C1 its first night is day 1; banked against `activatedAt` it would use the previous close while the day was scored from the creation price.
  - `AgentBattleScreen.jsx:283` (`enrichHeldPosition`, found by the review, CL1-1) — the battle card also mirrors the server gate. Probe: creation 100, Monday close 103, Tuesday 99, ATR 2.5: the card showed Bust + Crash (−50) where the server scores −20 with no badges.
- **Tests.** `agent-evaluate.firstDayBaseline.test.js` (10 rows: NVDA and BTC; next-session, same-day, day 2, no list, tournament); `agent-evaluate.stockThresholds.test.js` "C2" row (a measured battle's crypto slot); `AgentBattleScreen.enrichFirstDay.test.jsx` (3 rows); the daily-scores C2 rows. Mutants: see §8.
- **The sanctioned fence contact (Oct 28).** The two remaining mirrors, found by the review (CL1-2), now follow the first trading day:
  - **`api/_utils/agentSwapExecution.js` Guard 3 (FENCED; the only fenced file edited).** The hunk is an import (:15), a 3-line comment and the activation-day expression (:252), `firstTradingDayOf(battle) ?? (battle?.activatedAt ? … : todayET)`. Nothing else in the file changed: the refuting verifier compared git blob hashes of the file with and without the hunk. It is null for tournaments and every other mode, so those are byte-identical (the whole `tx.update` payload compared with `toEqual`, flat6 included); a same-day tiered battle is byte-identical too. What it fixes (verifier probe through the real executor): creation 100, Monday close 103, Tuesday 104, star tier, ATR 2.5 — the live card scored 125 (bagger + doubleBagger) and the swap locked 80; now both are 125. It agrees with the evaluator's gate in 2,000 of 2,000 randomised battles (TZ=UTC and Asia/Tokyo, across the Nov 1 clock change), and the daily-series pre-fetch is correctly skipped on the first day. The only runtime caller is `agent-evaluate.js`, after the dormant gate, so a swap before the first trading day is unreachable.
  - **`api/_utils/filmTape/tapeAssemble.js` `ghostBaseline` (not fenced).** A new optional `firstTradingDay` (:400); `activationDay = firstTradingDay || etDateOf(activatedAt)` (:412); `buildReplayInputs` passes `firstTradingDayOf(battle)` (:434). A swap on a next-session battle's first day now replays its ghost leg from the starting price instead of listing it as missing `ghost.thresholdBaseline`.
  - **Rows.** `agentSwapExecution.firstDay.test.js` (8): next-session equals same-day; the creation price scores (not the old, smaller lock); no daily fetch on the first day; day 2 and a no-list battle fall back; a no-mode document is tiered; other modes and a tournament byte-identical. `tapePure.test.js` (4 `ghostBaseline` / `buildReplayInputs` rows) and `writeTapeDay.test.js` (1 end-to-end row). One existing tape row's fixture was updated: it modelled "deployed the evening before, so the swap day is day 2", which has not been true of a tiered battle since BR-2; it now sets a list whose first day is the day before. `agent-evaluate.test.js`: the repo-level guard on `executeSwapServer` consumers lists the new test file (the verifier found it red).

## 3. C3 — the cockpit never offers a pick that can't come in

- **The rule.** `canComeIn` (`api/_utils/callRecords/swappable.js`) on the swap's own lists. The battle universe holds the equipped snapshot, so KRE was in it and on no swap list.
- **Three sites, one test.**
  - The mint: `candidate.js:391` hands `forkUsableFor({ book, promptBuiltAt })` (`swappable.js:120`) to `validateDeclarations`; `validate.js:184` `checkFork` removes the whole fork, reason **`cannot_come_in`** (a new removal reason, `validate.js:97`; I added it because `outside_universe` would have been inexact in the record), if any option fails. An unknown seam (no book) fails closed, as `counterpartUsable` does.
  - The pre-commit capture: `agent-evaluate.js:3251` passes the same test, so an entry is never stamped `declarationsPhase: 'expected'` for a fork the mint then removes (review CL2-1: the wire would have read `failed`).
  - The filing: `callActions.js:177` — `call_pick` is judged by `canComeIn` after the two book reasons (`pick_already_held`, `swap_out_not_held`, which `retire.js` reads as D-6 book reasons and stay first). A name on no list is `pick_not_on_bench`; the old `pick_outside_universe` is gone.
- **Already sound (verified, not changed):** the bench sheet (`cockpit-bench.js`) and the exit chips (`cockpit2bModel.js:200`) already use `canComeIn`; `call-response.js` uses the universe only as a canonicalization.
- **Tests.** `candidate.test.js` (7 rows: KRE removed, control minted, held / locked / wrong class, instant, frozen book, null book); `validate.test.js` (2); `callActions.test.js` (5 rows incl. KRE refused while in the universe); `call-response.test.js`; `agent-evaluate.tickStamps.callsOn.test.js` (2 tick rows). 7 mutants; one survived at first (the check's instant) and was closed with a row.
- **Residual:** a call minted before this deploy still renders its stored options for the one check it lives; the endpoint refuses an equipped-only name with `pick_not_on_bench`.

## 4. C4 — retired tickers are dropped from old dialogues, not refused

- **Server.** `watchlists.js:521`: `splitRetiredTickers` (`watchlistValidation.js:78`) drops any of the 11 retired names (trimmed, upper-cased, as `newlyAddedRetiredTickers` reads them) from the dialogue's list and saves the rest; the response carries `droppedRetired` (`watchlists.js:640`), absent when nothing was dropped and on idempotent replays. A list left **empty by the drop** is refused as `no_valid_tickers` (400, create-from-tickers' own refusal, with the dropped names), before any write, the session untouched. The transaction body starts with `droppedRetired = []` so a Firestore retry cannot carry a prior attempt's names. PATCH and create-from-tickers still refuse a newly added retired name; the refusal now also carries `symbols` (`watchlistValidation.js:92`, `[id].js:192`).
- **Reading of "today's empty-list path".** The dialogue save had no empty-list check of its own (a session that proposed nothing saved an empty draft). I took "an empty list after dropping" narrowly: refuse only when the drop empties it; a dialogue that proposed nothing keeps saving (a row pins it). Q2.
- **Client.**
  - The editor line: `forgeWatchlistService.js` keeps `err.symbols`; `useWatchlistAutosave.js` keeps `saveError`; `SaveStateIndicator.jsx:39` shows "KRE is no longer available. Remove it to save." (several names: "EA and WBA are no longer available. Remove them to save."), with no Retry, which would be refused again. Undoing the edit clears it (`noop`), and a refusal that arrives after the ticker was removed is dropped (`stale_refusal`, review CL2-3).
  - The chat: `WatchlistChat.jsx:615` toasts "KRE is no longer available, so it was left out of your watchlist." (info colour) before the editor opens. An all-retired dialogue takes the chat's existing failure path (generic message, session abandoned), as the ruling implies.
  - Copy: `src/utils/retiredTickerCopy.js`, from the server's symbols, never the message text (§9).
- **Tests.** `watchlists.test.js` (6 C4 rows + updated F4 rows), `watchlistValidation.test.js` (3), `retiredTicker.editor.jsdom.test.jsx` (the real hook and indicator over the real service client: 8 rows), `retiredTickerCopy.test.js`, `autosaveLogic.test.js`, a source pin for the chat toast. 10 mutants, all killed.

## 5. C5 — honest status for a battle that hasn't started yet

- **What a player sees.** A tiered battle before its first trading day is `PRE_OPEN`, never `LIVE`, and says **"Starts <Weekday> 9:30 AM ET"**, the first session's open from the calendar of record (`firstSessionOpenMs` → `marketCalendar.getSessionForDate`; a true instant, so a weekend, a holiday eve and a DST change land on the real next session; never `getMarketState`'s shifted wall-clock Dates).
- **One derivation, three surfaces (BUILD_RULES §9).**
  - The adapter: `derivePhase(battle, marketState, nowMs)` (`baggerbombAdapter.js:183`) returns `PRE_OPEN` while `notStartedYet`; with no `nowMs` it reads nothing and returns what it did. `deriveStartsAtEt` (:167) is the text; a completed battle starts nothing.
  - The Desk (`AgentDesk.jsx:96`) and the Battle View turn line (`deriveTurnLine.js:161`): `DESK_COPY.postureStarts` (`deskCopy.js:168`), "Starts Tue 9:30 AM ET" instead of "First check at 9:30 AM ET".
  - The hub row (`gamesDisplay.js:135`): waiting, `clock` "Starts Tue 9:30 AM ET", strip "Deployed · Starts Tue 9:30 AM ET"; the end time names the day when it isn't today (`formatHubTimeOnDay`, `hubDate.js`): "ends Tue 8:00 PM ET". This applies to every live row, as the ruling's text says.
- **Clocks.** No new `Date.now()` / `new Date()` in a source file: the predicate takes the ET date derived from the `now` / `nowMs` each surface already had. Checked by CL3 under five non-ET zones.
- **Tests.** `baggerbombAdapter.notStarted.test.js` (15), `gamesDisplay.notStarted.test.js` (16), the Desk render row, `tieredFirstTradingDay.test.js`: weekday afternoon and evening, Friday evening and weekend (across Nov 1), Wed → Fri holiday eve, first day before the open, LIVE on day 1, same-day battle, tournament, no list, outside the calendar. 9 mutants, all killed.
- **Flags.** `BATTLE_VIEW_CONTROLLER_ENABLED` is on (the turn line); `COMMAND_CENTER_SYNC_ENABLED` and `COMMAND_CENTER_HUB_ENABLED` are off, so the Desk and the hub row are dark today (read from `featureFlags.js` by the verifier).

## 6. C6 — loose ends

- `composeEvalRunRecord` persists `dormant` (`agent-evaluate.js:633`), after `lockSkipped`, so `battlesTotal` adds up (evaluated + lockSkipped + dormant + deferred; a tick that ends in an error or an early return is in none of them, and the new comment says so — CL1 checked it against the loop). `agent-evaluate.evalRun.test.js` header and key list updated (14 keys); 2 rows.
- Stale prose fixed in the three non-fenced files: `archetypeCandidateMenu.js:34`, `stockThresholdBroadRelease.test.js:371–373`, `leagueTournament.js:752` (the review made its first version accurate: an early-close day ends 1:00 PM, and a caller must pass the battle's own end date). The stale comments in `decide.js` and `agentPromptAssembly.js` are fenced and untouched.

## 7. Tests and checks

| Check | Commit | Result |
|---|---|---|
| Full suite, Linux (WSL Ubuntu, a worktree of the shared LF clone; Node 20.20.2; `TZ=UTC`; `--maxWorkers=8`; under `flock /tmp/pd-suite.lock`) | code-final `e94e6b76` | **exit 0**. Test Files 1198 passed, 8 skipped (1206); Tests 26,091 passed, 89 skipped (26,180); 260 s. Read from the `Test Files` / `Tests` lines and the recorded exit code |
| `npm run lint:gate` | `e94e6b76` | exit 0 |
| `vite build` | `e94e6b76`, and the pushed head (LF, Linux, §11) | exit 0 (the CSS-syntax warnings are the existing ones) |
| Earlier full suites, for the record | `895dc293`; `dea2ac6b` | `895dc293`: exit 1, one row, `film-tape-backfill.e2e` "next candle morning…" at 5.2 s against its 5 s limit while lint and other work shared the machine (3.3 s alone on the same commit). `dea2ac6b` (before the sanctioned fence change): exit 0, 1197 files / 26,078 rows. Both superseded by the row above |

The Firestore rules suite was not run: no rules file changed. On the Windows (CRLF) worktree the targeted runs show the known platform-only rows (`agent-evaluate.evalRun` "exactly ONE block", `tapeWiring`); Linux is the record. The suite grew by 9 files and 122 rows over #998's 1189 / 25,969.

## 8. Review (BUILD_RULES §2)

Full record: `docs/audits/BAGGERBOMB_THRESHOLDS_CLEANUP_REVIEW_20261028.md` (every finding, verdict and disposition).

- 55 files and 1,931 changed lines at code-final (30 non-test files, 473 lines): above both thresholds.
- **Round 1 (C1–C6):** three lenses on separate `git archive` snapshots (CL1 crons; CL2 cockpit and watchlists; CL3 client and cross-cutting), then a refuting verifier (CLV) on a fourth. Each reviewer was read-only on git and on the builder's tree. 23 findings: **19 CONFIRMED, 2 CONFIRMED-AS-QUESTION (CL2-7, CL3-1), 2 REFUTED (CL3-5 unreachable in production; CL3-8 not a defect).** No BLOCKER. The verifier downgraded CL2-1 and CL3-5 and upgraded CL1-4.
- Fixed in this branch: CL1-1, CL1-2 (after your sanction), CL1-3, CL1-4, CL1-5, CL2-1, CL2-2, CL2-3, CL2-5, CL2-6, CL2-7 (pinned), CL2-8 (a, c), CL3-6, CL3-7, CL3-8, CL3-9. Reported: CL3-1 (your "later"), CL3-2, CL3-3, CL3-4, CL2-4 (accepted).
- **Round 2 (the sanctioned executor hunk), a second refuting verifier (CLV2), as you asked:** nine questions, each to be refuted with a repro. **The hunk is SOUND** (scope: exact blob match; agreement with the evaluator: 2,000/2,000 randomised battles in two time zones; tournaments, other modes and same-day tiered battles byte-identical; the pre-fetch skip; unreachable before the first day; import boundary clean). **One real defect, mine, now fixed:** the repo-level guard "executeSwapServer has no consumers outside the fenced module and this wrapped cron" (`agent-evaluate.test.js`) failed because my new test calls the executor and was not on its allow-list. Two thin rows closed: the new rows used only `baggerbomb_agent` and `baggerbomb_tournament`, so a no-mode document and the other modes were pinned by nothing; and the §4 dependency-surface comment was missing on the new test. Two of its mutants are equivalent or unreachable (`??` → `||`; a first-day rule that applies only when the day is not in the future, which only differs on a dormant day no caller reaches).
- Mutation: 50 builder mutants — 33 for the rulings (C1+C2 6, C3 7, C4 10, C5 9, C6 1), 9 for the round-1 fixes, 8 for the sanctioned change and its verifier's gaps (executor 3, ghost baseline 3, no-mode document 1, other modes 1); each restored from a commit. 1 survived (the fork's cooldown instant) and was closed. Each lens ran its own (about 90 in all) and the second verifier 12; every real survivor became a row. **No separate mutation-verifier agent ran**; the later rows rest on the builder's mutants.

## 9. Reported, not changed

- **Resolved by your sanction:** CL1-2 (the fenced executor and the Film Room ghost baseline) — §2.
- **CL3-1 — the dashboard card (`ManageStation.jsx:37,102`)** still says "Battle live" and shows a countdown for a not-started battle. Your ruling (Q1): yes, but later, when Command Center sync is switched on. `COMMAND_CENTER_SYNC_ENABLED` is off, so nothing is user-visible today. **Recorded for the sync switch-on:** feed the adapter's `startsAtEt` into the card and drop the "live" eyebrow and the countdown while `PRE_OPEN`.
- **CL3-2.** The optimistic just-deployed entry (`deployHandoff.js:48-69`) carries no `timing`, so the hub row and the Desk read LIVE until the next poll (about 120 s). Both are dark; the fix needs the deploy response to carry the first day.
- **CL3-3 / CL3-4.** The hub's Games section tag counts a waiting game as "live" (`GamesSection.jsx:146`), and the Shadow status line says "waiting for the open" (`shadowStatus.js:85`, pinned by `shadowStatus.test.js:106-108`) where the row says "Starts …". Both are existing hub decisions, both hub-dark; best done with Q1's switch-on.
- **`voice-layer-cache.js:394-399`** computes proximity from the previous close regardless of the activation day: it will disagree with the C2 baseline on a next-session battle's first day. Pre-existing; not changed (the one remaining mirror I know of; not named in your sanction).
- **`CommandDashboard.jsx:250`** passes the market's next-close date as the casual battle's end date to `casualDeployMissesPodSession`; for a deploy at 15:15–16:00 ET the battle plays and ends tomorrow, so the pod-conflict warning can miss it. Pre-existing, BR-2 interplay. The comment in `leagueTournament.js` now says what the argument must be.
- **Line citations in comments drift** by 1–4 lines in other files that cite `agentSwapExecution.js` (swappable.js and its test, cockpit-bench, retire.js, platformGuardrails, filmTape.js, deriveBaggerMoment.js, captureReceipt.js, and others, per the verifier). Comment-only; no test pins them.
- **Rollout (CL1-6).** A battle created after Oct 25 whose creation night already ran under the old cron would log `already_recorded` on its real first night. None exists: the health read found no tiered battle created since Oct 24.
- `etDateOf` is null for out-of-range numbers (fixed). A regex-valid but impossible first-day string such as `2026-13-45` would hold a battle back; it cannot arise from creation (old F3 behaviour).
- Accepted as ruled: Q2 of #998 (the fenced prompt wording), the BRK.B spelling, the `gameModePolicy.js` hash.

## 10. Rulings received (Oct 28), from the four questions in the first report

- **Q1 — the dashboard card.** Yes, but later, when Command Center sync is switched on. Recorded in §9; no change now.
- **Q2 — C4's empty list.** Keep the narrow reading: refuse only when dropping the retired names empties the list. Pinned by a row; unchanged.
- **Q3 — the fence contact.** Sanctioned, limited to the Guard 3 activation-day expression and the matching `ghostBaseline` line, on this PR. Done (§2); verified by a refuting verifier (§8).
- **Q4 — a fork with one option that can't come in.** Keep the fork whole. Unchanged.

Nothing is open.

## 11. Delivery state

- [PR #999](https://github.com/fashraf94/TradeSeven/pull/999), branch `claude/baggerbomb-thresholds-cleanup` (pushed by refspec from `claude/baggerbomb-thresholds-cleanup-fbb502`); code-final `e94e6b76`; the PR head adds this report and the review record only (docs; `vite build` run on that exact head).
- **STOP.** Not merged; CI not watched; no auto-merge (BUILD_RULES §2).
- After merge and deploy:
  - nothing changes for a same-day battle;
  - the first next-session battle (a tiered deploy after 3:15 PM ET) should show "Starts <next session> 9:30 AM ET" on the battle screen's turn line, should not be touched by that evening's 8:45 PM scoring job, should record `day1` the next evening, and should lock the same points at a swap that its live card shows;
  - the first evening settle run with a real expired battle is still the open proof for F1.
- No production follow-up is owed by this build. #995's step 3 (`enable --all`) is unchanged and still waits on your word.
