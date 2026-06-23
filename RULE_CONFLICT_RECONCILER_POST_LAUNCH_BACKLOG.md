# Rule Conflict Reconciler — Post-Launch Backlog

**Created:** 2026-06-20 · **Corrected:** 2026-06-23 (Phase 2 discovery)
**Status:** Active backlog. Items here were deliberately deferred out of the
reconciler build. Each names its gate.

---

## TICKET-1 — Collapse the three hardness-set copies into one shared constant

**Priority:** low/medium. **Gate:** NONE that requires the fence (see correction).

### Correction to the original premise

The original ticket claimed this consolidation was "§7-gated (touches the
fence)" because the hardness set was thought to be hardcoded in the fenced
`agentPromptAssembly.js` / `agentEvalPromptAssembly.js`. **Phase-2 discovery
proved that wrong.** The set is NOT hardcoded in the fenced files — both of them
import `isHardRule` from the **non-fenced** `api/_utils/ruleHardness.js`. So the
consolidation touches only non-fence code.

### The duplication

The `{ risk, allocation }` "hard categories" set is independently maintained in
three places that must agree, with nothing enforcing it:

| Copy | File | Fenced? |
|---|---|---|
| Client (Forge display + authoring) | `src/components/Forge/workshop/hardSoftHelper.js:28` | no |
| Server (strategy/eval/projection path) | `api/_utils/ruleHardness.js:23` | no |
| Reconciler | `src/utils/ruleConflictReconciler.js` `HARD_CATEGORIES` | no |

The client/server pair predates this build and is documented in those files as a
"lockstep" duplication that was *believed* unavoidable because the OLD import
rule forbade `api/` importing `src/`. **That rule was revised (BUILD_RULES §4,
June 2026): `api/` MAY import Node-clean `src/` modules.** So the duplication is
now avoidable.

### Interim guard (in place)

- The reconciler copy is value-pinned in `ruleConflictReconciler.test.js`
  (`HARD_CATEGORIES — value pin`) with a breadcrumb to the other two.

**Known limit:** the pin guards the reconciler side only; a change to
`ruleHardness.js:23` or `hardSoftHelper.js:28` is not auto-caught.

### The fix

Create one dependency-free constant (e.g. `src/constants/ruleHardnessCategories.js`)
exporting `HARD_CATEGORIES`, and have all three import it:
- `hardSoftHelper.js` (client) — `src` → `src`.
- `ruleHardness.js` (server) — `api` → `src`, now permitted by §4 (the constant
  is dependency-free / Node-clean).
- `ruleConflictReconciler.js`.

The fenced assembly files need **no** change — they already delegate to
`ruleHardness.js`'s `isHardRule`, whose value and exports stay byte-identical.
Then the value-pin test guards a single source of truth.

### Why it was not done in the reconciler build

The client/server duplication is pre-existing code outside the reconciler task;
per BUILD_RULES §3 it is reported here for separate tasking rather than
refactored mid-task. The build only added (and value-pinned) the reconciler's
own copy and corrected the breadcrumbs.

### Related V1 invariant worth re-checking when this lands

In V1 every descriptor-bearing template is `risk`/`allocation` (= hard), so no
soft rule can enter detection — the `hard_over_soft` tiebreaker and the
`tie_fallback` path are currently unreachable correctness-guards (the latter
needs a same-operator contradiction, i.e. an `eq` template that does not yet
exist). If a soft-category descriptor template is ever added, hardness
correctness becomes a hot path and this consolidation should land first.
