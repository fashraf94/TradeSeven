# Training-Pod Status-Transition P0 — R2–R4 Build & Activation Report

**Date:** July 22, 2026 · **Repo:** `fashraf94/TradeSeven` · **Branch:** `claude/training-pod-status-transition-p0-oz1bp1`
**Governing docs:** `TRAINING_POD_STATUS_P0_PHASE0_RULINGS_JUL22_2026.md` (supersedes Fix Spec V1) · `audits/20260722_TRAINING_POD_STATUS_P0_PHASE0_DISCOVERY.md`
**Status:** built, tested, adversarially reviewed, pushed. **HOLD before PR** — founder runs the pre-merge scoped review, opens the PR, and merges.

---

## 0. Executive summary (founder)

The Phase 0 premise reversal was accepted: the training-pod status machine **already advances pods to BATTLE** at HEAD; the "never advances" diagnosis was stale, and the ~22-battle starvation is **creation-side** (R1 confirmed the orchestrator is registered, firing, and healthy). So no transition code was written and no flag was wrapped around the working path. What this branch adds is the **one missing disposition** — a way to retire the pre-existing stuck pods (and any future stragglers) **without** manufacturing garbage battles (D1 ruling) — plus a regression lock so the now-working chain can never silently revert.

| Ruling item | Delivered |
|---|---|
| **R1** verify | Orchestrator cron **registered + firing + healthy** (`vercel.json:161-164`). Budget **37/40** (only 3 slots free → R3 rides the existing tick). Starvation is creation-side, out of P0 scope. |
| **R2** the EXPIRED mechanism | New terminal `GROUP_STATUS.EXPIRED`; edges only from FORMING/DRAFTING/AWAITING_OPEN; transactional `expireGroup` with a state+version precondition; `{expiredAt,expiredReason,expiredBy}` markers; never hard-deletes. Mandatory consumer census (server 33 SAFE / client amended / tests clean). |
| **R3** two callers | Rolling backstop behind `POD_EXPIRY_SWEEP_ENABLED` (default off, rides the tick, zero new cron) + founder-gated `POST /api/admin/expire-stuck-training-pods` (dry-run by default). Both share one training-only staleness core. |
| **R4** regression lock | One integration test drives the canonical chain + `completeBattle`, asserting the eligibility stamp, `MODE_MULT 0.6`, and the transitions the stale diagnosis said never fire. |

**Gates:** fence **clean** (zero fence files across the branch) · **5469 tests pass, 0 failures** · flags-off **byte-identical** (default `POD_EXPIRY_SWEEP_ENABLED=false` → orchestrator suite unchanged; R2 inert with no live EXPIRED writer) · **two adversarial diff reviews** run (R2, R3), all confirmed findings applied.

---

## 1. Commits on the branch

| SHA | Scope |
|---|---|
| `3dd2de5c` | docs: Phase 0 discovery + founder rulings memo → `docs/` |
| `0a8432e3` | feat: R2 EXPIRED terminal-disposition + R4 regression lock |
| `54adb727` | fix: R2 adversarial-review findings (icon glyph, dev-screen color map, render-branch test) |
| `fecc2421` | feat: R3 stale-pod expiry callers (rolling backstop + cleanup endpoint) |
| `356120ca` | fix: R3 adversarial-review findings (cutoff canonicalization, anchor-arrival grace, malformed-body 400) |

Whole-branch diff vs `origin/main`: **26 files, +1045 / −15**.

---

## 2. R2 — the unified EXPIRED terminal-disposition (the only new machinery)

- **Enum** (`src/constants/leagueTournament.js`): `GROUP_STATUS.EXPIRED = 'expired'` — terminal, carries `{expiredAt, expiredReason, expiredBy}`, reachable only from the three pre-BATTLE states.
- **Transition table** (`api/_utils/tournamentGroupService.js`, `LEGAL_TRANSITIONS`): `FORMING/DRAFTING/AWAITING_OPEN → EXPIRED` added; **no `BATTLE → EXPIRED`**; `EXPIRED` is terminal (`[]`). Because a live BATTLE pod has no edge to EXPIRED, the **expire-vs-advance race is closed by construction** — a pod that raced to BATTLE throws `illegal transition`, which the caller treats as an idempotent skip.
- **`expireGroup(db, groupId, {reason, by, now, expectedStatus, expectedUpdatedAt})`** — transactional read-check-write with a **state+version precondition** (the `expectedStatus`/`expectedUpdatedAt` the caller pins), writes the marker fields atomically with the status, and NEVER hard-deletes (the `releaseSlotSeat` delete precedent was explicitly not adopted — the audit trail survives).
- **Consumer census** (mandatory, per the ruling): a 12-agent adversarial sweep + the R2 review classified every pod-status consumer. **Server: 33 SAFE** (positive `=== BATTLE`/`=== FORMING` gates ignore EXPIRED exactly like the other pre-BATTLE states; no exhaustive group-status switch, no status aggregation, no `where('status','in',...)` on tournamentGroups). **Client:** 4 pure display mappers (`arenaStateMap`, `leagueTrainingBattleFraming`, `leagueAdapter.groupStatusToPodStatus`, `leagueClimbAdapter`) + 3 render paths (`DraftBoardRoom`, `TrainingDraftRoomScreen`, `LeagueTrainingBattleView`) amended to read EXPIRED as terminal, and `TournamentDevScreen`'s status-color map keyed. The client selectors (`selectMyGroup`, `selectMyTrainingPod`) are positive-set membership → EXPIRED excluded → a retired pod is correctly not "active/mine," so the user can form a fresh pod.

**Inertness:** nothing calls `expireGroup` and nothing writes `status: EXPIRED` in a live path within R2 — the mechanism is inert until R3 wires a caller. R2 alone is byte-identical for every existing pod.

---

## 3. R3 — the two callers (one shared training-only staleness core)

Both callers route through **`expireStaleTrainingPods`** (`api/_utils/trainingLifecycle.js`), so their predicate + staleness rules can never drift.

- **Training-only predicate (D1):** `isTraining === true && isLiveDraft !== true` — necessary AND sufficient (training and competitive-slot are mutually exclusive), with the explicit `isLiveDraft` exclusion as defense-in-depth. The `PRE_BATTLE` queries never return a BATTLE/COMPLETE/EXPIRED pod, and `expireGroup`'s `assertTransition` re-gates at write time. It cannot touch a ranked pod, a competitive slot pod, or a live/terminal pod.
- **Staleness (per state):** FORMING → orphan past `TRAINING_TUNING.POD_EXPIRY_STALE_MS` (48h) since last progress. DRAFTING → wedged past the threshold on the live draft's `lastActivityAt` (the 3h idle sweep completes idle drafts first, so this only catches genuinely wedged ones). AWAITING_OPEN → **never expired while its anchor is in the future** (legitimately pending); once the anchor has arrived, stale past the threshold measured from the **later of entry and the anchor's open instant** — so a weekend/holiday-spanning pod gets its full grace *after* arrival, honoring "a legitimately slow multi-day pod must never qualify."
- **Rolling backstop** (`api/_utils/tournamentOrchestrator.js`): runs each weekday-morning tick **after** `flipAwaitingOpenPods` (so a pod that legitimately advances this tick is gone before the sweep sees it), behind **`POD_EXPIRY_SWEEP_ENABLED` (default false)**. Flag-off → the block never runs, the tick is byte-identical. **Zero new cron slots.**
- **One-time cleanup** (`api/admin/expire-stuck-training-pods.js`): `POST`, admin-secret gated, **DRY-RUN by default** — `apply` must be an explicit boolean `true` to write. Carries a **cutoff timestamp** (`cutoffIso`, canonicalized to UTC-Z) and a `thresholdHours` override; malformed input → 400; idempotent under crash-retry.

---

## 4. R4 — the regression lock

`api/cron/trainingPodCanonicalChain.regression.test.js` drives a training pod through the canonical status chain (`computeHandoffWrites` + `assertTransition`: FORMING→DRAFTING→{BATTLE, AWAITING_OPEN}→BATTLE) and its battle through the **same** `completeBattle` the Mastery arc converted — asserting the `masteryEligibility` stamp lands for the training human battle and never for a CPU seat, and that the resolved award carries **`MODE_MULT 0.6`** (training). This pins the now-working behavior against a silent reversion to "stuck at Day 0."

---

## 5. Gate evidence

- **Fence gate:** `git diff --name-only origin/main HEAD` contains **zero** of the 8 fence files; the fenced-as-concept surfaces (`createAgentBattle`, `canonicalOpenSweep`, banking) are engaged only by call/auto-selection downstream of the transition, never by edit.
- **Tests:** `npx vitest run` → **5469 pass, 53 skipped, 0 test failures**. (44 file-load "failures" are pre-existing `research/level-study` `node:test` files vitest can't parse — they import nothing on this branch and are unrelated.)
- **Flags-off byte-identity:** `POD_EXPIRY_SWEEP_ENABLED = false` by default → the orchestrator suite (47 tests) is unchanged; R2 has no live EXPIRED writer.
- **Adversarial diff review:** R2 review (12-agent) → fixed a real icon-glyph bug + a missed dev-screen color map + an untested render branch. R3 review (focused) → no blocker/high; fixed F1 (cutoff over-expiry via lexical compare), F2 (AWAITING_OPEN grace from anchor arrival), F4 (malformed-body 400). F3 (DRAFTING-resume race) accepted as negligible (mitigated by the 3h idle sweep running first); F5 (sub-4-player FORMING) cannot manifest (the factory enforces exactly 4 players).

---

## 6. Activation runbook (post-merge, founder-gated — the safe order)

1. **Merge** (after the pre-merge scoped adversarial review). Nothing changes in production yet: `POD_EXPIRY_SWEEP_ENABLED` is false and the cleanup endpoint is inert until called.
2. **Cleanup — DRY-RUN first.** `POST /api/admin/expire-stuck-training-pods` with the admin secret and **no `apply`** (optionally a `cutoffIso` bounding it to the pre-fix era). It returns the census — `scanned / matched / byStatus` — and writes nothing. Confirm the count matches the founder-side census expectation.
3. **Cleanup — apply.** Re-`POST` with `{ "apply": true }` (same `cutoffIso`). Idempotent; safe to re-run. The retired pods land in EXPIRED, earn nothing, and drop out of the "active pod" selectors.
4. **Flip the sweep after a smoke.** Set `POD_EXPIRY_SWEEP_ENABLED = true` in a one-line follow-up (not this PR) once the cleanup + a smoke look right. From then the rolling backstop retires future stragglers each weekday tick.
5. **Founder smoke** per the acceptance criteria: watch a fresh training pod through its canonical chain (which R1 confirmed already works), and — separately — confirm a stuck FORMING/AWAITING_OPEN pod expires rather than stranding.

**Note on the real unblock:** expiring stuck pods does **not** by itself grow the corpus — the ~22-battle starvation is creation-side. See `LAUNCH_READINESS_WATCH_LEDGER.md` **X4** (the `snake-draft-autopick` 500 fatal, a candidate creation-side root cause) for the separate lead.

---

## 7. Acceptance mapping (rulings memo)

- **R1 verification** — orchestrator registration confirmed repo-side; firing/health confirmed founder-side; census number pending (gates only the cleanup's apply, which is dry-run-first). ✔
- **R2 EXPIRED mechanism** — status + edges + markers + transactional precondition + consumer census. ✔
- **R3 two callers** — cleanup (dry-run, cutoff, training-only, retry-safe) + rolling backstop (`POD_EXPIRY_SWEEP_ENABLED`, existing cadence). ✔
- **R4 regression lock** — stamp + `MODE_MULT 0.6` + canonical chain. ✔
- **Gates** — `/code-review`-equivalent adversarial reviews, fence gate, flags-off byte-identity, HOLD before PR. ✔ (The scoped pre-merge adversarial bundle is generated separately for the founder's review.)
