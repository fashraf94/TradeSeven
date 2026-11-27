# Fable review: Portfolio hub slice 3 (draft PR #1124)

**Date:** 27 Nov 2026 · **Reviewer:** Fable (Claude Code, local) · **Role:** read and judge; nothing in the repo was changed.

**Step 0.** `git fetch origin` ran first. PR #1124 is an open draft on `claude/portfolio-hub-s3-tabs-and-overview`, head `4062518a`, code frozen at `0f25aeee`, base `a2e05fa9`. The head has not moved. **`main` has moved:** it is now `a037e022` (PR #1121, Practice Field B6, and PR #1123, company names, merged after the base), and GitHub reports the PR as **conflicting** (finding S3F-1).

**How I worked.** One pass, no subagents. I read the seven touched source files against the base, the four new modules, the guards and the suites; viewed all 19 pictures; rendered the design of record from an unpacked copy outside the repo and compared its 390 and desktop Overview frames; and ran one thing (below). Everything else is by reading.

**The one run, and why.** `main` moved under the PR, and B6 changed the server module and fixtures the slice's tests draw their books from. So I ran the slice's eight test files on the PR merged with today's `main` (an LF archive in the scratchpad, Windows, `TZ=UTC`): **8 files, 311 passed, 0 failed, exit 0.** I did not re-run the full Linux suite, `lint:gate`, `test:rules` or the build.

---

## 1. Verdict

**Merge after the fixes listed.**
The switch-off guarantee holds by reading, nothing here breaks a house rule or a ruling, and nothing has to be torn out by slices 2, 4 or 5.
One item must be done before it can merge (the conflict with `main`); four small ones belong in the same fix round; the rest is carried or noted.

## 2. Findings

| ID | What a player or a later builder would meet | Where | Grade |
|---|---|---|---|
| **S3F-1** | **The PR cannot be merged as it stands: it conflicts with `main`.** Both sides added rows at the same place in the docs index. No source file conflicts. `main` changed no file under `src/`, so the switch-off build proof still stands; the slice's own 311 rows pass on the merged tree. The full suite, lint and rules have not run on the merged tree. | `docs/README.md` (the rows after `specs/20261126_…BUILD_SPEC_V1.md`); `main` @ `a037e022` | **Blocker** (mechanical: merge `main`, keep all four rows, re-run the final checks on the merged tree) |
| **S3F-2** | **A Practice Field builder who adds a function to the Idea book screen will see a Command Center test fail with a bare list of names and no instruction.** It fails only in the full suite, in a file outside their lane. The rule ("put the new function in one list or the other") is in a code comment, not in the failure. | `src/components/CommandCenter/commandCenterHub.mount.guard.test.js:1531-1542` | **Fix here** |
| **S3F-3** | **A new player's first-deployment strip shows a button that says only "Deploy", and a tap does nothing.** It is a hold control. The card it replaces says "Hold to deploy" and has a line of explanation; the strip has neither. | `src/components/CommandCenter/sections/BookOverview.jsx:72` (`label={candidate.cta}`, which is "Deploy"); the card: `sections/NextActionCard.jsx:54` (`COPY.deploy.hold`) | **Fix here** |
| **S3F-4** | **On a phone, pressing a desk row, an idea's header or a name's row in the hub shows nothing at all until the result appears.** The Idea book's parts switch off the browser's own tap highlight and rely on their own press style, which the hub does not load. Every other row in the hub still gets the browser's highlight. | `src/components/PracticeField/ideaBookStyle.js:38` (tap highlight off), `:44-46` (the press style, not loaded in the hub); R12 | **Fix here** |
| **S3F-5** | **No test draws the real words of every "Needs you" kind and checks them for "Shadow" or a barred word.** The words are clean today (I read all of them, C.1), but the "every kind" row uses stand-in titles and the "Shadow" scan drew one kind. | `CommandCenterHub.bookLayout.jsdom.test.jsx:337` (stand-in titles), `:722` (one scene) | **Fix here** (one row) |
| **S3F-6** | **Slice 2's builder will have to rewrite the desktop grid.** The design puts the band across the full width and the battle card beside the panel, under the band. The build puts Deploy beside the hero, at the top. The change is confined to one function and one pinned row, and it does not remount anything. | `src/components/CommandCenter/BookLayout.jsx:221-230` (the desktop branch of `bookWideGrid`); its pin, `CommandCenterHub.bookLayout.jsdom.test.jsx` "the book layout's grid is…" | **Carry: slice 2** |
| **S3F-7** | **A player who changes armor, book or traits from the Loadout sheet lands back on the Overview and must reopen Loadout for the next change.** Today the Loadout tab stays open behind those sheets. Not a dead end, but one extra tap per change. | `src/components/CommandCenter/hub/useHubSheets.js:80-96` (one slot; a sheet opened from a sheet replaces it); `BookLayout.jsx:197-210` | **Carry: slice 4** (it changes the sheet registry) |
| **S3F-8** | **The "Needs you" strip is heavier than the design's.** The design draws one slim line with a teal text action. The build draws a filled blue button with a glow, and on a phone the strip is two lines, about 75 px against the design's 44. | `sections/BookOverview.jsx:58-79`; design `NeedStrip4` | **Carry: the flip** (the founder's walk) |
| **S3F-9** | **The book layout silently assumes two other switches are on.** If the armory or per-game loadouts were ever switched off while the portfolio switch is on, the desktop's loadout link would select a hidden area and do nothing, and the phone would open the armory sheet in place of the old picker. Both ship on today. | `CommandCenterHub.jsx:496-510`, `:717-727` (the two "off" arms have no book-layout site); `BookLayout.jsx:202` | **Carry: the flip** (say it in the switch's docstring, or pin it) |
| **S3F-10** | **The Deploy card inside the phone's Loadout sheet can start a Retry while the sheet is open.** The deployment's ceremony then runs over the sheet, and the sheet is still there afterwards. Today that card sits on the page, not in a sheet. By reading only; not run. | `BookLayout.jsx:164`; `hub/selectors/deployState.js:188-194` (Retry is admitted with a sheet open, by design) | **Carry: slice 4** (one row, then decide) |
| **S3F-11** | **On an 834 px tablet the Deploy card sits between the hero and the tabs, so the book starts about 800 px down.** The design has no frame for this width. | `BookLayout.jsx:239-244`; picture `834-full.png` | **Carry: slice 2** (decide with the band) |
| **S3F-12** | **The desk rows and slot headers show a small dot where the design shows each desk's own figure.** This is the built Idea book's mark, and PH-10 says the built parts win. | Design `DeskRows4`, `Table4`; the parts' `DeskMark` | **Note** |
| **S3F-13** | **A keyboard user loses their place if the book leaves, or arrives, while focus is on a tab or a row that goes away.** Focus drops to the page. Low reach: a book leaves only on an account change or a deleted book, and arrives once per page load (PH-9, already slated). | `CommandCenterHub.jsx:516-542` | **Note** |
| **S3F-14** | **With the switch on, every player's hub redraws once each time the window regains focus,** book or no book, because each answer of the book's read is a new object. One render; not a fault. | `HubBookScope.jsx:25-27`; `PracticeField/useIdeaBook.js:77-80` | **Note** |
| **S3F-15** | **The flip PR has two leftovers to tidy.** The smoke branch leaves a comment saying "ships off" above the removed guard entry, and the switch's docstring still describes slice 1 (the builder's §9 item 1). | `src/config/flagPinGuard.test.js:135` on the smoke branch; `src/config/commandCenterPortfolioFlags.js:13-16` | **Note** (for the flip) |

## 3. Answers to A to K

### A. The switch off, by reading — sound, nothing found

I read the diff from the base for all seven files. Every change is one of four kinds, and none can reach a player with the switch off:

1. **A folded site.** Each is `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && … ? book : today`, or an `if` that starts with the switch. The switch is a literal `false`, so the build keeps only the "today" arm, and I checked each "today" arm against the base, character for character.
2. **An import that is then unused** (`use`, the switch, the scope, `HUB_LAYOUTS`, `HUB_COMPOSITIONS`, `DESKTOP_ACTIVITY_LIMIT`, `HubLayoutContext`, the four new modules). An unused import of a module with no side effects leaves nothing.
3. **New code nothing reaches:** `PhoneArmorySheet` and its two helpers and its pure-marked context (`Armory.jsx:625-682`); `PORTFOLIO_HUB_COPY` (`hub/hubCopy.js:718-729`); the early return added to `HubIdeaBookEntry` (`sections/ActivitySection.jsx:84`), a function that is itself only drawn from slice 1's switch site.
4. **One added `export`** on `PhoneOverview` (`PhoneTabs.jsx:96`). An export inside one chunk adds no code.

**`IdeaBookScreen.jsx`, the Practice Field's file — its three sites:**
- `:134` `const hosted = SWITCH ? use(IdeaBookPartsOptions) : null;` folds to `null`, and is then unused.
- `:141` the desk row's screen-reader name folds to the old template, "… Open Desks".
- `:376-380` the Cash row: `SWITCH && use(IdeaBookPartsOptions)?.cash === false ? null : (row)` folds to the row.

The `use()` inside the expression is legal: React's `use` may be called conditionally, unlike a hook. It sits in the returned JSX, not inside the rows' loop. With the switch **on**, the Idea book's own page never provides the options, so `use` returns `null`, the Cash row draws and the name says "Open Desks": the page is unchanged in both states.

This agrees with the builder's whole-build comparison (64 of 64 non-map files identical). I had no reason to redo it: `main` has changed nothing under `src/` since.

### B. The switch on, for a player with no book — sound, two notes

**The fifteen new sites.** I compared the "today" arm of each with the base: PhoneHub `:452`, `:453`, `:480`, `:486`, `:490`, `:516`, `:531`, `:551`; WideHub `:656`, `:665`, `:707`, `:737`, `:740`, `:741`, `:745`. All fifteen are exactly today's code. The three guarded statements (`:452`, `:453`, `:656`) can only fire on a sheet key that the book layout alone opens, or when the layout is 'book'.

**A book that leaves mid-session.**
- The Loadout sheet and the phone armory sheet close and free the slot (`:452`, `:656`); the book coming back opens nothing. Pinned by the builder's rows.
- The hero resumes: its pause reads the armory sheet's key only in the book arm (`:490`).
- A sheet that belongs to today's hub too (History, Activity, the Huddle, research, the record, traits, the book of names, the Scouting Board) stays open, as it would today.
- **State left behind:** none. The book layout keeps its tab in its own components, which unmount. Today's tab and area were never touched, so today's hub returns where the player left it before the book arrived.
- **Focus:** if it was on a book tab or a row, it drops to the page (S3F-13).

**A book that arrives (PH-9).** Today's hero-box armory closes (`:453`); an uncommitted hold on today's next-action card ends with the card; the strip's own hold carries on, which is what the player was doing. Focus on today's tab row is lost (S3F-13).

**What a script would not reach.**
- With the switch on, the hub's shells now read the book's scope, so every player's hub redraws once per window refocus (S3F-14). Slice 1 had only the card reading it.
- The book layout assumes the armory and per-game loadout switches are on (S3F-9). This cannot reach a no-book player.

### C. The "Needs you" strip

**1. The exact words, every kind.** The strip is a group named **"Needs you"** (screen-reader name only; no visible label, as in the design). It draws the title, one action and "Later". The "why" line is never drawn.

| Kind | Title | Button label | Button's screen-reader name |
|---|---|---|---|
| A live game, open | "Open your live game" | "Open game" | "Open game" |
| A game deployed, waiting for the open | "Your game is deployed" | "Open game" | "Open game" |
| A review | "Review your Nov 26 game in the Film Room" (or "Review your game in the Film Room") | "Open Film Room" | "Open Film Room" |
| The Huddle | "Huddle ready" | "Open huddle" | "Open huddle" |
| The first deployment | "Play your first BaggerBomb game against a CPU" | "Deploy" (then "Locked in") | "Hold to deploy. Press and hold, or press Enter or Space to deploy now." |
| Every kind | — | "Later" | "Later" |

**None says "Shadow", and none uses a word barred by spec §5.** The two lines that would ("Shadow deploys with your equipped loadout." and the Huddle's "…with a game plan to confirm.") are "why" lines, which the strip does not draw.

**Did the builder's scan draw every kind? No.** The "Shadow" scan drew one scene, and the "every kind" row uses stand-in titles. The words are fixed copy and I read them all, so the result stands; a row would make it permanent (S3F-5).

**2. The first-deployment hold.**
- **One deploy path: yes.** The strip takes the same provider wiring as the card (`actions.nextActionHold`, control id `hub-next-action`), the same `canStart` test and the same shipped hold button. The card is not drawn anywhere in the book layout, so only the strip carries this hold.
- **Can anything short of a full hold deploy?** A tap or a short press cannot. Enter or Space on the keyboard deploys at once, which is the shipped button's keyboard path and is the same on today's card.
- **Would a player know what holding does? Not well** (S3F-3). The visible label is "Deploy", with no hint to hold and no "why" line. Recommend the card's label, "Hold to deploy". It fits: at 320 the button and "Later" already sit on their own line.

**3. "Later": exactly today's.** Same handler, same selector, same marker, the same "next within the same rule" behaviour. For a Huddle candidate it is the Huddle's own Later, as on the card.

### D. The hub's guard on the Practice Field's file

**What happens.** A Practice Field build that adds a top-level function to `IdeaBookScreen.jsx` reddens the row "slice 3: the Idea book parts the hub draws…" in `commandCenterHub.mount.guard.test.js`. The failure is a list-equality diff showing the new name. It reddens only in the full suite, since that builder's own targeted runs do not include the hub's guard.

**Would they know what to do from the message alone? No** (S3F-2). The instruction lives in a comment above the test.

**The smallest change that keeps the protection:** give the expectation a message, for example: *"IdeaBookScreen.jsx gained or lost a function. The Command Center draws parts of this file. Add the name to DRAWN if BookLine, Strip, PosTable or DesksTab (or anything they call) uses it; otherwise to PAGE_ONLY. A DRAWN function may hold no effect, timer, listener or read."* And one comment line at the top of `IdeaBookScreen.jsx` pointing at the guard (a comment does not change the build). The same message should cover the second trap: a drawn part that starts calling a page-only function fails as `PosTable -> Quiet` with no explanation.

### E. The sheets

From the Loadout sheet, each of these takes the hub's one sheet slot, so the Loadout sheet closes as the next opens:

| Opened from the Loadout sheet | On close the player lands on | Focus goes to |
|---|---|---|
| The armory (phone: its own sheet; desktop: the armory dialog) | The page, on the tab they were on. Loadout is not reopened. | The control that opened Loadout: the strip's status button (phone), the Deploy card's loadout line (wide) |
| The agent record | The same | The same |
| The book of names | The same | The same |
| The traits | The same | The same |
| The Scouting Board | The same | The same |
| The Huddle's reconfirm (phone) | The same | The same |
| The Forge links | The Forge; the hub is replaced, as today | — |

I traced the focus return through the overlay stack for both shapes (a hub sheet replacing a hub sheet, and a shipped sheet replacing a hub sheet): the Loadout's opener is kept and gets focus when the second sheet closes.

**A dead end? No.** But every change costs a reopen of Loadout (S3F-7).

**The phone hero after the armory sheet closes — it always resumes:**
- **Close** and **Escape:** the sheet's key clears, so the pause clears.
- **Equip:** closes the same way.
- **A tab change:** cannot happen while the sheet is open (the page is inert), and the pause does not depend on the tab.
- **The book leaving:** `:452` closes the sheet, and the "today" arm of the pause never reads its key.

The builder's hero probe pins the Escape path. The others follow from the same one expression (`CommandCenterHub.jsx:490`).

### F. Touch feedback

**What a press does today in the hub: nothing visible** (S3F-4). The parts turn off the browser's tap highlight (`ideaBookStyle.js:38`) and expect their own press style, which carries CSS transitions and so is not loaded (R12). The hub's own rows keep the browser's highlight, so the Idea book's rows are the only ones with no feedback.

**Recommendation: add a pressed state with no transition.** An instant background on press for the parts' tappable rows, scoped to the book layout, for example `[data-hub-book-overview] .ib-tap:active { background: rgba(var(--ft-scrim-rgb), 0.06) !important; }` (and the same under the Setups body). No transition, no scale. The mount guard's motion test matches only `transition` and `animation`, so this passes it. It must be emitted from one of the new modules (a `<style>` in the Overview), never added to the hub's shared style string, which would change the switch-off build.

### G. The pictures against the design

All 19 viewed. I compared with the design's "390 · 1 As built today", "390 · 4 Both acted" and "Desktop · 3 · Overview" frames, rendered from the design file. The harness draws Segoe UI where the design draws Inter; I have not counted that.

| Part | What a player would notice |
|---|---|
| **Tab row** | Matches at 390 and 320: four equal tabs, 46 px, the same underline colours. On the desktop it matches too. |
| **Book line** | Matches at both widths: the value, today's change, Since, SPY, Cash, the paper-money line. |
| **"Needs you" strip** | **Differs** (S3F-8). Design: one 44 px line, the title, then a teal text action with a chevron. Build: a filled blue button with a glow, plus "Later" (which PH-12 requires and the design lacks). On a phone it wraps to two lines, about 75 px. On the desktop it is one line. |
| **Desk rows** | **Differ in the mark** (S3F-12). Design: each desk's own figure and a status dot. Build: the Idea book's small dot. The words and the chevron match. Covered by PH-10. |
| **The table** | Matches the built Idea book's table, as PH-10 requires: the same header, slot headers, entering rows and open-slot line. On the desktop the built table has a "To its line" column with a gauge; the design's frame shows later builds' setup rows there. No Cash row in either. |
| **Marks stamp** | Matches: "Marks as of the close, 27 Nov." under the table. |
| **First screen on a phone** | Only the hero, the tabs, the book line and the strip fit above the game strip; the desk rows start under it. This is the hero's height, which is slice 2's, so I only record it. |

### H. The tests

**Was anything slice 1 proved weakened? No.**
- The parity rows for every case that gives today's hub are kept unchanged.
- The "book owner" parity case was removed, rightly: a book owner no longer sees today's hub.
- One row was dropped: "opening the card reads once more; Escape returns focus to the card". With the switch on, that path can no longer be reached from the hub (the card needs a book, and a book is the book layout). The card's drawing part, handed a read, is still tested in the Practice Field's own suite (`IdeaBookEntry.jsdom.test.jsx`).
- The one-read-at-the-shell rows, the refocus rows and the failed-refresh row (PH-23) are kept, re-pointed from the card to the book layout.

**The site count per file: the right kind of pin. Keep it.** It will fail whenever a slice adds or removes a switch site, and the fix is one number. That is its job: it is the only CI check that catches a switch read being **removed**, which would leave book code running unconditionally while the bundle rows still pass. Two things make it easy to live with:
- Slices 4 and 5 will both change the hub file's count on the same line (`portfolioHub.flagOffBundle.test.js:211`). Git will conflict there, which forces the second builder to recount. Good.
- The failure message could say so: "if you added or removed a switch site on purpose, update this count" (`:229`). A nicety, not a fix.

### I. What the next slices inherit

Nothing has to be torn out. What each builder should know now:

**Slice 2 (the band and the split bar):**
- **The desktop grid changes** (S3F-6). `bookWideGrid`'s desktop branch puts the hero inside the main column with Deploy beside it. The design wants the band across both columns and the battle card beside the panel, which is the shape the tablet branch already has. Changing the template and the main wrapper's style remounts nothing. The row that pins the three templates moves with it.
- **The phone armory's wrapper sits around the hero** (`CommandCenterHub.jsx:480`). When the band takes the hero's place, that wrapper and the pause at `:490` move to the band's agent figure. With two figures in the band and one in the armory sheet, PH-15's count needs both band figures paused behind the sheet.
- **The phone hero's three summary lines** still name "Research" and "Loadout", which are no longer tabs. They leave with the hero.
- **The stacked width** (S3F-11): decide where Deploy sits with the band.
- **The hidden next-action slot** (`:740-741`) is harmless: it stays in the tree, empty, so nothing remounts. Leave it.

**Slices 4 and 5 (Ideas, Partnership, Setups):**
- `BookPanel` (`BookLayout.jsx:139-155`) is one four-way choice. Each slice replaces one arm. They will conflict only if both edit the same lines; they do not need to.
- `SetupsBody` (`:134-137`) is a small stand-in around `DesksTab`. Slice 5 replaces it whole. If slice 5 stops drawing `DesksTab`, the mount guard's "takers" row and the DRAWN list change with it.
- **The sheets** (S3F-7, S3F-10): slice 4 changes the sheet registry, so it is the place to decide whether a sheet opened from Loadout returns to Loadout, and to carry PH-30's intent.
- Both will bump the bundle test's site counts (H).

### J. Redraws — sound

- **`HubBookReadContext`:** the value is memoised on the read, its refresh and the decision (`HubBookScope.jsx:27`). It keeps its identity between renders and changes only when a read answers.
- **`IdeaBookPartsOptions`:** the value is one frozen module-level object (`sections/BookOverview.jsx:37-40`). It never changes.

So neither scope causes a redraw of its own. The Overview does redraw whenever the shell does, because the shell rebuilds `sections` and `actions` each render; that is how today's panels behave too, and the table is small. One redraw per window refocus is new for every player with the switch on (S3F-14).

### K. The flip — confirmed

`claude/portfolio-hub-s3-smoke` (`15e5bdce`) is one commit on top of `4062518a`. It touches three files and nothing else:
1. `src/config/commandCenterPortfolioFlags.js`: the literal `false` → `true`, and the docstring line ("ON on the smoke branch only; ships false…").
2. `src/config/commandCenterPortfolioFlags.test.js`: the value row to `true`, and the guard row turned around.
3. `src/config/flagPinGuard.test.js`: the dark-by-design entry removed.

That is the flip's four edits and the docstring line. One leftover for the real flip is in S3F-15.

## 4. The proposed rulings

| # | Answer |
|---|---|
| **PH-29** | **Agree.** The code gives no reason against it. The layout's own words carry no "Shadow" (C.1, Appendix 2). One addition for the wording: the phone hero's three summary lines also leave with the band. |
| **PH-30** | **Agree.** Two facts for slice 4's builder. The door's intent is consumed at the hub's first render, before the book arrives (`CommandCenterHub.jsx:419`, `:631`), so it must be carried. And on the desktop the default area is already the Equipped Archetype, so the area cannot carry it; on the phone the Loadout tab can, but it is also what a player gets by tapping Loadout before the book arrives. A hub file may hold no effect, so the sheet has to open by the render-time pattern the hub already uses to close sheets, with the hub's root as the focus fallback. |
| **PH-31** | **Agree.** For the record: the strip's Huddle kind draws "Huddle ready" and "Open huddle", with no "plan". "Game plan" appears only in the Partnership panel and the Huddle's own sheet. "Setups" appears only as the tab's name and in "Open Setups". |
| **PH-32** | **Agree.** The chip is drawn in the stage's slot, straight after the hero, at both sites (`CommandCenterHub.jsx:512`, `:744`), and a suite pins it. Slice 2 moves it with the band. |
| **PH-33** | **Agree, with four remarks.** R9: accepted, with the label fix in S3F-3. R12: accepted, with the pressed state in S3F-4. R5: accepted; the reopen cost is S3F-7. R4: accepted; slice 2 changes the desktop grid (S3F-6). R2, R3, R6 to R8, R10, R11, R13 and R14: sound, nothing found. |

## Appendix 1 — §2 of `docs/audits/20261126_BUILD_B5_THE_VIEW_FOR_THE_HUB.md`, word for word

*A note before the copy: B6 (PR #1121) merged to `main` after this section was written and edited the same server module. The view's version is still 3 on `main`. B6 also replaces the old desk names inside a desk's own words. Check B6's report for anything it says about the split before writing slice 2's prompt.*

> ## 2. The view's new fields — for the hub's builder
>
> `GET /api/practice-field/book` answers `{ book }` with `book.version === 3`. Two fields are new, and every desk's name is new. Nothing else in the answer changed: on the 13-session run, every one of the 596 leaf fields that differ from `main` is the version, a field below, or a desk's name (§5.4). All money is finished text; the only plain numbers are the share and the bar, for widths.
>
> ### `archetype` — B5-1
>
> ```json
> "archetype": { "codeId": "momentum_chaser", "name": "Trend Follower" }
> ```
>
> - `codeId`: the archetype the book **runs under**: its epoch's `archetypeCodeId`. It is never the agent's battle archetype; a test gives the agent `degen` and the view still says `momentum_chaser`. The id is a catalogue key, the same for every player with that archetype. It is not a user's id.
> - `name`: the registry's display name (`getArchetypeDefinition(codeId).displayName`). If the registry no longer knows the code, the view keeps the id and the name is `null`, for example `{ "codeId": "retired_archetype", "name": null }`. It never throws.
> - `archetype` is `null` only when the epoch document can't be read. The split is then `null` too.
>
> ### `split` — B5-2
>
> The sample day (the scenes' 27 Nov; book value $99,502.35):
>
> ```json
> "split": { "parts": [
>   { "key": "agent", "desk": "shadow", "name": "Atlas’s desk", "share": { "text": "70%", "number": 0.7 },
>     "use": { "amount": { "text": "$24,774.85", "short": "$24,775" }, "of": { "text": "$69,651.64", "short": "$69,652" }, "pct": "35%", "bar": 0.3557 } },
>   { "key": "archetype", "desk": "archetype", "name": "Trend Follower’s desk", "share": { "text": "20%", "number": 0.2 },
>     "use": { "amount": { "text": "$24,856.65", "short": "$24,857" }, "of": { "text": "$19,900.47", "short": "$19,900" }, "pct": "124%", "bar": 1 } },
>   { "key": "cash", "name": "Cash", "share": { "text": "10%", "number": 0.1 } }
> ] }
> ```
>
> - **Order:** always the agent's desk, then the archetype's desk, then cash. `key` is `agent`, `archetype` or `cash`. `desk` is the engine's desk id, which the groups, strip and Desks tab also carry, so the hub can match a part to its rows. A desk id is never shown.
> - **`share`:** the desk's share of the book, from the epoch the book runs under. A desk's share is the sum of its slots' caps (`rails.slotCapShare`: short 20%; medium 30% + long 40%). Cash's share is the cash floor (`gateConfig.cashFloorPct`, 10%). `text` is the percent as the epoch states it; `number` is the same share from 0 to 1.
>   - The three shares sum to exactly 1 in millionths. As decimals they sum to 1 within 10⁻¹².
>   - If an epoch's shares don't sum to 1, or a share can't be read, the split is `null` (§3, R-3).
> - **`use`** (desks only): the founder's PH-2.
>   - `amount`: the marked value at the last close of every position the desk's ideas held there.
>   - `of`: the desk's share of the book's marked value at that close. That is the same equity the headline shows (`line.value`), times the share, rounded down to the cent.
>   - `pct`: amount ÷ of, as a whole percent, cut rather than rounded up, so "100%" appears only with a full bar.
>   - `bar`: the same ratio as a plain number from 0 to 1, stopping at 1.
>   - `short`: the amount without cents at $10,000 or more (the table's fit rule).
>   - The text shows the true figures, also above the share. The sample's energy idea has gained past its 20%, so it reads "$24,856.65 of $19,900.47 · 124%" with a full bar.
> - **An entering idea counts zero.** A name bought after the last close counts zero, because it has no row there. A new book reads `$0.00` of `$70,000.00`, `0%`, bar `0`.
> - **An idea finished since the last close still counts.** Say its last sale filled at this morning's window. It held its positions at the last close, so its row of that close counts.
> - **A waiting book line** (B3-11) gives each part its share and `use: null`.
>
> On the 13-session run's close of 27 Nov (session 9, not the run's last close), the agent's desk read $70,872.37 of $70,710.19 (`100%`, bar `1`), and the archetype's $20,086.44 of $20,202.91 (`99%`, bar `0.994`). The run's last close is session 13, 3 Dec: the agent's desk read **$71,431.37 of $71,212.20** (`100%`, bar `1`), and the archetype's **$20,244.60 of $20,346.34** (`99%`, bar `0.99499…`, just under 0.995). *(Corrected in the fix round: Astra's B5 review found the old sentence called 27 Nov the last close. The figures were read again from the run at the fix round's head.)*
>
> **Your note's 25 Nov figures.** The note gives $19,981 for the archetype and $58,301 of $69,933 for the agent. Those are reserved amounts, from before the two new ideas bought. Under PH-2, that close reads $0 for the archetype (its idea was entering) and one held idea for the agent. The build follows the ruling, not the example.
>
> ### The desks' names — B5-3
>
> | Where | Before | Now |
> |---|---|---|
> | `groups[].deskName`, `strip[].deskName`, `desks[].deskName`, `history.items[].deskName`, every `call.deskName` and `lastCall.deskName`, an agent-written thesis's `byline` | `Shadow desk` / `Archetype desk` | `Atlas’s desk` / `Trend Follower’s desk` |
> | The failed-check line: a failed call's `text` (which now also carries `deskName`) and a desk's failed `note.text` | `The agent could not complete today's check; nothing changed.` | `Trend Follower’s desk could not complete today's check; nothing changed.` |
> | The failed-check line in the strip, after the desk's name (`strip[].text`) | `The agent could not complete…` | `could not complete today's check; nothing changed.` (drawn as "Trend Follower’s desk · could not complete…") |
> | An open slot's line (`groups[].text`) | `Long · open · the Shadow desk looks tonight.` | `Long · open · Atlas’s desk looks tonight.` |
> | The Desks tab's open slot (`desks[].calls[].text`) | `Open. The Shadow desk looks for an idea at tonight’s close.` | `Open. Atlas’s desk looks for an idea at tonight’s close.` |
> | No usable agent name | — | `Your agent’s desk`, and `your agent’s desk` mid-sentence (`Long · open · your agent’s desk looks tonight.`) |
> | No archetype name | — | `Your archetype’s desk` / `your archetype’s desk` |
>
> - The agent's name comes from the book's attribution agent (`agents/{attributionAgentId}`). It is used only when that agent's `ownerId` is the caller.
> - It is plain text: trimmed, 1 to 20 code points (the agent creation form's own `maxLength`), with no control, line break, lone surrogate or format character (bidi overrides, zero-width spaces). The joiner inside an emoji sequence is allowed.
> - Markup is kept as text, and the client draws it as text.
> - Anything else falls back to "Your agent’s desk".
> - The server finishes every name. The client completes nothing.
> - The desk ids (`shadow`, `archetype`), the stored records and the founder script's output are unchanged.

## Appendix 2 — every "Shadow" a book owner can reach in the book layout

Items 1 to 5 are held by the builder's pinning row, which passes on the merged tree. Item 6 is from reading: that suite has no Huddle member.

**Drawn for a book owner:**

| # | The string | Where it is drawn | Who sees it |
|---|---|---|---|
| 1 | "Shadow" (beside "your research partner") | The hero's name line: `ShadowStage.jsx:98`, `:105`, `:320` (copy `hub/hubCopy.js:83`) | Everyone, every width |
| 2 | "Shadow" | The hero region's screen-reader name: `ShadowStage.jsx:158`, `:209`, `:297` (copy `:85`) | Screen-reader users, every width |
| 3 | "Shadow — {state}" (in this layout, with no "; … selected" tail) | The hero figure's image label: `HubAgentForm.jsx:84`, `ShadowCanvas.jsx:242`, `ShadowStill.jsx:63` (copy `:106`) | Screen-reader users, every width |
| 4 | "Send Shadow into a game" | The Deploy card's title: `sections/DeploySection.jsx:165` (copy `:500`) | Desktop, tablet and stacked. Not the phone, and not the phone's Loadout sheet |
| 5 | "Your Shadow · fitted preview" | The desktop armory dialog's centre label: `Armory.jsx:443` (copy `:687`). Reached from the Loadout sheet's armor row | Desktop, tablet and stacked. Not the phone's armory sheet |
| 6 | "Huddle with Shadow" | The Huddle sheet's eyebrow: `HuddleSheet.jsx:20` (copy `:149`). Reached from the chip, the Huddle "Needs you", the Partnership tab and the reconfirm link | Huddle members only |

**In the code, not drawn in the book layout:**

| The string | Why it is not drawn |
|---|---|
| "Shadow deploys with your equipped loadout." (`hub/hubCopy.js:413`) | It is the next-action card's "why" line. The card is not drawn, and the strip draws no "why". |
| "Choose the armor Shadow wears into battle. Select a set to see it fitted." (`:686`) | Drawn only with per-game loadouts off (`Armory.jsx:433-437`). They ship on. |
| "Shadow wearing {archetype} — …" (`:669-670`) | The armored hero's label. In this layout the phone hero never hosts the armory, and the hub's hero stays bare. The pinning row found none in either armory. |

**The layout's own region and its two new sheets: none.** The tab row, the four panels with every row and slot opened, "Needs you", the Loadout sheet and the phone armory sheet draw no "Shadow".

**The agent's own words.** R1 named these as a possible carrier (a desk's note written while the model was still told it was "the Shadow desk"). B6, now on `main`, replaces the old desk names inside a desk's own words on the server. So once this PR merges `main`, that source is closed; the fix round can confirm it with the builder's server-side scan.

**Outside the hub, for completeness:** a trait combination is labelled "Institutional Shadow" (`src/data/traitCombos.js:36`). It is not the agent's name, and nothing in the Command Center directory imports that file.
