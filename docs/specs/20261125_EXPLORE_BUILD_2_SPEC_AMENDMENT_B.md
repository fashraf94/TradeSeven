# Explore Build 2 — spec Amendment B: the front page, the phone story page, and the story hierarchy

**Date:** Wed Nov 25, 2026 · **From:** the Explore chat · **Amends:** `docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md` (with its Amendment A).
**Repo path when committed:** `docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md` (the build session commits it).
**Code read at:** `origin/main` `1cb1c627`. **Design references:** `Explore - Round 2 (standalone).html` and `Explore - Round 3 (standalone).html`.
**Also binding:** `docs/audits/20261123_BUILD_SHARED_RESEARCH_B6C.md` §1 (the read's new fields), and the content chat's story-record note of Nov 25 with editorial standard V1.4.
**Ships:** dark. `EXPLORE_MODE` stays `'off'`.

Everything in spec V1.1 and Amendment A holds unless a line here changes it. The evidence rulings E-1 to E-8 and N-1 to N-9 are unchanged.

---

## 1. In plain terms

Build 1 made Explore work. This build makes it worth opening.

- **The front page** gets a hero question with a picture of the story's connections, a shelf for the player's own theses, a row of products to start from, and a row of the newest deep stories.
- **Stories now come in two kinds.** An overview is the map of a theme. A deep story covers one company or product and belongs to one connection of an overview. A connection that has a deep story is a door into it.
- **The story page on a phone** gets a pinned row of jump links and keeps the question in view in the bottom bar.
- **The sheet opened from Explore knows the player's agent,** so it can offer "Use it in my next game".

## 2. The founder's rulings (Nov 22 to Nov 25)

| # | Ruling |
|---|---|
| **B-1** | **The chain is drawn as branches** from the story's subject, one per connection, in the story page's three colours (teal, gold, grey) with a distinct mark and line style for each evidence label. Cards use a short form: names and marks only, with the key once above the cards. The linked-row drawing is parked until stories state a real order. |
| **B-2** | **The count line reads** "{n} connections · {s} sourced · {u} not checked yet". |
| **B-3** | **One card per story.** A story's other questions are inside it. |
| **B-4** | **The front page's cards are overviews,** plus one row, **Latest deep stories.** |
| **B-5** | **"Start from something you use"** is the product-led overviews. The card grid holds the rest. |
| **B-6** | **A connection is one list on every screen size.** Each branch opens in place to show its detail. There is no second list of connection cards under the chain. |
| **B-7** | **A connection with a deep story is a door.** A connection without one says nothing about it. The words "not written yet" do not appear. |
| **B-8** | **The hero shows the group its question compares,** as tickers, and marks the branch the question comes from. It does not lead with a large count. The count line sits under the chain in ordinary type. |
| **B-9** | **The panel describes the investigation that exists.** The compare wording is switched on by the build that makes the compare investigation real (§6). |
| **B-10** | **The story page never shows a figure the story carries for comparing,** and never lists a source that exists only to back one (§5.3). |
| **B-11** | **The back arrow returns the player where they came from.** The line above a deep story's title ("AI buildout › Electric utilities") is the step up. |
| **B-12** | **Inside a story there is no page heading and no tab row,** at every width. |
| **B-13** | **The phone's bottom bar carries the chosen question on one line** beside the action, with the cost or the state under it. Tapping the question jumps to the chooser. |
| **B-14** | **An overview's jump row reads** Story · Connections · Questions · Sources. **A deep story's reads** Story · Questions · Connections · Sources. |
| **B-15** | **Company leads show two to a row on a phone.** |
| **B-16** | **The empty shelf keeps the blank thesis sentence and shows no part count,** because a thesis does not always have six parts. |
| **B-17** | **Left out of this build:** counting taps on connections; the agent's own question; any compare figure. |

## 3. The story record the page reads

The record is the content chat's note §3, and every new field is optional. The page reads these and ignores the rest.

| On | The page reads | And does with it |
|---|---|---|
| the story | `kind` | `'deep'` is a deep story; anything else, or nothing, is an overview |
| the story | `subject` | where the chain starts; a product-led story without one uses `productName`; a story with neither starts from an unlabelled mark |
| a deep story | `parent` `{ storyId, connectionId }` | the way up, and "Where next" |
| a deep story | `about` | the company it is about, as tickers |
| a connection | `id`, `known`, `unknown`, `whereToLook` | the three-part gap |
| a connection | `leadsToStory` | the door |
| a connection | `leads` | each `{ symbol, name }`; a lead with a symbol is a button; a lead that is plain text (the old shape) is plain text |
| a question | `fromConnection` | which branch the question comes from |
| a question | `group` | the companies a broad question names, as tickers, in the story's order |
| a question | `measures[].name` for `kind: 'reported'` | a label, only when §6's switch is on |

**The page never reads, holds or draws:** `cells`, any `value`, `formula`, `inputs`, `benchmark`, `wrongIfSeed`, `watch`, `match`, `matched`, `storedKey`. They are dropped when the record is read, so no screen can show them by accident.

**The hard rules are unchanged** (spec V1.1 §5.1, K-6 of Build 1): the same reasons drop a record, and no new one is added. The publish step calls the same function to decide what may be published.

A **broad question** is one with a `group` of at least three. Every other question is specific.

## 4. Screens

### 4.1 The front page

Top to bottom on a phone. On desktop the hero sits beside the shelf, and the cards are three columns.

1. **Heading, intro line, search,** as built.
2. **Research in progress and the shelf (§4.2).** On a phone the shelf sits above the hero once it holds something, and after the cards while it is empty.
3. **The hero:** the newest overview's featured question.
   - Origin tag and "Overview".
   - The question as the headline; the story's title, reporter and date under it.
   - For a broad question: its group as tickers. For a specific one: its `unknown` line.
   - The chain at hero size, with the question's branch marked "This question" and any door drawn under its branch.
   - The count line (B-2).
   - **Read the story** and **Save for later.** "Reading and saving are free."
4. **Start from something you use:** one tile per product-led overview that is not the hero: the product's name and its count line. The row is absent when there are none.
5. **Questions worth researching:** the key, the topic chips, then one card per story-led overview that is not the hero: tags, the featured question, the chain in its short form with "Deep story ›" beside a branch that has one, the count line, the story's title and byline, its state line when it has one (spec V1.1 §3.7), **Read the story**, the Save toggle.
6. **Latest deep stories:** the three newest deep stories. Each shows "Deep story", its title, the overview and connection it belongs to ("AI buildout › Electric utilities"), and the company it is about. The row is absent when there are none.
7. **Saved for later,** as built.

States as built: loading, no stories, stories failed, no access, the daily limit, the read failed. Nothing on the front page starts research.

### 4.2 The shelf: Your theses

From the research read alone (spec V1.1 §5.3, with B6c's fields).

| What the read holds | The shelf shows |
|---|---|
| nothing, with access | The blank thesis sentence, as an example. "Nothing here yet. Work a question from a story and the thesis you build lands here." "{used} of {perDay} investigations used today." No count, no rail (B-16). |
| an item with `open` | Its question; "In progress · {filled} of {parts}" and a rail drawn from those two numbers; "{n} steps left"; the story's title when the story is loaded; **Continue research.** |
| an item with `last`, `ended: 'saved'` | "Thesis saved · {date}"; its `statement` when it has one, else its `question`; **View it.** |
| an item with `last`, `ended: 'concluded'` | "Concluded · {date}"; its `question`; **View it.** |
| no access | "Building a thesis needs research access. Reading and saving stay open." |
| the read failed | "Couldn't check your research" · **Try again.** |

Every open investigation is listed, then the three newest finished ones. A heading line says how many of each. A `null` question or statement leaves that line out; nothing is invented in its place.

### 4.3 The story page, both kinds

**No page heading and no tab row inside a story (B-12).**

**The jump row (phone).** Under the byline, and pinned once scrolled past: a back arrow, then the sections in B-14's order with their counts. They are jump links, not tabs: the story stays one page, and the row marks the section in view.

**Connections (B-6).** One list, the chain itself:
- The count line and the key.
- The subject, then one branch per connection: its mark, its name, its evidence label.
- A branch opens in place to show: what the business does; the basis line; **Known** (or "Nothing sourced yet."); **Unknown**, the largest line in the block and its one accent; **Where to look**; its company leads as tickers (B-15); and its door, if it has one.
- A door shows "Deep story" and the deep story's title, and opens it.
- The branch the chosen question rests on is marked "This question".
- All branches start closed, except the one a link asked for (§4.5).
- The closing lines: "A ticker opens the stock's research page. A company stays a lead until a source ties it to the story." and "A cited source describes the relationship. How much it matters to the company's sales is a separate question."

A story in the old shape, with no gap fields, shows what it has and leaves the rest out.

**Sources (B-10).** As built, listing only the sources a connection cites (§5.3).

**The panel and the chooser** as built, with §6 for a broad question. The first-step line, the cost line, the limit and all five forms are unchanged. The finished form now shows the question (the read returns it).

**The bottom bar (phone, B-13).** One line of question, the action, and the cost or the state beneath. With an investigation open it reads "In progress · {filled} of {parts}" from the read.

**Desktop** keeps the built two-column page: the story on the left, the chooser and the panel on the right, neither with its own scroll.

### 4.4 A deep story

- **Above the title:** the way up, "{overview's subject} › {connection's name}", where the overview's name opens the overview at that connection; then "About" and the company's ticker.
- **After its sources: Where next.** One step up (the overview's title). "You are here" (this story's subject). Then the overview's other connections, each opening the overview at that connection, and each showing its deep story's title when it has one.
- If the parent cannot be read, the way up and "Where next" are left out. The story still reads.

### 4.5 Moving between stories

- **Back (B-11).** The back arrow on a phone, and the back link on desktop, return to the screen the player came from: the front page, search, or the story that linked here. The link names where it goes ("← Explore", "← The AI buildout").
- **Returning restores the place:** the scroll position, the branch that was open, and focus on the control that was tapped.
- **A link to an overview at a connection** opens the overview scrolled to that branch, with it open.
- **A door whose deep story cannot be read** (unpublished, missing, or not a deep story) is not drawn. The connection shows as one without a door.

### 4.6 Search

As built, with two additions: an overview's row is tagged "Overview", and a deep story's row is tagged "Deep story" and shows the overview and connection it belongs to. Search covers every story the page has loaded, both kinds.

## 5. Data

### 5.1 Stories

One read per page load, as built: the published stories, newest first. The limit rises from 12 to 40, with no new index. The page splits them by `kind`. The "complete" flag keeps its meaning.

When the read was not complete, a door's deep story or a deep story's parent may be outside it. Then, and only then, the page reads that one story by id when the story that needs it is opened. At most six such reads for one story page.

### 5.2 The research read

As built: once per page load, once after each close of the sheet, once per Try again. It now also returns, per B6c:
- on each item's `last`: `question` and `statement`, each possibly `null`;
- `agent`: `{ id, name, equippedList }` or `null`.

The page ignores `agent.equippedList` except its `name`.

### 5.3 Which sources are listed

A source is listed on the story page unless it is named by a figure the story carries and by no connection. In the pilot overview that leaves three of seven.

### 5.4 Nothing else changes

No new rule, no new index, no new collection, no new request to the research server, and no write other than bookmarks.

## 6. The compare switch (B-9)

`EXPLORE_COMPARE_ROUTE` in `src/config/exploreFlags.js`, `false`, pinned by its test. It says whether the research server runs the compare-and-narrow investigation for a broad question. It changes words only.

| | `false` (this build) | `true` (set by the compare build) |
|---|---|---|
| The group's heading | "Companies this question names" | "Compares {n} companies" |
| Under the group | "A ticker opens the stock's research page." | "Listed in the story's order. The comparing happens inside the investigation." |
| "Compares on" | absent | the story's own measure names; absent when it has none |
| First step | as built: "Your agent's first step checks the story against its source." | "Your agent's first step compares the companies this question names." |
| Then | absent | "You narrow the group to the names you choose." |

At either value the page shows no figure and orders nothing.

## 7. What the sheet is handed

As spec V1.1 §3.6, with:
- `agentId`, `agentName` and `equippedListLabel` from the read's `agent` (`id`, `name`, `equippedList.name`), each `null` when absent. This lifts the hold on "Use it in my next game" from Explore, as B6c §1.3 allows.
- `item.questionId`: the chosen question's id in the story, on **Work this idea.** The sheet forwards it in a later build; until then it is an unused key.

Still exactly two Explore files reach the sheet and the service.

## 8. Acceptance checks

Spec V1.1 §9's checks all still hold. Added:

**The hierarchy**
1. An overview's door opens its deep story. The deep story's way up opens the overview at that connection, with it open.
2. Back returns where the player came from, at the scroll position and open branch they left, from each of: the front page, search, a door, "Where next", the Latest deep stories row.
3. A connection without a deep story shows no door and no words about one.
4. A door whose target cannot be read is not drawn.

**The connections list**
5. At 1280, 393 and 320 there is one list of connections on a story page, and each branch opens in place.
6. Every opened connection shows its evidence label, its three-part gap and its leads. A blank Known reads "Nothing sourced yet."
7. A lead with a symbol opens that stock's research page. A lead without one is not a button.

**What is never shown**
8. No screen shows a carried figure, a benchmark, or a source named only by a carried figure. The reader's view of a story does not hold them.
9. A broad question's group is listed in the story's order. No screen orders companies by anything.
10. With `EXPLORE_COMPARE_ROUTE` `false`, no screen says "compare".

**The front page**
11. One card per story. A product-led overview appears as a tile and not as a card. The hero's story is not also a card.
12. The shelf's every number and sentence is the read's own. With nothing in the read it shows no count.
13. "Start from something you use" and "Latest deep stories" are absent when they would be empty.

**The phone story page**
14. No page heading and no tab row inside a story, at every width.
15. The jump row is pinned, marks the section in view, and its back arrow works from every scroll position.
16. The bottom bar shows the chosen question on one line; tapping it jumps to the chooser.

**The sheet**
17. With an agent in the read, the sheet is handed its id and name; without one, `null` for both. "Work this idea" hands the question's id.
18. Still one research read per page load, one per close, one per Try again, and no other research request.

**Unchanged**
19. With `EXPLORE_MODE` `'off'`, the Search page is as on `main`.
20. No file under `src/components/SharedResearch/`, `src/components/CommandCenter/`, `api/` or `src/services/sharedResearchService.js` is changed.

## 9. Out of scope

The compare investigation and its table. The agent's own question. Counting taps. A "request this story" action. Deep links. Pruning the old tabs. Any change to the publish step. The linked-row chain. Reporter generation.
