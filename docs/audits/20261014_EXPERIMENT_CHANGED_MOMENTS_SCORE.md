# Experiment — Did the learning help? Scoring the changed moments

**Date:** 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Prompt:** Fable, "Experiment — Did the learning help? Scoring the changed moments", 14 Oct 2026 · **Base HEAD:** `e880592e` (`origin/main` after `git fetch origin`) · **Branch:** `claude/experiment-changed-moments-score` · **No model calls.**

> **How this file was written.**
> - **Method first.** Section 3, the method, was committed and pushed with the script as `731799d2` before any price bar was fetched (rule 8). The scoring run used that exact script.
> - **Results after.** The other sections were written from the run's output afterwards.
> - **The review.** §8 records the BUILD_RULES §2 review. Its confirmed findings changed wording, guards, records and tests, never a scored number. §3 stays as declared; where it was wrong, §8 carries an erratum.

## 1. In plain terms

The growth replay found 29 moments where removing an agent's learned paragraph changed its usual call. This asks, for each one: **did the call made with the paragraph do better or worse than the call made without it?** "Better" is judged by what the market did next, through the closing bell that day. We measure it two ways: BaggerBomb points, using the Film Room tape's own arithmetic, and the plain price move.

| Question | Answer |
|---|---|
| **The label** | **No clear effect.** |
| How the 29 moments scored | 28 could be scored on both measures. On points, the learned call did better on 11, worse on 12, and tied on 5; price gives the same split. A coin-flip test cannot tell this apart from chance (p = 1.0). |
| How many of the changes were trades the learning stopped | **20 of 29.** In 4 more, the learning *caused* a trade; in the other 5, it changed which stock was bought. |
| What the control says | Across every trade the agents chose in the replay, **trading lost to holding more often than it won: 29 times against 19**, with 5 ties (p = 0.19, not significant). That count includes these 29 moments' own trades. The 30 trades that both versions of the agent made lean the same way on their own: 7 won, 13 lost (p = 0.26). |
| Which paragraphs drove it | None produced a clear result. The Trend Follower paragraph present on 16 moments came out roughly even. The Contrarian paragraph (12 moments) was slightly worse, and the other Trend Follower paragraph (1 moment) was worse. |

- **Where the learning stopped a trade, holding did better on 10 of the 20, worse on 7, and tied on 3** (p = 0.63, not significant).
  - That leans the same way as the control. But the control contains these same 20 trades, so the two are not independent.
  - This score cannot say whether the paragraph picked which trades to stop.
- **Where the learning caused a trade, the trade did worse** on 3 of 4, and tied on the fourth.
- **In total, the learned calls finished 100 points behind the unlearned ones over the 28 moments.**
  - The four largest misses (28 to 42 points each) add up to more than the whole gap; the other 24 moments net out slightly ahead.
  - At the next check after each moment the picture is just as even: 13 better, 11 worse.
- **The lean depends on a tie-breaking detail; the label does not.** Two of the 29 usual calls were exact ties in the votes. The replay broke such ties by alphabetical order.
  - Under the opposite rule, 30 moments change their usual call, and 29 of those score.
  - The learned call does better on 13 and worse on 11, finishing 60 points behind. The label is still **no clear effect**.
- **The two measures say nearly the same thing.** Unless a stock crosses a badge line, BaggerBomb points are about ten times the price move, times the slot's tier multiplier. They gave the same verdict on every scored moment, so they are not two independent pieces of evidence.
- **This is a small sample from founder and tester play.**
  - With 28 moments, only a large effect could have shown up as anything other than "no clear effect".
  - About 5 of the 29 changes are the kind that noise alone produces. The replay measured that same rate between two identical runs.

## 2. Gate facts

**Session preamble (BUILD_RULES §2/§3).**
- `git fetch origin` ran first.
- The worktree was cut from `origin/main` at `e880592e`, clean. The local branch is the app-suffixed `claude/experiment-changed-moments-score-0b40c9`, pushed as `claude/experiment-changed-moments-score`.
- `node_modules` is a junction into the primary checkout, unlinked at session end.

**Pre-declaration (rule 8).**
- **The commit.** The method (§3 and the script header's M1–M9) was committed as `731799d2` at 20:27:42Z and pushed at 20:27:49Z, **before any bar was fetched**.
- **Which script ran.** The run of record ran that exact file: SHA-256 `bd6b7a3e990236d2637f57e227b384664f668a26514a9766e5341eb1e8526d87`, logged per command in the run manifest.
- **The earlier drafts.** Two earlier `plan` runs came from uncommitted drafts, while the slot reconstruction was being debugged. They fetched no bars and ran no replay.
- **What `plan` reads, stated exactly (review A1).**
  - `plan` stores the battle-day's records, and those include quotes and trade prices recorded *after* each check: later evaluation entries' evidence prices, and later trades' exit prices.
  - The scorer never reads them. The review stripped them from a copy of the snapshot and reproduced `summary.json` and `results.local.json` byte for byte.
  - Nothing later than a check was printed during development: the console showed structure, counts, symbols and times only.
  - The drafts' code cannot be recovered, so this is the author's statement, not something the run record proves.

| Fact | Value |
|---|---|
| Run | `cms-20261014T202814` (`%USERPROFILE%/growth-replay-runs/`, outside git) |
| Run of record (14 Oct 2026, UTC) | `plan` 20:28:15 · `known-answer` 20:28:24, bars fetched 20:28:28–20:28:38 · `score` 20:29:20. Script `bd6b7a3e…8526d87` on all three. |
| Re-run after review | `known-answer` 21:30:48 and `score`, on the same run and bar cache, with the fixed script (commit `4abf6854`, SHA-256 `21c9e9b9…`). Every scored number is identical to the run of record: 0 differences across `summary.json` and `results.local.json`. 0 further EODHD requests. |
| EODHD requests | **41 of the 400 cap**, one per symbol, 0 failures |
| Known-answer, layer 1 (the tape's own rows, our bars) | **9 of 9** match exactly |
| Known-answer, layer 2 (our builder) | **4 of 4** in its domain match within the pre-declared 1-point tolerance. The re-run records them **exact on every number** (review B13). The other 5 are archetype-rule exits taken before the prompt was built, outside the builder's domain (§3.9): 4 came 1–2 s before the prompt, and 1 had no prompt at all. |
| Bars against the tape's stored 10-minute series | **28 of 28 compared series equal.** The 4 replayed tape-days hold 67 stored series; the other 39 are of symbols never fetched (SPY, RSP, sector funds, held names no call touched). The comparison is descriptive, not part of the gate (review B5). |
| Sale reconciliation: lock, exit price and fill against the platform's records | **20 of 20** each, over every recorded model swap on the 29 battle-days (4 tiered, 16 flat6). The re-run makes this a gate before any bar (review B2). |
| Self-test | 54 rows at the run of record; 78 after review. Mutation-checked (§8). |
| Firestore | Read-only; the §7 write-call grep gated every command in the same shell command (no matches) |
| Model calls | None |

**Inputs.**
- **Swap calls.** 69 distinct swap calls were needed. 57 built; the other 12 are crypto (`crypto_not_supported`).
- **Entries.** All 57 rendered exactly to the shown `$Entry`: 54 starting prices and 3 earlier fills.
- **Lock ATR.** 54 used `scoring.thresholds`.
- **The lock against LockNow.** The built lock equals the `LockNow` the agent was shown on **56 of 57** (review A5).
  - The one exception is a tiered control trade, counted in both controls: −64 built against −63 shown.
  - The cause is the evidence price, which the capture rounds to the cent, while LockNow uses the unrounded quote.
  - At the platform's −63 that trade's close difference is −24, not −25. The control sums would read −128, −20 and −203. No verdict, tally, p-value or label moves.
- **The 1-decimal ATR rule (M7).** 45 of the 57 used a 1-decimal ATR for one leg — in every case the bought name's, since those bench candidates have no stored threshold. Every held name's ATR was exact. Every one of their verdicts held at every corner of the rounding box, so M7 left nothing unscored.

**Changes after the method commit:**
- **The run of record** used the method commit's script unchanged.
- **After review**, the script changed guards, records and tests only. The header lists each change by review id, and the re-run reproduces every scored number.
- **This report:** the results sections and §8 were written after the run.

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

| Kind | Moments | Better | Worse | Tied | Sum (points) | Sign test p |
|---|---|---|---|---|---|---|
| Stopped (learning held, without it the agent traded) | 20 | 10 | 7 | 3 | −43 | 0.63 |
| Caused (learning traded, without it the agent held) | 4 | 0 | 3 | 1 | −46 | 0.25 |
| Changed pick | 5 (4 scored) | 1 | 2 | 1 | −11 | 1.0 |

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

**The control overlaps the moments (review A2; split added after the run, descriptive).**
- The control includes the changed moments' own trades: 34 of its 64 trades (33 of 53 scored) are legs of the 29 moments.
- For those legs the result is the record's own number. A stopped moment's control row is the negative of its record difference; a caused moment's is the same number.
- The rest are the 30 trades that both versions of the agent made at the same moment:

| Control part | Trades | Scored | Trade better | Trade worse | Tied | Sum (points) | Sum (price) | Sign test p |
|---|---|---|---|---|---|---|---|---|
| Batch check — legs of the 29 changed moments | 34 | 33 | 12 | 16 | 5 | +18 | −2.03 pp | 0.57 |
| Batch check — trades both versions made | 30 | 20 | 7 | 13 | 0 | −147 | −13.53 pp | 0.26 |
| Main run — legs of its own 29 changed moments | 36 | 33 | 10 | 18 | 5 | −73 | −9.82 pp | 0.18 |
| Main run — trades both versions made | 30 | 21 | 8 | 13 | 0 | −131 | −12.01 pp | 0.38 |

**Reading the control beside the label.**
- In this period a trade lost to holding more often than it won. That holds in the trades both versions made, which are independent of the moments (7 won, 13 lost; p = 0.26).
- So a paragraph that mostly *stops* trades would look helpful even if its content did not matter.
- Here the stopped trades favour the learning (10 against 7) and the caused trades go against it (0 against 3). Both lean the way the independent part of the control leans; neither is significant.
- The control does not set the label, and it cannot explain away a label of "no clear effect": there is no effect for it to explain.

## 6. Limits

- **The delayed quote.** Both calls start from the price the agent was shown: the platform's quote, about 15–20 minutes delayed.
  - **Measured on the 33 sales replayed for the set of record:** the shown price minus the 1-minute bar at the check had a median of −0.02%, ranging from −0.83% to +1.11%.
  - **Lag:** the minute whose price best matches the shown one sat a median 16 minutes before the check (3 to 39).
    - That search ran 0–40 minutes back, over n = 28: the first sale of each moment, since M20's sale has no shown price.
    - A wider window keeps finding coincidental earlier matches, so its maximum grows while its median stays at 16–17 (review A6).
  - The hold path and the trade start from the same vintage of quote, but each stock's own lag differs.
- **A one-step replay.** Both paths run from the check to the day's close. A later trade in the same slot is not replayed (the tape's own label). Eight figures are marked hypothetical for that reason: M02, M08, M09, M10, M15, M25, S03 and S04.
- **The call as proposed.** Each usual call is scored as if it had been carried out. Guardrails, the risk manager, the validator and the executor were not run, as in the replay. The live battle's own action at each check is shown beside it. At M03 and M10 it was a rule exit, taken before the prompt was built, that matches neither call.
- **Small numbers.** 28 moments scored, 23 of them not tied. At 23, the sign test needs a split of at least 17 to 6 to reach p < 0.05. Several usual calls are pluralities rather than majorities, and two are exact ties broken by the replay's pre-declared rule (the alphabetically first call wins):
  - **M22:** with learning, HOLD 3 and SWAP AMAT→MSFT 3 (malformed 2). HOLD wins only on alphabetical order.
  - **M21:** without learning, AMAT→CSCO 4 and AMAT→MSFT 4.
- **Tie-rule sensitivity** (review A3; computed after the run, descriptive). Under the opposite rule (the alphabetically last call wins):
  - **The set:** 30 moments change their usual call, against 29. M22 drops out, M21's call becomes AMAT→MSFT, and two others come in.
  - **The score:** 29 scored, 13 better / 11 worse / 5 tied on both measures, −60 points and −3.39 pp, p = 0.84: still **no clear effect**.
  - **What moves:** the descriptive lean (11 / 12 and −100 under the rule of record).
- **Noise.** About 5 of the 29 changes are the kind noise alone produces. The replay's no-effect flip rate for 8 against 8 repeats is 1.8%, and its fresh and original baselines differed on 5 of 280. Any real effect of the paragraphs is diluted by these noise flips.
- **Founder and tester play only.** It comes from a pre-launch product, 29 one-session battles between 22 Sep and 8 Oct 2026. The learning is three paragraphs: two Trend Follower versions and one Contrarian.
- **The two measures are nearly one.** Unless a badge line is crossed, points are about ten times the price move, times the tier multiplier. The tie bands were set before this was seen, and they line up for flat6 (1 point ≈ 0.10 pp). Agreement between the two measures is therefore not two pieces of evidence.
- **Flat6 has no tape precedent.** The tape never replays flat6 battles (BA-3), and 20 of the 29 moments are flat6.
  - **What validated:** for flat6, the scoring is the same imported replay with the 1.0 stamp the live evaluator uses. Its sale arithmetic matched the platform on all 16 flat6 model swaps.
  - **What did not:** its hold and swap paths could not be checked against stored numbers.
  - **Layer 2 is small:** it covers only the 4 tiered model swaps the tape replayed on these days.
- **ATR to one decimal.** 45 of 57 swap calls read at least one ATR only to 0.1. Every verdict held at every corner of that rounding (M7).
  - §3.7's reassurance that ATRs were "5–8% here" was wrong (erratum, §8).
  - One control trade did cross a badge line inside its corners: AMZN→V, with V shown at 1.0%. Its verdict held.
- **The shown price is rounded to the cent.** The capture stores the evidence price at 2 dp, while the platform's own LockNow and executor use the unrounded quote.
  - On 1 of 57 built calls this moved the lock by one point (§2).
  - On 4 of 57 it moved the price change in the second decimal.
  - No verdict moved.
- **End of battle.** For every moment it is the session close, so it adds no figure of its own. That rule is checked: all 29 battles are one completed session, and every scored trade falls on its battle's day.
- **Not scored, with reasons:**
  - **M20 and S02** — a crypto leg. M20's learned call sells BTC; S02 sells BTC on both calls (`crypto_not_supported`).
  - **The control** — 11 batch-check trades and 12 main-run trades, all for a crypto leg.
  - **Nothing else.** No moment lost its points to a missing bar, a missing input, a previous-close baseline, or the ATR rule.

## 7. No recommendation

This report makes none. The founder decides in the Practice Field chat.

## 8. Review record (BUILD_RULES §2)

**Why a review was required.** The branch diff is 4 files and about 2,140 lines, over the 1,500-line threshold.

**How it was run.**
- **Two lenses.** Each worked on its own LF `git archive` of `d147c2fc`, with a private copy of the run data, read-only on git and on the real run folder, and with no network:
  - **Lens A** was told to *refute the result*, on the prompt's five questions: the entry price, peeking, the same arithmetic as the tape, double counting or dropping, and whether the control explains the label.
  - **Lens B** reviewed code correctness and ran the self-test's mutation check.
- **Verifiers.** Every finding then went to a separate verifier, on its own archive, told to refute it with a concrete repro. That is 22 verifiers for 23 finding ids; A4 and B15 are the same point.
- **What the lenses recomputed independently.**
  - Lens A recomputed all 31 scored moments and 107 control trades from the cached bars, calling only the fenced scorer: every number matched.
  - Lens B re-ran `score` and reproduced the outputs byte for byte.

**Result: 18 CONFIRMED, 5 PARTLY CONFIRMED, 0 fully REFUTED.**
- Parts of six findings were refuted (A6, B2, B5, B8, B12, B16; see the dispositions below).
- **No finding changes a scored number or the label.** Severities are after verification.

| Id | Finding | Verdict | After verification | Disposition |
|---|---|---|---|---|
| A1 | "The drafts read inputs only / no outcome read" claims more than the code shows: `plan` stores the day's later quotes and trade prices | CONFIRMED | Low: not peeking; the scorer never reads them (strip-and-rerun gives byte-identical outputs) | Report §2 reworded to say exactly what `plan` stores |
| A2 | The control contains the moments' own trades (34 of 64); "points the same way as the control" is partly circular | CONFIRMED | Low (upper) | Overlap disclosed; split added (§5): the trades both versions made lose 7 to 13 on their own; §1 and §5 reworded |
| A3 | M22 and M21 are exact vote ties; no tie-rule sensitivity; noise floor not mentioned | CONFIRMED | Low: label holds under both rules | §6 names the ties, adds the opposite rule (30 moments, 13/11/5, −60, p 0.84, no clear effect) and the noise floor (about 5 of 29) |
| A4 / B15 | §1 said holding was "usually" better (10 of 20) and asserted an untested cause | CONFIRMED | Low | §1 reworded; p column added to the by-kind table |
| A5 | The "lock differs from LockNow" flag (1 control trade) was not disclosed | CONFIRMED, cause corrected: the 2-dp evidence price, not the inputs listed | Low: no verdict moves | §2 discloses it with the platform's −63 and the sums it would give; 56 of 57 locks equal LockNow |
| A6 | The lag window (0–40 min) and n (28) were not stated | PARTLY CONFIRMED: widening refuted (it finds coincidental repeats) | Nit | Window and n stated (§6); named constant in the script |
| A7 | The report cited a §8 that did not exist | CONFIRMED | Nit (blocks a push) | This section |
| B1 | Nothing tested `pathValues`; two index mutants survived silently | CONFIRMED | Medium (guard gap; code correct) | Self-test S12 built through the real `composeLegs` |
| B2 | The flat6 path is not gated | PARTLY CONFIRMED: the reported mutants are loud; the missing STOP matches the declared method; but a new silent mutant (score's replay call losing the flat6 stamp) survived everything | Low: this run's lock and replay agree on all 57 calls | Sale reconciliation is now a gate before any bar; `score` stops on a lock/replay disagreement at the sale; flat6 self-test rows |
| B3 | M7 is declared moment-wide; the code applied it per horizon | CONFIRMED | Low: no verdict moved at any horizon | Code changed to the declared text; §3.7 untouched |
| B4 | §3.7's "(5–8% here)" is wrong | CONFIRMED | Low (prose) | Erratum E1 below; §3.7 untouched |
| B5 | The series cross-check is not enforced and skips silently | CONFIRMED; adding a STOP refuted (stored series merge across retries) | Low | Read / compared / skipped recorded; denominator in §2; erratum E5 |
| B6 | "End of battle = close" is assumed, not checked | CONFIRMED (re-use hazard) | Low: 29/29 battles, 163/163 units | Checked and gated in `plan`, `known-answer` and `score` |
| B7 | Layer 2's domain was decided by whether a body exists, not by source | CONFIRMED | Low: all 5 exclusions are rule exits | Every model swap is in the domain; one without a body now fails the gate loudly |
| B8 | "Exact" ATRs are 1-dp matches against later records | PARTLY CONFIRMED: examples misattributed; one latent path (bench record, used 0 times) | Informational | Bench record must render to the shown ATR; erratum E4 |
| B9 | Self-test gaps: points-only label rows, a missing hold leg, the price tie band, two `atrStable` cases, the coarse lock | CONFIRMED | Low | Rows added; each kills its mutant |
| B10 | Self-test gaps: count after the request, per-day requests, partial redaction | CONFIRMED | Low: the run made 41 requests for 41 symbols; nothing leaked | Rows added |
| B11 | Self-test gaps: `slotsAt`, entry-only check rows, the `$Entry` check, the sign of `moveAt` | CONFIRMED; the `moveAt` gap raised to medium | Low/medium | Rows added; points-against-price agreement now in the summary (28/28, 53/53, 54/54) |
| B12 | §3.3 describes the entry as a single fallback list; the code has two exclusive branches | PARTLY CONFIRMED: the code is right and stricter | Nit: 0 effect | Erratum E2; §3.3 untouched |
| B13 | Layer 2 "exactly on every number" had no artifact behind it | CONFIRMED | Nit | Layer 2 now records exact equality; the re-run shows 4 of 4 exact |
| B14 | S8 tested only the tiered positions table | CONFIRMED | Nit | Flat6 S8 row |
| B16 | `score` did not check the known-answer's script; two mislabelled reasons | (a) CONFIRMED; (b) mostly refuted (only when both legs' bars are missing); (c) CONFIRMED, latent | Nit | `score` stops on a known-answer run by another script; both reasons fixed |

**Errata to the pre-declared §3** (left verbatim; these are corrections, not changes of method).

- **E1 (B4).** §3.7's "(5–8% here)" was wrong when written.
  - The coarse ATRs were all bought legs: 2.5–8.0% in the set of record (17 of 26 below 5%), and 1.0–8.0% across all 45. Held legs were exact at 1.2–7.84%.
  - A badge was within reach. In the control, AMZN→V (V shown at 1.0%) crossed a bust line at the close at ATR 1.0 and 0.95, but not at 1.05.
  - M7's corners caught it, and the verdict held (−19 against −9).
- **E2 (B12).** §3.3's "X's entry" row reads as one fallback list. The code has two exclusive branches:
  - if a swap brought X in before the check, only the swap's records are tried;
  - `startingPrices[X]` is tried only for a name held from the start.
  - Where the two readings would differ, the baseline is the previous close, so that moment is not scored either way.
- **E3 (B3).** M7 as written unscores a moment's points at *every* horizon if a verdict moves at *any* horizon. The run of record's code applied it per horizon. No verdict moved at any horizon (0 of 452 corner evaluations), so the two readings give identical output. The code now follows the text.
- **E4 (B8).** Why the "exact" ATR sources hold the value in force at the check:
  - a held asset's `baseATR` is written only at creation or swap-in;
  - `scoring.thresholds` is fixed at creation;
  - a receipt or bench copy repeats the held value.
  - Synthetic bench names, by contrast, have their ATR rebuilt at every check. That is why most bought legs read the body's 1-dp value under M7.
- **E5 (B5).** §3.4's "must equal" describes the expected result of a descriptive cross-check, not a gate. A stored series is merged bucket by bucket across the candle pass's retries, so a mismatch is reported, not gated.

**Mutation check.**
- **At the run of record.** Lens B ran 68 mutants against the 54-row self-test. 48 were killed and 3 are equivalent:
  - **T6:** points deltas are integers.
  - **H5:** a history inside the same badge band scores identically.
  - **Q3:** an empty domain gives NaN, which fails the share test anyway.
  
  17 survived. The verifiers added more, among them the silent stamp mutant (B2).
- **After the fixes.** 85 mutants ran against the 78-row self-test:
  - **82 killed.** T6 is now killed by the frozen tie pin.
  - **2 equivalent:** H5 and Q3.
  - **1 killed at run time:** the mutant that drops the flat6 stamp from `score`'s replay call is not a self-test case. Both of `score`'s new guards stop it: the known-answer SHA check, and, with that bypassed in a copy, the stamp check, which flagged 25 swap calls.

**The re-run after the fixes.**
- `known-answer` and `score` ran on the same run, from the same bar cache, with the committed fixed script (`4abf6854`). They made 0 further EODHD requests.
- Every field of the run of record's `summary.json` and `results.local.json` is identical.
- The new descriptive block, `summary.postReview`, carries the control split, the opposite tie rule, the points-against-price agreement and the stamp check: 58 of 58 calls agree.

**Builds and checks at the pushed head:**
- `vite build` passes on the LF `git archive` (see the PR).
- ESLint and the CI lint gate are clean.
- The four repo tests that walk `scripts/` pass: the protected-store scan, the writer census, the runbook gate and the flag-pin guard.
- The self-test passes 78 of 78.
- The §7 write-call grep finds no matches.
