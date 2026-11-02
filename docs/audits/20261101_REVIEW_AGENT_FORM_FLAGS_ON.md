# Review: Agent form flags on (PR #1017)

**Review date:** November 1, 2026 · **Model:** Fable · **Reviewed:** `claude/agent-form-flags-on` @ `4f8a3e55` (code head `cba985c1`), cut from `main` @ `337a5801` · **PR:** [#1017](https://github.com/fashraf94/TradeSeven/pull/1017), draft, head `4f8a3e55` at the time of this review · **Smoke branch:** `claude/agent-form-flags-on-smoke` @ `1474bd6e`, out of scope; only its absence from the PR is checked here · **Finding ids:** FO-1, FO-2, … (SR- and S2R- belong to the S1 and S2 reviews)

**Preamble.** `git fetch origin` ran first. `origin/claude/agent-form-flags-on` = `4f8a3e55`, the head the brief names, so the STOP does not apply. `origin/main` has moved to `5b32cea5` since the build (PR #1018, the setup-evidence store: 28 files, none under `src/`); per the brief it was not merged in, and every diff below is against `337a5801`, the merge base. This review made no code change. It worked from an app worktree, `claude/agent-form-flags-on-review-82297a`, reset to `4f8a3e55`, and this document is its one commit, pushed by refspec. Linux runs were WSL worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-ci-af1` (lockfile `8f3368941b7b`, the same at `main` and at the head): `~/pd-ci-rfo` @ `cba985c1` for the suites and the lint gate, `~/pd-ci-rfo-main` @ `337a5801` and `~/pd-ci-rfo-b` @ `cba985c1` for the builds, `~/pd-ci-rfo-mut` @ `cba985c1` for the mutants. The recapture dumps and the quick Windows runs used an LF `git archive` snapshot of `cba985c1` under the session scratchpad. Fenced files: none read, none called, none edited; nothing under `api/` changes in this PR.

---

## In plain language

The code this PR changes is three on/off switches and one crown rule, and all of it holds up: with the switches set back off the app builds byte for byte as it is today plus the crown fix, every rewritten test still goes red when I break the thing it guards, and the recaptured pictures differ from the old ones only where a figure stands. One thing to fix before merge, in the tests and not the app: two rows that compare the battle screen's picture after a price poll only pass while they run before any row that leaves an animation frame behind, so they depend on their place in the file rather than on what they check; today's order is safe, and the fix is a one-line change to how that file fakes its clock.

## Verdict: MERGE AFTER FIXES

**Findings:** 0 blocking · 1 should-fix (FO-1) · 5 notes (FO-2 … FO-6). The should-fix is a test-harness change in one file; no app code needs to move.

| # | Lens | Result |
|---|---|---|
| 1 | **The source-diff claim** | **Holds.** `main` `337a5801` → `cba985c1`, outside tests and docs: the three literals and their three docstrings (`src/config/agentFormFlags.js:50,66,82`), the one comment at `src/screens/battleView/ArenaHeader.jsx:40`, and F3 (one import, one gate, one condition, `src/components/League/LeagueDeskParts.jsx:36,156,177`). Nothing else; nothing outside `src/` and `docs/`. Nothing from the smoke commit is in the PR (§3.1). |
| 2 | **The kill switches** | **Holds.** Unminified Linux build, LF, hashes masked, source maps out: `main` against the head with all three flags `false` is **47 files, 1 differs, 3 lines, all F3's**. The hub flag and its pin set back alone: **full suite 27,880 rows, 0 failed**. One flag back alone leaves that chunk free of every form identifier, but not byte-identical to `main`'s while the other two stay on (FO-2). |
| 3 | **The 98 rewritten rows** | **Hold; no assertion went soft.** Every item in the report's "parts of rows that went" table is guarded where it says, with one citation wrong (FO-4). Four mutants of my own, all killed (§3.3). The hub's recording stand-in hides nothing: the hero's own failure paths are held in the wrapper's and the engine's suites (§3.3). |
| 4 | **The recapture** | **Holds.** Ten of the 34 changed captures re-derived from raw markup: in the quote file each changed capture differs in exactly 4 lines, all the CPU side's cell (R9); in the header the no-face captures differ only in that cell and the face captures swap the robot head's SVG for the form's slot and still. **0 lines outside a face → form slot or the cell.** The FORMS block is separate from the OFF references and replaces values by path only; the dev-stack scrub is safe (§3.4). |
| 5 | **F3** | **Matches the ruling.** A level field (0/0/0/0, 12.5 ×3) shows no crown and the top row prints "1"; a partial tie keeps the crown; a lone player has none; near-equal decimals keep a leader because level is exact. Two other boards still crown a level field; listed, not fixed (FO-5). |
| 6 | **Guards** | **None retired, none loosened.** The only guard files in the diff are the pins, `flagPinGuard`'s `DARK_BY_DESIGN` and the bundle guard. With the flag file shipping `true`, the bundle guard still bites: a pure mark taken off `HubAgentForm.jsx` reddens two rows (§3.3, M4). |
| 7 | **The row-order dependency** | **Confirmed, wider than §11 says, and with a different cause than the report gives.** jsdom drives `requestAnimationFrame` through the `setInterval` the file fakes, so frames land inside each poll's own clock advance, deterministically; what kills them is a frame callback leaked across `useRealTimers()` by an earlier row, after which jsdom's frame driver never restarts. **Two** OFF rows (`paneDesktopActive` and `failureAndRecovery`) read the counter after a poll and are exposed; both run before the first leaking row today, and the recapture carries the same values (FO-1). |
| 8 | **Production vs the smoke** | **No new header or policy needed.** three.js is bundled, no worker, blob or eval; the CSP already allows what the chunk needs and is the same on preview and production. First load on a slow phone shows the still until the 162.83 kB (gzip) engine chunk arrives; every form on a page shares one WebGL context; a lost context falls back to the still (FO-6). |
| 9 | **Checks** | `lint:gate` exit 0. Full Linux suite on `cba985c1`: **1,264 files, 27,880 rows, 27,791 passed, 0 failed, 89 skipped** (WSL, `TZ=UTC`, 8 workers, under `flock`). The branch alone, not the merge ref: `main` moved after the build (§3.9). |

---

## 1. The founder's rulings, checked against the code

| # | Ruling | In the code |
|---|---|---|
| F1 | All three flags on together; the lab flag stays `false`; `AGENT_FORM_PHONE` stays `'live'` | `AGENT_FORM_HUB_ENABLED`, `AGENT_FORM_BATTLE_ENABLED`, `AGENT_FORM_LEAGUE_ENABLED` are `true` in one commit, `09e3a549`, with their pins (`src/config/agentFormFlags.js:50,66,82`; `src/config/agentFormFlags.test.js:30,34,38`). `AGENT_FORM_LAB_ENABLED = false` at `agentFormFlags.js:32`; `AGENT_FORM_PHONE = 'live'` at `src/components/CommandCenter/hub/hubFlags.js:58`. Both unchanged from `main`. **VERIFIED** |
| F2 | The flags stay as kill switches; the old faces stay in the code; a rollback is one flag and its pin; the old path stays tested | Every read is still a literal ternary at an existing element (`ShadowStage.jsx:164-168,201-205` and the sites the `agentFormFlags.test.js` source rows pin). ShadowCanvas, the robot heads and their paths are untouched. Flag-off rows: `CommandCenterHub.killSwitch.jsdom.test.jsx` (13), `leagueAgentForm.killSwitch.jsdom.test.jsx` (9), and the flag-off blocks kept in the battle files. My own rollback (hub flag + pin): the whole suite green (§3.2). The comments describing the rollback disagree with the pin row about a third line (FO-3). **VERIFIED** |
| F3 | The desk leaderboard crowns nobody on a level field, for everyone; a partial tie unchanged; the top row prints "1"; a lone player no crown | `LeagueDeskParts.jsx:156` reads `isLevelBoard` over the sorted totals, `:177` gates the crown; not behind any flag, in its own commit `dda38af7`. `DeskLeaderboard.levelField.render.test.jsx`, 9 rows, holds each case. **VERIFIED** |

---

## 2. Findings

### FO-1 · should-fix · two OFF digests depend on no earlier row leaking a frame callback

**Where:** `src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx:259` (the fake timers), `:391` (`poll`), `:2516` (`OFF paneDesktopActive`), `:2575` (`OFF failureAndRecovery`), `:3954` (the kill-switch row's `withoutMarkup`), `:3652` (the first leaking row); `src/components/shared/AnimatedScore.jsx:83-112`; `node_modules/jsdom/lib/jsdom/browser/Window.js:601-646` (jsdom 29.1.1).

**What is true, and how it was found.** I filed this as a real-clock race (the counter ramps on a frozen fake `Date` and I took its frames to be real-time), and the refuter (§4) showed that mechanism wrong: jsdom's `requestAnimationFrame` is a `setInterval(…, 1000/60)` behind a counter of outstanding callbacks, and the file fakes `setInterval`, so every frame fires inside `vi.advanceTimersByTime`, on the fake clock. The raw dumps agree once read that way: before a poll both counters print `+0`/`+0` (no clock has moved); a poll's 60 s jump fires some 57 frames and completes the 900 ms mount ramp, so `paneDesktopActive.polled` and `.after` print `+183`/`+88` and `failureAndRecovery.recovered` prints `-1615`/`+535`, deterministically. A real 400 ms wait before each of those digests changes nothing (refuter E4, 15 of 15); across all 277 rows no frame ever fired outside a poll's advance (E2).

**The cause of the report's "+0".** A frame callback left outstanding when a row's `afterEach` calls `vi.useRealTimers()` leaves jsdom's counter above zero while the fake interval that would have served it is gone, so jsdom never starts an interval again: frames are dead for the rest of the file, on the fake clock and the real one (E1b). `AnimatedScore` can leak one: its unmount cancels the single `rafId.current` (`:83-86`), while a value change during the 900 ms mount ramp leaves two loops in flight, each overwriting that ref. The first row to leak is at position 76, `[A-4] an excluded-then-errored battle keeps the legacy behaviour` (`:3652`; four frames requested, two cancelled, two leaked); from there every post-poll digest in the file reads `+0`. That is the build's §11 observation on its kill-switch row (position 93) and the "3 bytes" the F15 comment records (`:4551`).

**Sizing.**
- **X2 / E3, frames never land** (`window.requestAnimationFrame = () => 0` file-wide): **exactly 2 of 277 rows fail, `OFF paneDesktopActive` and `OFF failureAndRecovery`**; 275 pass. No other row reads a frame.
- **E5, one extra row before `paneDesktopActive` that requests a frame and never cancels it**: the same two rows fail, with digests byte-identical to E3's. The dependency reproduces with no real time at all.
- **X1, a warm-up row that leaks nothing**: 278 of 278 pass. Position matters only through the leak.
- `swapTransition` is not exposed: it stubs `requestAnimationFrame` itself (`:4560`). The kill-switch desktop row avoids it by dropping `html` after the poll (`:3954`), so the flag-off markup after a poll is held only by the OFF row.

**Exposure today: none in the shipped file.** The OFF describe is the file's first, both rows sit before row 76, `vitest.config.js` sets no shuffle or sequence override, and name filters do not reorder. It opens the moment a leaking row is added or moved ahead of them, or shuffle is turned on, and the `FORMS` recapture (`paneDesktopActive['polled.html']`, `['after.html']`, `failureAndRecovery['recovered.html']`) carries the same dependence. The report's §11 names one row and the wrong cause.

**Smallest fix (test only).** Add `'requestAnimationFrame'` and `'cancelAnimationFrame'` to the file's `toFake` list at `:259`: the fake then owns the frame queue, `useRealTimers()` discards whatever is left in it, and jsdom's counter never moves, so no row can kill frames for a later one. **Do not advance a frame after the polls:** the 60 s jump already completes the mount ramp, and one more tick would start the post-poll change ramp and move the digits off the references, forcing a recapture. Re-run the file whole and under `-t "OFF-5"`; the kill-switch desktop row can then compare `html` again. The product-side alternative, cancelling every in-flight ramp at unmount in `AnimatedScore`, is a change to a shipped component and is not this PR's.

### FO-2 · note · a one-flag rollback is not "exactly the app you have today"

**Where:** `docs/audits/20261030_BUILD_AGENT_FORM_FLAGS_ON.md:17,167`.

**Evidence.** The all-off claim is exact (47 files, 1 differs, F3's 3 lines; §3.2). With only the hub flag off and the other two on, the Command Center chunk carries **0** form identifiers (`HubAgentForm`, `AgentFormStill`, `loadAgentFormEngine`, `data-hub-agent-form`) and the same 4 `ShadowCanvas` mentions as `main`'s, so the surface is back and nothing of the form stays in it. But the chunk is 287,077 bytes against `main`'s 289,992 (the all-on chunk is 269,544), 69 lines removed and 14 added: the League's form reaches `hub/selectors/gameOutcome.js`, so Rollup hoists it into a shared `gameOutcome` chunk that the hub chunk now imports instead of inlining, and the entry's export aliases shift, which touches the import line of every lazy chunk. The sentence "The rollback gives you exactly the app you have today" is true of all three flags off, and the row above it ("a rollback is two lines") is true of each flag alone; read together they overstate what a single rollback restores.

**Smallest fix.** One sentence in the report and the PR body: a single flag's rollback restores that surface's element and sheds every form identifier from its chunk; only all three off rebuilds `main` byte for byte.

### FO-3 · note · the rollback comments and the turned-around pin row disagree

**Where:** `src/config/flagPinGuard.test.js:142-147` (the comment: "a rollback moves the flag, its pin and its entry here together"); `src/config/agentFormFlags.test.js:5-6` (the header, the same three moves) and `:49-53` (the row titled "a rollback moves these lines too", whose body asserts the three `DARK_BY_DESIGN` entries are **absent**); `docs/audits/20261030_BUILD_AGENT_FORM_FLAGS_ON.md:261` ("two lines").

**Evidence.** On the snapshot I rolled the hub flag back the way the comments say: flag `false`, pin `false`, and the `AGENT_FORM_HUB_ENABLED` entry re-added to `DARK_BY_DESIGN`. `flagPinGuard.test.js` stays green (6 of 6) and `agentFormFlags.test.js` goes red on exactly one row, `flagPinGuard no longer lists them as dark by design … (a rollback moves these lines too)`. The two-line rollback the report describes and my dry run proved (§3.2) is the one that is green; someone following the comments reddens CI.

**Smallest fix.** One story in all three places: a rollback moves the flag and its pin, and the `DARK_BY_DESIGN` entry stays out (the flag is no longer dark by design; it is a live kill switch). Reword the two comments and the row's title; or, if the entry is wanted back on a rollback, drop the three `not.toMatch` pins. Comments and a test title only.

### FO-4 · note · one citation in the report's "parts of rows that went" table

**Where:** `docs/audits/20261030_BUILD_AGENT_FORM_FLAGS_ON.md:74`.

**Evidence.** The `data-shadow-reduced-motion` row says the prop reaching the form is held by `AgentForm.s1`. That file has no reduced-motion row; the rows are `src/components/AgentForm/AgentForm.jsdom.test.jsx:79,94,97` (the option set the wrapper hands the engine, `reducedMotion: true` on a reduced-motion mount). The guard exists; the pointer is wrong. Every other row of that table checks out (§3.3).

**Smallest fix.** The citation.

### FO-5 · note · two other boards still crown a level field (list only, per the brief)

- `src/components/League/LeagueDeskParts.jsx:289,308`, the desk funnel's Final Four node: `champion = isFinal && resolved ? ranked[0] : null`, with `ranked` sorted by `pscore`. A resolved final whose four totals are equal crowns row 0 by list position. A real board (`leagueAdapter.js` builds `st`), an unlikely state.
- `src/components/League/LeagueClimbStanding.jsx:98,116,196` and `src/components/League/LeagueClimbChart.jsx:74,243`: `leaderId = ranked[0].id`, crowns by position whatever the totals. These sit behind the param-only climb preview (`src/screens/LeagueScreen.jsx:60,69`) on fixture data (`leagueClimbFixtures`), so no player reaches them without the param.

Not crowns of a leader, so not in scope: the FINAL pill (`LeagueParts.jsx:138`), the Film Room buttons and title (`ArenaDesktop.jsx:107`, `ArenaMobile.jsx:184`, `ArenaOverlays.jsx:288`), the recap eyebrow (`LeagueRecapEntry.jsx:47`), the banked-day crown (`BackingStrip.jsx:49,184`). The dashboard clash cards crown on `myGain > theirGain` (`ClashCard1v1V3.jsx:37`, `V4:37`), strict, so a tie crowns nobody. `AgentLeaderboardTab.ARCHIVED.jsx` is imported by nothing. The two League game boards are already gated (S2R-3).

### FO-6 · note · what production can show that the smoke did not

- **Content security policy (`vercel.json:37`).** The engine imports three.js from the bundle (`src/components/AgentForm/engine/*.js`, `import * as THREE from 'three'`); no `Worker`, no `blob:` URL, no `createObjectURL`, no loader, no `eval` or `new Function` anywhere under `src/components/AgentForm/`. `script-src 'self'` serves the chunk and the policy already carries `'unsafe-inline' 'unsafe-eval'`; WebGL shader compilation is not CSP-governed; no `worker-src` is needed. `vercel.json` applies to preview and production alike, so there is no header difference. The one console error the report saw on the preview (Vercel's feedback script blocked by the CSP) is preview-only chrome and will not appear in production.
- **First load on a slow phone.** The engine chunk (614.83 kB, 162.83 kB gzip; Vercel serves Brotli, smaller) loads once, on the first form a player meets, through the wrapper's one `import()`. Until it arrives the form is its SVG still (`AgentForm.jsx:112,125`, held by `AgentForm.jsdom.test.jsx:72`); on a slow cellular link that is a still for a few seconds, then the form. The smoke was on wifi and never showed this window. **Smallest fix:** one step on the founder's phone checklist: first open on cellular with the site's data cleared, expecting the still and then the form.
- **No WebGL, and WebGL lost.** `hasWebGL()` (`agentFormSpec.js:84`) false: the wrapper never requests the engine chunk and shows the still (`AgentForm.jsx:71,82`; `AgentForm.jsdom.test.jsx:56`). A chunk that fails to load: the still (`:93`; `AgentForm.jsdom.test.jsx:149`). A renderer that cannot be made: `unavailable`, the still (`engine.lifecycle.jsdom.test.js:731`). A lost context: every view of that context shows its still and drawing resumes on restore (`engine.js:119-120,162`; `engine.lifecycle.jsdom.test.js:675`; `AgentForm.engine.jsdom.test.jsx:82`). Every form on a page shares one WebGL context on the default `shared` path (`glPlatform.js:16`; no shipped caller passes `drawPath="direct"`), so the League's four figures are one context, under Safari's limit.
- **Still unproven** and only provable on a device: the `60 s:` frame-rate lines, a real pod before its bell, a finished game with a human rival, SF Pro at 125 % and 150 %. The report's §10 checklist stands.

---

## 3. Lens notes

### 3.1 The source diff (lens 1)

`git diff 337a5801 cba985c1` excluding `*.test.js`, `*.test.jsx` and `docs/`: three files. `src/config/agentFormFlags.js`: the three literals and their docstrings, which now call the flags LIVE and name the kill switch. `src/screens/battleView/ArenaHeader.jsx:40`: "off on main" → "on", a comment. `src/components/League/LeagueDeskParts.jsx`: `import { isLevelBoard } from './battleArena/arenaStateMap'` (`:36`), `hasLeader` (`:154-156`), the gate (`:177`). No file outside `src/` and `docs/`. The report commit `4f8a3e55` adds the report alone.

**The smoke stayed out.** `1474bd6e` is not an ancestor of `4f8a3e55`; its three files (`src/App.jsx`, `src/components/CommandCenter/HubAgentForm.jsx`, `src/screens/SmokeLeagueForms.jsx`) are unchanged between `337a5801` and `cba985c1`; the PR's six commits are `dda38af7`, `09e3a549`, `8b16abf2`, `79023fe2`, `cba985c1`, `4f8a3e55`, none of them the smoke's.

### 3.2 The kill switches (lens 2)

`vite build --minify false` in WSL, LF worktrees, `.map` files removed, `-[8 chars].js/.css` masked in names and contents.

| Build | Files | Against `main` |
|---|---|---|
| `main` `337a5801` | 47 (45 assets) | — |
| head, all three flags `false` | 47 | **1 file differs, the entry, 3 lines: `hasLeader`, and the two sides of the crown condition.** F3 exactly, nothing else. |
| head, hub flag `false`, battle and League `true` | 54 | 36 files differ; the hub chunk holds 0 form identifiers and `main`'s 4 `ShadowCanvas` mentions (FO-2) |
| head as shipped, all `true` | 55 | 38 files differ; the engine, `BattleAgentForm`, `LeagueAgentForm`, `agentGrowth`, `agentMood`, `gameOutcome`, `finishedRivalRead`, `useCoarseNow` chunks appear |

One masking note so the counts are read right: the engine chunk is emitted as `index-<hash>.js`, the same stem as the entry, so under the mask it collides and is left unmasked in the two builds that have it (hence 54 and 55 rather than 53 and 54). The all-off build has no engine chunk and is unaffected; its 47 is the report's 47.

**The rollback dry run.** On `~/pd-ci-rfo` @ `cba985c1`: `AGENT_FORM_HUB_ENABLED` to `false` at `agentFormFlags.js:50` and its pin to `false` at `agentFormFlags.test.js:30`, nothing else, no `DARK_BY_DESIGN` entry re-added. Full Linux suite: **27,880 rows, 27,791 passed, 0 failed, 89 skipped.** The pin guard and the turned-around row both stayed green. The tree was restored and checked clean.

### 3.3 The rewritten rows (lens 3)

**Baseline.** The ten rewritten or new test files on the Windows snapshot: 237 rows, all green (`agentFormFlags` 8, `flagPinGuard` 6, `ArenaHeader.render` 58, `DeskLeaderboard.levelField` 9, `leagueAgentForm.killSwitch` 9, `CommandCenterHub.killSwitch` 13, `paneHeader` 20, `CharacterPane.comparison` 11, `CharacterAvatar.render` 30, `CommandCenterHub.s7` 73).

**The hub's stand-in.** `CommandCenterHub.s7.jsdom.test.jsx:61-62` and `CommandCenterHub.jsdom.test.jsx:34-35` mock `AgentForm` with a class whose `componentDidMount` calls `this.props.onStatus(...)` and whose render records the props. What the rows now assert is what the hub hands the hero: `size`, `rate`, `label` (the stand-in puts the prop on its own `aria-label`), `mood`, one `responseKey` per trigger, `paused`, `reducedMotion`. The chain from those props to pixels is held elsewhere, and I checked each link: `responseKey` → `view.respond` (`AgentForm.jsx:110`; `HubAgentForm.jsdom.test.jsx:160-228`, `engine.lifecycle.jsdom.test.js:510-562`), `paused` → `setOptions` (`AgentForm.jsx:107`; `AgentForm.s1.jsdom.test.jsx:109`; `engine.lifecycle:404-477`), `reducedMotion` (`AgentForm.jsdom.test.jsx:79,94,97`; `engine.lifecycle:604-654`), `onStatus` (`AgentForm.jsdom.test.jsx:169`). The hero's failure paths, which a stand-in reporting `live` could hide: no WebGL (`AgentForm.jsdom:56`), a chunk that fails to load (`:149`), a lost context (`:127`, `AgentForm.engine.jsdom:82`), a renderer that cannot be made (`engine.lifecycle:731`), and the hub's own reading of a form that has not reported (`HubAgentForm.jsdom:118,128`; the S7 rows "a form that never reports live" and "an engine that fails"). Nothing is left unguarded.

**The "parts of rows that went" table (report §2), item by item.** Strokes per frame and the tier: `CommandCenterHub.killSwitch` (126 / 30 strokes) and `ShadowCanvas.jsdom.test.jsx:172,180`. A context never asked for and the loop's count: `killSwitch` ("no canvas context is ever asked for"), `ShadowCanvas.jsdom:164,192,350`. `data-shadow-strand`: `ShadowStill.jsdom.test.jsx:50-63`. `data-shadow-reduced-motion`: the killSwitch row has the attribute; the rewritten rows assert the prop; the wrapper rows are in `AgentForm.jsdom.test.jsx`, not `AgentForm.s1` (FO-4). The 420 ms flash: `engine.lifecycle:604` and `HubAgentForm.jsdom:164`. "The core pulses": the S7 rows assert `mood === 'researching'` while submitting. A response that "waits": `engine.lifecycle:562`.

**Counts and thresholds.** No widened range and no removed `expect` without a replacement in the rewritten rows. Two things worth naming: the quote file's kill-switch desktop row deliberately compares everything but the markup after the poll (`:3954`, FO-1, documented in place); `leagueAgentForm.killSwitch.jsdom.test.jsx:63` uses `toBeGreaterThanOrEqual(4)` on the number of head renders, which is right for a recorder that is pushed on every render and is followed by per-seat reads of the last render. The bundle guard's new row (`agentForm.flagOffBundle.test.js:145-149`) pins exactly four `_ENABLED` flags after the rewrite, so a fifth flag in the module will fail it until the row is updated: a ratchet, stated here so it is not read as a bug later.

**Mutants of my own**, on `~/pd-ci-rfo-mut`, each applied alone, its files run, the tree restored from `HEAD` and checked clean:

| | Mutant | Rows run | Killed by |
|---|---|---|---|
| M1 | `ShadowStage.jsx:165`: the desktop hero handed `paused={false}` | `CommandCenterHub.s7` | **4 red**: the three pause rows (1216, 770, 614 px) and the reduced-motion pause row |
| M2 | `battleAgentFormSlot.jsx:59`: the desktop arena box 88 → 86 | `ArenaHeader.render`, `paneHeader` | **3 red**: the forms `presenceDuel` size row, `presenceOnMarkup`, and the pane header's "boxes the ARENA form" row |
| M3 | `ArenaHeader.jsx` the CPU cell's gap 12/8 → 13/9 (the R9 cell, flag on only) | `ArenaHeader.render`, `quoteAvailability` | **20 red**: all 10 quote-file OFF rows that compare against `withForms(...)`, and the 10 `FORMS6` digests; **no flag-off row moved**, as the old cell is untouched |
| M4 | `HubAgentForm.jsx:42`: the `/* @__PURE__ */` mark off the context, with the flag file shipping `true` | `agentForm.flagOffBundle` | **2 red**: "HubAgentForm.jsx, imported and unused: nothing" and "the check bites" |

Four of four killed. M4 answers lens 6's question directly: the guard's rewrite of the flag module to all-`false` is what makes it mean anything now, and it still catches a leak.

### 3.4 The recapture (lens 4)

**Method.** On the Windows snapshot I patched the two files' `digest` helper to also write each raw markup string to a dump directory, keyed by its SHA-256 (no assertion changed), ran `ArenaHeader.render` once (its OFF6 block runs flag-off, its FORMS6 block flag-on), and ran the quote file's two OFF blocks twice, once as it stands and once with the hoisted `forms` default `false`. Every reference digest on both sides was produced (18 header pairs, 16 quote pairs), so the dumps are the references' own markup. The diff tool renumbers React ids, strips the dev-stack template, splits on tag boundaries and runs an exact LCS diff.

**Quote file, six pairs** (`paneDesktopActive.priced`, `.after`, `paneMobileActive`, `failureAndRecovery.failed`, `completed`, `swapTransition.polled`): each is **4 changed lines**, and all four are the CPU side's cell: the old `why-book-cpu` column becomes a flex row (`gap: 12px` on the desktop, `8px` on the phone, `min-width: 0`) wrapping the unchanged label-and-score column. 0 lines anywhere else. The forms themselves are a recorder's `<span data-test-form>` in this file, as the faces were a recorder before, so the slot's own markup is not what these digests compare; the header's are.

**Header, four pairs.** `desktop` (no face): 4 lines, the same cell. `notBookable`: 2 lines, the cell's new wrapper (the cell has no id without a book). `presenceOnMarkup.desktop` and `.negatives`: 112 changed lines each: the robot head going (`data-arena-face` 56 px, its two `env-layer` divs, 64 SVG lines), the form arriving (`data-arena-form` 88 px with its negative margins, the suspense markers `<!--$!-->` / `<!--/$-->`, the still's `aria-hidden` box and 28 SVG lines), the CPU cell (3 lines), and closing tags. 0 lines outside those slots and the cell.

**The block's shape.** `FORMS` (`quoteAvailability:2364-2503`) holds only the moved values, each by path; `withForms` (`:2505-2513`) clones the OFF record and replaces those paths, so price calls, subscriptions, research and breakdown payloads are still the pre-build capture, and the 12 records the report lists as unmoved have no `FORMS` entry. `FORMS6` (`ArenaHeader.render:489-564`) is a separate block under its own BEGIN/END markers; the 11 `OFF6` references are untouched and still run flag-off. The dev-stack scrub (`noDevStack`, `ArenaHeader.render:589`) removes `<template data-msg…>…</template>` only; that template is React's development-build note for a suspended lazy boundary and carries the machine's absolute paths, so dropping it is what makes the digest portable, and nothing the app ships is inside it.

### 3.5 F3 (lens 5)

Each case in the ruling, by the rows and by reading `isLevelBoard` (`arenaStateMap.js:77`, `new Set(totals).size < 2`, so `NaN` and `undefined` totals count as one value): a level field at zero and away from zero, no crown and the top row's slot prints "1" (the slot holds a crown or the number); a partial tie at the top keeps the crown on the first row by list position, a tie lower down keeps it on the leader; a lone player, no crown, "1"; 5.03 / 5.02 / 5.01 keep a leader although `Score` prints them alike at one decimal (`LeagueParts.jsx:83`), which is the shared predicate's exact equality and the ruling's "a partial tie is unchanged". The empty field keeps its empty state. The other boards are FO-5.

### 3.6 Guards (lens 6)

The diff touches three guard files and no other: the pins (values moved, the literal row made value-neutral, the `DARK_BY_DESIGN` row turned around), `flagPinGuard.test.js` (three entries dropped with a comment), and `agentForm.flagOffBundle.test.js` (comments, the `flagOff` docstring, one new row). The literal-ternary source rows, the hub mount guard, the activity guard, `agentForm.guard`, the token and motion guards are byte-for-byte as on `main`. M4 shows the bundle guard still bites with the file shipping `true`. One thing it does not and never did measure: chunk composition in a mixed build (one flag off, two on), which is FO-2's territory and is a build-level fact, not a pure-mark fact.

### 3.7 The row-order dependency (lens 7)

FO-1. Confirmed as a dependency on position, sized to exactly two rows (X2, E3), reproduced by a leaking row placed ahead of them (E5), and traced to its cause (a frame callback leaked across `useRealTimers()`), which is not the cause the report gives. The answer to the brief's question, "does any other row in the quote file read an animating counter on the real clock": none does, and neither do these two; no row in the file reads a frame outside a poll's clock advance.

### 3.8 Production vs the smoke (lens 8)

FO-6.

### 3.9 Checks (lens 9)

- `lint:gate` on `~/pd-ci-rfo` @ `cba985c1`: exit 0.
- Full Linux suite there, WSL Ubuntu, Node 22.22.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`: **1,264 files, 27,880 rows, 27,791 passed, 0 failed, 89 skipped**, the report's numbers. The code head `cba985c1` is the tree tested; `4f8a3e55` adds the report only.
- Not run: the Firestore rules suite (no rules change in this PR), anything on a device, and the merge ref. `origin/main` is `5b32cea5`: 28 files since `337a5801`, all under `api/`, `test/rules`, `docs/`, plus `firestore.rules`; none under `src/`, and none of the new tests scans `src/`. GitHub tests the PR merged into `main`, so the fix pass's run on the merged tree is the one that counts for CI.
- WSL was not restarted.

---

## 4. The adversarial pass (BUILD_RULES §2)

One refuter per should-fix finding; the notes carry their own evidence above.

**FO-1, refuter's brief:** show that the post-poll digests cannot depend on real time (React's `act` always yields enough turns; or the digits are the same whether a frame lands or not; or the two rows fail under dead frames for a pre-poll reason). Working on the snapshot, read-only on git.

**FO-1 as filed: REFUTED. FO-1 as restated above: CONFIRMED.** The refuter's experiments, all on the snapshot with the tree restored and checked afterwards:
- **E1a**, a probe file with the quote file's `toFake` list: a frame requested, 150 ms of real waiting, 0 fires; `advanceTimersByTime(17)`, 1 fire. jsdom's frame driver is the faked `setInterval`.
- **E2**, the whole 277-row file with `requestAnimationFrame` wrapped and each fire tagged by phase: `paneDesktopActive` 114 requested, 114 fired inside advances; `failureAndRecovery` 116 requested, 114 fired inside advances, 2 cancelled at unmount; **0 fires outside an advance in any of the 277 rows.** Ticks ran at fake 16 … 912 ms, so the poll's jump completes the mount ramp exactly.
- **E4**, a real 400 ms `setTimeout` before each of the three post-poll digests: 15 of 15 OFF rows pass, no digest moves. The lit flash in `recovered` is stable too: it is set synchronously by the change effect, whose ramp never ticks, so no clear timer is armed.
- **E1c**, the same file under real timers: `flush()`'s four async acts take 0.43 ms and yield no frame, so the race I filed would exist if frames were real; in this harness they are not.
- **E1b**, the cause: one leaked callback across `useRealTimers()` and a fresh request fires on neither clock. **E3** (`requestAnimationFrame = () => 0`, `-t OFF-5`): exactly the two rows fail, polled and after read `+0 / +0`, recovered `+0 / +0` with the flash lit. **E5**, a row inserted before `paneDesktopActive` that requests a frame and never cancels it: the same two rows fail with E3's digests, byte for byte, and no real time involved. The first leaking row in the shipped order is position 76 (`:3652`).

The refuter's own conclusion, which this review adopts: fix the leak's reach (fake the frame queue per file, or cancel every in-flight ramp), not frame timing, and do not advance a frame after the polls, which would move the digits off the references.

---

## 5. What the fix pass should do

1. **FO-1** (should-fix): add `'requestAnimationFrame'` and `'cancelAnimationFrame'` to the `toFake` list at `AgentBattleScreen.quoteAvailability.jsdom.test.jsx:259`, advance no frame after any poll, restore the `html` comparison in the kill-switch desktop row (`:3954`), and re-run the file whole and under `-t "OFF-5"`; if any OFF digest moves, stop and look rather than recapture.
2. **FO-3** (note): one rollback story in `flagPinGuard.test.js:142-147`, `agentFormFlags.test.js:5-6` and the title at `:49`.
3. **FO-2, FO-4** (notes): the two sentences in the report and the PR body.
4. **FO-6** (note): one cellular first-load step on the founder's phone checklist.
5. Merge current `origin/main`, then the final checks on the merged tree (full Linux suite, `lint:gate`, `vite build` of the pushed head).
6. **FO-5** is for separate tasking, not this PR.

---

## 6. Artifacts and cleanup

- This document: `docs/audits/20261101_REVIEW_AGENT_FORM_FLAGS_ON.md`, one commit on `claude/agent-form-flags-on`; a copy at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261101_REVIEW_AGENT_FORM_FLAGS_ON.md` (BUILD_RULES §3).
- Not committed (session scratchpad): the chain and mutant scripts, the masked `dist-*` trees and suite JSONs under `~/rfo-runs`, the raw dumps and their diffs, the digest-dump patch.
- **Cleanup owed in WSL:** `~/pd-ci-rfo`, `~/pd-ci-rfo-main`, `~/pd-ci-rfo-b`, `~/pd-ci-rfo-mut` link `node_modules` to `~/pd-ci-af1`'s: `unlink <tree>/node_modules` first, then `git -C ~/pd-ci worktree remove --force <tree>` and `worktree prune`; `~/rfo-runs` holds about 1 GB of masked builds. The build session's `~/pd-ci-fo` and `~/pd-ci-fom` are still there too.
