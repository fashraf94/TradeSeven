# Build B4 — the first group's books

**Date:** 26 Nov 2026 · **Branch:** `claude/practice-field-b4-group-books` · **Base:** `main` `22b01810` (the #1114 merge; `origin` fetched first, the worktree cut from it, tree clean) · **Code head:** `988c65e2` · **Final checks at:** `717880cc` (one test row after the code) · **PR:** the draft PR opened from this branch (this report is its last commit)

**State:** built; reviewed (three lenses and a refuter; every finding fixed, recorded or put to you below); battery 50 of 50 killed; final checks all exit 0 — the Linux suite 38,748 passed and 0 failed, the lint gate, the build, the rules suite 889 of 889 (§6). **Nothing changes for you on merge if you do step 1 of §8 first.** Not merged; CI not watched.

| Rule | Held |
|---|---|
| The two attached files committed first, byte-identical, each with its `docs/README.md` row | Yes. `12706eaa`; both SHA-256 values verified on the committed blobs. Context only: nothing in either is built here. |
| No fenced file; no rules or index change; no change to `PRACTICE_FIELD_MODE` or the three switches | Yes. Every new read and write is the Admin SDK's. |
| No change to what an idea costs, holds or earns | Yes. No hunk in admission's arithmetic, sizing, the close, the ledger, settlement, exits, entry, spend or the agent's tool and prompt. Admission changes only which list it asks (`mode.js`). Review lens B checked every hunk. |
| No real Firestore, model or EODHD call; no `.env` read | Yes: the in-memory harness, the fake transport and fixtures throughout. |
| Your live book untouched by merging, provided your uid is on the new list | Yes, proved (§5): with this build's code and main's two constants, your book's 13-session agent run is main's pinned dump byte for byte. With this build's constants, only a version stamp on ideas admitted after the merge differs (pinned too). |
| One draft PR; no merge; no CI watching | Yes. |
| B5's files untouched (`bookView.js`, `bookViewCopy.js`, `bookViewRead.js`, `api/practice-field/book.js`, their tests, `src/components/PracticeField/`) | Yes. New endpoint rows are in a new file. The script **imports** `bookView.js`'s `sessionsLeftOf` (read, never edited) so the three counts are one. |

## 1. In plain terms

**What you get.** You can open a book for each player in the first group, watch every book in one command, and step in on any of them.

- **A list of the idea book's own.** `PRACTICE_FIELD_PLAYER_UIDS` (Vercel and your `.env.local`) decides who can have a book, have ideas admitted, and see the screen. The cockpit's list no longer decides anything in the idea book.
- **A book for a player.** `create-book-for --owner <their uid>` makes the book theirs, for their own ranked agent and its archetype — or another archetype if you name one. Only you can do it, and only for a uid on the list. A player can never create one.
- **Your reach.** `pause`, `resume`, `wind-down` and `resolve` take `--owner`, and act on that player's book — even after you remove them from the list. The record still says you acted.
- **Room for twelve.** The cap went from 4 to 12.
- **Fair checks.** The agent's desks visit the books in a different order each session, so a close that runs out of time doesn't leave the same books unchecked every day.
- **One overview.** `books` prints one line per open book: the owner, state, value, last close, each desk's latest check ("not_checked" when the window never reached it), the month's spend, and the open records waiting on you, those first.
- **Two script fixes.** Sessions left now says what the agent and the screen say (it counted one more). The parse-report alerts no longer list names admitted after that session's report was written (your 15 alerts on 25 Nov).

**Players never act.** No player-facing control was added. The Film Room's nomination stays closed to players: at `'allowlist'` it answers only for you.

**Twelve books on an ordinary day.** With 30-second calls, every desk of twelve books is checked within 4 or 5 of the close window's 7 fires. The limit, on the same model, is about 50 seconds a desk all-in (§4). If every call timed out, only 6 or 7 desks would be checked; the rest show "not_checked" in `books`.

**What you need to do.** Put your own uid in `PRACTICE_FIELD_PLAYER_UIDS` in Vercel's production environment **before** you merge (§8). Without it, your book stops drafting and your screen disappears until it is set and production redeploys.

## 2. What was built

### 2.1 The player list (B4-1) and the seam's gate (B4-5)

| Where | What |
|---|---|
| `api/_utils/practiceField/playerList.js` (new) | `PRACTICE_FIELD_PLAYER_UIDS` and `MANDATE_FOUNDER_UIDS`, each read at call time (`readPracticeFieldPlayerList`, `readPracticeFieldFounderList`), never at module scope, never cached, never throws; one parser (`parseUidList`, the cockpit reader's rule). Zero imports. Unreachable from `src/` (a test walks it). |
| `api/_utils/practiceField/mode.js:64-69` | `practiceFieldAdmits`: at `'allowlist'`, the player list alone. |
| `mode.js:77-81` | `practiceFieldSeamAdmits`, the seam's own gate: at `'allowlist'`, a uid the first gate admits **and** on the founder list; at `'on'` and `'off'`, the first gate unchanged. The header says who each gate admits. |
| `api/_utils/practiceField/bookStore.js:39` | `bookForOwner` asks `practiceFieldSeamAdmits`. Still import-light: it reaches `mode.js`, `playerList.js`, `mandateBookKind.js` and the two flag modules, never `founderControls.js` (a test pins the closure). |
| `founderControls.js:93-95` | `founderAllowlist` delegates to the one parser (a test checks every value against it). |

Admission (`admission.js:400`, `:493`), creation (`ideaBook.js:206`) and the screen (`api/practice-field/book.js:40`) all ask `practiceFieldAdmits`, so none of them needed an edit.

### 2.2 `create_book_for` (B4-2, B4-3)

`api/_utils/practiceField/founderControls.js`:

| Where | What |
|---|---|
| `:81`, `:83` | `create_book_for` joins the actions; `OWNER_ACTIONS` names the five that take an owner. |
| `:302-329` `createBookFor` | Body `{ ownerUid, agentId?, archetypeCodeId? }`. A new request: a named archetype checked against the registry (`ideaBook.js:68 isKnownArchetypeId`), the owner on the player list, then the owner's own ranked agent (the create_book rule on the owner's agents: exactly one, or the one named; never a clone, never yours). The archetype is that agent's own unless you name one. Anything refused here records nothing. The request is recorded under **your** key, with the owner in its target. A pending request (interrupted before its book was made) checks the list again when it re-runs. |
| `:116-118` `createForOpIdOf` | The engine's operation id, `for#` + a digest of (you, the key). `#` is a character no request key may hold, so it can never be a `create_book`'s operation, and the book can never be one the owner's own `create_book` would make. |
| `:160-172` the fingerprint | The owner and `create_book_for`'s choices join it **only when present**: a request that names no owner keeps main's fingerprint exactly, so every record you stored before B4 still replays (a test rebuilds main's function and replays a main-shaped record). One key can never create books for two owners. |

`createIdeaBook` still enforces one open book per owner, the cap and the reconciliation; nothing there changed. A test makes the book with a named archetype and checks the epoch freezes it, while the agent's own archetype is untouched (IP-3).

### 2.3 Your reach (B4-4)

| Where | What |
|---|---|
| `founderControls.js:416-433` `runFounderAction` | The owner is checked before any read: only `OWNER_ACTIONS` take one (`create_book` and `admit_fixture` naming one are refused `owner_not_accepted`); `create_book_for` needs one; an id that is not 1–128 printable characters, holds `/`, is `.`/`..` or starts with `_` (the registry is `_registry`) is refused `owner_uid_invalid` (`validOwnerUid`, `:106`). |
| `:375-409` `applyControl`, `:187-232` `applyResolveHold` | With an owner: that owner's claim and book (checked as `ownBookOf` checks it: an idea book, the owner's own). Who acted stays you: `windDown.requestedBy`, the ruling's `by`, the request record (under your uid, its target `{ ownerUid, bookId }`). A replay answers its stored response and never moves to another book. The owner need not be on the list. |
| `api/practice-field/founder.js` | Comments only. |

### 2.4 The cap (B4-6)

`src/data/practiceFieldSlots.js:16`, `:50`: `PRACTICE_FIELD_SLOTS_VERSION` 2 → 3, `B8_FOUNDER_BOOK_CAP` 4 → 12. Nothing reads a stored `slotsVersion` or the registry's stored `cap` (lens B grepped `api/`, `src/`, `scripts/`; the cap is read only at creation, from the constant).

### 2.5 The pass at twelve books (B4-8)

`api/_utils/practiceField/agentRun.js`:

| Where | What |
|---|---|
| `:564-568` `agentPassOrder` | The page sorted by the SHA-256 of (the session, the book's id). The same order on every fire of a session (so the next fire picks up where the last stopped), a different one each session, every book once. No clock, no randomness. |
| `:584-589` | The pass iterates it. The book's reference is taken by its literal collection (the same document as `docSnap.ref`) so the protected-store scan still resolves the lease's writes to `mandates`. Nothing else about a desk's check changed: one call per desk, the lease, the reservation, the deferral. |

The page (25) is above the cap (12): every active book is on it (pinned).

### 2.6 The founder script (`scripts/practice-field-founder.mjs`)

| Where | What |
|---|---|
| `:129-152`, `:212-249` | `--uid` stays the acting founder; `--owner <uid>` names the player (status, resolve, pause, resume, wind-down; required by `create-book-for`; refused by admit, create-book and books). An `--owner` the door would refuse is refused before anything is read. |
| `:280-293` `bodyWithoutKey` | `create_book_for`'s body; the owner joins other bodies only with `--owner`, so every request key without it is unchanged. |
| `:588-618` `runBooks` | `books`: reads the founder cap's registry (the list of open books; read only — a registry pin row now names the script as a reader), each book, its open ideas and its last close row. One line per book, books with open records first. |
| `:575-580` `deskSourceOf` | `model`, `code_fallback`, `no_work`; `not_finished` for a desk part still in progress; `not_checked` when the close row holds no part for the desk. |
| `:506-517`, `:756`, gate lines | `status` says whether the owner (`--owner`, else `--uid`) is on the player list **on this machine**, and adds the sentence: "The deployed app reads its own copy of the list: a change there needs a production redeploy." The cockpit line is gone. `create-book-for` says the same at the moment it creates. |
| `:381-383` `sessionsLeft` (Q-7) | Counts from the book's last close with the screen's own function (`bookView.js sessionsLeftOf`): the sessions after the last close up to the due one — the agent's count. |
| `:436-457` `parseAlertsOf` (the alerts fix) | The cut-off is the session's daily build (`mandateUniverseDaily/{session}.builtAt` — a Date or a Firestore Timestamp), else the session's close. A symbol only an idea admitted after it needs is excused when its entry is **missing**; an entry the report holds that is not clean still alerts. An idea with no readable `admittedAt` counts (fail closed). The status names the ideas admitted after the report. |

The script's own rules stand: `--go`, the request key, `--again`, no credential printed, nothing read for a uid that is not a founder.

### 2.7 Tests and support

New: `playerList.test.js` (19 rows), `b4GroupBooks.test.js` (36), `api/practice-field/book.players.test.js` (3), `agentPassAtTwelve.test.js` (7), `foundersLiveBook.test.js` (5), `scripts/practice-field-founder.b4.test.js` (17). B2's 13-session run moved unchanged to `__testsupport__/agentEndToEndRun.js` (only exported, the agent switches' restore handed back, its one `expect` a throw, an `afterSeed` hook) and its saved-thesis fixture to `__fixtures__/savedThesis.js` (it spells the Shared Research card's field, which a census allows only in two product modules and skips in fixtures). Updated rows: the list's name in `ideaBook`, `admission`, `founderControls`, `astraConfirmation*` and the script's tests; the version and cap pins; the two end-to-end dumps (§5); a registry pin row (the script reads the registry).

## 3. Readings and questions for you

### 3.1 Readings (built as described; say if you want it otherwise)

| # | Reading | Why |
|---|---|---|
| R1 | **The seam at `'allowlist'` answers for a uid on the founder list AND on the player list** (B4-5 says "only a founder"). A founder taken off the player list gets no nomination. | It narrows the mode's own gate and never widens it; that founder's drafts are refused anyway. Lens A and the refuter found it defensible. |
| R2 | **`create_book_for` needs the owner on the player list at every mode**, `'on'` included, where `createIdeaBook` alone would admit anyone. | B4-2's letter: "The player must be on the list." |
| R3 | **`create_book` and `admit_fixture` refuse a body that names an owner** (`owner_not_accepted`) rather than ignore it. | So a book can never be made for you when you meant a player, nor an idea admitted to the wrong book. |
| R4 | **An owner id must be 1–128 printable ASCII characters, with no `/`, not `.`/`..`, not starting with `_`.** | It becomes a document id under `practiceFieldBooks/`; `_registry` lives there. Firebase uids fit. |
| R5 | **The version bump stamps 3 on ideas admitted to your live book after the merge, while the book and its epoch keep 2** (B2's precedent, R-14). The registry's `cap` becomes 12 at the next creation. | "Every idea freezes the version it was admitted under." Nothing reads either; the merge itself is pinned (§5). |
| R6 | **The pass's order is a per-session hash, not a rotation.** A book's place changes every session; there is no fixed bound on how many sessions running a book can be last when time runs out. | Simple, deterministic, independent of how many books are open. With ordinary calls every desk is served anyway (§4). |
| R7 | **`create_book_for`'s request is recorded under your uid** (`practiceFieldBooks/{you}/founderOps/{key}`), the owner in its target. Two founders using the same key for two owners would make two records. | One key never creates books for two owners under one founder; the founder list is you. |
| R8 | **A pending `create_book_for` re-checks the list when it re-runs**; if its book was already made, that book is the answer. | Review A3. |

### 3.2 Questions

| # | Question | My lean |
|---|---|---|
| Q-1 | **Removed players' books keep costing.** The desks still check a removed player's book every session (holds and exits still act), but every draft is refused, so the drafting share of each call is wasted until the $3 monthly bound. Today's remedy is to pause or wind down the book when you remove the player. Should the desks stop offering empty slots for an owner the list does not admit? (Review C2; it changes the desks' work, so it needs your ruling.) | Yes, later: offer no slots for an unlisted owner. Until then, pause when you remove. |
| Q-2 | **Your uid on a player's documents.** When you wind down or rule on a player's book, `windDown.requestedBy`, the ruling's `by` and later `resolvedBy` hold your uid on documents the player can read (Firestore rules). No screen shows them, and uids are already readable by any signed-in user. Keep, or record you as `founder` there? (Review A2.) | Keep: B4-4 asks the record to say who acted. |
| Q-3 | **When every call times out**, the window checks 6–7 of 24 desks and charges each timed-out attempt its whole reservation ($0.1625). A book whose two desks time out daily would spend ~$0.65 a day and reach the $3 bound in about five sessions. Accept, or stop retrying a timeout? | Accept for launch; it is the same per book as today. |
| Q-4 | **The pass's tail after the window's last call** (review C4). After the first deferral the pass still reads each remaining desk's prompt inputs before its deadline check (about 200 reads in the worst fire). With a last call that times out at ~275 s, that tail could take the fire past its 300 s limit: its log and that fire's retention run are lost; no money moves. The cheap fix is to check the deadline before those reads. A later change? | Yes, a small follow-up. |
| Q-5 | **Five names on the engine's price list are not pickable stocks** (ADI, EA, TGT, BRK.B, PYPL): the agent's candidates already drop them. Report only. | No change. |
| Q-6 | **Sessions left for an idea admitted at the last close** reads N+1 ("31 left" for a 30-session idea): its start is session 0. The agent's prompt says the same; the screen shows "entering" with no number. Wording only. | No change. |

## 4. The three measurements

All on the harness (`agentPassAtTwelve.test.js`) with a fake transport and an injected clock; each row prints a `PF_B4_MEASURE` line.

**The window.** `vercel.json`'s `*/15 14-22 * * 1-5` walked through `activeCloseTick`: **7 close fires** (16:15 to 17:45 ET in December; 7 on an early close too). Each fire has 290 s; a desk's call starts only while the clock plus the call's 110 s timeout plus a 15 s margin fit, so **no call starts after 165 s into a fire**, whatever the call then takes.

**1. Twelve books, both desks with work, each call 30 seconds.**

| First fire starts the pass at | Later fires at | Fires until all 24 desks are checked | Calls per fire |
|---|---|---|---|
| 0 s | 0 s | 4 | 6, 6, 6, 6 |
| 60 s | 5 s | 5 | 4, 6, 6, 6, 2 |
| 120 s | 10 s | 5 | 2, 6, 6, 6, 4 |
| 160 s | 10 s | 5 | 1, 6, 6, 6, 5 |

The first fire also builds the close snapshot and closes twelve books, so the pass starts late in it; later fires skip the closed books and reach it at once. **Every desk is checked, one call each, in every case.** No stop.

**The limit (review C3).** On the same model, all 24 desks are checked up to **50 seconds a desk all-in**; at 55 seconds, only 19–20. The model is a ceiling: reads and writes take no time, the fake answers draft nothing (no admission work), and every fire is assumed to reach the pass (a failed close snapshot loses one). Real figures can be read off your own close rows (`settledAt − reservedAt` on each attempt) once your desks run.

**2. Every call timing out at 110 seconds.**

| First / later offset | Desks checked in the window | Desks with no check | Books with no desk checked | Timed-out calls charged |
|---|---|---|---|---|
| 0 s / 0 s | 7 | 17 (no part on the close row) | 8 | 14, $2.275 in all |
| 120 s / 10 s | 6 | 18 (17 no part, 1 in progress) | 9 | 13, $2.1125 |

Each fire serves one desk: two timed-out attempts (the one retry), then the code-built note ("The agent could not complete today's check; nothing changed."). The desks served are the first in that session's order; the next session serves others. **What the record says:** the close row holds **no part** for a desk the window never reached (a deferral reserves and writes nothing), or a part `in_progress` after one attempt. **What `books` says:** `not_checked`, or `not_finished`. That session is never revisited; the next close checks the book afresh.

**3. The union of symbols twelve fully drafted books reserve.** Every stock of the agent's price list (the engine's 136-name universe less five that are not pickable: 131), spread over 12 books × 3 ideas × 4 names, each book's medium idea against its sector fund, SPY the benchmark — through the coverage module's own reservation functions: **143 symbols reserved (131 stocks, 12 funds); the shared build needs 148 of `MANDATE_UNIVERSE_MAX_SYMBOLS` 300.** Even with every fund reserved it would be 151. While every name comes from the price list, twelve books cannot press the cap.

## 5. Rule 5: your live book

`foundersLiveBook.test.js`, B2's 13-session run of your book with the agent on (moved to test support unchanged), at `'allowlist'`, nobody on the cockpit's list:

| Row | Result |
|---|---|
| **This build's code, main's two constants (version 2, cap 4), you on the new list** | The final store is **main's pinned dump, byte for byte** (`c1fca0d6…`, 830,894 bytes). |
| **The merge itself:** your book and your medium idea made under main's constants, the 13 sessions under this build's | `bede24af…`, 830,894 bytes, pinned. Against main: the same leaves, and the ONLY 9 that differ are the slots version on the three ideas the desks admitted after the merge (contract and admission packet, 2 → 3) and those packets' hashes. Your book, its epoch, your idea and the registry keep version 2 and cap 4. |
| **The control:** you on the cockpit's list only | Creation is refused `mode_not_admitted`: the pin above depends on the new list. |
| **You off the list** (after your book and idea were made) | The desks still check the book and code still closes it every session and sells at its line (BAC fell 12%: sold; JPM and GS held). Every draft that reaches admission is refused `mode_not_admitted`; no idea is admitted. |

Also: with the two constants set back on this tree, the two end-to-end dumps reproduce main's pins exactly (`endToEnd` `f5ed5c96…`, `agentEndToEnd` `c1fca0d6…`). At this build's constants they are re-pinned (`61b94327…`, 443,534 bytes; `d45565ab…`, 830,895 bytes), and leaf-compared: the same leaves, only the slots version, the packets' derived hashes and the registry's `cap` differ (12 and 15 leaves). Lens B reproduced both independently.

## 6. Tests and checks

**New rows** (§2.7): 87 in six new files, each run green. **Changed rows:** the list's name, the version and cap pins, the two dump re-pins (§5), one registry pin row.

**The final checks**, at `717880cc` (the code is `988c65e2`'s; one test row added), in a private WSL worktree of `~/pd-ci` (Node 20.20.2, its own `npm ci`, lockfile `6d01297094c2`), `main` unchanged since the base (`22b01810`, fetched again before the run):

| Check | Command | Exit | Result |
|---|---|---|---|
| The Linux suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | 0 | Test Files 1,671 passed, 14 skipped (1,685); Tests 38,748 passed, 0 failed, 197 skipped; 399 s |
| The lint gate | `npm run lint:gate` | 0 | `eslint . --config eslint.gate.config.js --max-warnings 0`: clean |
| The build | `npx vite build` | 0 | built in 43 s (only the tree's standing CSS and chunking warnings) |
| The rules suite | `npm run test:rules` | 0 | Test Files 48 passed (48); Tests 889 passed (889) |

The first full suite (at `7f63540b`) failed 5 rows: three rows of the two guards §7 names (fixed in `aa56b04d`), and two timing rows — `gemmaClient.test.js`'s abort row and a `bookView.test.js` row at 5.7 s against its 5 s limit — that passed alone at once (88 of 88) and in the final suite.

**Time:** about 2 hours 10 minutes, from the start (26 Nov, about 10:00 CST) to this report (about 12:10). The 6-hour checkpoint was not reached.

## 7. The review

BUILD_RULES §2 in full (30 files, about 2,600 lines of code and tests): three lenses and one refuter, each on its own LF `git archive` of the build (`7f63540b`), read-only on git and the shared tree; then the fast battery on the frozen code.

- **Lens A — who is admitted to what, and privacy across owners.** No blocker: no player reaches a write, your reach or another owner's book; every owner-targeted action reaches only the named owner's own idea book; no answer carries one owner's id or text to another. 21 scratch rows. It found R1 (the seam reads founder AND player list) defensible.
- **Lens B — no money path changed; your live book as on main.** No blocker: every product hunk named and none can move a figure; nothing reads a stored `slotsVersion` or the registry's `cap`; the rule-5 proof is real (its mutants of the pass and the gate are killed by it); both re-pins' leaf-compare claims reproduced exactly; B2's run truly unchanged by the move.
- **Lens C — the pass at twelve books, and the script.** No blocker: the order is deterministic per session, a permutation, different between sessions, and the next fire picks up correctly; the fire model matches the cron; the figures reproduce; the script's keys, gates and outputs hold.
- **The refuter** judged every finding with its own repros: **none refuted, seven narrowed** (A2's severity lowered to a nit), none at the blocker bar.

| id | What | Severity (refuter) | Disposition |
|---|---|---|---|
| A1 = C1 | The script's header said the deployed app's list decides a `create-book-for`; the script runs the door in its own process, so this machine's copy does | minor | **Fixed** `988c65e2`: the header says so, and `create-book-for` prints which copy decided and the redeploy sentence (row). Your step 3 says keep both the same. |
| A2 | Your uid lands on a player's book and ideas (`windDown.requestedBy`, a ruling's `by`), which the player can read | nit (narrowed: uids are already readable by any signed-in user) | **Question Q-2.** |
| A3 | A pending `create_book_for` re-ran without re-checking the list | nit (narrowed: only at `'on'`, after a crash and a removal) | **Fixed**: the re-run checks the list; a book the interrupted run already made is answered (rows). |
| A4 | The seam's header still named the cockpit list | nit | **Fixed** (comment). |
| A5 | Owner ids accepted C1 controls and zero-width characters; the script read `practiceFieldBooks/{--owner}` before the door checked it | nit | **Fixed**: printable ASCII only; the script refuses a bad `--owner` before any read (rows). |
| A6 | A named archetype was checked before the stored request, so a replay could answer 400 after the registry dropped it | nit | **Fixed**: checked only for a new request (row). |
| B1 | At `'allowlist'` every live-book gate reads the new list; Vercel applies it only to a new deploy | major (operations) | **§8 step 1**, and the PR's first line: set it before you merge. No code change. |
| B2 | The rule-5 row proved this build with main's constants, not the merge itself | nit (narrowed) | **Pinned**: the merge row (`bede24af…`, only 9 version-stamp leaves differ), reproduced by lens B, the refuter and this build. |
| C2 | A removed player's book keeps paying for desk calls whose drafts are all refused | nit (a ruling) | **Question Q-1**; until then, pause on removal (§8 step 5). |
| C3 | The 30-second figure is a ceiling; the break-even was unmeasured | nit (narrowed) | **Measured**: row 1b prints the break-even (50 s a desk); §4 states the model's limits. |
| C4 | After the first deferral the pass still reads every remaining desk's prompt inputs before its deadline check; a worst fire could overrun 300 s (no money effect) | nit (narrowed: pre-existing; the cap makes it ~3× longer) | **Question Q-4**, not fixed here: the fix changes the desk's check, which this build may not. |
| C5 | One assertion could not fail | nit | **Fixed** (removed; the live check is the 24 desks). |
| C6 | The alerts fix could hide a dirty entry for an idea admitted just after the daily build | nit (narrowed) | **Fixed**: only a missing entry is excused (rows, with a Timestamp `builtAt` and a missing `admittedAt`). |
| C7 | Sessions left shows N+1 for an idea admitted at the last close | nit (not a defect) | **No change**: the agent's own count (Q-6). |
| C8 | `not_checked`'s comment named one cause of several | nit | **Fixed** (comment). |

**What the full suite caught, not the review:** the first full Linux suite (at `7f63540b`) found two guards this build had tripped. The protected-store scan could no longer resolve the agent pass's lease writes once the books were reordered; the Shared Research census caught the moved fixture spelling the card's field. Both fixed in `aa56b04d` without touching either guard's allowlist.

**The battery** (`scripts/practice-field/battery/run-battery.mjs`, tiered, 4 trees, `--prior` the 23 Nov battery's results, the idea book's rows plus both script suites and the slots pins: 1,929 rows in 64 files): **50 mutants, one per guard this build adds** (the two gates, the list reader, `create_book_for`'s checks and namespace, the fingerprint both ways, each owner path's target and record, the cap both ways, the pass's order and its session key, and every script fix). At the frozen code `988c65e2`: **49 killed, 1 survived** in 13.1 min. The survivor (SC10: a `--owner` command keyed on your own book instead of the player's) was a real gap: after a player's book closes and a new one opens, `pause --owner` would have replayed the old answer. The row was added (`717880cc`, test only) and SC10 re-run alone: **killed**. **50 of 50.**

## 8. Your steps, in order

1. **Before merging:** set `PRACTICE_FIELD_PLAYER_UIDS` in Vercel's **production** environment, holding your own uid, and put the same line in your `.env.local`. Without it your own book stops drafting (every draft refused) and your screen disappears, until it is set **and production redeploys**. (Review B1: Vercel applies an environment change only to a new deployment, so it must be there before the merge's deploy is built.)
2. **Merge**, and let it deploy. Open your screen; then run `status --uid <you>` and check the line `player list     yes`.
3. **To add a player:** add their uid to both places (Vercel and `.env.local`), **redeploy production**, then run:

   `node scripts/practice-field-founder.mjs create-book-for --owner <their uid> --uid <you>` (prints what it would send), then the same with `--go`.

   The script decides by **your machine's** copy of the list and the app by Vercel's: keep them the same (review A1). Add `--agent <agentId>` if they have two ranked agents, `--archetype <id>` to give the book another archetype.
4. **Each evening:** `node scripts/practice-field-founder.mjs books --uid <you>`. Books with open records come first; for any of them, `status --owner <their uid> --uid <you>` lists the records, and `resolve --file <ruling.json> --owner <their uid> --uid <you> --go` rules on one.
5. **To remove a player:** take their uid off both lists and redeploy; then `pause --owner <their uid> --uid <you> --go` (or `wind-down`) so their desks stop spending (Q-1).
