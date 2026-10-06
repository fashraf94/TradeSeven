# Film Tape First Smoke — Discovery (Q1–Q3)

**Date:** 2026-10-02 · **Type:** READ-ONLY discovery (founder-authorized, Flash 2026-10-02). No product code, config, flag or data was changed. No production call was made.
**Branch:** `claude/elegant-hypatia-pms6j5` · **Cut from:** `origin/main` @ `9dfbea21dbb1c22f2e35009d95ef60a51f00078a`, after `git fetch origin`. HEAD equalled `origin/main` and the tree was clean at the start.
**Files added:** this report, and `scripts/inspect-battle-lifecycle.js` (read-only).
**Fence (BUILD_RULES §1):** I read `agentSwapExecution.js`, `agentScoring.js`, `agentBattleService.js` and `decide.js`, and I called `calculateAssetScoreServer` in a scratch reproduction. **No fenced file was edited.**
**Reproduction environment:** a `git archive HEAD` snapshot in the session scratchpad, outside the repo, with `firebase-admin` installed only there. The container has no `node_modules`. Nothing from the snapshot was written into the repo. There was no Firestore or market-data call. Every number below comes from the real modules.
**Markers:** **V** = VERIFIED (I read the code at that line in this session, or ran it). **A** = ASSUMED (inferred, with the check that would settle it).

---

## Verdict

| Q | Answer | Class | Proposed fix (not made) |
|---|---|---|---|
| **Q1** `closedLegDelta` −7 (DRgA4…, GOOGL→MU, tickSeq 7) | Both sides pass the **same** scorer inputs except the **price**. The executor banked **−17** at the evaluator's EODHD `/real-time/` quote **355.66**. That quote is delayed, and the live-price beacon is retired. The tape rebuilt **−24** at the close of the 1-minute bar that completed at 16:16:00Z. To score −24 under the recorded inputs, that close must lie in **352.89–353.24**. Both numbers are reproduced with the real scorer and the real `replayAction`. | **A modeling difference the tape should record.** It is not a tape bug. | Keep the sold leg's rebuilt price. Split `closedLegDelta` into `inputsDelta` and `priceDelta`. `inputsDelta` re-scores the recorded exit price through the same imported scorer, minus `lockedPoints`: 0 here. `priceDelta` is −7 here. Record the platform's quote basis, and restate the flip-smoke criterion. |
| **Q2** derived `"draw"` (ogbLF…) | Confirmed. `buildBattleBlock` calls `resolveBattleResult`, which calls the evaluator's `resolveCompletionDisposition`. That function reads a **missing** `opponentScore` as `0` (`agent-evaluate.js:5998`), so 0 vs 0 gives `'draw'`. The platform's own completion did the same thing. It wrote statusFeed "Result: Draw." and added a draw to the agent's stats, but **no `result` field**. That missing field is why the tape derives one. | The tape copies a platform default it should not repeat. | When either operand is missing, derive no result: `{ value: null, basis: 'unavailable' }`. The merge rank must change with it, or the stored `'derived'` draw survives every re-merge (`tapeMerge.js:205`, `:343-344`). |
| **Q3** taped with 0 evals / 0 ticks / no deferral / no opponent | One code path produces **every** listed symptom. A tiered battle carries mandatory crypto, so its fullday expiry is 20:00 ET. If it is deployed on a weekday after the evaluator's last in-session run has read the battles (~15:45 ET) and before 20:00 ET, it gets `tradingDays: [today]` and expires at 20:00 ET. The evaluator evaluates nothing after 16:00 ET. The 09:00 ET run on the next session completes the battle as 0 vs (absent), which gives a Draw. The other paths are listed in §3.5. The new script's fields tell them apart. | Platform question (Command Center arc). The tape reported correctly. | — The script is the discriminator: `node scripts/inspect-battle-lifecycle.js --battle ogbLFLndtIumeO0zZVT9` |

---

## Q1 — `closedLegDelta` −7

### 1.1 The executor's lock call, argument by argument (`agentSwapExecution.js:191-251`)

The call is `calculateAssetScoreServer(assetObj, rawPctChange, assetHistory, {}, thresholdPriceChange)` at **`:248`** (V).

| Argument | Value in this swap | Source | |
|---|---|---|---|
| `assetObj.symbol` | GOOGL | `outAsset.symbol` `:166` | V |
| `assetObj.baseATR` | 3.2 | `liveData.scoring.thresholds[out].threshold \|\| outAsset.baseATR \|\| 2.5` `:204-205` | A — the trade does not record the executor's ATR. The evidence stamp's `atrX` −0.53 = −1.6835 / 3.2 confirms the evaluator used 3.2 on the same tick. It is badge-only here (§1.3). |
| `assetObj.tier` | support | `resolvedTier` `:209` | V |
| `assetObj.direction` | null | `:210` | V |
| `assetObj.tierMultiplier` | *(not set)* | Tiered resolves `flatMultiplier: null` (`:201`, `:215`; `src/constants/agentGameModes.js:50`), so the scorer uses `CONVICTION_MULTIPLIERS.support` = 1.0 | V |
| `rawPctChange` | −1.683483… | `(exit − entry) / entry × 100` `:242`. Entry: `swapPrice \|\| startingPrices` `:191-193` = 361.75. Exit: `getPrice(out)` `:194` | V |
| exit price source | 355.66 | `getPrice` prefers a fresh `livePriceBeacon` and otherwise uses `currentPrices[sym].current` (`:181-188`). **The beacon is never written.** It was retired by founder ruling on 2026-07-16 (`src/screens/AgentBattleScreen.jsx:780-797`). So the exit price is the tick's EODHD `/real-time/` close (`agent-evaluate.js:1033` → `marketDataCache.js:744`, `:750`). All six `executeSwapServer` call sites pass that tick's `prices` or `fetchPricesForProposal`'s, which come from the same endpoint (`agent-evaluate.js:2012`, `:3573`, `:4805`, `:5027`, `:5429`, `:5655`; `:4709-4713`). | V |
| `assetHistory` | {max 0.022892…, min −0.484623…} | `liveData.thresholdHistory[out]` `:247`. This is the persisted pre-tick history: the tick's own ratchet is written only in the end-of-tick `scoreUpdate` (`agent-evaluate.js:1261`). | V |
| `extremes` | `{}` | `:248` | V |
| `thresholdPriceChange` | −1.683483… | `resolveThresholdBaseline` `:225-235` returns `swapPrice` first (`baselineValidation.js:272-274`), which is 361.75. `:243-245`. | V |
| **Result** | **−17** | base −16.83, multiplier −0.526, no badge → `lockedPoints` `:250`, rounded `:263` | V (run) |

### 1.2 The tape's `runLeg` at the swap sample (`api/_utils/filmTape/tapeReplay.js:103-124`)

| Input | Value | Source | |
|---|---|---|---|
| `entryPrice` | 361.75 | `trades.entryPrice` (`tapeAssemble.js:437`, `:349-352`) | V |
| `atr` | 3.2 | `receipt.guardrailReplay.outgoingBaseATR` (`tapeAssemble.js:353`). The receipt takes it from `assetScores[].baseATR` (`agent-evaluate.js:3402`, `:3703`). | V |
| `tier` / `direction` | support / null | `tapeAssemble.js:345`, `:347` | V |
| history | {max 0.022892…, min −0.484623…} | `receipt.guardrailReplay.thresholdHistory` (`tapeAssemble.js:356`). The receipt records `battle.thresholdHistory[symbolOut]` (`agent-evaluate.js:3704`), the same pre-tick persisted history the executor read. | V |
| baseline | 361.75, `swap_price` | `ghostBaseline` `tapeAssemble.js:318-326` | V |
| tier stamp | null | `tapeReplay.js:117` (tiered) | V |
| extremes | `{}` | `tapeReplay.js:118` | V |
| **price** | the 16:15Z bar's close | `sampleAt(bars, swappedOutAt)` (`tapeReplay.js:107`, `:156`, `:173`) returns the close of the last 1-minute bar **completed** at or before 16:16:04.052Z. That is the bar starting 16:15:00Z (12:15 ET), completed 16:16:00Z and 4 s old, so it is valid (`bars.js:83-100`, `:43`). | V (run) |

### 1.3 Reproduction (scratch script, real modules, outside the repo)

| Run | Price | Result |
|---|---|---|
| The executor's call, argument for argument (§1.1) | 355.66 | **−17**; multiplier −0.526; no badges |
| Real `replayAction` with the 16:15Z bar at 355.66 | 355.66 | `ghost.atSwap` −17, **`closedLegDelta` 0** |
| Real `replayAction` with the 16:15Z bar at 353.07 | 353.07 | `ghost.atSwap` **−24**, **`closedLegDelta` −7** |
| Prices that `runLeg` scores at exactly −24 under the recorded inputs (cent grid) | **352.89 – 353.24** | — |
| Every *other* single input varied, at 355.66 | — | core −25 · star −34 · ATR 2.5 −17 · ATR 1.0 −47 · history reset −17 · history already at bust −27 · short +17. **None gives −24.** |

**The input that differs is the price.** Both `priceChange` and `thresholdPriceChange` derive from it. The rebuilt price at the sale is ≈0.7% below the price the executor banked. (V, run)

### 1.4 Why the two prices differ

- The executor prices on the evaluator's EODHD `/real-time/` quote. That feed is documented as **15–20 minutes delayed**: `docs/audits/20260918_PHASE0_INTRADAY_DATA.md:499` (V, read), and the comment at `agentSwapExecution.js:180` (V). The delayed feed is deliberate, by the beacon-retirement ruling (`AgentBattleScreen.jsx:780-797`, V).
- The quote's own `timestamp` is kept in memory (`marketDataCache.js:757`, V). It is **not** persisted on the trade (`closedTrade`, `agentSwapExecution.js:255-273`, V). The evidence stamp stores only `px` (`tickStamps.js:201`, V). So the vintage of 355.66 is unrecorded. The swap check's evidence `px` of 355.66 equals `trades.exitPrice` because both are `prices.GOOGL.current` from the same fetch.
- The tape follows spec BA-11 (`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md:58`): the price at an instant is the last completed minute. **Same instant, two vintages.**
- **A:** that 355.66 is GOOGL's price ~15–20 minutes before 16:16Z. **Founder-run check, read-only, no new production call:** run `node scripts/export-film-tape.js --battle DRgA4vrEIZ0kN574vexk --date 2026-09-22`. In GOOGL's 10-minute series, the 12:10 ET bar's [low, high] should contain a value in 352.89–353.24. A bar ≈15–20 minutes earlier should contain 355.66. MU's `boughtVsEvidence.pxDelta` on the same row is a second witness, because the fill and the evidence `px` are delayed quotes too.

### 1.5 Classification: a modeling difference the tape should record

- **It is not a tape bug.** Every scorer input agrees, and the tape implements BA-11 as written.
- **It is not "expected, nothing to do" either.** Stored bare, `closedLegDelta` −7 reads as scorer disagreement at the sale, but it is a quote-vintage difference. The spec's flip-smoke criterion "`closedLegDelta` small" (spec `:200`) will fail by construction whenever a name moves during the feed delay. The size is ≈ 10 × tier multiplier × the move over the delay: 0.7% on a support slot is 7 points, and on a star slot it would be 14.
- **The same split runs past the sale.** I state this and do not fix it. `lockedPoints` is at the delayed quote. `ghost.*` and `bought.*` are at bar prices. `bought.entryPrice` is the delayed fill (`tapeAssemble.js:374-378`). So `gapPoints` carries the feed delay at both ends. Here a sale at the bar price would have banked −24, which gives the swap path +7 that comes from the feed delay and not from the decision.

### 1.6 Proposed fix (not made): non-fenced `filmTape` modules only

1. **`tapeReplay.js`: keep the sale's price and split the delta.** `runLeg` already holds `price` (`:121`); `point()` drops it (`:68`). Add `reconciliation.soldAtSale` with these fields:
   - `recordedPx`: the row's `exitPrice`, which is `trades.exitPrice` (`tapeAssemble.js:460`).
   - `rebuiltPx` and `barClosedAt`.
   - `pxDelta`.
   - `rescoredAtRecordedPx`: the **imported** `calculateAssetScoreServer` with the ghost inputs at `recordedPx` (no local math, BUILD_RULES §4).
   - `inputsDelta` = `rescoredAtRecordedPx − lockedPoints`.
   - `priceDelta` = `ghost.atSwap − rescoredAtRecordedPx`.

   By construction, `inputsDelta + priceDelta = closedLegDelta`. This swap would read 355.66 / ≈353.07 / −17 / **0** / **−7**. Add the same at the fill as `boughtAtSale` { `recordedPx`: `inBasis.price`, `rebuiltPx` at the swap, `pxDelta` }, so the fill's delay shows too. Compose both beside `composeLegs` so that `mergeReplay` (`:361-407`) states them exactly as a build does.
2. **Record the basis.** Add `lockedBasis: 'eodhd_realtime_delayed'` with its source note. The replay already says `basis: 'rebuilt_1m_at_checks'` (`:228`).
3. **Provenance classes (BA-21)** in `src/constants/filmTape.js` (beside `:215-222`): `recordedPx` is `recorded`; `rebuiltPx` is `market`; `rescoredAtRecordedPx`, `inputsDelta` and `priceDelta` are `rebuilt`.
4. **Spec amendment, BA-11 and the flip smoke (`:200`).** Replace "closedLegDelta small" with "`inputsDelta` = 0 on every action; `priceDelta` reported, not judged".
5. **Platform, separately (fence-gated, not proposed for this arc).** Persisting the quote's own timestamp on `closedTrade` would let the tape name the vintage instead of inferring it. `closedTrade` is in fenced `agentSwapExecution.js:255-273`.

---

## Q2 — the derived `"draw"` for ogbLFLndtIumeO0zZVT9

### 2.1 Where (all V)

- `writeTapeDay.js:102` passes `resolveBattleResult`. `tapeAssemble.js:1082` calls `buildBattleBlock`.
- In `buildBattleBlock` (`tapeAssemble.js:750-765`), `:752` checks for a stored `battle.result` among `win`/`loss`/`draw`. **There is none.** Next, `:756` sees the battle is completed, calls `resolveResult(battle)` and sets `basis: 'derived'`.
- `battleResult.js:12-15` calls `resolveCompletionDisposition` (`api/cron/agent-evaluate.js:5985-6009`). There, `:5987` reads `currentScore || 0` and **`:5998` reads `opponentScore || 0`**. At `:5999`, 0 vs 0 gives `'draw'`.
- The same block stores `final.opponent: num(undefined)`, which is `null` (`:760-763`). So the tape already holds `final.opponent: null` beside `result: 'draw'`, and the document contradicts itself.

### 2.2 What the platform's own completion recorded (code V; the document itself is read by the new script)

- `completeBattle` (`agent-evaluate.js:6054` and after) writes **no `result` field**: its payload (`:6174-6214`) has none. That is why the tape derives one.
- It writes a statusFeed entry with `action: 'battle_complete'`, `score: 0` and the message from `:6004`: **"Battle complete. Agent: +0.0 pts vs CPU: +0.0 pts. Result: Draw."** (`:6202-6208`).
- On the agent's record target it writes **gamesPlayed +1, draws +1, currentStreak reset to 0** and totalScore +0 (`:6277-6311`).
- So the platform also counted this battle as a **draw** on a missing operand.
- If the battle was instead completed by `decide.js`'s bare GC (`api/agent/decide.js:763-768`) and repaired later (`agent-evaluate.js:356`, `:6410`), the same statusFeed entry and stats are written, but `completedAt` is kept from the GC. The script's last statusFeed entries show which: in a repair, the entry's time differs from the known `completedAt`.

**Why the operand is missing (V).** `createAgentBattle`'s `scoreState` has no `opponentScore` (`agentBattleService.js:274-286`). Only a scored evaluator tick writes it (`agent-evaluate.js:1226`). The final `currentScore` 0 is the creation literal (`agentBattleService.js:275`); it was never scored (`lastScoredAt: null`).

### 2.3 Proposed rule (not made)

- **The rule.** In `buildBattleBlock`, when there is no stored result and the battle is completed: if `num(scoreState.currentScore) === null || num(scoreState.opponentScore) === null`, set `result = { value: null, basis: 'unavailable' }` and **do not call** `resolveResult`. A stored result keeps precedence. Tournament battles are unaffected: `resolveBattleResult` already returns null for them.
- **Required with it:**
  - **(a) Merge rank.** `tapeMerge.js:205` ranks `{ not_completed: 0, derived: 1, stored: 2 }`. An unranked `'unavailable'` counts as 0. For the same completion, `battleWinner` keeps the stored side when it ranks higher (`:343-344`). So the already-written `'derived'` draw would beat the corrected block forever. Rank `'unavailable'` above `'derived'`, or treat a derived result whose `final.opponent` is null as no fact.
  - **(b) Spec.** BA-4 and the §4 schema (spec `:51`, `:94`) gain `'unavailable'`. The read-out and A2 need copy for it.
  - **(c) Re-tape.** The close pass revisits only completions since the previous session (`closePass.js:116`, `completionsSinceMs`). ogbLF…'s 2026-09-28 tape therefore needs the backfill path to pick up the fix.
- **Note.** Under the rule the tape will disagree with the platform's own "Draw" (statusFeed and career stats). That is the honest state. Whether completion should count a never-scored battle as a draw is a Command Center question. It is reported in §4, not fixed.

---

## Q3 — a battle taped with no evaluation

### 3.1 Creation and activation (all V)

- **Creation and activation are one instant.** `createdAt = activatedAt = now` (`agentBattleService.js:139-140`), and the battle is born `status: 'active'` (`:132`). Nothing else in `api/` writes `activatedAt` (grep). "Activation timing" is therefore deploy timing.
- The tiered deploy is `decide.js:912-929`. Its opponent is `{ portfolio, bench, username: 'CPU Opponent', odUserId: 'cpu' }` (`decide.js:892-897`).
- `decide.js` has **no market-hours gate** on deploy: no `isMarketOpen` or `getMarketState` (grep).
- The deploy opener writes statusFeed `{ action: 'first_message', message: 'Agent opened the conversation.' }` at the deploy instant (`decide.js:1647-1650`, `:1660`).

### 3.2 How `timing.tradingDays` is assigned (all V)

- `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`agentBattleService.js:35`). So `tradingDays = [targetDateStr]` of `getNextMarketClose({ cryptoExtended: hasCrypto })` (`:117-121`, `:377-391`).
- Tiered portfolios carry mandatory crypto (`agentGameModes.js:46`, support[2]). That makes `cryptoExtended` true, so the effective close is **20:00 ET**, except on early-close days (`marketSchedule.js:241-242`). `timing.localClose` records `'20:00'` (`agentBattleService.js:121`, `:150`).
- `getNextMarketClose` (`marketSchedule.js:229-262`) returns today on a non-holiday weekday before 20:00 ET, and the next session's 20:00 ET otherwise.

| Tiered deploy (ET) | `tradingDays` | `expiresAt` | Evaluated? |
|---|---|---|---|
| weekday before 09:30 | today | today 20:00 ET | yes, from 09:30 |
| weekday 09:30 to the last run's battle read (~15:45) | today | today 20:00 ET | yes |
| weekday ~15:45 – 16:00 | today | today 20:00 ET | **no** — no later in-session run |
| **weekday 16:00 – 20:00 ("after the close")** | **today** | **today 20:00 ET** | **no** — the evaluator stops at 16:00 |
| weekday ≥ 20:00, weekend, holiday | next session | next session 20:00 ET | yes, next session |
| early-close day after 13:00 | next session (no crypto extension) | next session 20:00 ET | yes |

- Flat6 has no crypto, so its boundary is 16:00, and a post-close flat6 deploy rolls to the next session: no gap.
- Nothing rewrites `tradingDays` later. `agent-daily-scores` bumps only `timing.currentTradingDay` and `lastDailyResetAt` (`agent-daily-scores.js:188-189`).

### 3.3 `findActiveAgentBattles` (V)

- The filter is `status == 'active'` and nothing else (`agentBattleService.js:43-50`): no time filter, no `tradingDays` filter, no mode filter.
- It is called by the evaluator (`agent-evaluate.js:290`), by daily scores (`agent-daily-scores.js:230`) and by the tape close pass (`closePass.js:118`).

### 3.4 The evaluator's admission, in order (all V)

1. **Expiry first, before the market gate.** If `expiresAt < now`, `completeBattle` runs (`agent-evaluate.js:294-321`). Otherwise the battle is a candidate (`:323`).
2. **The market gate.** `isMarketOpen()` is true on a non-holiday weekday with ET between 09:30 and 16:00 (13:00 on early-close days) (`marketSchedule.js:129-146`). Otherwise the handler returns **without a run record** (`agent-evaluate.js:363-366`; the record begins at `:370`).
3. **The budget.** The tail the loop never reached is deferred and listed (`:424-433`).
4. **The lock.** If `cronState.evaluatingAt` is less than 120 s old, the battle is `lockSkipped`. That is a count only, kept in the run record (`:814`, `:860-867`, `:547`).
5. **Admitted.** `cronState.tickSeq` is incremented in the lock transaction (`:850`). A capture context is created, and the tick is finalized in the `finally` (`:4534`).

`tradingDays` plays no part in admission.

The schedule is `*/15 13-21 * * 1-5` UTC (`vercel.json:157-158`): 36 invocations a day. In EDT, 26 of them pass the gate (13:30Z–19:45Z); **those are the day's 26 agentEvalRuns**. The 20:00Z–21:45Z invocations (16:00–17:45 ET) exit at the gate and leave no record.

### 3.5 Every path to the symptom set

The symptoms: taped for 2026-09-28; 0 evaluations; 0 ticks; in none of the day's 26 deferral lists; no opponent score; completed 2026-09-29T13:00Z; final 0.

| Path | Mechanism | Fits? |
|---|---|---|
| **P1a** deploy 9/28 between the 19:45Z run's battle read and 16:00 ET | `tradingDays: ['2026-09-28']`, expiry 2026-09-29T00:00Z. No in-session run after creation. | **Fits all symptoms** |
| **P1b** deploy 9/28 16:00–20:00 ET ("after the close") | Same `tradingDays` and expiry. Every later 9/28 invocation exits at the market gate. | **Fits all symptoms** |
| **P2** deploy earlier on 9/28, never admitted | Needs a lock-skip in **every** later run. No code holds `evaluatingAt` across runs: it is cleared on every exit, with a 120 s timeout. It would show as `lockSkipped > 0` in each 9/28 run record. | Implausible; `createdAt` before ~15:45 ET would flag it |
| **P3** not `'active'` during the session | No code path does this: the battle is born active, and `activatedAt` is written only at creation. | Excluded (V) |
| deploy ≥ 20:00 ET, weekend or holiday | `tradingDays` is the next session and expiry is 2026-09-29 20:00 ET, so it would not complete at 13:00Z. | Excluded |
| `decide.js` bare GC completion | Happens only on the owner's redeploy; `completedAt` would be that instant, not the run's 13:00Z. | Excluded by `completedAt`; the statusFeed confirms |

Under P1a and P1b the rest follows from the code (V), with one A:
- Taped for 9/28: `isBattleDay` (`src/utils/tapeSchedule.js:85-87`). The close pass at 02:15Z (`vercel.json:209-210`) found the battle still active.
- `agent-daily-scores` at 01:45Z (21:45 ET) processes it as active. Expected: `day1` recorded, `currentTradingDay` 2, `lastDailyResetAt` ≈ 01:45Z (A until the script runs).
- The first evaluator invocation after the 00:00Z expiry is Tuesday 13:00Z. `completeBattle` then sets `completedAt` ≈ 13:00Z, with `currentScore` 0 (creation) and `opponentScore` absent, giving a **Draw** (§2).

**The tape reported correctly.** 9/28 is in `tradingDays` and no check happened.

### 3.6 `scripts/inspect-battle-lifecycle.js`: usage and what each field separates

```
node scripts/inspect-battle-lifecycle.js --battle ogbLFLndtIumeO0zZVT9
```

- **Credential handling:** identical to `scripts/export-film-tape.js`. `FIREBASE_ADMIN_CREDENTIALS` comes from `.env.local` or the environment, and the project id is printed to stderr ("CONFIRM this is the project you meant").
- **Read-only:** the reader exposes a single `get()` and no write method. The script makes no flag import and no fetch.
- **Output:** the read-out goes to stdout, so `> file` captures only it.
- **What it prints**, exactly the fields asked for:
  - `createdAt`, `activatedAt`, `status`, `gameMode` and `agentId`;
  - every `timing.*` key;
  - every `scoreState` key, with `currentScore`, `opponentScore`, `lastScoredAt` and `evaluationCount` always printed first;
  - the opponent fields (`opponent.*`, with portfolio and bench as symbols);
  - the first and last 10 statusFeed entries, as type (the entry's `action`, else `type`), time and message.
- **Formatting:** instants carry their ET wall clock. **An absent field prints `(absent)`; a stored null prints `null`.**

| Field | P1a | P1b | P2 | GC completion |
|---|---|---|---|---|
| `createdAt` / `activatedAt` (ET) | 9/28 ~15:45–16:00 | 9/28 16:00–20:00 | 9/28 before ~15:45 | any |
| `timing.tradingDays` / `localClose` | `["2026-09-28"]` / `20:00` | same | same | — |
| `timing.currentTradingDay` / `lastDailyResetAt` | 2 / ≈ 21:45 ET 9/28 | same | same | — |
| `scoreState.lastScoredAt` / `evaluationCount` / `opponentScore` | null / 0 / (absent) | same | same | — |
| statusFeed first entries | `first_message` at `createdAt` | same | same | — |
| statusFeed last entries | `battle_complete` "…Result: Draw." at ≈ 13:00Z 9/29 | same | same | `battle_complete` time ≠ `completedAt` |

- **Not printed, by the field list.** These would sharpen the read; I can add them on request:
  - `expiresAt`;
  - `completedAt` / `completionReason` (`'expired_repaired'` marks the GC path);
  - `cronState.tickSeq` / `lastEvaluatedAt` (whether any tick was ever admitted).
- **Verified offline only**, against an in-memory double:
  - absent vs null;
  - first and last 10 without overlap, and all entries when there are 20 or fewer;
  - a missing document;
  - missing credentials → exit 1;
  - bad arguments → exit 2.

  **It has not been run against production.** This container has no credentials, and that run is not authorized here.

---

## 4. For separate tasking (reported, not fixed: BUILD_RULES §3)

1. **Platform (Command Center arc): born finished.** A tiered fullday battle deployed on a weekday between ~15:45 and 20:00 ET is born with no evaluable minute left. It lives until 20:00 ET, completes at 09:00 ET on the next session as a 0–0 **Draw**, and counts in career stats (draws +1, streak reset) (§3.2–3.5).
2. **Platform: missing operand read as zero.** Completion reads a missing `opponentScore` as 0 (`agent-evaluate.js:5998`). A never-scored battle becomes a recorded draw (§2.2).
3. **Platform (fenced executor): quote vintage unrecorded.** The quote's own timestamp is not persisted on trades or evidence (§1.4). The tape can only infer the vintage.

## 5. Not done, by instruction

- No product-code change.
- No production or Firestore call.
- No PR, no flag flip, no CI watching.
- The branch is pushed with this report and the script, and work STOPS there.
- File count: 2 added, below the BUILD_RULES §2 review threshold.
