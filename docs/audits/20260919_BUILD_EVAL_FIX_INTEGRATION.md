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

T4 wrote `&& !haikuFailure` defensively against a `main` whose parse check was only *"input exists and `decision` is a string"* — on that tree a response could be accepted and still be junk. **T3, landing in this same composition, closed that at the source.** At `api/cron/agent-evaluate.js:2236-2238`, `haikuResult` is assigned on exactly one branch — `validation.valid` — and that assignment is the **last statement in the `try`**, so nothing between it and the catch can throw. Therefore, at the predicate's line, a truthy `haikuResult` already means *"passed the validator and was accepted"*, and none of the four failure classes that can exist at that point can coexist with it. The dropped clause was redundant.

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

---

## 11. Part C — Astra's blind review: confirm, refute, fix

**Date:** 2026-09-20 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Branch:** `claude/eval-small-fixes-integrate-or1aqn`, continued from tip `23adfa33`. **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run first. `origin/main` has advanced to `0871937c` — **docs only** (one 383-line audit record, verified by `git diff --stat 6cd3699a 0871937c`). **Not rebased**, as instructed; §7 below explains the one diff artefact that follows from that. Every anchor cited is **VERIFIED** at the tip.

### Executive verdict

| | |
|---|---|
| **Input** | Astra's blind review: MERGE WITH CHANGES, five findings and three verification notes. |
| **Confirm/refute** | **All five findings CONFIRMED. Both "WRONG as unconditional" notes CONFIRMED. Nothing refuted** — but two findings needed material qualification before they could be acted on (F3, F5b), and both are recorded below rather than smoothed over. |
| **Method** | Each finding got a test written against the POST-fix behaviour and run on the pre-fix tree first. A finding counts as CONFIRMED only where that test was **red before the fix and green after**, for the reason the finding names — three harness faults that produced red-for-the-wrong-reason were found and corrected before anything was called confirmed. |
| **Fixes** | F1, F1b, F2, F3, F4 in `api/cron/agent-evaluate.js`; F5a/F5b/F5c in the three named suites; golden provenance verified and hardened; the "full schema" wording corrected. |
| **Whole-repo suite** | **exit code 0** — 725 files passed / 3 skipped, 13 914 passed / 64 skipped. |
| **`vite build`** | **exit code 0**, built in 22.77 s. |
| **Fence (§1)** | **No fenced file changed** — all eleven paths checked against `git diff origin/main --name-only`. |
| **Newly filed** | **Two defects found while confirming, NOT fixed** (BUILD_RULES §3) — one of them **P1-latent** in a §1-fenced file (latent, not live: see §11.6(1) for why, and §12.4 for the correction that established it). See §11.6. |

---

### 11.1 CONFIRMED / REFUTED

| # | Finding | Verdict | Red-before evidence (pre-fix tree) | Green-after |
|---|---|---|---|---|
| **F1** | Pre-swap quotes mixed with post-swap entry prices | **CONFIRMED** | `expected 'support,AMD,Technology,Day1,$168.42,$…' to contain '+0.00%'` — the row rendered the new position at an instant gain | ✓ |
| **F1b** | Committed swap + failed refresh bypasses the rebuild *(note: "refreshed snapshot", second half)* | **CONFIRMED** | `expected "vi.fn()" to not be called at all, but actually been called 1 times` — the tick called the model on a book it could not read (×2 rows: throw, and empty read) | ✓ |
| **F2** | A guardrail exception erases the schema failure's named field | **CONFIRMED** | `expected 'guardrail_error' to be 'invalid_tool_result'`; `expected { …(5) } to be null` (chosen HOLD); `expected 'guardrail_error' to be 'budget_skipped'` (counter semantics flipped); beat wording | ✓ |
| **F3** | `holdKind` can describe a SWAP as a fallback HOLD | **CONFIRMED, qualified** | `expected 'default_failure' to be null` — a tick that traded was filed as an abstention | ✓ |
| **F4** | Successful bookkeeping leaves stale exhaustion reasons | **CONFIRMED** | `expected undefined to be truthy` — the success path wrote **no** reasons key at all, so nothing was ever pruned (×2 rows) | ✓ |
| **F5a** | "fires at the constant" proves nothing | **CONFIRMED by mutation** | production `attempt >= 3` hardcoded → **all 9 rows still green** | ✓ (now reddens) |
| **F5b** | "risk and lock maps are pruned" inspects only `riskStatus` | **CONFIRMED, qualified** | lock-pruning loop deleted → **all 8 rows still green** | ✓ (partially — see 11.4) |
| **F5c** | "S7 exit SURVIVES" proves a call count, not durable state | **CONFIRMED by probe** | after the tick the stored document held **no** risk trade and KO **still occupied its slot**, yet the row was green | ✓ (now reddens) |
| **N1** | "full schema" is literally wrong | **CONFIRMED** | three relaxation rows pass against the shipped validator: non-integer `conviction` accepted, nested rows unvalidated, optional `null` accepted | n/a — wording |
| **N2** | "refreshed snapshot" is not an unconditional guarantee | **CONFIRMED** | split into F1 (prices) and F1b (failed refresh); both above | ✓ |

**Nothing was refuted.** That is an unusual result and it is stated plainly rather than dressed up: Astra's five findings were all real. What the confirm pass *did* overturn was the framing of two of them (F3 and F5b, §11.4), and it caught three of my own harness faults — a budget skip that never fired, an F3 fixture whose loss tripped the risk manager first, and an assertion that crashed instead of failing — each of which would have produced a red row that proved nothing.

### 11.2 The fixes

| Fix | `path:line` | What changed |
|---|---|---|
| **F1** | `api/cron/agent-evaluate.js:1313`, `:1868-1871`, `:1929-1932` | The S7 loop records the executor's own entry price (`riskSwapResult.incomingAsset.swapPrice`) into `forcedEntryPrices`; the rebuild re-points `prices[symbol].current` to it for the incoming symbols only, in place, before re-scoring. The exited symbol keeps its fetched quote; nothing is re-fetched. The score transaction is computed before the risk loop and so cannot move (T1's scope guard still green). |
| **F1b** | `api/cron/agent-evaluate.js:499-512`, `:1316`, `:1851-1862`, `:1959-1961`, `:2087-2090`, `:2180-2192` | `refreshBattleFromDoc` now returns `false` on an empty read instead of silently no-opping; the S7 loop wraps it, and on failure sets `refreshFailure` and breaks. That flag skips the proposal lifecycle, skips the trigger gate, and skips the model call, recording `failureClass: 'refresh_failed'` with `fallbackHold`. The record is still written, so the fault is disclosed. The committed trade is untouched. |
| **F2** | `api/cron/agent-evaluate.js:2150`, `:2701-2704`, `:3259` | The guardrail catch writes `guardrailFault = { message (≤200), timestamp }` and never touches `haikuFailure`. `haikuError` is the model-call outcome and nothing else, so `invalid_tool_result` keeps its `invalidField`, a chosen HOLD keeps `haikuError: null`, and `budget_skipped` keeps its pass-through counter semantics. Composed last, after `holdKind`. |
| **F2 (harness)** | `api/_utils/__fixtures__/tickStampsHarness.js:77-91` | `FAIL_CLOSED_ENTRY_KEYS = ['holdKind', 'guardrailFault']`. `PRE_PHASE_B_ENTRY_KEYS` untouched and its golden still matches byte-for-byte. |
| **F2 (beat)** | `api/cron/agent-evaluate.js:3395-3409` | The `eval_degraded` beat fires on **either** fault and derives its wording from the same two facts the record does: `no usable decision; held by default` / `…; deterministic exit taken` / `guardrail check failed; proposal held` / `guardrail check failed; decision unaffected`. `consecutiveEvalFailures` semantics unchanged. |
| **F3** | `api/cron/agent-evaluate.js:2146`, `:3256` | The four fallback branches set a boolean `fallbackHold`; the record derives `holdKind: decision === 'HOLD' && fallbackHold ? 'default_failure' : null`. |
| **F4** | `api/cron/agent-evaluate.js:2413-2440` | One `rewriteReasons(ids, {evaluated, exhausted})` helper rebuilds the map from the seen list on **every** write of that list, drops reasons for ids the cap evicted, and deletes reasons for ids actually evaluated. Written only when it differs, so an ordinary tick adds no key it did not add before. |
| **F5a** | `api/cron/agent-evaluate.newsSeenAfterSuccess.test.js:55-63`, `:243-261` | The trigger-gate double exposes `MAX_STORY_WAKE_ATTEMPTS` through a getter, so a row can retune it. The row sets it to **2** and demands exhaustion on the second failure. |
| **F5b** | `api/cron/agent-evaluate.tickCoherence.test.js:46-50`, `:76-88`, `:245-271` | The fenced guardrails module is wrapped to capture the `lockedPositions` set it is handed; the row asserts KO is absent from it and every member is still held, alongside `riskStatus`. |
| **F5c** | `api/cron/agent-evaluate.guardrailErrorFailClosed.test.js:124-150`, `:187-224` | The executor double commits slot, bench, trade and `tradeCount` to the fake stored document; the S7 row reads that document back **after** the tick and asserts KO gone, AMD in its slot, the trade present and `tradeCount === 1`. |
| **N1** | `api/_utils/agentEvalToolResultValidation.js:5-11`, `agent-evaluate.js:2299-2301`, `:2385`, `toolResultValidation.test.js:3`, T3 report `:16` | "full schema" → "schema-driven validation of top-level fields, with the disclosed relaxations". Fable's adjudication V1.1 is the document of record and was **not** edited. |

### 11.3 Mutation check (BUILD_RULES §2) — every new test

| Mutation | Rows reddened |
|---|---|
| Drop the F1 entry-price re-point | **1** (the F1 row) |
| Ignore a failed refresh (restore the unguarded await) | **2** (both F1b rows) |
| Restore the `haikuFailure` overwrite with `guardrail_error` | **3** (invalidField, chosen-HOLD, budget-counter) |
| Write `holdKind` eagerly again (ignore the final decision) | **1** (the F3 row) |
| Prune reasons only on the exhaustion path | **2** (both F4 rows) |
| Hardcode `attempt >= 3` in production | **1** (the retuned-limit row) |
| Executor double stops committing the trade | **1** (the S7 durable row) |

Every mutation was applied to a file **restored from a copy**, never `git checkout --`; see §11.7.

### 11.4 The two qualifications — where Astra's framing needed correcting

**F3 is real in the cron, but currently unreachable end-to-end.** Every guardrail forced exit — the only path that turns a fallback into a SWAP — is built by `agentGuardrails.js:537-549`, which sets `note: undefined` whenever the replacement is not distressed. `ignoreUndefinedProperties` is unset repo-wide (stated at `tickStampsHarness.js:29`, `tickStamps.js:55`, `agent-evaluate.js:972`), so Firestore **rejects** that write: the tick throws before any record with a wrong `holdKind` could persist. The distressed alternative is downgraded back to HOLD at `agent-evaluate.js:2622`. So the F3 defect is genuine and the fix is correct, but it is **latent behind a larger break** filed in §11.6. The F3 row therefore doubles the evaluator to supply the verdict — legitimate, because F3's fix lives entirely in the cron's *classification* of a verdict, not in producing one — and says so at the row.

**F5b's row cannot be made a mutation-provable guard, and is not claimed as one.** `lockedPositions` is populated only when `evaluateRisk` returns `'LOCK'` (`:1452-1454`), and a position is exited only on `EMERGENCY_SWAP` / `SWAP_OUT` / `TRAIL_STOP` (`:1449-1451`). Those are branches of one action value, so **no symbol can be locked and exited on the same tick** — the lock set may well be non-empty (a still-held locked symbol sits in it while a different symbol exits), but its **deletion arm** has no reachable input. *(Corrected 2026-09-20, Astra Part D review; the earlier "the set is already empty on every reachable path" was wrong.)* The row now observes the lock set (fixing Astra's literal complaint) and asserts a **subset invariant**; a companion row records the limit as executable documentation so the next reader cannot mistake the invariant for proof. The dead branch is filed in §11.6.

### 11.5 Golden provenance — verified, then made self-checking

A scratch `git worktree` was created at **`6cd3699a`** (pre-T1 code — `grep -c forcedSwapsCommitted` → **0**), this branch's runner copied in, and the no-swap block regenerated there.

| | SHA-256 |
|---|---|
| Regenerated on the pre-fix tree @ `6cd3699a` | `e595c08a948e863d802418a34ca47c5cf71a66162413e487c5e90ba2e93a6ab7` |
| Committed fixture @ this branch | `e595c08a948e863d802418a34ca47c5cf71a66162413e487c5e90ba2e93a6ab7` |

**`cmp`: identical, 3 537 bytes each. Provenance VERIFIED** — Astra's "NOT VERIFIED" is now discharged by independent regeneration rather than by assertion. (The worktree's other four coherence rows failed there, which is correct: that is T1's own mutation evidence.)

The fixture now carries a `#!golden` header naming the source commit and the sha256 of its own block; the suite strips the header before comparing, re-verifies the hash on **every** run, and **never writes the golden as a side effect** — regeneration is `UPDATE_GOLDEN=1` only. An overwrite on the wrong tree can no longer pass silently: the recorded hash would have to be rewritten deliberately.

### 11.6 Filed for separate tasking (BUILD_RULES §3 — report, do not fix)

**(1) P1-LATENT — a non-distressed guardrail forced exit writes `note: undefined`, which would throw the tick's final write.** `api/_utils/agentGuardrails.js:546-548` sets `note:` to `undefined` via a ternary with no else-value; that object rides `guardrailOverrides` into the evaluation record and into `battleRef.update()`. With `ignoreUndefinedProperties` unset, Firestore rejects it. **This is a §1 FENCED file — not touched, not fixed.**

*Characterisation corrected 2026-09-20 (Astra Part D review, adopted).* The original text here called it a live production break. **It is LATENT, not live.** The undefined key is produced only by the non-distressed **forced-exit** branch, which requires a **breached deployed stop, trailing stop or profit target**; sector-cap observation alone cannot reach it, and Fable's production census of Sep 17 2026 — **zero agents with a deployed guardrail; zero guardrail exits across 468 battles / 402 trades** — supplied to the reviewer as a premise, which the reviewer **accepted rather than independently observed** records that no agent currently has one — so nothing is hitting it today. What it breaks is **the tick's final write, not necessarily the protective trade**: `executeSwapServer` commits before the record is composed, so a forced exit can already have executed when the write is rejected. That is its own hazard (a committed trade with no evaluation record) and is part of why it stays P1.

Filed as **P1-latent for the exit-dials arc, ahead of the F3 fix in that arc's order** — F3's defect cannot manifest until this is fixed, because the write throws first.

**(2) P3 — the lock-pruning branch's DELETION ARM is unreachable** *(wording corrected 2026-09-20, Astra Part D review: the set itself is not always empty — a still-held locked symbol sits in it while a different symbol exits; what no tick can produce is a symbol that is both locked and exited, which is the only input the deletion arm has)*. See §11.4. Either the LOCK/exit exclusivity is intended (and the loop should go, with a comment) or a locked position is meant to be exitable (and the risk manager is wrong). That is a design question for the founder, not a fix to improvise.

### 11.7 Process notes

**A load-dependent flake, not a regression.** The first whole-repo baseline run failed one file: `src/config/backingBetaFlags.test.js`, `Error: Test timed out in 5000ms` on a repo-walking importer ratchet. It passes in isolation at 1 070 ms, the file and the modules it walks are absent from this branch's diff, and that run was ~16 % slower than the green ones (161 s vs 139 s). One re-run: **exit 0**. Recorded rather than quietly re-run.

**A `git checkout --` during a mutation check erased in-flight fixes.** Restoring a mutated `agent-evaluate.js` with `git checkout --` discarded every uncommitted Part C fix in that file — precisely the incident BUILD_RULES §2's reviewer-isolation clause cites. The fixes were reapplied, re-verified green, and committed immediately; every later mutation restored from a `cp` copy instead. Reported because the rule exists because this keeps happening.

**Verification.** Whole-repo `npx vitest run` — output redirected, not piped, so `$?` is vitest's own — **exit 0**, 725 files / 13 914 passed, failing-file set **empty**, equal to the baseline. `npx vite build` **exit 0**. `eslint` on the changed source files: **3 errors, all pre-existing** (`getPresetAdjustedStrategies`, two `_e`). The three regional guards pass (3 files / 108 tests) with the `PRE_PHASE_B_ENTRY_KEYS` golden absent from the diff and the `executeSwapServer` census allowlist unchanged.

### 11.8 `git diff origin/main --stat`

```
 .../tickCoherenceLiveContextGolden.noSwap.txt      |  84 ++++
 api/_utils/__fixtures__/tickStampsHarness.js       |  21 +-
 api/_utils/agentEvalToolResultValidation.js        | 139 ++++++
 api/_utils/agentTriggerGate.js                     |  19 +
 api/cron/agent-evaluate.astraFindings.test.js      | 508 +++++++++++++++++++++
 ...agent-evaluate.guardrailErrorFailClosed.test.js | 269 +++++++++++
 api/cron/agent-evaluate.js                         | 415 +++++++++++++++--
 .../agent-evaluate.newsSeenAfterSuccess.test.js    | 352 ++++++++++++++
 api/cron/agent-evaluate.test.js                    |  10 +-
 api/cron/agent-evaluate.tickCoherence.test.js      | 385 ++++++++++++++++
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |   8 +-
 .../agent-evaluate.toolResultValidation.test.js    | 217 +++++++++
 ...26-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md | 383 ----------------
 docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md | 287 ++++++++++++
 ...260919_BUILD_EVAL_FIX_T1_eval-tick-coherence.md | 137 ++++++
 ...UILD_EVAL_FIX_T2_guardrail-error-fail-closed.md | 128 ++++++
 ...919_BUILD_EVAL_FIX_T3_tool-result-validation.md | 138 ++++++
 ...19_BUILD_EVAL_FIX_T4_news-seen-after-success.md | 131 ++++++
 18 files changed, 3214 insertions(+), 417 deletions(-)
```

*(plus this section, in the commit that carries it.)*

**The one diff artefact of not rebasing:** `2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md` shows as 383 deletions because `origin/main` added it in `0871937c` after this branch was cut, and the gate said not to rebase. **This branch has not deleted anything** — Astra reached the same conclusion independently. It disappears the moment the branch is merged or rebased.

**One `api/cron/agent-evaluate.test.js` pin was updated, not weakened.** F1b's refactor reads the snapshot into `refreshedData` before the assign, so the raw-reassign regex no longer matched. The pin still demands **exactly one** doc-data re-assign inside `refreshBattleFromDoc`, and now also pins the empty-read guard itself; pin 3 in `agent-evaluate.tickStamps.pins.test.js` independently caps `Object.assign(battle` at two occurrences repo-wide.

### 11.9 Branch state

| | |
|---|---|
| **Branch** | `claude/eval-small-fixes-integrate-or1aqn` |
| **Part C code HEAD** | `37622c5a` — **every measurement in §11 was taken at this commit**, on a clean tree |
| **Branch tip** | the commit carrying this section, directly on `37622c5a`, changing no file but this one. Read it with `git rev-parse claude/eval-small-fixes-integrate-or1aqn`. |
| **Base** | `origin/main` @ `0871937c` (not rebased, per the gate) |
| **Part C commits** | `fd78b86e` (F1–F4 + the confirm/refute suite), `37622c5a` (F5, golden provenance, N1 wording), plus this section |

**STOP.** Part C complete and pushed. **No PR was opened, nothing was merged, no flag was flipped.**

---

## 12. Part E — closing Astra's delta-review findings

**Date:** 2026-09-20 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Branch:** `claude/eval-small-fixes-integrate-or1aqn`, continued from tip `6effe727` (Part C code HEAD `37622c5a`). **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run first; `origin/main` unchanged at `0871937c`; tip `6effe727` confirmed, tree clean. Whole-repo baseline **exit 0** (725 files, 13 914 passed). Same confirm-then-fix discipline as Part C: every finding got a test that was **red on the current tree, for the reason the finding names**, before its fix. Anchors below are **VERIFIED** at the new tip.

### Executive verdict

| | |
|---|---|
| **Input** | Astra's Part D review: MERGE WITH CHANGES — the Part C refresh-failure stop was incomplete, the Part C fault separation dropped an existing receipt, plus two wording corrections. Its verifications of F1, F2's record semantics, F3, F4, F5a–c, the golden, the changed pin and scope were accepted and not reworked. |
| **E1** | **CONFIRMED and fixed.** Three doors were still open on an unreadable book — and two of them meant the tick wrote **no record at all**. |
| **E2** | **CONFIRMED and fixed.** The guardrail fault now carries its own durable and shadow receipts, routed independently of the model-call outcome. |
| **E3** | Both corrections applied. Astra was right on both: the fenced defect is **latent, not live**, and "the set is empty on every reachable path" was wrong — it is the **deletion arm** that is unreachable. |
| **E4** | Filed, not fixed — §12.5. |
| **Whole-repo suite** | **exit code 0** — 725 files passed / 3 skipped, **13 922 passed** / 64 skipped. |
| **`vite build`** | **exit code 0**, built in 29.93 s. |
| **Fence (§1)** | **No fenced file changed** — all eleven paths checked. |

---

### 12.1 CONFIRMED / REFUTED

| # | Finding | Verdict | Red-before evidence | Green-after |
|---|---|---|---|---|
| **E1(a)** | Refresh failure + **pending** meeting: suppression pass runs and trades, then returns early | **CONFIRMED** | `expected 1 to be +0` — the pass **evaluated** on the stale book; and before the row was strengthened, `the tick must still write its record: expected null to be truthy` — **no record at all** | ✓ |
| **E1(b)** | Refresh failure + **newly detected** meeting: same | **CONFIRMED** | `expected 1 to be +0`, and the same missing-record red | ✓ |
| **E1(c)** | Refresh failure + breached deployed stop: **S10 runs** | **CONFIRMED** | `expected 1 to be +0` — `applyGuardrails` was called on a book the tick had just failed to re-read | ✓ |
| **E1(d)** | Control: breached stop + successful refresh still exits | **green throughout** — the fix must not touch this | n/a | ✓ |
| **E2** | The fault separation dropped the `cronErrors` entry and the shadow disclosure | **CONFIRMED** | `expected [] to have a length of 1 but got +0` (valid result + throw); `expected [ { …(4) } ] to have a length of 2 but got 1` (both faults → only one receipt) | ✓ |

**Nothing refuted.** Both findings were real, and E1 was worse than its headline: the two gameplan paths do not merely act on a stale book, they **early-return**, so on the pre-fix tree a refresh-failure tick with a meeting pending or newly detected produced **no evaluation record whatsoever** — the fault was not merely mis-stated, it was entirely undisclosed. The fixture hid both doors exactly as Astra said (`tickStampsHarness.js:163` pre-sets `lastGameplanDate` to suppress the detector; no deployed guardrail is shipped), so the new rows remove that masking rather than working around it.

### 12.2 The fixes

| Fix | `path:line` | What changed |
|---|---|---|
| **E1 — gameplan handling** | `api/cron/agent-evaluate.js:1980-1982` | `gameplanHandled` resolves to `'continue'` on a `refreshFailure` tick instead of calling `handleGameplanMeeting`. Both of that stage's outcomes depend on the book — handling an approved meeting **executes its legs**, and the pending branch runs a **trading** suppression pass and returns early. `'continue'` keeps the tick falling through to the common flush. |
| **E1 — meeting detection** | `api/cron/agent-evaluate.js:2003` | `if (!refreshFailure && !battle.gameplanMeeting)`. The detector reads the snapshot, the creating tick runs the same trading pass and returns early, and a meeting diagnosed off a stale book would be **persisted**. |
| **E1 — S10 guardrail stage** | `api/cron/agent-evaluate.js:2640` | `if (!refreshFailure && (deployedGuardrails.length > 0 || sectorSlotObserveCap !== null))`. A deterministic exit forced off a stale snapshot is a trade that cannot be justified; the delayed exit is the correct trade. |
| **E2 — durable receipt** | `api/cron/agent-evaluate.js:3533-3554` | One receipt **per fault**, not per tick: `faultRows` collects a `haiku_eval …` row when `haikuFailure` is set and a `guardrail_eval guardrail_error: …` row when `guardrailFault` is set, distinguishable by `failureClass`. A tick with both writes both. The ≤20 cap is preserved (it was `slice(-19)` plus one push; it is now `slice(-20)` over the combined array). |
| **E2 — shadow disclosure** | `api/cron/agent-evaluate.js:3470` | `guardrailFault` rides the shadow payload in its **own** field. The payload's `failureClass` stays the model-call outcome, so a guardrail fault on a successful call reads as `failureClass: null` + `guardrailFault` set. |

**Not changed, deliberately:** the score transaction, the lease semantics, anything on a tick whose refresh succeeded, `failureClass` for the model outcome, and `consecutiveEvalFailures` semantics. E1(d) and the E2 no-regression row are the guards on that.

### 12.3 New tests, and the mutation check (BUILD_RULES §2)

Eight rows added to `api/cron/agent-evaluate.astraFindings.test.js` (four E1, four E2).

| Mutation | Rows reddened |
|---|---|
| Un-gate gameplan **handling** | **1** (E1a) |
| Un-gate meeting **detection** | **1** (E1b) |
| Un-gate the **S10** stage | **3** (E1a, E1b, E1c — a, b also pin `applyGuardrails` at zero calls) |
| Drop the guardrail `cronErrors` row | **3** (the three E2 fault rows) |
| Drop `guardrailFault` from the shadow payload | **3** (the three E2 fault rows) |

Every mutation was restored from a `cp` copy, never `git checkout --` (§11.7).

**One deliberate double, stated.** E1(c) and E1(d) supply the forced-exit verdict through the guardrail double rather than computing it, for the same reason as F3: the real evaluator's forced-exit override carries `note: undefined` (§11.6(1)), which the harness — correctly mirroring Firestore — rejects. The rows are about whether the **stage runs**, not about what the evaluator decides, so the substituted verdict is the input rather than the thing under test. Said at the rows.

### 12.4 Corrections to claims we made (E3)

**§11.6(1) — "live production break" → P1-LATENT.** Astra is right and the characterisation is corrected in place. The undefined key is produced only by the **non-distressed forced-exit branch**, which requires a breached deployed stop, trailing stop or profit target; sector-cap observation alone cannot reach it, and **no agent currently has a deployed guardrail** per Fable's production census of Sep 17 2026 — **zero agents with a deployed guardrail; zero guardrail exits across 468 battles / 402 trades** — supplied to the reviewer as a premise, which the reviewer **accepted rather than independently observed**, so nothing is hitting it today. The correction also records what it actually breaks: **the tick's final write, not necessarily the protective trade** — `executeSwapServer` commits before the record is composed, so a forced exit can already have executed when the write is rejected. That residue (a committed trade with no evaluation record) is its own hazard and is part of why it stays P1. Filed as **P1-latent for the exit-dials arc, ahead of F3 in that arc's order**. The fenced file remains untouched.

**P3 wording — "empty on every reachable path" was wrong.** Corrected in both places (`api/cron/agent-evaluate.tickCoherence.test.js:273-298` and §11.4/§11.6(2)). The lock set is often **non-empty**: a still-held locked symbol sits in it quite normally while a *different* symbol exits. What has no reachable input is the loop's **deletion arm** — the branch that removes a locked symbol because it is no longer held — since being locked and being exited are mutually exclusive on one tick. The companion row is renamed to say exactly that.

### 12.5 Filed, not fixed (E4) — `holdKind` and `guardrailFault` have no reader

`grep` across `src/` and `api/` returns **zero** consumers of either field outside the cron that writes them and the test harness. Three references, all **VERIFIED** this session:

* **`src/screens/battleView/selectWhyState.js:145`** — `if (evaluation.haikuError)` returns the ABSENT "no decision" state. Post-F2 a chosen HOLD whose only fault is the guardrail no longer short-circuits here. **That is intended**: there *was* a decision, and the model made it.
* **`src/screens/battleView/buildTape.js:272-274`** — but the same entry now satisfies `quiet = decision === 'HOLD' && downgraded !== true && !haikuError`, so it becomes eligible for **quiet tape folding**. The guardrail fault is disclosed on the feed beat and in the two receipts restored by E2, and **not on the tape**.
* **`api/_utils/voiceLayerGrounding.js:357`** — `RECORD_ENTRY_FIELDS` whitelists `haikuError`, `guardrailOverrides` and `guardrailSourceNote`, but neither `holdKind` nor `guardrailFault`, so neither reaches a later prompt.

Filed for the Film Room / capture readers. **No reader was changed in this task.** The question for that arc is whether a guardrail-only fault should break a quiet run on the tape, and whether either field should join the grounding whitelist.

### 12.6 Verification

| Check | Result |
|---|---|
| Whole-repo `npx vitest run` — output redirected, not piped, so `$?` is vitest's own | **exit 0** · 725 files passed / 3 skipped · **13 922 passed** / 64 skipped |
| Failing-file set | **empty**, equal to the baseline |
| `npx vite build` | **exit 0**, 29.93 s |
| `git diff origin/main --name-only` vs the §1 fence list | **no fenced file present** |
| Three regional guards | **pass** — 3 files / 108 tests; `tickStampsEntryGolden.flagOff.json` absent from the diff; the `executeSwapServer` census allowlist unchanged |
| `eslint` on the changed source | **3 errors, all pre-existing** (`getPresetAdjustedStrategies`, two `_e`) |

Test count moved 13 914 → **13 922** (+8): exactly the eight rows added. Linux is the suite of record.

### 12.7 `git diff origin/main --stat`

```
 .../tickCoherenceLiveContextGolden.noSwap.txt      |  84 +++
 api/_utils/__fixtures__/tickStampsHarness.js       |  21 +-
 api/_utils/agentEvalToolResultValidation.js        | 139 ++++
 api/_utils/agentTriggerGate.js                     |  19 +
 api/cron/agent-evaluate.astraFindings.test.js      | 696 +++++++++++++++++++++
 ...agent-evaluate.guardrailErrorFailClosed.test.js | 269 ++++++++
 api/cron/agent-evaluate.js                         | 466 ++++++++++++--
 .../agent-evaluate.newsSeenAfterSuccess.test.js    | 352 +++++++++++
 api/cron/agent-evaluate.test.js                    |  10 +-
 api/cron/agent-evaluate.tickCoherence.test.js      | 394 ++++++++++++
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |   8 +-
 .../agent-evaluate.toolResultValidation.test.js    | 217 +++++++
 ...26-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md | 383 ------------
 docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md | 436 +++++++++++++
 ...260919_BUILD_EVAL_FIX_T1_eval-tick-coherence.md | 137 ++++
 ...UILD_EVAL_FIX_T2_guardrail-error-fail-closed.md | 128 ++++
 ...919_BUILD_EVAL_FIX_T3_tool-result-validation.md | 138 ++++
 ...19_BUILD_EVAL_FIX_T4_news-seen-after-success.md | 131 ++++
 18 files changed, 3605 insertions(+), 423 deletions(-)
```

*(plus this section, in the commit that carries it.)* The `2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md` deletion remains the artefact of not rebasing, unchanged from §11.8 — this branch has not deleted anything.

### 12.8 Branch state

| | |
|---|---|
| **Branch** | `claude/eval-small-fixes-integrate-or1aqn` |
| **Part E code HEAD** | `d83615b1` — the E1/E2 fixes; every measurement in §12 was taken at or after it, on a clean tree |
| **Branch tip** | the commit carrying this section and the E3 corrections. Read it with `git rev-parse claude/eval-small-fixes-integrate-or1aqn`. |
| **Base** | `origin/main` @ `0871937c` (not rebased) |
| **Part E commits** | `d83615b1` (E1 + E2 + their rows), plus this section with the E3 corrections |

**STOP.** Part E complete and pushed. **No PR was opened, nothing was merged, no flag was flipped.**

---

## 13. Part F — closing Astra's final review findings

**Date:** 2026-09-20 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Branch:** `claude/eval-small-fixes-integrate-or1aqn`, continued from tip `b6bf3e22` (Part E code HEAD `d83615b1`). **No PR, no merge, no flag flip.** This is the last review round; the branch goes to PR after this report.
**Preamble (BUILD_RULES §3):** `git fetch origin` run first; `origin/main` unchanged at `0871937c`; tip `b6bf3e22` confirmed, tree clean. Whole-repo baseline **exit 0** (725 files, 13 922 passed). Same discipline as Parts C and E: each code finding got a test **red on the current tree, for the reason the finding names**, before its fix. Anchors are **VERIFIED** at the new tip.

### Executive verdict

| | |
|---|---|
| **Input** | Astra's third read: MERGE WITH CHANGES, three findings. Its verifications — the three E1 gates, the failed tick reaching the common flush with the score transaction and lease intact, both E2 receipts with no off-by-one and no counter change, narration's own fresh re-read, scope and fence — were accepted and not reworked. |
| **F-1** | **CONFIRMED and fixed.** The catalyst path priced a new name and would have told the player their watchlist changed, on a tick that evaluated nothing. |
| **F-2** | **CONFIRMED and fixed** — and reported as the rule holding, not a live defect, because the check below found no consumer. |
| **F-3** | **CONFIRMED.** The row was renamed to what it covers and the real control was built beside it. |
| **F-4** | Both document corrections applied. |
| **F-5** | Filed, not fixed — §13.6. |
| **Whole-repo suite** | **exit code 0** — 725 files passed / 3 skipped, **13 927 passed** / 64 skipped. |
| **`vite build`** | **exit code 0**, built in 26.90 s. |
| **Fence (§1)** | **No fenced file changed.** |

---

### 13.1 CONFIRMED / REFUTED

| # | Finding | Verdict | Red-before evidence | Green-after |
|---|---|---|---|---|
| **F-1** | The news catalyst block runs on an unreadable book | **CONFIRMED** | `expected [ 'NVDA', 'TSLA', 'MSFT', …(10) ] to not include 'META'` — a catalyst name was **priced** on a refresh-failure tick, en route to a bench mutation and a player-facing beat | ✓ |
| **F-2** | Success-then-failure rebuilds from an intermediate book | **CONFIRMED** | `expected true to be false` on the rebuild's own log line, after the anti-vacuity assertions confirmed **two** swaps had committed | ✓ |
| **F-3** | The control row doesn't control what it claims | **CONFIRMED** | Astra's reading verified directly: the row used the default price table, which triggers no risk exit (`tickStampsHarness.js:219-224`), so there was never a post-swap re-read for it to control | ✓ (renamed + real control added) |

**Nothing refuted.** All three were real.

### 13.2 The F-2 check, run before gating — **NO STOP**

The ruling required confirming that nothing on a refresh-failure tick reads the rebuilt snapshot, and a STOP if anything did. Every read of the seven rebuilt values (`flatPortfolio`, `portfolioSymbols`, `benchAssets`, `benchSymbols`, `assetScores`, `lockedPositions`, `riskStatus`) after the rebuild was enumerated and classified:

| Reader | `path:line` | Reachable on a refresh-failure tick? |
|---|---|---|
| Gameplan detection | `:2012` | **No** — gated by E1 |
| Both suppression passes | `:1996`, `:2024` | **No** — gated by E1 |
| News ticker list / catalyst set | `:2057`, `:2063` | **No** — gated by F-1. `evalTickerSet` is still *constructed* at `:2063`, but `news` is `[]`, so the loop that queries it never runs and the Set is discarded unread |
| Trigger gate | `:2119` | **No** — the synthetic gate replaces it |
| Prompt build | `:2263` | **No** — inside the diverted model-call block |
| Anticipation threshold lint | `:2543` | **No** — `lintedAnticipationCandidates = haikuResult?.anticipationCandidates` is `undefined`, so `Array.isArray(...)` is false |
| `activeBaseATR` in swap execution | `:2791` | **No** — inside `decision === 'SWAP' && haikuResult`; `haikuResult` is null |
| S10 guardrails | `:2665` | **No** — gated by E1 |
| LOCKED-swap check | `:2744` | **No** — short-circuits on `haikuResult` null |
| Tick stamps (`assetScores`, `riskStatus`, `benchAssets`) | `:3404`, `:3408`, `:3412` | **No** — gated on `promptBuilt`, which stays false |
| **Intraday diagnostics** | `:3308` | **Not at this HEAD** — `INTRADAY_DIAGNOSTIC_ENABLED = false` (`featureFlags.js:2604`, value confirmed by import). Filed in §13.6 |
| **Shadow assembly** | `:3588` | **Not at this HEAD** — `SHADOW_ASSEMBLY_ENABLED = false` (`featureFlags.js:1482`, value confirmed by import). Filed in §13.6 |

**No consumer reads the rebuilt snapshot on a refresh-failure tick at this HEAD**, so there was nothing to choose between and no STOP. That is exactly why F-2 is reported as **the rule holding rather than a live defect** — and exactly why the gate is still worth having: two of the would-be readers are flag-off code whose flips are now gated on adding the same check.

### 13.3 The fixes

| Fix | `path:line` | What changed |
|---|---|---|
| **F-1 — news fetch** | `api/cron/agent-evaluate.js:2050-2060` | `allNewsTickers` resolves to `[]` and `fetchRecentNews` is not called on a `refreshFailure` tick. The ticker list is derived from the very snapshot the tick failed to refresh. |
| **F-1 — catalyst block** | `api/cron/agent-evaluate.js:2074` | `if (!refreshFailure && catalystTickers.length > 0)`. Gated explicitly as well as by the empty `news`, so the withholding survives a future change that sources stories elsewhere. This redundancy is deliberate and it changes what a faithful mutation looks like — see §13.4. |
| **F-2 — snapshot rebuild** | `api/cron/agent-evaluate.js:1921-1929` | `if (forcedSwapsCommitted > 0 && !refreshFailure)`. A later swap whose re-read failed left the counter still counting the earlier ones, so the rebuild derived from an **intermediate** book — newer than the pre-loop picture, older than the committed truth. |

**Unchanged, as ruled:** the precomputed score update, the `refresh_failed` disclosure, the lease, and everything on a tick whose refresh succeeded. The four control rows are the guards on that.

### 13.4 New and changed tests, and the mutation check (BUILD_RULES §2)

Five rows added (two F-1, two F-2, one real control), one row renamed.

| Mutation | Rows reddened |
|---|---|
| Un-gate the news fetch **only** | **0** |
| Un-gate the catalyst block **only** | **0** |
| **Un-gate BOTH — the faithful pre-fix state** | **1** (the F-1 row) |
| Un-gate the rebuild | **1** (the F-2 row) |
| **Break the rebuild's price re-point** *(the mutation the ruling names for the new control)* | **2** (control (e), and F1's own row) |

**The two zero results are stated, not buried.** Neither F-1 gate reddens the row alone, because each is blocked by the other: with the fetch gated, `news` is empty so the catalyst block no-ops; with the catalyst block gated, fetched stories reach nothing. The gates are **deliberately redundant**, so the only faithful mutation is removing both — the same reasoning T3 used when a narrower mutation reddened 4 of 5 rows and the whole pre-fix block was restored instead (§ T3 report). Under that mutation the row goes red, so it is a guard.

**F-3 — the row that was renamed, and the control that replaced it.**

* `api/cron/agent-evaluate.astraFindings.test.js:620` — was *"CONTROL — a breached deployed stop with a SUCCESSFUL refresh still exits"*. It is now *"(d) a breached deployed stop with NO prior risk exit still exits — the S10 gate is inert when the book is readable"*, which is what it actually covers. Astra's diagnosis is recorded at the row.
* `api/cron/agent-evaluate.astraFindings.test.js:645` — **(e) the real control.** A **real** risk exit (KO below its bust line, queued by the production risk manager, not supplied), a **successful** re-read, then a **distinct** S10 exit on another symbol. It asserts both swaps in order (`calls[0]` incoming `AMD`, `calls[1]` incoming `JPM`), both trades in the stored document, and an ordinary evaluation record (`haikuError` null, `guardrailFault` null, `holdKind` null, decision `SWAP`).
  The proof that the re-read **succeeded** is the rebuild's own effect: the executor enters AMD at 168.42 against a fetched quote of 162.00, and the prompt the model saw renders AMD at **+0.00% / $168.42**. That is why breaking the price re-point reddens this row, exactly as the ruling predicted.

The S10 verdict is supplied through the guardrail double in both rows, for the reason given at the E1 rows: the real evaluator's forced-exit override carries the `note: undefined` defect of §11.6(1), which Firestore rejects. **The risk exit is real in row (e).**

### 13.5 Document corrections (F-4)

* **§11 executive verdict** (`docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md`, the "Newly filed" row) said *"a live production break in a §1-fenced file"* while §11.6 and §12.4 had already corrected it to latent. It now reads **P1-latent**, with pointers to §11.6(1) and to §12.4.
* **The premise is now attributed correctly.** "No agent currently has a deployed guardrail" was attributed to Astra in both §11.6 and §12.4. It is **Fable's production census of Sep 17 2026 — zero agents with a deployed guardrail; zero guardrail exits across 468 battles / 402 trades — supplied to the reviewer as a premise, which the reviewer accepted rather than independently observed.** Both occurrences now say that; no "per Astra's review" attribution of it remains in the document.

### 13.6 Filed, not fixed (F-5)

**(1) Two flag-off stages lack the refresh-failure gate — adding it is a precondition of either flip.**

* **Intraday diagnostics** — `api/cron/agent-evaluate.js:3308`, behind `INTRADAY_DIAGNOSTIC_ENABLED` (`src/config/featureFlags.js:2604`, **false** at this HEAD). It builds `viewSymbols` from `portfolioSymbols` / `benchSymbols` and writes a view document. **For the intraday arc.**
* **Shadow assembly** — `api/cron/agent-evaluate.js:3588`, behind `SHADOW_ASSEMBLY_ENABLED` (`src/config/featureFlags.js:1482`, **false** at this HEAD). Its market payload carries `assetScores`. **For the shadow-assembly owner.**

Both flag values were confirmed by importing the module, not by reading alone. Neither is reachable today, which is why neither was gated in this task; each flip should add `!refreshFailure` in the same commit.

**(2) Narration is deliberately left reachable — do not "fix" it into silence.** Committed-trade narration runs in a `finally` at `api/cron/agent-evaluate.js:3632`, and `generateTradeNarration` **re-reads the battle itself** before proceeding (`api/_utils/voiceLayerTradeNarration.js:109`, `battleRef.get()` inside its own `Promise.all`). It therefore narrates a trade that really committed, from a document it fetched fresh, rather than from the snapshot this tick failed to refresh. It is a **safe fresh-read exception** to the blanket E1 wording, recorded here so a later reader does not silence a trade the player made.

### 13.7 Verification

| Check | Result |
|---|---|
| Whole-repo `npx vitest run` — output redirected, not piped, so `$?` is vitest's own | **exit 0** · 725 files passed / 3 skipped · **13 927 passed** / 64 skipped |
| Failing-file set | **empty**, equal to the baseline |
| `npx vite build` | **exit 0**, 26.90 s |
| `git diff origin/main --name-only` vs the §1 fence list | **no fenced file present** |
| Three regional guards | **pass** — 3 files / 108 tests; `tickStampsEntryGolden.flagOff.json` absent from the diff; the `executeSwapServer` census allowlist unchanged |
| `eslint` on the changed source | **3 errors, all pre-existing** (`getPresetAdjustedStrategies`, two `_e`) |

Test count moved 13 922 → **13 927** (+5): exactly the five rows added. Every mutation was restored from a `cp` copy, never `git checkout --` (§11.7). Linux is the suite of record.

### 13.8 `git diff origin/main --stat`

```
 .../tickCoherenceLiveContextGolden.noSwap.txt      |  84 ++
 api/_utils/__fixtures__/tickStampsHarness.js       |  21 +-
 api/_utils/agentEvalToolResultValidation.js        | 139 ++++
 api/_utils/agentTriggerGate.js                     |  19 +
 api/cron/agent-evaluate.astraFindings.test.js      | 885 +++++++++++++++++++++
 ...agent-evaluate.guardrailErrorFailClosed.test.js | 269 +++++++
 api/cron/agent-evaluate.js                         | 490 +++++++++++-
 .../agent-evaluate.newsSeenAfterSuccess.test.js    | 352 ++++++++
 api/cron/agent-evaluate.test.js                    |  10 +-
 api/cron/agent-evaluate.tickCoherence.test.js      | 394 +++++++++
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |   8 +-
 .../agent-evaluate.toolResultValidation.test.js    | 217 +++++
 ...26-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md | 383 ---------
 docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md | 566 +++++++++++++
 ...260919_BUILD_EVAL_FIX_T1_eval-tick-coherence.md | 137 ++++
 ...UILD_EVAL_FIX_T2_guardrail-error-fail-closed.md | 128 +++
 ...919_BUILD_EVAL_FIX_T3_tool-result-validation.md | 138 ++++
 ...19_BUILD_EVAL_FIX_T4_news-seen-after-success.md | 131 +++
 18 files changed, 3945 insertions(+), 426 deletions(-)
```

*(plus this section, in the commit that carries it.)* The `2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md` deletion remains the artefact of not rebasing, unchanged from §11.8 and §12.7 — **this branch has not deleted anything**, and it disappears on merge or rebase.

### 13.9 Branch state

| | |
|---|---|
| **Branch** | `claude/eval-small-fixes-integrate-or1aqn` |
| **Part F code HEAD** | `9d25f6f1` — the F-1/F-2 gates; §13's measurements were taken at or after it, on a clean tree |
| **Branch tip** | the commit carrying this section, the F-3 test work and the F-4 corrections. Read it with `git rev-parse claude/eval-small-fixes-integrate-or1aqn`. |
| **Base** | `origin/main` @ `0871937c` (not rebased) |
| **Part F commits** | `9d25f6f1` (F-1 + F-2 + their rows), plus this section with F-3 and F-4 |

**STOP.** Part F complete and pushed. **No PR was opened, nothing was merged, no flag was flipped** — the branch is ready for the founder to open one.
