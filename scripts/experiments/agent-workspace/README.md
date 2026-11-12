# Agent Workspace, offline comparisons

Run a saved Trend Follower experiment and open its results locally. This is the first founder workspace increment. It does not add an app route, activate Forge, run Mandate, change live agent behavior, call a model, or write to Firestore.

The user approved implementation after the November 9 source audit at `ba22a52fd47da622e8afdd158dcdcb33ba950c49`. Mandate remains an unfinished reuse candidate for later longitudinal observation, not a new consumer game in this slice.

## Run

From the repository root, with the locked dependencies installed:

```sh
node scripts/experiments/agent-workspace/run.mjs --demo
```

The command prints the paths of `report.html` and `run.json`. Open the HTML manually. It is self-contained, has no JavaScript or external resources, and needs no server or sign-in. The tool never opens a browser or launches PowerShell. The default output lives under git-ignored `scripts/output/agent-workspace/`. Each invocation gets a new directory and leaves earlier outputs intact.

Run the unchanged comparison as a control:

```sh
node scripts/experiments/agent-workspace/run.mjs --demo --candidate baseline-control-v1
```

Replay a saved run with the same source files, installed lockfile dependencies, and Node version:

```sh
node scripts/experiments/agent-workspace/run.mjs --verify PATH_TO_RUN_JSON
```

Use `--out DIRECTORY` to choose a different output parent. It is an explicit local write destination. No credentials, environment files, network settings, or cloud storage are needed. Output permissions restrict files on POSIX systems. They are not a substitute for Windows ACLs or application authentication. Keep private source packets in a suitably restricted local folder.

## What the comparison means

Both arms use the same saved evidence, injected evaluation clock, existing daily-bar adapter, and unmodified `evaluateTfEntry` output. No indicator math is copied.

Baseline `tf-entry-admission-v1` admits every valid entry from the existing evaluator. Candidate `breakout-only-v1` adds an experiment-only restriction requiring a satisfied breakout pattern. It does not modify `tf-setup-v1` or claim to be a new approved archetype definition. A valid pullback with untestable breakout evidence becomes unknown in the candidate, not a fabricated rejection based on absent evidence.

The control `baseline-control-v1` duplicates the baseline policy. It should produce zero differences.

The demo reuses six synthetic repository fixtures. Expected results: four baseline admissions, two candidate admissions, and two changed decisions. One changed case is refused by the breakout restriction. The other becomes unknown due to missing breakout volume evidence. These counts verify behavior, not market performance.

The results page shows the shared evaluator verdict separately from each arm's experiment admission. All displayed decisions and checks come directly from the saved run record. Outcomes remain `not_observed`. No return, alpha, win-rate, or improvement score is invented.

The founder view uses **Eligible**, **Not eligible**, and **Unknown**, with a sentence explaining each decision. These translate the stored `admitted`, `refused`, and `unknown` values without changing them. Summary counts, friendly fact/check names, the requested date, and the completed session are visible. Original identifiers and full evaluator records remain under technical details. A false check describes a condition, not a software failure. Different patterns require different conditions.

## Saved real-market pilot

The second increment reuses `EODHD-PILOT-001-real-data-review.zip`, already downloaded for the earlier research pilot. It makes no new provider requests. The fixed sample is AAPL.US, MSFT.US, and NVDA.US at noon EDT on October 28, 29, and 30, 2026. The calendar resolves the last completed daily sessions to October 27, 28, and 29. This is daily evidence available at those noon checkpoints, not an intraday strategy or a holding-period comparison.

Extract the existing ZIP manually into a private directory. The importer reads only `PACKAGE-MANIFEST.json`, `inputs/slice-manifest.json`, and the three named `inputs/slices/*.json` files. It does not run any archived scripts. Keep these provider files and generated packets outside tracked source directories.

```sh
node scripts/experiments/agent-workspace/prepare-pilot.mjs --source PATH_TO_EXTRACTED_PACKAGE --out scripts/output/agent-workspace/inputs
node scripts/experiments/agent-workspace/run.mjs --input PATH_PRINTED_BY_PREPARATION
node scripts/experiments/agent-workspace/run.mjs --input PATH_PRINTED_BY_PREPARATION --candidate baseline-control-v1
```

Replace each uppercase placeholder with its local path. Quote paths containing spaces. These commands work in PowerShell and a POSIX shell. The preparation command prints a unique `input.json` path and an `input-manifest.json` sidecar. The runner prints the HTML report path to open manually.

Preparation checks the selected file sizes and SHA-256 hashes against both saved manifests. It preserves raw close and volume, retains adjusted close separately for the adapter's split heuristic, rejects duplicate daily dates, clips future/incomplete bars, and keeps at most the required 55 completed bars per case. Missing values remain null. The production adapter then checks the selected windows and retains unknown results when evidence fails. The importer uses a fixed sample chosen before evaluation, with no selection by verdict.

The sidecar records source file hashes, original response hashes reported by the package, original retrieval timestamps, the exact input hash, importer hash, runtime/source identity, and field mapping. Hash agreement proves package consistency, not independent provider authenticity. The input carries retrieval time normalized to milliseconds. The sidecar retains its original precision.

These histories were retrieved on November 3, after the October evaluation dates. Every case stays `later_reconstruction`. Point-in-time availability and later revisions remain unverified. Volume coverage is unresolved in the earlier pilot, so the report preserves the feed's daily values without claiming consolidated volume. The run measures rule behavior over these saved fields, not market performance.

The first fixed run produced nine cases: baseline 2 eligible, 7 not eligible, 0 unknown. Breakout-only: 0 eligible, 9 not eligible, 0 unknown. The two changes are MSFT pullbacks at the October 28 and 29 noon checkpoints, using completed sessions October 27 and 28. The unchanged control produced zero differences. This small, overlapping sample does not establish relative strategy quality or nine independent market observations.

## Saved input format

```json
{
  "schemaVersion": "ft.agent-workspace-input.v1",
  "title": "My saved daily evidence",
  "cases": [{
    "id": "case-001",
    "symbol": "MSFT",
    "asOf": "2026-10-09",
    "observedAt": "2026-10-09T21:00:00.000Z",
    "recordedAt": "2026-11-09T12:00:00.000Z",
    "evidenceKind": "later_reconstruction",
    "source": "My saved provider export",
    "rows": []
  }]
}
```

This deliberately empty example produces an unknown result. Supply newest-first daily rows containing `date`, `open`, `high`, `low`, `rawClose`, `volume`, and optionally `adjustedClose`. Numeric inputs are finite numbers or null. Raw close must not be substituted with adjusted close. The production adapter validates session continuity, sufficient history, raw-price availability, and its existing adjustment heuristic. It currently requires 55 completed bars for this evaluator.

`observedAt` supplies the clock used to select a completed session. `recordedAt` states when the packet was captured. A later downloaded historical series stays `later_reconstruction`, even if its evaluation clock is backdated. This runner does not verify decision-time availability and therefore rejects `contemporaneous` as a label. `synthetic` is only for artificial scenarios. Classification supplied by the operator is a claim, not proof of provenance.

```sh
node scripts/experiments/agent-workspace/run.mjs --input packet.json
```

Limits: 50 cases, 260 bars per case, 5 MiB input file. Unknown fields are rejected. The tool saves the full validated packet, so do not put secrets or personal text in titles or source descriptions.

## Record and reproduction contract

`run.json` includes schema and workflow versions, local owner scope, effective policies, the evaluator's version/hash/semantics, saved inputs, per-case input hashes, full evaluator records, admission decisions, summary counts, and usage counts. Its source manifest hashes local static imports transitively, the theme CSS, and `package-lock.json`. It records Git HEAD, working-tree dirtiness, and Node version.

The fingerprint identifies the effective input/configuration/source combination. It excludes creation time so repeated runs share an identity. Unique output folders preserve each invocation. The record hash covers the complete run. Verification reconstructs the results and checks all saved fields. It refuses a changed source digest or Node version. These checks establish local reproducibility. They do not authenticate provider data or independently verify the installed package bytes.

The schema marks training use `unreviewed`. No training export exists. Model, knowledge snapshot, holding period, thesis review date, and game expiry remain null because this slice does not execute them. Unsupported knobs fail instead of silently doing nothing.

## Tests

```sh
npx vitest run scripts/experiments/agent-workspace/workspace.test.js scripts/experiments/agent-workspace/prepare-pilot.test.js api/_utils/setupEvaluator/tfSetupV1.entry.test.js api/_utils/setupEvaluator/tfSetupV1.holding.test.js api/_utils/setupEvaluator/dailyBarsAdapter.test.js
```

Tests cover known outcomes, unknown evidence, a pre-close clock, missing sessions, unchanged control, input ownership, fingerprint changes, tampering, schema refusal, HTML escaping, displayed-record agreement, unique local writes, and replay. The network check blocks global fetch during the local-run test. It is not an OS-level network monitor. Real imports provide the Node dependency-surface guard. No production handlers or execution functions are called.

Preparation tests also cover fixed sample dates, future-bar exclusion, raw/adjusted field separation, missing-value preservation, source substitution, duplicate dates, package and slice hash mismatches, output hashes, and zero fetch calls. Report tests preserve machine records while checking friendly decisions, explanations, and requested/completed date separation.

## Following slices

Add a founder-authorized app viewer only after defining server-side ownership and experiment storage. Keep run records separate from equipped builds, active battles, and production mandates.

For longitudinal observation, attach an immutable original idea and source-decision reference, then append timestamped observations and separately versioned thesis revisions. Preserve what the agent knew at the time. Evaluate original game decisions under their actual game constraints. A later rally does not rewrite an earlier game result.

Assess Mandate's pure portfolio calculations and risk metrics before introducing parallel paper books. Do not turn on its current consumer rollout or bypass its one-active-book invariant.

For a future trained FantasyTrades model, keep input evidence separate from later outcome labels. A timestamped research conclusion, candidate set, chosen action, constraints, policy version, and independently observed outcome form a reviewable example. A copied rationale or a winning game alone does not establish a good training target. Knowledge-base retrieval and changing trained model weights are separate mechanisms. First establish evaluation quality and data eligibility, then assess a narrowly scoped ranker or evaluator.
