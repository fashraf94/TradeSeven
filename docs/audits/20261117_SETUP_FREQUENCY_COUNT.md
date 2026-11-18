# Setup frequency count — tf-setup-v1 across the universe and real lists (read-only)

**Date:** Tuesday 17 Nov 2026 (the run began 7:09 PM ET, after the close) · **Run by:** Claude Code (Opus), local session · **Prompt:** *Experiment prompt — how often the two setups occur (read-only count)*, V1.1 (Fable, architecture review chat, 17 Nov 2026) · **Branch:** `claude/setup-frequency-count`, cut from `origin/main` at `abcdfcb7` · **Scripts:** `scripts/experiments/setup-frequency/` · **Out-of-tree copy:** `C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/20261117_SETUP_FREQUENCY_COUNT.md` (BUILD_RULES §3).

This count says how many names are in a valid setup. It does not say whether a setup makes money: no outcome, return or points figure appears below. The one price move it uses is the sector funds' one-day change, needed to name "today's top sectors" (§4).

## How often the setups occur, in plain terms

- **On a typical morning, 18 of the 228 ranked stocks are in a valid setup** (10 on a thin morning, 29 on a busy one; never fewer than 4). Fewer than seven on 3 of 120 mornings, fewer than three on none. *Reconstructed.*
- **Almost all of them are Pullback and Resume.** Trend Breakout qualifies on a median of 0 names a morning and never more than 3. The extension limit is why: 84% of the breakouts the pattern finds are "too far above the average" (surprise 1).
- **The market's own trend barely changes the count:** 21 when SPY is in an uptrend (56 mornings), 17 when it has no trend (55), 20 in its downtrend (9 mornings, all in November). *Reconstructed.*
- **On a list an agent actually picks from, it is 1.** Every battle list holds 9 stocks; the median list had 1 valid name, every one of the 40 had fewer than seven, about 45% had none. The 8 equipped watchlists show 0 or 1 on a typical day and never seven. *Reconstructed.*
- **A valid setup lasts 2 sessions at the median:** 43% last one session, 38% last three or more. **97% are still enterable at the next open** (approximate: the open price against the record's own limit, not a new verdict).
- **Archetype overlays** (today's scores applied to past sessions, approximate): Trend Follower 6 a morning (fewer than seven on 54% of mornings), Speculator 4, Capital Preserver 1, Fundamental Investor 0 (only 2 stocks pass its score bar today). The Diversifier's valid names span 8 sectors at the median, 7 or more on 69% of mornings.
- **The replay reproduces the store exactly:** all 456 records the sweep wrote (16 and 17 Nov) give the same verdict, reason, pattern and patterns satisfied. On those two days the stored records alone say 14 and 12 valid. *Contemporaneous.*
- **The provider revised its data within hours** of the sweep reading it (1,250 of 24,970 stored bars, mostly volume). No verdict changed, but every figure before 16 Nov rests on bars as served on the run day.

| Item | Verdict |
|---|---|
| Reproduction check (§1) | **456 of 456 match.** No STOP. Later provider revisions moved underlying facts on 259 records; no verdict moved. |
| Universe (§2) | Median 18 valid of 228; fewer than 7 on 2.5% of sessions; Pullback and Resume carries the count. |
| Agent lists (§3) | Median 1 valid per battle list of 9; 100% of battles below seven. A list-size limit as much as a setup limit. |
| Overlays (§4) | Below seven on most mornings for every overlaid archetype; Fundamental Investor 0. |
| Requests | **241 EODHD requests** of the 400 cap; 0 failed. No model call. |
| Production | Read only (`count`, field-masked `select().get()`, one batched `getAll`). No write. |

## Preamble

**In plain terms.** This section says what the session started from, what it changed and what it touched. It changed nothing in the product: six new scripts, this report, and two lines in one test's allowlist that the prompt sanctions.

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. Its first attempt failed on a DNS error (`getaddrinfo`); the retry succeeded with nothing compared before it. `origin/main` = `abcdfcb7`. Branch `claude/setup-frequency-count` cut from it, HEAD `abcdfcb7`, tree clean. Before the push `main` had moved to `2e069d42` (#1086, Shared Research B4: no file this count imports, the guard and the lockfile untouched); it was merged in, and the final checks ran on the merged tree.
- **New files only:** six scripts and this report. **One test edit**, the prompt's rule 2: `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` lists `storeReplay.mjs` and `exportProduction.mjs` by exact filename, in the same commit as the scripts. They are the only two files that name the store. No evaluator, threshold, golden, store, sweep, flag, rule or fenced file changed.
- **A reading for the founder (R-1):** the rule's exception speaks of a script that *imports* a store module. `storeReplay.mjs` does. `exportProduction.mjs` imports none; it is listed because it *reads* the store's collection by name, which the reproduction check needs and which the guard also counts. Listed under the exception's intent; say if it should have been a STOP.
- **Fenced functions:** none called, none edited. `api/_utils/archetypeScoring.js` (§1-fenced) is **read as text**, never imported: `analyze.mjs` asserts each cited constraint is still on its line.
- **Markers.** Every `file:line` here is VERIFIED: read at `abcdfcb7` in this session. MEASURED marks a production read or provider fetch made in this session.
- **Owners** are "founder", "FT_QA" (the two uids read in memory from the archived week-1 dump, never written) or an ordinal (`owner-NN`, in the order the export met them). Battles and lists are ordinals. No account id, document id, list name or player text is in any output; the export is scanned for every id it read, and for account-shaped tokens, before and after it is written (0 and 0).

## 1. Step 1 — the window and the reproduction check

**In plain terms.** The count looks back over the last 120 trading days. Before counting anything, it replayed every record the daily sweep has stored, from freshly fetched bars, and got the same answer on all 456. So the replay is the store's count, not a lookalike.

- **Window:** 120 completed sessions, **29 May 2026 → 17 Nov 2026** (the last completed session at the run; the calendar of record, `api/_utils/marketSchedule.js`). History fetched from 20 Dec 2025, so every session has the store's 130-calendar-day request window (`acquire.js:43`, `:56`) and more than the 55 bars the evaluator needs.
- **Local bars considered first:** the 3-day threshold experiment's inputs were not found on this machine; the October exports and the 28 Oct tf-setup replay runs (29 symbols) end before November. So every series was fetched.
- **The replay, through the store's own pure functions** (`storeReplay.mjs`). No acquire path is called: neither `getOrAcquireSnapshot` nor `acquireOnce`. The chain is the one `acquireOnce` runs (`acquire.js:95–130`), then the one `getOrAcquireSnapshot` classifies with (`index.js:70`), in order:
  1. `requestWindowOf` (`acquire.js:56`)
  2. `mapDailyRows` (`marketDataCache.js:317`), newest first
  3. `attachAdjustedClose`, then `buildDailyEvidence` with `MIN_COMPLETED_BARS` (`dailyBarsAdapter.js:116`, `:139`)
  4. `evaluateTfEntry` (`tfSetupV1.js:360`)
  5. `classifyEvidence` (`classify.js:68`): the disposition, the split refusal included.

  Only the provider is replaced, by a slice of the symbol's one long series. **The clock is injected per session** (the session's own close), and the bars class is stated as `later_reconstruction`. `acquireOnce`'s one unexported step, refusing a payload whose mapper dropped a malformed row, is not copied. Instead, every slice's drop count is kept: **0 rows dropped** in 28,920 slices.
- **A cross-check:** a first replay of the same data went through `acquireOnce` itself. All **28,920 of 28,920** symbol-sessions give identical verdict fields, regimes, refusals, dispositions and extension limits on both routes.
- **Records compared: 456. Matching: 456.** That is every stored `setupEvidence` record: all inside the window, all under `tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1`, all written by the sweep, all `evidenceClass.bars = contemporaneous`. 228 are for 16 Nov and 228 for 17 Nov. Fields compared: `verdict`, `reason`, `pattern`, `patternsSatisfied`. MEASURED.
- **Provider revisions, shown although no verdict changed.** The facts under the verdict differ on 259 of the 456 records (V on 256, V_avg 90, ATR 65, a handful of averages and swing extremes, C on 1). Bar by bar, 1,250 of the 24,970 bars the records stored differ from the same bars served at the run:

| Field | Bars differing | Size of change |
|---|---|---|
| volume | 1,232 | median 0.01%, 90th percentile 0.15%, largest 34% (a session's own bar) |
| high / low / open | 187 / 187 / 165 | at most 0.085% (preliminary prices replaced by final ones, e.g. 80.4883 → 80.51) |
| close | 12 | at most 0.007% |
| adjusted close | 71 | at most 0.51% (a dividend adjustment applied after capture) |

1,191 of the differing bars sit in the 16 Nov records (captured 12:30 UTC on 17 Nov) and 59 in the 17 Nov records (captured 22:30 UTC); 722 are six or more sessions old. The provider revises old bars, not only the newest one. No verdict moved on these 456, so the check passes; the limit this sets on older sessions is in §6.

**Two evidence classes.** Every figure below is labelled **reconstructed** (the replay over bars fetched on the run day) or **contemporaneous** (the sweep's stored records). The sweep covers two sessions, both completely (`setupEvidenceSweepState`: 228 provider requests each; 16 Nov in 1 run, finished 12:31 UTC on 17 Nov; 17 Nov in 2 runs, finished 22:31 UTC). From stored records alone:

| Session (contemporaneous) | Valid | of which pullback | breakout | Invalid · regime | · no setup | · extended | Refused | Distinct sectors | Uptrend | SPY |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 Nov | 14 | 14 | 0 | 140 | 72 | 1 | 1 (CTVA, spin-off 1 Oct) | 6 | 87 | downtrend |
| 17 Nov | 12 | 12 | 0 | 157 | 57 | 1 | 1 (CTVA) | 7 | 70 | downtrend |

## 2. Step 2 — the universe, per session (reconstructed)

**In plain terms.** Most mornings, about one ranked stock in twelve is in a setup, and nearly every one is a pullback to its 20-day average in a stock that is trending up. Breakouts barely appear. Setups are short-lived but almost always still buyable at the next open, and none of this changes much with the market's direction.

| Class (of 228, per session) | Median | Total over 120 sessions |
|---|---|---|
| Valid · pullback only | 18 | 2,299 |
| Valid · breakout only | 0 | 5 |
| Both patterns satisfied (named breakout by the rule) | 0 | 26 |
| Invalid · regime (not an uptrend) | 161 | 19,623 |
| Invalid · no setup | 40.5 | 4,870 |
| Invalid · extended | 1 | 271 (breakout 112, pullback 113, both 46) |
| Unknown, by what is missing | 0 | 0 (no fact was missing on any record) |
| Refused · `basis_discontinuity` (a split inside the window) | 2 | 266 across six stocks, each refused while the event sits in its 55-bar window: CRWD, DD, FDX and KLAC 54 sessions each; CTVA 34; BKNG 16 |

Every record's disposition under the store's classifier is `final` (27,360 of 27,360).

| Valid names per session | Median | 10th pct | 90th pct | Min | Max | Sessions < 7 | Sessions < 3 |
|---|---|---|---|---|---|---|---|
| Both patterns together | 18 | 10 | 29 | 4 | 45 | 2.5% | 0% |
| Breakout satisfied (incl. both) | 0 | 0 | 1 | 0 | 3 | 100% | 99.2% |
| Pullback satisfied (incl. both) | 18 | 10 | 29 | 4 | 45 | 3.3% | 0% |

- **Distinct sectors among valid names:** median 8 of 11.
- **Share of the universe in an uptrend (regime test alone):** median 28.3%.
- **Persistence:** 1,015 runs of consecutive valid sessions; 32 touch an end of the window and are censored. Of the 983 closed runs:

  | Run length | 1 session | 2 | 3 | 4–5 | 6–10 | 11+ |
  |---|---|---|---|---|---|---|
  | Runs (share) | 423 (43%) | 188 | 211 | 116 | 43 | 2 |

  Median 2, mean 2.31; 37.8% last three sessions or more.
- **Still enterable at the next open.** *Approximate: the open price against the record's own limit, not a new verdict.* For each name valid at a close, the next session's raw open (EODHD `open`) is compared with the record's own extension limit (its `extension` check's `rhs`, `tfSetupV1.js:252`). 2,318 names qualify: 12 on 17 Nov are excluded (no next open yet), and none straddles a split. **2,249 are enterable, 97.0%.** By pattern: pullback 97.4% (2,227 of 2,287), both 73.1% (19 of 26), breakout only 3 of 5. Contemporaneous: the 14 names valid on 16 Nov, against their stored limits and the 17 Nov open, 14 of 14.

**By market state.** SPY under the same regime test (`deriveRegime`, `tfSetupV1.js:259`): uptrend on 56 sessions, no trend on 55, downtrend on 9 (every session from 5 Nov). On 17 Nov, for example, the close (732.44) is below the 20-day average (755.86), which is below the 50-day (763.15), and the 50-day was 765.00 five sessions earlier. MEASURED. Persistence is split by the regime of the session a run started; enterability by the regime of the valid session.

| SPY | Sessions | Valid median | 10th–90th | Min | < 7 | < 3 | Sectors | Uptrend share | Runs closed: median, 1 session, 3+ | Enterable next open |
|---|---|---|---|---|---|---|---|---|---|---|
| uptrend | 56 | 21 | 12–28 | 7 | 0% | 0% | 9 | 30.3% | 479: 2, 40.1%, 37.0% | 97.2% of 1,146 |
| no trend | 55 | 17 | 8–31 | 4 | 5.5% | 0% | 7 | 25.0% | 441: 2, 47.2%, 38.5% | 96.5% of 990 |
| downtrend | 9 | 20 | 12–36 | 12 | 0% | 0% | 8 | 38.6% | 63: 2, 36.5%, 39.7% | 98.9% of 182 |

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

## 3. Step 3 — the lists an agent actually picks from (reconstructed)

**In plain terms.** An agent does not choose from all 228. Its battle list is nine stocks, and on the session before the battle typically one of them was in a setup; nearly half the lists had none. Players' equipped watchlists are no better. *The battle lists were ranked by today's rules, which trader v1 will change.*

**The fields (VERIFIED).**
- **The starting book** is `agentContext.initialPortfolio` (star, core, support), frozen at creation (`agentBattleService.js:256`). It holds six stocks once the support crypto is set aside.
- **No creation-time bench is stored.** `portfolio.bench` (`agentBattleService.js:170`) is a revolving door: every swap rewrites it (`agentSwapExecution.js:458–504`; the corrected route the same way, `stockThresholdAdmission.js:280–282`). No trade records where its incoming name came from (`executorMetadata.js:34–43`).
- **The deploy step's bench is exactly three stocks** (`api/agent/decide.js:1173`). So the creation bench is recovered by counting:
  - a final-bench name that no swap touched was there from the start;
  - when those make three, the bench is **identified**, and any name swapped in came from elsewhere (the hot bench or a synthetic candidate);
  - when fewer, the open places were filled by names later swapped in. When more such names exist than places, the battle is **bounded**: its count is given as a range, lowest to highest.
- **Result:** 14 battles have no swaps (exact), 16 are identified, 10 are bounded, each by one name at most. No trade history was truncated by the 50-trade cap (`trades.length` = `scoreState.tradeCount` on all 40). Every list is 9 stocks; the support and bench crypto (2 per battle) are excluded.
- **When each list is read:** at the completed session before the battle's first trading day (`timing.tradingDays[0]`), never after the list was used. For 37 of 40 this is also the last completed session at creation. The other 3 (battle-023, -067, -144) were created after the close, for that same day's session; they are read at the session before it.

**Battle lists:** 184 battles were created since 15 Sep 2026 (`createdAt` is a string; a Timestamp query found 0). 144 are League (103 of them CPU) and are excluded, leaving **40 non-League** (`baggerbomb_agent`).

| Measure | 30 resolved battles (exact + identified) | All 40, lowest–highest |
|---|---|---|
| Valid names per battle (median) | **1** | 1–1 |
| Battles with 0 valid | 43.3% | 45.0–47.5% |
| Battles with fewer than 7 / fewer than 3 | **100% / 90.0%** | 100% / 87.5–92.5% |
| Valid share of the list (median) | 11.1% (the universe at the same sessions: 6.1%) | |
| Unknown names | median 0; 7 in all, every one a split refusal (CRWD, CTVA) | |
| Distinct sectors among the valid (median) | 1 | |

By archetype (battles; median valid, lowest–highest): Trend Follower 17, 0–1 · Diversifier 8, 1.5 · Contrarian 7, 1 · Fundamental Investor 4, 0 · Speculator 3, 1 · Capital Preserver 1, 0.

<details><summary>Per battle (40 rows)</summary>

| Battle | Owner | Archetype | Read at | Bench | Valid | Unknown | Sectors (valid) | Universe valid that session |
|---|---|---|---|---|---|---|---|---|
| battle-005 | owner-01 | Diversifier | 14 Sep | identified | 3 | 1 | 2 | 29 |
| battle-006 | founder | Trend Follower | 15 Sep | identified | 3 | 1 | 1 | 18 |
| battle-007 | founder | Trend Follower | 17 Sep | identified | 1 | 1 | 1 | 18 |
| battle-008 | founder | Contrarian | 18 Sep | identified | 1 | 0 | 1 | 13 |
| battle-009 | founder | Trend Follower | 21 Sep | bounded | 2–3 | 0 | — | 12 |
| battle-010 | founder | Trend Follower | 22 Sep | bounded | 0–1 | 0 | — | 15 |
| battle-023 | owner-01 | Contrarian | 25 Sep | exact | 2 | 0 | 1 | 14 |
| battle-032 | owner-01 | Contrarian | 28 Sep | bounded | 2–3 | 0 | — | 12 |
| battle-033 | founder | Trend Follower | 28 Sep | exact | 1 | 0 | 1 | 12 |
| battle-054 | founder | Trend Follower | 2 Oct | exact | 2 | 0 | 1 | 14 |
| battle-067 | FT_QA | Diversifier | 2 Oct | exact | 2 | 0 | 1 | 14 |
| battle-080 | founder | Trend Follower | 5 Oct | identified | 2 | 0 | 1 | 18 |
| battle-081 | FT_QA | Diversifier | 5 Oct | identified | 2 | 1 | 1 | 18 |
| battle-094 | founder | Trend Follower | 6 Oct | exact | 3 | 0 | 2 | 14 |
| battle-095 | FT_QA | Diversifier | 6 Oct | identified | 2 | 1 | 2 | 14 |
| battle-120 | founder | Trend Follower | 8 Oct | identified | 0 | 1 | 0 | 14 |
| battle-121 | founder | Trend Follower | 9 Oct | exact | 0 | 0 | 0 | 15 |
| battle-122 | FT_QA | Diversifier | 9 Oct | exact | 0 | 0 | 0 | 15 |
| battle-123 | founder | Trend Follower | 12 Oct | exact | 0 | 1 | 0 | 12 |
| battle-124 | founder | Trend Follower | 13 Oct | exact | 0 | 0 | 0 | 10 |
| battle-125 | FT_QA | Diversifier | 13 Oct | identified | 1 | 0 | 1 | 10 |
| battle-126 | founder | Diversifier | 14 Oct | exact | 0 | 0 | 0 | 10 |
| battle-127 | founder | Fundamental Investor | 15 Oct | bounded | 0 | 0 | — | 7 |
| battle-128 | owner-01 | Speculator | 16 Oct | identified | 0 | 0 | 0 | 5 |
| battle-133 | founder | Fundamental Investor | 16 Oct | bounded | 0 | 0 | — | 5 |
| battle-138 | FT_QA | Trend Follower | 19 Oct | exact | 0 | 0 | 0 | 4 |
| battle-143 | founder | Fundamental Investor | 20 Oct | bounded | 0 | 0 | — | 4 |
| battle-144 | owner-01 | Speculator | 20 Oct | exact | 1 | 0 | 1 | 4 |
| battle-149 | founder | Fundamental Investor | 21 Oct | identified | 1 | 0 | 1 | 10 |
| battle-154 | founder | Trend Follower | 22 Oct | bounded | 0 | 0 | — | 8 |
| battle-155 | FT_QA | Trend Follower | 22 Oct | identified | 0 | 0 | 0 | 8 |
| battle-168 | founder | Contrarian | 28 Oct | identified | 2 | 0 | 2 | 12 |
| battle-177 | FT_QA | Trend Follower | 29 Oct | identified | 1 | 0 | 1 | 11 |
| battle-178 | founder | Trend Follower | 30 Oct | identified | 0 | 0 | 0 | 11 |
| battle-179 | founder | Diversifier | 6 Nov | identified | 0 | 0 | 0 | 14 |
| battle-180 | founder | Contrarian | 9 Nov | bounded | 1 | 0 | — | 25 |
| battle-181 | founder | Speculator | 11 Nov | bounded | 1–2 | 0 | — | 36 |
| battle-182 | founder | Capital Preserver | 12 Nov | exact | 0 | 0 | 0 | 20 |
| battle-183 | founder | Contrarian | 13 Nov | bounded | 0 | 0 | — | 23 |
| battle-184 | founder | Contrarian | 16 Nov | exact | 0 | 0 | 0 | 14 |

Ordinals number all 184 battles since 15 Sep in creation order, so the non-League ones have gaps. Statuses: 39 completed, 1 active. A bounded battle's sectors are not given: which name fills its open place is unknown.
</details>

**Equipped lists.** 104 agents, 22 human (CPU agents carry `isCpu` and a `cpu-` owner, `tournamentCpu.js:61`). Both loadouts are read (`leagueLoadoutOf`, `baggerbombLoadoutOf`, `src/constants/perGameLoadout.js:59`, `:83`): **8 distinct lists**, all committed, none deleted. Names only. Each is evaluated at all 120 sessions.

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

## 4. Step 4 — the archetype overlays (reconstructed; today's scores applied to past sessions, approximate)

**In plain terms.** Each archetype's deploy step already narrows its shortlist. Narrowed that way, the valid names drop to a handful: six for the Trend Follower, four for the Speculator, one for the Capital Preserver, none for the Fundamental Investor. Only the Trend Follower's filter changes from day to day here; the others apply today's scores to every past day.

**The constraints, as the code states them.** `ARCHETYPE_CONSTRAINTS`, `api/_utils/archetypeScoring.js:81`: prompt text for the deploy model, read here as text. Display names: `src/data/archetypeDisplay.js:19–24`.

| Archetype | Constraint (line) | Overlay applied |
|---|---|---|
| Trend Follower | "top 3 performing sectors … Avoid sectors down more than 1% today" (`:83`) | valid names in the session's top 3 sectors, any down more than 1% dropped |
| Speculator | "ATR percentile above 0.80" (`:89`) | `atrPercentile > 0.80` (45 of 228 today) |
| Fundamental Investor | "fundamentalScore above 70 … below 40" (`:91`) | `fundamentalScore > 70` (**2 of 228 today**) |
| Capital Preserver | "fundamentalScore above 60 … ATR percentile above 0.75" (`:93`) | `fundamentalScore > 60` and `atrPercentile ≤ 0.75` (16 of 228 today) |
| Diversifier | "at least 7 different sectors" (`:87`) | distinct sectors among valid names |

- **Scores:** `indexIntelligence/stockRankings`, the one document the deploy step reads (`api/agent/decide.js:344`), computed 20:01 UTC on 17 Nov (an intraday run); all 228 matched. **No dated snapshot exists:** `rankingSnapshots` holds 0 documents (its ops toggle is `ops/rankingSnapshots`, `rankingSnapshots.js:6`), so every past session uses today's scores.
- **"Today's top 3 performing sectors" has no code behind it:** the model reads it off its prompt. This count stands in **the three sector funds** (XLK … XLC, the universe's own grouping, `rankingConfig.js` `STOCK_UNIVERSE`) with the highest one-day move at the session. Founder question 3.

| Overlay | Median | 10th–90th | Max | Sessions < 7 | Sessions < 3 |
|---|---|---|---|---|---|
| Trend Follower | 6 | 2–12 | 18 | 54.2% | 11.7% |
| Speculator | 4 | 1–7 | 11 | 86.7% | 33.3% |
| Fundamental Investor | 0 | 0–1 | 1 | 100% | 100% |
| Capital Preserver | 1 | 0–3 | 5 | 100% | 86.7% |
| Diversifier (distinct sectors) | 8 | 5–10 | 11 (min 3) | 7 or more on 69.2% | |

The Contrarian is not overlaid: neither detector is in its subset.

## 5. Step 5 — the compression precondition (reconstructed; precondition only)

**In plain terms.** This counts stocks that look "coiled" (an unusually narrow day, or unusually narrow price bands), a state that can come before a breakout. On a typical day about one ranked stock in seven has its narrowest day of the past week. The band test always flags the same number, because it ranks stocks against each other.

A compression state is not a Compression Breakout, which has no detector. The count uses the same bars, completed sessions only, and the repository's own functions as the rankings producer calls them:
- `calculateNR7(highs, lows)` (`technicalCalculations.js:422`, called at `compute-index-intelligence.js:997`);
- `calculateBollingerBands(closes, 20, 2)` (`technicalCalculations.js:247`, called at `compute-index-intelligence.js:1000`);
- the band width ranked across the universe, as at `compute-index-intelligence.js:1293`. That ranking is inline code, not a function, so it is restated;
- the alarm level `bBandwidthPercentile <= 20` (`agentTriggerGate.js:165`).

Results per session:
- **Narrow-range (NR7) names:** median 33.5 (10th–90th 12–58; 1 to 94).
- **Band-width squeeze names:** **47 every session**, by construction. The alarm is a percentile of the day's own universe, so it always flags the narrowest fifth (surprise 2).

## 6. Requests, production reads and limits

**In plain terms.** The count stayed well inside its budget and never wrote to production. Its main weakness is that everything before 16 Nov is rebuilt from today's data, which the provider had already revised slightly.

- **EODHD: 241 requests of the 400 cap, 0 failed** (MEASURED, `requests.json`; each place written to disk before its request). One long daily series per symbol, 20 Dec 2025 → 17 Nov 2026, 228 rows each, through the store's own `fetchDailyPayload`, at 00:10 UTC on 18 Nov (7:10 PM ET, outside market hours). Symbols: the 228, SPY, the 11 sector funds, and 1 name from a list. The fetch script refuses to run inside a session's hours and refuses a plan above the cap.
- **Production (read only, MEASURED).** Each read is field-masked and goes through a restricted reader (`exportProduction.mjs`, which passed the write-verb grep; each of 13 planted write forms was caught by it):

  | Read | Result |
  |---|---|
  | `setupEvidence` | count 456; 456 records |
  | `setupEvidenceSweepState` | 2 |
  | `agentBattles` | count 646; a 5-document type probe; 184 by the string query, 0 by the Timestamp query |
  | `agents` | 104 |
  | `watchlists` | 8, one batched `getAll` (tickers, `deletedAt`, `status` only) |
  | `indexIntelligence/stockRankings` | 1 |
  | `rankingSnapshots` | 0 |

  The export ran twice (00:09:05 and 00:09:50 UTC). The first missed the rankings document, which lives in `indexIntelligence`, not in a `stockRankings` collection. The second is the frozen read; the records were the same 456. Credentials were parsed in place from the main checkout's `.env.local`, never printed or copied. **No model call.**
- **Limits of the count:**
  - **Reconstruction.** Every figure before 16 Nov comes from bars fetched on 17 Nov, and the provider revises bars for days, old ones included (§1). A revision moved no verdict on the 456 records that could be checked, but a boundary case on an older session could read differently from what the sweep would have said then.
  - **Two contemporaneous days.** The sweep started on 16 Nov, and both of its days are SPY-downtrend days.
  - **Today's scores.** Every overlay but the Trend Follower's uses one set of scores for all 120 sessions, so a name's June fundamental score or volatility rank is taken to be today's.
  - **The sector stand-in.** The Trend Follower overlay rests on a chosen definition of "top sectors" (§4).
  - **The window's market.** The window covers one summer and one autumn, with no prolonged downtrend (9 sessions). A long bear market is not in it.
  - **The battle bench.** 10 of 40 benches are bounded by one name each, shown as ranges.

## 7. Surprises

**In plain terms.** Six things came out differently from what the playbook draft seems to assume. The first and the last bear most directly on trader v1.

1. **Trend Breakout is almost never valid.** There are 31 breakout-valid records in 27,360 (5 breakout only, 26 both): a median of 0 a morning, at most 3. Of the 189 breakouts found in uptrending names, 158 failed the extension limit (C ≤ SMA20 + 2 × ATR, `tfSetupV1.js:252`). A close at a 20-day high on heavy volume is usually already more than two ATRs above its 20-day average.
2. **The squeeze alarm cannot vary.** It flags exactly 47 of 228 every day, so it says nothing about how compressed the market is.
3. **The Fundamental Investor's own constraint cannot be met.** It asks for at least 5 stocks scoring above 70; today 2 of 228 do (median 50, top 81).
4. **The provider revises old bars within hours:** 722 of the 1,250 revised bars were six or more sessions old.
5. **Setups did not dry up when the market fell.** In SPY's nine downtrend sessions the median was 20, as many as in its uptrend.
6. **Agent lists are the bottleneck, not setups.** The universe has 18 valid names on a typical morning; a battle list of nine holds 1, and its valid names fall in a single sector.

## 8. Founder questions (only where a number forces a choice)

**In plain terms.** Four choices that these numbers force, each answerable in a line. Reading R-1 in the Preamble is a fifth, smaller one.

1. **Trend Breakout.** Under `tf-setup-v1` it qualifies on 0 names on a typical morning, because 84% of breakouts are blocked by the extension limit. Should Trend Breakout keep the same extension limit as Pullback and Resume (and so be rarely available), or get its own limit (a new `SETUP_VERSION`, a founder PR)?
2. **What an agent chooses from.** A match opens seven positions. The universe offers 18 valid names a morning, but a battle list offers 1, and about 45% of lists offer none. Should trader v1's list be built from valid setups (or include them), or should most entries be allowed to carry "no setup"?
3. **"Today's top sectors."** No code defines it. Is the stand-in used here (the three sector funds with the best one-day move) the definition you want the Trend Follower's setups filtered by, or a different one (for example a multi-day move)?
4. **The Fundamental Investor.** With either detector it would have 0 names on every morning, because its score bar admits 2 stocks today. Should it keep a setup detector at all, or should its constraint change (a fenced file)?

## 9. Files

**In plain terms.** Six small scripts do the work in order: read production, fetch bars, replay, count. The last two run offline and give the same output every time from the same inputs.

| File | What it does |
|---|---|
| `scripts/experiments/setup-frequency/lib.mjs` | The window, the run folder (refused inside the repository), the write-verb grep, statistics |
| `scripts/experiments/setup-frequency/storeReplay.mjs` | The store's pure chain and `classifyEvidence` on a local slice, clock per session (listed in the import guard) |
| `scripts/experiments/setup-frequency/exportProduction.mjs` | The read-only export; ids scrubbed at read time (listed in the import guard) |
| `scripts/experiments/setup-frequency/fetchBars.mjs` | The plan, the cap, one long series per symbol |
| `scripts/experiments/setup-frequency/replay.mjs` | Every symbol × session; the compression inputs; the reproduction check |
| `scripts/experiments/setup-frequency/analyze.mjs` | Steps 2–5; asserts the cited constraint text on its lines |
| `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` | +2 listings (the prompt's one sanctioned test edit) |

**Re-running** (from the repo root; the run folder defaults to `C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117`):
1. `exportProduction.mjs`
2. `fetchBars.mjs --plan-only`
3. `fetchBars.mjs`
4. `replay.mjs` (about 19 minutes)
5. `analyze.mjs`
