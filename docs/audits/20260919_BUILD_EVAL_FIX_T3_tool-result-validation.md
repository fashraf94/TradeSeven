# Build report — T3 `fix/eval-tool-result-validation`

**Date:** 2026-09-19 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Source ruling:** adjudication V1.1 P-3 (`docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md`)
**Branch:** `fix/eval-tool-result-validation`, cut fresh from `main` @ `6cd3699a` · **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run as the session's first step; `origin/main` == local HEAD `6cd3699a` (0 ahead / 0 behind); tree clean at cut. `npm ci` run (dependencies were absent). The Sep 19 audit's anchors are from `5ba40661`, two commits behind HEAD — every line below was re-located and is **VERIFIED** in this session.

---

## Executive verdict

| | |
|---|---|
| **The bug** | The evaluator accepted any tool result whose `decision` was *a string* — so a decision outside the enum, a SWAP naming no tickers, and a missing or non-numeric `conviction` all reached the trading pipeline. |
| **Why it mattered** | A missing/non-numeric `conviction` also **slipped the platform's `conviction < 70` floor**, because `undefined < 70` and `'high' < 70` are both `false`. The one check meant to stop a low-confidence trade could not see the field at all. |
| **The fix** | The result goes through **schema-driven validation of top-level fields, with the disclosed relaxations, before anything reads it** *(wording corrected Sep 20 2026, Astra review — it was "full schema", which is literally wrong; the three relaxations are listed in §6.3)*. Invalid → fail-closed HOLD, category `invalid_tool_result`, the failing field named on the record. Nothing repaired, defaulted, or retried. |
| **Blast radius** | 2 new files, 3 modified. The normal path is **byte-identical** to the pre-fix golden (asserted, not asserted-by-absence). |
| **Failing-file set** | **Unchanged from the gate: empty.** 22 → 23 files, 298 → 307 passing, 2 skipped. |
| **Verdict** | **DONE.** Pushed, not merged. One founder-visible decision is flagged below (§6). |

---

## 1. What changed

### New — `api/_utils/agentEvalToolResultValidation.js` (131 lines)
`validateTradeToolResult(input)` → `{ valid, invalidField, reason }`. Rules are **read off `TRADE_DECISION_TOOL.input_schema` at call time**, never transcribed, so a schema change cannot leave a stale hand-copied rule list behind. The schema module is **imported and not edited** (BUILD_RULES §1 permits reading; the tool schema is frozen for this build regardless — no fenced file was edited by this task).

Check order — and the order matters, because the first failure is the one recorded:
1. `input` is a plain object (else `invalidField: 'input'`)
2. every name in the schema's machine-readable `required` array is present and non-null
3. every present top-level property matches its declared `type`, `enum`, `minimum`, `maximum`
4. `decision === 'SWAP'` ⇒ `symbolOut` **and** `symbolIn` are non-empty strings

### Modified — `api/cron/agent-evaluate.js` (+46 / −8)
| Line | Change |
|---|---|
| `:39` | import the validator |
| `:2011` | `let holdKind = null` — declared beside `haikuFailure` |
| `:2047`, `:2207` | `holdKind = 'default_failure'` on the budget-skip and transport-failure fallbacks |
| `:2160-2186` | **the fix** — validate before anything reads the result; the three-way branch below |
| `:2959` | `holdKind` composed onto the evaluation record, **last** |

The parse site is now three-way rather than two-way:

| Response | Category | Notes |
|---|---|---|
| valid tool result | *(none)* | `haikuResult = toolUse.input` — unchanged |
| tool_use block **absent** | `truncated_response` | **unchanged**, same message. See §6.1. |
| tool_use block present, schema-invalid | **`invalid_tool_result`** | `+ invalidField` |

### Modified — test pins, reconciled in this same commit
* `api/_utils/__fixtures__/tickStampsHarness.js` — new `FAIL_CLOSED_ENTRY_KEYS = ['holdKind']`, appended to `BASE_ENTRY_KEYS`. **`PRE_PHASE_B_ENTRY_KEYS` is untouched** — it is frozen history bound to `tickStampsEntryGolden.flagOff.json`, and `holdKind` is composed *last* in the entry literal precisely so that golden keeps matching byte-for-byte.
* `api/cron/agent-evaluate.tickStamps.flagOff.test.js` — the "non-pre-Phase-B keys" pin now reads `[...TIMING_ENTRY_KEYS, ...FAIL_CLOSED_ENTRY_KEYS]`, plus a row asserting a chosen HOLD carries `holdKind: null`.

Reconciling both in the same commit follows the BUILD_RULES §2 flag-pin precedent: a pin left behind reddens CI on every other open PR.

---

## 2. Ordering — the point of the task

The `conviction < 70` rejection lives in the **fenced** `agentSwapExecution.js:77` (`validateTradeDecision`), reached far downstream. Validation now runs at `:2160`, at the parse site. A missing `conviction` therefore **fails validation instead of slipping past the floor**. The floor itself is untouched; the fenced module is neither edited nor doubled in the new tests, so the ordering under test is the production ordering.

---

## 3. Tests added — `api/cron/agent-evaluate.toolResultValidation.test.js` (216 lines, 9 rows)

The seam is the **real `processAgentBattle`** on the shared tick harness, with only I/O collaborators doubled. `executeSwapServer` is doubled so *"no swap was attempted"* is an observation, not an inference.

**Five failure kinds**, each asserting HOLD + `invalid_tool_result` + the named field + `holdKind: 'default_failure'` + **no swap attempted** + exactly one model call (never a retry) + the fallback rationale (nothing repaired):

| Row | Shape | `invalidField` |
|---|---|---|
| bad enum | `decision: 'SELL'` | `decision` |
| missing pair field | SWAP, no `symbolIn` | `symbolIn` |
| missing conviction | SWAP, no `conviction` | `conviction` |
| non-numeric conviction | `conviction: 'high'` | `conviction` |
| parse error | tool input is a string, not an object | `input` |

**Four guarding the other direction:** a valid SWAP still executes (`executeSwapServer` called once, `summary.swapped === 1`, no failure record); the **no-regression row** — a valid HOLD's 25 pre-Phase-B keys serialize byte-identically to the pre-fix golden, *plus* an anti-vacuity assertion that `holdKind` is present-and-null so the byte match cannot pass by the field having silently vanished; an absent tool_use block still records `truncated_response`; and an explicit anti-vacuity row on `undefined < 70 === false`.

### Mutation check (BUILD_RULES §2 — "a row that cannot fail under the defect it names is not a guard")
The **entire pre-fix block** was restored and the suite re-run: **all 5 failure rows go red**, 4 pass. Restored, re-verified green. A narrower mutation (predicate only) reddened 4 of 5 — the parse-error row needs the full block, which is why the faithful mutation was used.

---

## 4. Verification

| Check | Result |
|---|---|
| `npx vitest run api/cron/agent-evaluate api/_utils/agentGuardrails` | **23 files passed, 307 passed / 2 skipped** |
| Failing-file set vs. gate | **unchanged — empty** |
| `npx eslint` on all 5 touched files | 3 errors in `agent-evaluate.js`, **all pre-existing** (`getPresetAdjustedStrategies`, two `_e`) — confirmed identical at HEAD via `git stash`. New files lint clean. |
| Repo-level `executeSwapServer` call-site census | **still passes with its allowlist untouched** — the new suite assigns the mock by reference (`executeSwapServerMock`) so the literal `executeSwapServer(` never appears outside a comment. The census was not weakened to accommodate this build. |
| BUILD_RULES §2 review threshold (≥10 files / ≥1500 lines) | **not reached** — 6 files incl. this report, 552 insertions. `vite build` not required and not run. |

Linux is the suite of record; no Windows run was performed.

---

## 5. Fence & scope compliance

* **No fenced file edited.** `agentEvalToolSchema.js` is not on the §1 fence list, and was read-only regardless (the prompt freezes the schema).
* `agentSwapExecution.js`, `agentGuardrails.js`, `agentEvalPromptAssembly.js` — untouched.
* No scoring semantics, guardrail precedence, LOCK behavior, or tool-schema change. **No new flag** — this is a correctness fix to reachable code.
* Anything executed earlier in the tick is untouched: this fix only ever converts an unusable *model proposal* into a HOLD.

---

## 6. Founder-visible decisions (three; all deliberate, none silent)

**6.1 `truncated_response` kept for an absent tool_use block.** The prompt lists "parse error" among the failure kinds. An absent block is a *different, already-instrumented* fact (max_tokens truncation mid-JSON), and folding it into the new class would destroy that signal. `invalid_tool_result` therefore means **a block arrived and failed the schema**; the "parse error" row is a block whose `input` is not an object. Both are asserted.

**6.2 `holdKind` is a NEW FIELD, stated as the prompt requires.** `grep holdKind` across the repo returned **zero hits** — no kind field existed, so this is the single new field the prompt's common rules permit, not a new value. `null` on a chosen HOLD (which "keeps whatever it writes today"), `'default_failure'` on every fallback HOLD. Its sibling `haikuError.failureClass` still says *which* failure; `holdKind` says the decision was not the model's.

**6.3 Two relaxations, chosen to avoid widening the fix into a behavior change.** Both are documented in the module header:
* `conviction` is declared `integer`; the validator accepts any **finite number** in range. The prompt's requirement is "present and numeric", and rejecting `72.5` would turn a decision the platform floor accepts today into a HOLD.
* **Top-level properties only.** Nested `anticipationCandidates` rows are already dropped individually by their consumers; promoting a droppable narration row into a whole-tick HOLD would be wider than the defect.
* Related: `swap_type` is type/enum-checked when present but **not required** — only its prose description says "Required if SWAP"; the machine-readable `required` array omits it, and requiring it would reject SWAPs the pipeline executes today.

**One live finding the test suite caught, worth recording:** the first draft rejected `null` on an optional property, because the schema types `pvp_context` as a bare `string` while the eval fixtures' own valid HOLD sends `pvp_context: null`. Shipping that would have converted ordinary production ticks into HOLDs. The rule is now: on an *optional* property, `null` means "not provided" (a `null` in a *required* slot is still a failure, caught one step earlier). This is exactly the class of over-strictness the no-regression row exists to catch.

---

## 7. `git diff --stat`

```
 api/_utils/__fixtures__/tickStampsHarness.js       |  14 +-
 api/_utils/agentEvalToolResultValidation.js        | 131 +++++++++++++
 api/cron/agent-evaluate.js                         |  54 +++++-
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |   8 +-
 .../agent-evaluate.toolResultValidation.test.js    | 216 +++++++++++++++++++++
 ...919_BUILD_EVAL_FIX_T3_tool-result-validation.md | 137 +++++++++++++
 6 files changed, 552 insertions(+), 8 deletions(-)
```

Only the fix, its tests, the two pin reconciliations it forces, and this report.

**STOP.** T3 complete. Next: T4 `fix/news-seen-after-success`.
