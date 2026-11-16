# Astra review — Film Room C2, the moment excerpt

**DO NOT MERGE.** Four reproduced findings breach criteria 15, 16 or 17 at `c8f9adb20d418a92ce81c93929c46485101daa6e`. The five Amendment D changes are expected fix-round work and are **not** findings against this head.

Date: 2026-11-16. PR: [#1074](https://github.com/fashraf94/TradeSeven/pull/1074), `claude/film-room-c2-excerpt`. Base inspected: `71bc6bde7c0553cdb16e5c5f3752d248968967c3`. Code head: `e7804bfb`; merged head: `af2fddd1`; review head: `c8f9adb2`. Source locations below refer to the review head. This report and its evidence are outside the checkout. No product fix was made.

Scope is the user's seventeen exit criteria, the Build C spec and Amendments A–C, the supplied Amendment D, the cited Practice Field contracts, and the accepted C1 review/confirmation. The absent drafting importer, absent v1 recurrences, and Amendment D's thirteen confirmations are not objections. No production data, production service, refresh, backfill, deployment, PR comment, commit, push or merge was used.

## 1. Findings

### C2-F1 — IDs in source text pass straight into the prompt-bound half

**P1; criterion 17.** Locations: `src/utils/filmRoomSubject.js:47`; `api/_utils/filmRoom/momentExcerpt.js:171`, `:188`, `:312`, `:358`; detector at `api/_utils/filmRoom/momentExcerpt.golden.test.js:301`.

`boundedText` checks type and code-point length. It does not reject IDs. The producer wraps the accepted string in a quotation and returns it under `excerpt`. Keeping IDs out of the named identity fields and placing them in `refs` does not protect free text.

**Reproduction.** Using the real excerpt exports and a Sep 23 fixture produced through the real tape passes, plant `Recorded <id> here.` separately in the note, rationale hypothesis, rationale text, directive player text, directive canonical text, idea statement and meeting diagnosis. Repeat for battle, user, agent, clone, entry, watchlist, nomination, book, Firestore auto-ID and UUID examples. **70/70 source-to-output cases carry the planted ID in `excerpt`.** CD-16 removes the ten meeting cases; sixty remain. CD-14 removes the duplicate note location, but its ID remains in `inputQuote`.

This is not confined to corrupt server records. The actual card request's `normalizeNote` accepts all ten planted note strings. Rebuilding the tape from a battle chat exchange with `userMessage: 'Refer to Ab3dEf7hIj9kLm1nOp5q'` produces that exact string in `excerpt.directive.playerText`, correctly labelled `player`. IDs also survive synthetic mutations of recorded route/reason/mechanism/symbol/situation fields. The fixed labels `b1`, `i1`, `c1` themselves remain safe, and loose time strings do not directly carry their embedded ID as quotation timestamps.

**Why the existing guard does not refute this.** Its clean golden passes; its planted-output tests demonstrate that the detector recognizes bad output. They do not make the producer reject bad source text. The executor report's statement that the owner's note carries IDs “by design” is not an exception to the user's literal criterion 17 or shared contract V2 §5.1. Ownership does not remove this criterion.

**Fix proposed, not made.** Apply a shared prompt-bound text/structured-field policy at projection time. Omit a whole quotation that contains a forbidden identity; do not redact or rewrite the words, which would conflict with BC-1. Validate recorded enum/ticker/label fields against their declared domains. Pin source-to-live-output negative cases for all identity kinds and text locations, with legitimate prose controls. Known-ID comparison alone will not cover arbitrary IDs pasted by a player; the implementation must state and test the supported identity-shape policy. Keep screen/excerpt projection consistent.

Evidence: `runtime-probes.mjs` and `runtime-probes.json`, keys `ids`, `validatedNotes`, `realWriterDirective`, `recordedIdFields`, `symbolId`, `situationId`.

### C2-F2 — A valid regex literal hides a real forbidden import from the new census

**P1; criterion 16.** Locations: `api/_utils/filmRoom/__fixtures__/jsSource.js:23`, `:66`, `:85`, `:111`; consumer `api/_utils/filmRoom/oneDoor.census.test.js:257`.

The lexer decides whether `/` begins a regex from the preceding significant character or keyword. After the closing parenthesis of an `if` condition it treats the slash as division. The `/*` inside the regex character class then becomes a supposed block comment and consumes the following import.

**Reproduction.** Append this valid module code, with a correctly resolved relative specifier, to a model root:

```js
if (true) /[/*]/.test('x');
import { excerptOf as astraExcerptProbe } from './relative/path/to/momentExcerpt.js';
```

Babel parses the complete modified module and sees the static import. Append it independently to each of the **20 current roots**, retaining all original code and imports. **20/20** produce `oneDoorDefectsOf(...) === []`; the new import extractor misses the edge in every case. Main's former extractor sees this particular planted edge. Because this is an appended suffix, the existing known-reach pins remain satisfied.

The untouched head does not currently have a forbidden model-to-excerpt edge: an independent AST walk agrees with its nine current path closures. This finding is the specifically requested adversarial proof that a real forbidden import can evade the C2 enforcement gate, not a claim that production currently sends excerpts through those roots.

**Fix proposed, not made.** Use a parser-backed import extractor, or a lexer that tracks the syntactic context needed to distinguish regex literals after control-statement parentheses. Preserve all roots, direct-edge restrictions, whole-closure ledger checks and reach pins. Add this live-root suffix attack, regex after other control statements, static/dynamic/helper routes and both import orders. Do not “fix” the failure by exempting a path or reducing its closure.

Evidence: `census-probes.mjs/json`, `syntax.regexTrap` and all twenty `planted` rows. The proof invokes the actual exported census rule with an injected read function; it does not edit product files.

### C2-F3 — Loose or impossible times still manufacture temporal excerpt facts

**P2; criterion 15.** Locations: `api/_utils/filmRoom/momentExcerpt.js:278`, with similar loose comparisons at `:192` and `:251`; `src/utils/filmRoomSubject.js:43`.

`afterExitOf` parses `row.at` directly with `Date.parse`, bypassing the shared strict-instant check. It can therefore assert which bars occurred after an exit for which no strict exit instant was recorded. The shared helper itself checks an ISO-looking shape plus `Date.parse`, which normalizes impossible calendar dates.

**Reproduction.** Set the matched ETN exit's `at` to `2026-09-23`. `instantText` returns null, yet `afterExit` is present and reports **39** bars after the fabricated midnight boundary (the normal fixture reports five). `2026-09-23T19:00:00`, with no timezone, also yields `afterExit` under UTC. A loose `9/23/2026 19:00 (Ab3dEf7hIj9kLm1nOp5q)` does likewise. Separately, `instantText('2026-02-30T15:00:00Z')` and April 31 both return the impossible date string; the rationale quotation can carry that invalid instant in `at`.

The sale's recorded `tickSeq` can establish the R6 check boundary; it cannot supply the missing intraday instant needed to compare series bars. The request and report §6.3 explicitly require absence for fields dependent on a loose time. The direct timestamp ID attack was fixed; the temporal inference remains.

**Fix proposed, not made.** Use a calendar-validating strict instant parser before every temporal comparison, including exit/bar comparison and timestamp tie-breaks. Preserve `at: null` where quotation words exist without a valid time; omit facts whose temporal relationship cannot be established. Add date-only, timezone-less, impossible-date, offset and valid-instant controls. Keep the valid R6 tick boundary independent of optional temporal detail.

Evidence: `runtime-probes.json`, `times` and `strictInstants`.

### C2-F4 — Unresolved conflicting ties silently select array order

**P2; criterion 15.** Locations: `api/_utils/filmRoom/momentExcerpt.js:177`, `:192`, `:251`, `:285`, `:301`, `:307`.

The implementation returns a selected fact when its source identity/tie rule does not identify a unique value. Reversing the same stored rows changes the answer. This is the user's explicit criterion-15 test—absence when two rows tie in a way the report does not rule—not a new exit criterion.

**Reproduction.** Clone the selected row, keep all selection keys equal, change its payload, then reverse the array:

| Source ambiguity | Result before / after reversal |
|---|---|
| Two rationale rows at the same nearest `tickSeq` | `first row` / `second row` |
| Two directives with identical earliest heard check **and** filing instant | `first player row` / `second player row` |
| Two matched sales with identical tick and instant | exit price `100` / `999` |
| Two final tag items with equal situation, symbol, version and tick | derived count `7` / `999` |
| Two checks at the final tick with conflicting recorded stagnation | recorded count `3` / `999` |
| Two series bars at the same latest start time | close `385.7` / `999`; duplicate also increases `barsAfter` |

All six return a non-absent answer. CD-7 resolves earliest heard directive selection; it does not resolve a complete tie after the implementation's filing-time tie-break. Meeting and idea ties are excluded from this finding because CD-16/CD-8 remove them.

**Fix proposed, not made.** Detect conflicting candidates at the selected key and omit the affected fact and dependent facts when the tie remains unresolved. Do not add array order as an undocumented tie rule. Test permutations, complete conflicts, resolved earlier/later controls, and an explicit policy for identical duplicates. Counts must remain tied to the last check, never fall back to a neighbour.

Evidence: `runtime-probes.json`, `ties`. These are synthetic ambiguous records admitted by the reader; I did not establish that current normal writers emit them. The requested reader-side absence guarantee nevertheless fails.

## 2. Truth, speakers and ownership

### Field-by-field source audit

The following covers every row in the executor report's §6.3. “Server-written” refers to storage authority; it does not turn player-authored text into platform speech.

| Field | Actual source and attack result | Authority |
|---|---|---|
| `excerptVersion`, `battle` | Constant version and local `b1` label. No database identity enters these fields. | Code |
| `symbol`, `situationId` | Exact moment assembled from stored tags by the shared day judge. Missing/changed moment refuses the excerpt. Raw text domains remain F1. | Server-written tape/tagger |
| `situationVersion` | First matching stored tag item's version, classed through its actual `numberClasses` path. No declaration means absent. | Server-written tape |
| `from`, `to` | First/last tagged check times; normal loose strings omitted. Impossible calendar dates remain F3. | Server-written checks/tags |
| `checks` | Tagged-check count derived by `momentsOf`; not a neighbouring check's counter. | Derived from tape |
| `sector` | Current ticker directory mapping; unknown symbol gives none. Head uses sector code; CD-3's name change is expected. | Static directory |
| `idea.label/version/statement` | Head selects the day's one distinct call reference, reads its exact version, checks `userId`, list and version, and uses its creation instant. Missing version/statement drops the statement; foreign version drops the head's idea. Missing number declaration drops the version number. CD-8 replaces this source. | Calls and immutable version records are server-written; statement is the player's words |
| `rationale.hypothesis/rationale` | Matching/nearest earlier sequence, no no-sequence fallback; missing individual text is absent. Agent text remains separate. IDs, impossible time and complete ties are F1/F3/F4. | Tape from battle evaluations; evaluations are not in the client update allowlist |
| `directive.playerText/canonicalText` | Heard inside the moment, earliest heard then filing-time tie-break. Two separate quotations: `player` and `platform`, each at filing time. Missing text/rows are absent. IDs and complete ties remain. | Tape from server-written `chatExchanges` and heard records; player message remains player-authored |
| `meeting.outcome/legs/diagnosis` | Enclosing lifetime; earliest candidate; deadline bounds expired meetings. Missing components omitted. The diagnosis's platform attribution is unsafe for client-edited history, exactly the already-ruled CD-16 issue. | **Indirectly client-writable** through battle meeting fields; removed by CD-16 |
| `exit.*` | Sale of this symbol at last moment check or first actual later check; mechanism sentinel `unrecorded` omitted. Each missing component omitted. No invented purchase on a cash exit. | Server ticks/trades/receipts through `buildActions`; not client `battleLedger` |
| `afterExit.*` | Own sold-symbol series; latest qualifying bar's close and start, document's class; number of qualifying bars derived. Missing/foreign series, no bars or missing class yields none. F3/F4 qualify time and ambiguity guarantees. | Server-written series/candle pass |
| `count` | Recorded basis reads only the final check's `stagnation[symbol].ticks`; recomputed basis reads only that final tag item's count. Deleting that source gives none despite a neighbour's value. Missing class gives none. Equal-key conflicts remain F4. | Server checks/tagger |
| `card.label/question/route/filed` | Local `c1`; exact menu question/version; route projection (`drill` to `offer`); card creation instant. Missing question/route/filed source omitted. | Server card builder and static menu; route is validated player choice |
| `card.note`, `inputQuote` | Exactly the card note, quoted `player` at creation, never joined to rationale/directive. The duplicate location is CD-14's expected removal. Text IDs remain F1. | Server card record of player's submitted words |

The independent runtime probes include **34 source/class absence cases**, all passing after using the version record's actual ownership field (`userId`). They also exercise all seven quotation locations at the exact code-point bound and one above it using astral characters: **14/14** correct, with over-limit text absent and no truncation. Bounds are note/statement 280; hypothesis/rationale 500; directive texts/diagnosis 400. Existing live golden tests cover missing declarations and document-specific classes; the independent class deletions agree. Series close and bar start use the series class, not an invented tape class. `barsAfter` and `checks` are derived.

Independent exit controls: sale at final tick 19 and first later check 20 is carried; tick 21 and absent/null `tickSeq` are not. Removing `symbolIn` produces a cash exit with no `bought`. Missing final recorded/recomputed count does not borrow a neighbouring count. `recurrences` remains absent as ruled.

### Storage authority and speakers

`firestore.rules:475` permits the owner to change only `executionMode`, `pendingProposal`, `battleLedger`, `updatedAt`, `strategyPreset`, `gameplanMeeting`, `gameplanMeetingHistory`, `dailyGrades`, `feedBookmarks`, and `reviewDecisions`. Of these, **only the meeting fields feed the excerpt facts under review**. The actions come from server ticks/trades/receipts (`tapeAssemble.js:496`), directive text from `chatExchanges` (`:645`), rationale from evaluations (`:745`), and meetings from history (`:873`). The other writable battle fields are not alternate excerpt sources.

The independent emulator tests allow the owner's meeting-history edit and deny the equivalent foreign-owner edit. They deny direct changes to owner, agent, context/carriage, evaluations, chat exchanges, trades, portfolio and activation time, including nested carriage writes. Tape, series, card ledger and hypothesis version writes are denied to clients. The full rules suite and reused C1 denial tests also pass. I found **no additional directly client-writable source** for the remaining excerpt fields.

Every current quotation location has the assigned single speaker. Directive player and canonical words are distinct objects; `inputQuote` contains only the player's card note. No concatenation of speakers was reproduced. The known platform-labelled meeting forgery is handled by CD-16, not counted again. Server persistence of a note, statement or chat message does not make its contents trusted instructions; Practice Field W-06's data-message wrapper, source budget and one-input quotation policy remain the future assembler's responsibility.

Mutating all `refs` values after construction leaves `excerpt` byte-identical. Projection reads no `refs` value. F1 is a free-text leak, not an alias from `refs`.

### Ownership, silence and read scope

Core missing/foreign tape, battle or card returns null. So do a different attribution agent, removed/moved source, unavailable tags, different archetype and changed situation version. The current clone tests exercise clone/parent shapes against the platform resolver: missing/foreign clone, unresolved or clone-shaped parent, invalid parent ID and missing/foreign parent refuse. The parent's ownership guard is present at `momentExcerpt.js:144`; no excerpt is answered under the clone ID itself.

Reads are bounded plain document gets: card when requested, tape day, battle, clone and parent only for clone attribution, exact idea version, and sold-symbol series only when an eligible exit requires it. The ordinary card fixture records exactly five gets and zero writes. There is no query, collection scan, model call or log in the excerpt path. Core read exceptions, including an ABORTED-shaped error, return null without exposing the error message.

Two advertised silence details need the backlog qualifications in §6: explicit null parameter objects throw before the function body; auxiliary version/series read failures produce a partial excerpt as the field contract allows. Those are not demonstrated foreign-owner answers and are not promoted into additional blocking criteria.

### CC-4: shared day judge and changing source

`sourceDay.js` retains route behavior for coverage, ownership, exact moment membership, version and archetype checks. Its refusal order matches main. I ran the prior C1 source/builder/refusal/gate probes: **25 selected cases pass** after adapting only the three old BG-1 expectations to the intentionally hardened terminal guard (see §7).

A separate probe drives both main and head with seventeen source scenarios, recording source/create/nominate results and transaction reads, plus six ordinary/string/numeric ABORTED cases. The **23 result rows are byte-identical** between the trees: status, code, message, extras, refusal precedence, exception identity and read sets. The route still reads the source inside its mutation transaction. No criterion-8/12 regression was reproduced.

The excerpt is deliberately outside a transaction. Yes, it can return a mixed answer: after the tape's get, the synthetic read hook removes its tags and changes the supplementary version response; the result still contains the earlier moment plus the later statement. That probe demonstrates lack of a common snapshot, not an authorized client edit of immutable versions. A tape/candle update can likewise occur between ordinary gets. The exporter must not be treated as a commit-time eligibility receipt. W-05 already requires selection and pre-commit rechecks in T2; no new transaction requirement is imposed on C2 here.

## 3. Census and write gate

The abstract rule is correct once the graph is correctly extracted. `NAMED_EXCEPTIONS` admits only `drafting`, and only the direct `api/_utils/practiceField/draftingPrompt.js` → `momentExcerpt.js` edge. Ledger modules are checked on the whole closure, even for drafting. Other paths, including `mandate`, receive no skipped edge and may reach neither the excerpt nor its importer nor ledger/plays. The synthetic static/dynamic/helper and both-import-order tests pass. F2 compromises the graph extraction underneath that otherwise correct rule.

Independent AST comparison of the untouched trees:

| Path | Main's former walk | Head's lexer walk | Head's independent AST walk |
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

Only `src/config/huddleFlags.js` is newly visible in evaluator reach. No current verdict changes; no missed or spurious edge appears in these head closures relative to AST. The alias resolver correctly follows `@/` to `src/` in real walks. Backtick static dynamic imports and indented bare imports improve over main. Strings/templates containing import-shaped text still cause false positives; same-line bare imports and dynamic imports with a second options argument remain pre-existing misses (§6). The new regex-after-`if` miss is the blocking regression.

Synthetic lexer load at approximately 10 KB, 100 KB and 1 MB took 0.18 ms, 1.27 ms and 18.74 ms respectively in this run. This is a small workload measurement, not an exhaustive complexity guarantee. No performance blocker was observed.

The latent importer assertions hold today. Executor §6.6 is a sound integration recipe: add/pin the real drafting roots and reach, change only the latent assertions that cease to be true, keep the exception table unchanged, require exactly the named importer, and register the assembler and excerpt input with the Mandate honesty registry. Excluding **only drafting** from “no existing path is admitted” is necessary once it exists; excluding other paths or weakening whole-closure ledger checks is not licensed. CD-18's non-root drain remains accepted.

**Write gate:** independent AST reach finds the same **13 modules** as the closure pin. A second AST inspection of calls, including computed string properties, finds only the two write-shaped methods: `present.add(evalIds[i])` at `api/_utils/filmTape/tapeSources.js:95` is a local Set; `groups.set(key, [])` at `src/utils/filmRoomMoments.js:45` is a local Map. Their declarations and use agree with the pinned explanations. There is no Firestore write call in the actual closure and no runtime write in the excerpt probes. This is a conclusion about the current source, not proof that a lexical guard catches every possible future JavaScript spelling; F2 also needs fixing wherever the lexer supports a guard.

## 4. Screen and cards-off path

The subject read is gated by cards mode at `FilmRoomScreenV2.jsx:254`, and the form/receipt receive it only on that path. The receipt verifies its own battle/day before rendering the subject (`FilmRoomCardRegions.jsx:549`). The shared `filmRoomSubject` projection supplies both excerpt and screen semantics, including the 60-code-point statement display cut and omission of a statement over the full 280 bound. Existing screen-level tests drive the actual hand-off and bind displayed quotation bytes to the version read. These pass in the full suite. No arbitrary number/class, verdict/ranking, stage/result or unheld screen fact was reproduced.

Loading/error states suppress the subject line when a carried reference is awaiting/failed its read. **Denied differs from the request:** the code renders symbol/sector with no idea, e.g. `ETN · XLI`. The test explicitly expects that. This is recorded in §6 as a CD-10 contract mismatch, not turned into a new exit criterion; it does not expose the denied statement or change cards-off behavior.

The new exact version get uses the existing parent-list-owner rule at `firestore.rules:1221`. The collection-group rule grants `list`, not a bypassing direct `get`. Independent emulator cases cover owner, foreign owner, missing parent, misleading denormalized ownership and denied writes. Cards-off tests assert **zero version reads** and no line. No rules change was needed or made.

CC-8's chain and stage vocabulary use “adopted as your instruction”; the chain includes “Your agent doesn't act on your ideas yet.” The Since-last-time installed line still lacks that sentence, the expected CD-17 change. No “equipped” regression was found in the new stage/cap words.

CC-9 retire and park send `agentOfCard(entry)`, so a receipt opened from a clone's battle uses the card's ranked parent. The server still checks the named agent's ownership, entry owner, identity and source constraints; naming an arbitrary foreign agent does not bypass them. BG-1's `recordNamesEntry` check precedes accepted/withdrawable/terminal dispatch at `cardStore.js:619`. The older probe expectations that a mismatched terminal receipt succeeds are intentionally obsolete, not a refactor regression.

I freshly captured all **twelve** cards-off render goldens on main and head. Each is byte-identical to the other tree and the committed baseline; SHA-256 values are recorded in `golden-comparison.json`. Hub keys, cards mode `'allowlist'`, flags and untaped/off branches are unchanged. C2 introduces no declared cards-off exception beyond C1's two accepted rulings.

## 5. Amendment D — code rulings

| Ruling | Safe and complete? | What the change touches / must preserve | Test that pins it |
|---|---|---|---|
| **CD-3: sector name** | **Safe; complete as a semantic ruling.** | Change the shared directory projection to `STOCK_UNIVERSE[id].name`; no extra read. Do not preserve the old one-word filter: directory names can contain spaces. Unmapped symbol or unnamed code yields none. Subject/excerpt goldens intentionally change. | Industrials and a multiword sector name, unknown symbol, missing name; screen equals excerpt. |
| **CD-8: frozen battle idea** | **Safe direction; implementation needs the integration details below to be complete.** | Use the already-owned battle and its frozen watchlist/version/hash; no fallback to calls. Rebind provenance and client read key; preserve owner checks and statement absence. Do not import the write-capable carriage module into the read-only excerpt closure. | No calls with valid carriage; contradictory calls ignored; no carriage; missing/unread/foreign version; wrong list/version/hash; clone attribution; tournament with malicious carriage options; screen/excerpt equality and cards-off zero reads. |
| **CD-14: single note location** | **Safe and complete.** | Remove `card.note`; retain exactly the original bounded player note as `inputQuote`, with its original time/speaker. Update shape, contract, golden and downstream consumers. No drafting importer exists to migrate yet. It does not fix F1. | Assert `card` has no `note`; note appears once as `inputQuote`; missing/over-bound/astral and ID policy cases. |
| **CD-16: no meeting** | **Safe and complete for removing this authority breach.** | Omit the entire `meeting` field regardless of history shape. Remove unused projection code or make its non-use explicit. Keep the owner screen's Meetings quotation as ruled. No rule deployment or writer/fence change is required. | Real tape writer supplied with forged owner-editable meeting history still yields no excerpt meeting; golden/shape pin; owner screen remains unchanged. |
| **CD-17: adopted sentence in digest** | **Safe and complete for the named surface.** | Use the same sentence as the installed chain in Since last time; keep other stages unchanged and preserve cards gating. | Render installed/adopted digest and chain and require the sentence in both; non-installed controls and all twelve cards-off goldens. |

**CD-8 authority confirmation.** `createAgentBattle` at `api/_utils/agentBattleService.js:217` constructs an explicit eleven-field `agentContext.equippedHypothesis` only when both hypothesis and equipped-watchlist snapshots exist and the battle is not a tournament. The ordinary deploy route passes the server-resolved carriage (`api/agent/decide.js:964`); its transaction rereads and checks the version/hash through the carriage and composition-generation fence. The tournament creation route supplies no such sibling (`:1554`), and the shared builder suppresses it even if passed. Current mode configuration has tiered agent play and flat tournament play; clone attribution does not provide a client write path. Clients cannot create a battle or update `agentContext`. Existing carriage tests cover absent options, absent watchlist and tournament suppression as well as the exact sibling keys. Thus the carriage is server-written for current battle kinds that carry it, and absent on current tournament creation paths. This establishes code behavior, not an audit of historical production documents.

**CD-8 completeness details for the fix round:**

1. `ownedDayOf` already reads the battle but currently discards it. Return the owned battle internally, and feed the same frozen-carriage projection to the excerpt and screen. Do not add another battle lookup or re-derive identity from the current agent/list.
2. The head classes the idea version through `calls[i].hypothesisRef.hypothesisVersion`; the screen's number binding is tied to that path too. Replacing only the reference lookup leaves false provenance or a missing version. Give the frozen version an explicit truthful recorded provenance and update both number bindings and their tests; do not fabricate a call path.
3. Check the version document against the carriage's list, version, owner and content hash. Implement D's explicit missing/unread/**foreign** version behavior as idea-without-statement. The head currently omits the whole idea for a foreign version. Never fall back to `calls` or to the frozen `statement` when D requires statement absence.
4. Update the exact `equippedHypothesis` reader census in `api/_utils/hypothesisRecords/carriage.test.js:596`, the fixture's frozen carriage/hash, read-scope tests, excerpt goldens and subject bindings. Keep the thirteen-module/no-write proof honest if the pure projection's dependencies change. The writer's frozen document shape and fenced evaluator need no edit.

These are implementation obligations within the approved ruling, not requests for additional product authority. Amendment D must be committed and the executor's §6 restated as one current contract during the fix round, as the user already directed.

## 6. Backlog and qualifications

None of these adds an exit criterion or contributes to the verdict.

| Item | Evidence and disposition |
|---|---|
| Explicit null argument throws | Both exports destructure their second parameter (`momentExcerpt.js:376`, `:394`). Passing null rejects with a TypeError; undefined, empty object, array, boolean, number and string probes return null. Validate the parameter object before destructuring to meet the advertised all-malformed-input silence. No ownership disclosure was demonstrated. |
| “Any failed read means null” is broader than the field contract | A failed core card/tape/battle read returns null. Failed version read retains idea without statement; failed series read omits `afterExit`. That matches the accepted partial-field semantics. Narrow report §6.2 so callers do not mistake auxiliary failure for an all-or-nothing snapshot. |
| CD-10 denied-line mismatch | `filmRoomSubject.js:157`–`:162` and its tests deliberately retain symbol/sector on denied version reads. The supplied ruling says no line. Align code/test to that sentence during the fix round, or have the founder explicitly retain the narrower “no idea” behavior. This is neither foreign text leakage nor an off-path change. |
| Pre-existing import syntax gaps | Same-line side-effect import after a statement and dynamic import with a second options argument are valid, AST-visible and missed by both old and new extractors. Import-shaped text inside strings/templates creates false positives in both. Address with the parser work for F2; they are not represented as new C2 regressions or current forbidden graph edges. |
| Read consistency | Ordinary gets can mix revisions. The exporter is not a transactional eligibility receipt; preserve W-05 selection/pre-commit rechecks in the future consumer. This was reproduced, not hidden by the shared pure judge. |
| Root-count wording | Actual pinned census is nine paths / twenty roots, not twenty-one roots as stated in parts of the executor record. Do not invent a root merely to match prose. |
| Future prompt integration | No importer yet, as designed. W-06's one-source quotation, data-message wrapping, budget enforcement and W-07's input ordering remain future integration work; CD-14 improves the shape but does not itself build the assembler. |

I attempted to refute the four findings with the accepted rulings and current source constraints: owner-only inputs do not exempt F1; the untouched graph passing does not repair F2's planted-edge failure; a recorded tick does not supply F3's missing instant; CD-7 does not decide F4's complete ties. These are independently executed reproductions relative to the executor's evidence. This review did not use an additional subagent refuter or replay the executor's full 49-mutant battery; it should not be represented as a new multi-agent mutation campaign.

## 7. Verification record

### Snapshot, fences and merged tree

The shared checkout started on `main` at `71bc6bde`, with five pre-existing modified workspace-experiment files and pre-existing untracked artifacts. I left it in place. Objects needed for this review were fetched into a private object directory with the checkout's objects as a read-only alternate, without writing shared refs or FETCH_HEAD. Head, main and merge-tree snapshots were produced with `git -c core.autocrlf=false -c core.eol=lf archive` outside the checkout.

The current remote main observed for this review is an ancestor of the review head. `git merge-tree --write-tree` reports no conflict and produces tree **`3457767af22420b4b244b33a5a39801d539a3ab7`**, exactly the head tree. Thus the merged-tree checks are also checks of the reviewed code. Initial raw Git blob verification: **5,229/5,229** head and merged files; **5,212/5,212** main files; zero mismatch. Local synthetic probe/test files live only in private snapshots; they are not product edits.

The 36-file branch diff touches none of BUILD_RULES §1's calibration files, `agent-evaluate.js`, `casualClone.js`, rules/indexes, feature flags/hub, any mandate file, Practice Field implementation, tape writers, setup evaluator, activation evidence, workflows or CI guard. The source-day change is confined to extraction and its existing route call sites. No trading behavior or feature activation changed.

Final post-test verification on both Windows and Linux again found **zero original-blob mismatches** in all three snapshots. The shared checkout remains on the same `main` SHA, and its final short status is byte-identical to the initial status. Evidence: `final-integrity-windows.json`, `final-integrity-linux.json`, and the initial/final status captures.

### Platform and runs

Windows host; execution in WSL Ubuntu on the Linux filesystem. `TZ=UTC`, Node **22.22.2**, npm **10.9.7**, Temurin Java **21.0.13**. Dependencies were linked from the existing Linux cache after verifying the exact package-lock hash and installed versions: **1,119 packages, zero mismatches**, lock SHA-256 `40382e64edb6196ff26fdb8af8aa873303076fc1f1d0905402e9810f66d36e3f`. Credentials were unset for emulator/test commands; emulator projects were synthetic `demo-*` projects.

| Check | Result |
|---|---|
| Full unit/jsdom suite, merged tree | **PASS on controlled rerun: 1,508 files passed, 12 skipped; 34,006 tests passed, 135 skipped; zero failures**, 439.04 seconds. Initial run: 1,507 files passed, 1 failed, 12 skipped; 34,005 tests passed, 1 failed, 135 skipped. See timeout explanation below. |
| Full rules suite, merged tree | **PASS: 42 files, 784/784 tests**, 264.96 seconds, dedicated emulator port 8187. |
| `npm run lint:gate` | **PASS**, exit 0. |
| `vite build` | **PASS**, exit 0; ordinary bundler size/dynamic-import warnings recorded in the log. |
| Prior C1 selected probes, with BG-1 expectations updated | **PASS: 25 selected cases**, 31 unrelated cases filtered. |
| Main/head route differential | **PASS:** 23 byte-identical result rows; two test cases per tree. |
| Independent plus reused C1 emulator probes | **PASS: 2 files, 40/40 cases**; includes 22 new C2 authority/version-rule cases. |
| Fresh cards-off captures | **PASS: 12/12** head = main = committed bytes. |
| Runtime adversarial probes | Completed: 70 ID leaks, six unresolved tie cases, loose/impossible time failures; passing bounds, source absence, core ownership, exit and read-set controls as reported. These counterexamples are the findings, not passing product guarantees. |
| Independent AST census and write audit | Completed: current nine path walks agree; 20 planted regex/import bypasses; thirteen-module excerpt closure with only Set/Map candidates. |

**Initial run qualifications.** The sole initial full-suite failure was the unchanged `scripts/experiments/agent-workspace/workspace.test.js:161` test “writes unique local outputs and verifies a saved record with network disabled,” which exceeded its 5-second timeout. Another full-suite process was concurrently running on the host. That entire file passed **18/18** in isolation (the timed row took 857 ms); the full suite was then rerun with four workers under the host's suite lock. The first rules invocation could not start because port 8080 was occupied; the complete successful run uses isolated ports. Neither is silently reported as an initial green run.

The unmodified old C1 probe run had three intentionally obsolete BG-1 expectations (200 versus the new protective 503); only those expectations were changed in the private adapted copy, and the unchanged-card assertions remain. A first main differential harness launch lacked the newly introduced test fixture; after copying that fixture as test-only support, the differential passed. The extra-probe shell wrapper also ended with a trailing printf syntax error after its recorded test commands completed; individual JSON reports and the emulator's successful exit, not that wrapper, establish the results. No product source was modified to make these checks pass.

### Tests run — read once

Observed once at **2026-11-16 06:15:12 UTC**. [Tests run 43804212170](https://github.com/fashraf94/TradeSeven/actions/runs/43804212170) is completed **success** for exactly `c8f9adb20d418a92ce81c93929c46485101daa6e`. Created 04:27:30 UTC, updated 04:33:01 UTC. Unit guards, all four unit shards, Firestore rules/emulator suites, and the final `vitest (unit)` aggregation job all report success. The PR was open, ready (not draft), and mergeable at that observation. I did not poll or rerun CI or take a PR action. Green CI does not cover the new counterexamples in §1.

### Evidence and reproduction

The evidence bundle `20261116_ASTRA_REVIEW_FILM_ROOM_C2_EVIDENCE.zip` at the review artifact root contains the runtime and AST probe source/output; source/merge manifests and changed-file list; route differential captures; twelve golden comparisons; test JSON/logs; emulator probes; CI observation; and snapshot-integrity records. From a private Linux extraction of this head with the recorded dependencies, invoke Node on `runtime-probes.mjs <output.json>`, `census-probes.mjs <output.json>` and `closure-audit.mjs <evidence-directory>` with that snapshot as cwd. The census probe additionally expects the main snapshot as a sibling directory. Run the supplied Vitest probe files only in private snapshots. `baseline.sh`, `merged-recheck.sh`, `probes.sh` and `extra-probes.sh` preserve the commands and environment used; their paths name this review's scratch directories. The JSON/log evidence records the actual outcomes and harness qualifications above.

## Before merging

Fix and recheck **C2-F1–F4**, implement the already-approved five Amendment D changes, and restate the current excerpt contract. Re-run the planted source-ID, strict-time, complete-tie and every-root import probes on the resulting head, plus the merged-tree checks and twelve off-path goldens. No additional production operation or activation is required for this review. Apart from the explicit denied-line backlog choice, there is no new founder decision beyond this report and Amendment D. This verdict does not authorize a merge or feature activation.
