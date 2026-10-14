# Experiment — Did the learning help? Scoring the changed moments

**Date:** 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Prompt:** Fable, "Experiment — Did the learning help? Scoring the changed moments", 14 Oct 2026 · **Base HEAD:** `e880592e` (`origin/main` after `git fetch origin`) · **Branch:** `claude/experiment-changed-moments-score` · **No model calls.**

> **How this file was written.** Section 3, the method, was committed and pushed with the script as `731799d2` before any price bar was fetched or any outcome read (rule 8). The scoring run used that exact script. The other sections were written from its output afterwards, and §8 records the review.

## 1. In plain terms

The growth replay found 29 moments where removing an agent's learned paragraph changed its usual call. This asks, for each one: **did the call made with the paragraph do better or worse than the call made without it?** "Better" is judged by what the market did next, through the closing bell that day. We measure it two ways: BaggerBomb points, using the Film Room tape's own arithmetic, and the plain price move.

| Question | Answer |
|---|---|
| **The label** | **No clear effect.** |
| How the 29 moments scored | 28 could be scored on both measures. On points, the learned call did better on 11, worse on 12, and tied on 5. Price gives the same split: 11 / 12 / 5. A coin-flip test cannot tell this apart from chance (p = 1.0). |
| How many of the changes were trades the learning stopped | **20 of 29.** In 4 more, the learning *caused* a trade; in the other 5, it changed which stock was bought. |
| What the control says | Across every trade the agents chose in the replay, **trading lost to holding more often than it won: 29 times against 19**, with 5 ties. That is not significant (p = 0.19), but it leans one way. |
| Which paragraphs drove it | None produced a clear result. The Trend Follower paragraph present on 16 moments came out roughly even. The Contrarian paragraph (12 moments) was slightly worse, and the other Trend Follower paragraph (1 moment) was worse. |

- **Where the learning stopped a trade, holding was usually the better outcome.** It was better on 10 of the 20, worse on 7, and tied on 3. That matches the control: in this period trades tended to lose to holding. So stopping a trade looks good mostly because trading looked bad, not because of anything particular in the paragraph.
- **Where the learning caused a trade, the trade did worse** on 3 of 4, and tied on the fourth.
- **In total, the learned calls finished 100 points behind the unlearned ones over the 28 moments.** Most of that gap comes from four large misses, each between 28 and 42 points. At the next check after each moment, the picture is just as even: 13 better, 11 worse.
- **The two measures say nearly the same thing.** Unless a stock crosses a badge line, BaggerBomb points are about ten times the price move, times the slot's tier multiplier. So they are not two independent pieces of evidence.
- **This is a small sample from founder and tester play.** With 28 moments, only a large effect could have shown up as anything other than "no clear effect".

## 2. Gate facts

**Session preamble (BUILD_RULES §2/§3).**
- `git fetch origin` ran first.
- The worktree was cut from `origin/main` at `e880592e`, clean. The local branch is the app-suffixed `claude/experiment-changed-moments-score-0b40c9`, pushed as `claude/experiment-changed-moments-score`.
- `node_modules` is a junction into the primary checkout, unlinked at session end.

**Pre-declaration (rule 8).**
- The method (§3 and the script header) was committed as `731799d2` and **pushed before any bar was fetched or any outcome read**.
- Every scoring command ran that exact file: SHA-256 `bd6b7a3e990236d2637f57e227b384664f668a26514a9766e5341eb1e8526d87`, logged per command in the run manifest.
- Two earlier `plan` runs came from uncommitted drafts, while the slot reconstruction was being debugged. They read inputs only — no bars, no tape replay — and were superseded.

| Fact | Value |
|---|---|
| Run | `cms-20261014T202814` (`%USERPROFILE%/growth-replay-runs/`, outside git) |
| Run window (14 Oct 2026, UTC) | `plan` 20:28:15 · `known-answer` 20:28:24, bars fetched 20:28:28–20:28:38 · `score` 20:29:20 |
| Script SHA-256 | `bd6b7a3e…8526d87`, the same on all three commands |
| EODHD requests | **41 of the 400 cap**, one per symbol, 0 failures |
| Known-answer, layer 1 (the tape's own rows, our bars) | **9 of 9** match exactly |
| Known-answer, layer 2 (our builder) | **4 of 4** in its domain match, exactly on every number. The other 5 are deterministic exits taken before the prompt was built, outside the builder's domain (§3.9). |
| Bars against the tape's stored 10-minute series | **28 of 28** series equal |
| Sale reconciliation: lock, exit price and fill against the platform's records | **20 of 20** each, over every recorded model swap on the 29 battle-days (4 tiered, 16 flat6) |
| Self-test | 54 rows pass (gates every command) |
| Firestore | Read-only; the §7 write-call grep gated every command in the same shell command (no matches) |
| Model calls | None |

**Inputs.**
- 69 distinct swap calls were needed. 57 built; the other 12 are crypto (`crypto_not_supported`).
- **Entries.** All 57 rendered exactly to the shown `$Entry`: 54 starting prices and 3 earlier fills.
- **Lock ATR.** 54 used `scoring.thresholds`.
- **The 1-decimal ATR rule (M7).** 45 of the 57 used a 1-decimal ATR for one leg — in every case the bought name's, since those bench candidates have no stored threshold. Every held name's ATR was exact. Every one of their verdicts held at every corner of the rounding box, so M7 left nothing unscored.

**Changes after the method commit:** none to the script. This report's results sections, and the review record in §8, were added after the run.

## 3. Method (pre-declared)

The script is `scripts/experiments/growth-replay/changedMomentsScore.js`. Its header carries the same method as rules M1–M9; the two are one text.

### 3.1 The moments (M1)

- **The usual call** of a moment is its most common decision across the repeats, under the growth replay's own key of record (`growthReplay.js` `decisionKey`: `HOLD`, `SWAP:OUT>IN`, or `malformed`) and its own tie rule (the lexically smallest key wins). "With learning" is the verbatim request; "without" is the `strip` variant.
- **Set of record.** The batch check's fresh baseline against its fresh `strip`: the moments whose usual call differs. Re-derived from the saved results, not from the exhibits: **29**, which matches the addendum's own count.
- **Second set.** The main run's `strip` flips that are not in the set of record: **4**. Scored the same way and reported separately; they set no label.
- **Kinds.** *Stopped*: with learning HOLD, without SWAP. *Caused*: with SWAP, without HOLD. *Changed pick*: both SWAP, different calls (a different sold name is flagged). *Unscorable*: a `malformed` usual call on either side. Set of record: 20 stopped, 4 caused, 5 changed pick, 0 unscorable. Second set: 2 caused, 2 changed pick.

### 3.2 What a call is worth (M2)

For each horizon, over the slots either call touches:

- **value of a call** = for each such slot, the swap path if the call swaps that slot, else the hold path;
- **difference** = value with learning − value without. **Positive means the learned call did better.**

So a *stopped* moment scores hold − swap, a *caused* moment swap − hold, and a *changed pick* with the same sold name scores swap-into-Y − swap-into-Z: the held name cancels, so its leg is not needed.

- **Points.** The hold and swap paths are the tape's own replay, `replayAction` in `api/_utils/filmTape/tapeReplay.js`, imported, never copied. It scores through the fenced `calculateAssetScoreServer`. The hold path is the held name scored from its original entry, with its threshold history continued. The swap path is the lock the sale banks, plus the bought name scored from the swap with its history reset to zero, as the executor resets it.
- **Price.** The percentage move, from the price the agent was **shown** at the check, of the name the call leaves in the slot. Over the same window for both calls.

### 3.3 The inputs of one swap X→Y at one check (M3)

One builder serves both the hypothetical swaps and, in the known-answer check, the recorded ones.

| Input | Source |
|---|---|
| The state shown | The battle as it stood when the prompt was built: the evaluation entry's `promptBuiltAt`. That is the final portfolio with every trade made after that instant undone, so a swap the check itself made is not yet in it. |
| Swap instant | The check's `capturedAt`, the tape's own check instant. A recorded swap's instant falls seconds before it, inside the same minute. |
| X's entry | The exact record, accepted only when it renders to the request body's `$Entry` at 2 dp. In order: the fill of the swap that brought X in (the tick action's `entryPrice`), else the later sale's `trades.entryPrice`, else the slot's `swapPrice` / `previousSwapPrice`, else `startingPrices[X]`. |
| X's threshold baseline | The tape's own rule, `ghostBaseline` (imported). The swap price if X came in that day; the starting price on the activation day; otherwise the previous close, which no record holds, so points are `not_scored`. |
| X's threshold history | The band the body's `Badges` column names. No badge → 0; `bagger` 1.0, `doubleBagger` 1.5, `tenBagger` 2.0; `bust` −1.0, `crash` −1.5, `meltdown` −2.0. The scorer reads history only as a max/min against these thresholds, so any history inside the same band gives the same points on every later sample. Self-test S7 checks this on the imported scorer. |
| X's ATR | The held asset's `baseATR` (final slot, else the later sale's receipt `outgoingBaseATR`, else the bench record), accepted when it renders to the body's `ATR%` at 1 dp. Otherwise the body's 1-dp value, under M7. |
| The lock | `calculateAssetScoreServer` exactly as `executeSwapServer` builds it, at X's **evidence price**: the capture's `px`, the platform's delayed quote the agent was shown. ATR = `scoring.thresholds[X].threshold` ‖ `baseATR` ‖ 2.5, with the mode's flat stamp and the history above. The body's `LockNow` is reported beside it. |
| Y's entry | The body's bench `$Current` for Y (2 dp). If Y is not on the shown bench, points are `not_scored`. |
| Y's ATR | `scoring.thresholds[Y].threshold`, else the bench record's `baseATR`, else the body's 1-dp `ATR%` under M7. This is `executeSwapServer`'s incoming literal. Y's history is zero and its baseline is its entry, as the executor resets them. |
| Tier | X's slot in the state shown. The tier stamp is `resolveModeConfig(gameMode).flatMultiplier`: 1.0 for flat6, none for tiered, as the live evaluator stamps it. |
| Later checks | The battle's ticks of that ET day, plus its evaluation entries that have no tick: the tape's own rows. They are sampled by the tape's own `scoredCheck` / `laterChecks` (imported). |
| Crypto | Either leg crypto → `not_scored`, the tape's `crypto_not_supported`. |

### 3.4 Price bars (M4)

- **Source.** EODHD 1-minute bars: one request per symbol, spanning every ET day that symbol is needed, from the first needed open − 1 h to the last needed close + 1 h.
- **Filtering.** The rows are filtered exactly as the candle pass's fetcher filters them (finite OHLC; the null-volume, zero-range close print), then cut by the tape's `sessionBars`. A price at an instant is the tape's `sampleAt`: the last completed minute, valid only if it closed within 5 minutes.
- **The tape's stored series** are 10-minute bars (`SERIES_INTERVAL '10m'`). They are too coarse for the replay's 1-minute sampling (BA-11, BA-24), so they are **not** a price source here. They are a cross-check: `aggregate10m` of the fetched minutes must equal each stored series bar. This departs from the prompt's "read from the tape's series where they exist", and that departure is stated here.
- **Cap.** 400 requests, counted in the run manifest *before* each request. A symbol that cannot be fetched leaves its dependants `not_scored`, with the reason. Fetch order: the known-answer swaps, the set of record, the second set, the control, the main-run control. The plan needs **41** requests in all.
- **Delay.** The entry of both paths is the platform's delayed quote, about 15–20 minutes old (`LOCKED_BASIS_NOTE`). The scoring run measures it: the shown price against the 1-minute bar at the check.

### 3.5 Horizons (M5)

- **Primary:** the session close, the replay's close sample.
- **Secondary:** the next check, the replay's first later sample in the same session (none → `not_scored`).
- **Secondary: the end of the battle.** Every battle in this corpus is a one-session battle, so this is the same close. `plan` checked all 29 battles: one trading day, completed after its close. The figure is marked hypothetical when the slot traded again later in the real battle.

### 3.6 Ties and the label (M6)

**Ties.** A difference of at most **1 point**, or at most **0.10 percentage points**, is a tie.

**The label of record** is set on the primary horizon, over the set of record's moments scored on **both** measures:

| Label | When |
|---|---|
| **too few to read** | Fewer than 15 such moments |
| **learning helped** | Among them, on each measure separately, the learned call did better on at least 2 in 3 of the non-tied |
| **learning hurt** | The same, did worse |
| **no clear effect** | Anything else |

**Descriptive only:** helped, hurt and tied counts per measure; the summed differences; a two-sided exact sign test per measure, with ties dropped.

### 3.7 Precision (M7)

When an ATR is known only to 0.1 (the body's rendering), the moment is also replayed at each corner of that rounding box: ±0.05 on each coarse leg, in every combination across the moment's components. If any corner changes a points verdict (helped / hurt / tie) at any horizon, that moment's points are `not_scored`: "ATR known to 0.1 only and the verdict depends on it". An ATR only moves badges, and a badge needs a move of a whole ATR (5–8% here) within the session.

### 3.8 The control (M8)

- **What it scores.** Over all 280 batch-check moments, every distinct SWAP that is the usual call of either condition: 64 units. Each is the swap against holding, scored by M2–M7 (points = swap − hold; price = move of the bought name − move of the held name).
- **What it shows.** Whether a "learning helped" result says something about the paragraphs, or only that trading less wins in BaggerBomb. **It sets no label.**
- **A second control.** The main run's swaps (66 units) are a descriptive second control.

### 3.9 Validation before trusting the scorer (M9)

**The known-answer check** covers every recorded swap with a stored replay on the replay's 29 battle-days. Those are the 7 tiered days only: the tape never replays flat6 (BA-3).

- **Layer 1** runs `replayAction` on the tape's own action row and checks, with the fetched bars. It validates the bars and the replay call. Its domain is every such swap, and exact agreement (0.005) is expected.
- **Layer 2** rebuilds each swap with *this* builder (§3.3) and its own check rows. It must match the tape's `gapPoints` and every hold- and swap-path point within 1 point; the tape stores whole points, and a 2-dp entry can move the scorer's rounding by one.
  - **Its domain** is the swaps the builder can express: those whose sold name is on the positions the check showed.
  - That is every model-proposed swap. A deterministic exit (archetype rule, risk manager) is taken *before* the prompt is built, so the check never shows its sold name. No moment scored here is such an exit.
  - `plan` found the tape's 9 swaps on those days to be 4 model swaps and 5 such exits.
- **The gate:** on each layer, at least **90%** of its domain matches, and each domain is non-empty. **Otherwise STOP: nothing is scored.**

**The sale reconciliation** (`plan`, inputs only) runs beside the gate. Over every recorded model swap on the 29 battle-days, tiered and flat6, it compares the builder's lock, exit price and fill with the platform's records.

**The self-test** has 54 rows. It is mutation-checked in review:

- the tie bands;
- the label boundaries, including exactly 2 in 3, and 14 versus 15 scored;
- each kind;
- the `not_scored` path;
- the call cap;
- the sign test;
- the badge-band equivalence on the imported scorer;
- the body parser;
- the bar filters and key redaction;
- the coarse-ATR corners;
- the known-answer gate.

### 3.10 What is read, and what is never written

- **Firestore** is read through `.collection / .doc / .get / .getAll / .where` only, and every run is gated in the same shell command by the growth replay's §7 write-call grep.
- **Imports.** Product code is imported, never copied or edited. Fenced function called: `calculateAssetScoreServer`. Fenced files edited: none.
- **Local only.** Everything the script writes lands in `%USERPROFILE%/growth-replay-runs/cms-<time>/`. Files named `*.local.*` carry ids or player text and are never committed.

## 4. The moments of record, M01–M29

**How to read the table.**
- Each difference is the call **with** learning minus the call **without** it, so **positive means the learned call did better**.
- Points are BaggerBomb points; price is percentage points (pp) of move. "(tie)" means within ±1 point or ±0.10 pp.
- The moments are numbered by date, then by check time.
- **Votes** are how many of the 8 repeats gave the usual call.
- **Paragraph** is the SHA-256 prefix of the learned text, as in the replay. `9b800c54` and `8ef74043` are the two Trend Follower versions; `3c0b446b` is the Contrarian.
- **End of battle**: every battle here is a one-session battle, so the end of the battle *is* the close. "Hypothetical" marks a slot the real battle traded again later that day: the replay does not follow that later trade.

| # | Kind | Archetype | Mode | Paragraph | With learning (votes) | Without (votes) | Live battle did | Points, close | Price pp, close | Points, next check | Price pp, next check | End of battle | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M01 | stopped | Trend Follower | tiered | `8ef74043` | HOLD (8/8) | SWAP GOOGL→MU (5/8) | SWAP GOOGL→MU | −28 | −2.85 | −14 | −1.37 | as close | exact inputs |
| M02 | stopped | Trend Follower | tiered | `9b800c54` | HOLD (5/8) | SWAP MSFT→PLTR (5/8) | HOLD | +3 | +0.33 | +5 | +0.48 | as close; **hypothetical** | exact inputs |
| M03 | caused | Trend Follower | tiered | `9b800c54` | SWAP INTC→PLTR (8/8) | HOLD (8/8) | SWAP MSFT→CRWD (archetype exit) | −32 | −1.63 | −4 | −0.19 | as close | exact inputs |
| M04 | caused | Trend Follower | tiered | `9b800c54` | SWAP DE→PLTR (6/8) | HOLD (8/8) | SWAP DE→PLTR | 0 (tie) | +0.09 (tie) | −1 (tie) | −0.06 (tie) | as close | exact inputs |
| M05 | stopped | Trend Follower | tiered | `9b800c54` | HOLD (8/8) | SWAP META→PANW (8/8) | HOLD | −30 | −2.02 | −12 | −0.77 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M06 | stopped | Trend Follower | flat6 | `9b800c54` | HOLD (8/8) | SWAP PANW→EMR (6/8) | HOLD | +1 (tie) | +0.04 (tie) | +4 | +0.48 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M07 | changed pick | Trend Follower | flat6 | `9b800c54` | SWAP PANW→HUM (7/8) | SWAP PANW→EMR (6/8) | HOLD | −19 | −1.91 | −7 | −0.73 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M08 | stopped | Trend Follower | flat6 | `9b800c54` | HOLD (7/8) | SWAP AMD→DHR (7/8) | HOLD | +2 | +0.22 | +5 | +0.58 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |
| M09 | stopped | Contrarian | tiered | `3c0b446b` | HOLD (7/8) | SWAP AMD→BE (8/8) | HOLD | +5 | +0.26 | +4 | +0.21 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |
| M10 | stopped | Contrarian | tiered | `3c0b446b` | HOLD (7/8) | SWAP AMD→AMAT (4/8) | SWAP NVDA→BE (archetype exit) | −42 | −2.12 | −17 | −0.83 | as close; **hypothetical** | exact inputs |
| M11 | stopped | Trend Follower | flat6 | `9b800c54` | HOLD (4/8) | SWAP PWR→PANW (5/8) | SWAP PWR→PANW | +13 | +1.22 | +6 | +0.61 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M12 | caused | Trend Follower | flat6 | `9b800c54` | SWAP MAR→SNOW (8/8) | HOLD (8/8) | SWAP MAR→SNOW | −10 | −1.01 | +3 | +0.29 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M13 | caused | Trend Follower | flat6 | `9b800c54` | SWAP GME→ACN (7/8) | HOLD (7/8) | HOLD | −4 | −0.44 | +13 | +1.28 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M14 | stopped | Trend Follower | flat6 | `9b800c54` | HOLD (8/8) | SWAP RKLB→MSFT (6/8) | HOLD | +16 | +1.62 | +11 | +1.11 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M15 | stopped | Trend Follower | flat6 | `9b800c54` | HOLD (6/8) | SWAP LRCX→AVGO (6/8) | HOLD | +7 | +0.72 | −4 | −0.39 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |
| M16 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (7/8) | SWAP INTC→CTVA (7/8) | SWAP INTC→CTVA | −14 | −1.40 | +4 | +0.45 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M17 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (8/8) | SWAP AMAT→CEG (8/8) | HOLD | +21 | +2.12 | +5 | +0.52 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M18 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (8/8) | SWAP AMAT→MSFT (8/8) | HOLD | −2 | −0.21 | −3 | −0.30 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M19 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (7/8) | SWAP AMAT→MSFT (8/8) | HOLD | 0 (tie) | −0.01 (tie) | −4 | −0.30 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M20 | changed pick (different sold names) | Trend Follower | tiered | `9b800c54` | SWAP BTC→AMD (7/8) | SWAP CEG→AMD (8/8) | HOLD | `not_scored` | `not_scored` | `not_scored` | `not_scored` | — | a crypto leg (`crypto_not_supported`) |
| M21 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (8/8) | SWAP AMAT→CSCO (4/8) | HOLD | −11 | −1.07 | −3 | −0.31 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M22 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (3/8) | SWAP AMAT→MSFT (8/8) | HOLD | +2 | +0.27 | 0 (tie) | +0.01 (tie) | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M23 | stopped | Trend Follower | tiered | `9b800c54` | HOLD (7/8) | SWAP CEG→AMD (8/8) | HOLD | +28 | +1.46 | +1 (tie) | +0.06 (tie) | as close | exact inputs |
| M24 | changed pick | Contrarian | flat6 | `3c0b446b` | SWAP MOS→AMZN (7/8) | SWAP MOS→KMI (5/8) | SWAP MOS→AMZN | +1 (tie) | +0.09 (tie) | +2 | +0.17 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M25 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (8/8) | SWAP LIN→MSFT (7/8) | HOLD | −20 | −1.06 | −1 (tie) | −0.11 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |
| M26 | changed pick | Trend Follower | flat6 | `9b800c54` | SWAP BE→COP (7/8) | SWAP BE→PM (6/8) | SWAP BE→COP | −4 | −0.47 | −11 | −1.04 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M27 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (7/8) | SWAP FMC→PM (5/8) | HOLD | 0 (tie) | +0.05 (tie) | +10 | +1.04 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M28 | changed pick | Trend Follower | flat6 | `9b800c54` | SWAP LLY→CVX (8/8) | SWAP LLY→PM (7/8) | SWAP LLY→CVX | +11 | +1.12 | +4 | +0.41 | as close | ATR to 0.1 for a leg; verdict stable at every corner |
| M29 | stopped | Contrarian | flat6 | `3c0b446b` | HOLD (8/8) | SWAP AMAT→PM (5/8) | HOLD | +6 | +0.65 | −5 | −0.52 | as close | ATR to 0.1 for a leg; verdict stable at every corner |

**Totals at the close** (moments scored on both measures: 28):

| | Better | Worse | Tied | Sum | Sign test p |
|---|---|---|---|---|---|
| Points | 11 | 12 | 5 | −100 | 1.0 |
| Price | 11 | 12 | 5 | −5.95 pp | 1.0 |

**At the next check:**

| | Better | Worse | Tied | Sum | Sign test p |
|---|---|---|---|---|---|
| Points | 13 | 11 | 4 | −9 | 0.84 |
| Price | 13 | 12 | 3 | +0.77 pp | 1.0 |

**By kind, at the close (points; price splits the same way):**

| Kind | Moments | Better | Worse | Tied | Sum (points) |
|---|---|---|---|---|---|
| Stopped (learning held, without it the agent traded) | 20 | 10 | 7 | 3 | −43 |
| Caused (learning traded, without it the agent held) | 4 | 0 | 3 | 1 | −46 |
| Changed pick | 5 (4 scored) | 1 | 2 | 1 | −11 |

**By paragraph, at the close (points):**

| Paragraph | Archetype | Moments | Better | Worse | Tied | Sum |
|---|---|---|---|---|---|---|
| `9b800c54` | Trend Follower | 16 (15 scored) | 7 | 6 | 2 | −18 |
| `3c0b446b` | Contrarian | 12 | 4 | 5 | 3 | −54 |
| `8ef74043` | Trend Follower (the other version) | 1 | 0 | 1 | 0 | −28 |

**By mode:** tiered 9 moments (8 scored): 3 better, 4 worse, 1 tied, −96 points. Flat6 20 moments: 8 better, 8 worse, 4 tied, −4 points. The tiered sums are larger because tier multipliers of 2× and 1.5× scale the points.

## 5. The second set, and the control

**The second set.** These are the main run's 4 learning-removed flips that the batch check did not reproduce. They set no label.

| # | Kind | Archetype | Mode | Paragraph | With learning (votes) | Without (votes) | Live battle did | Points, close | Price pp, close | Points, next check | Price pp, next check | End of battle | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | changed pick (different sold names) | Trend Follower | tiered | `9b800c54` | SWAP PANW→AMD (4/10) | SWAP NVDA→AMD (4/10) | HOLD | −22 | −0.92 | −5 | −0.24 | as close | exact inputs |
| S02 | changed pick | Trend Follower | tiered | `9b800c54` | SWAP BTC→MPC (6/10) | SWAP BTC→CTVA (5/10) | HOLD | `not_scored` | `not_scored` | `not_scored` | `not_scored` | — | a crypto leg (`crypto_not_supported`) |
| S03 | caused | Trend Follower | flat6 | `9b800c54` | SWAP LLY→CVX (5/10) | HOLD (10/10) | HOLD | −25 | −2.60 | −7 | −0.70 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |
| S04 | caused | Trend Follower | flat6 | `9b800c54` | SWAP LLY→CVX (8/10) | HOLD (9/10) | HOLD | −20 | −2.11 | −10 | −1.09 | as close; **hypothetical** | ATR to 0.1 for a leg; verdict stable at every corner |

- 3 of the 4 could be scored. On all 3 the learned call did worse: −67 points and −5.63 pp in total.
- S02 has a crypto leg on both calls.
- Read alone, the set is "too few to read".

**The control: do trades beat holding anyway?** Every distinct trade that was the usual call of either condition in the batch check, scored against holding the same slot. A positive number means the trade beat holding.

| Control | Trades | Scored | Trade better | Trade worse | Tied | Sum (points) | Sum (price) | Sign test p |
|---|---|---|---|---|---|---|---|---|
| Batch check (of record) | 64 | 53 | **19** | **29** | 5 | −129 | −15.56 pp | 0.19 |
| — flat6 | 39 | 39 | 14 | 21 | 4 | −108 | −16.20 pp | 0.31 |
| — tiered | 25 | 14 | 5 | 8 | 1 | −21 | +0.64 pp | 0.58 |
| Main run (descriptive) | 66 | 54 | 18 | 31 | 5 | −204 | −21.83 pp | 0.085 |

The 11 batch-check trades and the 12 main-run trades that were not scored all have a crypto leg.

**Reading the control beside the label.**
- In this period a trade lost to holding more often than it won.
- So a paragraph that mostly *stops* trades would look helpful even if its content did not matter.
- Here the stopped trades favour the learning (10 against 7) and the caused trades go against it (0 against 3). Both point the same way as the control, and neither is significant.
- The control does not set the label, and it cannot explain away a label of "no clear effect": there is no effect for it to explain.

## 6. Limits

- **The delayed quote.** Both calls start from the price the agent was shown: the platform's quote, about 15–20 minutes delayed.
  - **Measured on the 33 sales replayed for the set of record:** the shown price minus the 1-minute bar at the check had a median of −0.02%, ranging from −0.83% to +1.11%.
  - **Lag:** the minute whose price best matches the shown one sat a median 16 minutes before the check (3 to 39).
  - The hold path and the trade start from the same vintage of quote, but each stock's own lag differs.
- **A one-step replay.** Both paths run from the check to the day's close. A later trade in the same slot is not replayed (the tape's own label). Eight figures are marked hypothetical for that reason: M02, M08, M09, M10, M15, M25, S03 and S04.
- **The call as proposed.** Each usual call is scored as if it had been carried out. Guardrails, the risk manager, the validator and the executor were not run, as in the replay. The live battle's own action at each check is shown beside it. At M03 and M10 it was a rule exit, taken before the prompt was built, that matches neither call.
- **Small numbers.** 28 moments scored, 23 of them not tied. At 23, the sign test needs a split of at least 17 to 6 to reach p < 0.05. Several usual calls are pluralities rather than majorities: M22 held on 3 of 8 votes, M11 on 4 of 8.
- **Founder and tester play only.** It comes from a pre-launch product, 29 one-session battles between 22 Sep and 8 Oct 2026. The learning is three paragraphs: two Trend Follower versions and one Contrarian.
- **The two measures are nearly one.** Unless a badge line is crossed, points are about ten times the price move, times the tier multiplier. The tie bands were set before this was seen, and they line up for flat6 (1 point ≈ 0.10 pp). Agreement between the two measures is therefore not two pieces of evidence.
- **Flat6 has no tape precedent.** The tape never replays flat6 battles (BA-3), and 20 of the 29 moments are flat6.
  - **What validated:** for flat6, the scoring is the same imported replay with the 1.0 stamp the live evaluator uses. Its sale arithmetic matched the platform on all 16 flat6 model swaps.
  - **What did not:** its hold and swap paths could not be checked against stored numbers.
  - **Layer 2 is small:** it covers only the 4 tiered model swaps the tape replayed on these days.
- **ATR to one decimal.** 45 of 57 swap calls read at least one ATR only to 0.1. Every verdict held at every corner of that rounding (M7).
- **End of battle.** For every moment it is the session close, so it adds no figure of its own.
- **Not scored, with reasons:**
  - **M20 and S02** — a crypto leg. M20's learned call sells BTC; S02 sells BTC on both calls (`crypto_not_supported`).
  - **The control** — 11 batch-check trades and 12 main-run trades, all for a crypto leg.
  - **Nothing else.** No moment lost its points to a missing bar, a missing input, a previous-close baseline, or the ATR rule.

## 7. No recommendation

This report makes none. The founder decides in the Practice Field chat.
