# N1 Durable Fix — Adversarial Build Review (late-pod catch-up + missing-agent-layer detection)

**Date:** 2026-09-17 · **Branch:** `tournament/n1-durable-fix`
**Reviewed at:** `7a8b2955` (the build commit); review fixes landed as `bae5f5a7`; the mutation lens ran on `bae5f5a7`; the rows it asked for land in the same commit as this record.
**Why this record exists:** the cumulative branch diff is **17 files / ~1,400 insertions**, past the BUILD_RULES §2 **≥10 files** mandatory-review threshold. §2 requires the findings, dispositions and the CONFIRMED/REFUTED split written down in `docs/audits/` and cited from the PR. This is that record.
**What it reviews:** the fix for `docs/audits/2026-09-12_N1_MON0845_AGENT_LAYER_DISCOVERY.md` (CONFIRMED): a competitive pod reaching `battle` after the Monday duty marker got no agent layer all week and nothing noticed. Part A stamps such a pod at the completion handoff and serves it from every weekday-morning tick behind the marker; part B writes a missing agent layer down at banking and degrades an all-week-missing final; part C tests the two halves together. Task scope note: the file count is inherent (two writers + the executor + banking + the predicate + advancement + their seven test files + the two ratchets), not creep.

---

## 1. Executive verdict

| | |
|---|---|
| Review performed | **Yes — 3 adversarial lenses + an independent refuter, on 4 path-distinct snapshot trees; all completed** |
| Findings raised (lenses A + B) | **16** (A1–A9, B1–B7) |
| Refuted by the raising lens's own repro | **3** (A7, A8, A9) |
| Handed to the refuter (every CONFIRMED finding) | **12** — **12 independently confirmed, 0 refuted, 0 new** |
| CONFIRMED and fixed | **9** (A1, A2, A6, B1, B2, B3, B4, B5, B7) |
| CONFIRMED and deliberately NOT changed (disclosed, §4) | **4** (A3, A4, A5, B6 — all INFO, consistent with the duty's own posture or report-only for separate tasking) |
| Mutation lens (C) | **47 / 47 new or modified rows are genuine guards; 0 vacuous; 52 mutations; 1 equivalent mutant; 7 uncovered properties → 5 closed with rows, 2 report-only** |
| Fenced files touched (§1) | **0** (every changed path grepped against the §1 list; the only `+` line naming a fenced concept is a test comment) |
| Full suite at `7a8b2955` | exit 1 — `Test Files 1 failed \| 689 passed \| 3 skipped (693)`: the B3 deny-by-default write ratchet, reconciled in `bae5f5a7` |
| Full suite at `bae5f5a7` | exit 0 — `Test Files 690 passed \| 3 skipped (693)` |
| Full suite at the final state | see §8 |
| `vite build` (§2 requirement) | exit 0 at `7a8b2955`, at `bae5f5a7`, and at the final state |

**Nothing above LOW survived in the code.** The one MEDIUM was a test-integrity gap (B1: no row pinned that the degrade predicate reads the final banked day — a `<` mutation survived the whole suite), closed with rows the mutation lens then confirmed. The most useful CONFIRMED code finding was A1: on Tue–Fri the incumbent fan-out ran before the catch-up, so a stamped, stream-less pod false-alarmed the pre-existing "ZERO SEATS" founder-attention line and withheld the weekday marker for one tick before being served — fixed by having the fan-out leave stamped pods to the catch-up. Two candidate defects the coordinator would have believed on reading (A8: cooldowns not flowing into the same-tick catch-up; A9: the guard-less `training-pick.js` mishandling a competitive pod) were refuted by executable repro.

---

## 2. Method

**Reviewer isolation (§2):** four `git archive` extractions under the session scratchpad, path-distinct (`review/LA`, `LB`, `LR` at `7a8b2955`; `review/LC` at `bae5f5a7`), `node_modules` symlinked, the branch diff pre-rendered into each tree as `REVIEW_DIFF.patch`. Every reviewer was read-only on git and on the shared working tree (`/home/user/TradeSeven` never read or written by any lens); scratch tests and mutation copies lived inside each reviewer's own tree.

**Sequencing.** Lenses A and B ran concurrently on their own trees. Every CONFIRMED finding was then handed to the refuter (R) on a fresh tree of the reviewed sha while the coordinator applied fixes in the working tree. The mutation lens (C) ran last, on its own tree of the fix commit, one mutation at a time with a harness that refused to mutate a drifted file, printed each applied diff, restored from a byte copy and asserted `diff -q` after every run (52 runs; final `sha256sum -c` over the six targets: all OK; a post-restoration re-run of the eight suites: 442/442). Lens B and the refuter also applied mutations (B1, B5, M2/M3) inside their own trees, one at a time, each restored and md5-verified — recorded here because §2's reviewer-isolation rule is about exactly that.

| Lens | Tree | Coverage | Outcome |
|---|---|---|---|
| **A** | `LA` @ `7a8b2955` | Part A: the extraction's behavior-preservation, the catch-up's placement/semantics, marker meaning, stamp lifecycle (both writers, `transitionStatus`), clearing semantics, races, budget/pacing, time, BUILD_RULES §1/§2.3/§4/§6, the stale-comment fixes, the modified marker test | 9 findings — 1 LOW + 5 INFO CONFIRMED, 3 REFUTED by its own repro (a 9-row scratch suite driving the real tick) |
| **B** | `LB` @ `7a8b2955` | Part B: the two founder rulings arm by arm, the predicate's edges, the count, byte-identity, downstream shape safety, the three refusal logs, the cron line, the docstring, scripts/UI readers, fence and §9 | 7 findings — 1 MEDIUM, 3 LOW, 3 INFO CONFIRMED; 8 candidate defects REFUTED by repro |
| **R** | `LR` @ `7a8b2955` | Every CONFIRMED finding above, attacked independently | 12 / 12 independently confirmed with repro output; 0 refuted; 0 new |
| **C** | `LC` @ `bae5f5a7` | Every new or modified test row, mutation-checked | 47 / 47 guards; 0 vacuous; 7 uncovered properties |

---

## 3. Findings, dispositions, CONFIRMED / REFUTED

### Lens A — the catch-up and the stamp

| # | Severity | Finding | Refuter | Disposition |
|---|---|---|---|---|
| **A1** | **LOW** | Tue–Fri: the weekday duty ran before the catch-up, so a stamped stream-less pod first tripped `fanOutDeploys`' "ZERO SEATS … Founder attention" error and withheld the weekday marker for that tick; the catch-up served it seconds later and the next tick set the marker. The line's "(the Monday pipeline is its only writer)" was now stale. Reproduced: tick 1 `complete:false, emptySeats:1`, exactly one ZERO SEATS line, no marker; tick 2 marker set. | CONFIRMED | **FIXED.** `runWeekdayFanout` leaves a pod stamped `agentPipelinePending` to the catch-up (counted as `pendingCatchUp`, one log line, still counted in `groups` so the tick never reads zero groups; never a marker input). The ZERO SEATS line names both writers. Rows: the Tue–Fri tick row now asserts `complete:true` and no ZERO SEATS line; a fan-out unit row proves the stamped pod is skipped and an UNSTAMPED stream-less pod still trips ZERO SEATS. Mutation-confirmed (C: M8 fails both). |
| **A2** | INFO | `morningTick` keyed on the ROUTED duty, not the forced one: a run-duty `forceDuty` on a non-morning instant ran the duty but never the catch-up (forced MONDAY_PIPELINE served the pod via the BATTLE fetch but left the stamp set until the next real morning tick). | CONFIRMED | **FIXED.** A morning tick is one routed to a morning duty OR forced to one — run-duty is the documented manual recovery lever (audit §4.3) and must serve and clear a stamped pod as the cron would. Row: a forced Monday duty on a Thursday evening clears the stamp in the same call. Mutation-confirmed (C: dropping the forced term fails it). |
| **A3** | INFO | The stamp is per-group state, not `sim:`-namespaced like markers: a `simulated:true` run serves a real stamped pod with the sim clock and clears it with the sim instant. | CONFIRMED | **NOT CHANGED — disclosed.** Identical to the pre-existing sim posture: a simulated duty already re-drives every real BATTLE group with the sim clock (the audit's §4.3 "sharp edge" and the recovery lever); only duty markers are namespaced. No new risk class; stated in the PR for the operator of `run-duty`. |
| **A4** | INFO | On `battleCreated:false` (a casual battle blocks the agent) the catch-up re-sends that seat once in the same tick, is refused again, then clears the stamp; the next weekday duty serves it via the drafted-six fallback. One extra POST; `decide.js`' prescribed path reaches its one-active-battle check with no model call in between. | CONFIRMED | **NOT CHANGED.** Byte-identical to the duty's own `isDutySatisfied` criteria (`skipped` is done work). |
| **A5** | INFO | A `refused_synthetic` stamped pod stays pending forever, loudly: every weekday-morning tick logs REFUSING + NOT caught up; boards persisted once, then skip-path reads; no draft, no deploy, stamp kept. | CONFIRMED | **NOT CHANGED.** A genuine founder-attention condition (a human seat with no ranked agent), bounded per tick, louder than pre-fix (the Monday duty only retried Monday morning). A1's fix removed the extra ZERO SEATS line it used to add each Tue–Fri tick. |
| **A6** | INFO (prose) | The wrapper's and the catch-up's comments said "every weekday-morning exit"; the zero-groups and unknown-duty exits are not wrapped. The sub-claim that a stamped pod can never produce a zero-groups exit was VERIFIED (both morning duties fetch BATTLE with byte-identical arguments; a forced FRIDAY_ADVANCEMENT counts BATTLE groups too). | CONFIRMED | **FIXED** (prose): both comments now state the exact exits wrapped and why the zero-groups exit is safely skipped. |
| A7 | — | "The catch-up can exceed the 300 s ceiling." | — | **REFUTED by Lens A:** the per-pod budget check is byte-for-byte the posture of `runMondayPipeline` and `sweepTrainingActivation`; a mid-flight kill is recoverable (stamp kept, per-member boards, transactional stream, today's-battle guard). The 'tick budget bounds it' row covers the defer-with-stamp path. |
| A8 | — | "Cooldowns written by the duty do not flow into the same tick's catch-up." | — | **REFUTED by Lens A (repro):** `setDeployCooldown` mirrors into the shared `state` object the tick passes to both; a same-tick flip with one failed duty deploy gives the catch-up `cooled:1`, four fetches total, stamp kept. |
| A9 | — | "A competitive pod completing via the guard-less `training-pick.js` is mishandled by the stamp." | — | **REFUTED by Lens A (repro):** `computeHandoffWrites` with no overrides yields BATTLE + stamp pre-open on a trading day and AWAITING_OPEN + no stamp after the open — the stamp does the right thing on the wrong endpoint; the endpoint's missing mode guard is pre-existing and documented. |

### Lens B — banking detection and the predicate

| # | Severity | Finding | Refuter | Disposition |
|---|---|---|---|---|
| **B1** | **MEDIUM** (test integrity) | Nothing locked that `seatsMissingAgentLayerAllWeek` includes the FINAL banked day: mutating `n <= dayN` → `n < dayN` passed all 268 tests in the three suites. Under that mutation a seat missing days 1–4 and present on day 5 (the agent layer arriving Friday — the founder's "some days → proceeds" case) would read degraded and the lock would be refused. | CONFIRMED (268/268 under the mutation, re-run independently) | **FIXED** (rows; the code was already correct): a predicate row (missing 1–4, present 5 → `[]`, not degraded; last-day-only → `[]`) and a banking `bankWeek` row (`[NO_U4×4, FULL]` → count 4, not degraded). Mutation-confirmed (C: M11b fails both). |
| **B2** | LOW | A gap in the day keys under-blocked: an absent `dayN` was read as "nobody missing that day", so a seat listed on every EXISTING banked day read NOT degraded while `isWeekBanked` was true and the Friday duty locked — contradicting the §7.2 principle the predicate cites (permitting is unrecoverable, over-blocking is not). Only reachable by manual doc surgery (banking derives `dayN = max + 1`). Also the cron line's "k of N banked day(s)" printed `dayN`, an index. | CONFIRMED | **FIXED.** An absent day is skipped, never read as clean (docstring says a deleted day is not a banked day); the cron clause now reads "`agentLayerMissingDays` is now k (through dayN)". Row: gap in day keys → still degraded. Mutation-confirmed (C: M11c). |
| **B3** | LOW | The cron line said "agentPoints banked 0 for the composite" unconditionally; under the pre-existing per-owner carry arm the seat banks the CARRY (the per-seat warning already said "as the carry"). | CONFIRMED | **FIXED:** "0 for the composite (or the prior carry where agentScoresCarried)"; the cron-line row asserts the clause. |
| **B4** | INFO | `agentLayerMissingDays` is write-only (no reader anywhere), derived at bank time, cannot refresh after the week clamps, so a manual edit of a day listing leaves it stale. The ratified `dailyScores` shape comment did not name the N1 fields (and already omitted `recordedDate` / `agentScoresCarried` — pre-existing drift). | CONFIRMED | **FIXED** (documentation): the shape comment names the N1 fields and the stamp; the predicate docstring calls the count a bank-time breadcrumb that nothing gates on and that may lag a manual edit. No reader added (scope). |
| **B5** | LOW | `degradeReason`'s carried arm was unguarded: mutating it to the UNCLAMPED read passed all 268 tests; on a day5-carried / day8-clean zombie the refusal would have said "unspecified". | CONFIRMED (268/268 under the mutation, re-run independently) | **FIXED** (row): day5 carried + day6–8 clean → the line says `agentScoresCarried`, never "unspecified". Mutation-confirmed (C: M13b). |
| **B6** | INFO (report-only, §3) | Readers now mislabel the widened predicate: `scripts/lc-fork-adjudication.js` prints "(day-5-carried ⇒ paused …)" for an all-week-missing pod; `scripts/n1-stranded-precheck.js`' header comment ("a never-created layer does not pause the week") is now false at HEAD (its verdict logic is unaffected); `src/screens/TournamentDevScreen.jsx` shows only "AGENT LAYER CARRIED". | CONFIRMED | **NOT CHANGED — separate tasking** (BUILD_RULES §3; none is in this task's scope). Listed in the PR. |
| **B7** | INFO | The refusal log names the seats but nothing said what an operator clears to resolve an all-week refusal; the advancement test modeled it as deleting one day's listing. | CONFIRMED | **FIXED** (documentation): the predicate docstring states the manual-review resolution (remove the seat from at least one banked day's `agentLayerMissing`; the carry arm's analogue is clearing the final day's `agentScoresCarried`), and that the count is not recomputed by it. |

**Lens B's own refutations (8):** CPU seats owning no battles (refuted by production evidence — the 2026-08-17 pod had 20/20 battles incl. its CPUs, and the orchestrator deploys CPU seats); an off-by-one in the count loop (refuted: `[FULL, NO_U4, FULL, NO_U4, FULL]` → `[0,1,1,2,2]`); a mid-week consumer acting on the truthy predicate (refuted: all three advancement sites sit behind `isWeekBanked`; only the adjudication script prints it); listing under the carry arm changing §7.2 semantics (refuted: carry values unchanged, day-5-absent still degrades via the carry arm only); `bankGroup`'s widened return breaking a caller (refuted: the cron reads five keys; the manual endpoint's test uses `toMatchObject`; the dev screen reads four); the new array tripping a key-iterating reader (refuted: none iterates a day entry's own keys); the skip paths making the cron guard unsafe (refuted); training pods changed (refuted).

---

## 4. Mutation lens (C) — every new or modified row is a guard

Baseline 442/442 across the eight suites; 52 mutations, one at a time, restored and hash-verified. Highlights, by what the mutation would have shipped:

| Mutation (the defect it models) | Rows that failed |
|---|---|
| The catch-up never runs (`withPendingCatchUp` returns the result unconditionally) | 6, incl. the modified marker row ("expected 8 calls, got 4") |
| The catch-up ignores the stamp (serves every BATTLE pod) | 4, incl. 'a BATTLE pod WITHOUT the stamp is untouched' |
| The catch-up serves training pods (drop `excludeTraining`) | 'a stamped TRAINING pod is never served here' |
| The stamp clears unconditionally / `isAgentLayerCaughtUp` drops `failed`, `cooled`, `deferred`, `emptySeats` (one at a time) | 'a FAILED catch-up keeps the stamp' + the `isAgentLayerCaughtUp` rows |
| The inline handoff never stamps / stamps training / stamps AWAITING_OPEN | 3 / 1 / 2 rows across trainingLifecycle + liveDraftLifecycle |
| The flip never stamps / stamps training | 2 (incl. the e2e capstone) / 1 |
| The fan-out no longer leaves stamped pods alone | 2 |
| The extraction's fold-back maps `deploy_deferred_market_closed` → errors, `refused_synthetic` → errors | the pre-existing holiday-Monday and both SYNTHETIC REFUSAL rows |
| Banking never lists / lists training / lists on a null read / doesn't count today / writes the count when 0 / drops the warn line / presence-becomes-falsy (`!agentScores[id]`, the audit's `\|\| 0` defect) / always writes `agentLayerMissing: []` | 8 / 1 / 2 / 6 / 2 / 1 / 9 / 7 |
| Predicate returns `[]` always / `<` (B1) / absent-day-as-clean (B2) / unclamped read / union instead of intersect / drop the all-week arm / drop the carry arm / drop the null guard | 6 / 2 / 1 / 1 / 7 / 5 / 4 / 3 |
| `isAgentPipelinePending` truthy / the stamp drops its timestamp | 1 / 7 (the fixture asserts the literal instant independently of the helper — not a tautology) |
| `degradeReason` constant / unclamped carried arm (B5) / all three gates carried-only | 2 / 1 / 1 |
| The marker check removed (`isDutyComplete` always false) | 7, incl. the modified marker row at `status === 'already_complete'` — it still proves marker suppression |

**Equivalent mutant (not a gap):** dropping `n <= WEEK_DAYS_REQUIRED` from the count loop — dead defensive code, since `computeBankingUpdate` clamps at `dayN ≥ WEEK_DAYS_REQUIRED` before the loop.

**Uncovered properties C reported, and what was done:**

| # | Property | Disposition |
|---|---|---|
| U1 | `transitionStatus` spreads `extraFields` first so `status`/`updatedAt` cannot be overridden (the comment claimed it; no caller passes them). | **Row added** (`tournamentGroupService.test.js`). |
| **U2** (moderate) | The Monday fold-back's `errors++` arm for `board_errors` / `acquisition_conflict` / `held_count` / `stream_missing` — the input `isDutySatisfied` withholds the marker on. Inherited gap (the inline code had no row either), but the extraction is exactly where a mapping error enters. | **Row added:** a BATTLE group with a corrupted no-picks agent-draft stream → the already-resolved path returns `acquisition_conflict` → `errors:1, drafted:0, complete:false`, no marker, no deploy. Deterministic, no mock. |
| **U3** (moderate) | The BASE-LAYER Friday refusal had no degraded row on either arm (every prior row was bracket-only). | **Row added:** a base-layer group listed all week → `degradedLocks:1`, status BATTLE, no rank applied, the line names `base-layer group` and the seat. |
| U4 | The catch-up's dev-group exclusion was guarded only by the p4Flips source-text count. | **Row added:** a stamped dev pod is invisible to a production `runPendingPodCatchUp` and served with `includeDevGroups: true`. |
| U5 | `stream_missing` still counts `drafted++` (preserves the pre-refactor counter; practically unreachable — the stream is written one call earlier). | Report only. |
| U6 | `runWeekSideEffects`' degraded-snapshot log line under the N1 arm (log only, reached only by a pre-§7.2 lock resumed via the sweep). | Report only. |
| U7 | A NON-morning duty forced on a morning-routed instant (run-duty `forceDuty=FRIDAY_ADVANCEMENT` at Mon 07:00) still runs the catch-up. | Report only — intended: the cron would run the catch-up on that instant regardless of what a dev click forces; the comment's "routed to a morning duty OR forced to one" describes it. |
| U8 | "Own catch so it never blocks the duty" — a throwing catch-up was not exercised. | **Row added:** every `tournamentGroups` status query throws on the second tick → the tick still returns `already_complete`, one "late-pod catch-up failed" line, stamp untouched. |

The five added rows ran green in the working tree (orchestrator 80, advancement 34, groupService 30). They were not re-mutation-checked by a fresh lens run; each is a direct, single-mechanism assertion of the property the lens named, and that is disclosed here rather than claimed.

---

## 5. Rules compliance — clean verdicts on record

| Rule | Verdict | Evidence |
|---|---|---|
| **§1 calibration fence** | **CLEAN** | Zero of the 11 fenced files in the diff (coordinator grep of every changed path; Lens A grep of the patch for every fenced filename and for `createAgentBattle` / scoring concepts: the only `+` hit is a test comment). Fenced function **called**, unchanged: `flattenPortfolioServer` (pre-existing read-only import). None edited. |
| **§2.3 import ratchet** | CLEAN | No new direct importer of `agentArchetypeConfig.js` / `archetypeScoring.js` (`trainingLifecycle.js`' importer pre-exists). |
| **§4 import rule** | **PERMITTED** | Every new `api/` → `src/` import is from the zero-import schema module `leagueTournament.js`; the dependency-surface guards (each suite's real import of its module) are intact and no touched suite mocks the module under test. |
| **§6 cron** | CLEAN | `vercel.json` untouched (39/40); the catch-up rides the existing orchestrator entry. Crons do not run on preview — verification is the batteries above plus the first production Monday. |
| **§9 display-agreement** | **CLEAN by construction** | The count and the predicate read the same `dailyScores[dayN].agentLayerMissing` arrays under the same `Array.isArray` guard; the refusal log's reason and the gate read the same clamped final. |
| **B3 deny-by-default write ratchet** | **RECONCILED** | Two new keys — the stamp-clearing `.update()` (unresolved through the imported collection constant, like the `bankGroup` sibling) and its single call site in the tick closure — with a human-review note in `compositionProtectedStoresAllowlist.json`; count 1 on the call site is load-bearing (the cron tick is the catch-up's only executor). |
| **p4Flips includeDevGroups count** | 3 → 4, honest | The fourth site threads `includeDev: includeDevGroups`; the regex counts only threaded sites, so the guard's strength is unchanged (Lens A); U4 adds the behavioral guard. |
| **Stale comments (task §2C, audit O1)** | CLEAN | Lens A verified both rewrites against `flipAwaitingOpenPods` (no `isTraining` filter; competitive slot pods flip there) and `sweepIdleDraftingPods` (`isTraining === true` filter). |

---

## 6. Accepted limits — what was deliberately NOT changed

- **A3 — simulated runs touch real stamps.** A `simulated:true` tick serves a real stamped pod with the sim clock. This is the pre-existing sim posture for every duty (only markers are namespaced) and is the same lever the audit documents as the manual recovery path; narrowing it is a founder decision about `run-duty`, not this fix.
- **A4 / A5 — done-work semantics.** `battleCreated:false` clears the stamp (one extra POST, no model call); `refused_synthetic` keeps it forever and loudly. Both mirror the Monday duty's own criteria; diverging would give the catch-up a second definition of "done".
- **B6 — readers that now mislabel the predicate.** Two scripts' comments/labels and the dev screen's "AGENT LAYER CARRIED" chip describe only the carry arm. None affects a verdict or a write; all are outside this task and are listed in the PR for separate tasking.
- **B4 — `agentLayerMissingDays` has no reader.** It is the founder-ruled "count on the group" and is written as a bank-time breadcrumb; giving it a reader (the dev screen, the adjudication script) is a separate task.
- **The three `errors++` arms beyond `acquisition_conflict`** (`board_errors`, `held_count`, `stream_missing`) remain reading-verified only, as they were before the refactor: driving them needs module-internal mocks the suite's posture avoids. The U2 row covers the fold-back mapping through the one deterministic arm.

## 7. Residual risk

| Risk | Severity | Notes |
|---|---|---|
| A pod flipping to BATTLE between the duty's fetch and the catch-up's fetch inside one tick | Very low | Served on the next tick (10 min); the stamp is durable. |
| Firestore admin-SDK acceptance of a string array inside a dot-path map value (`dailyScores.dayN.agentLayerMissing`) | Very low | Assumed from documented semantics; `firestore.rules` has no `dailyScores` shape rule. Not executed against an emulator. |
| A pre-deploy Monday (a pod flipped and banked before its first deploy) now records day 1 as a missing day | Low, by design | One such day is a warning, not a degrade — the founder's "some days" ruling; the docstring says so. |
| `scripts/` lint errors (`no-unused-vars` ×3 in touched test files) | None (pre-existing) | All three pre-exist on `main`; none introduced here; flagged in the PR per §3. |

## 8. Verification

| Commit | `npm run test:run` | `vite build` |
|---|---|---|
| `7a8b2955` (build) | exit 1 — `Test Files 1 failed \| 689 passed \| 3 skipped (693)` — the B3 write ratchet (two unlisted sites), reconciled in the next commit | exit 0 |
| `bae5f5a7` (review fixes) | exit 0 — `Test Files 690 passed \| 3 skipped (693)` | exit 0 |
| final state (this record + the §4 rows) | exit 0 — `Test Files 690 passed \| 3 skipped (693)`; `Tests  13499 passed \| 64 skipped (13563)` | exit 0 |

`git diff --stat main` at the final state: 17 files, zero fenced.

## 9. Provenance

Lens scratch artifacts remain in the session scratchpad trees (`review/LA/api/_utils/lensA.repro.test.js`, `review/LB/api/_utils/__lensB_*.test.js`, `review/LR/api/_utils/__lensR_*.scratch.test.js`, `review/LC/_lensC_*`) and are not committed; every finding above carries the command and result the lens reported, and the refuter's independent repro. No lens touched the working tree or ran git.
