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

#### Founder rulings on the Phase A gate (2026-07-13) — the frozen list

| # | Ruling | Decision |
|---|---|---|
| 1 | R2 failures: `HOOD` (488), `CEG` (368), `CRWV` (0), `GEV` (0) | **EXCLUDED — all four.** `CRWV`/`GEV` have zero pre-study sessions. |
| 2 | `RKLB` — SPAC shell (64 sessions at \$10.35 ± \$0.22, 0.69% daily vol → ×7.2 on 2021-03-01) | **EXCLUDED.** Shell bars sit inside the 504-session extension window and the 252-session trend-origin lookback; they would poison extension percentiles. Same rationale as `DKNG`. |
| 3 | `AFRM` sector: product `XLF` vs GICS `XLI` | **VENDOR OVERRIDDEN → `XLF`.** *Founder reasoning, recorded verbatim:* the map exists to capture **economic peer similarity, not taxonomic correctness**. A BNPL lender's peers are consumer-finance names, not GE and CAT. A deliberate, reasoned override — not a data error. |
| 4 | `BE` sector: product `XLK` vs GICS `XLI` | **`XLI` ADOPTED.** Genuine product error; the v1 freeze already had it right. |
| 5 | `GEV` sector: product `XLI` vs GICS `XLU` | **MOOT — not resolved.** `GEV` fails R2 (zero pre-study sessions) and is not in the universe, so it has no sector map entry, no peer group, and no RS benchmark. Recorded so the disagreement cannot be silently inherited if `GEV` is ever revisited on a later window. (For the record: both labels look wrong — GE Vernova manufactures turbines and grid equipment, i.e. Industrials / Electrical Equipment, not a power producer.) |

**Frozen list: 232 names** = 237 candidates − 4 R2 failures − `RKLB`.

### S56-A4 — `NO_PRE_BAR_DATA_GAP` is a DATA-QUALITY class, and incomplete hourly bars null the hourly class

Amends S56-A2. Both parts are outcome-blind (bar coverage is a property of the *data*, not of any result).

**Part 1 — the classes do not pool.** `OPEN_TOUCH` is pre-registered as **genuine 09:30 gap-opens only** (`hasIntradayApproach === false` **AND** `touchEtMinutes === 570`). `NO_PRE_BAR_DATA_GAP` events (`hasIntradayApproach === false` **AND** `touchEtMinutes !== 570` — the session's early 5m bars are absent from the vendor feed) **never pool into it.** Pooling a vendor artifact into a descriptive setup class would contaminate it with noise that has no economic meaning. `NO_PRE_BAR_DATA_GAP` is counted and reported separately as a **data-quality diagnostic** and carries **no pre-registered hypothesis**.

**Part 2 — the load-bearing consequence for Session 6.** If a session's 5m bars are missing, it is **not only RVOL** that breaks: **VWAP, cumulative volume, OR30, and the hourly bars themselves** are all built from those constituents. Session 6 builds the hourly confirmation taxonomy (`SHARP_REJECT` / `DRIFT_HOLD` / `BREAK_HOLD` / `BREAK_RECLAIM` / `CHOP`) from exactly these bars. Without a guard, **S6 would silently assign a confirmation class from an incomplete bar** — a garbage label that looks identical to a real one.

**Pre-registered rule:**

> If an hourly bar in the confirmation window is missing **more than 20%** of its expected 5-minute constituents, the **`hourly_class` is `null`**, and the event **drops from P1, P2, and P5.**

- **Threshold: `minBarCoveragePct = 80`** (`config.hourlyClass.minBarCoveragePct`). ≥80% of expected bars present ⇒ usable; >20% absent ⇒ `null`. Stated here as a pre-registered constant, fixed before any outcome exists.
- **Expected bars** are derived **per session**, never assumed: a full-day 60-minute bucket expects 12 bars, the final 15:30–16:00 bucket expects 6, and on a **half-day** the expectation is clipped to the session's actual close (S3-R3: session end is derived per session, never hardcoded 16:00).
- **⚠ S56-C2 (implementation decision, stated):** the confirmation window is *"touch hourly bar **+ next hourly bar**"* (`config.hourlyClass.window`), so the class is computed from **both** bars. The rule is therefore applied to **both bars of the window**, not only the touch bar — a complete touch bar followed by a half-empty next bar would still produce a garbage class. `hourlyClassEligible` is the AND over the window's bars. This is strictly more conservative than the founder's wording and is recorded as such.
- Events dropped by this rule are **counted and reported**, never silently discarded. **A large count is a finding.**

### S56-A5 — Data-completeness eligibility (measured now; the floor is set before S6)

**Why this could not be deferred.** At 11 mega-caps, missing 5m bars were rare and benign. At **232 names** the universe reaches into far less liquid tickers, where absent bars are **not vendor gaps — they are illiquidity.** And illiquidity **correlates with volatility, spread, gap behavior, and reaction quality** — i.e. with the very things the study measures. Left unmeasured, a data-quality artifact becomes a **hidden confounder in every cut.**

**Phase B measures and reports, per symbol:**
1. **% of study sessions with complete regular-session 5m coverage** (78 expected bars on a full day; clipped per session on half-days).
2. The **distribution** across the 232 — median, p10, and the **worst 20 names by name**.
3. **Correlation of coverage with ATR% and with median daily dollar volume** — is incompleteness tracking illiquidity, as predicted?
4. **Per-symbol `NO_PRE_BAR_DATA_GAP` event counts.**

**Then a completeness eligibility floor is *proposed from the measured distribution*** — exactly as `floorPct`/`capPct` were set from measured clamp-binding rates (S35-C10): **from data, not from a guess.** The report states which names the floor would cull.

**The founder sets the floor. This is outcome-blind and therefore legitimate now — and would not be legitimate later. If it culls names, that is a finding, not a failure.**

---

## §C3 — The market session calendar (a build fix, NOT a pre-registration change)

**This is engineering, not research.** It changes no question, cell, bucket, floor, or filter. It corrects a *measurement* that was wrong, and it is recorded because the thing it corrupted is the S56-A5 distribution the founder is about to set a floor on.

**What was wrong.** S56-A4 needs to know how many 5-minute bars a session *should* have delivered. That requires the session's true end. Three sources were tried, and the first two are both unsound:

| Source | Why it fails |
|---|---|
| the symbol's **own last delivered bar** | Cannot distinguish "the market closed" from "my feed stopped." A truncated session **certifies its own completeness** — biasing clean exactly on the thin, low-print names S56-A5 exists to detect. |
| the symbol's **closing auction print** | **MEASURED: EODHD emits no auction print at 16:00 on half-days.** On all 7 half-days in the study window, `hasAuction === false` for **229/229** symbols. The code then fell back to a 16:00 close. |

**The consequence, and why it was invisible.** Every half-day was measured against a 78-bar expectation, read as a ~53%-covered data gap, and dropped. The A4 drop rate on half-days was **16.5% vs 0.67% elsewhere — a 25× elevation.** But the damage that mattered was not the 28 dropped events; it was that this dragged **every** symbol's completeness down by a uniform ~0.93 points (7 of 754 sessions). Uniform bias does not look like bias — it looks like a fact about the data, and the founder would have set the S56-A5 floor on it.

**Measured effect of the fix on the distribution the floor is set from:** at a ≥98% completeness floor, the number of names KEPT goes **99 → 137**. The bias was real and it was material.

> **A claim made earlier in this session, and now retracted.** I wrote that this bug was *"why not one of the 229 names cleared a 99% floor."* **That was wrong, and the post-fix data falsifies it:** after the fix, **still 0 of 229** clear 99%. Sub-1% incompleteness is *endemic* — essentially every name is missing at least one bar in ~2% of its sessions, for reasons that have nothing to do with half-days. The half-day bug was real, and it moved the ≥98% line by 38 names; it was **not** the cause of the 99% result. Recorded because a diagnosis that survives only until the fix lands is not a diagnosis.

**The fix (S56-C3).** A session's end is a **market** fact, so it is derived from the **consensus of reference instruments** — SPY + the 11 SPDR sector ETFs — never from a study symbol's own bars. A closing print carries a price but **no volume**; a regular bar carries volume. So per reference: take the session's last priced bar; if it has no volume it **is** the print and the session ends at it (960 full day, **780** half-day); otherwise the session ran one step past it (955 + 5 = 960). That second branch is load-bearing — for **eleven consecutive sessions (2025-10-13 → 2025-10-27)** the vendor emitted no closing print at all, for any symbol.

**Measured: 12/12 reference agreement on every date in the window**, half-days and the October gap included.

On a short session, every bar **at or after** the close is out of session. That covers the 13:00 print (not a regular 5-minute bar — it must not be aggregated into an hourly bucket, nor counted toward the 42 bars the session owed) and a **spurious 16:00 bar** the vendor emits on some half-days for some symbols (NVDA 2024-07-03 had one, giving that session *two* auction bars).

A trading **halt** is the case this deliberately does *not* swallow: the market says 16:00, the halted symbol's feed says otherwise, and the session is correctly flagged incomplete — exactly the hourly bars S56-A4 must refuse to build a class from. Verified at scale: on 2024-07-03 AAPL and NVDA read 42/42 and fully complete, while AEE genuinely delivered 40 of 42 and is **still** flagged incomplete.

### The restraint that matters — and a finding the founder should see

The obvious next step was to promote the 13:00 bar to `auction` (it looks exactly like the 16:00 print: a price, no volume, at the close). **That was tried and backed out.**

**MEASURED: on 3 of the 7 half-days the 13:00 print disagrees with the daily close by 0.107%–0.118% — just OVER A1's 0.1% tolerance.** It is the last 5-minute print, not the official closing auction.

Tagging it `auction` would have **newly subjected half-days to a cross-grain invariant they have never been subject to** (`hasAuction` was false there, so `crossGrainCheck` skipped them) — and 3 of 7 would fail. That is an **A1 breach manufactured by the change itself**. A1 is never loosened, and sessions are not quarantined to accommodate an inference the data does not support. So `hasAuction` stays **false** on half-days, exactly as before; A1 is untouched (AAPL 762/762, NVDA 764/764); and the discrepancy is **reported here rather than absorbed**.

The calendar is used for precisely what it is evidence of — **when the session ended** — and for nothing more.

> **Open question for the founder (not acted on):** the half-day closing print in the 5m feed sits ~0.11% off the daily close on 3 of 7 half-days. Today those sessions are simply not A1-checked. If you want half-days brought under A1, 3 of 7 fail and the ruling is yours.

### The second defect, which is the one worth remembering

The first rebuild after this fix produced a **byte-identical** budget re-read — same 219 drops. That should have been impossible. `03-detect-events.js` **re-normalizes from the raw cache** (it needs the per-bar arrays `sessions.json` does not store) and simply **never passed the calendar**. It rebuilt every hourly bucket against a 16:00 close and stamped pre-fix coverage onto all 166k events. *The sessions on disk were correct. The events were wrong. Nothing failed.*

The enabling defect was not the omission — it was that `sessionCalendar` was an **optional parameter with a silent `null` default**. `normalizeFiveMin` now **throws** if the argument is omitted; passing `null` is a deliberate opt-out available only to the pass that builds the calendar and to fixture tests. `03` additionally hard-fails if `_session_calendar.json` is absent.

This is the same class of error as **L-S56-1** (the GICS field) and the S4 ATR/`u` unit substitution: *a right-looking value with the wrong semantics, accepted silently.* The only reason it was caught is that an unchanged number was treated as suspicious rather than as confirmation.

`STUDY_CONFIG_VERSION` is unchanged by this: no geometric or statistical knob moved. `config.session.sessionCalendar` is new (reference symbols, quorum, `minReferences`), and an under-built calendar is a **hard failure**, never a silent fall back to 16:00.

### S56-A6 — Dead-tape truncation (founder-ruled; pre-registered, outcome-blind)

**The finding.** Once a take-private or all-cash acquisition is **announced**, the stock stops being a stock. It pins to the deal price and realized volatility collapses: the tape is **arbitrage, not price discovery**. Level interactions in that regime are meaningless — everything "holds" because nothing *moves* — and those events would inflate hold rates with non-market behaviour.

**The trap that was avoided.** The obvious fix is to drop the acquired names. That is **survivorship bias we would be adding deliberately** — excluding stocks *because* they were acquired conditions the universe on the future. So the **names are kept and their live history is retained in full.** Only the dead tail is cut.

**The rule (mechanical, from the price series alone — never from news).** Reading a press release and typing in a date is unfalsifiable and unauditable. So the onset is the **EARLIER of two independent criteria**, each requiring the collapse to be *sustained through the symbol's last session*:

**(a) ATR collapse.** `baseline` = median ATR14% over the symbol's **first 252 study sessions** — its *own* normal regime, so a structurally quiet utility is judged against itself, not against NVDA. Onset(a) = earliest session whose **trailing-20 median ATR14% ≤ ⅓ × baseline**.

**(b) Floor-binding collapse.** `u = clamp(0.25×ATR, floorPct%×price, capPct%×price)`. On dead tape ATR collapses, so it is **`floorPct` — not ATR — that sets the geometry**. The floor-binding rate is therefore a direct read on *"has ATR stopped carrying information"*. Onset(b) = earliest session whose **trailing-20 floor-binding rate ≥ 50%**. Computed on the *same* `buildSeries()` code path the real `distanceUnit` uses — the quantity measured is the one the study actually clamps, not a look-alike.

Both then require **pinning**: over `[onset, last]`, `(max − min) / median close ≤ 10%`. A volatility collapse that still walks the price somewhere is a quiet market, not a dead one.

`studyEndOverride` = the session **before** onset. Events after it are excluded; **all earlier history is retained**.

All thresholds (⅓, 50%, 10%) are a-priori round values. **They were not searched over**, and none was chosen by looking at event counts, cell sizes, or outcomes. The rule was applied to **all 229 buildable symbols** — precisely so a hit outside the expected set could not hide.

### Why (b) exists: a diagnosed STRUCTURAL fragility in (a), not a tuning miss

Criterion (a)'s "stays collapsed" clause is evaluated on a trailing-20 **median ATR sitting right at the ⅓ threshold**. A single transient volatility blip — one deal-news day — lifts that median back over the line and **resets the run**, pushing onset forward by however long the blip takes to decay.

**Measured on EA:** (a) dated onset **2026-04-13**, roughly **six months after the tape had already died**, leaving **134 already-pinned sessions in the study**. Those sessions bind the distance floor **86.6%** of the time. EA binds it **0.0%** pre-announcement. That retained dead tape was the *entire* cause of EA's surviving 16.8% clamp breach — EA is not an intrinsically low-volatility name.

The signal (b) reads is a **step function**, which is what makes it immune to the run-reset:

| | pre-announcement | announced, still live | pinned |
|---|---|---|---|
| **EA** | 0.0% | **86.6%** (already dead) | 100.0% |
| **WBA** | 0.0% | **0.0%** (genuinely live) | 79.5% |

Note the WBA row: **(b) does not fire on "a deal was announced."** WBA traded normally for ~2 months post-announcement (its deal carried real financing risk) and binds 0.0% there. The rule detects **dead tape**, not news — which is the entire point.

**This is not the banned move.** The banned move is tuning a threshold to produce a *pre-decided answer* (loosening `COLLAPSE_FRAC` until HES trips because we wanted HES). This repairs a **diagnosed structural fragility** with an independent detector applied uniformly to all 229. The test — *would we accept the rule's answer when it contradicts us?* — was already passed twice: EA in, and HES/CTRA/PARA/IPG/MMC out, both **against** the founder's news list.

### Neither criterion dominates — both are load-bearing

| Symbol | (a) ATR-collapse | (b) floor-binding | onset used |
|---|---|---|---|
| **WBA** | **2025-05-15** | 2025-06-20 | **(a)** — 5 weeks earlier |
| **EA** | 2026-04-13 | **2025-11-05** | **(b)** — 5 months earlier |

Each criterion dates dead tape that the other dates late. That is exactly why the onset is the **earlier of the two**, and why (a) is **not** merely cheap insurance.

### Robustness of the 50% threshold (founder condition 2)

The falsifier: if the fire list moves with the threshold, then the **threshold** is doing the work rather than the signal — a finding, not a rule. Swept 30%→70%:

| Threshold | Names fired | EA onset | Events excluded |
|---|---|---|---|
| 30% | EA, WBA | 2025-10-30 | identical |
| 40% | EA, WBA | 2025-11-03 | identical |
| 50% | EA, WBA | 2025-11-05 | identical |
| 60% | EA, WBA | 2025-11-07 | identical |
| 70% | EA, WBA | 2025-11-11 | identical |

**Fire list: identical at every threshold. Events excluded: identical at every threshold.** WBA's onset is bit-identical throughout. EA's onset drifts ~8 sessions — but **across sessions that contain no events at all**, which is itself corroborating: dead tape produces no level touches *because nothing moves*. **The threshold is not load-bearing; the signal is doing the work.**

**Outcome-blind, and therefore legitimate now:** the announcement was public and contemporaneous. A trader standing at that date would have known.

**The result — the mechanical rule overruled the news list in BOTH directions, and was ruled authoritative:**

| Symbol | studyEndOverride | Dead sessions | ATR vs own baseline | Tail range | Pinned near | Events excluded |
|---|---|---|---|---|---|---|
| **WBA** | 2025-05-14 | 73 | **0.20×** | 8.9% | $11.51 | 38 (5 in-sample F2+) |
| **EA** | 2026-04-10 | 62 | **0.31×** | 3.1% | $202.67 | 12 (all holdout) |

**Total excluded: 50 of 166,213 events (0.03%)** — small, and self-consistently so: dead tape yields few level events precisely *because* price does not move.

**EA was ADDED by the rule.** It is still listed and still printing (through 2026-07-10), so a list built from *"who got acquired"* structurally **cannot see it**. Its tape is nonetheless dead. This is the case that justifies using a mechanical rule at all.

**CTRA, MMC, IPG, PARA, HES were DROPPED from the list.** They have **no dead tail** — ATR at their final print is 1.76× / 1.05× / 1.27× / 0.47× / 0.94× of baseline. Their tape **ends**; it does not **die**. Founder: *"HES at 0.94× ATR at the final print is the clean refutation; I conflated a tape ENDING with a tape DYING."* Their missing sessions are simply absent from the data — there are no events there to exclude.

**Two methods, same two names.** WBA and EA are *exactly* the two symbols that breached the clamp floor-binding criterion (EA 23.6%, WBA 10.8%) — flagged independently, by a detector that knows nothing about acquisitions. The clamp bound because `floorPct`, not ATR, was setting the geometry on dead tape.

**Rejected: loosening the thresholds until the named 6 tripped.** That is tuning a knob until it yields a pre-decided answer — the exact failure the mechanical rule exists to prevent.

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

## §B2 — LESSONS (founder-cited; this is a recurring bug class, not a one-off)

### L-S56-1 — The right-looking field with the wrong semantics

**What happened.** The S5.6 prompt directed: *"Pull sector per symbol from EODHD fundamentals… the EODHD-derived map is authoritative."* EODHD exposes **two** sector taxonomies, and the obvious, default field — `General::Sector` — is **Morningstar**. But the **SPDR Select Sector ETFs track GICS**, and every sector feature in this study (`rs_vs_sector_*`, `sector_rs_vs_spy_*`, `sector_direction_at_touch`, and the peer group itself) is measured **against those ETFs**. Taking the default field would have grouped symbols with an ETF they are not constituents of.

**Measured cost of the near-miss:** on the 237 candidates, Morningstar disagrees with the product map on 4 names — and on **3 of them (`ADP`, `PKG`, `WBA`) the product was right.** Adopting it would have **introduced 3 new errors to fix 1.** Against the correct field (`General::GicSector`) the product map is right on **234/237**.

**The class of error.** This is the **same class as the S4 ATR/`u` unit substitution**: a value that is the right *shape*, arrives under the right *name*, passes every type check, produces plausible numbers — and means **something else**. Neither is caught by tests, because nothing is broken; the code faithfully computes the wrong quantity.

**The standing rule it yields:**

> **When a vendor supplies a taxonomy, a unit, or a basis, name the *consumer* and check the field against it — never against the field's own label.**
> Ask: *what is this number going to be compared to?* The sector must match the ETF the RS is measured against. The distance must be in the same unit as the threshold. The price must be on the same adjustment basis as the band. A field is only "authoritative" relative to a consumer.

Sibling instances already paid for in this study: the ATR-vs-`u` episode thresholds (S4.1, shipped 4× too tight), the raw-vs-split-adjusted volume in RVOL (S5-C21, inflated up to ~10× across a split), and — caught in this same session's code review — the SPAC shell heuristic testing a **nominal** \$10 trust value against **back-adjusted** closes (a de-SPAC that later split would never have been flagged).

### L-S56-2 — A byte-identical result after a real change is a BUG SIGNAL, never a pass

**What happened.** After fixing the half-day session-end defect (§C3) — a change that necessarily moves the coverage of every half-day for every symbol — the full rebuild produced a budget re-read that was **byte-identical to the previous run**. Same 219 drops. Same cell counts. Every digit.

That should have been impossible, and it was: `03-detect-events.js` **re-normalizes from the raw cache** (it needs the per-bar arrays `sessions.json` does not store) and had silently defaulted `sessionCalendar` to `null`. It rebuilt every hourly bucket against a 16:00 close and stamped **pre-fix coverage onto all 166,213 events**. *The sessions on disk were correct. The events were wrong. Nothing failed, nothing warned, and the exit code was 0.*

**The standing rule:**

> **Identical output after a semantic change means something did not run.** Treat a byte-identical result as a **bug signal**, never as confirmation. Before making a change, state which number should move and roughly by how much; if it does not move, hunt for the stale path *before* doing anything else.

**The enabling defect, and the second rule it yields.** The omission was possible only because the parameter had a **silent default**. `normalizeFiveMin` now **throws** if `sessionCalendar` is omitted; passing `null` is a deliberate opt-out available only to the pass that *builds* the calendar and to fixture tests.

> **Never give a load-bearing parameter a silent default.** Make omission an error and make opting out an explicit act. A default that is *usually* right is a defect that is *invisibly* wrong.

This is the same family as [L-S56-1](#l-s56-1--the-right-looking-field-with-the-wrong-semantics): a right-*looking* value accepted silently. The only thing that caught it was refusing to accept an unchanged number as a pass.

**Applied immediately, as the founder directed:** if the S56-A6 dead-tape truncation had not moved the event counts, that would itself have been the bug signal. It moved them by 50.

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
