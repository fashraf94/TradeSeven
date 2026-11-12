# Agent Workspace: readable reports and saved-market comparison

| Area | Verdict |
| --- | --- |
| Founder report | Plain-language decisions, explanations, evidence labels and summary counts |
| Saved-market run | 9 fixed cases. Baseline: 2 eligible. Breakout-only: 0 eligible. Two changed decisions |
| Control | Zero differences with the unchanged baseline policy |
| Production behavior | Evaluator, thresholds, trading routes and app behavior unchanged |
| Validation | 353 targeted tests pass. Vite build passes. Old/new experiment records match |
| Remaining limit | Browser visual inspection unavailable. Market outcomes unmeasured |

## Session and scope

Fetched origin before remote comparisons. Fresh branch `codex/agent-workspace-readable-reports` starts at merged main `d1dfc371916dfaa7531cb664eb4e990aceda98fb`, initially clean. The founder approved the next task after the first demo review and explicitly deferred local Git housekeeping. This task implements the report improvements and one saved-market comparison. It does not change the founder's Windows working tree.

Seven files comprise this increment, below the mandatory cumulative review threshold. No fenced function is called or edited. No `api/` or `src/` file changes. Existing unmodified `buildDailyEvidence`, `evaluateTfEntry`, and the calendar continue to determine results. VERIFIED: `scripts/experiments/agent-workspace/experiment.mjs:81`, `scripts/experiments/agent-workspace/prepare-pilot.mjs:45` and branch diff.

## What changed

- VERIFIED: `scripts/experiments/agent-workspace/labels.mjs:2` translates stored decisions into Eligible, Not eligible, and Unknown. Reasons, scenario titles, facts and checks receive readable labels. No decision logic lives in this module.
- VERIFIED: `scripts/experiments/agent-workspace/report.mjs:10` renders saved summary counts and case records. It separates the requested date from the completed session and labels adapter refusals as expected sessions. Technical details retain the original identifiers and exact evaluator record. Historical provenance and unresolved volume coverage remain visible.
- VERIFIED: `scripts/experiments/agent-workspace/prepare-pilot.mjs:13` fixes three symbols and three dates before evaluation. Lines 45 onward use the shared calendar, preserve raw fields, clip later rows and take the required completed-bar window. Missing values remain null.
- VERIFIED: `scripts/experiments/agent-workspace/prepare-pilot.mjs:59` checks the selected package files against both manifests. Lines 81 onward record source hashes, original retrieval clocks, input hash, importer hash and source/runtime identity. It executes no archived scripts and has no provider request path.
- VERIFIED: `scripts/experiments/agent-workspace/README.md:45` documents source preparation, local execution, interpretation and reproducibility limits.

## Source and fixed sample

Reused the founder's existing `EODHD-PILOT-001-real-data-review.zip`. Only the package manifests and three saved daily slices were read for preparation. No market-data request was made. Provider records and generated packets stay outside tracked source files.

The package supplies 207 daily rows per selected symbol. The importer uses 55 completed rows per case. The fixed sample is AAPL.US, MSFT.US and NVDA.US at noon EDT on October 28, 29 and 30, 2026. The corresponding completed sessions are October 27, 28 and 29. These are daily snapshots at specified evaluation clocks, not intraday entry tests.

Source retrieval occurred on November 3. Every case is `later_reconstruction`. Internal SHA-256 agreement does not independently authenticate the provider. Historical revisions and decision-time availability remain unverified. The earlier pilot leaves volume coverage unresolved. Numeric checks use the preserved daily feed fields without claiming consolidated volume. These adjacent windows overlap and are not nine independent market observations.

## Observed results

| Symbol | Requested date at noon EDT | Completed session | Baseline | Breakout-only | Shared evaluator |
| --- | --- | --- | --- | --- | --- |
| AAPL.US | 2026-10-28 | 2026-10-27 | Not eligible | Not eligible | No qualifying entry pattern |
| AAPL.US | 2026-10-29 | 2026-10-28 | Not eligible | Not eligible | No qualifying entry pattern |
| AAPL.US | 2026-10-30 | 2026-10-29 | Not eligible | Not eligible | No qualifying entry pattern |
| MSFT.US | 2026-10-28 | 2026-10-27 | Eligible | Not eligible | Qualifying pullback |
| MSFT.US | 2026-10-29 | 2026-10-28 | Eligible | Not eligible | Qualifying pullback |
| MSFT.US | 2026-10-30 | 2026-10-29 | Not eligible | Not eligible | Required uptrend absent |
| NVDA.US | 2026-10-28 | 2026-10-27 | Not eligible | Not eligible | Required uptrend absent |
| NVDA.US | 2026-10-29 | 2026-10-28 | Not eligible | Not eligible | Required uptrend absent |
| NVDA.US | 2026-10-30 | 2026-10-29 | Not eligible | Not eligible | Required uptrend absent |

Baseline: 2 eligible, 7 not eligible, 0 unknown. Candidate: 0 eligible, 9 not eligible, 0 unknown. Both changed decisions are MSFT pullbacks excluded by the breakout restriction. The unchanged control has zero differences. The synthetic demo retains its prior 6-case summary and two changes, including the missing-volume unknown case.

This verifies the intended rule distinction on saved market inputs. It does not rank strategies, observe later returns, choose a holding period, validate a knowledge base, or test model reasoning. Training eligibility remains unreviewed.

## Validation and limits

- 353 tests passed across workspace (18), pilot preparation (4), entry evaluator (182), holding evaluator (45) and daily adapter (104). The initial importer test used an incorrect calendar export. It was corrected to `getPreviousSessionDate`; the final suite passed.
- HTML checks verify friendly decisions against stored machine decisions, exact technical-record preservation, source text escaping, no scripts/remote assets, missing-history explanations and requested/completed date separation. VERIFIED: `scripts/experiments/agent-workspace/workspace.test.js:124`.
- Import checks cover date selection, future-row exclusion, raw/adjusted separation, null preservation, malformed retrieval clocks, duplicate dates, source substitution, both manifest checks and input hashes. Fetch is blocked during import/run tests. This is a dependency test, not OS-level network monitoring. VERIFIED: `scripts/experiments/agent-workspace/prepare-pilot.test.js:40`.
- Compared complete `createExperiment` records from the previous implementation and this branch using identical input, policy, clock and provenance. Both the synthetic and saved-market packets match exactly for breakout-only and unchanged-control policies.
- `npm run build` passed with 4,144 modules. Existing CSS syntax, mixed static/dynamic import and large-chunk warnings remain outside this task. No application files changed.
- Browser visual QA was not completed. No browser executable was present. The Playwright headless-browser download returned a truncated archive. DOM/content checks passed, but they do not establish desktop/mobile visual correctness.
- Targeted checks ran on Node v24.22.1 in this environment. The founder's Windows Node 22.20.0 execution is not asserted. A saved run replay requires its recorded Node version and source digest. A fresh local run generates its own provenance.

The review package includes ready-to-open HTML, saved inputs and complete run records. Open the reports manually. The runner starts no server or browser helper. No new model requests, market requests, database writes, trades or game changes occur in these experiments.
