# Phase 0 — the Command Center as the portfolio's home (read-only discovery)

**Date:** 25 Nov 2026 · **For:** the founder and the Command Center and Forge direction chat · **Design of record read:** `Command Center - Round 5 - The Final Pass v2 (standalone).html`, committed unchanged beside this report as `docs/design/20261125_COMMAND_CENTER_PORTFOLIO_HUB_MOCKUP.html` (2,482,528 bytes, SHA-256 `d2e4c95a16c28cb70520a4abbd28a4360e6bfb25f9be043ecad26b11c8e01d02`).
**Also read:** the Practice Field chat's answers to direction note V4 (25 Nov) and the stock research modal chat's reply with rulings PC-1 to PC-9 (25 Nov).

## Session open (BUILD_RULES §2, §3)

| | |
|---|---|
| Fetch | `git fetch origin` was the first step. `origin/main` = `1cb1c627` (#1113). |
| Branch | `claude/command-center-portfolio-hub-phase0-5acd3a` (the session's worktree branch, cut from `origin/main`). It is pushed as `claude/command-center-portfolio-hub-phase0`, the branch the brief names. |
| HEAD at open | `1cb1c627c2e3e7c02e7e9de9d0ffb4ef1ab870f7`, the same as `origin/main` |
| Tree at open | clean |
| Writes | Two new files only: this report and the design file. No code, flag or test change. No Firestore read or write, no model call, no EODHD call. |

**How to read the citations.** A plain `file:line` was read by me in this session (VERIFIED). A citation marked **[S]** was read in this session by one of two read-only subagents and not re-read by me. Where I spot-checked an [S] claim, the mark is dropped. Nothing here is ASSUMED unless it says so.

**How the design was read.** The file is a Claude Design bundle. I unpacked its manifest (34 app modules) to a scratch folder outside the repo and read the JSX. I then rendered the untouched file in headless Edge (playwright-core 1.61.1, `file://`): 50 frames drew with no page errors. Every frame's text and labels came out of that render. The scripts, the unpacked sources and the per-frame text sit in the session scratchpad, not in the repo.

---

## 1. In plain terms

- **Most of what the design puts on the Overview already exists.** The book line, the desk rows, the positions table grouped by slot, the entering rows, the sold rows and the "Marks as of the close" stamp are all on `main`, drawn by the Idea book screen from one read-only route. That screen's parts are exported, use the same colour tokens as the hub, and could be mounted inside the hub. The one exception is the result sheet, which needs a new host.
- **Three things on the first screen need new fields from the server.**
  - **The split bar.** The view carries no shares and no use. Every money figure arrives as finished text, and the client may not do money arithmetic (ruling B3-1).
  - **The archetype's figure.** The view names the archetype only inside a sentence ("Diversifier · Short") and carries no id to dress the armor.
  - **Partnership's record counts.** History stops at 20 ideas.

  These are additions to the book route the Practice Field chat built. They ship with the client's version bump in one change.
- **The two-agent band can be drawn.** The engine already draws several figures from one WebGL context. A second live figure has been measured only on a laptop (two live: about 5.8 ms a frame), never on a phone and never in the hub.
- **The pulse is not first-build work.** As drawn, it needs timers, element animations, a resize observer and layout reads. The hub's guards forbid all of these. A coloured pulse also needs to know when the player last looked. Nothing records that, so it would take a new write.
- **The fold is a re-layout, not a new tab row.** For a player with a book, the band replaces the hero, the four tabs replace both today's phone tabs and the desktop's area list, and the Loadout tab disappears. The loadout is reached from the game strip. The design gives no place to today's Games history, Recent activity, Brief or Huddle chip. That needs a founder decision.
- **Some of the design's words fail the hub's copy guard, or the facts.**
  - "What Atlas remembers…" uses a banned word.
  - "Saved. Your agent may draft from it at a close." is not true while saved theses are off.
  - The band puts the agent's name beside "ideas". The guard cannot see that, because it only knows the words "agent" and "Shadow".
  - The design's "sold at its stop" is "sold at its line" in the built book.
  - The design's check "The extension guard" is built as "Within the stretch limit".
- **Waits, and on whom.**
  - Setups, plans and "plan followed" wait on the Practice Field chat (S1, S2, epoch 2).
  - A row opening the new modal waits on the modal chat (PC-1; the hub's door into the new modal is theirs).
  - The plan's numbers wait on the BaggerBomb revamp chat (PC-9).
  - Changing the archetype and setting the split wait on epoch 2.
- **Before setups exist, the Setups tab can truthfully show only a few things:**
  - the archetype desk's own idea, note and drafts;
  - the names and checks of the two code-checked strategies.

  No client route can list a session's valid setups. The one read route answers one stock per call. 131 of the book's 136 priced names are in the 228-stock setup store.

---

## 2. The first build

### 2.1 The brief's table, row by row

| Brief says "in the first build" | Verdict | Why (`file:line`) |
|---|---|---|
| The two-agent band, archetype shown, no control to change it | **Confirmed, with a field** | The agent's given name is on the client already: `CommandCenterHub.jsx:907` (`rankedAgent.name`). The status lines are counts of the view's `groups` by desk and state (`bookView.js:429-486`). The archetype's name exists only inside `desks[].lane` (`bookView.js:591`), and the armor needs its id: **new field `archetype { codeId, name }`** on `GET /api/practice-field/book`, read from `book.archetypeCodeId` (`bookViewRead.js:141-142`). The design's "Change" button on the Setups tab and the archetype sheet's list must not ship. |
| The split bar, read-only | **Corrected: needs fields** | The view has no share, no use and no numeric money (`bookView.js:5-6`, `:775-785`; [S] no `slotCapShare` or `epoch` in `bookView.js` or `bookViewRead.js`). The shares are frozen in the epoch (`src/data/practiceFieldSlots.js:28`, `:30` [S]; `ideaBook.js:102`, `:76` [S]). **New field `split`**, computed on the server. "In use" needs a definition first (founder question FQ-2). |
| The four tabs | **Confirmed, as a re-layout** | Today the phone has Overview · Research · Partnership · Loadout (`hubCopy.js:120-125`; ids [S] `composition.js:66-77`) and the desktop has a three-area tablist (`hubCopy.js:113`; [S] `AreaControls.jsx:24-85`). The book layout replaces both, the band replaces the hero box, and the phone armory loses its home (it opens inside the hero's box, [S] `Armory.jsx:499`). Section 2.2 maps every built section. |
| The Overview as the built positions table | **Confirmed, with two changes** | `PosTable`, `BookLine` and `Strip` are exported (`IdeaBookScreen.jsx:277`, `:36`, `:128`) and use the app tokens (`ideaBookStyle.js:12-26`). Two changes are needed. First, `PosTable` always draws a Cash row (`IdeaBookScreen.jsx:369-371`), which the design removed (`cash={false}`, design `ccp5-parts.jsx`). Second, the layout comes from the window (`IdeaBookScreen.jsx:526-535`, `ideaBookCopy.js:48`), so inside the hub it must come from the container. |
| Ideas and Partnership, with History | **Partly confirmed** | Ideas: the research door is built (`hubCopy.js:313-327`). "In the portfolio", "Finished" and "What each desk considered" are drawable from `groups`, `history.items` and `desks[].passed` (`bookView.js:603-608`). Partnership: the design's "Standing research preference" panel is **not built** (no string in `src/`; the built panel is the reserved line, `hubCopy.js:128-133`). The record's counts need a server aggregate, because History is capped at `HISTORY_LIMIT` = 20 (`bookView.js:68`). History with the Ideas filter is built (`IdeaBookScreen.jsx:511-521`); the Tests filter has nothing to filter. |
| The side-light pulse | **Corrected: not in the first build** | The design's pulse uses `setTimeout`, `setInterval`, `useLayoutEffect`, `ResizeObserver`, `getBoundingClientRect`, `element.animate` and `matchMedia` (design `ccp3-pulse.jsx:7-57`). The mount guard bans timers, observers, effects and `matchMedia` in the hub directory (`commandCenterHub.mount.guard.test.js:699-709`), along with device reads (`:754`), frame reads (`:934`) and CSS motion (`:1287`, `:1331`). A coloured beat also needs a "last looked" record. None exists (Part D3), so it needs a write. See FQ-3. |
| The docked game strip, unchanged | **Confirmed** | The phone strip is `DeployStrip.jsx` [S] (`:1-40`). On the desktop the design draws the same content as a card in the Overview's right column ("Take it into battle"), in place of today's side-column Deploy section ([S] `CommandCenterHub.jsx:661-690`). |

**The "not in the first build" column is confirmed as written.** Five more items belong in it:

- Needs you's "result" item and its "2 more" list. A result has to stay until it is read, which needs a write.
- The "forge" item. The next action has no Forge kind (`hub/nextAction.js:34`).
- The archetype sheet's six-archetype list with record counts. Nothing stores those counts.
- The split presets.
- Support Rebound, Failed Breakdown Recovery and "No Recognized Setup". None of the three exists anywhere in `src/` or `api/` (grep).

### 2.2 Where today's hub goes, for a player with a book

| Built today | In the design's book layout | Note |
|---|---|---|
| Header: date · player name (`hubCopy.js:66-69`) | Date · "Market open" or "After hours" | `getMarketState` is already in the hub ([S] `useHubReaders.js:51`, `:152`). The hub has no tick, so the word changes only on a re-render. |
| The hero (agent form) and the status line ([S] `ShadowStage.jsx:125-188`) | The band: two figures, two status lines, the split bar | The live region moves with it. |
| Wide area tablist / phone tab row | The four tabs | Loadout is no longer a tab. |
| Next action: open game, review, deploy, Huddle ([S] `nextAction.js:34`, `huddleView.js:13`) | Needs you (game, review); the strip (deploy) | The Huddle has no place drawn. |
| Games: live rows, "Reviews available", the Game history row with the record ([S] `PhoneTabs.jsx:85-135`) | Not drawn | **FQ-1** |
| Recent activity (with the Idea book card above it, `ActivitySection.jsx:90`) | Not drawn | **FQ-1**. The card would duplicate the Overview, so it goes (Part F). |
| Daily brief (`BriefSection`) | The agent's sheet, "Today's brief" | — |
| Research area: Work an idea, Continue (`hubCopy.js:313-327`) | Ideas tab, "Being worked" | — |
| Partnership area: the reserved line or the Huddle plan ([S] `PartnershipPanel.jsx:22-40`) | Partnership tab | The design's preference panel is not built. |
| Loadout area and the phone armory | The strip's "Open loadout" | The armory needs a sheet home on the phone. |
| Docked strip (phone) / Deploy card (wide) | Unchanged / a card in the right column | — |

### 2.3 Slices, in build order

None of these slices touches a fenced file (BUILD_RULES §1). The fence lists only agent, trading and scoring modules; no `practiceField`, `PracticeField` or `CommandCenter` file is on it. Every slice calls no fenced function.

| # | Slice | Adds | Changes | New field (route) | Guard rows it adds |
|---|---|---|---|---|---|
| 0 | **The view's new fields.** One PR, server and client together, because the client refuses any view version it doesn't know (`useIdeaBook.js:21`, `:46`). Owner: the Practice Field chat's module, built by whichever build needs it first. | — | `api/_utils/practiceField/bookView.js`, `bookViewRead.js`, `bookViewCopy.js` (if FQ-5 renames the desks), `src/components/PracticeField/useIdeaBook.js` (version 2 → 3), and their tests | `archetype { codeId, name }`; `split { shadow { sharePct, usePct }, archetype { … }, cashPct }`, from the epoch's rails and the last close's marks; later, `record` (counts by source over every finished idea) for slice 4 | `bookView.test.js` rows for each field; a §9 display-agreement row (use comes from the same cents the table shows); a version-mismatch row on the client |
| 1 | **The flag and the one read at the shell.** The hub reads the book once and decides the layout: `FLAG && read.status === 'ready' && read.book !== null`. The entry card takes that read instead of making its own. | `src/config/commandCenterPortfolioFlags.js` (zero imports, `false`), its pin test | `CommandCenterHub.jsx` (ConnectedHub), `sections/ActivitySection.jsx`, `PracticeField/IdeaBookEntry.jsx` (takes the read as a prop), `src/config/flagPinGuard.test.js` (`FLAG_SOURCE_MODULES` `:45`, `DARK_BY_DESIGN` `:75`), the mount guard (a terminal or export row for the read) | none | flag pin; flag-off identity (Rollup folds the literal, as B3's switch does); the mount guard's export row; a jsdom row: no book → today's hub |
| 2 | **The band.** Two figures, two status lines, the read-only split bar. | `CommandCenter/BookBand.jsx`, `hub/bookBandModel.js` (pure) | `hubCopy.js` (a `book` block), `CommandCenterHub.jsx`, `ShadowStage.jsx` (the hero's place) | uses slice 0's `archetype` and `split` | copy exact-string rows; the name-pairing row (FQ-4); a purity row for the model; the engine's view count in the harness |
| 3 | **The tab row and the Overview.** | `CommandCenter/sections/BookOverview.jsx` | `PhoneTabs.jsx`, `hub/composition.js` (tab ids), `CommandCenterHub.jsx` (wide body), `hubCopy.js`, `PracticeField/IdeaBookScreen.jsx` (a `cash` option and a `layout` passed in) | none | mount guard terminal or export rows for `IdeaBookScreen.jsx`; jsdom rows for tab order and roving keys; real-layout harness shots at 320, 390 and 1440 |
| 4 | **Ideas and Partnership.** | a result sheet hosted by `HubSheet` | `hub/useHubSheets.js` (`HUB_SHEETS`, [S] `:40-54`), `panels/ResearchPanel.jsx`, `panels/PartnershipPanel.jsx`, `hubCopy.js` | `record` (slice 0b), if FQ-6's Partnership counts ship | overlay-stack rows for the new sheet; copy rows |
| 5 | **Setups, as FQ-7 decides.** | `CommandCenter/panels/SetupsPanel.jsx` | `hubCopy.js`; a new terminal for the check names (`src/components/Research/ChartRead/chartReadCopy.js`) | none for the minimal version | copy rows; the mount guard terminal row |
| — | Later, not first build: the pulse (needs a write and a guard allowance); the modal door (modal chat, PC-1 to PC-3); setups and plans (Practice Field S1/S2); presets and the archetype change (epoch 2) | | | | |

**Sizing note.** Slices 1 to 3 together touch about 14 files plus tests. That crosses the review threshold (10 files, BUILD_RULES §2), so either keep each slice its own PR or plan the multi-lens review into the build.

### 2.4 The flag

**`COMMAND_CENTER_PORTFOLIO_HUB_ENABLED`**, in its own zero-import module `src/config/commandCenterPortfolioFlags.js`, shipped `false`. It follows the pattern of `practiceFieldScreenFlags.js:13-25`.

- It has to be registered in the flag-pin guard's `FLAG_SOURCE_MODULES` (`src/config/flagPinGuard.test.js:45`, which already lists `practiceFieldScreenFlags.js` at `:65`). Until the flip it belongs in `DARK_BY_DESIGN` (`:75`).
- **Off-state:** today's hub, unchanged. The Idea book card stays in Recent activity, the hub makes no layout decision, and Rollup folds the literal away as it does for the B3 switch (`ActivitySection.jsx:16-19`, `:90`).
- It also needs `PRACTICE_FIELD_SCREEN_ENABLED` on (`practiceFieldScreenFlags.js:25`, true), because the route answers 404 without it (`api/practice-field/book.js:35`).

### 2.5 Founder questions, only where a fact forces a choice

| # | Question | The fact that forces it | Recommendation |
|---|---|---|---|
| FQ-1 | For a player with a book, where do today's Games history row (with the record), Recent activity and the Huddle chip go? | The design's Overview draws none of them (state 7 ends at the table). | In the first build, keep them under the table on Overview, as today, until the designer draws their place. Nothing a player uses disappears in the first build. |
| FQ-2 | What does "in use" on the split bar measure? | The design's state 1 shows Atlas at 36%. The Practice Field answers give $58,301 of $69,933 (83%) for the same day. The design draws an entering idea as 0% in use. | The marked value of the desk's held positions at the last close ÷ (its share × the book's marked equity), computed on the server. Entering ideas count 0. |
| FQ-3 | Does the first build carry any pulse? | Every mechanism the pulse uses is banned in the hub directory. "Since you last looked" needs a write that doesn't exist. The strip covers only the last close ([S] `bookView.js:516-561`), so a player who missed two closes would see one. | No pulse in the first build. A later slice brings the still version (state 8) with a founder-approved "last looked" record. |
| FQ-4 | May the hub put the agent's name beside ideas when the book backs it ("Atlas, your research partner. 2 ideas running")? | Rulings R-S6-6 and Q-S6-1 fence the pairing (`hubCopy.guard.test.js:334-343`). The guard can't see a name, because it calls copy functions with `ARG0` (`:160-166`). | Yes, for counts and states the view carries. No sentence about reading, learning or using ideas. Add a guard row that substitutes a real name, so the fence keeps its teeth. |
| FQ-5 | Do the desks become "{name}'s desk" and "{archetype}'s desk", and is a code sale "at its line" or "at its stop"? | The names are server words (`bookViewCopy.js:41-44`, `OPEN_SLOT` `:102-105`, `STRIP.soldAtLine` `:125`, `NAME_SENTENCES.soldAtLine` `:67`). The same view feeds the Idea book screen. The book's word is "line"; the design's is "stop". | Rename the desks in the server's words in slice 0, so one name holds everywhere. Keep "line" until a plan with a stop exists (Practice Field S1). The modal already draws "its line · code sells below". |
| FQ-6 | Does Partnership's record ("Your ideas … 2 ahead · 1 behind") ship in the first build? | It needs a count over every finished idea. The view reads only 20 (`bookViewRead.js:127`). | Not in the first build. Ship History (the Ideas filter) and the built panel. Counts come with slice 0b. |
| FQ-7 | What does the Setups tab show before setups exist? | Part H. | The archetype desk's own short idea, its note and its drafts (all ready), under a plain "Setups arrive later" line. Show no strategy cards until a strategy and plan are on the record, because the cards' four facts are unmeasured (Practice Field answers Q4). |
| FQ-8 | What does a row tap open in the first build? | The design says "Open its chart", which needs the modal door (PC-1, the modal chat's). The built book opens the name or idea detail in place ([S] `IdeaBookScreen.jsx:305-306`, `:332-333`). | The built in-place panels, until the modal door ships. |
| FQ-9 | The first paint for a book owner. | The client learns whether the player has a book only when the read answers, so today's hub draws first and the book layout replaces it. Loading and error states are undrawn. | Accept one switch per page load. Never show a skeleton band to a player who may have no book: that would change today's hub for them. |

---

## 3. Part A — the hub as built

### A1. Map of `src/components/CommandCenter/`

| Part | What it is | Cite |
|---|---|---|
| `pickDashboardShell.js` | A pure picker. It returns the hub only when the hub flag is on. App calls it once. | [S] `:58-68`; [S] `App.jsx:8980` |
| `CommandCenterHubGate.jsx` | The lazy gate: `lazy(() => import('./CommandCenterHub'))`, a Suspense skeleton, and the legacy shell under a notice if the load fails | [S] `:287`, `:257-281` |
| `hubChrome.js` | Two predicates for App: `hubOwnsDashboard` and `forgeAreaOf` | [S] `:50-63` |
| `CommandCenterHub.jsx` | The lazy hub. `ConnectedHub` is keyed by site; it renders `PhoneHub` or `WideHub`, and the sheets. | [S] `:964-979`, `:399-584`, `:587-793`; read `:660-760` |
| Stage | `ShadowStage.jsx`: name line, hero box, status line (the hub's one live region), area controls. Each hero is the literal ternary `AGENT_FORM_HUB_ENABLED ? HubAgentForm : ShadowCanvas`. | [S] `:125-188`, `:170-174` |
| The agent's form | `HubAgentForm.jsx` over the `AgentForm` wrapper; `ShadowCanvas`/`ShadowStill` are the flag-off path | [S] `HubAgentForm.jsx:44-109` |
| Areas | `HUB_AREAS = { PARTNERSHIP: 0, RESEARCH: 1, ARCHETYPE: 2 }`, named "Partnership · Shared Research · Equipped Archetype", short names "Partnership · Research · Loadout". Panels: `AreaPanel`, `PartnershipPanel`, `ResearchPanel`, `LoadoutPanel`. | [S] `composition.js:62-63`; `hubCopy.js:110-118` |
| Phone tab row | `PhoneTabs.jsx`: a sticky tablist with roving keys; tabs overview · research · partnership · loadout; the Overview shows games, next action, reviews, history row, activity and brief | `PhoneTabs.jsx:85-135`; `hubCopy.js:120-125` |
| Next action | `NextActionCard.jsx`; kinds `openGame`, `review`, `deploy` (+ `huddle`) | `nextAction.js:34`; [S] `huddleView.js:13` |
| Activity | `ActivitySection.jsx` with the Idea book card above it; `activityRows.js` kinds completed, deployed, loadout, idea, huddle, research | `ActivitySection.jsx:19`, `:73-91`; [S] `activityRows.js:61` |
| Deploy / strip | `DeploySection.jsx` (wide, has the hold); `DeployStrip.jsx` (phone, fixed above the nav at z 40) | [S] `DeployStrip.jsx:1-40`; [S] `hubStyle.js:57` |
| Sheets | `HubSheet.jsx` (dialog on wide, bottom sheet on phone, portal, focus trap); `useHubSheets.js` sheets: history, activity, record, archetype, watchlist, traits, scouting, huddle, research | [S] `HubSheet.jsx:1-47`; [S] `useHubSheets.js:40-54` |
| Overlay stack | `hub/overlayStack.js` (reference-counted inert marks, focus return), `HubOverlays.jsx` (the provider) | [S] `overlayStack.js:1-49`; [S] `HubOverlays.jsx:27-67` |

**Phone and desktop.** `site` comes from App's `isMobile` (768 px and under). A desktop composition is chosen by width: 1080 and up is desktop, 700–1079 is tablet, under 700 is stacked ([S] `composition.js:19-24`, `:53-59`). The phone has its own scroll pane, a tab row, one panel and the strip. Wide layouts share one CSS grid with a stage, a panel and a side column ([S] `CommandCenterHub.jsx:85-92`, `:277-311`; read `:692-711`).

### A2. Flags the hub reads (values on `main`)

| Flag | Value | Defined |
|---|---|---|
| `COMMAND_CENTER_HUB_ENABLED` | true | [S] `featureFlags.js:3587` |
| `AGENT_FORM_HUB_ENABLED` / `AGENT_FORM_ARMORY_ENABLED` | true / true | [S] `agentFormFlags.js:50` / `:101` |
| `PER_GAME_LOADOUT_ENABLED` | true | [S] `perGameLoadoutFlags.js:39` |
| `DRB_HUDDLE_ENABLED` | true | [S] `huddleFlags.js:47` |
| `SHARED_RESEARCH_MODE` | `'allowlist'` | [S] `sharedResearchFlags.js:50` |
| `CASUAL_CLONE_CONCURRENCY_ENABLED`, `HYPOTHESIS_RECORDS_ENABLED`, `RELEASE3_CHARACTER_TAB_ENABLED`, `SCOUTING_BOARD_ENABLED` | true | [S] `featureFlags.js:260`, `:3320`, `:103`, `:1048` |
| `LEAGUE_HIDE_ENABLED` | false | [S] `featureFlags.js:152` |
| `PRACTICE_FIELD_SCREEN_ENABLED` (as `IDEA_BOOK_SCREEN_ON`) | true | `practiceFieldScreenFlags.js:25`; `IdeaBookEntry.jsx:25` |
| Hub constants `PHONE_SHADOW` / `AGENT_FORM_PHONE` | `'canvas'` / `'live'` | [S] `hub/hubFlags.js:64`, `:73` |

### A3. Guards that pin the hub

| Guard | Rows | What it forbids |
|---|---|---|
| `commandCenterHub.mount.guard.test.js` | **73** (70 `it` plus one `it.each` over 3 keys; I counted the `it` and the `each`) | Any `src/` edge into the hub except the 11 permitted ones ([S] `:1129-1141`: App to the gate, picker and chrome; the attempt context to five hub selectors; two lazy edges). Any hub import leaving the directory except to the **55 permitted terminals** (`:564-671`; the Idea book card is one, `:670`; `marketSchedule.js` is one, `:585`) and the agent-form wrapper. Timers, listeners, observers, effects, storage and `matchMedia` (`:699-709`). URL switches (`:715-718`). Device reads (`:754`) and frame reads (`:934`). CSS transitions and animations (`:1287`, `:1331`). Raw colours. Unpinned exports from shipped modules ([S] `:1396-1523`). |
| `hubCopy.guard.test.js` | **50** | Copy written outside the three copy tables (`:51`). The 18 banned claims, `learn` … `illustrative`, including `remembers`, `Tester` and `grow` (`:413-417`). Any string pairing `agent`/`shadow` with `idea` except the founder's four honest lines (`:178-183`, `:334-343`). Door strings naming Shadow (`:404-409`). Numerals other than the pinned ones [S]. |
| `hubCopy.huddle.guard.test.js` / `hubCopy.s4.guard.test.js` | **9** / **15** | Huddle voice rules; S4 words, the banned list plus `events`, `history of`, `log` [S] |
| `commandCenterHub.activity.guard.test.js` | **25** | Pins each file's effects, timers, listeners and observers, call by call [S] |
| `commandCenterHub.gateHub.guard.test.js` | 4 [S] | The gate touches `hub` only as `<Hub hub={hub} />` |
| Entry chunk | 3 + 24 [S] | No test reads `dist/`. The rule is structural: only the gate's `import()` names the hub (mount guard [S] `:470-476`). `CommandCenterHubGate.chunk.jsdom.test.jsx` (3 rows) checks that importing the gate evaluates no hub module. `agentForm.flagOffBundle.test.js` (24 rows) builds in memory and checks the flag-off tree-shake. |

Other guards name the hub too: the selector, review-scheduler and S4 purity guards (8, 3 and 3 rows [S]). Outside the directory: the motion and token guards' file lists, Explore's and Shared Research's boundary tests, and the per-game loadout reader census [S].

### A4. The agent's form

- **How it loads.** `HubAgentForm` imports the `AgentForm` wrapper statically. The engine and three.js come only through `loadEngine.js`'s `import('./engine/index.js')`, once per page. There is one engine per page ([S] `loadEngine.js:8-10`, `engine/index.js:13-19`). The output chunk names were not determined (no `manualChunks`) [S].
- **"Tiers".** There is no tier table. The levers are the rate (`live`, `half`, `still`), bloom (`filter`, `css`, `webgl`, `off`; the hub uses `css`, drawn only at 160 px and up), batched plates, a forced still under 40 px, and pixel-ratio caps ([S] `engine.js:43`, `:80`, `:273`, `:63-66`; `agentFormSpec.js:95-100`). The legacy Shadow's low, mid and high tiers belong to the flag-off canvas, which `main` does not draw [S].
- **A slow phone.** There is no automatic step-down. The engine does no frame-cost self-downgrade, and the mount guard bans frame and device reads ([S] `engine.js:15-18`; `:926-944`). The phone rate is the hand-set constant `AGENT_FORM_PHONE = 'live'` ([S] `hubFlags.js:73`). The decision rule on record is "live at ≥55 fps over 60 s and p95 ≤ 8 ms, else half, else stills" ([S] `docs/audits/20261102_PHASE0_ARMORY.md:297`).
- **Reduced motion.** The hub reads framer-motion's `useReducedMotion` ([S] `CommandCenterHub.jsx:219`) and hands it to the form. The engine then draws one still frame on its live canvas; swaps and equips become instant ([S] `engine.js:183`, `:309`, `:471-474`).

---

## 4. Part B — the Idea book as built

### B1. Where it lives and the ways in

The screen is `src/components/PracticeField/IdeaBookScreen.jsx`, drawn in a full-window layer over the app: a portal on `<body>`, with `#root` made inert (`IdeaBookEntry.jsx:50-65`). **There is one way in:** the entry card. The card is rendered at one site, above Recent activity (`ActivitySection.jsx:19`, `:90`), and it appears only when the read returns a book (`IdeaBookEntry.jsx:106-118`). Both the phone Overview and the wide side column draw Activity (`PhoneTabs.jsx:132`, `CommandCenterHub.jsx:691`), so the card shows on both.

### B2. The route and the view

`GET /api/practice-field/book` (`api/practice-field/book.js:32-51`) builds the view with `buildBookView` (`bookView.js:707-786`), version 2 (`:66`). Every money and percent value arrives as a display string (`:5-6`).

| Group | Fields (`bookView.js` unless noted) |
|---|---|
| Top level | `version`, `day`, `asOf { session, text }`, `line`, `strip`, `groups`, `cash`, `desks`, `history { empty, items }` (`:775-785`) |
| The book line | `value` (null while waiting), `waiting { text, reason }`, `today { text, short, dir, pct }` or `{ waiting }`, `first { kind 'opens'/'since', label, value, dir }`, `spy { label, value, since? }`, `cash`, `paused`, `windingDown`, `statusLine`, `smallPrint` (`:757-768`) |
| The desk rows (the strip) | `{ desk, deskName, failed, text }`, for the last close's session only, archetype desk first (`:516-561`, `:76`) |
| The slot groups | Every group: `slot, slotName, slotLabel, desk, deskName` (`:432`). Then by state: `open` (`text`, `names: []`, `:434`); `entering` (`thesis, source, line, gap: null, call: null, names, namesText`, `:439-444`); `holding` bought after the close (`:463-465`); `holding`/`selling` (`line, day, of, sessionsLeft, sessionsLeftText, progress, gap, call, names, namesText`, plus `selling { word, rest }`, `:468-482`); `settled_today` [S] (`:487-504`) |
| A position row | `held`: `symbol, isNew, mark, plOpen { text, short, dir }, plDay, shares, positionValue, entry, line, distance { text, near, gauge }`. Other states: `line_hit`, `waiting` (`text, waitingReason`), `bought_today`, `delisted` [S] (`:306-362`) |
| An entering row | `{ symbol, state: 'entering', text: 'Buys at the next session’s first window', isNew: false }` (`:442`; `bookViewCopy.js:18`) |
| A sold row | `{ symbol, isNew, state 'sold'/'sold_line', text, mark: null, entry, line }`. The text is "Sold at its line by code · {date}" ([S] `:272-284`; `bookViewCopy.js:67`). |
| A finished idea | `namesText, slot, slotName, slotLabel, desk, deskName, ended, endedOn, thesis, source, gap, notMeasurable, columns[5], lastCall` (`:657-686`) |
| A desk's note | `{ failed, text, date }` or null (`:592-594`) |
| What a desk considered | `passed { tally, drafts[{ names, thesis, date, outcome, why }] }`, built only when the desk's part came from the model; admitted drafts included (`:575-585`, `:601-608`) |

**No id leaves the view.** Groups are keyed by slot, names by symbol, desks by desk (`bookView.js:41`).

### B3. The admission check

- **Server** (`book.js:33-42`), in order:
  1. the security middleware, 30 requests a minute;
  2. `no-store`;
  3. screen switch off → 404 before auth;
  4. Firebase token → uid;
  5. `practiceFieldAdmits(uid)` → the same 404;
  6. GET only.
- With `PRACTICE_FIELD_MODE = 'allowlist'`, a uid is admitted only if it is on the cockpit allowlist ([S] `mode.js:52-58`; [S] `practiceFieldFlags.js:34`). The reader also requires the player's own open idea book ([S] `bookViewRead.js:53-61`).
- **Client** (`useIdeaBook.js:58-106`): it reads only while the switch is on, keyed by uid and auth epoch. A 404 is a settled "off". A failed read keeps the last good answer. There is no poll; it reads again on focus.

### B4. The three tabs and what could be mounted in the hub

| Tab | Components (`IdeaBookScreen.jsx`) | Inside the hub unchanged? |
|---|---|---|
| Positions | `BookLine` `:36`, `Strip` `:128`, `PosTable` `:277`, `NamePanel` `:220`, `IdeaPanel` `:233` | **Yes, with two options added:** the Cash row (`:369-371`) must be optional, and the layout must come from the container, not the window (`:526-535`) |
| Desks | `DesksTab` `:431` | Yes |
| History | `HistoryTab` `:511` and `ResultSheet` `:460` | `HistoryTab` yes. **`ResultSheet` no.** It is `position: fixed; zIndex: 2` (`:471`) and relies on the screen's own inert wrapper (`:626`). In the hub it would sit under the strip (z 40) and the sheets (z 1000) and skip the overlay stack. It needs a `HubSheet` host. |

All of them draw with the same `--ft-*` tokens as the hub (`ideaBookStyle.js:12-26`).

### B5. What a tap opens today

| Tap | Opens | Cite |
|---|---|---|
| A slot header | The idea's detail (`IdeaPanel`), in place on the phone or in the side panel on the desktop | `IdeaBookScreen.jsx:305-306`, `:364`, `:599` |
| A position | The name's detail (`NamePanel`) | `:332-333`, `:360`, `:599` |
| A desk row (the strip) | The Desks tab, focused on that desk | `:134`, `:561` |
| A finished idea | `ResultSheet`, the five-column result | `:442`, `:619`, `:630` |

---

## 5. Part C — the design, surface by surface

| # | Surface | What it shows | Where that data is today | Status |
|---|---|---|---|---|
| 1 | Band, left | The agent's given name; "your research partner"; a status line such as "1 idea running · 1 entering" | Name: `CommandCenterHub.jsx:907`. Role: `hubCopy.js:84`, but the stage line "Shadow · your research partner" is pinned (`hubCopy.guard.test.js:273`). Status: counts over `groups` (`bookView.js:429-486`). | **ready** (a pinned string moves) |
| 2 | Band, right | The archetype's name and armor; "runs your short slot"; a status line such as "4 names entering" | The name only inside `desks[].lane` (`bookView.js:591`); the code id stays on the server (`bookViewRead.js:141-142`) | **needs a field:** `archetype { codeId, name }` on `GET /api/practice-field/book` |
| 3 | Split bar | Each desk's share and use, and cash | Nothing in the view. The epoch's rails and the daily rows hold the inputs ([S] `ideaBook.js:102`; [S] `close.js:1404-1406`). | **needs a field:** `split` on the same route (FQ-2) |
| 4 | Tab row | Overview · Ideas · Setups · Partnership | The phone's four tabs and the wide tablist exist with other ids (`hubCopy.js:113-125`) | **ready** (re-layout) |
| 5 | Book line | Value, today, "Since", SPY, cash, the paper-money line | `view.line` (`bookView.js:757-768`); `BookLine` (`IdeaBookScreen.jsx:36`) | **ready** |
| 6 | Needs you | One item and "N more". Kinds drawn: result ("A result is in · Read it"), game ("Open game"), review ("Open the Film Room"), forge | Game and review are next-action kinds (`nextAction.js:34`). A result is drawable only on the session it settles (`settled_today` [S] `bookView.js:487-504`). Forge has no kind. "N more" has no list. | game/review **ready**; result **needs a field and a write** (read state); forge **not built** (Forge, hub owners); "N more" **not built** (undrawn) |
| 7 | Desk rows | "Trend Follower’s desk · admitted PG, DUK, HON, MSFT", "… entered DE · held 2", "PH sold at its stop by code", "held 2 · waiting for a valid setup" | `view.strip` (`bookView.js:516-561`). Built words: "opened", "admitted", "held N", "called Exit on", "sold at its line by code", "passed on N drafts" (`bookViewCopy.js:118-128`). Desk names: "Archetype desk", "Shadow desk" (`:41-44`). | **ready** for the built words; "entered", "stop" and "waiting for a valid setup" are **not built** (FQ-5) |
| 8 | Table | Slot header (name, state, gap vs fund); position (Mark, P/L Open, P/L Day); entering ("Buys at the next session’s first window"); sold by code | `PosTable` (`IdeaBookScreen.jsx:277-375`); `groups`/`names` (§4 B2) | **ready**, except the sold row's "stop" (FQ-5). The built table also draws states the design doesn't: open slot, waiting on data, bought today, below the line, delisted, selling, NEW, near the line, the desktop's "To its line" |
| 9 | A setup row's second line | Strategy name, plan bar, "Day N" | No strategy or plan on any record ([S] the Practice Field answers Q4; `bookView.js` has no such field) | **not built:** Practice Field S1 (the record), BaggerBomb revamp chat (the plan's numbers, PC-9), this chat's modal (the drawing) |
| 10 | Ideas tab | Being worked (a story, an observation "Saved. Your agent may draft from it at a close."); in the portfolio (per slot: thesis, day, call, nearest line); finished; what each desk considered | Being worked: the research door (`hubCopy.js:313-327`), one investigation, not story or observation cards. In the portfolio: `groups[].thesis/line/call/names[].distance`. Finished: `history.items`. Considered: `desks[].passed`. | in the portfolio, finished, considered: **ready**. Being worked: **partly built**. The observation line is **false today** (theses off, [S] `practiceFieldFlags.js:66`). |
| 11 | Setups tab | Who runs the short slot (with "Change"); tests with the plan chart; "Up next"; four strategy cards with facts, "Checked by code" and record | The two code-checked strategies' names and checks: `chartReadCopy.js:125`, `:166-176`. Nothing else exists: no tests, no queue, no facts, no records, and no Support Rebound or Failed Breakdown Recovery (grep). | **not built** (Practice Field S1/S2 and epoch 2). See Part H for what is truthful now. |
| 12 | Partnership tab | A standing preference (confirmed, source, later use, Inspect, Edit, Withdraw); counts by where an idea came from; History with Ideas and Tests filters | Preference: no such string or record in `src/` (grep). The built panel is the reserved line (`hubCopy.js:128-133`). Counts: per-idea `source` exists (`bookView.js:673`), but only 20 are read. History: `HistoryTab`. | preference **not built** (owner: the Partnership/Shared Research line of work); counts **needs a field** (`record`, FQ-6); History (Ideas) **ready**; Tests **not built** |
| 13 | Agent's sheet | Today's brief; "Worth exploring" (three stories); "Its desk · Runs your medium and long ideas · 2 running" | Brief: `BriefSection` / `useDailyRegimeBrief` (a terminal). Stories: `useHubStories` (`CommandCenterHub.jsx:180`, `:847`), loaded for research-admitted players only. Desk line: counts over `groups`. | **ready** (stories only where research is admitted) |
| 14 | Archetype's sheet | Six archetypes, each with a stop style and a closed-test count; "Open Setups" | No per-archetype test counts and no stop-style lines (grep) | **not built** (Practice Field: epoch 2 and the record) |
| 15 | Split sheet | Three presets, "Now", "10% is always cash." | Fixed shares, no presets ([S] the Practice Field answers Q6) | **not built** (epoch 2) |
| 16 | Docked game strip | "Battles as {archetype} · thesis · list · Hold to deploy", a live game, "Deploy unavailable · capacity…" | `DeployStrip.jsx` / `DeploySection.jsx` [S] | **ready** |

---

## 6. Part D — the pulse

**D1. Two figures on one screen: yes.**
- One WebGL renderer feeds every agent canvas on the page, and views share a context ([S] `engine.js:4-5`, `:92`, `:403-407`). The hub already draws several: the live hero plus loadout stills, and the armory's live centre plus six sets ([S] `LoadoutCards.jsx:82`, `:127`, `:211`; [S] `Armory.jsx:270-300`).
- **The cost of a second figure, by rate:** no extra WebGL context. Each view adds three canvases and a slot div, plus an observer target. Geometry is shared by cache when the archetype matches ([S] `form.js:21-23`; `engine.js:143-158`).
  - **Live:** a render, a 2D copy and, at 160 px and up, a CSS bloom layer, every frame.
  - **Half:** the same work every other frame.
  - **Still:** one draw.
  - **Off screen or hidden:** nothing ([S] `engine.js:257-344`).
- **Measured, laptop only:**
  - one live hero 2.62 ms; two live at 230 px 5.83 ms (p95 9.30, 60 fps); two at half 5.03 ms ([S] `docs/audits/20261029_BUILD_AGENT_FORM_S0.md:105-124`);
  - one live plus six stills costs about the hero alone, 1.2–2.1 ms ([S] `docs/audits/20261102_PHASE0_ARMORY.md:272-293`).
  - Two live figures in the hub, and any phone figure, have never been measured. Slice 2 should measure before choosing the archetype figure's rate.

**D2. A market-hours signal: yes, as functions, not a hook.**
- `getMarketState()` and `isMarketOpen()` live in `src/utils/marketSchedule.js` ([S] `:108-169`), a permitted terminal (mount guard `:585`). The hub already reads `getMarketState` once per render ([S] `useHubReaders.js:51`, `:152`).
- The hub holds no tick, so it would not notice the open or the close until something re-renders it.
- The holiday and early-close tables cover 2026 only (`marketSchedule.js:12` TODO; [S] `marketHolidays.js:2-17`). See §13.

**D3. "A desk acted", and "the player last looked".**
- **Stored facts with times** (Firestore, all [S]):
  - the close row `windows/{session}_close` → `agent.desks.{shadow|archetype}` with `startedAt`, `completedAt`, `source`, `note`, `actions[{ideaId, action, outcome}]`, `considered[]` (`agentRun.js:153`, `:287-304`, `:484-507`);
  - on each idea: `admittedAt`, `statusHistory[{status, at}]`, `entry.filledAt`, `ledger.saleReceipts[{kind, sessionDate, at}]` (`line_exit` is code's sale at the line), `managerExit.decidedAt`, `liquidation.completedAt`.
- **The view carries day labels only, no instants.** The strip covers the last close's session alone (`bookView.js:516-561`).
- **A "last opened" record for the hub or the book: none exists.** I searched non-test `src/`, `api/` and the rules for some fourteen names, including lastSeen, lastOpened, lastViewed, seenAt, readAt and markSeen. The hits were unrelated: draft-room presence, sign-in time, the ledger's price "lastSeen" [S]. The route writes nothing (`book.js:16-17`). The hub's only stored keys are the sessionStorage Later keys ([S] `useHubLater.js:7`).
- **The smallest way to know,** and it needs a write:
  - The client stores, per uid, the last `asOf.session` label it showed. A desk "acted since you looked" when that label differs and the strip names the desk.
  - Browser storage is the smallest version. It works on one device only, and it needs a mount-guard allowance, because storage is banned in the hub directory except for the Later keys (`:708`; [S] `:1544`).
  - Across devices, it is a server write on the player's book claim. That is a Practice Field write path.

**D4. Reduced motion today.**
- There are three `useReducedMotion` reads and no `matchMedia` in the directory ([S] `CommandCenterHub.jsx:219`, `Armory.jsx:412`, `BaggerBombPage.jsx:141`).
- The value reaches the area and phone panels (`initial={false}`, the `instant` token), `HubSheet`, the history, activity, Huddle and research sheets, and the form, which draws one still frame ([S] `AreaPanel.jsx:71-76`, `PhoneTabs.jsx:144`, `HubSheet.jsx:93-117`).
- The design's still pulse (state 8: a held glow and a thin edge) would follow the same read.

---

## 7. Part E — the copy

### E1. Every player-facing string in the design

These come from the rendered frames, with drawn text and accessible labels kept apart. Numbers are folded to `#` and tickers to `{SYM}`, and each string is listed once, at the first surface that draws it. The canvas's own replay button and fold line are left out. There are 417 strings after folding (612 raw).

**Overview: header, band, split bar, tabs, book line, Needs you, desk rows, table, docked strip.**
- **Drawn:** “WED # NOV · MARKET OPEN” · “Command Center” · “Atlas” · “your research partner” · “# idea running · # entering” · “Trend” · “Follower” · “# names entering” · “Atlas #” · “# in use” · “Cash #” · “Trend Follower #” · “Overview” · “Ideas” · “Setups” · “Partnership” · “# today” · “Since # Nov” · “SPY” · “Cash” · “Paper money. Your agents run this book; you watch.” · “Trend Follower’s desk · admitted {SYMS}” · “Atlas’s desk · admitted {SYMS} · held #” · “Symbol” · “Mark” · “P/L Open” · “P/L Day” · “Short” · “Entering” · “Buys at the next session’s first window” · “Medium” · “Day # of #” · “vs XLF” · “Long” · “Marks as of the close, # Nov.” · “Battles as Fundamental Investor” · ““AI, through GPUs and accelerators, built on NVDA.”” · “· High-Beta Ten” · “Hold to deploy” · “Press and hold for # seconds to deploy. Release early to cancel.” · “Compete” · “News” · “League” · “Forge” · “Search” · “# ideas running · # being worked” · “# setups running” · “all in use” · “A result is in · NVDA · AVGO” · “Read it” · “# more” · “Trend Follower’s desk · entered {SYMS} · held #” · “Atlas’s desk · held #” · “# setups” · “Pullback and Resume” · “Day #” · “Trend Breakout” · “vs XLP” · “Live · # # left” · “BaggerBomb vs CPU — Capital Preserver” · “Open game” · “Deploy unavailable · capacity # of # in use” · “# setups running · # waiting” · “Trend Follower’s desk · held # · waiting for a valid setup” · “# setups · # waiting” · “Waiting for a valid setup” · “No Recognized Setup” · “FRI # NOV · AFTER HOURS” · “# setups running · # sold at its stop” · “Trend Follower’s desk · {SYM} sold at its stop by code · held #” · “Sold at its stop · # Nov” · “runs your short slot” · and the band's fit-test names (Speculator, Fundamental Investor, Capital Preserver, each split over two lines) · “Failed Breakdown Recovery”.
- **Labels:** “Account” · “Atlas and Trend Follower” · “Atlas, your research partner. # idea running · # entering. Open” · “Trend Follower. # names entering. Open” · “Trend Follower in its armor” · “The split: Atlas #, # in use; Trend Follower #, # in use; cash #. Open the split” · “Command Center sections” · “At the last close” · “Trend Follower’s desk mark” · “Atlas’s desk mark” · “Positions” · “Short, Entering. Open” · “{SYM}. Open its chart” · “Medium, Day # of #. Open” · “Take it into battle” · “Battles as Fundamental Investor. Open loadout” · “Fundamental Investor mark” · “Hold to deploy” · “Primary” · “Atlas, your research partner. # ideas running · # being worked. Open” · “Trend Follower. # setups running. Open” · “Needs you” · “# more need you. Open the list” · “Plan for {SYM}: stop #, entry #, progress mark #, target #, now #” · “Trend Follower. # setups running · # sold at its stop. Open” · “{archetype}, runs your short slot. # setups running. Open” · “{archetype} in its armor”.

**Setups tab and strategy cards.**
- **Drawn:** “What Trend Follower is testing, what is up next, and the strategies in its playbook.” · “Change” · “TREND FOLLOWER’S TESTS” · “# running” · “TESTING NOW” · “Chart” · “Checked by code” · “now # # from entry” · “target” · “stop” · “entry” · “progress mark” · “Risks # · aims for # · # its risk” · “· progress mark due by day #” · “TODAY’S CALL” · “HOLD” · “It turned back up from the fast average and hasn’t given the level back.” · “Trend Follower · after the close, # Nov” · “UP NEXT” · “Trend Follower’s pick · Pullback and Resume” · “Enters when a running test ends and a setup is valid.” · “THE PLAYBOOK” · “# strategies · swipe” · “Buys a stock in an uptrend after it dips and turns back up.” · “RISKS” · “about #” · “AIMS FOR” · “WAITS” · “up to # sessions for the progress mark” · “BREAK-EVEN” · “about # of trades won” · “Break-even is arithmetic from the risk and the aim. It is not a win rate.” · “Trend Follower’s record with it” · “# closed · too few to tell” · “Trend Follower tests this” · “Buys a stock as it clears a recent high.” · “recent high” · “Rarely appears.” · “None yet” · “Support Rebound” · “Buys near a price where the stock has turned up before.” · “turned up here before” · “Judged by your archetype” · “Trend Follower doesn’t test this” · “Buys after a stock dips under a level and climbs back over it.” · “level” · “None running” · “No valid setup on today’s list. Trend Follower waits.” · “The short slot is in cash.” · “Close above the #-day” · “#-day above the #-day” · “#-day rising over five sessions” · “The touch” · “The extension guard” · “Close at or above the #-session high”.
- **Labels:** “Runs your short slot” · “Trend Follower armor mark” · “Testing now” · “{SYM} plan on a price chart, sample data: entry #, stop #, target #, progress mark # due by day #” · “{SYM}, {strategy}, day #. Open” · “Up next” · “Diagram of {strategy}: a stylised price path with the entry, the stop and the target marked. Not a real chart.” · “What code checks”.

**Ideas tab.**
- **Drawn:** “Every idea, from the first question to its result.” · “Work an idea” · “Explore” · “BEING WORKED” · “From a story” · (a story's question) · “Continue” · “Your observation” · (an observation) · “Saved. Your agent may draft from it at a close.” · “What each desk considered at the last close” · “# drafts” · “IN THE PORTFOLIO” · “Short · # sessions” · “Medium · # sessions” · “Long · # sessions” · (theses) · “{SYM} # away” · “FINISHED” · “Short · Ran its # sessions” · “Not measurable” · “{SYM} had no usable closing price on the exit day.” · “Long · Settled early by the manager” · “# vs holding the same stocks” · “# vs XLE”.
- **Labels:** “Being worked” · “In the portfolio” · “Short · # sessions, three setups. Open Setups” · “Archetype desk mark” · “Medium · # sessions. Open the idea book” · “Finished” · “{SYMS}, Ran its # sessions. Open the result”.

**Partnership tab.**
- **Drawn:** “What Atlas remembers with your say-so, and the record of whose ideas did what.” · “STANDING RESEARCH PREFERENCE” · “CONFIRMED BY YOU · # NOV, # PM” · (the preference) · “Source” · “Pasted note · # Nov, # PM · Inspect” · “Later use” · “Used in research · # Nov, # AM · …” · “Inspect record” · “Edit” · “Withdraw” · “Withdrawing stops future use and keeps earlier uses in the history.” · “WHOSE IDEAS AND SETUPS DID WHAT” · “Your ideas · from your theses and observations” · “# finished · # ahead of their comparison · # behind” · “Your agent’s drafts” · “# finished · # ahead · # behind” · “Ideas from stories” · “Trend Follower’s tests” · “Each idea is one observation.” · “HISTORY” · “# finished” · “Tests” · “Ended at its target · # Dec” · “plan followed” · “Ended at its stop · # Nov” · “Ran out of time · # Nov” · “plan not followed”.
- **Labels:** “Whose ideas and setups did what” · “History” · “Filter”.

**Sheets.**
- **Drawn:** “TODAY’S BRIEF” · (the brief) · “Daily Regime Brief · Published Fri # Nov · # AM ET · # sources” · “Read the full brief” · “WORTH EXPLORING” · “Story” · “Question” · (three prompts) · “Open Explore” · “ITS DESK” · “Runs your medium and long ideas · # running” · “Open Ideas” · “Who runs your short slot” · “RUNS IT NOW” · six stop lines (“Stops under the pullback’s low.” · “Tight stops. Small losses, taken early.” · “Wide stops. Gives a trade room.” · “Stops where the reason to own it breaks.” · “Stops under the low it bought against.” · “Even stops across names. No one loss runs large.”) · “# closed” · “Open Setups” · “Change to Capital Preserver?” · “Trend Follower finishes its open tests. Capital Preserver takes the next one.” · “FINISHES ITS OPEN TESTS” · “TAKES THE NEXT ONE” · “Change to Capital Preserver” · “Keep Trend Follower” · “THE SPLIT” · “How the book’s money is split” · “Atlas # · Trend Follower #” · “NOW” · “# is always cash.” · “The split applies to new entries. Everything running finishes as it is.” · “Set the split” · “Cancel”.
- **Labels:** “Your research partner” · “Close” · “Today’s brief” · “Worth exploring” · “Its desk” · “{archetype} armor” · “The split”.

**The research modal** (the modal chat's surface, listed for completeness):
- **Drawn:** “In your portfolio · Short · Trend Follower’s test” · “Open in Setups” · “TREND FOLLOWER’S RULE · DAILY” · “as of Mon Nov # close” · “Pullback and Resume · present — touched its #-day (#) and closed back above it.” · “The read on the day before entry. Tap for the checks.” · “In your portfolio · Medium · Atlas’s idea” · “Open the idea” · “its line · code sells below” · “Entry # · line # · # away · Day # of #” · “In an uptrend; no entry pattern today.” · “THE CHECKS · TREND FOLLOWER’S RULE” · the check rows and definitions · “Work this idea” · “Watchlist” · “Read from the stored record. Nothing is computed here; no message cost.”

**No portfolio** (state 15, as the design draws today's hub):
- **Drawn:** “FRI # NOV · TESTER” · “FUNDAMENTAL INVESTOR · READY TO DEPLOY” · “Partnership · # confirmed” · “Research · # being worked” · “Loadout · Fundamental Investor · ready to deploy” · “NEXT ACTION” · “Review your # Nov game in the Film Room” · “Open Film Room” · “Later” · “Game history” · “# completed · results and reviews” · “RECENT ACTIVITY” · “Review available” · “Game completed” · “Preference used in research” · “Daily Regime Brief” · “Ready to deploy”.

**Desktop only:** “FRIDAY, NOVEMBER # · MARKET OPEN” · “TAKE IT INTO BATTLE”.

### E2. Against the hub's copy guard as it stands

**Method.** The guard's rules (`hubCopy.guard.test.js:334`, `:406`, `:413-417`) were run case-sensitively over two sets:
- the rendered strings;
- every string literal, template and JSX text in the design's 28 app modules, parsed with `@babel/parser`. This second pass exists because rendered text is upper-cased by CSS, which hides the one case-sensitive rule, `\bTester\b`.

| String | Where | Rule it breaks |
|---|---|---|
| “What {agent} remembers with your say-so, and the record of whose ideas did what.” | Partnership tab | Banned `\bremembers?\b` (`:416`; also the door list `:398`) |
| “{date} · Tester” | State 15 header (`ccp3-screens.jsx`) | Banned `\bTester\b` (`:416`). The built header reads date · player name (`hubCopy.js:69`), so the design's state 15 is not today's hub here. |
| “More strategies arrive as the playbook grows.” | Round 2's bench module (in the file, drawn on no final frame) | Banned `\bgrow(s|th|ing)?\b` (`:415`) |
| “Smart Money” | The research modal's kit (in the file; the modal chat's) | Banned `\bsmart(er)?\b` (`:414`) |

**The three checks the brief names:**

1. **The agent's name beside "idea".** No design string pairs the literal words "agent" or "Shadow" with "idea", so `PAIRS` (`:334`) passes all of them. That is because the guard can't see a name: copy functions are called with `ARG0…` (`:160-166`). Four strings do pair the agent's given name with ideas:
   - “Atlas, your research partner. 1 idea running · 1 entering. Open” (band label)
   - “Atlas, your research partner. 2 ideas running · 2 being worked. Open” (band label)
   - “What Atlas remembers … whose ideas did what” (Partnership)
   - “In your portfolio · Medium · Atlas’s idea” (modal; the modal chat's)

   Visually, the band also sets “2 ideas running · 2 being worked” directly under the name, and the agent's sheet says “Runs your medium and long ideas” under “ATLAS”. These break the intent of R-S6-6 and Q-S6-1, not the regex. See FQ-4.
2. **The no-learning rule.** No design string claims learning or improvement. One string makes a claim the hub can't back: **“Saved. Your agent may draft from it at a close.”** Saved theses do not reach a desk while `PRACTICE_FIELD_AGENT_THESES_ENABLED` is false ([S] `practiceFieldFlags.js:66`). The app's own Shared Research copy says so: “…idea book isn’t reading saved theses yet.” (`sharedResearchCopy.js:191`).
3. **"Shadow".** The design never says Shadow; it says "{Agent}’s desk". The built book says "Shadow desk" in server words the hub would draw (`bookViewCopy.js:41-44`), and the hub's stage line is "Shadow · your research partner" (`hubCopy.js:83-84`, pinned at `hubCopy.guard.test.js:273`).
   - The server's words are **not scanned** by the hub guard, which reads only the three hub tables (`:51`).
   - Run through the same rules, one of them fails `PAIRS`: **“Open. The Shadow desk looks for an idea at tonight’s close.”** (`OPEN_SLOT.desks`, `bookViewCopy.js:104`). It would fail the moment the hub draws the Desks content.
   - The other 166 server strings pass.

**Two word changes the design makes against the built book** (not guard failures):
- "sold at its stop" vs "sold at its line by code" (`bookViewCopy.js:67`, `:125`);
- "entered" vs "opened" (`:119`).

### E3. PC-5: "the mark"

- **No final frame draws "the mark".** The plan's halfway price reads "progress mark" on the plan, in the clock line, on the strategy cards and in the modal.
- **The file still holds "sessions for the mark" twice,** in Round 2's and Round 3's data (`ccp2-data.js`, `ccp3-data.js`). Round 5's revision rewrites the cards' text at load (`ccp6-data.js`), so no frame shows it.
- **The table's column header "Mark"** (the closing price) is kept on purpose, by the designer's note. That is the built Idea book's own header (`ideaBookCopy.js:13`). Under PC-5's reasoning, "Mark" for the close and "progress mark" for the plan can now meet on one row, under a setup. The modal chat may want to rule on the column word.

---

## 8. Part F — the fold

**F1. If the hub's Overview draws the book.** The book layout makes the entry card redundant, along with its full-window layer and Idea book tab bar:
- Positions moves to Overview.
- Desks moves to Ideas ("what each desk considered") and the desk rows.
- History moves to Partnership.

The card is the only way in (§4 B1).

**Recommendation:**
- With the new flag on and a book present, the card is not rendered. The hub draws the layout instead.
- `IdeaBookScreen.jsx` stays as the source of the parts.
- The layer stays in the code as the rollback path. Turning the flag off restores today's card and page exactly.

The design itself still points at a separate screen in two labels, "Medium · 30 sessions. Open the idea book" (Ideas tab). Under the fold those should open the slot's detail.

**F2. A player with no book sees today's hub, unchanged.** The deciding check is one expression on the hub's one read of the book:

```
COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && read.status === 'ready' && read.book !== null
```

- `read` is `useIdeaBook`'s answer (`useIdeaBook.js:105`). The same test decides the card today (`IdeaBookEntry.jsx:96`, `:106`).
- It sits in `ConnectedHub` (`CommandCenterHub.jsx`, which already holds the hub's readers, [S] `:820-954`). It is computed once and handed down, so the card and the layout never disagree (§9).
- A 404 (not admitted), a `{ book: null }` answer, a failed read, idle and loading all fall through to today's hub. The mount guard and the flag-off fold keep it byte-identical when the flag is off.
- The acceptance check for "unchanged" must be the **built** hub, not the design's state 15. The design's state 15 differs from the build: "Tester", "Partnership · 1 confirmed" against the built "Not in this release" (`hubCopy.js:130`), and "Research · 2 being worked".

**F3. Other links to the Idea book.** None. The only mention outside the hub is a sentence in Shared Research copy, "{name}’s idea book isn’t reading saved theses yet. Yours is saved to your lists." (`sharedResearchCopy.js:191`; `ThesisSaved.jsx:80`), which links nowhere. No route, URL or other component opens the screen (grep of `src/` and `api/`).

---

## 9. Part G — screens the design doesn't draw

| Undrawn | In the built Idea book? |
|---|---|
| The result screen that "Read it" and a History row open | **Yes**, for a History row: `ResultSheet` with the five-column result, the idea and the last call (`IdeaBookScreen.jsx:460-509`). It needs a hub host (§4 B4). "Read it" has nothing to point at beyond the settling session, because a result has no read state. |
| What a slot header opens | **Yes:** `IdeaPanel` (progress, ledger, gap, today's call) (`IdeaBookScreen.jsx:233-273`) |
| The list behind "2 more" in Needs you | **No.** The hub has one next action; the book has no such list. |
| Loading, empty-history and error states | **Yes**, in the book: “Reading the book…”, “No idea book yet. / When your agents open one, it shows here.”, “The book could not be read just now. / It reads again when you come back to this page.” (`ideaBookCopy.js:33-37`, drawn at `IdeaBookScreen.jsx:585-587`), and History's empty line (`bookView.js:784`). Inside the hub, loading and error are moot under F2, because those players see today's hub. |

---

## 10. Part H — the Setups tab before setups exist

What exists that could truthfully fill it (no choice made here; FQ-7 carries the recommendation):

1. **The archetype desk's own work.** All of this is in the view today:
   - the short slot's idea: its group, names, thesis, day and call (`groups[0]`, `bookView.js:429-486`);
   - its note ("written after the close", `desks[archetype].note`, `:592-594`);
   - what it considered, with outcome words and refusal reasons (`desks[archetype].passed`, `:603-608`).
2. **The two code-checked strategies and their checks,** from the detector `tf-setup-v1`, which is pure: no clock, no I/O ([S] `api/_utils/setupEvaluator/tfSetupV1.js:10-11`).
   - **Pullback and Resume:**
     - The uptrend: “Close above the 20-day”, “20-day above the 50-day”, “50-day rising over five sessions”
     - “The touch”
     - “Close above the 20-day”
     - The stretch guard: “Within the stretch limit”
   - **Trend Breakout:**
     - the same uptrend group and stretch guard
     - “Close at or above the 20-session high”
     - “The volume floor”
   - Names: `chartReadCopy.js:125`, `:166-176`; checks built at [S] `tfSetupV1.js:244-252`.
   - **Against the design:** the design's "The extension guard" is built as "Within the stretch limit". Its Trend Breakout list (marked as samples) omits the stretch guard and "The volume floor".
   - The rule set is labelled "built as Trend Follower’s setup check" (`chartReadCopy.js:123`). For a book run by another archetype, these are not that archetype's own strategies.
3. **The nightly setup store, and whether a client route can list a session's valid names.**
   - The cron `setup-evidence-sweep` writes one final snapshot per stock and session, with the verdict at `entry.verdict` ([S] `api/_utils/setupEvidence/acquire.js:134-151`). It is on: `SETUP_EVIDENCE_SWEEP_ENABLED = true` ([S] `setupEvidenceSweepFlags.js:32`). Its universe is `ALL_TICKERS`, 228 names (`rankingConfig.js:381`; length measured [S]).
   - Firestore rules deny all client reads of the store ([S] `firestore.rules:1333-1338`, `:1381-1383`).
   - **The one client-safe route answers one stock per call:**
     - `GET /api/research/setup-read?symbol=` ([S] `api/research/setup-read.js:142-164`);
     - admitted through `CHART_READ_MODE = 'allowlist'` (`researchModalFlags.js:217`), the cockpit allowlist;
     - 30 calls a minute per user ([S] `:53`).
   - **It cannot list a session's valid names.** Listing all 228 through it would take at least 8 minutes. A list would need a new route.
   - **Count: 131 stocks are both in the store and on the book's price list.**
     - The price list is `CANDIDATE_UNIVERSE`, 136 names ([S] `api/_utils/mandateCandidateUniverse.js:80-87`; measured [S]).
     - Five are outside the store: ADI, TGT and PYPL are not in `ALL_TICKERS`, EA is retired, and BRK.B is spelled with a dot while `ALL_TICKERS` holds BRK-B (`mandateCandidateUniverse.js:36`, `:39`, `:46`, `:54`, `:55`; `symbols.js:26-35`).
     - Method: a scratch script intersecting the two lists, then repeating with the `isUniverseStock` rule. Both give 131 [S].
     - The book prices those 136 only on a drafting close with the agent on. Otherwise its snapshot omits the house universe (`practiceField/sweep.js:186-188`; `agentSources.js:72`).

---

## 11. Found outside the task (for separate tasking; nothing fixed)

1. **Five of the book's 136 priced names can never be drafted.** A desk's candidates must pass `isUniverseStock` (`agentSources.js:76`), which requires `ALL_TICKERS` membership (`symbols.js:33-35`). ADI, TGT and PYPL are not in `ALL_TICKERS`, EA is retired, and the list spells BRK.B with a dot while `ALL_TICKERS` has BRK-B. So 131 are draftable, and the book still prices all 136 on a drafting close. Two comments also disagree on the house universe's size: [S] `agentSources.js:56` ("about 136") against [S] `symbols.js:6` ("228"). **For the Practice Field chat.**
2. **The market calendar runs out on 31 Dec 2026.** `marketSchedule.js:12` carries "TODO: Update NYSE_EARLY_CLOSE and holidays for 2027 by December 2026". [S] `marketHolidays.js` has no 2027 entries. From 1 Jan 2027 holidays read as trading days for the hub's pre-open rule and for anything else on those tables.
3. **The server's open-slot sentence would fail the hub's pairing fence.** It reads “Open. The Shadow desk looks for an idea at tonight’s close.” (`bookViewCopy.js:104`). This is harmless today, because the Idea book screen is outside the hub's guard. It matters for the fold (E2).
4. **The comments about the Practice Field switch are stale.** They call it "off on merge", but it is `true`: `ActivitySection.jsx:17` and [S] the mount guard `:666-669`.
5. **The design's state 1 ("As built today") may not match the founder's book.** It names the short desk Trend Follower and shows the short slot "Entering". The Practice Field answers describe the founder's book under the Diversifier, with the archetype's $19,981 fully in use. I could not check either side without a Firestore read, which this task forbids.
6. **`PHONE_SHADOW` and the legacy Shadow tiers are effectively unread on `main`,** because the hero is the agent form and the phone stage takes the armory path ([S] `hubFlags.js:57-64`; `CommandCenterHub.jsx:458-492`).
7. **The modal's built check name and the design's check name differ** ("Within the stretch limit" against "The extension guard"). This also belongs on the modal chat's list.
