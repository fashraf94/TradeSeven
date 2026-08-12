# Doug Universe Expansion — Build Report

**Date:** 2026-08-12 · **Branch:** `claude/doug-universe-expansion-5w3ryj` · **Base:** `origin/main` @ `fe4f8668`
**Preceded by:** the discovery-lite report (delivered as a file to the founder; HARD STOP, rulings received).
**Scope:** cumulative branch diff = **12 files, +424 / −70 lines** (across two commits — the build, then the §2 review fixes). ≥10 files → BUILD_RULES §2 adversarial review MANDATORY (recorded in §7 below).

Widen Doug's earnings/recap universe from 20 to a curated ~66 names spanning all 11 GICS sectors, so S5 (earnings recap) produces stories most weeks of earnings season instead of only during the mega-cap-tech cluster — making it a reliable contributing shape for the §5 editorial floor.

---

## §1 — Executive summary: rulings → what shipped

| Founder ruling | Shipped | Where |
|---|---|---|
| **Width:** take the curated ~60 from the 239 stocks; sector spread > count | `TICKERS` widened 20 → **66**, all 11 sectors, ordered ~market-cap descending. Verified ⊆ `ALL_TICKERS` (239) and ⊆ `TICKER_TO_SECTOR` (so every name passes `isInWireUniverse`) | `api/_utils/stockIntelligenceData.js:24` |
| **analysis.js:** guard the Tier-1 predicate (final form per §8-8 ruling c) | `isTier1 = !!STOCK_DATA[upper]` alone — deep-data membership, independent of `TICKERS`. New names without deep data → Tier-2 brief (no 500); BX/PNC/ALLY keep Tier-1. Now-unused `TICKERS` import dropped | `api/stocks/analysis.js:14,255` |
| **BX/PNC/ALLY:** drop them (keep single-axis) | Dropped from `TICKERS` (still in `STOCK_DATA`, harmless). No `STOCK_UNIVERSE`/`TICKER_TO_SECTOR` change → **no dual-bump** | `stockIntelligenceData.js:24` |
| **Caps:** market-cap/curation-rank for previews (~15–20/run); surprise-first for recaps | Preview: `PREVIEW_MAX_PER_RUN=18`, curation-rank sort + slice. Recap: surprise-first order | `submit-earnings-batch.js:26,166`; `generate-recap.js:88,318` |
| **Throughput (the real ruling):** more capacity, founder-visible daily ceiling, surprise-first so dropped = least newsworthy | Recap now writes up to `RECAP_MAX_STORIES_PER_FIRING=4`/firing under a founder-tunable `RECAP_DAILY_STORY_CEILING=12`/ET-day, surprise-first | `generate-recap.js:88-90` |
| **5 residual defects → register** | Registered in §8 (not fixed here, per BUILD_RULES §3) | §8 |
| **Decoupling as a register item if better long-term** | Registered in §8 (item D) | §8 |

**Founder-tunable knobs (all exported constants, one-line edits):**
- `RECAP_DAILY_STORY_CEILING = 12` — max recaps published per ET trading day (`generate-recap.js:89`).
- `RECAP_MAX_STORIES_PER_FIRING = 4` — per-firing safety bound under `maxDuration:60` (`generate-recap.js:90`).
- `PREVIEW_MAX_PER_RUN = 18` — max earnings previews submitted per nightly batch (`submit-earnings-batch.js:36`).

---

## §2 — Change map (file:line)

| File | Change | On generation surface? |
|---|---|---|
| `api/_utils/stockIntelligenceData.js` | `TICKERS` 20→66 (+ curation-rank comment); header explains the TICKERS⊋STOCK_DATA split; `getStockContext` error now lists `Object.keys(STOCK_DATA)` (honest) | **Yes** (file-content hash) |
| `scripts/buildStockData.js` | Generator split: `DEEP_DATA_TICKERS` (20, builds `STOCK_DATA`) vs `RECAP_UNIVERSE` (66, emitted as `TICKERS`); summaries iterate the deep set; emitted header/error updated | No (dev tool) |
| `api/stocks/analysis.js` | `STOCK_DATA` import (dropped now-unused `TICKERS`); Tier-1 guard `isTier1 = !!STOCK_DATA[upper]` (§8-8 ruling c) | No |
| `api/fantasytimes/submit-earnings-batch.js` | `PREVIEW_MAX_PER_RUN`; curation-rank sort + `.slice` of `qualifyingEarnings` → `cappedEarnings`; loop + `symbols` use the capped set (also fixes the per-name sequential-fetch `maxDuration:60` risk) | **Yes** |
| `api/fantasytimes/generate-recap.js` | Surprise-first `recapNewsworthiness` sort; daily-ceiling count + per-firing budget; single-pick → bounded multi-story loop (generation block kept byte-identical); one `outcome=` line/firing carrying `stories=N`; list response `{count, stories[]}` | **Yes** |
| `api/_utils/wireContracts.js` | `WIRE_GENERATION_VERSION` 18 → **19** + v19 changelog | **Yes** (version source) |
| `api/_utils/wireGenerationBaseline.json` | Regenerated (3 changed surface files' hashes + version:19); value-locks unchanged | (the baseline) |
| `firestore.indexes.json` | New composite index `fantasyTimesStories(type ASC, publishedAt ASC)` for the daily-ceiling count | No |
| 3× `generate-recap.*.test.js` | Reconciled to the list response shape + the 2-reporter→2-story behavior (mutation-checked — see §7) | No |

---

## §3 — Flag posture / dark-merge guarantee

- **`WIRE_WRITES_ENABLED = false`** in production (`featureFlags.js`) — the current pre-runway regime. This change **does not flip any flag** and does not alter reporter-request BYTES for any given story (the recap `userMessage` assembly is byte-identical; the preview prompt per name is unchanged). It changes **which/how-many** stories Doug writes, not the per-story request. M8 (reporter-request byte integrity) intact.
- The generation-surface content lock still fires on any file diff, so the `WIRE_GENERATION_VERSION` bump is mechanically forced regardless — done (18→19). Free pre-runway: the epoch reset is a no-op until the gate window opens.

## §4 — Version / surface impact (single-axis, as discovery predicted)

- `WIRE_GENERATION_VERSION` **18 → 20** + baseline regen (19 at the build; 20 after the §8-8 ruling's one-line honest-comment edit to the `stockIntelligenceData.js` header). Validated end-to-end each time: the surface lock went **RED** before regen and **GREEN** after (`WIRE_GENERATION_BASELINE_REGEN=1 …`). The functional changes are `stockIntelligenceData.js`, `submit-earnings-batch.js`, `generate-recap.js`; `wireContracts.js` moves mechanically (it hosts the bumped constant). Independently recomputed by the review (all hashes match; no value-lock changed; no dual-bump).
- **No dual-bump.** `TICKER_TO_SECTOR` / `ALL_TICKERS` untouched (they derive from `STOCK_UNIVERSE`, not `TICKERS`), so `assessTickerUniverseCaveat` does not fire — `WIRE_VALIDATOR_VERSION` (1.6.0) and `WIRE_DIGEST_RENDERER_VERSION` (1.0.0) stay put. This is exactly why the widened set was constrained to a subset of the existing 239 and why BX/PNC/ALLY were dropped.

## §5 — Deploy note (crons don't run on preview; §6)

- **Firestore composite index** `fantasyTimesStories(type, publishedAt)` must deploy (`firebase deploy --only firestore:indexes`) for the daily ceiling to bind. **Fail-safe until then:** the count query is wrapped in try/catch → on error `publishedToday=0` → the ceiling degrades OPEN to the per-firing bound (`4/firing × 5 firings = 20/day` capacity), never closed. So an un-deployed index means *more* coverage, not lost stories.
- Verification = unit tests on the guard logic (below) + observation of the first production runs (recap fires 5×/weekday; batch 1×/weekday). No new cron entries added (§6 budget untouched — the extra capacity rides existing firings).

## §6 — Test + build results

- **Full suite: 7527 passed, 0 failed, 60 skipped** (452 files).
- **`vite build`: success** (§2 — catches App.jsx-class syntax errors no test imports; pre-existing chunk-size warning only).
- Surface lock: RED-before / GREEN-after regen (mechanism validated). `rankingConfig` (ALL_TICKERS=239) + `flagPinGuard` green. The 3 recap suites green after reconciliation (28 tests).

## §7 — BUILD_RULES §2 adversarial review (≥10 files)

Multi-lens, independently-refuted review across 3 dimensions (recap-throughput correctness; TICKERS-widening consumers; surface/version + test integrity). Each finding was handed to a refutation pass; CONFIRMED = survived a concrete-repro refutation, REFUTED = did not.

Three independent finder agents (recap-throughput correctness; TICKERS-widening consumers; surface/version + test integrity), each self-refuting with concrete repros. `vite build` ✅. **No CONFIRMED blocking issue remains unaddressed.** Findings and dispositions:

| # | Dimension | Finding | Sev | Disposition |
|---|---|---|---|---|
| A1 | recap-throughput | A hard throw (`wireModelCall`/`publishStoryWithWire`/`recordWireSample`) mid-loop aborted the firing → HTTP 500 + **zero `outcome=` lines** even though earlier stories persisted (worse than pre-diff, which logged the outcome before those calls) | **MED** | **FIXED** — per-candidate `try/catch`→`continue`; story counted into `written` the instant it persists (`generate-recap.js:352-601`) |
| A2 | recap-throughput | Budget bounded *successes* not *attempts* → a run of soft `no-tool_use` skips could reach 8 Haiku calls and blow `maxDuration:60` | LOW-MED | **FIXED** — loop now breaks on `attempts >= firingBudget` |
| A3 | recap-throughput | Degrade-open silently unenforces the daily ceiling until the new composite index finishes building (≤20/day during the window) | LOW-MED | **ACCEPTED** (fail-safe direction, bounded, self-heals) — deploy note strengthened (§5); registered §8-6 |
| A4 | recap-throughput | Surprise-first "dropped = least newsworthy" is guaranteed *within a firing*, best-effort *across the ET day* under streaming actual arrivals | LOW | **REGISTERED** §8-7 (inherent to hard-ceiling + streaming) |
| A5 | recap-throughput | count-query vs `covered`-set filter mismatch (same-day supersede) | LOW | **REFUTED** for prod — handler never supersedes same-day; one story doc per recap |
| B1 | TICKERS consumers | Header comments claimed "STOCK_DATA ⊆ TICKERS" / "RECAP_UNIVERSE ⊇ DEEP_DATA" — **false** (BX/PNC/ALLY); could invite deleting the load-bearing guard | LOW | **FIXED** — comments corrected in both files |
| B2 | TICKERS consumers | Dropping BX/PNC/ALLY from `TICKERS` also demotes their *stock-analysis* Tier-1→Tier-2 and drops them from mover/column deep-context | LOW-MED | **FOUNDER DECISION** — registered §8-8 (accept + prune the 3 dead bundles, or guard on `!!STOCK_DATA[x]` alone) |
| B3 | TICKERS consumers | Preview starvation for lowest-rank names under a binding cap | LOW | **REFUTED** — acknowledged bounded tradeoff, 6-night window, dedup frees slots |
| C1 | surface/version | All 28 surface hashes recomputed independently: 0 mismatch; exactly the right 4 per-file hashes moved; no dual-bump; no value-lock changed | — | **CONFIRMED CLEAN** |
| C2 | test integrity | 6 reconciled assertions empirically mutation-tested — none weakened; each still fails under a wrong-story/wrong-count regression | — | **CONFIRMED CLEAN** |
| C3 | test integrity | The founder-ruled surprise-first **drop** property had **zero** coverage (all prior scenarios feed ≤2 candidates < budget) | LOW-MOD | **FIXED** — added a 6-candidate/budget-4 drop test with shuffled input; **mutation-verified** (fails when the sort is reversed *or removed*) |
| C4 | surface/version | Changelog said "three surface members change content" while four hashes moved | INFO | **FIXED** — changelog now names the 4th (`wireContracts.js` itself, mechanical) |

**Mutation evidence (§2 "a row that cannot fail is not a guard"):** the new drop test — with input rows deliberately shuffled out of surprise order — was run against a reversed comparator and **failed** (`['META','AMZN','MSFT','GOOGL'] ≠ ['NVDA','AAPL','GOOGL','MSFT']`); restored, it passes. The reconciled ordering/count/dedup assertions were independently mutation-tested by the reviewer (single-story regression → `count===2` fails; reversed sort → `stories[0]` fails; broken dedup → AMZN/AAPL swap fails).

**Note — no feature flag.** The multi-story loop ships ON (the recap handler writes story docs regardless of `WIRE_WRITES_ENABLED`, which gates only the wire envelope). The founder-tunable constant **is** the revert lever: `RECAP_MAX_STORIES_PER_FIRING = 1` restores the pre-expansion one-story-per-firing behavior with no code change.

## §8 — Residual defects registered for separate tasking (BUILD_RULES §3 — not fixed here)

1. **Dead drifted copy** — `src/data/stockIntelligenceData.js` is a stale 10-name copy of the api/_utils constant (no runtime importer of its `TICKERS`). Copy-proliferation risk.
2. **`ai-advisor.js:31` hardcoded universe** — a 15-name prompt string already disagreeing with `TICKERS`; widening drifts it further. Not wired to the constant.
3. **Recap ordering was arbitrary pre-change** — provider-order pick (now fixed to surprise-first as part of this build; the *general* "no canonical ticker universe / six divergent lists" fragmentation remains — see the Wire Phase-0 discovery register).
4. **`submit-earnings-batch.js` sequential per-name `fetchEarningsHistory`** under `maxDuration:60` — mitigated by the preview cap (bounds the loop), but the underlying sequential-fetch pattern remains a latent timeout risk at large caps; consider parallelizing/`Promise.all` with a concurrency limit.
5. **EODHD earnings-calendar has no `country=US`/`symbols=` filter** (~3,531 global rows/fetch). Universe-independent, so expansion does not worsen it; `symbols=` is already used at `api/cron/compute-estimates.js:176` — a cheap correctness cleanup when convenient.
6. **Daily-ceiling index deploy window (review A3).** Between the code deploy and the `fantasyTimesStories(type, publishedAt)` index finishing its build, the count query throws `FAILED_PRECONDITION` → degrades open → up to 20 recaps/day (vs the 12 ceiling) until the index is live. Bounded, fail-safe, self-healing. Optional hardening: an explicit degraded-open alert distinguishing it from normal operation (only a `logError` today).
7. **Surprise-first drop is per-firing, not per-day (review A4).** Under streaming actual arrivals, a high-surprise name posting late can be dropped if earlier lower-surprise names already consumed the daily ceiling. Inherent to hard-ceiling + streaming; the per-firing guarantee is tested. Mitigation if it matters: raise `RECAP_DAILY_STORY_CEILING`, or reserve slots for late high-surprise arrivals.
8. **BX/PNC/ALLY deep-context demotion (review B2) — RESOLVED, founder ruled option (c).** The `analysis.js` Tier-1 guard is now `isTier1 = !!STOCK_DATA[upper]` alone (deep-data membership, independent of `TICKERS`), so BX/PNC/ALLY keep their Tier-1 knowledge-package analysis, and the 3 `STOCK_DATA` bundles are retained (not pruned). Widened `TICKERS` names without deep data still take the Tier-2 brief (no 500). `generate-mover` / `generate-column` stay on the `TICKERS.includes` gate per the ruling (BX/PNC/ALLY get no mover/column enrichment — acceptable, guarded). The now-unused `TICKERS` import was dropped from `analysis.js`. This forced a `WIRE_GENERATION_VERSION` **19 → 20** bump — *only* because the one-line guard reference in `stockIntelligenceData.js`'s header (a surface member) was updated to stay honest; `analysis.js` itself is not a surface member.

**D. Decoupling (founder-flagged as a possible better long-term shape):** `TICKERS` currently does double duty — the earnings/recap universe AND the Tier-1 deep-context set — reconciled here by the `analysis.js` guard. A cleaner long-term shape is a dedicated `RECAP_UNIVERSE`/earnings constant separate from the `STOCK_DATA`/Tier-1 set (the generator already models this split via `DEEP_DATA_TICKERS` vs `RECAP_UNIVERSE`). Registered per the founder's ruling ("file the decoupling as a register item if you think it's the better long-term shape") — recommended when a second consumer needs the distinction.
