# Phase 0 — The agent promises to watch signals it cannot see (read-only discovery)

**Fence line, first:** `api/_utils/agentEvalPromptAssembly.js` **is on the BUILD_RULES §1 fence** ("added June 10, 2026 — founder decision"). Of every other file named in the brief or read here, the fenced ones are `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentPromptAssembly.js` and `agentScoring.js`; **not** fenced are `api/cron/agent-evaluate.js`, `agentVwapFloor.js`, `marketDataCache.js`, `agentEvalToolSchema.js`, `evalIdentityBlocks.js`, `tickStamps.js`, `agentTriggerGate.js`, `voiceLayerAnticipation.js`, `voiceLayerPrompt.js`, `voiceLayerGrounding.js`, `termUniverse.js`, `src/data/forgeKnowledgeBase.js`, the honesty registry and every client file. Fenced files were READ; **nothing was edited**. A build that follows is founder-reviewed.

**Date:** 2026-09-15 · **Branch:** `claude/phase0-signal-language`, cut from `origin/main` at HEAD
**HEAD:** `cca8e98e0f6f27af60bc2477d9bc84827dc98ebd` (merge of PR #852) · **Tree at open:** clean
**Mode:** read-only — no production code edited, no fenced file edited, no Firestore read or write, no network call other than git; the §3 Q2 live EODHD check was **not** run (no key in this environment).
**Files this session created:** this report only.
**Markers:** every codebase claim carries `file:line` and **VERIFIED** (read at that line at HEAD in this session) or **ASSUMED** (basis named).

---

## 0. Preamble

1. `git fetch origin main` at open (BUILD_RULES §3): `origin/main` moved `398c528 → cca8e98`; the branch was cut from the fetched ref.
2. **`git fetch --unshallow origin` was run** (permitted by §3, recorded here): the container was a shallow clone (272 commits) and neither `330b5fa8` (May 6) nor `adaa151b` (June 12) was reachable until then. Two never-merged branches were read as history, not as code: `origin/claude/vwap-semantics-investigation` and `origin/claude/investigate-vwap-production-J3be9`.
3. BUILD_RULES §1 and §3 read. `docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md` §4 read in full; its anchors were at `fcace00d`, and every site cited below was re-read at HEAD. `agentEvalPromptAssembly.js` last changed `152217ea` (Sep 2) and `agentEvalToolSchema.js` `50a4ca49` (Aug 14) (VERIFIED, `git log -1`), so the Sep 11 line numbers in that file still hold; they are re-cited here only where re-read.
4. `docs/SIGNAL_INVENTORY_V2.md` (Jul 25, @ `a04a291d`) read: its finding B ("the product instructs models against signals that are never supplied") and §3B ("5-min RSI / 5-min MACD ABSENT", "VWAP σ-bands ABSENT") are the July form of this question. The five archetype charters each carry the same unbuilt sentence: `ARCHETYPE_DEF_SPECULATOR_2026-06-24.md:79` (SP-02/07), `…TREND_FOLLOWER_TEMPLATE…:82` (TF-02/07), `…CONTRARIAN…:92`, `…CAPITAL_PRESERVER…:92`, `…FUNDAMENTAL_INVESTOR…:87` (VERIFIED) — "finalize wording against the real cron indicator set so the agent commits only to signals it can observe." No commit, spec or audit in the tree records that calibration ever being done (grep over `docs/` and `*.md` for the sentence finds only the five charters and one Jun 25 build-plan echo).
5. **No credentials**: no Firestore, no GCS, no EODHD key. Q1 is a recipe, as briefed. Q2's live check is written out for the founder (§2.5).

---

## 1. Executive verdict

| Q | One-sentence answer | Confidence |
|---|---|---|
| **Q1 — is the empty map the norm?** | Very probably yes, since 2026-06-12: the two September battles show the gate closed on every check; one post-June-12 doc with `cronState.intradayMomentum: {}` makes it the norm rather than a September regression, and one May 13–Jun 11 doc's `sessionDate` fields measure the lag inside the record itself. Recipe in §2. | High on the recipe; the norm is the console's to confirm |
| **Q2 — gate or builder?** | **Gate.** The June 12 gate re-imposed exactly the today-only constraint the May 12 filter applied, which the May 12 production read found unsatisfiable under EODHD's ≥1-trading-day intraday lag; the repo's own "mimic a real EODHD response" fixture is one trading day behind its evaluation date and would publish nothing under the gate; the builder runs on every stamped tick. The floor has been inert since June 12 unless the lag has lifted on some day since — one curl settles that. | High on mechanism; the lag's *current* value is a live read |
| **Q3 — where the agent learns about VWAP** | Ten places, none conditional on the map being present except a two-word "When provided"; when the map is empty the momentum block is simply absent (no marker), while the system prompt, the institutional note, the tool schema and — most directly — the player's own equipped Forge rules (`S{n}.` lines, verbatim) keep telling the agent VWAP is a thing it checks. Inventing a VWAP threshold is the predictable output. | High |
| **Q4 — the wider audit** | Of the four quoted thresholds, only the ATR multiple and the named resistance level are observable for the symbol they name; RSI and RVOL are observable for **bench** names only (never for held), daily VWAP is observable-but-absent-today, and the 5-minute MACD histogram and any 5-minute RSI/VWAP are **not in the data at all** — and reach the prompt anyway through Forge rule text that the C-20 honesty sweep does not cover. Table in §5. | High |
| **Q5 — what the player sees** | The threshold is voiced by Gemma under the shipping `'shadow'` grounding mode (the code-composed, threshold-free note runs only at `'on'`), persisted twice, re-read by nothing on any later tick, and marked by no surface; the three copy guards cover narrator prompt prose and desk/Why? labels, not agent-authored thresholds. Write-once prose. | High |
| **Q6 — fix shapes** | Language half first: a fence-free pre-persistence validator that **rejects** a threshold naming a signal absent from that tick's data can ship now under either data outcome; the fenced per-tick "present / not provided" line follows. Data half: one curl, then either a plan change (no code) or a formal retirement whose blast radius is listed in §7.1. The charters' build-calibration note is an unbuilt spec requirement, not a defect. | High |

---

## 2. Q1 — Is the empty map the norm? (the console recipe)

### 2.1 What the two September battles already establish

Sep 10 and Sep 14: every position, every check, `evidence[sym].vwapDev = null`; Sep 14's `cronState.intradayMomentum` is `{}`, `vwapTicks` is `0` for all seven, `vwapFireGuard.count` is `0` (from the brief). At HEAD every one of those fields is written from the **same in-memory map** in the same tick: `momentumData.vwap` is published only at `api/cron/agent-evaluate.js:980` (VERIFIED) behind the gate at `:978`; it is persisted as `cronState.intradayMomentum` by `finalizeCronState` (`api/_utils/agentCronState.js:39` VERIFIED; call sites `agent-evaluate.js:1808, :1825, :1865, :1942, :2970` VERIFIED); the strike counter reads it at `:1337-1346` (VERIFIED; `vwapTicks[sym] = 0` whenever `vwapInfo` is null, `:1345`); the risk manager gets `intradaySnapshot: null` from it at `:1366-1370` (VERIFIED) and fails closed (`api/_utils/agentRiskManager.js:140-141` VERIFIED); the stamp reads it at `api/_utils/tickStamps.js:188, :194` (VERIFIED; composer `:182-202`). So the two battles establish: **on Sep 10 and Sep 14 no held symbol passed the gate on any check, the floor never armed, TRAIL_STOP never armed, and the decider was shown no VWAP line.** They do not establish since when.

### 2.2 The recipe (Firestore console, read-only)

Collection `agentBattles`. `activatedAt` is an ISO string (ASSUMED — inherited from the Sep 11 audit's `agentBattleService.js:69, :140`; that file is fenced and was not re-read here).

**Sample:** three docs with `activatedAt` in (a) late June, (b) late July or August, (c) Sep 1–9; plus **one doc with `activatedAt` between 2026-05-13 and 2026-06-11** if any survives. That window matters: from `a750e93a` (May 13) the published entry has carried `sessionDate` (VERIFIED — the commit's cron hunk adds `{ ...vwapResult, sma20_5m, sessionDate }`), and until `adaa151b` (June 12) there was no gate, so a pre-June-12 doc's map is populated **and dated**.

| Read | Path on the battle doc | What each outcome means |
|---|---|---|
| The map at the battle's last tick | `cronState.intradayMomentum` | `{}` → no held symbol passed the gate at the last tick. A non-empty map → the gate opened that day; read each entry's `sessionDate` (must equal that day's ET date, by construction of the gate). |
| Ever armed? | `cronState.vwapTicks` (all `0`?) and `cronState.vwapFireGuard.count` | all-zero + `count: 0` is consistent with an all-day-empty map; any non-zero count means the floor fired that day, i.e. the gate opened. |
| Per-check | `evaluations[i].evidence[sym].vwapDev` | exists only from Sep 10 (`TICK_STAMPS_ENABLED`); `null` on every held row of every entry = the per-check form of the same fact. Earlier battles have no per-check record of VWAP at all — only the last-tick map. |
| **The lag, measured** (pre-June-12 doc only) | `cronState.intradayMomentum[sym].sessionDate` vs the ET date of `cronState.lastEvaluatedAt` | `sessionDate` one trading day **before** the evaluation date on every symbol → the response's newest session lagged by one day on that date — the mechanism, in the record. Same date → the data was current that day (and June 11's staleness was an outage, as `adaa151b` framed it). |

**Distinguishing "the gate rejected a stale session" from "the builder never ran":** the doc cannot. The gate discards the rejected `sessionDate` silently (`agent-evaluate.js:978` VERIFIED; nothing persists it), and a per-symbol fetch failure returns `[]` without rejecting the batch (`marketDataCache.js:883-913`, `:901` VERIFIED), so both leave the identical `{}`. Two things do distinguish them: (1) **the entry exists with `evidence`** → the tick built a prompt, so the builder loop at `:966-985` ran (the stamp is composed after it); (2) **Vercel function logs** for the tick: `[MarketDataCache] Intraday response was empty for {SYM}` (`:819`) = the feed returned nothing; `Intraday fetch failed for {SYM}` (`:901`) = transport; `Dropped N synthetic close-print bar(s) for {SYM}` (`:862`) = **the response carried candles**, so the gate is what emptied the map. The absence of all three with an empty map also points at the gate (candles came back, none were today's, nothing logged).

**What one more read adds:** doc (a) with `{}` moves the finding from "September" to "since the gate shipped"; the pre-June-12 doc with a prior-day `sessionDate` moves it from "hypothesis" to "measured in production", without a key.

---

## 3. Q2 — Gate or builder: closing the Sep 11 classification

### 3.1 The gate and the builder at HEAD (all VERIFIED)

- Gate: `isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount })` ⇔ `sessionDate === todayET && sessionCandleCount >= MIN_SESSION_CANDLES` (`api/_utils/agentVwapFloor.js:36-38`; `MIN_SESSION_CANDLES = 3` at `:13`). Called at `agent-evaluate.js:978` with `todayET = formatDateString(getETDate())` (`:755`); publish at `:980`. Unchanged since `adaa151b` (June 12) — the module header at `:2-4` still names the "June 11 incident: agent 'Shadow', 12 swaps in ~2h on stale-session VWAP".
- Builder: `momentumData = { vwap: {}, rankings: {} }` (`:938`); `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` — held symbols only, no `hoursBack` (`:947`); per symbol `filterToLatestSession(candles)` → `calculateVWAP(sessionCandles)` (`:971-972`; `api/_utils/technicalCalculations.js:378`); the whole-batch failure branch at `:983-985` (the warn at `:984`) logs `Intraday fetch failed:` but `fetchIntradayBatch` settles per symbol and never rejects.
- Fetch: `fetchIntradayCandles` (`api/_utils/marketDataCache.js:792`): URL `…/intraday/{SYM}.US?api_token=…&fmt=json&interval=5m` with **no `from`/`to`** unless `hoursBack` is passed (`:793, :799-801`); `filterToLatestSession` (`:1040-1079`) anchors on the **latest ET date present in the data**, and its own doc comment records why: *"NOT today's ET date — so it gracefully handles EODHD's ~1-trading-day lag on the /intraday endpoint (the production failure mode of Fix v1)"* (`:1021-1023`).

### 3.2 Nothing in the intraday path has changed since 2026-05-13 (VERIFIED)

`git log -L` over the three function bodies: `fetchIntradayCandles` (`:792-880`) → `050c395d` 05-13, `e9a44d8c` 05-07, `330b5fa8` 05-06, `e0936cc9` 03-26; `fetchIntradayBatch` (`:883-915`) → `e0936cc9` only; `filterToLatestSession` (`:1040-1079`) → `a750e93a` 05-13, `acdc3c67` 05-12. The six commits to `marketDataCache.js` since May 13 (`1455e468`, `b9cb95dc`, `365e35a3`, `efde337e`, `e36d719e`, `d037b2fa`) have hunk headers at `:215-292`, `:363`, `:460-515` and `:73`; `efde337e` inserts `getCachedBatchQuotes` *after* `fetchIntradayBatch`'s closing brace and touches no intraday line. So the Sep 11 finding stands at HEAD: the path is the May 13 path.

### 3.3 The May 6 commit, quoted (`330b5fa8`, 2026-05-06 17:55 UTC — VERIFIED from `git log`)

> Root cause: fetchIntradayCandles always sent from=NOW-8h&to=NOW Unix timestamps to EODHD's /intraday/ endpoint. **Under the project's current EODHD configuration, intraday data lags by at least one trading day**, so the queried NOW-relative window contained no published candles and EODHD returned 200 OK with body [].
>
> Manual curl verification confirmed: omitting from/to returns ~200 candles of recent intraday data (**May 4-5**).

May 6 was a Wednesday; a mid-session curl (13:55 ET) whose newest candles were **Tuesday May 5** is a lag of exactly one trading day. That measurement is the author's (ASSUMED as a measurement; VERIFIED as the commit's text).

### 3.4 The fixture: there is no captured response, and the authored one is a day behind

- Repo-wide, every intraday `datetime` fixture is hand-authored (`api/_utils/marketDataCache.test.js`, `technicalCalculations.test.js`, `api/_utils/__fixtures__/tickStampsHarness.js:290-291` — the last is `'2026-09-09 13:30:00'…`, written to *pass* the gate; VERIFIED by grep for `datetime:` across `api`, `src`, `scripts`).
- The nearest thing to a real response is the test that says so: *"Mimic the shape of a real EODHD response that spans many trading days"* (`marketDataCache.test.js:539-559` VERIFIED). Its dates are `2026-05-04 … 2026-05-12` (`:541-544`), 78 RTH bars each; it is evaluated at `now = 2026-05-13 10:00 ET` (`:554`) and asserts `sessionDate === '2026-05-12'` (`:556`). **The newest `datetime` in the fixture is one trading day behind the fixture's own evaluation date.** Under the June 12 gate that fixture publishes nothing: `'2026-05-12' !== '2026-05-13'`.
- The tests that exercise the gate itself (`tickStampsHarness.js:284-291`) build today-dated candles by hand. That is the exact blind spot the May 12 production investigation named: *"There is no fixture that mirrors a real lagged response … being passed in on May 12. That gap is why the implementation looked correct against tests yet broke immediately on the first live run."* (`discovery/vwap-production-failure-investigation.md` §4.1, on the never-merged branch `origin/claude/investigate-vwap-production-J3be9` @ `bc1d438b` — VERIFIED as text on that branch). It is still true at HEAD, for the gate.

### 3.5 The classification, closed from the repo

The timeline, every step VERIFIED at the cited commit or branch:

| Date | Commit / doc | What it says about the lag | Effect on `momentumData.vwap` |
|---|---|---|---|
| Apr 14 → May 6 | `5ba9568` → `330b5fa8` | `from=NOW-8h` window empty for 22 days: "lags by at least one trading day" | empty |
| May 6 | `330b5fa8` | curl: newest data May 4–5 on May 6 | populated — with **yesterday's** cumulative VWAP over a multi-week window |
| May 12 | `acdc3c67` today-only filter; branch `investigate-vwap-production-J3be9` | "EODHD isn't returning today's candles … zero May 12 candles at 1:49 PM ET" | empty in production the same day |
| May 13 | `a750e93a` | "rejected every candle when EODHD's /intraday endpoint lagged ~1 trading day — the production failure mode that produced intraday: null" | populated with the **prior session's** VWAP, dated |
| Jun 11 | `agentVwapFloor.js:3-4`, `adaa151b` body | "12 swaps in ~2h on stale-session VWAP" — the prior-session VWAP struck the floor | populated (stale) |
| Jun 12 | `adaa151b` | gate `sessionDate === todayET`; frames Jun 11 as "the June 11 EODHD outage shape" | **empty whenever the lag holds** — the May 12 constraint, re-imposed |
| Sep 10, 14 | the two battles | — | empty on every check |

The June 12 gate was written for an *outage* and shipped against what May 6, May 12 and May 13 had each measured as the plan's *normal* state. The builder ran on every September tick (the stamps exist only after `promptBuilt`, and the fetch cannot reject). The Sep 11 "1 or 2" is therefore **1 — the freshness gate — with the lag as the reason it closes**, and the floor has been inert on every day since June 12 on which the lag held. What the repo cannot say is whether the lag has lifted on *any* day since June 12; the Sep 14 `{}` says not that day. (The May 12 investigation also notes the endpoint's natural window is weeks of history, so the ~200-candle count in the May 6 message understates the response; irrelevant to the gate, which reads only the newest date.)

### 3.6 What the founder should run, with the key

One request, during regular trading hours on a trading day:

```
GET https://eodhd.com/api/intraday/QCOM.US?api_token=<KEY>&fmt=json&interval=5m
```

Read **the maximum `datetime`** in the array (space-separated UTC, `YYYY-MM-DD HH:mm:ss`; `marketDataCache.js:1047`, `parseEodhdDatetime`) and convert it to Eastern.

- Same ET date as today → the feed is current; the gate *can* open, and an empty map that day is something else (fewer than 3 session candles, or the symbol not held).
- The prior trading day (or older) → **the gate cannot open during RTH under this plan, and the VWAP floor, TRAIL_STOP and the VWAP prompt line have been inert since 2026-06-12.** No code change can fix that; only the plan or the source can.

---

## 4. Q3 — Where the agent learns about VWAP

Everything the **decider** (Haiku, `submit_trade_decision`) is sent that mentions VWAP, at HEAD, VERIFIED at each line:

| # | Where | Line(s) | The sentence | Describes VWAP as… | Conditional on the map being present? |
|---|---|---|---|---|---|
| 1 | Eval system prompt, `━━━ INTRADAY MOMENTUM SIGNALS ━━━` (tiered variant) | `agentEvalPromptAssembly.js:392-398` | *"When provided, use these signals to refine your decisions: — VWAP DEVIATION: Price above VWAP = intraday bullish momentum. Price below VWAP = intraday bearish momentum. Deviation >1.5% is significant."* | a field it will be shown, plus a concept | only by the two words "When provided"; nothing says what "not provided" looks like |
| 2 | Same block, standard variant | `:596-602` | identical text | same | same |
| 3 | System prompt, TRADE REASONING `indicators` example | `:456` (and `:659`) | *`(e.g., ["RSI 28 (oversold)", "BB width 12th pctl [SQUEEZE]", "VWAP +0.4%"])`* | an example value it may write | no |
| 4 | Identity block, `C_INST` note — renders only when the agent has an `institutional` rule equipped | `:328` / `:334` (via `:817-821`) | *"NEVER hold a position based solely on strong institutional accumulation if VWAP (held positions) or RSI-14 shows a breakdown."* | a live technical it checks | no |
| 5 | Live context, `=== INSTITUTIONAL INTELLIGENCE ===` header (same condition) | `:949` | *"Do NOT hold a position based solely on institutional accumulation if real-time technicals (VWAP on held positions, RSI-14) show a breakdown."* | a real-time technical | no |
| 6 | **Equipped Forge rules, verbatim, as `S{n}.` / `C{n}.` lines in the identity block** | `:804-813` (`S${i + 1}.`, `:811`), text from `resolveRuleText` `:877-882` → `sanitizeRuleText` (`agentPromptAssembly.js:301-313`, strips injection patterns only) | e.g. **mb-05** *"Only swap into a bench stock if its price is above the daily VWAP and the 5-minute MACD shows a {signal} signal"* (`src/data/forgeKnowledgeBase.js:652`); **mb-15** *"…remains below its daily VWAP for {intervals} consecutive evaluations"* (`:908`); **ts-02** *"…AND price is above daily VWAP"* (`:1434`); **t-09** (`:1643`), **t-10** *"beyond {dev} standard deviations from daily VWAP"* (`:1668`), **t-16** (`:1820`), **tv-04** *"reclaimed VWAP from below"* (`:2452`), **tv-09** (`:2590`), **tv-15** (`:2756`); **mb-14** offers *"5-min VWAP trend"* as a select option (`:885`) | an instruction to act on VWAP, in the player's own words | no — and this is where **S12 / S10** come from: the ordinal of the rule in the agent's equipped strategy list |
| 7 | Tool schema, `trade_reasoning.indicators` example | `agentEvalToolSchema.js:96` | *`["RSI 28 (oversold)", "BB width 5th percentile", "VWAP +0.4%"]`* | an example value | no |
| 8 | Tool schema, `cited_rules` standard names | `:119` | *`"vwap_mean_reversion", … "vwap_failure"`* | rule names it may cite | no |
| 9 | Live context, `INTRADAY MOMENTUM SNAPSHOT` | `:1826-1861`; pushed at `:1197-1201` | `{SYM}: VWAP: $x (+d.dd%) | BB Width: nth pctl | NR7: YES | Range: $x` | **the value itself** | yes — the VWAP part renders only when `vwap[sym].vwapDeviation != null` (`:1838-1840`); a symbol with no parts gets no line; with no lines the block is omitted (`:1859`). **No marker, no placeholder.** BB width / NR7 / Range can keep the block alive with no VWAP part. |
| 10 | Trigger block | `agentTriggerGate.js:115-131` → `TRIGGER (why you were woken up)` `:1189-1194` | *"{SYM} trading x.xx% above/below VWAP ($y) — bullish/bearish momentum"* | a wake reason | yes — only when present |

Not VWAP-bearing (VERIFIED by grep): the DR-13 identity kernels (`evalIdentityBlocks.js` — the Speculator kernel at `:124` names "realized volatility (ATR)" and "technical trigger", never VWAP); the archetype config's `favoredStrategies: ['vwap_mean_reversion']` (`agentArchetypeConfig.js:131`, Contrarian) has no reader on the eval or draft prompt path; there is no signal glossary anywhere under `api/_utils`.

**The key question — when the map is empty, does the prompt still say VWAP is available?** Yes. Rows 1–8 are byte-identical on a tick with `momentumData.vwap = {}` and a tick with a full map; row 9 disappears without a trace; row 10 never fires. The only phrase that even gestures at absence is "When provided" — and the same sentence lists BB width and NR7, which *are* provided from a different source (`rankings`, `compute-index-intelligence.js`), so the block usually *is* present, with the VWAP part silently missing from every line. The agent's model of the world is therefore: "VWAP is one of my intraday signals, my equipped rule S12 tells me to require it, the momentum snapshot shows BB width and NR7 for my names, and VWAP just is not mentioned this tick." Writing *"If it holds above the daily VWAP…"* is what any careful reader of that prompt would do. It is a prompt-contract failure, not a model failure.

Two facts sharpen it:

- The anticipation guidance forbids invention **for `signalSummary`** — *"Do NOT invent indicators you do not have data for"* (`:500`) and *"Anything you do not have direct signal data for"* under DO NOT POPULATE (`:509`) — but the `threshold` field's instruction is only *"Must be specific"* (`:501`; schema `agentEvalToolSchema.js:178-181`), and its own example, *"If it holds above the 20-day on the next test"*, names a level the prompt never carries as a number (the bench trend line renders `short/intermediate/long` labels and `sma200_position` only, `:1588-1604`).
- The C-20 prose-honesty test **requires** the string `VWAP` in every eval system prompt — *"keeps VWAP guidance, which is real for HELD positions"* (`api/_utils/agentEvalPromptAssembly.honesty.test.js:74-78` VERIFIED). Real in code; absent in data since June 12. The sweep's frame is structural presence, which is the right frame for "5-min RSI" and the wrong one for VWAP.

The narrator's side (Gemma, a different model, same player-visible words): `DATA_CONFIDENCE_RULE` tells Gemma that intraday signals *"describe the latest available session — typically today during market hours, or the prior session when EODHD's data hasn't refreshed"* (`voiceLayerPrompt.js:1888` VERIFIED) — a pre-gate sentence: since June 12 a prior session is never published, so the state it describes no longer occurs. `buildIntradayLine` itself self-gates on null (`:1288-1310`). And the one place in the whole codebase where a prompt **states an absence** is the first-message `CACHE-COLD RULE`: *"You do not have intraday market data at this moment. Do NOT cite VWAP, moving averages…, RSI, MACD, support/resistance levels…"* (`:3181-3185` VERIFIED) — the precedent for §7's option 1.

---

## 5. Q4 — The wider audit: every signal the agent names

Presence is per **symbol class**, because the decider's prompt is asymmetric (VERIFIED): held positions get the `ACTIVE POSITIONS` CSV (`Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%[,LockNow,NextBonus,Levels]`, `agentEvalPromptAssembly.js:1465-1468`), `STOCK REGIMES` (`:1770-1775`), `RISK STATUS`, and the momentum snapshot (row 9 above); **bench** names get `BENCH TECHNICAL CONTEXT` (`:1535-1580`) with trend, `RSI=`, `MACD above/below signal (fresh cross)`, `BB %B`, `ATR regime`, `RVOL=`, `rsPercentile=`, `sector RS=`, `Levels: support/resistance`, recent action, `technicalScore`. `techScoresMap` (the `stockTechnicalScores` docs) is consumed **only** by the bench block (`:1175`, `:1535-1547`; VERIFIED by grep) — so RSI, MACD, RVOL, %B and rsPercentile are never rendered for a held name. Badges on held rows are the scoring badges (`bagger/bust/…`, `agentScoring.js:78-86`), not technical flags.

| signal | named in the prompt? | present in the tick's data? | conditional on presence? | can the agent verify it next tick? | class |
|---|---|---|---|---|---|
| **daily (session) VWAP** | yes — rows 1–8 of §4 | **no, since 2026-06-12** whenever the lag holds (§3); held names only, even when present (`agent-evaluate.js:947`) | only row 9 renders conditionally; rows 1–8 do not | not until the data returns; `evidence[sym].vwapDev` stamps `null` so the player cannot either | **observable-but-absent-today** |
| **5-minute VWAP** ("5-min VWAP trend", mb-14 `:885`) | via Forge option text only | never computed — `calculateVWAP` is the cumulative *session* VWAP over 5-m bars (`technicalCalculations.js:378`) | — | no | **not in the data at all** |
| **RVOL / relative volume** ("RVOL > 1.2x" S2 `:416`; "volume ratio > 1.2x" S5 `:430`; se-02 `forgeKnowledgeBase.js:3120`) | yes | **bench only**: `Volume: {tier} tier | RVOL=x.xx` (`:1652-1662`) from `volumeProfile.ratio` (`compute-index-intelligence.js:1004, :1094`), today's **daily** bar vs 20-day average; on the intraday refresh volume is neutralized to the trailing average (`:249-251`), so it is a daily-close number | renders only when the doc exists | for a bench name, at daily cadence; **"sustains above 1.2x" intraday cannot be verified** (volume is not refreshed intraday); for a held name, not at all | observable (bench, daily) / not in the data (held) |
| **named resistance level** (the quoted `181.62`) | yes | yes, **both classes**: bench `Levels: support x (+y%), resistance x (+y%)` (`:1686-1710`); held rows' `Levels` cell (`levelsCell` `:1437`, used `:1482`, header `:1467`) — from `stockRankings.levels.nearestResistance` = nearest swing-high cluster, 20-bar lookback (`compute-index-intelligence.js:1061-1064`) | renders only when the levels object exists | yes — the level is re-rendered each tick from the rankings doc | **observable** |
| **5-minute MACD histogram** (mb-05 `:652`, mb-11 `:806`, ts-08 `:1588`) | via Forge rule text; and **on the C-20 FORBIDDEN list** (`promptHonestyRegistry.js:25`) | never computed on any intraday timeframe; the *daily* MACD histogram is persisted (`indexIntelligence.js:545`) but the eval renders only "MACD above/below signal (fresh cross)" (`:1614-1620`) — no histogram value in any prompt | — | no | **not in the data at all** |
| **RSI** ("RSI pulls back below 75") | yes — RSI-14 in S3/S4 (`:420, :423`), C_INST (`:328`); Forge tv-01 (`:2369`), se-01 (`:3094`), tech-rsi-* (`:44, :67`) | **bench only**: `RSI=nn` daily RSI-14 (`:1610-1612`); **never for held** | renders only when the doc exists | bench: yes, daily; **held (the "rotate into Core" cases): no — the agent has no RSI for the names it holds** | observable (bench) / not in the data (held) |
| **5-minute RSI** (ts-03 `:1460`, ts-05 `:1511`; mb-14 option) | via Forge rule text; FORBIDDEN (`promptHonestyRegistry.js:24`) | never computed | — | no | **not in the data at all** |
| **ATR multiples** ("-0.5x ATR (≈ -$118.72)") | yes — bonus/penalty bands (`:380-383`, `:493`) | yes, held: `ATR Mult` column (`:1479`) and `ATR%`; stamped as `atrX` (`tickStamps.js:193`) | always rendered for held | yes — the dollar level is arithmetic on `ATR%` × entry; re-rendered every tick | **observable** |
| **`rsPercentile`** | yes — S2/S3 (`:417, :420`), anticipation guidance (`:492-493`) | **bench only**: `rsPercentile=nn (label)` (`:1664-1683`); never for held (the desk copy guard forbids the word for held names, `deskHonesty.test.js:139-142`) | renders only when `factors.rsPercentile != null` | bench: yes | observable (bench) |
| ↳ the `?? 50` placeholder | — | **it reaches this surface.** The writer sets `rsPercentileMap[d.sym] ?? 50` (`compute-index-intelligence.js:1006`) for any symbol dropped from `sortedByRS` (no `rs20` or non-finite change, `:920-923`), passes it into `computeTechnicalScore` (`:1018-1024`), which stores it as `factors.rsPercentile` (`indexIntelligence.js:523-524`) → the eval bench block prints **`rsPercentile=50 (outperforming)`** (`:1669-1675`: 50 falls in the `< 70 → 'outperforming'` band) for a symbol that has no measurement. The Sep 9 fix (F-3, `docs/audits/20260909_THREE_UNIT_BUGS_BUILD_REVIEW.md:50`) deleted the *reader-side* default in the voice-layer brief writer; the *persisted* default at `:1006` (and `:1298-1299`) survived, and `voice-layer-cache.js:602` still reads `factors.rsPercentile ?? 50` (its RS verdict is gated on the raw reading at `:634`). The brief's "ledger item O-8" could not be located under that id in the tree (the only `O-8` hits are the Quarterly Restructure charter's First-Experience label) — ASSUMED to mean this placeholder. | — | — | **observable, but a median can be a fabrication** |
| **BB %B** (S2/S4; tv-06 `:2507`) | yes | bench only: `BB %B=0.xx (band)` (`:1634-1642`) | when present | bench: yes | observable (bench) |
| **BB width percentile / squeeze** | yes (`:393-395`, S1) | held: momentum snapshot (`:1842-1846`) + stamped `bbPct`; cross-sectional, not self-history (Inventory SIG-014) | when present | yes | observable (held) |
| **NR7** | yes (`:301-311`, `:436`) | held: momentum snapshot (`:1847-1849`) + stamped `nr7` | when present | yes | observable (held) |
| **"the 20-day"** (the schema's own threshold example, `agentEvalToolSchema.js:180`) | yes | no level rendered for any class (`:1588-1604` renders trend *labels* and `sma200_position` only) | — | no | **not in the data** (as a level) |
| **per-stock regime / WARNING risk status / ATR band proximity** (the anticipation guidance's own list, `:492-493`) | yes | held: yes (`:1770-1775`; risk block) | when present | yes | observable (held) |

**Reading the four quoted thresholds against the table:**

1. *"holds above the daily VWAP and the RSI pulls back below 75, I'd consider rotating it into Core"* — a **held** name (tier rotation): VWAP absent today; RSI **not in the held data at all**. Neither clause is observable. The RSI-75 figure echoes an equipped rule (mb-05's neighbour rules; tv-01's `{stretched}` default) rather than a reading.
2. *"QCOM holds above the daily VWAP and the 5-minute MACD shows a positive histogram signal (S12), and RSI pulls back below 75 (S10)"* — a near-verbatim recital of rule **mb-05** (`forgeKnowledgeBase.js:652-654`: `{signal}` default options include *"Positive histogram"*) as the agent's 12th strategy line, plus a 10th; VWAP absent, 5-minute MACD non-existent, RSI absent for a held name.
3. *"QCOM breaks above 181.62 resistance and RVOL sustains above 1.2x"* — resistance observable (rendered for both classes); RVOL observable only if QCOM was on the bench, and then only as a daily number that "sustains" cannot be read from.
4. *"CRWD falls below -0.5x ATR (approximately -$118.72)"* — fully observable and checkable next tick.

**The honesty defect in one line:** three of the four thresholds cite a signal the agent was not shown, and the prompt itself put two of the three names in its mouth (the equipped rules) while forbidding one of them elsewhere (the C-20 list).

---

## 6. Q5 — What the player sees

### 6.1 Where the anticipation text renders (all VERIFIED)

The text is one `chatExchanges[]` entry with `messageType: 'anticipation'`, written once by `generateAnticipation` (`api/_utils/voiceLayerAnticipation.js`). Readers:

| Surface | Reads | Marks an absent signal? |
|---|---|---|
| Battle View chat (`AgentChat`) | `deriveChatMessages.js:92` takes `anticipationContext.direction` only; eyebrow *"Bench note"* / *"Holding note"* from `battleViewCopy.js:448-450`; the body is `ex.agentResponse` | no |
| Battle View character bubble | `deriveBubble.js:164` — same eyebrow, same body | no |
| Film Room anticipation log | `AnticipationLogSection.jsx:13-14` filters `messageType === 'anticipation'` by day and renders `ex.agentResponse` (`:70`) + timestamp | no |
| League arena voice lane | `VoiceLane.jsx:28` (eye icon for kind `anticipation`); `statusFeedToVoice.js:20` — a hard-coded default line, not the record | no |
| Bench `Flagged` chip | `selectBench.js:45-54` — "the fact of the flag, and nothing else"; `threshold` and `signalSummary` deliberately never render here | no |

No client file reads `anticipationContext.threshold` or `candidates[].threshold` (grep over `src/` finds only `.direction` at `deriveChatMessages.js:92`).

### 6.2 Write-once prose

- The threshold is **persisted twice**: on the exchange as `anticipationContext.threshold` (Gemma path, `voiceLayerAnticipation.js:339-355`, `:353`) and on the evaluation entry as `candidates[].threshold` (`tickStamps.js:275-284`, composed at `tickStamps.js:341`, from `haikuResult.anticipationCandidates` at `agent-evaluate.js:2833`).
- It is **re-read by nothing**: no server code outside the composer, the stamp and the prompt builder references it (grep over `api/` VERIFIED); the decider's own memory of prior checks, `formatRecentEvals` (`agentEvalPromptAssembly.js:1389-1402`, called at `:1279`), carries `decision`, `rationale`, `hypothesis` — **not** the anticipation candidates. So the agent that wrote *"If QCOM holds above the daily VWAP…"* is never shown that sentence again, and no tick compares the world to it.
- A player reading *"I'll act if X"* therefore has no way to learn that X was never watched — or, for VWAP, could not have been.

### 6.3 Who voices the threshold — the grounding mode decides, and the shipping default voices it

- `VOICE_GROUNDING_MODE = 'shadow'` (`src/config/featureFlags.js:2137` VERIFIED); `resolveVoiceGroundingMode` returns `'shadow'` for every uid unless the mode is `'canary'` and the uid is allow-listed (`:2140-2173`, `:2188-2193`).
- `generateAnticipation` takes the **code-composed** path only when the owner resolves to `'on'` (`voiceLayerAnticipation.js:187-205`); that note is *"At the {slot} check my trading process flagged {SYM} on the bench as a potential entry. The signal it recorded: …"* — **no threshold, by ruling** (`voiceLayerGrounding.js:929-935`, `:950-963`; spec R4 `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_2.md:24`, §7 list `:36`: *"until this changes, `threshold` renders nowhere in the narrator's voice"*; D-103, `PHASE_B_TICK_STAMPS_SPEC_V1.md:34`).
- On every other uid — i.e. **everyone today** — the **Gemma** path runs (`:207-330`): the candidate block carries *`Threshold (action condition): <the agent's sentence>`* verbatim (`voiceLayerPrompt.js:3735-3736`), and Gemma is instructed *"The threshold — one short sentence on what would make you act. Anchor in the threshold provided in the candidate block. THIS IS NOT OPTIONAL"* (`:3662`) and *"Do not invent RSI/MA/momentum specifics that aren't in the candidate block"* (`:3669`) — which passes an invented VWAP straight through, because it *is* in the candidate block. The four quoted sentences are this path's output. **D-103 is true only on the grounded path; on the shipping default the threshold is voiced.**

### 6.4 The copy guards — none covers an agent-authored threshold

| Guard | What it covers | Thresholds? |
|---|---|---|
| Reply lint `REPLY_LINT_RE` (`voiceLayerGrounding.js:943-947`) | the `signalSummary` clause, grounded path only (`:957-960`); bans action verbs (*"I'll rotate"*, *"eyeing"*, *"watching"*, *"I'd consider … swap"*) | no — different field, different path, and it tests verbs, not signal names |
| `GROUNDING_VOCABULARY_GUARD` — 30 sites / 35 phrases (`:883-913`) | shipped **narrator prompt prose** (the guard test proves each phrase absent from every grounded prompt) | no — prompt source, not output |
| Client copy guards (`WhyPanel.render.test.jsx:421-427`; `deskHonesty.test.js:129-148` `PHASE_B_FORBIDDEN`) | rendered desk / Why? **labels and narrator sentences** (agent verbs; `rsPercentile`; "technical data as of") | no — chat exchanges are outside both |
| C-20 prose-honesty sweep (`promptHonestyRegistry.js:23-31`; `agentEvalPromptAssembly.honesty.test.js:47-55, :81-110`) | **prompt module source** for structurally absent signals | no — and it does not sweep `src/data/forgeKnowledgeBase.js` (`PROMPT_CONTRIBUTING_MODULES`, `:47-53`, lists `api/_utils` modules only), so *"5-minute MACD"* reaches the prompt through mb-05 / mb-11 / ts-08 while being on the FORBIDDEN list |

---

## 7. Q6 — The fix shapes

### 7.1 Data half (founder's, not this arc's)

**Option A — restore a current intraday source.** Step 0 is §3.6's curl. If the EODHD plan can be moved to a tier whose `/intraday/` is current (or 15-minute delayed — the gate needs today's date, not real time), **no code changes**: the gate opens by itself, the floor re-arms, and the VWAP line reappears. If the source must change, the edit is `fetchIntradayCandles` / the URL and parser (`marketDataCache.js:792-880`, non-fenced) plus a *captured* lagged fixture (§3.4's gap), with `filterToLatestSession` and the gate untouched. Cost: plan money, or one non-fenced module + tests; **and a decision on `sessionCandleCount >= 3`** at the open.

**Option B — accept that VWAP is unavailable intraday and retire it formally.** What is *already* dark in effect since June 12 and would go dark *in name*:

| Thing | Where | Fence |
|---|---|---|
| `vwap_failure` floor and its presets (`vwapFailureTicks` 3/2, `vwapDeadBandPct` 0.7/0.5/0.3) | `agentRiskManager.js:136-146`; `agentPresetConfig.js:15-19, :36-37`; strike counter `agent-evaluate.js:1337-1346` | **fenced** (risk manager); cron + presets not |
| `TRAIL_STOP` arming (needs `sma20_5m` from the same map) | `agentRiskManager.js:164-170` | **fenced** |
| cascade guard and its qualification fetch | `agent-evaluate.js:1515-1522`, `:516-517`; `agentVwapFloor.js:102-108` | not fenced |
| `vwap_deviation` wake trigger | `agentTriggerGate.js:115-131` | not fenced |
| the VWAP part of the momentum snapshot and the `INTRADAY MOMENTUM SIGNALS` prose (rows 1–3, 9 of §4) | `agentEvalPromptAssembly.js:392-397, :456, :596-601, :659, :1838-1840` | **fenced** |
| C_INST / institutional VWAP sentences | `agentEvalPromptAssembly.js:328, :334, :949`; `agentPromptAssembly.js:125, :407` | **fenced** |
| `cited_rules` names `vwap_mean_reversion`, `vwap_failure` | `agentEvalToolSchema.js:119` | not fenced |
| nine equippable Forge rules (mb-05, mb-15, ts-02, t-09, t-10, t-16, tv-04, tv-09, tv-15) and mb-14's 5-min-VWAP option | `forgeKnowledgeBase.js:652, :908, :1434, :1643, :1668, :1820, :2452, :2590, :2756, :885` | not fenced (product content) |
| the `vwapDev` stamp and its Why? fact | `tickStamps.js:194`; `decisionRecord.js:1015-1016` | not fenced |
| the narrator's intraday line and the `DATA_CONFIDENCE_RULE` "prior session" sentence | `voiceLayerPrompt.js:1288-1310, :1888` | not fenced |
| the honesty pin that requires `VWAP` in every eval prompt | `agentEvalPromptAssembly.honesty.test.js:74-78` | test — must move in the same commit |
| `SIGNAL_INVENTORY_V2` SIG-016 and the Speculator/TF/CN charters' calibration notes | docs | spec |

Retiring VWAP changes what the prompt *says*; the engine's behaviour has been the retired behaviour since June 12 (Bust, guardrails and Haiku are the covering exits — the gate's own comment at `agent-evaluate.js:973-977`).

### 7.2 Language half (this arc's)

| # | Shape | Where it sits | Fence | Ships while the data half is open? |
|---|---|---|---|---|
| **1** | The prompt states, per tick, which signals are present, and the `threshold` instruction says a threshold may cite only a present signal | (a) a `SIGNALS NOT PROVIDED THIS TICK: VWAP (no current session)` line in the live context beside the momentum snapshot push (`agentEvalPromptAssembly.js:1196-1201`) — the `CACHE-COLD RULE` (`voiceLayerPrompt.js:3181-3185`) is the in-house precedent for stating an absence; (b) one sentence in the anticipation guidance (`:501`) and the schema (`agentEvalToolSchema.js:180`, not fenced): *"cite only signals present in this context; a threshold naming an absent signal will be dropped"*; (c) the same qualifier on rows 1–2 (*"When provided — and this context says when it is not"*). Deliverable as a DR-13 flag-split (dark render module + one fenced import/call), which then **must** join `PROMPT_CONTRIBUTING_MODULES` in the same commit (BUILD_RULES §1). The honesty pin at `:74` stays satisfied (the word remains). | **fenced edit** (a, c); founder-reviewed | yes — true under either outcome (the line lists what is present *this tick*) |
| **2** | A validator rejects a threshold citing an absent signal before it is persisted | A pure module (the `agentVwapFloor.js` pattern: no I/O), called in the cron between the decider's return and the two persistence sites — the queue at `agent-evaluate.js:2162-2166` (`pendingAnticipations.push`) and the stamp input at `:2833` — with a present-signals set built from the same in-memory tick objects the prompt was built from (`momentumData.vwap` keys → VWAP per held symbol; `techScoresMap` / `rankingsMap` → RSI, RVOL, %B, rsPercentile, levels per bench symbol; the held CSV → ATR). Vocabulary regexes: VWAP, 5-min MACD/RSI/VWAP, RVOL, RSI (for held), "the 20-day". A rejected candidate is dropped with a shadow-log breadcrumb (`logAnticipation` with a new `errorStep: 'threshold_absent_signal'`, the `grounding_dedupe` precedent at `voiceLayerAnticipation.js:80-92`). **Reject, do not rewrite**: rewriting the agent's sentence is a second honesty problem. | **fence-free** (cron + new pure module + `tickStamps.js` unchanged) | yes — and it is the only shape that is honest *today* for both models, since it runs before Gemma sees the sentence |
| **3** | The surface marks a threshold whose signal was absent when written, in the arc's verbs | Client only: `evaluations[].candidates[].threshold` and the same entry's `evidence[sym]` are both on the entry (`tickStamps.js:275-284`, `:182-201`). For a **held** `potential_exit` candidate the entry's `evidence[sym].vwapDev === null` is the absence fact, so the Film Room log / bubble can foot the note with *"Recorded with no VWAP reading at that check"* (the arc's verbs are ASSUMED to be *flagged / recorded*, from the grounded note `voiceLayerGrounding.js:950-963`). For a **bench** candidate nothing on the entry records bench-technicals presence, so option 3 **cannot** honestly mark the QCOM/RVOL/RSI cases today without a new stamp. | fence-free, client-side | yes, but only for held-side VWAP; the rest waits on a presence stamp |

**Which must land first:** the **language half** — specifically **shape 2**, because it is correct whether VWAP comes back or is retired, needs no fenced review, and stops the next battle's feed from making promises on signals the tick did not hold; shape 1 is the durable fix and follows through fenced review. The data half cannot land first: its first step is a measurement, and its two branches are a plan decision (no code) or a retirement that touches five fenced files.

**Spec re-version rather than build:** the five charters' *"finalize wording against the real cron indicator set so the agent commits only to signals it can observe"* was written before the build and never done; SP-02 (*"Hunt slightly-less-extreme volatility (still high-ATR…)"*) survives §5's table as-is, while SP-07 (*"Require a stronger momentum/technical trigger before piling in"*) needs its trigger vocabulary pinned to the observable rows (ATR band, regime, NR7, BB width for held; RSI-14, MACD cross, %B, RVOL, rsPercentile, levels for bench). That is a DEF re-version, not a defect; the grounding spec's §7 list (`VOICE_LAYER_GROUNDING_SPEC_V1_2.md:36`) already names the *"specific condition that would make you act"* instruction as the fence-adjacent founder ruling that shape 1 changes.

---

## For the design chat

**Q1.** The two September battles prove the gate was closed on every check; read `cronState.intradayMomentum` on one June/July/August doc (`{}` = the norm since the gate shipped) and `cronState.intradayMomentum[sym].sessionDate` on one May 13–Jun 11 doc (a prior-day date = the lag, measured in the record); the doc cannot separate "gate rejected" from "feed empty" — only the Vercel log lines can.

**Q2.** Gate: the June 12 `sessionDate === todayET` gate re-imposed the today-only constraint the May 12 filter applied, which the May 12 production investigation and the May 6/13 commits each document as unsatisfiable under EODHD's ≥1-trading-day intraday lag; the repo's own "mimic a real EODHD response" fixture is one trading day behind its evaluation date and publishes nothing under the gate; nothing in the path changed since May 13; one curl (§3.6) is the remaining live confirmation.

**Q3.** VWAP is named in ten decider-facing places (system prompt three times, institutional note twice, tool schema twice, the equipped Forge rules verbatim as `S{n}.` lines, the momentum snapshot and the trigger) and only the last two are conditional on the map; when the map is empty the snapshot's VWAP part vanishes with no marker while everything else keeps calling VWAP a signal the agent checks — so the invented threshold is the prompt's output, not the model's.

**Q4.** Of the four quoted thresholds only the ATR multiple and the resistance level are observable for their symbol; RSI and RVOL exist for bench names only (never held), daily VWAP is observable-but-absent-today, and 5-minute MACD/RSI/VWAP are not in the data at all yet reach the prompt through Forge rule text the C-20 sweep does not cover; the persisted `?? 50` still prints `rsPercentile=50 (outperforming)` for an unmeasured bench name.

**Q5.** The threshold is voiced by Gemma under the shipping `'shadow'` mode (the threshold-free code note runs only at `'on'`), persisted twice, re-read by no tick and no surface, and no copy guard covers it — write-once prose the player cannot audit.

**Q6.** Ship the fence-free pre-persistence validator (reject, not rewrite) now, then the fenced per-tick "present / not provided" line via the DR-13 split; run the curl and decide plan-vs-retirement for the data half with §7.1's blast radius in hand; re-version the five charters' build-calibration sentence against §5's table.

**Recommendation (six lines):**
1. Founder: one curl (§3.6) this week; if the lag holds, choose plan upgrade or formal retirement — the floor has been inert since June 12 either way.
2. This arc, now: shape 2 — a pure `anticipationThresholdLint` module + two cron call sites, rejecting any threshold that names a signal absent from that tick's own data; shadow-log the rejects.
3. Next, fenced and founder-reviewed: shape 1 — a `NOT PROVIDED THIS TICK` line next to the momentum snapshot and a one-sentence "cite only present signals" rule in the threshold instruction and schema, via the DR-13 split, registered in the honesty registry in the same commit.
4. Shape 3 only for held-side VWAP (the evidence stamp already carries the fact); skip the bench side until a presence stamp exists.
5. Spec: re-version SP-07 (and TF-02/07, CN-01/02/03/05/08, CP-02/03/04/05, FI-02/03/04/08) against §5's observable rows; that sentence was the requirement.
6. Fix the Gemma `DATA_CONFIDENCE_RULE` "prior session" sentence (non-fenced) — it describes a state the gate abolished.

**Found outside the six questions (reported, not fixed — BUILD_RULES §3):**

1. **The Forge rule library bypasses the C-20 honesty sweep.** `forgeKnowledgeBase.js` is not in `PROMPT_CONTRIBUTING_MODULES` (`promptHonestyRegistry.js:47-53`), so rule texts carrying FORBIDDEN names — "5-minute MACD" (mb-05 `:652`, mb-11 `:806`, ts-08 `:1588`), "5-minute RSI" (ts-03 `:1460`, ts-05 `:1511`), "standard deviations from daily VWAP" (t-10 `:1668`) — render verbatim into the fenced identity block through `resolveRuleText` (`agentEvalPromptAssembly.js:877-882`); `sanitizeRuleText` strips injection patterns only (`agentPromptAssembly.js:301-313`).
2. **The persisted `?? 50` survived the Sep 9 F-3 fix.** `compute-index-intelligence.js:1006` (and `:1298-1299`) still writes `rsPercentile: 50` for a symbol dropped from the RS sort; the fix removed only the reader-side default, and `voice-layer-cache.js:602` still declares `factors.rsPercentile ?? 50` (its RS verdict is gated at `:634`).
3. **D-103 holds only at grounding `'on'`.** At the shipping `'shadow'` the Gemma path voices the threshold (`voiceLayerPrompt.js:3662, :3735-3736`); the spec's "threshold renders nowhere in the narrator's voice" (`VOICE_LAYER_GROUNDING_SPEC_V1_2.md:36`) describes the canary path, not production.
4. **The schema's own threshold example names a level the prompt never carries** — "holds above the 20-day" (`agentEvalToolSchema.js:180`; `agentEvalPromptAssembly.js:501`; `voiceLayerPrompt.js:3662` in the Gemma instructions too); the bench trend line renders labels and `sma200_position` only.
5. **`DATA_CONFIDENCE_RULE` describes a pre-gate world** — "the prior session when EODHD's data hasn't refreshed" (`voiceLayerPrompt.js:1888`) has been impossible since June 12; `buildIntradayLine`'s "Prior session" prefix (`:1292-1294`) is likewise unreachable from the cron path.
6. **The honesty test pins VWAP as required** (`agentEvalPromptAssembly.honesty.test.js:74-78`); any retirement or rewording must move that pin in the same commit, per the §2 flip-reconciliation rule's logic.
7. **The gate's design premise was never written into `docs/`.** Both investigations that measured the lag live only on never-merged branches (`claude/vwap-semantics-investigation` @ `5414d7c5`; `claude/investigate-vwap-production-J3be9` @ `bc1d438b`); `adaa151b`'s "outage" framing is the only in-tree account, and it is the wrong one. `docs/vwap-floor-semantics-v1.md`, cited by `agentVwapFloor.js:3`, is not at HEAD (VERIFIED — no such file).
8. **Anticipation `threshold` is persisted on the entry under `candidates[]` but the decider never sees its own prior candidates** (`formatRecentEvals`, `:1389-1402`), so "if it hits and you act, the user sees the loop close" (`:501`) has no mechanism behind it on the decider side.

**STOP.** Nothing further is built from this branch; a discovery branch is never merged on its own.
