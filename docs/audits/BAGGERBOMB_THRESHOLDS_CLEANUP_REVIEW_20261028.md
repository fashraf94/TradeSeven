# BaggerBomb measured thresholds — cleanup after the broad release: review record (Oct 28, 2026)

Review of the cumulative branch diff of `claude/baggerbomb-thresholds-cleanup-fbb502` against `origin/main` `24495eba` (BUILD_RULES §2: 49 files and 1,734 changed lines at code-final, 28 of them non-test files and 456 lines; above the 10-file / 1,500-line threshold). Build report: `docs/audits/BAGGERBOMB_THRESHOLDS_CLEANUP_BUILD_REPORT_20261028.md`.

## Method

- **Reviewed commit:** `895dc293` (code complete for C1–C6). Findings were fixed on top of it; the code-final commit is named in the build report.
- **Lenses (3, in parallel, each on its own snapshot tree):** `git archive` extraction under the session scratchpad with `node_modules` junctioned to the parent install; read-only on git and on the builder's tree; mutants run inside the snapshot and reverted.
  - **CL1:** C1, C2, C6 (the two crons, the shared module, the run record, the stale prose).
  - **CL2:** C3 and C4 (the cockpit rule, the watchlist save, the editor).
  - **CL3:** C5 and cross-cutting (client status, import boundary, scope, display agreement).
- **Refuting verifier (CLV):** one agent on a fourth snapshot, handed all 23 findings and told to refute each with a repro; it ran probes against the real functions, read the feature-flag values itself, and answered two direct questions (the fenced executor, the stale editor line).
- **Mutation:** the builder mutation-checked every ruling's rows (33 mutants, each restored from a commit; one survived at first and was closed) and every row added by the review round (9 mutants, all killed); each lens ran its own mutants. **No separate mutation-verifier agent was run after the fixes**; the review-round rows are covered by the builder's 9 mutants only.
- **Id prefixes:** `CL1-` / `CL2-` / `CL3-` for the lenses, `CLV-` for the verifier. None was in use in the repo.
- **Environment caveats the reviewers hit:** their snapshots were CRLF on disk (not LF as briefed), so a handful of rows that read file text or `firestore.rules` failed there for platform reasons (`firestore.rules` exact-string row in `agent-evaluate.evalRun.test.js`, `tickCoherence`, `tickStamps.pins`, `decisionRecord`, `tapeWiring`); none is caused by the diff. Linux is the record.

## Result

23 lens findings. **19 CONFIRMED, 2 CONFIRMED-AS-QUESTION, 2 REFUTED.** No BLOCKER. No fenced file is in the diff (checked by all three lenses and again by the builder). The verifier added five items the lenses missed (below).

| Id | Sev. (verified) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| CL1-1 | MAJOR | `AgentBattleScreen.jsx` `enrichHeldPosition` mirrors the server's day-1 gate from `activatedAt`; after C2 the battle card shows a phantom Bust/Crash (−50 instead of −20) on a next-session battle's first day. Also bites the crypto slot of every measured BR-2 battle | CONFIRMED (probe: −50, badges bust+crash) | **Fixed** (`dea2ac6b`): reads `firstTradingDayOf(stockBattle)`; 3 rows |
| CL1-2 | MAJOR, **fenced** | `agentSwapExecution.js:248-258` Guard 3 keys the activation day on `activatedAt`: on a next-session battle's first day a swap locks 80 points where the card shows 125 (bagger + doubleBagger). `filmTape/tapeAssemble.js` `ghostBaseline` (:399-413) returns no baseline for the same case | CONFIRMED (probe through the real executor) | **Reported, not changed** (fence; needs a founder ruling). Not a merge blocker |
| CL1-3 | MINOR | the new prose in `leagueTournament.js` was false (history clause; early-close days end 1:00 PM; the one caller passes the market's next close, not the battle's end date) | CONFIRMED | **Fixed** (`c9e86403`); the caller (`CommandDashboard.jsx:250`) is a reported follow-up |
| CL1-4 | MEDIUM (up from MINOR) | no row proves C2 for a measured battle's crypto slot | CONFIRMED (mutant survived) | **Fixed** (`3662747f`): a measured next-session BTC row; mutant now killed |
| CL1-5 | NIT | `etDateOf(1e20)` throws RangeError; `'2026-13-45'` holds a battle back | CONFIRMED (nit; unreachable) | **Fixed** the throw (`c9e86403`); the malformed date is old F3 behaviour, unreachable, left |
| CL1-6 | NIT (rollout) | a battle whose creation night already ran under the old cron has `day1` recorded, so its real first night logs `already_recorded` | CONFIRMED | **None exists**: the health read found no tiered battle created since Oct 24 and none active |
| CL2-1 | MINOR/MEDIUM (down from MAJOR) | the pre-commit capture is blind to `forkUsable`: a fork over KRE is stamped `expected`, the mint removes it, the wire reads `failed` | CONFIRMED (repro through `processAgentBattle`) | **Fixed** (`ee7642a3`): one `forkUsableFor` at both seams; 2 tick rows |
| CL2-2 | MINOR | the editor's `saveError` wiring is unpinned | CONFIRMED (mutant survived) | **Fixed**: source tripwire row |
| CL2-3 | NIT | a retired refusal that arrives after the ticker was removed paints a stale line with no Retry | CONFIRMED (jsdom repro with the real hook) | **Fixed** (`dea2ac6b`): a refusal with an empty queue is dropped (new `stale_refusal` event); 2 rows |
| CL2-4 | NIT | an idempotent replay never tells the player what was dropped | CONFIRMED in code, harmless in practice | **Accepted**: the winning request's response carries the names; the chat never retries |
| CL2-5 | NIT | the cooldown row cannot tell the check's instant from the mint's | CONFIRMED (mutant survived) | **Fixed**: row with a cooldown ending between them |
| CL2-6 | NIT | the idempotent-replay row hit the pre-tx shortcut, not the in-tx branch | CONFIRMED | **Fixed**: in-tx row (`inTxSessionOverride`), and the transaction body now starts with `droppedRetired = []` so a Firestore retry cannot carry a prior attempt's names. The reset is not distinguishable by the test fake (it never retries) |
| CL2-7 | NIT (ruling question) | `dropped.length > 0 && tickers.length === 0` is the narrow reading of "an empty list after dropping is refused" | CONFIRMED-AS-QUESTION; the narrow reading is the better-supported one | **Pinned** with a row (a dialogue that proposed nothing still saves); raised to Flash in the report |
| CL2-8 | NIT | (a) stale header comment in `call-response.js`; (b) the all-retired 400 is not shown by the chat; (c) the new toast showed in the error colour | CONFIRMED | (a) **fixed**; (c) **fixed** (`'info'`); (b) as ruled (an all-retired dialogue takes the refusal path) |
| CL3-1 | MINOR (ruling question) | `ManageStation.jsx:102` says "Battle live" unconditionally; with `COMMAND_CENTER_SYNC_ENABLED` on, the Desk above it says "Starts …" | CONFIRMED-AS-QUESTION (sync is **off** today, so the card is untouched) | **Reported**: outside the two surfaces C5 names; a question for Flash |
| CL3-2 | NIT | the optimistic just-deployed entry has no `timing`, so it reads LIVE until the next poll (about 120 s) | CONFIRMED | **Reported**: the hub and sync that read it are dark; needs the deploy response to carry the first day |
| CL3-3 | NIT | the hub's section tag counts waiting games as "live" | CONFIRMED (pre-existing design for a same-day pre-open game; hub dark) | **Reported** (a prior S3 decision, "on its tag and in its name") |
| CL3-4 | NIT | the Shadow status line says "waiting for the open" while the row says "Starts …" | CONFIRMED | **Reported** (pinned by `shadowStatus.test.js:106-108`; hub dark) |
| CL3-5 | NIT (down from MINOR) | `postureStarts(null)` reads "First check at 9:30 AM ET" for a first day outside the calendar | **REFUTED for production**: `tieredFullDayTarget` returns `calendar_missing` from 2027-12-31, so no battle can carry such a day | none |
| CL3-6 | NIT (test) | the "no clock" row cannot fail if `derivePhase` defaulted to `Date.now()` | CONFIRMED (mutant survived) | **Fixed**: fake clock set before the first day |
| CL3-7 | NIT | a completed battle with a future first day returns `startsAtEt` while its phase is POST_CLOSE | CONFIRMED | **Fixed**: null when completed |
| CL3-8 | NIT | the end-time day applies to every live row | **REFUTED as a defect** (the ruling says "names the day when it isn't today") | row now asserts the whole detail line |
| CL3-9 | NIT (test) | tautological rows (count; strip line); the two "Starts …" templates were not tied | CONFIRMED | **Fixed**: strip line through `deployDisplay`; one row ties the hub and Desk sentences. The hub's `liveCount`/`waitingCount` arithmetic stays covered by the existing hub tests |

### Items the verifier added (not in any lens report)

1. `AgentBattleScreen.jsx:276-277` is a §9 breach for the crypto slot of every measured BR-2 battle too, not only legacy stocks (folded into CL1-1).
2. `agent-evaluate.evalRun.test.js` "exactly ONE block" fails on a CRLF checkout: pre-existing on main, platform-only; green on Linux.
3. Stale lint noise in `agent-evaluate.js` / `agent-daily-scores.js` is not in the diff; `lint:gate` passes.
4. A fork or pick chip on a call minted before this deploy is still rendered from its stored options; the answer endpoint refuses an equipped-only name with `pick_not_on_bench`. Transitional (a call lives one check).
5. `voice-layer-cache.js:394-399` computes proximity from the previous close regardless of activation day: pre-existing, and it will disagree with the C2 baseline on a next-session battle's first day. **Reported.**

### Surviving mutants and their disposition

- Real, all closed by a new row: C2 restricted to non-measured (CL1-4); `derivePhase` defaulting to `Date.now()` (CL3-6); fork judged at the mint instant (CL2-5); the editor prop dropped (CL2-2); the `!txResult.idempotent` guard removed (CL2-6); refusing on `tickers.length === 0` (CL2-7).
- Equivalent: gate returning `error` instead of `skipped` (the handler buckets any non-`recorded` result as skipped); `firstSessionOpenMs` without its trading-day and finite checks (a non-session already has `openMs: null`); `slot` omitted from `canComeIn` (it falls back to the book row); the `setSaveError(null)` calls in the `noop` and `flush_start` paths (every error path rewrites `saveError`).

### One of the builder's own claims, refuted by the review

The first draft of the C6 comment on `composeEvalRunRecord` said every battle of `battlesTotal` lands in exactly one bucket; CL1 checked it against the loop and it holds only with the stated exceptions (a tick that ends in an error or an early return, such as degraded quotes). The comment already says so.

## Open for the next prompt (carried to the build report)

CL1-2 (fenced executor; Film Room ghost baseline), CL3-1, CL3-2, CL3-3, CL3-4, the `CommandDashboard.jsx:250` caller, `voice-layer-cache.js:394-399`.
