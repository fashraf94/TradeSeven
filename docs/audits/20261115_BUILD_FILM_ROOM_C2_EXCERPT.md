# Build report — Film Room C2: the moment excerpt

**Executor:** Claude Code (Opus), its own worktree, Windows + WSL · **Date:** 15 Nov 2026
**Prompt:** "Build prompt — Film Room C2: the moment excerpt" (the Film Room chat, 15 Nov 2026) · **Governs:** Build C spec V1 (`docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md`) with Amendments A, B and C (C governs where they differ), and the Practice Field's shared contract V2 with its Amendments B, C and D.
**Branch:** `claude/film-room-c2-excerpt`, cut from `origin/main` @ `cb23d73c` after `git fetch origin`. Main held #1049's merge `d9b4e3c1` and #1058.
**Code head:** `e7804bfb`. **Merged head:** `af2fddd1`, current `origin/main` `71bc6bde` (#1073, the CI unit suite sharded) merged in with no conflicts and no shared file. This report's commit sits on top of it. · **PR:** #1074 (opened as a draft; marked ready for review after the push)

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
- **Planted imports:** a planted import of the excerpt, static and dynamic, added to each of the 21 roots on the real graph, fails the rule.
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
| 16 | A model path other than the named exception reaches the ledger or the excerpt. | The census judges each path in one function (`oneDoorDefectsOf`). The exception admits only `drafting`, which does not exist yet. Every other path, the Mandate manager's included, is held to its whole closure. A planted excerpt import from each of the 21 roots fails, both static and dynamic. Mutants M11, M12, M13, M35, M36, M45. |
| 17 | An id reaches the `excerpt` half, or two speakers' words share one quotation. | **Ids:** the detector checks `excerpt` for every id kind and every id shape, and it bites on a planted battle id, uid, agent id, entry id, watchlist id and nomination id. A loose owner-written time cannot carry one in: every instant is strict ISO 8601. **Speakers:** each quotation names one speaker, the directive's two texts are two quotations, and `inputQuote` is a copy of its own. Mutants M04, M06, M29, M30. |
