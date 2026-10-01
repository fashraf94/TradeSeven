\# Astra — Adversarial Branch Review: Film Room Build A1 (the tape)

\*\*Verdict: DO NOT MERGE.\*\* The existing sold-entry blocker is fixed, but the candle pass does not enforce its write-path boundary. Local reproductions also show lost series history, falsely complete coverage, stale candle output after new checks, and readiness promises that selection cannot fulfill. Both flags are dark; these are source/local-test findings, not claims of production incidents.

| Decision evidence | Result |  
|---|---|  
| Requested branch/tip | \`claude/hopeful-keller-0xgl6p\` at \`e7e527e7b2f475333bcfdeccba18da90eaedae0d\` |  
| Base | \`ef80da13bd0ca7ccfa6ef975808a139412129fa2\` |  
| Most serious finding | F1: a matching document under \`otherRoot/otherOwner/tape/2026-09-24\` receives candle and series writes |  
| New tape tests | \*\*14 files / 278 tests, all passed\*\* |  
| Independent adversarial probes | \*\*20 tests passed\*\*, including positive controls and reproductions of defects; plus one emulator test containing the extra authorization attempts |  
| Mutation checks | \*\*8 killed; 1 survived.\*\* The survivor deletes 209 minutes from a valid early-close session while 70 candle/review tests remain green |  
| Rules | \*\*18 files / 332 tests passed\*\* on cached Firestore emulator v1.20.2; extra adversarial rules test passed |  
| Full suite | 819 files / 16,271 tests: \*\*16,156 passed, 28 failed, 87 skipped\*\* on Windows/Node 22.20.0/UTC. The identical 28 failing test names also fail at the base commit |  
| Lint / build | \`lint:gate\` exit 0; explicit Vite build exit 0, 12.66 s |  
| Changes made by reviewer | None to repository files, branches, commits, rules, flags, or production. Report and evidence delivered outside the repository |

\#\# 1\. Baseline, method, and limits

The attached request supplies this report's September 28 filename. Execution occurred on September 27, 2026, on the user's Windows host. The supplied worktree was clean and detached at the \*\*base\*\*, not the requested review tip. I did not check out or change that worktree. \`git fetch origin claude/hopeful-keller-0xgl6p\` retrieved exactly the requested SHA. Review and local execution used external \`git archive\` snapshots of that tip and, for failure attribution, its base. No comparison claims remote \`main\` freshness.

Scratch root: \`C:/Users/fashr/AppData/Local/Temp/astra-film-tape-a1-e7e527e7\`. The final review snapshot is its \`snapshot/\` directory; mutations ran separately in \`mutant/\`. \*\*All 3,490 tracked snapshot files were hashed against the Git blob manifest: zero mismatches.\*\* The initial archive inherited \`core.autocrlf=true\`, causing CRLF-sensitive assertions and shebang module-load errors. It was replaced with \`git \-c core.autocrlf=false archive\`; only the corrected results above count as final verification.

I read the governing build rules, spec V1.2, prior Astra spec review, and the build report's claim/founder/review sections. Source citations below refer to the supplied tip, not the base worktree. \*\*VERIFIED\*\* means inspected source plus the named local execution where applicable. \*\*Proposed\*\* fixes were not made. Production contents, deployed indexes/rules, provider completeness/latency, and actual cron executions were not inspected.

This review used one reviewer performing several adversarial passes; it does not claim a separate subagent independently refuted these new findings. The build report's earlier multi-agent process and historical scratch-state assertions cannot be independently reconstructed from committed source alone.

Companion \`film-tape-a1-review-evidence.zip\` contains the probe sources, mutation definitions/results, compact test results, census, and reproduction instructions. Probe tests intentionally assert observed behavior: a passing defect reproduction is evidence of the defect, not a product acceptance pass. \`R08\` is retained as a bounded, unpromoted candidate; see §8.

\#\# 2\. Numbered findings and proposed fixes

\#\#\# F1 — Blocker: the candle pass can write outside the authorized tape paths

\*\*VERIFIED.\*\* \`api/\_utils/filmTape/candlePass.js:292-299\` queries every collection named \`tape\`, keeps its returned \`DocumentReference\`, and never verifies \`agentBattles/{id}/tape/{etDate}\`. That reference reaches the series set and tape update at \`api/\_utils/filmTape/candlePass.js:255-264\`, the expiry update at \`api/\_utils/filmTape/candlePass.js:313\`, and the failure transaction at \`api/\_utils/filmTape/candlePass.js:343-353\`.

\*\*Repro R01:\*\* seed an otherwise valid pending tape at \`otherRoot/otherOwner/tape/2026-09-24\`. Run the real candle orchestrator over the recording in-memory Firestore with synthetic bars. It writes that foreign document and its \`series/\*\` children and marks it \`written\`. This directly refutes BA-1 / invariant 5\. The ordinary fixture store contains only sanctioned parents, so its path assertions do not challenge this selection boundary. This demonstrates a conditional reachable path, not the existence of such a document in production.

\*\*Proposed fix:\*\* validate each selected reference's full segment structure and its battle/date identity before any expiry, failure, fetch, or enrichment action. Construct downstream refs from validated identifiers. Add foreign-parent and unexpected-depth positive/negative controls covering all three candle outcomes. Admin SDK bypasses client rules; F1 is not repaired by the rules suite.

\#\#\# F2 — Major: a hole through the close is presented as a complete close replay

\*\*VERIFIED.\*\* \`api/\_utils/filmTape/bars.js:73-79\` legitimately returns the last available completed bar, but does not identify stale/missing minutes. \`api/\_utils/filmTape/tapeReplay.js:61-76\` treats any such hit as a valid sample; \`api/\_utils/filmTape/tapeReplay.js:123-125\` stores the resulting value as \`atClose\`. \`api/\_utils/filmTape/candlePass.js:103\`, \`api/\_utils/filmTape/candlePass.js:167-173\`, and \`api/\_utils/filmTape/candlePass.js:248-250\` treat any nonempty session as obtained, complete, and non-retryable when no \`bars:\` dependency remains.

\*\*Repro R02:\*\* AMD has only the first 61 one-minute bars of September 24\. Its last bar closes at \*\*10:31 ET\*\*. The action nevertheless gets \`ghost.atClose \= \-565\` under \`closeAt \= 16:00 ET\`, no \`price:AMD@close\` missing input, \`coverage.replay \= complete\`, \`coverage.series \= complete\`, and \`passes.candles \= written\`. The code extrapolates the available price to later sample labels without exposing the gap. I am not claiming that \-565 was the actual market score; the defect is claiming a complete close reconstruction without that input.

\*\*Proposed fix:\*\* preserve sample \`barClosedAt\`/age and validate minute coverage against the session and required samples. Make unavailable close/check samples visibly missing and lower coverage; use the same quality signal to schedule retries. A blanket 390-minute rule would break early-close sessions: derive expected endpoints/counts from the session calendar. Keep the valid last-completed-minute rule; add the missing coverage contract around it.

\*\*HOLLOW test evidence M11:\*\* a mutant reduced every nonempty session shorter than 390 minutes to one minute. All \*\*70\*\* tests in \`candlePass.test.js\` and \`tapeReview.test.js\` passed. A separate real \`processTape\` probe on November 27, 2026 produced \*\*21\*\* ten-minute bars before mutation and \*\*1\*\* after, both marked \`written\`. The pure bars early-close test does not protect this caller.

\#\#\# F3 — Major: a retry can delete an earlier, more complete series

\*\*VERIFIED.\*\* The preservation policy ranks replay/plan objects at \`api/\_utils/filmTape/candlePass.js:194-200\` and preserves a series only when the new fetch is absent. Any nonempty fetch unconditionally replaces its series at \`api/\_utils/filmTape/candlePass.js:252-255\`; the stored series is never read or compared.

\*\*Repro R03:\*\* first morning, AAPL has 390 minutes / 39 aggregated bars and SPY fails, leaving the tape retryable. Second morning, SPY returns but AAPL returns one minute. Saved AAPL shrinks \*\*39 bars → 1\*\* and the tape becomes \`written\` with complete series coverage. This is real information loss under invariant 7, even though the all-or-nothing failed-symbol tests pass.

\*\*Proposed fix:\*\* read stored series in the transaction before writes; merge or select by actual timestamp coverage and sample completeness. Never let a shorter nonempty response erase saved minutes or populated \`atChecks\`. Rank individual retained facts rather than just whole replay/price object counts; retain provenance for preserved content.

\#\#\# F4 — Major: newly recovered checks do not invalidate completed candle output

\*\*VERIFIED.\*\* \`api/\_utils/filmTape/tapeMerge.js:351-359\` requeues only new action/plan keys or a larger count of complete input legs. However replay samples depend on checks (\`api/\_utils/filmTape/tapeReplay.js:105-111\`), and series \`atChecks\` depends on checks (\`api/\_utils/filmTape/candlePass.js:125-142\`). The close merge preserves candle coverage unchanged at \`api/\_utils/filmTape/tapeMerge.js:331-338\`.

\*\*Repro R06:\*\* omit tick 10 from the first close write; run candles; restore tick 10 and rerun close. The tape now contains the recovered real check, while AAPL's series lacks tick 10\. Candle status stays \`written\`, so no scheduled enrichment will revisit it. The same missing invalidation can leave replay samples/reconciliation stale when their check or evidence inputs improve.

\*\*Proposed fix:\*\* define and compare a candle-input fingerprint including relevant checks/times/stages, evidence, action inputs, plans, and symbol roles. Requeue changed dependencies within the window and mark stale output partial outside it. Preserve previous results as historical enrichment until replaced, while making their coverage honest.

\#\#\# F5 — Major: source uncertainty can become “complete,” including a false inactivity statement

\*\*VERIFIED; three distinct counterexamples to BA-20.\*\*

\- \*\*R05:\*\* remove the model check's tick, evaluation entry, and run from an otherwise retained day. Tick 9 is a known gap and checks are partial. Plans, rationale, evidence, and calls nevertheless report \`complete\`; calls say \*\*“no check of this day reached the model — no call could be minted.”\*\* \`api/\_utils/filmTape/tapeAssemble.js:855-857\` creates entry reasons only from cap/known evalId evidence; it does not propagate the uncertain missing tick/run into these sections. The false categorical note is at \`api/\_utils/filmTape/tapeAssemble.js:914-918\`.  
\- \*\*R14:\*\* keep the tick and its evalId, but remove the corresponding entry. Plans correctly become unavailable, while calls still report complete with the same false note. \`api/\_utils/filmTape/tapeAssemble.js:909-925\` does not reuse \`missingEntries\` to account for unknown declaration phases. Directives also remain complete; their check is only \`evictionPossible && capture \!== 'present'\` at \`api/\_utils/filmTape/tapeAssemble.js:889-895\`.  
\- \*\*R12:\*\* after a complete first tape, add a late run record from a duplicate invocation in an already-covered slot whose deferred list was truncated. The rerun sets \`deferralsTruncated \= true\` but keeps checks coverage \*\*complete, note null\*\*, because \`api/\_utils/filmTape/tapeMerge.js:217-225\` retains the higher old rank and drops the new caveat. The top-level export still prints the truncation flag (\`api/\_utils/filmTape/tapeExport.js:295\`); it does not resolve the contradictory coverage statement.

There is also an \*\*undisclosed spec relaxation\*\*: R13 supplies 150 evaluations with the oldest preceding this day. Plans/rationale/evidence/calls are complete because \`api/\_utils/filmTape/tapeAssemble.js:82-85\` uses cap \*\*and\*\* oldest-date logic. BA-20 literally says at-cap evaluations-sourced sections are at most partial (\`docs/specs/FILM\_ROOM\_BUILD\_A\_TAPE\_SPEC\_V1\_2\_20260927.md:67\`). The implementation's narrower rule can be defensible when the entire day is bounded, but needs explicit disposition; it is not one of §6.8's two disclosed widenings.

\*\*Proposed fix:\*\* distinguish complete known records from proof that no unknown records existed. Propagate missing-entry/run/tick uncertainty to dependent sections; replace the categorical no-model statement with the actual absence observed. Merge coverage evidence and unresolved reasons, not merely maximum rank. Preserve a complete old section only when its saved facts demonstrably cover the newly missing source. Resolve the literal cap rule with the founder.

\#\#\# F6 — Major: helper readiness and writer selection disagree

\*\*VERIFIED.\*\* \`src/utils/reviewAvailability.js:126-134\` filters strings but never validates the final trading day or checks whether \`tapeDateFor\` could select this battle. It computes pending from \`completedAt\` alone. Its calendar is the 2026-only client helper (\`src/utils/reviewAvailability.js:50\`, \`src/utils/marketHolidays.js:1-17\`), whereas the writer's calendar supports 2026 and 2027 (\`api/\_utils/marketSchedule.js:51-77\`).

\*\*R04:\*\* completed tiered battle with \`timing.tradingDays \= \['not-a-date'\]\` returns \`{ready:false,target:'filmRoom',availability:'pending'}\`. The actual close pass classifies it \`notBattleDay\` and writes nothing. Future completion-selection windows then move past it.

\*\*R17:\*\* a January 18, 2027 holiday completion is promised that night's pass. The server skips the holiday; the next morning the helper says unavailable even though the January 19 session's pass does select and tape the January 15 final day. \*\*R09:\*\* in 2028, the helper promises pending while the server refuses \`calendar\_missing\`. These are deterministic future-calendar cases, not claims about the current September date.

The existing flat6, writer-dark, ordinary pre-backfill, 2026 holiday/weekend and after-pass tests pass. The \*\*three-key interface itself is correct\*\*; mutation M05 adding a score field fails 16 assertions.

\*\*Proposed fix:\*\* share a Node/browser-clean maintained session/owning-pass eligibility contract; validate the final day and reject malformed/future/inconsistent timelines before promising pending. Use the same selection semantics and calendar-availability check as close. Continue returning exactly three keys.

\#\#\# F7 — Major: a stale close assembly can regress a completed tape to active

\*\*VERIFIED at the merge seam.\*\* Source battle data is assembled before the transaction (\`api/\_utils/filmTape/writeTapeDay.js:63-91\`). The transaction rereads the tape, but \`api/\_utils/filmTape/tapeMerge.js:253\` takes stale \`battleStatusAtWrite\`, and \`api/\_utils/filmTape/tapeMerge.js:280-283\` takes stale non-null status while preserving stronger completion fields.

\*\*R11:\*\* merge a previously assembled active day after a completed day has landed. Output is \`battle.status \= active\` and \`battleStatusAtWrite \= active\`, alongside a retained completion timestamp, final score 42, and win result. Two overlapping close/backfill invocations can supply that ordering. This is separate from the candle race, whose transaction behavior passes R16.

\*\*Proposed fix:\*\* merge the completion block as an ordered lifecycle unit, keeping completed terminal, or bind/revalidate the source battle version/status before publication. Do not combine stale status with retained final numbers. Add the old-active/new-completed/old-commit ordering to the writer tests.

\#\#\# F8 — Minor: an aged-out pending tape can fall behind the expiry scan forever

\*\*VERIFIED.\*\* Selection is bounded to 15 prior sessions (\`api/\_utils/filmTape/candlePass.js:57\`, \`api/\_utils/filmTape/candlePass.js:290-295\`). Expiry marking happens only after selection (\`api/\_utils/filmTape/candlePass.js:308-315\`).

\*\*R20:\*\* a pending September 1 tape is absent from the September 25 scan and remains pending, with zero writes to it. Later lower bounds move farther forward. An extended writer-off period or outage can create this state. The report's broad statement that aged-out work becomes \`failed retry\_window\_elapsed\` therefore has an unstated five-session catch-up limit.

\*\*Proposed fix:\*\* provide a bounded resumable sweep for all expired nonterminal work, or an explicit founder repair path that records terminal unavailability. Keep fetch retries within the ten-session window.

\#\#\# F9 — Minor: the six-entry allowlist is not a complete physical write census

\*\*VERIFIED.\*\* There are \*\*seven\*\* physical Firestore write call sites. The direct expiry \`ref.update\` at \`api/\_utils/filmTape/candlePass.js:313\` is missing from the scanner's output. \`api/\_utils/compositionProtectedStoresAllowlist.json:318-323\` exactly matches the \*\*six scanner-visible unresolved sites\*\*, with no stale extra key. It does not exactly match the runtime write enumeration demanded by the request.

\`runCandlePass::update\` is pinned to one and its note explicitly describes the transactional failure write (\`api/\_utils/compositionProtectedStoresAllowlist.json:371\`), not expiry. The scanner's documented shape-based resolution is at \`api/\_utils/compositionProtectedStoresScan.js:29-40\`; the observed census is in \`census.json\`.

\*\*Proposed fix:\*\* make the direct reference from the collection-group loop visible to the scanner and review/pin both \`runCandlePass\` update sites, or expose distinct named writers. Do not merely change a count while the scanner still misses the call. Human approval must cover all seven physical sites plus F1's path validation.

\#\# 3\. Complete reachable write and read boundary

| Physical site | Reachable operation | Actual destination construction | Allowlist |  
|---|---|---|---|  
| \`api/\_utils/filmTape/writeTapeDay.js:102\` | Normal/skipped-mode close transaction set | \`tapeRef(db,battleId,etDate)\` | \`writeTapeDay::set\`, 1 |  
| \`api/\_utils/filmTape/writeTapeDay.js:127\` | Existing failure marker update | Same \`tapeRef\` | \`markCloseFailed::update\`, 1 |  
| \`api/\_utils/filmTape/writeTapeDay.js:133\` | Initial failed tape set | Same \`tapeRef\` | \`markCloseFailed::set\`, 1 |  
| \`api/\_utils/filmTape/candlePass.js:255\` | Series transaction set | Returned group ref \+ \`/series/{symbol}\` | \`processTape::set\`, 1 |  
| \`api/\_utils/filmTape/candlePass.js:258\` | Enrichment transaction update | Returned group ref | \`processTape::update\`, 1 |  
| \`api/\_utils/filmTape/candlePass.js:313\` | Aged-out marker update | Returned group ref | \*\*Missing physical site\*\* |  
| \`api/\_utils/filmTape/candlePass.js:348\` | Failed-attempt transaction update | Returned group ref | \`runCandlePass::update\`, 1 |

\`tapeRef\` constructs the named battle subcollection at \`api/\_utils/filmTape/tapeSources.js:17-18\`. Close/backfill delegate all their writes to \`writeTapeDay\` / \`markCloseFailed\`. Their imported \`findActiveAgentBattles\` only queries and maps active battle documents (\`api/\_utils/agentBattleService.js:43-49\`). The imported completion comparator only computes a return value (\`api/cron/agent-evaluate.js:5985-6008\`). The candle fetcher does HTTP and returns bars; it does not call the same file's unrelated Firestore cache writers (\`api/\_utils/marketDataCache.js:792-872\`). Scoring, assembly, merge, bar/time utilities and mode/constants code have no Firestore write on the called path. \`Map.set\`, \`Set.add\`, and map deletion in pure code are not database writes.

\*\*No reachable \`tickBodies\` read found.\*\* The source readers enumerate battle, permanent ticks/neighbours, receipts, calls, declarations, run records, intraday-view presence and prior tape (\`api/\_utils/filmTape/tapeSources.js:25-117\`); none reads a body. Existing BA-2 path-log tests and the real backfill test pass. Importing a module that also defines capture writers does not call those writers.

\*\*Flag-off/import boundary confirmed.\*\* R18 dynamically imports both handlers with real false flags, replaces the Admin accessor with a throwing spy and fetch with a throwing spy, then invokes authorized cron requests. Imports and calls both yield \*\*zero accessor and fetch calls\*\*, and both handlers answer \`flag\_off\`; no Firestore handle exists through which they could read/write. The source gates are \`api/cron/film-tape-close.js:55-63\` and \`api/cron/film-tape-candles.js:36-44\`. The independent base-versus-tip production-import census found \*\*zero pre-existing modules importing tape/helper modules\*\*. Existing screens have no diff or new tape import.

\`battleResult.js\` imports the evaluator solely to call \`resolveCompletionDisposition\` (\`api/\_utils/filmTape/battleResult.js:9-14\`). The evaluator's Anthropic construction is lazy inside its accessor (\`api/cron/agent-evaluate.js:185-212\`); the handler's database acquisition is inside the handler (\`api/cron/agent-evaluate.js:236\`). R18 observed no imported I/O. I found no import-time production write, read, or fetch reaching the close cron; I did not remeasure the executor's claimed cold-start milliseconds.

\#\# 4\. One disposition per build-report §3 claim

\*\*CONFIRMED\*\* means the A1 claim survived the stated local falsification attempts, not universal proof or approval of A2's unbuilt screen. \*\*REFUTED\*\* names a current counterexample. \*\*HOLLOW\*\* is used for an executed surviving mutant; the 70-test candle claim is separately recorded below, rather than disguising a reproduced defect as merely a test weakness.

\#\#\# §3.1 — nine honesty invariants

| Claim | Disposition | Evidence / attempted falsification |  
|---|---|---|  
| 1 Every number has one of four classes and is labelled | \*\*CONFIRMED\*\* for the A1 schema/export | Numeric-leaf and declaration-golden tests passed across close/candle/series fixtures; resolver rejects ambiguous/unrecognized classes. \`src/constants/filmTape.js:125-268\`, \`api/\_utils/filmTape/tapeExport.js:49-52\`. Class judgments in §6 |  
| 2 No implied armed protection, unseen datum, or unfinished-minute price | \*\*CONFIRMED\*\* for the claimed sampling/attribution mechanisms | R10 checks HH:MM:30 and absent opening bar; M01 fails three assertions; M08 accepting suppressed heard stamps fails. Risk/diagnostic export tests pass. Stale completed bars are F2, not a containing-minute regression |  
| 3 Separate player/filed text; no paraphrase field; attributed historical voice | \*\*CONFIRMED\*\* for A1 copy/export | Directive, placeholder and guardrail-override rows in writer/review/export suites passed; \`api/\_utils/filmTape/tapeAssemble.js:475-590\`, \`api/\_utils/filmTape/tapeAssemble.js:623-641\` |  
| 4 Plans get prices, calls copied without judgment | \*\*CONFIRMED\*\* for schema and wording | Plan-only symbol, horizon-note, no highs/lows/verdict, and observed call-state rows passed. \`api/\_utils/filmTape/candlePass.js:108-122\`, \`api/\_utils/filmTape/tapeAssemble.js:652-681\`. Price completeness has the separate F2 defect |  
| 5 Own subcollections only; no body reads | \*\*REFUTED\*\* | R01 / F1 breaks writes; F9 disproves exact six-site census. The no-body-read half survived |  
| 6 Writer-off/old-screen equivalence | \*\*CONFIRMED\*\* | R18; zero pre-existing production importers; both flags false; M06 bypassing the close handler gate fails. Full A2 visual equivalence is outside this unbuilt screen |  
| 7 Gaps/truncation visible; preserve all facts; truthful coverage | \*\*REFUTED\*\* | R02/R03/R05/R06/R12/R14 and F2–F5. Requested evaluation eviction and both candle transaction orders pass R07/R16; those successes do not establish the broader invariant |  
| 8 Exactly readiness, availability, destination | \*\*CONFIRMED\*\* | Every existing helper branch passes exact key assertions; M05 adding \`score\` fails 16 assertions. Availability values can still be wrong under F6 |  
| 9 No decisive selection, ranking, or unsupported conclusion | \*\*REFUTED\*\* for the full honesty claim | R02/F2 labels an incomplete reconstruction as complete through close; R05/R14/F5 make an unsupported no-model statement. The narrower ordering/label mechanisms hold: actions sort by time (\`api/\_utils/filmTape/tapeAssemble.js:465-468\`); L4-F3 verifies the later-slot count and hypothetical wording (\`api/\_utils/filmTape/tapeReview.test.js:467-477\`); R10 retains that marker. No ranking field found in assembly/export; A2 visual treatment unverified |

\#\#\# §3.2 — all nineteen disposition rows

| Claim / prior finding | Disposition | Evidence / repro or mutant |  
|---|---|---|  
| 1 Replay arithmetic, banked points, later-trade hypothetical | \*\*CONFIRMED\*\* for arithmetic with supplied samples | Original worked-example test at \`api/\_utils/filmTape/tapeReplay.test.js:47-60\` passes; R10 gives gap 0 and reconciliation 0; M02 omitting banked points fails four assertions. L4-F3 covers a second same-slot swap. Missing-bar honesty remains F2 |  
| 2 Headline, completed-only result, no substitute day change | \*\*REFUTED\*\* as a whole | Day-change/last-score tests pass; R11 produces active status alongside final result after stale assembly. F7 |  
| 3 Risk wording / missing record | \*\*CONFIRMED\*\* | \`riskOf\` returns null without recorded verdicts (\`api/\_utils/filmTape/tapeAssemble.js:115-123\`); writer and export BA-7 tests pass |  
| 4 Directive filing/status/retained text/heard/reply vocabulary | \*\*CONFIRMED\*\* on retained source histories | Named writer/review/export rows all pass; M08 kills suppressed-stamp acceptance. R07 preserves earlier heard after evaluation eviction. R08's unsupported source-shrink premise is disclosed, not promoted |  
| 5 Plan horizon note; no highs/lows/verdict | \*\*CONFIRMED\*\* for selection and wording | \`api/\_utils/filmTape/candlePass.js:108-121\`; plan/export tests pass. Incomplete-price handling is F2 |  
| 6 Copy evidence; both-leg inputs; plan-only symbols | \*\*CONFIRMED\*\* for assembly and requested eviction | R07 preserves evidence/plans; existing multi-day cap test passes. M03 sold-entry regression fails six assertions. Six capture writers verified in §5. Candle refresh is separately refuted by F4 |  
| 7 Flip-day notice | \*\*CONFIRMED as an explicit A2 deferral only\*\* | The claim sheet itself says A2 (\`docs/audits/20260927\_BUILD\_FILM\_TAPE\_A1.md:243\`). No A1 implementation or test exists; this is not a confirmation that the future screen displays the notice |  
| 8 Ways to mislead | \*\*REFUTED\*\* as the broad prior-review disposition | F2's complete close reconstruction and F5's no-model statement create unsupported conclusions despite the proper fixed labels. R02/R05/R14 |  
| 9 Hub wording/unavailable vs pending/narrow interface | \*\*REFUTED\*\* | Three-key interface passes, but R04/R09/R17 falsify schedule/eligibility agreement. F6 |  
| 10 Call provenance / observed state | \*\*CONFIRMED\*\* for copied rows | \`copiedAt\`, version, tape-write mode, unknown record mode and resolved-on-day cases pass; \`api/\_utils/filmTape/tapeAssemble.js:652-684\`. Calls coverage, a separate assertion, fails F5 |  
| Inv 1 Provenance | \*\*CONFIRMED\*\* | Same scope/evidence as §3.1 invariant 1; §6 class rulings |  
| Inv 2 HOLD / diagnostics / completed-minute price | \*\*CONFIRMED\*\* | Same scope/evidence as §3.1 invariant 2; R10, M01, M08 |  
| Inv 3 Reply/rationale contradiction | \*\*CONFIRMED\*\* | Typed filing status and attributed quotations survive the suite; platform override text is excluded |  
| Inv 7 Preservation/missingness/truncation | \*\*REFUTED\*\* | F2–F5, R03/R05/R06/R12; positive controls R07/R16 |  
| Inv 8 Helper surface | \*\*CONFIRMED\*\* | M05 killed; existing helper exact-key tests pass |  
| Inv 6 Wording per flag | \*\*CONFIRMED\*\* | R18; false flag pins; import census; unchanged existing UI |  
| Retry path / next-pass promise | \*\*REFUTED\*\* | R03 loses series during retry; R20 never reaches expiry marking; R04/R17 break the helper promise |  
| Cut “biggest swing” | \*\*CONFIRMED\*\* | No selection/ranking implementation in A1 assembly/export; chronological ordering and fixed hypothetical text inspected |  
| Add per-section coverage | \*\*REFUTED\*\* | All nine objects/headings exist, but completeness is false in R02/R05/R12/R14. M11 is a surviving destructive mutant of the bar-coverage caller |

\#\# 5\. Requested break attempts: what held and what broke

\*\*Replay arithmetic:\*\* the spec's 10-point example exists and passes. R10 independently produces \`gapPoints \= 0\`. A later same-slot swap is already exercised by the final-tip L4-F3 test, which passes; the prompt's premise that this fixture is absent no longer holds at the tip. The fork remains one-step hypothetical, not a replay of the second trade.

\*\*09:31:\*\* with a normal 09:30 one-minute row, a bar has completed exactly at 09:31. To test the requested “09:31 before any bar has completed” data condition, R10 removes the opening row, so the first available row starts at 09:31. Ghost at-swap and closed-leg delta are null and \`price:OUT@swap\` is recorded. The bought leg starts from later samples, as intended. Comparables become null too, though their missing price endpoint is not individually named. HH:MM:30 correctly uses the bar completed at HH:MM:00. The hole across close is the distinct failed R02 case.

\*\*Sold-entry fix:\*\* the assembler reads sold entry only from positive \`trade.entryPrice\` or \`receipt.guardrailReplay.outgoingEntryPrice\`; bought fill is \`entryMark\`, then the tick action (\`api/\_utils/filmTape/tapeAssemble.js:409-422\`). Backfill invokes the same writer/assembler; merge never sources a sold entry from a tick action (\`api/\_utils/filmTape/tapeMerge.js:94-105\`). The contract tripwire reads the actual \`api/cron/agent-evaluate.js\` source (\`api/\_utils/filmTape/writeTapeDay.test.js:214-218\`). I located all six actual capture fields at \`api/cron/agent-evaluate.js:2027\`, \`api/cron/agent-evaluate.js:3589\`, \`api/cron/agent-evaluate.js:4834\`, \`api/cron/agent-evaluate.js:5051\`, \`api/cron/agent-evaluate.js:5441\`, and \`api/cron/agent-evaluate.js:5679\`; all use \`incomingAsset?.swapPrice\`. M03 deliberately reintroduced the sold/bought confusion and six writer assertions failed. \*\*This fix is confirmed.\*\*

\*\*Merge monotonicity requested cases:\*\* the original capped multi-day test passes (\`api/\_utils/filmTape/writeTapeDay.test.js:415-441\`). R07 removes all day's evaluations after a populated tape: plans, rationale, evidence, heard, and directive \`after\` counts survive; plans/rationale/evidence/directives have \`preservedFrom\` equal to the earlier write. R16 runs the actual candle pass between a close transaction's read and commit: transaction retry occurs and replay/prices/status survive; a later sequential close also preserves them. M04 replacing candle fields from the fresh assembly fails the existing writer race test. F3/F4/F7 are different cases these tests do not establish.

\*\*Coverage adversaries by section:\*\*

| Section | Attempt and outcome |  
|---|---|  
| Checks | Missing run, absent neighbour and truncated-list first writes downgrade correctly; R15 records 40 unattributed gaps and partial coverage. A late truncated run following a complete first write is the counterexample R12 |  
| Actions | Existing capped-trades \+ incomplete-capture test downgrades; no independently established false-complete action-count case in this review. A complete action census does not prove replay inputs or bars complete |  
| Directives | Missing evalId entry without an at-cap array still leaves complete in R14; heard absence is not distinguished by its coverage. Existing cap+incomplete-capture case is protected by M10 |  
| Plans | Lost model tick/entry/run makes an empty list complete in R05. At-cap-but-earlier-oldest exception R13 conflicts with literal BA-20 |  
| Rationale | Same R05/R13 problems; normal eviction preservation passes |  
| Evidence | Same R05/R13 problems; normal eviction preservation passes |  
| Calls | Known missing entry still produces complete and “no check … reached the model” in R14; declaration phase uncertainty is lost |  
| Replay | Nonempty bars ending 10:31 ET yield complete through 16:00 ET in R02 |  
| Series | R02 incomplete span is complete; R03 deletes saved bars while returning complete; M11 survives |

The exercise did not force a defect into every section. Where no concrete counterexample was established, it is stated rather than inferred from another section.

\*\*Rules:\*\* all 21 tape-rule tests pass as part of the 332-test suite. R19 additionally puts another owner's series beneath a battle/tape owned by the caller: battle owner denied, series owner allowed, anonymous reads denied, and create/update/delete denied for owner/other/anonymous on both document kinds. The document's own \`ownerId\` is the spec's authorization source (\`firestore.rules:508-516\`), not its parent's owner. This is deliberately separate from Admin writer authority.

\#\# 6\. Class judgments requested in item 9

| Question | Ruling | Reason |  
|---|---|---|  
| (a) Minted tickSeq in \`no\_record\` rows and gap arrays | \*\*Agree: recorded\*\* | This labels an allocated identity, not a reconstructed check fact. Counter/sequence bounds establish that the integer was minted; the row state and attributed/unattributed distinction express missing record/day evidence. It must never imply a recorded timestamp, decision or outcome. \`api/\_utils/filmTape/tapeAssemble.js:254-283\`, \`src/constants/filmTape.js:129-135\` |  
| (b) \`closedLegDelta\` and \`boughtVsEvidence\` deltas | \*\*Agree: rebuilt\*\* | These combine a bar-derived operand with a recorded operand. They cannot inherit the greater certainty of the recorded operand or be described as arithmetic solely on recorded values. \`api/\_utils/filmTape/tapeReplay.js:153-170\`, \`src/constants/filmTape.js:206-215\` |  
| (c) Bought threshold history \`{0,0}\` | \*\*Agree: recorded\*\* | Every executed swap resets the incoming symbol's history to those exact values at \`api/\_utils/agentSwapExecution.js:305-311\`; assembly states that source at \`api/\_utils/filmTape/tapeAssemble.js:360-369\`. It is a reconstruction of the executor's deterministic write, not an inferred market observation. No reason found to overturn the provisional ruling |

These classifications do not certify a value's completeness or factual accuracy; F2 can be labelled rebuilt correctly and still have incomplete inputs.

\#\# 7\. Spec widenings and the platform scoring question

\*\*Report §6.8 selection widening: implemented.\*\* \`completionsSinceMs\` begins at the previous session's ET-day start (\`api/\_utils/filmTape/closePass.js:59-61\`). The query includes completions over that interval (\`api/\_utils/filmTape/closePass.js:82-86\`, \`api/\_utils/filmTape/closePass.js:132-154\`). \`tapeDateFor\` directs a later completion to its prior final session (\`api/\_utils/filmTape/closePass.js:65-73\`); backfill reopens a written final day that owes completion (\`api/\_utils/filmTape/closePass.js:218-226\`). Existing weekend/holiday/after-pass and completion-remerge tests pass; R17 also observes the actual next-session selection. This is a reasonable correction of the original same-date selection sentence.

\*\*Its limits:\*\* selection is not a durable close retry queue. A malformed final day is never targeted (R04); a missed relevant close window eventually leaves completion behind the query range; overlapping stale assembly can regress status (R11). The handler itself logs that budget-not-reached days need backfill (\`api/\_utils/filmTape/closePass.js:140-144\`). Do not turn “next pass” into an unconditional eventual-delivery promise.

\*\*Report §6.8 helper widening: implemented, but not equivalent to writer eligibility.\*\* \`owningPassDate\` and \`closePassStillScheduled\` retain pending through the selected pass's nominal 300-second end (\`src/utils/reviewAvailability.js:92-103\`). The 2026 cases pass; F6 records where the widening gets it wrong. A written final-day tape can be ready while its completion block is still awaiting the later merge: that is consistent with §11's literal written-close readiness contract, so I did not treat it as a new readiness defect.

\*\*Report §6.9: YES, conditionally, with a concrete scorer repro.\*\* After the daily reset, a swapped-in name absent from \`portfolio.startingPrices\` has no usable entry on the next held-scoring pass. The reset preserves only \`previousSwapPrice\` and deletes \`swapPrice\` / \`swappedInDay\` (\`api/cron/agent-daily-scores.js:153-166\`). The live scorer chooses \`asset.swapPrice || startingPrices\[symbol\] || 0\` and returns the scorer's zero-change fallback when entry is nonpositive (\`api/cron/agent-evaluate.js:1108-1117\`). The swap executor inserts the incoming asset into its tier but does not add its entry to \`startingPrices\` (\`api/\_utils/agentSwapExecution.js:282-303\`). The production-source search finds writes, but no reads, of \`previousSwapPrice\` in \`api/\` and \`src/\`.

R21 executes the source-extracted held-scoring closure with the real scorer: TSLA bought at 50, current 55, support tier, ATR 10, absent from startingPrices scores \*\*115 before reset and 0 after reset\*\*, despite \`previousSwapPrice \= 50\`. This is not division by zero or infinite points: the zero entry takes the explicit zero-change fallback before normal price/baseline calculation. It is not universal to names already present in startingPrices, which instead fall back to that stored price. Multi-day carrying is required. \*\*Existing platform defect, separate tasking; no fix made.\*\* It must be resolved or explicitly accepted before tape smoke results are treated as evidence that the underlying live scoring is correct.

\#\# 8\. Test integrity, unsuccessful candidates, and process claims

| Mutation | Defect introduced | Result |  
|---|---|---|  
| M01 | Select containing minute instead of completed minute | 3 / 13 assertions fail |  
| M02 | Omit locked banked points from gap | 4 / 16 fail |  
| M03 | Use bought tick fill as sold entry | 6 / 40 fail |  
| M04 | Overwrite candle values from close assembly | 1 / 40 fails |  
| M05 | Add score to helper return | 16 / 23 fail |  
| M06 | Bypass close handler writer flag | 1 / 18 fails |  
| M08 | Accept a suppressed heard entry | 1 / 50 fails |  
| M10 | Ignore evaluation-cap eviction | 2 / 90 fail |  
| M11 | Reduce any sub-390-minute nonempty session to one minute | \*\*HOLLOW: 70 / 70 pass\*\*; independent early-close proof changes 21 bars to 1 |

All mutants ran in the separate scratch archive, one at a time, with original bytes restored. None was applied to the worktree or review snapshot. These nine are this review's executed mutations; the build report's much larger historical mutant list was not independently rerun in full.

\*\*Candidate not promoted:\*\* R08 removes a previously saved later committed directive from the source, leaves its tape row preserved, and observes the earlier directive's aftermath rise from 7 checks to 19\. Recounting is conditional only on carried check/action rows (\`api/\_utils/filmTape/tapeMerge.js:268-276\`), so the preserved stopping directive is ignored in that ordering. The probe is real, but I did not find a normal truncation/deletion writer for \`chatExchanges\`; its current writer uses \`arrayUnion\` (\`api/agent/chat.js:1072\`). This is a latent merge-contract weakness, not an established normal-path source-eviction finding. A robust recount should still use all merged directive boundaries.

\*\*Other attempts that did not establish defects:\*\* the original 10-point gap, six-writer sold/bought distinction, normal evaluation eviction, suppressed heard stamps, missing-neighbour attribution, both candle/close transaction orders, owner rules, false flags, and exact helper key count all survived. The initial 2027 “calendar missing” theory was refuted by the server's maintained 2027 calendar; the actual client/server divergence is the holiday case R17 and post-2027 bound R09.

\*\*Report §7.6 historical process deviations:\*\* the listed \`git status\`, \`show\`, \`log\`, \`merge-base\`, and \`cat-file\` commands do not edit tracked source; \`status\` can refresh metadata. The supplied tip's diff changes 45 files, none of the calibration-fence files. The three pre-existing test changes are explicit scorer/cron-count ratchet updates. I can verify the committed tree and my own unchanged workspace, but \*\*cannot prove what every prior process did to uncommitted files\*\* from an ancestor/tip diff. The historical assertion “nothing was written” remains unverified beyond the named commands' semantics; I found no contrary source evidence. This limit is not a new blocker.

\*\*Report §7.7:\*\*

| Requested check | This review's measured result |  
|---|---|  
| Full suite at tip | 819 files; 16,271 tests; 16,156 passed, 28 failed, 87 skipped. All 28 failing names reproduce in a 14-file base run: 168 tests, 140 passed, 28 failed. Failures concern Windows path separators, native import paths, and shell utilities. This independently verifies collection/count and absence of a new failure set here; it does not reproduce the report's Linux all-green run |  
| Tape subset | 14 files / 278 tests, all pass in the corrected full run |  
| Rules | 18 files / 332 tests, all pass; extra R19 passes. CLI default wanted emulator v1.21.0 and download failed; cached v1.20.2 was explicitly used on localhost. No production project contacted |  
| \`lint:gate\` | Exact ESLint gate command, exit 0 on the byte-verified snapshot |  
| \`vite build\` | Explicit build, exit 0; 12.66 s; CSS/chunk warnings remain, no branch CSS edits. Generated assets outside repository |  
| Cron count | Parsed base 41 / tip 43\. New schedules are \`15 2 \* \* 2-6\` and \`0 11 \* \* 2-6\`; wiring tests pass (\`vercel.json:208-215\`) |  
| Original worktree | Still detached at \`ef80da13bd0ca7ccfa6ef975808a139412129fa2\`, empty porcelain status; no source edits, stage, commit, push, or branch switch |

\#\# 9\. Founder work before the flip not already adequately named

The report already names indexes, rules/cron deployment, read-out and first-run smoke prerequisites, backfill timing, the existing scoring question, fetch timeout, and possible duplicate spending. The additional work established here is:

1\. \*\*Close F1's writer boundary and review all seven physical writes.\*\* The six notes cannot stand as the complete human review record.  
2\. \*\*Require partial-but-nonempty bar fixtures and early-close candle integration tests.\*\* Preserve earlier complete series across a poorer retry. Do not accept empty \`symbolsMissing\` as proof of complete bars.  
3\. \*\*Make coverage and candle invalidation evidence-aware.\*\* Exercise lost tick+entry/run, known missing entry, late truncated run, and recovered checks after candles. Retain gaps and new caveats even when older facts survive.  
4\. \*\*Resolve the extra BA-20 cap interpretation\*\*, and align helper/writer eligibility and maintained calendars. Reject malformed trading-day data instead of promising pending.  
5\. \*\*Exercise overlapping close/backfill completion publication\*\* and make terminal completion state monotone.  
6\. \*\*Name a recovery procedure for pending tapes older than the expiry scan.\*\* The current backfill cannot be assumed to refresh a day it skips as already written (\`api/\_utils/filmTape/closePass.js:223-224\`).  
7\. \*\*Rerun the corrected branch's Linux full suite and the intended emulator version\*\* in the founder's normal validation environment. The Windows base comparison explains this review's failures; it is not a substitute for the deployment environment's gate.

No remediation, deployment, flag flip, production read, commit, or PR was performed. This file is the uncommitted deliverable intended for \`docs/audits/20260928\_ASTRA\_REVIEW\_FILM\_TAPE\_A1\_BRANCH.md\` when the founder elects to import it.

