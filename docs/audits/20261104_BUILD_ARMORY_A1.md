# Build A1: the armory replaces the archetype picker

**Run date:** November 4, 2026 · **Model:** Claude Opus 5.5 · **Branch:** `claude/armory-a1`, cut from `origin/claude/phase0-armory` @ `bbad5e71` (the Phase 0 report alone, one commit over `main` @ `40641486`), with `origin/main` @ `31574600` merged in (`5dee1679`, no conflict) and, before the final checks, `origin/main` @ `9d97b396` (PRs #1021 and #1022) merged in again (`e89aaba3`, no conflict); pushed by refspec from the worktree branch `claude/armory-a1-9010a6` · **Smoke branch:** `claude/armory-a1-smoke` · **PR:** ⟨PR⟩, draft · **Preview:** ⟨URL⟩

**Preamble.** `git fetch origin` ran first. `origin/claude/phase0-armory` was `bbad5e71`, one commit over `main`, as the prompt required, and the merge of `origin/main` was clean, so neither STOP applied. The tree was clean at the start. Fenced files read: none. Fenced files edited: none. Fenced functions called: none (the armory calls `agentService.changeArchetype`, the client of the non-fenced `api/agent/change-archetype.js`, exactly as the picker does). Nothing under `api/` changed, no server, record or rules change. Line numbers below are this branch's.

---

## 0. Founder rulings (Nov 2, 2026), as given

| # | Ruling |
|---|---|
| D1–D5 | As in the Phase 0 prompt: loadouts per game (A2), the picker replaced by the armory (this build), the training chooser removed (A2), **growth display deferred** (no XP, levels, stages, thresholds or battle counts anywhere in A1), each archetype its own character (A3). |
| FD-1 | An equip takes effect on the next deploy once A2 lands. **In A1 the commit path is unchanged** (`changeArchetype`, immediate, 409 while the ranked agent is in a battle), so the armory's copy says what happens: *Shadow wears it now; a game already running keeps the armor it deployed with.* The old picker's copy is not touched in A1 (flag-off bytes stay identical). |
| FD-2, FD-3, FD-5, FD-10, FD-11 | League's loadout on the ranked record; a League week frozen; a save carries memory, paragraph, cycle, lessons, stats, traits and Character settings; the Forge strategy stays on the agent; the ranked field is the default. **All A2/A3; nothing in A1.** |
| FD-6 | Record facts (counts, first/last played, "Never worn") are A4. **A1's status line is "Equipped" or "Previewing" only.** |
| FD-7 | The hub hero wears the loadout of its surface. In A1 that is still the ranked record's field: unchanged. |
| FD-8 | **Phone: the armory opens in the hero's box.** The hero's text column folds away, the figure shrinks to 150–160 px live and centres, and the six sets sit on a ring at 44–48 px. Confirm it fits at 320, 360 and 390 px; if it can't at 320, fall back to the board's bottom sheet there and say so. |
| FD-9 | **Unworn sets are stills, live on touch** (phone) or hover (desktop). Only the centre figure and at most one touched set are live at once. |
| R1–R12, R18–R19 (S1/S2) | Hold. In particular R12 (under 40 px is a still), R10 (names from `hub/archetypeLines.js` only, the §2.3 import ratchet) and the hub copy guard. |

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **The flag** | `AGENT_FORM_ARMORY_ENABLED = false` (`src/config/agentFormFlags.js:98`), pinned, in `DARK_BY_DESIGN`. Nothing changes for players until it is flipped. |
| 2 | **Flag-off identity** | **Byte-identical to `main`.** Unminified Linux build, hashes masked: 53 files against 53, **0 lines differ**, at every code commit of the branch (§6). |
| 3 | **Desktop (board 6)** | Built: the 1040 px dialog, Shadow at 300 live in the centre wearing the previewed set, six sets on the ring (each alone, pewter unless equipped, a still until hovered), the aside with the set's name, one-liner, paragraph, the status line and Equip with the FD-1 footnote. The hero behind it is paused. Not built, as ruled: growth tiles, counts, seam flash, ring burst, hook return (§1). |
| 4 | **Phone (FD-8)** | **In the hero's box, at all three widths; no bottom-sheet fallback was needed at 320.** The hero itself shrinks to 152 px, centres and wears the preview; six sets drawn at 46 px in 48 px tap circles on a ring of 116; measured in a real browser: no overlap, no overflow, every target ≥ 44 px (§2). |
| 5 | **No flash, no black square, no second suit-up** | Measured frame by frame in headless Edge on the real GPU: **0 placeholder frames on open or close**, the hero's canvas never hidden, at desktop and at 320 / 360 / 390. The hero never remounts. A preview taken off on close is drawn at once, never suited up; after an equip the hero keeps the new set until the agent record catches up (§3). |
| 6 | **Equip** | `changeArchetype` once, with the chosen set; a battle lock (409 `battle_active`) shows the hub's own "Locked in battle" line; other refusals keep the server's words; a tempo-dial reset shows its notice (§1.4). |
| 7 | **Lab** | Four presets for FD-9: one live at 160 + six stills at 48, one live at 300 + six stills at 112, and both with all seven live (§4). The lab flag stays `false`. |
| 8 | **Guards** | None loosened. Four registered the new file, as their own instructions say; one gained the new write's name (`changeArchetype`); three gained rows (§5). |
| 9 | **Mutation** | **26 of 26 killed**, the eight the prompt names among them; one control survives, as it must (§7). |
| 10 | **Checks** | ⟨CHECKS⟩ (§8). |
| 11 | **Review threshold** | **Over it: stop at the draft PR.** ⟨DIFF⟩. BUILD_RULES §2 asks for a review at 10 files or 1,500 lines, so a review session runs before merge. |
| 12 | **Not proven** | Nothing here has run on an iPhone. The checklist (§10) is how the phone decides FD-9 and the sizes. |

---

## 1. What was built

### 1.1 The files

| File | What |
|---|---|
| `src/config/agentFormFlags.js:85-98` | The flag, `false`, with its docstring and `Pinned by:` pointer |
| `src/components/CommandCenter/Armory.jsx` (new) | The armory: the wide dialog (`ArmoryDialog`, `:290`), the phone's state (`PhoneArmoryScope`, `:365`) and ring (`PhoneArmoryRing`, `:425`), the shared aside (`ArmoryDetails`), the equip (`useArmoryEquip`, `:115`), the geometry (`DESKTOP_RING` `:61`, `PHONE_ARMORY` `:72`) |
| `src/components/CommandCenter/LoadoutSheets.jsx:142` | The archetype sheet: the armory with the flag on, the picker with it off (one literal ternary). `ArchetypePicker.jsx` is untouched |
| `src/components/CommandCenter/ShadowStage.jsx:196`, `:265` | `PhoneStage` is `PhoneArmoryStage` with the flag on: its closed layout is `PhoneStage`'s own; open, the armory takes the hero's box |
| `src/components/CommandCenter/HubAgentForm.jsx:106` | One prop: a preview taken off on close is drawn at once (`instant`) |
| `src/components/CommandCenter/CommandCenterHub.jsx:353`, `:481` | The phone stage wrapped in the armory's scope; the wide hero paused while the dialog is open |
| `src/components/CommandCenter/hub/useHubSheets.js:75` | With the flag on the archetype sheet is not a "shipped sheet": the dialog registers itself; the phone armory is part of the hub, not an overlay |
| `src/components/AgentForm/agentFormSpec.js:57-85` | The wrapper's two looks (Phase 0 §7.2), values of props it already takes (below) |
| `src/components/CommandCenter/hub/hubCopy.js:530` | `ARMORY_COPY`, a table of its own |
| `src/components/CommandCenter/hub/archetypeLines.js:44` | `armoryLines`: name, one-liner and paragraph, through the hub's one §2.3 importer |
| `src/screens/AgentFormLab.jsx:26` | The four armory presets |

### 1.2 The wrapper's two options, and why they are values

The engine already draws a set with no brain (`brain: false`) and in the pewter palette (`pal: 'unlit'`). The wrapper takes them as **values of props it already has**: `coreStage={SET_ALONE}` (0) is the set alone, `allegiance={UNLIT}` is pewter. A new prop or a new spec key would have changed the bytes of every chunk the wrapper is in, flag off; a value is read inside the flag's literal ternary (`agentFormSpec.js:81`, `:85`) and folds away. The equipped set keeps the player's teal. R12 still holds: a set under 40 px is a still whatever it is asked.

### 1.3 Desktop (board 6)

- **Layout:** board 6's numbers exactly: a 1040 px dialog (the hub's own `HubSheet`), a 690 × 700 listbox, Shadow at 300 px live in the centre under "Your Shadow · fitted preview", six cards of 150 px holding each set at 112 px on a ring of 252, and the aside. On the tablet and stacked compositions the same dialog is drawn smaller (`COMPACT_RING`: Shadow at 220, sets at 84) with the aside under the ring.
- **The sets:** each set alone, pewter unless equipped, a still; hovered, it goes live (a rate flip on the same view), and a still again on leaving. One set at a time.
- **Preview:** selecting a set (click, or the arrow keys) plays the engine's swap on the centre (900 ms on, 700 ms off, the size tweened, R5). The status line reads "Equipped" or "Previewing · Equipped set is X"; the button "Equip X".
- **The hero behind:** paused while the dialog is open (`paused`, as under the deploy ceremony). An equip changes the agent record, and the hero suits up through its own change path, once, when it resumes.

![Desktop: the armory dialog, previewing the Contrarian](assets/armory-a1-desktop-preview.png)

The tablet composition (1024 × 768), the compact ring, the aside under it (scrolled to): measured 600 px wide, no horizontal overflow, the same at 800 px.

![Tablet: the compact dialog](assets/armory-a1-compact-1024.png)

### 1.4 Equip

Exactly the picker's write: `changeArchetype(agent.id, codeId)` once (`Armory.jsx` `useArmoryEquip`), nothing while one is in flight, and a result that lands after the armory closed is dropped (a session token, bumped on close and at unmount). On success the armory closes.

- **409 `battle_active`:** the hub's own "Locked in battle" line (`HUB_COPY.loadout.nextDeployLocked`), and the armory stays open. The route's other 409s (`epoch_closed`, `composition_blocked`) are not battle locks, so they keep the server's own words, as the picker shows them; anything without words shows the picker's "Could not change archetype. Please try again."
- **The tempo-dial reset** (`dialInvalidated`, unreachable while mastery is dark): its notice shows and the armory stays open (the picker shows it for 2.6 s and closes; the hub side holds no timer). Only the mastery-dark wording is carried: the picker's lit wording uses words the hub copy guard bans.

### 1.5 Copy (`ARMORY_COPY`)

Title "Armory"; intro "Choose the armor Shadow wears into battle. Select a set to see it fitted." (board 6's, less "a change applies on your next deploy", which FD-1 rules out); "Your Shadow · fitted preview"; "Armor sets" (the listbox); "Equipped", "Previewing", "Previewing · Equipped set is X"; "Equip X", "Equipping…"; the footnote, FD-1's sentence exactly, followed by board 6's "Partnership and shared research stay with Shadow." Names, one-liners and paragraphs come from the identity table through `hub/archetypeLines.js` alone (the one-liner is the identity table's disposition, the paragraph its reveal, the picker's subhead and body).

### 1.6 Accessibility

The ring is a single-select listbox ("Armor sets"); each set is an option named by the set's name; selection follows focus, and the arrows, Home and End move round the ring. The figures are decorative (`label={null}`; on the phone the hero is `aria-hidden` while the armory is open). The dialog is named "Armory"; the status line is a polite live region. Escape closes; on the phone, focus starts on the equipped set and returns to Change archetype.

---

## 2. The phone (FD-8): sizes, measured

**Settled:** the hero at **152 px** live, centred; six sets drawn at **46 px** inside **48 px** tap circles on a ring of **116 px**; all inside a **280 px** square; the stage's side padding 5 px while the armory is open. The name, one-liner, paragraph, status line, Equip and the footnote sit under the ring and scroll with the page. The "Armory" mark and Close (44 × 44) sit in the ring's two empty top corners.

Why these numbers: a set at ±30° from the horizontal is `radius × cos 30°` from the centre, so its box clears the hero's when `116 × 0.866 − 24 = 76.5 ≥ 152 / 2`. At 320 px the stage's inner width is 290 (320 − 2 × 14 gutter − 2 × 1 border), and the ring is 280.

Measured in headless Edge 156 on the real GPU (ANGLE, Iris Xe, D3D11), phone context with touch, the real hub with the flag on (§9 has the harness):

| Width | Stage | Ring | Hero | Sets | Set ↔ hero | Set ↔ set, Close ↔ set | All inside the stage | Smallest tap target | Page overflow |
|---|---|---|---|---|---|---|---|---|---|
| 320 | 292 | 280 | 152 | 48 | no overlap (0.45 px clear) | none | yes | 44 | 0 px |
| 360 | 332 | 280 | 152 | 48 | no overlap (0.45 px clear) | none | yes | 44 | 0 px |
| 390 | 362 | 280 | 152 | 48 | no overlap (0.45 px clear) | none | yes | 44 | 0 px |

**No 320 px fallback was needed:** the ring fits in the hero's box at all three widths. The stage scrolls into view when the armory opens. At 320 × 568 the Equip button is below the first screen and is reached by scrolling, as FD-8 allows.

| 320 | 360 | 390 |
|---|---|---|
| ![320](assets/armory-a1-phone-320.png) | ![360](assets/armory-a1-phone-360.png) | ![390](assets/armory-a1-phone-390.png) |

Previewing the Contrarian on the hero itself, 390: ![390 preview](assets/armory-a1-phone-390-preview.png)

---

## 3. No flash, no black square, no second suit-up

**How the centre relates to the hero (the prompt's choice to make):** on the phone **the hero view stays and resizes**. It is the same element in both layouts, one path through the tree, behind a wrapper that is `display: contents` while the armory is closed, so it never remounts: no placeholder, no canvas made fresh, on open or close. On the wide compositions the dialog has its own centre, over the paused hero.

- **The sets and the dialog's centre** are new views when the armory opens. Each is hidden until its view has reported, so the wrapper's placeholder never shows for the frame before the engine draws (`Armory.jsx` `Figure`).
- **Cancel:** the preview the hero wore is taken off **at once**, not suited up: the hero's read marks that one change `instant` and the wrapper draws it as an update (`HubAgentForm.jsx:106`). A later change of the record is a suit-up again.
- **Equip:** on the phone the hero already wears the new set, and keeps it while the agent record still holds the old one, so it never steps back and suits up again. On the wide compositions the hero suits up once, through its own change path.

**Measured** (headless Edge, the real GPU), every animation frame for the 45 frames after the click:

| Surface | Open: placeholder frames | Open: hero canvas hidden | Close: placeholder frames | Close: hero canvas hidden | Sets first visible |
|---|---|---|---|---|---|
| Desktop, 1440 × 900 | 0 | 0 | 0 | 0 | frame 3 |
| Phone 320 | 0 | 0 | 0 | 0 | frame 4 |
| Phone 360 | 0 | 0 | 0 | 0 | frame 5 |
| Phone 390 | 0 | 0 | 0 | 0 | frame 4 |

After closing, the hero's label reads "Shadow wearing Trend Follower", the equipped set. Reduced Motion: every view is a still, and a preview switches at once (the wrapper's swap is an update under reduced motion).

---

## 4. The lab presets (FD-9)

`?agentFormLab=1` (smoke branch only) gains four presets (`AgentFormLab.jsx:26`). The first view is Shadow in the Form control's set at the Rate control's rate; the six after it are the sets on their hooks, alone and pewter but for the one Shadow wears:

| Preset | Views |
|---|---|
| Armory phone: 1 live at 160 + 6 stills at 48 | the phone armory as built (FD-9) |
| Armory desktop: 1 live at 300 + 6 stills at 112 | the desktop dialog as built |
| Armory phone, all live: 160 + 6 at 48 | FD-9's alternative |
| Armory desktop, all live: 300 + 6 at 112 | FD-9's alternative |

The Copy reading line names the preset and "armory sets stills" or "live". Phase 0 §7.5 has this laptop's numbers for the same cells: one live and six stills cost what the hero alone costs; seven live cost 3.4–10 ms a frame. The phone decides.

---

## 5. The guards

| Guard | Change | Why |
|---|---|---|
| `agentFormFlags.test.js` | **Added:** the pin, the literal, the `DARK_BY_DESIGN` entry, every read site's exact line, no other reader, and "the armory is on only while the hub's form is" | BUILD_RULES §2; a hub rollback must take the armory with it |
| `flagPinGuard.test.js` | **Added** the `DARK_BY_DESIGN` entry | Its own rule for a dark flag |
| `agentForm.flagOffBundle.test.js` | **Added** `Armory.jsx` (nothing), `archetypeLines.js` (`archetypeLines` alone), `ShadowStage.jsx` (its four exports alone) and `agentFormSpec.js` with the spec used (no look survives); one plant (the armory context's pure mark); the flag count 4 → 5 | The prompt's instruction, as for the League slot |
| `hubCopy.guard.test.js` | **Added** an A1 block: no digit, no count or growth word (`stage`, `battles`, `level`, `worn`, …) in `ARMORY_COPY`'s source or sampled output; each function takes one argument, a name; the status words; FD-1's footnote; plants that red | D4, FD-6, FD-1 |
| `commandCenterHub.mount.guard.test.js` | **`changeArchetype` added** to the agentService names the hub may import, and `Armory.jsx` to its writers; **`Armory.jsx` added** to the no-frame-read, no-device-read row | The armory's Equip is the picker's own write, now made from a hub file. The rows still pin the exact set. No new lazy edge: the armory uses the existing wrapper |
| `tokens.guard.test.js`, `motion.guard.test.js` + baselines | **`Armory.jsx` registered**, count 0 | Their own instruction for a new hub file |
| `AgentForm.s1.jsdom.test.jsx` (the framing scan) | **`Armory.jsx` added** to the files that draw the wrapper, with no framing | The scan's list is exact |
| The activity guard | **No change.** `Armory.jsx` holds no effect, timer or listener: focus on open is a ref callback, an in-flight result is dropped by a session token | — |
| The §2.3 import ratchet | **No change.** The armory's words reach it through `hub/archetypeLines.js` | R10 |

**Retired: none. Loosened: none.**

---

## 6. Flag-off identity

`vite build --minify false --sourcemap false` on Linux (WSL), LF trees from git, hashes masked (`-[A-Za-z0-9_-]{8}.js|css`):

| Compared | Files | Lines that differ |
|---|---|---|
| `main` `31574600` vs the first code commit `7560e7cb` | 53 / 53 | **0** |
| `main` vs the fix commit `54bae5a4` | 53 / 53 | **0** |
| `main` vs the pushed head ⟨HEAD⟩ | ⟨…⟩ | ⟨…⟩ |

---

## 7. Mutation

On Linux, in a WSL worktree of its own at `c515d020`, from a green baseline of the 202 rows the mutants target. One exact replacement each, its rows run, the file restored from the commit and checked clean. **26 of 26 killed**, and the one control survives, as it must.

| Id | The prompt's mutant, or an extra | Killed by |
|---|---|---|
| M1 | **A slot drawn with a brain** (`coreStage={1}`) | "each is the set alone (no brain)…", the hover and touch rows |
| M1b | The wrapper's set alone keeps its brain | the spec's SET_ALONE rows |
| M2 | **The equipped slot unlit** | "…pewter unless it is the equipped one" |
| M2b | The wrapper draws unlit as teal | the spec's UNLIT row, the mount and equip rows |
| M3 | **A stage in the status copy** ("· stage one") | the copy guard's A1 rows (growth word; the status words) |
| M3b | **A count in the status copy, passed as an argument** (`(n) => \`Equipped · ${n} battles\``) | the copy guard's A1 rows (a growth word in the source; a function that takes a count) |
| M4 | **Equip not calling `changeArchetype`** | "Equip calls changeArchetype once…", the lock rows, the phone equip row |
| M4b | Equip with the equipped set, not the chosen one | the same, and the phone equip row |
| M5 | **The 409 not surfaced** | the desktop and phone lock rows |
| M5b | The 409 shown as the server's words, not the lock line | the lock rows, `equipErrorOf`'s row |
| M6 | **A name read from outside `archetypeLines.js`** (`getArchetypeDisplayName` imported into `Armory.jsx`) | the mount guard's "legacy tables imported by exactly one hub file" and the §2.3 ratchet (`api/_utils/archetypeRegistry.test.js`, "no NEW production module imports a legacy archetype table") |
| M7 | **A seventh live view** (every set live) | the still rows, "never more than two live views" |
| M7b | Two hot sets at once (a hover never cleared) | the hover and touch rows |
| M8 | **The hero not paused under the dialog** | "is paused while the armory is open…", the live-views count |
| X1 | Phone: the preview taken off on close is suited up (the second suit-up) | "a cancel takes it off at once…" |
| X2 | Phone: after an equip the hero steps back to the old set | "an equip keeps the new set on the hero…" |
| X3 | *Control:* the ring wrapped in a fragment (no change to the hero's path) | **survives**, as it must |
| X3b | Phone: the hero remounted when the armory opens (a key on its scope) | the phone rows: the test worker dies before they report, so the file fails. The runner's tally read the crashed run as "0 failed"; re-run by hand, the file exits with an error (§12, F3) |
| X4 | Phone: the armory registered as an overlay (the page goes inert) | "the page around the phone armory is not made inert" |
| X5 | The no-flash gate removed | "no flash on open…" |
| X6 | A flag read outside its literal ternary | the exact-sites row, and the flag-off picker row |
| X7 | The armory's context loses its pure mark | the flag-off bundle row (Armory.jsx bundles to nothing) |
| X8 | The flag flipped on without its pin | the pin, flagPinGuard |
| X9 | ArrowRight does not move the preview | the listbox row |
| X10 | Reduced motion ignored by the sets | both reduced-motion rows |
| X11 | The phone ring overlaps the hero (radius 110) | the ranges and overlap rows |
| X12 | A tap target under 44 (slot 42) | the ranges and tap-target rows |

---

## 8. Checks and sizes

⟨CHECKS DETAIL⟩

---

## 9. The harness (not committed)

A WSL worktree of the code head with the flag set `true`, an untracked Vite page rendering the real `CommandCenterHub` (the app's three stylesheets, the hub fixtures' sections), and the network seams stubbed as the jsdom suites stub them (`useHubReaders`, `agentService`, the list and idea services, `UserContext`, `firebase/config`, `useMasteryProfile`); the stubbed equip answers in 300 ms and the record changes 400 ms later. Driven from Windows by `playwright-core` 1.61.1 with Edge 156, `--use-angle=d3d11`. Nothing from it is committed.

---

## 10. Your iPhone checklist

Open the preview link (⟨URL⟩) on the iPhone and sign in.

1. **Command Center → Loadout → Change archetype.** The armory opens in place: the figure shrinks to the middle and the six sets appear around it. Nothing should flash or go black.
2. **Tap each set.** It lights up while your finger is on it, and the centre figure suits up in about a second. The line under the ring says "Previewing · Equipped set is …".
3. **Equip one.** The armory closes and the Command Center figure is wearing it. Later, start a casual game and check it deploys with that armor.
4. **Turn Reduce Motion on** (Settings → Accessibility → Motion). Open the armory again: everything is still, and tapping a set switches the figure at once. Turn it off again.
5. **With the armory open, leave the phone still for one minute,** then copy the `60 s:` line from the small readout in the top-right corner.
6. **Open the preview link with `?agentFormLab=1` added at the end.** Tap each of the four "Armory" presets in turn (the two with stills and the two "all live"), wait a minute on each, and copy each `60 s:` line. These four lines decide FD-9 for good.

---

## 11. Founder questions

1. **The "Locked in battle" words on a refused equip.** As the prompt said, a battle lock shows the hub's existing line: "Locked in battle · changes apply to your next deploy." In the Loadout card that line is about changes made in the Forge. In the armory, after a refused equip, its second half can read as if the change will happen later, and in A1 it will not: nothing was changed. Keep it, or give the armory a line of its own (for example "Locked in battle · try again when the game ends")?
2. **Board 6's second footnote sentence.** After your FD-1 sentence the footnote keeps the board's "Partnership and shared research stay with Shadow." It is true today. Keep it, or drop it?
3. **The desktop dialog's height.** Board 6's dialog is about 830 px tall. On a window 900 px tall it scrolls about 60 px inside: Equip stays in view, and the footnote's last line needs a scroll. Accept it, or shrink the desktop ring so it fits?
4. **The phone armory does not lock the page.** It is part of the Command Center, not a pop-up, so the tabs, the deploy strip and the bottom bar stay usable while it is open (a deploy could be started mid-preview). Is that what you want, or should the rest of the page be locked while the armory is open?

---

## 12. Found, not fixed

| # | Finding | Note |
|---|---|---|
| F1 | **Safari on a desktop: focus after the dialog closes** goes back to the page, not to Change archetype. The hub's own sheets keep the clicked button from the click (Safari does not focus a clicked button); the armory dialog is reached through `LoadoutSheets` with no new prop, to keep the flag-off bytes, so it falls back to the browser's focused element. The phone armory returns focus correctly | A2 can hand it the opener when the flag flips |
| F2 | **The tempo-dial notice's lit wording** ("unlocks at mastery level 2") uses words the hub copy guard bans, so the armory carries only the mastery-dark wording, which is what shows today | needs a ruling when mastery lights |
| F3 | **A remount of the hero while the phone armory opens crashes the test worker** (mutant X3b). The shipped code never remounts it there; the one real remount path, an agent or account switch while the armory is open, was probed and runs clean (the form remounts once, nothing hangs) | for the review session to look at |
| F4 | The flag-off picker still says "applies on your next deploy" (Phase 0's R2) | untouched in A1, as FD-1 rules |
| F5 | The mutation runner counted a crashed test worker as a pass (X3b) | the scratch runner's own bug, fixed by hand; nothing in the repo |

---

## 13. Commits and artifacts

⟨COMMITS⟩
