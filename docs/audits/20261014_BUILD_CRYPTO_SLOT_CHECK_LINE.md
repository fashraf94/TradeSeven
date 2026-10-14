# Build — Crypto Slot v2: the per-check line, the SWAP_OUT annotation, paragraph v2 + probe v2 — **STOP at Step 0**

**Date:** 14 Oct 2026 · **Prompt:** Fable, "BUILD PROMPT — Crypto Slot v2: the per-check line, the SWAP_OUT annotation, paragraph v2 + probe v2", 14 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base:** `main` @ `e880592e` (= `origin/main` after `git fetch origin`) · **Branch:** local `claude/crypto-slot-check-line-42b5d3` (the app's worktree suffix), pushed by refspec as `claude/crypto-slot-check-line` · **Governing documents:** `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md`, `docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md` · **Report back to:** the Fable chat that issued the prompt.

**Read-only so far.** No file under `src/` or `api/` was edited. This report is the only file on the branch. No model calls were made and nothing was spent ($0). Every `file:line` was read at `e880592e` in this session (VERIFIED) unless it is marked INFERRED.

**Why this stopped.** Step 0.4 Q-a carries a hard STOP: "STOP if any platform path can swap or exit the held crypto on its own, where the D-5 line or the D-6 annotation could then contradict what happens on the same tick." One path does that: a user's stop-loss, trailing-stop or profit-target guardrail (§1, Q-a). The build waits for Fable's ruling on it.

---

## Verdict

| Item | Result |
|---|---|
| Step 0.1 gate | **Passed.** PR #961 is merged (`6d75a324`). `main` = `e880592e`. Tree clean. `api/_utils/evalCryptoSlotBlock.js` and both 20261014 reports are present. |
| Step 0.2 baseline | Linux, CI-shaped (`TZ=UTC`, `--maxWorkers=2`, private WSL clone at `e880592e`), run twice. Run 2: `Test Files 957 passed │ 7 skipped (964)`, 20,523 tests, **0 failing**, so the baseline failing set is **∅**. Run 1 had 1 failing row (`api/_utils/callRecords/publish.test.js`, a deadline row). That file passes alone 3 times out of 3 and passed in run 2, so it is recorded as a load flake. `lint:gate` green. |
| Step 0.3 capture | System prompts: #961's capture (`cryptoSlotPromptGoldens.json`) still equals HEAD; its flag-off rows pass in the baseline. Live contexts: 12 synthetic cases rendered through the real `buildLiveContextBlock`, deterministic across two runs, saved outside the repo (§0). |
| **Q-a — STOP** | **A user guardrail can swap the held crypto for the bench crypto on the same check, after the prompt is built.** It skips the hurdle floor and the swap cap. On such a check, a line saying "no swap is possible" (because of the cap, a down day, or the margin) and the annotation "no legal replacement this check; hold" would both be contradicted by what the platform then does. The path is reachable through a normal strategy deploy. In the stored window it fired on 0 of 144 tiered checks; 1 of 13 tiered battles carried exit-stop rules of that kind. The SWAP_OUT paths the prompt named do **not** trip the STOP: they all run before the prompt is built, and the tick rebuilds its picture after them. |
| Q-b | The held crypto carried SWAP_OUT on **26 of 144** tiered checks, all `stagnation`. Held stocks: **0 of 864**. The hurdle divides by the crypto's frozen ATR (5–7%); crypto has no rankings row. Report only. |
| Q-c | Every D-5 check has an exported function to call. No fenced export edit is needed. The verdict can ride on `momentumData` (the existing bag), so the pinned builder call line does not move. Two design points for Fable: the gate order (§1, Q-c item 3) and the swap cap's one-line inline comparison (item 4). |
| Q-d | **All 26 previously refused requests are reconstructible.** All 26 read "no swap — the bench crypto is down on the day". 16 other requests are indeterminate (one battle holding ETH: ETH's daily move is not in the prompt). No STOP. |
| Build, tests, review, probe | **Not started**, per the STOP. |
| What Fable needs to decide | Q-a: three options in §1.5, none implemented. Plus the two Q-c points. |

---

## §0 Gate

| Fact | Value |
|---|---|
| Session opening | Branch `claude/crypto-slot-check-line-42b5d3`, HEAD `e880592e`, tree clean. |
| `git fetch origin` | Done first. `origin/main` = `e880592e` (Merge #958). |
| PR #961 | Merged at `6d75a324` ("Merge pull request #961 from fashraf94/claude/crypto-slot-prompt"). |
| Files present | `api/_utils/evalCryptoSlotBlock.js`, `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md`, `docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md`. |
| Baseline suite, run 1 | WSL Ubuntu, private clone `/home/flashash/pd-csl2` detached at `e880592e`, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2`. **964 test files** (963 passed or skipped, **1 failed**), 20,523 tests (20,434 passed, **1 failed**, 88 skipped). The failing row: `api/_utils/callRecords/publish.test.js` › "the transaction (row 7) the queue read returns after the deadline: still no commit — nothing lands behind the failed wire" (expected `timeout_absent`, got `unconfirmed`). The file alone, same clone: 37/37 passed, three runs out of three. A deadline row under load. |
| Baseline suite, run 2 | Same clone, same commit, same flags, with the default reporter added. `Test Files  957 passed │ 7 skipped (964)`. 20,523 tests: 20,435 passed, **0 failed**, 88 skipped. Exit 0. **The baseline failing set is ∅.** Run 1's row is recorded as a load-timing flake: it passed alone three times and in the full run 2. |
| `lint:gate` | Exit 0, `--max-warnings 0`, at `e880592e`. |
| Pre-change capture (0.3) | **System prompts:** #961's capture (`api/_utils/__fixtures__/cryptoSlotPromptGoldens.json`, six archetypes × tiered + flat6) is reusable. `evalCryptoSlotBlock.test.js` asserts that each flag-off prompt equals it, and that file passes in the baseline at `e880592e`. **Live contexts:** 12 synthetic cases rendered through the real `buildLiveContextBlock` at `e880592e`, flags as at HEAD (`CRYPTO_SLOT_PROMPT_ENABLED` false, `PROFIT_TARGET_EXECUTOR_ENABLED` true), with the clock fixed. The run used a throwaway vitest file, copied into the clean Linux clone and removed after; the clone was clean again afterwards. Cases (11 tiered + 1 flat6): <ul><li>held BTC with SWAP_OUT (stagnation): bench ETH down; bench ETH up; bench ETH on cooldown;</li><li>held BTC with SWAP_OUT (vwap_failure);</li><li>all HOLD (no RISK STATUS block), and `riskStatus` null;</li><li>BTC LOCKED; BTC EMERGENCY_SWAP;</li><li>a stock SWAP_OUT while BTC holds;</li><li>held ETH after a crypto swap ("Unknown" sectors, BTC on cooldown, one closed trade);</li><li>no crypto held (bench BTC);</li><li>flat6 with a stock SWAP_OUT.</li></ul> Two runs gave the same file, SHA-256 `63ea7244…5a82f`. It is kept outside the repo, with its generator (SHA-256 `7829a68f…1764`), at `%USERPROFILE%/ft-experiment-exhibits/crypto-slot-check-line-capture/`. If `main` has not moved these builders when the build resumes, the resumed build re-runs the generator with the flag off and must reproduce every byte. |

---

## §1 Discovery

### Q-a — What SWAP_OUT is for a crypto position, and every path that can move the held crypto

**What SWAP_OUT is.** The risk manager's verdict for one held position, computed every tick before the trigger gate (`api/cron/agent-evaluate.js:1821-1878`, calling `evaluateRisk`, `api/_utils/agentRiskManager.js:89-92`). Two reasons carry the `SWAP_OUT` action:

- `vwap_failure` (`agentRiskManager.js:140-147`): needs this tick's intraday VWAP snapshot.
- `stagnation` (`:184-196`, the archetype's forced rotation): fires when the per-symbol stagnation counter has reached `ticksThreshold`, the tick is within age, and the position's daily move is below `winnerThreshold`. The counter counts ticks whose price move is below `pctThreshold` (`updateStagnationCounter`, `:235-261`).

**It is both rendered and acted on.**
- Rendered: RISK STATUS, `agentEvalPromptAssembly.js:1214-1217`, line format `${symbol}: ${action} (${reason})` at `:1816`. The block renders only when at least one held position is not HOLD (`:1820-1822`).
- Acted on: every `SWAP_OUT`, `EMERGENCY_SWAP` and `TRAIL_STOP` is queued for the forced-swap loop (`agent-evaluate.js:1872-1874`).

**Every path that can move the held crypto, in tick order:**

| # | Path | Reads SWAP_OUT / stagnation? | When | Can it move the held crypto? | Same-tick contradiction? |
|---|---|---|---|---|---|
| 1 | Forced-swap loop (`agent-evaluate.js:1897-2392`) | Yes | **Before** the prompt | **Yes.** Stagnation: only if the bench crypto clears the hurdle with reason `stagnation` (`:1946-1962`) and the swap cap is not full (`:1904-1925`). Bust (`EMERGENCY_SWAP`): no quality gate (`:1963-1974`). | **No.** After a committed forced swap the tick rebuilds its picture from the refreshed book and prunes `riskStatus` and `lockedPositions` to what is still held (`:2427-2466`). A verdict computed after that point sees the swap: the new crypto is held and the old one is on the bench, on cooldown. |
| 2 | `archetype:stagnation` exits | The same loop (#1): the stagnation swap's receipt source is `archetype` (`:2050-2053`). | Before | As #1 | No, as #1 |
| 3 | The emergency replacement picker `pickEmergencyReplacement` (`agentRiskManager.js:397-419`) | — | — | **No production caller.** A search of `api/` finds only its definition. Its live successor, `pickSwapReplacementCandidate` (`:437-465`), is what #1 and #5 call. | — |
| 4 | Approved proposal (`agent-evaluate.js:2469-2471`) and approved gameplan meeting (`:2509-2511`; legs executed in `handleGameplanMeeting`, `:6119-6462`) | No | Before | Yes (the meeting path is F7) | No for the line itself: both run before the prompt and re-read the battle (`:5335`, `:6461`). See G1 in §9 for a stale-picture side effect. |
| 5 | **The guardrail executor `applyGuardrails`** (`agent-evaluate.js:3388-3500`) | No | **After** the prompt is built (`:2899-2906`), on the same tick | **Yes** (below) | **Yes — the STOP.** |
| 6 | The R11 suppression pass (`:2520-2521`, `:2582-2583`) | No | Only on ticks with no model call | Yes | No: no prompt is built on those ticks. |

**For the crypto specifically**, `vwap_failure` and `TRAIL_STOP` cannot fire in practice. Both need the intraday snapshot, which is published only for a usable session (`agent-evaluate.js:1436-1455`). In the stored window, no request shows a VWAP line for the held crypto (0 of 144). So the crypto's SWAP_OUT is stagnation only (26 of 26, Q-b).

#### Path 5 in detail — why it is the STOP

1. The model is called after the prompt is built. Then `applyGuardrails` runs on the battle's deployed guardrails (`agent-evaluate.js:3405-3415`).
2. It scans every held position, the crypto included, for a breach:
   - stop-loss (`agentGuardrails.js:250-286`);
   - trailing stop (`:288-309`);
   - profit target (`:311-349`), live because `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`src/config/featureFlags.js:1984`).
3. Whatever the model said, a breach on the crypto makes it pick a replacement of the same type, with **no quality predicate** (`agentGuardrails.js:499-508`). It returns a forced `SWAP` (`:552-559`), which the cron turns into the decision with conviction at least 70 (`agent-evaluate.js:3426-3438`).
4. The swap's reason is then `guardrail_stopLoss`, `guardrail_trailingStop` or `guardrail_profitTarget` (`:3608-3611`). Those reasons:
   - skip the hurdle floor, including "must be up on the day" (`agentRiskManager.js:341-353`, before `:366`);
   - skip the swap cap (`agent-evaluate.js:3630-3634`).
5. The validator still runs (`:3560-3589`); a crypto ↔ crypto pair passes its type match. The swap executes on that tick.

**Which D-5 reasons it contradicts:**

| D-5 reason on the line | Can the guardrail still swap the crypto on that tick? | Why |
|---|---|---|
| LOCK | No | The guardrail defers on a locked position (`agentGuardrails.js:453-466`). |
| Cooldown | No | The picker skips a bench asset on cooldown (`agentRiskManager.js:446`); the guardrail then defers (`agentGuardrails.js:510-524`). |
| Swap cap | **Yes** | The guardrail's reasons bypass the cap (`agent-evaluate.js:3630-3634`). |
| Not up on the day | **Yes** | They bypass the hurdle, including the bench-positive step (`agentRiskManager.js:341-353`). |
| Margin | **Yes** | The same bypass. |
| D-6 annotation | The same split | It rides on the same "no swap" verdict. |

**Example.** The line reads "CRYPTO SLOT THIS CHECK: no swap is possible — ETH is -1.12% on the day, and an incoming crypto must be up on the day. Hold BTC." RISK STATUS reads "BTC: SWAP_OUT (stagnation) — no legal replacement this check; hold". The model holds. The user's 8% stop-loss is breached on BTC, so the guardrail swaps BTC for ETH on that tick.

**The "allowed" line has gaps in the other direction too** (reported, not part of the STOP clause):
- Whatever the model proposes, a guardrail breach on **another** position takes the check's one swap (`agentGuardrails.js:468-559`).
- A `maxSectorWeight` guardrail can refuse a crypto → crypto swap (`checkSectorCap`, `:775-807`). It counts the incoming crypto's sector, and that reads "Unknown" once the crypto has been swapped (F1), so it can count with the book's other "Unknown" names.
- The validator's hypothesis floor (`agentSwapExecution.js:90-93`) is, like conviction, the model's own field.

**Reachability.**
- **Code:** the guardrails come from the user's deployed strategy (`src/services/deployStrategyService.js:166` → `api/_utils/agentBattleService.js:193`), which is the normal Forge deploy flow. It is not an owner-only Firestore write; that is the difference from F7.
- **Stored window** (`archetype-ablation-run`):
  - 0 of 144 tiered checks show a guardrail override. No tiered record mentions a guardrail in its gate or decision, and `replacedByDeterministic` never appears.
  - 1 of 13 tiered battles (8 of 144 requests, a Contrarian) carries Exit_stops rules of exactly these three kinds: "Sell any position that drops 8% from entry", "Sell if position drops 10% from its highest closing price since entry", "Sell any position that gains 12% from entry". These look like a season strategy's deployed guardrails, but that link is INFERRED: the prompt renders the rule store, not `deployedGuardrails`.
- A 5%-ATR crypto can reach an 8% drop or a 12% gain within a multi-day battle.

#### §1.5 Options for Fable (none implemented; each is a ruling, not a build call)

- **(a) Accept the gap as the protective-stop class.** The line describes the agent's own swap. The user's standing stop or target order is a deterministic floor the prompt already ranks above the model ("DECISION PRECEDENCE … 1. Deterministic floors and guardrails — facts of the environment, enforced by the engine", `agentEvalPromptAssembly.js:135-136`, rendered while `PROFIT_TARGET_EXECUTOR_ENABLED` is true). If Fable takes this, the line's wording may want a scope, for example "no swap of yours is possible". The wording is Fable's.
- **(b) Let the verdict see the guardrail.** Before the prompt, call `applyGuardrails` with a HOLD decision on the same inputs: the battle, prices, `lockedPositions`, `stockRegimes` and the deployed list. It is pure, and its breach scans (`agentGuardrails.js:250-353`) do not read the model's reply. That tells the cron whether a forced exit of the held crypto will fire on this check. On such a check, render no line and no annotation, or a line Fable writes. This is a design change and a second call into a fenced function (§1 calls are permitted; it adds a pre-prompt call site).
- **(c) Render the line only when no stop-class guardrail is deployed.** No stop-loss, trailing-stop or profit-target on the battle. This is cruder than (b): it also drops the line on checks where no breach is near.

### Q-b — Why SWAP_OUT fires on the crypto (report only; no calibration change)

**Counts over the 144 stored tiered requests** (the RISK STATUS lines, read by symbol):

| | Rows | SWAP_OUT | Reason |
|---|---:|---:|---|
| Held crypto | 144 | **26** (18%) | `stagnation` 26 |
| Held stocks | 864 | **0** | — |
| Of the 26 previously refused requests | 26 | **21** | `stagnation` 21 (the other 5: HOLD) |

**A count note.** #961's report §6 says 27 of 144 and 22 of 26. Recounting the request bytes gives 26 and 21: `BTC: SWAP_OUT (stagnation)` appears in exactly 26 tiered requests, 21 of them refused, whether the whole request or only the live context is searched. #961's probe script holds no such count, so its 27/22 cannot be traced. #961's own shapes table (8 + 13 = 21 failing replies) agrees with 21.

**The ATR.**
- The stagnation detector uses no ATR. It looks at the per-tick price move and the daily move (`agentRiskManager.js:184-196`, `:235-261`). Its only ATR use is the `baseATR > 0` guard (`:116`).
- The ATR enters at the veto. The forced rotation's hurdle (`agent-evaluate.js:1953-1961`) and the model's hurdle (`:3612-3621`) both divide by `resolveHurdleAtr(symbol, freshHurdleAtrMap, frozen)` (`api/_utils/hurdleAtr.js:50-55`): the fresh rankings value if one exists, else the frozen `baseATR`.
- **No crypto has a rankings row.** The producer (`api/cron/compute-index-intelligence.js`) builds from the stock universe and references no crypto symbol. So the crypto hurdle always divides by the frozen `CRYPTO_ASSETS` value (`api/_utils/agentCryptoAssets.js:5-11`: BTC 5, ETH 5, SOL 6, XRP 5.5, DOGE 7, ADA 6, BNB 5). That is VERIFIED from the code. The data agrees: the ACTIVE POSITIONS `ATR%` cell for a held BTC reads 5.0%, and no crypto has a momentum-snapshot line.
- With the Trend Follower's multipliers and BTC's 5%:
  - the forced rotation needs the bench crypto to beat BTC's daily move by 0.5 × 5 = **2.5 points**;
  - the model's own swap needs **1.75 points** (0.35 × 5) (`agentArchetypeConfig.js:52-57`).

**Why the crypto and not the stocks (INFERRED mechanism).** Two effects stack:
1. **Selection: what survives to the prompt.**
   - The forced loop runs before the prompt. A stock whose stagnation fires usually has some bench stock that clears the hurdle (about 20 candidates per bench in these requests), so it is rotated out.
   - The rebuild then deletes its RISK STATUS row (`agent-evaluate.js:2461-2463`).
   - The crypto has exactly one candidate, which was down on the day on 111 of 144 checks. Its rotation is vetoed (`:1976-2008`), and the SWAP_OUT row stays in the prompt.
2. **Smaller per-interval moves.** Between consecutive stored checks of the same battle, the held crypto moved less than 0.15% in 91 of 131 pairs (69%), against 376 of 775 (49%) for held stocks. It never moved exactly 0, so the quote is not frozen. Stored checks are not consecutive cron ticks, so this is a proxy for the counter's per-tick input, not the input itself.

**Other per-crypto facts the build relies on:**
- `stockRegimes` comes from `stockTechnicalScores` docs (`agent-evaluate.js:1662-1666`), and every crypto regime reads `unknown` (144 of 144). So the distressed veto (`:3541-3547`) cannot fire for the crypto. Phase 0 Q2 marked this INFERRED; it is now observed for the window and backed by the code path.
- The model never sees the held crypto's daily move except for BTC. BTC's comes from the macro line, which is a **separate fetch key**: `prices['BTC-USD.CC']` (`agent-evaluate.js:1144-1148`), while the gate reads `prices['BTC']`. Both route to the same EODHD quote and are fetched in parallel, so they are equal unless the quote moved between the two fetches (INFERRED).

### Q-c — The seam

**Where the inputs exist.** The verdict can be computed after the post-swap rebuild (`agent-evaluate.js:2427-2466`) and before the prompt build (`:2899-2906`). At that point the tick holds every input the gates later use, and it holds the same objects:

| D-5 check | The gate at HEAD | The function to call | Inputs in scope before the build |
|---|---|---|---|
| LOCK | `lockedPositions.has(symbolOut)` (`:3523`) | The `Set` itself | `lockedPositions` (`:1739`, `:1875-1877`, pruned `:2458-2460`) |
| Cooldown | Inside the fenced validator `validateTradeDecision` (`agentSwapExecution.js:64-70`) | `validateTradeDecision({ decision: 'SWAP', symbolOut: held, symbolIn: bench, conviction: 70, hypothesis: <a fixed string of 10+ characters> }, battle)` (exported, `:34`). For the held crypto and the bench crypto, every other check in it passes by construction: in the portfolio, in the bench, not self, not held, same type, conviction 70, hypothesis present. So `valid === false` means the cooldown. A test would pin that argument rather than match the error text. | `battle` (refreshed) |
| Not up, margin | `clearsHurdleFloor({ active, benchCandidate, reason: 'haiku_decision', archetypeConfig, userATR })` (`:3613-3621`) | `clearsHurdleFloor` (exported, `agentRiskManager.js:340`); `resolveHurdleAtr` (exported, `hurdleAtr.js:50`). `blockReason` is `bench_not_positive` or `below_floor` (also `margin_invalid` on a bad ATR). | `prices`, the dial-clamped `archetypeConfig` (`:1778-1786`), `freshHurdleAtrMap` (`:1687`), `assetScores` (for `activeBaseATR`, `:3612`) |
| Swap cap | `swCfg?.enabled && !bypass && getRecentSwapCount(battle.trades, swCfg.windowMinutes, Date.now(), { countEmergencies }) >= swCfg.capPerWindow` (`:3629-3635`) | `getRecentSwapCount` (exported, `agentRiskManager.js:516`). The `>= capPerWindow` comparison is the gate's own one-line inline expression; there is no function for it (item 4). | `battle.trades` (re-read after each forced swap), `archetypeConfig.hftConfig.swapWindow` |

1. **No export-only edit to a fenced file is needed.** Every function above is already exported.
2. **How the verdict reaches the assembler.** Through `momentumData`, the bag the cron already uses for tick-computed facts (`riskStatus` `:1880`, `rankingsMap` `:1676`, `visionState` `:1722`). The pinned builder call `buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, battle.evaluations, momentumData, presetConfig)` (`:2902-2905`; pinned by `agent-evaluate.tickStamps.pins.test.js:52`, `:165-174`) does not move. One caution: `momentumData` also rides into the shadow tick capture (`:4646`), so with the flag off the cron must not attach the key at all (not `null`, not `undefined`).
3. **Gate order — the prompt's list and the code disagree.** §4 lists the reasons as LOCK, cooldown, swap cap, not up, margin. The code runs LOCK (`:3523`), the validator (cooldown, `:3561`), the hurdle (not up, then margin, `:3613`), and the cap last (`:3662-3673`: `if (!hurdle.clears) … else if (capBlocked)`). When both the hurdle and the cap fail, production records the hurdle. Following "the first failing check in gate order" and "the gate's own code", the build would name reasons in the **code's** order. The verdict ("no swap") is the same either way; only the reason text differs. In the stored window the two orders name different reasons on 2 of 144 requests. **Fable to confirm.**
4. **The swap cap's comparison.** The cap has a function (`getRecentSwapCount`), but the "at or over the cap" test is an inline expression in the gate. The build would call the function with the gate's arguments and apply the same comparison, plus a source-scan test that fails if the gate's expression changes. That is how this report reads "never a re-implementation". **Fable to confirm**, or rule that the expression be extracted into a shared helper (an edit to the gate itself).
5. **Why the verdict cannot say "allowed" where LOCK, cooldown, cap or hurdle then refuse** (excluding path 5). Between the verdict and the gate, nothing makes those gates stricter:
   - the cap count can only fall (no trade lands between the build and the model's gate; old trades age out);
   - a cooldown can only expire;
   - `lockedPositions` is not written after `:2460`;
   - `prices` is the same object (its only in-tick re-pointing, `:2436-2438`, precedes the build).

   The reverse can happen: "no swap" at build time, allowed at gate time, as a cooldown or a window slot frees up during the model call. That direction is safe.
6. **The tempo dial is on** (`TEMPO_DIAL_ENABLED = true`, `featureFlags.js:723`). It scales the cap and the hurdle multipliers per battle (`api/_utils/tempoDialClamp.js:32-36`). The verdict must use the dial-clamped `archetypeConfig` the gates use (`:1783-1786`), never the base table.
7. **Display rounding.** The verdict reads the raw `changePercent`, as the gate does. The line prints it the way the BENCH table does, `formatPct` to 2 decimals (`agentEvalPromptAssembly.js:1828-1831`). At a raw `+0.004%` the gate sees "up", so the line would read "ETH is up +0.00% on the day but does not clear BTC by the hurdle margin". That is true, but it reads oddly. This is §9's display-agreement tension: the verdict follows the gate, the number follows the table. Noted, not a STOP.

### Q-d — Probe fidelity (can each stored request's verdict be rebuilt from the request alone?)

**Inputs per request:**
- the held crypto (ACTIVE POSITIONS);
- the bench crypto's Daily% and Status (BENCH; `Status` reads `locked until …` on cooldown, `agentEvalPromptAssembly.js:1526-1532`);
- LOCK: a `LOCKED (…)` line in RISK STATUS (block absent = no LOCK, `:1820-1822`);
- the held crypto's daily move: BTC from the macro line; **not present for a held ETH or SOL**;
- the ATR: the held row's `ATR%` cell = `score.baseATR` (`:1500`), which is exactly the frozen value the hurdle uses for crypto (Q-b);
- the cap: CLOSED TRADES has no timestamps or exit reasons (`:1760-1772`), only `DayN`. A trade on an earlier trading day is more than 60 minutes old, so the count of today's rows is an upper bound on the window count.
- Tempo: not in the request. A margin verdict counts as determinate only if it holds at all three tempos (×0.7, ×1.0, ×1.3); the cap uses the smallest tempo cap.

**Result** (verdicts in the code's gate order):

| | All 144 | The 26 refused |
|---|---:|---:|
| No swap — the bench crypto is not up on the day | 111 | **26** |
| No swap — up, but below the margin (held BTC) | 17 | 0 |
| **Indeterminate** | **16** | **0** |
| Allowed | 0 | 0 |

- **No STOP.** All 26 previously refused requests are determinate.
- **The 16 indeterminate:** one battle, held ETH, bench BTC up on the day. The margin needs ETH's daily move, which the prompt does not carry. They would be excluded from the bars and counted.
- **Tempo:** every margin verdict was the same at all three tempos.
- **Cap:** no request had enough same-day closed trades to reach any tempo's cap before an earlier step failed. In the §4 list order the cap comes first, and 2 requests would then be indeterminate in their *reason* (not their verdict).

**Two limits for §7, if the probe runs later:**
- **0 of 128 determinate verdicts are "allowed".** Probe v2 would never show the model the "swapping … is allowed" line, so it cannot measure whether the model acts on it.
- The macro-line caveat (Q-b): only the 17 margin verdicts depend on it. The 26 refused do not.

---

## §2 In plain terms

1. The plan was to tell the Trading Brain, on every check, whether its crypto can be swapped right now. The answer would come from the game's own rule code, so the brain does not have to work it out.
2. Before building, the prompt asked one safety question: can the game itself move the crypto on the same check, so the new line would be wrong?
3. **Yes, in one case.** When a player's strategy has a stop-loss, trailing stop or profit target, the game can sell the crypto for the bench crypto after the brain has answered. That ignores the "must be up on the day" rule and the swap limit. The line could say "no swap is possible — hold BTC" and the game would then swap BTC on that same check.
4. It did not happen in the 144 checks we have stored. One battle in 13 had those exit rules, so it can happen.
5. The prompt says to stop here, so nothing was built, nothing was spent, and nothing changed for players.
6. Fable chooses one of three ways forward (§1.5). The rest of the discovery is ready, and the probe's 26 test checks are all usable.

---

## §3–§8 Not reached

Step 0's STOP came before any edit, so these sections have no content yet:
- §3 fenced hunks: none written;
- §4 files: this report only;
- §5 tests, mutation, build and lint: the baseline only, §0;
- §6 review: none, since there is no diff;
- §7 probe v2: not run, $0;
- §8 flip checklist.

The build's design notes from discovery are in §1 Q-c, ready for the resumed build: the seam, the functions, the transport, the flag-off key rule, gate order and the cap comparison.

---

## §9 Not in this build

Carried from #961 (one line each):
- **F1**: a swapped asset loses its `sector`, so the tables print "Unknown".
- **F2**: for a short, the scorer's intraday extremes are negated but not swapped.
- **F3**: "held by a guardrail" names the wrong layer for pair-validation downgrades.
- **F4**: the status feed's hold beat can announce a swap that did not happen.
- **F5**: two copies of the crypto list.
- **F6**: the model never learns why a swap was refused.
- **F7**: the gameplan-meeting approval runs swaps without the validator (the swap-path integrity build, with F1).
- **F8**: `validatePortfolio` has no crypto exclusion on the stock arrays.
- **F9**: `PROFIT_TARGET_EXECUTOR_ENABLED`'s docstring is stale.
- **The short task (R-2 / R-4).**
- **Crypto ATR calibration**: Q-b's numbers. The hurdle divides by the frozen 5–7%. The held crypto carried SWAP_OUT on 26 of 144 checks against 0 of 864 for stocks.

New, from this discovery (BUILD_RULES §3: reported, not fixed):
- **G1 — stale picture after a pre-prompt meeting or proposal swap (INFERRED, from reading).**
  - Only the forced-swap path rebuilds `assetScores`, `riskStatus` and `lockedPositions` after a swap (`agent-evaluate.js:2427-2466`).
  - An approved gameplan meeting re-reads the battle and returns `'continue'` (`:6461-6462`). So does an approved proposal (`:5335-5336`).
  - The prompt is then built from a refreshed `battle.portfolio` with pre-swap `assetScores` and RISK STATUS: the "two disagreeing pictures" defect the rebuild comment describes (`:2394-2409`), on the other two pre-prompt swap paths.
  - It touches this build only through F7. Not tested here.
- **G2 — the stop-class guardrail path (Q-a).** If Fable takes option (a), it stays a documented exception rather than a defect.

---

## Appendix — method

**Source:** `%USERPROFILE%/ft-experiment-exhibits/archetype-ablation-run/sources.jsonl`, SHA-256 `6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437` (matches the Phase 0), joined to `records.json` on `k`. The 144 tiered requests are those whose system prompt says "BaggerBomb game". The scripts live in the session scratchpad (outside the repo) and print counts only; no player text is in this report.

**Parsing:**
- ACTIVE POSITIONS and BENCH: columns located by header name. The crypto is the one of the seven symbols in `agentCryptoAssets.js:5-11`.
- RISK STATUS: `SYMBOL: TEXT` lines; an absent block means every position is HOLD.
- "Not up": the Daily% cell. `-0.00%` is down (`formatPct` prints `+` for ≥ 0), and `+0.00%` would be indeterminate (none occurred).
- Margin: `(bench − held) ≥ round2(m ÷ tempo) × ATR`, with ±0.01 rounding slack. `m` is the archetype's `haiku_decision` multiplier (`agentArchetypeConfig.js`).
- Cap: today's CLOSED TRADES rows, compared with the smallest tempo cap.

**Reachability** comes from `records.json` `gate` / `decision` and from `sources.jsonl` `validationErrors` / `finalToolResult`. The rule kinds come from the identity block's rule lines.
