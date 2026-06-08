# Scouting Focus — Replay Harness Findings (Stage-0 Gate)

_Generated 2026-06-08T20:04Z · 10 synthetic market states (5 regimes × 2 seeds) · real engine, real symbols/sectors._

> **Snapshot answer — POINT-IN-TIME.** The daily ranked universe is one overwritten Firestore doc
> `indexIntelligence/stockRankings` (`compute-index-intelligence.js:1090`, `batch.set`). No date-keyed
> history/archive collection exists, so no past market states are retrievable; the harness cannot prove
> regime-robustness from real data. In this sandbox there are also no Firebase Admin creds and no
> fixtures, so even today's doc is unreachable — per-stock metrics are **synthetic**. What stays real:
> the symbols + 11-sector structure (`STOCK_UNIVERSE`), the metric *shape* the cron writes, and the
> ranking/screening engines. The 5 regimes × 2 seeds are a robustness *proxy*, not historical days.

**Setup.** Acceptable band = top 40% of the archetype ranking (≈ top 96 of 239). Starters = 6 (star+core+support). Shortlist = 35. Tier cap: a near-band name can rise into the shortlist but not become a starter in one tilt. Adaptive bonus = 0.6 × (decile−median score spread) × tilt.

**Two draft models.** *B = draft off the top of the (tilted) ranking* (the signal the LLM draft consumes — most representative). *A = deterministic buildFallbackPortfolio* (LLM-failure path; shows downstream muting).

**Columns.** WL-ovl = alt-vs-default *watchlist* overlap (upstream). **Δalt/def** & **Ovl** = pick change / overlap between alternate & default focus, per model (headline). Bad = % picks from bottom-half of pre-tilt rank (guardrail). Elig = focus names inside band (flag <8). T5alt = focus names in alternate's top-5.

## Trend Follower  (`momentum_chaser`) — default: Chase Winners

_Default-focus expression (WL15, 1×): Δ default-vs-no-focus = 17% (B) / 18% (A); top-5 default focus names = 4.3 (A) → meets "≥2 in top-5"._

### vs Sector Leaders (raw technical)

| tilt | WL | WL-ovl | Δalt/def B | Ovl B | Δalt/def A | Ovl A | Bad B/A | Elig def/alt | T5alt B/A |
|---|---|---|---|---|---|---|---|---|---|
| 0.5× | 10 | 77% | **7%** | **93%** | 8% | 92% | 0.0/0.0 | 9.9/9.9 | 4.8/4.0 |
| 0.5× | 12 | 78% | **5%** | **95%** | 8% | 92% | 0.0/0.0 | 11.9/11.8 | 4.9/4.0 |
| 0.5× | 15 | 77% | **5%** | **95%** | 10% | 90% | 0.0/0.0 | 14.9/14.8 | 4.9/4.2 |
| 0.5× | 20 | 76% | **3%** | **97%** | 12% | 88% | 0.0/0.0 | 19.8/19.5 | 5.0/4.4 |
| 1× | 10 | 77% | **15%** | **85%** | 13% | 87% | 0.0/0.0 | 9.9/9.9 | 4.9/4.0 |
| 1× | 12 | 78% | **10%** | **90%** | 10% | 90% | 0.0/0.0 | 11.9/11.8 | 4.9/4.0 |
| 1× | 15 | 77% | **7%** | **93%** | 12% | 88% | 0.0/0.0 | 14.9/14.8 | 4.9/4.2 |
| 1× | 20 | 76% | **5%** | **95%** | 8% | 92% | 0.0/0.0 | 19.8/19.5 | 5.0/4.4 |
| 2× | 10 | 77% | **15%** | **85%** | 13% | 87% | 0.0/0.0 | 9.9/9.9 | 5.0/4.0 |
| 2× | 12 | 78% | **10%** | **90%** | 10% | 90% | 0.0/0.0 | 11.9/11.8 | 5.0/4.0 |
| 2× | 15 | 77% | **7%** | **93%** | 12% | 88% | 0.0/0.0 | 14.9/14.8 | 5.0/4.2 |
| 2× | 20 | 76% | **5%** | **95%** | 10% | 90% | 0.0/0.0 | 19.8/19.5 | 5.0/4.4 |

**Verdict:** WEAK / MARGINAL (ranking-level Δ peaks 15%).

### vs Sector Leaders (sector-relative)

| tilt | WL | WL-ovl | Δalt/def B | Ovl B | Δalt/def A | Ovl A | Bad B/A | Elig def/alt | T5alt B/A |
|---|---|---|---|---|---|---|---|---|---|
| 0.5× | 10 | 45% | **15%** | **85%** | 8% | 92% | 0.0/0.0 | 9.9/9.5 | 3.5/2.8 |
| 0.5× | 12 | 49% | **15%** | **85%** | 10% | 90% | 0.0/0.0 | 11.9/11.5 | 4.2/3.0 |
| 0.5× | 15 | 51% | **13%** | **87%** | 10% | 90% | 0.0/0.0 | 14.9/13.7 | 4.3/3.3 |
| 0.5× | 20 | 53% | **8%** | **92%** | 12% | 88% | 0.0/0.0 | 19.8/18.4 | 4.6/3.6 |
| 1× | 10 | 45% | **30%** | **70%** | 15% | 85% | 0.0/0.0 | 9.9/9.5 | 4.1/3.0 |
| 1× | 12 | 49% | **25%** | **75%** | 18% | 82% | 0.0/0.0 | 11.9/11.5 | 4.6/3.4 |
| 1× | 15 | 51% | **20%** | **80%** | 18% | 82% | 0.0/0.0 | 14.9/13.7 | 4.7/3.6 |
| 1× | 20 | 53% | **13%** | **87%** | 23% | 77% | 0.0/0.0 | 19.8/18.4 | 4.8/3.8 |
| 2× | 10 | 45% | **43%** | **57%** | 17% | 83% | 0.0/0.0 | 9.9/9.5 | 4.8/3.0 |
| 2× | 12 | 49% | **30%** | **70%** | 18% | 82% | 0.0/0.0 | 11.9/11.5 | 4.9/3.4 |
| 2× | 15 | 51% | **25%** | **75%** | 20% | 80% | 0.0/0.0 | 14.9/13.7 | 4.9/3.6 |
| 2× | 20 | 53% | **17%** | **83%** | 23% | 77% | 0.0/0.0 | 19.8/18.4 | 5.0/3.8 |

**Verdict:** REAL MOVEMENT from 2× tilt (ranking-level Δ peaks 43%; baggerBombFit fallback mutes to 23%).

## Speculator  (`degen`) — default: Hunt Big Movers

_Default-focus expression (WL15, 1×): Δ default-vs-no-focus = 25% (B) / 7% (A); top-5 default focus names = 1.5 (A) → MISSES "≥2 in top-5"._

### vs Chase Winners

| tilt | WL | WL-ovl | Δalt/def B | Ovl B | Δalt/def A | Ovl A | Bad B/A | Elig def/alt | T5alt B/A |
|---|---|---|---|---|---|---|---|---|---|
| 0.5× | 10 | 9% | **37%** | **63%** | 20% | 80% | 0.0/0.0 | 10.0/8.3 | 3.4/3.7 |
| 0.5× | 12 | 9% | **37%** | **63%** | 23% | 77% | 0.0/0.0 | 12.0/9.9 | 3.7/3.9 |
| 0.5× | 15 | 11% | **40%** | **60%** | 27% | 73% | 0.0/0.0 | 15.0/11.8 | 3.9/4.0 |
| 0.5× | 20 | 13% | **37%** | **63%** | 32% | 68% | 0.0/0.0 | 20.0/15.1 | 4.4/4.3 |
| 1× | 10 | 9% | **57%** | **43%** | 30% | 70% | 0.0/0.0 | 10.0/8.3 | 4.0/3.8 |
| 1× | 12 | 9% | **62%** | **38%** | 35% | 65% | 0.0/0.0 | 12.0/9.9 | 4.2/4.0 |
| 1× | 15 | 11% | **58%** | **42%** | 38% | 62% | 0.0/0.0 | 15.0/11.8 | 4.3/4.3 |
| 1× | 20 | 13% | **55%** | **45%** | 38% | 62% | 0.0/0.0 | 20.0/15.1 | 4.8/4.5 |
| 2× | 10 | 9% | **68%** | **32%** | 30% | 70% | 0.0/0.0 | 10.0/8.3 | 4.4/3.8 |
| 2× | 12 | 9% | **72%** | **28%** | 35% | 65% | 0.0/0.0 | 12.0/9.9 | 4.8/4.0 |
| 2× | 15 | 11% | **72%** | **28%** | 38% | 62% | 0.0/0.0 | 15.0/11.8 | 5.0/4.3 |
| 2× | 20 | 13% | **60%** | **40%** | 38% | 62% | 0.0/0.0 | 20.0/15.1 | 5.0/4.5 |

**Verdict:** REAL MOVEMENT from 0.5× tilt (ranking-level Δ peaks 72%).

## Fundamental Investor  (`analyst`) — default: Back Strong Companies

_Default-focus expression (WL15, 1×): Δ default-vs-no-focus = 30% (B) / 13% (A); top-5 default focus names = 1.1 (A) → MISSES "≥2 in top-5"._

### vs Sector Leaders (sector-rel + top-50% quality floor)

| tilt | WL | WL-ovl | Δalt/def B | Ovl B | Δalt/def A | Ovl A | Bad B/A | Elig def/alt | T5alt B/A |
|---|---|---|---|---|---|---|---|---|---|
| 0.5× | 10 | 16% | **22%** | **78%** | 7% | 93% | 0.0/0.0 | 9.4/10.0 | 4.0/2.0 |
| 0.5× | 12 | 14% | **23%** | **77%** | 7% | 93% | 0.0/0.0 | 11.0/12.0 | 4.1/2.1 |
| 0.5× | 15 | 15% | **27%** | **73%** | 10% | 90% | 0.0/0.0 | 12.9/15.0 | 4.7/2.2 |
| 0.5× | 20 | 17% | **25%** | **75%** | 10% | 90% | 0.0/0.0 | 14.1/18.7 | 5.0/2.5 |
| 1× | 10 | 16% | **48%** | **52%** | 12% | 88% | 0.0/0.0 | 9.4/10.0 | 4.8/2.0 |
| 1× | 12 | 14% | **48%** | **52%** | 13% | 87% | 0.0/0.0 | 11.0/12.0 | 4.8/2.2 |
| 1× | 15 | 15% | **42%** | **58%** | 20% | 80% | 0.0/0.0 | 12.9/15.0 | 5.0/2.3 |
| 1× | 20 | 17% | **43%** | **57%** | 20% | 80% | 0.0/0.0 | 14.1/18.7 | 5.0/2.5 |
| 2× | 10 | 16% | **65%** | **35%** | 12% | 88% | 0.0/0.0 | 9.4/10.0 | 5.0/2.0 |
| 2× | 12 | 14% | **67%** | **33%** | 15% | 85% | 0.0/0.0 | 11.0/12.0 | 5.0/2.3 |
| 2× | 15 | 15% | **58%** | **42%** | 23% | 77% | 0.0/0.0 | 12.9/15.0 | 5.0/2.4 |
| 2× | 20 | 17% | **53%** | **47%** | 23% | 77% | 0.0/0.0 | 14.1/18.7 | 5.0/2.7 |

**Verdict:** REAL MOVEMENT from 1× tilt (ranking-level Δ peaks 67%; baggerBombFit fallback mutes to 23%).

## Trend Follower — does sector-relative strength separate where raw technical rank does not?

At WL15, tilt 1×, vs default (Chase Winners):

| Sector-Leaders construction | watchlist overlap vs Chase Winners | draft overlap B / A vs Chase Winners |
|---|---|---|
| Sector Leaders (raw technical) | 77% | 93% / 88% |
| Sector Leaders (sector-relative) | 51% | 80% / 82% |

Raw technical ≈ Chase Winners (high watchlist overlap). Sector-relative roughly halves watchlist overlap — it **is** the separating ingredient *at the watchlist level*. Whether that reaches the draft is the band-gate question below.

## What suppresses focus reach — and what does buying more cost? (WL15)

Three suppressors are possible: (1) the **band gate** filtering out-of-band focus names, (2) the **bonus magnitude** being too small to surface deep names, (3) the **baggerBombFit fallback** re-sort (Model A only). Below: widen band 40%→100% + remove the one-tier cap (isolates #1), then also crank the bonus to 4× (isolates #2). Bad-jump = % picks from the bottom half of pre-tilt rank (the safety cost).

| pair / alternate | ΔB 40%·1×·capped | ΔB 100%·1×·uncapped | ΔB 100%·4×·uncapped | bad-jump B @4× |
|---|---|---|---|---|
| Fundamental Investor / Sector Leaders (sector-rel + top-50% quality floor) | 42% | 42% | 70% | 0.0 |
| Trend Follower / Sector Leaders (sector-relative) | 20% | 20% | 28% | 0.0 |
| Speculator / Chase Winners | 58% | 58% | 75% | 0.0 |

Widening the band barely changes Δ (40%≈100%): the focus watchlists already sit inside the band, so **the band gate is non-binding free safety, not the suppressor**. Bad-jump stays ~0 even uncapped because the screeners pick already-decent names. The fallback (Model A) is the real muter where it diverges from B.

## Plain-language verdict per riskiest pair

- **Trend Follower — Chase Winners vs Sector Leaders.** *Needs sector-relative reconstruction.* Built as **raw technical rank, "Sector Leaders" is a cosmetic duplicate of Chase Winners** (watchlist 77% shared, draft Δ ≤15%). Built **sector-relative**, the watchlist genuinely diverges (overlap ~50%) and the draft does move — but only **real from 2× tilt + small watchlist** (Δ peaks ~43%), and the fallback path mutes it to ~23%. Sector-relative strength *is* the separating ingredient; raw rank is not.
- **Speculator — Hunt Big Movers vs Chase Winners.** *Real movement* — the healthiest pair. The two watchlists are almost disjoint (~9-13% overlap) and switching moves the draft from **0.5× tilt upward** (ranking-level Δ 37%→72%). Caveat: the **default (Hunt Big Movers) expresses weakly** — only ~1.5 of its own names reach the top-5, because the volatility axis collides with the draft's low-ATR "support" slots.
- **Fundamental Investor — Back Strong Companies vs Sector Leaders (quality-floored).** *Real movement at the ranking level* (Δ 42-67% from 1× tilt; watchlists only ~15% shared) — **but the strongest "watchlist diverges, draft converges" warning**: the deterministic fallback mutes the switch to ~23%, and the default (Back Strong) lands only ~1 of its names in the top-5. Viable only if the draft honors the archetype-ranked order (LLM path), not the fallback.

## For the founder

**Does the core premise — "changing focus changes the draft, archetype-safely" — hold?** *Conditionally yes.*

- **Archetype-safe: yes, confirmed.** The bounded post-rank promotion (band gate + one-tier cap) produced **zero bad jumps** in every pair/config/state, and is **non-binding free safety** — widening the band to 100% changed nothing, because well-built focus watchlists already sit inside the band. The safety design costs no expressiveness here.
- **Changes the draft: only for well-built focuses, and mainly via the ranking signal.** Movement is real when the focus rides an axis the archetype ranking does **not** already dominate (sector-*relative* strength, or momentum for a volatility archetype) **and** the draft follows the archetype-ranked order. It is cosmetic when the focus restates the archetype's own axis (Sector Leaders *raw* ≈ Chase Winners for a momentum archetype).
- **Genuinely viable:** Speculator ↔ Chase Winners (robust). **Viable but tilt-/path-dependent:** Fundamental → Sector Leaders, Trend Follower → Sector Leaders — *only* sector-relative, *only* at ≥1-2× tilt with smaller watchlists, and degraded by the baggerBombFit fallback. **Decorative:** any "Sector Leaders" built on raw technical rank.
- **The real bottleneck is not the band gate — it is downstream pick selection.** Watchlist divergence (as low as 14% overlap) collapses to ~80% draft overlap through the deterministic fallback. Before building anything user-facing, decide whether the draft will honor the (tilted) archetype order or the baggerBombFit fallback, because that choice — not the focus screener — determines whether focus reaches the picks.

_Caveat repeated: synthetic universe, point-in-time — these are mechanism/direction findings across a regime proxy, not magnitudes from live trading days. Regime-robustness cannot be proven until daily snapshots are retained (or the live doc is reachable)._
