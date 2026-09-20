# Build report — T4 `fix/news-seen-after-success`

**Date:** 2026-09-19 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Source ruling:** adjudication V1.1 P-6 (`docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md`)
**Branch:** `fix/news-seen-after-success`, cut fresh from `main` @ `6cd3699a` · **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run as the session's first step; `origin/main` == `6cd3699a`. Branch cut clean from `origin/main`, **not stacked on T3** — see §6.1. Audit anchors from `5ba40661` re-located and **VERIFIED** at HEAD.

---

## Executive verdict

| | |
|---|---|
| **The bug** | A FantasyTimes story was marked seen at the trigger gate, **before** the model was called (`agent-evaluate.js:1961-1966`). A story that woke the engine and then hit a timeout was **burned unread** — the tick never evaluated it, and because its id was already on `cronState.seenStoryIds`, no later tick ever would. |
| **The fix** | The seen write moved to **after the call resolves**, gated on the handler having accepted a tool result. On failure the story stays unseen and may wake a later tick. |
| **The loop guard** | Attempts counted per story id; at `MAX_STORY_WAKE_ATTEMPTS` (3, one named export, founder-adjustable) the story is marked seen with `seenReason: 'attempts_exhausted'` — retired unread, and the record says so. |
| **Failing-file set** | **Unchanged from the gate: empty.** 22 → 24 files (this suite + the trigger-gate suites now in scope), 316 passing, 2 skipped. |
| **Verdict** | **DONE.** Pushed, not merged. |

---

## 1. What changed

### `api/_utils/agentTriggerGate.js` (+19) — not fenced
Two named exports, replacing a magic number and supplying the guard's dial:
* `MAX_STORY_WAKE_ATTEMPTS = 3` — **the single founder-adjustable constant** the loop guard reads. Its docstring says plainly that 3 is a starting value, not a finding.
* `SEEN_STORY_ID_CAP = 50` — names the pre-existing `.slice(-50)`.

### `api/cron/agent-evaluate.js` (+81 / −6) — not fenced
| Line | Change |
|---|---|
| `:39` | import both constants |
| `:1961-1972` | the gate no longer writes `cronState.seenStoryIds`; it captures `wokenStoryIds` and explains why the write moved |
| `:2192-2257` | **the fix** — seen-story bookkeeping, after the call resolves |

**Success is narrower than HTTP 200**, exactly as the prompt requires:

```js
const haikuCallSucceeded = Boolean(haikuResult) && !haikuFailure;
```

A response that arrived and was unusable leaves `haikuFailure` set and does **not** count.

| Outcome | `seenStoryIds` | `storyAttempts` | `seenStoryReasons` |
|---|---|---|---|
| success, first try | **+ the ids** | *(not written)* | *(not written)* |
| success after failures | **+ the ids** | counters for those ids dropped | *(not written)* |
| failure, attempt < 3 | *(not written)* | incremented | *(not written)* |
| failure, attempt == 3 | **+ the exhausted ids** | those ids dropped | `{id: 'attempts_exhausted'}` |

`seenStoryReasons` is pruned to ids still inside the seen cap, so the annotation map cannot outgrow the list it annotates.

---

## 2. The invariant the moved write depends on — checked, not assumed

The write now sits *past* the `!shouldEvaluate` early return. That is safe only because the gate never hands back a story id without also raising a trigger: `newStoryIds.push(story.id)` happens in the same branch as `triggers.push({type:'news_catalyst'})` (`agentTriggerGate.js:169-175`), and `shouldEvaluate = triggers.length > 0`. **VERIFIED**, and asserted against the real gate in the suite rather than reasoned about in a comment. Between the call and `battleRef.update(finalUpdate)` there is **no early return at all** (checked by scan over the whole range), so the write cannot be skipped.

---

## 3. Fence check — a question this task had to answer

`cronState.storyAttempts` and `cronState.seenStoryReasons` are new battle-doc keys, and the `createAgentBattle` document shape is **fenced as a concept** (BUILD_RULES §1: "changes that alter their behavior from non-fenced call sites are fence contact too"). So: is writing a new `cronState` key from this non-fenced cron fence contact?

**No — and the precedent is not thin.** `createAgentBattle` initialises **8** cronState keys (`agentBattleService.js:290-299`). The cron already writes **six** that are not among them, including `cronState.seenStoryIds` itself — the very key this task moves:

> `consecutiveEvalFailures`, `lastEvalStartedAt`, `lastEvalTradingDay`, `lastGameplanDate`, `lastHotBenchComputedAt`, `seenStoryIds`

Cron-owned `cronState` keys are long-established practice; the fenced initialiser's behaviour is unchanged. **No fenced file was read-modified, and none was edited.** (`agentTriggerGate.js` is not on the §1 fence list.)

---

## 4. Tests added — `api/cron/agent-evaluate.newsSeenAfterSuccess.test.js` (213 lines, 7 rows)

Real `processAgentBattle` on the shared tick harness. **Only `fetchRecentNews` is doubled** — `evaluateTriggers`, the thing that turns a story into a wake and hands back its id, stays the production function.

| Row | Asserts |
|---|---|
| failed call → unseen, re-triggers | `news_catalyst` fired, failure recorded, **no** seen write, `storyAttempts: {id: 1}`; a second tick carrying that state forward **wakes on the same story** and reaches `{id: 2}` |
| successful call → seen | seen write carries the id, no failure record, and **no counter opened** on a first-try success |
| success after failures | seen write lands, the story's counter is retired, **an unrelated story's counter survives** |
| 3rd failure → exhausted | seen write lands, `seenReason: 'attempts_exhausted'`, counter dropped |
| the constant is the dial | the guard is expressed through `MAX_STORY_WAKE_ATTEMPTS`, not a literal 3 |
| the invariant (§2) | against the real gate: a story yields id **and** trigger together; an already-seen story yields neither |
| **no regression** | a newsless tick writes **none** of the three story keys, and still evaluates to HOLD |

### Mutation check (BUILD_RULES §2)
The pre-fix write was restored at the gate. **3 of the 4 behavioural rows go red.** Restored, re-verified green.

The fourth — *"a successful call marks the story seen"* — passes under the mutation, and that is correct and stated rather than papered over: on the success path the pre-fix code also marked the story seen, just earlier. It is a **parity row** (the prompt's "successful call marks it seen"), not a defect guard. The defect guards are the three failure-path rows.

---

## 5. Verification

| Check | Result |
|---|---|
| `npx vitest run api/cron/agent-evaluate api/_utils/agentGuardrails api/_utils/agentTriggerGate api/_utils/keystoneGate8` | **24 files passed, 316 passed / 2 skipped** |
| Failing-file set vs. gate | **unchanged — empty** |
| `npx eslint` on the 3 touched files | 5 errors, **all pre-existing** — 3 in `agent-evaluate.js`, 2 in `agentTriggerGate.js` (`flattenPortfolioServer`, `dayProgress`); confirmed identical at HEAD via `git stash`. The new test file lints clean. |
| BUILD_RULES §2 review threshold | **not reached** — 3 files + this report. `vite build` not required and not run. |

Linux is the suite of record; no Windows run was performed.

---

## 6. Founder-visible decisions

**6.1 T4 is cut from `main`, not stacked on T3 — and the predicate is written so this is safe.** The prompt defines success as "a tool result that passed T3 validation and was accepted by the handler". T3's validator does not exist on a branch cut from `main`, and stacking would have made this task's `git diff --stat` carry T3's diff too, against the prompt's "only the fix, its test and the report" (and against BUILD_RULES §2's "one task = one branch, cut fresh from current `main`").

Resolved by writing the predicate against **the handler's own acceptance** — `haikuResult` set with no `haikuFailure` — rather than against any particular check that produced it. On `main` today that means the parse check accepted it. **Once T3 merges, the same expression automatically means "passed schema validation and was accepted"**, because `haikuResult` is then only ever assigned from a validated result. No merge-order dependency, no follow-up edit, and the two branches touch disjoint lines at this site. Flash's blind review should still confirm the composition after both land.

**6.2 `seenReason` lives in a sibling map, not on the id list.** `cronState.seenStoryIds` is a flat array of ids with nowhere to hang a reason. Reasons are written to `cronState.seenStoryReasons` **only for exhausted stories** — a normally-evaluated story gets no entry, which is what keeps the success path's write shape byte-identical to today's.

**6.3 A budget-skipped tick counts as a failed attempt.** `budget_skipped` sets `haikuFailure`, so it does not mark the story seen and does increment the counter. That is the honest reading of "three failed wakes": the story woke the engine and got no evaluation. Flagged because it means a battle repeatedly starved of cron budget can exhaust a story's attempts without the model ever having been called — arguably the guard doing its job, but it is a founder-visible policy choice, not a mechanical consequence.

---

## 7. `git diff --stat`

```
 api/_utils/agentTriggerGate.js                       |  19 ++
 api/cron/agent-evaluate.js                           |  87 ++++++++-
 api/cron/agent-evaluate.newsSeenAfterSuccess.test.js | 213 +++++++++++++++++++
 docs/audits/…_T4_news-seen-after-success.md          | (this report)
 3 files changed, 313 insertions(+), 6 deletions(-)   (before the report)
```

Only the fix, its test and the report.

**STOP.** T4 complete. Next: T2 `fix/guardrail-error-fail-closed`.
