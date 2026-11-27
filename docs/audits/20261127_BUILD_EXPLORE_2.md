# Explore Build 2 — the front page, the phone story page, and the story hierarchy (dark)

Fri Nov 27, 2026 · branch `claude/explore-build-2` · draft PR · code head `aab684e5` (the merge of `main` `a037e022` into the build's last code commit `ea2872b2`; this report is the one commit on top) · cut from `origin/main` `a2e05fa9` · `EXPLORE_MODE` stays `'off'`, `EXPLORE_COMPARE_ROUTE` stays `false`.

## Verdict

| Item | Result |
|---|---|
| Built to | B6c §1, Amendment B (committed), the content chat's note §3, Rounds 2 and 3 (committed), rulings K-0..K-21, SQ-1..SQ-5 defaults |
| Dark | `EXPLORE_MODE` `'off'` (unchanged); `EXPLORE_COMPARE_ROUTE = false` (new, pinned); with `'off'` the Search page renders what `main` renders and no Explore chunk can load (O rows, lens d's render comparison, the build's chunk graph) |
| STOP conditions | none hit; no file under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `api/`, `scripts/` or `src/services/sharedResearchService.js` changed; no rule, index or collection; no write but a bookmark; no research request added |
| `npm run lint:gate` | exit 0 |
| Full suite (WSL, suite lock, `TZ=UTC`, 8 workers) | 1,698 files passed, 14 skipped (1,712); 39,574 tests passed, 0 failed, 202 skipped; exit 0 (413 s), on the merge `aab684e5` |
| `npm run test:rules` | 48 files passed, exit 0 (`exploreBookmarks.rules.mjs` 35 rows) |
| Minified build | exit 0; bundle diff as expected (the Explore chunks, the Search chunk, hashed names; the entry's export aliases re-lettered, same 653 exports) |
| Real browser (headless Edge, smoke page) | 23 of 23 passed at 1280×900, 393×852 and 320×700 on the deployed smoke preview of `1da3f5fc` (and on the first deployment, `878d8ba9`, and on the local smoke page at `52faff53`); the P-1 fit check at 393 and 320 |
| Mutations | 43 of 43 KILLED (the prompt's 21, with M21 as two; 16 from the review; 5 from the refuter's round), each restored byte for byte (SHA-256); plus the P-1 browser mutant KILLED (the 320×700 jump-row row; restored, SHA-256 equal) |
| Review (K-21) | four lenses on their own archive trees, one refuter; 17 CONFIRMED / 6 REFUTED; every CONFIRMED finding resolved but D-3 (proved instead by the render comparison); the one new defect the refuter found (the P-2 leak) fixed in a second round |
| Baselines | unchanged except the rows listed under preamble 6 (27 rows, each with its reason) and the counts they move |
| Renders | 69 full-page PNGs: 20 states, plus 3 with every branch and Sources open, at 1280, 393 and 320; none scrolls sideways. In `C:/Users/fashr/Documents/FantasyTrades/Explore/B2/renders/`, taken on the local smoke page at `52faff53` (the code since differs only in the pinned bar's cleanup, which draws nothing) |
| Smoke | https://trade-seven-7uqjswl88-fais-projects-bc179554.vercel.app |

## The smoke page

https://trade-seven-7uqjswl88-fais-projects-bc179554.vercel.app — `?exploreFixture=` (no value: the scene list). Branch `claude/explore-build-2-smoke` (never merged): commit `1da3f5fc` on the PR's code head, the merge `aab684e5` (its second parent is the first smoke commit `878d8ba9`, made on `ea2872b2` before `main` moved, so the branch only moved forward). *SMOKE ONLY, NEVER MERGE*, five files: the loader gate in `src/main.jsx`, `exploreMode()` reading `window.__exploreSmokeOn`, the two compare read sites reading `window.__exploreSmokeCompare` on the `compare-on` scene, and `src/smoke/ExploreSmokeScreen.jsx`. The flag file's literals are unchanged. Every research read is answered from `exploreReads.json`, the sheet's requests from the sheet's own fixtures; nothing reaches the research server. The preview was checked to serve this build: its entry names `exploreFixture`, and its `ExploreSmokeScreen` chunk carries the SMOKE ONLY line. Apart from Vercel's per-deployment values (`VITE_VERCEL_DEPLOYMENT_ID`, `_GIT_COMMIT_SHA`, `_URL`) and the hashed names they move, its front end is identical to the first smoke deployment's (`878d8ba9`).

Scenes: `home`, `home-returning`, `home-empty-rows`, `overview`, `overview-no-door`, `deep`, `deep-no-parent`, `broad-question`, `gated`, `limit`, `read-failed`, `old-shape`, `compare-on`, `walk`, and, for the renders, `home-saved-question`, `home-saved-unreadable`, `home-concluded`, `home-gated`, `home-limit`, `home-failed`, `specific-question`. `&stay=home` keeps a scene on the front page.

## The base and the preamble's six findings

1. **Branch, HEAD, tree.** `git fetch origin` first. Built in the session worktree `explore-build-2-9bde1f` on its local branch `claude/explore-build-2-9bde1f`, cut at `origin/main` `a2e05fa9` (descends from `1cb1c627`), clean; pushed as `claude/explore-build-2`. **`main` moved during the build** to `a037e022` (#1121 and #1123: 33 files under `api/`, `scripts/` and `docs/`; none is a file of this branch, nothing under `src/`, and no new test scans the tree). It was merged before the final checks (merge commit `aab684e5`), and the final suite, lint gate, rules suite, build and bundle diff ran on the merge. **`claude/explore-publish` had merged** (#1115, `440b718a`, in `main` before this build began): its tests import `storyOf` from `exploreView.js` and ran unedited against this build's reader (113 + 120 + 29 + 22 + 58 + 54 rows, all passing).
2. **B6c §1 against the merged code — VERIFIED, no difference.** `api/forge/shared-research.js:167-168` answers `{ quota, items, agent }`; `api/_utils/sharedResearch/explore.js:147-155` (`exploreLastOf`) gives `last.question` (the record's, null without one) and `last.statement` (a save's `adoption.statement`, null when concluded or unrecorded); `api/_utils/sharedResearch/store.js:258-261` (`exploreAgentOf`) gives `agent: { id, name, equippedList: { id, name } | null } | null`, `name` null when blank (`partnerNameOf`, `store.js:112`).
3. **The body's props — VERIFIED.** `src/components/SharedResearch/SharedResearchSheetBody.jsx:68-70` takes `agentName`, `agentId`, `equippedListLabel` (each null-safe). An extra key on `item` is ignored: the open sends only `item.itemRef` and the question (`SharedResearchSheetBody.jsx:128` → `useSharedResearch.js:244-247` builds `entry` from `itemRef.recordKind`, `itemRef.recordId` and the question); the preview reads `headline`, `context`, `reporterName`, `publishedAt`, `question`, `beat` (`screens/Previews.jsx:60-72`).
4. **Baselines** (Windows, `main` `a2e05fa9`): 26 files, 1,044 passed, 0 failed, 18 skipped (the browser rows) — per file under "Suite counts and baselines". Rules: `test/rules/exploreBookmarks.rules.mjs` counted in the rules run (below).
5. **The research page for a ticker — VERIFIED.** `RankingsView.jsx:110-118` hands `onOpenResearch` `{ symbol, name, sector, price: 0, percentChange: 0, change: 0 }`, taking name and sector from the 54 `STOCKS` when listed and falling back to the symbol; its list is `indexIntelligence/stockRankings` (the 228), so production already opens `AssetResearchModal` for symbols outside the 54. The modal has no list check (it fetches profile and price by symbol). A lead builds the same object from `{ symbol, name }` (`exploreView.js` `leadAssetOf`). Of the pilot's leads, MU, ORCL, CRWV, CSCO, DLR, CEG, GEV, ETN and BE are outside the 54; the browser row opens CRWV at all three sizes.
6. **Rows that must change** — listed before any edit (below): 27 rows across six files, each with its ruling; plus the five jsdom files' flag mocks (a mechanical export, no row changed).

### Preamble 6 — the existing rows that changed

Mechanical (no row changed): the five jsdom files' `vi.mock('../../config/exploreFlags')` factories gain
`EXPLORE_COMPARE_ROUTE: false` (vitest refuses a missing export on a factory mock;
87 rows failed on it until added). founder, page, requests, review, screens.

Rows changed (27), each with its ruling:

| File | Row | Why |
|---|---|---|
| founder | F-1 'on' / 'allowlist' (2, it.each) | B-12: no page heading inside a story (was "the heading stays") |
| founder | a story opened from search hides it too; a second story… | B-5: tap-to-pay is a tile; opens the utilities card |
| founder | the story disappearing brings the row back | B-4: with the three samples alone the AI sample is the hero; runs over KIT_STORIES |
| requests | N-4 scripted run | B-5: topic and saved/opened card move from tap-to-pay (a tile) to utilities |
| review | A-4 x2 (it.each) | B-5 (tap-to-pay a tile); opens the AI card (no item in `limit`, so form A at the limit) |
| review | A-5 / B-4 | B-5 |
| review | A-8 | B-5 (the story list's two tap-to-pay entries) |
| review | B-3 | B-5 |
| review | B-5 | B-5 |
| review | B-9 "a story on two cards" | B-3: one card per story — now asserts one card and one line |
| review | C-1 reader order | B-14 / K-10: the jump row under the byline; an overview's connections before its questions |
| review | C-1 home order | Amendment B §4.1–§4.2: the shelf replaces Research in progress; placements by one media query |
| review | C-4 Product tag | B-5: no product card; checked on the story opened from its tile |
| screens | stories failed + Try again | B-4: the samples alone make the AI sample the hero; reads KIT_STORIES |
| screens | the cards | B-3 (one per story), B-4 (hero not a card), B-5 (tile) |
| screens | topics filter the cards | B-5: Payments was the tile's topic; uses AI buildout; 2 cards |
| screens | K-7 cost line 2 of 5; K-7 5 of 5 | B-5: opens the utilities card |
| screens | form A | B-5: opens the utilities card |
| screens | a story without tickers | B-4: the AI sample alone would be the hero; replaced inside KIT_STORIES |
| screens | the connections carry one of three labels; sources dated | B-6: one list, not a disclosure (scoped to the story; labels read) |
| screens | bookmarks x3 (save/remove, failed save, cap) | B-5: the utilities card |
| exploreView | one card per featured question | B-3/B-4/B-5: featuredCardsOf replaced by frontPageOf |
| exploreReads | holds the states the page draws | B6c: the read carries `agent` (none: `agent: null`) |

Fixture changes: exploreReads.json regenerated by its own command (K-19); stories.js samples rewritten into the new shape
(K-19); exploreKit default stories = KIT_STORIES (pilot pair + samples), `readStory` added.
Not a row: STORIES_READ 12 → 40 had no row pinning 12.

## Routine choices made here

| # | Choice | Why |
|---|---|---|
| R-1 | The jump row is pinned by a portalled fixed copy (the pinned bar's pattern), not `position: sticky`. The in-flow row keeps the Tab stops; the copy's buttons take none; `scroll-padding-top` is set while pinned. | `src/index.css` gives `html`, `body` and `#root` `overflow-x: hidden`, so `#root` is a scroll box that never scrolls and sticky never pins; the guard also bans sticky in the screens. |
| R-2 | The section in view = the first of the story's section blocks, in reading order, that shows below the row (one IntersectionObserver over `[data-explore-section]` blocks). A tap marks its section and keeps it while the page stays where the jump put it. | The last section of a short page may never reach the top; the tap must still mark it. |
| R-3 | The jump row and the bar's question show below 1000 px (the two-column breakpoint), not only below 700. | The story is one column below 1000; the desktop page is the built two-column one. |
| R-4 | The shelf and Saved for later are placed by one media query (`(min-width: 1000px)`) and drawn once, not twice with `display: none`. | Each is drawn once, so no duplicate ids, rows or bookmark controls; reading order is the visual order at every width (C-1). |
| R-5 | On a phone the empty shelf sits right after the cards (before Latest deep stories). | Amendment B §4.1 item 2 says "after the cards" (Round 3 drew it after Latest; the spec wins, K-1). |
| R-6 | The shelf's heading line counts the read's own lists: "{open} in progress · {finished} finished", where finished counts every item with a `last` (a story open and finished is in both lists). | §4.2: "A heading line says how many of each"; nothing computed but the lengths of the read's lists. |
| R-7 | The back link names the story that linked here by its subject (else its title): "← AI buildout". | B-11's example "← The AI buildout"; the record's subject is "AI buildout". |
| R-8 | "One step up" in Where next opens the overview at this story's connection (as the way up does). | §4.4 names only the overview's title; the way up's own rule is "at that connection". |
| R-9 | A closed branch with a door carries the small "Deep story" mark in its button (the door itself is in the opened branch, §4.3). | Round 3's P1 draws the door on the closed chain; the spec puts the door inside the opened branch; the mark keeps both true. |
| R-10 | A lead opens the research page on RankingsView's object (`{ symbol, name, sector: '', price: 0, percentChange: 0, change: 0 }`). | K-11 / preamble 5: the same object `RankingsView.jsx:111` hands `onOpenResearch`; the modal fetches the price itself when `price` is 0. |
| R-11 | A company's symbol is a button only when it has the listed shape (`/^[A-Z0-9][A-Z0-9.-]{0,11}$/`); anything else is plain text. `exploreView.js` imports nothing, so the 228-list is the publish step's check, not the page's. | K-3/K-11; the reader stays Node-clean (storyCheck.test.js pins it). |
| R-12 | The count line says "1 connection" for one (the ruling's "{n} connections" with the plural). | B-2's words; grammar for n = 1. |
| R-13 | The bar's question with an investigation open is the investigation's own question (else the chosen one). | The action is Continue research, which continues that question. |
| R-14 | Sources stay a collapsed disclosure ("as built"); the jump link to Sources focuses its button. | §4.3 "Sources (B-10). As built". |
| R-15 | `EXPLORE_COMPARE_ROUTE` is read inside the render, at its two read sites, as a literal ternary: `const compare = EXPLORE_COMPARE_ROUTE ? true : false;` (`ExploreHome.jsx:72`, `ExplorePanel.jsx:138`). No reader function. The smoke commit replaces those two lines on the smoke branch only. | K-2 "read at call time". A reader function in `exploreFlags.js` (which lives in the entry chunk: the nav imports `exploreMode`) gave the entry a new export; the literal ternary folds and the entry keeps its 653 exports (the bundle diff). `exploreFlags.test.js` pins the two read sites to that exact line. |
| R-16 | The kit's default stories are the pilot pair (as published) and the three samples; the samples were rewritten into the new shape keeping every field an old row reads. | K-19; fewer old rows move (the AI sample stays a card beside the pilot hero). |
| R-17 | A new composed read, `fresh`: a player with an agent who has researched nothing (the first-visit and walk scenes). `none` keeps `agent: null`. | K-19: every read from the server's own shaping. |

## Every screen and state, the field it reads, and its row

Rows: **V** = `exploreView.build2.test.js`, **J** = `explore.build2.jsdom.test.jsx`, **O** = `explore.build2.off.jsdom.test.jsx`, **B** = `explore.browser.test.js` (headless Edge on the smoke page), **S** = Build 1's `explore.screens.jsdom.test.jsx` (kept).

| Screen · state | Reads | Row |
|---|---|---|
| Front page · first visit | stories (newest overview → hero), read `fresh` (quota, no items) | J "first visit: the hero…", J shelf "nothing in the read"; B every scene |
| Hero · broad question | `questions[featured].group` (story's order), `fromConnection`, connections' `basis`, door target | J "first visit"; V "its question: broad…" |
| Hero · specific question | `questions[featured].unknown` | J "a specific question on the hero" |
| Start from something you use | product-led overviews ≠ hero; `productName`, counts from `basis` | J "the tile"; V "the kit…" |
| Row absent | no product-led overview / no deep story | J "a row with nothing in it is not drawn" |
| Questions worth researching | story-led overviews ≠ hero, featured question, chain (card), `leadsToStory` → "Deep story ›" | J "the cards…"; S "the cards" |
| Latest deep stories | deep stories (3 newest), `parent` → overview subject › connection `who`, `about` | J "Latest deep stories"; V "Latest keeps the three newest" |
| Shelf · empty | read `quota` | J "nothing in the read" |
| Shelf · in progress | `open.question`, `filled`, `parts`, `stepsLeft`, story title | J "a returning player"; J planted 4 of 7 |
| Shelf · ledger | `open.filled: null` | J planted row (ledger half) |
| Shelf · saved with statement | `last.ended/at/statement` | J "a returning player" |
| Shelf · saved without statement | `last.question` | J "a saved thesis with no sentence…" |
| Shelf · saved, record unreadable | `question: null, statement: null` | J same row (savedBare) |
| Shelf · concluded | `last.ended/at/question` | J "a concluded one" |
| Shelf · no access / failed | read `gated` / failed; Try again = one read | J "no access…; the read failed…" |
| Shelf · desktop | one media query | J "from 1000 px the shelf and Saved for later sit beside the hero" |
| Story · no heading, no tab row | `onInStory` | J "inside a story…" (phone and desktop); founder F-1 rows; B "inside a story…" |
| Overview · connections | connections, `basis`, `ref` | J "one list…"; B "one list of connections…" |
| Overview · each branch opened | `what`, `basisLine`, `known/unknown/whereToLook`, `leads` | J it.each over the five branches |
| Blank Known | `known: ''` | J "a blank Known reads…" |
| Lead with / without symbol | `leads[].symbol` | J "a lead with a symbol… CRWV"; J "plain-text leads"; B "CRWV opens the research page" |
| Door · readable / unpublished / missing / refused / wrong kind | `leadsToStory`, stories read, readStory | J "doors and what a story page reads by id" (5 rows); V doorOf |
| By-id bound | `complete: false` | J "at most six by-id reads…" |
| Deep story · with parent | `parent`, `about` | J "above its title the way up…"; B way up |
| Deep story · parent unreadable | — | J "its parent unreadable" |
| Sources | §5.3 rule | J "B-10: the sources list only what a connection cites"; V K-15 |
| Old shape | text leads, no gap | J "the old shape still reads"; V "the old shape still reads" |
| Jump row | sections + counts, B-14 order | J "an overview: Story · Connections…"; J "one observer marks…"; J "pinned once scrolled past"; B jump row |
| Bar · question | chosen question / open question; quota or `open` | J "the bar carries the chosen question…"; J "with an investigation open…"; B bar |
| Panel · switch off / on | `EXPLORE_COMPARE_ROUTE`, read in the render (a literal ternary) | J "switch off…" (+5 states it.each); J "switch on…" |
| Panel · form C | `last.question` | J "the finished form shows the read's question" |
| Sheet · agent / no agent / questionId | read `agent`, chosen question id | J "the sheet" (2 rows); S Work this idea (nulls) |
| Moving between stories | history | J "moving between stories" (6 rows); B door/back, way up, walk |
| One research read | — | J "one research read for a whole walk…"; requests N-4 |
| 'off' | — | O; page K-2 rows |

Renders of every state at 1280, 393 and 320 (full page, `<scene>-<width>.png`; `opened/` with every branch and Sources open) are in `C:/Users/fashr/Documents/FantasyTrades/Explore/B2/renders/`.

## Amendment B §8's twenty checks, each with its proof

| # | Check | Proof |
|---|---|---|
| 1 | A door opens its deep story; the deep story's way up opens the overview at that connection, open | J "a door, then back…", J "the way up opens the overview at that connection…"; B "one list of connections… the way up lands at the branch" (3 sizes) |
| 2 | Back returns where the player came from, at the scroll and open branch left, from the front page, search, a door, Where next, Latest | J "moving between stories" (door; way up; Where next; it.each Latest + search; two levels); B door/back and the walk; M6, M7 |
| 3 | A connection without a deep story shows no door and no words about one | J "a connection without a deep story says nothing about one"; J words rows; M5 |
| 4 | A door whose target cannot be read is not drawn | J doors rows (unpublished; missing, refused, wrong kind by id); V doorOf; M4 |
| 5 | At 1280, 393 and 320 one list of connections; each branch opens in place | B "one list of connections, a branch opening in place" ×3; J "one list…"; M19 |
| 6 | Every opened connection shows its label, three-part gap and leads; a blank Known reads "Nothing sourced yet." | J it.each over the five branches; J "a blank Known…" |
| 7 | A lead with a symbol opens that stock's research page; without one it is not a button | J "CRWV"; J "plain-text leads"; B "CRWV opens the stock research page" ×3 |
| 8 | No screen shows a carried figure, a benchmark, or a source named only by a carried figure; the reader's view holds none | V K-3 walk + figures rows; J "B-10: the sources…"; J switch-on row (no figure); M1, M2 |
| 9 | A broad question's group in the story's order; nothing ordered | V "the group keeps the story's order"; J hero and panel rows assert MSFT·AMZN·ORCL·CRWV; M3 |
| 10 | With EXPLORE_COMPARE_ROUTE false, no screen says "compare" | J "switch off…" + it.each over five reads; M15 |
| 11 | One card per story; a product-led overview is a tile; the hero's story is not also a card | V front-page split rows; J "the tile…"; S "the cards"; M8, M9 |
| 12 | The shelf's every number and sentence is the read's own; empty shows no count | J shelf rows (planted 4 of 7 / 2 of 5; nothing invented); M10, M11, M12 |
| 13 | "Start from something you use" and "Latest deep stories" absent when empty | J "a row with nothing in it is not drawn" |
| 14 | No page heading and no tab row inside a story, at every width | J "inside a story…" (phone and desktop); founder F-1 rows; B "inside a story no heading…" ×3; M20 |
| 15 | The jump row is pinned, marks the section in view, and its back arrow works from every scroll position | J jump rows (order, observer, pin + back); B jump row at 393 and 320 |
| 16 | The bar shows the chosen question on one line; tapping it jumps to the chooser | J bar rows; B bar (one line, beside the action, jump) |
| 17 | With an agent the sheet gets its id and name; without one null for both; Work this idea hands the question's id | J sheet rows; S Work this idea (nulls); M13, M14 |
| 18 | One research read per page load, per close, per Try again; no other research request | J "one research read for a whole walk…"; requests N-4; S close/retry rows; M16 |
| 19 | With EXPLORE_MODE 'off' the Search page is as on main | O; page K-2 rows; bundle diff; M21a, M21b |
| 20 | No file under SharedResearch/, CommandCenter/, api/ or sharedResearchService.js changed | On the merge: `git diff --stat origin/main HEAD -- src/components/SharedResearch src/components/CommandCenter api scripts src/services/sharedResearchService.js firestore.rules firestore.indexes.json` prints nothing |

## Suite counts and baselines

**The full suite** ran on the merge `aab684e5`, in a WSL worktree of `~/pd-ci` (Node 20.20.2, `flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`):
- `Test Files  1698 passed | 14 skipped (1712)`
- `Tests  39574 passed | 202 skipped (39776)`, 0 failed, exit 0, 413 s

On the code head `ea2872b2`, before the merge: 1,692 | 14 (1,706) files, 39,496 passed, 0 failed, 202 skipped, exit 0. The 6 files and 78 rows the merge adds are `main`'s own (#1121, #1123).

Also on the merge: **lint gate** exit 0; **rules** `Test Files  48 passed (48)`, exit 0; **build** exit 0.

**Baselines:** the preamble's 26 files, `main` on Windows, against the head's rows in the WSL suite:

| File | `main` `a2e05fa9` (Windows) | Head `ea2872b2` (WSL suite) | Why |
|---|---|---|---|
| `api/_utils/explore/fetchSource.test.js` | 58 passed | 58 passed |  |
| `api/_utils/explore/matchRule.test.js` | 22 passed | 22 passed |  |
| `api/_utils/explore/matchStory.test.js` | 29 passed | 29 passed |  |
| `api/_utils/explore/review.test.js` | 120 passed | 120 passed |  |
| `api/_utils/explore/storyCheck.test.js` | 113 passed | 113 passed |  |
| `scripts/explore-publish.test.js` | 54 passed | 54 passed |  |
| `src/components/Explore/__fixtures__/exploreReads.test.js` | 2 passed | 3 passed | +1: the Build 2 read (K-19: `last.question`, `last.statement`, `agent`, each from the server's own shaping); its existing row edited (preamble 6) |
| `src/components/Explore/explore.browser.test.js` | 18 skipped | 23 skipped | Build 2's scenes replace Build 1's rows (skipped without `EXPLORE_BROWSER_URL`; 23 of 23 passed against the smoke page) |
| `src/components/Explore/explore.founder.jsdom.test.jsx` | 17 passed | 17 passed | same count; rows edited (preamble 6) |
| `src/components/Explore/explore.guard.test.js` | 50 passed | 54 passed | +4: the look row for each new component (`ExploreChain`, `ExploreShelf`, `ExploreJumpRow`) and "not written yet" in the banned words |
| `src/components/Explore/explore.page.jsdom.test.jsx` | 14 passed | 14 passed |  |
| `src/components/Explore/explore.requests.jsdom.test.jsx` | 1 passed | 1 passed | same count; 1 row edited (preamble 6) |
| `src/components/Explore/explore.review.jsdom.test.jsx` | 26 passed | 26 passed | same count; rows edited (preamble 6) |
| `src/components/Explore/explore.screens.jsdom.test.jsx` | 45 passed | 45 passed | same count; rows edited (preamble 6) |
| `src/components/Explore/explore.sheet.jsdom.test.jsx` | 19 passed | 19 passed |  |
| `src/components/Explore/exploreView.test.js` | 59 passed | 59 passed | same count; 1 row edited (preamble 6) |
| `src/components/Search/ScreenerView.saveLink.jsdom.test.jsx` | 3 passed | 3 passed |  |
| `src/components/Search/screenerAdapter.test.js` | 37 passed | 37 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.b6a.jsdom.test.jsx` | 27 passed | 27 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.b6c.jsdom.test.jsx` | 17 passed | 17 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.builder.jsdom.test.jsx` | 156 passed | 156 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.flows.jsdom.test.jsx` | 37 passed | 37 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.review.jsdom.test.jsx` | 34 passed | 34 passed |  |
| `src/components/SharedResearch/SharedResearchSheetBody.states.jsdom.test.jsx` | 38 passed | 38 passed |  |
| `src/components/SharedResearch/sharedResearch.boundary.test.js` | 59 passed | 59 passed |  |
| `src/config/exploreFlags.test.js` | 7 passed | 12 passed | +5: the `EXPLORE_COMPARE_ROUTE` pin |
| `src/components/Explore/explore.build2.jsdom.test.jsx` | — | 86 passed | new |
| `src/components/Explore/exploreView.build2.test.js` | — | 44 passed | new |
| `src/components/Explore/explore.build2.off.jsdom.test.jsx` | — | 1 passed | new |

**The baseline line:** unchanged except four files whose counts moved by added rows:
- `exploreReads` 2 → 3
- `explore.guard` 50 → 54
- `exploreFlags` 7 → 12
- the browser file 18 → 23 (skipped without a page)

There are also 27 existing rows edited, each listed under preamble 6, and three new files (86 + 44 + 1 rows).

**On Windows,** the same 29 files run wide timed out two rows:
- the flag pin's whole-`src` walk: 7 s, against 0.2 s alone;
- the first front-page mount, at its 2.5 s wait: 1.1 s alone.

Both pass alone. The walk now carries the repo's 30 s row timeout (`ea2872b2`).

## The bundle diff (minified vite build in WSL, Node 20.20.2; `main` vs the PR's tree; maps excluded)

Four builds: `main` `a2e05fa9` and `a037e022` are byte-identical (63 of 63 files: the merged PRs touch no front-end file), and the merge `aab684e5` is byte-identical to the code head `ea2872b2` (63 of 63). So the diff below, `main` against the head, is the PR's bundle diff.

63 files on each side. `ea2872b2` was also diffed against the build of `52faff53`, on which the alias analysis below ran: only `ExploreTab-*.js` differs (+66 B, the pinned bar's padding fix); the entry and every other chunk are identical once hashes are masked, so the classification carries over. (Two chunks are named `index-*.js`; the masked tree would merge them, so the entry was compared by name.) Classified with hashes masked (`-XXXXXXXX`) and, for the chunks that import from the entry, the import aliases masked (scratch scripts in the session scratchpad, not in the repo: `wsl/bundlediff.js`, `aliasonly.sh`, `entryonly.sh`):

| File | Change | Why |
|---|---|---|
| `ExploreTab-*.js` | 48,208 → 84,079 B | the build: the front page, the chain, the shelf, the story page, the jump row, the history |
| `ExploreRuntime-*.js` | 4,912 → 3,799 B | the stories source moved into the shared chunk below |
| `exploreView-*.js` → `exploreSources-*.js` | the shared Explore chunk renamed | the tab now reads the sources context too (the by-id read), so the shared chunk is the sources module, with the reader inside it |
| `SearchDiscover-*.js` | 23,888 → 23,891 B (+3) | the heading hidden inside a story (B-12) |
| entry `index-*.js` | identical once hashed names are masked and its export aliases set aside; 653 exports in both, the same names (proven on an unminified build of both) | — |
| 8 chunks: AgentBattleScreen, BaggerBombBattleViewConnectedV4, BarChart, CommandCenterHub, CorrelationLab, FantasyTimesFeed, PortfolioBuilderBaggerBomb, StonkOptionsArenaV2 | same size; only the entry's import alias letters differ (e.g. CorrelationLab `bY as CRYPTO_POOL_SYMBOLS` → `b_ as CRYPTO_POOL_SYMBOLS`) | Rollup re-letters the entry's export aliases when the importing chunk graph changes (the shared Explore chunk above); same exports, same bindings |
| 45 files | hashed names only | the chunk hashes above |
| `index-*.css`, 4 others | identical | — |

**Found and fixed on the way (not shipped):** the first head build gave the entry a NEW export (653 → 654): the lazy Explore chunk called a reader function, `exploreCompareRoute()`, in `src/config/exploreFlags.js`, which lives in the entry chunk (the nav imports `exploreMode`). Reading the constant itself (`=== true`) still kept the import, because the value flows into props. A literal ternary (`EXPLORE_COMPARE_ROUTE ? true : false`) folds, and the import disappears (commits 5125d77f, 10803025).

**With `'off'`, no Explore chunk is requested** (the built head, `build-final/dist`, against `build-main/dist`): `index.html` names no Explore chunk (no script, no modulepreload); the entry imports no Explore chunk, statically or dynamically; `SearchDiscover-*.js` reaches `ExploreRuntime-*.js` and `ExploreTab-*.js` only through `lazy(() => import(...))`, and in both builds those two `lazy(...)` results are bare expression statements — the build folded every use away with `EXPLORE_MODE` `'off'`, so nothing can render them and the chunks can never be fetched. The same shape on `main` and the head (scratch script `wsl/offchunks.sh`, `wsl/offctx.sh`). In jsdom the O row counts the Explore modules' factories at `'off'`: none run (M21b plants a load and is killed).

## The mutation table

Run by a scratch script (`mutants/run.mjs` in the session scratchpad, not in the repo) in a snapshot tree of the head (`git archive`, `node_modules` linked): each mutant's anchor must occur once (else BROKEN), its test files run with a JSON report, KILLED needs a non-zero exit and at least one failed assertion, then the file is restored and its SHA-256 compared. 43 of 43 KILLED, 0 SURVIVED, 0 BROKEN, every file restored (SHA-256 equal), and the tree's `src/` identical to the head after the run. The tree was `ea2872b2`; the merge changes nothing under `src/`. A control run of the battery's six test files on the unmutated tree came first: 207 passed, 0 failed.

**The P-1 browser mutant** (not in the jsdom battery: jsdom lays out nothing): on the smoke tree, the jump row's pre-fix labels (shrinkable, 13 px, the 40 px back arrow) — the 320×700 jump-row row fails ("connections: words outside the button", and questions, sources); the file restored, SHA-256 equal.

| # | Mutation | File | Verdict | Rows failed | One row that fails |
|---|---|---|---|---|---|
| M1 | a carried figure reaches the reader's view | `Explore/exploreView.js` | KILLED | 4 | exploreView.build2.test.js :: the view of each pilot holds none of the ten keys, at any depth |
| M2 | a source named only by a carried figure is listed | `Explore/exploreView.js` | KILLED | 5 | explore.build2.jsdom.test.jsx :: B-10: the sources list only what a connection cites — three of the overview's seven, none with a growth figure |
| M3 | the group is sorted | `Explore/exploreView.js` | KILLED | 5 | explore.build2.jsdom.test.jsx :: first visit: the hero is the newest overview — its question, its byline, its group as tickers, the chain with "This question" and a do… |
| M4 | a door is drawn for an unreadable target | `Explore/exploreView.js` | KILLED | 8 | explore.build2.jsdom.test.jsx :: a door whose target is not published (the read complete) is not drawn, on the hero, the card or the story |
| M5 | "not written yet" is drawn | `Explore/ExploreChain.jsx` | KILLED | 9 | explore.build2.jsdom.test.jsx :: a connection without a deep story says nothing about one |
| M6 | back goes to the overview when the player came from search | `Explore/ExploreTab.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: from the Latest row: back returns to the front page at the scroll left, focus on that row |
| M7 | returning forgets the open branch | `Explore/ExploreTab.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: a door, then back: the overview at the scroll left, the branch still open, focus on the door |
| M8 | the hero's story is also a card | `Explore/exploreView.js` | KILLED | 4 | explore.build2.jsdom.test.jsx :: the tile: a product-led overview, by its product, with its count line — never also a card; the hero never also a card |
| M9 | a product-led overview is a card | `Explore/exploreView.js` | KILLED | 4 | explore.build2.jsdom.test.jsx :: the tile: a product-led overview, by its product, with its count line — never also a card; the hero never also a card |
| M10 | the shelf's count reads a constant | `Explore/ExploreShelf.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: every number is the read's own (planted numbers no rule would compute): 4 of 7, 13 steps, 2 of 5 used; a ledger has no rail and no count |
| M11 | the empty shelf shows a count | `Explore/ExploreShelf.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: nothing in the read: the blank thesis sentence, the line, the day's use — no count, no rail; after the cards on a phone |
| M12 | a saved thesis shows an invented sentence when statement is null | `Explore/ExploreShelf.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: a saved thesis with no sentence shows its question; one whose record cannot be read shows neither — nothing invented |
| M13 | the agent's id is passed when the read has none | `Explore/ExploreSheetHost.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: without an agent in the read: null for the id, the name and the list; Continue and View it carry the agent too |
| M14 | questionId is left off the item | `Explore/ExploreStory.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: Work this idea: the read's agent (id, name, equipped list) and the chosen question's id |
| M15 | the compare wording shows with the switch off | `Explore/ExplorePanel.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: switch off: "Companies this question names", the built first step, no "Compares on", no Then — and no screen says "compare" |
| M16 | a second research read is made on opening a story | `Explore/ExploreTab.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: one research read for a whole walk of Build 2's controls, and none of the service's other calls; no story written |
| M17 | more than six by-id reads for one story page | `Explore/ExploreTab.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: at most six by-id reads for one story page, each id once for the tab's life |
| M18 | storyOf drops a story for a malformed optional field | `Explore/exploreView.js` | KILLED | 1 | exploreView.build2.test.js :: a kind that is not text: still drawn, the field left out |
| M19 | a second connections list is drawn on desktop | `Explore/ExploreStory.jsx` | KILLED | 3 | explore.build2.jsdom.test.jsx :: one list, the chain itself: the count line, the key, the subject, five branches, all closed |
| M20 | the page heading shows inside a story | `Search/SearchDiscover.jsx` | KILLED | 4 | explore.build2.jsdom.test.jsx :: isMobile true |
| M21a | with 'off', Build 2 changes what renders (the heading hidden) | `Search/SearchDiscover.jsx` | KILLED | 3 | explore.build2.off.jsdom.test.jsx :: the heading and the tab row are today's on every tab; no Explore module — Build 2's chain, shelf and jump row included — is ever l… |
| M21b | with 'off', an Explore chunk (Build 2's chain) loads | `Search/SearchDiscover.jsx` | KILLED | 1 | explore.build2.off.jsdom.test.jsx :: the heading and the tab row are today's on every tab; no Explore module — Build 2's chain, shelf and jump row included — is ever l… |
| M22 | N-1: back forgets a story's open Sources | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: N-1: back to a deep story keeps its Sources open, so Where next is where the player left it (scroll and focus) |
| M23 | N-2: an open sheet takes the live read's agent | `Explore/ExploreTab.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: N-2: an open sheet keeps the agent it opened with when a later re-read fails |
| M24 | N-3: Where next always in Sources | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: N-3: Where next belongs to the row's last section — with no listed source, Connections is marked while it is in view |
| M25 | N-3 gap: the observer never takes in Where next | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: the section observer takes in Where next when the parent arrives by id |
| M26 | P-2: no nav band kept clear | `Explore/ExploreTab.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: P-2: on a phone the bottom nav's band is kept clear for focus while Explore shows, and given back when it goes |
| M27 | P-3: the shelf's Try again drops focus | `Explore/ExploreShelf.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: P-3: the shelf's Try again hands focus to the shelf's heading, never to <body> |
| M28 | P-5: the end of a story marks the first section | `Explore/ExploreJumpRow.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: P-5: once the story's end is in view the row marks the last section that shows (Sources), not the first |
| M29 | P-6: desktop overview Tab order (connections first) | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: P-6: from 1000 px an overview's questions and panel come before its connections in the DOM (Tab reaches the action first); below, after |
| M30 | H-1: the bar borrows the chooser's question for Continue | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-1: with the read's open.question null, the bar beside Continue research carries no question (never the chooser's), the panel none, t… |
| M31 | H-4: Where next's own door rule without the kind check | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-4: Where next shows another connection's door only for a readable deep story (the one door rule) |
| M32 | H-6: an agent's name falls back to its id | `Explore/ExploreSheetHost.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-6: an agent with no name, no list: the sheet gets exactly what the read names, nothing in its place |
| M33 | H-3: a card marks a door for any leadsToStory | `Explore/ExploreChain.jsx` | KILLED | 2 | explore.build2.jsdom.test.jsx :: H-3: an overview on a CARD whose deep story is unreadable (complete) carries no "Deep story ›" |
| M34 | H-5: cards ordered by title | `Explore/exploreView.js` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-5: nothing is ordered by a value — the cards, the tiles, Latest and a deep story's About keep the read's own order |
| M35 | H-7: the shelf's heading counts the rows drawn | `Explore/ExploreShelf.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-7: the shelf's heading counts the read's lists, not the rows drawn: five finished, three shown |
| M36 | H-2: the count line counts listed sources as sourced | `Explore/ExploreChain.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-2: the count line is the connections' basis — the deep story lists five sources and counts three sourced |
| M37 | P-4: the reading line is the browser's dashes again | `Explore/ExploreChain.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: P-4: each label draws its own line, also at card size — solid, fine 3 px dashes, broken (two pieces and a gap) |
| M38 | P-2 leak: the bar puts back its own 'before' whatever is there (73px stays once Explore goes with the bar shown) | `Explore/ExplorePinnedBar.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: P-2: the bar and the nav band share the padding — the bar's while it shows, the band's when it goes, nothing left once Explore goes wi… |
| M39 | H-5: about sorted by name, Z to A (the refuter's survivor) | `Explore/exploreView.js` | KILLED | 1 | exploreView.build2.test.js :: about keeps the record's order (never sorted: review H-5) — an order that is no sort of symbol or name, either way |
| M40 | H-5: a deep story's About sorted on the page (by symbol) | `Explore/ExploreStory.jsx` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-5: nothing is ordered by a value — the cards, the tiles, Latest and a deep story's About keep the read's own order |
| M41 | H-5: tiles sorted fewest sourced first (the refuter's survivor) | `Explore/exploreView.js` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-5: nothing is ordered by a value — the cards, the tiles, Latest and a deep story's About keep the read's own order |
| M42 | H-5: tiles sorted most sourced first | `Explore/exploreView.js` | KILLED | 1 | explore.build2.jsdom.test.jsx :: H-5: nothing is ordered by a value — the cards, the tiles, Latest and a deep story's About keep the read's own order |

## The review (K-21; BUILD_RULES §2)

**Threshold:** the cumulative branch diff (code head against `main`) is 40 files, +5,383 / −544 lines (≥10 files or ≥1,500 lines: the review is mandatory).

**How it ran.** Four lenses, each a subagent on its own `git archive` extraction of `6d40e155` under the session scratchpad (`node_modules` linked), read-only on git and on the working tree; mutants planted only in its own tree. (a) honesty, prefix H; (b) navigation and wiring, prefix N; (c) accessibility and phone, prefix P, measured on the smoke page in headless Edge at 1280×900, 393×852 and 320×700; (d) dark and compatibility, prefix D, with a second extraction of `main` `a2e05fa9` of its own. Then one refuter, on two more extractions (`6d40e155`, the reviewed tree, and `6ee36653`, the fixed tree), told to refute every finding with a concrete repro and to say for each whether the fix resolves it. Every fix below was made on the branch, each with a row, and each row mutation-checked in the final battery (M22–M42). The refuter's verdicts brought a second round (commit `ea2872b2`): the rows its H-5 mutants survived, and the one new defect it found (the P-2 leak). That round was mutation-checked (M38–M42) and re-run through every check, but not handed back to the refuter: K-21 allows one round. A `vite build` of the final head ran (exit 0) and its bundle diff is above.

| # | Lens | Finding | Refuter | Disposition |
|---|---|---|---|---|
| H-1 | a | With `open.question` null, the pinned bar put the chooser's question beside *Continue research* (the panel and the shelf show none) | CONFIRMED · RESOLVED | Fixed: the bar carries the read's open question only (`ExploreStory.jsx`, the bar's `question`); row H-1; M30 |
| H-2 | a | No row tied the count line to `basis` (counting listed sources, or counting by Known, survived) | CONFIRMED · RESOLVED | Rows (jsdom H-2, a unit row on `countsOf`); M36 |
| H-3 | a | A card drawing "Deep story ›" for any `leadsToStory` survived | CONFIRMED · RESOLVED | Rows H-3; M33 |
| H-4 | a | Where next re-implemented the door rule; dropping its kind check survived | CONFIRMED · RESOLVED (the "self" half was never a defect) | Fixed: Where next calls `doorOf`; row H-4; M31 |
| H-5 | a | Sorting stories or companies by a value survived | CONFIRMED · NOT RESOLVED at the first fix (About Z–A by name, a sort of About on the page, tiles fewest-sourced first still survived) | Second round: About in an order that is no sort of symbol or name (the reader and the drawn story), three tiles whose sourced counts run 1, 0, 3; M34, M39–M42 |
| H-6 | a | The sheet's agent fallbacks (`name ?? id`, a list label from the agent's name) survived | CONFIRMED · RESOLVED | Rows H-6 (no name, no list; a list without a name); M32 |
| H-7 | a | The shelf's heading counting the rows drawn survived at render level | CONFIRMED · RESOLVED | Row H-7 (five finished, three shown); M35 |
| H-8 | a | The banned-words rows never opened Sources nor covered saved/concluded/limit/ledger; `seen()` skipped title and alt | CONFIRMED in part · RESOLVED | `seen()` reads text, aria-label, title and alt; the words rows run over every answer that reaches a story, with Sources open. The scan of `exploreCopy.js` alone is by design (K-18: no screen writes its own words). Leftover the refuter names: the jsdom regex leaves out verified/confirmed/watched, which no ruling bans; the copy-file guard covers its own list |
| N-1 | b | Back to a story re-mounted it with Sources closed, so Where next moved | CONFIRMED · RESOLVED | Fixed: Sources open is kept in the history (`SOURCES_OPEN`); row N-1; M22 |
| N-2 | b | An open sheet took the live read's agent; a failed quiet re-read turned it null mid-session | CONFIRMED · RESOLVED | Fixed: the sheet keeps the agent it opened with (`ExploreTab.jsx:240`); row N-2; M23 |
| N-3 | b | Where next was tagged Sources even with no Sources button; the observer gap survived | CONFIRMED · RESOLVED | Fixed: Where next joins the row's last section; rows N-3 and the by-id observer row; M24, M25 |
| N-4 | b | Tickers' focus keys were dead code with a promise in a comment | CONFIRMED · RESOLVED (by reading) | Removed |
| N-5 | b | `questionId` can be an id the page made up; a padded id is admitted by `storyCheck` | REFUTED · NOT FIXED | No published story can carry a made-up id (the publish step refuses no-id, blank and duplicate ids, `api/_utils/explore/review.test.js:262`); the padded id is the publish step's (out of scope, `api/` is a STOP path) |
| P-1 | c | At 320 the jump row's labels shrank below their words and a tap at a label's end hit the next section | CONFIRMED · RESOLVED | Fixed: labels never shrink, 12 px, the marker takes no width; the browser fit check at 393 and 320; the browser mutant KILLED. Leftover: with two-digit counts the last label runs 7 px past the row (no overlap, no sideways scroll) — under Watch |
| P-2 | c | With the bar hidden, Tab could leave focus under the app's bottom nav on a phone | REFUTED (no spec rule; the behaviour reproduced) · RESOLVED, but the fix leaked | Fixed: the tab keeps the nav's band clear (`ExploreTab.jsx:88-94`); M26. The refuter's new defect (leaving Explore with the bar shown left 73 px) fixed in the second round: the bar gives back only its own value (`ExplorePinnedBar.jsx`); row P-2 (shared padding); M38 |
| P-3 | c | The shelf's Try again dropped focus to `<body>`; the story panel's (Build 1) too | REFUTED (no spec rule; reproduced) · shelf RESOLVED, panel NOT RESOLVED | Shelf fixed (focus to its heading); row P-3; M27. The panel's Try again is Build 1's code: not changed here, proposed as its own task |
| P-4 | c | At card size the reporter's-reading and no-source lines looked the same in grayscale | CONFIRMED · RESOLVED | Fixed: fine 3 px dashes; row P-4; M37 |
| P-5 | c | At a story's end the row never marked Sources by scrolling | CONFIRMED · RESOLVED | Fixed: with the end in view, the last section showing is marked; row P-5; M28 |
| P-6 | c | From 1000 px an overview's Tab order ran all connection stops before the action | REFUTED (no rule) · RESOLVED (changed anyway) | The side block comes first in the DOM from 1000 px (placed in column 2 explicitly, so the layout is unchanged); row P-6; M29 |
| P-7 | c | While pinned, two landmarks named "Sections of this story" | REFUTED · NOT FIXED | The pinned bar's built pattern; under Watch |
| D-1 | d | The pin's "never at module scope" check matched only column-0 lines | CONFIRMED · RESOLVED | The reader function is gone; the pin row allows only the exact line `const compare = EXPLORE_COMPARE_ROUTE ? true : false;` (indented, inside a render) at exactly two files; a module-scope IIFE in that shape is caught by the switch-on behaviour row |
| D-2 | d | The entry chunk gained an export (`exploreCompareRoute`) and 13 chunks re-lettered | REFUTED (no rule on entry bytes) · RESOLVED | The literal ternary folds; the entry keeps its 653 exports (the bundle diff above, rebuilt on the final head) |
| D-3 | d | The O row checks the heading, the tab row and module loads, not the render against `main` | CONFIRMED · NOT FIXED | §8 check 19 rests on the render comparison, re-run on `52faff53` (identical, 69,296 bytes; with `'off'` the second round's change never mounts) |

**Split:** 17 CONFIRMED (H-8 in part) and 6 REFUTED of 23 findings. The refuter's tally line reads 16 / 7, but its verdicts per finding, in the table, give 17 / 6. On the fixed tree: 18 RESOLVED. NOT RESOLVED: H-5 (rows added in the second round, M39–M42) and the panel half of P-3 (Build 1's code, left as it is). NOT FIXED by choice: N-5, P-7, D-3.

**Re-checked on the final code:** on the merge `aab684e5`, the full suite, the lint gate, the rules suite and the minified build and bundle diff; on `ea2872b2` (the same `src/`), the 43-mutant battery and the browser rows (against both deployed smoke previews); and on `52faff53`, whose code differs only in the pinned bar's cleanup, lens d's render comparison (the Search page at `'off'`, server-rendered at phone, desktop and tablet and mounted in jsdom clicking every tab and the search overlay: byte-identical to `main`, 69,296 bytes each, no Explore module loaded, no request).

**Not fixed here, by choice:**
- **N-5** (the page's own question ids) — a founder question: `item.questionId` passes the id the page reads; a record without question ids gets `q${i}`-style ids from the reader, which the publish step refuses, so no published record carries one. A padded id `" x "` is admitted by `storyCheck` without a note while the reader trims it. Fixing it means changing the publish step (`api/`, a STOP path).
- **P-7** (two landmarks named "Sections of this story" while the row is pinned) — the pinned bar's built pattern (a portalled copy, its buttons out of the Tab order); listed under Watch on the allowlist.
- **The story panel's Try again** (`ExplorePanel.jsx`, Build 1) drops focus to `<body>` the same way P-3 did on the shelf. Build 1's code and behaviour; reported for a separate task.
- **D-3** (the O row does not compare the render with `main`) — the render comparison above proves §8 check 19 (with `'off'` the pinned bar never mounts, so the second round cannot touch it); a committed cross-tree row would need a second tree in CI.

## Watch on the allowlist

Not defects: things to look at while the founder and FT_QA use Explore at `'allowlist'`.

1. **The 40-story window.** The stories read takes the 40 newest published. Only when it holds fewer than 40 is it "complete". While it is complete, a door to an unpublished deep story is simply not drawn (no by-id read). Past 40, a story page reads its missing door targets or parent by id, at most six per page; the front page, the Latest row and search never do, so a deep story whose overview is outside the window shows there without its "overview › connection" line.
2. **A door drawn a moment late.** When the read is not complete, a door whose deep story is outside the window appears when its by-id read lands, after the overview has drawn.
3. **The pinned jump row is a second copy while pinned** (portalled to the end of `<body>`, its buttons out of the Tab order), the pinned bar's pattern. A screen-reader user swiping to the end of the page meets it there.
4. **The shelf lists every open investigation** the read holds (up to the server's 30), then three finished ones. A player with many open ones sees a long shelf above the hero on a phone.
5. **A thesis saved before B6a, or an idea saved by the older ledger sheet, has no sentence** (`statement: null`): the shelf shows its question instead, and nothing when the record cannot be read.
6. **The compare words are written and pinned off.** `EXPLORE_COMPARE_ROUTE` stays false until the compare build sets it; until then a broad question's panel says "Companies this question names" and the first step "checks the story against its source".
7. **Only the two pilot records are real.** The three samples (and the old-shape story) exist only in fixtures and on the smoke page, labelled "Sample story".
8. **Two-digit counts in the jump row at 320 px.** The row fits the pilot's counts with 4 px to spare. A story with ten or more in a section (sources or questions) runs the last label about 7 px past the row, into the page's gutter: nothing overlaps and nothing scrolls sideways (the refuter's probe).
9. **The story panel's Try again** (Build 1) still drops focus to `<body>` when the research read fails and is retried; the shelf's no longer does. Proposed as its own task.

## The PR description

**Explore Build 2 — the front page, the phone story page, and the story hierarchy (dark).** `EXPLORE_MODE` stays `'off'`; the new `EXPLORE_COMPARE_ROUTE` is `false`. Built to B6c §1, Amendment B, the content chat's note §3 and Rounds 2 and 3 (K-1's order). The report: `docs/audits/20261127_BUILD_EXPLORE_2.md`. The smoke page: https://trade-seven-7uqjswl88-fais-projects-bc179554.vercel.app/?exploreFixture=walk (branch `claude/explore-build-2-smoke`, never merged).

**The reader** (`src/components/Explore/exploreView.js`, import-free; `storyOf`'s drop reasons unchanged):
- `:48-58` the read limits (`STORIES_READ` 40, `LINKED_READS_MAX` 6, `LATEST_MAX` 3, `SHELF_FINISHED_MAX` 3, `BROAD_MIN` 3) and `KINDS`.
- `:105` `lastOf` keeps `question` and `statement`; `:114` `agentOf` → `{ id, name, equippedListName }`; `:125` `researchViewOf` carries `agent`; `:147` `agentFor`; `:155` `shelfOf` (open; the three newest finished by `last.at`; the read's own counts).
- `:178` `companyOf`/`companiesOf` (a symbol only in the listed shape); `:194` `questionsOf` adds `fromConnection`, `group` (the story's order), `broad`, `measureNames`; `:213` `connectionsOf` adds `id`, `ref`, `leads`, `known`, `unknown`, `whereToLook`, `leadsToStory`.
- `:236` `figureOnlySourceIdsOf` and `:250` `sourcesOf` (§5.3: a source only a figure names is not listed); `:260` `parentRefOf`; `:282` `storyOf` adds `kind`, `subject`, and on a deep story `parent` and `about`.
- `:336` `frontPageOf` (hero, tiles, cards, Latest; nothing ordered by a value); `:354` `countsOf` (from `basis`); `:364` `storiesByIdOf`; `:375` `doorOf` (one door rule: a readable deep story, not itself); `:381` `parentOf`; `:394` `linkedIdsOf`; `:405` `leadAssetOf` (RankingsView's object); `:443` `sheetItemOf` adds `questionId`; `:466` `storyMatchesOf` searches `subject`.

**The switch:** `src/config/exploreFlags.js:56-72` `export const EXPLORE_COMPARE_ROUTE = false;`, read in the render as a literal ternary at `ExploreHome.jsx:72` and `ExplorePanel.jsx:138`; pinned by `src/config/exploreFlags.test.js:82-134` and noted absent from the generic pin guard at `src/config/flagPinGuard.test.js:416`.

**New components:**
- `ExploreChain.jsx:145` the story's chain at three sizes (card, hero, story): `:30` `Mark`, `:43` `Segment` (solid · 3 px dashes · broken), `:74` `CountLine`, `:80` `Door`, `:100` `Gap` (Known · Unknown · Where to look; a blank Known reads "Nothing sourced yet.").
- `ExploreShelf.jsx:51` the shelf, "Your theses" (empty, holds, no access, failed, loading; Try again keeps focus on the heading); `:126` `shelfHolds`.
- `ExploreJumpRow.jsx:81` the jump row (back arrow + sections; pinned by a portalled copy, R-1); `:33` `sectionInViewOf`.

**Changed components:**
- `ExploreStory.jsx:109` the story page: no heading or tab row inside (B-12); `:215` the way up; `:239` the jump row; `:266` Sources kept open in the history; `:282` Where next (`:60`, the one door rule); `:53` `barActionOf`; the pinned bar's question.
- `ExploreHome.jsx:220` the front page: `:71` the hero, `:108` the cards with the card chain, `:138` Start from something you use, `:159` Latest deep stories, the shelf and Saved for later placed by one media query.
- `ExploreTab.jsx:49` the history (`:51` the stack; `:193` `openStory`; `:216` `back`; `:224` `toggleBranch`), `:88-94` the phone's nav band kept clear for focus, `:128` the by-id reads (only when the stories read is not complete; at most six per page), `:240` the sheet keeps the agent it opened with, `:242` Work this idea hands the question's id.
- `ExplorePanel.jsx:43` `GroupBlock`, `:94` `StartsWithIt` (compare words only with the switch on); `ExplorePinnedBar.jsx:101-117` the question on one line, a button to the chooser, and `:62-82` the bar gives back only its own scroll padding (the refuter's leak); `ExploreSearch.jsx:48-81` both kinds of story, a deep one marked with its overview; `ExploreSheetHost.jsx:246-248` `agentName`, `agentId`, `equippedListLabel` from the read's agent (null when it has none); `ExploreQuestions.jsx:26` the heading takes focus.
- `exploreCopy.js` every new word (`:21` home, `:55` shelf, `:76` chain, `:110` search, `:128` story, `:206` panel.group, `:220` bar); `exploreParts.jsx:13` `useMatches`, `:31` `Ticker`, `:55` `Tickers`, `:180` `Disclosure` (controlled); `exploreStyle.js:48-50,117-129` the classes and `WIDE_QUERY`; `exploreSources.js:43` `readStory` (one story by id).
- `src/components/Search/SearchDiscover.jsx:61-64,99,163,216` the page heading and the tab row are not drawn while a story is open (Explore on only).

**Fixtures and tests:** the pilot pair word for word (`__fixtures__/pilot/`), the samples rewritten in the new shape (`stories.js`), `exploreReads.json` regenerated by its own command with `agent` and the new reads; new rows in `exploreView.build2.test.js` (44), `explore.build2.jsdom.test.jsx` (86), `explore.build2.off.jsdom.test.jsx` (1), `explore.browser.test.js` (23, run against the smoke page); 27 older rows changed, each listed with its reason in the report (preamble 6).

**Fenced functions called: none. Fenced functions edited: none.** No file under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `api/`, `scripts/` or `src/services/sharedResearchService.js`; no Firestore rule, index or collection; no new research request; no write but a bookmark.

**Checks** (on the final tree merged with `origin/main`): lint gate exit 0; full suite 1,698 files passed, 14 skipped (1,712); 39,574 tests passed, 0 failed, 202 skipped; exit 0 (413 s), on the merge `aab684e5`; rules 48 files passed; minified build exit 0, bundle diff in the report; 43 of 43 mutants KILLED (and the P-1 browser mutant); the browser rows 23 of 23 at three sizes on the smoke preview; review: four lenses + refuter, 17 CONFIRMED / 6 REFUTED; every CONFIRMED finding resolved but D-3 (proved instead by the render comparison); the one new defect the refuter found (the P-2 leak) fixed in a second round.

Dark · draft · the founder merges.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## The founder's phone checklist

On the smoke preview (https://trade-seven-7uqjswl88-fais-projects-bc179554.vercel.app), iPhone, `?exploreFixture=walk` unless named:

1. **The front page:** a hero question with its four companies as buttons and a picture of the story's five connections. One branch is marked "This question". One has a door.
2. **The shelf:** on a first visit it shows a blank thesis sentence and no count. `home-returning`: an investigation in progress with Continue research, and a saved thesis showing its own sentence.
3. **The rows:** "Start from something you use" and "Latest deep stories" are there. `home-empty-rows`: both are gone, with no empty headings.
4. **Open the overview:** no "Explore" heading and no tab row. The row at the top reads Story · Connections · Questions · Sources and stays pinned as you scroll.
5. **Connections:** one list. Tap a branch: it opens in place with Known, Unknown and Where to look, and the companies two to a row. Nothing says "not written yet".
6. **A company button** opens that stock's research page.
7. **The door:** tap the Dominion story under Electric utilities. Above its title: "AI buildout › Electric utilities" and Dominion's button.
8. **Back:** the arrow returns you to the overview, at the same place, with the same branch open.
9. **Where next,** at the end of the Dominion story: one step up, and the overview's other connections.
10. **The question in the bar:** it shows on one line beside *Work this idea*. Tap it: you jump to the questions.
11. **Sources:** the overview lists three. None of them shows a growth figure for Microsoft, Amazon, Oracle or CoreWeave.
12. **Start and return:** *Work this idea*, close, *Continue research*, as before. The sheet uses your agent's name.
13. **Search:** type "Dominion". The deep story comes up, marked with the overview it belongs to.
14. **Live app:** nothing has changed anywhere.

## WSL and the space freed

- **WSL:** `~/pd-exb2` (the branch) and `~/pd-exb2-main` (`main`) were private worktrees of `~/pd-ci`, with runs under `~/pd-exb2-runs`. Each `node_modules` was a link to `~/pd-ci-b6/node_modules`. The links were removed first, then `git worktree remove --force` and `prune`, then the runs. **908 MiB freed** (df; du: 226 + 220 + 440 MiB).
- **Windows scratchpad:** eleven snapshot trees (the four lenses, the refuter's two, three mutation trees, the smoke tree, the render-comparison tree for `main`) and four extracted copies. Each `node_modules` junction was removed first, with `rmdir`. **2,280 MiB freed.**

The shared installs (`~/pd-ci-b6/node_modules`, `C:/Users/fashr/portfolio-duel/node_modules`) are untouched. No other session's tree was touched.
