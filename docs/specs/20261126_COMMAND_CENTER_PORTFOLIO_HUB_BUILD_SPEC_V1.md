# Command Center as the portfolio's home — build spec V1 (the first hub build)

**Date:** 26 Nov 2026 · **Author:** Fable (the Command Center and Forge direction chat) · **Status:** rulings PH-1 to PH-9 are the founder's ("Yes to all", 26 Nov). PH-10 to PH-21 are this spec's and stand unless he amends one by number.
**Built from:**
- the design of record, `docs/design/20261125_COMMAND_CENTER_PORTFOLIO_HUB_MOCKUP.html` (SHA-256 `d2e4c95a…e01d02`);
- the Phase 0 report, `docs/audits/20261125_PHASE0_COMMAND_CENTER_PORTFOLIO_HUB.md` (draft PR #1114, HEAD `71689d8c`). Section numbers below marked "P0" point into it;
- the Practice Field chat's answers to direction note V4 (25 Nov);
- the stock research modal chat's rulings PC-1 to PC-9 (25 Nov).

**Destination:** `docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md`, committed by slice 1's build, which also carries PR #1114's two files in. No docs-only PR.

## 0. In plain terms

- **For a player with a book, the Command Center becomes the portfolio.** Two figures sit at the top, four tabs under them, and the Overview is the Idea book's positions table.
- **For a player with no book, nothing changes.** They see today's hub.
- **It is built from parts that exist.** The table, the book line, the desk rows and History are the Idea book's own components, placed inside the hub.
- **It ships behind one new switch, off.** With the switch off the hub is exactly today's.
- **It is six slices.** One is on the server and belongs to the Practice Field chat. Five are in the hub.
- **Much of the design waits.** The pulse, changing the archetype, setting the split, strategies and plans, and the modal door are later builds (§9).

## 1. Rulings

### 1.1 The founder's, 26 Nov

| # | Ruling | From |
|---|---|---|
| PH-1 | **The Games history row, Recent activity and the Huddle chip stay under the table on the Overview** until a place is drawn for them. Nothing a player uses disappears. | FQ-1 |
| PH-2 | **"In use" is the marked value of a desk's held positions at the last close, divided by that desk's share of the book's marked value.** The server computes it. An entering idea counts as zero. | FQ-2 |
| PH-3 | **No pulse in this build.** It returns as its own slice (§9). The figures still move, because the agent's form is live. | FQ-3 |
| PH-4 | **The band may put the agent's name beside counts and states of ideas the book backs,** such as "2 ideas running". No sentence says the agent reads, learns from or uses ideas. A guard row tests with a real name. | FQ-4 |
| PH-5 | **The desks are named for who runs them:** "{agent's name}'s desk" and "{archetype}'s desk". The word "Shadow" reaches no player. **A sale by code is "at its line"** until a plan with a stop exists. | FQ-5 |
| PH-6 | **Partnership ships History with the Ideas filter.** The record's counts wait for a server field. | FQ-6 |
| PH-7 | **The Setups tab shows the archetype desk's own idea, note and drafts.** No strategy cards yet. All four tabs ship, so nothing moves when setups arrive. | FQ-7 |
| PH-8 | **A tap on a row opens the built in-place panels,** until the modal's door ships. | FQ-8 |
| PH-9 | **A book owner sees today's hub for a moment, then the book layout, once per page load.** No placeholder band is ever shown to a player who may have no book. This is fixed before the book opens to other players (§9). | FQ-9 |

### 1.2 This spec's

| # | Ruling | Why |
|---|---|---|
| PH-10 | **The built Idea book parts are the Overview.** Where the mock-up's table and the built table differ, the built one wins. Two options are added to the parts: the Cash row can be turned off, and the layout comes from the container, not the window. | P0 §2.1, §4 B4. The designer never received the built screen. |
| PH-11 | **A control that can't work doesn't ship.** No "Change" on the Setups tab, no list of archetypes, no split sheet. The split bar is not a button. | The archetype is frozen at book creation and the shares are fixed (Practice Field Q1, Q6). |
| PH-12 | **"Needs you" is today's next action, drawn as the slim strip.** Same selector, same kinds, same "Later". No result item, no "N more", no Forge item. | A result has no read state, and the next action has no Forge kind (P0 §2.1). |
| PH-13 | **Build order: slice 1, then 3, then 4 and 5. Slice 2 joins when slice 0 has landed.** Each slice is its own PR, merged dark. | Slices 1, 3, 4 and 5 need no server field. Only the band does. |
| PH-14 | **Slice 0 is built in the Practice Field chat's lane.** | It is that chat's module, its money rules and its tests. |
| PH-15 | **On a phone the archetype's figure ships as a still until it is measured.** Slice 2 times two live figures on the founder's phone. The rule on record decides: live at 55 frames a second or better over 60 seconds with the slowest 5% of frames at 8 ms or under; otherwise half rate; otherwise still. | Two live figures have been timed only on a laptop (P0 Part D1). |
| PH-16 | **The header reads the date and "Market open" or "After hours",** from the market state the hub already reads at render. The hub gets no clock tick. | P0 §2.2 |
| PH-17 | **For a book owner the Loadout tab goes.** The loadout opens from the game strip's "Open loadout". The phone armory gets a sheet as its home. | P0 §2.2 |
| PH-18 | **The copy is §5's table.** Every string there is pinned in the copy guard. | P0 Part E |
| PH-19 | **When the book layout shows, the Idea book's entry card and full-window screen are not drawn.** Both stay in the code as the way back. | P0 Part F1 |
| PH-20 | **The switch is `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED`, a plain on/off, shipped off.** Turning it on shows the new layout to every player with a book. The flip is its own PR, after the cumulative review, the phone timing and the founder's walk of the preview. | P0 §2.4 |
| PH-21 | **Review:** each slice's builder runs the multi-lens review of BUILD_RULES §2. Fable reviews slice 3, and does one cumulative review of all slices before the flip. | Slice 3 is the re-layout and touches the most guarded files. |

## 2. What ships in this build

| Surface | In this build | Source |
|---|---|---|
| Header | Date, and "Market open" or "After hours" | Built market state |
| The band | The agent's figure, name, role and status line. The archetype's figure in its armor, name, role and status line | The hub's agent name; the view's new `archetype` field; counts over the view's groups |
| The split bar | Each desk's share and use, and cash. Read-only | The view's new `split` field |
| Tabs | Overview · Ideas · Setups · Partnership | Re-layout of today's tab row and area list |
| Overview | Book line, "Needs you" strip, desk rows, the positions table, the marks stamp. Then, under the table: Games history, Recent activity, the Huddle chip | The Idea book's parts; today's sections |
| Ideas | "Work an idea" and "Explore" doors. Being worked: today's research door and "Continue". In the portfolio. Finished. What each desk considered | Built research door; the view's groups, history and drafts |
| Setups | Who runs the short slot. Its idea, its note, what it considered | The view |
| Partnership | The built panel. History, filtered to Ideas | Built panel; the Idea book's History |
| Sheets | The result of a finished idea. The agent's sheet: today's brief, worth exploring, its desk. The archetype's sheet: who runs the short slot and its desk, with a door to Setups | The Idea book's result; built brief and stories; the view |
| Game strip | Unchanged on the phone. On the desktop, a "Take it into battle" card in the right column | Built |

## 3. The layout decision

One expression, computed once in the hub's connected shell and handed down:

`COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && read.status === 'ready' && read.book !== null`

- `read` is the Idea book's one read. The entry card takes it as a prop and no longer makes its own.
- **Every other case draws today's hub:** not admitted, no book, a failed read, idle, loading.
- **"Unchanged" is judged against the built hub,** never against the mock-up's last state, which differs from the build (P0 Part F2).
- The switch also needs `PRACTICE_FIELD_SCREEN_ENABLED` on, as it is today.

## 4. The slices

No slice touches a fenced file. Each plans a full Linux suite run, because the hub's mount guard goes red only there.

### Slice 0 — the view's new fields (the Practice Field chat's lane)

The request is a separate note to that chat. In short:
- `archetype { codeId, name }`;
- `split`, with each desk's share and use and the cash share, under PH-2;
- the desk names of PH-5;
- the view's version goes from 2 to 3, with the client's reader in the same change.

Later, as slice 0b: `record`, the counts over every finished idea.

### Slice 1 — the switch and the one read

- **Adds:** `src/config/commandCenterPortfolioFlags.js` (no imports, `false`) and its pin test.
- **Changes:** the connected shell reads the book once and computes §3. The Activity section and the entry card take that read.
- **Carries in:** this spec, and PR #1114's report and design file.
- **Done when:**
  - with the switch off, the build is identical to `main`'s for every hub module;
  - a player with no book sees today's hub (a jsdom row for each fall-through case of §3);
  - the card and the layout can never disagree, because both read one value.

### Slice 3 — the tab row and the Overview

Built before slice 2. Until the band lands, the four tabs sit under today's hero.

- **Adds:** the book Overview section; a sheet home for the phone armory (PH-17).
- **Changes:** the phone's tab row, the tab ids, the wide layout's body, the hub's copy, and the Idea book screen's parts for PH-10's two options.
- **Order on the Overview:** book line · "Needs you" strip · desk rows · the table · the marks stamp · Games history · Recent activity · the Huddle chip · the daily brief. The brief leaves this list in slice 4.
- **The table is the built table,** with every state it already draws: open slot, entering, held, near the line, below the line, bought today, selling, sold at its line, waiting on data, delisted.
- **A row tap** opens the name's panel. **A slot header tap** opens the idea's panel. **A desk row tap** opens Setups or Ideas.
- **Done when:**
  - tab order and arrow-key movement pass on phone and wide;
  - real-layout shots at 320, 390 and 1440 match the built Idea book's table, with no Cash row;
  - the Loadout is reachable from the game strip on phone and wide;
  - the entry card and the full-window screen are not drawn when the layout shows.

### Slice 4 — Ideas, Partnership and the sheets

- **Adds:** a hub sheet that hosts the finished idea's result; the agent's sheet; the archetype's sheet.
- **Changes:** the sheet registry, the Research and Partnership panels, the hub's copy. The two figures become tap targets once slice 2 has landed.
- **Ideas tab:** the two doors; "Being worked" as today's research door and "Continue"; "In the portfolio" from the view's groups; "Finished" from the view's history; "What each desk considered" folded.
- **Partnership tab:** the built panel, then History with the Ideas filter. A row opens the result sheet.
- **The agent's sheet:** today's brief, with a door to the full brief; "Worth exploring" for players admitted to research, and absent for the rest; its desk in one line, with a door to Ideas.
- **The archetype's sheet:** who runs the short slot, its desk in one line, and a door to Setups. Nothing else.
- **Done when:**
  - the result sheet joins the overlay stack, sits above the game strip, and returns focus to its opener;
  - the daily brief is drawn in the agent's sheet and no longer under the table.

### Slice 5 — Setups

- **Adds:** the Setups panel.
- **Shows:** "Runs your short slot · {archetype}"; the short slot's idea with its names, day and call; the desk's note with its date; what the desk considered, with each outcome and reason.
- **Does not show:** "Change", tests, "Up next", strategy cards, checks.
- **Done when:** the panel draws only from the view, and an open short slot reads as the built open-slot sentence.

### Slice 2 — the band (after slice 0)

- **Adds:** the band and its pure model.
- **Changes:** the stage, where the band takes the hero's place for a book owner; the hub's copy.
- **Layout:** the final revision's. Each figure sits beside its text block; the two blocks share a first and a second baseline; 171px tall at 390 and 147px at 320.
- **The split bar** sits under the figures: the agent's part at the left, the archetype's at the right, cash between. Each part fills to its use.
- **Measures:** two live figures on the founder's phone, under PH-15.
- **Done when:**
  - the copy guard's new row passes with a real agent name (PH-4);
  - the band's model is pure;
  - every figure in the split bar is the server's text. The client computes none;
  - the importer of the archetype's display data is added to the import-boundary baseline in the same commit.

### The cumulative review and the flip

After all six slices: one Fable review of the whole build against this spec, a fix round if needed, the founder's walk of the preview on his phone, then the flip PR.

## 5. The copy

| Where | The design says | This build says | Why |
|---|---|---|---|
| Desk rows | "{Agent}'s desk", "{Archetype}'s desk" | The same | PH-5 |
| Desk rows | "entered DE" | "opened", the built word | The server's word |
| A row sold by code | "Sold at its stop" | "Sold at its line by code · {date}" | PH-5 |
| An open slot | — | The built sentence, with the desk's new name | PH-5. Today's wording names "Shadow" |
| Ideas, a saved observation | "Saved. Your agent may draft from it at a close." | Not drawn | False while saved theses are off |
| Partnership, heading line | "What Atlas remembers with your say-so…" | The built panel's line | "Remembers" is banned, and that panel isn't built |
| The band, left | "{Agent}" · "your research partner" · "{n} ideas running · {m} entering" | The same | PH-4 |
| The band, right | "{Archetype}" · "runs your short slot" · a status | The same. The status is the short slot's state: "Open", "{n} names entering" or "Day {d} of {n}" | From the view's short group |
| The split bar | "Atlas 70% · 83% in use" · "Cash 10%" | The server's text | PH-2 |
| Setups, heading line | "What Trend Follower is testing, what is up next…" | "{Archetype}'s desk: what it holds, what it wrote and what it considered." | PH-7 |
| Header | "FRI 27 NOV · MARKET OPEN" | The same | PH-16 |

**Words this build never uses:** "stop", "target", "progress mark", "plan", "setup" as a row's label, "strategy", "tests". They arrive with the builds that make them true.

## 6. Guards this build adds or moves

- **Switch:** the pin test, the flag-source list and the dark-by-design list.
- **Mount guard:** a terminal or export row for the book's read, for the Idea book's parts, and for each new sheet.
- **Copy guard:** an exact-string row for every string in §5, and one new row that calls the copy with a real agent name.
- **Purity:** the band's model.
- **Overlay stack:** rows for the three new sheets.
- **One pinned string moves:** the stage line beside the hero.

## 7. Risks

| Risk | Handling |
|---|---|
| Two live figures are too heavy on a phone | PH-15: a still until measured |
| The first paint switches once per page load | PH-9: accepted for now, fixed before other players get books |
| Slices 1 to 3 together cross the 10-file review threshold | Each slice is its own PR; Fable reviews slice 3 |
| The Practice Field chat's launch build and slice 0 touch the same files | Slice 0 is in that chat's lane and on its schedule |
| The Setups tab is thin | PH-7: real content from the desk, and it fills when setups arrive |

## 8. Order, lanes and models

| Step | Work | Lane | Builds | Reviews |
|---|---|---|---|---|
| 1 | Slice 1 | A | Opus | Builder's own |
| 2 | Slice 3 | A | Opus | Fable |
| 3 | Slices 4 and 5, side by side | A and B | Opus; Sonnet with an Opus advisor for 5 | Builder's own |
| Any time | Slice 0 | The Practice Field chat | That chat's builder | That chat's |
| After slice 0 | Slice 2 | A | Opus | Builder's own, plus the phone timing |
| Last | Cumulative review, fixes, the flip | — | Opus for fixes | Fable |

Slices 4 and 5 both edit the hub's copy file and the mount guard. Whichever merges second rebases.

## 9. Not in this build

| Later work | Waits on | Owner |
|---|---|---|
| The pulse: the plain beat first, then colour | A guard exception the founder signs; for colour, a "last looked" record | This chat |
| The first paint without a switch | A way to know a player has a book before the read answers | This chat, before other players get books |
| A row opening the new modal at its position | The modal's door (PC-1 to PC-3) | The modal chat, then a small hub slice |
| Changing the archetype, three setup places, the split presets | Epoch 2 | The Practice Field chat, then a hub slice |
| A strategy and a plan on a row; the Setups tab's tests and strategy cards | S1, the plan drawing, and the plan's numbers | The Practice Field chat, the modal chat, the BaggerBomb revamp chat; then a hub slice |
| "Plan followed" records and the Tests filter | S2 | The Practice Field chat, then a hub slice |
| Partnership's record counts | Slice 0b | The Practice Field chat, then a hub slice |
| "A result is in", "N more", the Forge item | A read state for results; the Forge rebuild | Open |
| A drawn place for Games history, Recent activity and the Huddle chip | A design pass, or the BaggerBomb section | Open |
