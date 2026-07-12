# LevelStory S5.5 — RVOL Null Diagnosis + Universe Discovery

**Type:** DISCOVERY / DIAGNOSIS (read-only). No build, no fix, no config change, no refetch of the existing universe.
**Author session:** claude-code, 2026-07-12.
**Rule:** Nothing is decided here. Every finding is a finding; every founder decision is listed in §Open Questions.

---

## 0. Preamble (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | **Run first, exit 0** (new refs: `ui-redesign`, `ui-redesign-backup`, tag `backup-with-research`). Recorded per BUILD_RULES §3. |
| Branch | `claude/rvol-null-diagnosis-p9u4fw` (the session's designated branch). |
| HEAD | `fbc60c1b` — *Merge PR #603 (S5 feature layer)*; `= origin/main` (0 ahead / 0 behind). |
| Tree | Clean except new untracked `discovery/` + `docs/discovery/` outputs from this session. |
| `origin/main` has S5? | **Yes** — `research/level-study/04-features.js` present (blob `718c564`); S4/S4.1/S5 merged. |
| Branch-name note | The S5.5 prompt's preflight named `claude/level-study-s5-5-diagnosis`; the session's **designated** branch is `claude/rvol-null-diagnosis-p9u4fw` (cut from `origin/main`). Developed there per the standing branch requirement. Flagging the discrepancy, not relitigating it. |

**Data present?** **NO.** `research/level-study/data/` is git-ignored (`.gitignore:83`, *"data is NEVER committed… multi-GB"*) and absent in this fresh clone. Therefore:

- **Job A — cross-tab (A2.1): FOUNDER-LOCAL.** Needs the feature/event artifacts. The **code trace (A2.2), cause evaluation (A2.3), and P3 consequence (A2.4) are complete from source** and are the substance of the diagnosis. A ready-to-run cross-tab script is delivered (`discovery/rvol-null-crosstab.mjs`).
- **Job B — repo search: COMPLETE** (the universe lives in code, in-scope). **R2 daily-fetch sweep (B3): FOUNDER-LOCAL** — no `VITE_EODHD_API_KEY` in env **and** `eodhd.com` is blocked by the agent proxy (`CONNECT` tunnel → HTTP 403). One command provided.

**Test suite:** `npm test` in `research/level-study` → **131 tests, 91 pass / 40 fail.** All 40 failures are `Missing data/normalized/… — run npm run fetch first` (data-absence), **zero source regressions**. The 91 passing tests are the synthetic-fixture logic tests (incl. `tests/29` rvol null-determinism, `tests/27` intraday) — i.e., the trace below is against green, unmodified S5 code.

---

## 1. Executive verdict

| # | Finding | Verdict |
|---|---|---|
| A | **The one-line cause.** `rvol_approach` is null whenever a touch/break lands on the session's **first 5-minute bar (09:30 ET)** so there are zero pre-touch bars (`features-intraday.js:91`). This is **forced for every `GAP_BREAK` event** (which always uses `five.regular[0]` as its bar, `events.js:449,454`) and occurs for every touch whose episode **opens on the 09:30 bar** (gap-toward-level opens). | **CONFIRMED (code)** |
| A | **Candidate cause #2 (minimum pre-touch window): RULED OUT.** There is no min-bar/min-minute gate on RVOL beyond `preBars.length ≥ 1`. A single pre-touch bar computes it. | **RULED OUT** |
| A | **Candidate cause #1 (5-min baseline spin-up, `features-intraday.js:52`): real but bounded ≈ 2.7%.** 5m data spans the full window (`intradayFetchStart == studyStart`), so under-fill is only the first ~20 sessions. | **CONFIRMED, minor** |
| A | **Candidate cause #3 (tod-matched baseline gaps, `:56` `avg==0`): effectively unreachable** for regular-session touches. `atr==null` disjunct: structurally ~0%. | **NOT a driver** |
| A | **What P3 is silently conditioned on** | *"RVOL vs clean_bounce, **conditional on the touch not opening on the session's first 5-minute bar (09:30 ET)**"* — see §2.4. **But** the headline 28–35% overstates P3's exposure (it mixes in `GAP_BREAK`, which P3 excludes). |
| B | **The existing universe** | `api/_utils/rankingConfig.js` → **`STOCK_UNIVERSE` / `ALL_TICKERS` = 239 tickers**, 11 SPDR-mapped GICS sectors, curated + regression-guarded. **Recommended basis.** |
| B | **Per-sector members (of 239)** | XLK 28 · XLV 22 · XLF 23 · XLE 19 · XLY 22 · XLP 22 · XLI 23 · XLB 20 · XLU 20 · XLRE 20 · XLC 20. **All 11 ≫ peer floor of 5** → expansion switches Addendum Layer 1 on for every sector (pre-R2). |
| B | **R2 sweep** | Founder-local (no key/network). Preliminary suspect flags: `CRWV, GEV, CEG, RKLB, HOOD` (likely R2 FAIL); `DKNG, RKLB` (de-SPAC shell — the RKLB/DKNG lesson). |
| B | **Expansion cost** | ≈ **758 API calls (~0.76% of the 100K/day cap, ~130× headroom)**; ~10–20 min wall-clock. **Disk (~tens of GB for 5m) is the binding constraint**, not the budget. |

---

# JOB A — THE RVOL NULL DIAGNOSIS

## A2.2 — The code trace (every null branch, file:line)

`rvol_approach` is written in exactly one place — `lib/features.js:99` `out.rvol_approach = rvolApproach(pre, touchEtMin, baselineSessions)` — and initialised to `null` at `lib/features-intraday.js:81`. It becomes/stays null via three reachable branches (plus two defensive ones and three upstream feeders):

| # | Site | Condition | Reachable on the assembly path? |
|---|---|---|---|
| **(1)** | `features-intraday.js:91` | `if (!pre.length \|\| atr == null) return out;` — returns the all-null init object; `rvolApproach()` is never even called. | **YES — the dominant driver.** `!pre.length` ⟺ no bar with `etMinutes < touchEtMin` ⟺ touch on the **first 5m bar (etMinutes 570 = 09:30)**. `atr==null` ⟺ structurally ~never (below). |
| **(4)** | `features-intraday.js:52` | `… \|\| baselineSessions.length < RVOL_DAYS` (`RVOL_DAYS = 20`, `:19`; baseline built at `features.js:154-157`). | **YES — bounded ~2.7%** (spin-up; below). |
| **(5)** | `features-intraday.js:56` | `return avg > 0 ? own / avg : null;` — null when the tod-matched baseline avg is 0. | **~UNREACHABLE** for regular touches (below). |
| (2)(3) | `features-intraday.js:52` | `!preBars.length` / `!baselineSessions` disjuncts. | **NO** — defensive; `:91` already screens empty `pre`, and `features.js:153-157` always supplies an array. |
| feeder | `features.js:143` | `sessionBars = five ? five.regular : []` → empty if the event date has no 5m session. | **Structurally unreachable** — events are 5m-detected; every `eventDate` has a non-empty 5m session (a genuinely missing date would *throw* at `features.js:124/141`, crashing the symbol, not null one feature). |
| feeder | `features.js:160` | `atrDaily: event.atrDaily` → the `atr==null` disjunct of (1). | ~0% (below). |

**Cascade:** `features.js:163` `intra.rvol_bucket = rvolBucket(intra.rvol_approach)`, and `rvolBucket(null) = null` (`features-intraday.js:69`). So every null `rvol_approach` → null `rvol_bucket` → tallied under `<side>.null_rvol` at `04-features.js:111`. The **headline "28.4–35.1%"** is printed at `04-features.js:249` from `nullRates(rows)` (`:79-89`), computed over **all rows for the symbol = all dispositions.**

### Why (1) is the dominant driver — by elimination

- **(5) `avg==0`** needs `touchEtMin ≤ 570` (all 20 baselines have no bar before the cutoff). But `touchEtMin == 570` is the first-bar case already caught by **(1)**. Regular sessions start at 570, so a real *later* touch always sees positive baseline volume. → **~0%.**
- **(4) baseline `< 20`** is bounded: `intradayFetchStart = '2023-07-10' == studyStart` (`config.js:114`), and the fetcher chunks + concatenates the **whole 3-year window** (the 600-day cap is a per-call span limit, not a lookback horizon — `eodhd-client.js:176-200`). So only the **first ~20 5m sessions** under-fill → **≈ 20/750 ≈ 2.7%.**
- **`atr==null`** disjunct of (1): the level registry emits sessions only from `ATR_PERIOD` onward (`02-build-levels.js:76`) and daily history starts 2018 (`config.js:113`), so `event.atrDaily` is **structurally never null** in the study window. → **~0%.**
- **Residual:** `28–35% − ~3% − ~0% ≈ 25–32%` must be **(1) `!pre.length`** — first-bar (09:30) touches and breaks. This is a *deduction* the founder should confirm empirically with the cross-tab (below).

## A2.1 — The cross-tab (FOUNDER-LOCAL; script delivered)

Data is absent, so the numbers can't be printed here. **`discovery/rvol-null-crosstab.mjs`** produces the full A2.1 breakdown in one command (after `npm run features`):

```
node discovery/rvol-null-crosstab.mjs
```

It reads only the git-ignored artifacts (`data/features/{sym}.json`, `data/events/{sym}.json`, joined by `eventId`), imports nothing from study/product code, and **splits every null into its cause using a discriminator available in the feature row itself:**

> `dist_from_session_extreme` is computed **unconditionally** once `intradayFeatures()` passes its line-91 guard (`features-intraday.js:169-171`). So for a row with `rvol_approach == null`:
> - `dist_from_session_extreme == null` ⇒ the **line-91 (no-pre-bar) cluster** — first-bar/09:30 touch or `GAP_BREAK`.
> - `dist_from_session_extreme != null` ⇒ the **line-52 baseline (spin-up) cluster**.

It cross-tabs the null rate by **`tod_bucket`, disposition, `halfDay`, `eodSource`, first-20-sessions-of-window, and pre-bar presence**, and prints a dedicated **"P3 EXPOSURE"** table (touch-only, F2+, in-sample) with the open-bucket survival %.

**Predicted shape** (from the trace — the founder confirms): nulls concentrate in `tod_bucket = open` (first-bar opens carry `todBucket(570) = 'open'`, `config.js:445`); `GAP_BREAK` disposition ≈ 100% null; first-20-sessions rows null via spin-up; `halfDay`/`eodSource` ≈ no effect (branch-5 unreachable).

## A2.3 — Candidate causes, evaluated against the trace

1. **Baseline spin-up** — **CONFIRMED but minor (~2.7%).** Real branch (`features-intraday.js:52` + `features.js:154-157`); bounded because 5m spans the full window. Not the main cause.
2. **Minimum pre-touch window** — **RULED OUT.** The only pre-touch predicate is `!preBars.length` (`:52`) — *one* bar suffices; the numerator (`:53`) sums over any number of bars with no window requirement. Contrast the *gated* siblings: `consol_tightness` needs 12 bars (`:112`), `accel_final_30m` 13 closes (`:127`), `vol_slope_into_touch` 12 bars (`:174`), `dist_from_opening_range` a full OR30 (`:160`), `approach_velocity` a 90-min span (`:96`). RVOL has **no** analogue. → P3 is **not** excluded from the `open` bucket by a window rule.
3. **Tod-matched baseline gaps (half-days / auction / missing bars)** — **NOT a driver.** Branch-5 `avg==0` is ~unreachable for regular touches; half-days still have bars before any regular `touchEtMin`.
4. **Something else the trace reveals — THE ACTUAL CAUSE:** the **touch-bar rule** (S5 §3.2: no field of the touch bar is read) applied to **opening-bar touches**. `GAP_BREAK` events are emitted on `five.regular[0]` by construction (`events.js:449,454`) → 100% null. Touch episodes that **open on the 09:30 bar** (prior close on the correct side + the first bar's range already reaches the zone; `events.js:392,398,404-407,411/422`) → null. Both carry `tod_bucket = 'open'`.

## A2.4 — The consequence, stated plainly

**Critical nuance first:** P3 is built from `disposition === 'touch'` only (`04-features.js:257` → `buildBudgetReread` `:102,107-113`; mirrored `03-detect-events.js:145,153`). So **`GAP_BREAK` and `RETIRED_MIDEPISODE` nulls — a large, structural chunk of the headline 28–35% — never enter P3.** The headline number (all-disposition, `04-features.js:249`) **overstates P3's actual exposure.**

**What genuinely conditions P3:** among *touch* events, those opening on the session's first 5-minute bar get `rvol_bucket = null` and fall into P3's `<side>.null_rvol` cell (`04-features.js:111`) instead of `LOW/MID/HIGH`. Because first-bar opens carry `tod_bucket = 'open'`, **P3's open bucket is selectively depleted.**

> **P3 today is not "RVOL vs clean_bounce." It is "RVOL vs clean_bounce, conditional on the touch not opening on the session's first 5-minute bar (09:30 ET)"** — which disproportionately removes gap-driven, open-bucket touches.

**Quantification (founder-local):** the exact fraction of `open`-bucket F2+ touch events surviving into P3's `LOW/MID/HIGH` cells is the "P3 OPEN-bucket survival" line printed by `discovery/rvol-null-crosstab.mjs`. The three numbers the founder needs: (a) rvol-null share among **touch-only F2+ in-sample** events (P3's *true* conditioning); (b) the headline all-disposition 28–35% (inflated by `GAP_BREAK`); (c) the open-bucket survival %.

**Not remedied (per the prompt).** The fix — disclosed limitation vs. re-registered P3 vs. an opening-bar RVOL fallback — is a founder decision to be made *deliberately, before S6 computes outcomes*. See Open Questions #1–#2.

---

# JOB B — LOCATE THE EXISTING UNIVERSE

## B2 — Candidate lists found (ranked)

| Rank | File · symbol | Count | Curated? | Consumer (traced) |
|---|---|---|---|---|
| **1 ✅** | **`api/_utils/rankingConfig.js` · `STOCK_UNIVERSE` (`:15`) / `ALL_TICKERS` (`:359`)** | **239** | **Curated** — header *"11 GICS sectors, 239 tickers total"*; regression-guarded (`rankingConfig.test.js:23` asserts length **239**, `:151` asserts **11** sectors). | Daily peer-ranking cron via `screenStocks.js:23` (`STOCK_UNIVERSE`) + `fantasyTimesConsensus.js:9` (`ALL_TICKERS`). Node-clean; built-in sector map (`STOCK_UNIVERSE[s].etf`) + `TICKER_TO_SECTOR` (`:430`) + `STOCK_INDUSTRIES` (`:92`, 239 keys). |
| 2 | `src/constants/sectors.js` · `SECTORS[*].topHoldings` (`:4`) | 226 | Curated — the **front-end mirror** `rankingConfig` says it's *"duplicated from"* (header note). | Client sector UI. **Note: 226 ≠ 239 → the two are not perfectly in sync.** |
| 3 | `src/config/stockData.js` · `PRIORITY_STOCKS` (Set) | 206 | Curated but **purpose-specific** (earnings priority). Copied inline into ≥4 `api/earnings/*` files (154/121/121/90) — a copy-proliferation smell. | Earnings calendar/queue priority. |
| — | `src/services/recommendationEngine.js` · `STOCK_SECTORS` | 260 raw | **Incidental** — mixes crypto + ETFs into 10 named sector arrays; not a clean equity universe. | Recommendation engine. |
| — | Smaller/incidental | 75 (`draftAssets`/`draftStockList`), 54 (`src/data/assets.js STOCKS`), 50 (`fantasyTimesTickers`), 24 (`onboardingStockTiers`), 20 (`stockIntelligenceData`) | Curated but small — playable/draft/onboarding pools, not the universe. | Various product surfaces. |

**Recommended basis: `api/_utils/rankingConfig.js STOCK_UNIVERSE` (239).** It is the largest, curated, **regression-tested**, already sector-mapped, Node-clean, actively-consumed universe. `src/constants/sectors.js` (#2) is the same intent, client-side, and *not* count-guarded (and currently 13 names lighter). `PRIORITY_STOCKS` (#3) is earnings-scoped, not a market universe.

**Overlap with the frozen study 11:** all 11 study names ∈ the 239. Sector map agrees **except `BE`**: study maps `BE → XLI` (`universe_frozen.json:31`, `config.js:88`); product maps `BE → XLK` (`rankingConfig` XLK list). One disagreement to reconcile (Open Question #4).

## B3 — R2 eligibility sweep (FOUNDER-LOCAL)

**Cannot run here:** no `VITE_EODHD_API_KEY` in env; `eodhd.com` blocked by the agent proxy (`CONNECT` 403). The sweep is a cheap daily-only fetch (~1 call/symbol; budget has ~130× headroom) using the existing `lib/depth-eligibility.js` (R2 = **≥ 550 daily sessions before `2023-07-10`**, `depth-eligibility.js:12-13`).

**One command for the founder** (daily-only fetch of the 239, then grade):

```
# 1) daily fetch the candidate list (daily is 1 whole-response call/symbol, config.js:108)
node research/level-study/01-fetch-history.js --daily-only $(node -e "import('./api/_utils/rankingConfig.js').then(m=>console.log(m.ALL_TICKERS.join(' ')))")
# 2) grade with the existing R2 utility (depthEligibilitySweep → PASS/FAIL, firstDailyBar, margin)
node discovery/r2-sweep.mjs   # thin wrapper over lib/depth-eligibility.js over data/normalized/*/daily.json
```

*(`01-fetch-history.js` currently fetches the frozen universe; the founder points it at `ALL_TICKERS` for a daily-only candidate fetch — permitted per the prompt. The grading wrapper is a ~15-line reuse of `depthEligibilitySweep`.)*

**Preliminary suspect flags — require the sweep to confirm; DO NOT decide:**

- **Likely R2 FAIL** (listed post ~May 2021 / no long pre-study history): `CRWV` (CoreWeave, IPO 2025), `GEV` (GE Vernova spin-off 2024), `CEG` (Constellation spin-off 2022), `RKLB` (de-SPAC 2021-08), `HOOD` (IPO 2021-07). Borderline (count may pass): `AFRM` (2021-01), `COIN` (2021-04 direct — already in the study).
- **De-SPAC / SPAC-shell contamination suspects** (session count may PASS but shell-era near-$10 low-vol bars poison extension percentiles & trend-origin searches — the RKLB/DKNG lesson): **`DKNG`** (DEAC/SBTech shell), **`RKLB`**. Detection heuristic per B3: long pre-listing near-$10 low-vol stretch → regime change. **Flag only; the founder rules each.**
- Consistency check: the study's own freeze already excludes `HOOD`/`RKLB` (R2/R3) and `DKNG` (de-SPAC) — `universe_frozen.json:7` — corroborating these flags.

## B4 — Proposed frozen universe v2 (PROPOSAL ONLY)

- **Symbols:** the R2-eligible subset of the 239 (post founder-local sweep), **minus** flagged SPAC suspects pending ruling.
- **Sector map:** adopt `rankingConfig`'s built-in map (`STOCK_UNIVERSE[s].etf`) → **all 11 SPDR sector ETFs.** **All 11 must be added to the context fetch.** Today only `XLK` + `XLE` are fetched (`04-features.js:190`; `universe_frozen.json` contextSymbols) — which is *why `sector_rs_vs_spy` is 53.5% null* (the 6 study names outside XLK/XLE have no sector series). Reconcile `BE` (XLI vs XLK) first.
- **Mechanical strata rule (replaces the hand-assigned 4 that don't scale):** **trailing ATR%-percentile tertiles × sector.** For each symbol take its `daily_atr_pctile` (already a feature, `features.js:47`) — or trailing ATR/price percentile over the window — and bucket LOW/MID/HIGH-vol; `stratum = {sector} × {vol-tertile}`. Reproducible from data, disclosed, no judgment. Distribution *shape*: 11 sectors × 3 tertiles = up to 33 strata, ≈ 239/33 ≈ **~7 per cell** (exact counts founder-local). If 33 is too granular for the Session-7 manual-review sampling, fall back to **vol-tertile alone (3 strata)**. Founder picks the granularity (Open Question #6).
- **Peer-count check (of the full 239, pre-R2):** XLK 28 · XLV 22 · XLF 23 · XLE 19 · XLY 22 · XLP 22 · XLI 23 · XLB 20 · XLU 20 · XLRE 20 · XLC 20. **Every sector ≫ `minEligiblePeers = 5` (`config.js:475`)** → expansion turns Addendum Layer 1 on for all 11. Even after R2 attrition each sector starts at ~19–28, so all should retain ≥ 5 (confirm post-sweep).

## B5 — Expansion cost estimate

Assuming the full 239 equities + 11 sector ETFs + SPY + SPHB/SPLV, full refetch (daily + 5m + earnings):

| Component | Calls |
|---|---|
| 239 equities × daily (1 whole-response call, `config.js:108`) | 239 |
| 239 equities × 5m (3-yr window / 580-day chunk = 2 chunks, `eodhd-client.js:178`) | 478 |
| Earnings (bulk `symbols=` list, `config.js:116`) | ~1–3 |
| Context: SPY (1 daily + 2 5m), 11 sector ETFs (11 × 3), SPHB/SPLV (daily-only, 2) | ~38 |
| **Total** | **≈ 758 calls** |

- **Budget:** ≈ 758 vs the **100,000/day cap** (`config.js:130`) = **~0.76% of one day, ~130× headroom.** A non-issue.
- **Wall-clock:** `pacingMs = 300` (`config.js:121`) × ~758 ≈ **3.8 min of pacing** + response time ≈ **~10–20 min**.
- **Disk — the binding constraint.** 5m raw+normalized for **11** names is already *"multi-GB"* (`.gitignore:80`). 239 is ~22× → **order tens of GB (~40–80 GB)**. Flag disk headroom before any refetch; the API budget is not the limit — disk is (Open Question #8).

---

## 3. Open questions for the founder (decisions, not actions taken)

1. **P3 conditioning ruling (must precede S6).** The trace shows P3 is silently conditioned on *"touch not on the 09:30 opening bar."* Options: **(a)** disclose as a documented limitation, keep P3 as-is; **(b)** re-register P3 to include first-bar touches (requires an RVOL definition for zero-pre-bar touches — e.g., a prior-session or opening-print baseline); **(c)** an opening-bar RVOL fallback. **No build until ruled.**
2. **Headline vs. P3 exposure.** Which number governs acceptance — the all-disposition **28–35%** (`04-features.js:249`, inflated by `GAP_BREAK` which P3 excludes), or the **touch-only F2+** figure? Run `discovery/rvol-null-crosstab.mjs` for the latter (the true P3 conditioning) and rule.
3. **Universe basis.** Adopt `rankingConfig.js STOCK_UNIVERSE` (239) as the study universe v2 basis? *(Recommended.)*
4. **`BE` sector.** Reconcile `BE` — study `XLI` vs product `XLK`. Which map wins?
5. **R2 sweep + SPAC flags.** Run the founder-local daily sweep; rule on each flagged suspect — `CRWV/GEV/CEG/RKLB/HOOD` (R2) and `DKNG/RKLB` (SPAC-shell). Include or exclude each?
6. **Mechanical strata rule.** Approve **ATR%-tertile × sector** (up to 33 strata) vs **vol-tertile only** (3) vs another disclosed rule?
7. **All-11-ETF context fetch.** Approve adding all 11 SPDR ETFs (daily + 5m) to the context fetch — the fix for the 53.5% `sector_rs_vs_spy` null? *(Config change — not made this session.)*
8. **Disk.** Confirm the environment has ~tens-of-GB free before the expansion refetch; the API budget is not the constraint, disk is.

---

## 4. Hard constraints honored

- **Read-only:** no source changes to `research/level-study/`, no config edits, no fixes, no refetch of the existing universe. Writes limited to `docs/discovery/` (this report) and `discovery/` (throwaway scripts). Zero product imports in the delivered script.
- **Every claim** is cited to `file:line` or a printed number.
- **Nothing decided.** Remedies deferred to the founder (§3).

## 5. Artifacts

| Path | What |
|---|---|
| `docs/discovery/SESSION5_5_RVOL_AND_UNIVERSE_DISCOVERY.md` | This report. |
| `discovery/rvol-null-crosstab.mjs` | Founder-run A2.1 cross-tab (splits nulls by cause; prints the P3-exposure table). Read-only, self-contained. |
