# Build report — Film Room C2: the moment excerpt

**Executor:** Claude Code (Opus), its own worktree, Windows + WSL · **Date:** 15 Nov 2026
**Prompt:** "Build prompt — Film Room C2: the moment excerpt" (the Film Room chat, 15 Nov 2026) · **Governs:** Build C spec V1 (`docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md`) with Amendments A, B and C (C governs where they differ), and the Practice Field's shared contract V2 with its Amendments B, C and D.
**Branch:** `claude/film-room-c2-excerpt`, cut from `origin/main` @ `cb23d73c` after `git fetch origin`. Main held #1049's merge `d9b4e3c1` and #1058.
**Code head:** `e7804bfb`. **Merged head:** `af2fddd1`, current `origin/main` `71bc6bde` (#1073, the CI unit suite sharded) merged in with no conflicts and no shared file. This report's commit sits on top of it. · **PR:** #1074 (opened as a draft; marked ready for review after the push)
**Fix round (16 Nov 2026):** Astra's C2 review and Amendments D and E, built in §11. §11.12 replaces §6 as the excerpt's contract.

## Verdict

| Question | Answer |
|---|---|
| Built? | Yes: B0 and all seven items, one commit each, with their tests in the same commit. The battery's M10 row (`f66faba4`) and the §2 review's fixes (four commits, §7) follow. |
| What changes for a player today? | **Nothing with cards off.** The twelve cards-off goldens are byte-identical to main's, and the screen reads nothing new. **With cards on (the allowlist only):** the form and the receipt show the subject line, and `installed` reads "Adopted as your instruction". No player reaches `installed` today. |
| The excerpt | `api/_utils/filmRoom/momentExcerpt.js`: `excerptOf` and `excerptOfCard`. It is read-only and answers the owner only, with the same `null` for everyone else. It carries labels, never ids, and every field carries its provenance. Its contract for the Practice Field is in §6. Nothing calls it yet: its importer comes with the Practice Field's T1b + T1d. |
| The flag | `FILM_ROOM_CARDS_MODE` is still `'allowlist'`. No flag was added. |
| Tests | Linux, `TZ=UTC`, at the merged head: **1,508 files passed, 12 skipped, 0 failed; 34,006 tests passed, 135 skipped, 0 failed** (exit 0). Rules: 42 files, 784/784 passed, exit 0. `lint:gate`: exit 0, 0 warnings. `vite build`: exit 0. |
| Mutants | **49 of 49 killed** at the merged head `af2fddd1` (every named one among them), judged by exit code and a fresh JSON report; the unmutated baseline of every file they run is green (§5). |
| Goldens | The two excerpt goldens are pinned by SHA-256 (§2). The twelve cards-off goldens were re-captured at the merged head and at main: **12 of 12 byte-identical** to main's, and to the committed files (§2.2). |
| Fences | Held (§4). |
| §2 review | Three lenses, an independent refuter and the mutating lens. **No BLOCKER stands.** 21 findings fixed, each with rows and, where a mutant could bite, a mutant. Seven are readings for the founder (§9: R16–R18 are new, and the rest fold into R2, R3 and R10). |
| CI | BUILD_RULES §2: not watched, polled or fixed. The pushed head's Tests run is read once after the push, and its state is reported on PR #1074. |
| Needs a ruling | 18 items, none blocking (§9). |

## 1. The items

| # | Item | Commit | Tests (same commit) | Mutants killed |
|---|---|---|---|---|
| B0 | Astra's C1 confirmation, Amendment B and Amendment C, verbatim, with three `docs/README.md` rows | `76850c29` | — | — |
| 1 | **The shared day check (CC-4).** `api/_utils/filmRoom/sourceDay.js` holds the judgments as verdicts: owner, coverage, the exact moment, archetype, and, against what was filed, the archetype and the situation version. It also holds the one tape read, through a reader. `momentOfDay` moved there unchanged, and `cardRequest.js` re-exports it. `card.js` keeps no copy: `sourceOfDay` and `checkDayIn` map the shared verdicts to the route's existing refusals and words. A pure refactor. | `827ca964` | `sourceDay.test.js` (16 rows with the review's L2-6). Every existing card, request, store and census row is unchanged and green. | M01, M37 |
| 2 | **The excerpt.** `api/_utils/filmRoom/momentExcerpt.js`: `excerptOf` and `excerptOfCard` (§6). Also the shared subject module's first part (`src/utils/filmRoomSubject.js`: the sector, the bound, the idea). | `a72a7652` | `momentExcerpt.test.js` (19 rows: owner, attribution, source, labels, reads, paths); `filmRoomSubject.test.js`; the fixture `__fixtures__/excerptFixtures.js` | M02, M03, M09, M10 (after its row `f66faba4`), M29–M33, M46–M48 |
| 3 | **The goldens (C-EXCERPT).** The moment and the card, pinned by SHA-256. | `72aa8554` | `momentExcerpt.golden.test.js` (42 rows): the goldens; every field against its source; every bound at its limit and one over; every absence; the id detector and its bite; the speakers; the write gate | M04, M05, M06, M07a, M07b, M08 |
| 4 | **The census (CC-1, C-DOOR).** The exception table, the rule, the Mandate path and the synthetic proofs. | `fe2fac99` | `oneDoor.census.test.js` (83 rows at the head; 80 at the item) | M11, M12, M13, M34, M35, M36, M45 |
| 5 | **The subject line (CC-7).** One projection (`subjectLineOf`, `ideaFrom`) serves the excerpt and the screen. The line shows on the form and the receipt under cards mode, with one new client read under cards mode. Also: the sweeps' CC-7 binding and the inventory. | `becbcaec` | `filmRoomSubject.test.js` (17 rows at the head), `FilmRoomSubjectLine.jsdom.test.jsx` (12 rows at the head), the inventory | M14–M19, M38, M39, M41–M44 |
| 6 | **The "adopted" words (CC-8).** The stage word, the chain line and its sentence, the group, and the `cap_reached` words (server and screen). | `7407cce2` | Updated rows in the card, store, census and screen suites; the inventory's no-"equip" row | M20, M21, M22, M23 |
| 7 | **CC-9.** Retire and park name the card's own agent; BG-1; B6's pin; the seam's JSDoc. | `3a321797` | Screen rows on a clone's battle; BG-1 rows per terminal state; `cardStages.b6Pin.test.js`; the JSDoc row | M24–M28, M40 |

**The review's commits (§7):**
- `328a8df2`: lens 2, the census and the refactor.
- `b5806b1a`: lens 1, the excerpt.
- `6eb8a3ef`: the lexer's speed.
- `e7804bfb`: lens 3, the screen, the copy and CC-9.

Each carries its rows. The merge `af2fddd1` brings in `origin/main` `71bc6bde`.

## 2. The goldens

### 2.1 The excerpt's two goldens (C-EXCERPT)

`api/_utils/filmRoom/__fixtures__/momentExcerpt.golden.json`, built through the real tape writer (`buildTapeDay`) from the Sep 23 fixture as derived in §9 R12. SHA-256 over each golden's canonical JSON (`canonicalHash.js` `stableStringify`):

| Golden | SHA-256 |
|---|---|
| The moment (ETN, checks 15–19, `excerptOf`) | `51a50dd4e947daf128e0b847e0445c872788e0f41c2c7c46135f326f960b302b` |
| The card (the same moment through its filed source, `excerptOfCard`) | `dbd74ab53a684cee25e4883823cf26a5ae7f76d5c048954391f163ea1aa65f6f` |

The suite recomputes both from the live code and compares them with the committed JSON. It also pins the JSON's hash and checks every field against its source on a live excerpt.

### 2.2 The twelve cards-off goldens, re-captured

C2 declares no cards-off change. The capture harness (`src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx`) ran twice in an LF `git archive` of the merged head and twice in one of main `71bc6bde`. Each capture was compared with the other run and with the committed `src/screens/__golden__/filmRoomV2.*.html`. The branch does not touch that directory.

| Golden | SHA-256 (the merged head = main = committed) |
|---|---|
| `filmRoomV2.empty.deep.desktop.html` | `39b82e0333a80189b2b0752baf88187d62710449bf1619a7bbeb1319f3153ee6` |
| `filmRoomV2.empty.deep.phone.html` | `b9e9bbe34e35834eaa48fd060b277ac2a69b4e64532505ab45c73ba07857fadb` |
| `filmRoomV2.empty.glance.desktop.html` | `a180e9c23d87ea365269d461a474c797921ca163aae60aed6a2124c4d2092a45` |
| `filmRoomV2.empty.glance.phone.html` | `5d61ab17b5459828dc89bf3b7a3c2901f4cd01a06c0e174d0ae307d3884762c3` |
| `filmRoomV2.empty.study.desktop.html` | `2dc16ebe1d6fa2fa5045967514c73dcf5c6164727cfd34ea489c59e80996cc2a` |
| `filmRoomV2.empty.study.phone.html` | `5f5e7dbe3d8e05b129dd9c94e5fc9763dea318171e141a42184d45d3b268fcb3` |
| `filmRoomV2.sep23.deep.desktop.html` | `ffadf417725aeecdf4bc27706999acaa89fbecd4e09a64bc27ed72652c90624e` |
| `filmRoomV2.sep23.deep.phone.html` | `e502efb66e9d8c35e2ce5beadc2cfc195388d7feb353c2fb1c0f2d142af0b983` |
| `filmRoomV2.sep23.glance.desktop.html` | `4639519037dc720c1603bdd45dd5d558a7a7576428376202bd2d4452ef2d566f` |
| `filmRoomV2.sep23.glance.phone.html` | `d59c474a5eabafddcf03a8ae712b574ce597d8257af0d19cbf3c6cfe3ce7e17f` |
| `filmRoomV2.sep23.study.desktop.html` | `093131f510f6a6a661df1f344bc3ab02d811020eca9586acb60afa51d4f2f2e9` |
| `filmRoomV2.sep23.study.phone.html` | `7cb135976584fe5a74923bc7c41cf9b805ef55add26787238035ef8a95118b5c` |

**Result: 12 of 12 byte-identical.** Each capture matched the other run, the committed file, and the other commit's capture: the merged head `af2fddd1` and main `71bc6bde` capture the same bytes.

The comparison suite (`FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx`, 6 rows) is green in the Linux run.

## 3. The census's exception table, as built

`api/_utils/filmRoom/oneDoor.census.test.js:157`:

```js
export const EXCERPT_MODULE = 'api/_utils/filmRoom/momentExcerpt.js';

export const NAMED_EXCEPTIONS = Object.freeze([
  Object.freeze({
    path: 'drafting',
    importer: 'api/_utils/practiceField/draftingPrompt.js',
    imports: EXCERPT_MODULE,
    restsOn: Object.freeze([
      'Practice Field shared contract V2 §9 (the one-door exception: only the drafting call reads Film Room cards into a prompt)',
      'Practice Field shared contract V2 §5.1 (the sources the drafting call may read; opaque labels resolved server-side)',
      'Practice Field shared contract V2 Amendment B item 6 (the drafting assembler\'s path, the excerpt\'s one importer)',
      'Film Room Build C spec V1 §6 (the moment excerpt; "One door, stated")',
      'Film Room Build C spec V1 Amendment C CC-1 (the exception table and the rule)',
    ]),
    builtBy: 'Practice Field T1b + T1d',
  }),
]);
```

**The entry admits one model path, `drafting`.** Contract V2 §9 says only the drafting call reads Film Room cards, and criterion 16 says "a model path other than the named exception". The `path` key was added in the review (L2-3): at first the entry named no path, so any path could have passed through it.

**The rule, one function: `oneDoorDefectsOf(name, roots)` (`:258`).** Each model path's defects, each with its chain:
- **ledger:** no module of the path's **whole** closure is a ledger module, so not even through the excerpt (L2-2). The exception admits the excerpt and its one `plays` read, never the ledger.
- **plays:** no module of the path's **judged walk** reads `plays` by name. The judged walk (`walkOf`, `:231`) is the whole closure without the edges of the exceptions that admit the path. So the excerpt's own `plays` read, behind the named edge, belongs to the exception.
- **excerpt (`excerptRoutesAround`, `:237`):** the judged walk must not reach the excerpt. If it does, the excerpt is reachable some other way, and the path fails with the chain named. A path the table does not admit is walked whole, so it fails on **any** route to the excerpt.
- **importer:** a path no exception admits never meets the named importer at all (L2-3, L2-5).

**Today.** No existing path is admitted, and the importer does not exist. A per-path row pins that the table admits no existing path, that each judged walk equals its whole closure module for module, and that no path meets the importer. So for every existing path the checks are exactly what they were on main.

**The Mandate manager's path.**
- **Roots:** `api/cron/mandate-evaluate.js` and `api/_utils/mandatePromptAssembly.js`.
- **Known reach:** `mandateModelCall.js`, `mandateSchema.js` and `mandateContextBlock.js`.
- **Exclusive reach:** `mandateBatchTransport.js` is the cron's alone. The assembler is covered whole by the cron: a probe showed its 19-module closure is a subset of the cron's 82.
- **Held to its whole closure,** as every unadmitted path is: it reaches neither the ledger, nor `plays`, nor the excerpt, nor the importer (contract V2 §9: the manager never reads Film Room cards). Its own row says so, and a synthetic row fails the same graph for `mandate` and `evaluator` while `drafting` passes.
- **No existing row moved.** The probe found that the path reaches no other root's exclusive module, no ledger module, no `plays` read and no `filmRoom/` module.

**Reading imports (L2-1).** The walker used to strip comments with two regular expressions. A `/*` inside a line comment ("every /api/huddle/* route") opened a "block comment" that ate live code, and real imports vanished from the census: 7 files, `api/_utils/huddle/gate.js`'s only import among them. A small lexer now reads them (`api/_utils/filmRoom/__fixtures__/jsSource.js`, 7 rows of its own). It tells comments from strings, templates and regex literals, and it also reads the backtick dynamic import and the app's `@/` alias. Every existing row passes on the fuller walks. The write gate (§4) uses the same lexer.

**Proven on graphs.**
- **Planted imports:** a planted import of the excerpt, static and dynamic, added to each of the 20 roots (nine paths) on the real graph, fails the rule. (Corrected in the fix round, CE-6: this said 21.)
- **The named importer passes for `drafting`:** on a synthetic tree, its `plays` read is the exception's. The whole closure does reach the excerpt and its `plays` read, so the exception is what passes it.
- **The same graph fails** for `evaluator` and for `mandate`.
- **Routes around fail:** through a middle module; beside the named route, in both import orders (L2-4); from the importer through a helper; and by a dynamic import.
- **An excerpt that imported the ledger fails** the drafting path.
- **No table, no pass:** with no matching exception (another importer, or another path), even the named route fails.
- **The lexer's traps:** a `/*` in a line comment, a backtick import, the `@/` alias, a string holding `//`, and a regex holding `/*`.

**In words:** "THE IMPORTER DOES NOT EXIST YET: the Practice Field's T1b + T1d writes draftingPrompt.js and adds its `drafting` model path here; until then the exception is latent". The row asserts that the file is absent and that no `drafting` path is listed. A second row asserts that no module under `api/` or `src/` imports the excerpt today.

**One existing assertion moved:** the key-list pin gains `mandate`. Every existing path, root and known reach is unchanged. Acceptance C (`oneDoor.acceptanceC.test.js`) is untouched and green.

## 4. Fences

**None of the 35 files in the branch's diff is fenced.** The list (`git diff --name-only origin/main...af2fddd1`):
- `api/_utils/filmRoom/**`: the store, the request boundary, the seam, the census, the new modules and their tests and fixtures;
- `api/film-room/card.js` and its test;
- `src/screens/filmRoomV2/**`: the regions, the screen, the data reads, the cards hook, the copy, the harness and tests;
- `src/utils/filmRoomSubject.js` and its test;
- `docs/`.

The fences:
- **Not edited:** any BUILD_RULES §1 file, and `api/cron/agent-evaluate.js`.
- **Fenced functions are called, never edited:** `casualClone.js`'s `resolveRecordTargetId` and `resolveAttributionAgentId` are imported by a test only, to pin the excerpt's clone rule to the platform's.
- **Not in the diff:**
  - `casualClone.js`;
  - `firestore.rules`, `firestore.indexes.json`, `src/config/featureFlags.js`;
  - `src/components/CommandCenter/**`;
  - `api/_utils/mandate*.js` and `api/cron/mandate-*.js` (the census only reads them);
  - `api/_utils/practiceField/**` and `src/data/practiceFieldSlots.js` (B6's pin is a test that reads it);
  - the tape's writers: `tapeAssemble.js`, `closePass.js`, `candlePass.js`, `tapeMerge.js` and the other `filmTape/*.js`;
  - the setup evaluator, `activationEvidence/**`, the workflow and the CI guard.
- **The census file is in the diff on purpose (CC-1).** It gains the exception table, the rule and the Mandate path.
- **The excerpt is read-only.** The write gate walks its closure of 13 modules with the C1 census script's own `WRITE_PATTERN`, read through the lexer. Two hits are pinned by file, exact text and count: a `Set`'s `add` in `tapeSources.js` and a `Map`'s `set` in `filmRoomMoments.js`. The excerpt, `sourceDay.js` and the subject module hold none.
- **`FILM_ROOM_CARDS_MODE` stays `'allowlist'`.** No flag was added.
- **Nothing outside the branch:** no merge, production read or write, backfill, refresh, deploy or flip.

## 5. The mutants

Each mutant runs in an LF `git archive` of the merged head `af2fddd1`, with `node_modules` linked. The runner applies one mutant's exact-string edits (an anchor found zero times or twice is BROKEN and never skipped), runs the named test files with a **fresh** JSON report, and restores the files. **KILLED** means exit code ≠ 0 and the report names failing tests.

**The prompt's named mutants:**

| Prompt | Mutant | Verdict |
|---|---|---|
| Item 1: the shared day check skipping the exact-moment test | M01 | **KILLED** (exit 1, 10 failed) |
| Item 2: another owner's day answered | M02 | **KILLED** (exit 1, 1 failed) |
| Item 2: a card whose source changed answered | M03 | **KILLED** (exit 1, 1 failed) |
| Item 2: a raw battle id in `excerpt` | M04 | **KILLED** (exit 1, 6 failed) |
| Item 2: the rationale at 501 code points | M05 | **KILLED** (exit 1, 2 failed) |
| Item 2: two speakers' words joined in one quotation | M06 | **KILLED** (exit 1, 5 failed) |
| Item 2: a field filled from a neighbouring check when its own row is missing | M07a (the rationale), M07b (the count) | **KILLED** (exit 1, 1 failed), **KILLED** (exit 1, 1 failed) |
| Item 2: a write call added | M08 | **KILLED** (exit 1, 2 failed) |
| Item 4: the excerpt imported from the evaluator's roots, passing | M11 | **KILLED** (exit 1, 2 failed) |
| Item 4: an import routed around the named importer, passing | M12 | **KILLED** (exit 1, 3 failed) |
| Item 4: the `mandate` path dropped | M13 | **KILLED** (exit 1, 3 failed) |
| Item 5: the subject line shown with cards off | M14 | **KILLED** (exit 1, 1 failed) |
| Item 5: a sector guessed for an unmapped symbol | M15 | **KILLED** (exit 1, 3 failed) |
| Item 6: "equipped" back | M20 (the chain line), M21 (the stage word), M22 (the server's cap words) | **KILLED** (exit 1, 3 failed), **KILLED** (exit 1, 2 failed), **KILLED** (exit 1, 2 failed) |
| Item 7: retire naming the battle's agent again | M24 | **KILLED** (exit 1, 1 failed) |
| Item 7: a terminal record of another entry retiring the card | M26 | **KILLED** (exit 1, 4 failed) |

**This build's own mutants:** M09, M10, M16–M19, M23, M25, M27, M28. **The review's:** M29–M45 (§7.1 names each). **The refuter's three survivors at `3a321797`,** re-run at the merged head after L1-6's rows: M46–M48.

**The battery at the merged head `af2fddd1`: 49 of 49 killed.**

| Mutant | Item | What it does | Verdict | A row it trips |
|---|---|---|---|---|
| M01 | 1 | the shared day check skipping the exact-moment test (situation + symbol only) | **KILLED** (exit 1, 10 failed) | card.test.js :: create — every named refusal, in the documented order, with no other owner's data in the body THE MUTANT: a moment the stored items do not hold — a sub-range, a superset, the whole day, another symbol, an |
| M02 | 2 | another owner's day answered (the excerpt's owner checks removed) | **KILLED** (exit 1, 1 failed) | momentExcerpt.test.js :: CC-5 — the owner only, silently another owner's day, another owner's card, another agent: each null, and the three indistinguishable (nothing logged) |
| M03 | 2 | a card whose source changed answered (the filed check dropped) | **KILLED** (exit 1, 1 failed) | momentExcerpt.test.js :: CC-4 — a card's excerpt re-checks its filed source; one that changed gives null the day re-tagged under another situation version, re-taped under another archetype, the moment gone or moved, the  |
| M04 | 2 | a raw battle id in `excerpt` | **KILLED** (exit 1, 6 failed) | momentExcerpt.golden.test.js :: C-EXCERPT — the goldens, through the real writer the moment (ETN 15–19): equal to its golden, the golden pinned by SHA-256 |
| M05 | 2 | the rationale at 501 code points | **KILLED** (exit 1, 2 failed) | momentExcerpt.golden.test.js :: the bounds — at the limit carried exactly, one over not carried (never cut), astral characters counted once every bound is at most 500 code points (W-06), and each is the amendment's |
| M06 | 2 | two speakers' words joined in one quotation (the directive's texts) | **KILLED** (exit 1, 5 failed) | momentExcerpt.golden.test.js :: C-EXCERPT — the goldens, through the real writer the moment (ETN 15–19): equal to its golden, the golden pinned by SHA-256 |
| M07a | 2 | the rationale filled from a later check's row when no row is at or before the first check | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row no rationale section, or only rows after the moment's first check: no rationale (the mutant: a later row  |
| M07b | 2 | the count read from the neighbouring check's record when the last check's is missing | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row the count: the item at the LAST check; with it missing, no count (the mutant: a neighbouring check's coun |
| M08 | 2 | a write call added to the excerpt | **KILLED** (exit 1, 2 failed) | momentExcerpt.golden.test.js :: THE WRITE GATE — no write call in momentExcerpt.js or anything it imports (the C1 census script's pattern) its closure is the modules it is known to import, and every write-pattern hit in  |
| M09 | 2 | inputQuote dropped from a card's excerpt | **KILLED** (exit 1, 4 failed) | momentExcerpt.golden.test.js :: C-EXCERPT — the goldens, through the real writer the card (its filed source, the same moment): equal to its golden, pinned by SHA-256 |
| M10 | 2 | an unresolvable clone answered under the clone itself | **KILLED** (exit 1, 1 failed) | momentExcerpt.test.js :: the attribution — a casual clone's battle, by the platform resolver's rule (RK-1) NOTHING IS ANSWERED UNDER A CLONE: asked under the clone's own id, every clone-document shape is null — missing,  |
| M11 | 4 | the excerpt imported from the evaluator's roots, passing (every edge into the excerpt skipped) | **KILLED** (exit 1, 2 failed) | oneDoor.census.test.js :: C2 — the rule bites (a planted excerpt import from every root fails; the named importer passes; a route around it fails) AN IMPORT ROUTED AROUND THE NAMED IMPORTER FAILS — through a middle modul |
| M12 | 4 | an import routed around the named importer, passing (any reach accepted once the importer is reached) | **KILLED** (exit 1, 3 failed) | oneDoor.census.test.js :: C2 — the rule bites (a planted excerpt import from every root fails; the named importer passes; a route around it fails) THE SAME GRAPH FAILS FOR ANY PATH THE EXCEPTION DOES NOT ADMIT — the eval |
| M13 | 4 | the mandate path dropped | **KILLED** (exit 1, 3 failed) | oneDoor.census.test.js :: ONE DOOR — no model path reaches the ledger or reads plays every root list is pinned WHOLE (the mutant: a census that skips the deploy path, the chat path, or any one root — review L4-1) |
| M14 | 5 | the subject line's idea read with cards off | **KILLED** (exit 1, 1 failed) | FilmRoomSubjectLine.jsdom.test.jsx :: CC-7 — on the screen, under cards mode only CARDS OFF (the owner not admitted): no line anywhere, and the idea never read (the mutant: the line shown with cards off) |
| M15 | 5 | a sector guessed for an unmapped symbol | **KILLED** (exit 1, 3 failed) | filmRoomSubject.test.js :: sectorOf — the directory's one word for a symbol, or none a symbol the directory lacks, or no symbol: none — never guessed (the mutant: a sector for an unmapped symbol) |
| M16 | 5 | the statement cut at 61 code points | **KILLED** (exit 1, 3 failed) | filmRoomSubject.test.js :: THE SUBJECT LINE — one projection (CC-7), each part only where held every part: "{SYM} · {sector} · under your idea '{first 60 code points}' v{n}" |
| M17 | 5 | the receipt's line drawn from a day that is not the card's own | **KILLED** (exit 1, 1 failed) | FilmRoomSubjectLine.jsdom.test.jsx :: CC-7 — the receipt says what the agent's excerpt says a card from another day shows no line (its own day is not on screen) |
| M18 | 5 | the sweeps' statement binding without its byte-for-byte check | **KILLED** (exit 1, 1 failed) | FilmRoomSubjectLine.jsdom.test.jsx :: the sweeps' CC-7 binding — the statement is the player's own words only when bound to the version as read THE BINDING BITES: forged text, a document holding other words, an over-boun |
| M19 | 5 | the screen's idea taken from another owner's version | **KILLED** (exit 1, 4 failed) | filmRoomSubject.test.js :: the idea — one reading of the carried ref and its version (ideaFrom) another owner's, or another list's or version's document: no idea at all |
| M20 | 6 | "Equipped" back on the chain line | **KILLED** (exit 1, 3 failed) | FilmRoomCards.jsdom.test.jsx :: C1 item 6 — the receipt is the chain (spec §5; acceptance C-COPY), every state from the ledger's own writes testing, tested, installed: the lines in the ledger's order; the result's words  |
| M21 | 6 | "equipped" back as the stage word | **KILLED** (exit 1, 2 failed) | cardStages.census.test.js :: C-VOCAB — every reader reads the stages from the one export the screen's stage words cover exactly the vocabulary's stages (installed reads "adopted as your instruction" — Film Room C2, CC-8) |
| M22 | 6 | "equipped" back in the server's cap words | **KILLED** (exit 1, 2 failed) | card.test.js :: Amendment A CA-23 — at the cap with NOTHING the player can retire, the refusal says what stops a card counting a full mix — two accepted nominations, a testing card, a result with an offer waiting, a seco |
| M23 | 6 | the adopted line's sentence dropped | **KILLED** (exit 1, 1 failed) | FilmRoomCards.jsdom.test.jsx :: C1 item 6 — the receipt is the chain (spec §5; acceptance C-COPY), every state from the ledger's own writes testing, tested, installed: the lines in the ledger's order; the result's words  |
| M24 | 7 | retire naming the battle's agent again | **KILLED** (exit 1, 1 failed) | FilmRoomCards.jsdom.test.jsx :: C2 — every receipt action names the card's own agent: retire and park, as the offer on a clone's battle the receipt's Retire sends the card's own agent (the ranked parent), never the battl |
| M25 | 7 | park naming the battle's agent again | **KILLED** (exit 1, 1 failed) | FilmRoomCards.jsdom.test.jsx :: C2 — every receipt action names the card's own agent: retire and park, as the offer … and Park sends the card's own agent too (the mutant: park naming the battle's agent) |
| M26 | 7 | a terminal record of another entry retiring the card | **KILLED** (exit 1, 4 failed) | cardStore.transitions.test.js :: Astra BG-1 — a terminal record (declined, expired, withdrawn) must name the retiring entry, as a withdrawn one must declined: naming this entry, the card retires and its copy takes the st |
| M27 | 7 | B6's copy drifting from the Practice Field's slot | **KILLED** (exit 1, 1 failed) | cardStages.b6Pin.test.js :: B6 — the Film Room's nomination expiry is the Practice Field's slot NOMINATION_EXPIRY_SESSIONS equals PRACTICE_FIELD_SLOTS.B6_NOMINATION_EXPIRY_SESSIONS (10 sessions today) |
| M28 | 7 | the seam's JSDoc back to "one read" | **KILLED** (exit 1, 1 failed) | practiceFieldSeam.test.js :: Film Room C2 item 7 (Amendment C CC-9 item 4) — the defaults' JSDoc says what the header says: at most two reads the PRACTICE_FIELD_SEAM_DEFAULTS JSDoc names at most two reads, never "one rea |
| M29 | L1-1 | an instant read by Date.parse alone (a loose owner-written time carried) | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row AN OWNER-WRITABLE TIME CARRIES NO TEXT (§2 review L1-1): a meeting created at a loose date string holding |
| M30 | L1-1 | a meeting's start read by Date.parse alone | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row AN OWNER-WRITABLE TIME CARRIES NO TEXT (§2 review L1-1): a meeting created at a loose date string holding |
| M31 | L1-3 | an expired meeting ending when the check filed it | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row AN EXPIRED MEETING ENDED AT ITS DEADLINE, not when the check filed it (§2 review L1-3): a deadline before |
| M32 | L1-4 | the writer's `unrecorded` sentinel carried as a mechanism | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row the writer's `unrecorded` mechanism is its sentinel for a missing exit reason — absent here, as the reaso |
| M33 | L1-7 | the clone's parent taken without the owner check (the pure resolver alone) | **KILLED** (exit 1, 2 failed) | momentExcerpt.test.js :: the attribution — a casual clone's battle, by the platform resolver's rule (RK-1) THE RULE IS THE PLATFORM'S: over every clone-document × parent-document shape, the excerpt answers exactly when t |
| M34 | L2-1 | the census walker back to the regex comment stripper | **KILLED** (exit 1, 6 failed) | jsSource.test.js :: stripComments — comments go, code stays a `/*` inside a line comment opens nothing: the import after it stays (the regex stripper's blind spot) |
| M35 | L2-2 | the ledger judged on the walk behind the named edge (the ledger through the excerpt passing) | **KILLED** (exit 1, 1 failed) | oneDoor.census.test.js :: C2 — the rule bites (a planted excerpt import from every root fails; the named importer passes; a route around it fails) THE LEDGER IS NEVER THE EXCEPTION'S: an excerpt importing the ledger's st |
| M36 | L2-3 | the exception admitting every path | **KILLED** (exit 1, 12 failed) | oneDoor.census.test.js :: ONE DOOR — no model path reaches the ledger or reads plays evaluator: the exception table admits no existing path — its judged walk is its whole closure, and it never meets a named importer |
| M37 | L2-6 | source_changed judged before archetype_changed | **KILLED** (exit 1, 1 failed) | sourceDay.test.js :: judgeFiledDay — THE DAY CHECK against what was filed (CC-4: coverage, the exact moment, the situation version, the archetype) both changed — another archetype AND another situation version: archetype |
| M38 | L3-2 | a line shown while the version reads or after it failed | **KILLED** (exit 1, 2 failed) | filmRoomSubject.test.js :: the §2 review's lens 3 — the read's states, the ref's id class, no dangling fragment the screen's read states (L3-2, L3-8): loading and error say no line while the day carries an idea; denied s |
| M39 | L3-3 | the screen not handing the idea to the receipt | **KILLED** (exit 1, 1 failed) | FilmRoomSubjectLine.jsdom.test.jsx :: CC-7 — on the screen, under cards mode only §2 review L3-3 — THROUGH THE SCREEN: a card opened from My cards on its own day shows the receipt's line, equal to the excerpt's projectio |
| M40 | L3-4 | BG-1's check after the accepted dispatch again | **KILLED** (exit 1, 1 failed) | cardStore.transitions.test.js :: Astra BG-1 — a terminal record (declined, expired, withdrawn) must name the retiring entry, as a withdrawn one must the check comes BEFORE any state dispatch (§2 review L3-4): an accepted |
| M41 | L3-8 | a version the rules deny read as one merely missing (the idea shown) | **KILLED** (exit 1, 2 failed) | filmRoomSubject.test.js :: the §2 review's lens 3 — the read's states, the ref's id class, no dangling fragment the screen's read states (L3-2, L3-8): loading and error say no line while the day carries an idea; denied s |
| M42 | L3-8 | a ref's list id outside the forge-id class carried | **KILLED** (exit 1, 1 failed) | filmRoomSubject.test.js :: the §2 review's lens 3 — the read's states, the ref's id class, no dangling fragment a ref naming a list id outside the forge-id class, or a reserved `__id__`, carries no idea on either side (L |
| M43 | L3-10 | a dangling "under your idea" | **KILLED** (exit 1, 1 failed) | filmRoomSubject.test.js :: the §2 review's lens 3 — the read's states, the ref's id class, no dangling fragment an idea holding neither its statement nor its version says nothing — no dangling "under your idea" (L3-10) |
| M44 | L3-7 | the harness binding reading the document the screen names | **KILLED** (exit 1, 2 failed) | FilmRoomSubjectLine.jsdom.test.jsx :: the sweeps' CC-7 binding — the statement is the player's own words only when bound to the version as read a statement with digits, a forbidden word and a number word, bound: the swee |
| M45 | L2-4 | a skipped edge blocking its target (the refuter's order-dependent survivor) | **KILLED** (exit 1, 1 failed) | oneDoor.census.test.js :: C2 — the rule bites (a planted excerpt import from every root fails; the named importer passes; a route around it fails) AN IMPORT ROUTED AROUND THE NAMED IMPORTER FAILS — through a middle modul |
| M46 | L1-6 | the directive's lower bound dropped (a directive heard before the moment carried) — the refuter's M1 | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row the directive heard just BEFORE the moment's first check is not taken (the lower bound — §2 review L1-6) |
| M47 | L1-6 | situationVersion's class hardcoded 'recorded' instead of the tape's declaration — the refuter's M2 | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row EVERY CLASS IS THE DOCUMENT'S OWN (§2 review L1-6): no declaration for the idea's version, the items' ver |
| M48 | L1-6 | afterExit.close's class hardcoded 'market' instead of the series' declaration — the refuter's M3 | **KILLED** (exit 1, 1 failed) | momentExcerpt.golden.test.js :: a field the tape does not hold is absent — never a guess, never a neighbouring row EVERY CLASS IS THE DOCUMENT'S OWN (§2 review L1-6): no declaration for the idea's version, the items' ver |

**The checks on the battery.**
- **No kill rests on load.** Every killed mutant's report names at least one failed row whose failure is an assertion, not a timeout or a load error.
- **The restore held.** After the run, every file a mutant touched was byte-identical to `af2fddd1` in git.
- **The unmutated baseline is green.** All 16 files the battery runs, run once in the same archive: 657/657 passed, exit 0.
- **M46–M48 ran in a second LF archive of `af2fddd1`,** alongside the battery. Their two files' baseline there: 61/61.

**History.** The first battery ran at the item-7 head `3a321797` (29 mutants) and killed 28. M10 survived ("an unresolvable clone answered under the clone itself"): no row asked a clone's battle for an excerpt under the clone's own id. Commit `f66faba4` added that row, and M10 died at `f66faba4`. The final battery above re-runs every mutant, the review's included, at the merged head.

## 6. The excerpt's contract, for the Practice Field (T1b + T1d)

> **Replaced by §11.12** (the fix round, 16 Nov 2026). This section is C2's contract as first built, kept for the record. T1b + T1d reads §11.12.

### 6.1 The two exports

```js
import { excerptOf, excerptOfCard, MOMENT_EXCERPT_VERSION } from '../filmRoom/momentExcerpt.js';

excerptOf(db, { uid, attributionAgentId, battleId, etDate, moment })   // one game moment
excerptOfCard(db, { uid, attributionAgentId, entryId })                // one card, through its filed source
// each → Promise<{ excerpt, refs } | null>
```

- `db` is the Admin SDK's Firestore. The excerpt only reads, with plain document gets: the battle, the tape day, for a clone's battle the clone and its parent agent, the idea's version, the sold symbol's series document, and for a card the card. Never a query and never a collection scan.
- `moment` is `{ situationId, symbol, fromTickSeq, toTickSeq }`: exactly one of the day's stored moments, as `src/utils/filmRoomMoments.js` derives them. A sub-range or a superset is `null`.
- `attributionAgentId` is the agent the card ledger and the book are keyed by: the ranked agent, which for a casual clone's battle is the clone's parent.

### 6.2 What `null` means

`null` is one answer for all of these, with nothing logged and nothing that tells one from another (CC-5):
- the tape day, the battle or the card is missing or is another owner's;
- the battle's attribution agent is not the one named; or a clone's battle has no resolvable parent, or a parent agent that is not the owner's (the platform resolver's own guard);
- the moment is not one of the day's stored moments;
- the day's situations are unavailable, or it records no archetype;
- for a card, the filed source has changed: another situation version, another archetype, or the moment gone or moved (CC-4, the route's own day check, `sourceDay.js`);
- a read failed, or an argument was malformed.

A `null` is never a reason to guess. Treat it as "no excerpt".

### 6.3 `excerpt` — what may reach a prompt

Each value is `{ value, class }`: `class` is `recorded`, `derived` or, for a series bar, `market`, the tape's own declaration for that number. Each quotation is `{ text, by, at, class: 'quoted' }`, with `by` one of `agent`, `player` or `platform`, and `at` the record's time for the words, or `null`. A field the record doesn't hold is absent.

Every instant is a strict ISO 8601 date-time (`instantText` in `src/utils/filmRoomSubject.js`, shared with the screen). A record time that is anything else gives a quotation `at: null`, and any other field it would fill is absent. A loose time an owner writes, such as `9/23/2026 13:30 (…)`, which `Date.parse` would read, never reaches `excerpt` (§2 review L1-1).

| Field | Shape | Source |
|---|---|---|
| `excerptVersion` | `1` | `MOMENT_EXCERPT_VERSION` (CC-6) |
| `battle` | `'b1'` | the battle's label |
| `symbol`, `situationId` | recorded | the moment |
| `situationVersion` | recorded | the moment's first stored tag item (`tags.items[].version`) |
| `from`, `to` | recorded instants | the moment's first and last tagged checks |
| `checks` | derived | the moment's number of tagged checks |
| `sector` | recorded, one word | `TICKER_TO_SECTOR`: the sector id, e.g. `XLI`; absent for a symbol the directory lacks |
| `idea` | `{ label: 'i1', version?, statement? }` | the day's one distinct `calls[].hypothesisRef`; `version` is the ref's number (recorded); `statement` is the version document's, at most 280 code points, quoted `player` at its `createdAt`. No carried idea, or two distinct refs: absent. Another owner's version: absent. An unread version: the idea without its statement. |
| `rationale` | `{ hypothesis?, rationale? }` | the `rationale[]` row at the moment's first check, or the nearest earlier one; each at most 500 code points, quoted `agent` at the row's `at` |
| `directive` | `{ playerText?, canonicalText? }` | the `directives[]` row whose heard check falls in the moment (the earliest heard); the player's words quoted `player`, the canonical text quoted `platform`, each at most 400, at `filedAt` |
| `meeting` | `{ outcome?, legs?, diagnosis? }` | the `meetings[]` row whose life holds the moment: created at or before its first check, and ended at or after its last. A meeting ends when it was resolved; an expired one ends at its deadline (`expiresAt`, or its resolution if earlier). Its times must be strict instants; outcome and legs recorded; the diagnosis at most 400 code points, quoted `platform` at `createdAt` |
| `exit` | `{ mechanism?, exitReason?, sold?, bought?, exitPrice? }` | the `actions[]` row selling the moment's symbol at its last check, or at the first check the day ran after it; each part recorded, a missing one absent (an exit to cash has no `bought`). The writer's `unrecorded` mechanism, its sentinel for a missing reason, is absent too. |
| `afterExit` | `{ close, barStart, barsAfter }` | the sold symbol's own series document for the day: its last bar starting after the exit, its close and the start of its 10-minute bucket (both in the series' class, `market`), and how many such bars there are (derived). Absent when there are none. |
| `count` | `{ value, class }` | `stalled`'s count at the moment's last check: the live rule's record when the holding's basis is recorded (`recorded`), else the tag item's count (`derived`) |
| `card` | `{ label: 'c1', question?, route?, filed?, note? }` | excerptOfCard only: the menu's question text at the stored version, the route (a stored `drill` reads `offer`), the filed instant (the card's `createdAt`), and the note (at most 280 code points, quoted `player` at the card's `createdAt`) |
| `inputQuote` | quotation | excerptOfCard only: the card's note again, named as the input's one quoted excerpt (CC-2, W-06) |

Bounds are code points, and an astral character counts once. A quoted text over its bound is **not carried**: it is never cut.

`recurrences` is not carried in version 1 (§9, ruling R4).

### 6.4 `refs` — never for a prompt

`refs` maps each label present to its real id: `{ b1: battleId, i1?: watchlistId, c1?: entryId }`. It is for the server's own resolution (contract V2 §5.1). Nothing in `excerpt` is an id: the golden suite's detector checks for every id kind and every id shape.

### 6.5 The subject line

`subjectOfExcerpt(excerpt)` in `src/utils/filmRoomSubject.js` gives the line the receipt shows for the same card:

> "{SYM} · {sector} · under your idea '{first 60 code points}' v{n}"

Use it if the drafting call should show the player's subject line.

### 6.6 What T1b + T1d must add to the census

In `api/_utils/filmRoom/oneDoor.census.test.js`:
1. **A `drafting` model path** in `MODEL_PATHS` and `MODEL_PATH_ROOTS`, with its roots; its `KNOWN_REACH`; and its `EXCLUSIVE_REACH` entries. The key-list pin then gains `drafting`.
2. **No change to `NAMED_EXCEPTIONS`.** The entry already admits the path `drafting` and names the edge `api/_utils/practiceField/draftingPrompt.js` → `api/_utils/filmRoom/momentExcerpt.js`. The path name and the file must be exactly these. The edge must be a **direct** import: an importer reaching the excerpt through a helper module fails the rule.
3. **The latent pins:**
   - Update the row that asserts the importer does not exist yet.
   - The per-path row "the exception table admits no existing path" fails for `drafting`, by design. Hold `drafting` out of that row and keep it for every other path: only the drafting path may meet the importer.
   - The row "only a named importer may import the excerpt — today no module … imports it at all" then sees one importer. Keep its first assertion (every importer is a named one) and change the second to expect exactly `draftingPrompt.js`.
4. **What the exception admits.** For `drafting`, `oneDoorDefectsOf` judges `plays` on the walk behind the named edge, so the excerpt's one `plays` read is the exception's. The ledger is still judged on the whole closure: the excerpt imports no ledger module, and if it ever did, the drafting path would fail.
5. **The Mandate honesty registry** entry for the excerpt as an input (contract V2 Amendment B item 6) is the Practice Field's, with the drafting assembler.

Every other path, the Mandate manager's included, stays held to its whole closure: it may reach neither the ledger, `plays`, the excerpt, nor the importer.

## 7. The BUILD_RULES §2 review

The branch passes the threshold at 33 files and about 3,000 lines. The review ran at the code head `3a321797`, each pass on its own LF `git archive`, read-only on git and the shared tree:
- **Three lenses, static:**
  - L1, the excerpt's correctness, honesty and ownership;
  - L2, the census and the day-check refactor;
  - L3, the screen, the copy and CC-9.
- **An independent refuter.** Every finding went to it, with orders to refute each with a run repro. Its archive had `node_modules` linked, and it ran end-to-end repros through the real tape writer.
- **The mutating lens:** this build's battery (§5), plus the refuter's own mutants.

**Result: no BLOCKER stands.**
- **L1-1, refuted as a BLOCKER (now MAJOR, fixed).** L1 graded it a BLOCKER under criterion 17. The refuter reproduced it end to end but graded it MAJOR: only the owner can plant it, only into their own excerpt, and the owner's own note carries ids by design.
- **L2's route verdict:** the refactor is behaviour-identical, checked line by line against main (status, code, `extra`, order, the transaction read, the ABORTED rethrow, error identity).
- **Fixed:** 21 findings, in three commits, `328a8df2` (L2), `b5806b1a` (L1) and `e7804bfb` (L3), each with rows, and with a mutant wherever one could bite (M29–M48, §5; M46–M48 are the refuter's own survivors at `3a321797`, run again after L1-6's rows).
- **For the founder:** seven findings are readings, not defects. They go to §9: R16 (L1-2 and R-1), R17 (L3-9) and R18 (L2-7) are new; L3-1 folds into R2, L3-5 into R10 and L3-6 into R3. One more (R-2) is noted.

### 7.1 Findings, verdicts, dispositions

| Id | Lens grade → refuter's verdict, final grade | Finding | Disposition |
|---|---|---|---|
| L1-1 | BLOCKER → **PARTLY, MAJOR** | A loose time an owner writes (a meeting's `createdAt` such as `9/23/2026 13:30 (Ab3dEf…)`, which `Date.parse` reads and the tape writer copies) reached `excerpt` as a quotation's `at`, carrying an id. Reproduced end to end through the real writer. | **Fixed.** Every instant the excerpt carries, and every meeting time it reads, is a strict ISO 8601 date-time (`instantText`, shared with the screen). Rows plant the loose time. Mutants M29, M30. |
| L1-2 | MAJOR → **CONFIRMED, MAJOR (ruling)** | A meeting's diagnosis is quoted `by: 'platform'`, but the history is owner-writable, so an owner can append their own words. | **Ruling** (§9 R16, with R-1). The excerpt joins nothing; it quotes the one stored field as CC-2's table assigns it. |
| L1-3 | MINOR → **PARTLY, MINOR** | An expired meeting's life ran to the check that filed it. The excess is at most the moment's last check. | **Fixed:** an expired meeting ends at its deadline. Row; M31. |
| L1-4 | MINOR → **CONFIRMED** | The writer's `unrecorded` sentinel was carried as a recorded mechanism. | **Fixed:** absent, as the missing reason is. Row; M32. |
| L1-5 | MINOR → **CONFIRMED** | The series bar's time is its bucket's start, but it was named `closeAt`. | **Fixed:** renamed `barStart`. The goldens moved by that one key (§2). |
| L1-6 | MINOR → **PARTLY** | Three shape rows read only the committed JSON. The directive's lower bound, the item version's class and the bar's class were unpinned (the idea version's class was pinned already). | **Fixed:** the rows run on live excerpts; added rows for the heard-at-14 directive and for each missing class declaration. |
| L1-7 | MINOR → **CONFIRMED mechanism, NIT** (rules deny the client the shape) | The clone attribution skipped the platform resolver's CONFIRMED-1 parent-ownership guard. | **Fixed:** one more bounded get (the parent agent must be the owner's). The pin runs the platform's own async `resolveAttributionAgentId` over clone × parent shapes. M33. |
| L1-8 | NIT → **CONFIRMED** | The fixture's call record shape (origin `agent_initiative` with a full ref) was not one the platform writes. | **Fixed:** origin `equipped`, list and version. The goldens did not move. |
| L1-9 | NIT → **CONFIRMED** | The note bound was a literal, unpinned to S10. | **Fixed:** pinned by test. |
| L2-1 | MAJOR → **CONFIRMED, MAJOR** | The census walker's regex stripper read a `/*` inside a line comment as a block comment, so live imports vanished (7 files, including `huddle/gate.js`). The write gate copied it. No live path is affected today. | **Fixed:** a small lexer (`__fixtures__/jsSource.js`) with its own rows; the backtick dynamic import and the `@/` alias are read too. Every existing row passes on the fuller walks. M34. |
| L2-2 | MINOR → **PARTLY, NIT** | The skip-walk exempted ledger modules reached through the excerpt. The golden's closure pin caught it elsewhere. | **Fixed:** the ledger reads the whole closure, as on main. Row; M35. |
| L2-3 | MINOR (ruling) → **PARTLY, MINOR** | The exception named no model path. | **Fixed by the stricter reading:** the entry admits `drafting` only, and every other path fails on any route to the excerpt or the importer. M36. |
| L2-4 | MINOR → **CONFIRMED** | The "named route and a route around it" proof could not fail under an order-dependent skip; the refuter's mutant survived 80 rows. | **Fixed:** both import orders. M45 is the refuter's mutant. |
| L2-5 | MINOR → **PARTLY, NIT** | The Mandate path's strict hold was indistinguishable from the latent rows. | **Fixed with L2-3:** a synthetic row fails the same graph for `mandate` and `evaluator` while `drafting` passes. |
| L2-6 | MINOR → **CONFIRMED** | `archetype_changed` before `source_changed` was unpinned. | **Fixed:** a both-changed row. M37. |
| L2-7 | NIT (ruling) → **CONFIRMED (reading)** | `api/mandate/drain.js` reaches the Mandate modules but is not a root. It builds no prompt. | **Ruling** (§9 R18). |
| L3-1 | MAJOR (ruling) → **CONFIRMED, MINOR (ruling)** | A statement over 280 code points drops from the subject line, though the line needs only 60. | **Ruling**, folded into R2. |
| L3-2 | MINOR → **CONFIRMED** | While the version was loading, or after the read failed, the line showed the idea without its statement. | **Fixed:** no line until the read answers. M38. |
| L3-3 | MINOR → **CONFIRMED** (its mutant survived) | No row drove the screen's hand-off of `idea` to the receipt. | **Fixed:** a screen-level row opens the card from My cards and compares the line with `excerptOfCard`. M39. |
| L3-4 | MINOR → **CONFIRMED, NIT** | BG-1's check came after the `accepted` dispatch. | **Fixed:** before any state dispatch, as BG-1 suggests. An accepted record naming another entry now gets 503. Row; M40. |
| L3-5 | MINOR (ruling) → **CONFIRMED (reading)** | The receipt's line shows only on the card's own day. | **Ruling** (R10). |
| L3-6 | MINOR (ruling) → **CONFIRMED (reading)** | The sector shows as its id. | **Ruling** (R3). |
| L3-7 | NIT → **CONFIRMED** | The harness binding read its document from the screen's own attribute. | **Fixed:** the harness reads its pinned `docs.idea`. M44. |
| L3-8 | NIT → **CONFIRMED** | A read the rules denied showed the idea without its statement, while the server gives no idea. The client lacked the id-class gate. | **Fixed:** `denied` means no idea; the list-id gate is in the shared ref reader. M41, M42. |
| L3-9 | NIT (ruling) → **CONFIRMED (reading)** | "Since last time"'s adopted line has no sentence. | **Ruling** (§9 R17). |
| L3-10 | NIT → **CONFIRMED** | An idea holding neither its statement nor its version left "under your idea" dangling. | **Fixed** in the projection, both sides. M43. |
| R-1 | new → **MAJOR (ruling)** | The whole `meeting` block comes from owner-writable history and is carried as recorded and platform. | **Ruling** (§9 R16). |
| R-2 | new → **NIT** | `closeAt`, a timestamp, carried the close's class. | Kept with the rename: `barStart` carries the series bar's class `market`, as the series document's own `provenance`. Noted. |
| R-3 | new → **MINOR** | The same stripper hid a `plays` read behind a `/*` inside a line comment. | **Fixed with L2-1:** the census's `plays` scans read the lexer's output. |

**Refuted or downgraded:** L1-1 as a BLOCKER (refuted, now MAJOR); L1-3 in part (the excess is at most the last check); L1-6 in part (the idea version's class was pinned); L2-2 to a NIT (closed elsewhere); L2-5 in part; L3-1 to MINOR; L3-4 to NIT.

**One more fix found by this build:** the lexer at first made the census rows two to four times slower. The census then timed out under load (two files failed in one full run beside another session's vitest). A per-file cache and a run-copying loop brought the slowest row to 1.2 s, and the whole-tree row back to under 0.5 s (`6eb8a3ef`).

## 8. The checks and the Tests run

All checks ran on the branch merged locally with current `origin/main` (`af2fddd1`).

| Check | Where | Result |
|---|---|---|
| The full suite | WSL Ubuntu, a private `git worktree` of the `~/pd-ci` clone at `af2fddd1`; `TZ=UTC`; `vitest run --maxWorkers=8` under `flock /tmp/pd-suite.lock`; JSON report | **exit 0. Files: 1,508 passed, 12 skipped, 0 failed (1,520). Tests: 34,006 passed, 135 skipped, 0 failed (34,141).** 313 s. The C2 files: `momentExcerpt.test.js` 19/19, `momentExcerpt.golden.test.js` 42/42, `sourceDay.test.js` 16/16, `jsSource.test.js` 7/7, `oneDoor.census.test.js` 83/83, `filmRoomSubject.test.js` 17/17, `FilmRoomSubjectLine.jsdom.test.jsx` 12/12, `cardStages.b6Pin.test.js` 2/2, `practiceFieldSeam.test.js` 10/10, `cardStore.transitions.test.js` 119/119, `FilmRoomCards.jsdom.test.jsx` 136/136, the inventory 8/8. |
| The rules suite | the same worktree, JDK 21, `npm run test:rules` under the lock | **exit 0. 42 files, 784 tests passed, 0 failed.** 169 s (Astra's C1 confirmation recorded 768; main has gained rules rows since). |
| `lint:gate` | the same worktree | **exit 0** (`eslint . --config eslint.gate.config.js --max-warnings 0`: no output) |
| `vite build` | the same worktree | **exit 0.** 4,207 modules transformed, built in 19 s. Only the existing warnings: the CSS syntax notes and the mixed static/dynamic Firebase imports. |
| The census and acceptance C | in the suite | `oneDoor.census.test.js` 83/83; `oneDoor.acceptanceC.test.js` 4/4, untouched |
| The cards-off goldens | §2.2 | **12 of 12 byte-identical** at the merged head and at main; two runs each, deterministic |
| The §2 review | §7 | Done, with the mutating lens; no BLOCKER stands |
| B0, verbatim | SHA-256 of each committed file | Astra's confirmation `6d855ed762b0bc71e386b9d571557db72ff341ea5ec9d3f96d2eafe8703f6fba` (28,383 bytes); Amendment B `7f846186d075dcb7c0532a4726e809f293ab4855a1e49690fbe5a06d4a83c33c` (2,858); Amendment C `afd513aeb966f2ce4fba19295f8ba2d3db340ffab96d85f8a9d49c1e065c6d19` (9,699) |

**The Windows runs.** Two Film Room files, `FilmRoomScreenV2.focus.jsdom.test.jsx` and the census's non-vacuity row, sometimes exceeded vitest's 5 s load limit in full Film Room runs on Windows beside other sessions' work. Both pass alone on Windows, and both pass in the Linux run above (the focus file in 2.9 s, the census file in 3.1 s). This build's lexer had at first slowed the census; `6eb8a3ef` brought it back (§7).

**The Tests run (CI).** BUILD_RULES §2: not watched, polled or fixed. The verified merged head `af2fddd1` was pushed first, to open the draft. The run for the pushed head (this report's commit, which adds only this file and its README row to `af2fddd1`) is read once after the push, and its state is reported on PR #1074. No other run is read.

## 9. Needs a ruling

None of these blocks the merge. Each reading below is built as stated, pinned by test, and changes in one place if ruled otherwise.

| # | Question | Built | Why |
|---|---|---|---|
| R1 | **The class of a series bar.** The table says `afterExit` is "(recorded)"; the series document declares its bars `market` (`SERIES_NUMBER_CLASSES`). | `afterExit.close` and `barStart` carry `market`, the series' own class; `barsAfter` is `derived`. | "recorded, from the tape's own class" and BUILD_RULES §9: the agent would otherwise read a bar's close as recorded where the screen marks it market. One line to change if ruled `recorded`. The review (R-2) noted that the bar's time carries the close's class; it is the series document's own declaration for its bars. |
| R2 | **A quoted text over its bound.** | Not carried (absent), never cut, for every quoted field. | The tape's writer leaves a meeting's diagnosis over its bound uncopied, and BC-1 says the agent's and the player's words are never rewritten. A cut excerpt would need a marker the table doesn't carry. The cost: an idea's statement over 280 code points (the store allows 1,000) goes without its statement, in the excerpt and on the subject line, though the line shows only the first 60 (the review's L3-1). Ruled the other way, `boundedText` cuts and a `cut: true` marker would join the quotation. |
| R3 | **`sector` is "one word"** (also the review's L3-6). | The directory's value: the sector id (`XLI`, `XLK`). The subject line reads "ETN · XLI · …". | Four sector names are two words ("Consumer Discretionary", …). If the player's line should name the sector ("Industrials"), the projection maps the id to `STOCK_UNIVERSE[id].name` in one place, and the excerpt can keep the id. |
| R4 | **`recurrences`.** | Never carried in version 1. | Recurrences are the counter's, over the owner's tape days in a window: a collection-group query. Item 2 allows only bounded document reads and "never a collection scan", and the excerpt may not import the counter (its closure writes). Options: the drafting call passes the counter's answer in; or a ruled window read is added; or it stays absent. |
| R5 | **A casual clone's battle.** CC-5 needs the battle's attribution agent. | Two extra reads, only for a clone's battle: the owner's clone document, and its parent agent (which must be the owner's: the platform resolver's CONFIRMED-1 guard, added in the review, L1-7). `casualClone.js` writes, so the read-only excerpt cannot import it. A test runs the platform's own async `resolveAttributionAgentId` over the clone × parent shapes and pins the excerpt's answer to it. Nothing is ever answered under a clone. | The reads are not in item 2's list. Nearly every taped battle is a clone's, so without it the excerpt would answer almost nothing. |
| R6 | **"The `actions[]` row that ends the run."** | A sale of the moment's symbol at the moment's last check, or at the first check the day ran after it (its recorded `tickSeq`). A later sale is another run's; a row with no `tickSeq` matches nothing. | The tagger's run ends when the holding leaves the book. The stalled stretch ends at the next check, so a sale there ends this run. The tagger's `tags.exits` lists stagnation exits only, and would miss an agent's own sale. |
| R7 | **Ties.** | `directive`: of several heard in the moment, the earliest heard (then the earliest filed). `meeting`: one whose life *contains* the moment (created at or before its first check, ended at or after its last; an expired meeting ends at its deadline, L1-3), the earliest. `idea`: two distinct refs on one day give none. | The table names one row each. "Holds" read as contains. |
| R8 | **Where the idea comes from.** | Only the day's `calls[].hypothesisRef`, as the table says. A battle that carries an idea (`agentContext.equippedHypothesis`) but minted no call that day has no `idea` in the excerpt. | The table's letter. If the battle's own carriage should count, `ideaFrom` reads it as the one source for both sides. |
| R9 | **The census's general rule.** | Built stricter than the table's letter (the review's L2-3): the exception admits one model path, `drafting`, and every other path is held to its whole closure. It may reach neither the ledger, `plays`, the excerpt nor the importer, by any route (§3). | Contract V2 §9 says only the drafting call reads cards, and criterion 16 names "a model path other than the named exception". Ruled the looser way (any path through the named importer), the entry's `path` key goes and the importer check is dropped. |
| R10 | **The screen's new read.** | Under cards mode only, for a written day: one `getDoc` of the carried idea's version (`watchlists/{id}/hypothesisVersions/v{n}`), once per version, owner-read by the existing rule. The line waits for the read: no line while it loads or after it fails (L3-2), and a read the rules deny gives no idea, as the server gives none (L3-8). The receipt shows the line only on the card's own day (Set's rule); a card from another day shows none (the review's L3-5). | The statement is on the version document, not the tape. The excerpt reads the same document, so the two can't drift. With cards off nothing is read; that is pinned, and mutated (M14). |
| R11 | **The sweeps' CC-7 binding.** | The test harness exempts a subject-line statement that is, byte for byte, the first 60 code points of the version as read (within 280), as it exempts a bound quotation (R7). Anything else stays swept. | CC-7 cuts the player's words, and a cut is not a whole quotation. Without the binding, a statement holding a digit or a word on the forbidden list would fail the sweeps as the screen's own voice. Ruling asked: does the harness's R7 extend to the subject line's cut? |
| R12 | **The Sep 23 fixture.** | Derived in a fixture module, not edited: archetype `momentum_chaser` (a registry code), the session's run records, one call carrying the idea, one meeting with its roster. | As committed, `sep23Day` tags nothing ("stalled unavailable: unknown archetype (momentum)"), so it holds no moment to excerpt. The screen fixtures and the cards-off goldens read it untouched. |
| R13 | **"Verbatim, from between its markers".** | The text between the markers, its leading and trailing blank lines trimmed, ending in one newline. SHA-256 of each committed file: §8. | The markers' surrounding blank lines are framing. |
| R14 | **`inputQuote` repeats `card.note`.** | Both carry the note (equal values, separate objects). | CC-2 names the note "in a field of its own"; the table keeps it in `card` too. The drafting assembler sends one of them (W-06). Ruled otherwise, `card.note` goes. |
| R15 | **Which cards `excerptOfCard` answers.** | Any of the owner's cards under that agent, whatever its stage. | CC-2 speaks of "a nominated card", but item 2's signature takes any entry. The drafting call decides which cards it asks for. |
| R16 | **The meeting block comes from history the owner can write** (the review's L1-2 and R-1). The tape copies `meetings[]` from the battle's `gameplanMeetingHistory`. `firestore.rules:478` lets the battle's owner update that field. | The block is carried as CC-2's table assigns it: `outcome` and `legs` recorded, and the diagnosis quoted `by: 'platform'` at the meeting's `createdAt`. The excerpt joins nothing and quotes the one stored field. Strict instants (L1-1) keep an owner-written time from carrying an id. | Only the owner can write it, and only into their own excerpt and their own drafting call. But words an owner appends to a diagnosis would reach their agent as the platform's. Options: keep it (the owner can only mislead their own agent); drop `meeting` until the history is written only by the server, which is a rules and writer change outside C2's fences; or carry the diagnosis without a speaker. Ruled to drop it, one builder line goes and the goldens move by that block. |
| R17 | **"Since last time"'s adopted line** (the review's L3-9). | The chain's adopted line carries CC-8's sentence ("Your agent doesn't act on your ideas yet."). The "since last time" header's adopted line shows the stage word only. | CC-8 names the chain line's sentence. "Since last time" is a one-line digest. Ruled the other way, the same `adoptedNote` joins that line. |
| R18 | **`api/mandate/drain.js` is not a census root** (the review's L2-7). | Not a root. The Mandate path's roots are the cron and the prompt assembler, as CC-1 names them. | `drain.js` is the founder-only endpoint that drains open batches: it cancels each with the provider and writes their dispositions (`drainOpenBatches`). It assembles no prompt and submits nothing. Its 54-module closure reaches `mandateBatchTransport.js` and `mandateModelCall.js`, but no ledger module, no `plays` read, no excerpt and no Film Room module (probed at the head). Ruled a root, it joins `MODEL_PATHS.mandate` and passes the rule. The cron's exclusive-reach entry would then move, since `drain.js` reaches the batch transport too. |

## 10. The exit criteria C2 adds

| # | Criterion | How it is held |
|---|---|---|
| 15 | The excerpt carries a field the tape doesn't hold, exceeds a bound, or answers for another owner's data. | **Fields:** each field is pinned against its source on a live excerpt, and each absence by a row that removes its source. **Bounds:** each bound has a row at the limit and one over, astral characters included; over the bound, the text is absent. **Owner:** `null` for another owner's day, another owner's card and another agent, indistinguishable: the same `null`, and nothing logged. Mutants M02, M03, M05, M07a, M07b, M10, M33. |
| 16 | A model path other than the named exception reaches the ledger or the excerpt. | The census judges each path in one function (`oneDoorDefectsOf`). The exception admits only `drafting`, which does not exist yet. Every other path, the Mandate manager's included, is held to its whole closure. A planted excerpt import from each of the 20 roots (nine paths) fails, both static and dynamic (corrected in the fix round, CE-6: this said 21). Mutants M11, M12, M13, M35, M36, M45. |
| 17 | An id reaches the `excerpt` half, or two speakers' words share one quotation. | **Ids:** the detector checks `excerpt` for every id kind and every id shape, and it bites on a planted battle id, uid, agent id, entry id, watchlist id and nomination id. A loose owner-written time cannot carry one in: every instant is strict ISO 8601. **Speakers:** each quotation names one speaker, the directive's two texts are two quotations, and `inputQuote` is a copy of its own. Mutants M04, M06, M29, M30. |

## 11. The fix round (16 Nov 2026)

**Prompt:** "Fix prompt — Film Room C2: Astra's findings and Amendments D and E" (the Film Room chat, 16 Nov 2026).
**Governs:**
- Astra's C2 review (`docs/audits/20261116_ASTRA_REVIEW_FILM_ROOM_C2_EXCERPT.md`): DO NOT MERGE, on C2-F1 to C2-F4;
- Build C Amendment D (CD-3, CD-8, CD-14, CD-16, CD-17);
- Amendment E (CE-1 to CE-6).

All three are committed verbatim in B0.

**Branch:** `claude/film-room-c2-excerpt`, continued from `c8f9adb2` after `git fetch origin` (the head matched). `origin/main` was `71bc6bde` at the start and when re-fetched before the push, already in the branch, so the merged tree is the head tree and every check below ran on it.
**Code head:** `7ff64780`. **Pushed head:** this report's commit on top of it.

### Verdict

| Question | Answer |
|---|---|
| Built? | Yes: B0 and every item in the prompt's table, one commit each with its tests, then the §2 review's fixes (§11.1). |
| Astra's four findings | **C2-F1** (ids in quoted words): fixed by CE-1. **C2-F2** (a regex hides an import): fixed by CE-2. **C2-F3** (loose times): fixed by CE-3. **C2-F4** (unsettled ties): fixed by CE-4. The review's refuter re-ran all four attacks by its own probes on four heads, the last the final code head `7ff64780`. Each fails there: 0 of 60 id leaks on the card path (and 0 of 60 with platform-minted ids), 0 of 50 on the moment path, 0 of 20 roots evading, no loose time carried, and all six ties absent in both orders (§11.10). |
| Amendment D | CD-3, CD-8 (within CE-5's bounds), CD-14, CD-16 and CD-17 built. |
| What changes for a player today? | **Nothing with cards off.** The twelve cards-off goldens are byte-identical to `main`'s and to the committed files (§11.7). **With cards on (the allowlist only):** the subject line names the sector ("ETN · Industrials"), takes the idea from the battle's carriage, and leaves out a statement holding an id; on a casual clone's battle it waits for the counter before showing an idea; "Since last time"'s adopted line carries the chain's sentence. |
| The flag | `FILM_ROOM_CARDS_MODE` is still `'allowlist'`. No flag was added. |
| Tests | The full Linux suite at the final code head `7ff64780`: exit 0, **1,510 files passed, 0 failed** (12 skipped); 34,161 tests passed, 135 skipped. The rules suite: 42 files, 784 tests passed. `lint:gate` and `vite build`: exit 0 (§11.11). |
| Mutants | **59 of 59 killed** at `7ff64780`, none timed out: every mutant the prompt names, one per further guard, and one per review fix (§11.9). |
| §2 review | Three lenses, an independent refuter (four passes, the last on the final code head) and the mutating lens. **One BLOCKER (CX2-1, pre-existing in the walker's resolver, C2-F2's class) and one MAJOR (CX1-1, C2-F4's class) were found, CONFIRMED and fixed.** The lenses' other 18 findings (9 MINOR, 9 NIT) are fixed, except two recorded as readings: CX3-3 (corrupt data only) and CX3-4 (CD-17's reach). The refuter's own eleven: CXV-1 to CXV-5, CXV-7 and CXV-10 fixed; **CXV-6 (MAJOR) fixed for a static key**; **CXV-9 (MAJOR)** and CXV-8, the deliberately evasive spellings no static reading can close, recorded with CXV-6's run-time keys for a ruling on the guards' threat model (§11.13 Q-11); CXV-11 is Q-2. The refuter refuted no finding. The fourth pass, on `7ff64780`, found the four attacks closed, the last three fixes holding, and no regression or new finding. |
| Fences | Held (§11.8). `package.json` and `package-lock.json` change only to declare `@babel/parser` at the locked 7.28.5. |
| CI | BUILD_RULES §2: not watched, polled or fixed. Read once after the push (§11.11). |
| Needs a ruling | 11 readings, none blocking (§11.13). The weightiest: **the static guards' threat model (Q-11)** — the census and the write gate close every ordinary module syntax, and the refuter's deliberately evasive spellings (CXV-8, CXV-9) are recorded, not coded; a second carriage census updated alongside the one Astra named (Q-1); the shared day judge's identical-twin split (Q-3); CD-17's reach (Q-5). |

### 11.1 The fixes

One commit each, the tests in the same commit. CD-16 and CD-14 went in before CE-4 and CE-1: with the meeting block and `card.note` gone, the ties and the identifier policy had fewer locations to cover. The order changes no outcome.

| # | Item | Commit | Tests (same commit) | Mutants killed |
|---|---|---|---|---|
| B0 | Astra's C2 review, Amendment D and Amendment E, verbatim, with three `docs/README.md` rows | `5b4ce702` | — | — |
| 1 | **CE-2, the parser.** `__fixtures__/jsSource.js` reads imports and strips comments with `@babel/parser` (JSX on), declared as a devDependency at the lockfile's 7.28.5. Each distinct source is parsed once (a hash-keyed cache), and a module that does not parse throws, naming itself. | `7f6b7c80` | `oneDoor.census.test.js`: Astra's exact suffix on each of the twenty roots; a regex after `if`, `while`, `for`, `else`, `return`, `typeof`, `=>`; every import form; no false edge from strings, templates, JSX text or comments; an unparseable module fails; twenty roots on nine paths pinned. `jsSource.test.js`: the same at the unit level, and the declared version. | CXM01–CXM04 |
| 2 | **CE-3, strict instants.** One calendar-validating parser, `instantMs` (with `instantText` on it), behind every instant the excerpt carries or compares. `afterExit` needs a strict exit instant. | `10cf4225` | `filmRoomSubject.test.js`: the refusals and acceptances. `momentExcerpt.golden.test.js`: each time form on the exit, a quotation's `at` and a tie-break. | CXM05–CXM07 |
| 5 | **CD-16, no meeting.** | `711b9099` | A forged, owner-written meeting history through the real writer: no meeting, none of its words. `FilmRoomMeetings.writer.jsdom.test.jsx`: the owner's screen still quotes it. | CXM26 |
| 6 | **CD-14, one home for the note.** | `3d0f4915` | `card` holds no note, and the note appears once, as `inputQuote`; missing, empty, non-string and over-bound notes. | CXM27 |
| 3 | **CE-4, unsettled ties.** `oneOf` and `earliestBy` at each of the six selections. | `56bed776` | The six cases, each with a conflicting twin (absence) and an identical twin (the untied answer) under five orders; settled controls; no fallback to a neighbour; the time tie-break for all seven forms. | CXM08–CXM15 |
| 4 | **CE-1, identifiers in words.** `src/utils/promptBoundText.js`, the one policy; `subjectKnownIds`, the one known-id set for the excerpt and the screen. | `6bc7882c` | `promptBoundText.test.js`: the kind list, the shapes, the prose controls, the domains. `momentExcerpt.golden.test.js`: Astra's ten id kinds in each of the six quotation locations; the moment's excerpt by shape; prose carried; the real paths; recorded fields outside their domains. `FilmRoomSubjectLine.jsdom.test.jsx`: the receipt's and the form's lines equal to the excerpt's, through the real screen. | CXM16–CXM25 |
| 7 | **CD-8 and CE-5, the battle's idea.** | `14a4b7a8` | `filmRoomSubject.test.js`; `momentExcerpt.golden.test.js`; `momentExcerpt.test.js` (a clone's battle); `momentExcerpt.carriage.test.js` (the real `createAgentBattle`: an ordinary deploy, a tournament handed a carriage, no carriage); `FilmRoomSubjectLine.jsdom.test.jsx` (the version bound to the battle's path; cards off reads nothing); `carriage.test.js` (its reader-census row only). | CXM28–CXM32 |
| 8 | **CD-3, the sector's name.** | `aa6295dd` | "Industrials", two-word names, an unknown symbol, a code with no name; the screen equal to the excerpt. | CXM33 |
| 9 | **CD-17 and CE-6.** | `9da1414f` | The digest's adopted line holds the sentence, a non-adopted card's none; a null argument (and other non-objects) gives `null` with no read; the denied line without the idea. | CXM34–CXM36 |
| — | **The two whole-tree censuses** the first full suite caught (§11.11) | `4473a725` | `equippedHypothesisRefs.census.test.js` lists the three new names; `unconfirmedOutcome.census.test.js` no longer sees a word. | — |
| — | **§2 review, lens 2 (CX2-1 to CX2-7):** fail closed on every edge the walks cannot follow | `c01441ec`, `b59db948` | Census rows on every root (query, fragment, percent-encoding); every local form resolves or throws; opaque loads throw; the whole-tree rows resolve, with a planted-spelling row; the write gate's second reading, and its fail-closed walk. | CXM37–CXM42 |
| — | **§2 review, lens 1 (CX1-1 to CX1-7)** | `9bbef3eb` | The moment's version and instants under every order of the stored items; conflicts on every compared field; failed auxiliary reads; prose-safe shapes; a refused bar time; the card's other ids. | CXM43–CXM48, CXM51 |
| — | **§2 review, lens 3 (CX3-1, CX3-2, CX3-5, CX3-6)** | `3ec827cf` | A clone's battle on the screen, with the counter and without it. | CXM49, CXM50 |
| — | **The refuter's findings (CXV-1, CXV-3 to CXV-5) and the card path of CX1-1** | `08d567b6`, `d6222442` | Ids in disguise; every invisible character; the module loader by an alias, a member or `process`; members named but not called; a card on a day whose moment items disagree on the version, `null` in every order. | CXM52–CXM56 |
| — | **The refuter's third pass (CXV-6, CXV-7, CXV-10)** | `7ff64780` | The module loader by a string key, on every root; a `data:`, `https:`, `virtual:` or protocol-relative specifier fails closed, on every root; the client SDK's four write functions in the write gate. | CXM57–CXM59 |

### 11.2 CE-2: each path's walk under the parser, against `main`'s

Walked on the same tree (the fix round's head) with three extractors:
- `main`'s former regex stripper (`71bc6bde` `oneDoor.census.test.js:109-124`);
- C2's hand lexer (`c8f9adb2` `jsSource.js`);
- the parser.

| Path | `main`'s extractor | C2's lexer | The parser |
|---|---:|---:|---:|
| evaluator | 252 | 253 | 253 |
| deploy | 118 | 118 | 118 |
| chat | 138 | 138 | 138 |
| voice | 120 | 120 | 120 |
| reflection | 165 | 165 | 165 |
| batchReview | 120 | 120 | 120 |
| debate | 17 | 17 | 17 |
| tournament | 93 | 93 | 93 |
| mandate | 82 | 82 | 82 |

- **The parser equals the lexer module for module on every path** at the head. The lexer's only flaw was the planted syntax; no current file holds it.
- **One walk differs from `main`'s:** the evaluator's gains `src/config/huddleFlags.js`. `main`'s stripper lost `api/_utils/huddle/gate.js`'s only import behind a `/*` in a line comment (§2 review L2-1). The same 253 is Astra's independent AST count.
- **The review's fail-closed rules (CX2-1, CX2-2, CXV-4, CXV-6, CXV-7) move no walk.** Every local import in the tree's 2,107 modules (8,617 specifiers) resolves to a module or names an asset. No file under `api/` or `src/`, tests included (3,615), names a specifier with a scheme other than `node:` or `file:`, a protocol-relative one, or the module loader by a member. The tree's one load no static reading follows is `src/components/discover/themesDkb.js`'s glob of JSON; it is pinned, and it is on no model path.
- **No verdict changes.** Every path, root, reach pin, the direct-edge rule and the whole-closure ledger check are unchanged: twenty roots on nine paths.
- **The write gate** reads the same parser:
  - its closure was 13 modules; CE-1 adds `src/utils/promptBoundText.js` and the registry it reads, `src/data/situationRegistry.js`, for 15;
  - neither has a write-pattern hit; the two pinned non-Firestore hits are unchanged;
  - its second reading (CX2-4, CXV-5, CXV-10), every member the closure names and every call's name, the client SDK's write functions included, finds exactly the same two: `add` at `tapeSources.js:95` and `set` at `filmRoomMoments.js:45`.
- **The parse cache.** The two whole-tree rows parse every module under `api/` and `src/` once (2–10 s on a loaded host) and carry a 60 s row timeout; every other row reads the cache.

### 11.3 CE-1: the identifier policy as built

`src/utils/promptBoundText.js`, imported by the excerpt (`api/`) and by `filmRoomSubject.js` (both sides). A quotation is left out **whole** when its text holds:
1. **An exact id the excerpt knows** (a substring), from `subjectKnownIds` in `filmRoomSubject.js`:
   - the owner's uid and the battle;
   - the battle's own agent (for a clone's battle, the clone) and the attribution agent (its parent);
   - the idea's list;
   - for a card: its entry, the agent it is filed under, its op id, its nomination's book and id, and the idea, result and offer ids it holds (CX1-7).

   The screen builds the same set: the tape's owner and battle, the battle's agent, and the counter's `attributionAgentId`, plus the card's on a receipt. On a casual clone's battle the screen shows no line for a battle carrying an idea until the counter has named the parent (CX3-1).
2. **An id shape the platform mints** (`ID_SHAPES`). A token is a run of letters and digits, bounded by anything else:
   - `firestore-auto-id`: exactly 20 letters and digits, holding a digit, an upper-case and a lower-case letter (CE-1's letter);
   - `firebase-uid`: exactly 28, by the same rule;
   - `uuid` (any version, case-insensitive): also covers `op_`, `f_`, `bk-`, `inv_`, `evo_`, `bev_` and research work ids on a uuid host;
   - `agent-prefix`: `casual-agent-` and `training-agent-` with a digit in the tail, and `cpu-agent-` with digits, as minted (CX1-4), so "training-agent-based" passes;
   - `mandate-manager`: `mgr_…` ending in 16 hex;
   - `prefixed-hex`: `pf_`, `idea_`, `seat_`, `stk_`, `dbt_` with 16 or more hex, and `solo-` with 12;
   - `bare-hex`: a token of 16 or more hex in either case, holding a digit and a letter;
   - `epoch-ms`: a 13-digit epoch-millisecond part joined by `_` or `-` (`gpm_…`, `draft_…`, `risk_…_ETN_…`, `challenge-…-…`; CX1-6);
   - `battle-sequence`: `eval_`, `trade_`, `prop_` with three or more digits;
   - `base36-fallback`: the client's `op`/`bk` fallbacks;
   - `live-draft-group`: `lds_…`;
   - `challenge-code`: `BB` with eight capitals and digits, holding a digit;
   - `playback-token`: a date, a dot, and 43 base64url characters.

   Composite ids (a call, a tick, a clone, a Practice Field entry, a research work id) are caught by the id inside them.
3. **The text as written and unmasked** (the refuter's CXV-1 and CXV-3). Every check in items 1 and 2 reads the text twice: as written, and with its disguises taken off (`unmaskedText`: NFKC folds full-width digits and letters to ASCII, and every default-ignorable code point and format character is removed — zero-width spaces and joiners, the soft hyphen, the word joiner, bidirectional marks and isolates, variation selectors, tag characters, fillers). Words a reader sees are unchanged; the quotation is still carried as written or left out whole.
4. **Domains:** `symbol`, `exit.sold` and `exit.bought` against the ticker shape (`^[A-Z]{1,5}([.-][A-Z]{1,2})?$`, which every directory symbol fits); `situationId` against the registry; the route against `CARD_ROUTES`; the exit's reason and mechanism against the tape writer's `EXIT_MECHANISMS`; the question against the menu at its version (as before).

**The id kinds it pins** (`PLATFORM_ID_KINDS`, 30 kinds, from the fix round's survey of `api/` and `src/`; each with where it is minted and an example its shape must catch):
- **Firestore auto-ids:** battles; client-created agents; watchlists; mandates; and every other auto-id document (groups, lobbies, claims, chat and dialogue sessions, theses, season entries, bundles, stories, bug reports, forge rules, plan notes, templates, client battles).
- **The Firebase Auth uid,** and the dev agents and wallets built on it.
- **UUIDs:** directive threads, chat exchanges, research sessions and messages, threshold positions, leases, signal drops, client request ids; and the uuid-based Film Room card op id (= entry = nomination id), findings, backing requests, mandate leases, evolution events, backing events and research work ids.
- **Agent prefixes:** the casual clone agent, the training agent, the CPU opponent agent; and the Mandate manager agent.
- **Hex ids:** the Practice Field book; the Practice Field idea and the ids built on it; the Mandate seat, backing stake and debit, and the solo season; the bare-hex model request, observation, news and narration ids.
- **Timestamped ids:** the gameplan meeting; the other `_`-joined epoch-ms ids; and the hyphen-joined ones (challenges, signal-drop chat messages, market news items).
- **Others:** the evaluation, trade and proposal sequences; the client base-36 fallbacks; the live-draft group; the challenge code; the huddle playback token.
- **Five kinds no shape can tell from prose,** each caught only when it is an id the caller knows exactly, with the reason pinned:
  - the bug report's display id (`CB-NNNN`), which reads like a code or a year ("CB-2026"; CX1-4);
  - six-character lobby join and challenge codes, which read like a ticker or a word;
  - short sequence ids (`cpu-N`, `epoch-0001`, `v<n>`, `r<n>`);
  - date keys;
  - base64url composition entry ids.

**Stated limits** (pinned by rows; §11.13 Q-2):
- A 20-character auto-id with no digit (about 3% of random auto-ids) has no shape here, so it is caught only when known exactly; the 28-character uid is in the same position (about 0.7%).
- An unknown id glued to a word ("battleAb3d…") or split by a line break has no shape; a known one is caught.
- A coined 20-character token holding a digit and both cases ("RSI14AboveSMA50Cross") and an underscore sequence ("trade_2026") are left out as ids.
- A known id is matched as a substring, so a very short id held by the caller would omit any quotation that contains it: over-omission, never a leak.

**Ordinary prose passes:** tickers (`ETN`, `NVDA`, `BRK-B`, `BRK.B`), prices, dates, times, percentages, numbers with separators, and long or mixed-case words, pinned by rows. So do every rationale, directive and statement in the Sep 23 fixture.

### 11.4 CE-3 and CE-4 as built

- **CE-3.** `instantMs` in `src/utils/filmRoomSubject.js` accepts `YYYY-MM-DDTHH:MM[:SS[.f{1,9}]]` with `Z` or `±HH:MM`. It checks the month, the days in the month (leap years by the Gregorian rule), hours 0–23, minutes and seconds 0–59, and offsets to 23:59, then takes `Date.parse`'s instant. The excerpt calls it for:
  - every carried instant (`from`, `to`, `filed`, a quotation's `at`);
  - the exit and every bar in `afterExit`: a series holding any bar whose start is not strict gives no `afterExit` (CX1-5), so nothing is inferred from a refused time;
  - both time tie-breaks.
  The R6 boundary (`tickSeq`) needs no time.
- **CE-4.** `oneOf(tied, pick)` compares the raw stored values of the fields each selection takes:

  | Selection | Fields compared |
  |---|---|
  | rationale | hypothesis, rationale, at |
  | directive | playerText, canonicalText, filedAt |
  | exit | mechanism, exitReason, symbolOut, symbolIn, exitPrice, at |
  | tag item | count |
  | check | `stagnation[symbol].ticks` |
  | bar | t, c |

  `earliestBy` breaks a time tie only when every tied candidate's time is strict. The tie is found on the selecting key before any payload is judged, so a bad twin conflicts rather than silently losing. A bar is a row with a strict start after the exit; `barsAfter` counts distinct starts.
- **The moment's own fields (CX1-1).** The shared day judge (`momentsOf`, `judgeFiledDay`) takes the moment's version and its two instants from the first stored item it meets. The excerpt now says each only when every stored item it could come from agrees:
  - `situationVersion`: every tag item of the moment (its situation and symbol, at its checks);
  - `from` and `to`: every such item at the first and the last check.
  Otherwise the field is absent. On the card path, a day whose moment items disagree on the version gives `null` in every order: the day cannot be said to hold the version the card was filed under (CC-4). The judge itself is unchanged (§11.13 Q-3).

### 11.5 CD-8 and CE-5 as built

- **The source.** The idea is the battle's frozen carriage, `agentContext.equippedHypothesis`, read by `carriedIdeaOf` in `src/utils/filmRoomSubject.js`, the one new reader. It reads the list, the version number and the content hash only, never the frozen statement, and never the day's calls.
- **The battle already read (detail 1).** `ownedDayOf` now returns `{ tape, battle }`, and the excerpt reads the carriage from that battle: the reads are the same four gets for a moment and five for a card (pinned). The screen reads the carriage from the `battle` it was handed. Every route into `FilmRoomScreenV2` hands the battle document it shows; the review's lens 3 checked the call sites (§11.10).
- **Provenance (detail 2).** The version is `recorded`, from `CARRIAGE_NUMBER_CLASSES` (the battle document holds no number declaration of its own), at the path `agentContext.equippedHypothesis.hypothesisVersion`:
  - the excerpt classes it there;
  - the screen's `TapeNum` binds `v{n}` to that path on the battle, with the declaration handed in (a new `classes` prop; absent, every existing call site renders as before);
  - the sweep harness holds its own oracle for that one number (`SPEC_BATTLE_NUMBER_CLASSES`).
- **The check (detail 3).** The version document must be the owner's, and agree with the carriage's list, version number and content hash (the stored hash; recomputing it would pull a hashing module into the read-only closure). CE-5's correction:
  - another owner's or a contradicting document: no idea at all;
  - missing or unread: the idea without its statement.
  The screen's `subjectOfDayRead` treats each case the same way; a denied read shows the line without the idea.
- **The pins (detail 4).**
  - `carriage.test.js`'s reader census gains `src/utils/filmRoomSubject.js`, its only change.
  - The second carriage census, `equippedHypothesisRefs.census.test.js` (ruling Q10), lists the same reader, the fixture and the harness (`4473a725`); Astra's §5 named only the first (§11.13 Q-1).
  - The fixture builds its version with the store's `buildVersionDoc` and freezes it with `carriage.js`'s `siblingOf`, and the day mints no call.
  - The goldens are byte-identical through CD-8: the same version, the same class.
- **Tournament.** `momentExcerpt.carriage.test.js` creates battles through the real `createAgentBattle` and the real creation transaction:
  - an ordinary deploy's carriage is read exactly;
  - a tournament battle handed a carriage in its options stores none, so the excerpt has no idea;
  - a deploy with no carriage gives no idea.

### 11.6 The excerpt's goldens: new SHA-256 values

| After | The moment | The card | Why it moved |
|---|---|---|---|
| C2 (`c8f9adb2`) | `51a50dd4e947daf128e0b847e0445c872788e0f41c2c7c46135f326f960b302b` | `dbd74ab53a684cee25e4883823cf26a5ae7f76d5c048954391f163ea1aa65f6f` | — |
| CD-16 (`711b9099`) | `5d9fed6d00227641b1cf0e4c2f4efe320ee6559154026030da7a11c85c5990ee` | `5349062d9890be04e6110187a2ecf67dc3355f048261cd5f321eafadf82612ae` | The `meeting` block left both. |
| CD-14 (`3d0f4915`) | unchanged | `13a700988e09d2e441fadbf31e328f153a9c7b13ac40d24b65bb57835fee03a5` | `card.note` left the card; `inputQuote` stays. |
| CD-8 (`14a4b7a8`) | unchanged | unchanged | **No byte moved:** the same version (3) and class (`recorded`) and the same statement, now from the battle's carriage. The rows prove the source switch. |
| CD-3 (`aa6295dd`) — **current** | `cff3ecd44b55090a91a29d0dda19435f9bfef6c34fbf8ba7b9502658ff7e9637` | `397116410d1d178651625e32ed7f3fa04794ddc9b9bec94d8fb278fce13d0c5a` | `sector` reads "Industrials", not "XLI". |

CE-1, CE-3, CE-4, CE-6 and every review fix move no byte: the fixture holds no id in its words, no loose time and no tie, and its moment's items agree.

### 11.7 The twelve cards-off goldens, re-captured

In the private WSL worktree, the capture harness (`src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx`) ran twice at the final code head `7ff64780` and twice at `main` `71bc6bde` (and, before the last guard fixes, the same at `d6222442`: 60 of 60 equal). Each capture was compared with the other run at its commit, the other commit's captures, and the committed `src/screens/__golden__/filmRoomV2.*.html` at both commits: **60 of 60 comparisons equal; 12 of 12 byte-identical.** The SHA-256 values are exactly §2.2's. The branch does not touch that directory. Criterion 10's declared cards-off changes are still only C1's §8 rulings 1 and 2.

### 11.8 Fences

- **`package.json` and `package-lock.json`** change by one line each: `"@babel/parser": "7.28.5"` among the devDependencies (the lockfile's root entry). The lockfile already held `node_modules/@babel/parser` 7.28.5 (`dev: true`). No package was added, removed or moved: `npm ci` exits 0 and leaves `package-lock.json` byte-identical (§11.11).
- **Not edited:** any BUILD_RULES §1 file, and `api/cron/agent-evaluate.js`.
- **Called, never edited:** `createAgentBattle` (fenced), by `momentExcerpt.carriage.test.js` only, as `carriage.test.js` already does.
- **Not in the diff:**
  - `casualClone.js`;
  - `firestore.rules`, `firestore.indexes.json`, `src/config/featureFlags.js`;
  - the hub (`src/components/CommandCenter/**`);
  - every `mandate*` file, all of `api/_utils/practiceField/**`, and `src/data/practiceFieldSlots.js`;
  - the tape's writers, the setup evaluator and `activationEvidence/**`;
  - the workflow and the CI guard;
  - `api/_utils/agentBattleService.js` and `api/agent/decide.js`.

  Checked by path against the fix round's 29 changed files (`c8f9adb2..7ff64780`) and the branch's 48 against `main`. The C1 seam (`api/_utils/filmRoom/practiceFieldSeam.js`) is in the branch's diff from C1 and C2, not the fix round's.
- **`api/_utils/hypothesisRecords/carriage.test.js`** changes only its reader-census row (one line).
- **`FILM_ROOM_CARDS_MODE`** stays `'allowlist'` (`src/config/featureFlags.js:3536`). No flag was added.
- **Nothing outside the branch:** no merge, production read or write, backfill, refresh, deploy or flip. The fix prompt reached no external service.

### 11.9 The mutants

**How they ran.** In the private WSL worktree at the final code head `7ff64780`: a clean LF tree with its own `npm ci`, Node 20.20.2, `TZ=UTC`. The runner (`mutate.mjs` and `mutants.mjs`, the session's scratchpad) handles each mutant the same way:
- every edit's anchor must occur exactly once, or the mutant is BROKEN, never skipped;
- it runs the mutant's own test files with a **fresh** JSON report;
- it restores each file byte for byte, and checks the restore.

**KILLED** means a non-zero exit **and** at least one failing row. A load error with no failing row would count as CRASHED; none occurred, and no failing row was a timeout. The unmutated baseline of the nine files the battery runs is green: 467 of 467. Ids CXM01–CXM59 are unused elsewhere in the repo; the build's battery was M01–M49.

**59 of 59 killed. 59 defined, 59 ran, none broken, none timed out, and the tree was clean after.**
- The first 36 cover the fix round's items. A first battery at `4473a725` killed them, 36 of 36. They were re-run on the final code, with the anchors the review's fixes moved re-cut (CXM01–CXM04, CXM16, CXM21).
- CXM37–CXM59 are one per review fix. Earlier batteries killed CXM01–CXM52 at `08d567b6` (52 of 52) and CXM01–CXM56 at `d6222442` (56 of 56, none timed out); the battery below is the whole set on the final code.

| Mutant | Item | What it does | Verdict | Rows it fails |
|---|---|---|---|---|
| CXM01 | CE-2 | **the regex-after-`if` trap back:** C2's hand lexer extracts the imports again | **KILLED** | 30: Astra's attack on **every one of the twenty roots**, the census's syntax rows, the parser's unit rows |
| CXM02 | CE-2 | **`import()` with options missed** | **KILLED** | 2 |
| CXM03 | CE-2 | a module the parser cannot read passed as one with no imports | **KILLED** | 2 |
| CXM04 | CE-2 | words in a string or template read as an import | **KILLED** | 79 |
| CXM05 | CE-3 | **`Date.parse` alone in `afterExit`** | **KILLED** | 1 |
| CXM06 | CE-3 | **30 February accepted** | **KILLED** | 6 |
| CXM07 | CE-3 | a refused time read as "later" in a tie-break | **KILLED** | 2 |
| CXM08–CXM13 | CE-4 | **array order decides** the rationale row, the directive, the exit, the tag item, the check, the series bar (one mutant each) | **KILLED** ×6 | 2, 4, 3, 1, 1, 1 |
| CXM14 | CE-4 | **identical duplicates counted twice in `barsAfter`** | **KILLED** | 2 |
| CXM15 | CE-4 | a conflict falls back to the neighbouring rationale row | **KILLED** | 2 |
| CXM16 | CE-1 | **a known id let through** | **KILLED** | 16 |
| CXM17 | CE-1 | **a 20-character auto-id let through** | **KILLED** | 8 |
| CXM18 | CE-1 | **a quotation redacted instead of omitted** | **KILLED** | 16 |
| CXM19 | CE-1 | **a ticker treated as an id** | **KILLED** | 27 |
| CXM20 | CE-1 | the idea's list not known to every quotation | **KILLED** | 2 |
| CXM21 | CE-1 | the card's entry, op and nomination ids not known | **KILLED** | 4 |
| CXM22 | CE-1 | the screen hands the form no ids | **KILLED** | 2 |
| CXM23–CXM25 | CE-1 | the moment's symbol, an exit mechanism, a route carried outside its domain | **KILLED** ×3 | 1 each |
| CXM26 | CD-16 | **`meeting` back** | **KILLED** | 5 |
| CXM27 | CD-14 | **`card.note` back** | **KILLED** | 15 |
| CXM28 | CD-8 | **the idea read from `calls[]` again** | **KILLED** | 1 |
| CXM29 | CD-8 | **a hash mismatch carrying the idea** | **KILLED** | 3 |
| CXM30 | CD-8 | **the version's provenance pointing at a call** (the screen's binding) | **KILLED** | 7 |
| CXM31 | CD-8 | **the version's provenance pointing at a call** (the excerpt's class) | **KILLED** | 9 |
| CXM32 | CD-8 | the frozen statement used when the version is missing | **KILLED** | 4 |
| CXM33 | CD-3 | **the fund code back** | **KILLED** | 16 |
| CXM34 | CD-17 | **the digest's sentence dropped** | **KILLED** | 1 |
| CXM35, CXM36 | CE-6 | **a null argument throwing** (`excerptOf`, `excerptOfCard`) | **KILLED** ×2 | 2, 1 |
| CXM37 | CX2-1 | a query or fragment no longer read through | **KILLED** | 24 |
| CXM38 | CX2-1 | a local specifier naming no module passed as no edge | **KILLED** | 4 |
| CXM39 | CX2-2 | the census walks past an opaque load | **KILLED** | 21 |
| CXM40 | CX2-2 | a computed `import()` no longer opaque | **KILLED** | 2 |
| CXM41 | CX2-3 | the whole-tree rows match specifier text again | **KILLED** | 1 |
| CXM42 | CX2-4 | the second reading misses a computed string key | **KILLED** | 3 |
| CXM43, CXM44 | CX1-1 | the moment's version, its last instant, from the first stored item again | **KILLED** ×2 | 1 each |
| CXM45 | CX1-3 | the version read without its catch | **KILLED** | 1 |
| CXM46 | CX1-4 | the agent-prefix shape loose again | **KILLED** | 1 |
| CXM47 | CX1-5 | a bar with a refused start skipped instead of refusing | **KILLED** | 1 |
| CXM48 | CX1-7 | the card's idea, result and offer ids not known | **KILLED** | 1 |
| CXM49 | CX3-1 | the form's line shown before the counter names a clone's parent | **KILLED** | 1 |
| CXM50 | CX3-2 | the screen hands the subject line no attribution agent | **KILLED** | 1 |
| CXM51 | CX1-2 | the exit compares its price and time only | **KILLED** | 1 |
| CXM52 | CXV-1 | an id in disguise read as written only | **KILLED** | 2 |
| CXM53 | CX1-1, the card path | a card answered on a day whose moment items disagree on the version | **KILLED** | 1 |
| CXM54 | CXV-4 | an aliased or member `createRequire`, or `getBuiltinModule`, read as no edge | **KILLED** | 1 |
| CXM55 | CXV-5 | the second reading takes only names called where they are named | **KILLED** | 2 |
| CXM56 | CXV-3 | the unmasking removes only the first round's invisible characters | **KILLED** | 1 |
| CXM57 | CXV-6 | the module loader by a static member key no longer opaque | **KILLED** | 23: the string-key row on **every one of the twenty roots**, the census's synthetic row, the parser's unit row, the write gate's fail-closed row |
| CXM58 | CXV-7 | a `data:`, `https:`, `virtual:` or protocol-relative specifier passed as no edge | **KILLED** | 23: the `data:` row on **every one of the twenty roots**, the census's synthetic row, the parser's unit row, the write gate's fail-closed row |
| CXM59 | CXV-10 | the client SDK's write names dropped from the second reading | **KILLED** | 1 |

Every mutant the prompt names is in bold. **Not mutated:** the tournament row's guard is the fenced writer's suppression (`agentBattleService.js`). The prompt keeps that file out of the diff, so the row stands on the real writer's output and is not mutated, even in a scratch tree.

### 11.10 The BUILD_RULES §2 review

The fix round's diff is well past the threshold, so the review ran in full. Each pass worked on its own LF `git archive` of the code head, read-only on git and the shared tree. The ids CX1–CX3, CXV and CXM are unused elsewhere in the repo.
- **Three lenses, static**, at `9da1414f`:
  - **CX1:** the excerpt's correctness and honesty;
  - **CX2:** the census, the parser and the write gate;
  - **CX3:** the screen side and the cards-off path.
- **An independent refuter (CXV)**, with `node_modules` linked, in four passes:
  1. at `4473a725`: Astra's four attacks by its own probes, then a run repro against every lens finding, then its own hunt (CXV-1, CXV-2);
  2. at `08d567b6`, after the lens fixes: the four attacks again, CXV-1 and CXV-2 confirmed fixed, three new findings (CXV-3 to CXV-5) and the card path of CX1-1;
  3. at `d6222442`: the four attacks again; CXV-3 to CXV-5 and the card path confirmed fixed; then its own hunt, which found three cheap gaps in the guards (CXV-6, CXV-7, CXV-10, fixed in `7ff64780`), two open-ended classes of deliberately evasive code (CXV-8, CXV-9) and a question on CE-1's letter (CXV-11);
  4. at the final code head `7ff64780`, a narrow pass: the four attacks, the three fixes, and regressions only. The open-ended evasion class was out of its scope, as it is recorded for a ruling (§11.13 Q-11). It found the four attacks closed, CXV-6, CXV-7 and CXV-10 fixed, and no regression or new finding.
- **The mutating lens:** the battery (§11.9), run whole on the final code.

**Result:** one BLOCKER (CX2-1, pre-existing in the walker's resolver, C2-F2's class) and one MAJOR (CX1-1, C2-F4's class), both CONFIRMED and fixed. The lenses' other 18 findings (9 MINOR, 9 NIT) are fixed, except two recorded as readings: CX3-3 (corrupt data only) and CX3-4 (CD-17's reach, a question). The refuter CONFIRMED every lens finding put to it (18 of 20; CX3-4, a question, and CX3-6, wording, were not put to it) and refuted none. Its own eleven:
- **fixed:** CXV-1 to CXV-5 (MINOR), CXV-7 (MAJOR) and CXV-10 (MINOR);
- **CXV-6 (MAJOR): fixed for a static key**; a key built at run time is the evasion class below;
- **recorded for a ruling, not coded (§11.13 Q-11):** CXV-9 (MAJOR) and CXV-8 (MINOR). The census and the write gate read ordinary module syntax; these spellings are written to evade a static reading (`eval`, `new Function`, `vm`, a worker; a variable key handed to `.call`/`.apply`/`.bind` or `Reflect.apply`, a destructured write method, `Reflect.get`). Each pass closed by a denylist finds the next spelling; whether to keep adding them is the founder's call;
- **a question:** CXV-11 is Q-2 (CE-1's own letter).

**The fourth pass (`7ff64780`) raised no finding.**
- **The fixes:** CXV-6, the string-key loader on 20 of 20 roots, throws `OPAQUE_IMPORT`. CXV-7, a `data:` (with a `file:` URL inside), `https:`, `virtual:` or `//host` specifier on every root, throws `UNRESOLVED_IMPORT`, 80 of 80. CXV-10, the four client SDK writes planted in three modules, are caught 12 of 12, and the real closure's raw hits are exactly the two pinned ones.
- **Regressions:** none.
  - The census (151 of 151), the parser (17 of 17) and the golden file (89 of 89) pass on the clean tree.
  - A whole-tree scan of 2,125 modules and 1,493 test files found 0 parse failures over 17,060 specifiers. The URL rule threw 0 times: the tree's only scheme is `node:` (1,197). No non-test module is newly opaque.
  - Ordinary specifiers and members (`firebase/firestore`, `@/…`, queried and asset paths, `x.create()`, `x.require(…)`, `require.resolve`) neither throw nor read as opaque.
- **An edge it did not file:** an object key `{ createRequire: 1 }`, or an uncalled `o.getBuiltinModule`, reads as opaque. That is a fail-closed false positive of CXV-4's identifier rule, and the tree holds no instance.
- **Its runs** passed `--cache=false` and wrote no cache.

#### Astra's four attacks, re-run by the refuter

| Attack | At `4473a725` and `08d567b6` | At `d6222442` and the final head `7ff64780` |
|---|---|---|
| **C2-F1** ids in quotations | **Fixed.** Card path: 0 of 84 leaks (Astra's 10 kinds × 6 locations, plus 4 real-shaped ids — `op_<uuid>`, `pf_<hex>`, an auto-id, a uid — × 6). Moment path: 0 of 55. The chat message through the real writer, the evaluation's rationale and hypothesis through the real writer, and a note `normalizeNote` accepts are each left out. 10 of 10 recorded fields clean (route, `drill_` route, exit reason, mechanism, `symbolIn`, symbol, situation, an item's `at`, the card's `createdAt`, the question id). Ordinary prose passes, 6 of 6. | **Fixed.** At `d6222442`: card path 0 of 60 leaks (10 kinds × 6 locations, 0 nulls); moment path 0 of 50 for the ids it knows or that match a minted shape (`op_<uuid>`, `op_<b36>`, `pf_<hex>` included). The real paths: a `normalizeNote`-accepted note leaves `inputQuote` out and keeps `card`; the chat message reaches the tape's `playerText` verbatim and the excerpt leaves it out, keeping `canonicalText`. 0 leaks across the recorded fields, a `numberClasses` class string included. The fixture's three card-side spellings, which match no minted shape and no id a moment excerpt knows, are carried on the moment path (15 of 15), as CE-1 reads. At `7ff64780`: card path 0 of 60 with the fixture's ids and 0 of 60 with platform-minted ones, each quotation left out whole and every other field equal to the baseline. Moment path 0 of 50 with minted ids. The chat message through the real writer is left out; prose controls are carried, 12 of 12. |
| **C2-F2** the regex trap on twenty roots | **Fixed.** 0 of 20 roots evade: all 20 report an excerpt defect. Controls (a plain import, `import()` with options, a bare import on the same line) are caught on 20 of 20. | **Fixed.** At `d6222442`: all 20 roots report exactly one excerpt route ending in `momentExcerpt.js`; none returns `[]`. At `7ff64780`: 0 of 20 roots give `[]`, and all 20 report the excerpt. The nine closures (253, 118, 138, 120, 165, 120, 17, 93, 82) equal Astra's independent AST counts. |
| **C2-F3** loose or impossible times | **Fixed.** For an exit `at` of `2026-09-23`, `…T19:00:00` or `9/23/2026 19:00 (id)`: the exit is present, `afterExit` absent, none of the strings carried. `instantText` refuses 30 February, 31 April, 24:00, minute 60, second 60 and `+24:00`, and accepts 29 February 2028. | **Fixed.** At `d6222442`: for the three loose forms, 30 February, `T24:00` and `+24:00` as the exit's `at`: `afterExit` absent 6 of 6, the exit kept on its tick, the loose string carried 0 of 6. An impossible instant as a rationale's, a directive's, the statement's or the note's `at`, `card.filed`, `from` or the last bar's start gives `null` or absence, 7 of 7. At `7ff64780`: `afterExit` absent and no loose string or id carried, 3 of 3. `instantText` refuses 11 of 11 impossible values and accepts 4 of 4 controls, 29 February 2028 among them. A bad time on a quotation's record gives `at: null` with the words kept; on the tag items, no `from` or `to`. |
| **C2-F4** six ties | **Fixed.** Each of the six cases (rationale, directive, exit with `afterExit`, tag item, check, bar) is absent forward and reversed. An identical twin bar gives the untied answer (`barsAfter` 5, not 6). With every tape array reversed, the excerpt is byte-equal to the original. | **Fixed.** At `d6222442`: each of the six conflicting twins absent in the original order and reversed; identical twins equal the baseline in both orders (`barsAfter` 5, the recorded count 3). At `7ff64780`: 12 of 12 absent (six cases, two orders), with `afterExit` going with the exit; identical twins equal the baseline, 12 of 12. |

#### Findings, verdicts, dispositions

| Id | Severity | Finding | Refuter | Disposition |
|---|---|---|---|---|
| CX2-1 | BLOCKER (pre-existing; C2-F2's class) | A relative import with a `?query`, a `#fragment` or percent-encoding resolved to nothing, and the walks read that as no edge. A planted `…/momentExcerpt.js?v=1` escaped all twenty roots, and `./cardStore.js?v=1` escaped the write gate. | CONFIRMED | **Fixed** (`c01441ec`): a query, a fragment and percent-encoding are read through; root-absolute and `file:` specifiers resolve; a local specifier naming no module throws (assets excepted). Rows on every root, and in the write gate. CXM37, CXM38. |
| CX1-1 | MAJOR (C2-F4's class) | The shared day judge takes the moment's version and its two instants from the first stored item, so a twin tag item's storage order decided `situationVersion`, `from` and `to`. | CONFIRMED | **Fixed in the excerpt** (`9bbef3eb`): each is said only when every stored item it could come from agrees. **The card path** (raised by the refuter's second pass, `d6222442`): a day whose moment items disagree on the version gives `null` in every order. The judge itself, shared with the card route, is unchanged (§11.13 Q-3). CXM43, CXM44, CXM53. |
| CX2-2 | MINOR | `require()`, `createRequire`, `import.meta.glob` and a computed `import()` were no edge. | CONFIRMED | **Fixed** (`c01441ec`): `require` of a string is an edge; the rest are opaque, and a walked module holding one fails. The tree's one opaque loader is pinned. CXM39, CXM40. |
| CX2-3 | MINOR | The whole-tree rows matched the specifier's text. | CONFIRMED | **Fixed** (`c01441ec`, `b59db948`): they compare resolved modules; a planted-spelling row bites. CXM41. |
| CX2-4 | MINOR (pre-existing) | The write gate was a per-line pattern: `ref.\nset(`, `ref['set'](` and `ref./**/set(` slipped it. | CONFIRMED | **Fixed** (`c01441ec`): a second reading of every call's name from the parser, beside the pattern. CXM42. |
| CX1-2 | MINOR | The conflict rows varied one field, so a mutant cutting a comparison list survived. | CONFIRMED | **Fixed** (`9bbef3eb`): a conflict on every compared field. CXM51. |
| CX1-3 | MINOR | No row failed only an auxiliary read. | CONFIRMED | **Fixed** (`9bbef3eb`): the version's and the series' reads failed alone; the core reads give `null`. CXM45. |
| CX1-4 | MINOR | Prose omitted: "training-agent-based", "cpu-agent-style", "CB-2026". | CONFIRMED | **Fixed** (`9bbef3eb`): the agent shapes only as minted; the CB- id has no shape. Kept by CE-1's letter, pinned as stated limits: "RSI14AboveSMA50Cross" (20 characters with a digit) and "trade_2026". CXM46. |
| CX3-1 | MINOR | On a clone's battle the form could open before the counter named the parent, and show a statement the excerpt leaves out. | CONFIRMED | **Fixed** (`3ec827cf`): no line for a battle carrying an idea until the counter has named the parent. CXM49. |
| CX3-2 | MINOR | No screen row used a clone's battle or planted an agent id. | CONFIRMED | **Fixed** (`3ec827cf`): rows for a clone's battle, with the counter and without it. CXM50. |
| CX3-3 | MINOR (corrupt data only) | The excerpt checks the version's `userId`; the screen's read is gated by the parent list's owner. They differ only when the list's owner and the version's differ, or the list is hard-deleted. | CONFIRMED as stated | **Recorded, not changed** (§11.13 Q-4): every writer stamps both. Matching it would add a read the ruling did not ask for. |
| CX1-5 | NIT | A bar whose start was not strict was skipped, not refused. | CONFIRMED | **Fixed** (`9bbef3eb`): no `afterExit`. CXM47. |
| CX1-6 | NIT | The epoch-ms shape missed hyphen joins. | CONFIRMED, raised to MINOR (CE-1 asks for a complete list) | **Fixed** (`9bbef3eb`), with the hyphen-joined kinds pinned. |
| CX1-7 | NIT | The card's idea, result and offer ids were not known. | CONFIRMED | **Fixed** (`9bbef3eb`). CXM48. |
| CX2-5 | NIT | A parse failure named no module. | CONFIRMED | **Fixed** (`c01441ec`). |
| CX2-6 | NIT | The parse cache's key collapsed lone surrogates. | CONFIRMED | **Fixed** (`c01441ec`): a hash of the UTF-16 code units. |
| CX2-7 | NIT | A comment claimed the wrong row primes the cache. | CONFIRMED | **Fixed** (`c01441ec`). |
| CX3-4 | NIT (a question) | CD-17's reach: the My cards rows read "adopted as your instruction" without the sentence. | — | **Built to the letter** (the digest's line); asked (§11.13 Q-5). |
| CX3-5 | NIT | An unused binding. | CONFIRMED | **Fixed** (`3ec827cf`). |
| CX3-6 | NIT | Stale wording in three places. | — | **Fixed** (`3ec827cf`). |
| CXV-1 | MINOR (the refuter's) | Ids in disguise were carried: an id split by a zero-width space, full-width digits, upper-case hex, a known id split by a zero-width space; also a no-digit auto-id, a glued prefix and a line-break split. | — | **Fixed** (`08d567b6`): every check reads the text as written and unmasked; hex in either case; the hyphen-joined news kind pinned. Confirmed fixed by the second pass. The no-digit auto-id, the glued prefix and the line-break split stay as CE-1's stated limits (§11.3, §11.13 Q-2). CXM52. |
| CXV-2 | MINOR (the refuter's; CX1-1's root) | A time the strict parser refuses still decided a moment's `from` in the shared judge. | — | **Fixed by CX1-1's fix:** the same answer (no version, no `from`, no `to`) under UTC, New York and Tokyo. Confirmed by the second pass. |
| CXV-3 | MINOR (the refuter's) | More invisible separators still split an auto-id: bidi isolates, U+034F, U+FE0F, a tag character, U+061C, U+3164, U+180B, U+17B4. | — | **Fixed** (`d6222442`): the unmasked reading removes every default-ignorable code point and every format character. Confirmed fixed by the third pass: 12 separators (the nine named, the zero-width space, the soft hyphen, the byte-order mark), mid-id, between every character and inside a known id, 36 of 36 left out. CXM56. |
| CXV-4 | MINOR (the refuter's; CX2-2's class) | An aliased or member `createRequire` (`import { createRequire as cr }`, `m.createRequire`, `process.getBuiltinModule('node:module').createRequire`) evaded the census on 20 of 20 roots. | — | **Fixed** (`d6222442`): an import of `module` or `node:module`, and `createRequire` or `getBuiltinModule` by name (aliased, as a member, through `process`), are opaque loads; the census fails. Confirmed fixed by the third pass; a string key was CXV-6. CXM54. |
| CXV-5 | MINOR (the refuter's; CX2-4's class) | Write calls that never name the method at the call site evaded both write-gate readings: `ref.set.call(…)`, `ref.update.apply(…)`, `(0, ref.set)(…)`, `Reflect.apply(ref.set, …)`, `ref[k](…)`, `ref.set.bind(ref)(…)`. | — | **Fixed** (`d6222442`): the second reading takes every member the closure names, called or not, and every call by a computed key. The real closure still finds exactly the two pinned hits. Confirmed fixed by the third pass for its six spellings, planted in three modules (18 of 18). CXM55. |
| CX1-1, the card path | (CX1-1's) | Raised by the refuter's second pass: a card on a day whose moment items disagree on the version was answered in one storage order. | — | **Fixed** (`d6222442`): `null`. Confirmed by the third pass: three such days × 26 orders × two filed versions, 156 of 156 `null`; the moment's `situationVersion` absent in every order. CXM53. |
| CXV-6 | MAJOR (the refuter's; CXV-4's class) | The module loader by a string key, `process['getBuiltinModule']('node:module')['createRequire'](…)`, evaded the census on 20 of 20 roots (also by concatenated keys). | — | **Fixed for a static key** (`7ff64780`): a member whose static name is `createRequire` or `getBuiltinModule` is an opaque load. Rows on all twenty roots, the census, the write gate and the parser's unit rows. A key built at run time (`'getBuiltin' + 'Module'`) is the evasion class: §11.13 Q-11. Confirmed by the fourth pass: 20 of 20 roots throw. CXM57. |
| CXV-7 | MAJOR (the refuter's; CX2-1's class) | A static `data:` import whose module imports the excerpt by its `file:` URL was neither an edge nor a throw, on 20 of 20 roots; Node loads it. | — | **Fixed** (`7ff64780`): a specifier with any scheme other than `node:` and `file:`, or a protocol-relative one, throws. The tree holds none. Rows on all twenty roots, the census, the write gate and the parser's unit rows. Confirmed by the fourth pass: 80 of 80 throw. CXM58. |
| CXV-8 | MINOR, a question (the refuter's) | `eval`, `new Function`, `node:vm` and `node:worker_threads` loads pass the census (20 of 20 roots); the first two load the excerpt in plain Node. | — | **Recorded for a ruling** (§11.13 Q-11): the class is open-ended, and the refuter asked where the line is. One non-test module uses any of them (`api/scripts/test-autopilot-cleanup.js`), so a pinned denylist would be cheap if ruled. |
| CXV-9 | MAJOR (the refuter's; CX2-4's class) | Write calls by a variable key handed to `.call`/`.apply`/`.bind` or `Reflect.apply`, a destructured write method, and `Reflect.get(ref, 'set')` pass both write-gate readings (21 of 21). | — | **Recorded for a ruling** (§11.13 Q-11), severity kept. A rule that flagged every uncalled computed member would flag the excerpt's ordinary reads (`holdingBasis[m.symbol]`, `c.stagnation[m.symbol]`); the narrower rule the refuter sketched is a denylist of evasive positions. |
| CXV-10 | MINOR (the refuter's; pre-existing) | The client SDK's `setDoc`, `updateDoc`, `addDoc` and `deleteDoc` were no write names, while the closure holds `src/` modules (12 of 12 missed). | — | **Fixed** (`7ff64780`) in the second reading; the line pattern (`scripts/census-film-room-v1-plays.mjs`, C1's script) is unchanged. The real closure still gives exactly the two pinned hits. Confirmed by the fourth pass: 12 of 12 caught. CXM59. |
| CXV-11 | MINOR, a question (the refuter's) | An auto-id with no digit (about 3%) or a uid with none (about 0.7%) is carried when the excerpt does not know it. | — | **Built to CE-1's letter**; it is Q-2. |
| NITs (the refuter's third pass) | NIT | Homoglyphs and combining marks are not unmasked (Cyrillic А, Greek Ο, U+0332, U+0301, Arabic-Indic digits); ordinary pieces joined by an invisible joiner into an id's exact shape are left out; `./MomentExcerpt.js` fails the census by the `plays` scan on Windows and throws on Linux; an interior identical twin splits the moment (Q-3). | — | **Recorded:** homoglyphs and combining marks join Q-2's stated limits and Q-11; the rest are absence or over-omission, never a leak. |

**Reviewer isolation.** Every pass worked in its own snapshot and touched no repo file, no git state and no other pass's tree. The refuter's third pass let vitest write its own results cache into the linked install (`node_modules/.vite/vitest/…/results.json`): not a repo file, and nothing reads it but vitest. The fourth pass ran with `--cache=false` and wrote none.

**Checked by the lenses, nothing found:**
- **CE-6:** the argument is checked before it is read, and nothing is read first.
- **CD-14, CD-16 and CD-3:** each correct as built.
- **CD-8 and CE-5:**
  - the idea comes only from the battle already read, never `calls`, never the frozen statement;
  - the version document is checked for its owner, list, version and hash;
  - the provenance is `recorded`.
- **CE-3:** every compare and every carried instant goes through `instantMs`/`instantText`.
- **The parser:**
  - its coverage of every import form;
  - it parses every module of the tree;
  - its comment stripping is token-identical;
  - it fails closed on a parse error;
  - the cache.
- **The census:**
  - Astra's attack rows are non-vacuous on all twenty roots;
  - every census pin is unchanged;
  - the dependency is declared at 7.28.5;
  - `carriage.test.js` changes only its census row.
- **The screen:**
  - cards off reads and renders nothing new;
  - every route into the screen hands it a full battle document;
  - the receipt reads its own battle's carriage;
  - the version binding and the harness's independent oracle;
  - CD-3's names pass the sweeps;
  - the CD-16 and CD-17 rows can fail.

### 11.11 Checks, and the Tests run

`origin/main` was `71bc6bde` when fetched before the checks and again before the push, and it is already in the branch: the branch merged with `main` is the head tree, so every check below ran on it.

| Check | Where | Result |
|---|---|---|
| `npm ci` | the private WSL worktree of `~/pd-ci` (a git clone), Node 20.20.2 | exit 0; `package-lock.json` byte-identical before and after (SHA-256 equal); the tree clean; `@babel/parser` 7.28.5 |
| Full Linux suite | the same worktree at `7ff64780`, `TZ=UTC`, `--maxWorkers=8`, under `flock` | exit 0 in 308 s: **1,510 files passed, 0 failed**, 12 skipped (1,522); 34,161 tests passed, 135 skipped (34,296). The JSON report agrees: `success: true`, 0 failed tests. |
| Earlier full suites | the same worktree | at `9da1414f`: two whole-tree censuses failed (`equippedHypothesisRefs.census` on the three new carriage names, `unconfirmedOutcome.census` on a word in a kind's description), fixed in `4473a725`; at `08d567b6`: 1,510 files passed, 0 failed (34,139 tests passed, 135 skipped); at `d6222442`: 1,510 files passed, 0 failed (34,141 tests passed, 135 skipped), with the rules suite (42 files, 784 tests), `lint:gate` and `vite build` all exit 0 |
| Rules suite (`npm run test:rules`, emulator) | the same worktree at `7ff64780` | exit 0 in 155 s: 42 files, 784 tests passed |
| `lint:gate` | the same worktree at `7ff64780` | exit 0, no warnings |
| `vite build` | the same worktree at `7ff64780`, and again at the pushed head | exit 0, 4,208 modules transformed. Its four CSS-syntax warnings come from comments in `league.css` and `battleArena.css`, which the branch does not touch. |
| The census and acceptance C | `oneDoor.census.test.js` (151 rows), `momentExcerpt.golden.test.js`, `momentExcerpt.test.js`, `momentExcerpt.carriage.test.js`, `jsSource.test.js`, `promptBoundText.test.js`, `filmRoomSubject.test.js`, `FilmRoomSubjectLine.jsdom.test.jsx` and `FilmRoomCards.jsdom.test.jsx`: the battery's baseline (nine files) | green: 467 of 467, and inside the full suite |
| The twelve cards-off goldens | §11.7 | 12 of 12 byte-identical to `main`'s and to the committed files (60 of 60 comparisons) |
| The mutants | §11.9 | 59 of 59 killed |

**The Tests run** (read once after the push; BUILD_RULES §2: not watched, polled or fixed): this report's commit is the pushed head, so the run is read after the push and reported in the PR comment that posts the head SHA.

### 11.12 The excerpt's contract for the Practice Field (T1b + T1d) — the one current text

**This section replaces §6.** It restates the contract whole, after Amendment D (CD-3, CD-8, CD-14, CD-16) and Amendment E (CE-1, CE-3, CE-4, CE-6). T1b + T1d reads this text, not §6.

#### The two exports

```js
import { excerptOf, excerptOfCard, MOMENT_EXCERPT_VERSION } from '../filmRoom/momentExcerpt.js';

excerptOf(db, { uid, attributionAgentId, battleId, etDate, moment })   // one game moment
excerptOfCard(db, { uid, attributionAgentId, entryId })                // one card, through its filed source
// each → Promise<{ excerpt, refs } | null>
```

- `db` is the Admin SDK's Firestore. The excerpt only reads, with plain document gets, never a query or a collection scan:
  - the tape day and the battle;
  - for a casual clone's battle, the owner's clone document and its parent agent (the platform resolver's ownership guard);
  - the one hypothesis version the battle's frozen carriage names (CD-8);
  - the sold symbol's series document;
  - for a card, the card.
- `moment` is `{ situationId, symbol, fromTickSeq, toTickSeq }`: exactly one of the day's stored moments, as `src/utils/filmRoomMoments.js` derives them. A sub-range or a superset is `null`.
- `attributionAgentId` is the agent the card ledger and the book are keyed by: the ranked agent, which for a casual clone's battle is the clone's parent.
- `MOMENT_EXCERPT_VERSION` is `1`: today's BaggerBomb tape (CC-6).

#### What `null` means (narrowed by CE-6)

`null` is one answer for all of these, with nothing logged and nothing that tells one from another (CC-5):
- a failed **core** read: the card, the tape day or the battle;
- the tape day, the battle or the card is missing or is another owner's;
- the battle's attribution agent is not the one named, or a clone's battle has no resolvable parent, or a parent that is not the owner's;
- the moment is not one of the day's stored moments;
- the day's situations are unavailable, or it records no archetype;
- for a card, the filed source has changed: another situation version, another archetype, the moment gone or moved (CC-4);
- for a card, the moment's stored tag items disagree on their version, so the day cannot be said to hold the version the card was filed under (the fix round's review, CX1-1);
- a malformed argument, `null`, an array or a primitive in place of the argument object included (CE-6).

A failed **auxiliary** read does not give `null`. It gives a partial excerpt, as each field's contract says:
- a version document that is missing or fails to read: the idea without its statement;
- a series document that is missing or fails to read: no `afterExit`.

A `null` is never a reason to guess. Treat it as "no excerpt".

#### What the excerpt is not (CE-6)

The excerpt is **not a consistent snapshot**, and **not a commit-time receipt**. Its gets are separate reads and can see different revisions of the tape, the version and the series. The consumer's W-05 rechecks at selection and before commit remain the consumer's.

#### `excerpt` — what may reach a prompt

Each value is `{ value, class }`. `class` is `recorded`, `derived`, or for a series bar `market`: the document's own declaration for that number, or, for the carried idea's version, the carriage's (CE-5). Each quotation is `{ text, by, at, class: 'quoted' }`: `by` is one of `agent`, `player` or `platform`, and `at` is the record's time for the words, or `null`. A field the record doesn't hold is absent.

| Field | Shape | Source |
|---|---|---|
| `excerptVersion` | `1` | `MOMENT_EXCERPT_VERSION` |
| `battle` | `'b1'` | the battle's label |
| `symbol` | recorded | the moment's symbol, **only inside the ticker domain** (CE-1) |
| `situationId` | recorded | the moment's situation, **only if the registry holds it** (CE-1) |
| `situationVersion` | recorded | the moment's tag items (`tags.items[].version`), **only when every stored item of the moment agrees** (CX1-1); otherwise absent |
| `from`, `to` | recorded instants | the moment's first and last tagged checks, strict instants only, **and only when every stored item at that check agrees** (CX1-1); otherwise absent |
| `checks` | derived | the moment's number of tagged checks |
| `sector` | recorded | **the directory's name** (CD-3): `STOCK_UNIVERSE[TICKER_TO_SECTOR[symbol]].name`, e.g. "Industrials", "Consumer Discretionary". Absent for a symbol the directory lacks, or a code with no name. |
| `idea` | `{ label: 'i1', version?, statement? }` | **the battle's frozen carriage** (CD-8), `agentContext.equippedHypothesis`: its list, version and content hash only, never the day's calls. `version` is the carried number, `recorded` (CE-5). `statement` is the version document's, at most 280 code points, quoted `player` at the document's `createdAt`. No carriage (a tournament battle has none): no idea. A version document that is another owner's, or contradicts the carriage (another list, version number or content hash): no idea at all. One missing or unread: the idea without its statement. |
| `rationale` | `{ hypothesis?, rationale? }` | the `rationale[]` row at the moment's first check, or the nearest earlier one; each at most 500 code points, quoted `agent` at the row's `at` |
| `directive` | `{ playerText?, canonicalText? }` | the `directives[]` row heard inside the moment: the earliest heard, then the earliest filed by strict instant. The player's words are quoted `player` and the canonical text `platform`, each at most 400 code points, at `filedAt` |
| `exit` | `{ mechanism?, exitReason?, sold?, bought?, exitPrice? }` | the `actions[]` row selling the moment's symbol at its last check, or at the first check the day ran after it (R6), the earliest by strict instant. `mechanism` and `exitReason` only inside the tape writer's `EXIT_MECHANISMS` table; `sold` and `bought` only inside the ticker domain (CE-1). A missing part is absent; an exit to cash has no `bought`. |
| `afterExit` | `{ close, barStart, barsAfter }` | the sold symbol's series document for the day. **It needs a strict exit instant** (CE-3); without one it is absent. A series holding any bar whose start is not strict gives no `afterExit` (CX1-5). Its bars are the rows whose strict start falls after the exit: the latest one's close and start (both `market`), and `barsAfter`, the number of **distinct** bar starts (derived). Rows at the latest start that disagree, or a latest close that is no classed number, give no `afterExit`; no earlier bar stands in. |
| `count` | `{ value, class }` | `stalled`'s count at the moment's last check: the live rule's record on the recorded basis (`recorded`), else the tag item's count (`derived`). Never a neighbouring check's. |
| `card` | `{ label: 'c1', question?, route?, filed? }` | `excerptOfCard` only: the menu's question text at the stored version; the route (a stored `drill` reads `offer`), **only inside `CARD_ROUTES`**; the filed instant. **No `note`** (CD-14). |
| `inputQuote` | quotation | `excerptOfCard` only: **the card's note, its one home** (CD-14), at most 280 code points, quoted `player` at the card's `createdAt` |

**Not carried in version 1:**
- `meeting` (CD-16): the owner can write the battle's meeting history, so its words could pose as the platform's. It can come back in a later version, once meetings are server-written.
- `recurrences` (CD-4): if the drafting call wants it, the Practice Field asks the counter and passes the answer in.

**Bounds** are code points, and an astral character counts once: statement 280, hypothesis 500, rationale 500, playerText 400, canonicalText 400, note 280. A quoted text over its bound is **not carried**, never cut.

#### No identifier rides in on someone's words (CE-1)

Every quotation (`inputQuote`, `idea.statement`, `rationale.hypothesis`, `rationale.rationale`, `directive.playerText`, `directive.canonicalText`) is **left out whole**, never redacted or cut, when its text holds an identifier. `src/utils/promptBoundText.js` holds the one policy:
1. **Exact ids:** any id this excerpt knows, as a substring. Those are:
   - the owner's uid and the battle;
   - the battle's own agent (for a clone's battle, the clone) and the attribution agent;
   - the idea's list;
   - for a card: its entry, the agent it is filed under, its op id, its nomination's book and id, and the idea, result and offer ids it holds.

   One helper, `subjectKnownIds`, gives the excerpt and the screen the same set.
2. **Id shapes:** any token of a shape the platform mints, a token being a run of letters and digits bounded by anything else (`_`, `-`, `:` and `.` included). `ID_SHAPES` lists the shapes, and `PLATFORM_ID_KINDS` pins every kind the platform mints (30) with its shape, or with the reason no shape can tell it from prose (five kinds; §11.3).
3. **As written and unmasked:** items 1 and 2 read the text as written and again with its disguises taken off (NFKC, and every default-ignorable code point and format character removed), so a zero-width split, a bidi mark or a full-width digit hides no id. The quotation is still carried as written, or left out whole.
4. **Domains:** a recorded word outside its domain is absent (the rows above).

Ordinary prose passes: tickers, prices, dates, percentages and ordinary words of any length. The policy's stated limits (an auto-id with no digit, an unknown id glued to a word or split by a line break; a coined token of an id's shape left out) are in §11.3.

#### Times and ties (CE-3, CE-4)

- **Every instant** the excerpt carries or compares goes through one strict parser (`instantMs` / `instantText` in `src/utils/filmRoomSubject.js`): a full ISO 8601 date-time with `Z` or an offset, on a real calendar date and a real clock time. A quotation whose time is not strict keeps its words with `at: null`; a fact that needs the time is absent.
- **A tie the rules don't settle means nothing is said.** At each selection (the rationale row, the directive, the exit, the count's tag item or check, the series bar), candidates tied at the selecting key are compared on the raw values of every field the excerpt takes from them:
  - identical candidates count as one;
  - candidates that disagree leave the field absent, with every field that depends on it (`afterExit` depends on the exit);
  - a tie broken by time is broken only when every tied candidate holds a strict instant;
  - a conflict never falls back to a neighbouring row;
  - array order never decides: a permutation of the stored rows never changes the answer.
- **The moment's own fields** (`situationVersion`, `from`, `to`) are said only when every stored item they could come from agrees; on the card path, a version disagreement is `null` (above).

#### `refs` — never for a prompt

`refs` maps each label present to its real id: `{ b1: battleId, i1?: watchlistId, c1?: entryId }`. It is for the server's own resolution (contract V2 §5.1). Nothing in `excerpt` is an id.

#### The subject line

`subjectOfExcerpt(excerpt)` in `src/utils/filmRoomSubject.js` gives the line the receipt shows for the same card:

> "{SYM} · {sector name} · under your idea '{first 60 code points}' v{n}"

For example: "ETN · Industrials · under your idea 'Industrials and chips lead while the wider market drifts; r' v3". The screen applies the same identifier rule to the statement (CE-1), with the same known ids, and a read the rules deny shows the line without the idea (CE-5's CD-10 correction). On a casual clone's battle the form shows no line for a battle carrying an idea until the counter has named the parent, so it never shows a statement the excerpt would leave out (CX3-1).

#### What T1b + T1d adds to the census

In `api/_utils/filmRoom/oneDoor.census.test.js`, which now reads imports with `@babel/parser` (CE-2):
1. **A `drafting` model path** in `MODEL_PATHS` and `MODEL_PATH_ROOTS`, with its roots, its `KNOWN_REACH` and its `EXCLUSIVE_REACH` entries. The key-list pin gains `drafting`, and the root count moves from twenty roots on nine paths to the new totals: update the CE-6 count row with them.
2. **No change to `NAMED_EXCEPTIONS`.** The entry admits the path `drafting` and the **direct** edge `api/_utils/practiceField/draftingPrompt.js` → `api/_utils/filmRoom/momentExcerpt.js`. An importer reaching the excerpt through a helper fails the rule.
3. **The latent pins:**
   - update the row asserting the importer does not exist yet;
   - hold `drafting` out of "the exception table admits no existing path", and keep that row for every other path;
   - in "only a named importer may import the excerpt", keep the first assertion and expect exactly `draftingPrompt.js` in the second.
4. **What the exception admits:** for `drafting`, `oneDoorDefectsOf` judges `plays` on the walk behind the named edge, so the excerpt's own `plays` read is the exception's. The ledger is still judged on the whole closure.
5. **Astra's attack rows** cover every root in `MODEL_PATHS`, so the drafting roots join them automatically: each must fail with the planted suffix, and with the query, fragment and percent-encoded spellings of the excerpt's path.
6. **The walks fail closed.** A module on a walk must parse; a local specifier must resolve to a module or name an asset; a specifier with any scheme but `node:` and `file:` (`data:`, `https:`, `virtual:` …) or a protocol-relative one throws; and a load no static reading can follow (a computed `import()` or `require()`, `createRequire` or `getBuiltinModule` by name or by a static member key, an import of `module` or `node:module`, `import.meta.glob`) fails the path. The drafting assembler's closure must hold none of them. Code written to evade a static reading (a key built at run time, `eval`, `new Function`, `vm`, a worker) is outside the census until ruled (§11.13 Q-11).
7. **The Mandate honesty registry** entry for the excerpt as an input (contract V2 Amendment B item 6) is the Practice Field's, with the drafting assembler.
8. **The carriage censuses** (`api/_utils/hypothesisRecords/carriage.test.js`'s reader census, and `equippedHypothesisRefs.census.test.js`) list `src/utils/filmRoomSubject.js` as the excerpt's one reader of the battle's carriage. The drafting assembler reads the idea through the excerpt, never the carriage directly; a new direct reader is a new row in both censuses and needs its own ruling.

Every other path, the Mandate manager's included, stays held to its whole closure: it may reach neither the ledger, `plays`, the excerpt, nor the importer.

### 11.13 Needs a ruling

None of these blocks the merge. Each item below is built as stated, pinned, and changes in one place if ruled otherwise.

| # | Question | Built | Why |
|---|---|---|---|
| Q-1 | **A second carriage census.** Astra's §5 named `carriage.test.js`'s reader census. `equippedHypothesisRefs.census.test.js` (ruling Q10) also lists every file naming the carriage, fixtures included. | Three rows added (`4473a725`): `filmRoomSubject.js` (CD-8's reader: list, version and hash only), the excerpt fixture (writes a carriage), and the screen harness (its own declared class for the version's path). Neither census's read rows changed, and none of the three reads `evidenceRefs` or `origin`. | The full suite failed on the missing names. CD-8 authorises the reader. The fixture and harness rows follow the census's precedent (`sheetBattles.js`). Ruled otherwise, the harness can name the path another way and the fixture can build its carriage elsewhere, but the reader stays. |
| Q-2 | **CE-1's own letter.** These stay as written, and are pinned: (a) caught only when known exactly; (b) caught as ids. | (a) An auto-id with no digit (about 3% of random 20-character auto-ids) or a uid with none (about 0.7%), an unknown id glued to a word, an id split by a line break, and an id disguised by homoglyphs (Cyrillic А, Greek Ο, Arabic-Indic digits) or combining marks (U+0332, U+0301), which NFKC does not fold, have no shape (the refuter's CXV-11 and third-pass NIT). (b) A coined 20-character token holding a digit ("RSI14AboveSMA50Cross") and an underscore sequence token ("trade_2026") are left out as ids. | CE-1 defines the auto-id shape as 20 characters holding a digit and both cases. Looser shapes would omit ordinary prose; stricter ones would let real ids through. Ruled otherwise, the shape is one line in `ID_SHAPES`. |
| Q-3 | **The shared day judge (the review's CX1-1(d)).** An identical twin tag item at a check inside a moment splits the moment in `momentsOf`, so the excerpt (and the card route) find no such moment. | Unchanged: the excerpt answers `null` in every order, which is order-proof but not "identical count as one". The excerpt's own fields (`situationVersion`, `from`, `to`) now need every stored item to agree (`9bbef3eb`), and on the card path a version disagreement is `null` in every order (`d6222442`). | `momentsOf` and `sourceDay.js` are shared with the card route, which Astra confirmed byte-identical with `main` (CC-4). Changing them changes the route's moments. Ruled to change, `momentsOf` would merge identical items at one check, and the route's moments would move with it. |
| Q-4 | **The version's owner, on corrupt data (CX3-3).** The excerpt checks the version document's `userId`; the screen's read is gated by the parent list's owner (`firestore.rules`). | Unchanged. They disagree only when the list's owner and the version's differ, or the list is hard-deleted. Every writer stamps both, and the forge deletes softly. | Matching it would add a list read to the excerpt, which the ruling did not ask for. Ruled to match, the excerpt reads the list once and treats a foreign or missing one like another owner's version. |
| Q-5 | **CD-17's reach (CX3-4).** The "My cards" rows in the same region read "adopted as your instruction" under an "Adopted" heading, without the sentence. | Built to CD-17's letter: the digest's adopted line. | The ruling names "Since last time"'s adopted line. Its reason ("every idea surface until P4") may cover these rows too. Ruled so, the same copy key joins `CardRow` for an installed card. |
| Q-6 | **The hash check (CX1 Q2).** `ideaFrom` compares the version's stored `contentHash` with the carriage's; the deploy's `carriableVersion` recomputes it. | The stored field, as CE-5 states ("compare … content hash"). | Recomputing would pull the hypothesis store's hashing module into the read-only closure. Versions are server-written, so a stored hash that no longer matches its words means corruption at the store. |
| Q-7 | **A failed version read on the screen (CX1 Q3).** On a read error the screen shows no line, while the excerpt gives the idea without its statement. | As CD-10 rules: no line on loading or failure. CE-5's correction touched only the denied case. | CE-5 says the two sides "treat each case the same way"; CD-10 keeps "no line" on failure. Saying nothing is not saying something else. |
| Q-8 | **The instant rule's details (CX1 Q4).** | `instantMs` accepts a time with minutes and no seconds (`2026-09-23T19:00Z`), as the former rule did. The exit's sales at the same check break their tie by the earliest strict instant, like the directive's. | ISO 8601 allows the reduced form, and the records write full seconds. R6 and R7 name a time tie-break for directives only; the exit's mirrors it, and CE-4 makes a tie it cannot break absent. |
| Q-9 | **What a bar is (CE-4, CX1-5).** | A series row with a strict start counts as a bar, whether or not its close is a number. Any row whose start is not strict makes `afterExit` absent, and so does a latest bar with no classed close; no earlier bar stands in. | The tie must be found on the selecting key before any payload is judged (the review's advice under CE-4), and nothing may be inferred from a refused time (CE-3). The candle writer always writes both. |
| Q-10 | **The exit's reason domain (CE-1).** | `exitReason` is carried only when the tape writer's `EXIT_MECHANISMS` table holds it. A reason the writer records but does not map (its mechanism `unrecorded`) is now absent. | CE-1: "the exit's mechanism and reason, against the writer's lists". The table is the writer's only list. |
| Q-11 | **The static guards' threat model (the refuter's CXV-8, CXV-9; CXV-6's run-time keys).** The census and the write gate read a module's source. Must they also defend against code written to evade a static reading? | They close every ordinary module syntax, fail closed on what they cannot follow (a parse failure, an unresolvable or URL specifier, a computed `import()`/`require()`, the module loader by name or static key, `import.meta.glob`), and pin the tree's one opaque loader. **Not closed, recorded:** a key built at run time (`'getBuiltin' + 'Module'`), `eval`, `new Function`, `node:vm`, `node:worker_threads` (CXV-8, MINOR); a variable key handed to `.call`/`.apply`/`.bind` or `Reflect.apply`, a destructured write method, `Reflect.get(ref, 'set')` (CXV-9, MAJOR as the refuter rated it). | Each refuter pass closed by a denylist finds the next spelling, and every one of these is written on purpose: no ordinary edit produces them. A static census cannot close the class; a pinned denylist can narrow it. `eval`/`new Function`/`vm`/`worker_threads` appear in one non-test module (`api/scripts/test-autopilot-cleanup.js`), so that denylist would be cheap. CXV-9's narrower rule (a computed member as the object of `.call`/`.apply`/`.bind`, an argument of `Reflect.apply`, or a sequence callee, with destructuring keys and `Reflect.get` strings recorded) avoids flagging the excerpt's ordinary computed reads. Ruled "ordinary syntax only", nothing changes; ruled "close the listed spellings", both land in `jsSource.js` and the write gate with a row each, and the class stays open beyond them. |
