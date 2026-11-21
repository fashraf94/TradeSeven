# Build report — Film Room D1: the game's flow

**Executor:** Claude Code (Opus 5.5), Nov 20–21, 2026. **Branch:** `claude/film-room-d1-flow`, cut from `origin/main` `cf35151b` (it holds `41c04cd2` and Film Room C2's `api/_utils/filmRoom/momentExcerpt.js`). `git fetch origin` was the session's first git step and was repeated before the final checks and before the push; `origin/main` had not moved, so the branch tip IS the tree merged with current `origin/main`. **PR:** [fashraf94/TradeSeven#1102](https://github.com/fashraf94/TradeSeven/pull/1102). **Head:** the commit adding this report; code head `bed627b5`.
**Governing:** Build D spec V1 (`docs/specs/FILM_ROOM_BUILD_D_FLOW_SPEC_V1_20261120.md`), the mock-up (`docs/design/20261120_FILM_ROOM_FLOW_MOCKUP.html`, committed byte-identical, SHA-256 `5389cebe…f2cc8e`), Build C Amendment F (CF-5), BUILD_RULES §2, §4, §9, §10.

## Verdict

| | |
|---|---|
| **The build** | All eight items and B0 built, one commit each, tests in the same commit, then the review's three commits (§1). The front opens for an owner the flow admits, on a written day not opened at a moment; the tape is unchanged behind one door. |
| **Off is off (criterion 1)** | The twelve goldens pass UNEDITED under `FILM_ROOM_FLOW_MODE` `'off'`, `'allowlist'` with the verdict held pending, and `'allowlist'` answered no — every paint of every case the same sequence (`FilmRoomFlow.off.golden.jsdom.test.jsx`); an independent main-vs-head differential (202 runs, review lens 1, at the review head) found the HTML, focus, reads, back and storage byte-identical. Two differences stand as questions: a verdict request when the cards do not ask (Q-1, not at the shipped values), and the first-open notice's mark while an `'allowlist'` verdict is still pending (Q-12). |
| **No new read (criterion 2)** | The front adds no Firestore read; the series is read only when the Deep dive opens — including after a trip back to the front (a review finding, fixed). |
| **Numbers, facts, chart, pins (criteria 3–8)** | Every number bound to its tape path or a declared derived aggregate, with no mark (FL-12); the margin from the two displayed finals; makers from the recorded mechanism only; the chart's lines are the tape's, broken at every check with no score or instant; the choice of five, the count, the merge and the selection deterministic; quotations only from their tape paths; the counts as §8 defines them. |
| **Doors (criteria 9–10)** | Front → tape (Glance, focus on its panel) → "Game flow" → front (focus on the door); a pin's link → Study at the swap's card or the directives; a moment-opened screen opens on the tape with `main`'s back; pins are 44 px buttons named by their fact lines, in time order. |
| **Fences (criterion 11)** | Held. Five pre-existing suites gained only a `FILM_ROOM_FLOW_MODE` `'off'` pin in their flag mock (§6). No golden or fixture moved. |
| **Merged tree (criterion 12)** | Green on Linux at `bed627b5` — the merged tree (origin/main `cf35151b` is the base): the full suite 1,593 files passed, 0 failing; the rules suite 839 / 839; `lint:gate` and `vite build` exit 0. |
| **Review** | Five lenses + one refuter: 29 distinct findings — 26 CONFIRMED, 1 REFUTED, 2 split; every confirmed defect whose fix the spec decides was fixed with a row and a revert mutant; the refuter's 4 on the fixes (2 blocking) fixed; the rest are §10's questions. |
| **Mutants** | 60 / 60 killed (one survivor on the first pass — the day picker's key — killed by a row added for it), judged by exit code and a fresh JSON report, in four LF git-archive trees of the frozen code head, each restored byte-for-byte (§7). |
| **Questions** | 14 numbered questions (§10), none blocking. |

## 1. The items

| # | Item | Commit | Tests | Mutants (killed / run) |
|---|---|---|---|---|
| B0 | Docs: the mock-up (byte-identical), spec D V1, Amendment F, Astra's C2 confirmation, four README rows | `4d498e1b` | — | — |
| 1 | The gate: `FILM_ROOM_FLOW_MODE = 'allowlist'`, `FILM_ROOM_FLOW_MODES` (`src/config/featureFlags.js:3678`); `resolveFilmRoomFlowMode`, `filmRoomFlowOn` (`src/utils/filmRoomGate.js:223`, `:234`) | `6e9c5094` | `src/config/filmRoomFlowFlags.test.js`, `src/utils/filmRoomGate.flow.test.js`; the screen rows in `FilmRoomFlow.screen.jsdom.test.jsx` | 3 / 3 (M1a an unknown mode resolving on; M1b a non-admitted owner getting the front; M1c a pending verdict reading as on) |
| 2 | The flow model, `src/screens/filmRoomV2/filmRoomFlow.js` (pure, Node-clean); seven aggregates declared in `SCREEN_AGGREGATE_CLASSES` (`filmRoomModel.js`) and the harness's pinned copy | `bd1bb15e` | `filmRoomFlow.test.js` | 17 / 17 (the prompt's eight: the margin from the raw finals, a line joined across a check with no score, the lines from zero at the open, an opponent line without the basis, a gameplan_meeting swap counted as the agent's own, a no_change directive counted as filed, the priority dropping an agent's swap before a rule's, a tile on partial coverage — and nine more) |
| 3 | The copy: `FILM_ROOM_COPY.flow` (`filmRoomCopy.js:478`), 41 keys (§11 and §6's "+") | `ab502d38` | `filmRoomCopy.inventory.jsdom.test.jsx` (455 keys, 605 entries; §11 pinned by composition) | — |
| 4 | The front, `FilmRoomFlow.jsx` | `77a83270` | `FilmRoomFlow.jsdom.test.jsx` | 2 / 2 (a reply shown when agentReplyDiffers is true; a pin with no accessible name) |
| 5 | The shell, `FilmRoomScreenV2.jsx`: the gate, the opening rule, the front's header, the doors and the way back, focus | `8d47a673` | `FilmRoomFlow.screen.jsdom.test.jsx`, `FilmRoomFlow.off.golden.jsdom.test.jsx`, `FilmRoomFlow.reads.jsdom.test.jsx` | 8 / 8 (a moment-opened screen landing on the front; a read added by the front; and six on the back label, the doors' focus, the verdict's battle and owner, the front's header) |
| 6 | The cards line (§9) | `5652d333` | `FilmRoomFlow.screen.jsdom.test.jsx` (F-CARDS), `FilmRoomFlow.jsdom.test.jsx` | 1 / 1 (the cards line shown with cards off) |
| 7 | CF-5 (`FilmRoomCardRegions.jsx:699`) | `06450a82` | `FilmRoomCardRegions.cf5.jsdom.test.jsx` | 2 / 2 (the sentence on each row; the sentence dropped) |
| 8 | The harness: `sweepFlow`, `flowCopyDefects`, `SPEC_FLOW_NUMBER_SITES`, `SPEC_FLOW_COPY` (`__fixtures__/filmRoomHarness.jsx:811`–`:959`) | `ed119fdd` | `__fixtures__/filmRoomHarness.flow.jsdom.test.jsx` | 1 / 1 (the site-and-day binding off), plus the self-test's planted defects |
| — | The review round (§8): the lenses' findings fixed, the tests' gaps closed | `0c28084d` | rows in each suite above | 26 / 26 (a revert of each fix, the tests' gaps, the refuter's three) |
| — | The refuter's round (§8): N-1b, N-2, N-3, N-4 | `e2783b2b` | the screen and model suites | (in the 26) |
| — | DR-1's other ending: the battery's one survivor's row | `bed627b5` | the screen suite | the survivor killed |

Item 8 was committed before item 4 so the front's tests could use its sweeps; items 4, 5 and 6 were committed in order from one working tree, the cards line held out of 4 and 5.

**Acceptance rows → tests.** F-OFF: `FilmRoomFlow.off.golden` (all four rows) and the five pinned suites. F-READS: `FilmRoomFlow.reads`, and the screen suite's DR-4 row. F-FIXTURE: `filmRoomFlow.test.js` "F-FIXTURE" (heading, key, the line from the first check with the final point, six events — five chosen, "1 more" —, groups at 350 and 296 px, the low −92 at 1:30 PM, the two counts) and `FilmRoomFlow.jsdom` "F-FIXTURE" (the same, rendered at 390 and 320). F-AGREE, F-LINE, F-LOW, F-MAKER, F-PINS, F-DIR, F-COUNT: the model suite's describes of those names, the rendered halves in `FilmRoomFlow.jsdom`. F-DOOR: the screen suite's "F-DOOR" and review-round rows. F-COPY: `flowCopyDefects` over eight day states and the whole page. F-CARDS: the screen suite's "F-CARDS". F-CF5: `FilmRoomCardRegions.cf5`.

## 2. The rulings FL-1 to FL-16

| # | Where it is built, or why it needs no code |
|---|---|
| FL-1 | No code: the purpose. The counts' definitions (§8) are fixed in `countsOf` (`filmRoomFlow.js:395`) so a later build counts the same thing across games. |
| FL-2 | The front is heading, key, chart, legend, panel, counts, cards line, door (`FilmRoomFlow.jsx:330`); no agent sentence under the result. |
| FL-3 | The opponent's line from `checks[].scores.opponent`, drawn only under `score.opponentBasis === 'cpu_portfolio'` with a number to show (`keyOf`, `linesOf`: `filmRoomFlow.js:112`, `:192`). No tape field added. |
| FL-4 | `groupPins(pins, width)` (`:315`): 44 px from the group's FIRST pin, at the measured width; the panel's stepper (`FilmRoomFlow.jsx:262`). |
| FL-5 | `choosePins` (`:294`): agent's swaps, directives, other swaps, each in time order; shown and numbered in time order; the rest counted. |
| FL-6 | `lowOf` (`:218`) and `layoutOf` (`:454`): the lowest scored check, the earliest on a tie; ≥ 3 scored checks; not the line's last point; left out over a pin's touch area or outside the chart. |
| FL-7 | `orderedRows` / `runsOf` (`:129`): the lines start at the first check; any check with no score or no instant breaks them. |
| FL-8 | `allPinsOf` (`:278`): `exitMakerOf(a).by === 'agent'` filled, any other maker hollow; `MAKER_KEYS` (`:261`) the maker's words from the mechanism only. |
| FL-9 | Two tiles only (`countsOf`). |
| FL-10 | "directives filed" (`cardState === 'committed'`); the copy pins "acted on" absent (`filmRoomCopy.inventory`). |
| FL-11 | Not built: no idea row. |
| FL-12 | No number-kind mark on the front (`sweepFlow` fails on one); every number bound (`data-flow-num` path + class, `data-flow-agg` declared aggregate). |
| FL-13 | `fmtPoints`, `fmtPrice`, `etClock` (through `etWhen` where a filing fell on another day — §3 item 11, §10 Q-6). |
| FL-14 | `FILM_ROOM_FLOW_MODE = 'allowlist'` (`featureFlags.js:3678`), resolved per owner through the cards' verdict seam (`FilmRoomScreenV2.jsx:265`). |
| FL-15 | No code: a day with no tape shows the existing no-tape page (the opening rule requires a written tape). |
| FL-16 | The cards line (`FilmRoomFlow.jsx:363`, `FilmRoomScreenV2.jsx:425`); the card regions stay on the tape. |

## 3. Where the build chose between the mock-up and the spec, beyond the spec's §12

1. **Straight segments, not the mock-up's smoothed curve.** A spline overshoots between checks and would draw values the tape never recorded (criterion 5).
2. **Tokens for the mock-up's colours** (BUILD_RULES §10): the CPU line and the dashed key mark use `--ft-text-secondary-holo` (the mock-up's `#A8ACB8` has no token); the zero line is the scrim at 0.24, the drop line teal at 0.55, as drawn.
3. **The app's font**, not Schibsted Grotesk; sizes, weights and spacing as the mock-up.
4. **The chart's bottom padding is 26 px** (the mock-up's 14) so the low mark's label has room under the lowest point; heights 150 / 112 / 230 as the mock-up.
5. **The quotations use the kit's `Quotation`** (the prompt's instruction): its attribution "— the player · 1:40 PM" stands where the mock-up dates the words "Sep 23"; "You" and the agent's mark sit beside it as the mock-up draws them. The agent's mark is the screen's own `AgentMark` (the cockpit avatar), at 22 px.
6. **The legend in §4.4's order** (agent's swap, other swap, directive), not the priority order.
7. **The stepper** (the mock-up has none) sits after the pin link, "Previous" / "Next", `aria-disabled` at the ends so the focus stays.
8. **The fact line breaks only between its parts**, as the mock-up's `FlFact`.
9. **The front's header** keeps `main`'s top row as it is (the mock-up drops the "Film Room" pill at 320); a hairline closes it where the mock-up draws an 8 px strip.
10. **"Final {total}" with no recorded total** shows the formatter's "—" (the spec's row has no value to show).
11. **A pin whose instant falls outside the session** (a directive filed the evening before, or after the close) sits at the axis's edge; its fact line names its date (Q-2).
12. **A row with no instant** is never drawn and counted with "n more"; with no pin at all and such rows, the count stands where the quiet line would (the review's NUM-3).
13. **While a day picked on the front is read**, the front keeps its frame with an empty body (the review's DR-1); the first open shows `main`'s loading layout, as §2/§3 require.

## 4. Where each pin's link opens the tape

| Pin | Opens | Focus |
|---|---|---|
| A swap (either kind) | Study, at the swap's card `#swap-n` — n its place in time order (`swapOrdinals`), never its index | the card |
| A directive | Study, at the `#directives` section (Study is fenced and has no per-directive id) | the section (Q-5) |
| The door and the cards line | Glance | Glance's panel |

## 5. What else the shell mounts, and how the front treats it

- **The cards hook** (`useFilmRoomCards`): unchanged; it resolves the cards and, under cards, reads the counter once, as on `main`. The front reads only the moment count from the written tape.
- **The idea version** (`useIdeaVersion`): unchanged — read under cards for a written day, as on `main`, front or not.
- **The series** (`useSeriesDay`): disabled while the front shows (the review's DR-4).
- **The first-open notice**: rendered only on the tape; marked seen once it has shown on a settled tape — with the flow off at the first paint, exactly as before (the review's DR-3).
- **The depth tabpanels, the reserved regions, the card regions, the footer**: not rendered on the front; all back on the tape as `main` renders them.
- **The pending jump** (the screen's navigation) carries the front's doors; **AgentMark** draws the agent's mark beside a quoted reply.
- **The click guard** (`onClickCapture` on the tape's root, no attribute rendered): a click before the front has shown, while its conditions are unknown, keeps the tape.

## 6. Fences

- **Not in the diff:** anything under `api/`; `firestore.rules`, `firestore.indexes.json`, `vercel.json`, `package.json`, `package-lock.json`; `FilmRoomGlance.jsx`, `FilmRoomStudy.jsx`, `FilmRoomDeepDive.jsx`, `FilmRoomCheckDetail.jsx`, `FilmRoomRoute.jsx`, `filmRoomData.js`, `filmRoomCards.js`; `src/components/CommandCenter/**` and the Practice Field; every golden (`src/screens/__golden__/*.html`) and fixture (`__fixtures__/*.json`); every BUILD_RULES §1 file. Verified on the diff (§7, the fences row).
- **In the diff, as allowed:** `featureFlags.js` (the flag), `filmRoomGate.js` (the two functions), `filmRoomModel.js` (seven declarations only), `filmRoomCopy.js` (`flow`), `FilmRoomScreenV2.jsx`, `FilmRoomCardRegions.jsx` (CF-5 only), the harness. `filmRoomBack.js` was not needed: "Game flow" lives in the copy table.
- **New files:** `filmRoomFlow.js`, `FilmRoomFlow.jsx` and their tests; the docs.
- **Five existing suites** gained a `FILM_ROOM_FLOW_MODE` `'off'` pin in their feature-flag mock and nothing else: `FilmRoomCards.jsdom`, `FilmRoomRoute.golden.jsdom`, `FilmRoomRoute.untaped.jsdom`, `FilmRoomScreenV2.cardsOff.golden.jsdom` (four lines each), `FilmRoomSubjectLine.jsdom` (a seven-line mock block: it had none). They test the tape as it was; the flag merges at `'allowlist'`, which would open their admitted owners on the front. No assertion changed.
- **No new dependency**; the chart is hand-built SVG. No merge, deploy, flip or production access.
- **`flagPinGuard.test.js`** was not edited: the flag is a string tri-state outside its scan, and it is not dark.

## 7. The checks

**The merged tree.** `git fetch origin` before the final checks and before the push: `origin/main` is `cf35151b`, the branch's base, so the branch tip is the tree merged with current `origin/main` (no merge commit was needed).

| Check (code head `bed627b5`) | Where | Result |
|---|---|---|
| Full suite | WSL Ubuntu, a private worktree of `~/pd-ci` at the exact commit (its `node_modules` linked to an install whose `package-lock.json` hash matches, `e457c10d0317`), Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **1,593 files passed, 13 skipped, 0 failing; 36,532 tests passed, 179 skipped, 0 failed** (357 s) |
| Rules suite (`npm run test:rules`) | the same tree, the Firestore emulator on Temurin 21 | **46 files, 839 / 839** (210 s) |
| `npm run lint:gate` | the same tree | **exit 0** |
| `vite build` | the same tree | **exit 0** (17 s; the usual chunk-size warnings) |
| `vite build` of the pushed head (this report's commit, docs only) | the same tree | recorded in the PR's description (this commit cannot hold its own run) |
| The mutant battery | Windows, four LF `git archive` trees of `e2783b2b` (the frozen code; `bed627b5` adds one test row), each a shard; each mutant applied exactly once (else BROKEN), its rows run with a fresh JSON report, judged KILLED only on a non-zero exit WITH ≥ 1 failed assertion, the file restored and checked | **60 / 60 killed** (59 on the first pass; the survivor, the day picker's key, killed by the row `bed627b5` adds); a clean baseline of the 8 files (147 rows) first; every tree's six mutated files byte-identical to the commit afterwards |
| The fences | `git diff --name-only origin/main...HEAD`: 30 files (+4,535 / −26) | **none fenced**: nothing under `api/`, no rules, indexes, `vercel.json` or `package*.json`, none of the seven untouchable screen files, nothing of the hub's or the Practice Field's, no golden (`__golden__/*.html`) or fixture (`__fixtures__/*.json`), no BUILD_RULES §1 file — the only `__fixtures__/` entries are the harness and its self-test, both allowed |
| The front in a real browser | headless Edge (playwright-core) on a scratch fixture page served by vite, at 390 × 844, 320 × 568 and 1440 × 860, the app's CSS and font stack (Segoe UI here) | the chart lays out at **350 px at 390** and **296 px at 320** (639 on the 1440 desktop) — the widths F-FIXTURE's groups are pinned at; no horizontal scroll; the low mark, the quotations and the stepper looked at in screenshots |

**Earlier runs:** the same four checks passed on Linux at `0c28084d` (1,593 files, 0 failing; rules 839 / 839) and `lint:gate` and `vite build` at `06450a82`. On Windows, the Film Room folder (39 files) passes at 6 workers; under the default 20 workers three jsdom suites (FilmRoomScreenV2.jsdom, FilmRoomFlow.screen, FilmRoomStudy.replay.writer) timed out rows under load and each passed alone — the Linux run at 8 workers is the record, and the new screen suite now carries the sibling suites' 30 s row bound.

## 8. The review (BUILD_RULES §2)

**How it ran.** Five lenses, each a subagent on its own LF `git archive` of the code head `06450a82` (node_modules junctioned, read-only on git and on the shared checkout), the tests lens mutating only its own tree, last; then one refuter on the old head and a new snapshot of the fixed head `0c28084d`, instructed to refute every finding with a repro and to test every fix; then the refuter's own findings fixed at `e2783b2b` and pinned. Lenses: (1) the off path and the reads — an independent main-vs-head differential of 202 runs; (2) the numbers and their agreement with the tape view; (3) the chart's honesty against the tape's rows; (4) the doors, the focus and the keyboard; (5) the tests' integrity — 31 mutants of its own. An explicit `vite build` ran on Linux at the review head and again at the pushed head (§7).

**Result: 32 findings reported, 29 distinct (CH-4, OP-1 and OP-4 repeat others) — 26 CONFIRMED, 1 REFUTED (OP-3), 2 split (DR-5, OP-5: part confirmed, part refuted); then 4 from the refuter's check of the fixes (N-1 to N-4), two of them blocking, both fixed.** Every confirmed defect with a fix the spec's words decide was fixed with a row and a revert mutant (§7); the rest are questions (§10).

| id | finding (short) | sev. | verdict | disposition |
|---|---|---|---|---|
| NUM-1 / CH-4 | an earlier day whose tape carries the completed battle block read as the final day: "Won by", `battle.final` in the key, a final point | major | CONFIRMED | FIXED — the tape's `isFinalDay` too (`filmRoomFlow.js:58`) |
| NUM-2 | "Won by 0" when the displayed finals are equal | minor | CONFIRMED (spec letter) | Q-4 |
| NUM-3 | rows with no instant: "Nothing stood out" beside "6 more" | minor | CONFIRMED | FIXED — the count alone; Q-10 |
| NUM-4 | a final day with no recorded final total: "Final —", "You —" | minor | CONFIRMED (spec letter) | Q-9 |
| NUM-5 | the harness's number paths not tied to site or day; the "more" oracle reads the drawn pins | minor | CONFIRMED | FIXED for sites, day and the low (`SPEC_FLOW_NUMBER_SITES`); "more" is the rows NOT drawn, so it reads what is drawn — the choice of five is pinned by F-PINS rows |
| NUM-6 | a seq-less row at the last instant: the key (the writer's `buildScore` order) and the line's last point can differ | minor | CONFIRMED | not fixed: needs two rows at one millisecond; the line now follows `orderChecks` |
| NUM-7 | "Low −92" while a lower final point ends the line | minor | CONFIRMED (spec letter) | Q-8 |
| CH-1 | a writer gap row (tickSeq, no instant, no score) joined across | major | CONFIRMED | FIXED — the writer's order; a row with no instant breaks the line |
| CH-2 | a pin in a break placed at a height interpolated across it | major | CONFIRMED | FIXED — the nearest check's height; Q-3 |
| CH-3 | the chart's width stale after a live phone/desktop switch | major | CONFIRMED | FIXED — a callback ref (`FilmRoomFlow.jsx:64`) |
| CH-5 | instants outside the session clamped to the axis edges | minor | CONFIRMED | Q-2 |
| CH-6 | a scored check after the close drawn outside the chart | minor | CONFIRMED | FIXED — the axis widens for a scored check (N-3 narrowed it) |
| DR-1 | the first change of day on the front painted the tape layout and destroyed the focused chip | major | CONFIRMED | FIXED — the front's frame while the day is read; keyed header children |
| DR-2 | a depth tab on a no-tape page reached from the front lost the front | major | CONFIRMED | FIXED |
| DR-3 / OP-4 | the first-open notice used up by the front | major | CONFIRMED | FIXED — marked once shown on a settled tape; flow off as before (N-1b); Q-12 |
| DR-4 / OP-1 | the series read on the front after the Deep dive and "Game flow" | major | CONFIRMED | FIXED — `useSeriesDay` off while the front shows |
| DR-5 | "Game flow" on a no-tape day only relabels; pressed while loading, the door's focus lost | minor | part 1 REFUTED (§10: that day's front is the no-tape page); part 2 CONFIRMED | part 2 FIXED — the jump waits for the tape |
| DR-6 | a width change regroups the pins and drops a pin's or the stepper's focus | minor | CONFIRMED | not fixed: a rotation across a width; Q-11 |
| DR-7 | the late-verdict guard covered only the depth control | minor | CONFIRMED | FIXED — a click anywhere, and the keyboard (N-2), while the front's conditions are unknown |
| DR-8 | an edge pin's touch area clipped to 34 px at 320 | minor | CONFIRMED | not fixed: shifting the button would overlap its neighbour; Q-11 |
| DR-9 | a directive pin's link opens the section, not the directive | minor | CONFIRMED (spec conflict) | Q-5 |
| OP-2 | the flow asks a verdict main would not ask: cards not `'allowlist'`, and a moment-opened screen | minor | CONFIRMED | moment part FIXED; the rest Q-1 |
| OP-3 | CF-5 not behind the flow gate | minor | REFUTED (Amendment F assigns CF-5 to this build, on the cards' surface) | Q-7 asks only whether to gate it |
| OP-5 | the tape's loading layout painted before the front | minor | first open REFUTED (§2, §3); first visits CONFIRMED | first visits FIXED (DR-1) |
| TI-1 | survivors: the panel at the fallback width, one path, the front for an unwritten tape, the low label's source, "0 more", `oneDay` | major | CONFIRMED | rows added; each a mutant in §7 |
| TI-2 | F-LOW's count rule vacuous; the right-edge leave; >5 agent swaps | major | CONFIRMED | rows added |
| TI-3 | no focus assertion after a change of day; the door kept the last depth | major | CONFIRMED | rows added |
| TI-4 | the copy oracle read text nodes only | major | CONFIRMED | FIXED — attributes and instants read; self-test plants inside the panel |
| TI-5 | the narrow query and the position clamp never tested | minor | CONFIRMED | rows added |
| N-1a | the notice not marked while the verdict is pending (main marks it) | — | refuter | Q-12 |
| N-1b | the notice not marked for an owner answered no until the tape loaded | blocks (§2) | refuter | FIXED (`e2783b2b`) |
| N-2 | the DR-7 fix dropped the keyboard path | blocks | refuter | FIXED |
| N-3 | the CH-6 fix widened the axis for unscored rows | minor | refuter | FIXED |
| N-4 | an unused prop | — | refuter | removed |

**Probed and found correct** (the lenses' own lists, abridged): the margin's arithmetic on `fmtPoints`' strings (half-cents, negatives, zero crossings, ≥ 1000); the heading and Glance's ResultCard agree on a true final day; the key on a non-final day equals Glance's `score.lastCheck`; "sold at" equals Study's recorded exit; the maker words from the mechanism only; every rendered digit bound or a time; no digit in any attribute; the merge from the group's first pin; the choice of five order-proof; the CPU line only under its condition; no NaN in any path; the session axis with early closes; the swap link's `swap-n` from `swapOrdinals`; the door's id unique per screen; the back markup unchanged; `FilmRoomRoute.jsx` byte-identical to main; the verdict's cache key shared with the cards; one request at the shipped values; the F-OFF suite's paints real (2–4 distinct per case, the verdict held to the last).

## 9. The push and the Tests run

- **PR:** [fashraf94/TradeSeven#1102](https://github.com/fashraf94/TradeSeven/pull/1102), opened as a draft and marked ready for review after this report's push. **Base:** `main` at `cf35151b`. **Head:** the commit that adds this report (docs only) on top of the code head `bed627b5`.
- **The pushed head's build and the Tests run** are read once after the push, without polling, and recorded in the PR's description (BUILD_RULES §2): this report cannot hold the result of a run on its own commit.
- **Not done, by the prompt:** no merge, deploy, flip or production read or write. The founder merges after Astra's review.

## 10. Questions for a ruling

None blocks the build; each records a reading this build took where the spec or the prompt left a choice.

1. **Q-1 — the flow's own verdict ask when the cards do not ask.** At the shipped values (cards `'allowlist'`) the flow reads the cards' one cached verdict and adds no request. With cards `'off'` (a rollback) or `'on'` (the cards' next runway step) and the flow `'allowlist'`, the flow asks once per owner — a request `main` would not send (§2 "with the same requests"; the review's OP-2). The page is `main`'s at every paint either way. Accept, or tie the flow's ask to the cards' mode?
2. **Q-2 — pins outside the session.** A directive filed the evening before, or after the close, sits at the axis's edge (its fact line names its date) and can merge with a pin there (CH-5). Alternative: leave such pins off the chart and count them in "n more".
3. **Q-3 — a pin in a break of the line** takes the nearest check's height, never one interpolated across the break (CH-2: §6's "interpolated between the neighbouring checks" against FL-7's "nothing joined across"). Confirm the reading.
4. **Q-4 — "Won by 0" / "Lost by 0"** when the two displayed finals are equal (NUM-2): §4.1's letter. Show "Draw", or the result with no margin?
5. **Q-5 — a directive pin's link** opens Study at the `#directives` section, focused: Study is fenced and has no per-directive anchor (DR-9). An anchor per directive card would be a Study change for a later build.
6. **Q-6 — clocks on the fact line** go through `etWhen` (`etClock`, with the date when the filing fell on another day — "Sep 22, 8:30 PM"), so an evening-before directive never reads as this day's. FL-13 names `etClock`.
7. **Q-7 — CF-5.** (a) Built in My cards (once under "Adopted", none on its rows); the "Your cards, latest first" digest keeps its per-line sentence (CD-17), and the receipt's chain its own. Should CF-5 have removed the digest's too? (b) CF-5 is not behind the flow gate (OP-3, refuted as a defect: Amendment F assigns it to this build on the cards' surface). No card reaches `installed` before the Practice Field's T3.
8. **Q-8 — the low mark is the lowest CHECK** (§5); on a final day a lower final value can end the line below it (NUM-7).
9. **Q-9 — a final day with no recorded final total** shows "Final —" and "You —" while the line ends at the last check (NUM-4), §4's letter.
10. **Q-10 — rows the chart cannot place and no pin.** With swap or directive rows that hold no instant and nothing placeable, the panel's place says "{n} more on the full tape" instead of §7's "Nothing stood out in this game." (NUM-3), which would contradict the count.
11. **Q-11 — two touch details left as they are.** An edge pin at 320 keeps 34 px of its 44 px touch area on screen (DR-8: shifting the button inward would overlap its neighbour), and a width change that regroups the pins (a rotation) drops a focused pin's focus (DR-6). Accept for D1?
12. **Q-12 — the first-open notice.** It renders only on the tape (§4) and is marked seen once it has shown on a settled tape — at the first paint where the flow is off for the owner, as before. A viewer who leaves while an `'allowlist'` verdict is still pending sees it again next time (N-1a); a viewer who only ever sees the front never sees it. Confirm.
13. **Q-13 — a rejected `openAt`** (another battle, or a date that is not one of the battle's days) still counts as "opened at a moment": the screen opens on the tape (§3's "`openAt` is null").
14. **Q-14 — the five pinned suites.** Four existing suites gained one `FILM_ROOM_FLOW_MODE` `'off'` getter; `FilmRoomSubjectLine.jsdom` had no flag mock and gained a seven-line block. No assertion changed (§6). Confirm this is within the fences.
