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
