# Build T1a-1 + T1c — the idea book's accounting (dark)

**Build report, Practice Field T1a-1 + T1c** · Claude Code (Fable 5.2) · 13 Nov 2026
**Branch:** `claude/practice-field-t1a1-accounting-31758b` (the prompt named `claude/practice-field-t1a1-accounting`; the worktree this session was opened in carries the `-31758b` suffix, and that is the branch pushed)
**Base:** `origin/main` @ `d9b4e3c1` (read after `git fetch origin` at session start and again before the push; unchanged). `api/_utils/filmRoom/practiceFieldSeam.js` was present at the base.
**Code head:** `ab57faf4` (17 commits on the base) · 54 files, +7,540 / −52. The commit that adds this report and its `docs/README.md` row follows it and changes no code.
**Flag:** `PRACTICE_FIELD_MODE = 'off'` (`src/config/practiceFieldFlags.js:33`). Nothing in this build runs in production.
**This session made no model call, no Firestore write and no EODHD call.** Every test runs on the engine's in-memory store (`api/_utils/__testsupport__/mandateFakeFirestore.js`) with the network edges mocked.
**Rules:** concept V6.1, shared contract V2 with Amendments A and B, the Film Room C1 reply, the direction note and Amendment C (the five attachments this build commits, §2.4), and `docs/BUILD_RULES.md`.

Every `file:line` below was read at the code head in this session (VERIFIED) unless it says otherwise.

---

## 1. Plain terms

**What this is.** The money underneath the idea book. No screen, no agent, no model: only the bookkeeping, built so that it cannot quietly be wrong. It is switched off.

**What it does, once it is switched on.**

- A player's agent gets one book of $100,000 of paper money.
- An idea reserves part of that money in one of three slots (short, medium, long). The book checks every limit first and returns every reason an idea does not fit, together, with the largest amount that would fit.
- On the next trading session the idea buys all its stocks in one step, or none of them. A stock with no fresh price stops the whole idea; it waits for the next check that day, and if the day ends without one the reservation goes back.
- At the same instant, from the same prices, with the same dollars, the book opens two shadow accounts beside the idea: the comparison the idea named (the same stock simply held, its sector fund, or a fixed basket) and the S&P 500 fund. These are what the idea will be judged against.
- Every evening each account is valued from one shared set of closing prices. A valuation is a mark. It is never recorded as a sale.

**Three promises the accounting keeps** (§5 has the source check):

1. **A missing price never produces a fill.** One function decides whether a price may be used. Every fill asks it first.
2. **A valuation is never reported as a sale.** The evening close writes no trade record and moves no cash except a dividend.
3. **Every book is valued at the same moment.** One closing snapshot per day; a late or repeated close reads the same one.

**What it does not do.** It does not sell (exits, lines firing and settlement are T1a-2). It makes no model call. It adds no screen and no security rule. It does not change the quarterly Mandate.

**The quarterly Mandate is unchanged.** Seventeen quarterly scenarios were run on the old code and the new code and compared byte for byte: identical (§4.3). A control scenario that includes an idea book differs, as it should, so the comparison is able to see a difference.

**Checks on the code head.** The full suite on Linux: 1,445 test files and 32,067 tests passed, exit 0. The lint gate and the production build pass (§4.2).

**What the review found.** Three independent reviewers, then three refuters, then 159 deliberate breakages of the code to check that the tests notice (§6). The reviewers found no blocker for a dark merge. They did find real defects that would have mattered once the flag moved, and those are fixed in this PR:

- An idea book's stocks and funds had leaked into what a quarterly book could see and buy. They are now carried separately, and a quarterly book's view is the same to the byte with or without an idea book.
- A hiccup at the day's last check could cost an idea its entry. It now retries.
- An idea with a leg too small to buy could be accepted and then sit unfillable all day. It is now refused at the door.

**What needs you.**

- **Sign-off on the new stores** (§7). They are server-only; no rule or index changes.
- **Nine questions** (§3.2). None blocks a dark merge. The first one (a stock with no market cap pays a higher modelled cost than its comparison) should be ruled before the flag leaves `'off'`.
- The crons were not preview-tested: crons do not run on Vercel preview (BUILD_RULES §6). Verification is the tests below.

**Fence.** No fenced file was edited (BUILD_RULES §1). Fenced functions called: none directly; archetype physics are read through `api/_utils/archetypeRegistry.js` (`api/_utils/practiceField/ideaBook.js:70`).

---

## 2. What changed

### 2.1 New files

| File | What it holds | Key lines |
|---|---|---|
| `src/config/practiceFieldFlags.js` | The flag, `'off'`, and its three states | `:33`, `:36` |
| `src/data/practiceFieldSlots.js` | The constants B1–B9, slot names and horizons, origin kinds | `:24` |
| `src/data/practiceFieldFunds.js` | The 15 funds, their cost tier, the benchmark (SPY) | `:23`, `:32`, `:34` |
| `src/data/practiceFieldSectorBridge.js` | House sector names → the Mandate's sector vocabulary | `:15` |
| `api/_utils/mandateBookKind.js` | The kind test every quarterly path asks; the active-book split | `isIdeaBook :19`, `splitActiveBooks :42` |
| `api/_utils/practiceField/constants.js` | Statuses, labels, store names, the minimum leg | `MIN_LEG_USD :39` |
| `…/errors.js` | The typed error | `:26` |
| `…/money.js` | Exact integer-cent arithmetic; the 11 registered rounding sites | `:23`–`:85` |
| `…/mode.js` | The server gate: `'off'` / `'allowlist'` / `'on'`, read at call time | `:27`, `:37`, `:42`, `:57` |
| `…/symbols.js` | Stock / fund classification, sector, cost tier | `:51`, `:69`, `:82` |
| `…/windows.js` | Sessions and entry slots | `ideaSchedule :100` |
| `…/marks.js` | **The eligible-mark rule** | `eligibleMark :56`, `closeMarkQuality :88` |
| `…/fills.js` | **The only caller of the engine's fill computation** | `executeIdeaFill :47` |
| `…/ledger.js` | One ledger shape for the idea, the comparison and SPY; corporate actions once per ledger; valuation | `:41`, `:91`, `:145` |
| `…/reconcile.js` | The reconciliation run before every write | `assertReconciled :39` |
| `…/contract.js` | Contract validation and the planned dollars per leg | `:73`, `:53`, `:64` |
| `…/admission.js` | Admission and release | `evaluateAdmission :106`, `admitIdea :294`, `releaseIdea :409` |
| `…/coverage.js` | The reserved-coverage document | `:89`, `:106` |
| `…/ideaBook.js` | The book, its epoch, creation | `buildIdeaBookDoc :121`, `createIdeaBook :202` |
| `…/bookStore.js` | The Film Room seam's two helpers | `bookForOwner :28`, `bookIsForAgent :40` |
| `…/entry.js` | Basket entry and the entry pass | `computeBasketEntry :98`, `enterIdea :155`, `runIdeaBookEntryPass :324` |
| `…/close.js` | The idea-book close | `closeIdeaBook :167` |
| `…/sweep.js` | What the cron asks of the Practice Field | `practiceFieldBuildInputs :38`, `runIdeaBookEvalPass :56` |
| `…/__testsupport__/fixtures.js` | Test fixtures (never imported by production) | — |

Tests: `api/_utils/practiceField/{marks,ideaBook,admission,entry,close,endToEnd}.test.js`, `api/cron/practiceFieldIsolation.test.js`, `src/config/practiceFieldFlags.test.js`, `src/data/practiceFieldSlots.test.js`.

### 2.2 Engine files edited

None of these is on the fence list.

| File | Change | New-side lines |
|---|---|---|
| `api/cron/mandate-evaluate.js` | The build set by book kind (`snapshotBuildInputs`); the kind guard in `runBookEval`; the idea-book pass, fenced; the eval page steps over idea books, and over a holdings-free quarterly book when the slot's snapshot has no candidate universe; the close sweep dispatches by kind | `:109–140`, `:172–175`, `:379–396`, `:438–460`, `:468`, `:528–556`, `:787`, `:841–857`, `:899–940` |
| `api/_utils/mandateUniverseSnapshot.js` | Four defaulted builder options (`staticClassifications`, `minCandidateCapacity`, `coverageTickers` on both builders); `coverageOnlySymbols` on a snapshot built with coverage; a day doc or slot snapshot built without the candidate universe says so (`candidateUniverseOmitted`), and such a day doc is topped up once when the universe is needed; `isSymbolActionable` refuses a coverage-only symbol | `:83–125`, `:378–411`, `:425–444`, `:457–463`, `:497–500`, `:533–539`, `:558–560`, `:586`, `:597–600`, `:604`, `:617–619`, `:659–671` |
| `api/_utils/mandatePromptAssembly.js` | The slate skips a coverage-only symbol | `:31`, `:108` |
| `api/_utils/mandateClosePass.js` | `closeBook` skips an idea book | `:179–182` |
| `api/_utils/mandateExecution.js` | `executeDecision` and `disposeSubmission` refuse an idea book; the replay branch never heals a gate on one | `:384`, `:394–396`, `:514–517` |
| `api/_utils/mandateRollover.js`, `api/cron/mandate-rollover.js` | Rollover skips an idea book (core, in-transaction, sweep) | `:116–118`, `:159`; `:110–113` |
| `api/_utils/mandateEscape.js` | The escape hatch refuses an idea book | `:114–117` |
| `api/_utils/mandateBatchTransport.js` | The submit gate, the harvest and the drain never act on an idea book, and say so | `:226`, `:365–372`, `:788–791` |
| `api/_utils/filmRoom/practiceFieldSeam.js` | The two default helpers now come from `practiceField/bookStore.js` | `:11–14`, `:30–31`, `:128–135` |

Guards and ratchets updated in the same commits: `api/_utils/compositionProtectedStoresScan.js` (two collections added to the protected list), `api/_utils/compositionProtectedStoresAllowlist.json` (15 keys and their notes), `api/_utils/mandateMoneyRounding.scan.test.js` (the scan now covers `practiceField/`; `money.js` pinned at 11 sites), `api/_utils/mandateRationale.imports.test.js` (one pinned mention of the decisions store, `entry.js`), `src/config/flagPinGuard.test.js` (the flag's note in the dark-by-design block).

### 2.3 Every reader and writer of `mandates`

The guards do not read the flag. A quarterly path steps over an idea book whatever the mode is.

| # | Site | Read / write | Can it meet an idea book? | What happens |
|---|---|---|---|---|
| 1 | `mandate-evaluate.js:378`, `:840` — the active-book query for the snapshot build | R | Yes | Split by `splitActiveBooks` (`:380`, `:842`). At `'off'` an idea book is invisible. Otherwise its symbols travel as coverage (§3.1 R-12) |
| 2 | `mandate-evaluate.js:492` — the eval page | R | Yes | Stepped over at `:534`, before the lease; stamped so it rotates |
| 3 | `runBookEval` `mandate-evaluate.js:175` | — | Guarded first | `{ outcome: 'skipped_kind' }`, no model call |
| 4 | `mandate-evaluate.js:884` — the close page | R | Yes | `:906–907`: at `'off'` stamped and skipped; otherwise dispatched to `closeIdeaBook` (`:933`) |
| 5 | `closeBook` `mandateClosePass.js:182` | R/W | Guarded | `skipped: 'not_quarterly'`. (Its `dailyRows` read at `:162` precedes the guard: a read only) |
| 6 | `mandate-rollover.js:95` query, `:113` | R | The fake lets it in; real Firestore excludes a doc with no `nextRolloverAt` | Skipped before the lease |
| 7 | `rollOneBoundary` `mandateRollover.js:118`, `:159` | R/W | Guarded twice | `skipped: 'not_quarterly'`, before the vintage publish |
| 8 | `escapeMandate` `mandateEscape.js:117` | R/W | Only through a mis-set pointer | `code: 'not_quarterly'` |
| 9 | `createMandate` `mandateCreationService.js:81`, `:112` | R/W | The replay read follows `userMeta.activeMandateId`; nothing points that at an idea book | **Not kind-aware** (§8, O-4). The file is not in this build's edit list |
| 10 | `mandateAcceleratedClock.js:42–159` | R/W | Only ids it created | Unchanged |
| 11 | `submitMandateBatch` gate `mandateBatchTransport.js:226` | W | Guarded | Never gates an idea book |
| 12 | Harvest and drain `mandateBatchTransport.js:369`, `:788` | R/W | Guarded (no entry can name one by construction) | Left untouched, logged `MANDATE_BATCH_ENTRY_NOT_QUARTERLY` |
| 13 | `executeDecision` `mandateExecution.js:517`; `disposeSubmission` `:396`, `:384` | R/W | Guarded | Throws `not_quarterly` before any write; the replay branch never heals |
| 14 | `mandateLease.js` | W | Kind-agnostic by design | The idea-book pass takes the same lease (`sweep.js:71`) |
| 15 | `filmRoom/cardStore.js` (nominations) | R/W | Idea books only, through `bookIsForAgent` | Unchanged by this build |
| 16 | `filmRoom/cardCounter.js` → `bookForOwner` | R | Reads `practiceFieldBooks/{uid}`, never `mandates` | No read at `'off'` |
| 17 | `practiceField/{ideaBook,admission,entry,close,sweep}.js` (`ideaBook.js:221`, `admission.js:303`, `:415`, `sweep.js:59`) | R/W | Idea books only | Each re-checks the kind or builds the ref from an idea-book id |
| 18 | `firestore.rules:1465` | R | An owner can read their own idea-book doc and its `dailyRows`, `decisions`, `corporateActions` | Unchanged rules; no client reader exists; `ideas`, `epochs`, `rows` fall to the deny at `:1516` |
| 19 | `src/`, `scripts/`, `collectionGroup(...)` | — | No reader or writer of `mandates` (searched) | — |

### 2.4 The five attachments

Committed byte-identical at `b9775361`, each with a row in `docs/README.md`. Hashes verified in `Downloads` before the commit and on the committed blobs after it.

| File under `docs/design/` | SHA-256 |
|---|---|
| `20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2_AMENDMENT_A.md` | `dfc674545be0322e30546df693ab4f61b25633ecbfcad7f9e45c60ab8e8cb3a5` |
| `20261113_FILM_ROOM_TO_PRACTICE_FIELD_C1_REPLY.md` | `37d63a391f00c041923829ab6ae557ac3a9bb2d5de2fddb9fc9b58e4e1a1b1d8` |
| `20261113_PRACTICE_FIELD_SHARED_CONTRACT_V2_AMENDMENT_B.md` | `410288e5a76f9059b19b528f8474d6add70e7788561c767b0e648c540ef7b88a` |
| `20261113_DIRECTION_NOTE_GAME_AND_ACCOUNT.md` | `1cb831affce313fde41e8904603e5f7530079b32dfa75fca8f1d91b0d76c495a` |
| `20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md` | `b953ed7bb1c4aa62b4154a1a090e7b6e0b464d6ac8811377569289c8f627d85d` |

---

## 3. Readings and questions

### 3.1 Readings — where the prompt left room and what was built

| # | Reading | Where |
|---|---|---|
| R-1 | **Start session** is the first trading session whose ET date is strictly after the admission's ET date. An idea admitted before the open on a trading day still starts the next session | `windows.js:100` |
| R-2 | **Due session** is start + N sessions; the start session is session 0 | `windows.js:57` |
| R-3 | **A line's level** is taken from the executed price (the mark plus modelled cost), not the raw mark | `entry.js:98` |
| R-4 | **Each leg's dollars** are whole cents rounded down; the cents left over stay in the idea's cash. Three equal names of $20,000 are $6,666.66 each | `contract.js:53` |
| R-5 | **`portfolio.cash` is all the book's cash**; the treasury's unreserved cash is stored separately and the two are reconciled before every write | `reconcile.js:39` |
| R-6 | **A stock's sector** in an idea book is the bridge's, never the vendor's | `symbols.js:51` |
| R-7 | **The coverage budget** counts the default 136-name universe as always present, the worst case | `coverage.js:106` |
| R-8 | **The founder cap (B8)** is held in one registry document, `practiceFieldBooks/_registry`; the owner's claim document mirrors the book's status | `ideaBook.js:202` |
| R-9 | **The close applies** a split, a reverse split, a stock distribution and a cash dividend. It does **not** apply a delisting or a ticker change: the engine's delisting is a forced sale at a carried mark (`mandateCorporateActions.js:246–267`), which promise 2 forbids. The symbol is valued at its carried mark and the row is not full quality | `ledger.js:91` |
| R-10 | **The close runs the engine's split-shaped-gap screen** per ledger; a suspected unfed split is a carried mark | `ledger.js:199` |
| R-11 | **The permitted maximum is conservative**: with explicit weights it can be 1–2 cents below what the floored legs would allow. It never over-admits | `admission.js:106` |
| R-12 | **Coverage enters the shared snapshot as its own set.** The prompt asked for the build set to change at the cron call sites. That is not enough to keep a quarterly book's view unchanged (review finding L2-1), so the builder takes a defaulted `coverageTickers` option and marks coverage-only symbols on the snapshot (`coverageOnlySymbols`, written only when there is one). Four defaulted options in all; with none passed the builders are the base's, proven by the differential and by a refuter's 40,000-case property test | `mandateUniverseSnapshot.js:83–125`, `sweep.js:38` |
| R-13 | **With no quarterly book active and no quarterly batch open, the default 136 names are not fetched** (the prompt's rule). A day document and a slot snapshot built that way say so (`candidateUniverseOmitted`). If a quarterly book appears later that day: in the same slot it is not evaluated (there is nothing it could enter, so no model call is spent); from the next slot the snapshot carries the universe, and the day document is topped up once — what it already holds is kept exactly, the 136 names are added | `mandateUniverseSnapshot.js:391–411`, `:427`, `:619`; `mandate-evaluate.js:124–140`, `:552` |
| R-19 | **The limits are shares of the equity the book displays** (`portfolio.totalValue`, written by the last close or the last fill), never a second valuation of the same positions. The close writes that number as the sum of its ideas' rows, so a book row, its idea rows and the permitted maximum agree to the cent | `admission.js:140`, `close.js:279–283` |
| R-20 | **An entry that fails for a reason other than a missing price** (a store error, say) is retried by the slot's next fire, and leaves its reason on the idea (`lastEntryAttempt.error`). If it fails all session the close cancels the idea `entry_timeout`, as for a missing price | `sweep.js:86`, `entry.js:348` |
| R-14 | **At `'allowlist'`** creation, admission and the Film Room seam admit only an allowlisted owner; the crons serve every existing idea book | `mode.js:42` |
| R-15 | **At `'off'`** an existing idea book is invisible to the snapshot build and the idle check, and the close sweep steps over it without closing it | `mandateBookKind.js:42`, `mandate-evaluate.js:907` |
| R-16 | **The idea-book pass** is its own query and its own within-slot stamp (`execState.lastIdeaTickKey`), written only when the pass had no error | `sweep.js:56–84` |
| R-17 | **The smallest leg is $1** (`MIN_LEG_USD`). The number is mine; see Q-5 | `constants.js:39`, `contract.js:211` |
| R-18 | **The admission fingerprint** covers what the caller sent. The same idea written with explicit equal weights, or with its names in another order, is a different request under the same `opId` and is refused `op_id_conflict` | `admission.js:72` |

### 3.2 Questions for the founder

None blocks a dark merge.

| # | Question | What is built today |
|---|---|---|
| Q-1 | **A stock with no market cap on the entry snapshot pays the widest modelled cost (20 bps); a fund pays 3.** On $20,000 that moves the matched gap by about $34 against a $50 band, and it is not the idea's doing. Should such a stock (a) not be eligible that slot, (b) make the idea's rows not full quality, or (c) take a static cap tier? **Rule before the flag leaves `'off'`.** | The leg is named on the idea and its inception row (`unknownCostTierLegs`), and every later row says `entryCostTiersKnown: false`. `fullQuality` keeps its meaning (marks only). `entry.js:98`, `close.js:152` |
| Q-2 | **Should a fill price have a maximum age?** A name halted at 09:31 can fill at the 15:31 check on a six-hour-old quote: the quote is the vendor's, after admission, inside the session, which is the rule as written. The engine's own 20-minute rule is not applied | No age bound. `marks.js:56` |
| Q-3 | **Should a close mark require a regular-hours print?** Any vendor print dated that day counts as `vendor_time`, including a pre-market or after-hours one | Same-date only. `marks.js:88` |
| Q-4 | **The entry timeout inside the close returns an unfilled reservation to the treasury.** §7a says the close "moves nothing from a ledger to the treasury". It is a release of cash that never bought anything, not a mark turned into cash. Bless the wording? | `close.js:167` (the timeout step) |
| Q-5 | **Is $1 the right minimum leg?** | `constants.js:39` |
| Q-6 | **Keep the fingerprint strict** (R-18), or treat equal-by-meaning contracts as the same request? | Strict |
| Q-7 | **A quarterly book created while only idea books were active** waits one slot for its first evaluation (R-13). On `main` today it would be evaluated in the slot it was created in. Acceptable, or should the default universe always be fetched once an idea book exists (about 136 more quotes four times a day)? | R-13 |
| Q-8 | **Delisting and ticker change** (R-9): policy belongs to T1a-2. Confirm a carried mark until then | `ledger.js:91` |
| Q-9 | **A dividend and a split on the same effective date** apply in the engine's own order — by effective date, then by action id (`mandateCorporateActions.js:176`). In the review's run that put the dividend first, on pre-split shares. Is the feed's dividend amount per pre-split share on such a date? | Engine order, unchanged |

---

## 4. Tests

### 4.1 The build's own tests

Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`), on a worktree at `ab57faf4`:

```
npx vitest run api/_utils/practiceField api/cron/practiceFieldIsolation.test.js \
  src/config/practiceFieldFlags.test.js src/data/practiceFieldSlots.test.js
```

Exit code 0. `Test Files  9 passed (9)` · `Tests  200 passed (200)` · `Duration  5.74s`.

| File | Tests | What it proves |
|---|---|---|
| `src/config/practiceFieldFlags.test.js` | 7 | The flag is `'off'`; its three states; nothing reads it at module scope |
| `src/data/practiceFieldSlots.test.js` | 12 | The constants B1–B9, the funds, the sector bridge |
| `api/_utils/practiceField/marks.test.js` | 21 | The eligible-mark rule and every refusal |
| `…/ideaBook.test.js` | 25 | The book, the epoch, creation, the founder cap, the Film Room seam, mode `'off'` before any read |
| `…/admission.test.js` | 37 | Every limit, all failures together, the permitted maximum, racing admissions, replays |
| `…/entry.test.js` | 31 | All-or-nothing entry, the three ledgers, lines, timeouts, reconciliation at every write |
| `…/close.test.js` | 21 | Valuation rows, corporate actions once per ledger, the same-stock tie, marks never sales |
| `…/endToEnd.test.js` | 2 | The synthetic run and its pinned store hash |
| `api/cron/practiceFieldIsolation.test.js` | 44 | Kind isolation on every quarterly path at both modes; the shared build; the real sweeps |

### 4.2 The full suite, lint and build (Linux, WSL, `TZ=UTC`, 8 workers)

All on a WSL worktree at `ab57faf4`.

| Check | Command | Exit | Result line |
|---|---|---|---|
| Full suite | `flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` | 0 | `Test Files  1445 passed \| 10 skipped (1455)` · `Tests  32067 passed \| 120 skipped (32187)` · `Duration  369.20s` |
| Lint gate | `npm run lint:gate` | 0 | `eslint . --config eslint.gate.config.js --max-warnings 0`, no findings |
| Build | `npx vite build` | 0 | `✓ built in 46.91s` (only the standing chunk-size notice) |

The base's own suite at `b9775361` earlier in the session was `1445 passed \| 10 skipped`, `32033 passed \| 120 skipped`. An intermediate full run at `2cde3ca6` had four failures: one was mine (the protected-store scan wanted a moved write site registered, fixed at `8475f14a`) and three were load-sensitive rows in unrelated files (O-3). The run above, on a quiet machine, has none.

After the report commit, the lint gate and the build were run again on the pushed head (the closing message gives the lines); a docs-only commit cannot change a test's result, and the suite was not run a third time.

### 4.3 The quarterly differential

A scratch test (not committed) runs seventeen quarterly scenarios through the real sweeps on an LF worktree of the base and one of the head, and records for each: the response, every log line, every read in order, every network-client call, and the whole store.

| Run | Base `d9b4e3c1` | Head `ab57faf4` | Verdict |
|---|---|---|---|
| 17 quarterly scenarios | 1,118,594 bytes, SHA-256 `92a1be2080b4e0d6ccb32e26a2ec95ec5fac0bd4c262e0f2de73f1f1e2f27f43` | 1,118,594 bytes, the same hash | **Byte-identical** |
| Control: the same 17 plus one with an idea book in the store | 1,225,417 bytes, `0c8c575f8cc3effc8767a5859aa1438af8503a542bf9d29418ebc7eef42b8428` | 1,221,140 bytes, `5f44c4a9044532f2064648f6e8e291a178876cc8772e58a00dd7d2dfce51e4b8` | **Differs, in scenario 18 only** |

Both sides: vitest exit 0, 18 and 19 tests passed. The seventeen scenarios:

- **Direct evaluation:** a buy executed; a sell and a hold across two books; no books with a batch in flight; a snapshot already present; a slow-tier book, a quarantined book, a book with no vintage and a model failure.
- **Batch evaluation:** enqueue, then harvest and execute; a book gated behind an open batch; a quote outage; the session's final slot.
- **The close:** a holding book with a dividend and a split in the feed, then a replayed fire; no books with an aged-out batch.
- **The idle skip** in the eval window and the close window.
- **Rollover; creation** with its replay, a second-book refusal and the escape hatch; **the batch drain; the accelerated clock; the Film Room seam** for an owner with a quarterly book.

An unchanged number can mean a check that did not run, so each scenario's facts were printed and read (documents, reads, model calls, decisions by status). The control shows the comparison can fail. Scenario 18 puts an idea book beside a quarterly book in a close fire: the base closes both as quarterly (`closed: 2`, a dividend applied to the idea book, two rows); the head closes the quarterly book and steps over the idea book (`closed: 1, skipped: 1`, one row).

Lens 2 and refuter 2 each built their own differential from the base's files (12 scenarios, both run orders): byte-identical at `'off'`; at `'on'` with no idea book the only difference is one extra query per eval fire.

### 4.4 The end-to-end synthetic run

`api/_utils/practiceField/endToEnd.test.js`: one book, three ideas (one per comparison type), entry, twelve closes with a split and a dividend, reconciled after every step. The whole store is dumped and its hash is pinned in the test.

Log line, identical on Windows and on Linux:

```
PF_E2E_EVIDENCE {"sha256":"10049196e823efdc82d6ae26dacc99505cb0794106927e94beeb41e541b10df1","bytes":147178} docs=69
```

69 documents, 147,178 bytes. A second run in the same process produces the same bytes (the file's second test). The hash moved twice during review, each time with a reviewed change to what is stored (`36720cc9…` before the fixes).

---

## 5. The three accounting requirements — source check

### 5.1 B-NOFILL — a missing price never produces a fill

**What the engine does.** An entry needs a positive snapshot mark (`mandateExecution.js:185`). An exit does not: it falls back to the carried mark, then to average cost (`mandateExecution.js:236–237`). Valuation has the same fallback (`mandateValuation.js:53–56`). The snapshot builder stamps its own fetch time into `priceAsOf` when the vendor sends no time (`mandateUniverseSnapshot.js:171–172`), so `priceAsOf` cannot certify a quote.

**What the build does.**

- `eligibleMark` (`marks.js:56`) is the only source of a fill price. It reads the vendor's own time (`quoteTs`), never `priceAsOf`, and returns the mark or one typed refusal: `no_quote`, `receipt_time_only`, `carried_forward`, `outside_session`, `before_decision`.
- `executeIdeaFill` (`fills.js:47`) asks it first, for every verb, and then holds three locks on the engine's answer: the mark source must be the snapshot, the executed price must equal the eligible mark with its cost, and the status must be executed. It is the only caller of the engine's `computeExecution` under `api/_utils/practiceField/`.
- `enterIdea` (`entry.js:155`) checks every name, every comparison symbol and SPY before any leg, inside one transaction. A leg the engine itself cannot fill is one more failed attempt for the whole basket.
- The engine's other caller, `executeDecision`, throws for an idea book before any write (`mandateExecution.js:517`).

**Checked adversarially.** Refuter 3 drove 44 distinct cases through `enterIdea` (four kinds of leg × eleven kinds of bad price): every one waited, wrote nothing but the attempt, and cancelled cleanly at the last slot. It also called `executeIdeaFill` 48 times for SELL, TRIM, ADD and BUY on snapshots where the bare engine fills a SELL: all refused.

### 5.2 B-MARK — a mark is never reported as a sale

**What the engine does.** A delisting is a forced close into cash (`mandateCorporateActions.js:246–267`), recorded as a `CORPORATE_CLOSE` decision with `fillMarkQuality: 'carry_over'` (`mandateClosePass.js:281–294`).

**What the build does.** `closeIdeaBook` (`close.js:167`) writes no decision and no receipt. A ledger's cash changes only by a dividend. Delistings are not applied (R-9). Every row carries `basis: 'mark'`, and values are named as marks (`markedGapUsd`, `markedHoldingsValue`). A test hook scans every valuation row that the close, entry, end-to-end and sweep tests write for a sale's word, as a key or a value (`fixtures.js` `saleWordsOnMarkRows`). A word list cannot be complete; the end-to-end store hash (§4.4) catches any new field. One wording point is put to the founder (Q-4).

### 5.3 B-STAMP — every book is valued at the same timestamp

**What the engine does.** The close sweep reads the snapshot `${date}_close` before anything else and builds it only when it is absent (`mandate-evaluate.js:837–838`, `:857`); the eval sweep does the same per slot (`:375–376`). The first writer wins and a loser adopts the winner's document (`mandateUniverseSnapshot.js:260`). The `force` option (`:373`, `:528`) has no production caller.

**What the build does.** `closeIdeaBook` refuses any snapshot whose key is not exactly `${date}_close` (`close.js:52`, `:167`) and imports no fetcher. Every ledger of every idea is marked from that one object. Each row stores `closeSnapshotKey` and the snapshot's own build time. A close for a date before the last closed date is refused (`close.js:191`). The entry snapshot must be the slot's own (`entry.js:159`).

**The one document this build can rewrite** is the day document (R-13), never a slot or close snapshot. Refuter 3 ran the rebuild between an entry and two closes, with the vendor answering the same, differently, with nothing and with an error: every stored slot and close snapshot was byte-identical afterwards, and each corporate action was applied exactly once per ledger. After its report the rebuild was changed to keep what the first build holds (§6.2, RF3-2).

---

## 6. The §2 review

The branch diff is 54 files, so the full review applies. Reviewers and refuters were subagents, each on its own `git archive` tree under the session scratchpad with `node_modules` linked, read-only on git and on the shared working tree.

### 6.1 Three lenses (at `b9775361`)

| Lens | Subject | Verdict |
|---|---|---|
| L1 | Accounting and reconciliation | No blocker. 1 should-fix, 1 low should-fix, 9 notes |
| L2 | Kind isolation, the flag-off guarantee, the quarterly differential | The `'off'` guarantee holds. 3 should-fix that apply only once the flag moves and both kinds are active; 5 notes. Ran its own 12-scenario differential: byte-identical |
| L3 | Fills, comparisons and fairness | B-NOFILL, B-MARK and B-STAMP hold. 3 should-fix, 5 notes |

### 6.2 Findings, refuters and dispositions

Every lens finding went to a refuter with two trees: the reviewed head (`b9775361`) to attack the finding, and the fixed head (`2cde3ca6`) to attack the fix. **27 findings: 24 confirmed, 3 confirmed but narrower than stated, 0 refuted.** The refuters did refute two of my fixes as incomplete (L1-7, L2-2), and found 18 further points while attacking the fixes.

| Finding | What it was | Refuter on the finding | Disposition | Refuter on the fix |
|---|---|---|---|---|
| L1-1 | An idea with a leg of 0–2 cents was admitted, could never fill, and a dust holding plus a reverse split could stop the book closing | CONFIRMED | **Fixed**: $1 minimum leg; a weight under one part per million is not a weight; an unfillable leg is a failed attempt; a share action that leaves zero shares is not applied | HOLDS (residual O-13) |
| L1-2 | A replayed admission of a cancelled idea answered `ok` with nothing to say it was cancelled | CONFIRMED | **Fixed**: the replay carries the idea's current status | HOLDS |
| L1-3 | A create replay with a different agent or archetype answered `ok` | CONFIRMED | **Fixed**: `op_id_conflict` | HOLDS |
| L1-4 | The fingerprint covered constants the code derives, so a copy edit between a call and its retry was a conflict | CONFIRMED | **Fixed**; a row for the behaviour was added after the refuter (RF1-4) | HOLDS |
| L1-5 | The permitted maximum can be 1–2 cents low with explicit weights | CONFIRMED | Not changed (R-11) | — |
| L1-6 | The book's row and its ideas' rows could differ by a cent | CONFIRMED | **Fixed**: the book row is the sum of the idea rows | HOLDS, but it moved the cent (RF1-2, fixed) |
| L1-7 | A missing gate number failed open | CONFIRMED | **Fixed** | **INCOMPLETE**: `null`, `false` or `''` still read as zero (RF1-1). **Fixed** at `7cde2305`: every number is type-checked |
| L1-8 | Reconciliation did not check status, slot or not-a-number | CONFIRMED-NARROWER: a not-a-number treasury was already caught | **Fixed**: rule 6 | HOLDS |
| L1-9 | A close for an earlier date, run late, rewound the book | CONFIRMED (direct call only) | **Fixed**: `out_of_order` | HOLDS |
| L1-10 | Engine fields no idea-book pass maintains sat stale on the book | CONFIRMED | **Fixed**: absent | HOLDS |
| L1-11 | Dividend and split on one date: order | CONFIRMED-NARROWER: base engine behaviour, untouched | Not changed (Q-9) | — |
| L2-1 | An idea book's symbols became buyable by a quarterly book and led its slate | CONFIRMED | **Fixed**: coverage is its own set (R-12) | HOLDS: prompts and every quarterly document byte-identical with and without an idea book, four scenarios |
| L2-2 | An idea-only morning starved a quarterly book created later that day | CONFIRMED | **Fixed in part** | **INCOMPLETE**: in the same slot the new book was still evaluated, a billed model call on an empty slate (RF2-1). **Fixed** at `825ca16e` (R-13) |
| L2-3 | Reserved names that are default candidates counted as held, raising a false degraded alert | CONFIRMED | **Fixed** | HOLDS: 131 of 136 reserved, still 136 candidates |
| L2-4 | A failure in the idea-book pass cost the quarterly sweep its fire; the pass's outcome did not reach `complete` | CONFIRMED | **Fixed** for the pass; the coverage read is unfenced on purpose (O-9) | HOLDS |
| L2-5 | A batch entry naming an idea book holds its batch open, silently | CONFIRMED (a state the engine cannot create) | Now logged; the state is unchanged (O-5) | HOLDS for the log line |
| L2-6 | A throwing idea-book close holds back retention | CONFIRMED | Not changed (O-6) | — |
| L2-7 | Three guards sat after an earlier branch | CONFIRMED | The dispose replay is **fixed**; the other two are O-4 and a read-only note | HOLDS |
| L2-8 | Capacity of the pass's one page | CONFIRMED by reading | Not changed (O-7) | — |
| L3-1 | A transient error at the last slot cost the idea its entry | CONFIRMED | **Fixed**: an errored pass is not stamped | HOLDS; a persistent failure left no record (RF3-1, fixed) |
| L3-2 | A missing market cap distorts the matched gap | CONFIRMED | Surfaced, not resolved (Q-1) | — |
| L3-3 | Same as L1-9 | CONFIRMED | **Fixed** | HOLDS |
| L3-4 | Same as L1-6 | CONFIRMED: 40 of 168 closes | **Fixed** | HOLDS: 0 of 168, no false refusal |
| L3-5 | `eligibleMark` accepted a string, boolean or infinite price and threw on an absurd time | CONFIRMED-NARROWER: milliseconds were already refused | **Fixed**; age bound and close-mark hours are Q-2, Q-3 | HOLDS |
| L3-6 | `enterIdea` accepted a snapshot that was not the slot's own | CONFIRMED | **Fixed** | HOLDS; a keyless pair still passed (RF3-5, fixed) |
| L3-7 | The sale-word test was narrow | CONFIRMED | Widened | HOLDS: four plants each fail it. Limits in RF3-6 (extended) |
| L3-8 | Three smaller observations | CONFIRMED | Notes | — |

**Found by the refuters while attacking the fixes:**

| Id | What | Disposition |
|---|---|---|
| RF1-1 | L1-7 still failed open for a value that reads as zero | **Fixed** (`admission.js:149`) |
| RF1-2 | After L1-6, the book's displayed equity and the equity admission used could differ by a cent | **Fixed** (R-19) |
| RF1-3 | An unapplied extreme reverse split is mis-marked once the feed stops presenting it | Note (O-13) |
| RF1-4, RF3-4 | No row failed when the book-vs-ideas check was disabled; L1-4 was guarded only by the store hash | Rows added |
| RF1-5, RF3-7 | A missed or too-early date through `closeIdeaBook` | Note for T1a-2 (O-8) |
| RF2-1 | The same-slot residue of L2-2 was a billed model call | **Fixed** (R-13) |
| RF2-2 | With an open quarterly batch and no active quarterly book, the harvest ran against an idea-only snapshot | **Fixed**: an open batch keeps the universe (`mandate-evaluate.js:124–140`) |
| RF2-3, RF3-2 | The day-document rebuild overwrote; a failed re-fetch could lose corporate actions | **Fixed**: the rebuild tops up. Two fires rebuilding at once both write, each carrying the same kept entries |
| RF2-4 | An alert and the upstream counter now include covered symbols | Note (O-10) |
| RF2-5 | Four surviving mutants (three on `complete`, one on the size budget) | Rows added |
| RF2-6 | Cap and size budget with coverage at its limit | Note (O-11) |
| RF3-1 | A persistently failing entry timed out with no record | **Fixed** (R-20) |
| RF3-3 | Value and label use two tests on the valuation side | Note (O-12) |
| RF3-5 | The snapshot guard passed when neither side had a key | **Fixed** |
| RF3-6 | The sale-word scan ran in one test file and missed synonyms | Extended to four files; list widened |

**What was not re-refuted.** The fixes made after the refuters reported (`7cde2305`, `825ca16e`) were not sent to a second refuter pass. They are covered by new test rows, by mutants in the final battery (§6.4), by the quarterly differential and by the full suite, all run on the final code.

### 6.3 Isolation slips, disclosed

- Lens 1 wrote eight output files (`L1_*.txt`) into the shared `review/` folder, one level above its tree. It did not delete them.
- Lens 2 wrote two backup copies into the same folder during a mutation check and deleted them.
- Lens 3 wrote one helper script there and deleted it.
- The three refuters reported writing nothing outside their two trees.
- The lenses' and refuters' scratch files remain in their trees under the session scratchpad; none is in the repository.

None touched git or the working tree.

### 6.4 The mutation battery

Each mutant re-breaks one rule in a `git archive` copy of the code head (never the working tree) and runs the test files named for it. KILLED means vitest exited non-zero with at least one failed test. A mutant whose anchor is not found exactly once, or after which no test ran, is BROKEN and counts for nothing; the runner prints the ids it defined against the ids it ran.

**Final run, tree at `ab57faf4`: defined 159, ran 159, missing 0, broken 0 — killed 159, survived 0.** Baseline before the run: 210 tests in the named files, all passing.

| Group | Rule re-broken | Mutants | Killed |
|---|---|---|---|
| RECON | Reconciliation: each identity, and its call before every write (admission, release, entry, timeout, close) | 10 | 10 |
| OWNED | Every position belongs to an idea | 3 | 3 |
| AON | All-or-nothing entry, covering the comparison and SPY | 2 | 2 |
| MARK | The eligible-mark rule, refusal by refusal | 7 | 7 |
| NOFILL | The pre-check and the three locks in `executeIdeaFill` | 4 | 4 |
| SAME | One name, one idea | 2 | 2 |
| RESERVE | Reads inside the transaction; the slot; the treasury | 3 | 3 |
| CAP | Every admission limit, the floor's rounding direction, calendar, coverage, fingerprint | 11 | 11 |
| ORIGIN, SHAPE | Origin and source rules; thesis length, band, fund type | 5 | 5 |
| CMP | Matched comparisons: same stock, tiers, capital, line level | 7 | 7 |
| CA | Corporate actions once per ledger, the mirror, the line, the delisting, the gap screen | 7 | 7 |
| BMARK | A valuation is never a sale | 4 | 4 |
| STAMP | One close snapshot, its key on every row, mark quality | 6 | 6 |
| GAP, TIME | The gap's basis; entry timing and timeouts | 8 | 8 |
| BOOK, SEAM, MODE | The book, the founder cap, the Film Room seam, the flag's states | 10 | 10 |
| KIND | The kind guard on every quarterly path, and mode `'off'` | 17 | 17 |
| UNION | The shared build set by book kind | 7 | 7 |
| R1, R2, R3 | One per guard added in review round 1 | 32 | 32 |
| RF1, RF2, RF3 | One per guard added in the refuter round | 14 | 14 |

**How it got there.**

- A trial run of 112 mutants before the review killed 109. The three survivors got rows: an incomplete quote with a positive price, an admission racing the close, the daily layer beside a quarterly book.
- The fixes moved the anchors of 14 of the trial's mutants. Each was re-cut by hand; none was left to be skipped silently.
- The first full run at `825ca16e` killed 156 of 158. The two survivors were real gaps in the tests, not in the code:
  - *The book read inside the admission's transaction.* Both racing rows also touch a second document the admission reads, so they were retried even with the book read outside the transaction. A row that changes the book alone now kills it (`ab57faf4`).
  - *The `'off'` gate of the idea-book pass.* It is held in two places: the sweep does not call the pass, and the pass returns before its query. Removing the sweep's gate alone changes nothing observable. The battery now removes both (killed), and the pass's own gate alone (killed). Removing only the sweep's gate is an equivalent mutant and is not counted.
- The three refuters also ran mutants of their own on the fixes. The survivors they reported are the test gaps listed as RF1-4, RF2-5 and RF3-4 above, each now covered by a row and a mutant here.

---

## 7. New stores — founder sign-off required

All are server-only. No rule and no index changes. Each write site is on the protected-store allowlist with a note (`api/_utils/compositionProtectedStoresAllowlist.json`, the `PRACTICE FIELD T1a-1 + T1c` block).

| Store | What it holds | Written by | Readable by a client today? |
|---|---|---|---|
| `mandates/{bookId}` with `kind: 'idea_book'` | The book: all cash, the treasury, slots, open ideas, positions (each stamped with its idea) | `createIdeaBook`, `admitIdea`, `releaseIdea`, `enterIdea`, `closeIdeaBook` | Its owner, under the existing `/mandates/{id}` rule (`firestore.rules:1465`). No client reads it |
| `mandates/{bookId}/epochs/{epochId}` | The book's frozen configuration (limits, versions). Written once | `createIdeaBook` | No (catch-all deny) |
| `mandates/{bookId}/ideas/{ideaId}` | The idea: its frozen contract, its three ledgers, its lines, its history | `admitIdea`, `releaseIdea`, `enterIdea`, `closeIdeaBook` | No |
| `mandates/{bookId}/ideas/{ideaId}/rows/{date}` and `/rows/inception` | One valuation row per close, and the entry row | `enterIdea`, `closeIdeaBook` | No |
| `mandates/{bookId}/dailyRows/{date}`, `/decisions/{id}`, `/corporateActions/{id}` | The book's daily row, one entry receipt per filled name, applied corporate actions | `enterIdea`, `closeIdeaBook` | Its owner, under the existing sub-collection rules. No client reads them |
| `practiceFieldBooks/{uid}` | The owner's one-open-book claim | `createIdeaBook` | No |
| `practiceFieldBooks/_registry` | The count of open books for the founder cap (B8) | `createIdeaBook` | No |
| `practiceFieldCoverage/current` | Which symbols the idea books need data for | `admitIdea`, `releaseIdea`, `enterIdea`, `closeIdeaBook` | No |

Two fields were added to documents the quarterly engine already writes, and only when an idea book is in play: `coverageOnlySymbols` on `mandateUniverseSnapshots/{tickKey}`, and `candidateUniverseOmitted` on that document and on `mandateUniverseDaily/{date}`.

One write is not on the allowlist because the scan resolves its collection as unprotected: the best-effort `lastEntryAttempt` note on an idea when its entry fails (`entry.js:348`, R-20). It moves no money and never creates a document.

---

## 8. Found outside the task

| # | What | Where | Action |
|---|---|---|---|
| O-1 | A lint error on `main`: `sessionDate` is defined and never used | `api/_utils/mandateBatchTransport.js:778` (line 768 at the base) | Not touched. It is an error under the default config (`npx eslint <file>`); the gate config does not check it, so `npm run lint:gate` passes |
| O-2 | The quarterly close's idempotency is equality only (`lastCloseKey === date`): an earlier date closed late would rewrite that date. The cron cannot reach it today | `api/_utils/mandateClosePass.js:177` | Not touched. The idea-book close has the ordered guard |
| O-3 | Three tests in unrelated files are sensitive to machine load: they failed in one full-suite run while another session's suite and three review agents were running, and passed alone | `api/_utils/gemmaClient.test.js` (abort during body read), `src/config/backingBetaFlags.test.js` (importer ratchet, 5 s), `api/_utils/filmTape/tapeReview.test.js` (L2-F1, 5 s) | Not touched. §4.2 |
| O-4 | Quarterly creation's replay read is not kind-aware. Nothing points `userMeta.activeMandateId` at an idea book | `api/_utils/mandateCreationService.js:112` | Not touched (outside the edit list) |
| O-5 | A batch entry that named an idea book would hold its batch open for good. No entry can name one by construction; it is now logged on every fire | `api/_utils/mandateBatchTransport.js:369`, `:788` | Logged; a cleaner disposal is a decision for whoever next works on batch transport |
| O-6 | A throwing idea-book close keeps the close sweep from completing, which holds back retention clean-up for both kinds. The base behaves the same for a throwing quarterly book | `api/cron/mandate-evaluate.js` (the close sweep's shared catch) | Not touched |
| O-7 | The idea-book pass reads one page of 25 books with no ordering. The founder cap is 4; paging is T5 | `api/_utils/practiceField/sweep.js:59` | Logged as `PRACTICE_FIELD_PASS_PAGE_FULL` |
| O-8 | For T1a-2: `closeIdeaBook` cannot close a missed date once a later date has closed (`out_of_order`), and a first close dated before an idea's entry session still writes a row. Recovery needs its own path | `api/_utils/practiceField/close.js:191` | Recorded (refuters RF1-5, RF3-7) |
| O-9 | A coverage read that fails makes the whole fire answer 500 (eval and close), where the same fire without an idea book would succeed. Chosen on purpose: a snapshot built without the idea books' symbols would cost an idea its entry slot; the next fire retries | `api/cron/mandate-evaluate.js:124–140` | Recorded (lens L2-4, refuter 2) |
| O-10 | With an idea book in play the shared build makes about 13 more upstream calls a day in the refuter's fixture, and `MANDATE_CA_FETCH_DEGRADED` counts covered symbols too | `api/_utils/mandateUniverseSnapshot.js` | Recorded (refuter RF2-4) |
| O-11 | The coverage budget does not count a quarterly book's holdings outside the default universe. Unreachable today: 112 symbols are reservable outside the default universe against a budget of 164 | `api/_utils/practiceField/coverage.js:106` | Recorded (refuter RF2-6) |
| O-12 | On the valuation side a mark's value comes from the engine's `markFor` and its quality label from this build's stricter test. A `complete: true` entry with a zero, negative or string price would be valued at that price and labelled `carried_forward`. The snapshot builder cannot emit one | `api/_utils/practiceField/ledger.js:145`, `marks.js:88` | Recorded (refuter RF3-3) |
| O-13 | A reverse split that would round a holding to zero shares is not applied and the symbol is held at a carried mark, but only while the feed presents the action. It needs a ratio beyond about 1-for-4,800 on the $1 minimum leg | `api/_utils/practiceField/ledger.js:91` | Recorded (refuter RF1-3) |

---

*A copy of this report is written outside the repository at the path named in the session's closing message (BUILD_RULES §3).*
