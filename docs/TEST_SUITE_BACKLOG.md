# Backlog — filed for separate tasking

Report-not-fix items (BUILD_RULES §3): known-stale tests and deferred fixes
that do not block the arc that filed them. Two sections: stale tests, then
deferred code fixes.

---

## Deferred code fixes

### [FILED 2026-07-17 · WS1 enforce Phase 2] Orphaned `ruleHardness` overrides can resurrect a stripped promotion — a **pre-door-heavy-use** fix

**Reachable once users author hard overrides** (i.e. after
`FORGE_HARDSOFT_AUTHORING_ENABLED` flips and the promote-to-hard toggle sees
real use). **Moot today** — no authored overrides exist in production because
the authoring door has never opened.

**The hole.** WS1 enforce Phase 2 retired the client-side prune of a removed
rule's `ruleHardness` entry (`removeRuleFromBundle` — `ruleHardness` is now
server-mintable only, so the client can no longer write the field). Orphaned
entries are inert at rest (the projection reads overrides only for ruleIds
still listed on the bundle). **But** an orphan is not visible to the cleanup
either — `api/_utils/ruleCompatCleanup.js` mirrors the projection and only
evaluates overrides for listed ruleIds. So the sequence: author `X='hard'` →
remove X from the bundle (orphan survives) → re-add X (`addRuleToBundle`
writes only `ruleIds`, no gate) → X is hard again, un-gated. A stripped or
never-gated hard override resurrects.

**The real fix (options).** (a) Prune the orphan server-side — have
`removeRuleFromBundle` route through a server endpoint (or a small
`prune-rule-hardness` endpoint) that deletes `ruleHardness.{id}` under the
allowlist; or (b) gate `addRuleToBundle` re-adds (evaluate an existing
override at add time); or (c) extend the cleanup to sweep orphaned overrides
(entries whose ruleId is not in any non-archived bundle's `ruleIds`). Option
(a) is the cleanest — it closes the hole at the mutation that creates the
orphan.

**Process guard until then** (recorded in `WS1_ENFORCE_ACTIVATION_RUNBOOK.md`
§3.2): the Phase-3 cleanup pre-run check confirms the dry-run census shows
zero `ruleHardness` entries before `--live`; and this fix must land **before
heavy authoring use** of the door post-flip.

---

## Stale test assertions

Filed so the suite stops carrying known-red noise. Each names the failing
assertions, the root cause, and the sanctioned treatment.

> **Consolidation note (founder, 2026-07-17):** four stale suites now share
> the "test asserts a flag state the flag has left" class (below). Worth a
> single cleanup pass eventually — convert them all to the `skipIf(FLAG)`
> real-flag pattern in one PR.

---

## [FILED 2026-07-17 · WS1 enforce Phase 2] Stale "dark-inert while FLAG is false" tests — flags are live post-Release-3

**The 3 failing tests** (pre-existing at `bea6e385`; verified identical with and
without the WS1 Phase-1/2 changes):

1. `api/agent/equip-lean.test.js` — "equip-lean 404s before touching security, auth, or Firestore"
2. `api/agent/equip-lean.test.js` — "unequip-lean 404s before touching security, auth, or Firestore"
3. `api/agent/set-tempo-dial.test.js` — "404s before touching security, auth, or Firestore"

**Root cause.** These assert the endpoints' DARK-INERT 404 gates against the
REAL flags — written when `STANDING_LEANS_ENABLED` / `TEMPO_DIAL_ENABLED` were
`false` at merge (DARK-INERT per founder ruling D1). Both flags are now `true`
in `src/config/featureFlags.js` (`:339`, `:359` — flipped for the Release-2/3
activation walk), so the endpoints are live and correctly do NOT 404: the
tests assert off-state against on flags.

**Sanctioned treatment (pick at tasking):** either convert to the
`.skipIf(FLAG !== false)` real-flag pattern (`log-rule-compat-event.off.test.js`
/ `set-rule-hardness.off.test.js` — the case auto-skips while the flag is on
and auto-re-arms if the flag is ever rolled back), or retire the off-state
cases outright if the flags are considered permanently live. The skipIf
conversion is preferred: it preserves the rollback-safety net for free.

**Class note.** This is the "test asserts a flag state the flag has left"
class. When flipping any `*_ENABLED` / tri-state flag, grep for
`dark-inert while` / `.off.test` companions and convert them to `skipIf` in
the flip PR — the WS1 off tests are already written this way.

**Same-class addendum (found during the WS1 Phase-2 full-suite sweep;
pre-existing at `bea6e385`, verified identical on the clean tree):**

4. `api/_utils/agentPromptAssembly.controls.test.js` — 3 failures in the
   "PR-c guard — REAL flags (observe / leans off)" describe: written when
   `STANDING_LEANS_ENABLED` was false; the suite's real-flag branch asserts
   leans never reach the prompt, which inverted when the flag flipped true.
   Same sanctioned treatment (skipIf on the real flag, or re-scope the
   real-flag describe to whichever state is live).

**Adjacent (different class — test-runner scoping, also pre-existing):** a
bare `npx vitest run` with no path picks up `research/level-study/tests/*`
(44 files), which are `node:test` files run by the research harness, not
vitest suites — each fails file-level with "No test suite found". Harmless
under path-scoped runs; if bare full-suite runs become routine, exclude
`research/**` in the vitest config.
