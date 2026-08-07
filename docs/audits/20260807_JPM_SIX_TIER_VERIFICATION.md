# JPM six-tier row — read-only verification (L-C closeout open item #1)

**Date:** 2026-08-07 · **Type:** READ-ONLY code trace (no live data, no OHLCV refetch). **Not a flip blocker.**
**Question (from `20260807_LC_UNFREEZE_ADJUDICATION_CLOSEOUT_V1.md`):** cpu-41, `2026-08-06`, `JPM:30(bagger/doubleBagger/tenBagger/bust/crash/meltdown)` — all six tiers on one symbol in one day (both the +2.0 and −2.0 multiplier extremes recorded). Confirm `maxMultiplier`/`minMultiplier` are **both recorded live**, not one stale or mis-seeded.

## Verdict — the recording mechanism is sound; both extremes are recorded live and seeded from 0

The multiplier extremes are two **independent running accumulators**, both recomputed **every eval tick from the same live multiplier**, and on a fullday doc both **seed from 0** (fresh doc, no cross-day carry). Neither can be stale while the other advances, and neither is mis-seeded. Trace:

**1. Both extremes are folded from the same live value each tick** — `agentScoring.js:277-279` (`calculateAssetScoreServer`):
```
const effectiveMax = Math.max(historyMax, highMultiplier, multiplier);
const effectiveMin = Math.min(historyMin, lowMultiplier, multiplier);
```
`multiplier = effectiveThresholdChange / baseATR` (`:262`) is the current tick's threshold move. `effectiveMax` ratchets **up**, `effectiveMin` ratchets **down**, both against that same live `multiplier` — so a tick where JPM is up pushes max, a later tick where it is down pushes min. A genuine intraday whipsaw (up ≥ +2.0·ATR at one tick, down ≤ −2.0·ATR at another) records **both** extremes. Neither is stale: every tick recomputes both.

**2. No spurious seeding from `extremes`** — the eval calls the scorer with an **empty** `extremes` object (`agent-evaluate.js:796`, the 4th arg is `{}`), so `highMultiplier` and `lowMultiplier` both fall back to `multiplier` (`agentScoring.js:274-275`). The extremes are driven purely by the live tick multiplier, not an externally-injected high/low.

**3. Correct 0-seed, no cross-day contamination** — the prior history is `battle.thresholdHistory?.[JPM] || {}` (`agent-evaluate.js:795`), and `historyMax = history.maxMultiplier || 0` / `historyMin = history.minMultiplier || 0` (`agentScoring.js:270-271`). A fullday doc inits `thresholdHistory: {}` (`agentBattleService.js:270`) and is created fresh each morning — so on `2026-08-06` JPM's max started at **0** and ratcheted up, its min started at **0** and ratcheted down, within that day only. No prior day's extreme is carried in (the fullday model's cleanliness — the same property that makes `bankedBadgePoints` structurally 0).

**4. The persisted pair is exactly this tick's `{effectiveMax, effectiveMin}`** — returned as `history` (`agentScoring.js:298-301`) and written back per symbol (`agent-evaluate.js:884-885`), read again next tick. The accumulation is closed-loop and symmetric.

**Arithmetic is consistent:** all-positive tiers (bagger+doubleBagger+tenBagger = +95, `maxMultiplier ≥ 2.0`) and all-negative tiers (bust+crash+meltdown = −65, `minMultiplier ≤ −2.0`) net to **+30** — the recorded value. Both sides of the ladder fired.

## The one thing code cannot confirm (and why it isn't a blocker)

Whether JPM's **actual** `2026-08-06` intraday price genuinely swung ≥ +2.0·ATR **and** ≤ −2.0·ATR is a **data** question that needs the intraday price series — which would require an OHLCV refetch (the forbidden pattern) and is out of scope for a read-only pass. The mechanism verification above establishes what the founder asked: the two extremes are **structurally incapable of one being stale while the other advances** (both fold the same live multiplier each tick) and are **not mis-seeded** (fresh 0 baseline). A six-tier row therefore reflects a real recorded whipsaw, not a stale/mis-seeded artifact. It sits on a **voided cohort**, on a **beyond-envelope** date, so it carries no result weight regardless.

**Conclusion:** open item #1 closed at the mechanism level — `maxMultiplier`/`minMultiplier` are both recorded live and correctly seeded. No badge-model change indicated.
