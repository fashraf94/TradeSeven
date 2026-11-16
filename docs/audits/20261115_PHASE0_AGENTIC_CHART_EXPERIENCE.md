# Phase 0 — the agentic chart experience (read-only discovery)

**Date:** Sunday 15 Nov 2026 · **Branch:** `claude/agentic-chart-discovery-13c49d`, cut from `origin/main` at `ea5e0c5b` (#1068) · **Mode:** read-only. No source, test, flag, rule or config change; no deploy; no production write. The only files written in the repository are this report and its row in `docs/README.md`.

**Answers:** the handover *FantasyTrades Agentic Chart Experience — Product direction and feasibility review* (Knowledge Base workstream, 15 Nov 2026), questions 1–8, through the discovery prompt of the AssetResearch planning chat (Parts A–H). It designs nothing and builds nothing.

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. Branch `claude/agentic-chart-discovery-13c49d`, HEAD `ea5e0c5b406cf9060c42d32ee8e754998e4fb280`, equal to `origin/main`; tree clean.
- **The handover.** Not attached to the session as a file; found at `Downloads/FantasyTrades_Agentic_Chart_Experience_Handover_2026-11-15.txt` (17,484 bytes, SHA-256 `a0e3ebb6c6f85f9284fc05c396ba0e888d9afda7a2fbd1d25c705b6d925a21fc`). Read in full. Not committed. Its input, the Nov 9 brief *Agentic Technical Analysis — Goals and Vision*, was read for the dated planning inputs it asks to re-check (Part B and §6).
- **Two source documents were not available.** The BaggerBomb trader direction note with rulings BB-7, BB-8 and BB-18, and the ruling sheet of 15 Nov (questions 13–16), are in neither the repository, `Downloads` nor `Documents/FantasyTrades`. BB-7 is known verbatim from the evaluator fan-out discovery prompt; BB-8's content from the trader-game Phase 0 report (draft PR #1070, not merged). Every statement about trader v1 is therefore **ASSUMED** from those two secondary sources (Part F4).
- **How the code was read.** Eight readers each took one part of the tree at HEAD (A1/A3/C3; A2; A4/A6/A7; A5/B; D/E; F1–F3/F5; F4; G/C2) and returned each finding as a file, a line and the exact text of that line; each reader checked its own quotes by script (198, 142, 215, 190, 195, 190 and the G reader's rows, all matching). The coordinator then re-read the 80 citations that carry the verdicts with a separate checker (`checkcites.mjs`, Method): 80 of 80 hold.
- **Markers.** A `path:line` citation is **VERIFIED**: the line was read at HEAD this session and holds what is said. **MEASURED** marks a production read made this session (Method lists each). **ASSUMED** marks what rests on a document or a source not read here. **INFERRED** marks a conclusion drawn from code without running it.
- **Production.** Project `tradeseven`, read on 15 Nov 2026 between 7:07 and 7:29 PM ET with `count()` and field-limited `select().get()` / `doc().get()` calls only. Five scripts, each passed a write-verb grep before it ran. Credentials were parsed in place by `node --env-file` from the main checkout's `.env.local`, never printed or copied. No index was created.
- **No provider and no model call.** None was made. One question stops on that rule (§5, Q-PROV).
- **Account ids.** None appears in this report or in any script output. Owners are labelled A and B.
- **Not run.** No test, lint or build: the change is one report and one README row. The stylesheet scan excludes `docs/` (`src/index.css:9`, `@source not "../docs";`), and a local `vite build` cannot run on this machine because `three` is not installed in the main checkout's `node_modules`; the Vercel preview build is the real check.

---

## 1. Verdicts

| Part | Question | Answer in one sentence | Status |
|---|---|---|---|
| **A** | What is measured today? | The Trend Follower evaluator (nine facts, nine entry checks, two patterns) runs live only inside the activation observer, for the cockpit-allowlisted owners' Trend Follower battles, and **production holds 0 snapshots** (MEASURED); the rankings fields are stored, public and fresh, but nothing stores a sector-relative move (only a 20-bar rank within the sector) or an intraday-comparable volume; hourly bars can be fetched (10 days) but no study reads them, 10-minute bars exist only as past-session film tape, and four-hour bars have no path. | Evaluator: merged and on (observer only), **empty**. Labels: merged and dark (`SETUP_MENU_LABELS_ENABLED`, waits on D-6, the census week, the rules). Rankings fields: on. |
| **B** | Is there one price basis? | No: on the 1D chart only the candles are adjusted, while the SMA overlay, S/R lines, indicators and record lines are raw; the evaluator is raw by ruling FD-P3-2; the rankings cron mixes adjusted closes with raw highs and lows; the scorer's ATR is fully adjusted — and a stored window shows the evaluator's basis and the scorer's basis printing $7.68 and $7.56 for the same ATR14 on the same day (MEASURED). | Not built (no alignment rule). |
| **C** | Which setup first? | Trend Follower pullback-and-resume is the only measured setup and needs no detector work, but every stock's record is absent until something acquires it; a 200-day reclaim is not measured and would be a new detector the size of the evaluator's own build (21 files, five lenses, 55 findings, 13 founder questions) plus a longer fetch in the store. | C1 merged and on, empty. C2 not built. |
| **D** | Can a screen read a setup record? | No route returns one, and `setupEvidence` denies every client verb; a route can be read-only (`readSnapshot` never fetches), owner-scoped by the battle as `battle-research-quotes.js` does, and must be added to the store's import-guard allowlist by name. | Not built. |
| **E** | Where would a plan and a question live? | A conditional plan fits a hypothesis version best (above/below conditions at `daily_close`, a horizon, evidence refs that can cite a setup-evidence id, content-hashed and superseded by version) but no store holds an explicit evidence cutoff and method version for it; a saved question fits `researchWork.question` only for Shared Research's origin; nothing runs an experiment, so a save can only save. | Partly built: hypothesis versions on (allowlist); researchWork on (allowlist); idea book dark (`PRACTICE_FIELD_MODE='off'`); runner not built. |
| **F** | Does the agent need a redesign? | No: Shared Research already separates method, evidence, budget, a schema-enforced model turn and a validator; the chart Ask (a Gemma voice turn, 800 tokens, free text, no method) needs a server-read evidence kind, an answer shape and a KB consumer entry (the list ships empty), not a new brain. | Ask merged and on (allowlist), unshaped. KB method merged and dark (`KB_APP_USE=[]`). Chart pack, shape and consumer not built. |
| **G** | Does it fit the research screen? | Yes in outline: the Chart view reserves exactly this slot (Build B, a deterministic read of the stored evaluator record, no placeholder until the read route exists); four conflicts are confirmed — no stop price may be drawn, a "what breaks it" line would be the third red dashed line beside 💣's rung, no daily line may sit on Battle's 5- and 30-minute bars, and nothing may call a model on open. | Slot designed, not built. |
| **H** | What is missing? | Seventeen things, sorted in §2 Part H: two KB content items, four typed detector outputs, three data acquisitions, five route or record changes, three design items. | — |

---

## 2. Parts A–H

### Part A — What is measured today

#### A1. The Trend Follower setup evaluator

**Facts.** Nine, `tfSetupV1.js:77`: `C`, `SMA_fast`, `SMA_slow`, `SMA_slow_5ago`, `swingHigh`, `swingLow`, `ATR`, `V`, `V_avg`. The definition's §1 table names eight; `SMA_slow_5ago` comes from its §2 regime rule (`TREND_FOLLOWER_SETUP_DEFINITION_V1.md:25`). Windows (`setupEvaluator/thresholds.js:70`): SMA_fast bars 0..19, SMA_slow 0..49, SMA_slow_5ago 5..54, swing high and low bars 1..20 (bar 0 is the last completed session and is excluded from the swing). SMAs are simple, rounded to 4 decimals (`technicalCalculations.js:23`); ATR is a simple mean of 14 true ranges, not Wilder (`technicalCalculations.js:305`).

**Thresholds** S1–S10 in `setupEvaluator/thresholds.js:32–41`: 20, 50, 20, 14, 20, 5, 1.5, 3, `'none'`, 2.0.

**Checks.** Nine entry checks, `tfSetupV1.js:244–252`: `regime_stack` (C > SMA20 > SMA50), `slow_rising` (SMA50 > SMA50 five bars ago), `regime_stack_down`, `slow_falling`, `breakout_close` (C ≥ swing high), `breakout_volume` (V ≥ 1.5 × V_avg), `pullback_touch` (the lowest low of bars 0..2 ≤ SMA20), `pullback_close` (C > SMA20), `extension` (C ≤ SMA20 + 2.0 × ATR). Each is stored as `{id, lhs, op, rhs, result, facts}` (`:231`).

**Patterns.** Two, in priority order (`:80`): `breakout` (`:82`) and `pullback_resume` (`:83`); each is satisfied, failed or untestable (`:274–276`).

**Verdicts.** `valid` with its pattern (`:297`); `invalid` with reason `regime` (`:291`), `extended` (`:296`) or `no_setup` (`:299`); `unknown` with `insufficient_history` (`:288`), `missing_fact` (`:290`, `:300`) or the adapter's refusal reason (`:362`; reasons at `dailyBarsAdapter.js:66–67`). Regime is `uptrend`, `downtrend`, `no_trend` or unknown (`:263–265`).

**What `unknown` lists as missing.** The record's `missing` array: every one of the nine facts that is null (`:333`), on every record, valid ones included. On a refused record it lists all nine, because facts are computed from zero bars (`:345`). The pullback lows and the anchor never appear in it.

**Holding checks.** Three (`:86`): `close_below_slow` (C < SMA50, `:413`), `structure_break` (C < the supplied anchor, `:414`), `regime_flip` (regime is downtrend, `:415`); all unknown below 55 bars (`:406`). The evaluator takes the anchor as a bare price with provenance `supplied` or `absent` and no date (`:391`). **No production code calls the holding evaluator**: the store calls `evaluateTfEntry` only (`setupEvidence/acquire.js:130`). The anchor is recorded only on the activation pointer `agentBattles/{battleId}/activations/{activationId}` (`activationEvidence/writer.js:37`) as `anchorSwingLow {value, provenance: 'own_entry'}` (`pointer.js:121`), taken from the snapshot's `entry.factsUsed.swingLow` (`pointer.js:88`); its date is reachable only at `entry.evidence.swingLow.date`. The definition's "frozen at deploy" (`TREND_FOLLOWER_SETUP_DEFINITION_V1.md:44`) is superseded by C4, "frozen per actual holding activation" (`:138`).

**What could be drawn** (paths in a `setupEvidence/{id}` document):

| Chart element | Field | Note |
|---|---|---|
| 20-day average (a value) | `entry.factsUsed.SMA_fast.value`, dated `entry.asOf` | One value, not a series (`tfSetupV1.js:318`) |
| 50-day average (a value) | `entry.factsUsed.SMA_slow.value` | One value |
| 50-day average five bars ago | `entry.factsUsed.SMA_slow_5ago.value`, dated `entry.evidence.windows.smaSlowPrior.to` | (`:189`) |
| Swing high, swing low | `entry.evidence.swingHigh`, `entry.evidence.swingLow`, each `{value, date}` | Most recent bar wins a tie (`:117`) |
| Extension limit | `entry.checks[id='extension'].rhs` | Exists only as a check's right-hand side |
| Breakout level | `entry.checks[id='breakout_close'].rhs` | = swing high |
| The touch | `entry.evidence.pullbackLows`: three `{date, low}` (`:180`) | **No touch bar is recorded**; the check compares the lowest of the three lows with today's SMA20, so "which bar touched" must be derived |
| The bars | `evidence.bars[0..54]` `{date, open, high, low, close (raw), volume, adjustedClose, volumeClass}` (`dailyBarsAdapter.js:273`, `:177`, `:180`) | Raw provider rows; server-only |

**Versions and lookback.** `ruleSet {setupVersion 'tf-setup-v1', thresholdsHash '26f3f411b566', semanticsId 'tf-setup-v1/sem-1'}` on every record (`setupEvaluator/thresholds.js:44`, `:56`, `:62`, `:88`; `tfSetupV1.js:321`); snapshot `schemaVersion` 1 (`acquire.js:40`). 55 completed bars (`setupEvaluator/thresholds.js:84`), requested from 130 calendar days back (`acquire.js:43`); fewer gives `insufficient_history` (`dailyBarsAdapter.js:195`). Basis raw (`dailyBarsAdapter.js:60`, `:177`; FD-P3-2 at `TREND_FOLLOWER_SETUP_DEFINITION_V1.md:96` and `setupEvaluator/thresholds.js:68`). Before today's close the session is the previous one (`dailyBarsAdapter.js:102–104`); never intraday (`tfSetupV1.js:26`).

**Volume policy.** `volumePolicy.js:16–26`: a value is usable unless null, zero, negative or non-finite. V_avg needs all 20 of bars 1..20 usable, with no reduced-sample mean (`setupEvaluator/thresholds.js:72`). The policy has no notion of time or of comparability; partial-day volume is excluded only because bar 0 must be a completed session. The pullback pattern uses no volume (S9 `'none'`, `setupEvaluator/thresholds.js:40`).

#### A2. The setup-evidence store

**Callers at HEAD.** The three the prompt named are confirmed: `activationEvidence/tenant.js` calls `readSnapshot` (`:431`) and `getOrAcquireSnapshot` (`:572`); `setupMenuLabels/reads.js` calls `readSnapshot` only (`:169`); `setupMenuLabels/tenant.js` calls `getOrAcquireSnapshot` only (`:345`). Others: `activationEvidence/writer.js` reads `setupEvidence/{id}` directly inside its finalisation transaction (`:70`) and imports `key.js` (`:26`); `activationEvidence/discover.js` imports `sessionAt.js` and `key.js` (`:22–23`); `scripts/census-activation-evidence.mjs` imports `key.js` (`:66`) and reads both collections field-masked (`:354`); `researchRecords/findingRecordKinds.js` holds the name as a vocabulary value (`:19`). The import guard lists each by exact filename (`setupEvidenceImportGuard.test.js:33–65`). `api/agent/battle-research-quotes.js:121` has an unrelated function also called `readSnapshot`. Four comments still say nothing calls the store (`setupEvidence/index.js:6`, the guard's `:3`, `docs/audits/20261030_BUILD_SETUP_EVIDENCE_STORE.md:7`, `compositionProtectedStoresAllowlist.json:578`); the code wins.

**MEASURED — coverage.**

| Read | Value |
|---|---|
| `setupEvidence` documents | **0** |
| `setupEvidenceClaims` documents | **0** |
| Control: `agentBattles` | 645 (equals the trader-game Phase 0's count, so the read is sound) |
| Activation pointers (`collectionGroup('activations')`) | 0 |
| `activationObserverState/main` | exists; written 15 Nov 7:00 PM ET; holds 5 battles, **all excluded by archetype**, all finished; 0 outstanding keys |
| `setupMenuLabelState` | 0 |
| Allowlisted owners (the local `COCKPIT_ALLOWLIST_UIDS`, 2 names; production's value is in Vercel and **ASSUMED** equal) | Owner A: 121 battles, 23 tiered Trend Follower battles, the last on 31 Oct; owner B: 8 battles, 3 tiered Trend Follower, the last on 30 Oct; **0 in the last 14 days** |

So: no snapshot has ever been written, there are no sessions, symbols or verdicts to split. The one live writer, the observer, has looked only at battles created inside its 14-day window (`activationEvidence/constants.js:46`) since its flip on 6 Nov, and none was a Trend Follower battle (`scope.js:30`; `momentum_chaser` at `activationEvidence/constants.js:83`). Why the allowlisted owners' Trend Follower battles of 23–31 Oct, inside the window on 6 Nov, left no pointer is **not established** here (the state document keeps only the five it now holds); it is reported for separate tasking, not investigated.

**Cost of one acquisition.** Zero provider calls if a final snapshot exists or another caller holds the lease. Otherwise exactly one EODHD `/eod/` request, newest first, 130 calendar days, 5 s timeout, no cache (`acquire.js:100`, `:43`, `:42`; `eodhdDailyWindow.js:39`, `:10`). A result of the "confirm" class (no adjustment metadata) needs a second fetch at least 30 minutes later (`classify.js:73`, `setupEvidence/store.js:37`, `:148`). Once final, a key never costs again.

**All 228 ranked stocks, one snapshot per session.** 228 `/eod/` calls a day at the floor, about 274 with the spec's assumed 20 % confirm-class share (`docs/design/20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md:312`) — **INFERRED**; the billing weight of one `/eod/` call is **ASSUMED** to be 1 (`docs/audits/20261007_EODHD_CALL_CENSUS.md:43`). Against which budget: **none exists**. The only budget constant, `MANDATE_UPSTREAM_DAILY_CEILING = 100_000` (`mandateConfig.js:120`), is Mandate-scoped and alert-only, and its own comment says no quota accounting exists anywhere (`:116`); Mandate and the intraday poller each count only themselves (`mandateUniverseSnapshot.js:285`; `intradayStore.js:28`). D-6 is not a question in `setupMenuLabelsFlags.js`: it is condition (b) of that flag's flip (`:25–26`); its open terms — the allocation's unit, window, included consumers and treatment of retries and confirm fetches — are in the Slice 2 spec (`20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md:491`), which also says the 100K figure is an account allowance, not an approved allocation (`:312`).

**From bars another job already fetched, at 0 new calls?** Not as built. The store has the seam (`fetchPayload` is injected, `acquire.js:95`), but:

1. **No raw payload is persisted.** `compute-index-intelligence` fetches about 378 calendar days of `/eod/` for all 228 stocks on each of its nine weekday runs (`:891`, `:146`; about 2,052 calls a weekday, INFERRED) and keeps them in memory only, mapped and reversed (`:174–175`); it persists scores (`:1245`). `compute-rankings` fetches per-symbol bars only for SPY and the sector ETFs (`:1500`) and one bulk last-day call for stocks (`:1490`).
2. **Basis and provenance are lost on mapping.** `mapDailyRows` folds `adjusted_close` into `close` (`marketDataCache.js:318`) and drops the presence flag the split check needs (`dailyBarsAdapter.js:114`; "presence is never inferred", `setupEvaluator/thresholds.js:75`).
3. **Depth and fields.** `priceHistory/{sectorId}` keeps raw closes only, no high, low, volume or adjusted close (`compute-rankings.js:213`), keyed by the run's UTC date (`:198`). `marketDataCache/{SYM}_daily` is deep enough (90 calendar days, `marketDataCache.js:257`) but mapped, on demand, 4-hour TTL. The intraday seed is 1-minute bars (`intraday/seed.js:3`).
4. **Order.** index-intelligence asks oldest first (`:147`); the store never re-sorts (`acquire.js:9`) and refuses unordered rows (`dailyBarsAdapter.js:191`).
5. **Stamps.** `fetchedAt`/`capturedAt` are the instant the injected function returns (`acquire.js:15`, `:119`) and `sourceMeta.from/to` come from the request window (`:126`); a replayed payload would misstate both, and would satisfy the 30-minute confirm rule falsely.
6. **The import guard** fails any `api/cron` file that names the store unless it is listed (`setupEvidenceImportGuard.test.js:140`).

The cheapest real path (**INFERRED**): index-intelligence hands the exact raw `/eod/` payload, newest first and ending at the session, to the store before mapping — a change to that cron, a guard entry, and a ruling on whether a shared payload counts as "the instant received".

#### A3. The two flags

- **`ACTIVATION_EVIDENCE_ENABLED = true`** (`src/config/activationEvidenceFlags.js:36`, on since 6 Nov, `:22`). Server-only (`:9`). With a non-empty cockpit allowlist (`activationEvidence/gate.js:28`; env `COCKPIT_ALLOWLIST_UIDS`, `callRecords/allowlist.js:28`), the sixth tenant of `process-pending-reflections` (`:72`, `:323`; every 15 minutes 13:00–01:45 UTC, `vercel.json:206`) writes one activation pointer per holding lifetime of those owners' tiered Trend Follower battles and acquires the snapshot behind each, at most 12 per run, three at once (`activationEvidence/constants.js:34`, `:32`). Reaches: no player, no prompt, no screen. **Merged and on; MEASURED output: 0 pointers, 0 snapshots.**
- **`SETUP_MENU_LABELS_ENABLED = false`** (`src/config/setupMenuLabelsFlags.js:31`). When on, the seventh tenant (`process-pending-reflections.js:76`, `:338`) acquires snapshots for the persisted hot bench of allowlisted owners' active Trend Follower battles (`setupMenuLabels/tenant.js:244`, `:262`; `pool.js:39`), and `agent-evaluate` writes a `setupMenu` label block on each tick record (`setupMenuLabelsFlags.js:14`; `agent-evaluate.js:2962`). The agent never sees a label (`setupMenuLabelsFlags.js:20`; `agent-evaluate.js:158`); a label carries no price (`setupMenuLabels/compose.js:87–88`); no screen reads it. **Merged and dark; the flip waits on** (a) ID-1's first census week recorded complete, (b) D-6 resolved, (c) the `setupMenuLabelState` rules and index exemption published (`setupMenuLabelsFlags.js:25–26`), and the founder's own flip PR (`docs/audits/20261107_BUILD_SETUP_MENU_LABELS.md:318`). No record of (a) or (b) being met was found. Even on, it acquires only for Trend Follower battles' hot benches, not for an arbitrary stock a player opens.

#### A4. Everything else measured per stock, and already stored

One writer for both documents, `api/cron/compute-index-intelligence.js` (`stockTechnicalScores` `:1245`; `indexIntelligence/stockRankings` `:1524`, `:1559`). Inputs: about 260 daily `/eod/` bars (`:144`, `:146`); each mapped bar is **mixed** — adjusted close, raw open/high/low/volume (`marketDataCache.js:318–319`; the cron says so at `:1095`). Freshness: two premarket runs (10:30, 11:30 UTC, `vercel.json:150`) and hourly intraday runs 14:00–20:00 UTC (`vercel.json:154`), which splice a live `/real-time/` quote in as bar 0 (`:190`, `:305`) with session-so-far high/low (`:275`) and volume set to the trailing 30-bar average (`:264`, `:283`). In EST that is 09:00–15:00 ET: nothing refreshes after 3 PM ET (INFERRED). `stockRankings` carries `mode` (`:1530`); `stockTechnicalScores` does not (`captureReceipt.js:100`). Both are public: `allow read: if true` (`firestore.rules:964`, `:969`); the browser already reads both (`useTechnicalScore.js:21`; `Sheet/rankingsRead.js:13`).

**MEASURED:** `stockRankings` holds 228 rows, last written 13 Nov 2026 3:01 PM ET (the Friday close run); `stockTechnicalScores` holds 239 documents, newest 13 Nov 3:01 PM ET, oldest 20 May 2026 (11 stale documents for symbols no longer ranked, INFERRED from 239 − 228).

| Field | Where | Formula's home | Timeframe | Basis |
|---|---|---|---|---|
| `trend` | both | `:1072–1074`; `technicalCalculations.js:481` | price vs daily SMA20/50/200 | per period: raw, adjusted if the window spans a split (`indexIntelligence.js:363–364`, `:254`); recorded in `factors.basis` |
| `pivots` | both | `:1064`; `technicalCalculations.js:454` | bar index 1 — the previous session intraday, **two sessions back premarket** (INFERRED, `:1062`) | mixed |
| `levels` | both | `:1080–1082`; `analyticalPrimitives.js:152` | 20-bar swing clusters, ≥ 2 touches within 2 % | raw H/L |
| `momentum` | both | `:1090` | RSI-14 divergence, 20 bars; its only key is `divergence` | adjusted |
| `recentAction` | both | `:1098` | last one or two candles; a forming candle intraday | mixed |
| `sma200_position` | both | `:1059` | % from SMA200 | per `factors.basis.sma200` |
| `momentumScore` | rankings only | `:1175`, `:1420`; `momentumScoring.js:528` | percentile of a 6-metric composite, windows 60/90/126 bars (`:477`, `:482`, `:267`) | adjusted |
| `return1W/1M/3M` | rankings only | `returnCalculations.js:20–22`, `:35`; `:1185` | 5/21/63 bars; bar 0 live intraday | adjusted |
| `sectorTechnicalRank` | both | `:1153–1155`, `:1396` | rank of `technicalScore` (`indexIntelligence.js:499`) in the sector | mixed |
| `nr7Flag` | both | `:1108`; `technicalCalculations.js:427–431` | bar 0 narrowest of 7; partial bar intraday | raw H−L |
| `bBandwidthPercentile` | rankings only | `:1000`, `:1293`, `:1418` | Bollinger 20/2 bandwidth, universe percentile | adjusted |
| `techRaw` {`rsi`, `bbPercentB`, `distTo52wkHigh`, `atrPercent`} | rankings only | `:1410–1413` | RSI14; %B 20; 252-bar high; ATR14 % | adjusted / adjusted / raw highs vs adjusted close / mixed |

Placeholders to know: `rs50.percentile` is always 0 (`:1104`); `factors.rsi` is filled with 50 when missing (`indexIntelligence.js:490`) while `techRaw.rsi` stays null (`:964`).

#### A5. What the client computes for itself

All client indicators read the daily series' raw `close` (`useResearchData.js:807`), 400 calendar days requested (`:166`), completed bars only.

| Client quantity | Inputs | Same quantity server-side |
|---|---|---|
| SMA20/50/200 (`useResearchData.js:815–817`) | raw closes; simple, unrounded (`technicalIndicators.js:45`) | Evaluator SMA20/50: raw, 4 decimals (`technicalCalculations.js:23`) — should agree to 4 decimals for the same session (INFERRED). Rankings `factors.sma20/50/200`: raw unless a split, but **including a live bar** on intraday runs |
| SMA overlay on the chart (`:839–840`) | the **chart** series (180 days on 1D, `:167`; weekly bars on 1W, so a 20/50-**week** average), 2 decimals (`technicalIndicators.js:66`); 20 and 50 only (`StockChart.jsx:812`; `useResearchData.js:842`) | none |
| RSI-14 (`:813`), Wilder (`technicalIndicators.js:144`), printed to 1 decimal (`TechnicalTabV2.jsx:191`) | raw | `techRaw.rsi`: adjusted, ~378 days of warm-up, live bar intraday — the two can sit on opposite sides of 30/70 (INFERRED) |
| MACD 12/26/9 (`:814`; `technicalIndicators.js:219`, `:237`), printed as words | raw | rankings MACD: adjusted (`compute-index-intelligence.js:967`) |
| `detectLevels` (`useResearchData.js:850`) | raw daily; MA levels, Fibonacci over 60 bars, 5-bar swings, round numbers, volume nodes; ≥ 2 factors (`levelDetection.js:16`, `:67`, `:111`, `:160`, `:264`, `:43`) | rankings `levels`: a different algorithm (20-bar swing clusters) |
| `detectTrendlines` (`StockChart.jsx:231–232`) | the prepared candles: **adjusted on 1D, raw on 1W** | none |
| TechnicalTabV2 (`TechnicalTabV2.jsx:187`) | prints RSI, MACD wording and "vs 50-Day MA" only; never SMA20 or SMA200 | — |

"Levels" therefore means three different things on one screen: the client's `detectLevels`, the rankings' `levels`, and the evaluator's swing high/low (BUILD_RULES §9).

#### A6. Relative performance and comparable volume

- **Against SPY** (stored on `stockTechnicalScores`): `rs20` and `rs50` `{value, change}` — the % change of the stock/SPY close ratio over 20 or 50 bars (`indexIntelligence.js:193`; `compute-index-intelligence.js:904–905`, `:1103`), `rs20.percentile` (universe rank, `:926`), `rsTrend` (a 10-bar label, `:906`, `:1105`). On `stockRankings`, `momentumFactors.intermediateRS` is a z-score of the 6-month excess return over SPY (`momentumScoring.js:274`; `:1422`). SPY and the stock are aligned by array index, not date (`:885`, INFERRED risk).
- **Against the sector**: only `factors.sectorRSPercentile` — the stock's rank, within its sector, of 20-bar RS against the sector ETF (`:937`, `:948`, `:1134`). **The size of the move is not stored.** Sector ETF 1D/5-bar/21-bar changes sit in `indexIntelligence/marketContext.sectorSnapshot` (`:787–789`, `:1216`); industry medians of returns in `stockRankings.industries` (`:518`, `:1522`). No per-stock excess-over-sector or SPY 1W/1M return is stored (NOT FOUND); `return1W` minus the sector ETF's 5-bar change can be derived from one run (INFERRED).
- **Can support:** "underperformed its sector over the last 20 sessions (bottom third of its sector)" with the run's own time. **Cannot support:** a percentage gap versus the sector, or any window but 20 bars, without new computation.
- **Volume, daily:** `volumeProfile.ratio` = bar 0 over the 20-bar average (`:1113`; `technicalCalculations.js:342`, `:349`) — a real reading premarket (last completed session), **meaningless intraday** because bar 0's volume is synthetic. The evaluator's own `V` / `V_avg` on the snapshot: completed session over bars 1..20, raw.
- **Volume, intraday:** `volumePace` in `intradaySnapshots/latest` (server-only, `firestore.rules:1517`) is cumulative volume over the vendor's `averageVolume` × elapsed fraction of the session — a straight-line pace (`intraday/accumulator.js:278–279`), not a same-time-of-day baseline (NOT FOUND anywhere); the vendor average's window is not stated in the repo. The 5-minute buckets keep closes only, no volume (`intraday/buckets.js:9`).
- **Can support:** "the last completed session traded at N× its 20-day average volume". **Cannot support:** "volume confirmed on the touch bar" intraday, or any comparable intraday reading.

#### A7. Timeframes

`/api/stocks/historical` (client `eodhdAPI.js:820`):

| Series | Depth | Source | Cache / lag | Basis |
|---|---|---|---|---|
| 1m | one day (`historical.js:18`) | `/intraday/` | TECHNICAL tier, 1 h + 10 min (`:186`; `serverCache.js:117`) | raw |
| 5m | 5 days (`:26`) | `/intraday/` | 5-minute tier (`:10`) | raw |
| 30m | 10 days (`:31`); 20 for 💣 (`useResearchData.js:261`) | `/intraday/` | 1 h | raw |
| 1h | 10 days (`:37`) | `/intraday/` | 1 h | raw |
| 1d | 180 days default (`:43`); 400 when the modal asks | `/eod/` (`:378`) | 1 h server; 24 h client (`src/utils/marketSchedule.js:22`) | both fields sent (`:430–431`); drawn adjusted |
| 1w | aggregated from 1095 days of **raw** daily closes (`:49`, `:395`, `:401`) | `/eod/` | 1 h | raw |
| 1M | aggregated client-side from weekly (`useResearchData.js:634`) | — | — | raw |

- **10-minute:** exists only as film-tape aggregation of 1-minute bars (`filmTape/bars.js:130`; `SERIES_INTERVAL '10m'`, `filmTape.js:115`), written the morning after (`vercel.json:218`), for battle symbols, owner-readable (`firestore.rules:543`). No live 10-minute path.
- **Hourly:** the route serves the provider's 1h interval, 10 days, behind a 1-hour cache; no study reads it.
- **Four-hour, 15-minute:** no path (NOT FOUND).
- The Nov 9 brief's "no 10-minute, hourly or 4-hour series" is therefore partly out of date (§6).

### Part B — The price basis

| Consumer | Basis | Where |
|---|---|---|
| Chart candles, 1D | **fully adjusted**: open/high/low scaled by `adjusted_close/close`, close drawn as `adjusted_close` — the only client adjustment | `chartUtils.js:151–159`; `StockChart.jsx:208` |
| Chart candles, 1W / 1M | raw (weekly rows carry no `adjusted_close`, factor 1) | `historical.js:395`, `:425` |
| Chart candles, 5m / 30m / Battle | raw | `historical.js:330`; `battleChart.js:101` |
| Client indicators, SMA overlay, `detectLevels` | raw | `useResearchData.js:807`; `technicalIndicators.js:63` |
| Record and idea lines on the chart (entry fill, hypothesis levels) | raw prices | `packs.js:949`, `:955` |
| Setup evaluator | raw (FD-P3-2); adjusted close only for the split check | `dailyBarsAdapter.js:60`, `:177`, `:119` |
| Rankings technical factors | adjusted close, raw high/low: RSI/MACD/Bollinger/RS/returns adjusted; ATR, pivots, 52-week distance mixed; published SMAs raw per period, adjusted after a split | `compute-index-intelligence.js:960–994`, `:1064`; `indexIntelligence.js:363`, `:453–454` |
| Scorer's ATR, measured model | fully adjusted OHLC, 15 sessions, simple mean of 14 true ranges | `measuredStockThreshold.js:7`, `:64–65`, `:78`; `stockThresholdMeasurementProvider.js:41` |
| Scorer's ATR, legacy | `baseATR = atrPercentile × 8`, a rank of the rankings' mixed `atrPercent` | `decide.js:1267`; `hurdleAtr.js:21`; `compute-index-intelligence.js:1106` |
| `priceHistory/{sectorId}` | raw closes, 200 days, keyed by the run's UTC date | `compute-rankings.js:213`, `:197–198` |

So on the 1D chart today, raw lines (the SMA overlay, S/R, the entry and idea lines) are drawn over adjusted candles. The Nov 9 brief's "candles draw the adjusted close; indicators and levels read the raw close" still holds for 1D.

**One real example from stored data (MEASURED).** `stockThresholdInputs` holds 200 stored 15-session windows, each with the provider's raw rows and adjustment factors; the stored adjusted ATR14 reproduces exactly from the stored rows in 200 of 200. In 30 windows the adjustment factor changes inside the 15 sessions (an ex-dividend date). For each, ATR14 was recomputed the setup evaluator's way (raw basis, the same simple mean of 14 true ranges over the same 15 sessions) and set beside the stored scorer value (adjusted basis). No provider call: every number is from stored rows.

| Stock, session | Factor step | Evaluator's basis (raw) | Scorer's basis (adjusted) |
|---|---|---|---|
| NSC, 11 Nov 2026 | 23 Oct | **$7.6775** (2.3224 % of $330.59) | **$7.5571** (2.2859 %) |
| COST, 11 Nov | 23 Oct | $21.7389 (1.9988 %) | $21.8358 (2.0077 %) |
| STZ, 12 Nov | 26 Oct | $4.4929 (3.1071 %) | $4.5591 (3.1529 %) |
| LOW, 21 Oct | 2 Oct | $4.7693 (2.4264 %) | $4.7033 (2.3928 %) |
| ACN, 16 Oct | 29 Sep | $10.5121 (4.5769 %) | $10.4469 (4.5485 %) |

The same mechanism moves an average: when an ex-date E falls after day D, the adjusted SMA20 at D is the raw SMA20 × the factor, so a raw line sits above adjusted candles by the payout yield; when E falls inside the 20-day window, the two differ by more than a constant (INFERRED from the arithmetic; no stored 20-bar adjusted series exists to show it, since `setupEvidence` is empty).

**The smallest rule (INFERRED).** *Draw an evaluator fact only over raw candles, at the bar of its own date, labelled "raw · as of {session}".* On 1D that means not applying the scaling at `chartUtils.js:151–159` while an evaluator fact is drawn; 1W and intraday are raw already. It is exact for every fact, the swing high and low included (their dates differ from `asOf`, so no single adjustment factor can place both the line and the comparison correctly), and it also puts the existing SMA overlay, S/R and record lines on their candles' basis. The cost: a split inside 180 days shows as a cliff on 1D — and the evaluator already refuses a window that straddles one. The alternative — keep adjusted candles and multiply each fact by the chart row's own factor at its date — is exact only when no ex-date falls inside the span a fact reads or is drawn across, which for a dividend payer fails about once a quarter. Whether candles and indicators should both be raw or both adjusted is the open ruling the Nov 9 brief already named (§5, Q-BASIS).

**Side finding, for separate tasking (INFERRED).** When the newest 1D end-of-day row is today's, the live patch keeps that row's `adjusted_close` (`useResearchData.js:785–788`), so `prepareChartData` draws the stored adjusted close, not the live price, as the last candle's close.

### Part C — The smallest first setup

#### C1. Trend Follower pullback-and-resume (measured)

What one stored snapshot could show a player, with nothing re-run (R-17):

- **The read:** the verdict, the pattern and the regime — e.g. *valid · pullback and resume · uptrend · daily, as of {session}*.
- **Supporting checks:** each check whose `result` is true, with its two sides (`pullback_touch`: the lowest low of three sessions ≤ the 20-day average; `pullback_close`: close > the 20-day average; `regime_stack`, `slow_rising`; `extension` within 2 ATR).
- **Conflicting checks:** each check whose result is false (e.g. `breakout_volume` false; `extension` false makes the verdict `invalid · extended`).
- **Missing facts:** `entry.missing`, and every check whose result is `unknown`.

What the record does not hold, and whether A4/A6 can supply it **with its own time**:

| The handover's ingredient | In the record? | From A4/A6 | Its own time |
|---|---|---|---|
| Momentum | No | `techRaw.rsi`, `momentumScore`, `momentum.divergence` on `stockRankings` (public) | the run's `computedAt`/`mode`: premarket = last completed session, but adjusted basis; intraday includes a live bar |
| Sector-relative performance | No | `factors.sectorRSPercentile` (20-bar rank within the sector) on `stockTechnicalScores` (public) | `updatedAt`; no `mode` field, so premarket and intraday cannot be told apart |
| Comparable volume | Partly: `V`, `V_avg` of the completed session (the breakout check) | `volumeProfile.ratio` (premarket only); no intraday comparable reading | snapshot `asOf` / premarket run |

Each extra ingredient would come from another source with another basis and time, so each needs its own label (BUILD_RULES §9). **But first, no snapshot exists for any stock** (Part A2): C1 is ready as a rule and empty as data.

#### C2. A 200-day reclaim (not measured)

What a typed detector would need, by `tfSetupV1.js`'s standard set:

- **A definition document** like `TREND_FOLLOWER_SETUP_DEFINITION_V1.md`, with a blessing sheet; changing any number mints a new `setupVersion` (`:67`); the TF numbers were blessed by the founder on 24 Sep (`:85`).
- **Facts** (daily, raw, each `{value, asOf, source, basis}`): C; SMA200 today; SMA200 on each of the K bars before (to prove the stretch below); SMA200 N bars ago if a slope is required; the count of closes below; V, V_avg and ATR only if the confirmation uses them.
- **The event — founder rulings:** how long below (K closes in a row, or K of M); how the cross is confirmed (one close above, N closes, a margin in ATR or %, a volume floor); the slope requirement; what fails it (a close back below within M bars); strict or inclusive boundaries; missing facts affect only their checks (C1 of the definition, `:91`).
- **The record:** the rule set, `asOf`/`requestedAsOf`, basis, windows, `factsUsed`, `missing`, `checks` with both sides, a typed verdict and reason, a refusal block.
- **Code:** a frozen thresholds module with its own version, hash and semantics id; the existing adapter (the caller sets `minBars`, `dailyBarsAdapter.js:17`); a synthetic golden set with decimal, not dyadic, boundaries; entry and failure test files; **a longer fetch** — the store asks 130 calendar days (`acquire.js:43`), about 87 sessions, too short for a 200-day average, and is wired to `evaluateTfEntry` (`acquire.js:33`), so it must be generalised; the CI golden guard watches only tf-setup's files (`scripts/experiments/tf-setup-golden-baseline-check.mjs:43`, `:45`). Minimum history about 200 + max(K, slope window) + N bars (INFERRED); more split/dividend refusals than the 5.3 % unknown share of 55-bar windows (`20261028_TF_SETUP_EVALUATOR_SLICE1.md:317`) — INFERRED.
- **Review path (precedent):** definition and blessing → build prompt with rulings → build → draft PR, STOP → BUILD_RULES §2 review → founder questions → independent review and fix round → merge → CI guard → store → a Build B reader.

**Sizes by comparison (merged diffs, `git diff --shortstat` of each merge):**

| Build | Files / lines | Review |
|---|---|---|
| #1001 TF evaluator | 21 / +20,890 (15,428 the golden JSON) | 5 lenses, 5 refuters, 55 findings (43 confirmed, 6 partly, 0 refuted), Astra's review and a fix round, 79/79 mutants, founder questions Q-TE-1–13 (`20261028_TF_SETUP_EVALUATOR_SLICE1.md:582–590`, `:25–26`) |
| #1004 CI golden guard | 5 / +859 | one reviewer, 9/9 spot mutants |
| #1018 setup-evidence store | 28 / +3,846 | 4 lenses, 4 verifiers, 33 findings (22 confirmed, 8 partly, 3 refuted), 456 mutants planted, Q1–Q4 |
| #1034 setup menu labels | 44 / +7,008 | 3 lenses, 3 verifiers, 14 findings; Astra F1–F4; a second review; 42/43 + 24/24 mutants |

**Comparison.** C1 needs no detector build. C2 needs a build the size of #1001 plus #1004, and a generalisation of the store's fetch and caller (a slice of #1018's scope) — four review rounds at least, by the precedent. Both need the same read route (D) and the same acquisition decision (A2). The handover's own fallback — "if an existing measured setup ships sooner, use it … without claiming a reclaim was measured" — points at C1.

#### C3. Archetypes

Six archetypes (`agentArchetypeConfig.js:247`). Only `momentum_chaser` (Trend Follower) has a setup evaluator and measured setup thresholds. `degen` and `momentum_chaser` carry B4-calibrated knobs; the other four keep illustrative seeds (`agentArchetypeConfig.js:19–21`). The BaggerBomb measured stock thresholds are per stock, scoped by game mode, with no archetype dimension (`measuredStockThreshold.js:6`; policy JSON `:9`, `:12`). For analyst, diversifier, contrarian, degen and guardian, an honest chart can show the shared facts (rankings fields and client indicators, each with its basis and time) and "not measured for {archetype} yet" — the Nov 9 brief's own phrase — with no verdict.

### Part D — The read route

**Today.** `setupEvidence` and `setupEvidenceClaims` deny every client verb (`firestore.rules:1262–1266`; "SERVER-ONLY: no client reads in V1", `:1260`). Derived records are server-only too: activation pointers (`:551`), `setupMenuLabelState` (`:1299`), and tick records under the catch-all (`:1516`). No route in `api/` and no `src/` module reads the store or the evaluator (NOT FOUND). **Not built.**

What a route would have to respect:

1. **The store's rules.** Call `readSnapshot` only: one `get` of `setupEvidence/{id}`, never the claims, never a fetch, `null` when absent (`setupEvidence/index.js:34–36`; `setupEvidence/store.js:49–50`). It takes no clock, and the caller supplies `session` (`lastCompletedSessionAt`, `sessionAt.js:27`) and `ruleSet` (`describeRuleSet`, `setupEvaluator/thresholds.js:87`). `snapshotIdOf` throws on a malformed symbol or session (`key.js:35`, `:39`; symbols in hyphen form, `:25`), so the route answers 400 there (INFERRED). `getOrAcquireSnapshot` is out of bounds for a read route: it takes a 120 s lease and calls the provider (`setupEvidence/index.js:53`; `setupEvidence/store.js:35`). Create-once is the store's own (`setupEvidence/store.js:116`), and a final snapshot never gains a field (`acquire.js:39`).
2. **The import guard.** It is textual: any file naming the folder or either collection is a caller (`setupEvidenceImportGuard.test.js:30`) and must be on `ALLOWED_OUTSIDE` by exact filename (`:33`, `:111`), the route and its test in the same commit; every listed file must still name the store (`:108`); the library stays exactly six modules (`:118`), so a projection helper lives outside it; the library may not import `api/agent`, but `api/agent` may import the library (`:116`).
3. **When no snapshot exists.** The precedent keeps "absent", "refused" and "labelled" as three statuses (`setupMenuLabels/compose.js:34`). With 0 snapshots stored, a route built today would answer "absent" for every stock until something acquires (Part A2).
4. **Auth, owner scope, rate limits — the precedent `api/agent/battle-research-quotes.js`:** Bearer Firebase ID token through `requireAuth` (`:152`; `authMiddleware.js:18`, `:34`, no revocation check); battle id shape-checked to 400 (`:160`); a per-user limiter before any read (`:166`), 20 a minute (`:57`), and per IP 60 a minute (`:55`), both per-instance in memory (`:64`; `rateLimit.js:4`); ownership proved on the Admin-read battle document, 403 (`:175`); active and not League (`:176`); the mode gate, 404 (`:177`; `BATTLE_RESEARCH_MODE='allowlist'`, `researchModalFlags.js:169`); symbols taken from the battle, never the client (`:134`); values copied through an explicit field allowlist, never derived (`:32`, `:34`, `:98`); 30 s per-instance cache (`:59`); `Cache-Control: private, no-store` (`:148`); `maxDuration` 5 (`:52`); no rule change (`:40`).
5. **What may leave.** A snapshot carries no owner and no raw battle id ("Records carry no owner and no raw battle id", `tfSetupV1.js:51`; keyed by session, symbol and rule set, `acquire.js:138`) — confirmed. So owner scope must come from the battle or list the caller owns. **May leave** (a copied projection, INFERRED): `key.session`, `ruleSet.setupVersion`, `status`, `asOf`, `capturedAt`, `evidenceClass.bars`, `entry.verdict`, `reason`, `pattern`, `regime`, `checks` (id, both sides, result), `missing`, `factsUsed` values, the swing points and the three pullback lows. **Must not leave:** `writer.commit` and `writer.host` (`acquire.js:149`), anything in the claims document (the lease token, `setupEvidence/store.js:75`), and `evidence.bars` verbatim (55 raw provider rows).
6. **A bypass to keep in mind.** `researchWork` records and hypothesis versions are read by their owner straight from the Firestore SDK (`src/services/sharedResearchRecords.js:42`; `firestore.rules:1316`, `:1223`): anything a plan stores on them reaches the browser with no route in between.

### Part E — Where a plan and a question would live

#### E1. Records

**MEASURED usage:** `researchWork` 1 document (origin `screener`, 13 Nov); `watchlists` 18; hypothesis versions 1; `sharedResearchSessions` 0; `practiceFieldBooks` 0; `mandates` 0.

| Store | (a) a conditional plan with evidence cutoff, source pointers, method version | (b) a saved research question | State |
|---|---|---|---|
| **`researchWork`** (`api/_utils/researchRecords/`) | Partly. A finding has `source {recordKind, recordId}`, `asOf` ("when the SOURCE knew the fact", `researchRecords/model.js:801`) and a price or time `pin` (`:657`, `:762`); a summary has `rev` and `basedOn` (`:908`). The source kinds already include `setupEvidence`, `activationPointer` and `kb` (`findingRecordKinds.js:19`) — confirmed. Missing: condition fields, a method version (none on the record, `researchRecords/model.js:494`), a chart origin (closed list, `src/constants/researchRecords.js:20`), and a host for a chart (the id scheme covers five host collections, not `agentBattles`, `researchRecords/model.js:102`; one record per host document, `:31`). | Only as `question` on a `shared_research` record — refused for any other origin (`researchRecords/model.js:486`), set once, ≤ 500 characters (`:606`). | On (Shared Research `'allowlist'`); written by Shared Research (`sharedResearch/store.js:464`) |
| **Hypothesis versions** (`api/_utils/hypothesisRecords/`) | **Closest fit.** `activation` and `invalidation` conditions `{symbol, side above/below, level, basis 'daily_close'}`, ≤ 10 each (`hypothesisRecords/model.js:127`, `:73–74`, `:88`); a horizon enum (`src/constants/hypothesisRecords.js:40`); `evidenceRefs` whose items may name a `setupEvidence` snapshot (`researchRecords/model.js:653`) — and a snapshot id encodes its session and rule set, an implicit cutoff and method version. Missing: an explicit evidence-cutoff field (`publishedAt` is the only content time, `hypothesisRecords/model.js:234`), a KB method version, "strongest alternative" and "what confirms" text, condition kinds other than a daily close against a level, and a chart origin (`:69`). | A misfit (a statement only, ≤ 1,000 characters, `:86`). | On for the allowlist (`HYPOTHESIS_RECORDS_ENABLED=true`, `featureFlags.js:3218`) |
| **Practice Field idea book** (T1a) | No: an idea holds a thesis, a slot (its horizon), names and weights, lines as **distances** below entry (`practiceField/contract.js:16`), an origin and free-string sources ≤ 200 characters (`:91`), contract and epoch stamps (`admission.js:268–269`). It is an agent paper position, not a chart plan. | No. | T1a-1 merged and **dark**: `PRACTICE_FIELD_MODE='off'` (`practiceFieldFlags.js:33`); no endpoint (`ideaBook.js:27`); T1a-2a is PR #1061, not merged |
| **Shared Research sessions** (`api/_utils/sharedResearch/`) | No plan fields; a session carries a method stamp `{id, version, sha256}` (`session.js:223`; `method.js:114`) and appended exchanges (`sharedResearch/store.js:470`). Adopt writes a list, version v1 and closes the record (`sharedResearch/store.js:690–694`). | The question's thread could live in a session; the question itself lives on its `researchWork` record. | On (`SHARED_RESEARCH_MODE='allowlist'`, `sharedResearchFlags.js:50`); 0 sessions MEASURED |

#### E2. Updates without changing earlier evidence

- **Hypothesis versions:** content hashed (`hypothesisRecords/model.js:279`); an edit is always a new version (`:25`) by `tx.create` (`hypothesisRecords/store.js:188`), the old one pointed to its successor (`:189`); review evidence is stored once, outside the hash (`hypothesisRecords/review.js:40`); a deploy re-checks the frozen content (`carriage.js:65`). This is the immutability a saved plan needs.
- **researchWork:** created by `tx.create` (`researchRecords/store.js:78`); findings append-only with `supersedes`, the chain never forks (`researchRecords/model.js:868`); summary revisions append-only (≤ 20). Enforced in code; rules only deny client writes. No content hash.
- **setupEvidence:** created once, never updated, never gains a field (`setupEvidence/store.js:116`; `acquire.js:39`). A new session's snapshot is a new document — exactly "new data creates an updated assessment with a new observation time".
- **Practice Field:** the contract is frozen at admission (`admission.js:253`) with a status history (`:248`).
- **Shared Research:** exchanges append-only; the method is stamped.

#### E3. Before the Film Room and any experiment runner

What exists: (1) the hypothesis review pass, a reflections-cron tenant (`process-pending-reflections.js:308`), which only moves an activated, deployed version to `review_due` when its horizon elapses or its battle ends (`reviewPass.js:40–41`); `invalidated` is never written (`hypothesisRecords/review.js:13`); conditions are copied into battles (`agentBattleService.js:226`) and nothing evaluates them (INFERRED). (2) The review card's market comparison, computed once on a GET (`hypothesisRecords/review.js:8`). (3) Film Room Watch recurrences, derived at read time, nothing stored (`filmRoom/cardCounter.js:19–20`). (4) The Practice Field runner, dark, with no line-break exit (NOT FOUND); the Film Room `testing`/`tested` stages have no production caller (`cardStore.js:834`). **No experiment runner, no scheduler of saved questions, no background monitoring of a saved plan.**

So "save this question" can honestly do one thing today: write a record the player can see again. Existing lines a screen could show without implying a test ran:

- "It doesn't read or learn from your ideas yet." (`src/components/CommandCenter/hub/hubCopy.js:309`)
- "Saved, not equipped. You can equip it later from the Forge." (`src/components/SharedResearch/sharedResearchCopy.js:257`)

A chart-specific line would be new copy; it would go through `sheetCopy.js`, whose honesty test scans every template (`sheetCopy.honesty.test.jsx:27`, `:31`), and Table E forbids claiming an action the mode cannot perform (`docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md:77`). No player string says "not tested" or "we'll check" today (NOT FOUND).

#### E4. The Battle Research schema v2 request

Appendix A asks for `researchWork` at schema v2: origin `battle_research`, host `agentBattles`, the question and steps, frozen evidence per result (rankings with `computedAt`, quotes with `priceAsOf`), the order, conditions and outcomes, new source kinds `agentBattles`, `intradaySnapshots`, `voiceLayerCache`, and a Film Room reader (`BATTLE_RESEARCH_SLICE1_SPEC_V1.md:242`); Slice 2 depends on it (`:236`). **A saved question fits that request** (`question {id, text, incumbent}`, `:157`). **A chart plan does not:** the spec's `conditions` are view filters (`:159`), not price conditions with a cutoff. A plan needs either its own fields in the same v2 (conditions in the hypothesis shape, an explicit as-of, a rule-set and method version, a chart origin) or a hypothesis version that cites the snapshot. Note also that v2's one-record-per-host scheme (`researchRecords/model.js:31`) meets Battle Research's 10 investigations a battle (`:113`): a per-investigation host id or a scheme change is needed (INFERRED).

### Part F — The agent's side

#### F1. The Ask path as built

- **Model and budget.** A research Ask is one ordinary battle-mode voice turn: Gemma `google/gemma-4-26b-a4b-it` through OpenRouter (`gemmaClient.js:45–46`), 800 output tokens and temperature 0.7 by default (`:47–48`; `api/agent/chat.js:836` passes no override), `json_object` mode with no schema (`:137`); 19 s for the call, a 24 s turn deadline, `maxDuration` 30 (`api/agent/chat.js:114–115`, `:75`). It spends one of the battle's 10 chat turns (`directiveFiling.js:97`; `api/agent/chat.js:1170`). `chat-budget.js` is the League per-day counter, not a token budget (`:3`); no input token budget exists on the chat path (NOT FOUND). Gated by `RESEARCH_MODAL_SHEET_MODE='allowlist'` (`researchAsk.js:113`; `researchModalFlags.js:122`), battle mode only (`api/agent/chat.js:517`), never a League ask (`:448`).
- **Output shape.** Free text: the player sees the JSON's `response` (`api/agent/chat.js:1015`; `voiceLayerPrompt.js:72`). The Ask block asks for "two or three sentences … Name the item you lean on by its number" (`voiceLayerPrompt.js:3394`) and the weakest-spot guide asks for "what would change your mind, and the strongest alternative" (`:3406`) — in prose; nothing parses, enforces or validates it. Only an unparseable reply fails (502, `api/agent/chat.js:892`).
- **The pack.** Up to 5 items (`packs.js:121`; `researchAsk.js:45`) of 26 kinds (`packs.js:76–83`), each fact ≤ 200 characters (`:200`), shape `{kind, symbol, fact, source {recordKind, recordId, label}, at, asOf, …}` (`:13`). `SERVER_KINDS` (`:181–185`) are the kinds the server can rebuild from the battle document alone: it re-runs the same pure builder `candidateItems` (`researchAsk.js:138`, `:142`), and a client item whose kind and `recordId` match is replaced by the server's own, marked `verified` (`:148`, `:151`); everything else stays `unverified` with a reason (`:152`, `:154`). The server reads nothing but the battle document `chat.js` already holds (`api/agent/chat.js:752`). The exchange persists only the symbol and question id, not the verified items (`:1144`).
- **Could a chart Ask carry setup facts as verified pack items?** Not by the same mechanism. The client builds the pack and cannot read `setupEvidence` (rules deny it), so the server must originate those items; `candidateItems` is synchronous, pure and bundled into the client (`packs.js:5`), while `readSnapshot` is an async server read; `packs.js` may not import the store, and even adding the string `'setupEvidence'` to its `RECORD_KINDS` (`:92–93`) trips the guard's regex (`setupEvidenceImportGuard.test.js:30`, `:152`) — which is why `findingRecordKinds.js` exists as a data-only listed module (INFERRED). What it takes: a server-originated item kind, an `api/` reader calling `readSnapshot` only (precedent `setupMenuLabels/reads.js:44`), listed in the guard; `chat.js` awaiting that read inside its 24 s deadline; new question ids (`packs.js:71`).
- **Can the route enforce a shape?** Not today. Shared Research is the precedent: a JSON-schema structured output (`output_config.format`, `modelTurn.js:91`), **not** tool use; step model `claude-sonnet-5-5`, frame `claude-haiku-5-5` (`:29`), 2,500 / 600 tokens (`:30`), effort low, SDK retries off and one transport retry (`:62`, `:15`); a refusal, a cut-off or an unparseable output becomes a typed failure (`:122–128`); closed schemas with every key required (`stepSchema.js:93`), lengths and counts checked in the validator (`:8`); a failed validation is never re-asked and fails the step with `invalid_<rule>`, nothing appended (`:14`; `api/forge/shared-research.js:435`). Its step schema already has `reply`, `summary` with `basedOn`, `lines.support` / `complication` / `missing` and one next step (`stepSchema.js:97–127`) — that is *leading read, what confirms, strongest alternative or what breaks, one next action*. It has no horizon field.

#### F2. Levels that trace to measurements

Precedents exist for a model choosing among supplied items by id, all validated after the call (no schema enumerates the allowed ids):

- **Shared Research:** a retrieval cite is an item **number**; an unknown number downgrades the finding to an uncited inference (`stepSchema.js:109`, `:550`, `:558–562`); an unknown finding id in `support.from`, `supersedes` or `basedOn` fails the step (`:567`, `:588`, `:702`); unknown `lines` refs are dropped (`:713`); a reply stating a number no verified finding holds is replaced (`:735`).
- **Cockpit fork options:** the model names 2–4 tickers (`agentEvalToolSchema.js:325`, `:337`); any outside the battle universe or unable to come in removes the whole fork, never rewriting it (`callRecords/validate.js:203`, `:208`, `:20`).
- **Directive gate (live, `ARCHETYPE_INTEGRITY_MODE='enforce'`, `featureFlags.js:779`):** an id outside the archetype menu gets one repair, then null and a canned line (`directiveGate.js:148`, `:179`, `:339`, `:353`).
- **The contrast:** the called-shot `level` is a number the model writes, checked only for being within 25 % of the quote (`agentEvalToolSchema.js:279`; `validate.js:110`). And the research Ask asks for an item number but validates nothing.

So "every level traces to measured geometry, a record, or the player's annotation" has a working pattern: give the model the levels as numbered items (the record's swing low, SMA20 value, extension limit; a hypothesis level; a player pin) and accept only a cited id — Shared Research's validator is the template.

#### F3. Method retrieval

- `KB_APP_USE` ships empty (`kb/authorizations.js:40`), pinned (`packages.test.js:447`); with it empty every load answers `not_authorized` (`:8`). One package is committed: KB-IDEA-EVALUATION-001 v0.1 (`packages/index.js:17`), accepted 12 Nov (export JSON `:27`, `:29`). **KB-TRADING-CONTEXT-001 is not in the repository** (grep, NOT FOUND).
- **What an entry grants:** app use of one package version's exact bytes — `id`, `version`, `sha256` (the method text), `acceptanceSha256` (the acceptance record) — to a list of `consumers`, for an `audience` of `'allowlist'` (the cockpit allowlist) or `'all'`, with `newSessions`, `authorizedAt`, `authorizedBy` and an `evidenceRef` under `docs/approvals/` (`loader.js:82–83`; `authorizations.js:25–36`; `audience.js:35`; `loader.js:62`, `:329`). Exactly one new-session entry per consumer (`loader.js:341`, `:412`). There is no consumer registry: a consumer is any non-empty string (`:340`); the only one in code is `shared_research.observation` (`sharedResearch/method.js:61`); `research_modal.analysis` appears only in a test (`loader.test.js:441`); Amendment A plans a later package whose first consumer is the research modal or Battle Research, "same loader, its own consumer id and entry" (`20261113_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_A_KB_METHOD.md:299`).
- **What a chart Ask would need:** a package (v0.1 is about evaluating an idea, not reading a chart; a chart method would be a new package imported and accepted, KB-0's path); an authorization entry with its approval record, moving the empty-list pin in the founder's commit; **a boundary change** — only `sharedResearch/method.js` may import or name the loader's entry points, may not hand them on, and calls take one argument (`kb/boundary.test.js:370`, `:401`, `:433–434`, `:550`) — so either `method.js` grows a chart function or the boundary row moves, as KB-1 did; a method marker for the worked-example check (`method.js:215`); a prompt-honesty registry entry for the module that renders it (`stepPrompt.js:5`); and a prompt budget, which the chat path does not have.
- **The largest method text.** The chat Ask has no prompt budget to measure against (NOT FOUND). Shared Research's caps are 12,000 tokens soft and 16,000 hard, counted as characters ÷ 4, system prompt included and never trimmed (`promptBudget.js:12–13`, `:20`, `:25`, `:58`). v0.1's method text is about 8,300 characters, about 2,070 tokens (derived from the export line), and the measured step prompt grows from 1,622 to 3,535 tokens with it (`kbMethod.checks.test.js:135`). Under the hard cap, a method of about 14,000 tokens (about 56,000 characters) would leave almost nothing for the turn (INFERRED).

#### F4. Who proposes, who decides, who executes

For each context: the piece that (1) assembles evidence, (2) selects the method, (3) reasons, (4) checks an action, (5) executes. **MISSING** means no separate piece exists at HEAD. 27 of the lines below were re-read by the coordinator (Method).

| Context | (1) Evidence | (2) Method | (3) Reasoning | (4) Action check | (5) Execution |
|---|---|---|---|---|---|
| **Research outside a game — Shared Research** (`'allowlist'`, live) | `retrieve` (Exa, one search a step, `api/forge/shared-research.js:379`), stored facts at open (`:284`), `fitPrompt` (`:394`) | `selectMethod` once (`:176`; baseline unless own words, `method.js:141`), `effectiveMethodFor` every turn (`:347`) | one Sonnet 5.5 step turn (`:418`; `modelTurn.js:29`) | `validateStepTurn` (`:431`); for adopt, the preview revision and "every number backed" (`sharedResearch/store.js:628`, `:636`) | `recordStep` writes findings; `adoptIdea` writes a committed list with `agentId: null` (`sharedResearch/store.js:673–690`). **Nothing trades** (`sharedResearchFlags.js:45`) |
| **Research outside a game — the idea book** (`PRACTICE_FIELD_MODE='off'`, dark) | **MISSING** (the T1d drafting envelope) | **MISSING** for drafting (the epoch freezes only the gate limits) | **MISSING**: "T1d's drafting call will call `admitIdea`" (`admission.js:5`); no manager call (`mandate-evaluate.js:175` skips idea books) | `evaluateAdmission` / `admitIdea`, code, one transaction (`admission.js:106`, `:294`) — no caller | `enterIdea` / `executeIdeaFill`, code, no model (`entry.js:6`; `fills.js:21`); **line exits not built** (`fills.js:4`) |
| **The mandate portfolio** (quarterly product retired; engine lit) | `assembleMandatePrompt`, a closed input allowlist (`mandatePromptAssembly.js:14`) | the pinned vintage: model seat, gate config, verbs (`mandatePromptAssembly.js:6`; `mandate-evaluate.js:574`, `:244`) | `callModel` (`mandateModelCall.js`; `mandate-evaluate.js:278`), one action of `verb, ticker, sizeUsd, conviction, rationale` — no stop, no target (`mandateDecisionTool.js:29`, `:36`) | `normalizeDecisionInput`, then the deterministic `evaluateGate` (`mandateGate.js:3`; exits never blocked, `:10`) and `validateEnvelope` inside execution | `executeDecision`, one atomic transaction (`mandateExecution.js:3`) |
| **A BaggerBomb battle today — deploy** | market CSV, stories, the equipped list (`decide.js:426`, `:384`) | **MISSING as a separate piece**: archetype rankings and temperatures feed a Sonnet 4.6 strategy call that acts as the method (`decide.js:30`, `:443`) | Haiku 4.5 portfolio call (`:567–568`) | `validatePortfolio`, a retry, an algorithmic fallback (`:598`, `:646`) | `createAgentBattle` (fenced, `:964`) |
| **A BaggerBomb battle today — each check** | prices, quote guard, scores, news, momentum, built by the fenced assembler (`agent-evaluate.js:3152`) | **MISSING as a separate piece**: archetype config, the `'balanced'` preset (`agentBattleService.js:287`) and the frozen guardrails sit in fenced files; the trigger gate decides *whether* to reason (`agentTriggerGate.js:2`) | Haiku 4.5, `HOLD` or `SWAP` only (`agentEvalTransport.js:64`; `agentEvalToolSchema.js:14`); no stop or target field (`:10`) | `applyGuardrails`, deterministic, after the model (fenced; `agentGuardrails.js:4`; `agent-evaluate.js:3663`), `validateTradeDecision` (`:3817`), the lock, the autopilot guard (`executionAuthority.js:25`) | `executeSwapServer` (fenced), six call sites pinned by a test (`agent-evaluate.test.js:161`) |
| **Trader v1 as adopted** (ASSUMED; source documents not available) | as today | as today, plus "inside the archetype's range" — **no per-archetype range for a declared stop or target exists** (NOT FOUND in `agentArchetypeConfig.js`, `archetypeRegistry.js`, `src/data/archetype*.js`; bust, VWAP and trail levers are per preset, `agentArchetypeConfig.js:14`) | the model declares a stop and a target when a position opens — new fields on the mid-battle tool (report `:801`) | a code-only pass on every battle on every check (report `:342`) — today guardrails run only when the gate wakes the model or on three special paths (`agent-evaluate.js:2958`; report `:335–336`) | a seventh exit site or an exit to cash (report `:343`; open question 13); the legacy executor's missing-quote fallback to the entry price contradicts BB-7's "a missing price never produces a fill" (`agentSwapExecution.js:337`, latent) |

**Who proposes, who decides, who executes — by context.**

- **Research outside a game.** The player proposes (an observation, a direction, the adopted statement); the model proposes findings and a next step; **code decides** what is kept (the validator; "every number backed" on adopt) and **the player confirms** adoption (the confirm exchange is the player's, `sharedResearch/store.js:648`). Nothing executes a trade; a list reaches a game only through the existing equip routes (`sharedResearchFlags.js:47`). For the idea book the design is "The agent drafts; code admits." (`20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:108`) and "Code enters, exits and settles; the model manages." (`:15`); the direction note adds that the player "influences, never manages" and "the agent chooses, and it may decline with a reason" (`20261113_DIRECTION_NOTE_GAME_AND_ACCOUNT.md:18`). At HEAD only the code halves exist, dark.
- **The mandate portfolio.** The model proposes one action; the vintage fixes the policy; code gates and executes atomically. The quarterly product is retired by the supersession note (`docs/20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md:8`, `:12`) — whose adoption line is still blank in the repo (`:26`) — and the engine is the idea book's substrate. The master, eval and close flags are still true (`featureFlags.js:1934`, `:1945`, `:1955`); MEASURED: 0 `mandates` documents. A chart plan has no seat here.
- **A battle today.** The model proposes a swap at one site, only when the trigger gate wakes it; code proposes at the others (risk, suppression, gameplan); deterministic guardrails and validation decide; the fenced executor executes, at the observed quote; under autopilot no player approves anything. Stops and targets are one battle-wide percentage frozen at creation (`agentGuardrails.js:262`), and per the trader-game Phase 0, no battle has ever carried one.
- **Trader v1 (ASSUMED).** The model would declare a stop and a target at open; code would execute at the first observed price after the crossing (BB-7). The pieces that exist: a deterministic exit layer that runs without a model, the swap executor, entry prices, the measured executor's refusal of an undated exit quote (`stockThresholdAdmission.js:254`). New: the tool fields, a per-archetype range, per-position storage of the levels (fenced executor and battle creation), a code-only pass on every check, a seventh exit site, levels for the opens that have no model output, and a quote-age rule (the report's open questions 13–16 at `:866–869`; their 15 Nov answers were not available). The Battle Research spec, written the day before, still calls this direction "not adopted" (`BATTLE_RESEARCH_SLICE1_SPEC_V1.md:236`).
- **Battle Research.** The agent proposes a question, as a deterministic template; it never trades, files an instruction or writes; a draft goes into the composer and sending it is the player's choice (`BATTLE_RESEARCH_SLICE1_SPEC_V1.md:11`, `:19`, `:21`).

**What this means for the chart.** In every context the action check and the execution are code that a chart plan never touches. A chart plan is research: it may propose a question or a conditional reading, and the only executable path from it is the one that exists for research today — save, then equip through the Forge. A "what breaks it" level in a chart plan is a thesis invalidation (the hypothesis shape, `daily_close`), not a stop: the game's stops are battle-wide percentages today and declared-at-open levels under trader v1, owned by the check loop.

#### F5. The smallest change

**No redesign is needed. Evidence:**

- The separation the handover asks about already exists, in Shared Research's route: method selection (`effectiveMethodFor`, `api/forge/shared-research.js:347`) → evidence (`retrieve`, `:379`) → budget (`fitPrompt`, `:394`) → one schema-enforced model turn (`:418`) → validation (`validateStepTurn`, `:431`) → persistence.
- The chat route already separates evidence (step 13c, the server re-verification, `api/agent/chat.js:748`), the prompt (`:757`), the model call, parsing and action checks (the directive gate, `:916`). What it lacks: method selection, answer validation for the Ask, and keeping the verified items with the exchange.
- Action checks are deterministic code in every context (F4).

**The smallest change is three attachments to the chat Ask, not a new agent:** (1) a chart evidence kind the server originates from the stored snapshot through a `readSnapshot`-only reader; (2) an answer shape — Shared Research's JSON-schema turn and validator, plus a horizon field, with levels cited by item id (F2); (3) a KB consumer entry and the boundary change (F3). Whether the Ask stays a Gemma voice turn (no schema enforcement) or becomes a Claude structured turn like Shared Research's step is a founder choice (§5, Q-ASK).

### Part G — Fit with the research screen as built

**Where the read sits.** The Chart view, top to bottom: the stock row and view pills; StockChart's control row (1D · 1W · Battle; SMA · S/R · Idea, `StockChart.jsx:1105`); the plot (view height − 44 − 72 px, 240–560, `shellView.js:96`) with one open-pin caption that belongs to the record (`StockChart.jsx:1135–1137`); the record-day chips (`AssetResearchModal.jsx:959`); TechnicalTabV2 in the same scroll (`:969`); the pinned action row. **There is no read slot, on purpose:** the shell lists "No stop price; no technical-read strip" (`RESEARCH_MODAL_SHELL_SPEC_V1.md:42`), R-30 says the strip "waits for Build B. No placeholder rows." (`RESEARCH_MODAL_DIRECTION_V2_AMENDMENT_C_20261112.md:33`), and Build B comes "into the Chart view, when the setup-evidence read route exists" (`:77`). R-17 binds it: "The modal reads setup evidence; it does not measure it." (`RESEARCH_MODAL_BUILD_PLAN_V1_OCT29_2026.md:21`), and S-1 makes the line a free deterministic template unless the founder rules one cached call per stock per day (`:11`). The natural place is the 72 px band between the plot and the Technical content, where the day chips sit (INFERRED). The sheet's flag is `RESEARCH_MODAL_SHEET_MODE='allowlist'` (`researchModalFlags.js:122`) — the spec header still says `'off'` (`:5`); the code wins, and the spec's §11.5 agrees with the code.

**Does the plumbing cover it?** `recordPinsOf` lives in `packs.js:925` (not `useSheetView.js`, which imports and calls it, `:44`, `:173`); it returns markers (entry, calls, answers, the latest check, `packs.js:928–944`) and horizontal lines (the entry, group `record`; the idea's live/wrong levels, group `idea`, `:949`, `:955`). `rungLinesOf` adds 💣's next rung each way on Battle for a held, measured holding (`battleChart.js:157–166`; `useSheetView.js:218`); `dayMarkersOf` merges a day's markers into one counted dot on 1D/1W (`battleChart.js:137`).

- **(a) Moving-average lines — not covered.** No helper draws a line over time. StockChart's only line series are its own SMA overlay (20 and 50, hard-coded, untitled, `StockChart.jsx:812`, `:821`) and the trend lines; Battle gets no SMA (`AssetResearchModal.jsx:941`); there is no 200-day line data (`sma200` is a single value, `useResearchData.js:817`; the 1D chart is clipped to 180 days, `:167`, about 125 sessions).
- **(b) A marked bar — covered mechanically** (`createSeriesMarkers`, `StockChart.jsx:1007`, `:1017`), but on 1D/1W a new marker would be merged into the record's day count, and its chip opens Battle (`sheetCopy.js:292`).
- **(c) A level line — covered** on 1D, 1W and Battle, not on 💣 (`StockChart.jsx:961`), with group, colour token and dash (`:986`). Battle's price scale takes in only record and rung lines (`:965`). All of it exists only when the battle sheet is on (`AssetResearchModal.jsx:952`).

**Conflicts.**

| Candidate | Verdict | Evidence |
|---|---|---|
| No stop line is drawn, because the game stores no stop price | **Confirmed.** "The record stores no stop or target … It never computes a stop price." (`RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md:86`); "No stop price anywhere." (Amendment C `:57`); the honesty test rejects "stop" or "target" beside a $ price (`sheetCopy.honesty.test.jsx:31`, `:90`). The game's executable exits are rules checked each check, not stored prices — a trailing exit above 1.5 × ATR on a break of the 5-minute SMA20, the emergency exit at −0.85 × ATR (`agentRiskManager.js:168`, `:120`; fenced). |
| A plan's "what breaks it" level against 💣's rung lines | **Confirmed.** The idea's invalidation already draws as "wrong below $X" (`sheetCopy.js:251`), red and dashed; 💣's down rung is the same red token (`useSheetView.js:89`) and dashed, but always titled (`:260`; `StockChart.jsx:988`). A plan level would be a third red dashed line, and Battle's scale can push it off screen while it pulls the rungs in. |
| A daily read on Battle's 5- and 30-minute bars | **Confirmed for a line, partly for a level.** "no daily SMA over intraday bars" (`RESEARCH_MODAL_SHELL_SPEC_V1.md:221`; `AssetResearchModal.jsx:936`); the setup is daily bars only (`TREND_FOLLOWER_SETUP_DEFINITION_V1.md:4`); Battle's bars cover 5 or 20 days (`battleChart.js:35`, `:37`). Daily levels already reach Battle (S/R, the idea and entry lines, `StockChart.jsx:852`), so a labelled daily level has precedent; a daily line does not. |
| Nothing calls a model on open | **Confirmed.** "Tapping a question costs nothing and calls no model" — R-15, which lives in Direction V2 (`RESEARCH_MODAL_DESIGN_DIRECTION_V2_OCT17_2026.md:20`), not Amendment C; "The agent's read is assembled from records, never generated on open." (`RESEARCH_MODAL_REDESIGN_CONCEPT_V1_1_OCT17_2026.md:17`); the shell adds no provider and no model call (`RESEARCH_MODAL_SHELL_SPEC_V1.md:13`); Battle Research makes neither (`BATTLE_RESEARCH_SLICE1_SPEC_V1.md:21`). The opening read must be the deterministic template over a stored record; a cached daily model call needs a ruling. |

Other concrete conflicts: the shell's copy rule ("No "will", no agent verbs, no "live"", `RESEARCH_MODAL_SHELL_SPEC_V1.md:47`) and Battle Research's (no *will*, *should buy*, *likely*, `BATTLE_RESEARCH_SLICE1_SPEC_V1.md:230`) bind a plan's wording; the setup "never fires a trade by itself" (`TREND_FOLLOWER_SETUP_DEFINITION_V1.md:47`); §9 display agreement — the 200-day position already comes from the rankings (`buildTechnicalSnapshot.js:76`) and the modal's own single SMA200, and the last 1D candle is live-patched (`useResearchData.js:759`) while a record is dated to the last completed session.

**What must be labelled** so the three are never confused (today lines are told apart by group, colour, dash and short titles, `sheetCopy.js:249–254`; S/R and SMA lines carry no label, `StockChart.jsx:876`):

- **A thesis invalidation** (the player's or the agent's idea): an always-visible title naming whose idea it is, a colour that is not the rungs' red, wording that it does not trade.
- **A research outcome rule** (an evaluator check): the rule's identity (`tf-setup-v1`), "daily · raw · as of {session}", wording that it informs and never fires.
- **An executable stop:** the game stores none as a price, so none is drawn; if it is shown at all, in words, as BC-5 does.
- 💣's rungs are a fourth kind (scoring levels) and keep their tokens. Every new label goes through `sheetCopy.js` so the honesty test scans it.

### Part H — What is missing for the first release

Each row sits in exactly one column.

| # | Missing thing | KB content | Typed detector output | Data acquisition | Route or record change | Design |
|---|---|---|---|---|---|---|
| H1 | A method for reading the pullback-and-resume combination: what each ingredient adds, where they overlap, the competing reading (KB-TRADING-CONTEXT-001 is not in the repo; the only package is KB-IDEA-EVALUATION-001) | ✔ | | | | |
| H2 | Plain definitions of the ingredients the read names (the 20/50 regime, the touch, the extension guard, the volume floor, sector RS percentile) | ✔ | | | | |
| H3 | Which of the three pullback bars touched (only the three lows and today's SMA20 are recorded) | | ✔ | | | |
| H4 | A measured "what breaks it": the holding verdict (`evaluateTfHolding`) has no production caller | | ✔ | | | |
| H5 | A sector-relative move with a magnitude and a window (only a 20-bar within-sector rank is stored) | | ✔ | | | |
| H6 | A 200-day reclaim event (only if C2 is chosen) | | ✔ | | | |
| H7 | A snapshot for the stock and session a player opens — production holds 0; a sweep of the 228 ranked stocks is ~228–274 `/eod/` calls a day against no budget (D-6) | | | ✔ | | |
| H8 | A daily window deep enough for a 200-day average in the store (130 calendar days today; only for C2) | | | ✔ | | |
| H9 | A comparable intraday volume reading (none; daily readings exist) | | | ✔ | | |
| H10 | The setup-evidence read route (`readSnapshot` only, owner-scoped, a guard entry) | | | | ✔ | |
| H11 | A server-originated chart evidence kind in the Ask, and keeping the verified items with the exchange | | | | ✔ | |
| H12 | An enforced answer shape for the chart Ask (leading read, alternative, confirms, breaks, horizon, next action; levels cited by id) | | | | ✔ | |
| H13 | Plan fields — evidence cutoff, method version, chart origin — on a hypothesis version or in researchWork v2 | | | | ✔ | |
| H14 | A KB authorization entry for a chart consumer and the boundary change that admits it | | | | ✔ | |
| H15 | The read strip's place and template wording (Build B, R-30: no placeholder) | | | | | ✔ |
| H16 | The line taxonomy and labels: thesis invalidation / research rule / stop / 💣 rung; the red collision | | | | | ✔ |
| H17 | The basis ruling's display (raw candles when a record is drawn) and the "no measured read yet" and "saved, not tested" states | | | | | ✔ |

---

## 3. Facts that constrain the build

1. **Production holds no setup evidence.** `setupEvidence` 0, claims 0, activation pointers 0, against a control of 645 battles (MEASURED). Every read the handover describes starts empty.
2. **The only live writer will not fill it for a chart.** The observer acquires only for allowlisted owners' Trend Follower battles from the last 14 days (`scope.js:30`; `activationEvidence/constants.js:46`), at most 12 a run (`activationEvidence/constants.js:34`); those owners' last such battle was 31 Oct (MEASURED). The dark Slice 2 tenant covers only Trend Follower battles' hot benches (`setupMenuLabels/pool.js:39`, `setupMenuLabels/tenant.js:262`).
3. **No provider-call budget exists to approve an acquisition against.** No global counter; the only ceiling is Mandate's, alert-only (`mandateConfig.js:116`, `:120`); D-6 is unresolved (`setupMenuLabelsFlags.js:25–26`).
4. **The client cannot read a setup record, and no route can today.** `firestore.rules:1262–1266`; NOT FOUND in `api/` routes.
5. **A read route may never acquire.** `readSnapshot` never fetches (`setupEvidence/index.js:34`); `getOrAcquireSnapshot` calls the provider under a lease (`setupEvidence/index.js:53`) — and the shell forbids a provider call on open (`RESEARCH_MODAL_SHELL_SPEC_V1.md:103`).
6. **The evaluator is daily, completed-session, raw.** `tfSetupV1.js:26`; `dailyBarsAdapter.js:60`, `:102–104`. It cannot be drawn as a line on Battle (`RESEARCH_MODAL_SHELL_SPEC_V1.md:221`).
7. **The 1D candles are adjusted and nothing else on 1D is.** `chartUtils.js:151–159`; a stored window shows raw and adjusted ATR14 differing by $0.12 on NSC (MEASURED).
8. **A record holds single values, not series.** `tfSetupV1.js:318`; no touch bar (`:180`); the chart has no 200-day line data (`useResearchData.js:842`, `:167`).
9. **The modal reads evidence and never measures it** (R-17, `RESEARCH_MODAL_BUILD_PLAN_V1_OCT29_2026.md:21`), and the read slot waits for the route with no placeholder (R-30, Amendment C `:33`, `:77`).
10. **No stop price may be drawn or written beside a price** (`RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md:86`; `sheetCopy.honesty.test.jsx:31`).
11. **No model call on open** (R-15, Direction V2 `:20`; shell `:13`).
12. **The Ask is a Gemma voice turn with no enforced shape and no method** (`gemmaClient.js:46`, `:137`; `voiceLayerPrompt.js:3394`).
13. **The KB grants nothing to anyone yet, and only one file may load it.** `authorizations.js:40`; `boundary.test.js:370`, `:401`.
14. **The setup store's importers are named one by one.** `setupEvidenceImportGuard.test.js:33`, `:111`; even the string in `packs.js` trips it (`:30`).
15. **A saved question has one home today, and only for Shared Research's origin** (`researchRecords/model.js:486`); a plan's closest home is a hypothesis version, which has no explicit cutoff or method version (`hypothesisRecords/model.js:234`).
16. **Nothing tests, schedules or monitors a saved idea** (`hypothesisRecords/review.js:13`; `cardStore.js:834`; `PRACTICE_FIELD_MODE='off'`).
17. **Records carry no owner** (`tfSetupV1.js:51`), so owner scope comes from the battle or list, as in `battle-research-quotes.js:175`.

## 4. The smallest build sequence the code supports

Sizes are by comparison with merged builds in this repo (`git diff --shortstat` of each merge; review rounds from their reports), never by calendar.

| Step | What | Depends on | Comparable past build |
|---|---|---|---|
| **0** | Founder rulings: Q-SETUP, Q-ACQ, Q-BASIS, Q-PLAN, Q-ASK (§5) | — | — |
| **1** | **Acquisition:** a server tenant that makes a snapshot exist for the stocks a player can open (the 228 ranked, or a narrower list), for the last completed session, under an approved provider allocation; or the zero-new-call variant, where index-intelligence hands its raw payloads to the store | Q-ACQ; D-6 | #1034 setup menu labels (a seventh tenant with its state and rules: 44 files, +7,008; three lenses, an independent review, a second review). Smaller if it reuses the Slice 2 tenant with a different pool (INFERRED) |
| **2** | **The read route:** `readSnapshot` only, owner-scoped through the battle, a copied projection, a guard entry; answers "absent" until step 1 lands | none (can precede step 1) | #1065 Battle Research engine (route, gate, tests: 32 files, +4,894; three lenses and a refuter) |
| **3** | **Build B, the read on the Chart view:** the deterministic template (S-1) from the record, the touch and swing markers, the SMA20 and extension levels as labelled lines, the basis rule, the absent state | 2; Q-BASIS | #1056 Battle chart (15 files, +1,335; four lenses, one refuter, 13 confirmed / 7 refuted) with #1055's copy work (24 files, +1,426) |
| **4** | **The chart Ask:** a server-originated evidence kind read through step 2's reader, numbered levels, an answer schema with a validator | 2; Q-ASK | KB-1 #1062 (18 files, +2,631) if it stays in the chat route; Shared Research B1 #1048 (50 files, +8,738) if it becomes a structured turn of its own |
| **5** | **Save the plan and the question:** plan fields on a hypothesis version (or researchWork v2, shared with Battle Research's request), a chart origin, honest copy | Q-PLAN | Research Record Extension #1030 (33 files, +3,633) |
| **6** | **The method:** a chart KB package imported and accepted, an authorization entry, the boundary change | KB content (H1, H2); the founder's authorization | KB-0 #1054 (17 files, +3,208) for the package; KB-1 #1062 for the consumer |
| later | A 200-day reclaim detector (C2) | Q-SETUP; a generalised store fetch | #1001 (21 files, +20,890; five lenses, 55 findings, 13 founder questions) + #1004 (5 files) + part of #1018 |

Order: 0 → (1 ∥ 2) → 3 → 4 → (5 ∥ 6). Steps 2, 3 and 4 each cross BUILD_RULES §2's review threshold by their precedents. Step 3 without step 1 would ship a strip that is always "absent", which R-30's no-placeholder rule argues against: 1 must land before 3 is switched on.

## 5. Founder questions

**Q-SETUP — which setup first?**
- *(a) Trend Follower pullback-and-resume (recommended by the evidence).* No detector work; the record, versions and verdicts exist; the read says "pullback and resume", never "reclaim". Changes: steps 1–5 only.
- *(b) A 200-day reclaim.* A new definition, blessing and build the size of #1001 + #1004, and a longer store fetch. Changes: adds the "later" row before step 3.

**Q-ACQ — who makes a snapshot exist for the stock a player opens?**
- *(a) A daily sweep of the 228 ranked stocks* (~228–274 `/eod/` calls a day, INFERRED). Needs D-6 resolved: the allocation's unit, window, consumers, retries.
- *(b) The zero-new-call path:* index-intelligence passes its raw `/eod/` payloads to the store. Needs a change to that cron, a guard entry, and a ruling that a shared payload counts as "the instant received".
- *(c) Only the stocks in allowlisted battles* (fewer calls, smaller audience).
- Acquiring on open is not an option: it is a provider call on open and a write from a read path.

**Q-BASIS — which basis does the 1D chart draw?**
- *(a) Raw candles whenever an evaluator fact is drawn* (exact; a split shows as a cliff).
- *(b) Raw candles always* (also aligns the SMA overlay, S/R and record lines that are raw today).
- *(c) Keep adjusted candles and scale each fact by the chart's own row factor* (approximate; wrong across an ex-date inside the span).

**Q-PLAN — where does a conditional plan live?**
- *(a) A hypothesis version* with three new fields (evidence cutoff, method version, chart origin): content-hashed and superseded by version already.
- *(b) researchWork schema v2*, in the same request as Battle Research's Appendix A, with plan fields of its own.
- *(c) A new record* (the handover asks to avoid this unless a gap is proven; none is).
- A saved question goes with Battle Research's v2 `question` in (a) and (b) alike.

**Q-ASK — which model answers a chart plan, and is its shape enforced?**
- *(a) A structured turn like Shared Research's step* (Claude, JSON schema, validator, levels cited by id).
- *(b) The current Gemma voice turn with a prompt-only shape* (cheaper; nothing enforces the six parts or traces a level).

**Q-OPEN — the opening read.** *(a)* The deterministic template (S-1), no model call. *(b)* One cached model call per stock per trading day (needs a ruling against R-15).

**Q-KB — whose method does the chart Ask carry?** KB-TRADING-CONTEXT-001 is a reviewed candidate outside the repo. Importing it as a package, accepting it, and authorizing a chart consumer is the founder's chain (KB-0 → acceptance → `KB_APP_USE` entry).

**Q-TV1 — the trader v1 documents.** BB-7, BB-8, BB-18 and the 15 Nov ruling sheet's questions 13–16 were not available here. Part F4's trader-v1 row is ASSUMED until they are attached.

**Q-PROV — stopped on the provider rule.** Whether EODHD's `/intraday/` serves a `30m` interval, the window of the vendor's `averageVolume`, and the billing weight of `/eod/` can only be answered by a provider call or the provider's documentation. Not asked here.

**For separate tasking (found in passing, not fixed):** the allowlisted owners' Trend Follower battles of 23–31 Oct left no activation pointer although the observer flipped on 6 Nov with a 14-day window (A2); the live patch draws a stored adjusted close as the last 1D candle's close (B); `sharedResearch/store.js:186` reads a top-level `stockRankings/{sym}` that nothing writes (INFERRED); premarket pivots read the session before the last one (A4, INFERRED); `stockTechnicalScores` keeps 11 documents for symbols no longer ranked (MEASURED 239 vs 228).

## 6. Prompt-versus-code disagreements

| The prompt or a document says | The code says | Where |
|---|---|---|
| "the D-6 question in `src/config/setupMenuLabelsFlags.js`" | D-6 is condition (b) of the flag's flip there; the question's terms live in the Slice 2 spec | `setupMenuLabelsFlags.js:25–26`; `20261107_P3_SLICE2_BUILD_SPEC_DRAFT_V2.md:491` |
| Nine facts (A1) | Nine in code; the definition's §1 table names eight | `tfSetupV1.js:77`; `TREND_FOLLOWER_SETUP_DEFINITION_V1.md:25` |
| "the touch bar" is a field | No touch bar is recorded; three lows are | `tfSetupV1.js:180` |
| The anchor is recorded with the evaluator | Only on the activation pointer, without its date; the holding evaluator has no production caller | `pointer.js:121`; `acquire.js:130` |
| Three importers of the store | Three callers plus `writer.js`, `discover.js`, the census script and `findingRecordKinds.js` | `setupEvidenceImportGuard.test.js:38–63` |
| `useSheetView.js` `recordPinsOf` | `recordPinsOf` is in `packs.js` | `packs.js:925` |
| "Amendment C, R-15, R-30" | R-30 is in Amendment C; R-15 is in Direction V2 (Amendment C holds R-23 to R-35) | Direction V2 `:20`; Amendment C `:33` |
| Shell spec header: the sheet ships `'off'` | `'allowlist'` | `RESEARCH_MODAL_SHELL_SPEC_V1.md:5`; `researchModalFlags.js:122` |
| Four comments: nothing calls the setup store | Two cron tenants and a writer call it | `setupEvidence/index.js:6`; guard `:3`; build report `:7`; `compositionProtectedStoresAllowlist.json:578` |
| Census doc: 239 stocks | 228 ranked at HEAD (MEASURED 228 rows) | `20261007_EODHD_CALL_CENSUS.md:95`; `rankingConfig.js:381` |
| Nov 9 brief: "No 10-minute, hourly or 4-hour series" | Hourly is served (10 days); 10-minute exists as film-tape aggregation (past sessions, owner only); 4-hour has none | `historical.js:37`; `filmTape/bars.js:130` |
| Nov 9 brief: "30-minute bars over 20 days and 1-minute bars over one day, both behind a server cache up to an hour old" | Still true for 30m and 1m; 5m now has a 5-minute tier | `historical.js:10`, `:186` |
| Nov 9 brief: "No relative volume anywhere" | A daily relative volume exists (`volumeProfile.ratio`) and an intraday linear pace (`volumePace`); no time-of-day baseline | `compute-index-intelligence.js:1113`; `accumulator.js:278` |
| Nov 9 brief: "Candles draw the adjusted close; indicators and levels read the raw close" | Still true on 1D; 1W candles are raw | `chartUtils.js:151–159`; `historical.js:395` |
| `measuredStockThreshold.js` header: "no runtime scoring/admission consumers" | Admission imports it | `measuredStockThreshold.js:1`; `stockThresholdAdmission.js:4` |
| `technicalCalculations.js` "Mirrors algorithms from src/services/technicalIndicators.js" | Rounding differs (4 decimals vs none) | `technicalCalculations.js:6`, `:23` |
| Hypothesis model "No route calls this yet"; researchRecords "Nothing writes them yet" | Shared Research calls and writes both | `hypothesisRecords/model.js:375`; `researchRecords/model.js:42`; `sharedResearch/store.js:464`, `:594` |
| "trader v1 as adopted" | The Battle Research spec (14 Nov) calls the trader direction "not adopted"; the 15 Nov rulings were not available here (a timing difference) | `BATTLE_RESEARCH_SLICE1_SPEC_V1.md:236` |
| "the model declares a stop and target inside the archetype's range" | No per-archetype range for a stop or target exists; bust, VWAP and trail levers are per preset | NOT FOUND; `agentArchetypeConfig.js:14` |
| The mandate's supersession note retires the quarterly product | Its adoption line is blank in the repo, and the founder create endpoint can still mint a quarterly book | `docs/20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md:26`; `api/mandate/create.js:11` |
| "`api/mandate/`, the latest mandate spec" | The decision, gate and execution modules live in `api/_utils/mandate*.js`; the spec V1.4 and the note sit at `docs/` root | `mandateGate.js:3`; `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:2` |
| Shared Research route header: dark | Live for the allowlist | `api/forge/shared-research.js:7`; `sharedResearchFlags.js:50` |
| `mandate-evaluate.js` header: dark by construction | The flags are true | `mandate-evaluate.js:4`; `featureFlags.js:1934` |
| BB-7: "A missing price never produces a fill" | The legacy swap executor falls back to the entry price when the outgoing quote is missing (latent) | `agentSwapExecution.js:337` |
| The prompt's production rule: reads "only to count coverage and freshness" | Part B's real example needed one field-limited read of stored rows (stock symbols, dates, prices; no owner field selected) to compute two ATRs — beyond a count; named here as the tension | Method, script 5 |

## 7. Method

**Readers.** Eight general-purpose readers on the worktree at HEAD, read-only, no network, no production access; each returned `claim | file:line | exact text | differs?` and checked its own quotes by script. The coordinator re-read the weight-bearing lines with `checkcites.mjs` (a file must hold the quoted text on the cited line): 80 of 80.

**Production scripts** (in `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/AgenticChartDiscovery/`, with their outputs). Each was searched before it ran with

```
grep -nE "\.(set|add|update|delete|create|batch|runTransaction|bulkWriter|recursiveDelete)\(|writeBatch|\.commit\(" <script>
```

and each printed "none found". Calls used: `collection().count()`, `collectionGroup().count()`, `collection().select(...).get()`, `collection().where(...).select(...).get()`, `doc().get()`. Run with `node --env-file=<main checkout>/.env.local`.

| # | Script | Reads | Read instant (UTC, 16 Nov) |
|---|---|---|---|
| 1 | `census-se.mjs` | `setupEvidence`, `setupEvidenceClaims` counts and field-limited tallies; control `agentBattles` count | 00:07:54 |
| 2 | `census-obs.mjs` | the allowlist's length (env, never printed); per allowlisted owner (A, B) battle counts by archetype and date; `activations` collection-group count; `activationObserverState/main` key names; `setupMenuLabelState` count | 00:09:12 |
| 3 | `census-obs2.mjs` | `activationObserverState/main` shapes and tallies, no map keys printed | 00:09:41, 00:09:52 |
| 4 | `census-rec.mjs` | `researchWork`, `watchlists`, `hypothesisVersions`, `sharedResearchSessions`, `practiceFieldBooks`, `mandates` counts; `stockTechnicalScores` `updatedAt`; `indexIntelligence/stockRankings` and `intradaySnapshots/latest` key names and timestamps | 00:11:14 |
| 5 | `census-basis.mjs` | `stockThresholdInputs`: `snapshot.providerSymbol`, `measurement.{sourceSession, atr14Dollars, measuredPct, orderedBars}` only; ATR14 recomputed locally on the raw rows | 00:28:15 |

Also in that folder: `checkcites.mjs` and `coord-cites.tsv` (the coordinator's 80 citations), and the report's copy.

**Sizes.** `git diff --shortstat <merge>^1 <merge>` for #1001, #1004, #1018, #1030, #1034, #1048, #1054, #1055, #1056, #1059, #1062, #1065, #1066, #1067; review counts from each build's own report.
