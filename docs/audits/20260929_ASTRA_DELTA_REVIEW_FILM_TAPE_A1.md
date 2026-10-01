\# Astra — Delta Review: Film Room Build A1 after the fix round

\*\*Verdict: DO NOT MERGE this tip.\*\* The original write-boundary blocker is closed, and every requested original defect repro now has the corrected outcome. The fix round nevertheless leaves seven major gaps and one minor recovery gap: changed inputs or an unsuccessful retry can leave stale replay marked complete; coverage can hide a newly unknown declaration; equal-size retries can discard a saved price; completion can move backward within the completed state; and the sweep can stall or consume its time reserve. The advertised backfill repair still skips a written day whose sources grew. These are verified local counterexamples, not production incidents.

| Review boundary | Verified result |  
|---|---|  
| Requested branch | \`claude/hopeful-keller-0xgl6p\`, fetched in this review |  
| Reviewed report tip | \`8e754eb8692abc5e0e2540170d23f7ea20aa2118\` |  
| Code tip | \`124f578246a1666fa6c7a0657bef5e166c37ba05\`; the report-tip commit changes only \`docs/audits/20260927\_BUILD\_FILM\_TAPE\_A1.md\` |  
| Delta base | \`e7e527e7b2f475333bcfdeccba18da90eaedae0d\` |  
| Authority | V1.2 plus Amendment A, BA-23–BA-30 taking precedence |  
| Execution date | September 27, 2026, America/Chicago; September 28 UTC. The September 29 filename is the requested delivery name |  
| Method | LF-preserving \`git archive\` snapshot, explicitly authorized by the user after the checkout mismatch; every test/build ran with an isolated snapshot as its working directory |  
| Source integrity | All \*\*3,496 tracked files\*\* in the review snapshot match their pinned Git blob hashes; the restored mutant snapshot also has zero mismatches |  
| Original checkout | Still clean and detached at \`ef80da13bd0ca7ccfa6ef975808a139412129fa2\`; no checkout, source edit, staging, commit, push, deployment, or production access |

This is a delta review. Untouched behavior is included only where a changed boundary depends on it, or where the prompt explicitly requests it. \*\*VERIFIED / CONFIRMED\*\* below means inspected code and an executed local repro. \*\*REFUTED\*\* names a proposed failure disproved by a control. \*\*HOLLOW\*\* identifies a surviving mutant under an explicitly named test selection. Proposed fixes were not implemented. One reviewer performed the adversarial and refutation passes; this does not claim independent subagent review.

Evidence root: \`C:/Users/fashr/.codex/visualizations/2026/09/28/01a0e599-27f1-7471-ac8b-0c7c00116917/film-a1-delta/\`. The companion \`film-tape-a1-delta-evidence.zip\` contains the original probes, assertion-only acceptance companion, new probes, mutation definitions/results, census, compact verification, and run instructions. Product-source citations refer to the reviewed tip. A passing defect probe asserts the observed defect, not acceptance of it.

\#\# 1\. Original findings and mutants re-run

The original evidence set was found at \`C:/Users/fashr/AppData/Local/Temp/astra-film-tape-a1-e7e527e7/\`. \`astra.test.js\`, \`dark.test.js\`, and \`mutations.mjs\` were copied and run against the new snapshots. \*\*None of the requested R-numbered repros was rebuilt from the executor's rows or from the report descriptions.\*\* The original census script hardcoded old physical line numbers; \*\*F9's physical/runtime census was rebuilt independently\*\* as C15. The original tests intentionally asserted the old defects: 13 now fail at the corrected behavior, while seven controls/other observations pass. An assertion-only companion keeps the same scenarios and verifies the corrected results: \*\*19/19 pass\*\*, plus the unchanged flag-off R18 control passes in the original run.

| Finding | Original repro(s), provenance | Current observed outcome | Disposition |  
|---|---|---|---|  
| F1 — write boundary | R01, original | Foreign \`otherRoot/.../tape/...\` gets zero writes; sanctioned tape enriches. Foreign expiry/failure cases also pass the committed suite and C06 | \*\*Closed\*\* |  
| F2 — stale samples/completeness | R02, original; original M11 mutation | AMD's 10:31 ET last bar no longer supplies a close score: close is null, input named, replay/series partial, pass retryable. Added guard kills M11 | \*\*Closed\*\*; freshness controls C07–C08 also pass |  
| F3 — shrinking series | R03, original | AAPL retains 39 saved buckets when retry supplies one minute, with preservation provenance | \*\*Closed with a new gap:\*\* equal counts can still discard a different saved check sample, DF6 |  
| F4 — late checks/invalidation | R06, original | Recovered tick 10 sets candle status pending and names \`checks\`; saved series remains labeled | \*\*Closed with new gaps:\*\* values omitted from fingerprint, and retained replay relabeled current after a failed fetch, DF1–DF2 |  
| F5 — dishonest coverage | R05, R14, R12, R13, all original | Unknown/lost records lower dependent coverage; no categorical no-model-day claim; late truncation lowers coverage and persists. R13's complete result is now explicitly permitted by amended BA-20 | \*\*Closed with a new gap:\*\* a limit can hide a newly required source, DF3 |  
| F6 — helper/calendar | R04, R17, R09, all original | Malformed/unmaintained timelines unavailable; 2027 holiday stays pending until the real owning pass. Tuesday, delayed completion and skipped-session controls match real writes | \*\*Closed\*\* |  
| F7 — completion regression | R11, original | Old active assembly cannot overwrite completed state. Two overlapping backfills with completion also pass C11 | \*\*Closed with a new gap:\*\* stale completed-to-completed publication rewinds timestamp, final and result, DF7 |  
| F8 — expired work | R20, original | September 1 pending tape is closed out with \`retry\_window\_elapsed\` | \*\*Closed with new gaps:\*\* read-budget resumption, time floor, and backfill repair, DF4–DF5 / DF8 |  
| F9 — write census | C15, \*\*rebuilt census\*\* | Seven physical sites \= seven runtime sites \= seven scanner keys \= seven allowlist entries, each count 1 | \*\*Closed\*\* |  
| R08 — directive aftermath | R08, original | Preserved stopping directive still bounds the earlier directive: seven checks remain seven | \*\*Closed\*\* |

The new findings do not negate those original repro closures. They refute the broader claim that the associated invariant is fully repaired.

| Original mutant | Mutation | Result at this tip |  
|---|---|---|  
| M01 | Use the minute containing the instant | \*\*RED:\*\* 3/13 fail |  
| M02 | Omit banked points from replay gap | \*\*RED:\*\* 4/16 fail |  
| M03 | Restore bought-fill-first outgoing entry | \*\*RED:\*\* 6/40 fail |  
| M04 | Let close replace stored candle columns | \*\*RED:\*\* 1/40 fail |  
| M05 | Add a fourth helper key, \`score\` | \*\*RED:\*\* 17/24 fail |  
| M06 | Remove close-handler dark flag guard | \*\*RED:\*\* 1/18 fail |  
| M08 | Ignore heard suppression | \*\*RED:\*\* 1/50 fail |  
| M10 | Disable evaluations eviction detection | \*\*RED:\*\* 2/90 fail |  
| M11 | Collapse a nonempty session shorter than 390 minutes to one minute | \*\*SURVIVED the original 70-test selection\*\* (\`candlePass.test.js\` \+ \`tapeReview.test.js\`); \*\*RED in the added \`tapeAstraReview.test.js\`: 8/50 fail\*\*, including the real early-close integration guard at \`api/\_utils/filmTape/tapeAstraReview.test.js:343\` |

Thus all nine mutations are killed by the current committed suite. The original M11 two-file selection remains \*\*HOLLOW\*\*, and should not be cited alone as its regression guard. The executor's wider \*\*199-mutant historical run was not re-executed\*\*; this review independently verifies the nine requested definitions, including both M11 selections. Each mutation ran alone in a disposable tree and was byte-restored afterward.

\#\# 2\. Rulings on the two readings

\*\*BA-25 — ACCEPT the terminal-status interpretation, with the implementation gaps below.\*\* C02 starts with a failed, \`retry\_window\_elapsed\` tape and complete saved candle coverage, adds a check outside the retry window, and merges twice. It stays failed, records \`changedInputs: \['checks'\]\`, lowers coverage to partial, and retains one explanatory label. It neither reopens the tape nor erases the changed-input fact. This is the behavior at \`api/\_utils/filmTape/tapeMerge.js:410-418\` and \`api/\_utils/filmTape/tapeMerge.js:430-435\`. I found no counterexample caused by keeping a genuinely terminal pass failed. DF1 and DF2 do allow false complete coverage, but through incomplete dependency identity and relabeling preserved output, not through this terminal-status reading.

\*\*BA-26 — CONTEST the unconditional exemption for a later read limit.\*\* Keeping old facts is sound; inheriting their complete coverage requires proof that they cover every dependency now known. D03 first saves complete calls coverage, then recovers an additional evaluation expecting a declarations record while calls and declarations are unreadable. The new assembly correctly says unavailable; the merge restores the old complete status and removes both unreadability notes. No earlier run ever saved the new record. The expectation remains unknown despite \`preservedFrom\` (DF3).

I accept sticky caveats and preserving coverage through a read failure \*\*when the required facts are unchanged and already saved\*\*: C03 confirms both cases. I reject treating all unreadability/cap limits as harmless merely because some earlier section was complete. Dependency identity or an explicit unresolved-source caveat must govern that decision. The counterexample hides a newly unknown fact; the tested sticky-caveat merge itself does not erase an earlier caveat.

\#\# 3\. Findings, repros, and proposed fixes

\#\#\# DF1 — Major / CONFIRMED: fingerprint equality does not mean replay-input equality

A corrected source value can change the replay's answer while leaving the saved answer marked complete and never scheduling a rebuild.

\*\*Code:\*\* \`api/\_utils/filmTape/candleInputs.js:63-74\` hashes evidence symbol presence, leg presence and numeric presence, not the actual evidence prices/changes, replay-leg values or locked-point value. \`api/\_utils/filmTape/tapeMerge.js:407-418\` uses that identity to decide whether to queue. The replay actually reads leg values and evidence values at \`api/\_utils/filmTape/tapeReplay.js:68-82\` and \`api/\_utils/filmTape/tapeReplay.js:176-194\`.

\*\*Repro:\*\* D01 changes an existing outgoing entry price and locked points without changing any of the five fingerprints. The retained gap is \*\*−387.5\*\*; rebuilding the altered inputs gives \*\*235.5\*\*. Status stays written and replay coverage complete. D02 changes a retained evidence price \*\*103 → 140\*\*; the reconciliation still reports 103\. D13 goes through the real close writer: a source trade's outgoing entry changes \*\*150 → 300\*\*, the tape copies the changed replay input, but preserves the old replay and written/complete claims. This is not just a hand-constructed hash collision.

\*\*Refutation control:\*\* C01 shows unchanged facts, preservation metadata, and an add/remove before publication leave the fingerprint equal. C14 shows an already-saved new check remains in the merged record after its source disappears and still requires rebuilding. Those controls do not cure omitted values.

\*\*Proposed fix:\*\* fingerprint the canonical values actually consumed by replay/reconciliation, including complete replay inputs and the relevant evidence fields; exclude output/provenance bookkeeping. Requeue and label on any such change. Add the source-trade correction as a regression row. This closes the prompt's explicit “replay changes but none of the five parts change” attack.

\#\#\# DF2 — Major / CONFIRMED: preserving an old replay removes its stale-input label

A retry can correctly keep earlier data and then incorrectly describe it as rebuilt from the newly recovered checks.

\*\*Code:\*\* \`api/\_utils/filmTape/candlePass.js:285-295\` and \`api/\_utils/filmTape/candlePass.js:369-375\` choose an older replay by completeness rank. The pass then stores the current tape fingerprint at \`api/\_utils/filmTape/candlePass.js:403\`, and recomputes coverage from those retained objects at \`api/\_utils/filmTape/candlePass.js:183-201\` and \`api/\_utils/filmTape/candlePass.js:409\`. It does not retain their older input identity.

\*\*Repro D10:\*\* omit tick 10, run candles, recover tick 10 and rerun close. Coverage correctly becomes partial with “built before … checks.” Now make every refetch fail. The old replay is retained and still lacks tick 10, but replay coverage becomes \*\*complete\*\*, the warning disappears, and the saved fingerprint equals the new tape's. Overall candle status remains partial because the series path detects its uncovered check; that does not make the replay section's complete claim true.

\*\*Proposed fix:\*\* keep dependency identity/provenance with each retained replay or price result. Preserve its stale label and partial coverage until an output covering the required inputs replaces it; do not stamp a current aggregate fingerprint as proof that every retained section was rebuilt.

\#\#\# DF3 — Major / CONFIRMED: old complete coverage masks new unreadable dependencies

\*\*Code:\*\* unreadable calls/declarations are classified only as limits at \`api/\_utils/filmTape/tapeAssemble.js:961-973\`. \`api/\_utils/filmTape/tapeMerge.js:232-254\` selects the higher-ranked old coverage and only forces a reduction for caveats. It does not check whether saved facts cover newly added checks or declaration expectations.

\*\*Repro D03:\*\* save a day with complete calls coverage. Add a recovered evaluation with a new evalId and \`declarationsPhase: 'expected'\`; fail the calls and declarations reads. Fresh coverage is unavailable with both failures named. Merge produces \*\*complete\*\*, \`unknownChecks: 0\`, an old \`preservedFrom\`, and no failure note, while the new evaluation is present in merged checks. Earlier saved facts contain no observation of its required declaration.

\*\*Refutation control C03:\*\* an unchanged dependency set can retain complete saved coverage through a temporary unreadable read; a known caveat remains partial on later runs. The defect is extending that exception to newly required facts.

\*\*Proposed fix:\*\* preserve old rows without granting their rank to new dependencies. Record source/check/declaration coverage identities and reconcile them against the merged requirements, or conservatively keep an unresolved-dependency caveat until those requirements are observed. This is the reason for contesting the BA-26 reading in §2.

\#\#\# DF4 — Major / CONFIRMED: the bounded sweep does not resume past rows it cannot remove

\*\*Code:\*\* \`api/\_utils/filmTape/candlePass.js:434-459\` starts each status at \`cursor \= null\` on every invocation. Only the in-memory page cursor advances. Terminal and invalid rows consume the 1,000-result allowance but stay in the query. The failed lookback is applied at \`api/\_utils/filmTape/candlePass.js:439-440\` and \`api/\_utils/filmTape/candlePass.js:490-493\`.

\*\*Repros:\*\* D04 reads the same 1,000 terminal failed documents on two consecutive scheduled mornings and performs no close-outs behind them. D12 puts a retryable failed tape later in the ordering on that same date; it is never reached on those mornings and eventually falls outside the 60-session lookback with \`fetch\_failed\` unchanged. That does \*\*not\*\* require the sweep to have been off for 60 sessions, contrary to the executor's explanation. D05 puts 1,000 foreign pending rows before a valid expired pending tape: every run spends its allowance rejecting the same rows, so the valid tape remains pending with no cursor progress. Foreign rows receive zero writes.

\*\*Refutation controls:\*\* C04 closes an ordinary 205-row backlog \*\*100 / 100 / 5\*\* across three mornings, while the first morning also enriches current work. C05 isolates a mid-page exception and retries it on the next morning. C06 confirms terminal rows cost query results, never per-document transactions, and confirms the configured lookback. These controls establish that the failure depends on non-removable rows, not ordinary pagination.

\*\*Proposed fix:\*\* make progress resumable independently of successful deletions from the predicate: a durable bounded cursor/rotation or an explicit queryable terminal/expiry state, with a reviewed write-boundary amendment if new storage is needed. Ensure invalid rows and persistent failures cannot pin the start forever, and test repeated runs through the 1,000-read bound. Keep BA-23 rejection intact.

\#\#\# DF5 — Major / CONFIRMED: the sweep's time floor is checked only between pages

\*\*Code:\*\* \`api/\_utils/filmTape/candlePass.js:437\` checks remaining time before the page query; the inner document loop at \`api/\_utils/filmTape/candlePass.js:445-456\` checks the mark count but not time. The sweep runs before normal candle work at \`api/\_utils/filmTape/candlePass.js:489-495\`.

\*\*Repro D06:\*\* a synthetic clock charges four seconds per close-out transaction. One 100-row page performs all 100 marks, consumes \*\*400 seconds\*\* against a 300-second budget, and leaves the current tape in \`notReached\` with zero selections. In production the hosting deadline may terminate execution first; 400 seconds is a deterministic budget counterexample, not measured Firestore latency. The existing exhausted-at-entry test (\`api/\_utils/filmTape/tapeAstraReview.test.js:905\`) does not exercise crossing the reserve mid-page.

\*\*Proposed fix:\*\* recheck the deadline before each close-out, including after a page fetch. Give the sweep a separate bounded share of the run so a sustained expiry backlog cannot repeatedly consume all enrichment time; combine that with DF4's real resumption. Add an advancing-clock mid-page test.

\#\#\# DF6 — Major / CONFIRMED: equal-sized series can lose previously saved facts

\*\*Code:\*\* \`api/\_utils/filmTape/candlePass.js:224-241\` compares total minute count, then the number of non-null checks; equal counts select the fresh document. Whole-document replacement occurs at \`api/\_utils/filmTape/candlePass.js:386-404\`. Neither comparison establishes set containment of covered minutes/checks.

\*\*Repros D07 / D11:\*\* two real AAPL fetches each cover \*\*384 minutes\*\* and price \*\*24 checks\*\*, but have six-minute holes at different times. The second restores one sample and erases another: saved tick 11 at \*\*12:00:20 ET\*\*, price 100, becomes null. \`preservedFrom\` is absent. Coverage remains partial, so this is fact loss rather than a false complete label. The aggregate counts conceal the loss.

\*\*Refutation controls:\*\* C09 confirms equal minutes with fewer priced checks keeps the old series. C07 confirms a true full-data superset replaces a holey series and clears preservation. C10 confirms the label for a saved series built before a recovered check. Those requested cases pass, but equal counts are not equivalent facts.

\*\*Proposed fix:\*\* compare covered timestamp/check identities and retain the union of observed facts with provenance. At minimum, never replace an existing non-null \`atChecks\` value with null merely because another check became available. Preserve missing old buckets where the fresh fetch is not a coverage superset. Keep coherent aggregation rules when two attempts supply different minutes in one bucket.

\#\#\# DF7 — Major / CONFIRMED: completed-to-completed merges can rewind the result

\*\*Code:\*\* the transaction accepts the canonical battle block only when its lifecycle rank is strictly greater at \`api/\_utils/filmTape/writeTapeDay.js:106-113\`. Two completed blocks have equal rank; \`api/\_utils/filmTape/tapeMerge.js:321-327\` then takes the assembly's earlier completion time and independently merges final/result values.

\*\*Repro D08:\*\* stored and canonical battle show completion at \*\*16:05 ET\*\*, score \*\*46–36, win\*\*. Hand the writer a stale completed assembly from \*\*15:55 ET\*\*, score \*\*9–50, loss\*\*. Although the transaction rereads the correct canonical document, the tape changes to \*\*15:55 / 9–50 / loss\*\*. It remains \`completed\`; terminal status alone does not satisfy the requested monotonic lifecycle block.

\*\*Refutation control C11:\*\* two backfills interleaved with active-to-completed publication correctly retry the transaction and retain completed / 42\. The original active regression is fixed; the equal-stage case is not.

\*\*Proposed fix:\*\* order the entire completion block by a canonical completion identity/version, with the reread canonical block authoritative for equal lifecycle rank. For the explicitly requested earlier-timestamp case, do not replace a later stored completion with an earlier assembly. Keep status, timestamp, final and result together rather than selecting equal-state fields independently.

\#\#\# DF8 — Minor / CONFIRMED: the BA-29 backfill repair still skips a written day whose sources grew

\*\*Code:\*\* \`api/\_utils/filmTape/closePass.js:192-193\` skips any written close tape unless it owes a different completion block. It never checks whether checks, entries or other source facts grew. BA-29 explicitly names re-merging a written day whose sources grew as the repair path (\`docs/specs/FILM\_ROOM\_BUILD\_A\_TAPE\_SPEC\_V1\_2\_AMENDMENT\_A\_20260928.md:37\`).

\*\*Repro D09:\*\* write a day missing tick 10, restore that source tick, then invoke the real \`runBackfill\`. It returns \`complete: true\` and the pair in \`alreadyDone\`; the tape still contains the \`no\_record\` row. R06's direct \`writeTapeDay\` call repairs/requeues it, but that is not what the advertised admin backfill does.

\*\*Proposed fix:\*\* let backfill re-read/re-merge written days when source facts may have grown, or provide an explicit force-refresh mode with clear idempotence and budget behavior. Define candle recovery outside its retry window separately; changing close-pass skip logic alone does not authorize an out-of-window market-data retry. Do not tell the founder the current backfill is this repair path.

\#\# 4\. Checks, scope, and decisions before the flip

\#\#\# Requested adversarial cases

| Area | Executed result |  
|---|---|  
| Sweep bounds/resumption | C04 verifies 205 ordinary expiries close \*\*100 / 100 / 5\*\*, pages of 100, with current enrichment still selected. C05's mid-page failure is isolated and later repaired. C06 verifies foreign rejection, terminal rows without transactions and the failed lookback. \*\*The universal resumption claim is REFUTED\*\* by D04/D05/D12; the mid-page floor claim is REFUTED by D06 |  
| Five-part fingerprint | D01/D02/D13 change consumed values without moving the fingerprint. C01 confirms the same facts hash equally when preserved or freshly read, and a transient add/remove before publication cancels. C14 confirms facts already published are retained after source removal and still queue rebuilding |  
| Freshness and calendar counts | C07 removes six minutes, including the minute starting 10:55 ET: the \*\*11:01:20 ET\*\* sample after the halt is null and carries the stale 10:55 bar-close time; series/pass are partial. A later complete fetch clears the missing sample and restores written/complete series. C08 verifies an actual early-close pass stores \*\*21 buckets\*\*, and bars completed exactly \*\*15:55:00 ET\*\* are valid at close while \*\*15:54:59 ET\*\* is invalid (\`api/\_utils/filmTape/bars.js:97-113\`) |  
| Series preservation | C09: same minutes/fewer priced checks keeps saved data. C07: true superset replaces, with no old preservation marker. C10: saved series predating recovered tick 10 says “built before 1 check(s) were recorded.” Equal count/different identities still loses data, D07/D11 |  
| Lifecycle | C11's overlapping backfills preserve completion and exercise a transaction retry; D08's older completed assembly still rewinds the completed block |  
| Calendar/helper | C12 runs the \*\*real close writer\*\* for the Tuesday follow-up, a final day two sessions before completion, and a timeline skipping a session. Each promised final-day tape is actually written in the fixture. C16 checks the import closure and server/shared function identity |  
| Write boundary/census | C15 independently enumerates and exercises all seven physical sites, compares scanner keys and allowlist counts; C06/D05 challenge foreign sweep results. Original R01 and committed failure-path controls also pass |

The corresponding refuted failure hypotheses are bounded: an ordinary backlog does resume; one isolated transaction exception does not abort the morning; terminal rows are not transacted; a preserved fact does not change the fingerprint merely because of provenance; a genuine full-series superset replaces the older one; active-to-completed is monotone; and Tuesday's helper result is backed by a writer selection. These do not refute the distinct counterexamples in §3.

\#\#\# Seven-site census and reference construction

C15's independently derived AST census and recorded runtime stacks match exactly. The scanner sees all seven keys; the allowlist pins each at 1 (\`api/\_utils/compositionProtectedStoresAllowlist.json:318-324\`). This corrects both the old missing expiry site and the six-note human-review record.

| Physical site | Named writer / operation |  
|---|---|  
| \`api/\_utils/filmTape/writeTapeDay.js:116\` | \`writeTapeDay::set\` |  
| \`api/\_utils/filmTape/writeTapeDay.js:141\` | \`markCloseFailed::update\` |  
| \`api/\_utils/filmTape/writeTapeDay.js:147\` | \`markCloseFailed::set\` |  
| \`api/\_utils/filmTape/candlePass.js:319\` | \`markRetryWindowElapsed::update\` |  
| \`api/\_utils/filmTape/candlePass.js:404\` | \`processTape::set\` — series |  
| \`api/\_utils/filmTape/candlePass.js:405\` | \`processTape::update\` — enrichment |  
| \`api/\_utils/filmTape/candlePass.js:559\` | \`runCandlePass::update\` — thrown attempt |

The candle orchestrator validates exact path segments and a real date through \`tapeIdOf\`, then checks document/path identity through \`idOfResult\` (\`api/\_utils/filmTape/candlePass.js:95-108\`, \`api/\_utils/filmTape/candlePass.js:418-423\`). Sweep close-outs use those ids at \`api/\_utils/filmTape/candlePass.js:446-452\`. Normal selection constructs \`tapeRef\` from them at \`api/\_utils/filmTape/candlePass.js:505-509\`; processing and the thrown-attempt transaction reuse that constructed reference (\`api/\_utils/filmTape/candlePass.js:540-559\`). The expiry writer also constructs its own reference from the validated ids (\`api/\_utils/filmTape/candlePass.js:312-319\`). No foreign query reference is written on these orchestrated paths. The exported helpers rely on their caller contract; this conclusion is about the reviewed production call paths.

\#\#\# Shared calendar and the changed hub test

\*\*VERIFIED:\*\* \`src/utils/marketCalendar.js\` has zero imports. \`src/utils/tapeSchedule.js:16-17\` imports only that module and \`src/constants/filmTape.js\`, which also has zero imports. The complete closure contains no Node-only, Admin-SDK, React or browser-SDK dependency. “Dependency-free” is literally true of the calendar; the schedule has two pure local dependencies and no runtime package dependency. \`api/\_utils/marketSchedule.js:25-29\` imports/re-exports the shared objects/functions instead of duplicating them. C16 checks object/function identity. A separate native comparison across every date in 2026–2027 found \*\*0 differences in 2,190 comparisons\*\* of session lookup, previous-session lookup and holiday lookup against \`e7e527e7\`. This establishes extraction parity, not independent verification of published exchange calendars.

\*\*The Tuesday 02:21 UTC test change is a correction, not a relaxation.\*\* Monday's owning pass has ended, but Tuesday's completion-selection window starts at Monday's midnight (\`src/utils/tapeSchedule.js:103-116\`). It reselects Monday's completion and targets the final day if its tape has not recorded completion. The helper walks that same rule (\`src/utils/tapeSchedule.js:172-181\`); C12 observes the real Tuesday pass writing Monday's tape. The revised test also adds the next cutoff, Wednesday 02:20 UTC, when it becomes unavailable (\`src/utils/reviewAvailability.test.js:129-139\`). As before, pending expresses scheduled eligibility, not immunity to a runtime outage or exhausted budget. No stronger guarantee is proven.

\#\#\# Verification at the code tip

Windows, Node \*\*22.20.0\*\*, with \`TZ=UTC\` for the main suite and repro/mutation runs. Dependencies were reused through package-directory junctions; caches/build output stayed in the external review area. The sandbox blocked esbuild during the initial suite/build startup; authorized reruns outside that sandbox completed. Those startup failures are not product test results.

| Check | This review's measured result |  
|---|---|  
| Full suite | \*\*820 files / 16,322 tests: 16,207 passed, 28 failed, 87 skipped.\*\* The same 28 failing names reproduce at \`e7e527e7\` in 14 files / 168 tests (140 passed). They are Windows path/native-import/shell census failures, with no new failing-name set. \*\*This is not an all-green suite; Linux CI remains the suite of record\*\* |  
| Tape/helper/flag subset in that full run | \*\*15 files / 329 tests, all pass\*\*, including the 50 new Astra regression rows |  
| Original repros | 20 tests: 13 old-defect assertions now red at corrected behavior; seven controls/other observations pass. Assertion-only acceptance companion: \*\*19/19 pass\*\*. R18 is the separate unchanged passing dark-flag control |  
| New adversarial probes | \*\*29/29 pass\*\*: 13 observed-defect probes supporting the eight findings, and 16 controls/census/dependency probes. Passing here does not mean the eight defects are acceptable |  
| Mutants | Eight original targeted selections red; M11 original selection green, added guard selection red (eight failures). All nine requested mutations are guarded by the current suite |  
| Rules | \*\*18 files / 332 tests, all pass\*\*, on local demo-project Firestore emulator \*\*v1.20.2\*\*. CLI-requested v1.21.0 download failed; the intended version is \*\*not verified here\*\*. No production Firestore connection |  
| \`lint:gate\` | Exact gate command, exit 0 |  
| Explicit Vite build | Exit 0, \*\*14.05 s\*\*; CSS/chunk warnings remain. This does not substitute for the import-closure check above |  
| Crons | \*\*43\*\*, parsed from the snapshot's \`vercel.json\`; unchanged in the delta |  
| Fence | \`git diff \--name-only e7e527e7..124f5782\` contains \*\*none of the 11 calibration-fence files\*\* |  
| Flags/rules/indexes | Both Film Room flags remain false (\`src/config/featureFlags.js:2868\`, \`src/config/featureFlags.js:2886\`); flags, \`vercel.json\`, rules and indexes are unchanged from \`e7e527e7\` |  
| Final state | Review and restored mutant snapshots match all pinned tracked bytes. Original checkout HEAD unchanged, branch still detached, empty porcelain status |

The earlier R21 live-scoring counterexample was included because it resides in the original probe file; it still reproduces. It remains routed outside this review's remediation scope. No scoring change was made or proposed here.

\#\#\# Malformed final-day failure record and scope

\*\*\`2026-02-30\` is a hygiene issue, not a new pre-flip blocker.\*\* C13 confirms that a selected malformed final day makes \`writeTapeDay\` reject the date, and the catch path records a failure under that battle's malformed tape id (\`api/\_utils/filmTape/closePass.js:71-75\`, \`api/\_utils/filmTape/writeTapeDay.js:59-62\`, \`api/\_utils/filmTape/writeTapeDay.js:131-151\`). The record has candle status skipped / \`close\_pass\_failed\`; the candle pass does not fetch it; the helper returns unavailable without reading that invalid day. It neither crosses the battle's namespace nor invents a completed tape. With the writer dark the cron does not reach it. Reject the target before constructing the failure record as a separate hygiene change; do not confuse this with DF4's accumulated foreign pending rows.

\*\*No unrelated implementation scope widening found.\*\* The code-tip delta has 29 files; the report-only tip adds the executor report as the thirtieth changed file in the requested full delta. Production changes map to BA-23–BA-30: validation/census, freshness/replay, preservation/fingerprints, coverage/export declarations, lifecycle, shared calendar/helper, sweep, and aftermath. Fixtures, assertions, allowlist notes, the prior review and amendment support those changes. The shared server-calendar extraction affects existing callers structurally, but is expressly required by BA-28 and passed the parity comparison. The scoring bug, flags, rules, indexes, cron registration, A2 screen and fenced source are untouched. DF8 is an omitted required repair, not an authorized expansion this review is making.

\#\#\# Additional founder work before the flip

The prior reports already name normal Linux/intended-emulator gates, indexes/rules/cron deployment, read-out and first-run observation. The new decisions are:

1\. \*\*Require value-sensitive input identity and provenance for retained outputs.\*\* A complete-looking saved replay cannot count as rebuilt from a recovered check just because a retry ran. Add DF1/DF2 sequences to the flip gate.  
2\. \*\*Qualify the BA-26 limit exemption by dependency coverage.\*\* Decide and encode the proof that saved facts cover every current requirement; keep unknown new declarations visible.  
3\. \*\*Require set preservation and ordered completion publication.\*\* Count ties are insufficient for series retention, and lifecycle status rank is insufficient for two completed blocks.  
4\. \*\*Choose a genuinely resumable sweep and reserve enrichment time.\*\* Any new cursor store must receive its own BA-23/write-census review. The reported 60-session outage explanation is insufficient: the failure can occur while the sweep runs every morning.  
5\. \*\*Provide an executable repair procedure for a written tape whose sources grew\*\*, plus a distinct policy for expired candle output. The current \`alreadyDone\` result is not evidence that the day was refreshed.

These are proposed changes/decisions. No repair, rollout or flip was performed. The report is delivered outside the repository for later import under the requested \`docs/audits/20260929\_ASTRA\_DELTA\_REVIEW\_FILM\_TAPE\_A1.md\` path.

