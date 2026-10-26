# BaggerBomb measured thresholds — broad-release follow-up: build report (Oct 26, 2026)

**For Flash, in plain words:**
- **Next battle:** when an agent's battle ends at 8:00 PM ET, it now settles the same weekday night: at 10:00 PM ET (9:00 PM CT) through Fri Oct 30, and at 9:00 PM ET (8:00 PM CT) from Mon Nov 2. The player can start that agent's next battle that evening, Friday nights included, instead of waiting for the next weekday morning.
- **KRE:** KRE stays on its watchlist and the agent still sees it when it plans, but a BaggerBomb battle never takes it as a pick, a bench name or a swap candidate. Today one watchlist holds it, equipped on 5 agents (all casual clones, none in a battle).
- **A 3:20 PM ET deploy:** the battle is for the next trading session (BR-2). It now sits out that afternoon's 3:30 and 3:45 checks, starts at the next session's first check, ends at 8:00 PM ET that day and settles that night. One gap remains: the 8:45 PM ET nightly scoring job can still touch it on its creation night (question Q1).
- **Also:** a watchlist can no longer gain one of the 11 retired tickers; lists that already hold one still save and open. Nothing was written to production. The evening run is new, so only its first production night proves it (crons do not run on preview).

## Verdict

| Item | Result |
|---|---|
| Branch / PR | `claude/baggerbomb-measured-thresholds-followup` → [PR #998](https://github.com/fashraf94/TradeSeven/pull/998) (pushed, not merged). Code-final `e38d1457`; PR head (the commit that adds this report) adds this report only. Base `05b73287` (= `origin/main`, re-fetched before push). |
| F1 evening settlement | Built: `agent-evaluate?mode=settle` at `0 2 * * 2-6` UTC. The ordering check found a dependency, so it runs after agent-daily-scores. Cron count 43 → 44 (BUILD_RULES §6, same commit). |
| F2 KRE / off-list equipped tickers | Built (approved fence contact: one hunk + one import in `decide.js`); the evaluate refresh follows the same rule. Tournament and League paths byte-identical. Count today: 1 watchlist, 5 agents, ticker KRE. |
| F3 creation-day dormancy | Built in `processAgentBattle`: skipped (`dormant`), no lock, no write; measured and legacy; tournaments unchanged. |
| F4 retired tickers at the save endpoints | Built: PATCH, create-from-tickers and the dialogue save refuse a newly added retired ticker; stored lists still save and read. |
| Tests and checks | Full Linux suite exit 0 at code-final `e38d1457` — Test Files 1189 passed / 8 skipped (1197), Tests 25,969 passed / 89 skipped; `lint:gate` exit 0; `vite build` exit 0 (code-final and the pushed head) |
| Review (BUILD_RULES §2: 20 files, ~1,500 lines) | 3 lenses + a refuting verifier + a mutation verifier. 24 lens findings: 23 CONFIRMED, 1 PARTLY, 0 REFUTED by the verifier; the lenses refuted one of the builder's own claims (MT1-5). 3 new verifier NITs. 62 mutants on the final code: 56 killed, 3 equivalent, 3 gaps closed with new rows. 18 items fixed in this branch, the rest reported (§6). |
| Questions for Flash | 5 (§7). None blocks merging. |
| Production | Read-only reads only (Preamble). No writes. |

## Preamble

- `git fetch origin` first. Branch `claude/baggerbomb-measured-thresholds-01ccc7` (worktree; pushed as `claude/baggerbomb-measured-thresholds-followup`). HEAD at start `05b73287` = `origin/main`, clean tree. `origin/main` contains #995 (`tieredFullDayTarget`, `src/utils/stockAdmissionWindow.js:66`). VERIFIED. Re-fetched before push: `origin/main` still `05b73287`.
- Read: `docs/BUILD_RULES.md`; #995 report §5 and §7.
- Production reads (read-only, 2026-10-26 13:21 UTC; `.env.local` copied into the git-ignored worktree root; labels only, no ids printed):
  - `indexIntelligence/stockRankings`: computed 2026-10-26 11:30 UTC, 228 stocks, none of the 11 retired listed;
  - the 19 agents carrying `equippedWatchlistId`, and their watchlists;
  - the 15 tiered battles completed since Oct 13;
  - `timing.lastDailyResetAt` stamps of the last 10 nights.

## 1. F1 — evening settlement

### 1.1 The ordering check (written finding)

**Question:** does completion, or anything after it, depend on `agent-daily-scores` (`45 1 * * 2-6` UTC) having run first?

**Completion itself: no.** `completeBattle` settles on the stored `scoreState.currentScore` / `opponentScore` (`api/cron/agent-evaluate.js:7014`, `:6909`) and, for a measured battle, on its committed `stockScoreEvidence` (`validCorrectedCompletion`, `api/_utils/stockThresholdAdmission.js:231-234`). daily-scores writes neither score:
- for legacy it banks badge points into `bankedBadgePoints` and resets `thresholdHistory` (`api/cron/agent-daily-scores.js:141-199`);
- for measured it only writes a `dailyScores.dayN` checkpoint (`stockThresholdAdmission.js:299-308`).

The win or loss is the same either way. VERIFIED.

**After completion: yes.** daily-scores only processes `status == 'active'` battles (`agent-daily-scores.js:235`), so anything it writes reaches a battle only if it runs before completion. Today a battle that expires at 20:00 ET is still active at 01:45 UTC and settles at 13:00 UTC the next weekday, so it carries those fields. Production confirms it:

| Settled at 13:00 UTC | Carried (written by daily-scores) |
|---|---|
| Legacy (8 of 8) | `dailyScores.day1 = {badgePoints, recorded, recordedAt, recordedBy}`, `bankedBadgePoints.breakdown.day1`, `timing.currentTradingDay: 2`, `thresholdHistory` reset with a `dailyThresholds` archive |
| Measured pilot (6 of 6) | `dailyScores.day1 = {at, componentOwnership, currentScore, opponentScore, recorded, stockScoreEvidence}`, `timing.lastDailyResetAt`; `thresholdHistory` not reset |

What settling first would change:
- **Legacy: Film Room's day card.** `ScoreSummaryCard` → `computeDayScore` reads `scoreState.dailyScores.dayN.badgePoints` (`src/utils/computeDayScore.js:22`, `src/components/FilmRoom/ScoreSummaryCard.jsx:11`). Settled first, a legacy battle's final day would show 0 badge points. This is the dependency.
- **Measured: the day's checkpoint would be lost.** `checkpointCorrectedDaily` refuses a battle that is no longer active (`stale_daily_frame`, `stockThresholdAdmission.js:302`), so a measured battle settled first would never get its final `dailyScores.dayN` record. Nothing reads that record after completion today, but it would be missing.
- **Legacy: the pattern log would change, not break.** `countThresholdHits` / `countPenalties` read `thresholdHistory` (`api/_utils/battlePatternLogger.js:174-210`), which daily-scores zeroes, so today's legacy pattern logs count zero hits; settling first would make them count the day's hits. Review MT1-5 corrected the first draft of this point: it is not a reason by itself, but running after daily-scores keeps the record exactly as today.

The tape needs no ordering. Its close pass selects battles completed on the ET date, or on the next session's night (`api/_utils/filmTape/closePass.js:7-12`, `src/utils/tapeSchedule.js:124-139`).

**Decision:** something depends on it, so the run goes **after daily-scores**, at `0 2 * * 2-6` UTC.
- daily-scores' real wall time: every battle it touched on the last 10 nights carries `lastDailyResetAt` between 01:45:19 and 01:45:22 UTC (1–2 battles a night). 02:00 leaves ~14½ minutes.
- 02:00 is also before `film-tape-close` (`15 2 * * 2-6`), so the final-day tape records the completion the same night.

| Weekday evening | UTC | ET | CT |
|---|---|---|---|
| Mon–Fri through Oct 30 (EDT) | Tue–Sat 02:00 | 10:00 PM | 9:00 PM |
| Mon–Fri from Nov 2 (EST) | Tue–Sat 02:00 | 9:00 PM | 8:00 PM |

Comparison cases already in production: tournament battles (16:00 ET close) and early-close tiered battles (13:00 ET) settle at the afternoon ticks, before daily-scores, today. This build does not change them.

### 1.2 What was built

- `api/cron/agent-evaluate.js:287` `settleOnly = req.query?.mode === 'settle'`, the `?mode=` pattern of `compute-index-intelligence.js:709`.
- After the step-2 expiry loop, `:394-401`:
  - waits up to 10 s (`:229`) for that loop's pattern logs (`:348`, `:361-363`). Review MT1-2: the run responds at once, and a function may be frozen once its response ends;
  - returns `{ mode: 'settle', expired, completionSkipped, masteryDeferredCompletions, errors, duration }`.
- Auth, the mastery flag view and the expiry loop are the existing code. The run makes no repair sweeps (2b/2c), no market gate, no canonical sweep, no evaluation and no `agentEvalRuns` record.
- `vercel.json:160-163` the entry; `docs/BUILD_RULES.md:78` count 44/100.
- Pins reconciled: `api/agent/research.dark.test.js:139-141` and `api/cron/compute-index-intelligence.axes.test.js:114-123` (43 → 44).

### 1.3 Proof (crons do not run on preview)

`api/cron/agent-evaluate.measuredFollowup.test.js`, F1 blocks. The schedule is read from `vercel.json` inside the test, so a schedule edit turns the rows red.
- **Every weekday evening, both DST offsets:** for each weekday of the EDT week (Oct 26–30) and the EST week (Nov 2–6), a battle created at 10:00 ET expires at 20:00 ET. The settle instant falls on the same ET date, 15 minutes after daily-scores and before the tape close. The ET/CT wall times above are checked; no weekend run.
- **The real handler with `?mode=settle`, market gate doubled OPEN:**
  - a Friday-evening battle settles Friday evening on both DST offsets;
  - a live, non-dormant battle gets no write;
  - no sweep and no repair query, no model call, no run record;
  - the pattern log lands before the response.
- **Controls:** the same world with no mode, or with `mode=intraday`, does lock the live battle.

## 2. F2 — off-list equipped tickers

### 2.1 Count today (read-only, labels only)

19 agents carry an equipped watchlist; 8 distinct committed lists. **1 list (W1, 9 tickers) holds a ticker outside the ranked universe, KRE. It is equipped on 5 agents (A1–A5), all casual clones, none with an active battle.** No other off-list ticker is equipped.

### 2.2 What was built

The rule lives in one place, `rankedEquippedTickers` (`api/_utils/watchlistEquip.js:104-118`). It is applied at both points where equipped tickers become candidates.
- **Creation (fence contact, approved): `api/agent/decide.js:473-488`.** This is inside the `foldEquippedTickers` call path, plus the import at `:43`.
  - The path runs only for tiered deploys; the tournament deploy returned at `:340`.
  - `equippedSymbols` is narrowed after the Sonnet prompt is built (`:431`). The narrowed list feeds the fold (`:489`), the Haiku equipped note (`:554`) and the hotBench union (`:673`).
  - The Sonnet prompt and the battle's watchlist snapshot (`:390`) keep the full list, so the agent can still watch it.
  - The Option 8C comment above the fold was corrected in the same hunk (review MT3-7).
- **Refresh: `api/cron/agent-evaluate.js:1548-1566` and `:1590`.** For a tiered battle (`gameMode` absent or `baggerbomb_agent`, no tournament context), both the archetype-menu path and the legacy union refold only ranked equipped tickers. Without this, KRE would be back on the bench at the battle's first tick.
- Fenced functions **edited**: the `decide.js` default handler, that hunk only.
- Fenced functions **called, not edited**: `buildStrategyUserPrompt`, `buildPortfolioSystemPrompt` (`agentPromptAssembly.js`), `validatePortfolio`, `createAgentBattle`, and `computeArchetypeRankings` (through the unchanged menu).
- Comment corrected: `api/_utils/rankingConfig.js:87-99`.

### 2.3 Tests

**`api/agent/decide.rankedEquip.test.js`**, on the real deploy and the P1b harness:
- an equipped ETF never enters the candidates (no Haiku row or note, no shortlist, no hotBench, no roster), while the Sonnet prompt and the snapshot keep it;
- a ranked equipped stock is still elevated, offered and benched;
- an ETF Sonnet shortlists itself is dropped;
- an ETF the model picks anyway is refused by the portfolio check (the retry is told "Unknown stock: KRE") and never reaches the roster;
- the tournament deploy never calls the rule;
- source-order pins.

**Refresh rows in `agent-evaluate.measuredFollowup.test.js`:**
- menu on and off; a gameMode-less legacy doc; a stored hotBench that already holds KRE;
- a flat6 battle without a resolved context;
- tournament and League hotBenches equal the characterized old-path list plus KRE, byte-identical to before.

**Deliberate pin change: the frozen deploy golden.**
- `deployCarriageOffGolden.json` (captured from main @ 4b28cd84) equips NVDA, PLTR, AMD. PLTR is outside the harness universe, so F2 changes that tiered capture.
- The fixture and its SHA pin stay unchanged. `api/_utils/__fixtures__/rankedEquipGolden.js` applies F2 to the baseline, following the `stockAdmissionGolden.js` precedent.
- All 76 deltas between main's capture and this build's were classified before the transform was written: the Haiku prompt's PLTR row and note, the `shortlist` / `hotBench` arrays, `totalStocks`, and `shortlistCount` / `shortlistSize`. Nothing else moved: not the manifest, `equippedConfigHash`, the snapshot, or any other read or write.
- The tournament scenario still compares against the untouched golden.
- Wired in `decide.carriageOffGolden.test.js:183-185` and `decide.carriage.test.js:94-96`.
- With the transform disabled, 17 golden rows go red (mutant G1), so it is not vacuous.

Also changed: the `api/cron/agent-evaluate.test.js:281-285` source pin was widened to allow the second import name.

## 3. F3 — a late-day battle does not play its creation day

- `beforeFirstTradingDay` (`api/cron/agent-evaluate.js:879-892`) holds a battle back when both are true:
  - it is tiered (`gameMode` absent or `baggerbomb_agent`);
  - the ET date (`getETDate`, Intl `America/New_York`) is before `timing.tradingDays[0]`.
- It is called first thing in `processAgentBattle` (`:897-901`), before the stock-route check and the lock transaction. It increments `summary.dormant` and `summary.skipped`, never `errors`.
- The run record (`composeEvalRunRecord`) is untouched. The handler's expiry loop never reaches the gate.
- Tests (`agent-evaluate.measuredFollowup.test.js`, F3 blocks):
  - a battle created at 15:20 ET gets no transaction, no write, no price fetch and no model call at 15:30 and 15:45, then plays at the next session's 10:00 check;
  - created at 10:00 ET, it plays the same day;
  - created at 23:30 ET the night before, it plays its session;
  - a measured battle on the corrected route is held back before any read;
  - a flat6 battle whose list starts tomorrow is still evaluated;
  - one handler run completes an expired battle and counts a dormant one as `skipped: 1, dormant: 1, errors: 0`.

## 4. F4 — retired tickers at the save endpoints

- The check is `newlyAddedRetiredTickers` / `retiredTickerRefusal` (`api/_utils/watchlistValidation.js:61-79`). Symbols are trimmed, uppercased and deduplicated before comparing.
- **PATCH `/api/forge/watchlists/{id}`** (`api/forge/watchlists/[id].js:233-238`): compared against the stored list, inside the transaction that read it. Refused with 400 `retired_ticker` before `tx.update`. A list that already holds one saves, and can drop it.
- **POST create-from-tickers** (`api/forge/watchlists.js:296-298`): no stored list, so any retired ticker is an add. Refused before any write, and before the screener-session transaction and its research record.
- **POST signal/dialogue save** (`api/forge/watchlists.js:454-455`, `:507-511`, `:588`; review MT3-1):
  - It copies the session's candidates. These are validated per proposal since BR-3, but a session that proposed a retired name before Oct 25 could still carry one.
  - Refused inside the transaction before any write, leaving the session as it was. But the client treats any failure as "abandon" (review MTV-1), so such a dialogue is lost. Question Q4.
- **Not changed:** the equip, commit, uncommit, notes and delete endpoints never write tickers; `firestore.rules` denies client writes to `watchlists`; server-built tournament boards and quickplay draw from the ranked pool.
- **Tests:** 10 rows at the end of `api/forge/watchlists.test.js` and 1 in `api/forge/researchRecords.hosts.test.js` (the screener-session branch). They cover a padded symbol, a held lowercase symbol, a duplicate add and the dialogue save.

## 5. Tests and checks

| Check | Commit | Result |
|---|---|---|
| Full suite, Linux (WSL Ubuntu, a worktree of the shared LF clone, lockfile `22fa2b71904c` = main's; `TZ=UTC`, `--maxWorkers=8`, under `flock`) | code-final `e38d1457` | **exit 0**. Test Files 1189 passed, 8 skipped (1197); Tests 25,969 passed, 89 skipped; 211 s. Read from the `Test Files` / `Tests` lines and the recorded exit code. |
| `npm run lint:gate` | `e38d1457` | exit 0 |
| `vite build` | `e38d1457`, and again on the pushed head (this report's commit, LF archive) | exit 0 both |
| First full suite, for the record | `1a2e053d` | exit 1: 2 rows, both stale pins this build had to move: the cron count 43 (`compute-index-intelligence.axes.test.js`) and an exact import regex (`agent-evaluate.test.js:282`). Reconciled in `d13476b0`; `lint:gate` and `vite build` exit 0 there too. |

On the Windows (CRLF) worktree the targeted runs also show the known platform-only rows (`agent-evaluate.evalRun` "exactly ONE block", `tickCoherence`, the film-tape files); Linux is the record. The Firestore rules suite was not run: no rules file changed.

## 6. Review (BUILD_RULES §2)

The branch is 20 files and ~1,500 lines, above the threshold. Each reviewer worked on its own LF `git archive` snapshot with `node_modules` linked, read-only on git and on the working tree; all junctions were unlinked afterwards, and the install was intact (754 entries). Id prefixes: MT1-/MT2-/MT3- for the lenses, MTV- for the refuting verifier, MTM- for the mutation verifier. None of these prefixes was in use in the repo.

**Lenses (on `d13476b0`):**
- **MT1:** F1 and F3, i.e. cron lifecycle, DST and ordering; 18 mutants.
- **MT2:** F2, i.e. fence contact, completeness, byte-identity and the golden transform; 13 mutants.
- **MT3:** F4 and cross-cutting honesty; 10 mutants.

**Refuting verifier MTV (on `d13476b0` and `6158f598`):**
- Handed all 24 lens findings and told to refute each with a repro: 23 CONFIRMED, 1 PARTLY (MT2-4: the voice opener listing KRE is correct "watching", not stale), 0 REFUTED.
- All 10 fixes then in place were verified: each mutant passes the old rows and turns the new row red.
- It added 3 NITs.

**Mutation verifier MTM (on `6158f598`), last, on its own tree:**
- 62 mutants: 56 killed, 6 survived. Survivors were re-run against a wider set (1,097 rows).
- 3 are equivalent in production:
  - `tradingDays.at(-1)`: lists always have one day;
  - also gating the expiry sweep: an expired battle is never before its first day;
  - dropping `!tournamentCtx`: contexts resolve only for flat6.
- 3 were real gaps, closed in `e38d1457`. The builder re-checked the two behavioral ones: each new row goes red under its mutant.

The builder's own claim refuted by a lens: **MT1-5**, the pattern-log reasoning in the first draft of §1.1 (corrected above; the decision stands).

| Id | Sev. | Finding | Disposition |
|---|---|---|---|
| MT1-1 | MAJOR | daily-scores still processes a dormant battle on its creation night (legacy banks creation-evening badge points into the score; measured logs one refusal) | Reported: **Q1** (outside F3's letter; pre-existing since BR-2) |
| MT1-2 | MINOR | settle run responded before its fire-and-forget pattern logs landed | Fixed (`2a916dde`; bounded in `5ec5649c`, MTV-2) |
| MT1-3 | MINOR | never-evaluates rows used a dormant battle (mutant "settle also evaluates" survived) | Fixed (`2a916dde`) |
| MT1-4 | NIT | step-2c query invisible to the settle rows | Fixed (`2a916dde`) |
| MT1-5 | NIT | ordering finding's pattern-log reasoning reversed | Fixed (report text) |
| MT1-6 | NIT | dormant battles count in the run record's `battlesTotal` but in no bucket | Reported (§8) |
| MT1-7 | MINOR | the day-1 "activation day" badge baseline keys on `activatedAt`, not `tradingDays[0]` | Reported: **Q5** (pre-existing, BR-2 interplay) |
| MT1-8 | NIT | the client shows a dormant battle as LIVE during the creation afternoon | Reported (§8) |
| MT1-9 / MT3-9 | NIT | test header cites this report | Fixed (report lands in this PR) |
| MT2-1 | MINOR | cockpit fork/pick can offer KRE (in the battle universe via the snapshot); the executor always refuses it, a dead-end offer | Reported: **Q3** |
| MT2-2 | MINOR | the fenced Sonnet prompt still asks to include every equipped ticker; its brief can steer Haiku to KRE (retry → fallback) | Row added; wording is **Q2** |
| MT2-3 | NIT | each half of the refresh discriminator survived alone | Row added (gameMode half); the other half is equivalent |
| MT2-4 | NIT | stale prose (Option 8C comment, dead `offUniverseRows`, the Haiku "-" note, `archetypeCandidateMenu.js:34`) | Option 8C comment fixed; rest reported (§8) |
| MT2-5 | NIT | `BRK.B` (dotted) never matches rankings `BRK-B`, so F2 drops it | Reported (§8) |
| MT3-1 | MINOR | dialogue save had no retired check | Fixed (`1607da98`) |
| MT3-2 | MINOR | no row killed the padded-symbol bypass | Fixed (row) |
| MT3-3 | MINOR | no row ran the screener-session branch | Fixed (row) |
| MT3-4 | NIT | no row on a stored lowercase symbol | Fixed (row) |
| MT3-5 | NIT | no row on duplicate adds | Fixed (row) |
| MT3-6 | NIT | a stale tab's autosave keeps failing after a `retired_ticker` refusal; generic error | Reported (§8) |
| MT3-7 | NIT | stale Option 8C comment under the F2 hunk | Fixed |
| MT3-8 | NIT | `stockThresholdBroadRelease.test.js:371-373` comment describes the pre-F2 fold | Reported (§8) |
| MT3-10 | NIT | comment precision on what the F4 check catches | Fixed |
| MTV-1 | NIT | a refused dialogue save makes the client abandon the dialogue | Reported: **Q4** |
| MTV-2 | NIT | the settle-mode wait had no time bound | Fixed (`5ec5649c`, 10 s) |
| MTV-3 | NIT | the "nothing expired" settle row used a dormant battle | Fixed (`5ec5649c`) |
| MTM-1 | MINOR | no row on a corrected-route measured battle before day 1 | Fixed (`e38d1457`) |
| MTM-2 | MINOR | no row on a stored hotBench already holding KRE | Fixed (`e38d1457`) |
| MTM-3 | NIT | no row on a `mode` other than `settle` | Fixed (`e38d1457`) |

## 7. Questions for Flash

None blocks merging.

**Q1 — The nightly scoring job on a battle's creation night (MT1-1).**
- **What happens:** `agent-daily-scores` (8:45 PM ET) still processes a battle that has not reached its first trading day, because it is `active`, and it treats that night as day 1.
  - **Legacy:** it banks badge points for the move from the creation price to that evening's price into the battle's score. Then the real first night is skipped as "already recorded".
  - **Measured:** it logs one refusal and writes nothing; the real night records normally.
- **Exposure:** any battle created between 3:15 PM and ~8:45 PM ET on a weekday. This predates F3 and is not in its letter (F3 names `processAgentBattle`). It disappears for new battles once every creation is measured.
- **Candidate fix:** skip such a battle in `agent-daily-scores.js` with the same predicate.
- **My lean:** yes, as a small follow-up.

**Q2 — The Sonnet prompt still asks for every equipped ticker (MT2-2).**
- **What happens:** the fenced strategy prompt says "Include every user-equipped ticker…". Sonnet may name KRE in its brief. The code drops KRE from every candidate list. But a Haiku that follows the brief gets refused, retries, and may land on the algorithmic fallback. The brief also reaches the intraday prompts.
- **Options:** accept; or add "watch only — not pickable" wording for off-list tickers (fence contact in `agentPromptAssembly.js`).
- **My lean:** accept for now; reword in the next prompt pass.

**Q3 — The cockpit can offer KRE as a pick (MT2-1).**
- **What happens:** with call records on, the agent's fork/pick options are checked only against the battle universe, which includes the equipped snapshot. KRE can be offered and filed, and then the executor refuses it. It is a dead-end offer, with no holding.
- **Candidate fix:** filter fork options and `call_pick` with the swap lists (`canComeIn`), the rule exit options already use. This is non-fenced cockpit code.
- **My lean:** a small follow-up.

**Q4 — The dialogue save with an old retired candidate: refuse or drop? (MT3-1 / MTV-1)**
- **What was built:** the ruling's letter, refuse.
- **The catch:** the chat client abandons the dialogue on any failure, so the player loses it and never sees the message.
- **Alternative:** drop the retired name from the saved list, the way removed candidates are dropped.
- **Reach:** a dialogue left open across the Oct 25 deploy.
- **My lean:** drop, as a one-line follow-up.

**Q5 — The day-1 badge baseline for next-session battles (MT1-7).**
- **What happens:** "activation day" is keyed on the creation date. For a battle that plays the next session, its only day uses the previous close as the badge baseline while the score runs from the creation price. This affects legacy stocks and crypto; measured stocks are unaffected. Pre-existing since BR-2. F1's evening redeploys make it more common.
- **My lean:** look at it together with Q1.

Accepted without change per the rulings: Q4 of #995 (the 2028 calendar), Q5 of #995 (the v2 hashes), the two §7 stale comments of #995.

## 8. Reported, not changed

- Dormant battles count in the eval-run record's `battlesTotal` but in no bucket (`dormant` is not persisted). The `agent-evaluate.evalRun.test.js:9` wording "skipped stays their sum" now holds only without dormant battles (MT1-6).
- The client shows a dormant battle as LIVE during its creation afternoon (`src/adapters/baggerbombAdapter.js:157-160`, MT1-8).
- Stale prose after F2 (MT2-4, MT3-8):
  - `decide.js:536-543` `offUniverseRows` is dead on its only caller;
  - `agentPromptAssembly.js:157-159` and `:208-212` describe "-" rows that a tiered deploy no longer produces;
  - `archetypeCandidateMenu.js:34` "including off-universe names";
  - `stockThresholdBroadRelease.test.js:371-373`.
- `BRK.B` (dotted) in an old or crafted list no longer folds (rankings spell it `BRK-B`). On main it folded as an unscored row (MT2-5).
- After a `retired_ticker` refusal, a stale editor tab's autosave keeps failing until the ticker is removed; the editor shows a generic error (MT3-6).
- `gameModePolicy.js` describes the tiered universe as `open_rankings_plus_watchlist`. It is hashed and has no production consumer; re-hashing is a separate decision.
- The 13:00 UTC run's pattern logs are still not awaited (unchanged, pre-existing).

## 9. Delivery state

- Pushed: branch `claude/baggerbomb-measured-thresholds-followup` → [PR #998](https://github.com/fashraf94/TradeSeven/pull/998). Code-final `e38d1457`; the PR head is the commit that adds this report (docs only), built again before push.
- **STOP.** Not merged; CI not watched; no auto-merge (BUILD_RULES §2).
- After merge and deploy:
  - the first evening run is the first weekday 02:00 UTC after the deploy. Its log line reads `[settle] expiry sweep only: N completed, M still active`;
  - a battle that expired at 20:00 ET that evening should read `status: completed` with `completedAt` just after 02:00 UTC.
- No production follow-up is owed by this build. #995's step 3 (`enable --all`) is unchanged and still waits on your word. Today's read shows `stockRankings` lists none of the 11, which that step checks.
