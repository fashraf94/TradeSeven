# Build report — Film Room D1: the game's flow

**Executor:** Claude Code (Opus 5.5), Nov 20–21, 2026. **Branch:** `claude/film-room-d1-flow`, cut from `origin/main` `cf35151b` (it holds `41c04cd2` and Film Room C2's `api/_utils/filmRoom/momentExcerpt.js`). `git fetch origin` was the session's first git step and was repeated before the final checks and before the push; `origin/main` had not moved, so the branch tip IS the tree merged with current `origin/main`. **PR:** [fashraf94/TradeSeven#1102](https://github.com/fashraf94/TradeSeven/pull/1102). **Head:** the commit adding this report; code head `bed627b5`. **The fix round** (Astra's D1 review, Build D Amendments A and B): §11 — code head `07a42cb6`.
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

## 11. The fix round (Nov 21, 2026)

**Executor:** Claude Code (Opus 5.5), the D1 session. **Prompt:** "Fix prompt — Film Room D1: Astra's review, with Build D Amendments A and B" (the Film Room chat, Nov 21). **Base:** `368dc113`, the head Astra reviewed. `git fetch origin` was the round's first git step and was repeated before the final checks and before the push: `origin/main` stayed `cf35151b`, already in the branch, so no merge was needed and the branch tip is the tree merged with current `origin/main`. PR [fashraf94/TradeSeven#1102](https://github.com/fashraf94/TradeSeven/pull/1102) was marked draft for the round and ready at its end. **Code head:** `07a42cb6`; **head:** the commit adding this section.
**Governing:** Astra's D1 review (`docs/audits/20261121_ASTRA_REVIEW_FILM_ROOM_D1_FLOW.md`), Build D Amendment A (`docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_A_20261121.md`) and Amendment B (`docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_B_20261121.md`) — all three committed verbatim in B0 — and the spec. Amendment B governs where it differs from Astra's proposals.

### 11.1 Verdict

| | |
|---|---|
| **The round** | B0, the eight items, one commit each with their rows, then the tail's corrections and the review's fixes (§11.12). F1 to F12 closed; DA-4, DA-8, DA-9, DA-11, DA-15, DA-16 and DB-1 to DB-14 built. Nothing else. |
| **The reproductions** | Written before any code change and run in an LF archive of `368dc113`: every F1–F12 row failed there on its own assertion — 24 in the first run; the committed files, run there again at the end, 26 (they add F2's and F8's rows on the front) — and the 5 controls marked "passes at both heads" passed (§11.2). |
| **Off is off (criterion 1)** | The twelve goldens pass unedited. Lens A's own main-against-head differential (180 records per tree) matches `main` on every channel under `'off'`; under `'allowlist'` the differences are DA-1's request and DA-12's control, and the two it found (FRA-1, FRA-2) are fixed. The Quotation default is byte-identical at every existing call site (§11.6). |
| **Criteria 2–8** | No new read. Every number bound: the margin only with both finals in the key and apart in display; the final day only on evidence; strict instants only — the same bytes give the same front in `TZ=UTC` and `TZ=America/Chicago`; no chart without a time basis; a single check a dot; a break's height from its checks; the low counting the final. |
| **Doors, focus, pins (criteria 9–10)** | Real Edge: a press, Space, Enter or Tab before the verdict lands keeps the tape and its activation runs once; an untouched page opens the front. Edge pins wholly inside the page at 280, 320, 390 and 1440, every target hit at both edges, no overlap (§11.5). "Game flow" only where there is a front; a delayed return keeps the player's focus. |
| **Fences (criterion 11)** | Held. `FilmRoomKit.jsx`: one optional prop (`preview`) and its style constant (Q-10); omitted, every existing use byte for byte as before — proven across trees, and a planted default caught (§11.6). |
| **Merged tree (criterion 12)** | Green on Linux at the code head `07a42cb6`, the merged tree: the full suite 1,596 files passed, 13 skipped, **0 failing** (36,656 tests); the flow's suites under `TZ=America/Chicago` 12 / 12 files (276 tests); the rules suite 839 / 839; `lint:gate` and `vite build` exit 0 (§11.8). |
| **Review** | BUILD_RULES §2 in full: four lenses + the real-browser lens, one refuter — 13 findings, all CONFIRMED (two narrowed), none refuted; every defect fixed with a row and a revert mutant; four left as questions (§11.9). |
| **Mutants** | **53 / 53 killed** — the thirteen the prompt names, a revert of each fix split into its parts, and the review's — in four LF archive trees of the frozen code head, judged by exit code and a fresh JSON report, every tree restored byte for byte (§11.10). |
| **Questions** | 12, none blocking (§11.11). |

### 11.2 Astra's findings, F1 to F12

Each reproduction was written before any code change and run in an LF `git archive` of `368dc113` (the committed rows were run there again at the end; the three files load there and every F row fails on its own assertion, never a load error or a TypeError). "Fails at 368dc113 on" quotes that run. Every row passes at the head, on Windows and on Linux in both `TZ=UTC` and `TZ=America/Chicago`. Files: `M` = `filmRoomFlow.fixround.test.js`, `J` = `FilmRoomFlow.fixround.jsdom.test.jsx`, `S` = `FilmRoomFlow.screen.fixround.jsdom.test.jsx` (all in `src/screens/filmRoomV2/`).

| Finding | Closed | The row that failed at `368dc113` and passes now — what it failed on there | Mutant |
|---|---|---|---|
| **F1** a margin from a hidden opponent | Closed (DB-1) | `M` "F1: a tape written before Build B1…" — the heading's margin `{ value: 46 … }`, expected none. `J` "F1: the Sep 23 tape as written before Build B1…" — "Won by 46", expected "Won". `J` "F1, the harness…" — the sweep returned no defect for a margin beside one key binding | N1-margin-hidden-opponent, R1-harness-raw-opponent |
| **F2** an unknown final day treated as confirmed | Closed (DB-2) | `M` "F2: isFinalDay null, a completion on the NEXT day…" — heading `won`, expected the date. `J` "F2: isFinalDay null with a later completion…" — "Won by 60", expected "Wed, Sep 23, 2026" | N1-null-final, R1-legacy-no-evidence |
| **F3** the first-open mark lost | Closed (DB-3) | `S` "F3: opened at a VALID moment…", "…REJECTED moment…", "'Got it'… DENIED", "…FAILS", "…TIMES OUT" — each: `hasSeenFirstOpen` false, expected true. DA-12's control passes at both heads | R6-moment-unmarked, N6-dismiss-unmarked |
| **F4** admission swallows an activation | Closed (DB-4) | `S` "F4: a POINTER-DOWN…", "…SPACE key-down…", "…FOCUS move…" — each: the front had replaced the tape. The untouched page's admission passes at both heads. Real browser: §11.5 | N6-click-only-guard, R6-no-pointer-guard, R6-no-key-guard, R6-no-focus-guard |
| **F5** day counts labelled "This game" | Closed (DB-5) | `S` "F5: a battle without its trading-day list and a final tape of day 3…" — "This game", expected "This day" | N8-day-picker-count |
| **F6** the viewer's zone moves a pin | Closed (DB-6) | `M` "F6: the directive with no zone is never placed…" — `['directive:0', 'directive:1']`, expected `['directive:1']`. `M` "F6: the same bytes under TZ=UTC and TZ=America/Chicago…" — the two zones' pins, clocks and groups differed (the control: the offset did change, 0 → 300) | N2-date-parse |
| **F7** singleton paths draw through a gap | Closed (DB-7) | `J` "F7: scores 8 / missing / 8…" — four drawn spans crossed the missing instant, expected none | N3-singleton-path, R3-round-caps-you, R3-round-caps-cpu |
| **F8** the unknown-session fallback | Closed (DB-8) | `M` "F8: one check at 10:15 AM ET on a date the calendar does not know…" — a domain `{ startMs … }`, expected none. `M` "F8: no checks, two directives three hours apart…" — two pins at the origin, expected none. `J` "F8 on the front…" — a chart block, expected none | R2-one-instant-basis, R2-pins-without-basis |
| **F9** two placement edge cases | Case 1 closed (DB-9); case 2 is DA-2 as clarified, not a defect | `M` "F9, case 1 (DA-3)…" — the pin at +5, expected +80. `M` "F9, case 2 — DA-2 as clarified…" passes at both heads (the 4:10 PM directive at 400/420 of the drawn axis) and kills the "clamped to the session's edge" mutant | N3-final-in-break; case 2's row kills N3-clamp-session-edge |
| **F10** "Game flow" leads to the same no-tape page | Closed (DB-10) | `S` "F10: front → tape → a day with NO tape…" and "…whose read FAILS…" — "‹ Game flow", expected "‹ Dashboard". The pending-return guard passes at both heads | N7-game-flow-no-tape |
| **F11** a delayed return takes focus | Closed (DB-11) | `S` "F11: 'Game flow' pressed while a written day is read, then the player focuses a day chip…" — the door took the focus. The other ending passes at both heads | R7-door-jump-unguarded |
| **F12** a refreshed owner inherits an answer | Closed (DB-12) | `S` "F12: the same mounted battle id, its owner refreshed from A to B…" and "…a missing owner, then a known one…" — the front stood on the old answer | N6-answer-battle-only |

### 11.3 The code rulings

Lines are at the code head `07a42cb6`; `M`, `J`, `S` as in §11.2. Mutant ids are §11.10's.

| Ruling | Built | Rows | Mutants |
|---|---|---|---|
| **DA-4** equal displayed finals: no margin | `headingOf` (`filmRoomFlow.js:131`): a margin only when the two key values' displayed hundredths differ — so +0 and −0 agree; "Won" / "Lost" otherwise (`FilmRoomFlow.jsx:287`; copy `flow.heading.wonAlone`, `lostAlone`, `filmRoomCopy.js:480`) | `M` "item 1 — DA-4" (3); `J` "DA-4 on the front" (5 states: the result word, both key bindings, no margin node); `J` "the harness: a margin over two finals that DISPLAY equal is a defect" | R1-da4-won-by-zero |
| **DA-8** the low counts the drawn final | `lowOf` (`filmRoomFlow.js:258`): the drawn player final takes part in the minimum on displayed hundredths (a tie suppresses), never in the count of three; above it, the earliest tied check | `M` "item 3 — DA-8" (5: below, equal, displaying equal, above with a clear label, two checks); the F-LOW row re-pinned (§11.7) | R3-da8-final-ignored, R3-da8-final-counted, R3-da8-tie-shown |
| **DA-9** no recorded final total: any other day | `readsAsFinal` (`filmRoomFlow.js:92`) — one decision for the heading, the key, both lines' endings (`headingOf`, `keyOf`, `linesOf`) and the harness | `M` "item 1 — DA-9" (4); `J` "DA-9: the player's final unrecorded…" | R1-da9-no-total |
| **DA-11** one inset x-range | `FLOW_AXIS_INSET`, `axisX` (`filmRoomFlow.js:46`, `:48`); `groupPins` (`:368`) and `layoutOf`'s x (`:522`) on it; the front computes ONE layout and the panel steps through its groups (`FilmRoomFlow.jsx:403`–`:404`); the axis's labels padded by the inset (`:415`) | `J` "item 4 — DA-11" (edges at 256/296/350/639, the shared range, 43.5 and 44.5 px apart walked in the panel, a measured width that is not the first paint's); `M` "item 4" (the range, the merge at exactly 44 px, first and last); F-FIXTURE re-pinned (§11.4) | R4-no-inset, R4-groups-off-range, N4-two-groupings, R4-axis-labels-unpadded |
| **DA-15** the range "2–4" | `pinLabel` (`FilmRoomFlow.jsx:146`): the first and last members' bound ordinals and `flow.range` (`filmRoomCopy.js:496`), each ordinal naming its member; `PinMark`'s widened mark (`:99`, `:105`: a pill, or a lozenge for a directive group) inside the unchanged 44 px button; the harness's ordinal oracle reads each ordinal's member (`__fixtures__/filmRoomHarness.jsx:878`) | `J` "item 4 — DA-15" (5); the browser's hit tests (§11.5) | R4-plus-label, R4-harness-first-member |
| **DA-16** attribution hidden visually | `Quotation`'s `preview` (`FilmRoomKit.jsx:291`, `:292`, `:317`); the front sets it (`FilmRoomFlow.jsx:331`) | `J` "item 5" (attribution a direct child, intact, 1 × 1 px; the oracle still bites); the kit rows; the browser's accessibility tree (§11.5); the byte proof (§11.6) | N5-default-preview, R5-attribution-visible, R5-front-no-preview |
| **DB-1** a margin needs both finals in the key | `headingOf`: `key.you && key.cpu` (`filmRoomFlow.js:137`); the harness's margin oracle requires both bindings (`filmRoomHarness.jsx:871`) | F1's rows; `M` "an unknown basis…", "the result recorded, the opponent's final not…" | N1-margin-hidden-opponent, R1-harness-raw-opponent |
| **DB-2** final only on evidence | `isFinalDayOf(tape, battle)` (`filmRoomFlow.js:79`); the battle document reaches the front (`FilmRoomScreenV2.jsx:515`, `FilmRoomFlow.jsx:392`) and the harness (`docs.battle`) | F2's rows; `M` "the four readings", "NO isFinalDay field…"; the review's FRD-1 rows through the front, the shell and the harness | N1-null-final, R1-legacy-no-evidence, R1-true-needs-completed, R1-harness-own-predicate, V-FRD1-front-drops-battle, V-FRD1-screen-drops-battle, V-FRD1-harness-drops-battle, V-FRD2-timeline-unvalidated |
| **DB-3** the first-open mark | `noticeShown` adds a moment entry and a tape the viewer is on (`FilmRoomScreenV2.jsx:322`); "Got it" marks a notice the paint has not (`:324`, `:564`); an id-less battle reads as flow-off (`:321`) | F3's rows; DA-12's control; "DB-3 under 'off'" (one write, as main), the admitted dismissal, the throwing storage; the review's FRA-1 and FRA-2 rows | R6-moment-unmarked, N6-dismiss-unmarked, R6-dismiss-writes-twice, V-FRA1-held-tape-unmarked, V-FRA2-idless-unmarked |
| **DB-4** a gesture in progress keeps the tape | `onPointerDownCapture`, `onKeyDownCapture`, `onFocusCapture` on the tape's root (`FilmRoomScreenV2.jsx:531`) replacing the click guard; `seenFront` per battle and owner (`:294`–`:296`) | F4's rows; the untouched admission; "DB-4: the gesture held from its pointer-down…", "…after the front has shown"; the review's FRC-1 row and its control; the browser (§11.5) | N6-click-only-guard, R6-no-pointer-guard, R6-no-key-guard, R6-no-focus-guard, V-FRC1-seen-any-owner |
| **DB-5** "This game" for a known one-day battle | `oneDay={parts.length?.days === 1}` (`FilmRoomScreenV2.jsx:517`: `headerParts`' length) | F5; "item 8 — DB-5…" (unknown length, a confirmed one-day battle both ways, three days) | N8-day-picker-count |
| **DB-6** strict instants only | `const toMs = instantMs` (`filmRoomFlow.js:32`) for checks, swaps and directives; the panel's clocks only from strict instants; the harness's `flowMs` (`filmRoomHarness.jsx:807`) | F6's rows; `M` "item 2 — DB-6" (the forms kept, the forms refused, a zoneless check breaks its line, two zones); `J` the front in two zones; `J` the harness's zoneless low | N2-date-parse, R2-harness-date-parse |
| **DB-7** a single scored check is a point | `LineRuns` (`FilmRoomFlow.jsx:190`): a run whose points coincide is a dot; butt caps (`LINE`, `:178`) | F7; "a fifteen-minute break on the narrowest chart…", "an isolated final point is drawn once…"; the review's FRB-1 rows | N3-singleton-path, R3-round-caps-you, R3-round-caps-cpu, V-FRB1-zero-length-path |
| **DB-8** no time basis, no chart | `domainOf` needs two distinct strict check instants without a session (`filmRoomFlow.js:205`); no pin without a domain (`:347`); no chart block (`FilmRoomFlow.jsx:411`) | F8's rows; `M` "item 2 — DB-8" (zero, one, several at one instant × with and without events; two instants; the final day there; a known session with no checks); `J` the front, phone and desktop | R2-one-instant-basis, R2-pins-without-basis |
| **DB-9** placement made exact | `heightAt` (`filmRoomFlow.js:281`): in a break, the nearest check from the check rows (`:295`); DA-2 as clarified (`:354`, unchanged) | F9's two rows; `M` "item 3 — DB-9" (within a run, before the open, `heightAt` in and out of a break) | N3-final-in-break, N3-clamp-session-edge |
| **DB-10** "Game flow" only where there is a front | `backHere` (`FilmRoomScreenV2.jsx:445`): a written or still-read day, the flow not off for the owner | F10's rows and guard; "DB-10: a day whose tape document holds no written day…", "back on the written day…"; the review's FRC-2 row | N7-game-flow-no-tape, R7-game-flow-not-while-read, V-FRC2-denied-game-flow |
| **DB-11** the delayed return keeps focus | `backToFront`'s jump carries `from: focusedNow()` (`FilmRoomScreenV2.jsx:441`) | F11 and its other ending | R7-door-jump-unguarded |
| **DB-12** the answer per battle and owner | `flowAnswer` holds the owner it was asked for; `flowVerdict` matches both (`FilmRoomScreenV2.jsx:281`) | F12's rows; "DB-12: owner A's answer arriving AFTER the refresh…" | N6-answer-battle-only |
| **DB-13** no disclosure on the front | `preview` drops "Read more" / "Show less" (`FilmRoomKit.jsx:316`); the copy sweep's exemption narrowed to the quoted text and its attribution (`filmRoomHarness.jsx:985`) | `J` "item 5" (a long quotation clamped with no control; a planted "Read more" named); the browser (§11.5) | R5-disclosure-kept, R5-harness-exempt-all |
| **DB-14** Amendment A as Astra qualified it | DA-4, DA-8, DA-9, DA-11, DA-15, DA-16 — the rows above | — | — |

### 11.4 F-FIXTURE, re-pinned after items 4 and 5

Item 5 moves no pin. Item 4's inset does: every pin now sits on the one x-range x = 22 + frac · (W − 44) (DA-11). The groups below were derived by hand from the instants before the rows were re-pinned (12:45:08 PM swap, 1:40 PM directive, 2:00:05 PM agent's swap, 2:20 PM and 2:50 PM directives; the session 9:30 AM – 4:00 PM, 390 minutes):

| Chart (viewport) | Before (368dc113) | After | What moved, and why |
|---|---|---|---|
| 350 px (390) | `1` · `2+` (2, 3, 4) · `5` | `1–2` (1, 2) · `3–5` (3, 4, 5) | The 12:45 PM swap (x 175.10) and the 1:40 PM directive (x 218.15) are now 43.05 px apart — closer than 44 — so they merge; the agent's swap (x 233.91) is 58.8 px from the group's first and starts the next, which holds 4 and 5. The agent's swap still opens selected, now first in its group. |
| 296 px (320) | `1+` (1, 2) · `3+` (3, 4, 5) | `1–2` · `3–5` | Membership unchanged; the labels are DA-15's ranges. |
| 639 px (1440) | `1` · `2+` (2, 3) · `4` · `5` | `1` · `2–3` · `4` · `5` | Membership unchanged. |
| 256 px (280, measured in Edge only) | — | `1–3` · `4–5` | Not a pinned width before; recorded from the browser check (§11.5). |

**The Sep 23 low mark now draws at 390.** At 350 px its label "Low −92 · 1:30 PM" sat under the old `2+` group (the 1:40 PM directive at −91.6, drawn beside the low). That directive now belongs to the `1–2` group, drawn at the 12:45 PM swap's height (−55), so no touch area reaches the label and §5's rule draws it. Edge measured the label's real box (Segoe UI) at 390: it intersects no pin's box. It stays out at 320 and on the desktop, where it still sits under a pin's touch area. Amendment A's backlog line ("the low mark doesn't appear on the Sep 23 fixture at any of the three widths") is now true at two of the three; see Q-6.

### 11.5 The browser checks

**Platform:** Microsoft Edge 157.0.4341.60, headless Chromium, through playwright-core 1.61.1, on Windows 11 (10.0.26200). The page: the real `FilmRoomScreenV2` at the round's head, served by vite from an LF archive with placeholder Firebase settings, `FILM_ROOM_FLOW_MODE` as merged (`'allowlist'`), the verdict held or answered by the page (scratch fixture, not committed).

| Check | Sequence | Result |
|---|---|---|
| F4 / DB-4, pointer | Verdict held; pointer down on Study; admit; pointer up | The tape stays; Study opens once (one click on Study); focus on Study |
| F4 / DB-4, Space | Verdict held; focus Study; Space down; admit; Space up | The tape stays; Study opens once; focus on Study |
| F4 / DB-4, Enter | Verdict held; focus Study; Enter; admit | The tape stays; Study opened once; focus on Study |
| F4 / DB-4, Tab | Verdict held; Tab onto a tape control (the second Tab reaches the Glance tab); admit | The tape stays; nothing activated; focus kept |
| F4 / DB-4, untouched | Verdict held; no input; admit | The front opens (the focus guard needs no exclusion: the screen focuses nothing on an untouched page) |
| DA-11, edges | A directive filed the evening before and one after the close, at 280, 320, 390, 1440 | Both edge pins wholly inside the viewport: 280 → 12–56 and 224–268; 320 → 12–56 and 264–308; 390 → 20–64 and 326–370; 1440 → 200–244 and 795–839. `elementFromPoint` 0.5 px inside each button's left and right edges, and at its centre, lands on the button: 24 / 24 |
| DA-15, marks | Sep 23 at 280, 320, 390, 1440 | Merged marks 34 × 22 px (36 × 24 selected), each hit at 1 px inside both of its own edges; no two buttons overlap at any width; lone marks 22 × 22 |
| DB-13, front | A long directive and reply (558 px and 349 px of text) on the front at 390 | Each clamped at three lines (70 px shown), no button inside either quotation |
| DB-13, tape | The same tape, the flow answered no, Study | The tape's quotations keep "Read more" (eight of them) |
| DA-16 | The front's accessibility tree (CDP `Accessibility.getFullAXTree`) | "the player" and "the agent" are both named; each attribution 1 × 1 px on screen, its text "— the player · 1:40 PM" / "— the agent · 1:40 PM" intact |
| The low at 390 | Sep 23 | "Low −92 · 1:30 PM" drawn, its box over no pin; none at 280, 320, 1440 |

### 11.6 Fences

Diff `368dc113..` the head, by path: `docs/README.md`, the three B0 documents, and under `src/screens/filmRoomV2/`: `filmRoomFlow.js`, `FilmRoomFlow.jsx`, `FilmRoomScreenV2.jsx`, `filmRoomCopy.js`, `FilmRoomKit.jsx` (the one allowance), `__fixtures__/filmRoomHarness.jsx` (the harness, as in D1), and tests. Nothing under `api/`; no rules, index, `vercel.json` or package file; none of the seven named screen files (`FilmRoomGlance.jsx`, `FilmRoomStudy.jsx`, `FilmRoomDeepDive.jsx`, `FilmRoomCheckDetail.jsx`, `FilmRoomRoute.jsx`, `filmRoomData.js`, `filmRoomCards.js`); not the hub or the Practice Field; no golden and no fixture (the `__fixtures__` change is the harness alone, its self-test's one count); no BUILD_RULES §1 file; no new dependency.

**`FilmRoomKit.jsx`: one optional prop, byte for byte.** `Quotation` gains `preview` (default `false`) and the module constant `VISUALLY_HIDDEN` that the prop's style uses (Q-8). The diff touches the signature, the disclosure's condition (`lines && !preview && …`) and the attribution's style (`preview ? { …, …VISUALLY_HIDDEN } : <the same expression as before>`). The proof on every existing call site's serialized markup: the real parents of every existing `<Quotation>` — `FilmRoomGlance` (phone and desktop: the platform's words), `FilmRoomStudy` (phone, desktop, and with everything expanded: 42 quotations — directives, replies, meeting diagnoses, plans, rationale), and a card `Receipt` whose chain quotes a deferral's reason, an acceptance's thesis and a result's closing note beside the card's note (four quotations: the three ledger call sites, the nomination line twice) — each mounted once with every clamp measuring short and once measuring long (so "Read more" renders: 16 in Study), React ids renumbered, SHA-256 of each parent's `innerHTML`. Run in an LF archive of `62e4243b` (the tree before item 5) and of the head: **12 / 12 identical.** The control: the same run with the default planted as `preview = true` differs in **12 / 12**. In the head tree, a row per existing call site's props also pins `preview` omitted and `preview={false}` to identical markup (`FilmRoomFlow.fixround.jsdom.test.jsx`, "the kit's Quotation").

### 11.7 Existing assertions the round changed

No assertion was loosened to pass; each change is a ruling's, and the review's tests lens (D) checked each against the diff and found none weakening a guard.

| Suite · row | Change | Ruling |
|---|---|---|
| `FilmRoomFlow.jsdom` F-FIXTURE at 390, at 320; the pins' names; the tap and stepper row; the pin-link row; CH-3 | The groups `1–2` / `3–5` (§11.4); the low now drawn at 390 (exact text); at 320 the narrow layout emulated (its 112 px chart), the low out; a lone pin's no-stepper case moved to 639; the directive reached by the stepper where pin 5 was its own button | DA-11, DA-15 |
| `FilmRoomFlow.jsdom` "the chart draws the tape's lines" | The final dot at 328 (350 − 22), not 350 | DA-11 |
| `FilmRoomFlow.jsdom` F-COPY's earlier day; `filmRoomFlow.test.js` the earlier day, F-LOW's helper, CH-2, the tests' gaps helper | `isFinalDay: false` beside the active battle block — an earlier day as the writer records one; DB-2's letter makes `isFinalDay: true` the final day whatever the block's status (Q-1) | DB-2 |
| `filmRoomFlow.test.js` "draw, and the anything else rows" | A recorded result with no opponent final: `{ won, margin: null }`, not "Final {total}" (Q-2); no recorded final total: the date; a pending result: the whole `final` object (stronger) | DB-1, DA-9 |
| `filmRoomFlow.test.js` NUM-1 / CH-4 | `isFinalDay: null` is any other day (was final) | DB-2 (F2) |
| `filmRoomFlow.test.js` F-LOW "the low as the line's last point" | The final day's final raised above the low (+5): the −47 final would now be the line's lowest end | DA-8 |
| `filmRoomFlow.test.js` the groups at 390 / 320; the low at three widths; the chain of close pins; the opening pin's group; M05; M28 | The inset range: 390's groups; the low drawn at 390 and out at 320 and 639 (adds 639 and `leaves`); the chain on a 1044 px chart (its 1,000 px range), exactly 44 px on a 128 px range; `3–5`; M05's low moved to 3:30 PM so its label still passes the axis's end; M28's edge at 22 | DA-11 |
| `filmRoomFlow.test.js` the dependency surface | The imports gain `tapeSchedule.js` and `filmRoomSubject.js` (both Node-clean; the screen already bundles the second) | DB-2, DB-6 |
| `FilmRoomFlow.screen.jsdom` DR-7; "a verdict that lands after the player has used the depth control" | The press is a pointer-down, then its click — as a browser sends it (a bare click no longer holds, Q-4) | DB-4 |
| `FilmRoomFlow.screen.jsdom` "a swap pin's link…" | The directive reached by the stepper | DA-11 |
| `filmRoomCopy.inventory` | 457 keys, 607 entries (+`flow.heading.wonAlone`, `lostAlone`; `flow.plus` renamed `flow.range`); §11's composition with "Won", "Lost" and `{first}–{last}` | DA-4, DA-15 |
| `__fixtures__/filmRoomHarness.flow` | `SPEC_FLOW_COPY` 41 entries ("Won", "Lost"; "+" → "–") | DA-4, DA-15 |

### 11.8 The checks and the Tests run

All on the code head `07a42cb6`, which is the tree merged with current `origin/main` (`cf35151b`, unmoved). Linux: a worktree of the WSL clone (WSL2 Ubuntu, Node 20.20.2, the lock `e457c10d0317`), one full suite at a time under `flock`.

| Check | Result |
|---|---|
| Full suite, Linux, `TZ=UTC`, `--maxWorkers=8` | **1,596 files passed, 13 skipped, 0 failing** — 36,656 tests passed, 179 skipped, 0 failed (315.9 s) |
| The flow's suites, Linux, `TZ=America/Chicago` (offset 300 confirmed) | **12 / 12 files**, 276 / 276 tests |
| Rules suite (`npm run test:rules`, Temurin 21) | **46 files, 839 / 839** (184.0 s) |
| `lint:gate` | exit 0 |
| `vite build` (the pushed head) | exit 0 at the code head (17.3 s; only the long-standing chunk-size warning). The pushed head adds this section alone; it is built again before the push and reported with the Tests run |
| Windows, the Film Room folder + the gate and flag suites | 950 passed, 0 failed (before the battery) |
| The early run at `3694148b` (before the review) | Linux suite 1,596 files passed, 13 skipped, 0 failed (36,643 tests); the flow's suites under Chicago 12 / 12 |
| Tests run (GitHub Actions, read once after the push) | Read once after the push and reported in the session's handoff — this section is committed before the push |

### 11.9 The review (BUILD_RULES §2)

**Which rule applied.** The round's own diff (`368dc113..` the code head) is 18 files and about 2,300 lines, past both thresholds, so the full §2 review ran: multi-lens and adversarial, every finding handed to a refuter, on snapshot trees (one LF `git archive` per reviewer, `node_modules` junctioned, read-only on git and on the working tree), with an explicit `vite build` (§11.8) and the mutant battery (§11.10).

**Lenses** (each its own tree of `3694148b`; finding ids FRA–FRD, unused by D1's review):

| Lens | Scope | Findings |
|---|---|---|
| A — the off path and storage | Its own main-against-head differential: one probe file, unchanged in LF trees of `main` and the head, 9 cases (one-day and multi-day traversal, a day change, a valid and a rejected moment link, dismissal, a remount, throwing storage, an id-less battle) × 10 flow configurations × 2 cards modes = 180 records per tree: the DOM at every commit (ids renumbered), focus, reads, verdict calls and requests, every storage write and attempt | Under `'off'`, 18 / 18 records match `main` on every channel (one same-commit ordering of the mark and the first read, unobservable). Under `'allowlist'`: focus and reads match everywhere; the verdict differs only by DA-1 (no extra request at the shipped cards `'allowlist'`); storage differs only by the declared DA-12 control, the timings DB-3 makes, and FRA-1, FRA-2. The goldens pass unedited |
| B — the picture | Hand-built and writer-built tapes, every probe in its own run under `TZ=UTC` and `TZ=America/Chicago`; the Sep 23 groups re-derived by hand | The rulings hold in both zones; its derived groups equal the rendered ones; FRB-1 – FRB-4 |
| C — the shell's state and doors | DB-3, DB-4, DB-5, DB-10, DB-11, DB-12 and their interactions (owner refresh, the front's frame, moment links, delayed returns, programmatic focus) | FRC-1 – FRC-3 and two questions; no self-triggered hold (the screen focuses nothing on an untouched page) |
| D — the tests' integrity | Every changed existing assertion against its ruling; the F rows run again in its own `368dc113` archive; suspect rows mutated; each harness change reverted | No changed assertion weakens a guard (its table matches §11.7); every F row fails at `368dc113` on its own line; FRD-1 – FRD-4 |
| Real browser (the coordinator) | §11.5 | No finding beyond FRB-2, which it also showed |

**The refuter** (its own tree of `01096bea`; the head-before-the-round screen swapped in by hash to test "new" claims; mutants one at a time over the 41-file Film Room set, unmutated 914 passed / 2 skipped) refuted none: every finding CONFIRMED, two narrowed.

| Id | Severity | Finding | Verdict | Disposition |
|---|---|---|---|---|
| FRA-1 = FRC-3 | minor | A tape held by a DB-4 gesture and left while the `'allowlist'` verdict is pending was never marked — a second storage difference from `main` beyond DA-12's "without interacting" (also at `368dc113`) | CONFIRMED (found by two lenses) | Fixed: a tape the viewer is on is settled — Astra's F3 proposal, adopted by Amendment B §0. Rows: press then leave; focus then leave; the back control while pending. Mutant V-FRA1 |
| FRA-2 | nit | Under `'allowlist'`, a battle with no id is never asked about and its notice was never marked (also at `368dc113`) | CONFIRMED | Fixed: the flow is off for it. Row; mutant V-FRA2 |
| FRB-1 | minor | Two scored checks at one instant with one value: a zero-length path that butt caps paint nothing for — the scores vanished (a regression of DB-7's caps) | CONFIRMED | Fixed: a run whose points coincide is a dot. Rows (and a control: different values keep their stroke); mutant V-FRB1 |
| FRB-2 | minor | At 390 the selected pin's drop line struck through the newly drawn low label | CONFIRMED | Fixed: the drop line stops short of the label (or starts below it). Row (both groups selected; at 639 it runs to the axis); mutant V-FRB2; the browser picture (§11.5). The overlap rule itself is unchanged — Q-6 |
| FRB-3 | nit | The swap link's anchor (`swapOrdinals`, `filmRoomModel.js`) still reads a zoneless instant with `Date.parse`; Study numbers its cards the same way, so the link lands on the right card | CONFIRMED | Not fixed here — the fix changes the tape view (outside the round): Q-9 |
| FRB-4 | nit | Ties at the low: check-to-check on raw values, the final (DA-8) on displayed hundredths | CONFIRMED, narrowed (the visible split needs scores finer than a hundredth) | Q-8 |
| FRC-1 | minor | After owner A's front, a refresh to owner B (held): the pending tape had no DB-4 guard (`seenFront` was A's) — new with DB-12 | CONFIRMED | Fixed: `seenFront` belongs to the battle and owner, as the answer does. Row and control; mutant V-FRC1 |
| FRC-2 | minor | "Game flow" stayed on a tape whose refreshed owner the flow denied; one press only relabelled it (also at `368dc113`) | CONFIRMED | Fixed: no "Game flow" where the flow is off for the owner (DB-10's "only where there is a front"). Row; mutant V-FRC2 |
| FRD-1 | major (test gap) | DB-2's legacy branch was guarded in the model only: dropping the battle from the front, the shell or the harness passed every suite | CONFIRMED | Fixed: rows through the front (with the harness handed no battle naming a defect), through the shell, and their controls. Mutants V-FRD1-front / -screen / -harness |
| FRD-2 | minor (test gap) | The "timeline that does not validate" row ended on a later day, so it could not fail without the validation | CONFIRMED | Fixed: the timeline ends on this date. Mutant V-FRD2 |
| FRD-3 | nit | DB-7's row asserts ≥ 8 px where the ruling's premise is 9 px | CONFIRMED (the premise) | Q-7 |
| FRD-4 | nits | (a) six rows pass at `368dc113` without saying so; (b) F3's timeout row answers with the timeout branch's value, not the 8 s timer; (c) the kit rows compare omitted and `false` at one head | CONFIRMED, (c) narrowed: the refuter ran the cross-tree comparison itself — 7 / 7 call sites identical | (a) the shell file's header now says some of its rows also pass at `368dc113`, and §11.2 lists the reproductions' controls; (b) the row's title says it; (c) the row's title now says what it proves, the cross-tree proof is §11.6 |
| Q-a, Q-b | — | A click with no pointer-down, key-down or focus no longer holds the tape; a touch scroll's pointer-down does | Real in the code path (refuter) | Q-4, Q-5 |

The refuter's one observation outside the list — under `'on'` (not shipped) a viewer who leaves while the day is still being read isn't marked, at both heads — is Q-11.

### 11.10 The mutants

The battery ran once, at the frozen code head `07a42cb6`: four LF `git archive` trees, `node_modules` junctioned, 53 mutants sharded across them. Each mutant's anchor had to occur exactly once in its file (checked for all 53 before the run); its suites ran under `TZ=UTC` with a fresh JSON report; KILLED needs a non-zero exit AND at least one failed test in the report (no load failure counted); each file was restored from the bytes read before the edit, and afterwards all 20 mutated files in the four trees were byte-compared with the commit: identical. **53 / 53 KILLED.** Ids: `N` the thirteen the prompt names, `R` a revert of one part of an item's fix, `V` the review's. `M`, `J`, `S` as in §11.2.

| Id | Item | Mutant (the replacement, in words) | Verdict | Failed / run | Killed by (the first failing row) |
|---|---|---|---|---|---|
| N1-null-final **(named)** | 1 | isFinalDay null read as final | KILLED | 5 / 164 | J › F2: isFinalDay null with a later completion — the date, the last check's key, no final dot |
| R1-legacy-no-evidence | 1 | the legacy branch without the validated last day | KILLED | 1 / 89 | M › NO isFinalDay field (a tape written before it): final only when the battle completed AND its validated fin |
| R1-true-needs-completed | 1 | isFinalDay true also requiring completed (the head's reading) | KILLED | 1 / 89 | M › the four readings: true is final; false and null are any other day |
| N1-margin-hidden-opponent **(named)** | 1 | a margin from battle.final when the key has no CPU entry | KILLED | 4 / 164 | J › F1: the Sep 23 tape as written before Build B1 (no score.opponentBasis) — "Won", the key "You −47" alone,  |
| R1-da4-won-by-zero | 1 | a zero margin shown ("Won by 0") | KILLED | 6 / 164 | J › the harness: a margin over two finals that DISPLAY equal is a defect too (DA-4) |
| R1-da9-no-total | 1 | a final day read as final with no recorded total | KILLED | 5 / 164 | J › DA-9: the player's final unrecorded on the final day — the date, the last check's two values, no final dot |
| R1-harness-raw-opponent | 1 | the harness's margin oracle falling back to the raw opponent | KILLED | 1 / 57 | J › F1, the harness: a margin standing beside ONE key binding is a defect — the oracle never falls back to the |
| R1-harness-own-predicate | 1 | the harness's own final-day predicate (the head's) | KILLED | 2 / 57 | J › the harness reads the model's one predicate: the final's key on that day is a defect |
| N2-date-parse **(named)** | 2 | Date.parse in place of instantMs | KILLED | 8 / 164 | J › DB-6: the front mounted from the same bytes under TZ=UTC and TZ=America/Chicago — the same pins, names, gr |
| R2-one-instant-basis | 2 | one instant as a time basis (start + 1 minute) | KILLED | 8 / 164 | J › F8 on the front: a date the calendar does not know, one check — no chart, no axis, no legend, no pin; "2 m |
| R2-pins-without-basis | 2 | pins placed with no time basis | KILLED | 7 / 164 | J › F8 on the front: a date the calendar does not know, one check — no chart, no axis, no legend, no pin; "2 m |
| R2-harness-date-parse | 2 | the harness reading instants with Date.parse | KILLED | 1 / 57 | J › a zoneless check holding the day's lowest score is no check to the front — the low is the strict −10, and  |
| N3-singleton-path **(named)** | 3 | a singleton drawn as a path | KILLED | 2 / 75 | J › F7: scores 8 / missing / 8 at 10:00, 10:01 and 10:02 AM ET, 350 px wide — no drawn path crosses the missin |
| R3-round-caps-you | 3 | round caps on the player's line | KILLED | 1 / 75 | J › a fifteen-minute break on the narrowest chart (256 px, a 280 px viewport) stays visible — each line's stro |
| R3-round-caps-cpu | 3 | round caps on the CPU's line | KILLED | 1 / 75 | J › a fifteen-minute break on the narrowest chart (256 px, a 280 px viewport) stays visible — each line's stro |
| N3-final-in-break **(named)** | 3 | the final endpoint used as the nearest check in a break | KILLED | 2 / 164 | M › F9, case 1 (DA-3): a pin in a break takes the nearest SCORED CHECK — 3:55 PM between +80 at 2:30 PM and th |
| N3-clamp-session-edge **(named)** | 3 | a pin clamped to the session's edge although the drawn axis covers it | KILLED | 1 / 164 | M › F9, case 2 — DA-2 as clarified (DB-9): a 4:30 PM scored check extends the drawn axis; a 4:10 PM directive  |
| R3-da8-final-ignored | 3 | the final ignored by the low | KILLED | 2 / 164 | M › the final below the lowest check: no mark |
| R3-da8-final-counted | 3 | the final counted toward three | KILLED | 1 / 164 | M › the final never counts toward three: two scored checks and a final above them — no mark |
| R3-da8-tie-shown | 3 | a tie with the final leaving the mark | KILLED | 1 / 164 | M › the final equal to it — or displaying equal (−5.004 shows −5) — no mark |
| R4-no-inset | 4 | no inset (FLOW_AXIS_INSET 0) | KILLED | 22 / 231 | J › at 280 (chart 256 px): both edge pins keep their whole 44 px inside the chart |
| R4-groups-off-range | 4 | the groups placed on the un-inset range | KILLED | 21 / 164 | J › at 280 (chart 256 px): both edge pins keep their whole 44 px inside the chart |
| N4-two-groupings **(named)** | 4 | the chart and the panel grouping at different widths | KILLED | 3 / 75 | J › 43.5 px apart: merged true — and the panel steps through exactly the group the chart draws |
| R4-plus-label | 4 | the merged pin labelled "n+" | KILLED | 29 / 142 | J › F1: the Sep 23 tape as written before Build B1 (no score.opponentBasis) — "Won", the key "You −47" alone,  |
| R4-axis-labels-unpadded | 4 | the axis labels not on the inset range | KILLED | 1 / 75 | J › the lines, the final dot and the drop line share the range: the final at W − 22, the axis's labels padded  |
| R4-harness-first-member | 4 | the harness's ordinal oracle ignoring each ordinal's member | KILLED | 16 / 57 | J › F1: the Sep 23 tape as written before Build B1 (no score.opponentBasis) — "Won", the key "You −47" alone,  |
| N5-default-preview **(named)** | 5 | the Quotation prop's default changing an existing use (preview = true) | KILLED | 13 / 86 | J › Glance, the platform's words: omitted and `false` serialize identically — the attribution visible, "Read m |
| R5-disclosure-kept | 5 | "Read more" kept under preview | KILLED | 1 / 75 | J › a long quotation on the front: clamped at three lines, no "Read more" or "Show less" — the pin's link is t |
| R5-attribution-visible | 5 | the attribution shown under preview | KILLED | 5 / 75 | J › each attribution stays — a direct child, its source and its instant intact — and is hidden only visually |
| R5-front-no-preview | 5 | the front without preview | KILLED | 2 / 75 | J › a long quotation on the front: clamped at three lines, no "Read more" or "Show less" — the pin's link is t |
| R5-harness-exempt-all | 5 | the copy sweep exempting the whole quotation again | KILLED | 1 / 57 | J › the copy sweep's exemption is the quoted text and its attribution only: a "Read more" inside a quotation o |
| R6-moment-unmarked | 6 | a moment entry left unmarked | KILLED | 2 / 67 | S › F3: opened at a VALID moment under 'allowlist' — the notice it shows is marked seen (that tape is settled  |
| N6-dismiss-unmarked **(named)** | 6 | the mark not written on dismissal | KILLED | 3 / 67 | S › F3: "Got it" while the verdict is on its way, then the verdict DENIED — marked seen; a remount shows no no |
| R6-dismiss-writes-twice | 6 | "Got it" writing again where the paint already marked | KILLED | 1 / 67 | S › 'off', storage that refuses every write: the first paint attempts the one write main attempts — "Got it" a |
| N6-click-only-guard **(named)** | 6 | the click-only guard restored | KILLED | 7 / 67 | S › F4: a POINTER-DOWN on Study before the verdict lands keeps the tape — the admission takes nothing from und |
| R6-no-pointer-guard | 6 | no pointer-down guard | KILLED | 8 / 67 | S › F4: a POINTER-DOWN on Study before the verdict lands keeps the tape — the admission takes nothing from und |
| R6-no-key-guard | 6 | no key-down guard | KILLED | 1 / 67 | S › F4: a SPACE key-down on Study before the verdict lands keeps the tape |
| R6-no-focus-guard | 6 | no focus guard | KILLED | 2 / 67 | S › F4: a FOCUS move onto a tape control before the verdict lands keeps the tape, and the focus |
| N6-answer-battle-only **(named)** | 6 | the flow's answer keyed by battle only | KILLED | 3 / 67 | S › F12: the same mounted battle id, its owner refreshed from A to B — the front never stands on A's answer wh |
| N7-game-flow-no-tape **(named)** | 7 | "Game flow" on a day with no tape | KILLED | 4 / 67 | S › F10: front → tape → a day with NO tape — the back control is main's ("Dashboard"), and one press leaves |
| R7-game-flow-not-while-read | 7 | no "Game flow" while the day is read | KILLED | 4 / 67 | S › F10's guard (passes at both heads): "Game flow" pressed while the day is read, then a miss — main's back c |
| R7-door-jump-unguarded | 7 | the door's deferred jump without from | KILLED | 1 / 67 | S › F11: "Game flow" pressed while a written day is read, then the player focuses a day chip — the late door n |
| N8-day-picker-count **(named)** | 8 | "This game" from the day picker's count | KILLED | 2 / 67 | S › F5: a battle without its trading-day list and a final tape of day 3 — the counts say "This day"; the tape  |
| V-FRA1-held-tape-unmarked | review | a held tape left unmarked | KILLED | 2 / 67 | S › FRA-1 / FRC-3: a press that keeps the tape while the verdict is pending, then the viewer leaves — marked ( |
| V-FRA2-idless-unmarked | review | an id-less battle left unmarked | KILLED | 1 / 67 | S › FRA-2: under 'allowlist', a battle with no id (never asked about) — the notice marked at the first paint,  |
| V-FRC1-seen-any-owner | review | seenFront for any owner | KILLED | 1 / 67 | S › FRC-1: after owner A's front, a refresh to owner B (held) — a press on the pending tape keeps it when B is |
| V-FRC2-denied-game-flow | review | "Game flow" under a denied owner | KILLED | 1 / 67 | S › FRC-2: front → tape, then the owner refreshed and DENIED — the back control is main's, and one press leave |
| V-FRB1-zero-length-path | review | coinciding points drawn as a path | KILLED | 1 / 75 | J › FRB-1: two scored checks at ONE instant with ONE value — no length to stroke, so a dot at that instant (ne |
| V-FRB2-drop-through-low | review | the drop line through the low label | KILLED | 1 / 75 | J › FRB-2: at 390 the selected pin's drop line stops short of the low mark's label — for either group selected |
| V-FRD1-front-drops-battle | review | the front not passing the battle to flowOf | KILLED | 2 / 142 | J › FRD-1: a tape written before isFinalDay existed, on its battle's validated last day — the front reads it f |
| V-FRD1-screen-drops-battle | review | the shell not passing the battle to the front | KILLED | 1 / 67 | S › FRD-1: through the shell, a tape written before isFinalDay existed, on its battle's validated last day — " |
| V-FRD1-harness-drops-battle | review | the harness ignoring docs.battle | KILLED | 1 / 57 | J › FRD-1: a tape written before isFinalDay existed, on its battle's validated last day — the front reads it f |
| V-FRD2-timeline-unvalidated | review | the raw last trading day, unvalidated | KILLED | 1 / 89 | M › NO isFinalDay field (a tape written before it): final only when the battle completed AND its validated fin |

One harness change has no killing row and needs none: `memberMs` reading through `flowMs` is equivalent — only strict instants reach a pin's members, and on those `Date.parse` and `instantMs` agree (lens D ran the revert: 79 / 79 pass).

### 11.11 Questions for a ruling

1. **DB-2's letter.** `isFinalDay: true` reads as the final day whatever the copied battle block's status; the head also required `completed`. On the writer's output the two agree — a final day taped before the completion has no `battle.final`, so DA-9 reads it as any other day — and differ only on a hand-built tape. Keep the letter?
2. **DB-1 over DA-9's note.** A recorded result whose opponent final is missing (no CPU entry in the key) reads "Won" / "Lost" / "Draw", not "Final {total}" as DA-9's note and Astra's §6 test have it. Built Amendment B's letter; "Final {total}" now appears only when the result is not recorded.
3. **DB-10 while the day is read.** "Game flow" stays while the day on screen is still being read, and while a refreshed owner's verdict is pending; it goes once the read says missing, error or unwritten, or the flow answers no. DB-10's third test and all of DB-11 assume it can be pressed while a read is held. Confirm?
4. **The click guard is gone (DB-4's "replaces").** A click with no pointer-down, key-down or focus before it — some assistive-technology activations, voice control — no longer holds the tape: the front can open under it. Restoring `onClickCapture` as a fourth trigger could only add holds. Keep the letter, or add it back?
5. **A touch scroll holds the tape.** A scroll begins with a pointer-down, so scrolling the tape before the verdict lands keeps it for the visit. Is a page that was only scrolled "untouched"?
6. **The Sep 23 low at 390.** DA-11's regroup draws "Low −92 · 1:30 PM" at 390 (Amendment A's backlog line is now true only at 320 and on the desktop). The selected pin's drop line now stops short of the label (FRB-2). Is that the treatment, or should §5's rule also leave the label out where a drop line would cross it?
7. **DB-7's premise.** At a 280 px viewport the chart is 256 px and its inset range 212 px, so fifteen minutes is 8.15 px, not "at least 9 px". The break stays visible; the row asserts ≥ 8.
8. **One rule for ties at the low (FRB-4).** DA-8 compares the final and the low on displayed hundredths; ties between checks, and an earlier day's last point, compare raw values. With scores finer than a hundredth the mark can differ between two days that display alike. Displayed hundredths for all three?
9. **The swap link's anchor (FRB-3).** `swapOrdinals` (`filmRoomModel.js`, shared with the tape's Study) still parses a zoneless swap instant with `Date.parse`, so the anchor's number can move with the viewer's zone — but Study numbers its cards the same way, so the link lands on the right card. Making it strict changes the tape view, outside this round: a later build, or a declared limit?
10. **The kit's fence.** The prop's visually-hidden style is one module constant, `VISUALLY_HIDDEN` (`FilmRoomKit.jsx:291`), beside the prop. Within "one optional prop"?
11. **`'on'` while the day is read.** Under `'on'` (not shipped), a viewer who leaves while the day is still being read isn't marked — at both heads; DR-3's "settled tape". DA-12 says `'on'` has no pending difference: declare it, or mark at the first paint under `'on'`?
12. **The writer and a zoneless timestamp (outside the fence).** Lens B observed that the tape writer (`api/`) orders a directive with a zoneless timestamp differently by its own process zone. The front reads the same bytes identically in every zone; the writer is a later build's.

### 11.12 The round's commits

| Commit | What |
|---|---|
| `68cca474` | B0: Astra's D1 review, Amendments A and B (verbatim), three README rows |
| `c691a138` | Item 1 — the final day and the heading (DB-2, DB-1, DA-4, DA-9; F1, F2) |
| `2e4ecbf8` | Item 2 — instants and the time basis (DB-6, DB-8; F6, F8) |
| `8693be53` | Item 3 — the lines and placement (DB-7, DB-9, DA-8; F7, F9) |
| `62e4243b` | Item 4 — one x-range and the pin marks (DA-11, DA-15); F-FIXTURE re-pinned |
| `4e8b8308` | Item 5 — quotations on the front (DA-16, DB-13) |
| `6b677ff9` | Item 6 — the shell's state (DB-3, DB-4, DB-12; F3, F4, F12) |
| `5a087c0c` | Item 7 — the doors (DB-10, DB-11; F10, F11) |
| `0167c99c` | Item 8 — "This game" (DB-5; F5) |
| `3694148b` | The tail's corrections (the off path's dismissal write; DB-7 at 256 px; the harness's strict-instant row) |
| `01096bea` | DB-3 where storage throws (a row) |
| `07a42cb6` | The review's confirmed findings (§11.9) — the code head |
