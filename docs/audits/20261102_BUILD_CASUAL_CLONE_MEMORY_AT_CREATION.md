# FQ-2: a new casual clone starts with the agent's memory (build report)

November 2, 2026. Base `main` `31574600`, code head `e43c73e7`. Founder ruling FQ-2 on PR #1019; rulings FQ2-A and FQ2-B given on the STOP report the same day.

## 1. Verdict

| | |
|---|---|
| **Outcome** | Built, pushed as a draft PR, STOP. Not merged. |
| **What changed** | A player's first casual game now carries the ranked agent's memory, the same as every later deploy. Nothing else about creation changed. |
| **Files** | 2: `api/_utils/casualClone.js` and `api/_utils/casualClone.test.js`. Below the review threshold. |
| **Starting check** | STOPPED once, on row `casualClone.test.js:282`. Ruled by FQ2-A and FQ2-B, then built (§2, §3). |
| **Checks** | Full Linux suite exit 0, `Test Files 1268 passed \| 8 skipped (1276)`. `lint:gate` exit 0. `vite build` exit 0. |
| **Review** | One lens and one refuter. No defect. Mutation: 10 of 10 killed. |
| **Fence** | Every fenced file is byte-identical to `main`. The paragraph in §9 needs your signature. |
| **Founder questions** | None open. |

## 2. The starting check (VERIFIED at `40641486`; the clone files are unchanged at `31574600`)

Session start: local branch `claude/casual-clone-memory-creation-857f88` (the app's name for this worktree), HEAD `40641486` equal to `origin/main` after `git fetch origin`, clean tree. `main` then took PR #1020, so the branch was fast-forwarded to `31574600` before any code. None of the clone files changed in that merge.

**a. The gap was real.** `agentDeploy.js:196` calls the endpoint once; `ensure-casual-clone.js:72` calls `ensureCasualClone`. With no doc, `isAuthentic` was false at `casualClone.js:144`, so `:179` skipped the re-sync arm, and `:231`, `:238` and `:252` wrote the doc with `memory: []`. The client then posted the clone's id to `decide` (`agentDeploy.js:233–236`). `decide.js:157–163` read the clone, `decide.js:431` passed it to `buildStrategyUserPrompt`, and `agentPromptAssembly.js:95–96` skipped the memory block. The only re-sync call, `casualClone.js:212`, sits in the arm that was skipped.

**b. Every writer of `memory` on a casual clone; no second copy added.**

| Writer | Where | After this build |
|---|---|---|
| Creation | `casualClone.js:80`, through `:249`, written at `:263` | Takes the memory (R-FQ2-1) |
| Squat heal | Same builder, written at `:255` | Takes the owner's memory (FQ2-A) |
| Vanished-clone rebuild | Same builder, `:236` then `:263` | Takes the memory. Same arm as creation |
| Re-sync | `casualClone.js:108`, written at `:223` | Same rule, through the one helper |
| After a game, forwarded | `reflect.js:217–218` into `:534–541` | Unchanged. Writes the parent from a fresh read and never copies the clone's array |
| After a game, redirect refused | `reflect.js:220` into `:520–523` | Unchanged code. See note FQ2R-2 in §7 |

`src/services/agentService.js:286` can also write memory, but no live code calls it.

**c. Training clones keep `memory: []`.** `trainingClone.js:134–161` is a separate builder with its own `memory: []` at `:152`, and `trainingClone.js` imports nothing from `casualClone.js`.

**The STOP.** The ruled line was tried in a throwaway Linux worktree at `40641486`. The full suite failed 2 of 28,250 rows: the ruled row `:175`, and the squat-heal row `:282`, which the ruling did not name. That is the stop rule's fourth item. The STOP report is `20261102_STOP_CASUAL_CLONE_MEMORY_AT_CREATION.md` in `Documents/FantasyTrades`.

## 3. The rulings

| Ruling | Text | Built |
|---|---|---|
| **R-FQ2-1** | One rule for the clone's memory. Change only `memory`. | `inheritedMemory`, `casualClone.js:53`, called at `:80` and `:108` |
| **FQ2-A** | Yes: a healed clone takes the ranked agent's memory. Keep an explicit assertion that the planted entry is gone. | `casualClone.test.js:329–330`, both lines |
| **FQ2-B** | Yes: rows that cannot be red before the change show green before and after, with a named mutant each. | §5, §8 |

## 4. Files changed

- `api/_utils/casualClone.js:48–54`: the helper, private and pure.
- `api/_utils/casualClone.js:56–65`: the builder's doc comment now names memory and the third difference from the training builder.
- `api/_utils/casualClone.js:77–80`: the reworded comment, and `memory: inheritedMemory(rankedAgent)`.
- `api/_utils/casualClone.js:108`: the re-sync calls the helper.
- `api/_utils/casualClone.test.js`: the rows in §5, plus two comment moves (`:5`, and `RANKED`'s "MUST NOT carry" comment now sits below `memory`).

`stats`, `activeBattleId`, `deployingAt`, `lastDeployedAt` and `pendingConsolidation` are untouched.

## 5. The rows, red then green

Red was run against the unchanged `casualClone.js`, with vitest exit 1: 4 failed of 35. Green was run with the helper in, exit 0.

| Row | Before | After |
|---|---|---|
| `:186` memory equals the ranked agent's (split from `:175`) | **Red**: `[]` vs `[{gameId:'old'}]` | Green |
| `:200` creation and re-sync give the same memory | **Red**: `[]` vs two entries | Green |
| `:238` a first game reads the same strategy prompt a later deploy would | **Red**: no `RECENT GAME MEMORY` | Green |
| `:329–330` a healed clone holds the owner's memory, and the planted entry is gone | **Red**: `[]` vs `[{gameId:'old'}]` | Green |
| `:177` stats and pointers still fresh (split from `:175`) | Green | Green. M8 proves it can fail |
| `:190–198` no, null, string or object memory gives `[]`, at creation and at re-sync (4 rows) | Green | Green. M1 and M2 prove they can fail |
| `:209` a training clone still starts with `memory: []` | Green | Green. M7 proves it can fail |

Row `:238` is the acceptance check, and it was added beyond the four asked for. It runs a real create and a real re-sync through `ensureCasualClone`, then renders the fenced `buildStrategyUserPrompt` for both. It calls that function and edits nothing.

## 6. Checks at `e43c73e7`

Linux, in a worktree of `~/pd-ci`, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, Node 20.20.2. The worktree is removed.

| Check | Result |
|---|---|
| Full suite | Exit 0. `Test Files 1268 passed \| 8 skipped (1276)`. `Tests 28235 passed \| 89 skipped (28324)`. 264.6 s |
| `lint:gate` | Exit 0 |
| `vite build` | Exit 0 at `e43c73e7`. The pushed head's result is in the PR description |

The emulator rules suite did not run: no `firestore.rules` change, and the clone is written by the Admin SDK.

## 7. The review

Below the BUILD_RULES §2 threshold, so focused, as the prompt set. One Sonnet lens, then a refuter, each on its own `git archive` snapshot of `e43c73e7`. The question: does a player's first casual game now carry the same memory a later deploy would, and does anything else about creation change?

**Answer: yes, and nothing else changes.** Memory is the only creation field that moved, and the decide prompt is the one place a clone's memory is read for a trade decision.

| ID | Claim | Refuter | Disposition |
|---|---|---|---|
| Verdict | Same memory as a later deploy; memory is the only change | **NARROWED**: it holds, with the decide prompt named as the reader | Accepted |
| FQ2R-1 | No downstream reader behaves differently | **REFUTED** as worded: `decide.js:431` reads the clone. That reader is the purpose of this build, and the other readers are unchanged | No change |
| FQ2R-2 | When a redirect is refused, the clone's window starts with inherited lessons | **NARROWED**: already reachable today after any re-sync, now one game earlier. Inherited lessons cannot reach the consolidation floor: a clone-side turn needs 5 games and the window keeps 5 entries, so none is left | No change. Edge case: it needs a missing parent or a poisoned `rankedAgentId` |
| FQ2R-3 | `reflect.js:529` says "stale/empty memory" | **NARROWED**: "empty" is out of date, "stale" still holds. A comment only | Not edited: outside this PR's files. Recorded below |
| FQ2V-1 | `inheritedMemory` returns the ranked agent's array by reference | Found by the refuter. Same as the re-sync has always done. Writers copy, and Firestore serialises on write | No change |

Also checked and clean: doc size (5 entries, already copied by the re-sync), a squat's memory cannot survive a heal (`set()` overwrites the whole doc), and no guard or census depends on creation memory being `[]`.

**Two comments left stale, on purpose.** The stop rule bars edits outside `casualClone.js` and its tests, and neither needs one to work: `api/agent/reflect.js:529` ("stale/empty memory") and `api/_utils/cloneManifestParity.guard.test.js:61` ("what a clone never takes", above a `memory` fixture, still true for a training clone). Both can go in any later change to those files.

## 8. Mutation

Run in its own snapshot, byte-restored after each. Baseline exit 0 over 82 rows. 10 of 10 killed.

| ID | Mutant | Killed by |
|---|---|---|
| M1 | Helper loses the array check | The four fallback rows, plus `ensure-casual-clone.test.js`'s re-sync row |
| M2 | Helper accepts any non-null value | The string and object fallback rows |
| M3 | Helper always returns `[]` | `:186`, `:238`, `:329`, the re-sync row |
| M4 | Creation goes back to `[]` | `:186`, `:200`, `:238`, `:329` |
| M5 | Re-sync goes back to `[]` | `:200`, `:238`, the re-sync row |
| M6 | Creation drifts from re-sync (last entry only) | `:200` alone |
| M7 | A training clone copies memory | `:209`, `trainingClone.test.js:190` |
| M8 | Creation inherits stats and `activeBattleId` | `:177`, "creates the clone" |
| M9 | A heal keeps the squat's memory | `:329` |
| M10 | Same, with the `toEqual` line removed | `:330` alone: the planted-entry assertion fails on its own |

## 9. Fence contact, for the founder's signature

From the first deploy after this reaches production, a player whose casual clone is created then gets the ranked agent's memory in that first casual game's strategy prompt (`agentPromptAssembly.js`, fenced and unchanged). Existing clones are unaffected, because they already re-sync. Training clones are unchanged.

## 10. After merge

No screen shows a strategy prompt, so there is no on-screen check. A player whose ranked agent has no memory yet sees no difference, by design.

## 11. Founder questions

None.
