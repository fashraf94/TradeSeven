# Build report — Explore Build 1: the front page of Search, and its door into Work an idea (dark)

**Smoke preview (founder's phone; never merged):** **https://trade-seven-lely9wo60-fais-projects-bc179554.vercel.app/?exploreFixture=walk** — branch `claude/explore-build-1-smoke` at `b5b30137` (the final Explore code, `1c1f1226`, plus two smoke-only commits; the merge of `main` after it changes no client file). Open `?exploreFixture=walk` first; `?exploreFixture=index` lists every scene. Every quoted string of the phone checklist (§15) was checked on this deployed preview by script: 36 of 36.

**Date:** Sat Nov 21, 2026 · **By:** Claude Code · **Branch:** `claude/explore-build-1` (draft PR, the founder merges) · **Base:** `origin/main` `48519abf` (#1103, B6a) · **Final tree:** `fad5c009` (`main` `4037df59` merged in) · **Spec:** `docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md` · **Design:** `docs/design/explore/EXPLORE_ROUND_1.html` · **Ships:** dark, `EXPLORE_MODE = 'off'`.

## 1. Verdict

| Item | Result |
|---|---|
| Ships dark | **Yes.** `EXPLORE_MODE = 'off'` (`src/config/exploreFlags.js`), pinned by `exploreFlags.test.js`. At `'off'` the Search page, its tabs, heading and the nav are today's; the research read is never made and no Explore chunk is requested (§9 check 17) |
| The spec's acceptance checks (§9: 1–19 and 12b) | **20 of 20 pass**, each with its rows (§9) |
| The boundary (K-3) | Exactly the two allowed Explore files reach the sheet; the sheet's boundary test passes **unedited** (§6) |
| Protected paths | `SharedResearch/`, `CommandCenter/`, `api/`, the service, `Forge/`: **0 files changed** (§6) |
| Full Linux suite on the final tree | **exit 0.** 1,634 files, all passed; 37,590 rows: **37,396 passed, 0 failed**, 194 skipped (15 of them the browser rows, run separately) (§8) |
| `npm run lint:gate` | **exit 0** |
| `npm run test:rules` | **exit 0**: 47 files, 871 rows (the new `exploreBookmarks.rules.mjs`: 30) |
| Minified build | **exit 0** |
| Baselines | **Unchanged:** 10 files, 485 rows, all passing, as on the base; the sheet's boundary test unedited (§8) |
| Bundle diff | CSS identical; every differing file has its reason (§7) |
| Mutations | **20 of 20 killed** (19 in the jsdom rows, 1 in the rules) (§11) |
| Browser rows (headless Edge, smoke page) | **15 of 15** at 1280×900, 393×852, 320×700 |
| Review (BUILD_RULES §2) | Four lenses + one refuter: **23 in-scope findings, all CONFIRMED, all FIXED** with rows; the refuter's one regression (R-1) fixed (§10) |
| Renders | 78 PNGs (26 states × 1280×900, 393×852, 320×700) from the final smoke head, in `C:/Users/fashr/Documents/FantasyTrades/Explore/B1/renders/`. At 1280 the app's own desktop sidebar (a 220 px content-box with 16 px padding and a 1 px border: 253 px) covers the first 33 px of the content's 220 px margin — as on `main`; this build changes only the sidebar's label (§5) |
| Founder questions | SQ-1 to SQ-5 applied as the prompt's defaults; SQ-6 to SQ-10 new, none blocking (§5) |
| Fenced files | none called, none edited |

**Ready for the founder's merge · dark · the switch to `'allowlist'` is a separate one-line founder PR, after the rules are deployed and the first stories are published.**

## 2. Base and the preamble's findings

**Base.** `git fetch origin main` first (BUILD_RULES §3). #1103 (B6a) was merged: `origin/main` was `48519abf`. Branch `claude/explore-build-1` cut from it in the session's worktree; clean tree. K-0: the two attachments are the first commit, `569d0987`, each byte-identical to its attachment (SHA-256 `3ef6539dd863f34a…` and `a232c3eaa50504d0…`; both LF). `main` then moved twice: to `56220130` (#1102, Film Room D1), merged in at `1271dba6`, and to `4037df59` (#1098 and #1101: Practice Field server code, scripts and docs), merged in at `fad5c009`. Neither shares a file with this build, and every final check ran on the final merged tree.

| # | Preamble step | Finding | Where (VERIFIED, read this session) |
|---|---|---|---|
| 1 | Branch | `claude/explore-build-1` at `48519abf`, clean | — |
| 2 | B6a §1 against the merged code | **No shape differs. No STOP.** The read is `GET ?list=explore` → `{ quota: quotaViewOf(day), items }`; each item `{ itemRef, itemVersion, open \| null, last \| null }` with `open { sessionId, question, lastTurnAt, filled, parts, stepsLeft, findingsCount }` and `last { sessionId, ended: 'saved' \| 'concluded', at }`. The service resolves `{ ok, status, body, retryAfterS, gated, network }`, `gated` = a 404 `disabled`. The body takes `startNow` and `words`; `mode: 'session'` with a `sessionId` opens a closed builder investigation read-only (two B6a rows). The boundary allows exactly `Explore/loadSharedResearch.js` (one load-time `import('../SharedResearch/SharedResearchSheetBody.jsx')`) and `Explore/useExploreResearch.js` (exactly `{ readExploreInvestigations }`). | `api/forge/shared-research.js:162`; `api/_utils/sharedResearch/explore.js:1-165`; `api/_utils/sharedResearch/session.js:295-299`; `src/services/sharedResearchService.js:36-73`; `src/components/SharedResearch/SharedResearchSheetBody.jsx:16-37, 64-130`; `src/components/SharedResearch/sharedResearch.boundary.test.js:104-163`; `SharedResearchSheetBody.b6a.jsdom.test.jsx` (Q-1 rows) |
| 3 | Baselines (on the base, Windows) | 10 files, **485 rows, all passing**: `sharedResearch.boundary` 59; `SharedResearchSheetBody.b6a` 27, `.builder` 156, `.flows` 37, `.review` 34, `.states` 38; `Search/screenerAdapter` 37, `Search/ScreenerView.saveLink` 3; `Research/CorrelationLab.smoke` 84; `config/flagPinGuard` 10 | §8 |
| 4 | The stories query | `exploreStories` where `status == 'published'`, `orderBy('publishedAt','desc')`, `limit(12)`: an equality on one field with an order on another **needs one composite index**, added: `exploreStories (status ASC, publishedAt DESC)`. | `firestore.indexes.json` (the one new entry) |
| 5 | The company matcher | Inline in `SearchOverlay`'s `useMemo` (`SearchOverlay.jsx:26-32` on `main`) — not importable. **Moved once**, unchanged, to `src/components/Search/companyMatch.js` (`matchCompanies`, and `researchAssetOf`, the asset object the overlay hands AssetResearch); both `SearchOverlay` and Explore's search import it. | `src/components/Search/companyMatch.js`; `SearchOverlay.jsx:5, 26, 36` |
| 6 | The agent's name and id | The hub takes them from its own readers inside `src/components/CommandCenter/` (`CommandCenterHub.jsx:892-906`, `readers.agent`; `equippedListLabelOf` in `hub/researchDoorView.js:132`). Nothing outside the hub holds them; App hands the Search page only `user`, `isMobile`, `isDesktop`, `setScreen`, `stocksData`, `sidebarCollapsed` (`App.jsx:10036-10046`). **All three are `null`** (spec §3.6): the sheet says "your agent" and offers no "Use it in my next game". | — |
| 7 | The question's limit | The route checks an opening question with `cleanPlayerText(raw, OBSERVATION_MAX)` (`api/forge/shared-research.js:252-256`), `OBSERVATION_MAX = 500` (`api/_utils/sharedResearch/session.js:39`); the record's own limit is `QUESTION_MAX_LEN = 500` (`api/_utils/researchRecords/model.js:611`); the sheet's preview textarea has a literal `maxLength={500}` (`SharedResearch/parts.jsx:113`). Explore holds `QUESTION_MAX = 500` (`exploreView.js`), pinned equal to `OBSERVATION_MAX` **and** `QUESTION_MAX_LEN` by `exploreView.test.js`. | — |

## 3. Routine choices made here

None of these changes a ruling; each is the build's own small decision, listed so the founder can see it.

1. **The new tab's id is `exploreHome`.** Today's movers tab keeps its id `'explore'` (and its file); beside the new tab it is labelled "Markets".
2. **The page's chrome words live where their neighbours do.** The heading "Explore", the tab labels "Explore" and "Markets", the nav's "Explore" and the Suspense line "Loading Explore..." are inline literals in `SearchDiscover.jsx` and the two nav files, like "Discover", "Rankings" and "Search" beside them. Every word *on an Explore screen* is in `exploreCopy.js` (guarded). Importing `exploreCopy.js` into the Search page or the nav would pull an Explore module into the Search chunk or the entry (K-2).
3. **The page's reads live in one lazy component, `ExploreRuntime`.** It draws nothing; it holds the research read, the stories and the bookmarks for the Search page's life and hands one snapshot up. The tab content remounts on every tab switch (the page's `AnimatePresence` keys it), so reads there would repeat.
4. **At `'allowlist'`, an admitted player keeps the tab for the page's life.** Once the read has answered `ready`, a later failed re-read (after a sheet close) shows form E inside the tab instead of removing the tab under the player. The stories and bookmarks are read only after the read admits the player (at `'on'`, at mount).
5. **The stories and bookmarks sources come through a React context** (`ExploreSourcesContext`), whose default is Firestore. The jsdom rows and the smoke page hand in fixture sources. Nothing a URL or stored value can change.
6. **Save for later keeps its label.** The toggle's pressed state is `aria-pressed` plus the filled mark, so its accessible name stays the same (the mockup changed the words to "Saved for later").
7. **The pinned bar's small line**: the cost line with Work this idea; the progress line ("In progress · 1 of 6") with Continue research, which costs nothing.
8. **The pinned bar's button takes no Tab stop** (`tabIndex -1`); it is not hidden from assistive tech. Keyboard users reach the panel's own button, and focusing it scrolls it on screen, which hides the bar (K-14 "not in the tab order twice").
9. **Home stays mounted (hidden) under a story**, so ← Explore returns to the same search text, topic and cards, and focus goes back to the very control that opened the story.
10. **After a close, the opener stays where it was on screen.** The read's answer turns form A into the shorter form B *above* the button; Chromium's scroll anchoring would keep the button still and Safari's lack of it would make the button jump. The tab keeps the opener's on-screen position itself (one `scrollBy` of the difference, after the answer lands) and turns native anchoring off under its root, so every browser does the same. The close itself never moves the page.
11. **The sheet host**: title "Work an idea", eyebrow "Explore" (the hub's is "Shared Research"); a 720 px dialog from 700 px wide, a full-screen bottom sheet below (`height: 100%`); layer 1000, below the body's SignalDrop modal (1001).
12. **Search shows at most 6 story rows and 5 company rows** (the shared matcher returns up to 20, as the overlay shows).
13. **Dates** read "Nov 20, 2026" in Eastern time (the app's day).
14. **A source's link is drawn only for an http(s) URL**; anything else shows no link.
15. **Two columns from a 1000 px viewport** (spec §3.2); the pinned bar on a wide screen starts at the app's sidebar offset (64 or 220 px, the same `marginLeft` App gives the page).
16. **Explore restates the record kind** `'exploreStories'` (pinned equal to `src/constants/sharedResearch.js` by test), and sets `text-wrap` inline: the bundle diff (§7) showed the CSS token `text-wrap` minting a global Tailwind utility.
17. **A story with no featured question** has no card on home but is found by search.
18. **Browse topics** has an "All topics" chip that clears the filter; chips are `aria-pressed` toggles.
19. **The bookmarks read** orders by `savedAt` (desc, a single-field index), at most 50; a saved title is cut to 200 characters (the rules' bound).

## 4. Every screen and state, as built

Each line names the field it reads and the row that holds it. "the read" = `GET ?list=explore` through `useExploreResearch.js`; "the stories" = one `getDocs` of `exploreStories`; "the bookmarks" = one read of `users/{uid}/exploreBookmarks`.

### 4.1 The page (`SearchDiscover.jsx`)

| State | What shows | Reads | Rows |
|---|---|---|---|
| `'off'` | Today's page: heading "Discover", tabs Explore (movers) · Rankings · Institutional · Screen · Correlations, today's search bar; no Explore module requested; no read | nothing new | `explore.page` K-2 (3 rows); the off-identity probe (§9) |
| `'allowlist'`, read running / gated / failed | Today's page; no stories or bookmarks read | the read | `explore.page` K-5 (4 rows) |
| `'allowlist'`, read ready | Heading "Explore"; tabs Explore · Markets · Rankings · …; the Explore tab opens by itself only if nothing was tapped (a tab, the search bar, a row) | the read | `explore.page` "a tap before the read answers…", "the search bar tap counts" |
| `'on'` | Explore first and open for everyone; gated and failed are states inside it | the read | `explore.page` K-5 'on' (4 rows) |
| Nav | "Search" at `'off'` and `'allowlist'`; "Explore" at `'on'` (BottomNav and the desktop sidebar) | the switch | `explore.page` (3 rows) |

### 4.2 Home (`ExploreHome.jsx`, spec §3.2)

| State | What shows | Field | Row |
|---|---|---|---|
| Loading | "Loading stories…" (`role=status`) | the stories (loading) | screens "loading: one line" |
| No stories | "No stories to explore yet"; search still works | the stories (empty) | screens "no stories" |
| Stories failed | "Couldn't load stories" (`role=alert`) · Try again (one more read) | the stories (failed) | screens "stories failed" |
| Cards | One per **featured question**, the question as the headline; origin "From {reporter}" or "Product"; "Sample story" on fixtures; title · reporter · date; Read the story; Save for later | the stories | screens "the cards" |
| One in progress | Card: **Continue research** first, Read the story beside; state "In progress · {filled} of {parts} · {stepsLeft} steps left"; a row under Research in progress (its question, the same line, Continue) | the read's `open` | screens "one in progress", planted "4 of 7, 13 steps" |
| Open, no card (ledger) | "In progress · {n} steps left" | `open.filled === null` | screens "a ledger investigation" |
| Thesis saved / Concluded | "Thesis saved · {date}" / "Concluded · {date}"; Read the story | the read's `last` | screens (2 rows) |
| A bookmark alone | Under Saved for later: "Saved · not researched"; not under Research in progress | the bookmarks | screens "a bookmark alone" |
| Saved and in progress | In both lists, with its in-progress state | both | screens "saved and in progress" |
| Bookmark whose story is gone | Its title, "No longer available", Remove | bookmarks ∖ stories | screens "a bookmark whose story is gone" |
| Open investigation, story gone | Still under Research in progress, with its question and Continue (mode `session`) | the read's `open` | screens "an open investigation whose story is gone" |
| Topics | Chips from the stories that have a featured question; "All topics" clears | the stories | screens "topics filter the cards" |

### 4.3 The reader and the panel (`ExploreStory.jsx`, `ExplorePanel.jsx`, spec §3.4–§3.5)

| State | What shows | Field | Row |
|---|---|---|---|
| Open a story | Scroll to the top, focus on its title | — | screens "opening a story…"; browser walk |
| Back | Home at the scroll left, focus on what opened the story | — | screens "← Explore returns home…" |
| Form A | Proposed question (textarea, max 500), "Use the story's wording" once edited, **What starts with it** (Story · Question · Angle · First step · Companies when the story has tickers · Still open), the cost line, **Work this idea** (disabled while empty) | the read's `quota`; no item for the story | screens "form A…", "editing shows…", "a story without tickers…", planted "2 of 5" |
| Daily limit | "You've used today's {perDay} investigations…" and Save for later as the primary; no start control anywhere | `investigationsToday >= perDay` | screens "at the daily limit…", planted "5 of 5" |
| Form B | "You have an investigation on this story."; its **original** question, "In progress · {filled} of {parts}", "{n} steps left", last update; **Continue research**; another question → only "One investigation per story…" | the read's `open` | screens "form B…" (K-10) |
| Form C | "Thesis saved · {date}" / "Concluded · {date}", **View it**; form A's controls below the line | the read's `last` | screens "form C (saved/concluded)" |
| Form D | The question, what starts with it, the hub's gated line + "You can read the stories; starting an investigation needs research access.", Save | `gated` | screens "form D…" |
| Form E | The question, what starts with it, "Couldn't check your research" (`alert`) · Try again (one read), Save | failed read | screens "form E…" |
| Connections / Sources | Collapsed; each connection one of the three E-1 labels + its basis line + leads; each source its own "Evidence dated …" | the stories | screens "the connections…" |
| Questions | A radio group: arrow keys move choice and focus; one Tab stop | the stories | screens "the questions are a radio group…" |
| Pinned bar | Shows only while the panel's own button is off screen; same action; the cost or progress line | IntersectionObserver | sheet K-14 (5 rows); browser "primary action on screen…" |

### 4.4 Search (`ExploreSearch.jsx`, spec §3.3)

| Input | What shows | Row |
|---|---|---|
| A story's words | Stories and questions first; a tap opens the story with that question chosen | screens "a story match…" |
| A ticker or name | Companies (the shared matcher); a tap opens AssetResearch | screens "a company opens AssetResearch…" |
| Nonsense, with access | "No story on this yet." above **Work "{text}" from your own words** (last; from 3 characters) | screens (2 rows) |
| Nonsense, gated or failed | "No story on this yet. Try a company name or ticker."; no own-words row | screens (2 rows) |

### 4.5 The sheet host (`ExploreSheetHost.jsx`, spec §3.6)

| Way in | Props | Row |
|---|---|---|
| Work this idea | `mode 'item'`, `startNow`, `item` = story + question as edited | screens "Work this idea…", sheet K-8 table |
| Continue research (card, row, panel, bar) | `mode 'session'`, `open.sessionId` | screens (2 rows), sheet K-8 table |
| View it | `mode 'session'`, `last.sessionId` | screens "View it…" |
| Own words | `mode 'start'`, `words` | screens "search's own words…" |
| Always | `open`, `direction: null`, `stories: []`, `agentName/agentId/equippedListLabel: null`, `gated` (the read's), `phone`, `onClose`, `overlayStack: null`; a fresh body per opening (`key`) | sheet "a fresh body for each opening…" |
| Lines | Loading "Checking your research"; failed load "Couldn't open Shared Research" (`alert`) · Try again (fresh import); a body that throws → the same | sheet (3 rows) |
| Focus, inert, keys | Focus to Close; inert others, released exactly; Escape from inside only; Tab wraps; back to the opener (else the screen's anchor) without a scroll | sheet (3 rows), screens "closing it…", browser walk |

## 5. The founder's questions

**Applied as the build prompt's defaults** (each word is pinned in `exploreCopy.js` by the guard's "the spec's fixed lines, as approved (SQ-1 to SQ-4)"):

| Id | Default applied |
|---|---|
| SQ-1 | "Start with a question. Research begins only when you choose to work one." |
| SQ-2 | "Uses 1 of your {perDay} investigations today · {used} used" |
| SQ-3 | "You've used today's {perDay} investigations. Save this story and start it tomorrow." |
| SQ-4 | "One investigation per story. Continue this one to take it further." |
| SQ-5 | The nav stays "Search" at `'allowlist'` and reads "Explore" at `'on'` |

**New, for the founder** (nothing waits on them; each is built as stated):

| Id | Question | As built |
|---|---|---|
| SQ-6 | **Bundle (review D-1).** At `'off'`, the hub's preload table lists three small shared chunks (`sharedResearch`, `sharedResearchService`, `loadoutService`) and no longer lists `LoadoutStill`, `gameOutcome` and `agentGrowth`; the sheet body imports the service and the constants from those chunks (§7). It is inherent to the second door K-3 allows; no behaviour changes. Accept? | Accepted as inherent: the three new chunks are 4,648 B in all; the hub's own chunk is 2,629 B smaller |
| SQ-7 | Spec §4's line "Your agent's first step checks the story against its **sources**." The builder's first goal reads the story itself, not its `sources[]` ("Check the story against its source"). Change to "its source"? | The spec's approved wording |
| SQ-8 | Search's own-words row shows at the daily limit (it starts nothing on tap; the sheet then says the limit). Hide it at the limit instead? | Shown |
| SQ-9 | The stories rule lets any signed-in player read any `exploreStories` document, drafts included (the page itself reads only `published`). Tighten to `resource.data.status == 'published'`? | Signed-in read (the build prompt's block) |
| SQ-10 | Spec §3.5 asks form C for "Thesis saved · {date}" **with its question**; the read's `last` carries `{ sessionId, ended, at }` and no question. Form C shows the ended line and *View it* (which opens the investigation, its question included); the question box below it is form A's for a new start. Add `question` to `last` in a later B6 build? | Built without the question (no field the read does not return) |

**Disclosed:** K-2 asks for the flag to be noted in `flagPinGuard.test.js`'s `DARK_BY_DESIGN` block, so that baseline file carries a **comment-only** edit (16 lines; no row added, moved or changed; its 10 rows pass). **Pre-existing, for separate tasking:** the desktop sidebar is a content-box (220 + 32 padding + 1 border) that overlaps the content's 220 px margin by 33 px; the Search page's own tab strip already scrolls sideways at 320 and 393 (review C-5).

## 6. The boundary and the STOP list, as held

| STOP item | Held by |
|---|---|
| Nothing under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `api/`, or `src/services/sharedResearchService.js` | `git diff --name-only origin/main HEAD -- <path>`: **0 files** for each (also `src/components/Forge/`: 0) |
| Exactly two Explore files reach the sheet | the sheet's own `sharedResearch.boundary.test.js` (unedited, 59/59) and Explore's guard "the boundary (K-3) holds on the real files" + "the scan bites (planted, one file at a time)"; M17 |
| No third file loads the body, imports the sheet's directory, names it in a string, or imports the service | the same two; and the guard's rows over the build's files outside Explore (the Search page, the overlay, the matcher, both nav files, the flag module) |
| No body prop that does not exist; no field the read does not return | `bodyPropsOf` hands only the props `SharedResearchSheetBody` declares (sheet K-8 table); every field the page reads is in preamble 2's shape; form C without a question (SQ-10) |
| One research read per mount, one per close, one per Try again; no other request | requests (the whole page scripted: one read, no fetch); screens "closing it: the read once more", "Escape closes…: the read runs once per close", form E's "exactly one read"; M10, M11, M16 |
| `EXPLORE_MODE` is `'off'`; no other flag changed | `exploreFlags.test.js` pins it; `git diff origin/main HEAD -- src/config`: the new flag module and its test, and the guard's comment; no other flag file |
| The Search page at `'off'` unchanged; no existing Search or nav row edited | §9 check 17; `git diff origin/main HEAD -- '*.test.*'`: no existing Search or nav test file changed |
| `firestore.rules`: the two blocks only; `firestore.indexes.json`: the one index | the diff of each: the two blocks; the one entry |
| Nothing computed on the client that the server returns | screens K-7 (planted numbers no rule would compute); M5, M6 |
| No "Supported", "Source-backed", confidence number, literal agent name, "Shadow", or a line saying sources or leads travel | guard "the words" (AST walk, planted rows), "What starts with it never says that the sources or the company leads travel"; review A-8; M13 |
| Samples only in `__fixtures__`; a `sample: true` record from the collection is never drawn | guard; `exploreView.test.js` K-6 ("sample: true" dropped); M12 |
| No fenced file called or edited | none (BUILD_RULES §1 list checked against the diff) |
| No network call in a test; no model or provider call | the jsdom rows stub the service and the sources; the requests row fails on any `fetch`; no file calls a model |

## 7. The bundle diff (minified, `main` `4037df59` vs the head `fad5c009`)

Built with `vite build` in WSL on each tree. `main`'s own client bundle did not change across its move from `56220130` to `4037df59` (58 of 58 files byte-identical: its new commits are server, scripts and docs). Every file, compared by bytes, then by bytes with chunk hashes masked, then by acorn token skeleton (names masked):

| Files | What | Why |
|---|---|---|
| `index-Bt3Ms9P_.css` + 4 others | **identical** (SHA-256 `aae6553465c34901…` both) | the global CSS: no new utility (the `text-wrap` token is set inline, choice 16) |
| 17 chunks | **hash in a name only** | they import a renamed chunk |
| 31 chunks | **names only** (token skeletons equal) | the entry gained one export, so the minified export names shift by one |
| `FilmRoomScreenV2` | 147,214 → 147,208 (−6), **names only** | the same shift; where an alias now equals its local name, `ei as ei` prints as `ei` |
| `SearchDiscover` | 22,995 → 23,867 (+872) | the switch's reads, the two lazy imports (never called at `'off'`), the moved matcher |
| `CommandCenterHub` | 208,868 → 206,239 (−2,629) | the shared constants and service moved to chunks of their own; its preload table lists those three in place of `LoadoutStill`, `gameOutcome` and `agentGrowth` (D-1, SQ-6) |
| `SharedResearchSheetBody` | 149,957 → 148,414 (−1,543) | it imports the service and the constants from those chunks now (D-1) |
| `ExploreRuntime` 4,912 · `ExploreTab` 47,791 · `exploreView` 5,255 | **added** | Explore's own lazy chunks: requested only when the switch is not `'off'` |
| `sharedResearch` 2,284 · `sharedResearchService` 1,833 · `loadoutService` 531 | **added** | split out because each now has two importers (the hub's door and Explore's; D-1) |
| entry `index-*.js` | 5,094,035 → 5,094,244 (+209), new name | `exploreMode()` folded to `function(){return"off"}`; the two nav label reads (today's labels at `'off'`); the preload table's two new names (its indexes shift); one new export |

**In one line:** CSS identical; 3 Explore chunks + 3 shared chunks added; `SearchDiscover` +872 B, the hub −2,629 B, the sheet −1,543 B (moved to the shared chunks); entry +209 B (the folded switch, two nav reads, the preload table); 48 more differ in names only.

## 8. Tests, checks and baselines

Every check ran on the final merged tree `fad5c009` (`main` `4037df59` merged in), in a private WSL worktree of `~/pd-ci` (`node_modules` linked from a tree with the same lockfile, `e457c10d0317`). Each result is read from its exit code and its own report, never through a pipe.

| Check | How | Result |
|---|---|---|
| Full Linux suite | `TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8 --reporter=json` | **exit 0.** 1,634 test files, all passed (the JSON report's `testResults`); 37,590 rows: **37,396 passed, 0 failed, 194 skipped** (the build's 15 browser rows skip without `EXPLORE_BROWSER_URL`; the other 179 are in files this build does not touch) |
| `npm run lint:gate` | same tree | **exit 0** |
| `npm run test:rules` | JDK 21, the Firestore emulator | **exit 0.** 47 files, 871 rows, all passed; `exploreBookmarks.rules.mjs` 30 rows |
| Minified build | `vite build` | **exit 0**; the bundle diff in §7 |
| Browser rows | `explore.browser.test.js`, headless Edge, against the final smoke head (`?exploreFixture=`) | **15 of 15** (5 rows × 1280×900, 393×852, 320×700) |
| Mutations | the battery, §11 | **20 of 20 killed**; control run 216 of 216 green |

**Baselines (preamble 3), on the final tree — unchanged:**

| File | Base (`48519abf`, Windows) | Final (`fad5c009`, Linux) |
|---|---|---|
| `SharedResearch/sharedResearch.boundary.test.js` | 59 | **59**, all passing (file unedited) |
| `SharedResearch/SharedResearchSheetBody.b6a.jsdom.test.jsx` | 27 | **27** |
| `SharedResearch/SharedResearchSheetBody.builder.jsdom.test.jsx` | 156 | **156** |
| `SharedResearch/SharedResearchSheetBody.flows.jsdom.test.jsx` | 37 | **37** |
| `SharedResearch/SharedResearchSheetBody.review.jsdom.test.jsx` | 34 | **34** |
| `SharedResearch/SharedResearchSheetBody.states.jsdom.test.jsx` | 38 | **38** |
| `Search/screenerAdapter.test.js` | 37 | **37** |
| `Search/ScreenerView.saveLink.jsdom.test.jsx` | 3 | **3** |
| `Research/CorrelationLab.smoke.test.jsx` | 84 | **84** |
| `config/flagPinGuard.test.js` | 10 | **10** (a comment-only edit, K-2; §5) |
| **Total** | **485** | **485, all passing** |

**The build's own rows:** `explore.guard` 49 · `exploreView` 59 · `explore.screens` 45 · `explore.review` 26 · `explore.sheet` 19 · `explore.page` 14 · `explore.requests` 1 · `__fixtures__/exploreReads` 2 · `config/exploreFlags` 7 — **222 rows, all passing** — plus 15 browser rows (run against the smoke page) and 30 rules rows. The existing `Navigation/leagueHide.nav.jsdom.test.jsx` (9) passes unedited.

## 9. The spec's acceptance checks (§9), with proofs

"browser" = `src/components/Explore/explore.browser.test.js` in headless Edge against the smoke page (`?exploreFixture=`), at **1280×900, 393×852 and 320×700**: **15 of 15** on the final smoke head. "screens", "page", "sheet", "review", "requests", "guard" = the jsdom and node files in `src/components/Explore/`. "M*n*" = the mutant that the rows kill (§11).

| # | Check | Result | Proof |
|---|---|---|---|
| 1 | No element on an Explore screen has its own vertical scroll; nothing scrolls sideways | **PASS** | browser "home, story, in progress, finished, no access, the limit — no inner scroll, nothing sideways, 44 px targets" (8 scenes × top, middle and end, at each size); guard "no box of the page scrolls on its own" (no overflow scroll, no height cap, no sticky in Explore's CSS); M19 |
| 2 | On the reader the primary action is on screen at every scroll position | **PASS** | browser "on the reader the primary action is on screen at the top, the middle and the bottom — once" (5 positions × story, in progress, finished: exactly one of the panel's button or the bar's, hit-tested); sheet K-14 (5 rows); M18 |
| 3 | At 1280×900 the right-hand column never hides its button behind a scroll | **PASS** | the same two browser rows at 1280×900 (the side column scrolls with the page; nothing in it has its own scroll); review R-1 (a tall panel never widens the story's gaps) |
| 4 | Read, choose, edit, Work this idea: one investigation with the edited question; no second preview | **PASS** | screens "Work this idea: mode item, startNow, the spec's item with the question as edited"; sheet "startNow only on Work this idea"; browser "the walk" (the sheet opens on the fixture route straight into the investigation); B6a's own rows hold that `startNow` skips the preview (`SharedResearchSheetBody.b6a.jsdom.test.jsx`, "X-5 startNow: the open goes at once, and the preview is not drawn first") |
| 5 | Close: the same scroll position, focus on the button that opened it, card and panel show In progress and Continue research | **PASS** | browser "the walk": at the close `scrollY` is unchanged, focus is on the opener, then form B lands above the **same** button (±1 px on screen), now "Continue research", and the home card reads "In progress"; screens "closing it: the read once more … focus back on the SAME button"; review B-1, B-2 |
| 6 | Continue research reopens the same `sessionId`, unchanged | **PASS** (the host's part) | screens "Continue research: mode session with the read's open.sessionId — never a new open (K-9)", "Continue from the card and from the in-progress row: the same session"; M3, M14. What the sheet shows for a session is the sheet's own (B6a), unchanged |
| 7 | A different question on that story: form B, no start button, no investigation created | **PASS** | screens "form B: … another question changes nothing but the line (K-10)"; requests (no open request ever); M4 |
| 8 | Saved or concluded: Thesis saved / Concluded, and View it opens it read-only | **PASS** | screens "saved / concluded: the card says so", "form C (saved / concluded)", "View it: mode session with the read's last.sessionId"; B6a's rows: a closed builder session opened by `mode: 'session'` is read-only (preamble 2) |
| 9 | Browsing, searching, bookmarking, choosing, editing call only the read | **PASS** | requests "a scripted run of the whole page: one read (at mount), nothing else of the service, no fetch, no sheet"; guard "the boundary (K-3) holds on the real files" and its planted rows; M10, M11, M17 |
| 10 | A bookmark never under Research in progress unless it also has an open investigation | **PASS** | screens "a bookmark alone", "saved and in progress"; review A-1 |
| 11 | No access: stories, questions, bookmarks, the gated line, no start button anywhere | **PASS** | screens "form D (no access) … no start control anywhere", search "no match, gated: … no own-words row"; page "a gated player and a failed read still get the Explore tab"; browser scene `gated`; M7, M9 |
| 12 | The cost line's numbers are the server's `quota`; at the limit the start button is gone, Save for later offered | **PASS** | screens K-7 (planted 2 of 5, then 5 of 5 — numbers no rule would compute), "at the daily limit: the limit line and Save for later in place of the button; no start control anywhere"; browser scene `limit`; M5, M6 |
| 12b | A failed read: no start button anywhere; Try again makes exactly one read | **PASS** | screens "form E (the read failed): the line, Try again — exactly one read — and no start control", search "no match, failed"; review A-9; M8 |
| 13 | Search: a story match opens it with the question chosen; a ticker opens AssetResearch; no match offers own words | **PASS** | screens "a story match opens the story with the matched question selected", "a company opens AssetResearch, by the Search page's own matcher", "no match, with access", "fewer than three characters"; M9 |
| 14 | No "Supported" or "Source-backed"; every connection carries one of the three labels | **PASS** | guard "the words" (AST walk of every Explore file; planted rows); review A-8 (every screen in every state, visible text and labels); screens "the connections carry one of the three labels each"; M13 |
| 15 | Each source row shows its own date, apart from the publication date | **PASS** | screens "… the sources each carry their own date" ("Evidence dated …") |
| 16 | Every sample story and company in the preview is labelled a sample | **PASS** | screens "the cards: … origin and sample tags"; review A-6 (search rows, saved rows, in-progress rows), A-7 ("KSTL (sample company)"); renders |
| 17 | At `'off'`: the Search page, tabs, nav label and the entry's behaviour as on `main` | **PASS** | page K-2 (3 rows: today's heading, tabs, labels, search bar, movers tab; no read; no Explore module loaded; nav "Search"); the off-identity probe: `main`'s `SearchDiscover` + `SearchOverlay` beside the head's at `'off'`, every tab and the overlay, **identical HTML**, no read, no Explore module (run by the builder and again by the refuter); the bundle diff (§7): the entry's changes at `'off'` are a constant-folded `exploreMode()`, two nav label reads that fold to today's labels, one export and the preload table; M1, M2 |
| 18 | With it on, the five old tabs work as before; the SignalDrop entry and theme cards where they were | **PASS** | page "Markets is today's movers tab, with today's search bar; tab switches never read again"; the Search baselines unchanged and passing (§8: `screenerAdapter`, `ScreenerView.saveLink`, `CorrelationLab.smoke`); the tab bodies' files are untouched. The SignalDrop entry and theme cards live in the Forge (N-7), which this build does not touch (§6) |
| 19 | No file under `SharedResearch/`, the route, `api/_utils/sharedResearch/` or the service changed; the boundary test passes unedited | **PASS** | §6 (`git diff --stat` against the base: empty for each); `sharedResearch.boundary.test.js` 59 of 59 on the final tree, unedited (§8) |
| — | Smoke preview with `?exploreFixture=` | **PASS** | §1's URL; scenes: home, home-progress, home-finished, home-concluded, story, story-progress, story-finished, gated, limit, read-failed, empty, stories-failed, bookmark-gone, progress-gone, walk (the walk goes into the real sheet over its existing fixture route; nothing reaches the research server) |

## 10. The review (BUILD_RULES §2, K-17)

**How it ran.** The diff passes the threshold (≥ 10 files). Four lenses, each a separate agent on its own LF `git archive` tree of `1271dba6` (the frozen, merged head), read-only on git, each told the rulings and the spec but not the builder's conclusions: (a) honesty, (b) separation and wiring, (c) accessibility and phone (measured in headless Edge on the local smoke page at 320, 393 and 1280), (d) dark and compatibility. Each proved its findings with rows that pass while the defect is present. The builder fixed every in-scope finding in one round (`32544763`, `dbe78859`), with a row per finding (`explore.review.jsdom.test.jsx`, 26 rows; three browser rows). One refuter, on two fresh trees (the reviewed `1271dba6` and the fixed `dbe78859`), then tried to refute each finding on the old code and checked each fix on the new (§10.1). Its notes were fixed in two more commits — `6b861185` (C-2: the reserve measured from the bar's laid-out top) and `1c1f1226` (R-1, and its notes on B-6 and D-5) — and the five mutants on the files they touched were run again on the final tree (§11).

### 10.1 Findings and what was done

Every in-scope finding was **CONFIRMED** by the refuter on the reviewed code; none was refuted. Each is **FIXED** on the head, with its row.

| Id | Lens finding (on `1271dba6`) | Refuter, old | Fix (commit) | Refuter, new · the row |
|---|---|---|---|---|
| A-1 | "Saved · not researched" while the read is loading, failed or gated | CONFIRMED | the bookmark line only once the read answered (`32544763`) | FIXED · review A-1 (3 rows) |
| A-2 | "No longer available" for a published story outside the 12 newest | CONFIRMED (reachable past 12 stories) | the stories source says whether its read was complete; only then "gone" | FIXED · review A-2 |
| A-3 | "No story on this yet." while the stories are loading/failed | CONFIRMED | the line waits for the stories | FIXED · review A-3 |
| A-4 | A failed save in the reader says nothing | CONFIRMED | the line by the byline and by the panel's Save | FIXED · review A-4 (2 rows) |
| A-5 / B-4 | A save during the first bookmarks read is undone on screen | CONFIRMED | Save waits (aria-disabled) until the bookmarks are known | FIXED · review A-5 |
| A-6 | Samples unlabelled in search and Saved | CONFIRMED (fixture only) | "Sample story" in search rows, saved rows, in-progress rows | FIXED · review A-6 |
| A-7 | "KSTL · sample company" reads as a separate lead | CONFIRMED (fixture only) | "KSTL (sample company)" | FIXED · rendered |
| A-10 | Real tickers under "Source cited" on sample-only evidence; a few flat sentences | CONFIRMED (fixture only) | real tickers under "Reporter's reading"; samples under "Source cited"; hedges | FIXED · rendered |
| B-1 | After a close, focus falls to `<body>` when the read removes the opener | CONFIRMED | the focus keeper waits for the read's answer | FIXED · review B-1 (2 rows) |
| B-2 | Keep-on-screen undoes the player's own scroll during the read | CONFIRMED | the baseline follows scroll events | FIXED · review B-2 |
| B-3 | The cap misses saves in flight (51 written) | CONFIRMED | in-flight saves count; Save waits for the read | FIXED · review B-3 |
| B-5 | Two failed saves on two stories: only the last line | CONFIRMED | a line per story | FIXED · review B-5 |
| B-6 | At `'allowlist'`, a tap on a Markets card is not "touched" | CONFIRMED | any click (or Enter / Space) on the page counts (`1c1f1226`: a scroll gesture is not a tap) | FIXED · review B-6 |
| B-7 | A player change at `'allowlist'` leaves a blank tab | CONFIRMED | the Explore tab falls back to Markets without Explore | FIXED · review B-7 |
| B-8 | A bar that appears while the sheet is open is not inert | CONFIRMED | the bar is inert by its own prop while the sheet is open; the backdrop never scrolls the page | FIXED · review B-8 |
| B-9 | A story on two cards: the failed save said twice | CONFIRMED | the line shows only by the control tapped | FIXED · review B-9 |
| C-1 | Phone Tab/reading order ≠ visual order (CSS `order`) | CONFIRMED (Edge) | the DOM is the reading order; the reader's side block placed by grid; home's in-progress list drawn per width | FIXED (Edge) · review C-1 (2 rows) · browser "Tab follows…" |
| C-2 | The pinned bar hides the focused control | CONFIRMED | `scroll-padding-bottom` reserves the bar's band while shown; measured from its laid-out top (`6b861185`) | PARTLY at `dbe78859` (measured mid-slide) → FIXED at `6b861185`: browser "no focused control under the bar" passes at 320, 393, 1280 |
| C-3 | A sheet opened from the bar: focus to `<body>` when the bar leaves | CONFIRMED (Edge) | focus goes to the panel's button as the bar leaves | FIXED (Edge) · review C-3 · browser row |
| C-4 | "Product" tag 3.8–4.2:1 | CONFIRMED | its words in ink (14.9:1) | FIXED · review C-4 |
| D-2 | A flip needs two pin rows | CONFIRMED (dry run) | the module-scope row is value-neutral | FIXED (dry run 17/17) |
| D-3 | `'on'` reds three nav label rows; the runway is silent | CONFIRMED | the runway (flag docstring, the guard's note) names them | FIXED (disclosure) |
| D-5 | No guard on a string naming the service | CONFIRMED | Explore's guard, then the build's other files too (`1c1f1226`) | FIXED · guard rows |

**Regressions the refuter looked for** (wiring, `'off'` identity, the boundary): none, but one cosmetic one, R-1: a side block taller than the story widened the story's gaps (30 px for 22 at 1280 on one story). Fixed in `1c1f1226` (a trailing flexible row takes the height). The refuter re-ran `main`'s `SearchDiscover` beside the fixed one at `'off'` (every tab, the overlay): identical HTML, no read, no Explore module loaded.

### 10.2 Not fixed here, and why

| Id | What | Disposition |
|---|---|---|
| D-1 | At `'off'` the hub chunk requests two new shared chunks (`constants/sharedResearch.js`, `loadoutService`), the sheet body's chunk imports the service from a new chunk, and the entry's preload table holds the new names | **Inherent to K-3 / B6a X-6** — the body now has two importers (the hub's door, Explore's), and the service two (the sheet's hook, Explore's reader), so Rollup must give their shared modules chunks of their own. No behaviour changes; one more small request when the hub or the sheet loads. **Founder ruling asked: SQ-6.** |
| A-13 | "Your agent's first step checks the story against its sources." — `open` does not read the story's `sources[]`; the builder's first goal is "Check the story against its source" (the story itself) | Spec §4's approved wording; **question SQ-7** (suggest "against its source", singular, as the sheet says) |
| A-14 | "Thesis saved" also labels a saved ledger idea (`ended: 'saved'`) | Spec §3.7's wording; noted under Watch |
| A-15 | The Companies row shows when the story has any ticker, even one outside the game's list | Content contract (§5.1: tickers must be in the game's list); Watch |
| A-16 | The own-words row is offered at the daily limit | It starts nothing on tap; the sheet tells the limit; question SQ-8 |
| B-11 | An open sheet stays open across a player change | Out of scope (sign-out leaves the page); Watch |
| C-5 | The Search page's own tab strip scrolls sideways at 320 and 393 (`overflowX: auto`, 586 px of tabs on `main` already) | `main`'s; reported for separate tasking |
| C-9 | `.ftx-btn` hover filter uses a raw `.15s` CSS transition | Nit (the motion guard reads JSX `transition={{`; reduced motion turns it off) |
| C-11 | The sheet body scrolls 16 px inside the 720 dialog at 1280 | The sheet's own content |
| D-6 | `hasAll` in the bookmarks rule is redundant with the field checks | Kept (belt and braces) |

## 11. The mutation table

Each mutant is one edit to the source, run against Explore's rows (and the sheet's and Search's), judged by the exit code and the failed rows; each file restored and checked by SHA-256. A control run first: 216 of 216 rows green. M1–M19 ran on `6b861185`; the five whose files the refuter round touched (M1, M2 in `SearchDiscover.jsx`; M10, M11 in `ExploreStory.jsx`; M19 in `exploreStyle.js`) ran again on `1c1f1226`, killed by the same rows (the merge of `main` changed none of these files). M20 ran in the rules suite.

| Id | Mutant | File | Verdict | Rows failed | First row that fails |
|---|---|---|---|---|---|
| M1 | with 'off', the Explore tab renders | `Search/SearchDiscover.jsx` | **KILLED · again KILLED** | 7 | K-2: at 'off' the Search page is today's the heading, the tabs and their labels, the search bar and the movers tab — and the read is never made |
| M2 | with 'off', the read is called | `Search/SearchDiscover.jsx` | **KILLED · again KILLED** | 1 | K-2: at 'off' the Search page is today's no Explore module is loaded at all (neither the runtime nor the tab) |
| M3 | Continue sends a new open instead of mode 'session' | `Explore/ExploreSheetHost.jsx` | **KILLED** | 6 | home (spec §3.2) an open investigation whose story is gone: still under Research in progress, with its question and Continue |
| M4 | a second question on a story with an open investigation shows a start button | `Explore/ExplorePanel.jsx` | **KILLED** | 1 | the reader and the panel (spec §3.4, §3.5) form B: the investigation's original question and the read's numbers, Continue research; another question c… |
| M5 | the cost line reads a constant instead of quota | `Explore/ExplorePanel.jsx` | **KILLED** | 1 | K-7: every number on the page is the read's own (planted numbers no rule would compute) the cost line and the limit come from the quota: 2 of 5 used, … |
| M6 | the state line reads a constant for the parts total | `Explore/ExplorePanel.jsx` | **KILLED** | 1 | K-7: every number on the page is the read's own (planted numbers no rule would compute) the state line carries filled, parts and steps left as read: 4… |
| M7 | a gated player sees Work this idea | `Explore/exploreView.js` | **KILLED** | 3 | lens A — honesty A-8: no screen in any state shows a banned word, in its text or its labels |
| M8 | a failed read shows Work this idea | `Explore/exploreView.js` | **KILLED** | 5 | lens A — honesty A-9: a failed read heads the panel "Investigation", never "Proposed investigation" |
| M9 | the own-words row shows without access | `Explore/ExploreSearch.jsx` | **KILLED** | 2 | search (spec §3.3, K-12) no match, gated: the line that points at companies, and no own-words row |
| M10 | editing the question calls the service | `Explore/ExploreStory.jsx` | **KILLED · again KILLED** | 2 | N-4: browsing, searching, bookmarking, choosing and editing call only the read a scripted run of the whole page: one read (at mount), nothing else of … |
| M11 | bookmarking calls the service | `Explore/ExploreStory.jsx` | **KILLED · again KILLED** | 1 | N-4: browsing, searching, bookmarking, choosing and editing call only the read a scripted run of the whole page: one read (at mount), nothing else of … |
| M12 | a sample: true record from the collection is drawn | `Explore/exploreView.js` | **KILLED** | 2 | K-6: one stories document → the reader's view, or null dropped: sample: true |
| M13 | a connection is labelled "Supported" | `Explore/exploreCopy.js` | **KILLED** | 3 | the words (K-13, E-1) exploreCopy.js never says /supported/i |
| M14 | startNow is passed on Continue | `Explore/ExploreSheetHost.jsx` | **KILLED** | 5 | home (spec §3.2) an open investigation whose story is gone: still under Research in progress, with its question and Continue |
| M15 | the body is not remounted between two openings | `Explore/ExploreSheetHost.jsx` | **KILLED** | 1 | K-8: the host a fresh body for each opening: a new entry remounts it, even where the host itself stays mounted |
| M16 | the read is not repeated after the sheet closes | `Explore/ExploreTab.jsx` | **KILLED** | 6 | lens B — separation and wiring B-1: Continue from the in-progress row; the read then answers it concluded — focus goes to the screen's anchor, not <bo… |
| M17 | a second Explore file imports the service | `Explore/ExploreSearch.jsx` | **KILLED** | 4 | the boundary (K-3) holds on the real files |
| M18 | the pinned bar shows while the panel's button is on screen | `Explore/ExplorePinnedBar.jsx` | **KILLED** | 3 | lens B and C — the pinned bar C-3: the bar leaves while its button holds focus — focus goes to the panel's button, not <body> |
| M19 | the side column gets its own scroll | `Explore/exploreStyle.js` | **KILLED · again KILLED** | 1 | the look (BUILD_RULES §10, §11; K-15) no box of the page scrolls on its own (E-4, N-6): the page's rules set no overflow scroll, no height cap, no sti… |
| M20 | the rules allow a fifth key on a bookmark (the keys().hasOnly line dropped) | `firestore.rules` | **KILLED** | 5 | exploreBookmarks.rules.mjs "refused: a fifth key" (also: a question, an owner field, a fifth key added by update, the one-block row) (rules restored: SHA-256 37c59b26fefa2d16… before and after) |

## 12. Watch on the allowlist

Not defects: things to look at while the founder and FT_QA use Explore at `'allowlist'`.

1. **The 12-story window.** The stories read takes the 12 newest. Search and home see only those; a bookmark of an older story shows its title and Remove, without "No longer available" (the read is partial, so it does not claim that). If the collection grows past 12, decide whether to read bookmarked stories by id.
2. **The first open of the hub after the merge** preloads three small shared chunks (D-1): 4,648 B in all, in place of three it listed before; the hub's own chunk is 2,629 B smaller.
3. **"Thesis saved"** also shows for a saved ledger idea (A-14). Ledger sessions are rare now that the builder mode is on.
4. **Tickers outside the game's list** still draw the Companies row (A-15). The content contract (§11) asks for in-list tickers.
5. **The panel's button rests (aria-disabled) while the read after a close runs**: well under a second normally, up to the service's 35 s timeout on a dead connection.
6. **A sheet open across a player change** stays open (B-11): only reachable when another tab signs a different player in.
7. **Wheel and drag over the sheet's backdrop are stopped**, so the page behind never moves. The dialog's own content still scrolls.

## 13. The steps before the switch moves

Nothing below is done by this PR. Each is its own step, in this order:

1. **Deploy the two rules blocks** (`firestore.rules`: `users/{uid}/exploreBookmarks/{storyId}` and `exploreStories/{storyId}`) to production, and **the one composite index** (`firestore.indexes.json`: `exploreStories` `status ASC, publishedAt DESC`). Without the index the stories read fails ("Couldn't load stories"); without the rules both reads are denied. Since the founder's round (SQ-9, §16) the stories block lets a signed-in player read only documents whose stored `status` is `'published'`: **drafts are not readable** by any client, and a list must filter on `status == 'published'` (the page's own query does).
2. **Publish the AI-buildout collection** with real companies and real sources, in spec §5.1's shape, every `id` matching `^[A-Za-z0-9_-]{1,200}$`, every story with a whole-number `version`, `publishedAt` stored as one type across the collection (a Firestore timestamp is best: mixed types sort by type), no `sample` field, and the §11 content rules (one basis per connection; the reporter's reading qualified in the text).
3. **A one-line founder PR** setting `EXPLORE_MODE = 'allowlist'` in `src/config/exploreFlags.js`, moving the first row of `src/config/exploreFlags.test.js` in the same commit. Rollback: one step back with its pin row.
4. Later, `'on'`: the same one-line PR, which also reconciles the three nav label rows of `src/components/Navigation/leagueHide.nav.jsdom.test.jsx` that list the entry as "Search" (pin the switch in that suite's mocks, or move the label).

## 14. The PR description

The draft PR's body, as opened:

#### Explore Build 1: the front page of Search, and its door into Work an idea (dark)

**Ships dark.** `EXPLORE_MODE` is `'off'` (`src/config/exploreFlags.js`): the Search page, its tabs, its heading and the nav are exactly today's, the research read is never made and no Explore chunk is requested. Spec: `docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md`. Report: `docs/audits/20261121_BUILD_EXPLORE_1.md`. Smoke preview (never merged): https://trade-seven-lely9wo60-fais-projects-bc179554.vercel.app/?exploreFixture=walk

**What it adds (behind the switch):** Explore in front of Search — a home of questions attached to short stories, a story reader with a question chooser and a panel that says what an investigation would start with and what it costs, bookmarks, search, and a host for the existing Work an idea sheet. One research read (`GET ?list=explore`) per page, once more after each close of the sheet. No change to Work an idea's server or sheet.

**Changes by file**
- `src/config/exploreFlags.js:48` (new): `EXPLORE_MODE = 'off'`; `exploreFlags.js:51` the call-time reader `exploreMode()`; pinned by `exploreFlags.test.js`; noted in `flagPinGuard.test.js:376` (`DARK_BY_DESIGN`, comment only).
- `src/components/Search/SearchDiscover.jsx:20-23, 39-57, 78, 198, 271`: at `'off'` everything folds to today's; at `'allowlist'`/`'on'` the Explore tab in front, "Markets" for today's first tab, heading "Explore", and the lazy `ExploreRuntime` (the page's reads) and `ExploreTab`.
- `src/components/Search/SearchOverlay.jsx:5, 26, 36` + `companyMatch.js` (new): the company matcher and the asset object moved unchanged, imported by both the overlay and Explore's search.
- `src/components/Navigation/BottomNav.jsx:130`, `DesktopSidebar.jsx:251`: the Search entry's label reads "Explore" at `'on'` only, at render (`NAV_ITEMS` untouched).
- `src/components/Explore/` (new): the runtime, the tab, home, the reader, the questions, the panel, search, the pinned bar, the sheet host, the sheet's second door (`loadSharedResearch.js`), the service's one outside reader (`useExploreResearch.js`), the sources, the pure view, the copy, the style, fixtures and rows.
- `firestore.rules:151-182`: two blocks — `users/{uid}/exploreBookmarks/{storyId}` (owner only, exactly four keys) and `exploreStories` (signed-in read, no client write). `test/rules/exploreBookmarks.rules.mjs` (new).
- `firestore.indexes.json:32`: one composite index, `exploreStories` (`status ASC, publishedAt DESC`).

**Fenced functions called:** none. **Fenced files edited:** none. No file under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `api/` or `src/services/sharedResearchService.js` changed; the sheet's boundary test passes unedited.

**Bundle diff (minified, `main` 4037df59 vs the head):** CSS identical; 3 Explore chunks + 3 shared chunks added; `SearchDiscover` +872 B, the hub −2,629 B, the sheet −1,543 B (moved to the shared chunks); entry +209 B (the folded switch, two nav reads, the preload table); 48 more differ in names only (report §7).

**Checks:** on the merged tree `fad5c009` (`main` `4037df59` in): the Linux suite exit 0 — 1,634 files, 37,396 passed, 0 failed, 194 skipped; `lint:gate` exit 0; `test:rules` exit 0 (47 files, 871 rows); the minified build exit 0; baselines 485 of 485 unchanged; browser rows 15 of 15 (headless Edge, 1280 / 393 / 320); 20 of 20 mutants killed; the four-lens review and one refuter: 23 findings confirmed, all fixed with rows.

**Before the switch moves:** deploy the two rules blocks and the index; publish the AI-buildout collection; then a one-line founder PR to `'allowlist'` with its pin row (report §13).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## 15. The founder's phone checklist

On the smoke preview, on an iPhone, `?exploreFixture=walk` unless another scene is named. Every story and company here is a sample; nothing reaches the research server.

1. **Home:** the heading says Explore. The cards lead with a question, not a headline. One card is a product ("Who earns when you tap to pay?", tagged Product). Every story is tagged "Sample story"; every sample company says "(sample company)".
2. **Search:** type "power": a story comes up. Type "NVDA": a company comes up. Type nonsense: it offers to work it from your own words, and never says "not available".
3. **The story:** open the AI-buildout story. Sentences that are the reporter's reading say so ("Kim's reading is that…"). Nothing on the page says "Supported"; the connections say "Source cited", "Reporter's reading" or "No source yet".
4. **The question:** "What the story leaves open" is followed directly by the questions. Pick one and change its wording. Nothing loads, nothing starts.
5. **The button follows you:** scroll up and down. *Work this idea* is always on screen, once (in the panel, or in the bar above the nav).
6. **The cost:** the panel says how many of today's investigations this uses, before you tap ("Uses 1 of your 3 investigations today · 0 used").
7. **Start:** tap *Work this idea*. The sheet opens straight into the investigation (the thesis card and "Check the story against its source"), with no second preview.
8. **Close:** close the sheet. You are where you were on the page. The panel now says *Your investigation*, your wording, and *Continue research*.
9. **Continue:** tap it. It is the same investigation, with the same progress.
10. **A second question:** pick the story's other question. It still offers only *Continue research*, with "One investigation per story…".
11. **Save for later:** save a different story. It appears under Saved for later, not under Research in progress.
12. **The other states** (from `?exploreFixture=index`): `story-finished` (Thesis saved, *View it*); `gated` (no access: the gated line, no start button); `limit` (the day's limit: no start button, Save for later instead); `read-failed` ("Couldn't check your research", Try again); `bookmark-gone`; `progress-gone`; `stories-failed`; `empty`.
13. **The old tabs:** Markets, Rankings, Institutional, Screen and Correlations are all there and work as before. (On the smoke page they read the preview's own market data; anything that needs you signed in may show its own sign-in or failed state there.)
14. **Live app:** nothing has changed anywhere: the Search page says Discover, its first tab is Explore (the movers), and the nav says Search.

## 16. The founder's round (Nov 22)

**Smoke preview (founder's phone; never merged):** **https://trade-seven-mb5e06gut-fais-projects-bc179554.vercel.app/?exploreFixture=walk** — branch `claude/explore-build-1-smoke` at `3c8c6ce9`: the round's final code `58932a30` plus the same two smoke-only commits as before (cherry-picked unchanged) and one more, the `search-limit` scene. The docs commit after `58932a30` changes no client file. `?exploreFixture=index` lists every scene; `?exploreFixture=search-limit` is new. The checklist's items 1–4 (§16.10) were checked on this deployed preview by script at 393×852 (touch): 5 of 5 checks pass.

The founder walked the first smoke preview, approved the desktop story page as built, ruled on SQ-6 to SQ-10, and asked for one layout change (F-1). The rulings are in the spec as **Amendment A (Nov 22, 2026)**, word for word. This round makes the four changes they call for and nothing else. The larger redesign of the front page and the phone story page is its own design round and build.

### 16.1 Verdict

| Item | Result |
|---|---|
| Ships dark | **Yes.** `EXPLORE_MODE` is still `'off'`; no flag file changed in this round. At `'off'` the Search page renders what `main` renders: the reviewer's and the refuter's own probes rendered `main`'s `SearchDiscover` beside the head's on every tab and with the overlay open, at mobile and desktop width, and found identical HTML, no read and no Explore module loaded |
| The four changes | **Built:** SQ-7 (the line), SQ-8 (search at the limit), SQ-9 (published stories only), F-1 (no tab row in a story). SQ-6 and SQ-10: no change, as ruled |
| Full Linux suite on the final tree | **exit 0.** 1,636 files; 37,692 rows: **37,495 passed, 0 failed**, 197 skipped (the 18 browser rows, which skip without a page, plus 179 in files this build does not touch) |
| `npm run lint:gate` | **exit 0** |
| `npm run test:rules` | **exit 0**: 47 files, **876 rows** (`exploreBookmarks.rules.mjs`: 35, was 30) |
| Minified build | **exit 0** |
| Baselines | **Unchanged:** 10 files, 485 rows, all passing |
| Protected paths | `SharedResearch/`, `CommandCenter/`, `api/`, the service: `git diff --stat origin/main` **empty**. `firestore.indexes.json` and `src/config/` not touched by this round |
| Bundle diff (this round) | 2 files change content: the Explore tab's chunk (+417 B) and the Search chunk (+21 B); the CSS identical; 55 more differ in hashed names only |
| Mutations | **17 of 17 killed** (16 in the jsdom rows, 1 in the rules); control run 231 of 231 green |
| Browser rows (headless Edge, the deployed smoke preview) | **18 of 18** at 1280×900, 393×852, 320×700 (the 15 existing + the new F-1 row at each size) |
| Review (BUILD_RULES §2) | One reviewer, one refuter, each on its own `git archive` tree: **no code defect**. Three test gaps (V-1, G1, E1), each closed with a row and a mutant that the row kills |

**Ready for the founder's merge · dark.**

### 16.2 Base and the merge of `main`

`git fetch origin` first. The PR head was `4ab15855`, as the prompt said; PR #1106 open and a draft. `origin/main` was `b258266f` (#1104, #1105: the Practice Field founder door and its flag flip). Merged in alone at **`7868dc77`** (no conflict; `main`'s 14 files share none with this build). `7868dc77` is the bundle diff's base: `4ab15855` on the merged `main`. The round's commits on top: `dd6cdb92` (the four changes and their rows), `ea89e451` (review V-1), `d53cd6df` (the F-1 browser row), `58932a30` (the refuter's two rows; the browser row measures as Safari), then this docs commit. The branch `claude/explore-build-1` is checked out in another worktree (`explore-build-1-164eab`, clean, at `4ab15855`); that worktree was not touched: the round was built in this session's worktree and pushed as `HEAD:claude/explore-build-1`, a fast-forward from `4ab15855`.

### 16.3 The changes

| # | Ruling | Where | What | Rows |
|---|---|---|---|---|
| 1 | SQ-7 | `src/components/Explore/exploreCopy.js:117` | "Your agent's first step checks the story against its source." | `explore.guard.test.js:181` "the founder's lines of Nov 22, word for word" (new); `explore.screens.jsdom.test.jsx:206` reads the line from the copy, unedited |
| 2 | SQ-8 | `ExploreSearch.jsx:41` `atLimit = access && atLimitOf(research.quota)` — `atLimitOf` from `exploreView.js:117`, the panel's own test (`ExplorePanel.jsx:134`), never a second rule; `ExploreSearch.jsx:93-96`: at the limit the own-words row is not drawn and one `role="status"` line takes its place; `exploreCopy.js:77` the line, `{perDay}` from `research.quota.perDay` | Read `ready`, three or more characters, at the limit: no own-words row, the line last. "No story on this yet." still above it when nothing matched; company results unchanged. Below the limit, gated, failed: unchanged | `explore.founder.jsdom.test.jsx:100-145` (6 rows): a planted 7 of 7 (a number no rule would compute) with no match and with a company match; 8 of 7 and fewer than three characters; 6 of 7 (the own-words row, no line); gated and failed (no row, no line) |
| 3 | SQ-9 | `firestore.rules:182-185` (the `exploreStories` block and its comment only) | `allow read: if request.auth != null && resource.data.status == 'published';` — no client write, as before. The page's query already filters on `status == 'published'` (`exploreSources.js`), unchanged | `test/rules/exploreBookmarks.rules.mjs:146-168` (5 new rows): a published story by id, and a list filtered to published, allowed; a draft by id denied (three signed-in players); a document with no status denied; an unfiltered list, the page's order without the filter, and a list filtered to `draft` denied; signed out denied by id and by the page's query. Every client write still denied (the existing rows) |
| 4 | F-1 | `ExploreTab.jsx:62-64` (`storyShown`: the view is a story **and** the stories are loaded **and** the story is among them; one layout effect reports it; one reports `false` on unmount), `:133`, `:138` (open and ← Explore report in the same handler as the view change); `SearchDiscover.jsx:62-63` (one boolean; `hideTabRow = withExplore && activeTab === EXPLORE_HOME && inStory`), `:159-160` (the row not drawn), `:213` (`onInStory={setInStory}`, the one callback prop) | Inside a story the tab row is not drawn; the heading stays; "← Explore" and a story that disappears bring it back. Never hidden on another tab, on Explore's home, or at `'off'`. No context, no global, no stored value. The pinned bar, the sheet host and close-and-return are untouched | `explore.founder.jsdom.test.jsx:150-334` (11 rows), `explore.browser.test.js:179` (×3 sizes) — §16.4 |

**Why the handlers report, and not only an effect.** The row is ~60 px above the content. If the page heard about the view change one commit late, "← Explore" would restore the scroll while the row is still away and the row would then push the page down by its height; `.ftx-root` turns scroll anchoring off, and iPhone Safari has none, so nothing would correct it. Opening a story and "← Explore" therefore call `onInStory` in the same event handler as `setView`: React batches both into one commit, and the tab's scroll-and-focus effect runs with the row already gone or back. The layout effect covers what no handler sees (the story disappearing, the snapshot going away) before paint; the unmount report covers a dropped tab.

### 16.4 The F-1 rows

| Row | What it holds |
|---|---|
| founder `:150` (×2, `'on'` and `'allowlist'`) | Home shows the row; a story hides it, the heading "Explore" and "← Explore" stay, focus on the title; "← Explore" brings the row back, scroll restored to where the player left (640), focus on the opener |
| founder `:166` | Each `window.scrollTo` sees the row as its view has it: opening scrolls with the row already gone, "← Explore" with the row already back (the ordering above) |
| founder `:175` | A story opened from search hides it; a second story after "← Explore" again |
| founder `:188` | The row on every other tab, and on Explore's home after each |
| founder `:199` | The story disappearing (a player change at `'on'` whose stories no longer hold it): the row back while the stories load and once they are ready without it (review V-1) |
| founder `:219` | At `'allowlist'`, the Explore tab dropped with a story open: the row back **at once** (while the old tab is still leaving under the page's exit animation), on Markets; and on Explore's home when the new player is admitted |
| founder `:237` | The same drop, a tap on Rankings during the exit, then re-admitted: the row on Rankings (refuter G1) |
| founder `:254` | At `'off'`: the row on every tab, today's labels; the Explore tab never drawn; no read |
| founder `:281` | The tab's one callback: `true` on a story, `false` on "← Explore", exactly one `false` when the tab is taken away with a story open |
| founder `:302` | The story disappearing outside an event (its own task, as in a browser): no DOM state shows the gone line with the row still away (refuter E1) |
| browser `:179` (1280, 393, 320) | On the smoke page, with scroll anchoring off (as Safari): the row on home; a story at the top, focus on its title, no row, heading and "← Explore" there; back: the row back, the scroll the player left (304 / 630 / 1,011 px) and the opener where it was on screen (±1 px), focus on it. With "← Explore"'s handler report removed this row fails at all three sizes; with anchoring left on, Chromium hid the bug at 1280 and 393, so the row turns it off |

### 16.5 Edited rows, and why

Every existing row passes **unedited**, except:

| Row | Why |
|---|---|
| `test/rules/exploreBookmarks.rules.mjs:183` "ONE bookmarks block and ONE stories block, as built" | It pins the stories block's text line by line; its read line is now `allow read: if request.auth != null && resource.data.status == 'published';` (SQ-9). The bookmarks lines and the write line are unchanged |

Comments only (no row): the rules file's header, the stories block's comment in `firestore.rules`, and `explore.browser.test.js`'s header. No row quoted the old SQ-7 line (the screens row reads it from the copy), and no existing row asserted the tab row inside a story.

### 16.6 Tests and checks

Every check ran on the final code tree `58932a30` (`main` `b258266f` merged in), in a private WSL worktree of `~/pd-ci` (`~/pd-exb1f`; its own `npm ci`, the branch's lockfile `e457c10d0317` differs from `pd-ci`'s). Each result read from its exit code and its own report.

| Check | Result |
|---|---|
| Full Linux suite (`TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8 --reporter=json`) | **exit 0.** 1,636 files (1,634 + this round's founder file + `main`'s `scripts/practice-field-founder.test.js`); 37,692 rows: **37,495 passed, 0 failed, 197 skipped** |
| `npm run lint:gate` | **exit 0** |
| `npm run test:rules` (Windows, JDK 21, the emulator, an LF `git archive` of the head) | **exit 0.** 47 files, 876 rows; `exploreBookmarks.rules.mjs` 35 |
| Minified build | **exit 0**; the bundle diff §16.7 |
| Browser rows (headless Edge, the deployed smoke preview) | **18 of 18** (also 18 of 18 on the local smoke page) |
| Mutations | **17 of 17 killed**, §16.8 |
| The request guard | `explore.requests.jsdom.test.jsx`: a scripted run of the whole page still makes one read and nothing else (1 row, unedited, passing) |

**Baselines, on the final tree, unchanged:** `sharedResearch.boundary` 59 · `SharedResearchSheetBody.b6a` 27, `.builder` 156, `.flows` 37, `.review` 34, `.states` 38 · `screenerAdapter` 37 · `ScreenerView.saveLink` 3 · `CorrelationLab.smoke` 84 · `flagPinGuard` 10 — **485, all passing**.

**The build's own rows:** `explore.guard` 50 (+1) · `exploreView` 59 · `explore.screens` 45 · `explore.review` 26 · `explore.sheet` 19 · `explore.page` 14 · `explore.requests` 1 · `__fixtures__/exploreReads` 2 · `config/exploreFlags` 7 · **`explore.founder` 17 (new)** — **240 rows, all passing** — plus 18 browser rows and 35 rules rows. `Navigation/leagueHide.nav.jsdom.test.jsx` (9) passes unedited.

### 16.7 The bundle diff (this round only)

`vite build` in the WSL worktree, on `7868dc77` (`4ab15855` on the merged `main`) and on the head `58932a30`; every file compared by bytes, then with chunk hashes masked.

| Files | What | Why |
|---|---|---|
| `ExploreTab` | 47,791 → 48,208 (**+417 B**) | the search's limit line and its test; the story report (`storyShown`, two layout effects, two handler calls); the new copy line |
| `SearchDiscover` | 23,867 → 23,888 (**+21 B**) | the one boolean, the row's condition, the callback prop |
| CSS (`index-Bt3Ms9P_.css`) and 11 more | **identical** | — |
| 55 more, the entry `index-*.js` and `index.html` among them | **hashed names only** (same size, equal with hashes masked) | they name the two renamed chunks (the entry's preload table) |
| their source maps | follow their chunks | — |

**In one line:** the Explore tab's chunk +417 B and the Search chunk +21 B; CSS identical; 55 more differ in hashed names only. The minified head built from `58932a30` is byte-identical to the round's first build (`dd6cdb92`): the later commits are rows only.

### 16.8 The mutation table

Each mutant is one edit (or a named pair) to the source, run against the Explore rows (8 files), judged by the exit code **and** the JSON report (deleted first), each file restored from `git show 58932a30:<path>` and checked by SHA-256. Control first: 231 of 231 green. M24 ran in the rules suite (on its own LF snapshot; `firestore.rules` SHA-256 `aa71123ba7a9a337…` before and after).

| Id | Prompt # | Mutant | File | Verdict | Rows failed | A row that fails |
|---|---|---|---|---|---|---|
| M21 | 1 | the own-words row shows at the limit | `ExploreSearch.jsx` | **KILLED** | 2 | SQ-8 "no match: … the limit line in the own-words row's place" |
| M22 | 2 | the limit line reads a constant (`3`) instead of `quota.perDay` | `ExploreSearch.jsx` | **KILLED** | 3 | SQ-8 "no match …" (planted 7) |
| M23 | 3 | the limit line shows below the limit | `ExploreSearch.jsx` | **KILLED** | 2 | SQ-8 "below the limit (6 of 7) … no limit line" |
| M24 | 4 | the rule lets a signed-in player read a draft (`allow read: if request.auth != null;`) | `firestore.rules` | **KILLED** | 4 | "SQ-9: a draft read by id is denied" (also no status, unfiltered list, the posture row) |
| M25 | 5 | the tab row shows inside a story (the page never hears the tab) | `SearchDiscover.jsx` | **KILLED** | 6 | F-1 "at 'on': home shows the row; a story hides it …" |
| M26a | 6 | the row stays hidden after "← Explore" (the page keeps only a `true`) | `SearchDiscover.jsx` | **KILLED** | 6 | F-1 "at 'on': … '← Explore' brings it back" |
| M26b | 6 | "← Explore" does not report in its handler (the row returns one commit after the scroll) | `ExploreTab.jsx` | **KILLED** | 1 | F-1 "the scroll … on '← Explore' with the row already back"; also the browser F-1 row at all three sizes |
| M26c | 6 | opening does not report in its handler | `ExploreTab.jsx` | **KILLED** | 1 | the same scroll-order row |
| M27a | 7 | the page's gate dropped (`hideTabRow = inStory`) | `SearchDiscover.jsx` | **KILLED** | 2 | F-1 "the Explore tab dropped with a story open: the row is back at once" |
| M27b | 7 | the tab does not report `false` on unmount | `ExploreTab.jsx` | **KILLED** | 1 | the tab's report "… false when it unmounts with a story open" |
| M27c | 7 | both of M27a and M27b | both | **KILLED** | 3 | both rows |
| M28 | 8 | at `'off'` the row can be hidden (`mode === 'off' \|\| …`) | `SearchDiscover.jsx` | **KILLED** | 2 | F-1 "at 'off': the row on every tab"; page K-2 |
| M29 | — | SQ-7 reverted ("its sources") | `exploreCopy.js` | **KILLED** | 1 | guard "the founder's lines of Nov 22" |
| M30 | — | the limit by a second rule (`used > perDay`) | `ExploreSearch.jsx` | **KILLED** | 2 | SQ-8 "no match …" (7 of 7) |
| M31 | — | the story-exists term dropped (review V-1) | `ExploreTab.jsx` | **KILLED** | 2 | F-1 "the story disappearing brings the row back" |
| M32 | — | the open-tab term dropped (refuter G1) | `SearchDiscover.jsx` | **KILLED** | 1 | F-1 "a tap on Rankings while the dropped Explore tab is still leaving …" |
| M33 | — | the report effect after paint (`useEffect`, refuter E1) | `ExploreTab.jsx` | **KILLED** | 1 | the tab's report "the story disappearing outside an event …" |

**Said plainly about M28.** At `'off'` nothing can report a story: the callback is handed only to the Explore tab, which `'off'` never draws, and `withExplore` is `false`. A mutant that merely drops a term of the condition is therefore unreachable at `'off'` (it changes nothing there). The only way to hide the row at `'off'` is a condition that does not wait for the tab's report, so M28 writes one in (`mode === 'off' || …`), and two rows kill it. **Equivalent mutants** (no reachable state differs, each argued by the reviewer and checked by the refuter): dropping `withExplore` alone from the page's condition (`activeTab === EXPLORE_HOME` already implies it, `SearchDiscover.jsx:52`); dropping `access` from `atLimit` (`ownWords` already requires it); dropping the stories' `status === 'ready'` term (every other stories state has an empty list).

### 16.9 The review

The branch is past the BUILD_RULES §2 threshold, so this round was reviewed in proportion: **one reviewer and one refuter on the round's own diff** (`7868dc77..`), each on its own LF `git archive` trees (the head, the pre-round tree, `main`), read-only on git. Lenses in one pass: the `'off'` identity, the rule, the limit's source, focus and scroll with the tab row leaving and returning.

| Id | Who | Finding | Refuter | Done |
|---|---|---|---|---|
| V-1 | reviewer | The "story disappearing" row asserted while the new stories were still **loading**, so no row guarded the story-exists term (a mutant dropping it survived) | CONFIRMED; the fix kills both variants | **FIXED** (`ea89e451`): the row waits for the stories to be ready without the story; M31 |
| G1 | refuter | The reviewer called "drop the open-tab term" equivalent; it is not: during a dropped tab's 200 ms exit, a tap on Rankings and a re-admission reach a state where it hides the row on Rankings. The code is right; no row pinned it | — | **ROW ADDED** (`58932a30`); M32 |
| E1 | refuter | The reviewer called "report effect after paint" equivalent; it is not: a story that disappears outside an event commits one DOM state with the gone line and no row, which a browser can paint. The code (a layout effect) is right; no row pinned it | — | **ROW ADDED** (`58932a30`); M33 |

**Claimed sound and checked:** the `'off'` identity (two independent probes of `main`'s page beside the head's, every tab and the overlay, mobile and desktop: identical HTML, no read, no Explore module; each probe's control mutation showed it could see a change); the rule (the only client read is the published-filtered query in `exploreSources.js`; the Work an idea route reads with the Admin SDK; a by-id get of a **missing** document is now denied rather than answered "not found" — no client does one); the limit's source (`atLimitOf` over the read's quota only; during the re-read after a sheet close the search and the panel show the same quota); focus (a sheet started from the own-words row that ends at the limit: on close the line replaces the row and focus goes to the screen's anchor, not `<body>`, by the existing B-1 path); no new React warnings (the founder file prints none; the Explore and Search files' warnings are the same seven as before the round); nothing changed in the pinned bar, the sheet host, close-and-return, the old tabs or at desktop width. **None refuted.**

### 16.10 The founder's phone checklist

On the new smoke preview, on an iPhone.

1. **A story has no tab row.** `?exploreFixture=walk`: open a story. Explore, Markets and Rankings are gone from the top. "← Explore" is there.
2. **Back brings it back.** Tap "← Explore". The tab row is back and you are where you were on the front page.
3. **The first step line.** In the panel it now reads "against its source".
4. **Search at the limit.** `?exploreFixture=search-limit`: type anything. There is no "from your own words" row; a line says you have used today's investigations.
5. **Everything else is as it was:** start, close, Continue research, Save for later.

Items 1–4 checked on the deployed preview by script (393×852, touch): the row on home (Explore, Markets, Rankings, Institutional, Screen, Correlations), gone in the story with "← Explore" there, back after it; the panel's line "…against its source."; `search-limit` with "anything at all" typed: no own-words row, "No story on this yet." then "You've used today's 3 investigations. Try this one tomorrow." (`role="status"`). Item 5: the browser rows' walk (start, close, Continue research) passes on the same preview.

### 16.11 The WSL trees

`~/pd-exb1f` (a worktree of `~/pd-ci`, its own `node_modules`) and `~/pd-exb1f-runs` were removed under the suite lock after the checks; `pd-ci`'s HEAD was never moved. **Space freed: about 1.0 GB** (897 MB the worktree with its `node_modules`, 127 MB the runs and the two builds, by `du -sh`; 885,049,586 bytes apparent).
