# Setup frequency count — tf-setup-v1 across the universe and real lists (read-only)

**Date:** Tuesday 17 Nov 2026 (the run began 7:09 PM ET, after the close) · **Run by:** Claude Code (Opus), local session · **Prompt:** *Experiment prompt — how often the two setups occur (read-only count)*, V1.1 (Fable, architecture review chat, 17 Nov 2026) · **Branch:** `claude/setup-frequency-count`, cut from `origin/main` at `abcdfcb7` · **Scripts:** `scripts/experiments/setup-frequency/` · **Out-of-tree copy:** `C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/20261117_SETUP_FREQUENCY_COUNT.md` (BUILD_RULES §3).

This count says how many names are in a valid setup. It does not say whether a setup makes money: no outcome, return or points figure appears below. The one price move it uses is the sector funds' one-day change, needed to name "today's top sectors" (§5).

## How often the setups occur, in plain terms

- **On a typical morning, 18 of the 228 ranked stocks are in a valid setup** (10 on a thin morning, 29 on a busy one; never fewer than 4). Fewer than seven on 3 of 120 mornings, fewer than three on none. *Reconstructed.*
- **Almost all of them are Pullback and Resume.** Trend Breakout qualifies on a median of 0 names a morning and never more than 3. The extension limit is why: 84% of the breakouts the pattern finds are "too far above the average" (§3, surprise 1).
- **The market's own trend barely changes the count:** 21 when SPY is in an uptrend (56 mornings), 17 when it has no trend (55), 20 in its downtrend (9 mornings, all in November). *Reconstructed.*
- **On a list an agent actually picks from, it is 1.** Battle lists hold 9 to 13 stocks; the median list had 1 valid name, every one of the 40 had fewer than seven, and 45% had none. The 8 equipped watchlists show 0 or 1 on a typical day and never seven. *Reconstructed.*
- **A valid setup lasts 2 sessions at the median:** 43% last one session, 38% last three or more. **97% are still enterable at the next open** (approximate: the open price against the record's own limit, not a new verdict).
- **Archetype overlays** (today's scores applied to past sessions, approximate): Trend Follower 6 a morning (fewer than seven on 54% of mornings), Speculator 4, Capital Preserver 1, Fundamental Investor 0 (only 2 stocks in the universe pass its score bar today). The Diversifier's valid names span 8 sectors at the median, 7 or more on 69% of mornings.
- **The replay reproduces the store exactly:** all 456 records the sweep wrote (17 Nov and 16 Nov) give the same verdict, reason, pattern and patterns satisfied. On those two days the stored records alone say 14 and 12 valid. *Contemporaneous.*
- **The provider revised its data within hours** of the sweep reading it (1,250 of 24,970 stored bars, mostly volume). No verdict changed here, but every figure before 16 Nov rests on bars as served on the run day.

| Item | Verdict |
|---|---|
| Reproduction check (§2) | **456 of 456 match.** No STOP. Underlying facts moved on 259 records from later provider revisions; no verdict moved. |
| Universe (§3) | Median 18 valid of 228; fewer than 7 on 2.5% of sessions; Pullback and Resume carries the count. |
| Agent lists (§4) | Median 1 valid per battle list; 100% of battles below seven. A list-size limit as much as a setup limit. |
| Overlays (§5) | Below seven on most mornings for every overlaid archetype; Fundamental Investor 0. |
| Requests | **241 EODHD requests** of the 400 cap; 0 failed. No model call. |
| Production | Read only (`count`, field-masked `select().get()` and `getAll`). No write. |

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first; `origin/main` = `abcdfcb7`. Branch `claude/setup-frequency-count` cut from it, HEAD `abcdfcb7`, tree clean.
- **New files only:** six scripts and this report. **One test edit**, sanctioned by the prompt's rule 2: `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` lists `storeReplay.mjs` and `exportProduction.mjs` by exact filename, in the same commit as the scripts (`fe15255a`). They are the only two files that name the store. No evaluator, threshold, golden, store, sweep, flag, rule or fenced file changed.
- **Fenced functions:** none called, none edited. `api/_utils/archetypeScoring.js` (§1-fenced) is **read as text**, never imported: `analyze.mjs` asserts each cited constraint is still on its line.
- **Markers:** VERIFIED means read at `abcdfcb7` in this session; MEASURED means a production read or provider fetch made in this session.
- **Owners** are "founder", "FT_QA" (the two uids read in memory from the archived week-1 dump, never written) or an ordinal (`owner-NN`, numbered in the order the export met them). Battles and lists are ordinals. No account id, document id, list name or player text is in any output; the export is scanned for every id it read, and for account-shaped tokens, before and after it is written (0 and 0).

## 1. Step 1 — the window and the reproduction check

**In plain terms.** The count looks back over the last 120 trading days. Before counting anything, it replayed every record the daily sweep has stored, using fresh bars, and got the same answer on all 456. So the replay is the store's count, not a lookalike.

- **Window:** 120 completed sessions, **29 May 2026 → 17 Nov 2026** (the last completed session at the run; the calendar of record, `api/_utils/marketSchedule.js`). History fetched from 20 Dec 2025, so every session has the store's 130-calendar-day request window (`acquire.js:43`, `:56`) and more than the 55 bars the evaluator needs.
- **Local bars considered first:** the only daily bars on this machine are the 28 Oct tf-setup replay runs (`%USERPROFILE%/tf-setup-replay-runs`, 29 symbols). They end before the window does, so every series was fetched.
- **The replay, through the store's own code (VERIFIED):** `storeReplay.mjs` calls the store's `acquireOnce` (`api/_utils/setupEvidence/acquire.js:95`): its request window, `mapDailyRows`, the date-defect refusal, `attachAdjustedClose`, `buildDailyEvidence` with `MIN_COMPLETED_BARS`, `evaluateTfEntry`, in that order. Then `classifyEvidence` (`classify.js:68`) gives the disposition, the split refusal included. Only the provider is replaced, by a slice of the symbol's one long series answering the store's own `{ from, to, order: 'd' }` request. The clock is the instant that series was received, never an invented one. `getOrAcquireSnapshot` and every `store.js` function stay unimported.
- **Records compared: 456. Matching: 456.** That is every stored `setupEvidence` record (all inside the window, all under `tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1`, all written by the sweep, all `evidenceClass.bars = contemporaneous`): 228 for 16 Nov and 228 for 17 Nov. Fields compared: `verdict`, `reason`, `pattern`, `patternsSatisfied`. MEASURED.
- **Provider revisions, shown although no verdict changed.** The facts under the verdict differ on 259 of the 456 records (V on 256, V_avg 90, ATR 65, a handful of SMAs and swing extremes, C on 1). Bar by bar, 1,250 of the 24,970 bars the records stored differ from the same bars served at the run:

| Field | Bars differing | Size of change |
|---|---|---|
| volume | 1,232 | median 0.01%, 90th percentile 0.15%, largest 34% (a session's own bar) |
| high / low / open | 187 / 187 / 165 | at most 0.085% (preliminary prices replaced by final ones, e.g. 80.4883 → 80.51) |
| close | 12 | at most 0.007% |
| adjusted close | 71 | at most 0.51% (a dividend adjustment applied after capture) |

Of the differing bars, 1,191 sit in the 16 Nov records (captured 12:30 UTC on 17 Nov) and 59 in the 17 Nov records (captured 22:30 UTC); 722 are six or more sessions old. The provider revises old bars, not only the newest one. No verdict moved on these 456, so the check passes; the limit this sets on older sessions is in §8.

**Two evidence classes.** Every figure below is labelled **reconstructed** (the replay over bars fetched on the run day) or **contemporaneous** (the sweep's stored records). The sweep covers two sessions, both completely (`setupEvidenceSweepState`: 228 provider requests each; 16 Nov in 1 run, finished 12:31 UTC 17 Nov; 17 Nov in 2 runs, finished 22:31 UTC). From stored records alone:

| Session (contemporaneous) | Valid | of which pullback | breakout | Invalid · regime | · no setup | · extended | Refused | Distinct sectors | Uptrend | SPY |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 Nov | 14 | 14 | 0 | 140 | 72 | 1 | 1 (CTVA, spin-off 1 Oct) | 6 | 87 | downtrend |
| 17 Nov | 12 | 12 | 0 | 157 | 57 | 1 | 1 (CTVA) | 7 | 70 | downtrend |

## 2. The window's market (SPY)

SPY under the same regime test (`deriveRegime`, `tfSetupV1.js:259`): uptrend on 56 sessions, no trend on 55, downtrend on 9 (2 Nov onward: close below a 20-day average below a falling 50-day average, e.g. 17 Nov C 732.44 < 755.86 < 763.15, the 50-day 765.00 five sessions earlier). MEASURED.

## 3. Step 2 — the universe, per session (reconstructed)

**In plain terms.** Most mornings, about one ranked stock in twelve is in a setup, and nearly every one is a pullback to its 20-day average in a stock that is trending up. Breakouts barely appear. Setups are short-lived but almost always still buyable at the next open.

| Class (of 228, per session) | Median | Total over 120 sessions |
|---|---|---|
| Valid · pullback only | 18 | 2,299 |
| Valid · breakout only | 0 | 5 |
| Both patterns satisfied (named breakout by the rule) | 0 | 26 |
| Invalid · regime (not an uptrend) | 161 | 19,623 |
| Invalid · no setup | 40.5 | 4,870 |
| Invalid · extended | 1 | 271 (breakout 112, pullback 113, both 46) |
| Unknown, by what is missing | 0 | 0 (no fact was missing on any record) |
| Refused · `basis_discontinuity` (a split inside the window) | 2 | 266: six stocks, each refused while the event sits in its 55-bar window (CRWD, DD, FDX, KLAC 54 sessions each; CTVA 34; BKNG 16) |

Every record's disposition under the store's classifier is `final` (27,360 of 27,360; adjustment metadata present on all).

| Valid names per session | Median | 10th pct | 90th pct | Min | Max | Sessions < 7 | Sessions < 3 |
|---|---|---|---|---|---|---|---|
| Both patterns together | 18 | 10 | 29 | 4 | 45 | 2.5% | 0% |
| Breakout satisfied (incl. both) | 0 | 0 | 1 | 0 | 3 | 100% | 99.2% |
| Pullback satisfied (incl. both) | 18 | 10 | 29 | 4 | 45 | 3.3% | 0% |

- **Distinct sectors among valid names:** median 8 of 11.
- **Share of the universe in an uptrend (regime test alone):** median 28.3%.
- **Persistence:** 1,015 runs of consecutive valid sessions; 32 touch an end of the window and are censored. Of the 983 closed runs: 1 session 423 (43%), 2 sessions 188, 3 sessions 211, 4–5 sessions 116, 6–10 sessions 43, 11+ sessions 2. Median 2, mean 2.31; 37.8% last three sessions or more.
- **Still enterable at the next open** — *approximate: the open price against the record's own limit, not a new verdict.* For each name valid at a close, the next session's raw open (EODHD `open`) against the record's own extension limit (its `extension` check's `rhs`, `tfSetupV1.js:252`). 2,318 valid names (12 on 17 Nov excluded: no next open yet; 0 straddling a split): **2,249 enterable, 97.0%**. Pullback 97.4% (2,227 of 2,287), both 73.1% (19 of 26), breakout only 3 of 5. Contemporaneous: the 14 names valid on 16 Nov, against their stored limits and the 17 Nov open, 14 of 14.

**By market state (SPY regime), reconstructed:**

| SPY | Sessions | Valid median | 10th–90th | Min | Sessions < 7 | < 3 | Sectors median | Uptrend share |
|---|---|---|---|---|---|---|---|---|
| uptrend | 56 | 21 | 12–28 | 7 | 0% | 0% | 9 | 30.3% |
| no trend | 55 | 17 | 8–31 | 4 | 5.5% | 0% | 7 | 25.0% |
| downtrend | 9 | 20 | 12–36 | 12 | 0% | 0% | 8 | 38.6% |

**Weekly (median valid names), reconstructed.** Setups cluster: a July–August high, a late-September to October trough, a November rebound.

| Week of | Sessions | Median | Range | SPY | | Week of | Sessions | Median | Range | SPY |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 May | 1 | 20 | 20 | up | | 31 Aug | 5 | 25 | 20–31 | none/up |
| 1 Jun | 5 | 24 | 18–27 | up/none | | 7 Sep | 4 | 16 | 12–19 | none |
| 8 Jun | 5 | 24 | 17–36 | none | | 14 Sep | 5 | 18 | 13–29 | none |
| 15 Jun | 4 | 15 | 11–24 | up/none | | 21 Sep | 5 | 12 | 9–15 | up |
| 22 Jun | 5 | 19 | 15–26 | none | | 28 Sep | 5 | 11 | 9–14 | up/none |
| 29 Jun | 4 | 23.5 | 16–27 | none/up | | 5 Oct | 5 | 15 | 14–18 | up |
| 6 Jul | 5 | 18 | 16–28 | up | | 12 Oct | 5 | 10 | 5–12 | up/none |
| 13 Jul | 5 | 28 | 13–37 | up/none | | 19 Oct | 5 | 8 | 4–10 | none |
| 20 Jul | 5 | 25 | 18–35 | none/up | | 26 Oct | 5 | 11 | 8–14 | none |
| 27 Jul | 5 | 31 | 17–45 | none | | 2 Nov | 5 | 14 | 7–17 | none/down |
| 3 Aug | 5 | 26 | 22–35 | up | | 9 Nov | 5 | 25 | 20–36 | down |
| 10 Aug | 5 | 24 | 23–26 | up | | 16 Nov | 2 | 13 | 12–14 | down |
| 17 Aug | 5 | 26 | 12–37 | up | | | | | | |
| 24 Aug | 5 | 17 | 15–23 | none/up | | | | | | |

## 4. Step 3 — the lists an agent actually picks from (reconstructed)

**In plain terms.** An agent does not choose from all 228. Its battle list is about ten stocks, and on the morning before the battle typically one of them was in a setup; nearly half the lists had none. Players' equipped watchlists are smaller still. *The battle lists were ranked by today's rules, which trader v1 will change.*

**The fields (VERIFIED).** The starting book is `agentContext.initialPortfolio` (star, core, support), frozen at creation (`agentBattleService.js:256`). No creation-time bench is stored: `portfolio.bench` (`agentBattleService.js:170`) is a revolving door that every swap rewrites (`agentSwapExecution.js:458–504`; the corrected route the same way, `stockThresholdAdmission.js:280–282`). So the bench at creation is **reconstructed**: a name on today's bench that no swap touched was there from the start; a name first swapped in was taken from the bench unless it was also on the battle's `watchlist.hotBench`, in which case it is ambiguous and left out (9 names). 14 battles have no swaps (exact), 26 have complete trade histories (`trades.length` = `scoreState.tradeCount`), none was truncated by the 50-trade cap, and the inverse met no anomaly. Crypto (the support and bench crypto, 2 per battle) is excluded and counted apart. Each list is evaluated at `lastCompletedSessionAt(createdAt)`, the completed session before the list was used.

**Battle lists:** 184 battles created since 15 Sep 2026 (string `createdAt`; a Timestamp query found 0); 144 are League (103 of them CPU) and are excluded; **40 non-League** (`baggerbomb_agent`). List size 9–13 (median 10).

| Measure | Value |
|---|---|
| Valid names per battle | median **1**; 45% of battles had 0 |
| Battles with fewer than 7 valid / fewer than 3 | **100% / 85%** |
| Valid share of the list | median 8.3% (the universe at the same sessions: 5.5%) |
| Unknown names | median 0; 7 in all, every one a split refusal |
| Distinct sectors among the valid | median 1 |
| By archetype (battles, median valid) | Trend Follower 17, 1 · Diversifier 8, 1.5 · Contrarian 7, 1 · Fundamental Investor 4, 0 · Speculator 3, 1 · Capital Preserver 1, 0 |

<details><summary>Per battle (40 rows)</summary>

| Battle | Owner | Archetype | Session | Size | Valid | Unknown | Sectors (valid) | Bench |
|---|---|---|---|---|---|---|---|---|
| battle-005 | owner-01 | Diversifier | 14 Sep | 11 | 3 | 1 | 2 | reconstructed |
| battle-006 | founder | Trend Follower | 15 Sep | 11 | 3 | 1 | 1 | reconstructed |
| battle-007 | founder | Trend Follower | 17 Sep | 11 | 1 | 1 | 1 | reconstructed |
| battle-008 | founder | Contrarian | 18 Sep | 10 | 1 | 0 | 1 | reconstructed |
| battle-009 | founder | Trend Follower | 21 Sep | 10 | 3 | 0 | 2 | reconstructed |
| battle-010 | founder | Trend Follower | 22 Sep | 11 | 2 | 0 | 1 | reconstructed |
| battle-023 | owner-01 | Contrarian | 28 Sep | 9 | 2 | 0 | 1 | exact |
| battle-032 | owner-01 | Contrarian | 28 Sep | 11 | 3 | 0 | 1 | reconstructed |
| battle-033 | founder | Trend Follower | 28 Sep | 9 | 1 | 0 | 1 | exact |
| battle-054 | founder | Trend Follower | 2 Oct | 9 | 2 | 0 | 1 | exact |
| battle-067 | FT_QA | Diversifier | 5 Oct | 9 | 3 | 0 | 2 | exact |
| battle-080 | founder | Trend Follower | 5 Oct | 10 | 2 | 0 | 1 | reconstructed |
| battle-081 | FT_QA | Diversifier | 5 Oct | 9 | 2 | 1 | 1 | reconstructed |
| battle-094 | founder | Trend Follower | 6 Oct | 9 | 3 | 0 | 2 | exact |
| battle-095 | FT_QA | Diversifier | 6 Oct | 10 | 2 | 1 | 2 | reconstructed |
| battle-120 | founder | Trend Follower | 8 Oct | 10 | 0 | 1 | 0 | reconstructed |
| battle-121 | founder | Trend Follower | 9 Oct | 9 | 0 | 0 | 0 | exact |
| battle-122 | FT_QA | Diversifier | 9 Oct | 9 | 0 | 0 | 0 | exact |
| battle-123 | founder | Trend Follower | 12 Oct | 9 | 0 | 1 | 0 | exact |
| battle-124 | founder | Trend Follower | 13 Oct | 9 | 0 | 0 | 0 | exact |
| battle-125 | FT_QA | Diversifier | 13 Oct | 9 | 1 | 0 | 1 | reconstructed |
| battle-126 | founder | Diversifier | 14 Oct | 9 | 0 | 0 | 0 | exact |
| battle-127 | founder | Fundamental Investor | 15 Oct | 10 | 0 | 0 | 0 | reconstructed |
| battle-128 | owner-01 | Speculator | 16 Oct | 11 | 0 | 0 | 0 | reconstructed |
| battle-133 | founder | Fundamental Investor | 16 Oct | 11 | 0 | 0 | 0 | reconstructed |
| battle-138 | FT_QA | Trend Follower | 19 Oct | 9 | 0 | 0 | 0 | exact |
| battle-143 | founder | Fundamental Investor | 20 Oct | 10 | 0 | 0 | 0 | reconstructed |
| battle-144 | owner-01 | Speculator | 21 Oct | 9 | 2 | 0 | 2 | exact |
| battle-149 | founder | Fundamental Investor | 21 Oct | 13 | 1 | 0 | 1 | reconstructed |
| battle-154 | founder | Trend Follower | 22 Oct | 9 | 0 | 0 | 0 | reconstructed |
| battle-155 | FT_QA | Trend Follower | 22 Oct | 11 | 0 | 0 | 0 | reconstructed |
| battle-168 | founder | Contrarian | 28 Oct | 11 | 2 | 0 | 2 | reconstructed |
| battle-177 | FT_QA | Trend Follower | 29 Oct | 9 | 1 | 0 | 1 | reconstructed |
| battle-178 | founder | Trend Follower | 30 Oct | 12 | 0 | 0 | 0 | reconstructed |
| battle-179 | founder | Diversifier | 6 Nov | 10 | 0 | 0 | 0 | reconstructed |
| battle-180 | founder | Contrarian | 9 Nov | 12 | 1 | 0 | 1 | reconstructed |
| battle-181 | founder | Speculator | 11 Nov | 12 | 1 | 0 | 1 | reconstructed |
| battle-182 | founder | Capital Preserver | 12 Nov | 9 | 0 | 0 | 0 | exact |
| battle-183 | founder | Contrarian | 13 Nov | 12 | 0 | 0 | 0 | reconstructed |
| battle-184 | founder | Contrarian | 16 Nov | 9 | 0 | 0 | 0 | exact |

Ordinals number all 184 battles since 15 Sep in creation order, so the non-League ones have gaps. Statuses: 39 completed, 1 active.
</details>

**Equipped lists.** 104 agents, 22 human (CPU agents carry `isCpu` and a `cpu-` owner, `tournamentCpu.js:61`); both loadouts read (`leagueLoadoutOf`, `baggerbombLoadoutOf`, `src/constants/perGameLoadout.js:59`, `:83`): **8 distinct lists**, all committed, none deleted. Names only. Each evaluated at all 120 sessions.

| List | Owner | Loadouts | Names | Median valid | Most valid | Sessions < 7 | Sessions with 0 |
|---|---|---|---|---|---|---|---|
| list-01 | owner-01 | both | 11 | 1 | 5 | 100% | 36.7% |
| list-02 | owner-01 | both | 9 (1 off the universe) | 0 | 4 | 100% | 55.0% |
| list-03 | founder | both | 5 | 0 | 2 | 100% | 59.2% |
| list-04 | founder | League | 10 | 0 | 5 | 100% | 57.5% |
| list-05 | founder | both | 10 | 1 | 5 | 100% | 44.2% |
| list-06 | FT_QA | both | 3 | 0 | 2 | 100% | 74.2% |
| list-07 | owner-25 | both | 3 | 0 | 1 | 100% | 65.0% |
| list-08 | owner-26 | both | 3 | 0 | 2 | 100% | 61.7% |

## 5. Step 4 — the archetype overlays (reconstructed; today's scores applied to past sessions, approximate)

**In plain terms.** Each archetype's deploy step already narrows its shortlist. Narrowed that way, the valid names drop to a handful: six for the Trend Follower, four for the Speculator, one for the Capital Preserver, none for the Fundamental Investor. Only the Trend Follower's filter changes from day to day here; the others use today's scores for every past day.

**The constraints, as the code states them** (`ARCHETYPE_CONSTRAINTS`, `api/_utils/archetypeScoring.js:81`; prompt text for the deploy model, read as text; display names `src/data/archetypeDisplay.js:19–24`):

| Archetype | Constraint (line) | Overlay applied |
|---|---|---|
| Trend Follower | "top 3 performing sectors … Avoid sectors down more than 1% today" (`:83`) | valid names in the session's top 3 sectors, any down more than 1% dropped |
| Speculator | "ATR percentile above 0.80" (`:89`) | `atrPercentile > 0.80` (45 of 228 today) |
| Fundamental Investor | "fundamentalScore above 70 … below 40" (`:91`) | `fundamentalScore > 70` (**2 of 228 today**) |
| Capital Preserver | "fundamentalScore above 60 … ATR percentile above 0.75" (`:93`) | `fundamentalScore > 60` and `atrPercentile ≤ 0.75` (16 of 228 today) |
| Diversifier | "at least 7 different sectors" (`:87`) | distinct sectors among valid names |

- **Scores:** `indexIntelligence/stockRankings`, the one document the deploy step reads (`api/agent/decide.js:344`), computed 20:01 UTC on 17 Nov (intraday run), 228 of 228 matched. **No dated snapshot exists** (`rankingSnapshots` holds 0 documents; its ops toggle `ops/rankingSnapshots`, `rankingSnapshots.js:6`), so every past session uses today's scores.
- **"Today's top 3 performing sectors" has no code behind it:** the model reads it off its prompt. This count stands in **the three sector funds** (XLK … XLC, the universe's own grouping, `rankingConfig.js` `STOCK_UNIVERSE`) with the highest one-day move at the session. Founder question 3.

| Overlay | Median | 10th–90th | Max | Sessions < 7 | Sessions < 3 |
|---|---|---|---|---|---|
| Trend Follower | 6 | 2–12 | 18 | 54.2% | 11.7% |
| Speculator | 4 | 1–7 | 11 | 86.7% | 33.3% |
| Fundamental Investor | 0 | 0–1 | 1 | 100% | 100% |
| Capital Preserver | 1 | 0–3 | 5 | 100% | 86.7% |
| Diversifier (distinct sectors) | 8 | 5–10 | 11 (min 3) | 7 or more on 69.2% | |

The Contrarian is not overlaid: neither detector is in its subset.

## 6. Step 5 — the compression precondition (reconstructed; precondition only)

A compression state is not a Compression Breakout, which has no detector. Same bars, completed sessions, the repository's own functions as the rankings producer calls them: `calculateNR7(highs, lows)` (`technicalCalculations.js:422`, called at `compute-index-intelligence.js:997`) and `calculateBollingerBands(closes, 20, 2)` (`:247`, called at `:1000`), the bandwidth ranked across the universe as at `compute-index-intelligence.js:1293` (that ranking is inline code, not a function, so it is restated), and the alarm level `bBandwidthPercentile <= 20` (`agentTriggerGate.js:165`).

- **Narrow-range (NR7) names per session:** median 33.5 (10th–90th 12–58; 1 to 94).
- **Band-width squeeze names per session:** **47 every session**, by construction: the alarm is a percentile of the day's own universe, so it always flags the narrowest fifth (surprise 2).

## 7. Requests and production reads

- **EODHD: 241 requests of the 400 cap, 0 failed** (MEASURED, `requests.json`; each place written to disk before its request). One long daily series per symbol, 20 Dec 2025 → 17 Nov 2026, 228 rows each, through the store's own `fetchDailyPayload`, at 00:10 UTC 18 Nov (7:10 PM ET, outside market hours). Symbols: the 228, SPY, the 11 sector funds, and 1 name from a list. The fetch script refuses to run inside a session's hours and refuses a plan above the cap.
- **Production (read only, MEASURED), each read field-masked through a restricted reader** (`exportProduction.mjs`, which passed the write-verb grep; 13 planted write forms were each caught by it): `setupEvidence` count 456 and 456 records; `setupEvidenceSweepState` 2; `agentBattles` count 646, a 5-document type probe, 184 by the string query, 0 by the Timestamp query; `agents` 104; `watchlists` 8 (tickers, `deletedAt`, `status` only); `indexIntelligence/stockRankings` 1; `rankingSnapshots` 0. The export ran twice (00:09:05 and 00:09:50 UTC); the first missed the rankings document, which lives in `indexIntelligence`, not a `stockRankings` collection. The second is the frozen read; the records were the same 456.
- **Credentials** parsed in place from the main checkout's `.env.local`, never printed or copied. **No model call.**

## 8. Limits of the count

- **Reconstruction.** Every figure before 16 Nov comes from bars fetched on 17 Nov. The provider revises bars for days, old ones included (§1); a revision moved no verdict on the 456 records that could be checked, but a boundary case on an older session could read differently from what the sweep would have said then.
- **Two contemporaneous days.** The sweep started on 16 Nov; both of its days are SPY-downtrend days.
- **Today's scores.** Every overlay but the Trend Follower's uses one set of scores for all 120 sessions. A name's fundamental score or volatility rank in June is not today's.
- **The sector stand-in.** The Trend Follower overlay rests on a chosen definition of "top sectors" (§5).
- **The window's market.** 120 sessions, one summer and one autumn, with no prolonged downtrend (9 sessions). A long bear market is not in it.
- **The battle bench.** 26 of 40 benches are reconstructed from swaps; 9 ambiguous names are left out, so a list can be a name or two short.
- **Universe only.** Off-universe names entered only through the lists (one stock).

## 9. Surprises

1. **Trend Breakout is almost never valid.** 31 breakout-valid records in 27,360 (5 breakout only, 26 both); median 0 a morning, at most 3. Of the 189 breakouts found in uptrending names, 158 failed the extension limit (C ≤ SMA20 + 2 × ATR, `tfSetupV1.js:252`). A close at a 20-day high on heavy volume is usually already more than two ATRs above its 20-day average.
2. **The squeeze alarm cannot vary.** It flags exactly 47 of 228 every day, so as a market signal it carries no information about how compressed the market is.
3. **The Fundamental Investor's own constraint cannot be met.** It asks for at least 5 stocks scoring above 70; today 2 of 228 do (median 50, top 81).
4. **The provider revises old bars within hours**: 722 of the 1,250 revised bars were six or more sessions old.
5. **Setups did not dry up when the market fell.** In SPY's nine downtrend sessions the median was 20, as many as in its uptrend.
6. **Agent lists are the bottleneck, not setups.** The universe has 18 valid names on a typical morning, but a battle list of about ten holds 1, and its valid names fall in a single sector.

## 10. Founder questions (only where a number forces a choice)

1. **Trend Breakout.** Under `tf-setup-v1` it qualifies on 0 names on a typical morning, because 84% of breakouts are blocked by the extension limit. Should Trend Breakout keep the same extension limit as Pullback and Resume (and so be rarely available), or get its own limit (a new `SETUP_VERSION`, a founder PR)?
2. **What an agent chooses from.** A match opens seven positions. The universe offers 18 valid names a morning, but a battle list offers 1, and 45% of lists offer none. Should trader v1's list be built from valid setups (or include them), or should most entries be allowed to carry "no setup"?
3. **"Today's top sectors."** No code defines it. Is the stand-in used here (the three sector funds with the best one-day move) the definition you want the Trend Follower's setups filtered by, or a different one (for example a multi-day move)?
4. **The Fundamental Investor.** With either detector it would have 0 names on every morning, because its score bar admits 2 stocks today. Should it keep a setup detector at all, or should its constraint change (a fenced file)?

## 11. Files

| File | What it does |
|---|---|
| `scripts/experiments/setup-frequency/lib.mjs` | The window, the run folder (refused inside the repository), the write-verb grep, statistics |
| `scripts/experiments/setup-frequency/storeReplay.mjs` | The store's `acquireOnce` + `classifyEvidence` on a local slice (listed in the import guard) |
| `scripts/experiments/setup-frequency/exportProduction.mjs` | The read-only export; ids scrubbed at read time (listed in the import guard) |
| `scripts/experiments/setup-frequency/fetchBars.mjs` | The plan, the cap, one long series per symbol |
| `scripts/experiments/setup-frequency/replay.mjs` | Every symbol × session; the compression inputs; the reproduction check |
| `scripts/experiments/setup-frequency/analyze.mjs` | Steps 2–5; asserts the cited constraint text on its lines |
| `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` | +2 listings (the prompt's one sanctioned test edit) |

**Re-running** (repo root; the run folder defaults to `C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117`): `exportProduction.mjs` → `fetchBars.mjs --plan-only` → `fetchBars.mjs` → `replay.mjs` (about 19 minutes) → `analyze.mjs`. The last two are offline and deterministic once the export and the bars exist.
