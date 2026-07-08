# CORRELATION INTELLIGENCE — V3 ROADMAP
## From "how linked?" to "why, who, how much, and how much should I trust it?"

Status: V0 (engine), V1.1 (exposure), V2 (Builds 1–6: driver expansion, scan, break context, conditional, cohesion, agent-book) all live on main. This document pins the V3 direction, reconciled from two independent external reviews (ChatGPT + Claude Fable, Jul 2026) of the master reference. Each build gets its own spec + Phase-0 anchor verification + one branch, per house process. The honesty model (BUILD_RULES §9 and the six principles) binds every item without exception.

---

## The V3 thesis (both reviewers converged here)

The Lab measures "how linked is this group to this driver" extremely well. It does not yet answer the four questions that make a measurement *actionable*: **why** is the link showing up (is it just market beta?), **who** is causing it (which member?), **how much should I trust this read** (is it stable, broad-based, one-name-driven?), and **does it only matter in stress** (tail behavior)? V3 is the attribution + diagnosis + trust arc. It is deliberately sequenced *before* the voice-layer narration arc, because narration with nothing to explain paraphrases charts — the relationship-quality upgrade is what gives the voice layer judgment to narrate.

---

## The reconciliation (where the two reviews agreed, added, and corrected)

- **Agreed (both):** member contribution first; beta asymmetry; tail co-movement; correlation stability (as "past stability," no "half-life" without fitting decay); ship relationship-quality before voice; defer OLS residualized beta and clustering to post-voice; two-gate driver verification (EODHD availability + liquidity).
- **Fable added (highest-value gaps):** (1) **partial correlation vs SPY** — closed-form over correlations already computed, ~80% of residualization's value at ~10% of cost, the feature that flips scanner → exposure diagnosis; (2) **self-percentile baseline** — cheapest high-value metric, "today's link is in the Nth percentile of its own 2-year history"; (3) **the comparison tax** — new scan drivers dim existing signals, so cap the default scan and make additions an opt-in extended tier; (4) **the summary contract** — voice narration and agent consumption are the SAME pre-computed object, so its schema is part of the pre-voice arc.
- **Fable corrected:** ChatGPT's trust panel as a weighted composite is a §9 violation (a parallel source that can drift) — rebuild it as a **checklist of displayed facts**, badge = conjunction of visible thresholds, never a score. And **CEW is a shell** (both reviews independently flagged its liquidity; substitute EMLC, honestly labeled).

---

## THE THREE BUCKETS (V3 restatement of the standing framework)

- **Bucket A — new drivers (daily price series):** currencies, real rates, commodity sub-complexes, semis, IG credit. Two-gate verified, admitted to an EXTENDED tier under the comparison-tax rule.
- **Bucket B — new derived metrics over existing data:** contribution, partial correlation, percentile, asymmetry, tail, stability. Nearly all free — they run on data already fetched.
- **Bucket C — synthesis & contracts:** the read-quality checklist, what-changed deltas, and the pre-computed summary object that voice + agents both consume.

Bucket B and C are the heart of V3. Bucket A is real but gated and secondary — the reviews were emphatic that "more correlation / more drivers" is NOT the high-value frontier; attribution and trust are.

---

## PHASE 1 — THE PRE-VOICE "RELATIONSHIP QUALITY" BUNDLE (build next, as ONE arc)

Both reviewers independently recommended shipping this as a unit before narration. It is specced as one bundle because the items share the assembly core, the honesty gates, and — critically — all feed the summary contract that is the voice layer's input. Likely split into 2–3 sub-builds behind one flag, but designed together.

**Bucket B metrics (mostly free — existing data):**
1. **Member contribution** — leave-one-out correlation & beta: which member *is* the relationship. Honesty: require ≥3 names; name a top contributor only when it beats the next by a real margin (≥0.10 corr or a defined beta gap), else "broad-based."
2. **SPY-adjusted partial correlation** (the exposure-diagnosis keystone) — closed-form `r(group,driver|SPY)` from the three pairwise correlations already computed. Show raw and adjusted side by side per scan row and in the deep dive. Suppress the adjusted value when |r(driver,SPY)| > ~0.9 (the driver IS market beta — adjustment is meaningless). Label "SPY-adjusted historical link," never "true exposure."
3. **Self-percentile baseline** — where today's corr20/corr60 sits in this pair's own 2-year rolling distribution. "Today's 1-month link is in the Nth percentile of the past two years." Distinct from the tension gauge (percentile-of-level vs divergence-of-gap).
4. **Beta asymmetry** — down-capture vs up-capture (driver-down-day beta vs driver-up-day beta). Reuses the conditional honesty structure: n-first, no % under 5, no claim unless the side gap clears a floor (~0.20 or ~25% relative).
5. **Tail co-movement** — co-crash / co-rally frequency on the worst/best driver days (deciles when sample supports, else bottom/top 20%). "In the N weakest driver days in this sample, the group was also down X%." Turns correlation into risk context without predicting.
6. **Correlation stability** — sign persistence and time-above-threshold over the rolling series. "The link stayed positive in N% of observed 20-day windows." Named "past stability," never "durability."
7. **Driver-side context** (Fable's small note) — one line: the driver's own trailing 20-day return + vol percentile, so a 0.6 link to a dead-flat driver reads differently than to a screaming one.

**Bucket C synthesis:**
8. **Read-quality checklist** (NOT a score — the §9-safe construction) — a panel of displayed criteria each shown next to its actual on-screen number: stable link? strong cohesion? broad-based contribution? adequate sample? market-proxy-explained? tension state? The badge (high-confidence read / fragile read / stress-only read / market-proxy read) is the conjunction of visible thresholds. Every word derivable from a number on that screen. Called "read quality," framed as quality-of-the-historical-measurement.
9. **What-changed-since-last-scan** — rank/correlation/beta deltas, new & dropped top drivers. Requires snapshot persistence in `correlationIntelligence`; baseline = **prior trading day's cached scan** (never per-user "last scan" — that creates state and ambiguity). Only call a change past a floor (|Δr| ≥ 0.15 or rank shift ≥ 5). This is the single most useful thing the voice layer will narrate.
10. **THE SUMMARY CONTRACT** (the keystone deliverable) — a compact, deterministic, pre-computed object written at scan/deep-dive cache time: top drivers post-SPY-adjustment, read-quality facts, tension state, self-percentile, what-changed deltas. Designed as the voice layer's input contract AND the future agent-consumption object (via the existing pre-computed-intelligence path, fence untouched — "one engine, two surfaces"). Its schema is the reason this bundle ships before voice.

**Bucket A drivers (gated, extended tier):**
11. **Liquidity gate build** (prerequisite for any new driver) — a data-quality floor (min average volume + stale-print/single-print-day check) that a driver must pass before entering the scan. This is why CEW is out and why every addition is verified live, not asserted.
12. **Extended-tier drivers**, two-gate verified before locking: **SMH** (clean semis / AI-infra read, with an overlap warning when the group holds SMH-heavy names), **CPER** (copper / industrial-growth, "futures ETF proxy"), **FXY** (yen / carry & risk-off), **TIP** (TIPS duration proxy), **EMLC** (EM local-currency proxy — replaces the shell CEW). Default scan stays ~25; these are opt-in extended. QQQ CUT (collinear with SPY/XLK/MTUM). LQD admitted only as the HYG−LQD spread family (post-voice).

---

## PHASE 2 — VOICE-LAYER NARRATION (the next arc after Phase 1)

Generative, read-only, consumes the Phase-1 summary contract. Must inherit the full honesty model as *generation constraints* (past-tense, sample-bounded, never predictive, SDS-is-not-significance, display-agreement). Gets its own product-stance doc before any code — the stance doc is the artifact we run adversarial review against, same role the numerical policy played in V0. Human-facing narration first (more contained); agent-as-consumer second. Explicitly NOT pushing correlation into `decide.js` — that is the §7 fence process and out of scope for this entire arc.

---

## PHASE 3 — POST-VOICE DEEPER DIAGNOSIS

- **OLS residualized beta** — full multi-factor exposure after removing SPY/sector, with collinearity suppression. "SPY-adjusted historical link," raw and adjusted side by side. The serious second arc of exposure diagnosis (partial correlation was the cheap 80%).
- **Cross-driver clustering** — cluster the top-8 scanned drivers by their own return correlations into "same trade" buckets, so five ranked rows read as "the rates/growth complex," not five independent signals. Under the comparison-count rule.
- **HYG−LQD spread family** — separate credit-risk appetite from rates+credit.
- **Remaining FX** (FXE, and CEW's replacement tier), **UNG** (natgas / power complex), **RINF** (inflation-expectations proxy — pending its own liquidity screen).
- **News attribution** for regime breaks (FantasyTimes) — only once event matching is deterministic and cited.
- **Portfolio-weighted composites**, rolling cohesion/conditional series, RSI-conditioned base rates, EWMA beta, true-spot series — the standing refinements.

---

## Cross-cutting honesty principles (bind every V3 item — unchanged from V2, restated)
1. Deterministic only in the engine; the voice layer narrates, never computes.
2. Every threshold scales with comparison count (the extended-driver tier and clustering both inherit this).
3. Every partitioned/tail statistic inherits the small-sample tier discipline (n-first, no % under 5, dot plots).
4. Display-agreement (§9): every word/label/badge derives from a value the user sees — the reason the read-quality panel is a checklist, not a score.
5. Past-tense, sample-bounded, never predictive; "past stability" not "durability"; "SPY-adjusted link" not "true exposure"; "read quality" not "confidence."
6. Selection/truncation/contamination surfaced, not hidden (partial correlation exists to surface market-beta contamination that raw correlation hides).
7. New drivers are two-gate verified (EODHD availability + liquidity) before a spec locks them (the CEW/BZ.COMM lesson).
8. Calibration fence untouched — the Lab reads and computes; it never feeds agent decisions without the §7 gated process.

## Cost profile
Bucket B is nearly free (existing data, pure math). The summary contract and what-changed add snapshot persistence to an existing Firestore collection (no new collection, no cron). Extended drivers add EODHD symbols only when a user opts into the extended scan. Zero LLM calls in Phase 1 (the voice layer in Phase 2 is the first generative surface). Zero cron slots. Fence untouched throughout.

## Sequencing
Phase 1 as ONE designed bundle (2–3 sub-builds behind one flag: metrics → synthesis+contract → gated drivers), founder-smoked and merged → Phase 2 voice layer (stance doc → adversarial review → build) → Phase 3 deeper diagnosis. The summary contract is the hinge: it is the last thing built in Phase 1 and the first thing consumed in Phase 2.
