# BACKING-OFFLINE-001

This check runs the existing synthetic Backing walk and preview override suites. It does not connect to Firebase or verify a production deployment.

## First run on Windows

Install and start Docker Desktop. In a clean checkout containing this tester package, run:

```powershell
powershell -ExecutionPolicy Bypass -File tester/run-backing-offline.ps1
```

The command snapshots the committed checkout, builds the image, and runs the two fixed suites with no network, no host credentials, a read-only container, and a three-minute test timeout. It saves `result.json` and `run.log` under `~/FantasyTrades-Test-Evidence/BACKING-OFFLINE-001-<timestamp>/` and prints the folder path. Building the image the first time takes longer than the check itself. Later builds reuse Docker's dependency cache when the lockfile stays the same.

The exit status is 0 for PASS, 1 for FAIL, and 2 for BLOCKED. PASS confirms only the two named suites at the recorded source commit. Docker startup, missing inputs, timeout, and incomplete Vitest summaries produce BLOCKED. Test assertion failures produce FAIL.

## Hermes task text

> Run `powershell -ExecutionPolicy Bypass -File tester/run-backing-offline.ps1` from the clean FantasyTrades checkout. Read the printed `result.json`. Return its mission ID, outcome, source commit, number of passing tests, reason, and evidence folder. If it fails or blocks, include the end of `run.log`. Do not run `scripts/backing-smoke.js`, use Firebase credentials, change application files, or merge a branch.

Start this task manually after the tester branch is available on the Windows checkout. Scheduling and sending results to the shared checklist belong to the next integration slice.
