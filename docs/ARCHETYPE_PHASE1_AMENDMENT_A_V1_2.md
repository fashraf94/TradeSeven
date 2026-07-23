# Phase 1 Master Spec — Amendment Sheet A (V1.1 → V1.2)

**Date:** July 23, 2026 · **Status:** closes Review Round 2 blockers R2-1…R2-4. V1.2 = `ARCHETYPE_PHASE1_MASTER_SPEC_V1_1.md` + this sheet; both lock together.
**Round 2 tally:** 4 BLOCKER — 4 accepted (R2-3 resolves Open Q-6). Round 2 confirmed closure of R1 findings 5, 9, 10, 13, 14, 23, 24, 27.

---

## A-1. Shared behavior-record envelope (closes R2-1; completes R1-1 for non-actions)

Amends §6.2–6.3. A single required envelope on **every** behavior record — DecisionReceipt, per-evaluation gate aggregate, terminal-gate record, and blockedActionEvent:

```
behaviorRecordEnvelope {
  manifestId, manifestHash,
  versionsAtLock,                  // from manifest
  effectiveRuntimeResolution,      // §4.3 — captured during the SAME tick as the record
  tickId,                          // stable per-invocation id (cron start timestamp + battleId)
  evaluatedAt
}
```

Capture rule: the envelope is assembled **once per battle per tick** and stamped onto every record that tick emits, so a no-action tick costs one envelope build, not four. Phase 5 consumers must reject any record missing the envelope (schema-versioned; no grandfathering, since none of these records exist in production yet).

## A-2. Mode-scoped CompiledBuild (closes R2-2; completes R1-3/29/30)

Amends §4.4 and §1.3. CompiledBuild gains:

```
gameMode, gameModePolicyVersion, gameModePolicyHash
```

All three enter `contentHash` AND `sourceRevisionVector`. The lock transaction re-verifies mode + policy version/hash along with the rest of the vector; mismatch aborts exactly like a settingsRev mismatch. **One CompiledBuild is valid for exactly one mode.** Deploying a saved build into a different mode requires compiling a sibling CompiledBuild under that mode's policy (same buildVersion pointer, different mode scope, its own compat verdicts / slot legality / guardrail applicability). The preview UI must display the mode it was compiled under. `GameModePolicy` gains `gameModePolicyHash` (content hash) alongside its version constant.

## A-3. Build identity rule — Q-6 resolved (closes R2-3; completes R1-19/20)

Amends §3.2 and deletes Open Q-6. Final rule, no alternatives retained:

1. `bundleContentHash` change **invalidates** every dependent CompiledBuild (freshness — unchanged).
2. Invalidation alone never carries a build identity. The recompile that follows any source change is **server-mediated and bumps `settingsRev`**, minting a new build revision. `buildMeta.buildVersion` therefore always identifies exactly one `(sourceRevisionVector)` state; two behaviors can never share a version.
3. Where behavior-affecting bundle mutations are client-writable today (equipped-doc dimension fields, per census F9), the write remains legal but the build is unusable until the server recompile runs — the deploy path refuses a stale or version-less CompiledBuild (§4.4 lock verify already enforces this; this amendment makes the settingsRev bump part of the compile contract rather than the mutation contract, requiring no firestore.rules change).

## A-4. Compatibility completeness in the activation gate (closes R2-4; completes R1-31)

Amends §5.6. The production activation gate additionally requires: **an explicit compatibility verdict for every equippable corpus rule × every launch archetype** (full matrix over the 6 launch archetypes; currently 98/143 rules classified — the remaining 45 rules' cells are Phase 3 critical-path authoring). An intentionally universal rule requires an explicit `compatible` entry per archetype; absence is not a verdict. A missing cell fails the completeness gate at activation time — never surfaces as a per-user compile failure, and the compiler never invents a default. Season-only rules are in scope for the matrix if and only if they are equippable in any launch mode per GameModePolicy.

---

## Round 3 relay instruction (verbatim, for ChatGPT)

"Round 3 is closure verification only. Confirm whether Amendment Sheet A closes R2-1 through R2-4 as specified. Do not open new attack vectors; a new blocker is admissible only if it is created BY these amendments or grounds in a census fact these amendments newly violate. Verdict options: LOCK-READY, or NOT LOCK-READY with the specific amendment defect."
