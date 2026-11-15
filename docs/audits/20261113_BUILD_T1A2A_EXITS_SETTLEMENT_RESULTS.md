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

---

## 8. Fix round, 14 Nov 2026 — Astra T2A-01, T2A-02

**Fix round, Practice Field T1a-2a** · Claude Code (Opus 5.5) · 14 Nov 2026
**Branch:** `claude/practice-field-t1a2a-exits-settlement` (draft PR #1061). **Before:** `c4eceba8f10cdf6a27a09123b196c477ef43e6cc`, the head Astra reviewed. `git fetch origin` first; `origin/main` was `5a8c3620452ef4df633b3da540284daae2f2ab11` (the merge of PR #1063, the CompeteTab clock pin) and the branch took it by a merge commit, `7ff31a67`, with no conflict (one file, `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx`). No rebase, no force-push. **After:** `743088ed0c9b311b81104b8f52850ef317c0c8e4` (the code head, the head of every check below; this report's commit follows it and changes no code). The round is 15 files, +1,348 / −67, after the merge.
**Attached by the founder, committed byte-identical:** `docs/audits/20261114_ASTRA_REVIEW_T1A2A.md`, SHA-256 `898b4c89c243f37beeeaf3841e82f473d2927a7e30a4c1762b272dd73d46d846`, taken from the attachment before the copy and from the committed blob after it (LF, no CR byte).
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged. No fenced file, flag value, pin, rule or index changed. The engine's `computeExecution`, `pendingActionsFor`, `applyCorporateAction`, `deriveActionId` and gap screen (`classifyOvernightGaps`) are called, not edited. This session made no model call, no Firestore write and no EODHD call.

### 8.1 In plain terms

Astra found two things that had to be fixed before merging. Both are fixed.

- **A renamed stock could be sold with the wrong number of shares.** When the data feed reported a split two contradictory ways, the idea book rightly refused to guess and held the holding back. But if the stock was renamed the same day, the rename moved the holding to the new ticker, the hold (filed under the old one) no longer reached it, and the next morning it was sold at the new, split-adjusted price with the old share count. **Now the rename waits.** While a holding's share count is in doubt, the rename is not applied on any of the idea's three ledgers: the holding keeps its old name and a note of the rename it is waiting for, it is valued at its last good price, and its sale stays held, alerting from the fifth session as before. The evening the feed settles the split, the split is applied, then the rename, and the next morning the sale fills on the right share count. If it never settles, the holding stays held until the founder acts. Nothing guesses a ratio. While the rename waits, its new ticker counts as the idea's own: no other idea can take that name.
- **With no idea book at all, switching the Practice Field on still changed the quarterly cron.** Each fire looked for idea books, and if that lookup failed a quarterly-only close called itself incomplete and skipped its clean-up. **Now each fire reads one small document first** — the list of open idea books, which is written whenever a book is created. If it lists none, the fire makes no other Practice Field query, and its answer, stored data, logs and clean-up are exactly the quarterly product's. If it lists a book, or cannot be read, everything runs as before.

Also done: the test Astra showed missing (a direct sale past an unclosed session) is in; the scan allowlist's notes no longer claim a review of the Mandate and Film Room write sites that never happened (they say *machine-enumerated, not reviewed*, and point to Astra's Appendix A, the list T5 reviews); Amendment E's §4, the restated isolation invariant, is appended verbatim (`docs/design/20261113_PRACTICE_FIELD_AMENDMENT_E_EXITS_SETTLEMENT_RESULTS.md`, SHA-256 now `8760e8174a6aa23720ea2e70c13eb7436f4a44a5e1a1d503c4c3ecbf288ca27e`).

The review of the fixes found that the first form of the rename fix let another idea take the waiting ticker; that, and four smaller gaps the refuters found after it, are fixed (§8.6). Two edge cases that fail safe are left as founder questions (§8.9).

| Check (Linux, `743088ed`, `TZ=UTC`, Node 20.20.2) | Result |
|---|---|
| Full suite (`flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`) | **exit code 0** · `Test Files  1472 passed \| 11 skipped (1483)` · `Tests  32915 passed \| 131 skipped (33046)` · 273.31 s |
| Practice Field files, the scan test, the two Linux-only guards, the new trace test | exit 0 · `Test Files  18 passed (18)` · `Tests  454 passed (454)` |
| `npm run lint:gate` / `npx vite build` | exit 0 / exit 0 (built in 16.49 s) |
| Quarterly differential, 17 scenarios, `origin/main` against the head | **byte-identical**, `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43`, 1,118,594 bytes — the same hash as the build's |
| …its control (an idea book in play, mode on) | differs in scenario 18 only (`749a9414…` → `ceb104cc…`) |
| Astra's traced differential (her 20 scenarios, base against head) | `'off'` 20/20 identical, every database operation; `'on'` 20/20 identical in response, stored documents, logs, upstream and model calls, completion and retention, with one registry read added first and, on 12 eval fires, the base's own idea-book query not made (R-47, **Q-K**) |
| Astra's T2A probe | her 15 unrenamed rows pass unchanged; her 3 renamed variants pass once they look for the holding under the ticker it keeps (18/18) |
| Mutation battery | 483 defined, 483 ran, 482 killed, 1 survived and then killed by a row added for it (§8.5) |
| Review | one lens and four refuter passes; 1 regression of the fix found and fixed, 8 further findings fixed, the rest recorded (§8.6) |
| End-to-end pin | unchanged, `ed90ebd5da97658f7488cf098829f577fe952e00c43c7f9d5830967d4fc80666`, 267,350 bytes (§8.7) |

### 8.2 The fixes, by file and line (at `743088ed`)

**Fix 1 — T2A-01** (`4b7cb394`, `58b2257a`; with the review's fixes `9151d508`, `4fbbbb60`, `af317b03`, `743088ed`):

| Where | What |
|---|---|
| `api/_utils/practiceField/ledger.js:161` | `unsettledShareBasisSymbols`: the symbols a ledger has not settled the share basis of — an unsettled share-basis conflict it was entitled to (`unsettledConflicts`), or a split, reverse split or stock distribution due on or before the session that it has neither applied nor declined (the engine's `pendingActionsFor`: `pending` and `noEntitlementData`) |
| `ledger.js:176` | `renameDeferralSymbols`: the same across the idea's three ledgers, after this close's other actions (applied to a copy, renames withheld) — so a clean split and a rename on one day still rename that day |
| `ledger.js:211`, `:215` | `applyLedgerActions` takes `deferRenames`, `renameTargetsTaken`, `renameIdsScreened`; its body is `applyActions` |
| `ledger.js:273` | ticker changes are taken **last** in a call |
| `ledger.js:323`–`:375` | the rename phase. Candidates are the feed's ticker-change rows and any rename a holding's `deferredRename` record still owes; a record whose row the close screened out for R-36 is not a candidate and takes that row's target (`:332`). A rename whose symbol is unresolved here or on another ledger (`:342`, `:348`) is not applied and not settled: the holding keeps its symbol and gets `deferredRename: { from, to, actionId, effectiveDate, deferredOn }` — the first deferral's session kept, the target following a listed row of the same id (`:352`) — and is valued at its carried mark. Otherwise R-36 is checked (`:361`), the record is taken off, the engine's `applyCorporateAction` moves the holding, and the receipt says `deferred: true` with `deferredOn` (`:367`) |
| `api/_utils/practiceField/close.js:123`–`:145` | the R-36 screen of the feed's rows: an id whose rows name more than one target is left whole for the ledger to refuse as a conflict (`:140`); each screened id goes to the ledger with its target |
| `close.js:149` | `renameDeferralSymbols` once per idea, handed with the screen's results to all three ledgers' calls — every ledger makes the same choice |
| `close.js:156`, `:162` | a rename blocked on the record path alerts as R-36's does; a waiting rename alerts `PRACTICE_FIELD_RENAME_DEFERRED` at every close. When it is applied the book's position, the line, `unobservedLineSessions` and the coverage entry follow through the existing outputs (no new write site) |
| `close.js:481` | another idea's waiting target counts as held for R-36 |
| `api/_utils/practiceField/admission.js:99`; `api/_utils/practiceField/entry.js:238`–`:242` | a waiting rename's target is that idea's name: admission refuses it (`ticker_held_by_other_idea`), and an entry naming it waits through `deferOrCancel` — refused by name, cancelled at its last entry slot if the rename still waits |

**Fix 2 — T2A-02** (`3c687ffd`):

| Where | What |
|---|---|
| `api/_utils/practiceField/sweep.js:72`–`:96` | `readIdeaBookPresence`: one read of `practiceFieldBooks/_registry`. Missing, or `openBooks` empty → no idea book; one or more listed → as before; `openBooks` not an object, or the read failing → "unknown", as before (a failed read is logged `PRACTICE_FIELD_REGISTRY_READ_FAILED` and is not counted itself). At `'off'` it reads nothing |
| `sweep.js:147`, `:238`, `:319` | the snapshot build's draining view, the eval pass (its active and draining queries) and the draining close return before any query when the answer is "no idea book" |
| `api/cron/mandate-evaluate.js:378`, `:848` | each sweep reads it once, first, and hands it to the snapshot build (`:394`, `:865`), the eval pass (`:467`) and the draining close (`:1025`) |

**The registry is a complete list — confirmed by reading every writer before relying on it, and pinned** (`api/_utils/practiceField/registryPresence.test.js`): the only builder of an idea-book document is `buildIdeaBookDoc` (`ideaBook.js:120`), called only by `createIdeaBook` (`ideaBook.js:208`), which writes the book and its registry entry in one transaction (`ideaBook.js:236`–`:246`); no other writer of `mandates` gives a document `kind: 'idea_book'` (`buildNewMandateDoc` carries no kind; `mandate-rollover.js:113` and `mandateEscape.js:117` refuse idea books; `mandateCreationService.js` builds quarterly books; `mandateAcceleratedClock.js` writes rows only); nothing sets an idea book's status yet (T1a-2b's drain will); the registry is written at one site — the allowlist's one `practiceFieldBooks` key, `ideaBook.js::createIdeaBook::set::practiceFieldBooks` at 2 (the claim and the registry) — and that write keeps every listed entry; clients can write neither collection (`firestore.rules`: `mandates` is `allow write: if false`; `practiceFieldBooks` falls to the default deny).

**Fix 3 — T2M01** (`2d27aad1`): `api/_utils/practiceField/catchUp.test.js:338`, Astra's direct-call row: `sellPendingHoldings` and `enterIdea`, called with no window pass before them past an unclosed session, each answer `not_this_session` / `earlier_session_unclosed` and the store is unchanged; the window then catches the session up first at the holdings it had, and sells and enters. With the sale's own refusal removed, **this file alone fails** (1 of 15; battery mutant `T2M01-skip-sale-session-barrier`).

**Fix 4 — T2A-03's honesty part** (`ca5df54f`): `api/_utils/compositionProtectedStoresAllowlist.json`. The sentence in `_notes_t1a07_money_store._not_reviewed_writer_by_writer` that said the Mandate engine's and the Film Room's keys "were read transaction by transaction" is corrected, and each note of a non-Practice-Field key this build added or re-keyed (`_notes_mandate_engine_money_store` and its `_scope`, `_newly_listed_outside_the_money_store`, `_rekeyed_outside_the_money_store`) begins *MACHINE-ENUMERATED, NOT REVIEWED* and names Astra's Appendix A as the review queue. **No key and no count changed:** `allowedWriteSites` is deep-equal to the parent commit's (480 keys, 607 sites); the 28 changed strings are all notes in those two blocks (checked by script). The six writes Astra lists first are existing product code the old scan could not see; nothing about them changed.

**Commits after the merge, in order:** `4b7cb394` (Fix 1), `3c687ffd` (Fix 2 and Amendment E §4), `2d27aad1` (Fix 3), `ca5df54f` (Fix 4), `a838b5dd` (Astra's review and its `docs/README.md` row; Amendment E's row records §4 and its new hash), `58b2257a` (Fix 1: the carried-mark row, found while cutting the battery), `9151d508` (the review's finding 1: the waiting target reserved; finding 2 pinned), `4fbbbb60` (refuter F1–F3), `af317b03` (refuter S1, S2), `743088ed` (the battery's survivor's row), then this report.

### 8.3 Readings stated, and questions

| # | Where the letter stops | Reading |
|---|---|---|
| R-44 | "Record it durably on each ledger that holds the symbol as `deferredRename: {…}`" | On the **holding** (`ledger.holdings[from].deferredRename`), not one field per ledger — a basket can wait on two renames at once. On every ledger that holds the symbol, in the shape given, present only while the rename waits |
| R-45 | How a waiting holding is valued | At its **carried mark**, not full quality, as R-36 values a blocked rename: its share basis is unresolved, so any snapshot price against the unadjusted count would put a wrong value on the row |
| R-46 | What releases a deferral held only by a share-basis row that was due and never applied, once the feed drops that row | Nothing remembers such a row (only a conflict leaves a receipt), so once it is no longer listed the rename applies from its record. A dropped share-basis **conflict** still holds it (C-6). Such a row is not reachable from the EODHD parser |
| R-47 | Fix 2's test: 'on' "identical except exactly one registry read per fire" against the base | Against `'off'` exactly that holds (`practiceFieldNoBook.trace.test.js`, 40 rows). Against the base **at 'on'** it cannot hold to the letter: the base's own T1a-1 eval pass already made one idea-book query on every eval fire that reached it, and the brief also says to skip "the idea-book pass's own query" — so on those 12 of Astra's 20 eval fires the head makes the registry read and not that query. Everything else is identical. **Q-K** |
| R-48 | "A missing document, or an empty `openBooks`" | A registry whose `openBooks` is not an object answers "unknown" — discovery runs (the fail-safe side) |
| R-49 | "If the registry read itself fails, behave as now" | Discovery runs and its failures count, as now; the failed read is logged and not counted itself |
| R-50 | The brief does not say what a waiting rename's target is to the rest of the book (the review's finding 1) | The waiting idea's: admission refuses it, an entry naming it waits (and times out at its last slot), another idea's rename into it is blocked by R-36 — as if the rename had applied. **Q-L** |
| R-51 | R-36 against a waiting rename | R-36 comes first and is unchanged: a rename into a symbol another idea holds is blocked, not deferred, even while the share basis is unresolved, and no record is made |

**Q-K:** at `'on'` with no idea book an eval fire also no longer makes the base's own idea-book query. Acceptable, or should that query stay so the trace against the base at `'on'` differs by the registry read alone? *Built: skipped, as the brief's list says.*
**Q-L:** an idea admitted **before** a rename began to wait, naming its target, now waits and times out (its slot freed, its cash returned); before this round the waiting rename would have lost instead (blocked by R-36). Which should yield? *Built: the waiting rename keeps its target.*

### 8.4 Fix 2's differential, in detail

`api/cron/practiceFieldNoBook.trace.test.js` (committed) fires the engine's two sweeps on the in-memory store with every database operation recorded in order (gets, queries, writes, transaction steps), beside the response, every stored document, every log line and every upstream and model call — Astra's twenty scenarios, at `'off'` and at `'on'`, with the registry missing and with it present and empty: `'on'` equals `'off'` plus exactly one registry read, first, and no idea-book query (40 rows). Her retention case answers `complete: true, errors: 0` and deletes both expired documents at both modes; her three draining-query-outage cases cannot occur at `'on'` (no query runs). Controls: the registry unreadable (discovery runs; with the draining query failing too, `complete: false, errors: 1`, no retention — as now); a registry not of its shape (discovery runs); a registry listing a draining book (it is closed by the Practice Field's own query); an active and a draining book (the fire differs from `'off'`, as it must).

The base-against-head form is Astra's own harness, run as a scratch probe in this session's scratchpad (`astra-repro/`: `base` = `origin/main` @ `5a8c3620`, `head` = `743088ed`): her evidence file, SHA-256 `1bc7b65b33f6d5190affe723e64ac8f2f57d6b03e62e5684c585f424d679d261`, classified case by case — `'off'` 20/20 identical including every operation; `'on'` 20/20 identical in response, stored documents, logs and calls, with the database operations equal once the one registry read (first in all 20) and the base's own idea-book query (in 12) are set aside. Her assertion is whole-trace equality, so her unmodified file reports 20/40; that is the R-47 difference, case for case.

### 8.5 The mutation battery

The build's 441 mutants, carried; the 5 whose anchors this round moved re-cut under the same id and rule (`CA-06-comparison`, `TICK-01-one-ledger-only`, `TICK-05-spy-ledger`, `KIND-16-pass-off`, `KIND-17-pass-off-inner`); 42 added — 26 for Fix 1 and its review fixes (among them: the rename applied despite an unresolved share basis; the rename applied on the idea's ledger only, and on the comparison's only; the idea-wide choice dropped; a deferred rename never applied after settlement; the record not kept, overwritten, left on the renamed holding, not refreshed, or standing in for a screened row; the waiting target free at admission, at entry or for another rename; the entry refusal thrown; the screen breaking a conflict), 14 for Fix 2 (among them: discovery run with an empty registry — in the eval pass, the snapshot view and the draining close; a missing registry read as "unknown", so a discovery failure counts; an empty registry read as listing books; the registry read twice in one fire, eval and close; the answer not handed on; a failed read read as "none"; a malformed registry read as "none"; the registry read at `'off'`; a failed read thrown), and T2M01 against `catchUp.test.js` alone. Every anchor was checked before the run (0 broken). Each mutant ran in a `git archive` copy of `af317b03` (the code of the final head), with a 30-second row timeout so that load cannot turn a row into a false kill; the runner stops if any un-mutated file fails and restores and checks every file after each mutant.

| | Count |
|---|---|
| Defined | **483** (441 carried, 5 of them re-cut; 42 added) |
| Ran | **483** (missing 0, broken 0) |
| Killed | **482** |
| Survived | **1** — `REN-01-blocked` (the close's R-36 screen of feed rows removed): the ledger's own R-36 check now catches feed rows too, so a plain blocked rename reads the same. The one observable difference — a rename into a held symbol while the share basis is unresolved is blocked, not deferred (R-51) — got a row (`743088ed`), and run again against it the mutant is **killed** (1 of 37). Only that test file changed after the run |

### 8.6 The review and its refuters (BUILD_RULES §2: the money path and the cron changed)

One independent lens on a read-only `git archive` snapshot of `a838b5dd` (fixes 1 and 2 as first built), and every finding handed to a refuter told to refute it with a reproduction against the new code **and** the reviewed head `c4eceba8`. Each fix the findings led to was refuted again on its own snapshot — three more passes. Reviewers and refuters wrote only scratch probes in their own snapshot folders, ran no git and never touched the working tree.

**The lens** (`a838b5dd`): no blocker.

| # | Finding | Refuter (against `c4eceba8` and the new code) | Disposition |
|---|---|---|---|
| 1 | While a rename waits, nothing reserves its target: another idea can be admitted into it and buy it, and R-36 then blocks the waiting rename (carried marks for as long as the other holds it) | **Confirmed, narrower.** A regression at the admission gate (before the round the rename applied at once and B-SAME refused the other idea); in the same sequence the reviewed head sells a third too few shares; once the other idea sells the target the rename applies and the sale fills on the adjusted count. Not reachable in production today (nothing calls `admitIdea` outside tests; nothing produces `ticker_change` rows; mode `'off'`) | **Fixed** (`9151d508`, completed in `4fbbbb60`, `af317b03`): R-50 |
| 2 | The idea-wide choice is pinned by no integration row; possibly equivalent | **"Equivalent" refuted**: a frozen-basket comparison holding the idea's name in a different quantity cannot apply a reverse split extreme enough to round its holding to nothing, while the idea's own ledger can | **Pinned** (`9151d508`) |
| 3 | A conflicting cash dividend plus a same-close rename: the sale fills while the conflict is listed; the dividend reaches neither ledger | **Confirmed, pre-existing** (byte-identical on the reviewed head); outside the brief (share-basis actions); about one dividend | Not fixed (§8.9) |
| 4 | A share-basis row the applier refuses holds the rename only while listed | **Confirmed, narrower, pre-existing**: the reviewed head never holds it; the new code is the stricter. Not reachable from the EODHD parser | Not fixed (R-46) |
| 5 | A record keeps the first target it deferred | **Confirmed, narrower, not a regression** (the reviewed head applies the first target at once) | **Fixed** (`4fbbbb60`, `af317b03`) |
| (a) | An active idea book with a missing or empty registry would be skipped silently | Holds by reading; no writer produces that state (pinned) | Note |
| (b) | A cashless delisting plus a rename of the same symbol in one close loses the waiting sale | **Confirmed, pre-existing** (run on both trees) | Not fixed (§8.9) |

**Refuter of `9151d508`** (the reservation): confirmed for its case; both halves killed by their rows. Found, all in this round's code: **F1** another idea's own clean rename could take a waiting target (R-36 read positions only) — **fixed**; **F2** the record kept a stale target, and a record could stand in for a row R-36 screened out — **fixed**; **F3** an entry naming a waiting target threw, so every fire counted an error, was not stamped and never claimed `complete` until the idea timed out — **fixed** (it waits). Notes: a comparison-only rename is screened by R-36 too (pre-existing; §8.9); Q-L.

**Refuter of `4fbbbb60`**: F1 correct in both book orders, F3 correct through the last slot. Found: **S1** a corrected row that R-36 screens out never reached the ledger, so the record kept its older target and renamed to it once the feed dropped the row — **fixed**; **S2** (pre-existing) the screen ran before conflict detection, so of two rows of one id with different targets it could strip one and let the other apply — **fixed**, because the record refresh relies on the screen. Notes: F1 is order-dependent within one close (exactly one idea gets the target); a rename into a symbol the same idea holds keeps its record for good (pre-existing); only the first refusal is recorded when a reserved name and a missing price coincide (cosmetic).

**Refuter of `af317b03`**: S2 could not be refuted (identical rows, case differences, a missing target, rows of one id under two symbols); S1's freed-target path renames to the corrected target. Found, **not fixed** (§8.9): if the feed renames two different held stocks into the same new ticker, both waiting ideas block each other for good (both held, both alerting every close; nothing sold on a wrong count); a correction that arrives as a conflict leaves the record on its older target (the existing conflict handling — the control with no held target does the same); a future-dated rename into a held symbol marks the holding blocked early (pre-existing).

Every fix above has its own row, and each row fails with its fix removed (checked by a mutant per fix before commit, and again by the battery).

### 8.7 The end-to-end pin

**Before:** `ed90ebd5da97658f7488cf098829f577fe952e00c43c7f9d5830967d4fc80666`, 267,350 bytes. **After:** the same. It did not move, and it is not stale: `endToEnd.test.js` computes the hash and asserts it, and it ran on the final head (Windows, and Linux in the 454-row run and the full suite). Why it did not move: the run has a split, a dividend, a missing quote and a waiting sale but no ticker change, and runs no cron. The new rename phase runs at every one of its closes and writes nothing when no rename is due; Fix 2 is outside it.

### 8.8 Isolation of the review, disclosed

Reviewers and refuters worked on `git archive` snapshots under this session's scratchpad (`review-snap`, `refute-base`, `refute-head`, `refute2`, `refute3`, `refute4`), `node_modules` a junction to the repository's, and wrote only their own probe folders. The battery ran in four separate `git archive` shard trees. A first battery start stopped at its own baseline check because the shard trees lacked `firestore.rules` (one registry row reads it); a second was stopped by hand when the review's finding 1 meant re-running on new code; a third stopped at its baseline under another session's load (two long rows timed out; both files pass alone, 40/40), after which the row timeout was raised to 30 seconds for the run reported above. Another session was running vitest on this machine during the battery and between Linux runs; the full suite ran under `flock` and finished green.

### 8.9 Not fixed — carried, or found outside the task

| # | Item | Why not here |
|---|---|---|
| C-10 | **Two held stocks renamed into one ticker.** If the feed renames two different held stocks to the same new ticker (one idea's corrected row naming another idea's waiting target), each idea reads the other's record as a reservation and both stay blocked, alerting at every close | A ticker names one listing, so a real feed cannot; the failure is closed (held, alerted, nothing sold on a wrong count, no money moves). A ruling on who owns a contested target is the founder's |
| C-11 | **A correction that arrives as a conflict.** Two targets for a waiting rename's id leave its record on its older target, which applies once the basis settles | The existing conflict handling; a conflicting rename is refused, and nothing says which target to keep |
| C-12 | **A conflicting cash dividend plus a same-close rename** sells while the conflict is listed and credits the dividend to neither ledger (review finding 3) | Pre-existing; outside the brief's share-basis scope; about one dividend |
| C-13 | **A cashless delisting plus a rename of the same symbol in one close** loses the waiting sale silently: the close looks the delisting up under the old ticker after the rename (review note (b)) | Pre-existing (run on the reviewed head) — **for separate tasking** |
| C-14 | **R-36 screens a comparison-only rename too** (the screen passes all three ledgers), so a comparison holding may be held at a carried mark when another idea holds the target | Pre-existing; whether a paper ledger's rename is B-SAME's concern is a ruling |
| C-15 | A rename into a symbol the same idea already holds keeps its record for good; a future-dated rename into a held symbol marks the holding blocked early; only the first refusal is recorded when a reserved name and a missing price coincide | Notes; pre-existing or cosmetic |
| C-6 (unchanged) | A share-basis conflict the feed drops still holds the sale — and now any rename waiting on it — until the founder acts | T5's founder tool |
| T2A-03 | The writer review of Appendix A's 85 keys, the six protected operations first | T5 (the notes now say so) |

## 9. Fix round 2, 15 Nov 2026 — the share-basis class (T2A-C01, C-13)

**Fix round 2, Practice Field T1a-2a** · Claude Code (Opus 5.5) · 15 Nov 2026
**Branch:** `claude/practice-field-t1a2a-exits-settlement` (draft PR #1061). **Before:** `d4d522cef23a6b0dd92ea50a860f0931004e9ce6`, the head Astra confirmed. `git fetch origin` first; `origin/main` had moved from `5a8c3620` to `0670fcd75d371e5cf2b37c2f7dd38defba27f34c` (PRs #1064–#1067; none touches `api/_utils/practiceField/`, `firestore.rules` or the indexes), and the branch took it by a merge commit, `fbf402d3`, with no conflict. No rebase, no force-push. The work ran on this session's worktree branch, reset to `d4d522ce`, and was pushed to the PR's branch as a fast-forward.
**After:** `1c4b99af7496ea6744c19bceb4cbd5b7f6c9a321`, the code head and the head of every check below. This report's commit follows it and changes no code. The round is 7 files, +839 / −54 after the merge: 5 under `api/` (+735 / −54), plus the attachment and its `docs/README.md` row.
**`origin/main` moved again during the round**, to `0b720accd53e016c87976c3c2a43f89a2f1cb892` (PR #1062, Shared Research KB-1: 18 files, none under `api/_utils/practiceField/`, `api/cron/`, `firestore.rules` or the indexes). After this report's commit the branch took it by a second merge commit, `27cf6410`, with no conflict (`docs/README.md` auto-merged). On that merged head, the tree CI tests: Linux full suite **exit code 0** · `Test Files  1501 passed | 12 skipped (1513)` · `Tests  33771 passed | 135 skipped (33906)`; `npm run lint:gate` exit 0; `npx vite build` exit 0 (built in 15.07 s). The differentials, the battery and the review were run on the code head `1c4b99af`; the merge changes no file they read.
**Attached by the founder, committed byte-identical:** `docs/audits/20261115_ASTRA_CONFIRMATION_T1A2A_FIX_ROUND.md`, SHA-256 `a61c127a32d03903678148592297bf48809d40c8804a9f79f7ee861f63fcdb61`. The hash was taken from the attachment before the copy and from the committed blob after it (LF, no CR byte).
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged. No fenced file, flag value, pin, rule or index changed. The engine's `computeExecution`, `pendingActionsFor`, `applyCorporateAction`, `deriveActionId` and gap screen (`classifyOvernightGaps`) are called, not edited. Nothing is repaired by choosing one of two conflicting ratios, by clearing a conflict receipt, or by weakening reconciliation. This session made no model call, no Firestore write and no EODHD call.

### 9.1 In plain terms

Astra found one more way money could move on a share count that was in doubt. When the data feed reported a split two contradictory ways, the idea book already refused to sell the holding, and since the last round it also refused to rename it. But a **cash buyout** of the stock (a "delisting with cash per share") still paid out at once: number of shares × cash per share, using the share count from before the split. That closed the idea, sent the cash back to the book and freed the slot. Depending on which way the split was later settled, the book was paid $11,996.40 where it was owed $14,395.68, $17,994.60 or $7,997.60. This hole was older than the rename fix; the rename fix only exposed it.

It was the third time the same mistake turned up: a sale, then a rename, now a cash payment, each acting on a share count that was not settled. **This round fixes the whole family, not the instance:**

- **While a holding's share count is in doubt, on any of the idea's three ledgers, nothing that depends on that count happens on any of them.** That covers a cash buyout, a cash dividend and a later split, as well as the sale and the rename that already waited. The holding stays. What it is owed is written on the holding, with the session it started waiting, so it survives the feed dropping the row. Nothing is credited, nothing is returned to the book, the idea stays open and keeps its slot, it is valued at its last trusted price, and an alert fires at every close.
- **When the count is settled**, at that same close: the split is applied first, then each held payment exactly once on the corrected count (on the idea's ledger, its comparison and the book), then any waiting rename, then the prices. Astra's three cases now pay exactly her control figures ($14,395.68, $17,994.60, $7,997.60), each once, and her own probe passes 16 of 16.
- **If the count is never settled**, nothing guesses: the holding stays held and alerting until the founder acts, as before (C-6).
- **A payment dated before the doubtful split** depends only on the count before it, which is not in doubt. It is paid at once, exactly as if there were no split, and a test shows that.
- **C-13 is fixed too.** A cashless delisting and a rename of the same stock in one close used to lose the waiting sale. The sale now follows the holding to its new ticker and fills once that ticker has a price.

The review found two more holes of the same family, both already in the code before this round, and both are fixed (§9.6). A split the system cannot apply (an impossible ratio, or one that would round the holding to nothing) was forgotten once the feed dropped it, and a later buyout then paid on the old count. A feed row written in lower case could slip past the checks. One question the review raised is the founder's: an idea whose own holdings are all sold resolves even while its comparison's share count is in doubt (§9.7, Q-M).

| Check (code head `1c4b99af`) | Result |
|---|---|
| Full suite (Linux, `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`) | **exit code 0** · `Test Files  1497 passed | 12 skipped (1509)` · `Tests  33576 passed | 135 skipped (33711)` · 309.66 s (Node 20.20.2; log SHA-256 `e3c7c6aa…`) |
| `npm run lint:gate` / `npx vite build` (Linux) | exit 0 / exit 0 (built in 15.83 s) |
| Practice Field files, the scan test, the cron isolation and trace tests (Windows) | `Test Files  16 passed (16)` · `Tests  484 passed (484)` |
| Astra's `probe/astra-routes.test.js`, unmodified (SHA-256 `da70ab2b…`), against this head | **16/16**; her day-4 `afterResolution` returns $14,395.68 / $17,994.60 / $7,997.60, equal to her controls |
| Quarterly differential, 17 scenarios, `origin/main` `0670fcd7` against the head | **byte-identical**: `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43`, 1,118,594 bytes, both sides (the same hash as the build's and the last round's) |
| …its control (an idea book in play, mode on) | differs in scenario 18 only (`749a9414…`, 1,148,363 B → `2553861a…`, 1,156,115 B); scenarios 1–17 identical |
| Astra's 40-case traced differential (Amendment E §4), `origin/main` against the head | `'off'` 20/20 identical in every database operation; `'on'` 20/20 identical in observable bytes, with one registry read first and the base's idea-book query absent in 12. Her classifier (`prepare-confirmation.mjs`, trace part) passes. Her raw whole-trace file reports 20 passed / 20 failed: those 20 failures are the R-47 differences, as she recorded |
| Mutation battery | 518 defined, 518 ran, **517 killed, 1 survived** (`R2-29`, argued equivalent — §9.7) |
| Review | one independent lens on a read-only snapshot, and two refuter passes: 3 findings, all confirmed narrower and all pre-existing at root; 2 fixed (with a third instance a refuter found), 1 put to the founder (§9.6) |

### 9.2 The inventory: every place that reads a holding's share count

Every place under `api/_utils/practiceField/`, and every engine function it calls, that uses a holding's share count to compute money, or to move, rename or close a holding. "Unresolved" means one of three things on any of the idea's three ledgers:

- an unsettled share-basis conflict;
- a share-basis action due on or before the session that the ledger has neither applied nor declined;
- (new) a share-basis action the ledger holds, or cannot apply (`ledger.js:212` `unresolvedShareBasis`, idea-wide through `ledger.js:240` `shareBasisHolds`).

"Before" is `d4d522ce`; "after" is `1c4b99af`. The inventory written before any code is in this session's scratchpad (`inventory-before.md`); this table is that one, completed.

| # | Path | `file:line` (after) | Reads share count for | While basis unresolved, before | After this round | Test (`corporateActions.test.js` unless named) |
|---|---|---|---|---|---|---|
| 1 | Sale (line exit, delisting exit, settlement sale) | `exits.js:160` → `ledger.js:694` `saleHeldBackBy` → `executeIdeaFill` | quantity sold × price | Held on the idea's **own** ledger (pending row, unsettled conflict, gap screen). Not held when only another ledger had the basis unresolved. Released once a due row dropped from the feed (R-46) | **Held**, idea-wide: also while the holding carries a held action (`:698`) or another ledger has the symbol unresolved (`:712`, `otherLedgers`). A refused row is recorded, so a dropped row keeps it held | "the feed rows DISAPPEAR…", "COMPARISON-ONLY, through the close and the window", "THE DEFINITION…", the three arms × "DROPPED BEFORE…" |
| 2 | Ticker change | `ledger.js:528` (`wait`) | moves the holding key | Held (`deferredRename`), idea-wide; released when a refused due row left the feed (R-46) | **Held**; the wait set now includes refused and held share-basis records, so a dropped refused row no longer releases it (R-46 narrowed, R-56) | the T2A-01 rows, unchanged and passing; refuter 2 r5 |
| 3 | Cash delisting | `ledger.js:453` gate → engine `applyCorporateAction` (`mandateCorporateActions.js:246`) | shares × cashPerShare → cash; the holding closes; the idea may resolve | **Not held** (T2A-C01) | **Held** (`countDependent`, `:145`; `hold`, `:403`): recorded on the holding, no cash, no release, the idea not resolved; paid once on the adjusted count when the basis settles | Astra's three × (rename, no rename) "…is HELD"; × (listed, dropped) "…credited ONCE…"; "the resolved-basis control" |
| 4 | Cash dividend | `ledger.js:453` → engine `:226` | shares × amount → cash (income) | **Not held**: credited on the unadjusted count | **Held** if dated on or after the unresolved action (R-53); credited once on the adjusted count when it settles. One dated before it is **provably unaffected (test)**: it is paid now on the settled count | "a CASH DIVIDEND dated after… / one dated BEFORE it is provably unaffected"; "a cash action of the SAME date…" |
| 5 | A later share-basis action | `ledger.js:453` → engine `:207` | shares × ratio, rounded at each step | **Not held**: applied on the unadjusted count, so the result differed from date order by rounding | **Held** behind an unresolved earlier one (strictly later dates); applied after it in date order, matching the control count | "a LATER share-basis action waits…" |
| 6 | Same-date share-basis and cash action | `ledger.js:293` `phaseRank` (the engine's `pendingActionsFor` sorts by date and id) | order | `cash_dividend_…` and `delisting_…` sorted before `split_…` on one date, so cash was paid on the count before the split | **Share-basis first** on one date (R-55, **Q-N**) | "on ONE date the share-basis action is applied first…" |
| 7 | Cashless delisting + rename, one close (C-13) | `ledger.js:562` → `close.js:197` | puts `exitPending` on the holding | **Lost**: the lookup used the old ticker | **Kept**: the waiting delisting follows the holding to its new ticker, with its carried mark that close (R-59) | "C-13 — the rename applies, and the waiting sale follows…"; "…with the share basis unresolved, the rename waits instead…" (a control that already passed) |
| 8 | Valuation (rows, book equity, admission's equity, endpoint marks) | `ledger.js:574`–`:575` → `close.js` `value` → `valueLedger` / `markBook` | shares × mark | Carried mark only while the conflict was **listed**. After the feed dropped it, a fresh price × the old count, unless the gap screen (40%, shapes n=2…10) froze it; a 1.2 or 1.5 ratio passes | **Held**: carried mark whenever the symbol is unresolved on the ledger or anywhere in the idea (R-57) | "VALUATION…"; "COMPARISON-ONLY, through the close…" (S[1] mark); the pure comparison-only row (`unresolved`) |
| 9 | Endpoint and result | `settlement.js:195` | shares × mark × (1 − cost); `unmeasurable` / `blocked` | Unmeasurable and blocked only for an unsettled **conflict** (R-34); a refused or dropped row was not seen | Also for every held action, by name (`idea_unsettled_corporate_action`, `endpoint_unsettled_corporate_action`) | "at the ENDPOINT a held action leaves the value in doubt…" |
| 10 | Lines | `settlement.js` `readLines` | mark against level (per share) | Not read while a conflict was unsettled or the mark was not full quality | **Provably unaffected (test)**: an unresolved symbol is at its carried mark (row 8), so its line reads `unobserved` | "LINES are provably unaffected…"; "a row's CASE never matters…" |
| 11 | Resolution, treasury return, slot release | `close.js` endpoint / `resulted` / release; `settlement.js` `completedLiquidation` | the idea's holdings empty → its cash returns | Reached when row 3 closed the last holding (T2A-C01) | **Held** through rows 1 and 3: a held holding stays, so nothing resolves. A paper ledger's own doubt does not hold the idea's resolution (**Q-M**) | Astra's rows (slot, `openIdeaIds`, treasury unchanged) |
| 12 | Book mirror of applied actions | `close.js` (the `ownApplied` loop) | replays the idea's applied actions on the book's positions and cash | Mirrored whatever row 3, 4 or 5 applied | A held action is applied, and therefore mirrored, only once it is released; reconciliation passes at every close | "…credited ONCE…" (book corporate-action document, positions, treasury) |
| 13 | Admission's exposure | `admission.js:181` | shares × `lastMark` | Read `lastMark` from row 8 | **Provably unaffected (test)**: `lastMark` stays the carried one while unresolved | "VALUATION…" (the book position's `lastMark`) |
| 14 | Entry | `entry.js` | buys a new holding | Reads no existing holding's count (B-SAME keeps one name to one idea) | Unchanged: **provably unaffected** (it reads no count) | B-SAME admission and entry rows (existing) |
| 15 | Reconciliation | `reconcile.js` | compares counts across book and idea | Consistency only; computes no money | Unchanged; it runs before and after every close in every new row | every row (`recon`) |
| 16 | Gap screen (a suspected split with no feed row) | `ledger.js` `suspectedActionSymbols`; `saleHeldBackBy` | holds a sale or a mark | Outside this round's definition: there is no row, so nothing can settle it | Unchanged: it holds the sale and the mark while the move has a split's shape (R-31) | existing SX rows |

### 9.3 The changes, by file and line (at `1c4b99af`)

| Where | What |
|---|---|
| `api/_utils/practiceField/ledger.js:58`–`:72` | The header: the class rule, in full |
| `ledger.js:145` | `countDependent`: a split, reverse split or stock distribution; a cash dividend; a delisting with cash. A cashless delisting is never applied (E11) |
| `ledger.js:169` | `heldActionRecords`: the held actions on a ledger. The record lives on the **holding** (`heldActions`): `{ actionId, type, ticker, effectiveDate, ratio, amount, cashPerShare, source, heldOn, heldBecause, refused? }` |
| `ledger.js:212`, `:228` | `unresolvedShareBasis`: the unresolved share-basis items by symbol, each with its date and ledger. They are the conflicts, the due rows and the held or refused share-basis records. `unsettledShareBasisSymbols` is its set of symbols, the same function the rename fix used, with the held records added |
| `ledger.js:240`, `:255` | `shareBasisHolds`: the **idea's** hold set, from a dry run of each ledger with only its share-basis actions applied (cash actions and renames withheld). `renameDeferralSymbols` is its set of symbols |
| `ledger.js:293` | One call's order: by date; on one date, share-basis actions first, then the rest, then renames; then by id |
| `ledger.js:351` | A held action whose own id the feed now lists two ways is dropped: the conflict's receipt governs it |
| `ledger.js:380`–`:396` | `blocked` and `causesOf`. An action is held if an unresolved share-basis item for the same symbol is dated **on or before** it (**strictly before** for a share-basis action), on this ledger or anywhere in the idea's hold set. An item this call has already settled does not count |
| `ledger.js:403` | `hold`: the action is not applied and not settled. The record is written, refreshed to the payload the feed lists now, and keeps its first `heldOn`. A share-basis action held this way blocks what follows it |
| `ledger.js:420`, `:461`, `:487` | A share-basis action the ledger cannot apply is recorded with `refused`: no entitlement data, a ratio the applier refuses, or one that rounds the holding to nothing (review F2) |
| `ledger.js:429`, `:433` | The candidates are the feed's rows plus every held record whose row the feed no longer lists. A listed row of the same id supersedes its record. A `refused` record is never replayed: only a listed row of its id can settle it |
| `ledger.js:453`–`:455`, `:491` | The gate. On release the receipt carries `held: true` and `heldOn`, and the record is removed. The applied action goes to `applied`, so the close mirrors it on the book |
| `ledger.js:374`, `:487`, `:502`, `:550` | Every check is made under the holding's own upper-case key, whatever case a row carries (review F3; refuter 2) |
| `ledger.js:528` | Renames wait for the idea's hold set and this ledger's unresolved symbols, as before, now including held and refused records |
| `ledger.js:562` | **C-13**: a cashless delisting is handed to the close under the holding's new ticker (`renamedFrom` kept), and its carried mark follows it for that close |
| `ledger.js:574`–`:575` | Every symbol unresolved on the ledger, or in the idea's hold set, is valued at its carried mark |
| `ledger.js:694`–`:715` | `saleHeldBackBy(…, { otherLedgers })`: a holding carrying a held action is not sold (`:698`), and neither is one whose symbol another ledger of the idea has unresolved (`:712`) |
| `api/_utils/practiceField/exits.js:160` | The window hands the guard the idea's comparison and SPY ledgers |
| `api/_utils/practiceField/close.js:151`–`:153` | The close computes the idea's hold set once and hands the same set to all three ledgers (`holds`); renames defer on its symbols |
| `close.js:166`–`:168` | `PRACTICE_FIELD_CORPORATE_ACTION_HELD <idea> <ledger> <symbol> <actionId>` at every close a held action waits, naming what it waits on and since when |
| `api/_utils/practiceField/settlement.js:195` | A held action is an unsettled corporate action at the endpoint: unmeasurable and blocked, by name |
| `api/_utils/practiceField/corporateActions.test.js:806`–end | The rows (§9.5) |

**Commits after the merge, in order:**

| Commit | What |
|---|---|
| `ae3e1726` | The class rule and its tests |
| `408d7d38` | C-13 (separable: the rows fail without it) |
| `706971ad` | A row for every gate. Five checks were dropped because each was implied by another, so a mutant of it could never fail |
| `db151130` | Astra's confirmation and its README row |
| `91d6ff08` | Review F2 and F3, plus rows isolating three gates the trial battery found shared |
| `b7f4a258` | Refuter 2's two raw-ticker sites |
| `1c4b99af` | The held record's cause memory dropped, now implied, and the definition's due-row arm pinned |

This report's commit follows them.

### 9.4 Readings stated, and questions

| # | Where the letter stops | Reading |
|---|---|---|
| R-52 | "on any ledger of that idea" | The **idea** decides, as for renames. A count-dependent action waits on all three ledgers when any one of them has the symbol unresolved after this close's share-basis actions. A same-stock comparison therefore stays tied, and a frozen-basket comparison that cannot apply a split holds the idea's own payment and sale too (**Q-O**) |
| R-53 | "nothing whose amount or effect depends on its share count" | The count a payment uses is the count on its own date. A payment dated **before** the unresolved action is paid now: that count is settled, and the test shows it equals the payment with no split at all. One dated **on or after** it waits. A later share-basis action waits only on one dated **strictly** earlier, so two of one date never wait on each other (the engine's id order decides between them, as before) |
| R-54 | "recorded durably as pending (like `deferredRename`)" | It lives on the **holding**, as `heldActions`, with the payload the feed last listed. A listed row of the same id supersedes it. A conflict on its own id drops it, and the conflict's receipt governs (no payload the feed contradicted is ever paid) |
| R-55 | "apply the share-basis action, then the held cash actions on the adjusted count" | On **one date**, share-basis actions come first for every action, not only held ones. A clean same-day dividend and split therefore credits the dividend on the post-split count; before this round it used the pre-split count, because `cash_dividend_…` sorts before `split_…`. Across dates the order is unchanged (**Q-N**) |
| R-56 | R-46 ("nothing remembers such a row") | Narrowed. A share-basis action the ledger cannot apply (no entitlement data, a refused ratio, or one that rounds to nothing) is recorded with `refused` and never replayed. It is settled only by a listed row of its id that applies, so its holding stays held (sale, rename and payments) until the feed corrects it or the founder acts (C-6). A rename held only by such a row no longer applies when the feed drops it |
| R-57 | Valuation | A symbol whose share basis is unresolved anywhere in the idea is valued at its **carried mark**, also after the feed drops a share-basis conflict (before, a fresh price × the old count unless the gap screen caught it). Conflicting **cash dividends** are unchanged: their mark is fresh again once dropped (FR-A1) |
| R-58 | "no sale (already true)" | It was true on the idea's own ledger only. Built to the brief's letter: the sale is held while any ledger of the idea has the symbol unresolved (**Q-O**) |
| R-59 | C-13: "the sale fills once a price exists under the right identity" | The rename applies (it was not in doubt). The waiting delisting sale follows the holding to the new ticker, its mark carried that close, and fills at the new ticker's price. If the share basis is unresolved, the rename waits instead and the holding keeps all three (sale, record, rename) |
| R-60 | "alerts" | `PRACTICE_FIELD_CORPORATE_ACTION_HELD` at every close a held action waits; the sale's existing `PRACTICE_FIELD_SALE_WAITING` from the fifth session |

**Q-M (review F1):** an idea whose own holdings are all sold resolves (result written, cash returned, slot freed) even while its comparison or SPY ledger has a share-basis action unresolved and a dividend held. The idea's own money does not depend on that paper count, and the result reads `unmeasurable` when the comparison is in doubt. It does **not** read unmeasurable when only the SPY line is in doubt: the SPY line is outside the economic label by design, and only `result.spy.fullQuality` is false. The paper ledger's held dividend then stays on a resulted idea and is never paid. Before this round it was paid, on the unadjusted count. Should resolution wait for the paper ledgers' share basis, or should the SPY line's doubt be named on the result? *Built: resolution does not wait; nothing in the idea's money changes.*
**Q-N (R-55):** on one date, should a dividend be credited on the count after a split of the same date (built), or before it (as the engine's id order did)?
**Q-O (R-52, R-58):** should a comparison-only doubt hold the idea's own cash and sale (built, the letter), or only the comparison's? Refuter 2's case: a frozen-basket comparison whose holding a correct reverse split rounds to nothing holds the idea **for good**, until the founder acts, though the idea's own count is settled.

### 9.5 Tests

All rows are in `corporateActions.test.js`, `describe('Fix round 2 — …')`, from `:806`; the file has 80 rows.

- **Astra's three T2A-C01 rows**, in her own scenario: an AAPL idea of $20,000 at $100, its line breached, contradictory rows for a stock distribution 1.2, a split 1.5 or a reverse split 2/3, then AAPL → AAPLX, then an old-ticker cash delisting at $60 with the conflict rows absent. Each is run with the rename and **without any rename** (Astra's control on the earlier head). In every case: no cash, no receipt and no applied id on any ledger; a record on the idea's and the comparison's holding; the idea `line_hit_exit_pending`; the slot, `openIdeaIds`, treasury and book cash unchanged; no book corporate-action document; the row not full quality and at its carried mark; the alert on both ledgers; reconciliation passing.
- **The same twelve when one consistent basis row arrives**, with the delisting row still listed or dropped (its record stands in). The basis is applied first, then the cash, once, on the adjusted count. That is Astra's control figure on both ledgers ($14,395.68 / $17,994.60 / $7,997.60), with `held: true, heldOn`. The idea is `resulted` with exactly that returned, the slot free, the book mirror's document written and the treasury up by exactly that. A later close listing it again pays nothing.
- **Astra's resolved-basis control**, for each type: the consistent row and the delisting in one close pay at once, with no `held`.
- **Feed rows disappearing**: six sessions with no rows. At each: held, alerting, the sale refused `corporate_action_unsettled`, the mark carried, the slot taken. Then the resolution pays once.
- **A cash dividend**: held after the unresolved action and credited once on the adjusted count from its record. One dated **before** it is credited now, equal to the run with no split at all. One of the **same date** waits.
- **A later stock distribution** behind an unresolved split: held, then applied after it, matching the date-order count on both ledgers and the book.
- **The other arms**: a refused ratio, one that rounds to nothing, and no entitlement data. For each: the cash waits, on the ledger's own state and idea-wide, and stays held after the feed drops both rows. The sale is held. Each arm is also run with its row **dropped before** any cash is listed (review F2): it is remembered, and a later delisting is not paid.
- **Lower case**: a split row in lower case applies to the holding's key and does not round to nothing (F3). A lower-case row of an unknown type holds the mark, with no line breach, and a refused lower-case rename leaves the holding's key unresolved (refuter 2).
- **Comparison-only**: through the close and the window, a frozen-basket comparison that cannot apply a reverse split holds the idea's cash delisting and its sale, and the idea is at its carried mark. In pure form: idea-wide holds, the sale with and without `otherLedgers`, and the definition's due-row arm.
- **Endpoint**: a held action with no conflict anywhere (a refused ratio) reaches the due session. The result is `unmeasurable` for `idea_unsettled_corporate_action` and blocked for `endpoint_unsettled_corporate_action`, naming both actions, and the slot is kept.
- **Lines** are provably unaffected (unobserved at a carried mark). **Valuation**: a dropped share-basis conflict keeps the carried mark on the row and the book position.
- **C-13**: a cashless delisting and a rename in one close. The holding is renamed with its `exitPending`, the line, position and coverage move, the alert names AAPLX, and the next window sells once at AAPLX's price. With the basis unresolved instead, the holding keeps its sale, its record and its rename, then renames with its sale once the basis settles.
- **Controls that did not change**: the ordinary cash delisting, rename, dividend and delisting rows already in this file and in `close.test.js`, and every T2A-01 row (renames), pass unmodified.

Each new fix row was run against the code before its fix and fails there (C-13: 1 of 2, the other being the control; F2/F3: 4 of 4; refuter 2's case row: 1 of 1).

### 9.6 The review and its refuters (BUILD_RULES §2)

There was one independent lens on a read-only `git archive` snapshot of `408d7d38`. It was told the rule and asked to find any remaining path that acts on an unresolved share count. Each finding went to a refuter, who ran it against the new code **and** against `d4d522ce`. The fixes it led to went to a second refuter on a snapshot of `91d6ff08`. Reviewers and refuters wrote only probe folders in their own snapshots, ran no git and never touched the working tree.

| # | Finding (lens) | Refuter 1 (`408d7d38` and `d4d522ce`) | Disposition |
|---|---|---|---|
| F1 | An idea resolves while a paper ledger's share basis is unresolved, and its held dividend is never paid | **Confirmed, narrower.** The idea's own money is unaffected: the returned cash and the treasury are identical on both trees. The resolution timing is the same as `d4d522ce`. That tree paid the paper dividend on the unadjusted count; the new code holds it and never pays it. The result is labelled `unmeasurable` when the comparison is in doubt, but not when only SPY is (SPY sits outside the economic label by design) | **Question Q-M**, not fixed |
| F2 | A share-basis action the ledger cannot apply is forgotten once the feed drops it, and a later cash delisting then pays on the unadjusted count ($5,998.20 on 199.940017 shares end to end) | **Confirmed, narrower, pre-existing:** `d4d522ce` pays the identical $5,998.20, and paid a dividend even while the bad row was listed. Reachable only from founder-written rows (the parser rejects bad ratios, entry always sets `openedAt`, and rounding to nothing needs a ratio below about 2.5e-9) | **Fixed** (`91d6ff08`): R-56 |
| F3 | A lower-case split row reads as rounding to nothing and holds everything after it | **Confirmed, narrower, pre-existing** at its root (`d4d522ce` paid the dividend on the unadjusted count; the new code fails closed). A corrected upper-case row clears it. Founder rows only | **Fixed** (`91d6ff08`) |

**Refuter 2** (`91d6ff08`):

- **The F2 fix held** in every attempt: a corrected row arriving after both rows dropped, a conflict of the refused id, a correction and a delisting in one close, a later split behind a refused one, a refused split with a deferred rename (corrected in lower case), and a correction after the endpoint followed by the settlement sale on the adjusted count. Each was applied once on all three ledgers and the mirror, with reconciliation passing.
- **A documented hold that needs a ruling:** a frozen-basket comparison whose holding a correct reverse split rounds to nothing holds the idea for good (**Q-O**).
- **Two raw-ticker sites remained**, both pre-existing. A lower-case row of a type nobody applies left the holding marked fresh, and caused a real line breach. A refused lower-case rename named the wrong key. Both are **fixed** (`b7f4a258`), each with a row.
- **Practice Field files:** 353/353 passed on its snapshot.

### 9.7 The mutation battery

The fix round's 483 mutants were carried, and the **11** whose anchors this round moved were re-cut under the same id and rule (`R1-12-zero-share-split`, `FX1-03-dedupe-applied`, `FX1-10-unsettled-quality`, `STAMP-05-quality`, `CA-05-delisting`, `T2A01-03`…`-07`, `T2A01-23`). **35** were added: at least one per inventory row, plus the two the brief names:

- `R2-24` and `R2-25`: held cash credited twice on resolution (delisting, dividend);
- `R2-26`: held cash credited on the unadjusted count.

Every anchor was checked before each run (0 broken). Each mutant ran in a `git archive` copy of the code head, with a 30-second row timeout. The runner stops if any un-mutated file fails, and it restores and checks every file after each mutant.

A trial run of the new mutants on `706971ad` found 3 gates whose rows were covered only by another gate (R2-18, R2-19, R2-23). Rows that isolate each were added (`91d6ff08`). A full run on `91d6ff08` (517 ran: 514 killed, 3 survived) found two more that review F2's fix had made redundant:

- the held record's cause memory (R2-12), dropped in `1c4b99af` and retired;
- the definition's due-row arm (T2A01-06), kept because the brief defines "unresolved" with it, and pinned by a direct row.

| On `1c4b99af` | Count |
|---|---|
| Defined | **518** (483 carried, 11 of them re-cut; 35 added) |
| Ran | **518** (missing 0, broken 0) |
| Killed | **517** |
| Survived | **1** — `R2-29-dry-run-pays-cash` (the hold set computed with cash actions applied in the dry run). Equivalent, argued: the dry run gates cash actions exactly as the real pass does, so it can pay only a cash action no unresolved share-basis item dated on or before it holds; paying it removes a holding whose remaining items are all dated after it, which hold no cash action of that holding and no rename (the holding is gone on every ledger that paid it). Kept as the advisor's defence, recorded here as equivalent |

### 9.8 Not fixed — carried, or found outside the task

| # | Item | Why not here |
|---|---|---|
| Q-M | An idea resolves while a paper ledger's share basis is in doubt; its held paper dividend is never paid, and SPY's doubt is not named on the result | The idea's money is unaffected; the founder's ruling (§9.4) |
| Q-O | A comparison-only doubt holds the idea; a comparison that a correct split rounds to nothing holds it for good | Built to the letter; the founder's ruling |
| C-16 | A dividend dated before a split but **first listed after** the split was applied is paid on the post-split count (refuter 2's note) | A late feed row, not an unresolved basis; the engine's entitlement has no history of counts |
| C-6 (unchanged) | A doubt that never settles holds the holding (sale, rename, payments) until the founder acts | T5's founder tool |
| C-10…C-12, C-14, C-15 | As in §8.9 | Unchanged by this round. C-13 is fixed here |
