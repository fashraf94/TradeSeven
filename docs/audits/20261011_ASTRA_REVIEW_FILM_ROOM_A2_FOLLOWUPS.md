DO NOT MERGE

# Astra — Review: Film Room A2 follow-up pass

**Requested report:** 20261011. **Execution date:** 2026-10-10, America/Chicago. **PR:** [#952](https://github.com/fashraf94/TradeSeven/pull/952), `claude/film-room-a2-followups`. **Reviewed head:** `f931f339c8c921231ee51654205fe81bec449e10`; code head `cb6c3178`. **Base:** `a06c2a75f49ade6ce4f4f6256e32d71e5e354c0f`.

**One blocking finding, criterion 3 as applied by R11:** sparse candle data can produce a replay containing only isolated points. The chart draws nothing, but the card still shows its replay sentence, path labels and dashed-line legend. This was built by the real close/candle passes and reproduced in a real browser at phone and desktop widths. The branch's 423 selected tests all pass; they do not cover this distinction.

The original B1–B4 bypasses are closed. B1 has a new, synthetic-DOM guard gap, recorded as backlog. A wide last-close label can also leave the plot at 320 px; it remains classed and visible, so that layout defect is backlog under the six fixed criteria.

**Governing inputs:** V1.2 §§7, 8, 11; Amendments A–E through Addendum 4; the supplied Addendum 5 / R14. R14 was applied as settled: absence words do not require number markers. The executor's §9 was treated as claims, not evidence of completion. The review covers `a06c2a75..f931f339`, its twelve items and affected boundaries; it does not reopen the rest of A2.

**Read-only boundary:** the supplied checkout began and ended detached and clean at the base SHA above. All review work ran in an external, forced-LF archive. No tracked archive file changed. Reviewer probes, synthetic JSON, browser preview files and this report are additional external artifacts. No edits to the supplied checkout, commits, pushes, merges, flips, deployments or production access occurred.

**Evidence root:** `C:/Users/fashr/.codex/visualizations/2026/10/11/01a128ef-d661-7602-b298-1533f23d8bc5/film-a2-followups/`. Evidence filenames below are relative to that root; repository `file:line` citations refer to the reviewed head. VERIFIED means source read or local execution here, not production observation.

## §1 My Oct 9 bypasses

The two original evidence files were copied byte-for-byte from the Oct 9 evidence set. Four original tests were selected and run **without changing their assertions**. All four now fail the old “bypass succeeds” expectation. That is closure evidence, not four product-test failures. Separate acceptance probes inspect the corrected outcomes.

| Bypass | Original reproduction at this head | Disposition |
|---|---|---|
| **B1: quotation inside `h2`** | The original `best one 73` quotation now produces forbidden/quantity-word and heading defects. Independent probes cover `h1`–`h6` and `role="heading"`, for both quotations and bound agent names. | **Closed with a new gap.** Heading *ancestors* work. A heading inserted *inside* the bound text element still evades the guards; see B5. No shipped renderer emitted that structure. |
| **B2: unbound `Rec` matching stored `one 73`** | The original receives `stray digit: “one 73”` and a number-word hit. Only exact text at a named R1/R9 path receives the note exemption. | **Closed.** Padding, substring, case, forged-path, non-R1/R9-path and attribute probes are rejected by the applicable sweeps. A bound `best one 73` still trips the forbidden-word sweep. |
| **B3: “ninety / a hundred / a thousand checks”** | All three now trip the word sweep. The digit sweep intentionally does not inspect words. | **Closed.** No additional quantity word escaping the inventory/list was found in actual rendered own-voice copy. This is bounded to the exercised renderers and branches, not a claim to recognize all English quantities. |
| **B4: `['not-a-date', '2026-09-23']`** | The original “two-day battle” expectation fails: the screen renders marked “one-day battle”. Picker, count and oracle use the shared validated timeline. | **Closed.** Duplicates, malformed values, impossible dates, known weekends/holidays and beyond-horizon dates were checked. |

**VERIFIED anchors:** `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx:95` (quantity list), `:117` (allowed note paths), `:126` / `:170` (exact binding and exemption), `:144` (name binding), `:468`–`:473` (heading/quotation boundary); `src/screens/filmRoomV2/filmRoomModel.js:144` (timeline).

Beyond the maintained calendar, real dates are retained, including `2028-01-08`; they are not certified as sessions. This follows the executor's disclosed choice, and all three consumers agree. Within the maintained calendar, `2026-09-26`, `2026-11-26` and `2026-02-30` are removed; `2026-11-27` is retained. An all-invalid nonempty timeline yields no selectable day.

**Evidence:** `original-bypasses.json`, `independent.json`, `independent-evidence.json`, `refutation.json`, `refutation-evidence.json`. The originals retain SHA-256 `303bbf425833abc21f4dda764d5fcce41512678f5ece615285ca5248ffd959cc` (`astraConfirmation.jsdom.test.jsx`) and `3bcd687aaf0de535c9005cc921f1348ebf13f00e045212670277b7e85c831433` (`astraBoundaryFollowup.jsdom.test.jsx`).

## §2 Findings and item-by-item results

### F1 — R11 counts isolated, invisible points as a drawn replay

**Blocking criterion: 3, under the supplied R11 requirement that a card without a drawn replay must not state, imply or label a replay, including its legend. VERIFIED, writer-to-screen and browser.**

A player can see an empty “Hold vs swap” chart with a replay sentence and labels describing dashed rebuilt paths. The stored replay has isolated values separated by missing samples; the renderer emits only SVG move commands, which paint no line.

**Reproduction, without editing product code or hand-authoring a replay:**

1. Obtain the existing `sep23Day()` source fixture and `sep23Bars()`.
2. For MSFT and CRWD only, retain the minute starting at `2026-09-23T19:59:00Z`; leave the other symbols' input bars unchanged.
3. Run `buildTapeDay` at the normal `SEP23_NIGHT` and `SEP23_MORNING`. This invokes the real `writeTapeDay` and `runCandlePass`, using the in-memory database and synthetic candle provider.
4. Render Study from that resulting tape. Open the MSFT → CRWD card at 390 px or 1440 px.

The actual path attributes are:

```text
hold: M1000.0 19.1
swap: M0.0 92.9 M1000.0 61.3
```

Both browser path bounds have **width 0 and height 0**. The chart is visibly empty. Nonetheless, the card renders its stored “one-step hypothetical through the day's close…” sentence, “Hold path”, “Swap path”, and “dashed · rebuilt from 1-minute bars”. This is not merely a jsdom geometry assumption.

**Cause and citations:**

- `src/screens/filmRoomV2/FilmRoomStudy.jsx:93`–`:110`: `forkScale` requires numeric values and finite instants, but does not establish a visible segment or point glyph.
- `:141`–`:147`: a null sample lifts the pen; a lone valid sample emits only `M`.
- `:154`–`:155`: the replay paths have no separate singleton glyph.
- **Changed gate at `:233`:** `drawn = Boolean(r) && forkScale(...) !== null` treats scale availability as drawing.
- `:280`–`:290`: path labels and the dashed legend render on the broader `valued` condition.
- **Changed sentence gate at `:319`:** the false-positive `drawn` admits the replay sentence.

**Attempted refutation and controls:** ordinary full candles produce visible line segments and the sentence; no usable replay values suppress the sentence; the sparse writer result produces no segments while retaining the sentence, at both widths. “The tape contains calculated endpoint values” is true, but it does not establish that a replay is drawn. The defect is in the follow-up's definition of `drawn`, even though the underlying fork path builder predates it. The branch's no-points test does not cover isolated points separated by nulls.

**Fix I would make, not made:** render an explicit visible glyph for each isolated valid replay point, keeping gaps disconnected, and derive `drawn` from the geometry actually emitted. Make the associated sentence and replay legend use that same condition. Alternatively, when no geometry is emitted, use the no-drawn-replay treatment and omit replay-describing labels. Preserve valid stored values and their classes; do not fabricate connecting segments. Add this real-writer sparse-input regression at phone and desktop widths.

**Evidence:** `snapshot/src/screens/filmRoomV2/astraFollowups.jsdom.test.jsx:97`, `snapshot/astra-datasets.json` → `singletons`, `repro-singletons.html`, `refutation-evidence.json`, `browser-replay.json`, `repro-singletons-browser.jpg`. The acceptance assertion remains red at the reviewed head.

![Empty replay chart with replay sentence and dashed-path labels](C:/Users/fashr/.codex/visualizations/2026/10/11/01a128ef-d661-7602-b298-1533f23d8bc5/film-a2-followups/repro-singletons-browser.jpg)

### Results across the twelve requested items

| Item | Executed result and scope | Source at reviewed head |
|---|---|---|
| **1. R11** | Real close-only, outside-window, crypto before/after candles, no usable points, and post-candle close re-merge cases pass the existing treatment. Crypto appears once per affected card; its day-level coverage note is separate. Close-only/outside/crypto cards do not carry the sentence; split groups state no replay. Newly tested isolated points fail: **F1**. | `FilmRoomStudy.jsx:229`–`:323`; paths relative to `src/screens/filmRoomV2/` in this table. |
| **2. Gaps** | Removed three complete interior buckets from INTC, SPY and XLK before the real candle pass. Each corresponding chart line has two subpaths; no segment crosses the missing interval and no volume rect occupies it. Branch suites additionally cover distinct gaps and lone bars. | `filmRoomModel.js:612`–`:633`; `FilmRoomDeepDive.jsx:151`–`:181`. |
| **3. Sparklines** | Independent comparison checks each emitted spark point against its bar-end instant on the session domain; ten symbol sparklines pass. The branch's partial, full, gapped and unknown-session cases also pass. | `filmRoomModel.js:640`–`:650`; `FilmRoomDeepDive.jsx:294`–`:316`. |
| **4. No tape** | Nine states × three depths × two layout settings: **54** full sweep checks. Missing, read error, loading, skipped mode, close not written, no ID, scheduled, later, and empty-tape cases pass. The scheduled “10:15 PM” is inside `data-time`. | `FilmRoomScreenV2.jsx:76`–`:87`, `:235`–`:239`. |
| **5. Last close** | jsdom geometry plus fresh Chromium layout. **41 browser measurements: 40 contained/collision-free, one wide-value failure** at 320 px. Ordinary prices pass across 320, 360, 390, 768, 1024, 1440 and 1920 px, with additional swap-bearing symbols and volume toggles. B6 records the limit; it is not an additional blocking class. | `FilmRoomDeepDive.jsx:73`–`:98`, `:167`–`:169`, `:199`. |
| **6. Headings** | All seven heading forms reject outer quotation/name exemptions. An inserted heading inside the bound element bypasses the guards; **B5, test-only**. | `__fixtures__/filmRoomHarness.jsx:147`, `:472`, `:502`. |
| **7. Stored notes** | Exact bytes and allowed path required for numeric exemption. Padding, substring, case changes, forged path, a bound result-note path outside R1/R9, and all eight text-bearing attributes are exercised. A bound forbidden word remains detected. | `FilmRoomKit.jsx:163`–`:176`; `__fixtures__/filmRoomHarness.jsx:117`–`:181`. |
| **8. Quantity words / R14** | The pinned 237-key / 345-entry inventory passes. No additional escaping own-voice quantity was found in the exercised screen/model outputs. Absence text remains unmarked under R14; the checked empty-section states match their recorded sections. Composer-literal coverage remains the disclosed backlog. | `filmRoomCopy.inventory.jsdom.test.jsx:155`–`:196`; `filmRoomModel.js:430`–`:479`. |
| **9. Timeline** | B4 plus duplicates, known holidays/weekends, impossible dates, mixed types and horizon cases pass; the oracle deliberately shares the helper, as requested. | `filmRoomModel.js:144`; `FilmRoomScreenV2.jsx:54`, `:109`; harness `:252`. |
| **10. Tabs** | Independent arrows, wraparound, Home, End and no-move Home checks pass. Selection, active focus, roving tab index and linked visible panel agree; branch keyboard tests also pass. | `FilmRoomKit.jsx:341`–`:361`; `FilmRoomScreenV2.jsx:294`–`:299`. |
| **11. Back / legacy** | App diff read directly. Battle → Battle, Battle History → Battle History, Dashboard → Dashboard; unknown → Dashboard. Battle origin retains its prior battle object. Route tests verify exact legacy prop keys and object/function identity, with and without origin, in off and rejected-allowlist modes. **12/12 route/golden tests pass.** | `src/App.jsx:5016`–`:5019`, `:9478`–`:9492`; `FilmRoomRoute.jsx:57`; `filmRoomBack.js:23`. |
| **12. R13 name** | Exact stored name, once bound, at all depths; distinctive forbidden/number/digit names do not leak into another text node or any attribute. “Check”, “Hold” and “Deep” do not falsely borrow an exemption for independent screen copy. Empty name omitted. Heading wrappers are rejected; B5 is the remaining synthetic structure gap. | `FilmRoomScreenV2.jsx:135`–`:138`, `:227`; harness `:144`–`:166`. |

The Back result combines mounted route behavior with direct App wiring inspection and a successful build. It is not a fresh authenticated, full-App navigation smoke test. Likewise, the 54 no-tape checks use jsdom's phone/desktop layout selection; the real-browser measurements are separately identified above.

## §3 Backlog

### New, non-blocking observations

**B5 — A heading inside bound text retains the exemption.** VERIFIED synthetic DOM only. Put the stored `best one 73` inside an `h2` nested in the element carrying `data-quote-path`. Text equality still holds. The word, digit and quotation validators all return `[]`. The equivalent heading inside `data-agent-name` also passes. The guards test the bound element's ancestors, not the actual text node's heading ancestry or headings inside its subtree (`__fixtures__/filmRoomHarness.jsx:147`, `:472`, `:502`). No such structure was emitted by `Quotation` or `AgentName`; they render the stored value as text. This is guard coverage, not a reproduced player-visible criterion 2 leak. Proposed fix: reject headings anywhere along the exempt text's ancestry and within bound-content subtrees; add descendant-heading controls. Evidence: `refutation-evidence.json`.

**B6 — Horizontal last-close placement is not bounded by its width.** VERIFIED jsdom stress plus browser. At 320 px, retain 19 INTC buckets and set their OHLC and session open to the synthetic finite value `7500000`. This is a deliberate reader-layout stress input, **not real market data or real-writer output**. The “7,500,000.00 M” label ends **11.19 px beyond** the 156.40 px plot and intersects the percent-axis “0.00%”. At 390/1440 it fits; `750000` narrowly fits even at 320. `FilmRoomDeepDive.jsx:199` chooses left/right solely by the line endpoint's half of the domain; it does not clamp by actual text width. The number and marker remain present and correctly market-classed, so the reproduced overlap alone does not meet criteria 1–6. Proposed fix: clamp the horizontal label box inside the measured plot, then choose its vertical band with that actual box. Evidence: `browser-geometry.json`, `repro-wide-label-browser.jpg`. The jsdom upper-bound estimate also predicted a small overflow for `750000`; the real browser **refuted that smaller case**, so it is not reported as a defect.

### Known items retained in their supplied disposition

| Item | Disposition in this review |
|---|---|
| A2F1-7 — `FIXED_DIGIT_COPY` string matching | Still backlog. No new shipped own-voice quantity was shown exploiting it. |
| A2F2-4 — clipped phone swap labels | Still backlog. The last-close review does not convert existing swap-label clipping into a new criterion. |
| A2F2-5 / A2FV2-N2 — panel doors drop focus | Still backlog; keyboard depth tabs themselves pass. |
| A2FV2-N3 — below 280 px | Still backlog and outside the requested 320+ boundary. B6 is a distinct wide-value case at a supported width. |
| A2F3-7 — composer literals not key-pinned | Still backlog. No escaping quantity word was found actually rendered. |
| Writer `['not-a-date', D]` throw | Not a screen-timeline failure at this head; no new writer change or real producer path was established. |
| Expired tape retains “awaiting the candle pass” | Reproduced through the real close pass and later expiry sweep: `expired / retry_window_elapsed`, zero fetch requests, stale coverage note retained. The hypothesis that the new card directly repeats it was **refuted**: expiry sets `writtenAt`, so the card points to the coverage line above. The unchanged section note remains verbatim from the tape. This is the already-recorded tape-internal stale outlook, not a newly introduced note or newly established delta breach; its supplied backlog disposition is retained. Evidence: `expiry-evidence.json`; `api/_utils/filmTape/candlePass.js:496`, `FilmRoomStudy.jsx:244`, `:313`. |
| A2A1-2 — retained directive time | Still backlog under R10; no reinterpretation of the settled field/time rule. |

R14 resolves the executor's “B3 zero-count wording” question: “no”, “none in force” and “nothing” are absence, not quantities. No additional marker requirement or founder ruling is requested for those words.

## §4 Checks, platform and limits

**Platform:** Windows / PowerShell, Node `v22.20.0`, Java 21 local Firestore emulator; `TZ=UTC` for Vitest. Fresh browser checks used Codex's Chromium in-app browser, the real screen components, synthetic fixture inputs, shipped CSS and the JetBrains Mono stylesheet. The preview uses an iframe to set each screen's layout width; no production app was opened.

### Snapshot and diff integrity

```text
git -c core.autocrlf=false -c core.eol=lf archive --format=tar --output=<evidence-root>/head-lf.tar f931f339c8c921231ee51654205fe81bec449e10
```

**3,780/3,780 tracked archive files match their Git blobs before and after execution; zero missing, zero changed.** Archive SHA-256:

```text
d5f7a49090d4f6d96b0d44f7ce116b5807cc1dc32cab45f8eedd5caed18dde95
```

The delta changes **25 files**. No `api/` file, BUILD_RULES §1 fenced path, `firestore.rules`, flag source, or stored HTML golden changes. The file named `FilmRoomRoute.golden.jsdom.test.jsx` **does** change: it appends three origin tests; its original tests and the golden artifacts are unchanged. `cb6c3178..f931f339` changes only the build report. The reviewed flags remain `FILM_ROOM_V2_MODE = 'allowlist'` and `FILM_TAPE_WRITE_ENABLED = true` (`src/config/featureFlags.js:2989`, `:2951`).

All commit objects were already local. A read-only `git ls-remote` confirmed both the branch and PR ref at the full reviewed head, and remote main at the supplied base. No remote-tracking comparison or ref update was used. `git diff --check` reports one trailing-whitespace line in the report (`docs/audits/20261008_BUILD_FILM_ROOM_A2.md:879`); this is not a blocking class.

### Executed results

| Check | Result | Evidence |
|---|---|---|
| Branch Film Room + gate/helper/flags/server-allowlist selection | **423/423 pass**, 24 files, zero skipped | `branch-suites.json` / `.log` |
| Legacy route / off and non-allowlisted goldens | **12/12 pass**, included above; old goldens unchanged | Same JSON |
| Gate / exact three-key hub helper / allowlist boundary | **19/19**, **38/38**, **17/17 pass**, included above | Same JSON; helper constructor `src/utils/reviewAvailability.js:68` |
| Rules | **417/417 pass**, 24 files | `rules.json`, `rules.log` |
| Original bypass probes, unchanged assertions | **Four old bypass-success expectations fail**, 12 unrelated cases not selected | `original-bypasses.json` |
| Independent follow-up acceptance probes | **10 pass, 1 fail**: F1's actual-visible-segment assertion | `independent.json` |
| Refutation/controls | **3/3 pass**: records F1, validates ten sparklines, records B5 | `refutation.json`, `refutation-evidence.json` |
| Known expiry observation | **1/1 pass** after the direct-card-duplication hypothesis was refuted | `expiry.json`, `expiry-initial.json`, `expiry-evidence.json` |
| `lint:gate` equivalent | **PASS**, exit 0 | `lint.log` |
| Explicit `vite build` | **PASS**, exit 0; ordinary chunk/dynamic-import warnings | `build.log` |
| Client-bundle allowlist scan | **PASS**, 86 JS/map/HTML/CSS files; synthetic UID, environment key/constant and server parser/reader absent | `bundle-scan.json` |
| Fresh browser | F1 reproduced at 390 and 1440; 41 close-label measurements, B6 the single failing case | `browser-replay.json`, `browser-geometry.json`, JPEGs |
| PR CI at `f931f339` | **UNVERIFIED**: CI reader returned “Can't connect to GitHub. Try again.” | No Linux-CI success claimed |

Rules retain owner-constrained reads and denied client writes for both tape and series (`firestore.rules:519`–`:525`). No non-owner read succeeded in the executed rules suite. The three-key hub helper and rules were verified locally, not against deployed services.

The branch command was:

```text
node node_modules/vitest/vitest.mjs run src/screens/filmRoomV2 src/utils/filmRoomGate.test.js src/utils/reviewAvailability.test.js src/config/filmTapeFlags.test.js api/_utils/callRecords/allowlist.test.js --maxWorkers=2 --testTimeout=120000 --reporter=json --outputFile=../branch-suites.json
```

It collected the 24 branch files **before** reviewer scratch suites were added. Reviewer probes ran separately. Rules ran through `firebase emulators:exec --only firestore --project demo-tradeseven-rules` and `vitest.rules.config.mjs`. Dependencies were linked from the existing installation; no install or lockfile edit occurred.

Initial sandbox starts failed on Vite's linked dependency cache and the emulator's loopback startup; host-access runs against this same archive produced the results above. Two initial reviewer assertions incorrectly expected digit-only sweeps to reject word-only text; these were corrected without changing product code or weakening the combined word/digit boundary. An evidence collector's null-array error was also corrected. Initial result files are retained. No historical mutation campaign or full Linux suite was rerun, and no separate reviewer agent was used; the concrete controls/refutation results here are local to this session.

**Linux remains the suite of record.** The executor's reported green Linux run at `cb6c3178` is still a report claim here, not independently observed CI at `f931f339`.

### Before the separate flip to 'on'

The new prerequisite established here is **F1: make the drawn-replay test match actual visible geometry and verify this sparse-candle case before merging this follow-up or enabling it for everyone**. B5/B6 do not add blocking criteria.

Committing R14 verbatim in the flip PR, reconciling the previously named flag/prose/live-helper checks, and the owner's merge/activation decision remain the existing plan. No other new product prerequisite was established. The unavailable head-CI result remains an explicit verification limit for the owner's normal review.

**Final state:** supplied checkout unchanged, detached and clean at `a06c2a75f49ade6ce4f4f6256e32d71e5e354c0f`; all tracked archive bytes unchanged. This report is delivered outside the checkout for the requested `docs/audits/20261011_ASTRA_REVIEW_FILM_ROOM_A2_FOLLOWUPS.md` destination, without a commit.
