# Astra confirmation review of Film Room D1

**DO NOT MERGE**

PR #1102 · November 21, 2026 · reviewed head `9d7d1955900350c39007c0f295745f8abc7f4381` · code head `07a42cb6`

Nine original findings closed. F3 and F12 closed with a new gap. F4 remains open. On the shipped flag settings a stationary mouse release still fails to open Study. A wheel-scrolled visit can lose both the tape and its first-open mark. A pending replacement owner can inherit the previous owner’s back action. The repinned Sep 23 fixture is correct at 390 px, but two pins exactly 44 px apart can merge on another ordinary phone width. The five reproductions in §3 distinguish these failures from the work assigned to D2.

## §1 · F1 through F12

These results use the original Astra probes or extensions of those probes on the merged tree. The committed fix-round suites also ran. Amendment B governs the result word, singleton geometry, missing time basis and extended axis. The three D2 changes in Amendment C are outside these verdicts.

| Finding | Status | Confirmation evidence |
|---|---|---|
| F1 · Margin without a CPU key | **closed** | Loaded the actual Sep 23 tape blob from `ec3fd0dfd`. Its original basis and an unknown basis both rendered “Won” and “You −47”, with one key entry and no CPU path. The current CPU fixture rendered “Won by 46”, “You −47” and “CPU −93” with a CPU path. |
| F2 · Final day without evidence | **closed** | With finals +80/+20, false and null both rendered the Sep 23 date, last-check −47/−83 and zero endpoints. A missing field with the validated Sep 23 last day gave “Won by 60” and two endpoints. A later validated last day gave the date and zero endpoints. True on a completed battle gave the two finals. The real writer with a missing timeline and Sep 24 completion produced null and ended Sep 23 at its −47 check. |
| F3 · First-open mark | **closed with a new gap** | Both valid and rejected moment links matched main’s storage. Dismissal before denial, request failure or the real 8,000 ms timeout wrote the mark. A dismissed notice stayed gone on remount. Leaving an untouched pending visit preserved DA-12. A viewer who wheel-scrolls and leaves pending sees the notice again. Main marks that same visit. See N2. |
| F4 · Admission during activation | **not closed** | In Chromium with the shipped gates, stationary down/admit/up on Study left Glance selected, focus on Study and **zero** Study clicks. With cards off the same input opened Study exactly once. Space down/admit/up and Enter each opened Study once with both flag configurations. Tab onto a tape control retained focus. An untouched page opened the front. See N1. |
| F5 · Scope of counts | **closed** | Mounted the shell with identical nonempty rows and no trading-day list. A final day numbered 3 said “This day” above the tiles and “three-day battle” on the tape. Unknown length also said “This day”. A confirmed one-day battle said “This game”. |
| F6 · Viewer-dependent pin | **closed** | Read the same 42,332-byte saved writer document in two separate processes. The zoneless directive went into the overflow count. The 16:00Z directive was pin 1 at noon ET, fraction 0.384615 in both. The serialized pin identities, ordinals, clocks, heights, fractions, groups and count were byte-identical. The flow suite also exercised explicit offsets and strict minute-precision forms. |
| F7 · A path through a missing check | **closed** | Replayed 8 / missing / 8 at 14:00, 14:01 and 14:02 UTC. Each series had two singleton dots at x=45.5385 and 47.1077 on a 350 px chart and zero paths. The missing instant was x=46.3231. The two-run control has butt caps on both series and an approximately 8.15 px interruption at the narrowest layout. Physical overlap of very close dots is the DC-7 limit. |
| F8 · Unknown session | **closed** | At an unmaintained date, tested zero checks, one check, and four checks at the same instant, each with zero or two events. All six renders omitted the chart, legend and endpoints, kept the recorded −47 final in the key and counted every event in overflow. |
| F9 · Placement in a gap and past the close | **closed** | With +80 at 14:30 ET, a scoreless 15:30 and an isolated +5 final, the 15:55 directive used +80. With a 16:30 scored check, a 16:10 directive remained at 400/420 of the drawn axis, with interpolated height 73⅓. DB-9 confirms the latter placement. Pre-open and post-axis directives landed at the two inset edges. |
| F10 · Back on a missing day | **closed** | After entering from the front, a definite miss and a failed read both exposed Dashboard and called the external back handler on the first press. Pressing Game flow while the day was loading and then releasing a miss also left Dashboard functional. N3 concerns a different transition on a fully written day. |
| F11 · Deferred focus | **closed** | From the pending written-day frame, moving focus to a day chip kept it there after the read. Leaving focus on the initiating back control moved it to the front door. The ordinary front/tape/Study replays also reached the correct focus target on 20 event links. |
| F12 · Owner-scoped verdict | **closed with a new gap** | With the React key and battle ID unchanged, A→B and missing→known showed the tape immediately and throughout B’s pending answer. A definite denial left the tape. The verdict itself is now scoped correctly. Two pieces of navigation state still cross owner boundaries, with the general back-action case in N3 and the narrower identity collision in N4. |

## §2 · Code rulings

| Ruling | Result at this head |
|---|---|
| DA-4 · Equal displayed finals | Pass. Wins and losses at +0/−0 or two equal displayed nonzero values had the recorded result word and zero margin elements. A one-hundredth difference retained the margin. Draw stayed unnumbered. |
| DA-8 · Final participates in the low | Pass within DC-8’s scope. With three scored checks, a lower or equal displayed final suppressed the mark. With a higher final the earliest tied minimum qualified. Two scored checks plus the final stayed below the count threshold. Earlier days use their checks. |
| DA-9 · Missing player final | Pass. A null player final with a different recorded CPU final gave the date, last-check bindings and zero final endpoints, also exercised with no checks. DC-2 preserves the recorded result word when only the CPU key is absent. |
| DA-11 · One inset range | The SVG, group layout, selected drop line and stepper use the same layout. Both 44 × 44 edge buttons were visible and hit-testable at all four requested widths. The exact grouping threshold has the N5 defect. |
| DA-15 · Bound group range | The two- and three-member marks showed bound first/last ordinals separated by an en dash. At 390 the stepper visited 3, 4, 5. Each button’s accessible name contained its member fact lines and the highest-priority member determined the mark. N5 can reduce two independent stops to one. |
| DA-16 · Attribution | Pass. Chromium exposed “the player” and “the agent” with the recorded 1:40 PM time. Each attribution remained a direct child, clipped to 1 × 1 CSS px. Removing the attribution made the provenance oracle fail. |
| DB-1 · Both finals in key | Pass. Historical, unknown and CPU-basis cases in F1. The margin oracle requires both rendered bindings. |
| DB-2 · Final-day evidence | Pass for D1. F2 covers explicit values and both legacy outcomes. The shell passes the battle through to the front and the harness uses the same predicate. |
| DB-3 · First-open mark | The prescribed link, dismissal, remount and unattended controls pass. DC-5’s wheel-scroll visit exposes N2. |
| DB-4 · In-progress input | Incomplete. The front no longer replaces a pointer-held tape, but the native activation can still be lost when cards settle. N1 gives the paired controls. |
| DB-5 · Known one-day scope | Pass. F5 verifies the screen and its subtitle use the same length evidence. |
| DB-6 · Strict instants | Pass. F6 verifies identical viewer output. The strict parser also splits an unplaceable check run. DC-9 qualifies the tape’s shared swap anchor. |
| DB-7 · Singleton and line endings | Pass. F7 verifies both dot positions and the absence of a crossing path. Coincident equal points also have a dot. |
| DB-8 · No time basis | Pass. All six F8 combinations kept the final key and gave every event a destination in the count. |
| DB-9 · Placement | Pass. F9 distinguishes the isolated final from a scored check and exercises the actual extended axis. |
| DB-10 · Game flow back control | The day-read cases, including DC-3’s loading frame, pass. A replacement owner with a pending verdict and an already written day still gets the wrong back action in N3. |
| DB-11 · Deferred door focus | Pass. F11 exercises both endings with the same delayed read. |
| DB-12 · Battle and owner | The resolved answer passes both identity changes. The return action and the separate “front seen” marker need N3 and N4. |
| DB-13 · Three-line preview | Both long quotations measured 70 px high with a three-line clamp and no disclosure. Unclamped content measured 2,325 and 2,093 px. On Study the disclosure opened and changed to “Show less”. The normal planted disclosure was caught. See the copy-oracle qualification in §5. |
| DB-14 · Amendment A qualifications | The six DA rows above record the individual outcomes. All four fixture layouts agreed with the independent 44 px first-member calculation. N5 isolates the boundary that the repinned fixture does not reach. |

**Default Quotation output.** I enumerated the production callers in Glance, Study and the cards receipt/ledger, including canonical and retained directive text, replies, diagnoses, both plan fields, both rationale fields, card notes, decision reasons/theses and closing notes. The parents and their call-site props are unchanged. Comparing the omitted prop in fresh base and code trees gave identical serialized markup for **42 input cases and 48 render states**, including empty, short, overflowing, expanded and re-collapsed text. Generated React IDs were normalized consistently. The ordinary full-screen differential also compares the Glance and Study parents.

**Sep 23 and the 44 px targets.** I ranked the fixture’s raw events by kind and timestamp, chose five, ordered them by time, and compared each elapsed time to the group’s *first* member using integer cross-multiplication on the `width − 44` drawable span. This reference calls no production grouping or layout function. A second probe checked 36 within-section permutations across 1,161 widths, plus the five selected swaps over all 720 permutations of six swaps.

| Viewport | Chart | Independent groups and Chromium labels | Low label | Left / right synthetic edge targets, viewport x |
|---|---:|---|---|---|
| 280 | 256 | 1–3, 4–5 | omitted | 12–56 / 224–268 |
| 320 | 296 | 1–2, 3–5 | omitted | 12–56 / 264–308 |
| 390 | 350 | **1–2, 3–5** | **Low −92 · 1:30 PM** | 20–64 / 326–370 |
| 1440 | 639 | 1, 2–3, 4, 5 | omitted | 200–244 / 795–839 |

At 390 both selected groups’ drop lines ended two CSS pixels above the low label. Every edge target measured 44 × 44 and intercepted the pointer one pixel inside both horizontal edges. At desktop the integer layout width rounded the fractional chart right edge by 0.094 px. The entire target remained inside the viewport.

## §3 · New findings and remaining reproductions

Locations below refer to the reviewed head. The fixes are proposals.

### N1 · The shared admission moves Study before mouse-up

**Criterion 9 · F4 / DB-4.** At 390 px, mount Sep 23 with both shipped flags at `allowlist`, hold their shared yes verdict, press the centre of Study at (195, 146.22), admit, then release without moving the mouse. The tab stays mounted and focused. The cards header grows to 234 px and the tab’s top moves from 129.22 to 362.78. The pointer is now over “No cards yet.” Chromium delivers **zero clicks to Study** and leaves Glance selected. The identical gesture with cards off delivered one native click. Main also exhibited the cards-induced movement. The front replacement from the original review was repaired, but DB-4 explicitly requires the gesture’s own activation to run once. [FilmRoomScreenV2.jsx:531](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L531) · [cards header at line 535](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L535)

**Proposed fix.** Keep a pressed tape control’s geometry stable until its native activation or cancellation finishes. For example, defer the layout-changing cards-header paint during that gesture, while allowing the verdict and data reads to settle. Pin the stationary mouse-up, normal drag-away cancellation and one native click with both gates admitted.

### N2 · A wheel-scrolled tape is still treated as untouched

**Criteria 1 and 9 · F3 / F4 / DC-5.** On a fresh viewer’s pending Sep 23 tape, wheel down 410 px without clicking, focusing or pressing a key. Trusted `wheel` and `scroll` events fired. Admitting then replaced the tape with the front. In a separate paired run, leave while still pending after the same wheel input and remount the same viewer. Main had written the seen map and showed zero notices on remount. Head had written nothing and showed one. A real touch swipe scrolling 325 px held the tape and wrote the mark. The wheel result also reproduced with cards off. DC-5 explicitly counts a scrolled page as interaction, which puts this visit outside DA-12’s untouched-leave exception. [FilmRoomScreenV2.jsx:309](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L309) · [notice at line 322](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L322) · [event handlers at line 531](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L531)

**Proposed fix.** Recognize user scrolling of the tape’s actual scroll container, including document-level wheel/trackpad scrolling. Once the tape is held, reuse the existing irrevocable-entry mark. Pin admission and leave/remount after wheel input, with an untouched page and a touch swipe as controls.

### N3 · A pending owner inherits the previous owner’s return action

**Criteria 1 and 9 · F12 / DB-10.** Admit A, open the full tape, refresh the mounted battle’s owner to B on the same ID, keep the written tape and hold B’s answer. Main showed Dashboard and called the external handler on the first press. Head showed Game flow and called it **zero** times. After B answered no, Dashboard appeared, requiring a second press. Both trees read the same single tape document. The stale `fromFront` flag and the test for “not definitely off” retain A’s door for B. DC-3 covers a day being read. In this replay the day is already written and *only B’s verdict* is pending. The executor’s Q3 mentioned this combination, but the brief names no pending-owner DOM or back-action exception under criterion 1. [FilmRoomScreenV2.jsx:445](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L445) · [back handler at line 479](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L479)

**Proposed fix.** Bind the entry through the front to the same battle and owner as the admission. Render the return action only for that admitted identity. Preserve Game flow during a same-owner day read. Test the first pending paint and the first click before the new verdict, as well as the eventual denial.

### N4 · Missing owner and the string `"null"` share a “front seen” marker

**Criterion 9 · F12 / DB-4.** On an unchanged ID, admit the battle with no owner. Refresh it to the nonempty owner string `"null"` and hold that owner’s verdict. Its first pending paint correctly shows the tape. Dispatch pointer-down on Study, then admit the new owner. The front replaces the control under the gesture. The two distinct owner keys both stringify to `<battleId>|null`, leaving `seenFront` true and disabling the hold guard. This is a synthetic, supported string-identity edge. I found no evidence about its occurrence in production. [FilmRoomScreenV2.jsx:294](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L294) · [hold guard at line 309](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/FilmRoomScreenV2.jsx#L309)

**Proposed fix.** Store the battle ID and nullable owner as separate fields and compare them with strict equality, as the verdict already does. This can share the identity check needed for N3. Pin missing→literal `"null"` with a pending gesture.

### N5 · Two pins exactly 44 px apart become one stop

**Criterion 6 · FL-4 / DA-11.** On the regular Sep 23 session, keep just two directives at 09:35 and 10:35 ET. At a 370 px viewport Chromium measured a 330 px chart. The 286 px drawable span over 390 minutes gives an exact centre distance of **60 × 286 / 390 = 44 px**. The UI rendered one `1–2` button and a Next stepper. FL-4 starts a new group at equality. At viewport 369 the merge was correct. At 371 two separate buttons appeared. Subtracting the two rounded floating-point x coordinates at 370 yields 43.999999999999986. This affects keyboard stops as well as the visual mark. [filmRoomFlow.js:372](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/filmRoomFlow.js#L372)

**Proposed fix.** Compare the clamped elapsed-time separation to the 44 px threshold before converting each centre into an absolute floating-point coordinate. For this session integer cross-products give an exact comparison. Keep strict “closer than” and add the 369/370/371 browser or layout rows with a first member away from the axis origin.


## §4 · Regressions and the off path

**Differential.** I reran the original React-commit recorder on fresh `cf35151b` and `07a42cb6` archives. It normalized generated IDs, collapsed consecutive identical DOM snapshots, and recorded focus, underlying verdict fetches, read arguments and first-open storage. The real verdict reader’s 8,000 ms callback was triggered under test control. The comparison ran the one-day, multi-day, active, missing, valid moment, rejected moment and casual-clone fixtures plus dismissal, under off, pending, denial, failure and timeout. Five further pairs used the untaped tournament route.

| Comparison | Result |
|---|---|
| Shipped cards mode, 45 pairs | All 250 v2 and 15 legacy DOM states matched. Focus, request traces and reads matched. The tournament mounted legacy once in each case, with zero fetches and Firestore calls. |
| First-open storage, original matrix | Five ordinary pending scenes deferred the mark at the checkpoint before interaction, as DA-12 allows. Subsequent deliberate focus/interaction aligned the seen map. Valid and rejected moments and dismissal matched main, including after denial, failure and timeout. |
| Cards disabled, 40 additional pairs | All 250 DOM states, focus, reads and eventual storage matched. In 24 cases main requested zero verdicts and code head requested one, exactly the DA-1 combinations. The five pre-interaction storage differences were the same DA-12 cases. |
| Additional wheel/leave and owner-refresh pairs | N2 differed from main on a pending **interacted** visit and its next mount. N3 differed in both back-button text and the first callback on a written tape with an unresolved replacement owner. Neither is covered by DA-1, DA-12 or DC-11. |

**Reads.** Chromium logged one Sep 23 tape read at the front, still one after selecting a pin, stepping, entering Glance and opening Study. Deep dive added the Sep 23 series once. Returning through the door and reopening Deep dive reused it. Changing to Sep 22 on the front added only the Sep 22 tape read. The Firestore-boundary suite independently verified document/series calls and zero snapshot subscriptions. Existing cards counter and carried-idea work stays on the cards path. No additional front read surfaced in either setting.

**DA-14.** Compared the five pinned test files against main and against the previously reviewed head. Cards, route golden, route untaped and screen cards-off golden each added four lines relative to main. Subject line added seven. The only additions are the flag mock and its comments or wrapper. All five were byte-identical to `368dc113`. Their earlier assertions and committed golden HTML are intact.

**Executor’s review fixes.** Commit `01096bea` adds only the refusal-of-storage test. Commit `07a42cb6` marks genuine tape holds and ID-less opens, scopes the “seen front” guard, removes the return action after denial, draws a dot for coincident equal vertices and shortens a drop line that would intersect the low label. It also adds regression coverage for passing the battle to the legacy-final predicate and validating the timeline. I checked the hunks against the rerun screen/model suites. The 390 px low label remained clear with either group selected, and ordinary owner changes and all 20 ordinary navigation links worked. N3 and N4 delimit the owner-state fixes. N1’s movement also occurs on main. N2 and N5 concern the round’s gesture and grouping rules. I found no additional change to an accepted tape caller, its read budget, or its default quotation markup.

**Fences.** Reviewed the 19 round paths (+2,569/−214) and checked the complete PR path list against the D1 fences. The only kit change is `Quotation.preview`, its documentation, disclosure/attribution branches and the DC-10 style constant. The only fixture-directory code is the allowed harness and its self-test. The round changes no committed fixture data, golden HTML, protected screen/data module, API, Firestore rules/index, deployment file, dependency, hub, Practice Field or BUILD_RULES §1 calibration file. In the full PR the card-region hunk is CF-5 and the model additions are aggregate declarations. Criterion 11 passes.

## §5 · Backlog and confirmed limits

- **D2 owns DC-1, DC-4 and DC-8.** Require completed battle status for an explicitly final day, preserve a tape on a click delivered without preceding input, and compare ties at the low using displayed hundredths. None accounts for the stationary mouse-down in N1 or the actual scrolling in N2.
- **DC-2, DC-3, DC-6, DC-7 and DC-10** stand within their stated scope. The Sep 23 low is visible at 390, and 15 minutes is about 8 px on the 256 px chart. Two dots closer than their diameter may visually overlap. DC-5 holds for the tested touch swipe. N2 documents its wheel-input exception.
- **DC-9, DC-11 and DC-12** retain their dispositions. The tape and Study share the swap-anchor numbering even where its legacy parser is viewer-zone-dependent. Leaving while the day is loading under `on` may repeat the notice. Zoneless writer ordering is tape-writer backlog.
- **Earlier accepted work** includes focused-pin loss after resize/regroup, NUM-6’s equal-instant checks with one sequence absent, D2’s swap-panel words, cross-game counts and the idea. The mock-up and previously accepted C1/C2 work add no merge condition here.
- **Copy-sweep coverage.** A planted “Read more” button directly inside the quotation root was identified by name, as requested. As an additional negative control I moved that button *inside the attribution span*. The copy-only sweep then returned an empty list because it exempts descendants. The independent quotation oracle caught the modified attribution text. The shipped front renders neither planted control and the combined provenance check detects this mutation, so I recorded the narrower test-helper limitation here. [filmRoomHarness.jsx:985](https://github.com/fashraf94/TradeSeven/blob/9d7d1955900350c39007c0f295745f8abc7f4381/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx#L985)

## §6 · Verification record

| Check | Result |
|---|---|
| Remote and merged-tree identity | Read-only remote lookup returned main `cf35151b9528cbdf32a6452b7ffec29c7b058f2f` and PR head `9d7d1955900350c39007c0f295745f8abc7f4381`. Main is the merge base. The effective merged tree is head tree `187fd182e2047d2fe947ef2d530b378c8b98c670`. Only the build report and docs index changed from code head `07a42cb6`. |
| Snapshot integrity | `git -c core.autocrlf=false -c core.eol=lf archive`. Independently hashed the extracted contents against Git’s blob IDs, including type and byte length. **5,505 main, 5,527 code-head and 5,527 PR-head blobs, zero mismatches**. The test archive had a private detached Git identity at the reviewed head. Diagnostic fixtures and modified test harnesses ran in separate copies. |
| Platform | WSL2 Ubuntu 24.04.1 LTS, Linux 5.15.167.4 x86-64, Node 22.22.2, Vitest 4.0.17, Vite 7.1.12, Temurin 21.0.13 and headless Chromium 147.0.7727.15. Local dependencies matched the archived lock SHA-256 `e457c10d0317872bff6bdb9ee1925cd0d5594159edbf5ba56fd8e5939c2fdd72`. |
| Independent replays | Historical Git blob, real local tape assembler, saved ambiguous tape in each zone, mounted model/screen cases, paired off-path traces, cross-tree quotation serialization, integer grouping oracle, and Chromium with native mouse, keyboard, touch and wheel input. Fixture pages served local assets with synthetic readers and external browser requests blocked. |
| Full suite, Linux UTC | **Pass on full rerun**, 1,596 files passed, 13 skipped, **36,656 tests passed**, 179 skipped, zero failed, 334.36 s. The first full run, concurrent with the emulator and build, had one 5-second timeout at `scripts/experiments/agent-workspace/workspace.test.js:161` (36,655 passed). The unchanged file passed all 18 tests in isolation, including the timed-out case in 1.76 s. The subsequent full run used the same head, worker count and timeout, with the emulator and build finished. |
| Flow suites, America/Chicago | **Pass**. All 12 flow-related suites, **276/276 tests**, plus the nine-test copy inventory, for **13 files and 285/285** overall. The separate saved-document comparison under UTC/Chicago gave the same output SHA-256 `547e9759868aaefe038cd69b512e20efdbfbe784f879cc1322d4882c7d8c9fe5`. |
| Rules, Linux UTC | **Pass**, 46 files, **839/839**, 338.85 s. Local Firestore emulator with synthetic demo project `demo-tradeseven-rules`. |
| Lint and build, Linux UTC | **Pass**, `npm run lint:gate` exit 0 and `vite build` exit 0 in 46.13 s. Vite emitted the chunk-size warning. |
| CI, exact head | One successful read of the PR-triggered Tests workflow for `9d7d1955`. **Run #659, completed / success**, ID `44889898919`. [GitHub Actions run](https://github.com/fashraf94/TradeSeven/actions/runs/44889898919) |

Local run evidence is in the WSL review directory `~/astra-d1-confirm-9d7d1955/`, including the paired traces, browser logs, geometry run and both full-suite logs.

**Before merging.** Resolve N1–N5 and rerun their controls on the proposed merge tree. A founder decision is needed only if one of these criterion breaches is to become a declared exception. I found no additional founder action beyond that. This review made no checkout edits, commits, pushes, merges, deploys, flag changes or production accesses.
