# CORRELATION INTELLIGENCE — V2 ROADMAP
## From two-asset comparison to a factor-aware relationship engine

Status: V0 (engine) and V1.1 (exposure: Discover tab, verdict sentence, tension gauge, break context) are live on main. This document pins the V2 direction: what expands, in what order, and under which honesty guards. Each phase gets its own build spec + Phase-0 anchor verification + one branch, per house process.

---

## The Three-Bucket Framework (the core design decision)

Every "add X to the tool" idea sorts into exactly one bucket. Keeping them distinct is what keeps the tool honest and the architecture clean.

**Bucket A — DRIVERS (daily price series).** Anything with its own daily closes can slot into the existing registry and engine unchanged: sector ETFs, factor ETFs, credit, rates, crypto, international. Cost: near zero per driver.

**Bucket B — CONDITIONS (market states).** Technicals, volatility regimes, and trend states are derived from the same prices — you can't correlate against them, but you can *partition by* them: what's the link on driver down-days? In high-vol regimes? Below the 50DMA? These become conditional correlation and conditioned base rates.

**Bucket C — SEPARATE STUDIES (different math).** Seasonality is a calendar base-rate study. Earnings behavior is an event study (future convergence with the existing earnings-calendar pipeline). Neither is a correlation; both are future panels, not registry entries.

---

## Phase 1 — Driver Registry Expansion (Bucket A) · BUILD NEXT

Grow from 7 to ~24 drivers, organized in categories that render as grouped sections in the driver select:

| Category | Drivers (all EODHD-verified paths) |
|---|---|
| Macro (existing) | BNO (Brent) · USO (WTI) · GLD · VIX.INDX · TNX.INDX · UUP (Dollar) · SPY |
| Sectors | XLE · XLF · XLK · XLV · XLI · XLY · XLP · XLU · XLB |
| Style factors | MTUM (momentum) · VLUE (value) · QUAL (quality) · USMV (low-vol) |
| Risk & rates | HYG (credit appetite) · TLT (long duration) · IWM (small caps) · RSP (equal-weight breadth) |
| Digital | BTC (BTC-USD.CC — the one non-.US symbol; verified live before merge) |

Why factors matter: correlating a group against VLUE vs MTUM answers "is this trading like a value stock or a momentum stock *right now*" — fundamental-style insight through the existing engine. Why sectors matter: "is my group moving with its sector or on its own story" is the most common real question. Registry entries carry category + label + betaInterpretation exactly as today. Verification protocol (the BZ.COMM lesson): every new symbol run once live on preview before merge.

## Phase 2 — Multi-Driver Scan (the anomaly finder)

One click: run the group against ALL registry drivers, ranked by current |corr20|, each row showing corr20/corr60/tension state. This is where "your energy trio is tracking the dollar more tightly than oil right now" surfaces — and the future feed for agents, Signal Drop, and Discover.

**Honesty guards (pinned now, enforced in the spec):**
- Multiple-comparisons floor: with ~24 drivers on ~500 observations, the expected max spurious |corr| under no relationship is ~0.12. Scan rows highlight only at |corr20| ≥ 0.20; below that they render, greyed, as "weak/none."
- Language: scan results are "tracking most tightly right now — worth investigating," never "discovered" or "predicts."
- Architecture: a scan endpoint that fetches the group ONCE and computes per-driver (not N endpoint calls); cached under group+ALL; drivers fetched in the existing chunked batches. Cost: one extra batch per scan, trivial.

## Phase 3 — Break Context v2 (Bucket B begins: technical state at the flag)

The statistical trigger stays pure and unchanged — SDS on the 20/60 divergence, floor, persistence. What's added is *context at the moment each break fired*, stamped per episode: composite price vs its own 50DMA, RSI(14) zone from composite levels, and volume regime once volume rides the fetch (additive row field). Then the payoff: **conditioned base rates** — "breakdowns that fired below the 50DMA: N episodes, median X at 10d" — partitioned with the existing tier discipline (no median under 3 independent per partition, no percentage under 5). Ingredients already exist: technicalCalculations.js, the Volume Regime primitive spec, composite levels in the endpoint.

## Phase 4 — Conditional Correlation (Bucket B, generalized)

Split the correlation by pinned condition sets: driver up-days vs down-days (sign asymmetry — energy often tracks oil tighter on down days); calm vs high-vol (composite 20d realized vol vs its own median); above vs below the group's 50DMA. Guard: minimum 60 return observations per condition side, else that side renders null — same null-never-zero discipline.

## Phase 5 — Intra-Group Cohesion

Average pairwise corr20/corr60 among the group's own members (requires group ≥ 3; pair count always shown). Answers "is 'energy stocks' even behaving as one thing this month?" Free compute — members are already fetched. Direct archetype relevance (Diversifier) when agents consume it later.

## Phase 6 — Agent-Book Mode (the platform bridge)

"Analyze my watchlist" / "Analyze my agent's book": prefill the group from the equipped watchlist or an agent's current holdings. Read-only reads of existing docs; zero fence contact; the moment the Lab stops being only a manual tool. Voice-layer narration of the verdict sentence naturally follows this phase.

---

## Standing roadmap (unchanged, slots after or alongside)
Pair mode (any ticker as driver — cheap, can ride Phase 1 or 2) · news attribution for breaks (FantasyTimes) · seasonality panel (Bucket C study) · earnings event study (Bucket C; converges with the earnings-calendar pipeline) · EWMA beta · true-spot commodity series.

## Cross-cutting honesty principles (bind every phase)
1. Deterministic math only in the engine; LLMs may narrate, never compute.
2. Every threshold scales with comparison count (the scan floor exists because 24 comparisons manufacture coincidences).
3. Every partitioned statistic inherits the tier discipline (n-first, no % under 5 independent, dot plots).
4. Past-tense, sample-bounded copy; "tracking," never "predicts"; SDS is never significance.
5. Nulls gap; nothing renders as zero or as clean-empty when it's actually suppressed.
6. New symbols are verified live before a spec locks them (the BZ.COMM lesson).

## Cost profile
Zero new cron slots, zero LLM calls, zero schema migrations. EODHD load: Phase 1 adds nothing per-query (same one-driver fetch); the Phase 2 scan adds ~24 symbols per uncached scan — trivial against the 100K/day budget and cached until next close. All server work rides the existing endpoint, cache, and function-slot posture.

## Sequencing
Build 1: Phase 1 (days — registry + grouped select + smoke) → Build 2: Phase 2 scan (the headline V2 feature) → Build 3: Phase 3 break context v2 → Build 4: Phase 4 conditional → Build 5: Phase 5 cohesion → Build 6: Phase 6 agent-book. Pair mode folds into Build 1 or 2 opportunistically. Each build: Phase-0-lite anchors → spec → one branch → tests → founder smoke → review at thresholds → PR.
