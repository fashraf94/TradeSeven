# Experiment — Did the learning help? Scoring the changed moments

**Date:** 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Prompt:** Fable, "Experiment — Did the learning help? Scoring the changed moments", 14 Oct 2026 · **Base HEAD:** `e880592e` (`origin/main` after `git fetch origin`) · **Branch:** `claude/experiment-changed-moments-score` · **No model calls.**

> **Status of this file at this commit: METHOD ONLY.** Section 3 is the pre-declared method, committed with the script before any price bar was fetched and before any outcome was read (rule 8). Every other section is filled by the scoring run in a later commit; until then it reads *pending*.

## 1. In plain terms

*Pending the scoring run.*

## 2. Gate facts

*Pending the scoring run.*

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

*Pending the scoring run.*

## 5. The second set, and the control

*Pending the scoring run.*

## 6. Limits

*Pending the scoring run.*

## 7. No recommendation

This report makes none. The founder decides in the Practice Field chat.
