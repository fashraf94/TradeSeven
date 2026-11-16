# Build T1a-2b-1 — the idea book's access, records and founder controls (dark)

**Build report, Practice Field T1a-2b-1** · Claude Code (Opus 5.5) · 15–16 Nov 2026
**Branch:** `claude/practice-field-t1a2b1-access-records` (the session opened in a fresh worktree of `origin/main` on an app-named branch; renamed to the prompt's name before the first commit).
**Base:** `origin/main` @ `71bc6bde7c0553cdb16e5c5f3752d248968967c3` (the merge of PR #1073), read after `git fetch origin` at the start; it is after `cb23d73c` (PR #1061, T1a-2a), as the prompt requires. Clean tree at the start.
**Code head:** `82693acb0192817029bdfc2f625bd8f95b3458ff` · 7 commits on the base · 40 files, +3,498 / −145. Of those, 18 are product or config (+1,419 / −62); the rest are tests. This report and its `docs/README.md` row follow in one more commit, which changes no code.
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged. No fenced file (BUILD_RULES §1), flag value or pin changed, and the new code calls no fenced function. Rules and index changes are written and tested here and **deployed by the founder after merge** (§7).
**This session made no model call, no Firestore write and no EODHD call.** Unit tests ran on the engine's in-memory store; the rules tests on the local Firestore emulator.

| Question | Answer |
|---|---|
| Can the owner read their book? | Yes. Ideas, their rows and evidence, the epochs and the window ledger are owner-read and server-only write. The owner is the parent book's `userId`, and the parent must be an idea book, so a quarterly book's owner gains nothing. Another player, a quarterly player, a privileged token and an anonymous client read nothing; nobody writes. Rules suite: exit 0, 43 files, 813 tests; this file 29/29, and 11 of 11 rules mutants killed |
| Does every result keep its evidence? | Yes. Each idea gets two create-once, content-hashed packets: `admission` (written in admission's transaction) and `result` (written in the endpoint close's transaction). They hold **copies** of every price, each mark with its own source, time and quality. The 120-day retention never reaches under a book (pinned) |
| Does every window leave a record? | Yes. There is one row per window the book was due, plus the close's row, which lists the session's expected, served and missing windows. Each missed window raises one `PRACTICE_FIELD_WINDOW_MISSED`. The expected windows come from `windows.js` alone |
| Is there a spend limit before any model call? | Yes, `spend.js`: $3 a month per book (B9), by Eastern month, reserved before the call and settled after, idempotent, exactly $3 allowed. No caller yet |
| Can the founder drive a book? | Yes: one endpoint, five actions, idempotent per owner and key. A wind-down completes at the close that finds no open idea; that close closes the book, removes its registry entry and closes the owner's claim, in one transaction |
| Q-D, Q-G, C-9 | Done: a 30-minute quote age for the idea book; a `delisting_exit` origin; the widest-tier fallback removed |
| Is the quarterly product unchanged? | Yes. The seventeen scenarios are **byte-identical** to `main` (`92a1be20…`), and the 40-case traced differential is **40/40 raw-identical**. The client bundle (`dist/`, 113 files) is byte-identical to the base build |
| Tests | Full Linux suite exit 0, `Test Files  1507 passed \| 12 skipped (1519)`, `Tests  33915 passed \| 135 skipped (34050)`; lint gate exit 0; `vite build` exit 0 |
| Review | Three lenses, a refuter on every finding, then a refuter on the fix round. Two must-fix were raised (B1, C1); the refuters held B1 at must-fix and moved C1 to should-fix. Both are fixed, as is every confirmed should-fix, including the two the fix-round refuter raised (NF-1, NF-2) (§5). That second round of fixes (`b9cab98d`) was checked by its own new rows and seven mutants cut by the author, not by a further independent refuter |
| Mutation battery | **71 defined, 71 ran, 71 killed, 0 survived, 0 broken (baseline 365 rows green); rules mutants 11 of 11 killed** |
| For the founder | Deploy the rules and the index (§7); eight questions (§3.2) |

---

## 1. In plain terms

T1a-1 put money into an idea and T1a-2a took it out and judged it. This build adds what a founder needs before the first book anyone watches. Everything is still switched off (`PRACTICE_FIELD_MODE = 'off'`): no model is called and no screen shows any of it.

**The owner can read their book.** The player's own app may read their idea book's ideas, each idea's daily rows and its two evidence packets, the book's settings epoch and its window ledger. Nobody else can. Nobody, the owner included, can write any of it: only the server writes. A player who has an ordinary quarterly Mandate book gains nothing from this. The founder deploys these rules after merging (§7).

**Every result keeps its own evidence.** When an idea is admitted, the server writes a sealed record of what it was judged against: the contract, the sources it named, the book's value and every price it used. For each price, the record says where it came from and how fresh it was. When the idea reaches its review date, the server writes a second sealed record of every price the verdict rests on:
- what each stock was bought at;
- the close that broke a price line;
- what was sold before the end;
- the dividends and splits;
- the final prices of the idea, its comparison and SPY.

It also holds the verdict itself. These are copies, not pointers, because the shared price snapshots are deleted after 120 days. Each record carries a fingerprint (a hash), so any later change shows. A record is written once; a second attempt is refused.

**Every window leaves a record.** For each window the book was due (today, the engine's three daily slots and the close), a row says when it was served and what code did there: sessions caught up; sales filled or waiting; entries filled, waiting or timed out. The model is not called yet, and every row says so. At each close, the day is checked: which windows were due, which were served and which were missed. Each missed window raises one alert. A window whose pass failed is never recorded as served. A book created too late in a window for any run to reach it is not owed that window.

**A spending limit exists before any model is called.** Each book may spend at most $3 a calendar month (Eastern time) on model calls. A call must reserve its estimated cost first. If that would take the month past $3, the call is refused and the month is marked exhausted. After the call, the real cost is settled. A call with no known price is charged its full estimate. Nothing calls this yet; the manager arrives in T1b.

**The founder can create a book, admit a test idea, pause it and wind it down.** All of it goes through one endpoint. It only works when the Practice Field is not switched off and the caller is on the founder list (`MANDATE_FOUNDER_UIDS`, the same list the Mandate's founder endpoint uses).
- A **paused** book still has its prices recorded and its stops and review dates honoured. Only the (future) model's drafting stops.
- A **wound-down** book takes no new idea and keeps running the ones it has. The first close that finds nothing left open closes it, counting the close of the session during which the request arrived (up to 18:00 Eastern; 15:00 on an early close). The book then leaves the founder's four-book cap, and the owner may start a new one. No cash is lost or reset.

Every request gets the same answer if it is sent again, whenever, and a request key can never act on a different book later.

**Three small items.**
- A quote may now be up to 30 minutes old for the idea book. The vendor runs 15–16 minutes behind; the quarterly engine keeps its 20.
- A sale forced by a delisting is now labelled as such.
- An unreachable fallback is gone.

**What did not change.** Corporate actions, sales, settlement, results and admission's limits are as T1a-2a left them, apart from the three small items. The quarterly Mandate is byte-for-byte the same across seventeen scenarios, and so is the app the players download.

## 2. Changes by `file:line`

Line numbers are at the code head. Everything is under `api/`, `firestore.rules`, `firestore.indexes.json` and `test/rules/`; nothing is under `src/`. No fenced file is touched. The engine's `createIdeaBook`, `admitIdea`, `canonicalContentHash`, `runRetentionCleanup` and the rest are called, never edited. `mandateClosePass.js` is unchanged, and a test pins its retention.

### 2.1 Access and indexes (§1, §2)

| Where | What |
|---|---|
| `firestore.rules:1509` | `isIdeaBookOwner(bookId)` checks that the caller is signed in **first**, so an anonymous request costs no parent read. Then `ownsIdeaBook(get(parent).data)` checks two things: the caller is the parent's `userId`, **and** the parent's `kind` is `'idea_book'` |
| `firestore.rules:1519`, `:1532`, `:1537` | Three match blocks: `ideas/{ideaId}` (with `rows/{rowId}` and `evidence/{packetId}`), `epochs/{epochId}` and `windows/{rowId}`. Each says `allow read: if isIdeaBookOwner(mandateId); allow write: if false`. Nothing else is matched, so the default deny covers `spendOps` (under the book), `practiceFieldBooks/*` with its `founderOps`, and `practiceFieldCoverage/*` |
| `firestore.indexes.json:889` | `fieldOverrides`: `decisions` / `rationale` → `indexes: []` (T0b item 5) |
| `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs` | New, 29 rows (§4.1) |

### 2.2 Records (§3, §4, §5)

| Where | What |
|---|---|
| `api/_utils/practiceField/evidence.js` (new) | `jsonPure` `:42` turns dates into ISO strings and makes lone surrogates well-formed, so the hash is of what Firestore stores. `verifyPacket` `:66`. `readAdmissionMarkSources` `:86` reads, in admission's transaction, the last close's book row and each idea's row of it. `markSourceOf` `:110` labels each mark `entry_fill`, `close` or `carried`, with its quality and vendor time. `buildAdmissionPacket` `:130`. `isCarriedMark` `:215`: only the ledger's own last mark counts as carried. `endpointCopy` `:224`: a carried mark keeps `carriedFromVendorTimeIso`. `buildResultPacket` `:248`. `resultPacketMissingMarks` `:306` |
| `api/_utils/practiceField/admission.js:346`, `:381` | The mark sources are read before any write; the admission packet is `tx.create`d in admission's transaction |
| `api/_utils/practiceField/close.js:597`–`:609` | Wind-down completion. The book is `draining`, the request came before the end of this session's close window (`sessionClosePassEndMs`), and no open idea is left |
| `close.js:619` | The reads of steps 7–9, every one before the first write: each endpoint idea's inception row, the session's window rows, the claim and the registry |
| `close.js:648`, `:652` | The result packets; the close's window row and its alerts |
| `close.js:695`, `:699` | `tx.create` of each result packet (beside the endpoint row) and of the close's window row |
| `close.js:715`–`:727` | Completion sets `status: 'closed'`, `closedAt`, `closedOn` and `windDown.completed*`. It removes this book's registry entry (the one `delete openBooks`) and closes the owner's claim (`bookId: null`) |
| `close.js:743` | `closeNextSessionKeepingAlerts` logs a committed session's alerts if a later session in the same call throws |
| `close.js:776`, `:813` | A catch-up session that completes the wind-down ends the call: the catch-up answers complete, the close answers `book_closed` |
| `api/_utils/practiceField/windows.js:81`, `:99`, `:107` | `CLOSE_WINDOW`. `ideaBookWindowsOf` is the one schedule: each slot of the session's own geometry with an evaluation fire still to come after the book was created, then the close |
| `windows.js:115`, `:125`, `:134` | `sessionCloseMs`; `sessionClosePassEndMs` (the engine's close window end, close + 120 minutes); `IDEA_BOOK_EVAL_FIRE_EVERY_MIN = 15` (pinned against `vercel.json`) |
| `windows.js:142`, `:154` | `slotEndMs`; `lastFireInSlotMs` |
| `api/_utils/practiceField/windowLedger.js` (new) | `attemptOf` `:49`. `foldWindowAttempt` `:73`: fills add up across attempts; a window is served only by a complete, error-free attempt; a served row never changes. `recordWindowAttempt` `:117`. `buildCloseWindowRow` `:141`: expected, served, missing and attempted windows, with one alert per missed window |
| `api/_utils/practiceField/sweep.js:225` | A window whose catch-up closed the book is complete and not served |
| `sweep.js:232` | Each pass (sales, entries) is caught on its own: a throw counts as one error and keeps the other pass's fills |
| `sweep.js:305`, `:311` | The window's row is recorded for every served attempt; the within-slot stamp is written only for a window that served the book |
| `api/_utils/practiceField/spend.js` (new) | `spendMonthOf` `:69`; `planReserve` `:107`; `planSettle` `:142`; `reserveSpend` `:199`; `settleSpend` `:212`. The book holds the totals; each call gets one create-once document at `mandates/{bookId}/spendOps/{opId}` |

### 2.3 Founder controls (§6)

| Where | What |
|---|---|
| `api/practice-field/founder.js` (new) | `handler` `:20`: middleware (10 calls a minute), POST only, `requireAuth` (uid from the token), the founder gate `:33`, then dispatch |
| `api/_utils/practiceField/founderControls.js` (new) | `founderAllowlist` `:56`: reads MANDATE_FOUNDER_UIDS at call time, parsed exactly as `api/mandate/create.js` parses it. `isPracticeFieldFounder` `:61`. `rankedAgentFor` `:72`. `founderOpRefOf` `:97` gives `practiceFieldBooks/{uid}/founderOps/{requestKey}`. `recordedRequest` `:122` handles create_book and admit_fixture: the request is recorded pending with the target it resolved to, run against that target, and its response stored. `planControl` `:197`. `applyControl` `:210` handles pause, resume and wind_down: the request is recorded in the transaction that applies it, and wind_down also moves the claim's status. `runFounderAction` `:249` |
| `api/_utils/practiceField/entry.js:179` | An entry's own transaction refuses a book that is not `active` (`book_not_open`) |

### 2.4 The three carried items (§7)

| Where | What |
|---|---|
| `constants.js:131`; `marks.js:92`, `:110` | Q-D: `PRACTICE_FIELD_MARK_MAX_AGE_MS = 30 min`, used by both age tests (entries and sales). `marks.js` no longer reads the engine's 20-minute constant |
| `constants.js:118`, `:122`; `exits.js:147`; `settlement.js:380`; `reconcile.js:66` | Q-G: the `delisting_exit` origin goes on the decision record and the receipt. `SALE_ORIGINS` has three kinds. The result counts delisting exits by the new kind, giving the same counts |
| `settlement.js:176` | C-9: `exitTierOf` throws `cost_tier_unknown` instead of costing at the widest tier |

### 2.5 Guards, pins and moved rows

- **`compositionProtectedStoresAllowlist.json`:** 12 keys added, 3 removed and one note restated, under `_notes_practice_field_t1a2b1`. They cover the new write sites; the two catch-up call sites are now one helper.
- **`mandateMoneyRounding.scan.test.js`:** one baseline entry, `practiceField/windows.js` (1 site). It is calendar arithmetic: the last cron fire inside a slot, an epoch instant floored to the 15-minute grid. It is not money.
- **`registryPresence.test.js`:** pins that the registry has two write sites. Creation adds; the completing close removes only its own book, in the same transaction. It also pins, in behaviour, that a book's status only moves forward.
- **Rows that moved, each on purpose:**
  - the Q-D boundaries, from 20/21 to 30/31 minutes (`marks.test.js`, `exits.test.js`);
  - Q-G's delisting row (`corporateActions.test.js`, decision id `…__delisting_exit__MSFT`) and the kinds the reconciliation accepts (`reconcile.statuses.test.js`);
  - C-9's fallback row (`results.test.js`), plus one synthetic holding given its tier (`corporateActions.test.js`);
  - nine rows that close a book without running its windows now set aside the window-missed alerts with `withoutWindowAlerts`: `close.test.js` ×5, `corporateActions.test.js` ×2, `exits.test.js` ×2, `catchUp.test.js` ×2;
  - the end-to-end pin (§4.2).
- **C-1:** every T1a-2a draining row now runs on the founder's real `wind_down` (`windDownBook`):
  - `practiceFieldIsolation.test.js` ×8
  - `practiceFieldNoBook.trace.test.js` ×2
  - `catchUp.test.js`, `entry.test.js` and `registryPresence.test.js`

  Three fixture rows stay, each on purpose:
  - `admission.test.js`: a row that names the refusal, with a real-transition row beside it;
  - `ideaBook.test.js`: `bookForOwner` answers the book's status over the claim's;
  - the Film Room's own `cardStore.transitions.test.js`.

## 3. Readings stated

### 3.1 Readings

| # | Where the text left room | What was built |
|---|---|---|
| R-1 | §1: "Owner means the parent book's userId" and "a quarterly book's owner gains nothing new" | The parent must also be an idea book (`kind == 'idea_book'`), so a document planted under a quarterly book is denied to its owner. Everything the quarterly owner could read before still reads exactly as before |
| R-2 | §1: which other stores | Only the five named. `spendOps` (this build's per-call spend records) and the founder's request records stay server-only because no rule matches them. `nominations` is T2's |
| R-3 | §2: "the stored manager reason" | `rationale` alone. It is the only free-text field of `DECISION_RATIONALE_FIELDS` (`convictionDiagnostic` is an integer). Every `decisions` collection belongs to a book, and nothing queries on `rationale` (pinned by `firestoreIndexes.test.js`) |
| R-4 | §2, C-3: "confirm from Firestore's documentation" | **No composite index.** Firestore's index overview lists compound equality queries among those single-field indexes support, and says Firestore "can merge the indexes for simple equality filters" (firebase.google.com/docs/firestore/query-data/index-overview). The query is two equalities and a limit, and neither field is exempted on `mandates` (pinned). The emulator does not enforce indexes, so this rests on the documentation, not on a run against a real project |
| R-5 | §3: "the book's equity and marks admission measured against (with their snapshot key)" | The packet holds the equity, cash, treasury and every position **as recorded**, and for each position its own `markSource`, one of three kinds. `entry_fill`: its idea entered after the last close, so the source is that entry window's snapshot. `close`: the last close marked it from its stored snapshot, so the source is that key, the close's quality for it, and the vendor's time or null. `carried`: it is marked at a carried price, and no snapshot is named. `lastClose` gives the last closed session as its own row records it: whether it was observed, and its snapshot key or null. The packet never names a snapshot that did not exist, and never claims a vendor time for a quote that had none (review B1, R-B1c). A carried mark names its time and quality but no snapshot key, even when its last one is known (the fix-round refuter's B1 residual) |
| R-6 | §3: "the source references" | The idea's origin and its `{ kind, ref }` sources. No source carries content yet (a founder fixture names none); excerpts are T1d's |
| R-7 | §3: what admission measured | The packet also holds the limits admission computed (the permitted maximum, the binding constraints, every limit) and the other open ideas |
| R-8 | §3: "a copy of every price the result relied on" | The result packet holds:<br>• entry fills on all three ledgers (from the inception row);<br>• every line with its level (split-adjusted) and its breach (close, vendor time, snapshot key);<br>• every sale filled before the endpoint;<br>• every corporate-action receipt applied;<br>• every endpoint mark, with its quality, its vendor time and the endpoint snapshot's key;<br>• the running record (`track`) the largest decline and exposure were computed from;<br>• the result.<br>An endpoint mark that is the ledger's own last mark (`carried_forward` or `unobserved`, no vendor time) names that mark's time as `carriedFromVendorTimeIso`. A fresh price the vendor gave no time for (`receipt_time_fallback`) names none and borrows none (fix-round NF-2). The settlement sales after the endpoint are not in the packet: the result does not rest on them |
| R-9 | §3: an idea with an endpoint and no inception row | This cannot be produced, because the entry writes both in one transaction. The close refuses it (`inception_row_missing`) rather than seal a packet without its entry prices |
| R-10 | §4: "due" | A window is due if an evaluation fire is left in its slot after the book was created. The cron fires every 15 minutes on the quarter hour, so a book created at 10:05 is owed the 10:00 slot (its 10:15 fire), and one created at 10:20 is not (fix-round NF-4). Due for active, draining and paused books; never for a closed one |
| R-11 | §4: "an early-close session has fewer" | Read from the engine's own geometry. At `main`, an early-close session (e.g. 27 Nov 2026) still has all three slots, at 10:00, 11:15 and 12:30. The schedule lives in `windows.js` alone, so T1b's early-close windows change it there. Founder question Q1 |
| R-12 | §4: "served" and "what code did" | Served means the window's pass completed with no error (the stamp's own condition). Each attempt folds into the window's one row. Fills, timeouts and results add up across attempts; what is waiting is the last attempt's. `outcome` is `code_action` when code filled, timed out, caught up or resulted anything, and `no_model_action` otherwise. A waiting sale or entry is looking, not acting |
| R-13 | §4: the close's row and "once" | The close's row lists `close` among expected and served. `missing` is the intraday windows that were due and not served, plus which of them were attempted. The close returns the alerts and its caller logs them, once: a session is closed once, and its row is create-once. If a later session in the same call throws, the call logs the committed sessions' alerts itself before the error goes on |
| R-14 | §5: the spend state | `reservedUsd` is the outstanding reservations at their estimate plus the settled calls at their charge, and the bound is checked against it. `exhausted` stays set for the rest of the month (contract §12) — Q2. A settlement that takes the month past $3 sets it too, since the call happened. The book holds the month's totals and last month's. Each call has its own create-once document (review B6, B7), read in the caller's transaction, so T1b must reserve before its transaction writes, and once per transaction |
| R-15 | §5: "every retry counts" and "idempotent on opId" | Each retry of a model call is reserved under its own operation id (e.g. `call-7#2`). The same id is one reservation, however often it is replayed. Refused (review B5, B8, B10, B11):<br>• a reservation whose clock is behind the stored month;<br>• an estimate under one micro-dollar;<br>• an instant without its offset;<br>• an op id that Firestore reserves |
| R-16 | §6: "for the caller and their ranked agent" | The ranked agent is one of the caller's own agents that is neither a training clone nor a casual clone. A body may name one of them (`agentId`). With none named, there must be exactly one (otherwise `ranked_agent_ambiguous`). The archetype is the ranked record's own `archetype`, not a per-game loadout's — Q6 |
| R-17 | §6: "idempotent on a client requestKey" | Keys are per OWNER (review C1). Every action records its request at `practiceFieldBooks/{uid}/founderOps/{requestKey}`, with a fingerprint of the body and the target it resolved to. A replay answers the stored response, whatever book the claim names later. Another action or another body under the same key is `request_key_conflict` (C3), including a body that differs only in a field the server overrides (NF-7): one key is one body. A create replay does not resolve the agent again (C4). A refusal made after the request was recorded is stored and replayed too; refusals made before (no open book, no ranked agent, a control refused) record nothing — Q5 |
| R-18 | §6: pause / resume on a draining book | Allowed: they change `drafting` only. A book's status only moves forward (pinned) |
| R-19 | §6: "no new admission or entry" | Admission refuses `book_not_active` (and `drafting_paused`, from `windDown`). The entry pass skips a draining book, and an entry's own transaction refuses a book that is not active, so a wind-down landing between the pass's read and the fill stops it. An accepted idea of a draining book times out at its start session's close |
| R-20 | §6: "wind-down completes at a close" | A wind-down completes at the close of a session whose close window was still open when it was requested (close + 120 minutes, 18:00 Eastern on a regular session; the engine's own close tick) and that leaves no open idea. A request at 16:05 is completed by that day's 16:25 close, and one on a Friday at 16:01 by Friday's close (fix-round NF-1). A caught-up session closes exactly as its on-time close would have (E12): a request made after a session's close window ended does not complete that session, so a later session's close does (review C2). The book keeps its cash in its treasury and stays readable to its owner (contract §11). The registry is rewritten from the close's own read with only this book removed, and the claim is closed only if it names this book |
| R-21 | §7, Q-G | The decision id of a delisting sale is now `{ideaId}__delisting_exit__{SYM}` (it was `__line_exit__`). The mode is off, so no record exists to migrate |
| R-22 | §7, C-9 | `exitTierOf` throws rather than return a fallback. `costTiersStored` stays on the endpoint row and the result (always true) |
| R-23 | §6, function count | BUILD_RULES sets no limit on functions, only the cron budget (§6). `vercel.json` sets none: it has one `functions` glob, for `includeFiles`. Vercel deploys every `.js` under `api/` that is not under an `_` path, and `.vercelignore` drops tests and `api/scripts`. By that count, the deployable function files go from 222 to 223 |

### 3.2 Questions for the founder

| # | Question | What is built meanwhile |
|---|---|---|
| Q1 (R-11) | Today the engine gives an early-close session the same three slots, earlier in the day. Your schedule (Amendment C §3) has two windows on an early close. Change it now, or with T1b's schedule as planned? | The engine's geometry, from `windows.js` alone |
| Q2 (R-14) | One refused oversized estimate marks the month exhausted, even with most of the $3 unspent, and then refuses every later call that month. Keep it strict, or refuse only that call? | Strict, as the prompt and contract §12 read |
| Q3 | A wound-down book whose last sale never finds a price stays `draining`, and on your four-book cap, until it does (T1a-2a's waiting sale; the founder tool is T5). Is that right until T5? | As described |
| Q4 | At `'allowlist'` mode, creating a book and admitting a fixture also need you on the cockpit's allowlist (`COCKPIT_ALLOWLIST_UIDS`); pause, resume and wind-down do not. Keep? | As described (mode.js's own rule) |
| Q5 (R-17) | A founder request refused for a reason that can change (a book already open, the cockpit list) answers the same refusal if the same key is sent again; a new key is a new request. A refusal made before anything is recorded (no open book, no ranked agent, a control refused) stores nothing, so the same key may act later. Keep both? | As described |
| Q6 (R-16) | The book is filed under your ranked agent's archetype, not a per-game loadout's; with two ranked agents the request must name one. Keep? | As described |
| Q7 | The draining close sweep counts a catch-up that closed a book as `skipped`, not `closed`. It is only a count; change it? | As described |
| Q8 (R-20, NF-1) | A wind-down requested after the market closed is completed by that day's close only if it came before the end of the engine's close window (18:00 Eastern; 15:00 on an early close). The alternative is the session's own end (16:00), under which a 16:05 request waits for the next session's close: over a weekend on a Friday, holding a cap slot. Which instant? | The close window's end: a caught-up session then closes exactly as its on-time close would have (E12) |

## 4. Tests

No model call, no Firestore write, no EODHD call (rule 3). The in-memory harness ran the unit rows and the local emulator ran the rules rows.

### 4.1 Where each section is tested

| Section | File (rows) | What the rows show |
|---|---|---|
| §1 access | `test/rules/practiceFieldIdeaBookOwnerRead.rules.mjs` (29) | • The owner gets and lists each of the eight store shapes.<br>• Denied every document and every list: another user, another idea-book owner (with book and claim), a quarterly player (with `userMeta`), a privileged token and an anonymous client.<br>• Nobody, the owner included, creates, updates, merges or deletes.<br>• Documents planted under a quarterly book are denied to its owner, listed or not, while its book, dailyRows, decisions, corporateActions and quarterSummaries read as before.<br>• A closed idea book stays readable to its owner.<br>• Nobody reads `spendOps` or `founderOps`.<br>• `practiceFieldBooks/*` and `practiceFieldCoverage/*` are denied to every client.<br>• The rules text carries the function and the five blocks |
| §2 indexes | `firestoreIndexes.test.js` (3) | The exemption, exactly; nothing queries `rationale`; no composite index for the draining query, neither field exempted, and the query is two equalities and a limit |
| §3 evidence | `evidence.test.js` (11) | • The admission packet's contents, sources and hash.<br>• Each mark's own source: entry window, observed close, unobserved close, a quote with no vendor time.<br>• A replay writes nothing; a planted packet aborts admission.<br>• The result packet carries every price on every ledger and the track.<br>• A carried endpoint mark keeps its time; a fresh untimed price borrows none (NF-2).<br>• Written once; a missing inception row is refused.<br>• A lone surrogate survives the round trip.<br>• Retention never reaches under `mandates/`, in behaviour and in source |
| §4 window ledger | `windowLedger.test.js` (19) | • The schedule: regular session, early close, the creation time against each slot's last fire (NF-4), non-sessions, and the cadence against `vercel.json`.<br>• Served and errored attempts: a served row; an errored attempt folded and then served; a served row never rewritten; the fold's arithmetic.<br>• The close's judgment: its summary and one alert per missed window, once; every window served; an errored window missed; a caught-up session; a book created mid-session and a closed book; a book created after a slot's last fire not told it missed the slot.<br>• Failures: committed alerts logged before a later throw; a sale kept when the entry pass throws; an entry kept when the sales pass throws (NF-5).<br>• Draining and paused books are still due |
| §5 spend | `spend.test.js` (15) | • $3 exactly, then one micro-dollar is refused; exhaustion is sticky.<br>• Totals live only on the book; settled and outstanding both count.<br>• Replay, conflict, and a replay two months on.<br>• Every retry counts; an unpriced call counts its estimate; an overrun exhausts; settlement is idempotent.<br>• The month rollover; settling across midnight and from an older month; a clock behind the month.<br>• No money-path importer |
| §6 founder | `founderControls.test.js` (23), `api/practice-field/founder.test.js` (9), `registryPresence.test.js` (10) | • Gate: no token; a non-founder; a founder at `'off'`; the allowlist read at call time; a body uid ignored.<br>• Each action and its replay; the ranked agent; the origin forced; another owner's or a quarterly book; pause, resume and wind_down each recorded once; C1, C3, C4; controls at `'allowlist'`.<br>• Wind-down: ideas running that settle and then close the book; a paused book valued and settled; a catch-up that closes the book; a session before the request closed active; a request after the session ended and before its close (16:05, a Friday at 16:01) completed by that close; the boundary at the close window's end (17:59:59.999 completes; 18:00 does not); a stale listing writes nothing.<br>• Registry: its two write sites; status only forward; atomic removal |
| §7 | `marks.test.js`, `exits.test.js`, `corporateActions.test.js`, `reconcile.statuses.test.js`, `results.test.js` | The 30/31-minute boundaries and both constants; the delisting origin, decision id and counts; the reconciliation's three kinds; the C-9 throw |
| C-1 | the draining rows listed in §2.5 | On the real wind-down |

### 4.2 The end-to-end pin

The one-book, three-idea run (`endToEnd.test.js`) is re-pinned:

| | SHA-256 | Bytes | Documents |
|---|---|---|---|
| T1a-2a (before) | `ed90ebd5…` | 267,350 | 120 |
| This build | **`bb742bb9181c76d5f81317d59702307e37e6155c6fd9c19a61f523647ea65a0f`** | 328,611 | 154 |

Leaf-compared, base against head: **34 documents added** (three admission packets, three result packets, 28 close rows of the window ledger), and **no leaf of any existing document added, removed or changed**. The build first pinned `21c7d608…`; the review fixes changed only the six packets. The admission packets' `marksSnapshot` became `lastClose` with per-position `markSource` (B1), and the result packets gained `track` (B13). The fix-round refuter reproduced that pin and compared the two dumps leaf by leaf. The second fix round left the pin unchanged.

The run's windows are driven directly (not through the eval pass), so its close rows record those windows as missed. Its admissions hold no position, so `evidence.test.js` covers each `markSource` kind.

### 4.3 The differentials (Amendment E §4)

| Check | Base `71bc6bde` | Head `82693acb` | Result |
|---|---|---|---|
| 17 quarterly scenarios (the T1a-1 scratch test, SHA-256 `204a2f32…`, LF worktrees on Linux) | `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43`, 1,118,594 bytes | the same hash and bytes | **BYTE-IDENTICAL**, also at `5b3609d8`, `71d0b1bb` and `b9cab98d` |
| Its control (scenario 18: an idea book in play, mode on) | `2553861a…`, 1,156,115 bytes | `e73dcda4…`, 1,163,013 bytes | Differs in scenario 18 only, so the harness sees a change when there is one |
| Astra's 40-case traced differential (her `astra-cron-trace.test.js`, unmodified, SHA-256 `9297cead…`, in her layout rebuilt in this session's scratchpad) | | | **40/40 raw-identical**: 20 at `'off'`, 20 at `'on'`, with one registry read per `'on'` fire on both sides. The evidence file's hash (`6c169f26…`) is unchanged from `5b3609d8` |
| Astra's 17-scenario differential at both modes (`astra-differential.test.js`, unmodified, `17e724ad…`) | | | **34/34 identical** (17 per mode); its 4,000-case `buildSetDefaultOptions` row and prompt byte-equality rows pass; 76/76 rows |

The base already has T1a-2a's registry fast path, so the traced cases are compared raw (every database operation in order), not through her classifier. Astra's harness ran at `5b3609d8`, `71d0b1bb`, `b9cab98d` and `82693acb`, with the same evidence bytes each time. The control ran at `b9cab98d` (`82693acb` adds only a test baseline entry).

### 4.4 Full suite, lint gate, build, rules suite (Linux, the code head)

All on WSL Ubuntu, in a private worktree of `~/pd-ci`, on Node 20.20.2, with the install matching the lockfile (`40382e64edb6`) and `TZ=UTC`. The suite ran alone under the lock.

| Check | Command | Result |
|---|---|---|
| Full suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit 0** · `Test Files  1507 passed \| 12 skipped (1519)` · `Tests  33915 passed \| 135 skipped (34050)` · 298.70 s · log SHA-256 `806c1354…` |
| Lint gate | `npm run lint:gate` | exit 0 (`--max-warnings 0`) |
| Production build | `npx vite build` | exit 0. The `dist/` of 113 files is **byte-identical** to the base's build (`dist` hash list `a0a5c84d…` on both). The four CSS warnings come from comments in existing `src` CSS; the base's build gives the same four |
| Rules suite | `npm run test:rules` (JDK 21, the emulator) | **exit 0** · `Test Files  43 passed (43)` · `Tests  813 passed (813)` · log SHA-256 `d5a20764…`. The new file's 29 rows are among them |
| The money-path and import scans (Linux only: they fail on Windows on `main` too) | `npx vitest run api/_utils/mandateMoneyRounding.scan.test.js api/_utils/mandateRationale.imports.test.js api/_utils/practiceField/windowLedger.test.js api/_utils/compositionProtectedStores.scan.test.js` | exit 0, 4 files, 62 tests |

A full run at `b9cab98d` failed exactly one row: the money-path rounding scan, on the `Math.floor` the NF-4 fix added to `windows.js`. That site is calendar arithmetic, so it is baselined with a reviewed note in `82693acb`, as the scan directs, and the run above is at that commit. An earlier full run, at `5b3609d8` before the review, gave exit 0: `Test Files  1506 passed | 12 skipped (1518)`, `Tests  33890 passed | 135 skipped (34025)`.

On Windows, the 22 Practice Field, endpoint, cron and scan files pass (609 rows). `mandateMoneyRounding.scan` and `mandateRationale.imports` fail there on `main` too, on path separators (T1a-2a §7.3 item 7), and pass on Linux. One T1a-1 row, `admission.test.js` "the slot cap … for EACH archetype", ran past its 5-second limit under load during this session (5.5–6.7 s) and passes alone; this build leaves it untouched.

## 5. The review (BUILD_RULES §2)

The diff crosses the threshold. Three lenses reviewed `5b3609d8`, each on its own read-only `git archive` snapshot with `node_modules` linked, told to find defects and fix nothing. Every finding went to a refuter on a fresh snapshot, told to break it. The fix round went to its own refuter on a snapshot of `71d0b1bb`. The mutation battery ran last, on its own tree. No reviewer or refuter wrote to the repository.

### 5.1 Lens A — access and rules

| # | Finding (lens) | Refuter | Disposition |
|---|---|---|---|
| A1 | No denial row has a second idea-book owner (should-fix, test) | PARTLY. The lens's exact mutant is killed by `registryPresence`'s rules-text check, but a mutant granting any quarterly player survives, so the denial rows need a user with full state | Fixed: another idea-book owner (book + claim) and a quarterly player (with `userMeta`) in every denial row, plus a positive control |
| A2 | Planted rows and evidence under a quarterly book are never listed (note) | CONFIRMED | Fixed: both listed |
| A3 | No row reads a closed idea book (note) | CONFIRMED, and stronger: a shadowing function inside `ideas` evades the text pin | Fixed: the owner reads every store of a closed book |
| A4 | The `rationale` override is unpinned (note) | CONFIRMED | Fixed: `firestoreIndexes.test.js` |
| A5 | Six defence-in-depth checks are unpinned; a test title claims a case it never runs (note) | CONFIRMED with corrections (one check is not equivalent: a claim naming the caller's quarterly book) | The title's case is added; the rest are stated as defence in depth |
| A6 | At `'allowlist'`, controls work without the cockpit list (note) | Not a defect | Pinned; Q4 |
| A7 | The allowlist parser is a copy (note) | Not a defect | A parity row checks it against `api/mandate/create.js` |
| A8 | The parent is read before the auth test (note) | PARTLY (the order is confirmed; no read was observed) | Fixed: auth first |

### 5.2 Lens B — records

| # | Finding (lens) | Refuter | Disposition |
|---|---|---|---|
| B1 | The admission packet's snapshot key is not the marks' source (**must-fix**) | CONFIRMED, must-fix stands; the quality half too (R-B1c: a quote with no vendor time) | Fixed: a per-position `markSource` (R-5) |
| B2 | A carried endpoint mark is stored with no time (should-fix) | CONFIRMED | Fixed: `carriedFromVendorTimeIso`, and the completeness check requires it. Narrowed by NF-2 |
| B3 | A committed catch-up session's alerts are lost if a later one throws (should-fix) | CONFIRMED (borderline) | Fixed: logged before the throw |
| B4 | A pass that throws after a sale filled loses the sale from the window's row (should-fix) | CONFIRMED | Fixed: each pass is caught on its own |
| B5 | A clock behind the stored month wipes both months (should-fix) | CONFIRMED (no caller yet) | Fixed: refused, no rollback |
| B6 | The ops map grows on the book document (should-fix) | PARTLY: real, but far from the size limit at the planned cadence | Fixed: one document per call (`spendOps`) |
| B7 | An op older than last month re-reserves (note) | CONFIRMED | Fixed by B6 |
| B8 | A sub-micro-dollar estimate reserves nothing (note) | CONFIRMED | Fixed: refused |
| B9 | Exhaustion is sticky with the bound unspent (note) | REFUTED as a defect (the prompt's letter) | Q2 |
| B10 | An instant without an offset is read in the host's zone (note) | CONFIRMED | Fixed: refused |
| B11 | An op id like `__call__` passes, but Firestore rejects it (note) | CONFIRMED on the emulator | Fixed: refused |
| B12 | A lone surrogate breaks the hash after a round trip (note) | CONFIRMED on the emulator; Firestore rejects a short one outright | The packet is fixed (`jsonPure`); the admission side is found outside the task (§8) |
| B13 | The packet does not copy what the decline and exposure were computed from (note) | PARTLY (not in the prompt's list) | The `track` is copied |
| B14 | An early close has three slots (note) | REFUTED as a defect | Q1 |
| B15 | Retries need their own op ids (note) | REFUTED as a defect | Stated (R-15) |
| minor | A book created at 10:05 is left out of the close's served list | CONFIRMED (harmless) | Fixed: due while a fire is left in the slot (R-10, with NF-4) |

### 5.3 Lens C — founder controls and wind-down

| # | Finding (lens) | Refuter | Disposition |
|---|---|---|---|
| C1 | A replayed key lands on a newer book (**must-fix**) | PARTLY: the harmful half is confirmed; should-fix (dark, founder-only, irreversible) | Fixed: per-owner request records (R-17) |
| C2 | A catch-up completes a wind-down at a session before the request (should-fix) | CONFIRMED | Fixed (R-20), then narrowed by NF-1 |
| C3 | One key across action families takes effect (should-fix) | PARTLY (a note) | Fixed: `request_key_conflict` for any reuse |
| C4 | A create replay resolves the agent again (should-fix, low) | CONFIRMED | Fixed: answered from the record |
| C5 | No row covers a catch-up that closes the book (test gap) | CONFIRMED (four survivors) | Rows added |
| C6 | "Status only forward" is unpinned (test gap) | CONFIRMED | Row added |
| N1 | A stale fire can stamp a closed book (note) | CONFIRMED (a different interleaving) | Fixed: the stamp is written only when the window served the book. The engine's lease still writes `lease` on it |
| N2 | The draining sweep counts a closing catch-up as skipped (note) | CONFIRMED | Q7 |
| N3 | Two `claim.bookId === bookRef.id` guards are unreachable (note) | CONFIRMED | Kept as defence in depth |
| N4 | A last sale with no price keeps a draining book open (note) | T1a-2a's design | Q3 |
| N5 | Q-G changes the decision id (note) | CONFIRMED | R-21 |
| N6 | The archetype comes from the ranked record, not a loadout (note) | REFUTED as a defect | Q6 |

### 5.4 The fix round's refuter

**How it checked.** A refuter on a fresh snapshot of `71d0b1bb`, given the fix-round diff, was told to break each fix:
- It re-ran the lenses' probes on the new code.
- It patched a copy of the fake to refuse a read after a write and any `undefined`; every build row still passed.
- It cut 37 mutants.
- It ran the rules suite five times on the emulator, one run at a time.
- It reproduced the end-to-end pin from before the fixes and compared the two dumps leaf by leaf (only the six packets differ).

**Verdicts.**

| Verdict | Findings |
|---|---|
| FIXED | C3, C4, C5, C6, B1, B3, B5–B8, B10–B13, A1–A4, A8, the 10:05 point |
| FIXED for caught-up sessions | C2 |
| PARTLY | C1, N1, B2, B4, A5 |

Its new findings:

| # | New finding | Severity | Disposition |
|---|---|---|---|
| NF-1 | The C2 cutoff (the session's end) also stopped a LIVE close. A wind-down requested at 16:05 was not completed by that day's 16:25 close, and a Friday 16:01 request held a cap slot over the weekend. The `<` boundary was pinned only by source text | should-fix (the refuter: needs a ruling) | Fixed by reading E12 to the letter (R-20). The cutoff is the end of the session's close window (18:00 Eastern; 15:00 on an early close), the latest moment its on-time close can run. So a caught-up session still closes as its on-time close would have (C2's rows unchanged), and a live close after a 16:05 request completes the wind-down. Rows: 16:05, a Friday at 16:01, and 17:59:59.999 caught up; C2's 18:00 row pins `<` in behaviour. The choice of instant is asked as Q8 |
| NF-2 | A fresh endpoint price with no vendor time (`receipt_time_fallback`) was given the previous quote's time as `carriedFromVendorTimeIso`. The packet is create-once, so the wrong pairing could never be corrected | should-fix | Fixed. Only the ledger's own last mark (`carried_forward` or `unobserved`, no vendor time) names a carried time. The completeness check accepts a fresh price with no time, and refuses one paired with a borrowed time |
| NF-3 | A create whose engine call committed but whose done-record write failed, replayed after the book closed, stores `409 op_id_conflict` | note (low) | Not fixed: it needs a failed write followed by a full wind-down before the replay. The stored answer is the engine's own. Stated |
| NF-4 | A book created after a slot's last fire (10:16–10:29, 13:01–13:14, 15:46–15:59) was told it missed that slot | note | Fixed: a slot is due only if an evaluation fire is left in it (R-10). The cadence is pinned against `vercel.json` |
| NF-5 | The sales pass's own catch was unpinned. Also, a window-ledger write that fails after a sale lets the slot's next fire record the window as served with no fill | note | A row now pins the catch. The second half is stated: the sale's own decision record stands, and the ledger row is written after the sale's transaction |
| NF-6 | Refusals made before the request is recorded store nothing, so the same key may act later; engine refusals are stored | note | Q5, restated |
| NF-7 | The fingerprint is of the raw body. A replay that differs only in the `origin` the server overrides, or that names the agent the first request left implicit, is `request_key_conflict` | note | Stated (R-17): one key is one body |
| NF-8 | A reservation made with a clock in a later month makes the true month's reservations refuse until that month arrives. The fake keeps only the second of two reservations in one transaction (real Firestore refuses the second read). `planSettle` can go negative from a state nothing produces | note | Stated. T1b reserves once per transaction (R-14; noted in `spend.js`) |
| NF-9 | The rules comment still named `controlOps`; the end-to-end pin's comment told only the build's re-pin | note | Fixed: both comments |
| outside | Under the strict fake, the isolation suite's batch-submit rows write `envelope.quarterKey: undefined` (`mandateBatchTransport.js:208`) | — | §8 |

**Residuals it named, kept and stated:**
- **N1:** a stale fire still takes and releases the engine's lease on a closed book. The stamp is fixed.
- **A5:** the agent owner filter and the agent query are each equivalent alone (killed together). The claim check in `applyControl` is a tautology, because the book id comes from the claim.
- **B1:** a carried mark names no snapshot key (R-5), and the `observed === true` check is redundant (an equivalent mutant).

**How the second round of fixes was checked.** The fixes for NF-1, NF-2, NF-4, NF-5 and NF-9 (`b9cab98d`, with the rounding-scan baseline in `82693acb`) did not go to a further independent refuter. They were checked by:
- their own new rows (§4.1);
- seven mutants cut by the author (R22, R22b, R23, R23b, R24, R24b, R25), each killed (§5.5);
- the full suite, both differentials and the dist comparison, all at the code head.

### 5.5 The mutation battery

Each mutant re-breaks one rule in a copy of the code head (a `git archive` tree of `82693acb`, never the working tree) and runs the test files named for it. It is judged by the exit code **and** the JSON report, so a crashed worker cannot read as a kill.
- **Killed:** at least one row fails.
- **Survived:** every row passes.
- **Broken:** an anchor not found exactly once, or a file that does not load. Reported, never counted as a kill.

The runner stops if the un-mutated baseline is not green, restores every file after each mutant and checks the restore by hash.

| Group | Defined | Ran | Killed | Survived | Broken |
|---|---|---|---|---|---|
| M — the prompt's fifteen | 22 | 22 | 22 | 0 | 0 |
| X — this build's other rules | 21 | 21 | 21 | 0 | 0 |
| R — the review's fixes and the fix-round refuter's | 28 | 28 | 28 | 0 | 0 |
| **All** | **71** | **71** | **71** | **0** | **0** |

| Id | Re-breaks | File | Test files run | Verdict (rows failed) |
|---|---|---|---|---|
| M01a | the packet written twice (result): create-once dropped | `close.js` | `evidence.test.js` | KILLED (1/11) |
| M01b | the packet written twice (admission): create-once dropped | `admission.js` | `evidence.test.js` | KILLED (1/11) |
| M02 | a packet missing a ledger's endpoint mark (SPY's) | `evidence.js` | `evidence.test.js`, `endToEnd.test.js` | KILLED (4/14) |
| M03 | retention reaching under a book | `api/_utils/mandateClosePass.js` | `evidence.test.js` | KILLED (2/11) |
| M04 | a window recorded as served after an error | `windowLedger.js` | `windowLedger.test.js` | KILLED (5/19) |
| M05a | a missed window not reported (no alert) | `windowLedger.js` | `windowLedger.test.js` | KILLED (4/19) |
| M05b | a missed window not reported (an errored attempt counts as served) | `windowLedger.js` | `windowLedger.test.js` | KILLED (2/19) |
| M06a | spend allowed past $3 | `spend.js` | `spend.test.js` | KILLED (3/15) |
| M06b | exactly $3 refused (the boundary) | `spend.js` | `spend.test.js` | KILLED (3/15) |
| M07 | an unpriced call not counted | `spend.js` | `spend.test.js` | KILLED (3/15) |
| M08 | the month not rolling | `spend.js` | `spend.test.js` | KILLED (3/15) |
| M09 | a founder action at 'off' | `founderControls.js` | `founderControls.test.js`, `founder.test.js` | KILLED (3/32) |
| M10 | a non-founder allowed | `founderControls.js` | `founderControls.test.js`, `founder.test.js` | KILLED (4/32) |
| M11 | a body uid honoured | `api/practice-field/founder.js` | `founder.test.js` | KILLED (1/9) |
| M12 | a wind-down closing a book with an open idea | `close.js` | `registryPresence.test.js`, `founderControls.test.js`, `catchUp.test.js` | KILLED (3/48) |
| M13 | the registry entry removed while draining | `close.js` | `registryPresence.test.js` | KILLED (1/10) |
| M14a | the 30-minute constant reverted to 20 | `constants.js` | `marks.test.js`, `exits.test.js` | KILLED (4/66) |
| M14b | one of the two age tests left on 20 minutes (quotePastMaxAge) | `marks.js` | `marks.test.js`, `exits.test.js` | KILLED (1/66) |
| M14c | one of the two age tests left on 20 minutes (eligibleMark) | `marks.js` | `marks.test.js`, `exits.test.js` | KILLED (3/66) |
| M15a | the delisting origin dropped (the sale says line_exit) | `exits.js` | `corporateActions.test.js` | KILLED (1/119) |
| M15b | reconciliation does not accept the third origin | `constants.js` | `reconcile.statuses.test.js`, `corporateActions.test.js` | KILLED (4/129) |
| M15c | the result's delisting-exit count moved (counted by the old kind) | `settlement.js` | `corporateActions.test.js` | KILLED (1/119) |
| X01 | C-9: the widest-tier fallback restored | `settlement.js` | `results.test.js` | KILLED (1/18) |
| X02 | an entry in a book that is not active (the in-transaction guard) | `entry.js` | `entry.test.js` | KILLED (1/44) |
| X03 | wind_down leaves the claim's status behind | `founderControls.js` | `founderControls.test.js` | KILLED (1/23) |
| X04 | the owner's claim not closed at completion | `close.js` | `registryPresence.test.js`, `founderControls.test.js`, `catchUp.test.js` | KILLED (6/48) |
| X05 | the closed book left on the registry | `close.js` | `registryPresence.test.js`, `founderControls.test.js`, `catchUp.test.js` | KILLED (5/48) |
| X06 | a replayed control request re-applied (no stored op) | `founderControls.js` | `founderControls.test.js` | KILLED (4/23) |
| X07 | admit_fixture keeps the body's origin | `founderControls.js` | `founderControls.test.js` | KILLED (1/23) |
| X08 | create_book files under a casual clone | `founderControls.js` | `founderControls.test.js` | KILLED (17/23) |
| X09 | a retry of a served window rewrites its row | `windowLedger.js` | `windowLedger.test.js` | KILLED (2/19) |
| X10 | a window row says only the last attempt's fills | `windowLedger.js` | `windowLedger.test.js` | KILLED (1/19) |
| X11 | the close's window row overwritable | `close.js` | `registryPresence.test.js`, `windowLedger.test.js` | KILLED (1/29) |
| X12 | a window that opened before the book existed counted as due | `windows.js` | `windowLedger.test.js` | KILLED (3/19) |
| X13 | the pass records no window row | `sweep.js` | `windowLedger.test.js` | KILLED (10/19) |
| X14 | the result packet drops the comparison's entry fills | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| X15 | the result packet drops the corporate-action receipts | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| X16 | the result packet drops each line breach's close | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| X17 | a tampered packet reads as whole | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| X18 | no admission packet | `admission.js` | `evidence.test.js`, `founderControls.test.js` | KILLED (6/34) |
| X19 | a replayed reservation counted twice | `spend.js` | `spend.test.js` | KILLED (1/15) |
| X20 | an exhausted month lets a smaller call through | `spend.js` | `spend.test.js` | KILLED (1/15) |
| X21 | the close does not return its missed-window alerts | `close.js` | `windowLedger.test.js` | KILLED (4/19) |
| R01 | C3: one key asking for something else is answered as a replay | `founderControls.js` | `founderControls.test.js` | KILLED (1/23) |
| R02 | C1: a done request re-run against the book the claim names now | `founderControls.js` | `founderControls.test.js` | KILLED (5/23) |
| R03 | C2: a session that ended before the wind-down request completes it | `close.js` | `founderControls.test.js`, `registryPresence.test.js` | KILLED (2/33) |
| R04 | N1: a book the window did not serve is stamped | `sweep.js` | `founderControls.test.js` | KILLED (1/23) |
| R06 | B1: a mark bought since the last close named as the close's | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R06b | B1 (R-B1c): a close mark with no vendor time claims the recorded one | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R07 | B2: a carried endpoint mark loses its last observation time | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R08 | B13: the result packet without the running record | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R09 | B3: a committed session's alerts lost to a later throw | `close.js` | `windowLedger.test.js` | KILLED (1/19) |
| R10 | B4: an entry pass that throws loses the window's sale | `sweep.js` | `windowLedger.test.js` | KILLED (1/19) |
| R11 | B5: a clock behind the stored month starts a new month | `spend.js` | `spend.test.js` | KILLED (1/15) |
| R12 | B6: no per-call record (a replay double-counts) | `spend.js` | `spend.test.js` | KILLED (9/15) |
| R13 | B8: an estimate that rounds to nothing reserves | `spend.js` | `spend.test.js` | KILLED (1/15) |
| R14 | B10: an instant without its offset accepted | `spend.js` | `spend.test.js` | KILLED (1/15) |
| R15 | B11: an op id Firestore reserves accepted | `spend.js` | `spend.test.js` | KILLED (1/15) |
| R16 | B12: a lone surrogate hashed as given | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R17 | C5: a window whose catch-up closed the book carries on | `sweep.js` | `founderControls.test.js` | KILLED (2/23) |
| R18 | C6: resume reopens a wound-down book | `founderControls.js` | `registryPresence.test.js`, `founderControls.test.js` | KILLED (1/33) |
| R19 | a slot still open at creation not owed (due by its opening) | `windows.js` | `windowLedger.test.js` | KILLED (1/19) |
| R20 | A4: the rationale exemption misspelt in the index file | `firestore.indexes.json` | `firestoreIndexes.test.js` | KILLED (1/3) |
| R21 | C1: a control request keyed to the current book (a later book replays nothing) | `founderControls.js` | `founderControls.test.js` | KILLED (3/23) |
| R22 | NF-1: a wind-down requested after the session ended, before its close window ended, not completed by that close | `windows.js` | `founderControls.test.js` | KILLED (1/23) |
| R22b | NF-1 / C2: a request at the close window's end exactly completes that session | `close.js` | `founderControls.test.js` | KILLED (1/23) |
| R23 | NF-2: a fresh price with no vendor time paired with an earlier quote's time | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R23b | NF-2: the completeness check accepts a fresh untimed price paired with a borrowed time | `evidence.js` | `evidence.test.js` | KILLED (1/11) |
| R24 | NF-4: a slot with no fire left after creation counted as due | `windows.js` | `windowLedger.test.js` | KILLED (2/19) |
| R24b | NF-4: the fire cadence windows.js counts on differs from the cron | `windows.js` | `windowLedger.test.js` | KILLED (2/19) |
| R25 | NF-5: a sales pass that throws takes the entry pass with it | `sweep.js` | `windowLedger.test.js` | KILLED (1/19) |

The prompt's fifteen, by mutant:
1. the packet written twice: M01a (result), M01b (admission);
2. a packet missing a ledger's endpoint mark: M02;
3. retention reaching under a book: M03;
4. a window served after an error: M04;
5. a missed window not reported: M05a (no alert), M05b (an attempt counted as served);
6. spend past $3: M06a, with M06b for the exact boundary;
7. an unpriced call not counted: M07;
8. the month not rolling: M08;
9. a founder action at `'off'`: M09;
10. a non-founder allowed: M10;
11. a body uid honoured: M11;
12. a wind-down closing a book with an open idea: M12;
13. the registry entry removed while draining: M13;
14. the 30-minute constant reverted: M14a, with each age test alone in M14b and M14c;
15. the delisting origin dropped: M15a, with the reconciliation and the count in M15b and M15c.

X01–X21 re-break this build's other rules; R01–R25 re-break the review's fixes and the fix-round refuter's.

Three earlier batteries ran before this one:

| At | Defined | Outcome |
|---|---|---|
| `5b3609d8` | 43 | 42 killed. X10 survived: a fold row whose first attempt filled nothing. That row now fills in both attempts |
| `15807058` | 65 | Two anchors were re-cut. R04 and R05 survived together: two checks that each stopped the same write. The redundant check was removed and R05 dropped as equivalent, so R04 is killed alone |
| `71d0b1bb` | 64 | 64 killed. Since then, four anchors were re-cut on moved lines (X12, R03, R07, R19) and seven mutants added for the fix-round refuter's findings (R22, R22b, R23, R23b, R24, R24b, R25) |

**Rules mutants.** These ran through the emulator against copies of the rules file, read through the suite's own `COMPOSITION_RULES_TEXT_PATH` knob, with no edit to the tree. Each ran `practiceFieldIdeaBookOwnerRead.rules.mjs` alone at `82693acb`. The unmutated copy (SHA-256 `902620d0…`, the head's rules file) passes 29/29. **11 defined, 11 ran, 11 killed, 0 survived.** Every mutant fails at least one behavioural row, not only the rules-text pin:

| Id | Re-breaks | Rows failed |
|---|---|---|
| RM01 | the `kind == 'idea_book'` check dropped (a quarterly owner reads planted documents) | 2/29: the planted-quarterly row, the text pin |
| RM02 | any signed-in user reads every idea book's stores | 14/29 |
| RM03 | the owner may write an evidence packet | 2/29: the owner-cannot-write row, the text pin |
| RM04 | the window ledger readable by anyone | 5/29 |
| RM05 | the owner cannot read their evidence | 5/29 |
| RM06 | `spendOps` readable by the owner | 2/29: the spendOps/founderOps row, the text pin |
| RM07 | the epochs readable by any signed-in user | 4/29 |
| RM08 | the owner may write an idea's rows | 2/29: the owner-cannot-write row, the text pin |
| RM09 | the owner reads their claim and its `founderOps` | 2/29: the spendOps/founderOps row, the outside-stores row |
| RM10 | a closed idea book hidden from its owner | 2/29: the closed-book row, the text pin |
| RM11 | the owner cannot read the idea itself | 4/29 |

### 5.6 Isolation of the review, disclosed

Reviewers and refuters worked on `git archive` snapshots under the session's scratch folder, with `node_modules` linked; their probes stayed there.
- Refuter A's first emulator start hit a port race and left an orphaned Java process pointing at its own snapshot's rules file. It stopped only that process, after checking its command line, and reran clean.
- Lens B found another session's emulator on the ports at one point and waited.
- The fix-round refuter hit a port race, retried, and killed nothing.

No reviewer or refuter wrote to the repository or ran a writing git command.

## 6. New stores and fields, for the founder's sign-off

Every write is server-only and is reached only while `PRACTICE_FIELD_MODE` is not `'off'`.

| Document | What | Written by | Client access |
|---|---|---|---|
| `mandates/{bookId}/ideas/{ideaId}/evidence/admission` | **New.** The admission packet: the contract, the sources, `measuredAgainst` (revision, equity, cash, treasury, positions with `markSource`, `lastClose`, other open ideas), limits, times, `contentHash`, `hashAlgorithm` | `admitIdea`, create-once | owner read |
| `mandates/{bookId}/ideas/{ideaId}/evidence/result` | **New.** The result packet: entry fills, lines and breaches, sales before the endpoint, corporate actions applied, the endpoint (snapshot key, every mark with its quality and time; a carried mark with `carriedFromVendorTimeIso`), `track`, the result, the hash | the endpoint close, create-once | owner read |
| `mandates/{bookId}/windows/{date}_{slot}` | **New.** An intraday window's row: served, served at, attempts and their log (the last 12), errors, what code did, `modelCalled: false`, `triggers: []`, `outcome` | the eval pass, folded until served | owner read |
| `mandates/{bookId}/windows/{date}_close` | **New.** The close's row: observed, snapshot key, what code did, `session: { expected, served, missing, notServedButAttempted }` | the close, create-once | owner read |
| `mandates/{bookId}/spendOps/{opId}` | **New.** One model call's reservation: month, purpose, estimate, state, charge | `reserveSpend` / `settleSpend` (no caller yet) | none |
| `practiceFieldBooks/{uid}/founderOps/{requestKey}` | **New.** A founder request: action, fingerprint, target, state, response | the founder endpoint | none |
| `mandates/{bookId}` | New fields: `spend` (the month's totals and last month's; absent until a first reservation) and `windDown` (`requestedAt`, `requestKey`, `requestedBy`; on completion `completedAt`, `completedSession`). `status` may now become `draining` and `closed`, with `closedAt` and `closedOn` | the founder endpoint; the close | owner read (as before) |
| `practiceFieldBooks/{uid}` | `status: 'draining'` on wind-down; on completion `bookId: null`, `status: 'closed'`, `closedBookId`, `closedAt` | the founder endpoint; the close | none |
| `practiceFieldBooks/_registry` | An entry is now removed, only by the close that completes that book's wind-down | the close | none |
| `mandates/{bookId}/decisions/{ideaId}__delisting_exit__{SYM}` | The delisting sale's decision record and receipt now carry `delisting_exit` (the id was `…__line_exit__…`) | the sales | owner read (as before) |
| `firestore.indexes.json` | `decisions.rationale` is exempt from single-field indexing | — | — |

## 7. Founder steps after merge

1. **Rules.** From the repository root at the merged `main`, run `firebase deploy --only firestore:rules --project tradeseven` (the `deploy:rules` script, plus the project flag). It adds the five owner-read blocks and changes no existing rule.
2. **Index.** Run `firebase deploy --only firestore:indexes --project tradeseven`. **Never pass `--force`.** Production holds composite indexes and a field override that are not in the file (the Nov 15 Shared Research deploy recorded them); the CLI lists them and leaves them alone. The `rationale` exemption is a field-override change, which Firestore applies in the background over a few minutes. No composite index is added (R-4).
3. **Environment.** The endpoint reads **`MANDATE_FOUNDER_UIDS`** (comma-separated uids; the same variable as `/api/mandate/create`) at call time. At `'allowlist'` mode, creating a book and admitting a fixture also read **`COCKPIT_ALLOWLIST_UIDS`** (mode.js). Nothing works while `PRACTICE_FIELD_MODE` is `'off'`; moving it is a separate, deliberate PR.
4. **Calling the endpoint** (once the mode allows): `POST /api/practice-field/founder` with a Firebase ID token and `{ action, requestKey, … }`. The actions are `create_book` (`agentId` optional), `admit_fixture` (`contract`), `pause`, `resume` and `wind_down`. Use a new `requestKey` for each new request.

## 8. Found outside the task (not fixed)

1. **Admission accepts a thesis containing a broken character** (`contract.js:80`, T1a-1). A lone UTF-16 surrogate passes the length check. Firestore stores a long one as U+FFFD and rejects a short one outright, which would fail admission's transaction (refuter B, on the emulator). This build handles the packet side (`jsonPure`); refusing such a thesis is a change to admission's validation.
2. **A close quote with no vendor time keeps the earlier quote's time on the position** (`ledger.js:878`, `withCloseMarks`, T1a-1). The close's price is paired with the earlier quote's time on `lastMarkAsOf`. Both packets now avoid repeating the pairing: the admission packet names the close's quality and claims no vendor time (R-5), and the result packet borrows none (NF-2). The position field itself is unchanged.
3. **The in-memory store allows a transaction read after a write**, which real Firestore refuses. Lens B and the fix-round refuter each patched a copy of the fake to refuse it and ran the Practice Field files: no violation. The fake itself is unchanged. It also keeps only the last of two updates to one document in a transaction (noted in `spend.js` for T1b).
4. **The isolation suite's batch-submit rows write `envelope.quarterKey: undefined`** at `mandateBatchTransport.js:208` (the fix-round refuter's strict fake; an engine path this build does not touch). Real Firestore rejects `undefined` unless `ignoreUndefinedProperties` is set.
5. **`admission.test.js` "the slot cap … for EACH archetype"** (T1a-1) runs 5.5–6.7 s under load against a 5-second limit. It can fail a loaded run, or read as a false kill in a battery.
6. `requireAuth` verifies tokens without `checkRevoked`, as `api/mandate/create.js` does. Pre-existing.

---

## Fix round, 16 Nov 2026 — Astra T2B-01 to T2B-04

**Claude Code (Opus 5.5), 16 Nov 2026.** Astra reviewed `421a445d` (`docs/audits/20261116_ASTRA_REVIEW_T1A2B1.md`, committed byte-identical, SHA-256 `6a7b335f…`). She found no access breach, no quarterly change and no money change. Her four findings were about records that were incomplete or wrong, and about the spend bound. This round fixes all four, applies the founder's ruling on Q2, puts the fixes through an independent review lens and a refuter, fixes what they confirmed, and stops.

**Branch and heads.**
- `git fetch origin` ran first. The branch head was `421a445d553b6648f976abb31e558d8ee4236f75`, as expected.
- `origin/main` was `71bc6bde7c0553cdb16e5c5f3752d248968967c3`, unchanged since the build, so nothing was merged.
- The work was done in a fresh worktree whose branch was set to `421a445d`, and pushed to `claude/practice-field-t1a2b1-access-records` (a fast-forward, no force).
- Code head: `29bf46a5647b0c5e2e96c1bd0dd6cd290fadf3bb`. This report follows in a docs-only commit.

**Flag and fences.** `PRACTICE_FIELD_MODE` is still `'off'`. No fenced file, flag value, pin or `vercel.json` changed, and the new code calls no fenced function. This session made no model call, no Firestore write and no EODHD call.

| Question | Answer |
|---|---|
| T2B-01: can a carried price borrow another quote's time? | No. Every holding records where its price came from (`lastMarkProvenance`), and a carry copies that record unchanged. Astra's sequence, on all three ledgers, observed and unobserved, names 30 Nov's snapshot and no time. The packet also checks each carried price's source against its own copy of that close |
| T2B-02: can a due session's windows disappear? | No. The window ledger has its own cursor from the book's creation. Her empty book's 16 Nov windows are reported missing, once |
| T2B-03: does the packet hold every price the result rests on? | Yes: every close from entry to endpoint, on every ledger. The decline and exposure are recomputed from the packet alone. The largest packet is about 233 KiB, so it stays one document |
| T2B-04 and Q2: can spend pass $3? | No, within what the price table prices. A call reserves its maximum, and anything the table cannot price is refused. A refusal never locks the month; an exhausted month refuses every call |
| Did any money figure change? | No. Compared leaf by leaf, the end-to-end run only gains new and provenance fields, plus one document |
| Tests | Full Linux suite exit 0, `Test Files  1507 passed | 12 skipped (1519)`, `Tests  33945 passed | 135 skipped (34080)`; rules suite exit 0, 813/813; lint gate exit 0; `vite build` exit 0, `dist/` byte-identical to `main` |
| Differentials against `main` | 17/17 per mode identical; 40/40 raw-identical |
| Review | One lens, with a refuter on every finding. 14 findings: one must-fix (S-1) and three should-fix (S-2, P-1, and O-2's builder row), all fixed; the rest notes and test gaps, mostly hardened anyway; one refuted (O-4) |
| Mutation battery | 34 defined, 34 ran, 34 killed, 0 survived, 0 broken at the final code head (the prompt's eight among them); 21 of 21 killed at the four fixes before the review |

### F.1 In plain terms

**1. A price now says where it came from, however long it is carried (T2B-01).** Every holding records, beside its last price, where that price came from: a fill or a close, the session, the snapshot, its quality and the vendor's time. The time is left empty when the vendor gave none. When a later close cannot price the holding, the old price is carried forward and its record is carried with it, unchanged. The sealed result now copies that record.

In Astra's case, a price taken on 30 November with no vendor time was carried to the 1 December endpoint and labelled with 27 November's time. It is now labelled as 30 November's, with no time. The admission packet no longer seals the old time beside such a price either. The time field the gap screen uses is unchanged.

**2. Every session the book was due is accounted for, from the day it was created (T2B-02).** The window ledger used to follow the valuation, which starts at the first session with money in it. So an empty book's first days, and the days before its first fill, left no record of their missed windows.

The ledger now keeps its own cursor from the book's creation. At each close and catch-up, every earlier session it has not covered gets its own close row, before the valuation's own session. That row is marked `valued: false` and raises one alert per missed window. No valuation row is written for those sessions. The valuation's own cursor, fills, corporate actions and catch-up are unchanged. One guard is added: no fill may be dated in a session the ledger has already written up. Today nothing reaches that guard.

**3. The result's evidence holds every close its numbers came from (T2B-03).** The result's largest decline and average exposure come from every close of the idea, but the sealed packet copied only the running totals. It now copies each close from entry to endpoint, on every ledger: values, cash, each holding's quantity and price, and where each price came from.

A function recomputes the decline and exposure from the packet alone. It names any close that is missing, out of order or incomplete, and any result its closes do not give. A changed price also breaks the packet's hash. The largest possible packet is about 233 KiB, under a quarter of Firestore's 1 MiB limit, so it stays one document. That shape is a 60-session idea with four names, an eight-name basket and SPY.

**4. The $3 limit now holds at the bill, not at a guess (T2B-04 and Q2).** A model call used to reserve an estimate, and then any larger bill was accepted. Now a call must state its model, the most tokens it can send and receive, and whether it uses a cache or a server tool. It then reserves the most that call can possibly cost under the price table.
- **Refused calls:** a model with no price, a one-hour cache, or a server tool such as web search. The price table cannot price the last two.
- **A call that might not fit** in the month's remaining room is refused. As the founder ruled on Q2, a refusal does not lock the month.
- **After the call,** the real cost is recorded and the unused part of the reservation is freed. A bill above the reservation should be impossible; if one happens it is recorded as billed, flagged and logged.
- **"Exhausted"** now means the month has less room left than the smallest call T1b will make. An exhausted month runs no call. That figure is a placeholder T1b sets: `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD`, $0.05 for now.

### F.2 Each fix by `file:line` (at the code head `29bf46a5`)

The round has five code commits on `421a445d`: one per finding and one for the review. Together they touch 18 files, +1,473 / −280. Twelve of those files are product or config (+732 / −175); the rest are tests.

**T2B-01 — `6c498970`.**

| Where | What |
|---|---|
| `api/_utils/practiceField/ledger.js:879`, `:882` | `MARK_PROVENANCE_SOURCE` (`fill`, `close`) and `markProvenance`: `{ source, symbol, session, snapshotKey, quality, vendorTimeIso }`, every field present, unknowns null. The header above them states the rule and why `lastMarkAsOf` is not provenance |
| `ledger.js:901`, `:913` | `withCloseMarks(ledger, valuation, { date, snapshotKey })`: a FRESH mark takes this close's provenance (its quality, and its vendor time, which is null when the quote had none); a CARRIED mark keeps the one it had. `lastMarkAsOf` is written exactly as before |
| `fills.js:142` | `executeIdeaFill`: a holding left after a fill (a buy, a top-up or a trim) gets the fill's provenance: the slot snapshot, `vendor_time`, the quote's time. This covers all three ledgers; the same-stock comparison is a mirror and copies it |
| `entry.js:279` | The book's position is booked with the idea holding's own provenance |
| `close.js:611` | The book's positions at a close: fresh → this close's provenance; carried → kept |
| `close.js:108`, `:110` | `marksOf`: a valuation row's carried mark names `carriedFrom` (the holding's provenance) |
| `settlement.js:222` | `ledgerEndpoint`: each endpoint holding gains `markSource` and, when carried, `carriedFrom`. These are provenance only: no figure reads them |
| `evidence.js:89`, `:108` | `readAdmissionMarkSources` now reads only the last close's book row. `markSourceOf` reads the position's provenance and gives one of four kinds: `entry_fill`, `close`, `carried` (naming the carried price's own source: its session, snapshot, quality and time) or `unknown` |
| `evidence.js:191`, `:201`, `:205` | `provenanceCopy`; `timeAgreesWithQuality` (a mark has no time exactly when its quality is `receipt_time_fallback`); `honestProvenance` |
| `evidence.js:232`, `:241` | `isCarriedMark` reads the endpoint row's `markSource`. `endpointCopy` gives each mark its `markSource`, its `snapshotKey` and, when carried, `carriedFrom`. That replaces `carriedFromVendorTimeIso`, which borrowed the holding's `lastMarkAsOf` |
| `evidence.js:484` | `resultPacketMissingMarks`, the completeness check. A fresh mark must name the endpoint's snapshot, carry no `carriedFrom`, and have a time that agrees with its quality. A carried mark needs an honest `carriedFrom`, which the packet's own record of that source confirms (`:510`) |
| `admission.js:347` | The call now reads only the last close's row |

**T2B-02 — `3f38e4cf`.**

| Where | What |
|---|---|
| `windowLedger.js:155`, `:158` | `WINDOW_ONLY_SESSIONS_PER_TX = 20`; the cursor's field, `execState.windowsAccountedThrough` |
| `windowLedger.js:169` | `firstUnaccountedWindowSession`. With a cursor, the next session after it: the later of `windowsAccountedThrough` and `lastCloseKey`. With neither, the creation session: its date when the book existed before that session's close pass ended, else the next session |
| `windowLedger.js:185` | `windowOnlySessionsBefore` |
| `windowLedger.js:199`, `:223` | `buildCloseWindowRow(…, valued)`. Every close row now says `valued`. A window-only row has `observed: null`, no snapshot, `caughtUpAt`, `accountedBy: 'window_cursor'` and an empty code record |
| `windowLedger.js:251`, `:266` | `readWindowOnlySessions` (reads only) and `writeWindowOnlySessions` (create-once) |
| `close.js:470`–`:480` | `closeNextSession`, before any write: reads the sessions the cursor has not covered before the one the valuation closes. If there is nothing to value, or more than twenty such sessions, this transaction accounts for them alone and moves the cursor |
| `close.js:753`, `:766` | Otherwise the valuation's transaction writes their rows before its own, and moves the cursor to the session it closed |
| `close.js:830`, `:869` | `catchUpIdeaBook` and `closeIdeaBook` carry on after a window-only transaction, which does not count against the valuation's twenty sessions. Both return `windowsAccounted` |
| `compositionProtectedStoresAllowlist.json` | The new create site (`writeWindowOnlySessions`, 1) and `closeNextSession`'s second update (2), each with its note |

**T2B-03 — `ce592c00`.**

| Where | What |
|---|---|
| `close.js:662`–`:700` | For each idea reaching its endpoint, the close reads the idea's row of every close from its entry session to the one before, all before any write. It hands those rows, with this close's row, to the packet |
| `evidence.js:277` | `observationOf`: one close, taken from its row, on each ledger. It holds the marked value and cash (and the idea's holdings value), and each holding's quantity, mark, quality, vendor time, source and snapshot key (`carriedFrom` for a carried one) |
| `evidence.js:409`, `:413`, `:465` | `buildResultPacket(…, closeRows)` refuses `observation_row_missing` when any close between entry and endpoint is missing or out of sequence. It writes `observations` beside `track` |
| `evidence.js:356` | `recomputeResultFromPacket` recomputes each close's values from its prices and checks them against what the close states. It then folds them as the close folded its rows, states the result with `trackStatistics`, and lists every problem it finds (see the review) |
| `evidence.js:510`, `:527` | `sourceRecordAgrees`: a carried mark's source must match the packet's own record of it, either the observation of that close or the entry fill. `resultPacketProvenanceProblems` checks every copied mark |
| `settlement.js:296`, `:396` | `trackStatistics` is now the one function the result's decline, exposure and row counts are written with. No figure moves: the end-to-end results are leaf-identical |

**T2B-04 and Q2 — `a061408c`.**

| Where | What |
|---|---|
| `spend.js:117` | `maxCallChargeMicros`: every input token at the table's dearest input rate (`CACHE_WRITE_INPUT_MULTIPLIER`, 1.25×) and every output token at the output rate, rounded up to the micro-dollar. It returns null for a model the table does not price |
| `spend.js:134`, `:142` | `spendExhausted` (the room is below `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD`) and `withExhaustion`, which re-derives the state at every write and clears `exhaustedAt` / `exhaustedBy` once the month is no longer exhausted |
| `spend.js:184`, `:195`, `:211` | `planReserve({ modelId, maxInputTokens, maxOutputTokens, cacheTtl, serverTools, … })` refuses `model_unpriced`, or `spend_would_exceed` when the maximum does not fit; neither refusal writes anything. The op records the model, ceilings, cache, tools, maximum and table version |
| `spend.js:227`, `:246` | `planSettle` records the charge as it is and sets `releasedUsd`. An unreadable call is charged its maximum, and a charge above the maximum is flagged `charge_above_reservation` |
| `spend.js:315` | `settleSpend` logs `PRACTICE_FIELD_CHARGE_ABOVE_RESERVATION` |
| `constants.js:139` | `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD = 0.05`, a placeholder T1b sets |

**The review — `29bf46a5`** (F.5 gives each finding):

| Where | What |
|---|---|
| `spend.js:99`, `:197` | S-1: `cacheTtl` (`'none'`, `'5m'` or `'1h'`) and `serverTools` are required; a one-hour cache write or any server tool is refused `pricing_unsupported`. The header now defines `maxInputTokens` as every billed input token |
| `spend.js:206` | S-2: an exhausted month refuses `spend_exhausted`, even for a call that would fit. Nothing is written |
| `spend.js:203`, `:237` | S-4: fails closed with `spend_state_invalid` or `reservation_without_maximum` |
| `evidence.js:134` | P-1: the admission packet's position copy no longer holds the raw `lastMarkAsOf`, which stays only as `markSource.recordedMarkAsOf`, labelled |
| `evidence.js:314`, `:326`, `:337`, `:356`, `:413` | O-1, O-1b, O-3, O-4: `wholeLedger`, `holdingsAgainst` (summation order only), `sameJson`, the recomputation's coverage, ledger and result checks, and the builder's sequence check |
| `sessions.js:57` | W-3: a fill dated in a session the window cursor has already written up is refused as closed |
| `windowLedger.js:39`, `:211` | W-1: the header now says what `served` and `valued` mean, and a window-only row's `code.caughtUpSession` is null |

### F.3 Checks

On WSL Ubuntu (Linux, the record), in a private worktree of `~/pd-ci` at the code head, Node 20.20.2, with the install matching the lockfile (`40382e64edb6`) and `TZ=UTC`. The full suite ran alone under the lock. Every check below ran at the FINAL code head `29bf46a5` unless it names `a061408c` (the four fixes before the review).

| Check | Command | Result |
|---|---|---|
| Practice Field, endpoint, scans, isolation and trace files | `npx vitest run api/_utils/practiceField api/practice-field api/cron/practiceFieldIsolation.test.js api/cron/practiceFieldNoBook.trace.test.js api/_utils/filmRoom/practiceFieldSeam.test.js api/_utils/mandateMoneyRounding.scan.test.js api/_utils/mandateRationale.imports.test.js api/_utils/compositionProtectedStores.scan.test.js api/_utils/modelPriceTable.test.js` | exit 0 · `Test Files  26 passed (26)` · `Tests  671 passed (671)` (at `a061408c`: 26 files, 661) |
| Full suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit 0** · `Test Files  1507 passed \| 12 skipped (1519)` · `Tests  33945 passed \| 135 skipped (34080)` · 279.56 s (read from the log). 30 rows more than the build's 33,915: +12 evidence, +7 window ledger, +11 spend. At `a061408c`: exit 0, `Tests  33935 passed \| 135 skipped (34070)` |
| Rules suite | `npm run test:rules` (JDK 21, the local emulator) | **exit 0** · `Test Files  43 passed (43)` · `Tests  813 passed (813)` (no rule changed this round; also exit 0, 813/813 at `a061408c`) |
| Lint gate | `npm run lint:gate` | exit 0 (`--max-warnings 0`; also at `a061408c`) |
| Production build | `npx vite build` | exit 0. `dist/` (113 files) is **byte-identical** to `main`'s build in the same tree (`dist` hash list `8376dc36…` for `71bc6bde`, `a061408c` and `29bf46a5`). The pushed head, with this report, is built again before the push; the PR description gives that result |
| The seventeen-scenario differential, both modes, against `origin/main` | Astra's `astra-differential.test.js`, unmodified (SHA-256 `17e724ad…`); `base` = `71bc6bde`, `head` = the code head, LF archives | **34/34 identical**: 17 at `'off'`, 17 at `'on'`. Its 4,000-case build-set row and its prompt byte-equality rows pass too (36/36 rows). Also 34/34 at `a061408c` |
| The 40-case traced differential, against `origin/main` | Astra's `astra-cron-trace.test.js`, unmodified (SHA-256 `9297cead…`) | **40/40 raw-identical**: 20 at `'off'`, 20 at `'on'`, with one registry read per `'on'` fire on both sides. Its evidence file's hash is `6c169f26…`, the same as at the build. Also 40/40 at `a061408c` |

The differentials ran on Windows from LF `git archive` trees, in Astra's layout. The build's own 17-scenario scratch harness (`204a2f32…`) was not rerun; Astra's harness covers the same seventeen scenarios at both modes.

### F.4 The end-to-end comparison

The run was re-pinned at each fix and once for the review. Each dump was compared leaf by leaf with the one before it. Before changing anything, this session reproduced the current pin (`bb742bb9…`) from `421a445d` byte for byte.

| | SHA-256 | Bytes | Documents | Against the one before |
|---|---|---|---|---|
| The pin before this round (`421a445d`) | `bb742bb9181c76d5…` | 328,611 | 154 | — |
| T2B-01 | `db22f0487877ad3e…` | 332,712 | 154 | 108 leaves added; 3 changed (the result packets' `contentHash`) |
| T2B-02 | `e6c3969bb56f8ca3…` | 334,166 | 155 | 1 document added; 29 leaves added; none changed |
| T2B-03 (T2B-04 does not touch the run) | `bd6286bdab695368…` | 384,605 | 155 | 1,195 leaves added; 3 changed (the same `contentHash`es) |
| The review (the final pin) | **`f9c91e33f6bafa05b46ec4d7ce5d67d8ad1a8a80a4b92d42b4412fcbf76ad6ed`** | 384,605 | 155 | 1 leaf changed: 13 Nov's window-only row, `code.caughtUpSession` `true` → `null` |

**The pin before this round against the final pin, leaf by leaf:**
- **One document added:** 13 Nov's close row of the window ledger. The run's book is created on Friday 13 Nov and its first idea fills on Monday 16 Nov. Nothing ran on the 13th, so its three windows are missed, `valued: false`.
- **1,332 leaves added, every one a new or provenance field:**
  - `observations` in the three result packets: 1,195;
  - `lastMarkProvenance` on the ideas' holdings: 60;
  - `valued` on the 28 existing close rows: 28;
  - `markSource` (28) and `snapshotKey` (14) on endpoint rows' holdings and packet marks;
  - `carriedFrom` on the one carried mark of the missing-quote day: 6;
  - the book's `execState.windowsAccountedThrough`: 1.
- **No leaf removed.** The only changed leaves are the three result packets' `contentHash`, which follow from the added fields.
- **No money leaf changed:** no cash, quantity, fill, valuation mark, value, gap, decline, exposure or result figure.

`endToEnd.test.js` now also checks two things for each idea: the packet's statistics recompute from the packet alone with no problem, and every copied mark's source agrees with the packet.

### F.5 The review and the refuter

**How.** The round's code diff is 18 files, so BUILD_RULES §2 applies. As the prompt directed, ONE independent lens reviewed the four fixes, on its own read-only `git archive` snapshot of `a061408c` with `node_modules` linked. It was told to find defects, fix nothing, and reproduce each finding.
- The lens split the work with two read-only forks of its own: one on the observations, one on spend.
- It ran its own mutants against the repository's suites and a leaf comparison of the end-to-end dumps.
- It re-ran the rounding scan's closure walk with POSIX paths. spend.js's new `Math.ceil` is not reachable from any money entrypoint, and every other count equals the baseline.

Every finding then went to a refuter on a fresh snapshot, told to break it. The refuter fetched Anthropic's published pricing page to check S-1. Neither agent wrote to the repository or ran a writing git command.

| # | Finding (lens) | Refuter | Disposition |
|---|---|---|---|
| S-1 | The maximum assumes 5-minute caching. A 1-hour cache write bills 2× the base input, and a server tool has fees; the table carries neither, and `priceUsage` cannot see either. Example: a 200k-in / 1k-out call reserves $0.255 but can list at $0.405 (should-fix) | CONFIRMED and widened, rates verified on Anthropic's pricing page (Haiku 4.5: a 1-hour write is $2/MTok; web search is $10 per 1,000 searches plus its result tokens; tool use adds a system prompt). **Must-fix** by T2B-04's own standard | **Fixed.** A call must state `cacheTtl` and `serverTools`; a 1-hour cache write or any server tool is refused `pricing_unsupported`. `maxInputTokens` is defined as every billed input token, the tool system prompt included. Pricing those, rather than refusing them, needs the table to carry them (F.7) |
| S-2 | A month that reads exhausted still accepted a call below the $0.05 figure (should-fix) | CONFIRMED: it contradicts contract §17 B-SPEND ("no model call runs") | **Fixed.** An exhausted month refuses `spend_exhausted`; nothing is written, so Q2 holds |
| P-1 | The admission packet sealed a position's raw `lastMarkAsOf` beside its price, which can be another quote's time (note) | CONFIRMED and **upgraded to should-fix**: it is the T2B-01 class in a create-once packet, and no ruling covered that field | **Fixed.** Dropped from the position copy; kept only inside `markSource` as `recordedMarkAsOf` |
| O-2 | No test triggers `observation_row_missing`, a positive provenance problem or the `order:` problem; four mutants survive (should-fix, tests) | CONFIRMED (one mutant is equivalent): should-fix for the builder row, a note for the rest | **Fixed:** all four rows added |
| W-1 | A window-only row says the close was `served`, and raises no close alert (should-fix) | PARTLY: the facts are right, but a caught-up VALUED close reads exactly the same way. The proposed fix would alert on one of two identical outages. Note | Kept (R-28). `code.caughtUpSession` is now null on such a row, and the header says what `served` and `valued` mean |
| W-2 | No test pins the creation-session rule (after the pass, a weekend, between the close and the pass end); three mutants survive (should-fix, tests) | CONFIRMED, but the mutants change only rows that can carry no alert. Note | **Fixed:** the three rows added |
| W-3 | The fill guard checks only `lastCloseKey`: a fill in a session already written up by the cursor would wedge that session's close for good (note) | CONFIRMED latent, unreachable from every production caller. Note plus a one-line hardening | **Hardened:** `fillSessionRefusal` refuses such a session, with a row |
| O-1 | The recomputation checked neither coverage nor the stated result; an edited and re-sealed body passed (should-fix) | PARTLY: re-sealing needs write access to a server-only store, and anyone with that access can rewrite everything consistently. Note | **Hardened:** `coverage:` and `result:` problems |
| O-1b | A missing ledger folded as $0 (should-fix) | PARTLY: reachable only through a forged or corrupted packet. Note | **Hardened:** `ledger:` problems, never $0 |
| O-3 | The recomputation summed in symbol order, the valuation in the holdings' own order; at a half-cent tie an honest value was named a problem (note) | CONFIRMED: narrow (a ticker change at that close, three or more names). The in-memory store keeps insertion order, unlike Firestore | **Fixed:** a stated value agrees when it is the rounding of its prices' sum up to the summation order's last bit (1e-9 relative), never a cent. R-33 corrected |
| O-4 | A missing row makes the endpoint close throw for good (note) | REFUTED: no real path produces one, and the calendar walk cannot stop early | The builder also checks the sequence now (cheap) |
| S-4 | An op with no numeric maximum turns the month's totals into NaN (note) | CONFIRMED mechanism, unreachable | **Hardened:** fails closed |
| T-1, T-2 | `>=` for the over-reservation test, and re-stamping `exhaustedAt`, both survive (test gaps) | CONFIRMED | **Fixed:** rows added |
| P-2 | `basisSuspicion.frozenMarkAsOf` pairs a frozen mark with `lastMarkAsOf` (note) | CONFIRMED, but T1a-2a's code, in no packet | Not this round's; worth knowing if a founder screen ever shows it |

**What the lens and refuter found sound** (at `a061408c`):
- Provenance is written at every fill and close on every ledger, and on the book's positions. It survives unobserved sessions, held-back symbols, splits, ticker changes and settlement-pending holdings.
- The admission packet's kinds are right.
- No session is skipped or written twice under real clocks, and the 20-per-transaction loop moves forward.
- Weekend, holiday, after-hours and early-close creation are handled.
- Alerts are neither lost nor duplicated.
- The track and recomputation fold identically.
- The largest packet measures about 239 KB.
- The maximum bounds `priceUsage` within the table's own pricing (20,000 random cases).
- Micro-dollar amounts round-trip exactly; $3.00 is admitted and $3.000001 refused.
- Refusals write nothing; replays, rollover and the clock-behind case all hold.
- Every read comes before any write.
- Nothing outside the Practice Field changed.

The refuter added an edge to W-2: the creation rule uses the close pass's end (18:00), while the last close fire is at 17:45. A book created between 17:46 and 17:59 is therefore owed a close that no fire can serve. The effect is one close row with nothing missing (R-27).

### F.6 The mutation battery

Each mutant re-breaks one rule in a copy of the code head, never the working tree: an LF `git archive` tree. The runner then runs the test files named for that mutant and judges by the exit code **and** the JSON report. It stopped if the unmutated baseline was not green. It checked that every anchor occurs exactly once, restored each file afterwards, and checked each restore by hash.

**At `a061408c` (the four fixes): 21 defined, 21 ran, 21 killed, 0 survived, 0 broken** (baseline: 103 rows in 5 files).

**At the final code head `29bf46a5`: **34 defined, 34 ran, 34 killed, 0 survived, 0 broken** (baseline: 157 rows in 6 files). That is the first battery's 21, with X8 re-anchored where the review rewrote its line, plus one mutant per review fix (R-).**

| Id | Re-breaks | File | Tests run | Verdict at `29bf46a5` (rows failed) |
|---|---|---|---|---|
| P1a | a borrowed vendor time accepted (the completeness check takes any time beside an untimed quality) | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| P1b | a borrowed vendor time at the root: a fresh untimed close mark recorded with the holding's earlier lastMarkAsOf | `ledger.js` | `evidence`, `endToEnd` | KILLED (3/26) |
| P2a | the window cursor tied back to valuation: no cursor before the first valuation close (no creation start) | `windowLedger.js` | `windowLedger`, `endToEnd` | KILLED (8/29) |
| P2b | the window cursor tied back to valuation: the cursor IS the valuation's lastCloseKey | `windowLedger.js` | `windowLedger`, `endToEnd` | KILLED (17/29) |
| P3a | a no-money session not accounted (the valuation's transaction writes no row for the sessions before it) | `close.js` | `windowLedger`, `endToEnd` | KILLED (3/29) |
| P3b | a no-money session not accounted (a catch-up with nothing to value writes nothing) | `close.js` | `windowLedger`, `endToEnd` | KILLED (4/29) |
| P4 | an intermediate close dropped from the packet (every other one between entry and endpoint) | `evidence.js` | `evidence`, `endToEnd` | KILLED (11/26) |
| P5 | the recomputation passing without the observations (it answers from the packet's own track) | `evidence.js` | `evidence`, `endToEnd` | KILLED (2/26) |
| P6 | an estimate reserved instead of the maximum (input at the base rate, not the dearest) | `spend.js` | `spend` | KILLED (18/26) |
| P7 | a refusal exhausting the month (the refused reservation writes a sticky exhausted) | `spend.js` | `spend` | KILLED (2/26) |
| P8 | the unused reservation not released (the month keeps the maximum after settlement) | `spend.js` | `spend` | KILLED (8/26) |
| X1 | a carry overwrites the provenance (a carried mark takes this close as its source) | `ledger.js` | `evidence`, `endToEnd` | KILLED (5/26) |
| X2 | a carried source not checked against the packet's own observation of it | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| X3 | the valuation's transaction drops the alerts of the sessions only the window cursor accounted for | `close.js` | `windowLedger`, `endToEnd` | KILLED (2/29) |
| X4 | more sessions than one transaction takes: the rest left unaccounted | `close.js` | `windowLedger`, `endToEnd` | KILLED (1/29) |
| X5 | an unpriced model reserved at nothing | `spend.js` | `spend` | KILLED (2/26) |
| X6 | a charge above the reserved maximum clamped to it | `spend.js` | `spend` | KILLED (1/26) |
| X7 | exhausted not derived from the smallest call (only when the room is negative) | `spend.js` | `spend` | KILLED (7/26) |
| X8 | the recomputation does not check an observation's stated value against its prices | `evidence.js` | `evidence`, `endToEnd` | KILLED (2/26) |
| X9 | a window-only close row says it was valued | `windowLedger.js` | `windowLedger`, `endToEnd` | KILLED (5/29) |
| X10 | a row's carried mark does not name its source | `close.js` | `evidence`, `endToEnd`, `close` | KILLED (4/61) |
| RS1a | S-1: a 1-hour cache write reserved at the 5-minute rate | `spend.js` | `spend` | KILLED (1/26) |
| RS1b | S-1: a server tool reserved as if it had no fee | `spend.js` | `spend` | KILLED (1/26) |
| RS2 | S-2: an exhausted month reserves a call small enough to fit | `spend.js` | `spend` | KILLED (4/26) |
| RS4 | S-4: an op with no numeric maximum is settled (NaN totals) | `spend.js` | `spend` | KILLED (1/26) |
| RT1 | T-1: a settlement AT the maximum flagged above it | `spend.js` | `spend` | KILLED (1/26) |
| RT2 | T-2: a later write re-stamps exhaustedAt / exhaustedBy while the month stays exhausted | `spend.js` | `spend` | KILLED (1/26) |
| RP1 | P-1: the admission packet seals the raw lastMarkAsOf beside the price | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| RO1a | O-1: a gap between copied closes not named | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| RO1b | O-1b: a missing ledger folded as $0, unnamed | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| RO1r | O-1: a result its closes do not give is not named | `evidence.js` | `evidence`, `endToEnd` | KILLED (2/26) |
| RO3 | O-3: the summation order's last bit treated as a cent of money | `evidence.js` | `evidence`, `endToEnd` | KILLED (1/26) |
| RW3 | W-3: a fill dated in a session the window cursor already wrote up | `sessions.js` | `windowLedger`, `entry` | KILLED (1/70) |
| RW1 | W-1: a window-only row says its session was caught up | `windowLedger.js` | `windowLedger`, `endToEnd` | KILLED (3/29) |

The prompt's eight, by mutant:
- a borrowed vendor time accepted: P1a, with the root case P1b;
- the window cursor tied back to valuation: P2a, P2b;
- a no-money session not accounted: P3a, P3b;
- an intermediate close dropped from the packet: P4;
- the recomputation passing without the observations: P5;
- an estimate reserved instead of the maximum: P6;
- a refusal exhausting the month: P7;
- the unused reservation not released: P8.

Astra's borrowed-time case is caught twice: by the time-and-quality rule, and by the packet's own observation of 30 November (X2). Under P1a alone her rows still fail the observation check, so the fresh-price row is what kills P1a.

### F.7 The price table, for checking before T1b's first call

Nothing in this round verifies these figures against Anthropic's published prices. `api/_utils/modelPriceTable.js` (`MODEL_PRICE_TABLE_VERSION = 2`, with the comment "first-party API list rates (verified 2026-08-12)") holds:

| Model id | Input, $ per million tokens | Output, $ per million tokens |
|---|---|---|
| `claude-haiku-4-5-20251001` | 1.00 | 5.00 |
| `claude-haiku-4-5` | 1.00 | 5.00 |

The table's multipliers, each × the base input rate:
- cache write: `CACHE_WRITE_INPUT_MULTIPLIER = 1.25`, the 5-minute tier;
- cache read: `CACHE_READ_INPUT_MULTIPLIER = 0.1`;
- batch discount: `BATCH_DISCOUNT_MULTIPLIER = 0.5`.

The reservation prices every input token at 1.25× the input rate, so a call that writes its whole prompt to the cache still fits. **Not in the table**, and so refused at reservation (review S-1):
- the 1-hour cache write: 2× base on Anthropic's list (the refuter read $2/MTok for Haiku 4.5);
- server tools: web search is $10 per 1,000 searches plus its result tokens.

The refuter also noted Haiku 5.5's prompt-length pricing (5× base above 100K tokens), which a flat per-model rate cannot express. If T1b uses any of these, the table, and `priceUsage`, must carry it first.

### F.8 Readings stated

| # | Where the prompt left room | What was built |
|---|---|---|
| R-24 | T2B-01: "make `lastMarkAsOf` follow the same rule, or stop using it for provenance; say which" | **Stopped using it for provenance.** `lastMarkAsOf` is the engine's position field, and the gap screen reads it as the session of the last trusted mark (`ledger.js` `markSessionOf`). Emptying it for an untimed quote would change which cash actions wait, a money change this round may not make. So it is written exactly as before and documented as the last *vendor-timed* mark's time. Nothing that states where a price came from reads it, and since the review no packet seals it beside a price (P-1). The new `lastMarkProvenance` is the record |
| R-25 | T2B-01: "a carry copies the provenance unchanged" | The provenance is unchanged through a split too (the engine divides `lastMark`; the receipts record the ratio) and through a ticker change (`symbol` stays the quote's symbol). So a carried price can differ from its source quote by a split's ratio. The packet's cross-check compares the source's time, quality and snapshot, never its price |
| R-26 | T2B-01: the admission packet's mark sources | A `carried` mark now names its source's snapshot, session, quality and time; before, it named no snapshot (the build's B1 residual). A position with no provenance reads `unknown`, and none is written without one since this round |
| R-27 | T2B-02: "from the book's creation" | The creation session is the creation date when it is a session and the book existed before that session's close pass ended (18:00 on a regular day); otherwise it is the next session. A book created at 17:00 is owed that day's close, not its windows; one created at 19:00 starts the next session. The last close fire is at 17:45, so a book created between 17:46 and 17:59 is owed a close row no fire can serve, with nothing missing (refuter) |
| R-28 | T2B-02: what a window-only row says | `valued: false`, `observed: null`, no snapshot, `caughtUpAt`, `accountedBy: 'window_cursor'`, `code.caughtUpSession: null`. Its `close` is listed as served, meaning its close row was written late, exactly as a caught-up valued close's is. So only its intraday windows can be missing, which matches Astra's "three intraday windows reported missing". The refuter showed the alternative would alert on one of two identical outages (W-1) |
| R-29 | T2B-02: where the cursor starts for a book that already has closes | At the later of `windowsAccountedThrough` and `lastCloseKey`. Every session the valuation closed wrote its own close row, so the cursor never re-writes one (a second `tx.create` would abort the close). Every close writes both fields, so once a book has a close the two are equal. No fill is dated in a session the cursor has written up (W-3; today unreachable) |
| R-30 | T2B-02: when window-only sessions are written | Only in a transaction that commits: a close whose valuation runs, or a catch-up with nothing to value. A requested close refused `valuation_missed` writes nothing, as before, and the next close or catch-up accounts for those sessions. Twenty go in each transaction; a call carries on until done, and these transactions do not count against the valuation catch-up's twenty sessions |
| R-31 | T2B-03: split the packet if it might pass 1 MiB | **One document.** The largest shape is 238,673 bytes by Firestore's storage-size rules (285,508 as JSON), about 23% of the limit; the test asserts it is under 256 KiB. That shape is a long slot of 60 sessions with four names, an eight-name frozen basket and SPY, with every close between entry and endpoint carried, so every copied mark names its source |
| R-32 | T2B-03: a close missing between entry and endpoint | Refused (`observation_row_missing`), as a missing inception row is (R-9). Every close writes the row of every filled idea, so this cannot be produced, and a packet without the row would not be the result's evidence |
| R-33 | T2B-03: "recomputed from the packet alone" | Each close's values are recomputed from its holdings' quantities and marks and its cash, and checked against what the close states. A stated value agrees when it is the rounding of its prices' sum in some order: Firestore returns map keys sorted, but a ticker change at that close appends its key, and the in-memory store keeps insertion order (review O-3). The values are then folded and stated by the same functions the close used (`foldCloseIntoTrack`, `trackStatistics`), not from the packet's `track`, which is kept beside them. The recomputation also names gaps, missing ledgers and a result its closes do not give. It shows a change to a stored packet; it cannot stop a forgery by someone who can write the server-only store (review O-1) |
| R-34 | T2B-04: "the most the call can cost" | Every input token at the table's dearest input rate (a 5-minute cache write, 1.25×, so a prompt written to the cache still fits) and every output token up to `max_tokens` at the output rate. No batch discount; rounded up to the micro-dollar. `maxInputTokens` is every billed input token, the tool system prompt included. A test prices every usage mix within the ceilings with the table's own `priceUsage` and finds none above the reservation. What the table cannot price is refused (S-1) |
| R-35 | T2B-04: settling a call whose usage cannot be read | Charged its reserved maximum, the most it could have cost. Before, it was charged its estimate |
| R-36 | T2B-04: `exhausted` "derived" | `exhausted` is computed at every write by comparing the room with `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD` ($0.05, a placeholder), and stored with the totals for readers. An exhausted month refuses every reservation, even one that would fit (contract §17 B-SPEND; review S-2). That refusal writes nothing, so the month only stays exhausted while its room stays low, and a settlement that frees room ends it (Q2) |

### F.9 What goes to T1a-2b-2

- **T2B-05** (Astra, P3): recover a window's action counts after a window-ledger write fails. A sale or entry can commit before the separate window-row write fails, and the retry can then serve the window with no copy of the earlier fill count. Fix: reconstruct the counts from committed receipts, or persist an idempotent pending-window receipt with each action.
- **T2B-06** (Astra, P3): recover the original create response after a failed done write. A pending creation that committed book A, replayed after A closed and B opened, answers `open_book_exists` naming B. Fix: recover A's creation receipt before reading today's open claim.
- **Q7:** the draining close sweep counts a catch-up that closed a book as `skipped`, not `closed`.

**For T1b** (not this round's): check the price table (F.7), set `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD` from the first caller's smallest call, and keep model calls to the 5-minute cache with no server tool until the table prices more.

---

## Final fix, 16 Nov 2026 — T2B-C01

**Claude Code (Opus 5.5), 16 Nov 2026.** Astra confirmed the fix round (`docs/audits/20261116_ASTRA_CONFIRMATION_T1A2B1_FIX_ROUND.md`, committed byte-identical, SHA-256 `5fdd870f…`). T2B-01, T2B-02 and T2B-03 are closed, and the original $3.10-against-$2.90 case is fixed. One finding remained, **T2B-C01**. Settlement rounded each actual charge to the nearest micro-dollar. A charge with a fraction of a micro-dollar (cache reads are 0.1 µ$ a token at Haiku's price) was recorded short, and too much room was released. In her thirteen-call case, every call was honest and within its ceilings, yet the charges reached $3.0000001 while the book read $3.00. This is the last change in this PR. It touches `spend.js`'s arithmetic and its tests only.

**Heads.**
- `git fetch origin` ran first. The branch head was `5dbde8a43ffcbb11d02962e98f36d2fd1e80769f`, as expected.
- `origin/main` was `71bc6bde7c0553cdb16e5c5f3752d248968967c3`, already in the branch, so nothing was merged.
- Code head: `62061c4563099b7590f01fb29202e53db46ef3c3`. Then Astra's confirmation (`1cb20904`), then this report.

`PRACTICE_FIELD_MODE` is still `'off'`. No fenced file, flag, pin, rule, index or `vercel.json` changed. No model call, Firestore write or EODHD call was made.

### The change (`api/_utils/practiceField/spend.js`, at `62061c45`)

- **One unit: whole nano-dollars (1e-9 USD).** The month's reserved, settled and remaining figures, each reservation's maximum and each charge are computed in it.
  - Every rate the table holds is a whole number of nano-dollars a token: input 1,000, cache write 1,250, cache read 100, output 5,000.
  - The header at `:73` explains the unit. The constants and `nanosOf` / `usdOf` are at `:104–111`.
- **An incurred charge is never rounded down.** `incurredChargeNanos` (`:113–128`) rounds a genuine fraction of a nano-dollar up (`:127`).
  - There is one exception: the double's own error. priceUsage sums floating-point products, so an exact 249,250,000 n$ arrives as `0.24925000000000003` USD.
  - A value within 16 units in the last place of a whole nano-dollar is that whole nano-dollar. For a $3 charge, that is about 1e-14 USD. The measured error of priceUsage's sums is within 2 units.
  - Rounding that noise up would charge eleven of Astra's honest calls above their exact maximum, flag them, and miss the exact sum (mutant M2 below).
  - For the table's rates, the snap is exact. For a future rate that is not a whole number of nano-dollars a token, a charge could be understated by at most that band, per call. Checking the rates is T1b's job.
- **The maximum** is still `maxCallChargeMicros` (rounded up to the micro-dollar, unchanged), times 1,000, exactly (`:233`).
- **Room and exhaustion** in nano-dollars: `roomNanos` (`:168`) and `spendExhausted` (`:172`).
- **The reservation check and its new total** in nano-dollars: `:248` and `:254`.
- **Settlement** in nano-dollars:
  - the reserved maximum (`:277`);
  - the charge, through `incurredChargeNanos` (`:280`);
  - the replay comparison (`:282`);
  - the flag test and the released room (`:286–287`);
  - the month's new reserved and settled totals (`:299–300`).

**What did not change.**
- The public fields: `reservedUsd`, `settledUsd`, `maxChargeUsd`, `chargedUsd`, `releasedUsd` and `roomUsd` stay USD numbers.
- The operation keeps the caller's raw `actualUsd`.
- `charge_above_reservation` and every refusal code are unchanged.
- `SPEND_VERSION` is still 3. The book's and the op's write sites (`tx.create` / `tx.update`) are as they were.
- **No stored field was added.** Each USD figure the module writes is a whole number of nano-dollars over 1e9, so `nanosOf` reads it back exactly.

### The tests (`api/_utils/practiceField/spend.test.js`)

The 26 existing rows pass unchanged. The only edit to them is the import line, which now also imports `incurredChargeNanos`. Three rows are new:

- **Astra's regression (`:333`).** It runs on `claude-haiku-4-5`, with a 5-minute cache and no server tool. Each `actualUsd` is the table's own `priceUsage` double, as a caller would pass it.
  - The calls: one call with 1,001 cache reads and 1,000 output tokens; eleven with 199,000 cache writes and 100 output tokens.
  - Each of the twelve is reserved and settled `ok` with no flag. Each op keeps its raw `actualUsd`.
  - The book then reads `reservedUsd` = `settledUsd` = 2,746,850,100 n$. That is the test's own integer sum.
  - The thirteenth call (199,000 cache writes, 880 output; maximum $0.25315) is refused `spend_would_exceed`, with `roomUsd` 0.2531499, and writes nothing.
- **Its control (`:362`).** The same calls with one cache read fewer, so the first charge is a whole $0.0051. The room is then exactly the thirteenth call's maximum. It fits, and the month reads $3 exactly.
- **The conversion (`:374`).**
  - Genuine fractions round up: 5,100,100.01 and 5,100,100.6 n$ both become 5,100,101, and 0.4 n$ becomes 1.
  - Noise 1 and 4 units in the last place either side of 2,746,850,100 n$ snaps to it.
  - Three usage mixes settle to the test's integer arithmetic exactly.
- **Controls already in the file**, still passing: exactly $3 fits; $3.10 against $2.90 is refused; release, replay, rollover, exhaustion, an unpriced model, one-hour caching and server tools.

**The mutation check.** Each mutant was applied to `spend.js` in the Linux worktree and judged by its exit code. The anchors were checked: every mutant printed `APPLIED`, none `BROKEN`. The file was restored, and the clean run passed again.

| Mutant | Result |
|---|---|
| **M1 (the brief's): settlement back to round-to-nearest micro-dollars** (`Math.round(actualUsd × 1e6) × 1000`) | **killed**: Astra's regression fails |
| M2: no noise snap (plain round-up) | killed: the regression, its control and the conversion row fail |
| M3: the reservation check reads the month's total to the nearest micro-dollar | killed: the regression fails |
| M4: the settled total rounded to the nearest micro-dollar | killed: the regression fails |
| M5: a genuine fraction rounded to the nearest, not up | killed: the conversion row fails |

### Results (Linux, the record)

These ran on WSL Ubuntu, in a private worktree of `~/pd-ci` at `62061c45`, with Node 20.20.2, the install matching the lockfile (`40382e64edb6`) and `TZ=UTC`.

| Check | Result |
|---|---|
| Spend, Practice Field, endpoint, scans, isolation and trace files (the F.3 command) | exit 0 · `Test Files  26 passed (26)` · `Tests  674 passed (674)` (671 before, +3) |
| Full suite, `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit 0** · `Test Files  1507 passed \| 12 skipped (1519)` · `Tests  33948 passed \| 135 skipped (34083)` · 304.12 s (read from the log). 3 rows more than the fix round's 33,945: the three new spend rows |
| Lint gate, `npm run lint:gate` | exit 0 |
| The seventeen-scenario differential, both modes, against `origin/main` (Astra's `astra-differential.test.js`, unmodified, SHA-256 `17e724ad…`; LF archives of `71bc6bde` and `62061c45`) | **34/34 identical**: 17 at `'off'`, 17 at `'on'`; 36/36 rows with the build-set and prompt rows |
| Astra's own demonstration (`astra-fractional-spend.test.js`, unmodified) | It now **fails where it should**. Its thirteenth reservation is refused, so `expect(reserve.ok).toBe(true)` fails at its line 22. After twelve calls, its evidence shows the book at $2.7468501, equal to its billed 2,746,850,100 n$ |
| Production build, `npx vite build` | Run on the pushed head, this report included, as the last check before the push. The PR description gives the result |

The rules suite was not rerun: no rule or rules test changed.

### What is carried (from Astra's confirmation)

**To T1a-2b-2:**
- T2B-05 and T2B-06 (F.9).
- Q7: a catch-up close counts as closed.
- **The gap screen's read of `lastMarkAsOf`.** Astra confirmed it can give a wrong gap-start date today. After 30 Nov's untimed price, a later half-price observation records the gap from 27 Nov. That date feeds the explanation and cash-hold checks.
- **The result packet's size with corporate-action receipts.** Astra's case with 767 dividend receipts reached about 431 KiB (440,984 storage-estimated bytes), still one document. The 233 KiB figure is not a maximum once receipts are included. Extend the size test and its documentation.

**To T1b, the caller's conditions** (Astra, her T2B-04 section):
- bind each reservation to the actual model and request;
- bound all billed input, including cached input and any input the provider adds for tools or system text;
- set the real output cap no higher than declared;
- enforce no one-hour caching, server tools or other unpriced billable options;
- reserve every real retry separately;
- never send a second call on an idempotent replay.

**Also to T1b:**
- verify the price table (F.7);
- add T1b's model;
- set `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD`, now a $0.05 placeholder;
- keep every new rate a whole number of nano-dollars a token, or revisit `incurredChargeNanos`' band.
