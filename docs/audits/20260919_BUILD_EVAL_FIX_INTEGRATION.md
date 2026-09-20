# Integration report — composing T3 + T2 + T4 (+R-A) + T1

**Date:** 2026-09-19 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Branch:** `claude/eval-small-fixes-integrate-or1aqn`, cut from `main` @ `6cd3699a` · **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run as the session's first step. `origin/main` == `6cd3699a220aacd5c8669ac2aade6d91216da5b1` — **it has not moved past the gate SHA**. The container's local `main` was stale at `398c528e`; it was verified to be a strict ancestor of `origin/main` and fast-forwarded, so every `git diff main` below is against the real base. `npm ci` run (dependencies were absent). Every anchor cited here was read in this session at the composed HEAD and is **VERIFIED**.

---

## Executive verdict

| | |
|---|---|
| **What this was** | Compose four independently-built, independently-reviewed fix branches onto one branch, resolving only the conflicts the prompt named, plus one ruled change (R-A) and one test row. |
| **Merges** | Four, in the prescribed order. **T3 and T1 merged with zero conflicts.** T2 raised three, T4 raised one. |
| **Every conflict was comment prose or an import line** | Not one required choosing between behaviours. Every executable line either auto-merged identically or was a mechanical union of two import lists. **No STOP condition was reached.** |
| **R-A** | The seen-story success predicate is now `Boolean(haikuResult)` alone. Behaviour-preserving at HEAD; it removes a latent coupling between T4's predicate and T2's late `haikuFailure` write. |
| **Full suite** | `npx vitest run`, whole repo, **exit code 0**. 724 files passed / 3 skipped; 13 893 passed / 64 skipped. **Failing-file set equals the gate's: EMPTY.** |
| **`vite build`** | **exit code 0**, built in 18.47 s. Required — the composed diff exceeds BUILD_RULES §2's review threshold. |
| **Fence (§1)** | **No fenced file changed.** Verified mechanically against all eleven fence-list paths. |
| **Regional guards** | All three pass, with their goldens and allowlists **untouched**. |
| **Verdict** | **DONE.** Pushed, not merged. Three founder-visible items in §8 — one of them (§8.3) is a BUILD_RULES §2 disclosure the founder should read before treating this branch as reviewed. |

---

## 1. The gate (read-only) — all three lines passed

| Gate line | Measurement | Result |
|---|---|---|
| `origin/main` has not moved past `6cd3699a` | `git rev-parse origin/main` → `6cd3699a220aacd5c8669ac2aade6d91216da5b1` | **PASS** — exactly the gate SHA |
| The four branches still merge cleanly | merge-base of each with `origin/main` == `6cd3699a` for all four | **PASS** — all four cut fresh from the same commit, none stacked |
| Baseline on clean `main` | `npx vitest run api/cron/agent-evaluate api/_utils/agentGuardrails api/_utils/agentTriggerGate` | **22 files passed, 298 passed / 2 skipped, exit 0** |
| Baseline, whole repo *(added — see §8.2)* | `npx vitest run` | **720 files passed / 3 skipped, 13 863 passed / 64 skipped, exit 0** |

**Failing-file set at the gate: EMPTY**, on both measurements.

### Branch HEADs confirmed

| Task | Branch | HEAD |
|---|---|---|
| T1 | `fix/eval-tick-coherence` | `9d06c0fde73c5f6c0dec63c4585fe01e036fa864` |
| T2 | `fix/guardrail-error-fail-closed` | `96a0adc75367837aa449019a21641944c1d3baa2` |
| T3 | `fix/eval-tool-result-validation` | `9dadebcf86d8b8643e0018c23a272666c7271b87` |
| T4 | `fix/news-seen-after-success` | `0c103db9102e04b900d6b58bee7a528c9e4a726d` |

All four build reports and `docs/BUILD_RULES.md` §1–§3 were read before the first merge.

---

## 2. Merge order and outcome

| # | Task | Merge commit | Conflicts |
|---|---|---|---|
| 1 | T3 `fix/eval-tool-result-validation` | `4f8be4db` | **none** |
| 2 | T2 `fix/guardrail-error-fail-closed` | `985206e8` | **3** — all comment prose (§3.1–§3.3) |
| 3 | T4 `fix/news-seen-after-success` (+ R-A) | `6db8226f` | **1** — one import line (§3.4) |
| 4 | T1 `fix/eval-tick-coherence` | `8b4e45d1` | **none** |

Each merge used `--no-ff`, so the four merges stay individually legible in history rather than collapsing into a fast-forward.

---

## 3. Every conflict, and how it was resolved

The prompt named three expected T2 conflicts: the `holdKind` declaration, its last-position composition onto the evaluation record, and `FAIL_CLOSED_ENTRY_KEYS` in the harness. **Two of those three never conflicted at all** — T2 and T3 wrote the executable lines byte-identically, exactly as T2's build report §6.1 predicted they would, so git's `ort` strategy merged them silently. What conflicted was the *prose around* them.

Line numbers below are at the composed HEAD.

### 3.1 The `holdKind` declaration — `api/cron/agent-evaluate.js:2079-2087`

**Conflict:** docstring only. The declaration itself, `let holdKind = null;` (`:2087`), was identical on both sides and auto-merged; git conflicted on the eight comment lines above it, because T3 enumerated its causes ("transport failure, budget skip, unusable or schema-invalid tool result") while T2 wrote the general "or could not be safely evaluated".

**Resolution:** one copy, carrying **both** causes — the composed tree has all four fallback branches, so a docstring naming only one side would be false. It now reads "the proposal was never usable (transport failure, budget skip, unusable or schema-invalid tool result), **or could not be safely evaluated (the guardrail evaluator threw)**", and cites both the T3 and T2 build reports rather than one.

**One copy of the declaration:** `grep -c` → exactly one `let holdKind = null;` at `:2087`.

### 3.2 The last-position composition — `api/cron/agent-evaluate.js:3155`

**No conflict.** Both branches appended the identical `holdKind,` in the identical last position of the `const evaluation = {…}` literal, so it auto-merged to one copy. Verified: exactly one occurrence, at `:3155`, still last in the literal — which is what keeps the frozen `PRE_PHASE_B_ENTRY_KEYS` golden matching byte-for-byte (§6.1).

### 3.3 `FAIL_CLOSED_ENTRY_KEYS` — `api/_utils/__fixtures__/tickStampsHarness.js:77-85`

**Conflict:** docstring only, same shape as §3.1. `export const FAIL_CLOSED_ENTRY_KEYS = Object.freeze(['holdKind']);` (`:85`) and the `BASE_ENTRY_KEYS` composition (`:88-90`) were identical on both sides and auto-merged.

**Resolution:** T2's wording, which already covers both causes ("never usable **or could not be safely evaluated**"), minus T3's task-specific `(T3)` tag — both tasks contribute the field, so attributing it to one would be wrong. The same single-line prose conflict recurred on the pin that reads the constant, `api/cron/agent-evaluate.tickStamps.flagOff.test.js:191`, and was resolved the same way. The assertion itself (`:195`) auto-merged.

### 3.4 The import line — `api/cron/agent-evaluate.js:39-40`

**Conflict:** T3 inserted its validator import immediately above the `agentTriggerGate.js` import; T4 extended that same `agentTriggerGate.js` import with two new named exports. Adjacent-line edit, mechanical.

**Resolution:** the union, both lines kept:

```js
import { validateTradeToolResult, INVALID_TOOL_RESULT_CLASS } from '../_utils/agentEvalToolResultValidation.js';
import { evaluateTriggers, fetchRecentNews, MAX_STORY_WAKE_ATTEMPTS, SEEN_STORY_ID_CAP } from '../_utils/agentTriggerGate.js';
```

### 3.5 T1 — no conflicts

The prompt anticipated "line moves in the handler". None materialised: T1's rebuild block (`:1882`) sits above everything T2/T3/T4 touched, and its snapshot-variable changes are in a region none of the other three edited. `git merge` reported `Merge made by the 'ort' strategy` with no conflict.

### Both assignment sets survive — verified individually

The prompt requires T3's assignments *and* T2's to survive the composition. All five sites are present, each on its own branch of the handler:

| Line | Branch of the handler | From |
|---|---|---|
| `:2123` | budget skip | T3 |
| `:2246` | `truncated_response` (tool_use block absent) | T3 |
| `:2257` | `invalid_tool_result` (block present, schema-invalid) | T3 |
| `:2283` | transport / build failure catch | T3 |
| `:2594` | guardrail downgrade, gated on `heldProposal` | T2 |

---

## 4. R-A — the success predicate

### The change — `api/cron/agent-evaluate.js:2336`

```diff
-      const haikuCallSucceeded = Boolean(haikuResult) && !haikuFailure;
+      const haikuCallSucceeded = Boolean(haikuResult);
```

with the comment above it rewritten (`:2304-2324`) to say why.

### Why it is behaviour-preserving at HEAD — checked, not assumed

T4 wrote `&& !haikuFailure` defensively against a `main` whose parse check was only *"input exists and `decision` is a string"* — on that tree a response could be accepted and still be junk. **T3, landing in this same composition, closed that at the source.** At `api/cron/agent-evaluate.js:2236-2238`, `haikuResult` is assigned on exactly one branch — `validation.valid` — and that assignment is the **last statement in the `try`**, so nothing between it and the catch can throw. Therefore, at the predicate's line, a truthy `haikuResult` already means *"passed the full schema and was accepted"*, and none of the four failure classes that can exist at that point can coexist with it. The dropped clause was redundant.

Confirmed by measurement, not only by reading: **mutation M2 below restores the old predicate and the whole suite stays green.**

### Why it was dropped rather than left as belt-and-braces

The clause is not inert prose — it binds this predicate to `haikuFailure`, which **T2 also writes, far below this block** (`:2603-2608`, the `guardrail_error` catch), for a fault that has nothing to do with the model call. At HEAD the bookkeeping block runs strictly *before* that catch, so the coupling cannot bite today. But it means a future move of either block would silently start burning a story's wake attempt on a tick whose call succeeded **and was evaluated** — the exact defect T4 exists to prevent, reintroduced through the back door. Binding the predicate to the handler's own acceptance makes it independent of which faults the rest of the tick goes on to record.

### The test row — `api/cron/agent-evaluate.newsSeenAfterSuccess.test.js:243-290`

One row, as prescribed: a valid tool result followed by a guardrail evaluator that throws.

* The model returns a schema-valid **SWAP** proposal (`makeSwapResult()`), so the row exercises the stronger case — a *fallback* HOLD (`holdKind: 'default_failure'`) whose story is nonetheless marked seen. A chosen HOLD would satisfy the prompt's letter but would leave `holdKind` null and lock nothing interesting.
* Asserts: `news_catalyst` fired; the model was called **exactly once** and answered (anti-vacuity); `decision === 'HOLD'`; `haikuError.failureClass === 'guardrail_error'`; `holdKind === 'default_failure'`; **`seenStoryIds === [STORY_ID]`**; and **no `storyAttempts` and no `seenStoryReasons` key is written at all**.
* Plumbing added with it: a hoisted `guardrailState`, a double of the **fenced** `agentGuardrails.js` that delegates to the real module whenever `throws` is null (doubled in tests only, never edited), a `guardedBattleWithHistory()` helper — `applyGuardrails` is skipped entirely on an empty guardrail array, so the battle must carry one — and a `guardrailState.throws = null` reset in `beforeEach`, so every pre-existing row still runs production `applyGuardrails`.

**The existing failure row is kept unchanged** (`:145-161`): a failed call leaves the story unseen and counts an attempt, and the next tick re-wakes on the same story. See §8.1 for a discrepancy in how the prompt describes that row.

### Mutation check (BUILD_RULES §2) — reported honestly

| # | Mutation | Result |
|---|---|---|
| **M1** | `haikuCallSucceeded = false` | **RED** — the new row fails, with the pre-existing success row. The row is not vacuous. |
| **M2** | restore T4's `Boolean(haikuResult) && !haikuFailure` | **GREEN** |
| **M3** | M2's predicate **and** the bookkeeping block relocated below the guardrail catch | **RED — and the new row is the only failure**: `expected undefined to deeply equal [ 'story-nvda-catalyst-1' ]`. The story's id was never written. |
| **M3b** | the same relocation, with R-A's predicate | **GREEN** |

**M2 is the honest limit, stated rather than dressed up.** §2 says a row that cannot fail under the defect it names is not a guard — so this row is named for what it is: **a lock on a composed behaviour, not a defect guard.** R-A changes no outcome at HEAD, and the row is green with or without it. What M3/M3b demonstrate is the thing the lock exists for: the coupling is real, it is R-A that removes it, and the relocation alone does not.

---

## 5. Verification of the composition

| Check | Command | Result |
|---|---|---|
| **Full suite** | `npx vitest run` (whole repo) | **exit code 0** · 724 files passed / 3 skipped (727) · 13 893 passed / 64 skipped (13 957) |
| **Failing-file set** | vs. the gate | **EQUAL — empty** |
| **`vite build`** | `npx vite build` | **exit code 0**, built in 18.47 s. Only the pre-existing >500 kB chunk advisory; no error. |
| **eslint** | on all five changed source files | **5 errors, every one pre-existing** — 3 in `agent-evaluate.js` (`getPresetAdjustedStrategies`, two `_e`), 2 in `agentTriggerGate.js` (`flattenPortfolioServer`, `dayProgress`). Confirmed identical by linting a `git archive main` snapshot: same five, same names, line numbers drifted only. The new module and the new test rows lint clean. |

Output was redirected to a file rather than piped, so `$?` is vitest's own exit status and cannot be masked by a pipeline's last stage.

**Delta vs. the whole-repo baseline: +4 test files, +30 tests** — exactly the four new suites (9 + 5 + 8 + 8 rows), where the 8 in `newsSeenAfterSuccess` is T4's 7 plus the R-A row. Nothing else moved.

Linux is the suite of record; no Windows run was performed.

---

## 6. The three regional guards

| Guard | Evidence | Result |
|---|---|---|
| **`PRE_PHASE_B_ENTRY_KEYS` golden untouched** | `api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json` **does not appear in the composed diff**. The harness diff begins *below* the frozen array — the only changes are the appended `FAIL_CLOSED_ENTRY_KEYS` (`:85`) and the `BASE_ENTRY_KEYS` composition (`:88-90`). The byte-comparison row *"the entry AND the whole finalUpdate are byte-identical to the golden captured before the stamp code existed (keys, order, bytes)"* passes, as does its anti-vacuity row asserting the golden holds all 25 keys and a real HOLD. | **PASS** |
| **`executeSwapServer` call-site census, allowlist untouched** | `api/cron/agent-evaluate.test.js` — which is where the five-entry allowlist lives — **does not appear in the composed diff**, so the allowlist cannot have been widened to accommodate this build. The row *"REPO-LEVEL: `executeSwapServer` has no consumers outside the fenced module and this wrapped cron"* passes. The R-A row adds no reference to the symbol in any form. | **PASS** |
| **Assembly honesty tripwire** | `api/_utils/agentEvalPromptAssembly.honesty.test.js` passes in full, including the import-classification row *"every fenced-assembler local import is classified — a new prose module cannot skip the sweep"* and the source-level sweep across every `PROMPT_CONTRIBUTING_MODULE`. | **PASS** |

Run together: **3 files, 108 tests, all passing, exit 0.**

**T1's no-swap golden still matches byte-for-byte after composition** — `api/cron/agent-evaluate.tickCoherence.test.js` passes all 8 rows, including *"a tick with NO forced swap → the prompt is byte-identical to the pre-fix snapshot"* and the anti-vacuity row proving that golden is a real live-context block holding all seven original names.

---

## 7. Scope of the composed diff

### `git diff main --stat`

```
 .../tickCoherenceLiveContextGolden.noSwap.txt      |  75 +++++
 api/_utils/__fixtures__/tickStampsHarness.js       |  15 +-
 api/_utils/agentEvalToolResultValidation.js        | 131 +++++++++
 api/_utils/agentTriggerGate.js                     |  19 ++
 ...agent-evaluate.guardrailErrorFailClosed.test.js | 228 +++++++++++++++
 api/cron/agent-evaluate.js                         | 284 +++++++++++++++++--
 .../agent-evaluate.newsSeenAfterSuccess.test.js    | 290 +++++++++++++++++++
 api/cron/agent-evaluate.tickCoherence.test.js      | 310 +++++++++++++++++++++
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |   8 +-
 .../agent-evaluate.toolResultValidation.test.js    | 216 ++++++++++++
 ...260919_BUILD_EVAL_FIX_T1_eval-tick-coherence.md | 137 +++++++++
 ...UILD_EVAL_FIX_T2_guardrail-error-fail-closed.md | 128 +++++++++
 ...919_BUILD_EVAL_FIX_T3_tool-result-validation.md | 138 +++++++++
 ...19_BUILD_EVAL_FIX_T4_news-seen-after-success.md | 131 +++++++++
 14 files changed, 2085 insertions(+), 25 deletions(-)
```

*(plus this report, the 15th file, added in the commit that carries it.)*

### It is exactly the union, and nothing else

The union of `git diff main --name-only` over the four branches was computed and diffed against the composed branch's: **IDENTICAL, 14 files each.** The only content in the composed tree that is not in one of the four branches is:

* the R-A predicate and its comment — `api/cron/agent-evaluate.js:2304-2336`;
* the R-A test row and its plumbing — `api/cron/agent-evaluate.newsSeenAfterSuccess.test.js`, 213 → 290 lines;
* the four conflict resolutions of §3, all of them comment prose or one import line;
* this report.

### Fence compliance (BUILD_RULES §1)

All eleven fence-list paths were checked mechanically against `git diff main --name-only`. **Not one appears.** `agentGuardrails.js` and `agentEvalPromptAssembly.js` are *called* and, in tests only, *doubled* — never edited. `agentSwapExecution.js` is neither edited nor doubled by anything this composition adds.

---

## 8. Founder-visible items

**8.1 The prompt describes the row to keep as an `invalid_tool_result` row; in the file it is a transport timeout.** The prompt says: *"Keep the existing row showing an `invalid_tool_result` leaves the story unseen and counts an attempt."* The existing row in `agent-evaluate.newsSeenAfterSuccess.test.js:145` drives its failure with an `APIConnectionTimeoutError`, not a schema-invalid tool result — T4 was cut from `main`, where T3's `invalid_tool_result` class did not yet exist. **I kept that row exactly as it is and added nothing**, because the prompt sanctions one added row and "no other edits". The contract it proves is the right one and it still holds; it simply proves it for the transport class. Post-composition, an `invalid_tool_result` also leaves the story unseen and counts an attempt — `haikuResult` stays null on that branch — but **no row asserts it.** If you want that coverage it is a one-row follow-up, and it is a genuine guard rather than a lock. Flagged rather than silently added or silently ignored. **RESOLVED — see §10: the row was commissioned and added.**

**8.2 The gate prescribed a three-path baseline; step 2 compares the whole repo against it.** Those measure different sets, so a whole-repo baseline on clean `main` was taken as well (§1). Both are empty, so the comparison is sound either way — but had the repo carried a pre-existing failure outside the three paths, the prescribed comparison would have charged it to this composition. Recorded so the next integration takes both baselines by default.

**8.3 BUILD_RULES §2's review threshold is MET, and the review it mandates was NOT run in this session.** The composed branch diff is **14 files / 2110 lines**, past both limbs of the ≥10 files OR ≥1500 lines threshold. §2 requires, at that threshold, a multi-lens adversarial review whose findings are independently verified by reviewers instructed to refute them, with the CONFIRMED/REFUTED split written down. **This prompt scoped the session to composition, `vite build`, and this report — the build was run and is recorded (§5); the adversarial pass was not.** §2 itself requires saying so explicitly rather than reporting the review as done, which is what this paragraph is. Two mitigating facts, offered as context and not as a substitute: each of the four constituent branches arrived with its own build report and its own mutation check, and the net-new content beyond those four reviewed branches is small and enumerated in §7 (one predicate, one comment, one test row, four prose resolutions). **The decision on whether to commission the §2 review before merging is yours.**

**8.4 Branch name.** The prompt names the integration branch `fix/eval-small-fixes-integrate`. The execution harness designated `claude/eval-small-fixes-integrate-or1aqn` and forbids pushing anywhere else. That branch already existed at `origin/main` @ `6cd3699a` with no commits of its own, so it *is* a branch cut from `main` as the prompt requires, and the work was done there. Only the name differs.

---

## 9. Composed branch HEAD

| | |
|---|---|
| **Branch** | `claude/eval-small-fixes-integrate-or1aqn` |
| **Composition HEAD** | `8b4e45d1` — the T1 merge. **Every measurement in this report was taken at this commit**, on a clean tree. |
| **Branch tip** | the commit carrying this report, which sits directly on `8b4e45d1` and changes no file but this one. Its SHA cannot be printed inside itself; read it with `git rev-parse claude/eval-small-fixes-integrate-or1aqn`. |
| **Base** | `main` @ `6cd3699a220aacd5c8669ac2aade6d91216da5b1` |
| **Commits ahead of `main`** | 5 — four `--no-ff` merges (`4f8be4db` T3, `985206e8` T2, `6db8226f` T4+R-A, `8b4e45d1` T1) plus this report |

---

## 10. Follow-up — the `invalid_tool_result` row (§8.1, commissioned)

Added on the same branch, at founder request, after the composition was pushed. **One row, nothing else.**

### The row — `api/cron/agent-evaluate.newsSeenAfterSuccess.test.js:163-194`

*"a SCHEMA-INVALID tool result leaves the story unseen and opens an attempt."* The model returns `makeHoldResult({ decision: 'SELL' })` — a decision outside the tool schema's enum, delivered over a perfectly healthy transport — and the row asserts:

* `news_catalyst` fired, and the model was called **exactly once** (the handler never retries a malformed result);
* `decision === 'HOLD'`, `haikuError.failureClass === 'invalid_tool_result'`, `haikuError.invalidField === 'decision'`, `holdKind === 'default_failure'`;
* **`seenStoryIds` is not written at all** — the story is not burned;
* **`storyAttempts === { [STORY_ID]: 1 }`** — one attempt opened against it;
* `seenStoryReasons` not written.

`invalidField` is what does the real work in that list: it is the one assertion the transport-timeout row above cannot satisfy, so it proves this row failed on the **schema** rather than on the wire. Without it the row would merely restate its neighbour.

### Why this one IS a guard, where the R-A row (§4) is a lock

This row closes the gap §8.1 named. `invalid_tool_result` arrives as an HTTP 200 with a `tool_use` block present — the exact shape T4's *"success is narrower than 200"* contract exists for, and the only failure class T4 could not reach, because on `main` a result was accepted on "input exists and `decision` is a string" and this class did not yet exist.

**Mutation check (BUILD_RULES §2):** the predicate was forced to `const haikuCallSucceeded = true;` — the defect the row names, a failed call marking its story seen. **The row goes RED**, on the assertion that matters: `expected [ 'story-nvda-catalyst-1' ] to be undefined` at `:191`. Two neighbouring rows go red with it (the transport-timeout row and the attempts-exhausted row), which is correct — they assert the same contract for other classes. Restored and re-verified green. Unlike §4's R-A row, **this row can fail under the defect it names, so it is a guard.**

### Verification

| Check | Command | Result |
|---|---|---|
| The two files named in the request | `npx vitest run api/cron/agent-evaluate.newsSeenAfterSuccess.test.js api/cron/agent-evaluate.tickStamps.flagOff.test.js` | **exit code 0** · **2 files passed, 13 tests passed** (9 + 4) |
| `newsSeenAfterSuccess.test.js` row count | | 8 → **9** |
| Composed diff | `git diff main --stat` | 15 files, **2369 insertions** (+33: this row and its comment) |

The figures in §5 and §7 are as-of composition HEAD `8b4e45d1` and are left as recorded; this section carries the deltas. No source file changed — the only edit is the test row, so the full-suite and `vite build` results at `8b4e45d1` stand, and the fence and regional-guard findings are untouched.

---

**STOP.** Composition complete and pushed. **No PR was opened, nothing was merged, no flag was flipped.**
