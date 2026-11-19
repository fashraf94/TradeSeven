# Build T1a-2b-3 — the idea book's corporate-action finish (dark)

| | |
|---|---|
| Built by | Claude Code, Nov 17, 2026 |
| Spec | Amendment F, `docs/design/20261117_PRACTICE_FIELD_AMENDMENT_F_CORPORATE_ACTION_FINISH.md`, committed byte-identical (SHA-256 `19c109cfae3d7d1c51be980f00c7613d84bfdb0d812624eb14ed522f4b6d2d00`; first commit b5c84626) |
| Base | `origin/main` @ abcdfcb7 (worktree HEAD at start); `origin/main` @ 2e069d42 merged in at 33b120c9 |
| Code head | 047c77b0; final head 62d49765 (two rows tightened, test file only — §5.4). The suite, lint, build and rules ran at 62d49765; the differentials and the battery at 047c77b0, whose code is identical |
| Branch | `claude/practice-field-t1a2b3-corporate-action-finish` |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No flag value, pin, rules or index changed; no fenced file edited; no model call, Firestore write or EODHD call made |
| Fix round (18 Nov 2026) | Astra's final review (`docs/audits/20261118_ASTRA_REVIEW_T1A2B3.md`, committed byte-identical in ad413fb4) answered in the scope the founder set: commits 737282ed, 3373476c, 943f1286, 782cb74b, d96af701, de7180d0 (code head), and the report's. §10 is the round; §7 is updated |
| Fix round 2 (18 Nov 2026) | Astra's confirmation (`docs/audits/20261118_ASTRA_CONFIRMATION_T1A2B3_ROUND1.md`, T2D-C01 to C05) answered by the founder's Amendment F revision 1, sticky ambiguity (`docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md`); both byte-identical in 1f3adaca. Code head b040987d. §11 is the round; §7.3 is updated |

Contents:
1. In plain terms
2. Changes by `file:line`
3. Readings and questions for the founder
4. Tests
5. The review and the mutation table
6. The end-to-end comparison
7. The register (F-10)
8. New stores and fields; founder steps after merge
9. Found outside the task
10. Astra's final review, and the fix round (18 Nov 2026)
11. Astra's confirmation, Amendment F revision 1 (sticky ambiguity), and fix round 2 (18 Nov 2026)

## 1. In plain terms

**Fix round, 18 Nov 2026 (§10).** Astra's final review returned DO NOT MERGE and NOT READY on twelve findings. In the scope the founder set, seven are fixed, with the agreed Q10, and one is guarded. Four (T2D-03, T2D-04, T2D-05 and T2D-12) move to T1a-2b-4, before the switch; two go to T5. One refuter checked the round and found five more, and a last review found one more of the same class; all are fixed. The founder allowlist stays NOT READY until T1a-2b-4. The rest of this section describes the build as first reported.

**What this build is.** The idea book's last corporate-action work before release: every item of Amendment F (F-1 to F-9), built dark. `PRACTICE_FIELD_MODE` stays `'off'`, so none of it runs in production yet. No rules, index, flag or pin changed, and no fenced file was edited.

**What it changes, item by item.**
- **F-1, a day with no data is a day of doubt.** Each idea now remembers, per stock, the last day its split-and-dividend data was complete. While a stock is uncovered, nothing that depends on its share count is paid or sold, and its price is carried and labelled `ca_coverage_missing`. When the outage is longer than the daily fetch reaches back, the idea book fetches the missing days itself and stores them in a new collection that only the idea book reads (`practiceFieldCaBackfill`). From the fifth day of doubt it alerts. The flag's own time switched off is handled like any other outage.
- **F-2, F-6, F-3.** Actions come from the day's own data document as well as the price snapshot, and a snapshot that names another day's document is not used. One rule now decides whether a day's entry for a stock counts. The gap screen dates a suspicious move from the day its price actually came from.
- **F-4, a doubt holds only what it touches.** A problem in the comparison's own share count no longer freezes the idea's own sale. A doubt about SPY is now named on the result instead of being silent.
- **F-5, `resolve_hold`.** The founder can now settle a hold the data will never clear: a suspected split (a real price move, or a split of a given ratio), a conflicting action (one recorded payload, or none), or a coverage gap (no action, or one fetched row). It is founder-only, works only at the `allowlist` mode or above, and repeats safely. It covers exactly the recorded move.
- **F-7, F-8.** A dividend the vendor re-dates is paid once, not twice. A late dividend is paid on the share count of its own ex-date. A suspicion record and the row that explained it now name each other.
- **F-9.** The close alerts when an idea's document passes 768 KiB.

**What the review found and what changed.** Four reviewers each looked through one lens, and every finding went to a refuter. The refuters confirmed real defects in the new code, chiefly in `resolve_hold`:
- a `price_move` ruling could absorb a second split that happened while the record stood;
- a founder split could be applied twice, or on top of rows already applied;
- a founder split could collide with the feed's own action id;
- re-dated splits did not hold the idea's own sale when the comparison was a sector fund;
- the window's catch-up skipped the backfill.

All of these are fixed, each with a test that fails without the fix. One refuter then checked the fix round and found two more: a moot founder split could still release a dividend, and a book that had never closed skipped the backfill. Both are fixed too. The mutation battery kills all 85 of its mutants. Pre-existing defects the review found, which behave the same on `main`, are recorded in the register as carried, not fixed here.

**Money.** When the data is complete, money moves exactly as before: in the end-to-end run no money figure changed (§6). The quarterly product is unchanged: both differentials against `main` are identical. A planted backfill reaches no quarterly reader, while the same split from the vendor does (§4).

**What the founder is asked.**
- Ten questions (§3.2).
- Sign-off for the new collection (Q6).
- Homes for the carried items that have none (Q8).

The register of every corporate-action item since T1a-1, with its status, is §7. It is the starting point for Astra's final review.

## 2. Changes by `file:line`

Line numbers are at the final code head 047c77b0; the final head 62d49765 adds four assertion lines to one test file. 28 files changed against the base abcdfcb7, +3,598 −315 (`main`'s own Shared Research files excluded). No fenced file (BUILD_RULES §1) was edited.

**Fenced functions called, not edited:**
- `mandateCorporateActions.js`: `pendingActionsFor`, `applyCorporateAction`, `classifyOvernightGaps`, `deriveActionId`. They are called from `ledger.js` only; the exits.test.js import guard is unchanged.
- `mandateUniverseSnapshot.js`: `fetchCorporateActionsEODHD` and `bumpUpstreamCounter`, called from `caBackfill.js`. The module itself is byte-identical to base.

### New modules

| `file:line` | What |
|---|---|
| `api/_utils/practiceField/dailyCoverage.js:53` `dailyDocOf` · `:68` `dailyCoverageOf` | F-6: the one rule for a daily entry, and a document whose `date` is not its key counts as missing |
| `dailyCoverage.js:78` `snapshotNamesDaily` · `:100` `unionActionsBySymbol` · `:125` `dailyActionsBySymbol` | F-2: a snapshot is used only if it names its own session's layer; the union of the layer's rows and the snapshot's |
| `dailyCoverage.js:166` `coveredThroughOf` · `:189` `sessionCoverage` | F-1: continuity from the day after `caCoveredThrough`, through the session's own window or a backfill (FR-2, FR-3); `dailyRefOk` is checked first (review A4) |
| `dailyCoverage.js:140` `CA_COVERAGE_GAP` · `:148` `backfillIdOf` · `:154` `successfulBackfill` · `:218` `openCoverageGap` | F-1: the gap item's id; the backfill's key and the read of a usable backfill |
| `api/_utils/practiceField/caBackfill.js:62` `backfillNeeds` · `:85` `ensureCoverageBackfills` | F-1: fetch and store `practiceFieldCaBackfill/{SYM}` before the close (FR-5); `:44`/`:46`/`:48` the 20 s fetch timeout and 60 s pass budget (review N2); a non-list answer is failed (N4) |
| `api/_utils/practiceField/holdRulings.js:78` `planHoldRuling` | F-5: the ruling's check. For `split`, the residual move and `no_residual_move` (review D5) and the founder split's own id (D6); a `row` dated inside the gap (N1) |
| `holdRulings.js:161` `applyFounderRulings` | F-5: rulings applied first at the next observed close. `price_move` goes through `priceMoveReference` (step record and screen reference: B1, B3, D1, Z1) |
| `holdRulings.js:251` `markRulingsApplied` | F-5: a split ruling is applied when no carrying ledger still holds its record; `outcome: 'moot'` with an alert when nothing applied (B2, B6) |

### Changed modules

| `file:line` | What |
|---|---|
| `ledger.js:202` `POSSIBLE_REDATE` · `:204` `REDATE_WINDOW_SESSIONS` · `:207` `withinSessions` · `:222` `unsettledRedates` | F-7: re-dates within five sessions |
| `ledger.js:350` `screenReferenceOf` · `:352` `screenHoldingOf` | F-5: the gap screen's reference, read at every screen call site (`:318` `paidDividendsExplain`, `:394` `withBasisSuspicions`, `:1388` `saleHeldBackBy`, `:1400` `suspectedActionSymbols`) |
| `ledger.js:366` `markSessionOf` | F-3: a gap is dated from the mark's provenance session (or the screen reference's) |
| `ledger.js:390` `withBasisSuspicions` | F-1: an uncovered symbol is not screened. F-5: `seenAtRaise`/`lastSeen`, refreshed only at covered closes (A1). F-8/B7: the E01 replacement names its row and ruling |
| `ledger.js:457` `priceMoveReference` | F-5 (review B1, B3, Z1): the move from the raise to the last price seen is judged; a split-shaped one is a new record |
| `ledger.js:525` `unresolvedShareBasis` | F-7: share-basis re-dates are doubts. F-5: a founder split is a listed row — only one that would be applied on that state (fix-round refuter NF-1) |
| `ledger.js:576` `LEDGER_OWN_REFUSALS` · `:584` `ledgerOwnDoubtIds` · `:606` `ideaWideDoubtSymbols` · `:622` `shareBasisHolds` | F-4: a paper ledger's own-count doubt holds only that ledger |
| `ledger.js:675` `isFounderSplit` · `:677` `feedRowsOf` · `:682` `founderSplitRowsOf` · `:702` `residualMoveOf` · `:721` `founderSplitMoot` | F-5 (review B2, B5, D5, D6): a founder split keeps its own id, is applied only where its record stands and for the move left |
| `ledger.js:760` `applyActions` (start) | Review C2: held records whose id is settled are dropped |
| `ledger.js:836` (RF-A2 block) | F-7: a conflict settled under a moved date. Review: one row settles one conflict, never a row that is itself a re-date |
| `ledger.js:840` `possibleRedateOf` · `:865` `recordRedate` | F-7, FR-A5: a re-date is recorded, not applied; a held one loses its held record (C2) |
| `ledger.js:912` `retiredHere` (in `causesOf`) | Review round 3: a suspicion retired earlier in the same call holds nothing |
| `ledger.js:1004` (late dividend) | F-7 (C-16): the ex-date count, with earlier-dated splits applied late (C3) |
| `ledger.js:1083` `ruledFor` | Review round 3: the founder's split for a record retires it (D5's residual) |
| `ledger.js:1205` `valueLedger` (`carriedQuality`) · `:1302` `withCloseMarks` | F-1: an uncovered mark is carried as `ca_coverage_missing`. F-5: a fresh mark drops the screen reference |
| `ledger.js:1355` `saleHeldBackBy` | F-1, F-4: the sale gate. Review C1: the own ledger's share-basis re-date holds; C2: settled held records hold nothing |
| `close.js:104` `IDEA_DOC_ALERT_BYTES` · `:106` `ideaDocSizeAlert` · `:922` | F-9 |
| `close.js:113` `CA_COVERAGE_GAP_ALERT_SESSIONS` · `:135` `coverageAfterClose` | F-1: `caCoveredThrough`, gaps and the fifth-session alert |
| `close.js:208` `closeFilledIdea` (`:216` rulings, `:228` coverage, `:298` gap holds, `:401` `markRulingsApplied` with founder skips) | F-1, F-5 |
| `close.js:580` `closeNextSession` (`:655` the daily read inside the transaction; `:738` the book mirror pays a late dividend on `entitledShares`) | F-2, F-7 |
| `close.js:1021` `catchUpIdeaBook` (`:1034` the backfill, also for a book that has never closed: NF-2) · `:1064` `closeIdeaBook` (`:1076`) | F-1; review A2 |
| `sweep.js:217` | Review A2: the window passes its last close, so the catch-up spends no read when nothing was missed |
| `exits.js:88` `SNAPSHOT_DAILY_MISMATCH` · `:178` · `:190` | F-2, F-1: the sale's refusals, in order |
| `admissionMarks.js:69` `CA_COVERAGE_REFUSAL.COVERAGE_GAP` · `:78` `caCoverageOf` · `:205` · `:260` | F-6, F-2, F-1 on admission |
| `settlement.js:196` `ledgerEndpoint` · `:263` `ledgerDoubts` · `:479` `spy.inDoubt` | F-4; F-1 gap ids; review D2–D4: re-dates counted (share basis) and named (both kinds) |
| `founderControls.js:58` `FOUNDER_ACTIONS` · `:115` · `:120` `resolveFieldsOf` · `:131` `applyResolveHold` | F-5: `resolve_hold`, behind the same two gates, idempotent |
| `constants.js:107` `MARK_QUALITY.CA_COVERAGE_MISSING` · `evidence.js:332` `firestoreDocumentBytes` | F-1, F-9 |
| `api/practice-field/founder.js` (header) | F-5: the action named |
| `api/_utils/compositionProtectedStoresScan.js:322` · `compositionProtectedStoresAllowlist.json` (`_notes_practice_field_t1a2b3` + 3 keys) | FR-23 |
| `__testsupport__/fixtures.js` | Each stored snapshot names its session's daily layer; the fixtures keep that layer (`dailyRefOf`, `mergeDailyLayerOf`, `omitDailyEntry`) |

### Tests

| File | What |
|---|---|
| `corporateActionFinish.test.js` (new, 92 tests) | Every row of the item table, the race rows, the review's fix-round rows (§5) |
| `corporateActions.test.js`, `exits.test.js`, `admissionMarks.test.js`, `evidence.test.js`, `results.test.js`, `founder.test.js`, `catchUp.test.js`, `windowLedger.test.js` | Updated for F-3's provenance, F-4, F-7's re-dates, the record's new fields, and the empty vendor key |
| `endToEnd.test.js` | Re-pinned (§6), plus the new coverage-gap end-to-end case |
| `docs/design/20261117_PRACTICE_FIELD_AMENDMENT_F_CORPORATE_ACTION_FINISH.md` + `docs/README.md` row | Amendment F, byte-identical (first commit b5c84626) |

## 3. Readings stated, and questions for the founder

### 3.1 Readings

Where Amendment F's letter stops, this is the reading built. A reading marked *(review)* was settled in the review's fix rounds (§5).

| # | Where the letter stops | Reading built |
|---|---|---|
| FR-1 | F-6 "a plain object and `caFetchFailed` is absent or exactly `false`. Any other value (`false`, `0`, `''`, `'true'`, `1`, an array) is not covered" | The list's `false`, `0`, `''` and the array are read as values of the ENTRY itself (the refuter's odd entries), since `caFetchFailed: false` is the rule's own covered value. A plain object with `caFetchFailed` absent — `{}` included — is covered (the letter); `caFetchFailed: null`, `0`, `''`, `'false'`, `1`, `'true'`, `[]` are not. `undefined` counts as absent. Own properties only (`Object.hasOwn`), on all three paths (Q2) |
| FR-2 | F-1 "A session covers a symbol when that session's daily document holds a valid entry for it" and "the doubt clears when the data covers every session since `caCoveredThrough`" | Coverage is CONTINUITY: the rows known for the symbol must reach, without a hole, from the day after `caCoveredThrough` through the session — the session's own valid entry (from its fetch window's first day: the document's `caWindow.from`, never wider than `MANDATE_CA_FETCH_LOOKBACK_DAYS`), joined if need be by a successful backfill. A session whose own entry failed is covered only by a backfill that reaches the session itself |
| FR-3 | F-1 "Each idea records, per held symbol, the last session its corporate-action data covered" | Written at every close (`idea.caCoveredThrough`). A symbol with no record yet — the first close after the entry, or a ticker change's new symbol — starts from the earliest `openedAt` of its holdings: nothing dated on or before it is owed (the engine's entitlement), so nothing before it can be missed. A ticker change applied at a covered close hands the new symbol that session |
| FR-4 | F-1 (unobserved sessions are not named) | A session with no stored close snapshot presents no data and changes no ledger (E12): it neither advances `caCoveredThrough` nor opens a gap; an open gap counts it as a session of doubt (and alerts from the fifth) |
| FR-5 | F-1 "the idea book asks the daily builder for a backfill" | The idea book's close asks, before its transactions (`closeIdeaBook` → `caBackfill.js ensureCoverageBackfills`), through the daily builder's own fetch (`mandateUniverseSnapshot.js fetchCorporateActionsEODHD`, called, not edited, with the same parsers). The daily builder module itself is untouched, so the quarterly daily documents are byte-identical by construction. The rows are stored in a new server-only collection, `practiceFieldCaBackfill/{SYM}` — one document per symbol holding the widest successful range, so a catch-up that moves `caCoveredThrough` forward session by session keeps reading it, and SPY (in every idea) is fetched once. *(review A2)* The window's catch-up — usually the first close after an outage, since windows run before the day's close — backfills first too, through the window's date, whenever it may have sessions to close — a book that has never closed included (fix-round refuter NF-2); the window passes its last close, so no read is spent when it closed the session before. *(review N2)* The pass is bounded: one fetch with no answer in 20 s is a failed one, and after 60 s no further symbol is asked that call; each left in doubt is alerted and asked again at the next close. An answer whose rows are not a list is a failed one (N4) (Q3) |
| FR-6 | F-1 "an in-session sale already waits on such a day; admission already refuses" | Sales and admission test the SAME continuity as the close, from `caCoveredThrough` (not the close's last recorded gap): on the day after a short outage the day's window already reaches over the gap, and anything listed in it holds the sale as a due action; on the first day after an outage longer than the window, today's entry is clean but the sale and admission still wait for the close's backfill (`ca_coverage_gap`) |
| FR-7 | F-1, beside the gap screen | An uncovered symbol is not put through the gap screen: its doubt already holds everything that depends on its count and carries its mark. It is screened at the close whose data covers it, after the rows that data lists are applied (so a split in the gap adjusts the reference first, and no record is raised that a later row could fail to explain) |
| FR-8 | F-1 "a quality naming the missing coverage" | `ca_coverage_missing` (constants.js MARK_QUALITY), on the row's mark of an uncovered symbol; the mark is carried (`markSource: carry_over`, its provenance unchanged) |
| FR-9 | F-2 "A price snapshot whose `dailyRef` does not name that session's daily document is not used" | Admission refuses (`snapshot_daily_mismatch`) and does not fall back to an older snapshot (the newest valid one is the decision's one set of marks); a sale waits (`snapshot_daily_mismatch`, a corporate-action hold); the close uses none of the snapshot's prices or rows — every held symbol is uncovered that session and carried, *(review A4)* the entry session included. The session's own daily layer (valid under F-6) still presents its rows, which are recorded as held |
| FR-10 | F-2 "No row is dropped" | A partly failed entry's rows (one leg answered) are part of the union; the session is still uncovered (F-1), so what they move waits, recorded — a share-basis row as much as a dividend |
| FR-11 | F-4 "A doubt in one paper ledger's own count" | A paper ledger's (comparison's, SPY line's) doubt is its OWN when a share-basis action is refused for a reason of its holding — `rounds_to_nothing` or `no_entitlement_data` — and so is anything it holds behind only such doubts on that ledger (to a fixpoint). A refused ratio (`bad_ratio`), a conflict, a held action behind another ledger's item, a suspicion, a coverage gap and a share-basis possible re-date are doubts about the symbol. A doubt in the IDEA's own count still holds the whole idea (its same-stock comparison has the same count) |
| FR-12 | F-4 "the result names it" | `result.spy.inDoubt`: one entry per SPY-ledger symbol in doubt — its reasons (conflict, held or refused action, suspicion, coverage gap, *(review D2)* possible re-date, by id) and every cash dividend it holds and has not paid (a dividend's possible re-date included, naming what it may repeat). Always present (`[]` when clear) |
| FR-13 | F-5 "Applied once at the next close" | The action records the ruling on the idea (`founderRulings`) in its own transaction; the idea book's next OBSERVED close applies it first, before anything else of that close, and marks it `appliedOn`. A ruling whose action is held behind another doubt stays pending and is applied at the first close that can |
| FR-14 | F-5 "It covers exactly the recorded move: its session, ratio and frozen mark. Any later split-shaped gap, an identical one included, raises a new record" | *(review B1, B3, D1; lens A A1; Z1)* A record keeps the price seen at its own session (`seenAtRaise`, written once) and the last price seen while it stands (`lastSeen`, refreshed only at a close whose data covers the symbol). A `price_move` ruling retires the record (its history names the ruling), releases what it held — paid once on the current count — and puts the move from `seenAtRaise` to `lastSeen` to the engine's own screen (`ledger.js priceMoveReference`): a split-shaped one is the move the record hid — a second halving while it stood, or a recovery — and is a NEW record of that move (first seen at `lastSeen`'s session, frozen at `seenAtRaise`'s price), alerted `PRACTICE_FIELD_HOLD_RULING_STEP`. The gap screen's reference becomes the last price seen (with a new record: the ruled session's price), kept as `screenReference` beside the mark — the mark and its provenance are never rewritten, so a carried price still cites the snapshot that priced it. Every gap screen of the holding reads it; a share-basis action dated after its session divides it; the first fresh mark replaces it. So: an identical later halving is a new record (Z1); a listed split applied after the ruling re-suspects nothing (Y4); a later move is judged against the last price seen (N3). The provisional reader (`resolvedBy`/`resolvedAt` read as a ruling, the signature match, `spentOn`) is removed; a record keeps the two null fields for its shape (Q5) |
| FR-15 | F-5 "It names the exact record it covers" | A suspicion's id (`suspected_split_SYM_<suspectedOn>`) names the move, not a ledger: a ruling covers every ledger of the idea that carries that record (`ledgers`, recorded with the ruling) |
| FR-16 | F-5 `split` "applies the split once at the next close, with a founder receipt" | *(review B2, B5, D5, D6)* The founder's ratio must be the split of the move the record STILL stands for on every ledger carrying it: its recorded move less what share-basis rows applied since it was raised, dated inside its gap, account for (`residualMoveOf`); with nothing left (T1a-2a Q-V: two rows together explain it) the ruling is refused `no_residual_move` — `price_move` is the ruling then. The split is dated the record's `suspectedOn` and carries its own id: the record's split id, or `founder_<that id>` when the feed has already settled that id on a ledger carrying the record (a feed split on the move's own session that explained only part of it). At the next observed close it is applied in date order after that close's rows, once, on each ledger whose record still stands and for the move still left — a row of that close that explains the record first leaves it moot, and a ledger that never carried the record never takes it — with a founder receipt (a split moot on the state it meets explains nothing in the hold set either, so the record keeps holding what is dated in its gap: fix-round refuter NF-1); applied, it retires the record (it is the founder's account of the rest). A ruling applied on no ledger is closed `outcome: 'moot'`, alerted `PRACTICE_FIELD_HOLD_RULING_MOOT`, and a record still standing takes a new ruling. A later feed row of the founder's id is skipped; one of another date within five sessions is a possible re-date (F-7) |
| FR-17 | F-5 `coverage_gap` "No action in the gap's dates, or one recorded backfill row" | `no_action` counts the symbol covered through the gap's last session at the ruling; this close's own data covers it from there. `row` picks one row from the stored backfill (a failed fetch's partial rows included), dated inside the gap — after its first day, on or before its last session — applied once |
| FR-18 | F-7 "is not applied" (what it holds is not named) | A share-basis possible re-date is a doubt about the symbol's count — it is either the same split (the count is right) or a second one (it is not) — so it holds, as a conflict does, durably (its receipt): the close, *(review C1)* the idea's own sale and admission on every comparison kind, and *(review D2, D3)* the endpoint, which counts it as an unsettled action. A cash dividend's holds nothing (no count is in doubt; only that payment waits for the founder); the endpoint names it, with the dividend unpaid, and does not count it (D4; Q9). "Within 5 sessions": at most 5 trading sessions apart. It applies within one close too |
| FR-19 | F-7, consequence | Astra's T2A-E01 case — a 2-for-1 on Nov 17 and another on Nov 18 — is now a possible re-date: the second waits for the founder, and so does the dividend behind it; the founder's `conflict` ruling then pays $799.76 once (Q1) |
| FR-20 | F-7 "A late cash action" | Cash DIVIDENDS: a cash delisting dated before an applied split closes the holding; it is not treated as late. The count is the `sharesBefore` of the FIRST APPLIED share-basis receipt dated after the dividend (the receipts are kept in the order applied), *(review C3)* then each share-basis receipt dated on or before the dividend but applied after that one (listed late), in date order, rounded at each step as the applier rounds. With none on record, nothing is estimated: the dividend is held, refused `count_on_ex_date_unknown` |
| FR-21 | F-8 | A record is never deleted: an explained or ruled one is retired into the holding's `basisSuspicionHistory`, naming the row (`explainedBy`) or the ruling (`ruling`, `resolvedBy`, `resolvedAt`); the receipt names it by id (`explainedSuspicion.id`). The T2A-E01 replacement path retires the old note naming its explaining row — *(review B7)* and the ruling, when the founder's split explained it — and that row's receipt names it |
| FR-22 | F-9 "measure the idea document" | By Firestore's storage rules: the document name's segments (bytes + 1 each, + 16), its fields, + 32 (`evidence.js firestoreDocumentBytes`), before every changed idea is written; from 786,432 bytes |
| FR-23 | (a new server-only collection) | `practiceFieldCaBackfill` is added to the protected-store scan's `PROTECTED_COLLECTIONS`, its write sites allowlisted with notes, as T1a-1 did for its collections |
| FR-24 | F-7, a re-date of something already held *(review C2)* | A held action found to be a possible re-date keeps no held record: its `possible_redate` receipt governs it, and the founder may apply or decline it. A held record whose id has since been settled (applied, or declined by a ruling) holds nothing and is dropped at the next close |
| FR-25 | F-7 (RF-A2) "applied once and the old id settled by it" *(review)* | One listed row settles at most one conflict, and never a row that is itself a possible re-date of an action already applied or held (it is not applied, so it cannot be what settled the conflict; the conflict then waits for the founder) |

### 3.2 Questions for the founder

| # | Question | Built |
|---|---|---|
| Q1 | Two GENUINE identical splits within five sessions (Astra's synthetic T2A-E01 case) are, under F-7's letter, indistinguishable from one split re-dated: the second waits for your ruling, and so does any dividend behind it. Keep, or apply the second when the price confirms it? | Waits |
| Q2 | Under F-6's letter an entry of `{}` counts as covered. Refuse it instead? | Covered |
| Q3 | The backfill is fetched by the idea book itself — its close, and the window's catch-up when sessions were missed — before closing, through the daily builder's fetch, bounded at 20 s a fetch and 60 s a pass. The alternative — the cron's daily build fetching requested backfills — was not built (it would touch the quarterly cron). Keep? | The idea book fetches |
| Q4 | A payer of the same dividend within five sessions (a weekly payer) reads as a possible re-date: every second payment is held for your ruling. The house universe has no weekly payer today. Acceptable for release 1? | Held |
| Q5 | A `price_move` ruling judges the move the record hid: if the price moved again with a split's shape while the record stood — down again, or back up — that move is a new record, for another ruling. Keep? | New record |
| Q6 | Sign-off for the new server-only collection `practiceFieldCaBackfill` (protected-store scan listed, two allowlisted write sites) | Listed |
| Q7 | A `split` ruling is refused `no_residual_move` when rows applied since inside the record's gap already account for the whole move (T1a-2a Q-V): the count is right, and `price_move` is the ruling that clears the record. Confirm that remedy for Q-V? | Refused; `price_move` |
| Q8 | Several carried items in §7 have no task to live in (marked "home: to be named"). Name a home for them — a corporate-action residue task after T1a-2b-3, or each into an existing tranche? | Listed, unhomed |
| Q9 | A dividend's possible re-date at the endpoint is named on the result (SPY's `inDoubt`; every ledger's doubts), with the dividend unpaid, but does not make the result unmeasurable — F-7 says it "holds nothing". Count it instead? | Named, not counted |
| Q10 | A re-date of a dividend the idea was NOT entitled to (bought on the original ex-date) is paid when the vendor moves the date one session later (F-7's letter covers rows matching an action "applied or held", not declined). Treat a decline as a match too? | Paid |

## 4. Tests: commands, exit codes and log lines

The final head is **62d49765**, which has `origin/main` (2e069d42) merged in. Its code is that of 047c77b0; it adds four assertion lines to one test file (§5.4). The suite, lint, build and rules ran at 62d49765. The differentials and the battery ran at 047c77b0. The report's own commit adds documents only, and it is built again before the push (the PR description records that build).

| Check | Where, and the command | Exit | Log lines |
|---|---|---|---|
| Full suite (Linux) | WSL worktree of `~/pd-ci` checked out at 62d49765: `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **0** | `Test Files  1561 passed \| 13 skipped (1574)` · `Tests  35551 passed \| 173 skipped (35724)` · `Duration  287.23s` |
| Lint gate | the same tree: `npm run lint:gate` (`eslint . --config eslint.gate.config.js --max-warnings 0`) | **0** | no output past the command line (no error, no warning, `--max-warnings 0`) |
| Build | the same tree: `npx vite build` | **0** | `✓ built in 16.29s` |
| Rules suite | the same tree: `npm run test:rules` (Firestore emulator) | **0** | `Test Files  46 passed (46)` · `Tests  839 passed (839)` |
| Seventeen-scenario quarterly differential | Astra's harness (`astra-differential.test.js`), base `git archive` of `origin/main` 2e069d42 against head 047c77b0: `node ../node_modules/vitest/vitest.mjs run --config vitest.config.mjs` | **0** | 17 scenarios × modes `off` and `on`: **34/34 identical**; 4,000 default build sets identical; quarterly prompts byte-identical in 4 cases (with or without a real idea book; positive control detects a leak) |
| 40-case traced differential | Astra's harness (`astra-cron-trace.test.js`), the same run | **0** | **40/40 identical** |
| Both harnesses | (the run's own lines) | **0** | `Test Files  2 passed (2)` · `Tests  76 passed (76)` |
| Backfill isolation (rule 5) | A scenario added beside Astra's harness, in the scratchpad (`astra-backfill-isolation.test.js`; her mocks and `run()` unchanged but for three seams), base 2e069d42 against head 047c77b0, modes `off` and `on`: the quarterly close of a book holding AAPL, with `practiceFieldCaBackfill/AAPL` planted, holding a 2-for-1 and a $1.50 dividend dated that session | **0** | `Tests  4 passed (4)`. **Planted:** base and head identical, and the head identical to the plain close but for the planted document (AAPL 100 shares, cash $90,000, as without it). **Positive control:** the same split answered by the vendor, through the daily layer, does reach the quarterly close (100 → 200 shares), base and head alike |
| The idea book (Windows, targeted) | `vitest run api/_utils/practiceField api/practice-field api/cron/practiceFieldIsolation.test.js api/_utils/compositionProtectedStores.scan.test.js --maxWorkers=6` | **0** | `Test Files  23 passed (23)` · `Tests  723 passed (723)` |
| Mutation battery | `run-battery.mjs` on a `git archive` of 047c77b0, and its two survivors rerun at 62d49765 (§5.4) | — | defined 85, ran 85, broken 0, **killed 85**, survived 0 |

**Earlier full runs of this build**, all exit 0:

| Head | Test Files | Tests |
|---|---|---|
| acd2e40e (mid-build) | 1558 passed \| 12 skipped | 35214 passed \| 135 skipped |
| 33b120c9 (after fix round 3 and the merge) | 1561 passed \| 13 skipped | 35548 passed \| 173 skipped |
| 047c77b0 (after fix round 4) | 1561 passed \| 13 skipped | 35551 passed \| 173 skipped |

At 33b120c9 and again at 047c77b0 these also passed: lint gate 0, build 0, rules 0 (`Test Files 46 passed (46)`, `Tests 839 passed (839)`), and both differentials (34/34, 40/40).

**Rule 5 — the backfill reaches no quarterly reader.** The two differentials show that the quarterly product is unchanged, but neither scenario has a stored backfill. The backfill-isolation row above is the direct proof, at both modes: a planted backfill is ignored, and its control shows the scenario would see the same split arriving by the quarterly path. The rest of the evidence:
- The F1-05 mutant (a backfill written into the daily layer) is killed by "the backfill is confined".
- Lens A and its refuter read every reader of the collection: only the idea book's close and `resolve_hold` read it.

**No vendor call.** No Linux run had an EODHD key. The final suite log has 25 lines saying the key is not configured, all from rows whose backfill fails at once, and no request to the vendor. Three test files now stub the key empty, so a key exported in a shell cannot reach the vendor either (§9).

**No model calls and no Firestore writes** were made by this session: every store in these runs is the in-memory fake or the local emulator.

**The six named mutants** (the build prompt's list) are in the battery, §5.4:

| Named mutant | Battery id |
|---|---|
| The close writing a fresh mark on an uncovered session | F1-01-close-fresh-mark-uncovered |
| Backfill rows reaching the quarterly daily entry | F1-05-backfill-reaches-quarterly-daily |
| A later identical gap covered by an old ruling | F5-01-old-ruling-covers-identical-gap, plus R-B1-step-never-judged |
| A re-dated dividend paid twice | F7-01-redated-dividend-paid-twice |
| A paper-only doubt holding the idea's sale | F4-01-paper-doubt-holds-idea-sale |
| `resolve_hold` acting without both gates | F5-02-mode-gate-dropped, F5-03-allowlist-gate-dropped |

## 5. The review and the mutation table

### 5.1 How it ran

BUILD_RULES §2 review, on snapshot trees (`git archive` of the code head 659423ee, one per reviewer, read-only on git and the shared tree):
- **Four lenses:** (a) coverage, the backfill and quarterly isolation; (b) holds, `resolve_hold` and the suspicion record; (c) re-dated and late actions, and conservation across all three ledgers; (d) results — F-4's endpoint and the register's accuracy.
- **Refuters:** every finding went to a refuter, one per lens, with the probes.
- **Fix rounds:** four, as commits c1ac840a, e4567825, d27c80c9 and 047c77b0. Each fix has a row that fails without it; the mutation table proves it. `main` was merged at 33b120c9, between rounds 3 and 4. 62d49765 tightens the two rows the battery asked for (§5.4).
- **Fix-round refuter:** one refuter checked the fix round on its own tree (§5.3).

### 5.2 Findings, verdicts and what was done

Severity follows the rubric: **must-fix** means money moves wrongly or a rule of Amendment F is broken. "Refuter" is the refuter's verdict.

| Id | Lens | Finding | Refuter | Done |
|---|---|---|---|---|
| A1 | a | A `price_move` ruling took the last price seen while the record stood as the reference, so a further unfed halving was absorbed and a later dividend paid on the old count. The refresh also read prices from closes the data did not cover | CONFIRMED, must-fix (same root as B1) | **Fixed** (FR-14): the move since the raise is judged; `lastSeen` only at covered closes. Rows B1, A1, Z1 |
| A2 | a | The window's catch-up, usually the first close after an outage, never backfilled. The gap sessions were closed as doubt, and a dividend owed before the due session landed after it | CONFIRMED, should-fix | **Fixed** (FR-5). Row A2 |
| A3 | a | A parser-rejected row leaves the fetch "successful" and empty, on the daily layer and the backfill alike | DOWNGRADED, low, pre-existing | **Carried** (§7): the shared fetch is quarterly and untouched |
| A4 | a | On the entry session a snapshot naming another layer was still used | DOWNGRADED, nit, unreachable | **Fixed** (FR-9). Row A4 |
| A-N1 | a | The backfill's documented key said `{SYM}_{from}` | CONFIRMED, nit | **Fixed** (comment and allowlist note) |
| A-N2 | a | The backfill fetch had no timeout, under the cron's lease | CONFIRMED, low | **Fixed**: 20 s per fetch, 60 s per pass. Row N2 |
| A-N3 | a | Rows that close across a long gap reached the real fetch, which only failed because no key was set | CONFIRMED | **Fixed**: the key is stubbed empty in the three files; a row pins it. No call was ever made (§9) |
| A-N4 | a | A non-list `actions` was stored as a successful backfill | REFUTED (test seam only) | Hardened anyway. Row N4 |
| B1 | b | = A1, reproduced with feed kinds only: $199.94 paid where $399.88 was owed, for good | CONFIRMED, must-fix | **Fixed** (FR-14) |
| B2 | b | The founder's split and the feed's row for the same move, at the same close, both applied (799.76 shares instead of 399.88) | CONFIRMED, must-fix | **Fixed** (FR-16): applied only where the record stands. Row B2 |
| B3 | b | A split held behind the record re-suspected the holding after `price_move` | CONFIRMED, should-fix | **Fixed** (FR-14). Row B3 |
| B4 | b | F-4's own-count narrowing lasts one close (the screen turns it into a symbol doubt) | DOWNGRADED to note: unreachable under today's admission | **Carried** (§7) |
| B5 | b | A founder split reached ledgers that never carried its record | DOWNGRADED to note (B4's state) | **Fixed** by B2's gate. Row B5 |
| B6 | b | A ruling stuck pending on one ledger locks its record | DOWNGRADED to note | The reachable part is fixed: a moot split closes its ruling. The rest is **carried** (§7) |
| B7 | b | On the E01 replacement path, the retired record did not name the founder's ruling | CONFIRMED, note | **Fixed** (FR-21). Row B7 |
| B-N1 | b | A `row` ruling accepted a backfill row dated after the gap | REFUTED as stated | Hygiene fixed (FR-17). Row N1 |
| B-N2 | b | A payload ruling on a delisting or rename conflict cannot carry the cash or new ticker | CONFIRMED, note: founder-written rows only (C-12) | **Carried** (§7) |
| C1 | c | A share-basis possible re-date on the idea's own ledger did not hold its sale or admission when the comparison does not hold the name. Sold 129.57 shares for $12,088.91 where 194.35 were held | CONFIRMED-NARROWER, must-fix | **Fixed** (FR-18). Row C1 |
| C2 | c | When the founder applied a re-date of a held dividend, the original's held record stayed for good. Every founder option was wrong; `payload` paid twice | CONFIRMED-BROADER, must-fix | **Fixed** (FR-24). Rows C2, C2 backstop |
| C3 | c | A late dividend's count missed an earlier-dated split applied after a later-dated one (−$21.59) | CONFIRMED, must-fix | **Fixed** (FR-20). Row C3 |
| C4 | c | After a rename, the vendor relisting an action under the new ticker applies it twice | CONFIRMED, pre-existing (equal on base) | **Carried** (§7) |
| C5 | c | A late dividend across a ticker change is paid on the current count | CONFIRMED, pre-existing in effect | **Carried** (§7) |
| C6 | c | = D2 | CONFIRMED | **Fixed** |
| C7 | c | A re-date of a not-entitled dividend is paid | REFUTED as a defect (F-7's letter); a share-basis analogue is pre-existing | Q10; analogue **carried** (§7) |
| C-n1 | c | One listed row settled two conflicts | CONFIRMED, note | **Fixed** (FR-25). Row RF-A2 one row |
| C-n2 | c (refuter) | A conflict was declined `settledBy` a row that was itself then refused as a re-date | CONFIRMED, must-fix by the rubric (fails closed) | **Fixed** (FR-25). Row RF-A2 re-date |
| C-n3 | c | Weekly same-amount payer: every second payment held | CONFIRMED, note | Q4 |
| C-n4 | c | A late dividend after the idea's line sale is never paid to the idea | CONFIRMED, pre-existing | **Carried** (§7) |
| D1 | d | After `price_move`, the next carried mark cited a session whose row did not price it: the result packet failed its own checks | CONFIRMED-BROADER, must-fix | **Fixed** (FR-14): the mark is never rewritten. Row D1 runs to the due session and checks the packet |
| D2 | d | SPY's share-basis possible re-date was not named on the result | CONFIRMED, must-fix | **Fixed** (FR-12, FR-18). Row D2/D3/D4 |
| D3 | d | The same on the idea and comparison: unmeasurable only through mark quality | CONFIRMED, should-fix | **Fixed** |
| D4 | d | A cash possible re-date at the endpoint is neither counted nor named | CONFIRMED, note (by design) | Named, not counted (Q9) |
| D5 | d | A `split` ruling stacked on rows already applied inside the gap (Q-V): 799.76 shares became 3,199.04 and could not be undone | CONFIRMED-BROADER, must-fix | **Fixed** (FR-16): residual move, `no_residual_move`, and a check at the close. Rows D5, D5 at the close. Register remedy corrected (Q7) |
| D6 | d | The founder split's id collided with an applied feed split, so it was stamped applied while doing nothing — the typical real-feed shape | CONFIRMED-BROADER, raised to must-fix | **Fixed** (FR-16): its own id. Row D6 pays $799.76 on 799.760068 shares |
| R1–R7 | d | The register: C-17's status, homes, status words, missing items (F-3's source, T1a-2b-2 §8 item 2, and others), C-6's evidence, C-8's home | CONFIRMED (R5 narrower) | Corrected in §7 |
| Self | — | Found while writing D5's row: the founder's residual split applied but left its record standing, because its ratio is not the recorded move's | — | **Fixed** (round 3, FR-16). Row D5 at the close |
| R6 / C-6 | d, register check | No row tested C-6's own case, a dropped SHARE-BASIS conflict ruled by payload | CONFIRMED (evidence gap) | **Row added** (round 4): Fin:1392, applied once on the idea, its comparison and the book |
| NF-1 | fix-round refuter | A founder split found moot at the close still "explained" its record in the hold set, so a dividend or cash delisting dated in the gap was paid while the record stood | must-fix | **Fixed** (round 4, FR-16). Row NF-1 |
| NF-2 | fix-round refuter | The window's catch-up skipped the backfill for a book that has never closed | should-fix (fails closed) | **Fixed** (round 4, FR-5). Row NF-2 |

### 5.3 The fix-round refuter

One refuter checked the fix round (e4567825) on its own tree, with probes.

| Claim | Verdict |
|---|---|
| C1: the own ledger's share-basis re-date holds the sale and admission | HOLDS |
| C2: a re-date drops its held record; a settled held record holds nothing | HOLDS. No settled id can still be owed (applied, `not_entitled`, `founder_ruled_none`, `settled_by_redate`) |
| C3: the ex-date count replays the earlier-dated late splits, rounded as the engine rounds | HOLDS |
| RF-A2: one row per conflict, never a re-date row | HOLDS |
| F-5 `price_move` | HOLDS. Every gap-screen call site reads the screen reference; `seenAtRaise` is written once; `lastSeen` skips uncovered closes; a fresh mark drops the reference |
| F-5 `split` | BROKEN, as **NF-1**, fixed in round 4 |
| The endpoint's re-dates | HOLDS |
| Lens A | INCOMPLETE, as **NF-2**, fixed in round 4. Test stubs hold: a spy over the whole folder found only rows that stub the key, or pass their own fetch and a synthetic key |

It also checked the baseline: the e2e money pin passes, and no file outside `api/_utils/practiceField/` changed apart from the allowlist note. Two minor notes, neither a defect:
- A record raised against a screen reference keeps the old mark's `frozenMarkAsOf`, a display field.
- After a ruling, a missing quote carries the pre-move mark (D1's trade-off); the row says it is not full quality.

The refuter's NF-1 fix was verified on a patched copy of its tree before it was applied here.

### 5.4 The mutation battery

Method (`run-battery.mjs`):
- Each mutant's anchor must occur exactly once in a `git archive` tree of the head, or it counts as BROKEN and is not run.
- The file is mutated, and the idea book's rows run with a JSON reporter: `api/_utils/practiceField`, `api/practice-field`, `practiceFieldIsolation`, `practiceFieldNoBook.trace`, and the protected-store scan.
- The verdict is the exit code plus the failing rows' names.
- The file is restored and compared.

The baseline run at each head failed 0 of 768 rows.

**Result.**
- **Defined 85, ran 85, broken 0, killed 85, survived 0.**
- 54 mutants are the build's own, at least one per Amendment F item; 7 of them were re-anchored to the fix-round code.
- 31 are the review's fix items.

The battery ran at the code head 047c77b0. Two survived there:
- F7-04: its row moved the price back at S[3], so the gap screen's own record masked the doubt under test.
- R-held-founder-loses-ruling: no row read the held record's ruling.

Both rows were tightened (62d49765, test file only), and the two were rerun there: both killed. Each kill was checked against its failing rows' names: every one is killed by the row written for it, or by rows of the same item.

| Mutant | Item | File | Rows failed | First failing row | Head |
|---|---|---|---|---|---|
| `F1-01-close-fresh-mark-uncovered` | F-1 | `close.js` | 18 | a book that has never closed starts at the first session it held anyth… | 047c77b0 |
| `F1-02-gap-holds-nothing` | F-1 | `close.js` | 9 | THE CLOSE: the name with that entry is carried, named `ca_coverage_mis… | 047c77b0 |
| `F1-03-covered-through-advances-on-doubt` | F-1 | `close.js` | 20 | a book that has never closed starts at the first session it held anyth… | 047c77b0 |
| `F1-04-alert-after-fifth` | F-1 | `close.js` | 2 | the fifth session of doubt alerts PRACTICE_FIELD_CA_COVERAGE_GAP — onc… | 047c77b0 |
| `F1-05-backfill-reaches-quarterly-daily` | F-1 | `caBackfill.js` | 1 | the backfill is confined: it writes only its own documents (and the da… | 047c77b0 |
| `F1-06-backfill-rows-unused` | F-1 | `close.js` | 5 | a gap LONGER than the fetch window: the doubt stays until a BACKFILL s… | 047c77b0 |
| `F1-07-window-always-reaches` | F-1 | `dailyCoverage.js` | 6 | a book that has never closed starts at the first session it held anyth… | 047c77b0 |
| `F1-08-sale-ignores-continuity` | F-1 | `exits.js` | 9 | THE SALES: a pending sale of the name with that entry waits under its … | 047c77b0 |
| `F1-09-admission-ignores-continuity` | F-1 | `admissionMarks.js` | 1 | F-1 on ADMISSION: the first day after an outage longer than the window… | 047c77b0 |
| `F1-10-screen-not-skipped` | F-1 | `ledger.js` | 3 | a 2-for-1 DURING an outage halves the price: the screen leaves the unc… | 047c77b0 |
| `F1-11-backfill-never-asked` | F-1 | `close.js` | 4 | a gap LONGER than the fetch window: the doubt stays until a BACKFILL s… | 047c77b0 |
| `F1-12-backfill-narrows` | F-1 | `caBackfill.js` | 1 | the backfill never NARROWS: a stored success that starts after the nee… | 047c77b0 |
| `F1-13-gap-item-holds-only-cash` | F-1 | `ledger.js` | 1 | FR-10: a FAILED entry's own rows are part of the union, but the sessio… | 047c77b0 |
| `F1-14-endpoint-ignores-gap` | F-1 | `settlement.js` | 1 | a due session inside a coverage gap: the endpoint is UNMEASURABLE and … | 047c77b0 |
| `F2-01-close-drops-daily-rows` | F-2 | `close.js` | 2 | R7a / R7b — the layer lists a reverse split the snapshot does not: ADM… | 047c77b0 |
| `F2-02-close-ignores-daily-ref` | F-2 | `close.js` | 1 | R7d, and a snapshot naming ANOTHER session's layer: the snapshot is no… | 047c77b0 |
| `F2-03-admission-ignores-daily-ref` | F-2 | `admissionMarks.js` | 2 | NO daily document for the session at all, with a held name: refused — … | 047c77b0 |
| `F2-04-sale-ignores-daily-ref` | F-2 | `exits.js` | 1 | R7d, and a snapshot naming ANOTHER session's layer: the snapshot is no… | 047c77b0 |
| `F2-05-admission-drops-daily-rows` | F-2 | `admissionMarks.js` | 1 | R7a / R7b — the layer lists a reverse split the snapshot does not: ADM… | 047c77b0 |
| `F2-06-sale-drops-daily-rows` | F-2 | `exits.js` | 1 | R7a / R7b — the layer lists a reverse split the snapshot does not: ADM… | 047c77b0 |
| `F2-07-union-drops-a-payload` | F-2 | `dailyCoverage.js` | 58 | two rows with ONE id and DIFFERENT payloads are a conflict: neither is… | 047c77b0 |
| `F6-01-odd-entry-covers` | F-6 | `dailyCoverage.js` | 16 | the rule itself (pure): a plain object, `caFetchFailed` absent or exac… | 047c77b0 |
| `F6-02-only-true-fails` | F-6 | `dailyCoverage.js` | 7 | the rule itself (pure): a plain object, `caFetchFailed` absent or exac… | 047c77b0 |
| `F6-03-date-not-checked` | F-6 | `dailyCoverage.js` | 3 | the rule itself (pure): a plain object, `caFetchFailed` absent or exac… | 047c77b0 |
| `F6-04-inherited-entry` | F-6 | `dailyCoverage.js` | 1 | the rule itself (pure): a plain object, `caFetchFailed` absent or exac… | 047c77b0 |
| `F3-01-since-from-last-mark-as-of` | F-3 | `ledger.js` | 3 | Astra's case: Nov 27 timed → Nov 30 UNTIMED → a later halving: the sus… | 047c77b0 |
| `F4-01-paper-doubt-holds-idea-sale` | F-4 | `ledger.js` | 1 | COMPARISON-ONLY, through the close and the window — Amendment F-4 (ref… | 047c77b0 |
| `F4-02-paper-doubt-in-hold-set` | F-4 | `ledger.js` | 2 | the choice is the IDEA's, through the close (review finding 2) — narro… | 047c77b0 |
| `F4-03-spy-doubt-unnamed` | F-4 | `settlement.js` | 1 | SPY in doubt (a conflicting split, a dividend held behind it) leaves t… | 047c77b0 |
| `F4-04-bad-ratio-is-own` | F-4 | `ledger.js` | 1 | (pure) the classification: a refusal of the ledger's OWN count (rounds… | 047c77b0 |
| `F4-05-idea-own-doubt-is-paper` | F-4 | `ledger.js` | 2 | a reverse split that rounds the holding to nothing: the cash waits, is… | 047c77b0 |
| `F5-01-old-ruling-covers-identical-gap` | F-5 | `ledger.js` | 3 | B1 — a second halving made WHILE the record stood is not absorbed by a… | 047c77b0 |
| `F5-02-mode-gate-dropped` | F-5 | `founderControls.js` | 4 | A FOUNDER AT 'off': 403, and nothing is read — the same answer as a no… | 047c77b0 |
| `F5-03-allowlist-gate-dropped` | F-5 | `founderControls.js` | 5 | A NON-FOUNDER: 403, whatever the action; the caller is not told which … | 047c77b0 |
| `F5-04-no-reference-mark` | F-5 | `holdRulings.js` | 7 | SUSPICION, `price_move`: recorded on the idea, applied ONCE at the nex… | 047c77b0 |
| `F5-05-split-ratio-unchecked` | F-5 | `holdRulings.js` | 2 | SUSPICION, `split`: the ratio must match the recorded shape; a match a… | 047c77b0 |
| `F5-06-payload-unchecked` | F-5 | `holdRulings.js` | 1 | CONFLICT, a recorded payload: a conflict the feed has DROPPED (C-6) is… | 047c77b0 |
| `F5-07-second-ruling-allowed` | F-5 | `holdRulings.js` | 2 | CONFLICT, a recorded payload: a conflict the feed has DROPPED (C-6) is… | 047c77b0 |
| `F5-08-closed-book-allowed` | F-5 | `founderControls.js` | 1 | the REFUSALS: a record that does not exist, a kind or decision outside… | 047c77b0 |
| `F5-09-fingerprint-blind` | F-5 | `founderControls.js` | 1 | BOTH GATES and the token's uid: a non-founder, and the founder at 'off… | 047c77b0 |
| `F5-10-no-founder-receipt` | F-5 | `ledger.js` | 7 | SUSPICION, `split`: the ratio must match the recorded shape; a match a… | 047c77b0 |
| `F5-11-price-move-not-applied` | F-5 | `holdRulings.js` | 9 | SUSPICION, `price_move`: recorded on the idea, applied ONCE at the nex… | 047c77b0 |
| `F7-01-redated-dividend-paid-twice` | F-7 | `ledger.js` | 10 | FR-A5: a dividend the vendor RE-DATES (one day later, same amount, a n… | 047c77b0 |
| `F7-02-moved-conflict-unsettled` | F-7 | `ledger.js` | 2 | RF-A2: a CONFLICT the vendor settles under a MOVED date — a new id, on… | 047c77b0 |
| `F7-03-late-dividend-current-count` | F-7 | `ledger.js` | 5 | C-16: a dividend dated BEFORE a split already applied, first listed AF… | 047c77b0 |
| `F7-04-share-redate-not-durable` | F-7 | `ledger.js` | 1 | a SHARE-BASIS row that may be a re-date is a doubt about the count: no… | 62d49765 |
| `F7-05-window-seven` | F-7 | `ledger.js` | 1 | FR-A5: a dividend the vendor RE-DATES (one day later, same amount, a n… | 047c77b0 |
| `F7-06-book-mirror-current-count` | F-7 | `close.js` | 2 | C-16: a dividend dated BEFORE a split already applied, first listed AF… | 047c77b0 |
| `F7-07-late-count-by-date` | F-7 | `ledger.js` | 2 | C-16 (pure): the ex-date count is the one before the FIRST APPLIED of … | 047c77b0 |
| `F8-01-record-deleted-not-retired` | F-8 | `ledger.js` | 4 | F-8: a share-basis row that explains a suspicion records the record it… | 047c77b0 |
| `F8-02-receipt-unnamed` | F-8 | `ledger.js` | 8 | F-8: a share-basis row that explains a suspicion records the record it… | 047c77b0 |
| `F9-01-strictly-above` | F-9 | `close.js` | 2 | (pure) Firestore's storage rules for a document, and the line: 786,432… | 047c77b0 |
| `F9-02-not-measured` | F-9 | `close.js` | 1 | through a close: the idea document it is about to write is measured — … | 047c77b0 |
| `RACE-01-admission-daily-outside-tx` | race row | `admissionMarks.js` | 2 | the layer turns to failed between admission's read and its commit — th… | 047c77b0 |
| `R-C1-own-redate-not-held` | review fix | `ledger.js` | 1 | C1: a share-basis possible re-date on the idea's OWN ledger holds the … | 047c77b0 |
| `R-C2a-redate-keeps-held-record` | review fix | `ledger.js` | 1 | C2: the founder applies a re-date of a HELD dividend — when the hold c… | 047c77b0 |
| `R-C2b-gate-reads-settled-record` | review fix | `ledger.js` | 1 | C2 backstop (pure): a held record whose id is already settled holds no… | 047c77b0 |
| `R-C2c-settled-record-kept` | review fix | `ledger.js` | 1 | C2 backstop (pure): a held record whose id is already settled holds no… | 047c77b0 |
| `R-C3-earlier-late-split-ignored` | review fix | `ledger.js` | 1 | C3 (pure): a split dated BEFORE the dividend but listed late — applied… | 047c77b0 |
| `R-RF1-one-row-two-conflicts` | review fix | `ledger.js` | 1 | RF-A2 (pure): one row settles ONE conflict — a second unsettled confli… | 047c77b0 |
| `R-RF2-redate-row-settles` | review fix | `ledger.js` | 1 | RF-A2 (pure): a row that is itself a possible re-date of a dividend al… | 047c77b0 |
| `R-B1-step-never-judged` | review fix | `ledger.js` | 2 | Z1 — a ruling covers only the recorded move: the split-shaped move the… | 047c77b0 |
| `R-A1-lastseen-from-uncovered` | review fix | `ledger.js` | 1 | A1: the last price seen while a record stands is taken only at a close… | 047c77b0 |
| `R-B3-reference-not-divided` | review fix | `ledger.js` | 3 | B1 — a second halving made WHILE the record stood is not absorbed by a… | 047c77b0 |
| `R-B3b-screen-reads-raw-mark` | review fix | `ledger.js` | 6 | SUSPICION, `price_move`: recorded on the idea, applied ONCE at the nex… | 047c77b0 |
| `R-D1-reference-into-mark` | review fix | `holdRulings.js` | 4 | Z1 — a ruling covers only the recorded move: the split-shaped move the… | 047c77b0 |
| `R-fresh-keeps-reference` | review fix | `ledger.js` | 1 | B3 — a split listed while the record stood is held behind it; after a … | 047c77b0 |
| `R-B2-founder-split-ungated` | review fix | `ledger.js` | 4 | B2: the feed's row for the move, dated inside the gap, arrives at the … | 047c77b0 |
| `R-D5-residual-unchecked-at-close` | review fix | `ledger.js` | 2 | D5 at the close (pure): a founder split is applied only for the move s… | 047c77b0 |
| `R-D5b-no-residual-allowed` | review fix | `holdRulings.js` | 1 | D5 (pure): a founder split must be the move the record STILL stands fo… | 047c77b0 |
| `R-D5c-residual-split-keeps-record` | review fix | `ledger.js` | 2 | D5 at the close (pure): a founder split is applied only for the move s… | 047c77b0 |
| `R-D6-founder-id-collides` | review fix | `holdRulings.js` | 1 | D6: the feed applied a 2-for-1 on the move's own session but the move … | 047c77b0 |
| `R-moot-read-as-applied` | review fix | `holdRulings.js` | 2 | B2: the feed's row for the move, dated inside the gap, arrives at the … | 047c77b0 |
| `R-B7-replaced-record-unnamed` | review fix | `ledger.js` | 1 | B7 / F-8: the founder's split explains the record in the dry run and a… | 047c77b0 |
| `R-held-founder-loses-ruling` | review fix | `ledger.js` | 1 | C2: the founder applies a re-date of a HELD dividend — when the hold c… | 62d49765 |
| `R-N1-row-after-gap` | review fix | `holdRulings.js` | 1 | N1 (pure): a coverage-gap `row` ruling takes a recorded backfill row d… | 047c77b0 |
| `R-D2-redate-not-unsettled` | review fix | `settlement.js` | 1 | D2 / D3 / D4 (pure): at the endpoint a SHARE-BASIS possible re-date is… | 047c77b0 |
| `R-D4-redate-unnamed` | review fix | `settlement.js` | 1 | D2 / D3 / D4 (pure): at the endpoint a SHARE-BASIS possible re-date is… | 047c77b0 |
| `R-A2-catch-up-no-backfill` | review fix | `close.js` | 3 | A2: the WINDOW's catch-up — usually the first close after an outage — … | 047c77b0 |
| `R-N2-no-timeout` | review fix | `caBackfill.js` | 1 | N2: the backfill is bounded — a fetch with no answer in its time is a … | 047c77b0 |
| `R-N2b-no-budget` | review fix | `caBackfill.js` | 1 | N2: the backfill is bounded — a fetch with no answer in its time is a … | 047c77b0 |
| `R-N4-non-list-success` | review fix | `caBackfill.js` | 1 | N4: an answer whose rows are not a list is a FAILED backfill, whatever… | 047c77b0 |
| `R-A4-entry-session-mismatch` | review fix | `dailyCoverage.js` | 1 | A4 (pure): a snapshot naming another session's layer covers nothing — … | 047c77b0 |
| `R-NF1-moot-founder-explains` | review fix | `ledger.js` | 1 | NF-1: a founder split found MOOT at the close (a row inside the gap ap… | 047c77b0 |
| `R-NF2-never-closed-no-backfill` | review fix | `close.js` | 2 | NF-2: a book that has NEVER closed backfills at its first catch-up too… | 047c77b0 |

## 6. The end-to-end comparison

**The run** (`endToEnd.test.js`, "one book, three ideas through its short slot"):
- One book and three ideas.
- An early resolution, a line exit settled with the rest, and a clean settlement.
- A split, a dividend, a missing quote, and a sale that waits.
- Reconciled after every step.

**The pin.**

| | sha256 of the dump | bytes | documents |
|---|---|---|---|
| `main` (base) | `f061fb0e…` | 390,122 | 163 |
| this build | `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9` | 443,533 | 191 |

The pin was set at 659423ee. All four review fix rounds left the dump byte-identical: the pinned row passed at each head, and in the final Linux suite at 62d49765. The second run of the same row reproduces the same bytes.

**Leaf by leaf, base → this build** (each dump flattened to `document :: path = value`):

| | count | what |
|---|---|---|
| documents added | 28 | `mandateUniverseDaily/2026-11-16` … `2026-12-24`, one per session: the fixtures now store each session's daily layer and name it on the snapshot (F-2) |
| documents removed | 0 | |
| leaves added | 59 | 38 × `dailyRef` on the stored snapshots (F-2); 11 × `caCoveredThrough` (F-1); 6 × `spy.inDoubt: []` on results and their packets (F-4); 4 × `sharesBefore` / `sharesAfter` on the one 2-for-1's receipt, in the ledger and in its result packet (F-7) |
| leaves removed | 0 | |
| leaves changed | 9 | 2 × `caCoverage.dailyPresent` false → true on admission evidence, because the daily layer now exists in the fixture; 7 × content hashes of packets whose content gained the leaves above |
| **money leaves changed** | **0** | No cash, share count, value, cost, dividend, proceeds or result figure changed. The 4 added share-count leaves record the count beside the split; they move nothing |

So, with the data complete, money moves exactly as before. No rule of Amendment F needed a money leaf to change.

**The new end-to-end case with a coverage gap** (`endToEnd.test.js:468`). It runs through the real daily builder (`ensureDailySnapshot`) and snapshot builder (`ensureUniverseSnapshot`), with a fake vendor.
1. An AAPL idea with $30,000. AAPL's fetch fails for six sessions, S1–S6. A 4-for-5 reverse split happens on S3 (the price moves +25%, under the gap screen), and a $0.30 dividend is dated S6.
2. Every close S1–S6 does the following:
   - Carries AAPL at its pre-split mark, labelled `ca_coverage_missing`.
   - Applies nothing count-dependent, on the idea, the comparison or the book.
   - Keeps SPY fresh.
   - Records the gap (`since` S0, sessions 1–6) and alerts from the fifth session.
3. On S7 the fetch recovers. Its window (from Nov 20) misses the split, so the close backfills from Nov 17 with one fetch of AAPL alone. The split is applied once, then the dividend on the adjusted count. This happens on the idea, its comparison and the book's mirror, all reconciled, and the mark is fresh.
4. On S8 nothing is fetched and nothing is paid twice.

## 7. The register (Amendment F-10)

Every corporate-action item raised since T1a-1, with its status, written for a reviewer who has not read the earlier reports. **This register is what Astra's final review starts from.**

**Status words** (F-10's four):
- **Fixed in T1a-2b-3**
- **Closed earlier**
- **Accepted by ruling**
- **Carried** (with its home)
- **Fixed in the T1a-2b-3 fix round** — the round that answers Astra's final review (§10)

The founder's Q8 ruling (18 Nov 2026) named the homes for the rename-dependent and quarterly items, and Astra's final review sorted the rest (A-2B3, "Register audit and carried-item decisions"); each row carries its home. **T1a-2b-4 (before the switch)** is the founder's home for four of Astra's findings that need a new adjustment mechanism (§10).

**Ids.** Plain ids (C-5, Q-P, FR-A5, R8, T2C-04 …) are unique. Review letters that repeat across builds carry a prefix:
- `2a-`: T1a-2a's review.
- `2b2-`: T1a-2b-2's review.
- `2b3-`: this build's §5, with the lens in brackets.

**Sources** (all in `docs/audits/` unless a path is given):
- **T1A1** = `20261113_BUILD_T1A1_T1C_IDEA_BOOK_ACCOUNTING.md`
- **A-T1A1** = `20261113_ASTRA_REVIEW_T1A1_T1C.md`
- **AC-T1A1** = `20261113_ASTRA_CONFIRMATION_T1A1_FIX_ROUND.md`
- **T1A2A** = `20261113_BUILD_T1A2A_EXITS_SETTLEMENT_RESULTS.md`
- **A-2A** = `20261114_ASTRA_REVIEW_T1A2A.md`
- **AC-2A-1/2/3** = `20261115_ASTRA_CONFIRMATION_T1A2A_{FIX_ROUND,ROUND2,ROUND3}.md`
- **T1A2B1** = `20261115_BUILD_T1A2B1_ACCESS_RECORDS_FOUNDER_CONTROLS.md`
- **A-2B1** = `20261116_ASTRA_REVIEW_T1A2B1.md`
- **AC-2B1** = `20261116_ASTRA_CONFIRMATION_T1A2B1_FIX_ROUND.md`
- **T1A2B2** = `20261117_BUILD_T1A2B2_ADMISSION_RECORDS_FINISH.md`
- **A-2B2** = `20261117_ASTRA_REVIEW_T1A2B2.md`
- **AmF** = `docs/design/20261117_PRACTICE_FIELD_AMENDMENT_F_CORPORATE_ACTION_FINISH.md`
- **Fin** = `api/_utils/practiceField/corporateActionFinish.test.js`
- **A-2B3** = `20261118_ASTRA_REVIEW_T1A2B3.md` (Astra's final review of the corporate-action path)
- **Fix** = `api/_utils/practiceField/corporateActionFixRound.test.js` (the fix round's rows; cited by the start of the row's name)
- **CA** = `api/_utils/practiceField/corporateActions.test.js`

Test rows are cited by line at 047c77b0 and the start of the row's name.

### 7.1 The items F-10 names, and the corporate-action items around them

| Id | Item | Status | Home | Evidence |
|---|---|---|---|---|
| C-5 | On a day the corporate-action fetch failed, the close still marked the holding at the day's price, through a gap screen that misses a split smaller than its threshold. | Fixed in T1a-2b-3 | — | T1A2A:478; AmF F-1; Fin:369 "refuter R8: the fetch fails for three sessions…"; Fin:146 "THE CLOSE: the name with that entry is carried…"; A-2B3 T2D-07 (two exceptions: the entry session read as covered, and a backdated row paid at an uncovered close) **fixed in the fix round** (§10) |
| C-6 | Two holds only the founder could clear: a **share-basis** conflict the feed has dropped, and a split-shaped move the feed never explains. | Fixed in T1a-2b-3 | — | T1A2A:479, :636, :1161; AmF F-5. The dropped share-basis conflict: Fin:1392 "C-6's own case: a SHARE-BASIS conflict the feed has dropped…" (review R6); a dividend one: Fin:929. The move: Fin:756 "SUSPICION, `price_move`…", Fin:902 "SUSPICION, `split`…"; A-2B3 T2D-09 (a chosen payload paid a ledger without the record) and T2D-10 (a refused payload locked its own record) **fixed in the fix round** (§10) |
| C-7 | The idea book's cron work has no deadline of its own and spends the quarterly loop's 290 s. This build's backfill is bounded per fetch (20 s) and per pass (60 s). | Carried | T5 (capacity) | T1A2A:480 ("Capacity is T5"); Fin:1562 "N2: the backfill is bounded…"; A-2B3 T2D-13: the 60 s budget bounds the STARTS of fetches, not their completion (a fourth 19.5 s answer ends at 78 s) — carried to T5 with C-7 |
| C-8 | The catch-up covers 20 sessions per fire. An idea starting inside a longer gap can time out without one attempt, and its record does not say why. | Carried | T5 (records; Q8, A-2B3 table) | T1A2A:481; the 20-session limit and the return of reserved cash stay. The new missed-action case on an already-filled idea was A-2B3 T2D-02, **fixed in the fix round** (§10) |
| C-9 (fallback) | `exitTierOf` costed a holding with no stored tier at the widest tier. | Closed earlier | — | T1A2A:482; removed in T1a-2b-1: T1A2B1:17, :107; A-2B1:65 |
| C-9 (record) | A ticker change while a settlement sale waits records the wait once under each symbol (cosmetic). | Carried | T5 (founder tools; Q8) | T1A2A:482 |
| C-10 | If the feed renamed two different held stocks into one new ticker, both ideas would block each other for good. Both stay held and alerting; nothing sells on a wrong count. | Carried | T5 (founder tools; Q8) | T1A2A:630, :614; AC-2A-1:55 (no blocker, no ruling). Today's feed emits no rename: Fin:1113 "C-12 is NOT reachable…" |
| C-11 | A rename correction that arrives as a conflict leaves the waiting rename on its older target, which applies once the share basis settles. | Carried | T5 (founder tools; Q8) | T1A2A:631; Fin:1113; see 2b3-N2 [B] |
| C-12 | A conflicting cash dividend plus a rename at the same close: the sale goes ahead while the conflict is listed, and the dividend is credited to neither ledger. **Not reachable under today's feed** (the parsers emit only splits, reverse splits and cash dividends; a rename or delisting comes only from a row the founder writes); not fixed. | Carried | T5 (founder tools; Q8) | T1A2A:632, :604; Fin:1113 |
| C-13 | A cashless delisting plus a rename of the same stock in one close lost the waiting sale. | Closed earlier | — | T1A2A:633; fixed in T1a-2a round 2: T1A2A:658, :778; AC-2A-2:66, :77; CA:1253 |
| C-14 | The rename screen (R-36) also screens a comparison-only rename, so a comparison holding can sit at a carried mark while another idea holds the target. | Carried | T5 (founder tools; Q8) | T1A2A:634 (the source calls it "a ruling"; none was made); Fin:1113 |
| C-15 | Three rename edge cases. (1) A rename into a symbol the same idea already holds keeps its waiting record for good, so that holding stays at a carried mark for good. (2) A future-dated rename into a held symbol marks the holding blocked early. (3) Only the first refusal is recorded when a reserved name and a missing price coincide. | Carried | T5 (founder tools; Q8) | T1A2A:635, :612, :614; `ledger.js` (an unapplied rename adds the symbol to `unresolved` at every close); Fin:1113 |
| C-16 | A dividend dated before a split, but first listed after the split was applied, was paid on the post-split count. | Fixed in T1a-2b-3 | — | T1A2A:832, :1160; AmF F-7; Fin:655 "C-16: a dividend dated BEFORE a split…", Fin:681, Fin:696; with 2b3-C3 |
| C-17 | A dividend can explain its own price drop. If the ex-date close carries the mark for another reason (an incomplete quote), the pre-ex price stays frozen: the value counts the dividend twice and the stock is held. **No ruling exists**: "residual, fail-closed" is T1a-2a's own wording. F-5's `price_move` can now clear the hold; no row runs this exact case. | Carried | T5 (A-2B3 table) | T1A2A:1146 (2a-X1/C3), :1158; Astra ran the exact missing-quote variant: the special dividend paid once, the stale $100 mark carried at reduced quality, and a founder `price_move` restored the $50 mark with no second payment (A-2B3, register table) |
| Q-A | A comparison or SPY holding delisted for cash is receipted, and realised, on that paper ledger. | Accepted by ruling | — | T1A2A:165; A-2A:87 ("the accepted Q-A…Q-J decisions"); AC-2A-1:35 |
| Q-F | A sale held for a corporate action reads `blocked` under its own name, and waits one session for an ordinary dividend to be credited. | Accepted by ruling | — | T1A2A:170; A-2A:87 |
| Q-G | A sale caused by a delisting gets its own origin on the decision record. | Closed earlier | — | T1A2A:171; built in T1a-2b-1 as `delisting_exit`: T1A2B1:17; A-2B1:65 |
| Q-L | While a rename waits, its target belongs to the waiting idea; an idea admitted earlier naming that target waits and times out. | Accepted by ruling | — | T1A2A:571, :575; AC-2A-1:55 ("accepted as instructed") |
| Q-M | An idea resolved while its SPY ledger was in doubt, and the result did not say so; SPY's held dividend was never paid. | Fixed in T1a-2b-3 | — | T1A2A:758, :1215; AC-2A-2:85; AmF F-4; Fin:564 "SPY in doubt … leaves the result MEASURABLE and names it…"; with 2b3-D2 |
| Q-N | On one date, a dividend is credited on the count after a split of the same date. | Accepted by ruling | — | T1A2A:751 (R-55), :759; AC-2A-2:77, :85 |
| Q-O | A doubt only in the comparison's own count held the idea's own cash and sale; in refuter 2's frozen-basket case, for good. | Fixed in T1a-2b-3 | — | T1A2A:761, :1216; AmF F-4; Fin:540 "(pure) the classification…"; CA:1155 |
| Q-P | A cash delisting or dividend was paid while the gap screen alone suspected an unfed split. | Closed earlier | — | T1A2A:760; ruled at AC-2A-2:23, :85; fixed in T1a-2a round 3 (T2A-D01): T1A2A:848–859; AC-2A-3:3 |
| Q-Q | A suspicion raised before a cashless delisting arrives holds that delisting's sale until it is resolved. | Accepted by ruling | — | T1A2A:965 (R-65), :970; AC-2A-3:54; `resolve_hold` now releases it (Fin:756) |
| Q-R | A real fall to a split-shaped price, with no feed row, holds the idea's sale, payments and value until a split row explains it or the founder resolves it. | Accepted by ruling | — | T1A2A:972; AC-2A-3:54; the founder tool is F-5 (Fin:756, :902) |
| Q-S | After a dividend that explains its own drop, the close trusts the ex-date price. | Accepted by ruling | — | T1A2A:967 (R-67), :974; AC-2A-3:52 ("a correction") |
| Q-T | A late cash dividend that would explain the move does not release a suspicion; only a share-basis row or the founder does. | Accepted by ruling | — | T1A2A:963 (R-63), :976; AC-2A-3:54 |
| Q-U | What a founder's resolution of a suspicion covers: Z1, Y4, N3. | Fixed in T1a-2b-3 | — | T1A2A:978–986; AC-2A-3:54; AmF F-5; Fin:789 "Z1 — …", Fin:869 "Y4 — …", Fin:885 "N3 — …"; with 2b3-B1/A1, B3, D1; A-2B3 T2D-08 (a ruling covered a later halving hidden by its recovery) **fixed in the fix round** (§10) |
| Q-V | A move explained only by two rows together is never released by the feed. The count is right; the cash is held. | Accepted by ruling | — | T1A2A:988; AC-2A-3:54 ("held for release 1"). **The remedy is `price_move`**: a `split` ruling is refused `no_residual_move` (Fin:1307 "D5 (pure)…"; §3.2 Q7). The draft's "F-5 split ruling" was wrong (review D5) |
| FR-A1, A2, A4, A6; RF-A1, A5 | T1a-1's other in-build findings. | Closed earlier | — | T1A1:701–717; AC-T1A1:43 |
| FR-A3 (residue) | A finite but wrong mark on a sector-fund comparison or an SPY ledger is not detected: there is nothing to compare it with. | Carried | T5 (integrity checks; A-2B3 table) | T1A1:703, :761 (FR-A3's fixed parts closed in T1a-1) |
| FR-A5 | A dividend the vendor re-dated (same amount, a new id one day later) was paid twice. | Fixed in T1a-2b-3 | — | T1A1:705, :759; AmF F-7; Fin:590 "FR-A5: a dividend the vendor RE-DATES…" |
| FR-A7 | The entry filled from a snapshot its caller supplied, checked by key only. | Closed earlier | — | T1A1:707, :760; closed in T1a-2a: T1A2A:74, :197; T1A2B2:413 |
| RF-A2 | A conflict the vendor settled under a moved ex-date (a new id) was paid, but the old id stayed unsettled and the rows stayed flagged. | Fixed in T1a-2b-3 | — | T1A1:714, :759; AmF F-7; Fin:635 "RF-A2: a CONFLICT the vendor settles under a MOVED date…"; tightened by 2b3-RF-A2; A-2B3 T2D-06 (an old conflict id declined and paid in one close) **fixed in the fix round** (§10) |
| RF-A3 (residue) | A flipped stored `contract.comparison.type` is not detected. | Carried | T5 (integrity checks; A-2B3 table) | T1A1:715, :761 |
| RF-A4 | Outside the conflict branch, a hand-written row with a lower-case ticker was not held back, and a lower-case split was never applied. | Closed earlier | — | T1A1:716, :762; T1a-2a round 2's raw-ticker fixes: T1A2A:774, :793, :799; AC-2A-2:79 |
| T1A-06 | Two concurrent daily top-ups could lose newly fetched corporate-action data. | Closed earlier | — | A-T1A1:72; fixed in T1a-2b-2: T1A2B2:20, :104; A-2B2:10, :65 |
| T1A-01 | Two identical vendor rows in one window paid a dividend twice and applied a split twice. | Closed earlier | — | AC-T1A1:26 ("T1A-01 — CLOSED": $199.94 paid once, one applied id; the repeated 2:1 gives 399.880034 shares); ledger.js header "ONE ACTION, ONE APPLICATION" |
| T2A-01 | A rename applied over an unresolved share basis let the next window sell the unadjusted holding under the new ticker. | Closed earlier | — | AC-2A-1:41–43 (closed in all three variants: zero sales, 199.940017 shares kept) |
| T2A-C01 | A cash delisting paid shares × cash on an unadjusted count while the share basis was unresolved. | Closed earlier | — | AC-2A-2:62 (fixed for all three basis types, released exactly once) |
| T2A-D02 | Two share-basis actions of one date applied out of order left a different (rounded) count. | Closed earlier | — | AC-2A-3:3 ("the original D01 and D02 reproductions are fixed"); `ledger.js` applyActions (`byDatePhaseId`). D01 is Q-P; E01 is the two-split case (2b3 two genuine splits) |
| T1A-08 (residual) | While the flag was `'off'`, an action dated in the gap, beyond the first close's 5-day lookback, never reached the idea. | Fixed in T1a-2b-3 | — | T1A2B2:412; AmF F-1; Fin:459 "T1A-08's residual — THE FLAG'S TIME 'OFF' IS A GAP…" |
| T2B-01 (gap-screen read; F-3's source) | The gap screen dated a suspicion's window from `lastMarkAsOf`, which can keep an older quote's time, so the window could start too early. | Fixed in T1a-2b-3 | — | AC-2B1:38–44, :102; AmF F-3; Fin:323 "Astra's case: Nov 27 timed → Nov 30 UNTIMED…", Fin:347 |
| 2a provisional reader | T1a-2a's founder-resolution reader (`resolvedBy`/`resolvedAt`, which nothing wrote). | Fixed in T1a-2b-3 | — | T1A2A:964 (R-64), :1156; AC-2A-3:54; replaced by `resolve_hold` (AmF F-5) and removed |
| 2a-D4 | After the endpoint, a settlement sale that replaced a delisting exit records no reason; the comparison's copy can then still get a suspicion record (alerts and stale comparison rows; no result figure moves). | Carried | T5 (founder tools; Q8) | T1A2A:1142, :1157 |
| T2C-01 | Admission ignored a recorded failed fetch and admitted against an unadjusted count. | Closed earlier | — | A-2B2:25; T1A2B2:426–433; `admissionMarks.test.js:414` |
| Admission race row | No committed row pinned admission's daily-layer read inside its transaction. | Fixed in T1a-2b-3 | — | T1A2B2:529, :579; Fin:293 "the layer turns to failed between admission's read and its commit…", Fin:311 |
| R3 | Odd daily-entry values (`false`, `0`, `''`, `'x'`, `[]`, `caFetchFailed` of `'true'` or `1`) read as covered. | Fixed in T1a-2b-3 | — | T1A2B2:532, :578; AmF F-6; Fin:102, Fin:120 "%s — on all three paths"; `{}` stays covered by F-6's letter (Q2) |
| R7a, R7b | A daily document listed a reverse split that the slot snapshot lacked, and admission still measured the unadjusted count. | Fixed in T1a-2b-3 | — | T1A2B2:534–536; AmF F-2; Fin:215 "R7a / R7b — …" |
| R7c | A daily document's own `date` was not checked against its key. | Fixed in T1a-2b-3 | — | T1A2B2:533; AmF F-6; Fin:169 |
| R7d | A snapshot built with no daily document (`dailyRef: null`) was still used after the daily document was built. | Fixed in T1a-2b-3 | — | T1A2B2:537; AmF F-2; Fin:253 "R7d, and a snapshot naming ANOTHER session's layer…" |
| R8 | The close never read the daily layer; during a failed fetch it wrote the adjusted price over the unadjusted count. | Fixed in T1a-2b-3 | — | T1A2B2:543, :577; AmF F-1; Fin:369; with C-5's two exceptions (A-2B3 T2D-07), **fixed in the fix round** (§10) |
| T2C-04 | The idea document keeps every receipt and passes 1 MiB at about 2,900 of them, with no warning. | Fixed in T1a-2b-3 (the alert; receipts stay unless Astra asks) | — | A-2B2:85; T1A2B2:417, :571; AmF F-9; Fin:1062, Fin:1070 |
| T2C-03 | A `force` rebuild of the daily document can erase carried actions under a concurrent top-up. | Carried | T5 | A-2B2:84; T1A2B2:266, :582 |
| 2b2-Q1 | On a held stock's ex-dividend day, admission refuses all session (the dividend is credited only at the close). | Carried | T1b (the refill rule); the block awaits the founder | T1A2B2:192, :567; A-2B2:87 |
| 2b2-Q3 | A held stock never quoted again blocks every admission of the book. | Carried | T5 (the tool for a stuck sale with no quote) | T1A2B2:194, :261; A-2B2:87 |
| 2b2-B2 | The **quarterly** close pays two rows of one action id twice (a dividend paid twice, or a split applied twice). The idea book does not. A money item. | Carried | Separate quarterly task (Q8) | T1A2B2:263, :418; A-2B2:10 |
| 2b2-Pointer | Two concurrent top-ups with two vendor answers can leave two payloads under one id: a conflict, which reaches the quarterly close as 2b2-B2. | Carried | Separate quarterly task (Q8), with 2b2-B2 | T1A2B2:275; in the idea book both payloads are kept (Fin:202) and the founder can rule |

### 7.2 Items this build's review raised (§5)

| Id | Item | Status | Home | Evidence |
|---|---|---|---|---|
| 2b3-C1 [C] | A share-basis possible re-date on the idea's own ledger did not hold the sale or refuse admission when the comparison does not hold the name. | Fixed in T1a-2b-3 | — | Fin:1142 "C1: …" |
| 2b3-C2 [C] | When the founder applied a re-date of a held dividend, the original's held record was stranded and held the sale for good. | Fixed in T1a-2b-3 | — | Fin:1159 "C2: …", Fin:1186 "C2 backstop (pure)…" |
| 2b3-C3 [C] | A late dividend's ex-date count missed an earlier-dated split applied late. | Fixed in T1a-2b-3 | — | Fin:1198 "C3 (pure)…" |
| 2b3-C6/D2/D3 [C, D] | The endpoint neither counted nor named a share-basis possible re-date. | Fixed in T1a-2b-3 | — | Fin:1497 "D2 / D3 / D4 (pure)…" |
| 2b3-RF-A2 [C] | One row could settle two conflicts, and a row that is itself a possible re-date could settle one. | Fixed in T1a-2b-3 | — | Fin:1213, Fin:1224 "RF-A2 (pure)…" |
| 2b3-B1/A1, Z1 [B, A] | A `price_move` ruling absorbed a further split-shaped move made while the record stood. | Fixed in T1a-2b-3 | — | Fin:809 "B1 — …", Fin:789 "Z1 — …", Fin:1379 "A1: …" |
| 2b3-B2 [B] | The feed's row for the move and the founder's split at one close applied the split twice. | Fixed in T1a-2b-3 | — | Fin:1339 "B2: …" |
| 2b3-B3 [B] | A split held behind a record was suspected again after `price_move`. | Fixed in T1a-2b-3 | — | Fin:834 "B3 — …" |
| 2b3-B5 [B] | A founder split could reach a ledger that does not carry its record. | Fixed in T1a-2b-3 | — | Fin:1460 "B5 (pure)…" |
| 2b3-B7 [B] | On the T2A-E01 path, the retired record did not name the founder's ruling. | Fixed in T1a-2b-3 | — | Fin:1474 "B7 / F-8…" |
| 2b3-D1 [D] | A `price_move` reference broke the result packet's provenance. | Fixed in T1a-2b-3 | — | Fin:852 "D1 — …" |
| 2b3-D5 [D] | A founder split was stacked on rows already applied in the gap; with no move left (Q-V) the remedy is `price_move`. The founder's residual split now retires its record. | Fixed in T1a-2b-3 | — | Fin:1307 "D5 (pure)…", Fin:1362 "D5 at the close (pure)…" |
| 2b3-D6 [D] | The founder split's id collided with a feed split already applied under that id (the typical real-feed shape). | Fixed in T1a-2b-3 | — | Fin:1318 "D6: …" |
| 2b3-NF-1 [fix-round refuter] | A founder split found moot at the close still released cash dated inside the record's gap. | Fixed in T1a-2b-3 | — | Fin:1420 "NF-1: …" |
| 2b3-NF-2 [fix-round refuter] | A book that had never closed skipped the backfill at its first catch-up. | Fixed in T1a-2b-3 | — | Fin:1547 "NF-2: …" |
| 2b3-N1 [B] | A coverage-gap `row` ruling could take a backfill row dated after the gap. | Fixed in T1a-2b-3 | — | Fin:1489 "N1 (pure)…" |
| 2b3-A2 [A] | The window's catch-up, often the first close after an outage, never backfilled. | Fixed in T1a-2b-3 | — | Fin:1532 "A2: …" |
| 2b3-A4 [A] | On the entry session a snapshot naming another session's layer still counted. | Fixed in T1a-2b-3 | — | Fin:1584 "A4 (pure)…" |
| 2b3-N2 [A] | The backfill fetch had no timeout and no budget per pass. | Fixed in T1a-2b-3 | — | Fin:1562 "N2: …"; qualified by A-2B3 T2D-13: the pass budget bounds starts, not completion — carried to T5 |
| 2b3-N4 [A] | A backfill answer whose rows are not a list was not failed. | Fixed in T1a-2b-3 | — | Fin:1577 "N4: …" |
| 2b3-N3 [A] | Test rows could reach the vendor. | Fixed in T1a-2b-3 | — | Fin:1590 "the vendor is never reached from a row…" |
| 2b3-C4 [C] | After a rename, the vendor relisting an action under the new ticker applies it twice (shares or dividend). Same on base. A money item; reachable only after a founder-written rename. | Carried | T5 (founder tools; Q8) | §5 (C4; refuter C, probes `rename_relist`, `late_count`) |
| 2b3-C5 [C] | A late dividend across a ticker change is paid on the current count. Same on base. | Carried | T5 (founder tools; Q8) | §5 (C5) |
| 2b3 late dividend after a line sale [C] | A dividend listed only after the idea's line sale, though dated while it held the stock, is never paid to the idea (the comparison gets it). Same on base. | Carried | **T1a-2b-4 (before the switch)** — A-2B3 T2D-03 | §5 (C-n4); A-2B3 T2D-03 reproduced it on base and head (the comparison $99.97, the idea $0, full quality). The founder moved its fix to T1a-2b-4, with the adjustment mechanism (§10) |
| 2b3-C7 (share basis) [C] | An idea entered on a 3:2 split's ex-date, the split then re-dated one session later at a flat price, is credited the split: a +$4,998.50 phantom at full quality. The gap screen's known blind spot for 1.2 and 1.5 ratios. Same on base. | Fixed in the T1a-2b-3 fix round | — | §5 (C7); the blind spot: T1A2A:478, :753 (R-57); A-2B3 T2D-01 showed it reachable under today's feed (no hand-written row). Fixed with the agreed Q10 (§10): Fix:"T2D-01 / Q10 …" (3-for-2 and 1-for-2) |
| 2b3-A3 [A] | A row the parser rejects leaves the daily entry, and the backfill, "successful" and empty. Pre-existing on the daily path (the shared fetch is quarterly and untouched). | Carried | **T1a-2b-4 (before the switch)** — A-2B3 T2D-12 | §5 (A3); A-2B3 T2D-12: a `5:4` row the real adapter rejects leaves 99.970008 shares valued at $80, full quality ($1,999.40 understated). The founder moved its fix to T1a-2b-4 (§10) |
| 2b3-D4 [D] | At the endpoint a dividend's possible re-date is named, unpaid, but not counted as an unsettled action. F-7's letter covers "not applied, recorded, alerted"; "not counted" is this build's reading (FR-18). | Accepted by ruling | — | AmF F-7, F-4; FR-18; Fin:1497; the founder's Q9 (18 Nov): named, not counted. Kept |
| 2b3 weekly payer [C] | A stock paying the same dividend every week alternates paid and held (F-7's 5-session window). | Accepted by ruling | — | AmF F-7; the founder's Q4 (18 Nov): accepted for release 1 (no weekly payer is in the universe) |
| 2b3-C7 (dividend) [C] | A re-date of a dividend the holding was not entitled to is paid (F-7 matches actions applied or held, not declined). | Fixed in the T1a-2b-3 fix round | — | AmF F-7; the founder's Q10 (18 Nov) changed the rule: a decline counts as a match. Built in the fix round (§10): Fix:"Q10: …" |
| 2b3 two genuine splits | Two genuine identical splits within five sessions look like one re-dated split: the second, and any dividend behind it, waits for the founder. | Accepted by ruling (F-7's letter); Q1 asks again | — | AmF F-7; Astra's T2A-E01 case (T1A2A:1166; AC-2A-3:3) now waits: CA:1858; a founder ruling pays it once: Fin:965; the founder's Q1 (18 Nov): kept |
| 2b3-B4 [B] | F-4's narrowing of a paper ledger's own-count doubt lasts one close (the next close's gap screen turns it into a symbol doubt). Not reachable under today's admission (it needs a basket leg rounded to 0.000001 shares, or a holding with no `openedAt`). | Carried | T5 (A-2B3 table) | §5 (B4) |
| 2b3-B6 [B] | A ruling pending on one ledger locks its record against another ruling. A moot founder split now closes its ruling; the rest is reachable only from planted state. | Fixed in the T1a-2b-3 fix round (the permanent-refusal path); the rest carried | T5 (artificial pending states) | §5 (B6); Fin:1014 "the REFUSALS…"; A-2B3 T2D-10: the permanent-refusal path is reachable from ordinary entry and parsed rows — fixed in the fix round (§10). The register's "only from planted state" was wrong for that path. Other planted pending states wait for T5 |
| 2b3-N2 [B] | A conflict `payload` ruling cannot carry `cashPerShare` or `renamedTo`. Reachable only from rows the founder writes (C-12). | Carried | T5 (founder tools; Q8) | §5 (B-N2); `holdRulings.js` `payloadOf` |
| 2b3 unrecognized type | A row of an unrecognized type is not kept once coverage moves past it. Today's parsers emit none. | Carried | T5 (founder tools; Q8) | Fin:1113 |

### 7.3 Astra's final review (A-2B3): T2D-01 to T2D-14

The founder set the fix round's scope (§10.1). Statuses at the fix round's head:

| Id | Finding | Status | Home | Evidence |
|---|---|---|---|---|
| T2D-01 | A 3-for-2 split re-dated one session past an ex-date purchase credited +$4,998.50 at full quality (the register's 2b3-C7 share basis) | Fixed in the T1a-2b-3 fix round, with the agreed Q10. **Reopened by Astra's confirmation (T2D-C01: a payload first seen a session later was lost, its re-date paid); fixed in fix round 2 by rev 1 (§11.2)** | — | A-2B3 T2D-01; Fix:103 "T2D-01 / Q10 …" (a 3-for-2 and a 1-for-2), Fix:136 "Q10: …"; the refuter's AR1-RF-02 (the ex-date action listed two ways): Fix:612, Fix:623 |
| T2D-02 | A 20-session catch-up through valid archived entries ignored the backfill it fetched: 99.970008 shares and $0 at full quality instead of 124.962510 and $124.96 | Fixed in the fix round. **Reopened (T2D-C02: an archive/backfill disagreement settled by a re-listed row; T2D-C05: the idea-wide filter starved the comparison); fixed in fix round 2 (§11.2)** | — | Fix:160 "T2D-02 …" (both variants, across the 20-session boundary and a replay); AR1-RF-05 (a backfill row never settles a conflict it took part in): Fix:679 |
| T2D-03 | A line sale erased a dividend the idea was owed (the register's late dividend after a line sale) | Carried | **T1a-2b-4 (before the switch)** | A-2B3 T2D-03 |
| T2D-04 | A late split never corrected a dividend already paid ($24.99 short, full quality) | Carried | **T1a-2b-4 (before the switch)** | A-2B3 T2D-04 |
| T2D-05 | A vendor correction under an id already settled was ignored (124.962510 shares and $124.96 kept where 149.955012 and $299.91 were owed) | Carried | **T1a-2b-4 (before the switch)** | A-2B3 T2D-05 |
| T2D-06 | A conflict's old id was declined and paid in one close ($299.91 where the system's own resolution chose $199.94) | Fixed in the fix round. **Reopened (T2D-C03: one failed coverage day retired the old id and took the founder's choice away); fixed in fix round 2: RF-A2 is withdrawn and the new-date row waits as a possible re-date (§11.2)** | — | Fix:199 "the $1/$2 conflict …", Fix:223 "the old id no longer listed …"; AR1-RF-01: Fix:555–595 (four); AR1-RF-03: Fix:634 (both paths) |
| T2D-07 | Coverage: the entry session read as covered (a $100 fill marked at a fresh $104), and a backdated dividend was paid at an uncovered close | Fixed in the fix round | — | Fix:239 "the entry session …", Fix:251 "a dividend dated on the last covered session …" |
| T2D-08 | A `price_move` ruling covered a later halving hidden by its recovery | Fixed in the fix round. **Reopened (T2D-C04: a split simulated on an uncovered close erased the next halving); fixed in fix round 2: the dry runs use the holding's real state (§11.2)** | — | Fix:279 "a round trip …", Fix:305 "a FEED split …", Fix:329 "a partial recovery …", Fix:717 (the drift case); AR1-RF-04: Fix:657, Fix:702 |
| T2D-09 | A chosen conflict payload paid a ledger that never carried the record | Fixed in the fix round. **Astra's confirmation closed the direct leak; T2D-C05 (a genuine feed row withheld from the comparison) is fixed in fix round 2 (§11.2)** | — | Fix:356–436 (eight: all three ledger roles, a frozen-basket close, a genuine feed row kept, a ledger gaining the record after the ruling) |
| T2D-10 | A permanently refused founder payload locked its own record and masked the feed's later correction | Fixed in the fix round | — | Fix:452 "a recorded 1-for-1,000,000,000 …", Fix:472 "a possible re-date …", Fix:490, Fix:504 |
| T2D-11 | A legacy split receipt (no `sharesBefore`) stranded a dividend and a sale | Carried | **T5**. The founder ruled the guard only: no idea book has run in production, so the legacy shape cannot exist. Every share-basis receipt is checked for both counts (Fix:"T2D-11 …", and every Fix row's `afterEach`) | A-2B3 T2D-11 |
| T2D-12 | A parser rejection read as clean coverage (the register's 2b3-A3) | Carried | **T1a-2b-4 (before the switch)**; §10.4 records the proposal | A-2B3 T2D-12 |
| T2D-13 | P2: the 60 s pass budget bounds the starts of fetches, not their completion | Carried | **T5** (with C-7) | A-2B3 T2D-13 |
| T2D-14 | P2: a stale failed backfill can overwrite a committed successful one | Carried | **T5** | A-2B3 T2D-14 |

## 8. New stores and fields, and the founder's steps after merge

**One new collection** (server-only; the rules' catch-all deny covers it — no rules or index change):

| Store | Written by | Read by | Shape |
|---|---|---|---|
| `practiceFieldCaBackfill/{SYM}` | `caBackfill.js ensureCoverageBackfills` (two `ref.set` sites, allowlisted) — reached from `closeIdeaBook` and, when sessions were missed, `catchUpIdeaBook` | the idea book's close (`close.js closeNextSession`, inside its transaction) and `resolve_hold` (`founderControls.js applyResolveHold`, for a `coverage_gap` `row` ruling) — never a quarterly reader | `{ schemaVersion: 1, symbol, from, to, failed, actions, calls, fetchedAt, source: 'idea_book_backfill' }` — one document per symbol, its widest successful range; a failed answer is stored only when no successful one is |

The backfill's upstream calls are counted on the existing day counter `mandateUpstreamCalls/{date}`. The founder's ruling request is recorded in the existing `practiceFieldBooks/{uid}/founderOps/{requestKey}`.

**New fields** (all on idea-book documents only; nothing quarterly):

| Where | Field | What it holds |
|---|---|---|
| idea | `caCoveredThrough: { SYM: date }` | F-1: the last session each held symbol's corporate-action data covered |
| idea | `caCoverageGaps: { SYM: { since, lastSession, sessions, reason, backfillNeeded } }` | F-1: an open coverage gap (id `ca_coverage_gap_SYM_<since>`) |
| idea | `founderRulings: [ … ]` | F-5: each ruling — `requestKey, kind, recordId, decision, by, at, appliedOn, outcome` (`applied` / `moot`), and by kind `symbol, ledgers, ratio, actionId, covers, coversThrough, row, payload, type, effectiveDate, recordReason` |
| holding | `basisSuspicion.seenAtRaise`, `.lastSeen`, `.raisedBy` | F-5: the quote seen at the record's session (once), the last one seen while it stands (covered closes only), and — for a record a `price_move` ruling raised — the ruling and the record it followed |
| holding | `basisSuspicionHistory: [ … ]` | F-8: retired records, each with `closedOn` and `explainedBy` (the row), or `ruling`, `resolvedBy`, `resolvedAt` (the founder), and `replacedBy` (T2A-E01) |
| holding | `screenReference: { price, session, snapshotKey, ruling }` | F-5: the gap screen's reference after a `price_move` ruling, until the first fresh mark |
| holding | `heldActions[].founderRuling` | F-5: a held action a ruling supplied keeps its ruling |
| receipt | `reason: 'possible_redate'` + `redateOf`; `reason: 'settled_by_redate'` + `settledBy`; `reason: 'founder_ruled_none'` + `founderRuling` | F-7, F-5 |
| receipt | `sharesBefore`, `sharesAfter` (share-basis); `entitledShares`, `entitledSharesFrom`, `entitledSharesAlsoFrom` (a late dividend) | F-7 (C-16, review C3) |
| receipt | `explainedSuspicion: { id, … }`; `founderRuling` | F-8; F-5 |
| row mark | quality `ca_coverage_missing` | F-1 |
| result | `spy.inDoubt: [ { symbol, reasons, heldDividends } ]` | F-4 |
| endpoint | `unsettledActions` also lists coverage-gap ids and share-basis possible re-dates | F-1, F-7 |
| receipt | `conflicting_action`: `rows` keeps every distinct payload seen (a later one with `seenOn`, a backfill's with `origin: 'backfill'`), `kinds` (`conflict`, `revision`, `archive_backfill`), `lastRevisedOn`, `revisedFrom`; `possible_redate` gains `rows` and `kinds`; new `reason: 'revised_after_ruling'` + `rows`, `ruling`, `ruled`, `closedBy`, `closedOn`; `founderRuling.seen` on every receipt a conflict ruling writes. `settled_by_redate` is no longer written (RF-A2 withdrawn) | Rev 1 (fix round 2, §11) |
| endpoint | `unsettledActions` lists every open ambiguity (a cash possible re-date and a revised ruling included); `spy.inDoubt` names `revised_after_ruling` | Rev 1 |
| ruling | `seen` (the payloads its records held); a confirm ruling carries `confirms: true`, `recordReason: 'revised_after_ruling'`; outcomes add `moot` for a symbol no named ledger holds and `refused` with `rename_target_taken` | Rev 1 |

**Alerts added:** (fix round 2) `PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS` now names every conflict, revision, new payload, possible re-date and revision after a ruling as it is seen, and `…_UNSETTLED` every open one at each close; `PRACTICE_FIELD_HOLD_RULING_MOOT` for a ruling on a symbol no ledger holds. (The build:) `PRACTICE_FIELD_CA_COVERAGE_GAP` (from the fifth session of a gap), `PRACTICE_FIELD_CA_BACKFILL_FAILED`, `PRACTICE_FIELD_CORPORATE_ACTION_REDATE`, `PRACTICE_FIELD_HOLD_RULING_MOOT`, `PRACTICE_FIELD_HOLD_RULING_STEP`, `PRACTICE_FIELD_IDEA_DOC_LARGE` (from 786,432 bytes).

**Founder steps after merge:** none to deploy — no rules, index, flag or pin change; `PRACTICE_FIELD_MODE` stays `'off'`, so nothing here runs in production. Sign-off asked: Q6 (the new collection). Rulings asked: §3.2.

## 9. Found outside the task

- **`origin/main` moved during the build** (abcdfcb7 → 2e069d42, PR #1086, Shared Research only — no file this build touches). It was merged into the branch (33b120c9) before the final checks, and the differentials were run against it.
- **Rows that could reach the vendor** (review, lens A N3): three rows that exist on base — `catchUp.test.js:291`, `windowLedger.test.js:379`, `api/cron/practiceFieldIsolation.test.js:978` (IS-3) — now reach `fetchCorporateActionsEODHD` through the backfill. Without a key they fail at once ("not configured"); with a key exported in a shell they would call EODHD. `catchUp.test.js`, `windowLedger.test.js` and `corporateActionFinish.test.js` now stub the key empty; IS-3 already stubs the global `fetch` and records the calls. Every suite run of this build logged "not configured", so no call was made.
- **The daily builder's own fetch has no timeout** (`mandateUniverseSnapshot.js`, quarterly, untouched): it runs once a day before the books. The idea book's backfill now bounds its own calls (FR-5).
- **Lint:** two unused variables in `evidence.test.js` are on `main` and outside this build; `npm run lint:gate` passes.
- **Pre-existing corporate-action defects the review found** (C4, C5, a late dividend after the idea's line sale, C7's share-basis analogue, A3) are corporate-action items, so they are in the register (§7) as carried, not here.

## 10. Astra's final review, and the fix round (18 Nov 2026)

| | |
|---|---|
| Review | `docs/audits/20261118_ASTRA_REVIEW_T1A2B3.md` — Astra's final review of the corporate-action path at c79367b5, committed byte-identical (SHA-256 `5840bd21ee5950304b384711992cf6fc8d12e4d4b6ca64dcfd49efc8f3879f08`, CRLF as attached) in ad413fb4. Verdicts: dark merge **DO NOT MERGE**; founder allowlist **NOT READY** |
| Scope | Set by the founder (§10.1): seven findings fixed, one guarded, four carried to T1a-2b-4, three to T5 |
| Commits | ad413fb4 (the review), 737282ed (the fixes and their rows), 3373476c (the refuter's fixes), 943f1286 and d96af701 (rows the battery asked for), 782cb74b (no all-ledger ruling map), 7fcfbd19 (this report), de7180d0 (a matching row held at an uncovered close, §10.7), then this report's update |
| Head | Code head de7180d0; the report's commits add documents only |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No flag, pin, rule, index or quarterly file changed; no fenced file edited; no new store; no model, Firestore or EODHD call made |

### 10.1 What the founder asked

The founder's scope for this round, from the session (the prompt file it names, `FIX_PROMPT_T1A2B3_ASTRA_ROUND1_NOV18_2026.md`, was not on this machine; the scope below is the founder's own words in the session):
- **Fix now:** T2D-01 (with Q10), T2D-02, T2D-06, T2D-07, T2D-08, T2D-09, T2D-10.
- **T2D-11:** only the guard test (every share-basis receipt carries `sharesBefore` and `sharesAfter`); registered as T5. No idea book has ever run in production, so the legacy shape cannot exist.
- **Not fixed:** T2D-03, T2D-04, T2D-05 and T2D-12, registered "Carried: T1a-2b-4 (before the switch)". They need a new adjustment mechanism, which will be its own build.
- **T2D-13 and T2D-14:** T5.
- Failing rows first, one refuter on the fix round, the full Linux suite, lint, build, rules, both differentials, Astra's review committed byte-identical, the §7 register updated; push to the draft PR and stop. Nothing merged; the flag stays `'off'`.

### 10.2 In plain terms

What was wrong, and what now happens:
- **A split the vendor moves by a day after the idea bought (T2D-01, with Q10).** The idea bought on a split's ex-date, so it was not owed the split, and the close declined it. When the vendor moved the same split to the next day, the close took it as a new split and credited the idea 50% more shares: +$4,998.50 that never existed. A declined action now keeps its terms, and a matching row a few sessions away is held for the founder instead of paid. A dividend moved the same way is not paid (Q10).
- **A long catch-up after an outage (T2D-02).** The idea book fetched the missing split and dividend, then closed 22 sessions from old daily records that did not have them, so neither was ever applied. Every catch-up session now reads what was fetched.
- **One conflicting dividend paid twice (T2D-06).** When the vendor listed the old date and a new date at once, the close both declined and paid the old one. That can no longer happen: with two possible readings, the old one stays open for the founder.
- **Two gaps in "a day without data is a day of doubt" (T2D-07).** On the day an idea bought, a failed data fetch still produced a fresh price; and a dividend dated on the last good day, first reported on a bad day, was paid. Both now wait for a day whose data is good.
- **A ruling that reached too far (T2D-08).** When a price halved, halved again and recovered while a hold stood, a ruling on the first halving also released a dividend dated in the second. Each split-shaped move is now kept, with its date, and a ruling releases only its own.
- **A ruling paid on the wrong ledger (T2D-09).** The founder's choice for a conflict on the idea's own record could be paid to a comparison that never had the conflict. A ruling now names the records it covers and reaches only them.
- **A ruling that locked itself (T2D-10).** If the founder chose a ratio that would round a holding to nothing, the ruling could never apply and could not be replaced. Such a choice is now refused when it is made; if it fails later anyway, the ruling closes with its reason and the founder can choose again.
- **Old receipts (T2D-11).** Every split receipt now carries the share counts before and after it, and a test checks that on every receipt.

**Not fixed in this round, by the founder's decision:** a dividend owed after a line sale (T2D-03), a dividend paid before a late split (T2D-04), a vendor correction of an action already applied (T2D-05), and a vendor row the parser rejects (T2D-12). They need a way to adjust money already paid, which is its own build, T1a-2b-4, before the switch. Two backfill timing items (T2D-13, T2D-14) wait for T5.

**So the switch stays NOT READY** until T1a-2b-4 lands; this round answers the seven findings the founder put in it.

### 10.3 The fixes, by `file:line`

Line numbers are at the code head de7180d0. **Fix** rows are `corporateActionFixRound.test.js` by line and the start of the row's name. Every Fix row was run at c79367b5 (the reviewed head) and at 737282ed (before the refuter's fixes): §10.6 gives which fail where.

| Finding | What changed | `file:line` | Rows |
|---|---|---|---|
| **T2D-01, with Q10** | A `not_entitled` decline keeps the payload it declined (`ratio`, `amount`, `cashPerShare`). `possibleRedateOf` matches it, and every payload of a conflict the holding was not entitled to (AR1-RF-02), so a row of the same type and payload within five sessions is a `possible_redate`: a split is a doubt held for the founder (Q1), a dividend is not paid (Q10). The founder's `conflict` ruling (`payload` or `none`) settles it | `ledger.js:205` `NOT_ENTITLED` · `:897` the decline's receipt · `:913` `possibleRedateOf` · `:918` the not-entitled conflict's rows | Fix:103 "T2D-01 / Q10 …" (a 3-for-2 and a 1-for-2), Fix:136 "Q10: …", Fix:612 "AR1-RF-02 …" (two), Fix:623 |
| **T2D-02** | A catch-up close reads each held symbol's stored backfill, inside its transaction, whatever the archived daily entry says, and a successful backfill's rows join that idea's rows. They are applied through the session being valued, and once. A backfill row never settles a conflict it took part in (AR1-RF-05): it joins only while the session's own rows list that id | `close.js:702` the read · `:246`–`:254` the union and the RF-05 filter | Fix:160 "T2D-02 …" (both variants, the 20-session boundary, a replay), Fix:679 "AR1-RF-05 …" |
| **T2D-06** | An unsettled conflict whose own id is listed in the call is never settled under a moved date. With a matching row under another date listed now, applied earlier, or held on the holding (an uncovered close held it), it stays open (`ambiguousConflicts`, alerted `PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS`) and its own row is not applied. The founder's own ruling on it is never "ambiguous" (AR1-RF-01). A conflict whose own row is held on the holding replays it (AR1-RF-03). Candidates read the live settled set, so no id is both declined and applied | `ledger.js:932` `listedNow` · `:937` `matchingRowOf` · `:946` the held row (RF-03) · `:950` the ruled id (RF-01) · `:1064` the live settled set · `:1066` · `close.js:344` the alert | Fix:199 "the $1/$2 conflict …", Fix:223 "the old id no longer listed …", Fix:555–595 "AR1-RF-01 …" (four), Fix:634 "AR1-RF-03 …" (two), Fix:733 (a matching row held at an uncovered close; both paths) |
| **T2D-07** | The session's own valid entry, or a backfill reaching it, is required even when `caCoveredThrough` is the session or later (the entry session, whose start is the opening date). On an uncovered close a coverage-gap item holds EVERY count-dependent row of the symbol, whatever its date. It is held on the holding and replayed once when coverage returns | `dailyCoverage.js:200` `needFrom` · `ledger.js:1004` | Fix:239 "the entry session …", Fix:251 "a dividend dated on the last covered session …" |
| **T2D-08** | While a record stands, each split-shaped transition between consecutive prices observed is kept with its dates (`transitions`). One seen at an uncovered close is kept too, flagged `uncovered`, and never moves `lastSeen` (AR1-RF-04). Whatever retires a record promotes its first transition to the next record, carrying the rest: a `price_move` ruling (`priceMoveReference`), a founder `split`, or an explaining feed row. What is dated after that transition stays held | `ledger.js:451` the refresh · `:470` `transitionOf` · `:484` `recordOfTransition` · `:516` the ruling · `:1209` the explaining row · `close.js:310` (`pricesUsable`) | Fix:279 "a round trip …", Fix:305 "a FEED split …", Fix:329 "a partial recovery …", Fix:657 "AR1-RF-04 …", Fix:702 "… its edge" |
| **T2D-09** | A conflict ruling records the ledgers whose record it covers (`ledgers`). At the close it is revalidated on each, and it is applied, replaces feed rows and completes only there. `applyFounderRulings` returns per-ledger maps only (`extraActionsByLedger`, `ruledIdsByLedger`, `replacedIdsByLedger`). The close hands each ledger its own rows (`actionsOf`), and `shareBasisHolds` takes them per ledger | `holdRulings.js:142` · `:192` · `:212` · `:259` · `:337` · `close.js:302` · `ledger.js:682` | Fix:356–436 "T2D-09 …" (eight: all three ledger roles, a frozen-basket close, a genuine feed row kept, a ledger gaining the record after the ruling) |
| **T2D-10** | A choice that would round a named ledger's holding to nothing is refused up front: `ruling_unrepresentable` (422), which writes nothing, so the record takes another ruling. That covers a conflict payload, a founder split and a coverage-gap row. At the close, a conflict or suspicion ruling's action the applier refuses for good is reported (`founderRefusals`) and leaves no held record. `markRulingsApplied` closes the ruling `outcome: 'refused'` with its reason and where it applied, if anywhere (alert `PRACTICE_FIELD_HOLD_RULING_REFUSED`), which releases the record's lock and stops it masking the feed's own row | `holdRulings.js:64` `unrepresentableOn` · `:125` · `:149` · `:172` · `:309` · `ledger.js:1144`–`:1149` · `close.js:423` | Fix:452 "a recorded 1-for-1,000,000,000 …", Fix:472 "a possible re-date …", Fix:490 "(pure) a founder split …", Fix:504 "(pure) a ruling whose action the applier refuses …" |
| **T2D-11** (T5) | The guard: every applied share-basis receipt on every ledger of every idea in the store carries finite, positive `sharesBefore` and `sharesAfter`. It is checked in the Fix file's `afterEach` after every row, and by a row exercising feed splits, a held split applied late, a conflict payload and a founder split | `corporateActionFixRound.test.js` `shareBasisReceiptsMissingCounts` | Fix:536 "T2D-11 …" |

Two build rows changed with the round:
- `close.test.js` "a holding opened ON the effective date …" pins the decline's receipt, which now carries its payload (T2D-01).
- `corporateActionFinish.test.js` "A1: …" now dates the second halving at the uncovered close that observed it (S[2], AR1-RF-04). It still asserts that `lastSeen` stays at the covered close, which is the row's own guarantee.

### 10.4 Carried, with homes

| Id | Home | Note |
|---|---|---|
| T2D-03 | **T1a-2b-4 (before the switch)** | Needs the ledger's holding history (fills, actions and sales) to pay a dividend owed on a holding sold since its ex-date, once, to the idea and the book |
| T2D-04 | **T1a-2b-4 (before the switch)** | Needs a linked, idempotent cent adjustment on each ledger and the book when a late share-basis row predates a paid dividend |
| T2D-05 | **T1a-2b-4 (before the switch)** | Needs a correction record for a changed payload under a settled id, a hold on the disputed money or quality, and one auditable adjustment after resolution |
| T2D-12 | **T1a-2b-4 (before the switch)** | **The proposal, for that build** (the founder asked it to be recorded): a per-symbol parse report in its own server-only collection (`practiceFieldCaParseReports/{date}`), written by a Practice Field fetch wrapper that the daily build receives only when an idea book is active. `ensureDailySnapshot` already takes a `fetchCorporateActions` option, and `practiceFieldBuildInputs` (`sweep.js`) already supplies the daily build's options, so `mandateUniverseSnapshot.js` stays byte-identical. The wrapper tees the vendor's raw JSON through `fetchImpl`, runs the exported parsers, and counts a reject or a non-array envelope as incomplete. It returns exactly `{ actions, calls, failed }`, so the daily document, the logs and the calls are unchanged. The backfill records the same report. **The lean, also the founder's:** a session whose report is missing counts as uncovered (fail-closed). That needs the founder's sign-off for the new collection, as Q6 did |
| T2D-11 | **T5** | The guard is built (§10.3) |
| T2D-13 | **T5**, with C-7 | Pass the lesser of the remaining pass time and the per-fetch limit to the fetch, cancel unfinished HTTP work, count requests already started; until then the documented deadline is "starts within 60 s" |
| T2D-14 | **T5** | Re-read the backfill document in a transaction at publication; a committed success is never overwritten by a failure |

### 10.5 Readings stated

Where Astra's fix instruction stops, this is what was built. Each is a question if the founder or Astra reads it otherwise.

| # | Finding | Reading built |
|---|---|---|
| AR1-1 | T2D-01, Q10 | The decline that matches is the `not_entitled` one: the action exists and the holding was not owed it. A `founder_ruled_none` or `settled_by_redate` decline carries no payload of its own and matches nothing new (a re-date of what settled a conflict already matches the applied row). Every payload of a conflict the holding was not entitled to (an action the feed listed two ways on the ex-date) matches too (AR1-RF-02). A decline written before this round carries no payload and matches nothing; no idea book has run in production |
| AR1-2 | T2D-06 | "Two economic interpretations remain" is read as: the conflict's own id is listed in this call with one payload, and a matching row under another date (within five sessions) is listed now, was applied by an earlier close, or is held on the holding. The row under the new date is applied — both readings pay it — and the old id's row is not; the conflict stays open, alerted `PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS`, until the founder rules (`none`, or a payload). RF-A2's settle under a moved date still happens when the old id is not listed. The founder's own ruling on the conflict is never ambiguous (AR1-RF-01). A conflict whose own row is held on the holding — an uncovered close held it — replays it as the covered close would have applied it, and is not settled under a moved date meanwhile (AR1-RF-03) |
| AR1-3 | T2D-07 | Evidence for the session itself is required whenever `caCoveredThrough` (or the opening session standing in for it) is the session or later. On the entry session an uncovered symbol keeps `caCoveredThrough` at its opening session — nothing dated on or before it is owed — so the next covered close continues from there |
| AR1-4 | T2D-02 | A catch-up close reads every held symbol's stored backfill (one read each; catch-ups only), and a successful backfill's rows join that idea's rows whether or not coverage needed them. A row dated after the session waits (the engine's `onOrBefore`); a row already settled is skipped (the ledger's ids). A backfill row never settles a conflict it took part in: a row of an id this idea holds an unsettled conflict on joins only while the session's own rows list the id, so once the archived row has left the window the conflict stands for the founder (AR1-RF-05; FQ-3) |
| AR1-5 | T2D-08 | A transition is a split-shaped move (the engine's own screen) between two consecutive prices seen while the record stands, recorded at every close whose snapshot is used and whose quote is complete. One seen at a close whose corporate-action data does not cover the symbol is kept, flagged `uncovered`, and never moves `lastSeen` (AR1-RF-04): the price is observed, but a ruling's reference stays a covered close's (lens A's A1). Every retirement promotes the first transition — a founder `price_move`, a founder `split`, or a feed row that explains the record. With none left, FR-14's endpoint judgement still runs |
| AR1-6 | T2D-09 | A ruling recorded before this round has no `ledgers` and names all three (as before). A founder split goes only to the ledgers where its record still stands. A coverage-gap `row` stays idea-wide: it is a fact about the symbol, not a ledger's record |
| AR1-7 | T2D-10 | A choice is refused up front (`ruling_unrepresentable`, 422) when it would round the holding to nothing on ANY ledger the ruling names — the conservative side: the founder then chooses another payload or `none`. A refusal writes nothing, so it leaves no request to replay. The close's backstop (a holding changed after the ruling) closes the ruling `outcome: 'refused'` with its reason (and, partly refused, names where it applied). A coverage-gap `row` is checked up front on every ledger; refused at the close, it is held as a feed row would be |

### 10.6 Tests: rows first, then the checks

**The fix round's rows.** `corporateActionFixRound.test.js` has 40 rows. Each was run against `git archive` trees of the earlier heads, with the vendor stubbed:

| Head | Fail | Pass | The passes are |
|---|---|---|---|
| c79367b5 (the reviewed head) | **31** | 9 | Two controls (T2D-02 with failed archived entries; RF-A2 with the old id no longer listed) and the T2D-11 guard. Four refuter rows for regressions this round itself introduced and then fixed (AR1-RF-01's share-basis and $2-applied rows, AR1-RF-03's two paths). The RF-04 edge row and the drift row, which the reviewed head already handled |
| 737282ed (before the refuter's fixes) | **10** | 30 | The refuter's nine failing probes, and the uncovered path of the held-row row (Fix:733), found after the refuter (§10.7) |
| de7180d0 (the code head) | 0 | **40** | — |

**Astra's own probes**, rerun unmodified on this round's code (`run/probe/independent.test.js`, `more.test.js`; her base and head harness, the head tree swapped). Her numbers flip:

| Finding | Astra at c79367b5 | This round |
|---|---|---|
| T2D-01 | 149.955012 shares, full quality (+$4,998.50) | 99.970008 shares, held for the founder (not full quality) |
| T2D-02 (valid archived entries) | 99.970008 shares, $0, full quality | 124.962510 shares, $124.96 — the same as with failed entries |
| T2D-06 | $299.91, full quality | $199.94, the old id neither declined nor paid; the conflict open (not full quality) |
| T2D-07 (entry session; backdated dividend) | a fresh $104 mark, full quality; $99.97 paid | carried as `ca_coverage_missing` at $100; $0, held |
| T2D-08 | $99.97 released, full quality | a record for the hidden halving; $0, held |
| T2D-09 | the comparison credited $99.97 with a founder receipt | nothing reaches the comparison; the ruling names `['ledger']` |
| T2D-10 | the ruling pending for good; `record_already_resolved` | 422 `ruling_unrepresentable` up front; the alternative applied (79.976006 shares); `none` declines the re-date |

Two of her probes assert her own observation and now fail, as they should:
- "split redated after ex-date purchase" asserts full quality.
- "live conflict ruling … on just one ledger" plants a same-stock comparison whose receipts differ from the idea's. The close now pays only the ledger with the record, and the same-stock tie (`reconcile.js` `comparison_not_tied`) refuses the planted book. The scoping is pinned without planting an inconsistent book: Fix:361 (all three ledger roles), and Fix:388 on a frozen-basket comparison that also holds AAPL.

**The checks.**

| Check | Where, and the command | Exit | Log lines |
|---|---|---|---|
| Full suite (Linux) | WSL worktree of `~/pd-ci` at de7180d0: `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **0** | `Test Files  1562 passed | 13 skipped (1575)` · `Tests  35591 passed | 173 skipped (35764)` — the build's 35,551 plus the round's 40 rows |
| Lint gate | the same tree: `npm run lint:gate` | **0** | no error, no warning (`--max-warnings 0`) |
| Build | the same tree: `npx vite build` | **0** | `✓ built in 16.43s`. Its four esbuild CSS-minify warnings are the build's own: the same four in its final runs |
| Rules suite | the same tree: `npm run test:rules` (Firestore emulator) | **0** | `Test Files  46 passed (46)` · `Tests  839 passed (839)` |
| Seventeen-scenario differential | Astra's harness, base `git archive` of `origin/main` 2e069d42 against a tree of de7180d0 | **0** | 17 scenarios × `off` and `on`: **34/34 identical**; 4,000 default build sets identical; the quarterly prompts byte-identical, with the positive control |
| 40-case traced differential | Astra's harness, the same run | **0** | **40/40 identical** |
| Backfill isolation (rule 5) | the build's scenario beside her harness, the same run | **0** | 4/4: a planted backfill reaches no quarterly reader; the vendor's split does (control) |
| The idea book (Windows, targeted) | `vitest run api/_utils/practiceField api/practice-field api/cron/practiceFieldIsolation.test.js api/cron/practiceFieldNoBook.trace.test.js api/_utils/compositionProtectedStores.scan.test.js` | **0** | `Test Files  25 passed (25)` · `Tests  808 passed (808)` |
| Linux-only scans | `mandateMoneyRounding.scan.test.js`, `compositionProtectedStores.scan.test.js` (WSL) | **0** | 33/33 — no raw rounding added; no new store |
| End-to-end pin | `endToEnd.test.js` (in the suite) | **0** | the dump's SHA-256 is still `abcf8420…c24ed9` (443,533 bytes): with complete data no money leaf — and no leaf — changed this round |

No vendor call, model call or Firestore write was made: every store is the in-memory fake or the local emulator, the vendor key is stubbed empty and `fetch` refuses in every new row, and the suite's backfill lines all say "not configured". The report's own commit adds documents only; the build, lint and suite ran again on it before the push (the PR description records them).

**The mutation battery** (the build's `run-battery.mjs`):
- 115 mutants on the code head: the build's 85, plus 30 for this round (AR1-M01 to AR1-M30; one or more per fix, per refuter fix and for the held-row match).
- Five of the build's anchors moved with this round's edits and were re-cut with the same intent: F1-06, F1-13, F8-01, R-A1 and R-A4.
- The final run was in a private WSL worktree at de7180d0, the final code, in one pass. Baseline 808 rows, 0 failing. **Defined 115, ran 115, broken 0, killed 114, survived 1.**
- Earlier runs:
  - At 943f1286, 112 of 114 were killed. R-B1 (`priceMoveReference`'s endpoint judgement disabled) survived: this round's transitions catch every case its rows built. The drift row (Fix:717: a split-shaped whole made of steps that are not split-shaped) kills it.
  - At d96af701, every `holdRulings.js` mutant was rerun after that file changed.
  - The held-row fix then changed `ledger.js`, so the whole battery ran again.
- **AR1-M05 survives and is equivalent.** It removes the live settled-set check in the candidates loop. After this round no candidate's id can be declined earlier in the same call:
  - RF-A2 settles only a conflict whose own id is not listed and whose own row is not held (`ledger.js:932`, `:946`), so it never declines a candidate;
  - a `not_entitled` id is never pending;
  - a founder's `none` is declined before the call.
  
  The check stays as the backstop for Astra's "one id never both declined and paid", which the T2D-06 rows assert after every close (`appliedAndDeclined`).

### 10.7 The fix-round refuter

The founder asked for one refuter on the fix round. It checked 737282ed on its own `git archive` tree. It worked read-only on git and on the shared tree, against the reviewed head as a base. Every finding below had a probe, and each probe is now a committed row. Its ids are AR1-RF-n.

| Id | What it broke | Introduced by | Exit criterion | Done |
|---|---|---|---|---|
| AR1-RF-01 | A founder `payload` ruling on a conflict that T2D-06 left open was never applied: the ruling's own row met the ambiguity rule. The record stayed locked (`none` answered 409), with the sale held | T2D-06 | 4, 5 | **Fixed** (`ledger.js:950`). Fix:555–595 |
| AR1-RF-02 | An ex-date action the feed listed two ways (a conflict with `entitled: false`, not a `not_entitled` decline) still credited its re-date: +$4,998.50 on a 3-for-2, at full quality | Pre-existing; T2D-01's fix was incomplete | 3 | **Fixed** (`ledger.js:918`). Fix:612, Fix:623 |
| AR1-RF-03 | A conflict id's own row, held at an uncovered close (T2D-07), was then settled `settled_by_redate` under a new date. $199.94 where the covered path pays $299.91: the money depended on whether one day's fetch failed | T2D-07 with T2D-06 | 3, 6 | **Fixed** (`ledger.js:946`): the held row replays as the covered close would have applied it. Fix:634 (both paths) |
| AR1-RF-04 | No transition was recorded at an uncovered close, so a halving seen only there escaped the `price_move` ruling's scope | Pre-existing; T2D-08's fix was incomplete | 5 | **Fixed** (`ledger.js:451`): kept, flagged `uncovered`; `lastSeen` still moves only at a covered close (lens A's A1). A snapshot naming another layer yields none. Fix:657, Fix:702 |
| AR1-RF-05 | The T2D-02 union let a backfill row outlive the archived row it conflicted with and settle the conflict alone. 3/2 was applied at full quality where the price showed 5/4 (149.955012 shares at $80) | T2D-02 | 2, 3 | **Fixed** (`close.js:248`–`:254`): a backfill row never settles a conflict it took part in, so the founder decides. Fix:679 |
| Note | A partly refused ruling's alert said "nothing was changed" while one ledger had applied it | T2D-10 | — | **Fixed**: the alert and the ruling name where it applied (`appliedOnLedgers`) |
| After the refuter | Found in a last review of the round; the same class as AR1-RF-03. A matching row HELD at an uncovered close did not count for T2D-06's ambiguity. The next close applied the old row and replayed the held one: $299.91, where the covered path leaves the conflict open at $199.94 | T2D-06 with T2D-07 | 3, 6 | **Fixed** (`ledger.js:937`–`:938`): a held, unrefused row counts. Fix:733 (both paths; the uncovered one fails at 737282ed and up to 7fcfbd19) |

**No refuter ran after the refuter's fixes.** The founder's scope named one refuter, and it checked 737282ed. The code no refuter has seen is:
- `ledger.js:918` (RF-02);
- `:937`–`:950` (RF-01, RF-03 and the held match);
- `:438`–`:459` (RF-04);
- `close.js:248`–`:254` (RF-05).

Each is pinned by its rows and by the battery's AR1-M23 to AR1-M30 (§10.6). Astra's confirmation is the next adversarial read.

What it found to HOLD, with probes:
- The end-to-end dump is byte-identical to Astra's H, so complete-data money is unchanged.
- No id is ever both applied and declined, in any run.
- The entry-session requirement breaks no normal flow.
- A held dividend is paid exactly once after a long outage and a backfill: same id, a re-dated id, or a corrected amount.
- A founder `split` on a record with transitions conserves on all three ledgers and the book.
- A replay of the original request key after a close-time refusal answers the stored response and acts again on nothing.
- The Q10 matcher's false positives fall inside the accepted Q4 and Q1 limits.

Code read only, not probed:
- A conflict of three or more rows still settles against the first matching row (pre-existing).
- A ruling recorded without `ledgers` names all three (none exists; dark).
- T2D-09 with a named ledger that sold the symbol collapses into T2D-03 (carried).
- A coverage-gap `row` refused at the close leaves a refused held record that no ruling kind releases. It needs the holding to change between ruling and close, and the up-front check refuses the case it can see. This is T2D-11's class (no ruling kind for a refused held record), carried to T5.

### 10.8 Questions for the founder

| # | Question | Built |
|---|---|---|
| FQ-1 | The scope above is your answer in the session; the prompt file it names (`FIX_PROMPT_T1A2B3_ASTRA_ROUND1_NOV18_2026.md`) was not on this machine. Is anything in that file outside what was built? | The answer's scope |
| FQ-2 | T2D-06: when a conflict's old row is still listed beside a matching row under another date, the conflict waits for you even after the new row has left the window and the feed lists only the old one (AR1-2; Fix:595). The alternative: let the old row settle it alone once the new date's row is gone. | Waits for the founder |
| FQ-3 | AR1-RF-05: a backfill row that disagrees with an archived row of the same id makes a conflict only you can settle — more holds after a long outage. The alternative: the archived row wins and the disagreement is only alerted (the money `main` would show). | Waits for the founder |
| FQ-4 | T2D-10: a choice is refused up front if it would round the holding to nothing on ANY ledger the ruling names, so a comparison's tiny holding can block a payload the idea could take (AR1-7). The alternative: refuse only on the idea's own ledger and let a paper ledger hold its own-count doubt (F-4). | Refused on any named ledger |

### 10.9 Where this leaves the verdicts

- **The dark merge.** Every finding the founder put in this round is fixed, and so are the refuter's five and the one found after it. Each has a row that fails at the head it answers, and the mutation battery kills every mutant but one equivalent. The quarterly product is unchanged: the differentials are identical, a planted backfill reaches no quarterly reader, and no quarterly file, flag, pin, rule or index changed. With complete data, money is unchanged: the end-to-end pin `abcf8420…` is byte-identical. That is for Astra's confirmation to judge.
- **The founder allowlist stays NOT READY** by the founder's own scope: T2D-03, T2D-04, T2D-05 and T2D-12 are T1a-2b-4's, before the switch.

## 11. Astra's confirmation, Amendment F revision 1 (sticky ambiguity), and fix round 2 (18 Nov 2026)

| | |
|---|---|
| Review | `docs/audits/20261118_ASTRA_CONFIRMATION_T1A2B3_ROUND1.md` — Astra's confirmation of round 1 at d2370f51, committed byte-identical in 1f3adaca (SHA-256 `1e4338019855de7d768ad2960962d697bf0d9a34dced6f859823be8a2ed3774f`, 20,612 bytes, one CR as attached). Verdicts: dark merge **DO NOT MERGE** (T2D-C01 to T2D-C05); founder allowlist **NOT READY** |
| Ruling | `docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md` — the founder's ruling for this round, at its destination, byte-identical in 1f3adaca (SHA-256 `8f9bd794dcdc31d55600879c1b8f7ac695a19dfd517b4d46cb6d51d3d08e1e9c`, LF). It replaces T1a-1's R-21 and withdraws RF-A2; where it and an earlier rule disagree, it wins |
| Commits | 1f3adaca (both documents) · 579d0953 (S-1 to S-5; every row that pinned R-21, RF-A1 or RF-A2 re-pinned) · 2fa54413 (C01–C05 as fixed cases; the re-date pair before anything applies) · 4e253c61 (S-6) · 1f9a7de0 (two rows) · e7a54cec (the AR2 review's fixes) · 778ab641 (S-6 reaches the pinned classes; I-2 against the generator's own oracle) · e35434e0 (the final refuter's fixes) · b040987d (the rows the battery asked for, and the held-founder-row gap its trace found) · this report |
| Code head | b040987d. The report's commit adds documents only |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No flag, pin, rule, index or quarterly file changed; no fenced file edited; no new store; no model, Firestore or EODHD call made |

### 11.1 In plain terms

Astra found five more orders of vendor events in which the code settled an ambiguous corporate action on its own and got the money wrong at full quality. Each earlier round closed one order and the next review found another, so the founder ruled the cause out (revision 1): **once an action is ambiguous, only the founder settles it.**

What now happens:
- **An action is ambiguous** the first time the feed lists it two ways (in one day, across days, or once from the daily data and once from a backfill), changes a payload it already showed, or shows a payload under a new date that may be the same action moved. A moved row and the unsettled row it may repeat both become ambiguous.
- **Until the founder rules,** an ambiguous action moves no cash and no shares, the row stays below full quality, a split puts the stock's whole share count in doubt on every ledger of the idea, and the result names it. Nothing automatic settles it any more: not a later consistent row, not a moved date, not a replay after an outage, not a backfill, not a screening simulation.
- **The founder's ruling** (`resolve_hold`, `conflict`) picks one payload the records saw, or `none`. If the same action later shows a payload the ruling never saw, it is a new ambiguity: alerted, and it waits for the founder again.
- **An action that was never ambiguous** is applied exactly as before. With complete data no money changed: the end-to-end pin is byte-identical (§11.6).

**The cost the ruling accepted:** more holds wait for the founder whenever the vendor's data is inconsistent. In exchange, an inconsistent feed can no longer produce a wrong number at full quality by any path this round's reviewers could find.

### 11.2 Astra's five findings: what was wrong and what now happens

**Fix** rows are `corporateActionStickyAmbiguity.test.js` (Sticky) and `corporateActionSequences.test.js` (Seq) by the start of the row's name. Line numbers are at b040987d.

| Finding | What happened | Now | `file:line` | Rows |
|---|---|---|---|---|
| **T2D-C01** — a revised ex-date conflict paid its re-date | The conflict record kept only the payloads of its first day; the $3 listed the next day was lost, and its re-date paid $299.91 (174.947514 shares for a 7:4) at full quality | The record keeps every distinct payload it sees (`observe`); a re-date is matched against every payload of every conflict or re-date record; both ids wait | `ledger.js:1007` (records), `:1029` `observe`, `:1152` `redateMatchOf`, `:269` `openAmbiguities` | Sticky "cash: $1/$2 …", "a split: 3:2 / 5:4 …", the control; Seq `astra-T2D-C01-cash`, `-split` |
| **T2D-C02** — an archive/backfill disagreement settled without the founder | Re-listing the backfill's 3:2 under the same id (or an archived session repeating it) settled the conflict at 149.955012 shares; the founder's 5:4 then answered 409 | The id is ambiguous; nothing re-listed settles it. The record is marked `kinds: ['conflict', 'archive_backfill']` (backfill rows join tagged `feedOrigin: 'backfill'`). The founder's 5:4 is accepted and applied once (124.96251) | `close.js:252`, `ledger.js:612` `rowOfPayload`, `:625` `kindsOf` | Sticky "held through the catch-up …", "an archived session that REPEATS …"; Seq `astra-T2D-C02-archive-backfill` |
| **T2D-C03** — one failed coverage day took away the founder's choice | With the overlap day uncovered, the new row's replay retired the old id `settled_by_redate`; the founder's $1 answered 409 | RF-A2 is withdrawn. The new-date row is a possible re-date of the open conflict in both arms; the same state, the same ruling (200) and the same money ($99.97) covered or not | `ledger.js:1152`–`:1176`, `:1300` (the pair before anything applies) | Sticky "both arms …"; Seq `astra-T2D-C03-covered`, `-uncovered` |
| **T2D-C04** — a split simulated on an uncovered close erased the next halving | The gap screen's dry run applied the 2:1 coverage held, retired the suspicion in the simulation, and skipped recording $50 → $25; the dividend was paid $299.91 | Both dry runs take the close's coverage holds and every ledger's open share-basis ambiguity (`dryHolds`); the halving at the uncovered close is recorded, promoted when the 2:1 explains the first, and the dividend waits ($0) in all four of Astra's variants | `ledger.js:429`, `close.js:314`–`:333` | Sticky "T2D-C04 …" (four); Seq `astra-T2D-C04-split-first-at-2`, `-3` |
| **T2D-C05** — an idea-only conflict suppressed genuine comparison cash | The close filtered the backfill's row idea-wide, so the comparison, which held no record of the id, got $0 on the ruling close | The idea-wide filter is gone: each ledger's gate decides (S-5). The comparison is paid its own $149.96 on the ruling close (value $20,143.96); the idea its ruled $399.88 | `close.js:245`–`:253` | Sticky "the founder picks $2 …", "without a ruling …" |

### 11.3 The mechanism, by `file:line`

| Rev 1 | What was built | `file:line` |
|---|---|---|
| S-1 ① conflict | Two payloads under one id in one call (the daily layer and a backfill included) record a `conflicting_action` receipt, or add the payloads an open record has not seen. A founder action of a kind other than `conflict` (a coverage-gap row, a founder split) meets the feed's rows of its id like a row (AR2-RF-1) | `ledger.js:1045`, `:1000` |
| S-1 ② revision | A row listed with one payload: an open record takes it if new; a held record (or a waiting rename's target) with a different payload makes the id ambiguous (`kinds: ['revision']`) and no longer replays. An R-36-screened target that differs is a revision too | `ledger.js:1063`, `:1524` |
| S-1 ③ re-date | `redateMatchOf` matches applied, not-entitled and held rows and every payload of every conflict or re-date record; `recordRedatePair` makes an unsettled held row it may repeat ambiguous too. Before anything of a call applies, two unsettled rows of the call that may be one action are both possible re-dates. A not-entitled row that may repeat an unsettled one is a pair too | `ledger.js:1152`, `:1172`, `:1300`, `:1189` (the not-entitled loop) |
| S-1 ④ archive/backfill | Backfill rows are tagged and kept in the record's rows (`origin: 'backfill'`); `kinds` names the disagreement | `close.js:252`, `ledger.js:612`, `:625` |
| S-2 the gate | An ambiguous id is applied, declined, replayed or retired by nothing but a `conflict` ruling's action for it (`isRuled`); a waiting rename of an ambiguous id is not applied from its record; the not-entitled decline is gated too; a held record of an ambiguous id is dropped | `ledger.js:996`–`:999`, `:1322`, `:1516` |
| S-2 after a ruling | A ruling keeps what its records had seen (`seen`) on every receipt it writes. `checkRulingRevisions` runs at the end of every call: a payload outside `seen` — listed now, listed while the ruling waited (`replacedRows`, observed), or kept on the record — is a `revised_after_ruling` record: alerted, below full quality, a split's puts the count in doubt again. The founder answers it with the ruled outcome again | `ledger.js:642` `founderSettledIds`, `:1094`, `:1595`; `holdRulings.js:174`, `:214`, `:318`; `close.js:337` |
| S-2 rulings | Any payload any open record saw is choosable, with every economic field (cash per share, rename target). A founder split or a coverage-gap row under an ambiguous id is refused 409. A rename into a ticker another idea holds is refused at the close (`rename_target_taken`). A payload ruling on a symbol no named ledger holds any more closes `moot` | `holdRulings.js:61`, `:97`, `:165`, `:234`, `:416`; `ledger.js:1560` |
| S-2 named | Every open ambiguity keeps the row below full quality (`close.js:424`) and is counted and named at the endpoint | `settlement.js:209`, `:277` |
| S-3 | A never-ambiguous action takes exactly the old path | (unchanged code) |
| S-4 | Both dry runs take `dryHolds`; an ambiguous row explains no suspicion | `close.js:321`, `ledger.js:429`, `unresolvedShareBasis` |
| S-5 | No idea-wide filter; each ledger's gate. A share-basis action of an id ambiguous on another ledger of the idea waits on it (`sameIdElsewhere`; the class rule), a cash one does not | `close.js:252`, `ledger.js:1250` |
| S-6 | §11.5 | `corporateActionSequences.test.js` |

### 11.4 Readings, and questions for the founder

| # | Question | Built (and why) |
|---|---|---|
| FQ-5 | S-2's last paragraph says a payload "different from the ruled one" is a new ambiguity. Read literally, the conflict's other payload — still in the vendor's five-day window — would reopen every ruling at the next close, and again after each answer. | **A payload the ruling did not see.** The ruling stores what its records held (`seen`); only a payload outside it reopens. Pinned: Sticky "S-2, last paragraph …" (a seen payload reopens nothing; the battery's AR2-M23 is the literal reading) |
| FQ-6 | A ruled id revised later: what may the founder answer? | **The ruled outcome again** (closes the record; nothing moves). Any other answer would reverse money the ruling moved — an adjustment, T1a-2b-4's — and is refused 422 `ruling_needs_adjustment`. That includes choosing a payload after `none` (AR2-C-3), where nothing moved: allowing it would leave the id both declined and applied (I-1). Pinned: Sticky "AR2-C-3 …" |
| FQ-7 | A conflict on an action the holding was **not entitled to** (bought on its ex-date) | **Ambiguous and sticky**, as the letter of S-1 reads: it holds its share basis and the row's quality until ruled (RF-A1's release once the feed stopped listing it is withdrawn). Its payloads are what Astra's T2D-C01 re-date matched. More holds; a ruling clears it (`none`, or a payload the applier then declines as not entitled) |
| FQ-8 | **Tightenings**, shipped without asking: a cash possible re-date now keeps the row below full quality and counts at the endpoint (before: named only); two unsettled same-payload rows of one call both wait (before: the earlier applied); a new-date row matching an open conflict's payload waits (before: paid at once, T2D-06's "the same under both readings") | Built. Each makes the founder rule where the code used to decide |
| FQ-9 | A **rename** whose target is ambiguous keeps reserving its first target only (R-36's reservation follows `deferredRename.to`) | Built so; the founder names the target (AR2-A-4 made renames rulable). Reserving every recorded target is a one-line change if wanted |
| FQ-10 | A delisting **without a cash amount** has no economic payload; a later row with the cash is applied as before (E11), not read as a revision | Built so |
| FQ-11 | A vendor correction of an id the **feed** already settled (never ambiguous) is not detected — the ruling's "A ruling settles exactly the id it names" covers ruled ids only | Carried with T2D-05 to **T1a-2b-4** (unchanged) |

### 11.5 Tests

**Rows that pinned withdrawn behaviour, re-pinned** to "held until the founder rules, then applied once" (none deleted; titles say so):
- `close.test.js`: "two rows with ONE id …" (a corrected feed alone settles nothing; the receipt has `kinds`); "a conflict on an action the holding is NOT entitled to …" (stays open until ruled — RF-A1 withdrawn).
- `exits.test.js`: "a symbol with an UNSETTLED conflicting corporate action reads no line …" (ruled, then paid).
- `corporateActions.test.js`: the T2A-01 rename loop (six), "a same-stock idea and its comparison stay TIED …", "…against another idea's RENAME (refuter F1)", the share-basis class loop (twelve) and its controls (three), "the feed rows DISAPPEAR …", "a held action whose OWN id …", "a CASH DIVIDEND dated after …", "a LATER share-basis action …", "a cash action of the SAME date …", "with the share basis unresolved, the rename waits …", Astra's T2A-D02 case — each with the founder's ruling before the settling close; "the same-session CONTROL" (both rows wait); "the record FOLLOWS a corrected row" and "a record does NOT stand in for a row R-36 screened out" (a corrected target is a revision now — refuters F2 and S1's following is replaced).
- `corporateActionFinish.test.js`: "RF-A2: …" and "RF-A2 (pure): one row settles ONE conflict" (both **withdrawn**: a possible re-date, all wait); "C2: …" (the original is a possible re-date at once; the split ruled); "D2 / D3 / D4" (a cash re-date counts at the endpoint).
- `corporateActionFixRound.test.js`: T2D-06's two rows, AR1-RF-01's two cash rows, AR1-RF-03 (both paths), the held-row row (both paths).

**New rows.** Sticky: 41 — Astra's five findings (twelve), rev 1's own rules (seven), the AR2 review's probes (thirteen), the final refuter's (five) and the battery's (five). Seq: 65 — 48 seeds, fifteen named fixed cases (T2D-01, -06, -07, -08, -10, AR1-RF-02, -03 ×2, C01 ×2, C02, C03 ×2, C04 ×2), the class count and the reached-paths row.

**Every new row against round 1's code** (a `git archive` of d2370f51 with the two new files and the fixture): **92 of 96 fail.** The four that pass are controls (C01's control, the C04 arm round 1 already got right, S-3, the class count). Seq at round 1 fails mostly on a rev-1 export it imports; with a shim for it (round 1's own conflict and re-date predicates), **25 of 65 fail** there: the fixed cases, and fourteen seeds on I-2 (applied, declined or replayable without a ruling; quality) and two on I-5 — round 1 changed money when a close was re-run.

**S-6** (`corporateActionSequences.test.js`). A seeded generator (48 seeds) writes histories over 6–9 sessions: purchases on ex-dates, conflicts, revisions, re-dates, coverage failures, catch-ups whose stored backfill agrees or disagrees, split-shaped moves, founder rulings, and C01's and C04's chains. Each runs through the real close, catch-up and founder action. After every close: **I-1**; **I-2** — against the product's records and, separately, the generator's own record of every id the feed made ambiguous (an applied receipt on or after that session must carry a ruling), and an open ambiguity ⇒ below full quality; **I-3** — `assertReconciled` and the same-stock tie; **I-5** — the book's cursor put back one session and the close re-run on the state it left: money, shares and settled ids unchanged, and the re-run shown to have happened (the idea's revision moved). At the end of a clean history (complete coverage, no ambiguity — 18 of 48 seeds): **I-4** — the engine's own `applyCorporateAction` over the same rows in date order with entitlement, never the ledger's `applyActions`. The class counts are asserted on the plans, and a last row asserts what the seeds actually **reached** in the product (a payload kept later, a re-date of an ambiguous record, an uncovered transition, a revision after a ruling) — lens C showed the first version reached three of the classes only through the fixed cases.

**The checks.**

| Check | Where, and the command | Exit | Log lines |
|---|---|---|---|
| Full suite (Linux) | WSL worktree of `~/pd-ci` at b040987d **merged with `origin/main` bd841257** (tree b3296258; no file overlaps): `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **0** | `Test Files  1579 passed | 13 skipped (1592)` · `Tests  36094 passed | 179 skipped (36273)`. (At e35434e0 the same: 36,089 passed. The six skips more than this round's first run are all in `SharedResearch/thesisBuilder.browser.test.js` (38 → 44), an environment-gated browser file this round does not touch) |
| Lint gate | the same merged tree: `npm run lint:gate` | **0** | no error, no warning |
| Build | the same merged tree: `npx vite build` | **0** | `✓ built in 16.03s` (the build's own CSS-minify warnings) |
| Rules suite | the same merged tree: `npm run test:rules` (Firestore emulator, Linux) | **0** | `Test Files  46 passed (46)` · `Tests  839 passed (839)` |
| Seventeen-scenario differential | Astra's harness (`astra-differential.test.js`), base `git archive` of `origin/main` 2e069d42 (Astra's pinned base) against b040987d (and, before the battery's rows, e35434e0: the same) | **0** | 17 scenarios × `off` and `on`: **34/34 identical**; 4,000 default build sets identical; the quarterly prompts byte-identical in 4 cases, the positive control detecting a leak |
| 40-case traced differential | Astra's harness (`astra-cron-trace.test.js`), the same run | **0** | **40/40 identical** |
| Backfill isolation (rule 5) | Astra's `plant.test.js`, the same trees | **0** | 4/4: a planted backfill leaves the quarterly AAPL holding at 100 shares and $90,000 in both modes; the vendor's split gives 200 (control) |
| The idea book (Windows, targeted) | `vitest run api/_utils/practiceField api/practice-field api/cron/practiceFieldIsolation.test.js api/cron/practiceFieldNoBook.trace.test.js api/_utils/compositionProtectedStores.scan.test.js` | **0** | the battery's row set; its Linux baseline at b040987d: **914 rows, 0 failing** |
| End-to-end pin | `endToEnd.test.js` (in the suite) | **0** | the dump's SHA-256 is still `abcf8420…c24ed9` (443,533 bytes): with complete data no money leaf changed this round |
| Mutation battery | the build's `run-battery.mjs`, in a private WSL worktree at b040987d, one pass | **0** | **Defined 149, ran 149, broken 0, killed 146, survived 3** (all three equivalent, below) |

No vendor, model or Firestore call was made: every store is the in-memory fake or the local emulator, the vendor key is stubbed empty and `fetch` refuses in every new row.

**The mutation battery.** Round 1's 115 definitions: **eleven retired** — their code is gone with what rev 1 withdrew (RF-A2's settle under a moved date: F7-02, R-RF1, R-RF2, AR1-M03, AR1-M25; T2D-06's `ambiguousConflicts` and `matchingRowOf`: AR1-M04, AR1-M06, AR1-M23, AR1-M30; the live settled set that policed RF-A2: AR1-M05, round 1's one survivor; the idea-wide backfill filter: AR1-M28, restored as a mutant by AR2-M16). **Six re-cut** with the same intent where the code moved (F1-02, F1-06, F7-01, R-D2, AR1-M01, AR1-M24), and F7-04 after the review's fixes. **Forty-five new**, AR2-M01 to AR2-M49: one or more per rule of rev 1, per review fix and per refuter fix.
- The first full pass at e35434e0 killed 141 of 148. Five survivors had no row in a reachable order: a not-entitled conflict re-listed with one payload (AR2-M05); a not-entitled row repeating a held one (AR2-M06, AR2-M07); an ambiguous split that would explain a suspicion (AR2-M13); a revised ruled split as the holding's only doubt at a sale (AR2-M31). Each now has a row.
- Tracing AR2-M34's race found a gap, fixed in b040987d with its row and mutant (AR2-M49): a founder's coverage-gap row held behind another doubt was silently replaced by a later, different feed payload of its id. It now counts for a revision.
- The final pass at b040987d: **146 of 149 killed.** The three survivors are equivalent on this code:
  - **AR2-M07** (a held row a re-date may repeat is not paired by `recordRedatePair`): the held row is always a candidate of the same call. The pre-pass pairs the two before anything applies, and on the not-entitled path the held row's own candidate check, later in the same call, matches the re-date record just written. The explicit pair is kept so the order of the vendor's rows cannot matter.
  - **AR2-M11** (the hold set's dry run without `dryHolds`): every item that dry run could add is one the real applier already holds behind an earlier one. That is a coverage item, which holds every count-dependent action of the symbol, or another ledger's ambiguity, which holds everything dated after it. The screen's dry run, where the holds do decide (AR2-M10, AR2-M17), is killed.
  - **AR2-M34** (any founder ruling kind passes the gate): a non-`conflict` founder action under an id that is ambiguous is refused up front (AR2-M32, AR2-M33). One whose id becomes ambiguous in the same call is part of the conflict, which is skipped before the gate. One held across closes is dropped once its id is ambiguous (AR2-M09, AR2-M49).

### 11.6 The review

The round is over the review threshold, so it was reviewed adversarially (BUILD_RULES §2): three lenses on 4e253c61, each on its own `git archive` tree, read-only on git, instructed to break the round with reproductions; then one refuter on the fixes, on its own tree at 778ab641. Ids are AR2-A/B/C-n and AR2-RF-n (AR1 is round 1's). Every finding below was reproduced by the reviewer with a probe, and every probe is now a committed row asserting the corrected outcome.

| Id | What broke | Severity | Done |
|---|---|---|---|
| AR2-A-1 / B-1 / C-2 | A founder `split` or a coverage-gap `row` under an ambiguous id settled it with a payload its record never saw (149.96 at full quality; a split 2:1 over a 3:2/5:4 conflict; a re-date paid twice), and the conflict ruling then answered 409 | money at full quality | **Fixed**: both refused 409 up front; at the close only a `conflict` ruling passes the gate |
| AR2-C-1 / A-5 | A payload listed while a ruling waited (its rows replaced on the ledger) was never seen; the ruled payload was paid at full quality with no alert | money at full quality (flag) | **Fixed**: replaced rows observed; `seen`; the check after application |
| AR2-A-2 | A waiting rename was applied from its record over an open conflict on its id (valued at the wrong ticker, full quality) | money at full quality | **Fixed**: gated |
| AR2-A-3 | A waiting rename re-listed with another target followed it at full quality | money at full quality | **Fixed**: a revision |
| AR2-A-4 | A ruling could not name a delisting's cash or a rename's target (payloads compared on ratio and amount); a cash choice of 999 was accepted, stored without cash, applied a cashless delisting and locked the record | ruling locked | **Fixed**: every economic field |
| AR2-B-2 | (Planted asymmetric receipts.) The comparison's dry run applied a split the idea's doubt held on it, and retired two halvings with one 2:1 | records diverge | **Fixed**: `dryHolds` |
| AR2-B-3 | (Planted.) A same-stock comparison applied a split the idea disputed; reconciliation refused every later close of the book | book stops closing | **Fixed**: `sameIdElsewhere` |
| AR2-C-3 | After `none`, a revised payload cannot be chosen | a reading | **FQ-6**; pinned |
| AR2-C (tests) | Three of the round's mutants were killed only by the fixed cases; I-2 read the product's own predicate | test integrity | **Fixed**: the chains, the oracle, the reached-paths row |
| AR2-RF-1 | (Also at round 1.) A founder coverage-gap row and a different daily row under one id never met as a conflict; the daily payload was paid at full quality | money at full quality | **Fixed** |
| AR2-RF-2 | A rename ruling into a ticker another idea holds never applied and locked the record | ruling locked | **Fixed**: refused at the close |
| AR2-RF-3 | A lower-case rename target reopened the ruling that chose it | false alarm | **Fixed** |
| AR2-RF-4 | A rename ruling on a holding a cash delisting closed was marked applied by an empty `every()` | ruling consumed silently | **Fixed**: `moot`, alerted |
| Battery trace | A founder coverage-gap row held behind another doubt was replaced by a later, different feed payload of its id (found tracing AR2-M34) | money at full quality once the doubt cleared | **Fixed** (b040987d): a held founder row of another kind counts for a revision |

What the reviewers found to HOLD, with probes: complete-data money is identical to round 1's on seven clean histories (dividends a day late, splits with the price following, a purchase on an ex-date, two dividends a week apart, a split and a dividend on one date, a late dividend then a split, a late split then a dividend); a split conflict ruled on a same-stock idea applies on both ledgers and the book at once; a ruling held behind two uncovered closes applies at recovery and reports the one new payload once; a delisting ruled at $12 behind a split conflict pays on the post-split count; a coverage `no_action` leaves an open conflict open; lower-case tickers form conflicts and re-dates; three mutual re-dates each wait and one ruling pays once; no id is ever both applied and declined.

**Not probed, read only:** admission marks and `suspectedActionSymbols` read the stored holding's own records first, with no dry run. **No refuter has seen the final refuter's four fixes** (e35434e0) **or the battery's fix** (b040987d); they are pinned by their rows and by the battery (AR2-M45 to AR2-M49, all killed).

### 11.7 Where this leaves the verdicts

- **The dark merge.** Astra's five findings are fixed by the founder's mechanism, not by one more patch per order; each has a row that fails at round 1's head, the sequence test checks the invariants after every close of 48 generated and 15 fixed histories, and the review's sixteen findings, and the one the battery's trace found, are fixed and pinned; the battery kills 146 of 149 (three equivalent). With complete data, money is unchanged (the end-to-end pin is byte-identical); the quarterly product is unchanged (34/34, 40/40, a planted backfill reaches no quarterly reader). That is for Astra's confirmation to judge.
- **The founder allowlist stays NOT READY**: T2D-03, T2D-04, T2D-05 and T2D-12 are T1a-2b-4's, before the switch; FQ-5 to FQ-11 are open.
