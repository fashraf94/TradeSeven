# Fix — starfield.inert.test.jsx reconciled to the LIVE flag state (post-flip #694)

**Date:** July 31, 2026
**Ruling:** founder micro-task — reconcile the inert test + docstrings to the flipped flags; codify the flip-reconciliation rule.
**Branch:** `claude/fix-starfield-inert-live-flag` (fresh from `main` @ `66185f2a`, the merge of flip PR #694)
**Fence status:** NON-FENCED. Test + docstrings + one BUILD_RULES bullet. Zero product code, zero `api/` contact.
**Status:** Fixed, mutation-checked, full suite + build green, ready for merge.

---

## 1. The defect

Flip PR #694 flipped both starfield flags `false → true` on `main`
(`STARFIELD_BACKGROUND_ENABLED` at `featureFlags.js:1198`, `STARFIELD_MOBILE_ENABLED`
at `:1236` — both VERIFIED `= true` on `origin/main` @ `66185f2a`) but did **not**
reconcile `src/components/starfield.inert.test.jsx`, which still pinned the
merge-dark state. So the inert test failed on `main` itself, reddening CI on **every
open PR into `main`** until reconciled. Four rows failed:

- **The two value pins** — asserted the constants were `false`.
- **The SSR row** — read the live constant to observe the flag-off Node return value.
- **The schedule row** — read the live constant to prove the flag-off `resolveLoopPlan` path.

Root cause is process, not code: a flag flip left its own pins behind. That is the
subject of the BUILD_RULES addition in §5.

## 2. The fix — three parts (test + docstrings only)

### Part 1 — value pins → assert the live state, with a reconciliation comment
`starfield.inert.test.jsx:70` and `:76` now assert `.toBe(true)`, each carrying a
comment that these PIN the live (flipped) state and a future flip/revert MUST update
them in the same commit (BUILD_RULES §2). The `describe` title is retitled
`A1 — flag state + the flag-off contract (flags now flipped LIVE)`.

### Part 2 — behavior rows re-expressed with EXPLICIT input (not inverted)
Per the instruction, the flag-off coverage was **not** inverted or deleted — it was
re-expressed to stop reading the live constant:

- **Schedule row (`:144`)** now calls `resolveLoopPlan({ flagOn: false })` — an
  explicit input — and still asserts `{ shouldSchedule: false, shouldDrawOnce: false,
  reason: 'flag-off' }`. This keeps the flag-off contract asserted regardless of what
  the constant is flipped to. VERIFIED it passes with flags live-true.
- **SSR row (`:79`)** now leads with `getWarpDevOverride()` — the one gate reader with
  **no flag short-circuit** — as the genuine, constant-independent SSR canary
  (`typeof window === 'undefined'`, returns `null`, never throws). It still asserts the
  two gate helpers never throw in Node and return a boolean.

### Part 3 — docstrings reframed live/revert-path
Both `STARFIELD_*` docstrings in `featureFlags.js` dropped "When FALSE (DEFAULT,
merge-dark)". They now read "FLIPPED false→true in #694 … TRUE is now the default,
FALSE is the deliberate-revert path", with `When TRUE (CURRENT):` / `When FALSE (revert
path):` blocks and a same-commit revert-reconciliation note citing BUILD_RULES §2 —
mirroring the `FUNDAMENTAL_MIRROR_ENABLED` precedent two docblocks up (`:1165–1167`).

## 3. Reported, not deleted — the SSR-row limitation (per the instruction)

With the flags live-`true`, `isStarfieldOn()` / `isStarfieldMobileOn()`
**short-circuit to `true` BEFORE the `typeof window` guard** (`featureFlags.js:1206`,
`:1243`). Their flag-**off** Node return value (`false`) is therefore no longer
observable from a test without module-mocking the constants — new scaffolding the fence
rules out. So that specific assertion could not be preserved verbatim.

What was preserved instead, and why it is sufficient:
- The **constant-independent SSR canary** survives via `getWarpDevOverride()` (no flag
  short-circuit) + not-throw + boolean-type assertions — so the "these readers are
  Node-safe" guarantee still has a row.
- The **load-bearing consequence** of flag-off — that it schedules nothing — is pinned
  by the schedule row via the explicit `flagOn: false` input, which does not depend on
  the constant at all. The behaviour is more durably covered after this change than
  before, when it rode on a constant that has since flipped.

This is a coverage *shape* change (report), not a coverage *loss* (which would need a
ruling).

## 4. Mutation-checks (both updated rows — plant, confirm fail, revert)

- **Value pin.** `STARFIELD_BACKGROUND_ENABLED = false` → row *"pins its live (flipped)
  state"* fails, and **only** that row (the SSR row stayed green — proof it is genuinely
  flag-independent). Reverted.
- **Schedule row.** `resolveLoopPlan`'s flag-off branch mutated to
  `shouldSchedule: true` → row *"the flag-OFF path never schedules …"* fails. Reverted.

Working tree confirmed back to exactly the three intended files after both reverts;
`warpStateMachine.js` diff vs `main` is empty and no `*_ENABLED = ` constant line is in
the `featureFlags.js` diff (docstring-comment lines only).

## 5. BUILD_RULES addition (§2)

Added one bullet after the `/code-review` line: **a flag-flip PR reconciles its own
pins in the SAME commit** — every test assertion and docstring that pins the pre-flip
state, or CI reddens on every *other* open PR until someone else does it. Cites the
`FUNDAMENTAL_MIRROR_ENABLED` in-commit precedent (`featureFlags.js:1165–1167`) and names
this as the second occurrence in a week (the #694 omission that necessitated this task).

## 6. Filed for separate tasking (BUILD_RULES §3 — report, don't fix)

**Pre-existing lint error, NOT introduced here, NOT fixed here.**
`starfield.inert.test.jsx` uses `process.cwd()` in its `readSource` helper (line 40
after my header expansion; line 34 on `main`). `eslint.config.js` sets only
`globals.browser` (no node globals), so `no-undef` flags `process` — VERIFIED identical
on `origin/main` via `git stash` (same single error, my edits neither add nor remove
it; the header expansion only shifted its line number). It is **not a CI signal**: no
`.github/workflows/*` runs `eslint`/`npm run lint`, so this has never reddened `main`.
Fixing it means editing `eslint.config.js` (a node-env override) — product/infra, outside
this task's "test and docstring only" fence — so it is reported for separate tasking,
not touched. Any source-reading test in the repo hits the same config gap.

## 7. Verification

- **`starfield.inert.test.jsx`**: 17/17 green with flags live-true.
- **Full suite** (`vitest run`): **362 files / 6414 tests passed**, 53 skipped
  (emulator + off-flag suites) — confirming **no other test** pinned the dark state.
- **`vite build`**: clean (the usual >500 kB chunk advisory only).
- **`eslint` on touched code files**: only the pre-existing `process` `no-undef` in §6;
  no new lint introduced.

## 8. Scope fence

Test + docstring + one BUILD_RULES bullet. **Not touched:** product code,
`DesktopBackground.jsx`, `tokenGuardBaseline.json`, any tuning param, the flag constants
themselves. `resolveLoopPlan` was mutated only transiently for the mutation-check and
reverted (empty diff vs `main`).

---

*End of fix report. One task, one branch; PR opened for founder merge.*
