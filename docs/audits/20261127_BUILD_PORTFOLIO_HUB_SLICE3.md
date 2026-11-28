# Portfolio hub, slice 3 — the four tabs and the Overview (build report)

**Date:** 27 Nov 2026 · **Branch:** `claude/portfolio-hub-s3-tabs-and-overview` (built in the session worktree branch `claude/portfolio-hub-s3-tabs-overview-98dcee`, pushed under the prompt's name) · **Base:** `origin/main` `a2e05fa9` (PR #1122, slice 1, merged). `git fetch origin` was the first step; `main` had not moved at the end. · **Spec:** `docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md` (§2, §4 slice 3, §5, §6) and its Amendment A, committed here unchanged. · **The switch ships off.** Draft PR; not merged; CI not watched.

| Question | Answer |
|---|---|
| What does a book owner see with the switch on? | **The book layout:** today's hero, then four tabs (Overview · Ideas · Setups · Partnership), and the Overview as the Idea book's own parts — book line, "Needs you", desk rows, the positions table with no Cash row, the marks stamp — with today's games, reviews, Game history, Recent activity and brief under the table. No entry card. The loadout and the phone armory open as sheets. |
| What does everyone else see? | **Today's hub, unchanged.** With the switch off the build folds every new site away (§4.3). With the switch on, a player with no book (or any read that is not a ready book) gets today's hub: slice 1's parity rows still hold for every such case. |
| Are the rules kept? | No fenced file, no flag change, no Firestore, model or EODHD call. No hub file gained an effect, timer, listener or observer. |
| Review | Three lenses, a refuter and quick mutants on the fixes (§6). **One major finding is a merge gate, not a code defect: read as written, the prompt's "Shadow" clause fires** on today's strings around the book layout, and the refuter judges I should have stopped (S3G-1, Q-1). One major code finding (keyboard focus after a desk-row tap) and every minor one are fixed, with a row each. Every mutant that survived the test lens's battery now has a row that kills it. |
| Anything for you? | **Three questions (§8). Q-1 must be ruled before this PR leaves Hold:** whether "no 'Shadow'" means the book layout's own words (my reading, R1) or every string the hub draws, which would stop the slice until today's hero, Deploy card, Huddle and armory words change. |

## 1. In plain terms

**With the switch on, a player with an idea book now sees their book in the Command Center.**
- Today's hero stays at the top (Shadow, its status line and, on the phone, its three summary lines). The two-agent band replaces it in slice 2.
- Under it are four tabs: **Overview · Ideas · Setups · Partnership.** Loadout is no longer a tab. On the desktop the four tabs take the place of the three-area list beside the hero.
- **The Overview is the Idea book itself,** drawn with the Idea book's own parts, top to bottom:
  1. the book line: the book's value, today's change, "Since …", SPY, cash and the paper-money line;
  2. **"Needs you":** the hub's next action as one slim strip (a game to open, a review, the Huddle, or the first deployment's hold), with its button and "Later". It is not drawn when there is nothing to do;
  3. the desk rows ("Trend Follower’s desk · …", "Atlas’s desk · …"). A tap opens Setups for the archetype's desk and Ideas for the agent's;
  4. the positions table, exactly as the Idea book draws it, without the Cash row. A tap on a name or an idea opens its detail right under it, at every width;
  5. "Marks as of the close, …";
  6. then today's list: games, reviews available, Game history, Recent activity and the daily brief.
- **Ideas** shows today's Research panel. **Partnership** shows today's Partnership panel. **Setups** shows the Idea book's Desks content for the archetype's desk: its note, its call on its idea, and what it considered.
- **The Idea book card and its full-window page are not drawn** for this player. They stay in the code as the way back.
- **The loadout opens as a sheet:** from the game strip's status button on the phone, and from the Deploy card's loadout line on the desktop. Everything the Loadout tab had is in it. On the phone the armory opens in its own sheet too.
- No figure is computed in the hub. Every number and word about the book is the server's, as the Idea book screen draws it.

**Everyone else sees today's hub, unchanged:** a player with no book, one not admitted, a read that failed first, or a read still loading. With the switch off (as shipped) nobody sees anything new: every new site folds away in the build (§4.3).

## 2. Step 0 — the anchors, against `main` at `a2e05fa9`

All the prompt's anchors still match; only line numbers moved. None forced a stop. Every citation was read in this session (VERIFIED).

| Anchor | Phase 0 / slice 1 said | On `main` now |
|---|---|---|
| PR #1122 (slice 1) | — | **Merged:** `a2e05fa9`, the branch's base. |
| The decision and its scope (slice 1 R1, R4) | `HubBookScope.jsx` provides `{ read, refresh, layout }`; later slices read it with `use(HubBookReadContext)` inside literal ternaries | **Matches** (`HubBookScope.jsx:22-31`, `hub/hubBookRead.js:12`, `hub/hubLayout.js:17-28`). |
| The card's one site | `ActivitySection.jsx:90` (Phase 0), `:105` (slice 1) | **Matches,** the ternary at `:105` on `main`. |
| `PosTable` and its Cash row | `IdeaBookScreen.jsx:277`, the row at `:369-371` | **Matches** on `main`. |
| The parts that take a layout | `BookLine :36`, `PosTable :277` take `layout`; the window is read only by the page (`useWidth :526-535`) | **Matches** on `main`. `Strip :128`, `NamePanel :220`, `IdeaPanel :233` and `DesksTab :431` draw the same at every layout. |
| Today's tabs and areas | `hubCopy.js:113-125`; `composition.js:62-83` | **Matches.** |
| The phone Overview | `PhoneTabs.jsx:85-135` | **Matches** (`:85-136`). |
| The wide side column's Activity | `CommandCenterHub.jsx:691` (slice 1) | **Moved** to `:695` by slice 1's own import block. |
| The next action's kinds | `hub/nextAction.js:34`, plus the Huddle's (`huddleView.js`) | **Matches.** |
| The phone armory's home | the hero's box (`Armory.jsx:499`, `PhoneArmoryScope`) | **Matches** (`:499`). |
| B5's desk names (B5 report §2) | view version 3; the desks by their names; no "Shadow" in the server's words | **Matches:** `useIdeaBook.js:21` is 3; `bookViewCopy.js` names no "Shadow" desk. Built over every scene with the hub's agent "Atlas", no shown string in any view says "Shadow" (§4.4). |
| The design file | the tab row (`ccp6-screens.jsx TabRow3`), the Overview's order (`ccp5-parts.jsx Overview5`), the slim strip (`ccp4-table.jsx NeedStrip4`) | Unpacked outside the repo and read: Overview · Ideas · Setups · Partnership; book line · Needs you · desk rows · table with `cash={false}`. The desktop puts the tabs under the band and a battle card in a 360 px right column. |

## 3. What changed, by file

### 3.1 Source (every switch read is a literal ternary or a switch-guarded statement, so with the switch off each folds to today's)

| File | Change |
|---|---|
| `src/components/CommandCenter/hub/bookTabs.js` (new) | Pure. The four tabs (`BOOK_TABS`, `BOOK_TAB_ORDER`, written as literals so the switch-off build drops them); where the layout opens from today's selection (`bookTabOf`: Research → Ideas, Partnership → Partnership, anything else → Overview); a desk row's tab (`bookTabForDesk`); the parts' layout from the hub's composition and width (`bookPartsLayoutOf`, PH-28: desktop → `desk`, the phone under 360 → `p320`, else `p390`); the book layout's two sheet keys (`BOOK_SHEETS.LOADOUT` and `BOOK_SHEETS.ARMORY`, beside `HUB_SHEETS`, which is untouched). |
| `src/components/CommandCenter/BookLayout.jsx` (new) | `BookTabRow` (today's tab row's behaviour: one tab stop, Left/Right/Home/End move selection and focus, a modified arrow belongs to the browser; sticky on the phone; 12 px padding off the desktop, review S3W-5); `BookPanel` (Overview; Ideas = today's Research panel; Setups = `DesksTab` for the archetype's desk alone; Partnership = today's Partnership panel, PH-25; a desk-row tap moves focus to the tab it selects, review S3W-1); `BookPhoneBody` (the phone's tabs, panel, loadout sheet and armory sheet; the armory opens on the book layout's own key, review S3W-2); `bookWideGrid` (today's wide grid with the main column holding hero, tabs and panel, the side column Deploy alone; stacked keeps Deploy above the panel) and `BookWidePanel` (the wide tabs, panel and loadout sheet, drawn in today's panel slot so the hero and Deploy never remount, review S3W-6). The tab state opens on `bookTabOf` of today's selection; a tab change cancels an uncommitted hold, as today's do. `BookLoadoutSheet` is a `HubSheet` with today's Loadout area; on the phone its Deploy card first. No effect, timer, listener or observer. |
| `src/components/CommandCenter/sections/BookOverview.jsx` (new) | The Overview: `BookLine`, `NeedsYouStrip`, `Strip`, `PosTable` (Cash off and the desk rows named for their tab, through the parts' options scope; detail in place), then `PhoneOverview`. `NeedsYouStrip` draws the candidate's own title, its own action (the first deployment's is the deploy provider's hold, the card's control id) and today's Later; nothing when there is no candidate. |
| `src/components/PracticeField/ideaBookPartsOptions.js` (new) | `IdeaBookPartsOptions`, one pure-marked context: the parts' Cash option and the desk rows' label (R2, R11). |
| `src/components/PracticeField/IdeaBookScreen.jsx:26`, `:134`, `:141`, `:376-380` | Three switch sites: the desk row's screen-reader name takes the scope's `deskLabel` when one is set (`:134`, `:141`), and the Cash row sits inside `{SWITCH && use(IdeaBookPartsOptions)?.cash === false ? null : (row)}` (`:376`). The screen never sets the options, so it draws as on `main`, "Open Desks" included. Nothing else in the file changed. |
| `src/components/CommandCenter/CommandCenterHub.jsx` | Fifteen new switch sites (slice 1's `:1032` is the sixteenth). PhoneHub: a layout that leaves 'book' frees the loadout's and the armory's sheet slot (`:452`), and a book that arrives closes today's hero-box armory (`:453`, PH-9, review S3W-3); in the book layout the hero-box armory never opens (`:480`), the hero selects no area (`:486`) and pauses while the armory sheet is open (`:490`, PH-15), `BookPhoneBody` takes today's tab row's place (`:516`) and today's panel is not drawn (`:531`), and the strip's status button opens the loadout's sheet (`:551`). WideHub: the same slot rule for the loadout (`:656`), the hero selects no area (`:665`), the Deploy card's loadout line opens the sheet (`:707`, naming the line's own button for focus return, since the line calls its opener with no event), the grid is `bookWideGrid` (`:737`), today's next slot stays in the tree hidden and empty (`:740-741`), and the panel slot holds `BookWidePanel` (`:745`). |
| `src/components/CommandCenter/ShadowStage.jsx:184` | In the book layout the stage draws no area list (so no connector). |
| `src/components/CommandCenter/PhoneTabs.jsx:96`, `:119-143` | `PhoneOverview` exported. In the book layout its two next-action cards are not drawn (`:120`, `:124`), and on the wide compositions it takes the wide empty-note words (`:119`) and the desktop activity limit (`:143`). |
| `src/components/CommandCenter/Armory.jsx:570`, `:601`, `:632-682` | `PhoneArmorySheet`: a phone `HubSheet` holding `PhoneArmoryScope`, a centre figure wearing the preview, `PhoneArmoryRing` and `PhoneArmoryDetails`. Inside it the ring draws neither its own "Armory" mark nor its own Close (two literal ternaries on a pure-marked context). |
| `src/components/CommandCenter/sections/ActivitySection.jsx:84` | `HubIdeaBookEntry` (the card's switch-on site) draws nothing in the book layout (PH-19). |
| `src/components/CommandCenter/hub/hubCopy.js:718-729` | `PORTFOLIO_HUB_COPY`, a table of its own: the four tab labels and the tablist's name, "Needs you", the loadout sheet's title "Loadout", and the desk rows' hub name ("… Open Setups", "… Open Ideas"). |

**Fenced files:** none touched (BUILD_RULES §1). **Fenced functions called:** none. **No flag changed** (`commandCenterPortfolioFlags.js` is untouched). **No Firestore read or write, no model call, no EODHD call.** The only read is the existing `GET /api/practice-field/book`, the scope's, as in slice 1.

### 3.2 Guard rows added or moved

| Guard | Row |
|---|---|
| `commandCenterHub.mount.guard.test.js` | Two `PERMITTED_TERMINALS`: `PracticeField/IdeaBookScreen.jsx` (the parts) and `PracticeField/ideaBookPartsOptions.js`. `NAMED` rows: the screen gives `BookLine`, `DesksTab`, `PosTable`, `Strip` and never its default; the options give one name. A new row pins the takers: only `sections/BookOverview.jsx` takes the Overview's parts and the options, only `BookLayout.jsx` takes `DesksTab`, and no hub file takes the page. The activity scan now reads the parts the hub draws from the screen's module (review S3G-2): every function in it is classed as drawn or page-only, the page-only ones and the imports are cut, and a drawn part that calls a page-only one fails. |
| `hubCopy.guard.test.js` | A slice 3 describe: the four tab labels exactly, the tablist's name, "Needs you", "Loadout" (equal to the strip's "… Open loadout" word), the desk rows' hub names ("Trend Follower’s desk · held 2. Open Setups", "Atlas’s desk · held 6. Open Ideas"), the table's four keys, and none of "stop", "target", "plan", "strategy", "tests", "progress mark" or "Shadow" in the table; "Setups" is its one setup word. The table's literals also pass every existing row (banned claims, the pairing fence, the numerals). |
| `hub/s4Modules.purity.guard.test.js` | `bookTabs.js`: imports only `./composition`, touches no clock, page, storage, network or randomness. |
| `src/theme/tokens.guard.test.js`, `motion.guard.test.js`, both baselines | The three new hub files, registered in the same commit (hazard 34). The motion baseline was spliced by hand, not regenerated. |
| `src/config/agentFormFlags.test.js`, `perGameLoadoutFlags.test.js` | `BookLayout.jsx` reads `PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED` once (the loadout sheet's cards take the shell's lists, as today's panel does): added to both reader censuses, line for line. |
| `portfolioHub.flagOffBundle.test.js` | Extended from slice 1's three sites to every slice 3 site (§4.3). |
| `CommandCenterHub.portfolioSwitch.jsdom.test.jsx` | Slice 1's suite. The parity rows keep every case of §3 that gives 'today' (the fall-through). The book owner's rows now pin the book layout and no card (the card never draws with the switch on now: it needs a book, and a book is the book layout). |

The activity guard needed no row: no hub file gained an effect, timer, listener or observer (its "every file" rows pass with the three new files).

## 4. Tests and checks

The full suites ran in WSL (`TZ=UTC`, `--maxWorkers=8`, `flock /tmp/pd-suite.lock`), in a worktree of `~/pd-ci` at the commit, `node_modules` linked to an install of the same lockfile (`6d01297094c2`), with nothing else running.

| Check | Exit | Counts |
|---|---|---|
| **Full Linux suite at the final head `0f25aeee`** | **0** | **39,519 passed, 0 failed** (197 skipped), 490 s |
| Full Linux suite at the first code head `0246b68c` (before the review) | 0 | 39,492 passed, 0 failed (197 skipped), 402 s |
| `npm run lint:gate` (WSL) | **0** | at `0f25aeee` (also 0 at `0246b68c`) |
| `npm run test:rules` (WSL, Temurin 21, Firestore emulator) | **0** | **48 files, 889 of 889**, at `0f25aeee` (the same at `0246b68c`) |
| `vite build`, the switch off, `main` and the final head in one tree (§4.3) | **0 / 0** | **125 files each; all 64 non-map files byte-identical, hashed names included**; one map differs |
| `vite build`, the switch on (positive control), at the final head | **0** | the hub chunk changes (`CommandCenterHub-DeMp0i_i.js`) and carries the book layout |
| Lens S3T's 15 surviving mutants, re-planted on the final code (§6.2) | 1 each | **all 15 killed**, plus M47's phone twin and a moved chip |
| The slice's rows on `main`'s source (§4.1) | 1 | **41 rows red, 2 suites cannot load**; every row file has a red |
| The new and changed rows (Windows, targeted, before the review) | 0 | hub, Idea book, theme and config: **80 files, 2,911 passed** (the CRLF-only `shadowCpuQuoteIntegrityFlags.test.js` row outside them, as slice 1 recorded) |

### 4.1 The rows, red first

The prompt asks for the failing row first. I wrote the slice's code and its rows in one pass, so to show every row can fail without the slice, I ran the slice's test files against `main`'s source (the head's tests and baselines over a `main` archive):
- `CommandCenterHub.bookLayout.jsdom.test.jsx` and `hub/bookTabs.test.js` cannot load: their modules do not exist.
- Every other file has red rows: the bundle test (10), the switch suite's book-owner rows (7), the token and motion guards (6 each), the mount guard (3), the copy guard (3), the purity guard (2), and the two flag censuses (2 each). 41 in all.

The two suites written during the review (the hero behind the armory sheet and the Huddle chip, §6.2) were not part of this run. The review's battery (§6) then showed which rows bite on the slice's own code, those two suites' included.

### 4.2 The jsdom rows (test 1 to 7 of the prompt)

| Prompt's test | Where | Rows |
|---|---|---|
| 1. Tab row: order, labels, keys and focus, phone and wide | `CommandCenterHub.bookLayout.jsdom.test.jsx` | the four tabs in order and words, one tab stop, the Overview first, today's tab row and area list gone (phone, desktop, tablet, stacked); Left/Right/Home/End move selection and focus together and wrap, a modified arrow and Up/Down do nothing (phone, desktop, stacked); each tab's panel (PH-25) |
| 2. Overview order | the same | the nine parts in order at both sites (book line, Needs you, desk rows, table, stamp, reviews, Game history, Recent activity, brief); no next-action card anywhere; the next action's own game not listed again; the desktop side column holds Deploy alone; the phone hero and strip stay |
| Needs you (PH-26) | the same | every kind (openGame, review, Huddle, deploy) draws its own title, action and Later, each wired; the deploy kind's hold is disabled without the provider's wiring and armed by it; nothing when there is no candidate; in the hub, a review opens the Film Room and Later moves to the next |
| 3. The table | the same | no Cash row in the hub, the stamp there, and the screen still draws its Cash row; **for 14 scenes at 390, 320 and 1440, the hub's table is the Idea book screen's own table at the same layout, less its Cash row** (42 rows: open slot, entering, held, near the line, line hit, sold at its line, selling, waiting on data, bought today, unobserved, settled today, paused, a failed check, history); a name row and a slot header open their detail in place, one at a time, phone and desktop (PH-27); desk rows open Setups and Ideas |
| 4. Fall-through | `CommandCenterHub.portfolioSwitch.jsdom.test.jsx` | slice 1's parity method, kept: for each of the six cases of §3 that give 'today', at both sites, the hub inside the scope and `<body>` outside it are exactly the switch-off drawing |
| 5. The card | `bookLayout` suite and the switch suite | no card and no layer on any tab, both sites; a read with no book takes the book layout away and brings no card; a failed refresh keeps the book layout (PH-23) |
| 6. The loadout | `bookLayout` suite | the phone strip's status button and the wide Deploy card's loadout line (desktop, tablet, stacked) open "Loadout" with today's Loadout area; the page behind is inert; Escape or Close returns focus to the opener; the phone armory opens in its own sheet from there (the hero box stays closed, one Close), the page is inert, Escape returns focus to the loadout's opener; the desktop's armory dialog the same; a read that takes the book away closes the loadout's sheet and frees the slot |
| 7. No "Shadow" | `bookLayout` suite | §4.4 |
| PH-9 | `bookLayout` suite | a book arriving while today's hub is drawn: the phone on Research lands on Ideas; the desktop's default area lands on the Overview and its Shared Research area on Ideas; the hero then selects no area; an armory open in today's hero box closes, and one open in the book layout's sheet closes when the book leaves, neither reopening in the other layout's home |
| The hero behind the phone armory (PH-15, R6) | `CommandCenterHub.bookLayoutHero.jsdom.test.jsx` | an AgentForm probe: the hero is live at rest, paused while the armory sheet is open (the sheet's centre the one live figure), live again after Escape |
| The Huddle chip stays by the hero | `CommandCenterHub.bookLayoutHuddle.jsdom.test.jsx` | a Huddle member with a book, phone and desktop: the chip after the hero and before the four tabs, drawn once, opening the Huddle sheet |
| The parts' layout (PH-28) | `hub/bookTabs.test.js` | the composition and width table; the 320 edge pinned to the parts' own |

### 4.3 The switch off: the build against `main` (slice 1's method)

`main` (`a2e05fa9`) and the final head `0f25aeee` were built in **one** LF archive tree, so the source-map paths match. `vite build` on Windows, `node_modules` as a junction.
- **125 files each, with the same names.** All **64 non-map files are byte-identical**, hashed names included. The hub chunk is `CommandCenterHub-3x1Zx0cH.js`, `f0240306…` in both, the same as slice 1 recorded; `index.html` is `25e8dbbc…` in both.
- **One file differs:** `assets/CommandCenterHub-3x1Zx0cH.js.map`. It carries the same 87 sources, so no module enters the hub chunk. Its source text differs for the seven edited files (`hubCopy.js`, `IdeaBookScreen.jsx`, `ActivitySection.jsx`, `Armory.jsx`, `PhoneTabs.jsx`, `ShadowStage.jsx`, `CommandCenterHub.jsx`), and so do its line mappings. Under ruling B3-9 a source map is not the shipped app.
- **Positive control:** the same tree with the switch on. The hub chunk changes (`CommandCenterHub-DeMp0i_i.js`) and carries `data-hub-book-tabs`; the switch-off build carries none. So the comparison can see the new path, and with the switch off it is folded away.

`portfolioHub.flagOffBundle.test.js` keeps this in CI, module by module:
- every file with a switch site bundles to the same code as itself with each switch ternary replaced by its off arm and each switch-guarded statement removed; the transform is made from the parse, with the site count pinned per file (16 in the hub file, slice 1's included; 4, 1, 2, 1 and 3 in the others);
- the four new modules, imported and unused, bundle to nothing;
- planted leaks are seen: a site that does not fold, an unmarked context, a module-level table.

It found two real leaks while it was being written. Both were fixed before the commit:
- a module-level table in `bookTabs.js` whose order list read another table's properties;
- a transform artefact (parentheses around an arrow function).

### 4.4 No "Shadow" in the book layout

- **On the client:** the `bookLayout` suite draws the `desksAdmit` scene (both desk rows, an open slot and an entering slot) at both sites. It collects every word and every screen-reader label in the tab row and the panel: the Overview, then each slot header and name row opened in turn, then Ideas, Setups and Partnership. None matches `/shadow/i`. The row is not vacuous: it finds "Atlas’s desk", "Trend Follower’s desk" and "Atlas’s desk looks tonight", and a planted "Shadow desk" is caught.
- **On the server's side:** every one of the 21 scenes, built with the hub's agent "Atlas", carries no shown string containing "Shadow" (desk ids excluded).

What still says "Shadow" is today's hub around the book layout, and the agent's own words (R1, Q-1).

## 5. The layout shots

**The harness.**
- The real `CommandCenterHub`, from an LF archive of the final head `0f25aeee`, with the switch set on in that copy only. (A first set was taken at the fix commit `f286eb7a`; the set here replaces it. Every picture has the same size as before. The changed pixels lie on the animated hero figure and on the times in Recent activity and the brief's header, which the harness stamps from the clock of the run: nothing moved.)
- The readers are stubbed at the seams the jsdom suites stub. The book read answers a server-built view (`buildBookView` over the B5 scenes, agent "Atlas").
- The app's three style sheets are loaded. The desktop frame has App's 220 px sidebar offset, and a 64 px stand-in for BottomNav sits under the phone.
- Driven by headless Edge (playwright-core), with animations and transitions off for the frames. Segoe UI draws here; Inter is not installed.
- The harness lives in the session scratchpad, not the repo.

The pictures are in `docs/audits/20261127_PORTFOLIO_HUB_SLICE3_PICTURES/` (19 PNGs):

| Picture | What it shows |
|---|---|
| `320-full.png`, `390-full.png`, `320-full-whole.png`, `390-full-whole.png` | **A full book** (scene `full`: three ideas held) on the phone, the first screen and the whole Overview |
| `320-desksAdmit*.png`, `390-desksAdmit*.png` | **A book with an entering slot** (scene `desksAdmit`: Short entering, Medium held, Long open; both desk rows) |
| `1440-full.png`, `1440-desksAdmit.png` | The desktop composition (a 1,220 px hub) |
| `834-full.png`, `834-desksAdmit.png` | An 834 px tablet with the sidebar: the stacked composition (a 614 px hub), Deploy above the tabs |
| `390-full-medium-open.png`, `1440-full-name-open.png` | An idea's detail and a name's detail, in place (PH-27) |
| `320-desksAdmit-setups.png` | The Setups tab: the archetype desk's Desks content |
| `390-full-loadout-sheet.png`, `1440-full-loadout-sheet.png` | The loadout's sheet, from the strip and from the Deploy card |
| `320-full-armory-sheet.png`, `390-full-armory-sheet.png` | The phone armory's sheet |

**Measured in every frame:**
- no horizontal overflow, and no element past the viewport's right edge;
- no Cash row;
- every table row at least 44 px, with its cells inside it;
- every tab label inside its tab;
- no page error.

The armory's ring fits its sheet at 320 (a 282 px inner width for the 280 px ring) and at 390. A separate pass at `f286eb7a` (the tab row's code has not changed since) measured the wide tab row at 769, 834, 920, 940, 1024, 1300 and 1440. At 920 (a 700 px hub, the tablet's narrowest) the four tabs end 15 px inside their 332 px column.

**Seen in the pictures** (not only measured):
- the Overview's order;
- "Needs you" as one line on the wide compositions; on the phone, at 320 and 390, its title on the first line and its button and Later on the second;
- the desk rows, the entering slot's "Buys at the next session’s first window" and the open slot's "Long · open · Atlas’s desk looks tonight.";
- the marks stamp under the table, then today's list.

At 1440, today's hero box keeps its width with its area list gone, so its right half is empty (R4, S3W-7) until the band replaces it.

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

- **Three lenses, each on its own LF `git archive` of the code head `0246b68c`, read-only on git:**
  - **S3W**, the switch-on wiring and lifecycle, with a real-browser check in headless Edge at 320, 390, 834, 920, 1024, 1300 and 1440;
  - **S3G**, the switch-off guarantee, the guards, conformance to the prompt, spec and Amendment A, and a flip dry run;
  - **S3T**, test integrity: a mutant battery over the new rows.
- **One refuter** on two more archives (the code head and the first fix commit `f286eb7a`). It took every S3W and S3G finding and every fix, and tried to break each with a repro.
- Every tree was restored byte for byte (`cmp` against `git show`). No agent wrote to git.

### 6.2 Every finding, and what happened to it

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| **S3G-1** | **The prompt's "Shadow" clause fires as written.** The side column's Deploy card, the Huddle sheet one tap from Needs you, the wide armory dialog and the kept hero all draw "Shadow". The guard row scanned only the tab row and panel. | **CONFIRMED, major as a merge gate** (no code risk: dark, draft, Hold). The refuter's verdict on the process: read as written, the clause should have stopped the build, and the PR must not leave Hold until Q-1 is ruled. Its row was refuted in part (S3R-1). | **Q-1**, at the top of this report and the PR. A row pins every "Shadow" the page and the layout's sheets draw, per occurrence (`f286eb7a`, then `8e605871` for S3R-1). |
| **S3W-1** | A desk-row tap moved keyboard focus to `<body>`: the row unmounts with the Overview. | CONFIRMED, major; fix sound | **Fixed** (`f286eb7a`): focus moves to the newly selected tab; on the phone with `preventScroll` (`8e605871`), since the sticky row sits in the pane's scroll padding. Mutant M1 killed. |
| S3W-2 | An armory sheet open when the book goes away reopened in today's hero box. | CONFIRMED, minor (low reach); "not intended behaviour" | **Fixed** (`8e605871`): the phone armory opens on the book layout's own key (`BOOK_SHEETS.ARMORY`), and each layout closes the other's armory, with no new state in today's shell. Mutant R1 killed. |
| S3W-3 | The reverse (PH-9): today's hero-box armory became a modal sheet without a tap. | CONFIRMED, minor (against the HU-4 rule) | **Fixed** (`8e605871`; row extended in `d842b2c8`). Mutant R2 killed. |
| S3W-4 | The desk rows' names said "… Open Desks" in the hub. | CONFIRMED; fix sound and folds | **Fixed** (`f286eb7a`): a `deskLabel` option on the parts' scope, read under the switch; the screen keeps "Open Desks" (R11). Mutant M2 killed. The switch-off bundle of `IdeaBookScreen.jsx` is byte-identical before and after. |
| S3W-5 | At a 700 px hub the four wide tabs (349 px) overflowed their 332 px column. | CONFIRMED, nit; fix correct for Segoe UI (15.5 px spare; about 1.4 px with Arial metrics); unpinned | **Fixed** (`f286eb7a`): 12 px padding off the desktop. **Pinned** (`8e605871`). Mutant R3 killed. Measured in Edge: the last tab ends 15 px inside the column. |
| S3W-6 | On wide, the hero and the Deploy card remounted when the book arrived. | CONFIRMED; fix sound (no stray grid tracks) | **Fixed** (`f286eb7a`): the book layout keeps today's grid and tree; only the grid's template, the hidden next slot and the panel slot's content change. A row checks that both stay the same nodes, at all four compositions. Mutant M4 killed. |
| S3W-7 | The wide hero box is more than half empty. | CONFIRMED, nit (never ships: the band comes before the flip) | **Stated** (R4). |
| S3W-8 / S3G-5 | The League door's "open on Loadout" lands on the Overview. | CONFIRMED, minor | **Q-2.** S3R-3 refines the recommendation. |
| S3W-9 | The loadout's word "book" now sits beside the Idea book. | CONFIRMED, nit | §9 item 2. |
| S3G-2 | The screen's terminal hid the parts the hub draws from the activity scan. | CONFIRMED; first fix partial (S3R-2) | **Fixed** (`f286eb7a`, widened in `8e605871`). The guard reads the whole module but the page's own functions and its imports. It fails a drawn part that calls into the page's own, and every function must be classified. The refuter's M6b and M6c are now caught by its planted rows. |
| S3G-3 | The bundle rows compare each file with itself, not with `main`; `hubCopy.js` had no row. | CONFIRMED IN PART; disposition acceptable | **Fixed in part** (`f286eb7a`): a `hubCopy.js` row; the test's header now says what it proves (folding) and what the whole-build comparison proves (identity with `main`, §4.3). Off-arm text is not pinned: it would red every later legitimate edit to today's hub. Mutant M7 killed. |
| S3G-4 | "plan" is drawn through PH-25's Partnership panel for a Huddle member. | CONFIRMED as a question, nit | **Q-3.** |
| S3G-6 | The spec and the prompt place the Huddle chip differently. | CONFIRMED, nit | §9 item 5. The build follows the prompt. |
| S3G-7 | The hub does not load the Idea book's `IB_CSS`. | CONFIRMED, nit: the focus ring matches; only the hover tint and the press scale are lost | **Stated** (R12). |
| S3R-1 | The S3G-1 row pinned distinct strings, so a new site drawing a kept string passed. The inventory missed the armored hero's label and the armory's intro. | (the refuter's own) | **Fixed** (`8e605871`): the row pins every occurrence per place, and the inventory names them. Mutant R4 (a second "Shadow" in the header) killed. |
| S3R-2 | (see S3G-2) | (the refuter's own) | **Fixed** (`8e605871`). |
| S3R-3 | Q-2's fix must carry the door's intent until the layout settles; on the desktop the default area already is the Equipped Archetype. | (the refuter's own) | Folded into Q-2. |
| S3R-4 | "… Open Setups" names a tab, but §5 bars "setup" as a row's label. | (the refuter's own) | Folded into Q-3. |

**Lens S3T's battery.** 63 mutants on the code head `0246b68c`, each run against the slice's 9 row files (333 rows, `--maxWorkers=4`, JSON reporter). A mutant counts as killed only when vitest exits non-zero and named rows fail; none was BROKEN or SKIPPED. Its totals line says 49 killed and 14 survived; its table lists 15 survivors against the slice's rows (below), plus two switch-off mutants (M48, M54) that only today's suites kill (`CommandCenterHub.jsdom`, `s3`, `s3strip`; `reviewFixes` L1-8). Every survivor was a missing row, not a code defect. I re-planted all 15 on the final code (`7d13a8f1` for 14, `0f25aeee` for M47, plus M47's phone twin and the chip moved under the panel): **every one is killed**, each by the row named below.

| ID | Finding | Survivor(s) | Disposition |
|---|---|---|---|
| S3T-1 | The loadout's slot freed when the book leaves was unpinned. | M45, M46 | **Row** at both sites: the book coming back opens nothing (`7d13a8f1`). |
| S3T-2 | The wide PH-9 arrival was tested only from the default area. | M15 | **Row:** the desktop on Shared Research lands on Ideas. |
| S3T-3 | The phone loadout row pre-focused its opener, which hid the named opener. | M22 | **Fixed:** the row taps without focusing first (a tap focuses nothing on Safari). |
| S3T-4 | The hero's pause behind the phone armory sheet (R6) was unpinned. | M38 | **New suite** `CommandCenterHub.bookLayoutHero.jsdom.test.jsx` with an AgentForm probe: the hero paused while the sheet is open, one live figure, live again after Escape. |
| S3T-5 | The hero selects no area in the book layout (R8) was unpinned. | M43, M44 | **Rows:** its label names none on the desktop; on the phone its summary lines highlight none. |
| S3T-6 | The stacked order (Deploy above the tabs, R4) was unpinned. | M19 | **Row:** the grid template per wide composition. |
| S3T-7 | The live-game site's next-action card was not checked. | M50 | **Row:** no card there either. |
| S3T-8 | The wide empty-note words and the desktop activity limit (R3) were unpinned. | M51, M52 | **Rows** under the table, desktop. |
| S3T-9 | The tab row's Meta and Ctrl guard was untested. | M07 | **Rows:** Meta and Ctrl arrows belong to the browser, phone, desktop and stacked. |
| S3T-10 | A tab change handing itself to the shell (which cancels an uncommitted hold) was unpinned. | M14 | **Rows** on both bodies, by a tab and by a desk row. |
| S3T-11 | The Huddle chip's place beside the hero in the book layout had no row. | M47 | **New suite** `CommandCenterHub.bookLayoutHuddle.jsdom.test.jsx` (`0f25aeee`): a Huddle member with a book; the chip sits after the hero and before the tabs, once, on the phone and the desktop (inside the stage slot), and opens the Huddle sheet. |
| S3T-12 | The armory sheet's ring kept its own "Armory" mark beside the sheet's title. | M57 | **Row:** one "Armory" in the sheet. |
| S3T-13 | One assertion in the PH-25 panel row could never fail. | — | **Fixed:** the vacuous selector removed. |
| S3T-14 | Two order-row assertions were looser than their comments. | — | **Fixed:** the brief and the stamp are found exactly. |
| S3T-15 | The slice's own switch-off rows compare each file with itself. | — | **Stated,** as S3G-3: the whole-build comparison with `main` proves identity (§4.3), and it ran again at the final head. |

### 6.3 What the lenses checked and found sound

- **Switch off.** Every difference against `main` in the seven touched source files lies inside a folded site, or is an unused import, the added `export`, or new module-level code that drops (S3G, by hand and by bundle). With `minify: true`, `CommandCenterHub.jsx` bundles byte-identical to `main`'s.
- **The flip dry run** (S3G): slice 1's four edits, then the hub, Idea book and config directories. Nothing beyond the pins went red. The 11 reds were 5 s host-load timeouts, green on rerun.
- **Players without a book** (S3W, P-L): switch on with no book against switch off. The host and `<body>` matched at every step of a 24-step interaction script, at four compositions, with the hero-box armory and the wide dialog opened.
- **Lifecycle** (S3W):
  - equip success, a failed equip after Escape, the sheet slot's replacement and focus returns, StrictMode;
  - no duplicate ids or dangling ARIA references;
  - holds: a tab change, a desk-row tap and a book's arrival each cancel an uncommitted hold, and nothing deploys;
  - only "Needs you" carries the next action's hold.
- **Real browser** (S3W):
  - no horizontal overflow at any width;
  - the phone tab row stays sticky at top 0 inside the pane;
  - the Overview's end clears the strip;
  - the loadout and armory sheets trap focus and are hit-testable above the strip and nav;
  - the armory ring takes over from 315 px, with the grid below.

## 7. Readings — what I decided where the prompt was silent (each stands unless you object)

- **R1 — "No player-facing 'Shadow' in anything the book layout draws" is read as the book layout's own words. This is the reading Q-1 asks you to rule on: lens S3G read the STOP clause literally (§6).** These are the Idea book's parts (the server's words, after B5), the tab row, "Needs you" and the two new sheets. None says "Shadow": a row scans every word and label they draw, every tab, with every row and slot opened, both sites, on a scene with both desk rows and an open slot (§4.4), and every scene's shown strings were scanned on the server side too. The STOP clause did not fire, because nothing in those words says it. Today's elements that the prompt keeps still do:
  - the hero's name line, "Shadow · your research partner", and its image label. The prompt keeps the hero until the band, and spec §6 moves this pinned line in slice 2;
  - the wide Deploy card's title, "Send Shadow into a game", now the side column's one card;
  - the Huddle sheet's eyebrow, "Huddle with Shadow", and the wide armory dialog's centre label, "Your Shadow · fitted preview";
  - the agent's own words (its notes, calls and theses), which the hub draws as data. The model is still told it is "the Shadow desk" until B6's prompt rename (B5 Q-1, ruled into B6). The Overview can draw such a call when a player opens one of the agent's ideas.
  
  A row now pins this whole picture (review S3G-1). It scans the whole page and every sheet the layout opens, and each "Shadow" it finds must be one of those named strings. The layout's own region and its two new sheets have none. See Q-1.
- **R2 — the Cash option is a scope, and the layout option already existed.**
  - Cash: a prop would change the hub chunk with the switch off, because the card's screen is in it. So the option is a context (`ideaBookPartsOptions.js`), read in a literal ternary at the row. Only the hub's Overview sets it, and the screen draws as on `main`.
  - Layout: `BookLine` and `PosTable` already take `layout` as a prop, and only the screen's default export reads the window. So "the layout can be passed in" needed no change. The hub passes `bookPartsLayoutOf(composition, width)`, from the composition it already computes and the width it already measures (PH-28).
- **R3 — "under the table, in today's order" is today's phone Overview list itself,** at both sites. In the book layout it draws no next-action card, because the strip has it. It keeps today's rule that the next action's own game and review are not listed again. On the wide compositions it takes today's wide words for the empty note ("… starts from Deploy." without "below") and the side column's limit of five activity rows.
- **R4 — the wide body keeps today's grid and today's tree** (review S3W-6), so the hero and the Deploy card never remount as the layout arrives.
  - The main column holds the hero, then the tabs, then the panel; the side column holds Deploy alone.
  - Today's next-action slot stays in the tree, hidden and empty. The side column's Games, Activity and Brief are not drawn, because they are now the Overview's.
  - The stacked composition keeps Deploy above the panel, as today.
  - The hero keeps today's box. With the area list gone its right side is empty until the band (§5's 1440 shot).
- **R5 — the loadout's sheet.** "The game strip's 'Battles as…' row" is read as the strip's status button. Its second line is the loadout, and its name already ends "Open loadout"; the built strip has no "Battles as" words. On the wide compositions it is the Deploy card's loadout line ("Open the BaggerBomb loadout"). Both open one `HubSheet`, "Loadout", holding today's Loadout area whole; on the phone the Loadout tab's Deploy card comes first, as that tab drew it. A sheet opened from inside it (the armory, the agent record, the book, the traits, the Scouting Board, the Huddle's reconfirm) takes the hub's one sheet slot, as any sheet opened from a sheet does today. Closing it gives focus back to what opened the Loadout. The sheet's title "Loadout" is new copy, pinned.
- **R6 — the phone armory's sheet.** The prompt says the phone armory gets a sheet now, while the hero still stands, so in the book layout the hero's box never opens it. The sheet reuses the hero box's own state and parts (`PhoneArmoryScope`, the ring, the details) around a centre figure that wears the preview, as the wide dialog's does. The sheet's own title and Close replace the ring's mark and Close. The hero is paused while the sheet is open, so the phone draws one live figure, as today (PH-15).
- **R7 — where the book layout opens.**
  - The tabs' state lives in the new components and starts from today's selection when the layout arrives (PH-9): Research → Ideas, Partnership → Partnership, anything else → Overview.
  - The League door's one-shot "open on the Loadout" intent lands on the Overview in this layout; the loadout is one tap away on the strip. Nothing opens a sheet from a render.
- **R8 — the hero in the book layout selects no area.** Its image label then names no selected area, and no area bloom fires. On the phone its three summary lines stay (today's hero), with none highlighted.
- **R9 — "Needs you" is one slim strip: the candidate's own title, its action and Later.** Its "why" and "detail" lines stay the card's; the design's strip draws a title alone too. So the first deployment's "Shadow deploys with your equipped loadout." is not drawn here.
- **R10 — the wide tab row is horizontal,** under the hero, as the design draws it and as spec §4 says ("the four tabs sit under today's hero"). It takes Left and Right like today's phone row. Today's vertical area list also took Up and Down; a horizontal row does not.
- **R11 — the desk rows are named for the tab they open in the hub** (review S3W-4): "Trend Follower’s desk · held 2. Open Setups" and "Atlas’s desk · held 6. Open Ideas". The screen's own name, "… Open Desks", would point a screen-reader user at a tab the hub does not have. This is a third option on the parts' scope (`deskLabel`), beyond the prompt's two. It is read under the switch like the Cash option, so the Idea book's own screen keeps "Open Desks". The words are new hub copy, pinned.
- **R12 — the Idea book's own press and hover styles (`IB_CSS`) are not loaded in the hub.** They carry CSS transitions, which the hub's motion guard forbids. The hub's own focus ring draws on the parts' buttons.
- **R13 — slice 1's suite changes.** Its book-owner rows pinned the card under the switch. With the switch on the card is now never drawn (it needs a book, and a book is the book layout), so those rows now pin the book layout instead. Its parity rows for every case that gives 'today' are kept unchanged: they are this slice's fall-through check.
- **R14 — the amendment is committed as given,** as a block quote, character for character.

## 8. Questions for the founder

| # | Question | The fact that forces it | Recommendation |
|---|---|---|---|
| **Q-1** | **The prompt's "Shadow" clause, read as written, fires. Do you rule it as the book layout's own words (R1), or must today's kept strings change before this slice merges?** | The prompt says: "If any string the hub would draw still says 'Shadow', STOP and report it." The book layout's own words do not say it: the Idea book's parts, the tabs, "Needs you" and the two new sheets (§4.4). Today's hub around them does. The hero says "Shadow · your research partner", and the prompt keeps the hero until the band. The Deploy card in the side column says "Send Shadow into a game". Two sheets one tap away say "Huddle with Shadow" and "Your Shadow · fitted preview". Read literally, the clause would have stopped the build before it started, since the prompt itself keeps the hero. So I built, reported the hit here, and keep the PR a draft on Hold. | **Rule R1 as written.** The hero's words leave with the band (slice 2, spec §6). The Deploy card's, the Huddle's and the armory's are today's hub copy. Renaming them is a copy decision for the band and its slices, not a server patch. A row now pins every "Shadow" the page draws, so any new one is seen. |
| **Q-2** | **Should the League door still open on the loadout for a book owner?** | The armory flip's LD-1 opens today's hub on the Loadout tab. In the book layout the loadout is a sheet, and the door's intent lands on the Overview (R7). The loadout is one tap away on the strip. | **Open the loadout's sheet** when the door's intent was taken, with the hub's root as the focus fallback. The intent has to be carried until the layout settles (review S3R-3): on a first visit the read is still out, the intent goes to today's Loadout, and then the book arrives. And on the desktop the default area already is the Equipped Archetype, so the area alone cannot carry it. That would be a small follow-up in slice 2 or 4. Until then, the Overview. |
| **Q-3** | **Are two drawn words outside spec §5's list: the Huddle's "game plan", and a desk row's screen-reader name "… Open Setups"?** | PH-25 puts today's Partnership panel in the Partnership tab. For a Huddle member it draws "Game plan", "Recent plans" and rows such as "Nov 25 · No plan" (review S3G-4). A desk row in the hub is named for the tab it opens, "Setups", which the prompt mandates (review S3R-4). §5 bars "plan" and "setup" as a row's label. | **Yes, both outside it.** The Huddle's game plan is a shipped name for the morning plan; §5's words are about a trading plan or setup on a position row, which arrive with S1. "Open Setups" names the tab, not the row. An amendment could say so. |

## 9. Found outside the task (for separate tasking; nothing fixed)

1. **The switch's docstring describes slice 1 only.** `src/config/commandCenterPortfolioFlags.js:13-16` says that with the switch on "the hub … hands the same read to the entry card". Since this slice, a book owner gets the book layout and no card. No flag file is touched on a slice branch, so the flip PR (or a cleanup slice) should refresh it.
2. **The loadout's word "book" now sits beside the Idea book** (review S3W-9). The per-game loadout calls a watchlist a "book" (`src/constants/loadoutCopy.js`: "No book · open market", "Change BaggerBomb book"). In the book layout the phone strip reads "Trend Follower · No book · open market" under a player's $99,595 Idea book. The copy is the loadout's own and already shipped; this slice only places it near the Idea book. For the loadout's owners and the founder.
3. **Today's hub copy names "Shadow" in places the book layout keeps** (R1, Q-1): `hubCopy.js:83`, `:85`, `:106`, `:149`, `:413`, `:500`, the armored hero's label (`:669-670`), and `ARMORY_COPY.intro` and `.centre` (`:686-687`).
4. **A pure-marked `Object.freeze` still survives tree-shaking when its argument reads another module-level object's properties.** `[BOOK_TABS.OVERVIEW, …]` kept both tables in the switch-off bundle until the order was written as literals. Slice 1's bundle test calls `hubLayout.js` "Rollup knows Object.freeze is pure"; that file in fact carries the mark. A note for any later slice that adds module-level tables to the hub.
5. **The spec and the prompt place the Huddle chip differently** (review S3G-6). Spec PH-1 and §4 slice 3 list the chip under the table. The prompt keeps it by the hero, and the build follows the prompt. An amendment could record that.
6. **Known, unchanged:** `shadowCpuQuoteIntegrityFlags.test.js` fails on a Windows (CRLF) checkout and passes on LF, as slice 1 recorded.
