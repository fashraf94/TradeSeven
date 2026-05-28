# Calibration Data Discovery — Findings Report

**Status:** Discovery complete. Output gates calibration-script specs.
**Date:** 2026-05-28
**Branch:** `claude/calibration-data-discovery`
**Author / role:** Claude Code (implementation/discovery role, per `AI_ASSISTED_INFRASTRUCTURE_PLAYBOOK.md`)
**Spec:** `CALIBRATION_DATA_DISCOVERY_TASK.md` (five questions §3.1–3.5; six outcomes §6)
**Type:** Investigation only — no production code written or modified.

---

## ⚠️ Data-access constraint (read this first)

This investigation ran in an ephemeral sandbox with **no Firebase/EODHD credentials and no committed battle data**, so I could **not read live Firestore records**. Every record shown below is **reconstructed from code** and **labeled with its source**; optional/variable-shape fields are flagged explicitly. This is the playbook's sanctioned pattern (§"Data verification before commit": when primary sources are unreachable in the sandbox, verification moves to whoever has access).

**Live numbers supplied by Flash (parallel pull):** **22 `agentBattles`, createdAt spanning ~March 27 – May 22, 2026 (~8 weeks).** Counts for `battles` (BaggerBomb V2/V3/V4) and `seasonEntries` were not supplied; `seasonEntries` is **confirmed ~empty via live count — 4 documents** (see §2.4). All recommendations below are framed conditionally against these numbers.

---

## Executive summary

| Question | Finding (one line) |
|---|---|
| **A — BaggerBomb battles** | Bench composition is real and logged at decision time in **`agentBattles`** (n=22), sector-tagged; **V4 BaggerBomb dropped the bench**; data is fragmented across `battles` + `agentBattles`. |
| **B — Forge S&P battles** | The "vs-S&P" construct is **Season Mode** (`seasonEntries`), which has **no bench** (cash/positions + `sectorWeights`) and is **likely unshipped/empty**. Does not serve bench calibration; *would* serve sector calibration if populated. |
| **C — Stream B fixtures** | Stream B is **curation/design**, not data. Only fixtures are **inline unit mocks** (one toy `makeAgentData`). **Not a usable calibration dataset.** The `prefer`/`lean_away` sector schema is **not implemented** in code. |
| **D — Historical SPY volume** | **Available** via EODHD intraday (`/api/intraday/SPY.US?interval=5m`), ~82 days/call. **⚠️ ~15% of 5-min bars carry cumulative volume** — a documented, filterable artifact that **must** be handled in Phase A. |
| **E — Synthesis feasibility** | **Feasible without Stream D (Outcome C1).** The ranking math (`computeArchetypeRankings`) is live and standalone; a synthetic-universe harness already exists; only a small calibration-only `prefer`/`lean_away` layer is missing. **Recommend Option α.** |

**Headline recommendation:** Proceed with **Option α (calibration-only synthesis layer on existing infrastructure) → Outcome C1.** Do **not** reopen the launch sequence (Option β/C2 is unnecessary). The sequencing contract "calibration before Stream D" holds.

**Per-calibration outcome mapping (spec §6):**
- **Sector calibration** → **Outcome B + C1**: real sector-tagged benches (n=22) as anchor + Option-α synthesis layer.
- **Volume Phase A** → **data available (not Outcome D)**, conditional on the cum-bar filter.
- **Volume Phase B** → **C1, synthesis-primary**: 22 single-day samples cannot cover the regime × streak × edge-case grid; synthesis is required.

---

## Section 1 — Internal BaggerBomb battles (Question A)

### 1.1 Battle data lives in two collections, not one

| Collection | What it is | Writer | Bench? |
|---|---|---|---|
| `battles` | Human "Classic 1v1, BaggerBomb V2/V3/V4" (`firestore.rules:259`) | Client SDK, `src/firebase/firebaseService.js` (`createBaggerBombBattleV3/V4`, e.g. `:243`); mirrored to localStorage (`App.jsx` `saveBattlesSafe`) | V2/V3 **yes**, **V4 no** |
| `agentBattles` | AI-agent deployments (Sprint 3) | **Server/Admin SDK**, `api/_utils/agentBattleService.js:createAgentBattle` (`:200`); client may update only execution-control fields (`firestore.rules:200-211`) | **Yes** |

The spec's assumed **`battleEvents` collection does not exist** (0 references). There is no separate per-decision event log; decision state is embedded in the battle doc.

### 1.2 Bench composition: real, logged at decision time, version-dependent

- **`agentBattles` is the strongest source.** Bench = `portfolio.bench = { stocks:[3], crypto:{1} }` (`agentBattleService.js:96-100`); validation enforces exactly **3 bench stocks + 1 bench crypto** (`decide.js:634-636`). Captured **at deploy/decision time**, with a **frozen `initialPortfolio` snapshot** (Amendment 5, `agentBattleService.js:137-141`). **Every asset is sector-tagged** via `sectorMap` → `deepCopyArrayWithSector` (`agentBattleService.js:91-100`; map built at `decide.js:444-446`).
- **`battles` (V2/V3):** bench = `creator.bench` / `opponent.bench`, same `{stocks, crypto}` shape (`App.jsx:6431,6440,6517,6526`).
- **⚠️ V4 dropped the bench entirely** (`App.jsx:6563` — "BAGGERBOMB TRAINING V4: … No Bench, 1 Swap, 1 Day"). **This is the single most important data-quality fact for Question A:** bench data exists only in V2/V3 `battles` + `agentBattles`, not the current V4 line.

### 1.3 Verification anchor — RECONSTRUCTED `agentBattles` record
*Source: `agentBattleService.js:71-141` + `decide.js:530-548,631-636` + `set-opponent.js:94-100`. Structure verified against code; values illustrative.*
```jsonc
{
  "ownerId": "uid_abc123", "agentId": "agt_xY...",
  "status": "active",                       // 'active' → 'completed' (decide.js:438)
  "createdAt": "2026-05-20T13:30:00.000Z", "expiresAt": "2026-05-20T20:00:00.000Z",
  "portfolio": {
    "star":    [ {"symbol":"NVDA","sector":"Technology","baseATR":3.1,"isCrypto":false}, {"symbol":"XOM","sector":"Energy"} ],
    "core":    [ {"symbol":"JPM","sector":"Financials"}, {"symbol":"UNH","sector":"Healthcare"} ],
    "support": [ {"symbol":"PG","sector":"Consumer Staples"}, {"symbol":"WMT"}, {"symbol":"SOL","sector":"Crypto","isCrypto":true} ],
    "bench":   { "stocks":[ {"symbol":"COST","sector":"Consumer Staples"}, {"symbol":"LMT","sector":"Industrials"}, {"symbol":"DUK","sector":"Utilities"} ],
                 "crypto": {"symbol":"BTC","sector":"Crypto","isCrypto":true} },
    "startingPrices": { "NVDA": 142.30, "XOM": 118.05 }
  },
  "initialPortfolio": { "star":[...], "core":[...], "support":[...] },   // frozen decision-time snapshot
  "opponent": { "portfolio": {"star":[...],"core":[...],"support":[...]}, "bench": {...}, "username":"CPU Opponent", "odUserId":"cpu" },
  "scoring": { "thresholds": { "NVDA": {"threshold":3.1,"rallyThreshold":4.65,"moonshotThreshold":6.2} } }
}
```
**Fields I could NOT verify without a live record (flagged):**
- `opponent` is **nullable** (`agentBattleService.js:103`) — some battles may lack an opponent / opponent bench.
- The frozen `initialPortfolio` shows star/core/support (`:139-141`); **verified via Firestore Console spot-check (3 records): `bench` is NOT frozen in `initialPortfolio`** — only the star/core/support tiers are frozen. Bench must be read from the live `portfolio.bench`, which evolves over the course of a battle.
- **Bench nesting differs across collections:** `agentBattles` → `portfolio.bench`; `battles` → `creator.bench` / `opponent.bench`. A calibration reader must handle both.

### 1.4 Counts & time range
**Supplied by Flash:** **22 `agentBattles`, ~Mar 27 – May 22, 2026.** This **meets the sector calibration's "10–20 historical battles"** target (spec §2). Surfaces that hold counts for the other collections (require a live read): `agents.stats.gamesPlayed` (`agentService.js:113`), `draftUserStats/{userId}` (`firestore.rules:214`), and a `count()` + `_v` breakdown on `battles`.

### 1.5 Honest data-quality summary
Bench schema is solid and sector-tagged where present, but it is **fragmented across two collections with different nesting, has a hard V4 discontinuity (no bench), and may have a pre-Firestore localStorage tail.** Additional schema variation surfaced via verification: cooldown bench entries (stocks added to bench via swap-out) lack `sector` fields, while original bench stocks (3 per battle at entry) retain them — the calibration script must handle this gracefully via `sectorMap` backfill (`decide.js:444-446`) or by filtering cooldown entries for sector-composition analysis. The 22 `agentBattles` are the clean, sector-tagged core. **Caveat for sector calibration:** those 22 were generated by the **existing 6-archetype enum**, *not* the new "defensive archetype" — so they are an anchor/realism set, not a direct "defensive archetype produced this book" sample (see §5, §6.1).

---

## Section 2 — Forge S&P battles (Question B)

### 2.1 "Forge S&P battles" = Season Mode (`seasonEntries`)
The spec's `forgeBattles` / `forgeSeasonAgents` collections **do not exist** (0 references). The real "agent vs S&P 500" construct is **Season Mode**: an agent's Forge rule-set runs against a **SPY benchmark** over 5/10/15/20 trading days. Confirmed: `season.benchmark = { spyStartPrice, spyCurrentPrice, spyReturn, dailyReturns }` (`create-entry.js:99`), `seasonState.alphaVsSpy` (`:285`), UI "Portfolio vs S&P 500" (`SeasonPerformanceChart.jsx:373`).

> The `agentBattles` "agent" (§1) battles a generated **CPU opponent** (`odUserId:'cpu'`, `set-opponent.js:99`), **not** the S&P. Only Season Mode is the vs-S&P construct.

### 2.2 Season Mode's data model is fundamentally different from BaggerBomb
*Reconstructed `seasonEntries` record — source: `create-entry.js:217-316`.*
```jsonc
{
  "seasonId":"solo-ab12cd34ef56", "userId":"uid_abc123", "agentId":"agt_xY...", "bundleId":"bnd_...",
  "mode":"solo", "durationDays":20, "status":"active",
  "algorithm": { "version":1, "rules":[ {"ruleId":"se-03","priority":2,"params":{},"enabled":true} ], "ruleCount":1 },
  "portfolio": { "cash":100000, "cashPct":100, "totalValue":100000, "positions":{}, "positionCount":0,
                 "sectorWeights":{}, "initialSectorWeights":{} },   // capital allocation, NOT a roster
  "seasonState": { "alphaVsSpy":0, "weeklyResults":[], "weeklySectorReturns":{}, "totalTradesExecuted":0 },
  "dailySnapshots":[], "rulePerformance":{}
}
```
**No bench. No star/core/support tiers.** Portfolio is cash + a `positions` map + **`sectorWeights` / `initialSectorWeights`** + daily/weekly sector returns, driven by `algorithm.rules[]`.

### 2.3 Structural mapping verdict
- **→ Bench-composition calibration: does NOT map.** No bench exists; no transformation recovers a 5-slot bench from a cash/positions allocation.
- **→ Sector calibration: maps *well* (arguably better than BaggerBomb).** `sectorWeights` / `initialSectorWeights` / `weeklySectorReturns` + `alphaVsSpy` are exactly the fields for "sector composition of resulting portfolios (defensive ≥30%? lean_away ≤15%?) vs a baseline." No transformation needed — **if it has data.**

### 2.4 ⚠️ Season Mode appears built-but-not-shipped → confirmed ~empty (4 docs)
`useActiveDeployments.js:54`: *"TODO: Add seasonEntries query when Season Mode ships."* Reads are not wired into active deployments; a `SeasonModeToggle` and solo-season scaffolding exist, but consumption is gated. **Strong signal that `seasonEntries` is empty or near-empty in production. Confirmed via live count: 4 documents** — consistent with the built-but-not-shipped hypothesis. At 4 entries, Season Mode cannot serve any calibration regardless of schema fit.

### 2.5 "Same Phase 8 ranking logic?" — terminology mismatch
In this codebase, **"Phase 8" = structured trade *reasoning*** for the Film Room (`agent-evaluate.js:1066`, `GameTapeView.jsx:197`), **not** ranking math. Season Mode selects via `seasonRuleRegistry.js`; agentBattles select via `computeArchetypeRankings` (`archetypeScoring.js`, §5). There are **two distinct selection engines, neither called "Phase 8."** The spec's premise that a single "Phase 8 ranking math" governs both does not hold as stated — see §5 for what this means for synthesis.

---

## Section 3 — Stream B test fixtures (Question C)

### 3.1 Stream B is curation/design, not a data producer
Per `FORGE_RULES_THESIS_V1_2.md:154,81-83`: Stream B "curates the rule corpus," promotes hardcoded behaviors (incl. a **new `sector preference` category**, `:82`), and designs "archetype components" (`:83`). Tangible code outputs are **design/config**, not battles: `src/data/forgeKnowledgeBase.js` (rule corpus / `FORGE_RULE_TEMPLATES`) and `api/_utils/agentArchetypeConfig.js` (archetype enum config).

### 3.2 Fixture inventory: inline unit mocks only
51 test files; **one** fixtures directory — `api/forge/__fixtures__/readability/` (HTML for the readability parser, unrelated to battles). **No `fixtures/` dataset of battles/portfolios/benches.** The only battle-shaped fixture is inline in `agentBattleService.test.js:24-49` (`makeAgentData`): a single toy portfolio (star/core/support + 3-stock/1-crypto bench, `archetype:'momentum_chaser'`) with **no sectors, no prices**, `baseATR` on 2 of ~10 assets. It exists to assert a watchlist-snapshot shape, not to represent realistic portfolios.

### 3.3 Realistic scaling verdict (no softening)
Test fixtures are **not a viable standalone calibration source.** Sector calibration needs 10–20+ battles with realistic per-asset sectors/prices and *varied archetypes producing varied sector mixes*; the inline mock has none. **Scaling the mocks to calibration grade is not "reuse" — it is building a synthesis generator (i.e., it collapses into Question E / §5).** Stream B gives you the *schema and the archetype/rule definitions* to drive synthesis, but **zero ready-to-use battle records.**

### 3.4 The `prefer`/`lean_away` schema is not implemented (carry-forward confirmed)
`agentArchetypeConfig.js` (the `agents.archetype` enum: `momentum_chaser`, `analyst`, `diversifier`, `contrarian`, `degen`, `guardian`) encodes `regimePreferences.favoredStrategies`, `sectorConcentrationCap`, and risk/conviction mods — but **no `prefer`/`lean_away` per-sector schema** and no per-sector defensive weighting. `guardian` is "defensive" only in risk posture (`risk:25`), not sector composition. **The Sector Intelligence Strategy V1.1 schema lives at the Forge archetype/bundle level and is not in code today** — confirming the distinction you flagged. The calibration must operate at that (not-yet-built) level, which is precisely why a calibration-only layer is needed (§5).

---

## Section 4 — Historical SPY volume (Question D)

### 4.1 Source confirmed and already integrated
EODHD intraday: `https://eodhd.com/api/intraday/{SYMBOL}.US?api_token=…&interval=5m&fmt=json` (`eodhd-session-boundary-analysis.md:25`), integrated via `api/_utils/marketDataCache.js:27` and tested at `marketDataCache.test.js:85` (`/api/intraday/MU.US`). For SPY: `/api/intraday/SPY.US?interval=5m`. Intraday is confirmed active on the current plan (crons use `/api/intraday`, `/api/real-time`, `/api/eod`).

### 4.2 Time range / call count
A single default-window call (no `from`/`to`) returns **~82 trading days** of 5-min bars — a **6,478-element array** (= 82 × 79 candles; `eodhd-session-boundary-analysis.md:25`). **Phase A's 30–60-day need is covered by one request.** ⚠️ Windowed (`from=…&to=…`) requests returned `[]` in operator testing (`:311`) and today/real-time bars are delayed — **anchor on the default historical window, not tight windows.**

### 4.3 ⚠️ Reliability — the headline caveat for Phase A
Raw EODHD 5-min **volume is not clean**:
- **~15% of bars (12 of 78 on the validated session) have `volume` overwritten with a running session-cumulative total** (`eodhd-cumulative-volume-analysis.md:15-16`). These are 15% of bars but **89% of summed volume** (`:18`) — they would massively distort regime-frequency/distribution analysis.
- Plus **1 synthetic close-print bar/session with `volume:null`** (`:23`).
- **OHLC is unaffected** (`:17`) — price-based logic is safe; only volume needs cleaning.
- **Mitigation is documented and validated:** value-based filters (cumulative-match or rolling-median) achieved **zero false-positives/negatives** on the validated session (`:22`); detection must be **value-based, not position-based** (`:21,103`).

### 4.4 Not stored historically
Intraday is held only in a **5-minute-staleness live cache** (`marketDataCache`; `useResearchData.js:97-98`), for live battle views — **no historical intraday store.** Calibration Phase A fetches fresh (one SPY request) and filters before analysis.

### 4.5 Confidence
*Source & range:* **high** (integrated, tested, empirically validated May 2026). *Volume usability:* **medium, conditional on filtering.** **The cum-bar filter was validated on AAPL, not SPY** — the cum-bar *rate* on SPY (a far more liquid name) is unmeasured and **must be re-validated on one SPY session** before trusting the distribution (see Phase A scope, §6.2).

---

## Section 5 — Synthesis feasibility (Question E)

### 5.1 The ranking math already exists, is live, and is Stream-D-independent
`computeArchetypeRankings(stocks, archetype)` (`archetypeScoring.js:107-141`) is a **pure, ~35-line function** that maps (stock universe + archetype) → ranked list using per-archetype weight profiles (`ARCHETYPE_WEIGHTS`, `:14-63`). It is the **live production selection path** — `decide.js:100` calls it to pick agent stocks — and it is also unit-tested over a **synthetic universe** (`compute-index-intelligence.test.js:92`, `buildSyntheticUniverse()`). **This is the "ranking math" the spec hypothesized as a future Stream D deliverable; it is in fact already built and standalone.**

### 5.2 The one missing piece is small and calibration-isolatable
`archetypeScoring.js` has a `sectorDiversity` dimension (`:125-126`) but **no `prefer`/`lean_away` per-sector term**. Adding one is a **small, additive modifier**: a `{ sector → weight }` map applied to each stock's score before the existing sort. This is exactly the **"~100–200-line Phase 8 ranking mock"** described in spec Outcome C1 — and it can live **entirely in calibration-only code**, importing `computeArchetypeRankings` without touching it or any production/Stream D path.

### 5.3 All required inputs exist
- **Ranking fn:** `archetypeScoring.js:107`. **Synthesis harness skeleton:** `compute-index-intelligence.test.js:92`.
- **Sector map:** `decide.js:444-446` (built from `stockUniverse.sectorName` + crypto). **Per-stock dimension assembly:** `buildTechnicalSnapshot.js:23-108`.
- **Real sector-tagged benches:** the 22 `agentBattles` (`agentBattleService.js:96-100`).
- **Historical prices** (for optional full-universe historical re-selection): rolling `priceHistory` (`compute-rankings.js:189-308`) — *note: ranking **scores** are latest-snapshot only, not dated; see §5.5.*

### 5.4 Option evaluation (α / β / γ)

**Option α — calibration-only synthesis layer on existing data/infra. ✅ RECOMMENDED (= Outcome C1).**
Build a calibration-only module that imports `computeArchetypeRankings`, adds the `prefer`/`lean_away` sector term, and scores candidates for a "defensive" vs "neutral" archetype, measuring resulting sector composition. **No Stream D, no production changes, launch sequence untouched.** Feasibility evidence: §5.1–5.3 (every dependency exists; the harness skeleton is already written and tested).
- *Two flavors:* **(a)** score the real, sector-tagged benches/portfolios from the 22 battles — feasible **now**, needs nothing historical; tests the schema's re-ranking of real candidate sets. **(b)** full-universe re-selection — feasible on the **current** universe immediately; on **historical dates** it needs score reconstruction (see §5.5). MVP = (a) + (b)-on-current-universe.
- *Honest limitation:* α validates the **provisional design** ("does `prefer`/`lean_away` + defensive archetype produce a defensive book?"), not the eventual production code. When Stream D later implements the real schema, a light re-validation against the calibration mock is warranted. This is the intended posture — the task's stated goal is to "validate provisional design decisions before Stream D."

**Option β — build partial Stream D first (= Outcome C2). ❌ Not necessary.**
Implementing the real sector schema + ranking mods as Stream D items before calibration would reopen the launch sequence. The C2 trigger ("Phase 8 ranking math isn't yet implemented") **does not apply** — the ranking math (`computeArchetypeRankings`) is already implemented (§5.1). β buys fidelity α doesn't need for *provisional* validation.

**Option γ — defer to post-launch. ⚠️ Fallback only.**
Viable if α is deprioritized, but it forfeits the pre-launch validation this entire task exists to provide, and re-introduces risk that provisional thresholds ship wrong. Recommend only if α is not resourced.

### 5.5 The one nuance that bounds α
Full-universe re-selection **for a specific historical date** (flavor b on historical dates) needs each stock's ranking dimensions (`fundamentalScore`, `technicalScore`, `baggerBombFit`, `atrPercentile`, `compositeScore`) *as of that date*. `compute-rankings.js` retains rolling **prices** but **not dated ranking-score snapshots** (`:50-62` timestamps are latest-write, not historical series). So historical-date re-selection requires reconstructing scores from historical inputs — extra work. **This does not block α:** flavor (a) (score real benches) and flavor (b)-on-current-universe both run with no reconstruction. Recommend the MVP avoid historical-date re-selection unless a specific calibration question demands it.

---

## Section 6 — Recommended calibration data sources

*All recommendations use explicit conditional framing (per Flash Phase-1 note #2). Numbers in **bold** are the gating conditions.*

### 6.1 Sector calibration (Sector Intelligence Strategy V1.1 §9)
**Primary source:** **Option α synthesis** — run `computeArchetypeRankings` + the calibration-only `prefer`/`lean_away` layer for a defensive vs neutral archetype over the stock universe; measure resulting sector composition (defensive ≥30%? lean_away ≤15%?).
**Anchor/realism set:** the **22 real `agentBattles`** (sector-tagged benches/portfolios) — use to check that synthesized sector distributions resemble real ones.
- **Data available:** 22 real battles (✓ meets the 10–20 target) **conditional on** ≥~10 of them having populated, sector-tagged benches (V4 has none — **verify the V2/V3-vs-V4 / agent-vs-human mix on a live spot-check of 2–3 records**).
- **Transformations:** add `prefer`/`lean_away` term to the ranking score; normalize bench/portfolio sector tags. None for the real benches beyond reading them.
- **Confidence:** **medium-high** for the *mechanism* test (does the schema produce a defensive book); **medium** for "real benches confirm it," because the 22 battles were generated by the **existing enum archetypes, not the new defensive archetype** (§1.5). The real data validates *bench realism*, not *defensive-archetype output* — that part is α-synthesized.

### 6.2 Volume regime Phase A (Volume Regime Strategy V1.1 §10 — distribution/frequency)
**Primary source:** **EODHD intraday `SPY.US` 5-min bars**, default window (~82 trading days, one call), **after** applying the documented cum-bar + close-print filter.
- **Data available:** ~82 days in a single request — **conditional on** the filter removing the ~15% cumulative-volume bars (`eodhd-cumulative-volume-analysis.md`).
- **Transformations / scope (must be in Phase A's budget — per Flash):**
  1. Port the **cum-bar filter** (logic exists, `eodhd-cumulative-volume-analysis.md §5`; cumulative-match or rolling-median) — small (~tens of lines) but **non-optional**.
  2. **Re-validate the filter on one SPY session** (it was validated on AAPL; SPY's cum-bar rate is unmeasured — §4.5).
  3. Compute the volume-ratio distribution and regime frequency under the 0.65/1.35 thresholds.
  - *Scope estimate:* small-to-moderate — dominated by the filter port + SPY re-validation + distribution code, not data acquisition (one API call). Roughly a **half-day to a day** of script work, the bulk being filter validation, **not** infra.
- **Confidence:** **high** on source/range; **medium, conditional on filter** for volume cleanliness; **explicitly unverified** for SPY-specific cum-bar rate until the one-session re-check.

### 6.3 Volume regime Phase B (Volume Regime Strategy V1.1 §10 — mid-battle simulation)
**Primary source:** **Synthesis (Option α-style scenario construction) — synthesis-primary, not real-data.**
- **Sample-size analysis (per Flash):** the 22 `agentBattles` are predominantly **single-day** ('1d' default, `decide.js:553`) over ~39–40 NYSE trading days (Mar 27–May 22). That yields **≤22 distinct regime-day observations**. Phase B requires the **cross-product**: {LOW, NORMAL, HIGH} × streak states × edge cases (streak×LOW worst-case freeze; HIGH + flash-crash mb-07 asymmetry). **22 single-day samples cannot populate that grid**, and LOW/HIGH are tails by construction of the 0.65/1.35 band — so even a favorable draw leaves the tail combinations unsampled.
- **Regime-coverage estimate — method + honest limit:** I **cannot compute empirical coverage** here (no live SPY volume; the 22 individual dates were not provided). *Method for the empirical pass:* for each of the 22 `createdAt` dates, compute SPY session-volume ÷ trailing baseline (e.g., 20-day avg), bucket by 0.65/1.35, tally LOW/NORMAL/HIGH. *Structural prior (robust to the exact definition):* NORMAL will dominate; HIGH will be a small cluster (volatility days); LOW will be rare; the **required combinations will be ~absent.** **Conclusion holds without the numbers: Phase B is synthesis-primary; real data is at best a sparse NORMAL-regime anchor.**
  - *Note:* the existing regime classifier (`discovery/audit-01b-regime-classifier.md`, `compute-daily-regime-brief.js`) is a **market/volatility** regime, **not** the volume regime (0.65/1.35); Phase B needs its own volume-regime classifier (part of the V1.1 design).
- **Transformations:** build controlled scenarios (regime × streak × edge cases) and drive them through the Phase B simulation logic (hurdle modulation, circuit breaker, mb-07). This is scenario synthesis, not data fetching.
- **Confidence:** **high** that synthesis is the right call; the real-data supplement is **low-value for tails, conditional** on the empirical coverage pull confirming the structural prior.

---

## Section 7 — Open questions, blockers, and unexpected findings

### 7.1 Needs a Flash decision
1. **Confirm Option α (C1).** Recommendation is α; please confirm so the calibration-script specs can scope the calibration-only `prefer`/`lean_away` layer (not Stream D work).
2. **Sector calibration posture:** accept that the **defensive-archetype output is α-synthesized** (the 22 real battles validate bench realism, not defensive output, §6.1)? If you want real defensive-archetype battles, that requires either deploying the new archetype to generate data (post-schema) or Option β — neither is recommended pre-launch.

### 7.2 Needs a live read (verification hand-offs — sandbox can't reach Firestore/EODHD)
3. ✅ **RESOLVED — Firestore Console spot-check of 3 `agentBattles` (`pfckrKjkPYDT9Lu18Je4`, `f3zV6mLTHkNQJF0xTN0f`, `BjRAB1CEiVjp7UkF5pOM`):** `portfolio.bench` is populated and original entry benches are sector-tagged. Two refinements folded in: `initialPortfolio` does **not** freeze bench (§1.3), and cooldown/swap-out bench entries lack a `sector` field (§1.5). Calibration must read live `portfolio.bench` and backfill (`sectorMap`) or skip un-tagged cooldown entries.
4. ✅ **RESOLVED — live count: `seasonEntries` = 4 documents** (effectively empty, consistent with built-but-not-shipped, §2.4). Not a usable calibration source at this volume.
5. **SPY cum-bar re-validation:** run one SPY intraday session through the cum-bar detector (§4.5, §6.2).
6. **Phase B regime coverage:** the 22 dates × SPY daily-volume-ratio pass (§6.3) to confirm the structural prior with real numbers.

### 7.3 Unexpected / orthogonal findings (documented, not solved — per spec §8.2)
7. **Spec ↔ codebase naming drift.** Several spec-assumed names don't exist or mean something else: `battleEvents` (none), `forgeBattles`/`forgeSeasonAgents` (none → Season Mode/`seasonEntries`), `stockRankings` (a term, not a collection), and **"Phase 8" = trade reasoning, not ranking math** (§2.5). Calibration-script specs should use the verified names/paths in this report.
8. **V4 bench discontinuity (§1.2).** If product direction is V4-forward, the bench-bearing data is a *shrinking, older* slice. Worth a product note: future bench-composition calibration may need agent-battle data specifically (which retains bench), not human V4 battles.
9. **Season Mode `sectorWeights` is a latent asset.** If Season Mode ships and accrues data, `seasonEntries` becomes the **most direct** sector-calibration source (native sector weights + vs-SPY alpha). Worth tracking for post-launch refinement.

---

## Appendix — Outcome determination (spec §6)

| Calibration | Spec outcome | Why |
|---|---|---|
| Sector | **B + C1** | Partial real data (22 enum-archetype battles) anchors; defensive-archetype output via Option-α synthesis on existing infra. |
| Volume Phase A | **Not D** (data available) | EODHD intraday SPY confirmed; usable after the documented cum-bar filter. |
| Volume Phase B | **C1 (synthesis-primary)** | Real data can't cover the regime × streak × edge grid; synthesis via existing ranking/scenario infra, no Stream D. |
| Program-level synthesis | **C1, not C2** | `computeArchetypeRankings` already implements the "ranking math"; only a small calibration-only sector layer is missing. **Launch sequence does not reopen.** |

*End of report.*
