# Archetype Rank Interface V2 — Build Spec
### V1.3 · 2026-09-01 · Author: Fable · Status: **READY FOR JOB 1 DARK BUILD** (fresh CC session; BUILD_RULES session split honored)
### Grounded in `RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md` (HEAD `bd60837`) and `ARCHETYPE_RANK_V2_PHASE0_DISCOVERY_20260901.md` (HEAD `79aa5c9`). Supersedes V1.2.

---

## Amendment ledger

**V1 → V1.1 (Sol pass 1)** · **V1.1 → V1.2 (Sol pass 2)** · **V1.2 → V1.3 (CC Phase 0, rulings P-1…P-16 below).**

| CC Phase 0 | Disposition | Where |
|---|---|---|
| C-1 return scale (R-1) | Spec error corrected; gates in signed percent | §2, §3.1, §3.3(b), §5, §6 |
| C-2 fence (R-2) | DR-13 split sanctioned; V2 in a new module; fenced diff = 3 lines | §5, §7 |
| C-3 hash locks (R-3) | Added to flip PR and §8 | §5, §8 |
| C-4 shared draft core (R-4) | Path 7b added; mode threaded | §4, §5 |
| V-3 `'mandate'` (R-5) | Removed from enum | §4 |
| C-5 blast radius (R-6) | TF `quality` and SP `dislocation` zeroed; vectors re-balanced | §3.2 |
| C-6 return shape (R-7) | `archetypeScore` blended / `archetypeBaseScore` persisted | §4 |
| C-8 subset detection (R-8, R-16) | `opts.universeSize`; Phase A may lead | §5 |
| V-10 ties (R-9) | Tie-aware percentile for `strength` | §2 |
| C-9 rounding (R-10) | Persisted-shape inputs, 1 dp, `techRaw.atrPercent` | §2, §5 |
| C-7 snapshots (R-11) | Firestore ops doc + expire-on-write; runtime captured in-window | §5, §6 |
| V-11 sectors (R-12) | Null is not a sector | §3.3(a) |
| V-7 minimums (R-13) | Pinned; **week gate redesigned** (anti-contrarian in selloffs); coverage flip gate | §3.1, §3.4, §6 |
| unknown archetype (R-14) | Throw | §4 |
| V-8 boardModel (R-15) | Explicit excluded state at flip | §5 flip PR, §8 |
| §3 extras | Ratchet baseline, prompt-honesty registry, `validSymbols` → Job 3 | §5, §8 |

---

## 0. Founder rulings (LOCKED)

**Design rulings R1–R11** (unchanged from V1.2): R1 Calm axis for Capital Preserver · R2 retire `inverseComposite` · R3 Momentum Rank feeds scoring · R4 `sectorDiversity` leaves per-stock scoring · R5 deterministic pre-model filters · R6 `compositeScore` not surfaced · R7 eval composite line deferred · R8 CSV-visible narration only · R9 `baggerBombFit` is a caller-owned mode term · R10 null excludes, never averages · R11 Capital Preserver has no sector gate.

**Phase 0 rulings (2026-09-01):**

| # | Ruling | Rationale |
|---|---|---|
| P-1 | Return gates are in **signed percent**: `return1M ≥ −25`, week gate per P-13. | `returnCalculations.js:13-15,35`: `(recent/past − 1) × 100`, 2 dp (C-1). |
| P-2 | **Fence entry sanctioned (DR-13 split).** V2 pipeline lives in `api/_utils/archetypeScoringV2.js` + `api/_utils/axisDerivation.js` (non-fenced during the dark build). The fenced diff in `archetypeScoring.js` is exactly: one import, one `opts = {}` parameter on `computeArchetypeRankings`, one dispatch line. Flag read lives in the V2 module. **At flip the V2 module joins the BUILD_RULES §1 fence list** — it is the scoring engine from that moment. | `BUILD_RULES.md:23` lists the file outright; "§7-adjacent" is not a category (C-2). |
| P-3 | Flip PR bumps `CALIBRATION_BUNDLE_VERSION` 1→2 (re-record hash) and `ARCHETYPE_IDENTITY_VERSION` 3→4 (regen snapshot). Recompile-on-next-deploy for every compiled agent build is **accepted** as the intended effect of the flip. From flip, the calibration bundle composes the **V2** weight/constraint tables. | C-3. The Mandate vintage stamp (`mandateVintage.js:103`) is traced before flip to confirm it is informational. |
| P-4 | `chooseHumanPick` / `topArchetypeFit` gain a `gameMode` parameter; training pods pass `training`, the competitive live draft passes `tournament`, the client hook passes `training`. Path 7b joins the census and test 10. | C-4. |
| P-5 | `'mandate'` is **removed** from the mode enum. Unknown mode throws. | V-3: no caller. Reserved modes invite silent misuse. |
| P-6 | Trend Follower `quality` → 0; Speculator `dislocation` → 0. Vectors re-balanced (§3.2). All other exclusions in C-5 are accepted as correct behavior. | A trend follower that excludes a name for lacking a fundamentals doc, or a speculator that excludes a fresh listing for lacking 200 bars, contradicts its own identity. |
| P-7 | V2 objects carry `archetypeScore` = **mode-blended final** (what every caller sorts and the fenced CSV renders) and `archetypeBaseScore` = base. The cron persists `archetypeBaseScore` as `arch_scores_v2`. | `agentPromptAssembly.js:249` reads `s.archetypeScore` (C-6). |
| P-8 | Subset callers pass `opts.universeSize` (from the doc's `axes_universe_size`). The scorer throws `axes_subset_unavailable` only when `stocks.length < universeSize` and any `axes` is missing; with no `universeSize` it derives over the full input and logs. Phase A may ship before Phase B. | C-8, R-16. |
| P-9 | `strength` is a **tie-aware percentile** of `technicalScore`: `100 × (countBelow + 0.5 × (countEqual − 1)) / (N − 1)`, `N = 1` → 100. | List-order ties (`ALL_TICKERS` order) are a silent alphabetical bias (V-10). |
| P-10 | `deriveAxes` reads **persisted-shape fields only** (rounded first, derived second); every axis is rounded to 1 dp; parity test asserts equality after rounding. Raw `atrPercent` is mirrored to `techRaw.atrPercent`; `volatility` is `null` when it is null. | C-9, V-2. |
| P-11 | Observation snapshots are toggled by a **Firestore ops doc** `ops/rankingSnapshots { enabled, retainDays }` read by the producer at run start (absent → off); expiry is **expire-on-write** inside the premarket run (no cron slot). Runtime baseline is captured **by the snapshots** (`elapsedSeconds` + per-stage timings). The BUILD_RULES §6 cron count (39/40) is fixed by the already-queued cleanup task, not here. | C-7, V-13, V-14. No env-toggle precedent; an env var costs a deploy per flip. |
| P-12 | Null / `'Unknown'` sector is not a sector: never satisfies "unrepresented", never counts toward the 5, placed in the fill phase only. | V-11. |
| P-13 | **Week gate redesigned:** `return1W ≥ min(0, universe_median_return1W)` — did not fall over the past week, or in a broad down week fell less than the median name. Doc-level `universe_median_return1W` is written by Phase A. Per-caller minimums pinned per V-7 (§3.4). **Flip gate:** every archetype's post-filter count ≥ 35 on every observation snapshot. | An absolute `≥ 0` gate empties the Contrarian's list in exactly the selloff week it should be shopping. `decide.js`'s fallback has no length guard (V-7); V2 does not flip while any archetype could reach it. |
| P-14 | Unknown archetype in V2 **throws**, replacing v1's silent `analyst` fallback. | `archetypeScoring.js:108`. |
| P-15 | At flip `boardModel.js` renders an explicit **"Excluded by archetype filters"** state (generic reason) instead of the `compositeScore` fallback; pod and training boards inherit it. Per-gate reason codes are not persisted in V2.0. | V-8. An R10-excluded name must never tier "Top tier". |
| P-16 | Out-of-task findings route as: #1 already queued; #2 + #3 → one non-fenced hygiene PR; #4 + #5 → §7 hygiene ticket; #6 absorbed by P-10; #7 stays pre-existing and is stated in §9. | BUILD_RULES §3. |

---

## 1. Problem in plain terms

The six archetypes score stocks on six numbers, but three are recombinations of the other three and one is a constant. Six philosophies cannot be expressed in four words: half the roster collapses into one cluster, the Contrarian buys junk, the Capital Preserver has no way to prefer calm, and the best momentum signal on the platform is never read. This spec replaces the vocabulary, not the producers.

---

## 2. The axis vocabulary

Every stock on `indexIntelligence/stockRankings` gets one additive `axes` object, produced by `deriveAxes(universe)` in `api/_utils/axisDerivation.js`. **Invariants:** every field in `axes` is a number in [0, 100] rounded to 1 dp, or `null`; `deriveAxes` consumes only persisted-shape fields; raw gate fields never live inside `axes`.

| Axis | Question | Source (persisted field) | Derivation | Null |
|---|---|---|---|---|
| `quality` | Is this a good business? | `fundamentalScore` (0–100 int, within-sector — §9) | passthrough | null if null (incl. true-zero → null, §9) |
| `strength` | Is the chart working now? | `technicalScore` | tie-aware percentile (P-9) | null if null |
| `persistence` | Will the move continue? | `momentumScore` (0–100 int) | passthrough | null if null |
| `volatility` | How big does it move? | `atrPercentile` (0–1, 2 dp) gated by `techRaw.atrPercent` | `× 100`; null when `techRaw.atrPercent` is null | |
| `calm` | mirror | — | `100 − volatility` | follows |
| `dislocation` | How beaten down? | `return1M`, `return3M`, `sma200_position` (all signed percent, 2 dp) | percentile of `0.50·pct(−return1M) + 0.30·pct(−return3M) + 0.20·pct(−sma200_position)` | null if any input null (< 200 bars ⇒ null) |
| `catalyst`, `sectorStanding` | reserved | — | always `null` in V2 | |

**Gate fields (raw, referenced by filters):** `return1W`, `return1M` (signed percent). **Doc-level fields written by Phase A:** `axes_formula_version: 1`, `axes_universe_size`, `universe_median_return1W`, `arch_scores_version`.

**Normalization facts pinned by Phase 0 (V-10):** `technicalRank` ties resolve by list order — hence P-9; `momentumScore` n = 1 → 50; `atrPercentile` `?? 0.5` fallback is dead on the normal path (≥ 50 bars retained ≥ 15 needed) — `techRaw.atrPercent` makes it honest anyway; `fundamentalScore` true-zero becomes null at write (`compute-index-intelligence.js:1117`, pre-existing).

---

## 3. The pipeline: filter → score → compose → narrate

### 3.1 Filter (deterministic, pre-model)

```
ARCHETYPE_FILTERS_V2 = {
  momentum_chaser: [],
  contrarian:      [{ axis: 'quality',   min: 35 },                 // business not broken (sector-relative)
                    { field: 'return1M', min: -25 },                // price not collapsed (signed %; config)
                    { field: 'return1W', minFn: 'weekFloor' }],     // weekFloor = min(0, universe_median_return1W)
  degen:           [],
  analyst:         [{ axis: 'quality', min: 40 }],
  diversifier:     [],
  guardian:        [{ axis: 'quality', min: 45 }, { axis: 'volatility', max: 75 }],
}
```
Filters run on the full universe before scoring. `null` on any filtered axis or field fails the filter (R10). The week floor is read from the doc-level `universe_median_return1W` (Phase A) — never computed on a subset. Both Contrarian thresholds are config and are calibrated from the observation window before flip. On intraday runs, bar 0 is the spliced live price, so both return gates re-evaluate hourly (V-10 note).

### 3.2 Score (weighted axes)

`archetypeBaseScore = Σ weight[axis] × axes[axis]`; weights non-negative, sum 1.00; clamp 0–100. **Starting values**, config, tuned during observation:

| archetype | quality | strength | persistence | volatility | calm | dislocation |
|---|---|---|---|---|---|---|
| `momentum_chaser` (Trend Follower) | — | 0.40 | **0.45** | 0.15 | — | — |
| `contrarian` (Contrarian) | **0.40** | — | 0.15 | — | — | **0.45** |
| `degen` (Speculator) | — | 0.20 | 0.20 | **0.60** | — | — |
| `analyst` (Fundamental Investor) | **0.50** | 0.30 | 0.20 | — | — | — |
| `diversifier` (Diversifier) | 0.30 | 0.30 | 0.30 | 0.10 | — | — |
| `guardian` (Capital Preserver) | **0.45** | 0.05 | 0.15 | — | **0.35** | — |

P-6 exclusion consequences, stated: Trend Follower and Speculator now exclude only on null `persistence`/`strength`/`volatility` (effectively never for a retained name). Diversifier, Contrarian, Fundamental Investor and Capital Preserver exclude names without a `peerRankings` doc — correct for archetypes that judge quality.

**Raw-weight cosines — diagnostic only:**

| | TF | CT | SP | FI | DV | CP |
|---|---|---|---|---|---|---|
| TF | 1 | 0.175 | 0.632 | 0.549 | 0.822 | 0.238 |
| CT | | 1 | 0.073 | 0.601 | 0.503 | 0.552 |
| SP | | | 1 | 0.245 | 0.513 | 0.102 |
| FI | | | | 1 | 0.920 | 0.740 |
| DV | | | | | 1 | 0.623 |
| CP | | | | | | 1 |

Was: DV↔CP 0.972, FI↔CP 0.846, FI↔DV 0.860. Diversifier overlaps everyone by design (§9). `calm`/`volatility` are anti-correlated in realized scores.

### 3.3 Compose (set-level shape)

**(a) Bounded sector interleave — pre-model, in the V2 module (Job 1). Diversifier only.**

```
ARCHETYPE_INTERLEAVE_V2 = {
  diversifier: { targetDistinctSectorsTop10: 5, maxPerSectorTop10: 2, maxInterleaveScoreGap: 10 },
}
```
1. *Eligible* = unplaced candidates whose sector has not reached `maxPerSectorTop10` in the top 10. Null / `'Unknown'` sector is never eligible for the breadth phase (P-12).
2. Breadth phase: while distinct sectors placed < 5 — `anchor` = best **eligible** unplaced candidate. Among unrepresented sectors' best eligible candidates, place the highest-scoring one with score ≥ `anchor − 10`. If none qualifies, stop the breadth phase and emit `diversifier_interleave_gap_blocked` with counts.
3. Fill phase: remaining top-10 by eligible global order (null-sector names allowed here). Below rank 10: global order, no cap.
4. Skipped candidates are never reconsidered in the breadth phase. Ties: `quality` desc, then symbol asc.

**(b) Composer gates — post-model, §7-GATED (Job 3).** Deterministic checks on the Haiku portfolio beside the slot validator (`decide.js:1102-1143`), plus: `validSymbols` (`decide.js:436`) becomes the **filtered** list so the model cannot pick an excluded name; `scanCount` (`:481`) reports the filtered count.

```
ARCHETYPE_COMPOSITION_V2 = {
  diversifier:     { distinctSectorsAcrossStockSlots: true },
  guardian:        { maxVolatilityAny: 75 },                                   // R11
  degen:           { minSlotsWithVolatilityAbove: { threshold: 80, count: 1 } },
  analyst:         { minQualityAny: 40 },                                      // assertion
  contrarian:      { minQualityAny: 35, minReturn1MAny: -25, minReturn1WAny: 'weekFloor' },   // assertions
  momentum_chaser: {},
}
```
On failure: one retry to Haiku naming the violation; on second failure, archetype-aware fallback from the filtered (Diversifier: interleaved) list, **with a length guard** — today's `buildFallbackPortfolio` has none (`decide.js:1145-1189`) and proceeds under-filled.

### 3.4 Null policy and per-caller minimums (R10, P-13)

A stock missing any axis the archetype weights > 0, or any filtered axis/field, is **excluded**. **Nothing is ever imputed.** The scorer returns the complete-candidates list and emits `insufficient_axis_coverage` (per-axis null counts, gate counts, archetype, caller mode) whenever the list is shorter than the caller's pinned minimum:

| Caller | Minimum | Below-minimum behavior today (Phase 0) | Under V2 |
|---|---|---|---|
| `decide.js` BaggerBomb deploy | 35 (fallback shortlist) / 15 (padding) / 9 (Haiku) | < 9 → guard-less fallback, under-filled portfolio deploys | **Flip gate: never < 35 in the window.** Explicit refuse below 9 is Job 3. |
| `scouting-board.js` | 10 | shorter board, silent | event only |
| `tournamentAgentBoards.js` | 15 | throws → deterministic fallback board | event + existing path |
| `tournamentAgentDraft.js` | 36 | short → draft may exhaust | event; watch in window |
| `tournamentBoardAutoCommit.js` | 15 | `floored` warning | event + existing path |
| `trainingLifecycle.js` / live draft | 1 | pool-head fallback, recorded | already explicit |
| `useTrainingDraft.js` | 5 | shorter/empty overlay | already explicit |

### 3.5 Narrate

`ARCHETYPE_CONSTRAINTS_V2` — every factual claim is true of the post-filter list and references only CSV-visible columns (`TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH` + fundamentals mirror). Ships in the flip PR; the V2 module is added to `PROMPT_CONTRIBUTING_MODULES` in the prompt-honesty registry at the same time (F-C).

| archetype | string |
|---|---|
| `momentum_chaser` | "ARCH ranks names by momentum persistence and chart strength. Prefer names near the top. Use the SECTOR column to notice where strength is clustering and lean into it." |
| `contrarian` | "ARCH ranks beaten-down names that clear a sector-relative quality floor, are not in a collapse (names down more than 25% on the month are excluded), and either did not fall over the past week or — in a broad down week — fell less than the median name. Do not chase high TECH scores. Prefer names near the top." |
| `degen` | "ARCH ranks names using realized volatility, persistence, and chart strength. Prefer high ATR_PCT. Fundamentals are not part of this rank." |
| `analyst` | "Every name on this list already clears your quality floor (FUND ≥ 40). ARCH ranks quality first, chart setup second. Prefer FUND above 70 and a TECH score that says the setup is working now." |
| `diversifier` | "This list is ordered for breadth near the top: the best name from each of several sectors comes first. Your shortlist must span at least 5 sectors, no sector more than twice." |
| `guardian` | "Every name on this list clears your sector-relative quality floor and your volatility cap (ATR_PCT ≤ 0.75). ARCH ranks quality and calm. Prefer names near the top. Prefer not to hold all three stocks in one sector unless the alternatives are clearly less safe." |

---

## 4. Game-mode term and return shape (R9, P-5, P-7, P-14)

`computeArchetypeRankingsV2(stocks, archetype, opts)` **requires** `opts.gameMode` ∈ `{ 'baggerBomb', 'standard', 'tournament', 'training', 'scouting' }`. Missing or unknown mode → throws `archetype_game_mode_required`. Unknown archetype → throws `archetype_unknown`. Fails closed: no automatic flag rollback; operational rollback is an explicit flag-off. Each caller's throw path is recorded in the V-5 census (all are loud: HTTP 500 or logged error; none silent).

- `'baggerBomb'`: `archetypeScore = 0.80 × archetypeBaseScore + 0.20 × baggerBombFit`; null `baggerBombFit` under this mode → excluded (R10). Stated: `baggerBombFit` is producer-imputed internally by construction (V-12); R10 governs the archetype layer only.
- Every other mode: `archetypeScore = archetypeBaseScore`.
- `GAME_MODE_BLEND_V2` is config, one entry per mode.
- **Return shape:** each object carries `archetypeScore` (blended final — sorted and rendered by every caller, including the fenced ARCH column) and `archetypeBaseScore` (base). The cron persists `archetypeBaseScore` as `arch_scores_v2` (`gameMode: 'standard'`).
- **Caller → mode (V-5 census):** `decide.js:343` → `baggerBomb` (fenced; flip PR) · `compute-index-intelligence.js:1180` → `standard` · `scouting-board.js:113` → `scouting` · `tournamentAgentBoards.js:467`, `tournamentAgentDraft.js:258`, `tournamentBoardAutoCommit.js:161` → `tournament` · `trainingLifecycle.js:275` via `training-pick` / `lobby-quickplay-training` / orchestrator sweep → `training` · same core via `liveDraftLifecycle.js:311-314,401-404` → `tournament` (P-4) · `useTrainingDraft.js:179` → `training`. Contract test pins all nine.

---

## 5. Jobs

### Job 1 — Axis block + V2 scorer (dark build, one branch, two committed phases; fresh session)

**Phase A — producer (unfenced):** `api/cron/compute-index-intelligence.js` + new `api/_utils/axisDerivation.js`
- `deriveAxes(universe)` — pure batch function; producer calls it on **persisted-shape** stock entries (after rounding, P-10). Writes `axes` per stock (`:1109-1159` shape) plus doc-level `axes_formula_version`, `axes_universe_size`, `universe_median_return1W`.
- Mirror `techRaw{ rsi, bbPercentB, distTo52wkHigh, atrPercent }` (V-2, P-10).
- Dual-write at `:1178-1188`: `arch_scores` (v1, byte-identical) **and** `arch_scores_v2` from `computeArchetypeRankingsV2(rankingStocks, k, { gameMode: 'standard' })[i].archetypeBaseScore`; write `arch_scores_version: 1`.
- **Snapshot writer (P-11):** read `ops/rankingSnapshots` at run start; when `enabled`, write `rankingSnapshots/{YYYY-MM-DD}_{runLabel}` for the premarket and last-intraday runs: as-of time, code HEAD, universe count, per-axis null counts, per-archetype post-filter counts, coverage/interleave events, `elapsedSeconds` + per-stage timings, `arch_scores`, `arch_scores_v2`, `axes`. Expire-on-write: the premarket run deletes snapshots older than `retainDays` (default 30). Absent doc → off.
- Doc-size guard: the existing `STOCK_RANKINGS_DOC_WARN_BYTES` check (`:441,1224-1231`) is the size gate; Phase 0 estimate ≈ 42% of 1 MiB after V2 (ASSUMED synthetic).

**Phase B — consumer:** new `api/_utils/archetypeScoringV2.js` (non-fenced until flip) + **sanctioned fenced diff** in `archetypeScoring.js` (P-2)
- Fenced diff, exactly: `import { maybeComputeArchetypeRankingsV2 } from './archetypeScoringV2.js';` · `computeArchetypeRankings(stocks, archetype, opts = {})` · first line of body: `const v2 = maybeComputeArchetypeRankingsV2(stocks, archetype, opts); if (v2) return v2;`. Nothing else in the file changes; flag-off byte-identity is snapshot-tested.
- V2 module: reads `ARCHETYPE_VECTORS_V2_ENABLED` (default `false`, `DARK_BY_DESIGN` entry + `// Pinned by:` pointer, V-15); returns `null` when off. Exports `computeArchetypeRankingsV2` for the cron and tests. Owns `ARCHETYPE_FILTERS_V2`, `ARCHETYPE_WEIGHTS_V2`, `ARCHETYPE_INTERLEAVE_V2`, `GAME_MODE_BLEND_V2`. Imports nothing from the fenced tables; archetype keys come from the registry. **Import-boundary ratchet:** add the new import to `archetypeImportBoundaryBaseline.json` in the same commit; extend the ratchet regex to cover `archetypeScoringV2` (§3 extras).
- Fallback (P-8): if any stock lacks `axes` — with `opts.universeSize` and `stocks.length < universeSize` → throw `axes_subset_unavailable`; otherwise derive over the full input via the same `deriveAxes` and log `axes_fallback_computed`. Never mix persisted and derived axes.
- Thread `gameMode` through `chooseHumanPick` / `topArchetypeFit` (P-4) and update every non-fenced caller in §4. The fenced `decide.js:343` call is untouched until the flip PR (v1 dispatch ignores `opts`).
- **CSV columns unchanged.**

**Tests:**
1. Per-axis derivation incl. `N = 1`, tie-aware `strength`, direction, 1-dp rounding.
2. `axes` invariant: every non-null field is a number in [0, 100]; raw gate fields never inside `axes`.
3. Null exclusion; **no code path imputes**; `insufficient_axis_coverage` fires with correct counts against each pinned minimum.
4. Filter application per archetype incl. the three Contrarian gates in percent, the week floor from the doc-level median (both up-week and down-week fixtures), and `null` failing each.
5. Bounded interleave: determinism; anchor always eligible; gap never exceeded; max-2 in top-10; gap-blocked stop + fill; null-sector never in breadth phase; skipped never reconsidered; tie rule.
6. Flag-off byte-identity snapshot of `computeArchetypeRankings` (v1 path) on a fixture.
7. Weight vectors non-negative, sum 1.00.
8. Missing `gameMode` throws; `'mandate'` throws; unknown archetype throws.
9. Persisted `arch_scores_v2` = `archetypeBaseScore` with no `baggerBombFit` contribution (hold `baggerBombFit` varying, output fixed).
10. All nine production callers have a pinned expected mode (incl. 7b).
11. Contrarian fixtures: (i) `return1W` below the week floor excluded (both an up-week and a down-week fixture); (ii) `return1M < −25` excluded; (iii) among passers, `(q90, d70, p35)` outranks `(q60, d98, p10)`.
12. Producer-path and fallback-path axes are byte-identical after rounding on the same persisted-shape universe.
13. Guardian ordering is unaffected by sector breadth.
14. Every factual claim in each narration string is asserted against the post-filter list.
15. `archetypeScore` is the blended value under `baggerBomb` and equals `archetypeBaseScore` under every other mode.
16. Existing v1 tests (`compute-index-intelligence.test.js:86-113`, `sectorDiversity :142-155`, `archetypePhase2Constants` hash lock, registry identity snapshot) **all still pass unchanged** — Job 1 adds exports only.

**Out of scope for Job 1:** any other edit to `archetypeScoring.js`; `decide.js`, `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`; constraint strings; composer gates; version bumps.

### Flip PR (§7 event) — after the observation window passes §6
- Flag → `true` + pin (behavioral: fixture universe → V2 ordering, exclusions, interleave); `flagPinGuard` enforces coupling.
- `ARCHETYPE_CONSTRAINTS_V2` replaces v1 strings; V2 module added to `PROMPT_CONTRIBUTING_MODULES`.
- Explicit `{ gameMode: 'baggerBomb' }` at `decide.js:343` (V-16); v1 math and v1 tests removed from `archetypeScoring.js`; **`archetypeScoringV2.js` added to the BUILD_RULES §1 fence list** (P-2).
- `CALIBRATION_BUNDLE_VERSION` 1→2 with the bundle composing V2 tables, hash re-recorded; `ARCHETYPE_IDENTITY_VERSION` 3→4, snapshot regenerated via `GENERATE_REGISTRY_SNAPSHOT=1`; identity pin `archetypeRegistry.test.js:82-85` re-pointed; `leagueTournament.test.js` keys pin survives (six keys kept) (P-3).
- `arch_scores` values switch to V2, `arch_scores_version: 2`; producer test `:100-113` replaced (keys may be missing under R10); `boardModel.js` excluded state (P-15).
- Mandate vintage stamp traced (P-3). Stale-comment hygiene for the four "non-fenced" comments may ride this PR since it already touches the fence.

### Job 3 — Composer gates (§7-GATED, separate branch, after flip has run ≥ 5 market days)
`decide.js`: §3.3(b) gates, archetype-aware fallback **with a length guard and explicit refuse below 9**, `validSymbols` = filtered list, `scanCount` = filtered count. Own Phase 0 first: validator/fallback contracts, retry budget, tournament-path equivalents.

### Queued separately
- `marketContext` sector join → `sectorStanding` axis (R8).
- Composite `fundamentalScore` line in mid-battle eval (R7, §7).
- V2.1: Contrarian stabilization from `techRaw` (RSI < 35 and turning up; %B re-entry); `pillars`/`fundRaw` mirror for a `financialHealth` term (V-4); CSV column exposure (§7).
- Hygiene per P-16; the five F14 items from the first audit.
- Consolidation post-flip: callers read persisted `arch_scores`.

---

## 6. Observation window and acceptance

**Capture.** ≥ 5 market days with `ops/rankingSnapshots.enabled = true`: premarket + last-intraday snapshot per day. Fable evaluates across the full set.

**Gates (hard):**

| Gate | Requirement |
|---|---|
| Coverage (P-13) | Every archetype's post-filter count ≥ 35 on every snapshot; `insufficient_axis_coverage` never fires for a production caller on a normal day; per-axis null counts stable day to day. |
| Lead-axis lift | Non-Diversifier archetypes: top-10 median of the lead axis exceeds the universe median by ≥ 20 points on every closing snapshot (TF→persistence, CT→dislocation, SP→volatility, FI→quality, CP→calm). Initial hard target; founder-calibrated from the window before flip. |
| Contrarian second leg | Top-10 median `quality` ≥ 45; every top-10 name satisfies all three gates, every snapshot. |
| Guardian safety | Top-10 median `volatility` ≤ 40, every snapshot. |
| Diversifier composition | Top-10 spans ≥ 5 sectors, no sector > 2; `gap_blocked` frequency reported. |
| Stability | Top-10 membership changes ≤ 4 names between consecutive closing snapshots absent a regime event (diagnostic). |
| Runtime / size | V2 adds ≤ 5 s to producer p95 relative to the window's own first-day baseline; p95 ≤ 180 s (60% of `maxDuration: 300`); `STOCK_RANKINGS_DOC_WARN_BYTES` never trips. |

**Diagnostics:** pairwise Spearman and top-10 Jaccard, v1 vs v2; per-day week-floor value and Contrarian pass count.

**Founder smoke after flip:** one agent per archetype in a training battle. No two archetypes share more than 3 of 7 stock picks; Diversifier spans 3 sectors across its stock slots.

**Rollback:** explicit flag-off restores v1 during the window.

---

## 7. Fence routing (corrected per Phase 0)

| Change | File | Status |
|---|---|---|
| `axes`, `techRaw`, dual-write, snapshots, doc-level fields | `compute-index-intelligence.js`, `axisDerivation.js` | unfenced |
| V2 pipeline, config tables, flag read | `archetypeScoringV2.js` | unfenced during dark build; **joins §1 at flip** |
| Import + `opts` param + dispatch line | `archetypeScoring.js` | **§1 fenced — sanctioned entry P-2 (Job 1)** |
| Mode threading in draft core and non-fenced callers | `trainingLifecycle.js`, `liveDraftLifecycle.js`, tournament utils, `scouting-board.js`, `useTrainingDraft.js` | unfenced |
| Explicit `gameMode` at `decide.js:343`; v1 removal | `decide.js`, `archetypeScoring.js` | **§7; flip PR** |
| Constraint strings; honesty registry | `agentPromptAssembly.js:38-40`, `tournamentAgentBoards.js:126-127`, `promptHonestyRegistry.js` | **§7; flip PR** |
| Version bumps, snapshot regen, identity pin | `archetypeVersionConstants.js`, `docs/registry-snapshots/`, tests | flip PR (not fenced files; cross-agent effect stated) |
| Composer gates, fallback guard, `validSymbols`, `scanCount` | `decide.js:436,481,1102-1189` | **§7; Job 3** |
| CSV column exposure | `agentPromptAssembly.js:242` | **§7; V2.1** |

---

## 8. Contract changes

- `stockRankings.stocks[].axes`, `.techRaw` — new, additive. Doc-level `axes_formula_version`, `axes_universe_size`, `universe_median_return1W`, `arch_scores_version` — new.
- `arch_scores_v2` — new during observation. At flip `arch_scores` = V2 base scores, keys may be absent (R10), `arch_scores_version: 2`. Readers (V-8): server screener, voice prose, client screener adapter are V2-safe as-is; `boardModel.js` changes (P-15); producer test `:100-113` replaced. No reader remains on V1 semantics.
- `computeArchetypeRankings(stocks, archetype, opts = {})` — third parameter added (fenced, sanctioned); V2 requires `opts.gameMode`; subset callers pass `opts.universeSize`.
- V2 object shape: `archetypeScore` (blended), `archetypeBaseScore` (base) — P-7.
- `CALIBRATION_BUNDLE_VERSION` 1→2 and `ARCHETYPE_IDENTITY_VERSION` 3→4 at flip; every compiled agent build recompiles on its next deploy (P-3).
- `ARCHETYPE_WEIGHTS` (v1) retired at flip; `archetypeRegistry.js:54,154` and `calibrationBundle.js:25,49` move to the V2 tables.
- Six `ARCHETYPE_DEF_*` files: one-line "live-wire basis" update at flip; `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md:16` becomes true at flip.
- New collection `rankingSnapshots` and ops doc `ops/rankingSnapshots` (P-11); Firestore rules must deny client reads/writes to both (Phase A).

---

## 9. Known limits (stated, not hidden)

- **Quality is within-sector.** "quality ≥ 40" means "not the bottom 40% of its sector." Absolute quality is a producer follow-up.
- **`fundamentalScore` true-zero becomes null at write** (`compute-index-intelligence.js:1117`, pre-existing). A genuine 0 composite is excluded as "no data" by quality-weighting archetypes. Changing it moves fenced scores; not this arc.
- **Diversifier is compositional.** Do not "fix" its cosine.
- **The week gate is market-relative in down weeks.** In a broad selloff a name that fell less than the median passes; V2.0 does not deterministically catch every dead-cat bounce. Collapses (`return1M < −25`) are excluded. V2.1 adds RSI/%B stabilization.
- **`baggerBombFit` imputes internally** (missing pillars re-weighted, missing fund → 50, V-12). R10 governs the archetype layer, not the producer's game-mode term.
- **Calm is a mirror.** CP vs SP realized scores are anti-correlated by construction.
- **Guardian concentration is unenforced** (R11).
- **Runtime baseline is unmeasured today** (V-13); the window supplies it.

---

## 10. Job 1 handoff

**Seed set for the fresh CC session:** this spec (V1.3), `ARCHETYPE_RANK_V2_PHASE0_DISCOVERY_20260901.md`, `RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md`, BUILD_RULES. Git verification with HARD STOP before modification (fetch, HEAD = `origin/main`, clean tree). One branch for Job 1; Phase A committed before Phase B begins. `/code-review` at ≥ 10 files or ≥ 1,500 lines. **The only fenced edit permitted is the three-line diff in P-2**; anything else that appears to require fence contact is a STOP and a report, not a workaround. CC never merges, never watches CI; founder smoke → manual merge → observation window → flip PR (separate).
