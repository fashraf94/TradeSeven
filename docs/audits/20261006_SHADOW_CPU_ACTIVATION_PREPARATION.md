# Shadow versus CPU quote-integrity activation preparation

Date: October 6, 2026. **Prepared and tested; production activation remains pending.**

| Item | Result |
|---|---|
| Verified current main | `693dc323a9b006c09d660b55c60af7e24add17c0`; includes merged placeholder repair #925 and Cockpit #930/#931 |
| Preparation branch | `codex/shadow-cpu-activation-prep-20261006`, cut fresh from fetched main in a separate worktree |
| Published code commit | `7849746a644ac8c027074cb16f7b3ce438b98a99`; tree-identical to tested local code |
| Candidate flag | `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = true`, with its pins and registry reconciled in the same commit |
| Main flag | Still `false` at the verified main SHA. Main was not edited, merged or deployed |
| Scope | 18 code/test files, 88 insertions and 29 deletions, plus this audit record |
| Full suite, Node 20.20.2 | **18,004 tests: 17,917 passed, 0 failed, 87 skipped** |
| Existing quote-availability screen coverage | 274 passed, 0 failed; its ON/OFF fixture controls remain intact |
| Lint gate / explicit Vite build | Both passed |
| New integration rows | Desktop and phone CPU battle with the real integrity default and Cockpit simultaneously enabled; both passed |
| Mutation checks | 3 behavior-changing variants caught by both new rows; control passed; snapshot restored exactly |
| Mandatory independent review | **Pending.** This preparation is not certified ready for merge |
| Complete production confirmation / R-11 eligibility | **Pending.** Two live API samples pass; deployment identity, deployed client and remaining provider checks are not confirmed |

## Authorization and isolation

The founder asked for help flipping the flag and reported another ChatGPT chat actively testing a game through its browser. This preparation uses a separate repository worktree. The original checkout stays on `main` at `ef80da1` with its project files unchanged; fetching updated its remote-tracking refs. Fetch completed successfully before comparison with `origin/main`.

No existing browser tab was claimed, no login or account was changed, no game action was submitted, and no production flag was changed. Public quote API reads do not alter the beta account or its battle. Branch publication is preparation only; the founder still controls the eventual merge.

## What changed

The tested local code commit is `7de1154c4b4199a3065b2e1f700666f6a06ec793`. Publication through the connected GitHub account creates code commit `7849746a644ac8c027074cb16f7b3ce438b98a99` with the exact same Git tree, `c39b6788fe289597a7d529545850538752fa98e6`. Only commit metadata differs. The ordinary git push could not authenticate; no credential was requested or exposed.

VERIFIED in that tested/published code tree:

- `src/config/featureFlags.js:3020`: the candidate constant is true. Its default prose is updated and the existing R-11 condition and no-override rule are retained. Bytes outside this flag's own block match main exactly.
- `src/config/shadowCpuQuoteIntegrityFlags.test.js:25`: live constant/accessor pins, block export pin, default prose and registry expectation now agree with true. Explicit OFF and excluded-mode behavior checks remain.
- `src/config/flagPinGuard.test.js`: only this flag's two-line dark-by-design entry is removed; the general guard is unchanged.
- `src/screens/AgentBattleScreen.jsx:51` and `:976`: comments describe activation and rollback. **No executable screen code changed.**
- The twelve legacy screen suites listed in activation-readiness report §7 explicitly select the integrity-OFF path. Their assertions, snapshots and golden HTML are unchanged. They continue to guard rollback/legacy behavior; the dedicated integrity suite still tests the new path.
- Two Cockpit suites added after the original readiness report now supply the identity envelope when the real screen requests it. They retain the real integrity accessor. Their existing fixtures remain excluded by their existing document shape, rather than getting stuck pending because a mock omitted required identity evidence.
- `src/screens/AgentBattleScreen.cockpit.jsdom.test.jsx:275`: two new admitted-CPU rows use the shipped integrity accessor. They require a qualified stored-score comparison when browser quotes are incomplete, a Cockpit status read, expected call tiles and the expected Cockpit listeners, on desktop and phone.

No API handler, dependency, CI setting, scorer, entry-price writer, swap writer or scoring formula changed. No fenced file was edited and no new fenced function call was introduced. Existing locked trade points and incoming-position entry/threshold mechanics remain outside this diff.

## Validation evidence

Tests ran with Node **20.20.2**, `CI=true`, `--maxWorkers=2` and `TZ=UTC`. The direct Vitest invocation is equivalent to the repository's CI test script. Chromium was not installed for this run; the 87 skipped rows are enumerated in the JSON result. Neither new row is skipped. No new skip or assertion removal was introduced.

The pristine main snapshot's relevant flag/screen suites passed **592/592** under UTC. The candidate full suite passed **17,917**, failed **0**, and skipped **87**. No full main-suite comparison was performed or claimed.

The first focused runs inherited this container's `Asia/Calcutta` timezone and produced one chat-golden mismatch on both main and candidate: a timestamp rendered `8:32 PM` rather than the golden's `3:02 PM`. Setting the test process to UTC resolved it without changing the golden, application code or assertions. This is recorded rather than hidden as a code repair.

Lint command: Node 20 running `eslint . --config eslint.gate.config.js --max-warnings 0`. Exit 0.

Build command: Node 20 running `vite build`. Exit 0, completed in 31.09 seconds. Existing CSS, dynamic-import and chunk-size warnings remain; no comparison build of current main was run, so warning-count parity is not certified here.

The new integration rows were mutation-checked in a separate snapshot:

| Variant | Result |
|---|---|
| Unmodified control | Both new rows passed |
| Integrity constant false | Both new rows failed |
| Identity envelope omitted | Both new rows failed |
| Cockpit disabled in the fixture | Both new rows failed |

The first mutation harness attempt stopped because its Cockpit replacement matched multiple occurrences. The replacement was narrowed to setup, the checks reran successfully, and both snapshot and candidate bytes were verified restored/unchanged. No mutant was applied to the working tree or committed.

Raw evidence lives in the session's `shadow-cpu-activation-evidence/`: full/focused JSON results, lint/build logs, mutation summary and source, and live API samples. This record also exists outside the repository for handoff.

## Production evidence obtained

Ordinary, unauthenticated reads followed the site's canonical redirect to `www.fantasytrades.io`. No `nocache`, cache flush, TTL change, invalid-symbol probe, outage simulation or warm-up was used. A stock connection timeout was followed by one successful retry of the observed canonical URL.

| Sample | Observed production response |
|---|---|
| AAPL stock endpoint | HTTP 200; `quoteOrigin.version = 1`, `price = provider-close`, `previousClose = provider-previous-close` |
| BTC crypto endpoint | HTTP 200; the same version and origin values |
| AAPL provider time | Unix seconds `1791301860`, or October 6 15:51:00 UTC |
| AAPL server fetch time | `2026-10-06T16:07:11.095Z`; the quoted price was **971.095 seconds, about 16 minutes**, old at that fetch |
| BTC provider time | Unix seconds `1791302640`, or October 6 16:04:00 UTC |

These are **partial production checks**, not founder confirmation of the complete path. The samples support seconds as timestamp units for these two records. They do not settle after-hours/overnight/weekend behavior, which fields use `NA`, crypto high/low window semantics, deployed client preservation or deployment identity.

The observed stock delay belongs in the separate entry-pricing discovery. One sample does not establish the cause of the original screenshots or change this patch's scope.

## Release boundary and next step

The adopted R-11 rule remains in `src/config/featureFlags.js`: activation is **NO EARLIER than the first regular US stock-market open after the founder confirms the complete additive metadata path is live in production**, while the production flag is still false. The earlier activation-readiness report also requires its remaining provider checks before the flip.

Do not interpret this preparation branch or passing tests as that confirmation. No activation PR is being created before the existing eligibility condition is established.

Next steps:

1. Use the browser session with working FantasyTrades access, in a separate read-only tab, to finish the missing deployment/client evidence. Reuse the API samples above. Record the production deployment commit, ID and time; confirm the deployed client preserves origins and carries fallback markers. Record founder confirmation time only when the whole required path is confirmed. Report unavailable evidence as unavailable.
2. Resolve the readiness report's remaining provider questions with authoritative documentation and appropriate live evidence. Keep unsupported claims marked unknown.
3. Obtain one independent, bounded review of this preparation diff. BUILD_RULES §2 requires independent adversarial review because the diff exceeds ten files. Inspection performed here is not a substitute; no CONFIRMED/REFUTED review disposition is claimed. Review the flag/pin reconciliation, legacy fixture intent and new Cockpit/integrity integration. Do not reopen the merged 39-file implementation or deferred hardening work.
4. Once evidence, review and R-11 eligibility are satisfied, create the founder's activation PR from current main, preserving this same-commit pin reconciliation, and run its required checks. The founder merges manually.
5. Coordinate a checkpoint with the ongoing game-test chat before deployment and refresh. Record its current deployed version/flag state so a test does not silently cross releases. Then run the short post-activation browser check.

If complete production confirmation is first recorded during October 6's regular session, the earliest eligible next regular open is **Wednesday October 7 at 09:30 EDT / 08:30 America/Chicago / 13:30 UTC**, subject to the other requirements. Confirmation has not been recorded here and activation is not scheduled.

## Focused handoff for the other browser chat

> We are preparing Shadow-versus-CPU quote-integrity activation for merged PR #925. Keep your active game-test tab and its current session unchanged. Use a separate read-only tab for deployment/pricing verification. Both production API endpoints already returned version-1 quoteOrigin metadata in the attached preparation record, so reuse those samples. Finish the deployed-version and deployed-client checks, including metadata preservation and configured-fallback markers. Record the deployment commit, ID/time and evidence. Mark anything inaccessible or unverified explicitly. Do not change flags, reload the active game, force failures or bypass caches. We need the complete production evidence before founder confirmation and R-11 eligibility; afterward we will coordinate the deployment checkpoint and post-activation browser test.
