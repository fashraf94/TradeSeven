# Build report: the ID-1 activation observer, Astra's pre-flip review fixes

**Date:** 6 November 2026. **Executor:** Claude Code (Opus 5.5), own worktree, no advisor (as the prompt says). **Branch:** `claude/activation-observer-review-fixes` (pushed by refspec from the app worktree's local branch `claude/activation-observer-review-fixes-7f5c1a`), cut from `origin/main` at `18d84ada` (the PR #1026 merge). **Contract:** `docs/design/20261106_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_9.md`, committed byte-identical by this PR (SHA-256 `031ca8203e39c35ac38700336d048c7a0d71f2b6c63afd7ee303c636a6c76bd9`, 36,273 bytes, LF); V1.7 and V1.8 stay beside it. **Prompt:** "Fix Prompt: ID-1 Activation Observer — Astra's pre-flip review" (Fable, 6 Nov). **The observer's build report:** `docs/audits/20261104_BUILD_ACTIVATION_OBSERVER.md`.

## 1. In plain terms

Astra read the merged observer before its switch is turned on and found five problems: two that could make it do the wrong thing on a busy night (one could let ordinary work use up the night's writes while a finalisation call was still running; one could let a slow battle keep the others from being looked at), one where the census could mistake a failed read for "nothing there", one where a malformed position id could slip past a check, and one where the census could print a stored string it should not. She also noted that the observer leaned on another module to check who owns a casual clone's parent. This PR fixes all of them, adds a "pointer integrity" section to the census so a wrong or late pointer shows up as a count, and makes each run of the observer log one line of counts, so the first hour after the switch can be read in Vercel.

**Nothing runs yet.** `ACTIVATION_EVIDENCE_ENABLED` stays `false`; with it off the observer returns before any read and logs nothing, and the cron's response is byte-identical (the host test checks both). No Firestore rule, index, cron line, cap, reserve or pointer field changed.

| Question | Answer |
|---|---|
| Are the five findings fixed? | Yes, each with its own row, and each fix's reversal is caught by that row (§8). |
| The owner check and `gameMode: null`? | The observer now checks the owner ids itself (V1.9 §2); `casualClone.js` is unchanged. `gameMode: null` is kept as built and now pinned. |
| What does the census add? | Pointer integrity: identity, evidence, shape, timeliness, counts only (§4). A failed read is never counted as "nothing there"; every label from stored data is on a list or printed as `other`. |
| The health line? | One `[activationEvidence] {…}` line per run that did not skip; counts only, no id, no symbol (§5). |
| Independent review | Two lenses on their own trees (A the tenant, B the record and the census), then a refuting verifier per lens: 15 findings; the 11 verified were 10 confirmed and 1 partly confirmed, none refuted. All acted on: fixed with rows, or (PFA-4, PFA-5, PFB-5) carried to you as questions (§9). |
| Mutants | 26 distinct mutants over three batches (29 plantings): every one that reverses a fix or removes a guard is killed by its own row; one is equivalent (§8). |
| Runs | Linux full suite, `test:rules` with the emulator, `lint:gate`, `vite build`, golden guard: §10. |
| What you need to do | Nothing to deploy for this PR (no rules, no index). Before the flip, the checklist in §11. |
| Questions | Three, none blocking (§12). |

## 2. Preamble

- `git fetch origin main` ran first: `origin/main` = `18d84adaa3119fe3f8ef4b8cc81cc2c7527f04f3` (the PR #1026 merge). The worktree's HEAD was the same commit, clean, on `claude/activation-observer-review-fixes-7f5c1a` (the app's suffix; pushed by refspec to the prompt's name). Fetched again before the final runs: unchanged, so the PR tree is the branch tree.
- `docs/BUILD_RULES.md` was read in full, then the V1.9 contract, the prompt, and the observer's code and build report.
- **Astra's reply itself was not attached to this session as a file** (the Downloads folder holds the V1.9 contract and earlier Astra reviews, not this one). The build works from the prompt's statement of each finding, which gives the file, line and fix for every one; nothing in the code contradicted that statement.
- No advisor (the prompt's instruction). No production read, no provider call, no deploy.

## 3. The findings, the fixes and the rows

Line numbers are at the code head `fb2f2fd7`.

| Finding (Astra, 6 Nov) | Fix | Rows (unit · emulator) |
|---|---|---|
| **1 (P2) Due-first under in-flight calls.** After admission every key without a result was marked settled, in flight or not (`tenant.js:474` at base), so ordinary writes could take the cap while a due call was running. | `tenant.js:482` `startedIds`; after admission only a key never started settles (`:583-587`); a started key settles when its own call ends (`applyResult`, `:485-503`). V1.9 §4.2. A due key carried from the state also holds ordinary writes while unsettled (`:505`, `:523`; review PFA-5). | Emulator "V1.9 review 1": two due keys acquired, the second returning after the first provider return (the interleaving TN17 misses), with 36 ordinary pointers' evidence in hand: no ordinary transaction starts while either is in flight; all six due pointers written; 30 transactions, 12 `write_cap`. "PFA-5": a carried due key holds them too. |
| **2 (P2) Battle cursors.** Each cursor moved past every battle in a batch before any was prepared (`tenant.js:201` at base), so one slow battle at the head of a batch could keep the rest of it unread for a whole rotation. | `tenant.js:274-280` `held`/`pass`; the per-battle body in `try … finally` (`:296-366`): a battle passes its cursor only when its own preparation was attempted (its pointer read, or a decision from its document alone); a battle the budget refused (`:324`) holds its queue's cursor for the rest of the run; a batch read that fails as a whole passes its members (`:292`); an unseen battle not reached stays unseen (`:365`, review PFA-1). The key cursors already followed the rule (set as a call starts, `:563-566`; admission stops for every key at once), and a row now shows it. V1.9 §4.3. | Emulator "V1.9 review 2": five due battles, the first failing slowly past `PREP_BUDGET_MS`: run 1 holds the cursor at `d-0`, run 2 writes the other four's 24 pointers and retries `d-0`, run 3 reads only `d-0` (the four finished), `d-0` attempted all three runs. A failed batch read passes its five members, not the unread chunk. The key cursors: four calls started, the next run's first call is the fifth key. "PFA-1", "PFA-2" (two guards). |
| **3 (P2) Census read failures.** A failed claims or finals read put every key under "never attempted"; a failed pointer read counted the battle's activations as unwritten. | `scripts/census-activation-evidence.mjs:358-363`: `read_failed`, first in the precedence; "never attempted" only when both reads succeeded. `:263-305`: a failed pointer read makes the battle's coverage unknown (`activations.coverageUnknown`), never written, outstanding or abandoned, and out of both sides of the headline. Failed cohort and newest-session reads are counted (`cohort.readFailed`, `finals.readFailed`); a failed integrity snapshot read is `readFailed`, never a mismatch or an absence. | Unit "review 3" (claims and finals failures; a pointer failure, also past the horizon and on a gap battle); emulator "the census on the emulator … review 3" through the real Admin SDK. |
| **4 (P3) String position ids.** A number or a boolean passed the id pattern through `String()` and read as absent elsewhere, so a corrected battle's lifetime could get a fallback id. | `lifetimes.js:90` `positionIdFieldOk`; `:179-180` every row's two id fields and the live position's id are a string or absent before any other check; `:214` the route check reads `typeof` and never coerces. `undefined` and `null` stay "absent" (the legacy route's no-id; §6). V1.9 §4, §4.1. | Unit "V1.9: a position id must be a string" (20 rows: five shapes × 123, true, false, 0; plus the two shapes only the up-front check sees, review PFB-2); emulator "V1.9 review 4" (four shapes, real battles, no pointer in the slot, the other five written). |
| **5 (P3) Census labels.** Bucket labels were taken from stored strings. | `census-activation-evidence.mjs:83` `labelOf`: on its list in `constants.js` (`POINTER_KINDS`, `MISSING_DETAILS`, `ATTRIBUTION_STATUSES`, `ACTIVATING_TICK_SOURCES`, `ACTIVATED_AT_SOURCES`, `BARS_CLASSES`), else `other`, absent `none`. `constants.test.js` pins `MISSING_DETAILS` to every retryable reason the store can return (review PFB-6). | Unit "review 5" (sentinels in `missing.detail`, `activatedAtSource`, `attributionStatus`, `activatingTick.source`, `kind` and the bars class: `other`, never echoed on the Markdown, JSON or stdout); emulator census row (sentinels written into real pointers). |
| **Owner check** (V1.9 §2; note on `casualClone.js:317`). The resolver compares two `ownerId` fields, so two absent ids compare equal. | `attribution.js:91-105`: a parent the resolver returns is accepted only when the clone's `ownerId` is a non-empty string equal to the battle's and the parent's a non-empty string equal to the clone's, from the two documents the resolver read through the budgeted handle (only their owner ids are kept). Otherwise `unresolved`. `ownerId` was already in `BATTLE_FIELDS`. `casualClone.js` unchanged. | Unit `attribution.test.js` (seven ways to fail, a healthy clone; the attribution rows now give the battle its `ownerId`, as the tenant does); `attribution.ownerCheck.test.js` (a resolver that would accept any parent: each clause refused on its own, review PFB-4); emulator "V1.9 §2" (five cases through the real resolver). |
| **`gameMode: null`** (note). | Kept as built (explicit `null` in scope, `stream.gameMode` `null`), now in V1.9 §2. | `scope.test.js:18` (already there); `pointer.test.js` (new); emulator "gameMode null". |

## 4. What the census adds: pointer integrity

A new section 7 of the report, over the cohort's written pointers of every battle whose pointer read succeeded, counts only:

- **Identity.** From the battle document (fields fixed at creation), for every pointer: `battleId`, `battleAgentId`, `archetype`, `stream.clone`, `stream.gameMode` (added on review PFB-7). From the retained rows, where they still hold the pointer's lifetime: `activationId`, `kind`, `symbol`, `tier`, `slot`, `activatedAt`, `activatedAtSource`, `asOf` (`lastCompletedSessionAt`) and `firstTradingDay`, with the pure modules. One reading of the contract is built in (review PFB-1, §6): a corrected starting position's pointer written while it was held says `position_swappedInAt`, and after the sale the same lifetime reads `outgoing_receipt`; the held reading is accepted after the sale, never the other way.
- **Evidence.** For a pointer with an entry, the snapshot `snapshotRef` names is read (field-masked: `schemaVersion`, `key`, `entry`, `capturedAt`) and counted by field: absent, key (session, symbol, or a `snapshotRef` its own fields do not name), rule set, `entry` not deep-equal, `anchorSwingLow`, `evidenceTiming`. For a null pointer, whether its key's snapshot exists now (allowed by the contract; reported).
- **Shape.** The exact field set (`POINTER_FIELD_SET`, pinned to what `buildPointer` writes), `schemaVersion: 1`, `activatingTick.evaluationId` always `null`, `missing` `null` exactly when `entry` is not, `snapshotRef` with the entry, and the attribution rules both ways (`unresolved` only on a casual clone and on the clone's own id; `resolved` never on a clone's own id, a ranked battle never to another agent; the status on its list), and `stream.attributionAgentId`.
- **Timeliness.** Distributions of `observedAt − activatedAt` (pointers with evidence) and `observedAt −` the battle's cutoff (null pointers), with counts of null pointers observed before the cutoff or with none.

The report prints the field mismatches and the number of pointers with any. To check exact field sets the pointer query reads whole documents: the restricted reader's one unmasked read, pinned to that call; nothing from a pointer reaches the result. The census still never calls the resolver, writes nothing, and imports pure modules only (one more: `src/constants/leagueTournament.js`, for `isCasualCloneId`, a module with no imports). The purity pin now refuses any `.set(` but the two Map calls, whatever its receiver (review PFB-3). An owner listed twice is one owner (review PFB-8).

Rows: correct pointers built with the real `buildPointer` over the store's own snapshots → zero mismatches; one wrong field of each kind (31 cases) → counted under that field, in one pointer; a snapshot read that fails is never a mismatch; and on the emulator, the pointers the real observer wrote (with evidence, a null one at finalisation, a swap-in with its tick, and a starting position sold after its pointer was written) → zero mismatches.

## 5. The health line

After each run that did not skip, `tenant.js` logs one line. Its shape, with the counts the emulator health row asserts for its run:

```
[activationEvidence] {"battles":{"read":2,"due":0,"unseen":2,"ordinary":0},"acquisitions":{"started":7,"final":7,"pending":0,"retryable":0,"excluded":0,"threw":{}},"pointers":{"withEvidence":7,"null":0},"deferred":{"write_cap":0,"prep_cut":6,"not_reached":0,"attribution_read_error":0},"truncations":{"candidates":0,"ticks":0},"failures":{"pointers:other":1},"stateWritten":true}
```

(That row plants sentinel ids in every document and a sentinel error code, and checks none reaches the line.) The four named deferrals show even at zero; other deferral reasons appear as they occur. Every key is a literal of the observer's modules, a stage on a fixed list, or an error code through `codeLabelOf` (a gRPC number, a lower-case status name, an error class name, a Node errno, else `other`). A run deferred for budget logs the same shape with `no_budget: 1`; a run that throws logs `failures: {"run:<code>": 1}` before the error reaches the host's isolating catch (review PFA-7). With the flag off nothing is logged: the host test captures the flag-off cron's own log lines and finds none with the prefix, and the response is the base's string byte for byte.

## 6. Decisions and readings

1. **`null` position ids read as absent** (fix 4). The prompt says "any non-string". `undefined` and `null` both mean "no id" here: the legacy route writes none, and on a corrected battle a `null` id already fails the route check (`present !== corrected`), so only a legacy battle could differ, and no writer stores an explicit `null` (`stockThresholdAdmission.js:270` writes the outgoing position's stamped id). Every other non-string fails the slot. Question Q1.
2. **The battle cursor's "attempted"** (fix 2). A battle is attempted when its own first read starts (the pointer read) or when it is decided from its document alone; one the budget refused before its first own read is not. A queue's cursor stops at its first battle not reached for the rest of the run, so a battle decided later from its document cannot pass it (review PFA-2). A casual clone whose pointer read ran but whose attribution read the budget refused is attempted, so it is passed (question Q2: the other reading lets one slow casual clone pin its cursor).
3. **"Any due key"** (fix 1, review PFA-5). The letter of V1.9 §4.2 covers a key carried from the state whose `dueAt` has passed, though it has no pointer to write this run: it holds ordinary writes too (built to the letter; the narrower reading is question Q3). The cost, which V1.9 chose: ordinary evidence already in hand can wait behind a slow due call until the write reserve stops it; it is written by the next run, never lost (a row shows it).
4. **The census's integrity identity, by state** (review PFB-1). `activatedAtSource` of a corrected starting position depends on whether the slot still holds it (contract §4.1's table; "Stability" fixes the id and the instant, not the source). A pointer is created once, while the position is usually still held, so after a sale the census accepts the held reading. Without this, every real corrected battle that sold a starting position would have shown a false mismatch.
5. **The health line on a budget deferral and a throw.** "After each run that did not skip": both are runs that did not skip, so both log a line.

## 7. Tests and where they run

| File | Runner | New rows |
|---|---|---|
| `api/_utils/activationEvidence/lifetimes.test.js` | unit | 25 (fix 4) |
| `api/_utils/activationEvidence/attribution.test.js` | unit | 8 (owner check) |
| `api/_utils/activationEvidence/attribution.ownerCheck.test.js` (new) | unit | 6 |
| `api/_utils/activationEvidence/pointer.test.js` | unit | 1 (`gameMode: null`) |
| `api/_utils/activationEvidence/constants.test.js` | unit | 3 (label lists, field set) |
| `api/_utils/activationEvidence/tenant.health.test.js` (new) | unit | 7 |
| `api/cron/process-pending-reflections.activationEvidence.test.js` | unit | the three flag-off rows also check the logs |
| `scripts/census-activation-evidence.test.js` | unit | 41 (52 rows now, 11 at base) |
| `test/rules/activationObserver.rules.mjs` | `npm run test:rules` (emulator, real Admin SDK) | 21 (was 49 rows; now 70) |

## 8. Mutants

Each planted on a committed head, judged by the vitest exit code, restored from the committed LF blob and proved by hash (`git hash-object --no-filters` equal to `HEAD:<path>`). Batch 1 at `36f5bc68` (14 mutants), batch 2 at `9d88f574` (7), batch 3 at `fb2f2fd7` (8, M1 and M2 again on the final tenant). Runner and results: the session scratchpad (`mut/spec*.json`, `mut/results-*.json`).

| Id | Planted | Killed by |
|---|---|---|
| M1 | fix 1 reversed (every key without a result settled after admission) — batches 1 and 3 | emulator "V1.9 review 1" |
| M2 | fix 2 reversed (a battle the budget refused is passed) — batches 1 and 3 | emulator "V1.9 review 2" (five due battles) |
| M2b | a failed batch read no longer passes its members | TN11; "V1.9 review 2" batch row |
| M2c | the held guard removed | emulator "PFA-2" (held guard) |
| M2f | the unseen guard removed | emulator "PFA-2" (unseen) |
| MA1 | an unseen battle not reached keeps its index entry | emulator "PFA-1" |
| MA5 | a carried due key no longer holds ordinary writes | emulator "PFA-5" |
| M4 | fix 4 reversed (no type check, `String(own)` again) | 16 unit rows; emulator "V1.9 review 4" |
| M4a | the up-front type check removed | batch 1: **survived** (review PFB-2); batch 2: 4 new unit rows |
| M4b | only `String(own)` restored | **survived: equivalent** while the up-front check stands |
| M6 | fix 6 reversed (the owner check removed) | 5 unit rows; 2 emulator rows |
| M6c | an empty `ownerId` accepted | `attribution.ownerCheck.test.js` |
| M6d | the parent clause removed | `attribution.ownerCheck.test.js` (unreachable through today's resolver; review PFB-4) |
| MH | health line codes echoed | unit and emulator health rows |
| MA3 | a staged key's stage printed unfiltered | unit "PFA-3" |
| MA7 | a thrown run logs no line | unit "PFA-7" |
| M3a | a failed final or claim read reads as absence | unit "review 3" |
| M3b | a failed pointer read counts the battle as unwritten | unit "review 3" |
| M5 | a stored label echoed | unit "review 5" |
| MI1 | the identity comparison removed | 9 unit rows |
| MI2 | the `entry` deep equality removed | unit "entry not deep-equal" |
| MI3 | the field-set check removed | unit "an extra field", "a missing field" |
| MI4 | a resolved pointer on a clone's own id not counted | unit row |
| MP1 | PFB-1 reversed (the stored source compared strictly) | unit "PFB-1"; emulator "review PFB-1" |
| MP1b | any stored source accepted | 2 unit rows |
| Mpin2 | a write chained inside `restrictedReader.getAll` | the purity pin (review PFB-3) |

The batch-1 survivors M4a and M4b were each half of fix 4: each half covers the other's inputs except in the two shapes review PFB-2 found, which now have rows (M4a killed in batch 2). M4b remains equivalent (every id the route check reads is a field the up-front check has already typed), as does the `incomingPositionId` half of the up-front check (every row opens a swap-in whose own id is that field). The reviewers' own mutants (A: 10, B: 16) are in §9.

## 9. Independent review (BUILD_RULES §2)

Two lenses, each on its own `git archive` tree of `36f5bc68` with its own emulator ports, read-only on git and on this worktree; then one refuting verifier per lens on a third and a fourth tree. Finding ids use the prefix `PF` (unused in the repo). The prompt's `review 1` … `review 5` are Astra's.

**Lens A, the tenant** (fixes 1 and 2, the health line, nothing else moved). Fix 1 held: no path settles a started call early, no lost wake-up or deadlock, the caps and reserves unchanged; the key cursors are compliant; the diff of the tenant, indentation stripped, shows only the three changes plus comments.

| Id | Finding | Verifier | Disposition |
|---|---|---|---|
| PFA-1 | MEDIUM: an unseen battle not reached was indexed anyway, so it joined a rotation | CONFIRMED (read one run late in the verifier's fixture; later still with a larger queue) | Fixed (`tenant.js:365`), row "PFA-1", mutant MA1 |
| PFA-2 | MEDIUM: the two cursor guards had no row; no row asserted the ordinary cursor | CONFIRMED (each guard deleted survived the committed file; each new row kills only its own) | Rows "PFA-2" ×2, mutants M2c, M2f |
| PFA-3 | LOW: a code with a colon in `store.threw`/`writeFailed` printed its prefix | PARTLY: the mechanism is real; no producer in Firestore Admin, gax, grpc, gaxios, the store or the observer | Fixed (`STAGES`, labelled whole), unit row, mutant MA3 |
| PFA-4 | LOW, a reading: a casual clone whose attribution read the budget refuses is passed | CONFIRMED as behaviour; the verifier showed the other reading pins the cursor (a clone with a slow pointer read every run kept four battles unread for three runs) | Kept; question Q2 |
| PFA-5 | LOW, a reading: a carried due key in flight did not hold ordinary writes | CONFIRMED as behaviour; the letter of §4.2 supports holding, the purpose (a carried key writes no pointer this run) would not | Built to the letter (decision 3), row, mutant MA5; question Q3 |
| PFA-6 | NOTE: the writes-beside-acquisition comment overstated (ordinary evidence can be deferred) | — | Comment fixed; row "PFA-6" shows the deferral and the next run's write |
| PFA-7 | NOTE: a run that throws logged no line | CONFIRMED (the host's error line still showed the throw) | Fixed, unit row, mutant MA7 |

**Lens B, the record and the census** (fixes 3–6, integrity, labels, privacy on every channel). Fixes 3, 5, 6 and 7 held; fix 4's code was right but one half had no row; every failed read in the census goes to `read_failed`, unknown coverage or `errors`; no stored string reaches any channel; `casualClone.js` is byte-unchanged.

| Id | Finding | Verifier | Disposition |
|---|---|---|---|
| PFB-1 | HIGH for the integrity section: a correct pointer of a corrected starting position written while held and sold later counted as an `activatedAtSource` mismatch | CONFIRMED (the pointer is correct; the source is state-dependent in §4.1 only for that row) | Fixed (decision 4), unit and emulator rows, mutants MP1, MP1b |
| PFB-2 | MEDIUM, test integrity: two shapes caught only by the up-front type check had no row | CONFIRMED (9/9 probes) | Rows, mutant M4a killed |
| PFB-3 | LOW: the purity pin missed a chained `db.doc(p).set(` | CONFIRMED (a write after the read is caught by nothing dynamic) | Pin tightened, mutant Mpin2 |
| PFB-4 | NOTE: the parent clause is unreachable through today's resolver | CONFIRMED | `attribution.ownerCheck.test.js` pins it; mutants M6c, M6d |
| PFB-5 | NOTE: `null` read as absent | — | Decision 1, question Q1 |
| PFB-6 | LOW: `MISSING_DETAILS` complete, but only the acquisition failures pinned | CONFIRMED (the 12 entries are exactly the store's retryable reasons) | Pinned to the classification's cases and the adapter's split-check reasons |
| PFB-7 | NOTE: integrity scope (attribution one way; battle fields not recomputed; mismatches counted by field) | — | Attribution both ways, five battle fields, pointers-with-mismatch added |
| PFB-8 | NOTE: the owner check kept whole documents; a duplicated allowlist uid double-counted the census | — | Owner ids only; owners deduplicated, row |

Fifteen findings in all (A 7, B 8). Eleven went to a verifier: ten CONFIRMED, one PARTLY (PFA-3), none REFUTED; the four notes not sent (PFA-6, PFB-5, PFB-7, PFB-8) were acted on as recorded. Every finding is fixed with a row except PFA-4 (kept, question Q2) and PFB-5 (kept, question Q1); PFA-5 is built to the letter and carried as question Q3. The reviewers' own mutants: A 10 (two survived the committed file, now killed by the PFA-2 rows), B 16 (five survived: M4a, Mpin2, M6c and M6d, each now killed by a new row, and M4b, equivalent).

## 10. Runs

On the code head `fb2f2fd7` (`origin/main` still `18d84ada`, so the PR tree is the branch tree). Linux is WSL Ubuntu with Node 20.20.2 (CI's) and Temurin 21, in a private worktree of `~/pd-ci` at the exact commit, `node_modules` from a real `npm ci` of the same lockfile (`40382e64edb6`), one check at a time.

| Check | Where | Result |
|---|---|---|
| Full vitest suite | Linux, `TZ=UTC`, `--maxWorkers=8`, under `flock` | 1,286 files passed, 8 skipped; 28,532 rows passed, 0 failed, 89 skipped; 242 s |
| `npm run test:rules` | Linux, the Firestore emulator | 32 files, 629 rows passed (608 at base + 21 new) |
| `npm run lint:gate` | Linux | exit 0 |
| `vite build` | Linux | exit 0, built in 15 s (two `css-syntax-error` warnings, in CSS this PR does not touch) |
| Golden guard | `scripts/ci/tf-setup-golden-guard.mjs`, compare mode against `18d84ada` | PASS: golden `767d22633672`, `tf-setup-v1/sem-1`, one baseline entry, unchanged |
| Host byte identity | `process-pending-reflections.activationEvidence.test.js` | the three flag-off responses equal the base handler's strings, and no `[activationEvidence]` line is logged |

Earlier, for the record: at `36f5bc68` (before the review fixes) the full Linux suite was green too (28,509 rows, 0 failed), so no repo-wide census or guard test names this PR's files. On Windows, during the build, the observer's unit files, the census, the host test and the guards that scan for new readers (`setupEvidenceImportGuard`, `carriage`, `flagPinGuard`, `compositionProtectedStores.scan`) were run after each change; one `flagPinGuard` failure (a new test file pinned the flag) was removed by mocking the flag in that file instead of pinning it.

The docs commit on top holds documents only. Its own suite, emulator suites, lint gate, `vite build` and golden guard, on the exact pushed head, are in the PR description.

## 11. The flip checklist

This PR changed no rule, index or cron line, so nothing needs deploying for it. Before the flip PR (flag `true`, its pin, the `DARK_BY_DESIGN` entry), the items Astra marked UNKNOWN, and how to see each:

| Item | Where | What to see |
|---|---|---|
| The published rules | Firebase console → Firestore → Rules | Two blocks, both `allow read, write: if false;`: `match /activations/{activationId}` inside `match /agentBattles/{battleId}` (`firestore.rules:554-556`), and `match /activationObserverState/{name}` (`:1272-1274`). The published text's timestamp is after PR #1026's merge. |
| The index and both exemptions | Firebase console → Firestore → Indexes | Composite: `agentBattles` — `ownerId` Ascending, `createdAt` Descending — status **Enabled**. Single field → Exemptions: `activationObserverState` · `battles` and `activationObserverState` · `outstandingKeys`, each with every index disabled — status **Enabled**. |
| The cron line | Vercel → the project → Settings → Cron Jobs | `/api/cron/process-pending-reflections` with schedule `*/15 13,14,15,16,17,18,19,20,21,22,23,0,1 * * *` (the hour `1` at the end). |
| The allowlist | Vercel → the project → Settings → Environment Variables → `COCKPIT_ALLOWLIST_UIDS` (Production) | How many comma-separated owners it names (count only; never paste the ids anywhere). The observer reads exactly these owners. |
| The first hour after the flip | Vercel → Logs, filter `[activationEvidence]` on the reflections function | One line per 15-minute run. `failures` empty (or only `ticks:`/`final:` codes that do not repeat run after run); `acquisitions.started` above 0 while battles have unwritten work; `pointers.withEvidence` rising; `deferred.attribution_read_error` 0; `stateWritten` true. A `run:<code>` failure means the observer threw: stop and report. |
| The first census | `node scripts/census-activation-evidence.mjs --session <the first full session> --out census.md` (repo root, founder credentials) | §7 "Pointer integrity": **Mismatches: 0**. §4 `read_failed` 0. Any mismatch: send the field counts, never the ids. |

## 12. Questions, none blocking

- **Q1 (review PFB-5; fix 4).** A position id of `null` is read as "no id", like an absent field, not as a non-string that makes the slot inconsistent. On a corrected battle `null` fails anyway; only a legacy battle with an explicit `null` id would differ, and no writer stores one. Keep this reading, or treat `null` as inconsistent too?
- **Q2 (review PFA-4; fix 2).** A casual clone whose pointer read ran but whose attribution read the preparation budget refused counts as attempted, so the cursor passes it and it comes round again in its turn. The other reading (not attempted, the cursor stays before it) keeps its place, but a clone whose own pointer read always runs past the budget would then pin the cursor, the defect V1.9 §4.3 exists to prevent (the verifier showed it: four battles unread for three runs). Keep this reading?
- **Q3 (review PFA-5; fix 1).** Built to the letter of V1.9 §4.2 ("while any due key's store call is still in flight, ordinary writes wait"): a key carried from the state whose `dueAt` has passed holds ordinary writes too. Such a key writes no pointer in this run, so holding protects no due pointer; it only lets ordinary evidence already in hand wait, and perhaps be deferred by the write reserve to the next run. Keep the letter, or record the narrower reading (only due keys with a pointer to write this run hold ordinary writes) in the contract?

## 13. Files

Code: `api/_utils/activationEvidence/{tenant,lifetimes,attribution,constants}.js`, `scripts/census-activation-evidence.mjs`. Tests: the nine files in §7. Docs: the V1.9 contract, this report, two `docs/README.md` rows. Not touched: the flag, `casualClone.js`, the store (`api/_utils/setupEvidence/`), the evaluator, the host's other tenants, any fenced file, `firestore.rules`, `firestore.indexes.json`, `vercel.json`. No fenced function is called.
