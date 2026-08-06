# Casual Clone (Phase 1) — BUILD_RULES §2 Cumulative Code Review

**Date:** 2026-08-06 · **Scope:** the Phase-1 build (20 files: 15 modified + 5 new impl/test, plus review-response fixes) · **Design lock:** `20260805_PER_BATTLE_LOADOUT_CONCURRENCY_DESIGN_LOCK_V1`.

**Method (BUILD_RULES §2, mandatory ≥10 files):** five independent adversarial reviewers along disjoint dimensions — (1) redirect correctness, (2) flag-off equivalence, (3) security/fence, (4) wiring/lifecycle/leaks, (5) test integrity — each instructed to **find and self-refute** (report only findings surviving a concrete repro). **Accompanied by an explicit `vite build`** (green) and the **full vitest suite** (6970 passing after the ruling-1/3 pass). The `firestore.rules` change is **emulator-validated**: `npm run test:rules` **121 passing** (the reserved-clone-id namespace + `isCasualClone`/`rankedAgentId` create-deny rows are exercised against a live Firestore emulator). Mutation-checked: the parity gate was demonstrated **RED** under naive resolvers, GREEN with the redirects.

> **Flag-off equivalence — the exact requirement (founder-ruled 2026-08-06).** The dark guarantee is **provable flag-off _behavioral_ equivalence, not literal byte-identity**. A guard that is *inert when no casual clone can exist* satisfies it even if it would add a field on the guarded path. Concretely: with `CASUAL_CLONE_CONCURRENCY_ENABLED` off, the ruling-1 milestone-claim is never called (`wonMilestone = true` unconditionally), so the agent doc never gains `lastConsolidatedGamesPlayed` and the consolidation path is exactly the pre-ruling code. Byte-identity is the *sufficient* form we still hold on every non-casual path; behavioral equivalence is the *necessary* bar the guards are measured against.

---

## Executive verdict

| Area | Result |
|---|---|
| **Fence** | **Intact** — no fenced file edited; the clone's battle never carries the parent's `agentId` (attribution redirected at the write layer only). The 3 dark copilot/gameplan capture sites correctly stay on `battle.agentId` (founder-confirmed). |
| **Flag-off dark guarantee** | **Holds** — behavioral equivalence proven; every changed non-casual path folds back byte-identical, and the ruling-1 guard is inert when the flag is off (no `lastConsolidatedGamesPlayed` field, pre-ruling path). |
| **Security** | **2 CONFIRMED cross-user vulns → FIXED** (code-layer, unit-tested) + `firestore.rules` defense-in-depth, **now emulator-validated** (`npm run test:rules` 121 passing). |
| **Correctness** | RECORD / DRB / reflection-merge / tx-extraction **verified correct**; **1 regression FIXED** (out-of-scope var); consolidation double-fire **FIXED (ruling 1 — milestone-claim)**. |
| **Tests** | Settlement has a real-`completeBattle` integration parity test; `applyConsolidationTx` directly covered; security guards tested; **milestone-claim idempotency tested** (`reflect.claimConsolidation.test.js`, 4 rows); reserved-id namespace tested in the rules emulator. |
| **Wiring** | Backend sound (exclusion complete, no leak/mis-selection); clone staleness **FIXED (ruling 3 — re-sync at deploy)**; **Command-Center multi-battle → Phase 1.5** (separate task; acceptance #2 **not delivered**, flag does **not** flip, until 1.5 ships). |

**13 CONFIRMED findings · 8 REFUTED-as-sound.** 8 fixed (6 in the review pass + D1/D3 per rulings 1/3); D2 scoped to Phase 1.5; 2 filed for separate tasking. **The dark flag stays off until Phase 1.5 lands.**

---

## CONFIRMED → FIXED in this pass

### S1 · Cross-user attribution poisoning (HIGH, security CONFIRMED-1)
A client could create its own `casual-agent-{self}` doc with `rankedAgentId: VICTIM` (the `agents` create rule forbade `isTrainingClone` but not `isCasualClone`/`rankedAgentId`, and reserved no id namespace), deploy+tank a casual battle, and have the loss + crafted lessons redirected onto the victim's ranked agent.
**Fix:** (a) target-ownership guard — every redirect refuses a target whose `ownerId` ≠ the clone's owner (`casualClone.js` `resolveAttributionAgentId`; `agent-evaluate.js` settlement `parentSnap.ownerId === agentSnap.ownerId`; `reflect.js`); same-owner is a legit-clone invariant, so this only rejects the attack. (b) `firestore.rules`: reserve `casual-agent-`/`training-agent-`/`cpu-agent-` from client creates + forbid `isCasualClone`/`rankedAgentId`. **Tests:** `casualClone.test.js` (cross-user refuse) + `agent-evaluate.casualRedirect.test.js` (real-`completeBattle` cross-user refuse — victim untouched).

### S2 · Persistent DoS via namespace squat (MED-HIGH, security CONFIRMED-2)
Plantable **today**: an attacker `setDoc(agents/casual-agent-{VICTIM}, {ownerId: attacker})`; the victim's `ensureCasualClone` adopted it (no authenticity check), `decide.js` then rejected on ownership → permanent deploy failure (`delete:false`).
**Fix:** `ensureCasualClone` now returns an existing doc as-is **only if** `ownerId===caller && isCasualClone`; any other doc is a squat → **healed** (Admin-SDK overwrite with a fresh legit clone). `firestore.rules` namespace reservation prevents new squats. **Tests:** heal-wrong-owner + heal-bare-doc in `casualClone.test.js`.

### C1 · Out-of-scope `attributionAgentId` + gate/stamp inconsistency (MED latent — correctness/flag-off/test CONFIRMED)
My `classifyEvidence` `replace_all` over-reached: it changed the gate at **5** capture sites, but 3 (`agent-evaluate.js:2981/:3180/:3391`, in `handlePendingProposal`/`handleGameplanMeeting`) are *separate* functions where `attributionAgentId` (declared at `:665` in `processAgentBattle`) is out of scope → a dormant `ReferenceError` when `LEARNING_L1_CAPTURE_EXPANSION_ENABLED` flips; and their receipt stamps still used `battle.agentId` (gate/stamp mismatch). The founder scoped the corpus redirect to **two** sites (`:2323` live + the dark risk-swap); the other 3 were not in scope.
**Fix:** reverted those 3 gates to `battle.agentId` — restoring in-scope + gate/stamp consistency and the founder's 2-site scope. **Residual (filed):** those dark copilot/gameplan captures do not redirect; if copilot mode + the expansion flag + the casual flag ever coincide, a casual receipt there books under the clone.

### T1 · No redirect SITE exercised end-to-end (HIGH → settlement closed)
The parity gate tested the resolvers, not the sites. **Fix:** added `agent-evaluate.casualRedirect.test.js` — drives the real exported `completeBattle` with a casual clone and asserts the parent's record equals the real-agent path, the clone stays zero, only the clone's pointer clears (plus degrade-safe, tournament-inert, and the S1 cross-user case). `applyConsolidationTx` is now directly tested (fresh-read merge preserves a concurrent lesson). **Residual (filed):** reflection-memory and DRB *handlers* remain covered only via the resolvers (both are Sonnet-driven; not cheaply unit-testable).

### T2 · Parity-gate oracle partially non-load-bearing (MED)
`casualCloneParity.test.js`'s stats-oracle rows are redundant-by-construction. **Disposition:** the new integration test (T1) is now the authoritative settlement gate; the resolver assertions retain mutation power (proven RED). Left the illustrative oracle in place; the real guard is the integration test.

---

## CONFIRMED → founder-ruled 2026-08-06 (dispositions below)

### D1 · Consolidation double-fire → **RULED: fix now (ruling 1) · IMPLEMENTED**
The RECORD redirect makes the parent's `gamesPlayed` a shared counter (casual settlements increment it; ranked reflections read it). With **no idempotency guard**, a casual settlement pushing `gamesPlayed` to a `%5` milestone plus a concurrently-pending ranked reflection can **both** consolidate the parent → `evolutionCycle` double-increment, duplicate timeline event, redundant Sonnet call. No W-L/record corruption; corrupts the user-visible "evolution" history. Reachable specifically under the concurrency this feature enables.
**Ruling (founder):** this is a defect **this build introduces**, not a pre-existing one — **fix before the flip, do not defer.** The milestone-claim is approved. On the byte-identity concern: the real bar is **provable flag-off _behavioral_ equivalence, not literal byte-identity** — a guard inert when no casual clone exists satisfies it. Prove it with a test; state the distinction.
**Implementation:** `reflect.js` `claimConsolidationMilestone(db, agentRef, gamesPlayed)` — a transactional check-and-set on `lastConsolidatedGamesPlayed`: the first reflection to stamp `=gamesPlayed` wins (returns `true`), a duplicate at the same `%5` loses (`false`) → exactly one consolidation per milestone. The trigger is **flag-gated**: `wonMilestone = CASUAL_CLONE_CONCURRENCY_ENABLED ? await claim(...) : true`, so **flag-off the claim is never called** and the doc never gains `lastConsolidatedGamesPlayed` (the pre-ruling path, byte-identical). The casual-forward consolidation applies transactionally (`applyConsolidationTx`, `transactionalApply: isCasualForward`) so a concurrent parent lesson is not clobbered.
**Tests:** `reflect.claimConsolidation.test.js` (4 rows — first-claim-wins, duplicate-loses, the two-reflections-one-consolidates double-fire scenario, and a new milestone re-claims) + the `applyConsolidationTx` fresh-read-merge test. **Flag-off equivalence stated explicitly** in the test header and the Method note above.

### D2 · Command-Center is single-battle → **RULED: Phase 1.5 (separate task) · NOT delivered here**
The feature enables ranked + BaggerBomb concurrently, but the Command Center assumes one battle: the deploy CTA's `isLive` gate (which conflates casual-live and ranked-live) **disables a user-initiated BaggerBomb while a ranked battle is live** — so acceptance-criterion #2's *user-path* concurrency isn't delivered; `liveBattles[0]` becomes ambiguous with two same-named battles (Manage/Enter opens an arbitrary one); the G2 `podSessionConflict` heads-up is a false positive under the flag. **This needs a Command-Center multi-battle pass that was not in the locked Phase-1 scope** (clone + attribution + R5).
**Ruling (founder):** Command-Center multi-battle → **Phase 1.5, a separate task.** Phase 1 merges **dark, complete-as-scoped**, but **acceptance-criterion #2 is NOT delivered until 1.5 lands**, and **the dark flag does NOT flip until 1.5 ships**. The `liveBattles[0]` ambiguity and the CTA `isLive` gate belong to 1.5. Tracked honestly here: **#2 is open; the flag stays off.**

### D3 · Clone staleness → **RULED: re-sync at deploy (ruling 3) · IMPLEMENTED**
The clone deploys with **empty `memory`** day one (BaggerBomb loses its "recent game memory" block vs today) and **never re-syncs** the parent's evolving loadout/insight (never-overwrite). So BaggerBomb's decisions diverge from today's, and the learning redirected back to the parent is generated by a **stale/blank brain** — tensioning the "preserving exactly what BaggerBomb contributes today" premise. R1's never-overwrite protected learning the clone (being a *carrier*, not an *owner* — all its learning redirects forward) never accumulates, so it protected nothing.
**Ruling (founder):** the clone is a **carrier, not an owner**; R1's never-overwrite is an **idempotency guarantee, not a private-brain mandate.** **Re-sync `INHERITED_LOADOUT_FIELDS` + `memory`/`consolidatedInsight` from the parent on each deploy.** Two guards: (a) re-sync **only at deploy, never mid-battle**; (b) **never clobber state not yet redirected forward** — sequence copy-forward *before* re-sync, or make re-sync additive.
**Implementation:** `casualClone.js` `buildCasualCloneResync(parent)` (pure — the inherited-loadout fields + parent `memory`, and nothing else: never the markers/pointers/stats) applied in `ensureCasualClone`'s existing-authentic branch. **Guard (a):** gated on `!existing.activeBattleId` (never mid-battle). **Guard (b):** re-sync copies **FROM the parent**, which is exactly where the clone's own past learning was already redirected — so it is **additive-in-effect** and clobbers no un-redirected clone state (the clone accumulates none). Same-owner is re-checked (defense-in-depth vs a poisoned `rankedAgentId` on an otherwise-authentic clone), and `copyAgentSubcollections` refreshes the rules/bundles Trading Brain.
**Tests:** the `casualClone.test.js` / `ensure-casual-clone.test.js` never-overwrite rows were **updated** to assert the ruling-3 shape — **identity preserved** (`isCasualClone`/`rankedAgentId` untouched) while the **brain re-syncs** from the parent (memory mirrors the parent's).

---

## REFUTED / verified sound (survived refutation)
- **Fence** — none of the 11 fenced files edited (grep-verified); battle keeps the clone's own `agentId`; `createAgentBattle`/scoring engine untouched.
- **Endpoint auth** — `odUserId` from the token never the body; parent resolved by `ownerId===caller`; method/auth/flag/rate-limit correct.
- **Never-overwrite race** — get-before-create + `create()`/`ALREADY_EXISTS` catch; a legit double-tap never clobbers accumulated learning (and now heals a squat).
- **RECORD redirect** — reads-before-writes holds (parent `t.get` precedes the first `t.update`); stats build on the parent base, clone pointer clears, parent pointer untouched; concurrent settlements serialize.
- **Reflection memory** — transactional merge onto the parent's *current* memory; the clobber hypothesis REFUTED (serial reflection cron).
- **Consolidation extraction + tx** — `buildEvolutionEvent`/`markAbsorbedLessons` behavior-preserving; `applyConsolidationTx` preserves a concurrent lesson.
- **Flag-off** — every changed non-casual path byte-identical; exclusion clauses inert; R5 drops only training clones (a deliberate always-on bugfix, casual battles stay visible).
- **No identity leak / mis-selection** — all 7 owner-lookups exclude both clone markers; no other agent-list query exists; the clone renders under the parent's inherited name, never its raw id.

## Forward work (tracked)
- **Phase 1.5 — Command-Center multi-battle (D2):** the blocker for acceptance-criterion #2 and the **precondition for flipping the dark flag.** Separate task; the flag stays off until it lands.
- **Redirect the 3 dark copilot/gameplan capture sites (C1 residual)** when copilot/expansion go live (they correctly stay on `battle.agentId` today).

## Filed for separate tasking (BUILD_RULES §3 — reported, not fixed here)
1. Redirect the 3 dark copilot/gameplan capture sites (C1 residual) when copilot/expansion go live.
2. ~~`firestore.rules` change requires `npm run test:rules` (emulator) validation before deploy.~~ **DONE** — validated this pass (`npm run test:rules`, 121 passing incl. the new reserved-id namespace + `isCasualClone`/`rankedAgentId` create-deny rows). Manual Console deploy of the rules still follows repo convention.
3. ~~Pre-existing consolidation-gate idempotency weakness (D1 casual-reachable instance).~~ **The casual-reachable instance is FIXED (ruling 1).** The broader (non-casual) consolidation-gate idempotency question remains a pre-existing item outside this build's scope.

---

*Read/review-only except the enumerated fixes. `vite build` green; full suite **6970 passing**; `npm run test:rules` **121 passing** (emulator). No fenced file edited. Rulings 1 & 3 implemented; D2 → Phase 1.5; **the dark flag does not flip until Phase 1.5 ships.***
