# BaggerBomb measured thresholds — cleanup after the broad release: build report (Oct 28, 2026)

**For Flash, in plain words:**
- **Health read:** measured thresholds are on for 2 allowlisted owners only; `enable --all` has not been run. The evening settlement run fires and sweeps cleanly (Oct 28, 02:00:34 UTC: `0 completed, 0 still active`), but it has not met a real battle yet: no tiered battle was created since Oct 24, so nothing expired on Oct 27 or Oct 28 and nothing is stuck. Not a STOP.
- **A battle that starts tomorrow:** it no longer reads LIVE. It says "Starts Tue 9:30 AM ET" (the next real session, from the calendar; Mon for a Friday evening, Fri after Thanksgiving) and its end time says "ends Tue 8:00 PM ET". The nightly scoring job skips it the evening it is created, so its real first night records as day 1, and day 1 is scored from the creation price. Most of the new screens are behind flags that are off today (§5); the turn line on the battle screen and the battle card are live now.
- **KRE in the cockpit:** it stays on the watchlist as a watch name. The cockpit never offers it as a fork option and refuses it as a pick; the ranked bench names are still offered.
- **An old dialogue:** a dialogue that still holds a retired ticker now saves without it, and the chat says which names were left out. If every name was retired, the save is refused as an empty list. In the editor, adding a retired name shows "KRE is no longer available. Remove it to save." and no Retry button.
- **One thing needs you:** C2 makes two older places disagree with the new day-1 baseline: the fenced swap executor (`agentSwapExecution.js:248-258`) and the Film Room's ghost baseline (§9, Q3). Nothing was written to production.

## Verdict

| Item | Result |
|---|---|
| Branch / PR | local branch `claude/baggerbomb-thresholds-cleanup-fbb502` (the app's suffix), pushed as `claude/baggerbomb-thresholds-cleanup` → the PR opened from it (its number does not exist until this report is committed; it is in the PR's own page and in my hand-off message). Base `24495eba` (= `origin/main`, re-fetched before the final suite and before push). Code-final `dea2ac6b`; the PR head adds the report and the review record only |
| Health read | §0: on for 2 owners; evening run clean, never exercised; no stuck battle; **not a STOP** |
| C1 nightly job skips a battle before its first day | Built; shared module `src/utils/tieredFirstTradingDay.js` |
| C2 day-1 baseline follows the first day | Built in the evaluate gate, **and** in the two mirrors of it that C2 would otherwise leave disagreeing: `agent-daily-scores.js` and the battle card (`AgentBattleScreen.jsx`) |
| C3 cockpit never offers a pick that can't come in | Built at the mint, the pre-commit capture, and `call_pick` |
| C4 retired tickers dropped from old dialogues | Built; the editor line and the chat toast included |
| C5 honest status before the first day | Built on the adapter, the Desk, the turn line and the hub row |
| C6 loose ends | Built: `dormant` on the run record; three stale comments |
| Tests and checks | Full Linux suite exit 0 at code-final `dea2ac6b`: Test Files 1197 passed, 8 skipped (1205); Tests 26,078 passed, 89 skipped (26,167). `lint:gate` exit 0. `vite build` exit 0 (code-final and the pushed head) |
| Review (BUILD_RULES §2: 49 files, 1,734 lines) | 3 lenses + a refuting verifier. 23 findings: 19 CONFIRMED, 2 CONFIRMED-AS-QUESTION, 2 REFUTED; no BLOCKER. 15 fixed in this branch (some findings share a fix), the rest reported. 42 builder mutants, 1 survived at first and was closed (§8) |
| Fenced files | **None edited, none in the diff** (checked by the builder and all three lenses). Fenced functions *called* by the code paths the diff touches (none edited): `getCurrentTradingDayServer` (`agentEvalPromptAssembly.js:1376`), `calculateAssetScoreServer` and `flattenPortfolioServer` (`agentScoring.js`). C1 and C2 change what is fed to the scoring concept (when a night counts and which price a day-1 badge reads from), as ruled, not the scoring code |
| Questions for Flash | 4 (§10). None blocks merging |
| Production | Read-only reads only (§0). No writes |

## Preamble

- `git fetch origin` first. Branch `claude/baggerbomb-thresholds-cleanup-fbb502`, HEAD at start `24495eba` = `origin/main`, clean tree. `origin/main` contains #998 (`beforeFirstTradingDay`, `api/cron/agent-evaluate.js:888` at that head). VERIFIED. Re-fetched before the final suite: `origin/main` still `24495eba`.
- Read: `docs/BUILD_RULES.md`; #998's report §6–§8 (and §1–§3 for the F3 and ordering context).
- The app suffixed the local branch (`-fbb502`); the PR head is `claude/baggerbomb-thresholds-cleanup`, pushed by refspec.
- `.env.local` copied into the git-ignored worktree root for the health read (names never printed).

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
- **Two other places still use `activatedAt`: see §9** (the fenced executor; the Film Room ghost baseline).

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
| Full suite, Linux (WSL Ubuntu, a worktree of the shared LF clone; Node 20.20.2; `TZ=UTC`; `--maxWorkers=8`; under `flock /tmp/pd-suite.lock`) | code-final `dea2ac6b` | **exit 0**. Test Files 1197 passed, 8 skipped (1205); Tests 26,078 passed, 89 skipped (26,167); 232 s. Read from the `Test Files` / `Tests` lines and the recorded exit code |
| `npm run lint:gate` | `dea2ac6b` | exit 0 |
| `vite build` | `dea2ac6b`, and the pushed head (LF archive, §11) | exit 0 (the CSS-syntax warnings are the existing ones) |
| First full suite, for the record | `895dc293` | exit 1: one row, `film-tape-backfill.e2e` "next candle morning…", 5.2 s against its 5 s limit while lint and other work shared the machine; 3.3 s alone on the same commit. The final run, with the machine otherwise idle, was clean |

The Firestore rules suite was not run: no rules file changed. On the Windows (CRLF) worktree the targeted runs show the known platform-only rows (`agent-evaluate.evalRun` "exactly ONE block"); Linux is the record. The suite grew by 8 files and 109 rows over #998's 1189 / 25,969.

## 8. Review (BUILD_RULES §2)

Full record: `docs/audits/BAGGERBOMB_THRESHOLDS_CLEANUP_REVIEW_20261028.md` (every finding, verdict and disposition).

- 49 files and 1,734 changed lines at code-final (28 non-test files, 456 lines): above both thresholds.
- Three lenses on separate `git archive` snapshots (CL1 crons; CL2 cockpit and watchlists; CL3 client and cross-cutting), then a refuting verifier (CLV) on a fourth. Each reviewer was read-only on git and on the builder's tree.
- 23 findings: **19 CONFIRMED, 2 CONFIRMED-AS-QUESTION (CL2-7, CL3-1), 2 REFUTED (CL3-5 unreachable in production; CL3-8 not a defect).** No BLOCKER. The verifier downgraded CL2-1 and CL3-5 and upgraded CL1-4.
- Fixed in this branch: CL1-1, CL1-3, CL1-4, CL1-5, CL2-1, CL2-2, CL2-3, CL2-5, CL2-6, CL2-7 (pinned), CL2-8 (a, c), CL3-6, CL3-7, CL3-8, CL3-9. Reported: CL1-2 (fenced), CL3-1, CL3-2, CL3-3, CL3-4, CL2-4 (accepted).
- The two largest finds: CL1-1 (the battle card, a client mirror of the gate that I had not found) and CL2-1 (the capture seam); the review also corrected the first draft of my own C6 comment.
- Mutation: 42 builder mutants — 33 for the rulings (C1+C2 6, C3 7, C4 10, C5 9, C6 1) and 9 for the review round; each restored from a commit. 1 survived (the fork's cooldown instant) and was closed. Each lens ran its own (about 90 in all); every real survivor they found became a row. **No separate mutation-verifier agent ran after the fixes**; the review-round rows rest on the builder's 9 mutants.

## 9. Reported, not changed

- **CL1-2 — the other two mirrors of the activation-day rule (needs a founder ruling; follow-up).** After C2 the evaluator scores a next-session battle's first day from the creation price. Two places still read `activatedAt`:
  - **`api/_utils/agentSwapExecution.js:248-258` (FENCED, called, not edited).** Guard 3 baselines a held-from-start position at the previous close on that day. Verifier probe through the real executor: creation 100, Monday close 103, Tuesday price 104, star tier, ATR 2.5 — the live card scores 125 (bagger + doubleBagger); a swap locks `lockedPoints` 80. The banked locked points come out 45 below the card just before the swap, with the badges gone. It affects held-from-start positions on legacy battles and the crypto slot of measured battles (measured stocks swap through `executeCorrectedStockSwap`). Before C2 it agreed with the evaluator. The fix is one line (`firstTradingDayOf(battle) ?? activatedAt`); it needs your word on fence contact.
  - **`api/_utils/filmTape/tapeAssemble.js:399-413` `ghostBaseline` (not fenced).** For a swap on that day it returns no baseline (`previous_close`), so the Film Room lists the ghost leg as missing `ghost.thresholdBaseline`. Same one-line shape; it has its own Film Room pins, so I left it for the same follow-up as the executor.
- **CL3-1 (a ruling question).** `src/components/Dashboard/ManageStation.jsx:37,102`: the dashboard card for a battle still says "Battle live" and shows a countdown for a not-started battle. `COMMAND_CENTER_SYNC_ENABLED` is off, so the card is untouched today; with it on, the Desk above says "Starts …". C5 names the adapter and the hub row; Q1.
- **CL3-2.** The optimistic just-deployed entry (`deployHandoff.js:48-69`) carries no `timing`, so the hub row and the Desk read LIVE until the next poll (about 120 s). Both are dark; the fix needs the deploy response to carry the first day.
- **CL3-3 / CL3-4.** The hub's Games section tag counts a waiting game as "live" (`GamesSection.jsx:146`), and the Shadow status line says "waiting for the open" (`shadowStatus.js:85`, pinned by `shadowStatus.test.js:106-108`) where the row says "Starts …". Both are existing hub decisions, both hub-dark.
- **`voice-layer-cache.js:394-399`** computes proximity from the previous close regardless of the activation day: it will disagree with the C2 baseline on a next-session battle's first day. Pre-existing; not changed.
- **`CommandDashboard.jsx:250`** passes the market's next-close date as the casual battle's end date to `casualDeployMissesPodSession`; for a deploy at 15:15–16:00 ET the battle plays and ends tomorrow, so the pod-conflict warning can miss it. Pre-existing, BR-2 interplay. The comment in `leagueTournament.js` now says what the argument must be.
- **Rollout (CL1-6).** A battle created after Oct 25 whose creation night already ran under the old cron would log `already_recorded` on its real first night. None exists: the health read found no tiered battle created since Oct 24.
- A fork over a name that cannot come in is removed whole (the `outside_universe` precedent), not trimmed to the options that can; trimming would break the fork's own `said` text. Q4.
- `etDateOf` is null for out-of-range numbers (fixed). A regex-valid but impossible first-day string such as `2026-13-45` would hold a battle back; it cannot arise from creation (old F3 behaviour).
- Accepted as ruled: Q2 of #998 (the fenced prompt wording), the BRK.B spelling, the `gameModePolicy.js` hash.

## 10. Questions for Flash

None blocks merging.

**Q1 — Is the dashboard card (`ManageStation`) inside C5's "everywhere it would show LIVE"?** Today it is dark (sync off), so nothing user-visible changes either way. If yes, a small follow-up feeds the adapter's `startsAtEt` into the card. My lean: yes, when sync is switched on.

**Q2 — C4's empty list.** I refuse only when dropping the retired names empties the list; a dialogue that proposed nothing still saves an empty draft, as it always did. Refusing every empty result would also change that old behaviour. My lean: keep the narrow reading.

**Q3 — The activation-day follow-up.** The fenced executor (`agentSwapExecution.js:248-258`) and the Film Room ghost baseline need the same one-line change as the evaluator. Do you sanction the fence contact? My lean: yes, as one small follow-up, before measured / legacy next-session battles start appearing (a late-afternoon deploy is the normal case).

**Q4 — A fork with one option that can't come in.** It is removed whole. Trimming it to the options that can would leave a fork whose `said` text may name the dropped one. My lean: keep it whole.

## 11. Delivery state

- Branch `claude/baggerbomb-thresholds-cleanup` (pushed by refspec from `claude/baggerbomb-thresholds-cleanup-fbb502`); code-final `dea2ac6b`; the PR head adds this report and the review record only (docs; `vite build` run on that exact head).
- **STOP.** Not merged; CI not watched; no auto-merge (BUILD_RULES §2).
- After merge and deploy:
  - nothing changes for a same-day battle;
  - the first next-session battle (a tiered deploy after 3:15 PM ET) should show "Starts <next session> 9:30 AM ET" on the battle screen's turn line, should not be touched by that evening's 8:45 PM scoring job, and should record `day1` the next evening;
  - the first evening settle run with a real expired battle is still the open proof for F1.
- No production follow-up is owed by this build. #995's step 3 (`enable --all`) is unchanged and still waits on your word.
