# Build T1a-2b-1 — the idea book's access, records and founder controls (dark)

**Build report, Practice Field T1a-2b-1** · Claude Code (Opus 5.5) · 15–16 Nov 2026
**Branch:** `claude/practice-field-t1a2b1-access-records` (the session opened in a fresh worktree of `origin/main` on an app-named branch; renamed to the prompt's name before the first commit).
**Base:** `origin/main` @ `71bc6bde7c0553cdb16e5c5f3752d248968967c3` (the merge of PR #1073), read after `git fetch origin` at the start; it is after `cb23d73c` (PR #1061, T1a-2a), as the prompt requires. Clean tree at the start.
**Code head:** `82693acb0192817029bdfc2f625bd8f95b3458ff` · 7 commits on the base · 40 files, +3,498 / −145. Of those, 18 are product or config (+1,419 / −62); the rest are tests. This report and its `docs/README.md` row follow in one more commit, which changes no code.
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`), unchanged. No fenced file (BUILD_RULES §1), flag value or pin changed. Rules and index changes are written and tested here and **deployed by the founder after merge** (§7).
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
| Review | Three lenses, a refuter on every finding, then a refuter on the fix round. Two must-fix were raised (B1, C1); the refuters held B1 at must-fix and moved C1 to should-fix. Both are fixed, as is every confirmed should-fix, including the two the fix-round refuter raised (NF-1, NF-2) (§5) |
| Mutation battery | **71 defined, 71 ran, 71 killed, 0 survived, 0 broken (baseline 365 rows green); rules mutants 11 of 11 killed** |
| For the founder | Deploy the rules and the index (§7); seven questions (§3.2) |

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
- A **wound-down** book takes no new idea and keeps running the ones it has. The first close that finds nothing left open closes it, counting the close of the session during which the request arrived (up to 18:00 Eastern). The book then leaves the founder's four-book cap, and the owner may start a new one. No cash is lost or reset.

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

| Check | Base `71bc6bde` | Head `82693acb` (code as at `b9cab98d`) | Result |
|---|---|---|---|
| 17 quarterly scenarios (the T1a-1 scratch test, SHA-256 `204a2f32…`, LF worktrees on Linux) | `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43`, 1,118,594 bytes | the same hash and bytes | **BYTE-IDENTICAL**, also at `5b3609d8` and `71d0b1bb` |
| Its control (scenario 18: an idea book in play, mode on) | `2553861a…`, 1,156,115 bytes | `e73dcda4…`, 1,163,013 bytes | Differs in scenario 18 only, so the harness sees a change when there is one |
| Astra's 40-case traced differential (her `astra-cron-trace.test.js`, unmodified, SHA-256 `9297cead…`, in her layout rebuilt in this session's scratchpad) | | | **40/40 raw-identical**: 20 at `'off'`, 20 at `'on'`, with one registry read per `'on'` fire on both sides. The evidence file's hash (`6c169f26…`) is unchanged from `5b3609d8` |
| Astra's 17-scenario differential at both modes (`astra-differential.test.js`, unmodified, `17e724ad…`) | | | **34/34 identical** (17 per mode); its 4,000-case `buildSetDefaultOptions` row and prompt byte-equality rows pass; 76/76 rows |

The base already has T1a-2a's registry fast path, so the traced cases are compared raw (every database operation in order), not through her classifier. Astra's harness ran at `b9cab98d`; `82693acb` adds only a test baseline entry.

### 4.4 Full suite, lint gate, build, rules suite (Linux, the code head)

All on WSL Ubuntu, in a private worktree of `~/pd-ci`, on Node 20.20.2, with the install matching the lockfile (`40382e64edb6`) and `TZ=UTC`. The suite ran alone under the lock.

| Check | Command | Result |
|---|---|---|
| Full suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | **exit 0** · `Test Files  1507 passed \| 12 skipped (1519)` · `Tests  33915 passed \| 135 skipped (34050)` · 298.70 s · log SHA-256 `806c1354…` |
| Lint gate | `npm run lint:gate` | exit 0 (`--max-warnings 0`) |
| Production build | `npx vite build` | exit 0. The `dist/` of 113 files is **byte-identical** to the base's build (`dist` hash list `a0a5c84d…` on both). The four CSS warnings come from comments in existing `src` CSS and appear on the base too |
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
| NF-1 | The C2 cutoff (the session's end) also stopped a LIVE close. A wind-down requested at 16:05 was not completed by that day's 16:25 close, and a Friday 16:01 request held a cap slot over the weekend. The `<` boundary was pinned only by source text | should-fix (the refuter: needs a ruling) | Fixed by reading E12 to the letter (R-20). The cutoff is the end of the session's close window (18:00 Eastern; 15:00 on an early close), the latest moment its on-time close can run. So a caught-up session still closes as its on-time close would have (C2's rows unchanged), and a live close after a 16:05 request completes the wind-down. Rows: 16:05, a Friday at 16:01, and 17:59:59.999 caught up; C2's 18:00 row pins `<` in behaviour. Stated as a reading, not asked |
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
