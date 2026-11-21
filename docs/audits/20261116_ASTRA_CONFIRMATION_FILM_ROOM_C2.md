# Astra — Confirmation review: Film Room C2 after the fix round

**VERDICT: MERGE.** All four findings are closed under the governing amendments. No new criterion breach was reproduced; the merged-tree suite, rules, lint, build and exact-head CI passed.

**Date:** 2026-11-16. **PR:** [#1074](https://github.com/fashraf94/TradeSeven/pull/1074), `claude/film-room-c2-excerpt`. **Reviewed head:** `8f59940f7758a72735713bdb39a9716f1f8fc8f1`; code head `7ff64780`. **Previous review:** `c8f9adb20d418a92ce81c93929c46485101daa6e`. **Current remote main:** `71bc6bde7c0553cdb16e5c5f3752d248968967c3`.

This is a read-only confirmation of `git diff c8f9adb2 8f59940f`: **30 files, +3,122 / −563**. It applies the original seventeen criteria, Amendments D and E, and the founder-supplied Amendment F, CF-1 through CF-11. It does not reopen the accepted remainder of C2. Criterion 10 retains only C1 §8 rulings 1 and 2 as declared cards-off exceptions. No new criterion is introduced.

All source statements below marked **VERIFIED** refer to this exact head, inspected during this review. The executor's §11 was used as a checklist of claims, not as substitute evidence. The original Astra probes were recovered from the previous evidence bundle and rerun independently. No product fix was made. This report and all review files are outside the checkout.

| Decision area | Confirmation |
|---|---|
| C2-F1–F4 | All four **closed** under the governing D/E/F contract; qualifications below are explicit. |
| Amendment D's five code rulings | Satisfied within the previous review's §5 boundaries. |
| Amendment E | Satisfied; CF-2's text-policy limits and CF-11's static-guard threat model retained. |
| New criterion breaches | None reproduced. |
| Card-route differential / cards-off screen | 23/23 result rows byte-identical; 12/12 fresh goldens byte-identical to main and the committed baseline. |
| Merge tree | Conflict-free; exactly the head tree. |
| Exact-head CI | Tests run 43954004829 completed successfully; read once. |

## 1. C2-F1 to C2-F4

### C2-F1 — closed

**VERIFIED, criterion 17, as bounded by CE-1 and CF-2.** The producer now omits a whole disallowed quotation. The shared policy is `src/utils/promptBoundText.js:39`, `:110`; the known-ID set is `src/utils/filmRoomSubject.js:91`; the excerpt passes that set to all six remaining quotation locations through `api/_utils/filmRoom/momentExcerpt.js:371`. The meeting quotation no longer exists.

I reran **all seventy original source-to-output combinations**, retaining the original ten strings and seven source locations. Their precise results matter:

- **58/70 no longer carry the planted string.** This includes all ten meeting cases, because the entire meeting block is absent.
- **12/70 still carry the two arbitrary strings** `nom-planted-7f3a` and `book-planted-91c2` in the six remaining quotation locations when the original fixture does not name either ID. These strings are neither a minted nomination/book shape nor known IDs in that fixture. They are not evidence of a failure of the now-governing CE-1 policy. A plain arbitrary slug is not promised universal detection.
- I repeated the same **70 cases after supplying those exact nomination/book IDs in the card's nomination metadata**. **0/70 carried the planted ID**; all seventy target quotations were absent. This verifies the exact-ID obligation without silently changing or discarding the original results.

The original real-writer attack was rerun: `Refer to Ab3dEf7hIj9kLm1nOp5q` remains the player's message on the tape, but is absent from `excerpt.directive.playerText`. The card request's real `normalizeNote` accepts the planted notes; passing its result through the real card builder and excerpt omits `inputQuote` for all ten supplied/recognized ID kinds. This is the original probe's request-validation/build path, not a claimed end-to-end HTTP/browser submission.

Independent controls carried ordinary ticker/price/date/percentage and long-word prose unchanged in all six surviving locations. The seventh, diagnosis, stayed absent. The old code-point-bound checks were rerun with the diagnosis expectation changed to absence. The structured-domain probes omit out-of-domain symbol, situation, route, question, reason, mechanism and bought symbol. All **25 shaped examples in the 30-kind registry** are recognized; the remaining five kinds explicitly have no general shape. The current source and minting sites were inspected, including UUIDs, auto-IDs, prefixed/hex IDs and timestamp composites.

CF-2's exclusions remain real: unknown no-digit auto-IDs/UIDs, glued unknown IDs, line-break splits, homoglyphs and combining marks may pass; coined tokens matching an ID shape may be omitted. This is a bounded identity policy plus the future W-06 wrapper, not a universal de-identification guarantee. No new gap against that governed policy was reproduced.

**Evidence:** `runtime-probes.json` (`ids`, `validatedNotes`, `realWriterDirective`, `recordedIdFields`); `confirmation-runtime.json` (`knownIds`, `realCardRequest`, `prose`, `policyKinds`, `limits`).

### C2-F2 — closed

**VERIFIED, criterion 16.** The original regex-after-`if` suffix was planted independently on **all twenty real roots** with the original census probe. **20/20 now report an excerpt route; zero return an empty defect list.** The unchanged graph continues to pass.

`api/_utils/filmRoom/__fixtures__/jsSource.js:51`, `:71`, `:127` uses `@babel/parser` with JSX and a source-keyed cache. `oneDoor.census.test.js:202`, `:212`, `:272` checks opaque loads and follows resolved edges. Independent additional cases cover default/named/namespace/side-effect imports, same-line imports, all standard re-export forms, static `require`, dynamic import strings/templates/options, query/fragment/percent-encoded paths, and the alias. Regex suffix cases after `while`, `for`, `for…of`, `do…while`, `else`, `return`, arrow expressions, `switch` and `try/finally` also expose the planted edge. **26/26 positive syntax cases pass**, plus the alias control; five string/template/comment/JSX/regex false-edge controls remain clean.

**15/15 independent fail-closed cases refuse:** parse failure, unresolved local module, HTTPS/data/virtual/protocol-relative URL, computed import/require, module-loader imports/re-exports/require, loader names/static keys, and `import.meta.glob`. Parse errors name the module. These tests use the census's injected-reader interface, so changing a synthetic file does not reuse its production file cache.

The nine independent AST closures match the actual census exactly (§4). No ordinary module form tested or encountered in those walks escaped. This conclusion uses CF-11's ordinary-code/honest-mistake threat model; it does not claim to defeat deliberately evasive loaders or write spellings.

**Evidence:** `census-probes.json` (`paths`, `syntax`, `planted`); `confirmation-census.json`; `closure-audit.json`.

### C2-F3 — closed

**VERIFIED, criterion 15.** `src/utils/filmRoomSubject.js:54` validates the calendar and clock before returning an instant. Every timestamp carried by the excerpt and its direct temporal comparisons use `instantText`/`instantMs`: quotation times, card filing, moment boundaries, both time tie-breaks, and exit/bar comparisons (`momentExcerpt.js:143`, `:298`, `:389`). The unchanged shared moment helper remains subject to CF-3.

The original date-only, timezone-less, loose-string, February 30 and 24:00 exit probes now produce **no `afterExit`**. Impossible quotation timestamps become `at: null`, preserving eligible words. Independent probes also exercise April 31, a non-leap February 29, minute/second 60 and `+24:00` across exit, rationale, directive, idea, note, filing and moment-boundary sources. All nine invalid forms were refused; leap-day, offset and minute-resolution controls passed. The R6 sale-by-check boundary remains independent of time.

The bar reader rejects a non-strict object-row start before choosing/counting bars, requires a classed latest close, counts distinct starts, and does not fall back to an earlier bar. Both directive and exit time tie-breaks require every competing instant to be strict before using time. CF-8 and CF-9 are preserved.

**Evidence:** `runtime-probes.json` (`times`, `strictInstants`, `exitBoundary`); `confirmation-runtime.json` (`times`, `validTimes`); the passing strict-time/tie/bar rows in the full suite.

### C2-F4 — closed

**VERIFIED, criterion 15.** The six original conflicting-tie attacks now omit their fields in both orders. `oneOf`/`earliestBy` compare the selected raw payloads at the selecting key (`momentExcerpt.js:138`, `:143`), at the rationale, directive, exit, tag-count, recorded-count and latest-bar selections (`:211`, `:231`, `:261`, `:324`, `:298`). The exit conflict also removes `afterExit`.

Independent expansion tested **six selections × conflicting/identical twin × eight orders = 96 results**. All conflicts were absent; every identical-twin control matched the untied answer. The duplicate bar leaves `barsAfter` unchanged. No input order changed an answer.

**CF-3 precision:** the recorded *interior* twin case is `null` for both exports in every tested order. I additionally duplicated each ETN check 15–19. Interior checks **16, 17 and 18** split the original 15–19 moment and return `null`; duplicates at **15 or 19** retain the original moment and return the same excerpt in every order. Thus “an identical twin gives null” is not a universal statement about every boundary position. The recorded interior case is confirmed; the boundary controls satisfy CE-4's identical-as-one result. This is not a criterion breach or a request to change the shared judge.

**Evidence:** `runtime-probes.json` (`ties`); `confirmation-runtime.json` (`ties`, `twins`).

## 2. The round's boundaries

All rows are **VERIFIED** against the governing rulings, including CE-5's corrections and CF-1–CF-11.

| Ruling / section | Result and boundary evidence |
|---|---|
| **CD-3 — sector name** | Satisfied. One shared directory projection returns the name, including multiword names; missing symbol/name gives none (`filmRoomSubject.js:108`). ETN reads **Industrials**, with screen/excerpt equality. No extra read. |
| **CD-8 — frozen carriage** | Satisfied, including all four §5 completeness details. (1) `ownedDayOf` returns the already-read battle; no second battle lookup (`momentExcerpt.js:160`, `:193`). (2) Version provenance is explicitly **recorded**, bound to `agentContext.equippedHypothesis.hypothesisVersion`, on both sides (`filmRoomSubject.js:133`; `FilmRoomCardRegions.jsx:167`). (3) Owner/list/version/hash agreement is checked (`filmRoomSubject.js:159`): foreign/contradicting version gives **no idea**; missing/failed version gives the idea without its statement. (4) Both carriage censuses, fixture/hash, read scopes, goldens and screen bindings are updated. No calls fallback and no frozen-statement fallback. The real-writer carriage tests cover ordinary deploy, no carriage, and a tournament handed malicious carriage options: all three pass. |
| **CD-14 — one note home** | Satisfied. `cardOf` returns structural card fields plus a separate note; only `inputQuote` receives the quotation (`momentExcerpt.js:342`, `:409`). `card.note` is absent. Original bounds and omission controls pass. |
| **CD-16 — no meeting** | Satisfied. The excerpt never projects the meeting block (`momentExcerpt.js:246`). My independently forged owner-history diagnosis survives the **real tape writer**, but neither `meeting` nor the forged words appears in the excerpt. The owner screen's meeting tests still pass. Remaining source authority is unchanged from the accepted review; no new owner-writable source was introduced. |
| **CD-17 — digest sentence** | Satisfied. The installed/adopted digest adds the same `T.chain.adoptedNote` used by the chain (`FilmRoomCardRegions.jsx:685`), verified by the passing render tests. CF-5 separately assigns the once-per-Adopted-heading sentence to the next build. |
| **CE-1 — identity policy** | Satisfied under CF-2. One shared module; exact IDs, pinned minted shapes, whole-quotation omission and structured domains. The original 70-case replay and its 12 governed-limit outcomes are disclosed in §1; all 70 supplied-known-ID cases pass. The subject line uses the same statement policy and known-ID helper. |
| **CE-2 — parser** | Satisfied under CF-11. AST extraction, fail-closed unresolved/opaque loads, and query/fragment/percent resolution are present. Every current path, root, reach pin, direct-edge exception and whole-closure ledger rule remains. Independent nine-path comparison and ordinary-syntax/failure probes pass. |
| **CE-3 — strict instants** | Satisfied. One strict parser behind carried instants, both time tie-breaks and `afterExit`; absent facts remain absent and invalid quotation times are null (§1). |
| **CE-4 — ties** | Satisfied. All six original ties and 96 permutation/control results pass. Conflicts omit dependents; duplicate bars count once. CF-3's recorded interior-null case is confirmed, with the boundary qualification above. |
| **CE-5 — D's completeness/corrections** | Satisfied. CD-8's four details above are complete. Wrong owner/list/version/hash means no idea; missing or failed version means statement absent. Denied screen reads retain symbol/sector without the idea; loading/error suppress the line. CF-4, CF-6 and CF-7 are applied without adding a list read or hash recomputation. |
| **CE-6 — settled backlog** | Satisfied. Both exports validate before destructuring (`momentExcerpt.js:427`, `:448`); fourteen malformed-argument calls return null. Failed core reads return null, failed version/series reads give the specified partial result. §11.12 expressly says this is neither a consistent snapshot nor a commit-time receipt. Nine paths/twenty roots are pinned. The old same-line/options/false-string import gaps close with CE-2. |

**Dependency declaration.** The complete `package.json` and `package-lock.json` diffs each contain exactly one added line: `"@babel/parser": "7.28.5"` in the root devDependencies. The resolved parser was already 7.28.5 in the old lock. No other package field, lock entry, resolution or integrity value changed. Existing Linux dependencies were reused; the installed-version check found **1,119 packages and zero mismatches**. The old and new lock-file hashes differ because of that declaration, not an installed-version change.

**Executor fixes.** I read the full §11.10 disposition list and the final §11.12 consumer contract. The affected behavior is covered by the independent reruns plus the passing current tests: import resolution/opaque loaders; static loader keys; call/member write names and client-SDK writes; moment version/boundary agreement; auxiliary-read failure; ordinary-prose controls; additional known IDs; invisible-character normalization; and clone-parent subject-line suppression. CX3-3, CX3-4, CXV-8, CXV-9 and the CF-2 limits are retained exactly as ruled. I did not rerun the executor's entire mutation campaign or claim its rows as my independent probes.

## 3. New findings

**None.** No new breach of the seventeen criteria was reproduced in the reviewed round.

Two apparent contradictions were tested rather than promoted into findings:

| Candidate objection | Refutation / disposition |
|---|---|
| The original two arbitrary nomination/book strings still appear. | Confirmed as an observation, **refuted as a CE-1 breach**: they are neither known in the original fixture nor minted shapes. Supplying them as known IDs closes all twelve cases. No blanket “70/70 original strings blocked” claim is made. |
| Every identical tag twin should return null under CF-3. | **Refuted as a universal reading**: the recorded interior case does return null in every order; endpoint duplicates retain the same valid moment in every order and match the untied excerpt. No nondeterminism or criterion breach results. |

There is therefore no new finding requiring a proposed product fix. The only future changes remain those already assigned by Amendment F.

## 4. Regressions and the off path

### Shared day check and read-only excerpt

**VERIFIED.** The fix round changes neither `sourceDay.js`, the card route, nor `filmRoomMoments.js`. I reran the prior **23-row** main/head differential using the original fixture in both private trees: source/create/nominate results, status/code/message, refusal order, exception identity and transaction read sets are **byte-identical**. This confirms the route contract; it does not assert that C2's extracted source file exists byte-for-byte on main.

The independent AST closure audit finds **15 modules**, the previous 13 plus `promptBoundText.js` and `situationRegistry.js`. Its only write-shaped calls are:

- `api/_utils/filmTape/tapeSources.js:95`: `present.add(evalIds[i])`, a local Set.
- `src/utils/filmRoomMoments.js:45`: `groups.set(key, [])`, a local Map.

The declarations and uses were inspected. No database write, model call or log was found in the actual excerpt closure. The current write-gate tests pass, including ordinary computed string methods, multiline/comment-separated calls, member references, client-SDK writes and opaque/unresolved loads. CF-11's evasive spellings remain outside this guarantee.

Original ownership/refusal and read-failure probes pass. The ordinary moment/card uses **four/five plain document gets**; the clone adds the owned clone and owned parent, giving **six/seven**. The battle is read once. No query, transaction or collection scan was added. Foreign/missing core records, wrong attribution and removed source return null; read exceptions expose no reason. Malformed arguments return null before reading. Auxiliary failures remain partial as CE-6 specifies. The mixed-revision probe still reproduces separate-get semantics; W-05 remains necessary in the consumer.

### Nine-path census

**VERIFIED.** My independent AST comparison reproduces §11.2 exactly:

| Path | Main's former extractor | Current parser | Independent AST | Current defects |
|---|---:|---:|---:|---:|
| evaluator | 252 | 253 | 253 | 0 |
| deploy | 118 | 118 | 118 | 0 |
| chat | 138 | 138 | 138 | 0 |
| voice | 120 | 120 | 120 | 0 |
| reflection | 165 | 165 | 165 | 0 |
| batchReview | 120 | 120 | 120 | 0 |
| debate | 17 | 17 | 17 | 0 |
| tournament | 93 | 93 | 93 | 0 |
| mandate | 82 | 82 | 82 | 0 |

The sole difference from main's old walk is the already-known `src/config/huddleFlags.js` edge swallowed by its comment stripper. No current path verdict changes. The drafting exception remains latent and direct-edge-only; no existing path is admitted. The ledger is still checked across the whole closure (`oneDoor.census.test.js:272`).

### Screen, vocabulary and fences

**VERIFIED.** The version read remains gated by `cards.on === true` and a written tape (`FilmRoomScreenV2.jsx:261`). The rendered cards-off subject test asserts no line and **zero idea reads**. The live screen test covers a clone's parent-known/pending state; the receipt/form compare their lines to the actual excerpt. Version number provenance binds to the battle's carriage, not a fictional calls path. All fifteen subject-line tests pass, as do the cards and meeting render suites.

The adopted chain/digest sentence is present in the requested surfaces. CF-5's My cards heading item remains next-build work. No additional cards-off exception is introduced: **all twelve freshly rendered head goldens equal main and their committed files byte-for-byte**, with SHA-256 evidence in `golden-comparison.json`.

Neither the round nor the complete branch diff touches the calibration fence files, including explicitly `api/_utils/agentBattleService.js` and `api/agent/decide.js`. The checked C2 fences also include evaluator/clone code, rules/indexes and feature flags; no activation change was made. `src/config/featureFlags.js:3536` remains `FILM_ROOM_CARDS_MODE = 'allowlist'`. The allowed real-writer tests call fenced exports without editing them.

## 5. Backlog

These are accepted work or limits, **not findings or added merge criteria**.

| Item | Owner / disposition |
|---|---|
| CF-5, My cards' Adopted heading sentence | Next Film Room build: once under the heading, not per row. No installed card is player-visible before Practice Field T3 under the governing ruling. |
| Amendment F and this confirmation's repository commit | Next Film Room build, including the Amendment F `docs/README.md` row; no separate docs-only PR. This review leaves them outside the checkout. |
| CF-11's cheap loader denylist | Practice Field T1b + T1d, when adding drafting to the census: pin `eval`, `new Function`, `node:vm` and `node:worker_threads` as fail-closed loads. The deliberately evasive CXV-8/CXV-9/runtime-key class remains governed by review. |
| CF-2 identity-policy limits | Retain the stated exclusions and over-omission behavior; W-06's player-supplied-evidence wrapper remains the second layer. |
| CF-3 shared moments | Preserve the shared day judge. The recorded interior twin is null; endpoint duplicates are deterministic untied answers, as documented in §1. |
| CF-4/CX3-3 and CF-6 | Keep the version-owner versus parent-list rule distinction and stored-hash comparison as ruled. No extra list read or hash recomputation requested. |
| CF-7–CF-10 | Keep failed-read screen silence, minute-resolution instants/earliest-sale tie-break, strict bar/latest-close behavior, and the writer-table-only exit reasons. |
| Consumer integration | W-05 rechecks, W-06 wrapping/budgeting and W-07 input ordering remain the Practice Field's. The excerpt is not a transactional eligibility receipt. |
| Earlier accepted backlog | Unchanged C1/C2 findings and accepted Amendment A–E limitations remain as previously assigned; this confirmation does not expand the build. |

## 6. Review record

### Snapshots, platform and merged tree

The shared checkout started on `main` at `71bc6bde`, with five pre-existing modified experiment files and pre-existing untracked artifacts. It was not switched, cleaned or edited. A live remote lookup confirmed main; the requested commits were fetched into a **private object directory**, using the checkout objects as a read-only alternate, without updating checkout refs/FETCH_HEAD.

Archives were made with `git -c core.autocrlf=false -c core.eol=lf archive`. Initial raw Git-blob verification found zero mismatches: **5,235 head files**, **5,212 main files**, and **5,235 merged files**. `git merge-tree --write-tree` produced no conflict and tree **`8cda9603b1c6d16a74dc0c9f015ddf5703238df3`**, exactly the head tree. This is a private merge calculation, not a branch merge or commit.

Windows host; execution in **WSL Ubuntu/Linux x86_64**, Linux filesystem, **TZ=UTC**, Node **22.22.2**, npm **10.9.7**, Temurin Java **21.0.13**. Dependencies were linked from the existing Linux install after checking its installed package versions. No package installation was required. Cloud credential environment variables were unset for test/emulator commands; no `.env` credentials were copied. Rules tests use a synthetic `demo-*` emulator project.

| Check actually run | Result |
|---|---|
| Full unit/jsdom suite on merged tree | **PASS: 1,510 files passed, 12 skipped; 34,161 tests passed, 135 skipped; zero failures.** 663.94 seconds, four workers. |
| Full Firestore rules suite on merged tree | **PASS: 42 files, 784/784 tests**, zero failures, 238.41 seconds; emulator shut down successfully. |
| `npm run lint:gate` on merged tree | **PASS**, exit 0. |
| Explicit `vite build` on merged tree | **PASS**, exit 0, 35.72 seconds; ordinary bundle-size warnings recorded. |
| Original runtime probes | Rerun with documented D/E expectation adaptations; outcomes and all 70 original text rows retained (§1). |
| Original census / closure probes | **PASS after harness adaptations:** nine path walks, twenty real-root suffixes, fifteen-module closure. |
| Independent confirmation probes | **PASS:** 70 supplied-known-ID cases; 96 tie/control permutations; malformed/strict-time, carriage, forged-writer and clone ownership controls. |
| Ordinary syntax and fail-closed probes | **PASS:** 26 positive syntax cases, 15 refusal cases, five false-edge controls and alias resolution. |
| Prior route differential | **PASS:** 23/23 result rows byte-identical, two Vitest cases in each tree. |
| Fresh cards-off captures | **PASS:** 12/12 head = main = committed bytes. |
| Snapshot / checkout integrity | **PASS:** final Windows and Linux original-blob checks found zero mismatches in all three snapshots; checkout SHA and short status unchanged. |
| Exact-head Tests CI | **PASS**, single observation described below. |

**Harness qualifications, not hidden green runs.** The unmodified old runtime script stops on its obsolete expectation that a meeting diagnosis is carried. The adapted copy changes only superseded D/E expectations/source assumptions, preserving the seventy original rows. The old census script stops when its synthetic alias fails closed; the adaptation records that exception and makes its repeated timing sample valid JavaScript (`var` rather than duplicate `const`). Both adaptations are preserved in `adapt-probes.cjs`, alongside the untouched originals. The additional changing-file syntax harness initially used the census's production file cache; it was corrected to pass a fresh injected reader. Main's first differential run lacked the new test-only fixture directory; after creating it in scratch and copying the *old* fixture, it passed. The forged-meeting harness initially changed its status to a writer-ineligible shape; retaining the original status while forging the diagnosis produced the intended real-writer evidence. No product source was changed for any of these corrections.

This was a single-reviewer confirmation with separate source, runtime, AST, UI/off-path and regression checks. The counterexamples were reproduced independently of the executor and potential objections were refuted above. I did **not** run an additional subagent refuter or a fresh full mutation campaign; this report must not be represented as one. No PR review/comment, commit, push, merge, deploy, refresh, backfill, rule/index deployment or production access occurred.

### Tests run — one read

The single successful run observation was on **2026-11-16 at approximately 21:11 UTC**. [Tests run 43954004829](https://github.com/fashraf94/TradeSeven/actions/runs/43954004829) is **completed / success** for exactly `8f59940f7758a72735713bdb39a9716f1f8fc8f1`. All four unit shards, unit guards, Firestore rules/emulator job and final unit aggregation report success. The PR snapshot was open, non-draft and mergeable, with the expected head/base. No CI polling or rerun was performed.

The GitHub connector could not initialize. Automatic approval review rejected a credential-reuse fallback; it was **not executed**. Unauthenticated GitHub API reads then succeeded and supplied the run/jobs/PR observation without credential extraction. Nothing remains blocked by that rejection.

### Evidence

The accompanying `20261116_ASTRA_CONFIRMATION_FILM_ROOM_C2_EVIDENCE.zip` contains original/adapted probe sources, JSON results and logs; source manifests and full round diff; CI observation; route and golden comparisons; Linux test logs/JSON; and integrity records. `setup.cjs`, `baseline.sh`, `probes.sh`, `regressions.sh`, `adapt-probes.cjs`, `summarize.cjs` and `verify-linux.cjs` preserve the commands. Private harness additions are test support only, not changes to tracked product files. Paths in scripts identify this review's scratch trees.

## Before merging

**No additional founder action or new ruling is required by this confirmation.** Amendment F already assigns its documentation, CF-5 and the later CF-11 denylist. This verdict is a recommendation for the reviewed head; the founder retains the merge decision. No production operation or feature activation is part of this review.
