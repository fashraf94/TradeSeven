# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 5.6 — UNIVERSE EXPANSION + PRE-REGISTRATION FREEZE)

**Status:** Spec amendments of record for Session 5.6. Recorded per the S5.6 prompt §2, **before any code was written this session**.
**Session:** LevelStory Session 5.6 on branch `claude/level-study-s5-6-universe-expansion` (cut from `origin/main` @ `0421023`).
**Config:** `STUDY_CONFIG_VERSION` — see §D. Geometry, questions, floors, study window, and holdout date are **unchanged**; only the symbol set grows and one conditioning is made explicit.
**Precedence:** this document → S5 → S4 → S3.5 → S3 → S2 → Addendum → parent spec.

---

## ⛔ THE FREEZE — READ THIS FIRST

**This is the last session in which any pre-registration change is legitimate.**

Session 6 computes the study's first outcome. **The moment it does, the pre-registration is frozen permanently: no question, no cell, no bucket, no floor, and no filter may ever change again.** Not to rescue an underpowered cell, not to chase a near-miss, not to "clarify" a definition whose result you have now seen. A thin cell after that point is a **finding**, reported as `UNCONFIRMED`, and it stays that way.

The three amendments below (S56-A1, S56-A2, S56-A3) are made **strictly before any outcome data exists**. That is the entire basis of their legitimacy. Amending an engineering acceptance gate on build diagnostics is normal housekeeping; amending a research criterion *after seeing outcome data* is fraud. The line between those two things is the moment Session 6 runs — and it has not run.

This rule is inherited from and supersedes nothing in the S5 freeze rule (`LEVELSTORY_RULINGS_AND_AMENDMENTS_S5.md` §"THE FREEZE RULE"); it restates it because S5.6 is the session where it actually bites.

---

## §A — Pre-registration amendments (founder-ruled; pre-outcome)

### S56-A1 — `hasIntradayApproach`, and P3's conditioning made explicit

**The measured evidence (S5.5 cross-tab, founder-run):**

| Measurement | Value |
|---|---|
| `rvol_approach` null rate on events whose episode opens on the session's **first regular 5-min bar** (09:30 ET) | **100%** |
| `rvol_approach` null rate on events that **have** a pre-touch bar | **3.2%** |
| First-bar-open events, all dispositions | **2,564 of 8,446 (30.4%)** |
| P3's actual population (F2+, `disposition = touch`, in-sample) in the `open` tod-bucket | **850 of 1,328 events** |
| …of those 850, share with null `rvol_approach` | **54%** |
| ⇒ **P3 currently sees 46% of its own dominant bucket** | |

The split is **binary and structural, not a defect**. An event that opens on the session's first regular bar has **zero pre-touch bars** — there is no approach to measure, because no approach happened inside the session. `rvol_approach` is not "missing" for these events; it is **undefined**. The mechanism is the touch-bar rule (S5 §3.2 / S5-C4: no field of the touch bar is read) applied to an opening-bar touch, and it lands at `research/level-study/lib/features-intraday.js:91` (`if (!pre.length || atr == null) return out;`).

**Amendment:**

1. **Every event carries `hasIntradayApproach: true | false`**, where `false` ⇔ the episode's touch bar is the session's **first regular bar**. This is a structural fact about the event, computed from the bar index, not a data-quality flag.
2. **P3 is pre-registered on `hasIntradayApproach === true`.** This converts a **silent** conditioning into a **stated** one — the whole point of the amendment. P3's reported question becomes:

   > **P3:** *Among F2+ touch events **with an intraday approach**, does `rvol_approach` bucket predict `clean_bounce` from `touchAt`?*

   Every P3 table, and the final report, carries this qualifier **and the excluded count**. P3 was *already* conditioned this way in fact; it simply wasn't saying so. We are not narrowing P3 — we are telling the truth about its population.
3. **No synthetic opening RVOL fallback.** A gap-derived or prior-session-derived proxy would measure a *different quantity* (overnight interest, gap magnitude) and report it under the name `rvol_approach` (intraday approach intensity). That is the **aggregation-mismatch hazard** the parent spec names as its most frequent class of spec bug. The honest move is to state the conditioning, not to manufacture a number that fills the column.

**Rejected alternative (recorded):** re-registering P3 to include first-bar touches under a fallback RVOL definition. Rejected under (3) — it would silently change what the endpoint means.

### S56-A2 — `OPEN_TOUCH` as a pre-registered descriptive class

30% of episodes open on the 09:30 bar. These are **gap-into-the-zone** setups: the market gapped, the level was already inside the first bar's range, and the interaction began at the bell. That is a **large, coherent, economically distinct class** — not noise, and not a data artifact.

They lack **only** the intraday fingerprint (the pre-touch 5-min approach features). They **retain** hourly bars, family tier, the daily grain, and every daily-grain extension/regime/catalyst feature.

**Amendment:**

- **`OPEN_TOUCH`** is defined as `disposition === 'touch'` **AND** `hasIntradayApproach === false` **AND** `touchEtMinutes === 570` (the 09:30 ET regular open).

> **⚠ The `touchEtMinutes` clause is load-bearing, and it was added during this session's `/code-review`.** "No pre-touch bar" has **two** causes, and only one of them is `OPEN_TOUCH`:
> 1. the touch bar **is** the 09:30 bar — a real **gap-into-the-zone open**; and
> 2. the session's early bars are **missing from the vendor feed** (a thin name, a halt, a truncated chunk), so the first *delivered* bar is mid-session — a **data artifact**.
>
> Both null RVOL and both leave P3. But pooling (2) into `OPEN_TOUCH` would contaminate the base rates of a real economic class with data-quality noise — and at ~230 names, many thinner than the 11 probes, (2) is a population, not a rounding error. The artifacts are therefore reported as their own stated class, **`NO_PRE_BAR_DATA_GAP`** (descriptive, excluded from P3, never pooled into `OPEN_TOUCH`). A large count there is a **data-quality finding**, not a result.
- It is a **pre-registered descriptive class** with its **own reported base rates** in the final report: `held_EOD`, `clean_bounce`, MFE / MAE.
- Those base rates are reported **alongside — never pooled into** — the approach-bearing population.
- **No hypothesis is pre-registered on `OPEN_TOUCH`.** It is **described, not tested.** It generates no verdict, no CI, no acceptance claim — and this is enforced in the reporter, not merely intended: its cells are built by `descriptiveCell()`, which emits counts **without a verdict field**, and the printed header carries `DESCRIPTIVE ONLY, never tested`. (A cell that renders `PASS` on an untested class is exactly the display-disagreement bug family BUILD_RULES §9 exists to kill.) If it looks interesting, that is a **Session-8+ hypothesis for a future study on new months**, never a post-hoc result from this one.
- **`OPEN_TOUCH` events remain in P1, P2, P4, P5, and P6 unchanged.** Those questions gate on hourly class, tier, extension, and regime — all of which these events have. Only **P3** (which conditions on the intraday fingerprint, per S56-A1) excludes them.

### S56-A3 — Universe v2

The frozen universe expands from **11** names to the **R2-eligible subset of the 239-name product universe** (`api/_utils/rankingConfig.js:15` `STOCK_UNIVERSE` / `:359` `ALL_TICKERS`), recorded as **`universeVersion: 2`**.

**Founder-ruled exclusions, applied before any fetch:**

| Symbol | Ruling | Reason |
|---|---|---|
| **`GOOG`** | **DROP** (keep `GOOGL`) | Same company, two share classes. Both in the product list (`rankingConfig.js:80`). They would **double-count** in peer confirmation rates, breadth, and the momentum deciles — two rows that are one economic entity. |
| **`DKNG`** | **DROP** | De-SPAC (DEAC / SBTech shell). Shell-era bars are **not economically DKNG**: they would poison extension percentiles (which read a 504-session trailing window) and trend-origin searches (252-session lookback). **The RKLB lesson.** |

→ **237 candidates** enter the R2 sweep.

**What does NOT change:** the study window (`2023-07-10` → `2026-07-10`), the holdout date (`2025-12-10`), the geometry (`distanceUnit`, all five `k*` multiples), the six pre-registered questions, and every honesty floor (`minN: 30`, `minUniqueDates: 15`, `minSiblingDiffPoints: 15`). **Only the symbol set grows.**

**Why this is legitimate now and never again:** expanding the universe **before** any outcome exists is clean data collection — we cannot possibly be selecting symbols to favor a result we have not computed. Expanding **after** outcomes exist would be forking-path contamination of exactly the kind the pre-registration exists to prevent. **This is the last moment it is legitimate.**

**Sector map:** derived from **EODHD fundamentals**, not inherited from the product. The product map has at least one known error — **`BE`** is listed under **XLK** (`rankingConfig.js:20`) but Bloom Energy is GICS **Industrials / XLI** (and the study's own v1 freeze already had it right: `universe_frozen.json:31`). Peer features depend on **economic** similarity, so a wrong sector silently corrupts every peer rate and RS feature for that name. The EODHD-derived map is authoritative unless the founder overrides a specific name. Every disagreement is reported with both labels.

**Strata:** the four hand-assigned strata (`mega_cap_tech`, `low_volatility`, `high_beta`, `gap_prone`) do not scale to ~230 names and were never mechanical. They are replaced by **three ATR%-percentile tertiles** — `LOW_VOL`, `MID_VOL`, `HIGH_VOL` — computed over the study window. Rationale: strata exist only for (a) Session-7 manual-review sampling and (b) the cross-strata anomaly scan. **Volatility is the axis that caught LS3-01**; sector is already its own field the scan reads directly. Tertile × sector (33 cells) would leave the 100-event manual-review sample at ~3 events per stratum — useless.

---

## §B — The 5-minute warmup gap (a build fix, NOT a pre-registration change)

**This is engineering, not research.** It removes a data artifact; it changes no question, cell, bucket, or floor. Recorded here for provenance, not as an amendment.

**Evidence (S5.5):** events in the first 20 study sessions null `rvol_approach` at **72.6%**, against **30.6%** elsewhere.

**Cause:** the RVOL baseline needs **20 trailing sessions of 5-minute data** (`features-intraday.js:19` `RVOL_DAYS = 20`; the guard at `:52`). But the 5-min fetch **begins exactly at `studyStart`** (`config.js:114` `intradayFetchStart: '2023-07-10'` = `range.studyStart`). The **daily warmup exists** (`config.js:113` `dailyFetchStart: '2018-01-01'`, ~1,387 pre-study sessions); the **5-minute warmup was never built.** **189 events (2.2%) are lost to a pure data artifact.**

**Fix:** extend the 5-minute fetch range back **30 trading sessions before `studyStart`** (margin over the 20 required). These bars are tagged **`warmup5m: true`**.

**Hard rules (asserted, not merely intended):**

- 5m-warmup bars are used for **RVOL / volume baselines ONLY**.
- **No event may be detected on a 5m-warmup session** — asserted (extending the existing warmup-guard pattern with the 5m case).
- **No outcome, and no feature other than the baselines, ever reads them.**

**Tests added:** (a) an event on **study-session-1** has a **non-null** RVOL (the baseline is now populated); (b) **no event exists on any 5m-warmup session**.

---

## §C — What this session does NOT do

- It does **not** tune any knob against event counts, cell sizes, or budget outcomes.
- It does **not** loosen any independence rule. **A thin cell is a finding.**
- It does **not** re-tune `floorPct` / `capPct`. Those were calibrated on 11 symbols (S35-C10); the ≤10%-binding criterion is **re-verified** on ~230 in Phase B. If either guard now binds >10% for any symbol, that is **reported, not fixed** — it would be a config-v4 conversation for the founder.
- It does **not** begin Session 6.

## §D — Config version

`STUDY_CONFIG_VERSION` is incremented to **4** in this session **only** because the universe (`universeVersion: 2`), the 5m warmup range, and the `rvolApproachBuckets`-adjacent P3 gate (`hasIntradayApproach`) change artifact provenance. **No geometric or statistical knob changes value.** The version bump exists so artifacts built before and after S5.6 can never be silently confused — it is a provenance marker, not a recalibration. (Per the parent-spec header rule: increment on any post-build change; never reuse.)

---

*Recorded 2026-07-13 — LevelStory Session 5.6. All three amendments pre-outcome.*
