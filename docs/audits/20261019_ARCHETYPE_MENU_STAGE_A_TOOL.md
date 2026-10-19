# Archetype menu Stage A: collector, offline comparison, and runbook

| Question | Verdict |
|---|---|
| Tool ready? | VERIFIED: local capture/replay tests and relevant regression guards pass. |
| Live collection started? | No. Firebase credentials are absent in this session; no production read was attempted. |
| Real menu results available? | No. Tests use artificial stocks. They do not establish archetype differentiation in production. |
| Production behavior changed? | VERIFIED: no existing production file changed; both real flags remain false. |
| Activation recommended? | Not assessed. Read the first six live menus, then complete the observation window. |

## Session and scope

Fetched origin before comparing remote state. Starting branch: `codex/baggerbomb-menu-dry-run`; starting HEAD: `a59e381f677ceb02bf8076f6fa466c772d216e4d`; starting tree clean. This is a new branch from the merged PR #982, separate from the completed refresh task. The founder authorized beginning Stage A after the read-only plan; no production writes or activation were authorized or performed.

Scope: the review's Stage A only (`docs/audits/BAGGERBOMB_ARCHETYPE_REFRESH_REVIEW_20261018.md:145`). Five new audit-tool files and this report; no calibration, cockpit, model, timing, or live cron changes.

## What the tool does

**VERIFIED — capture.** `scripts/experiments/archetype-menu-dry-run/capture.mjs:82` exposes only reads: `getAll` for the complete rankings and market-context documents, then a projected `status == active` battle query. Projection includes portfolio/bench, equipped names, archetype, watchlist, opponent holdings, expiry, mode, and the two refresh stamps. Owner ids, chat, rules and the rest of agent context are not requested. Explicit non-tiered modes are excluded at `capture.mjs:133`.

**VERIFIED — consistency and preservation.** `capture.mjs:115` brackets the battle query with two feed reads and retries on either feed's version change, up to three attempts. Source read/update timestamps and capture start/end times are retained. This is a stable-feed observation window, not an atomic snapshot of every document. `capture.mjs:142` stores checksummed, exclusive-create files keyed to the rankings version; later polls cannot replace the original book for that version. Malformed or corrupt files stop processing rather than being silently skipped. A machine crash during a file write might leave a corrupt file; preserve it for inspection and repair collection explicitly.

**VERIFIED — exact new selector.** `scripts/experiments/archetype-menu-dry-run/comparison.mjs:100` calls the merged `buildArchetypeCandidateMenu`. `replay.test.js:12` partially mocks only `ARCHETYPE_REFRESH_MENU_ENABLED` inside an isolated Vitest process. All other flags, including V2, retain their real values. `replay.test.js:36` checks that both real defaults are false. `run.mjs:65` selects only that worker. No flags file is edited, and a separate ordinary import still returns the dark result (`capture.test.js:123`). Stage A's real-dark precondition and these tests must be reconciled or retired in the later activation PR.

**VERIFIED — baseline.** `comparison.mjs:25` transcribes the live legacy tiered selection statements from `api/cron/agent-evaluate.js:1510`: shared-fit ordering, stable ties, held/bench exclusions, and the existing equipped-union helper. It intentionally preserves the legacy duplicate-equipped behavior. The new algorithm and scoring math are not copied.

**VERIFIED — comparisons.** `comparison.mjs:129` runs all six archetypes on one fixed control book and each captured eligible battle on its own book. The default control has empty held/bench/equipped/old-menu arrays, removing book differences from selection comparisons. A supplied control is hashed and stays fixed for the entire analysis. Battle identifiers are hashed in comparison output; raw snapshots retain ids locally. Unknown archetypes report the real legacy fallback. Expired, unsupported-mode, and watchlist-less books are reported as skipped.

**VERIFIED — fenced exports called, none edited.** The tool calls `computeArchetypeRankings` from `archetypeScoring.js`, plus `flattenPortfolioServer` and `flattenBenchServer` from `agentScoring.js`. It reads identities/weights through `archetypeRegistry`; there is no new direct legacy-table import. All eleven fenced files are byte-identical to the starting merge. No `api/`, `src/`, workflow, dependency, or Vercel configuration file changes.

## Outputs and interpretation

`analyze` produces a concise Markdown report and complete JSON. Markdown shows observed coverage, paired control-book medians, the latest six legacy/proposed menus, and all 15 latest archetype-pair overlaps. JSON retains every observation and each battle's comparison, per-name inputs, score consistency, and min/median/max distributions.

**VERIFIED — metrics** (`comparison.mjs:54`, `comparison.mjs:129`):

| Metric | Meaning / limit |
|---|---|
| Legacy and cross-archetype overlap | Unique common names, union, Jaccard and share of the left menu; duplicates reported separately. |
| Identity diagnostics | Analyst fundamentals below 40 or missing; guardian ATR percentile above .75; speculator ATR percentile below .5. These are the review's partial numeric diagnostics, not a complete implementation of every admission rule. |
| Contrarian quality | Raw fundamentals/composite evidence, explicitly marked for manual review. Its identity requires a fundamental recovery reason, but no numerical weak-quality cutoff was specified; no cutoff invented. |
| Fit given up | Legacy mean minus proposed mean on available fit values; missing-fit names and off-universe names remain explicit. |
| Sector mix | Counts, distinct known sectors, top-sector share and Technology share. Unknown/off-universe names stay in an explicit Unknown bucket. |
| Missing input scored as 50 | Share of covered names missing at least one positively weighted numeric input, derived from registry weights; off-universe coverage reported separately. |
| Churn | Added/removed names between observed snapshots, with elapsed gap and book-change marker. Not a claim every intervening producer run was captured. Overnight transitions included. A book absent from an intervening observation starts a new sequence. |
| Additional quote requests | Symbols not in the initial held/bench/old-menu/opponent/macro set, assuming all initial requests succeed. Both arms use the same observed old menu. A one-refresh lower-bound estimate, not observed API calls, billing, or long-run traffic after activation. |
| Battle union | Unique candidate names across all included actual books, separately for each selector. |
| V1 consistency | Canonical full-universe recomputation versus each stock's persisted `arch_scores`; missing values and mismatches separated. |

**VERIFIED — boundaries.** The live cron first fetches held, bench, old-menu, opponent and macro symbols (`api/cron/agent-evaluate.js:1094`). Its refresh is conditional on new rankings/new trading day and a watchlist (`agent-evaluate.js:1482`). The audit compares hypothetical refreshes at capture instants; it does not reconstruct which cron tick rebuilt, quote failures, model choices, trades, timing gates, or cockpit calls. Those are later Stage B observations.

**VERIFIED — coverage details requiring manual review.** The review describes a premarket observation plus seven intraday points. The actual schedule lists two premarket UTC slots, `10:30` and `11:30`, plus seven intraday slots, `14:00` through `20:00` (`vercel.json:149`). No ET guard was found in the current producer handler (`api/cron/compute-index-intelligence.js:701`). This tool preserves every observed version and reports mode counts rather than asserting an exact eight-point day. Schedule behavior remains a separate task.

**VERIFIED — regime terminology.** The stored regime is classified from SPY price and its 50/200-day averages (`api/_utils/indexIntelligence.js:29`), not daily return. The report retains raw bull/correction/bear/recovery labels and separately records observed SPY daily-change signs. A bull regime with a negative daily return is possible. Before declaring the window complete, agree which regime coverage satisfies the review's “up day/down day” condition; the tool does not silently substitute daily return for regime.

## First live run (PowerShell)

Use your checkout of `codex/baggerbomb-menu-dry-run` with normal development dependencies installed. Run from the repo root. The commands assume your existing `.env.local` contains Firebase Admin credentials. Use `--env-file` with its actual path if different; omit it if credentials are already in process variables. Do not paste keys into chat or commit the export folder.

```powershell
node scripts/experiments/archetype-menu-dry-run/run.mjs status --env-file .env.local

$menuProject = "YOUR_FIREBASE_PROJECT_ID"
$menuRun = "$env:USERPROFILE\baggerbomb-menu-dry-run"

node scripts/experiments/archetype-menu-dry-run/run.mjs capture --project $menuProject --env-file .env.local --out $menuRun
node scripts/experiments/archetype-menu-dry-run/run.mjs analyze --input $menuRun --out $menuRun
```

Use the project id printed by `status`. Capture refuses a project id that differs from the credential. Supported configurations: `FIREBASE_ADMIN_CREDENTIALS` containing service-account JSON; the split `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON file. Existing process variables override env-file entries. No automatic search of other checkouts or credential stores. **ASSUMED until a live read succeeds:** the supplied account has Firestore read permission. The script is read-only by construction; it does not prove the account's IAM role is read-only.

Open the printed `comparison-*.md` first. Share the generated Markdown and JSON for the menu review; keep raw captures private unless specifically needed. These outputs contain stock/book information, but no service-account values. If the first capture is stale, it remains informative and is labelled stale; it does not count as a fresh trading-day observation.

## Collect the observation window

After the initial six-menu read, run this on a machine that stays on. Begin before the first scheduled premarket slot and keep it running through completion of the final intraday rebuild. A 12-hour run starting around 10:15 UTC covers the currently listed slots with slack. Repeat on market days, using the same output folder and control book.

```powershell
node scripts/experiments/archetype-menu-dry-run/run.mjs watch --project $menuProject --env-file .env.local --out $menuRun --hours 12 --poll-seconds 60
```

This is a foreground process, not an installed scheduler or a hosted background service. Sleep, terminal closure, an expired duration, or a read failure stops collection. Restart the same command to resume; existing snapshots remain intact. The watcher reads the two feed documents each poll and queries active battle books only when it sees an unpreserved rankings version. Standard Firestore read charges apply; no model credits or quote-provider calls are used. Polling cannot recover versions overwritten while the process was offline or between polls.

Re-run `analyze` on the folder after each day; reports use new names. For a nonempty control, save the following outside the repo, fill in symbols once, and add `--control PATH_TO_CONTROL_JSON` to every analysis:

```json
{"heldSymbols":[],"benchSymbols":[],"equippedTickers":[],"hotBench":[]}
```

Collect at least five market days and extend if the agreed regime coverage is absent. Counts alone do not certify market days, missing schedule slots, contemporaneous capture, or feed pairing. Check capture lag, expiry/stale markers, mode counts, source timestamps, score parity, and gaps before interpreting distributions. No automatic activation threshold is encoded.

## Validation and remaining work

**VERIFIED:** `TZ=UTC`, Node `v24.19.0`, Vitest `4.0.17`: 9 files / 124 tests passed, zero failures. Includes 20 new tests and the real CLI subprocess, canonical selector, orchestration suite, refresh guard, registry/import-boundary guard, caller census, flag-pin guard, and the source-text tick-stamps mock guard that caught the prior PR's issue.

```text
TZ=UTC npx vitest run scripts/experiments/archetype-menu-dry-run/capture.test.js scripts/experiments/archetype-menu-dry-run/replay.test.js src/config/tickStampsFlags.test.js src/config/flagPinGuard.test.js api/_utils/archetypeCandidateMenu.test.js api/_utils/archetypeRegistry.test.js api/_utils/archetypeScoringV2.callers.test.js api/cron/agent-evaluate.archetypeMenu.test.js api/cron/agent-evaluate.shouldRebuildHotBench.test.js
```

The full application suite and Vite build were not rerun: the change adds only offline audit tooling/docs and remains below the mandatory cumulative-review threshold. No independent subagent or Opus review is claimed. CI's Node 20 runtime was not available for local execution. Synthetic tests prove wiring and metric behavior, not live data quality or selection quality.

Remaining steps: run the first live capture in the configured environment, review its six menus, preserve the observation window, then decide whether selection is sufficiently distinct or which specific scoring issue needs a separate fix. Only after that review should an activation PR be considered. Both flags remain dark. Cockpit Build 2 remains a separate workstream.
