# Build T1a-2b-4 — late and corrected data, and parse coverage (dark)

| | |
|---|---|
| Built by | Claude Code, Nov 19–20, 2026 |
| Prompt | "Build T1a-2b-4: late and corrected data, and parse coverage (dark)", 19 Nov 2026 — Astra's four pre-switch items from `docs/audits/20261118_ASTRA_REVIEW_T1A2B3.md`: T2D-03, T2D-04, T2D-05, T2D-12 |
| Base | `origin/main` @ 41c04cd2 (unchanged at the end of the build: nothing to merge) |
| Head | Code 747a92e4; tests ec941a1c; the report's own commit on top is the PR's head. The suite, lint, build and rules ran at ec941a1c (§4); the soak at 747a92e4 (§6); the battery, the differentials and the end-to-end comparison at f6fea858, whose code is identical (§5.4, §7) |
| Branch | `claude/practice-field-t1a2b4-corrections` |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No flag value or pin changed; no rules or index file changed; no fenced file (BUILD_RULES §1) edited; `mandateUniverseSnapshot.js` and `mandateCorporateActions.js` byte-identical to base. No model call, Firestore write or EODHD call from this session (one disclosed probe attempt, §5.1) |

Contents:
1. In plain terms
2. Changes by `file:line`
3. Readings and questions for the founder
4. Tests
5. The review and the mutation table
6. The soak
7. The end-to-end comparison and the differentials
8. New stores and fields
9. The register
10. Ready for the switch

## 1. In plain terms

**What this build is.** The last four corporate-action items Astra asked for before the Practice Field is switched on. All of it is dark: `PRACTICE_FIELD_MODE` stays `'off'`, so none of it runs in production yet.

**What it changes.**
- **A dividend listed after the idea sold the stock (T2D-03).** If the dividend is dated while the idea still held the stock, the idea is now paid it, once, on the share count it held on the ex-date. This works whether or not the comparison holds the same stock, and after the idea has its result. If the vendor's row is in any doubt — listed two ways, possibly a moved date, or the day's data incomplete — nothing is paid until the doubt clears or the founder rules.
- **A split listed late, dated before a dividend already paid (T2D-04).** The dividend is recomputed on the corrected count. The difference is posted once, as a separate linked record, on every ledger it touches and on the book. Both arrival orders end with the same money.
- **A vendor correction of an id already settled (T2D-05).** The founder can now choose the corrected payload with `resolve_hold`. One linked `ruled_correction` record moves the money: a dividend's difference, or a split's count corrected and its dividends recomputed. Keeping the original moves nothing. A ruling covers exactly the payloads it saw (FQ-5).
- **Parse coverage (T2D-12).** The daily build now writes, beside its shared document, a per-symbol parse report for the symbols an idea book needs (`practiceFieldCaParseReports/{session}`). A row the parser rejects, a malformed answer or a missing report is a day of doubt for that stock. The wrapper that writes the report returns exactly what the vendor fetch returns and makes no second call.

**How money moves now.** Nothing is ever rewritten. Each correction is one new record (`mandates/{book}/ideas/{idea}/evidence/adjustment_{id}`): written once, content-hashed, readable by the idea's owner. It names what was corrected, why, the share count used and how that count was derived, the signed amount and the session it posted. An open idea takes it in its own cash. An idea with a result keeps the result; the money goes to the book's treasury, and the idea shows the adjustment beside its result with whether it would change the label. A debit larger than the cash it would come from is held and alerted, never posted.

**What the review found.**
- Three review lenses reported 23 distinct findings: 6 on adjustments, 8 on the parse report and 9 on corrections. Two were reported by two lenses.
- Seven refuters checked every one. 18 were confirmed, one of them only as plausible. One was refuted as unreachable (no feed produces renames or delistings), and four parse-report items were refuted as defects. The refuters found one more.
- Every confirmed finding is fixed, each with a row that failed before its fix, except two founder questions: a correction under a renamed ticker (as on `main`) and a correction after a sale (flagged and recorded).
- One refuter then checked the whole fix round. Every fix held on the reviewers' cases, and complete, on-time data still moved money exactly as `main`. It found three new defects the fixes had introduced; all are fixed.
- The soak found one more class (a re-run paying what the first run held, 4 of 6,000 histories), also fixed (§5.3).

**Proof.**
- The new invariant I-6 checks every ledger's received cash against what the inputs and its holding history say it was owed. It fails on `main` for T2D-03 and T2D-04 (§4).
- The final soak ran 12,400 histories at the final code (6,000 late-data, 6,000 ordered, Astra's 400), plus every fixed case, with no failure (§6).
- The mutation battery has 61 mutants, at least one per fix and the six the prompt names: 60 are killed and 1 is equivalent, shown with a pair check (§5.4).
- With complete, on-time data, money moves exactly as before: the end-to-end dump is byte-identical to `main`'s, and both differentials are identical (§7).

**What the founder is asked.** Ten questions (§3.2), including sign-off for the new collection, and whether `resolve_hold` should reach ideas that already have a result.

## 2. Changes by `file:line`

Line numbers are at the final code head 747a92e4 (f6fea858 and ec941a1c add test lines only). 34 files changed against base 41c04cd2, +4,934 −160 (the report itself excluded). No fenced file (BUILD_RULES §1) was edited.

**Fenced functions called, not edited:**
- `mandateCorporateActions.js`: `parseSplitsPayload` and `parseDividendsPayload` (the parse report runs them on the body the base fetch already received), `applyCorporateAction` and `deriveActionId` (as before).
- `mandateUniverseSnapshot.js`: `fetchCorporateActionsEODHD`, through its existing `fetchImpl` seam (the wrapper observes the HTTP answer; it makes no call of its own). Both modules are byte-identical to base.

### New modules

| `file:line` | What |
|---|---|
| `api/_utils/practiceField/adjustments.js:54` `ADJUSTMENT_KIND` · `:57` `ADJUSTMENT_POSTED_TO` · `:58` `ADJUSTMENT_EXCEEDS_CASH` · `:71` `adjustmentIdOf` · `:60` `adjustmentDocIdOf` | The adjustment record: three kinds, three destinations, the deterministic id (idea, ledger, action, kind, correction) |
| `adjustments.js:91` `shareBasisChain` · `:105` `countOnExDate` · `:128` `closedHoldingsOf` · `:145` `leftByActionOf` | The holding history, derived: the corrected share-basis chain (ledger.js `shareBasisChainOf`), C-16's ex-date count over it, the closed holdings (sale receipts; a resulted idea's paper holdings), a holding left by a rename or a cash delisting (latent: no feed produces those rows today, RF3) |
| `adjustments.js:222` `planLedgerAdjustments` | One ledger at one close. `:268` `shareDoubtOn` (AR4-A-1; in the held path's order, RFX-2). Step 1 (`:277`) the closed holdings: `:309` revisions first (AR4-C-3), the revision, settled-id, open-record, conflict and re-date screens, `:414` a row waiting on a doubt (`closedHeldRows`), the history-only receipt, the late entitlement. Step 2 (`:455`) the recompute: late_basis (`:479` the key names its events, AR4-A-5) and ruled_correction |
| `adjustments.js:511` `correctShareBasisOn` · `:550` `resultAdjustmentView` | The founder's split correction on one ledger; the view beside a result (`wouldChangeLabel`) |
| `api/_utils/practiceField/caParseReport.js:59` `isNoOpSplit` · `:75` `legReportOf` · `:99` `parseReportEntryOf` · `:121` `sessionOfWindow` · `:131` `observingFetch` | T2D-12: the per-leg verdict from the parser's own outcome on the same body; the entry names the rows its build returned (`actionsHash`, AR4-B-1) |
| `caParseReport.js:161` `makeParseReportingFetcher` · `:222` `fetchObservingParse` · `:46` `PARSE_REPORT_WRITE_TIMEOUT_MS` | The wrapper: required symbols only; one coalesced merge at a time, given up after 10 s (AR4-B-6); returns exactly the base's answer |

### Changed modules

| `file:line` | What |
|---|---|
| `dailyCoverage.js:64` `parseEntryVerdict` · `:88` `actionsHashOf` · `:98` `rejectedRowDatesOf` · `:112` `parseReportEntry` · `:150`–`:152` (in `dailyCoverageOf`) · `:233` `successfulBackfill` | F-6 gains the parse report: missing, rejected, malformed or describing other rows ⇒ uncovered; a backfill counts only with a clean report |
| `close.js:252`–`:258` (in `closeFilledIdea`) | AR4-B-3: a rejected row's date lowers the covered-through date — only a row dated after the entry (RFX-1) |
| `close.js:386` | A ruled id leaves the hold set (the final soak's I-5) |
| `close.js:416`–`:418` | The plan per ledger after the actions; `ruledHere` (AR4-A-4 / C-10) |
| `close.js:467` · `:1052` | A split correction moves the line and the book only where the ledger still holds the stock (`held`) |
| `close.js:518` · `:553` | A waiting closed row, and a correction not yet posted, keep the row below full quality, alerted (AR4-A-2, RF6-X1) |
| `close.js:738` `recentlyResultedIdeas` · `:746` `resultedIdeaSymbols` · `:762` `closeResultedIdea` · `:774` `countDoubt` · `:783` pending corrections · `:821` · `:842` `lastLookbackSessionOf` | T2D-03/04 after the result; AR4-A-6 (per-action doubt), AR4-C-8 (corrections), AR4-A-2 (`lateDataUnsettled`, compared key-order free: RFX-3) |
| `close.js:898` · `:961` · `:1290` | The fenced query (AR4-B-4); the parse report read in the transaction; the evidence document, created once (`tx.get` then `tx.create`) |
| `holdRulings.js:132` `settledOutcomeOn` (history-only included, AR4-A-3) · `:151` `movedOn` · `:157` `rulingReceiptOf` · `:164` `pendingAmountCorrections` · `:176` `markCorrectionsApplied` | T2D-05's outcome in force; AR4-C-7; AR4-C-8 |
| `holdRulings.js:269`–`:280` (in `planHoldRuling`) · `:416`–`:448` (in `applyFounderRulings`) · `:522` (in `markRulingsApplied`) | The correction: a recorded payload, on ledgers that settled it with a payload; closes only revisions it saw (RF6-X1); flags a correction after a sale (AR4-C-11); applied once posted everywhere |
| `ledger.js:650` `founderSettledIds` (exported; FQ-11: a feed-settled id) · `:699` `ratioCorrectionsOf` · `:718` `shareBasisChainOf` · `:958` `residualMoveOf` · `:1227` · `:1566` | The feed revision (`settledBy: 'feed'`); one corrected chain read by the late-dividend path (AR4-C-1) and the suspicion residual (AR4-C-5) — gated on a correction existing |
| `settlement.js:196` `ledgerEndpoint` (`:213`, `:216`) · `:376`–`:378` | The endpoint's unsettled actions include waiting closed rows (AR4-A-2) and pending corrections (RFX's note on AR4-C-8) |
| `reconcile.js:89` | Receipted income includes posted adjustments |
| `caBackfill.js:118`–`:149` | The backfill keeps its own parse report; a dirty one is failed; a prior success is never overwritten (AR4-B-5) |
| `exits.js:400` · `admissionMarks.js:80` · `:262` | The sale and admission read the parse report |
| `sweep.js:103` `retainedSymbolsOf` · `:157` · `:165` | Retention and the wrapper, only with an idea book in the fire and the flag on |
| `evidence.js:74` `sealAdjustment` · `api/cron/mandate-evaluate.js:141` | The adjustment packet; the fire passes its idea book ids |
| `compositionProtectedStoresScan.js:327` · `compositionProtectedStoresAllowlist.json` (`_notes_practice_field_t1a2b4`) | The new collection in the scan; its write site listed |

### Tests

| File | Rows | What |
|---|---|---|
| `corporateActionCorrections.test.js` (new) | 41 | T2D-03/04/05/12 through the real close, sales, founder action and daily builder; the battery's rows; lens (b)'s rows |
| `corporateActionCorrections.lensA.test.js` (new) | 20 | Lens (a)'s reproductions, kept as rows |
| `corporateActionCorrections.lensC.test.js` (new) | 40 | Lens (c)'s reproductions and the refuters' (RF4, RF5, RF6), and RFX's note on AR4-C-8 |
| `corporateActionCorrections.fixRound.test.js` (new) | 14 | The fix-round refuter's reproductions (RFX-1, RFX-2, RFX-3) |
| `corporateActionSequences.late.test.js` (new) | 60 | S-6 extended: 8 fixed cases, 12 soak seeds, 40 generated seeds; I-1 to I-6 after every close |
| `caOracle.test.js` | 15 | I-6 rows added |
| `__testsupport__/caSequences.js` · `caOracle.js` · `fixtures.js` | — | The late generator, `FIXED_LATE`, `LATE_SOAK_SEEDS`; the EntitlementOracle (I-6); the clean parse report the fixtures write |
| `corporateActionFinish.test.js`, `corporateActionFixRound.test.js`, `corporateActionStickyAmbiguity.test.js`, `endToEnd.test.js`, `admissionMarks.test.js`, `close.test.js`, `evidence.test.js`, `exits.test.js` | — | Updated for the parse report (the vendor answering through the wrapper, a clean report beside planted rows); FQ-6's row re-pinned to `none` → 422 |
| `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs` | — | The adjustment evidence is owner-readable; parse reports and backfills are denied to clients |

## 3. Readings and questions for the founder

### 3.1 Readings

1. **The holding history is derived, not stored.** A ledger's history of a symbol comes from what it already keeps: the holding while held, the entry session and the sale receipt once sold, and the share-basis receipts. Three things are new: a history-only share-basis receipt (a split listed after the sale, dated while held: it moves no shares but enters a later dividend's count); `closedHeldRows` (a sold holding's row that waits on a doubt); and, on a resulted idea, `lateDataUnsettled`.
2. **"An idea that already has its result"** means `result` is set: resulted, or settled and waiting for its settlement sale. It keeps its result. Adjustments posted after its endpoint for actions dated on or before it are shown beside the result (`resultAdjustments`, with `wouldChangeLabel`). The idea's own ledger posts to its own cash while the idea is open, and to the book's treasury once it has resulted. Its paper ledgers record theirs beside the result (`paper_after_result`): nothing moves on paper after a result.
3. **Automatic only for an unambiguous id.** A late row that is listed two ways, may be a moved date, or revises a settled payload is recorded and alerted, and waits for the founder. This includes a share-basis ambiguity recorded in the same close as the dividend it touches (AR4-A-1).
4. **Retention.** For an idea that resulted within the look-back (`MANDATE_CA_FETCH_LOOKBACK_DAYS` + 1 calendar days), the daily build keeps covering its symbols. This happens only with the flag on and an idea book in the fire.
   - With an idea book in the fire, the shared daily document can therefore list more symbols than the wrapper alone would. This is the same kind of widening `main`'s T1a-1 coverage already makes for held names.
   - At `'off'`, and at `'on'` with no idea book, nothing changes (RF7 on AR4-B-2; the isolation and retention rows).
5. **The parse report.**
   - It is written only for the symbols an idea book's coverage asks for, in its own collection, and never into the shared document.
   - An entry counts only beside a daily entry listing exactly the rows its build returned (AR4-B-1: two builds of one session can race, and the first document wins).
   - A rejected row is dated, and only a row dated after the idea's entry counts (RFX-1). Its doubt reaches back to the day before its date and lasts until a backfill covers that date with a clean report of its own, or the founder rules the coverage gap (AR4-B-3). While the vendor still lists the bad row, the backfill re-fetches it and fails, so the founder's ruling is the exit (RFX).
   - Every failure fails closed: a write that never answers, a writer blocked behind it, two top-ups merging different rows. The symbol reads uncovered for that session.
6. **The end-to-end comparison strips the parse-report documents**, after checking each one is exactly the clean entry for its daily entry's rows (check-then-strip). Every other document is compared byte for byte.
7. **Corrections are payload to payload only.**
   - These are refused: `none` after a payload or a payload after `none` (FQ-6), and a correction of a dividend the founder ruled not entitled (AR4-C-7, as on `main`).
   - A ruling covers exactly the payloads it saw. A payload listed later is a new ambiguity, even while the ruling is still pending (FQ-5, RF6-X1).
8. **A resulted idea takes no rulings in this build** (`resolve_hold` answers 404 for an idea that is not open).
   - What still waits on it is named on the idea (`lateDataUnsettled: { actions, readUntil }`): a row waiting on a doubt, an open ambiguity, or a correction not yet posted.
   - It is alerted at every close (`PRACTICE_FIELD_LATE_DATA_UNSETTLED`), and at the last close that reads the idea (`…LEFT_UNSETTLED`). The money stays where the result put it. See Q-2.
9. **A sale is never re-traded.** A split correction after the line sold the stock leaves the sale as executed. The record says what the corrected count would have sold (`soldBeforeCorrection`), and the close alerts `PRACTICE_FIELD_CORRECTION_AFTER_SALE`. The comparison's count is corrected, so the gap moves (RF4: about $1.7k–1.9k in its case). See Q-5.
10. **The vendor's `value` restatement.** A dividend row with no `unadjustedValue` falls back to the adjusted `value`, which later splits restate. If it is re-listed after a split, it is a different payload under a settled id: it is recorded as a revision and held for the founder. This can over-hold; it never pays wrongly.
11. **Renames and cash delistings have no feed** at this build (RF3). The count for a holding that left that way (`leftByActionOf`) is hardening for when one exists.
12. **A sale across an unlisted split** is outside this build: the sale's proceeds are never adjusted (as `main`).

### 3.2 Questions for the founder

- **Q-1. The new collection.**
  - Sign-off for `practiceFieldCaParseReports/{session}`: server-only, denied to clients by the existing rules, and in the protected-store scan.
  - Parse reports outlive the daily documents' 120-day cleanup, and nothing reads them after that (RF7). Should they join the cleanup?
- **Q-2. Rulings on resulted ideas.** An ambiguous late row, or a correction a doubt kept pending, on a resulted idea can never be ruled: it is named, then left unsettled when the look-back ends. Should `resolve_hold` reach ideas that resulted within the look-back?
- **Q-3. Retention's reach** (AR4-B-2). With an idea book in the fire, the shared daily document lists the symbols of ideas resulted within the look-back. Accept this, as T1a-1's coverage already does for held names, or confine it?
- **Q-4. Held debits.** A `late_basis` debit larger than the cash it would come from is held, alerted at every close, and posted once the cash exists. Should the founder be able to waive or force it?
- **Q-5. A correction after a sale** (AR4-C-11). The sale stands on the uncorrected count while the comparison is corrected. Is there a remedy, or is the record and the alert enough?
- **Q-6. Revisions across a rename** (AR4-C-4, also on `main`). Should FQ-11's revision detection follow rename aliases, the way the re-date match does?
- **Q-7. A rejected dividend row with no amount** (AR4-B-3). Today the doubt holds until a backfill or a coverage-gap ruling. Keep that, or let it lift when the window passes?
- **Q-8. A split correction under a standing suspicion** (AR4-C-5) still needs a `price_move` ruling to release the suspicion, even when the correction explains the move exactly. Should the correction retire it?
- **Q-9. A direction correction under another id** (RFX-2). A vendor that lists 10-for-1 and then 1-for-10 for one date creates two ids (`split_…`, `reverse_split_…`), and both are applied in order. That is true on the held path, on the closed path, and on `main`. Should two share-basis rows of one date be one ambiguity for the founder?
- **Q-10. Unmeasurable for good** (A-2, RFX's note). A late row still waiting, or a correction still pending, at the endpoint makes the result `unmeasurable`, and it stays so after the money posts (shown beside the result with `wouldChangeLabel`). Keep this, as T1a-2b-3 does for any open ambiguity at the endpoint, or re-label once everything is posted?

## 4. Tests

**The full checks, at ec941a1c (the pushed code and tests; the report's commit adds only this file).** Linux, in WSL: a worktree of `~/pd-ci` at ec941a1c, `TZ=UTC`, Node v20.20.2, the lockfile's node_modules (`e457c10d0317`).

| Check | Command | Exit | Log line |
|---|---|---|---|
| Suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **0** | `Test Files  1588 passed \| 13 skipped (1601)` · `Tests  36501 passed \| 179 skipped (36680)` · `Duration  303.19s` |
| Lint | `npm run lint:gate` | **0** | `eslint . --config eslint.gate.config.js --max-warnings 0` (no output) |
| Build | `npx vite build` | **0** | `✓ built in 15.86s` (its warnings are `main`'s own) |
| Rules | `npm run test:rules` (emulator, JDK 21) | **0** | `Test Files  46 passed (46)` · `Tests  841 passed (841)` |

The same four ran at f6fea858 first, all exit 0 (suite `Tests  36500 passed | 179 skipped`, rules 841/841).

**The build's own rows** (Windows, at ec941a1c). These are the idea book's rows: `api/_utils/practiceField`, `api/practice-field`, the two cron Practice Field files, and the protected-store scan. 35 files, **1,246 / 1,246** pass (the battery's baseline).

On Windows, `mandateMoneyRounding.scan` and `mandateRationale.imports` fail the same 4 rows at c08944d6 and at the head (a Windows path behaviour). They pass in the Linux suite above.

| Section | Rows |
|---|---|
| T2D-03 | corrections "T2D-03" (7) and its battery rows (3); `astra-T2D-03`, `astra-T2D-03-sector-fund` |
| T2D-04 | corrections "T2D-04" (5); `astra-T2D-04`, `astra-T2D-04-reverse`, `review-AR4-C-1` |
| T2D-05 | corrections "T2D-05" (5); `astra-T2D-05`; lens (c)'s rows |
| T2D-12 | corrections "T2D-12" (5), the battery's T2D-12 rows (3), lens (b)'s rows (8); `astra-T2D-12`; the rules test |
| The adjustment record | corrections "the adjustment record" (3): held debit, doubt, result view; evidence verified (`verifyPacket`) in every T2D-03/04 row |
| Isolation and retention | QUARTERLY ISOLATION; RETENTION; the cron trace (§7) |
| I-6 | `caOracle.test.js` I-6 rows; every sequence file (§6) |

**Astra's positive controls.** Every one is a row in the suite, and every one passes at ec941a1c (suite exit 0).

| Control | `file › row` |
|---|---|
| Z1 | `corporateActionFinish.test.js` › "Z1 — a ruling covers only the recorded move …" |
| Y4 | `corporateActionFinish.test.js` › "Y4 — a listed split applied AFTER the ruling does not re-suspect the ruled move …" |
| N3 | `corporateActionFinish.test.js` › "N3 — after a ruled halving a LATER 2-for-1 is judged against the fresh mark …" (and lens A's N3, "the vendor is never reached from a row") |
| D01, D02 | `corporateActionSequences.test.js` › "S-6 — Astra round 2: T2D-D01 and T2D-D02, her replay seeds verbatim …"; `corporateActionSequences.ordered.test.js` › "the ordered generator: C03, D01 and D02 on one id" and her seeds 19112000–19112031 |
| C01–C05 | `corporateActionStickyAmbiguity.test.js` › "T2D-C01 …", "T2D-C02 …", "T2D-C03 …", "T2D-C04 …", "T2D-C05 …" |
| SOAK-R3 | `corporateActionSequences.test.js` (SOAK-R3-1, SOAK-R3-2 as fixed cases); `corporateActionSequences.ordered.test.js` › "the final soak's failing histories, as fixed seeds" (1911201905, 1911200342, 1911205903, 1911202882) |
| AR3-RF | `__testsupport__/caSequences.js` AR3-RF-2 fixed cases (run by `corporateActionSequences.test.js`); AR3-RF-3/4 seeds 73100109, 73100236 (`ordered`); `corporateActionStickyAmbiguity.test.js` › "AR3-RF-5 …" (2 rows) |
| The six-session outage | `endToEnd.test.js` › "the end-to-end case with a coverage gap (Amendment F-1)": AAPL's fetch fails for six sessions, S[1]…S[6], then the backfill, the split applied once, the dividend on the adjusted count |
| The size alert | `corporateActionFinish.test.js` › "Amendment F-9 — the idea document's size": 786,432 bytes alerts, 786,431 does not, pure and through a close |

**I-6 fails on `main` for T2D-03 and T2D-04.** `main` (41c04cd2) was run with this build's test support laid over it (`corporateActionSequences.late.test.js`, fixed cases): 6 failed.
- `astra-T2D-03`: "I-6 ledger cash_dividend_AAPL_2026-11-17: received $0, the inputs and the holding history say $99.97". The sector-fund case gives the same.
- `astra-T2D-04`: "received $99.97 … say $124.96".
- `astra-T2D-04-reverse`: "received $99.97 … say $79.98".
- `astra-T2D-05`: "ruling 3: expected 404 to be 200".
- `astra-T2D-12`: "S[1] is uncovered".

**Each review fix fails without it.**
- (a), (c) and the refuters' rows: 33 of the 58 lens rows, and both `review-AR4` fixed cases, failed at c08944d6.
- The fix-round refuter's rows: 11 of 14 failed at de858e26.
- The four soak seeds failed at de858e26 (soak 3).
- Every fix also has a mutant (§5.4).

**Isolation.** At `'off'`, and at `'on'` with no idea book, every fire is byte-identical to `main`, including the daily documents (§7).

## 5. The review and the mutation table

### 5.1 How it ran

**The review (BUILD_RULES §2).** Three lenses reviewed the head 994ccc2e, each on its own snapshot tree, read-only:
- (a) adjustments and conservation;
- (b) the parse report and quarterly isolation;
- (c) `resolve_hold` with corrections.

The 23 distinct findings were grouped by root and handed to seven refuters, again on snapshot trees of 994ccc2e (RF1–RF6 for (a) and (c), RF7 for (b)). Each refuter was asked three things: is it real, is it reachable through real flows, and does `main` behave the same?

The fixes landed in two commits: c08944d6 for (b), and de858e26 for (a), (c) and RF6's new finding. Each reviewer's reproduction was kept as a row, and each such row failed at the commit before its fix. One refuter (RFX) then checked the whole fix round (§5.3).

**Disclosure.** One lens-(b) probe (`topup.test.js`, in its snapshot tree) made two GET attempts toward `eodhd.com` before `fetch` was stubbed. RF7 checked how, and confirmed:
- No real key could have been sent: the probe passed an explicit dummy key `'k'`, no `.env` is loaded by the config, and `EODHD_API_KEY` is unset in every scope (names checked only). The URLs carried the dummy key, a ticker and dates, and no user data.
- It cannot recur: the probe now stubs `fetch` before any call.
- No other network attempt was made by this session.

RF3 wrote one new probe file inside the scratchpad snapshot of `main` (`main-base`), outside its assigned trees. It edited nothing there.

### 5.2 Findings, verdicts and what was done

For lenses (a) and (c) and the refuters' cases, every row listed failed at c08944d6, the commit before their fixes: 33 of the 58 lens rows. The other 25 are the reviewers' controls and observations, which pass on both sides. Lens (b)'s rows came in the same commit as their fixes, so what shows each one bites is its mutant (§5.4: FB1–FB7).

| Id | Finding | Refuter verdict | Class (refuter) | What was done | Row(s) |
|---|---|---|---|---|---|
| AR4-A-1 | A share-basis ambiguity recorded on a closed holding did not hold a later-dated dividend of the same close | CONFIRMED (RF1); breadth (re-date) PLAUSIBLE on money | Open idea: posted in doubt. Resulted: money wrong, permanent | `shareDoubtOn` (adjustments.js:268), records made in the same call included | lensA "AR4-A-1"; FIXED_LATE `review-AR4-A-1` |
| AR4-A-2 | `closedHeldRows` had no reader: row and endpoint at full quality; abandoned silently after the look-back | CONFIRMED (RF3) | (a)/(b) record wrong; (c) money wrong at full quality (same money as `main`) | Row and endpoint below full quality, alerted; a resulted idea names what waits (`lateDataUnsettled`), alerted to the last look-back close | lensA "AR4-A-2" (2 rows) |
| AR4-A-3 = C-6 | A revision of a history-only split could never be answered (422 for every answer) | CONFIRMED (RF2); P3f asymmetry refuted as stated | Liveness lock | `settledOutcomeOn` counts a history-only receipt (holdRulings.js:132); a correction of one moves no line or book | lensA "AR4-A-3"; lensC P3 (2 rows) |
| AR4-A-4 = C-10 | A founder payload ruling on a closed holding's share-basis record went `moot` (its own record was the doubt) | CONFIRMED (RF1), for conflict, revision and re-date; same-stock: applied on the comparison only, gap $24.99 off at full quality | Lock + record wrong; money at full quality with a same-stock comparison | An id a pending ruling settles is not a doubt (close.js:416), and leaves the hold set (close.js:386, the final soak) | lensA "AR4-A-4"; lensC P3g |
| AR4-A-5 | A late_basis id could repeat when the count returned to an earlier value: a posting with no evidence document | CONFIRMED (RF6); contrived reach | Record wrong (money correct) | The key names the events behind the count (adjustments.js:479) | lensA "AR4-A-5" |
| AR4-A-6 | On a resulted idea any ambiguity of a symbol (a cash one too) held every adjustment for good | CONFIRMED (RF6) | Liveness lock, silent (treasury −$24.99) | The doubt is per action: a share-basis ambiguity dated on/before it, or a paper holding's suspicion or held action | lensA "AR4-A-6" |
| AR4-B-1 | The report raced the first-writer-wins daily publish | CONFIRMED (RF7); rare | Money wrong at full quality (narrow); not a regression | `actionsHash`: an entry counts only beside the rows its build returned | corrections "AR4-B-1" (2 rows) |
| AR4-B-2 | Retention changes the shared daily document | REFUTED as an isolation breach (RF7): gated on an idea book in the fire | Founder question | Reading 3.1-4, Q-3; the retention row also asserts nothing changes with no book or at `'off'` | corrections "RETENTION" |
| AR4-B-3 | A late rejected row dated on/before the covered-through date lost its doubt when the window passed | CONFIRMED (RF7) | Split: money wrong at full quality; null dividend: founder question | The row's date lowers the covered-through date (close.js:252; only a row dated after the entry: RFX-1) | corrections "AR4-B-3" (2 rows) |
| AR4-B-4 | The close's resulted-ideas query was not fenced | PLAUSIBLE (RF7) | Conditional liveness lock, low | Fenced, alerted; the next close asks again | corrections "AR4-B-4" |
| AR4-B-5 | A pre-build successful backfill was replaced by a failed refetch | CONFIRMED (RF7) | Record wrong, no money | A prior `failed: false` is never overwritten | corrections "AR4-B-5" |
| AR4-B-6 | The report write is awaited inside each required fetch | REFUTED as a defect (RF7) | — | Hardened anyway: one coalesced merge at a time, given up after 10 s (uncovered) | corrections "AR4-B-6" |
| AR4-B-7 | Verdict gaps; a dateless 1:1 read as a no-op | REFUTED (RF7): the writer cannot produce them | — | Hardened anyway: stricter verdict; a dateless 1:1 is a rejection | corrections "AR4-B-7" |
| AR4-B-8 | Info items | REFUTED (RF7) | — | Reports outlive the 120-day cleanup: Q-1 | — |
| AR4-C-1 | After a split correction, a late dividend paid by the C-16 path used the stale count | CONFIRMED (RF4); the other arrival order gave $149.96, not $124.96 | Money wrong at full quality | One corrected chain (`shareBasisChainOf`), read by the C-16 path when a correction exists (ledger.js:1566) | lensC P2, P2p, RF4 "ORDER A"; FIXED_LATE `review-AR4-C-1` (I-6 caught it) |
| AR4-C-2 | A dividend correction never posted after a rename or cash delisting of the holding | REFUTED (RF3): no feed produces those rows | Latent lock | Hardened: the count of a holding left by a rename or delisting (`leftByActionOf`) | lensC C1 (2 rows), C1c |
| AR4-C-3 | On a sold holding, a correction and its earlier-dated re-date listed in one close were paid automatically | CONFIRMED (RF5), within the 5-day window; partly new | Money wrong at full quality | Revisions first on the closed path (adjustments.js:309) | lensC P1, P1s; RF5 C3a, C3e |
| AR4-C-4 | A correction listed under a renamed ticker is paid fresh | CONFIRMED (RF5); NOT new (`main` the same) | Founder question | Q-6 | — |
| AR4-C-5 | A split correction left the suspicion's residual stale; a same-sitting ×1.6 corrupted the count to 319.904026 at full quality | CONFIRMED, upgraded (RF4) | Money wrong at full quality | The residual reads the ratio in force, and a correction since the raise by its difference (ledger.js:958) | lensC P5, P14r; RF4 same sitting |
| AR4-C-7 | A correction was accepted on a not-entitled ruling and could never post; the pending ruling closed later revisions | CONFIRMED (RF6), effects corrected | Record wrong (regression vs `main`'s 422) | Refused: the id must be settled with a payload on every named ledger (holdRulings.js:269) | lensC P4; RF6 "AR4-C-7" |
| AR4-C-8 | A dividend correction deferred at the result close was lost | CONFIRMED (RF3) | Record wrong + residual money gap | The resulted idea posts pending corrections and marks them applied | lensC P6e |
| AR4-C-9 | The closed path ignored a founder ruling's `seen` | CONFIRMED (RF5) | Record wrong | `founderSettledIds` keys join the closed path's seen set | lensC P21, P21x |
| AR4-C-11 | A split correction after a line sale is not flagged; the sale's count stays uncorrected | CONFIRMED with money (RF4) | Founder question + gap moved at full quality | Flagged (record + alert); Q-5 | RF4 "AR4-C-11" |
| RF6-X1 | A pending correction closed a later revision it never saw | CONFIRMED, new (RF6) | FQ-5 broken at full quality + lock | Only revisions whose payloads it saw are closed; a pending correction keeps the row below full quality | RF6 "RF6-X1" |

### 5.3 The fix-round refuter (RFX), and the soak's last finding

**RFX checked the fix round** on a snapshot of de858e26. It re-ran every lens and refuter probe there and on the original trees.
- **The hard rule holds.**
  - The end-to-end dump constant is identical at `main`, 994ccc2e and de858e26.
  - The whole folder passes (1,087/1,087).
  - Lens (b)'s cron differential, ported, passes 89/89: `'off'` and `'on'` with no idea book are byte-identical to `main` in all 80 scenario rows.
- **These fixes HOLD:** B-1, B-4, B-5, B-6, B-7, A-2, A-3/C-6, A-4/C-10, A-5, A-6, C-1/C-5, C-2, C-3, C-7, C-8, C-9, C-11 and RF6-X1.
- **Two are PARTIAL:** A-1, through RFX-2, and B-3, through RFX-1.
- **Probes that changed colour:** 33 went from red to green. Six went from green to red, as expected, because they pinned 994ccc2e's behaviour.

Its three new findings, each fixed in 747a92e4 and kept as a row (`corporateActionCorrections.fixRound.test.js`, 14 rows; 11 failed at de858e26, and the 3 that pass are its controls):

| Id | Finding | Verdict | Class | Fix |
|---|---|---|---|---|
| RFX-1 | The B-3 floor lowered the covered-through date for a rejected row dated **before the idea's entry**, which can never be owed. The backfill re-fetched the same bad row, so the doubt lasted until a founder ruling: the line exit was suspended and the book refused new ideas | CONFIRMED; new against `main` and 994ccc2e | Liveness, founder-only exit | Only a row dated after the entry session reaches back (close.js, in `closeFilledIdea`) |
| RFX-2 | A split and a reverse split of one date, both waiting on a closed holding, held each other for good. The founder could not reach `closedHeldRows` (404) | CONFIRMED; contrived | Liveness lock, no exit | A waiting share-basis row waits only on one that precedes it in the held path's order: date, phase, id (adjustments.js `shareDoubtOn`). The two now apply in that order, as the held path and `main` apply them. Whether a direction correction filed under another id (10/1 → 1/10) should be one ambiguity is Q-9, for both paths |
| RFX-3 | `lateDataUnsettled` was compared with `JSON.stringify` against the idea as read. Firestore does not keep a map's key order, so an unchanged record read as changed: the idea was rewritten, and its revision bumped, at every look-back close | CONFIRMED (server key order simulated) | Record wrong, no money | Key-order-free comparison (`stableStringify`) |

**RFX's notes, and what was done with them:**
- **C-8 minor** (a correction still pending at the endpoint was not an unsettled action there, while a waiting closed row was): made consistent in 747a92e4 (settlement.js `pendingCorrections`), with a row.
- **A-2** (one waiting row at the endpoint makes the result `unmeasurable` for good, even if it posts at the next close): Q-10.
- **B-4** (a query failure on the very last look-back session drops that idea's last `LEFT_UNSETTLED` alert; the earlier alerts and the stored `readUntil` remain): stated.
- **B-6** (one write that never settles makes every later write from that fetcher time out, so those symbols read uncovered): fails closed; stated.
- **B-1** (two concurrent top-ups merging different rows for a new symbol leave it uncovered for one session): fails closed; stated.
- **A-6** (a paper holding's suspicion or held action holds the resulted idea's late rows; the rows are named, the root doubt is not): stated.

**What no reviewer has seen.** RFX checked de858e26. These came after it:
- the hold-set fix (fbf83457);
- the three RFX fixes and the endpoint's pending corrections (747a92e4);
- the rows of f6fea858 and ec941a1c.

Each has rows that failed before it, the final soak and a mutant (§5.4), but no reviewer has checked them. They are handed to Astra's review of this build (§10), as T1a-2b-3 handed its last fixes on.

**Soak 3's finding (fbf83457).** The AR4-A-4 fix let a ruling apply to a sold holding's split record. But the record stayed in the hold set the other ledgers' appliers read, so the comparison's later dividend waited at the ruling's close and a re-run paid it (I-5; 4 of 6,000 late histories). A ruled id now leaves the hold set. The four seeds are kept (§6).

### 5.4 The mutation battery

**How it ran.**
- **The tree.** A `git archive` of the final head f6fea858 (code identical to 747a92e4). Each mutant edits one or more anchors; each anchor must occur exactly once, or the mutant is BROKEN and does not run.
- **The rows.** Each mutant runs the idea book's rows (`api/_utils/practiceField`, `api/practice-field`, the two cron Practice Field files, the protected-store scan; 1,245 rows at f6fea858, all passing at baseline) with a JSON reporter.
- **The verdict** comes from the exit code AND the failing rows' names. A run whose only failures are load failures is BROKEN, never a kill.
- **Restore.** The files are restored and compared byte for byte after each mutant.
- **Where the definitions are.** Runner and definitions: the session scratchpad (`battery/run-battery.mjs`, `battery/mutants.mjs`). Each mutant's `from`/`to` is listed below by id and item.

**Result at f6fea858: defined 61, ran 61, broken 0, killed 58, survived 3.**
- **Two survivors closed.** FC6 (a correction moving the line of a stock the ledger no longer holds) and FX2 (a deferred correction leaving the row at full quality) had no row that isolated them. Each got one (ec941a1c, test-only). Re-run at ec941a1c (1,246 rows): both **KILLED**.
- **One equivalent mutant.** FA4 removes `doubtOn`'s ruled-id filter (close.js:416). Since fbf83457 (FS1), a ruled id is removed from the hold set itself before the plan reads it (close.js:386). The coverage items merged in after that carry `ca_coverage_gap_…` ids, which no ruling's ids include. So the filter can no longer change an outcome. The pair check shows the guard is real but subsumed:

  | Mutant | Rows failing |
  |---|---|
  | FA4 alone | 0 |
  | FS1 alone | 4 (the four soak seeds) |
  | both together | 4 — the AR4-A-4 rows |

**Final: 61 defined, 61 ran, 0 broken; 60 killed and 1 equivalent.** All six the prompt names are killed:
- N1, an adjustment posted twice;
- N2, a rewrite in place of an adjustment;
- N3, an ambiguous id adjusted automatically;
- N4, a parse rejection read as covered;
- N5, a missing report read as covered;
- N6, I-6 disabled: caught by all 8 fixed cases (each asserts that I-6 checked something) and the 4 I-6 rows.

| Mutant | Item | Verdict | Rows failing | First failing row |
|---|---|---|---|---|
| `N1-adjustment-posted-twice` (named: an adjustment posted twice) | T2D-03 | KILLED | 22 | corporateActionCorrections.lensA.test.js › lens (a) — catch-up pays once catch-up OPEN idea: S3, S4 missed, the $1 dated |
| `N2-rewrite-not-adjustment` (named: a rewrite in place of an adjustment) | T2D-04 | KILLED | 68 | corporateActionCorrections.fixRound.test.js › RFX-2 — two share-basis rows of one date on a closed holding apply in orde |
| `N3-ambiguous-adjusted-automatically` (named: an ambiguous id adjusted automatically) | T2D-03 | KILLED | 10 | corporateActionCorrections.lensA.test.js › AR4-A-1 — a share-basis ambiguity recorded on a closed holding holds a later- |
| `N4-parse-rejection-read-as-covered` (named: a parse rejection read as covered) | T2D-12 | KILLED | 8 | corporateActionCorrections.test.js › T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report i |
| `N5-missing-report-read-as-covered` (named: a missing report read as covered) | T2D-12 | KILLED | 25 | corporateActionCorrections.fixRound.test.js › RFX-2 — two share-basis rows of one date on a closed holding apply in orde |
| `N6-I6-disabled` (named: I-6 disabled (must be caught by a fixed case)) | I-6 | KILLED | 12 | caOracle.test.js › I-6 — every ledger is paid what its holding was owed, from the inputs and its holding history alone T |
| `L03-window-strict-sale-day` | T2D-03 | KILLED | 13 | corporateActionCorrections.lensA.test.js › AR4-A-1 + A-4 — an open reverse-split conflict paid over, then the founder's  |
| `L03-count-at-close-not-ex-date` | T2D-03 | KILLED | 1 | corporateActionCorrections.test.js › the battery's rows — each a behaviour of this build no other row pins T2D-03: a div |
| `L03-redate-after-sale-paid` | T2D-03 | KILLED | 12 | corporateActionCorrections.lensA.test.js › AR4-A-1, A-2 — breadth and the result a1 severity BREADTH: a share-basis POSS |
| `L03-closed-symbol-doubt-ignored` | T2D-03 | KILLED | 3 | corporateActionCorrections.lensA.test.js › AR4-A-2 — a row waiting on a closed holding is named: below full quality, ale |
| `L03-resulted-ideas-not-read` | T2D-03 | KILLED | 15 | corporateActionCorrections.fixRound.test.js › RFX-3 — a resulted idea is not rewritten at every look-back close when not |
| `L03-resulted-posts-to-ledger` | T2D-03 | KILLED | 3 | corporateActionCorrections.test.js › T2D-03 — a dividend first listed after the idea's line sale, dated while it held th |
| `L03-book-mirror-dropped` | T2D-03 | KILLED | 65 | corporateActionCorrections.fixRound.test.js › RFX-2 — two share-basis rows of one date on a closed holding apply in orde |
| `L03-retention-dropped` | T2D-03 | KILLED | 1 | corporateActionCorrections.test.js › the battery's rows — each a behaviour of this build no other row pins RETENTION: th |
| `L04-same-date-split-not-late` | T2D-04 | KILLED | 13 | corporateActionCorrections.lensA.test.js › lens (a) — catch-up pays once catch-up RESULTED idea: S3, S4 missed; a 5/4 da |
| `L04-received-ignores-adjustments` | T2D-04 | KILLED | 29 | corporateActionCorrections.lensA.test.js › lens (a) — catch-up pays once catch-up RESULTED idea: S3, S4 missed; a 5/4 da |
| `L04-doubt-ignored` | T2D-04 | KILLED | 3 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) RF6-X1 (FQ-5): a |
| `L04-debit-guard-dropped` | adjustment | KILLED | 1 | corporateActionCorrections.test.js › the adjustment record (pure): a debit larger than its cash is held, and the result  |
| `L04-reconcile-ignores-adjustments` | I-3 | KILLED | 65 | corporateActionCorrections.fixRound.test.js › RFX-2 — two share-basis rows of one date on a closed holding apply in orde |
| `L05-feed-revision-undetected` | T2D-05 | KILLED | 26 | corporateActionCorrections.lensC.test.js › P2 — after a split correction, a late dividend paid by the C-16 path reads th |
| `L05-unrecorded-correction-accepted` | T2D-05 | KILLED | 2 | corporateActionCorrections.lensC.test.js › P15 — odd payload shapes on a correction amount as a string, a ratio for a di |
| `L05-correction-refused-422` | T2D-05 | KILLED | 21 | corporateActionCorrections.lensC.test.js › P2 — after a split correction, a late dividend paid by the C-16 path reads th |
| `L05-split-correction-not-on-book` | T2D-05 | KILLED | 18 | corporateActionCorrections.lensC.test.js › P2 — after a split correction, a late dividend paid by the C-16 path reads th |
| `L05-split-correction-no-recompute` | T2D-05 | KILLED | 1 | corporateActionCorrections.lensC.test.js › P25 — a split correction at a close whose data does not cover AAPL shares and |
| `L05-ruling-pending-forever` | T2D-05 | KILLED | 6 | corporateActionCorrections.lensC.test.js › C1 — a dividend correction and a rename (or cash delisting) of the holding in |
| `L12-malformed-envelope-covered` | T2D-12 | KILLED | 3 | corporateActionCorrections.test.js › T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report i |
| `L12-wrapper-reports-every-symbol` | T2D-12 | KILLED | 1 | corporateActionCorrections.test.js › T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report i |
| `L12-wrapper-at-off` | T2D-12 | KILLED | 1 | corporateActionCorrections.test.js › T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report i |
| `L12-backfill-parse-not-required` | T2D-12 | KILLED | 1 | corporateActionCorrections.test.js › the battery's rows — each a behaviour of this build no other row pins T2D-12: a BAC |
| `L12-sale-ignores-report` | T2D-12 | KILLED | 1 | corporateActionCorrections.test.js › the battery's rows — each a behaviour of this build no other row pins T2D-12: a SAL |
| `L12-admission-ignores-report` | T2D-12 | KILLED | 1 | corporateActionCorrections.test.js › the battery's rows — each a behaviour of this build no other row pins T2D-12: ADMIS |
| `L12-close-reads-no-report` | T2D-12 | KILLED | 485 | cron/practiceFieldIsolation.test.js › the close sweep: dispatch by kind, and one snapshot per date (B-STAMP) an idea boo |
| `FB1-report-not-tied-to-rows` | AR4-B-1 | KILLED | 2 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FB3-late-rejection-floor-dropped` | AR4-B-3 | KILLED | 2 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FB4-query-unfenced` | AR4-B-4 | KILLED | 1 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FB5-prior-success-overwritten` | AR4-B-5 | KILLED | 1 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FB6-write-not-bounded` | AR4-B-6 | KILLED | 1 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FB7-dateless-noop` | AR4-B-7 | KILLED | 1 | corporateActionCorrections.test.js › the lens (b) review's rows — the report tied to its rows, a late rejection, the fen |
| `FA1-same-close-doubt-ignored` | AR4-A-1 | KILLED | 5 | corporateActionCorrections.lensA.test.js › AR4-A-1 — a share-basis ambiguity recorded on a closed holding holds a later- |
| `FA2-row-ignores-waiting-rows` | AR4-A-2 | KILLED | 2 | corporateActionCorrections.lensA.test.js › AR4-A-2 — a row waiting on a closed holding is named: below full quality, ale |
| `FA2-endpoint-ignores-waiting-rows` | AR4-A-2 | KILLED | 1 | corporateActionCorrections.lensA.test.js › AR4-A-1, A-2 — breadth and the result a2 severity UPGRADE: the open idea reac |
| `FA2-resulted-waiting-unnamed` | AR4-A-2 | KILLED | 1 | corporateActionCorrections.lensA.test.js › AR4-A-2 — a row waiting on a closed holding is named: below full quality, ale |
| `FA3-history-only-not-in-force` | AR4-A-3 | KILLED | 3 | corporateActionCorrections.lensA.test.js › AR4-A-3 / AR4-C-6 — a revision of a history-only split can be answered a revi |
| `FA4-ruled-id-is-a-doubt` | AR4-A-4 | SURVIVED — **equivalent** (see below) | 0 | — |
| `FA5-id-without-events` | AR4-A-5 | KILLED | 1 | corporateActionCorrections.lensA.test.js › AR4-A-5 — each late_basis its own id and evidence document deterministic id c |
| `FA6-resulted-gate-per-symbol` | AR4-A-6 | KILLED | 1 | corporateActionCorrections.lensA.test.js › AR4-A-6 — on a resulted idea the doubt is per action resulted gate breadth RE |
| `FC1-late-dividend-stale-count` | AR4-C-1 | KILLED | 4 | corporateActionCorrections.lensC.test.js › P2 — after a split correction, a late dividend paid by the C-16 path reads th |
| `FC3-no-revision-first` | AR4-C-3 | KILLED | 5 | corporateActionCorrections.lensC.test.js › P1 — closed path: a correction and an earlier-dated re-date of it, in ONE clo |
| `FC5-residual-stale` | AR4-C-5 | KILLED | 3 | corporateActionCorrections.lensC.test.js › P5 — a split correction leaves an open suspicion standing for a stale residua |
| `FC6-share-correction-moves-sold-line` | AR4-C-6 | SURVIVED at f6fea858 → **KILLED** at ec941a1c (new row) | 1 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-11 (RF4, r |
| `FC7-not-entitled-correction-accepted` | AR4-C-7 | KILLED | 2 | corporateActionCorrections.lensC.test.js › P4 — a founder-ruled NOT-ENTITLED dividend, revised: a correction is accepted |
| `FC8-resulted-correction-dropped` | AR4-C-8 | KILLED | 2 | corporateActionCorrections.lensC.test.js › P6e — a dividend correction deferred at the idea result close single-name ide |
| `FC9-founder-seen-ignored` | AR4-C-9 | KILLED | 1 | corporateActionCorrections.lensC.test.js › P21 — FQ-5 on the CLOSED path: a payload the founder conflict ruling saw reop |
| `FC11-correction-after-sale-unflagged` | AR4-C-11 | KILLED | 1 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-11 (RF4, r |
| `FX1-pending-correction-closes-unseen` | RF6-X1 | KILLED | 1 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) RF6-X1 (FQ-5): a |
| `FX2-pending-correction-full-quality` | RF6-X1 | SURVIVED at f6fea858 → **KILLED** at ec941a1c (new row) | 1 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) A dividend corre |
| `FS1-ruled-id-left-in-hold-set` | soak I-5 | KILLED | 4 | corporateActionSequences.late.test.js › S-6 extended — the late soak findings, kept as fixed seeds late soak seed 179572 |
| `FR1-floor-before-entry` | RFX-1 | KILLED | 6 | corporateActionCorrections.fixRound.test.js › RFX-1 — a rejected row dated on or before the idea's entry never lowers it |
| `FR2-share-rows-wait-on-each-other` | RFX-2 | KILLED | 3 | corporateActionCorrections.fixRound.test.js › RFX-2 — two share-basis rows of one date on a closed holding apply in orde |
| `FR3-unsettled-compare-key-order` | RFX-3 | KILLED | 2 | corporateActionCorrections.fixRound.test.js › RFX-3 — a resulted idea is not rewritten at every look-back close when not |
| `FR4-endpoint-ignores-pending-correction` | AR4-C-8 (RFX note) | KILLED | 1 | corporateActionCorrections.lensC.test.js › the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-8 (RFX not |
| `PAIR-FA4+FS1` (pair, the equivalence check) | AR4-A-4 (equivalence check) | KILLED | 4 | corporateActionCorrections.lensA.test.js › AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split con |


## 6. The soak

**The generator** (`__testsupport__/caSequences.js` `generateLate`) writes histories with:
- late listings after a sale or a result;
- late splits before paid dividends;
- settled-id revisions, ruled to keep or to correct;
- parse rejections and missing reports;
- uncovered sessions;
- same-stock and sector comparisons.

Each history runs through the real close, sales, catch-up and founder action. After every close it checks I-1 to I-5, the independent input oracle and **I-6**, and every close is re-run (I-5).

**I-6** (`caOracle.js` `EntitlementOracle`): every ledger's received cash for an unambiguous dividend id, adjustments included, equals what the inputs and its holding history say it was owed. It is computed from the emitted inputs and the holding history only; it imports no product policy.
- It excuses only what the product must not decide: an id the inputs make ambiguous, a session the inputs leave uncovered, a founder's suspicion split.
- **On `main` (41c04cd2), with this build's test support laid over it, I-6 fails the fixed cases:**
  - `astra-T2D-03` and `astra-T2D-03-sector-fund`: received $0, owed $99.97.
  - `astra-T2D-04`: received $99.97, owed $124.96.
  - `astra-T2D-04-reverse`: received $99.97, owed $79.98.
  - T2D-05's ruling gets 404 there, and T2D-12's rejected session reads covered.

**The fixed cases run in every suite:**
- `FIXED_LATE`: Astra's six reproductions, plus `review-AR4-A-1` and `review-AR4-C-1`;
- the 12 `LATE_SOAK_SEEDS`, each a soak finding kept;
- 40 generated seeds;
- Astra's seeds 19112000–19112031 and T1a-2b-3's kept soak seeds (`corporateActionSequences.ordered.test.js`), and T1a-2b-3's fixed histories (`corporateActionSequences.test.js`). All of them run through the same harness, with I-6.

| Run | Head | Seeds | Histories | Closes | Failures |
|---|---|---|---|---|---|
| Soak 1 | 6ec361ab | late 1795727348–1795733347 | 6,000 | — | 232, all fixed in 994ccc2e (late-entitlement order, book mirror of a correction, closed rows that waited, out-of-window re-dates; two oracle gaps) |
| Soak 2 | 994ccc2e | late 1795727348–1795733347 | 6,000 | 113,914 | 0 |
| | | ordered 1911200000–1911205999 | 6,000 | 119,912 | 0 |
| | | Astra's wide 2026111900–2026112299 | 400 | 8,032 | 0 |
| Soak 3 | de858e26 (after the review fixes) | late, the same range | 6,000 | 113,844 | **4**: 1795727403, 1795729529, 1795731153, 1795731607 (I-5) |
| | | ordered, the same range | 6,000 | 119,912 | 0 |
| | | wide, the same range | 400 | 8,032 | 0 |
| Soak 4 | fbf83457 | late 1795727348–1795733347 | 6,000 | 113,914 | 0 |
| | | ordered 1911200000–1911205999 | 6,000 | 119,912 | 0 |
| | | Astra's wide 2026111900–2026112299 | 400 | 8,032 | 0 |
| **Soak 5** | **747a92e4, the final code** (later commits add test lines only) | late 1795727348–1795733347 | 6,000 | 113,914 | **0** |
| | | ordered 1911200000–1911205999 | 6,000 | 119,912 | **0** |
| | | Astra's wide 2026111900–2026112299 | 400 | 8,032 | **0** |

**What the soak does not draw.** Soak 4 and soak 5 report the same figures, because the generator never writes the shapes RFX-1 and RFX-2 need: a rejected row dated before the entry, and two share-basis ids on one date. Those fixes are covered by the `fixRound` rows and the FR1 and FR2 mutants, not by the soak. The ranges reported are the ones every soak failure came from; a fresh range was not run.

**Soak 3's four failures.** They are one class, a consequence of the AR4-A-4 fix. A ruling that settles a sold holding's split record at its close is applied there by the plan. But the record stayed in the hold set that the other ledgers' appliers read. So the same-stock comparison's later dividend waited at the ruling's close, and a re-run of that close paid it (I-5). Fixed in fbf83457: a ruled id leaves the hold set (close.js). All four seeds are kept as fixed seeds.

**What the final soak's late histories exercised** (soak 5; soak 4's figures are the same — 6,000 histories, 59,957 sessions, 113,914 closes including the re-runs; the idea sold a line in 2,858):

| Measure | Count |
|---|---|
| I-6 checks | 217,185 |
| …excused (an id the inputs make ambiguous, or a session they leave uncovered) | 123,061 |
| …with nothing owed | 17,826 |
| …checks that met a `late_entitlement` | 10,135 |
| …checks that met a `late_basis` | 19,297 |
| …checks that met a `ruled_correction` | 4,104 |
| Adjustments posted, idea ledger: `late_entitlement` / `late_basis` / `ruled_correction` | 1,924 / 1,983 / 815 |
| Adjustments posted, comparison ledger: `late_basis` / `ruled_correction` | 1,481 / 602 |

How often each chain kind was drawn:

| Kind | Histories |
|---|---|
| late after a sale | 2,044 |
| …of them ambiguous | 658 |
| late split | 2,334 |
| late reverse split | 722 |
| two dividends after a late split | 380 |
| settled revision of a split | 1,407 |
| settled revision of a dividend | 1,318 |
| ruled correction | 1,066 |
| ruled keep | 851 |
| parse rejection | 1,030 |
| missing parse report | 1,120 |
| coverage failure | 3,851 |
| same-stock comparison | 1,968 |
| sector-fund comparison | 2,008 |
| frozen-basket comparison | 2,024 |

## 7. The end-to-end comparison and the differentials

**The end-to-end dump** (`endToEnd.test.js`, `PF_E2E_DUMP`) is byte-identical to `main`'s at f6fea858 (also at de858e26):
- both 443,533 bytes, SHA-256 `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9`;
- `cmp` reports no difference.

The head's dump strips the parse-report documents, after checking each one is exactly the clean entry for its daily entry's rows (check-then-strip). The pinned `EXPECTED_DUMP` constant is unchanged from `main`.

**The differentials** (Astra's probes, base 41c04cd2 against head f6fea858 (also at de858e26), the vendor key synthetic, `fetch` and prices stubbed):
- `astra-differential.test.js`: **36/36** identical;
- `astra-cron-trace.test.js`: **40/40** identical, every fire's trace and every document;
- the planted-backfill control (`plant.test.js`): **4/4** — at `'off'` and `'on'`, a planted backfill reaches no quarterly reader (100 shares, as `main`), while the same split from the vendor does (200 shares, as `main`).

**Quarterly isolation.**
- At `'off'`, and at `'on'` with no idea book, the daily build gets no wrapper and no retention, and writes no report. Its documents and vendor calls are byte-identical to `main`'s (`corporateActionCorrections.test.js` QUARTERLY ISOLATION and RETENTION, the cron trace).
- With an idea book in the fire, the wrapper leaves the shared daily document byte-identical and only adds the report. Retention can add the symbols of recently resulted ideas (reading 3.1-4, Q-3).

## 8. New stores and fields

**New collection** — `practiceFieldCaParseReports/{session}` `{ schemaVersion: 1, session, symbols: { SYM: entry } }`.
- Each entry has: `rowsReceived`, `rowsAccepted`, `rowsNoOp`, `rowsRejected`, `rejects: [{ leg, reason, row }]`, `malformedEnvelope`, `legs: { splits, dividends }` (each `{ answered, status, envelope, received, accepted, noOp, rejected }`), `at`, and `actionsHash`.
- It is written by the daily build's wrapper (a merge of the symbols' entries) only for the idea books' coverage symbols. It is read by the close, the sale and admission.
- The URL and key are never stored.
- It is server-only: the rules deny clients (rules test). It is in the protected-store scan (`compositionProtectedStoresScan.js:327`, allowlist note `_notes_practice_field_t1a2b4`). See Q-1.

**New documents in an existing subcollection** — `mandates/{bookId}/ideas/{ideaId}/evidence/adjustment_{id}`.
- One per adjustment: created once (`tx.get`, then `tx.create`), content-hashed (`sealAdjustment`), and owner-readable under the existing evidence rule (rules test).

**New fields:**

| Where | Field | What |
|---|---|---|
| ledger | `adjustments[]` | `{ id, kind, actionId, ticker, type, effectiveDate, corrects, correction, entitledShares, derivation, amountPerShare, amountCents, amountUsd, postedOn, postedTo, seq, payload, ruling, trigger }`, plus `held`, `reason` and `availableUsd` when a debit is held; `ratio`, `correctsRatio`, `sharesBefore`, `sharesAfter` and `soldBeforeCorrection` on a split correction |
| ledger | `closedHeldRows[]` | A sold holding's row waiting on a doubt: `{ actionId, type, ticker, effectiveDate, ratio, amount, source, heldOn, closedOn }` |
| ledger receipt | `historyOnly: true`, `closedOn` | A share-basis receipt for a holding since closed |
| ledger receipt | `settledBy: 'feed'`, `closedHolding: true`, `kinds: ['revision']` | Revision and ambiguity records (FQ-11; closed holdings) |
| idea | `resultAdjustments` | The view beside a result |
| idea | `lateDataUnsettled` | `{ actions: [{ ledger, actionId, kind }], readUntil }` on a resulted idea while something waits |
| idea `founderRulings[]` | `corrects: true`, `payload`, `from`, `seen`, `outcome` | A correction ruling |
| `practiceFieldCaBackfill/{SYM}` | `parseReport` | The backfill's own parse report |

**Reads.** The close lists the ideas that resulted within the look-back with one single-field range query: `ideas` where `liquidation.completedSession >= …`. That needs no composite index, and it is fenced (AR4-B-4).

**No rules or index file changed. The founder has no step after merge for this build.** The switch itself is a separate decision (§10).

## 9. The register

The full register to T1a-2b-3 is `docs/audits/20261117_BUILD_T1A2B3_CORPORATE_ACTION_FINISH.md` §7. This build changes these entries.

### 9.1 Astra's four pre-switch items

| Id | Finding (A-2B3) | Status | Evidence |
|---|---|---|---|
| T2D-03 | A line sale erased a dividend the idea was owed | **Built**: paid once on the ex-date count, with or without a comparison holding the symbol, and after the result (to the treasury, shown beside the result); automatic only for an unambiguous id | `FIXED_LATE` `astra-T2D-03`, `astra-T2D-03-sector-fund`; corrections "T2D-03" (7 rows); I-6 fails on `main` |
| T2D-04 | A late split never corrected a dividend already paid | **Built**: one linked `late_basis` on every affected ledger and the book; both arrival orders give the same money (AR4-C-1 closed the one order that did not) | `astra-T2D-04`, `astra-T2D-04-reverse`, `review-AR4-C-1`; corrections "T2D-04" (5 rows); I-6 fails on `main` |
| T2D-05 | A vendor correction under a settled id was ignored | **Built**: `resolve_hold` may choose the corrected payload (one `ruled_correction`; a split's count corrected and its dividends recomputed); keeping the original posts nothing; FQ-5 | `astra-T2D-05`; corrections "T2D-05" (5 rows); lensC |
| T2D-12 | A parser rejection read as clean coverage | **Built**: the per-symbol parse report; F-6 requires it present, with no rejection and no malformed envelope, and tied to the entry's rows | `astra-T2D-12`; corrections "T2D-12" (5 rows) and lens (b)'s 8 rows |

### 9.2 Items carried or partly touched

| Id | Status |
|---|---|
| T2D-13 (pass budget) | Carried, T5 (unchanged) |
| T2D-14 (a stale failed backfill can overwrite a success) | **Partly**: AR4-B-5's guard means a failure never replaces a stored `failed: false` document. The race between two concurrent fetches is not addressed. Still T5 |
| T2D-11 (legacy split receipt) | Carried, T5 (unchanged) |
| T1a-2b-3 §7.4: Astra re-checks D01, D02 and fixes 3–6 | Carried: in Astra's review of this build (§10). Their rows and seeds pass here (§4), and the soak re-ran them (§6) |

### 9.3 Items this build's review raised

These are not fixed, or not fully fixed.

| Id | Status | Home |
|---|---|---|
| AR4-C-4 | A correction under a renamed ticker is paid fresh (as `main`) | Q-6 |
| AR4-C-11 | A correction after a sale: flagged and recorded; the sale stands | Q-5 |
| AR4-A-2 (c), A-6, C-8 on a resulted idea past the look-back | Named and alerted (`lateDataUnsettled`, `…LEFT_UNSETTLED`); not paid without a ruling | Q-2 |
| AR4-B-2 | Retention widens the shared daily document with an idea book in the fire | Q-3 |
| AR4-B-3 (null dividend) | Holds until a backfill or ruling | Q-7 |
| AR4-B-8 (report retention) | Reports outlive the 120-day cleanup | Q-1 |
| AR4-C-5 (liveness) | A correction under a standing suspicion still needs `price_move` | Q-8 |
| AR4-C-2 | Latent (no rename or delisting feed); count hardened | — |
| RFX-2 (direction correction under another id) | Two same-date share-basis ids apply in order, on both paths, as on `main` | Q-9 |
| A-2 / C-8 at the endpoint | Unmeasurable for good, even after the money posts | Q-10 |

## 10. Ready for the switch

**From this build's side, what Astra asked before the switch is built:**
- T2D-03, T2D-04, T2D-05 and T2D-12 are built and proven: I-6 fails on `main` and holds at the head over every soak history and fixed case (§6).
- Every review finding is answered (§5).
- Complete, on-time data moves money exactly as `main`: the end-to-end dump and both differentials are identical (§7).

**What stays before the flag moves from `'off'`:**
1. Astra's review of this build. That includes the fixes no reviewer has seen (fbf83457, 747a92e4: §5.3), and T1a-2b-3's carried request to re-check D01, D02 and its fixes 3–6 (its §7.4).
2. The founder's answers. Q-1 (sign-off for `practiceFieldCaParseReports`) is needed before the switch. Q-2 to Q-10 can be answered after it, because each leaves money where it is and names the case, but Q-2 decides whether late data on a resulted idea can ever be settled.
3. The switch itself, by its own PR. This build changes no flag, pin, rule or index.

**Status: built, reviewed, refuted, fixed and checked. Dark: `PRACTICE_FIELD_MODE` stays `'off'`. Draft PR only; not merged.**

## 11. Fix round, 20 Nov 2026 — late data asks (T2E-01 to T2E-08)

| | |
|---|---|
| Prompt | "Fix T1a-2b-4: late data asks the founder (T2E-01 to T2E-08)", 20 Nov 2026 — Astra's review `docs/audits/20261120_ASTRA_REVIEW_T1A2B4.md` (committed byte-identical first, SHA-256 `ea2da300…1e86`) |
| Branch, base | `claude/practice-field-t1a2b4-corrections` from `df9b7278`; `origin/main` was `41c04cd2` through the round. At the final push it is `cf35151b` (#1099 and #1100: flags and the cockpit readout, no Practice Field file); it merges cleanly and was not merged here |
| Code head | `e8d51fd6` for the product code. After it, test files only: `0426efc9`, `8418716a`, `afd145f6` (the battery's last two survivors settled, §11.9); the report commits are documentation only. Then the founder's Q-14 ruling: `6c8daebb` (Q-14), `f1d396c5` (`origin/main` merged in), `9301f87f` (the Q-14 refuter's Q14-1) — §11.15. Final code head of this round: `9301f87f` |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No fenced file, flag, pin, rules or index changed; `mandateUniverseSnapshot.js` and `mandateCorporateActions.js` untouched. Offline: the repository's test doubles only; no network request, no environment variable, `.env` file or credential read |

> **Time — read §11.14.** This round took about 7½ working hours (11:00–19:05 CT on 20 Nov, less a 25-minute pause) against about 1 h 40 min of building the fixes. The rest went to proving them, three refuter rounds where the prompt asked for one, and runs I had to repeat. §11.14 sets out where the time went, why, and what changes so it does not happen again. After the first push, the founder's follow-up (settle the battery's two survivors, with the fast runner from #1101) took about 1 h 40 min more, 20:53–22:35 CT; §11.14 covers that too.

### 11.1 In plain terms

**What Astra found.** Eight histories the build got wrong. In four, money moved on late data with no one deciding it: a dividend paid on a sold holding when two dates for it arrived together (T2E-01), a dividend moved back across the sale date paid at full quality (T2E-02), a late split adding $24.99 to a dividend still awaiting a ruling (T2E-03), and two splits delivered out of date order paying one cent more (T2E-04). Four more let a doubt slip: a correction after a sale left the result looking clean (T2E-05), two same-date opposite splits were paid and sold on at 2% price drift (T2E-06), a losing daily build's clean report hid the winner's rejection (T2E-07), and a rejected split was forgotten once the line was sold (T2E-08). She also showed that I-6 excused too much.

**What the founder ruled.** Late data stops paying automatically. It is detected, named and held; the founder's approval posts it.

**What changed.**
- **Late money is a proposal.** A dividend first listed after the idea sold the stock, or a paid dividend whose share count a late split changes, is now recorded on the ledger as a proposal, named and alerted. While it waits, the day's row and the result read below full quality. The founder approves or declines it with `resolve_hold` (`late_adjustment`). Approval posts what is owed at that moment, less what was already received — and is refused while the dividend is in dispute, another row may be the same dividend under another date, a split within the holding is unresolved, or a date in the holding is uncovered.
- **Sold holdings are screened as held ones are.** Two rows that may be one dividend under two dates are an ambiguity for the founder, never a payment — within one close, and against rows seen just after the sale, which are now kept.
- **Share counts follow the calendar, not the arrival order.** The count is recomputed from the entry along the dated chain, so 4-for-5 then 2-for-1 gives $516.64 whichever arrives first.
- **Two splits of one date under two ids are one ambiguity.** The count holds; no dividend or sale uses it until the founder rules (Q-9 answered with a hold).
- **A correction after a sale leaves a standing reason.** The sale stands; from then on every row, the endpoint and the result read below full quality, the reason beside the result (Q-5).
- **Parse reports merge.** Two observations of one symbol and session meet in a transaction; a rejection stays; two that disagree read uncovered.
- **A resulted idea's late data is named only.** Nothing posts to the treasury any more (Q-2 as ruled).

**How it is proved.** Each of Astra's histories is a row that fails at `df9b7278` and passes now — her four plans verbatim among them. I-6's excuses are scoped to each id's own facts, and a new I-7 checks every posted adjustment has a founder approval or ruling in the inputs — and, since the refuters, that L-2 did not refuse it at the close it posted; both fail at `df9b7278` on her histories. The generator now writes the six shapes she found missing, and the refuter's three. At the head, 11,560 generated histories — fresh seeds and Astra's ranges, 222,954 closes — and every fixed case pass with no failure (§11.8). The end-to-end dump and both differentials are identical to `main`'s. The mutation battery: 119 mutants, 118 killed; the one survivor (NL2c, code the ruling made redundant) is proven by a row to change no stored document (§11.9).

**Three independent refuters read the fixes.** Each was told to find late or corrected data moving money without the founder; **none found any**. Between them they found thirteen narrower product defects and five gaps in the oracle; the strengthened oracle then found one more product defect itself. The defects: approvals that posted while L-2 should have refused them (two rows of one close pairing only with each other; a dividend moved past the sale, or to the day after the close; a declined id coming back at another amount or date; a backfill older than the doubt it cleared; a split just past the sale pairing with one inside it), a ruling posting on a count still in doubt, a decline that did not stick, a doubt that could never clear, a net that missed a split, a proposal that could never complete. Every one is fixed, with a row that fails on the code it was found in (§11.10). The final soak then found two more — one an over-hold this round's own fix had made, one in the oracle — both fixed and kept as rows (§11.8). Those last fixes, and the third refuter's two (one condition in the product, one bound in the oracle), were not read by another refuter.

**A fourth, narrow refuter** then read the proof that the battery's two survivors change nothing stored, and broke half of it: one of them (FR2) is reachable — a founder-ruled split beside a new split of its date — and changes what is stored, though no money. It is now killed by a row that pins today's behaviour, and the founder is asked whether that behaviour is right (Q-14, §11.4 reading 14). The other (NL2c) holds: proven on 90 histories (§11.9, §11.10).

**What changed for complete, on-time, unambiguous data:** nothing. The end-to-end dump is byte-identical to `main`'s and both differentials are identical. Every row whose expectation changed is listed (§11.6) with its reason; none is a change for complete, on-time, unambiguous data.

### 11.2 The founder's ruling, 20 Nov 2026 (verbatim)

- **L-1. No late adjustment posts on its own.**
  - A `late_entitlement` or `late_basis` is computed and recorded as a **proposal** on the ledger, and alerted.
  - While a proposal waits, the row and the endpoint read below full quality, naming it.
  - A new `resolve_hold` kind, `late_adjustment`, approves or declines one proposal. It works on open ideas only (Q-2 as ruled).
  - `ruled_correction` is unchanged: it already needs a ruling.
- **L-2. Approval posts the net, computed at posting.**
  - The amount is what the ledger is owed now, under the ruled payloads and the dated count, minus everything it has already received for that id. It is never a chained delta.
  - **Approval is refused (409) while any of these stand:**
    - the id is unresolved;
    - another candidate for the same symbol pairs with it under the re-date rule;
    - a share-basis id dated within the holding is unresolved;
    - a date in the holding interval is uncovered (T2E-03, T2E-08).
- **L-3. Closed holdings are screened like held ones.**
  - Before a proposal is made, every row for a closed holding goes through the held path's re-date pairing. That covers the other rows of the same close and observed rows just outside the holding interval within the re-date window.
  - A paired id is an ambiguity for a `conflict` ruling, never a proposal (T2E-01, T2E-02).
  - Keep the economic identity of those outside rows for the window.
- **L-4. Counts are recomputed, not patched.**
  - When a share-basis event arrives out of date order, recompute the count from the entry fill along the dated chain. The order is effective date, then phase, then id, with six-place rounding at each step.
  - Use that count for the holding, its line, the book mirror and later ex-date counts.
  - Receipts keep what happened, and the difference is recorded (T2E-04).
- **L-5. Two share-basis ids for one symbol and effective date are one ambiguity.**
  - The count holds, and no dividend or sale uses it, until a `conflict` ruling.
  - This answers Q-9 with a hold (T2E-06).
- **L-6. A correction after a sale leaves a standing reason.**
  - The sale stands.
  - From the correction on, every row, the endpoint and the result read below full quality, with the reason beside the result.
  - The same applies to a split first listed after the sale that leaves shares sold different from shares owed (T2E-05, Q-5).
- **L-7. Parse observations merge, and doubt sticks.**
  - Reports for one symbol and session merge in a transaction.
  - A rejection once recorded stays.
  - Two observations that disagree read uncovered, even when their accepted rows hash the same. A later clean backfill covers it through the existing path (T2E-07).
- **L-8. Resulted ideas: late data is named and alerted only.** Nothing posts to the treasury. `lateDataUnsettled` carries it (Q-2 as ruled).

### 11.3 What changed, by `file:line` (at the code head `e8d51fd6`)

The round's commits: `16408f50` (Astra's review, byte-identical), `ab24620d` (her histories and the oracle first, red at `df9b7278`), `400742b2` (L-1 to L-6, L-8), `d4d32e9f` (L-7; the endpoint and T2E-05 rows), `f3e23c9d` (the shapes; the planner's doubt dated), `193a3dda` (rows for the battery), `c569f281`, `05aa1200`, `477ae3fb` (the three refuters' findings, each with its rows), `e8d51fd6` (the final soak's two findings, each kept as a row); then test files only: `0426efc9` and `8418716a` (the equivalence row), `afd145f6` (FR2 killed by the fourth refuter's EQ-1 row; the equivalence row NL2c's alone); after the founder's Q-14 ruling, `6c8daebb` (Q-14: `ledger.js` `sameDateUnruled`, the held and the sold path), the merge of `origin/main` (`f1d396c5`), and `9301f87f` (the Q-14 refuter's Q14-1) — §11.15. All under `api/_utils/practiceField/`.

**`adjustments.js`** — the late-data planner (`planLedgerAdjustments`):
- `:214` `LATE_PROPOSAL_STATUS`, `LATE_BLOCKER`, `proposalIdOf`, `openProposals` (L-1). `:234` `pairingCandidatesOf` — L-2 ②: any open candidate of the type and payload within the window (R-1, R-3).
- `:293` `post()` posts only with the founder's approval or ruling, and never on a resulted idea (L-1, L-8). `:333` `propose()` records or re-states a proposal — owed now on the dated count, less everything received (L-1, L-2); `:345` a decline stands while those facts do (R-2).
- Sold holdings (L-3): `:398` an open late entitlement screened at every close (R-1, R-3); `:410` rows just outside the holding kept, dated after the close too (L-3, P-4); `:423` `priorProposalOf` — a declined payload stays seen (P-2a); `:461` the same-close pairing (L-3, L-5); `:567` the re-date screen against every payload seen, the outside rows and the waiting rows; `:596` a ruling waits on the holding's sticky doubt (R-5); `:630` L-6's standing reason for a split listed after the sale.
- `:196` the re-date pool keeps the last declined late entitlement (P-2b). `:103` `countOnExDate` on the dated chain (L-4).
- Step 2: `:684` a ruled correction waits on the doubt (R-5) and `:688` posts the net owed now, less received (L-2); `:700` a paid dividend's `late_basis` is proposed (L-1).
- Step 3: `:733` an outside dividend row pairing with an open `late_basis` recorded for the founder (P-1); `:749` an outside share-basis row pairing with one applied within the holding recorded (found by I-7's ③), unless the founder's ruling of the action within already answered that pairing (the final soak); `:767` `blockersNow` — L-2's four refusals, `:785` with the outside share-basis re-date; `:801` the founder's decisions: a decline closes the proposal, an approval posts its net while nothing refuses it.

**`ledger.js`** — `:722` `shareBasisChainOf` in dated order, `:747` `datedCountOn`, `:1736` an out-of-order receipt recounted along the dated chain, its difference recorded (L-4); `:1497` two share-basis ids of one date paired (L-5).

**`close.js`** — `:184` `withClosedCoverageDoubts`, the sticky doubt of a sold holding (L-2 ④, T2E-08), `:199` cleared only by a backfill fetched after it was seen (F-1); `:314` a sold holding's clean backfill rows join the session's (R-4, P-3); `:481` `rulingDoubtOn` (R-5); `:487` `blockersOf`; `:599` a waiting proposal names the row below full quality (L-1); `:748` the standing reasons on the row (L-6); `:862` `closeResultedIdea` — late data named and alerted, nothing posted (L-8); `:1170` the book's mirror takes the recount (L-4).

**`caBackfill.js`** — `:82` `backfillNeeds` names a sold holding's doubt (R-4).

**`holdRulings.js`** — `:180` `lateApprovalRefusal`, L-2's four 409s, `:190` with the pairing candidates and `:201` the outside share-basis re-date; `:335` `planHoldRuling`'s `late_adjustment` (open ideas only; 404, 409); `:399` `applyFounderRulings` hands the approvals and declines to the planner; `:491` a correction after a sale leaves a standing reason (L-6); `:507` `markRulingsApplied` closes a decision once its proposal is no longer open.

**`settlement.js`** — `:192` the endpoint names open proposals as unsettled; `:434` standing reasons on the endpoint and beside the result (L-1, L-6).

**`caParseReport.js`** — `:128` `mergeParseEntries`, `:197` the writer merges in a transaction (L-7). **`dailyCoverage.js`** — `:68` two observations that disagree read uncovered (L-7).

**Test support** — `__testsupport__/caOracle.js`: `:67` the close's coverage facts; `:434` `payloadOf` per ledger; `:474` I-7 `checkAuthority`; `:515` `checkRefusalAtPosting` (L-2 at posting); `:578` `scopedDoubt` (I-6 scoped); `:604` `refusalStands`; `:640` I-6 `check`. `__testsupport__/caSequences.js`: `:388` each accepted ruling's ledgers recorded; `:1024` `generateLate` (Astra's shapes; the refuter's mode); `:1242` `LATE_SHAPES`, `:1244` `REFUTER_SHAPES`; `ASTRA_T2E*` her histories.

**Rows** — `corporateActionLateAsks.astraPlans.test.js` (her four plans, verbatim: 4), `corporateActionLateAsks.test.js` (T2E-01 to T2E-08, the oracle, the founder endpoint: 42), `corporateActionLateAsks.refuter.test.js` (the three refuters' findings, the oracle's, the proposal alert a battery survivor showed unpinned, and the fourth refuter's EQ-1: 43), `corporateActionLateAsks.equivalence.test.js` (NL2c changes nothing stored, and its control: 2; `caSequences.js` `run()` now also returns the store), `corporateActionSequences.late.test.js` (the fixed late cases, 36 shape seeds, 18 refuter-shape seeds, 6 probe seeds and the final soak's 2 seeds: 122).

### 11.4 Readings of the ruling (each a choice the letter left open)

1. **A ruled correction posts the net, and settles a waiting proposal of its id.** `ruled_correction` is unchanged as a ruling (L-1), and L-2 defines the amount any posting for an id takes: owed now, under the ruled payloads and the dated count, less everything received. So when the founder corrects a dividend whose count a late split has also changed, the correction posts the whole net once and the late_basis proposal of that id closes as settled (T2E-03's ruled control: $249.93 in all, one posting of $149.96). The stricter alternative — the correction posts only the amount's difference on the old count and the proposal waits for its own approval — would post twice. Asked as Q-11 below.
2. **A conflict ruling on a sold holding's ambiguous row posts its late entitlement.** L-3 makes a paired row an ambiguity "for a `conflict` ruling". When the founder rules it with a payload, that ruling is the authority for the id on that ledger (I-7 accepts it), and the late entitlement posts at the next close without a second approval. `none` declines it.
3. **"Another candidate pairs with it"** is any OPEN candidate of the symbol, of the proposal's type and payload, dated within the window, wherever it waits on the ledger — an ambiguity record listing that payload, a row waiting on a doubt, a held action, a row kept just outside the sold holding, another open late entitlement (the refuter's R-1: two rows of one close that paired only with each other never named the proposal they both paired with). A settled id stands for nothing. A sold holding's open proposal is also re-screened at every close, listed or not (R-3), so its own id becomes the ambiguity the ruling's L-3 asks for — the endpoint then names `late_id_unresolved` first; a paid dividend's `late_basis`, whose id cannot be re-opened, is refused `late_pairs_with_candidate`. A row kept outside the sold holding that pairs with an open `late_basis` is recorded as a possible re-date of it (P-1), so the founder can rule it: `none` lets the approval post; until then the founder may also decline.
4. **The held path's late dividend stays automatic.** A dividend listed late while the ledger still holds the stock is a receipt, paid on its dated ex-date count (F-8, `main`'s since T1a-2b-3) — not an adjustment. Under L-4 its count now comes from the dated chain.
5. **"Its line"** (L-4): a line holds a price level, not a count. Its level moves by each ratio as before (a division, no rounding); the order of arrival does not change it. The holding, the book's mirror and every later ex-date count take the recomputed count.
6. **The proposal's doubt is dated as the held path dates it.** Nothing is computed on a count in doubt; a doubt dated after a dividend's ex-date cannot change its count and no longer defers it (`ledger.js` `causesOf`'s own dating). L-2's refusal stays wider: any share-basis id dated within the holding refuses the approval.
7. **A sold holding's rejected row is a sticky doubt** (`closedCoverageDoubts`), cleared only by a backfill with a clean report covering the date through the sale, fetched after the doubt was first seen (the third refuter's F-1: a clean document stored before the rejection never saw that row). The backfill now fetches for it (the refuter's R-4: `backfillNeeds` names the sold symbol from the doubt's earliest date), and the clean backfill's rows reach the sold holding's path, so a row the daily build rejected is computed as the backfill lists it. While the vendor keeps listing the bad row the backfill fails, the doubt stays, and the founder may decline the proposal; the fetch is then repeated at every close for the idea's life (registered under the fire-time budget).
8. **Resulted ideas.** `resolve_hold` answers 404 for an idea that is not open (unchanged), so a resulted idea's proposals, and any correction or decision a doubt left pending at its last close, are named in `lateDataUnsettled` and alerted to the end of its look-back.
9. **A decline sticks while the facts stand** (the refuter's R-2). Declined, a proposal is not made again while what the ledger is owed for the id and what it has received are unchanged; nothing waits, and the rows and the result read at full quality. A new late fact — another count (a split listed later), another amount — is a new question: the proposal is made again as `_n`.
10. **A sold holding's doubt holds what a ruling would post** (R-5). The founder's conflict ruling of a sold holding's ambiguous row, and a ruled correction of its paid dividend, wait while that holding's sticky coverage doubt is dated on or before the ex-date or within the window of it; the proposal is still made and named, its approval refused (L-2 ④). A deferred conflict ruling on a holding the ledger no longer has closes **moot** under the existing rule (AR2-RF-4), alerted: **the founder's request is discarded, not kept**, and the record stays open for a new ruling once the doubt clears. Kept pending, it would lock the record while a doubt that may never clear stands. (A ruled correction stays pending, as it always did.)
11. **The oracle's L-2 at posting** (I-7) is not asked of a late entitlement the founder's conflict ruling chose — the ruling is the founder's answer for the id, as on the held path, where the ruled action applies and a new row of its payload is recorded beside it; it may post a close after the ruling, where a doubt deferred it and a ledger still holding the stock kept the ruling pending (the soak's 2120005580). No ruling posts a `late_basis`: every one of those, and every approval's posting, meets L-2.
12. **A conflict ruling covers only the ledgers it names** (Astra's T2D-09, unchanged): a comparison still holding the stock keeps a dividend it was paid while the id was unambiguous there, though the idea's sold holding later recorded the id ambiguous and the founder ruled it `none` there. The oracle now reads each ruling's ledgers as the endpoint stored them; six probe seeds pin it.
13. **A pairing the founder already answered is not asked again.** A share-basis row kept just outside a sold holding that pairs with an action applied within it holds the symbol's proposals (L-2 ③: the count they stand on is in question) and is recorded for the founder — unless the founder's own ruling applied that action after the outside row had shown, which answered the pairing (the final soak's 2120005408).
14. **A ruled share-basis id beside a new id of its date** (the fourth refuter's EQ-1; found after the final soak, so built before this reading was seen). L-5 makes two share-basis ids of one symbol and date one ambiguity, the count held until a conflict ruling. When the founder has already ruled one of them (here, a conflict among its own two ratios) and a different id of the same date is first listed at a later close, the ruled one skips the close's same-date screen, and RFX-2's order decides it: it applies when its id sorts before the new one's (on a sold holding, as history; its ruling applied), and waits when it sorts after (its ruling then closes moot, reading 10). The new id is recorded as usual. While it stands, no dividend of that date is proposed and L-2 ③ refuses every approval, so no money moves either way. L-5's letter reads stricter: the ruled id would hold with the new one. A row pinned that behaviour (§11.9); asked as Q-14. **Ruled: change it.** Built — the ruled id always holds beside an unruled one of its date, whatever the order, until the pair is ruled (§11.15).

**New questions for the founder** (each a reading above; each leaves money where it is until answered):
- **Q-11.** A ruled correction of a dividend a late split also changed posts the whole net once and settles the waiting proposal (reading 1). Or should the correction post only the amount's difference, and the proposal wait for its own approval?
- **Q-12.** A conflict ruling a doubt defers, on a holding the ledger no longer has, closes moot and is discarded (reading 10). Should it instead stay pending, at the cost of locking the record while the doubt stands?
- **Q-13.** A decline stands until a new late fact; then the proposal is asked again (reading 9). Should a decline settle the id for good instead?
- **Q-14.** A share-basis id the founder has ruled, then a different id of the same date first listed after the ruling: today the ruled one applies or waits by the alphabetical order of the two ids (reading 14). Should it always hold, as one ambiguity with the new id, until the founder rules the pair?

**Ruled on the evening of 20 Nov:** Q-11, Q-12 and Q-13 stay as built. Q-14: change it — built (§11.15).

### 11.5 Every branch removed (cited at `df9b7278`)

L-1 and L-8 make the automatic posting paths and the treasury posting for late data redundant. Each is gone:

| `file:line` at `df9b7278` | What went | Why |
|---|---|---|
| `adjustments.js:57` | `ADJUSTMENT_POSTED_TO.TREASURY` and `PAPER_AFTER_RESULT` | L-8: nothing posts to the treasury or a paper ledger |
| `adjustments.js:224`, `:249–252` | `ctx.postedTo` and the `if (postedTo === LEDGER)` arm | every posting is to the ledger now |
| `adjustments.js:438–450` | the automatic `late_entitlement` post | L-1: a proposal (a conflict ruling still posts) |
| `adjustments.js:472–485` | the automatic `late_basis` post (`let received = d.cents; if (basisCents !== received) post(…)`) | L-1: a proposal |
| `adjustments.js:105–120` | `countOnExDate`'s applied-order derivation (the first event dated after the ex-date, plus the later-applied ones) | L-4: the dated chain |
| `close.js:762–837` | `closeResultedIdea`'s posting: `treasuryCents` (`:762`), `toTreasury` (`:767`, `:799`, `:837`), `pendingAmountCorrections` (`:783`), `postedTo` treasury or paper (`:792`), `availableCents` from the treasury (`:793`), `markCorrectionsApplied` (`:802`), the result view on the resulted idea (`:831`) | L-8 |
| `close.js:1121`, `:1127–1130`, `:1131` | the close's treasury and book-cash update from a resulted idea, and its adjustment evidence documents | L-8 |
| `close.js:420` | `postedTo: ADJUSTMENT_POSTED_TO.LEDGER` | one destination |
| `holdRulings.js:164–172`, `:176–188` | `pendingAmountCorrections`, `markCorrectionsApplied` | L-8: a resulted idea's correction is named, never posted |
| `ledger.js:1566–1577` | the C-16 path's corrected-chain branch and its `earlierLate` replay | L-4: `datedCountOn` |
| `ledger.js:718–733` | `shareBasisChainOf` in applied order | L-4: dated order |

The refuter rounds removed no branch. **Redundant, not yet removed** (the battery's one equivalent survivor, §11.9): `adjustments.js` step 3's received-sum fallback for an unpaid id (always $0 under L-1/L-2; proven on 90 histories). It goes in the next round: removing code after the final soak would have restarted the whole proof. (`shareDoubtOn`'s same-date ordering of share-basis rows, listed here before as unreachable under L-5, was not redundant: it decided reading 14. Q-14 then removed it — `adjustments.js:370` at `afd145f6`, a same-date share-basis row ordered by id, RFX-2's — §11.15.)

### 11.6 Every row whose expectation changed, and why

None is a change for complete, on-time, unambiguous data: in each, the data is late (listed after the sale, or after the payment it changes), ambiguous, or the idea had resulted. The three refuter rounds changed no existing row's expectation: every row before them passes unchanged at each of `c569f281` (1,374), `05aa1200` (1,388), `477ae3fb` (1,394) and `e8d51fd6` (1,397).

**L-1 — late money is proposed, then approved (the same amount, one close later):**
| Row | Was | Now |
|---|---|---|
| `FIXED_LATE` `astra-T2D-03`, `astra-T2D-03-sector-fund` | `late_entitlement` $99.97 posted automatically at S3 | proposed at S3 (row below full quality, book unmoved), approved, posted at S4 — $99.97 |
| `FIXED_LATE` `astra-T2D-04`, `astra-T2D-04-reverse` | `late_basis` +$24.99 / −$19.99 posted automatically on both ledgers | proposed on both ledgers, both approved, posted one close later |
| `FIXED_LATE` `review-AR4-A-1` | a late entitlement posted automatically after the founder's 5:4 | proposed after the ruling, approved, posted at S5 |
| corrections: T2D-03 Astra's case; T2D-03 sector fund; T2D-04 Astra's case; T2D-04 reverse; T2D-04 two dividends (4 approvals); the battery's three T2D-03 rows (sale day, before the split, parse missing) | automatic postings | proposed, approved, posted — the same amounts |
| corrections, pure: "debit held" | posted automatically | proposal → approval → held (exceeds cash) → posted when the cash is there |
| corrections, pure: "doubt defers" | posted automatically after the doubt | proposed after the doubt; the approval refused by a blocker; posted after |
| lensA catch-up, OPEN idea | paid once at S5 | proposed once, approved, posted once at S6 |
| lensA AR4-A-6 control (open) | +$24.99 automatic | approved, posted |
| lensA AR4-A-5 "deterministic id collision" | three automatic `late_basis` postings | proposals approved one at a time → three postings (+99.97, −99.97, +99.97), unique ids and evidence documents (without approvals the row would have passed vacuously) |
| lensC P25 | `late_basis` posted once coverage returned | proposed, approved, posted |

**L-2 — the net, posted once:**
| Row | Was | Now |
|---|---|---|
| corrections T2D-05 Astra's case | `[ruled split 0, late_basis 25, ruled dividend 149.95]` | `[ruled split 0, ruled dividend 174.95]` — the same $299.91, the net posted once |

**L-1 with L-6 — a standing reason:**
| Row | Was | Now |
|---|---|---|
| lensA AR4-A-1 + A-4, open, reverse | $49.99 automatic after the ruling; row S5 at full quality | proposal, approved, posted $49.99; row S5 **below** full quality with the standing reason (a reverse split listed after the sale: shares sold differ from shares owed) |

**L-8 — a resulted idea's late data is named only (Q-2 as ruled):**
| Row | Was | Now |
|---|---|---|
| corrections T2D-03 after the result; T2D-03 SPY after the result; T2D-04 after the result | posted to the treasury (or a paper adjustment) | nothing posts; named in `lateDataUnsettled`; an approval answers 404 |
| corrections AR4-B-4 | the next close posted to the treasury | the next close names it |
| lensA a2 upgrade; a2 control (resulted, S6 clean); catch-up RESULTED; AR4-A-6 RESULTED | posted to the treasury | proposal named, `…LEFT_UNSETTLED` alert, treasury unchanged |
| lensC P6e; AR4-C-8 (RFX note) | the pending correction posted to the treasury after the result | named (`correction_pending`), not posted |

**L-4 — the dated chain (same counts):**
| Row | Was | Now |
|---|---|---|
| corrections "the chain replays…" | `countOnExDate` from `split_…` / `holding` | from `dated_chain`, with `also` |
| caOracle conservation | `/shares = receipt chain/` | `/shares = the dated receipt chain/` |

**L-5 — two share-basis ids of one date are one ambiguity (Q-9 answered with a hold):**
| Row | Was | Now |
|---|---|---|
| corporateActions T2A-D02 Astra's case (stock distribution + reverse split, same date) | the distribution held behind the reverse split, then applied | one ambiguity (`same_date_share_basis`); the founder rules both; the same money (4.795684 shares, $19,994.01) |
| corporateActions "two CLEAN share-basis actions of one date apply at once" | applied in order | neither applies, both recorded, the count holds; ruled → applied in order to the same count |
| corporateActions "the mirror case" | the clean reverse split applied beside the distribution's conflict | recorded beside it; nothing applies |
| corporateActions "through the idea's hold set" | `heldBecause [RS@comparison]` | `[RS@comparison, SD@comparison]` |
| fixRound RFX-2 A, B | applied in order, `closedHeldRows []` | one ambiguity; only the dividend waits; the founder reaches both (200); ruled `none` → the dividend proposed on 99.970008 shares |
| fixRound RFX-2 through the result | the result measured | unmeasurable (`idea_unsettled_corporate_action`), both ids named; nothing posts |

**L-7 — the transactional writer:**
| Row | Was | Now |
|---|---|---|
| corrections AR4-B-6 | counted `doc.set` writes | counts `runTransaction` (the writer merges in a transaction); the same assertions (one at a time, at most two merges, a stuck write given up) |

**The dated doubt (§11.4 reading 6):**
| Row | Was | Now |
|---|---|---|
| lensC RF6-X1 | a split conflict dated S2 deferred the S1 dividend's correction | the conflict dated S1 (on the ex-date) defers it; the founder rules the split `none`; the same money ($199.94) |

**The oracle's own rows:**
| Row | Was | Now |
|---|---|---|
| caOracle I-6 T2D-03 | unpaid = rejected | unapproved = a wait (counted); paid without approval = rejected; approved and unpaid = rejected; approved and paid = passes |
| caOracle I-6 T2D-04 | the old payment rejected | unapproved = a wait; approved: the old payment rejected, with the `late_basis` passes |
| caOracle I-6 owed-nothing | no approval | an approval added, so the owed-nothing branch is reached (the unauthorized-money check fires first otherwise) |

### 11.7 The oracle and the generator

**I-6, scoped (Astra's "Oracle" section).** An excuse now has to be a fact that can change THAT ledger's ex-date count or amount for THAT id: the id's own ambiguity; a share-basis id of its symbol dated on or before the ex-date (ambiguous, held, suspected, uncovered); a held debit or a waiting row of the id itself; a sold holding's coverage doubt dated on or before the ex-date or within the window. An unrelated dividend's conflict excuses nothing: her $0.10/$0.20 variant of T2E-04 now checks $516.64 and fails at `df9b7278` ($516.65). Late facts (L-1): money that late data moves is owed only after the founder's approval — or, on a sold holding, the conflict ruling of its row, or a correcting ruling — made after the last late fact. Until then it **waits** (counted, never a pass). Approved but refused by L-2 (`refusalStands`, the product's state read as an excuse only — never as authority) it waits too. In every branch, the money adjustments moved for the id with no approval or ruling in the inputs must be nought: a wait is never a payment.

**I-7 (new).** Every posted adjustment has its authority in the generator's inputs: a `ruled_correction`, an accepted conflict ruling of the id choosing exactly its payload, covering that ledger; a late adjustment, an accepted `late_adjustment` approval naming that ledger and id, or the conflict ruling choosing its payload — each made before the close that posted it — and never more postings than approvals and rulings. **I-7 checks L-2 at posting** (the refuters' oracle gaps), from the inputs alone, for every `late_basis` and every approval's posting — all but a late entitlement a conflict ruling of the id chose, which is the ruling's posting (at its close, or a close later where a doubt deferred it and a ledger still holding the stock kept the ruling pending — the soak's 2120005580):
- **① and ②:** each ambiguity of the id the inputs show at or before the posting close — its own conflict or revision, or a re-date pairing — must have been answered by an accepted conflict ruling made after the ambiguity first showed: of the id itself, or of every other id of the pairing. A ruling made before a pairing showed answers nothing (third refuter O-4); a conflict listed again after the founder ruled it is the one the founder answered (`review-AR4-A-1`). A carved-out re-date, as I-2 excuses it on that ledger, is none.
- **③:** no share-basis id of the symbol dated within the holding ambiguous by the inputs and unanswered (second refuter O-1).
- **④:** the symbol not uncovered at the posting close by the inputs (a failed fetch, a dirty or missing parse report); and, on a sold holding, no row its parse report rejected, dated within the holding and seen after the sale, without a catch-up since (O-2). The harness records each close's coverage facts and passes the holding history.
- Every ruling answers only on the ledgers it covers, as the endpoint recorded them (Astra's T2D-09; O-3).

I-6's `refusalStands` knows the wider pairing (`pairingCandidatesOf`'s set, re-read from the product's state — an excuse, never authority). A conflict ruling's payload and authority, for I-6 and I-7 alike, are scoped to the ledgers it covers.

**Both fail at `df9b7278` on her histories:** her four plans fail there (T2E-01/02/03 at I-7: a `late_entitlement` or `late_basis` posted with no approval; T2E-04 at the scoped I-6), the named seeds 2011202700–07 at I-7, the precision cases at I-6, 2011202612–19 at I-2 (the L-5 marks), the sold-sector T2E-08 at I-7; and with I-7 switched off, I-6 alone still fails T2E-01..03, the named seeds and T2E-08 ("$x moved by adjustments the inputs never approved"). The refuter's harness row fails at `193a3dda` at the new I-7 (L-2 at posting), and the oracle's three unit rows fail on the `193a3dda` oracle.

**Dated conservation (L-4).** A holding's count is the entry count along the dated chain of its applied share-basis receipts (effective date, then phase, then id; six places at each step), whatever order they were applied in; a receipt applied in date order is held to its own before and after.

**The generator.** `generateLate(seed, { shapes: true })` draws from a second stream (so every older seed writes the history it always wrote) one of the six shapes Astra found missing, with the founder's decisions on late proposals (`late` steps, approve 70% / decline 30%) through the real endpoint:

| Shape | Her finding | The history |
|---|---|---|
| `two_dates_one_close` | T2E-01 | two dividends of one payload dated in the sold holding, first listed in one close |
| `moved_across_sale` | T2E-02 | a payload dated after the sale, dropped, then the same payload dated before it |
| `late_split_pending_revision` | T2E-03 | a paid dividend revised (open), then a split dated before it listed with the revision |
| `out_of_order_splits_round` | T2E-04 | a 4-for-5 and a 2-for-1 a session apart, the first listed after the second, then a dividend |
| `opposite_same_date_ids` | T2E-06 | a 10-for-1 and a 1-for-10 of one date, a dividend of it, the price at ×0.10–0.104 |
| `rejected_before_sale_sector` | T2E-08 | a sector comparison, a rejected row dated in the sold holding, then a dividend of it |

`generateLate(seed, { refuter: true })` (a mode of its own, `PF_LATE_SHAPES=2`) writes the independent refuter's three, each with the founder's approval asked for after the close that made the proposal:

| Shape | Finding | The history |
|---|---|---|
| `proposal_then_pair` | R-1 | a sold holding's proposal, then dropped and its payload listed under two other dates |
| `proposal_moved_past_sale` | R-3 | a sold holding's proposal, then dropped and its payload listed dated after the sale |
| `paid_then_pairs_held` | R-1b | a dividend paid on time, a split before it listed late (`late_basis`), then two rows of its payload under other dates within the window |

36 shape seeds and 18 refuter-shape seeds run in every suite; the refuter probe's 6 seeds (they pin the oracle's T2D-09 scoping) and the final soak's 2 are kept.

### 11.8 The soak

**The seeds, chosen before any run.** Fresh: late histories with Astra's six shapes 2120000000–2120005999 (6,000), the refuter's three shapes 2122000000–2122001999 (2,000), ordered histories 2121000000–2121001999 (2,000). Astra's ranges: late 2026112000–2026112999, ordered 2076112000–2076112399, wide 2086112000–2086112159. Every fixed case runs in every shard and in the suite: `FIXED_LATE` (her T2D-03, -04, -05, -12 and the review's), the late soak's kept seeds, 36 shape seeds, 18 refuter-shape seeds, the 6 refuter-probe seeds and the 2 seeds of the soak below. WSL, `TZ=UTC`, Node 20.20.2, one worker per shard, 1,536 MB of heap per shard. After every close and its re-run: I-1 to I-5, conservation on the dated chain, I-7 (with L-2 at posting), then I-6.

**What the soak found.** At `477ae3fb` every group passed except two of the 6,000 shape histories, both caught by this round's own checks:
- **2120005408 (product).** On a sold holding the founder ruled the split of 11-18 (1.5) — after the vendor's 1.5 of 11-20, just past the sale, had shown. The rule added at `05aa1200` for a share-basis row kept outside the holding (found by I-7's ③) still recorded the pairing and held the dividend owed on that count for good; I-6: received $0, owed $112.77. A pairing whose action within the holding the founder's ruling applied after the outside row was first seen is answered, and no longer recorded.
- **2120005580 (oracle).** The founder's conflict ruling chose a sold holding's dividend; a parse rejection deferred its posting one close, and the ruling stayed pending because the comparison still held the stock. I-7's "a ruling applied at this very close" missed it. A late entitlement a conflict ruling chose is the ruling's posting; every `late_basis` and every approval's posting meets L-2.

Both are kept as fixed rows (`corporateActionSequences.late.test.js`, "shape soak seed"), and the whole soak was run again at `e8d51fd6`:

| Run | Seeds | Histories | Sessions | Closes checked | Failures | I-6 checked / excused / waiting / owed nothing | I-7 authorities / L-2 at posting | Founder decisions (late) |
|---|---|---|---|---|---|---|---|---|
| Astra's six shapes, fresh | 2120000000–2120005999 | 6,000 | 60,075 | 114,150 | **0** | 183,730 / 187,905 / 23,892 / 31,156 | 18,954 / 8,228 | approve:200 ×1,674, approve:409 ×2,479, decline:200 ×1,682, decline:409 ×125 |
| the refuter's three shapes, fresh | 2122000000–2122001999 | 2,000 | 20,073 | 38,146 | **0** | 64,554 / 85,070 / 8,546 / 13,228 | 7,602 / 4,478 | approve:200 ×1,639, approve:409 ×2,129, decline:200 ×448, decline:409 ×588 |
| ordered (fresh, then Astra's) | 2076112000–2076112399, 2121000000–2121001999 | 2,400 | 25,305 | 48,210 | **0** | — | — | — |
| Astra's late range | 2026112000–2026112999 | 1,000 | 10,074 | 19,148 | **0** | 36,458 / 15,858 / 6,460 / 2,942 | 1,730 / 0 | — |
| Astra's wide range | 2086112000–2086112159 | 160 | 1,730 | 3,300 | **0** | — | — | — |

Astra's ranges reproduce her counts at the head: late 1,000 histories, 10,074 sessions, 19,148 closes, 2,942 owed-nothing checks; wide 160 histories, 3,300 closes, 43 clean — as her run, and as at `193a3dda`.

**Coverage table 1 — the chain kinds and their pairs** (each history's kinds; a pair counts the histories holding both):

| Run | Kinds seen | Kind pairs seen | Kinds (histories) |
|---|---|---|---|
| Astra's six shapes, fresh | 26 | 299 | late_decision 5,931 · dividend_on_time 5,198 · founder_ruling 4,592 · spy_dividend 4,581 · sale 4,554 · coverage_failure 3,935 · comparison_sector_fund 2,686 · late_split 2,271 · late_after_sale 2,032 · comparison_frozen_basket 1,686 · comparison_same_stock 1,628 · settled_revision_split 1,363 · settled_revision_dividend 1,303 · parse_missing 1,103 · ruled_correction 1,065 · shape_moved_across_sale 1,046 · shape_late_split_pending_revision 1,040 · parse_rejection 1,038 · shape_opposite_same_date_ids 998 · shape_out_of_order_splits_round 978 · shape_rejected_before_sale_sector 974 · shape_two_dates_one_close 964 · ruled_keep 777 · late_reverse_split 736 · late_after_sale_ambiguous 682 · two_dividends_late_split 396 |
| the refuter's three shapes, fresh | 23 | 241 | late_decision 1,981 · dividend_on_time 1,728 · founder_ruling 1,534 · spy_dividend 1,497 · sale 1,326 · coverage_failure 1,298 · late_split 741 · comparison_frozen_basket 696 · late_after_sale 696 · shape_paid_then_pairs_held 674 · comparison_sector_fund 672 · shape_proposal_moved_past_sale 671 · shape_proposal_then_pair 655 · comparison_same_stock 632 · settled_revision_split 455 · settled_revision_dividend 407 · parse_rejection 378 · parse_missing 339 · ruled_correction 313 · ruled_keep 271 · late_reverse_split 253 · late_after_sale_ambiguous 229 · two_dividends_late_split 145 |
| ordered (fresh, then Astra's) | 40 | 149 | dividend 2,331 · SPY:dividend 2,071 · AAPL:dividend 2,055 · split 1,993 · founder_ruling 1,625 · coverage_failure 1,597 · AAPL:coverage_failure 1,482 · AAPL:split 1,451 · SPY:split 1,443 · conflict 1,424 · split_shaped_move 1,402 · redate 1,225 · comparison_frozen_basket 1,217 · revision 1,197 · comparison_same_stock 1,183 · SPY:coverage_failure 1,148 · SPY:conflict 1,066 · AAPL:conflict 1,049 · SPY:split_shaped_move 1,000 · AAPL:split_shaped_move 984 · chain_d02 846 · AAPL:chain_d02 846 · AAPL:redate 841 · purchase_on_ex_date 829 · AAPL:revision 825 · SPY:redate 823 · SPY:revision 810 · backfill_disagrees 501 · SPY:purchase_on_ex_date 425 · chain_d01 416 · AAPL:chain_d01 416 · AAPL:purchase_on_ex_date 404 · chain_c03 399 · AAPL:chain_c03 399 · backfill_agrees 377 · backfill_empty 372 · c04_chain 354 · AAPL:c04_chain 354 · SPY:backfill_disagrees 274 · AAPL:backfill_disagrees 270 |
| Astra's late range | 19 | 163 | dividend_on_time 865 · spy_dividend 779 · founder_ruling 764 · coverage_failure 684 · sale 578 · late_split 404 · comparison_sector_fund 348 · late_after_sale 337 · comparison_frozen_basket 332 · comparison_same_stock 320 · settled_revision_dividend 240 · settled_revision_split 229 · ruled_correction 189 · parse_missing 188 · parse_rejection 177 · late_reverse_split 136 · ruled_keep 134 · late_after_sale_ambiguous 122 · two_dividends_late_split 61 |
| Astra's wide range | 34 | 104 | dividend 158 · AAPL:dividend 144 · SPY:dividend 137 · split 134 · founder_ruling 114 · coverage_failure 106 · conflict 104 · split_shaped_move 99 · SPY:split 99 · AAPL:split 97 · AAPL:coverage_failure 90 · redate 88 · revision 82 · comparison_same_stock 81 · SPY:coverage_failure 79 · comparison_frozen_basket 79 · SPY:conflict 78 · AAPL:conflict 74 · AAPL:split_shaped_move 74 · SPY:split_shaped_move 64 · SPY:redate 63 · AAPL:redate 61 · SPY:revision 59 · purchase_on_ex_date 53 · AAPL:revision 52 · backfill_disagrees 43 · backfill_empty 30 · AAPL:purchase_on_ex_date 29 · c04_chain 26 · AAPL:c04_chain 26 · AAPL:backfill_disagrees 26 · SPY:purchase_on_ex_date 24 · backfill_agrees 23 · SPY:backfill_disagrees 18 |

**Coverage table 2 — each shape: what it reached, and its ordered events on one id and one ledger** (`a → b`: event a strictly before event b on the same id, on a ledger holding its symbol; counted once per history):

| Shape | Histories | Product paths reached (histories) | Distinct ordered pairs | Most frequent ordered pairs |
|---|---|---|---|---|
| `late_split_pending_revision` | 1,040 | proposed 723 · blocked_id_unresolved 448 · declined 209 · posted_on_approval 169 · blocked_share_basis 128 · blocked_uncovered 99 · same_date_share_basis 27 · dated_recount 8 | 183 | `ledger listed → uncovered` 1,999 · `ledger listed → revision` 1,645 · `comparisonLedger listed → uncovered` 1,379 · `comparisonLedger listed → revision` 1,077 · `ledger listed → rule_payload` 827 · `ledger revision → rule_payload` 801 |
| `moved_across_sale` | 1,046 | outside_rows_kept 816 · proposed 545 · closed_holding_redate 513 · standing_reason 257 · blocked_id_unresolved 220 · posted_on_approval 186 · declined 150 · blocked_uncovered 82 · blocked_pairs 81 · late_basis_blocked_pairs 81 · blocked_share_basis 65 · closed_coverage_doubt 23 · same_date_share_basis 9 · dated_recount 1 | 219 | `ledger listed → uncovered` 1,719 · `ledger listed → redate` 1,175 · `comparisonLedger listed → uncovered` 1,108 · `ledger listed → dropped` 1,046 · `ledger redate → redate` 1,006 · `ledger listed → revision` 904 |
| `opposite_same_date_ids` | 998 | same_date_share_basis 946 · proposed 237 · outside_rows_kept 165 · blocked_share_basis 137 · declined 75 · closed_holding_redate 63 · posted_on_approval 63 · standing_reason 44 · blocked_uncovered 26 · blocked_id_unresolved 26 · closed_coverage_doubt 3 · dated_recount 1 | 179 | `ledger listed → uncovered` 2,575 · `ledger listed → same_date_share_basis` 2,006 · `ledger same_date_share_basis → same_date_share_basis` 2,004 · `comparisonLedger listed → uncovered` 1,686 · `comparisonLedger listed → same_date_share_basis` 1,332 · `comparisonLedger same_date_share_basis → same_date_share_basis` 1,332 |
| `out_of_order_splits_round` | 978 | proposed 518 · dated_recount 509 · outside_rows_kept 300 · posted_on_approval 204 · standing_reason 183 · declined 147 · blocked_share_basis 143 · same_date_share_basis 111 · closed_holding_redate 75 · blocked_id_unresolved 65 · blocked_uncovered 62 · closed_coverage_doubt 9 | 190 | `ledger listed → uncovered` 2,456 · `comparisonLedger listed → uncovered` 1,552 · `ledger listed → revision` 610 · `ledger listed → redate` 597 · `ledger uncovered → uncovered` 526 · `ledger redate → redate` 509 |
| `rejected_before_sale_sector` | 974 | closed_coverage_doubt 769 · proposed 701 · blocked_uncovered 673 · outside_rows_kept 575 · declined 231 · standing_reason 199 · blocked_id_unresolved 122 · posted_on_approval 36 · blocked_share_basis 34 · closed_holding_redate 12 · same_date_share_basis 1 | 94 | `ledger listed → uncovered` 1,544 · `ledger listed → revision` 809 · `spyLedger listed → redate` 287 · `ledger uncovered → revision` 283 · `ledger uncovered → uncovered` 255 · `ledger listed → late_declined` 247 |
| `two_dates_one_close` | 964 | closed_holding_redate 617 · outside_rows_kept 542 · proposed 459 · standing_reason 211 · blocked_id_unresolved 211 · posted_on_approval 135 · declined 134 · blocked_pairs 97 · blocked_uncovered 57 · late_basis_blocked_pairs 54 · blocked_share_basis 48 · closed_coverage_doubt 18 · same_date_share_basis 10 · proposal_became_ambiguity 5 | 205 | `ledger listed → redate` 1,902 · `ledger listed → redate_same_close` 1,859 · `ledger redate_same_close → redate` 1,757 · `ledger redate → redate` 1,737 · `ledger listed → uncovered` 1,693 · `comparisonLedger listed → redate` 1,286 |
| `paid_then_pairs_held` | 674 | proposed 481 · blocked_pairs 405 · late_basis_blocked_pairs 405 · posted_on_approval 109 · blocked_id_unresolved 99 · blocked_share_basis 98 · declined 71 · blocked_uncovered 61 · same_date_share_basis 21 | 191 | `ledger listed → redate` 2,287 · `ledger redate → redate` 2,148 · `ledger listed → uncovered` 1,747 · `ledger listed → redate_same_close` 1,512 · `comparisonLedger listed → redate` 1,491 · `ledger redate_same_close → redate` 1,448 |
| `proposal_moved_past_sale` | 671 | outside_rows_kept 518 · proposed 484 · blocked_id_unresolved 410 · closed_holding_redate 365 · blocked_pairs 326 · proposal_became_ambiguity 295 · standing_reason 141 · posted_on_approval 135 · declined 98 · blocked_uncovered 79 · late_basis_blocked_pairs 32 · blocked_share_basis 29 · closed_coverage_doubt 13 · dated_recount 2 · same_date_share_basis 2 | 207 | `ledger listed → uncovered` 1,041 · `ledger listed → redate` 720 · `comparisonLedger listed → uncovered` 697 · `ledger listed → dropped` 671 · `ledger listed → revision` 653 · `ledger redate → redate` 640 |
| `proposal_then_pair` | 655 | proposed 443 · outside_rows_kept 433 · closed_holding_redate 372 · blocked_id_unresolved 284 · blocked_pairs 215 · proposal_became_ambiguity 188 · posted_on_approval 180 · standing_reason 151 · declined 86 · blocked_uncovered 56 · blocked_share_basis 36 · late_basis_blocked_pairs 30 · closed_coverage_doubt 10 · same_date_share_basis 6 · dated_recount 2 | 218 | `ledger listed → uncovered` 1,193 · `ledger listed → redate` 1,072 · `ledger redate → redate` 923 · `ledger listed → redate_same_close` 916 · `ledger redate_same_close → redate` 868 · `comparisonLedger listed → uncovered` 841 |

Distinct ordered pairs across both shape runs: **252**.

**In all: 11,560 generated histories and every fixed case at `e8d51fd6`, 222,954 closes checked, 0 failures.** The six shapes Astra found missing and the refuter's three are each drawn hundreds of times and reach the paths they exist for (coverage table 2).

### 11.9 The mutation battery

**How it ran.** A `git archive` of the code head `e8d51fd6` (LF). 119 mutants: the build's 59, re-anchored on this round's code (five retired because their code went, three re-cut); 25 for the ruling, at least one per L-1 to L-8; 15 for the oracle (I-6 scoped, I-7, L-2 at posting, the dated conservation, the ledger scoping); 20 for the refuters' and the final soak's fixes. Each anchor must occur exactly once, or the mutant is BROKEN and does not run. Each mutant runs the idea book's rows (1,397, all passing at baseline) with a JSON reporter; the verdict is the exit code AND the failing rows' names (load-only failures are BROKEN, never a kill); the files are restored and compared byte for byte. Four instances ran in parallel, each on its own tree. Runner and definitions: the session scratchpad (`battery/run-battery.mjs`, `battery/mutants.mjs`).

**Load.** Under four baselines starting at once, the 60-session evidence-packet row (`evidence.test.js`, "the largest shape stays well under Firestore's 1 MiB document limit", default timeout) timed out and failed two baselines; another session's probe loaded the machine for five minutes. Every kill resting only on that row or on the isolation row IS-3 was re-run alone: one, FR2, then survived.

**Result at `e8d51fd6`: defined 119, ran 119, broken 0, killed 117, survived 2** (NL2c and FR2; FR2's first verdict, a kill by the evidence row above, was load — run alone, it survived). The survivor of the first pass at `477ae3fb`, `L03-count-at-close-not-ex-date`, is now killed by a row pinning the proposal alert to the ex-date count.

**The two survivors, settled.** After this report was first pushed, the founder: "Settle FR2 and NL2c: kill each, or prove with a test that it changes nothing stored."
- **NL2c-net-ignores-received — equivalent, proven by a row.** (`adjustments.js` step 3: what an id not yet paid has received, summed from its own postings, replaced by 0.) Every posting that moves money is a `cash_dividend` adjustment of an id already paid when it posted, and the paid set never shrinks, so where this fallback runs the sum is $0. `corporateActionLateAsks.equivalence.test.js` runs a corpus of histories under a probe copy of `adjustments.js` (counting each time the spot is reached and each time the sum is not $0), under the mutant, and under a control that adds one cent there; each copy marks itself loaded and the row checks the copy ran. Full corpus (`PF_EQUIV_CORPUS=full`: every fixed late history, the kept soak seeds, 36 shape, 18 refuter-shape, 6 probe and the final soak's 2 seeds — 90 histories): **reached 231 times, never non-zero; every stored document of every history identical**; the cent is caught. The suite runs 5 of those histories (reached 3). Redundant under L-1 and L-2: listed for removal (§11.5, §11.12).
- **FR2-share-rows-wait-on-each-other — killed.** (`adjustments.js` `shareDoubtOn`: a same-date share-basis row waits only on one whose id sorts first — RFX-2.) The first version of the row above (`0426efc9`) claimed FR2 equivalent too: since L-5 two share-basis ids of one date are one ambiguity before any doubt check, so the ordering can no longer be reached — and the corpus reached it 0 times. **That was wrong; a proof resting on zero executions proves nothing.** The fourth refuter (§11.10, EQ-1) found the path: a founder-ruled share-basis id skips the close's same-date screen, so when a different id of its date is first listed at a later close, the ordering decides it (reading 14). A probe showed the stored difference: under the code the ruled id applies and its ruling is applied; under the mutant nothing applies and the ruling closes moot. Row `EQ-1` in `corporateActionLateAsks.refuter.test.js` pins today's behaviour through every oracle check I-1 to I-7 (and shows no money moves) and is red under the mutant. Not redundant: off the cleanup list.

**The final battery, with the fast runner from #1101** (`scripts/practice-field/battery/run-battery.mjs` at `a19e40a1`; tiered; 4 trees × 4 workers; the full run at `e8d51fd6` as `--prior`). At `8418716a` — `e8d51fd6`'s product code with the first equivalence row: **defined 119, ran 119, broken 0, killed 117, survived 2 (NL2c, FR2), errored 0, timeout 0, in 20.6 min** (baseline 1,400 rows in 39 files in 2.2 min; 116 mutants decided by the first tier of 6 files). No failing row in any stage came from the equivalence file, so it stood in for no kill (the fourth refuter's EQ-5). `FB6-write-not-bounded` was killed only by a row that timed out again with the battery idle: the row in which a write that never answers is given up — the mutant removes that bound, so the hang is the kill (the `e8d51fd6` run killed it by the same row). Then at `afd145f6`, which only adds the EQ-1 row and narrows the equivalence row to NL2c: **FR2 KILLED by EQ-1, in 1.2 min** (decided by the first tier). The other 118 verdicts carry over, because nothing since `8418716a` changed a product file, the rows that killed the 117 are unchanged, and the equivalence row skips under NL2c's mutant (its anchor is gone). **Final: defined 119, killed 118, 1 survivor — NL2c, proven by test to change nothing stored.** (After the founder's Q-14 ruling, §11.15: FR2 retired — Q-14 removed its code — and `NQ14-ruled-share-basis-ignores-same-date` added and killed; the 45 mutants of the files Q-14 changed were run again at `9301f87f`: 44 killed, NL2c the survivor. Still 118 of 119 killed, 1 equivalent.)

| Group (final, at `afd145f6`) | Defined | Killed | Survived | Broken |
|---|---|---|---|---|
| the build's, re-anchored | 59 | 59 | 0 | 0 |
| the ruling, L-1 to L-8 | 25 | 24 | 1 (NL2c, equivalent) | 0 |
| the oracle | 15 | 15 | 0 | 0 |
| the refuters' and the soak's fixes | 20 | 20 | 0 | 0 |

| Mutant | Item | Verdict | Failing rows (first) |
|---|---|---|---|
| `N1-adjustment-posted-twice` | T2D-03 / L-2 | **KILLED** (5) | corporateActionCorrections.lensA.test.js > AR4-A-5 — each late_basis its own id and evidence document deterministic id collision 2-for-1 (S2), 1-for-2 |
| `N2-rewrite-not-adjustment` | T2D-04 | **KILLED** (73) | corporateActionCorrections.lensA.test.js > AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies a conflict rulin |
| `N3-ambiguous-adjusted-automatically` | T2D-03 | **KILLED** (10) | corporateActionCorrections.lensA.test.js > AR4-A-1 — a share-basis ambiguity recorded on a closed holding holds a later-dated dividend of the same clo |
| `N4-parse-rejection-read-as-covered` | T2D-12 | **KILLED** (11) | corporateActionCorrections.test.js > T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report is a day of doubt Astra's case: |
| `N5-missing-report-read-as-covered` | T2D-12 | **KILLED** (31) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `N6-I6-disabled` | I-6 | **KILLED** (15) | caOracle.test.js > I-6 — every ledger is paid what its holding was owed, from the inputs and its holding history alone T2D-03: a dividend dated while  |
| `L03-window-strict-sale-day` | T2D-03 | **KILLED** (16) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `L03-count-at-close-not-ex-date` | T2D-03 | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > the proposal the founder is told about is owed on the ex-date count (battery survivor L03-count-at-close-not |
| `L03-redate-after-sale-paid` | T2D-03 | **KILLED** (17) | corporateActionCorrections.lensA.test.js > AR4-A-1, A-2 — breadth and the result a1 severity BREADTH: a share-basis POSSIBLE RE-DATE recorded in step  |
| `L03-closed-symbol-doubt-ignored` | T2D-03 | **KILLED** (6) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `L03-resulted-ideas-not-read` | T2D-03 | **KILLED** (18) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `L03-book-mirror-dropped` | T2D-03 | **KILLED** (75) | corporateActionCorrections.lensA.test.js > AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies a conflict rulin |
| `L03-retention-dropped` | T2D-03 | **KILLED** (1) | corporateActionCorrections.test.js > the battery's rows — each a behaviour of this build no other row pins RETENTION: the daily build keeps the symbol |
| `L04-same-date-split-not-late` | T2D-04 | **KILLED** (5) | corporateActionCorrections.lensA.test.js > lens (a) — catch-up pays once catch-up RESULTED idea: S3, S4 missed; a 5/4 dated S1 listed after a $1 paid  |
| `L04b-received-ignores-adjustments` | T2D-04 / L-2 | **KILLED** (1) | corporateActionCorrections.lensA.test.js > AR4-A-5 — each late_basis its own id and evidence document deterministic id collision 2-for-1 (S2), 1-for-2 |
| `L04-doubt-ignored` | T2D-04 | **KILLED** (6) | corporateActionCorrections.lensC.test.js > P6e — a dividend correction deferred at the idea result close single-name idea: correction ruled, line sold |
| `L04-debit-guard-dropped` | adjustment | **KILLED** (1) | corporateActionCorrections.test.js > the adjustment record (pure): a debit larger than its cash is held, and the result view a late-basis DEBIT, appro |
| `L04-reconcile-ignores-adjustments` | I-3 | **KILLED** (76) | corporateActionCorrections.lensA.test.js > AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies a conflict rulin |
| `L05-feed-revision-undetected` | T2D-05 | **KILLED** (36) | corporateActionCorrections.lensC.test.js > P2 — after a split correction, a late dividend paid by the C-16 path reads the stale sharesBefore 5:4 at S1 |
| `L05-unrecorded-correction-accepted` | T2D-05 | **KILLED** (2) | corporateActionCorrections.lensC.test.js > P15 — odd payload shapes on a correction amount as a string, a ratio for a dividend id, both fields, ratio  |
| `L05-correction-refused-422` | T2D-05 | **KILLED** (25) | corporateActionCorrections.lensC.test.js > P2 — after a split correction, a late dividend paid by the C-16 path reads the stale sharesBefore 5:4 at S1 |
| `L05-split-correction-not-on-book` | T2D-05 | **KILLED** (22) | corporateActionCorrections.lensC.test.js > P2 — after a split correction, a late dividend paid by the C-16 path reads the stale sharesBefore 5:4 at S1 |
| `L05-split-correction-no-recompute` | T2D-05 | **KILLED** (3) | corporateActionCorrections.lensC.test.js > P25 — a split correction at a close whose data does not cover AAPL shares and line move once; the late_basi |
| `L05-ruling-pending-forever` | T2D-05 | **KILLED** (9) | corporateActionCorrections.lensC.test.js > C1 — a dividend correction and a rename (or cash delisting) of the holding in the ruling's close rename: th |
| `L12-malformed-envelope-covered` | T2D-12 | **KILLED** (4) | corporateActionCorrections.test.js > T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report is a day of doubt a malformed e |
| `L12-wrapper-reports-every-symbol` | T2D-12 | **KILLED** (3) | corporateActionCorrections.test.js > T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report is a day of doubt the wrapper r |
| `L12-wrapper-at-off` | T2D-12 | **KILLED** (2) | corporateActionCorrections.test.js > T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report is a day of doubt QUARTERLY ISO |
| `L12-backfill-parse-not-required` | T2D-12 | **KILLED** (2) | corporateActionCorrections.test.js > the battery's rows — each a behaviour of this build no other row pins T2D-12: a BACKFILL whose own parse report s |
| `L12-sale-ignores-report` | T2D-12 | **KILLED** (2) | corporateActionCorrections.test.js > the battery's rows — each a behaviour of this build no other row pins T2D-12: a SALE waits on a session whose par |
| `L12-admission-ignores-report` | T2D-12 | **KILLED** (2) | api/cron/practiceFieldIsolation.test.js > T1a-2a — the real sweeps: sales at the window, the lines at the close, and a DRAINING idea book (Amendment E |
| `L12-close-reads-no-report` | T2D-12 | **KILLED** (548) | api/cron/practiceFieldIsolation.test.js > the close sweep: dispatch by kind, and one snapshot per date (B-STAMP) an idea book goes to the idea-book cl |
| `FB1-report-not-tied-to-rows` | AR4-B-1 | **KILLED** (2) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FB3-late-rejection-floor-dropped` | AR4-B-3 | **KILLED** (3) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FB4-query-unfenced` | AR4-B-4 | **KILLED** (1) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FB5-prior-success-overwritten` | AR4-B-5 | **KILLED** (1) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FB6-write-not-bounded` | AR4-B-6 | **KILLED** (1) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FB7-dateless-noop` | AR4-B-7 | **KILLED** (1) | corporateActionCorrections.test.js > the lens (b) review's rows — the report tied to its rows, a late rejection, the fenced query, the stored success, |
| `FA1-same-close-doubt-ignored` | AR4-A-1 | **KILLED** (3) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `FA2-row-ignores-waiting-rows` | AR4-A-2 | **KILLED** (2) | corporateActionCorrections.lensA.test.js > AR4-A-2 — a row waiting on a closed holding is named: below full quality, alerted, and on a resulted idea n |
| `FA2-endpoint-ignores-waiting-rows` | AR4-A-2 | **KILLED** (1) | corporateActionCorrections.lensA.test.js > AR4-A-1, A-2 — breadth and the result a2 severity UPGRADE: the open idea reaches its endpoint while $99.97  |
| `FA2-resulted-waiting-unnamed` | AR4-A-2 | **KILLED** (12) | corporateActionCorrections.fixRound.test.js > RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other RF |
| `FA3-history-only-not-in-force` | AR4-A-3 | **KILLED** (3) | corporateActionCorrections.lensA.test.js > AR4-A-3 / AR4-C-6 — a revision of a history-only split can be answered a revision of a history-only split t |
| `FA4-ruled-id-is-a-doubt` | AR4-A-4 | **KILLED** (4) | corporateActionCorrections.lensA.test.js > AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies a conflict rulin |
| `FA6-resulted-gate-per-symbol` | AR4-A-6 | **KILLED** (2) | corporateActionCorrections.lensA.test.js > AR4-A-6 — on a resulted idea the doubt is per action resulted gate breadth RESULTED: $1 (S1) paid while hel |
| `FC1b-dated-chain-ignores-correction` | AR4-C-1 (re-cut on the dated chain) | **KILLED** (21) | corporateActionCorrections.lensC.test.js > P2 — after a split correction, a late dividend paid by the C-16 path reads the stale sharesBefore 5:4 at S1 |
| `FC3-no-revision-first` | AR4-C-3 | **KILLED** (3) | corporateActionCorrections.lensC.test.js > P1s — P1 for a SPLIT: a correction and an earlier-dated re-date of it on a sold holding, one close the move |
| `FC5-residual-stale` | AR4-C-5 | **KILLED** (3) | corporateActionCorrections.lensC.test.js > P5 — a split correction leaves an open suspicion standing for a stale residual ×0.5 unexplained at S1; 5:4  |
| `FC6-share-correction-moves-sold-line` | AR4-C-6 | **KILLED** (1) | corporateActionCorrections.lensC.test.js > the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-11 (RF4, realistic price): a split corre |
| `FC7-not-entitled-correction-accepted` | AR4-C-7 | **KILLED** (2) | corporateActionCorrections.lensC.test.js > P4 — a founder-ruled NOT-ENTITLED dividend, revised: a correction is accepted that can never post rule $1 o |
| `FC9-founder-seen-ignored` | AR4-C-9 | **KILLED** (2) | corporateActionCorrections.lensC.test.js > P21 — FQ-5 on the CLOSED path: a payload the founder conflict ruling saw reopens on a sold holding conflict |
| `FC11-correction-after-sale-unflagged` | AR4-C-11 | **KILLED** (3) | corporateActionCorrections.lensC.test.js > the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-11 (RF4, realistic price): a split corre |
| `FX1-pending-correction-closes-unseen` | RF6-X1 | **KILLED** (2) | corporateActionCorrections.lensC.test.js > the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) RF6-X1 (FQ-5): a correction a doubt keeps pend |
| `FX2-pending-correction-full-quality` | RF6-X1 | **KILLED** (1) | corporateActionCorrections.lensC.test.js > the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) A dividend correction a doubt defers keeps the |
| `FS1-ruled-id-left-in-hold-set` | soak I-5 | **KILLED** (4) | corporateActionSequences.late.test.js > S-6 extended — the late soak findings, kept as fixed seeds late soak seed 1795729529 |
| `FR1-floor-before-entry` | RFX-1 | **KILLED** (7) | corporateActionCorrections.fixRound.test.js > RFX-1 — a rejected row dated on or before the idea's entry never lowers its covered-through date RFX B-3 |
| `FR2-share-rows-wait-on-each-other` | RFX-2 | **KILLED** at `afd145f6` (1) — survived at `e8d51fd6` and `8418716a` | corporateActionLateAsks.refuter.test.js > EQ-1 — a ruled share-basis id beside a new id of its date: RFX-2's order decides (battery survivor FR2, reachable) |
| `FR3-unsettled-compare-key-order` | RFX-3 | **KILLED** (3) | corporateActionCorrections.fixRound.test.js > RFX-3 — a resulted idea is not rewritten at every look-back close when nothing changed RFX: lateDataUnse |
| `FR4-endpoint-ignores-pending-correction` | AR4-C-8 (RFX note) | **KILLED** (1) | corporateActionCorrections.lensC.test.js > the refuters' rows — RF4, RF5, RF6 (each failed at 994ccc2e) AR4-C-8 (RFX note): a correction still pending |
| `PAIR-FA4+FS1` | AR4-A-4 (equivalence check) | **KILLED** (4) | corporateActionCorrections.lensA.test.js > AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies a conflict rulin |
| `NL1a-proposals-post-without-approval` | L-1 | **KILLED** (114) | corporateActionCorrections.lensA.test.js > AR4-A-5 — each late_basis its own id and evidence document deterministic id collision 2-for-1 (S2), 1-for-2 |
| `NL1b-waiting-proposal-full-quality` | L-1 | **KILLED** (5) | corporateActionCorrections.test.js > T2D-03 — a dividend first listed after the idea's line sale, dated while it held the stock Astra's case: held Nov |
| `NL1c-endpoint-ignores-proposals` | L-1 | **KILLED** (1) | corporateActionLateAsks.test.js > L-1, L-2 — the endpoint names a waiting proposal; a second proposal posts the net owed now less everything received  |
| `NL1d-approval-id-without-proposal` | L-1 (AR4-A-5 re-cut) | **KILLED** (1) | corporateActionCorrections.lensA.test.js > AR4-A-5 — each late_basis its own id and evidence document deterministic id collision 2-for-1 (S2), 1-for-2 |
| `NL1e-decline-ignored` | L-1 | **KILLED** (13) | corporateActionLateAsks.refuter.test.js > R-2 — a decline sticks late_entitlement: declined, the same row listed again opens nothing; the rows read fu |
| `NL2a-close-ignores-blockers` | L-2 | **KILLED** (26) | corporateActionCorrections.test.js > the adjustment record (pure): a debit larger than its cash is held, and the result view a doubt on the count defe |
| `NL2b-endpoint-never-409` | L-2 | **KILLED** (11) | corporateActionLateAsks.refuter.test.js > R-1 — L-2 ② on a sold holding: two rows of one close that pair with each other and with an open proposal wit |
| `NL2c-net-ignores-received` | L-2 | **SURVIVED** — equivalent, proven by test (above) | — |
| `NL2d-pairs-not-a-blocker` | L-2 (2) | **KILLED** (9) | corporateActionLateAsks.refuter.test.js > R-1 — L-2 ② on a sold holding: two rows of one close that pair with each other and with an open proposal app |
| `NL2e-uncovered-not-a-blocker` | L-2 (4) | **KILLED** (6) | corporateActionLateAsks.refuter.test.js > R-4 — a sold holding's coverage doubt can clear: the backfill is fetched for it, and its rows reach the clos |
| `NL2f-closed-doubt-not-sticky` | L-2 (4) / T2E-08 | **KILLED** (12) | corporateActionLateAsks.refuter.test.js > R-5 — a sold holding's sticky coverage doubt holds the count for the founder's conflict ruling too T2E-01's  |
| `NL3a-no-same-close-pairing` | L-3 (T2E-01) | **KILLED** (2) | corporateActionLateAsks.test.js > T2E-01, T2E-02, T2E-03 — late data on a dividend id moves no money without the founder (Astra's named seeds) astra-2 |
| `NL3b-outside-rows-forgotten` | L-3 (T2E-02) | **KILLED** (8) | corporateActionLateAsks.refuter.test.js > R-3 — an open proposal is re-screened at every close: the vendor moves its dividend just past the sale propo |
| `NL4a-no-recount` | L-4 (T2E-04) | **KILLED** (8) | corporateActionLateAsks.astraPlans.test.js > T2E-04 |
| `NL4b-chain-in-applied-order` | L-4 | **KILLED** (10) | corporateActionFinish.test.js > the review's fix round — re-dated and late actions (lens C); coverage rows the battery asked for C3 (pure): a split da |
| `NL4c-book-mirror-not-recounted` | L-4 | **KILLED** (7) | corporateActionLateAsks.astraPlans.test.js > T2E-04 |
| `NL5-same-date-ids-apply` | L-5 (T2E-06) | **KILLED** (19) | corporateActionLateAsks.test.js > T2E-06 (Q-9) — same-date opposite share-basis ids hold: no dividend, no sale (2011202612 to 2011202619) astra-201120 |
| `NL6a-standing-reason-dropped` | L-6 (T2E-05) | **KILLED** (4) | corporateActionCorrections.lensA.test.js > AR4-A-1 + A-4 — an open reverse-split conflict paid over, then the founder's ratio open reverse 1/2 vs 1/3  |
| `NL6b-result-ignores-standing-reason` | L-6 | **KILLED** (3) | corporateActionLateAsks.test.js > T2E-05 (L-6) — `q5-correct-sold-5/4-to-3/2` and its first-listing variant, through liquidation q5-correct-sold-5/4-t |
| `NL7a-no-merge` | L-7 (T2E-07) | **KILLED** (2) | corporateActionLateAsks.test.js > T2E-07 (L-7) — parse observations merge, and doubt sticks dirty-winner-clean-loser: releasing the losing response af |
| `NL7b-disagreement-reads-clean` | L-7 | **KILLED** (1) | corporateActionLateAsks.test.js > T2E-07 (L-7) — parse observations merge, and doubt sticks dirty-winner-clean-loser: releasing the losing response af |
| `NL8-resulted-posts` | L-8 | **KILLED** (2) | corporateActionCorrections.lensC.test.js > P6e — a dividend correction deferred at the idea result close single-name idea: correction ruled, line sold |
| `NL8b-resulted-proposals-unnamed` | L-8 | **KILLED** (8) | corporateActionCorrections.lensA.test.js > AR4-A-1, A-2 — breadth and the result a2 severity UPGRADE: the open idea reaches its endpoint while $99.97  |
| `NF1-doubt-date-blind` | dated doubt (2120900020) | **KILLED** (2) | corporateActionLateAsks.test.js > the planner's doubt in the count is dated as the held path dates it (fix round; the shape soak's 2120900020, 2120900 |
| `NF2-ruled-le-ignores-seen` | P22 (closed ruled late entitlement) | **KILLED** (2) | corporateActionCorrections.lensC.test.js > P22 — a correction of an id settled as a LATE ENTITLEMENT on a sold holding late $1 paid after the sale, th |
| `NO1-I6-unscoped` | I-6 scoped | **KILLED** (3) | caOracle.test.js > I-6 — every ledger is paid what its holding was owed, from the inputs and its holding history alone (fix round) I-6's excuses are S |
| `NO2-I7-disabled` | I-7 | **KILLED** (12) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone an approval-only posting of an id the input |
| `NO3-I6-wait-may-pay` | I-6 (a wait is never a payment) | **KILLED** (2) | caOracle.test.js > I-6 — every ledger is paid what its holding was owed, from the inputs and its holding history alone T2D-03: a dividend dated while  |
| `NO4-conservation-applied-order` | oracle conservation (dated chain) | **KILLED** (9) | corporateActionLateAsks.astraPlans.test.js > T2E-04 |
| `NR1-proposal-not-rescreened` | R-1, R-3 (L-3: an open proposal screened every close) | **KILLED** (7) | corporateActionLateAsks.refuter.test.js > R-1 — L-2 ② on a sold holding: two rows of one close that pair with each other and with an open proposal app |
| `NR2a-pairs-only-redateOf` | R-1b (L-2 ② any open candidate) | **KILLED** (5) | corporateActionLateAsks.refuter.test.js > R-1b — L-2 ② on a held holding: a paid dividend's late_basis and two new rows of its payload approved late_b |
| `NR2b-pairs-ignores-records` | R-1b | **KILLED** (5) | corporateActionLateAsks.refuter.test.js > R-1b — L-2 ② on a held holding: a paid dividend's late_basis and two new rows of its payload approved late_b |
| `NR2c-pairs-ignores-outside-rows` | R-3 | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > R-3 — an open proposal is re-screened at every close: the vendor moves its dividend just past the sale propo |
| `NR3a-decline-not-sticky` | R-2 | **KILLED** (4) | corporateActionLateAsks.refuter.test.js > R-2 — a decline sticks late_entitlement: declined, the same row listed again opens nothing; the rows read fu |
| `NR3b-decline-blind-to-new-facts` | R-2 (a new late fact asks again) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > R-2 — a decline sticks a NEW late fact after a decline is a new question: a split first listed after the dec |
| `NR4a-ruling-ignores-closed-doubt` | R-5 | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > R-5 — a sold holding's sticky coverage doubt holds the count for the founder's conflict ruling too T2E-01's  |
| `NR4b-correction-ignores-closed-doubt` | R-5 (ruled correction) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > R-5 — the same doubt holds a ruled correction; a doubt dated beyond the window holds nothing a ruled correct |
| `NR4c-closed-doubt-undated` | R-5 (dated as the oracle dates it) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > R-5 — the same doubt holds a ruled correction; a doubt dated beyond the window holds nothing control: a reje |
| `NR5-closed-backfill-rows-dropped` | R-4 (rows reach the closed path) | **KILLED** (4) | corporateActionLateAsks.refuter.test.js > R-4 — a sold holding's coverage doubt can clear: the backfill is fetched for it, and its rows reach the clos |
| `NR6-backfill-ignores-closed-doubts` | R-4 (fetched for a sold symbol) | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > R-4 — a sold holding's coverage doubt can clear: the backfill is fetched for it, and its rows reach the clos |
| `NO5a-I7-L2-at-posting-off` | oracle: I-7 L-2 at posting | **KILLED** (8) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone an approval-only posting of an id the input |
| `NO5b-old-ruling-skips-L2` | oracle: only a ruling applied at the posting close answers for it | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone a ruling of the id made BEFORE a later pair |
| `NO5c-own-ruling-any-time` | oracle: an own ruling answers only a pairing it came after | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone a ruling of the id made BEFORE a later pair |
| `NO6-refusal-stands-narrow` | oracle: I-6 excuses the wider pairing refusal | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone through the S-6 harness, held: a ruled divi |
| `NO7-ruling-ledgers-ignored` | oracle: a ruling covers its ledgers only (T2D-09) | **KILLED** (6) | corporateActionSequences.late.test.js > S-6 extended — the independent refuter's shapes (R-1, R-1b, R-3), every close checked I-1 to I-7 refuter probe |
| `NR7-declined-payload-forgotten` | P-2a (a decline keeps the id's payload) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > P-2 — a decline answers the money, not the id: its payload stays one the ledger has seen (a) declined at $1, |
| `NR8-declined-not-in-pool` | P-2b (a declined payload pairs) | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > P-2 — a decline answers the money, not the id: its payload stays one the ledger has seen (b) declined D1 ($1 |
| `NR9-outside-row-not-recorded` | P-1 (an outside row the founder can rule) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > P-1 — a sold holding's late_basis paired with a row kept outside the holding can complete the outside row is |
| `NR10-closed-backfill-skipped-when-held` | P-3 | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > P-3 — a sold holding's clean backfill reaches its path though the comparison still holds the stock same-stoc |
| `NR11-future-outside-rows-ignored` | P-4 (the lookahead) | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > P-4 — R-3 through the daily layer's lookahead: a row dated after the close is screened too D2 proposed (sold |
| `NO8-I7-no-share-basis-check` | oracle O-1 (L-2 ③ at posting) | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > O-1 to O-3 — I-7's L-2 at posting reads ③, ④ and the ledgers a ruling covers O-1: L-2 ③ — a share-basis id d |
| `NO9a-I7-uncovered-close-ignored` | oracle O-2 (L-2 ④: uncovered at the posting close) | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > O-1 to O-3 — I-7's L-2 at posting reads ③, ④ and the ledgers a ruling covers O-2: L-2 ④ — a posting at a clo |
| `NO9b-I7-sticky-rejection-ignored` | oracle O-2 (L-2 ④: a sold holding's rejected row) | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > O-1 to O-3 — I-7's L-2 at posting reads ③, ④ and the ledgers a ruling covers O-2: L-2 ④ — a posting at a clo |
| `NR12a-outside-share-basis-not-recorded` | I-7 ③ finding (2119990011): a share-basis row kept outside the sold holding | **KILLED** (2) | corporateActionLateAsks.refuter.test.js > a share-basis row kept outside the sold holding that pairs with one applied within it holds the proposals of |
| `NR12b-outside-share-basis-not-a-blocker` | I-7 ③ finding: L-2 ③ refusal | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > a share-basis row kept outside the sold holding that pairs with one applied within it holds the proposals of |
| `NO11-own-ruling-after-every-showing` | oracle: a ruling answers the ambiguity it was made after the first showing of (AR4-A-1) | **KILLED** (6) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone a ruling of the id made BEFORE a later pair |
| `NR13-stale-backfill-clears-doubt` | third refuter F-1 (a backfill fetched after the doubt) | **KILLED** (3) | corporateActionLateAsks.refuter.test.js > F-1 — a sold holding's coverage doubt clears only by a backfill fetched after it was seen the idea's own pip |
| `NO12-partner-ruling-any-time` | third refuter O-4 (oracle: a ruling made before the pairing showed) | **KILLED** (4) | corporateActionLateAsks.refuter.test.js > O — the oracle: I-7 checks L-2 at posting, from the inputs alone an approval-only posting of an id the input |
| `NR12c-answered-pairing-recorded` | final soak 2120005408: a pairing the founder ruling answered | **KILLED** (1) | corporateActionSequences.late.test.js > S-6 extended — the shapes Astra found missing (T2E-01 to T2E-08), every close checked I-1 to I-7 shape soak se |
| `NO10-partner-ruling-any-ledger` | oracle O-3 | **KILLED** (1) | corporateActionLateAsks.refuter.test.js > O-1 to O-3 — I-7's L-2 at posting reads ③, ④ and the ledgers a ruling covers O-3: a ruling of the paired id  |

Retired (their code went in this round): `L03-resulted-posts-to-ledger` — L-8 removed the treasury and paper-after-result destinations (close.js closeResultedIdea `postedTo`); replaced by NL8-resulted-posts; `FA5-id-without-events` — L-1 removed the automatic late_basis posting and its key (`basis:<count>:<amount>:<events>`); replaced by NL1d-approval-id-without-proposal (the posting key now names the approved proposal); `FC1-late-dividend-stale-count` — L-4 replaced the C-16 path's corrected-chain branch (ledger.js `const corrected = ratioCorrectionsOf…`) by the dated chain; re-cut as FC1b-dated-chain-ignores-correction on shareBasisChainOf; `FC8-resulted-correction-dropped` — L-8 removed the resulted idea's correction posting (`corrections: corrections[f]`, pendingAmountCorrections); replaced by NL8-resulted-posts; `L04-received-ignores-adjustments` — the anchor `let received = d.cents` went with the automatic late_basis; re-cut as L04b-received-ignores-adjustments on the proposal's receivedCents.

### 11.10 The refuters

**First refuter** (an independent agent; a read-only snapshot of `193a3dda`, after the fixes of L-1 to L-8; told to find a reachable history where late or corrected data moves money without the founder's approval or ruling). **It found none.** It found six readings the build had missed, and one gap in the oracle. Each is fixed, and each has a row in `corporateActionLateAsks.refuter.test.js`, red at `193a3dda`:

| Id | What it found | Fix |
|---|---|---|
| R-1 | On a sold holding, the founder approves D1's proposal; at the next close the vendor lists the same $1 under two other dates. They pair with each other in the close's pre-pass, never with D1, and D1 posts at the next close. | `adjustments.js` `pairingCandidatesOf` (L-2 ②: any open candidate of the type and payload within the window — an open record's payloads, a waiting or held row, a row kept outside the holding, another open proposal), in the blockers and the endpoint; an open proposal is screened at every close, listed or not, so its id becomes the ambiguity L-3 asks for |
| R-1b | The same on a held holding: a paid dividend's `late_basis` approval posts while two new rows of its payload wait as re-dates of each other | the same candidate set (`late_pairs_with_candidate`) |
| R-3 | T2E-02's mirror: an open proposal was never re-screened against a row the vendor moved just past the sale | the screen at every close |
| R-5 | A conflict ruling of a sold holding's ambiguous row posts while that holding's sticky coverage doubt (T2E-08) stands | `rulingDoubtOn`: what a ruling — or a ruled correction — would post waits while the doubt is dated on or before the ex-date or within the window; reading 10 |
| R-2a, R-2b | A decline does not stick: the proposal is made again (`_2`); a declined `late_basis` every close, and the result reads unmeasurable | a decline stands while what is owed and received are unchanged; reading 9 |
| R-4 | A sold holding's coverage doubt could never clear: the backfill fetched only held symbols, and a backfill's rows never reached the sold holding's path | `backfillNeeds` names it; a clean closed backfill's rows join the session's rows, tagged |
| oracle | I-7 accepted an approval L-2 must refuse | I-7 checks L-2 at posting from the inputs (§11.7) |

**Second refuter** (an independent agent; a read-only snapshot of `c569f281`, the diff of the first refuter's fixes; the same brief). **It found no money moved without the founder's approval or ruling** (90 fresh generated histories passed I-1 to I-7 after every close). It found three histories where an approval posted while an L-2 refusal stood — each caught by the new I-7 — two secondary breaks, and three oracle gaps. Each is fixed, with a row, red at `c569f281`:

| Id | What it found | Fix |
|---|---|---|
| P-2a | A declined $1 proposal; the vendor relists the id at $2: a fresh `_2`, approvable, posts $199.94 | a decline answers the money, not the id: the last declined late entitlement of an unsettled id keeps its payload, so another payload is a revision (a conflict record, `revisedFrom.declined`) |
| P-2b | A declined $1 proposal; the vendor lists $1 a session later under another date: a fresh proposal, approvable | the declined payload is in the re-date pool: both ids are recorded |
| P-4 | R-3 through the daily layer's two-day lookahead: a row dated after the close was filtered out, so the approval posted at the close whose feed showed the move | the closed path keeps and screens rows dated after the close |
| P-3 | R-4's union was skipped whenever a comparison still held the stock: the net missed the split the backfill listed ($99.97 instead of $124.96) | skipped only where the coverage loop already joined that symbol's backfill rows |
| P-1 | A sold holding's `late_basis` paired with a row kept outside the holding could never complete: refused for good, and no record to rule | the outside row is recorded as a possible re-date of it (`outsideHolding`); ruled `none`, the approval posts |
| O-1, O-2, O-3 | I-7's L-2 at posting read no share-basis (③) or coverage (④) fact, and a partner's ruling ignored the ledgers it covers | I-7 reads ③ and ④ from the inputs, and every ruling only on its ledgers (§11.7) |

**Found by the new I-7 ③ itself** (shape seed 2119990011, in every suite, and probe seed 2120900156): on a sold holding, a reverse split applied within the holding paired with one of the same ratio dated just after the sale — kept as an outside row, refused by nothing — and a `late_basis` on the count it set posted on an approval. Fixed as P-1 is: while a proposal of the symbol waits, such an outside share-basis row is recorded (`outsideHolding`), and L-2 ③ refuses on an open share-basis re-date whose other id is dated within the holding (blockers and endpoint). Also from the oracle's own rows: a ruling answers an ambiguity it was made after the first showing of (a conflict listed again at later closes is the one the founder saw — `review-AR4-A-1`).

**Third refuter** (an independent agent; a read-only snapshot of `05aa1200`, the diff of the second refuter's fixes; the same brief). **It found no money moved without the founder's approval or ruling on that diff**; 3,600 fresh generated histories (1,200 each of the shape, refuter and plain generators) passed I-1 to I-7 after every close. It found one product defect, in code this round had not changed but its new I-7 check surfaced, and one oracle gap. Both are fixed, with rows red at `05aa1200`:

| Id | What it found | Fix |
|---|---|---|
| F-1 | A sold holding's doubt is cleared by any clean backfill covering its date. A clean document stored *before* a later rejection — the one fetched for an earlier doubt, or another idea's — cleared that rejection too, while the vendor still listed the row malformed (the refetch failed, and a failure never replaces a success). The approval posted $99.97. Reached through the idea's own backfill pipeline. | `close.js` `withClosedCoverageDoubts`: a backfill clears a doubt date only when it was fetched after the doubt was first seen (its `to` later than the doubt's `seenOn`). A row shows the vendor correcting the row, the next pass clearing the doubt, and the approval posting. |
| O-4 | The oracle let a ruling made before a pairing showed — the founder's own split, or a conflict ruling of the other id — answer it (the product refused; the oracle was only lenient) | the other id's ruling must be made after the pairing first showed |

It also checked that P-1's outside record, ruled with a payload, closes moot and that `none` then lets the approval post the net once. **Not read by another refuter:** F-1's one condition (it can only make a doubt harder to clear), O-4's bound (it can only make the oracle refuse more), and the final soak's two fixes (§11.8: one condition that stops recording a pairing the founder answered, and I-7's gate for a ruled late entitlement). All pass the folder, the probes and the whole soak at `e8d51fd6`.

**Fourth refuter** (an independent agent, read-only and running nothing — the battery was running; on `git diff b0539c4a 8418716a`, the first equivalence row; told to break the claim that the battery's two survivors change nothing stored). **NL2c's claim held**: it checked every posting path, and that every importer of `adjustments.js` gets the swapped copy. It found:

| Id | What it found | What was done |
|---|---|---|
| EQ-1 | FR2 is reachable and changes what is stored (no money): a founder-ruled share-basis id beside a new id of its date | confirmed by a probe; row `EQ-1` pins today's behaviour and kills FR2 (§11.9); reading 14, Q-14 |
| EQ-2 | FR2's equivalence rested on a spot reached 0 times: an empty proof | FR2 dropped from the equivalence row |
| EQ-3 | the anchor check lets the row skip if the line is reformatted | kept, with the reason in the file: an unconditional anchor check would itself falsely kill NL2c's mutant in the battery |
| EQ-4 | the control accepted any error; nothing showed the mutant copies were the modules that ran | the control must be refused by I-6 or change a stored document; every copy marks itself loaded and the row checks the mark |
| EQ-5 | the row could fail under another mutant and count as that mutant's kill | checked in the final battery: no failing row in any stage came from it |
| EQ-6 | the header called NL2c unreachable (it is reached 231 times) and stated its invariant loosely | the header states the invariant: every posting that moves money is a `cash_dividend` adjustment of an id already paid |

**Not read by another refuter:** the EQ-1 row and the narrowed equivalence row (test files only; no product file changed).

### 11.11 The checks

At the product code head `e8d51fd6`, then again at the final code head `afd145f6` (the rows marked `at afd145f6` in the table). Between them only test files changed (`0426efc9`, `8418716a`, `afd145f6`: the battery's survivors, §11.9), so at `afd145f6` the suite, the lint gate and the build were run once more. The rules suite, the differentials, the cron trace, the planted backfill and the end-to-end dump were not, because nothing they read changed after they passed at `e8d51fd6`. (On the earlier report-only heads `94d5d47c` and `b0539c4a` the lint gate and the build were run again, both exit 0.) After the founder's Q-14 ruling: the suite, lint gate, build and rules on the merged tree, and the suite, lint gate and build at the final code `9301f87f`, all exit 0 — §11.15.

| Check | Where | Result |
|---|---|---|
| The idea book's rows (`api/_utils/practiceField`, `api/practice-field`, the two Practice Field cron files, the protected-store scan) | Windows | 38 files, **1,397 of 1,397** pass |
| Full suite: `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | WSL, Node 20.20.2, lock `e457c10d0317` | **exit 0** · `Test Files  1591 passed \| 13 skipped (1604)` · `Tests  36652 passed \| 179 skipped (36831)` |
| `npm run lint:gate` | WSL | **exit 0** |
| `npx vite build` | WSL | **exit 0** · `✓ built in 19.70s` |
| `npm run test:rules` | WSL | **exit 0** · `Test Files  46 passed (46)` · `Tests  841 passed (841)` |
| Full suite at `afd145f6`, the same command | WSL, Node 20.20.2, lock `e457c10d0317` | **exit 0** · `Test Files  1592 passed \| 13 skipped (1605)` · `Tests  36655 passed \| 179 skipped (36834)` — one file and three rows more: the equivalence row (2) and EQ-1 |
| `npm run lint:gate` at `afd145f6` | WSL | **exit 0** |
| `npx vite build` at `afd145f6` | WSL | **exit 0** · `✓ built in 17.10s` |
| The quarterly differential: 17 scenarios × the mode off and on, 4,000 default build sets, the prompt bytes | Windows, `main` `41c04cd2` against the head | **36 of 36 identical** |
| Astra's cron trace | same | **40 of 40 identical** |
| The planted backfill (100 planted shares against 200 from the vendor, the mode off and on) | same | **4 of 4**: no quarterly reader sees it (100 / 200 as `main`) |
| The end-to-end synthetic run's dump | `main` against the head | **byte-identical**: 443,533 bytes, SHA-256 `abcf8420…ed9` |

(At `477ae3fb` a first WSL run exported the soak's 1,536 MB heap cap to every step — tooling, now scoped to the soak steps: the suite passed under it, and `vite build` died at the cap. Every check above ran without it.)

The differential, cron-trace and planted-backfill evidence files are byte-identical to those of `193a3dda`; `05aa1200` and `477ae3fb` gave the same. **Complete, on-time, unambiguous data moves money exactly as `main` does.**

### 11.12 The register, updated

**Astra's review (`20261120_ASTRA_REVIEW_T1A2B4.md`):**

| Id | Status | Row |
|---|---|---|
| T2E-01 two dates, one close, a sold holding | **Fixed** (L-3): both ids recorded, nothing proposed; $0 until a ruling | `ASTRA_T2E` plan 1 verbatim; named seeds 2011202700–07; `corporateActionLateAsks` T2E-01 rows |
| T2E-02 a dividend moved back across the sale | **Fixed** (L-3): the outside row kept; the pair recorded; $0 until a ruling | plan 2 verbatim; T2E-02 rows; R-3 (the mirror order) |
| T2E-03 a late split on a dividend awaiting a ruling | **Fixed** (L-1, L-2): $99.97 kept; the ruled control $249.93 in all, the net posted once ($149.96) | plan 3 verbatim; T2E-03 rows |
| T2E-04 out-of-order splits round to another cent | **Fixed** (L-4): $516.64 on every affected ledger and the book, both orders | plan 4 verbatim; `precision-4/5-2/1-3.23` both orders; the $0.10/$0.20 variant (I-6 scoped) |
| T2E-05 a correction after a sale | **Fixed** (L-6): from the correction on, every row, the endpoint and the result below full quality, the reason beside the result; the same for a split first listed after the sale | `q5-correct-sold-5/4-to-3/2` through liquidation, and its first-listing variant |
| T2E-06 opposite same-date split ids | **Fixed** (L-5): a hold at $10.20 and $10.40, no dividend, no sale, until a conflict ruling (Q-9 answered with a hold) | named seeds 2011202612–19; T2E-06 rows |
| T2E-07 a losing build's clean report | **Fixed** (L-7): observations merge in a transaction; the rejection stays; two that disagree read uncovered | `dirty-winner-clean-loser` (the real daily builder, two runs, a gated loser); the merge unit rows |
| T2E-08 a rejected in-holding row forgotten once sold | **Fixed** (L-2 ④): a sticky `closedCoverageDoubts`; $0 and below full quality on both arms; clears by a clean backfill (now fetched — R-4) | `sold-sector-rejected-Tue-dividend-Wed` and its same-stock control; 409 (4) |
| I-6's excuses too wide | **Fixed**: scoped; I-7 added; both fail at `df9b7278` | §11.7 |
| Fire-time budget under a stalled report write | **T5** (recorded, not built) | — |

**Recorded for T5 (not built):**
- **The fire-time budget under a stalled report write** (Astra's observation). Also under it: a sold symbol whose vendor keeps listing the bad row is now backfilled at every close for the idea's life (R-4's fetch), each a failed attempt while the row stays bad.
- **A founder screen for approvals** — today the founder acts through `resolve_hold` by record id; the proposals are on the ledger (`lateProposals`), named in the alerts, the row and the endpoint.
- **Q-1's cleanup** — parse reports outlive the 120-day cleanup of the daily documents.
- **Q-6, revisions across a rename** (AR4-C-4): should FQ-11's revision detection follow rename aliases, as the re-date match does? Ruled T5 (20 Nov, evening).

**The founder's questions after the ruling:** Q-2 as ruled (L-1: open ideas only; L-8: a resulted idea's late data is named and alerted only); Q-5 answered by L-6; Q-9 answered by L-5 (a hold); Q-1's sign-off for `practiceFieldCaParseReports` still before the switch, its cleanup T5. **Ruled on the evening of 20 Nov** (§11.15): Q-3 accepted; Q-4 held and alerted, no override yet; Q-6 T5; Q-7 holds until a backfill or a ruling; Q-8 keep the extra ruling; Q-10 keep; Q-11, Q-12 and Q-13 stay as built; Q-14 changed — built (§11.15).

**Cleanup for the next round (no money, no behaviour):** remove the branch the battery found redundant, step 3's received-sum fallback (§11.5, §11.9); give `evidence.test.js`'s 60-session packet row an explicit timeout — under parallel load it times out at the default, failed two battery baselines and made one false kill.

**Raised by this fix round (each a reading in §11.4, none moves money):**
- A paid dividend whose only pairing candidate is a row kept outside the sold holding has no record the founder can rule; its `late_basis` approval is refused, and the founder's exit is to decline it.
- A conflict ruling on a sold holding that a doubt defers closes moot (AR2-RF-4's rule): the founder's request is discarded, and the record takes a new ruling once the doubt clears.
- A ruled share-basis id beside a new id of its date applied or waited by the order of the two ids (reading 14). Ruled (Q-14: it always holds until the pair is ruled) and built (§11.15).
- The oracles assume the generator's rows, each dated on or before the close that lists it. A dividend listed before its ex-date is screened by the product only from that date (it pairs then), while the input oracle would mark it at listing; outside the soak.

### 11.13 Status

**What this round answers.** Astra's eight findings are fixed, each with a row that fails at `df9b7278` (§11.12); the founder's ruling L-1 to L-8 is built as worded, with thirteen readings where the letter left a choice (§11.4); the oracle is scoped and I-7 added, both failing at `df9b7278` on her histories (§11.7); three refuters found no money moved without the founder, and everything else they found is fixed (§11.10); the battery kills 118 of 119 mutants, and its one survivor is proven by test to change nothing stored (§11.9); the founder's rulings of 20 Nov (evening) are recorded and Q-14 is built, with the one refuter's money finding fixed (§11.15); the end-to-end dump and both differentials are identical to `main`'s (§11.11).

**What stays before the switch:** Astra's review of this round; the founder's Q-1 sign-off for `practiceFieldCaParseReports` (Q-2 to Q-14 are all ruled now, §11.12, §11.15); the T5 register (§11.12); and the switch itself, by its own PR. This round changes no flag, pin, rule or index; `PRACTICE_FIELD_MODE` stays `'off'`; `mandateUniverseSnapshot.js` and `mandateCorporateActions.js` are untouched.

**Status: fixed, refuted three times (and a fourth time, narrowly, on the battery's survivors), checked. Dark. Draft PR only; not merged.**

### 11.14 Why this round took about seven and a half hours, and what changes

**The founder's verdict stands: this was too long.** The original T1a-2b-4 build took about 4 hours; this fix round took about 7½ hours of working time on 20 Nov (11:00–19:05 CT, less a 25-minute pause at 17:20). Building the fixes was not the slow part. Proving them, three times over, was.

**Where the time went** (commit times, CT):

| When | What | Time |
|---|---|---|
| 11:00–12:41 | Read the review; Astra's review committed; her histories and the oracle first (red at `df9b7278`); L-1 to L-8 built; the shapes; rows for the battery (`16408f50` … `193a3dda`) | **~1 h 40 min** — all the fixes the prompt asked for |
| 12:41–13:37 | First soak; first battery started on code that would still change (stopped at 17 of 88, thrown away); first refuter (~15 min); its 7 findings fixed with rows (`c569f281`) | ~1 h |
| 13:37–14:19 | Second refuter (~21 min) on the first one's fixes; 5 findings fixed (`05aa1200`) | ~40 min |
| 14:19–15:16 | Third refuter (~45 min) on the second one's fixes; 2 findings fixed (`477ae3fb`) | ~1 h |
| 15:16–16:02 | Linux suite, lint, build, rules (run twice: a heap cap I set for the soak killed the build); the full soak, slowed by a battery running beside it; the soak found 2 more (`e8d51fd6`) | ~45 min |
| 16:02–17:20 | Every check again at `e8d51fd6`; the soak again (~45 min); the battery started a third time — one half never started (a shell slip), then re-split into four | ~1 h 20 min, paused at 69 of 119 mutants |
| 17:45–19:05 | The remaining 50 mutants on four instances — two baselines failed under load and restarted, one false kill re-run alone (~1 h); the report, push and PR (~15 min) | ~1 h 20 min |
| 20:53–22:35 | After the first push: resumed; the founder's follow-up (relayed at 21:37) — settle the battery's two survivors, with the fast runner from #1101. The equivalence row (a 90-history run included); the final battery at `8418716a` (20.6 min) beside a narrow, read-only fourth refuter (~18 min); the refuter showed FR2 reachable — a probe, a row that kills it, the equivalence row narrowed (~25 min); FR2 alone at `afd145f6` (1.2 min); the suite, lint and build once, at the frozen head; the report and push | about 1 h 40 min |

**Why** — in order of cost:
1. **Every code change restarted the whole proof.** One full verification pass here — the soak (11,560 histories, ~45 min), the mutation battery (119 mutants, each re-running all ~1,400 idea-book rows: 2–4 hours), and the Linux suite with lint, build and rules (~20 min) — costs three to five hours on this machine. The code changed five times after that proof had begun.
2. **I ran three refuters where the prompt asked for one.** Each round's fixes were new code no one had read, and the prompt's purpose was that no code reach Astra unread, so I kept going. Each round found real defects — none moved money without the founder, all were narrower readings of L-2 and L-3 — but each round cost 40–60 minutes and reset the proof. The second and third rounds together cost about two hours. The right call was one refuter, its fixes, and the remaining risk named for Astra's review.
3. **The battery is built to be slow.** It re-runs every idea-book row for every mutant, though a mutant of one file can only be killed by the rows that reach that file. It is the long pole of every round.
4. **My own mistakes cost about an hour:** the battery started twice before the code was final (37 results thrown away); one battery half never started because of how I chained a background command; a heap cap exported to every WSL step OOM-killed `vite build` and forced a second suite and build; a few of my own oracle rows had the founder ruling before the ambiguity it answered, and needed a second pass.
5. **Runs competed for the machine, and one row is load-sensitive.** The soak and the battery ran side by side (each slowed: ~6 min per mutant instead of ~3); another session's probe briefly loaded it too. Under that load a heavy evidence row timed out: it failed two battery baselines (each a restart) and made one false kill, which had to be re-run alone.

**What changes** (recorded as working rules; the first two apply from the next round):
- **Freeze, then prove once.** Fixes → targeted rows and 300-history probes → the refuter → its fixes → freeze → one soak, one battery, one Linux suite at the end. The battery never starts before the code is frozen.
- **One refuter, as the prompt says.** A second round only if the first finds money moving without the founder; otherwise its fixes and any remaining risk are named in the report for the reviewer. The report says so explicitly.
- **A fast battery** — each mutant runs only the rows that reach the file it changes, the full row set only to confirm a survivor; four instances in parallel. Built in its own session as #1101 (draft), and used for this round's final battery: 20.6 minutes for all 119 mutants (below).
- **The tooling lives in the repo**, not in a session's temporary folder that each session rebuilds (soak scripts, battery, differentials, report-table generators).
- **For the founder's prompts** (a suggestion): size the proof to the round — for a fix round, e.g. a 1,000-history soak plus every fixed case, and the battery limited to the mutants of the changed files; the full 8,000-history soak and full battery once, before the switch. A time budget in the prompt ("past three hours, stop and report what is left") would have cut this round at its natural stopping point, after the first refuter.

**The tail after the first push, and what it shows.**
- **The fast runner did what it was built for.** The whole battery, 119 mutants, took 20.6 minutes, against 2–4 hours for the old runner on this machine. After the last change only the one affected mutant was re-run (1.2 min), because no product file had changed. (#1101 measured 9.1 min with a prior at `e8d51fd6`; this run's baseline found its slowest file at 90 s, against 28 s an hour later, so the machine was busier during it — not investigated.)
- **Checks ran once, at the frozen head, and only those whose inputs changed:** the suite, the lint gate and the build. The rules suite, the differentials and the soak were not repeated: no product file changed after they passed.
- **What cost time was my own first equivalence row.** It declared FR2 unreachable because the corpus never reached it — and a proof that rests on zero executions proves nothing. The narrow refuter caught it in one read; the fix cost a probe, a row and a one-mutant re-run (~30 min). Unchecked, it would have reached Astra as "redundant code, listed for removal", and removing that code would have changed stored behaviour.
- **Rule added:** an equivalence proof must show the spot reached before it may claim anything; "never reached" is a question for a refuter, not a proof.

### 11.15 The founder's rulings of 20 Nov (evening), and Q-14 built

**The rulings** (the founder, 20 Nov 2026, 22:42 CT, verbatim):

> Founder rulings: Q-11, Q-12 and Q-13 stay as built. Q-3: accepted. Q-8: keep the extra ruling. Q-10: keep. Q-4: held and alerted, no override yet. Q-6: T5. Q-7: holds until a backfill or a ruling. Q-14: change it. A ruled share-basis id beside a new id of the same date always holds, as one ambiguity with the new id, until the founder rules the pair, whatever order the ids sort in. Meanwhile no dividend, sale or approval uses the count.

| Question | Ruling | What changes |
|---|---|---|
| Q-3 retention's reach (AR4-B-2) | accepted | nothing |
| Q-4 held debits | held and alerted, no override yet | nothing |
| Q-6 revisions across a rename (AR4-C-4) | T5 | recorded in the T5 register (§11.12) |
| Q-7 a rejected dividend row with no amount (AR4-B-3) | holds until a backfill or a ruling | nothing |
| Q-8 a split correction under a standing suspicion (AR4-C-5) | keep the extra ruling | nothing |
| Q-10 unmeasurable for good | keep | nothing |
| Q-11, Q-12, Q-13 (§11.4) | stay as built | nothing |
| Q-14 a ruled share-basis id beside a new id of its date (reading 14) | change it | **built — below** |

**Q-14, as one change** (`6c8daebb`). One predicate, `ledger.js` `sameDateUnruled` — the other share-basis ids of an action's symbol and effective date that the founder has not ruled at this close — asked by both paths:
- **Held** (`applyLedgerActions` → `causesOf`): a ruled share-basis action waits on any such id — recorded, held on any ledger of the idea, or listed in the same call — whatever the two sort. Before, it waited only on one that sorted first, and never on one listed in the same call. Its ruling stays pending while its record stands, so the pair applies at the close the founder rules the other id.
- **Sold** (`adjustments.js` `handle`): the same, over the rows waiting on a doubt, the open records of unsettled ids and the rows listed now. `shareDoubtOn` no longer orders same-date share-basis rows by id (RFX-2's order — the code the battery's FR2 mutant cut): unruled, two such ids are one ambiguity (L-5, recorded before that check); ruled, Q-14 holds.
- **Readings** (each a choice the letter left open). *"Rules the pair"*: the other id is ruled too — a payload or `none` — or otherwise settled. *"A new id"*: any other share-basis id of the symbol and date that is unsettled and not ruled at the close, whenever it was first listed. On a sold holding a deferred ruling closes moot (Q-12, as built), so the founder rules the two ids before one close; on a held holding the first ruling waits, pending, for the second.
- Dividends, sales and approvals: the ruled id holds through the existing hold — the held path's blocked items and unresolved symbol, the closed path's open record and L-2 ③ — so nothing uses the count meanwhile; the rows show it.

**Rows** (`corporateActionLateAsks.refuter.test.js`, describe "Q-14"; EQ-1 updated): both id orders on a sold and on a held holding —
- sold, the ruled id sorts first (EQ-1): it holds and its ruling closes moot; a late $1 dividend is never proposed; nothing posts; the pair ruled, it applies as history;
- sold, the ruled id sorts after: the same;
- held, each order: the ruled id holds with its ruling pending; no dividend, no sale at a window below the line, the count unmoved; the founder rules the new id, and the pair applies, the dividend paid on the ruled count (I-6 checks the amount).

Where the ruled id sorts first, the rows fail at `afd145f6` (it applied); where it sorts after, it already held there, and the rows pin it, so the rule stays order-free.

**The mutant:** `NQ14-ruled-share-basis-ignores-same-date` (`sameDateUnruled` returns nothing) — **KILLED** by three of the Q-14 rows. **FR2 retired**: its code went (Q-14 removed the same-date order by id).

**The one refuter pass, on the Q-14 change only** (an independent agent; read-only, nothing run; on `git show 6c8daebb`). The founder: "Fix what it finds only if money moves, and record the rest."

| Id | What it found | Money moves? | What was done |
|---|---|---|---|
| Q14-1 | On a sold holding, one close lists a 1-for-2 once and a split of the same date two ways. The pre-pass leaves the two-way id out (a conflict, recorded only at its own turn), so the 1-for-2, sorting first, met no record and applied, unruled, as history — the count a ruling of the split, and then a late dividend's approval, stood on. Predates Q-14 (L-5's same-date screen on the closed path). | **yes** — confirmed by a probe: the input oracle's I-2 refuses the unruled move at that close | **fixed** (`9301f87f`): the screen also meets any other share-basis id listed at the same close and unsettled, so both ids are one ambiguity, as in the mirror order. Row Q14-1, red at `6c8daebb`. |
| Q14-2 | Q-14 treats a same-date id as ruled when any founder action supplies it — a coverage-gap row, or a pending founder split — so a conflict-ruled id may apply beside it; the other id is then recorded beside the applied one, and dividends, the sale and approvals wait on that record. | no | recorded |
| Q14-3 | A held holding with a founder split for a suspicion and a conflict-ruled id of the same date can apply both (×4) when the conflict's id sorts after `split_…`. Predates Q-14, which cannot reach it. The only share-basis type that sorts after `split_…` is `stock_distribution`, and no feed parser emits one (`mandateCorporateActions.js` lists splits as `split` or `reverse_split`); in the reachable order the conflict explains the record and the founder split is moot (×2). | not reachable from the feed today | recorded for the round that first parses stock distributions |
| Q14-4 | On a sold holding, the moot alert for a Q-14 deferral reads as for any moot ruling ("takes `none`") and does not name the same-date partner; the founder must rule both ids before one close, and nothing says so. | no | recorded (the founder screen in T5 should show the pair) |
| Q14-5 | A held holding with a refused share-basis record of the same date (an applier-refused ratio, not replayed) holds a ruled id at every close, with no record the founder can rule; before, it applied when it sorted first. The refused record already held the holding (C-6). | no | recorded |
| — | Unpinned: the sold path's listed-now rows (one guard where the partner is a same-close conflict sorting after the ruled id) | — | **row added** (red with that branch removed); the `closedHeldRows` and other-ledger branches stay unpinned by a row of their own |

It found nothing in the removed `shareDoubtOn` clause: every unruled share-basis row on a sold holding passes the L-5 screen first. **Not read by another refuter:** the Q14-1 fix (one array joined into the screen) and its two rows.

**The merge:** `origin/main` `cf35151b` (#1099, #1100) merged in at `f1d396c5`, no conflict; it touches no Practice Field file and nothing the idea book reads.

**The battery** (the fast runner from #1101, `--prior`), the affected mutants only — every mutant with an edit in a file Q-14 changed (`adjustments.js`, `ledger.js`): 45, NQ14 among them. At `f1d396c5` (Q-14 and the merge): 45 run, 44 killed, 1 survived (NL2c), in 4.8 min; NQ14 killed by three Q-14 rows. After the Q14-1 fix, at `9301f87f`: **45 run, 44 killed, 1 survived (NL2c), 0 broken, 0 errored, in 8.0 min** (baseline green: 1,405 rows in 39 files); NQ14 killed by four Q-14 rows in the first tier. The other 74 mutants have no edit in a file Q-14 changed, and keep their verdicts: killed at `8418716a` by rows unchanged since. NL2c's equivalence was proven again at the new code: 90 histories, reached 231, differs 0, every stored document identical. **Totals: 119 defined (FR2 retired, NQ14 added), 118 killed, 1 survivor — NL2c, proven equivalent.**

**The checks on the merged tree:** WSL, Node 20.20.2, lock `e457c10d0317`, `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`:

| Check | At | Result |
|---|---|---|
| Full suite | `f1d396c5` (Q-14 merged with `main`) | **exit 0** · `Test Files  1593 passed \| 13 skipped (1606)` · `Tests  36715 passed \| 179 skipped (36894)` |
| `npm run lint:gate` · `npx vite build` · `npm run test:rules` | `f1d396c5` | **exit 0** each · `✓ built in 16.26s` · rules `46 passed (46)`, `841 passed (841)` |
| Full suite | `9301f87f` (the final code: the Q14-1 fix and its two rows) | **exit 0** · `Test Files  1593 passed \| 13 skipped (1606)` · `Tests  36717 passed \| 179 skipped (36896)` |
| `npm run lint:gate` · `npx vite build` | `9301f87f` | **exit 0** each · `✓ built in 28.75s` |

The rules suite was not run again at `9301f87f`: it reads `firestore.rules` only (`test/rules/*.rules.mjs`), unchanged since it passed on the merged tree.

**Not repeated:** the soak — the only product files changed are Q-14's (`adjustments.js`, `ledger.js`; the merge brought none the idea book reads); the suite runs the fixed late histories, Astra's plans and the 36 shape, 18 refuter-shape and probe seeds. The differentials and the end-to-end dump — Q-14 acts only where the founder has ruled an ambiguous share-basis id, which complete, on-time, unambiguous data never has.

**Time:** the rulings arrived at 22:42; this section was first pushed at 23:30 (about 50 min): Q-14 and its rows ~25 min; the refuter ~16 min beside the merge and the battery; Q14-1 confirmed, fixed, two rows, the battery and the suite again ~30 min.

## 12. Final fix, 21 Nov 2026 — advance listings (T2E-C01 to C05)

| | |
|---|---|
| Prompt | "Fix T1a-2b-4, final: advance listings, and four narrow fixes (T2E-C01 to C05)", 21 Nov 2026 — Astra's confirmation `docs/audits/20261121_ASTRA_CONFIRMATION_T1A2B4.md`, committed byte-identical first (SHA-256 `35b7bf618fa59d5eaa52fb0431c32512f6bab07c1163bab98298c52f5689972a`, checked on the downloaded file and on the committed blob) |
| Branch, base | `claude/practice-field-t1a2b4-corrections` from `5fa63271`; `git fetch origin` first: the branch head was `5fa63271` and `origin/main` `cf35151b`, already merged in (`f1d396c5`) — nothing to merge. Built in the session worktree `explore-work-idea-integration-3a23a9` (its own branch, fast-forwarded to `5fa63271`; the PR branch is checked out in another worktree) and pushed to the PR branch as a fast-forward |
| Heads | Product code `90e2b220` (frozen; the soak, the battery and every check below ran on it). The report commit follows |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No fenced file, flag, pin, rules or index changed; `mandateUniverseSnapshot.js` and `mandateCorporateActions.js` untouched. Offline: the repository's test doubles only; `git fetch` and `git push` the only network. No environment variable, `.env` file or credential read |

### 12.1 In plain terms

**What Astra found.** Most real dividends are announced days before they are paid, and the daily layer lists a row about two days before its date. The held ledger dropped every row dated after the close, so it forgot what it had been told. Four histories moved money with nobody deciding: a dividend revised before its date paid the latest amount with no record, and a pre-date conflict had no exit (C01); an approval posted beside the same payload already announced under a later date (C02); a sale forgot an announcement, so a dividend moved or revised across the sale paid on approval (C03); on a sold holding an older clean backfill cleared a newer rejection (C04). A fifth stranded a breached line: a reverse split that rounds the holding to nothing had no founder exit (C05).

**What the founder ruled.** Before its date, the latest listing stands: a change there is an update, and nothing waits. From the date on, a change is a revision or a re-date, and it waits for the founder. The holding remembers what it was told, across a sale. A sold holding's rejected row clears only by the founder's ruling. A refused share-basis record takes `conflict` / `none`.

**What changed.**
- **The ledger keeps what it was told.** A row listed before its date is observed on the ledger — its id, date and the payloads of its latest listing — only at a close whose own data covers the symbol, and kept after a sale.
- **At the date, the row is held to its announcement.** The same payload is on-time data and pays as before. Another payload, an announcement still listed two ways, or one withdrawn and listed again waits for the founder.
- **An announcement is a pairing candidate.** From the first close on or after either date, two ids of one payload within the window are one ambiguity, unless the switch was made before both dates. An announcement that pairs with something already past gets its own record at once, so the founder can rule it — which is what holds C02's approval, and its exit.
- **A sold holding's doubt clears only by the founder.** `resolve_hold` (`coverage_gap`) names it: `no_action`, or `row` — one row of the stored clean refetch. The refetch is shown on the doubt as evidence; nothing acts on it.
- **A refused reverse split has an exit.** `resolve_hold` (`conflict`, `none`) declines it; the queued sale then completes at the next eligible window.

**What the proof found on the way, all fixed with rows.** The one refuter found an announcement updated from a day whose data was refused, when another book's backfill reached that day ($199.94 paid; RF-1). The soak found a founder's correction, waiting on one ledger, posting again on the other at every close — $0 in its histories, and **$93.97** without approval once a late split came in between (pre-existing since T2D-05; A-4 keeps the window open longer). The battery's survivors showed two rows that tested less than their titles said, and one loop of mine that was redundant (removed).

**How it is proved.** Astra's five rows, verbatim (C01's expectation changed under A-1), and 30 more of her named histories and variants through her own harness — 21 red at `5fa63271`, 14 green there (the controls, and the A-1 updates the old code already paid — C01 among them: as Astra wrote it, expecting $0, it was red there at her figure, $199.94, which A-1 makes the right answer). The oracle now models A-1 and A-2 from the inputs alone, matches every posting to one exact, unconsumed request and checks its net before any excuse; Astra's fabricated posting is refused. A new generator mode lists every on-time row 1–5 sessions ahead in 15 shapes; on the old product its first 120 histories fail 59 times, on the new one none. **The soak at the frozen head: 5,358 histories, 103,650 closes, no failure. The battery: 145 mutants, 144 killed; the one survivor, NL2c, is last round's proven equivalent.** The full Linux suite, lint, build and the rules suite pass (§12.11).

**What changed for complete, on-time, unambiguous data:** nothing. A row listed ahead and never changed pays on its date at full quality, as before (`H-baseline`); the end-to-end dump is byte-identical and the differentials identical.

### 12.2 The founder's ruling, 21 Nov 2026 (verbatim)

- **A-1. Before its date, the latest listing stands.**
  - At a close before both a row's old and new effective dates, the latest listing of an id is the announcement. That includes a changed amount or ratio, a withdrawal, and a conflict that resolves to one payload. Nothing has been owed or paid, so nothing waits.
  - From the first close on or after either date, everything is as ruled: a changed payload is a revision, a moved date is a re-date, and both wait for the founder (Amendment F revision 1, L-1 to L-8).
- **A-2. The holding remembers what it was told.**
  - Every listed row, past or future, is observed on the holding from its first listing: its id, date and payload.
  - Those observations count as pairing candidates for L-2 ② and L-3, even when the row is not yet due.
  - They carry across a sale into the sold holding's revision and re-date screens.
- **A-3. A still-conflicting announcement at its date** is an ordinary conflict, with the existing `conflict` ruling as the exit. No pre-date ruling is needed.
- **A-4. On a sold holding, a parse rejection dated within the holding clears only by the founder's `coverage_gap` ruling.**
  - No backfill clears it automatically. This replaces the ordering logic C04 broke.
  - Make sure `resolve_hold` (`coverage_gap`) can address it.
  - A clean refetch is shown to the founder as evidence, not acted on.
- **A-5. A refused share-basis record on the idea's own ledger** (`rounds_to_nothing` and the like) is founder-addressable with `conflict` / `none`, with a receipt and replay protection. Until it is answered, the line sale waits. After `none`, the queued sale completes at the next eligible window.

**Simplify where A-1 to A-5 make code redundant.** That includes the closed-coverage clearing by backfill (F-1, R-4's clearing path). List every branch removed, with `file:line`.

### 12.3 Readings of the ruling (each a choice the letter left open)

1. **Only a close whose own data covers the symbol updates an announcement.** A failed fetch, a dirty or missing parse report — the session's own refusal for that symbol — neither updates nor withdraws one; a stored backfill reaching the session does not make it count (it vouches for nothing dated after the session — RF-1). A payload first seen at such a close and listed on the date is a revision.
2. **The announcement a row enters its date with** is its latest such listing before the date. A withdrawn one never listed again is owed nothing and nothing waits (`H-withdraw`). **A withdrawn one listed again on or after its date is a revision** — the fail-closed side; the letter's "a withdrawal" is an update only before the date (asked as Q-16).
3. **A-3:** an announcement listed two ways at its last listing before the date is a conflict at the date, whatever the date lists — one payload included.
4. **"Before both dates", for a move:** the later id was listed, at a covered close, after the other id's last listing and before both dates. Otherwise the two are one ambiguity from the first close on or after either date: two ids announced together (both wait), a payload listed under an earlier date on that date (`H-move`), and an id replaced before both dates that comes back later. The rule reads a partner's listing dates even after the partner settles, so a switch stays shown.
5. **An observation a pairing makes ambiguous gets its own `possible_redate` record at that close,** before its own date if need be, so the founder can rule it — C02's exit is `none` on the partner. A pre-date conflict that pairs with nothing has no record: nothing waits, so `resolve_hold` answers 404 (A-3: no pre-date ruling is needed).
6. **"Observed on the holding" lives on the ledger** (`listedAhead`), because a sale deletes the holding. The idea's ledger keeps observing a symbol it sold, at closes whose own data covers it, so a re-listing after the sale counts as it does for the comparison.
7. **Rule 5 on a sold holding:** a dividend announced for the sale day and listed unchanged on it holds the sale, and the close pays it on time, as before (SX-1). An unchanged announcement first listed again after the sale is a late entitlement, proposed as before (L-1).
8. **A-4's `row`.** The founder may choose one row of the stored clean refetch, dated within the doubt; it reaches the sold holding's path as the founder's (a split enters the dated count as history; a dividend is proposed). Without it, R-4's join gone, a split the refetch shows could never enter the count — R-4's own row needs it. `no_action` clears the doubt with nothing added. A rejection a later close shows again stands again (asked as Q-17).
9. **A-5 is `none` only** (`payload` 422: the applier refused that very payload). The ruling names every ledger that carries the refused record — a same-stock comparison has its own copy. A paper ledger's own refusal (F-4) is addressable the same way.
10. **The oracle's I-6:** an id only ever announced — withdrawn before its date, never listed on or after it — is owed nothing unless the founder's ruling chose its payload.

### 12.4 Each fix, by `file:line` (at `90e2b220`)

The round's commits: `e35d5489` (Astra's confirmation, byte-identical), `ad362ff0` (her five rows and the named histories, red first at `5fa63271`), `020ec5eb` (A-1 to A-5 and the A-4 rows), `f61b39c3` (observations kept and observed after a sale; the oracle; the generator), `a1ee5149` (the oracle's A-1/A-2 rows; a guard simplified), `d9275df9` (the refuter's RF-1), `90e2b220` (the soak's correction finding; the battery's survivors answered). All under `api/_utils/practiceField/`.

**C01, C02 — the held ledger (`ledger.js`).**
- `:255` the rule, stated once. `:283` `listedAheadOf`, `announcementOf`, `lastListedOf`, `actionOfAnnouncement`; `:299` `differsFromAnnouncement` (A-1, A-3: a withdrawn announcement, or one listed two ways, always differs); `:310` `switchedBeforeDates`.
- `:1131` `observeListedAhead` — every row dated after the close, of a symbol the ledger holds or has sold (`:1135`), observed at a close whose own data covers it; withdrawn at such a close that no longer lists it. It returns the prior array untouched when nothing changed, so a re-run close writes nothing and on-time data stores nothing new.
- `:1188` an observation is open while its id has no receipt, record or held row.
- `:1323` an in-call conflict's record keeps the announcement's payloads (A-3). `:1362` THE DATE-CLOSE COMPARISON (A-1, A-3): a due row whose announcement differs is a revision record; an unchanged one applies as before.
- `:1483` observations in the re-date pool and the L-5 same-date pool; `:1500` the switch exemption for every partner. `recordRedatePair` records every observation a row pairs with.
- `:1548` AN OBSERVATION ALREADY PAIRED: an announcement whose payload this ledger has applied, declined, holds, recorded, or seen announced under a date now past gets its `possible_redate` record at that close.

**C03 — across the sale (`adjustments.js`, `close.js`).**
- `adjustments.js:219` `bareAnnouncementOf`; `:455` `announcedDiffers`, read first in the revision order and the close's pre-pass; `:539` a sold holding's row listed otherwise than it was announced while held is a conflict record, never a proposal; `:620` the announced pool in the re-date screen; `:624` the switch exemption for every partner.
- `close.js:461` `dailyRefused` — the session's OWN daily refusal, for every symbol any ledger of the idea holds or the idea sold — handed to every ledger's observation (RF-1).

**C04 — a sold holding's doubt (`close.js`, `holdRulings.js`, `dailyCoverage.js`).**
- `close.js:190` `withClosedCoverageDoubts`: cleared only by the founder's ruling applied at the close (`rulings`; `:202` the dates it covers — it applies at the first observed close after it was made, before that close's report is read); a rejection the close shows again stands again; `lastSeenOn` kept; the record carries its `id` and (`:214`) the clean refetch as `evidence.cleanRefetch` — acted on by nothing. `:327` R-4's join removed. `:476` the ruling handed in, on the idea's ledger. The doubt's alert names the id and the evidence.
- `dailyCoverage.js:228` `closedDoubtIdOf` — `ca_closed_doubt_<SYM>_<first date>`, distinct from a held gap's (a same-stock comparison may hold one of the symbol at the same time).
- `holdRulings.js:399` `resolve_hold` (`coverage_gap`) on a sold holding's doubt: `no_action`, or `row` of the stored clean refetch dated within the doubt; 409 once ruled. `:632` applied at the next observed close (`closedDoubtRulings`, `:468`); a `row` reaches the idea's ledger as the founder's action.

**C05 — a refused share-basis record (`holdRulings.js`).**
- `:125` `refusedActionRecords`; `:329` `resolve_hold` (`conflict`) on one: `none` only (`payload` 422), naming every ledger that carries it; the record answers 409 once ruled (`founder_ruled_none` joins the "ever" check). `:594` applied: declined, with the ruling's receipt, on each ledger it names; the applier drops the held record (its id is settled), and the sale it held completes at the next eligible window.

**The soak's finding (`adjustments.js:753`).** A ruling's amount correction posts once on a ledger; a later count change is a `late_basis` proposal (§12.8).

### 12.5 Every branch removed (cited at `5fa63271`)

A-4 makes the backfill's part in a sold holding's doubt redundant: only the founder's ruling clears it, and a clean refetch is evidence.

| `file:line` at `5fa63271` | What went | Why |
|---|---|---|
| `close.js:195–199` | F-1's clearing: `const bf = backfills.get(sym)`, and `left = kept.filter(… bf.from <= x.date && bf.to >= c.through && (… bf.to > x.seenOn))` | A-4: no backfill clears a sold holding's doubt (the ordering C04 broke) |
| `close.js:200` | `if (left.length > 0) nextDoubts[sym] = { dates: left, through }` | rewritten: the doubt stands until the founder's ruling, with its `id` and the refetch as `evidence` |
| `close.js:310–320` | R-4's join of a sold holding's clean backfill rows into the idea's rows (`for (const [sym, bf] of closedBackfills)`) | A-4: a clean refetch is not acted on; the founder's `row` ruling is the only way one of its rows reaches the sold holding |
| `close.js:272`, `:308`, `:317` | `backfillJoined` — declared, filled by the coverage loop, and P-3's skip | went with the join |

Kept: `caBackfill.js` `backfillNeeds` still fetches a backfill for a sold holding's doubt (it is the founder's evidence; C04's scaffold asserts the clean document exists), and the close still reads it — only to put it on the doubt. Also removed within the round (code this round had added): the planner's step-3 loop recording an announcement that pairs an open proposal — the battery showed it redundant beside the sold path's announced pool, P-4's kept outside rows and the held path's early record (§12.9). **Redundant, still not removed:** NL2c's received-sum fallback (`adjustments.js` step 3), proven equivalent last round; A-1 to A-5 do not touch it (register).

### 12.6 Every row whose expectation changed, and why

None is a change for complete, on-time, unambiguous data.

| Row | Was | Now | Why |
|---|---|---|---|
| `astraConfirmation.test.js` C01 `H-revise` (Astra's, verbatim otherwise) | $0 | **$199.94**, full quality | A-1: the $2 listed before the date is the announcement. The old code already paid $199.94, so under A-1 this row passes at `5fa63271` too; it cannot fail there |
| `corporateActionLateAsks.refuter.test.js` R-5 (conflict ruling under a sold holding's doubt) | a clean backfill cleared the doubt at S6; the ruling posted $99.97 at S7 | the backfill is evidence; the founder's `coverage_gap` ruling clears it at S7; $99.97 at S8, once | A-4 |
| refuter R-5 (a ruled correction under the doubt) | $99.97 at S7 when the backfill cleared it | nothing at S7; the founder's ruling; $99.97 at S8 | A-4 |
| refuter R-4 | a clean backfill listing the rejected 5/4 cleared the doubt, joined the closed path; $124.96 at S7 | the backfill is evidence (`rows: 2`); the proposal stays $99.97, refused (`date_uncovered`); the founder's `row` ruling takes the 5/4 and clears the doubt; $124.96 at S8 | A-4: R-4's join and clearing are gone |
| refuter P-3 (same-stock, and its sector control) | the backfill's 5/4 reached the closed path; $124.96 at S7 | the founder's `row` ruling takes it; $124.96 at S8 | A-4 |
| refuter F-1 (the idea's own pipeline) | a clean backfill fetched at S5 cleared doubt #1; another at S9 cleared doubt #2; $99.97 at S10 | each doubt stands with the refetch as evidence until the founder's ruling; $99.97 at S11 | A-4 |
| refuter F-1 (a clean document stored before the rejection) | `dates: [{ date, seenOn }]` | `dates: [{ date, seenOn, lastSeenOn }]` | the doubt names the last session that showed the rejection, for the founder |
| `corporateActionLateAsks.test.js` 409 (4) | a clean backfill cleared the doubt at S6; $99.97 at S7 | the backfill is evidence; the approval still 409 `late_date_uncovered`; the founder's ruling clears it at S7; $99.97 at S8; the doubt carries its `id` and `lastSeenOn` | A-4 |
| refuter O-2 (oracle: L-2 ④ on a sold holding) | a catch-up after the rejection cleared it | a catch-up no longer does; the founder's `coverage_gap` ruling made after the rejection does | A-4, in the oracle |
| refuter "a ruling of the id itself answers its ambiguity" (oracle) | an approval's posting passed once a conflict ruling existed | the approval's posting still meets L-2 at posting; the ruling's own posting, naming the ruling, passes | the oracle's exact matching |
| `corporateActionLateAsks.equivalence.test.js` NL2c control | the extra cent refused by I-6 | refused by I-7's net at posting (or I-6) | the oracle checks every posting's net at its own close, before any excuse |
| 13 oracle unit rows (`corporateActionLateAsks.test.js` I-7 rows; refuter O, O-1, O-2, O-3, the founder-split pairing rows) | a posting with no `proposal` or `ruling` | the same posting naming its proposal and the approval's key (`a1`, `k4`, `k2`) — what every product posting carries | the oracle's exact matching |

Every other row before this round passes unchanged. Two rows this round had added to `astraConfirmation.test.js` (a switch made before both dates) were removed: Astra's harness clips the vendor to the two-day lookahead, so they never listed the announcement they named; they run now in `corporateActionSequences.ahead.test.js`.

### 12.7 The oracle and the generator

**The oracle (`__testsupport__/caOracle.js`), from the inputs alone.**
- **A-1, A-2.** A row dated after the close is an announcement: at a covered close (no failed fetch, no refused parse report — the harness now hands the parse refusals too) its latest listing is the id's announcement, and a covered close that no longer lists it withdraws it. Nothing before the date is a conflict, a revision or a pairing. At the first close that lists the id on or after its date it is held to its announcement. Two ids of one payload within the window pair from the first close on or after either date, unless the switch was made before both — read as the product reads it: the last listing of an id listed now is this close; of an id only ever announced, its last covered announcement; of any other, unknown. I-6: an id only ever announced is owed nothing unless the founder's ruling chose its payload.
- **Astra's test-only gap.** I-7 matches every posting to ONE EXACT, UNCONSUMED request — the accepted request whose key the posting's ruling receipt names: an approval of exactly the proposal it names (its generation included), or a conflict ruling choosing exactly its payload, which can only be the late entitlement it chose; one request authorizes one posting on a ledger. The posting's NET is checked at the close that posted it, before any excuse: what the ledger is owed by the inputs, less everything it had received for the id before it. Her case — generation 2, another key, $100.97 — is refused (`astraConfirmation.test.js`, "the oracle"), as is the right proposal and key at $100.97 beside her fabricated comparison split conflict; a request named twice is refused the second time; the honest $99.97 passes I-7 and I-6.
- **A-4.** I-7's L-2 ④ on a sold holding clears a rejected row only by the founder's accepted `coverage_gap` ruling made after it showed — never a catch-up (the proxy Astra named).
- **Red first:** the new generator's first 120 histories on the old product (`5fa63271`'s five product files, this round's tests): **59 fail — 53 at I-2, 6 at I-7**; on this head, none. The exact-matching rule is what found the soak's correction finding.

**The generator (`__testsupport__/caSequences.js` `generateLate(seed, { ahead: true })`, `PF_LATE_SHAPES=3`).** A third random stream, so every older seed writes the history it always wrote. Every row the history lists on time is listed 1–5 sessions before its date — the common case (the real daily layer looks about two calendar days ahead; 1–5 sessions is a deliberate superset) — with one of 15 advance-listing shapes:

| Shape | The history |
|---|---|
| `ahead_revised` | $p1 announced, then $p2, both before the date (an update) |
| `ahead_revised_at_date` | $p1 announced, $p2 listed on the date (a revision) |
| `ahead_revised_after_date` | $p1 announced and paid, $p2 the session after (a settled id revised) |
| `ahead_conflict_resolves` | [$p1, $p2] announced, then [$p1] before the date |
| `ahead_conflict_at_date` | [$p1, $p2] through the date (A-3) |
| `ahead_conflict_enters` | [$p1, $p2] announced, [$p1] listed on the date (A-3) |
| `ahead_withdrawn` | announced, withdrawn before the date |
| `ahead_withdrawn_relisted` | announced, withdrawn before the date, listed again on it |
| `ahead_moved_before` | one date announced, replaced by another before both |
| `ahead_moved_on_date` | the payload listed under an earlier date, on that date (H-move) |
| `ahead_both_announced` | two dates of one payload announced together |
| `ahead_split_revised` | a 2-for-1 announced, another ratio before the date, a dividend of that date (H-split) |
| `ahead_partner_of_paid` | a paid dividend's late_basis and its payload announced under a later date; the founder's `none` on it (T2E-C02) |
| `ahead_across_sale` | announced while held; after the sale moved inside the holding, revised, or listed unchanged (T2E-C03) |
| `ahead_sold_doubt` | a sale, a late dividend's proposal and approval, a rejected row dated in the holding, the founder's `coverage_gap` ruling (T2E-C04) |

The founder's decisions on late proposals (35% of closes) and, now and then, the founder's `coverage_gap` ruling of a sold holding's doubt (a new harness step, `ruleDoubt`) run through the real endpoint. 45 seeds run in every suite (`corporateActionSequences.late.test.js`, "rows listed before their date").

### 12.8 The soak and coverage

**The seeds, chosen before any run.** Fresh: advance-listing late histories 2140000000–2140003999 (4,000), ordered 2141000000–2141000999 (1,000). Astra's ranges: plain late 2161121000–2161121119, shapes 2161122000–2161122071, refuter shapes 2161123000–2161123053, ordered 2161124000–2161124063, wide 2161125000–2161125047. Every fixed case runs in every shard (the test files carry them: Astra's T2D and T2E histories, the kept soak seeds, the 36 shape, 18 refuter-shape and 45 advance-listing seeds). WSL, `TZ=UTC`, Node 20.20.2, one worker per shard, 1,536 MB of heap per shard, under the suite lock. After every close and its re-run: I-1 to I-5, the dated conservation, I-7 (exact matching, the net at posting, L-2 at posting), then I-6.

**What the soak found (at `d9275df9`), fixed at `90e2b220`.** Three histories failed — two of the 4,000 fresh ones (2140002387, 2140002610) and one of Astra's refuter-shape range (2161123005, which passed on `5fa63271` under the old oracle) — all at I-7's rule that one request authorizes one posting on a ledger. In each, a founder's amount correction ruled for two ledgers was deferred on the idea's sold holding by a doubt (A-4 keeps it until the founder rules it) and posted on the comparison; the ruling stayed pending, was handed to every later close, and the comparison re-posted it as "owed now less received" — $0 while nothing changed. **With a late split listed in between it moves money:** a 2-for-1 dated on the ex-date, listed the close after the comparison posted, made it post **$93.97** under the old ruling with no approval (a late fact owes a proposal, L-1). Pre-existing since T2D-05; A-4 makes the deferral last until the founder's ruling. **Fix:** `adjustments.js:753` — a ruling's correction posts once on a ledger; a count change after it is a `late_basis` proposal. Rows (`corporateActionSequences.ahead.test.js`): the three seeds (one correction per ruling and ledger) and the late-split history (a proposal, never a second posting), each red on `d9275df9`'s `adjustments.js`; mutant `NCO-correction-posts-again`, killed by all four.

**At `90e2b220` — no failure:**

| Group | Seeds | Histories | Closes (and re-runs) | Failures |
|---|---|---|---|---|
| Advance listings (fresh) | 2140000000–2140003999 | 4,000 | 76,394 | **0** |
| Ordered (fresh) and Astra's ordered | 2141000000–2141000999, 2161124000–063 | 1,064 | 21,612 | **0** |
| Astra's plain late | 2161121000–119 | 120 | 2,278 | **0** |
| Astra's shapes | 2161122000–071 | 72 | 1,374 | **0** |
| Astra's refuter shapes | 2161123000–053 | 54 | 1,034 | **0** |
| Astra's wide | 2161125000–047 | 48 | 958 | **0** |
| **All** | | **5,358** | **103,650** | **0** |

**Coverage of the advance-listing histories.** Every shape drawn (236–307 each). What they reached in the product (histories): observations 3,994; an announcement paired 1,257, its record made before its date 1,238; a row held to its announcement and revised 1,455; a withdrawal 726; a sold holding's doubt ruled by the founder 204; a re-date on a sold holding 101; same-date share-basis pairs 36. The founder's decisions: 1,323 approvals and 672 declines accepted, 912 approvals and 99 declines refused (409). I-7's net at posting checked 2,862 postings; I-6 checked 151,600 entitlements (109,149 excused, 14,131 waiting, 26,024 owed nothing). **Ordered pairs with a new event, on one id and one ledger: 344 distinct** (167 on the idea's ledger, 165 on the comparison, 12 on the SPY line). Among them, on the idea's ledger: `listed_ahead → announced_on_time` 11,128; `listed_ahead → revised_ahead` 1,313; `revised_ahead → announced_on_time` 1,006; `revised_ahead → revision` 340; `listed_ahead → revised_at_date` 1,691; `conflict_ahead → revised_ahead` 292; `conflict_ahead → announced_on_time` 251; `conflict_ahead → revised_at_date` 572; `conflict_ahead → conflict` 287; `listed_ahead → withdrawn_ahead` 760; `withdrawn_ahead → relisted_after_withdrawal` 283; `withdrawn_ahead → returned_ahead` 34; `withdrawn_ahead → redate` 171; `listed_ahead → redate` 1,572; `uncovered_ahead → announced_on_time` 3,023; `uncovered_ahead → revision` 1,010; `uncovered_ahead → revised_at_date` 602.

### 12.9 The mutation battery

The fast runner from #1101 (`scripts/practice-field/battery/run-battery.mjs` at `a19e40a1`, copied in untracked for the run and removed after), tiered, 3 trees × 4 workers, with the last round's results and this round's earlier run as `--prior`.

**The definitions.** Last round's 119, re-anchored on this code: three retired with the code A-4 removed (`NR5-closed-backfill-rows-dropped`, `NR10-closed-backfill-skipped-when-held`, `NR13-stale-backfill-clears-doubt`, re-cut as `NA4a`), `NL2f-closed-doubt-not-sticky` and `NO5a-I7-L2-at-posting-off` re-anchored, and `NO5b-old-ruling-skips-L2` retired (the oracle's exact matching removed the line it cut: a conflict ruling matches only the late entitlement it chose). New: one or more per A-1 to A-5 and per oracle change, `NRF1` for the refuter's fix and `NCO` for the soak's. **145 defined.**

**First run, at `d9275df9`** (131 mutants in files this round changed): 124 killed, 7 survived — NL2c (the known equivalent) and six this round answered:
- `NA2c-sold-symbol-unobserved`, `NA2d-partner-exemption-unchecked` — the two `astraConfirmation.test.js` rows that should have killed them never listed their announcement (Astra's harness clips the vendor to the two-day lookahead): rebuilt in `corporateActionSequences.ahead.test.js` on the S-6 harness, which lists rows as given; both killed.
- `NA2f-sold-announced-pool-dropped`, `NA2g-proposal-observation-unrecorded` — each covered the other's case; NA2g's loop was redundant and is removed (§12.5); NA2f then dies on Astra's C03.
- `NO-A1-no-revision-at-date` — the oracle's generic revision check covered a changed payload; rows for a withdrawn announcement listed again and a conflict entering its date now kill it.
- `NO5b-old-ruling-skips-L2` — retired (above).

**At the frozen head `90e2b220`:** every mutant with an edit in `adjustments.js` or `caOracle.js` (the files changed since `d9275df9`), the re-checked survivors and NCO — **65 run, 64 killed, 1 survived (NL2c), 12.7 min**; every `ledger.js` mutant (one, NA2b, had been killed at `d9275df9` only by a removed row) — **16 run, 16 killed, 2.5 min** (NA2b now by Astra's C02); and `NR6-backfill-ignores-closed-doubts`, whose killing row (R-4) this round rewrote — **killed**. The other 49 verdicts carry from `d9275df9` (their files and killing rows unchanged since), and 14 from last round (files this round did not touch; each killing row checked to still be in the suite) — 82 run at the frozen head in all.

**Final: 145 defined, 144 killed, 1 survived — NL2c, last round's proven equivalent; 0 broken, 0 errored, 0 timeout.**

| New mutant | Item | Killed by (first failing row) |
|---|---|---|
| `NA1-announcement-not-compared` | A-1 | `astraConfirmation.refuter.test.js` RF-1 control |
| `NA1b-uncovered-close-updates` | A-2 (covered closes) | RF-1 control |
| `NA1c-withdrawal-unseen` | A-1 | C01 "withdrawn before its date and listed again on it" |
| `NA1d-every-switch-exempt` | A-1 | lens A AR4-A-1 breadth (and the C01 re-date rows) |
| `NA1e-no-switch-exempt` | A-1 | C01 "a move made before both dates is an update" |
| `NA1f-withdrawn-relisted-not-revision` | reading 2 | C01 "withdrawn … listed again" |
| `NA3-conflicting-announcement-read-as-one` | A-3 | C01 "enters its date conflicting" |
| `NA2-observations-not-in-pool` | A-2 | C01 `H-move` |
| `NA2b-paired-observation-not-recorded` | A-2 (T2E-C02) | Astra's C02 |
| `NA2c-sold-symbol-unobserved` | A-2 (across a sale) | `corporateActionSequences.ahead.test.js` "across a sale" |
| `NA2d-partner-exemption-unchecked` | A-1 | ahead "a switch … stays an update after it is paid" |
| `NA2e-sold-revision-of-announcement-ignored` | A-2 (T2E-C03) | C03 `sold-changed-past-sale` |
| `NA2f-sold-announced-pool-dropped` | A-2 (T2E-C03) | Astra's C03 |
| `NA4a-backfill-clears-again` | A-4 | refuter R-5 |
| `NA4b-closed-doubt-ruling-ignored` | A-4 | C04 `natural-dirty-after` |
| `NA4c-rejection-again-not-reopened` | A-4 | refuter F-1 |
| `NA4d-closed-doubt-unaddressable` | A-4 | refuter R-5 |
| `NA5a-refused-record-unaddressable` | A-5 | Astra's C05 |
| `NA5b-refused-takes-payload` | A-5 | C05 "`payload` is no answer" |
| `NA5c-refused-none-not-declined` | A-5 | Astra's C05 |
| `NA5d-refused-replay-404` | A-5 | C05 "replays" |
| `NRF1-refused-daily-updates-announcement` | RF-1 | RF-1 beside B |
| `NCO-correction-posts-again` | the soak's finding | lens C C1 (and the four `ahead` correction rows) |
| `NO-A7-posting-not-exact` | oracle (exact request) | "Astra's fabricated posting" |
| `NO-A7b-net-unchecked` | oracle (net at posting) | "the right proposal and request, but $100.97" |
| `NO-A4-catchup-clears-again` | oracle (A-4) | refuter O-2 |
| `NO-A1-no-revision-at-date` | oracle (A-1) | oracle "withdrawn … is a revision; … two ways is a conflict" |
| `NO-A1b-uncovered-updates` | oracle (A-2) | oracle "only a covered close updates an announcement" |
| `NO-A2-pairs-before-any-date` | oracle (A-2) | oracle "two dates announced together pair only from the first" |
| `NO-A6-announced-only-owed` | oracle (I-6) | oracle "I-6: a dividend only ever announced" |

### 12.10 The refuter

**One refuter** (an independent agent, about 31 min; a read-only snapshot of `f61b39c3` and the diff from `5fa63271`; told to find a reachable history where a row listed ahead, or a sold holding's rejection, moves money without the founder). It ran 59 probes and a fresh advance-listing run of its own (seeds 3141590000–3141590299: 300 histories, 5,680 closes, every shape, no failure). **It found one money path, fixed with rows; the rest is recorded.**

| Id | What it found | Money? | What was done |
|---|---|---|---|
| **RF-1** | A held symbol's announcement was updated from a daily layer REFUSED for that symbol (an unreadable second row of the id) whenever a stored backfill reached through the session: the close counts such a session covered (`dailyCoverage.js` `sessionCoverage`), though a backfill ending at the session vouches for nothing dated after it. The document is one per symbol, here fetched for another book's sold-holding doubt. Book A alone: S7's $2 was a revision of the $1 announcement and waited. Beside book B, or with B's document planted: **$199.94 paid at full quality, no ruling.** | **yes** | **Fixed** (`d9275df9`): `close.js:461` hands every ledger the session's own daily refusal for every symbol the idea holds or sold. Rows: `astraConfirmation.refuter.test.js` — the refuter's probe, a two-book harness; RF-1 beside B, and planted, red at `f61b39c3`; the controls green at both. Mutant `NRF1` |
| RF-2 | The same cause withdrew an announcement at a refused close, so an unchanged $1 listed on its date waited as a revision. | no (over-hold) | fixed by the same change; rows RF-2 and its control |
| RF-3 | The sequence harness runs one book, so the oracle never sees a backfill another book wrote. | no (oracle reach) | recorded; the two-book rows stand in |
| RF-4 | On a sold holding, the announced pool's exemption reads an id listed now by its last announcement rather than this close (the held path reads this close). It can free the switched-to row as a proposal; its approval is still refused (L-2 ②) by the other id's revision record. | no | recorded |
| RF-5 | A split announced, then replaced before its date by a reverse split of the same date, applies with no ruling — the switch-before-both-dates rule applied to L-5's same-date pair. | no (A-1 as read) | asked as Q-15 |
| RF-6 | Observations of a ticker change or delisting are keyed by the old ticker; no vendor feed emits either row (`mandateCorporateActions.js` header). | no (unreachable) | recorded |

It also confirmed, with probes: the date-close comparison runs before any held replay; a withdrawn-then-relisted row is always a revision; a switch always leaves the superseded id withdrawn at a covered close, so the two never both pay; applied or held partners always pair; A-4 clears only by a ruling, a re-rejection re-adds the date, backfill rows no longer join, and a `row` ruling goes through the closed path as the founder's; A-5 covers share-basis records only, on the ledgers that carry them, replay answers 409, and a later corrected ratio is a `revised_after_ruling`.

**Not read by another refuter:** the RF-1 fix and its rows, and the soak's correction fix and its rows (both small, each red-green on its rows, both under the soak and the battery above). The prompt asked for one refuter.

### 12.11 The checks

| Check | At | Result |
|---|---|---|
| Astra's five rows, verbatim (C01 changed) | `5fa63271` · `90e2b220` | as she wrote them, all five red at `5fa63271` at her figures ($199.94 where she expected $0, $124.96, $99.97, $99.97, 404); with C01 changed under A-1 to $199.94 — what the old code paid — **C01 passes at `5fa63271`, C02 to C05 red** (re-measured on the final rows) · **5 pass** |
| Her named histories and variants (35 rows), the oracle rows (9), RF-1 (5), the harness rows (7) | `90e2b220` | **56 pass** (the 35 at `5fa63271`, red first and again on the final rows: 21 red, 14 green) |
| The Practice Field folder (Windows) | `90e2b220` | **1,467 / 1,467** |
| The end-to-end dump | `90e2b220` | byte-identical to `main`'s (the pinned `abcf8420…ed9`, after the parse-report check) |
| Differentials against `cf35151b` (Astra's probes) | `90e2b220` | `astra-differential` **36/36** (35 scenarios + the prompt group), `astra-cron-trace` **40/40**, planted-backfill **4/4** (planted 100 shares, vendor 200, cash $90,000; `off` and `on`) |
| Full Linux suite, WSL (`TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`, Node 20.20.2) | `90e2b220` | **exit 0** · `Test Files  1596 passed \| 13 skipped (1609)` · `Tests  36818 passed \| 179 skipped (36997)` (425 s) |
| `npm run lint:gate` · `npx vite build` | `90e2b220` | **exit 0** each · `✓ built in 20.12s` |
| `npm run test:rules` (WSL) | `90e2b220` | **exit 0** · `Test Files  46 passed (46)` · `Tests  841 passed (841)` |

### 12.12 Questions for the founder (each a reading above; each leaves money where it is until answered)

- **Q-15** (RF-5). A split announced, then replaced before its date by a reverse split of the same date, is the switch-before-both-dates rule applied to L-5's same-date pair: the reverse split applies with no ruling. Or should two share-basis ids of one date always wait, even when one replaced the other before the date?
- **Q-16** (reading 2). An announcement withdrawn before its date and listed again on or after it waits as a revision. Or should an unchanged payload listed again count as on-time?
- **Q-17** (reading 8). A sold holding's doubt takes `row` as well as `no_action`: the founder may take one row of the stored clean refetch into the sold holding's path. Keep it, or `no_action` only?

### 12.13 The register

**For Astra:** C04's focused recheck before the flip: A-4 (founder-only clearing on a sold holding), `natural-dirty-after` and its two controls.

| Item | State |
|---|---|
| Q-1 sign-off | before the switch (unchanged) |
| NL2c's received-sum fallback (`adjustments.js` step 3) | proven equivalent last round, the battery's one survivor again; A-1 to A-5 do not make it redundant; still to remove |
| `evidence.test.js` 60-session row | still needs a timeout of its own (load-sensitive under the battery) |
| RF-3: the sequence harness runs one book | the oracle cannot see another book's backfill; the two-book rows stand in |
| RF-4: the sold path's announced-pool exemption reads an id listed now by its last announcement | no money (L-2 ② refuses the approval); align with the held path in a later round |
| RF-6: observations of a ticker change or delisting keyed by the old ticker | unreachable from vendor data today |
| A refused CASH record (`count_on_ex_date_unknown`) | A-5 covers share-basis records; a refused cash record still has no founder exit (held, never paid) |
| The daily layer's lookahead | about two calendar days; the generator lists 1–5 sessions ahead, a deliberate superset. Astra's harness clips to the real lookahead, so a switch made before both dates is tested on the S-6 harness |
| T5 | the fire-time budget; the founder approvals screen — it should show Q-14 pairs, the early `possible_redate` records of announcements, a sold holding's doubt with its clean-refetch evidence, and a refused record's exit; Q-6 |

**Time.** The prompt arrived about 00:00 CT on 21 Nov; Astra's confirmation was committed at 00:28, the rows red first at 00:35, A-1 to A-5 at 00:51, the oracle and generator at 01:08, the refuter's fix at 01:45, the soak's fix and the battery's answers at 02:29 (the frozen code); the soak, the battery, the suite and the checks ran on it after that, once each. The full suite and the rules suite ran 02:48–02:58; this section was pushed at about 03:05 CT — about three hours after the prompt (the last round took about seven and a half). Nothing ran twice on unchanged code: the battery at `90e2b220` ran only the mutants whose files or killing rows changed after `d9275df9`.

## 13. Closeout, 21 Nov 2026 — R03 fixed; R01 and R02 alerted

| | |
|---|---|
| Prompt | "Fix T1a-2b-4, closeout: the founder's row choice (R03), and an alert for late reports (R01, R02)", 21 Nov 2026 — Astra's focused recheck `docs/audits/20261121_ASTRA_RECHECK_T1A2B4.md`, committed byte-identical first (`4bd83ff0`; SHA-256 `ae1a8014308613047e791fdc556c280a5cb50ecba3c5b2c1d4e4afff0e68d080`, checked on the downloaded file and on the committed blob) |
| Branch, base | `claude/practice-field-t1a2b4-corrections`; `git fetch origin` first (18:04 UTC): the branch head was `e2223443`, `origin/main` `cf35151b` (already merged in) — nothing to merge. Built in the session worktree `practice-field-t1a2b4-corrections-9e85f8` (its own branch, fast-forwarded to `e2223443`) and pushed to the PR branch as a fast-forward |
| Heads | Product code `7b7066cd` (frozen; the battery, the refuter and every check below ran on it). The report commit follows |
| Mode | `PRACTICE_FIELD_MODE` stays `'off'`. No fenced file, flag, flag pin, rules or index changed; `mandateUniverseSnapshot.js` and `mandateCorporateActions.js` untouched. Offline: the repository's test doubles only; `git fetch` and `git push` the only network |

### 13.1 In plain terms

**What Astra's recheck found.** Everything the final fix was asked to do held: C04 in all three orders, Q-17's refusals, A-1's date boundary (14 of 14), the once-per-ledger correction, her five acceptance rows, and the quarterly product. Three histories did not:
- **R03.** The founder picks one row of a clean refetch for a sold holding's doubt (`coverage_gap` / `row`). A row's id names its type, ticker and date, never its ratio, so a refetch can list a 5/4 and a 2/1 split under one id. The endpoint took whichever was listed first, even when the founder named 5/4: **$199.94** paid where the founder's choice pays **$124.96**.
- **R01, R02.** Two daily builds of one session race. The vendor answers the two identical requests differently a few seconds apart, and the losing build's rejection reaches the session's report only after the book has closed that session. A sold holding then pays **$99.97** without a coverage ruling (R01), and a held dividend pays **$236.93** from an announcement whose day the report later refuses (R02).

**What the founder ruled.** R03 is fixed: the founder's choice is the row taken. R01 and R02 are alerted, not chased: a report that changes after its close raises `PRACTICE_FIELD_REPORT_CHANGED_AFTER_CLOSE`, naming the symbol, the session and the books that closed it. Nothing reopens and no money is held. The race itself is removed at T5, by a lease that lets one daily build run per session.

**What changed.**
- **The `row` ruling takes the payload the founder names** (`holdRulings.js`). Both `row` sites — a sold holding's doubt and an open coverage gap — collect every row of the requested id within the record's dates, and:
  - a named payload takes only a row carrying exactly it; if none does, the request is refused (422), even when the id has one row;
  - with no payload named, the id must carry one distinct payload; two or more are refused (422) while the doubt stands;
  - a unique row still works without naming anything.
- **A late report change is alerted** (`caParseReport.js`). When a write adds a rejected row or a disagreement to a symbol's entry, the same transaction reads which idea books' closes have already read that session's report. If any have, the write logs the alert once it commits, naming them.

**How it is proved.** Astra's three seeds are rows in her own acceptance file: R03 verbatim, in both vendor orders, and R01 and R02 pinned to the ruling — the money she observed ($99.97, $236.93) and the alert exactly once, naming AAPL, the session and the book. A third, identical observation after the close adds nothing and alerts nothing. The passing order (the loser's report committed before the close) holds as today and alerts nothing. Seven more rows pin C-2 at both sites. Eight of the thirteen new rows fail on the old code (`e2223443`). The five that pass there are the two controls, the unique row, and the two orders the old code got right by luck, with 5/4 listed first. **The battery: 22 mutants re-run or added — the 20 that edit the two changed files and one each for C-1 and C-2 — all killed.** **The one refuter** confirmed that `row` takes only the named payload under every request shape it tried. It also found three ways around C-2 at its edges, each moving money in its harness. A `ratio` sent outside `payload` is ignored (RX-1, $199.94). The sold-doubt site accepts a refetch the engine itself would not count as clean (RX-2). The open gap takes an unnamed row from a failed backfill (RX-3). The closeout stopped at its time box, so none is built: RX-1 and RX-2 have fixes ready, and RX-1 blocks the flip; RX-3 is a founder question (Q-18; §13.7). The full Linux suite, the lint gate, the build and the rules suite pass (§13.8).

**What changed for complete, on-time, unambiguous data:** nothing. A report that never gains a rejection or a disagreement is written exactly as before, with the same reads; the end-to-end dump is byte-identical and the differentials identical (§13.8).

### 13.2 The founder's ruling, 21 Nov 2026 (verbatim)

**A report that changes after its close is alerted**

- **C-1.** When a session's parse report gains a rejection, or a disagreement, after an idea book has closed that session, it is **alerted** as `PRACTICE_FIELD_REPORT_CHANGED_AFTER_CLOSE`. The alert names the symbol, the session and the books that closed it. **It does not reopen the closed session or hold money.**
  - **Why:** both histories need concurrent daily builds and a vendor that answers two identical requests differently within seconds. On a founder-only paper book that is rare, and the founder sees the alert.
  - **Recorded for T5:** a lease so only one daily build runs per session, which removes the race at its source.
- **C-2. R03:**
  - `coverage_gap` / `row` resolves the requested row to **one distinct payload** in the stored clean refetch.
  - If the id carries more than one payload, the request must name the payload, and only a matching row is taken. Otherwise it is refused (422) while the doubt stands.
  - A payload that matches nothing is refused (422).

### 13.3 Readings of the ruling (each a choice the letter left open)

1. **"Gains a rejection, or a disagreement."** The write compares the entry it stores with the entry stored before it (`doubtGainedBy`). A rejected row the stored entry did not hold (compared by content), or `observationsDisagree` turning true, is a gain. A first entry is compared against nothing, so its rejections are all new. The same rejection observed again is not a gain, which keeps the alert to exactly once. A malformed envelope arriving after a clean entry makes the two observations disagree, so it is alerted. A first entry with only a malformed envelope is not: the close that read that session found no report, and a missing report is already a doubt.
2. **"After an idea book has closed that session."** The book's close row for the session (`windows/{session}_close`) exists with `observed: true`. That is the close that read the session's parse report: `close.js` reads the report and creates that row in one transaction. The report write reads the rows in its own transaction, so the order is exact: a close that commits first is named, and a close that commits after reads the changed report and needs no alert. The books are those the registry lists, the open and draining ones. A book closed for good is not named.
3. **Where the alert goes.** `console.error`, like the Practice Field's other alerts, logged after the transaction commits — never inside it, where a retry would run again. One line per symbol per committed write. Nothing is stored: no new collection, field, rule or index.
4. **C-2 covers both `row` sites.** The sold holding's closed doubt (A-4) and the open coverage gap (F-1) had the same first-match `rows.find`; one resolver now serves both.
5. **"Name the payload"** is the request's `payload` field — already part of the `resolve_hold` body and its request fingerprint, so a replay under the same key with another payload is still a key conflict (409). Payloads are compared as a conflict ruling compares them (`payloadOf`, `samePayload`): ratio, amount, cash per share and renamed-to, by exact value. `0.6667` therefore does not name a 2/3 split; the founder sends the ratio the refetch shows. Rows of one id with the same payload are one payload. A named payload is checked even when the id has one row. A `payload` that is not an object is refused 400 (`payload_invalid`), as on the conflict ruling.
6. **The refusals** reuse the conflict ruling's vocabulary: `payload_not_recorded` (422) for a named payload no row carries, and a new `row_payload_ambiguous` (422) for an id with two payloads and none named. `row_not_recorded` (422) is unchanged.

### 13.4 Each fix, by `file:line` (at `7b7066cd`)

The round's commits: `4bd83ff0` (Astra's recheck, byte-identical), `7b7066cd` (C-1, C-2 and their rows). All under `api/_utils/practiceField/`.

**C-2 — `holdRulings.js`.**
- `holdRulings.js:87` `rowOfNamedPayload(candidates, payload)`: a named payload takes only a row with the same payload, else `payload_not_recorded` (422); none named, one distinct payload is taken, two or more are `row_payload_ambiguous` (422).
- `holdRulings.js:432` the sold holding's doubt (A-4) and `holdRulings.js:459` the open coverage gap (F-1) now filter every row of the id within the record's dates and hand them to it. Each `a.ratio` / `a.amount` the ruling records, and the open gap's `unrepresentableOn` check, read the matched stored row, never the request.
- Header notes at `holdRulings.js:34` and `:421`.
- `founderControls.js` is unchanged: it already passes `payload` to `planHoldRuling` and covers it in the request fingerprint.

**C-1 — `caParseReport.js`.**
- `caParseReport.js:163` `doubtGainedBy(stored, merged)` (reading 1).
- `caParseReport.js:176` `booksThatClosed(tx, db, session)`: the registry, then each listed book's close row for the session, in the report's transaction (reading 2).
- `caParseReport.js:246–250`, inside the existing merge transaction: the books are read only when a symbol gained, before the write; the alert lines are returned.
- `caParseReport.js:264–265`, in the write pump: the lines are logged after the transaction resolves.
- Header at `caParseReport.js:38–44`.

**The registry census** — `registryPresence.test.js:85–91`. The census of files that name the idea-book registry now lists `caParseReport.js`, with a check that it never writes the registry (as for `sweep.js`). The protected-store allowlist is unchanged: no new write site.

No other file changed. The soak was not run: the only product files changed are `holdRulings.js` and `caParseReport.js` (the brief's rule 5).

### 13.5 The rows

All in `astraConfirmation.test.js`, through her harness: the real daily builder and its parse reports, the close, the windows and the founder's endpoint.

| Row | What it pins | At `e2223443` | At `7b7066cd` |
|---|---|---|---|
| `R01 sold-report-after-close` (`:783`) | Astra's seed. The loser's `3:2` rejection reaches Monday's report after the book closed Monday: the alert fires once, naming AAPL, `2026-11-23` and the book; a third identical observation alerts nothing; the approval is accepted (200) and Tuesday posts **$99.97**. CHANGED EXPECTATION from her 409 / $0 under C-1 | red — no alert (it paid the same $99.97) | pass |
| `R02 refused-announcement-after-close` (`:807`) | Astra's seed. S6's report gains the unreadable split after the book closed S6: one alert naming AAPL, `2026-11-24` and the book; S7 pays **$236.93**. CHANGED EXPECTATION from her $0 under C-1 | red — no alert (it paid the same $236.93) | pass |
| `R03 refetch-order 5/4 then 2/1`, `2/1 then 5/4` (`:826`) | Astra's seed, verbatim: naming `{ ratio: 1.25 }` takes the 5/4 row and pays **$124.96** in both orders | 5/4 first: pass · **2/1 first: red** (ratio 2 recorded, as Astra found) | pass, pass |
| C-1 controls (`:853`, `:869`) | The loser's report committed before the close: R01's standing doubt refuses the approval (409) and Tuesday pays $0; R02's S6 keeps the $1 announcement and S7 is a conflict that pays $0. No alert in either | pass, pass | pass, pass |
| C-2, named (`:902`, both orders) | Naming 1.25 takes the 5/4 row; $124.96 at S7, unchanged at S8, the same cash — posted once | 5/4 first: pass · **2/1 first: red** (ratio 2) | pass, pass |
| C-2, unnamed (`:913`, both orders) | Two payloads and none named: 422 `row_payload_ambiguous`, no ruling stored, $0 | red, red (200: the first row taken) | pass, pass |
| C-2, absent (`:920`) | A ratio no row carries: 422 `payload_not_recorded` and $0 — with two payloads, and with one | red (200) | pass |
| C-2, unique (`:929`) | One row, nothing named: the 5/4 split is taken and $124.96 posts once | pass | pass |
| C-2, open gap (`:937`, pure) | The open coverage gap's `row`, both orders: unnamed 422, each named ratio taken, an absent one 422; a payload listed twice is one; a unique row is taken unnamed and refused under another named payload | red (the first row taken) | pass |

Astra's acceptance file: **57 / 57** (44 before, 13 added). Every other row in the repository is unchanged except the registry census (§13.4).

### 13.6 The mutation battery

The fast battery (PR #1101's runner, copied untracked and deleted after), at `7b7066cd`, `--mode tiered`, 4 trees × 4 workers, with the final fix's four results files as `--prior`. **22 defined, 22 ran, 22 killed, none broken, survived, errored or timed out — 5.0 min** (baseline 1,519 rows in 42 files, green).

**What ran.** The final fix's battery defined 145 mutants at `90e2b220`. This closeout re-ran the 20 of them that edit a file it changed — 13 in `holdRulings.js` alone, 4 in `caParseReport.js` alone, and 3 that edit `holdRulings.js` beside `adjustments.js` or `close.js` — with every anchor checked first (0 broken). It also ran one new mutant for each ruling:

| Mutant | Ruling | Edit | Verdict | Killed by |
|---|---|---|---|---|
| `NC2-row-takes-first-row` | C-2 | `rowOfNamedPayload` returns the first candidate row, whatever was named | **KILLED** (quick, 6 rows failing) | `R03 refetch-order 2/1 then 5/4` — Astra's seed — and the C-2 rows |
| `NC1-alert-not-only-on-gain` | C-1 | the alert fires whenever the merged entry disagrees, not only when this write added the doubt | **KILLED** (quick, 1 row failing) | `R01 sold-report-after-close` — the third identical observation alerts a second time |

The other 125 edit files whose bytes are unchanged since `90e2b220`. The only test changes are rows added to `astraConfirmation.test.js` and one more check in the registry census, which can add kills but never remove one. Their verdicts stand. **The battery now stands at 147 defined, 146 killed; the one survivor is NL2c, the known equivalent** (`adjustments.js`, unchanged).

One kill was decided with the battery idle: `FB6-write-not-bounded` (the report write's time limit removed). Its killing row, the same as last round's, gives the write a store that never answers, so under the mutant the build waits forever and the row times out. That is the defect the mutant names, not machine load: the row timed out alone with the battery idle (9.6 s).

### 13.7 The refuter

One refuter, on this diff only, at `7b7066cd`, in its own LF snapshot of the commit (read-only on git and on the worktree; its probe files stayed in the snapshot). It was told to find a way for `row` to take a payload the founder did not name. It ran three probe files: 138 pure rows, and end-to-end histories at both sites.

**What held.** `rowOfNamedPayload` held under every request shape tried at both sites: `{}`, `[]`, `0`, `false`, `''`, `{ ratio: '1.25' }`, `{ ratio: 1.25, amount: 0 }`, extra keys, `{ ratio: null }`, `cashPerShare: null`, `renamedTo: ''`, over candidate sets `[1.25, 1.25, 2]`, `[2, 1.25, 1.25]` and both orders of two rows. Every 200 carried exactly the named ratio; every unnamed request against two payloads was 422.
- End to end at the sold holding's doubt:
  - Naming 1.25 or 2, then a later daily listing the other ratio, paid only the named figure ($124.96 or $199.94).
  - A dividend id listing $1 and $2.37: unnamed was 422 and paid nothing; each named amount paid only itself ($99.97 or $236.93).
  - The refetch rewritten between the ruling and the close changed nothing.
  - A new key while the ruling was pending was 409 `record_already_resolved`, the same key with another payload 409 `request_key_conflict`, and a second ruling after it applied 409.
- At the open gap: unnamed with two payloads was 422, and each named ratio applied exactly that ratio on both ledgers.

**What it found — three ways around C-2's edges, none built here** (the closeout stopped at its time box; §13.10):

| ID | Finding | Money | Disposition |
|---|---|---|---|
| **RX-1** | **A top-level `ratio` is read and ignored.** `resolveFieldsOf` reads `ratio` for every kind (and fingerprints it), but `coverage_gap` uses only `payload`. A founder who sends `{ …, decision: 'row', ratio: 1.25 }` against a stored refetch whose only split is 2/1 gets 200, the 2/1 row is taken, and S7 pays **$199.94**. The founder named 1.25, in the wrong field. | **yes** (the refuter's D3, run) | **Open — blocks the flip.** Fix ready: `planHoldRuling` refuses a non-null `ratio` on `coverage_gap` (400), with one row |
| **RX-2** | **The sold-doubt site's "clean" test is weaker than the engine's.** It checks `backfill.failed !== true`. The engine's own test (`dailyCoverage.js:241` `successfulBackfill`) also requires a clean parse report. A `failed: false` document with no parse report is kept over a later refetch that saw a malformed sibling row. `row`, unnamed, then takes its one 2/1 row, and S7 pays **$199.94**. | yes in the harness (D6, run) | **Open.** Reach looks low: only a backfill document written before T2D-12, which is part of this unmerged PR, would have no parse report. Not verified against any store. Fix ready: read the document through `successfulBackfill` at that site |
| **RX-3** | **The open gap takes an unnamed row from a failed backfill.** The vendor lists a readable 2/1 and an unreadable `5:4` split of one date. The backfill is stored `failed: true` with the 2/1 only, its parse report naming the rejected row. `row`, unnamed, takes the 2/1 and the shares double on both ledgers. | yes (shares; G2, run) | **Founder question Q-18.** F-1 lets the founder pick a failed backfill's rows by design (`caBackfill.js` header), and C-2's "stored clean refetch" was written for the sold doubt. Requiring a named payload when the backfill is not clean would change existing rows (`corporateActionStickyAmbiguity.test.js` rules unnamed on planted `failed: true` documents) |
| RX-4 | The ruling's `row`, and the action built from it, carry only `ratio` and `amount`; `samePayload` also compares `cashPerShare` and `renamedTo`, which are then dropped. | no (EODHD's backfill lists only splits and dividends) | recorded (latent) |
| RX-5 | On a sold holding, a ratio the vendor lists after the `row` ruling is ignored with no record; the open gap records `revised_after_ruling` in the same case. | no | recorded |

**Q-18 (RX-3).** At an open coverage gap, should `row` require a named payload when the stored backfill is not clean? A failed backfill can hide a second row of the id. Or does F-1's "the founder may pick a failed backfill's rows" stand as it is?

### 13.8 The checks

Each ran once, on the frozen code `7b7066cd`.

| Check | At | Result |
|---|---|---|
| Astra's recheck, committed byte-identical | `4bd83ff0` | SHA-256 `ae1a8014…d080` on the downloaded file and on the committed blob (LF, 17,186 bytes) |
| Astra's acceptance file (`astraConfirmation.test.js`), Windows | `7b7066cd` | **57 / 57** — her five rows, the final fix's 39, and the closeout's 13 |
| The new rows on the old code | product `e2223443`, rows `7b7066cd` | **8 red, 5 green** (§13.5): R01 and R02 with no alert; R03 2/1 first at ratio 2; the C-2 rows taking the first row; the controls, the unique row and the 5/4-first orders green |
| The Practice Field folder, Windows | `7b7066cd` (before the census row) | 1,479 / 1,480 — the one failure was the registry census naming `caParseReport.js`, then extended (§13.4); the census file 10 / 10 |
| Full Linux suite, WSL (`TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`, Node 20.20.2, lock `e457c10d0317`) | `7b7066cd` | **exit 0** · `Test Files  1596 passed \| 13 skipped (1609)` · `Tests  36831 passed \| 179 skipped (37010)` (320 s) — 13 rows more than at `90e2b220`, the closeout's |
| `npm run lint:gate` · `npx vite build` (WSL) | `7b7066cd` | **exit 0** each · `✓ built in 16.24s` |
| `npm run test:rules` (WSL, JDK 21) | `7b7066cd` | **exit 0** · `Test Files  46 passed (46)` · `Tests  841 passed (841)` |
| The end-to-end dump (`endToEnd.test.js`, its pinned `EXPECTED_DUMP`) | `7b7066cd` | byte-identical: 443,533 bytes, SHA-256 `abcf8420…ed9` (the row passes in the folder run and in the Linux suite) |
| Differentials against `cf35151b` (Astra's probes; LF archives of both commits, the vendor key synthetic, `fetch` and prices stubbed) | `7b7066cd` | `astra-differential` **36/36**, `astra-cron-trace` **40/40**, planted-backfill **4/4** (planted 100 shares, vendor 200, cash $90,000; `off` and `on`). The three evidence files are byte-identical to the earlier rounds' (SHA-256 `b6d71e76…c6c6`, `6c169f26…e760`, `80a9e53b…abcf`) |
| The mutation battery | `7b7066cd` | 22 / 22 killed (§13.6) |
| The soak | — | not run: the only product files changed are `holdRulings.js` and `caParseReport.js` (the brief's rule 5) |

### 13.9 The register

**Switch: the founder flips `'allowlist'` on this closeout's merge, with Astra's R01 and R02 accepted as alerted (C-1), and R03 fixed with her seed as a row.**

| Item | State |
|---|---|
| **Before the flip** | the closeout refuter's **RX-1** (a top-level `ratio` ignored by `row`: $199.94) is open and should be fixed first; **RX-2** (the sold-doubt site's weaker clean test) is open, with low reach. Both fixes are ready, not built (§13.7, §13.10) |
| **T5: the daily-build lease** | one daily build per session, which removes R01's and R02's race at its source (C-1). Until then, a report that changes after its close is alerted, not reopened |
| R01, R02 | accepted as alerted (C-1): the money stands as Astra observed it, and the alert names the symbol, the session and the books |
| R03 | fixed (C-2); her seed is a row |
| C-1's reach | the books named are the registry's open and draining books; a book closed for good is not named. The alert is a log line, like the Practice Field's other alerts; nothing stores it |
| Q-1, Q-15, Q-16, Q-17 | decided by the founder in Astra's recheck brief, which her recheck applied; that brief is not in this repository, so the decisions are not restated here |
| **Q-18** (RX-3) | at an open coverage gap, should `row` require a named payload when the stored backfill is not clean (§13.7)? |
| NL2c's received-sum fallback (`adjustments.js` step 3) | proven equivalent; still to remove (unchanged) |
| `evidence.test.js` 60-session row | still needs a timeout of its own (unchanged) |
| RF-3, RF-4, RF-6 | as in §12.13 (unchanged) |
| A refused CASH record (`count_on_ex_date_unknown`) | still has no founder exit (unchanged) |
| T5 (also) | the fire-time budget; the founder approvals screen — it should show Q-14 pairs, the early `possible_redate` records, a sold holding's doubt with its clean-refetch evidence and every payload its refetch lists under the doubt's ids (C-2 asks the founder to name one), a refused record's exit, and the `PRACTICE_FIELD_REPORT_CHANGED_AFTER_CLOSE` alerts; Q-6 |

### 13.10 Time

The brief arrived with Astra's recheck; `git fetch` ran at 18:04 UTC. The recheck was committed at about 18:06. C-1, C-2 and their rows were frozen as `7b7066cd` at 18:20. The battery, the red check, the differentials and the four Linux checks all ran once on it, finishing by about 18:36. The refuter returned shortly after.

The session then paused for a sign-in and resumed at 21:14 UTC, after the brief's three-hour stop (21:04), which fell inside the pause. **Nothing was built after the stop.** The refuter's RX-1 and RX-2 fixes are ready but not built: any code change would restart the battery and the four checks (about 30–40 minutes). Whether to exceed the time box is the founder's call. This section and the push are the report.
