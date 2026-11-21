# Explore Build 1 — build spec V1.1

**Date:** Sat Nov 21, 2026 (V1 was Nov 20) · **From:** the Explore chat · **Status:** the spec of record for the build.
**Repo path when committed:** `docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md` (the build session commits it; no separate docs PR).
**Code read at:** `origin/main` `48519ab` (Nov 21, the merge of B6a, #1103). **Design reference:** `Explore - Round 1 (standalone).html`.
**Precondition, met:** B6a is on `main`. Its report, `docs/audits/20261121_BUILD_SHARED_RESEARCH_B6A.md` §1, is the contract for the server and the sheet. Where this spec and that report disagree, the report wins.
**What V1.1 changes from V1:** §8 is B6a as merged, not as asked; N-8 and N-9 are new; form C's *View it* is confirmed; the file names in §7 are fixed by B6a's boundary test.
**Ships:** dark. Nothing a player sees changes until `EXPLORE_MODE` leaves `'off'`.

---

## 1. In plain terms

Today's Search page opens on market movers and a ticker box. Build 1 puts **Explore** in front of it: a page of questions worth researching, each attached to a short story. A player reads the story, picks or rewrites a question, and taps **Work this idea**. The Work an idea sheet opens over the page. Closing it returns the player to the same spot, and the card now says **Continue research**.

- Reading, saving and editing a question start nothing and cost nothing.
- Starting costs one of the day's three investigations, and the page says so before the tap.
- Everything the old page offers stays one tap away, unchanged.

**What Build 1 does not do yet:** carry the story's sources and company leads into the investigation, or treat the chosen angle as the research scope. Those are B6b. Until then the page says only what the investigation really receives (§4).

---

## 2. Rulings

### 2.1 Approved by the founder, Nov 20

| # | Ruling |
|---|---|
| **E-1** | One evidence vocabulary. The story page never says "Supported". Before a check: **Source cited**, **Reporter's reading**, **No source yet**. "Source-backed" appears only inside an investigation. |
| **E-2** | The question is the unit of the home page. Product-led entries ("Who earns when you tap to pay?") are first-class. |
| **E-3** | Search never dead-ends. No story → work it from your own words. A ticker → AssetResearch. |
| **E-4** | On a phone the action is never below a long scroll. No inner scroll boxes on any screen size. |
| **E-5** | One investigation per story. A second question on the same story does not start another. |
| **E-6** | The real cost is shown before starting, read from the server. |
| **E-7** | Cards show their state: in progress, thesis saved, concluded. |
| **E-8** | Inferred statements are qualified in the story text itself. |
| **FQ-1** | Sample stories appear only in a fixture preview and are never researched. Explore goes live for the allowlist with the AI-buildout collection. |
| **FQ-2** | One investigation per story (E-5). |
| **FQ-3** | No separate daily allowance for Explore starts in Build 1. |
| **FQ-4** | Everyone can read and bookmark. Only players with Work an idea access see the start button. |
| **Old tabs** | Build 1 keeps all five existing tabs. The founder decides what to prune after Build 1. |
| **Sequence** | One build, after B6a merges. Claude Code builds; the Explore chat reviews. |

### 2.2 This chat's rulings (approved by default unless the founder objects)

| # | Ruling | Why |
|---|---|---|
| **N-1** | **Names.** The nav entry "Search" and the page heading "Discover" both become **Explore**. Today's first tab (movers, sector table) is relabelled **Markets**. Its file keeps its name. | "Explore" is already the name of the movers tab and of `Search/ExploreView.jsx`. |
| **N-2** | **No direction field.** The mock's "Your direction" input is left out. | The server stores a starting direction and no step reads it (handover §3 row 4). A field that does nothing is a false promise. It returns with B6b. |
| **N-3** | **"What starts with it" replaces "What comes with it".** The panel lists only what the investigation receives today (§4). | The mock says source references and company leads travel. They do not until B6b. |
| **N-4** | **One read, no writes.** Loading Explore makes one read of the research server (access, today's count, the player's investigations by story), and one more after the sheet closes. It never polls. The page itself never starts, steps or changes an investigation. | Handover §6 asked for "no request to the research server" while browsing. E-6 and E-7 each need a read, so the check is restated. |
| **N-5** | **Bookmarks are saved to the account**, not the device. | They follow the player from phone to desktop. Costs one storage rule, deployed before the flip. |
| **N-6** | **The pinned action bar appears whenever the panel's own button is off screen**, on every screen size, and hides when that button is visible. The side column on desktop scrolls with the page. | Satisfies E-4 without two visible copies of the same button. |
| **N-7** | **Explore hosts no SignalDrop entry or theme cards.** | They are mounted in the Forge today, not on the Search page. They stay where they are. |
| **N-8** | **Access is whatever the one read answers.** A `404 disabled` means no access. There is no second access check on the page. (V1 named the hub's admission hook; this replaces it.) | The hub's hook needs a game the player owns to ask with. The read is the server's own answer and needs nothing. |
| **N-9** | **If the read fails, nothing can be started.** Stories and bookmarks still show. The panel says "Couldn't check your research" with Try again. | Without the read the page knows neither access, nor today's count, nor whether the story already has an investigation. |

---

## 3. Screens

### 3.1 The page and its tabs

Mounted where `SearchDiscover` is today (`App.jsx:10036`, screen `'search'`).

- **Tabs, in order:** Explore (new, default) · Markets (today's `ExploreView`) · Rankings · Institutional · Screen · Correlations (still behind `CORRELATION_LAB_ENABLED`).
- **The ticker bar** that opens `SearchOverlay` stays above the tabs on every tab except Explore, where the Explore search (§3.3) takes its place.
- **`AssetResearchModal`** opens from Explore exactly as it does from the other tabs.
- With `EXPLORE_MODE` off, the page, its tabs, its labels and the nav are as they are today.

### 3.2 Home (E-2, E-7)

Top to bottom on a phone:

1. **Heading** "Explore" and one line: "Start with a question. Research begins only when you choose to work one."
2. **Search** (§3.3).
3. **Research in progress**, only when the player has an open investigation started from an Explore story. One row per investigation: its original question, "In progress · {set} of {total}", "{n} steps left", and **Continue research**. (An investigation with no thesis card has no count; it reads "In progress".)
4. **Question cards.** One card per story question the desk has marked as featured, newest story first. Each card shows:
   - an origin tag: "From {reporter}" or "Product";
   - **the question**, as the card's headline;
   - the story's title, reporter and publication date;
   - the state line (§3.7), when there is one;
   - **Read the story** (primary), or **Continue research** (primary) with Read the story beside it when an investigation is open;
   - a **Save for later** toggle.
5. **Saved for later.** Bookmarked stories, each marked "Saved · not researched".
6. **Browse topics.** Chips that filter the question cards. A topic with no story is not shown.

On desktop (≥ 1000 px) items 3, 5 and 6 sit in a right-hand column that scrolls with the page.

**States:** loading (one line); no stories ("No stories to explore yet", with search still usable); stories failed to load ("Couldn't load stories" · Try again). The tabs stay usable in every state.

### 3.3 Search (E-3)

One field: "Search a product, theme, company, or ticker". Results appear under it as the player types, in this order:

1. **Stories and questions** whose title, deck, topics, question text, product name or named tickers match. Tap opens the story with that question selected.
2. **Companies**, from the same matcher `SearchOverlay` uses today. Tap opens `AssetResearchModal`.
3. **Work "{text}" from your own words**, always last, once three or more characters are typed, for players with access. Tap opens the sheet in its own-words start, with the text filled in (§8, X-5b).

With no story and no company match, the list says "No story on this yet." above row 3. A player without access sees "No story on this yet. Try a company name or ticker." There is no "not available" result.

The company matcher is reused, not copied. If it lives inside `SearchOverlay.jsx`, the build moves it to a shared module that both import.

### 3.4 Story reader (E-1, E-4, E-8)

One column on a phone, in this order:

1. Origin tag, beat, title, deck.
2. Byline row: reporter, "Published {date} · evidence dated {span}", and **Save for later**.
3. The story body, as written. Inferred statements arrive already qualified in the text (§5.1 content rule).
4. The parts table, when the story has one.
5. **What the story leaves open** (the copper block).
6. **Questions worth working** (§3.5), directly after the block above.
7. **Proposed investigation** or **Your investigation** (§3.5).
8. **Published connections** (collapsed). Each row carries one of the three E-1 labels, its basis in a sentence, and its company leads. The closing line: "A cited source describes the relationship. How much it matters to the company's sales is a separate question."
9. **Sources** (collapsed). Each row: name, kind, "Evidence dated {date}", the excerpt, and its link when the record has one. The opening line states the publication date and that each source carries its own.

On desktop the reader is two columns: items 1–5, 8 and 9 on the left, items 6 and 7 on the right. Neither column has its own scroll.

**The pinned bar (N-6):** fixed to the bottom of the screen, above the phone's nav. It carries the same primary action as item 7 (**Work this idea** or **Continue research**) and the cost line in small type. It shows only while item 7's button is off screen.

Opening a story moves focus to its title and starts at the top. **← Explore** returns to home at the scroll position the player left.

### 3.5 Choosing a question, and the panel beneath

**Questions worth working** is a radio group of the story's questions. Each shows its angle label and its wording. Choosing one prepares the panel. The helper line: "Choosing one prepares it below. Nothing is researched until you start."

The panel has four forms:

**A. Proposed investigation** (no investigation on this story, player has access).
- **Proposed question**, editable, with "Use the story's wording" once edited. The length limit is the server's (500 characters today). The build takes it from the same place the sheet's own preview does, not from a number of its own.
- **What starts with it** (N-3), §4's left column.
- **The cost line (E-6):** "Uses 1 of your {perDay} investigations today · {used} used". Both numbers come from the read's `quota`.
- **Work this idea** (primary). Disabled while the question is empty.
- At the daily limit: the button is replaced by "You've used today's {perDay} investigations. Save this story and start it tomorrow." with **Save for later** as the primary action.

**B. Your investigation** (an open investigation exists on this story, E-5).
- "You have an investigation on this story." Its **original question**, "In progress · {set} of {total}", "{n} steps left", last update.
- **Continue research** (primary).
- When the selected question differs from the investigation's: "One investigation per story. Continue this one to take it further." No start button.

**C. Finished** (the last investigation on this story is closed).
- "Thesis saved · {date}" or "Concluded · {date}", with its question.
- A new investigation may be started on the story (form A's controls below the line), because the server allows it once the earlier one is closed.
- **View it** opens the finished investigation read-only (`mode: 'session'` with the read's `last.sessionId`). B6a confirmed the sheet does this.

**D. No access** (FQ-4).
- The question and "What starts with it" are shown. In place of the button: the gated line the hub uses (`hubCopy.js` `research.disabled`), kept word for word. **Save for later** stays.

**E. The read failed** (N-9). The question and "What starts with it" are shown. In place of the button: "Couldn't check your research" · **Try again** (one tap, one read). **Save for later** stays.

Selecting, editing and resetting a question change only what is on screen.

### 3.6 The sheet host

A new host inside Explore, in the pattern of `CommandCenter/SharedResearchSheet.jsx`:

- A dialog on desktop (720 wide, as the hub's) and a full-height bottom sheet on a phone.
- The page behind is inert and **stays mounted**, so its scroll position, selected question and edits survive.
- Focus moves to Close on open and back to the button that opened it on close. Escape closes.
- The body (`SharedResearchSheetBody.jsx`) is loaded lazily through Explore's own loader, `src/components/Explore/loadSharedResearch.js`, with the hub wrapper's loading line, failed-load line and Try again. That loader is the sheet's second permitted door (§8).
- `overlayStack` is `null` (the body's standalone mode).

**What the host passes:**

| Opened from | `mode` | Carries |
|---|---|---|
| Work this idea | `'item'` with `startNow` | `item`: `{ itemRef: { recordKind: 'exploreStories', recordId }, headline (the title), reporterName, beat, publishedAt (ISO), context (the deck), question (as edited), reason: null }` |
| Continue research | `'session'` | `open.sessionId` from the read. Always this, never a new open. |
| View it (form C) | `'session'` | `last.sessionId` from the read |
| Search's own-words row | `'start'` with `words` | the typed text. Nothing is sent until the player continues in the sheet. |

With `startNow`, the sheet itself handles what can go wrong at the start: an investigation already open on the story (its Continue state), the daily limit, a refusal, no answer. Explore adds nothing for those.

Inside the sheet, an Explore story's first finding is labelled "From FantasyTimes · {reporter} · {beat}". That is the sheet's wording, by B6a's ruling.

`agentName`, `agentId` and `equippedListLabel` come from the same source the hub's wrapper uses, if that source can be read outside the hub directory. Otherwise all three are `null`: the sheet says "your agent" and does not offer "Use it in my next game". An agent id is never guessed.

`gated` is the read's answer (N-8). A server `404 disabled` gates the body as it does in the hub.

**On close:** the read of §5.3 runs once more, so the card, the panel and the cost line reflect what happened.

### 3.7 Card and panel states (E-7)

| State | Shown as | From |
|---|---|---|
| Open investigation | "In progress · {set} of {total}" · "{n} steps left" | the read's `open`: `filled`, `parts`, `stepsLeft` |
| Open, no thesis card | "In progress" · "{n} steps left" | `open.filled` is `null` |
| Closed, thesis saved | "Thesis saved · {date}" | the read's `last`, `ended: 'saved'`, `at` |
| Closed, concluded | "Concluded · {date}" | the read's `last`, `ended: 'concluded'`, `at` |
| Bookmarked only | "Saved · not researched" | the bookmark |
| None | no state line | |

`{set}`, `{total}` and `{n}` are the server's numbers. The page holds no budget, part count or names limit of its own. When a story has both an open investigation and an earlier finished one, the open one decides the state. A discarded investigation is never reported, so it leaves no state.

### 3.8 Bookmarks

- **Save for later** on a card and in the reader. A toggle with `aria-pressed`. It saves the story, not a question.
- Saved stories are listed under **Saved for later**, apart from Research in progress. A story that is both saved and in progress appears in both, with its in-progress state.
- A bookmark whose story is no longer published shows its title and "No longer available", with Remove.
- A failed save says so in one line and leaves the toggle as it was.

### 3.9 Phone layout (E-4)

- Tested at 393 px and 320 px. Nothing scrolls sideways.
- Every tap target is at least 44 px tall.
- No element on any Explore screen has its own vertical scroll. The sheet's body scrolls as it does in the hub; that is the sheet, not the page.
- On the story reader, **Work this idea** or **Continue research** is on screen at every scroll position, through the panel or the pinned bar.

---

## 4. The handoff

What ChatGPT's list asks for, what the player is told, and what really travels in Build 1.

| The handoff needs | "What starts with it" says | What is sent |
|---|---|---|
| Story identity | "{title}" · {reporter}, {date} | `itemRef: { recordKind: 'exploreStories', recordId }` |
| Story version | not shown | stamped on the investigation at open by the server (`itemVersion`) |
| Selected question | "Your question steers every search." | `question`, as edited |
| Starting angle | the angle's label on the chosen question. Not called a scope. | nothing (B6b, X-3) |
| Source references and dates | "Your agent's first step checks the story against its sources." | nothing (B6b, X-4) |
| Company leads | "Searches start from the companies this story names." Shown only when the story has at least one ticker. (B6a confirmed `open` reads the story's `tickers`: those in the game's list, at most 10.) | nothing from the page; the server reads the story |
| Evidence status | the three E-1 labels, on the story page only | nothing |
| Principal unknown | "Still open: {the angle's unknown}" | nothing (page only) |

**The two prototype shortcuts, resolved:**
1. The page never promises companies after one step. The first step is described as a check of the story against its sources, and nothing more.
2. No limit is written into the page. Steps, parts and name counts are read from the server's answers.

**Also resolved:** a changed source shows nothing in Build 1 (the builder has no Refresh step).

---

## 5. Data

### 5.1 The Explore story record, as the reader needs it (v0)

The collection and record kind are `exploreStories`. This is the shape the page reads. It goes to the content owner for agreement before the AI-buildout collection is written (§11). The server reads only `status`, `title`, `reporter.name`, `reporter.beat`, `publishedAt`, `tickers` and `version` at open, and nothing else.

| Field | Notes |
|---|---|
| `id`, `version` | `id` is the document id and must match `^[A-Za-z0-9_-]{1,200}$`. `version` is a whole number, 0 or more, raised when the published text or sources change. A story without one cannot be opened. |
| `status`, `publishedAt` | only `published` stories are read |
| `lead` | `'story'` or `'product'`; a product-led record also has `productName` |
| `title`, `deck` | |
| `reporter` `{ name, beat }` | |
| `evidenceSpan` | text, e.g. "Feb to Sep 2026" |
| `body[]` | paragraphs of plain text |
| `parts[]` | optional `{ name, job, timing }` rows |
| `openQuestion` | the "What the story leaves open" line |
| `connections[]` | `{ who, what, basis: 'source_cited' \| 'reporters_reading' \| 'no_source_yet', basisLine, sourceIds[], leads[] }` |
| `sources[]` | `{ id, name, kind, dated, excerpt, url \| null }` |
| `questions[]` | `{ id, angleLabel, text, unknown, featured: boolean, sourceIds[], leads[] }` |
| `topics[]`, `tickers[]` | `tickers` are symbols in the game's list |
| `sample` | `true` only in fixtures. The server does not read it, so a sample must never be written to the collection. The page also drops any record that carries it. |

**Content rule (E-8), the writer's duty:** a sentence resting on the reporter's reading says so in its own words ("Kim's reading is that…", "tends to", "often"). The reader prints the body as written and adds no qualifier of its own.

### 5.2 Bookmarks

`users/{uid}/exploreBookmarks/{storyId}`: `{ storyId, storyVersion, title, savedAt }`. Owner read and write, fixed fields, at most 50 per player. One new block in `firestore.rules` with a rules test, deployed to production before the flip.

A second new rules block allows signed-in reads of the Explore stories collection and no client writes, in the `fantasyTimesStories` pattern.

### 5.3 Reads

Per page load: the published stories (newest first, 12 at most), the player's bookmarks, and **one** research read. The research read runs once more when the sheet closes, and once per tap of Try again. Nothing is polled.

**The research read** is `readExploreInvestigations()` (`GET ?list=explore`), called only from `src/components/Explore/useExploreResearch.js`. It answers `{ quota, items }`:

- `quota`: `investigationsToday` and `perDay` feed the cost line.
- `items`: one per Explore story the player has investigated: `itemRef`, `itemVersion`, `open` (`sessionId`, `question`, `lastTurnAt`, `filled`, `parts`, `stepsLeft`, `findingsCount`) or `null`, and `last` (`sessionId`, `ended`, `at`) or `null`.
- `404 disabled` → no access (the service sets `gated`). `401`, `429` or no answer → the read failed (N-9).

The page matches an item to a story by `itemRef.recordId`. An item whose story is no longer published still appears under Research in progress, with its question and Continue, because the investigation is real.

The read shares the sheet's limit of 30 reads a minute per player. One read per page load and one per sheet close stay far inside it.

Starting, stepping and closing are the sheet body's. No other Explore file may import the research service.

---

## 6. Flag and runway

A flag module of its own, `src/config/exploreFlags.js`, for the same reason `sharedResearchFlags.js` has one (the entry chunk's bytes). It is noted in the pin guard's `DARK_BY_DESIGN` block and pinned by `exploreFlags.test.js`. Read at call time, never at module scope.

`EXPLORE_MODE`: `'off'` → `'allowlist'` → `'on'`.

| Value | Who sees Explore | Who can start |
|---|---|---|
| `'off'` (Build 1 ships this) | nobody; the page is today's | — |
| `'allowlist'` | players the read admits (the founder, FT_QA) | the same players |
| `'on'` | everyone | players the read admits (FQ-4) |

Access is the read's answer (N-8). At `'allowlist'` the page is today's until the read answers. If it admits the player, the Explore tab is added in front; it becomes the open tab only if the player has not yet tapped anything on the page. The nav label stays "Search" at `'allowlist'` and becomes "Explore" at `'on'`. At `'off'` the read is never made.

**Before the flip to `'allowlist'`:** B6a live, the two rules blocks deployed, and the AI-buildout collection published with real companies and real sources (FQ-1). Each step is its own one-line founder PR with its pin. Rollback is one step back.

---

## 7. Parts

**Reused, unchanged:**
- `SharedResearchSheetBody.jsx` and everything under `src/components/SharedResearch/`.
- `src/services/sharedResearchService.js` (its read).
- `AssetResearchModal`, `SearchOverlay`, `ExploreView` (as Markets), `RankingsView`, `InstitutionalView`, `ScreenerView`, `CorrelationLab`.
- The hub wrapper's loading and retry pattern (`createBodyLoader`), copied in shape, not imported.
- Tokens from `src/theme/tokens.css`.

**New, all under `src/components/Explore/`:** the home, the story reader, the question chooser and panel, the search, the bookmarks list, the pinned bar, the sheet host, a stories source, a bookmarks source, `exploreCopy.js` (every word on the page), and fixtures. Two file names are fixed by B6a's boundary test:

- `loadSharedResearch.js`: exactly one load-time `import('../SharedResearch/SharedResearchSheetBody.jsx')` and nothing else from that directory.
- `useExploreResearch.js`: imports exactly `{ readExploreInvestigations }` from the service.

No other non-test file under `src/` may load the body, import anything from `src/components/SharedResearch/`, name that directory in a string, or import the service. So Explore has its own words, styles and helpers and borrows none of the sheet's.

**Changed outside that directory:**
- `Search/SearchDiscover.jsx`: the new tab, the label and heading changes, all behind the flag.
- `Navigation/DesktopSidebar.jsx` and `BottomNav.jsx`: the label, behind the flag.
- `firestore.rules` and its tests: two blocks.
- `src/config/exploreFlags.js` and the pin guard's note.
- The company matcher's move to a shared module, if needed (§3.3).

**Not touched by this build:** `src/components/SharedResearch/`, `api/forge/shared-research.js`, `api/_utils/sharedResearch/`, `src/components/CommandCenter/`, `AssetResearchModal`'s internals, the reporters, the KB.

**Guards the build adds:**
- A boundary test: nothing under `src/components/Explore/` imports from `CommandCenter/`, and the only import of the sheet body is the loader.
- A copy guard: `exploreCopy.js` contains none of "Supported", "Source-backed", "Verified", "Confirmed", "confidence" (E-1).
- A request guard: with the service mocked, browsing, bookmarking, choosing and editing call only its read (N-4).

---

## 8. B6a, as merged

`main` `48519ab`, PR #1103. Report: `docs/audits/20261121_BUILD_SHARED_RESEARCH_B6A.md`, §1.

| Asked | Built |
|---|---|
| **X-1** one read | `GET /api/forge/shared-research?list=explore` → `{ quota, items }`; client call `readExploreInvestigations()`. No write, no new index. |
| **X-2** own record kind | `exploreStories` (`EXPLORE_RECORD_KIND`, `src/constants/sharedResearch.js`). `open` reads seven fields (§5.1) and stamps `itemVersion`. |
| **X-5** start at once | body prop `startNow` (with `mode: 'item'` and a non-blank `item.question`) |
| **X-5b** own-words prefill | body prop `words` (with `mode: 'start'`) |
| **X-6** second door | the boundary test allows the two Explore files in §7, and only those |
| **Q-1** closed investigations | **Yes.** `mode: 'session'` shows a saved or concluded thesis read-only. |

Also from the report, and binding on this build:
- Continue with `mode: 'session'`, never a new open. A story unpublished after an investigation opened still lists as open, and a new open of it would answer `404 item_not_found`.
- A sample story in the collection would open like any other. Samples stay in fixtures.

---

## 9. Acceptance checks

**In a real browser, at 1280×900, 393 px and 320 px:**
1. No element on an Explore screen has its own vertical scroll. Nothing scrolls sideways.
2. On the story reader, the primary action is on screen at every scroll position.
3. At 1280×900 the right-hand column never hides its button behind a scroll.

**The walk:**
4. Read a story, choose a question, edit it, tap Work this idea: one investigation opens with the edited question, and the sheet shows no second preview.
5. Close the sheet: the page is at the same scroll position, focus is on the button that opened it, and the card and panel now show In progress and Continue research.
6. Continue research reopens the **same `sessionId`** with its question, evidence, card and steps used unchanged.
7. Choosing a different question on that story shows form B and no start button. No investigation is created.
8. After the investigation is saved or concluded, the card shows Thesis saved or Concluded, and View it opens that investigation read-only.

**Separation:**
9. Browsing, searching, bookmarking, choosing and editing a question call only the research read. No open, step, card or close request leaves the page.
10. A bookmark never appears under Research in progress unless it also has an open investigation.

**Access and limits:**
11. A player without access sees stories, questions and bookmarks, the gated line, and no start button anywhere, including search's own-words row.
12. The cost line's numbers match the server's `quota`. At the limit the start button is gone and Save for later is offered.
12b. When the read fails, no start button is shown anywhere; Try again makes exactly one read.

**Search:**
13. A story match opens the story with the matched question selected. A ticker opens AssetResearch. A search with no match offers the own-words start and never a dead end.

**Words:**
14. No Explore screen shows "Supported" or "Source-backed". Every connection carries one of the three E-1 labels.
15. Each source row shows its own date, apart from the publication date.
16. Every sample story and sample company in the fixture preview is labelled as a sample.

**Unchanged:**
17. With `EXPLORE_MODE` off, the Search page, its tabs, the nav label and the entry chunk's behavior are as on `main` today.
18. With it on, Markets, Rankings, Institutional, Screen and Correlations work as before, and the SignalDrop entry and theme cards are still where they were.
19. No file under `src/components/SharedResearch/`, `api/forge/shared-research.js`, `api/_utils/sharedResearch/` or `src/services/sharedResearchService.js` is changed by the build, and the sheet's boundary test passes unedited.

**Smoke preview for the founder's phone:** a smoke branch with an `?exploreFixture=` loader, in the pattern of the sheet's `?srFixture=`. Scenes: home, home with one in progress, story, story in progress, story finished, no access, at the daily limit, no stories. One scene walks the whole flow into the sheet over the existing fixture route, so nothing reaches the research server. The preview URL is at the top of the build's handover.

---

## 10. Out of scope

Any change to Work an idea's server or sheet. The angle as scope and carried reporting (B6b). A direction field (N-2). A Refresh for changed sources. Reporter generation and the KB connection. Personal stories from games ("From your research" cards). Removing FantasyTimes. Pruning or redesigning the five existing tabs. The AssetResearch modal's "Work an idea" section (after the beta). A separate daily allowance for Explore (FQ-3). Deep links to a story. No inactive control is shown for any of these.

---

## 11. Needs for other chats

**To the Work an idea chat:** nothing open. B6a answered every ask (§8).

**To ChatGPT, for the AI-buildout collection (not blocking the build):**
> From the Explore chat. Build 1's reader expects the story record in spec §5.1. Three points to confirm before the collection is written: (1) each story carries one or more `questions`, each with an angle label, its wording, and the principal unknown; one is marked `featured` for the home page. (2) Each connection carries exactly one basis: `source_cited`, `reporters_reading` or `no_source_yet`. The page never says "Supported". (3) A sentence that rests on the reporter's reading is qualified in the body text itself; the reader adds nothing. Companies must be tickers in the game's list with real sources, or the story cannot be researched. Product-led stories use the same record with `lead: 'product'`. (4) The document id uses only letters, digits, `_` and `-`, and every story has a whole-number `version`; the server refuses a story without one.

---

## 12. Open after Build 1

- Which of the five old tabs stay (founder).
- FQ-3, when Work an idea opens beyond the allowlist.
- B6b: the angle as starting scope, carried reporting, and the direction field's return.
- The AssetResearch modal's section as "Explore filtered to one stock" (after the beta).
