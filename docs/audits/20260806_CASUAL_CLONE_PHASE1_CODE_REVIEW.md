# Casual Clone (Phase 1) — BUILD_RULES §2 Cumulative Code Review

**Date:** 2026-08-06 · **Scope:** the Phase-1 build (20 files: 15 modified + 5 new impl/test, plus review-response fixes) · **Design lock:** `20260805_PER_BATTLE_LOADOUT_CONCURRENCY_DESIGN_LOCK_V1`.

**Method (BUILD_RULES §2, mandatory ≥10 files):** five independent adversarial reviewers along disjoint dimensions — (1) redirect correctness, (2) flag-off byte-identity, (3) security/fence, (4) wiring/lifecycle/leaks, (5) test integrity — each instructed to **find and self-refute** (report only findings surviving a concrete repro). **Accompanied by an explicit `vite build`** (green) and the **full vitest suite** (6964 passing after fixes). Mutation-checked: the parity gate was demonstrated **RED** under naive resolvers, GREEN with the redirects.

---

## Executive verdict

| Area | Result |
|---|---|
| **Fence** | **Intact** — no fenced file edited; the clone's battle never carries the parent's `agentId` (attribution redirected at the write layer only). |
| **Flag-off dark guarantee** | **Holds** — every changed non-casual path folds back byte-identical; exclusion clauses inert with no casual doc. |
| **Security** | **2 CONFIRMED cross-user vulns → FIXED** (code-layer, unit-tested) + `firestore.rules` defense-in-depth (emulator-validate before flip). |
| **Correctness** | RECORD / DRB / reflection-merge / tx-extraction **verified correct**; **1 regression FIXED** (out-of-scope var), **1 CONFIRMED latent → founder decision** (consolidation double-fire). |
| **Tests** | Settlement now has a real-`completeBattle` integration parity test; `applyConsolidationTx` directly covered; security guards tested. |
| **Wiring** | Backend sound (exclusion complete, no leak/mis-selection); **3 UX/design findings → founder decision** (Command-Center multi-battle; clone staleness). |

**13 CONFIRMED findings · 8 REFUTED-as-sound.** 6 fixed in this pass; 4 referred to the founder (design/scope); 3 filed for separate tasking.

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

## CONFIRMED → referred to the founder (design / scope — NOT decided unilaterally)

### D1 · Consolidation double-fire (MED latent, correctness CONFIRMED #2)
The RECORD redirect makes the parent's `gamesPlayed` a shared counter (casual settlements increment it; ranked reflections read it). With **no idempotency guard**, a casual settlement pushing `gamesPlayed` to a `%5` milestone plus a concurrently-pending ranked reflection can **both** consolidate the parent → `evolutionCycle` double-increment, duplicate timeline event, redundant Sonnet call. No W-L/record corruption; corrupts the user-visible "evolution" history. Reachable specifically under the concurrency this feature enables.
**Why not fixed here:** the clean fix (a `lastConsolidatedGamesPlayed` milestone-claim) touches the *shared* consolidation gate and cannot be cleanly gated to preserve strict flag-off byte-identity without flag-gating the guard itself. **Recommend:** a flag-gated milestone-idempotency guard **before the flag flips** (a blocker, like S1/S2). Founder to rule on approach.

### D2 · Command-Center is single-battle (MED×2 + LOW — wiring Findings 1/3/4)
The feature enables ranked + BaggerBomb concurrently, but the Command Center assumes one battle: the deploy CTA's `isLive` gate (which conflates casual-live and ranked-live) **disables a user-initiated BaggerBomb while a ranked battle is live** — so acceptance-criterion #2's *user-path* concurrency isn't delivered; `liveBattles[0]` becomes ambiguous with two same-named battles (Manage/Enter opens an arbitrary one); the G2 `podSessionConflict` heads-up is a false positive under the flag. **These need a Command-Center multi-battle pass that was not in the locked Phase-1 scope** (clone + attribution + R5). Founder to rule on scope.

### D3 · Clone staleness (MED — wiring Finding 2)
The clone deploys with **empty `memory`** day one (BaggerBomb loses its "recent game memory" block vs today) and **never re-syncs** the parent's evolving loadout/insight (never-overwrite). So BaggerBomb's decisions diverge from today's, and the learning redirected back to the parent is generated by a **stale/blank brain** — tensioning the "preserving exactly what BaggerBomb contributes today" premise. This surfaces a design gap in R1's never-overwrite framing: the clone now accumulates *nothing* of its own (all redirected), so "never-overwrite to protect learning" protects nothing, and re-syncing from the parent on each deploy may be what's actually wanted. Founder to rule.

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

## Filed for separate tasking (BUILD_RULES §3 — reported, not fixed here)
1. Redirect the 3 dark copilot/gameplan capture sites (C1 residual) when copilot/expansion go live.
2. `firestore.rules` change requires `npm run test:rules` (emulator) validation before deploy — not in the default vitest run; manual Console deploy per repo convention.
3. Pre-existing consolidation-gate idempotency weakness (independent of casual; D1 is the casual-reachable instance).

---

*Read/review-only except the enumerated fixes. `vite build` green; full suite 6964 passing. No fenced file edited.*
