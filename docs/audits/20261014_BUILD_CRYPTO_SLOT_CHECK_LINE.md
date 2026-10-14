# Build — Crypto Slot v2: the per-check line, the SWAP_OUT annotation, paragraph v2 + probe v2

**Date:** 14 Oct 2026 · **Prompt:** Fable, "BUILD PROMPT — Crypto Slot v2: the per-check line, the SWAP_OUT annotation, paragraph v2 + probe v2", 14 Oct 2026, plus **Fable's rulings R-a…R-g** after the Step 0 STOP (folded in verbatim at §1.6) · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base:** `main` @ `e880592e` (= `origin/main` after `git fetch origin`, re-fetched at the resume and before the final checks, unchanged throughout) · **Branch:** local `claude/crypto-slot-check-line-42b5d3` (the app's worktree suffix), pushed by refspec as `claude/crypto-slot-check-line` · **PR:** draft [fashraf94/TradeSeven#964](https://github.com/fashraf94/TradeSeven/pull/964) · **Governing documents:** `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md`, `docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md` · **Report back to:** the Fable chat that issued the prompt.

**Fence contact (§7-gated):**
- `api/cron/agent-evaluate.js`: one import and two statements.
- `api/_utils/agentEvalPromptAssembly.js`: one import line, two statements and one wrapped call.

§3 quotes both diffs in full for Flash's sign-off. **Do not merge before that sign-off.** No validator, executor, risk-manager, scorer, guardrail or tool-schema code was edited.

---

## Verdict

| Item | Result |
|---|---|
| Step 0 | It **stopped** on Q-a: a player's stop-loss, trailing stop or profit target can swap the held crypto after the prompt is built. Fable ruled it (R-a): the line speaks only of what the agent can do, and the guardrail path is a documented exception (§1.6, §6.3). The discovery is unchanged in §1. |
| What was built | **The CRYPTO SLOT THIS CHECK line.**<ul><li>Before the prompt is built, the cron asks whether the agent could swap its crypto for the bench crypto right now. It uses the swap checks' own code: LOCK, the validator's cooldown, the hurdle floor and the swap cap, in the order the code runs them (R-b).</li><li>The live context shows the answer in Fable's final words, right before RISK STATUS.</li><li>When the answer is "you cannot swap", the held crypto's SWAP_OUT line says so too.</li></ul>**Paragraph v2** replaces #961's text. |
| Flag | `CRYPTO_SLOT_PROMPT_ENABLED` stays `false`. With it off, every system prompt and live context is byte-identical to the pre-change capture, and the tick's data never gains the new key (R-e).<ul><li>Tested against the step 0.3 capture.</li><li>Confirmed by a reviewer: 97 system prompts and 1,152 live contexts, plus the real cron base vs head in 11 scenarios, shadow capture included.</li></ul> |
| Verdict = gate | End to end on the real cron, for every reason and for "can swap": the line the model was sent and what the gates then did with the same swap agree. A reviewer tried to make them disagree and found only the documented guardrail class plus two timing edges (§6). **No input was found where the line says "you can swap" and LOCK, cooldown, the cap or the hurdle then refuses**, except one theoretical clock-skew route between two servers. |
| Tests | Full Linux suite, CI-shaped, on the code head `afaccb36`: `959 passed │ 7 skipped (966)`, 20,620 tests, **0 failing**. The baseline was 964 files, 0 failing; the 2 added files are the new suites. `lint:gate` and `vite build` are green (§5). |
| Mutation | **44 of my mutants, all killed**, including every one the prompt names (§5). The tests/probe reviewer ran its own 74 mutants; its survivors were genuine probe-selftest gaps (now closed and re-killed) or equivalent mutants. |
| Review | Four lenses, then five refuters. 29 raw findings collapse to 26 distinct:<ul><li>CONFIRMED 17, PARTLY 7, REFUTED 1, and 1 accepted as is;</li><li>**0 blocker, 0 major**, 5 minor, the rest nit or none.</li></ul>Every in-scope finding is fixed (`d6c25973`, `afaccb36`) or documented for Fable. One new pre-existing defect is reported for separate tasking (**G3**, §6.4). |
| Probe v2 | **The main arm FAILED one clause:**<ul><li>crypto → stock was **2 of 128** (bar ≤ 2: met), but both were among the 26 previously refused (bar 0: **missed**). Both are one Diversifier battle's consecutive BTC → LLY checks.</li><li>crypto → crypto where the line says "cannot" was **1** (bar ≤ 2: met).</li></ul>**Arm S (COUNTERFACTUAL) PASSED:** 0 crypto → stock of 26, and 21 of 26 took the "can swap".<br>For comparison, #961's probe had 10 crypto → stock, 9 of the 26, and 14 crypto → crypto.<br>The cost was **$1.78**. Paragraph v2 + the line measure **279–289 tokens**.<br>Per R-f: **no re-wording, the PR stays draft, STOP for Fable** (§7). |
| Flip | Not in this PR. The dry run (§8) shows the flip moves exactly what #961's did: 3 files plus 7 tiered system-prompt snapshots. **No live-context suite moves.** Control: the flag alone reddens exactly 10 rows. Flip: the checklist leaves 0 failing. |
| For Fable | Report §6.3, the R-a class as found in review:<ul><li>a guardrail can also back the agent's own BTC → ETH;</li><li>bullet 1's "ends as a HOLD";</li><li>"you have reached the swap limit" counts the platform's own rotations.</li></ul>Plus §7's reading. |

---

## §0 Gate

| Fact | Value |
|---|---|
| Session opening | Branch `claude/crypto-slot-check-line-42b5d3`, HEAD `e880592e`, tree clean. |
| `git fetch origin` | Done first. `origin/main` = `e880592e` (Merge #958). Re-fetched at the resume after the rulings and again before the final checks: unchanged, so every run below is on the merged tree. |
| PR #961 | Merged at `6d75a324` ("Merge pull request #961 from fashraf94/claude/crypto-slot-prompt"). |
| Files present | `api/_utils/evalCryptoSlotBlock.js`, `docs/audits/20261014_PHASE0_CRYPTO_SLOT.md`, `docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md`. |
| Baseline suite, run 1 | WSL Ubuntu, private clone `/home/flashash/pd-csl2` detached at `e880592e`, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2`. **964 test files** (963 passed or skipped, **1 failed**), 20,523 tests (20,434 passed, **1 failed**, 88 skipped). The failing row: `api/_utils/callRecords/publish.test.js` › "the transaction (row 7) the queue read returns after the deadline: still no commit — nothing lands behind the failed wire" (expected `timeout_absent`, got `unconfirmed`). The file alone, same clone: 37/37 passed, three runs out of three. A deadline row under load. |
| Baseline suite, run 2 | Same clone, same commit, same flags, with the default reporter added. `Test Files  957 passed │ 7 skipped (964)`. 20,523 tests: 20,435 passed, **0 failed**, 88 skipped. Exit 0. **The baseline failing set is ∅.** Run 1's row is recorded as a load-timing flake: it passed alone three times and in the full run 2. |
| `lint:gate` | Exit 0, `--max-warnings 0`, at `e880592e`. |
| Pre-change capture (0.3) | **System prompts:** #961's capture (`api/_utils/__fixtures__/cryptoSlotPromptGoldens.json`, six archetypes × tiered + flat6) is reusable. `evalCryptoSlotBlock.test.js` asserts that each flag-off prompt equals it, and that file passes in the baseline at `e880592e`.<br>**Live contexts:**<ul><li>**What:** 12 synthetic cases rendered through the real `buildLiveContextBlock` at `e880592e`, with flags as at HEAD (`CRYPTO_SLOT_PROMPT_ENABLED` false, `PROFIT_TARGET_EXECUTOR_ENABLED` true) and the clock fixed.</li><li>**How:** a throwaway vitest file, run in the clean Linux clone and removed afterwards. The clone was clean again after the run.</li><li>**Cases** (11 tiered + 1 flat6): held BTC with SWAP_OUT (stagnation) and the bench ETH down, up, or on cooldown; held BTC with SWAP_OUT (vwap_failure); all HOLD (no RISK STATUS block), and `riskStatus` null; BTC LOCKED; BTC EMERGENCY_SWAP; a stock SWAP_OUT while BTC holds; held ETH after a crypto swap ("Unknown" sectors, BTC on cooldown, one closed trade); no crypto held (bench BTC); flat6 with a stock SWAP_OUT.</li><li>**Result:** two runs gave the same file, SHA-256 `63ea7244…5a82f`. It is committed unchanged as `api/_utils/__fixtures__/cryptoSlotLiveContextGoldens.json`, with its case definitions as `cryptoSlotLiveContextCases.js`.</li><li>**Independent check:** a reviewer rendered all 12 cases with the **base** tree's builder and got all 12 hashes (§6).</li></ul> |
| Resume | After the rulings: `main` was still `e880592e`, so neither the prompt builders nor the capture moved. The baseline and the capture stand. |

---

## §1 Discovery

The Step 0 discovery as reported at the STOP (`216bc5b7`), kept unchanged as the record. Its `file:line` citations were read at `e880592e`; the build added 6 lines at the cron's imports and 12 before its prompt build, so the cron's citations past the base's `:96` read +6 at HEAD, and past its `:2763`, +18. Fable's rulings follow in §1.6; how each one landed is the table after them.

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

#### §1.5 Options for Fable (as put at the STOP — **ruled: option (a), with the wording scoped to the agent's own swap, R-a**)

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
3. **Gate order — the prompt's list and the code disagree.** §4 lists the reasons as LOCK, cooldown, swap cap, not up, margin. The code runs LOCK (`:3523`), the validator (cooldown, `:3561`), the hurdle (not up, then margin, `:3613`), and the cap last (`:3662-3673`: `if (!hurdle.clears) … else if (capBlocked)`). When both the hurdle and the cap fail, production records the hurdle. Following "the first failing check in gate order" and "the gate's own code", the build would name reasons in the **code's** order. The verdict ("no swap") is the same either way; only the reason text differs. In the stored window the two orders name different reasons on 2 of 144 requests. **Ruled (R-b): the code's order.**
4. **The swap cap's comparison.** The cap has a function (`getRecentSwapCount`), but the "at or over the cap" test is an inline expression in the gate. The build would call the function with the gate's arguments and apply the same comparison, plus a source-scan test that fails if the gate's expression changes. That is how this report reads "never a re-implementation". **Ruled (R-c): confirmed; not extracted.**
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

### §1.6 Rulings received (Fable, 14 Oct 2026) — verbatim

The build stopped at Step 0 on Q-a (above, unchanged as the record of the STOP), went to Fable, and resumed with these rulings. Folded in verbatim as instructed:

~~~~text
RULINGS — Crypto Slot v2, Step 0 STOP (Fable, Oct 14, 2026)
For: the Claude Code session that stopped at Step 0 on `claude/crypto-slot-check-line` (draft PR #964). Resume: from Step 0.4 with these rulings. Everything in `BUILD_PROMPT_CRYPTO_SLOT_V2_CHECK_LINE_20261014.md` stands unless changed here. Fetch `main` first. If it has moved the prompt builders, redo the live-context capture before any edit (your own plan). Record: fold this file into the build report's §1 as "Rulings received", verbatim.
R-a The guardrail STOP (Q-a) — option (a), with the wording scoped to the agent's own swap
A player's stop-loss, trailing-stop or profit-target is the player's standing order. The prompt already ranks it above the agent (DECISION PRECEDENCE item 1), and R3 (Sep 23) ruled that a player's stop beats the agent's protections. The line describes what the agent can do. It does not predict what the engine will do. Every sentence is reworded so that a guardrail swap firing afterwards on the same check contradicts nothing the agent was told. G2 is recorded as a documented exception of the protective-stop class, not a defect. Options (b) and (c) are not built.
The same class covers the reverse gaps you listed for the "can swap" line: a guardrail breach on another position taking the check's one swap, and a `maxSectorWeight` refusal. The `maxSectorWeight` case needs the "Unknown" sector to occur, and F1 fixes that next. Document all of these in the report and build none of them.
Final text — replaces §4 of the build prompt for the line and the annotation:

* Cannot swap: `CRYPTO SLOT THIS CHECK: you cannot swap {HELD} this check — {REASON}. Hold it.` `{REASON}` is the first failing check in the code's gate order (R-b):
   * LOCK: `{HELD} is LOCKED`
   * cooldown: `{BENCH} was swapped out less than 24 hours ago and is on cooldown`
   * not up: `{BENCH} is {±x.xx}% on the day, and an incoming crypto must be up on the day`
   * margin: `{BENCH} is up {+x.xx}% on the day but does not clear {HELD} by the hurdle margin`
   * swap cap: `you have reached the swap limit for this window`
* Can swap: `CRYPTO SLOT THIS CHECK: you can swap {HELD} for {BENCH} ({BENCH} {+x.xx}% on the day, clears the hurdle). It needs conviction 70 or higher. Whether to do it is your call.`
* Annotation (RISK STATUS, the held crypto's SWAP_OUT line, only when the verdict is "cannot"): append `— you cannot swap it this check; hold`

Paragraph v2 — bullet 2 changes to match. The other bullets stand as written in §4:

```
- Your crypto slot can hold, or swap for the one crypto on your bench. Each check tells you which you can do: read the CRYPTO SLOT THIS CHECK line. When it says you cannot swap, hold your crypto — even if RISK STATUS flags it SWAP_OUT. If you want to make a move that check, it has to be in a stock slot.

```

Lens L4 checks that no sentence in the line, the annotation or the paragraph claims more than the agent's own options.
R-b Gate order — the code's order
LOCK → cooldown → not up → margin → swap cap, as the gates run at HEAD (`agent-evaluate.js` :3523 → :3561 → :3613 → :3662-3673). The reason the line names is then the one production would record. The build prompt's list order was an error.
R-c The swap cap and the cooldown — your approach is confirmed

* Swap cap: call `getRecentSwapCount` with the gate's own arguments (the dial-clamped `hftConfig.swapWindow`, `countEmergencies`). Apply the same `>= capPerWindow` comparison. Add a source-scan test that fails if the gate's expression changes. Do not extract a shared helper, since that would mean editing the gate.
* Cooldown: call `validateTradeDecision` with the fixed argument you described. A test pins that argument. Never match on the error text.

Both count as "never a re-implementation".
R-d Display — follow the table
The verdict reads the raw change, as the gate does. The number prints as the BENCH table prints it (`formatPct`, 2 decimals). The `+0.00%` oddity you noted is accepted as is.
R-e Flag-off rule — confirmed
With `CRYPTO_SLOT_PROMPT_ENABLED` off, `momentumData` must not carry the key at all: not `null`, not `undefined`. The shadow tick capture and every golden stay byte-identical. Test it.
R-f Probe v2 — add a synthetic "can swap" arm
The main arm runs as written. For the bars, the 16 indeterminate requests are excluded and counted.
Add arm S (counterfactual, labelled as such everywhere):

* Take the 26 previously refused requests (all hold BTC).
* In each, set the bench crypto's Daily% in the BENCH table to the smallest value, on the table's 2-decimal grid, that clears the margin at the archetype's multiplier at all three tempos, plus 0.50 points. BTC's daily move comes from the macro line, as in Q-d.
* Render the "can swap" line. There is no annotation, because the verdict is "can".
* Paragraph v2 as in the main arm.
* Verify the edit by marker and diff: exactly one cell and the inserted line changed.
* 26 calls, inside the existing $5 cap.

Arm S guard bar: crypto → stock ≤ 1 of 26.
Arm S descriptive counts: crypto → crypto, HOLD, stock → stock, malformed, how many rationales cite the line, and short-as-a-position narration.
The point is to confirm the agent reads the "can swap" line and that it does not open a new crypto → stock path. There is no bar on how often it swaps: whether to swap stays the agent's call.
If either arm fails a bar: do not re-word. Record, leave the PR draft, STOP.
R-g Out of this build — confirmed, with one addition

* G1 (out-of-date risk picture after a pre-prompt meeting or proposal swap) joins F1 and F7 in the swap-path integrity build. Not here.
* Q-b: report only. The crypto ATR figure (frozen 5–7%) and the crypto hurdle margin go with the short task, as crypto-slot tuning.
* Count correction noted: #961's 27/22 is 26/21. Use 26/21 in this report.

End of rulings.
~~~~

**How each ruling landed.**

| Ruling | Where |
|---|---|
| R-a | The line and the annotation render Fable's final text word for word, and paragraph v2's bullet 2 is the ruled text (`evalCryptoSlotBlock.js`; wording locks in `evalCryptoSlotBlock.test.js`). Options (b) and (c) are not built. The exception class is documented in §6.3 and in the verdict module's NOT COVERED block. |
| R-b | The verdict checks in the code's order: LOCK → validator (cooldown) → hurdle (not up, then margin) → cap. Two source pins enforce it: the cron's gates are in that order, and the verdict returns in that order. Mutant M05 kills a reordering. |
| R-c | The cap calls `getRecentSwapCount` with the gate's arguments and the gate's own comparison. A source-scan row asserts the gate's expression and the verdict's are the same text, after a name substitution. The cooldown calls `validateTradeDecision(verdictDecision(held, bench), battle)`, and a row pins that argument. The cooldown is named only after a second call, with the bench crypto's cooldown cleared, passes; the error text is never read. |
| R-d | The verdict reads `prices[bench].changePercent || 0` raw, as the gate does. The line prints it through the assembler's own `formatPct`. A test row checks the line's number against the BENCH table's own cell for seven values, `±0.004` among them. |
| R-e | The cron attaches the key only when there is a verdict. The end-to-end flag-off rows assert `hasOwnProperty('cryptoSlotVerdict') === false` on the momentumData the builder receives. L1 confirmed the same at the shadow capture over 11 scenarios (§6). |
| R-f | `scripts/experiments/cryptoSlotProbeV2.mjs`: the main arm, plus arm S labelled COUNTERFACTUAL in the code, the plan output and §7 (§7). |
| R-g | G1 is out of this build (§9). Q-b is report only. The count is 26/21 throughout. |

---

## §2 In plain terms

1. Before each check, the game now works out whether the Trading Brain could swap its crypto for the bench crypto right now. It uses the same rule code that would judge that swap a moment later.
2. The brain sees the answer as one line, for example "you cannot swap BTC this check — ETH is −1.12% on the day … Hold it." When the platform's risk line says to sell BTC but no swap is possible, that line now says so too.
3. The line speaks only of what the brain can do. A player's own stop or target order can still move the crypto afterwards, which is Fable's ruled exception.
4. With the flag off (as it ships), nothing changes for anyone, byte for byte.
5. Probe v2 replayed the stored checks with the new text. The brain sold its crypto for a stock only twice in 128 checks (it was 26 before any of this, and 10 with #961's paragraph alone). It tried a forbidden crypto swap once. Fable's bar is zero on the 26 hardest checks, and both stock sells came from those, on one battle, so the PR stays draft for Fable. In a made-up arm where the swap is allowed, the brain took it 21 times in 26 and never reached for a stock.

---

## §3 The fenced hunks — for Flash's sign-off

Two fenced files, four hunks, `git diff 216bc5b7 HEAD`, quoted whole. No fenced function's existing logic changed; the added statements do nothing while the flag is off. No export-only edit was needed: every gate function the verdict calls was already exported (§1 Q-c).

### `api/cron/agent-evaluate.js` (+18 −0)

```diff
@@ -94,6 +94,12 @@ import { applyGuardrails, injectDiversifierSectorCap, resolveSectorSlotObserveCa
 import { classifyStockRegime, classifyMarketPosture, getPresetAdjustedStrategies } from '../_utils/agentRegimeClassifier.js';
 import { evaluateRisk, calculate5minSMA20, pickSwapReplacementCandidate, updateStagnationCounter, findPortfolioSlot, clearsHurdleFloor, getRecentSwapCount, EMERGENCY_BYPASS_REASONS, USER_DIRECTIVE_BYPASS_REASONS, buildSwapReceiptSource } from '../_utils/agentRiskManager.js';
 import { buildFreshAtrPercentileMap, resolveHurdleAtr } from '../_utils/hurdleAtr.js';
+// Crypto Slot v2 (§7-gated fence contact, Fable build prompt + rulings
+// 2026-10-14; merges only with the founder's sign-off on this hunk —
+// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §3): the CRYPTO SLOT
+// THIS CHECK verdict, computed with the model-swap gates' own functions in a
+// non-fenced module; null while CRYPTO_SLOT_PROMPT_ENABLED is off.
+import { computeCryptoSlotVerdict } from '../_utils/cryptoSlotVerdict.js';
 import { getPresetConfig } from '../_utils/agentPresetConfig.js';
 import { isVwapSessionUsable, isVwapStrike, pruneCounterMaps, seedVwapFireGuard, isReplacementQualified, newestCandleAsOfMs, VWAP_CASCADE_GUARD_N, CASCADE_QUALIFY_TIMEOUT_MS } from '../_utils/agentVwapFloor.js';
 import { getArchetypeConfig, resolveHftConfig, KNOB_CONFIG_VERSION } from '../_utils/agentArchetypeConfig.js';
```

```diff
@@ -2761,6 +2767,18 @@ export async function processAgentBattle(db, battle, summary, cronStartTime = Da
       return;
     }
 
+    // ---- Crypto Slot v2: the CRYPTO SLOT THIS CHECK verdict ----
+    // The held crypto ↔ bench crypto swap, run through the model-swap gates'
+    // own functions (LOCK, the validator's cooldown, the hurdle floor, the swap
+    // cap) on the book the prompt is about to describe: after the forced-exit
+    // rebuild and the proposal / meeting re-reads above, before the prompt
+    // build below, on the same objects the gates read once the model answers.
+    // Attached ONLY when there is a verdict: while CRYPTO_SLOT_PROMPT_ENABLED
+    // is off the key is never set, so momentumData — and the shadow capture
+    // that carries it — is byte-identical. Not on an unreadable book (F1b).
+    const cryptoSlotVerdict = refreshFailure ? null : computeCryptoSlotVerdict({ battle, prices, lockedPositions, archetypeConfig, freshHurdleAtrMap, assetScores });
+    if (cryptoSlotVerdict) momentumData.cryptoSlotVerdict = cryptoSlotVerdict;
+
     // ---- Call Haiku ----
     summary.triggered++;
     const anthropic = getAnthropicClient();
```

| Changed line(s) | In plain words |
|---|---|
| `+// Crypto Slot v2 …` (5 comment lines), `+import { computeCryptoSlotVerdict } …` | Brings in the one function that works out the verdict. It lives in a new file outside the fence. Comments never reach the model. |
| `+// ---- Crypto Slot v2 …` (9 comment lines) | A note for the next reader: what the verdict is, why it sits here, and that it adds nothing while the flag is off. |
| `+const cryptoSlotVerdict = refreshFailure ? null : computeCryptoSlotVerdict({ … })` | Just before the prompt is built, it asks: "If the agent swapped its crypto for the bench crypto now, would the swap rules allow it, and if not, which rule stops it first?" It uses the same rule code, the same numbers and the same objects the swap checks use after the agent answers. It returns nothing while the flag is off, when no crypto is held, and on a check whose book could not be re-read. |
| `+if (cryptoSlotVerdict) momentumData.cryptoSlotVerdict = cryptoSlotVerdict;` | It hands the answer to the prompt builder through the bag of tick facts the builder already receives. **The builder's call line does not change.** When there is no answer, nothing is added, so with the flag off the bag is exactly what it was. |

### `api/_utils/agentEvalPromptAssembly.js` (+14 −2)

```diff
@@ -58,7 +58,12 @@ import { buildFundamentalsBlock } from './fundamentalsRender.js';
 // byte-identical (the DR-13 flag-split pattern: this import + one
 // interpolation below; registered in PROMPT_CONTRIBUTING_MODULES in this
 // same commit). The flat6 template never carries it — no crypto there.
-import { renderCryptoSlotBlock } from './evalCryptoSlotBlock.js';
+// Crypto Slot v2 (§7-gated, Fable build prompt + rulings 2026-10-14;
+// merges only with the founder's sign-off on this hunk —
+// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §3): the same module's
+// CRYPTO SLOT THIS CHECK line and RISK STATUS annotation, rendered in
+// buildLiveContextBlock's 3e3 slot — null / unchanged while dark or flat6.
+import { renderCryptoSlotBlock, renderCryptoSlotCheckLine, annotateCryptoSlotRiskStatus } from './evalCryptoSlotBlock.js';
 
 // ==================== SYSTEM PROMPT ====================
 
```

```diff
@@ -1211,8 +1216,15 @@ ${triggerLines}`);
   }
 
   // 3e3. Risk Status
+  // Crypto Slot v2: the CRYPTO SLOT THIS CHECK line takes this slot —
+  // immediately before RISK STATUS when that block renders — and RISK STATUS
+  // passes through the annotation. The line prints the bench crypto's daily
+  // move with formatPct, the BENCH table's own formatter (BUILD_RULES §9). Null and the
+  // block unchanged while dark, for flat6, or with no verdict on momentumData.
+  const cryptoSlotLine = renderCryptoSlotCheckLine(battle, momentumData?.cryptoSlotVerdict, formatPct);
+  if (cryptoSlotLine) parts.push(cryptoSlotLine);
   if (momentumData?.riskStatus) {
-    const riskLines = buildRiskStatusBlock(assetScores, momentumData.riskStatus);
+    const riskLines = annotateCryptoSlotRiskStatus(battle, buildRiskStatusBlock(assetScores, momentumData.riskStatus), momentumData?.cryptoSlotVerdict);
     if (riskLines) parts.push(riskLines);
   }
 
```

| Changed line(s) | In plain words |
|---|---|
| The import line, `-` then `+` (with 5 comment lines) | The module #961 added now also supplies the line and the annotation. Same file, two more names. |
| `+// Crypto Slot v2: …` (5 comment lines) | A note: where the line goes, and that it uses the BENCH table's own number formatter. |
| `+const cryptoSlotLine = renderCryptoSlotCheckLine(…)` / `+if (cryptoSlotLine) parts.push(cryptoSlotLine);` | Writes the CRYPTO SLOT THIS CHECK line into the live context, as its own block, right where RISK STATUS goes. With the flag off, for a tournament battle, or with no verdict, it writes nothing. |
| `-const riskLines = buildRiskStatusBlock(…)` / `+const riskLines = annotateCryptoSlotRiskStatus(battle, buildRiskStatusBlock(…), …)` | RISK STATUS is built exactly as before, then passes through one more step. That step adds "— you cannot swap it this check; hold" to the held crypto's own SWAP_OUT line, and only when the verdict is "you cannot swap". In every other case, including flag off, it hands the block back untouched. |

**Fenced functions.**
- **Edited:** `processAgentBattle` (two added statements and one import) and `buildLiveContextBlock` (two added statements, one wrapped call). Neither's logic changed when the flag is off.
- **Called by new code, not edited:**
  - `validateTradeDecision` (`agentSwapExecution.js`);
  - `clearsHurdleFloor` and `getRecentSwapCount` (`agentRiskManager.js`);
  - `flattenPortfolioServer` (`agentScoring.js`);
  - `buildRiskStatusBlock` and `formatPct`, as before, from inside the assembler.
- **Not edited:** the validator, the executor, the risk manager, the scorer, the guardrails, the tool schema, `buildEvalSystemPrompt` (its #961 splice is unchanged), and the flat6 template.


### How each sentence is backed (at HEAD)

`evalCryptoSlotBlock.js` points here. The text is Fable's (rulings R-a and R-b), rendered unchanged. "Holds except" comes from the review (§6); every exception falls in R-a's class or is a malformed book.

| Text the model reads | Backed by | Holds except |
|---|---|---|
| "you cannot swap {HELD} this check — {HELD} is LOCKED. Hold it." | The gate's own predicate on the same Set: `lockedPositions.has(held)` (`agent-evaluate.js:3541`). The Set is filled by the risk loop and pruned after forced exits; it is not written after that. | — (a guardrail exit also defers on a locked position, `agentGuardrails.js:453-466`) |
| "… — {BENCH} was swapped out less than 24 hours ago and is on cooldown. Hold it." | The validator's cooldown predicate (`agentSwapExecution.js:64-70`), named only after the validator passes with that cooldown cleared. The only writers of `cooldownUntil` stamp swap time + 24 h (`agentSwapExecution.js:461`; `stockThresholdAdmission.js:249`), and `portfolio` is not owner-writable. | A cooldown that expires during the model call: the line is then stale in the safe direction (RV-2). |
| "… — {BENCH} is {±x.xx}% on the day, and an incoming crypto must be up on the day. Hold it." | `clearsHurdleFloor`'s bench-positive step (`agentRiskManager.js:366`). `requireBenchPositive` is true for every archetype, and the dial never touches it. The number is the BENCH table's own cell (`formatPct`, R-d). | A player's stop or target on the held crypto, alongside the agent's own BTC → ETH (RV-1, R-a class). |
| "… — {BENCH} is up {+x.xx}% on the day but does not clear {HELD} by the hurdle margin. Hold it." | `clearsHurdleFloor`'s margin step (`agentRiskManager.js:369-385`), with the gate's reason, the dial-clamped config and the gate's ATR. | The same (RV-1). |
| "… — you have reached the swap limit for this window. Hold it." | `getRecentSwapCount(…) >= capPerWindow`, the gate's own expression (`agent-evaluate.js:3648-3653`, source-pinned). | The same (RV-1). The count includes the platform's own rotations (RV-12). A window that frees up during the model call (RV-2). |
| "you can swap {HELD} for {BENCH} ({BENCH} {+x.xx}% on the day, clears the hurdle)." | LOCK, the validator, the hurdle and the cap all pass, on the objects the gates read after the model answers. Nothing writes them in between (§6, L2). | Another position's guardrail taking the check's one swap, and a `maxSectorWeight` refusal with "Unknown" sectors (F1), both R-a class. The executor's identity check at `enforce` (`shadow` today). The distressed veto, operationally silent for crypto. |
| "It needs conviction 70 or higher. Whether to do it is your call." | The validator's conviction floor (`agentSwapExecution.js:82-85`). | The hypothesis floor (10 characters), the model's own field. |
| Annotation "— you cannot swap it this check; hold" | Only on the held crypto's own `SWAP_OUT (…)` line, and only when the verdict is "cannot". | The same as the "cannot" reason it rides on. |
| Paragraph: "A crypto can only be replaced by a crypto … refused and ends as a HOLD." | The validator's type match (`agentSwapExecution.js:72-80`); the refused proposal becomes HOLD (`agent-evaluate.js:3603-3607`). | Another position's guardrail breach replaces the proposal (RV-8, for Fable). F7's meeting path (D-8, not this build). |
| Paragraph: "Each check tells you which you can do: read the CRYPTO SLOT THIS CHECK line." | The line renders on every tiered check with exactly one held crypto and a bench crypto, which is every check of a well-formed battle. | Malformed or F7/F8 books render no line (RV-9). |
| Paragraph: "The SECTOR AWARENESS guidance and any sector-gap reasoning apply to your stock slots only." / "Every position … is long." / the first sentence and the symbols | As backed in #961's report §2 (unchanged facts); the symbols are read from `CRYPTO_ASSETS`. | As there. |

---

## §4 Files

`git diff --stat 216bc5b7 HEAD`: 13 files, +2,331 −49, plus this report.

| File | Lines | Why |
|---|---:|---|
| `api/_utils/cryptoSlotVerdict.js` (new) | +202 | The verdict: the gates' own functions, their order, their arguments (§1 Q-c; R-b, R-c). Non-fenced, so it adds no fenced logic. |
| `api/_utils/evalCryptoSlotBlock.js` | +174 −15 | Paragraph v2 (R-a), the line and annotation renderers (R-a's final text), and the probe's live-context splice helper. #961's module, so it is already in `PROMPT_CONTRIBUTING_MODULES` and the C-20 sweep covers the new prose. |
| `api/cron/agent-evaluate.js` (**fenced**) | +18 | §3. |
| `api/_utils/agentEvalPromptAssembly.js` (**fenced**) | +14 −2 | §3. |
| `api/_utils/__fixtures__/cryptoSlotLiveContextGoldens.json` (new) | +57 | The step 0.3 capture, byte for byte (SHA-256 `63ea7244…`): the flag-off live-context text of record. |
| `api/_utils/__fixtures__/cryptoSlotLiveContextCases.js` (new) | +111 | The capture's case definitions, moved in unchanged, so the test renders exactly what was captured. |
| `api/_utils/evalCryptoSlotBlock.test.js` | +314 −8 | The paragraph v2 wording lock; the line's and the annotation's wording locks and rules; flag-off live-context identity; flag-on placement; the probe-splice lock. |
| `api/_utils/cryptoSlotVerdict.test.js` (new) | +372 | The verdict for each reason and in order, the books with no line, the flag; source pins on the gate expressions and on the call site. |
| `api/cron/agent-evaluate.cryptoSlotLine.test.js` (new) | +284 | End to end: the line the real cron sends, against what its real gates then do with the same swap. |
| `scripts/experiments/cryptoSlotProbeV2.mjs` (new) | +748 | Probe v2, both arms (R-f). Writes only outside the repo. |
| `src/config/featureFlags.js` | +31 −20, prose | The flag's docstring now covers the line and the annotation (D-9) and points at this report's flip map. |
| `src/config/cryptoSlotPromptFlags.test.js` | +5 −3, prose | The pin's header comment, the same. The pin itself is unchanged. |
| `src/config/flagPinGuard.test.js` | +1 −1, prose | The `DARK_BY_DESIGN` runway note, the same. |
| `docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md` | — | This report. |

**Not touched** (build prompt §3 "Out"):
- the risk manager's logic and its SWAP_OUT computation;
- the validator, executor, scorer, tool schema and its SHA pins;
- the draft path and the flat6 template;
- `formatRecentEvals` and its whitelist;
- the Voice Layer and player copy;
- F1, F2, F5, F7, F8 and F9;
- the short task and crypto ATR calibration;
- every existing golden and snapshot.

---

## §5 Tests, mutation, build, lint

**Suite** (Linux, CI-shaped: private WSL clone, `TZ=UTC`, `--maxWorkers=2`, both reporters):

| Run | Commit | Test files | Tests | Failing | Exit |
|---|---|---|---:|---:|---:|
| Baseline | `e880592e` | `957 passed │ 7 skipped (964)` | 20,523 | **0** | 0 |
| The build, before review | working diff on `216bc5b7` (= `35fa8cac` less the probe) | `959 passed │ 7 skipped (966)` | — | **0** | 0 |
| After the review fixes | `d6c25973` | `959 passed │ 7 skipped (966)` | 20,620 | **0** | 0 |
| Final | `afaccb36` (the code head) | `959 passed │ 7 skipped (966)` | 20,620 | **0** | 0 |

The two added files are exactly the new ones (`cryptoSlotVerdict.test.js`, `agent-evaluate.cryptoSlotLine.test.js`). `evalCryptoSlotBlock.test.js` already existed and grew.

**New and changed rows** (all walk the flag through `vi.mock` getters with an `importOriginal` spread, so no row moves when the flag flips):

| File | Rows | What they pin |
|---|---:|---|
| `evalCryptoSlotBlock.test.js` | 105 (was 49) | <ul><li>**Paragraph v2:** the wording lock (a typed copy of the ruled text), the symbol list read from `CRYPTO_ASSETS`, and #961's placement and neighbour rows, kept.</li><li>**The line:** each of the five "cannot" sentences and the "can" sentence word for word (Fable's final text, typed). The reasons in the gates' order. A verdict it cannot render renders nothing. Dark → `null`. flat6 → `null` at either flag state.</li><li>**Honesty (L4):** no line, annotation or paragraph sentence says "no swap is possible", "no legal replacement", "is allowed" or any banned phrase.</li><li>**The annotation:** only on the held crypto's `SWAP_OUT` line with a "cannot" verdict. Never on "can", a stock's line, LOCKED, EMERGENCY_SWAP, TRAIL_STOP or HOLD. Unchanged for anything it cannot place.</li><li>**Flag off:** all 12 captured live contexts byte-identical, with and without a verdict planted on the tick's data. The capture's own hashes are checked.</li><li>**Flag on:** each case equals the capture with the line in the 3e3 slot (and the annotation where due). The line appears once, immediately before RISK STATUS, or after the snapshot or trigger block when RISK STATUS does not render.</li><li>**Formatting:** the line's number is the BENCH table's own cell, for seven values.</li><li>**Never without a verdict;** never in flat6, even when handed one.</li><li>**The probe's live-context splice** equals the flag-on build for every case, at either flag state.</li></ul> |
| `cryptoSlotVerdict.test.js` (new) | 25 | <ul><li>The fixed validator argument, pinned exactly (R-c).</li><li>Each reason through the real fenced functions.</li><li>The first failing check in the gates' order for every pairing.</li><li>The dial-clamped config followed. A disabled window caps nothing.</li><li>No line for malformed books, and never "cooldown" for a refusal that is not the cooldown.</li><li>Dark: nothing runs, not even the clock. An unreadable flag gives no line.</li><li>**Source pins:** the cap's inline expression in the gate and in the verdict are the same expression. So are the hurdle call, the ATR fallback, LOCK, the validator, and the gates' order. The verdict re-implements no arithmetic. The call site sits after the rebuild, the meeting/proposal re-reads and the trigger gate, and before the build. The key is attached only when there is a verdict.</li></ul> |
| `agent-evaluate.cryptoSlotLine.test.js` (new) | 16 | **Verdict = gate, end to end** on the real `processAgentBattle`. In each row the line sent to the model and the gates' handling of the same BTC → ETH proposal agree:<ul><li>can swap → executed;</li><li>LOCK, cooldown, not up, margin, swap cap → each held at exactly that gate, with only that gate's error recorded;</li><li>the tempo dial at "measured" (cap 3), with a standard-tempo control.</li></ul>Also:<ul><li>the line sits before RISK STATUS;</li><li>the annotation on a real stagnation SWAP_OUT;</li><li>no annotation on a "can";</li><li>a forced rotation that executes before the prompt yields "BTC was swapped out … on cooldown" about the new held crypto;</li><li>flag off: no line, no annotation, and the key absent from the tick's data in three scenarios;</li><li>flag on: the key holds the verdict;</li><li>no bench crypto → no line.</li></ul> |
| `src/config/*` | 0 new | Prose only: the flag's docstring, the pin's header, the `DARK_BY_DESIGN` note. |

**Probe v2's selftest** (plain node): green at the code head. It covers:
- the reconstruction in the gates' order, including the rounding box and the tempos;
- arm S's exact minimum + 0.50;
- the one-cell edit;
- the splice verification (annotation due, missing, doubled or stray);
- the judge and both arms' bars (malformed replies included);
- the worst-case pricing and the cap boundary.

**Mutation** (my own; each mutant applied by an exact-once text edit in the private Linux clone, syntax-checked, run, then the clone reset):

| Round | Run against | Result |
|---|---|---|
| 1 (the build, `35fa8cac`) | the three suites, or the probe selftest | **30 / 30 killed**. M28 (the probe's splice verification ignores the annotation) first SURVIVED: no selftest row covered a *missing* annotation. Two rows were added and it was killed. |
| 2 (the L1 fixes) | the same | **M31, M32 killed**: the flag read moved outside the `try`, and the clock read before the flag. |
| 3 (the review fixes, `d6c25973`) | the same | **N01–N12, 12 / 12 killed**. These are the un-clamped config (now killed by a behavioural row as well as the pin), a disabled window, the hypothesis text, both rounding boxes, arm S + 1 cent, malformed replies on each bar, worst-case pricing, the cap boundary, and non-finite cells. |

Every mutation the prompt names is in round 1:
- a gate dropped: M01–M04;
- the gate order swapped: M05, M06;
- the annotation on "can": M07;
- the line leaking into flat6: M08;
- the verdict computed after the prompt build: M09. Also the reverse, before the rebuild: M10.

The tests/probe reviewer (L3) independently ran 74 mutants (§6).

**`vite build` and `lint:gate`** (Linux clone):
- At `216bc5b7` (the STOP report): `vite build` green.
- At the build's working diff: `lint:gate` green.
- At the code head `afaccb36`: `lint:gate` exit 0 and `vite build` green (built in 10.97 s). Both were also green at `d6c25973` (built in 13.23 s).
- The pushed head is built again before the push (memory rule: build the pushed head).

---

## §6 Review (BUILD_RULES §2)

**Scope.** The cumulative branch diff at `35fa8cac`: 10 files, +2,189 −25 (past both thresholds).

**Isolation.**
- Each lens and each refuter had its own `git -c core.autocrlf=false archive` extraction in the session scratchpad, with `node_modules` linked. L1 also had a base extraction (`216bc5b7`).
- All were read-only on git and the working tree, and unprimed.
- L3, the mutating lens, ran last on its own tree and restored every mutated file byte for byte (verified).
- Several reviewers report that vitest wrote its own results cache (`node_modules/.vite/vitest/…/results.json`) through the link. That is expected and harmless.

**Lenses:**
- **L1:** flag-off byte identity, live context included.
- **L2:** verdict = gate (try to make them disagree).
- **L3:** tests, pins, goldens, flip-proofing, the probe (mutating).
- **L4:** honesty: every sentence against the code.

Then four refuters on L1/L2/L4's findings, batched by topic (timing; the guardrail class and wording; code and doc claims; out-of-scope), and a fifth on L3's.

### §6.1 What the lenses established

- **L1 found no flag-off difference anywhere.**
  - 97 system prompts (8 archetype keys × 6 modes × 2 names) and 1,152 live contexts (12 cases × 15 kinds of tick data × 3 trigger states × 2 presets) are byte-identical, base vs head.
  - The real cron, base vs head, in 11 scenarios (7 with the shadow capture forced on) gave identical requests, Firestore updates, stored documents, summaries, executor calls, logs, and tick data at the builder and at the shadow capture. `hasOwnProperty('cryptoSlotVerdict')` was false everywhere.
  - A forced-on control did differ, so the harness detects differences.
  - The pinned builder call line did not move (Q-c: no disclosure owed).
- **L2 found no input on which the line says "you can swap" and LOCK, cooldown, the cap or the hurdle then refuses the same pair,** except a theoretical clock skew between two servers (RV-3).
  - Between the verdict and the gates nothing writes the battle, prices, the LOCK set, the scores or the ATR map.
  - The arguments match, and the gate order matches production's recording in every two-failure combination.
  - Malformed books give no line, never a wrong one.
- **L3 found the tests prove what they claim.**
  - Every mutation the prompt names is killed, mostly by behavioural rows. L3's verdict and cron mutants were killed except three equivalent ones (V13, V15, R03).
  - It independently rendered the 12 capture cases with the **base** builder and got the committed hashes.
  - Its own flip test reddened exactly 10 rows.
- **L4 found every sentence of the line, the annotation and the paragraph to be Fable's text exactly,** and true about the agent's own options. Its material items were documentation.

### §6.2 Findings and dispositions

**Totals.**
- **Raw findings:** 29 (L1 3, L2 6, L3 9, L4 11).
- **After merging overlaps:** 26 distinct (RV-1 to RV-24, plus 2 out of scope).
- **Refuter verdicts:**
  - CONFIRMED: 17
  - PARTLY: 7
  - REFUTED: 1 (D3)
  - Not refuted, no verdict needed: 1 (RV-15, which L4 itself marked acceptable).
- **Severity after the refuters:** 0 blocker, 0 major, 5 minor, the rest nit or none.
- **Fixed:** every in-scope finding is fixed (`d6c25973`, `afaccb36`) or documented for Fable (§6.3).
- **Outside the build:** two are pre-existing fenced-code items (§6.4).

| ID | Lens / refuter | Finding | Verdict | Sev. | Disposition |
|---|---|---|---|---|---|
| RV-1 | L2-2 = L4-3 / B1 | A guardrail breach on the held crypto plus the agent's own BTC → ETH: the guardrail reinforces it, skips the hurdle and cap, and it executes on a "cannot" line. | CONFIRMED; inside R-a's class (the engine records it as the guardrail's trade; the outcome equals G2) | nit | **Documented**: the verdict module's NOT COVERED block; §6.3 item 1. Not built (R-a). |
| RV-2 | L2-1 / A1 | A "cannot" can become passable by gate time on a window-edge or cooldown-expiry check. The */15 cron schedule makes it systematic rather than incidental. | CONFIRMED (safe direction: the agent holds, a swap is forgone) | minor | **Documented** (module TIMING note; this row). Taking the verdict later would trade it for the unsafe direction. |
| RV-3 | L2-3 = L4-8 / A2, A3 | The "cap count only falls" comment overclaims: `getRecentSwapCount`'s future-guard could count a trade stamped ahead of the verdict's clock. | Mechanism CONFIRMED, not reachable (needs a second server writing the same battle with a clock ahead); A3 PARTLY | nit | **Comment fixed.** |
| RV-4 | L1-1 / A4 | Flag off, the cron evaluated `Date.now()` for the verdict's argument: one extra clock read per tick vs base. | CONFIRMED; nothing observes it | none | **Fixed:** the clock is read inside the verdict, after the flag. Row: "dark: nothing runs, not even the clock read". M32 is killed. |
| RV-5 | L1-2 / C6 | The verdict's flag read sat outside its `try` while its docstring promised "null on any fault". | CONFIRMED; production cannot throw; no hermetic mock reaches it today (C6 walked all 17 such mocks) | nit | **Fixed** (read inside the `try`; row "an unreadable flag is no line"; M31 is killed). The renderers keep #961's unguarded read, the same class as `buildLiveContextBlock`'s existing flag reads. |
| RV-6 | L4-1 / C1 | At `35fa8cac` the report was still the STOP version, while code comments cite §3/§5/§7. | PARTLY: the normal cite-then-commit intermediate state (#961 precedent); "(§9) ambiguous" REFUTED (116 such cites, the repo convention) | nit | **Fixed by this report.** It replaces the STOP header and carries the backing table in §3. The two new "(§9)" cites are spelled out as BUILD_RULES §9 anyway. |
| RV-7 | L4-2 / C2 (= L3-6) | The flag's docstring, the pin header and the DARK_BY_DESIGN note still described v1 only. | CONFIRMED | minor | **Fixed:** all three now describe paragraph + line + annotation (D-9) and point at §8. |
| RV-8 | L4-4 / B2 | Paragraph bullet 1, "is refused and ends as a HOLD": another position's guardrail breach replaces the proposal, and the check ends as a SWAP. | CONFIRMED, sharper ("is refused" is not literal then either) | nit | **For Fable** (§6.3 item 2). The text is Fable's. |
| RV-9 | L4-5 / B3 | "Each check tells you … read the line": no line renders when there is not exactly one held crypto, no bench crypto, the validator refuses for a reason other than the cooldown, or a fault occurs. | CONFIRMED paths; none reachable on a well-formed tiered book (draft and executor keep the shape) | nit | **Documented** (module; here). Showing nothing beats a guessed line. |
| RV-10 | L4-6 / B4 | `margin_invalid` is mapped to the "margin" reason. | PARTLY: the mapping holds; the premise (an ATR of 0) is REFUTED (the scorer turns 0 into 2.5; only a malformed negative ATR gets there) | none | **Comment made precise.** |
| RV-11 | L4-7 / C3 | "Passes by construction" overclaims: three of the validator's predicates depend on data. | CONFIRMED (behaviour correct) | nit | **Fixed:** "on a well-formed book". |
| RV-12 | L4-9 / B5 | NOT COVERED omitted another position's breach and executor refusals. Also, "you have reached the swap limit" counts the platform's own rotations and meeting legs. | (a) CONFIRMED, (b) PARTLY (typed refusals need `enforce`; `shadow` today), (c) CONFIRMED | nit | **Comment fixed**; (c) **for Fable** (§6.3 item 3). The gate counts the same way, so the verdict is right. |
| RV-13 | L4-10 / C4 | Probe comment: "the 60-minute window" (Guardian's window is 120). | CONFIRMED | nit | **Fixed.** |
| RV-14 | L2 (held) / C5 | The distressed veto's silence for crypto is operational, not structural. | PARTLY: true, and held true by the stock universe (239 tickers, no crypto) | nit | **Comment fixed** (operational; a doc under a crypto symbol would arm it). |
| RV-15 | L4-11 | #961's assembler comment ("this import + one interpolation") no longer describes the whole fenced diff alone. | L4: acceptable (the v2 comment follows it) | none | No change. |
| RV-16 | L3-1 / E1 | The probe selftest did not test the ±0.005 rounding box, and `plan` only warned when the indeterminate count drifted. | CONFIRMED (no effect on this run's main arm) | minor | **Fixed:** box rows; `plan` STOPs on a drift. Mutants N04 and N05 are killed. |
| RV-17 | L3-2 / E2 | Other probe gaps: arm S + 1 cent; malformed replies on the non-refused and "cannot" tallies; worst-case pricing; the cap boundary; NaN cells; plan's completeness STOPs; the stray-annotation branch. | CONFIRMED except the stray-annotation branch (E2-5: equivalent mutant; the final byte comparison already rejects it) and plan's completeness STOPs (genuine but unreachable from the selftest) | nit–minor | **Fixed** (rows; N06–N12 are killed), except those two, which are noted here. |
| RV-18 | L3-3 / E3 | Arm S shows states a live tick may not reach. With ETH up that much, production's stagnation rotation would already have swapped BTC → ETH at the standard and aggressive tempos (all 21 SWAP_OUT requests). Only at "measured" is the arm-S prompt reachable. | CONFIRMED | — | **For Fable** (§7 "Reading it"). R-f is implemented as ruled. |
| RV-19 | L3-4 / E4 | The probe's first plan stamp named an uncommitted script. Also, `records.json` was not SHA-pinned. | CONFIRMED, superseded | none | **Fixed:** re-planned at the code head (the stamp matches the committed blob). `records.json` is now pinned too (`afaccb36`). |
| RV-20 | L3-5 / E5 | The reconstruction reads BTC's daily move from the macro line, a separate fetch of the same quote, so drift is unmodelled. | CONFIRMED; the nearest margin verdict is 0.39 points from flipping, and no verdict flips under ±0.05 | nit | **Documented** (§1 Q-b, §7). |
| RV-21 | L3-7 / E6 | A test comment called the fixture verdicts "what cryptoSlotVerdict.js returns". One case (swap_cap) is a render driver; its real verdict is not_up. | CONFIRMED | nit | **Comment fixed.** |
| RV-22 | L3-8 / E7 | The fixed hypothesis text was pinned only by length. | CONFIRMED, equivalent mutant | none | **Pinned exactly** anyway (N03 is killed). |
| RV-23 | L3-9 / E8 | Four mutants are killed only by source pins: a disabled window ignored, the refreshFailure guard dropped, the un-clamped config, and the gate's hurdle reason. | PARTLY | minor | **Behavioural rows added** for the un-clamped config (a tempo-dial e2e row; N01 is now killed by behaviour), the disabled window (unit row; N02) and the gate's hurdle reason (the e2e row now proposes the swap between the two floors). The refreshFailure guard stays pin-only: no prompt is built on that path. |
| RV-24 | L2-4 / D1 | A reinforced guardrail pair that the validator refuses defers the player's stop, on every check the agent keeps doing so, for any refusal cause. | CONFIRMED, broader than stated | low, latent | **Out of scope, pre-existing → G3** (§6.4, §9). |
| — | L2-5 / D2 | A guardrail forced exit's `note: undefined` fails the tick's final write after the swap commits. | CONFIRMED | P1-latent | **Already filed** (`20260919_BUILD_EVAL_FIX_INTEGRATION.md` §11.6(1), §12.4). It is what G2 hits if it fires (§6.4). |
| — | L1 (out of lens) / D3 | The shadow capture re-renders the live context with a pre-swap verdict. | **REFUTED**: nothing refreshes `battle` between the verdict and the capture; the re-render is about the same book and byte-equal to what the model saw | none | No change. |

**Refuted sub-claims** (recorded, not acted on):
- **C1:** "(§9) is ambiguous". It is the repo's convention.
- **A3:** "the 'cannot' direction is unmentioned". The report stated it.
- **B4:** "a baseATR of 0 reaches the hurdle".
- **B5(b):** "executor refusals can contradict 'can' today". They require `enforce`.
- **D3:** the whole finding.
- **A2:** production reachability. The mechanism is real.
- **E2-5:** the stray-annotation branch is not a gap. It is an equivalent mutant.

### §6.3 For Fable — the R-a class as review found it (documented, not built)

R-a: *"The line describes what the agent can do. It does not predict what the engine will do."* Review confirmed the class and found three edges in it. None is built; the wording is Fable's.

1. **A guardrail can back the agent's own swap (RV-1).**
   - **Mechanism:** when the held crypto breaches a player's stop, trailing stop or profit target and the agent proposes exactly BTC → ETH, the guardrail adopts the proposal under its own reason (`reinforced_haiku`). That skips the hurdle and the cap, and the swap executes. On that check, "you cannot swap BTC this check — ETH is −x% … must be up on the day" (or the margin or swap-limit reason) was false *about the agent's own option*.
   - **Why it is the same class:** the outcome is identical to the guardrail's own forced exit had the agent held (G2), and the engine records the trade as the guardrail's (`source: 'guardrail'`, `exitReason: guardrail_*`).
   - **Unaffected:** LOCK and cooldown.
2. **Bullet 1's "is refused and ends as a HOLD" (RV-8).**
   - "Is refused" holds for every crypto↔stock proposal the agent makes.
   - When a guardrail breach on *another* position fires that check, the guardrail replaces the proposal before the validator runs, and the check ends as a SWAP. This is R-a's named "another position's breach takes the check's one swap".
3. **"You have reached the swap limit for this window" (RV-12).**
   - The cap counts every swap in the window except the emergency and user-directive ones. That includes the platform's stagnation rotations and approved meeting legs, not only the agent's own.
   - The verdict counts exactly what the gate counts, so the line is right that the agent cannot swap. Only the word "you" is loose.

Also in the class and documented:
- the `maxSectorWeight` refusal, which needs the "Unknown" sector (F1);
- the executor's swap-identity refusal, which can fire only at `enforce` (`shadow` today).

### §6.4 Found in review, outside this build (BUILD_RULES §3: reported, not fixed)

- **G3 (new): a reinforced guardrail pair that the validator refuses defers the player's stop** (RV-24).
  - **When:** the agent proposes a pair the validator refuses, with the breached position as `symbolOut`. The guardrail then keeps the agent's own pair, and the stop does not fire that check. It recurs every check the agent keeps doing so.
  - **Causes:** a crypto → stock type mismatch, but also conviction below 70, a cooldown on the agent's pick, an already-held name, a short hypothesis, or a distressed incoming name. A forced exit would have raised conviction to 70; a reinforce does not.
  - **Status:** pre-existing in fenced code (`agentGuardrails.js` reinforce branch plus the validator); not filed anywhere. With the flag on, paragraph v2 should make the crypto → stock form rarer.
  - **Proposed home:** the swap-path integrity build, with F1, F7 and G1.
- **Already filed:** a guardrail forced exit carrying `note: undefined` makes the tick's final Firestore write fail after the swap has committed (`docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md` §11.6(1), §12.4).
  - **What a refuter added:** this is what the R-a exception (G2) hits if it fires in production. The forced BTC → ETH commits, then the evaluation record is lost.
  - It is relevant to the flip only in that sense; fenced and out of scope.

---

## §7 Probe v2

**Outcome.**
- **Main arm: FAILED** on one clause. Crypto → stock was 2 of 128 (bar ≤ 2: met), but both were among the 26 previously refused (bar 0: missed). Crypto → crypto where the line says "cannot" was 1 (bar ≤ 2: met).
- **Arm S (COUNTERFACTUAL): PASSED its guard:** 0 crypto → stock of 26.
- Per R-f: **no re-wording; the PR stays draft; STOP for Fable.**

| Bar | Captured (no block, no line) | Probe v2 | #961's probe (v1 paragraph) | Bar | Result |
|---|---:|---:|---:|---|---|
| crypto → stock, the determinate requests | 26 of 128 | **2 of 128** | 10 of 144 | ≤ 2 | met |
| crypto → stock, the 26 refused | 26 of 26 | **2 of 26** | 9 of 26 | 0 | **missed** |
| crypto → crypto where the line says "cannot" (all 128) | 0 | **1** | 14 (no line then) | ≤ 2 | met |
| Arm S (COUNTERFACTUAL): crypto → stock | — | **0 of 26** | — | ≤ 1 | met |

**The run.** `scripts/experiments/cryptoSlotProbeV2.mjs` at `afaccb36`. The plan stamp's script SHA-256 is `76c1a32e…`, which equals the committed blob.

| Item | Value |
|---|---|
| Source | `sources.jsonl` (SHA-256 `6fb95a74…`, matches the Phase 0) and `records.json` (SHA-256 `8bc76a9e…`, now pinned) |
| Requests | 144 tiered. **128 determinate**: 111 "not up", 17 margin, 0 "can". **16 indeterminate**: one battle holding ETH, whose daily move is not in the request; excluded from the bars and counted. 0 otherwise excluded. 26 refused, all determinate. |
| Splices | Paragraph v2 into every system prompt, with #961's helper locked to the build. The line, plus the annotation on the 26 held-BTC SWAP_OUT requests, into every live context, with the module's helper locked to the build. Each was verified by marker and by diff. |
| Arm S (COUNTERFACTUAL) | The 26 refused requests. The bench crypto's Daily% cell was set to the smallest 2-decimal value clearing the margin at all three tempos (every rounding corner), plus 0.50: from +0.51% to +3.33%, against originals of −0.40% to −5.70%. Each was checked to read "can" under the reconstruction, with exactly one cell changed and then the line inserted, and no annotation. |
| Model and parameters | `claude-haiku-4-5-20251001` at temperature 0.4, with tools and `tool_choice` as stored (read, not chosen). |
| Batch | One Message Batch, `msgbatch_01UqYS7MubZCsnBaxiJhqKK3`: 154 requests, **154 succeeded**, 0 errored or expired, every reply ending `tool_use`. Deleted on Anthropic's side after collection. |
| Cost | **$1.78** at batch prices ($1.48 main + $0.30 arm S); 2,412,934 input and 229,086 output tokens. Plan estimate $1.78, worst case $2.32, cap $5 / 300 calls. |
| **Token cost of paragraph v2 + the line** (measured: reply input tokens minus the stored request's recorded input tokens) | **279–288 tokens** on every main request (median 279; the annotation and the margin wording add the top 9). **289** on every arm-S request (the "can" sentence). #961's paragraph alone measured 222, so the line and annotation cost roughly 57–66 tokens. |

**Counts** (each reply judged with production's `validateTradeToolResult`, via #961's helpers):

| | Main, all 128: captured | Main, all 128: probe v2 | Refused 26: captured | Refused 26: probe v2 | Arm S (COUNTERFACTUAL), 26 |
|---|---:|---:|---:|---:|---:|
| HOLD | 87 | **98** | 0 | **14** | 0 |
| SWAP | 37 | 25 | 26 | 12 | 25 |
| — crypto → stock | 26 | **2** | 26 | **2** | **0** |
| — crypto → crypto | 0 | **1** | 0 | **1** | **21** |
| — stock → crypto | 0 | 0 | 0 | 0 | 0 |
| — stock → stock | 11 | **22** | 0 | **9** | 4 |
| Malformed (production would fail it closed to HOLD) | 4 | 5 (conviction 3, hypothesis 1, trade_reasoning 1) | 0 | 0 | 1 (hypothesis; it named crypto → crypto) |
| Malformed but naming crypto → stock / crypto → crypto | — | 0 / 0 | — | 0 / 0 | 0 / 1 |
| Replies whose own words cite the line ("CRYPTO SLOT", "can/cannot swap") | — | 21 | — | 9 | 17 |
| Replies citing SWAP_OUT | — | 3 | — | 3 | 12 |
| "short" as a position (rationale and other player-visible fields) | — | **0** | — | 0 | **0** |

**By archetype** (main arm, probe v2):

| Archetype | Requests | crypto → stock | crypto → crypto | stock → stock | HOLD | Malformed |
|---|---:|---:|---:|---:|---:|---:|
| Trend Follower | 96 | 0 | 0 | 16 | 77 | 3 |
| Diversifier | 24 | **2** | **1** | 5 | 16 | 0 |
| Contrarian | 8 | 0 | 0 | 1 | 5 | 2 |

**The failing replies' shapes** (the 3 crypto-slot proposals; counted from the replies, which stay in the local exhibits):

| Shape | crypto → stock (2) | crypto → crypto (1) |
|---|---:|---:|
| Archetype / battle | Diversifier, **one battle, consecutive checks**. It is the battle behind #961's run of four BTC → LLY. | Diversifier, another battle |
| The line said | "cannot — ETH is −5.15% / −5.70% … must be up on the day" | "cannot — ETH is −0.93% …" |
| RISK STATUS flags BTC SWAP_OUT (annotated) | 0 | 1 |
| Cites the line | 1. It names the crypto-slot rule but reads it as ruling out only BTC → ETH, and then treats BTC → LLY as a stock-slot move in the Support tier. | 1 |
| Cites SWAP_OUT | 0 | 1 |
| Its own words say it will hold, yet the tool decision is SWAP | 0 | **1**: the rationale says it cannot swap this check and will hold, and the structured decision is SWAP BTC → ETH |
| Frames BTC as stagnant and the incoming name as strong today | 2 | 1 |
| Mentions the Support tier / its 1.0x multiplier | 2 | 0 |

**Reading it — for Fable.**
1. **The line moved behaviour a long way.**
   - On the 26 previously refused checks, sells of the crypto fell from 26 (captured) and 23 (#961: 9 to a stock, 14 to a falling ETH) to **3**.
   - 14 now hold, and 9 move a stock slot instead, as the paragraph says ("If you want to make a move that check, it has to be in a stock slot").
   - Across all 128, crypto → stock fell 26 → 2 and crypto → crypto is 1. 21 replies cite the line in their own words.
2. **The two misses are one battle's two consecutive checks, both Diversifier BTC → LLY,** where BTC carried no SWAP_OUT.
   - One reply shows the residual misreading: it took the line as ruling out ETH only, and treated a crypto → stock swap as a stock-slot move.
   - That is bullet 1's rule, "a crypto can only be replaced by a crypto", not taking hold against the Diversifier's sector-gap charter on that battle.
   - The 26 refused are not independent draws (#961 §6's caveat), and this battle contributes heavily to them.
3. **The one crypto → crypto is a reply whose narrative holds while its decision swaps.**
   - Its rationale says it cannot swap this check and will hold. The structured decision says SWAP.
   - That is a reply-consistency failure, not a misreading of the line. The validator would have let it through to the hurdle, which refuses it (ETH down).
4. **No sign the line suppresses legal stock moves.**
   - stock → stock rose from 11 (captured) to 22. #961's replay had 10.
   - The rise is mostly the refused checks redirecting to a stock slot (9).
5. **Arm S (COUNTERFACTUAL): the agent reads "can swap" and uses it, and opens no crypto → stock path.**
   - 21 of 26 took BTC → ETH, plus 1 malformed reply naming it; 4 moved a stock slot; 0 held; 0 went crypto → stock.
   - **Read it with RV-18's caveat:** in 21 of these 26 states, production's own stagnation rotation would already have swapped BTC → ETH before the prompt at the standard or aggressive tempo. The arm-S prompt is reachable as built only at "measured".
   - So arm S shows that the "can" sentence is read, not how often it would appear.
6. **Limits:**
   - one sample per request at temperature 0.4;
   - the 16 held-ETH requests are excluded;
   - **0 of the 128 determinate main-arm checks read "can"**, so the main arm never shows the "can" sentence (arm S does);
   - the macro-line caveat (RV-20; no verdict flips under ±0.05 drift);
   - the bars are Fable's, applied as written.

**Local exhibits** (`%USERPROFILE%/ft-experiment-exhibits/crypto-slot-probe-v2/`, outside the repo):
- `manifest.json` (plan, batch, command log with HEAD and script SHA);
- `requests.jsonl`;
- `results-0.jsonl`;
- `judge.json`.

---

## §8 Flip checklist — paragraph v2 + the line + the annotation

The flip is its own small commit after Flash signs off on §3 and §7, never in this PR. **One flag governs all three renders** (D-9). Flipping it turns on paragraph v2, the line, and the annotation, and makes the cron compute the verdict. R-f's STOP stands until Fable reads §7.

1. **`src/config/featureFlags.js`.**
   - Set `CRYPTO_SLOT_PROMPT_ENABLED = true`.
   - Reword the docstring's "DARK — default FALSE" and "When FALSE (CURRENT)" (BUILD_RULES §2).
2. **`src/config/cryptoSlotPromptFlags.test.js`.**
   - Move the pin to `toBe(true)`.
   - Reword the header's "ships FALSE".
3. **`src/config/flagPinGuard.test.js`.** Drop the `CRYPTO_SLOT_PROMPT_ENABLED` entry from `DARK_BY_DESIGN`. The guard's integrity row fails if it stays.
4. **Regenerate exactly the 7 tiered system-prompt snapshots** with `npx vitest run api/_utils/p4Equivalence.battery.test.js api/_utils/evalIdentityBlock.injection.test.js -u`:
   - `api/_utils/__p4_snapshots__/buildEvalSystemPrompt.analyst.snap.txt`;
   - the six `api/_utils/__dr13_snapshots__/buildEvalSystemPrompt.identityOn.{analyst,contrarian,degen,diversifier,guardian,momentum_chaser}.snap.txt`.

   Each must gain exactly paragraph v2's 8-line block at the one point, and nothing else.
5. **Check that nothing else moves.** `git diff --stat` must list only the 3 files above and the 7 snapshots. In particular none of these may appear:
   - **the flat6 snapshots:** the six `…identityOn.flat6.*.snap.txt` and `…flat6.analyst.snap.txt`;
   - **the system-prompt goldens:** `ask1PromptGoldens.json`, `ask2PromptGoldens.json`, `cryptoSlotPromptGoldens.json`;
   - **the live-context capture:** `cryptoSlotLiveContextGoldens.json` (new in this build; every suite that reads it forces the flag itself);
   - **the cron goldens:** `callRecordsOffGolden.json`, `callRecordsRollbackGolden.json`, `meetingCopyBaseline.json`; their three suites pin the flag false;
   - **the tick-stamps goldens:** the tick-stamps harness has no bench crypto, so no verdict.

   Then run the full suite.

**The live context adds nothing to the flip.**
- No existing golden, snapshot or SHA pin renders a tiered live context with both a held crypto and a bench crypto under the real flag.
- The new suites force the flag themselves.
- So the line and the annotation move no file at the flip. Their first appearance is in production.

**Dry run of this checklist** (my private Linux clone at `d6c25973`, CI-shaped; the clone was restored clean after each run). `d6c25973` was the code head then. `afaccb36` changed only one end-to-end test row and the probe's `records.json` pin, and neither is in the flip set, so the run stands for it:

| Run | What changed | Result |
|---|---|---|
| **Control**: the flag line alone | `featureFlags.js` (module value printed: `true`) | `Test Files 4 failed │ 955 passed │ 7 skipped (966)`. **Exactly 10 failing rows**: <ul><li>6 DR-13 tiered snapshots;</li><li>1 P4 tiered snapshot;</li><li>the pin;</li><li>2 flag-pin-guard rows (the pin contradiction and the `DARK_BY_DESIGN` integrity row).</li></ul>The same 10 as #961's control, so no live-context suite moves. |
| **Flip**: steps 1–4 | `-u` reported "7 updated". `git status` showed exactly 10 files: the 3 edited plus the 7 snapshots, +58 −4. Each snapshot gained the 8 lines of the block and lost none. | `Test Files 959 passed │ 7 skipped (966)`, **0 failing**. |

The same control run on the build commit `35fa8cac` gave the same 10 rows. L3 independently flipped the flag on its own tree and saw exactly those 10 rows go red (§6). The dry run did not include the docstring rewording in steps 1–2: it is prose, with no effect on the tests.

---

## §9 Not in this build

Carried, one line each:
- **F1:** a swapped asset loses its `sector`, so the tables print "Unknown". Next, in the swap-path integrity build. It also gates the `maxSectorWeight` edge of §6.3. Paragraph v2's "go by the symbol" clause stays while F1 stands.
- **F2:** for a short, the scorer's intraday extremes are negated but not swapped.
- **F3:** "held by a guardrail" names the wrong layer for pair-validation downgrades.
- **F4:** the status feed's hold beat can announce a swap that did not happen.
- **F5:** two copies of the crypto list.
- **F6:** the model never learns why a swap was refused (`formatRecentEvals`).
- **F7's fix:** the gameplan-meeting approval runs swaps without the validator. Swap-path integrity build, with F1 (D-8).
- **F8:** `validatePortfolio` has no crypto exclusion on the stock arrays.
- **F9:** `PROFIT_TARGET_EXECUTOR_ENABLED`'s docstring is stale.
- **G1:** stale tick data after a pre-prompt meeting or proposal swap. Joins F1 and F7 (R-g).
- **G2:** the stop-class guardrail path. A documented exception (R-a), with §6.3's edges.
- **G3 (new):** a reinforced guardrail pair the validator refuses defers the player's stop (§6.4).
- **The short task (R-2 / R-4).**
- **Crypto ATR calibration** (with the short task, R-g). Q-b's numbers:
  - the hurdle divides by the frozen 5–7% (no crypto has a rankings row);
  - the held crypto carried SWAP_OUT (stagnation) on 26 of 144 checks, against 0 of 864 held-stock rows;
  - the forced rotation needs 2.5 points over BTC at the Trend Follower's 0.5 (5% ATR); the agent's own swap needs 1.75.

---

## Appendix — method

**Source:** `%USERPROFILE%/ft-experiment-exhibits/archetype-ablation-run/sources.jsonl`, SHA-256 `6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437` (matches the Phase 0), joined to `records.json` on `k`. The 144 tiered requests are those whose system prompt says "BaggerBomb game". The discovery scripts live in the session scratchpad (outside the repo) and print counts only. The probe is `scripts/experiments/cryptoSlotProbeV2.mjs`. No player text is in this report.

**Parsing:**
- ACTIVE POSITIONS and BENCH: columns located by header name. The crypto is the one of the seven symbols in `agentCryptoAssets.js:5-11`.
- RISK STATUS: `SYMBOL: TEXT` lines; an absent block means every position is HOLD.
- "Not up": the Daily% cell. `-0.00%` is down (`formatPct` prints `+` for ≥ 0); `+0.00%` would be indeterminate (none occurred).
- Margin: production's `clearsHurdleFloor` at each tempo's clamped config, over the ±0.005 rounding box of both 2-decimal cells.
- Cap: today's CLOSED TRADES rows, compared with the smallest tempo cap.
