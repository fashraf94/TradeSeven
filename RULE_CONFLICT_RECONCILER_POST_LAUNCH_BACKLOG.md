# Rule Conflict Reconciler — Post-Launch Backlog

**Created:** 2026-06-20
**Status:** Active backlog. Items here were deliberately deferred out of the V1
reconciler build (Phase 0 + Phase 1, non-fence). Each names its gate.

---

## TICKET-1 — Collapse the three hardness-set copies (§7-gated, touches the fence)

**Priority:** medium. **Gate:** calibration fence (BUILD_RULES §1) — requires
the §7 founder-reviewed gated-edit process because it edits two fenced files.

### The duplication

The "which categories are HARD (must-obey)" set — `{ risk, allocation }` — is
hardcoded in **three** places that must agree but with nothing enforcing it:

| Copy | File | Fenced? |
|---|---|---|
| Strategy prompt assembly | `api/_utils/agentPromptAssembly.js:76` | **YES** |
| Eval prompt assembly | `api/_utils/agentEvalPromptAssembly.js:285` | **YES** |
| Reconciler hardness | `src/utils/ruleConflictReconciler.js` `HARD_CATEGORIES` | no |

### Why it was left duplicated in V1

True single-source means editing **both fenced assembly files** to import a
shared constant — that expands the §7 fence surface well past the single
`decide.js` call-site the V1 build deliberately minimized. Not worth opening
during the launch-blocker build.

### What V1 did instead (the interim guard)

- Defined the set **once** on the reconciler side as the named constant
  `HARD_CATEGORIES`, with a prominent breadcrumb comment naming both fence lines.
- **Value-pinned it** in `src/utils/ruleConflictReconciler.test.js`
  (`HARD_CATEGORIES — value pin`), so the reconciler side cannot drift silently.

**Known limit (the reason this ticket exists):** the pin protects the
reconciler side ONLY. The fenced values are not exported, so a change to
`agentPromptAssembly.js:76` or `agentEvalPromptAssembly.js:285` is **not**
auto-caught. A divergence would make the reconciler tiebreak `hard_over_soft`
on a hardness the prompt does not actually apply — a silent wrong resolution
(no error). (Low live risk today: see the V1 invariant below.)

### The fix

Extract `{ risk, allocation }` into ONE shared, **non-fenced**, Node-clean
constant (e.g. `src/constants/ruleHardness.js`) that all three sites import:
the reconciler directly, and the two fenced assembly files via the §7 gated
edit. Then the value-pin test guards a single source of truth.

### Related V1 invariant worth re-checking when this lands

In V1 every descriptor-bearing template is `risk`/`allocation` (= hard), so no
soft rule can enter detection — the `hard_over_soft` tiebreaker and the
`tie_fallback` path are currently unreachable correctness-guards (the latter
needs a same-operator contradiction, i.e. an `eq` template that does not yet
exist). If a soft-category descriptor template is ever added, hardness
correctness becomes a hot path and this consolidation should land first.
