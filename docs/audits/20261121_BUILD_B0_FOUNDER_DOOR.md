# Build B0 — the founder's command-line door, and the flip PR (prepared, not merged)

**Date of the run:** 21 Nov 2026 · **From:** the Practice Field chat (Practice Field PF-1, ruled 20 Nov) · **Base:** `origin/main` at `4037df59` (it includes #1098 and #1101), after `git fetch origin` at the start of the session · **Builder:** Claude Code (Opus), worktree `practice-field-b0-founder-door-b0ee99`.

## 1. Verdict

| | |
|---|---|
| **PR 1 — the script** (`claude/practice-field-b0-founder-door`) | `scripts/practice-field-founder.mjs` runs the door's founder actions from your own checkout: `status`, `create-book`, `admit` (with `--dry-run`), `resolve`, `pause`, `resume`, `wind-down`. Every write goes through `runFounderAction`, the function the HTTP door calls, at one call site, behind three gates: the mode is not `'off'`, your uid is on `MANDATE_FOUNDER_UIDS`, and `--go`. **No file under `api/` changed.** No fenced file, rule or index changed. |
| **PR 2 — the flip** (`claude/practice-field-flip-allowlist`) | `PRACTICE_FIELD_MODE` goes from `'off'` to `'allowlist'`, with its pin row and the flag's own "shipped value" docstring. Nothing else. **Its full suite has 7 red rows** (§6.2): they pin the old shipped `'off'`. |
| **The reconciled flip** (`claude/practice-field-flip-allowlist-reconciled`, no PR) | It is the same flip plus, in the same commit, those 7 rows saying `'off'` outright instead of "the shipped value" (BUILD_RULES §2). No assertion moved. Its full suite is green (§6.2). **Q-1 asks which one you merge.** |
| **The quarterly product at `'allowlist'` with no idea book** | Unchanged (§6.3). The real eval, close and rollover sweeps on quarterly-only stores give the same writes, answers, model calls, quotes and reads at `'allowlist'` as at `'off'`. The one addition is a single read of the Practice Field registry per fire. |
| **Refuter** | It found no write without all three gates, and nothing sent that the HTTP door would refuse. It confirmed two other defects, both fixed and pinned (§5): F1, a stored refusal replayed forever, and F2, the direct-run check. |
| **Calls from this session** | No Firestore write, model call or EODHD call. Every test ran on the in-memory harness. No `.env` file, environment variable or credential was read. |

## 2. What the script is, in plain terms

The idea book's money engine has one door for you, `POST /api/practice-field/founder`. That door needs a Firebase sign-in token, and no screen sends one yet. The script is a second door to **the same room**. It builds the same request the web door would receive and hands it to the same function (`runFounderAction`, `api/_utils/practiceField/founderControls.js:361`). So every check the door makes is made: ownership, the one-open-book rule, the founder cap, admission's dozen checks, and the replay of a request already answered. The script itself never writes to the database.

It runs on your machine, with your `.env.local` (the Firebase service account, as for every founder script). That means two things:

- **The mode** is read from your checkout's `src/config/practiceFieldFlags.js`, not from the deployed app. Run it from `main` once the flip is merged and deployed.
- **The founder list** (`MANDATE_FOUNDER_UIDS`) and the cockpit list (`COCKPIT_ALLOWLIST_UIDS`) are read from your machine's environment. A variable set in the shell wins over `.env.local`.

The gates are a seatbelt, not a lock: the service account is what grants access. Unlike the web door, the script has no rate limit, and its clock is your machine's.

## 3. The commands, with one worked example each

Every write command prints what it would send and stops, unless `--go` is given (exit 2, "not sent"). `--json` gives the same answer as JSON.

**`status`** reads only.
```
node scripts/practice-field-founder.mjs status --uid <uid>
```
It prints:
- the mode and where it was read;
- whether your uid is on the founder list and on the cockpit list;
- the book: state, drafting, cash, the agent, the last close;
- each of the three slots: the idea's names, its status, its comparison, capital and cash, its lines (price levels once entered, the planned distance before), and the sessions left through the due session, today included;
- every **open record** you can rule on, with its idea, kind, record id, symbol, reason and the decisions it takes. A record already ruled, waiting for the next close, is marked so;
- the parse report of the last closed session, for the book's own symbols only.

It prints no other player's ids: the registry, which lists every open book's owner, is never read. Tested in text and JSON.

**`create-book`**
```
node scripts/practice-field-founder.mjs create-book --uid <uid> --go
```
It creates your idea book for your one ranked agent. With two ranked agents the door answers `409 ranked_agent_ambiguous` and names them; then add `--agent <agentId>`.

**`admit`**, dry run first, then `--go`:
```
node scripts/practice-field-founder.mjs admit --file my-idea.json --dry-run --uid <uid>
node scripts/practice-field-founder.mjs admit --file my-idea.json --uid <uid> --go
```
The dry run runs **the door's own admission** (`admitIdea`, `admission.js:348`) on a read-only view of the database: every read is real, and every write is caught and thrown away (`readOnlyView`). So its answer is the door's, not a copy of the door's checks. It prints:
- what would be refused, and why (every refusal with its detail);
- the permitted maximum and what binds it;
- the idea's start and due sessions;
- what it would write;
- whether each name, the comparison and SPY are priced on the latest price list. An unpriced name is not refused by admission, but the entry needs a price.

If `--go` would meet an answer already stored under the same key, the dry run says so first (§5, F1).

Start from `scripts/practice-field-founder.examples/medium-idea.example.json`: JPM, BAC and GS against XLF, medium slot, lines 10% below entry, $25,000. Its `_notes` explain every field and are never sent.

**`resolve`**
```
node scripts/practice-field-founder.mjs resolve --file ruling.json --uid <uid> --go
```
It sends a `resolve_hold` ruling. Only the fields the door reads (`ideaId`, `kind`, `recordId`, `decision`, `ratio`, `payload`, `actionId`) are taken from the file. A file's own `action` or `requestKey` never reaches the door.

There is one example per kind in `scripts/practice-field-founder.examples/` (`resolve-late-adjustment`, `-conflict`, `-suspicion`, `-coverage-gap`). Each names the required fields in its `_notes`. Copy the ids from `status`.

**`pause`, `resume`, `wind-down`**
```
node scripts/practice-field-founder.mjs pause --uid <uid> --go
```
These are the door's controls on your open book.

**Re-running and `--again`.** The request key is derived from what is sent and the book, so running the same command again is the door's own replay: it answers the stored response and changes nothing (printed `REPLAY`). The door stores a **refusal** the same way. A request refused for a passing reason stays refused on every re-run, and so do a second pause after a resume and a new `create-book` after a book has closed. Examples of a passing reason: a paused book, a list not yet updated, a close still owed. Add `--again <word>` to send such a request as a new one (§8, Q-2).

**Exit codes:** 0 done; 2 refused (by a gate, by the door with its error and every refusal printed, or not sent for want of `--go`); 1 failed (a bad argument, a bad file, an error).

## 4. The tests

`scripts/practice-field-founder.test.js` has 81 rows, all on the in-memory harness:

- **The command line:** 15 bad lines refused before anything is touched (an unknown, misplaced, repeated or misspelt flag; `--go=yes`; `--dry-run` with `--go` …); `--help` touches nothing.
- **The gates:** for each of the six write commands, mode `'off'` and a uid off the founder list each refuse alone, with a database that fails the row on any read. Without `--go` each prints its exact body and writes nothing. `status` and the dry run are gated too. The lists are read at call time.
- **Each command with `--go`:**
  - create, admit (the shipped example), pause, resume, wind-down and resolve;
  - the door's refusals passed through with their codes: `ranked_agent_ambiguous`, `slot_occupied`, `no_open_book`, `record_not_found`;
  - a replay that writes nothing;
  - the resolve whitelist.
- **`admit --dry-run` is the door:** eight cases compare the dry run's refusals, permitted maximum and binding constraints with what `--go` then answers, exactly, and the dry run writes nothing in any of them. The cases:
  1. a clean admission;
  2. an occupied slot;
  3. capital over the slot cap;
  4. a malformed contract;
  5. a name another idea holds;
  6. `'allowlist'` with the uid off the cockpit list;
  7. a close owed;
  8. a held name with no mark.

  One more row: a contract asking another origin is forced to a founder fixture by both.
- **`status`:**
  - a book with an entered, closed idea: slots, lines, sessions left, the parse alerts of its own symbols (a rejection on a symbol it does not hold is not printed);
  - **no other user's ids**, in text and JSON;
  - the sessions-left count across a weekend and Thanksgiving.
- **The records `status` lists are the door's records:**
  - **Round trip.** 56 corporate-action histories from the sequence harness run, and on every idea state each listed record id is handed to the door's own ruling planner (`planHoldRuling`). It is always found; a ruled one answers "already resolved". The histories are the fixed cases, the late cases, Astra's T2E cases, 24 generated ones and an A-5 refused split.
  - **Reach.** Every kind is reached: suspicion 58, conflict 430, coverage gap 66, late adjustment 73, ruled 81. That covers every conflict reason (`conflicting_action`, `possible_redate`, `revised_after_ruling`, refused share basis) and both coverage shapes (an open gap, a sold holding's doubt).
  - **End to end.** `status` lists a record, and `resolve --go` with its id is recorded by the door.
- **The examples:** the idea normalises clean and admits end to end. Each ruling, on an idea without the record, passes the door's field checks to `record_not_found`. Each kind's decisions as printed are the door's.
- **The script's source:** no write call of its own (`.set(`, `.update(`, `.create(`, `.delete(`, `.batch(`, `.runTransaction(`, `.add(`); exactly one `runFounderAction(`; credentials loaded only in `productionDb`; no shebang.
- **A stored refusal and `--again`** (F1), and **the direct-run check** (F2): see §5.

**Mutation battery** on the final code. Each mutant breaks one guarantee, the file runs, and the mutant is judged by the exit code: **27 of 27 killed.** The 23 mutants of the first round cover the three gates, the resolve whitelist, the dry run on the real db, `_notes`, the key's book, each record source, the ruled flag, the forced origin, sessions left, the exit codes, the replay's book-now line, the price list, the status gate, the settled-refused filter and an unknown flag ignored. Its one survivor, M22 (the settled-refused filter), was a state no history reached; a direct row now kills it. The 4 added after the refuter cover the dry run ignoring the stored answer, `--again` left out of the key, the suffix direct-run check and the stored answer's exit ignored. A re-cut M7 covers the key line that `--again` reshaped. Every mutant was applied, the test file run, and the mutant judged by its exit code; the file was then restored from `HEAD`.

**Checks on PR 1's code head `9e97c8fb`** (Linux, WSL, `TZ=UTC`, on `origin/main` + this branch):
- `npm run lint:gate`: exit 0.
- `npx vite build`: exit 0.
- Full suite, `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`: exit **0**.
  - Test Files: 1612 passed, 13 skipped (1625)
  - Tests: 37255 passed, 179 skipped (37434)

The test file alone, on Windows: 81 of 81. The commit after `9e97c8fb` adds only this report.

## 5. The refuter

One refuter got the code, not my conclusions, on a `git archive` snapshot of `9c591508`. Its brief: find a way the script writes without all three gates, or writes anything the HTTP door would refuse. It wrote failing scratch tests for what it found.

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| Q1 | A write without all three gates | **None found.** The attacks it tried: `=`-forms, repeated and misspelt flags, `--dry-run` with `--go`, gate order, an escape from the read-only view (it grepped every module `admitIdea` reaches for a non-transaction write: none), the key derivation, the file reader. | — |
| Q2 | A write the HTTP door would refuse | **None found.** The resolve whitelist equals the door's `resolveFieldsOf`, the action comes from the command, the uid passes unchanged, and the key matches the door's own pattern. | — |
| Secondary | Another user's ids, or a credential, in `status` or the dry run | **None found.** | — |
| F1 (medium) | The door stores a refusal as a success. A derived key therefore replayed a transient refusal forever: `drafting_paused` after a resume, `mode_not_admitted` after the cockpit list was set. `create-book` after a closed book replayed the old book (exit 0), and pause → resume → pause could not pause. The dry run did not read the stored record, so it said "would be ADMITTED" while `--go` replayed a 422. | **CONFIRMED** | **Fixed** (`9e97c8fb`). The dry run reads the door's record under the key, says "`--go` WOULD REPLAY …", and its exit follows the stored answer. An optional `--again <word>` goes into the key to send a new request; keys without it are unchanged. A replay prints the hint. Four rows reproduce the refuter's cases and pass. **Q-2.** |
| F2 (low) | The direct-run check compared a file-name suffix, so a module named `founder.mjs` importing the script ran its CLI, loading `.env.local`. | **CONFIRMED** | **Fixed.** Full resolved paths are compared (`isDirectRun`), with a row. The same pattern is in `scripts/reset-failure-built-insight.mjs:552`, reported here for separate tasking, not fixed (BUILD_RULES §3). |
| Q2-A | The gates are the checkout's and the machine's, not the deployed door's. The door's re-check runs in the same process. The shell environment wins over `.env.local`. No rate limit; the local clock. | **CONFIRMED as stated design** | The header now says each of these plainly (§2). Nothing to fix: the service account is the authority, as for every founder script. |

## 6. PR 2 — the flip

### 6.1 What it changes
- `src/config/practiceFieldFlags.js`: `PRACTICE_FIELD_MODE = 'allowlist'`. The flag's docstring names `'allowlist'` the shipped value (it named `'off'`) and adds the step to the runway line.
- `src/config/practiceFieldFlags.test.js`: the pin row and its title.

Nothing else: no rule, index, `api/` or other `src/` file.

**What `'allowlist'` admits** (the beta census, `docs/audits/20261120_BETA_SWITCH_CENSUS.md` on `claude/beta-switch-census`, §4.1):
- Creating a book and admitting an idea admit a uid on `COCKPIT_ALLOWLIST_UIDS`: the shared list of the founder and FT_QA. FT_QA passes that gate too.
- But **only the founder door creates a book**, and it creates one only for a uid on `MANDATE_FOUNDER_UIDS`, for the caller. No client code calls it.
- The crons serve every existing idea book, and there are none until you create yours. So nothing changes for any player.
- The Film Room's seam, at `'allowlist'`, looks up a list member's idea book. It finds none for anyone without one.

### 6.2 Its suite
Run on Linux in WSL, on the commit itself (it is `origin/main` plus the flip):
`TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8`.

| Tree | Exit | Test Files | Tests |
|---|---|---|---|
| PR 2, `baa580ce` | 1 | 2 failed, 1609 passed, 13 skipped (1624) | **7 failed**, 37167 passed, 179 skipped (37353) |
| Reconciled, `3bc74e6d` | **0** | 1611 passed, 13 skipped (1624) | **37174 passed**, 179 skipped (37353) |

**The 7 reds are pins of the old shipped value.** Each row tests `'off'` behaviour by setting the mode to `null`, meaning "the flag as shipped", and so after the flip it runs at `'allowlist'`:
- `api/cron/practiceFieldIsolation.test.js`: 5 rows, at :146, :588, :827, :848 and :934;
- `api/_utils/practiceField/ideaBook.test.js`: 2 rows, at :43 ("the SHIPPED value is off") and :89. A third, :298, uses the same `null` and is still green only because its uid is on no list.

BUILD_RULES §2 says a flip reconciles its pins in the same commit. Your brief says PR 2 holds only the flag and its pin. So PR 2 is built to the brief, and the reconciliation is ready as its own one-commit branch. In it, those rows say `'off'` outright, and no assertion moved: each still asserts `'off'` behaviour, which a rollback relies on. **Q-1.**

`npm run test:rules` on PR 2 (`baa580ce`), in WSL with the emulator: **exit 0, 46 files, 841 rows passed**. The rules suite holds only `*.rules.mjs` files, which the reconciliation does not touch. The first attempt met another session's emulator on port 8080 and was re-run once the port was free.

### 6.3 The quarterly product at `'allowlist'` with no idea book
This is a scratch differential, run on the flip tree and not committed, because PR 2 may hold nothing else. Its source is in §9.

The setup:
- the real eval sweep at two slots, the close sweep and the rollover sweep;
- five quarterly-only stores: no book; a book evaluated at the tick; a book due an evaluation; a book holding JPM; a book due its rollover;
- each run at the flag's own value (`null`, which reads `'allowlist'` on this tree, asserted) and at `'off'`.

| Compared | Result |
|---|---|
| Every answer the sweeps gave, model calls, quote calls, fundamentals calls, network fetches, error logs, every non-Practice-Field read | **identical**, all five scenarios |
| Every document written | identical except three wall-clock stamps (`updatedAt`, `failedAt`, `publishedAt`), and an `'off'`-vs-`'off'` control run differs in exactly the same three fields |
| Practice Field reads | at `'allowlist'`, one `get practiceFieldBooks/_registry` per eval or close fire; at `'off'`, none |

## 7. What you run, and in what order

1. **Deploy the rules and indexes from `main`** (the T1a-2b-1 owner-read blocks and the `decisions.rationale` index exemption, per the census):
   - `firebase deploy --only firestore:rules --project tradeseven`
   - `firebase deploy --only firestore:indexes --project tradeseven`

   Never use `--force`, and answer **No** if asked to delete indexes.
2. **In Vercel**, confirm that `MANDATE_FOUNDER_UIDS` holds your uid. *Also confirm `COCKPIT_ALLOWLIST_UIDS` holds it:* at `'allowlist'`, creating a book and admitting an idea need that list too (Q-3).
3. **Merge PR 1** (the script), then **the flip** (PR 2, or the reconciled branch, per Q-1), and wait for the deploy.
4. **From your checkout on `main`**, pulled after the merge:
   - **Before running anything,** make sure `.env.local` holds:
     - the Firebase service account;
     - `MANDATE_FOUNDER_UIDS` with your uid;
     - `COCKPIT_ALLOWLIST_UIDS` with your uid.

     The script reads these from your machine, not from Vercel. `status` shows "founder list yes" and "cockpit list yes" once they are right.
   - `node scripts/practice-field-founder.mjs status --uid <uid>`
   - then `node scripts/practice-field-founder.mjs create-book --uid <uid> --go`
   - then `node scripts/practice-field-founder.mjs admit --file <your contract> --dry-run --uid <uid>`
   - then the same with `--go` in place of `--dry-run`.
5. **The next session:** `status` shows the idea `holding`, with its lines at price levels.

## 8. Questions for you

- **Q-1. Which flip do you merge?**
  - PR 2 is the flip and its pin only, as the brief asked, and its CI will be red on 7 rows.
  - The reconciled branch (`claude/practice-field-flip-allowlist-reconciled`, `3bc74e6d`) is the same flip plus those 7 rows reconciled in the same commit, as BUILD_RULES §2 requires. It is green.

  Say which, and I will move the reconciliation into PR 2's commit, or leave it.
- **Q-2. `--again`.** It is a flag the brief's usage lines do not name. It is the fix for the refuter's F1: without it a refused request can never be sent again under its derived key. Keep it, or rule another shape: refuse to send while a stored refusal stands, or key in the date.
- **Q-3. `COCKPIT_ALLOWLIST_UIDS`** is added to the checklist's step 2 and to `.env.local`: the door refuses `mode_not_admitted` without it at `'allowlist'`. The brief named only `MANDATE_FOUNDER_UIDS`.
- **Q-4. Two docstrings still call `'off'` the shipped value:**
  - `api/_utils/practiceField/mode.js:15` ("TESTS: the shipped value is 'off'");
  - `api/_utils/filmRoom/practiceFieldSeam.js:14`.

  They are outside both PRs by the brief's rules. Reconcile them with the flip?

## 9. Record

- **Branches:**
  - PR 1, `claude/practice-field-b0-founder-door` (fashraf94/TradeSeven#1104, draft): code at `9e97c8fb`, and this report in the commit after it;
  - PR 2, `claude/practice-field-flip-allowlist` (fashraf94/TradeSeven#1105, draft), at `baa580ce`;
  - reconciled, `claude/practice-field-flip-allowlist-reconciled`, at `3bc74e6d`, no PR.
- **Files, PR 1:**
  - `scripts/practice-field-founder.mjs`;
  - `scripts/practice-field-founder.test.js`;
  - `scripts/practice-field-founder.examples/` (5 files);
  - this report.
- **Functions called, none edited:** `runFounderAction`, `isPracticeFieldFounder`, `founderAllowlist`, `founderRequestFingerprint` (founderControls.js); `admitIdea`, `ideaIdFor` (admission.js); `normalizeIdeaContract`; `readAdmissionMarkSet`; `planHoldRuling` (in tests); the ledger, adjustment and coverage readers. None is fenced (BUILD_RULES §1).
- **The scratch differential of §6.3:** the isolation suite's own harness (`api/cron/practiceFieldIsolation.test.js` up to its first `describe`) followed by the five-scenario comparison, run as `api/cron/practiceFieldAllowlistNoBook.b0scratch.test.js` in the WSL worktree and deleted after.
