# Code Review — League Training Slice 3 (agent layer, dev/dark)

**Date:** 2026-06-18 · **Branch:** `claude/affectionate-shannon-nxjwu6` · **Reviewed:** staged working-tree diff (pre-commit)
**Scope:** the Slice-3 agent layer — the training-agent **clone** identity + the deploy-at-flip path. 16 files
(3 new), ~990 insertions, behind `LEAGUE_NEXT_ARC_ENABLED` + the route dark-gate (no user-reachable entry; entry
is Slice 5). `/code-review` is **mandatory** here (≥10 files, BUILD_RULES §2) — this is the durable artifact.

## Method
`/code-review` at **high effort (recall-biased)**: 8 finder angles across 3 parallel agents — correctness
(line-by-line / removed-behavior / cross-file), async/idempotency/concurrency, and cleanup/conventions/altitude —
then disposition + a verify pass (re-run tests + build).

## Verdict
**One showstopper found and fixed; four real refinements fixed; fence clean.** The review caught a genuine
correctness bug the build had missed (training agents would deploy only on day 1). All correctness findings are
resolved and re-verified; the remaining items are consciously-accepted low-severity cleanup.

### Binding constraints — all UPHELD
1. **No fenced edits** — none of the 8 §1 fenced `api/` files appear in the diff (re-checked by name). Every
   fence touch (decide.js deploy, createAgentBattle, scoring/swap/eval) is CALL/READ.
2. **Import rule (§4)** — `trainingClone.js` imports only the zero-import `leagueTournament.js`; the co-located
   `trainingClone.test.js` real-imports it (dependency-surface guard intact, never mocked).
3. **Signal Capture (§5)** — the `training-pick.js` inline trigger is a deploy trigger (not a catalog write) and
   is **classified-logged on every failure branch**, not a swallowed `.catch(() => {})`.
4. **Flag inert** — `LEAGUE_NEXT_ARC_ENABLED` unchanged; the new endpoint is dark-gated like `training-pick`.
5. **No-write-back / identity audit** — re-verified clean in the gated pre-steps (every battle→agent write keys
   on `battle.agentId`; all 6 owner-resolution sites exclude clones).

## Findings & disposition

| # | Sev | File | Finding | Disposition |
|---|-----|------|---------|-------------|
| 1 | **HIGH** | `tournamentOrchestrator.js` | **Training agents deployed only on day 1.** `sweepTrainingActivation` gated on stream-exists (skipped after day 1) and `runWeekdayFanout` excluded training — so nothing issued the Tue–Fri redeploys; the composite agent half froze at day-1 while the user half grew (banking sums daily battles). | **FIXED** — `activateTrainingPod` now does the **daily incumbent redeploy** (shared `buildIncumbentSeats` helper, same as ranked); the sweep runs it **every weekday tick** (handles rolling pods spanning Mondays); the `fanOutDeploys` today's-battle guard keeps it to one fresh battle/agent/day. New test `DAILY REDEPLOY` locks it. |
| 2 | **MED** | `trainingClone.js` | **Partial-clone window.** Clone doc was `.set()` *before* `copyAgentSubcollections()`; a crash between strands a clone with the doc present but empty `rules`/`bundles`, which `cloneSnap.exists` then marks `existing` forever → decide.js re-projects an empty loadout → inert agent. | **FIXED** — copy subcollections **first**, write the clone doc **last** as the completion sentinel; an interrupted provision re-runs (idempotent set-by-id) instead of stranding. |
| 3 | **MED** | `tournamentOrchestrator.js` | **Cross-pacing gap.** The training sweep and the same-tick ranked duty used separate `pacing` objects → deploys could fire <20s apart, breaching the 3/min floor. | **FIXED** — the tick now creates ONE `pacing` and threads it through the sweep + `runMondayPipeline`/`runWeekdayFanout` (additive param, default preserves direct-caller behavior). |
| 4 | **LOW** | `tournamentOrchestrator.js` | `sweep.swept` overcounted on budget-defer (deferred pods looked handled). | **FIXED** — `summary.deferred` tracks the unprocessed remainder; log updated. |
| 5 | **LOW** | `activate-training-pod.js` | `maxDuration: 180` undercut the comment's stated 300s headroom; a slow Sonnet board + paced deploys could approach it. | **FIXED** — bumped to 300 (the orchestrator-cron ceiling); a kill mid-fan-out is idempotent-recoverable by the backstop. |
| 6 | **LOW** | `src/App.jsx` | Literal `'training-agent-'` duplicated the `TRAINING_CLONE_ID_PREFIX` codec at two ranked-surface filters. | **FIXED** — both now import and use `TRAINING_CLONE_ID_PREFIX` (the leak-prevention invariant can't silently drift). |
| 7 | info | `training-pick.js` | Fire-and-forget trigger may be dropped by serverless freeze. | **ACCEPTED (by design)** — founder-chosen "internal endpoint + morning backstop"; the daily-redeploy sweep (Finding 1 fix) is the reliability guarantee, and the trigger's failures are classified-logged when they run. |
| 8 | info | concurrency | Inline endpoint + morning sweep can briefly race to activate one pod (duplicate board spend; rare double-battle). | **ACCEPTED** — bounded by the today's-battle guard + decide.js's one-active-battle check (the same final serialization ranked uses); training is off-ladder. Module header made honest; no pod-lock added (avoids complexity on a dark slice). |
| 9 | info | `trainingClone.js` + 6 sites | The clone-exclusion predicate (`isTrainingClone !== true`) is repeated across the audited owner-lookups. | **LOGGED** — trivial, self-documenting; the exhaustive Pre-step-2 audit found all sites. Not extracted (a shared helper wouldn't prevent a missed site). |

## Re-verification after fixes
- `vitest run` (7 suites: trainingClone, orchestrator, agentBoards, trainingLifecycle, cpu, boardAutoCommit,
  leagueTournament): **231 passed**.
- `npm run build`: **green** (✓ built; pre-existing chunk-size warning only).
- `eslint` (new/changed files): **0 non-`process` errors** (the `process`-undef is a project-wide config gap —
  untouched `decide.js`/cron handlers flag it identically; not introduced here).
- Fence re-check: **no §1 fenced file in the diff**.

**Conclusion:** ship-ready for the dev/dark Slice-3 plumbing, pending founder review before merge. Items 7–9 are
tracked notes (serverless-trigger best-effort, off-ladder concurrency, predicate duplication), not blockers.
Backlogged separately (founder Flag 2): a nightly retire/cleanup sweep for accumulated per-pod clone docs.
