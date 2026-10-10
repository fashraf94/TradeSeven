DO NOT MERGE

# Astra — Film Room A2 screen review

**Date:** 2026-10-08. **PR:** #944, `claude/film-room-a2-screen`. **Reviewed head:** `819b5fb5a1791773a9f81a6e8f91d20d3467df69`. **Fetched base, origin/main:** `7631c9e6e277175b1da6e2c6d8b227e5e7a88738`. The pull-request head ref independently returned the same reviewed SHA.

**Read-only delivery:** this file is outside the checkout, under the requested `docs/audits/` suffix. No product source was edited; nothing was staged, committed, pushed, merged, deployed, or flipped. The checkout began and ended detached and clean at the base SHA above. Fetch updated remote-tracking metadata only.

**Evidence root:** `C:/Users/fashr/.codex/visualizations/2026/10/08/01a11dec-6bb9-7731-bb8a-9d50594b403e/film-a2-review/`. Artifact paths below are relative to this root; source citations are repository paths at the reviewed SHA.

**Governing inputs:** `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md` §7, §8, §11; Amendments A–E, including E's 2026-10-08 R1–R6 addendum; `docs/design/20261008_FILM_ROOM_A2_MOCKUP.html`; and the claims in `docs/audits/20261008_BUILD_FILM_ROOM_A2.md` §1–§6. The user's six fixed criteria determine the verdict. The build report's earlier dispositions are claims to verify, not additional exemptions.

| Blocking finding | Fixed criterion | What the player sees |
|---|---|---|
| F1 — recorded text bypasses the forbidden-word boundary | 2 | “This is the best entry.” in the rationale preview |
| F2 — an incomplete morning series is labelled as reaching the close | 3 | A chart ending at 10:00 AM ET labelled “close” |
| F3 — battle duration has no provenance marker | 1 | “one-day battle,” an unmarked numerical duration claim |

All three are **VERIFIED by mounted execution on unchanged PR source**. F1 and F2 use output generated through the real tape writers over synthetic source records. F3 uses the ordinary complete fixture and its battle timeline. These are local reproductions, not claims that a particular production user has encountered them. The screen remains dark by default; the fixed merge criteria still apply to its enabled behavior.

## §1 Blocking findings

### F1 — Forbidden words in stored text render directly

**Repro.** Start from `sep23Day()`. Change one non-error evaluation's rationale to `This is the best entry.` Run the real `writeTapeDay` and `runCandlePass` through `buildTapeDay`. The resulting tape retains that exact rationale. Mount `FilmRoomStudy` with that writer output: the phrase is visible in the collapsed rationale preview, without requiring “Read more.” The branch's own `sweepWords` reports `['best']`; the acceptance assertion expecting an empty list fails.

**Evidence.** `api/_utils/filmTape/tapeAssemble.js:652` copies eligible rationale and hypothesis strings without a vocabulary boundary; `src/screens/filmRoomV2/FilmRoomStudy.jsx:424` attributes the quotation, then `:426` and `:427` render its hypothesis and rationale directly. The forbidden list includes `best` at `src/screens/filmRoomV2/filmRoomCopy.js:249`. The all-text/aria-label/title sweep is at `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx:308` and `:317`. The company-name filter at `src/screens/filmRoomV2/FilmRoomDeepDive.jsx:45` protects company display names, not these recorded strings. Directive text/replies and plan prose also render recorded text directly (`FilmRoomStudy.jsx:333`, `:340`, `:395`).

**Attempted refutation.** Historical attribution is present and satisfies the agent-voice constraint. It does not grant a forbidden-word exemption under criterion 2. R1 exempts numbers inside stored quotations from markers; it does not exempt their vocabulary. The existing sweep likewise scans quotations. The unchanged canonical fixture and the complete company-directory sweep both pass; this failure depends on admissible source text, not on a false-positive company-name check.

**Fix I would make, not made.** Apply the fixed vocabulary boundary to every displayed source-text channel, including quoted rationale, hypothesis, directive text/replies and plan prose. Preserve the tape's original strings. When a quotation cannot be displayed under that boundary, omit that quotation with a neutral notice; do not silently rewrite it and continue to present it as verbatim. Add writer-to-screen cases containing each forbidden phrase, including preview and expanded states and attribute text.

**Reproduction artifacts:** `snapshot-lf/api/_utils/filmTape/astraA2Writer.test.js`; `snapshot-lf/src/screens/filmRoomV2/astraA2Screen.jsdom.test.jsx`, F1; `repro-words.html`; `lf-screen-probes.json`. These are external review files, not PR changes.

### F2 — “Close” is asserted at the end of any available series

**Repro.** Feed the real candle pass only the first 30 one-minute INTC bars of the Sep-23 fixture, retaining the other symbols' full bars. The writer produces three INTC ten-minute bars. The last starts at `2026-09-23T13:50:00.000Z`, so it ends at **10:00 AM ET**, and the tape explicitly lists INTC in `passes.candles.symbolsIncomplete`. Mount Deep dive on INTC. The axis reads `9:30` at the left and `close` at the right, although that right endpoint is 10:00 AM. The negative assertion against the incorrect endpoint label fails with `9:30close`.

**Evidence.** `src/screens/filmRoomV2/FilmRoomDeepDive.jsx:73`–`:74` sets the chart end to the last available bar's start plus ten minutes. `:165`–`:168` labels the right end `COPY.close10` unconditionally. The screen already recognizes this data as insufficient for session claims: `src/screens/filmRoomV2/filmRoomModel.js:518`–`:522` suppresses open-to-close change and session volume when this symbol is incomplete. That guard is not applied to the chart's endpoint label.

**Attempted refutation.** The side fact “Close · the last 10-minute bar” is qualified and is not this finding. The defect is the time axis's unqualified session endpoint. A partial-coverage statement elsewhere does not turn 10:00 AM into the close. R4(b) permits unmarked scaffolding; it does not permit scaffolding to contradict the series timestamps. The full-session control correctly retains “close,” and the incomplete-series control correctly suppresses the computed session facts. Both controls pass.

**Fix I would make, not made.** Derive the trading session end from the shared calendar. Either retain that full session span and leave the missing tail blank, or label an early-ending plot with the actual last-bar time. Use “close” only at the actual session-close instant. Cover incomplete regular sessions and early-close sessions with real candle-pass outputs.

**Reproduction artifacts:** the writer-generated `snapshot-lf/src/screens/filmRoomV2/__fixtures__/astra-writer.json`, F2 in `astraA2Screen.jsdom.test.jsx`, and `repro-partial-series.html`.

### F3 — Spelling a duration as a word bypasses every-number provenance

**Repro.** Mount `FilmRoomScreenV2` with the complete Sep-23 tape and a battle whose `timing.tradingDays` contains its one session. The subtitle contains `one-day battle`. Its duration element has no class marker and no declared aggregate/path binding. The acceptance assertion requiring a marker returns `null`.

**Evidence.** `src/screens/filmRoomV2/FilmRoomScreenV2.jsx:93`–`:99` calculates duration from the timeline length, or falls back to the final tape's `dayNumber`, then converts the value into an English number word. `:213`–`:215` renders it as plain text. `src/screens/filmRoomV2/filmRoomModel.js:60`–`:73` declares the screen's permitted aggregates but contains no duration declaration. The build report itself acknowledges the unmarked word at `docs/audits/20261008_BUILD_FILM_ROOM_A2.md:461`–`:464` and calls it a ruling request.

**Attempted refutation.** This is a claim about the battle's duration, not a company identifier, quotation, axis tick or sequence label. “One” expresses the same numerical claim as “1.” The design's word-based styling does not override BA-42 as narrowed to claims by R4. Neither R1 nor R4(b) exempts it, and the addendum did not adopt the build report's proposed duration exception. This finding therefore belongs under the fixed criterion, rather than staying backlog merely because it was placed there in the build report.

**Fix I would make, not made.** Keep the word-based styling if desired, but render the timeline count through a declared `derived` aggregate and marker. If using the tape's `dayNumber` fallback, bind that value to its own document declaration. Add a semantic duration assertion; a sweep looking only for digits cannot cover a spelled-out quantity.

**Reproduction artifacts:** F3 in `snapshot-lf/src/screens/filmRoomV2/astraA2Screen.jsdom.test.jsx`; `repro-duration.html`.

## §2 Backlog — does not affect the verdict

1. **Writer volume missingness. VERIFIED source behavior.** `api/_utils/filmTape/bars.js:74` converts a missing/non-finite provider volume to zero; `:134`–`:135` aggregates it. The screen's sum faithfully matches the stored series, so this is not a screen-versus-tape contradiction. Preserve missingness in a later writer change if session-volume completeness needs to distinguish missing data from legitimate zero volume.
2. **Tab keyboard behavior. VERIFIED source behavior.** `src/screens/filmRoomV2/FilmRoomKit.jsx:278`–`:285` provides tab roles, selection and click behavior, but no arrow-key handler or `aria-controls` binding. Add the expected keyboard relationships in an accessibility task. This is outside the six blockers.
3. **Classed fields for counts embedded in stored notes. Accepted R1 backlog.** `src/screens/filmRoomV2/FilmRoomKit.jsx:170`–`:175` quotes coverage notes. Keep the existing quotation exemption; introduce explicit classed fields when the tape writer is next changed, as R1 directs. This review does not promote those quoted digits to blockers.

The adopted R2 default-hold wording, R3 direct mode pin, R5 “takeaway” ruling, R6 clamped preview, and allowlisted first-open legacy interval remain accepted. No additional founder rule is proposed.

## §3 Checks run

### Provenance, platform and scope

**Platform:** Windows, PowerShell, Node `v22.20.0`, npm `11.7.0`, Java 21. **Linux CI is the suite of record.** It was not run or independently verified in this review. The build report's Linux results at its earlier named code heads are not represented here as current-head CI evidence. No production records, credentials, live cron runs or rules deployments were used.

The authoritative snapshot was created with:

```text
git -c core.autocrlf=false -c core.eol=lf archive --format=tar --output=head-lf.tar 819b5fb5a1791773a9f81a6e8f91d20d3467df69
```

It is under `snapshot-lf/` beside this report's evidence root. All **3,744 tracked files** match their reviewed Git blob hashes; none is missing or modified. Additional probes and generated fixtures are untracked files in that external snapshot only. The archive's SHA-256 is `35446a05d27e0993c01279ded33c151bca974a5eee4baf35a24385ccbbc87a12`.

**Setup correction disclosed:** the first archive inherited `core.autocrlf=true`. Byte verification caught its CRLF conversion, and it was discarded as acceptance evidence. All required checks and all finding repros were rerun on the verified LF archive. The earlier 403/404 rules result, caused by the source-text assertion seeing a trailing CR, is superseded by the LF run's 404/404. Product code was not changed to make that test pass. Initial dependency-junction setup also required host access; this affected test startup, not source behavior.

`origin/main...reviewed-head` changes **60 files**. The intersection with all eleven BUILD_RULES §1 paths is **empty**. The legacy screen remains outside the diff. The added archetype import-baseline entry is a separate ratchet change, not an edit to a §1 file. The shipped mode is still `'off'` at `src/config/featureFlags.js:2989`.

### Executed results

| Check | Result at the LF snapshot | Evidence |
|---|---|---|
| V2, filmTape, gate, helper, flags, cockpit-status and allowlist import guard | **702 passed, 0 failed, 0 skipped**, 30 files | `lf-suites.json` |
| V2 subset | **191 passed**; includes mounted number/word/sign sweeps, both layouts, empty day, reads, reserved slots and review cases | Same JSON |
| `api/_utils/filmTape` subset | **417 passed**; includes writer-rebuilt screen fixtures and check-count cases | Same JSON |
| Tape cron/backfill/real-flag and export entrypoint suites | **48 passed**, 5 files, in-memory stores only | `lf-tape-entrypoints.json` |
| Off/non-allowlisted goldens | **9 passed**, including first paint, settled output, failure responses, single mount and App props | `FilmRoomRoute.golden.jsdom.test.jsx` within the selection |
| Gate and helper | **19 + 38 passed** | `filmRoomGate.test.js`, `reviewAvailability.test.js` |
| Firestore emulator rules suite | **404 passed, 0 failed**, 23 files; Film Room file **22 passed** | `lf-rules.log` |
| Additional owner/other/anonymous list matrix | **6 passed** | `lf-rules-extra.json` |
| Independent writer probes | **2 passed**: writer-produced adversarial fixture; full five-day count matrix | `lf-writer-probes.json`, `writer-counts.json` |
| Independent screen acceptance probes and controls | **8 controls passed; 3 acceptance assertions failed**, reproducing F1–F3 | `lf-screen-probes.json`; these red assertions are findings, not a green acceptance result |
| `npm run lint:gate` | **PASS**, exit 0, before adding scratch probes | `lf-lint.log` |
| `npm run build` (`vite build`) | **PASS**, exit 0; normal large-chunk/dynamic-import warnings | `lf-build.log` |
| Client-bundle allowlist check | **PASS**: synthetic server UID absent from all 86 generated JS/map/HTML/CSS files; allowlist environment key/reader names absent too | `verification.json` |

The main selection command was:

```text
node node_modules/vitest/vitest.mjs run src/screens/filmRoomV2 api/_utils/filmTape src/utils/filmRoomGate.test.js src/utils/reviewAvailability.test.js src/config/filmTapeFlags.test.js api/agent/cockpit-status.test.js api/_utils/callRecords/allowlist.test.js --maxWorkers=2 --testTimeout=30000 --reporter=json --outputFile=../lf-suites.json
```

Rules used `npm run test:rules`, which starts the Firestore emulator. The extra list matrix used the same emulator/config with `test/rules/astraA2Access.rules.mjs`. The production build ran with a synthetic `COCKPIT_ALLOWLIST_UIDS` sentinel set only for that process; no real allowlist value was read or printed.

### Attack coverage and dispositions

| Requested attack | Current evidence and disposition |
|---|---|
| Checks, day 1 and day 2+ | **VERIFIED / prior defect refuted at this head.** The independent writer's five full days each render 40 of 40, with ranges 1–40 through 161–200. The branch's five `screenCheckCounts` cases cover missing leading/interior ticks, entry-only rows and absent capture. `filmRoomModel.js:86`–`:95` switches to “n recorded” for an unplaced recorded row. No new count blocker established. |
| Holdings start, swaps, end, omission | **VERIFIED.** `filmRoomModel.js:361`–`:414` applies swaps and checks the result against the last risk set; missing/inconsistent sets are omitted. Mounted controls confirm both omission cases. Existing slot-by-slot and pre-first-risk-swap tests pass. |
| All exit-maker mechanisms/sources | **VERIFIED.** Independent matrix covers every `EXIT_MECHANISMS` entry across five source values plus unrecorded. `filmRoomModel.js:332`–`:340` distinguishes agent, platform, gameplan and unrecorded; it does not guess an unknown mechanism from source prose. |
| Sale versus fill; replay versions | **VERIFIED.** `FilmRoomStudy.jsx:174`–`:225` binds sale rows to `soldAtSale` and the sold symbol, fill rows to `boughtAtSale` and the bought symbol. Version-one control retains the fork and says the split was not computed. The existing opposite-sign sale/fill tests pass. |
| Day-change reference | **VERIFIED.** `FilmRoomGlance.jsx:65`–`:87` renders the stored reference by its path, with the tape's own marker. Prior-day and battle-start bases remain distinct. |
| Unavailable result and platform completion words | **VERIFIED.** Independent control displays unavailable beside “Platform recorded at completion” and the stored “Result: Draw.” No fabricated result replaces the missing scores (`FilmRoomGlance.jsx:228`–`:239`). |
| Document and aggregate classes | **VERIFIED with F3 exception.** The numeric widgets read the document declaration or named aggregate (`FilmRoomKit.jsx:83`, `:110`). An independent older-declaration control keeps `inputsDelta` rebuilt when that tape declares it rebuilt. Newly written tapes declare it derived. Axis tick scaffolding remains exempt; actual open/last-close values carry their markers. |
| Series-derived open-to-close and volume | **VERIFIED arithmetic.** Full-session control equals last bar close / stored session open − 1 and the sum of all stored bar volumes. Both are suppressed for the writer's incomplete INTC series (`filmRoomModel.js:518`–`:527`). F2 is the remaining false endpoint claim. |
| Words, names, headings, attributes | **VERIFIED with F1 exception.** All current directory names are checked by the independent control; BBY's forbidden company name is suppressed. Existing text/aria-label/title sweeps and no-“Why” heading checks pass on their fixtures. Arbitrary recorded prose breaks that clean result. |
| Tape/series get and list | **VERIFIED on the emulator.** Owner gets and owner-constrained lists succeed; other and anonymous gets fail. Both collections' anonymous lists fail; another user cannot list the owner's data, and that user's self-filtered query returns zero owner documents. Rules are at `firestore.rules:519`–`:526`. No non-owner document read was reproduced. |
| cockpit-status field and error bodies | **VERIFIED.** `api/agent/cockpit-status.js:86`–`:96` checks existence and ownership before computing `allowlisted`. 403/404/500 bodies contain only their errors. The route's 11 tests pass. |
| No client allowlist UIDs | **VERIFIED locally.** The 17-test allowlist suite walks transitive imports from client modules. The LF production build's synthetic UID scan finds no leak. This is a source/build boundary check, not a claim about a separately deployed bundle. |
| Gate call-time read and fail-closed behavior | **VERIFIED.** `filmRoomGate.js:39`–`:48` reads the mode on each call; request failures/malformed answers resolve off. Goldens prove off and non-admitted output under the stated fixture normalization (`FilmRoomRoute.jsx:35`–`:48`). |
| Hub helper's exact keys | **VERIFIED.** The 38-test helper suite covers mode × admitted/not × written/unwritten/absent/error outcomes and timing branches. Every result is exactly `{ ready, target, availability }`; `reviewAvailability.js:68` centralizes construction and `:134`–`:149` handles the outer branches. |

**Limits:** mounted DOM and source/build review were performed; fresh real-browser pixel screenshots were not taken. The build report's historical mutation counts were not rerun or credited as new evidence. No additional reviewer agent was used; the refutation attempts and controls above were executed within this review. The full repository Linux suite and production behavior remain unverified. None of these limits is promoted into an extra merge criterion.

**Final state:** unchanged checkout, unchanged PR source, no §1 fence contact, report delivered as a file only. The three fixes in §1 remain proposals.
