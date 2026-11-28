# Explore Build 2 follow-ups — three fixes (dark)

Fri Nov 27, 2026 · branch `claude/explore-build-2-followups` · draft PR · cut from `origin/main` `4550a13e` (the merge of #1125, Explore Build 2) · prompt `docs/specs/20261127_FIX_PROMPT_EXPLORE_BUILD_2_FOLLOWUPS.md` · `EXPLORE_MODE` stays `'off'`, `EXPLORE_COMPARE_ROUTE` stays `false`, the publish command was never run.

## 1. Verdict

| Item | Result |
|---|---|
| What changed | **F-1** every Try again in Explore keeps focus on the page (five places; one already held). **F-2** the publish step's check refuses a padded id, or a padded reference to one (nine fields; two already refused). **F-3** below 360 px the jump row draws its sections without their counts |
| Dark | `EXPLORE_MODE` `'off'` and `EXPLORE_COMPARE_ROUTE` `false`, unchanged (`src/config/exploreFlags.js` untouched). Every changed `src/` file is under `src/components/Explore/`; with `'off'` no Explore chunk can be requested (bundle diff, §7) |
| STOP conditions | none hit. No file under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `src/components/Navigation/`, `src/services/sharedResearchService.js`, `firestore.rules`, `firestore.indexes.json`; under `api/` only `api/_utils/explore/storyCheck.js` and its test `review.test.js`; nothing under `scripts/`. No research request, write, collection, model or provider call. Both pilots pass `check` unchanged |
| `npm run lint:gate` | exit 0 (WSL, at the code head `e8ed75d0`) |
| Full suite (a worktree of `~/pd-ci`, suite lock, `TZ=UTC`, 8 workers, Node 20.20.2) | 1,698 files passed, 14 skipped (1,712); **39,607 tests passed, 0 failed**, 203 skipped; exit 0 (402 s), at `e8ed75d0`. Against Build 2's recorded run (39,574 / 202): +33 passed and +1 skipped, exactly this branch's new rows |
| `npm run test:rules` | 48 files, 889 tests passed, exit 0 (WSL, Java 21) — unchanged |
| Minified build + bundle diff | both builds exit 0 (`main` `4550a13e` and `e8ed75d0`, the same WSL worktree). With hashed names masked, **one** output file differs: the `ExploreTab` chunk, 84,079 → 84,910 B. The entry is identical (5,094,925 B, the same 653 exports). Explore chunks are reached only by `SearchDiscover`'s lazy imports, which do not render at `'off'` |
| Browser rows (headless Edge, local smoke page) | **24 of 24** at 1280×900, 393×852 and 320×700 on the smoke page built on the code head (local commit `4649b567`, never pushed), the 393 and 320 jump-row fit checks included; the new F-3 row fails on a smoke page built on `main` (`42d8632b`) and passes on the fixed one |
| Mutants | **34 of 34 KILLED** on the code head (jsdom and Node; the prompt's M1–M4 among them), each by an assertion in a named row, each file restored byte for byte (SHA-256), and the browser M4 (the media query removed on the smoke page) KILLED, restored |
| Review (§2: 14 files) | four lenses on their own archive trees, then a refuter: 21 findings, **21 CONFIRMED / 0 REFUTED**; 10 resolved in a review round (code: B-1, B-3; rows: B-2, D-1, D-2, D-3, D-4, D-5, D-7, D-8), C-4 by this report's commit, A-1's code comment corrected; the rest reported in §6 (two are questions for the founder) |

## 2. F-1 — every Try again in Explore

**The ruling.** After the tap, focus sits on an element that is on the page while the read is out and after it answers, never `<body>`, never scrolling (`preventScroll: true`), whether the retry succeeds or fails again (and then the next Tab stop is Try again). The panel's own heading if it stays through the reload; otherwise the story's title. The shelf's fix (review P-3) is the pattern.

**The panel's heading did not stay through the reload.** Before the fix `#ftx-panel-h` was the same node only from form E to loading and back to E (the same `Eyebrow` at the first place of the same `<section>`). Forms A, B and C drew it inside an array, so a retry that succeeded drew a new heading. The story's title would have stayed, but from the title the next Tab stops are the byline's Save, the jump row and the story's connections, not Try again. So the heading was made to stay: it is now one element in every form (`ExplorePanel.jsx`: `heading()`, the same key `panel-h` in the same `<section>`, `tabIndex={-1}`, `outline: none`), and Try again focuses it before the read starts. The rendered page is unchanged but for the heading's `tabindex="-1"` and `outline: none`: the same words, tone and order in every form (form C keeps its `h4` "Start another investigation on this story"); the Build 1 rule that the primary button is one element across A, B and C still holds (its row passes).

| Try again | Where | Before | Now |
|---|---|---|---|
| The story panel (form E, read failed) | `ExplorePanel.jsx` `data-explore-retry-read` | dropped to `<body>`: the button leaves with the retry, every outcome | **fixed** — focus on the panel's heading, the same element through loading and A, B, C or E; after E again the next Tab stop is Try again (on a story whose chosen question is specific; on a broad question the group's company buttons come first) |
| The front page's stories read | `ExploreHome.jsx` `data-explore-retry-stories` | dropped to `<body>` | **fixed** — focus on the cards' heading `#ftx-cards-h`, now one element whether the cards show or not (without cards it is for screen readers only, and its row draws no box: `display: contents`); after a failure again the next Tab stop is Try again |
| Saved for later's bookmarks read | `ExploreHome.jsx` `data-explore-retry-bookmarks` | dropped to `<body>` | **fixed** — focus on the list's heading `#ftx-saved-h` (already one element; now focusable by script) |
| The shelf (review P-3) | `ExploreShelf.jsx` `data-explore-shelf-retry` | held when the retry fails again or answers with nothing on the shelf; **dropped on a phone when the answer holds a thesis**: the shelf moves from after the cards to above the hero, drawn anew, and the heading that held focus leaves with the old one | **fixed** (the move) — the tap raises the front page's `retryFocus` flag; the shelf drawn in its other place takes focus on its own heading as it mounts, before the frame is painted, only while focus would rest on `<body>`; the front page lowers the flag once the read has answered. **already held** otherwise |
| The pinned bar | `ExplorePinnedBar.jsx` | has no Try again: in the failed state (form E) it is not drawn (`barActionOf` gives no action) | **none to fix** |
| The sheet host's failed load | `ExploreSheetHost.jsx` `LoadFailed` | held while the import is out and when it fails again (the link stays, `aria-disabled`); **dropped to `<body>` when the fresh import landed** and the body drew (observed on `main`'s code: `BODY` after landing, the link after a second failure) | **fixed** — the tap focuses the sheet's own heading (`h2`, now `tabIndex={-1}`), which is outside the reloading body; still inside the dialog's Tab loop (it takes no Tab stop) |

Rows (jsdom; each fails on `main`'s code with focus on `<body>` or on the leaving button, and passes now): in `explore.build2.jsdom.test.jsx`, *F-1 — a Try again never drops focus to `<body>`*: the panel's retry landing in A, B and C (the same heading node while the read is out and after, its words per form, `preventScroll: true` by a spy on `HTMLElement.prototype.focus`), the panel failing again (next Tab stop is the new Try again), the stories read and the bookmarks read (each: answers / fails again), the shelf moving above the hero on a phone, the shelf failing again (already held: passed before), the shelf leaving focus where the player put it while the retry was out, and the shelf never taking focus on a later move once the retry has answered (fails again / answers with nothing on the shelf; the screen turned wide) — 13 rows. Every row fails on any focus call on the heading that is not exactly `{ preventScroll: true }`, and the panel, cards and saved rows check the heading keeps `tabindex="-1"` after the answer. In `explore.sheet.jsdom.test.jsx`: the failed load's retry landing and failing again (2 rows).

## 3. F-2 — the publish step refuses a padded id

`api/_utils/explore/storyCheck.js`. A value that is not equal to its own trimmed form (`v !== v.trim()`, not blank: the same JavaScript `trim` the page uses, so a space, a tab, a newline or a no-break space at either end) is **refused** under rule `F-2`, not noted and not repaired (the standing of SQ-5). One refusal per field: a padded id that is also used twice is refused once, for the reuse on its second use and for the padding on its first. The message names the field and says why: *"questions[1].id is " minimums ", with spaces at its ends: the page reads ids trimmed, so a padded id would not be found"*.

**Before and after** (probe: each field padded, and its target padded the same way so the reference still resolves and the padding is the only defect; both pilots otherwise unchanged):

| Field | Before | After |
|---|---|---|
| a question's `id` | passed | **refused** (F-2) |
| a connection's `id` | passed (a note: "every reference to it must repeat them exactly") | **refused** (F-2; the note is gone) |
| a source's `id` | passed | **refused** (F-2) |
| a question's `fromConnection` | passed (padded alone it was refused: "names no connection") | **refused** (F-2) |
| a connection's `sourceIds` entry | passed (padded alone: refused, "names no source") | **refused** (F-2) |
| a stated cell's `sourceId` | passed (padded alone: refused) | **refused** (F-2) |
| a computed cell's input's `sourceId` | passed (padded alone: refused) | **refused** (F-2) |
| `parent.connectionId` | passed (padded alone: refused, "names no connection") | **refused** (F-2) |
| an overview's connection's `leadsToStory` | refused (K-4(e): a story id never holds a space, so it names no story) | refused, **unchanged** |
| a deep story's connection's `leadsToStory` | **passed** (a standard §7 note only, padded or not; found by the review, B-1) | **refused** (F-2) |
| `parent.storyId` | refused (K-4(e), the same reason) | refused, **unchanged** |

So nine fields changed and two already refused. A reference padded while its target is not is still refused as before ("names no …"); the new refusal adds only where the old check let the padding through. A space inside an id (`min payments`) is not padding and passes, as before. **Both pilot records pass `check` unchanged** (together, and each alone with the other as a stored story); neither was edited.

Rows (`api/_utils/explore/review.test.js`, *F-2 …*), 16: one per changed field (nine), each asking for the refusal **at that field** with rule F-2 and the message; a one-sided pad, and a tab with a no-break space; a padded id used twice (one refusal per field); the two unchanged fields (already refused); the internal space; both pilots. Twelve fail on `main`'s check, and the four control rows pass on both. The A5 row (a padded connection id against an unpadded question) now also names the padded id itself.

## 4. F-3 — the jump row at 320 px

One media query, `@media (max-width: 359.98px) { .ftx-jump-count { display: none; } }` (`exploreStyle.js`), and the class on each count (`ExploreJumpRow.jsx`), for both copies of the row (in flow and the pinned copy portalled to `<body>`). `display: none` takes the count out of each button's name, so the name is what is drawn. From 360 px nothing changes; the labels still never shrink (P-1). The counts stay where the page already shows them: beside the Connections heading and on the Sources list's button. The questions count is shown nowhere else below 360 px; the questions themselves are listed right there.

**Measured** (headless Edge, the local smoke page's `jump-row-long` story: 3 connections, 10 questions, 12 listed sources):

| 320×700 | Last label | Its right edge | The row's right edge | Past the row |
|---|---|---|---|---|
| Before, in flow | "Sources 12" | 305.44 px | 304 px | **1.44 px past** (5.44 px beyond where a fitting row puts it) |
| Before, pinned | "Sources 12" | 316 px | 320 px | fits |
| After, in flow | "Sources" | 300 px | 304 px | fits (−4, the row's own end padding) |
| After, pinned | "Sources" | 316 px | 320 px | fits |

At 359 px the counts are hidden; at 360 and 393 px the row is unchanged from before (the same numbers, counts drawn). The pilot overview is unchanged from 360 up and drops its counts below. The Build 2 report's "about 7 px" was measured on a different story; this fixture's overflow is 1.44 px. Nothing scrolled sideways, before or after.

Rows: jsdom (*F-3 …*) — every count in both copies carries the one class and only the count does, no inline `display`; the page's rules hide the class below 360 px by one media query and nowhere else. Browser (`explore.browser.test.js`, *F-3: two-digit counts …*) — at 320, 359, 360 and 393 px on `jump-row-long`: what each button draws, each button's accessible name (the aria snapshot) equal to it, every label inside the row in flow and pinned, nothing sideways. It fails on the pre-fix smoke page ("320: in flow") and passes on the fixed one.

## 5. Baseline counts, before and after

The prompt's files, run on Windows (`TZ=UTC`) at `main` `4550a13e` before any edit and at the code head `e8ed75d0`. Every file not listed is unchanged.

| File | Before | After | Why it moved |
|---|---|---|---|
| `api/_utils/explore/review.test.js` | 120 | 136 | +16: the F-2 rows (§3). The A5 row's expectation changed, not its count |
| `src/components/Explore/explore.build2.jsdom.test.jsx` | 86 | 101 | +15: 13 F-1 rows, 2 F-3 rows |
| `src/components/Explore/explore.sheet.jsdom.test.jsx` | 19 | 21 | +2: the sheet's F-1 rows |
| `src/components/Explore/explore.browser.test.js` | 23 skipped | 24 skipped | +1: the F-3 browser row (skipped without a page, as all of them are) |
| unchanged | `storyCheck.test.js` 113, `scripts/explore-publish.test.js` 54, `fetchSource` 58, `matchRule` 22, `matchStory` 29, `exploreFlags.test.js` 12, `sharedResearch.boundary.test.js` 59, `explore.guard` 54, `explore.screens` 45, `explore.review` 26, `explore.founder` 17, `explore.page` 14, `explore.build2.off` 1, `explore.requests` 1, `exploreView` 59, `exploreView.build2` 44, `exploreReads` 3 | — | — |
| **Total** | **836 passed, 0 failed, 23 skipped** | **869 passed, 0 failed, 24 skipped** | +33 rows, +1 skipped |

One existing row changed: the browser jump-row row's P-1 fit check now measures only the words drawn (`explore.browser.test.js`). Below 360 px a count is `display: none` and has no box, which read as "words outside the button". It still fails a label that spills, and it passed at 393 and 320.

## 6. Found and not fixed

**Questions for the founder** (each would change what a player sees, which no ruling covers):

1. **A broad question, form E, after a retry that fails again (review A-1).** Focus is on the panel's heading, as ruled. But the question's group (the company buttons) stands between the heading and Try again, so the next Tab stop is the first company, not Try again. On a specific question it is Try again. Moving Try again above the group, or focusing elsewhere, is a layout or ruling change. The code comment says so.
2. **The questions count below 360 px (review C-1).** The ruling keeps the counts "where else the page already shows them (each section's own heading)". That is true for Connections (beside its heading) and Sources (on its button), but the Questions heading has no count. Below 360 px the number of questions is drawn nowhere. The questions themselves are listed right there.

**Reported, left as built:**

3. **The sheet's failed load, when the retry fails again (A-2).** Before, focus stayed on Try again (the link stays while retrying). Now the tap moves focus to the sheet's heading, so after a second failure Tab reaches Close first, then Try again. This follows the ruling's letter (one element present while the import is out and after). Moving focus only when the import lands is the other reading.
4. **No visible focus on a focused heading (A-3).** Every heading that takes focus here carries `outline: none`, the house pattern (the story's title, the shelf's heading, the connections heading). The stories retry focuses a heading drawn for screen readers only while there are no cards.
5. **Crossing 1000 px while a read is out, on an overview (A-4, pre-existing).** The story page moves the questions-and-panel block in the DOM between the narrow and wide orders. A browser drops focus from a moved node, so focus on the panel's heading (or, on `main`, its button) falls to `<body>` going wide to narrow. Build 2's code, untouched.
6. **Padded source ids in places the check never reads (B-4, pre-existing).** A not-reported cell, a stated cell's stray inputs, a stored measure's cells, a mistyped measure kind: the check reads none of them, padded or not. The page reads them trimmed, so the outcome is the same as unpadded.
7. **The message's words (B-5, and the refuter's note).** "with spaces at its ends" also covers a tab, a newline or a no-break space (the value is shown escaped). For a deep story's door, the page does not trim a story id; it drops a padded one. The message keeps the prompt's wording for every field.
8. **A deep story's door, unpadded but naming no story,** is still only a note, as on `main`. Only padding is now refused there (F-2's list names `leadsToStory`).
9. **Browser-row limits (C-2, C-3, D-6, the refuter).** The name check ignores whitespace ("Questions10" and "Questions 10" read the same). 360 px is measured with one two-digit count beside a one-digit one. jsdom cannot tell focus at the tap from focus a moment later; only a browser sees that frame. The `sideways` field cannot fail on this page (`index.css` clips sideways overflow); the row now measures the row against the screen instead.
10. **P-7** (two landmarks named "Sections of this story" while the row is pinned), from Build 2's Watch list, was not in this prompt and is unchanged.

## 7. Mutants

Run in an LF archive of the code head (never this worktree), each by one anchored edit, judged by the rows that fail by an assertion (a timeout or a file that does not load would be reported as broken: none was), each file restored and SHA-256 checked. All **KILLED**.

| ID | The mutant | Killed by |
|---|---|---|
| **M1** | F-1: the panel's focus call removed | the panel rows (4) |
| **M2** | F-1: the panel heading a new element once A, B or C draws (the restructure undone, the focus call kept) | the panel's A, B, C rows |
| M2b | F-1: the panel focuses Try again itself (it leaves with the reload) | the panel rows |
| M2c | F-1: `preventScroll` dropped | the panel rows |
| M2d | F-1: `Eyebrow` drops `tabIndex` | the panel rows |
| **M3** | F-2: every refusal turned into a note all 12 F-2 rows that refuse (the 11 field rows and the once-per-field row) |
| M3a–M3f | F-2: one site at a time turned into a note (question id, connection id, `fromConnection`, the citations, source id, `parent.connectionId`) | each its own row only |
| M3g | F-2: the message no longer names the field | every F-2 field row |
| M3h | F-2: a deep story's padded door only noted | its row |
| M3i, M3j | F-2: a padded id used twice refused twice (connections, sources) | the once-per-field row |
| M3k, M3l | F-2: padding as ASCII spaces only; at the start only | the tab row; the one-sided row |
| **M4** | F-3: the media query removed | the CSS row (jsdom); on the smoke page, the F-3 browser row ("320: in flow") |
| M4b | F-3: the count loses its class | the class row |
| M5, M6 | the stories read: focus call removed; its heading a new element when the cards draw | the stories rows |
| M7 | the saved list's focus call removed | the saved rows |
| M8, M9 | the moved shelf takes no focus; the tap never raises the flag | the shelf-move row |
| M10, M11 | the flag never lowered; the shelf takes focus on any mount | the later-move rows |
| S2 | the flag lowered only on a failed answer (review D-2) | the "answers with nothing" later-move row |
| S5 | the moved shelf takes focus even after the player moved it (D-3) | the D-3 row |
| P2 | the panel heading focusable only in form E (D-4) | the A, B, C rows |
| P6 | the panel focuses twice, the first call scrolling (D-5) | the panel rows |
| S7 | the shelf's tap focus scrolls (D-5) | the shelf rows |
| M12, M13 | the sheet: focus call removed; `preventScroll` dropped | both sheet rows |

The refuter also ran 13 mutants of its own against the review-round fixes: all killed.

## 8. The review (BUILD_RULES §2)

Mandatory: the branch changes 14 files (13 before this report). Four lenses each read the diff on their own `git archive` tree, read-only on git and on the working tree: **A** F-1 focus and React identity, **B** F-2 against the page's reader, **C** F-3, the dark guarantee and scope, **D** test integrity (each with mutants of its own). Then a refuter, on a fresh tree of the reviewed-and-fixed head, was asked to refute every finding with a repro and to check each fix by reverting it.

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| A-1 | broad question: the group's buttons before Try again | CONFIRMED | founder question (§6.1); comment corrected |
| A-2 | the sheet moves focus off a link that stays when the retry fails again | CONFIRMED | reported (§6.3) |
| A-3 | headings take focus with no outline | CONFIRMED | reported (§6.4), the house pattern |
| A-4 | crossing 1000 px moves the panel's block (pre-existing) | CONFIRMED (narrower: wide to narrow only) | reported (§6.5) |
| B-1 | a deep story's padded door passed | CONFIRMED | **fixed** (refused), row, M3h |
| B-2 | no row pinned what "padded" means | CONFIRMED | **fixed** (rows), M3k, M3l |
| B-3 | a padded reused id refused twice | CONFIRMED | **fixed**, row, M3i, M3j |
| B-4 | sites the check never reads (pre-existing) | CONFIRMED | reported (§6.6) |
| B-5 | "spaces" for any trimmed character | CONFIRMED | reported (§6.7) |
| C-1 | the questions count drawn nowhere below 360 px | CONFIRMED | founder question (§6.2) |
| C-2 | the name check ignores whitespace | CONFIRMED | reported (§6.9) |
| C-3 | 360 px measured with a one-digit count | CONFIRMED | reported (§6.9) |
| C-4 | the report missing at the reviewed head | CONFIRMED | resolved (this commit) |
| D-1 | = B-2 | CONFIRMED | **fixed** |
| D-2 | the flag lowered only on failure survived | CONFIRMED | **fixed** (row), S2 |
| D-3 | the "focus on `<body>` only" guard unpinned | CONFIRMED | **fixed** (row), S5 |
| D-4 | `tabIndex` only in E survived | CONFIRMED | **fixed** (rows), P2 |
| D-5 | only the last focus call checked | CONFIRMED | **fixed** (rows), P6, S7 |
| D-6 | jsdom cannot see the frame | CONFIRMED | reported (§6.9) |
| D-7 | `sideways` cannot fail | CONFIRMED | **fixed** (the row against the screen) |
| D-8 | names checked on one copy | CONFIRMED | **fixed** |

**21 CONFIRMED / 0 REFUTED.** The refuter tried each and could not refute one; it confirmed every fix by reverting it (13 mutants, all killed) and found no new defect beyond three notes, now in §6.7–§6.9. Lens B's and lens D's own mutants that survived on the reviewed head are the rows now added (B-2, D-2–D-5).

## 9. The smoke page

Not updated: `claude/explore-build-2-smoke` stays at `1da3f5fc`, the founder's existing preview. The browser rows ran against **local** smoke commits made by git plumbing, never pushed: Build 2's five smoke edits (ported by anchored replace, `src/main.jsx` taken whole after checking it is unchanged) plus a `jump-row-long` scene (a labelled sample built from the AI sample's record: 3 connections, 10 questions, 12 listed sources). There are three: on `main` `4550a13e` (`42d8632b`, the before numbers), on `2b9fdd58` (`11e60458`, the after numbers), and on the code head (`4649b567`, the final 24 rows). Each was served from an LF `git archive` by Vite with placeholder Firebase names. Updating the preview branch would only add the `jump-row-long` scene; say if you want it.

## 10. Preamble

1. `git fetch origin` first. Branch `claude/explore-build-2-followups` cut at `origin/main` `4550a13e` (the merge of #1125); clean.
2. `src/components/Explore/ExploreJumpRow.jsx` is on `main` (blob `57c31827`): Build 2 merged, no STOP.
3. The prompt committed first: `a60de251`.
4. Baseline recorded (§5, the "Before" column).
5. Read: the Build 2 report's review rows P-1, P-3, N-5 and its "Watch on the allowlist" list (items 8 and 9 are F-3 and F-1; N-5 is F-2).

Commits: `a60de251` the prompt · `a4b30046` F-2 · `34c5245b` F-1 · `2b9fdd58` F-3 · `6c68fc4d` the shelf flag row · `3afb1dba` the P-1 fit check · `222526ba` the review round (B-1, B-2, B-3, A-1's comment) · `e8ed75d0` the review round's rows (lens D) · then this report.
