# Archetype refresh: §11 revision verification

| Item | Verdict |
| --- | --- |
| Scope | §11 of the attached independent review only, including its optional unequal-sector fixture |
| Delivery branch | `codex/baggerbomb-archetype-refresh` |
| Starting HEAD | `a2ae2204ce76e364e0f46f5327c4a06f0185f602`, clean tree |
| Fetched base | `39053aeda6d54084c73d3d7d06f470ad0e6aec6b` (`origin/main`) |
| Dark default | VERIFIED: `ARCHETYPE_REFRESH_MENU_ENABLED = false` |
| Final regression run | 53 files, 1,153 tests passed under `TZ=UTC` |
| Focused run | 4 files, 64 tests passed |
| Build and scoped lint | Both passed |
| Adversarial checks | Seven mutations detected, one independently confirmed review finding fixed |
| Fence | All 11 fenced files byte-identical to fetched base |
| Base-failure qualification | Overflow fails unchanged base. The two new legacy-preservation cases pass base and fail their respective wiring mutations. |

`git fetch origin` completed before remote comparisons. The founder explicitly requested continued work on this branch and authorized publication plus PR creation, without merging. This record belongs to the revision commit containing it. No production reads, model calls, flag activation, or real-market dry run were performed.

## Implemented scope

- VERIFIED: dark flag, pin pointer, actual-module value pin, and dark-set registration at `src/config/featureFlags.js:2057`, `api/_utils/archetypeCandidateMenu.test.js:21`, and `src/config/flagPinGuard.test.js:155`.
- VERIFIED: call-time gate and missing-export short circuit at `api/_utils/archetypeCandidateMenu.js:15`. False delegates to the existing legacy branch at `api/cron/agent-evaluate.js:1508`.
- VERIFIED: independently computed exact overflow membership at `api/cron/agent-evaluate.archetypeMenu.test.js:99`. Eight bottom-ranked in-universe equipped names force 15 + 8 overflow. The expected result contains the first 12 archetype-ranked names followed by those eight equipped names.
- VERIFIED: flag-off and unresolved `baggerbomb_tournament` parity cases at `api/cron/agent-evaluate.archetypeMenu.test.js:114` and `:121`. Both assert fixed, independently characterized base hot-bench and monitoring lists.
- VERIFIED: battle ID and raw stored archetype in the warning at `api/cron/agent-evaluate.js:1502`.
- VERIFIED: optional unequal-sector fixture at `api/_utils/__fixtures__/archetypeCandidateMenu.js:2`, exercised for all six archetypes at `api/_utils/archetypeCandidateMenu.test.js:42`. Sector sizes are 28, 27, 26, 25, 24, 23, 20, and 19.
- VERIFIED: the attached review is copied byte-for-byte to `docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md`.

The cumulative feature changes hot-bench **membership** when enabled. The model still receives candidates in the ranking document's composite order, through the existing iteration at `api/cron/agent-evaluate.js:1600`. The helper calls fenced `computeArchetypeRankings` at `api/_utils/archetypeCandidateMenu.js:24`; no fenced file or scoring math was edited. V2 remains dark. Crons do not run on Vercel preview. The real-data observation and later flag flip remain separate work under the review's §7 and §10.

## Unchanged-base evidence

A separate tree was extracted from base `39053aed`. Only the new orchestration test and synthetic fixture were added. Production code was unchanged. Its `api/cron/agent-evaluate.js` was compared byte-for-byte with the base Git object. Both SHA-256 values were:

```text
00df9c0fbd84235de10d339e628da6589c174ad9068330aa769ee60612fb7d9c
```

Command, executed in that separate tree:

```sh
TZ=UTC node node_modules/vitest/vitest.mjs run api/cron/agent-evaluate.archetypeMenu.test.js -t 'flag-off output|unresolved flat6|keeps equipped priority' --reporter=verbose --maxWorkers=2
```

Observed result, exit 1:

```text
FAIL keeps equipped priority during overflow in the real refresh
  expected [ 'S009', 'S018', 'S027', ... ]
  to deeply equal [ 'S094', 'S072', 'S002', ... ]
PASS flag-off output equals the unchanged base fit list
PASS unresolved flat6 context retains the unchanged base fit list
Tests 1 failed | 2 passed | 9 skipped (12)
```

The complete new orchestration suite on unchanged base produced eight failures and four passes. The six archetype-membership cases, overflow, and expanded diagnostic failed. The two new preservation cases and two existing mode-preservation cases passed.

It would be inaccurate to claim the two newly added orchestration cases fail unchanged base. They require legacy behavior already present there. Their discriminating evidence is the two wiring mutations below. No expectations were distorted to manufacture base failures.

## Mutation evidence

After independent review finished, a third isolated snapshot received one mutation at a time. Original bytes were restored after each run. No fenced file was mutated. Each run exited 1 because the indicated assertion failed, not because of an unrelated setup error.

| Mutation | Targeted test | Observed result |
| --- | --- | --- |
| Bypass the dark gate | Flag-off orchestration parity | 1 failed |
| Omit `battle.gameMode` from the helper call | Unresolved-flat6 orchestration parity | 1 failed |
| Reintroduce fit-based trimming under overflow | Exact overflow orchestration | 1 failed |
| Remove missing-export own-property guard | Real bare-mock import case | 1 failed with the expected missing-export exception |
| Rank after held/bench exclusion | Six unequal-sector rank-preservation cases | 3 failed, 3 passed |
| Flip default to true | Actual-module dark pin | 1 failed |
| Cache the flag at module import | Repeated call-time flag toggles | 1 failed |

The unequal-sector mutation fails Diversifier, Analyst, and Guardian. The other three archetypes have zero sector-diversity weight, so their passing results are expected. Scoring math remained canonical.

## Independent review and dispositions

The cumulative branch reached the BUILD_RULES §2 review threshold after attaching the requested review. Two independent reviewers used path-distinct archive snapshots with symlinked dependencies. They performed no source or Git writes. The mutating lens ran last in its own tree.

| Finding or suspicion | Disposition | Concrete evidence |
| --- | --- | --- |
| Missing flag export in an older bare Vitest mock throws instead of staying dark | CONFIRMED, FIXED | Both reviewers independently executed the installed Vitest 4.0.17 mock proxy against the helper. Direct access threw. `Object.hasOwn` safely short-circuited. The final real-mock test passes and fails when the guard is removed. |
| Flag state is cached or ranking runs while dark | REFUTED | Gate precedes ranking and diagnostics; successive getter values affect successive calls; caching mutation fails. |
| Unresolved tournament context leaks into tiered selection | REFUTED | Raw battle mode is passed separately from resolved tournament context; deleting it fails the new orchestration case. |
| Overflow assertion still permits fit-based trimming | REFUTED | Independent expected list differs from both unchanged-base output and the fit-trimming mutation. |
| Unequal sectors still hide the sector term | REFUTED | Independent probes and the rank-after-exclusion mutation change the three nonzero-sector-weight archetypes. |
| Warning normalizes away the stored archetype | REFUTED | `ctx` comes directly from `battle.agentContext` at `api/cron/agent-evaluate.js:1061`; warning includes `ctx.archetype` directly. |
| Both new parity cases should fail unchanged base | REFUTED | Both pass the byte-verified base and fail their targeted wiring mutations. |

Reviewer A independently passed 63 tests before the correction, then 53 tests across the two affected suites on a fresh final snapshot. Reviewer B independently passed the original 52 selector/orchestration tests and reproduced Reviewer A's missing-export finding while explicitly attempting to refute it. Reviewer A accepted the correction and its `try/finally` mock cleanup. No remaining finding was reported.

## Final validation

Runtime: Node 24.19.0, Vitest 4.0.17, `TZ=UTC`.

```sh
TZ=UTC node node_modules/vitest/vitest.mjs run api/cron/agent-evaluate api/_utils/archetypeCandidateMenu.test.js api/_utils/archetypeScoringV2.callers.test.js api/_utils/archetypeRegistry.test.js api/_utils/watchlistEquip.test.js api/_utils/archetypeScoring.v2dispatch.test.js src/config/flagPinGuard.test.js --maxWorkers=2
```

Result: 53 test files passed, 1,153 tests passed, 38.74 seconds. This is the scoped regression set, not the full repository suite.

The focused selector, orchestration, pin guard, and unmocked dependency-surface guard also passed: four files, 64 tests. The missing-export regression accounts for the additional test after the initial 1,152-test run.

`node node_modules/vite/bin/vite.js build` passed in 24.73 seconds. It emitted existing CSS/bundle-size warnings. ESLint passed with `eslint.gate.config.js --max-warnings 0` on all eight cumulative changed JavaScript files. `git diff --check` passed. All 11 calibration-fenced files were byte-compared with fetched base and matched.

Evidence logs retained with the downloadable copy of this record: `targeted-final.log`, `regression-final.log`, `build-final.log`, `lint-final.log`, `unchanged-base.log`, `unchanged-base-focused.log`, `mutation-results.json`, and seven `mutation-*.log` files. No preview cron or production behavior is claimed as tested.
