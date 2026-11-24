# Build B3 — the idea book screen (read-only, positions first)

**Date:** 23–24 Nov 2026 · **Branch:** `claude/practice-field-b3-screen` · **Base:** `main` `2a136040` (the #1109 merge; `origin` fetched first, the worktree cut from it, tree clean) · **Code head:** `472bc4b2` · **Final checks at:** `df1fe8fb` · **PR:** the draft PR opened from this branch (this report is its last commit)

**Fix round (24 Nov):** Astra’s review answered in §9 — rulings B3-9 to B3-12, fixes A01–A04, A06, A08–A11, the refuter’s R1–R4; R5 recorded. **State (build):** built, reviewed (three lenses and a refuter; every finding fixed or recorded), battery run (56 of 57 and 19 of 19 killed). Final checks all exit 0: the Linux suite, 38,182 passed, 0 failed; the lint gate; the build, byte-identical to `main`; the rules suite, 889 of 889. **The screen's switch ships off.** Not merged; CI not watched. **Time:** about 2¾ hours, from the first commit (23 Nov, 19:55 CST) to this report (about 22:40 CST). The 8-hour checkpoint was not reached.

| Rule | Held |
|---|---|
| One finished, read-only view built on the server; the client draws strings and does no money arithmetic (B3-1) | Yes. `bookView.js` builds every figure, label and reason; the client picks a colour from `dir` and, at 320 px, an amount's `short` form. |
| The round 2 mock-up is the design of record (B3-2) | Yes, with every difference listed in §5. |
| History shows the result's real five columns as stored (B3-3) | Yes: Lines, Result, Process, Evidence, Adoption, read from the checked result packet. |
| An expanded name shows its shares and position value (B3-4) | Yes. |
| Refusal reasons are a fixed map; an unmapped code reads "Refused: not admitted"; nothing invented or taken from the model (B3-5) | Yes. A test derives the code list from the source, so a new code fails it. |
| SPY is labelled honestly (B3-6) | Yes: SPY's change since the book's first fill, from the book's own records (§3, Q-2). |
| Marks as of the last recorded valuation, said so; no live prices, no ticking, no listener; fetch on open and on focus (B3-7) | Yes. |
| Its own switch, off on merge, pinned (B3-8) | Yes: `PRACTICE_FIELD_SCREEN_ENABLED = false`. |
| No fenced file; no rules or index change; no change to `PRACTICE_FIELD_MODE` or the agent's switches; no write to any store | Yes. |
| No real Firestore, model or EODHD call; no `.env` read | Yes: the in-memory harness and fixtures throughout. |
| With the switch off the app is unchanged: no request, no card, no hub layout change | Yes. With the switch off, every shipped file of the production build is **byte-identical to `main`**, hashed names included; only a source map differs (§4.2). |
| The endpoint returns the caller's own book and nothing else; the uid from the token; no other user's data reachable; a test proves it | Yes (§4, §6). |
| One draft PR; no merge; no CI watching | Yes. |

## 1. In plain terms

**What you get.** When the switch is on, a card appears on your Command Center: both desks' marks, the book's value and today's change ("+$22.55 (+0.02%) today", or "Paused", or "Opens 23 Nov"). Tap it and the idea book opens over the page, exactly as the round 2 mock-up draws it:

- **The book line:** the value, today's change in dollars and percent, the change since the book opened, SPY over the same time, and cash. "Paper money. Your agents run this book; you watch."
- **Positions** (the default tab): one line per desk saying what it did at the last close (tap it to see that desk), then a brokerage-style table — Symbol · Mark · P/L Open · P/L Day — grouped by idea, each group headed by its slot, its desk's mark, "Day 4 of 30" and its gap against its comparison. Tap a name to see its entry, mark and line with the distance to it, its shares and position value, the thesis, the source and today's call. Tap a group's header to see the whole idea. One row opens at a time. Cash at the foot, and "Marks as of the close, 27 Nov."
- **Desks:** each desk's note, its call on each idea, and the drafts it passed on, each with a plain reason ("Refused: the name is not on the price list").
- **History:** finished ideas, newest first; tap one for its five-column result.

**You never act here.** There is no buy, sell, add, trim or approve anywhere; every tap only opens or closes something.

**Where the numbers come from.** The server reads your own book and builds the page. Figures the ledger stores are shown as stored. The few it works out (today's change, since open, SPY, each name's value and P/L, the distance to a line, day n of N) are said in the code and checked against the stored rows to the cent, on the same thirteen-session run B2 used.

**When a number can't be trusted it isn't shown.** A name whose close price was carried shows "Waiting on data", with one plain reason; so do the idea's gap and the book's change that day. A finished idea whose stored evidence doesn't check reads "Not measurable", with why.

**Today, with the agent switched off,** the "since yesterday" lines are empty and the Desks tab has no notes: nothing is credited to a desk that did not check the book. Your positions, cash and History all show.

**What you need to do.** Nothing, to merge: the switch ships off, and the app your players load is byte-for-byte the same as today. To turn the screen on for yourself, follow §8.

## 2. What changed, by file

(Line numbers at the code head `472bc4b2`.)

### 2.1 New

| File | What it holds |
|---|---|
| `src/config/practiceFieldScreenFlags.js:25` | `PRACTICE_FIELD_SCREEN_ENABLED = false` — a zero-import flag module of its own, read by the server (through `mode.js`) and the client (R-1). |
| `src/config/practiceFieldScreenFlags.test.js` | Its pin (the value, the literal, the pointer, no imports, the guard's two entries). |
| `api/_utils/practiceField/bookView.js` | The view, pure. Formatting `:103` `moneyText`, `:108` `signedAmount` (the no-cents form); `:125` `sessionsLeftOf` (the agent's own count); `:140` `allotCents` (each name's value, summing exactly to the row's stored holdings value); `:166` `deriveToday`; `:182` `deriveSinceOpen`; `:239` `prevSymbolOf` (a rename's base); `:249` `nameView`; `:307` `gapOf`; `:337` `callOf`; `:351` `groupOf`; `:402` `settledTodayGroupOf`; `:431` `deriveStrip`; `:476` `refusalReasonOf`; `:497` `desksOf`; `:529` `packetCheck` (hash, parts, and that it is this idea's); `:551` `columnsOf`; `:567` `finishedView`; `:616` `buildBookView` (SPY at `:654`). Its header lists every stored figure and every derived one. |
| `api/_utils/practiceField/bookViewCopy.js` | Every fixed word: the mock-up's strings, `:92` the open-slot sentence, `:101` an Exit not carried out, `:130` the refusal map (B3-5) and `:192` its fallback, `:198` the waiting reasons, `:213` how an idea ended, `:222` why a result is not measurable, `:240` the five columns in plain words. |
| `api/_utils/practiceField/bookViewRead.js` | The reads: `:41` the caller's open book through the claim, checked (idea book, `userId`, active or draining); `:55` a result packet and (only when its hash holds, at most `:35` eight) its parts; `:68` everything else, bounded (46 + 3·I + 20·P documents), in parallel; History `:101` and the first entry `:106` each one single-field range and order (no index). |
| `api/practice-field/book.js` | `GET /api/practice-field/book`: `:34` `private, no-store`; `:35` mode or switch off → 404 before auth; `:37` token → 401; `:40` the mode's gate → 404; `:42` GET only; `:45` the read. |
| `src/components/PracticeField/` | `IdeaBookScreen.jsx` (the page: `:36` book line, `:92` tabs with arrow keys, `:122` strip, `:214`/`:227` the open panels, `:270` the table, `:424` Desks, `:453` the result sheet, `:504` History, `:543` the page), `IdeaBookParts.jsx` (desk marks, quotes, chips, call words, the line track), `IdeaBookEntry.jsx` (`:25` the switch re-exported for the hub, `:27` the card, `:47` the layer, `:65` the hub's component), `useIdeaBook.js` (`:35` the one fetch, `:58` the read keyed by uid and auth epoch), `ideaBookStyle.js` (tokens), `ideaBookCopy.js` (chrome words; `:46` the desktop from 1120 px). |
| Tests | `bookView.test.js`, `bookView.e2e.test.js`, `bookViewCopy.test.js`, `bookViewRead.test.js`, `api/practice-field/book.test.js`, `IdeaBookScreen.jsdom.test.jsx`, `IdeaBookEntry.jsdom.test.jsx`; test support `__testsupport__/bookViewScenes.js` (stored-shape scenes for every state) and `__testsupport__/bookViewFixtures.js` (a copy of B2's thirteen-session run, so B2's pinned dump never moves). |
| `docs/design/practice-field/IDEA_BOOK_ROUND_2.html`, `…/CLAUDE_DESIGN_BRIEF_IDEA_BOOK_ROUND2_POSITIONS_FIRST_NOV23_2026.md` | The two attachments, byte-identical (git blob hashes equal to the attachments'), each with its `docs/README.md` row (`:159`, `:160`). |
| `docs/audits/20261123_B3_PICTURES/` | The picture sheet (§7). |

### 2.2 Changed

| File:line | Change |
|---|---|
| `api/_utils/practiceField/mode.js:88`, `:124` | `practiceFieldScreenOn()` (mode not 'off' AND the switch) and its tests-only setter; the header names the second zero-import flag module. |
| `src/components/CommandCenter/sections/ActivitySection.jsx:19`, `:90` | **The hub's one import and one render site**: a literal ternary on the switch around the existing section (drawn by both compositions: the phone Overview and the wide side column). With the switch off it folds to the old section. |
| `src/components/CommandCenter/commandCenterHub.mount.guard.test.js:670` | One `PERMITTED_TERMINALS` entry for that import (the guard pins every edge out of the hub; Q-1). No other hub test changed. |
| `src/config/flagPinGuard.test.js:65`, `:125` | The new flag module registered; the switch held dark by design. |
| `docs/README.md:159–160` | The two design rows. |

### 2.3 Commits

| Commit | What |
|---|---|
| `ab8c2867` | The mock-up and its brief, byte-identical, with their README rows. |
| `8fc16c27` | The server half: the switch, `mode.js`, the view, its words, the reads, the endpoint, their tests. |
| `638f1665` | The client half: the screen, the card, the read, the hub's one import and render site, their tests. |
| `4507e802` | The style and copy tables marked pure, so the switch-off build drops them (it had carried 335 dead bytes in the hub's chunk). |
| `fa263f17` | The review's fixes (§6), each pinned. |
| `472bc4b2` | The refuter's two (the layer's scrollbar; the allotment's floor). **The code is frozen here.** |
| `09dcec16`, `a5947c8a` | Test rows for the battery's survivors (§6.3). |
| `df1fe8fb` | The picture sheet (§7). |
| last | This report. |

## 3. Rulings and readings, with questions for the founder

### 3.1 Readings — what I decided where the brief was silent (each stands unless you object)

| # | Reading | Why |
|---|---|---|
| R-1 | **The switch is a module of its own** (`practiceFieldScreenFlags.js`), not a line in `practiceFieldFlags.js`. | The client must know the switch without a request, and `practiceFieldFlags.js` is pinned "no module under src/ imports this file", which keeps `PRACTICE_FIELD_MODE` out of the bundle. |
| R-2 | **The gate follows `cardsGate.js`**: the switch or the mode off answers 404 before auth; a uid the mode does not admit gets the same 404; no token with the switch on is 401. | The house order; nobody learns more than "not for you". |
| R-3 | **History checks each result packet before showing any of it**: its hash, every receipt part it records, and that the packet and its parts name this book and idea. A failure reads "Not measurable · Its stored evidence could not be checked." | B2 §8: "a result reader must check the packet's parts as well as its hash." |
| R-4 | **Since open** is the last close's equity against the book's opening value (`portfolio.initialValue`), labelled with the book's first entry session ("Since 16 Nov"); before anything is bought the line reads "Opens 23 Nov". | The mock-up's two forms. |
| R-5 | **SPY** runs from SPY's quote at the book's first fill (the first idea's inception row, its SPY leg) to its vendor-timed close at the last close — the same start the book's figure has. Missing either: "—". The shared close snapshots are never used (they are deleted after 120 days). | B3-6: "from the stored marks"; Q-2. |
| R-6 | **Day n of N** uses the agent's own count (`agentRun.js` `sessionsLeft`): N is the frozen contract's sessions, sessions left run from the last close to the due session, and n = N − left. So the entry close reads "Day 0 of 10" and the due close "Day 10 of 10". | The desk's quoted reasons ("N sessions to its review") and the screen must agree; Q-3. |
| R-7 | **Day P/L** is a name's value at the last close against its value at the close before (each allotted to the row's stored total), or against what it cost if it was bought that session. It is a dash when the close before carried its mark or was not observed (it would span two sessions). A dividend goes to the idea's cash, so a name's day P/L shows the ex-date drop. **Open P/L** is the value against the holding's `costBasisTotal`. | The brokerage convention; review B2. |
| R-8 | **Below full quality, no figure**: a name's P/L, an idea's gap, the book's change today and its change since open all wait, each with one plain reason. | "A row below full quality never shows a P/L"; review B4. |
| R-9 | **The strip speaks only for a desk that checked the book at that close** (the model wrote, or the check failed). In that desk's lane it also says code's facts of the session: the desk's own ideas bought at the window ("opened") and its names sold at their lines ("by code"). A founder's idea is never "opened" by a desk. With the agent off, paused, or no work: no line. | Never credit a desk with what it did not do; review B3; Q-5. |
| R-10 | **An open slot** says "the Shadow desk looks tonight" only when the agent is on and the book is neither paused nor winding down; otherwise "Long · open". | It would be false otherwise (the mock-up's paused frame draws it). |
| R-11 | **Refusals**: several codes on one draft read as their distinct sentences joined by "; ". The drafting path's generic `refused` code reads the fallback, "not admitted". | B3-5. |
| R-12 | **States the mock-up does not draw** get fixed words: a line recognised at the close ("Below its line · code sells at the next session's first window"), an idea settled at its review date and waiting for its sale ("Review date · sells…"), names bought at a window after the last close ("Bought today · first mark at tonight's close", with NEW), a slot whose idea finished today ("Settled today"), an unobserved close, winding down, a delisted holding waiting for a price, and an Exit code did not carry out. | Each is a real state of the engine. |
| R-13 | **The card sits in the Recent activity section**, the one section both compositions draw, above its list. One import, one render site, one guard entry. | B3 §4. |
| R-14 | **The page opens as a layer over the whole app** (a portal on `<body>`; the app behind it inert; Escape and Back close it; focus returns to the card). It is not registered with the hub's own overlay stack. | One import and one render site; no App or router change. |
| R-15 | **The desktop layout starts at 1120 px**; below it the phone table, centred, at most 640 wide. | The mock-up draws the desktop only at 1236; from 900 the table ran into its side panel (review C1). |
| R-16 | **History** lists up to 20 resulted ideas, newest first. A cancelled idea (it never filled) is not a finished idea and is not listed. | B3 §1. |
| R-17 | **The agent's words are shown verbatim**, quoted, signed and dated, as text. | B3 §1; see Q-6 about ids. |

### 3.2 Questions for you

| # | Question | My lean |
|---|---|---|
| Q-1 | The hub's mount guard pins every edge out of the hub, so the one import needs one `PERMITTED_TERMINALS` entry. I read that as part of "one import", not as reshaping the hub's tests. Acceptable? | Yes. |
| Q-2 | SPY's figure (R-5): from SPY's quote at the book's first fill to the last close, labelled "SPY" beside "Since {date}". Keep? | Keep. |
| Q-3 | "Day 0 of 10" on the day the names were bought (R-6), where the mock-up's placeholder drew "Day 1". Keep the agent's count, or count the entry day as Day 1 (and the due day as Day 11)? | Keep: the desk and the screen then say the same thing. |
| Q-4 | History reads and checks up to 20 result packets on every open (about 8 KB each on the test run). Fine for now, or check only the one tapped (a second endpoint)? | Fine for now. |
| Q-5 | With the agent off (production today) the strip is empty (R-9). OK? | Yes; it fills when the agent runs. |
| Q-6 | Review A1: the agent's prompt lists each idea's internal id (`agentPrompt.js:114`), so a model could echo one into a note the screen shows verbatim. It would be the player's own id, never another's. Change the prompt to name ideas by slot, in a small later B2 change? | Yes, later. |
| Q-7 | The founder script's `status` counts sessions left one more than the agent does (today through the due session, both counted). Report only; not touched here. A separate fix? | Yes, a one-line follow-up. |
| Q-8 | Review C7: crossing the app's 768 px split (a phone rotated, a window resized) remounts the hub and closes the page. Inherited; accept for now? | Accept. |

## 4. Tests and checks

### 4.1 The tests this build adds: 141 rows in 8 files

| File | Rows | What they prove |
|---|---|---|
| `api/_utils/practiceField/bookView.test.js` | 63 | **The view on fixtures, each state**: every scene of the design of record (states 1–10 and the sample day) and the undrawn ones (a line recognised, a review date, winding down, the agent off, bought today, an unobserved close, a delisting, a rename, settled today). Also each review fix and each battery survivor, pinned; no id in any field; no banned word. |
| `api/_utils/practiceField/bookView.e2e.test.js` | 1 | **Figures to the cent on the B2 end-to-end fixture.** It walks B2's thirteen-session scripted run close by close, and at each close checks against the stored rows: the book's value, today's change, since open and cash; each idea's gap; each name's value (the allotted cents sum to the stored holdings value), open and day P/L; Day n of N; SPY. It also counts the reads (within 46 + 3·I, 3 queries) and checks that no id appears. |
| `api/_utils/practiceField/bookViewCopy.test.js` | 5 | The refusal map (B3-5) covers exactly the codes the drafting path writes, **derived from the source**, so a new code fails here. Every sentence is plain. The failed-check sentence is the agent's own. No fixed word says "validated", "proven" or "supported". |
| `api/_utils/practiceField/bookViewRead.test.js` | 2 | Every scene, stored at its Firestore paths and read back through the reader, equals the view built directly. History holds at most 20, newest first, resulted ideas only. |
| `api/practice-field/book.test.js` | 15 | **The endpoint:**<ul><li>401 with no token;</li><li>404 when the switch or the mode is off (before auth, nothing read), and for a uid the mode does not admit;</li><li>`{ book: null }` for a uid with no book, a claim naming **another owner's book**, or a closed book;</li><li>**user A can never receive user B's book**: no query, body or header value reaches it;</li><li>the answer holds **no id at all**;</li><li>`private, no-store` on every answer from the gate on;</li><li>GET only;</li><li>the store is **byte-identical after a read**;</li><li>a failed read is 500 with no detail.</li></ul> |
| `src/config/practiceFieldScreenFlags.test.js` | 3 | **The switch is off**, a plain literal with its pointer, in a module with no imports. The guard scans it and holds it dark. |
| `src/components/PracticeField/IdeaBookScreen.jsdom.test.jsx` | 35 | **The screen**: each state's fixed words; the fit test at 320; one row open at a time; the panels; the tabs with arrow keys; Desks; History and the five-column sheet (Escape, the inert page); loading, empty and error; the heading's focus. No buy, sell, add, trim or approve control anywhere, on any tab or in the sheet. |
| `src/components/PracticeField/IdeaBookEntry.jsdom.test.jsx` | 17 | **Switch off:** no request, no card, and the hub's site draws exactly the old section. **Switch on:**<ul><li>one read; no card without a book;</li><li>the page as a layer (the app inert, Escape, focus back);</li><li>a read on focus, never on a timer;</li><li>keyed by owner, so an identity changed in place never shows the earlier owner's book;</li><li>a stale answer is dropped;</li><li>a 404 is not asked again;</li><li>a remount draws its last answer.</li></ul> |

Two existing guard files gained one entry each, with no row changed: `flagPinGuard.test.js` (the module registered; the switch held dark) and `commandCenterHub.mount.guard.test.js` (the hub's one new import; Q-1). Every hub suite passes unchanged.

### 4.2 The checks, at the final code (`df1fe8fb`; code frozen at `472bc4b2`, `origin/main` still `2a136040`)

| Check | Command | Exit | Result |
|---|---|---|---|
| The full Linux suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` (WSL, a clean LF worktree at `df1fe8fb`) | **0** | Test Files **1656 passed** \| 14 skipped (1670) · Tests **38182 passed** \| 197 skipped (38379) · 0 failed · 333 s |
| The lint gate | `npm run lint:gate` | **0** | No output (no error, no warning) |
| The build | `npx vite build` (WSL), `main` `2a136040` and `df1fe8fb` built side by side | **0** and **0** | **125 files each.** Every shipped file (JS, CSS and HTML) is byte-identical, hashed names included. One source map differs, `CommandCenterHub-*.js.map`, which embeds the hub section's source text (the ternary's dead arm); maps are not loaded by players. With the switch off, the app players load is `main`'s, byte for byte. The same holds for the pushed head (this report's commit), built again before the push. |
| The rules suite | `npm run test:rules` (Firestore emulator on Windows; WSL has no Java), from an LF snapshot of `df1fe8fb` (`git -c core.autocrlf=false archive`; `firestore.rules` checked against `git show` with `cmp`) | **0** | Test Files **48 passed** (48) · Tests **889 passed** (889). `firestore.rules`, `firestore.indexes.json` and `test/rules/` are unchanged from `main`. |

**One note on the rules suite.** Run from this Windows worktree, which stores files with CRLF line endings, it exits 1 on a single row (888 of 889 pass). The row is `agentEvalRunsDenials.rules.mjs`, "ONE block for the collection, saying exactly `allow read, write: if false;`". Its comment-stripper, `/\/\/.*$/` with no `m` flag, cannot strip a comment from a line that ends in `\r`, so it reads `allow read, write: if false;  // Admin SDK only`. Both that test and `firestore.rules` are byte-identical to `main`, and the assertion is pure text, so `main` fails it the same way on a CRLF checkout. On LF, as CI checks out, it passes. It is not this build's; a one-line fix (`/\/\/.*$/m`, or trimming `\r` first) is a separate change.

No real Firestore, model or EODHD call was made, and no `.env` file was read: every test runs on the in-memory store and fixtures.

## 5. Where the screen differs from the mock-up, and why

| # | Difference | Why |
|---|---|---|
| D-1 | The desktop layout starts at 1120 px (the mock-up draws it only at 1236). | Below that the fixed columns overflow the side panel (review C1). |
| D-2 | The desk marks are static SVG stills (a teal core for the Shadow desk, a silver core and ring for the archetype desk), not the identity engine. | No WebGL for a 24 px mark; the engine is a heavy lazy chunk. |
| D-3 | The app's font stack (system sans, system mono) replaces JetBrains Mono and Schibsted Grotesk. | The app loads neither font. The buy sentence fits one line at 320 where the mock-up wrapped. |
| D-4 | An expanded name shows its shares and position value (the mock-up's note: "Share counts are not shown anywhere"). | Ruling B3-4. |
| D-5 | The result sheet shows the result's five stored columns, with the gap under Result; History rows open it; it has a scrim, a real Close button, and is a centred dialog on the desktop. | Ruling B3-3; the mock-up drew the sheet but did not wire it. |
| D-6 | "Day 0 of 10" on the entry close (the placeholder drew Day 1). | R-6, Q-3. |
| D-7 | SPY starts at the book's first fill. | R-5. |
| D-8 | The strip is empty with the agent off or the book paused, and a founder's idea is never "opened" by a desk. | R-9. |
| D-9 | An open slot says a desk "looks tonight" only when one does. | R-10. |
| D-10 | On a day below full quality, since open waits too (the mock-up's waiting frame shows it). | R-8. |
| D-11 | At 320 a group header's gap of $10,000 or more drops its cents, like the P/L columns. | The designer's fit note, applied to the header too. |
| D-12 | The "Sells at the next session's first window." box shows for every idea waiting for its sale, not only an Exit. | The same sentence is true of each. |
| D-13 | A sold name's ledger shows its entry from the line's fill (none after a split). | The mock-up shows it; review C5. |
| D-14 | New states, loading, empty ("No idea book yet.") and error. | R-12; B3 §3. |
| D-15 | The phone header's back chevron sits left of the title (the mock-up mirrors a right chevron and pulls the title in); the desktop breadcrumb is a Back button. | The page needs a way back; cosmetic. |
| D-16 | The tab bar draws three tabs; it takes an array and scrolls, so later tabs slot in without a redesign. The later-tabs variant is not drawn. | B3 §3. |

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

- **Three lenses**, each a fresh reviewer in its own copy of the tree at `638f1665` (the whole build, before any review fix), each told only its lens and the brief:
  - **(a) the endpoint, auth and privacy:** 7 findings (A1–A7). All were notes, and none was a blocker.
  - **(b) the figures against the ledger:** 10 findings (B1–B10) and 6 small notes. The reviewer read `close.js`, `ledger.js`, `settlement.js` and `evidence.js` against the view.
  - **(c) the screen against the mock-up:** 19 findings (C1–C19). The reviewer rendered the real components in headless Edge at 320, 390 and 900–1236 px, measured them, and ran 21 mutants of the client.
- **One refuter took every finding.** It worked in a fourth tree, verified byte-equal to `638f1665` before and after every mutant, and tried to break each finding:
  - it wrote probe tests on the scenes;
  - it rebuilt lens (c)'s browser harness from its own tree;
  - it re-ran the surviving mutants itself (the runner's controls were killed, so a survivor is a real survivor).
  - It confirmed **three blockers (B1, B2, C1)**, downgraded B3 to minor, and found one new note (the page layer hid its scrollbar). Every other finding it confirmed as minor or a note, and B7 only in part.
- **The blocker bar** (B3 §6): a wrong figure; another user's data; a control that writes; something a player would plainly see broken on a normal day. **None of the three lenses or the refuter found another user's data reachable, or a control that writes.**
- **Fixes:**
  - `fa263f17`: the lenses' findings.
  - `472bc4b2`: the refuter's scrollbar note, and the cent allotment's floor.
  - Each fix is pinned by a test row, and the battery (§6.3) reverts each one and checks that a row fails. Then the code was frozen. Everything after `472bc4b2` is tests, pictures and this report.

### 6.2 Every finding and what happened to it

| # | Lens | Refuter | Finding | Disposition |
|---|---|---|---|---|
| B1 | b | **BLOCKER** | An unmeasurable result showed a gap under "Not measurable" in the sheet's Result column. `settlement.js` always stores a finite gap, so this happened on every unmeasurable result. | **Fixed:** no gap under Not measurable, anywhere. Row; mutant V42 killed. |
| B2 | b | **BLOCKER** | A name's day P/L was measured against a carried or unobserved previous close. On the first close after a data gap, BAC read **+$174.90** in green where the day was −$31.80. | **Fixed:** a dash when the close before carried the name's mark or was not observed (R-7). Rows; V32 killed. |
| C1 | c | **BLOCKER** | From 900 to about 1066 px the desktop table ran under its side panel. At 960 px, an ordinary half-screen window, figures were painted under the desk's words. | **Fixed:** the desktop layout starts at 1120 px, where "To its line" gives way first. Below that the phone table is used, centred (R-15, D-1). Pictures `960-full`, `1120-full`; K09 killed. |
| B3 | b | minor | The strip credited a desk that had not checked the book (agent off, no close row), and called a founder's idea "opened" by a desk. | **Fixed** (R-9, Q-5). V34, V35 killed. |
| B4 | b | note | With the last close waiting on data, since-open still showed a figure. | **Fixed:** it waits too (stricter than the mock-up's waiting frame; D-10). V36 killed. |
| B5 | b | minor | An Exit that code did not carry out (`ignored_already_selling` and others) read as today's call, with nothing saying so. | **Fixed:** under the call it says why nothing happened (for example "It was already selling, so nothing more was done."). The idea counts as held. V38 and K15 killed. |
| B6 | b | minor | A holding left waiting by a delisting read as a plain missing price. | **Fixed:** "Delisted · code sells it when a price comes". V39 killed. |
| B7 | b | partly / note | SPY's base was a different moment from since-open's. | **Fixed:** SPY runs from its quote at the book's first fill (the inception row, vendor-timed) to the first clean SPY close mark (R-5, Q-2). V19 and V19b killed. |
| B8 | b | note | Names bought after the last close were not marked NEW. | **Fixed.** V40 killed. |
| B9 | b | note | On a rename session the renamed name's day P/L was a dash. | **Fixed:** the day P/L is against the old symbol's close. V37 killed. |
| B10 | b | minor (tests) | The end-to-end test used the module's own `allotCents`, so three allotment mutants survived. A truncate→round change is not equivalent (it gives a different cent on ties). | **Fixed:** `allotCents` floors explicitly, and a tie case is pinned with expected cents written by hand. V01 killed. |
| B notes | b | note | (1) −$0.01 showed a red "0.00%". (2) N came from the slot table, not the frozen contract. (3) "Ended early: every name was sold" after a cash delisting. (4) A standing reason read as "held". (5) A settled-today idea whose evidence fails says "Not measurable". (6) The dividend's ex-date day P/L. | (1)–(4) **fixed**: no colour when the text rounds to zero; N from `contract.schedule.sessions`; "Ended early: nothing was left to hold"; the standing-reason sentence. (5) **kept**: the History row and its sheet say why. (6) **kept**, the brokerage convention (R-7). |
| A1 | a | note | The agent's prompt lists each idea's internal id, so a model could echo one into a note the screen shows verbatim. It could only be the caller's own id. | **Founder question Q-6** (change the prompt, a B2 follow-up). The view's own fields carry no id; the agent's text is shown as written (R-17). |
| A2 | a | note | `packetCheck` did not check that a packet names this book and idea. | **Fixed:** the packet and its parts must name this book and idea. V33 killed. |
| A3 | a | note | Ideas are read by id under the caller's book. | **No change:** the book is checked to be the caller's first (`ownOpenBook`), and only the Admin SDK writes there. |
| A4 | a | note | The read bound was stated in queries, not documents, and the reads ran one after another. | **Fixed:** the header states 46 + 3·I + 20·P documents. Independent reads run in parallel. Parts are read only after the packet's hash holds, at most 8. The end-to-end test counts reads against the bound. |
| A5 | a | note | After a 404 the card asked again on every focus. | **Fixed:** a 404 is not asked again for that owner. K04 killed. |
| A6 | a | note | The security middleware runs before the gate. | **No change:** by design, the `cardsGate.js` order. |
| A7 | a | note | Could a stale answer show one person another's book after a sign-out? | **No change needed:** the token is taken at request time, and an answer for another key is dropped. Rows now pin both the key filter and the stale-answer drop (K01, K02 killed). |
| C2 | c | minor | After a click on plain text, Escape did not close the page. | **Fixed:** the layer takes focus. Row. |
| C3 | c | minor | Tab left the result sheet; Escape there closed the page too. | **Fixed:** the page behind the sheet is inert, and the sheet takes focus. K08 killed. |
| C4 | c | minor | A settled-today group showed a past call under "Today's call". | **Fixed:** "Last call". K16 killed. |
| C5 | c | minor | A name sold at its line lost its entry price. | **Fixed:** the entry comes from the line's fill (none after a split; D-13). |
| C6 | c | minor | A line recognised at the close read "−0.3% away". | **Fixed:** "0.3% below its line". V41 killed. |
| C7 | c | minor (inherited) | Crossing the app's 768 px split remounts the hub and closes the page. | **Founder question Q-8**; inherited from the app's layout switch. |
| C8 | c | minor | A remounted card popped in only after a new request. | **Fixed:** it draws its last answer at once and refreshes. K05 killed. |
| C9 | c | minor (tests) | The no-trading-control test scanned only Positions. | **Fixed:** it scans every tab and the sheet. K10 killed. |
| C10 | c | minor (tests) | The key filter and the stale-answer drop were not pinned. | **Fixed:** rows with deferred answers. K01, K02 killed. |
| C11 | c | minor (tests) | A polling timer would not have failed a test. | **Fixed:** a row advances hours of timers. K03 killed. |
| C12 | c | note | The rest of lens (c)'s 21 client mutants. | Superseded by the battery (§6.3). |
| C13 | c | note | The tabs had no arrow keys. | **Fixed:** arrow keys, with only the selected tab in the Tab order. K13 killed. |
| C14 | c | note | The error state repeated the title. | **Fixed:** "The book could not be read just now. It reads again when you come back to this page." |
| C15 | c | note | The hub wraps the section in a flex column. | **No change:** with the switch off the ternary folds away (the build is byte-identical); with no book the card renders nothing. |
| C16 | c | note | The open sheet was an index, so a refresh could swap it. | **Fixed:** keyed by the idea's slot, names and end date (no id). |
| C17 | c | note | If a read answers 404 while the page is open, focus has no card to return to. | **Kept** (the page closes; nothing is shown). |
| C18 | c | note | The layer did not contain overscroll. | **Fixed.** |
| C19 | c | note | The header's label omitted a waiting gap, and hover beat the open row's background. | **Fixed:** the label says when its gap waits; hover only on devices that hover. |
| New | refuter | note | The layer hid its scrollbar, so the desktop page scrolled with no bar. | **Fixed** (`472bc4b2`): only the tab strip hides its bar. |

### 6.3 The fast battery (BUILD_RULES §2; `scripts/practice-field/battery/run-battery.mjs`)

Each mutant reverts one guarantee: a fix above, a gate, a figure's rule, or a privacy rule. It must make a test fail.

- **The view, the reads and the endpoint:** 57 mutants at `472bc4b2`, run against the server rows. Every tree was the commit's bytes, the baseline was green, and none was broken or skipped.
  - First run: 50 killed, 7 survived:
    - the allotment's defensive branch (V01);
    - the 1% near threshold (V08);
    - waiting drafts counted as passed on (V14);
    - unchecked receipt parts (V16);
    - the unobserved row's reason (V27);
    - the reader's History cap and order (R03, R04).
  - Rows were added for the six that were not equivalent (`09dcec16`). They pin the survivors, and a reader test stores every scene and reads it back through `readBookView`. The 7 were then re-run at `09dcec16`: 6 killed.
  - **Result: 56 of 57 killed, 1 equivalent.** The survivor, V27, removes `rowReason`'s shortcut for an unobserved row. It is equivalent: the close writes every mark of an unobserved row with quality `unobserved` (`close.js:254`), so the loop that follows returns the same sentence. "No close was recorded for {date}." takes no symbol.
  - The privacy mutants are all killed:
    - the claim read for another owner (R01);
    - a closed book (R02);
    - the uid taken from the query (E06);
    - the switch or the mode's gate ignored (E01, E02, M01);
    - auth moved after the switch (E05);
    - the cache header (E03);
    - ids leaking into the view (V31).
- **The screen, the card and its read:** 19 mutants at `09dcec16`. First run: 16 killed, 3 survived (the read's key filter, its stale-answer drop, and the heading's focus). Rows were added (`a5947c8a`), and the 3 re-ran at `a5947c8a`: 3 killed. **Result: 19 of 19 killed.**

## 7. The picture sheet

`docs/audits/20261123_B3_PICTURES/` holds 55 PNGs, shot from the frozen code (`472bc4b2`), rendered in headless Edge (2× pixels) from the **real components** drawing **server-built views** of the scenes (`bookViewScenes.js` through `buildBookView`), with the app's own CSS (`index.css`, `tokens.css`, `holographic.css`). File names are `<width>-<state>.png`:

- `390-…` and `320-…` for the sample day and every state: `full` (1), `newBook` (2), `newToday` (3), `nearLine` (4), `lineHit` (5), `lineRecognised` (5b), `exitCalled` (6), `reviewDate` (6b), `waiting` (7), `failed` (8), `paused` (9), `nameOpen` and `ideaOpen` (10), `fit` (the fit test, the long idea open), `windingDown`, `agentOff`, `boughtToday`, `unobserved`, `settledToday`; the dashed line marks the fold (844 at 390, 568 at 320);
- Desks and History at 390 (and the 596-character note and a not-measurable result at 320), the five-column result sheet;
- `desk-full.png` and `desk-newBook.png` (desktop, states 1 and 2, the Medium idea open in the side panel); `960-full.png` and `1120-full.png` (the cut-off, both sides of it);
- `390-entry-card.png` and `320-entry-card.png` (the card's three variants); `390-page-loading/empty/error.png`.

The same harness measured every frame for horizontal overflow: **0 of 55 frames overflow** (no element wider than its row, no page scroll sideways). At 390 the full book (state 1) ends its cash row at 839 px, inside the 844 fold; at 320 it needs 838 px, so the 568 fold falls inside the second idea, as the designer's note expects. The scenes' names, theses, calls and notes are the mock-up's own words; their money is made consistent the way the close makes it, so it differs from the mock-up's placeholders.

## 8. Your steps to turn the screen on

Nothing here is done by this PR. Merging it changes nothing: the switch ships `false`, and every shipped file of the production build is byte-identical to `main`'s.

1. **Merge this PR** and let it deploy.
2. **Open the flip PR** (one commit, BUILD_RULES §2):
   - `src/config/practiceFieldScreenFlags.js`: `PRACTICE_FIELD_SCREEN_ENABLED = true`;
   - `src/config/practiceFieldScreenFlags.test.js`: its first row to `true`;
   - `src/config/flagPinGuard.test.js`: remove the `PRACTICE_FIELD_SCREEN_ENABLED` entry from `DARK_BY_DESIGN`.
3. **Who sees it:** `PRACTICE_FIELD_MODE` is `'allowlist'`, so only a uid on `COCKPIT_ALLOWLIST_UIDS` gets the card; everyone else gets a quiet 404 and no card.
4. **Check it** on the preview, then production: open the Command Center (phone Overview, or the desktop's side column) and find the Idea book card above Recent activity; open it and compare with the picture sheet and the mock-up. With the agent still off, expect no strip lines and no desk notes.
5. **To stop it**, revert the flip commit.

## 9. Fix round, Astra's review

**Date:** 24 Nov 2026 · **Started at:** `a8683e40` (the PR head Astra reviewed; `origin` fetched first, `origin/main` still `2a136040`) · **Review:** `docs/audits/20261124_ASTRA_REVIEW_B3.md`, committed byte-identical first (`f64fea84`, SHA-256 `a9ce66c74145b7203fff0a4ed63e11df618fca46e87edadd2978f2d2692388f8`) · **Code head:** `e18aed95` · **Final checks at:** `098df906 (tests only after the code head)` · **The screen's switch still ships off.** Not merged; CI not watched.

### 9.1 In plain terms

Astra found that the screen could show figures it should not, on days the engine itself says are not final:

- **A name could show its value and P/L while its idea's ledger was on hold** (an unresolved corporate action, or a late payment waiting for your approval). Now every name of a held idea reads "Waiting on data", with the reason, and shows no money figure. A name that waits only because its own price is late still waits alone; its siblings keep their figures.
- **The book's headline showed a value on a day the last close was not final** (a day with no close recorded, or a first close with a late price). Now the headline reads "Waiting on data" with one plain sentence, and today's change, since-open and SPY show a dash. Cash still shows. The Command Center card says the same (ruling B3-11).
- **SPY could start at the second fill of the first day.** It now starts at the book's first fill, by the stored fill time.
- **A close landing while the page reads could show $0.00 for the day under the old date.** The reader now notices that the book and its rows disagree, reads once more, and never measures a day against itself.
- **Your own thesis was signed by the desk that manages it.** Now a thesis is signed by who wrote it: "The founder", or the drafting desk. The managing desk stays on the idea and on its calls (ruling B3-12).
- Smaller items: "Entered today · N sessions" on an idea's first close; the page closes when the screen is switched off while it is open; an Exit that code did not carry out is said so in the strip, never counted as "held"; the read bound is corrected.
- **The build question (A05)** was settled by your ruling B3-9: a source map is not the shipped app. Nothing was built for it.

One refuter then broke the first version of the hold rule in a case close.js also holds (a founder's correction not yet posted). That and three smaller findings are fixed (§9.7).

### 9.2 The founder's rulings for this round (verbatim)

| # | Ruling |
|---|---|
| **B3-9** (A05) | **A source map is not the shipped app.** With the switch off, the test is: every non-map file of the production build is byte-identical to `main`, and no request is made. The hub's `.js.map` may differ. **Do not build Astra's build-time wiring.** Record the ruling and the two map digests in the report |
| **B3-10** (A07, amends Q-5) | **The page shows what the last close recorded.** If a desk checked the book at that close, its strip line, calls and notes show, whatever the agent switch says now. With the agent off, later closes record no desk work, so they are empty from the next close. Only the forward-looking lines ("the desk looks tonight") follow the switch. **No code change; one test row** |
| **B3-11** (A02) | **A book line below full quality waits.** The headline value, today's change, since-open and SPY read as waiting. Cash still shows. The entry card says the same |
| **B3-12** (A06) | **A thesis is signed by who wrote it.** The managing desk stays on the group and on its own calls |

**B3-9's two map digests** (Astra's, verbatim, review §B3-A05): base `5ba52150103646e155e2859ae230d7c31ba38aaa78cd539749a935fbac1c7cd4`, PR `613a5bd72d912e345dfa5eef99316ae8e37e76a0eb1041eaeaf8d7582c46fe0e`. This round's own build (WSL, `main` `2a136040` against the final head, §9.9): `main` `51897822dfec6dd68009292eee80d94499a6ba7e219d1a29e39b05828312a965`, this branch `f1a246b25fbaecc016a60294740c26d645f09c210bba36dd1db6af3a44e761b3` (`assets/CommandCenterHub-BjyaK3Ey.js.map`). The digests differ from Astra's because a source map embeds the builder's paths; what matters under B3-9 is that every non-map file matches.

**B3-10 amends** Q-5, reading R-9 and §8 step 4: with the agent off, the strip, calls and notes still show what the last close recorded; they empty from the next close, which records no desk work.

### 9.3 Each fix, by file and line

| Item | Fix | Where |
|---|---|---|
| **A01** | One helper, `ledgerHeld(row, idea)`, inverts close.js's own `fullQuality`. An observed row below full quality is held by its ledger when it names a standing reason, or when every mark of its three legs is the vendor's own (nothing but a hold can then keep it below). Beside a non-vendor mark the row cannot say: for the last close the idea as that close wrote it answers (its three ledgers' open holds, and a founder's correction not yet posted, as close.js tests them); for the row before, it counts as held. A held idea's names wait with the hold's reason and no figure; its gap gives the hold's reason. The comment says how close.js records a hold. | `bookView.js:215` (`ideaHasHold`), `:241` (`ledgerHeld`), `:326` (names), `:338` (the row before), `:370` (gap), `:458` |
| **A02 / B3-11** | `lineWaits` when the last daily row exists and is below full quality: `value: null`, `waiting: { text, reason }`, `today: null`, since and SPY a dash, cash from the row's own fields. A book with no row yet is unchanged. `BOOK_VIEW_VERSION` 2 on both sides. The page and the card draw it; the card's label says it. | `bookView.js:733`, `:758`; `bookViewCopy.js:32`; `IdeaBookScreen.jsx:41`; `IdeaBookEntry.jsx:29`; `ideaBookCopy.js:51`, `:56`; `useIdeaBook.js:21` |
| **A03** | The first inception is the idea with the earliest stored `entry.filledAt` (one writer, `Date#toISOString()` at `entry.js:317`: a fixed-width UTC string, so it sorts as the instant; the automatic single-field index; no index added). Its session names the label. | `bookViewRead.js:132` |
| **A04** | The close writes the book's `lastCloseKey` and its daily row in one transaction, so a book and latest row that disagree mean a close landed mid-read: steps 1–3 are read once more, and the view is built from that read. The reader takes the session's own row and the latest row strictly before it (three rows read, so two closes during one read still give both); the view refuses a "previous" row that is not strictly earlier. (The harness's transactions take refs, not queries, so the re-read route.) | `bookViewRead.js:86`, `:105`, `:112`; `bookView.js:450` |
| **A06 / B3-12** | `byline` from `contract.thesis.author`: `founder_fixture` → "The founder", `agent` → the drafting desk; anything else none. Positions and History draw `byline · date`, never "null". | `bookView.js:388`; `ideaBookCopy.js:65`; `IdeaBookScreen.jsx:200`, `:498` |
| **A07 / B3-10** | No code. One row. | `bookView.test.js` (B3-10 row) |
| **A08** | "Entered today · N sessions" on the entry close; `day` and `of` unchanged. The idea panel's line may now wrap at 320 (it overflowed by 3 px in the fit test). | `bookView.js:472`; `bookViewCopy.js:89`; `IdeaBookScreen.jsx:248` |
| **A09** | A refresh answering 404 — or no book — while the page is open closes the layer (which lifts `inert`) and puts focus on the first control beside the card. | `IdeaBookEntry.jsx:74`, `:96` |
| **A10** | The bound restated: one pass 48 + 3·I + 20·P (Astra's 47, plus the third daily row); with the re-read 53 + 4·I + 20·P; I counts unique ideas; 3 queries, 4 with the re-read. The tests count to it. | `bookViewRead.js:11` |
| **A11** | An Exit not carried out is not a hold: "called Exit on XOM (not carried out)", its names counted once; an Exit with no name held says nothing. | `bookView.js:539`, `:546`; `bookViewCopy.js:124` |

### 9.4 The rows

The B3 rows are now **171 in 9 files** (141 in 8 before). New: `api/_utils/practiceField/bookView.fixRound.test.js` (20 rows, **every one through the real engine** on the in-memory store — admission, the entry at its window, `closeIdeaBook`, the founder's ruling, the catch-up — then `readBookView`), one row in `bookView.test.js`, five in the screen's jsdom file and four in the card's.

| Item | Astra's confirm row, as she wrote it | Where |
|---|---|---|
| A01 | The conflict gone from the feed but unresolved on the ledger: AAPL (her BAC) and its sibling read "Waiting on data", with no value and no P/L — and, the close before, the mixed case (AAPL carried beside the open conflict). After the ruling: figures again, but no day P/L against the held row; one clean close later, day P/L to the cent. | `bookView.fixRound.test.js` "Astra's row: the conflict gone…" |
| A01 | The open proposal after AAPL's sale (T2D-03's run): the surviving MSFT waits. | "…the open proposal after AAPL's sale…" |
| A01 | Unchanged: one name's untimed mark holds that name only; its sibling keeps value, open and day P/L (state 7). | "unchanged: a row below full quality ONLY because…" |
| A01, refuter | R1: a founder's correction not yet posted, beside a carried mark — every name waits. R2: a held row is never the next day's base. | "R1: …", "R2: …" |
| A02 / B3-11 | One entered idea, no previous valuation, its first close below full quality (untimed AAPL): the waiting headline, no figure, cash from the row. The unobserved close with a prior row: the same. A new book with no row: unchanged. Card: the waiting headline and reason, and its label; refuter R3: a paused book's card says why. Page: the headline, no today block, since and SPY dashed, cash the only dollar figure. | fixRound "B3-A02 …" (3); `IdeaBookEntry.jsdom.test.jsx` "B3-11 …" (2); `IdeaBookScreen.jsdom.test.jsx` "B3-11 …" |
| A03 | Two ideas entering on one day, fills at 15:02 and 17:47 UTC, SPY 500 then 550, close 560: **+12.00%** for both admission orders × both document-id orders (four rows; the fills' stored instants are asserted). | fixRound "B3-A03 …" |
| A04 | The real 18 Nov close committed between the book read and the row read: either complete dated answer accepted, $0.00 rejected (this reader answers 18 Nov, against 17 Nov, with its re-read counted to the bound). Two closes during one read. The pure view refuses a row of the session as its "previous". | fixRound "B3-A04 …" (3) |
| A06 / B3-12 | The founder-authored medium thesis managed by Shadow, on the B2 run: "The founder" in Positions, the group's desk Shadow, Shadow's call; in History, a founder's finished idea signed "The founder", an agent's by its drafting desk, any other author unsigned (and the caption never "null"). | fixRound "B3-A06 …" (2); `IdeaBookScreen.jsdom.test.jsx` (2) |
| A07 / B3-10 | With the agent off and a close row holding desk records: strip, calls and notes show; the open slot says no desk looks. With the agent off and a later close row with no desk work: all empty. | `bookView.test.js` "B3-10 …" |
| A08 | "Entered today · 10 sessions" in place of "Day 0 of 10", `day` 0 kept (scenes, the screen, the B2 run's first close; "Day 1 of 30" the next). | `bookView.test.js`, `IdeaBookScreen.jsdom.test.jsx`, `bookView.e2e.test.js` |
| A09 | A refresh answering 404 with the page open: layer gone, `inert` lifted, focus on the next control. Refuter R4: an answer of no book, the same. | `IdeaBookEntry.jsdom.test.jsx` (2) |
| A10 | An idea in both the open set and a slot is read once; the e2e row counts to 48 + 3·I with I unique. | fixRound "B3-A10 …"; `bookView.e2e.test.js` |
| A11 | Refused, already selling, not entered: "called Exit on XOM, CVX (not carried out)", never "held"; beside another desk's part; an Exit with no name held says nothing. | `bookView.test.js` "B5 … B3-A11 …" |
| Battery | A standing reason beside a carried mark; a row held with every mark fresh stays held after its hold is ruled; `deriveSinceOpen` alone. | fixRound "the battery's survivors of the fix round, pinned" |

**Still passing, unchanged:** the figures to the cent on the 13-session run (§9.5), the privacy rows (`api/practice-field/book.test.js`, 15, untouched), and the switch-off rows as B3-9 states them (`IdeaBookEntry.jsdom.test.jsx`: no request, no card; the build: §9.9). Four existing rows moved, each with its fix: Day 0 → Entered today (A08); the waiting scene's `today` (B3-11); the thesis `deskName` → `byline` (B3-12); and B5's "held 2" → the not-carried-out part (A11).

### 9.5 The 13-session run

The B2 fixture's thirteen closes were read through the reader at `a8683e40` and at the fix code, and every field of every view diffed. **124 fields differ, every one from a fix, and no figure moved:** `version` 1 → 2 (13); `line.waiting: null` added (13); `thesis.deskName` → `thesis.byline` in groups and History (94: 47 removed, 47 added; the founder's medium idea now reads "The founder"); and "Day 0 of N" → "Entered today · N sessions" on the four entry closes. The end-to-end test's pins did not need to move; it gained the A08/A06 checks and the restated bound.

### 9.6 The battery

`scripts/practice-field/battery/run-battery.mjs`, tiered, with `--prior`; the mutant manifests stay in the session scratchpad (they belong to this PR's code). **Final: server 38 of 39 killed, 1 equivalent; client 12 of 12 killed.**

- **First run, at `0afb8fdd`:** 46 mutants (the build's 15 that these fixes touch, its 3 whose anchors moved — V32, V09, R06 — re-anchored, and 28 new `FX` mutants, at least one per fix), `--prior` the build's three results. 31 killed, 15 survived. **12 of the 15 were not real:** they are client mutants, and the runner's default row set is the five server paths, so no jsdom row ran (the build ran its client battery with `--rows src/components/PracticeField`). The 3 real ones were pinned: V36 (`deriveSinceOpen`'s dash is now also given by B3-11's override, so only a direct row reaches it), FX05 (a standing reason beside a carried mark) and FX17/FX18 (the reader's own "last" and "previous" picks — reached only when a re-read disagrees too, which showed the third-daily-row gap in §9.7).
- **Second run, at `e18aed95` (after the refuter's fixes):** server 39 (FX02 re-anchored; FX29 R1, FX30 R2, FX31 the third row), `--prior` the first run: **37 killed, 2 survived.** Client 12 with `--rows src/components/PracticeField` (FX11 and FX24 re-anchored; FX32 R3, FX33 R4): **12 killed.**
  - **V27** survives as in the build: equivalent (an unobserved row's marks are all `unobserved`, `close.js:254`).
  - **FX03** (the "every mark fresh" shortcut removed) survived because R2's careful default covers it for the row before. Pinned (`098df906`: a row held with every mark fresh stays held after its hold is ruled), re-run alone: **killed**.
- Every tree was the commit's bytes, every baseline green (1,749 rows in 56 files; 61 in 2), no mutant broken or skipped.

### 9.7 The refuter

One refuter, on a snapshot of `0afb8fdd`, read-only, told to break each claim with a repro on the real engine.

| # | Finding | Severity (screen on) | Disposition |
|---|---|---|---|
| R1 | close.js also holds a row for a founder's correction not yet posted (`founderRulings`, `correction_pending`), which is not a ledger record. Beside a carried mark, the sibling MSFT showed $9,997.00 and −$3.00. | blocker | **Fixed** (`ideaHasHold`); row on the engine's own deferred-correction path. |
| R2 | The row before was judged from the row alone, so a row the page showed as held (a carried mark beside an open conflict) was the next day's base. | minor | **Fixed:** that row cannot rule a hold out, so it is never a base. Row. |
| R3 | The card said "Paused" and dropped the waiting reason on a paused book. | minor | **Fixed:** "Paused · {reason}". Row. |
| R4 | An answer of no book (its wind-down completed) while the page was open left Astra's A09 state. | minor | **Fixed:** closes like a 404. Row. |
| R5 | A close landing after steps 1–3 (before the History read) can show one answer with the idea both live and in History. It clears on the next read; with no race, the same 17 Nov page already shows the 18 Nov window sale. | minor | **Recorded, not fixed.** The brief asked for the smaller A04 fix; closing it needs a trailing check of the book and a third pass. Your call. |

What it could not break: A01's other cases, and that A01 cannot over-hold (`valueLedger` marks a row below full quality only for a non-vendor mark); B3-11 in full; A04's header race with the strict "before"; A03 (one writer, one fill path, a tie shares the snapshot); A10's sum; no write added; no other user's book reachable; the switch still `false`.

A further row came from the battery: with two closes during one read, the second read's two rows did not include the row before the session, so today's change vanished. The reader now reads three daily rows.

### 9.8 The pictures

Re-shot from the frozen code at 390 and 320, the frames these fixes change, in place in `docs/audits/20261123_B3_PICTURES/`: `waiting` and `unobserved` (the waiting book line), `ledgerHold` (new: an idea held by its ledger, every name waiting), `newToday` and `fit` (Entered today), `nameOpen` and `ideaOpen` (the founder's byline), `entry-card` (with the waiting card). The harness measured all 57 frames: **0 overflow** (the fit test's 3 px overflow at 320 was found here and fixed). The desktop frames' thesis caption also changed ("The founder") but were not re-shot (the brief: 390 and 320).

### 9.9 The checks

| Check | Command | Exit | Result |
|---|---|---|---|
| The full Linux suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` (WSL, a clean LF worktree at `098df906`) | **0** | Test Files **1657 passed** \| 14 skipped (1671) · Tests **38212 passed** \| 197 skipped (38409) · 0 failed · 348 s |
| The lint gate | `eslint . --config eslint.gate.config.js --max-warnings 0` | **0** | No output |
| The build (B3-9) | `npx vite build` (WSL), `main` `2a136040` and `098df906` side by side, SHA-256 of every emitted file | **0** and **0** | **125 files each. All 64 non-map files byte-identical**, hashed names included. One file differs: `assets/CommandCenterHub-BjyaK3Ey.js.map` (digests in §9.2). With the switch off no request is made (`IdeaBookEntry.jsdom.test.jsx`, the switch-off rows). The same holds for the pushed head (this report's commit), built again before the push. |
| The rules suite | `firebase emulators:exec --only firestore … vitest run --config vitest.rules.config.mjs` (Windows) from an LF snapshot of `098df906` (`firestore.rules` checked against `git show` with `cmp`) | **0** | Test Files **48 passed** (48) · Tests **889 passed** (889). `firestore.rules`, `firestore.indexes.json` and `test/rules/` are unchanged from `main`. |

No real Firestore, model or EODHD call was made, and no `.env` file was read. The picture harness started vite with placeholder Firebase values on its command line.

### 9.10 Time

About 1 hour 45 minutes, from the first commit (24 Nov, 11:14 CST) to this report (about 13:00 CST). The 3-hour stop was not reached.

### 9.11 What remains

- R5 (§9.7) is recorded for your ruling.
- Astra confirms this round.
