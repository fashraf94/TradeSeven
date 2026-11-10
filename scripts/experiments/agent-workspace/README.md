# Agent Workspace, offline slice 1

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
npx vitest run scripts/experiments/agent-workspace/workspace.test.js api/_utils/setupEvaluator/tfSetupV1.entry.test.js api/_utils/setupEvaluator/tfSetupV1.holding.test.js api/_utils/setupEvaluator/dailyBarsAdapter.test.js
```

Tests cover known outcomes, unknown evidence, a pre-close clock, missing sessions, unchanged control, input ownership, fingerprint changes, tampering, schema refusal, HTML escaping, displayed-record agreement, unique local writes, and replay. The network check blocks global fetch during the local-run test. It is not an OS-level network monitor. Real imports provide the Node dependency-surface guard. No production handlers or execution functions are called.

## Following slices

Add a founder-authorized app viewer only after defining server-side ownership and experiment storage. Keep run records separate from equipped builds, active battles, and production mandates.

For longitudinal observation, attach an immutable original idea and source-decision reference, then append timestamped observations and separately versioned thesis revisions. Preserve what the agent knew at the time. Evaluate original game decisions under their actual game constraints. A later rally does not rewrite an earlier game result.

Assess Mandate's pure portfolio calculations and risk metrics before introducing parallel paper books. Do not turn on its current consumer rollout or bypass its one-active-book invariant.

For a future trained FantasyTrades model, keep input evidence separate from later outcome labels. A timestamped research conclusion, candidate set, chosen action, constraints, policy version, and independently observed outcome form a reviewable example. A copied rationale or a winning game alone does not establish a good training target. Knowledge-base retrieval and changing trained model weights are separate mechanisms. First establish evaluation quality and data eligibility, then assess a narrowly scoped ranker or evaluator.
