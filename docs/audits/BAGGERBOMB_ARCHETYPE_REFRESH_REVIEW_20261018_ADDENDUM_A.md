# Addendum A — PR #982 re-check

**Re-checks:** PR #982 (`codex/baggerbomb-archetype-refresh`, head `96d1e1e`) against `docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md` §11 and `docs/audits/20261019_ARCHETYPE_REFRESH_SECTION11_VERIFICATION.md` **Reviewer:** Claude (Opus 5.5) · Oct 18, 2026 · read-only, separate worktree and mutation snapshot, no production data, no model calls

## Verdict

| Item | Result |
| --- | --- |
| **Verdict** | **One fix required, then ready to merge dark.** |
| The fix | The new orchestration suite breaks an existing repo guard, so the PR's test run is red. A one-word rename fixes it (A1). |
| §11 items | All done and verified: dark flag, two orchestration tests, battle id in the warning, optional unequal-sector fixture, PR text. |
| Production behavior while dark | Identical to base: the menu returns before any ranking or warning when the flag is not `true`. |
| Fenced files | All 11 byte-identical to base `39053aed`. |

## A1 — Existing guard rejects the new suite's flag mock · CONFIRMED · blocks merge (CI red)

- **Source:** `src/config/tickStampsFlags.test.js:42-56` requires every `api/cron` suite that imports `agent-evaluate.js` and mocks `featureFlags.js` to write the mock as `async (importOriginal) => …`. It is a source-text check. `api/cron/agent-evaluate.archetypeMenu.test.js:11` writes `async original => ({ ...(await original()), … })` — a correct spread, but under a different parameter name, so the guard lists it as an offender.
- **Reproduced:** full suite on `96d1e1e` under `TZ=UTC` → `tickStampsFlags.test.js` 1 failed: "bare-factory featureFlags mocks in cron suites that drive agent-evaluate.js: agent-evaluate.archetypeMenu.test.js". The PR's `Tests` workflow runs the full suite on every PR into `main` (`.github/workflows/tests.yml`), so it will fail the same way.
- **Why it was missed:** the §11 verification ran a scoped set (53 files), which does not include this guard.
- **Fix (verified):** rename the parameter to `importOriginal` in that one mock. With the rename, `tickStampsFlags.test.js` passes 4/4 and the orchestration suite 12/12.

## Verified

- **Commit content.** The PR's first commit `56d7cd4` has the same seven file contents as the reviewed `a2ae2204` (all blob ids match). The new SHA comes from re-authoring, not from code changes. The verification report names `a2ae2204` as its starting HEAD; that SHA does not appear in the PR history. No action needed.
- **Review copy.** `docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md` is byte-identical to the delivered review (SHA-256 `bb9136a3…`).
- **Flag.** `ARCHETYPE_REFRESH_MENU_ENABLED = false` with its `// Pinned by:` pointer (`src/config/featureFlags.js:2056-2066`). It is read at call time, behind an own-export check (`api/_utils/archetypeCandidateMenu.js:15-17`), and listed in `DARK_BY_DESIGN` (`src/config/flagPinGuard.test.js:155`). The namespaced pin `expect(actualFlags.X).toBe(false)` matches the guard's pin pattern (`flagPinGuard.test.js:284`).
- **Dependency guard (BUILD_RULES §4).** The unit suite now partially mocks the flags module but still loads the real one (`...await original()`), and `agent-evaluate.shouldRebuildHotBench.test.js` still imports `agent-evaluate.js` with no mocks. That import reaches the new module and `featureFlags.js`. The guard is intact.
- **Review gaps.** T1 (exact overflow list), T2 (unresolved flat6 case) and T3 (unequal sectors) are closed.

## Tests run

| Run | Runtime | Result |
| --- | --- | --- |
| Focused: selector, orchestration, flag-pin, dependency guard, caller census, registry | Node 22.22.0, `UTC` | 6 files, 100 tests passed |
| Codex's scoped regression set | **Node 20.20.2** (the CI runtime), `UTC` | 53 files, 1,153 tests passed (matches the verification report) |
| Full suite | Node 22.22.0, `UTC` | 22,538 passed, 2 failed: A1, and `film-tape-backfill.e2e`, the load-sensitive test that failed the same way on the earlier run and passes when run alone |

## Mutations (11, one at a time, restored after each)

| Mutation | Caught? |
| --- | --- |
| Remove the dark gate | Yes (3 tests) |
| Treat a missing flag value as on | Yes |
| Drop the own-export guard | Yes |
| Flip the default to true | Yes (pin + flag-pin guard) |
| Rank after exclusions | Yes (12 tests) |
| Trim overflow by shared fit | Yes (7 tests, now including the orchestration case) |
| Cron drops bench from exclusions | Yes |
| Cron passes no `gameMode` | **Yes — previously missed** |
| Warning drops the battle id | Yes |
| Cron passes `isTournament: false` | No — expected; production cannot create a tiered battle with resolved tournament context |
| Equipped placed before ranked names (under cap) | No — expected; optional T4 was not requested |

## Instruction for Codex (copy as-is)

> On `codex/baggerbomb-archetype-refresh` (PR #982), first report the branch, HEAD and whether the tree is clean. Then make one change: in `api/cron/agent-evaluate.archetypeMenu.test.js`, write the `featureFlags.js` mock as `async (importOriginal) => ({ ...(await importOriginal()), get ARCHETYPE_REFRESH_MENU_ENABLED() { return flags.menu; } })`. `src/config/tickStampsFlags.test.js` requires that exact form. Run the full suite with `TZ=UTC` and report the totals. Commit this addendum as `docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018_ADDENDUM_A.md` in the same commit. Push. Do not merge or flip the flag.

## After that

Once the PR's `Tests` check is green, mark the PR ready and merge it. Merging changes no production behavior. The next step is the read-only menu dry run (review §7); the flag flip stays a separate PR after you've read the six menus.

---

## Codex implementation record — 2026-10-19 UTC

| Check | Result |
| --- | --- |
| Starting branch | `codex/baggerbomb-archetype-refresh` |
| Starting HEAD | `96d1e1e7c6b6b3d65588fa291ebbacb85e5427c9`, clean |
| Fetch | `git fetch origin` completed before remote comparisons |
| A1 disposition | CONFIRMED independently, FIXED |
| Before correction | `tickStampsFlags.test.js`: 1 failed, 3 passed |
| After correction | Guard 4/4 and orchestration 12/12 passed |
| Full UTC suite | 22,517 passed, 88 skipped, 0 failed. 1,037 files passed, 7 skipped, 1,044 total |
| Full-run runtime | Node 24.19.0, Vitest 4.0.17, `CI=true`, 737.47 seconds |
| Build | Explicit `vite build` passed in 23.05 seconds |
| Lint | Changed-file crash-class lint passed with `--max-warnings 0` |
| Scope | Only the two mock-rename lines and this addendum changed |
| Flag and fence | Flag remains false. All 11 fenced files remain byte-identical to base `39053aed` |

VERIFIED: `src/config/tickStampsFlags.test.js:42` scans cron-suite source and its regex at line 52 requires `async (importOriginal)`. The previous spelling fails this exact guard. The correction at `api/cron/agent-evaluate.archetypeMenu.test.js:11` preserves the same actual-module spread and getter behavior. The guard itself was not altered.

An independent reviewer attempted to refute A1 on a separate read-only archive snapshot. The old spelling failed the exact regex, the corrected spelling matched, and the reviewer independently passed all 16 focused tests. Disposition: CONFIRMED and FIXED, with no further findings. The earlier cumulative review and mutation evidence remain applicable to the unchanged implementation. This follow-up adds no new tests.

Full-run command:

```sh
TZ=UTC CI=true node node_modules/vitest/vitest.mjs run --maxWorkers=2
```

Observed final output:

```text
Test Files  1037 passed | 7 skipped (1044)
     Tests  22517 passed | 88 skipped (22605)
  Duration  737.47s
```

The same full run passed `tickStampsFlags.test.js` (4), `agent-evaluate.archetypeMenu.test.js` (12), and `film-tape-backfill.e2e.test.js` (7). The previously reported backfill failure did not recur.

The 23 additional skips relative to Claude's 65 are existing browser-bounds tests: AgentDock (4), mobileHero (13), and CharacterArea (6). Their existing `hasBrowser` checks found no Chromium binary in this environment. No skip condition or test configuration was changed. These checks are outside the changed test-source path.

No production code, fenced file, feature-flag value, or CI workflow changed. No production reads or model calls were made. Publication uses the connected GitHub app, with the published source tree checked against the local staged tree. The founder retains the ready-for-review and merge decisions. This task does not poll CI, merge, or flip the flag.
