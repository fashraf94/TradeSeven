# Build report — Command Center hub, slice S7

Claude Code (Sonnet 5.5 at High effort, with an Opus advisor consulted at four points; the review lenses, the refuters and the mutating lens on Sonnet 5.5), October 25, 2026, for Flash. The build prompt was the founder's "FantasyTrades Command Center — slice S7: Shadow in motion, the status line, and the layout record" of October 25, with rulings R-S7-1 … R-S7-9. This report covers S7 only (spec V1.2 §11.2 row S7, §10, IR-14, and the carry-forwards from S1, S2a and S2b). Everything is behind `COMMAND_CENTER_HUB_ENABLED = false` (`src/config/featureFlags.js:3444` at the merged head; #995 added two lines above it), which stays false: with the flag off nothing a player sees changes.

Not in S7, and not touched: the deploy action and its wiring (S2b), the Loadout and Research content (S5, S6), the flag flip and the shell's chrome (S8), the sky and everything under `api/`.

## Verdict

| Item | Result |
|---|---|
| **Status** | **Draft PR, STOP.** Nothing merged; nothing activated; no CI watched. The flag is `false` at the PR head. |
| Branch and head | Local branch `claude/advisor-opus-61abb6` (the desktop app's worktree name), pushed as the prompt's `claude/command-center-hub-s7`. S7's code head is `68e0b7aa`; `origin/main` moved to `7e15d5d5` (PR #995) during the build and is merged in at `6f1a832e` (no conflict; it changes `api/`, `scripts/`, `docs/`, `src/services/agentDeploy.js`, `src/utils/stockAdmissionWindow.js`, the Forge ticker search and one block of `src/config/featureFlags.js`, and no hub file); the commit after it adds only this report and its README row. Cut from `main` `27514b1a`. |
| Starting check | Every anchor the rulings lean on matched at the base (§3). One STOP-rule condition fired (two existing rows had to move); it was put to the founder in-session before any commit and answered "Update both rows" (§3). |
| R-S7-1 / R-S7-2 | `ShadowCanvas` is the design's canvas Shadow in `ShadowStill`'s fixed box and props contract; it draws the still for reduced motion, an unavailable 2D context (also an engine with no 2D interface) and the phone constant. Tiers are fixed (phone low, otherwise mid, never high); no picker, no self-downgrade, no detector — pinned by behaviour and by a source scan (§4). |
| R-S7-3 / R-S7-4 | Ambient signals and flares; processing only while a hub-started deployment is submitting; the response bloom only for a new area selection and an attempt's created terminal, once per attempt id; labels `ambient` / `still` / `processing` plus the area (§4). |
| R-S7-5 | Pauses when the document is hidden, the box is offscreen and while the root deploy ceremony covers the page; one frame, one observer, one listener, one timeout, all released on a size change, a tier change and an unmount; every activity call is in the guard manifest (§4). |
| R-S7-6 / R-S7-7 | `PHONE_SHADOW = 'canvas'` is the one constant that gives the phone the still. The status line is one live region and seven rules in order, its words in `hubCopy.js` reusing the Deploy card's (§4). |
| R-S7-8 | Layout record in headless Edge at 360×640, 390×844, 834×1000 and 1280×820 across none / ranked-only / both live; reduced motion, no canvas, hidden and offscreen verified on a real canvas; **performance proxy at 4× CPU throttle on a quiet machine, DPR 3: 60 fps, 0% late frames, 2.6 ms of scripting a frame at both 390 and 360 wide** against the targets 60 / ≤ 6 ms / ≤ 2% (§8). A proxy, not the phone: the founder's checklist is §12. |
| R-S7-9 | `main` moved once (#995, none of it a hub file) and is merged; the canvas is in the hub chunk; the entry chunk is **byte-identical to `main`'s after hash normalisation (delta 0)** (§7). |
| §2 review | Four lenses — A motion honesty, B lifetime and cleanup, C status-line truth, T test integrity (mutating) — with refuters on isolated `git archive` snapshots for A, B and C. **39 findings:** A, B and C 24 (15 CONFIRMED, 8 PARTLY, 1 REFUTED); T 15 (6 MAJOR, 7 MINOR, 2 NIT). 26 fixed, 10 accepted or declared with the reason, 1 refuted, 1 carried as a founder question, 1 not S7's (§9). Answering lens T's T-13 exposed a real defect (a stale owed flash on the canvas route), fixed. |
| Mutation | Final head `68e0b7aa`: 116 planted defects, 113 killed; the 3 survivors are one equivalent mutant and a redundant pair of guards that dies when removed together. The earlier pass on `f77a4277` ran 164. The design-parity digest alone kills 16 of the 17 plants aimed at the design's constants (§9.5). |
| `vite build` | Exit 0 on the merged head `6f1a832e` (Linux). Hub chunk 134.19 kB / 41.76 kB gzip against `main`'s 124.91 kB / 38.16 kB; entry chunk 4,902.04 kB / 1,320.88 kB, identical to `main`'s; 43 JS chunks, 0 `modulepreload`, `index.html` names no hub chunk (§7). |
| `lint:gate` | Exit 0 on the merged head (Linux). |
| Full suite (Linux, CI-shaped) | Exit 0 on the merged head: `Test Files  1181 passed \| 8 skipped (1189)`, 25,632 rows passed, 89 skipped, **0 failed**, 245 s (`TZ=UTC`, 8 workers, under the suite lock, run alone). `main` alone: `1171 passed \| 8 skipped (1179)`. The nine files S7 adds hold 237 rows (§7). |
| Flag-on dry run | The smoke head (flag `true` + readout), full suite on Linux: 17 red rows in 7 files, every one by design — the 14 S3 and S4 recorded plus 3 that exist only because of the smoke readout (§13). |
| Fenced files, `api/` | None edited. `git diff origin/main..HEAD --name-only -- api` is empty at the PR head, and no file BUILD_RULES §1 fences is in the diff. The PR is 34 files: S7's 32 plus this report and its README row. |
| Stop rule | Fired once, for two existing hub rows whose pinned words S7's rulings move (R-S7-4, R-S7-7); the founder answered "Update both rows (Recommended)" before any commit. Two further edits are mechanical (§6). |
| Founder questions | Q-S7-1 … Q-S7-9 (§10); none blocks. |
| Next | The founder's review of the draft PR and the phone check on the smoke preview (§12, §13). S8 and the activation inherit §11. |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first: `origin/main` was `27514b1a` (the base). It moved to `7e15d5d5` (PR #995, the BaggerBomb broad release) before the final checks; the desktop app's `sync_with_base_branch` merged it in (`6f1a832e`) with no conflict, and the final checks ran on that merged tree, as CI will.
- Local branch `claude/advisor-opus-61abb6`, pushed by refspec as `claude/command-center-hub-s7`; the smoke branch `claude/command-center-hub-s7-smoke` by refspec likewise.
- Model setup as the prompt asked: Sonnet 5.5 at High effort, an Opus advisor consulted at four points only (the last two: before this report and before delivery); review agents do not consult the advisor.
- Commits since the base:

| Commit | What |
|---|---|
| `64f07c5d` | The build: `ShadowCanvas`, the pure canvas and bloom and status modules, the hub wiring, the guards' S7 blocks and their rows |
| `1113a75f` | The rows the first mutation pass asked for — **the commit lenses A, B, C and their refuters reviewed** |
| `a538cd1b` | Review round 1 (lenses A and C) and the mutation survivors |
| `3af6b2fa` | Review round 2 (lens B) and the still-flash rework's rows |
| `dbc543cc` | No 2D interface is "unavailable" without being asked (the jsdom-noise precheck) — **the commit lens T reviewed** |
| `dc9b1a1c` | The entry chunk gains no export from the status words (§7) |
| `d9f725ba` | The rows lens T asked for; the stale-flash defect it found, fixed |
| `f77a4277` | The slow-frame row counts its frames |
| `68e0b7aa` | The pause effect settles the owed flash alone (a redundant dependency removed) — **S7's code head** |
| `6f1a832e` | Merge of `origin/main` `7e15d5d5` — **the code head as pushed** |
| (the report commit) | This report and its README row |

Lenses A, B and C reviewed `1113a75f`; lens T reviewed `dbc543cc`. The commits after them — `dc9b1a1c` (the status words as local constants), `d9f725ba` (the rows and **one production change**, the flash debt), `f77a4277` and `68e0b7aa` (one effect dependency) — were **not** lens-reviewed; they are covered by the replay below, the full suites and the guards, and are small enough to read in full (`git diff dbc543cc 68e0b7aa -- src/components/CommandCenter/ShadowCanvas.jsx src/components/CommandCenter/hub/shadowStatus.js`).

## 2. What S7 built, and what it departs from

`ShadowCanvas` (`src/components/CommandCenter/ShadowCanvas.jsx`) is the second form of the one swappable Shadow: the design's canvas (`ff-shadow.jsx`, decoded from `docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html`, never committed) ported over the module S1 already pins (`hub/shadowGeometry.js`). Its drawing is `hub/shadowCanvas.js` (pure: a 2D context, a clock and a `random` come in as arguments), its response memo is `hub/shadowBloom.js`, and the status line's words are `hub/shadowStatus.js`. The kit that stands in for a canvas in jsdom is `__fixtures__/shadowCanvasKit.js`.

Two declared departures from the design's canvas, both from reading R-S7-1 to the letter (port from the geometry module, fall back to the still):

- **The eyes are drawn at ±0.165**, the geometry module's (and the still's) x, where the design's canvas draws ±0.17 (0.68 px at 340 px). One geometry, so the canvas and the still agree across a swap. The design-parity digest (§9) is the design's own op log with exactly this one patch.
- **The reduced form has no frozen signal dots.** The design's reduced-motion canvas path draws two; R-S7-1 falls back to `ShadowStill`, which ports the design's static asset (no signals).

One finding of the second kind is the response trigger: the design's `selectArea` never bumps its bloom (the design blooms on opening a sheet or a completed write, which this build forbids). S7 blooms on the wide site's area selection exactly as R-S7-3 says; Q-S7-1 records the phone's tabs.

## 3. Starting check (prompt §2)

**Branch.** The Code tab made the worktree `advisor-opus-61abb6` on local branch `claude/advisor-opus-61abb6`, cut at `main` `27514b1a` — clean tree, HEAD = `origin/main` (`git fetch origin` run first; recorded). Per the standing practice for app-suffixed worktree branches (PR #939), the work is pushed by refspec as `HEAD:refs/heads/claude/command-center-hub-s7`, and the smoke branch as `HEAD:refs/heads/claude/command-center-hub-s7-smoke`.

**Anchors** (re-read at `27514b1a`; every one VERIFIED, none had drifted past the prompt's own figures):

| Anchor | Where | State |
|---|---|---|
| `ShadowStill` props (`size`, `tier`, `status`, `selectedArea`, `reducedMotion`, `boxRef`) | `ShadowStill.jsx:34` | VERIFIED |
| `SH_TIERS`, `shStrands`, `shPoints`, `stillPaths`, `shadowTierFor` | `hub/shadowGeometry.js:31, 61, 89, 134, 187` | VERIFIED |
| The still's token reads (`teal`, `teal-2`, `white`) | `ShadowStill.jsx:38-40` | VERIFIED |
| `statusWords`, `StatusLine`, `ShadowStage`, `PhoneStage` | `ShadowStage.jsx:33, 51, 117, 183` | VERIFIED |
| `hubCopy.shadow` block | `hub/hubCopy.js:82-99` | VERIFIED |
| `reducedMotion` from `useReducedMotion`; `status: display.processing ? 'processing' : 'still'` | `CommandCenterHub.jsx:158, 174` | VERIFIED |
| `processing: displayState === 'submitting'` | `hub/deployDisplay.js:256` (18 display states at :36-40) | VERIFIED |
| The area selection handler | `CommandCenterHub.jsx` `selectArea` (WideHub); the phone's `selectTab` | VERIFIED |
| Guards: `tokens.guard.test.js`, `motion.guard.test.js`, `commandCenterHub.activity.guard.test.js` (manifests, hub/ only), `hubCopy.guard.test.js`; plus the mount guard's per-file allowances | — | VERIFIED; the activity guard reads `hub/` only, so S7 extended its reader |
| The design's canvas `Shadow`, `shPickTier`, the frame-cost self-downgrade, the random ambient flares, the `eventKey` center bloom | decoded `ff-shadow.jsx` (scratch, never committed) | VERIFIED. `eventKey` is bumped by the design's `respond()` (opening a sheet or a game) and `run()` (a completed write) and by the simulated deploy — **never by `selectArea`**; see Q-S7-1 |
| `playwright-core` and a Chromium-family browser | `playwright-core` in the checkout's `node_modules`; Microsoft Edge 156 | VERIFIED |

**STOP rule.** Evaluated against the five conditions; one fired and was put to the founder in-session:
- today's shells would behave differently: **no** (the hub flag stays false; the shells and App are untouched);
- a colour or transition no token gives: **no** (the three tokens the still reads; no Motion transition);
- a fenced file or `api/` edited: **no** (`git diff 27514b1a..68e0b7aa --name-only -- api` was empty before `main` moved, and `git diff origin/main..HEAD --name-only -- api` is empty at the PR head; no fenced file is in the diff);
- the sky changed: **no**;
- **a pre-existing test of behavior must be edited: yes, two rows**, because R-S7-4 and R-S7-7 move the exact words they pin. The advisor flagged it and the founder was asked, in-session, before any commit: **"Update both rows (Recommended)" was the answer**, so each row keeps its intent. `CommandCenterHub.jsdom.test.jsx` "the status line is the one live region and says the idle words" now uses a fixture whose live read is known (a loading read says "Idle" by R-S7-7 rule 6); "a submitting deployment (fixture) turns the status line and Shadow's label to processing" now gives jsdom the canvas it lacks (without one Shadow is the still and reads "still" by R-S7-4). Two further edits are mechanical and forced by R-S7-6 (the constant lives in `hubFlags.js`): the `vi.mock('./hub/hubFlags')` factories in `CommandCenterHub.s5.jsdom.test.jsx` and `CommandCenterHub.realSheets.jsdom.test.jsx` became partial mocks so the new export survives. Registration lists and guard manifests moved in their own `S7` blocks.

## 4. The rulings, as applied

| Ruling | As applied | Where |
|---|---|---|
| **R-S7-1** One swappable Shadow, now moving | `ShadowCanvas` is the canvas Shadow in the same fixed `size × size` box, with `ShadowStill`'s props (`size`, `tier`, `status`, `selectedArea`, `reducedMotion`, `boxRef`) plus five S7 props (`areaEvent`, `createdAttemptId`, `paused`, `stillOnly` and the injectable `random`). It draws the still — by returning `ShadowStill` — for reduced motion (the hub's one `useReducedMotion`), for a `getContext('2d')` that returns nothing or throws (or a token that does not resolve), and for the phone constant. The drawing is `hub/shadowCanvas.js`, over `hub/shadowGeometry.js` (S1's 252-strand digest is unchanged; `SH_CANVAS` is a separate table). Nothing outside reads a filament point. | `ShadowCanvas.jsx`, `hub/shadowCanvas.js`, `hub/shadowGeometry.js` (`SH_CANVAS`) |
| **R-S7-2** Tiers sparse and fixed | The hub passes `shadowTierFor(composition)` (phone low, else mid) and nothing changes it. No `shPickTier`, no frame-cost self-downgrade, no detector. A test pins that no composition selects `high`. | `CommandCenterHub.jsx`, `shadowCanvas.test.js` |
| **R-S7-3** What moves, and when | Ambient: the design's signals and strand flares, drawn from the injected `random`. Processing: only while `deployDisplay(...).processing` is true (`useShared` → `status`), a hub-started deployment submitting; verifying, finishing and everything else read ambient. The response bloom (`hub/shadowBloom.js`) fires on (a) a new area selection on the wide site — `selectArea` counts only a selection that changed the area — and (b) an attempt's created terminal (display word `confirmed`, recovered included), once per attempt id; never on an existing, refused or uncertain terminal, a read, a refresh, a sheet opening or a resize. A trigger already present at mount is the past: no bloom for it, which also keeps a site-flip remount over an unacknowledged created terminal from blooming twice. Under the still, the bloom is `ShadowStill`'s `flash` (the design's ×1.25 lift) for 420 ms, its timeout cleared on unmount. | `CommandCenterHub.jsx` (`useShared`, `selectArea`, `ConnectedHub`), `hub/shadowBloom.js`, `ShadowCanvas.jsx`, `ShadowStill.jsx` |
| **R-S7-4** Labels | `ShadowCanvas` labels `ambient` or `processing` with the selected area; every still route reads `still` (the box passes `status` = `still` to `ShadowStill`), including a submitting deployment under reduced motion. The label is on the canvas / svg, never a live region; the status line stays the one. | `ShadowCanvas.jsx` |
| **R-S7-5** Pause, clean up | The loop stops when the document is hidden, the box is offscreen (IntersectionObserver) and while the root deploy ceremony covers the page (`coverOpen` = the deploy provider's own `snapshot.overlayOpen`; no new signal); it resumes on return. A size change, a tier change and an unmount each cancel the frame, disconnect the observer and remove the visibility listener; the flash timeout clears on its own cleanup. Every call is pinned by `commandCenterHub.activity.guard.test.js`, call by call. Colours are the three tokens the still reads (`readToken`); no motion transition is used. | `ShadowCanvas.jsx`, the activity, mount, token and motion guards |
| **R-S7-6** The phone fallback is one constant | `PHONE_SHADOW = 'canvas'` in `hub/hubFlags.js`; `PhoneHub` passes `stillOnly={PHONE_SHADOW === 'still'}`. Flipping it to `'still'` is the whole fix. Pinned by `hubFlags.test.js` and by a hub row that flips it. | `hub/hubFlags.js`, `CommandCenterHub.jsx` |
| **R-S7-7** The status line tells the truth | `hub/shadowStatus.js` is the seven rules in order; rules 3 and 4 take the string `deployDisplay` built for the Deploy card, so the line cannot disagree with the card. The two new phrases and the unknown-read "Idle" are in `hubCopy.js` under the copy guard. | `hub/shadowStatus.js`, `hub/hubCopy.js`, `ShadowStage.jsx`, `CommandCenterHub.jsx` (`statusWordsOf`) |
| **R-S7-8** Layout and device record | §8 below. | headless Edge harness (outside the repo) |
| **R-S7-9** Lanes | S7 touched only the files it owns, plus additions to the shared manifests in their own `S7` blocks at the end of each list. `main` had not moved at the build head; it moved once afterwards (#995) and is merged (§1). The canvas is in the hub chunk; nothing the provider imports reaches it (§7). | — |

## 5. Files, by `file:line` (at the merged head `6f1a832e`; S7's own diff against `main` is 32 files, +3,854 −43)

**Product code**

| What | Where |
|---|---|
| `ShadowCanvas` — props `size, tier, status, selectedArea, reducedMotion, boxRef` (the still's) plus `areaEvent, createdAttemptId, paused, stillOnly, random`; routes to the still when `reducedMotion \|\| stillOnly \|\| failed` | `src/components/CommandCenter/ShadowCanvas.jsx:52`, `:70` |
| The response memo, stepped while rendering (a trigger present at mount is the past) | `ShadowCanvas.jsx:73-75`; `hub/shadowBloom.js:19` (`seedBloom`), `:27` (`stepBloom`, `Object.is` on the counter) |
| The canvas run: no-interface check, `getContext` in try/catch, three tokens, backing store resized **then** scaled, `disposed` flag, frame loop with the 0.05 s cap, one `IntersectionObserver`, one `visibilitychange` listener, full cleanup | `ShadowCanvas.jsx:85-169` (`:92`, `:99`, `:106-108`, `:118`, `:152`, `:159`, `:162-168`) |
| The still's flash owed behind the cover, paid at the release by the still and dropped by the canvas (review T-13) | `ShadowCanvas.jsx:175-193` |
| The response: a bloom on Shadow's clock, or the still's 420 ms flash with its one timer | `ShadowCanvas.jsx:194-212`; `FLASH_MS` `:47` |
| The drawing (pure): `shadowColors`, `createShadowRig`, `createFx`, `fitFx`, `stepFx`, `triggerBloom`, `drawShadow`; `BLOOM_SECONDS`, `RING_SECONDS` | `hub/shadowCanvas.js:40, 53, 68, 73, 92, 109, 139`; `:33-34` |
| The canvas-only half of the design's tiers (low chunks 2 / dpr 1.5, mid 3 / 2, high 4 / 2 never selected), apart from `SH_TIERS` so S1's digest is untouched | `hub/shadowGeometry.js:43` (`SH_CANVAS`) |
| The status line's seven rules; the local vocabulary constants; `liveReadKnown` | `hub/shadowStatus.js:77` (`shadowStatusWords`), `:44-48`, `:62` |
| The new words (`statusLiveOne`, `statusLiveMany`, `statusIdleUnknown`) | `hub/hubCopy.js:102-104` |
| The phone constant | `hub/hubFlags.js:49` (`PHONE_SHADOW = 'canvas'`) |
| The hub wiring: `status` from `display.processing`, `createdAttemptId` (a `confirmed` display with a string attempt id), `liveCount` (opened games) / `waitingCount` (deployed, waiting for the open) / `liveKnown`; `statusWordsOf`; the wide hub's `areaEvent` (`selectArea` counts only a change); the phone's `stillOnly` and `paused`; `coverOpen` from the provider's own `overlayOpen` | `CommandCenterHub.jsx:189-208`, `:341-343`, `:409`, `:418`, `:436-438`, `:584` |
| The stage hands Shadow its props; `StatusLine` takes the words (the old `statusWords` is gone) | `ShadowStage.jsx:46`, `:157`, `:190` |
| `ShadowStill` gains `flash` (the design's ×1.25 lift, capped at 1) | `ShadowStill.jsx:37`, `:46`, `:54` |

**Guards and registrations** (each in its own `S7` block at the end of its list)

| What | Where |
|---|---|
| Tokens: five files token-only (`ShadowCanvas.jsx`, `shadowBloom.js`, `shadowCanvas.js`, `shadowStatus.js`, the kit) | `src/theme/tokens.guard.test.js:224`; `tokenGuardBaseline.json:175-179` |
| Motion: the same five, no raw `transition`; the baseline's count 0 and its authority | `src/theme/motion.guard.test.js:227`; `motionGuardBaseline.json:504-518` |
| Mount guard: `ShadowCanvas.jsx` is allowed a frame request, an observer, a listener, a timeout and passive effects and nothing else; the pure modules none; negatives that each still red | `commandCenterHub.mount.guard.test.js:680-685`, `:919-920` |
| Activity guard: `ShadowCanvas.jsx` is read (a file beside the shells); an observer's construction and its two calls are counted; the manifest lists every call (`requestAnimationFrame` ×2, `cancelAnimationFrame`, `setTimeout`, `clearTimeout`, `new IntersectionObserver`, `observe`, `disconnect`, the `visibilitychange` pair, `useEffect` ×4); the pure modules are empty | `commandCenterHub.activity.guard.test.js:26`, `:37`, `:55`, `:138-162` |
| Copy guard: the status words exactly, none a banned claim, "Locked in" written once in effect | `hubCopy.guard.test.js:383-409` |

**Tests S7 adds** (237 rows in nine files)

| File | Rows | What it pins |
|---|---|---|
| `ShadowCanvas.jsdom.test.jsx` | 65 | routing, what is drawn, lifetime, cleanup, the response and the still's flash |
| `ShadowCanvas.contract.jsdom.test.jsx` | 16 | which token plays which role, resize-before-transform, the observer's target and options, the box, R-S7-2 (behaviour and source), the default `random`, the owed-flash debt |
| `ShadowCanvas.handoff.jsdom.test.jsx` | 11 | the arguments the component hands `stepFx`, `drawShadow` and `triggerBloom`, call by call |
| `CommandCenterHub.s7.jsdom.test.jsx` | 73 | which Shadow draws where, the labels, the area response at 1216 / 770 / 614 px, the status line, the connected hub (processing, the created terminal once per attempt, the ceremony pause) at every composition |
| `hub/shadowCanvas.test.js` | 32 | the pure drawing and effects |
| `hub/shadowCanvas.parity.test.js` | 7 | the design-parity digest (§9) |
| `hub/shadowStatus.test.js` | 23 | the seven rules and the local vocabulary |
| `hub/shadowBloom.test.js` | 9 | the response memo |
| `ShadowStill.cap.jsdom.test.jsx` | 1 | the flash's cap, with strands bright enough to need it |
| `__fixtures__/shadowCanvasKit.js` | — | the strict stand-in for a 2D context, frame loop, observer and visibility |

## 6. Pre-existing tests edited, and why (the stop-rule record)

The STOP rule (the prompt's fifth condition) was evaluated against today's behaviour and fired for two rows only, because R-S7-4 and R-S7-7 move the exact words they pin. The advisor flagged it, the founder was asked in-session before any commit, and the answer was **"Update both rows (Recommended)"**, so each row keeps its intent:

- `CommandCenterHub.jsdom.test.jsx`, "the status line is the one live region and says the idle words": it now uses a fixture whose live read is known (a loading read says "Idle" by R-S7-7 rule 6).
- `CommandCenterHub.jsdom.test.jsx`, "a submitting deployment (fixture) turns the status line and Shadow's label to processing": it now gives jsdom the canvas it lacks (without one, Shadow is the still and reads "still" by R-S7-4).

Two further edits are mechanical, forced by R-S7-6 (the constant lives in `hubFlags.js`): the `vi.mock('./hub/hubFlags')` factories in `CommandCenterHub.s5.jsdom.test.jsx` and `CommandCenterHub.realSheets.jsdom.test.jsx` became partial mocks so the new export survives. Rows were added to `ShadowStill.jsdom.test.jsx` (the flash) and `hub/hubFlags.test.js` (the constant). No row that pins live (flag-off) behaviour was weakened.

## 7. Checks and bundle sizes

All on the merged head `6f1a832e` unless named; Linux is WSL Ubuntu, Node 20.20.2, CI-shaped (`TZ=UTC`), a worktree of the CI checkout.

| Check | Result |
|---|---|
| `git fetch origin`; merge | `origin/main` `7e15d5d5` merged by the desktop app (`6f1a832e`), no conflict; S7's diff against it is 32 files, nothing under `api/` |
| `npx vite build` | Exit 0 (18 s). Hub chunk **134.19 kB / 41.76 kB gzip**; `main` (`7e15d5d5`): 124.91 kB / 38.16 kB. Entry chunk **4,902.04 kB / 1,320.88 kB** on both. 43 JS chunks, 0 `modulepreload`, `index.html` names no hub chunk |
| The entry chunk | Byte-identical to `main`'s after every hashed file token is replaced by a fixed one (`normalized delta 0`, `identical: true`; 64 tokens on both sides) |
| `npm run lint:gate` | Exit 0 |
| Full suite, `--maxWorkers=8`, `flock /tmp/pd-suite.lock`, run alone | Exit 0, **`Test Files  1181 passed \| 8 skipped (1189)`**, 25,721 rows: 25,632 passed, 89 skipped, **0 failed**, 245 s. Before the merge (`68e0b7aa`): `1180 passed \| 8 skipped (1188)`, exit 0, 241 s. `main` (`27514b1a`) alone: `1171 passed \| 8 skipped (1179)`, exit 0, 233 s — S7 adds nine files (the 1180) and #995 one |
| Flakes | None: no red row in any of the three full runs; each ran alone under the lock. The local runs (below) ran beside a suite only when the suite was the smoke dry run, which is not a check of record |
| Local (Windows) — hub, theme, config and contexts, 117 files | 116 pass; one red, `src/config/shadowCpuQuoteIntegrityFlags.test.js` "OFF-1 … registers it as dark by design", which is red on Windows at an unedited `main` (a platform-only row; the Linux suite is green) |

**The entry-chunk rule (R-S7-9), and one thing found.** `DeployAttemptProvider` sits at App's root and imports hub modules (`attemptVocabulary`, `hubDate`, `overlayStack`, the selectors), so every extra binding the hub chunk imports from one of them becomes an export of the *entry* chunk. The first build of S7 imported two names from `attemptVocabulary` and the entry chunk grew by **18 bytes**; `hub/shadowStatus.js` now spells those two vocabularies as local constants (`HOLD`, `ATTEMPT_WORDS`), `shadowStatus.test.js` pins each equal to the vocabulary's, and the normalised entry diff above is the proof (`dc9b1a1c`).

**jsdom's "Not implemented: HTMLCanvasElement" noise.** `dbc543cc`'s message says the noise fell; the honest figures are these. The full suite prints 23,279 such lines on `main`, 23,285 at S7's code head and 23,282 on the merged head: the same noise before and after (the totals move by a handful from run to run, and which test file's stderr block the lines are attributed to changes with the worker interleaving: `CommandCenterHub.s4.jsdom.test.jsx` is charged 215 to 322 of them in the full runs, yet run alone it prints none, on `main` or here). S7 neither adds nor removes any. Its own canvas asks for a context only where an engine has a 2D interface at all (`ShadowCanvas.jsx:92`), none of S7's nine files appears in the attribution, and `ShadowCanvas`'s own jsdom rows use the kit. The origin of the 23,000 lines is not attributed here.

## 8. Layout, device and performance record (R-S7-8)

Headless Edge 156 through `playwright-core`, a throwaway harness outside the repository that serves the worktree's real hub, starfield and bottom nav with App's data stubbed (the firebase config and the user context), as the S1 and S5 harnesses did. Layout, behaviour and the status-word sweeps were run on the merged head `6f1a832e` (the figures are the machine's, measured, not recomputed); the performance criterion rows on S7's code head `68e0b7aa`, which differs from the merged head only by #995's `api/` and `src/config` changes; the attribution rows on the earlier head `1113a75f` as labelled. A proxy, not the phone: §12 is the founder's.

#### Layout — the hub over the maximum-rows fixture (the `long` fixture: four completed games, ten activity rows, a review ready), per shell and scenario

| Shell | Scenario | Composition (hub px) | Shadow | The hold (top–bottom of the viewport) | Strip (height / gap above nav) | Rows shown (games / reviews / activity) | Content clear of the strip at full scroll | Horizontal overflow |
|---|---|---|---|---|---|---|---|---|
| 360x640 | no live game | phone (360) | 196 canvas | strip (disabled) 522–566 of 640 ✓ inside | 63 / 0 | 1 / 0 / 3 | 24 px above the strip | none |
| 360x640 | ranked-only live | phone (360) | 196 canvas | strip (disabled) 522–566 of 640 ✓ inside | 63 / 0 | 2 / 0 / 3 | 24 px above the strip | none |
| 360x640 | both live | phone (360) | 196 canvas | none (a block hides it) | 63 / 0 | 3 / 0 / 3 | 24 px above the strip | none |
| 390x844 | no live game | phone (390) | 200 canvas | strip (disabled) 726–770 of 844 ✓ inside | 63 / 0 | 1 / 0 / 3 | 24 px above the strip | none |
| 390x844 | ranked-only live | phone (390) | 200 canvas | strip (disabled) 726–770 of 844 ✓ inside | 63 / 0 | 2 / 0 / 3 | 24 px above the strip | none |
| 390x844 | both live | phone (390) | 200 canvas | none (a block hides it) | 63 / 0 | 3 / 0 / 3 | 24 px above the strip | none |
| 834x1000 sb64 | no live game | tablet (770) | 260 canvas | card (disabled) 744–792 of 1000 ✓ inside | — | 2 / 0 / 5 | — | none |
| 834x1000 sb64 | ranked-only live | tablet (770) | 260 canvas | card (disabled) 766–814 of 1000 ✓ inside | — | 3 / 0 / 5 | — | none |
| 834x1000 sb64 | both live | tablet (770) | 260 canvas | card (disabled) 766–814 of 1000 ✓ inside | — | 4 / 0 / 5 | — | none |
| 834x1000 sb220 | no live game | stacked (614) | 260 canvas | card (disabled) 744–792 of 1000 ✓ inside | — | 2 / 0 / 5 | — | none |
| 834x1000 sb220 | ranked-only live | stacked (614) | 260 canvas | card (disabled) 766–814 of 1000 ✓ inside | — | 3 / 0 / 5 | — | none |
| 834x1000 sb220 | both live | stacked (614) | 260 canvas | card (disabled) 766–814 of 1000 ✓ inside | — | 4 / 0 / 5 | — | none |
| 1280x820 sb64 | no live game | desktop (1216) | 340 canvas | card (disabled) 604–652 of 820 ✓ inside | — | 2 / 0 / 5 | — | none |
| 1280x820 sb64 | ranked-only live | desktop (1216) | 340 canvas | card (disabled) 704–752 of 820 ✓ inside | — | 3 / 0 / 5 | — | none |
| 1280x820 sb64 | both live | desktop (1216) | 340 canvas | card (disabled) 786–834 of 820 ✗ below | — | 4 / 0 / 5 | — | none |
| 1280x820 sb220 | no live game | tablet (1060) | 260 canvas | card (disabled) 744–792 of 820 ✓ inside | — | 2 / 0 / 5 | — | none |
| 1280x820 sb220 | ranked-only live | tablet (1060) | 260 canvas | card (disabled) 766–814 of 820 ✓ inside | — | 3 / 0 / 5 | — | none |
| 1280x820 sb220 | both live | tablet (1060) | 260 canvas | card (disabled) 766–814 of 820 ✓ inside | — | 4 / 0 / 5 | — | none |

Wide-site content clearance at full scroll (the last section's bottom against the page end):

| Shell | Scenario | Page height | Last section bottom | Clear below |
|---|---|---|---|---|
| 834x1000 sb64 | no live game | 1797 | 972 of 1000 | 28 px |
| 834x1000 sb64 | ranked-only live | 1920 | 972 of 1000 | 28 px |
| 834x1000 sb64 | both live | 2083 | 972 of 1000 | 28 px |
| 834x1000 sb220 | no live game | 1977 | 972 of 1000 | 28 px |
| 834x1000 sb220 | ranked-only live | 2081 | 972 of 1000 | 28 px |
| 834x1000 sb220 | both live | 2211 | 972 of 1000 | 28 px |
| 1280x820 sb64 | no live game | 1343 | 790 of 820 | 30 px |
| 1280x820 sb64 | ranked-only live | 1443 | 790 of 820 | 30 px |
| 1280x820 sb64 | both live | 1571 | 790 of 820 | 30 px |
| 1280x820 sb220 | no live game | 1797 | 792 of 820 | 28 px |
| 1280x820 sb220 | ranked-only live | 1920 | 792 of 820 | 28 px |
| 1280x820 sb220 | both live | 2083 | 792 of 820 | 28 px |

#### The status line at 360 and 390 (phone), 834 and 1280 (wide): every word

| Words | 360 phone | 390 phone | 834 tablet | 1280 desktop |
|---|---|---|---|---|
| Submitting your deployment | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 172 px | ✓ 1 line, 172 px |
| Verifying deployment… | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 139 px | ✓ 1 line, 139 px |
| Finishing deployment | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 132 px | ✓ 1 line, 132 px |
| Deployed | ✓ 1 line, 50 px | ✓ 1 line, 50 px | ✓ 1 line, 53 px | ✓ 1 line, 53 px |
| Already running | ✓ 1 line, 94 px | ✓ 1 line, 94 px | ✓ 1 line, 99 px | ✓ 1 line, 99 px |
| Deployment refused | ✓ 2 lines, 95 px | ✓ 1 line, 113 px | ✓ 1 line, 119 px | ✓ 1 line, 119 px |
| Couldn’t confirm the deploy | ✓ 3 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 179 px | ✓ 1 line, 179 px |
| Live game in progress | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 139 px | ✓ 1 line, 139 px |
| 2 live games in progress | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 159 px | ✓ 1 line, 159 px |
| 12 live games in progress | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 165 px | ✓ 1 line, 165 px |
| Deployed · waiting for the open | ✓ 3 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 205 px | ✓ 1 line, 205 px |
| Idle · nothing running | ✓ 2 lines, 95 px | ✓ 2 lines, 121 px | ✓ 1 line, 146 px | ✓ 1 line, 146 px |

All 48 cases: the text equals the ruling's words, nothing clipped (no ellipsis, scrollWidth ≤ clientWidth), inside the stage and the viewport, exactly one live region. At 360 the phone's column is 95 px wide, so the long words wrap to two or three lines; none is cut.

#### Tab order (Q-S2A-1): where keyboard focus goes against where it sits

- **stacked 834x1000 sb220 (none)** — 6 stops: stage → panel → deploy → games → activity → brief; backward jumps: 1
- **stacked 834x1000 sb220 (ranked)** — 6 stops: stage → panel → deploy → games → activity → brief; backward jumps: 1
- **tablet 834x1000 sb64 (none)** — 6 stops: stage → panel → deploy → games → activity → brief; backward jumps: 0
- **desktop 1280x820 sb64 (none)** — 6 stops: stage → panel → games → deploy → activity → brief; backward jumps: 1
- **phone 390x844 (none)** — 11 stops: tabs → panel → panel → panel → panel → strip → nav → nav → nav → nav → nav; backward jumps: 1

#### Reduced motion, canvas unavailable, hidden and offscreen (headless Edge, real canvas)

| Shell | Run | Result |
|---|---|---|
| 390x844 | baseline: ambient motion | kind: {"canvas":true,"svg":false,"label":"Shadow — ambient","reducedAttr":"false"}; shadowDrawsPerSecond: 60; no page error |
| 390x844 | reduced motion | kind: {"canvas":false,"svg":true,"label":"Shadow — still","reducedAttr":"true"}; rafCallsIn2s: 0; shadowDraws: 0; no page error |
| 390x844 | canvas unavailable (getContext null) | kind: {"canvas":false,"svg":true,"label":"Shadow — still","reducedAttr":"false"}; shadowDraws: 0; no page error |
| 390x844 | canvas unavailable (getContext throw) | kind: {"canvas":false,"svg":true,"label":"Shadow — still","reducedAttr":"false"}; shadowDraws: 0; no page error |
| 390x844 | hidden document | drawsPerSecondRunning: 61; drawsIn1500msHidden: 0; drawsPerSecondAfterReturn: 61; no page error |
| 390x844 | offscreen (scrolled away) | drawsPerSecondRunning: 61; shadowBoxWhileAway: {"top":-376,"bottom":-176}; drawsIn1500msOffscreen: 0; drawsPerSecondAfterReturn: 60; no page error |
| 1280x820 sb64 | baseline: ambient motion | kind: {"canvas":true,"svg":false,"label":"Shadow — ambient; Equipped Archetype selected","reducedAttr":"false"}; shadowDrawsPerSecond: 60; no page error |
| 1280x820 sb64 | reduced motion | kind: {"canvas":false,"svg":true,"label":"Shadow — still; Equipped Archetype selected","reducedAttr":"true"}; rafCallsIn2s: 0; shadowDraws: 0; no page error |
| 1280x820 sb64 | canvas unavailable (getContext null) | kind: {"canvas":false,"svg":true,"label":"Shadow — still; Equipped Archetype selected","reducedAttr":"false"}; shadowDraws: 0; no page error |
| 1280x820 sb64 | canvas unavailable (getContext throw) | kind: {"canvas":false,"svg":true,"label":"Shadow — still; Equipped Archetype selected","reducedAttr":"false"}; shadowDraws: 0; no page error |
| 1280x820 sb64 | hidden document | drawsPerSecondRunning: 60; drawsIn1500msHidden: 0; drawsPerSecondAfterReturn: 61; no page error |
| 1280x820 sb64 | offscreen (scrolled away) | drawsPerSecondRunning: 60; shadowBoxWhileAway: {"top":-385,"bottom":-45}; drawsIn1500msOffscreen: 0; drawsPerSecondAfterReturn: 61; no page error |

#### The performance proxy (R-S7-8): 4× CPU throttle, headless Edge, DPR 3, the real starfield, the `ranked` scenario (a live game: the sky at its fastest)

| Run | Seconds | fps | Late frames (> 25 ms) | Scripting ms / frame | Main-thread task ms / frame | Frame delta median / p95 / p99 / worst (ms) | CPU load at start / end (%) |
|---|---|---|---|---|---|---|---|
| **390×844, sky + Shadow (the criterion) — S7 code head `68e0b7aa`, quiet machine** | 60 | 60 | 0% | 2.62 | 4.64 | 16.7 / 16.8 / 16.9 / 17.4 | 0 / 1 |
| **360×640, sky + Shadow (the criterion) — S7 code head `68e0b7aa`, quiet machine** | 60 | 60 | 0% | 2.6 | 4.59 | 16.7 / 16.8 / 16.9 / 17.5 | 3 / 4 |
| 390×844, sky + Shadow, no throttle (control) — `68e0b7aa` | 30 | 59.9 | 0.06% | 0.85 | 1.42 | 16.7 / 16.9 / 17 / 36.4 | 7 / 0 |
| 390×844, sky + Shadow — earlier head `1113a75f` (machine not quiet) | 60 | 60 | 0.03% | 2.93 | 5.3 | 16.7 / 16.8 / 16.9 / 50.1 | 27 / 2 |
| 360×640, sky + Shadow — earlier head `1113a75f` | 60 | 60 | 0% | 3.15 | 5.62 | 16.7 / 16.8 / 16.9 / 17.6 | 3 / 31 |
| 390×844, sky + Shadow, no throttle — earlier head `1113a75f` | 60 | 60 | 0% | 0.71 | 1.28 | 16.7 / 16.9 / 17 / 17.4 | 2 / 18 |
| 390×844, Shadow only (sky off) — earlier head | 30 | 60 | 0% | 2.85 | 4.91 | 16.7 / 16.8 / 16.9 / 17.4 | 37 / 38 |
| 360×640, Shadow only (sky off) — earlier head | 30 | 60 | 0% | 2.76 | 4.79 | 16.7 / 16.8 / 16.9 / 17.3 | 29 / 2 |
| 390×844, sky only (Shadow = still) — earlier head | 30 | 60 | 0% | 1.45 | 4.02 | 16.7 / 16.8 / 16.9 / 17.4 | 10 / 15 |
| 360×640, sky only (Shadow = still) — earlier head | 30 | 60 | 0% | 1.33 | 4.14 | 16.7 / 16.8 / 16.9 / 17 | 48 / 8 |
| 390×844, neither (the harness's own floor) — earlier head | 30 | 60 | 0% | 0.27 | 1.66 | 16.7 / 16.9 / 16.9 / 17.6 | 60 / 19 |

Targets (spec §10): 60 fps, scripting ≤ 6 ms a frame, dropped frames ≤ 2%.

**Reading the record.** Every status word, at every width, fits: none is clipped (no ellipsis, `scrollWidth ≤ clientWidth`), exactly one live region exists, the words are the ruling's. At 360 the phone's column is 95 px wide, so the long words wrap to two or three lines and none is cut. The hold stays inside the first viewport everywhere except one cell — the disabled hold on the desktop composition at 1280 × 820 with both games live (786–834 of 820), where the page is taller than the window by design and scrolls; the stacked and tablet compositions are inside, and so is the phone's strip wherever it is shown (with both games live a block hides the hold, by design). The sweeps on the merged head repeat the earlier ones cell for cell; only the real-canvas draw rates move by one a second (60 or 61). No horizontal overflow anywhere. The stacked composition's focus order has one backward jump (Q-S7-4). The performance proxy meets all three targets at both phone sizes with margin: 60 fps, no late frame, 2.6 ms of scripting a frame against 6.


## 9. The §2 review record

BUILD_RULES §2 makes review mandatory at ten files or 1,500 lines; S7 is 32 files and 3,854 added lines. Four lenses, each a separate Sonnet agent working from an isolated `git archive` snapshot (never the working tree), all on Sonnet 5.5, none of them consulting the advisor; a refuter per lens (A, B, C) on its own snapshot to try to knock each finding down; the test-integrity lens (T) last and mutating, so it saw the tests as they ended. Findings are ranked by the lens and answered below; "CONFIRMED / PARTLY / REFUTED" is the refuter's word.

| Lens | Question | Reviewed | Findings |
|---|---|---|---|
| A — motion honesty | does Shadow move only when it should, and say only what is true | `1113a75f` | 8: 3 CONFIRMED, 4 PARTLY, 1 REFUTED |
| B — lifetime and cleanup | does every frame, observer, listener and timer end | `1113a75f` | 9: 6 CONFIRMED, 3 PARTLY |
| C — status-line truth | does the line ever claim what the Deploy card or the Games row does not | `1113a75f` | 7: 6 CONFIRMED, 1 PARTLY (one MAJOR) |
| T — test integrity (mutating) | which defects survive the tests, and which rows cannot fail | `dbc543cc` | 15: 6 MAJOR, 7 MINOR, 2 NIT (a mutating lens, no refuter: each finding is a planted defect that survived) |

Dispositions: **26 fixed** (two of them in part: B-7 and C-3; T-10 is fixed for the strand cap and equivalent for the core stop), **10 accepted or declared** with the reason, 1 refuted, 1 carried as founder question Q-S7-9, 1 not S7's.

### Lens A — motion honesty

| ID | Finding | Verdict (refuter) | Disposition | Evidence / reason |
|---|---|---|---|---|
| A-1 | The processing look outlives `processing`: up to five fast signals spawned during processing keep traveling ~1.6–3.2 s after the status returns to ambient | PARTLY (NIT) | **Accepted, recorded** | Lift, pulse, the 1.6× clock and the spawn cap all end at once; only signals already in flight finish their run, exactly as the design's loop does. R-S7-3's "only while" gates the state, not signals in flight. |
| A-2 | The row titled "a sheet opening, a refresh and a resize" performs no refresh | CONFIRMED (MINOR) | **Fixed** | Retitled; a connected row re-renders the hub with fresh poll objects four times over a created terminal and asserts one bloom. |
| A-3 | The still routes spend their 420 ms flash behind the ceremony while the canvas routes hold the bloom, so a reduced-motion user never sees the created-terminal response on the ceremony path | CONFIRMED (MINOR) | **Fixed** | The flash is owed while `paused` and paid on release (one flash however many arrived, none after). Rows at the component and hub level, and Q-S7-6 is closed by it. |
| A-4 | The canvas draws the eyes at ±0.165 (the SVG's value), the design's canvas ±0.17 | PARTLY (NIT) | **Accepted, declared** | R-S7-1 says port from `shadowGeometry.js`, no second geometry; ±0.165 also keeps the canvas and the still on the same eyes across a swap. 0.68 px at 340 px. Declared in §2. |
| A-5 | The reduced form lacks the design's two frozen signal dots | PARTLY (NIT) | **Accepted, declared** | R-S7-1 falls back to `ShadowStill`, which ports the design's static asset (no signals); only the design's *canvas* reduced path draws them. |
| A-6 | `useReducedMotion()` is read once, so turning Reduce Motion on mid-session shows the canvas until the hub remounts | CONFIRMED (MINOR) | **Recorded; founder question Q-S7-9** | framer-motion 12.23.24 keeps `useState(prefersReducedMotion.current)`. R-S7-1 mandates the hub's one source; every hub surface (sheets, panels, Shadow) reads it the same way. |
| A-7 | The image label word "processing" reads as Shadow computing | REFUTED | None | The design's own label, named by R-S7-4, on the image only; the line that is read out names the real request. |
| A-8 | "your research partner" implies agency | PARTLY (NIT) | **Not S7** | The design's own stage copy, pinned since S1. |

### Lens B — lifetime and cleanup

| ID | Finding | Verdict (refuter) | Disposition | Evidence / reason |
|---|---|---|---|---|
| B-1 | A response on the canvas inside a still flash's window cleared the flash timer and left the still lit for good | CONFIRMED (NIT) | **Fixed** (by the A-3 rework) | The flash is a counter with its own timer effect, independent of the response effect; a row runs the exact sequence and ends with no flash and no timer. |
| B-2 | The disposed run has no guard: an observer entry delivered after `disconnect()` revives its loop | PARTLY (NIT) | **Fixed** | No engine tested delivers it (Chromium 0 of 80), but the spec leaves queued entries, so a `disposed` flag closes `start()` and the observer callback. The kit gained `intersectStale`; a row delivers to a disconnected observer after a size change and after unmount. |
| B-3 | The manifest and the mount allowances do not pin where an activity sits (a listener moved into `start()` passes both guards) | CONFIRMED (NIT) | **Accepted, recorded** | The behavioural row "paused … releasing it restarts" (`listeners.added` is 1) catches it. The activity guard is an inventory of calls (S3's design), not of placement. |
| B-4 | The inventory counts call syntax, not capability (aliases, computed members, `setImmediate`, `scheduler.postTask` …) pass | CONFIRMED (NIT) | **Accepted, recorded** | The same limit as S3's guard for every hub file; the mount guard's file-level patterns and the behavioural rows are the other half. Not widened in S7. |
| B-5 | `syncRef.current = null` in the cleanup is unpinned | CONFIRMED (MINOR) | **Fixed** | A row (mount paused, then reduced motion, then unpaused: no frame queued) kills the mutant. |
| B-6 | `last = 0` in `start()` is unpinned | CONFIRMED (NIT) | **Fixed** | A row: the first frame after a restart advances the clock by one frame, not the gap. |
| B-7 | Three defensive lines are unexercised | PARTLY (NIT) | **Fixed for one, accepted for two** | `entries[entries.length - 1]` now has a batch row. `if (!running) return` (unreachable: `cancelAnimationFrame` removes the frame) and the write of `answeredRef` (dead while the effect re-runs only on a key change) stay as guards. |
| B-8 | A throwing frame leaves `running` true, so offscreen→onscreen does not resume | PARTLY (NIT) | **Accepted, recorded** | The second half is wrong: offscreen→onscreen does resume (it stops first). No throw source exists in `drawShadow` / `stepFx`; restarting a throwing loop on every resume would repeat the error. |
| B-9 | A NaN `areaEvent` never converges | CONFIRMED (NIT) | **Fixed** | `Object.is` in the bloom step; unreachable from the hub (an integer counter), now safe in the component. |

### Lens C — status-line truth

| ID | Finding | Verdict (refuter) | Disposition | Evidence / reason |
|---|---|---|---|---|
| C-1 | Rule 5 says "Live game in progress" for a game deployed after hours (`preOpen`), while the strip and the Games row say "Deployed · waiting for the open" | CONFIRMED (MAJOR) | **Fixed** | BUILD_RULES §9. The line counts opened games for "in progress" and says the strip's own words (built from `COPY.strip.deployed(COPY.games.waitingForOpen)`, no new string) for games still waiting. Fixture and connected rows. |
| C-2 | Without `liveResolved` (the fixtures), "known" was the completed window's status, so the `checking` fixture said "Idle · nothing running" beside "Checking eligibility…" | CONFIRMED (NIT) | **Fixed** | The fixtures' knowledge is the selector's gate (`gateBlocked` is a boolean once an owned poll answered), never the window's status. The connected hub was never affected. |
| C-3 | An empty retained list after a failed or pending refresh says an unqualified "nothing running" | PARTLY (NIT) | **Fixed for a failed refresh; a refresh in flight stays unchanged** | A failed refresh with nothing live now says "Idle" (claims nothing); a retained live game is still said (Q-S7-3). A refresh in flight changes nothing, so the line does not flicker on every poll. |
| C-4 | A change in the live count re-announces with no phase change | CONFIRMED (NIT) | **Accepted** | "{n} live games in progress" is the ruling's own phrase (R-S7-7 rule 5). |
| C-5 | No S7 row pins the connected hub's rule 6 | CONFIRMED (NIT) | **Fixed** | Connected rows: an answered empty list, an unanswered poll, another owner's list and another epoch's; a failed refresh (empty and with a retained game); a refresh in flight. |
| C-6 | "Locked in" is written twice (line and control) with no row equating them | CONFIRMED (NIT) | **Fixed** | A copy-guard row: `shadow.statusLocked` equals `deploy.holdLocked`. |
| C-7 | Rule 2's "Submitting your deployment" differs from the strip's "Submitting deployment…" | CONFIRMED (NIT) | **Accepted** | The ruling names rule 2's words ("as now"). |

### Lens T — test integrity (mutating; reviewed `dbc543cc`; closed in `d9f725ba`, `f77a4277`, `68e0b7aa`)

| ID | Sev. | Finding | Disposition | Where it is pinned now |
|---|---|---|---|---|
| T-1 | MAJOR | Nothing pinned that the strands are drawn from the geometry module, in motion, leaning, to their last point (frozen strands, no yaw, no selection, the last chunk one point short all survived) | **Fixed** | `hub/shadowCanvas.parity.test.js`: the 2D-context op log of 420 frames in six scenarios (low and mid × no selection, Partnership, Equipped Archetype), digested. The same scenarios were run in a scratch copy against the design's own module (`ff-shadow.jsx`, decoded from the mock-up, never committed): identical op for op, with the one declared departure of the eyes' x (A-4). Plants LT-C22 … C25 die here. |
| T-2 | MAJOR | The tablet and stacked compositions had no row for the area response, the created-terminal response or the ceremony pause (a plant that limited each to the desktop composition survived) | **Fixed** | `CommandCenterHub.s7.jsdom.test.jsx`: the area rows run at 1216, 770 and 614 px; the connected created-terminal and pause rows at 770 and 614 (`renderConnected` takes a width). |
| T-3 | MAJOR | R-S7-2's prohibitions (no tier sniffing, no frame-cost self-downgrade, no detector) had no behavioural row and a partial source guard (a `hardwareConcurrency` tier, a `deviceMemory` tier, a slow-frame downgrade and `performance.now()` in the pure module all survived) | **Fixed** | `ShadowCanvas.contract.jsdom.test.jsx`: device getters and `matchMedia` stubbed to count reads (none), 40 frames 300 ms apart draw the whole tier with one observer and one resize (a loop that gave up fails the frame count), and a source scan of the four S7 modules for `navigator`, `hardwareConcurrency`, `deviceMemory`, `performance`, `PerformanceObserver`, `matchMedia`, `getBattery`, `shPickTier`, `Date` — with its own planted-line row. |
| T-4 | MAJOR | The token → role mapping for colour was unpinned (near/far swapped; the core read from a token the still does not read; the halo in the far colour) | **Fixed** | The kit records every gradient stop. The contract rows rebind the three tokens to colours sharing no channel and assert the stop bases in order (near, near, near, core, near, near, …), the stop offsets and alphas, that every stroke lies on the far → near line at its own depth (and that the check can tell the roles apart), and that no triple outside near and core reaches a gradient. |
| T-5 | MAJOR | The loop's hand-off to `stepFx` was unverified (`sel`, `processing` and `speed` replaced by constants all survived) | **Fixed** | `ShadowCanvas.handoff.jsdom.test.jsx` wraps the pure module's functions and reads each call's arguments: the rig from the tier, the colours from the three tokens, `fitFx` to the strand count, `stepFx`'s `dt`, clock, rate, flags, strands and `random`, `drawShadow`'s clock, rig, effects, colours and flags, `triggerBloom`'s effects and clock (and the stopped clock for a response asked for while stopped). |
| T-6 | MAJOR (kit) | The kit accepted what a real 2D context rejects or resets (a NaN bloom alpha, a signal run past its strand, a transform set before the canvas is resized) | **Fixed** | The kit now throws on non-finite gradient, arc, move and line arguments and on a negative radius, rejects an unparseable colour stop or an offset outside 0 … 1, and records the order of a resize against a transform; a row pins `resize, resize, transform` per run (mount, size change, tier change). |
| T-7 | MINOR | The area row never targeted area 2 (the default), nor the Loadout door | **Fixed** | Each of the three areas is chosen from another and must bloom once and name itself; choosing the current one again does not; the Deploy card's Loadout link selects the Equipped Archetype and responds only from another area. |
| T-8 | MINOR | "With no random given it still runs" could not fail | **Fixed** | The row spies `Math.random` (none before the first frames, calls after) and a second row pins that a given `random` replaces it, also after a re-render. |
| T-9 | MINOR | The observer's options and target, the box's `flexShrink` and the canvas's `display` were unasserted | **Fixed** | Contract rows. |
| T-10 | MINOR | The still's "never lifts past full opacity" row could not fail (the cap is unreachable with the real geometry) | **Fixed** (strand cap) / **Equivalent** (core stop) | `ShadowStill.cap.jsdom.test.jsx` hands the still strands bright enough to need the cap. The cap on the core stop (`min(1, 0.55 × 1.25)`) can never bind (0.6875), so a plant that drops it is an equivalent mutant; it stays as the design's own guard. |
| T-11, T-12 | MINOR | The flare branch, the bloom's alpha, the signal head's glow, the strand alpha and width, the echo alpha, the halo radius, the line cap and the two durations were pinned loosely or not at all | **Fixed** | The parity digest (T-1) covers each; the two durations are additionally pinned by `shadowCanvas.test.js` at their boundary (§9). |
| T-13 | MINOR | "A flash owed under the still, then the canvas shows before the pause releases" had no row | **Fixed — and it found a defect** | The new row was red on the code under review: a flash owed behind the ceremony stayed on the books when the canvas took the route back and was paid at a later, unrelated release once the still returned. The debt is the still's; `ShadowCanvas.jsx` now drops it when the route is not the still (the pause effect's flush settles it at the release, the one moment a debt exists). Row red before, green after. |
| T-14 | NIT | The hold-phase words (rule 1) are caught only outside the S7 files | **Accepted** | `CommandCenterHub.s2b.jsdom.test.jsx` ("the hub's holds, live through the provider") kills the plant; S7's own hub file repeats none of S2b's rows. |
| T-15 | NIT | Three `disposed`-style guards are mutually redundant (each survives alone; pairs die) | **Accepted** | Equivalent as a set: the B-2 and B-5 rows prove at least one guard remains. |

### 9.5 Mutation

Every pass is planted defects applied one at a time to a `git archive` snapshot (never the working tree), each run against the S7 test files and the guards, the file restored byte-exact afterwards. A row that fails kills the plant; one that survives is either a gap (a row is added) or an equivalent mutant (explained).

| Pass | Head | Planted | Result |
|---|---|---|---|
| Builder, first | up to `dbc543cc` | 120 (the pure drawing, the bloom memo, the status rules, the canvas loop, the hub wiring, the guards) | The earlier runs' survivors (the ambient signal cap, the family bias, "no area lean", the forgotten `seen` set, an unvalidated area) each got a row. The run on `dbc543cc`: 115 killed; two anchors had moved (`H04`, `H05`, re-anchored and then killed); one survivor is **equivalent** (a cap that is unreachable at the pinned moment); two (`N06`, `N07`, the two `disposed` guards) each survive alone and **die when removed together** — redundant by design (review T-15). 36 of the single-row kills were re-run at `--maxWorkers=2`: none was a timeout kill |
| Lens T | `dbc543cc` | about 150 distinct defects in 162 runs, its own | 15 survivors, all answered (§9, lens T) |
| Builder, full re-run | `f77a4277` | 164 (the 120 plus 44 aimed at the lens T rows: colour roles, resize order, observer, hand-off, flash debt, the design's constants) | 149 killed; 4 survived — the `N06` / `N07` pair, one dependency that proved redundant (`[paused, still]`: removed in `68e0b7aa`), and one plant (the signal-expiry threshold) that the parity digest alone cannot see; 11 anchors had moved and were re-anchored |
| **Final** | **`68e0b7aa`** | **116**: lens T's 38 replays (its own plants, re-made from its report), the re-anchored status and flash plants, and every `ShadowCanvas.jsx` plant of the previous pass re-run (that file changed after it) | **113 killed; 3 survived.** `LT-L03` is the equivalent mutant (the still's core-stop cap, `0.55 × 1.25 < 1`, can never bind). `N06` and `N07` are the redundant pair; the combined plant `N06 + N07` is **killed** ("an observer entry delivered after disconnect does not revive a disposed run"). Also killed on this head: `H04`, `H05` (the live count and the live read), and the signal-expiry plant under the full set |

Lens T's 38 replays: **37 killed**, 1 equivalent. The design-parity digest (`shadowCanvas.parity.test.js`) is the sharpest of the new rows: aimed alone at 17 plants of the design's constants (ring length and growth, glow alpha, strand width and alpha, the signal tail's length and radius, the flare cadence, the first spawn, the family bias and dimming, the echo nodes' yaw, the yaw swing, the depth normalisation, the last chunk, the processing cap), it kills **16**; the 17th, the signal-expiry threshold (`u < 1.07`, invisible in the drawn output because the last visible dot has gone by 1.056), is killed by the unit row at its exact boundary (`shadowCanvas.test.js`, "a signal moves by v × dt × speed and is gone past u = 1.07").

The plants aimed at lens T's survivors each die on the row written for them, by name: the colour roles on `ShadowCanvas.contract` (a swapped near/far, the core read from a token the still does not read, the halo in the far colour), the resize order and the observer's target and options on the same file, the hand-off arguments on `ShadowCanvas.handoff`, the device and downgrade probes on the contract's R-S7-2 rows, the still's cap on `ShadowStill.cap`, the area-2 and Loadout-door plants and the tablet-and-stacked plants (`composition === DESKTOP`) on `CommandCenterHub.s7`, and the debt plant on the contract's owed-flash row (which was red against the code lens T reviewed).


## 10. Founder questions

Nothing waits on an answer; each is built to the default named in it.

| # | Question | Built as | Why it is yours |
|---|---|---|---|
| **Q-S7-1** | Should the phone's tab presses bloom? | They do not: on the phone an area is the tab row, and the prompt's "never on … a tab switch" is read as the phone's tabs. A new area selection blooms on the wide site only (the area controls). The decoded design's `selectArea` bumps no event at all (its bloom fires on opening a sheet or a completed write, which this build forbids). | R-S7-3's list can be read two ways on the phone; say which. A tab press that selects an area-bearing tab could bloom; Overview (no area) never would. One line in `PhoneHub.selectTab`. |
| **Q-S7-2** | Should a hub sheet (History, Activity, the Loadout sheets) pause Shadow? | No. Only the root deploy ceremony pauses it (the provider's `overlayOpen`, an existing signal); a hub sheet leaves Shadow in view and moving behind its scrim. The Forge replaces the dashboard, so the hub unmounts (full cleanup). | R-S7-5 named the Forge and the root ceremony; the hub's own `modalOpen` is also exposed and would pause for sheets at no new signal. |
| **Q-S7-3** | Retained live game after a failed refresh: what does the status line say? | "Live game in progress" — it follows the retained owned list, as the strip and the Deploy card do (they show the game with its "as of" time; the line has no way to say "as of"). With nothing live in the retained list, a failed refresh says "Idle" (review C-3: "nothing running" would be asserted from stale data); a refresh merely in flight changes nothing. Pinned by rows. | R-S7-7's rules 5 and 6 meet here. The alternative is "Idle" whenever the last poll failed, which would sit beside a card still showing the live game. |
| **Q-S7-4** | The stacked composition's focus order: stage → panel → Deploy → Games, on a page that shows stage → Deploy → panel → Games. | Not changed (the DOM stays one order). One backward jump (panel 875 → Deploy 709 at 834 × 1000 with the sidebar open); the panel stays with the area control that owns it, which is the order the tabpanel semantics want. The tablet has none; the desktop's one is the second column's top, which is ordinary reading order. | Q-S2A-1 asked for the record. If the jump reads badly on a keyboard, the fix is a DOM move (or the panel below Deploy in the grid), both outside S7's "don't reorder". |
| **Q-S7-5** | A response requested while the loop is stopped (a hidden tab, the ceremony open): play on return, or drop? | Plays on return, on Shadow's own clock, which stands still with the loop. A created terminal usually arrives behind the ceremony, so dropping would mean it is never seen. | It is a judgment about what "never on a tab switch" protects. |
| **Q-S7-6** | The reduced-motion flash and the ceremony. | Closed by review finding A-3: the still's flash is owed while the root ceremony covers the page and shown when the page is back (one flash however many responses arrived), as the canvas holds its bloom on its own clock. It is not deferred for a hidden tab or an offscreen box (the still has no loop to pause). | Recorded so the founder sees the one place the still and the canvas still differ: hidden and offscreen. |
| **Q-S7-7** | A hub-started deployment with the ceremony OFF never shows a created terminal. | App's handoff navigates at once and acknowledges the creation (the provider's own comment); the hub is gone, so no bloom, and Shadow reads processing only while submitting. Only a closed ceremony, a failed handoff, or a recovered creation leaves "Deployed" / "Battle confirmed" on the hub; those bloom once. The Scouting Board's tap acknowledges its own creation the same way. | Recorded so the smoke check does not expect a bloom from a flag-off deploy. |
| **Q-S7-8** | The phone result: the proxy numbers, then the named device. | See §8. | The check is yours; the constant is the fix. |
| **Q-S7-9** | Reduce Motion turned on mid-session. | Not honored until the hub remounts: the hub's one source, framer-motion's `useReducedMotion` (12.23.24), reads the OS setting once (its own TODO), and every hub surface reads it the same way. R-S7-1 forbids a second media query in the hub. | A live preference would need either a framer-motion update or a hub-level subscription (one `matchMedia` listener in one hook), which R-S7-5's manifest would then list. |

## 11. What S8 and the activation inherit

- **The flag is S8's.** `COMMAND_CENTER_HUB_ENABLED` is `false` here and stays `false`; nothing a player sees changes. The smoke branch (§13) is the one place the flag is true.
- **The phone fallback is one constant.** If the founder's phone check (§12) misses 60 fps / 6 ms / 2% late on the named device, the fix is `PHONE_SHADOW = 'still'` in `hub/hubFlags.js` and nothing else — with the device and the run recorded in the checklist. Nothing is redesigned to pass.
- **The entry-chunk rule (R-S7-9).** `DeployAttemptProvider` sits at App's root and imports hub modules (`attemptVocabulary`, `hubDate`, `overlayStack`, the selectors). Every extra binding the hub chunk imports from one of them becomes an export of the *entry* chunk. S7 found +18 B that way and removed it: `hub/shadowStatus.js` spells its two vocabularies (`HOLD`, `ATTEMPT_WORDS`) as local constants, and rows pin them equal to `attemptVocabulary`'s. A later slice that wants one more binding from those four modules should expect the entry chunk to grow by it, and run the normalised entry diff (§7) before pushing.
- **The canvas kit.** `__fixtures__/shadowCanvasKit.js` (`installFakeCanvas`) is the one stand-in for a 2D context, a frame loop, an observer and document visibility. It is strict on purpose (throws on non-finite or negative arguments, rejects an unparseable colour stop, records stops and the order of a resize against a transform). Any later consumer of a canvas should use it rather than add a looser one.
- **The manifests.** S7's additions are in their own `S7` blocks at the end of each list: `tokens.guard` / `tokenGuardBaseline.json`, `motion.guard` / `motionGuardBaseline.json`, the mount guard's per-file activity allowances (and their negatives), the activity guard's `SHADOW_CANVAS` manifest (call by call), and the copy guard. The activity guard now also reads `ShadowCanvas.jsx` (it read `hub/` only).
- **Status words.** `hub/shadowStatus.js` is the seven rules (R-S7-7). Rules 3 and 4 take the string `deployDisplay` built for the Deploy card, so a change to a card word moves the line with it. A new attempt state needs a row in `shadowStatus.test.js` and one in the connected hub rows.
- **Reduced motion is read once.** Q-S7-9: framer-motion's `useReducedMotion` (12.23.24) reads the OS setting at mount; turning Reduce Motion on mid-session is honoured after a remount, on every hub surface alike.
- **Founder questions Q-S7-1 … Q-S7-9** (§10) are each built to the default named; none blocks.
- **Pre-existing, not S7's.** `src/config/shadowCpuQuoteIntegrityFlags.test.js` "OFF-1 … registers it as dark by design" is red on Windows at an unedited `main` (a platform-only row; the Linux suite is green). Nine `App.activeBattlesPoll.owner` rows, two `App.bootOrder` rows, one `commandCenterHubFlags` dark pin and two `flagPinGuard` rows go red *by design* when the flag is true (the smoke dry run, §13).

## 12. The founder's phone check

The smoke branch (§13) is the build head plus a flag-true commit and a corner readout (`fps` and frame cost, last second and last 60 s). Open its Vercel preview on the phone, signed in with an agent; then on a desktop.

| # | Check | How | Pass looks like | Result |
|---|---|---|---|---|
| 1 | Shadow moves | Open Command Center on the phone and leave it a minute | Strands drift, a signal travels now and then, small flares; never frozen | ☐ |
| 2 | Frame rate and cost | Read the corner readout after a minute | `60 s` line: ≥ 59 fps, avg cost well under 6 ms, `late` ≤ 2% | ☐ fps ___ cost ___ ms late ___% |
| 3 | The named device | Note it | Model, OS, browser, battery saver off, charging or not | ☐ ______ |
| 4 | Processing | Hold to deploy for real (a game you can afford to start) | Shadow quickens and its core pulses only while "Submitting your deployment" shows; ambient again when the answer arrives | ☐ |
| 5 | The response | Tap each area on a desktop; tap the phone's tabs | Desktop: one bloom per new area, none for the area already selected. Phone tabs: no bloom | ☐ |
| 6 | The status line | During a live game, and through a deploy | "Live game in progress" (or "N live games…"); the card's own words for each attempt state; "Idle" before the first read answers | ☐ |
| 7 | 360-wide margins, platform font | A 360-wide phone, or the browser's 360 view | The 85 px "Partnership" tab cell holds its word; the status words wrap, never clip; no horizontal scroll | ☐ |
| 8 | Safe area | A phone with a home indicator | The strip clears the bottom nav; nothing sits under the indicator | ☐ |
| 9 | The strip over the nav | Scroll the page | The strip stays one piece above the nav, nothing touches it | ☐ |
| 10 | Reduced motion | Turn on the phone's Reduce Motion, reload | Shadow is the still drawing; no motion; a tap on a desktop area flashes it for under half a second | ☐ |
| 11 | Hidden | Switch to another app or tab for a minute, come back | The readout's `fps` returns to 60 within a second; the frame cost did not creep | ☐ |

If check 2 misses the targets (below 60 fps, over 6 ms, over 2% late), the fix is the one constant — `PHONE_SHADOW` in `hub/hubFlags.js` → `'still'` — with the device and run recorded here. Nothing else is redesigned to pass.

The readout exists only on the smoke branch: on the PR head there is none, and under Reduce Motion (check 10) the smoke branch shows none either, by design. The tiers are fixed (the phone is low), so the phone result is one number per device, not a range to tune.


## 13. The smoke branch — NEVER MERGE

`claude/command-center-hub-s7-smoke`, pushed by refspec, **no PR**, so a Vercel preview exists for the founder's phone check (§12). Two commits on the merged code head `6f1a832e`:

| Commit | What | Diff |
|---|---|---|
| `1aaf64bd` | `SMOKE ONLY, NEVER MERGE: turn the Command Center hub on (S7 preview)` | `src/config/featureFlags.js`, one line (`COMMAND_CENTER_HUB_ENABLED = true`) |
| `d93146f6` | `SMOKE ONLY, NEVER MERGE: a corner readout of Shadow's fps and frame cost` | `ShadowCanvas.jsx`, +28 lines: a fixed corner `div` (`[data-shadow-readout]`) updated every 500 ms with the last second's fps and the frame's step-and-draw cost, and the last 60 s's average fps, average and p95 cost and share of frames more than 25 ms late; removed on cleanup. Reduced motion and a failed canvas draw none |

Both commits were composed with git plumbing (a blob per file, a temporary index, no second working tree) so each touches exactly its files; this session is not permitted to write another worktree's files, and an earlier local attempt in a second worktree, never pushed, carried line-ending noise across 866 files and was discarded.

**The readout, checked** on the smoke head `d93146f6` itself (a `git archive` of it, served by the harness, headless Edge, 390 × 844): after a few seconds it read `fps 61 · cost 0.65 ms` and, over the 4 s window so far, `58.6 fps · avg 0.64 · p95 1.00 ms · late 0.5%` (the window still holds the page's start-up), exactly one readout `div`, no page error; under reduced motion there is no readout. The numbers settle after the first seconds; the founder's check reads the 60 s line.

**The flag-on dry run** (the smoke head `d93146f6`, the full Linux suite, `--maxWorkers=8`, `TZ=UTC`, under the lock): **17 red rows in 7 files**, every one by design.

| Rows | Why |
|---|---|
| 14 — `App.activeBattlesPoll.owner` ×9, `App.bootOrder` ×2, `commandCenterHubFlags` dark pin ×1, `flagPinGuard` ×2 | the same 14 S3 and S4 recorded: they pin the flag-off App and the dark flag, and say so |
| 3 — `tokens.guard` (a core-palette hex in `ShadowCanvas.jsx`), `commandCenterHub.mount.guard` ("no raw colour anywhere"), `ShadowCanvas.contract` R-S7-2 ("name none of them": the readout calls `performance.now()`) | the readout is the one place the smoke branch breaks the rules the product obeys: a raw rgba, a hex, a clock read. They are the guards working, and they are green on the PR head |

S7 adds no red row to the flag-on state: take the readout away and it is the 14.

## 14. Deviations and notes

- **Declared departures from the design's canvas**: the eyes' x (±0.165, not ±0.17) and the reduced form's two frozen signal dots (§2; review A-4, A-5). Both follow from R-S7-1's "port from the geometry module, fall back to the still".
- **Lens coverage.** Lenses A, B, C and their refuters reviewed `1113a75f`, lens T reviewed `dbc543cc`; four later commits were not lens-reviewed, one of which changes production code (the owed-flash debt, `ShadowCanvas.jsx:175-193`). They are small and covered by the replay, the guards and the full suites (§1, §9.5); a reviewer who wants a read of them has the diff command in §1.
- **`dbc543cc`'s commit message overstated the jsdom noise result** (§7 has the figures). The commit was not amended.
- **The performance proxy is a proxy.** Headless Edge, 4× CPU throttle, DPR 3, the real starfield, a live-game scenario (the sky at its fastest). The final figures were taken at `68e0b7aa` on a quiet machine (CPU 0–7% at start and end, the suite lock free). The attribution runs (Shadow alone, sky alone, the harness's floor) were taken earlier, at `1113a75f`, when the machine was not truly quiet (CPU 2–60%); they split the cost and are not criteria. The phone is §12.
- **Layout and behaviour sweeps** were re-run on the merged head `6f1a832e` (§8); the production changes since the first sweep touch no markup or style.
- **What a hub sheet does.** A hub sheet leaves Shadow in view and moving behind its scrim; only the root deploy ceremony pauses it (Q-S7-2).
- **The Forge** replaces the dashboard, so the hub unmounts and every S7 resource is released by the unmount cleanup (pinned by the cleanup rows).
- **Reduced motion is read once** (Q-S7-9).
- **Pre-existing, not S7's:** `shadowCpuQuoteIntegrityFlags` OFF-1 is red on Windows at an unedited `main` (§7).
