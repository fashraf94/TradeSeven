# Astra — Confirmation review: Film Room C1 after the fix round

**MERGE.**

| Decision | Record |
|---|---|
| Head judged | PR #1049, `0986747a56c7ffaca9f50856afd36ac17e34007f`; code head `9f08deb4` |
| Scope | `b4f9e4e5 → 0986747a`: **25 files, +4,149 / −178**. The complete branch changes **35 files** against `c37baa0d`. |
| Original findings | **F1 closed; F2 closed; F3 closed.** |
| New blocking findings | **None against the fourteen supplied criteria.** One malformed-data hardening observation is backlog, with its limiting counterargument below. |
| Integration judged | Head merged privately with supplied main `577f17eb`; tree **`c9b01f5a8377d83612e6d34f946154486630bd12`**, no conflicts |
| Linux/UTC validation | **31,513 passed / 99 skipped**, zero failures; rules **768/768**; lint gate and Vite build passed |
| Off path | **12/12** fresh head captures equal fresh and committed main byte-for-byte |
| Test bite | **30/30** correctly targeted mutations killed by committed tests; fresh reports and assertion failures retained |
| CI, read once | [Tests run 43403430889](https://github.com/fashraf94/TradeSeven/actions/runs/43403430889): **success** on the exact head |

This is a confirmation of the fix round, including its regressions and the specified integration tree. Unchanged C1 behavior was not reopened. Amendment A as revised on the branch, the original review's §4 boundaries, supplied Amendment B **CB-1–CB-8**, and shared contract V2 at `577f17eb` govern the judgments. The fourteen criterion numbers are those in the review request, not the future C2/C3 list in the repository specification.

The shared checkout remained `main` at `29e8f4de673bf852c5921850c5c355e0fd790a69`, with the same pre-existing dirty-path list. All audit files, added probes, and mutations live outside it. No project source fix, commit, push, merge commit, ref update, fetch/refresh, deployment, backfill, production read, production census, or external message was performed. The private merge used `merge-tree` with a separate object directory, followed by archives; it did not merge a branch.

## §1. F1–F3

### F1 — Closed

**Criterion 8.** `api/_utils/filmRoom/cardStore.js:459`; `api/film-room/card.js:188`.

A new nomination now judges **owner → replay → version → stage/shelving → source → book**. The injected verifier is required by the store. The route reads the stored source battle, the clone when applicable, and the tape through the nomination transaction. It validates battle ownership/mode/attribution and the tape's coverage, exact moment, situation version, and archetype. `park` and `retire` gained no source verifier.

I copied the original `evidence/c1Review.probe.test.js` and `evidence/c1IndependentReview.rules.mjs` into fresh snapshots. Their source probes now assert refusal and no nomination write, instead of asserting the former defect. Removed/unavailable/deleted sources, foreign tape/battle, and another battle agent refuse. The original race changes the tape **after the entry read, before the tape read**; it now refuses immediately, with no retry needed. That original emulator race passed too.

Additional independent probes change the **tape, battle, and clone after each one's transaction read**. All three retry and refuse, leaving the entry at `card` and no nomination record. The committed race tests also bite: moving the battle or clone read outside `tx.get` kills their respective rows. Missing/repointed clones and the source/version/archetype cases are covered by the committed route suite. The no-book/source case now expects the source error, as **CB-1** directs. A successful nomination replay still answers after deleting both its source tape and book.

**Emulator qualification:** the executor's row at `test/rules/filmRoomCardAttribution.rules.mjs:421` demonstrates locking, exactly as §9.2 says. A source removal started after the transaction's reads lands after the callback/commit, so the nomination is valid against the source as it stood. It does **not** demonstrate a removal committing underneath that transaction and then being rejected on retry. I independently repeated the lock ordering with a pending write, and retained the separate optimistic retry/refusal probes. Both forms of evidence agree; their meanings are not conflated.

### F2 — Closed

**Criterion 12.** `api/_utils/filmRoom/cardStore.js:397`, `:417`.

Both Offer create and nominate validate the builder's plain record, queued state, exact five-field source tuple, required instants, and history before either write. The committed **22 malformed outputs are each exercised on both paths** at `api/film-room/card.test.js:1075`. The valid extra-field control passes. CB-7's additional checks hold: `queuedAt` equals the supplied instant, `expiresAt` is later, and `stateHistory` is nonempty with plain rows. An equal instant expressed with another offset is accepted.

The original wrong-entry and wrong-state probes were rerun independently in unit tests and on the emulator. Their expected responses changed from the previously observed 200 to **500**, with the pre-existing Watch card unchanged or no new Offer card, and no record written. This is CB-7's server-fault ruling. `calendar_unavailable` remains **503**, with neither half written. Disabling the validator kills all 22 committed malformed-output rows.

The withdrawal's separate in-place-builder defect was also attacked: changing the builder's input source to another entry and returning it gives **503**, with the stored record and entry unchanged. The pre-builder source copy is effective; aliasing it back to the input kills A1's test. This does not leave F2 open.

### F3 — Closed

**Criteria 3 and 11.** `src/screens/filmRoomV2/filmRoomCards.js:205`, `:207`.

The original **“ASTRA refute F3”** real-create/counter/receipt probe was copied and rerun. Its changed assertion requires **zero chain lines** after replacing the first history row with an unknown event at 17:00Z. The note still credits the real 16:00Z creation at 12:00 PM ET; no false “Filed · 1:00 PM” appears.

The committed shape tests preserve valid Watch, Set, Offer and legacy drill creation rows, and the accepted “time not recorded” treatment. They also cover the executor's B1/B2 extensions: a Watch/Set nomination at index zero is not filing, and a server nomination row without its event does not become the player's offer. Returning to index-only recognition kills the F3 tests.

**Probe changes are reviewable:** `adapt-probes.cjs` records exact replacements. Besides the changed F1/F2/F3 assertions, direct store callers receive the newly required real source verifier, and the original acceptance-C fixture receives CA-12's active book document. The old probe files contain other pre-amendment observations; those rows were deliberately filtered, not silently called passing. The unchanged committed suites run in full on the merged tree.

## §2. The original §4 boundaries

The table separates implementation compliance from what this confirmation actually tested. Test locations are at the pinned head. Mutation IDs refer to `evidence/mutation-results.json`.

| Ruling | Boundary judgment | Pinning tests and bite; missing work |
|---|---|---|
| **CA-1** | Within boundary. Player retirement refuses `testing`, after replay/version/shelving; it remains open for S9 and can receive server `tested`. Receipt shares the player predicate. | Store transition suite, including both testing/retire orders; screen receipt eligibility at `FilmRoomCards.jsdom.test.jsx:2232`. `CA1-testing` killed. No local gap. |
| **CA-2** | Within the withdrawal/transaction boundary: entry and record read together, accepted record refuses, withdrawable record and card change atomically, terminal record synchronizes the copy, absent record permits retirement. A malformed terminal source has the narrower behavior described in §4. | Committed A1/A5/A3 rows at `cardStore.transitions.test.js:1279`, `:1293`, `:1306`; 24 eligible-copy × record combinations at `:1354`; both write-abort sites at `:1386`. Independent **64 combinations** add closed/absent copies; independent emulator races cover both copy and acceptance commit orders. Five CA2 mutants killed. Counterpart admission remains CA-21 work. |
| **CA-3** | Within boundary. `OPEN_STAGES` means outright-open `card/testing`; consumers use `isOpenStage`. Nominated declined/expired/withdrawn close; absent-copy v1 remains open and retirable. | Predicate/count/store/counter/receipt/harness cases; group matrix at screen test `:2193`; census rejects `OPEN_STAGES` and local closing lists in every listed reader. `CA3-open` and `CA3-census` killed. Group order and shelving precedence verified. |
| **CA-4** | Within boundary. Named thesis/closing-note fields, exact text, code-point bounds, required quotation instants, each answer's historical source time. | Store tests `:909`, `:930`, `:946`; screen `:2299`, `:2311`. 400/401 and 600/601 include astral text; absent thesis/reason substitution and absent closing-note behavior are pinned. `CA4-unicode` killed. No local gap. |
| **CA-5** | Within boundary. One idea-bound offer per card; distinct `event: offered`; neither stageAt nor result changes on the offer. Parking remains independent. | Store `:955`, `:976`, `:989`; real screen chain `:2345`. Wrong idea, duplicate/fingerprint/replay, waiting-retire refusal, parking, final install and waiting-line removal covered. `CA5-event` and `CA5-clock` killed. |
| **CA-7** | Within boundary. Strict open-book visibility, card-stage/unshelved eligibility, distinct lazily minted op id, hook/parent/receipt wiring, refusal refresh and retained success. Names the card's own agent. | Screen matrix `:2512`, tap/replay/refusal rows, clone-parent replay `:2692`, mutual-disable LD-3 `:2722`. `CA7-strict` and `CA7-inflight` killed. Server ownership still judges the named agent and entry; naming the parent grants no new authority. |
| **CA-9** | Within boundary. “Your agent considered this” is its own line, with row time and no quotation. | Real helper/render test at `:2420` distinguishes consideredAt from delivery time and checks the latest list; deferral still quotes. `CA9-considered` killed. |
| **CA-11** | Within local boundary. Copy table after replay, before write; testing requires accepted copy and matching book/idea; historical reasons and their times survive later answers. | Exhaustive from × to at store `:819`; replay, late/lost copy, accepted binding and historical answers at `:838`, `:846`, `:854`, `:878`. `CA11-order` killed. Counterpart agreement remains CB-5's T1a-1 response, not an inferred agreement from V2 arrows. |
| **CA-12** | Within boundary. Transactional active/owner/kind/agent recheck at the existing precondition point; replay first; source before book under CB-1; bare book refusal; no book check on withdrawal. | Wrong/missing/throwing/non-true predicate cases; failed read and ABORTED; replay after close; cap/id precedence. **Eight** after-reread field-race rows, both paths, at store `:1410`. `CA12-agent` and `CA12-readset` killed. Real SDK retry additionally verified below. |
| **CA-14** | Within boundary. Present exact idea required, exact offer binding; install needs an offer; no-offer server retirement requires explicit `offerId: null`. | Store `:1006`, `:1022`, `:1032`, A6 at `:1326`. Wrong/missing/null/omitted identifiers, replay and single version increment covered. `CA14-binding` killed. |
| **CA-17** | Within boundary. Stage labels read `stageLabelOf`; actual stored drill route selects legacy wording, not vocabulary version. Chain event names retain their own words under accepted §9.2(12). | Real v1 Watch/Set nominations and drill comparison at screen `:2438`; no version field added. Route/My cards/chain/latest use the intended readers. `CA17-legacy` killed. |
| **CA-18** | Within boundary. Unread `setNoTempo` key and inventory entry removed; count/comment reconciliation present. | Inventory **413 keys / 560 swept entries**, green. Reintroducing the unread key kills `CA18-key`; all twelve cards-off goldens unchanged. |
| **CA-22** | Within boundary. Direct tested only from accepted nominated with matching idea and explicit `noFill: true`; testing refuses noFill; same transaction supplies idea/result/history/version. | Store direct-terminal/refusal/later-move cases at `:1062`, `:1078`, `:1099`; real no-fill render `:2370`; split-flag check `:2384`. Both chain and stage label read **result.noFill alone**. `CA22-one-flag` killed. Filled runs cannot acquire the label merely by losing a testing copy. |
| **CA-23** | Within boundary. Both server and screen explain what stops counting, without telling the player to retire an unretirable card. | Saturated mix at `api/film-room/card.test.js:1235`; all five retire attempts refuse; sixth create receives the exact new sentence. Inventory pins screen copy. `CA23-cap` killed. |
| **CA-13 — script only** | Within boundary. One collection-group query, `select('route','stage')`, no filter; fixed count buckets, no raw unknown values/ids/owners; write-grep gate before credential/read. | `scripts/census-film-room-v1-plays.test.js`: read shape, no writes/output leakage, complete table, drill-not-retired count, credential source, multiline raw input, Ctrl-C/D and both erase keys. Three census mutants killed. Script was **not run against production**. |

### Four cross-ruling corrections

1. **S9 words:** closed by CA-23. The saturated mixture is executable evidence, not an assumption that some counted card is retirable.
2. **Withdrawal/acceptance concurrency:** the Film Room side is closed. Emulator retirement-first leaves withdrawn/retired and refuses the late helper copy; copy-first increments version and defeats the stale retirement. Synthetic transactional acceptance-first leaves accepted/nominated and retirement refuses; retirement-first makes acceptance observe withdrawn and decline the write. This verifies the Film Room contract against a synthetic acceptance actor, **not the future Practice Field implementation**.
3. **CA-11 relay:** CB-5 expressly establishes that the table, concurrency rule and delivery order were sent on November 13 in the named Film Room reply. That governing fact is accepted. The reply is assigned to T1a-1's commit and its answer to T1a-1's spec; I did not witness a chat send or claim counterpart agreement/implementation.
4. **CA-22 one fact:** closed. `endedBeforeFirstFill` reads `result.noFill`; both display paths consume it. The history flag is stored provenance, not a second display authority. Row-only and result-only planted data are pinned consistently.

### The executor's three additional §9.7 test gaps

The claim is verified with its exact extent. The committed product is **3 eligible copy states × 8 record states/absence**, not all seven copy states. The other copy-state gates have separate tests; my independent product covers **8 × 8**, including absent copy. Both record-set and entry-update abort points are present. Book status, userId, kind and attribution agent each change after the inner read on **both** create and nominate.

I killed the four described defect classes independently: outside-transaction withdrawal write, omitted terminal-copy synchronization, unchecked book agent, and a reader naming `OPEN_STAGES`. The additional no-closing-note assertion and per-reader census bite are also present. No claim is made to reproduce the executor's entire earlier 53-mutant or final battery; this review has its own 30 mutations.

### Remaining attack details

- **Withdrawal failures:** ordinary record-read failure, unknown state, malformed builder return, wrong-source withdrawal and any builder throw—including code 10—fail closed with 503 and no retirement. A read-boundary ABORTED is rethrown. Two added probes inject that boundary error into the **real Admin SDK** callback: record-read and book-read each retry once and commit once. These are explicitly synthetic error injections, separate from the actual emulator lock/race tests. All requested withdrawal write-abort points leave neither half committed.
- **Open readers and groups:** Active, Shelved, Not taken, Parked, Equipped, Retired, Other. Retired and unknown stages retain their existing precedence; shelving precedes Not taken and other recognized non-retired grouping. The v1 no-copy case remains open/retirable. The S9 admission tests exercise newly closed nominations without requiring retirement.
- **Quotes and dates:** `ChainLine` dates every recognized move from `line.at` (`FilmRoomCardRegions.jsx:333`); `Chain` gets historical reason/thesis dates from that row's consideredAt and the closing note from closingNoteAt (`:402`). CB-4 is satisfied, including the considered line. Accepted-without-thesis never substitutes reason. The tested instant in history survives offered/park/final moves; an offer does not change the current tested stageAt.
- **Offer button/refusals:** strict true, no shelved/non-card button, one receipt op id, mutual disabling, successful-result retention and refusal refresh all passed. CB-2's source sentence may say “since it was filed”; battle refusals keep existing words; unknown code gets “The card could not be offered.” No cross-owner nomination path was found; the existing owner checks and source-attribution check remain authoritative.
- **Words:** new copy is included in the inventory/forbidden-word sweep; real chain renders run the classification and quotation sweeps. No new own-voice verdict or forbidden word was found. The retained platform-rule reason and the accepted parked no-fill latest-line behavior are not reopened.
- **Instant guard:** `cardStore.js:711` rejects date-only, timezone-less, impossible calendar dates and normalized hour-24 values. A minute-precision input such as `2026-11-12T15:00Z` is safe for this boundary: it contains an explicit offset and resolves unambiguously to seconds zero. Its acceptance does not restore the former timezone-dependent/date-only behavior. Accepted and rejected forms, including quotation and builder clocks, are pinned.
- **Census credential:** the script reads `FIREBASE_ADMIN_CREDENTIALS` or its own hidden prompt, never an `.env` file. The tests use fake credentials/streams, including multiline paste and raw-mode transitions. No credential was requested or supplied to the script in this review. A real interactive terminal paste was not exercised; source and stream-level tests are the evidence for that shell interaction.

## §3. New findings

**No new finding meeting the fourteen blocking criteria was confirmed.**

One candidate was explicitly tested and rejected as a new blocker: the terminal-record association observation in §4. Its reproduction is real, but it begins with an already-corrupt planted source association and performs no nomination-record write. No route from a valid owned pair to that mismatch, client authority escalation, model access, or new false screen word outside the stored ledger was established. Promoting it to criterion 12 would conflate that injected pre-existing corruption with the original F2 defect, where a valid input pair was broken by a newly committed builder output. It remains a precise hardening/report-qualification item rather than an invented fifteenth criterion.

## §4. Backlog and accepted boundaries

**BG-1 — narrow the blanket malformed-record claim, or validate all record sources.** At `api/_utils/filmRoom/cardStore.js:617`, a terminal `declined`, `expired` or `withdrawn` record bypasses `withdrawalOf`; its state is copied to the retiring entry without the source check at `:526`. Repro: create and nominate a real Watch card, change only its synthetic record to a terminal state and `source.entryId: 'different-entry'`, then retire with version 2. All three cases return 200, copy that state and retire; the foreign-naming record is untouched. Thus §9.2(5)'s broad wording is stronger than the implementation: A5/C2 protects records **being withdrawn**. Optional fix: check the record's source kind and entryId before state dispatch, with terminal-state negative rows; alternatively state the narrower claim. No fix was made. The criterion-based disposition is §3.

The following remain the supplied accepted backlog, without new objections:

- **CB-3:** retire/park from a clone battle keep RK-1; C2 makes every receipt action name the card's own agent.
- **CB-5 / CA-21:** Practice Field admission reread, adoption of the exact edge table, and filled/no-fill delivery order await its own work and conformance evidence.
- **CB-6 / CA-13 / CA-19:** founder census after C3 and before `'on'`, retirement of remaining drill entries, then whole-arc QA/flip. No production census or current count is inferred here.
- **CA-8 / CA-15:** B6's eventual source-module pin and calendar-horizon maintenance.
- Executor **B4**, **B8**, **PA-3**, **PA-7**: shelved-nominate wording, later parked no-fill latest line, direct Offer-store caller without verifier where the route always supplies one, and waiting-offer refusal ordering.
- Prior accepted owner-visible nomination IDs, deliberate census limitations, absent C1 idea/result/Forge doors, and the other explicitly accepted first-review readings remain accepted. CB-1, CB-2, CB-4, CB-7 and CB-8 are governing rulings, not unresolved requests.

## §5. Record

### Snapshots, platform and integration

Archives used `git -c core.autocrlf=false -c core.eol=lf archive`. Blob verification found **zero mismatches** for head **4,937 files**, supplied main **4,961**, and merged tree **4,972**, on both the Windows archive extractions and the actual Linux test trees. Added probe files are outside the tracked blob manifest. Production source blobs remained exact after testing.

Tests ran in **WSL Ubuntu, Node 22.22.2, npm 10.9.7, Temurin Java 21.0.13, Vitest 4.0.17, TZ=UTC**. The full suite used eight workers. The cached Linux dependency install has the same lockfile SHA-256 (`40382e64edb6196ff26fdb8af8aa873303076fc1f1d0905402e9810f66d36e3f`); all **1,119** installed package-version entries match. Private snapshot Git metadata/index allowed the repository metadata tests without changing shared Git state.

| Check | Result |
|---|---|
| Merged-tree full suite | **1,415 files passed, 9 skipped; 31,513 tests passed, 99 skipped**, zero failures; 289.38 s |
| Merged-tree rules suite | **41 files, 768/768**, 231.03 s; includes the executor's F1 tape-lock row |
| Merged-tree `lint:gate` | Exit 0 |
| Merged-tree `vite build` | Exit 0; existing nonblocking warnings retained in the log |
| Original selected unit probes + independent additions | **25 passed**, 31 deliberately filtered pre-amendment/other rows |
| Original F3 + cards-off screen branches | **3 passed**, 104 deliberately filtered rows |
| Expanded merged-tree one-door / acceptance C / Mandate honesty | **48/48**, four test files |
| Original independent emulator probes + additional races/denials | **27/27**, two test files |
| Real Admin SDK read-ABORTED retry probes | **2/2 selected**, 18 filtered rows |
| Fresh cards-off captures | One capture at head, one at supplied main; **12/12 files** equal each other and committed main |
| Targeted mutations | **30 killed, zero correctly targeted survivors, zero broken final runs** |

The initial CA7 strictness mutation accidentally changed the older **form** predicate at `FilmRoomCardRegions.jsx:206`, while selecting the new **receipt** matrix. That mis-targeted run passed. It was corrected to the receipt's `canOffer` at `:480`, and the same matrix failed on the truthy non-true case. Both attempts are retained; the original pass is not presented as a killed mutant or a defect in the receipt test.

The last two retry probes initially could not start because local port 8080 was occupied. No tests ran in that attempt. They passed using dedicated loopback emulator ports (Firestore 8189). No other process was stopped. Initial connector/CLI/sandbox setup failures also are not test failures. No product assertion failed in an unmutated test run.

### Cards off, one door, and fences

The fresh twelve-file comparison covers two days × three depths × desktop/phone. `evidence/golden-comparison.json` holds complete SHA-256 values and both comparisons. No committed golden was rewritten. The independent full-screen grid pending/error/empty and meeting-maker probes also passed, retaining criterion 10/14's declared scope.

Both endpoint gates run before database acquisition. Existing counter/card disabled and not-admitted rows plus the independent nominate/park zero-read/zero-write rows pass. Every card op dispatch follows the same gate. No cards-off receipt or Offer request appears.

Acceptance C's populated handle contains a live idea book and its nomination. The seven assembled prompt strings remain byte-identical to the empty-handle case, with a positive live-read control and **no plays or nominations read**. The expanded closure includes the existing model roots, both honesty registries, Mandate evaluate/rollover, and **every production `api/_utils/mandate*.js` module**, so T0a–T0c's files—including the newly extracted escape/rationale modules—are included. It reaches no card store/seam/stage module and no nomination reader, recursive getter or subcollection listing. The current closed-input/import-classification tests pass. This is the ordinary-import closure and live-handle evidence requested, not arbitrary obfuscated-dataflow proof.

The 35-file branch list contains none of the first review's fenced files, the calibration fence, agent-evaluate, casualClone, rules/indexes, featureFlags, hub modules, Mandate production modules, setup evaluator, or activationEvidence. **oneDoor.census.test.js, the workflow and the CI guard are unchanged.** The round's acceptance-C change only seeds the now-required book. The protected-store scan passes; the new key is exactly `api/_utils/filmRoom/cardStore.js::retireCard::set::unresolved`, **count 1**, with the old retire update count still 1. Its human note accurately describes the withdrawal set, copy synchronization, offered move and CA-22 exception. CB-8 supplies its approval convention. `FILM_ROOM_CARDS_MODE` remains **`'allowlist'`**.

### Tests run — one observation

[Tests run 43403430889](https://github.com/fashraf94/TradeSeven/actions/runs/43403430889), pull-request event, head `0986747a56c7ffaca9f50856afd36ac17e34007f`: **completed, success**. Rules job **131811734924** and unit job **131811735294** succeeded. The golden-baseline guard, dependency install, lint, unit run and emulator test steps actually executed and succeeded. Run interval: **November 13, 2026, 3:41–3:54 AM America/Chicago** (09:41–09:54Z).

The same single metadata observation found PR #1049 open, ready for review, mergeable, exact requested head, and base `c37baa0d`. CI is evidence for its own run, not for the separately supplied `577f17eb` merge; the local merged-tree checks supply that evidence. Connector calls were unavailable, so the read used GitHub CLI and the existing repository credential helper without displaying or saving credentials. There was no polling, rerun, comment, approval or merge action.

### Evidence

The accompanying evidence bundle includes this report, the supplied request/Amendment B, original and adapted probes, explicit adaptation script, additional synthetic probes, immutable snapshot verification summaries, full/focused/rules reports and logs, fresh captures/comparison, targeted mutation reports, CI metadata, and command scripts. `baseline.sh`, `probes.sh`, `after-baseline.sh`, and `retry-sdk.sh` record the executed Linux checks. Paths are this session's local reproduction record; none is production tooling.

## Before merging

**No additional founder action beyond the build report and governing amendments is required by this confirmation.** BG-1 is optional hardening/wording clarification, not a new merge prerequisite. The existing Amendment B/C2 documentation work, counterpart responsibilities, and after-C3 activation gates retain their stated owners and timing.

This verdict applies to the exact head and integration tree above. It recommends the intended **allowlist merge**; it is not a production-access or `'on'` instruction.
