# LevelStory S5.6 — PHASE A REPORT (universe expansion) — ⛔ HARD GATE

**Type:** Phase A — cheap (daily-only + fundamentals). **Phase B does NOT run without founder rulings on §6 below.**
**Branch:** `claude/level-study-s5-6-universe-expansion` · cut from `origin/main` @ `0421023` (fetched first, per BUILD_RULES §3).
**Suite:** **146 / 146 pass** (131 inherited + 15 new: `tests/30-warmup-5m`, `tests/31-preregistration-s5-6`).
**`/code-review`:** run at high effort (mandatory at 14 files). **8 real defects found and fixed** — see §9b. Conclusions unchanged after the fixes.
**Network:** live. `VITE_EODHD_API_KEY` present; `eodhd.com` reachable. (The S5.5 blocker was environmental — it is gone here.)

---

## 1. Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **Candidates** | **237** = 239 product tickers − `GOOG` − `DKNG` (both founder-ruled, applied before any fetch) |
| 2 | **R2 sweep** (≥550 daily sessions before 2023-07-10) | **233 PASS · 4 FAIL · 0 fetch failures** |
| 3 | **R2 failures** | `HOOD` (488) · `CEG` (368) · `CRWV` (0) · `GEV` (0) |
| 4 | **`BRK-B` symbol format** | ✅ **`BRK-B.US` works.** `BRK.B` → HTTP 404. `BRKB` → **HTTP 200 + `[]`** (the silent-failure mode — worth knowing it exists) |
| 5 | **SPAC / shell suspects** | **1: `RKLB`** — textbook de-SPAC signature (§4) |
| 6 | **Sector-map disagreements** | **3** — and the headline finding of this phase is §3: **the obvious EODHD field is the wrong one** |
| 7 | **Strata (ATR% tertiles)** | LOW_VOL **77** · MID_VOL **78** · HIGH_VOL **78** |
| 8 | **Per-sector peer counts, post-R2** | **19–26 members per sector; all 11 clear the ≥5 floor with ≥18 peers/member** ✅ |
| 9 | **Phase B disk** (S5.5's flagged blocker) | **NOT a constraint.** ~19 MB/symbol → **~4.7 GB** total, vs **569 GB free**. S5.5's "40–80 GB" was an over-extrapolation. |
| 10 | **5-minute warmup gap** | **FIXED** (§5) — the 189-event artifact is closed, with tests |

---

## 2. R2 sweep (§4.4)

`lib/depth-eligibility.js` (the existing utility, not a re-implementation), floor = **550 daily sessions before 2023-07-10**.

### The 4 failures — all structural, none surprising

| Symbol | Pre-study sessions | Margin | First daily bar | Sector | Why |
|---|---|---|---|---|---|
| `HOOD` | 488 | **−62** | 2021-07-29 | XLF | IPO 2021-07 — genuinely short of the floor |
| `CEG` | 368 | **−182** | 2022-01-19 | XLU | Constellation spin-off 2022-01 |
| `GEV` | 0 | **−550** | 2024-03-27 | XLI | GE Vernova spin-off 2024 — **no pre-study history at all** |
| `CRWV` | 0 | **−550** | 2025-03-28 | XLK | CoreWeave IPO 2025 — **listed after the study window opens** |

All four were pre-flagged in S5.5 and all four confirm. `CRWV` and `GEV` have **literally zero** pre-study sessions — they cannot be in this study under any ruling.

### Thinnest surviving margins (the names to be conscious of)

| Symbol | Sessions | Margin | First bar |
|---|---|---|---|
| `COIN` | 562 | **+12** | 2021-04-14 |
| `AFRM` | 624 | +74 | 2021-01-13 |

`COIN` passes by **12 sessions**. It is already in the frozen v1 universe, so this is not new — but it is the single thinnest name in the study, and worth knowing when a per-symbol anomaly fires on it.

---

## 3. ⚠ THE SECTOR MAP — the headline finding (§4.2)

**The prompt directed: "pull sector from EODHD fundamentals; the EODHD-derived map is authoritative." Following that literally would have corrupted the peer layer.** Here is why, and what I did instead.

### EODHD exposes TWO sector taxonomies, and they disagree

| Field | Taxonomy | Example (`ADP`) |
|---|---|---|
| `General::Sector` | **Morningstar** | "Technology" |
| `General::GicSector` | **GICS** | "Industrials" |

**The SPDR Select Sector ETFs track GICS.** The study's sector features — `rs_vs_sector_*`, `sector_rs_vs_spy_*`, `sector_direction_at_touch` (Addendum §A2.2/§A2.3) — are all measured **against those ETFs**, and the peer group is "the other members of my sector." So a symbol must be grouped with **the ETF it is actually a constituent of**, or its relative strength is measured against a benchmark it does not belong to and its peers are the wrong companies.

**⇒ `General::GicSector` is authoritative. `General::Sector` (Morningstar) is fetched, reported, and NOT used.**

### What the naive field would have cost

Had I taken `General::Sector` (the default, obvious field) as authoritative, it would have **introduced 3 new errors to fix 1**:

| Symbol | Morningstar says | GICS says | Product says | Verdict |
|---|---|---|---|---|
| `ADP` | Technology → XLK | **Industrials → XLI** | XLI | product **correct**; Morningstar would have broken it |
| `PKG` | Consumer Cyclical → XLY | **Materials → XLB** | XLB | product **correct**; Morningstar would have broken it |
| `WBA` | Healthcare → XLV | **Consumer Staples → XLP** | XLP | product **correct**; Morningstar would have broken it |
| `BE` | Industrials → XLI | **Industrials → XLI** | **XLK** | **product WRONG** — the known error, confirmed |

### Against GICS, the product map is right on 234 of 237

Three disagreements remain, and they are **not all the same kind of thing**:

| Symbol | Product | EODHD GICS | R2 | My read |
|---|---|---|---|---|
| **`BE`** | XLK | **XLI** (Industrials / Electrical Equipment) | PASS | ✅ **Adopt XLI.** The genuine product error. Both taxonomies agree it is Industrials, and the study's own v1 freeze already had `BE → XLI` (`universe_frozen.json:31`). **High confidence.** |
| **`AFRM`** | XLF | XLI (Industrials / **Professional Services**) | PASS | 🔴 **I believe the VENDOR is wrong here.** Affirm is a BNPL consumer lender. "Industrials / Professional Services" is economically absurd for it — its XLI peers would be GE, CAT, RTX. Likely a mis-applied GICS-2023 transition (the old "Data Processing & Outsourced Services" bucket was split between Financials and Industrials; ADP correctly went to Industrials, Affirm should have gone to **Financials**). **Recommend the founder override → keep `XLF`.** |
| **`GEV`** | XLI | XLU | **FAIL** | ⚪ **Moot** — GEV fails R2 with zero pre-study sessions and is out of the universe regardless. (For the record I'd also call XLU wrong; GE Vernova makes turbines — Industrials. Noted only so the disagreement isn't silently inherited if GEV is ever revisited.) |

**This is a ruling I need, not one I made.** I applied GICS as the base map (it is right on 234/237 and fixes `BE`), but I have **not** overridden `AFRM` — that is founder call #3 in §6.

---

## 4. SPAC / shell-contamination flags (§4.5)

Heuristic (disclosed, deliberately conservative — **flags a shape, asserts no verdict**): a long *initial* run of closes parked near \$10 with <3% daily moves, ending in a volatility regime change. Applied to every R2-PASS name whose history begins after 2019-01-01.

### 🚩 `RKLB` — one suspect, and it is textbook

| Evidence | Value |
|---|---|
| Shell era | **2020-11-24 → 2021-02-26** (64 sessions) |
| Pre-listing price | mean **\$10.35**, stdev **\$0.22** |
| Pre-listing daily vol | **0.69%** |
| Post-regime daily vol | **4.97%** |
| **Vol ratio** | **×7.2** |
| Regime-change date | **2021-03-01** |
| EODHD IPODate | 2021-08-24 (*after* its own first bar — itself a de-SPAC tell) |

A stock does not trade for 64 sessions at \$10.35 ± \$0.22 with 0.69% daily vol and then 7× its volatility overnight. That is a SPAC trust account, then a merger. **The detector is validated by the fact that it independently rediscovered a known de-SPAC** — RKLB is the exact name the study's v1 freeze already excluded (`universe_frozen.json:7`, "the RKLB lesson").

**Founder ruling needed** (§6, call #2). My read: **exclude**, for the same reason `DKNG` was dropped — those 64 shell bars sit inside the 504-session extension-percentile window and the 252-session trend-origin lookback.

### Clean by the same test (listed ≥2019, no shell shape) — informational

`PLTR` (2020-09-30, direct listing) · `SNOW` (2020-09-16) · `CRWD` (2019-06-05) · `COIN` (2021-04-14, direct listing) · `AFRM` (2021-01-13) · `DOW` (2019-03-20) · `CTVA` (2019-05-24) · `FOXA` (2019-03-12)

Each is a traditional IPO, direct listing, or spin-off — none shows the trust-value signature. **No action.**

---

## 5. The 5-minute warmup gap — FIXED (§3)

**The bug:** the RVOL baseline needs **20 trailing sessions of 5-minute data** (`features-intraday.js:19` `RVOL_DAYS = 20`, guard at `:52`), but the 5m fetch began **exactly at `studyStart`** (`config.js` `intradayFetchStart` = `range.studyStart`). The **daily** warmup existed (2018 → ~1,387 pre-study sessions); the **5-minute warmup was never built.** Events in the first 20 study sessions nulled RVOL at **72.6%** vs **30.6%** elsewhere — **189 events (2.2%) lost to a pure data artifact.**

**The fix:** 5m now fetches from **30 trading sessions before `studyStart`**, derived per symbol from that symbol's own daily calendar (`lib/normalize.js:fiveMinWarmupStart`) — never a hardcoded date, because "30 trading sessions" is a market-calendar fact (~44±2 calendar days, holiday-dependent). Verified live: AAPL now fetches 5m from **2023-05-24**, exactly 30 sessions before 2023-07-10.

**The hard rules, enforced by construction rather than convention:**

| Rule | How it is enforced |
|---|---|
| Warmup bars feed **RVOL/volume baselines ONLY** | The study-window session list and the baseline session list are **separate inputs** (`lib/features.js`). No other code path can reach a warmup bar. |
| **No event on a warmup5m session** | `lib/events.js` **throws** `WARMUP5M_EVENT_SESSION` if one ever reaches the detector — a loud failure, never a silent pre-study event. |
| No **feature** other than baselines reads them | `gap_context` / the approach seed walk the study-window list; the ETF `prevCloseMap` filters warmup out (`04-features.js`). Study-session-1 keeps its null `gap_context` exactly as before. |

**Tests (`tests/30-warmup-5m.test.js`, 8 tests):** study-session-1 now has a **non-null** RVOL and was **null** before (the fix is proven to do something); **no event lands on a warmup session**; a warmup session reaching the detector **throws**; and a **poison test** — every warmup bar corrupted (×1000 price, ×1e6 volume) leaves every non-baseline feature **byte-identical**, which is what makes "baselines only" a fact rather than an intention.

> **Bug found and fixed en route:** importing a helper from `01-fetch-history.js` executed its `main()` as an import side effect — a test import kicked off a live network fetch. The helper moved to `lib/normalize.js` and the runner now has an entry-point guard. (Caught because the test run printed a fetch log.)

---

## 6. ⛔ THE HARD GATE — rulings I need before Phase B

**Phase B (the expensive 5-minute fetch + full rebuild) does not run until these are answered.**

| # | Ruling | My recommendation |
|---|---|---|
| **1** | **The 4 R2 failures** — `HOOD` (488), `CEG` (368), `CRWV` (0), `GEV` (0). Confirm exclusion? | **Exclude all 4.** `CRWV`/`GEV` have zero pre-study history — not a judgment call. `HOOD`/`CEG` miss the floor by 62 and 182 sessions. R2 is pre-registered; I am not proposing to bend it. |
| **2** | **`RKLB`** — SPAC-shell suspect (64 sessions at \$10.35 ± \$0.22, vol ×7.2 at 2021-03-01). Include or exclude? | **Exclude** — same rationale as `DKNG`. The shell bars fall inside the 504-session extension window and the 252-session trend-origin lookback. |
| **3** | **`AFRM` sector** — product `XLF` vs EODHD-GICS `XLI` (Industrials / Professional Services). | **Override the vendor → keep `XLF`.** I believe EODHD is wrong: a BNPL lender's peers are not GE and CAT. |
| **4** | **`BE` sector** — product `XLK` vs GICS `XLI`. | **Adopt `XLI`.** The genuine product error; the study's own v1 freeze already said XLI. |
| **5** | **The final frozen list** | **232 names** = 233 R2-PASS − `RKLB`. (Or 233 if you keep RKLB.) |

**Also worth your eye (not blocking):** `COIN` passes R2 by only **12 sessions**.

---

## 7. What Phase B will cost (measured, not guessed)

| Component | Cost |
|---|---|
| 5-min fetch, 232 equities × ~3 chunks | ~700 calls |
| Context: SPY + **all 11 SPDR sector ETFs** (the fix for the 53.5% `sector_rs_vs_spy` null) + SPHB/SPLV daily-only | ~50 calls |
| Earnings (bulk `symbols=` list) | ~1–3 calls |
| **Total** | **≈ 750 calls** — vs the **100,000/day cap** = **0.75%**, ~130× headroom |
| Wall-clock | ~10–15 min (300 ms pacing × 750 + response time) |
| **Disk** | **~4.7 GB** (measured: **19 MB/symbol** of 5m raw), vs **569 GB free** — **not a constraint** |

**Daily data for all 237 is already fetched and cached** (this phase), so Phase B pays only for 5-minute + context.

**Correcting S5.5:** that report flagged disk as *"the binding constraint… order tens of GB (~40–80 GB)"* and made it Open Question #8. Measured against the real cache, it is **~4.7 GB**. Disk does not gate this expansion.

---

## 8. Strata + peer counts

**Strata (§4.6)** — three ATR%-percentile tertiles (median ATR14/close over the study window), cut on the R2-PASS set only, so ineligible names cannot shift the edges:

| Stratum | n | ATR% range |
|---|---|---|
| `LOW_VOL` | 77 | 0.811 – 1.955 |
| `MID_VOL` | 78 | 1.961 – 2.371 |
| `HIGH_VOL` | 78 | 2.381 – 6.936 |

Cut points: **1.961%** and **2.381%**. Mechanical and disclosed — no hand assignment. (Replaces the four hand-assigned strata, which did not scale and were never mechanical. Sector remains its own field, which the cross-strata scan reads directly; tertile × sector = 33 cells would leave the 100-event Session-7 review sample at ~3 per stratum.)

**Per-sector peer counts, post-R2 (§4.7)** — on the GICS map, the direct test that `eligible_peer_count ≥ 5` is met everywhere:

| Sector | XLE | XLU | XLC | XLB | XLRE | XLF | XLY | XLV | XLP | XLI | XLK |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Members | 19 | 19 | 19 | 20 | 20 | 21 | 21 | 22 | 22 | 24 | 26 |
| Peers/member | 18 | 18 | 18 | 19 | 19 | 20 | 20 | 21 | 21 | 23 | 25 |

**Every sector clears the floor of 5 with ≥18 peers per member.** Addendum Layer 1 (the peer layer, ~100% null at 11 symbols) switches **ON universe-wide**. This is the single biggest thing the expansion buys.

---

## 9. Pre-registration amendments recorded (§2)

`docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S5_6.md` — written **before any code**, all three **pre-outcome**:

- **S56-A1** — `hasIntradayApproach` on every event; **P3 is pre-registered on `hasIntradayApproach === true`**, converting a *silent* conditioning into a *stated* one. No synthetic opening-RVOL fallback (it would measure a different quantity under the same name — the aggregation-mismatch hazard).
- **S56-A2** — **`OPEN_TOUCH`** as a pre-registered **descriptive** class (described, never tested; no hypothesis, no verdict). Stays in P1/P2/P4/P5/P6; excluded only from P3.
- **S56-A3** — universe v2, `universeVersion: 2`. Window, holdout, geometry, questions, floors **unchanged** — only the symbol set grows.

The doc states prominently: **after Session 6 computes its first outcome, the pre-registration is frozen permanently.** This is the last session in which any of this is legitimate.

`STUDY_CONFIG_VERSION` → **4**. A **provenance marker only** — no geometric or statistical knob changes value.

---

## 9b. `/code-review` (mandatory at 14 files) — 8 real defects found and fixed

The review (high effort, 37 agents) verified 34 findings and distilled 10 distinct defects. **Eight were real and are fixed in this branch.** They shared one theme, and it is worth stating because it is the theme this study is most vulnerable to: *guarantees enforced by convention at one call site, and failures that degrade silently instead of loudly.*

| # | Defect | Fix |
|---|---|---|
| 1 | **My `hasIntradayApproach` hard-assert was swallowed.** It throws inside `04-features.js`'s per-symbol `try/catch`, so a stale-artifact run skipped *every* symbol, wrote an **all-zero budget re-read** to `_stats.json`, left the previous run's feature files on disk, and **exited 0.** The loud failure I designed did not fire. | Schema **precheck before the loop**; the run aborts with the rebuild command. |
| 2 | **`OPEN_TOUCH` conflated two different things.** It was defined as "no pre-touch bar", which is true both for a real 09:30 gap-into-the-zone open **and** for a session whose early bars are simply *missing from the vendor feed*. At ~230 names (many thinner than the 11 probes) the data artifacts would have inflated the base rates of a class the founder reads as economic. | Events now carry **`touchEtMinutes`**. `OPEN_TOUCH` = no approach **AND** touch at 09:30; the rest are reported as **`NO_PRE_BAR_DATA_GAP`** — a stated data-quality count, never pooled. |
| 3 | **`OPEN_TOUCH` displayed a verdict.** The shared `cell()` helper stamps `PASS`/`UNDERPOWERED` on everything, so a class S56-A2 pre-registers as *never tested* rendered as `OPEN_TOUCH … n=812 PASS`. A non-technical reader would take a descriptive base-rate class for a cleared hypothesis. | `descriptiveCell()` — counts only, **no verdict**, and the header says `DESCRIPTIVE ONLY, never tested`. (BUILD_RULES §9.) |
| 4 | **The warmup could be silently lost.** `baselineSessionDates` defaulted to `sessionDates` — which S5.6 had just redefined to be warmup-*filtered*. Any caller omitting the param would silently walk the filtered calendar and re-null ~189 events: the exact bug this session exists to fix, reintroduced with no error. | **Parameter removed.** The baseline calendar is derived *inside* `assembleEventFeatures` from `fiveMinByDate`. There is no call site that can get it wrong. |
| 5 | **The v3→v4 provenance bump never reached event records** (they inherit the levels registry's version), so a half-rebuilt pipeline would emit an artifact claiming **two versions at once** — precisely the confusion the bump exists to prevent. | `detectEvents` **throws `STALE_LEVELS_REGISTRY`** on a version mismatch. |
| 6 | **The shell/SPAC heuristic tested a nominal \$10 band against *adjusted* closes.** A de-SPAC that later split has its shell era at ~\$5 adjusted — outside the band, **never flagged**. The RKLB/DKNG failure mode, defeated by the adjustment basis. | Test against **raw `close`** (the price that actually printed). |
| 7 | **SPAC suspects were filtered to `firstDailyBar >= 2019`** — but the daily fetch opens at 2018-01-01, so a 2018-listed shell would be dropped from the flag list *and* the informational list, reaching the freeze unmentioned. | **All** shell-shaped names are flagged, regardless of listing year. |
| 8 | **A fundamentals fetch failure was indistinguishable from "vendor has no sector"** — the symbol silently kept its *unverified product* sector. A single transient 429 on `BE` and the one name the whole cross-check exists to catch would have been waved through. | Failures are tracked and reported **loudly**; the gate refuses to freeze until they are clean. |

**Also fixed (the trap Phase B would have walked into):** `04-features.js` hardcoded its 5m context to `['SPY','XLK','XLE']` and read `CONFIG.universe.sectorMap`, which only ever held the **11 probe names**. Under universe v2 that returns `undefined` for ~226 symbols → every sector feature null for the overwhelming majority of the universe, while this very report claims the sector layer switches on. Both now read the **frozen universe file**, and the 5m context covers **every sector ETF the universe references**.

**Re-run after the fixes: identical Phase A conclusions** (233 PASS / 4 FAIL, RKLB the sole shell flag, 3 sector disagreements, same strata and peer counts). The fixes removed failure *modes*, not answers — which is the outcome you want from a review at a gate.

**Accepted, not fixed (documented):** moving the 5m fetch start changes the intraday chunk cache keys, so the 11 already-cached names re-download their 5m once (~48 calls, ~0.05% of the daily cap). Correctness is unaffected — `loadFiveMinByDate` dedups overlapping chunks by bar timestamp. Not worth added complexity.

---

## 10. Hard constraints honored

- **Phase B has NOT run.** No 5-minute data was fetched for the expansion. Stopped at the gate, as instructed.
- **No knob tuned** against event counts, cell sizes, or budget outcomes. `floorPct`/`capPct` are untouched — they get **re-verified** (not re-tuned) on ~230 names in Phase B, and if either binds >10% that is **reported, not fixed**.
- **No independence rule loosened.**
- **Geometry, questions, floors, window, holdout unchanged.** Only the symbol set grows.
- **Zero product imports** — the 237 tickers are a data *transcription* of `rankingConfig.js`, not an import.
- Every claim above cites a file/line or a printed number.

## 11. Artifacts

| Path | What |
|---|---|
| `docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S5_6.md` | The three pre-registration amendments |
| `docs/discovery/SESSION5_6_PHASE_A_UNIVERSE_EXPANSION.md` | This report |
| `research/level-study/tools/phase-a-universe-sweep.mjs` | The sweep (re-runnable; daily+fundamentals cached) |
| `research/level-study/data/phase-a/phase_a_sweep.json` | Full per-symbol artifact (gitignored — 237 rows: R2, GICS, ATR%, stratum, shell evidence) |
| `research/level-study/tests/30-warmup-5m.test.js` | 8 tests — the 5m warmup |
| `research/level-study/tests/31-preregistration-s5-6.test.js` | 5 tests — S56-A1 / S56-A2 |

*Phase A complete 2026-07-13. **Awaiting founder rulings §6 before Phase B.***
