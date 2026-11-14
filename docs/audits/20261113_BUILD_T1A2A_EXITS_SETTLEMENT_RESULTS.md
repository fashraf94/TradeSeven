# Build T1a-2a — the idea book's exits, settlement and results (dark)

**Build report, Practice Field T1a-2a** · Claude Code (Fable 5.2) · 13–14 Nov 2026
**Branch:** `claude/practice-field-t1a2a-exits-settlement`
**Base:** built on `origin/main` @ `5675d305c3c121e4d9a4cc6904804e491d567cde` (the merge of PR #1058, read after `git fetch origin` at the start). `origin/main` moved during the build to `c85f7b4145f2d172b2d40c888ca5874913ed7b6c` (the merge of PR #1059, Shared Research B2: 30 files, none of them this build's except `docs/README.md`, which merged cleanly). The branch was brought onto it and its work-in-progress history squashed to three commits with the tree unchanged; **every final check below ran on that tree** (`origin/main` read again before the push: unchanged at `c85f7b41`).
**Code head:** `b96cabff0756f1343d49264c922f12f96ed0e645` · three commits on `c85f7b41` · 36 files, +7,965 / −559 (33 of them under `api/`: +7,771 / −559; the rest are the two attachments and `docs/README.md`). The commit that adds this report and its `docs/README.md` row follows it and changes no code.
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged. No flag value, pin, Firestore rule or index changed. Nothing in this build runs in production.
**This session made no model call, no Firestore write and no EODHD call.** Every test runs on the engine's in-memory store with the network edges mocked.
**Rules:** concept V6.1, shared contract V2 with Amendments A to D, **Amendment E** and **Astra's confirmation of the T1a-1 fix round** (the two attachments this build commits byte-identical, below), and `docs/BUILD_RULES.md`.

**The two attachments**, committed byte-identical; each hash was taken from the attachment before the copy and from the committed blob after it:

| Path | SHA-256 |
|---|---|
| `docs/design/20261113_PRACTICE_FIELD_AMENDMENT_E_EXITS_SETTLEMENT_RESULTS.md` | `4a99f008ab7a3e4b2b300506d969223d80fec30b6bf0e08d67f82ba68049e661` |
| `docs/audits/20261113_ASTRA_CONFIRMATION_T1A1_FIX_ROUND.md` | `ce90f78e0bc4ce57e666db04e519e6f65c87aa0d3556e77226afc5f6e76e48da` |

Every `file:line` below was resolved against the code head by script.

**Two things to know before reading on:**

1. **Forty-three readings are stated and ten questions are open** (§3). The build follows the letter where there is one; where the review showed the letter was not enough (a fill after an unclosed session; a sale across a corporate action) it took the fail-closed side and says so.
2. **One test on `main` now fails by the clock and is not this build's** (§7.3, item 6): a `src/` golden that expires 48 hours after its fixture date. It is the only failing row of the full suite, and it fails identically on the base.

---

## 1. In plain terms

T1a-1 built the money going **in**. This build is the money coming **out**, and the verdict. It is the first code in the idea book that sells anything. It makes no model call, shows no screen, adds no endpoint and changes no rule. It all sits behind `PRACTICE_FIELD_MODE = 'off'`, which is unchanged, and is exercised by synthetic fixtures only.

**What the idea book now does, by code:**

- **A price line is a stop on one stock.** Each evening the close compares every held name with its own line. A close strictly below the line, on a price the vendor timed during that session, marks that one holding to be sold. The next morning's first window with a usable price sells it, whole. The other names keep running. The idea's record says its line was breached, and when.
- **The comparison never trades.** It holds what it bought on day one, so every stop is judged against simply holding.
- **An idea is judged on its review date, or earlier if it has nothing left.** That evening all three ledgers (the idea, its comparison, SPY) are valued the same way at the same close: cash, plus what the holdings would fetch if sold at that close, after the modelled cost of selling. The result is written then, once, and never rewritten.
- **The capital comes back the next morning.** What the idea still holds is sold at the next window. When the last sale fills, the cash returns to the book's treasury, the slot is free, and the idea is closed. The difference between what the sales fetched and what the endpoint said is recorded as slippage, beside the result and not in it.
- **No clean price, no sale and no verdict.** A sale with no usable price waits; it never fills at yesterday's price or at cost. After five sessions waiting it raises an alert every session. A result that needs a price it does not have reads *inconclusive* (`unmeasurable`), and its process reads *blocked*.
- **A missed day is filled in or marked unobserved, before anything else moves.** If the book missed closes (the mode was off, or a run failed), the next window or close first closes each missed session in order, from that session's own stored prices. A session with no stored prices gets a row that says *unobserved*. Until that is done the book buys nothing and sells nothing, so no trade is ever dated after a day the book has not closed. No clock is ever extended: an idea is settled on its own review date or not measured.
- **A sale waits for a split or a dividend to be applied.** Corporate actions are applied at the close. On the morning one takes effect the price is already adjusted and the holding is not, so a sale then would sell the old share count at the new price. It waits for that evening's close and fills the next morning.
- **Late is recorded as late.** A stop recognised while catching up, a sale that filled after its first eligible window, and a result written by a catch-up all read *blocked*, with the reason beside them.
- **Ticker changes and delistings.** A renamed stock is renamed everywhere it is held, with no cash moving. A delisting is never treated as a sale: with a cash amount per share it is credited like a dividend and the holding closes; without one, the holding waits for a real price.
- **A book that is winding down** (`draining`) still gets every one of these duties, and takes no new idea.

**A worked example** (synthetic prices; the figures are the code's own output, re-run on the final code).

| Step | What happened |
|---|---|
| Admitted Friday, entered Monday 16 Nov | A short idea of **$20,000** in three names, equal thirds, compared with simply holding the same shares. Bought at AAPL $230, MSFT $420, NVDA $140: $6,666.66 each, $6.00 of modelled cost, 2 cents left as cash. Each line sits 5% under its fill price: AAPL $218.57, MSFT **$399.12**, NVDA $133.04 |
| Wednesday 18 Nov, the close | MSFT closes at **$398.00**, under its line. Nothing is sold that evening. MSFT is marked to be sold; the idea reads *line hit, exit pending*; the breach is recorded for good |
| Thursday 19 Nov, the first window | MSFT trades at $396. All 15.868239 shares are sold for **$6,281.94** after cost, a realised loss of **$384.72**, with its own receipt. The cash stays in the idea. AAPL and NVDA are untouched. The comparison still holds all three |
| Tuesday 1 Dec, the review date, the close | AAPL $248, MSFT $431, NVDA $149. **The idea**: $6,281.96 cash + $14,279.34 of AAPL and NVDA − $4.27 modelled cost to sell = **$20,557.03**. **Simply holding**: $0.02 cash + $21,118.55 of all three − $6.32 = **$21,112.25**. SPY, for context: $20,387.76 |
| The result, written that evening | **Contract condition: breached** (MSFT, 18 Nov). **Economic result: behind**, by **$555.22** (2.78% of the $20,000; the no-difference band is $50). **Process quality: followed plan** (every code action filled at its first eligible window). **Evidence scope: a single forward observation. Adoption: no offer.** Beside them: $169.27 ahead of SPY; largest decline between closes $166.96 (0.83%); three entry trades costing $6.00 and one line exit costing $1.89; 77% invested on average; eleven rows, all full quality |
| Wednesday 2 Dec, the first window | AAPL and NVDA are sold for **$14,270.92**, $4.15 less than the endpoint valued them at (the prices moved overnight): recorded as liquidation slippage, not part of the result. **$20,552.88** returns to the treasury, which now holds $100,552.88. The slot is free |

Here the stop cost the idea $555: MSFT recovered after it was sold. The record shows both facts side by side: the line was breached, and the idea finished behind simply holding. Neither overwrites the other.

## 2. What changed, by file and line

Line numbers are at the code head named at the top of this report. Everything is under `api/`; nothing in `src/`, no rules, no index, no flag. No fenced file (BUILD_RULES §1) is touched, and the engine's `computeExecution`, `pendingActionsFor`, `applyCorporateAction` and gap screen are called, never edited.

### 2.1 New modules (`api/_utils/practiceField/`)

| File | What it holds |
|---|---|
| `exits.js` | The sales. `planPendingSales` (`exits.js:122`) is the pure core: every pending sale of one idea against one window's stored snapshot — the first eligible window, the corporate-action holds, the fill through `executeIdeaFill`, the receipt, the waiting record, lateness, and what the fills make of the idea (back to `holding`, early resolution, or `resulted` with the liquidation record). `sellPendingHoldings` (`exits.js:330`) is the one transaction: it reads the book, the idea, the other open ideas, the slot's stored snapshot, the coverage document and the session's daily layer, refuses outside a window or past an unclosed session, reconciles as read and as written, and creates each decision once. `runIdeaBookSalesPass` (`exits.js:403`) serves one book, one idea at a time |
| `settlement.js` | The close's judgment. `readLines` (`settlement.js:123`) reads each line on a full-quality close, strictly below. `ledgerEndpoint` (`settlement.js:189`) values one ledger as cash plus holdings net of the modelled cost of selling them — the sale's own arithmetic. `buildEndpoint` (`settlement.js:293`) writes the endpoint row and the five-column result. `completedLiquidation` (`settlement.js:75`) is the liquidation's record. `foldCloseIntoTrack` (`settlement.js:256`) keeps the running record the result's "beside" figures come from |
| `sessions.js` | "Nothing moves past an unclosed session": `firstUnclosedSessionBefore` (`sessions.js:27`) and `fillSessionRefusal` (`sessions.js:48`), pure |

### 2.2 Changed modules (`api/_utils/practiceField/`)

| File | What changed |
|---|---|
| `close.js` | Rewritten around one session at a time. `closeFilledIdea` (`close.js:106`): corporate actions on all three ledgers, a blocked rename, a delisting that waits, marks, the lines, the row, the track, and at the endpoint the endpoint row and result. `closeNextSession` (`close.js:363`) is the transaction: the first unclosed session or the requested one, the guard against a fill dated after it, the stored `${date}_close` snapshot read here, entry timeouts, every idea, the book's mirror and row. `catchUpIdeaBook` (`close.js:597`) closes missed sessions before a window; `closeIdeaBook` (`close.js:623`) before the requested date. Both stop at 20 sessions a call |
| `entry.js` | `enterIdea` (`entry.js:162`) reads the slot's stored snapshot itself (FR-A7), refuses past an unclosed session, refuses a leg with no resolvable cost tier before any fill (Q-1), and records the entry's leg count and costs |
| `fills.js` | `executeIdeaFill` (`fills.js:91`) takes the holding's **stored** cost tier for a sale and refuses an unknown one; the tier is stored on the holding it buys. `modelledSaleProceeds` (`fills.js:64`) is the one sale arithmetic the endpoint shares |
| `marks.js` | Q-2: one maximum age, measured at the stored snapshot's build time (`marks.js:92`). Q-3: a print from before the open is `pre_open_print` (`marks.js:133`). `quotePastMaxAge` (`marks.js:103`) |
| `ledger.js` | Sale receipts on the ledger. `applyLedgerActions` (`ledger.js:155`) now applies a ticker change and a delisting with a cash amount (never a sale at a mark), and reports a delisting with none. `saleHeldBackBy` (`ledger.js:378`) |
| `reconcile.js` | T1A-C01: the open and filled status sets; `statusProblems` (`reconcile.js:154`); the two lifted bounds (the fill count equals the sale receipts; realised profit and loss equals the receipts, sale and corporate-action); a paper ledger never sells; the cost tier; the receipt's own consistency (`reconcile.js:93`) |
| `admission.js`, `windows.js` | E17: the schedule carries the liquidation session and admission refuses a calendar that does not reach it (`windows.js:160`). `firstWindowAfter` (`windows.js:94`), `nextWindowAfter`, `compareWindows`, `ideaSaleSlots` |
| `coverage.js` | `ideaCoveragePlanFromLedgers` (`coverage.js:74`): after a rename, coverage follows what the ledgers hold |
| `sweep.js` | `runIdeaBookWindow` (`sweep.js:152`): catch-up, then sales, then entries. `runIdeaBookEvalPass` (`sweep.js:191`) serves active and draining idea books, each status's query isolated. `withDrainingIdeaBooks` (`sweep.js:102`) and its coverage fallback; `runDrainingIdeaBookCloses` (`sweep.js:271`); `ideaCloseLeftUnclosed` (`sweep.js:258`) |
| `constants.js` | The three new statuses and the status sets (`constants.js:71`), the two sale origins (`constants.js:110`), the result's enums, the waiting and catch-up bounds |

### 2.3 The engine's cron (`api/cron/mandate-evaluate.js`)

Six places, each inside a branch that only an idea book reaches or behind `practiceFieldLive()`; at `'off'` the fire is the base byte for byte (§5.3).

| Line | Change |
|---|---|
| `mandate-evaluate.js:142` | The snapshot build, in its idea-book branch, is handed the coverage document when the draining query's fallback read it |
| `mandate-evaluate.js:389` and the same in the close sweep | The documents a snapshot build is decided from include draining idea books, by the Practice Field's own query |
| `mandate-evaluate.js:462` | The idea-book pass reads its slot's stored snapshot itself (no snapshot argument), and its counters are in the body whenever it listed a book or a query failed |
| `mandate-evaluate.js:957` | An idea book served and left unclosed for the date is counted |
| `mandate-evaluate.js:1016` | The draining idea books' closes, after the engine's page, fenced, not on a deferred fire |
| `mandate-evaluate.js:1037` | Completion also needs no idea book left unclosed |

### 2.4 Guards

| File | Change |
|---|---|
| `api/_utils/compositionProtectedStoresScan.js`, its allowlist and its test | T1A-07 (§5.4) |
| `api/_utils/mandateMoneyRounding.scan.test.js` | `exits.js` and `settlement.js` joined the list of Practice Field modules that must be on the money path's closure. No new raw rounding site: every figure the new modules round goes through `money.js` or the engine's `roundUsd` |
| `api/_utils/mandateRationale.imports.test.js` | Two counted entries: `practiceField/exits.js` (the writer of sale receipts; reads no decision) and the scan itself (it names the `decisions` subcollection in its inventory; it reads source files, never Firestore) |

### 2.5 Readers of `mandates`

No new reader outside the Practice Field. Inside it, every read is by the book's own reference in its own transaction, or one of the three `kind == 'idea_book'` equality queries (R-23). The quarterly sweeps' queries are unchanged.

## 3. Readings stated

Every place Amendment E or the build prompt left a choice, and what was built. Each is fail-closed and can be changed by a ruling without touching the rest. R-29 to R-40 came out of the review (§5). The ones marked **Q** are put to the founder as questions in §3.2.

### 3.1 Readings

| # | Where the text left room | What was built |
|---|---|---|
| R-1 | The branch. The session opened in a fresh worktree of `origin/main` on an app-named branch | The branch was renamed to the prompt's `claude/practice-field-t1a2a-exits-settlement` before the first commit. HEAD at the start: `5675d305c3c121e4d9a4cc6904804e491d567cde`, equal to `origin/main` after `git fetch origin`, clean tree |
| R-2 **Q** | Q-2: "more than 20 minutes before **the window's tick**" | The tick is the instant the slot's **stored snapshot was built** (`builtAt`), never the caller's clock: a later fire of the same slot decides exactly as the first did. A snapshot with no readable build time certifies no age and is refused. Exactly 20 minutes fills; 20 minutes and one second does not |
| R-3 | Q-1: "a leg whose cost tier cannot be resolved" | Every leg on every ledger: the idea's names and a frozen basket's members. A fund's tier is explicit and needs no market cap. Held in two places: the entry names **every** such leg before any fill, and the fill wrapper itself refuses one. `unknownCostTierLegs` stays on the records T1a-1 wrote; it is now always empty |
| R-4 | E5: "each holding keeps the cost tier it entered with" | Stored on the holding itself (`costTier`: name and the two basis-point figures) on all three ledgers, so it travels through a split and a ticker change. A sale is handed it; the endpoint reads it. A fund is always costed at its explicit tier. The reconciliation refuses a holding with no tier, on any ledger, and while the same-stock tie holds the comparison's tier must equal the idea's (R-39) |
| R-5 | E4: "less the modelled cost each ledger's own cost policy would charge to sell them at those marks" | The endpoint's arithmetic for one holding **is the sale's own**: shares × mark × (1 − cost), rounded once, as the engine prices a sale. A holding sold the next morning at exactly the endpoint's mark fetches exactly its endpoint value, so the recorded slippage is price movement and nothing else. Each displayed figure is the sum of its displayed parts. The valuation row of the same close states the same holdings as one raw sum rounded once, which can differ by a cent a holding; the endpoint carries that row figure beside its own (`rowMarkedHoldingsValueUsd`) so the two never look like a disagreement |
| R-6 **Q** | §1: "The comparison and SPY ledgers never sell, so theirs stays 0" against §7: a cash delisting is credited "on every ledger that holds the name" | Realised profit and loss on **every** ledger must equal, to the cent, the sum on its sale receipts plus the sum on its applied corporate-action receipts. A comparison or SPY ledger may carry no sale receipt at all (one is refused). So theirs is 0 **except** for a cash delisting of a name they hold, which is receipted like the idea's |
| R-7 | §1: "`postEntryFillCount` is incremented by every fill after basket entry" | The reconciliation requires the count to **equal the number of sale receipts** on the idea's ledger (in this build every fill after entry is a sale). Stronger than the letter: a count wound back to 0 to switch the same-stock tie on, or run ahead, is refused |
| R-8 | §1: "every check that applies to `holding` applies to each of them" | Done, and the reconciliation also checks that the status agrees with what the holdings carry: a holding waiting to exit only on `line_hit_exit_pending`; one waiting for its settlement sale only on `settled`; a `settled` idea carries its result and its endpoint figure and holds nothing that is not waiting; a `holding` idea holds something; an `accepted` one holds nothing |
| R-9 | E14: "`line_hit_exit_pending → holding` while other holdings remain" says nothing of the hours between the last holding's sale and that session's close | The idea stays `line_hit_exit_pending`, holding nothing, in its slot, with `earlyResolution` recorded, until that session's close writes its endpoint and result (E2) |
| R-10 | E6: "a full-quality completed-session close" | The mark's own quality must be `vendor_time` (from this session, at or after its open — Q-3), **and** the symbol must carry no unsettled conflicting corporate action. A holding whose line is already breached, or that is waiting for its settlement sale, is not read again. Lines are read on every session up to and including the due one, and never after the endpoint |
| R-11 | E9: "The holding records each refusal" | The holding keeps the count of refused windows and every session waited in full, and the **twelve most recent** refusals in detail (a sale can wait for months at three windows a day). A window already recorded is not recorded twice |
| R-12 | E9: "After five sessions waiting, an alert fires" | `PRACTICE_FIELD_SALE_WAITING` is logged at the first refused window of the **fifth** session a sale has waited, and once in each waiting session after it. When a line exit still waiting at the due session becomes the settlement sale, its waiting record carries over, so the count does not restart |
| R-13 **Q** | §6: the result is "written once… immutable thereafter" against E9 / E15 / B-WAIT: a settlement sale that waits makes process quality read `blocked` — but a settlement sale can only wait **after** the result is written | The result is never rewritten. A line exit that waited before the endpoint makes the result read `blocked`. A settlement sale that waits (or fills late) after it is recorded on the idea's **live** `processQuality` (`blocked`, and it never goes back), on the holding's waiting record, in `waitedSessions`, and on the liquidation's own record (`liquidation.processQuality`, `liquidation.blockedBy`); `result.processQuality` stays as written |
| R-14 **Q** | E15: "blocked when any… endpoint valuation waited for data" (an endpoint never waits: no clock moves) | Read as: the endpoint valuation **lacked** data or was not made on time — the endpoint session has no stored snapshot, any endpoint mark of the idea's own ledger is not full quality, the idea's own ledger carries an unsettled conflicting action (R-34), or the endpoint was written by a catch-up (R-30). A comparison mark that is not full quality makes the economic result `unmeasurable` (E10) but is not the idea's process |
| R-15 | E4: "the difference between its proceeds and its endpoint value" | `liquidationSlippageUsd` = the settlement sales' proceeds, plus any cash a delisting paid for a holding **after** the endpoint valued it (R-33), − the endpoint's value **of those holdings** (net of modelled cost). The idea's cash is in both figures and cancels. Stored beside the proceeds, the endpoint figure and the cash returned (`liquidation`) |
| R-16 | E2: "when its last holding has exited" | Also when a delisting's cash closes the last holding: the idea resolves at that close, with no sale anywhere. A `settled` idea whose last waiting holding is paid out in cash is `resulted` at that close |
| R-17 | E11: "the holding becomes a waiting sale" — the contract has one pending-exit status | The idea becomes `line_hit_exit_pending` with `exitPending.reason: 'delisting'`. The delisting itself breaches no line. The comparison and SPY ledgers keep the name at its carried mark, not full quality (they never trade). See R-32 for its line and its sale |
| R-18 | E11: a ticker change renames "its coverage" — the contract is frozen and names the old symbol | The frozen contract is not rewritten. After a rename the idea's coverage is rebuilt from what its three ledgers hold now. On the rename day the snapshot was built from the old coverage, so the new symbol has no quote: a carried mark, the row not full quality, its line unobserved for that session |
| R-19 **Q** | E12: "the trading sessions between the book's last closed date and that date" — a book that has never closed has no last closed date | Such a book starts at the first session any of its open ideas filled in. Without this, a missed close on the entry session itself would never be caught up |
| R-20 | E12 sets no limit on the gap | One call catches up at most **20** sessions, then stops with `catch_up_incomplete`; the next fire continues. Nothing is skipped, and neither the requested close nor a window's sales and entries happen until every session before it is closed |
| R-21 | E12: an unobserved session "settles nothing; a due session in that state gets an endpoint with `economicResult: 'unmeasurable'`" | "Settles nothing" is read as "values nothing": the endpoint row and the result **are** written on the due session, at carried marks, labelled `unobserved` (R-35), with `unmeasurable`, `blocked`, and every line unobserved; the idea is `settled` and its liquidation runs at the next eligible observation. The capital is not held hostage and no clock moves. No corporate action is applied on an unobserved session (the feed is on the snapshot that does not exist); a later stored snapshot still presents it |
| R-22 | E12: the requested date itself with no stored snapshot | Unchanged from T1a-1: no row, `valuation_missed`, nothing built or fetched. The next window or close catches it up from its stored snapshot, or records it as unobserved |
| R-23 | E13: "use the idea-book code's own queries" | Three places, each the idea book's own equality pair (`status == 'draining'`, `kind == 'idea_book'`): the eval pass; the close of draining books, run after the engine's page; and the documents a snapshot build is decided from — a draining book still holds shares that need a price, and without it a draining book alone would be an idle skip and never be marked. All three are gated by the mode, and fenced: a failure never costs the quarterly sweep. A failure of the pass's query or of the draining close is logged and counted; a failure of the snapshot build's query is logged and falls back to the coverage document (R-42) — it is not counted in the fire's body (§7.2 C-1b) |
| R-24 | Rule 9: "operation id, fingerprint, expected version" — code-made transitions have no caller to supply an id | A sale's decision id is deterministic (`{ideaId}__{origin}__{symbol}`) and written **create-once**; the endpoint row is create-once; the result is written only while the idea has none; a close is keyed by date. Each sits in one transaction whose reads are its expected version |
| R-25 | §11: "one book, three ideas on a **short** slot" — a book has one short slot | The three ideas go through the one short slot **one after another**, each admitted when the one before has freed it. It exercises slot reuse after `resulted`, which three ideas in three slots would not. T1a-1's side-by-side run of three ideas in three slots is kept beside it |
| R-26 | §2: "A missing stored snapshot means no fill this window" | For an entry it is a failed attempt like a missing price: the basket waits, and at the session's last entry slot it is the timeout. `enterIdea` and the idea-book pass no longer take a snapshot at all |
| R-27 | §6: "the largest decline between recorded session-close values" | Over the idea's valuation rows from entry to the endpoint session inclusive (marked values, before exit cost), observed sessions only. Kept as a small running record on the idea (`track`) so the endpoint's transaction does not re-read up to sixty rows |
| R-28 | Contract §14 B-CUTOFF: "an action submitted after the due session's cutoff is refused and recorded" — no action is submitted in this build | The part this build owns is tested: after the endpoint no line is read, nothing rewrites the result or the endpoint row, the reservation cannot be released, and the endpoint is the due session's post-close value. Refusing a late model action is T1b's |
| R-29 | E12: missed closes are caught up "before the next close". The review showed that is not enough: a window that ran before the catch-up could enter an idea or fill a sale *after* a session the book had not closed, and the later catch-up then wrote that earlier session's row from the book's present (a row for an idea that had not entered yet; an endpoint dated before the sale that caused it) | **Nothing moves past an unclosed session.** A window first catches up every missed close before its own session (the same code, the same stored snapshots, the same bound), then sells, then enters. If the catch-up cannot finish, the window does nothing and the book is not stamped as served, so the slot's next fire continues. Each fill transaction also refuses, on its own, to run while an earlier session is unclosed or in a session whose close is already written (`not_this_session`). The close refuses a book that carries a fill dated after the session it would close. Still "before the next close", and earlier |
| R-30 **Q** | E15: "`followed_plan` when every code action filled at its first eligible window; `blocked` when any line exit, settlement sale or endpoint valuation waited for data" — an action that was simply **late** (no pass ran, or a catch-up found it) is neither | Read toward the first sentence: late is `blocked`, each under its own name so it is never mistaken for a data wait — `line_recognised_late` (a breach found by a catch-up; E12 already says "recorded as late"), `line_exit_late` / `settlement_sale_late` (filled after its first eligible window with no refusal on record), and an endpoint written by a catch-up (`endpoint_valuation` with `writtenLate`). A sale's first eligible window is the first window after the close that queued it; a window whose quotes were all observed before the decision was never eligible, is not counted as a wait, and moves the first eligible window to the next one — unless the quote is also past the 20-minute maximum age, which is a name that has not printed: a real wait, recorded as `stale_quote`. "No refusal on record" means none at or after the sale's own first window, so a waiting record inherited from the line exit a settlement sale replaced does not hide a late settlement fill |
| R-31 **Q** | §4: a sale fills "at the window's eligible mark". Corporate actions are applied at the close, so on the morning a split takes effect the window's price is already adjusted and the holding is not (the review reproduced a sale of the old share count at the halved price, and a reverse split that quadrupled the proceeds) | A sale **waits** (E9) while: the window's snapshot lists an action for that holding, due on or before the session, that its ledger has neither applied nor declined; the ledger holds an unsettled **share-basis** conflict on the symbol; the engine's own gap screen flags the price as a suspected split; or the session's daily layer says the corporate-action fetch **failed** for the symbol that day, or has no entry for the symbol at all (the slot snapshot does not carry either, so the sale reads the daily document itself — read only; with no daily document at all nothing can be said and the sale is not held — the cron never builds a slot snapshot without one). An ordinary cash dividend holds the sale for the one session until the close credits it. A **conflicting** cash dividend holds the sale only while the feed still lists a row of it: the feed may yet settle on one row, and the close then credits the idea what its comparison gets. Once the feed lists none it holds nothing — no share count is in doubt, and nothing would ever release the sale (the dividend stays uncredited and the endpoint reads `unmeasurable` for it). The feed's window is a few days, so that wait is bounded. A conflict of any other kind, or one that cannot say what it is, holds. A held sale is recorded like a wait, reads `blocked` under its own name (`…_held_for_corporate_action`, never `…_waited`), and alerts from the fifth session. Two states never clear by themselves and hold a sale until the founder acts on that alert: a share-basis conflict the feed has dropped, and a move with a split's signature that the feed never explains (a real fall to exactly a half, a third, a quarter… of the last close reads the same). A split below the gap screen's threshold that the feed never lists at all is outside this build's reach |
| R-32 **Q** | E11's waiting sale and E6's "a held name". The review found the build stopped reading the line of a holding waiting on a delisting, and counted its sale as a line exit | Its line **is** still read: a full-quality close below it is recorded as breached, an unreadable one as unobserved. A breach on a holding already waiting queues no second sale. The sale's decision record and receipt keep the origin `line_exit` — the build prompt names two origins, `line_exit` and `settlement`, and this is the only sale before the endpoint — and what queued it says `delisting`. The result counts it apart (`trades.delistingExit`, beside `trades.lineExit`) and the process column names it (`delisting_exit_waited` / `_late`). Such a holding is not put through the gap screen of R-31: a delisted name falling to half its carried price is the delisting, not a split |
| R-33 | E4 and E11 did not foresee a delisting paying cash for a holding **after** the endpoint valued it and before its settlement sale filled. The formula as first built read that as a loss of the whole holding | That cash is what the holding fetched. It is counted beside the sales' proceeds under its own name (`liquidation.corporateActionCashUsd`, `corporateActions`), and the slippage is measured against both. The same for a **dividend** credited between the endpoint and the sale (the sale waits across the ex-date, R-31, so the sale is ex-dividend and the dividend is the other part of what the holding fetched). Cash an action paid on or before the endpoint session is already in the idea's cash and is not counted again |
| R-34 | E10 names marks. A conflicting corporate action that never settled (a dividend never credited, a split never applied) leaves the value in doubt though every mark is clean | `unmeasurable`, under its own reason (`idea_unsettled_corporate_action` / `comparison_unsettled_corporate_action`) rather than "a mark is not full quality"; on the idea's own ledger the endpoint also reads `blocked` (`endpoint_unsettled_corporate_action`) |
| R-35 | No ruling sets the label of a row written for a session with no stored snapshot. T1a-1's label says "post-close snapshot" | Such a row — the idea's, the book's, and an endpoint written for it — is labelled `unobserved`. Nothing was read, so nothing claims to be a snapshot value |
| R-36 | B-SAME (one name, one idea) against E11's rename: a ticker change **into** a symbol another idea of the same book already holds | Not applied to any ledger of the idea. The holding keeps its old symbol at a carried mark, not full quality, with `PRACTICE_FIELD_RENAME_BLOCKED`; the rest of the book closes normally. (Applying it would put one ticker in two ideas; refusing the whole close would stop every other idea's valuation.) |
| R-37 | Rule 7 and §4: where code may sell | At the idea book's three windows only, and only under the window's own key: a close snapshot, or a key that is not the slot's, sells nothing (`not_a_sale_window`). No caller could do otherwise today; the check makes it a property of the sale rather than of its callers |
| R-38 | §11's banned-word scan: "every result and endpoint row written in the suite" | The scan runs after every test of every Practice Field test file that can write a result (ten files, the cron's isolation file among them), not only the ones written for results |
| R-39 | Rule 8, on the new records | The reconciliation also refuses: a holding with no cost tier, on any of the three ledgers; a comparison tier that differs from the idea's while the tie holds; a sale receipt that does not agree with itself (proceeds less cost basis is what it realised); a sale receipt whose kind is not one of the two origins; a `settled` idea without the endpoint figure its liquidation is measured against. Each was run against every state of five real lifecycles by the review and rejected none |
| R-40 | The protected-store scan's reach (T1A-07) | Listed in §5.4 with its limits. One judgment is the founder's (Q-I) |
| R-41 | The cron's own rule: a fire that left a book unclosed must not claim `complete` (and must not run retention). An idea book's close can now answer "not closed" for two reasons that mean it is still owed: the catch-up ran out of its 20-session bound, or the date has no stored snapshot | Both are counted (`ideaBooksUnclosed`, only when above 0) for an active idea book in the engine's page and for a draining one, and either keeps the fire from claiming `complete`. Every other "not closed" answer (already closed, out of order, not an open idea book) means there was nothing to do. With no idea book the counter is always 0 and the condition is the engine's own |
| R-42 | E13 and the fence: the draining query can fail on the very fire that builds a snapshot, and a snapshot is built once per key. Left out of it, a draining book would be valued at carried marks at that close for good — on its due session, an `unmeasurable` result nobody can amend | On that failure the build falls back to the coverage document, which does not depend on the query and still lists every open idea's symbols: if it reserves anything, the build is told an idea book is in play and covers them exactly as it would have. If it reserves nothing, or cannot be read either, the fire goes on with the engine's documents as before. In the eval pass, one status's failed query no longer costs the other status's books that fire; with no status listed the pass reports a failed pass as it always did |
| R-43 | Build prompt §8: a caught-up session is closed "exactly as a normal close would" | True of every idea and every row, with one stated exception: an idea **admitted** after the missed session and before the catch-up is already on the book, so that caught-up book row shows its reservation (treasury cash, reserved cash, open-idea list) though its equity is identical. Admission is not gated on a missed close in this build; T1a-2b builds the admission endpoint and can decide (§7) |

### 3.2 Questions for the founder

| # | Question | What is built meanwhile |
|---|---|---|
| Q-A (R-6) | A comparison or SPY name is delisted for cash. Is the cash, less its cost basis, **realised** on that paper ledger (as built), or should it be shown another way? §1 says a paper ledger's realised amount "stays 0" | Receipted and realised on that ledger, so it conserves. No sale receipt is ever allowed on a paper ledger |
| Q-B (R-13) | A settlement sale that waits happens after the result is written. Should the **result** itself read `blocked` (it would have to be amended once), or is the idea's live `processQuality` and its liquidation record the right place? §6 and E15 cannot both hold | The result is never rewritten; the idea's live field and its liquidation record carry the wait |
| Q-C (R-19) | Should a book that has never closed catch up from the session its first idea filled in? | Yes |
| Q-D (R-2) | The vendor's quotes run about 15 to 16 minutes behind (measured earlier this month on the Bomb checks). With a 20-minute limit measured at the snapshot's build, a slow build of more than about four minutes would refuse every quote in that window, for entries and for sales alike. Is 20 minutes the right figure for the idea book, or should the first live run measure it? | 20 minutes, the engine's own figure, as Amendment D leans |
| Q-E (R-30) | Is an action that was merely **late** (recognised by a catch-up, or filled after its first window because no pass ran) `blocked`? E15's two sentences leave it unsaid | `blocked`, under names that say late, not waited |
| Q-F (R-31) | A sale held back for a corporate action reads `blocked` (under a name that says held, not waited). Is that the right column for it? And is holding right for an ordinary **cash dividend** (about 1% of a leg, one session), or should a sale fill ex-dividend and forgo it? | The sale waits one session for the close to credit the dividend; a conflicting dividend holds it only while the feed still lists a row of it |
| Q-G (R-32) | Should a sale caused by a delisting carry its own origin on the decision record (a third beside `line_exit` and `settlement`)? | The record says `line_exit` as the prompt names; the result and the process column say delisting |
| Q-H (R-14) | A comparison mark that is not full quality makes the result `unmeasurable` but leaves the process `followed_plan`; the same on the idea's side reads `blocked`. Is the asymmetry intended? | As described |
| Q-I (R-40) | The scan now lists every write under a `mandates` book. Should `userMeta`, `mandateBatches` (and its stats and upstream-call stores), `mandateUniverseSnapshots` and `archetypeVintages` join the listed inventory? None sits under a book | Not listed |
| Q-J | Amendment D's Q-3 excludes a print from before the open. A print timed at 09:31 is accepted as that session's close mark if it is the last the vendor reports. Should a close mark have a floor on its print time? | No floor, as Q-3 is written |

## 4. Tests

Everything runs on an in-memory store with synthetic snapshots. No model call, no Firestore write, no EODHD call was made by this session (rule 3). The book is reconciled after every step of every row, and every valuation row any row writes is scanned for a sale's word.

### 4.1 Where each rule is tested

| Rule | File (rows) | What the rows show |
|---|---|---|
| **33 B-EXIT-ONE**, B-LINE (E1, E6) | `exits.test.js` | One of three names closes below its line: only it is sold, at the next eligible observation, whole; the other two, the comparison and SPY are untouched; the condition reads `breached`. A close exactly on the line is not below it. A close that is not full quality records the line unobserved |
| **34 B-EARLY** (E2, E14) | `exits.test.js` | The last holding exits: the result is written at that session's close against the comparison at the same close; the slot frees |
| **35 B-ENDPOINT** (E4, E5) | `exits.test.js`, `results.test.js` | Each ledger is cash plus holdings at the close's marks less its own modelled exit cost; an idea that never traded ties its same-stock comparison to the cent; each holding is costed at the tier it entered with |
| **36 B-WAIT** (E9) | `exits.test.js` | A sale with no eligible price fills nothing, at a carried mark or at cost; keeps the slot; records each refusal; alerts from the fifth session; the result reads `blocked` |
| **37 B-CATCHUP**, B-MISSED (E12) | `catchUp.test.js` | Two missed sessions caught up in order from stored snapshots before the next close **and before the next window**; a missing snapshot gives an `unobserved` row; a due session in the gap settles from its own stored snapshot or reads `unmeasurable`; no clock moves; the 20-session bound, through the close and through the pass |
| **38 B-DUE-BREACH** (E7) | `exits.test.js` | A close below a line on the due session records `breached` and produces exactly one sale: the settlement |
| B-ORDER (E8) | `exits.test.js` | Within a window the sale fills before the entry |
| B-BAND (B4), BUILD_RULES §9 | `results.test.js` | The band is 0.25% of the idea's own reserved capital, inclusive to the cent; the label is decided from the rounded figures the result shows |
| B-RESULT, E10, contract §4.4 | `results.test.js` | A breach and an economic result coexist; a mark that is not full quality on the idea or its comparison is `unmeasurable`; SPY carries no label; largest decline, exposure, trades and costs; what is fixed in release 1; the three banned words |
| B-CUTOFF (the part this build owns) | `exits.test.js` | After the endpoint nothing reads a line, rewrites the result or releases the reservation |
| B-DRAIN (E13; the part this build owns) | `catchUp.test.js`, `practiceFieldIsolation.test.js` | A draining idea book gets its slot snapshot, its sale, its close, its catch-up and its result through the Practice Field's own query, and takes no entry |
| E11 | `corporateActions.test.js` | A ticker change on a held name, a comparison name and SPY; a delisting with cash, with none, on a last holding, after the endpoint; a rename into another idea's symbol |
| T1A-C01, the two lifted bounds | `reconcile.statuses.test.js`, `reconcile.transitions.test.js` | Every status with every fault; the fill count and the realised amount against the receipts; a paper ledger never sells; the cost tier; the receipt's own consistency. Every money transition refuses a one-cent fault as read and as written, and writes nothing |
| Q-1, Q-2, Q-3, FR-A7 | `entry.test.js`, `marks.test.js`, `exits.test.js`, `close.test.js` | An unknown cost tier is refused before any fill; a 21-minute-old quote is refused for an entry and for a sale and a 20-minute-old one fills; a pre-open print is not a close mark; a fill reads the stored snapshot itself and a caller's object never reaches it |
| Nothing moves past an unclosed session | `entry.test.js`, `exits.test.js`, `catchUp.test.js` | An entry and a sale are refused past an unclosed session and in a closed one; the close refuses a book whose fills are dated after it; the window catches up first and does nothing if it cannot |
| The corporate-action holds, lateness | `exits.test.js`, `corporateActions.test.js` | A split, a dividend, a failed fetch, a missing day entry, a suspected split, a share-basis conflict hold the sale; a dropped dividend conflict does not; late is recorded as late under its own names |
| Isolation, both ways | `practiceFieldIsolation.test.js`, `ideaBook.test.js` | At `'off'` every Practice Field function answers before any read; the engine's sweeps with an idea book beside a quarterly book; the fences; the completion claim |
| T1A-07 | `compositionProtectedStores.scan.test.js` | §5.4 |
| Rule 7 | `exits.test.js` (a static check of the source) | Only `fills.js` imports the engine's fill computation; `exits.js` sells by one call to `executeIdeaFill`; the close and the settlement module never fill |

### 4.2 Counts (Practice Field files and the scan test, at the code head)

| File | Rows | |
|---|---|---|
| `practiceField/exits.test.js` | 39 | new |
| `practiceField/results.test.js` | 18 | new |
| `practiceField/catchUp.test.js` | 14 | new |
| `practiceField/corporateActions.test.js` | 16 | new |
| `practiceField/reconcile.statuses.test.js` | 10 | new |
| `practiceField/reconcile.transitions.test.js` | 10 | extended |
| `practiceField/entry.test.js` | 44 | extended |
| `practiceField/close.test.js` | 34 | extended |
| `practiceField/marks.test.js` | 26 | extended |
| `practiceField/ideaBook.test.js` | 32 | extended |
| `practiceField/admission.test.js` | 37 | unchanged |
| `practiceField/endToEnd.test.js` | 3 | rewritten |
| `cron/practiceFieldIsolation.test.js` | 54 | extended |
| `compositionProtectedStores.scan.test.js` | 30 | extended (9 before) |
| **Total** | **367** | |

### 4.3 The end-to-end run and its pinned evidence

One book, three ideas through its one short slot, one after another (R-25): the first resolves early when its only holding hits its line; the second has one line exit and settles the rest; the third settles clean. On the way: a split, a dividend, a missing quote and a sale that waits. The book is reconciled after every step. At the end every slot is free, every position is gone, the treasury holds the starting capital plus what each idea returned less what it reserved, and the store holds twelve decisions (six entries, two line exits, four settlement sales), 28 book rows, three results and three endpoint rows. A second run produces the same bytes. T1a-1's side-by-side run of three ideas in three slots is kept beside it.

**The pinned evidence changed twice, and why:**

| | SHA-256 of the store dump | Bytes | Documents |
|---|---|---|---|
| T1a-1 (the run it pinned: three ideas, entered and marked for twelve closes, nothing sold) | `69691024ca598cb5cd9280d5dcb21d4b0cd15a3ee126154c300f85b060f084a4` | 186,846 | — |
| This build before the review | `a8e3b55a88a2dd240b188b052aaabe71e17aec1f8e05bdf1a0cfd706aa9191c5` | 265,561 | 120 |
| **This build, final** | `ed90ebd5da97658f7488cf098829f577fe952e00c43c7f9d5830967d4fc80666` | 267,350 | 120 |

- **T1a-1 → this build.** The run itself is a different run (ideas now exit, settle and free the slot), so the bytes are not comparable field by field. What each document kind gained is §6.
- **Before the review → final.** The two dumps were compared leaf by leaf: **54 leaves added in 17 shapes, none removed, none changed** — no recorded figure moved. Added: `firstEligibleWindow` on each sale receipt (6); `result.trades.delistingExit.count` and `.costsUsd` (3 each); on `liquidation`, `corporateActionCashUsd`, `corporateActions`, `processQuality`, `blockedBy` (3 each); on the endpoint row, `writtenLate` (3) and for each of the three ledgers `rowMarkedHoldingsValueUsd`, `marksFullQuality`, `unsettledActions` (3 each). The lens-3 refuter reproduced the same count independently. The pin was stale on three work-in-progress commits between the first review fix and the re-pin; that history was squashed before the push.

### 4.4 The quarterly differential

The same harness as T1a-1's: seventeen quarterly scenarios run on `origin/main` and on the code head in clean Linux worktrees, every read, write, model prompt and response body recorded, and the two recordings compared byte for byte.

| | `origin/main` @ `c85f7b41` | Code head `b96cabff` | |
|---|---|---|---|
| 17 scenarios | `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43`, 1,118,594 bytes | the same hash, the same bytes | **BYTE-IDENTICAL** |
| Control (an eighteenth scenario with an idea book in play, mode on) | `749a941463b3d42e0a5b03279c69dcf8367e46839f85efc546c775badde210be`, 1,148,363 bytes | `1fef4a47a4bf671668202eb6c6f9773c3cdf57a22675a53cc18be3a66e6d98c1`, 1,156,076 bytes | **differs, in scenario 18 only** — the harness sees a change when there is one |

The same seventeen were also byte-identical against the base the build started on (`5675d305`), with the same hash: PR #1059 changed nothing the quarterly sweeps read.

Lens 3 added its own differential at `'off'` on a store holding a quarterly book, an active idea book and a draining one (§5.3): identical.

### 4.5 The full suite, the lint gate and the build (Linux, the code head)

All on the code head `b96cabff`, in a clean Linux worktree (WSL Ubuntu, Node 20.20.2, `TZ=UTC`), one at a time on a quiet machine.

| Check | Command | Result |
|---|---|---|
| **Full suite** | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit code 1.** `Test Files  1 failed \| 1469 passed \| 11 skipped (1481)` · `Tests  1 failed \| 32840 passed \| 131 skipped (32972)` · 311.53 s |
| …the one failing row | `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx` › "absent (every caller but the shell)…" | **Not this build's.** It fails the same way on `origin/main` @ `c85f7b41` and on `5675d305`, run alone on Linux in the same hour; it is a golden that expires by the clock (§7.3, item 6). It passed in this build's run on Friday 13 Nov. This build changes nothing under `src/` |
| Practice Field files, the scan test and the two Linux-only guards | `npx vitest run api/_utils/practiceField api/cron/practiceFieldIsolation.test.js api/_utils/compositionProtectedStores.scan.test.js api/_utils/mandateMoneyRounding.scan.test.js api/_utils/mandateRationale.imports.test.js` | exit 0 · `Test Files  16 passed (16)` · `Tests  380 passed (380)` |
| Lint gate | `npm run lint:gate` | exit 0 |
| Production build | `npx vite build` | exit 0 (built in 25.26 s) |

For the record, two earlier full-suite runs of this build: on Friday 13 Nov at `34f1a828`, before the scan was rebuilt, `1 failed | 1460 passed` (the scan's two allowlist rows, expected then); on Saturday at `f0b1e3fc`, run while a refuter was using the machine, `2 failed | 1459 passed` — the clock-expired row above and a five-second timeout in `src/components/League/leagueRawIds.guard.test.jsx`, which passed three times out of three run alone and passes in the final run.

On Windows the Practice Field files and the scan test pass (14 files, 367 rows). The two guards in the third row fail on Windows on `origin/main` as well (path separators; §7.3, item 7) and pass on Linux.

## 5. The BUILD_RULES §2 review

Three lenses, each on a read-only snapshot of the build, each told to find defects and fix nothing. Every finding went to a separate refuter told to break it. What survived was fixed; the fixes then had their own refuter passes (§5.5). No reviewer or refuter wrote to the repository; their probes live beside the snapshots, outside it.

### 5.1 Lens 2 — results and honesty (RH)

| # | Finding | Refuter | What was done |
|---|---|---|---|
| RH-1 | A window that ran before a missed close was caught up could enter an idea after an unclosed session; the later catch-up then wrote that session's row for an idea that had not entered yet (a pre-entry row, a phantom peak in the largest decline, an unobserved line-session, in one variant a wrongful sale) | **Confirmed, broader** (blocker) | Fixed: nothing moves past an unclosed session (R-29) |
| RH-2 | A sale that filled after an unclosed session produced an endpoint dated before the sale that caused it, measured at the wrong close | **Confirmed** (blocker) | Fixed by the same rule |
| RH-3 | A holding waiting on a delisting had its line skipped, so its unobserved sessions were not counted; its sale was counted as a line exit | **Confirmed, narrower** (should-fix; no delisting feed exists yet) | Fixed: the line is still read; counted apart (R-32). The refuter also held that the prompt names two origins only, so the third origin first added was taken back out |
| RH-4 | A settlement sale that waits leaves `result.processQuality` at `followed_plan` | **Confirmed, narrower**: a conflict between two ruled sentences, not a code defect | Not changed; the liquidation record now carries the wait; **Q-B** |
| RH-5 | A sale that filled late because no pass ran read `followed_plan` | **Confirmed, narrower** (low) | Fixed (R-30) |
| RH-6 | A delisting paid in cash after the endpoint read as a loss of the whole holding in the slippage | **Refuted as a violation** (the formula was the letter); facts reproduced | Fixed anyway: the figure was misleading (R-33) |
| RH-7 | An unsettled conflicting action made the result `unmeasurable` under a reason that named a mark | **Refuted as a violation**; a naming note | Its own reason added (R-34) |
| RH-8 | A row for a session with no stored snapshot was labelled "post-close snapshot" | **Confirmed** (note) | Fixed (R-35) |
| RH-9 | A comparison mark that is not full quality does not block the process column; the idea's does | **Confirmed** (note; the text decides neither way) | Not changed; **Q-H** |
| RH-10 | A print at 09:31 is accepted as that session's close mark | **Refuted**: it is the letter of Amendment D Q-3 | Not changed; **Q-J** |
| RH-11 | The banned-word scan did not run in every test file that writes a result | **Confirmed, broader** (two files, ten records, none carrying a word) | Fixed (R-38) |

### 5.2 Lens 1 — sales and settlement (SX)

| # | Finding | Refuter | What was done |
|---|---|---|---|
| SX-1 | A sale on the morning a split takes effect sells the old share count at the adjusted price | **Confirmed, broader** (blocker for share-basis actions: a reverse split created money; the window lasts until a close applies the action) | Fixed (R-31) |
| SX-2 | The same as RH-4 | **Confirmed**; needs a ruling | **Q-B** |
| SX-3 | The same as RH-6 | **Confirmed, narrower** | Fixed (R-33) |
| SX-4 | The same root as RH-1, on both branches of "first unclosed session" | **Confirmed** (blocker). The reviewer's suggested fix (skip the idea in the catch-up) was shown to wedge the book's close | Fixed by R-29 instead, the refuter's own alternative |
| SX-5 | The same root as RH-2, plus two cases the reviewer's fix did not reach (a row of an idea that goes on; the due session itself missed) | **Confirmed, broader** (blocker) | Fixed by R-29; both extra cases re-run and corrected |
| SX-6 | The reconciliation accepted a planted cost tier | **Confirmed, narrower** (no real path writes it; hardening by T1a-1's precedent) | Added (R-39). Run against 57 states of five real lifecycles: rejects none |
| SX-7 | The reconciliation accepted a sale receipt that did not agree with itself, an unknown kind, a settled idea with no endpoint figure | **Confirmed** (note) | Added (R-39) |
| SX-8 | Nothing in the sale itself stops it being asked to sell from a close snapshot | **Confirmed** (note; no caller can) | Added (R-37) |
| SX-9 | The endpoint's holdings figure and the valuation row's can differ by a cent a holding | **Confirmed** (note; not a §9 breach) | The row figure is carried on the endpoint (R-5) |
| SX-10 | A close run just before a slot made the next window's refusal read as a wait | **Refuted as filed** (the cron cannot make that call) — but it became reachable once catch-up moved to the windows | Fixed with R-30 |
| SX-11 | Twelve refusals are kept in detail, not all | **Confirmed** (note; stated in the header) | Not changed (R-11) |

### 5.3 Lens 3 — isolation and the scan (IS)

Checked and found sound, by run: at `'off'` the cron is the base **byte for byte** (one store with a quarterly book, an active idea book and a draining one; four fires; 41 reads, writes and transactions identical in order, the same bodies, logs, model and vendor calls, and no `kind` or Practice Field read). At `'on'` the quarterly book's four documents and its 4,108-byte prompt are identical with both idea books beside it. No fenced, engine, rules, index or flag file changed. A draining quarterly book cannot be picked up; a draining idea book reaches no quarterly path; the Practice Field only reads snapshots; no cross-kind reader exists. The scan rewrite lost no site (556 → 600 on the base tree, 564 → 607 on the build's).

| # | Finding | Refuter | What was done |
|---|---|---|---|
| IS-1 | The end-to-end pin was stale in the reviewed snapshot | **Confirmed** there; already re-pinned on later code after reading the difference | The 17 added field shapes are listed in §4.3 |
| IS-2 | One failed draining query on the fire that builds a snapshot leaves the draining book's symbols out of it for good; on a due session that is an `unmeasurable` result nobody can amend, and the fire says `errors: 0` | **Confirmed** (should-fix; unreachable until T1a-2b sets `draining`). Two of the reviewer's three fixes shown to have holes | Fixed along the refuter's lines (R-42) |
| IS-3 | The close sweep said `complete`, and ran retention, while an idea book was still unclosed for the date | **Confirmed, broader** (repeats once per 20 sessions of gap). Counting the two "still owed" reasons shown not to wedge the sweep | Fixed (R-41) |
| IS-4 | Six forms of a write to a book the scan did not see (a handle handed to a helper under another name; a transaction callback passed by name; `bulkWriter`; a write through `.parent`; `recursiveDelete`; a batch handed in). No real write in the tree was unlisted | **Confirmed** by the real product test; four forms free to cover, two with a narrow rule, the rest better declared | §5.4 |
| IS-5 | The quarterly cron's call of the idea-book close lost the key it had | **Confirmed, narrower**: a census of callers, not coverage of a write (note) | A static row now pins every caller (§5.4) |
| IS-6 | Three behaviours of the cron's draining block had no row | **Confirmed** | Rows added for each |
| IS-7 | The idea-book work inside the cron takes no deadline of its own | **Confirmed** (note; at four books far inside the budget) | Not changed; §7 |
| IS-8 | In the eval pass a failed draining query cost the active books that fire | **Confirmed** (note) | Fixed (R-42) |
| IS-9 | Allowlist notes that no longer matched the tree | **Confirmed** for two; the third refuted (the note matched the code) — and a stale header in the sales module found instead | Both corrected |

### 5.4 The protected-store scan (Astra T1A-07)

Astra's M06 — a new write to `mandates` appended to a Practice Field module — survived T1a-1's scan because the scan could only see a write whose path it could read off one chain, and listed nothing under a book. It is rebuilt in two steps, both in `api/_utils/compositionProtectedStoresScan.js`, its allowlist and its test.

**Step one, with the build.** The old resolver is kept verbatim as a floor: every site it listed is still listed, and a row on the real tree pins that. On top of it:

- A **money inventory**: the root `mandates`, and under a book `decisions`, `dailyRows`, `corporateActions`, `quarterSummaries`, `pendingScoringAppends`, `epochs`, `ideas`, `rows`, `nominations`. A write is listed when **any** segment of its resolved path is money, or its leaf is a protected collection.
- A **path resolver**: initialisers and reassignments; a transaction or batch handle's ref argument, whatever the callback's first parameter is called; query pass-through (`where`, `limit`, `get`, `.docs`, an index, `.ref`, loop and callback variables); destructuring; refs collected into an array; ref-builder functions in the same file or a relative import; slash paths, `db.doc('a/b')`, `collectionGroup`.
- A write the floor never saw becomes a site when it has **ref evidence**. Resolved to a store that is not listed, it passes; unresolved, it is listed as `unresolved`.

Measured, old scanner against new, site by site: 564 listed before, **607** after, **0 lost**. 84 sites that were `unresolved` now name their store; 43 are newly listed (30 the old scan could not see at all). The allowlist went from 421 keys to 480; its pinned counts sum to 607. The Practice Field's 37 keys were read site by site, each with its note. Every other key the rebuild added or re-keyed — the engine's included — was machine-enumerated, not reviewed writer by writer, and the allowlist says so.

**Step two, after lens 3** (IS-4, IS-5, IS-9). Six forms of a write to a book still passed. Each is now a site:

| Form | Rule | Listings it adds on the real tree |
|---|---|---|
| A handle handed to a helper under any name (`function apply(t, bookRef) { t.update(bookRef, …) }`), a batch handed in the same way | the base is a plain parameter and the first argument is a ref-named parameter of the same function | 0 |
| A transaction callback passed by name (`db.runTransaction(body)`) | the named function's first parameter is a handle (same file or a relative import) | 0 |
| `db.bulkWriter()` | a handle | 0 |
| A write through `.parent` | keeps the ref evidence beneath it; listed `unresolved` unless the chain names a listed store | 0 |
| `recursiveDelete(ref)` | always a site | 0 |

The wider rule for the first form ("any base, a ref-named first argument") was built first and dropped: it listed a `Map#set` on the real tree, as the refuter had measured. The lost caller key (IS-5) is replaced by a row that pins, from the real source, every call of the nine idea-book write functions by file, function and count (15 calls), their nine definitions, and that nothing else references or whole-imports them.

**Proofs** (run on the final scan files; the plants in a scratch copy of `api/` and `scripts/`, never the worktree):

- The scan test: 30 rows, green (21 before step two; 9 before the build).
- **M06 is killed**: appended exactly as Astra planted it, the suite fails naming `api/_utils/practiceField/sweep.js::…::update::mandates`. Under T1a-1's scan the same plant passed. The battery's own M06 and a transaction variant: §5.6.
- Each of the six forms planted at the foot of the real `sweep.js`: the suite goes red naming the planted key. Controls: untouched, green; `Map#set`, `Set#add`, `headers.set`, `URLSearchParams#set`, green.
- A new caller of an idea-book write function planted in `mandate-rollover.js` — by name, through an alias with a literal `mandates` chain (green on the base tree too), and through a namespace import: red each time.
- No coverage lost by step two: 607 listed before and after, 0 lost, 0 newly listed, 0 re-keyed; allowlist keys and counts untouched.
- The scanner's own mutants: 23 defined, 23 killed (step one); 39 defined, 39 killed (step two).

**What the scan still cannot see** (each is in the header and in an executable "limits of record" row):

- A new subcollection under an **opaque** book ref (`bookRef.collection('newThing')` with `bookRef` a parameter) passes until its name joins the inventory. Rooted at `db.collection('mandates')` it is caught.
- A ref that reaches its write under a name that is not ref-like: mapped out of a query (`page.docs.map((d) => d.ref)` then `.map((b) => b.update())`), on an object property (`ctx.book`), a helper parameter called `target`.
- A handle under an unknown name whose argument is not a ref-named parameter of the same function; callers of such a function; a two-hop helper chain (the founder's one-hop ruling).
- Ref builders reached through a namespace or default import, a re-export, or an object's method; `listDocuments()` results; a computed method name.
- Protected collections that are not money are matched at the leaf only (`agents/{id}/plays` passes).
- Files whose name holds `.test.`, or that do not end `.js` / `.mjs`, are not walked.
- Two deliberate over-listings: `X.parent.doc(y).update(…)` is listed even when it writes a store that is not listed; a `Map` handed in beside a ref-named parameter and keyed by it is listed.

### 5.5 The refuter passes on the fixes

**Second pass** (on the fixes for lenses 1 and 2). It re-ran every earlier probe against the fixed code: all 34 rows that had asserted a defect now fail. It then attacked each fix with its own probes and 53 mutants of the fixes (48 killed by the build's rows).

| Fix | Verdict | What it found | What was done |
|---|---|---|---|
| Nothing moves past an unclosed session | **Holds** | Notes only: an admission is not a fill and is not gated (R-43); catch-up capacity is 20 sessions a fire; no row pinned that a window catches up a never-closed book | Row added; the rest stated |
| A sale never fills across a corporate action | **Holds, with a hole and a new defect** | 2a: on a day the action fetch failed for the symbol, a split below the gap screen's threshold is still sold across. 2b: a conflicting **dividend** the feed dropped held the sale, and the slot, for good | Both fixed (R-31) |
| Lateness and waiting | **A new defect and a hole** | 3a: a sale queued by a window-time catch-up lost a real waiting session (the name had not printed) because the refusal read "before the decision". 3b: a waiting record inherited from a replaced line exit hid a late settlement fill | Both fixed (R-30) |
| Delisting-waiting holdings, the liquidation record | **Holds, with a hole** | 4a: a dividend credited between the endpoint and the settlement sale was outside the record, so the slippage read as a loss of the dividend | Fixed (R-33) |
| Reconciliation additions | **Holds** | No real lifecycle rejected | — |
| The smaller items | **Hold** | — | — |
| The rulings left as questions | **The code matches what is claimed** | — | — |

It also asked for a ruling: a sale held for a corporate action read as a wait for data. It now reads under its own name (R-31; **Q-F**).

**Third pass** (on the second pass's repairs and on lens 3's fixes). It re-ran the earlier probes again, ran its own, and served 45 mutants of the round against the build's rows (39 killed).

| Fix | Verdict | What it found | What was done |
|---|---|---|---|
| A failed corporate-action fetch holds the sale | **Holds, with a hole** | A day document that exists but has no entry for the symbol (built without the idea book's coverage) still sold | Fixed: held the same way (R-31) |
| A conflicting cash dividend holds no sale | **A new defect** | Releasing the sale at once costs the idea its dividend and its verdict when the feed then corrects the conflict to one row: the comparison is credited, the idea has already sold, and its result reads `unmeasurable` for good. Before that round the sale waited and the idea got a verdict | Fixed as prescribed: the sale waits while the feed still lists a row of that dividend, and is released once it lists none (R-31). The wait is bounded by the feed's own window |
| Hold naming | **Holds** | Two of the four hold names had no row | Rows added |
| A stale quote is a wait | **Holds** | The age helper truncated a fractional vendor time (half a second, at the boundary only); the 20-minute line had no row | Same arithmetic as the fill's own test; boundary rows added |
| An inherited waiting record | **Holds** | — | — |
| Cash paid after the endpoint | **Holds** | Nothing pinned that cash paid ON the endpoint session is not counted twice | Row added |
| The delisting gap exemption | **Holds** (the accepted trade: a real split on a delisting-waiting holding is sold across only if the feed never lists it) | — | Stated (R-32) |
| An unclosed idea book holds back `complete` | **Holds** | No false `complete`, no wedge, retention not run on such a fire; `'off'` and quarterly-only fires identical to the base | — |
| The coverage fallback | **Holds, with a hole** | The stand-in sent the build on to a second, unfenced read of the coverage document: if that failed the fire answered 500 where the fallback promises never to throw. With both the query and the fallback read failing, a snapshot is still built without the draining book's symbols, logged twice and not counted | The build is handed what the fallback read: no second read. The double failure is stated (§7.2 C-1b) |
| Per-status query isolation | **Holds, with a hole** (note) | With the active query failing and no draining book, the body did not say a query had failed | The body now carries the pass's counters whenever a query failed |
| The cron rows for lens 3 | **Real** | — | — |

**Fourth pass** (narrow: the third pass's repairs and the scan's second step).

It re-ran the third pass's tables on the repaired code, drove the real snapshot builders and the cron, and served 17 mutants of the repairs against the build's rows (15 killed). **No new defect.**

| Repair | Verdict | What it found | What was done |
|---|---|---|---|
| A conflicting dividend holds the sale while the feed lists a row of it | **Holds** | Where the feed corrects the conflict (cases A and C) the idea now ends `within_band` with the dividend on both ledgers; where the feed drops it the sale is released. The wait is bounded by the feed's window — an ex-date on a Monday is listed for five sessions and raises the fifth-session alert once — provided the vendor honours the window it is asked for | Stated (R-31) |
| A day document without the symbol holds the sale | **Holds** | No ordinary path found on which a normal day holds a sale: through the real builders a held symbol always has its entry, in every book mix tried. It holds only where the document was built without the book's coverage (the double failure of §7.2 C-1b; the mode switched on after the day's document was built) — the conservative side | — |
| The fallback hands the build its coverage read | **Holds** | 200, one read, both books closed; `'off'` and quarterly-only fires identical to the base, read for read | — |
| A failed query is in the body | **Holds** | Nothing pinned that a healthy quarterly-only fire still omits the field | Row added |
| The age arithmetic and the boundary rows | **Holds, with a hole** | All eight boundary mutants killed; but the row for a fractional vendor time could not fail without the repair (both arithmetics agreed at a whole-second build time) | Row moved to the half second; it now fails without the repair |
| The scan's second step | **Holds, with a hole** (low, latent) | All six forms fail the suite when planted. Of twelve new evasions tried against a book, ten are caught; two pass and were not declared: a ref builder reached through a **dynamic** import, and a ref-named **private** class field (`this.#bookRef`). The tree holds neither form | Both declared in the scan's header and added to its executable limits row |

The two mutants that survived the fourth pass (the fractional arithmetic; the body field written on every fire) each have a row now and are in the battery below, where both are killed (`R5-3a-truncation`, `R5-is8-body-only-when-needed`).

**What no refuter saw.** The follow-ups to the fourth pass — the moved boundary row, the row pinning the quarterly-only body, and the two limits added to the scan's header and its limits row — change tests and comments only, no product line, and were **not** sent to a refuter. They were checked by the suite and by the battery on the code head.

### 5.6 The mutation battery

Each mutant re-breaks one rule in a copy of the code head (a `git archive` tree, never the working tree) and runs the test files named for it. **Killed**: at least one row fails. **Survived**: every row passes. **Broken**: its anchor is not found exactly once, or the mutated file does not load — reported, never counted as a kill. The runner stops if the un-mutated baseline is not green, restores every file after each mutant and checks the restore.

| | Count |
|---|---|
| T1a-1's fix-round battery | 212 |
| …carried unchanged | 186 |
| …re-cut because this build moved the anchor (same id, same rule) | 25 |
| …of the build's 342 (carried, re-cut and added), re-cut again because the review's fixes moved the anchor | 16 (one of the sixteen, `SALE-11-not-before`, was only re-pointed at the test file its row had moved to — see below) |
| …retired | 1 — `R3-05-unknown-tier-named`: since Amendment D Q-1 no leg can enter at the unknown tier, so the list it re-broke is always empty and the code was removed |
| Added for this build's rules | 131 |
| Added for the rules the review added | 99 |
| **Defined** | **441** |
| **Ran** | **441** |
| **Killed** | **440 on the run; 441 once the re-pointed mutant was re-run** |
| **Survived** | **1 on the run; 0 after it** |
| Broken / missing | 0 / 0 |

**Astra's M06** (a write to `mandates` appended to `practiceField/sweep.js`, exactly as planted in the confirmation) is in the battery against the scan test, with a variant through a transaction and a ref variable: **both killed**, by the scan test's deny-by-default row, which names the planted write.

**The one survivor of the run, and what it was.** `SALE-11-not-before` (a sale fills only from a quote observed after the close that queued it) was run against `catchUp.test.js`, the file that held its row when the mutant was written. The review rewrote that row and the rule's row now lives in `exits.test.js` ("nothing is attempted before a sale's first eligible window… a close that ran late, just before a slot"). Re-pointed at that file and run alone on the same tree, the mutant is **killed** by that row (1 of 53 rows fails). Nothing in the code or the tests changed between the two runs; only the mutant's list of test files did.

A trial battery during the build (343 defined at `34f1a828`) left four survivors; each got a row or was retired, and all are killed above. The refuters ran their own mutants of each fix round against the build's rows as well (53, 45 and 17; §5.5), and the scanner's own two batteries are in §5.4.

### 5.7 Isolation of the review, disclosed

Reviewers and refuters worked on `git archive` snapshots under the session's scratch folder with `node_modules` linked, and wrote nothing in the repository. Three things touched it all the same: vitest writes its cache through the linked `node_modules`; two refuters ran `git status` in the worktree, which can refresh the index's stat cache; one reviewer's `ln -s` began copying `node_modules` into its scratch folder before it stopped and deleted the copy (the real folder was only read); and the fourth refuter found the `node_modules` links gone from every snapshot tree when it started (removed between passes; by which pass was not established), re-created three for its own use and removed them when it finished. The repository's own `node_modules` was read, never written, throughout: every Windows run after that, and the whole battery, ran from it. The scan's rebuild was done by a builder agent in the worktree itself, on the three scan files only.

## 6. Stores added or changed

**No new collection.** No Firestore rules or index change (they are T1a-2b's). Every write below is server-only, reached only while `PRACTICE_FIELD_MODE` is not `'off'`, and sits inside one transaction that reconciles the book before anything is buffered.

| Document | What is new | Written by |
|---|---|---|
| `mandates/{bookId}/ideas/{ideaId}/rows/endpoint` | **New document**, one per idea, create-once. `rowKind: 'endpoint'`, `basis: 'liquidation_value'`, `label` (`post_close_snapshot`, or `unobserved`), the endpoint session and its kind (`due_session`, `early_resolution`), `observed`, `writtenLate`, the close snapshot's key and build time, and for each of the three ledgers: cash, holdings at the close's marks (and the valuation row's own figure, `rowMarkedHoldingsValueUsd`), the modelled exit cost, the value, `marksFullQuality`, `unsettledActions`, and each holding with its mark, the mark's quality and the cost tier used. The gap to the comparison and to SPY, rounded and raw | the close that reaches the idea's endpoint |
| `mandates/{bookId}/ideas/{ideaId}` | `result` (the five columns and what is written beside them; written once). `endpoint` (a summary of the row). `status` gains `line_hit_exit_pending`, `settled`, `resulted`. `unobservedLineSessions` (by symbol). `track` (the running record the result is built from). `processQuality` (live), `blockedBy`, `waitedSessions`. `postEntryFillCount` now rises. `earlyResolution`. `liquidationProceedsUsd`, `liquidationSlippageUsd`, `liquidation` (sales, proceeds, `corporateActionCashUsd`, `corporateActions`, the endpoint figure, the slippage, the cash returned, its own `processQuality` and `blockedBy`). `settledAt`, `lastClosedOn`. `contract.schedule.liquidationSession` (frozen at admission). `entry.legCount`, `entry.costsPaidUsd` | admission, entry, the close, the sales |
| …the same document, `lines[]` | `breach` (session, close, level, the close's vendor time, the snapshot key, when it was recognised, whether late, whether on the due session). `renamedFrom` after a ticker change | the close |
| …the same document, `ledger.holdings.{SYM}` (and the comparison's and SPY's) | `costTier` (the tier the holding entered with). On the idea's own ledger only: `exitPending` (reason `line` or `delisting`, the session, the close, the level, the decision instant, whether late, the waiting record, `notBefore`) and `settlementPending` (the session, the decision instant, the exit it replaced, the waiting record, `notBefore`) | entry, the close, the sales |
| …the same document, `ledger` (and the comparison's and SPY's) | `saleReceipts[]` — empty on a comparison or SPY ledger, always. One entry per holding sold: the decision id, the kind (`line_exit` or `settlement`), shares, price, proceeds, cost basis, realised amount, cost paid, the tier, the mark and its vendor time, the window, `firstEligibleWindow`, and what queued it. `corporateActionReceipts[]` gains ticker-change and cash-delisting receipts. **Both lists are kept for the life of the ledger**: the reconciliation ties the ledger's dividends and its realised profit and loss to them | the sales; the close |
| `mandates/{bookId}/ideas/{ideaId}/rows/{date}` | `observed` (was the session's close snapshot stored?), `lineObservations` (what each line read: `below`, `at_or_above`, `unobserved`), `caughtUpAt` on a row written by a catch-up. `label` is `unobserved` on a session with no stored snapshot. A mark's `quality` gains `pre_open_print` and `unobserved`. An unobserved row's `closeSnapshotKey` is null | the close |
| `mandates/{bookId}/dailyRows/{date}` | `observed`, `caughtUpAt`; `label` as above | the close |
| `mandates/{bookId}/decisions/{ideaId}__line_exit__{SYM}` and `…__settlement__{SYM}` | **New documents** under the existing `decisions/`, create-once: the engine's decision shape (`verb: 'SELL'`, executed), `kind: 'idea_book'`, `origin: 'line_exit'` or `'settlement'`, the idea, epoch and contract version, no reason (`rationaleStatus: 'absent'`), no model. Owner-readable under the existing rule, as entry decisions already are | the sales |
| `mandates/{bookId}` | No new field. `treasury`, `slots` and `openIdeaIds` now also change when an idea is `resulted`; `portfolio` when a holding is sold | the sales; the close |
| `mandates/{bookId}/corporateActions/{actionId}` | Now also written for a ticker change and a cash delisting of an idea's own holding | the close |
| `practiceFieldCoverage/current` | No new field. An idea's entry is rebuilt after a ticker change and removed when it is `resulted` | the close; the sales |

**Read, never written, by this build:** `mandateUniverseSnapshots/{date}_{slot}` (every fill reads its slot's stored snapshot itself), `mandateUniverseSnapshots/{date}_close`, and `mandateUniverseDaily/{date}` (a sale reads whether the day's corporate-action fetch failed for its symbol). `practiceFieldCoverage/current` gains one more reader: the snapshot build's fallback when the draining query fails.

**The cron's response body** (not a store): `ideaBooks` gains `caughtUp`, `sold`, `saleWaiting`, `resulted`; the close sweep's body gains `drainingIdeaBooks` (only with a draining idea book) and `ideaBooksUnclosed` (only above 0). All are absent at `'off'`.

## 7. Carried to T1a-2b, and found outside the task

### 7.1 T1a-2b's, as Amendment E §3 assigns them

Owner read access (rules) and the index deploy with T0b's reason-field exemption; the evidence packet; the spend reservation (B9); the window ledger; founder endpoints to create a book, admit a fixture idea, and pause or wind down; T1A-05 (fresh admission marks); T1A-06 (the top-up race); FR-A5 / RF-A2. None is touched here.

### 7.2 What this build hands T1a-2b

| # | Item | Why it is not done here |
|---|---|---|
| C-1 | **Nothing sets `draining` yet.** Every draining-book path in this build (the eval pass, the close, the snapshot build, the coverage fallback, the counters) is exercised with a fixture standing in for the status. When T1a-2b's wind-down endpoint sets it, re-run §4's draining rows against the real transition | The endpoint is T1a-2b's |
| C-1b | **A double failure at a snapshot build is logged, not counted.** If the draining query and the fallback read of the coverage document both fail on the fire that builds a snapshot, and a quarterly book makes the fire build it anyway, the snapshot lacks the draining book's symbols for good (carried marks; on a due session, `unmeasurable`). Two `PRACTICE_FIELD_DRAINING_QUERY_FAILED` lines are logged; nothing in the body counts it. The same day's daily document lacks those symbols too, which now holds that book's sales for the day rather than selling blind | Counting it needs the cron to carry a signal it does not have; unreachable until `draining` exists |
| C-2 | **Admission is not gated on a missed close** (R-43). An idea admitted after a missed session and before its catch-up shows on that caught-up book row | Admission's endpoint is T1a-2b's; gating it changes what the player sees |
| C-3 | **The draining query on real Firestore.** `status == 'draining'` and `kind == 'idea_book'` is two equalities, which Firestore serves from single-field indexes; that was not run against the emulator or a real project (rule 3) | The index deploy is T1a-2b's |
| C-4 | **The coverage read inside the snapshot build is not fenced** (T1a-1's `practiceFieldBuildInputs`). If `practiceFieldCoverage/current` cannot be read on a fire where an idea book is in play, the fire answers 500 and a quarterly book beside it is not served on that fire (the next fire retries). T1a-1 had this for an active idea book; this build makes a draining one reach it too. Failing loudly there is the safe side for the idea book — a snapshot built without its symbols is permanent — so it is left as it is and stated | A choice between two harms; the founder's or T5's |
| C-5 | **The close on a day the corporate-action fetch failed.** The sale now waits on such a day (R-31). The close marks from the same daily layer through the same gap screen and has the same blind spot for a split below the screen's threshold; that side was not run | The close's mark rule is T1a-1's; widening it changes valuation rows |
| C-6 | **Two holds only the founder can clear** (R-31): a share-basis conflict the feed has dropped, and a split-shaped move the feed never explains. Both alert from the fifth session and keep the slot | The founder tool is T5 (E9) |
| C-7 | **The idea-book work in the cron has no deadline of its own** (IS-7). It spends the quarterly loop's 290 seconds; a pass that ran long would defer quarterly books to the next fire. One book 24 sessions behind costs 24 transactions in one fire; at the founder cap of four books this is far inside the budget | Capacity is T5 |
| C-8 | **Catch-up capacity is 20 sessions a fire.** An idea whose start session falls inside a longer gap can time out without one attempt, and an idea timed out because the catch-up threw at all three of its windows has no `lastEntryAttempt` to say why | Edge of an edge; needs a ruling on what the record should say |
| C-9 | Small: a ticker change while a settlement sale waits records the wait once under each symbol. `exitTierOf`'s widest-tier fallback can no longer be reached (the reconciliation refuses a holding with no tier) and can go | Cosmetic |

### 7.3 Found outside the task (not fixed)

1. `api/cron/agent-evaluate.js::completeBattle` — three writes to `agents` that were never on the scan's allowlist (the handle is named `t`). They are listed now, at 3; the writer was not reviewed.
2. `scripts/rule-compat-cleanup.js::main` — two settings writes the old scan could not see (now listed, unresolved). `scripts/ws1-observe-walk.js::removeTestAgent` deletes `agents/{id}/rules` and `bundles`, likewise.
3. Two real pass-through writes the scan still does not see, both to `agentBattles` (not money, not protected), unchanged from the base and named in the scan's header: `api/_utils/stockThresholdAdmission.js:128` and `api/cron/agent-evaluate.js:943`.
4. The Cockpit 1a allowlist note for `directiveWriter.js::fileDirectiveTransactional::update` says "three physical update calls"; the function has five.
5. Sixteen other writes through a handle named `t` pass because the floor resolves their ref to a store that is not listed; the same writes through a handle named `tx` are listed unresolved. The result depends on the handle's name.
6. **A test on `main` that fails by the clock.** `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx`, row "absent (every caller but the shell)…": its fixture dates the rankings Wed 11 Nov 22:05 ET and the row runs on the real clock, and `CompeteTab` shows a "Last updated…" note once rankings are 48 hours old. From **14 Nov 2026 03:05 UTC** the byte-for-byte golden fails — on `origin/main` (at `5675d305` and at `c85f7b41`) exactly as on this branch (run side by side on Linux; it passed in this build's Friday run). This build touches nothing in `src/`. Until it is fixed, CI is red on that row for every PR.
7. `api/_utils/mandateMoneyRounding.scan.test.js` and `api/_utils/mandateRationale.imports.test.js` fail on Windows on `origin/main` (path separators) and pass on Linux. Verified on the base commit.
8. Whether `userMeta` and the `mandateBatches` family belong in a listed inventory is Q-I.
