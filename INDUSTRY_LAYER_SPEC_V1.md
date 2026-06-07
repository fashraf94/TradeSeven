# Industry Layer — Build Spec V1

**For:** Claude Code
**Date:** June 6, 2026
**Signed-off decisions (from the discovery audit review):**
- Canonical field: **`GicIndustry`** — use the already-committed `STOCK_INDUSTRIES` / `TICKER_TO_INDUSTRY` map in `rankingConfig.js`. Do **not** introduce or fetch `General.Industry`.
- Minimum industry size for rollup/ranking: **`MIN_INDUSTRY_SIZE = 4`** (a single named constant; trivially bumpable to 5 later).

---

## What we're building (and why)

The Research Engine ("Screen" tab) is industry-blind today — it filters/ranks individual stocks but can't group by industry or rank industries. Two queries failed in testing:

- "How does NVDA compare to other semis?" → answered by **Phase 1** (industry becomes a filterable dimension, so "semiconductors ranked by return" returns the peer list with NVDA in it, and Gemma narrates its standing).
- "What were the top performing industries last month?" → answered by **Phase 2** (a new industry-rollup query that ranks the industries themselves).

The taxonomy already exists: `STOCK_INDUSTRIES` (239 stocks → GICS Industry) and `TICKER_TO_INDUSTRY` were shipped in Phase 4.6 (`rankingConfig.js:92-353`, `:436-456`) and are test-locked, but only the Forge Watchlist consumes them. This feature **wires that existing map into the Research Engine** — it does not build a new taxonomy.

---

## The fence (read before writing any code)

This feature is **strictly additive**. Violating any of these is an automatic stop:

- **Never touch the calibration fence:** `decide.js`, `api/_utils/archetypeScoring`, `agentScoring`, `agentSwapExecution`, `agentArchetypeConfig`, `agentRiskManager`, `momentumScoring`, `returnCalculations`, `createAgentBattle` doc shape, `useActiveDeployments`, `useAgentBattleId`, the `hftConfig` physics engine. The new industry fields are named-field additions and are inert to `decide.js` (which reads only named fields).
- **Do not modify the existing industry map.** `STOCK_INDUSTRIES` / `TICKER_TO_INDUSTRY` / `INDUSTRY_ETFS` in `rankingConfig.js` are **read-only reuse**. The Forge Watchlist depends on them — changing them is out of scope.
- **Do not touch `RankRow` or `ReturnRow`.** The new industry rows get a **new** renderer (`IndustryRow`), mirroring `ReturnRow`'s directional pattern.
- **Backward compatible.** Existing per-stock screens must behave **identically** when the new `screenType` discriminator is absent. Default everything to the current behavior.
- **Reuse the just-merged return fields.** `return1W/1M/3M/YTD/12M` are already on every `stockEntry` (PR #468). Phase 2 aggregates those — no new return math.

---

## Process

- **One branch for the whole feature** (Phase 1 + Phase 2). The harness auto-names the branch; that's fine — rely on branch protection and confirming source→main in the PR, not the branch name.
- **Confirm starting point first:** confirm you're on the latest `main` (it contains the PR #468 period-returns merge). Re-read the anchor files below before editing — the `file:line` references are from the audit and may have drifted by a line or two; re-confirm each.
- **Hard STOP gates between phases.** Build Phase 1, STOP, report. Founder smoke-tests on the branch. Then Phase 2, STOP, report. Then `/code-review`, then founder smoke test, then one merge. **Never create a new branch per phase** — continue on the existing branch.
- `/code-review` is **mandatory** at the end (this will likely cross 10+ files / 1500+ lines once the renderer + engine + cron + prompt changes land).
- **Decline** any offer to auto-watch the PR, auto-fix CI, or auto-merge. Report and stop at each gate.
- At each STOP, produce a **one-line relayable instruction** for the founder.

---

## PHASE 1 — Industry as a screenable dimension

Goal: every stock carries its industry in the daily data, and the screener can filter by it. Unlocks "semiconductors ranked by 3-month return," "best-performing banks this month," and most of "NVDA vs semis."

### 1.1 — Cron: stamp `industryName` on each stock

`api/cron/compute-index-intelligence.js`

- Import `TICKER_TO_INDUSTRY` from `rankingConfig.js` (alongside the existing `TICKER_TO_SECTOR` import).
- In the `stockEntry` assembly where sector is stamped (audit anchor `:946-947`, `sectorId` / `sectorName`), add:
  ```
  industryName: TICKER_TO_INDUSTRY[tech.symbol] || null,
  ```
- That is the **only** cron change in Phase 1. It reads the static map — **no EODHD calls, no rank computation yet.**

### 1.2 — Engine: make `industryName` filterable

`api/_utils/screenStocks.js`

- Add `industryName` to the string-filterable field allowlist. Today `SECTOR_FIELDS` (`:178`) = `{ sectorName, sectorId }` and gets case/whitespace-insensitive matching via `canonicalizeSector` / `normalizeSectorKey` (`:181-219`), applied at `:458-459`.
- Give `industryName` the **same case/whitespace-insensitive matching** (normalize both sides using the `normalizeSectorKey`-style lowercase + strip), **but no alias table** — there is one canonical source (the GICS strings from our own map), so no "Health Care→Healthcare"-style remapping is needed. Scope the normalization to `industryName` only, the way sector normalization is scoped.
- `industryName` is a **filter** field only — it is **not** a `rankBy`/scalar field (you don't rank by a string). `rankBy` stays on the existing scalar fields (returns, scores).
- Add `industryName` to the per-result projection so it comes back on each row (mirror how `sectorName` rides along in `BASELINE_FIELDS`, `:64-66`).

### 1.3 — Gemma: teach `industryName` as a dimension

`api/_utils/voiceLayerPrompt.js` — `RESEARCH_FIELD_REFERENCE` (anchor `:2143+`)

- Add an `industryName` entry mirroring the `sectorName` pattern (`:2148`), with:
  - The **canonical valid values** — pull the exact GICS strings from `STOCK_INDUSTRIES` so the list is complete and verbatim (same "emit the exact stored string, not a variant" discipline sector uses).
  - A short **colloquial-alias hint** block mapping common user terms to the canonical GICS name, e.g.: semis/chips → "Semiconductors & Semiconductor Equipment"; pharma → "Pharmaceuticals"; biotech → "Biotechnology"; banks → "Banks"; oil & gas → "Oil, Gas & Consumable Fuels". Cover the obvious colloquialisms for the populous industries.
- Add a `screenSpec` example using `industryName` (mirror the sector example at `:2194`), e.g. filter `industryName eq "Semiconductors & Semiconductor Equipment"` + `rankBy return3M desc`.
- Keep the realized/past framing already in place — industry-filtered returns are historical, never a forecast.

**Note:** Phase 1 filtering does **not** enforce `MIN_INDUSTRY_SIZE`. If a user asks for a small industry, returning a short list is fine. The minimum-size rule applies to Phase 2 rollups only.

### Phase 1 STOP — smoke criteria (founder, on the branch)

After running the branch cron:
- Spot-check the `stockRankings` doc: `industryName` populated (NVDA → "Semiconductors & Semiconductor Equipment", AAPL → "Technology Hardware, Storage & Peripherals").
- "Show me semiconductors ranked by 3-month return" → correct industry-filtered ranked list.
- "Best performing banks this month" → correct list.
- "How does NVDA compare to other semis?" → returns the semis list with NVDA in it; Gemma narrates NVDA's position (e.g. "3rd of 10 semiconductors by 3-month return").
- Existing sector and per-stock screens unchanged.

---

## PHASE 2 — Industry rollup ("top performing industries")

Goal: rank the industries themselves. This is the one genuinely new query shape — the engine only does flat per-stock lists today.

### 2.1 — Cron: build the `industries` rollup

`api/cron/compute-index-intelligence.js`

- Add a named constant `MIN_INDUSTRY_SIZE = 4`.
- Mirror the `sectors` lookup build (anchor `:1018-1033`), but group by `TICKER_TO_INDUSTRY[symbol]` and **only include industries with ≥ `MIN_INDUSTRY_SIZE` members.**
- Each industry entry carries **median** aggregates across its member stocks (median is robust to a single outlier; mean would be skewed by one rocket):
  ```
  industries[industryName] = {
    name,                 // friendly display handled client-side; store the canonical GICS string here
    stocks: [symbols],
    totalStocks,
    return1W, return1M, return3M, returnYTD, return12M,  // median across members
    momentumScore,        // median across members
  }
  ```
- **Null handling:** when computing a horizon's median, exclude member stocks whose value for that horizon is null (thin history). If fewer than `MIN_INDUSTRY_SIZE` members have a non-null value for a horizon, that horizon's value for the industry is `null` (so it won't rank on that horizon).
- Write `industries` into the `stockRankings` doc alongside `sectors` (anchor `:1035-1046`).

### 2.2 — Engine: the rollup query path

`api/_utils/screenStocks.js`

- Add a sibling export, e.g. `screenIndustries(industries, spec)`: sort the precomputed `industries` rollup by `spec.rankBy.field` + `direction`, slice to `spec.limit`, project industry rows (`{ name, totalStocks, value, field, ... }`). Industries with `null` for the ranked field sort last (mirror the existing nulls-last discipline).
- This is small — the rollup is precomputed in the doc, so this just sorts/slices/projects.

### 2.3 — Spec discriminator + response variant

`api/_utils/voiceLayerPrompt.js` (spec schema, anchor `:2125-2129`) and `api/screener/chat.js`

- Add an **optional** `screenType` field to the screenSpec. Absent or `"stocks"` = the current per-stock path (unchanged). `"industries"` = the rollup path.
- In `chat.js` (read at `:275`, `stocks` at `:282`, `screenStocks` call at `:289`, payload at `:293-306`): if `spec.screenType === "industries"`, read `rankingsData.industries`, call `screenIndustries`, and return the payload with `resultType: "industries"`. Otherwise the existing path with `resultType: "stocks"` (default). Keep every existing payload field; add `resultType` only.

### 2.4 — Client: render industry rows

`src/components/Search/ScreenerView.jsx` + `src/components/Search/screenerAdapter.js`

- `ResultsList` currently routes via `isReturnField` → `buildRankRows` / `buildReturnRows` (`:513-574`). Add a branch: when `resultType === "industries"`, route to a new `buildIndustryRows` in the adapter and render with a **new** `IndustryRow` component.
- `IndustryRow` mirrors `ReturnRow`'s directional bar idiom (emerald-up / red-down, magnitude-scaled) for return metrics, and a neutral score bar for `momentumScore`. Columns: rank · industry name · stock count · value. **Do not modify `ReturnRow` or `RankRow`.**
- Display names: add a small `INDUSTRY_DISPLAY_NAMES` alias map in the adapter for the clunky GICS labels only (e.g. "Semiconductors & Semiconductor Equipment" → "Semiconductors", "Oil, Gas & Consumable Fuels" → "Oil & Gas"); unmapped industries render their GICS string as-is. This is display polish, not a data change.
- Tap-to-drill (tapping an industry row to see its stocks) is **deferred** — note it as a future nicety; do not build it in V1.

### 2.5 — Gemma: rollup intent

`api/_utils/voiceLayerPrompt.js`

- Teach Gemma to recognize industry-rollup intent ("top/best/worst performing industries", "which industries are leading/lagging", "rank the industries") and emit `screenType: "industries"` with `rankBy` (a return horizon or `momentumScore`) + `direction` + `limit`. No per-stock filters in a rollup query for V1.
- Add a rollup `screenSpec` example to the field reference.
- **Transparency / honesty:** only industries with ≥ `MIN_INDUSTRY_SIZE` names are ranked; Gemma should make clear it's ranking industries with enough stocks to be meaningful (small industries are excluded), and keep the realized/past framing (industries that *performed* best over the period, never *will*).

### Phase 2 STOP — smoke criteria (founder, on the branch)

After running the branch cron:
- `industries` rollup present in the doc; medians sane; only ≥4-member industries included.
- "What were the top performing industries last month?" → ranked industry list (by median 1M return), green/red bars, small industries excluded.
- "Worst industries this week" and "top industries year to date" → return **different** lists (timeframe differentiates).
- Per-stock and industry-filtered screens from Phase 1 still work.

---

## Deferred (explicitly out of scope for V1)

- **Anchor-compare polish (Phase 3):** a dedicated "NVDA highlighted with its exact standing among peers" result shape/renderer. Phase 1's filtered list + Gemma narration covers the comparison acceptably; revisit only if the list form feels insufficient after smoke-testing.
- **Sector-scoped industry rollups** ("top *tech* industries") — future add.
- **Tap-to-drill** from an industry row into its member stocks.
- **Per-sector minimum-size thresholds** — V1 uses one global `MIN_INDUSTRY_SIZE`.
- **Cost-doc reconcile** (the fundamentals 10-units-vs-1 discrepancy and the undocumented daily budget) — irrelevant to V1, which reads the static map at near-zero cost; relevant only when the later fundamental hand-off pulls live fundamentals.

---

## What this is NOT

- Not a new taxonomy — we reuse the committed `GicIndustry` map read-only.
- Not a change to the calibration fence, the existing industry map, Forge, `RankRow`, or `ReturnRow`.
- Not a `General.Industry` integration.
- Not the analysis hand-off (that's the next workstream).

**Build Phase 1, STOP, and report with a one-line relayable instruction for the founder. Do not proceed to Phase 2 until the Phase 1 smoke test passes.**
