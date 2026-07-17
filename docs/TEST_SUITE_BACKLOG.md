# Test-Suite Backlog

Known-stale test assertions carried by the suite — filed for separate tasking
(BUILD_RULES §3 report-not-fix), so the suite stops carrying known-red noise.
Each entry names the failing assertions, the root cause, and the sanctioned
treatment; none blocks the arc that filed it.

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
