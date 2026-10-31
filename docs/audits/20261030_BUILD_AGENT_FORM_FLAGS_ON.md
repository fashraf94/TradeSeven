# Build: Flags on — the armored agent goes live, plus the desk leaderboard crown

**Run date:** October 30, 2026 · **Model:** Opus · **Branch:** `claude/agent-form-flags-on`, cut from `main` @ `337a5801` (the merge of PR #1015), pushed from the worktree branch `claude/agent-form-flags-on-1778d7` by refspec · **Smoke branch:** `claude/agent-form-flags-on-smoke` · **PR:** [#1017](https://github.com/fashraf94/TradeSeven/pull/1017), draft · **Preview:** https://trade-seven-oe8xsi7qm-fais-projects-bc179554.vercel.app

**Preamble.** `git fetch origin` ran first. `origin/main` = `337a5801`, which holds PR #1015's merge, so the prompt's STOP does not apply, and it had not moved when the final checks started. The tree was clean. Fenced files read: none. Fenced functions called: none. Fenced files edited: none. Nothing under `api/` changed.

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **The flip (F1)** | **All three flags are `true` in one commit**, with their pins. `AGENT_FORM_LAB_ENABLED` stays `false` and `AGENT_FORM_PHONE` stays `'live'`. Nothing reaches players until you merge. |
| 2 | **Source diff against `main`** | **Limited to the three flag literals, F3, and tests and docs**, plus comment lines (§1). The app is what you tested on the S1 and S2 smoke builds, minus the smoke-only readout, dial and fixture page: the source delta from the S2 smoke is that commit's own smoke files, F3 and one comment. |
| 3 | **The rows that pinned the old faces** | **98 went red on the flip alone, in 9 files, the list S2's §10 predicted, and no League row. All 98 are reconciled, and no row was deleted** (§2). |
| 4 | **The recapture** | **It touches only the face → form slots.** With the face off, the one change is the CPU side's cell. With it on, the robot head goes and the form's still comes. Of 82 distinct changed lines, none is anything else. Every other field of every record is still the pre-build capture (§3). |
| 5 | **Kill switches (F2)** | **Proven per surface, and a rollback is two lines.** Each flag set back alone, on the whole suite, turns exactly its pin and the pin guard red; move the pin with it and they are green. With all three off, the build is `main` plus F3: 47 files, 1 differs, on F3's 3 lines (§4, §9). |
| 6 | **Guards** | **None retired, none loosened.** With the flags on they mean more, not less: each now guards the rollback (§5). |
| 7 | **The crown (F3)** | **Built, in its own commit, for everyone.** A level field shows no crown; a partial tie and a real leader keep theirs (§6). |
| 8 | **Mutation** | **39 of 39 killed**, from a green baseline, plus the three flags flipped back (§7). |
| 9 | **Checks** | `lint:gate` exit 0. Full suite on Linux: 1,264 files, 27,880 rows, 27,791 pass, 0 fail, 89 skipped. Minified build of the pushed head: exit 0. |
| 10 | **Sizes** | Entry chunk 4,842.42 kB, 1,307.41 kB gzip (`main` 4,837.22 kB, 1,305.13 kB gzip). Engine chunk 614.83 kB, 162.83 kB gzip: every player who opens the Command Center, a battle or a League game now downloads it once (§8). |
| 11 | **Review threshold** | **Over it: stop at the draft PR.** The cumulative branch diff is 20 files, +1,556 / −300 lines, this report included; without it, 19 files, +1,199 / −300. BUILD_RULES §2 asks for a review at 10 files or 1,500 lines, so a review session runs before merge. |
| 12 | **Not proven** | Nothing here has run on a real device. The `60 s:` lines, a real pod before its bell and a finished game with a human rival are on the checklist (§10). |

---

## 1. What changed

Every line of the source diff that is not in a test:

| File | Change |
|---|---|
| `src/config/agentFormFlags.js:50,66,82` | The three literals, `false` → `true` |
| `src/config/agentFormFlags.js` | Their three docstrings, which called `false` the default. BUILD_RULES §2 requires these in the flip's commit. Comments only |
| `src/screens/battleView/ArenaHeader.jsx:40` | One comment: "off on main" → "on". The same rule. Comments never reach the build |
| `src/components/League/LeagueDeskParts.jsx` | F3: one import, one gate, one condition (§6) |

Nothing else under `src/` or `api/` moved. The old faces, ShadowCanvas and their paths all stay in the code (F2).

**How that was checked, not just read.** Against the S2 smoke commit `5b718e1e`, the non-test source differs in 11 files: 9 are that commit's own (`App.jsx`, the readout in `HubAgentForm.jsx`, the dial in `climbHeadLayout.js`, `fuseFormLayout.js`, `leagueAgentFormSlot.jsx` and `battleAgentFormSlot.jsx`, `SmokeLeagueForms.jsx`, `smokeFormScale.js`, and the docstrings in `agentFormFlags.js`, whose literals already match), and the other two are F3 and the one comment above. **A masked build comparison against the smoke (`vite build --minify false`, Linux, hashes masked) is not a useful second check here:** 38 of 56 files differ and 1,726 lines move, but 32 of those files differ only in their import lines, and in the rest, by the lines I sampled rather than each one, modules change chunks and names, because the fixture page pulled hub modules into a shared chunk. The rollback comparison in §4 is the build-level proof, and it is exact.

---

## 2. The rows that pinned the old faces

The flip alone, full Linux suite: **98 rows red in 9 files**. S2's §10 predicted the same rows; it counted 112 on its smoke commit, and the difference is that commit's readout and dial. **No League row went red.**

| File | Red | What happened | Rows before → after |
|---|---|---|---|
| `CommandCenterHub.s7` | 52 | Rewritten to the armored hero | 73 → 73 |
| `AgentBattleScreen.quoteAvailability` | 15 | 11 compare against recaptured values (§3), 4 read the forms | 274 → 277 |
| `ArenaHeader.render` | 13 | The 13 stay, flag off, as the kill switch; 13 new rows assert the form | 45 → 58 |
| `agentFormFlags` | 4 | Pins, `true`; a turned-around row (§5) | 8 → 8 |
| `AgentBattleScreen.paneHeader` | 4 | Rewritten to the form's boxes; the robot head's boxes stay in a flag-off block | 15 → 20 |
| `CommandCenterHub.jsdom` | 3 | Rewritten | 91 → 91 |
| `CharacterAvatar.render` | 3 | Rewritten; the old rows stay, flag off | 27 → 30 |
| `flagPinGuard` | 2 | Three entries dropped from `DARK_BY_DESIGN` | 6 → 6 |
| `CharacterPane.comparison` | 2 | Rewritten; the old rows stay, flag off | 9 → 11 |

**Deleted rows: none.** Every row's behaviour still exists with the flag on, so each was rewritten.

**One thing decided how the hub's rows are written.** jsdom has no WebGL, so the real form never reports live, and every label would read "still". The hub's rows therefore use a recording stand-in for the form, which reports live on mount and keeps its props. What they assert is what the hub hands the hero: size, rate, label, mood, one response per trigger, the pause, reduced motion. The wrapper's and the engine's own suites already hold what happens next.

**Two rows that were not red still had to change.** "No canvas context" and "a throwing context" stayed green on the flip, but only because a form in jsdom reads "still" whatever happens. They now drive a form that never reports and one that reports a failed engine.

**Parts of rows that went, because the thing they read does not exist with the flag on.** None of these leaves the behaviour unguarded:

| Row part | Why it went | Where it is guarded now |
|---|---|---|
| Strokes per frame and the tier, 6 rows | The form has no strokes or tier | The hub's kill-switch rows, and `ShadowCanvas.jsdom` |
| A canvas context never asked for; the frame loop's count | The hub no longer owns a loop | The same, and the engine's lifecycle suite |
| `data-shadow-strand` counts | ShadowStill's SVG | `ShadowStill.jsdom` |
| `data-shadow-reduced-motion` | The hero has no such attribute; the prop is what reaches the form | Rewritten row; `AgentForm.s1` |
| The 420 ms still flash | It is the engine's now | Rewritten rows assert the key and the prop; `engine.lifecycle` holds the flash, `HubAgentForm.jsdom` its numbers |
| "The core pulses" | An arc's radius on the old canvas | The form's mood, `researching` |
| A response "waits" for the page | The engine holds it | Rewritten rows assert the pause; `engine.lifecycle` holds the wait |

---

## 3. The recapture

**The brief's bar: the diff between the old and new captures touches only the face → form slots.** A stored digest cannot show that, so I dumped the raw markup of every digest in `quoteAvailability` and `ArenaHeader.render` with the flag off and on, on the same tree, renumbered React's ids, and diffed tag by tag.

**Result: 55 captures, 21 identical, 34 differ. 82 distinct changed lines, sorted by hand-written rules, with a STOP on anything else:**

| What changed | Distinct lines |
|---|---|
| The CPU side's cell (R9) | 9 |
| The form boxes | 4 |
| The robot head going | 43 |
| The form's still arriving | 24 |
| Closing tags | 2 |
| **Anything else** | **0** |

**With presence off,** which is most of these rows, no figure draws at all. The whole change is the CPU column gaining the row that holds its form:

```diff
- <div id="why-book-cpu" style="display:flex;flex-direction:column;align-items:flex-end">
+ <div id="why-book-cpu" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0">
+ <div style="display:flex;flex-direction:column;align-items:flex-end">
  …the CPU label and score, unchanged…
+ </div>
```

That cell is part of the form slot, S1's ruling R9, and the only reason the markup moves when no form draws. The robot-head digests with presence on, in `ArenaHeader.render`, swap the head's SVG for the slot, its boxes and the form's still.

**Everything but markup is still the pre-build capture.** `FORMS` in the quote file holds only what moved, each by its path, on top of the untouched `OFF` references, so a row proves it:

| Record | What moved |
|---|---|
| `paneDesktopActive` | `priced.html`, `polled.html`, `after.html` |
| `failureAndRecovery` | `failed.html`, `recovered.html` |
| `battleSwitch` | `beforeB.html`, `afterB.html` |
| `swapTransition` | `before.html`, `afterSwap.html`, `polled.html` |
| `queryPath` | `resolved.html` |
| `paneMobileActive`, `initialZerosLoading`, `dayTwo`, `completed`, `subscriptionError` | `html` |
| `presenceFaces` | `pane`: the figures' record, below |

Price calls, subscriptions, the research and breakdown payloads: none moved. **12 records did not move at all:** `paneOffActive`, `tabbedActive`, `loadingReturn`, `chatResearch` and the eight malformed-input records.

**`presenceFaces`.** Before: 4 renders of 2 faces. Now: 6 renders of 3 forms, because the CPU has a form where it had no face. Every one carries the same pair as before (183 / 88). The rows that follow the comparison across a switch read the forms through a recorder, so "one selected pair per commit" still holds at every figure.

**`ArenaHeader.render`** keeps its 11 pre-build references, flag off. `FORMS6` holds the ten flag-on digests. The form's scores are not recaptured at all: those rows hold them to the pre-build references' own numbers, in the header, the mark and the pane.

**One thing removed before hashing.** A lazy component suspending in `renderToString` makes React's dev build write its stack into the markup, with this machine's paths, which would pin the digest to one folder. The app never renders on a server, so the row drops that note.

**The rule these references live under.** The old block says never to regenerate by blessing build output, and it stands for `OFF`. Your brief is the one sanctioned recapture, it is a separate block saying so, and the raw diff above is what makes it more than a blessing.

---

## 4. The kill switches (F2)

Each row mocks the flag `false`, asserts the old face renders and the screen still works, and stays until the old code goes.

| Surface | Where | Rows | What they assert |
|---|---|---|---|
| **The hub** | `CommandCenterHub.killSwitch.jsdom.test.jsx` (new) | 13 | ShadowCanvas at 340 / 260 / 200 / 196 px and its tiers; its labels; processing; the still under reduced motion and with no canvas; an area's bloom; the status line, the Deploy card, the sheets and the phone's tabs |
| **The hub's stage** | `ShadowStage.agentForm` | 1 | No hero, the box at the stage's size |
| **The battle header** | `ArenaHeader.render` | 13 | The pre-build digests, its face's props, and the pair the face takes |
| **The screen** | `AgentBattleScreen.quoteAvailability` | 3 | The production layout against the pre-build capture, desktop and phone, every figure a robot head |
| **The pane and the mark** | `AgentBattleScreen.paneHeader`, `CharacterPane.comparison`, `CharacterAvatar.render` | 5 + 2 + 3 | The boxes at 56 / 40 / 36 px, the duel on the pre-build references, the mark as the door to the pane |
| **The sites together** | `battleAgentForm.sites.render` | 1 | Already there: no slot, static heads |
| **The League's fuse and climb** | `leagueAgentForm.killSwitch.jsdom.test.jsx` (new) | 9 | Heads at 30 / 25 and 44 / 36 on the fuse, `headSizeFor`'s on the climb; the crown, the total, the scope toggle; your standing; no form scope; the phone hero back on its stylesheet height |
| **The level board** | `leagueLevelBoard` | 24 | Already there: every board with the flag off |

**That is more than "small"**, on purpose. The battle's digests existed, they are exactly what proves the rollback, and keeping them flag-off cost nothing. They go when the old code goes.

**The rollback dry run.** Each flag back to `false` alone, the whole Linux suite, one at a time, on `79023fe2`:

| Flag back | Rows | Red |
|---|---|---|
| Hub | 27,880 | The pin, its guard, and one bundle row of mine |
| Battle | 27,880 | The same three |
| League | 27,880 | The same three |

That bundle row was wrong: it counted flags, so I made it value-neutral (`cba985c1`). Before this run I caught a worse problem by reading: the hub's rewritten rows read the live flag, so a rollback would have reddened them all again. They now hold the flag on in their own mocks (`79023fe2`), which is why the run above is so short. Then the control, on `cba985c1`, each flag and its one pin moved together, the three files that read them: **22 of 22 rows green for each flag.** That is the two lines of §9, proven, on the code head `cba985c1`.

**With all three flags off, the build is `main` plus F3.** `vite build --minify false` on Linux, LF trees, hashes masked, source maps out: `main` `337a5801` against the code head `cba985c1` with all three flags set false. **47 files compared, 1 differs, the entry, on 3 lines, and all 3 are F3's:**

```diff
+   const hasLeader = !isLevelBoard(players.map((p2) => p2.score));
-   children: i === 0 ? … crown …
+   children: i === 0 && hasLeader ? … crown …
```

So every chunk of the hub, the battle and the League folds back to `main`'s, byte for byte. The rollback gives you exactly the app you have today.

---

## 5. The guards

| Guard | Decision | Why |
|---|---|---|
| The value pins (`agentFormFlags.test.js`) | **Moved** to `true` | BUILD_RULES §2 |
| "Each is the module's literal" | **Kept**, value-neutral | It guards the literal, not the value. The pins above it hold the value, so a rollback moves one pin |
| `DARK_BY_DESIGN` | **Three entries dropped**, in the flip's commit; the row turned around to assert they are gone | The guard's own instruction, the precedent's shape. `AGENT_FORM_LAB_ENABLED` stays |
| The literal-ternary rows | **Kept, unchanged** | With the flags on they are the kill switch's shape: a read outside a literal ternary would leave form code in a rolled-back build |
| `agentForm.flagOffBundle.test.js` | **Kept**, its comments rewritten, one row added | It now answers the rollback's question. Its flag-module rewrite does real work for the first time, so the new row pins that it turns every flag false, whatever the file ships. The plants are unchanged |
| The hub mount guard, its edges | **Kept, no change to any rule** | The walk has always read both arms of the ternary, so the flags change nothing it sees. One lazy edge, no static three.js, no frame or device read: all still true, all still wanted. It stayed green through the flip |
| The activity guard | **Kept, no change** | The same |
| `agentForm.guard`, tokens, motion | **Kept, no change** | The same |

**Retired: none. Loosened: none.**

---

## 6. F3: the desk leaderboard's crown

`DeskLeaderboard` crowned row 0 of the whole field by list position, so a fully level field, which every field is before its first bell, crowned somebody who leads nobody.

```diff
+ import { isLevelBoard } from './battleArena/arenaStateMap';
  const players = Object.values(st.field).sort((a, b) => b.score - a.score);
+ const hasLeader = !isLevelBoard(players.map((p) => p.score));
- {i === 0 ? <LIcon name="crown" … />
+ {i === 0 && hasLeader ? <LIcon name="crown" … />
```

Not behind any flag. In its own commit, `dda38af7`.

| Field | Before | Now |
|---|---|---|
| Level, 0 / 0 / 0 / 0 | Crown on row 1 | **No crown** |
| Level, 12.5 / 12.5 / 12.5 | Crown on row 1 | **No crown** |
| A normal field | Crown on the leader | The same |
| A partial tie at the top, 5 / 5 / 4 / 3 | Crown on row 1 | The same, as you ruled |
| A partial tie lower down | Crown on the leader | The same |
| 5.03 / 5.02 / 5.01 | Crown on the leader | The same: level is exact, and any lead counts |

**What the ruling left to the build, decided here:**
- **The top row of a level field shows its number, "1".** The row's slot holds a crown or a number, so that is what the slot does without a crown. The other rows keep 2, 3, 4 and the top three's tint. Those are list positions, and you ruled on the crown.
- **A lone player has no crown.** That is the shared predicate, and the game boards do the same.

`DeskLeaderboard.levelField.render.test.jsx`, 9 rows.

---

## 7. Mutation

On Linux, in a worktree of its own, from a green baseline of 613 rows. One exact replacement each, its rows run, the file restored from the commit and checked equal. **39 of 39 killed.**

| You asked for | Mutants | Killed by |
|---|---|---|
| **F3's crown on a level field** | The gate dropped; the gate on printed whole numbers; three distinct totals counted as level | The level rows; the "level is exact" row; the partial-tie rows |
| **F3 removing a real leader's crown** | No crown at all; the gate inverted | The normal-field and partial-tie rows |
| **A kill-switch row's surface broken** | Hub: the wide arm's tier, the bloom unwired, the phone arm gone. Header: the face's box, its size, the CPU cell. Pane and mark: the face's size, the face gone, the mark's face gone. League: the fuse's size, its head, its crown; the climb's reactive head; the phone hero's height; a form scope left on | Each by its surface's rows. 15 of 15 |

**One flag flipped back:** each of the three, on the whole suite (§4): the pin and its guard, nothing else.

**The rewritten rows, 15 more:** the hub's pause, mood, created trigger, area trigger, phone answering an area, reduced motion, rate, size and status; the header's box, scores and "CPU" word; the mark's scores, the pane's scores and box. All killed, so the stand-in is not hiding anything.

**The guards, 4 more:** a `DARK_BY_DESIGN` entry back, a non-literal ternary, a pure mark off, the rewrite a no-op. All killed.

---

## 8. Checks and sizes

- **`lint:gate`:** exit 0.
- **Full suite:** Linux, WSL, `TZ=UTC`, 8 workers, under `flock /tmp/pd-suite.lock`, Node 22.22.2: on the code head `cba985c1`: **1,264 files, 27,880 rows, 27,791 pass, 0 fail, 89 skipped.** `main` is `337a5801`, unmoved, so this is the tree CI tests. The commits above it are this report only.
- **Minified `vite build` of the pushed head:** exit 0.
- **Not run:** the Firestore rules suite (no rules changed), and anything on a real device.

| Chunk (minified, as Vercel builds it) | `main` | This head |
|---|---|---|
| Entry | 4,837.22 kB, 1,305.13 kB gzip | 4,842.42 kB, 1,307.41 kB gzip |
| Engine (three.js and the forms) | not reachable | 614.83 kB, 162.83 kB gzip |
| Command Center | 152.69 kB, 47.25 kB gzip | 141.72 kB, 42.74 kB gzip |
| `AgentBattleScreen` | 209.33 kB, 60.11 kB gzip | 209.58 kB, 60.12 kB gzip |
| `BattleAgentForm` | not reachable | 1.01 kB, 0.60 kB gzip |
| `LeagueAgentForm` | not reachable | 1.72 kB, 0.96 kB gzip |
| The forms' shared code (`agentGrowth`, `agentMood`, `gameOutcome`, `finishedRivalRead`) | not reachable | 8.86 kB, 4.35 kB gzip |
| Stylesheet | 36.83 kB, 8.44 kB gzip | The same |

**What a player pays.** The engine loads once, on the first form a player meets, wherever that is, and the hub, the battle and the League share it. The entry chunk stays free of it: the engine is behind the wrapper's one `import()`, which the mount guard holds to one edge. The entry grows 5.20 kB (2.28 kB gzip). The Command Center's chunk shrinks by 10.97 kB, because ShadowCanvas folds out of it with the flag on. A browser with no WebGL never downloads the engine, and sees the still.

---

## 9. How to roll back

One surface, two lines, one small PR. Each line goes `true` → `false`:

| Surface | The flag | Its pin |
|---|---|---|
| **The Command Center** | `src/config/agentFormFlags.js:50` | `src/config/agentFormFlags.test.js:30` |
| **A BaggerBomb battle** | `src/config/agentFormFlags.js:66` | `src/config/agentFormFlags.test.js:34` |
| **League games** | `src/config/agentFormFlags.js:82` | `src/config/agentFormFlags.test.js:38` |

Change the flag and forget the pin, and CI goes red on exactly those two rows, and the guard's message says which line to move. Nothing else needs touching, and nothing in Firestore or on the server changes. The surface goes back on the next deploy.

---

## 10. Smoke, and your last phone checks

`claude/agent-form-flags-on-smoke` = `1474bd6e`: one "SMOKE ONLY, NEVER MERGE" commit on the PR head, `cba985c1`, 3 files, composed by git plumbing (`App.jsx` 4 lines, the readout in `HubAgentForm.jsx`, the page):
- the hub's corner readout;
- the `?leagueForms=1` fixture page with its readout;
- a **Desk board** view on that page, with chips for a level field, a tie at the top and a normal field. It is the real `DeskLeaderboard`.

No dial, and no flag change: the flags are the PR's.

**Open https://trade-seven-oe8xsi7qm-fais-projects-bc179554.vercel.app in Safari on your iPhone and sign in as usual.** Steps marked *if one is available* need a real game; tests cover them otherwise.

**1. Command Center**
1. The hero is the armored figure, in your archetype's armor, in teal. A small black box in the top-right corner shows two lines of numbers.
2. Leave the phone still for **one minute**. Copy the line starting `60 s:` into a note. You are looking for about 60 fps and `late` near 0 %.
3. **Deploy.** The whole figure brightens once, for about a second, when it is confirmed. On a phone only a deploy does this, as with today's Shadow.
4. **Change your archetype** with no game running: Loadout → Change archetype, pick another, confirm. Back on the hub, the new armor flies on in about a second.
5. *On a computer or iPad, if you have one to hand:* tap the three areas beside the figure. Equipped Archetype brightens the armor's edges; Partnership and Shared Research the centre.

**2. A live BaggerBomb battle**
6. Your figure on the left, teal and armored. The computer's on the right, a copper glowing core facing you.
7. With long two-decimal scores (like −123.45), tap **aA** in Safari and raise the zoom to **125 %**, then **150 %**. The scores get smaller, and nothing touches "DAY 3 OF 5". This is the check S2 could not make: it needs SF Pro, the iPhone's font.

**3. League**
8. Add `?leagueForms=1` to the address (or open https://trade-seven-oe8xsi7qm-fais-projects-bc179554.vercel.app/?leagueForms=1). Four figures. Leave the phone still for **one minute** and copy the `60 s:` line. This is the one frame rate never measured on a phone: if it feels rougher than the Command Center, say so.
9. *If one is available:* a real pod before the bell. Nobody wears a crown, and the figures are calm.
10. *If one is available:* a finished game with a human rival. The rival keeps its armor. Open it fresh, not from a game you watched to the bell.
11. On a smaller screen or with Safari's bars showing, the arena fills most of the page and you scroll to the first portfolio card. That is the trade you accepted in S2; this is to see it once.

**4. The desk leaderboard**
12. On the `?leagueForms=1` page, tap the **desk** row's chips, which open the real leaderboard. **Level field:** no crown, and the top row shows "1". **Tied at the top:** the crown on the first row. **Normal field:** the crown on the leader.
13. *If one is available:* the real desk before the week's first bell, when every total is level.

Paste the two `60 s:` lines and anything that looked wrong back to Claude.

**How this carries the S2 review's §5:**

| Item | Where |
|---|---|
| 1 Figures on their points, Game over verdicts | Your re-check of Oct 30: "went great" |
| 2 The two `60 s:` lines | Steps 2 and 8 |
| 3 Ruling 4 on a real finished game | Step 10; rows otherwise |
| 4 The first picture before the bell | Step 9; rows otherwise |
| 5 Short phones | Step 11 |
| 6 Step 11 at 125 % and 150 % | Step 7 |
| 7 A desktop browser under 768 px with a classic scrollbar | Known limit, S2 §14: 1.8–4.7 px in Chromium, no phone affected |
| 8 SR-9, SR-10 | Answered in S2 |
| 9 The brighten | Steps 3 and 5 |
| 10 The no-WebGL SVG shows no flash | Known. The one parity gap with today's Shadow |

**Checked on the deployed preview:** driven in the app's own browser at 393 × 660, reading the page and looking at it. `/` answers 200 and `?leagueForms=1` loads with no error of its own (the one console error is Vercel's feedback script, blocked by the site's content security policy).

| Chips | Forms | Crown | "Total" line |
|---|---|---|---|
| You second, Spread, Live | 4 live, each on its point | On the leader, 44.2 total | Yes |
| All level, Live | 4 live | **None** | None |
| You first, Live | 4 live | On you | Yes |
| Desk board, Level field | n/a | **None; the top row shows 1** | n/a |
| Desk board, Tied at the top | n/a | On the first row | n/a |
| Desk board, Normal field | n/a | On the leader | n/a |

The readout runs on the League page and there is no dial. **The hub and the battle need a signed-in account,** so on those I can claim the 200 and nothing more: your run is their first flags-on render from this head, though S1 and S2 smoke already showed you the same code. This machine's frame numbers say nothing about an iPhone.

---

## 11. Found, not fixed

- **`OFF paneDesktopActive` depends on row order.** Its digests after the poll read the header's counter while it ramps on the real clock. The row holds only because it runs first in its file, on a slow cold start. Run later, the same scenario prints "+0" where the reference has "+183". Flag position has nothing to do with it, and the recaptured value carries the same exposure. My kill-switch row found it and avoids it. For separate tasking: settle the counter before that digest.

---

## 12. Commits and artifacts

On `claude/agent-form-flags-on`:
- `dda38af7`: F3, alone.
- `09e3a549`: the flip, its pins, the rewritten rows and the recapture, together, so the commit is green.
- `8b16abf2`: the hub's and the League's kill-switch rows, the guards' notes.
- `79023fe2`: a rollback moves one flag and one pin.
- `cba985c1`: the bundle row stays green through a rollback (the code head).
- then this report.

**Not committed** (session scratchpad): the capture and raw-diff harness, the mutant runner and its results, the WSL scripts. Runs under `~/fo-runs`.

**To remove the WSL worktrees:** `~/pd-ci-fo` and `~/pd-ci-fom` have `node_modules` linked to `~/pd-ci-af1`'s. Run `unlink <tree>/node_modules` first, then `git -C ~/pd-ci worktree remove --force <tree>`.

A copy of this report is at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261030_BUILD_AGENT_FORM_FLAGS_ON.md` (BUILD_RULES §3).
