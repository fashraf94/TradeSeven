# LEVELSTORY S5.6 — PHASE B REPORT (universe expansion, pre-registration freeze)

**Branch:** `claude/level-study-s5-6-universe-expansion`
**Config:** `STUDY_CONFIG_VERSION = 4` — provenance only. **No geometric or statistical knob changed value.** Geometry, questions, floors, study window and holdout are unchanged; only the symbol set grew.
**Suite:** 163/163 green.
**Status:** Session-6 ready, subject to the three open rulings in §9.

---

## §1 — THE HELD ITEM: the third product-map disagreement

**It was `GEV` (GE Vernova).**

| | |
|---|---|
| **Symbol** | `GEV` |
| **Product label** (`api/_utils/rankingConfig.js`) | `XLI` — Industrials |
| **GICS label** (EODHD `General::GicSector`) | **`XLU` — Utilities** (industry: *Independent Power and Renewable Electricity Producers*) |
| **The call made** | **Not resolved. Moot by exclusion.** |

GEV fails **R2** (zero pre-study sessions — it spun out of GE in April 2024), so it never entered the universe. It has no sector entry, no peer group, and no RS benchmark, and the disagreement therefore never had to be adjudicated.

**It was recorded** — `universe_frozen.json` → `unresolvedButMoot` — specifically so the disagreement cannot be silently inherited if GEV is revisited on a later window.

**But it was resolved silently, and that was wrong.** The Phase A report escalated AFRM and BE and did not name GEV. "Right on 234/237" with only two disagreements discussed is a report that does not add up, and the founder caught it. The correct behaviour was to name all three and state that one was moot. **My omission.**

---

## §2 — Universe v2

| | |
|---|---|
| Candidates swept | 237 |
| Frozen | **232** |
| Buildable | **229** (3 A1-quarantined — see §8) |
| Sectors | 11/11 populated (min 19 — XLE/XLU/XLC; max 26 — XLK) |
| Strata | 77 LOW_VOL / 77 MID_VOL / 78 HIGH_VOL |
| Context | SPY + **all 11 SPDR sector ETFs** (daily series *and* 5m direction tags) + SPHB/SPLV (daily-only) |

**Excluded at the gate:** HOOD, CEG, CRWV, GEV (R2 — insufficient pre-study history); RKLB (SPAC shell — 64 sessions at $10.35 ± $0.22, then ×7.2 volume on 2021-03-01; shell-era bars sit inside the 504-session extension window).

**Sector rulings applied:** AFRM → **XLF** (deliberate founder override of GICS/XLI: *"the map exists to capture economic peer similarity, not taxonomic correctness"* — Affirm is a BNPL consumer lender). BE → **XLI** (genuine product error; GICS is right).

**The GICS near-miss.** The prompt directed `General::Sector` — which is **Morningstar**. The SPDR sector ETFs track **GICS**, and every sector feature in this study is measured *against those ETFs*. Following the prompt literally would have **introduced 3 new errors (ADP, PKG, WBA) to fix 1 (BE)**. Against the correct field (`General::GicSector`) the product map is right on **234/237**. Recorded as lesson **L-S56-1**.

---

## §3 — What the expansion bought

| Feature | 11 symbols | 229 symbols |
|---|---|---|
| `peer_level_event_rate_prior_5d` null | ~100% | **0%** |
| `sector_rs_vs_spy_*` null | 53.5% | **0%** |
| RVOL null, first 20 sessions | 72.6% | **0.0%** |
| RVOL null, elsewhere | 30.6% | **0.0%** |
| Events | 8,446 | **166,118** |
| P6 regime interaction (12 cells) | fallback ladder expected to fire | **0 underpowered — ladder does NOT fire** |

The 5-minute **warmup** (30 trading sessions before `studyStart`, S5.6 §3) is what removes the RVOL nulls: the 20-session RVOL baseline is now full on study-session-1. Verified at scale.

**P6's pre-registered fallback ladder does not fire.** All 12 regime-interaction cells clear both floors (smallest n=297, uniqueDates=84). At 11 symbols this was the cell most likely to collapse.

---

## §4 — S56-C3: the market session calendar (a build fix)

The S56-A4 coverage guard needs to know how many 5-minute bars a session *should* have delivered. Three sources were tried; the first two are unsound:

| Source | Why it fails |
|---|---|
| the symbol's **own last delivered bar** | Cannot distinguish "the market closed" from "my feed stopped." A truncated session **certifies its own completeness** — biasing clean on exactly the thin names S56-A5 exists to detect. |
| the symbol's **closing auction print** | **MEASURED: EODHD emits no auction print on half-days.** On all 7 in the window, `hasAuction === false` for **229/229** symbols. |

**The fix:** the session end is a **market** fact, derived from the consensus of SPY + the 11 SPDR ETFs. A closing print carries a price but **no volume**; a regular bar carries volume. Per reference: take the last priced bar — no volume ⇒ it *is* the print and the session ends at it (960 full day, **780** half-day); has volume ⇒ the session ran one step past it (955 + 5 = 960). That second branch covers **2025-10-13 → 2025-10-27**, eleven consecutive sessions where the vendor emitted **no closing print at all, for any symbol**.

**12/12 reference agreement on every date in the window.** Study sessions with no calendar entry: **0**.

**What it cost before the fix:** every half-day was measured against a 78-bar expectation and read as a ~53% data gap. A4's drop rate on half-days was **16.5% vs 0.67% elsewhere**. At a ≥98% completeness floor, names kept goes **99 → 137**.

**A claim I made and now retract:** I said this was *"why not one of the 229 names cleared a 99% floor."* **Wrong** — post-fix, still **0 of 229** clear 99%. Sub-1% incompleteness is *endemic*. The bug was real and moved the ≥98% line by 38 names; it was not the cause of the 99% result.

**The restraint that matters.** The 13:00 bar looks exactly like an auction print, and promoting it to `auction` was tried and **backed out**: on **3 of the 7 half-days it disagrees with the daily close by 0.107–0.118%**, just over A1's 0.1% tolerance. Tagging it `auction` would have newly subjected half-days to a cross-grain invariant they have never been subject to, and 3 of 7 would fail — **an A1 breach manufactured by the change itself.** A1 is never loosened. `hasAuction` stays false on half-days; the discrepancy is reported, not absorbed. *(Open item for the founder: if you want half-days brought under A1, 3 of 7 fail.)*

---

## §5 — S56-A6: dead-tape truncation

Once a take-private is **announced**, the stock pins to the deal price and volatility collapses: the tape is **arbitrage, not price discovery**. Level interactions there are meaningless — everything "holds" because nothing *moves*.

**The names are KEPT.** Dropping stocks *because* they were acquired is survivorship bias we would be adding deliberately. Only the dead tail is cut, at a date derived **mechanically from the price series**, never from news.

**Onset = the EARLIER of two independent criteria** (both requiring the collapse to be sustained through the last session, and the tail pinned within a 10% band):
- **(a) ATR collapse** — trailing-20 median ATR14% ≤ **⅓ × the symbol's own 252-session baseline**.
- **(b) Floor-binding collapse** — trailing-20 **floor-binding rate ≥ 50%**. On dead tape it is `floorPct`, not ATR, that sets `u` — so this is a direct read on *"has ATR stopped carrying information."*

### The result — the rule overruled the news list in BOTH directions

| Symbol | studyEndOverride | Dead sessions | ATR ratio | Tail floor-bind | Tail range | Pinned near | Events excluded |
|---|---|---|---|---|---|---|---|
| **WBA** | 2025-05-14 | 73 | 0.20× | 79.5% | 8.9% | $11.51 | **38** |
| **EA** | 2025-11-04 | 169 | 0.31× | 100% | 4.8% | $202.57 | **39** |

**Total excluded: 77 of 166,195 events (0.05%).** Small, and self-consistently so — dead tape yields few level events precisely because price does not move.

- **EA was ADDED by the rule.** It is still listed and still printing (through 2026-07-10), so a list built from *"who got acquired"* structurally **cannot see it**.
- **CTRA, MMC, IPG, PARA, HES were DROPPED.** ATR at their final print is 1.76× / 1.05× / 1.27× / 0.47× / 0.94× of baseline. Their tape **ends**; it does not **die**. (HES at 0.94× is the clean refutation — the Exxon arbitration left its deal genuinely uncertain, so it kept trading like a stock.)

### Neither criterion dominates

| Symbol | (a) ATR-collapse | (b) floor-binding | used |
|---|---|---|---|
| WBA | **2025-05-15** | 2025-06-20 | **(a)** — 5 weeks earlier |
| EA | 2026-04-13 | **2025-11-05** | **(b)** — 5 months earlier |

Criterion (a)'s "stays collapsed" clause is evaluated on a trailing median sitting *at* the ⅓ threshold, so a single deal-news volatility blip **resets the run**. On EA that pushed onset six months late and left 134 already-pinned sessions in the study (they bind the floor **86.6%**; EA binds it **0.0%** pre-announcement). Criterion (b) reads a **step function** — live ~0%, dead ~80–100% — and is immune to that reset. Each criterion dates dead tape the other dates late; **(a) is load-bearing, not insurance.**

### Robustness (founder condition 2)

| Threshold | Names fired | EA onset | Events excluded |
|---|---|---|---|
| 30% → 70% | **EA, WBA at every threshold** | drifts 2025-10-30 → 2025-11-11 | **identical at every threshold** |

**Fire list identical. Events excluded identical.** WBA's onset is bit-identical throughout. EA's onset drifts ~8 sessions — across sessions containing **no events**, which is itself corroborating. **The threshold is not load-bearing; the signal is doing the work.** The rule was applied to **all 229** buildable symbols and fired on **nothing unexpected**.

---

## §6 — S56-A5: data completeness (the founder sets the floor)

### The predicted confounder is ABSENT

| Spearman(completeness, ·) | ρ | |
|---|---|---|
| **median share volume** | **+0.60** | ← **the real driver** |
| median daily $ volume | +0.37 | the *predicted* driver — present but weaker |
| median share price | −0.23 | |
| **ATR%** | **+0.12** | **no material relationship** |

A 5-minute bar is absent when **no trade printed** in that window. That is **trade frequency**, not dollar liquidity and not volatility. The worst names are **high-priced mega-caps** — BKNG turns over **$23bn/day** and is only 23.9% "complete", because at ~$5,000/share so few *shares* change hands that quiet 5-minute windows have zero prints.

**This matters because the feared mechanism was: incompleteness ↔ illiquidity ↔ volatility ↔ reaction quality — a hidden confounder in every cut. Measured, that chain is broken at the first link (ATR ρ = +0.12).**

### The distribution

`% of study sessions 100% complete`, across 229: **median 98% · p25 97.3% · p10 93.4% · p5 75.6% · min 19.9%**

### The two candidate floors

**(a) COSMETIC — "% of sessions 100% complete".** One absent bar in an otherwise perfect session fails it. A floor here culls mega-caps for no reason:

| Floor | Kept | Culled |
|---|---|---|
| ≥99% | **0** | 229 |
| ≥98% | 138 | 91 |
| ≥95% | 196 | 33 |
| ≥90% | 210 | 19 |

**(b) OPERATIVE — "% of a symbol's gated events S56-A4 must DROP".** This is what incompleteness actually *costs* the study. Distribution: **median 0% · p90 0.8% · p99 12.7% · max 61.4%**.

| Max drop allowed | Kept | Culled |
|---|---|---|
| >50% | 228 | **AZO** (61.4%) |
| >20% | 227 | AZO, **BKNG** (44.4%) |
| >10% | 226 | AZO, BKNG, **CMG** (12.7%) |

Worst: AZO 61.4% · BKNG 44.4% · CMG 12.7% · ORLY 8.3% · EQIX 4.7% · EXC 1.9% · BLK 1.8%

### My recommendation (the founder decides)

**Floor on the OPERATIVE metric at >20% dropped → culls AZO and BKNG only.** Rationale, in the same spirit as `floorPct`/`capPct` being set from measured binding rates: the cosmetic metric culls names whose data is *fine* (a single missing bar), while the operative metric culls exactly the names whose **hourly confirmation classes S6 cannot trust** — and only those two are anywhere near material. The median symbol drops **0%**.

**⛔ The floor is yours to set, before Session 6. If it culls names, that is a finding, not a failure.**

---

## §7 — Clamp binding at 229 (R3: report, do not re-tune)

**Criterion: each guard binds ≤10% of symbol-sessions, for EVERY symbol.**

**Resolved by the dead-tape truncation — exactly as predicted:**

| Symbol | floor-binding (study) before | after |
|---|---|---|
| **WBA** | 10.8% | **0.0%** |
| **EA** | 23.6% | **0.0%** |

**Two breaches survive, and both are FULL-HISTORY-ONLY cap bindings:**

| Symbol | floor study/full | cap study/full | |
|---|---|---|---|
| **AFRM** | 0.0% / 0.0% | **1.6% / 17.2%** | ⚠ >10% on full history |
| **GME** | 0.0% / 0.0% | **5.7% / 11.8%** | ⚠ >10% on full history |

**In the study window both are clean** (1.6%, 5.7%). The breach is confined to pre-study history — AFRM's 2021–22 IPO-era volatility and GME's meme squeeze — which the **cap is arguably doing its job** on (it exists to catch the extreme-ATR tail). But full history *is* read by the 504-session extension window and the 252-session trend-origin lookback, so it is not cosmetic.

**NOT RE-TUNED.** The tool's own recommendation would be `floorPct=0.14, capPct=3.02`. **This is a founder ruling and a config-v4 conversation.**

---

## §8 — A1 cross-grain quarantine (R1: approved)

Three of 232 are **quarantined, not repaired**:

| Symbol | Sessions failing A1 | Constant ratio | Break date |
|---|---|---|---|
| **DD** | 589/758 (77.7%) | **2.3909×** | 2025-10-31 |
| **LEN** | 410/764 (53.7%) | 1.0074× | 2025-01-17 |
| **K** | 88/618 (14.2%) | 1.0657× | 2023-09-29 |

**Cause:** EODHD **back-adjusts the daily `close` for SPINOFFS** but delivers 5-minute bars **as printed** (DuPont/Qnity, Lennar/Millrose, Kellogg/WK Kellogg). A1's premise — *"the daily close is the raw point-in-time print"* — is **false for spinoff names**, on every session before the spinoff.

**Consequence if included:** levels/ATR would be built on the spinoff-adjusted daily basis while events are detected on the non-spinoff-adjusted 5m basis. For DD the two grains differ by **2.39×** — every level would sit 139% away from every 5m bar.

**Why not repaired:** re-deriving the adjustment factor from the auction print would make the invariant **pass by construction** and destroy the diagnostic that caught it. Parent §4.3: *quarantine, don't degrade.*

---

## §9 — OPEN RULINGS (Session 6 is blocked on these)

1. **The S56-A5 completeness floor.** My recommendation: operative metric, >20% drop → culls **AZO, BKNG**. (§6)
2. **The surviving clamp breaches: AFRM (cap 17.2%) and GME (cap 11.8%), full-history only.** Not re-tuned. Config-v4 conversation. (§7)
3. **Half-days and A1** (minor): the half-day 13:00 print sits ~0.11% off the daily close on 3 of 7 half-days. Those sessions are currently not A1-checked. If you want them brought under A1, 3 of 7 fail. (§4)

---

## §10 — Session-6 readiness

| Gate | Status |
|---|---|
| Every pre-registered question clears n≥30 **and** uniqueDates≥15 | ✅ |
| P3 `null_rvol` | ✅ **0 on both sides** |
| P6 regime interaction (12 cells) | ✅ 0 underpowered — fallback ladder does not fire |
| Peer / sector-RS feature nulls | ✅ 0% |
| `NO_PRE_BAR_DATA_GAP` | ✅ 11 events total (data-quality class; never pooled into OPEN_TOUCH) |
| S56-A4 hourly-eligibility drop | ✅ 203 events = **0.7%** of F2+ |
| Anomaly scan (event-side) | ✅ 0 warnings |
| Suite | ✅ 163/163 |
| Mid-range 5m gaps across 244 symbols | ✅ **0** (7 tail-only truncations, all delistings) |
| Session calendar coverage | ✅ 754/754, 0 uncovered |

**Confounds (reported, not acted on):** ATR% ↔ F2+-share **−0.43**; ATR% ↔ GAP_BREAK-share **+0.41**. Higher-volatility names produce proportionally fewer confluent levels and more gap-breaks. Pre-registered as a *reported* confound; no knob was moved.

**Performance note (not a correctness issue):** two ~300–20,000× wall-clock outliers (YUM 49 min in one events run; MA 612s in one features run) **did not reproduce** — the same symbols ran in 146 ms and 1.8 s on identical input across three runs. These are **I/O stalls** (Windows Defender), not algorithmic. Separately, the peer layer is an **un-indexed per-event scan** (`lib/features-market.js:175`) costing ~1.8 s/symbol; a `Map<sector+date → peers>` index would collapse it. **Post-session, perf only** — verification is free, since the original 11 symbols must produce byte-identical output (peers < 5 there, so every peer feature is null).

---

## §11 — Pre-registration integrity

- **No knob was tuned against event counts, cell sizes, or budget outcomes.** `floorPct` (0.26) and `capPct` (2.71) are **unchanged** despite two surviving breaches.
- **No independence rule was loosened.** A1's 0.1% tolerance is untouched — including when a change of mine would have manufactured a breach (§4).
- Geometry, questions, floors, window, holdout: **unchanged.**
- All S5.6 amendments (**S56-A1 … A6**, **C3**) were recorded **before** the code that implements them, and **before any outcome exists**. Session 6 has not run.

**Lesson recorded — L-S56-2:** *a byte-identical result after a real semantic change is a **bug signal**, never a pass.* It is what surfaced the defect chain in §4: after the half-day fix, the budget re-read came back byte-identical because `03-detect-events.js` re-normalizes from raw and had silently defaulted the session calendar to `null`. The sessions on disk were right; all 166k events were wrong; nothing failed. `normalizeFiveMin` now **throws** if the calendar argument is omitted — *never give a load-bearing parameter a silent default.*
