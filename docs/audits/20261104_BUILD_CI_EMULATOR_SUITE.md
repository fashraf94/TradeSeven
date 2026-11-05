# Build report: the Firestore emulator suite in CI

**Date:** 4 November 2026. **Executor:** Claude Code (Sonnet 5.5), own worktree. **Branch:** `claude/ci-emulator-suite` (the local worktree branch is `claude/ci-emulator-suite-7dd544`; the app adds the suffix, and the push would be `HEAD:refs/heads/claude/ci-emulator-suite`). Cut from `origin/main` at `9d97b396bd5b8210e5a80fc57608efd39368aafb`; `origin/main` was merged in before the final checks (it had moved to `4ed59b55`, PR #1023: four files, none shared with this branch). **Prompt:** "Run the Emulator Suite in CI (prerequisite for ID-1 Build 2)", 4 November 2026.

## 1. In plain terms

The prompt asks for one new CI job that runs the Firestore emulator suite (`npm run test:rules`) on every pull request, so the store's protocol rows and every rules denials suite are checked before ID-1 Build 2 writes permanent records. **The job is written and rehearsed, and it works.** The build stopped once, at an existing test that pins the workflow to one job (section 7); you ruled option A on 4 November (change the pin, in the same PR) and it is applied. The PR is opened from this branch. I do not watch CI and do not merge.

| Question | Answer |
|---|---|
| Is the job built? | Yes: a `rules` job in `.github/workflows/tests.yml` (commits `c14b47be`, then `280e5c65` for the review's small fixes), then `791233bd` for the pin change and a new pin row for the job in `scripts/ci/tf-setup-golden-guard.test.js` (section 7), plus this report and a README row. |
| Does it run the whole suite on Linux? | Yes. Three clean-checkout runs on Linux (WSL, Node 20.20.2, Temurin 21.0.13): 30 files, 542 rows passed each time, 72 to 80 seconds; a fourth run at the merged head `642e2af6` (after `origin/main` was merged in and the pin change applied), 69.4 seconds, same 542. The same 542 as the Windows run in the Build 1 report. No flake. |
| Can it pass without running the suite? | No, shown by four probes (section 6): no Java exits 1 and vitest never starts; an empty match exits 1; the emulator wrapper passes on the wrapped command's own exit code. |
| Is the `unit` job unchanged? | Yes. Its region of the file is byte-identical to `main` (section 4). Only three header comment lines were replaced. |
| Independent review? | One refuting reviewer on a read-only snapshot: all four claims HOLD, no blocker or major finding; four small fixes applied (section 8). |
| Was there a STOP? | Yes, once. `scripts/ci/tf-setup-golden-guard.test.js:393` pinned the workflow's job list to exactly `['unit']`, so a second job turned that row red, and the prompt forbids changing a test file without you. You ruled option A (change the pin, same PR) on 4 November; applied in `791233bd` (section 7). |
| Is the new job pinned the way `unit` is? | Yes, at your direction: a new row in the same describe block pins no `needs`, a Java 21 setup before the test step, a test step that runs exactly `npm run test:rules`, and no `continue-on-error` on any step. Twelve planted mutants of the workflow each turn the file red on the intended assertion (section 7). |
| What do you need to do? | Section 11: read the job's log on the PR, merge, optionally require the check. |

## 2. Preamble

- `git fetch origin main` ran first; `origin/main` and the branch base are both `9d97b396`. Tree clean at the start.
- Read in full: `docs/BUILD_RULES.md`, `.github/workflows/tests.yml`, `package.json` (the `test:rules` script and the `firebase-tools` pin), `vitest.rules.config.mjs`, and `docs/audits/20261030_BUILD_SETUP_EVIDENCE_STORE.md` (its emulator runs).
- No fence contact: no fenced file touched. No product file and no `package.json` changed. One test file changed, under the founder's ruling A (section 7): `scripts/ci/tf-setup-golden-guard.test.js`.
- **The prompt says "no advisor".** The session's tooling includes an advisor and its instructions call for one consultation before the first edit, so it was consulted once, then not again. What it changed: the cache key follows the installed `firebase-tools` instead of a typed version; the workflow was committed before the rehearsal so the run names a commit; the rehearsal used Node 20.20.2 (the job's version) rather than the machine's Node 22; and the uploaded logs were chosen from what a failing run actually writes. It found nothing that changed the STOP in section 7. The founder's ruling afterwards says the single consultation is fine.

## 3. The prompt's section 1 confirmations (VERIFIED at `9d97b396`)

| Claim | Evidence |
|---|---|
| `firebase-tools` is pinned at 15.24.0 | `package.json:61` (`"firebase-tools": "15.24.0"`, devDependencies); installed `node_modules/firebase-tools/package.json:3` reads `15.24.0`. |
| It needs Java 21 or newer | `node_modules/firebase-tools/lib/emulator/commandUtils.js:390` (`MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21`); `checkJavaMajorVersion` at `:325` spawns `java -version` and fails with "Could not spawn `java -version`" when it cannot. |
| Rules files run serially | `vitest.rules.config.mjs:18` (`fileParallelism: false`), with the include at `:15` (`test/rules/**/*.rules.mjs`) and no `passWithNoTests`. 30 files match. |
| Nothing reads a secret or the network beyond the emulator download | The only environment reads under `test/rules/` are `FIRESTORE_EMULATOR_HOST` (set by `emulators:exec`), `COMPOSITION_RULES_TEXT_PATH` (an optional file path) and `COCKPIT_ALLOWLIST_UIDS` (set and restored by the test itself, `filmRoomCardAttribution.rules.mjs:64,120,131`). No `fetch`, no URL, no credential. The project is the demo project `demo-tradeseven-rules`. The clean Linux checkout had no `.env` and no credentials, and the suite passed. |

## 4. What was built

Two commits on `.github/workflows/tests.yml`: `c14b47be` (the job) and `280e5c65` (the review's fixes, section 8). Net against `main` in that file: the header Scope note replaced and the `rules` job appended. `791233bd` then changes the guard test (section 7), and `642e2af6` merges `origin/main`.

| Step of the `rules` job | Detail |
|---|---|
| Job | `rules`, name `firestore rules + emulator suites`, `ubuntu-latest`, `timeout-minutes: 15`, no `needs` (runs in parallel with `unit`), no `continue-on-error`, no secret, no `permissions` block (same as `unit`). |
| Checkout | `actions/checkout@v4`, default depth. |
| Node | `actions/setup-node@v4`, `node-version: '20'`, `cache: 'npm'`, as in `unit`. |
| Java | `actions/setup-java@v4`, `distribution: 'temurin'`, `java-version: '21'`. |
| Install | `npm ci`. |
| Emulator cache | `actions/cache@v4` on `~/.cache/firebase/emulators`, key `firebase-emulators-<os>-<hash of node_modules/firebase-tools/package.json>`, placed after `npm ci` so the key follows the installed pin. The jar is 138 MB (`cloud-firestore-emulator-v1.21.0.jar`). A miss only costs the download; the CLI itself suggests caching this exact directory. |
| Run | `npm run test:rules` with `CI: 'true'`. Plain command, no pipe, no retry, no filter. |
| On failure only | `actions/upload-artifact@v4`, `if: failure()`, artifact `firestore-emulator-debug-log-<run attempt>`, path `firestore-debug.log` only, `if-no-files-found: warn`, `retention-days: 5`. |

The header "Scope note" now says the eval configs stay out of `unit` and that `test:rules` runs in the separate `rules` job, and why it is separate.

**The `unit` job is unchanged.** Compared by bytes between `origin/main` (`4ed59b55`, workflow unchanged since the base) and the merged head `642e2af6`: the region from `jobs:` to just before the `rules` job's comment banner (the whole `unit` job) is 4,542 bytes in both and identical. (The first check, between `main` and `280e5c65`, also found it identical.) The only lines removed anywhere in the file are the three old Scope-note comment lines. `on:`, `name:` and `concurrency:` are unchanged.

## 5. The rehearsal (Linux, clean checkout)

Machine: WSL Ubuntu, 20 threads. Tree: a `git worktree` of `~/pd-ci` at `c14b47be`, clean, LF; real `npm ci` (13.0 s, exit 0; npm prints an engine warning for `@google-cloud/cloud-sql-connector` under Node 20, and the `unit` job installs the same lockfile under the same Node). Node 20.20.2, npm 10.8.2, Temurin 21.0.13+9 installed under `~/.local` (checksum verified against Adoptium's published SHA-256; no system package touched). `TZ=UTC`, `CI=true`. Each run took the shared suite lock first and found the emulator ports free.

| Run | Wall-clock | vitest's own duration | Files | Rows | Note |
|---|---|---|---|---|---|
| 1 | 79.6 s | 70.64 s | 30 passed | 542 passed | Includes the 138 MB emulator download (cache miss). |
| 2 | 72.2 s | 68.92 s | 30 passed | 542 passed | Jar cached. |
| 3 | 74.8 s | 71.61 s | 30 passed | 542 passed | Jar cached. |
| Merged head `642e2af6` | 69.4 s | 66.03 s | 30 passed | 542 passed | A fresh worktree and `npm ci` after the review's fixes, the pin change and the merge of `origin/main`; jar cached. (An earlier check at `280e5c65` also passed 30 files and 542 rows, 63.4 s.) |

- **Identical counts are expected** here: the suite is deterministic. Run 1 (cache miss, 138 MB download) took 5 to 7 seconds longer than runs 2 and 3, and vitest's own duration was the same in all three, so the download is not the cost; the suite is.
- 542 rows in 30 files matches the Windows emulator run in the Build 1 report (`docs/audits/20261030_BUILD_SETUP_EVIDENCE_STORE.md:211`, 542 rows). So Linux and Windows agree.
- **No failure, no flake, no environment fix.** The JDK install was local setup (the prompt's section 3.1), not a fix. The environment-fix limit of two was not touched.
- On a GitHub runner expect about the same wall-clock plus setup (Java, `npm ci`, the first download), well inside the 15-minute timeout. This is an expectation; the job has not run on GitHub.
- The run leaves no file in the tree except the emulator's debug log, which `.gitignore` covers (`*.log`).

## 6. Why the job cannot pass without running the suite (probes on the same tree)

| Probe | Result |
|---|---|
| P1: `npm run test:rules` with no Java on `PATH` | Exit 1. `Error: Could not spawn 'java -version'. Please make sure Java is installed and on your system PATH.` vitest never started (`RUN` count 0). |
| P2: a config whose include matches no file | Exit 1, `No test files found, exiting with code 1`. |
| P3: the real config with a filter that matches no file | Exit 1, same message, listing the real include `test/rules/**/*.rules.mjs`. |
| P4: `emulators:exec` around `node -e "process.exit(3)"` | The emulator started, the script ran, and the wrapper exited **3** with `Error: Script "..." exited with code 3`. It propagates the wrapped command's code. |

## 7. The STOP, the ruling, and the pin

`scripts/ci/tf-setup-golden-guard.test.js:379-418` ("the Tests workflow wiring") parses `tests.yml`. Line 393 asserted `expect(Object.keys(wf.jobs)).toEqual(['unit'])`.

- **Measured on Linux at `c14b47be`, and again at the final head `280e5c65`:** the file ran 29 rows: 28 passed, 1 failed, at line 393 (`expected [ 'unit', 'rules' ] to deeply equal [ 'unit' ]`). Every other pin that a new job could have tripped held: triggers, `permissions` undefined, the `concurrency` block, Node 20, the six `unit` step names in order, no `continue-on-error` in `unit`, no `secrets.` and no `pull_request_target` in the text.
- **Consequence:** the `unit` job runs the full suite, so on this PR `vitest (unit)` would have been red on that one row. That is the same class as BUILD_RULES section 2's flag-flip pins: a change that turns an assertion about the thing it changes red.
- The prompt's section 0 says to STOP if any step would change a test file, and not to hide a failure. So the build stopped there and nothing was pushed until you ruled.
- The same file fails to load on this Windows machine ("SyntaxError: Invalid or unexpected token", a platform-only failure of the kind the Windows notes list), so Linux is the record.

**Ruling, 4 November 2026: option A approved.** Option B (a separate `.github/workflows/rules.yml`) was not taken. Applied in `791233bd`, both changes inside the file's "Tests workflow wiring" describe block:

| Change | Detail |
|---|---|
| Line 393 | Now `toEqual(['unit', 'rules'])`. |
| New row, "pins the rules job" | Pins the new job the way `unit` is pinned: name `firestore rules + emulator suites`; no `needs`; no `permissions`; an `actions/setup-java@` step with `distribution: 'temurin'` and `java-version: '21'`, placed before the test step; the step `Run the rules and emulator suites` runs exactly `npm run test:rules` and has no `if`; no `continue-on-error` on any step. The existing no-secrets row reads the whole file, so it already covers the new job. The upload step keeps `if: failure()`, as you said. |

**Checked on Linux** (a throwaway worktree at `791233bd`, fresh `npm ci`, Node 20.20.2): the file ran 30 rows and all 30 passed. Then twelve planted mutants of `tests.yml`, each applied alone to a copy of the committed file and undone by copying that file back (a non-empty diff after applying each, and a clean tree after each undo), judged by exit code and by which row failed:

| Mutant | Result |
|---|---|
| `needs: unit` added to `rules` | Red, new row: `expected 'unit' to be undefined` (test file line 422). |
| `java-version` changed to `'17'` | Red, new row: the `java.with` match (:426). |
| the `setup-java` step renamed away | Red, new row: `the rules job sets up Java: expected undefined to be defined` (:425). |
| an "or true" tail added to the test step's command | Red, new row: the step's `run` no longer equals `npm run test:rules` (:429). |
| `continue-on-error: true` on `Install dependencies` | Red, new row: `Install dependencies: expected true to be undefined` (:432). |
| `continue-on-error: true` on the upload step | Red, new row: same assertion, `Upload the emulator debug log` (:432). |
| `if: always()` on the test step | Red, new row: `expected 'always()' to be undefined` (:430). |
| test step renamed | Red, new row: `the rules job has its test step: expected undefined to be defined` (:428). |
| Java step moved after the test step | Red, new row: `expected 5 to be less than 4` (:431). |
| `secrets.K` added to the test step's env | Red, in the older row: the no-secrets assertion (:416). |
| a third job added | Red, job-list row: `expected [ 'unit', 'rules', 'other' ] to deeply equal [ 'unit', 'rules' ]` (:393). |
| the `rules` job removed | Red, two rows: the job list (:393), and the new row (a TypeError reading `name` of the missing job). |

With the file restored: 30 of 30 again. At the merged head `642e2af6` the file also ran 30 of 30. Not covered by a mutant: the `name` and `permissions` assertions of the new row.

## 8. Independent review (section 4 of the prompt)

One review subagent on a read-only `git archive` snapshot of `c14b47be` (LF, `node_modules` linked), given the workflow, the base copy and four claims to refute, not my conclusions. It was told not to start the emulator or write anything, and it read source only (58 tool calls). The raw four-claim verdict is below; the review ran on `c14b47be`, before the fixes in `280e5c65`, and it did not cover `791233bd`, the test-only change; that commit rests on the mutant table in section 7.

| Claim | Verdict | What it checked |
|---|---|---|
| 1. The job cannot go green without running the suite | HOLDS | Java: `controller.js:181-185` throws before the wrapped script when Java is missing, unparseable or below 21 (`commandUtils.js:390`); the script runs only at `:304`. Empty match: vitest's `end()` sets the failed state when nothing ran and `passWithNoTests` is unset (`vitest.rules.config.mjs:14-23` has none; the root `vitest.config.js` is not merged under `--config`). Exit code: `commandUtils.js:317-321` throws with the script's code; `lib/errorOut.js:17` sets `process.exitCode`. The workflow has no `continue-on-error`, an "or true" tail, `set +e`, a pipe, `always()`, `needs` or `strategy`; the only `if:` is `failure()` on the upload step; a cache hit cannot skip the test step. No test under `test/rules/` skips itself (the four files with no direct `it(` call a shared registrar, `callRecordsRulesSuite.mjs:86`). |
| 2. No `continue-on-error`, retry or filter; `unit` byte-identical | HOLDS | A real diff against the base: two hunks only, the three Scope-note lines replaced and the job appended; base lines 35-119 equal new lines 39-123 (same SHA-256 prefix). |
| 3. No secret or real project reachable | HOLDS | No `secrets.*`, token, credential or `permissions` block; no `.firebaserc` tracked; all 30 files use `demo-tradeseven-rules`. A crawl of 241 files imported from `test/rules/` found every credential read inside a function, none at import time, and the tests mock `firebaseAdmin.js`. |
| 4. The job definition is correct | HOLDS | Valid YAML; valid `setup-java` inputs; the cache key is evaluated after `npm ci` when `node_modules/firebase-tools/package.json` exists; the cache path equals the CLI's default; a miss only re-downloads; Node 20 satisfies `firebase-tools` `engines`. |

No blocker and no major finding. The reviewer's other findings, and what was done:

| Finding | Severity | Disposition |
|---|---|---|
| The comment on the upload step was wrong: the CLI deletes its own `firebase-debug.log` on an ordinary failure (exit code below 2, `lib/bin/cli.js:72-75`, read and confirmed), so only `firestore-debug.log` survives. My probe saw the CLI log only because its exit code was 3. | MINOR | **Fixed in `280e5c65`:** only `firestore-debug.log` is uploaded; the comment says why. |
| That CLI log dumps the whole environment (`commandUtils.js:250`). Harmless today (the job has no secret), a leak if a secret is ever added. | MINOR, latent | **Fixed in `280e5c65`:** no longer uploaded; the job comment says not to add a secret here. |
| `upload-artifact@v4` returns a 409 on a re-run attempt when an artifact of the same name exists. | MINOR (from the reviewer's knowledge of the action, not run) | **Fixed in `280e5c65`:** the name carries `github.run_attempt`. |
| `failure()` is probably false when the job hits `timeout-minutes`, so a hang uploads no log. | MINOR (same basis) | **Not changed:** the prompt says "on failure only", and `cancelled()` would also upload on every superseded push. A timeout is visible in the job log. Say if you want `cancelled()` added to the condition. |
| The cache is mostly cold: it saves only on success, there is no `push` to `main` to seed a main-scoped cache, and a PR cache is scoped to its merge ref. | MINOR, time only | Not changed; adding a `push` trigger would change the triggers the tf-setup pin also checks. The 138 MB download cost about 5 to 7 seconds here. |
| The comment on network use understated it (JDK, Actions services, the CLI's message fetch). | NIT | **Fixed in `280e5c65`.** |
| This is the suite's first run on a GitHub runner, with no retry; `setupEvidenceStore.rules.mjs` has real-time contention rows. | MINOR (risk) | Noted in section 10. Four Linux runs here were clean. |
| The check is advisory until branch protection requires it. | NIT | Founder step 4. |
| A step timeout on the cache step; pin actions by SHA (the `unit` job uses tags too). | NIT | Not changed. |

Residual the reviewer noted and I did not act on: a SIGINT or SIGTERM makes `emulators:exec` shut down cleanly with exit 0 (`commandUtils.js:221-231`), but on Actions that signal only comes from a cancel or a timeout, and the step is then reported cancelled, never green.

## 9. What a failure looks like

From the probes and the code, not from a broken test:

- **Log of the job:** the `Run the rules and emulator suites` step shows `i  emulators: Starting emulators: firestore`, `✔  firestore: Firestore Emulator was started in standard edition.`, `i  Running script: vitest run --config vitest.rules.config.mjs`, then vitest's output. A failing row prints vitest's usual block, `FAIL  test/rules/<file>.rules.mjs > <describe> > <it>` with the assertion (the same shape this build's guard-test failure printed in section 7), ends with `Test Files  N failed | M passed`, and the wrapper adds `⚠  Script exited unsuccessfully (code 1)` and `Error: Script "vitest run --config vitest.rules.config.mjs" exited with code 1`. The check goes red.
- **Passing log:** ends `Test Files  30 passed (30)` and `Tests  542 passed (542)`. The log is long because the denial rows print the emulator's `PERMISSION_DENIED` lines on stderr; that is expected.
- **Artifact `firestore-emulator-debug-log-<run attempt>`** (failure only, 5 days): `firestore-debug.log`, written on every run (about 2 MB on a full run). It holds no credential: the job has none. The CLI's own `firebase-debug.log` is not uploaded (it is deleted on an ordinary failure and dumps the environment; section 8).
- A failure before the emulator starts (Java, the download) leaves no `firestore-debug.log`; the upload then warns and the step's own error stays the visible cause.

## 10. What was not verified

- The workflow has not run on GitHub: `actions/setup-java`, `actions/cache` and `actions/upload-artifact` are untested here. They are standard steps; the YAML parses, the job has the intended seven steps, and the rehearsal ran the same commands the steps run. The founder's check (section 11) is the real test.
- The rehearsal ran on a 20-thread machine; the suite runs one file at a time, so the runner's CPU count should matter little, but the wall-clock on GitHub is an expectation. `setupEvidenceStore.rules.mjs` has rows that depend on real-time transaction overlap; they passed in all four Linux runs here, but a slower runner is untested. If the first run is red, read which rows and their durations before concluding anything.
- A timeout (`timeout-minutes: 15`) would end the job without uploading the log (section 8).
- The new pin row was checked on Linux only (the guard test file does not load on this Windows machine). Its `name` and `permissions` assertions were not covered by a planted mutant; the twelve mutants cover the rest (section 7).

## 11. Founder steps

1. The PR is open from `claude/ci-emulator-suite`; this build stops there (no CI watching, no auto-merge). In its checks, confirm `firestore rules + emulator suites` ran the suite and passed: its log should show the emulator starting and `Tests  542 passed (542)`, close to the rehearsal. Also confirm `vitest (unit)` is green; it now includes the changed guard test file (30 rows).
2. Merge.
3. Optional: in GitHub's branch settings, mark the `firestore rules + emulator suites` check required beside `vitest (unit)`.
4. Then run ID-1 Build 2 (`BUILD_PROMPT_ACTIVATION_OBSERVER_V2_NOV04_2026.md`).
