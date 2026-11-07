# Review: Armory A1 (PR #1024)

**Run date:** November 6, 2026 · **Model:** Claude Fable 5.1 · **Target:** PR [#1024](https://github.com/fashraf94/TradeSeven/pull/1024), branch `claude/armory-a1` @ `13395641` (open, draft, mergeable; the head checked by `gh pr view` and `git ls-remote` before any read) · **Base:** `main` @ `9d97b396` (the branch's merge base) · **Review tree:** the app worktree `claude/armory-a1-review-3da9c7`, reset to `13395641`; this report is its one commit, pushed by refspec to `claude/armory-a1`.

**Preamble.** `git fetch origin` ran first. Fenced files read, never edited: `api/agent/decide.js` (`:360-410`, `:428-434`, `:549-556`, `:960-975`, for §14's no-book claim), `api/_utils/agentBattleService.js` (`:204-212`). Fenced functions called: none. No code changed in this commit; `main` is not merged in (the fix pass does both). The smoke branch `claude/armory-a1-smoke` (`7af066e6`) is out of scope: its diff against the head is three files (the two flag flips in `agentFormFlags.js`, the corner readout in `HubAgentForm.jsx`, 26 report lines); at the head both flags read `false` and `HubAgentForm.jsx` is `main`'s file (empty diff), so nothing from it reached #1024.

**Finding ids.** `AR-1`, `AR-2`, … as the brief asks. Known collision: the S2a build report and `attemptReducer.test.js:644` use `AR-19`…`AR-61` for that slice's attempt-reducer mutants; this review writes no `AR-` id into code, so nothing clashes in the tree.

**Linux trees left for the fix pass** (remove with the build's `~/pd-a1f-runs`): `~/pd-ci-a1r` (the head, the suite and lint ran here; the two extra mutants ran here and restored the tree), `~/pd-ci-a1rm` (`main` `9d97b396`, the identity build), `~/pd-ci-a1rx` (the mutating lens: the five mutants and the F3 probe, restored clean), `~/pd-ci-a1rh` (the head with the flag set `true` and the untracked `harness-armory/` + `vite.harness.config.mjs`; its preview server on port 4197 was stopped), and the run folder `~/pd-a1r-runs` (`suite.json`, `suite.log`, `lint.log`, the four `dist` trees, `mutants/`, `mutants2/`, the X3b logs). The harness and its three measurement scripts (`measure-r.mjs`, `measure-scroll.mjs`, `measure-f1.mjs`) are in this session's scratchpad, not committed. A copy of this report: `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261106_REVIEW_ARMORY_A1.md` (BUILD_RULES §3).

---

## In plain words

On the phone, closing the armory (Close, Escape or a successful Equip) hands focus back to the "Change archetype" button, and the hub scrolls to show that button, so Shadow's box leaves the screen and the armor comes off out of sight; one option on one line (`focus({ preventScroll: true })`) keeps the figure in view, and the harness confirms it. Everything else the report claims checks out when rebuilt and re-measured here: the flag-off build is byte-identical to `main`, the suite and the lint gate are green, the ring fits at 320, 360 and 390 at every pixel ratio, at most two figures ever draw at once, and the rulings are built as written; the remaining findings are test gaps and A2 notes.

## Verdict

**MERGE AFTER FIXES.** Blocking: **0**. Should-fix: **2** (AR-1, AR-2). Notes: **7** (AR-3 to AR-9). The fix pass that applies N3 and N4 and merges `main` carries the two should-fixes; both are small.

| # | Severity | Where | Finding | Smallest fix | Refuted? |
|---|---|---|---|---|---|
| **AR-1** | **should-fix** | `src/components/CommandCenter/Armory.jsx:395` | On the phone every player-driven close (Close, Escape, Equip) scrolls the hub so the hero leaves the viewport; the engine's visibility gate then draws nothing, and N1's "one unequip as the box collapses" plays off-screen (§2.3, §2.4) | `opener.focus({ preventScroll: true })`; a jsdom row that spies the opener's `focus` and asserts the option | **CONFIRMED** (§4.2) |
| **AR-2** | **should-fix** (test) | `src/components/CommandCenter/CommandCenterHub.jsx:338` | The flag-on `selectTab` arm's `deploy?.cancelCharging()` is held by no row: mutant AR-M2 (the call removed from that arm alone) survived 231 rows across ten files (§3) | A flag-on row in `CommandCenterHub.s2b.jsdom.test.jsx`: a hold charging, a tab switch, the charge cancelled and the armory closed | **CONFIRMED** (§4.1) |
| AR-3 | note (test) | `CommandCenterHub.armory.jsdom.test.jsx:93`, `CommandCenterHub.s2b.jsdom.test.jsx` | The fixtures' agent wears `momentum_chaser`, the ring's first set, so "focus starts on the equipped set", "reopens on the equipped set" and "a fresh armory previews the equipped set" cannot tell *equipped* from *first*: AR-M3 (focus the first option) survived; AR-M4 (`firstPreview` always the first set) was killed by the unit row in `Armory.test.js` alone | Give those rows an agent on another set (`analyst`) | **CONFIRMED** (§4.1) |
| AR-4 | note (guard) | `commandCenterHub.mount.guard.test.js:1202`, `:1256-1258` | The `agentService` allowance is checked as a union over the hub directory; the writers row pins the two files and `Armory.jsx`'s names, not `LoadoutSheets.jsx`'s. AR-M5 (`changeArchetype` also imported in `LoadoutSheets.jsx`) survived | Pin `LoadoutSheets.jsx`'s names to `['equipWatchlist', 'unequipWatchlist']` beside the `Armory.jsx` pin | **CONFIRMED** (§4.1) |
| AR-5 | note (F1) | `HubSheet.jsx:55`, `LoadoutSheets.jsx:142-146`, `useHubSheets.js:75` | Desktop Safari: the dialog gets no `opener`, the stack is not told either, so a click that does not focus the button returns focus to `<body>` on close. Emulated: focus after Escape = `BODY` for the armory, the button for the History sheet under the same click | A2, when the flag flips: pass `sheet.opener` through `LoadoutSheets` → `Armory` → `HubSheet` (three lines) | **CONFIRMED** (§4.2) |
| AR-6 | note (A2) | `Armory.jsx:79`, `ShadowStage.jsx:285` | Under 315 CSS px of viewport the ring clips in the stage's `overflow: hidden`: the Close loses 5 px at 310 and 15 at 300; the sets clip below 300 (9.45 px at 290). Safari's page zoom ("Aa") shrinks the CSS viewport: a 375-pt iPhone at 125 % is 300 px, at 150 % 250 px | A2: FD-8's bottom-sheet fallback under about 315 CSS px (the ring cannot shrink: at 262 px of inner width the sets meet the hero) | **PARTLY REFUTED** on the threshold (was "below 320"); the numbers hold (§4.2) |
| AR-7 | note (F3) | `ShadowStage.jsx:291`, the armory jsdom suite | A hero remount while the phone armory is open kills the vitest worker by heap exhaustion in both pools; a render-count tripwire never fired and React printed no update-depth warning, so the cause is not a React loop and was not located. Every real remount path ran clean in a real browser (§2.3) | None for A1; A2 may want a jsdom row with a hard memory cap if it ever adds a remount | — (measured, not a defect in shipped code) |
| AR-8 | note (rulings) | `hub/hubCopy.js:541`, `hubCopy.guard.test.js` | N3's line passes every copy-guard row but the FD-1 exact pin (57 rows, 1 fail, by design). N4 already holds: the menu and Report a bug open over the hub and touch no sheet; nothing pins it | Fix pass: the pin, §0/§1.5/§13 of the report; one row for N4 | — (recorded for the fix pass) |
| AR-9 | nit | `CommandCenterHub.jsx:343` | The hold's render-time close keys on `holdPhase` truthiness; `HOLD_PHASES.IDLE` is the string `'idle'` (truthy). The reducer stores only `charging` and `locked` today (`attemptReducer.js:377`, `:386`), so nothing is wrong, but an explicit compare costs nothing | compare `holdPhase` against `CHARGING` or `LOCKED` by name | — |

---

## 0. The founder's rulings, as the brief gives them

D1–D5, FD-1 to FD-11, N1 and N2(a)–(d) are in the report's §0 exactly as the brief states them (checked line by line; FD-7 marked superseded by N1). Two more, decided Nov 6, 2026, are recorded here and **not** counted as findings; the fix pass applies them.

| # | Ruling | State at `13395641` | Checked |
|---|---|---|---|
| **N3** | The footnote is reworded: "Equipped now · a game already running keeps the armor it deployed with." | FD-1's sentence still shows (`hubCopy.js:541`) | The new line planted in a Linux worktree and run through `hubCopy.guard.test.js` + `Armory.test.js`: **57 rows, 1 fail**, the FD-1 exact pin (`toBe('Shadow wears it now; …')`), which the fix pass moves. No growth word, digit or banned claim (`game` singular is not in the plural-count list; `/next deploy/` absent). No reword needed. The jsdom rows pin the footnote by reference and follow the table. |
| **N4** | The app menu and "Report a bug" leave the armory open underneath; only N2(d)'s triggers close it | Already so: `openMenu` is App's `setSidebarOpen(true)` and `reportBug` dispatches the ClashBot event (`useHubRuntime.js:72`, `:187-188`); neither reaches the hub's sheet slot. The desktop dialog is modal, so N4 is a phone fact | No row pins it (AR-8) |

---

## 1. Lens by lens

### 1.1 Flag-off identity (lens 1) — **holds**

Rebuilt here, not read from the report: WSL worktrees of `main` `9d97b396` and the head, LF trees from git, the same install (`package-lock.json` `40382e64edb6` on both), `vite build --minify false --sourcemap false`, hashes masked (`-[A-Za-z0-9_-]{8}.js|css`), each file keyed by its masked name plus its first 160 bytes (the report's own collision fix):

| Build | Files | Result |
|---|---|---|
| Unminified, masked | 55 / 55 | **0 files differ, 0 lines** |
| Minified (as Vercel builds it) | 107 names, identical sets | **all 58 non-map files byte-identical**; the 49 source maps differ (new source text) |

The head's minified chunks are `main`'s own files: `index-BYnPCOYp.js` 4,843,048 B, `CommandCenterHub-B9LroiTM.js` 141,720 B, `agentGrowth-CNRf8kTV.js` 5,485 B, `index-C9h9-yhu.js` 614,825 B, `index-Bt3Ms9P_.css` 36,828 B.

**The wrapper's two values.** `coreStage={SET_ALONE}` (0) and `allegiance={UNLIT}` are read only inside the flag's two literal ternaries (`agentFormSpec.js:81`, `:85`). No existing caller can pass them by accident, flag on or off: `HubAgentForm.jsx:74`, `BattleAgentForm.jsx:42`, `LeagueAgentForm.jsx:40` all take `coreStage` from `getAgentGrowth()`, which returns 1 (`agentGrowth.js:13`); their allegiance is the literal `'player'` or `'opponent'`; the lab's controls offer stages 1–3 and allegiances player / opponent / both (`AgentFormLab.jsx:189`, `:191`), and only its four armory presets pass the values. With the flag off, `stageIndex(0)` is stage 1 with its brain and `UNLIT` is teal (`agentFormSpec.armoryOff.test.js`).

### 1.2 N1, neutral Shadow (lens 2) — **holds**

Every production mount of `AgentForm`: `HubAgentForm.jsx` (the hub hero), `Armory.jsx`, `BattleAgentForm.jsx` and `LeagueAgentForm.jsx` (game seats; the battle mark through `CharacterAvatar.jsx:280` is a seat), and `AgentFormLab.jsx`. The record sheet, onboarding and the Forge draw no form. The hub hero's read is bare at the hub's one Provider (`CommandCenterHub.jsx:651`) and `HubAgentFormContext` has no other consumer than `HubAgentForm` and `PhoneArmoryStage`, which re-dresses it only while open. The suit-up path is inert while bare: `kind` never changes for an undefined archetype, so the wrapper calls `update`, never `swap` (`AgentForm.jsx:111`); `HubAgentForm.jsx` is `main`'s text, so the flag-off rollback is intact. In the browser, flag on: the phone hero's name reads "Shadow — ambient", after an equip on the desktop "Shadow — …" with the Loadout card naming the new set. The lab's first view still wears the Form control's set; it is a dark dev tool, not a player surface, so N1 does not reach it — noted for A2's copy of the ruling.

### 1.3 The phone hero's single path, and F3 (lens 3)

**Single path, confirmed.** The hero's wrapper is `display: contents` while closed (measured `contents` in the browser; `block` while open) and the same `<canvas>` node survives an open and a close (a mark set on it before the open is still there after; `forms.unmounts` 0 in the jsdom rows). `armoryHeroRead` keeps the agent's id, so the wrapper's `key` never changes.

**The remount probes, in a real browser** (headless Edge 156 on the Iris Xe GPU, the flag-on harness):

| Path | What happened |
|---|---|
| An agent switch while the phone armory is open (a new id: the hero remounts inside the open scope, exactly the X3b shape) | No error; the hero live again in 103 ms; the preview and the status follow the new agent ("Previewing · Equipped set is Fundamental Investor"); 7 views, 1 drawn per frame |
| The App's `isMobile` flip (`App.jsx:2225`, ≤ 768 px) while open, driven as App does it, by the `site` prop | No error; the keyed shell remounts (`CommandCenterHub.jsx:681-682`), so the sheet state goes and the armory is closed on the wide site; the hero live; back to mobile, the same |
| A viewport change within the mobile site (374, 320, 1000 px) while open | Nothing remounts: the mobile site's composition is always `phone` (`composition.js:54`); the armory stays open, 7 views, no error |

**F3.** Mutant X3b (a key on the hero's Provider toggling with `open`) reproduced the crash: under `--pool=forks` the worker dies after 113 s with "Ineffective mark-compacts near heap limit — JavaScript heap out of memory"; under `--pool=threads` in 31 s with `ERR_WORKER_OUT_OF_MEMORY`; both exit non-zero (killed, as the report says, by the exit code, not a row). The first 22 rows pass; the first phone row dies. A tripwire in the stand-in form (throw on its 3,000th render) never fired and React logged no "Maximum update depth" or "Too many re-renders", so it is **not a React update loop**; the allocation that grows was not located and is a test-environment hazard only — nothing in the browser probes above hangs or errors.

### 1.4 N2(d), the close rules (lens 4) — **holds; one in-flight nuance**

Every way the hub can deploy or navigate while the phone armory is open, and what covers it:

| Trigger | Covered by |
|---|---|
| The strip's hold, the next-action card's hold | `deploy.holdPhase` (charging or locked) closes it while the hub renders (`:343`); `holdPhase` is non-null only until the request begins (`useHubDeploy.js:128-129`) |
| The strip's Retry | the wrapped `onAction` (`:415`) |
| The strip's Dismiss, Check deployment | leave it open (no deploy) — as read 4 |
| The strip's "Open game", a live-battle row, Game history's rows, Activity, the next action's Open game, the Film Room | `hub.openGame` / `hub.openFilmRoom` leave the hub; its state goes with it |
| Another hub tab | `selectTab` (`:338`); the Loadout tab is no switch |
| The watchlist, record, traits and Scouting sheets | the one sheet slot (`useHubSheets`) |
| The Forge doors | `forgeDoor` closes the sheet first (`useHubRuntime.js:166`) |
| Profile | `hub.setScreen('profile')` leaves the hub |
| The app menu, Report a bug, notifications, the bottom bar | open over the hub or leave it; N4 says leave the armory open under the first two |
| Deep links | App-level screen changes; the hub unmounts |

**The in-flight equip.** A late result cannot close or alter anything it did not open: the phone details' root carries `detach`, so any close unmounts it and bumps the session (`Armory.jsx:129`, `:485`); the desktop dialog's root does the same (`:316`); a result then returns before `onEquipped` (`:136`, `:145`). Verified by the two late-result rows and by reading. One nuance, not a defect: a result dropped this way leaves `working: true` in the phone scope until the next open's `reset()` (`:390`), and between the two nothing reads it.

**Close paths and the scroll (AR-1).** The external closes (a tab, a sheet, a hold) do not move focus and keep the stage in view — measured: a tab switch leaves the hub's scroll box at 8 px and the hero draws 36–37 frames per 600 ms through and after its unequip. The player-driven closes go through `PhoneArmoryScope.close()` → `opener.focus()` (`:395`); see §2.3.

### 1.5 Equip (lens 5) — **holds**

`changeArchetype(agent.id, codeId)` once, nothing while `working` (`:131-135`). The 409 mapping is right in both directions: the route answers `{ error: 'battle_active', message }` with status 409 (`change-archetype.js:88`, `:303-308`) and `toEquipError` sets `err.status` and `err.code = data.error` (`agentService.js:374-376`), which is the shape `isBattleLock` reads (`:95-97`) and the shape the rows mock. `epoch_closed` and `composition_blocked` keep the server's words (`:103-106`; the row at `CommandCenterHub.armory.jsdom.test.jsx:264-266`); a wordless failure shows the picker's line; `dialInvalidated` shows the notice and keeps the armory open. The record reaches the Loadout card live: `useAgent` subscribes (`subscribeToUserAgent`, `useAgent.js:44`), so no refresh call is owed after the write.

**The mount guard's allowance** is exactly as stated for `Armory.jsx` (`importedNames(...) toEqual(['changeArchetype'])`, `:1257`) and for the writer files (`:1256`), and the union across the directory is the three names (`:1202`). Not pinned: `LoadoutSheets.jsx`'s own names (AR-4).

### 1.6 Accessibility (lens 6)

The ring is `role="listbox"` with `aria-orientation="horizontal"`; each set is a `<button role="option">` named by the set, `aria-selected` follows the preview, `tabIndex` roves (0 on the selected one); Arrow keys, Home and End move the preview and focus (`useRingKeys`). The status line is `role="status" aria-live="polite"`. Escape closes the dialog (HubSheet) and the phone ring (the stage's `onKeyDown`). On the phone the hero is `aria-hidden` while open and the figures are decorative; focus lands on the selected option at open (`focusOnOpen`) and returns to the opener on close. On the desktop focus lands on Close (HubSheet's convention) and returns to the clicked control — in Chromium. **F1 (AR-5):** with the click leaving focus on `<body>` (Safari's behaviour for a mouse click on a `<button>`, emulated by dispatching the click), focus after Escape is `BODY` for the armory dialog and the History button for the History sheet, which receives `opener`. Size: desktop Safari mouse users and VoiceOver clicks; keyboard activation (Enter on a focused button) is unaffected. Smallest fix for A2, once bytes stop mattering: thread `sheet.opener` through `LoadoutSheets` to `Armory` to `HubSheet` (the History sheet already shows the shape, `CommandCenterHub.jsx:561`).

### 1.7 The phone layout (lens 7)

Measured in the flag-on harness, phone contexts with touch, at 320, 360 and 390 CSS px, each at 2× and 3× (390 also at 1×). The geometry is CSS px, so the pixel ratio changes nothing but rasterisation — the numbers are identical in all seven cells:

| Measure | Value |
|---|---|
| Set ↔ hero clearance | **0.453 px** (the report's 0.45) |
| Set ↔ set, Close ↔ set, "Armory" mark ↔ set | 52.45, 14, 39 px |
| Hero, set, Close, Equip | 152 px; 48 × 48; 44 × 44; 44 high |
| Inside the stage; page overflow | all inside at every width; 0 px |

**Dynamic Type and page zoom (AR-6).** iOS's larger-text setting leaves px-sized web text alone (the page sets a viewport, so Safari's text-size adjust is off), so the text column under the ring does not move with it. Safari's own page zoom does shrink the CSS viewport (a reading of WebKit's behaviour, not a measurement here). Measured at 3×: the box is 280 + 2 × 5 padding = 290 against a stage content width of `width − 40`, so 320 is the exact fit; below it the box overflows the content box and clips at the stage's padding edge (`width − 30`), so the Close is cut from **315** CSS px down (5 px at 310, 15 at 300) and the sets from **300** down (9.45 px at 290; the refuter's sweep, §4.2). Nothing overflows the page because the stage hides it. A 375-pt iPhone reaches 300 CSS px at 125 % zoom and 250 at 150 %; a 390-pt one 260 at 150 %. The ring cannot shrink to fit: scaling the radius and the centre together puts the set-to-hero clearance negative at 262 px of inner width. FD-8's own fallback (the board's bottom sheet) under about 315 CSS px is the honest answer, for A2; at the common 125 % step the Close stays tappable with 15 of its 44 px cut.

### 1.8 Performance (lens 8) — **holds**

The engine's own counters (`info()`) and per-frame samples, flag on:

| Surface | Views mounted | Drawn per frame |
|---|---|---|
| Phone 390, open, idle | 7 | **1** (the hero) |
| Phone, a set held under a touch | 7 | **2**; lifted: 1 |
| Phone, 18 rapid taps round the ring in ~0.6 s | 7 | **max 2**; settled: 1 |
| Phone, after Close | **1** | 1 (but see AR-1: the hero is off-screen and draws 0 until scrolled back) |
| Desktop 1440 × 900, open, idle | 8 (hero paused + centre + 6) | **1** (the centre); `paused: 1` |
| Desktop, a set hovered | 8 | **2**; after: 1 |
| Desktop, after Escape | **1** | 1 |

A set lifted or left draws its designed still pose again, not a frozen frame: a rate dropped to `still` runs `drawNow` at `stillT` (`engine.js:447`, `:299-306`). Teardown is complete on close (views 7 → 1, 8 → 1).

### 1.9 Tests (lens 9)

- **Rows.** No vacuous row found: the no-flash row toggles the gate and watches it; the hero-paused row reads `paused` both ways; the late-result rows would catch a non-dropped result (the new dialog would close). Order independence: every module-level record (`mounted`, `forms`, the flags) is reset in `beforeEach`; the N1 loop rows unmount between iterations. Real-time waits: one, bounded (`armory.seats.jsdom.test.jsx:35`, a 5 ms poll up to 3 s for `use()`), under the row timeout. The one weakness is AR-3 (the first-set fixture); AR-2 is a coverage gap in a duplicated arm.
- **The gemma red.** Unrelated to this branch: `api/` is untouched by the diff and `api/_utils/gemmaClient.test.js` last changed on 2026-09-03 (`59ff37a1`). Its mechanism is a 120 ms abort timer racing the loopback server's first byte (`:199-204`; the file's own comment explains the two windows); WSL wall-clock steps are a known cause of such misses on this machine. Size here: **0 reds in 21 runs** (the full suite plus 20 runs of the file alone, under the suite's load); the build session saw 1 in about 5 full runs. Separate tasking, as the brief says.
- **Mutants of this review** (§3): seven, plus the X3b reproduction; three survived (AR-2, AR-3, AR-4).

### 1.10 Docs (lens 10) — **holds**

- The committed loadout boards: the three `.jsx.txt` sources carry no three.js, React, Babel or font bytes (the one "three" is "three house agents"); their SHA-256 and sizes match the README exactly on the committed blobs (`4cc7a34c…` 16,576; `d4d630fc…` 17,928; `868a26cc…` 28,730; the HTML `66a961a4…` 2,063,151). The Windows checkout converts them to CRLF (no `.gitattributes` rule), as it does every text file; the blobs are LF. The HTML does carry three.js r184, React 18.3.1 dev builds, Babel standalone and eight woff2 subsets inside its manifest, 2.06 MB in all — exactly as the three earlier Claude Design exports in `docs/design/` do; the README says so.
- §14's no-book claim, read only: `decide.js:378-381` declare the nulls and `:381` reads the list only `if (agent.equippedWatchlistId)`; `:367-371` rank the universe; `:405-408` the carriage with no list; `:431-434` and `:551-555` hand the prompts `null`; `:964-971` create the battle with `equippedWatchlist: equippedWatchlistSnapshot`, stored `null` (`agentBattleService.js:208-210`). The golden's `self_select_no_equip` answers 200, `battleCreated: true`, `agentContext.equippedWatchlist: null` (`deployCarriageOffGolden.json`, pinned at `decide.carriage.test.js:203-209`). Lines drift by one against the report's citations; the facts hold.
- §0 matches the brief's rulings (above).

### 1.11 Rules (lens 11) — **holds**

- Tokens and motion guards: `Armory.jsx` registered at count 0 in both baselines; the guards ran green in the suite.
- No guard loosened beyond the stated allowance (every guard diff read: lists extended, counts raised to the new files, rows added; AR-4 is the one place the new allowance is looser than its sentence).
- `lint:gate`: **exit 0** on Linux at the head.
- Full suite, Linux (WSL, `TZ=UTC`, 8 workers, under `flock /tmp/pd-suite.lock`, Node 20.20.2), at `13395641`: **1,282 files (1,274 passed, 8 skipped), 28,423 rows, 28,334 pass, 0 fail, 89 skipped, 279 s.** WSL was not restarted.

---

## 2. AR-1 in full: the phone close scrolls the hero away

### 2.1 What happens

`PhoneArmoryScope.close()` returns focus to the control that opened the armory (`Armory.jsx:392-396`). That control is the Loadout panel's "Change archetype" button. While the armory is open the stage is about 640 px tall and the button sits around 1,100 px down the hub; when the armory closes the stage collapses to about 300 px, and `opener.focus()` makes the browser scroll the button into view. The hub's scroll box is its own root `<section>` (`CommandCenterHub.jsx:347-360`: `height: 100dvh; overflowY: auto; scrollPaddingTop`), rendered by the hub itself, so App's wrapper does not change this. The scroll padding is deliberate (S1 review L3-5: a focused row kept clear of the sticky tab row) and right everywhere else; the armory's close is the one case where the thing the player is watching, the collapsing stage, is 400 px above the control that takes focus.

### 2.2 Measured (headless Edge on the real GPU, the flag-on harness, the stubbed equip answering in 300 ms)

| Viewport · close by | Hub scrollTop before → +80 ms | Stage top after | Hero in viewport | Frames drawn in the 600 ms after the close; the 600 ms after that |
|---|---|---|---|---|
| 390 × 844 · Close | 8 → **365** | **−301** | no | **0; 0** |
| 390 × 844 · Escape | 8 → **365** | −301 | no | 0; 0 |
| 390 × 844 · Equip (closes at +300 ms) | 8 → **345** | −281 | no | 14 (before the result); **0** |
| 390 × 844 · a tab switch (external close) | 8 → 8 | 56 | **yes** | **37; 37** |
| 320 × 568 · Close | 16 → **510** | −438 | no | 0; 0 |

The engine's visibility gate is working as designed: a view that is not intersecting is skipped (`engine.js:332`), so the 700 ms unequip runs on the clock and the hero shows bare whenever the player scrolls back. The build's frame sampler read "0 placeholder frames, the hero's canvas never hidden, its box 152 → 200" — all true of an element that has left the viewport (`checkVisibility` is CSS visibility; the box's width does not say where it is). The smoke preview `7af066e6` carries this close path, so the follow-up's phone-check item 2 ("closing takes the armor off once as the box shrinks back") could not be observed as built.

### 2.3 The smallest fix, confirmed

`opener.focus({ preventScroll: true })` at `Armory.jsx:395`, planted in the throwaway harness build and re-measured on every path:

| Viewport · close by | scrollTop | Stage top | Hero in viewport | Frames (600 ms; 600 ms) | Focus |
|---|---|---|---|---|---|
| 390 × 844 · Close | 8 → 8 | 56 | yes | **36; 36** | Change archetype |
| 390 × 844 · Escape | 8 → 8 | 56 | yes | 35; 36 | Change archetype |
| 390 × 844 · Equip | 8 → 8 | 56 | yes | 35; 34 | Change archetype |
| 390 × 844 · tab | 8 → 8 | 56 | yes | 36; 37 | Overview |
| 320 × 568 · Close | 16 → 16 | 56 | yes | 36; 37 | Change archetype |

Trade-off, measured: the focused button then sits at 757 px (in view at 844) and at 753 px at 320 × 568 (below that fold); a keyboard user who presses Escape has focus one swipe below. Why not "scroll back after the unequip": that needs a timer or an effect, and `Armory.jsx` holds neither by the mount guard's rows. Why not leave focus unmoved: the phone ring's focus return is the one that works today (the row at `CommandCenterHub.armory.jsdom.test.jsx:558-569`), and keeping it is right. For the fix pass: jsdom cannot see scrolling, so the row is a spy on the opener's `focus` asserting `{ preventScroll: true }`; the harness run above is the browser proof.

---

## 3. Mutants of this review

Linux, the runner the follow-up used (one exact replacement, anchor found once, ten files run with 6 workers, the file restored from git, the tree checked clean; **killed = non-zero exit or timeout, never the JSON alone**). Baseline: 231 rows, 0 failed. The five ran in `~/pd-ci-a1rx`; AR-M6 and AR-M7 in `~/pd-ci-a1r` after the suite.

| Id | In the follow-up's code? | Mutant | Result | Killed by |
|---|---|---|---|---|
| AR-M1 | no (A1) | `isBattleLock` on the status alone: every 409 shows the lock line | **KILLED** | `Armory.test.js` (two rows), the N2(a) desktop row (its `epoch_closed` second half) |
| **AR-M2** | **yes** (`470fb2b5`) | the flag-on `selectTab` arm drops `deploy?.cancelCharging()` | **SURVIVED** | — (AR-2) |
| AR-M3 | no (A1) | focus on open goes to the first option, not the selected one | **SURVIVED** | — (AR-3: the fixture equips the first set) |
| AR-M4 | no (A1) | `firstPreview` always returns the first set | KILLED | `Armory.test.js` › "a fresh armory previews the equipped set…" alone; no integration row (AR-3) |
| AR-M5 | no (the guard) | `LoadoutSheets.jsx` also imports `changeArchetype` | **SURVIVED** | — (AR-4) |
| AR-M6 | **yes** (`470fb2b5`) | the hold's render-time close only at `'locked'`, not while charging | **KILLED** | the s2b hold row ("pressing the strip's hold closes it…", which reads the armory closed right after `pointerdown`, while the hold is charging) and the flag test's exact-sites row |
| AR-M7 | **yes** (`f44804c0`) | `armoryHeroRead`'s not-ready pass-through reduced to a null check | **KILLED** | `Armory.test.js` › "a read that is not ready, or has no agent, passes through unchanged" (an identity check) |
| X3b | the F3 probe | a key on the phone hero's Provider toggling with `open` | KILLED: worker OOM, exit 1 (both pools) | not a row: the worker died (§1.3) |

Seven mutants, three in the follow-up's own commits (AR-M2, AR-M6, AR-M7): four killed by rows, three survived (AR-2, AR-3, AR-4), plus X3b killed by the worker's death. The one control the follow-up ran (a comment beside the bare read) was not repeated.

---

## 4. The refutation pass (BUILD_RULES §2)

Two refuters, read-only on git and the tree, each given the finding, its evidence and the ways it might be wrong; the browser findings could re-run the harness scripts against the running preview, the test findings could re-run mutants in the review's mutating worktree.

### 4.1 The test findings (refuter B, static reading of the tree and the runner's results; it ran no tests and touched no tree)

| Finding | Verdict | The refuter's evidence |
|---|---|---|
| AR-2 | **CONFIRMED** | No test file under `src/` mentions `cancelCharging`. The s2b suite's two cancel rows (`:229` mobile, `:296` desktop) run with `h.armory = false` (`:133`), so they exercise the flag-off arm; the desktop row goes through `selectArea`, which the mutant never touched. The flag-on N2(d) block never clicks a tab while a charge is live (its hold row closes through the render-time `holdPhase` check, not `selectTab`). The armory suite's tab rows run the flag-on arm but mount no deploy provider, so `deploy` is null there and the call was already a no-op. The call is real in production (`DeployAttemptContext.jsx:292` cancels the charge and releases the claim). Objection left: severity only — the flag is dark and the row is a one-line `h.armory = true` variant of `:229`. |
| AR-3 | **CONFIRMED** | Both hub fixtures wear `momentum_chaser` = `ARMORY_SETS[0]`. Every row that varies the archetype asserts bareness, the Loadout card or `closesOnce`, never `activeElement` or `aria-selected` after an open. The keyboard row focuses `option('momentum_chaser')` by hand, so it never exercises `focusOnOpen`, which is module-private and phone-only; no other flag-on suite renders the ring with an equipped set. `firstPreview` has its unit row, which is what killed AR-M4. Objection left: AR-M4 is covered at unit level, so the phone ring's focus is the one true hole — a note, as graded. |
| AR-4 | **CONFIRMED** | `NAMED` is unioned across the directory by design (`:1226`); the writers row pins the two files and `Armory.jsx`'s names, never `LoadoutSheets.jsx`'s; the services list pins specifiers, not names. On lint: `no-unused-vars` is an error in `eslint.config.js:26`, but CI runs `lint:gate` only (`tests.yml:109`), whose rules are exactly `no-undef` and `react-hooks/rules-of-hooks` (`eslint.gate.config.js:36`), so even an unused import passes CI, and a used second caller passes every rule and every row. ESLint checks usage, never which file may make which write. Objection left: the fix is a one-line sibling of `:1256`. |

### 4.2 The browser and layout findings (refuter A, the harness on port 4197 and the code)

Read-only; headless Edge only (nothing ran in Safari); its probes and raw outputs are in the session scratchpad (`refuter-a/`).

| Finding | Verdict | The refuter's evidence |
|---|---|---|
| AR-1 | **CONFIRMED** | The numbers reproduce on a re-run (390 × 844: scrollTop 8 → 365 on Close, Escape and Equip, the hero at −290, 0 frames per 600 ms; the tab switch stays at 8 with 37 frames; 320 × 568: 16 → 510). The mechanism isolated at runtime by wrapping the Change archetype button's own `focus()`, no rebuild: at the instant `close()` calls it the stage still reads `data-hub-armory="open"` (638 px tall), the button sits at 1,098 px against an 844 px viewport, and the section's `scrollTop` goes 8 → 706 inside the call, settling at 365 once React commits the collapse — `close()` runs `onClose()` then `opener.focus()` in one handler, so the browser reveals a control 254 px below the fold. Forcing `{ preventScroll: true }` on that element: scrollTop 8, hero at 67, 37 frames per 600 ms, focus on Change archetype. Refutations tried and failed: `#root` (`index.css:80-84`) and App's container (`App.jsx:1495-1504`) are `overflow-y: auto` but each holds one 100dvh section, so the hub's section is the only scroller in production too; the fixture cannot be blamed (`LoadoutPanel.jsx:154-170` puts the archetype card first after the identity row in every live shape); "by design" fails (the report's `:105` says focus returns to Change archetype and nothing of a scroll; L3-5's scroll padding is about the sticky tabs). Objection left: `preventScroll` leaves the focused control below a short viewport (320 × 568: ~750 px down), the trade-off §2.3 records. |
| AR-5 | **CONFIRMED** | `measure-f1` re-run: the Safari-like click → focus after Escape is `BODY`; the Chromium click → Change archetype; the History sheet returns to its button under both shapes. `HubSheet.jsx:55` takes the `opener` prop, else `document.activeElement`; `Armory.jsx:315` passes neither `opener` nor `fallbackFocus`; `useHubSheets.js:75` skips the stack for the archetype sheet, so the clicked control stays in `openerRef` and never reaches the sheet. The stack lands nowhere better: `canFocus(body)` is true (body is never inert) and `body.focus()` is a no-op, so `tryFocus` returns true at `:165` and the fallback branch is never reached. Reach, by reading: iPad Safari at ≥ 769 px (`App.jsx:2225`) gets the wide dialog and its taps do not focus buttons either. Deferring to A2 is right: `opener` needs a new prop on `LoadoutSheets` at both call sites (`CommandCenterHub.jsx:438`, `:567`), which changes flag-off bytes unless folded through a literal ternary. Objection left: keyboard users are unaffected everywhere (Tab focuses the button), so a note. |
| AR-6 | **PARTLY REFUTED** on the threshold; the mechanism and every measured number **CONFIRMED** | A width sweep at 3×, 330 → 250 CSS px, against the stage's padding box (the clip edge under `overflow: hidden`) and its content box: content width is W − 40, the clip edge W − 30. Below 320 the 280 px box overflows the content box, `margin: auto` resolves to 0 and the box sits 5 px inside the padding edge. Visible clipping of Close begins **below 315** (0 px at 315, 1 at 314, 5 at 310, 15 at 300), not 320: at 315–319 the button is 1–5 px outside the content box but not cut. The sets clip **below 300** (0 at 300, 0.45 at 299, 9.45 at 290 — the finding's number). The three zoom scenarios reproduce (375 pt at 125 % = 300 → Close cut 15 px, sets whole; at 150 % = 250 → sets cut 49 px; 320 pt at 115 % = 278 → sets cut ~21 px). Nothing scrolls instead. That Safari's page zoom shrinks the layout viewport is a reading, not a measurement (WebKit 218379; production `index.html:6` is `width=device-width` with no fixed width, so the "zoom does nothing with an explicit width" exemption does not apply). Objection left: at the realistic 125 % step only 15 of Close's 44 px are cut and it stays tappable; the fallback is a founder design call (FD-8 (b)), not a defect of A1. |

**Split:** six findings handed to refuters; **five CONFIRMED, one PARTLY REFUTED** (AR-6's "below 320" is "below 315 for Close, below 300 for the sets"; corrected in the table above and in §1.7). AR-7, AR-8 and AR-9 were not handed over: AR-7 is a measurement, AR-8 records the brief's rulings, AR-9 is a nit.

---

## 5. Carry into A2

1. **AR-1's fix lands in the fix pass**, not A2; but A2's loadout cards and context line (§14 board 4) will add more height under the ring, so re-measure the close with the real Loadout panel below it.
2. **F1 (AR-5):** when the flag flips, pass `sheet.opener` through `LoadoutSheets` → `Armory` → `HubSheet`. Three lines; the History sheet is the template.
3. **The ring under 315 CSS px (AR-6):** FD-8's bottom-sheet fallback below about 315 CSS px of viewport, or a ruling that Safari page zoom is out of scope. The ring itself cannot shrink.
4. **The fixtures (AR-3):** give the armory rows an agent on a non-first set wherever "equipped" is asserted; A2's per-game loadouts will multiply those rows.
5. **The guard pin (AR-4):** pin `LoadoutSheets.jsx`'s `agentService` names.
6. **N3's line will move again** when an equip stops being immediate (A2's "applies to the next deploy"); the copy guard's `/next deploy/` ban and the FD-1 pin both need the ruling then.
7. **The lab's hero** wears the Form control's set; if N1 is meant to reach dev surfaces too, the lab's armory presets should start on bare Shadow.
8. **F3:** if A2 ever remounts the hero inside the open scope on purpose (a keyed loadout context, say), the jsdom suite will die by heap exhaustion rather than fail a row; find the allocation first.
9. **The 'idle' phase compare (AR-9):** one explicit compare when the hold close is next touched.
10. **The boards' measured ring stands** (46 px sets in 48 px circles round 152; §14 board 4 differs); A2 decides.

---

## 6. The founder's phone check (the A1 report's §10)

The brief said the founder's phone check would be pasted under it; nothing arrived in this session, so the §10 fill records that: **not received by the review session on Nov 6, 2026; the fix pass fills it in.** Note for that check: item 2 of the follow-up's list cannot be seen as built on the smoke preview (AR-1); after the fix pass's one-line change it can.

---

## 7. What ran, where

| Check | Where | Result |
|---|---|---|
| Identity builds (4) | `~/pd-ci-a1rm` (main), `~/pd-ci-a1r` (head) | §1.1 |
| Full suite + `lint:gate` | `~/pd-ci-a1r`, under the suite lock | green, 279 s; exit 0 |
| N3 through the copy guard; gemma × 20 | `~/pd-ci-a1rx` (restored) | 1 fail (the pin); 20 / 20 |
| Five mutants + X3b (two pools, a tripwire run) | `~/pd-ci-a1rx` (restored) | §3, §1.3 |
| Two follow-up mutants | `~/pd-ci-a1r` (restored) | §3.1 |
| Flag-on harness, built twice (the head; the head with AR-1's fix planted, then reverted) | `~/pd-ci-a1rh`, port 4197 | §1.3, §1.7, §1.8, §2 |
| Minified build of this commit, and the 14 repository-walking test files the Phase 0 report named (`hubCopy.guard`, `flagPinGuard`, `agentReadCensus.guard`, `archetypeRegistry`, `oneDoor.census`, `unconfirmedOutcome.census`, `compositionRunbookGates`, `callRecords/events`, `agent-evaluate`, `call-response.2b`, `TeamCard`, `cockpit2bFlags`, `commandCenterHubFlags`, `reset-failure-built-insight`) | `~/pd-ci-a1r`, detached at this commit's SHA, before the push | run before the push, both must exit 0 for the push to happen; the numbers cannot sit inside the commit they measure, so they are in the review's final message |

Not run: the Firestore rules suite (no rules changed); anything on a device.
