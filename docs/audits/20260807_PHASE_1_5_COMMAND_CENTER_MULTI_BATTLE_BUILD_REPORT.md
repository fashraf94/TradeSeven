# Phase 1.5 — Command Center Multi-Battle · Build Report

**Date:** 2026-08-07
**Branch:** `claude/command-center-multi-battle-p7lb42` (fresh off `origin/main` `3c9968b3`)
**Spec:** `20260807_PHASE_1_5_COMMAND_CENTER_MULTI_BATTLE_SPEC_V1.md` · **Phase 0 discovery:** accepted, founder-ruled.
**Flag:** `CASUAL_CLONE_CONCURRENCY_ENABLED` (`src/config/featureFlags.js:235`, default **`false`** — built **dark**, no new flag).
**Status:** Built behind the existing flag. Suites + build + lint green. 3 adversarial review passes. **Pushed for founder smoke. Flag flip is a separate one-line PR after merge.**

---

## Executive verdict

| Acceptance criterion | Status |
|---|---|
| **#1** Ranked live → BaggerBomb deploy **enabled** flag-on; deploying starts a second concurrent battle under the casual clone | ✅ Delivered (UI gate per-type; backend already per-clone from Phase 1) |
| **#2** BaggerBomb live → second BaggerBomb **blocked with a reason naming the conflict** | ✅ Delivered ("A BaggerBomb battle is already running — one at a time.") |
| **#3** Ranked + training + BaggerBomb concurrently | ✅ Delivered (training filtered from this card by design; ranked + BaggerBomb co-render) |
| **#4** No card resolves via unsorted index; selection deterministic + labeled by type | ✅ `liveBattles[0]` retired flag-on → `sortLiveBattles` + per-type label |
| **#5** Voided-group battles remain excluded (non-regression) | ✅ Exclusion untouched in the poll (upstream); optimistic-append bypass pinned safe |
| **#6** Flag-off byte-identical; whole feature flips as one unit | ✅ Every flag-on branch pairs with a flag-off path that reduces to today's behavior |
| **#7** No fenced file edited | ✅ `decide.js` / `agentBattleService.js` **read** only; no fence contact |

**One thing to know for the flip:** flipping the flag makes the Delight **Task 4 "BATTLE LIVE sky crossover"** reachable (a deploy hold becomes armable beside a live ranked battle). It's a **feel-tuning check for the flip PR**, not a blocker here — detailed below.

---

## What was built (file:line map, all non-fenced)

**The gate (one shared source):** `src/utils/commandCenterLiveBattles.js`
- `classifyBattleType` / `battleTypeLabel` — `Boolean(groupId)` discriminator (founder-ruled): groupId ⇒ Ranked, else BaggerBomb.
- `hasLiveBaggerBomb` — the per-type CTA gate (requires `status==='active'` defensively).
- `sortLiveBattles` — deterministic order (ranked → most-recent → id; comparator returns 0 on equal).
- `deriveDeployGate({ liveBattles, agent, concurrencyEnabled })` — the **one** function both shells consume: returns `{ orderedLiveBattles, deployBlockedByLive, deployBlockReason, equipLocked }`. Flag-off every value reduces to the legacy `isLive` gate. `DEPLOY_BLOCK_REASON` single-sources the reason string.

**Mobile shell:** `src/components/Dashboard/CommandDashboard.jsx`
- Derivations (`:149-151`) via `deriveDeployGate`; `deployDisabled` now carries `deployBlockedByLive` (`:166`).
- Read-section deploy affordances gated on `deployBlockedByLive` (`:378-424`); block-reason line (`:373-377`).
- Deploy/Manage **split** (`:498-540`): `{!deployBlockedByLive && …Deploy}` + `{isLive && …Manage}` — both render flag-on beside a live ranked battle; mutually exclusive flag-off (byte-identical).
- G2 `podSessionConflict` heads-up suppressed flag-on (`:501` `{!concurrencyOn && …}`).
- Manage maps `orderedLiveBattles` with `<ManageStation … showType />` (`:527-529`); flag-off single legacy card.
- Equip label bound to `equipLocked` (`:476-477`); `ScoutingBoardSheet isLive={deployBlockedByLive}` (`:577`).

**Desktop shell:** `src/components/Dashboard/CommandDashboardDesktop.jsx` — same gate via `deriveDeployGate` (`:99-101`); `ReadColumn isLive={deployBlockedByLive} blockReason={deployBlockReason}` (`:229-230`); `EquipBench isLive={equipLocked}` (`:235`); DeployCard gate `{!deployBlockedByLive && …}` (`:239`); Manage maps `orderedLiveBattles` with `showType` (`:264-266`); `ScoutingBoardSheet isLive={deployBlockedByLive}` (`:310`).

**Card:** `src/components/Dashboard/ManageStation.jsx` — `showType` prop; header label **and** the "· vs CPU" line both derive from **one** `classifyBattleType(battle)` call (§9). Flag-off (no `showType`) → "Battle live … · vs CPU" (byte-identical).

**Desktop CTA:** `src/components/Dashboard/desktop/ReadColumn.jsx` — new `blockReason` prop, rendered above the button row.

**App poll:** `src/App.jsx:6636-6646` — comment only (ruling #5): pins that the optimistic-append bypass of the voided-exclusion is safe **only** because a Command-Center deploy is always casual (no groupId, un-voidable); a future groupId append must route through the exclusion.

**Tests:** `commandCenterLiveBattles.test.js` (+28 unit tests: classify, label, gate truth table, sort, `deriveDeployGate`, defensive active-status); `holdDuringLiveBattle.test.js` (Task 4 guard updated flag-aware); `commandCenterMultiBattle.wiring.test.js` (new source-guard for both shells' wiring + §9 binding).

---

## Founder rulings — execution record

1. **liveBattles[0] → option (a), show all.** ✅ Manage maps `sortLiveBattles(liveBattles)`, each `<ManageStation showType>`; label off `Boolean(groupId)`.
2. **Flag-gate the relaxation.** ✅ Entire restructure behind `CASUAL_CLONE_CONCURRENCY_ENABLED`; flag-off globally blocking + single card, byte-identical; flag-on per-type.
3. **Fold in G2 + ManageStation "vs CPU".** ✅ G2 heads-up suppressed flag-on; label type-derived (and "· vs CPU" correctly kept for BaggerBomb, dropped for Ranked).
4. **Track ScoutingBoardSheet:87 separately.** ✅ Not folded. Filed below (§Separate tasking). The `isLive` prop passed to it is the per-type value; its internal `activeBattleId` fallback (`:87`) is untouched and stays dormant (we always pass a non-null `isLive`).
5. **Pin the optimistic-append reasoning.** ✅ Comment at `App.jsx:6638`.

---

## Flag-off byte-identity (acceptance #6)

`deriveDeployGate` with `concurrencyEnabled:false` yields `deployBlockedByLive = isLive`, `equipLocked = isLive`, `deployBlockReason = null`, `orderedLiveBattles = liveBattles`. Therefore, flag-off: `deployDisabled` = `deploying || isLive || !agent`; Read buttons gate on `isLive`; `{!deployBlockedByLive && Deploy}{isLive && Manage}` are mutually exclusive (== the old `{!isLive ? Deploy : Manage}`); `podSessionConflict` renders as today (`!concurrencyOn` true); Manage renders the single legacy `<ManageStation battle={liveBattle}>` (no `showType` → "Battle live … · vs CPU"); Equip label on `isLive`. **No visible change with the flag off** — the whole feature flips as one unit.

---

## Cross-feature interaction — flag-flip consideration (not a blocker)

`docs/.../holdDuringLiveBattle.test.js` guards a Delight **Task 4** premise: *mid-battle, every deploy hold is unmounted or disabled, so the "BATTLE LIVE sky crossover" (~45% of the press) is unreachable, and `INTENT_PEAK` is tuned against RESTING alone.* Phase 1.5 **relaxes** this flag-on: a BaggerBomb deploy hold is **armable while a ranked battle is live** (that is the concurrency the feature delivers), and `DEPLOY_SKY_COUPLING_ENABLED` is already on. So **when the concurrency flag flips**, that crossover becomes reachable and `INTENT_PEAK`'s RESTING-only justification wants a **preview feel-check** at the flip. This is documented in the guard's header + assertions and is flag-off-inert today.

---

## Constraints & fence

- **No fenced file edited.** `api/agent/decide.js` (per-agentId active-battle lock, `:690-694`/`:1339-1341`) and `api/_utils/agentBattleService.js` (`createAgentBattle` doc shape) were **read** to confirm the per-clone lock and the `gameMode`/`groupId` joint-stamp; neither edited. The build needed no `decide.js` change (Phase 0 §Q2 confirmed).
- **No new flag; no schema/persistence change.** Reused `CASUAL_CLONE_CONCURRENCY_ENABLED`; discriminator (`groupId`) already on the doc.
- **Voided-group exclusion** (`excludeVoidedGroupBattles`, `App.jsx:3950`) untouched, still upstream of the card.

---

## Coverage

- **Vitest:** `429 files / 7298 passed`, 53 skipped, **0 failed** (`npx vitest run`).
- **Build:** `npx vite build` ✅ (the only check that parses `App.jsx`).
- **Lint:** `npm run lint` → 1610 problems, **identical to the pre-change baseline** (verified via `git stash`) — zero new lint errors. (Baseline is a large pre-existing debt across unrelated files; the `motion`-unused flags are a codebase-wide eslint-config quirk on `<motion.*>` JSX.)
- **Mutation sense-check:** each new guard fails under the defect it names (e.g. flipping `deployBlockedByLive`→`isLive` reddens the CTA truth table; a raw `groupId` re-read in ManageStation reddens the §9 binding guard; a `return 1` in the comparator reddens the contract test).

---

## Adversarial review ledger (BUILD_RULES §2 — 3 passes, high effort)

Reviews run via the `code-review` tool at high effort; each finding dispositioned.

**Pass 1 — 4 findings, one root cause (CONFIRMED, all fixed):** deploy *guards* migrated to `deployBlockedByLive` but section-visibility/label consumers left on `isLive`. Fixed by splitting Deploy/Manage (both render flag-on), binding the equip label to `agent.activeBattleId` (§9), and dispositioning `activeStage` (see below).

**Pass 2 — 5 findings (3 CONFIRMED-fixed, 2 dispositioned):**
- Duplicated gate logic across shells → **extracted `deriveDeployGate`** (one source).
- ManageStation dropped "· vs CPU" for BaggerBomb (which IS vs-CPU) → **fixed** (kept for BaggerBomb, dropped for Ranked).
- `sortLiveBattles` comparator returned 1 on equal ids → **fixed** (returns 0; contract-correct).
- `activeStage` on `isLive` → **deliberate disposition** (below).
- `classifyBattleType` prose-only invariant → **deferred** (below).

**Pass 3 — 5 findings (3 CONFIRMED-fixed, 1 REFUTED, 1 comment-fix):**
- `deriveDeployGate` took `isLive` as a param (drift surface) → **fixed** (derived internally from `liveBattles`).
- `hasLiveBaggerBomb` ignored status → **fixed** (requires `status==='active'`; guards a stale COMPLETED casual from latching the CTA blocked).
- ManageStation re-derived ranked-ness from raw `battle.groupId` (§9 spirit) → **fixed** (both label + vs-CPU from one `classifyBattleType` call; `showType` prop).
- *"Flag-flip sequencing hazard — flipping the flag before the clone backend lands → dead-end deploy"* → **REFUTED.** The clone backend is behind the **same** flag and merged in Phase 1: `agentDeploy.js:37` and `ensure-casual-clone.js:48` both gate on `CASUAL_CLONE_CONCURRENCY_ENABLED`. When the flag flips, the deploy routes to `casual-agent-{uid}` and `decide.js`'s per-clone lock permits it beside a ranked battle — no rejection. UI and backend flip as one unit by construction (spec's design). No code change.
- Comparator equal-id branch "dead code + misleading comment" → the `return 0` is **kept** (comparator-contract hygiene, required regardless of occurrence); the **rationale comment was softened** to not claim a specific occurring scenario.

### Deliberate dispositions (not defects)
- **`activeStage` (loop rail) stays on `isLive`.** The rail marks the *furthest beat the daily loop has reached*; a concurrent BaggerBomb deploy is a secondary action that doesn't rewind the loop, so a live battle highlights Manage. Byte-identical flag-off. Commented in both shells. **Founder-overridable at smoke** if you'd prefer the rail follow deploy-availability.
- **`classifyBattleType` has no runtime assertion.** The `groupId ⇔ ranked` invariant is enforced at all current write sites (fenced `createAgentBattle` joint-stamp for tournament-only groupId; optimistic append hard-codes `groupId:null`) and pinned by the `App.jsx:6638` comment. A throwing runtime guard is deferred — it would risk crashing the card on unexpected data for a violation the write side already prevents.

---

## Separate tasking (reported, not fixed — BUILD_RULES §3)
- **`ScoutingBoardSheet.jsx:87` fallback liveness** (`isLive ?? Boolean(agent.activeBattleId)`) — a second liveness source, dormant today (both shells pass `isLive` explicitly). Founder-ruled to track separately; not folded.

---

## Founder pre-smoke checklist
1. Feature is **dark** (`CASUAL_CLONE_CONCURRENCY_ENABLED = false`) — production is byte-identical to today.
2. To smoke the concurrency UI on preview, flip the flag locally/preview and verify: ranked-live → BaggerBomb CTA enabled + Deploy section shows; deploy → second card appears (both labeled); second BaggerBomb → CTA disabled with the reason; equip label reflects the real agent only.
3. **The production flag flip is the separate one-line PR** — and per the cross-feature note, give the Task 4 hold-to-deploy sky a feel-check on preview at that flip.
