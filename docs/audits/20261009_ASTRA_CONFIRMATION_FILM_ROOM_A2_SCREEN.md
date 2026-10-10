MERGE

# Astra — Confirmation review: Film Room A2 after round 1

**Date:** 2026-10-09. **PR:** #944, `claude/film-room-a2-screen` (draft in the supplied request). **Reviewed head:** `39422435e9a17e586b7592e1277c084ed81da0bf`; code tip `7dee5dc6`. **Delta base:** `819b5fb5a1791773a9f81a6e8f91d20d3467df69`.

**Verdict scope:** F1–F3 are closed under the supplied rulings. No new blocking breach of the six fixed criteria was established in this delta. The remaining guard limitations below are backlog. This is a dark-merge recommendation, not screen activation or production qualification. **Linux CI at the reviewed head is unverified:** the GitHub CI reader returned “Can't connect to GitHub. Try again.” The executor's Linux result at `7dee5dc6` is a report claim, not independently observed CI at `39422435`.

**Governing inputs:** V1.2 §§7, 8, 11; Amendments A–E, including R1–R8; and the supplied Addendum 3, R9–R12. R9's stored-number exemption, R10's directive attribution, R11's allowlist-phase acceptance, and R12's positional-word boundary were applied as settled rulings. The earlier review and build report §7 were treated as claims to verify. Nothing outside the three repairs and their affected boundaries was reopened.

**Read-only delivery:** this report and all probes are outside the supplied checkout. The checkout began and ended **detached, clean, at `4b28cd84e49bcea8c4484e197d993a0251ead6ca`**. No tracked product/test/spec file was edited, including in the reviewed archive. Additional reviewer tests were created only in that external archive. No commit, push, merge, production access, flag flip, deployment, or remote-tracking update occurred. All named commits were already available locally; no comparison against a potentially stale `origin/main` was used.

**Evidence root:** `C:/Users/fashr/.codex/visualizations/2026/10/09/01a1231b-9aa0-7b42-9927-ba5ea6a59f05/film-a2-confirmation/`. Artifact paths below are relative to this root. Repository `file:line` references name the reviewed head; scratch probes are explicitly identified as such. Findings labelled VERIFIED below are source reads or local executions, not production observations.

## §1 Original findings and confirmation

| Finding | My original repro, rerun | Disposition |
|---|---|---|
| **F1 — recorded words / criterion 2** | Copied my prior `astraA2Writer.test.js`, `astraA2Screen.jsdom.test.jsx`, and `astra-writer.json`. The unchanged writer again stores `This is the best entry.` through the real close and candle passes. The regenerated fixture is byte-identical to the prior JSON. Under R7, the mounted rationale is verbatim inside a path-bound, attributed quotation; the screen's own voice sweeps clean. | **Closed.** New test-guard gaps are backlog, not a reproduced leak in a shipped renderer. |
| **F2 — false session close / criterion 3** | The same writer repro produces three INTC bars, ending at 10:00 AM ET, with incomplete coverage. The chart now spans 9:30 AM–4:00 PM; its line ends at 30/390 of the session and leaves the tail blank. The only axis “close” is bound to `2026-09-23T20:00:00.000Z`. | **Closed.** Missing-head, early-close, DST, and unknown-session checks also pass. |
| **F3 — unmarked duration / criterion 1** | The original one-day header assertion now passes without changing its expected marker. Independent cases exercise every word one through ten using both timing and final-tape sources; eleven and twelve are omitted. | **Closed.** The marker follows the selected source. Generalized cardinal detection and malformed string timelines remain limited as disclosed in §3. |

### Adjustments to my original assertions

The originals were copied byte-for-byte and executed before adjustment: **9 passed, 4 failed across 13 tests** (`original-probes.json`). Both writer tests passed; the screen's original F3 assertion passed. Those four failures are preserved, not called acceptance failures at this head:

1. **F1:** the old sweep had no document map, so it could not recognize any R7 quotation. Passed `{ tape: built.tape }`, checked `quoteDefects`, and explicitly required the original phrase's bound element and agent attribution. The governing expectation changed from forbidding the recorded phrase to preserving it as a quotation.
2. **F2:** the old assertion forbade “close” anywhere on the axis. Replaced it with exact session-start/close instants and the actual INTC line endpoint. A full-session domain with a blank tail was an explicitly permitted fix in my original review.
3. **Canonical sweep control:** supplied its tape to the updated document-aware word sweep for R7/R9.
4. **Company-name control:** the old artificial `<span title={name} aria-label={name}>` now trips R8 on “Capital One.” Changed the test mount to the actual directory-name text contract, `data-display-name={sym}`, with no invented attributes. The all-company forbidden-word control and BBY fallback still pass. This did not relax the attribute boundary; independent attribute attacks below remain detected.

The adjusted **11/11 original screen tests pass** (`confirmation-probes.json`). The writer file was not edited. `original-screen-probes.txt` preserves its companion screen file before adjustment. `verification-start.json` and `verification-final.json` record the hashes; the original/regenerated fixture SHA-256 is `4a4fefede65a139ee82d79aff46115d6e298713c7184ff3094aeddad874342a3`.

### F1 / R7 channel census and attacks

**VERIFIED:** these are the nine rendered channels holding someone's words. Each uses `Quotation`; its displayed text is read from the tape path, not supplied as a composed string (`src/screens/filmRoomV2/FilmRoomKit.jsx:236`, `:259`). The component renders attribution separately at `:261` and dates a record from another ET day through `filmRoomModel.js:119`.

| Tape path | Attribution and instant | Render site |
|---|---|---|
| `rationale[].rationale` | the agent; row `at` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:467` |
| `rationale[].hypothesis` | the agent; row `at` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:466` |
| `directives[].playerText` | the player; row `filedAt` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:344`, `:366` |
| `directives[].canonicalText` | the stored directive; row `filedAt` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:348` |
| `directives[].retainedDirectiveText` | the stored directive; its own row's `filedAt`, per R10 | `src/screens/filmRoomV2/FilmRoomStudy.jsx:354` |
| `directives[].agentReply` | the agent; row `filedAt` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:371` |
| `plans[].signalSummary` | the stored plan; row `at` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:427` |
| `plans[].threshold` | the stored plan; row `at` | `src/screens/filmRoomV2/FilmRoomStudy.jsx:431` |
| `battle.completionMessage.text` | the platform; `battle.completionMessage.at` | `src/screens/filmRoomV2/FilmRoomGlance.jsx:243` |

The tape's source mappings support these identities: directive fields at `api/_utils/filmTape/tapeAssemble.js:605`, plan prose at `:642`, and rationale copying at `:666`. No author was invented for plan or canonical/retained directive text. A prior-day attribution case displays **“Sep 22, 8:30 PM”** for `2026-09-23T00:30:00Z`; R10's retained row retains **“No new directive filed”** and uses its own row's time.

**Independent executed census:** planted all ten forbidden phrases plus `one 73` into the underlying source records, then ran the real close/candle passes. Mounted the resulting screen at both layout settings, all three depths, expanded controls, every check detail, and every Deep dive symbol. All nine channels were found; no planted phrase reached another text node or text-bearing attribute. The branch's own writer suite separately passed its collapsed, expanded, attribution, and whole-screen cases, **29/29**. The test harness's synthetic overflow drives the CSS preview/disclosure; this is DOM evidence, not a fresh browser layout measurement.

**Other recorded strings remain outside R7 quotations by design:** stored coverage/result/replay/price notes, missing-input text, the replay `label` and locked-basis note; symbols, tiers, directions, regime/risk values and mechanism/reason fields. These are platform metadata, identifiers, or stored notes, not additional agent/player prose channels. They remain subject to the forbidden-word sweep. R1/R9 exempts stored note quantities only. Representative consumers are `FilmRoomKit.jsx:184`, `FilmRoomStudy.jsx:185`, `:287`, `:291`, `:295`, `:409`, `:424`, `:438`, `FilmRoomGlance.jsx:227`, and `FilmRoomCheckDetail.jsx:36`. Explainer fixture prose is screen copy in `ExampleWords`, never a path-bound quotation (`FilmRoomStudy.jsx:329`). Plan chips contain symbols/counts, not plan prose (`:412`).

| Requested guard attack | Executed result |
|---|---|
| Forged `data-quote-path` | Detected: binding failure; forbidden/cardinal words remain swept. |
| Screen copy appended inside a quotation | Detected: text differs from stored value; forbidden/cardinal words remain swept. |
| Path outside R7 channels | Detected, even when its text equals a stored coverage note. |
| Quotation without attribution | Detected by both word sweep and quotation validator. |
| Copies in `aria-description`, `alt`, `placeholder`, `title`, `aria-label` | Each detected by the word sweep. The independent full-screen census checked all eight attributes in `TEXT_ATTRIBUTES`. |
| Wrong author/time or missing earlier date | Branch attribution guard cases pass; independent earlier-date/R10 case passes. |
| Bound quotation nested in a heading | **Guard gap:** both helpers return no defects. No shipped heading contains such a quotation in the inspected/mounted paths. Backlog B1. |
| Screen copy borrowing the stored-note number exemption | **Guard gap:** an unbound `Rec` whose text matches stored `one 73` passes both number sweeps. Changing it to absent `two 74` is detected. Backlog B2. |
| Forbidden word inside a stored note | Still detected: a mounted coverage note `best one 73` reports `best`. The R1/R9 exemption does not suppress the forbidden-word check. |

### F2 session matrix

**VERIFIED source:** `src/screens/filmRoomV2/filmRoomModel.js:14` imports `getSessionForDate` from **`src/utils/marketCalendar.js`**; `:132` accepts only a known trading session with finite endpoints. `FilmRoomDeepDive.jsx:81` selects that domain, `:114` bounds intermediate ticks, and `:182`/`:183` chooses “close” versus the actual last-bar-end clock. The delta adds no calendar table and no hard-coded 16:00 endpoint in screen code. The authoritative shared calendar performs ET-to-UTC conversion at `src/utils/marketCalendar.js:130`.

| Case | Real candle-pass evidence and rendered result |
|---|---|
| Original incomplete INTC, Sep 23 | Three bars through 14:00Z / 10 AM ET; domain **13:30Z–20:00Z**. “close” remains at 4 PM, line ends at x≈76.9/1000. |
| Missing head, Sep 23 | First bar starts at 14:00Z / 10 AM; domain still opens at **13:30Z / 9:30**. First close point x≈102.6; the missing head remains blank. |
| Nov 27 early close, complete | Candle pass cuts a full supplied minute response to **21 ten-minute bars**; domain **14:30Z–18:00Z**, close **1 PM ET**. |
| Nov 27 early close, incomplete | Three ten-minute bars through 15:00Z / 10 AM; same **18:00Z / 1 PM** close; line ends at x≈142.9. |
| Nov 2, after fall DST change | **39 bars**, domain **14:30Z–21:00Z** = 9:30 AM–4 PM EST. |
| Mar 9, after spring DST change | **39 bars**, domain **13:30Z–20:00Z** = 9:30 AM–4 PM EDT. |
| Nov 26 holiday; Sep 26 weekend; Jan 3, 2028 beyond horizon | For each date, the real close/candle invocation produced **no series**, and the screen session helper returned null. Separately mounted a retained, previously writer-generated series under that adversarial tape date: endpoint was its actual last-bar end, `20:00Z`, shown **“4:00”**, never “close.” |

No tested intermediate tick exceeds its domain end. The last row deliberately distinguishes writer behavior from reader fallback: the real writer cannot supply a fresh non-session series. The fallback mounting therefore uses the old series unchanged, including its timestamps; it is not claimed to be writer output for a holiday/weekend/unmaintained date. Independent data are in `confirmation-evidence.json`; the original INTC is also saved in `repro-partial-series.html`.

### F3 / R8–R12 quantity and positional checks

**VERIFIED:** `count(timing.tradingDays)` is declared `derived` at `src/screens/filmRoomV2/filmRoomModel.js:73`. `FilmRoomScreenV2.jsx:94` chooses the source, and `:115` renders the timing count via `AggNum` or final tape `dayNumber` via `TapeNum`. Independent one-through-ten tests deliberately declared `dayNumber` **market** to prove the fallback reads the document, rather than accidentally agreeing with the usual class. The branch also exercises recorded/derived declarations. Eleven and twelve render no length for either source. Missing tape preserves a timing-derived marked length; missing both sources omits it.

The mixed timeline `[null, 7, {}, '2026-09-23']` renders **one-day battle D**, matching the picker. The fix filters non-strings, **not all non-dates**: `['not-a-date', '2026-09-23']` still renders two-day battle D. This limitation is disclosed in B4; the phrase “non-dates are removed” would overstate the code.

Own-voice number-word/forbidden-word sweeps pass at both layouts across the empty day and missing, error, loading, skipped-mode, not-written, and no-ID states, including no-tape scheduling inputs, at all three depth selections. The BA-11 fallback is exactly R9's rewording (`filmRoomCopy.js:27`); the stored replay label remains verbatim at `FilmRoomStudy.jsx:291`. The cardinal guard covers its finite pinned vocabulary, not every English quantity word (B3).

**R12:** no new marker was demanded for positions or “shown once.” Independent mounted checks bind “First check” to `score.firstCheck`, the first/last risk clocks to the corresponding risk-bearing check rows, an “after the last recorded check” action to an instant after the last row, and “the last 10-minute bar” to the series' final bar. Source anchors: `FilmRoomGlance.jsx:80`, `:138`; `filmRoomModel.js:395`, `:436`; `FilmRoomDeepDive.jsx:227`. No position-versus-tape contradiction was found in these cases. These are bounded checks of the requested wording, not a reopening of the entire pre-delta holdings algorithm.

## §2 New blocking findings

**None.** No reproduced shipped-screen breach of criteria 1–3 survived the above checks. The off/non-allowlisted goldens pass, the helper's exact three-key tests pass, and the rules suite reports no non-owner read success. The guard attacks in §3 are reproducible test weaknesses, but are not evidence that those invented DOM structures are emitted by the shipped screen. They therefore do not add a merge criterion.

## §3 Backlog

### New observations from this confirmation

| ID | Evidence and repro | Criterion relationship; proposed fix, not made |
|---|---|---|
| **B1 — quotation exemption survives heading nesting** | Mount `<h2><Quotation …/></h2>` with a valid rationale containing `best one 73`. `sweepWords` and `quoteDefects` both return `[]`. `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx:390` has no heading-ancestor exclusion; `:487` checks only a Why heading. | Test coverage for criterion 2. No current heading emits a quotation. Reject heading ancestry in the exemption/validator and add a guard assertion. |
| **B2 — stored-note exemption has no path binding** | With `coverage.checks.note = 'one 73'`, screen-authored `<Rec>one 73</Rec>` passes both number sweeps. The lookup recursively collects all document strings at `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx:100`; `:329` and `:465` subtract matching strings inside any `data-record-text`. | Test coverage for criterion 1. No actual screen-authored quantity was found using this bypass. Bind exempt note text to an allowed stored-note path/value, or constrain the exact renderer/site. Keep the forbidden-word scan active. |
| **B3 — finite cardinal vocabulary** | Screen-authored `ninety checks`, `a hundred checks`, and `a thousand checks` each pass both sweeps. `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx:88` recognizes zero–twenty, single and dozen. The executor's “any spelled-out number” claim at `docs/audits/20261008_BUILD_FILM_ROOM_A2.md:569` is too broad. | Test coverage for criterion 1. None of those phrases appears in shipped screen copy. Expand quantity detection or use a complete explicit copy inventory with a guard for additions. Evidence: `cardinal-guard-limit.json`. |
| **B4 — timeline filtering is type-only** | Injecting `['not-a-date', '2026-09-23']` produces two-day battle D. `src/screens/filmRoomV2/FilmRoomScreenV2.jsx:97` and the picker at `:52` accept every string; the test oracle does too at `__fixtures__/filmRoomHarness.jsx:184`. | Malformed-input hardening, potentially criterion 3 if such a record is admitted. No new regression established: the prior header also counted that two-entry timeline, and R8 explicitly selects the battle timeline count over tape `dayNumber`. Do not claim calendar validation. In a later hardening change, share a validated-date timeline between picker, count and oracle. |

The suggested fixes are not made and are not added as pre-allowlist requirements. `confirmation-evidence.json` and the two independent scratch suites retain these positive reproductions of guard limitations alongside their negative controls.

### Known and scheduled items retained without reopening

The supplied five items stay backlog under the existing ruling: **A2A2-3** interior series gaps bridged by a straight line; **A2A2-4** desktop sparklines spaced by index; **A2A3-7** the no-tape clock's missing instant mark; possible evidence-marker/last-close-label overlap; and **R11** replay sentence without a drawn replay, including duplicate crypto caveats. No new six-criterion breach was established for them. The scheduled follow-up before `'on'` remains the owner's plan. R11 is expressly accepted for the allowlist phase.

## §4 Checks, platform and limits

**Platform:** Windows, PowerShell, Node **v22.20.0**, Java 21 for the Firestore emulator, `TZ=UTC` for Vitest. Linux CI remains the suite of record; neither the full Linux suite nor hosted CI was executed/observed here. Tests used synthetic records and in-memory stores; rules used the local `demo-tradeseven-rules` emulator. The only network-oriented check attempted was the read-only GitHub CI tool, which failed to connect.

### Snapshot and delta integrity

```text
git -c core.autocrlf=false -c core.eol=lf archive --format=tar --output=<external-root>/head-lf.tar 39422435e9a17e586b7592e1277c084ed81da0bf
```

**All 3,747 tracked archive files match their Git blob hashes before and after execution: zero missing, zero changed.** Archive SHA-256: `e4cbf6d643b0ce3f4716b0df84f40712819a677b6e2c29a960bda0ae10ba3b2d`. Dependencies were linked from the existing installation; no installation or lockfile change was made. Initial sandbox attempts at Vitest/Vite failed on Vite's cache write through the dependency junction; the authorized host-access reruns produced the results below. Those startup errors were environmental, not test results.

`819b5fb5..39422435` changes **19 files**: **16** under `src/screens/filmRoomV2/`, Amendment E, the prior Astra review, and the build report. **Zero `api/` files and zero BUILD_RULES §1 paths change.** `7dee5dc6..39422435` contains only `docs/audits/20261008_BUILD_FILM_ROOM_A2.md`. The reviewed screen mode is still **`'off'`** (`src/config/featureFlags.js:2989`). The writer flag is already true at `:2951`, unchanged by this delta; it was not flipped by this review.

| Executed check | Result | Evidence |
|---|---|---|
| Original writer file, unchanged | **2/2 pass**, including regeneration of the same adversarial JSON and original count control | `original-probes.json`, `writer-counts.json` |
| Original screen file before assertion adaptation | **7 pass, 4 fail**; expected adaptation reasons in §1 | `original-probes.json`, `original-screen-probes.txt` |
| Original screen file after disclosed adaptation | **11/11 pass** | `confirmation-probes.json` |
| Independent confirmation suite | **14/14 pass**, with guard limitations explicitly asserted as observations | `confirmation-probes.json`, `confirmation-evidence.json`, `confirmation-writer.json` |
| Independent R12/cardinal follow-up | **2/2 pass** | `boundary-followup.json`, `cardinal-guard-limit.json` |
| Branch screen + gate/helper/flags/allowlist selection | **326/326 pass**, 17 files, zero skipped | `branch-suites.json` |
| Off and non-allowlisted legacy goldens | **9/9 pass** within that selection; first/settled paints under the existing fixed clock/mocks/normalization | `FilmRoomRoute.golden.jsdom.test.jsx` results in `branch-suites.json` |
| Gate / hub helper | **19/19 + 38/38 pass**; helper results retain exactly `{ ready, target, availability }` | Same JSON; constructor at `src/utils/reviewAvailability.js:68` |
| Firestore rules | **404/404 pass**, 23 files; tape/series rules file **22/22** | `rules.json`, `rules.log`; owner rules at `firestore.rules:519`, `:524` |
| `lint:gate` equivalent (`eslint . --config eslint.gate.config.js --max-warnings 0`) | **PASS**, exit 0 | `lint.log` |
| Explicit `vite build` | **PASS**, exit 0; ordinary chunk-size/dynamic-import warnings | `build.log` |
| Client bundle sentinel scan | **PASS** across 86 JS/map/HTML/CSS files: synthetic allowlist UID and server allowlist key/reader names absent; import-boundary suite **17/17** | `bundle-scan.json`, `branch-suites.json` |

The bundle used only synthetic `COCKPIT_ALLOWLIST_UIDS=astra-a2-confirm-private-owner-20261009`. No real allowlist was read. This verifies the source/build non-leak boundary, not a separately deployed bundle.

Main branch selection:

```text
node node_modules/vitest/vitest.mjs run src/screens/filmRoomV2 src/utils/filmRoomGate.test.js src/utils/reviewAvailability.test.js src/config/filmTapeFlags.test.js api/_utils/callRecords/allowlist.test.js --exclude **/astraA2Screen.jsdom.test.jsx --maxWorkers=2 --testTimeout=120000 --reporter=json --outputFile=../branch-suites.json
```

The branch selection was dispatched before the new independent scratch suites were added; its JSON lists exactly the 17 branch files. Scratch suites were executed separately. Rules ran through `firebase emulators:exec --only firestore --project demo-tradeseven-rules` using `vitest.rules.config.mjs`. `checks-summary.json` records all totals. No claim is made that the executor's 102 historical mutants were rerun. The DOM guard attacks here do not mutate tracked product code. No new independent reviewer agent or fresh browser screenshot pass was used; the review's attempted refutations and controls were performed in this session.

**Founder actions before allowlist:** no additional product prerequisite beyond the existing reports/rulings was established. Commit supplied Addendum 3 as already instructed when preparing merge; retain the existing separate flip process and real-tape checks. This report does not supply the missing Linux CI result at `39422435`; that status remains for the owner's normal merge review. No approval or flip was performed here.

**Final state:** supplied checkout unchanged and clean; all tracked archive bytes unchanged; report delivered externally for the requested `docs/audits/20261009_ASTRA_CONFIRMATION_FILM_ROOM_A2_SCREEN.md` destination.
