# Build report — the tf-setup golden-baseline guard in CI

Claude Code (Claude Opus 5.5), October 28, 2026, for Flash. This is the immediate follow-up to merged PR #1001 that the slice 1 build report names (§16, §21.10): make the cross-revision golden guard a blocking step of the Tests workflow. Nothing in the evaluator changes. This is a draft PR; it stops at pushed.

## 1. The enforcement gap

`golden.test.js` checks one revision against itself. A golden regenerated under an unchanged `SEMANTICS_ID`, with the baseline's entry rewritten to the new hash, passes it. Astra's review of PR #1001 demonstrated this with a scratch control: 56 of 56 golden tests passed. Only `scripts/experiments/tf-setup-golden-baseline-check.mjs`, which compares against an earlier revision, rejects that rewrite. Until now it ran only by hand, in a build's final checks. CI ran lint and the unit suite, with a depth-1 checkout and no guard step.

## 2. Starting state (VERIFIED)

- `origin/main` = `148a3fa19b03e9d11d6d00020f96ad0d53e41d42`, the merge of PR #1001. Its parents are `62380f14` and the reviewed head `84fa72ad`.
- The accepted identity at `148a3fa1`:
  - `setupVersion` `tf-setup-v1`;
  - `thresholdsHash` `26f3f411b566`;
  - `semanticsId` `tf-setup-v1/sem-1`;
  - golden SHA-256 `767d22633672745d632cd7612e90d37c295b276692d60bdcd8f408f09105f32d`, raw bytes and canonical form alike;
  - one baseline entry, under `sem-1`, with that hash.
- The evaluator files at `148a3fa1` are identical to `84fa72ad`'s.
- The branch `claude/tf-setup-ci-golden-guard` was cut fresh from `origin/main` with a clean tree. The merged slice-1 branch was not reused.

## 3. What changed

| File | Change |
|---|---|
| `.github/workflows/tests.yml` | The checkout fetches full history (`fetch-depth: 0`). `workflow_dispatch` gains a required `base_ref` input. A named step runs `node scripts/ci/tf-setup-golden-guard.mjs` after Node setup and before `npm ci`, the lint gate and the unit suite |
| `scripts/ci/tf-setup-golden-guard.mjs` (new) | The CI wrapper: base selection, history checks, base preflight, the guard call, fail-closed exit codes |
| `scripts/ci/tf-setup-golden-guard.test.js` (new) | 29 rows (27 before the correction in §10): isolated-repository integration rows on test-only evaluator fixtures, the wrapper's verdict helpers, and the workflow wiring |
| this report; `docs/README.md` | One row |

Unchanged: the guard script and its comparison policy, the evaluator, the thresholds, the semantics identity, the golden scenarios and bytes, and the accepted baseline entry. Nothing was regenerated (§7).

The workflow keeps:
- the `pull_request` trigger on `main`, with no path filter;
- job `unit` / `vitest (unit)`, Node 20, the concurrency group, the lint and unit gates;
- the PR merge-checkout, so the checked-out revision is still the merge result.

There is no `pull_request_target`, no secret and no `permissions` change.

## 4. Base selection

The comparison base is never the working tree and never a computed merge-base. It comes from the event alone:

- **`pull_request`:** the event's immutable target-base SHA, `github.event.pull_request.base.sha`. It must be 40-hex and present in the checkout; otherwise the message says the history is incomplete and names `fetch-depth: 0`.
- **`workflow_dispatch`:** the required `base_ref` input, resolved to a commit SHA.
  - It must match a conservative ref pattern: letters, digits and `. _ / @ ^ ~ { } -`, with no leading `-` and no space, colon or shell character.
  - It must resolve to a commit in the checkout.

For both events:
- the base must differ from the checked-out commit (no self-comparison);
- it must be an ancestor of it (`git merge-base --is-ancestor`), so it belongs to the tested history;
- an unrelated history and a non-ancestor are named separately.

**A base that predates acceptance fails.** A computed branch merge-base can predate baseline acceptance, and that is exactly the case the preflight rejects (§5), so none is ever substituted.

The log shows:
- the event name;
- the event's PR head and target-base SHA;
- the dispatch input;
- `GITHUB_SHA`;
- the checked-out commit and its parents;
- the comparison base and its source.

**Untrusted values stay out of program text.** Event values and the input reach the script only through the step's `env` (`TF_GUARD_*`), never through `run` text. git and the guard run with argument arrays, never a shell.

## 5. Failing closed

The baseline is accepted, so CI requires **comparison mode**. The guard's own `gitShow` turns any read failure into "absent", and three absent files make an initial-baseline run. The wrapper therefore checks the base itself before the guard runs. For each of `api/_utils/setupEvaluator/__fixtures__/goldenBaseline.json`, `goldenVerdicts.json` and `api/_utils/setupEvaluator/thresholds.js`:

1. `git ls-tree` must read the base's tree. A failure means the tree is unavailable.
2. The path must be listed. If it is not, the file is absent.
3. `git cat-file -e` must find the listed blob. A failure means the object is unavailable, which signals incomplete history.
4. `git show` must read it. A failure is reported with git's reason.
5. The baseline must parse as a non-empty array, the golden as a JSON object, and `thresholds.js` must export the three identity constants.

Each outcome has its own actionable message:
- **all three absent:** the base predates the accepted baseline; choose a later base;
- **some absent:** the base is incomplete, and the message names the missing files;
- **unavailable or unreadable:** the message names the object.

The wrapper then runs the existing guard with `--json`. It fails unless the guard reported `mode: compare` on exactly the selected base and head commits.

**An initial-mode result is a failure here.** The standalone checker keeps its initial mode for first creation: against `62380f14` it still prints `initial baseline creation` and PASS.

**Exit codes:**
- 0: pass;
- 1: the guard rejected the change, each failure printed and emitted as an `::error` annotation;
- 2: the comparison could not be set up.

The step has no `continue-on-error` and no `if`, so a nonzero code fails the job before the unit suite runs.

## 6. Verification

**The integration rows run the workflow's own command**, `node scripts/ci/tf-setup-golden-guard.mjs` with the `TF_GUARD_*` environment. They run it in an isolated temporary Git repository holding copies of the wrapper and the guard, and **small test-only evaluator fixtures** at controlled versions `sem-1`, `sem-2` and `sem-3`. No production evaluator file is read or pinned. (The first version copied the production files and pinned them to `sem-1`; §10 records that finding and its correction.)

| Row | Expected | Result |
|---|---|---|
| Unchanged evaluator files | exit 0, comparison mode | pass |
| Coordinated golden/baseline rewrite under unchanged `sem-1` (the head's own integrity check passes) | exit 1: golden changed under `sem-1`, entry 0 rewritten, no entry appended | pass |
| Rewriting an accepted entry's note | exit 1, entry 0 rewritten | pass |
| Removing the only entry, and removing entry 0 after a versioned change | exit 1, base entry removed | pass |
| Coordinated rewrite under an unchanged later id (`sem-2`) | exit 1: golden changed under `sem-2`, entry 1 rewritten, no entry appended | pass |
| Versioned changes `sem-1` → `sem-2`, `sem-2` → `sem-3` and `sem-1` → `sem-3`, history preserved, entries appended | exit 0, "golden changed under a new semantics id" | pass |
| Dispatch base: missing, unresolvable, option-shaped (`--upload-pack=x`), shell-shaped (`main; touch pwned`, no file created) | exit 2 | pass |
| Self-comparison, by SHA and as `HEAD`; unrelated root; sibling non-ancestor | exit 2, each named | pass |
| A valid ancestor predating acceptance (no evaluator files) | exit 2 preflight, never an initial pass | pass |
| Incomplete base (no golden); unparseable baseline | exit 2 | pass |
| A base whose golden blob is listed but deleted from the object store | exit 2 "object is unavailable" | pass |
| `pull_request` on a PR-style merge commit | exit 0; logs the PR head, the target base, HEAD with both parents, and the base with its source | pass |
| `pull_request` with no base, a branch name, or a 40-hex SHA absent from the checkout | exit 2 | pass |
| `workflow_dispatch` with a branch name | exit 0, resolved to its commit | pass |
| An unsupported event (`push`) | exit 2 | pass |

The wrapper's helpers have their own rows:
- an initial-mode guard report, a report on other commits, a crashed guard and unparseable output each fail;
- exit codes are kept, and `ok` must be true;
- a failed read of a listed file fails with git's reason;
- an ancestry error or an unreadable HEAD never falls back.

**The workflow wiring** is checked by parsing `tests.yml` with `js-yaml`:
- the triggers, the required `base_ref`, no path filter, no `pull_request_target`, no `permissions`, no `secrets`;
- the job identity, Node 20, the concurrency group, `fetch-depth: 0`;
- the exact step order;
- the guard step has no `continue-on-error` or `if`, its `run` holds no `${{`, and its `env` is exactly the four event mappings.

**Spot mutants on the wrapper and the workflow: 9 of 9 killed**, both before and after the correction in §10. Each run collected all of the file's rows (27 before, 29 after), and each file was restored byte for byte.

| Mutant | Killed by |
|---|---|
| initial mode accepted | the initial-mode row |
| the preflight skipped | the predating-base row |
| the ancestor check skipped | the unrelated and sibling rows |
| self-comparison allowed | the self row |
| a guard rejection reported as a pass | the rewrite rows |
| the unavailable-object check skipped | the deleted-blob row |
| the 40-hex check skipped | the branch-name row |
| `continue-on-error: true` on the step | the wiring row |
| `fetch-depth: 1` | the wiring row |

**Against this repository** (commit `3f60191c`, Windows, Node 22), captured with exit codes:

| Run | Result |
|---|---|
| `pull_request`, target base `148a3fa1` | exit 0, compare, base and head both `tf-setup-v1/sem-1`, golden `767d2263…`, 1 entry |
| `workflow_dispatch`, `base_ref=origin/main` | exit 0, resolved to `148a3fa1` |
| `workflow_dispatch`, `base_ref=84fa72ad` (the reviewed slice-1 head) | exit 0, compare |
| `workflow_dispatch`, `base_ref=62380f14` (main before acceptance) | exit 2, predates the accepted baseline |
| `workflow_dispatch`, `base_ref=HEAD` | exit 2, self-comparison |
| `workflow_dispatch`, empty `base_ref` | exit 2 |
| `pull_request`, a target base absent from the checkout | exit 2, names `fetch-depth: 0` |

**Repository checks:**

| Check | Result |
|---|---|
| The new file with the seven slice test files and the guard's tests, Windows | 476 of 476 (27 + 449) at first; **478 of 478** (29 + 449) after the correction, on the tree with `main` merged |
| `eslint` (gate and full config) on `scripts/ci/` | exit 0 |
| Linux, CI shape, at the merged head after the correction (§10) | at `011f2268` (the correction, with `main` `65b8632f` merged; the documents commit after it changes documents only): full suite 1,210 files passed, 8 skipped, **26,678 rows passed, 89 skipped, 0 failed** (255 s), the guard file's 29 rows among them; `npm run lint:gate` exit 0; `vite build` exit 0 (entry chunk `index-CWe8xobf.js` 4,830.27 kB, changed by #1000's `src/` work on `main`, not by this PR); the standalone checker against `65b8632f` in comparison mode, PASS |
| Linux, CI shape, before the correction | at `3f60191c` (the code commit; the documents commit after it changes documents only): full suite 1,206 files passed, 8 skipped, **26,567 rows passed, 89 skipped, 0 failed** (231 s), the new file's 27 rows among them; `npm run lint:gate` exit 0; `vite build` exit 0, entry chunk `index-CLx1U8Yq.js` 4,904.38 kB, unchanged; the standalone checker against `148a3fa1` in comparison mode, PASS. The wrapper on Linux in the same worktree: `pull_request` with target base `148a3fa1`, exit 0 in comparison mode; `workflow_dispatch` with `62380f14`, exit 2, predates the accepted baseline |

## 7. The accepted identity is unchanged

`git diff 148a3fa1..HEAD -- api/ scripts/experiments/` is empty. No evaluator, fixture or guard file changed, and nothing was regenerated. The golden is still `767d2263…`, the baseline still has its one `sem-1` entry, and the identity is still `tf-setup-v1 / 26f3f411b566 / tf-setup-v1/sem-1`.

## 8. Limitations

- **Branch protection is not configured by this edit.** Whether `vitest (unit)` is a required check for merging into `main` is a repository setting. This PR does not change or claim it.
- **PRs into other branches.** The workflow still runs only on PRs into `main`. A PR into a branch whose tip predates acceptance would fail the preflight by design.
- **Every PR into `main` runs the guard.** An unrelated PR passes in comparison mode, because the evaluator files are unchanged against its target base. Full history makes the checkout somewhat slower.
- **Re-running an old event.** If GitHub's merge ref was recomputed against a newer base, the event's `base.sha` is still an ancestor of the tested merge result. The guard compares against that recorded target base.
- **The guard enforces versioning discipline, not intent.** A change that bumps `SEMANTICS_ID` and appends an entry passes by design; whether such a change is warranted remains a review decision.
- **`workflow_dispatch` now requires `base_ref`.** That is a change for anyone dispatching the workflow by hand.
- **Workflow syntax** was validated by parsing and by the structural rows. `actionlint` is not installed here, and nothing was downloaded.
- **`js-yaml`** reaches the tests through eslint's dependency tree; it is not a direct `devDependency`.
- **CI itself was not run.** The local runs used Node 22. The PR's own CI run, which uses Node 20 and this workflow from the merge ref, is the first execution on GitHub, and it is not being watched.

## 9. Delivery

Pushed by refspec to `claude/tf-setup-ci-golden-guard` and opened as draft PR #1004 against `main`. The correction in §10 was pushed to the same draft PR. STOP: no CI watching, no review request, no auto-merge, no merge, deploy or activation, no provider call, no production read.

## 10. Correction before merge: the integration fixtures were coupled to the production version

**Finding** (the reviewer's independent check, before merge). The first version of the integration rows copied the production evaluator files into each temporary repository. It then pinned their golden hash, semantics id and history length to the initial `sem-1` state. Its versioned control also assumed `sem-1` → `sem-2`. A later, properly versioned production change would therefore fail four rows, although the CI wrapper handles that change correctly: it exits 0 in comparison mode. The tests, not the wrapper, would have blocked a legitimate evaluator release.

**Reproduction (VERIFIED).** I built an isolated copy with the production evaluator moved to a valid `sem-2`: the `sem-1` history preserved, one entry appended, `SEMANTICS_ID` raised, golden `c2277541…`. The original suite failed **4 of 27**, exactly the four reported:
- the pinned identity row;
- the coordinated rewrite;
- the entry removals;
- the versioned control.

**Resolution.** The temporary repositories now carry **test-only evaluator fixtures**, built in the test file:
- a small golden;
- its baseline history;
- a three-constant thresholds module (`SETUP_VERSION`, a 12-hex stand-in `THRESHOLDS_HASH`, `SEMANTICS_ID`).

There are three controlled states: `sem-1`, `sem-2` and `sem-3`. Each is consistent with itself, and each later state keeps the earlier history and appends one entry; a row asserts this. Fixed `sem-1`, `sem-2` and `sem-3` identifiers live only inside these fixtures. **No row reads or pins the production evaluator**, and the test file no longer reads `PATHS` from the repository root. The real wrapper and the real guard still run through the workflow's command.

**Coverage.** Every rejection row is kept, and the transitions are extended:

| Case | Result |
|---|---|
| Coordinated rewrite under unchanged `sem-1` | rejected |
| Coordinated rewrite under unchanged `sem-2` (new) | rejected |
| Rewritten entry; removed entry, alone and after a versioned change | rejected |
| Valid `sem-1` → `sem-2` | passes |
| Valid `sem-2` → `sem-3` (new) | passes |
| Valid `sem-1` → `sem-3`, across both appended entries | passes |

The suite went from 27 rows to 29. The production-pinned row is replaced by the fixture-consistency row. The pinned production hash was not updated and the positive control was not deleted.

**Evidence:**

| Check | Result |
|---|---|
| Current tree (production at `sem-1`) | 29 of 29 |
| **The same `sem-2` production copy** | **29 of 29** (it was 23 of 27) |
| The nine spot mutants, re-run | all killed, each run collecting all 29 rows |
| `eslint` gate and full config on `scripts/ci/` | 0 |

**Unchanged.** Since the reviewed head `6dbbdd3b`, the diff over `api/`, `scripts/experiments/`, `.github/` and the wrapper is empty. Only the test file changed. The evaluator, the accepted golden `767d2263…`, the baseline history, the semantics id, the workflow and the comparison policy are untouched.

**`main` moved.** While the PR was open, `main` moved to `65b8632f` (PR #1000, the Command Center S8 fixes). It touches no evaluator, guard or workflow file. It was merged at `011f2268bfbccc12ef4472d4f0077a3362a16ae4`; `docs/README.md`, the one shared file, merged automatically with both rows kept. The PR's own diff is still the same five files, additions only.
