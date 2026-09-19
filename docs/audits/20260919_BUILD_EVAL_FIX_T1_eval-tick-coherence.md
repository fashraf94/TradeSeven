# Build report — T1 `fix/eval-tick-coherence`

**Date:** 2026-09-19 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Source ruling:** adjudication V1.1 (`docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md`)
**Branch:** `fix/eval-tick-coherence`, cut fresh from `main` @ `6cd3699a` · **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run as the session's first step; `origin/main` == `6cd3699a`. Branch cut clean from `origin/main`. Audit anchors `:1814` / `:805` / `:917` / assembly `:1135` / `:1458` re-located and **VERIFIED**.

---

## Executive verdict

| | |
|---|---|
| **The bug** | `refreshBattleFromDoc` (`:498-502`) refreshes `battle` and **nothing else**. After a forced S7 exit the tick carried two disagreeing pictures of one book: the prompt **header** read the refreshed `battle.scoreState`, while the **ACTIVE POSITIONS CSV** iterated the stale pre-swap `assetScores`. |
| **What the agent saw** | A row for a position it no longer held (sector rendered `Unknown`, because the assembler's own `flattenPortfolioServer(battle.portfolio)` lookup already came from the refreshed doc), **no row at all** for the position that replaced it, and the exited symbol simultaneously listed on the bench it had just been returned to. |
| **The fix** | After any committed forced exit, the decision snapshot is rebuilt from the refreshed battle — using the **same builders** that ran at the top of the tick — before the trigger gate and the prompt build. |
| **SCOPE GUARD** | **DISCHARGED BY MEASUREMENT, NOT ARGUMENT. No STOP.** The persisted score on the fixture is **identical**: `activeScore 26 / bankedScore 0 / currentScore 26 / opponentScore 0` before **and** after. Both runs recorded; see §3. |
| **Failing-file set** | **Unchanged from the gate: empty.** 22 → 23 files, 306 passing, 2 skipped. |
| **Verdict** | **DONE.** Pushed, not merged. One out-of-scope instance of the same defect class filed for separate tasking (§6). |

---

## 1. What changed — `api/cron/agent-evaluate.js` only (+76 / −8)

`agent-evaluate.js` is **not** fenced. The fenced `agentEvalPromptAssembly.js` and `agentSwapExecution.js` were neither edited nor changed in behaviour — only called, and doubled in the new test file (tests only).

### 1.1 The held-position scorer, extracted (`:809-866`)
The ~60-line inline `flatPortfolio.map(…)` became a named `scoreHeldPositions(flat)`. **The body is unchanged** — it computes exactly what it computed before. The only substantive edit inside it: the three `startingPrices[asset.symbol]` reads became `battle.portfolio?.startingPrices?.[asset.symbol]`, so the second call sees the refreshed doc. On the first call these are the same object, so the initial derivation is byte-identical — proven by the whole existing suite, including the `tickStampsEntryGolden.flagOff.json` byte comparison, staying green across the extraction commit-step alone.

### 1.2 Snapshot variables became reassignable (`:723-730`, `:866`)
`flatPortfolio`, `portfolioSymbols`, `benchAssets`, `benchSymbols`, `assetScores` are now `let`. Initial derivations unchanged.

### 1.3 The rebuild (`:1856-1905`), placed after the risk loop and before everything that reads the snapshot

```js
if (forcedSwapsCommitted > 0) {
  flatPortfolio   = flattenPortfolioServer(battle.portfolio);
  portfolioSymbols = …; benchAssets = …; benchSymbols = …;
  assetScores     = scoreHeldPositions(flatPortfolio);
  // prune lockedPositions and riskStatus to what is still held
}
```

`forcedSwapsCommitted` increments only where the swap actually committed — beside the existing `refreshBattleFromDoc` call in the risk loop (`:1826-1827`). A queued-but-failed swap does not count: nothing changed for it to rebuild from.

Placement is deliberate: **immediately after the risk loop**, so it is upstream of *every* consumer of the snapshot — `detectGameplanMeetingTrigger` (`:1939`), the trigger gate (`:2029`) and the prompt build (`:2141`) — not merely upstream of the last one.

**Prune only, never re-run `evaluateRisk`.** `lockedPositions` and `riskStatus` are pruned to currently-held symbols. Re-deriving them would mean a second risk pass on the same tick, which could fire a second exit. A freshly swapped-in position therefore carries no risk row until the next tick — the same state it would have had if the swap had landed a moment later.

---

## 2. What deliberately was NOT rebuilt

`activeScore`, `bankedScore`, `bankedBadgePoints`, `currentScore`, and the `scoreUpdate` entries derived from them (`:917-923`) and the `thresholdHistory.*` dot-paths (`:939`). These are the **end-of-tick score transaction**, which this task must not touch. They are computed *before* the risk loop, so reassigning `assetScores` afterwards cannot retroactively alter them — the numbers were already copied into `scoreUpdate`. The evaluation record's own `scores` block reads the same three locals, so the record and the persisted doc still come from **one source** and cannot diverge (asserted).

---

## 3. The scope guard — measured, both values recorded

> *"If rebuilding changes which persisted score the end-of-tick write would produce on the fixture, do not choose: record both values in the report and STOP that task."*

Discharged by running the **same test row** against both trees and diffing the written `scoreState.*` keys on a tick with a forced KO exit:

| Key | `origin/main` (pre-fix) | this branch (post-fix) |
|---|---|---|
| `scoreState.activeScore` | **26** | **26** |
| `scoreState.bankedScore` | **0** | **0** |
| `scoreState.currentScore` | **26** | **26** |
| `scoreState.opponentScore` | **0** | **0** |

`diff` on the two captures: **identical**. **No STOP.** The single-score-source question stays where it belongs — with the capture build — untouched by this task.

The measurement is now a permanent regression lock (`T1 — the scope guard` describe block), with a `SCORE_DUMP_PATH` hook so a future session can re-measure the same way rather than re-deriving the numbers by reading.

An honest caveat: this is one fixture, not a proof over all inputs. The structural argument in §2 is what makes it general; the measurement is what makes it checked.

---

## 4. Tests added — `api/cron/agent-evaluate.tickCoherence.test.js` (310 lines, 8 rows)

Real `processAgentBattle` on the shared tick harness. The exits are **real** — KO at −0.91x ATR and PG at −1.00x ATR, both past the balanced preset's −0.85x bust buffer, queued by the production risk manager, not stubbed. The fenced assembler is **wrapped, not replaced**: the real builder runs, and its inputs and rendered output are recorded.

`executeSwapServer` is doubled, but **its document effect is not re-implemented** — the double reproduces the one thing the rebuild reads back (slot occupant replaced, outgoing returned to the bench under cooldown, trade appended, `tradeCount` bumped), and the refresh then re-reads that doc through the production path.

| Row | Asserts |
|---|---|
| assembly inputs, **symbol by symbol** | the exited name is gone, seven rows remain, the replacement is scored, and the set handed to the assembler equals the refreshed doc's held set exactly — **never a total** |
| the **rendered** rows | no ghost row; `support,AMD,Technology,Day1,$162.00,$162.00,+0.00%` — scored from its **own** entry rather than inheriting the exited name's loss; the exited name is on the bench and **no symbol is on both sides** |
| per-symbol maps | `riskStatus` and `lockedPositions` pruned to held symbols |
| **two queued risk swaps** | both exits reflected; rendered rows and the scored set agree |
| **scope guard** ×2 | the persisted score equals the pre-fix capture; the record's `scores` block agrees with the persisted write |
| **no forced swap** | the live-context block is **byte-identical** to a golden captured from `origin/main`'s `agent-evaluate.js` |
| anti-vacuity | the golden is a real block holding all seven original names |

The no-swap golden (`tickCoherenceLiveContextGolden.noSwap.txt`) was generated **on the stashed pre-fix tree**, so the byte match is a genuine guarantee rather than a self-comparison.

### Mutation check (BUILD_RULES §2)
The rebuild was disabled (`if (false && …)`). **All 4 coherence rows go red.** The 2 scope-guard rows and the 2 no-swap rows correctly stay green — they assert behaviour the fix does not change, which is exactly their job. Restored, re-verified green.

A note on one assertion that was **wrong in the first draft and caught here**: the bench check originally split the prompt on `'BENCH'`, which also matches `MACRO BEN**CH**MARKS` — silently widening the "bench section" to include the active rows and making the row vacuous. It now anchors on the exact `BENCH (available for swap):` heading. Recorded because a vacuous guard is the failure mode §2 warns about.

---

## 5. Verification

| Check | Result |
|---|---|
| `npx vitest run api/cron/agent-evaluate api/_utils/agentGuardrails` | **23 files passed, 306 passed / 2 skipped** |
| Failing-file set vs. gate | **unchanged — empty** |
| `npx eslint` on both touched files | 3 errors, **all pre-existing** in `agent-evaluate.js`. The new test file lints clean. |
| Repo-level `executeSwapServer` call-site census | **passes with its allowlist untouched** |
| BUILD_RULES §2 review threshold | **not reached** — 3 files + this report. `vite build` not required and not run. |

Linux is the suite of record; no Windows run was performed.

---

## 6. Filed for separate tasking (BUILD_RULES §3 — report, do not fix)

**The same defect class survives on the proposal-approval path.** `handlePendingProposal` executes an approved swap, calls `refreshBattleFromDoc` (`:3611`), and then `return 'continue'` (`:3612`) — the tick proceeds to the trigger gate and prompt build **with the same stale snapshot this task just fixed for S7**. It is outside T1's stated scope ("after any successful forced swap in S7 (and the meeting-suppression pass)"), so it is reported rather than fixed. The fix would be mechanical: the rebuild block is already a self-contained unit and would only need to run again after the proposal handler returns `'continue'`.

**The meeting-suppression pass needs no rebuild and got none.** `runSuppressionDeterministicPass` is followed by an early `return` — no trigger gate, no prompt build — so there is no downstream consumer of the snapshot to correct. Its `scoreUpdate` write is the end-of-tick score transaction, which §2 puts out of scope.

---

## 7. `git diff --stat`

```
 api/_utils/__fixtures__/tickCoherenceLiveContextGolden.noSwap.txt |  75 +++++
 api/cron/agent-evaluate.js                                        |  84 +++++-
 api/cron/agent-evaluate.tickCoherence.test.js                     | 310 ++++++++++++++
 3 files changed, 461 insertions(+), 8 deletions(-)   (before this report)
```

Only the fix, its test, the golden it compares against, and the report.

**STOP.** T1 complete — all four tasks done.
