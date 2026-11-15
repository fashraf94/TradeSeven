# Build KB-1 — Shared Research uses and records the KB method (dark: the list stays empty)

**Date:** 2026-11-14 (started 2026-11-13) · **Branch:** `claude/shared-research-kb1` (cut from `origin/main` `c85f7b41` after `git fetch origin`; the harness's `claude/shared-research-kb1-d455e3` was renamed before the first commit; `main` re-fetched before the final runs, unmoved) · **Code head:** `15f0aae5` (the last code and test change); the pushed head adds this report, the review record and two `docs/README.md` rows · **By:** Claude Code (Opus 5.5)
**Spec:** Shared Research spec V1.2 — Amendment A, Part 2 (§A4, §A5 KB-1 rows), with the KB-1 build prompt of 13 Nov 2026 governing where it makes the amendment precise · **Review record:** `docs/audits/20261114_KB1_SHARED_RESEARCH_METHOD_REVIEW.md`

## 1. Verdict

| | |
|---|---|
| **What was built** | Amendment A Part 2. An own-words investigation selects its method once, through the KB loader's authorized entry points, called from one file (`method.js`) with one argument each. Every model turn (the frame and each step) re-checks the session's stamp for the gate's uid, runs on the method that answers, and records it on its partner exchange and in the shadow log. Each step that retrieved keeps the title and highlights its partner was shown, with a hash and the findings that cite each item. Adoption records the methods behind the kept findings. On a KB turn only, the step prompt carries the §A4.6 method block and three more validator checks run. |
| **Dark?** | **Yes.** `KB_APP_USE` is still `[]`, so every selection is refused (`not_authorized`) and every investigation runs on `baseline@v0`. A baseline turn's two system prompts equal `main`'s byte for byte (a fixture captured from `main` before the change). The validator applies exactly B1's rules on a baseline turn. No file under `src/` changed, and the client `dist/` is identical to `main`'s (111 of 111 files). No route answer gains a key. No flag, rule, index, environment variable or collection was added. |
| **Tests** | Four new test files, one row in B1's route test, KB-0's two moved rows, and the review's rows. On Linux the Shared Research, KB and idea-record files pass: **40 files, 1,171 tests, exit 0**. The full suite: **1,468 files and 32,894 tests pass; 1 fails** — a `src/` test this build does not touch, which fails the same way run alone at `main` `c85f7b41` in the same setup and may be time-dependent (§8); so the suite exits 1. The rules suite 784/784, `lint:gate` clean, `vite build` with `dist/` identical to `main`'s, 111 of 111 files (§6). |
| **Mutants** | The 16 the prompt names (as 18 mutants: the body uid at frame and at step; the stamp and an exchange through `sessionViewOf`): **all killed**. The whole battery — with 11 more of the build's own and 20 for the review's fixes and rows: **49 of 49 killed** (§6). |
| **Review** | BUILD_RULES §2, multi-lens and adversarial: 5 lenses, then 5 refuters, each on its own snapshot. **54 findings: 35 CONFIRMED · 14 PARTLY · 5 REFUTED.** Every must-fix is fixed (a partner named "Will" switched the promise check off; rows that could not fail). Every confirmed finding with a remedy inside the prompt's letter is fixed, with a row and a mutant; where a fix went beyond the letter, the refuter held it so and it was reverted to the letter and asked. Record: `docs/audits/20261114_KB1_SHARED_RESEARCH_METHOD_REVIEW.md`. |
| **Open for the founder** | **11 founder questions, none blocking** — the list is empty, so no KB turn runs until the activation PR, and each can be ruled before it (each moves a pinned row). The two that matter most before activation: **FQ-1**, whether a KB frame turn runs the citation and promise checks (its `check` becomes the opening next action); **FQ-7**, whether the worked-example check exempts the player's own words (own words is the only KB consumer). The rest: FQ-2 the first turn's refusal reason, FQ-3 other bytes under the stamp's name, FQ-4 the readings R1–R17, FQ-5 the 400 KB pin's unit, FQ-6 "as shown", FQ-8 the promise's object, FQ-9 the service names, FQ-10 the citation and date forms, FQ-11 the method check on the summary (review record §4). **One finding outside the task to task separately:** a `src/` test failing on `main` (§8). |

## 2. In plain terms

- **What changes now: nothing anyone sees.** The authorization list is still empty. So when a player starts an investigation from their own words, the app asks the knowledge base for its method, hears "not authorized", and runs the same baseline method as before. It records why. The prompts the partner gets are the same as `main`'s, byte for byte, and so is every answer the app sends back.
- **What changes when the founder adds the one authorization entry.** For a player on the test list who starts from their own words, the partner is guided by "Evaluating an Idea". The method stays guidance, never evidence: facts still cite their sources, and only the suggested next step cites the method. Story and SignalDrop investigations stay on the baseline.
- **What is re-checked every turn.** Whether the method is still authorized, and whether this player is still in its audience. If the founder removes the entry, or takes a player off the list, the next turn runs on the baseline and records it; a step records the change from the previous turn and its reason (the very first turn of an investigation has no previous turn to compare with, so it records the baseline it ran on but not the reason — FQ-2). An investigation that started on the baseline never switches to the KB method.
- **What is recorded.** Each partner turn names the method it ran on. Each step lists the findings it wrote. Each step that searched keeps the title and highlights of every item its partner was shown, as they were handed to the prompt (the prompt then masks tickers the app does not hold), with a fingerprint of that text and the findings that cite it. The kept text is the record; the fingerprint only identifies it. An adopted idea records which methods produced its evidence. None of this reaches the player's screen.
- **What the KB turns refuse.** On a KB turn, three more checks fail a step outright:
  - citing the method itself as a fact's source;
  - echoing the method's own source ids ("(M1)") or its worked example (NVDA on October 30) as if it were a fact about this investigation;
  - promising the player that the Practice Field, the Film Room or the idea book will act on the idea, or that the agent, "I" or "we" will test or track it.

## 3. Changes by `file:line`

No fenced file (BUILD_RULES §1) was read, called or edited. **No file under `src/` changed.** No KB-0 file changed except the two rows Part 6 names.

The branch diff against `main` `c85f7b41`: 15 code, test and fixture files, +2,257 / −76 lines, all under `api/`; plus this report, the review record and two `docs/README.md` rows.

| File | What |
|---|---|
| `api/_utils/sharedResearch/method.js:56`, `:58` | `METHOD`, `METHOD_SOURCE`: unchanged (the baseline) |
| `method.js:61` `OBSERVATION_CONSUMER`; `:69` `BASELINE` | The consumer; the baseline as an effective method, `sha256` computed once at load |
| `method.js:85` `kbSourceRefOf`; `:91` `isOkAnswer`; `:100` `kbMethodOf` | The KB method's `sourceRef` (`Method · <title> v<version>`, cut to 120); an answer is used only when whole; its fields whitelisted, never spread (R-KB-3) |
| `method.js:112` `methodStampOf`; `:131` `selectMethod`; `:168` `effectiveMethodFor`; `:191` `citedSourceOf` | Part 1. The only calls to the KB module in Shared Research: `authorizedMethodFor`, `loadAuthorizedMethod`, `inAudienceFor`, each with one argument; `KB_REFUSALS` read. None throws; none reads the mode or the gate |
| `method.js:204` `methodRefOf`; `:214` `MARKERS`; `:224` `methodMarkersFor` | The exchange's four-field `method`; the v0.1 markers, keyed `KB-IDEA-EVALUATION-001@0.1` + `b0688fb3…4e` |
| `api/_utils/sharedResearch/session.js:80` `exchangeOf` | Writes `method`, `methodChange`, `findingIds`, `retrieval`, `methodsUsed` only when given |
| `session.js:110` `exchangeMethodOf`; `:121` `methodChangeOf`; `:136` `methodsUsedOf` | A recorded method as recorded (an exchange before KB-1 reads as the baseline); the change against the previous partner turn; the methods behind the kept findings, in turn order |
| `session.js:148` `seenSha256Of`; `:162` `retainedRetrievalOf` | Part 4 |
| `session.js:198`, `:223` | `framingSessionOf` / `openSessionOf` write the stamp they are given (the baseline stamp when none). `sessionViewOf` (`:340`) is unchanged |
| `api/_utils/sharedResearch/store.js:225`, `:238`; `:313`, `:337` | `beginFraming` and `openFromItem` pass the route's stamp through; a retried framing keeps its own |
| `store.js:670` | `adoptIdea`: the confirm exchange's `methodsUsed`, inside the transaction, its pre-minted `exchangeId` unchanged |
| `api/_utils/sharedResearch/stepPrompt.js:49` `KB_METHOD_RULES`; `:64` `methodBlockOf`; `:82`, `:109` | The method block: `METHOD.text` for the baseline (byte-identical), the §A4.6 wrapper for a KB method |
| `api/_utils/sharedResearch/opening.js:121`, `:193` | The opening's next action cites the `sourceRef` it is given (the baseline's when omitted) |
| `api/_utils/sharedResearch/stepSchema.js:433`, `:669`–`:673` | `ctx.method`; the next action cites `method.sourceRef` (its id minted at the same point as before: the mint order is unchanged) |
| `stepSchema.js:739`; `:781`–`:871` | The three checks (`kbTurnFailOf`), after every B1 rule, on KB turns only |
| `api/forge/shared-research.js:101` | `modelCallRecord`: `methodId`, `methodVersion`, `methodSha256`, `methodSource` of the turn's method, on all six call-record sites |
| `shared-research.js:176`, `:185`, `:207` | Frame: selection before `beginFraming`; the turn's method from the SESSION's stamp; the frame exchange's `method` |
| `shared-research.js:265`; `:289` | Open: an own-words opening cites its frame exchange's method; a story or a drop selects the baseline |
| `shared-research.js:347`; `:442`–`:445` | Step: the effective method once, before every failure path; the partner exchange's `method`, `methodChange`, `findingIds`, `retrieval` |
| `api/_utils/kb/boundary.test.js:356`–`:494` | KB-0's moved row (Part 6.1), its planted proofs included. Every other line of the file, the PERMANENT rows included, is byte-identical to `main` |
| `api/_utils/kb/loader.test.js:651` | KB-0's moved row (Part 6.2): it follows `KB_APP_USE`; the loop proven on a planted list |
| `api/_utils/sharedResearch/__fixtures__/baselinePrompts.main.json` | `main`'s step and frame system prompts (Rook, none, a 40-character name), captured from `c85f7b41` before the change (`0b20aefd`) |
| `api/_utils/sharedResearch/method.test.js` (23 rows), `session.kb1.test.js` (15), `kbMethod.checks.test.js` (36), `api/forge/shared-research.kb1.route.test.js` (24) | §6 (row counts by `it`; `it.each` expands them) |
| `api/forge/shared-research.route.test.js:249` | One row: the real loader and the shipped list |

No flag, rule, index, environment variable, collection or Vercel entry was added. `SHARED_RESEARCH_MODE` is still `'off'`; `KB_APP_USE` is still `[]`; `packages.test.js`'s pin is unchanged. No fenced file, no file under `src/`, no KB-0 file other than the two rows.

## 4. Where this prompt made the amendment precise (and the readings built)

**The prompt's own points of precision, as built:**

| # | The amendment | This prompt (governs) | Built |
|---|---|---|---|
| P1 | §A4.6 lists the three checks as validator additions | They run **only** on turns whose effective method's source is `kb`; a baseline turn is validated by B1's rules exactly (Rule 4) | `kbTurnFailOf` returns null unless `method.source === 'kb'`; a baseline turn holding "(M1)", "Practice Field", "We will track this idea" or NVDA on October 30 passes as on `main` (row 6) |
| P2 | "the method's worked example (for v0.1: NVDA with the October 30, 2026 noon figures)" | The v0.1 **markers**: the register ids `A0 C1 E1 M1 V1 T1–T6 I1–I6` in a bracketed group or after per/see/under/from; NVDA with "October 30" / "Oct. 30" / "Oct 30" in one sentence; keyed by id@version and the sha256 | `method.js` `MARKERS`, keyed `KB-IDEA-EVALUATION-001@0.1` + `b0688fb3…4e`; other bytes under the same version carry none |
| P3 | `opening.js:28` "cites the effective method's sourceRef" | The opening's next action: story and drop cite the baseline; an observation entry cites **the method its frame exchange ran on** (the next action is written from the frame) | `citedSourceOf` in `method.js`; the route passes it at `open` |
| P4 | §A4.4 "every item the partner was shown" | The retained items are **all items shown**: `fit.items` after the prompt budget's trims, in the order shown — cited or not | `retainedRetrievalOf` over `fit.items`; uncited items are kept with `findingIds: []` |

**Readings this build made where neither text decides (each is a founder question only if the founder disagrees; none blocks):**

| # | Reading | Why |
|---|---|---|
| R1 | **What "as shown" retains.** The item's bounded `title` and `highlights` as `fit.items` hands them to the prompt renderer — not the rendered line, which also collapses whitespace and masks tickers the universe does not hold (`stepPrompt.js` `seen`). | The prompt names `fit.items` and B1's bounds (300; 2 × 600); a masked title can exceed 300 characters (each mask is 33). The renderer is deterministic from these strings and the universe; a replay re-renders them. `seenSha256` is over the retained strings. |
| R2 | **`publishedDate` retained is the value shown.** A provider date later than the read is no date (spec §16 FQ-2); the route nulls it before the prompt, so the retained value is null too. | The prompt says "as the provider reported it; null when it gave none". A future date is treated as none everywhere else (the prompt's "no date", the finding's " · undated"), so the record agrees with what was shown. |
| R3 | **The stamp's `consumer`.** `shared_research.observation` for an own-words selection, whether the loader answered ok or refused; null for a story or a drop (nothing was asked). | It records which consumer was asked; `effectiveMethodFor` re-loads a KB stamp under it. |
| R4 | **`methodChange` back onto the KB method.** A KB-stamped session whose turn fell back (revoked) and whose next turn loads the KB method again records `{ from: 'baseline@v0', to: '<id>@<version>', reason: null }`. | The prompt's `reason` is "the refusal"; returning has none. A baseline **stamp** is never upgraded (R-KB-7); this is a KB stamp re-resolving, as §A4.1 requires every turn. |
| R5 | **`methodChange` compares** id, version, sha256 and source. An exchange written before KB-1 (no `method`, or no `source`) reads as the baseline. | Other bytes under the same version are a change, never silent (R-KB-7). |
| R6 | **The opening's label when the frame's KB method no longer loads at `open`** (revoked between the frame and the open). The next action still cites `kb` / `<id>@<version>`, labelled `Method · <id> v<version>` (the title is not on the frame exchange's four-field `method`, so it is re-read through the loader; when refused, the id stands in). | Citing the baseline would misattribute a next action written by a KB frame. |
| R7 | **The §A4.6 wrapper's line breaks.** The amendment's code block wraps two sentences across lines for display; the block is built one line per sentence (`KB_METHOD_RULES`). | The rulebook's own lines are one per rule; the wrapping is display only. |
| R8 | **The header's date** is the calendar date `acceptedAt` is written with, in its own offset: `2026-11-12` for `2026-11-12T18:49:26.981100-06:00` (it is 2026-11-13 in UTC). | "acceptedAt's calendar date". |
| R9 | **"Names both" for the record's exemption.** A current retrieval-backed finding names the worked example when its fact names NVDA — or the company's own name, "Nvidia" (the markers' `aliases`, used on this exemption side only) — or its symbol is NVDA, and its fact names October 30 or its own date is October 30 (`at`, unless it is only an undated item's read day; `asOf`). | The prompt's pass row: "an investigation into NVDA whose retrieved item is dated October 30" — a finding from such an item may say "Nvidia shares fell by noon" with the date only on the item. The refusal side matches "NVDA" only (the letter); FQ-10 asks about "Nvidia" there. |
| R10 | **Where the three checks look.** The reply as the model wrote it (before a number replacement), the summary as written (even when withheld), and every fact the step built — model findings, claims and the next action. | "the reply, the summary or any fact". |
| R11 | **Case.** Register ids and NVDA are matched case-sensitively; the dates, "Practice Field", "Film Room", "idea book" and the promise's subjects and verbs case-insensitively. "I" as a numeral ("Phase I", "Phase-I", "Series I", "Fund I", "Basel I" …) is no one. | The ids and the ticker are capitalised tokens; the rest is prose (the letter sets no case). |
| R12 | **The frame turn and the three checks.** The checks run on step turns; the frame's three texts (question, check, not-established) are validated by B1's `validateFrame` only. | The prompt words every check over step outputs ("the step", findings, summary, reply). **FQ-1** asks whether the frame should run the citation and service checks too: its `check` becomes the opening next action's fact. |
| R13 | **The partner's name in the promise.** The name, read like the text (NFKC, no format characters, straight apostrophes), is one more subject, matched whole-word and case-insensitively in place — never swapped into the sentence first (review CHK-1: B1's swap let a partner named "Will" switch the check off). The subjects otherwise are B1's partner words (spec §17 FQ-9), "we", "I" and "this/the/your idea". | "the partner's name"; the founder's FQ-9 ruling on who the agent and the partner are. |
| R14 | **A sentence, for the worked example.** It ends at `.`, `!` or `?` before a capital, a digit or a quote — never at an abbreviation ("U.S.", "p.m.", "vs.", "Inc.", "approx.", "Oct."). | "a sentence naming NVDA together with October 30" (review CHK-3). |
| R15 | **The forms.** A citation group's ids may be separated by `,` `;` `/` `&`, a dash or hyphen (a range: "T1–T6"), "and", "or", "to". "October 30" is not the date when "%" or "-day" follows it. Between "will" and the verb only whole filler units may stand, at most six: "also", "then", "both", "all", "be", "and", "of course", "continue (to)", "keep (on)", "start (to)", "begin (to)", an adverb in -ly (never a verb in -ply: "supply", "apply") — so "we will be on track", "I will be on trial" and "we will supply monitoring equipment" are no promise. | "a bracketed group of one or more of them"; "will … test, trial, track, monitor or adopt" (review CHK-4, CHK-5, CHK-11; the advisor's check of the fix round). |
| R16 | **`methodsUsed`'s order.** First seen walking the partner turns in the order they ran. | "the distinct method values of the partner exchanges … in first-seen order" (review REC-4). |
| R17 | **The tests' "fixture method" is the real v0.1 method.** Each Shared Research test that needs the KB path mocks the loader with a factory that keeps the real module and answers, per row, the method the REAL loader verifies from the committed package under a test-only authorization list (a second, `deps` argument — in test files only; production code calls each entry point with one argument, from `method.js` only, as the PERMANENT row pins). | Part 7: "a factory answering a fixture method". The real bytes make the size pins, the markers' hash key and the header's date the accepted package's own, not a copy's; no test imports the loader (the moved row refuses an import, `vi.importActual` included). |

## 5. The baseline's pins (for the KB chat's comparison)

| What | Value |
|---|---|
| `BASELINE.sha256` (SHA-256 of `METHOD.text`, UTF-8; computed at module load, pinned by `method.test.js`) | `72fb845a2d12be5d98195f1d9f451d3e8b7a323f269a94cc82a088cdcaeb95d1` |
| `METHOD.text` | 1,408 characters, 1,420 bytes |
| Baseline **step** system prompt (`main` `c85f7b41`, captured to `api/_utils/sharedResearch/__fixtures__/baselinePrompts.main.json`) | 6,452 characters with the partner name Rook (6,468 with no name; 6,488 with a 40-character name) — `tokensOf` 1,613 / 1,617 / 1,622 |
| Baseline **frame** system prompt | 3,297 characters with Rook (3,313 / 3,333) — `tokensOf` 825 / 829 / 834 |
| The KB v0.1 step system prompt (40-character name) | 14,138 characters, 3,535 tokens (pinned at ≤ 3,889, the measured size + 10%) |
| The KB v0.1 frame system prompt (40-character name) | 10,983 characters, 2,746 tokens (pinned at ≤ 3,021) |

**The 400 KB worst case** (row 5; `session.kb1.test.js`): 10 steps, 5 items each with every field at its maximum length (a 1,024-character url, a 253-character host, a 300-character title, 2 × 600 highlights), every exchange at the longest B1 allows (observation, direction and frame question 500; a reply 1,200; 12 + 6 + 1 findings a step, its 12 retrieval findings citing one item), the frame, `lastStep` with a 400-character query, a confirm with two methods and a close — serialized, measured in UTF-8 bytes:

| Case | Bytes | Pin |
|---|---|---|
| Every field at its maximum length, ASCII | **197,111** | under 400,000 |
| Every text character a 3-byte one, urls ASCII | **392,551** | under 400,000 (margin 7,449) |
| 3-byte text AND a 3-byte url path behind a short host — the byte worst case (review REC-2, TST-1: `isSourceUrl` takes a raw non-ASCII path) | about **480,000** (481,101 with a 4-character host) | **over 400 KB**, under 1 MiB (the database's limit); **FQ-5** |

The letter's "every field at its maximum" holds under 400 KB in length units; in bytes the true worst case does not. No runtime cap was added (a byte cap on urls would change B1's retrieval adapter, beyond this build).

## 6. Tests, the mutation check and the review

### Part 7's rows, where each is

| # | Row | Where |
|---|---|---|
| 1 | Selection | `method.test.js` "selectMethod (row 1)"; the route's "row 1"; the real loader with the shipped list: `method.test.js` and `shared-research.route.test.js:249` |
| 2 | Audience against the mode | the route's "row 2" (mode `on`; the frame and every step on the baseline, each recorded; `inAudienceFor` gets the gate's uid at the frame AND at every step — a listed uid planted in the body never reaches it) |
| 3 | Per-turn method | the route's "row 3" (revocation → baseline + `methodChange`; restored → KB + a change with no reason; the stamp unchanged; a baseline stamp never upgraded; a retried framing keeps its stamp; every call record names its method, failures included); `session.kb1.test.js` |
| 4 | Finding → turn | the route's "row 4" (`findingIds` in order; `methodsUsed` across two methods; the version is the builder's output for its input, the confirm's id unchanged, the builder's input key set unchanged) |
| 5 | Retention | the route's "row 5" (every shown item; the hash recomputes; a trimmed item absent; a stray-ticker title kept raw while the prompt shows it masked; undated → null and " · undated"; no block without a retrieval or after a failed one); `session.kb1.test.js` (the size pins) |
| 6 | Baseline unchanged | `kbMethod.checks.test.js` "row 6" (both builders equal `main`'s fixture for three names, method omitted, null or BASELINE; none of the three checks runs on a baseline turn); the route's "row 6 at the route" (what the route SENDS equals `main`'s) |
| 7 | KB block | `kbMethod.checks.test.js` "row 7" (header, rules, verbatim text; the size pins) |
| 8 | The three checks | `kbMethod.checks.test.js` "row 8" (every refusal and pass row of Part 5, and the review's) |
| 9 | The client answer | the route's "row 9" (no method field in any answer; every answer's keys equal `main`'s); `session.kb1.test.js` |
| 10 | Provenance | `method.test.js` and the route's "row 10" (a loader answer carrying source, review, acceptance and exporter blocks and drive paths: none reaches a session, record, log or answer) |
| 11 | Ownership | the route's "row 11" (another uid: `session_not_found`, no record read; the import scan, transitive, from every Shared Research module and the route) |
| 12 | KB-0's moved rows | `boundary.test.js:369`, `loader.test.js:651` |

### The runs (Linux, a WSL worktree of `~/pd-ci`, Node 20.20.2, `TZ=UTC`; each exit code asserted, the result line read directly)

| # | Command | At | Exit | Result line |
|---|---|---|---|---|
| 1 | `npx vitest run api/_utils/sharedResearch api/forge/shared-research.route.test.js api/forge/shared-research.kb1.route.test.js api/_utils/kb api/_utils/hypothesisRecords` | `15f0aae5` | 0 | `Test Files  40 passed (40)` · `Tests  1171 passed (1171)` |
| 1 | `flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` (the full suite) | `15f0aae5` | **1** | `Test Files  1 failed \| 1468 passed \| 11 skipped (1480)` · `Tests  1 failed \| 32894 passed \| 131 skipped (33026)` — the one failure is `CompeteTab.rankLabel.jsdom.test.jsx`, which fails the same way run alone at `main` `c85f7b41` (§8) |
| 2 | `npm run test:rules` (the emulator, Java 21) | `589325a2` (the later commits change only the KB promise check and test files outside the rules config) | 0 | `Test Files  42 passed (42)` · `Tests  784 passed (784)` |
| 3 | `npm run lint:gate` | `15f0aae5`, and again at the pushed head | 0 | clean |
| 4 | `npx vite build`; `dist/` compared file by file (SHA-256) with a build of `main` `c85f7b41` in its own worktree with its own install | `15f0aae5`, and again at the pushed head | 0 | **111 of 111 files byte-identical**, the CSS included (so no Tailwind class was minted from the new server files) |

Earlier runs, kept for the record: at `b78519ec` (before the review) the full suite had the same single `main` failure (`1468 passed`, 32,828 tests); at `11e080a7`, `lint:gate` 0, the rules suite 784/784 and `dist/` 111/111 identical; the battery 29 of 29 there, 46 of 46 at `8598c2d7` and at `589325a2`, 49 of 49 at `186b069e`, where the full suite had `1468 passed` (32,890 tests) with the same single failure.

### The mutation battery

It runs in its own WSL worktree (`pd-kb1-mut`), never in the working tree. Each mutant is one or more exact anchors that must match once (a stale anchor prints `BROKEN` and is not run). Each runs its named test files with a JSON report; KILLED means a non-zero exit with failed rows. Each file is restored from `git show HEAD:<path>` and the tree checked clean after every mutant. The defined ids are diffed against the ids run.

**Result at `15f0aae5`: 49 defined, 49 run, 49 killed, every file restored** (the control run of the same files: exit 0, 227 tests, 0 failed).

| Mutant | What it does | Verdict | Killed by (first failing row; failed rows) |
|---|---|---|---|
| M01 | selectMethod gives the KB method to a story entry | KILLED | shared-research.kb1.route.test.js › a story: the baseline by rule — no fallbackReason, no consumer, the loader never asked, even when it would answer ok (7) |
| M02 | effectiveMethodFor upgrades a baseline stamp | KILLED | shared-research.kb1.route.test.js › a story: the baseline by rule — no fallbackReason, no consumer, the loader never asked, even when it would answer ok (6) |
| M03a | the audience function takes a body uid (the frame's selection) | KILLED | shared-research.kb1.route.test.js › mode on, a player off the method's list: the frame and every step run on the baseline, each recorded — the uid is the gate's, never a body field (2) |
| M03b | the audience function takes a body uid (the step's re-check) | KILLED | shared-research.kb1.route.test.js › every step re-checks the audience for the gate's uid: the player taken off the list, a listed uid planted in the step's body → the baseline, audience (1) |
| M04 | methodChange is never written | KILLED | shared-research.kb1.route.test.js › every step re-checks the audience for the gate's uid: the player taken off the list, a listed uid planted in the step's body → the baseline, audience (2) |
| M05 | findingIds is omitted | KILLED | shared-research.kb1.route.test.js › every finding a step appends is in its exchange's findingIds, in order (3) |
| M06 | retrieval.items keeps only cited items | KILLED | shared-research.kb1.route.test.js › every item shown, as shown, in order; the hash recomputes; trimmed items absent; an undated item null with its finding " · undated" (5) |
| M07 | seenSha256 is computed over the title only | KILLED | shared-research.kb1.route.test.js › every item shown, as shown, in order; the hash recomputes; trimmed items absent; an undated item null with its finding " · undated" (2) |
| M08a | method_as_source removed | KILLED | kbMethod.checks.test.js › method_as_source does not run on a baseline turn either (an injected kb-sourced finding) (2) |
| M08b | method_example_as_fact removed | KILLED | kbMethod.checks.test.js › a baseline turn with a citation "(M1)" passes as today (the KB checks do not run) (27) |
| M08c | service_promise removed | KILLED | shared-research.kb1.route.test.js › no answer — frame, open, step, a failed step, a replay, GET, the list, adopt — carries a method field, and no exchange carries a retrieval (38) |
| M09a | method_as_source applied to baseline turns | KILLED | kbMethod.checks.test.js › method_as_source does not run on a baseline turn either (an injected kb-sourced finding) (1) |
| M09b | method_example_as_fact applied to baseline turns (the v0.1 markers on every turn) | KILLED | kbMethod.checks.test.js › a baseline turn with a citation "(M1)" passes as today (the KB checks do not run) (2) |
| M09c | service_promise applied to baseline turns | KILLED | kbMethod.checks.test.js › a baseline turn with a service name passes as today (the KB checks do not run) (2) |
| M10 | the opening's next action cites METHOD_SOURCE for an observation entry on a KB method | KILLED | shared-research.kb1.route.test.js › frame and steps carry their method; a revocation gives the next step the baseline and a methodChange; restored, the KB method and a change with no reason; the stamp never moves (2) |
| M11 | methodsUsed is empty | KILLED | shared-research.kb1.route.test.js › adoption: the confirm exchange holds methodsUsed — the distinct methods of the kept findings; the idea version is exactly the builder's output (2) |
| M12a | sessionViewOf passes an exchange's method through | KILLED | shared-research.kb1.route.test.js › no answer — frame, open, step, a failed step, a replay, GET, the list, adopt — carries a method field, and no exchange carries a retrieval (3) |
| M12b | sessionViewOf passes the session's stamp through | KILLED | shared-research.kb1.route.test.js › no answer — frame, open, step, a failed step, a replay, GET, the list, adopt — carries a method field, and no exchange carries a retrieval (4) |
| X01 | the step's next action cites the baseline whatever the method | KILLED | shared-research.kb1.route.test.js › frame and steps carry their method; a revocation gives the next step the baseline and a methodChange; restored, the KB method and a change with no reason; the stamp never moves (2) |
| X02 | the frame runs on the fresh selection, not the session's stamp | KILLED | shared-research.kb1.route.test.js › a retried framing keeps its first stamp: a baseline stamp is not upgraded by the retry's selection (2) |
| X03 | the completed step's shadow record carries the baseline whatever the method | KILLED | shared-research.kb1.route.test.js › frame and steps carry their method; a revocation gives the next step the baseline and a methodChange; restored, the KB method and a change with no reason; the stamp never moves (1) |
| X04 | retention keeps the provider's raw items, not the items shown | KILLED | shared-research.kb1.route.test.js › every item shown, as shown, in order; the hash recomputes; trimmed items absent; an undated item null with its finding " · undated" (1) |
| X05 | citedSourceOf falls back to the baseline when the KB method no longer loads | KILLED | shared-research.kb1.route.test.js › revoked between the frame and the open: the opening's next action still cites the KB method the frame ran on (labelled by its id) (2) |
| X06 | the numeral guard on "I" removed | KILLED | kbMethod.checks.test.js › pass: Phase I will be tested in 2027. (4) |
| X07 | the KB header's date read in UTC | KILLED | kbMethod.checks.test.js › the header: id, version, title, the acceptance's calendar date, the first 8 hex of the hash (1) |
| X08 | the KB method spreads the loader's answer (provenance rides along) | KILLED | method.test.js › own words → the KB method when the loader answers ok, stamped kb, no fallbackReason (3) |
| X09 | a baseline system prompt takes the method's own text, not METHOD.text (a byte drift) | KILLED | kbMethod.checks.test.js › both system prompts, partner Rook, equal main's byte for byte — with no method given and with the baseline (3) |
| X11 | method.js imports verifyPackage from the loader | KILLED | boundary.test.js › outside api/_utils/kb/ and scripts/kb/: only Shared Research method.js imports it, the authorized entry points only, and only Shared Research and forge tests mock its loader or audience (KB-1 moved this row) (1) |
| X12 | a second Shared Research module imports the loader | KILLED | boundary.test.js › outside api/_utils/kb/ and scripts/kb/: only Shared Research method.js imports it, the authorized entry points only, and only Shared Research and forge tests mock its loader or audience (KB-1 moved this row) (1) |
| X13 | a recorded baseline is read as the current baseline (review SEL-4) | KILLED | session.kb1.test.js › a recorded baseline is read as recorded, its hash included (review SEL-4) (1) |
| X14 | effectiveMethodFor reads its request outside the try (review SEL-7) | KILLED | method.test.js › never throws: a throwing loader, a broken answer → the baseline, corrupt (4) |
| X15 | the promise check reads the name-tokenized sentence, as B1 does (review CHK-1) | KILLED | kbMethod.checks.test.js › refusal in the partner by name (8) |
| X16 | an abbreviation ends the example check sentence (review CHK-3) | KILLED | kbMethod.checks.test.js › refusal in the reply (3) |
| X17 | the bracketed group takes no dash, hyphen or or (review CHK-4) | KILLED | kbMethod.checks.test.js › a bracketed group with (M1, V1, and T2) (CHK-4) (5) |
| X18 | no words between will and the verb (review CHK-5) | KILLED | kbMethod.checks.test.js › refusal in the idea (16) |
| X19 | methodsUsed in reverse turn order (review REC-4) | KILLED | session.kb1.test.js › the distinct methods of the turns whose findingIds hold a kept finding, first seen in the order the turns ran (never the kept findings' order — review REC-4); open's findings contribute none (1) |
| X22 | the example exemption drops its date condition (review TST-3) | KILLED | kbMethod.checks.test.js › the exemption needs BOTH: a retrieved NVDA finding on another date exempts nothing; a retrieved October 30 finding about another company exempts nothing (review TST-3, TST-4) (2) |
| X23 | the example exemption drops its name condition (review TST-4) | KILLED | kbMethod.checks.test.js › the exemption needs BOTH: a retrieved NVDA finding on another date exempts nothing; a retrieved October 30 finding about another company exempts nothing (review TST-3, TST-4) (1) |
| X24 | an undated item's read day counts as the example's date (review TST-4) | KILLED | kbMethod.checks.test.js › an undated item's read day is no date: an NVDA finding from an undated item read on October 30 exempts nothing (review TST-4) (1) |
| X25 | service_promise reads the reply only (review TST-5) | KILLED | kbMethod.checks.test.js › refusal in the summary (6) |
| X26 | a refusal on an unchanged method writes a methodChange (review TST-6) | KILLED | session.kb1.test.js › the same method as the previous partner turn → null — a refusal on an unchanged method too (two revoked steps in a row: review TST-6) (1) |
| X27 | methodsUsed over every record finding, not the kept ones (review TST-7) | KILLED | shared-research.kb1.route.test.js › a KB step writes Eaton, a revoked (baseline) step writes GE Vernova; adopting GE Vernova records the baseline only — the kept findings' turns, never the stamp or the whole record (1) |
| X28 | a failed step's call record carries the baseline whatever the method (review TST-8) | KILLED | shared-research.kb1.route.test.js › no answer — frame, open, step, a failed step, a replay, GET, the list, adopt — carries a method field, and no exchange carries a retrieval (1) |
| X29 | the route sends a step system prompt one space longer (review TST-9) | KILLED | shared-research.kb1.route.test.js › a story: the baseline by rule — no fallbackReason, no consumer, the loader never asked, even when it would answer ok (3) |
| X30 | the step answer gains a method field (review TST-10) | KILLED | shared-research.kb1.route.test.js › every answer's keys equal main's — frame, open, step, replay, a failed step, the list, GET, adopt, close (review TST-10) (1) |
| X31 | the route loads a Practice Field module (review TST-11) | KILLED | shared-research.kb1.route.test.js › no Shared Research module reaches an agent-memory, learning, Film Room card or Practice Field store, through any chain of imports (1) |
| X32 | the frame's persist_failed call record drops its method (review TST-8) | KILLED | shared-research.kb1.route.test.js › a KB frame whose write fails (persist_failed), and a KB step whose prompt is over the cap (prompt_too_large): each record names the KB method (1) |
| X33 | the step's prompt_too_large call record drops its method (review TST-8) | KILLED | shared-research.kb1.route.test.js › a KB frame whose write fails (persist_failed), and a KB step whose prompt is over the cap (prompt_too_large): each record names the KB method (1) |
| X34 | the frame's model-failure call record drops its method (review TST-8) | KILLED | shared-research.kb1.route.test.js › the letter: a KB stamp whose FIRST turn falls back (a retried framing after the entry is removed) records the baseline it ran on, with no methodChange — there is no previous partner turn (review SEL-1: founder question FQ-2) (1) |

### The review (BUILD_RULES §2)

Five lenses, five refuters, each on its own `git archive` snapshot: `docs/audits/20261114_KB1_SHARED_RESEARCH_METHOD_REVIEW.md`. 54 findings: **35 CONFIRMED · 14 PARTLY · 5 REFUTED**. Three were must-fix before refutation (CHK-1, TST-1, TST-3; TST-9 and TST-10's close half raised to must-fix by the refuter): all fixed. Every confirmed finding with a remedy inside the letter is fixed, with a row and a mutant; where a fix went beyond the letter (SEL-1, SEL-3, REC-6, and three check tightenings) it was built, refuted as beyond the letter, reverted, and asked (§1, FQ-1 to FQ-11).

## 7. The founder's smoke step

On this PR's Vercel preview, one request — signed out is enough:

```
GET https://<this PR's preview>/api/forge/shared-research
```

must answer **`404 {"error":"disabled"}`**, not a 500. The route now loads `method.js`, which loads the KB loader, which loads the package's three JSON files through `import … with { type: 'json' }`. The `404` proves the server bundle carries and parses them (KB-0 could not prove it: nothing loaded the module). The same import form already runs in production (`api/cron/agent-evaluate.js` reaches `stockThresholdPolicyRegistry.js`).

## 8. Found outside the task (reported, not fixed)

- **A `src/` test failing here, on `main` too.** `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx` › "absent (every caller but the shell)…" fails on this branch in every Linux full-suite run, and fails the same way when run alone at `main` `c85f7b41` in the same WSL setup (3 of 3 here, 2 of 2 on `main`); the full suite was not run at `main`. This build changes no file under `src/`. The GitHub Tests workflow passed on two recent PR heads that carry this test (2026-11-13 22:46 UTC and 2026-11-14 00:01 UTC), so the failure may depend on the date or time it runs (the row compares rendered markup with a golden written from `main`'s CompeteTab) — and if it does, this PR's CI may show it red for that reason alone. Worth a separate task.
- **B1: a partner named "Will" switches off the forbidden-pattern subjects.** B1's `forbiddenIn` swaps the partner's name into the sentence case-insensitively (`withPartnerToken`), so with a partner named "Will" "We will buy NVDA." passes `will_do`; the name is also not normalized like the text. Agent names are free text. KB-1's own check no longer uses the swap (R13); B1's is untouched (Rule 4 keeps baseline turns exactly B1's).
- **B1: failed direction steps grow the session.** `beginStep` appends a direction step's player exchange before the call and a failed step keeps it; `stepsUsed` moves only on success and nothing expires a session, so up to 30 failed calls a day can each leave a 500-character exchange, every day. The 400 KB case is 10 steps by the prompt's letter.
- **B1: a title-less item takes its host as its title with no 300 cap** (`retrieval.js` `itemsOf`); an IDN host's punycode can exceed 253 characters.
- **The owner can read the retained text.** The session document is owner-readable (`firestore.rules`, as the amendment states); the retained titles and highlights — the provider's text — are now readable to their owner through the client SDK. No client code reads it.
- **Cost.** A session document now carries the retained text (about 1.2 KB an item in practice); `list=open` and every step's transactions read it whole.

## 9. Next

1. The founder's review and merge of this PR (dark: nothing changes for anyone).
2. The smoke step (§7) on the preview.
3. Rulings on FQ-1 to FQ-11 — best before activation, since each moves a pinned row.
4. Amendment A §A6 step 4 (B1's own: rules and index deployed, `SHARED_RESEARCH_MODE` to `allowlist`), then **step 5, the founder's activation PR**: one entry in `KB_APP_USE`, its pin in `packages.test.js` (the one KB-0 row that moves with it — `loader.test.js`'s row now follows the list), and its `docs/approvals/` record, after the allowlist run.
