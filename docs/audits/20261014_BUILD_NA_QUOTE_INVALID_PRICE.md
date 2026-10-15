# Build: an unusable real-time price sets no price

14 October 2026. Bounded pricing fix after the Shadow diagnosis. STOP at handback for founder review and merge.

## Preamble

- **Branch.** Worktree branch `claude/fantasytrades-shadow-checks-e92318`, pushed as `claude/na-quote-invalid-price` by refspec. Cut at `e880592e` = `origin/main` (`git fetch origin` run first and again before the push).
- **Commits.**
  - Code and tests: `1b86e651`.
  - This record: the commit that adds it.
- **Line anchors** are at `1b86e651` and were read in this session.
- **Founder authorization (14 Oct).** The authorization:
  - authorizes indirect fence contact, limited to invalid-price handling and its regression tests;
  - forbids direct fenced-file edits;
  - chose variant B over the daily-close fallback, superseding the earlier instruction;
  - amended the acceptance rule to admit complete decimal numeric strings;
  - kept the non-200 fallback unchanged in this PR.
- **Fenced files.** None was edited. The new tests *call* these fenced functions, unmodified:
  - the `api/agent/decide.js` deploy endpoint (both paths), reaching `fetchValidatedStartingPrices`, the baseline gate and `createAgentBattle`;
  - `executeSwapServer` (`api/_utils/agentSwapExecution.js`);
  - `buildLiveContextBlock` (`api/_utils/agentEvalPromptAssembly.js`).
- **Evidence.**
  - `20261014_SHADOW_MISSING_CHECKS_DIAGNOSIS.md` (prior session).
  - The Phase 0 report `20261014_NA_QUOTE_FIX_PHASE0_DISCOVERY.md` (separate audit session). Its variant-B recommendation, consumer census and adjusted-close finding are used here as evidence and re-verified where cited.

## Verdict

| Question | Answer |
|---|---|
| What changed? | One non-fenced function, `fetchRealTimePrice` (`api/_utils/marketDataCache.js:792-831`), and a new helper, `toUsableQuotePrice` (`:739-769`). On an HTTP 200, the selected price must be a finite positive number or a complete decimal numeric string. Otherwise **no price is set**: `errors.price` is recorded and one sanitized line is logged. |
| Does a delisted symbol still start a battle? | **No.** On both deploy paths, the real endpoint now returns the existing `503 pricing_unavailable`, `retriable: true`. The lock is released and the cooldown restored, and no battle is created. This was proven with EQR's real body, WBD's shape and a malformed string. |
| What happens to valid quotes? | **Unchanged.** A numeric quote's payload is identical, field for field. An absent, null or zero `close` still selects a valid `previousClose`. |
| Consumers? | For an unusable quote only: the swap executor refuses (it used to commit `"NA"`), bench prompt construction renders `$0.00` (it used to throw), and daily scoring skips the symbol (0 points, as before). No consumer dereferences an absent price object. |
| Tests | 5 new files plus 1 fixture: 29 new rows. All 9 mutants are killed. Full Linux suite, `lint:gate` and `vite build`: §7. |
| Out of scope (separate tasks) | The non-200 fallback's adjusted-close risk (**urgent**, §8), universe hygiene, degraded-quote visibility, CPU sector selection, Cipher's timeouts. |

## 1. The contract (pinned before implementation)

In the 200 branch of `fetchRealTimePrice`:

1. **Selection order unchanged:** `selected = data.close || data.previousClose || 0` (`:799`).
2. **Validated before `result.price` is assigned** (`:800-805`). An unusable object is never left in place.
3. **Accepted values** (`toUsableQuotePrice`, `:762-769`):
   - a `number` that is finite and `> 0`, returned unchanged;
   - a string matching `^\d+(?:\.\d+)?$`, converted with `Number()`, and accepted if finite and `> 0`.
4. **Rejected values:**
   - `"NA"`;
   - malformed or partial strings (`"63.66junk"`, `" 63.66"`, `"63."`, `".5"`, `"1e3"`, `"+5"`, `""`);
   - zero, including `"0"` and `"0.00"`;
   - negatives;
   - non-finite values, including `1e400` in JSON;
   - booleans, arrays, objects and nullish values.
   - It deliberately does not reuse `toFiniteNumber` (`parseFloat`, which reads `"63.66junk"` as 63.66). The daily-bar helper is unchanged.
5. **On rejection:**
   - `result.price` stays absent;
   - `result.errors.price = 'Real-time price unavailable: the selected price is not a positive number'`;
   - one `console.warn` names the EODHD symbol and a bounded description of the value (≤16 characters of a string, JSON-escaped; never the URL, key or payload);
   - the function returns without entering the `catch`, so **no daily close is substituted**.
6. **Mixed price:** `close: "NA"` with `previousClose: 50` stays unavailable, because the selection picks `"NA"`.
7. **Non-200 or a throw:** unchanged. The newest daily close is used, marked `fallback: true` (`:819-831`).

## 2. The diff

| File | Change |
|---|---|
| `api/_utils/marketDataCache.js` | +59 / −2: `DECIMAL_PRICE_STRING`, `toUsableQuotePrice` (exported), `describeQuoteValue`, the docstring, and the validate-then-assign block in the 200 branch. |
| `api/_utils/__fixtures__/eodhdQuoteFixtures.js` | New. EODHD bodies from the 14 Oct probes, a `fetch` stub (key redacted in its call log), and a cache Firestore double. |
| `api/_utils/marketDataCache.realTimePrice.test.js` | New. The contract: 14 rows. |
| `api/agent/decide.invalidQuote.test.js` | New. Both deploy paths: 10 rows. |
| `api/_utils/agentSwapExecution.invalidQuote.test.js` | New. Swap executor: 3 rows. |
| `api/_utils/agentEvalPromptAssembly.invalidQuoteBench.test.js` | New. Bench prompt: 1 row. |
| `api/cron/agent-daily-scores.invalidQuote.test.js` | New. Daily scoring: 1 row. |
| `api/cron/agent-evaluate.test.js` | +4: the swap test file added to the allowlist of the "executeSwapServer has no consumers outside the fenced module" guard (`:869-887`), as a *test* consumer. This follows the C-2 and K3-7 entries beside it. No production call site is added. |

Every consumer row runs the **real** `getStockAnalysisData` over a stubbed network, so the producer's actual output meets the real consumer. Only the network, Firestore, auth and the model are doubles.

## 3. Consumers (fenced and not)

Behavior changes **only** for a 200 response whose selected price is unusable. All rows VERIFIED in this session.

| Consumer | Before | After | Evidence |
|---|---|---|---|
| Deploy, tiered (`decide.js:871`) and prescribed (`:1504`), via `fetchValidatedStartingPrices` (`:1096-1144`). **Fenced.** | `if (p?.current)` (`:1106`) passed the string. Guard 1 substituted a close and the gate admitted EA/AVB/EQR/WBD. | No price, so the symbol is absent. The gate (`:885-907`, `:1515-1529`) returns 503 `pricing_unavailable`, rolls back the cooldown and releases the lock. | `decide.invalidQuote.test.js` |
| Cron settlement guard M1 (`agent-evaluate.js:1128-1140`; `agentQuoteHealth.js:23-29`) | Refused: string `current` | Refused: no quote. The same `degraded_quotes` exit. | Unchanged outcome; code read |
| Swap executor (`agentSwapExecution.js:324-327`, `:417-420`). **Fenced.** | `getPrice` returned `"NA"`; `"NA" <= 0` is false, so the swap **committed** with `swapPrice: "NA"` | `getPrice` returns undefined, then `0`, and the swap is refused: "no valid price". Nothing is written. | `agentSwapExecution.invalidQuote.test.js` |
| Bench CSV in the eval prompt (`agentEvalPromptAssembly.js:1520-1534`). **Fenced.** | `"NA".toFixed` threw; the cron caught it as a model failure and the agent held | `0`, rendered as `$0.00`; the prompt builds | `agentEvalPromptAssembly.invalidQuoteBench.test.js` |
| Active-positions CSV (`agentEvalPromptAssembly.js:1492-1493`) | Not reached: M1 exits first for held symbols | Same | Code read |
| Daily scores (`agent-daily-scores.js:91-92`) | NaN priceChange; the scorer zeroes it, so 0 points | Skipped (`!priceData?.current`), so 0 points | `agent-daily-scores.invalidQuote.test.js` |
| Trigger gate bench scan (`agentTriggerGate.js:124-125`) | `"NA"` changePercent made NaN, so no trigger | `if (!benchPrice) continue`, so no trigger | Code read |
| `agent-batch-review.js`, `debate.js`, the dormant proposal fetch | `"NA"` reached a delta or prompt text | Absent | Phase 0 §2.3 census, re-read for the absent-object guard |

**Absent-object safety.** I searched `api/` (non-test) for a price object dereferenced without a guard (`prices[…].x`, `= prices[…];` then `.x`). Every alias reads through `?.` or an explicit `if (!x)` guard. The only unguarded `prices[...]` reads are daily-series arrays in the earnings helpers, which are unrelated to this function.

**Numeric strings (founder amendment).** A listed symbol whose `close` arrives as a decimal string now yields a numeric `current` everywhere. M1, which previously refused the string, now scores it. The deploy then stores a numeric baseline (`decide.invalidQuote.test.js`, "complete decimal string" row). No such body was seen in today's probes, so this is a contract change, not an observed one.

## 4. Indirect fence contact (disclosure, as authorized)

No fenced file is edited. For an unusable 200 quote only, three fenced decisions change through their existing branches:

1. `decide.js` refuses a deploy it used to admit (EA, AVB, EQR, WBD today).
2. `agentSwapExecution.js` refuses a swap it used to commit at `"NA"`.
3. `agentEvalPromptAssembly.js` renders `$0.00` where it used to throw.

For every numeric quote, the inputs reaching fenced code are identical. The scoring engine and the `createAgentBattle` document shape are untouched: a refused deploy creates no document.

## 5. Mutation check

Each mutant was applied to `marketDataCache.js` in an LF `git archive` of `1b86e651` (outside the worktree) and run against all five new files (29 rows). The file was restored and compared byte-for-byte afterwards.

| Mutant | What it does | Result | Rows that fail |
|---|---|---|---|
| BASE | unmutated | 29/29 pass | none |
| M0 | revert: `current = selected`, no validation | **killed** | 15, including both deploy paths (EQR + WBD), both swap refusals, the bench prompt and all producer rows |
| M1 | invalid value thrown into the existing catch (daily-close fallback) | **killed** | 7, including **daily scores** (AVB banks Bust/Crash/Meltdown), swap EQR (commits at the stale close) and the bench prompt |
| M2 | lenient string parsing (`parseFloat`, no complete-decimal check) | **killed** | 4: the acceptance matrix, the producer's malformed row, both deploy paths' malformed row |
| M3 | finite only (zero and negatives accepted) | **killed** | 3 producer/helper rows |
| M4 | strings refused (`typeof number` only) | **killed** | 4: the string-acceptance rows, including both deploy paths |
| M5 | `result.price` assigned before validation | **killed** | 13 |
| M6 | the diagnostic prints the whole raw value | **killed** | 1: the bounded-log row |
| M7 | look past a non-numeric close to `previousClose` (variant C) | **killed** | 8, including both deploy paths' WBD rows and the swap WBD row |
| M8 | the non-200 fallback removed | **killed** | 1: the unchanged-fallback pin |

Notes:
- The daily-scores row is deliberately killed by M1, not M0. A raw `"NA"` already scores 0 there; what that row guards against is the fallback substitution.
- The deploy rows' malformed-string case survives M0, because today's gate already refuses `"104junk"`: Guard 1 hands it through as a string, and the gate type-checks it. M2, M5 and M7 kill it.

## 6. Replays

- **EQR through the actual deploy guards.** `decide.invalidQuote.test.js` runs EQR's real all-`"NA"` body (captured 19:57 UTC) through the real endpoint on both paths. The result is 503 `pricing_unavailable`, `retriable: true`, `missingSymbols: ['JPM']` (the fixture symbol carrying the body), with:
  - `deployingAt: null`;
  - `lastDeployedAt` restored to the prior value (`2026-10-12T15:00:00.000Z`), which is the expected cooldown handling;
  - no `agentBattles` document;
  - no `activeBattleId`.

  The valid numeric control deploys one active battle with `startingPrices.JPM = 104`.
- **Live producer replay (read-only).** At 21:37 UTC, the patched `getStockAnalysisData` ran against today's real EODHD bodies, with its cache Firestore replaced by a no-op double, so there was no production write. The key was never printed.

  | Symbols | Result |
  |---|---|
  | K, MMC, CTRA, EA, AVB, EQR, WBD | **no price**, `errors.price` set. One warn line each, e.g. `Real-time price unavailable for EQR.US (selected string "NA"); no price set`; no line contains `api_token`. |
  | AAPL 342.96, MSFT 533.69, DE 650.81, AMAT 446.63, BTC 81854.46 | numeric prices as before |

## 7. Required checks

Linux (WSL Ubuntu), Node 20.20.2 / npm 10.8.2, `TZ=UTC`, CI-shaped `npm run test:run -- --maxWorkers=2`, in a private clone.

**First run, at the code head `1b86e651`:**

- **Full suite:** 969 files, **20,463 passed, 1 failed**, 88 skipped (668 s). The failure was the repo-level guard "executeSwapServer has no consumers outside the fenced module and this wrapped cron" (`api/cron/agent-evaluate.test.js:910` at the fix commit). The new swap test is a test consumer the guard did not list.
  - Fixed by one allowlist line with its reason (§2), the same mechanism as the C-2 and K3-7 test consumers.
  - The guard passes afterwards.
  - All 29 new rows passed in this run.
- **`npm run lint:gate`:** exit 0.
- **`npm run build` (vite):** exit 0 (3,964 modules). The CSS warnings are pre-existing.

**Final run, on the pushed head:** reported in the PR (suite, `lint:gate`, `vite build`).

**Review threshold (BUILD_RULES §2).** The branch diff is 9 files and about 960 lines, below the threshold (10 files or 1,500 lines). Mutation checks and `vite build` were still run.

## 8. URGENT separate follow-up: the non-200 fallback (unchanged here, as ruled)

On a non-200 response or a throw, `fetchRealTimePrice` substitutes the newest **adjusted** daily close with `fallback: true` (`marketDataCache.js:824-829`). The daily row's `close` is `adjusted_close || close` (`:318`), while every baseline is a raw close. The risk is pinned by the "non-200 keeps the existing fallback" row: AVB's adjusted 65.90 against a raw 184.0601.

Three consumers ignore `fallback: true`:

- **Daily scores** (`agent-daily-scores.js:91-121`) score `current` against the raw entry. A held symbol whose real-time call *fails* (non-200) on a day when raw and adjusted closes differ banks an invented move. For AVB that is −64%: Bust, Crash and Meltdown, −65 points. Mutant M1 reproduces exactly this.
- **The swap executor** (`agentSwapExecution.js:324-327`, `:417-420`) commits a swap-in at the stale adjusted close.
- **The bench CSV and trigger scan** render or act on it as a live price.

**Reachability.** It is reachable today for any symbol on any provider error; it does not need a delisting. Recommended next task: make the non-200 fallback use `rawClose`, or have these consumers honor `fallback: true`. Either one touches fenced consumers or the scoring path, so the founder must rule.

## 9. Swap-validation gap (reported to the separate audit)

`agentSwapExecution.js:417-420` refuses only `swapPrice <= 0`, and a non-number passes (`"NA" <= 0` is false). This fix removes the producer that emitted non-numbers on a 200, so the executor now sees either a number or nothing. The executor itself still has no type check: any other source of a non-number would commit. None of the six call sites checks the incoming quote (Phase 0 §6; the per-site sources were graded ASSUMED there). This is fenced, so it is not changed here.

## 10. Unchanged and out of scope

- **Not in this PR:** universe hygiene (F-A), degraded-quote visibility (F-B), the CPU sector name, Cipher's SDK timeouts. Each is in its own task.
- **Shadow** (`vwuCEjUrWwSzufOio18J`) was voided at 20:55 UTC on 14 Oct with the record untouched. It is not affected by this change.
- **Already-active battles** holding a stale symbol still exit at M1 every tick; that is unchanged.

## 11. Production validation (after merge and confirmed deploy)

Crons do not run on preview (BUILD_RULES §6), so preview testing cannot verify the cron.

1. **First check.** During market hours, deploy one new BaggerBomb game and confirm its first scheduled check lands: `scoreState.lastScoredAt` is set, and the tick capture shows `exitReason: completed` (or a gameplan exit) at the first quarter-hour slot.
2. **Logs.** Expect `[MarketDataCache] Real-time price unavailable for <SYM>.US …` for stale symbols. A deploy that draws EA/AVB/EQR/WBD logs `[agent/decide] [baseline-gate] … missing=<SYM>` and returns 503.
3. **Census (read-only).** No new active battle whose ticks all exit `degraded_quotes`.
