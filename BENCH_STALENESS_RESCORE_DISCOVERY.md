# Bench-Staleness Rescore — Phase 0 Discovery & Integration Mapping

| | |
|---|---|
| **Status** | Discovery complete (read-only Phase 0). Surfaces options; **chooses none**. |
| **Date** | 2026-05-30 |
| **Branch** | `claude/bench-staleness-rescore` (cut from V1.4 keystone HEAD = current `origin/main` `102efa2`) |
| **Type** | READ-ONLY context & integration mapping. **No production code modified.** Only this report is committed. |
| **Workstream** | Bench-staleness **Outcome C** → rescore design. This is the Phase-0 context map that the design phase consumes. |
| **Inputs synthesized** | `BENCH_STALENESS_VERIFICATION_REPORT.md`, `CALIBRATION_DATA_DISCOVERY_REPORT.md` (PR #441), `MB04_BASELINE_NORMALIZATION_VERIFICATION_REPORT.md` (PR #444), `FORGE_RULES_THESIS_V1_2.md`, V1.4 keystone docs |

---

## ⚠️ Method, confidence labels & corrections (read first)

This session ran in a remote container whose **tool-result channel was severely degraded** — results were delivered in large, delayed batches and many calls returned empty/phantom interim content. One large batch did flush cleanly, yielding verified real content for: the three source reports in full, a code-mapping sub-agent's output, and direct `grep` anchors. Each claim below is therefore labeled:

- **`[direct]`** — verified from real tool output this session (a source-report read, or a real `grep` line).
- **`[map]`** — re-derived by the code-mapping sub-agent and cross-checked against the source reports' anchors; high confidence but a full direct re-read this session was prevented by the channel.
- **`[confirm]`** — a specific item the design phase should re-read first thing (called out inline).

**Path correction (important).** The three prior reports cite anchors like `api/agent/agent-evaluate.js`, `api/agent/agentRiskManager.js`, `api/agent/agentTriggerGate.js`, `api/lib/indexIntelligence.js`. **Those paths do not exist on current HEAD.** `[direct]` The real paths are:

| Concept | Real current path |
|---|---|
| Rankings producer cron | `api/cron/compute-index-intelligence.js` |
| Per-tick agent loop | `api/cron/agent-evaluate.js` |
| Hurdle floor + canonical margin | `api/_utils/agentRiskManager.js` |
| Wake-up trigger gate | `api/_utils/agentTriggerGate.js` |
| Technical scoring | `api/_utils/indexIntelligence.js` |
| baggerBombFit composite | `api/_utils/gameModeScoring.js` + `src/data/rankingConfig.js` |

All line anchors below are re-derived against current HEAD; treat the prior reports' anchors as pre-merge references.

**Branch discipline.** After `git fetch origin main`, `origin/main` = `102efa2` ("Merge PR #449 … forge-enforcement-keystone-implementation"), i.e. **the V1.4 keystone IS merged to main**; `claude/bench-staleness-rescore` was cut from that HEAD. `[direct]` (The generic task template named a different working branch; the task body's explicit instruction — "create and switch to `claude/bench-staleness-rescore`" — was followed.)

**Update (post-write, second flush).** A second batch of real tool output landed after the first draft was committed, delivering **direct reads** of `agentTriggerGate.js:1-291`, `keystoneGate8.test.js:1-235`, `agentRiskManager.js:255-345`, the `compute-index-intelligence.js` write block, `vercel.json` crons, and the V1.4 spec header/§0. This **resolved every `[confirm]` flag, upgraded most `[map]` items to `[direct]`, and overturned D5** (a real V1.2 "Swap Evaluation Pipeline Refresh" spec *does* exist — it is named and decomposed in the V1.4 spec header; see the revised §6/D5). Confidence labels below have been updated in place; the appendix reflects the upgrades.

---

## 1. Staleness mechanism

**Outcome: C — real gap** (≥20% behavioral change **and** large staleness window). Reopened the launch-blocker chain. `[direct]`

### 1.1 How/when `stockRankings` is computed
- **Producer:** `api/cron/compute-index-intelligence.js` writes the doc the agent actually reads — `indexIntelligence/stockRankings` → `batch.set(rankingsRef, { stocks, totalTechStocks, sectors, updatedAt: FieldValue.serverTimestamp() })` (~`:850-856`). `[direct]`
- **Cadence:** once per weekday, **pre-market** — cron `"30 10,11 * * 1-5"` (10:30 **and** 11:30 UTC), `vercel.json:133-136`. The 11:30 run overwrites the 10:30 run (authoritative). **No intraday refresh; the doc is immutable for the whole ~6.5 h session.** `[direct: report]`
- **Source freshness:** 100% end-of-day. The price-derived dimensions come from EODHD **daily** OHLCV; fundamentals are mirrored from `peerRankings` (written by `compute-rankings.js` at `"0 11 * * 1-5"`). The freshest the rankings can ever be is the **prior session's close**. `[direct: report §3.4]`
- **Scope:** full equity `STOCK_UNIVERSE` (~239 names / 11 sectors). `[direct: report §1]`

### 1.2 `baggerBombFit` composition (~90% price-derived)
- Computed by `computeGameModeFits` (`api/_utils/gameModeScoring.js:~91`); baggerBomb weight profile in `src/data/rankingConfig.js:~821`: **fundamental 0.10 / technical 0.70 / momentum 0.20 / atrModifier +0.20 → ~90% price-derived.** All inputs are daily-bar-derived; **no intraday term.** `[map; report rankingConfig.js:821 / gameModeScoring.js:91]`

### 1.3 hotBench clustering & the 4.7-pt margin
- hotBench = top-15 by **stored** `baggerBombFit`, built by **sorting the stored values — no recompute**: `const candidates = stockRankingsArray.filter(…not in portfolio/bench…).sort((a,b)=>(b.baggerBombFit||0)-(a.baggerBombFit||0)); let newHotBench = candidates.slice(0,15)…` (`agent-evaluate.js`, in the watchlist-refresh block ~`:430-450`). `[direct]`
- **Refinement the direct read surfaced (design-phase input):** that rebuild is gated by **`if (isNewTradingDay && battle.watchlist)`** (`isNewTradingDay = currentDay > lastEvalDay`) — i.e. it is a **once-per-trading-day "lightweight, rankings-based" watchlist refresh, not a per-tick rebuild.** `[direct]` This makes intra-day staleness *worse* than "rebuilt each tick": within a day the candidate menu is fixed at the morning ranking AND only re-derived from the (already stale) pre-market `stockRankings`. The bench report's §4 "rebuilt by sorting stored values — no recompute" is still correct on the load-bearing point (stored values, no rescore); this just adds *when*.
- The "**4.7-pt #1↔#2 margin**" is the bench report's **measured mean margin in its simulation harness**, not a code threshold — narrow enough that small intraday perturbations reorder the top, changing **which** symbol to swap to, not merely whether. `[direct: report §5.2]`

### 1.4 Behavioral finding — maps to the **final swap/no-swap** decision
- Metric = P(the **selected** swap candidate changes) when the bench is rescored stale→fresh, measured at the agent's real selection path (top `baggerBombFit` over hotBench∪bench, with `validateTradeDecision` confining swaps to hotBench∪bench). It therefore maps to the final action (hold↔swap **and** swap-to-X↔swap-to-Y), not an intermediate score. `[direct: report §5.1/§5.4]`
- **Drift grid** (estimated — the live SPY pull was blocked): **±2% → 31.1% | ±5% → 43.3% | ±15% → 58.9% | ±30% → 64.4%.** Stays **≥20% even conditioned on a comfortable ≥5-pt stale margin** at ±5% (23.9%). Headline **43.3% @ ±5%**. `[direct: report §5.2]`
- *Report's own caveat:* the rate is modeled through real production ranking code on **synthetic/estimated** drift, not a live A/B; direction and the ≥20% result are robust across the whole plausible range.

### 1.5 THE KEY ENABLER (re-derived)
- The agent **already fetches intraday 5-min bars every tick — but only for HELD positions — and never feeds them into rankings.**
- Current anchor (direct read): `api/cron/agent-evaluate.js` runs `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` inside a `Promise.allSettled` alongside the `stockRankings.get()` (~`:394-403`); the result `intradayMap` is processed **only `for (const symbol of portfolioSymbols)`** → `filterToLatestSession` → `calculateVWAP` + `calculate5minSMA20` → `momentumData.vwap[symbol]` (~`:411-429`), used for VWAP-deviation triggers and trail-stop exits. **The bench/hotBench symbols are deliberately excluded from the intraday fetch, and nothing writes intraday data back to `stockRankings`.** `[direct]`
- **Implication:** a rescore is a **wiring** problem (route the already-fetched bars — extended to bench/hotBench symbols — into the price-derived ~90% of `baggerBombFit`), **not** a data-acquisition problem.

### 1.6 Mechanism options the bench report *itself* sketched (non-prescriptive)
1. **Tick-rate-aware refresh** — recompute (or partially recompute) `stockRankings` nearer the 15-min tick.
2. **Staleness-weighted hurdle** — fold the rankings' age into the swap hurdle (ties to mb-12 "use it or lose it").
3. **Demand-driven bench rescore** — rescore only the hotBench∪bench candidate set at decision time, not the full ~239 universe. *(Report flags #3 as the natural low-cost form given the enabler.)*

---

## 2. Calibration-data picture, incl. decoded "Outcome C1 + Option α"

### 2.1 DECODE — "Outcome C1 + Option α" (the single most important unknown)
The calibration report's outcome space was about whether calibration data can be **sourced without first building "Stream D"** (the future production ranking/sector-schema layer).

- **Outcome C1 = "synthesis feasible WITHOUT Stream D."** The ranking math already exists in code: `computeArchetypeRankings` (`api/_utils/archetypeScoring.js:107-141`) is a pure ~35-line function, already the **live** selection path (`decide.js:100`) and already unit-tested over a synthetic universe. So calibration can be produced by a **calibration-only** layer. *(Contrast Outcome C2 = "must build partial Stream D first" — rejected, because its trigger "the Phase-8 ranking math isn't implemented yet" does **not** apply; it already is.)* `[direct: calibration §5.1]`
- **Option α = the chosen sourcing strategy: a calibration-only synthesis layer on existing infrastructure.** Import `computeArchetypeRankings`, add the small missing **`prefer`/`lean_away` per-sector term** (~100–200 lines, calibration-only, touches **no** production/Stream-D path), score a defensive-vs-neutral archetype, and **anchor/validate against the 22 real battles.** *(Contrast Option β = build partial Stream D first — unnecessary; Option γ = defer to post-launch — fallback only.)* `[direct: calibration §5.4]`
- **Concrete meaning:** *don't wait for live data and don't reopen the launch sequence — synthesize calibration on top of the existing ranking code, validated against the 22 real battles.* **Launch sequence is NOT reopened.** `[direct: calibration §0/§6]`

> **Decode nuance to carry forward:** the calibration report frames Option α around **sector & volume-regime** calibration and `computeArchetypeRankings` — **not** directly around a `baggerBombFit` rescore. What it hands the bench-staleness workstream is the **same enabler** (replay the intraday bars we already fetch through existing scoring code) and the **same anchor corpus** (22 battles), plus the explicit "8C coherence" hand-off (§2.3). `[direct: calibration §7]`

### 2.2 The 22 historical battles — availability & structure
- **Source:** `agentBattles` (server/admin-written via `agentBattleService.js:createAgentBattle`). **Count/range supplied live by Flash: 22 `agentBattles`, ~Mar 27 – May 22, 2026.** Meets the "10–20 battles" target. `[direct: calibration §1.4]`
- **Logged at decision time:** bench = `portfolio.bench = { stocks:[3], crypto:{1} }`, **sector-tagged** via `sectorMap`; a frozen `initialPortfolio` snapshot (star/core/support only — **bench is NOT frozen**; read live `portfolio.bench`); per-asset `scoring.thresholds`. Decision/`exitReason` state is **embedded in the battle doc** (there is **no** separate `battleEvents` collection). `[direct: calibration §1.2-1.3]`
- **Structure caveats:** bench data is **fragmented** across `battles` (V2/V3 → `creator.bench`/`opponent.bench`) and `agentBattles` (→ `portfolio.bench`); **V4 dropped the bench entirely**; cooldown/swap-out bench entries lack `sector`. The 22 `agentBattles` are the clean sector-tagged core, but were generated by the **existing 6-archetype enum** (anchor/realism set — not a defensive-archetype sample). `[direct: calibration §1.2/§1.5]`
- **Limitation:** 22 is an **anchor/validation** set, not a statistical training set (esp. for the regime × streak × edge grid → synthesis-primary). `[direct: calibration §6.3]`

### 2.3 What the calibration report says to THIS workstream
- It distinguishes **MB-04 (normalize the baseline)** from **bench-staleness (refresh the scores)** as **complementary, not identical** fixes. `[direct: calibration §7.2]`
- It explicitly flags the **"8C coherence"** open question (its §7.3/§8.1): the trigger gate's margin math appears to **duplicate / not use** the V1.4-centralized helper, and it **defers that to the rescore/normalization design phase** — i.e., the same thread §3 resolves. `[direct: calibration §7.3]`

---

## 3. mb-04 ↔ 8C entanglement verdict ("confirm or kill")

### VERDICT: **Same underlying issue — CONFIRMED (not killed) — but already partially addressed and deliberately scoped by V1.4. Two refinements the pre-merge reports could not see.**

### 3.1 What MB-04 "Outcome C qualified" means `[direct: MB04 report]`
- The mb-04 hypothesis (swap margin computed against a **non-normalized baseline**) is **confirmed**, qualified to **multi-day battle modes only** (same-day = Outcome B / <20%; multi-day day-2+ = Outcome C / 24–35%).
- **Key reframing mb-04 itself makes:** mb-04 is **not** a deterministic swap-hurdle in code — it is a **soft prompt preference** (`forgeKnowledgeBase.js:615-638` → injected as a "STRATEGY PREFERENCE", `agentEvalPromptAssembly.js:283-323`). `grep mb-04 api/` and `grep hurdle api/` = **0 hits**.
- The mismatch: ACTIVE is shown to Haiku as **"Gain%" = entry-relative** (`agent-evaluate.js:283,293`); BENCH as **"Daily%" = prev-close-relative** (`agentEvalPromptAssembly.js:930` → `marketDataCache.js:593`). Apples-to-oranges; bites on multi-day holds.
- The **one deterministic surface** that mixes baselines = the wake-up **trigger gate**'s `bench_outperformance` check (`api/_utils/agentTriggerGate.js:90-113`): active-weak test entry-relative (sign), bench test prev-close-relative (magnitude/ATR), threshold **hardcoded 0.5** (ignores the user's 0.25–1.0 param / trait 0.3/0.5/0.7).

### 3.2 Does MB-04's fix map to `computeBenchVsActiveMargin` (the V1.4 normalized baseline)?
**Yes — that helper IS the apples-to-apples baseline mb-04 calls for, and it is wired into only one consumer.** `[direct: grep]`
- `computeBenchVsActiveMargin` is defined at **`api/_utils/agentRiskManager.js:260`** and returns a **bench-MINUS-active differential in ATR units** (`(benchDailyPct − activeDailyPct) / atrValue`) — same-baseline, normalized. `[direct: grep + map]`
- It is **called in exactly one place: `agentRiskManager.js:328`**, inside `clearsHurdleFloor` (**the hurdle floor**), invoked from `agent-evaluate.js:~1148-1154`. `[direct: grep; map for invocation site]`

### 3.3 Is the trigger gate's inline math the un-normalized consumer? → **YES**
- `grep computeBenchVsActiveMargin api/` shows the symbol **only** in `agentRiskManager.js` (def + call) and in tests — **never in `agentTriggerGate.js`**. `[direct: grep]`
- The trigger gate still uses the raw, **one-sided** check — verified verbatim at `agentTriggerGate.js:102-106`: `const dailyChangePct = benchPrice.changePercent || 0; const benchATR = benchAsset.baseATR || 2.5; const benchATRMult = dailyChangePct / benchATR; if (benchATRMult >= 0.5)`. Not a same-baseline differential, not the helper; `benchPrice` = `prices[benchAsset.symbol]` (`:99`, live prices). `[direct: agentTriggerGate.js:90-113]`

### 3.4 So is mb-04 Outcome C the SAME issue as the "8C-coherence" finding?
**CONFIRMED they are the same finding, reached from two directions** (mb-04: "is the baseline normalized?" → the trigger gate isn't; calibration 8C: "what does the trigger gate compute?" → it avoids the helper). Both converge on: *`computeBenchVsActiveMargin` is wired into the hurdle floor only, not the trigger gate.* **Two refinements the pre-merge reports could not fully see:**

1. **The divergence is deliberate, TESTED, and explicitly framed as DEFERRED-UNIFY (not permanent-by-design).** `[direct]` V1.4 built the helper, wired it to the hurdle floor (Knob B), and added **Gate 8C as a "delete-on-unification tripwire."** The test header (`keystoneGate8.test.js:42-58`) is unambiguous: it "records the 8C margin divergence … §7.1 intended ONE shared formula consumed by both; it is not. This suite asserts the **CURRENT** state, NOT the desired one. **When the two formulas are reconciled, these tests SHOULD FAIL and be DELETED as part of that change.**" The tripwire itself: `:66` `expect(triggerSource).not.toMatch(/computeBenchVsActiveMargin/)`; `:69` asserts the inline `dailyChangePct / benchATR` form is present. A 3rd test (`:104-133`, "woken by formula X, blocked by formula Y") demonstrates end-to-end with **both real functions** that one market state WAKES Haiku (bench-only 0.8×) yet the hurdle BLOCKS the swap (bench-minus-active 0.2× < degen floor 0.6×). **Gate status (`:55-58`): 8C fails the §7.1 cross-component COHERENCE clause ONLY — no safety/knob clause — and is a "known-open coherence finding"; 8D/8E carry the merge-unblock.** So the unify is **deferred to exactly this workstream**, with the tests pre-wired to be deleted when it lands. "Unify vs document" is a live, owned decision here — and the test scaffold already anticipates "unify."

2. **Staleness and normalization do NOT cleanly "meet at one line."** `[direct]` MB-04 §4.2 argued they meet at `agentTriggerGate.js:~104` because the trigger gate is "both un-normalized **and** stale-fed." But the trigger gate reads bench from the **live `prices[symbol].changePercent`** (`:99,:102` — prev-close-relative), **not** the stale `baggerBombFit` ranking; in fact the trigger gate never imports or touches `stockRankings` at all (it imports only `agentScoring.js`). The **staleness** defect lives in a **different path** — the `baggerBombFit`-based candidate selection / hotBench (`agent-evaluate.js:~444-446`) and the hurdle-floor score inputs — while the **normalization/baseline** defect lives in the trigger gate + the prompt CSVs. They are **related** (all swap-evaluation) but touch **different inputs/surfaces.** This **weakens the "must be one workstream because same line" argument** and is a key input to D1 below.

*(Confidence: §3.1–§3.4 are now all `[direct]` — the second flush delivered full reads of `agentTriggerGate.js`, `keystoneGate8.test.js`, and `agentRiskManager.js:255-345`.)*

---

## 4. Code structure & integration seams (read-only; re-derived)

### 4.1 The producer → enabler → consumers map

| Role | File:anchor (current) | Note | Conf |
|---|---|---|---|
| **Rankings producer** | `api/cron/compute-index-intelligence.js` (write ~`:850-856`) | daily pre-market cron; writes `indexIntelligence/stockRankings`; **`updatedAt` only, no `expiresAt`** | `[direct]` |
| **Scoring engine** | `api/_utils/gameModeScoring.js:~91` (`computeGameModeFits`) + `rankingConfig.js:~821` (weights) + `api/_utils/indexIntelligence.js` (technical scoring) | daily-only inputs | `[map]` |
| **Enabler (intraday fetch)** | `api/cron/agent-evaluate.js:~394-403` (`fetchIntradayBatch …'5m'`) → `intradayMap` processed ~`:411-429` | **portfolioSymbols only**; VWAP/SMA20 for exits; **not** fed to rankings | `[direct]` |
| **Consumer — candidate selection / bench read** | `agent-evaluate.js:~394-403` (read `stockRankings`) → filter/sort by stored `baggerBombFit` → top-15 hotBench ~`:430-450` (gated `isNewTradingDay`) | **where staleness bites** | `[direct]` |
| **Consumer — hurdle floor** | `clearsHurdleFloor` → `computeBenchVsActiveMargin` (`agentRiskManager.js:260`/`:328`); invoked `agent-evaluate.js:~1148-1154` | **normalized** (post-V1.4) | `[direct]` (def/call) / `[map]` (invocation) |
| **Consumer — wake-up trigger gate** | `agentTriggerGate.js:102-106` (`bench_outperformance`, block `:90-113`) | raw one-sided `dailyChangePct/benchATR ≥ 0.5`; **un-normalized**; live-prices input | `[direct]` |

### 4.2 Candidate integration seams (NAMED — not designed, not recommended)
- **(a)** `agent-evaluate.js:~444-446` — after candidates are read from `stockRankings` and before `slice(top 15)`: a rescore of the price-derived `baggerBombFit` dims using already-in-hand intraday data could re-rank here.
- **(b)** `agent-evaluate.js:~414-429` — the intraday fetch is already in-memory here but only for `portfolioSymbols`; extending it to bench/hotBench symbols is the **data** seam.
- **(c)** `agentRiskManager.js:260/328` (hurdle-floor margin) — already consumes fresh daily `prices`; an intraday-fresher score/margin could enter here.
- **(d)** `agentTriggerGate.js:~90-113` (wake-up gate) — the un-normalized one-sided check; **the 8C unify point.**
- **(e)** `compute-index-intelligence.js` write (~`:850-856`) — the cron seam for a 2nd/intraday recompute **and** the place to add an `expiresAt`/`computedAt` freshness stamp.

*Each rescore approach in §6/D3 maps onto a different subset of these seams.*

---

## 5. The three §7 parked findings — located in code `[map; bench report §7]`

### §7.1 Dual-slot timing inversion
- `compute-index-intelligence.js` cron `"30 10,11 * * 1-5"` (`vercel.json:133-136`) → 10:30 **and** 11:30 UTC.
- `compute-rankings.js` (fundamentals → `peerRankings`) cron `"0 11 * * 1-5"` (`vercel.json:53-56`) → **11:00 UTC, between the two index runs.**
- **Inversion:** the **10:30** index run necessarily folds in the **prior day's** fundamentals (peerRankings not yet refreshed); only the **11:30** run sees fresh fundamentals. Benign normally (11:30 overwrites) but is the mechanism behind failure-mode-1 (mixed-vintage rankings if 11:30 fails).
- `agent-evaluate.js` cron `"*/15 13–21 * * 1-5"` (`vercel.json:137-140`).
- **⚠️ Reconcile with the task's framing:** the task describes "two agent eval slots at 10:30/11:30 UTC." In code, **10:30/11:30 are the two *rankings-recompute* slots**, and the **agent** runs every 15 min during RTH — there is **no** separate morning/afternoon *agent* slot in `vercel.json`. The design phase should reconcile this wording.

### §7.2 Missing `expiresAt` on `stockRankings`
- Verified verbatim — the write is `batch.set(rankingsRef, { stocks: rankingStocks, totalTechStocks, sectors, updatedAt: FieldValue.serverTimestamp() })` (`compute-index-intelligence.js`, the `indexIntelligence/stockRankings` block ~`:850-856`): **`updatedAt` only — no `expiresAt`/`ttl`/`computedAt`.** `[direct]` (By contrast `compute-rankings` sets a 26 h `expiresAt` on `peerRankings`.) Consumers cannot detect a stale/mixed-vintage doc. **Prerequisite** for any freshness-gated/staleness-weighted rescore option.

### §7.3 Crypto-hours blind window
- Verified — `isMarketOpen()` (`api/_utils/marketSchedule.js:123-141`) returns `minutes >= openMinutes && minutes < closeMinutes` gated on `MARKET_OPEN/CLOSE` constants + weekday + holiday/early-close only: **equity regular session (9:30–16:00 ET), no crypto/24-7 branch.** `[direct]` Crypto battles carry `localClose` 20:00 ET (`agentTriggerGate.js:248` reads `timing.localClose`), so the agent's eval cron does **not** evaluate crypto positions in the **16:00–20:00 ET (~4 h) window** even though the battle is "open" for crypto; the pre-market recompute likewise does not align with 24/7 crypto.

---

## 6. OPEN DECISIONS FOR FLASH (options surfaced; none chosen)

### D1 — The 8C "unify vs document" call, scoped against MB-04: **one workstream or two?**
**For folding 8C/mb-04 INTO this workstream:** same swap-evaluation surface; the helper already exists; MB-04 §4.2 + calibration §8.1 both pointed here; **V1.4 explicitly deferred the unify to "the rescore/normalization design phase" — which is this**; routing the trigger gate through `computeBenchVsActiveMargin` is small.
**For keeping them SEPARATE / sequenced:** (i) V1.4 deliberately scoped the helper to the hurdle floor and added Gate 8C as a tripwire **asserting non-use** — the wake-up gate may be an intentionally cheaper one-sided heuristic (it gates whether to **wake Haiku**, not whether to **swap**); (ii) staleness vs normalization touch **different inputs/paths** (§3.4-pt-2) — the trigger gate uses live prices, not the stale ranking; (iii) mb-04 is **prompt-delegated/soft** and qualified to multi-day, so "normalize the baseline" may be more about the **prompt CSVs** than the gate; (iv) the normalization wiring is a tiny coherence fix that could ship **independently/immediately**, whereas the rescore is a larger design with cadence/infra choices.
**Sub-decisions if unified:** unify by routing the trigger gate through the helper **vs** "document" by keeping Gate 8C's locked divergence and normalizing only the prompt CSVs; and whether to also fix the **hardcoded-0.5 trait-strength bug** (MB-04 §5.1, same code block).
→ **DECISION NEEDED:** is 8C/mb-04 normalization the **same** work package as bench-staleness rescore, a **sequenced-but-separate** fix, or **out of scope** here?

### D2 — Fold the three §7 findings into this workstream?
- **§7.2 (`expiresAt`)** — near-**prerequisite** for any freshness-gated/staleness-weighted option → likely fold in.
- **§7.1 (dual-slot timing)** — intersects only if the rescore is tied to a cron cadence; otherwise cosmetic → optional.
- **§7.3 (crypto blind window)** — matters only if the rescore design extends to crypto/24-7 → likely defer unless crypto is in scope.
→ **DECISION NEEDED:** fold-in / defer, per finding.

### D3 — Rescore approach & cadence (options the evidence supports)
- **A. Demand-driven candidate rescore** — rescore only hotBench∪bench at decision time, reusing the per-tick intraday fetch **extended to bench symbols** (seams a+b). Cheapest wiring; uses the enabler; matches the bench report's "natural low-cost" option and Option-α's "synthesize on existing infra" spirit. Fixes the **candidate menu**.
- **B. Intraday recompute cron** — a 2nd/Nth daily recompute of `stockRankings` with intraday data (seam e). Uniform benefit to all consumers; more infra; pairs naturally with `expiresAt`.
- **C. Freshness-weighted hurdle** — keep stale ranks, fold rankings-age into the swap hurdle (ties to mb-12). Smallest blast radius; needs `expiresAt` (§7.2); fixes the **hurdle**, not the candidate-menu staleness.
- **D. Hybrid** — A for the menu + C for the hurdle.
- **Cadence/tolerance sub-question** (calibration open Qs): uniform vs **per-symbol** staleness tolerance (high-vol names go stale faster); **archetype-aware** tolerance. The Option-α corpus can **set** the tolerance empirically but does **not** make the approach choice.
→ **DECISION NEEDED:** approach (A/B/C/D) + cadence/tolerance shape.

### D4 — Calibration coupling
- Option α (calibration-only synthesis on existing infra, anchored to the 22 battles) is the sanctioned way to set rescore tolerances **without** reopening launch or building Stream D.
→ **DECISION NEEDED:** does the rescore design **block** on the α calibration corpus, or ship a **conservative default** tolerance now and calibrate later?

### D5 — V1.2 "Swap Evaluation Pipeline Refresh" — it EXISTED, was decomposed, and (a) is already DONE
**This is the most important correction vs. the first draft.** The V1.2 "Swap Evaluation Pipeline Refresh" **was a real spec** — it is named explicitly in the **V1.4 spec header and §0**, which tell you exactly what happened to it: `[direct: FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:11, :24, :40]`

> `:11` **"Supersedes: V1.2 'Swap Evaluation Pipeline Refresh' — V1.4 absorbs V1.2 workstream (a) margin normalization outright; V1.2 workstream (b) bench-staleness remains a separate dependency."**
> `:24` "Coordinates with V1.2: absorbs workstream (a) (margin normalization); workstream (b) (bench-staleness) **remains separate calibration dependency**."
> `:40` "V1.2 isn't merged or shipped; V1.4 owns helper extraction outright — single workstream."

So V1.2 pre-scoped **exactly two** workstreams, and this is the head-start the task expected:
- **(a) margin normalization** → **already absorbed and SHIPPED by V1.4** as `computeBenchVsActiveMargin` + the hurdle floor (§3.2). The only residual is the **8C coherence** decision (D1) — i.e., whether to extend (a) from the hurdle floor to the trigger gate. *(Note: `KEYSTONE_PRELOCK_FINDINGS.md:431-434,562-566` adds that the V1.2 spec was never on disk as a standalone file — it was reconstructed from the two verification reports — and confirms the inline margin at `agentTriggerGate.js:104` / hardcoded `0.5` at `:106`. The grep finding from the first draft was correct; the **interpretation** ("no head-start exists") was wrong — V1.4 itself is the carrier of the V1.2 decomposition.)* `[direct]`
- **(b) bench-staleness** → **explicitly left as a separate dependency = THIS workstream.** V1.4 deliberately did *not* solve it.

**Conclusion (replaces the first draft's "no head-start"):** The head-start is the **V1.2 (a)/(b) split itself**, now authoritatively recorded in V1.4. (a) is done; **(b) is ours, and it is pre-scoped as "the bench-staleness rescore," cleanly decoupled from the (already-shipped) margin-normalization half.** The `FORGE_RULES_THESIS_V1_2.md` doc is a *different* "V1.2" (the Voice-Layer/rule-swap thesis, source of the bench report's dual-slot-cadence reference) and is **not** the swap-pipeline spec — do not conflate them. `[direct]`
→ **No decision needed** — this resolves Part 1 item 4: inherit the V1.2 (b) scope; (a) is settled except for the D1 coherence call.

---

## Appendix — anchor index (current HEAD)

| Claim | Anchor | Conf |
|---|---|---|
| Rankings doc write (no expiresAt; `updatedAt` only) | `compute-index-intelligence.js:~850-856` | `[direct]` |
| Recompute cron 10:30/11:30 UTC | `vercel.json:133-136` | `[direct]` |
| Fundamentals cron 11:00 UTC | `vercel.json:53-56` | `[direct]` |
| Agent loop cron */15 13–21 UTC | `vercel.json:137-140` | `[direct]` |
| baggerBombFit weights (.10/.70/.20/+.20) | `rankingConfig.js:~821`; `gameModeScoring.js:~91` | `[map]` |
| Enabler — intraday 5m fetch (portfolioSymbols only) | `agent-evaluate.js:~394-403`, processed ~`:411-429` | `[direct]` |
| Bench read / hotBench top-15 (gated `isNewTradingDay`) | `agent-evaluate.js:~394-403` (read), ~`:430-450` (sort) | `[direct]` |
| Canonical normalized margin (def/call) | `agentRiskManager.js:260` / `:328` | `[direct]` |
| Hurdle-floor invocation | `agent-evaluate.js:~1148-1154` | `[map]` |
| Trigger gate (un-normalized, one-sided, 0.5) | `agentTriggerGate.js:102-106` (block `:90-113`) | `[direct]` |
| Gate 8C tripwire + delete-on-unify framing | `keystoneGate8.test.js:42-58`, `:66`, `:104-133` | `[direct]` |
| isMarketOpen equity-only (crypto gap) | `marketSchedule.js:123-141` | `[direct]` |
| V1.2 spec existed; (a) absorbed, (b)=this work | `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:11,:24,:40` | `[direct]` |
| Calibration: ranking math already exists | `archetypeScoring.js:107-141`; `decide.js:100` | `[direct: calib report]` |
| 22 battles source | `agentBattles` via `agentBattleService.js:createAgentBattle` | `[direct: calib report]` |

*End of report. (Read-only Phase 0 — no production files modified.)*
