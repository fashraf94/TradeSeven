# Astra — Film Room B1.1 review

**DO NOT MERGE**

**Criterion 7 fails in a synthetic census error-formatting repro.** An unlisted function/class name reaches the census output through its fallback text. No live path throwing that value was established. Separately, an acknowledged P write followed by a failed verification read is reported as a re-merge failure while P has changed; §1 F2 requests a criterion-5 ruling and distinguishes this from a failed transaction or corrupt tape. The evaluator showed **no behavioral difference in 29 paired real-evaluator ticks**.

Reviewed 2026-10-16. PR [#977](https://github.com/fashraf94/TradeSeven/pull/977), branch `claude/film-room-b1-1`. Head `f2cd07e25bd6387f90b7756fdbf91141a9edbed3`; code tip `69b63e1411d0ba27fcac7e055ab9b69bca2f0c30`; merge base and fetched current main `078fe895933af9bca22a05e7e4b8ad350d59a775`. All product-source citations below refer to the head, unless explicitly labelled otherwise.

Governing inputs: Build B V1.0 §§1–3; Amendments A–D; **Amendment E exactly as supplied in the review request**, although it is not on this branch; B1 confirmation §3; and the ten exit criteria in the request. The executor's report was treated as claims to verify. No additional blocking criterion is introduced.

This is a local, read-only review. Product source in the supplied checkout and archive snapshots was not edited. Review-only probes and this report live outside the checkout. No commit, push, merge, deployment, production query, real census run, or flag change was made. Synthetic DB/provider/model substitutes were used where described below.

## 1. Findings

### F1 — The census stringifies a thrown function and prints its unlisted name

**Criterion 7. Blocking under the requested output boundary; low practical severity and synthetic reachability.**

**Source:** `scripts/census-film-room-b1.mjs:403`, `scripts/census-film-room-b1.mjs:407`, `scripts/census-film-room-b1.mjs:416`, `scripts/census-film-room-b1.mjs:475`. The fixed list and safe tape fallback are at `api/_utils/filmTape/errorClass.js:29`, `api/_utils/filmTape/errorClass.js:59`, `api/_utils/filmTape/errorClass.js:85`.

The census correctly uses `errorClassOf(err)` for its prefix. Its text selection, however, treats only objects as error-like. A function takes the primitive branch and goes through `String(err)`, exposing its source and name. Short unlisted names survive the subsequent identifier scrub.

**Repro executed without running the CLI or reading credentials:** import `censusErrorLine` and pass `class CustomError {}`. The result is:

```text
Error: class CustomError {}
```

`CustomError` is absent from `ERROR_CLASSES`. `function ShortError(){}` and a function with an empty message also reproduce it. The same values passed to the tape's `errorTextOf` return just `Error`. A normal instance control is safe; the original registered `FakeOwner31Error` control returns `Error: safe reason`, with the registered value absent.

This is a name fallback, not a claim that arbitrary message contents must be scrubbed more aggressively. The accepted LC-11 message-sanitizer limitations stay accepted. The new criterion explicitly forbids a name outside the list reaching **census output**, and the tape helper already recognizes thrown functions as a fallback case. The class prefix alone is safe; the complete output is not.

**Limits:** this repro directly exercises the function used by the real `main().catch` output path. It does not prove that Firebase, the parser, or another live dependency throws a constructor/function, and it establishes no production disclosure. The text branch predates this revision; the defect is in B1.1's claimed completion of the newly scoped error-output contract.

**Proposed fix, not made:** treat functions like objects when selecting the census message; if they have no usable message, leave text empty and emit only the listed class. Keep the existing registered-value scrubbing and length bound. Add function/class and empty-message controls beside the instance tests. Do not add these arbitrary names to the safe list.

Evidence: [formatter results](../../evidence/census-function-class.json), [executed probe](../../head/api/_utils/filmTape/astra-errors.test.js), [test result](../../evidence/independent-errors-test.json). The probe passes because it asserts the observed defect, not because the contract passes.

### F2 — A successful P write can be counted as a failed re-merge

**Criterion 5, under its literal reported-failure reading. Founder disposition required; no failed-write corruption demonstrated.**

**Source:** `api/_utils/filmTape/closePass.js:159` awaits the real writer; `api/_utils/filmTape/closePass.js:162` then reads P again; `api/_utils/filmTape/closePass.js:167` reports either error in `remergeFailed`. The writer awaits its transaction at `api/_utils/filmTape/writeTapeDay.js:124`, sets the merged document at `api/_utils/filmTape/writeTapeDay.js:151`, and returns its acknowledged outcome at `api/_utils/filmTape/writeTapeDay.js:157`.

**Repro executed:** create a two-session fixture, write/candle P, file a late meeting from P, then run D's actual close pass. Permit all reads and the P transaction to succeed. Inject `post_commit_verification_read_failed` only into the final ordinary P read, after the stored P contains the late meeting. Compare D against a fault-free control.

| Observation | Result |
|---|---|
| P before | No copied late meeting; `runCount: 1` |
| P after | Late meeting copied; `runCount: 2` |
| Summary | One `remergeFailed`; no `remerged` row |
| P close status / last error | `written` / `null` |
| D compared with successful control | Byte-identical |

The operational consequence is a false failure report after an acknowledged successful write. P is the intended whole merge. It is **not** marked failed, and D is unaffected. If criterion 5 means every outcome placed in `remergeFailed` must leave P unchanged, this breaches it. If it means only a transaction that actually failed before committing, this case belongs in backlog instead; the criterion-7 verdict above does not depend on that interpretation.

**Why this is not a repeat of the accepted unsafe-catch item:** the injected error has ordinary usable text; the catch does not throw. Nor does the repro rely on an unknown commit outcome. The executor already disclosed unknown-commit behavior under X3-9 (`docs/audits/20261015_BUILD_FILM_ROOM_B1_1.md:124`; `api/_utils/filmTape/closePass.js:59`). Here the transaction's success is known before the extra read fails. The broader distributed-commit caveat is not reopened.

**Reachability:** dormant for battles created by the current single-day creation path. This is a deterministic local multi-day fixture, not evidence of a production occurrence.

**Proposed fix, not made:** return committed meeting keys, or a suitable stored-meetings result, from the already computed writer outcome. Build the `remerged` summary from that acknowledged outcome, respecting the budget-dropped-meetings case. If a second read is retained, distinguish its verification failure from a failed merge; do not roll back a successful write just to make the summary true.

Evidence: [before/after and read trace](../../evidence/postcommit-remerge.json), [real-pass probe](../../head/api/_utils/filmTape/astra-remerge.test.js), [test result](../../evidence/postcommit-test.json).

### Exit-criterion disposition

| Criterion | Review result |
|---|---|
| 1. Evaluator behavior | No change found; 29 paired ticks, real risk/counter/hurdle code, frozen goldens pass. |
| 2. Existing tape values / new fields | No unallowed difference in 16 cases through four stages; details in §4. |
| 3. Reproduce tags from stored inputs/checks | Pass on both bases, mixed holdings, JSON round trip and 18 live-golden ticks. |
| 4. Unpreceded recorded exit classified | All eight recorded exits accounted for: one preceded, seven `recorded_basis`; none unknown. |
| 5. Failure isolation | Ordinary injected pre-commit failures pass. F2 exposes acknowledged-write / failed-verification classification; ruling requested. |
| 6. Hub keys and untaped short circuit | Pass: exactly three keys; untaped modes make neither downstream call. |
| 7. Listed error names only | **F1 fails for a thrown function/class in census output.** Ordinary error instances and N1 controls pass. |
| 8. Fences | No diff in the requested files or ratchet baseline. Both main merges reconstruct exactly. |
| 9. Live v2 screen | All six A2 sweeps pass in 185 mounted DOM views of five B1.1-written tapes. |
| 10. Copied meeting permanence | Both attacks pass on all four routes; RE-2's size-budget exception remains accepted. |

## 2. Evaluator: comparisons and result

### Source review

The evaluator diff introduces the recorder at `api/cron/agent-evaluate.js:1741`, names the existing inline object `riskPosition` at `api/cron/agent-evaluate.js:1876`, passes that same object to the same risk call, copies the three values at `api/cron/agent-evaluate.js:1888`, and sends the new map to capture at `api/cron/agent-evaluate.js:1910`. The `dailyPct` expression is unchanged, including its existing missing-quote fallback. There is no read-back into decision-making: the only non-comment uses of `stagnationRead` are its initialization, assignment and capture argument.

`evaluateRisk` delegates without mutating the input (`api/_utils/agentRiskManager.js:89`, `api/_utils/agentRiskManager.js:115`). `updateStagnationCounter` returns a new result containing primitive values (`api/_utils/agentRiskManager.js:235`). The independent harness observed the actual arguments before and after calls and found no mutation. Captured count, age gate and daily change match the values used by the real risk call for every recorded holding tested.

Capture remains behind its guard (`api/_utils/tickCapture/captureContext.js:178`, `api/_utils/tickCapture/captureContext.js:278`). A throwing `ownKeys` during the real capture copy was injected inside that guard. It produced a capture error/gap and left the business outcome unchanged. This verifies the actual failure boundary; it is not a mock that simply makes capture a no-op.

### Independent before/after execution

The same review harness ran against separate LF base and head archives. It reused the branch's environment scaffolding and added independent seeds. The actual evaluator, risk calculation, stagnation counter and hurdle test ran. Database, quote/model transport and trade execution interfaces were deterministic local substitutes; swap requests and resulting simulated writes were recorded. This proves local code-path parity, not live execution against Firestore or a provider.

For each tick I compared exact JSON serializations, with SHA-256 digests retained, of thrown outcome, summary, battle updates, prompts, capture calls, writer calls, real risk/counter/hurdle calls and stored state. `cronState`, verdicts, scores and swap requests were inside these comparisons. The **only** lifted field was the declared new capture `risk.stagnation`; no business output was normalized away.

| Independent seed | Observed outcome at both revisions |
|---|---|
| Executed fire | TSLA risk fire; one swap |
| Hurdle veto | Risk fire, no swap |
| Circuit breaker | Risk fire, no swap |
| Age pause | No swap; counter/age behavior identical |
| Reset | No swap; counter reset identical |
| Quote missing `changePercent` | Existing daily-change fallback preserved; one swap |
| Crypto holding | Real BTC holding evaluated; one swap |
| Capture off | One swap; no capture record |
| Capture copy throws | Same one-swap business result as the healthy control |
| Exactly 20 minutes held | One swap |
| Just beyond 20 minutes | No swap |

These 11 ticks plus all 18 ticks from the live stagnation golden give **29 paired ticks, zero differing comparisons and zero record/input mismatches**. Full raw records and the comparison program are retained: [parity/digests](../../evidence/evaluator-parity.json), [base](../../evidence/base-evaluator.json), [head](../../evidence/head-evaluator.json), [comparison](../../compare-evaluator.mjs).

The three frozen suites also pass unchanged: calls-off **27 tests** (16 scenarios), rollback **6 tests** (three scenarios), live stagnation **4 tests** (18 ticks). Test counts and scenario counts are deliberately separate.

## 3. Backlog and accepted rulings

The following are not new blockers. No production census was run, so reported occupancy and production tape-size ranges are not independently confirmed here.

| Item | Disposition retained |
|---|---|
| RE-1 / RD-5 | Recorded-only tag coverage still inherits the checks absent-entry reason. B2 writer work changes that and makes the re-merge catch safe for unusable error text. |
| RE-2 / RB-6 | The budget may drop already copied meetings; a later read may restore what history then contains. Keep 950,000. Stored-first budget dropping waits for RC-5's trigger. |
| RE-3 | Coverage currently describes the latest history read, not necessarily preserved stored rows. B2 writer fix before meetings render. |
| RE-4 | Earlier-day promise on an already completed multi-day battle is accepted while creation remains single-day. Reword when multi-day returns or completion files pending meetings. |
| RE-5 / Y1-5 / Y1-7 | Owner-planted history/note can become permanent; meetings remain the owner's record, never proof for drilled/proven/installed stages. Server-copy note derivation stays backlog. |
| Y1-6 | Cap-note undercount accepted. |
| Retry limits | No retry after `time_floor`/`notReached`; backfill does not re-merge P. Accepted. |
| Unsafe re-merge catch | Already accepted and scheduled under RE-1; F2 uses an ordinary Error and does not depend on this defect. |
| Recorded `firedAt` fallback | Evidence-stamp fallback retained. |
| RD-2 | P can move every field a refresh at that instant moves. No meeting-only promise is imposed. |
| RD-4 / X2-2 | Recorded runs remain day-local; count decreases without timely zero need not create boundaries. Unpreceded recorded exits classified `recorded_basis`; further subclasses remain backlog. |
| RD-7 X3-5 | Gap plus unattributed-gap overlap goes to B2 writer work. |
| RD-7 X1-2 | Dotted share-class keys are routed to Command Center; the existing serializer limitation is not a new finding. |
| Earlier confirmation §3 | RB-7 opponent-null/recovery semantics; RB-8 partial-provider-revision divergence; RB-2/3/4 accepted replay, meeting-only candle and coverage limitations; LA-4/LA-7/LC-9 coverage limits; LC-11 message limits; Windows ratchet portability remain accepted. |

B1 confirmation's N1 ordinary error-name repro and RB-9 helper change were rechecked as current B1.1 work, rather than assumed still open. Both pass their original controls. F1 is the separately reproduced function-source fallback.

## 4. Checks, platform, merged tree and handoff

### Capture and reader census

`api/_utils/tickCapture/captureWriter.js:163` admits only a complete record with nonnegative integer count, boolean age and finite daily change; it iterates the tick's held positions. `api/_utils/tickCapture/captureSerializer.js:102`, `api/_utils/tickCapture/captureSerializer.js:234`, `api/_utils/tickCapture/captureSerializer.js:353` constrain the leaves and symbol-keyed maps to the existing tick universe. The verdict allowlist is unchanged. The serializer's 29 tests and writer's 40 tests pass, including malformed records, extra symbols and omission of invalid entries.

The repository census searched tick collection access, capture constants, raw exports, risk-field consumers and `schemaVersion` uses, then inspected the runtime readers below. Tests and the writer itself were separated from readers. **No repository consumer found dispatches on tick `schemaVersion` or rejects the additive risk field.** This is bounded to checked-in consumers, not undiscovered external clients.

| Reader | Head evidence and treatment of the new field |
|---|---|
| Tape writer | `api/_utils/filmTape/tapeSources.js:41`; `api/_utils/filmTape/tapeAssemble.js:169`. Reads ticks; explicitly projects the new records. |
| B1 census | `scripts/census-film-room-b1.mjs:464`. Tick query selects only sequence and controls; tag analysis reads stored tape checks. |
| Cockpit week-one export | `scripts/cockpit-week1-read.mjs:54`, `scripts/cockpit-week1-read.mjs:230`. Raw subcollection read, consumers select known fields; no version dispatch. |
| Declaration wording experiment | `scripts/declarations-wording-experiment.mjs:177`. Selects `evalId`, `body`, `callEnvelope`. |
| Archetype replay | `scripts/experiments/archetypeAblationReplay.mjs:254`, `scripts/experiments/archetypeAblationReplay.mjs:807`. Named risk counts, no exact risk-object shape requirement. |
| Growth replay | `scripts/experiments/growth-replay/growthReplay.js:278`, `scripts/experiments/growth-replay/growthReplay.js:942`. Reads raw ticks then known fields. |
| Changed-moment scoring | `scripts/experiments/growth-replay/changedMomentsScore.js:818`. Named projections from tick docs. |
| Capture export | `scripts/export-tick-capture.js:241`. Full tick passthrough; additive field is retained. |
| Shadow call reader | `scripts/shadow-read-call-records.mjs:207`. Copies schema version as metadata only; no version-based behavior. |

Search evidence: [tick access](../../evidence/tick-readers.json), [schema uses](../../evidence/schema-uses.json). Matches for unrelated learning/mandate/wire schemas were not mistaken for tick-version dispatch.

### Tags, stored inputs and live-golden exits

The per-holding decision is derived from all held checks (`api/_utils/filmTape/tapeTags.js:134`), stored at `api/_utils/filmTape/tapeTags.js:240`, and checked again during reproduction at `api/_utils/filmTape/tapeTags.js:300`. Independent real-writer probes covered recorded, recomputed, mixed, entry-rebuilt, missing count, missing age, missing change, crypto, sold-midday and daily-versus-entry-change cases. Every written result reproduced its items and exits after JSON serialization from the stored `tags.inputs` and `checks[]`.

An incomplete record caused only that holding to use recomputation. A sold holding retained its recorded basis while another holding used recomputation. The daily-versus-entry case honored `winnerBasis` rather than substituting entry return. The fully recorded fixture produced tags before its exit. B1's original no-record items and exits remain protected by the unchanged frozen-input assertions and the paired writer comparison; the 50 recorded-tag branch tests pass.

The actual 18 golden ticks were also run through the real tape writer. They contain **14 live risk fires**, one with capture off, hence **13 captured fires**. A fire vetoed or held by the breaker is not an executed exit and is not invented as one by the tape. Of **eight recorded stagnation exits**, one is preceded by a tag and seven start with an already-high recorded count and are explicitly `recorded_basis`; zero are unknown. The capture-off case writes no fictitious recorded exit. This distinction prevents counting every risk fire as a trade.

Evidence: [independent tags](../../evidence/tags-independent.json), [golden ticks to tags](../../evidence/golden-ticks-to-tags.json), [11-test result](../../evidence/independent-tags-test.json).

### Late meetings and permanence

The candidate is built before any P read (`api/_utils/filmTape/closePass.js:149`); the time floor precedes the read (`api/_utils/filmTape/closePass.js:152`); writing requires a missing key (`api/_utils/filmTape/closePass.js:158`). The unchanged 20-test late-meeting suite passes candidate/no-candidate, already-copied, time-floor, transaction-failure isolation, refresh equivalence and candle/provider controls. A normal writer may independently read the prior tape as an input; that is distinct from the additional re-merge candidate read. F2 isolates the remaining post-commit classification case.

The present creation path is concretely single-day: `api/_utils/agentBattleService.js:37` fixes `AGENT_BATTLE_DURATION_MODE` to `fullday`; `api/_utils/agentBattleService.js:119` overwrites `tradingDays` with a singleton in `createAgentBattle`. Consequently `previousTapeDay` returns null for its only session (`api/_utils/filmTape/closePass.js:120`). This proves dormancy for documents created by this path; it is not a production inventory assertion about legacy documents.

The notes at `api/_utils/filmTape/tapeAssemble.js:934` and `api/_utils/filmTape/tapeAssemble.js:935` match RD-3 word for word. The tape's own single `isFinalDay` value selects the note (`api/_utils/filmTape/tapeAssemble.js:1110`, `api/_utils/filmTape/tapeAssemble.js:1158`, `api/_utils/filmTape/tapeAssemble.js:1350`). Both notes were also verified on real written tapes used in the mounted screen tests.

Eight independent attacks used the actual nightly pass, previous-day re-merge, authenticated admin refresh handler with local auth/DB substitutes, and completion night. On each route a same-key planted rewrite and 26 earlier-dated plants failed to alter or evict the original copied row. The cap kept stored rows first, as implemented at `api/_utils/filmTape/tapeMerge.js:590`. Completion changed the battle block as expected without rewriting the copied row. [All eight route results](../../evidence/meetings-independent.json). RE-2's explicit budget exception was not counted as a failure.

### Hub and error surfaces

The helper checks mode before verdict resolution (`src/utils/reviewAvailability.js:149`, `src/utils/reviewAvailability.js:153`). In addition to its 47 branch tests, an independent matrix exercised three flag modes, seven game-mode forms and four battle states (84 combinations), plus five invalid-input checks. Every result had exactly `ready`, `target`, `availability`. Modes the resolver identifies as untaped made no tape or verdict call. Missing/unknown mode fallback was tested as the existing resolver behavior, not relabelled untaped. [Hub matrix](../../evidence/hub-independent.json).

Error-route tracing covered T1 opponent failures (`api/_utils/filmTape/tapeAssemble.js:227`), meetings (`api/_utils/filmTape/tapeAssemble.js:946`), tag failure (`api/_utils/filmTape/tapeTags.js:444`), read notes (`api/_utils/filmTape/tapeSources.js:22`), persistent close/candle failures (`api/_utils/filmTape/closePass.js:110`, `api/_utils/filmTape/candlePass.js:811`) and census output. Class/name controls pass on the tape paths. The 13 class tests, ten text tests and 18 census tests pass. F1 extends them to the census's thrown-function case.

Remaining raw fallbacks at `api/_utils/filmTape/candlePass.js:169`, `api/_utils/filmTape/candlePass.js:705`, `api/_utils/filmTape/candlePass.js:791` and `api/_utils/filmTape/closePass.js:167` flow to pass summaries/logs, not stored tape or this census. They were not promoted to criterion-7 failures. [Error surface trace](../../evidence/error-surfaces.json).

### Tape field comparison and mounted screen

Sixteen paired fixtures/control variants ran through **close, candle pass, refresh one, refresh two** at base and head: captured, no-trigger, budget, completed, multi-day, early-close, skipped-mode, pre-capture, stalled, no-result draw, CPU draw, pending final, pending earlier, missing-entry, empty and negative/zero values. The candle pass used deterministic provider data.

Across **64 stages and 580 tape/series document comparisons**, 516 documents were byte-identical. The 64 differing tape documents had only the declared stagnation leaves and their numeric classes, tag registry/situation/item versions, declared per-holding basis, permitted `winnerBasis`, and RD-3 note movement. No unexpected existing-field difference, extra field or provider-call difference was found. This matrix specifically checks the old no-record behavior; recorded-tag movement is separately tested above. [Field-by-field comparison](../../evidence/writer-parity.json), [base output](../../evidence/base-writer.json), [head output](../../evidence/head-writer.json).

The actual `FilmRoomScreenV2` was mounted in jsdom on five B1.1 close/candle-written tapes: recorded, mixed, pending-final, pending-earlier and budget-dropped meetings. Every depth, every one of 23 check detail rows, every offered deep symbol and expandable disclosure was exercised: **37 views per tape, 185 total**. All six A2 sweeps passed: number/class-path provenance, vocabulary, signs, quotations, stored notes and agent names. The budget tape was created through the writer's size-budget seam; this does not claim a measured production-size tape. [Screen results](../../evidence/screen-independent.json).

This is live component/DOM evidence, not Chromium screenshots, CSS/layout inspection, deployed browser behavior or a production admission test. Existing off-route, route and frozen-screen tests also ran in the full suite.

### Execution record and platform

| Check | Result |
|---|---|
| Independent evaluator | One aggregate test at each revision; 29 paired ticks, zero differences |
| Independent writer lifecycle | 16 tests at each revision; 64 paired stages |
| Independent tags / golden-to-tape | 11 tests passed |
| Independent meeting routes | Eight tests passed |
| Independent mounted screen | Five tests passed; 185 views |
| Independent hub matrix | One aggregate test passed; 89 checks |
| F1 / F2 observation probes | One test each passed by reproducing the reported behavior |
| Frozen evaluator suites | 27 + 6 + 4 tests passed |
| Full head/current-main Linux suite | **1,023 files passed, seven skipped; 22,231 tests passed, zero failed, 88 skipped; 445.89 seconds** |
| `npm run lint:gate` / Vite build | **Both passed**, exit zero; build 14.62 seconds, existing CSS/chunk warnings |
| PR CI at `f2cd07e2` | Unavailable: CI reader returned "Can't connect to GitHub. Try again." No hosted CI pass is asserted. |

Windows independent probes: PowerShell, Node **22.20.0**, local dependency junctions, no product-file edits. Full suite: Ubuntu under WSL2, kernel **5.15.167.4-microsoft-standard-WSL2**, Node **22.22.2**, npm **10.9.7**, `CI=true`, **`TZ=UTC`**, two Vitest workers. The existing Linux dependency installation's lock hash matched this snapshot: SHA-256 `22fa2b71904c30eedeac318540dc61c1cf48d52eb97a50de1fd2b2ce39da5d54`. No clean dependency-install claim is made.

The full Linux run uses a pristine archive, excluding added review probes. Command: `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=default --reporter=json --outputFile=<external evidence>/linux-full.json`; then `npm run lint:gate` and `node node_modules/vite/bin/vite.js build`. Review probes ran separately in the Windows archives. [Runner](../../run-linux.sh), [platform](../../evidence/linux-platform.txt), [full-suite JSON](../../evidence/linux-full.json), [lint log](../../evidence/linux-lint.log), [build log](../../evidence/linux-build.log).

The additional probes are independent of the executor's assertions but were authored and run by this reviewer. No separate reviewer or independent agent refutation is claimed. The 88 skipped tests remain skipped; they are not reported as passed.

Execution corrections disclosed: the first writer harness used an unset date on its multi-day fixture and failed identically at base and head; only that review harness was corrected and both final runs passed. The first Linux run passed the full suite/lint/build, but WSL later cleared its `/tmp` snapshots before the final blob check. A complete repeat in a persistent home-directory snapshot was therefore run with before/after hash verification. First-run evidence is preserved separately and is not counted as additional tests.

### Provenance, fences and merged tree

LF archives were produced with `git -c core.autocrlf=false -c core.eol=lf archive` at the exact pins. All **4,003 head** and **3,988 base** tracked blobs matched Git object hashes before the Windows probes and again afterward. Review probes are extra files, not edits to archived product files. The persistent Linux snapshots also matched all **7,991 blobs before and after** the complete test/lint/build run: [before](../../evidence/linux-blobs-before.json), [after](../../evidence/linux-blobs-final.json).

| Artifact | SHA-256 |
|---|---|
| Head archive | `b96219e331d325fca5c89edf111532912b9fd6fad99da1726c2e18dd1a44e6c5` |
| Base archive | `ddfb5e51701ca4de5651ac43b72f83aaf4296fdf381d14e89a582c4d8e2b34b6` |

The final fetch still resolved `origin/main` to the reviewed base and PR head to the requested head. Main is already an ancestor of head, so the requested head-plus-current-main tree **is exactly the head tree**, `84d8d102302d7ad31db0949871266931a3f1ea40`. No checkout merge or integration commit was needed. The two historical merges were reconstructed in an external bare object store using their exact parents; reconstructed and recorded trees match:

| Merge | Parents | Recorded and reconstructed tree |
|---|---|---|
| `458fb929` | `40198f4f26c27273e75430a53b25f33a7dc0a669`, `17947fddcb7102ea847b057dbe764c14b7daef38` | `1f48a5315438592e474ea4378ffbbcdcf1195cb5` |
| `94ec1b48` | `4ca8b7bdf98164309e294374d019f5db0f6d5674`, `078fe895933af9bca22a05e7e4b8ad350d59a775` | `a82925810c948687244340eed68fba567e5a68f3` |

There is no base-to-head diff in the eleven BUILD_RULES §1 files, `firestore.rules`, `firestore.indexes.json`, `vercel.json`, `src/config/featureFlags.js`, or the §2.3 import-ratchet baseline. The head-to-code-tip difference is documentation only. The overall diff remains 48 files, 5,377 additions and 111 deletions. [Provenance record](../../evidence/provenance.json), [final Windows blob verification](../../evidence/blobs-final.json).

The supplied checkout began and ended clean, detached at `078fe895933af9bca22a05e7e4b8ad350d59a775`. Final fetched-ref/status check: **2026-10-16 17:59:34 UTC**, [record](../../evidence/checkout-final.json). Fetches updated refs only. Tests, build outputs, probes, external Git reconstruction and this report were kept outside it. No source remediation was performed.

### Founder handoff

The new prerequisite is **repair or explicitly rule on F1's criterion-7 census fallback**. For F2, state whether criterion 5 covers an acknowledged successful merge whose subsequent verification read fails; the preferred code correction is to report the acknowledged result accurately. This is a named-criterion interpretation, not a new merge gate. Neither issue changes the successful evaluator parity result.

The already supplied Amendment E rulings remain the authority for scheduled B2 work; I do not require those accepted backlog items to be implemented for this review. Before merging, inspect the hosted CI status at the actual merge head because it was unavailable to this review. If the head or main advances, the integration result above applies only to the recorded pins. No activation or production qualification is implied by this report.
