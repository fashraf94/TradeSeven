# Build T1a-2b-2 — the idea book's admission and records, finished (dark)

**Build report, Practice Field T1a-2b-2** · Claude Code (Opus 5.5) · 17 Nov 2026
**Branch:** `claude/practice-field-t1a2b2-admission-records`. The session opened in a fresh worktree of `origin/main` on an app-named branch, renamed to the prompt's name before the first commit.
**Base:** `origin/main` @ `57f50409a57d5b931ab4679e570b09f811591bdf` (the merge of PR #1078, T1a-2b-1), read after `git fetch origin` at the start. Clean tree at the start. `main` moved to `a6b7baa0` during the session (PRs #1083 and #1084); it was merged in before the final checks.
**Code head:** `49f0b609269ced3343fc3a116c4d66a489f559ae`. That is 12 commits on the base and one merge of `origin/main` at `a6b7baa0`. The merged PRs share only `compositionProtectedStoresAllowlist.json` with this build, and it merged cleanly. Against `origin/main`: 28 files, +1,980 / −147. Of these, 12 are product or config files (+757 / −89); the other 16 are tests and test support. The product code last changed at `cfa6ed49`; `49f0b609` adds one test row. This report and its `docs/README.md` row follow in one commit, which changes no code.
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged.
- No fenced file (BUILD_RULES §1), flag value, pin, rule, index or `vercel.json` changed.
- The new code calls no fenced function.
- `ledger.js` and `corporateActions.js` are untouched.

**This session made no model call, no Firestore write and no EODHD call.** Every test ran on the engine's in-memory store. The rules suite ran on the local emulator.

| Question | Answer |
|---|---|
| Does admission measure the book at current prices? | **Yes.** One set of marks per decision: the newest snapshot of the session in progress, otherwise the last completed session's close. Equity, every cap, sector exposure, the cash floor and the returned headroom all come from it, in whole cents. Astra's T1A-05 cases now come out right. After a 20% fall the short cap is **$18,798.56**, not $19,998.20. After a 20% rise the cash floor is **$59,401.08** and the Technology room is **$17,005.40** |
| Does it fail closed? | **Yes.** A held name with no full-quality mark in that set is refused `admission_marks_unavailable`, by symbol. Nothing falls back to `lastMark` or `totalValue` |
| Does it wait for a close the book owes? | **Yes.** `close_owed` from a session's scheduled end (16:00 Eastern; 13:00 on an early close) until that session's close is written. A later admission never appears on a caught-up past row |
| A thesis with a broken character? | Refused `text_invalid`, naming the field. The free-text fields are `thesis.text` and `sources[].ref` |
| Can the engine's daily top-up lose new data? | **No.** It publishes in a transaction and reconciles. MSFT's dividend survives Astra's race in both commit orders, including when one rebuild commits inside the other's transaction. The quarterly first-build and `force` paths are byte-identical to `main` |
| The four record gaps | **T2B-05:** a window's counts survive a failed row write (each action keeps a receipt on its window's row). **T2B-06:** a replayed create answers with its own book. **Q7:** a catch-up that closed a draining book counts as closed. **The packet:** at most 3,549 receipts per idea; at that bound they are 1.27 MiB, so they now live in numbered, hashed parts beside the result packet |
| Is the quarterly product unchanged? | **Yes.** Against the new `main`, on the merged tree: seventeen scenarios at both modes, **34/34 identical** (36/36 rows). Astra's traced differential: **40/40 identical**; its evidence hash, `6c169f26…`, is unchanged from the last two builds |
| End-to-end run | Re-pinned; **no money leaf changed** (§6) |
| Tests | At the final head `49f0b609` (merged with `main`): full Linux suite exit 0, `Test Files  1557 passed \| 12 skipped (1569)`, `Tests  35149 passed \| 135 skipped (35284)`; lint gate exit 0; `vite build` exit 0, `dist/` byte-identical to `main`'s; rules suite exit 0, 46 files, 839/839 |
| Review | Three lenses, a refuter on every finding, and a refuter on the fix round. One must-fix was raised (C1); its refuter moved it to should-fix, a documentation sentence plus a size row, with the structural fix carried to T1a-2b-3. Six should-fix (A1, A2, A3, B1, C2, plus the C1 doc) and the cheap notes were fixed, except A3, which is a founder question (Q1, §3.2). The fix-round refuter found two more should-fix: A6 was incomplete (F1), and a failed draft still omitted the epoch's own numbers (F2). Both were fixed, with notes N2–N4 (§5.1) |
| Mutation battery | **51 defined, 51 ran, 51 killed, 0 survived, 0 broken**: the prompt's eleven and 40 more, on the final code. One mutant (F2c) first survived: a test gap, closed by a row, then killed. One equivalent mutant from the first run is disclosed (§5.3) |
| For the founder | Six questions (§3.2). No deploy step: no rule or index changed |

---

## 1. In plain terms

Everything is still switched off (`PRACTICE_FIELD_MODE = 'off'`). No model is called and no screen shows any of it.

**Admission now prices the book as it is now.** Admission decides how much money a new idea may take: a share of the book's value, with caps per slot, per stock and per sector, and a cash floor. Until now it used the value the book last *recorded*, at the last close or fill. After a 20% move since then, a cap could let through more than $1,000 too much.

Now admission prices the whole book from one snapshot:
- **During market hours:** the newest snapshot the engine built in that session (its 10:00, 12:45 or 15:30 window).
- **Outside market hours:** the last session's close.

Every limit and the room it reports come from those same prices, to the cent. If any stock the book holds has no reliable price in that snapshot, admission refuses and names the stock. It never falls back to an old number.

What counts as reliable is the close's own test: a real price the vendor timed that session, after the open. During the session it must also be no more than 30 minutes old when the snapshot was built. And the holding's share count must still match that price, so admission refuses while:
- a split is due but not yet applied;
- an unexplained split-shaped move is open;
- a conflicting corporate action is unsettled.

**Admission waits while the book owes a close.** A session counts as finished at 16:00 Eastern (13:00 on an early close). Between that moment and the close being written (normally about 16:25), admission says `close_owed`. The same holds if a close was missed, until the next morning's window catches it up. So a new idea can never appear on the record of a day before it existed.

**A broken character is refused.** A thesis or source reference holding half of an emoji (an unpaired surrogate) is refused, naming the field. Before, Firestore would have stored a replacement character or rejected the whole admission. Whole emoji are fine.

**The engine's morning data cannot be lost in a race.** When the first build of a day's data was made for idea books alone, a later build that needs the full universe tops it up. Two such top-ups at once could erase a dividend one of them had fetched. Now the top-up writes in a transaction against what is stored:
- it keeps everything already there;
- if another top-up got there first, it keeps that result and adds only what it has that the stored one lacks.

The quarterly product's own builds are unchanged.

**Four record gaps closed:**
- **A window's record survives a failed write.** Every entry, sale, timeout or catch-up now also leaves its own receipt on that window's row, in the same transaction as the action. So if writing the row afterwards fails, the next attempt still counts the fill, once.
- **A replayed founder request answers with its own book.** If "create book" committed book A but its answer was never stored, a retry made after A closed and B opened now answers A. Before, it wrongly said "a book is already open: B".
- **The draining close counts a book closed by a catch-up as closed**, not skipped.
- **The result packet cannot outgrow Firestore's 1 MiB limit through dividends and splits.** The most receipts an idea can carry is 3,549 (13 holdings × 3 kinds × 91 calendar days). At that number they come to about 1.27 MiB. They now go into numbered, separately hashed documents beside the packet, and the packet records each one's hash.

A real feed brings an idea tens of receipts, not thousands. The review found that the idea document itself, which keeps every receipt, would also pass 1 MiB at about 2,900. That is real but far from any real feed. Fixing it means changing the corporate-action ledger, which this build was told to leave alone, so it goes to T1a-2b-3 (§8).

**What did not change.** Fills, sales, settlement, results, the close's valuation and every corporate action are as T1a-2b-1 left them. The quarterly Mandate is identical to `main` across the seventeen scenarios and Astra's 40 traced fires. In the end-to-end run, no cash, quantity, price, value or result figure moved.

## 2. Changes by `file:line`

Line numbers are at `cfa6ed49`, the last commit that changed product code; they are the same at the final head `49f0b609`.

### 2.1 Admission at current marks and the owed close (§1)

| Where | What |
|---|---|
| `api/_utils/practiceField/admissionMarks.js` (new, 251 lines) | The header (`:1`–`:31`) states both rules |
| `admissionMarks.js:44` | `ADMISSION_MARK_BASIS` |
| `admissionMarks.js:51` | `centsOf`: a stored figure that is not a number is not zero |
| `admissionMarks.js:62` | `sessionInProgressAt`: open ≤ now < scheduled end |
| `admissionMarks.js:72` | `lastCompletedSessionAt` |
| `admissionMarks.js:90` | `closeOwedSession`: the window ledger's cursor (`firstUnaccountedWindowSession`) against the session's scheduled end. A closed book owes nothing (`:93`). A cursor that is not a real calendar date, or that throws, is owed (`:96`) |
| `admissionMarks.js:112` | `admissionMarkSetCandidates`: the engine's own slot geometry, newest first. The last close outside a session |
| `admissionMarks.js:141` | `readAdmissionMarkSet`, in admission's transaction. Only a document whose own key and session match and that was built at or before now counts. Any other is recorded in `passedOver` with its reason (`:151`) |
| `admissionMarks.js:169` | `admissionMarksOf`: per open idea:<br>• the share-basis screen (`ledger.js` `saleHeldBackBy`, `:192`);<br>• the close's own valuation (`valueLedger`, `:201`);<br>• the full-quality test, and for an intraday snapshot the 30-minute age (`:208`);<br>• every book position must have a mark;<br>• the equity on the R-19 basis, in cents |
| `admissionMarks.js:235` | `admissionMarksRecord`: what the packet records |
| `api/_utils/practiceField/admission.js:107` | `invalidEpochNumbers`: the epoch's own numbers, used by both paths (fix-round F2) |
| `admission.js:118` | `marksUnavailableRefusal`, used by both paths |
| `admission.js:162` | Check 1b, `close_owed` |
| `admission.js:164`–`:168` | The marks, and the refusal |
| `admission.js:188` | Check 7 runs whenever the epoch is valid (review A2). With a held name unmarked (`marksOk` false), it still checks the epoch's own numbers and the position count, but measures no dollar limit and no permitted maximum (`:205`, `:265`) |
| `admission.js:224` | Sector exposure is held shares × the set's mark |
| `admission.js:393` | `readAdmissionMarkSet` is read before any write |
| `admission.js:405`–`:418` | A draft whose shape fails still hears `vintage_uncorrected`, `close_owed`, the marks refusal (review A1) and the epoch's own numbers (fix-round F2) |
| `api/_utils/practiceField/evidence.js:171`–`:172` | The admission packet: `equityUsd` is now the measured equity. `recordedEquityUsd` and `admissionMarks` sit beside it |

### 2.2 The broken character (§2)

| Where | What |
|---|---|
| `api/_utils/practiceField/contract.js:45` | `LONE_SURROGATE` and `hasLoneSurrogate` |
| `contract.js:54` | `CONTRACT_FREE_TEXT_FIELDS = ['thesis.text', 'sources[].ref']` |
| `contract.js:101`, `:111` | `text_invalid` with the field |

### 2.3 The daily top-up (§3)

| Where | What |
|---|---|
| `api/_utils/mandateUniverseSnapshot.js:275` | The header: the race, the transaction, the reconciliation, and what the quarterly close would do with two rows of one id (review B2) |
| `mandateUniverseSnapshot.js:307` | `reconcileDailyEntry` |
| `mandateUniverseSnapshot.js:327` | `withDailyCounts` |
| `mandateUniverseSnapshot.js:344` | `reconcileTopUp`: every stored entry is kept. "Nothing to add" is judged by value (`isDeepStrictEqual`, `:357`; review B4) |
| `mandateUniverseSnapshot.js:370` | `publishTopUp`, in a transaction |
| `mandateUniverseSnapshot.js:611` | The call site. Only the top-up branch (`carried !== null`) goes through it; the first build and `force` still use `createOrAdopt`, byte for byte |
| `mandateUniverseSnapshot.js:619` | A reconciled top-up answers with the counts it stored |

### 2.4 The four record gaps (§4)

| Where | What |
|---|---|
| `api/_utils/practiceField/windowLedger.js:84`–`:120` | T2B-05, the receipts:<br>• `WINDOW_ACTION_KIND` (`:97`);<br>• `windowActionKey` (`:102`), which escapes `%` and then `.` (review C6);<br>• `writeWindowActionReceipts` (`:109`), a blind merge into `windows/{date}_{slot}.actions` |
| `windowLedger.js:131`–`:173` | The fold:<br>• each count is the larger of the attempts' and the receipts' (`:138`);<br>• caught-up receipts join the session list;<br>• `firstAttemptAt` takes the earliest receipt time too (`:164`, review C4);<br>• the receipts stay on the row (`:173`) |
| `api/_utils/practiceField/entry.js:220` | The timeout's receipt |
| `entry.js:373` | The entry's receipt |
| `api/_utils/practiceField/exits.js:402` | Each sale's receipt, and the result's |
| `api/_utils/practiceField/close.js:437`, `:763` | A window catch-up's receipt per session it closes. The transaction that closes the book writes none (review C2: the comment says what the earlier sessions leave) |
| `close.js:828`, `:836` | `catchUpIdeaBook` passes its window on |
| `api/_utils/practiceField/sweep.js:217` | The window passes its tick to the catch-up |
| `api/_utils/practiceField/ideaBook.js:222`–`:232` | T2B-06: the operation's own book is read before the owner's claim. A replay answers with its creation receipt, and the same operation asking for another book is `op_id_conflict` naming its own book |
| `sweep.js:362` | Q7: `res.closed \|\| res.bookClosed === true` |
| `api/_utils/practiceField/evidence.js:277`–`:306` | The receipt bound, derived. Also the binding document, the idea, which review C1 flagged and T1a-2b-3 picks up |
| `evidence.js:311`, `:313` | `RESULT_RECEIPT_PART_MAX_BYTES` (512 KiB) and `RESULT_RECEIPT_BOUND` |
| `evidence.js:320` | `firestoreValueBytes` |
| `evidence.js:335` | `resultReceiptParts`: split by size, in order, each part sealed |
| `evidence.js:362`, `:380` | `resultPacketPartProblems` and `resultPacketReceipts`, for readers |
| `evidence.js:532` | `buildResultEvidence` returns the packet and its parts. The packet's `corporateActions` is `{ receipts, byLedger, parts: [{ id, receipts, contentHash }] }` (`:586`) |
| `close.js:698`, `:751` | The close builds them and `tx.create`s every part beside the packet |

### 2.5 Test support, guards and moved rows

- **`__testsupport__/fixtures.js:275`, `:281`, `:296`.**
  - `catchUpAt`.
  - `admitAndEnter` runs the window's catch-up before its entry, as a real window does, so a book's creation day is accounted for before its first fill.
  - `admitAllThenEnter` admits several ideas before any of them fills.
- **`compositionProtectedStoresAllowlist.json`.**
  - Two keys are added: `mandateUniverseSnapshot.js::publishTopUp::set` and `windowLedger.js::writeWindowActionReceipts::set`.
  - `close.js::closeNextSession::create` goes from 2 to 3 sites (the parts).
  - The notes are under `_notes_practice_field_t1a2b2`.
- **`compositionProtectedStores.scan.test.js`.** The caller tally gains `fixtures.js::catchUpAt::catchUpIdeaBook`.
- **Rows that moved, each on purpose.** Several rows admitted an idea at a time *before* a fill they follow in code order. That was a time-travel the new rule cannot measure: there is no snapshot of the earlier session holding a stock bought later. Those rows now admit first and then fill, with the same ideas, windows and assertions:
  - `corporateActions.test.js` ×5 (via `admitAllThenEnter`);
  - `entry.test.js` ×3;
  - `exits.test.js` ×1;
  - `close.test.js` ×1;
  - `reconcile.transitions.test.js` ×1;
  - `founderControls.test.js` ×1 (the admission after the window that entered the first idea).
- **Rows given the window snapshot they would have had.** Rows that admit at 11:00 now store that day's 10:00 window snapshot first:
  - `admission.test.js` (B-RESERVE);
  - `exits.test.js`, `catchUp.test.js` ×2, `corporateActions.test.js` ×1, `evidence.test.js` ×2.
- **Rows whose expectations changed:**
  - `admission.test.js`: "several failures at once" now also lists `close_owed`. The "missing limit" row tests a null treasury, since `totalValue` is no longer read. The calendar row seeds its books on the admission morning.
  - `corporateActions.test.js` ×2: a rename that waits on an unresolved share basis also refuses AAPL's mark.
  - `evidence.test.js`: B12's admission is now refused (§2), and the packet's own guard is tested directly. The packet's receipts are read from its part.
  - `windowLedger.test.js`: a served row now holds its entry's receipt.
  - `endToEnd.test.js`: re-pinned, §6.

## 3. Readings stated, and questions for the founder

### 3.1 Readings

| # | Where the prompt left room | What was built |
|---|---|---|
| R-1 | "During a session" | From the session's open up to, but not including, its scheduled end. "The newest snapshot the engine has built in that session" is the latest of the engine's slot snapshots (`{date}_{slot}`, from the engine's own geometry) whose slot has opened, whose document is that key's and that session's own, and that was built at or before the decision. Between 09:30 and the first window (10:00) no snapshot exists yet, so a book holding anything is refused `admission_marks_unavailable` (`no_snapshot_yet`). The previous close is not used |
| R-2 | "Full-quality mark" | The close's own test (`closeMarkQuality` = `vendor_time`): a complete quote the vendor timed in that session, at or after its open. For an intraday snapshot it must also be within the idea book's 30-minute quote age at the snapshot's build (`quotePastMaxAge`, the fills' rule). The holding's share count must also be one that price can be trusted against: the sales' own screen (`saleHeldBackBy`). That refuses while any of these is open:<br>• an action due and unapplied (a dividend's too: until the close credits it, the ex-date price is not the holding's whole value — see Q1);<br>• an unsettled conflict;<br>• a held action;<br>• a suspected split |
| R-3 | "Any ledger the caps read" | Each open idea's own ledger; the book's positions mirror them, and every position is checked to have a mark. The comparison and SPY ledgers are shadows that no cap reads |
| R-4 | The equity | The R-19 basis (`ledger.js` `markedEquityCents`) at the set's marks: the treasury, plus each open idea's cash, plus its holdings at those marks rounded once per idea. This is the close's own valuation, in whole cents. `portfolio.totalValue` is no longer read. The packet keeps it as `recordedEquityUsd`, and its `equityUsd` now means the measured equity |
| R-5 | What is measured with a mark missing | No dollar limit and no permitted maximum (`permittedMaxUsd: null`). What needs no mark is still checked and refused beside it: the epoch's own numbers and the position count (review A2) |
| R-6 | "Not closed every completed session" | The window ledger's cursor (`firstUnaccountedWindowSession`): the later of the valuation's last close and the window ledger's own, otherwise the book's creation session. If it names a session whose scheduled end has passed, a close is owed. Exactly 16:00 (or 13:00) is owed. A cursor that cannot be read (not a real calendar date, or one the ledger cannot follow) is owed, typed `{ session: null }`. A closed book owes nothing: it is refused `book_not_active` (fix-round F1, N2) |
| **R-7** | **Worst-case mark age during a session, under today's slots** | The windows are at 10:00, 12:45 and 15:30 (early close: 10:00, 11:15, 12:30). A snapshot's quotes may be up to 30 minutes old at its build, and the cron fires twice in each slot. Measured by the review (rows E1–E4, refuter A4):<br>• **Regular session:** at most **3 h 30 m** when every window's snapshot is built (a 09:30 quote in a 10:00 snapshot, used at 12:59:59 when the midday snapshot was built on its second fire).<br>• If midday and pre-close are never built: **6 h 30 m**.<br>• **Early close:** at most **2 h**; **3 h 30 m** with only the first window built.<br>The age at admission is recorded per mark in the packet (`ageAtAdmissionMs`). No maximum is enforced — Q2 |
| **R-8** | **Between a session's end and its close being written** | Admission is refused `close_owed` from 16:00 (13:00 early close) until the close of that session is written: normally at the first close fire after the snapshot is built (about 16:15–16:25), at the latest by 18:00. If no close is written by then, the refusal lasts until the next session's first window (10:00) catches that session up. Once the close is written, admission measures at that close's snapshot |
| R-9 | Outside a session | The last completed session's close, also before the next open (pre-market moves are not seen). That close is always stored for a book that is not owed a close: a session closes only from its stored snapshot, or is caught up at the next session's window, which is inside a session. If the stored close has been removed (an operator, retention), held names are refused |
| R-10 | §2's "every other free-text field" | `thesis.text` and `sources[].ref`. Every other string the contract stores is checked against a closed list (author, slot, comparison type, origin kind and initiator, a source's kind) or the house universe (names, the comparison's symbols, the lines' symbols, the weights' keys). A lone high, a lone low and a low-then-high pair are refused; a whole emoji is accepted |
| R-11 | §3's "reconcile newly requested symbols explicitly" | Every stored entry is kept, including one outside this rebuild's build set. For a symbol both rebuilds fetched, the stored entry stands, and this rebuild adds only what it lacks: a corporate-action row it does not list (by content), the classification when it has none, and a successful fetch over a failed one. Two different answers for one action id are both kept (review B2 and its refuter: deduplicating by id would make the result depend on commit order and hide a feed disagreement; for an idea book the ledger's conflict rule decides) |
| R-12 | T2B-05: "say which you chose" | **An idempotent pending-window receipt with each action**, written in the action's own transaction, rather than counts reconstructed from committed receipts. A timeout and a caught-up session have no record keyed by their window, and the row is the one document the fold already reads. A row holding receipts and no attempt reads as attempted and not served |
| R-13 | T2B-06: the replay's answer | `{ ok: true, bookId: A, epochId, idempotentReplay: true }`, the creation's own answer. Through the founder endpoint, the recovered request is stored as 200 with `idempotentReplay: true` (the shape the endpoint already gave an open book's recovered create; review C5) |
| R-14 | The packet's bound | Per holding, per ledger, per date, at the largest shape:<br>• 13 holdings: four names, an eight-name frozen basket, SPY;<br>• × 3 kinds: the feed's only kinds — split, reverse split, cash dividend; one id per kind, ticker and date;<br>• × 91 calendar dates: after the entry session and up to the due session; the longest long slot on the maintained calendar is 17 Nov 2026 → 16 Feb 2027.<br>That is **3,549**, and each factor is derived from the code in `evidence.test.js`. At every field the applier can write, they measure 1,328,873 bytes. So they are split, by size, into parts of at most 512 KiB: three at the bound. The packet stays about 233 KiB |
| R-15 | The fixtures | An entry the fixtures make "at a window" now runs the window's catch-up first, as `runIdeaBookWindow` does. Rows that call a fill directly, to test the guard behind the catch-up, still do (`catchUp.test.js`, `entry.test.js`, `exits.test.js`) |

### 3.2 Questions for the founder

| # | Question | What is built meanwhile |
|---|---|---|
| Q1 (review A3) | On the ex-dividend date of any stock a book holds, that stock's price drops by the dividend, but the dividend is credited only at that evening's close. Admission therefore refuses all session (`corporate_action_pending`), and an idea drafted then starts a session later. Keep the block, or value such a stock at its price **plus** the dividend it is owed (the refuter showed that the price alone, without the receivable, would loosen the cash floor)? | The block |
| Q2 (R-7) | During a session the marks can be up to 3½ hours old (6½ if windows are missed). Set a maximum age at admission? | No maximum; each mark's age is recorded |
| Q3 | A stock the book holds that is never quoted again (a delisting without cash, waiting to be sold; a long halt) blocks every admission of the book. Its sale needs a quote too, so this lasts until T5's founder tool. Acceptable until then? | As described |
| Q4 (review A9) | A book created between 17:46 and 17:59 Eastern owes that day's close, but the last close fire is at 17:45. So admission waits until the next morning's 10:00 window (one start session lost). Move the creation cutoff to the last close fire? | The T1a-2b-1 cutoff (18:00) |
| Q5 (review A5) | Admission has no guard against a request dated inside a session the book has already closed. Only a stale clock reaches it; the endpoint passes the current time. Add a guard? | None |
| Q6 (review C1) | The idea document keeps every corporate-action receipt and passes 1 MiB at about 2,900 of them. A real feed brings tens. Take the receipts off the idea document in T1a-2b-3, with Astra's corporate-action review? | Documented in `evidence.js`; a size row measures it |

## 4. Tests

No model call, no Firestore write, no EODHD call (rule 3). The in-memory store ran the unit rows; the local emulator ran the rules rows.

### 4.1 Where each section is tested

| Section | File (new rows) | What the rows show |
|---|---|---|
| §1 | `admissionMarks.test.js` (18) | • Astra's T1A-05 decline and rise, to the cent, with the packet's record.<br>• No move gives the recorded equity.<br>• The newest snapshot, a snapshot built after the decision, and a newest one without the held name.<br>• Fail-closed for a receipt-time, incomplete, pre-open or stale (30 m 1 s) quote; 30 m 0 s passes.<br>• No snapshot before 10:00; a suspected split; a split due today.<br>• A book holding nothing.<br>• A2 and A1, with the epoch's own numbers on a failed draft (fix-round F2).<br>• `close_owed` at 15:59:59.999, 16:00 and 16:10, then admitted after the close and measured at it.<br>• A missed close refused, then admitted after the window caught it up, and never on that day's row.<br>• The early close at 13:00; the creation cutoff; an unreadable cursor (A6), including a day that does not exist and a cursor that is not a string, in either field (F1, N4); a closed book owes nothing (N2).<br>• Saturday and pre-open use Friday's close; a removed close refuses.<br>• Integer cents and the boundary.<br>• A document under the wrong key; `passedOver` (A7) |
| §1, endpoint | `founderControls.test.js` (1) | `admit_fixture` returns `close_owed` and `admission_marks_unavailable` exactly as admission gave them, and replays them |
| §1, end to end | `endToEnd.test.js` (A10) | An admission while B holds XOM is measured at the 10:00 window's prices, not the recorded equity, and refused. Nothing is written |
| §2 | `admission.test.js` (2) | A lone high and a lone low surrogate, at the start, middle and end, in each field and in the second source. A whole emoji passes. Through admission and through the founder's endpoint: refused, nothing written |
| §3 | `mandateUniverseSnapshot.topUp.test.js` (15) | • Astra's race in both commit orders.<br>• Divergent, empty and failed answers in both orders.<br>• A classification only one rebuild obtained.<br>• The interleaved transaction in **both** directions.<br>• Every prior entry kept.<br>• `reconcileDailyEntry`.<br>• B4 with keys returned sorted.<br>• The first build (exact document, no transaction), two racing first builds, `force`, and an unmarked document: unchanged |
| T2B-05 | `windowLedger.test.js` (6) | • An entry whose row write fails, retried: the fill shown once, and a served row never rewritten.<br>• A sale whose row write fails twice.<br>• A catch-up; a timeout; and with no window, no receipt.<br>• The fold never doubles.<br>• C6 key escaping |
| T2B-06 | `ideaBook.test.js` (1), `founderControls.test.js` (1) | The engine's replay after A closed and B opened. Astra's sequence through the endpoint, with the `done` write failing |
| Q7, C2 | `founderControls.test.js` (2) | The draining sweep counts the catch-up's close as closed. A two-session catch-up that closes the book leaves the first session's receipt and nothing else |
| Packet | `evidence.test.js` (size row extended), `endToEnd.test.js` | The bound derived from the code and the calendar. 3,549 receipts at the bound: three parts, each under 512 KiB + 1 KiB; the packet under 256 KiB; the parts whole, in order, and their hashes covered. The idea document measured (C1). Every idea's parts whole and complete in the end-to-end run |

### 4.2 Commands and results

Linux runs used WSL Ubuntu, in a private worktree of `~/pd-ci` at the commit named, on Node 20.20.2, with the install matching the lockfile (`e457c10d0317`) and `TZ=UTC`. Each full suite ran alone, under the lock.

| Check | Command | Result |
|---|---|---|
| Practice Field, endpoint, isolation, trace and seam files (Windows) | `npx vitest run api/_utils/practiceField api/practice-field api/cron/practiceFieldIsolation.test.js api/cron/practiceFieldNoBook.trace.test.js api/_utils/filmRoom/practiceFieldSeam.test.js` | **653 passed, 0 failed** (at `cfa6ed49`) |
| Snapshot, top-up, scan and interleaving files (Windows) | `npx vitest run api/_utils/mandateUniverseSnapshot.topUp.test.js api/_utils/mandateUniverseSnapshot.test.js api/_utils/compositionProtectedStores.scan.test.js api/cron/mandateBatchInterleavings.test.js` | exit 0 · `Test Files  4 passed (4)` · `Tests  73 passed (73)` |
| **Full suite (Linux, final head `49f0b609`, merged with `main`)** | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit 0** · `Test Files  1557 passed \| 12 skipped (1569)` · `Tests  35149 passed \| 135 skipped (35284)` · 328.62 s (read from the log; log SHA-256 `fbfb75ab438d54c7…`). The 8 files and 305 rows more than at `a604a9ec` are `main`'s merged tests: the fix round added assertions inside existing rows, not rows |
| Full suite (Linux, at `a604a9ec`, before the fix-round fixes and the merge) | the same | exit 0 · `Test Files  1549 passed \| 12 skipped (1561)` · `Tests  34844 passed \| 135 skipped (34979)` · 318.24 s (log SHA-256 `08dcc8c00ff27873…`). 6 rows more than at `cb2a9cbc`: the review round's new rows |
| Full suite (Linux, before the review fixes, at `cb2a9cbc`) | the same | exit 0 · `Test Files  1549 passed \| 12 skipped (1561)` · `Tests  34838 passed \| 135 skipped (34973)` · 322.15 s |
| Lint gate | `npm run lint:gate` | **exit 0** (`--max-warnings 0`) at `49f0b609`; also at `d547e313` and `a604a9ec` |
| Production build | `npx vite build` | **exit 0**. `dist/` (113 files) is **byte-identical** to `main`'s build made in the same worktree: the hash list is `0537d4e61af1e8f7…` for both `a6b7baa0` (the new `main`) and `49f0b609`. Earlier it was `17ec6e2f776084b2…` for both `57f50409` and `a604a9ec`. Rollup's chunk-size warning is on `main` too. The pushed head, with this report, is built again before the push; the PR description gives that result |
| Rules suite | `npm run test:rules` (JDK 21, the local emulator; no rule or rules test changed) | **exit 0** at `49f0b609` · `Test Files  46 passed (46)` · `Tests  839 passed (839)`. The same at `a604a9ec` |
| The seventeen-scenario differential, both modes, against `origin/main` | Astra's `astra-differential.test.js`, unmodified (SHA-256 `17e724ad…`); base `a6b7baa0` (the new `main`), head `d547e313` (the merge; `49f0b609` adds one test row and no source), LF archives, her layout | exit 0 · **34/34 identical** (17 at `'off'`, 17 at `'on'`); 36/36 rows with the 4,000-case build-set row and the prompt rows. Also 34/34 against `57f50409` at `a604a9ec` and at `6268371a` |
| The 40-case traced differential, against `origin/main` | Astra's `astra-cron-trace.test.js`, unmodified (`9297cead…`); the same base and head | exit 0 · **40/40 identical** (20 per mode). Evidence hash `6c169f26…`, unchanged from T1a-2b-1. Also 40/40 against `57f50409` at `a604a9ec` and at `6268371a` |

Two notes on these runs:
- The 17-scenario harness touches `ensureDailySnapshot`'s first-build path on every fire, so its identity is the byte-for-byte proof of §3's "first build unchanged". The `force` path is pinned by the top-up file.
- On Windows, `mandateUniverseSnapshot.imports.test.js`'s self-check fails, on `main` exactly as here (path separators). It passes on Linux.

## 5. The review (BUILD_RULES §2)

The diff crosses the threshold. Three lenses reviewed `cb2a9cbc`, each on its own read-only `git archive` snapshot with `node_modules` linked, told to find defects and fix nothing:
- **A:** admission — the marks, the caps, the gate, and §2.
- **B:** the engine's top-up and the quarterly product.
- **C:** records — window counts, the founder replay, the packet size.

Every finding then went to a refuter on a fresh snapshot, told to break it. The fixes (`2c84515b`, `aa8b5dea`, `a604a9ec`) went to a fix-round refuter on a snapshot of `a604a9ec`; its findings were fixed in `cfa6ed49`. The mutation battery ran last, on its own tree. No reviewer or refuter wrote to the repository or ran a writing git command.

### 5.1 Findings and dispositions

| # | Finding (lens) | Refuter | Disposition |
|---|---|---|---|
| A1 | A draft whose shape fails drops `close_owed` and the marks refusal (should-fix) | CONFIRMED, should-fix (low). It also drops `vintage_uncorrected`, which predates this build | **Fixed**, all three (`admission.js:405`); rows added. The fix-round refuter found the epoch's numbers still missing (F2), now fixed |
| A2 | An unmarked holding hides `epoch_config_invalid` and `position_count_exceeded` (should-fix) | CONFIRMED mechanically, graded a note. Deleting the guard would throw and measure a phantom equity; the right fix is a split | **Fixed** as the split (`admission.js:188`); row added |
| A3 | A dividend due today blocks admission all session (should-fix, founder) | Behaviour CONFIRMED. Direction PARTLY: the price without the receivable loosens the cash floor, but not the sector room against the right baseline | **Kept**, and asked: Q1 |
| A4 | The 30-minute age binds at build, not at admission (note) | PARTLY: the worst case is 3 h 30 m, not 3 h 15 m | R-7 and Q2 |
| A5 | No guard for a `nowIso` inside a closed session (note) | CONFIRMED; unreachable with a real clock | Q5 |
| A6 | A cursor that is not a date throws (note) | CONFIRMED | **Fixed** (`admissionMarks.js:96`); completed after the fix-round refuter (F1, N4) |
| A7 | The packet does not say why a newer snapshot was passed over (note) | CONFIRMED | **Fixed**: `passedOver` |
| A8 | An after-hours print in the close counts as full quality (note) | CONFIRMED; it is the close's own rule | §8 |
| A9 | A book created 17:46–17:59 owes a close no fire can serve (note) | CONFIRMED; costs one start session | Q4 |
| A10 | The end-to-end run never admits on a holding book (note) | CONFIRMED | **Fixed**: an admission while B holds XOM |
| FQ | A never-quoted holding blocks admission (founder) | CONFIRMED, and lasts until T5's tool | Q3 |
| B1 | No test pins the transaction: a read outside it passes all tests (should-fix) | CONFIRMED (real at `cb2a9cbc`) | **Fixed** before the refuter ran: the interleaved race in both directions (`abf40ae4`); mutant B6 is killed by it |
| B2 | Two different rows of one action id are kept; the quarterly close would pay both (note) | CONFIRMED as latent: unreachable, since no quarterly position is entitled on a topped-up day. **Do not deduplicate by id** (commit-order dependence; it hides a conflict) | **Comment corrected** (`mandateUniverseSnapshot.js:292`); the quarterly close's own behaviour is in §8 |
| B3 | Q7 moves the sweep's completion claim one fire later (note) | CONFIRMED; never wrong, never a double count | Intended |
| B4 | "Nothing to add" compared by key order (note) | CONFIRMED if reads come back key-sorted | **Fixed**: `isDeepStrictEqual`; row added |
| B5 | A `force` inside a top-up loses the carried dividend (note) | PARTLY: `force`'s own blind replace, in either order; no caller passes `force` | Note |
| B6 | Exhausted retries throw before the upstream count (note) | CONFIRMED; base's failed `set` has the same shape | Note |
| B7, B8 | A pre-existing first-build race; the top-up's stored document now differs (notes) | CONFIRMED pre-existing / intended; no reader depends on the old shape | Notes |
| C1 | The idea document keeps every receipt and passes 1 MiB at the bound; the close would wedge (**must-fix**) | **PARTLY: must-fix refuted.** The arithmetic is exact, but no real feed comes near (the realistic worst is about 60 KB), the idea document is byte-identical to base, and the fix is in `ledger.js`, outside this build. Should-fix: say so, and measure it | **Fixed** as the refuter graded it: a paragraph in `evidence.js:300` and a size row (about 2,900 receipts fit at the measured shape). The structural fix goes to T1a-2b-3 (Q6) |
| C2 | A multi-session catch-up that closes a book leaves the earlier sessions' receipts on a closed book's window row (should-fix) | CONFIRMED; nothing reads the row. Base leaves rows on closed books on its failure path too. Prefer correcting the comment and pinning it over a delete | **Comment corrected** (`close.js:759`); row added |
| C3 | A served row can take a later merge if the stamp fails and the slot's next fire acts (note) | CONFIRMED but latent. The premise was mis-stated: the sales pass reads the day document live | Note, §8 |
| C4 | `firstAttemptAt` describes only recorded attempts (note) | CONFIRMED | **Fixed** |
| C5 | A recovered create is stored as 200 with `idempotentReplay` (note) | CONFIRMED; the shape predates this build, and on the closed-book path head is better than base | Note (R-13) |
| C6 | `%` not escaped in receipt keys (note) | CONFIRMED but unreachable | **Fixed** |
| Pointer | The top-up's content union can leave two payloads of one id: a conflict (note) | PARTLY: needs two concurrent top-ups and two vendor answers; the dividend is held for one close and applied at the next unless the lookback ends | Note (with B2) |

**The fix-round refuter** (on a snapshot of `a604a9ec`; baseline 20 files, 550 rows green before any probe) found no must-fix. It found two should-fix, one stale comment and five notes. All but N1 and N5 were fixed in `cfa6ed49`:

| # | Finding | Disposition |
|---|---|---|
| F1 | **A6 was incomplete** (should-fix). The guard checked only the shape `YYYY-MM-DD`. A date-shaped string naming no real day read as nothing owed (`2026-11-99`, `2026-13-45`: admission went through), or as the wrong session (`2026-02-30` named 3 March). A bad `windowsAccountedThrough` beside a good `lastCloseKey` did the same. Only calendar-walk writers set either field, so a real book never holds one | **Fixed** (`admissionMarks.js:96`): a cursor is read only when it is a real calendar date (it must survive a round trip through `Date`). Anything else is owed, `{ session: null }`. Rows: every bad value in both fields, with a real-cursor control |
| F2 | **A draft whose shape fails still omitted the epoch's own numbers** (should-fix). A1's commit said every failure needing no mark or contract is still said; the epoch's numbers need neither (only the slot's cap needs the draft's slot). The draft was refused either way | **Fixed**: one helper, `invalidEpochNumbers` (`admission.js:107`), used by both paths. The shape-failed branch says `epoch_config_invalid` for all but the slot's cap, and the treasury (`:414`). Row: a broken epoch gives the same constraints on a failed draft and a whole one |
| F3 | Two comments still said "check 7 measures nothing" after A2 (stale comment) | **Fixed** (`admission.js:18`, `:164`) |
| N1 | Unmarked and over the position count: `permittedMaxUsd` is `null`, not `0` | **Kept, by design.** Nothing gets through, and the A2 row pins it; with a mark missing no maximum is stated (R-5) |
| N2 | A **closed** book was told `close_owed` for a session no close will run (beside `book_not_active`) | **Fixed** (`admissionMarks.js:93`): a closed book owes nothing. Row added |
| N3 | The C1 comment said about 2,700 receipts; its own size row measures 2,879 | **Fixed**: about 2,900 (`evidence.js:302`) |
| N4 | A cursor that is not a string (a number, an object) fell back to the creation session: closed, but the wrong session named | **Fixed** with F1: anything that is not a real date string is unreadable. Rows added |
| N5 | `firstAttemptAt` takes the smallest string; mixed ISO precision would sort out of time order | **Not fixed: unreachable.** Every `at` comes from `Date#toISOString()` |

The refuter also confirmed, by its own mutants, that A10's row tests measurement at current marks, that A2 lets nothing through, that A1's branch neither throws nor writes with the epoch or contract missing, and that the B2, C1 and C2 comments hold. The F-fixes were checked by their own rows and by mutants F1a–F2c (§5.2). **No further refuter ran on them.**

**What the lenses and refuters found sound** (at `cb2a9cbc`):
- **§1:** R-19 equality at decimals; DST boundaries; refusals write nothing; a retried admission measures at the close it was retried against. The fixture change and the moved rows weaken no row: counts per file are equal or higher, and the direct-fill guard rows still call fills directly.
- **§3:** first build, `force` (over a full doc and over an omitted doc), adopt and racing first builds all store and return byte-identical results to base. Three top-ups in all six orders keep every dividend. A deletion inside the transaction is handled. Nothing reads the changed count fields.
- **Records:**
  - The end-to-end leaf comparison was reproduced exactly.
  - Every path that acts at a window writes a receipt, and a retried transaction writes one.
  - The packet bound's factors match the code: nothing produces `ticker_change`, `stock_distribution` or `delisting`, and a LATE endpoint is unreachable.
  - Parts are create-once and their hashes are covered.
  - T2B-06's other replays are unchanged.

### 5.2 The mutation battery

Each mutant re-breaks one rule in an LF `git archive` tree of the final code (`cfa6ed49`; the merge of `main` after it touches none of the mutated files), never the working tree. The runner then runs that mutant's test files with a JSON report, deleted beforehand. A mutant counts as killed only when the run exits non-zero **and** at least one row fails. The runner checks that every anchor occurs exactly once, restores each file, and checks each restore by hash. The unmutated baseline was 191 rows in 8 files, all green.

**Result: 51 defined, 51 ran, 51 killed, 0 survived, 0 broken.** In the full run, 50 were killed and F2c survived (§5.3). The row that closes it was added (`49f0b609`), and F2c, with three neighbours as a control, was killed on the rerun.

| Id | Re-breaks | Rows failed |
|---|---|---|
| **B1a** | admission uses `totalValue` | 4/58 |
| **B1b** | admission uses `lastMark` (sector exposure) | 3/58 |
| **B2** | a held name with no mark is admitted (at its recorded mark) | 2/58 |
| **B3** | an admission is accepted with a close owed | 5/85 |
| **B4** | a lone surrogate is accepted (the thesis) | 3/63 |
| **B5** | the slower top-up overwrites the faster's new symbol | 6/15 |
| **B6** | the precondition is dropped (the publish reads outside its transaction) | 1/15 |
| **B7a** | a quarterly build path is changed: the first build through the top-up publish | 2/15 |
| **B7b** | a quarterly build path is changed: `force` through the top-up publish | 1/15 |
| **B8** | a window's count is lost after a failed row write (the fold ignores the receipts) | 4/32 |
| **B9** | T2B-06 names book B (the claim read before the operation's own book) | 2/60 |
| **B10** | a catch-up close is counted as skipped | 1/27 |
| **B11** | the receipt bound is not enforced (one part, any size) | 1/23 |
| X1 | the oldest snapshot of the session, not the newest | 4/58 |
| X2 | an intraday quote past 30 minutes is a mark | 1/58 |
| X3 | the share-basis screen dropped | 2/58 |
| X4 | a snapshot built after the decision is used | 1/58 |
| X5 | a document not its key's own is used | 2/58 |
| X6 | 16:00 itself is not owed | 2/58 |
| X7 | the early close ends at 16:00 | 1/58 |
| X8 | an unreadable cursor owes nothing | 1/58 |
| X9 | a null treasury reads as zero | 1/58 |
| X10 | the packet records the recorded equity as the measured one | 1/41 |
| X11 | a lone surrogate in a source reference is accepted | 1/40 |
| X12 | a lone *low* surrogate is accepted | 2/40 |
| X13 | a prior entry outside the build set is dropped | 7/15 |
| X14 | a failed fetch stays failed beside a successful one | 2/15 |
| X15 | the newer fetch adds no corporate action | 5/15 |
| X16 | an entry writes no receipt | 2/32 |
| X17 | a timeout writes no receipt | 1/32 |
| X18 | a sale writes no receipt | 1/32 |
| X19 | a window catch-up writes no receipt | 1/32 |
| X20 | the closing catch-up writes a receipt on the closed book | 2/27 |
| X21 | the fold drops the caught-up receipts | 1/32 |
| X22 | the packet does not record a part's hash | 3/26 |
| X23 | the close does not write the parts | 2/26 |
| X24 | one ledger's receipts left out of the parts | 1/26 |
| RA1 | a failed draft does not hear the owed close | 1/58 |
| RA2 | an unmarked holding hides the epoch and position-count checks | 1/58 |
| RA6 | a cursor that is not a date throws (shape check and catch both removed) | 1/58 |
| RA7 | `passedOver` not recorded | 1/58 |
| RB4 | "nothing to add" judged by key order | 1/15 |
| RC4 | `firstAttemptAt` ignores a lost attempt's receipt | 1/32 |
| RC6 | a receipt key does not escape `%` | 1/32 |
| F1a | a date-shaped cursor naming no real day is read (no round trip) | 1/58 |
| F1b | a cursor that is not a string is read (the pre-fix test) | 1/58 |
| F1c | only `lastCloseKey` is checked; a bad `windowsAccountedThrough` is read | 1/58 |
| N2 | a closed book is told `close_owed` | 1/58 |
| F2a | a draft whose shape fails does not hear the epoch's own numbers | 1/58 |
| F2b | the slot's cap is judged without a slot (a failed draft told `slot_cap`) | 3/58 |
| F2c | the whole draft no longer judges the slot's share (survived the full run; killed after the row was added) | 1/58 |

The prompt's eleven, by mutant:
- admission uses `totalValue` or `lastMark`: B1a, B1b;
- a held name with no mark is admitted: B2;
- an admission accepted with a close owed: B3;
- a lone surrogate accepted: B4 (also X11, X12);
- the slower top-up overwrites the faster's new symbol: B5;
- the precondition dropped: B6;
- a quarterly build path changed: B7a, B7b;
- a window's count lost after a failed row write: B8;
- T2B-06 names book B: B9;
- a catch-up close counted as skipped: B10;
- the receipt bound not enforced: B11.

### 5.3 Disclosed

- **Three runs of the battery.**
  - **The final run** (`cfa6ed49`, all 51): F2c **survived**. Removing the slot from the whole draft's epoch check left a slot share that is a number but not a share (1.5, −0.1) unrefused: its limit is a whole number of cents, so the backstop at `admission.js:258` does not catch it, and no row held such a value. That is a test gap, not a code defect (the check was there before T1a-2b-2 and is unchanged). The L1-7 row in `admission.test.js` now holds both values (`49f0b609`), and F2c was killed.
  - The first run defined RA6 as removing only the cursor's shape check. It **survived**: the `try`/`catch` behind it returns the same typed answer, so that mutant is equivalent (two layers, either alone sufficient). RA6 was redefined to remove both, which is the pre-fix code, and was killed.
  - In the same run, X4 and X5 printed BROKEN: the A7 fix had changed their anchor lines. Both were re-anchored and killed.
  - The table above is the final state. Every run's log is in the session's scratchpad.
- **Lens B's B1 was fixed before its refuter ran.** The refuter judged it against `cb2a9cbc`, as asked.
- **Probe cleanup.** One lens's first run wrote a duration entry into the shared vitest cache under `node_modules/.vite` before it switched to `--no-cache`. No probe path appears in it.

## 6. The end-to-end comparison

The run was dumped on the base (`57f50409`), and the base reproduced the T1a-2b-1 pin `f9c91e33…` (384,605 bytes, 155 documents) byte for byte. It was then dumped on the code head and compared leaf by leaf. Lens C reproduced the comparison independently.

| | SHA-256 | Bytes | Documents |
|---|---|---|---|
| T1a-2b-1 (`main`) | `f9c91e33f6bafa05…` | 384,605 | 155 |
| This build (`a604a9ec`; the same at `49f0b609`, where the pinned row passes in the full suite) | **`288b0c895bd86a06181d501fb862962d86e445b1c632c1921a7baab413d0069c`** | 389,807 | 163 |

**Leaf by leaf, base against head:**
- **No money leaf changed:** no cash, quantity, fill, mark, value, gap, decline, exposure, limit or result figure. Every admission in the pinned run is made by a book that holds nothing, so the equity measured at its marks (§1) is the recorded one (`equityUsd` is unchanged on all three packets).
- **8 documents added:**
  - B's result packet's one receipt part, `evidence/result_actions_001`, holding its split and its dividend (§4.4);
  - 7 intraday window rows holding only the receipt of what code did there: an entry, a sale, a result (§4.1). The run drives its windows directly, so no attempt is recorded on them.
- **63 leaves added:**
  - on each admission packet, `admissionMarks` (with `passedOver`) and `recordedEquityUsd`;
  - on each result packet, `corporateActions.{receipts, byLedger, parts}`;
  - on 7 close rows, `session.notServedButAttempted` now names the window that was acted at and never recorded.
- **37 leaves removed:** the result packets' inline receipt arrays (B's two receipts now sit in its part).
- **6 leaves changed:** the six packets' `contentHash`, which follow from the above.

The run also makes one admission while B holds XOM (review A10). It is refused at the 10:00 window's prices, which differ from the recorded equity, and it writes nothing: the dump is the same with or without it.

## 7. §5's confirmations

| Item | Closed by merged code? | Evidence | What remains, and its home |
|---|---|---|---|
| **T1A-08:** recovery after `'off'`, with the original clock and the separately recovered dates | **Yes, by T1a-2a's catch-up (E12).** The next close (or window) closes every missed session in order from its own stored close snapshot. A missing one is closed `unobserved`, and nothing is fetched or invented. Entry timeouts, due-session endpoints, late line recognition and draining books are handled. No clock moves: schedules are byte-equal before and after | `catchUp.test.js:240` (Astra T1A-08: off for two sessions, with a due session and an entry timeout in the gap and one gap session with no stored snapshot; on again, the next close catches up; schedules unchanged; a date before the last close still `out_of_order`); also `:70`, `:103`, `:194`, `:219`, `:389`, `:403` | One residual, for **T1a-2b-3**. While `'off'`, an idea book contributes no symbols to the snapshots. A close snapshot built for quarterly books during the gap therefore lacks the idea's names: the catch-up carries those marks (not full quality), and a corporate action dated in the gap is never presented to the idea if it falls outside the feed's 5-day lookback of the first close after `'on'`. The gap screen catches a split-shaped move; a missed dividend would go unnoticed. This belongs with the corporate-action finish |
| **FR-A7:** the entry trusting its caller's snapshot by key alone | **Yes, by T1a-2a.** Every fill (entry and sale) reads THE stored slot snapshot itself, by key, inside its transaction; a caller's object never reaches a fill, and a stored document that is not the slot's own is refused | `entry.test.js:418` (FR-A7: nothing stored → no fill whatever object is handed in; stored and handed objects differ → the stored prices fill; a close snapshot, another slot's or another session's document under the key → refused, nothing written); `exits.test.js:704` (the same for a sale); `close.test.js:778` | Nothing |

## 8. Found outside the task (not fixed)

1. **The idea document's size at the receipt bound (review C1).** The idea document keeps every corporate-action receipt on its three ledgers, including declines, conflicts and receipts applied after the endpoint, and every close rewrites it. At the measured receipt shape it passes Firestore's 1 MiB at about 2,900 receipts. A close that cannot write it would fail for good, and nothing moves past an unclosed session. Real feeds carry tens of receipts per idea. The fix is in `ledger.js`: T1a-2b-3 (Q6).
2. **The quarterly close pays two rows of one action id twice (review B2).** `mandateClosePass.js` `closeBook` reads each row's claim document in its transaction, but its writes are deferred. A second row of the same id (a regular and a special dividend on one ex-date, or a vendor correction) therefore applies again. The refuter reproduced a dividend paid twice and a split applied twice. This predates this build, and a single EODHD payload can produce it. This build's top-up cannot feed it today. Worth separate tasking (the quarterly engine is outside this build).
3. **A served window row can take a later receipt (review C3).** This needs both a failed stamp write after the row is served and a change in the day document between two fires of one slot (the sales pass reads the day document live). The row's counts would then lag its receipts by one. Latent.
4. **A close snapshot's after-hours print counts as full quality (review A8).** `closeMarkQuality` has no end bound. This is the close's own rule, and admission's last-close basis follows it.
5. **A recovered founder create is stored as 200 with `idempotentReplay: true`** (review C5), where the original would have stored 201 / `false`. The shape predates this build.
6. **A quarterly first build that loses `create()` to an idea-only first build adopts the omitted document** (review B7). It heals at the next slot's top-up. Pre-existing and byte-identical here.
7. **`mandateUniverseSnapshot.imports.test.js`'s self-check fails on Windows** (path separators), on `main` too. It passes on Linux.
8. **`evidence.test.js` has two unused variables** (`contentHash` at the reseal helper, and a `bookRef`) under the plain ESLint config. They are on `main` too; the lint gate passes.

## 9. Final fix, 17 Nov 2026 — T2C-01

| Question | Answer |
|---|---|
| Is T2C-01 fixed? | **Yes.** Before it values a held name, admission reads that session's daily corporate-action layer inside its own transaction. A failed fetch, a missing entry, or a missing daily document refuses the name; nothing is written. Astra's $21,000 case is refused `ca_fetch_failed` |
| Did anything else move? | **No money figure.** The quarterly product is identical (34/34 and 40/40). `dist/` is byte-identical to `main`. The end-to-end run changed only by the packet's new coverage fields |
| Checks | Full Linux suite exit 0 (35,156 passed); lint gate 0; build 0; rules 839/839. Each of the three refusals removed in turn fails a row. The refuter found no way past the check (51 probes, 38 killed, the 13 others backlog) |
| What is left | Nothing in this fix's scope. Four of the refuter's backlog rows can still admit $21,000 against $19,998.20 (R7a, R7b, R7d, R8; §9.4). Each needs a state today's producer does not make, or lies in the close. They go to T1a-2b-3 with Astra's backlog and the refuter's other rows (§9.6) |

Astra's review of this PR (`audits/20261117_ASTRA_REVIEW_T1A2B2.md`, SHA-256 `ae5784d7…`, committed byte-identical with its README row) passed everything else and left one blocker, **T2C-01**.

Admission read only the slot or close snapshot. The snapshot builder copies the daily layer's corporate-action rows but not its `caFetchFailed`, so a failed fetch looked like "no action listed". In Astra's case:
- a 4-for-5 reverse split moved AAPL 25%, under the gap screen's 40%;
- admission priced the old share count at the adjusted price;
- it accepted a $21,000 short reservation against a true short cap of $19,998.20.

The sales path already refused this case (`exits.js:174`, with its transactional daily read at `exits.js:347` and `:379`). Admission now does the same.

Branch head before: `7687cfa5a77dc6981bf661ecf028ce5cdd280b66`. `origin/main`: `a6b7baa0a20e28c412afbae5fd88819c12e94fd6`, fetched at the start and again before the final checks. It was already merged into the branch, so there was nothing to merge. This session worked in its own worktree and pushed to this branch by fast-forward, because the branch is checked out in another worktree.

### 9.1 The change (code commit `c4918d3a`)

| Where | What |
|---|---|
| `api/_utils/practiceField/admissionMarks.js:184` | `readAdmissionMarkSet` reads `mandateUniverseDaily/{session}` inside admission's transaction, by the collection's literal name, as the sales do. `session` is the session the chosen marks belong to: the one in progress, or the last completed session when its close is the basis. It attaches `daily: { key, present, symbols }` to the mark set. Nothing is read when the calendar names no session |
| `api/_utils/practiceField/admissionMarks.js:236` | `admissionMarksOf` checks each held name's coverage **before** valuing it (`caCoverageOf`, `:67`). A failing name is refused `admission_marks_unavailable` by symbol, frozen (valued at nothing), and no dollar limit is measured. One reason per name, coverage first:<br>• `ca_daily_missing`: no daily document for the session. This is stricter than a sale, on purpose: admission can wait, and a sale has a reason to proceed.<br>• `ca_coverage_missing`: no entry of the name's own (never one inherited through the object's prototype).<br>• `ca_fetch_failed`: `caFetchFailed === true`, the sales' own test.<br>A mark set with no `daily` counts as missing, so it fails closed. A book holding nothing needs no daily document |
| `api/_utils/practiceField/admissionMarks.js:296` | The admission packet's `admissionMarks.caCoverage` records the daily document's key, whether it existed and, per held name, `covered` and `fetchSucceeded`. A refusal writes nothing |
| `api/_utils/practiceField/admissionMarks.js:25`, `:59` | The header's paragraph on the coverage rule; the refusal vocabulary `CA_COVERAGE_REFUSAL` |

- **The one selected price snapshot is unchanged.**
- **`admission.js` is unchanged.** Both its paths get the daily document through `readAdmissionMarkSet`, already called in its transaction: the whole draft (`evaluateAdmission`) and a draft whose shape fails.
- **The refusal object is unchanged:** its fields, and `founderControls.test.js`'s endpoint replay of it.
- **Not touched:** `ledger.js`, corporate-action application, fill and sale amounts, the snapshot builders, any fenced file, flag, pin, rule or index. No fenced function is called.

### 9.2 The regressions (`admissionMarks.test.js:368`)

Astra's case runs on the engine's **own** daily and fast builders (`ensureDailySnapshot`, `ensureUniverseSnapshot`), with injected fetchers:
- $30,000 of AAPL entered on D1 at $231.47 and closed there: equity $99,991.00;
- D2's daily layer records AAPL's fetch as failed;
- D2's 10:00 snapshot prints a vendor-timed $289.3375, the reverse split's adjusted price.

| Row | Result |
|---|---|
| `:414` Astra's regression | The builders as they are: the daily layer has `caFetchFailed: true`; the snapshot has the price, no action and nothing of the failure. The $21,000 short JPM admission is **refused `ca_fetch_failed` for AAPL**. A broken draft hears the same refusal. **Nothing is written.** Presented with the split at the same price, the close values the book at $99,991.00, a short cap of $19,998.20 (Astra's diagnostic control) |
| `:438` A missing entry | AAPL left out of the daily build: **refused `ca_coverage_missing`**, nothing written |
| `:447` A missing daily document | No daily build at all (the snapshot's `dailyRef` is null): **refused `ca_daily_missing`**, nothing written |
| `:456` Control: the feed succeeded, nothing listed | The same 25% rise is genuine: **admitted** at the new equity, $107,488.75 (short cap $21,497.75). The packet records the coverage |
| `:469` Control: the feed lists the reverse split | The coverage passes, and the holding's basis is **refused `corporate_action_pending`**, as before |
| `:477` Control: an empty book | **Admitted** with no daily document anywhere. The packet records the key it would have read, absent |
| `:485` Control: the close basis | At 17:00 on D1, and at 09:15 on D2 before its open, the basis is D1's close. D1's failed daily layer **refuses**, though D2's (already built) succeeded. The reverse (D1 covered, D2 failed) **admits**, and names D1's daily layer |

**The existing rows.** Fixtures store no daily layer, so every existing row that admits while the book holds a name was refused `ca_daily_missing`. A census settled it: with only that refusal disabled, every such row passed except the two that pin the packet's shape (`admissionMarks.test.js:64`, the end-to-end pin). Two test helpers were added to `__testsupport__/fixtures.js`:
- `storeDailyLayer` (`:234`) writes a session's daily layer in the builder's entry shape;
- `coverHeldNames` (`:254`) covers what the book holds, as the daily build's idea-book coverage does in production.

Neither is wired into the snapshot fixtures. The sales read the daily layer too, so a fixture-wide document would change sale refusals across the suite. Instead, each held-book admission gets its session's coverage just before it:
- in `admissionMarks.test.js`: `t1a05Book` (D2), the D3 and Friday rows, and the hand-built mark set at `:343`;
- in `admission.test.js` (4), `catchUp.test.js` (3), `corporateActions.test.js` (3), `entry.test.js` (3), `evidence.test.js` (5), `exits.test.js` (2), `founderControls.test.js` (1) and `practiceFieldIsolation.test.js` (2).

A second census then logged every row where a coverage refusal fires. One existing row still passed but for a new reason: `corporateActions.test.js:708` was refusing AAPL for coverage instead of the basis conflict it describes. It got S[2]'s coverage. After that, coverage refusals fire only in the seven new rows and the A10 probe.

**The end-to-end pin** (`endToEnd.test.js:80`) moved only by the packet's new coverage fields. Both runs were dumped and compared leaf by leaf:
- the base `7687cfa5` reproduces `288b0c89…` byte for byte; the head gives `f061fb0e…` (390,122 bytes);
- **163 → 163 documents.** Nothing added or removed;
- **9 leaves added:** `admissionMarks.caCoverage.{dailyKey, dailyPresent: false, symbols: {}}` on each of the three admission packets;
- **3 leaves changed:** those packets' `contentHash`;
- **No money leaf changed.**

The A10 probe (`:204`), made while B holds XOM, now runs twice:
- first with no daily layer: it shows `ca_daily_missing` for XOM end to end;
- then with S[7]'s coverage placed for the probe: the measured `capital_exceeds_slot_cap`, as before.

Both write nothing, and the placed document is removed after the probe.

### 9.3 The mutation check

Each refusal was replaced in turn by `if (false)`, in an LF snapshot of `c4918d3a`. The runs used the Practice Field, endpoint and isolation files (605 rows) and were judged by exit code and failing row names. Log SHA-256 `39c12c1a…`.

| Mutant | Result | Killed by |
|---|---|---|
| Control (no mutant) | exit 0, 605/605 | — |
| M1, `ca_daily_missing` removed | **killed**, exit 1 | `admissionMarks.test.js:447`, and the end-to-end A10 probe (`endToEnd.test.js:205`) |
| M2, `ca_coverage_missing` removed | **killed**, exit 1 | `admissionMarks.test.js:438` |
| M3, `ca_fetch_failed` removed | **killed**, exit 1 | `admissionMarks.test.js:414` and `:485` |

In the battery run, M2 also failed the end-to-end row, on a 5.46 s timeout against the row's 5 s limit, while the Linux suite and the refuter were running. Rerun alone under M2, that file passes and the coverage row still fails. So that one failure was load, not a kill, and it is not counted. Each removed branch falls through to the next check without a throw, so no kill is a crash.

### 9.4 The refuter

One refuter worked on its own read-only LF snapshot of `c4918d3a`, told to break the fix. It defined **51** probes, **ran 51**, and **38 were killed** (the fix held). Its probe file, re-run here against the committed source, gives the same split: 13 red, 38 green, and the committed 25 rows green.

**Nothing to fix in this PR.** No probe found a way past the coverage check. Whenever the marks' session has no daily document, no entry for a held name, or `caFetchFailed: true`, admission refuses and measures no dollar limit. That held against:
- every daily shape tried: null; `present` not `true`; `symbols` null, an array, a string or inherited; an entry missing, or present only in lower case;
- holdings keyed by another spelling, a zero-share holding, a waiting rename, and a position no open idea mirrors (each refused by name);
- the daily document chosen at 13 instants: 23:30 Eastern (UTC already the next day), pre-open, 09:45, 16:00, a Saturday, Thanksgiving, the early close at 12:50, 13:00 and 13:30, and the DST change;
- two races: the daily document turned to failed, or deleted, between admission's read and its commit. Each was retried and refused, and nothing was written.

Its own four mutants of `admissionMarks.js` were all killed by its probes:
- coverage always passing;
- the daily document of today's Eastern date read in place of the marks' session (also killed by the committed close-basis row, `:485`);
- the daily read moved outside the transaction (killed only by the race probes);
- `caFetchFailed` ignored.

**Disclosed:** no committed row pins the transactional read. A read moved outside the transaction passes them all; only the refuter's race probes catch it. The read is inside the transaction (`admissionMarks.js:184`, `tx.get`). A committed race row goes to T1a-2b-3 (§9.6).

Its 13 red rows are all **BACKLOG** by the dispositions set before it ran, and go to T1a-2b-3 (§9.6):
- **Odd entry values** (8 rows, no money effect): an entry of `false`, `0`, `''`, `'x'`, `{}` or `[]`, and `caFetchFailed` of `'true'` or `1`, read as covered and succeeded. That is the sales' own rule (`exits.js:174`). No builder writes these values.
- **R7c** (no money effect): the daily document's own `date` is not checked against its key.
- **R7a, R7b, R7d (money):** a daily document that differs from the one the slot snapshot was built from. Coverage now reads the daily document, but the basis check (`saleHeldBackBy`, `admissionMarks.js:243`) sees action rows only through the snapshot. A daily document that lists a reverse split the snapshot does not carry therefore admits $21,000 against $19,998.20. Three ways in:
  - a top-up after the snapshot, for a held name missing from the day's first build;
  - a `force` rebuild after the snapshot;
  - a snapshot built with no daily document (`dailyRef: null`) and a daily document built later.

  Each needs a state today's producer does not make:
  - the cron builds the daily document before every slot and close snapshot (`api/cron/mandate-evaluate.js:410`, `:876`);
  - no production caller forces a daily rebuild;
  - by the refuter's reading, the first build's held set includes the idea books' holdings.
- **R8 (money, outside admission):** the close never reads the daily layer. While the fetch fails for several sessions, every in-session admission is refused `ca_fetch_failed`, but each close writes the adjusted price into `lastMark` against the unadjusted share count. Once the split leaves the feed's five-day window, a later clean fetch hides it, and the gap screen compares against the polluted mark.

### 9.5 The checks

Linux runs used WSL Ubuntu, a private worktree of `~/pd-ci` at `086c9f7f` (the code commit plus the review's docs commit), Node 20.20.2, the install matching the lockfile (`e457c10d0317`), and `TZ=UTC`.

| Check | Result |
|---|---|
| The Practice Field, endpoint, isolation, trace and seam files, with the snapshot, top-up, scan and interleaving files | exit 0 · `Test Files  27 passed (27)` · `Tests  733 passed (733)` |
| The seventeen-scenario differential, both modes, against `origin/main` `a6b7baa0` | Astra's `astra-differential.test.js`, unmodified (`17e724ad…`), in her layout (base `a6b7baa0`, head `c4918d3a`, LF archives): exit 0 · **34/34 identical** (17 at `'off'`, 17 at `'on'`); 36/36 rows. Its evidence file is byte-identical to the one in her review run (`b6d71e76…`) |
| The 40-case traced differential, against `origin/main` | Astra's `astra-cron-trace.test.js`, unmodified (`9297cead…`), the same layout: exit 0 · **40/40 identical**. Evidence hash `6c169f26…`, unchanged |
| The end-to-end pin | Moved only by the packet's coverage fields (§9.2): `f061fb0e…`, 390,122 bytes, 163 documents |
| **Full suite**, `TZ=UTC flock /tmp/pd-suite.lock` + `vitest run --maxWorkers=8`, at `086c9f7f` | **exit code 0** · `Test Files  1557 passed \| 12 skipped (1569)` · `Tests  35156 passed \| 135 skipped (35291)` · `Duration  332.11s`, read from the log (log SHA-256 `8f0956ad0f04ae45…`). That is 35,149 at the last build plus the 7 new rows |
| `npm run lint:gate`, at `086c9f7f` | exit 0 (log `9f001ed27060e4e9…`) |
| `npx vite build`, at `086c9f7f` | exit 0, built in 16.02 s (log `e798e20b52e6bceb…`). `dist/` (113 files) is **byte-identical** to `main`'s build, made in a second worktree with the same install: hash list `462b76919c46a337…` on both sides. The pushed head, which adds only this section, is built again before the push |
| `npm run test:rules` (JDK 21, local emulator, Linux; no rule changed), at `086c9f7f` | exit 0 · `Test Files  46 passed (46)` · `Tests  839 passed (839)` (log `d92eea99f87c3b96…`) |

### 9.6 What is carried from Astra's review

Nothing below is a merge blocker in her review. Each goes where she, Q1–Q6 and the brief put it.

**To T1b:**
- **T2C-02:** a served window row must reconcile receipts merged after it was served, and must never add a delayed attempt to a total that already includes it. Keep the receipt-derived totals apart from the attempt-derived ones (`windowLedger.js:128`, `:138`, `:189`).
- **A result reader** must check the parts (`resultPacketPartProblems(packet, partDocs)`), not only the packet's own hash (`verifyPacket`). The current end-to-end reader does both.
- **An ex-dividend refusal or `close_owed`** does not use up a slot's refill attempt.
- **Drafting** admits at its own window's snapshot, with server time.

**To T1a-2b-3:**
- **T2C-04:** the idea document's size alert (the bound fixture's idea document is 1,288,985 bytes; the estimate fits about 2,879 receipts), and whether receipts must move during the corporate-action finish (Q6).

From this round's refuter (§9.4), also to T1a-2b-3:
- **Snapshot action rows lagging the daily layer** (R7a, R7b, R7d; money). Two candidate fixes:
  - read each held name's `corporateActions` from its daily entry as well as from the snapshot;
  - or refuse a snapshot whose `dailyRef` is null or names another session.
- **The close's own reading of the daily layer** (R8; money; `close.js`): a failed fetch must not let the close write an adjusted price over an unadjusted count.
- **Odd entry values and the daily document's own `date`** (R3, R7c; no money effect). The same rule as the sales, so decide both together.
- **A committed race row** for admission's transactional daily read.

**To T5:**
- **T2C-03:** the `force` rebuild of the daily document can erase carried actions under a concurrent top-up. Before any operational rebuild is exposed, isolate it from top-ups and define how held symbols' actions are kept (`mandateUniverseSnapshot.js:262`, `:351`).
