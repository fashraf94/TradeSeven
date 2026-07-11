# Release 2 — Dark-Smoke Cleanup & Fence-Tripwire Discovery

**Date:** 2026-07-10
**Branch:** `claude/release2-smoke-spawn-fix` (cut fresh from `main` @ `e9d8b3d`)
**Scope:** test-tooling fix (non-fenced) + read-only fence-tripwire investigation
**Fence contact:** none. `api/agent/decide.js` was **read only** (never edited). No flags changed; PR-d untouched. Fence question settled via `git show` (read-only history inspection, BUILD_RULES §3).

---

## Executive verdict

| Item | Original premise | Actual root cause | Verdict | Disposition |
|---|---|---|---|---|
| **1. Smoke reports RED locally** | Smoke runs credential/network/TZ suites (calibration, ws1-observe-walk, parse-signal, dateUtils) → false negatives | Smoke was **already correctly scoped** to the 8 Release-2 off-state suites (156 tests, all green). RED came from `spawnSync('npx', …)` failing on Windows: bare `npx` → **ENOENT**; `npx.cmd` without a shell → **EINVAL** (Node post-CVE-2024-27980 hardening). `status` ≠ 0 + empty stdout → prints RED with no summary. | **FIXED** — Windows spawn bug, not a scope bug. | 1-line spawn fix applied + verified GREEN. This PR. |
| **2. Fence tripwire fails** (`tournamentUserScoring.test.js` → "decide.js port sources are byte-intact") | Block drifted / introduced by #585 Correlation Lab merge | `decide.js` is **byte-intact**. Local failure is **CRLF vs LF**: `core.autocrlf=true` + no `.gitattributes` checks the file out with CRLF on Windows; the test builds its expected block with `.join('\n')` (LF). | **NOT a fence violation. NOT #585. Pre-existing local line-ending artifact.** | **BACKLOG** (see below). No fix in this task. |

Both items are Windows-local tooling artifacts; neither reflects on whether Release 2 is dark. Release 2 remains proven dark (flags hold off values; 156 controls/off-state tests green). Neither gated the flag walk.

---

## Item 1 — spawn fix (applied)

**File:** `scripts/release2-dark-smoke.js` (test-tooling script, non-fenced).

**Evidence of root cause:**
- The script's `OFF_STATE_TEST_FILES` list = 8 Release-2 controls/off-state suites, all present; running them manually → **8 files, 156 tests passed, exit 0**. Scope was never the problem.
- `spawnSync('npx', …)` (no shell) on Windows → `error.code='ENOENT'`, `status=null`.
- `spawnSync('npx.cmd', …)` (no shell) → `error.code='EINVAL'` (Node no longer spawns `.cmd`/`.bat` without a shell).
- Both `npx`/`npx.cmd` **with `shell:true`** → `status:0`. This is the fix.
- The founder's "credential/network/TZ suites" impression traces to `package.json` `test => vitest` (bare), which runs the *whole* suite (incl. `ws1-observe-walk`, `parse-signal`, `dateUtils`). The *scoped smoke* never ran those.

**Fix:**
```js
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCmd, ['vitest', 'run', ...OFF_STATE_TEST_FILES], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf-8',
  shell: true,   // required to resolve npx / spawn npx.cmd on Windows
});
```
Args are hard-coded literal file paths (no interpolation) → `shell:true` carries no injection surface.

**Verification:** `node scripts/release2-dark-smoke.js` → **GREEN**, "Test Files 8 passed (8)", exit 0. The script now means what it claims on a bare local Windows run.

---

## Item 2 — BACKLOG: repo-wide LF normalization via `.gitattributes`

**Problem class:** With `core.autocrlf=true` and no `.gitattributes`, Windows checkouts get CRLF line endings. Any test that reads a source file and compares against a `.join('\n')` / byte-exact literal will **falsely fail on a Windows checkout** — while passing on CI/Mac/Linux. `tournamentUserScoring.test.js`'s decide.js fence tripwire is the current instance; the class will recur for any future byte-exact source assertion.

**Confirmed NOT a fence violation:** the `decide.js` git blob is **LF and byte-identical** to the fenced block at:
- `HEAD` (`e9d8b3d`) — `hasCRLF:false, blockMatches:true`
- base `4a0f43e` (pre-Release-2) — `hasCRLF:false, blockMatches:true`
- `e1decba` (#585 Correlation Lab merge) — `hasCRLF:false, blockMatches:true`

The fenced formulas are intact. This was purely a local line-ending artifact — not a fence drift, not introduced by #585, no re-vetting of the port required. (The sibling single-line tripwire at decide.js:794 passes precisely because a single-line substring has no embedded newline.)

**Recommended remediation (its own small task):** add a repo-root `.gitattributes`:
```
*.js text eol=lf
```
Fix it **once at the repo level** rather than per-test — the CRLF/LF mismatch is a repo-wide class, and per-test normalization would leave every future byte-exact test to re-discover it. Expect a one-time re-checkout/renormalization churn (`git add --renormalize .`); scope and land it separately so the diff is isolated.

**Explicitly rejected:** per-test CRLF normalization (`decideSource.replace(/\r\n/g,'\n')`) — treats the symptom on one test, not the class.

---

## Deliverable / next steps
- Item 1 ships as a normal PR (test-tooling only, non-fenced, no `/code-review` threshold reached).
- Item 2 to be tasked separately as the `.gitattributes` normalization.
