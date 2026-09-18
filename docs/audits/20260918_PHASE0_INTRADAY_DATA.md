# Phase 0 — Intraday Data (read-only discovery)

**Date:** 2026-09-18 · **Branch:** `claude/phase0-intraday-data` · **Base:** `origin/main` @ `35090911` (clean tree at session open)
**Scope:** read-only. No source file changed. No EODHD call made from this session. One new file: this report.

**Preamble (BUILD_RULES §3):**
- `git fetch origin` was run as the first step of the session. `origin/main` = `35090911`; the branch was cut from it. `claude/phase0-intraday-data` did not exist on origin — created fresh.
- `git fetch --unshallow` was run (permitted by §3, recorded here): the container was a shallow clone (341 commits) and neither `adaa151b` (Jun 12) nor `a0288c41` (Feb 14) was reachable until then. History is now 4,056 commits.
- BUILD_RULES §1 and §3 read. `docs/audits/20260915_PHASE0_SIGNAL_LANGUAGE.md` read in full; every anchor it supplies is **re-verified at this HEAD** below and each row says so. One of its anchors has drifted (§2, `voiceLayerPrompt.js` DATA CONFIDENCE) and is corrected here.
- **Fence:** `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentScoring.js`, `agentBattleService.js` and `api/agent/decide.js` were **READ**. Nothing was edited. Full inside/outside split in §9.
- Every claim carries `file:line` and a **VERIFIED** / **ASSUMED** marker. VERIFIED = read at that line in this session.
- **Branch note:** the session harness nominated `claude/practical-maxwell-147hef`; the task prompt explicitly names `claude/phase0-intraday-data`. The prompt wins, and that is where this commit lands.

---

## Executive verdict

| # | Question | Verdict | Confidence |
|---|---|---|---|
| 1 | The existing VWAP path | The gate is **`sessionDate === todayET && sessionCandleCount >= 3`** — a **calendar-date test only**. It has **no freshness component**: a feed stalled for six hours, still stamped today, passes. Held symbols only; bench never fetched. | VERIFIED |
| 2 | Decider's VWAP / RVOL sites | Ten VWAP sites at HEAD, all at the Sep 15 line numbers (that file is unchanged). Only rows 9–10 are conditional on the map. **RVOL adds five more sites**, four of them unconditional prose; the one rendered value is **bench-only**. `buildPresentSignals` is a **binary present/absent Set** — it has **no slot for a third state** and no field for source or delay. | VERIFIED |
| 3 | PvP-era websocket | **Survives on `main`** — `src/services/websocketService.js` (779 lines), added `a0288c41` (Feb 14 2026), **still imported from 8 live modules including `App.jsx`**. It has exponential-backoff reconnect *and* resubscribe-all-on-open. It is **inert**: `b4ff276e` (Aug 1 2026) made `/api/ws-config` return `{available:false}` permanently, and the client treats that as terminal. It is a **browser** client, never a server one. | VERIFIED |
| 4 | The VPS | `FORGE_AGENT_VPS_HANDOVER_MAY21_2026_v2.md` **is not in this repo and never has been** (searched HEAD, all refs, full history). Four in-code traces exist; they describe a **manual, human-triggered paste pipeline**, not a service. No systemd unit, no pm2 config, no VPS credential path, no Firestore auth for it. A second long-running process is a **new deployment shape**, not a config addition. | VERIFIED (absence proven) |
| 5 | Vercel cron constraints | **39/40 entries** at HEAD. The **plan allows per-minute crons** — `* * * * *` shipped in production Feb–Mar 2026 (`dff0ed96` → `68723eee`). The binding constraint is the **slot count (1 left)**, not the interval. | VERIFIED |
| 6 | EODHD consumption | Fixed weekday spend ≈ **6,530 calls**; `agent-evaluate` adds ≈ **2,664 per active battle per day**; `mandate-evaluate` up to **11,400/day** when live. Headroom under 100,000 is large **today** — but three shipped comments (`MANDATE_QUOTE_BATCH_SIZE`, `fetchRealtimeQuotes`, the `voice-layer-cache` "bulk") budget in **requests**, and are wrong by 20–100× under the per-ticker rule. | VERIFIED (counts) / ASSUMED (battle count) |
| 7 | Scoring price source | `lastTickPrice` is the **delayed** `/real-time/` `close` (`marketDataCache.js:750`). A delayed VWAP would be compared against a **delayed** price — the two are the same vintage. But the feed's own `timestamp` **is fetched and then discarded** on this path. | VERIFIED |
| 8 | Why? panel vintage line | `provenanceLine` (`decisionRecord.js:1069-1098`) renders three parts from `evaluation.vintages`. `vintages.vwap` is the **hard-coded literal `'tick'`** — it can take no other value, and **nothing renders it**. | VERIFIED |
| 9 | Fence contact | Of the candidate design's five likely write sites, **two are inside the fence** (the prompt sites, the risk manager) and **three are outside** (the fetch, the gate, `buildPresentSignals`, the `vintages` writer). | VERIFIED |

---

## 1. The existing VWAP path

### 1.1 The fetch

| Fact | Anchor | Marker |
|---|---|---|
| The intraday fetch is `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` | `api/cron/agent-evaluate.js:958` | VERIFIED |
| It is one of four legs of a `Promise.allSettled` | `api/cron/agent-evaluate.js:957-965` | VERIFIED |
| `portfolioSymbols` = `flattenPortfolioServer(battle.portfolio).map(a => a.symbol)` — **held positions only** | `api/cron/agent-evaluate.js:698-699` | VERIFIED |
| `benchSymbols` (`:704`), `hotBenchSymbols` (`:707`) and `allSymbols` (`:710`) exist on the same tick and are **not** passed to the intraday fetch | `api/cron/agent-evaluate.js:704-710` vs `:958` | VERIFIED |
| Batch helper fans out one HTTP GET **per symbol**, concurrency 5, 200 ms between batches; per-symbol failure → `[]`, never a reject | `api/_utils/marketDataCache.js:883-913` | VERIFIED |
| Endpoint: `` `${API_BASE}/intraday/${eohdSymbol}?api_token=…&fmt=json&interval=${interval}` `` with `API_BASE = 'https://eodhd.com/api'` | `api/_utils/marketDataCache.js:799`, `:27` | VERIFIED |
| `hoursBack` is **not passed** by the cron, so no `&from=`/`&to=` window is sent — EODHD's default response window is used. The JSDoc calls this "recommended — sidesteps feed-delay edge cases where a NOW-relative window can fall entirely outside published candles" | `api/_utils/marketDataCache.js:787-789`, `:800-804`, call site `:958` | VERIFIED |
| Two response filters run before the candles are returned: partial candles (any non-finite OHLC) dropped, and the synthetic RTH close-print bar (`volume == null` **and** O==H==L==C) dropped | `api/_utils/marketDataCache.js:828-835`, `:851-858` | VERIFIED |
| Second, on-demand fetch site: `fetchIntradayCandles(symbol, { interval: '5m' })` inside the cascade-guard qualification, raced against a 5 s timeout, memoised per tick | `api/cron/agent-evaluate.js:515-545` (fetch at `:521`), timeout const `api/_utils/agentVwapFloor.js:22` | VERIFIED |

### 1.2 The June 12 gate — the exact predicate

```js
export function isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount }) {
  return sessionDate === todayET && sessionCandleCount >= MIN_SESSION_CANDLES;
}
```
`api/_utils/agentVwapFloor.js:36-38` (VERIFIED). `MIN_SESSION_CANDLES = 3` at `:13` (VERIFIED).

Called once, at `api/cron/agent-evaluate.js:989` (VERIFIED):

```js
const { candles: sessionCandles, sessionDate } = filterToLatestSession(candles);   // :982
const vwapResult = calculateVWAP(sessionCandles);                                   // :983
if (vwapResult && isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount: sessionCandles.length })) {  // :989
  const sma20_5m = calculate5minSMA20(candles);                                     // :990
  momentumData.vwap[symbol] = { ...vwapResult, sma20_5m, sessionDate };             // :991
}
```

`todayET = formatDateString(getETDate())` — `api/cron/agent-evaluate.js:766` (VERIFIED).
The module was added by `adaa151b`, **2026-06-12**, *"VWAP floor Phase 1: freshness gate, dead-band strikes, counter hygiene"* (VERIFIED, `git log --full-history --diff-filter=A`). Its header names the *"June 11 incident: agent 'Shadow', 12 swaps in ~2h on stale-session VWAP"* (`agentVwapFloor.js:3-4`, VERIFIED).

**Does it check freshness, or only the session date? — Only the date.** This is the report's load-bearing finding, and it holds on three independent legs:

1. **The predicate itself** compares two `YYYY-MM-DD` strings and an integer count. No instant, no age, no delay term (`agentVwapFloor.js:36-38`, VERIFIED).
2. **`sessionDate` is derived from the candle data, not from a clock.** `filterToLatestSession` anchors on *the latest ET date present in the candles* — `parsed.reduce((max, p) => (p.etDate > max ? p.etDate : max), …)` (`marketDataCache.js:1060-1063`, VERIFIED) — and then keeps that date's RTH-window bars (`:1071-1076`). Its own JSDoc says it *"[r]eturns the latest session even if it's partial … No minimum-candle gate"* (`:1029-1030`, VERIFIED).
3. **The freshness parameter exists and is deliberately unused.** `filterToLatestSession(candles, now = new Date())` carries an `eslint-disable-line no-unused-vars` and the comment *"`now` is retained in the signature for future 'freshness gating' use (e.g., refusing data that's more than N trading days stale) but is currently unused — session anchoring is driven entirely by the data"* (`marketDataCache.js:1032-1034`, `:1040`, VERIFIED).

**Therefore: a stalled feed passes the gate.** If EODHD published three or more 5-minute bars stamped with today's ET date at 09:35 and then stopped, every tick from 09:50 to 16:00 would recompute the same VWAP off the same three bars, `sessionDate` would still equal `todayET`, `sessionCandleCount` would still be ≥ 3, and the floor would arm on a reading hours old. Nothing downstream re-checks: the risk manager sees only `{ vwap, vwapDeviation, sma20_5m }` (`agent-evaluate.js:1377-1381`, VERIFIED) — the snapshot **does not carry `sessionDate`**, let alone a candle timestamp.

The one predicate in the repo that *does* gate on delay is on the mandate path, not this one — see §7.3.

### 1.3 How `vwapDev` and `intradayMomentum` are computed and written

| Step | Anchor | Marker |
|---|---|---|
| `momentumData = { vwap: {}, rankings: {} }` — the per-tick in-memory map, one per battle | `api/cron/agent-evaluate.js:949` | VERIFIED |
| `calculateVWAP` returns `{ vwap, currentPrice, vwapDeviation }`, all `Number(x.toFixed(4))`. `vwapDeviation = ((currentPrice − vwap) / vwap) × 100`; `currentPrice` is the **last session candle's close**, not the quote | `api/_utils/technicalCalculations.js:378-410` (deviation `:403`, `currentPrice` `:394`) | VERIFIED |
| It is a **cumulative session VWAP over 5-minute bars** — typical price `(h+l+c)/3` weighted by bar volume. Returns `null` on empty input or zero cumulative volume | `api/_utils/technicalCalculations.js:379`, `:384-391` | VERIFIED |
| Asymmetry, deliberate: `calculateVWAP` gets **session-filtered** candles, `calculate5minSMA20` gets **all** candles (it slices the last 20 by index) | `api/cron/agent-evaluate.js:967-976`, `:990` | VERIFIED |
| Published entry shape: `{ vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate }` | `api/cron/agent-evaluate.js:991` | VERIFIED |
| Whole-batch failure branch logs `Intraday fetch failed:` — but `fetchIntradayBatch` settles per symbol and **never rejects**, so this branch is unreachable in practice | `api/cron/agent-evaluate.js:995-997` vs `marketDataCache.js:889-904` | VERIFIED |
| Persisted as `cronState.intradayMomentum` — a direct write of `momentumData.vwap` | `api/_utils/agentCronState.js:39`; call sites `api/cron/agent-evaluate.js:1819, :1836, :1876, :1953, :3078` | VERIFIED |
| The per-check `evidence[sym].vwapDev` is `round2(vwapInfo?.vwapDeviation)` off the **same map** | `api/_utils/tickStamps.js:196` (field doc `:175`) | VERIFIED |
| The decider's own line reads the same map | `api/_utils/agentEvalPromptAssembly.js:1834`, `:1838-1840` | VERIFIED |

So one gate decision at `:989` determines, for that symbol on that tick: the prompt line, the strike counter, the risk snapshot, the wake trigger, and the persisted evidence stamp. There is no second source.

### 1.4 Where `cronState.vwapTicks` / `vwapFireGuard` advance

| Step | Anchor | Marker |
|---|---|---|
| `vwapTicks` seeded as a working copy from the battle doc | `api/cron/agent-evaluate.js:1263` | VERIFIED |
| Counter hygiene — keys for symbols no longer held are deleted in place | `api/cron/agent-evaluate.js:1276` → `api/_utils/agentVwapFloor.js:63-69` | VERIFIED |
| **The strike**: `if (vwapInfo && isVwapStrike(vwapInfo.vwapDeviation, presetConfig.risk.vwapDeadBandPct ?? 0.5)) vwapTicks[sym]++ ; else vwapTicks[sym] = 0;` — note the `else`: **a null map zeroes the counter**, it does not hold it | `api/cron/agent-evaluate.js:1353-1357` | VERIFIED |
| `isVwapStrike(dev, band) ⇔ Number.isFinite(dev) && dev < -band` | `api/_utils/agentVwapFloor.js:49-51` | VERIFIED |
| Dead bands: aggressive 0.7 / balanced 0.5 (conservative below); fire thresholds `vwapFailureTicks` 3 / 2 | `api/_utils/agentPresetConfig.js:15-20`, `:36-38` | VERIFIED |
| `vwapFireGuard` seeded per battle per ET day | `api/cron/agent-evaluate.js:1279` → `api/_utils/agentVwapFloor.js:80-85` | VERIFIED |
| Guard arms after `VWAP_CASCADE_GUARD_N = 4` fires; each further fire must qualify its replacement on a **fresh** intraday fetch | `api/cron/agent-evaluate.js:1526-1542`; const `api/_utils/agentVwapFloor.js:17` | VERIFIED |
| `isReplacementQualified` = `isVwapSessionUsable(…) && Number.isFinite(dev) && dev > -band` — i.e. the qualification re-uses **the same date-only gate** | `api/_utils/agentVwapFloor.js:102-108` | VERIFIED |
| Counter incremented live inside the tick: `if (riskResult.reason === 'vwap_failure') vwapFireGuard.count++` | `api/cron/agent-evaluate.js:1675` | VERIFIED |
| Incoming symbol's counters reset to 0 at three swap sites | `api/cron/agent-evaluate.js:1681`, `:2677`, `:3936` | VERIFIED |
| Both persisted by one helper across all five flush paths | `api/_utils/agentCronState.js:38`, `:47` | VERIFIED |

### 1.5 The two consumers that disarm with the map

- **`vwap_failure`** fires only when `intradaySnapshot` is truthy **and** this tick's deviation is below the dead band: `api/_utils/agentRiskManager.js:140-146` (FENCED — read only). A null map means no fire, ever.
- **`TRAIL_STOP`** requires `intradaySnapshot?.sma20_5m != null`: `api/_utils/agentRiskManager.js:165-170` (FENCED — read only). `sma20_5m` is published **only inside the gate's if-block** (`agent-evaluate.js:990`), so the gate disarms the trailing stop too.

The gate's own comment says so: *"a stale session … or an ultra-thin one (<3 candles at the open) publishes NO vwap entry at all, so the floor cannot strike and TRAIL_STOP disarms … Bust + guardrails + Haiku still cover"* (`agent-evaluate.js:984-988`, VERIFIED).

---

## 2. Where the decider consumes VWAP and RVOL

### 2.1 The ten VWAP sites, re-verified at this HEAD

`api/_utils/agentEvalPromptAssembly.js` last changed `152217ea` (Sep 2) — before the Sep 15 audit — so its line numbers have not drifted. **Every line below was re-read in this session.**

| # | Where | Line(s) at HEAD | Conditional on `momentumData.vwap`? |
|---|---|---|---|
| 1 | Eval system prompt, `━━━ INTRADAY MOMENTUM SIGNALS ━━━`, tiered variant — *"When provided, use these signals… VWAP DEVIATION: Price above VWAP = intraday bullish momentum… Deviation >1.5% is significant."* | `:392-397` | No — only the two words "When provided" |
| 2 | Same block, second game-mode variant, byte-identical prose | `:596-601` | No |
| 3 | `TRADE REASONING` → `indicators` example: `["RSI 28 (oversold)", "BB width 12th pctl [SQUEEZE]", "VWAP +0.4%"]` (both variants) | `:456`, `:659` | No |
| 4 | `C_INST` institutional-lag note, both flag branches — *"…if VWAP (held positions) or RSI-14 shows a breakdown"* | `:328`, `:334`; rendered at `:821` under `:817-818` | No |
| 5 | Live context, `=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===` — *"…if real-time technicals (VWAP on held positions, RSI-14) show a breakdown"* | `:949` | No |
| 6 | **Equipped Forge rules, verbatim, as `S{n}.` / `C{n}.` lines** | `:804-813` (`S${i+1}` at `:811`) | No |
| 7 | Tool schema, `trade_reasoning.indicators` example | `api/_utils/agentEvalToolSchema.js:96` | No |
| 8 | Tool schema, `cited_rules` standard names — `"vwap_mean_reversion"`, `"vwap_failure"` | `api/_utils/agentEvalToolSchema.js:119` | No |
| 9 | Live context, `INTRADAY MOMENTUM SNAPSHOT` — the value itself | builder `:1826-1862`, VWAP part `:1838-1840`, pushed `:1196-1201` | **Yes** — `if (vwapInfo && vwapInfo.vwapDeviation != null)` |
| 10 | Trigger block, `vwap_deviation` wake reason at \|dev\| ≥ 1.5% | `api/_utils/agentTriggerGate.js:115-131`; rendered `agentEvalPromptAssembly.js:1190-1194` | **Yes** — `if (!vwapInfo \|\| vwapInfo.vwapDeviation == null) continue` |

All ten VERIFIED at these lines in this session. Row 6's nine rule texts and one select option, re-verified in `src/data/forgeKnowledgeBase.js`: **mb-05** `:652` (*"above the daily VWAP and the 5-minute MACD shows a {signal} signal"*), **mb-14** `:885` (option *"5-min VWAP trend"*), **mb-15** `:908`, **ts-02** `:1434`, **t-09** `:1643`, **t-10** `:1668`, **t-16** `:1820`, **tv-04** `:2452`, **tv-09** `:2590`, **tv-15** `:2756` — all VERIFIED.

**`api/agent/decide.js` contains no VWAP reference at all** (grep over the whole 77 KB file returns zero hits — VERIFIED). The draft-time decider never sees VWAP; only the eval-time Haiku path does.

**When the map is empty**, rows 1–8 are byte-identical to a full-map tick, row 9 disappears with no marker or placeholder (a symbol with no parts gets no line, `:1854-1856`; no lines ⇒ the whole block is omitted, `:1859`), and row 10 never fires. **Re-verified.**

The C-20 prose-honesty test **requires** the literal string `VWAP` in every eval system prompt — *"keeps VWAP guidance, which is real for HELD positions"* — `api/_utils/agentEvalPromptAssembly.honesty.test.js:74-78` (VERIFIED). Any retirement moves this pin in the same commit.

### 2.2 RVOL / volume-ratio sites (new to this pass)

| # | Where | Line(s) | Class | Conditional? |
|---|---|---|---|---|
| R1 | Eval system prompt, `STOCK REGIMES` → directional_expansion — *"S2 Breakout Confirmation (**RVOL > 1.2x** + BB %B >= 0.8 …)"*, tiered variant | `agentEvalPromptAssembly.js:416-417` | Named threshold | **No** |
| R2 | Same line, second variant | `agentEvalPromptAssembly.js:620-621` | Named threshold | **No** |
| R3 | `CROSS-REGIME STRATEGY` → S5 News-Catalyst Momentum — *"…AND **volume ratio > 1.2x** AND…"*, both variants | `agentEvalPromptAssembly.js:430`, `:634` | Named threshold | **No** |
| R4 | Anticipation guidance, `signalSummary` example — *"Relative strength is building against the sector and **volume is confirming**."*, both variants | `agentEvalPromptAssembly.js:500`, `:703` | Example phrasing | **No** |
| R5 | Tool schema, `signalSummary` description — same example sentence | `agentEvalToolSchema.js:176` | Example phrasing | **No** |
| R6 | `BENCH TECHNICAL CONTEXT` → `renderBenchVolumeLine` — `Volume: {tier} tier \| RVOL={x.xx}` | builder `agentEvalPromptAssembly.js:1652-1662`, pushed `:1562-1563`, block header `:1585` | **The value itself** | **Yes** — `tech?.volumeProfile`, then `vp.ratio != null` |
| R7 | Also regime-adjacent: `S1 Volatility Squeeze Breakout (BB squeeze + **volume surge** + …)` | `agentEvalPromptAssembly.js:415`, `:619` | Named condition | **No** |

All VERIFIED. **RVOL is structurally the same failure as VWAP, mirrored**: the prose (R1–R5, R7) is unconditional and names a numeric threshold the model is told to apply; the only rendered *value* (R6) is **bench-only**, from `stockTechnicalScores[sym].volumeProfile.ratio`.

The held side carries **no volume column at all**: the ACTIVE POSITIONS CSV header is `Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%` (`agentEvalPromptAssembly.js:1465-1466`, VERIFIED), and the BENCH swap list header is `Symbol,Sector,$Current,Daily%,ATR%,Status` (`:1495`, VERIFIED). So a model told at `:416` to require **RVOL > 1.2x** can see RVOL for a **bench** name and never for a **held** one — the exact inverse of VWAP, which is held-only (`:958`).

`momentumData` carries no volume key of any kind (`agent-evaluate.js:949` + the writes at `:991`, `:1106`, `:1203-1214`, `:1257`, `:1402` — VERIFIED). A session-cumulative volume from the delayed endpoint would be a **new key**, not a fill-in of an existing null.

### 2.3 `buildPresentSignals` — what it does today, and what it cannot express

`api/_utils/anticipationThresholdLint.js:240-297` (VERIFIED). Pure module, no I/O, no imports (`:13-15`). Called once per tick at `api/cron/agent-evaluate.js:2195-2201`; verdicts at `:2210-2214`. The whole path is dark: `ANTICIPATION_THRESHOLD_LINT_MODE = 'off'` (`src/config/featureFlags.js:2563`, VERIFIED), tri-state `['off','shadow','on']` (`:2566`).

**Signature and return type.** It returns `Map<string, Set<string>>` — symbol → a `Set` of signal-name strings (`:238`, `:240-241`, `:296`). `lintThreshold` consumes it as `const have = present.get(symbolKey(symbol)) || new Set(); const absent = named.filter(s => !have.has(s));` (`:362-363`). **The only operation performed on the value is `Set.prototype.has`.** The type is a membership test and nothing else.

**What it does for `vwap` today:**
```js
if (doc(vwapMap, sym)?.vwapDeviation != null) set.add(SIGNAL_NAMES.VWAP);
```
`:266` (VERIFIED). The comment at `:264-265` is explicit about why: *"The momentum snapshot renders the VWAP part only when the deviation is a reading — the same `!= null` test the renderer applies."* The lint's model of "present" is **"the renderer would have printed this"**, bound by construction to `buildMomentumSnapshot`'s own `:1838` test (BUILD_RULES §9). Held-only, from `momentumData.vwap` (`:243`).

**What it does for volume today:**
```js
if (tech?.volumeProfile?.ratio != null) set.add(SIGNAL_NAMES.RVOL);
```
`:290` (VERIFIED) — inside the **bench** loop (`:282-294`), which `continue`s on any symbol already in the held set (`:283`). The header comment states the asymmetry as the prompt's, not the module's: *"`techScoresMap` is consumed ONLY by the bench block, so RSI / MACD / %B / RVOL / rsPercentile are never rendered for a held name; the intraday fetch is held-only … so VWAP is never rendered for a bench name"* (`:220-226`).

**What the current shape CAN express:**
- Per-symbol, per-tick presence of a named signal, keyed by a normalised symbol (`symbolKey`, `:191`).
- Held/bench asymmetry, because held and bench are two separate loops writing disjoint key sets.
- "Never present for anybody": five names in `NEVER_PRESENT_SIGNALS` (`:73-79`) are simply never `.add`-ed by any branch.
- Absence as a *list* on the verdict: `{ ok: false, absent: [...] }` (`:364`), in declaration order (`:334`).

**What the current shape CANNOT express — and this is the finding:**

1. **No third state.** A signal is in the `Set` or it is not. There is no `delayed`, no `stale`, no `degraded`. Every consumer is a boolean `has`.
2. **No room for a value.** `Set<string>` holds names. A delay in minutes, an as-of instant, or a source tag has nowhere to live without changing the value type of the map.
3. **No caveat channel on the verdict.** `lintThreshold` returns `{ok: true}` or `{ok: false, absent: string[]}` (`:357`, `:361`, `:364`). There is no `caveats` field and no third verdict; a "present but 18 minutes old" reading can only be encoded by lying in one direction — `ok: true` (the promise stands, delay invisible) or `ok: false` (the candidate is dropped at `'on'`, `agent-evaluate.js:2215-2218`).
4. **No vocabulary distinction between a signal and its vintage.** The vocabulary table maps regex → name (`:117-131`); `namedSignals` returns names only (`:316-335`). "VWAP" and "a 15-minute-delayed VWAP" are the same token.
5. **The lint's honesty contract is structurally binary too.** Its stated invariant — *"an accepted threshold is byte-identical to what the decider wrote. This module REJECTS; it never rewrites"* (`:17-20`) — means it has exactly two outputs available for any input. There is no "accept with a footnote" that does not amount to rewriting.

Three shapes would each work, and the module admits any of them without changing the reject-never-rewrite invariant: **(a)** a new name (`VWAP_DELAYED`) alongside `VWAP` in `SIGNAL_NAMES` and a vocabulary row; **(b)** widening the map's value from `Set<string>` to `Map<string, {state, asOf, source}>` and giving `lintThreshold` a third verdict; **(c)** a parallel map returned beside `present`. **This report does not recommend one** — it records that (a) costs nothing structurally and expresses least, (b) costs a value-type change on the only data structure five call sites read and expresses most, and (c) leaves `present` untouched at the cost of two maps that can disagree (a §9 display-agreement hazard by construction).

---

## 3. The PvP-era websocket code

**It survives on `main`, imported and reachable — and it is inert by server decision.**

### 3.1 Where it lives

| File | Lines | Role | Marker |
|---|---|---|---|
| `src/services/websocketService.js` | 779 | The listener: `WebSocketManager` singleton, two sockets (stocks + crypto), ref-counted subscriptions, daily H/L tracker, price cache, diagnostics | VERIFIED |
| `src/hooks/useWebSocketPrices.js` | 119 | React hook wrapper | VERIFIED |
| `src/services/wsCacheBridge.js` | 77 | 60 s flush of WS prices into `cacheService` | VERIFIED |
| `api/ws-config.js` | 41 | The server endpoint the client asks for socket URLs | VERIFIED |

Added by **`a0288c41`, 2026-02-14** — *"Add EODHD WebSocket real-time price streaming to all battle views"* — which created `websocketService.js` **and** `api/ws-config.js` in the same commit (VERIFIED, `git log --full-history --reverse`). That is the PvP era: the same commit range carries `b03fda6a` *"prevent false BaggerBomb/Bust threshold triggers in PvP battles"* and `a47d22ff` *"WebSocket real-time price capture for battle entry with REST fallback"*.

### 3.2 It is imported

| Importer | Line | What it takes |
|---|---|---|
| `src/App.jsx` | `:17` | `startWsCacheBridge` |
| `src/components/Tournament/Flat6BattleView.jsx` | `:33`, `:126` | `useWebSocketPrices(symbols, …)` |
| `src/components/League/battleArena/useArenaPriceContext.js` | `:19`, `:31` | `useWebSocketPrices` |
| `src/components/Dashboard/Watchlist/WatchlistContainer.jsx` | `:2`, `:154` | `useWebSocketPrices` |
| `src/components/BaggerBomb/BaggerBombBattleViewRedesign.jsx` | `:41`, `:145` | `useWebSocketPrices` |
| `src/hooks/useBaggerBombBattleV3.js` / `V4.js` | `:8` / `:9` | `getDailyHL` |
| `src/components/Research/StockChart.jsx`, `useResearchData.js` | `:7`, `:6` | `getDailyHL` |
| `src/utils/priceCapture.js`, `src/utils/debug.js` | `:1`, `:10` | `captureRealtimePrices`, `wsManager` |

All VERIFIED. It is **not** dead code by import graph — it is dead by transport.

### 3.3 Reconnect and resubscribe — both present

- **Resubscribe-on-open, all symbols not just new ones**: `const allSymbols = Object.keys(this._stockSubscriptions); if (allSymbols.length > 0) this._sendSubscribe(this._stockWs, allSymbols, 'stock');` — `websocketService.js:298-302` (VERIFIED). Crypto mirror at `:405-409`.
- **Exponential backoff reconnect**, 2 s → 30 s cap, one timer per channel, re-armed from `onclose` only when subscriptions remain: `:315-333` (stocks), `:411-425` (crypto), scheduler `:577-597`, `_maxReconnectDelay = 30000` at `:48` (VERIFIED).
- **Backoff reset on successful open**: `this._stockReconnectDelay = 2000; this._stockReconnectAttempts = 0;` — `:293-294` (VERIFIED).
- **Concurrent-connection awareness**: after 3 failed attempts it warns *"may be approaching EODHD concurrent connection limit (50 max)"* — `:324-330` (VERIFIED). That 50 is the same number as the plan's 50-ticker stream allowance in the brief.
- **Idle close with 5 s grace**, so a remount does not churn the socket: `_closingGraceMs = 5000` (`:53`), `_scheduleClose` via `:209-214` (VERIFIED).

### 3.4 The trade message it already parses

```js
// EODHD sends: { s: "AAPL", p: 185.42, ... } for stock trades
if (data.s && data.p !== undefined) {
  if (type === 'stock' && data.ms === 'extended-hours') { … return; }   // :464-470
  const symbol = fromWsSymbol(data.s); const price = parseFloat(data.p); // :476-477
  this._emit('price', { symbol, price });                                // :479
  this._priceCache.set(symbol, { price, timestamp: Date.now() });         // :482
```
`websocketService.js:451-482` (VERIFIED). It reads **`s` (symbol), `p` (price) and `ms` (market status)**. It does **not** read the trade size field, and it does **not** read the vendor's own trade timestamp — `_priceCache` stamps `Date.now()` at receipt (`:482`). A VWAP built from this stream would need the size field the parser currently discards.

It already maintains a session-scoped, ET-dated high/low/open per symbol, RTH-only for stocks: `_dailyHL`, reset on ET date rollover (`:486-491`), updated only when `type !== 'stock' || isMarketOpen()` (`:496-511`), read back with a same-ET-day check by `getDailyHL` (`:521-529`) — VERIFIED. That is two thirds of the candidate design's "session high/low" already written and tested.

### 3.5 Why it is inert, and since when

`b4ff276e`, **2026-08-01** — *"B1: stop /api/ws-config disclosing the EODHD credential to browsers"* (VERIFIED, 4 files, +303/−13).

Before it, `api/ws-config.js` returned:
```js
return res.status(200).json({
  stocksUrl: `wss://ws.eodhistoricaldata.com/ws/us?api_token=${API_KEY}`,
  cryptoUrl: `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${API_KEY}`,
});
```
(`git show b4ff276e^:api/ws-config.js`, VERIFIED). After it, the route returns a fixed `{ available: false, transport: 'rest' }` with `Cache-Control: no-store` (`api/ws-config.js:34-40`, VERIFIED), and states the invariant: *"no response, header, or field of this route may contain the EODHD credential or a vendor URL embedding it. The route reads no EODHD env var."* (`:15-16`).

The client treats that as **terminal, not transient**: `_transportDisabled = true` on `available:false` or any missing URL (`websocketService.js:134-138`); `_ensureStockConnection` returns immediately when disabled (`:250-254`); `_scheduleReconnect` returns immediately when disabled (`:578-579`) — VERIFIED. `probeTransport()` (`:158-166`) exists so callers switch to REST without waiting on a dead socket.

The same commit's comment names the successor shape and says it was deliberately not built: *"A server-side relay that would keep the credential server-side is a separate future task and is intentionally NOT built in this pass"* (`api/ws-config.js:11-13`, VERIFIED).

The CSP still allows the vendor origin — `connect-src … wss://ws.eodhistoricaldata.com` (`vercel.json:38`, VERIFIED) — so a browser-side revival would not need a header change; a **server**-side one would not need the CSP at all.

**Nothing server-side has ever opened a socket.** `grep` for `WebSocket` / `wss://` across `api/` returns zero non-test hits (VERIFIED). Every listener in the repo is browser code.

---

## 4. The VPS

### 4.1 The named document does not exist in this repo

`FORGE_AGENT_VPS_HANDOVER_MAY21_2026_v2.md` is **not present at HEAD**, is **not in any ref**, and **has never existed in this repository's history**. Three independent checks, all VERIFIED in this session:

- `find . -name '*VPS*'` (excluding `node_modules`) → no match.
- `git log --all --oneline --full-history -- '*FORGE_AGENT*' '*HANDOVER_MAY*'` → empty.
- A walk of `git ls-tree -r` over the 400 most recent reachable commits, grepping for `FORGE_AGENT_VPS` → no match.

The unshallowed history (4,056 commits) was searched. **The spec cannot be grounded on that document from this repo.**

### 4.2 What the repo does hold about the VPS

Four references, total — all VERIFIED:

| Anchor | What it says |
|---|---|
| `api/fantasytimes/ingest-deepdive.js:5-9` | *"Vera is the only FantasyTimes reporter whose content is NOT generated by a Vercel cron endpoint. Vera's full deepdive markdown + structured knowledge extraction records are produced externally by the Forge Research Agent (**Codex CLI on a Hostinger VPS**) and posted to this endpoint **manually** via `scripts/ingest-vera.js`."* |
| `api/_utils/fantasyTimesPrompts.js:578-583` | *"Vera is unique: her full deepdive content is generated externally by the Forge Research Agent (Codex on VPS), then ingested via `/api/fantasytimes/ingest-deepdive`."* |
| `docs/composition/ACTIVATION_PRECONDITIONS.md:41` | Names *"Firebase Console, **VPS scripts**, service accounts"* as **external admin write paths** that *"cannot be code-fenced; the runbook pauses them"*, and requires an inventory doc (`docs/composition/EXTERNAL_ADMIN_WRITE_PATHS.md` or equivalent) that **does not exist in the repo** (VERIFIED — no such file). |
| `docs/ARCHETYPE_CONTROL_CENSUS_REPORT_V1.md:16` | Puts *"the Forge VPS agent codebase"* explicitly **out of scope** of that census. |

### 4.3 What runs there, and how it reaches the platform

**What runs there:** a Codex CLI research agent producing long-form markdown + a JSONL extraction file (`ingest-deepdive.js:5-9`, VERIFIED). Nothing else is named anywhere in the repo.

**How it reaches Firestore: it does not.** It reaches an HTTPS endpoint, and *Vercel* writes Firestore:
- The transport is `scripts/ingest-vera.js`, a **manual** Node CLI: `node --env-file=.env.local scripts/ingest-vera.js --markdown <path> --records <path.jsonl> --topic-slug <slug> …` (`scripts/ingest-vera.js:7-17`, VERIFIED). It reads two local files and POSTs them (`:1-9`).
- **Auth is a bearer secret**, `VERA_INGEST_SECRET`, not a service account: *"Required env: `VERA_INGEST_SECRET`"* (`scripts/ingest-vera.js:16`) and *"Authenticates the caller via `VERA_INGEST_SECRET` (Bearer)"* (`api/fantasytimes/ingest-deepdive.js:12`) — VERIFIED.
- The Firestore write happens **inside the Vercel function**, in one atomic batch (`ingest-deepdive.js:17-21`, VERIFIED), under the same Firebase Admin service account every other API route uses (`getFirebaseAdmin`, `:32`).
- The only credential env vars anywhere in `api/`, `scripts/` and `src/` are `EODHD_API_KEY`, `CRON_SECRET`, `VERA_INGEST_SECRET`, `FIREBASE_{PROJECT_ID,CLIENT_EMAIL,PRIVATE_KEY}`, `FIREBASE_ADMIN_CREDENTIALS`, `FIREBASE_API_KEY`, `GCS_CREDENTIALS`, `GCS_CREDENTIALS_PATH` (VERIFIED, exhaustive `process.env.*` extraction). **There is no VPS-specific credential and no separate Firestore identity for it.**

**How it is supervised: nothing in the repo supervises it.** No systemd unit, no pm2 config, no `ecosystem.config.*`, no `*.service` file exists anywhere in the tree (VERIFIED, `find`). No deploy script, Dockerfile, or provisioning file targets a VPS (VERIFIED). The one operational statement about it — `ACTIVATION_PRECONDITIONS.md:41` — classes "VPS scripts" with the Firebase Console as a path that *"cannot be code-fenced"* and must be **paused out of band by a runbook**, which is how the repo describes something a human drives, not a supervised service.

**Is a second long-running process a config addition or a new deployment shape?**

**A new deployment shape — VERIFIED by absence, on four counts.** (1) There is no process supervisor of any kind in the repo, so there is nothing to add a unit to. (2) The only VPS→platform path is a human running a CLI with a bearer token; a persistent websocket consumer would need a *service* identity and *unattended* credentials, neither of which exists. (3) Every scheduled thing in this platform is a Vercel cron entry in `vercel.json` (`:43-200`); there is no non-Vercel scheduler. (4) `ACTIVATION_PRECONDITIONS.md:41` already treats the VPS as an **out-of-band, un-fenceable** write path requiring a manual pause step — a long-running writer there inherits that classification and the inventory-doc precondition that is currently unmet.

*Read-only: this session did not connect to the VPS, and holds no address for it.*

---

## 5. Vercel cron constraints

### 5.1 The 39 entries at HEAD

`vercel.json:43-200`, `crons` array — **39 entries across 38 distinct paths** (`/api/fantasytimes/ingest-earnings` appears twice). VERIFIED by counting the parsed array. This matches BUILD_RULES §6's "39/40 at HEAD" exactly, and `docs/audits/20260912_PHASE0_CRON_MAPPER.md:406` independently. All schedules are **UTC** (§6).

| # | Schedule (UTC) | Path | Runs/weekday |
|---|---|---|---|
| 1 | `*/15 9-23 * * 1-5` | `/api/lobbies/cleanup-expired` | 60 |
| 2 | `15 21 * * 1-5` | `/api/cron/snake-draft-daily-scores` | 1 |
| 3 | `*/10 * * * *` | `/api/cron/snake-draft-autopick` | 144 |
| 4 | `15 1 * * 2-6` | `/api/cron/baggerbomb-v4-daily-scores` | 1 |
| 5 | `30 1 * * 2-6` | `/api/cron/compute-daily-baggerbomb-levels` | 1 |
| 6 | `45 1 * * 2-6` | `/api/cron/agent-daily-scores` | 1 |
| 7 | `0 11 * * 1-5` | `/api/cron/compute-rankings` | 1 |
| 8 | `25 13,14 * * 1-5` | `/api/cron/process-draft-claims` | 2 (DST pair) |
| 9 | `0 1 * * 0` | `/api/cron/compute-briefs` | weekly |
| 10 | `0 10 * * 6` | `/api/cron/compute-estimates` | weekly |
| 11 | `30 13,14 * * 1-5` | `/api/fantasytimes/generate-pulse?period=pre_market` | 2 |
| 12 | `0 16,17 * * 1-5` | `…generate-pulse?period=midday` | 2 |
| 13 | `15 20,21 * * 1-5` | `…generate-pulse?period=post_close` | 2 |
| 14 | `0,30 13,…,21 * * 1-5` | `…generate-econ?mode=recap` | 18 |
| 15 | `0 1 * * 1` | `…generate-econ?mode=preview` | weekly |
| 16 | `0 5 * * 1-5` | `…submit-earnings-batch` | 1 |
| 17 | `0 13,20,21,22,23 * * 1-5` | `…generate-recap` | 5 |
| 18 | `*/15 * * * 1-5` | `…poll-batch` | 96 |
| 19 | `0 10,11 * * 1` | `…generate-column?type=preview` | weekly ×2 |
| 20 | `0 21,22 * * 5` | `…generate-column?type=wrap` | weekly ×2 |
| 21 | `0 7 * * 1,4` | `…cleanup` | 2/wk |
| 22 | `*/15 13,…,20 * * 1-5` | `…scan-movers` | 32 |
| 23 | `30 23 * * 1-5` | `…ingest-earnings` | 1 |
| 24 | `30 3 * * 2-6` | `…ingest-earnings` | 1 |
| 25 | `45 14,18,22 * * 1-5` | `…ingest-econ` | 3 |
| 26 | `0 8 * * 0` | `…ingest-cleanup` | weekly |
| 27 | `30 10,11 * * 1-5` | `/api/cron/compute-index-intelligence` | **2** (no ET guard — see §6.2) |
| 28 | `0 14,…,20 * * 1-5` | `…compute-index-intelligence?mode=intraday` | 7 |
| 29 | `*/15 13,…,21 * * 1-5` | `/api/cron/agent-evaluate` | **36** |
| 30 | `*/15 13,…,20 * * 1-5` | `/api/cron/voice-layer-cache` | 32 |
| 31 | `0 1,2 * * 1` | `…compute-institutional-intelligence` | weekly ×2 |
| 32 | `30 12 * * 1-5` | `…compute-daily-regime-brief` | 1 |
| 33 | `0 10,11 * * 1` | `…promote-discover-themes` | weekly ×2 |
| 34 | `*/10 11,12,13,14,21,22,23 * * 1-5` | `…tournament-orchestrator` | 42 |
| 35 | `*/10 * * * *` | `…live-draft-fire` | 144 |
| 36 | `*/15 14,…,22 * * 1-5` | `…mandate-evaluate` | **36** |
| 37 | `*/15 12,13 * * 1-5` | `…mandate-rollover` | 8 |
| 38 | `*/15 13,…,23,0 * * *` | `…process-pending-reflections` | 48 |
| 39 | `25 20,21 * * 1-5` | `…agent-batch-review` | 2 |

All VERIFIED from `vercel.json`.

### 5.2 The minimum interval the plan allows — **one minute, demonstrated in production**

There is **no recorded plan tier statement** in the repo. BUILD_RULES §6 says *"assumed Pro ceiling"*; `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md:139` says *"the assumed Pro ceiling of 40"*; `docs/KAI_TIMEOUT_FINDINGS_2026-04-30.md:96` says *"Vercel Pro allows up to 300 seconds"* — all VERIFIED, all ASSUMED as to tier.

**But the interval question does not need the tier, because the answer is in the repo's own history.** `git log -S` over `vercel.json` (VERIFIED):

- **`dff0ed96`, 2026-02-06** — *"fix: change autopick cron to run every 1 minute instead of 15 minutes"*, and the diff is exactly `/api/cron/snake-draft-autopick`: `"*/15 * * * *"` → **`"* * * * *"`**.
- It ran at one-minute cadence until **`68723eee`, 2026-03-17** — *"feat: firestore read optimization — cut estimated reads by 70%"* — which moved it to `*/5` and `/api/lobbies/cleanup-expired` from `*/5` to `*/15`. It later reached today's `*/10`.
- `*/5 * * * *` also shipped on `/api/earnings/verify-batch` and `/api/fantasytimes/poll-batch` (`68723eee`, `a719815a`).

The reduction was a **Firestore read-cost decision**, named as such in the commit subject — not a platform limit. **So a one-minute or five-minute poller can be a Vercel cron on this plan.** The binding constraint is §6's slot budget: **39 of an assumed 40 used, one slot left**, and BUILD_RULES §6 directs *"[p]refer branching inside existing handlers over new entries."*

Two further constraints the spec inherits from §6, both VERIFIED in-repo:
- **Crons do not run on Vercel preview** — verification is unit tests plus first-production-run observation.
- **`maxDuration` is 300 s on the heaviest handlers** (`agent-evaluate.js:146`, `compute-index-intelligence.js:75`, `mandate-evaluate.js:61`, `compute-briefs.js:23`), with `TIME_BUDGET_MS = 290_000` guards (`agent-evaluate.js:150`). A whole-universe poll must finish inside one invocation or carry its own budget guard.

---

## 6. EODHD call consumption today

**No EODHD call was made from this session.** Every number below is derived from code at HEAD, under the founder's measured **per-ticker** rule (2026-09-18: one request, fifteen tickers via `s=`, **15 API calls**).

### 6.1 The founder's measured response shape, recorded

Per ticker the delayed `/real-time/` endpoint returns exactly these eleven fields:

`code` · `timestamp` · `gmtoffset` · `open` · `high` · `low` · `close` · `volume` · `previousClose` · `change` · `change_p`

Per the brief: `open`/`high`/`low`/`volume` are **session-cumulative**; `close` is the delayed last price; `timestamp` is **per-ticker** and can differ within one response (fourteen names at `1789757520`, PANW at `1789757460` — one minute earlier).

What the repo does with those fields today (all VERIFIED):

| Field | Read at | Mapped to |
|---|---|---|
| `close` | `marketDataCache.js:750` | `price.current` (with `previousClose` fallback) |
| `previousClose` | `:751` | `price.previousClose` |
| `change`, `change_p` | `:752-753` | `price.change`, `price.changePercent` |
| `high`, `low`, `volume` | `:754-756` | `price.high`, `price.low`, `price.volume` — **carried, and read by nothing on the agent path** |
| `timestamp` | `:757` | `price.timestamp` — **carried; read by exactly three sites** (`canonicalOpen.js:79`, `mandateUniverseSnapshot.js:154`, and `researchCard.js:61` notes it as unused) |
| `open` | not mapped here | read separately by `tournamentPrices.fetchBatchQuotes` (`:78`) and `canonicalOpen.js` |

So the cumulative `volume` the candidate design needs is **already arriving on every quote today and being discarded** on the agent path.

### 6.2 The scheduled call sites, per cron

| Cron / route | Call site | Tickers per run | Runs/weekday | Calls/weekday |
|---|---|---|---|---|
| `compute-index-intelligence` (pre-market) | `fetchOHLCV` `:147` via `:759-765` and `fetchBatch(ALL_TICKERS, 10, 500)` `:891` → one GET per ticker `:201-205` | 5 index + 1 TNX + 11 sector ETF + **239** stocks = **256** `/eod/` | **2** — `30 10,11` has **no ET/DST guard**; the handler's only branch is `mode` (`:709`) and its header says *"Idempotent — running twice overwrites the same Firestore docs"* (`:10`) | **512** |
| `compute-index-intelligence?mode=intraday` | the same 256 `/eod/` **plus** `fetchRealtimeQuotes(rtSymbols)` `:744` → `/real-time/{first}?…&s=rest` in groups of 20 `:298-305` | 256 EOD + **255** real-time (5+11+239, `:738-742`) = **511** | 7 | **3,577** |
| `compute-rankings` | `fetchSingleFundamental` `:118` per ticker `:146-156`; `eod-bulk-last-day` `:1490`; 12 ETF `/eod/` `:1502` | 239 + 1 + 12 = **252** | 1 | **252** |
| `fantasytimes/scan-movers` | `fetchQuote` `:42`, concurrency 8, over `FANTASYTIMES_TICKERS` `:309` | **54** | 32 | **1,728** |
| `fantasytimes/generate-pulse` ×3 | `fetchBatchPrices` `:79` over `INDEX_SYMBOLS` (4) `:180` and `FANTASYTIMES_TICKERS` (54) `:187`; + 1 `/news` `:199` | 58 + 1 | 6 | **~354** |
| `fantasytimes/generate-econ?mode=recap` | `fetchRealTimePrice('SPY')`, `('QQQ')` `:335-336`; + `/economic-events` `:226` | 2 + 1 | 18 | **~54** |
| `fantasytimes/generate-recap` | `/calendar/earnings` `:147`; `fetchRealTimePrice(earning.symbol)` `:451` | 1 + E | 5 | **~55** (E≈10) |
| `fantasytimes/submit-earnings-batch` | `/calendar/earnings` `:53`; `/fundamentals/` per symbol `:65` | 1 + F | 1 | **~21** (F≈20) |
| `fantasytimes/ingest-earnings` ×2 | `/calendar/earnings` `:31` | 1 | 2 | **2** |
| `compute-daily-regime-brief` | `fetchEarningsCalendarEODHD()` `:115` → `:202` | 1 | 1 | **1** |
| `fantasytimes/generate-column` ×2 | `SECTOR_ETFS.slice(0,5).map(fetchRealTimePrice)` `:202` | 5 | weekly ×4 | ~20/wk |
| `compute-estimates` | `/calendar/trends` `:138`, `/calendar/earnings` `:176` (both `symbols=` batched) | batched | weekly | small |
| **Battle-count-independent subtotal** | | | | **≈ 6,530** |
| `agent-evaluate` | `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` per symbol of `allSymbols` `:721`; `fetchIntradayBatch(portfolioSymbols)` `:958`; three more conditional `getStockAnalysisData` sites `:1088`, `:1919`, `:3231` | **2 per symbol** (see below) × ~34 unique + 6 intraday ≈ **74 per battle** | 36 | **≈ 2,664 × B** |
| `voice-layer-cache` | `fetchBulkPrices(symbolArray)` `:897` → `:58`, batches of 20 `:33` | S = unique portfolio+watchlist+bench-stock symbols across **all** battles `:838-869` | 32 | **32 × S** |
| `agent-daily-scores` | `getStockAnalysisData(symbol, {forceRefresh:true, fields:['daily','price']})` `:257-260` | 2 per symbol | 1 | **2 × S** |
| `mandate-evaluate` | `ensureUniverseSnapshot` `:292`/`:672` → `fetchBatchQuotes` in chunks of `MANDATE_QUOTE_BATCH_SIZE` `mandateUniverseSnapshot.js:502-508`; `ensureDailySnapshot` `:289`/`:669` → 2 CA calls per symbol `:317-320` | ≤ **300** per tick (`MANDATE_UNIVERSE_MAX_SYMBOLS = 300`; candidate universe 136 + held) + ≤ 600 CA/day | ≤36 | **≤ 11,400** |
| `agent-batch-review` | `getStockAnalysisData(veto.symbolIn, { fields: ['price'] })` `:213` | per veto | 2 | small |
| `snake-draft-daily-scores` / `baggerbomb-v4-daily-scores` / `compute-daily-baggerbomb-levels` | `/real-time/{symbolList}` `:186` / `:106` / `:138` | per active book | 1 each | small |

All anchors VERIFIED. **Crons with no EODHD path at all** (VERIFIED by grep): `tournament-orchestrator`, `process-draft-claims`, `compute-institutional-intelligence`, `promote-discover-themes`, `live-draft-fire`, `snake-draft-autopick`, `process-pending-reflections`, `compute-briefs`, `lobbies/cleanup-expired`, `mandate-rollover`, `fantasytimes/{poll-batch,cleanup,ingest-cleanup,ingest-econ}`.

**Why `agent-evaluate` is 2 calls per symbol.** `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` (`agent-evaluate.js:721`): `forceRefresh` skips both the in-memory and Firestore cache reads (`marketDataCache.js:622-632`), so `'daily'` issues a live `/eod/` (`:639` → `:352-354`); `'price'` is not a cacheable field and **always** issues `/real-time/` (`:684-686` → `:742-745`). Per symbol, per battle, per tick: **one `/eod/` + one `/real-time/`**. Symbols shared across two battles are fetched twice — the loop is inside the per-battle function (`:718-732`), and `allSymbols` is per battle (`:710`).

The ~34 figure is the deduped union at `:710`: 6 held + ~4 bench + 15 hotBench (`candidates.slice(0, 15)` at `:1028`, plus equipped tickers unioned at `:1029-1046`) + up to 6 CPU + 3 macro (`:705`). **ASSUMED** as a typical value; the formula is exact.

### 6.3 On-demand (non-cron) routes

**100 EODHD URL-construction sites exist across `api/` and `scripts/`** (VERIFIED, exhaustive grep). Beyond the scheduled ones above, the rest are **user-driven request routes** whose daily spend is a function of traffic, not of a schedule: `api/stocks/{prices,historical,fundamentals,analysis,earnings,earnings-history,earnings-calendar,earnings-historical-range,eod-close,options-iv}`, `api/crypto/{prices,metrics}`, `api/earnings/{odds,sync-queue,migrate-dates,_helpers/getEarningsResult}`, `api/news/{stock,market}`, `api/research/fetchDriverSeries`, `api/volatility/thresholds`, `api/academy/pull-chart-data`, `api/week-ahead-earnings`, `api/options/resolve-tournament`, `api/health` (1 call per probe, `:25`), `api/admin/backfill-snake-draft-day`, `api/fantasytimes/test-ingestion`, plus `scripts/{fetch-ticker-industries,refresh-stock}.js` and `api/scripts/capture-*`. Two of these are notable for the budget: `api/stocks/historical.js` is the **only other `/intraday/` consumer** in the tree (`:210`, `:246`, `:333`), and `api/health.js` costs one ticker-call per health check.

**The spec should treat the 100,000/day budget as shared with an unmetered user-traffic tail, not as a cron-only budget.**

### 6.4 Headroom, and what cadence it supports

| Scenario | Calls/weekday |
|---|---|
| Fixed (battle-independent) | **≈ 6,530** |
| + `agent-evaluate` at B=1 / 3 / 5 / 10 battles (incl. voice-layer-cache + agent-daily-scores) | **9,540 / 15,540 / 21,550 / 36,570** |
| + `mandate-evaluate` at its 300-symbol cap | **+11,400** |
| **Worst plausible today (B=10, mandate at cap)** | **≈ 48,000** |
| **Headroom under 100,000** | **≈ 52,000 — and ≈ 63,000 with mandate dark** |

What that headroom buys, at the brief's cadences (RTH = 390 minutes = 78 five-minute slots):

| Poller | Arithmetic | Calls/day |
|---|---|---|
| 5-minute poll of the full 239-name universe | 78 × 239 | **18,642** |
| 1-minute poll of held names, H = 6 (one battle) | 390 × 6 | 2,340 |
| …H = 18 (three battles) | 390 × 18 | 7,020 |
| …H = 30 (five battles) | 390 × 30 | 11,700 |
| …H = 60 (ten battles) | 390 × 60 | **23,400** |

So: **the 5-minute universe poll fits comfortably** (18,642 against ~52,000–63,000 headroom). **The 5-minute poll plus a 1-minute held poll fits up to roughly five concurrent battles** (18,642 + 11,700 = 30,342). At **ten** battles the pair costs 42,042 and, added to a 36,570 baseline plus a live mandate path, **exceeds 100,000**. The binding term is not the universe poll — it is the product of (held names) × (390 minutes) × (battle count), plus whatever `mandate-evaluate` is spending.

### 6.5 Three shipped comments that budget in the wrong unit

Under the per-ticker rule these are wrong by 20–100×, and each is a design comment a spec could be misled by. All VERIFIED:

| Anchor | What it says | What it actually costs |
|---|---|---|
| `api/_utils/mandateConfig.js:110` | `MANDATE_QUOTE_BATCH_SIZE = 100; // 300-cap → ≤3 calls/tick` | **≤300 ticker-calls/tick** — 100× |
| `api/_utils/mandateUniverseSnapshot.js:463` | *"chunked batch fetch (**one chunk == one counted upstream call**)"*; the counter it feeds is `upstreamCalls = groups.length` (`:508`) and is persisted by `bumpUpstreamCounter` (`:448`) | the persisted upstream counter **under-reports by the chunk size** |
| `api/cron/compute-index-intelligence.js:291-295` | *"Uses the multi-symbol real-time endpoint … to **collapse the ~255-symbol universe into a handful of calls**"* | **255 ticker-calls**, not a handful — 20× |
| `api/cron/voice-layer-cache.js:39-43` | section header `EODHD BULK PRICE FETCH` / `fetchBulkPrices` | **one call per symbol** in the list |

---

## 7. The scoring price source

### 7.1 Where `lastTickPrice` comes from

The chain, every link VERIFIED:

1. `const prices = {}` … `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` → `prices[symbol] = data.price` — `api/cron/agent-evaluate.js:713`, `:721-723`.
2. `data.price` is built by `fetchRealTimePrice` from `` `${API_BASE}/real-time/${eohdSymbol}?api_token=…&fmt=json` `` — `api/_utils/marketDataCache.js:742-758`, URL at `:744`.
3. `current: data.close || data.previousClose || 0` — `marketDataCache.js:750`.
4. `const currentPrice = prices[score.symbol]?.current` — `api/cron/agent-evaluate.js:1346`.
5. `updateStagnationCounter({ currentPrice, … })` returns `{ …, lastTickPrice: currentPrice, lastTickTimestamp: now }` — `api/_utils/agentRiskManager.js:242`, `:257`.
6. `lastTickPrice[score.symbol] = stag.lastTickPrice` — `api/cron/agent-evaluate.js:1374`.
7. `update['cronState.lastTickPrice'] = lastTickPrice` — `api/_utils/agentCronState.js:43`.

**So `lastTickPrice` is the delayed `/real-time/` `close`** — the same endpoint, and the same 15–20-minute delay, as the founder's diagnostic sample. It is the sole price feed on the agent path: the same `prices[sym].current` also drives scoring, the bust/ATR ladder (`agentRiskManager.js:120-133`), the CSV's `$Current`, and the `evidence[sym].px` stamp (`tickStamps.js:193`).

The one fallback is EOD: on a `/real-time/` failure the object becomes `{ current: result.daily[0].close, fallback: true }` (`marketDataCache.js:766-772`), and the M1 settlement guard refuses a tick whose held quotes carry `fallback: true` (`api/_utils/agentQuoteHealth.js:23-29`, called at `agent-evaluate.js:744-752`).

### 7.2 What this means for the spec's honesty question

**A delayed VWAP would be compared against a delayed price — same vintage, same endpoint, same lag.** That is the useful half of the answer: the `vwapDeviation` comparison is not cross-vintage today and would not become so, because `calculateVWAP` derives `currentPrice` from the **last 5-minute candle's close** (`technicalCalculations.js:394`), not from the quote (`agentRiskManager.js` never compares the two). The `TRAIL_STOP` arm, by contrast, **does** cross the streams: `currentPrice < intradaySnapshot.sma20_5m` (`agentRiskManager.js:165`) compares the **quote's** delayed close against an **intraday-candle-derived** SMA. Today both sides are delayed by a similar amount; a websocket-derived (live) SMA against a delayed quote would make that one comparison cross-vintage, and vice versa.

### 7.3 The freshness the platform already has — and throws away here

- **`fetchRealTimePrice` captures the vendor's own `timestamp`** into `price.timestamp` (`marketDataCache.js:757`, VERIFIED).
- **The agent path never reads it.** `updateStagnationCounter` stamps `lastTickTimestamp: now` where `now = nowMs = Date.now()` (`agentRiskManager.js:257`; `agent-evaluate.js:1281`, `:1368`) — VERIFIED. So the D2 tick-age guard (`maxTickAgeMinutes`, default 20, `agent-evaluate.js:1370`) measures **wall-clock time since the cron last ran**, not **feed age**. A feed frozen for an hour advances `lastTickTimestamp` every 15 minutes exactly as a live one does.
- **The mandate path does read it, and gates on it.** `priceAsOf` is set from `q.timestamp` when present, falling back to the fetch instant only when the feed omits it — with the reason stated: *"an hours-old last trade then reads as stale in `classifyHeldFreshness`"* (`mandateUniverseSnapshot.js:150-155`, VERIFIED). `classifyHeldFreshness` then marks a held symbol **actionable** only when `nowMs − priceAsOf ≤ maxAgeMs` (`:575-590`), with `MANDATE_MARK_MAX_AGE_MS = 20 * 60 * 1000` — **20 minutes** (`mandateConfig.js:97`, VERIFIED) — and freezes it per symbol otherwise, never whole-book (`:569-571`). Each entry also carries `source: 'eodhd_realtime'` (`:161`, const at `:55`).

**That is the in-repo precedent for everything §1's gate lacks**: a per-symbol `priceAsOf` taken from the vendor's own clock, a named `source`, an explicit max-age, and a per-symbol freeze rather than a global one. It was built for the mandate books and has never been applied to the agent path.

---

## 8. The Why? panel's vintage line, and the `vintages` map

### 8.1 Where the line is assembled

`provenanceLine(vintages, timeText, checkIso)` — **`src/data/decisionRecord.js:1069-1098`** (VERIFIED). It builds up to three parts and joins them with `' · '` (`:1098`):

| Part | Line | Source field | Format |
|---|---|---|---|
| `Fundamentals block as of {Mon D}` | `:1086-1092` | `vintages.fundAsOf` | UTC calendar date, formatted in **UTC** deliberately (`:1063-1064`: an ET formatter would render Sep 8 as Sep 7) |
| `Latest held technical stamp · {time}` | `:1094-1095` | `vintages.techAt` | ET instant, via the caller's own formatter |
| `Rankings as of {time}` | `:1096-1097` | `vintages.rankingsAt` | ET instant, same formatter |

The `stamp()` helper (`:1077-1084`) prefixes a short date when the instant falls on a **different ET day** from the check — the A-3 fix for a stale overnight rankings doc reading as "7:00 AM today".

**Client wiring** (all VERIFIED):
- `battleViewCopy.js:606` — `evidenceProvenance: (vintages, checkIso = null) => provenanceLine(vintages, etTime, checkIso)` binds the ET formatter.
- `WhyPanel.jsx:228-230` — `COPY.evidenceProvenance(evidence.vintages, state.checkedAt)`, rendered **only when `evidence && evidenceFacts.length`**.
- `selectEvidence.js:54` — lifts `evaluation.vintages` off the entry, all-or-nothing with `evidence` (`:26`).
- The server narrator uses the **same** function: `voiceLayerGrounding.js:223`.

The line's own contract is stated at `decisionRecord.js:1051-1061`: *"PROVENANCE DETAIL, never a freshness promise (Sol M-2)"*, and *"'Technical data as of 10:30', 'Technicals updated 10:30' and 'Data current at 10:30' all overclaim; the honest phrasing names the field for what it is."*

**Where a VWAP line would attach:** one more `parts.push(...)` in `provenanceLine` between `:1095` and `:1097` (the tech and rankings parts), reading a new field off the same `vintages` object. It needs no new plumbing — `selectEvidence` already lifts the whole block, `WhyPanel` already renders whatever the function returns, and the narrator gets it for free. **The blocker is upstream: the field it would read does not exist as a value** (§8.2).

### 8.2 The `vintages` map — what writes it, and what values it can take

`composeVintages({ heldSymbols, benchAssets, rankingsMap, techScoresMap, rankingsComputedAtMs })` — **`api/_utils/tickStamps.js:244-265`** (VERIFIED). One block **per evaluation entry**, never per field (`:36`, `:217`). It is the only writer; called once at `:339-345` from `composeTickStamps`, itself gated on `promptBuilt === true` (`:334`).

```js
return {
  quote: 'tick',
  vwap: 'tick',
  techAt: techMs == null ? null : new Date(techMs).toISOString(),
  fundAsOf: fundMs == null ? null : new Date(fundMs).toISOString().slice(0, 10),
  rankingsAt: rankMs == null ? null : new Date(rankMs).toISOString(),
};
```
`tickStamps.js:258-264` (VERIFIED).

| Key | What writes it | Values it can take at HEAD |
|---|---|---|
| `quote` | **hard-coded string literal** `:259` | **`'tick'` only** |
| `vwap` | **hard-coded string literal** `:260` | **`'tick'` only** |
| `techAt` | `newestMs(held.map(sym => techScoresMap[sym]?.updatedAt))` `:255` | ISO instant, or `null` |
| `fundAsOf` | `newestMs(fundSymbols.map(sym => rankingsMap[sym]?.fundamentals?.computedAt))` `:256` | `YYYY-MM-DD`, or `null` |
| `rankingsAt` | `toMs(rankingsComputedAtMs)` `:257` | ISO instant, or `null` |

**Three findings the spec needs:**

1. **`vintages.vwap` is a constant, not a computed value.** It is the literal `'tick'` on every entry of every battle, unconditionally. It does not vary with the gate's outcome, the session date, or whether `momentumData.vwap` was empty — `composeVintages` never inspects the VWAP map at all. The header calls `quote` and `vwap` *"[t]wo cadence words that are **true by construction** (the quote and the VWAP are fetched and computed this tick)"* (`:217-219`, VERIFIED) — which was true when written and is exactly what a delayed feed breaks.
2. **Nothing renders it.** `provenanceLine` reads only `fundAsOf`, `techAt` and `rankingsAt` (`:1086`, `:1094`, `:1096`). Neither `quote` nor `vwap` appears in any renderer (VERIFIED by grep across `src/` and `api/`). The value is written to every evaluation entry in Firestore and read by nobody.
3. **The block is per-entry, not per-symbol.** `techAt` is *"the NEWEST `updatedAt` among the HELD technical documents"* and its doc comment warns it *"does NOT prove every held symbol's technical context carries that stamp"* (`decisionRecord.js:1055-1057`). A per-ticker VWAP delay — which the founder's sample shows varies **within one response** (PANW a minute behind the other fourteen) — has **no per-symbol home in this structure**. The per-symbol home that does exist is `evidence[sym]`, which today carries eight value fields and no vintage field (`tickStamps.js:192-201`).

### 8.3 The two in-repo precedents for labelling an intraday value

Both VERIFIED, both on the narrator side, neither on the decider's:

- **A session label on the value itself.** `buildIntradayLine(brief, now)` prefixes every rendered intraday sentence with `Today's session` or `Prior session`, chosen by `intraday.sessionDate === toEtParts(now).dateStr` (`api/_utils/voiceLayerPrompt.js:1416-1422`, VERIFIED). It renders `…% above/below session VWAP` and `…% above/below 5m SMA20` (`:1426-1446`) and returns `null` when it has neither (`:1448`). **The `Prior session` branch is unreachable at HEAD**: its input is `brief.intraday = intradayMomentumMap[symbol]` (`api/cron/voice-layer-cache.js:406`), read from `battle.cronState.intradayMomentum` (`:929`) — which §1's gate only ever populates with today-dated entries. `voice-layer-cache` does not fetch intraday itself (VERIFIED: no `fetchIntradayBatch` call in the file; its comment at `:396-405` says the data is *"[s]ourced from agent-evaluate cron"*).
- **A prompt rule that states an absence.** `CACHE-COLD RULE (CRITICAL): You do not have intraday market data at this moment. Do NOT cite VWAP, moving averages…, RSI, MACD, support/resistance levels…` — `voiceLayerPrompt.js:3375-3379` (VERIFIED), with a worked NOT-THIS example at `:3381-3383`. This is the only place in the codebase where a prompt tells a model a signal is missing.

**Anchor correction.** The Sep 15 audit cited `voiceLayerPrompt.js:1888` for a `DATA_CONFIDENCE_RULE` reading *"typically today during market hours, or the prior session when EODHD's data hasn't refreshed"*. **At this HEAD that text no longer exists.** `DATA_CONFIDENCE_RULE` is at `:2015-2016` and now reads: *"Intraday signals (session VWAP, 5-min SMA20) describe **the session named on the line** — a line marked 'Prior session' is yesterday's, not today's."* (VERIFIED). The rule now defers to `buildIntradayLine`'s own label rather than describing the lag — which means the narrator's guidance is bound to a label whose "prior session" value the gate makes unreachable.

---

## 9. Fence contact (BUILD_RULES §1)

The fence list, verbatim from `docs/BUILD_RULES.md:14-26`: `api/agent/decide.js`, `api/_utils/agentSwapExecution.js`, `api/_utils/agentScoring.js`, `api/_utils/agentRiskManager.js`, `api/_utils/agentArchetypeConfig.js`, `api/_utils/agentBattleService.js`, `api/_utils/agentPromptAssembly.js`, `api/_utils/agentEvalPromptAssembly.js`, `api/_utils/agentGuardrails.js`, `api/_utils/archetypeScoring.js`, `api/_utils/tournamentUserScoring.js`. The **scoring engine** and the **`createAgentBattle` document shape** are fenced *as concepts*, so a behaviour change reached from a non-fenced call site is fence contact too.

### 9.1 Every file named in this report

| INSIDE the fence (read-only here) | OUTSIDE the fence |
|---|---|
| `api/_utils/agentEvalPromptAssembly.js` — §2 rows 1–6, R1–R4, R6, the CSV and bench builders | `api/cron/agent-evaluate.js` — §1, §2, §6 |
| `api/_utils/agentPromptAssembly.js` — the draft-side twin of rows 4–5 (`:125`, `:407`) | `api/_utils/agentVwapFloor.js` — §1 (the gate) |
| `api/_utils/agentRiskManager.js` — `vwap_failure` `:140-146`, `TRAIL_STOP` `:165-170`, `updateStagnationCounter` `:232-257` | `api/_utils/marketDataCache.js` — §1, §6, §7 (the fetch) |
| `api/_utils/agentArchetypeConfig.js` — `favoredStrategies: ['vwap_mean_reversion']` (no reader on the eval path) | `api/_utils/technicalCalculations.js` — `calculateVWAP` |
| `api/_utils/agentBattleService.js` — `createAgentBattle` portfolio/watchlist shape | `api/_utils/agentCronState.js` — the cronState writer |
| `api/agent/decide.js` — read; **zero VWAP/RVOL references** | `api/_utils/anticipationThresholdLint.js` — §2.3 |
| `api/_utils/agentScoring.js` — badge detection off intraday extremes `:272` | `api/_utils/agentTriggerGate.js` — row 10 |
| | `api/_utils/agentEvalToolSchema.js` — rows 7–8, R5 |
| | `api/_utils/tickStamps.js` — `vintages` + `evidence` writers |
| | `api/_utils/agentPresetConfig.js` — dead bands, fire thresholds |
| | `api/_utils/agentQuoteHealth.js` — the M1 quote guard |
| | `api/_utils/tournamentPrices.js` — `fetchBatchQuotes` |
| | `api/_utils/mandateUniverseSnapshot.js`, `mandateConfig.js` — the freshness precedent (§7.3) |
| | `api/_utils/buildTechnicalSnapshot.js`, `voiceLayerPrompt.js`, `voiceLayerGrounding.js` |
| | `api/cron/{compute-index-intelligence,compute-rankings,voice-layer-cache,mandate-evaluate,agent-daily-scores,agent-batch-review}.js` and every `api/fantasytimes/*` |
| | `api/ws-config.js`, `src/services/websocketService.js`, `src/services/wsCacheBridge.js`, `src/hooks/useWebSocketPrices.js` |
| | `src/data/decisionRecord.js`, `src/screens/battleView/{WhyPanel.jsx,selectEvidence.js,battleViewCopy.js}` |
| | `src/config/featureFlags.js`, `src/data/forgeKnowledgeBase.js`, `api/_utils/rankingConfig.js`, `vercel.json` |

### 9.2 The candidate design's likely write sites, marked

| Write site | File | Fence |
|---|---|---|
| **The intraday fetch** (a new delayed-quote poller, or changes to `fetchIntradayCandles` / `fetchIntradayBatch`) | `api/_utils/marketDataCache.js:792-913`; a new module beside it | **OUTSIDE** |
| **The gate** (adding a freshness term to `isVwapSessionUsable`, or a `delayed` publish branch) | `api/_utils/agentVwapFloor.js:36-38`; call site `api/cron/agent-evaluate.js:989-991` | **OUTSIDE** |
| **`buildPresentSignals`** (a third state, a value type, or a new signal name) | `api/_utils/anticipationThresholdLint.js:240-297`, `:31-67`, `:117-131` | **OUTSIDE** |
| **The `vintages` writer** (a real value for `vwap`, or a per-symbol vintage on `evidence`) | `api/_utils/tickStamps.js:244-265`, `:184-204`; renderer `src/data/decisionRecord.js:1069-1098` | **OUTSIDE** |
| **The prompt sites** (a "signals not provided / delayed this tick" line; any qualifier on rows 1–5 or R1–R4) | `api/_utils/agentEvalPromptAssembly.js:392-397, :456, :596-601, :659, :328, :334, :949, :416, :430, :620, :634, :1196-1201` | **INSIDE — §7-gated, founder-reviewed** |
| *(consequential)* the risk manager, if a `delayed` reading must arm or disarm differently | `api/_utils/agentRiskManager.js:140-146`, `:165-170` | **INSIDE** |

**Four §1 riders that bind any build following this report** (all VERIFIED in `docs/BUILD_RULES.md`):
1. **The DR-13 flag-split** is the sanctioned way to add prompt content with a minimal fence diff — and any module rendering prompt text through it **must** be added to `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js`) **in the same commit as the fenced splice**; the import-classification tripwire in `agentEvalPromptAssembly.honesty.test.js` fails CI otherwise.
2. **The C-20 honesty pin** at `agentEvalPromptAssembly.honesty.test.js:74-78` requires the literal `VWAP` in every eval system prompt; a retirement moves it in the same commit.
3. **§2's flag-flip rule**: flipping `ANTICIPATION_THRESHOLD_LINT_MODE` (`featureFlags.js:2563`) reconciles its pin in `src/config/anticipationThresholdLintFlags.test.js` in the same commit; `flagPinGuard` cannot hold a string tri-state (`featureFlags.js:2550-2557`).
4. **§6's cron budget**: 39/40 used, one slot left, *"[p]refer branching inside existing handlers over new entries."*

---

## Facts that constrain the spec

1. **The gate checks the session DATE only, never freshness.** `sessionDate === todayET && sessionCandleCount >= 3` (`agentVwapFloor.js:36-38`); `filterToLatestSession`'s `now` parameter is carried, documented as reserved for "future freshness gating", and `eslint-disable`d as unused (`marketDataCache.js:1032-1034, :1040`). **A feed that publishes three today-dated bars at 09:35 and then stalls passes the gate all day.**
2. **A one-minute or five-minute poller CAN be a Vercel cron on this plan** — `* * * * *` shipped in production from `dff0ed96` (Feb 6 2026) to `68723eee` (Mar 17 2026), and was reduced for **Firestore read cost**, not a platform limit. The binding constraint is the slot count: **39/40 used, one left** (BUILD_RULES §6, verified against `vercel.json`).
3. **Existing crons spend ≈ 6,530 EODHD calls/weekday independent of battle count, plus ≈ 2,664 per active agent battle and up to 11,400 for `mandate-evaluate`** — worst plausible today ≈ 48,000, leaving **≈ 52,000** under 100,000. The 5-minute universe poll costs **18,642/day** and fits; adding a 1-minute held poll fits to about **five concurrent battles** (30,342 combined) and breaks the budget at ten.
4. **Three shipped comments budget in requests, not tickers, and are wrong by 20–100×** — `MANDATE_QUOTE_BATCH_SIZE`'s `"≤3 calls/tick"` (`mandateConfig.js:110`), `fetchRealtimeQuotes`'s *"collapse the ~255-symbol universe into a handful of calls"* (`compute-index-intelligence.js:293-295`), and the persisted `upstreamCalls = groups.length` counter (`mandateUniverseSnapshot.js:463, :508`). **The mandate path's own upstream telemetry under-reports by its chunk size.**
5. **`agent-evaluate` spends two EODHD calls per symbol per battle per tick** — `forceRefresh: true` bypasses both cache layers, so `fields: ['daily','price']` issues one `/eod/` **and** one `/real-time/` (`agent-evaluate.js:721`; `marketDataCache.js:622-632, :639, :684-686`). Symbols shared between battles are fetched once per battle.
6. **`compute-index-intelligence` runs its pre-market pipeline TWICE a day** — `30 10,11 * * 1-5` has no ET/DST guard and the handler's only branch is `mode` (`:709-710`), so both UTC hours execute the full 256-ticker pipeline. That is 256 calls/day of pure duplication.
7. **`buildPresentSignals` returns `Map<string, Set<string>>` and its only operation is `Set.has`** (`anticipationThresholdLint.js:240-297`, `:362-363`). It **cannot express a third state, a delay, an as-of instant, or a source** without a change to the value type or the name vocabulary, and `lintThreshold`'s verdict has no caveat field (`:357-364`).
8. **VWAP is held-only; RVOL is bench-only.** `fetchIntradayBatch(portfolioSymbols, …)` (`agent-evaluate.js:958`); `renderBenchVolumeLine` is reached only from the bench loop (`agentEvalPromptAssembly.js:1543-1563`), and the held CSV has no volume column (`:1465-1466`). The prompt names **RVOL > 1.2x** unconditionally in both system-prompt variants (`:416`, `:620`, `:430`, `:634`).
9. **`vintages.vwap` is the hard-coded literal `'tick'`, and nothing renders it** (`tickStamps.js:260`; `provenanceLine` reads only `fundAsOf`/`techAt`/`rankingsAt`, `decisionRecord.js:1086-1097`). The block is **one per evaluation entry, not per symbol** — so a per-ticker delay, which the founder's own sample shows varying within one response, has no home there. The per-symbol home that exists is `evidence[sym]` (`tickStamps.js:192-201`), which carries no vintage field.
10. **The platform already has a delayed-feed freshness model — on the mandate path only.** `priceAsOf` from the vendor's `timestamp` with a documented fetch-instant fallback, a `source: 'eodhd_realtime'` tag, and a **20-minute** per-symbol max age that freezes one ticker without suppressing the book (`mandateUniverseSnapshot.js:150-155, :161, :575-590`; `mandateConfig.js:97`). On the agent path the same `timestamp` is fetched (`marketDataCache.js:757`) and then discarded: `lastTickTimestamp` is `Date.now()` (`agentRiskManager.js:257`), so the tick-age guard measures cron wall-clock, not feed age.
11. **The websocket listener already exists, is imported from `App.jsx` and seven other modules, and already has reconnect-with-backoff plus resubscribe-all-on-open** (`websocketService.js:298-302, :315-333, :577-597`). It parses `{s, p, ms}` and **discards trade size** (`:451-482`). It is browser-side only, inert since `b4ff276e` (Aug 1 2026) because `/api/ws-config` returns `{available:false}` permanently — **by a credential-disclosure containment whose own comment says a server-side relay "is intentionally NOT built in this pass"** (`api/ws-config.js:11-13`).
12. **The VPS handover document is not in this repo and never has been** (HEAD, all refs, full 4,056-commit history). The only VPS traces describe a **manual** markdown paste authenticated by a bearer secret, writing Firestore **through a Vercel function**, with no supervisor, no service identity, and an explicit classification as an un-fenceable out-of-band write path (`ingest-deepdive.js:5-12`; `scripts/ingest-vera.js:7-16`; `ACTIVATION_PRECONDITIONS.md:41`). **A second long-running process there is a new deployment shape, not a config addition.**
13. **The delayed endpoint already delivers the cumulative session `volume`, `open`, `high` and `low` this design wants, and the agent path throws them away** (`marketDataCache.js:754-756`, read by nothing on that path). `momentumData` has no volume key of any kind, so RVOL-from-live-session-volume is a **new key**, not a null being filled.
