# Build report — Shared Research "Work an idea" B3, the thesis builder's server (dark)

**Date:** Nov 16, 2026 · **Session:** local Claude Code (Opus 5.5), own worktree, no advisor · **Branch:** `claude/shared-research-b3` · **PR:** to be opened from this branch (draft)

**Spec of record:**
- `docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md`, §B2–§B6, plus §B10 (the founder's preamble rulings, appended on this branch);
- `docs/design/shared-research/20261116_WORK_AN_IDEA_CONCEPT_V2_THESIS_BUILDER.md`;
- the design rounds `SHARED_RESEARCH_THESIS_BUILDER_R3.html` and `…_R3B.html`;
- the build prompt's K-1 to K-11 and SQ-1 to SQ-3.

**Base:**
- Cut from `origin/main` @ `88d34457066a6d441b57704e913b1ef4b6e34abc` (fetched first).
- `origin/main` was merged in once: `bd4f0a9529aaf3f353c487931188a15356013e01` (#1071, #1072, #1079–#1082), at `583e9dbb4150c1fb3e8cb477073b58fc9aa99b2c`.
- Three files changed on both sides, and git merged each without a conflict: `docs/README.md` (rows on both sides, all kept), `src/config/flagPinGuard.test.js` (a note on both sides) and `api/_utils/compositionProtectedStoresAllowlist.json` (keys on both sides).
- Main changed no Shared Research file between the two bases (`git diff 88d34457 bd4f0a95 -- api/forge/shared-research.js api/_utils/sharedResearch` is empty).

**Code head and final tree:** `583e9dbb4150c1fb3e8cb477073b58fc9aa99b2c`. Every final check in §7 ran on this tree. The report's own commit sits on top of it and is docs only.

## Verdict

| | |
|---|---|
| The builder | Built, dark: `SHARED_RESEARCH_BUILDER_MODE = 'off'` (`src/config/sharedResearchFlags.js:76`). At `'off'` no request reaches a builder path: the own-words body still answers `400 invalid_entry`, and a story or drop opens a ledger. |
| The ledger | Unchanged (§8). Every test file the branch did not add is untouched, apart from added rows in `sharedResearchFlags.test.js` and a comment in `flagPinGuard.test.js`. Lens D's ~60-request differential, re-run on the final tree, is byte-identical. The B1 recorded probe still validates. |
| What sets a part | Only the player's `card` action. Steps, picks and model output propose; the server derives the rest. |
| The probes (K-8) | **STOPPED.** Both calls were refused `400` before any output: no tokens, $0.00. The likeliest cause is the builder schema's union-type count (§6). The schema is fixed (16 → 13, pinned by a row). The re-run is two calls under $0.10 and waits for your go-ahead. |
| Suite (WSL, `TZ=UTC`, 8 workers) | exit 0 — **1,548 files passed, 12 skipped (1,560); 34,913 tests passed, 135 skipped (35,048)** |
| `lint:gate` · `test:rules` · build | exit 0 · exit 0, **45 files, 810 tests** · exit 0 |
| Bundle against `main` | Every shipped `.js`, `.css` and `.html` file is byte-identical, hashed names included. Only 15 source maps differ (§9). |
| Mutations (K-9) | **62 of 62 killed** on the final tree (§10): §B6's twelve (B-01..B-12, plus three `b` variants), the build's own 25 and the review fixes' 22. Each mutated file was restored byte for byte (SHA-256). |
| Review (K-10) | Four lenses and two refuters, one round. Of 27 items, **20 were CONFIRMED, 6 PARTLY and 1 REFUTED**. Every in-scope finding is fixed with rows and mutants; the rest are on the watch list (§12). |
| Open for the founder | **One:** the probe re-run (§6). No ruling is open. §12 is the watch list. |

## 1. Base, preamble and the rulings

**The preamble** (`C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B3/20261116_SHARED_RESEARCH_B3_PREAMBLE_STOP.md`) re-verified every anchor the amendment names against `88d34457`. All of them are where the amendment says, with the signatures it relies on. It stopped on one shape difference, **S-B1**, and asked three more questions, **S-B2..S-B4**.

**S-B1:** the saved list's `thesis` is a string. Fenced agent code reads it (`agentPromptAssembly.js:141`, `decide.js:437`), and so does the Forge list card (`.trim()`).

**The founder's rulings (Nov 16)** are appended verbatim as **§B10** of the amendment (commit `205edf82`). Each is built as ruled:

| Ruling | Built |
|---|---|
| **S-B1** · the card is saved on the list as **`thesisCard`**; `thesis` stays `''` | `store.js:774` `adoptThesis` writes `[THESIS_CARD_FIELD]: savedCardOf(…)` through `commitAdoption`'s `listExtra`. B1's `thesis: ''` is untouched. |
| **S-B2** · only builder sessions are stamped; no `shape` reads as `'ledger'` | `shapeOf` (`thesis.js`). `sessionViewOf` adds `shape: 'builder'` only for builders. A ledger document gains no key. |
| **S-B3** · `pick.reasons: [{ text ≤140, refs[] }] ≤3`, each labelled by the server | `BUILD_SCHEMA.pick.reasons`. A reason is labelled `basis: 'source'` only when every finding is current and Source-backed; otherwise it is `'reasoning'`. |
| **S-B4** · dropping names keeps the why proposal for the names that remain | `applyCardOp` names `set`: a narrowing keeps `proposal`, minus the dropped names' reasons, still *suggested*. Any other change clears it. |
| **R-21** · free taps DO leave an exchange of kind `card` (builder only); a retried opId appends nothing | `applyCard` (`store.js:835`) appends `{ who: 'player', kind: 'card', text: <label>, at, card: { op, part } }`. `EXCHANGE_KINDS` gains `'card'`. |
| **PF-1** · `thesisCard` is written once, in the save transaction, and never edited; it carries schemaVersion, the watchlist id, the idea version (1) and the session id; one writer, pinned by a census | `savedCardOf` (`thesis.js:671`). The census `thesisRecord.census.test.js` pins one module and one site, inside `adoptThesis`, and pins that the list edit route builds its update from named fields only. |
| **PF-2** · every finding id resolves from saved records alone; check whether anything deletes or prunes them | **Nothing does** (§5). The ids suffice, and the census pins it. |
| **PF-3** · the provenance stamp is on builder saves exactly as on ledger saves; one row | The row is in `shared-research.builder.route.test.js` ("PF-3"). |

## 2. Routine choices (K-1)

**Approved in the preamble (1–20), as built:**
1. The switch is read at call time and never throws. `sharedResearchBuilderMode()` is at `gate.js:84`; anything other than `'on'`, or a throw, reads `'off'`.
2. `build` is its own intent. `STEP_INTENTS`, which the B2 sheet reads, is unchanged.
3. Framing stays the ledger's. A framed `open` makes a ledger whatever the switch says, and own words never frame.
4. A builder record opens with no next action.
5. Only `unset` and `set` are stored. `suggested` and `stale` are derived on every read and inside every transaction (`partStatesOf`).
6. There are two kinds of pick: Atlas's pick on a free choice, and the `pick` goal's suggestion. Only `confirm` sets either.
7. `build_why`'s time-frame pick lands as `timeFrame.suggestion`.
8. Each goal lands only its own proposals. The theme suggestion comes from `verify_source`, or from the first `map_segments` on own words over 80 characters (SQ-2).
9. A story or a drop must verify first: `verify_source` is the only research goal offered until it has run, apart from `direction`.
10. A goal that is not offered, or the other shape's intent or action, answers `400 invalid_intent` with `reason` set to `'shape'` or `'goal_not_offered'`. It is refused before the call is counted.
11. `card` values are as listed in §4.3. A request is idempotent on its `opId`, and the last 20 opIds are kept.
12. Price lines become `{ symbol, side: 'below', level, basis: 'daily_close' }`.
13. The sentence's time frame is `HORIZON_LABELS` with a capital first letter.
14. The numbers in a proposal line must sit in the cited Source-backed findings. A theme suggestion's numbers must sit in the record's Source-backed facts.
15. The fallback reply is "This step added {n} findings." followed by " The card shows what it proposes." or " The card did not change.". Each closing sentence appears only when it is true.
16. A save on a stale `rev` answers `409 card_stale` with the fresh card. More than 28 carried findings answers `400 invalid_adoption` (`too_many_evidence_refs`).
17. Every builder answer carries `thesis` with its `choices`. No ledger answer gains a key.
18. *Replaced by the ruling R-21:* each applied `card` op appends one exchange.
19. An own-words `requestId` never answers another kind of request.
20. A builder step's partner exchange records its `goal` and `part`. They are written only when given, so a ledger exchange is unchanged.

**Made during the build (new; each is listed for the founder):**

21. **A sentence with no theme** opens "Built on {names}, because …". The theme and the segment are optional; readiness needs names, why, wrong if and time frame.
22. **"None" is an empty string for three schema fields:** the theme suggestion, a reason's symbol, and the point against's text. This keeps the schema at 13 union-type parameters, under the API's limit (§6). The validator reads `''` as none.
23. **A reason's company** is resolved by its symbol candidate, by a name written as a ticker, or by the one card name whose stored company name the text uses. Otherwise the reason is dropped.
24. **The card's own texts may carry numbers** into a saved statement. These are the set theme, the wrong-if text and the time frame's label. A theme or wrong-if that Atlas proposed had its numbers checked when it was proposed (routine 14, rule 3). This follows §B4.5.
25. **At most 300 `card` exchanges per session.** One more answers `400 invalid_card` with `too_many_changes`. This came from review RA-6.
26. **`card` answers `409 step_in_flight` while a step runs.** A stale running step does not block it. This came from RA-4, RA-5 and RB-8.
27. **`thesis.saveIssue`** gives the save's own refusal before Save, using the same function the save uses (`saveIssueOf`). This came from RA-7.
28. **The dead end is derived.** `names.blocked` is stored when a `find_names` step finds none. It reads as blocked only while no company is supported, so a later `direction` step that sources one lifts it (RB-5).
29. **The builder's own wording rules** (`thesisWords.js`) apply to builder lines only. B1's lists are unchanged; extending them would move KB ledger answers, as refuter R2 showed.
30. **A stale segment blocks Save**, as the first blocker.
31. **A request in the other shape is refused before a replay or a saved answer** (RA-2, RD-1, RD-2).
32. **The reply is cut at a sentence's end to 600 characters before B1's checks.** The server's own lines are appended within 600 (RB-7).
33. **A validator throw after the paid call fails the step** (`step_failed`, `invalid_unparseable`, 200). It goes through B1's failure path: logged and released (RC-1). A malformed proposal field is dropped field by field and never fails a step (K-4).
34. **A names pick reads a trailing period.** Any other unresolved token drops the whole pick; it never narrows (RB-4).
35. **The prompt's own instruction text passes the builder's price patterns.** The line now reads "Never a price level or a share-price move".

**SQ-1..SQ-3** are built as the defaults:
- SQ-1: the probes were attempted (§6).
- SQ-2: a theme over 80 characters stays unset, and the first `map_segments` may suggest one.
- SQ-3: an incomplete why proposal is stored with `incomplete: [SYM]` but cannot be confirmed. The reply names the company, and the free choices offer `drop_unsourced`, which lists what it clears.

## 3. What was built (by layer, at `583e9dbb`)

| Layer | Where | What |
|---|---|---|
| Switch | `src/config/sharedResearchFlags.js:53,76`; `api/_utils/sharedResearch/gate.js:84` | `SHARED_RESEARCH_BUILDER_MODES ['off','on']`, `SHARED_RESEARCH_BUILDER_MODE = 'off'`, the never-throws reader; pin rows in `sharedResearchFlags.test.js`; the "intentionally ABSENT" note in `flagPinGuard.test.js` |
| Vocabulary | `src/constants/sharedResearch.js` | `SESSION_SHAPES`, `BUILD_INTENT`, `BUILD_GOALS`, `THESIS_PARTS`, `PART_STATES`, `SET_BY`, `CARD_OPS`, `PICK_PARTS`, `THESIS_DEPENDENTS`, `THESIS_LIMITS`, `THEME_MAX` (tree-shaken out of the client bundle, §9) |
| The card, pure (K-3) | `api/_utils/sharedResearch/thesis.js` | opening card `:85`, context `:108`, derived states `:148`, readiness `:182`, sentence `:207`, offered goals `:241`, free choices `:267`, the shared-reason check `:403`, the free action `:446`, opId idempotency `:576`, proposals `:593` (never set a part), carried ids `:621`, the save check `:646`, the saved card `:671`, the view `:709` |
| The turn | `api/_utils/sharedResearch/thesisSchema.js` (`BUILD_SCHEMA :57`, `validateBuildTurn :173`); `thesisWords.js` | B1's `validateStepTurn` runs first and alone fails a step; then rules 1–6 drop proposals with notes (K-4); the builder's wording rules |
| The prompt | `api/_utils/sharedResearch/stepPrompt.js` (`THESIS_BUILDER_RULES :190`, `buildBuildSystemPrompt :216`, `renderBuildUser :300`); `docs/design/SHADOW_VOICE_RULES_V1.md` §6 (`:89`) | §6 equals `THESIS_BUILDER_RULES` byte for byte (K-6, pinned in `prompt.builder.test.js`); the method is untouched (K-7) |
| Store | `api/_utils/sharedResearch/store.js` | `beginStep :418` (`shape`, `admit`), `recordStep :463` (`cardUpdate` in the same transaction), `commitAdoption :628` (B1's save mechanics, moved out of `adoptIdea` unchanged — lens A's 10-scenario differential: identical answers, writes and documents), `adoptIdea :700`, `adoptThesis :774`, `openOwnWords :802`, `applyCard :835` |
| Route | `api/forge/shared-research.js` | `handleOpen :272` (own words; story/drop open a builder at `'on'`), `handleStep :353` → `handleBuildStep :615`, `handleAdopt :532` → `handleAdoptThesis :790`, `handleCard :770`, `ACTIONS :816` |
| Save check | `api/_utils/sharedResearch/adoptPreview.js:149` | `assertThesisStatementSupported` (B1's rule with the card's own texts) |
| Small edits | `session.js` (`'card'` exchange kind; `goal/part/card` on an exchange only when given; `shape` on a builder's view), `stepSchema.js` (`export` on `promisesService`), `copy.js` (four refusal lines), `compositionProtectedStoresAllowlist.json` (`adoptIdea`'s write sites renamed to `commitAdoption`; `openOwnWords`, `applyCard`) |
| Tests (new) | `thesis.test.js` (74), `thesisSchema.test.js` (43), `gate.builder.test.js` (12), `prompt.builder.test.js` (10), `thesisRecord.census.test.js` (7), `reviewB3.test.js` (51), `api/forge/shared-research.builder.route.test.js` (32) | 229 rows |
| Probe | `scripts/sharedResearch/probeBuilder.mjs`, `__fixtures__/probeBuilder.js` | ready; not yet recorded (§6) |

**§B6's measures** (for §11.4) come from what is already stored; nothing new is kept:
- each builder call record carries its `goal` and `part`;
- its `validationNotes` hold every dropped line with its rule (`dropped:<what>:<rule>`), an incomplete why (`why_incomplete:<SYM>`) and a replaced reply with its cause (`reply_replaced:<cause>`, `dead_end` included);
- the session's `card` exchanges (R-21) and step exchanges carry their times, which give free taps per ready thesis and the time from open to ready;
- the dead end is on the card (`names.blocked`).

Untouched, as the STOP list requires: every fenced file; the idea version builder (`api/_utils/hypothesisRecords/`); the research record model (`api/_utils/researchRecords/`); `firestore.rules` and `firestore.indexes.json`; the knowledge-base loader and packages (`method.js` and the KB files); everything under `src/components/`; `modelTurn.js` (the builder runs on `MODELS.step`, `claude-sonnet-5-5`). `git diff --name-only bd4f0a95...HEAD` names none of them.

## 4. The builder's contract, as built (for B4 to copy)

Every request goes to `POST /api/forge/shared-research` (actions) or `GET /api/forge/shared-research?sessionId=` (the read), through B1's gate unchanged (`SHARED_RESEARCH_MODE`, auth, admission, the per-uid limiter: 10 POST and 30 GET a minute). Refusals answer `{ error, message, ...extra }` (B1's shape, `sendSharedResearchError`). The client sends operations only; it never sends a finding, a reason's sources, a supported company, a `ready` verdict or the card.

**How a client tells the shapes apart:** a builder session's view carries `session.shape: 'builder'`, and every builder answer carries a top-level `thesis`. A ledger session's view and answers have neither key — exactly as before B3.

### 4.1 `open`
| Entry | Body | When |
|---|---|---|
| Own words (DR-6) | `{ action: 'open', requestId, entry: { kind: 'observation', observation } }` — `observation` 1–500 characters after trim, `<>{}` stripped; `requestId` a forge id | only while `SHARED_RESEARCH_BUILDER_MODE === 'on'`; at `'off'` this body answers `400 invalid_entry` as before |
| A story / a drop | unchanged (B1 §6.3): `{ action: 'open', requestId, entry: { kind: 'item' \| 'signaldrop', itemRef, question, direction? } }` | opens a builder while the mode is `'on'`, a ledger otherwise |
| A framed observation | unchanged (`{ action: 'open', sessionId, question, direction? }`) | always a ledger (routine 3) |

Answer (200): `{ session, record, companies, thesis, opening: { storedRows }, quota, existing?: true, previous }` — `thesis` only for a builder session. Own words: no framing call and no framing count; one investigation counted; `record.question` = `"Build a thesis on: {observation}"`; the theme set from the words when ≤ 80 characters (`by: 'player_wrote'`). A builder record opens with no next action (routine 4). Refusals: B1's (`invalid_observation`, `invalid_request` — also a requestId another kind of request made, `daily_limit` 429, `attribution_unavailable` 503, …).

### 4.2 `step` — the `build` intent
Body: `{ action: 'step', sessionId, stepId (uuid), intent: 'build', goal, part?, direction? }`
- `goal` ∈ `verify_source · map_segments · find_names · build_why · strengthen · pick · direction` (`BUILD_GOALS`);
- `part`: required for `strengthen` (any of the six parts) and `pick` (`segment · names · wrongIf · timeFrame`);
- `direction`: required for `direction` (1–500 characters, the player's words).

The server offers the goals (`thesis.choices.research`). A goal not on offer, or `build` on a ledger session, answers `400 invalid_intent` with `reason: 'goal_not_offered' | 'shape'`, refused inside the admission transaction before the call is counted. A ledger intent (`next`, `examine`, `refresh`, `direction`) on a builder session answers `400 invalid_intent`, `reason: 'shape'`. The shape is checked first — before a replayed `stepId` is answered — so no answer ever comes back in the other shape; the goal check follows the replay (a real replay of a goal no longer on offer still answers).

| Answer | Shape |
|---|---|
| Success (200) | `{ session, record, companies, thesis, changed: { findings: n, card: bool }, quota }` |
| Replay of a stepId (200) | `{ session, record, companies, thesis, quota, replay: true, changed: { findings: 0, card: false } }` |
| Failure (200, 504 on the model's abort, 409 cancellation, 500) | `{ error: 'step_failed', reason, session, thesis, quota }` |

B1's refusals stand: `session_not_found` 404; `session_not_open`, `step_in_flight`, `budget_spent`, `findings_full` 409; `step_limit` 429; `budget_paused` 503; `prompt_too_large` 400; `invalid_request`, `invalid_direction` 400. `pick` makes no retrieval. A validator throw after the paid call answers `step_failed` with `reason: 'invalid_unparseable'` (200), through B1's failure path (logged, the step released); a malformed proposal field is dropped, never failing the step.

`changed.card` is true only when the card as stored changed (what landed, not what was proposed). The partner exchange records `intent: 'build'`, `goal` and `part`; its `text` is the reply:
- the model's reply, cut at a sentence's end to ≤ 600 characters **before** B1's checks run;
- replaced by the server's plain line when it fails a check or claims what did not land — "This step added {n} findings." + " The card shows what it proposes." (something it proposed landed) or + " The card did not change." (nothing changed) — in this order of causes: an unsupported number, a service promise, the builder's wording (forecast, praise, odds in words, a promise to watch), the goal's own proposal dropped, a dead-end reply naming a listed company, proposals dropped;
- in a dead end, ending with "No listed company has a sourced connection yet; nothing is picked to finish the card." when replaced;
- for a why with an unsourced name, followed by "No Source-backed reason was found for {Company (SYM)} yet, so the why cannot be confirmed with it." — the whole within 600.

### 4.3 `card` — the free action
Body: `{ action: 'card', sessionId, opId (uuid), rev (integer: the card's `rev` the player saw), op: 'confirm' | 'set' | 'clear', part, value? }`

| `part` | `set` value | `confirm` takes | `clear` |
|---|---|---|---|
| `theme` | `"phrase"` or `{ text }` (1–80) — only while unset | the theme suggestion | refused (`theme_fixed`) |
| `segment` | a map label, or `'skip'` | Atlas's pick (`thesis.pick.part === 'segment'`) | clears names and why |
| `names` | `["SYM", …]`, 1–4 distinct, each supported now | the names pick | clears why and the price lines |
| `why` | `{ keep: [i, …] }` — indexes into `parts.why.proposal.reasons`, at least one holding reason per name; the shared reason is re-checked against the KEPT reasons (its numbers in their Source-backed findings, no company outside the names) | the whole proposal (needs a holding reason per name; the same re-check) | why only (its proposal stays) |
| `wrongIf` | `{ option: i }` or `{ text }` (1–200, the player's words, stored as written), optionally with `priceLines: [{ symbol, level }]` (one per set name, `level` > 0); `{ priceLines }` alone re-sets the lines of a set wrong-if | Atlas's wrong-if pick (an option) | wrong if only |
| `timeFrame` | `'swing' \| 'positional' \| 'longterm'` | the time-frame suggestion, or a time-frame pick | time frame only |

| Answer | Shape |
|---|---|
| Applied (200) | `{ session, thesis, applied: true }` — `rev` + 1; the session's `exchanges` end with `{ who: 'player', kind: 'card', text: <label>, at, card: { op, part } }` (R-21) |
| A retried opId (200) | `{ session, thesis, applied: false }` — nothing changed, nothing appended |
| `409 card_stale` | `{ error, message, thesis }` — the fresh card |
| `409 step_in_flight` | a step is running on the session (a stale running step does not block) |
| `400 invalid_card` | `{ error, message, reason }`, `reason` ∈ `unknown_op · theme_fixed · not_set · no_suggestion · suggestion_stale · invalid_value · names_unset · why_incomplete · already_set · shared_unsupported` (the shared reason fails the re-check) `· too_many_changes` (300 `card` exchanges on the session) |
| others | `400 invalid_request` (malformed body), `400 invalid_intent` (a ledger session), `404 session_not_found`, `409 session_not_open` |

Order of checks: the session (404), the shape (`invalid_intent`), a retried `opId` (answers `applied: false`), open (`session_not_open`), a running step, the `rev`, the 300 cap, then the op.

No model call, no retrieval, no step and no step call counted; the gate and the per-uid POST limit apply. A Change that clears parts is the client's to confirm first: every set part's `clear` choice lists what it clears (`thesis.choices.free[].clears`), and `thesis.dependents` holds the table.

### 4.4 `adopt` — Save thesis
Body: `{ action: 'adopt', sessionId, rev, statement? }` — `statement` omitted (or null) saves the composed sentence; a string is the player's edit.

| Answer | Shape |
|---|---|
| Saved (200) | `{ watchlistId, version: 1, researchWorkId, idempotent: false, thesis }` — a retry answers `idempotent: true` and writes nothing |
| `409 card_stale` | `{ error, message, thesis }` |
| `409 not_ready` | `{ error, message, blockers: [{ part, state }] }` — a stale segment is a blocker too |
| `400 unsupported_assertion` | `{ error, message, detail: <the number> }` — a number in the statement (the composed sentence or an edit) not in a carried Source-backed fact, the set theme, the wrong-if text or the time frame's label |
| `400 names_not_supported` | `{ error, message, detail: { missing \| deselected } }` — the statement names a supported company the card does not hold (`deselected`), or an edit leaves out one of the card's names (`missing`) |
| `400 invalid_adoption` | `{ error, message, reason }` — the idea builder's own refusal (an empty or over-long statement, more than 28 carried findings: `too_many_evidence_refs`) |
| others | `400 invalid_intent` (a ledger session; a ledger body sent for a builder — checked before a saved answer is returned), `409 session_not_open`, `404 session_not_found`, `400 no_valid_tickers` |

`thesis.saveIssue` (below) shows the save's own refusal before Save, from the same function (`saveIssueOf`).

What is saved: the list (B1's committed list, its `thesis: ''` untouched, the provenance stamp copied) plus **`thesisCard`** (§B10 S-B1, PF-1); the idea's version 1 with the statement, `horizonEnum` = the time frame, `invalidation` = the price lines as `{ symbol, side: 'below', level, basis: 'daily_close' }`, the evidence = the record, the carried findings (each name's relationship fact, every reason's findings, the point against's — current, each once) and the confirming exchange. The record closes `completed / saved_to_list`; the session `completed`.

`thesisCard` (written once, in the save's transaction; its one writer is `adoptThesis`):
```
{ schemaVersion: 1, watchlistId, hypothesisVersion: 1, sessionId, researchWorkId, savedAt,
  statement,                      // what was saved (the composed sentence or the player's edit)
  sentence,                       // the composed sentence
  theme:     { value, by },
  segment:   { value, skipped, by, findingIds },
  names:     { value: [SYM], by },
  why:       { shared, by, reasons: [{ symbol, text, findingIds }], against: { text, findingIds } | null },
  wrongIf:   { text, by, findingIds, priceLines: [{ symbol, level }] },   // the wrong-if in words
  timeFrame: { value, label, by },
  findingIds: [ … ] }             // the carried findings — they resolve on the research record (PF-2)
```

### 4.5 `GET ?sessionId=` and `close`
- `GET` on a builder: `{ session, record, companies, thesis, storedRows, previous, quota }` — no `adoptPreview` key (the card is the preview).
- `close` (B1's body, `concluded | abandoned`) on a builder: `{ session, record, thesis }`.

### 4.6 The `thesis` view
```
thesis: {
  schemaVersion: 1, rev,
  parts: {
    theme:     { state, value, by, suggestion },
    segment:   { state, value, by, skipped, findingIds, map: [{ label, line, findingIds }] | null },
    names:     { state, value: [SYM], by, blocked: 'no_listed_company' | null },
    why:       { state, by, shared, reasons: [{ symbol, text, findingIds }], against: { text, findingIds } | null,
                 proposal: { shared, reasons, against, forNames, incomplete: [SYM] } | null },
    wrongIf:   { state, by, text, findingIds, options: [{ text, findingIds }], priceLines: [{ symbol, level }] },
    timeFrame: { state, by, value, label, suggestion: { value, reason } | null },
  },
  pick: { part, value, reason, findingIds, asked, basis: 'source' | 'reasoning',
          reasons: [{ text, findingIds, basis }] } | null,
  filled,                     // parts whose state is `set` (a skipped segment counts), 0–6
  saveIssue,                  // null, or { code, detail } — what Save would refuse (only while ready)
  ready, blockers: [{ part, state }],
  sentence,                   // the composed sentence, or null until names, why, wrong if and time frame hold values
  dependents: { segment: ['names', 'why'], names: ['why'] },
  choices: {
    research: [{ goal, part? }],                         // each one step; [] when out of steps or not open
    free: [{ op, part, value?, input?, options?, min?, max?, reason?, clears? }],
  },
}
```
- `state` ∈ `unset · suggested · set · stale`, derived on every read (routine 5). `suggested`: a theme suggestion, a why proposal, a time-frame suggestion, or a part the player asked the partner to pick (`pick.asked`). `stale`: a finding behind the set part is no longer current; for names, a name no longer supported; for why, a reason no longer holding or a name without one.
- `by` ∈ `player_wrote · player_chose · partner_suggested_confirmed`.
- `pick` without `asked` is Atlas's pick on a free choice (DR-2): it marks the choice; the part stays `unset`.
- `pick.basis` / `reasons[].basis` (§B10 S-B3): `source` only when every finding is current and Source-backed; else `reasoning`.
- `parts.timeFrame.label` / the sentence's time frame: `HORIZON_LABELS` with a capital ("Positional · about 30 sessions").
- The dead end: `parts.names.blocked === 'no_listed_company'` — shown only while no company is supported (a later step that sources one lifts it); `find_names` is then not offered; the free choices include `{ op: 'clear', part: 'segment' }` ("Try another segment"); Conclude is B1's `close`.
- `blockers` lists a stale segment first, then the unset or stale parts among names, why, wrong if and time frame.
- Every `clear` choice and `drop_unsourced` (`{ op: 'set', part: 'names', value, reason: 'drop_unsourced', clears }`, offered only while the why is unset) list what they clear; `set segment` on an unset segment clears nothing.

## 5. The saved thesis: PF-1, PF-2, PF-3

**PF-1 · one writer.** The field's name lives in one constant, `THESIS_CARD_FIELD = 'thesisCard'` in `thesis.js`, and only `store.js` imports it. `store.js` names it once, in `adoptThesis`'s `listExtra`, inside `commitAdoption`'s transaction. That write is the list document's first: a `tx.set` on a freshly minted list id, after the transaction checks the id is not taken. So the card is written once, with the list. The list's own edit route (`api/forge/watchlists/[id].js`) builds its update from named fields only and refuses a committed list, so no route can edit the card afterwards. `thesisRecord.census.test.js` pins all of this. It also pins that the walk read the tree: a census that reads nothing passes nothing. The saved card's shape is in §4.4.

**PF-2 · the ids suffice.** No code path deletes or prunes a research record or its findings while its list exists:
- **The rules.** `firestore.rules` allows the owner to read `researchWork` and allows no client write at all.
- **Deletes.** No module that names the collection calls `delete`, `recursiveDelete` or `FieldValue.arrayRemove`.
- **Patches.** The record model's patches never rewrite `findings`, except `findingAppendPatch`, which keeps every earlier finding and adds one.

So every finding id in `thesisCard.findingIds` resolves on the record to its text, source name, link and published date for as long as the list exists. The card carries no copy. Three census rows pin this.

Their threat model, stated on purpose, is a static reading of the tree as it stands. Two cases are outside it: a module that reaches the collection through a name built at run time, and a script run by hand outside the repo. This is the Film Room census's ruling Q-11.

**PF-3 · the provenance stamp.** A builder save copies the stamp exactly as a ledger save does: the session's stamp at open is copied onto the saved list and passed to the version builder. One row in `shared-research.builder.route.test.js`.

## 6. The probes (K-8): STOPPED, and waiting for your go-ahead

**What ran.** `node --env-file=C:/Users/fashr/portfolio-duel/.env.local scripts/sharedResearch/probeBuilder.mjs` made two calls, at 2026-11-17 01:08:20 UTC (Nov 16, 7:08 PM CT). Each was one live builder turn on `claude-sonnet-5-5` (`MODELS.step`, the only model a builder step uses), with the real builder system prompt, the real user turn, the builder schema and an authored fixture:
- `map_segments` on an own-words AI-power idea;
- `build_why` on two named companies.

`CLAUDE_API_KEY` was loaded into the probe process only. It was never printed, logged or written.

| Probe | Answer | Time | Usage | Cost |
|---|---|---|---|---|
| `map_segments` | `400` (`model_error_400`), 1 attempt | 561 ms | none | $0.00 |
| `build_why` | `400` (`model_error_400`), 1 attempt | 192 ms | none | $0.00 |

**Why they were refused.** The turn runner records the status, not the API's message, so the cause is inferred rather than read. The builder schema held **16 parameters with union types**, the documented maximum. B1's step schema holds 15 and works live. The platform documents that unions combined with nesting can compile to an oversized grammar and are refused with a `400`. The model id is the one B1's recorded probes run on, so the likeliest cause is the output format.

**K-8's letter.** "If a call is refused for the model id or the output format, STOP and report." The probes therefore stopped there.

**The fix (commit `8dac7780`).** The builder now writes three of its "none" values as an empty string instead of `null`: the theme suggestion, a reason's symbol, and the point against. That leaves **13** union-type parameters and no optional parameter. A row walks the schema and pins `UNION_PARAMETERS = 13 < 16`. The validator reads `''` as none (routine 22).

**The re-run (your go-ahead).** Two calls, the same command with `--force` so the two refused records are replaced. Each answer is written to `test/fixtures/sharedResearch/build.<goal>.recorded.json` with its usage and cost. `thesisSchema.recorded.test.js` then validates both, as `stepSchema.recorded.test.js` does for B1. **The expected cost.** Each request is about 18,000 characters: an 8,856-character system prompt, a 1,613- or 2,222-character user turn and the 7,203-character schema. That is close to B1's recorded probe, which cost $0.025 for 5,644 input and 1,390 output tokens on `modelTurn.js`'s own price table. With the step's 2,500-token output cap, each call costs at most about $0.04, so both stay under the $0.10 cap.

After a successful re-run:
1. commit the two fixtures and the recorded-probe test;
2. re-run the targeted files;
3. add each probe's line to this section.

If either call is refused again, STOP again.

## 7. Tests and checks (on the final tree `583e9dbb`)

| Check | Result |
|---|---|
| Full suite: WSL `~/pd-ci-srb3`, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, JSON report read | **exit 0**. `Test Files 1548 passed \| 12 skipped (1560)`; `Tests 34913 passed \| 135 skipped (35048)`; 292.6 s |
| `npm run lint:gate` (`--max-warnings 0`) | **exit 0** |
| `npm run test:rules` (JDK 21, emulator) | **exit 0**. `Test Files 45 passed (45)`; `Tests 810 passed (810)` |
| `vite build`, minified, branch and `main` | exit 0 and exit 0 (§9) |
| Golden, census and prompt-honesty files (all inside the suite run, read from its JSON) | All passed. `prompt.honesty` 9/9 (the §4 and §5 pins), `prompt.builder` 10/10 (§6 byte for byte), `stepSchema.recorded` 5/5 (B1's recorded probe still validates), `thesisRecord.census` 7/7, `compositionProtectedStores.scan` 30/30, `compositionWriterCensus` 6/6, `compositionDerivedWrites.census` 5/5, `equippedHypothesisRefs.census` 41/41, `unconfirmedOutcome.census` 10/10, `agentReadCensus.guard` 8/8, `flagPinGuard` 10/10, `sharedResearchFlags` 10/10, and every `*golden*` file |
| The ledger differential (§8), re-run on this tree | 4 of 4 rows byte-identical |

**New rows.** There are 229 across seven new files: `thesis` 74, `thesisSchema` 43, `reviewB3` 51, `shared-research.builder.route` 32, `gate.builder` 12, `prompt.builder` 10, `thesisRecord.census` 7.

**Windows note.** On this worktree's CRLF checkout, two of main's files misbehave. `src/config/shadowCpuQuoteIntegrityFlags.test.js` fails because a regex over a raw file read expects LF. `src/config/backingBetaFlags.test.js` timed out once under load and passes alone. Both pass in the Linux suite above (10/10 and 13/13), and neither touches a file of this branch.

## 8. The ledger is unchanged: the evidence

1. **The existing tests are untouched and green.** `git diff --name-status bd4f0a95...HEAD` modifies only two pre-existing test files:
   - `src/config/sharedResearchFlags.test.js`: 34 lines added, none removed (the builder flag's pins);
   - `src/config/flagPinGuard.test.js`: 9 lines added, none removed (the "intentionally ABSENT" note).

   Every B1, B2 and KB-1 Shared Research test file is unedited and passes in the suite. That includes the route, store, session, step schema, adopt preview, review fixes, rulings, refuter pass, KB method checks and the client sheet files.
2. **The ledger differential, re-run on the final tree.** Lens D wrote a harness that runs the same ledger traffic through `main`'s route and modules and through this branch's. It covers about 60 requests on one seeded double, with fixed uuids and a frozen clock: story, drop, framed own words and every refusal branch. The story and drop script runs with the builder flag absent from the flags mock (as the existing route tests mock it) and at `'off'`. The framed own-words script also runs at `'on'`, because framing stays the ledger's. It compares as JSON strings, so key order counts:
   - every answer;
   - every stored document;
   - the read and write logs;
   - the shadow-log records;
   - the model prompts and the retrieval arguments.

   It ran first on `1ecf712d`. It was re-run here on `583e9dbb`, in a fresh `git archive` snapshot, against `main`'s files copied as `shared-research.base.js` and `sharedResearchBase/`. The 13 module copies are byte-identical to `bd4f0a95`'s, which equal `88d34457`'s. The route copy differs only in its import paths and one comment. Result: **4 of 4 rows pass; every value is byte-identical.** The harness's three repro rows for RD-1 and RD-2 were skipped, because they pinned the defects that §11 fixed.
3. **What the B1 code itself changed** (`git diff bd4f0a95...HEAD` on B1's modules):
   - `stepSchema.js`: one keyword (`export` on `promisesService`).
   - `session.js`: the `'card'` exchange kind. `goal`, `part` and `card` are written only when given, and `shape` appears only for a builder.
   - `adoptPreview.js`: one new function.
   - `copy.js`: four new lines.
   - `store.js`: B1's save mechanics moved unchanged into `commitAdoption`. Lens A's 10-scenario differential against `main`'s `adoptIdea` found identical answers, writes and documents. Two other changes are additive: `beginStep`'s `shape` and `admit`, and `recordStep`'s `cardUpdate`. They are absent on every ledger call, apart from `shape: 'ledger'`, which a ledger session passes.
   - `api/forge/shared-research.js`: builder branches only, each behind the builder shape or the `'on'` switch.
4. **The B1 recorded probe** (`stepSchema.recorded.test.js`) still validates: 5 of 5.

## 9. The bundle diff (minified `vite build`, branch `583e9dbb` against `main` `bd4f0a95`)

| | |
|---|---|
| Files | 113 against 113, with the same names (every content hash in a file name is the same) |
| Shipped `.js`, `.css` and `.html` | **byte-identical**, every one |
| Differing files | 15, all source maps (`.js.map`) |
| 14 of them | differ only in `sources` paths. `main`'s build tree reaches `node_modules` through a symlink into the branch tree's install, so its maps say `../../../pd-ci-srb3/node_modules/…` where the branch's say `../../node_modules/…`. After normalizing that one prefix, 0 entries differ. This comes from the build host, not the code. |
| 1 of them | `CommandCenterHub-*.js.map` differs only in the embedded `sourcesContent` of `src/config/sharedResearchFlags.js` and `src/constants/sharedResearch.js`, the two `src/` files this branch adds to. Their new exports are tree-shaken out of the shipped code. |

So the client ships exactly what `main` ships. Nothing in `src/components/` changed.

## 10. The mutation table (K-9)

**What it contains:**
- **B-01..B-12** are amendment §B6's twelve mutants, with three `b` variants where one line of §B6 has two homes (the card and the validator, or two parts).
- **X-01..X-25** are the build's own.
- **F-01..F-22** are the review fixes' (§11).

**How it ran.** The battery ran on the final tree `583e9dbb`, in this worktree, through `node mutate.mjs` (Windows, vitest 4.0.17, the JSON reporter).
- Each mutant is one exact-anchor edit. An anchor that does not match exactly once is reported BROKEN and not run.
- Each mutant's test files ran with the report file deleted first.
- The verdict reads the exit code and the failed rows together: KILLED means a non-zero exit with failed rows.
- The mutated file was restored to its original bytes, checked by SHA-256. `git status --porcelain` was empty before and after the run.

**Earlier rounds.** The first full run (before the review) killed every mutant but B-05. B-05 got rule-4-only rows (`1ecf712d`). After the fix round, six anchors had moved. They were re-cut, and X-12's new row (`899abd14`) was added. This table is the whole battery, re-run once more on the final tree.

The scripts and the JSON are kept in `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B3/review-evidence/`.

| ID | The mutant | File | Verdict | Rows failed / run | One row that kills it |
|---|---|---|---|---|---|
| B-01 | a step sets a part without the player (the theme) | `thesis.js` | KILLED | 2 / 106 | shared-research.builder.route.test.js › the server decides what is on offer (§B4.2) a verify step suggests a theme; confirming it is free; then the m… |
| B-01b | a step sets a part without the player (the segment, from its map) | `thesis.js` | KILLED | 3 / 106 | shared-research.builder.route.test.js › a step only proposes (V2-4) map_segments lands a map and Atlas's pick; no part is set; rev + 1; the call is l… |
| B-02 | ready ignores a stale part | `thesis.js` | KILLED | 3 / 106 | thesis.test.js › ready and its blockers (V2-1; §B3) a why left behind by names that are gone is stale blocks ready |
| B-03 | a name outside the supported set is accepted | `thesis.js` | KILLED | 1 / 106 | thesis.test.js › the transitions and dependencies (§B3, §B4.3; §B10 S-B4) refused: a name not supported |
| B-04 | a reason backed by an inferred finding counts (the validator) | `thesisSchema.js` | KILLED | 1 / 75 | thesisSchema.test.js › rule 1 — a reason counts only on current Source-backed findings about that name a reason resting on an inference is dropped; t… |
| B-04b | a reason backed by an inferred finding counts (the card) | `thesis.js` | KILLED | 5 / 106 | thesis.test.js › derived states: unset · suggested · set · stale (§B3) a why whose reason rests on an inference is stale (rule 1); so is one missing … |
| B-05 | a wrong-if option with a price passes | `thesisSchema.js` | KILLED | 3 / 43 | thesisSchema.test.js › rule 4 — a wrong-if option names a business condition, never a price a price condition with no figure and no forbidden word — … |
| B-06 | `card` counts a step | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the free action (§B4.3; K-5; §B10 R-21) makes no model call and counts no step and no step call |
| B-06b | `card` calls the model | `shared-research.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the free action (§B4.3; K-5; §B10 R-21) makes no model call and counts no step and no step call |
| B-07 | a pick cites a finding not on the record | `thesisSchema.js` | KILLED | 1 / 43 | thesisSchema.test.js › rule 6 — the pick goal cites only findings already on the record a pick reason citing this turn's own finding is dropped; one … |
| B-08 | a ledger session accepts `build` | `shared-research.js` | KILLED | 3 / 32 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) the stamp never changes: flipping the mode leaves open sessions on thei… |
| B-09 | the flag at 'off' opens a builder session | `gate.js` | KILLED | 41 / 88 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) builder mode 'off': a story opens as today's ledger — no shape, no card… |
| B-10 | `adopt` saves a card that is not ready | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › to a ready card, and its save (§B4.5; §B10 S-B1, PF-1, PF-3) not ready → 409 not_ready with its blockers, not… |
| B-11 | changing the segment keeps the old names | `thesis.js` | KILLED | 1 / 106 | thesis.test.js › the transitions and dependencies (§B3, §B4.3; §B10 S-B4) changing the segment clears the names, the why and the price lines; the map… |
| B-12 | the composed sentence drops the wrong-if | `thesis.js` | KILLED | 7 / 106 | shared-research.builder.route.test.js › to a ready card, and its save (§B4.5; §B10 S-B1, PF-1, PF-3) the path: ready, the sentence composed, four of … |
| X-01 | `card` not idempotent on opId | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the free action (§B4.3; K-5; §B10 R-21) leaves one `card` exchange per applied op; a retried opId applies and… |
| X-02 | `card` takes a stale rev | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the free action (§B4.3; K-5; §B10 R-21) a rev that is not current answers 409 card_stale with the fresh card;… |
| X-03 | S-B4: dropping names loses the why proposal | `thesis.js` | KILLED | 1 / 74 | thesis.test.js › the transitions and dependencies (§B3, §B4.3; §B10 S-B4) S-B4: dropping names keeps the why proposal for the names that remain — con… |
| X-04 | S-B2: a ledger session is stamped | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) builder mode 'off': a story opens as today's ledger — no shape, no card… |
| X-05 | S-B1: the card overwrites the list's own thesis field | `store.js` | KILLED | 3 / 39 | shared-research.builder.route.test.js › to a ready card, and its save (§B4.5; §B10 S-B1, PF-1, PF-3) saves: the composed sentence, the card's evidenc… |
| X-06 | the pick goal retrieves | `shared-research.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › a step only proposes (V2-4) the pick goal makes no retrieval and one model turn; its answer shows the part as… |
| X-07 | a builder session accepts a ledger intent | `shared-research.js` | KILLED | 2 / 32 | shared-research.builder.route.test.js › the other shape is refused (§B2): invalid_intent, before any call is counted a builder session refuses a ledg… |
| X-08 | a builder opening keeps the next action | `shared-research.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) builder mode 'on': a story opens stamped builder with an empty card and… |
| X-09 | a story need not verify first | `thesis.js` | KILLED | 3 / 106 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) builder mode 'on': a story opens stamped builder with an empty card and… |
| X-10 | a segment never goes stale | `thesis.js` | KILLED | 1 / 74 | thesis.test.js › derived states: unset · suggested · set · stale (§B3) a set part whose findings are all current is set; one with a superseded findin… |
| X-11 | a pick lands for a part the player set | `thesis.js` | KILLED | 1 / 74 | thesis.test.js › a step's proposals (§B4.2 — no step ever sets a part, V2-4) a pick for a part the player set meanwhile is dropped; every step replac… |
| X-12 | an edited sentence need not name the card's names | `thesis.js` | KILLED | 2 / 200 | shared-research.builder.route.test.js › to a ready card, and its save (§B4.5; §B10 S-B1, PF-1, PF-3) an edited sentence: a number in the wrong-if or … |
| X-13 | R-21: an applied op leaves no exchange | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › the free action (§B4.3; K-5; §B10 R-21) leaves one `card` exchange per applied op; a retried opId applies and… |
| X-14 | a proposal line may promise a service | `thesisWords.js` | KILLED | 1 / 43 | thesisSchema.test.js › rule 3 — every written line: forbidden patterns, the ticker scan, the number rule, no service promise a service promise → that… |
| X-15 | the reply stands when the goal's own proposal is dropped | `thesisSchema.js` | KILLED | 1 / 43 | thesisSchema.test.js › rule 3 — every written line: forbidden patterns, the ticker scan, the number rule, no service promise fewer than two segments … |
| X-16 | a theme suggestion lands over a set theme | `thesisSchema.js` | KILLED | 1 / 43 | thesisSchema.test.js › each goal lands only its own proposals a theme suggestion is not taken when the card has a theme |
| X-17 | SI-3: a frame requestId answers a builder session | `store.js` | KILLED | 1 / 32 | shared-research.builder.route.test.js › own words open at once (§B4.1, DR-6) a retried requestId finds its session and writes nothing; a framing's re… |
| X-18 | a ledger view gains a shape key | `session.js` | KILLED | 1 / 76 | shared-research.builder.route.test.js › the shape stamp (§B2; §B10 S-B2; K-2) builder mode 'off': a story opens as today's ledger — no shape, no card… |
| X-19 | PF-2: a module that names researchWork deletes | `store.js` | KILLED | 1 / 7 | thesisRecord.census.test.js › PF-2 — nothing deletes or prunes a research record or its findings no module that names the collection makes a delete, … |
| X-20 | PF-1: a second module names thesisCard | `companies.js` | KILLED | 1 / 7 | thesisRecord.census.test.js › PF-1 — thesisCard has one writer, the save transaction the field's name is written in code in exactly one module: the c… |
| X-21 | the schema goes over the union-type limit | `thesisSchema.js` | KILLED | 1 / 43 | thesisSchema.test.js › the schema (§B4.2) stays inside the API's schema limits: fewer than 16 union-type parameters (13), no optional parameter |
| X-22 | build_why is offered without names | `thesis.js` | KILLED | 3 / 74 | thesis.test.js › the goals on offer (§B4.2 — each goal's offer rule) own words, theme set: map the segments (and direction) |
| X-23 | a point against with no finding is kept | `thesisSchema.js` | KILLED | 1 / 43 | thesisSchema.test.js › rule 2 — the point against needs a current finding a point against with no finding is dropped; the why stands with none ("No p… |
| X-24 | find_names never blocks | `thesis.js` | KILLED | 2 / 106 | shared-research.builder.route.test.js › a step only proposes (V2-4) the dead end: find_names with no supported company blocks the names; the free cho… |
| X-25 | price lines survive a names change | `thesis.js` | KILLED | 2 / 74 | thesis.test.js › the transitions and dependencies (§B3, §B4.3; §B10 S-B4) changing the segment clears the names, the why and the price lines; the map… |
| F-01 | RA-1: the shared reason's numbers are not re-checked at confirm | `thesis.js` | KILLED | 1 / 200 | reviewB3.test.js › RA-1 / RB-6 — what a save states is checked, the composed sentence included a confirm re-checks the shared reason against the KEPT… |
| F-02 | RA-1: the shared reason may name a deselected company | `thesis.js` | KILLED | 1 / 200 | reviewB3.test.js › RA-1 / RB-6 — what a save states is checked, the composed sentence included a confirm refuses a shared reason that names a support… |
| F-03 | RA-1: the saved statement is not checked | `store.js` | KILLED | 2 / 200 | shared-research.builder.route.test.js › the review's route fixes (K-10; report §9) RA-1: a composed sentence whose segment states a figure no carried… |
| F-04 | RA-2: a replay is answered before the shape check | `store.js` | KILLED | 2 / 200 | shared-research.builder.route.test.js › the other shape is refused (§B2): invalid_intent, before any call is counted a builder session refuses a ledg… |
| F-05 | RD-2: a saved answer before the shape check (builder save) | `store.js` | KILLED | 1 / 200 | shared-research.builder.route.test.js › the other shape is refused (§B2): invalid_intent, before any call is counted a builder session refuses a ledg… |
| F-06 | RA-3: unset → set clears the dependents | `thesis.js` | KILLED | 1 / 200 | reviewB3.test.js › RA-3 — a free choice never silently clears a set part setting an unset segment (or skipping it) keeps the names, the why and the p… |
| F-07 | RA-3: drop_unsourced offered over a set why | `thesis.js` | KILLED | 1 / 200 | reviewB3.test.js › RA-3 — a free choice never silently clears a set part drop_unsourced is offered only while the why is not set |
| F-08 | RB-1: a figure-less price forecast passes | `thesisWords.js` | KILLED | 3 / 200 | reviewB3.test.js › RB-1 / RB-2 / RB-3 — the builder's own wording (builder lines only; B1's checks are untouched) a forecast, praise or odds: "its st… |
| F-09 | RB-2: the builder's promises pass | `thesisWords.js` | KILLED | 5 / 200 | reviewB3.test.js › RB-1 / RB-2 / RB-3 — the builder's own wording (builder lines only; B1's checks are untouched) a promise: "Your thesis will be tra… |
| F-10 | RB-3: "trades lower" passes as a wrong-if option | `thesisWords.js` | KILLED | 1 / 200 | reviewB3.test.js › RB-1 / RB-2 / RB-3 — the builder's own wording (builder lines only; B1's checks are untouched) a price condition: "NVDA trades low… |
| F-11 | RB-4: a names pick is narrowed | `thesisSchema.js` | KILLED | 3 / 200 | reviewB3.test.js › RB-4 — a names pick is dropped, never narrowed "NVDA, AMD and Broadcom" → dropped |
| F-12 | RB-5: the dead end ignores a company sourced since | `thesis.js` | KILLED | 1 / 200 | thesis.test.js › the goals on offer (§B4.2 — each goal's offer rule) find_names: theme set and segment set or skipped; not while the dead end stands … |
| F-13 | RB-5: a dead-end reply naming a company stands | `thesisSchema.js` | KILLED | 1 / 200 | reviewB3.test.js › RB-5 — the dead end is honest end to end a find_names reply that names a company when none is supported is replaced, with the dead… |
| F-14 | RB-7: the reply is checked before it is cut | `thesisSchema.js` | KILLED | 2 / 200 | reviewB3.test.js › RB-7 — the reply is cut at a sentence, before B1's number check, and stays within 600 with the server's line a held figure is neve… |
| F-15 | RB-8: a free tap during a running step | `store.js` | KILLED | 1 / 200 | shared-research.builder.route.test.js › the review's route fixes (K-10; report §9) RB-8: a free tap waits for a running step (409 step_in_flight), no… |
| F-16 | RA-6: no cap on card exchanges | `store.js` | KILLED | 1 / 200 | shared-research.builder.route.test.js › the review's route fixes (K-10; report §9) RA-6: a session keeps at most 300 card exchanges; past it the free… |
| F-17 | RC-1: a validator throw escapes the step | `shared-research.js` | KILLED | 1 / 200 | shared-research.builder.route.test.js › the review's route fixes (K-10; report §9) RC-1: a validator that throws after a paid call fails the step, lo… |
| F-18 | RC-1: a malformed field is read as given | `thesisSchema.js` | KILLED | 2 / 200 | reviewB3.test.js › RC-1 — a malformed proposal field is dropped, never thrown on {"segments":{"label":"x"}} |
| F-19 | RC-3: a reply stands when everything it proposed was dropped | `thesisSchema.js` | KILLED | 1 / 200 | reviewB3.test.js › RB-5 — the dead end is honest end to end a reply stands only while something it proposed landed (RC-3: a strengthen whose only pro… |
| F-20 | RA-1 E: a stale segment does not block the save | `thesis.js` | KILLED | 1 / 200 | reviewB3.test.js › RA-1 / RB-6 — what a save states is checked, the composed sentence included a stale segment blocks the save until it is changed: t… |
| F-21 | RB-9/RA-5: the card always reads as changed | `thesisSchema.js` | KILLED | 4 / 200 | reviewB3.test.js › RB-5 — the dead end is honest end to end a reply stands only while something it proposed landed (RC-3: a strengthen whose only pro… |
| F-22 | B1's service promise no longer replaces a builder reply | `thesisSchema.js` | KILLED | 1 / 200 | thesisSchema.test.js › the reply (K-4) a reply with a service promise is replaced by the plain line |

Totals: KILLED 62 of 62 defined.

## 11. The review (BUILD_RULES §2; K-10)

The branch passes the threshold (31 files, ~5,200 lines). One round, as K-10 sets: four lenses on four read-only `git archive` snapshots of `1ecf712d` (each with `node_modules` junctioned in), then two refuters on two fresh snapshots of the same head, each told to refute every finding with a concrete repro. The brief and the findings are kept in `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B3/review-evidence/`. No reviewer wrote to git or to this worktree.

| Lens | What it covered | Result |
|---|---|---|
| (a) Record and card integrity | transactions, idempotency, `rev`, dependencies and S-B4, derived states, the adopt refactor (a 10-scenario differential against `main`'s `adoptIdea`: identical answers, writes and documents), the builder save, PF-1, PF-2 | 8 findings (RA-1..RA-8) |
| (b) Honesty | no part set by the model, rules 1–6, numbers, tickers, wording, the reply line, the dead end, the edited statement, S-B3 labels, masking (31 repro rows) | 10 findings (RB-1..RB-10) |
| (c) Cost and gates | the free action, ceilings and refunds, refusal before counting, the flag off through every body shape, the pick's no-search, the shadow log, the prompt budget (34 repro rows) | 3 findings + 5 watch (RC-1..RC-3, W1–W5) |
| (d) Compatibility | a ~60-request differential of the ledger against `main`'s route and modules (answers with key order, documents, reads/writes, shadow records, prompts, retrieval arguments: byte-identical), no protected file touched, goldens and prompt pins, the client bundle of every `src/` importer (identical), census and guard tests | 3 findings (RD-1..RD-3) |

**Refuters.** R1 took RA-*, RD-* and RC-2; R2 took RB-*, RC-1, RC-3 and RC-W*. Verdicts on 27 items: **20 CONFIRMED** (some wider than stated), **6 PARTLY**, **1 REFUTED as a defect** (RB-9). No finding broke a STOP-list line in the sense of a ledger request a ledger client sends; RB-7 was raised to must-fix by the letter of "no ticker the universe does not hold" (a cut could leave "MET" from "META").

### 11.1 Findings, verdicts and what was done
| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| RA-1 / RB-6 | the composed sentence was never checked at save; a confirm kept a shared reason whose number (or a dropped company) only a dropped reason held | CONFIRMED, must-fix | **Fixed** `21125b62`: a why confirm/set re-checks the shared reason against the KEPT reasons (`thesis.js` `sharedIssueOf`); the save checks every statement — composed or edited — by one rule (`saveIssueOf`: carried Source-backed facts plus the card's own texts, the theme included; no deselected company); `thesis.saveIssue` shows it before Save; a stale segment blocks the save |
| RA-2 / RD-1 / RC-2 | a replayed stepId was answered in the other shape before the shape check | CONFIRMED (R1: should-fix) | **Fixed**: `beginStep` takes the route's shape and refuses the other shape first, before a replay; the goal check stays after it (a real replay of a goal no longer on offer still answers) |
| RD-2 | a saved answer in the other shape before the shape check | CONFIRMED, nit | **Fixed**: the shape check precedes `savedAs` in `adoptIdea` and `adoptThesis` |
| RA-3 | `set segment 'skip'` on an unset segment cleared set names, why and price lines; `drop_unsourced` offered over a set why | CONFIRMED (a), PARTLY (b) | **Fixed**: unset → set clears nothing; `drop_unsourced` only while the why is unset, with `clears` |
| RA-4, RA-5, RB-8 | races between a running step and a free tap (a dead end landing on another segment, a reply/`changed` describing a proposal that did not land) | CONFIRMED, nits | **Fixed**: `card` answers 409 `step_in_flight` while a step runs; `changed.card` and the plain line come from what lands |
| RA-6 / RC-W1 | `card` exchanges unbounded per session (1 MiB) | CONFIRMED, watch | **Fixed** (cheap): at most 300 per session (`invalid_card` / `too_many_changes`) |
| RA-7 | ready but the save refuses `too_many_evidence_refs` | CONFIRMED, watch | **Surfaced**: `thesis.saveIssue` carries it before Save |
| RA-8 | an own-words retry after the mode rolls back answers `invalid_entry` | CONFIRMED, nit | Watch (§12) |
| RD-3 | the B1 allowlist note still described the moved transaction | PARTLY, nit | **Fixed**: the note points at `commitAdoption` |
| RB-1 | figure-less forecasts, praise and odds in words passed (B1's patterns need a figure) | PARTLY (R2: watch by the letter) | **Fixed builder-side** (`thesisWords.js` `BUILDER_FORECAST`), B1's list untouched — rulebook §6 forbids them |
| RB-2 | the builder's promises ("will be tracked", "will alert you") passed | CONFIRMED | **Fixed builder-side** (`builderPromiseOf`) on every line and the reply; B1's `promisesService` unchanged (extending it would move KB ledger answers — R2 showed it) |
| RB-3 | price conditions missed | PARTLY (a verb-anchored fix collides with business conditions) | **Fixed noun-anchored** + five collision controls (`8f31d4f5`) |
| RB-4 | a names pick narrowed instead of dropped ("NVDA, AMD and Broadcom" → [NVDA, AMD]) | CONFIRMED, wider ("NVDA, AMD." → [NVDA]) | **Fixed**: a trailing period is read; any other unresolved token drops the pick |
| RB-5 | a dead-end reply naming a company stood; `blocked` stayed after a company was sourced | CONFIRMED (a), PARTLY (b) | **Fixed**: the dead end is derived from the record; a dead-end reply naming a listed company is replaced with the dead-end line; an honest dead-end reply stands (pinned) |
| RB-7 | the reply was cut to 600 after B1's number check (a held "1,200" → "1,20"; "META" → "MET") | CONFIRMED, must-fix by letter | **Fixed**: cut at a sentence's end before B1's checks; with the server's line it stays within 600 |
| RB-9 | routine 15's "The card did not change." was not emitted | REFUTED as a defect (it would have been false) | **Built true**: the sentence is emitted only when the card did not change |
| RB-10 | the label's "30" licenses "30%"; an edit may drop the wrong-if; the time-frame reason checked record-wide | CONFIRMED, watch | Watch (§12) — the letter of §B4.5 and routine 14 |
| RC-1 | a validator throw after a paid call answered a bare 500, unlogged, the step left running | CONFIRMED (unreachable under the grammar) | **Fixed**: malformed fields are dropped; a throw fails the step, logged and released |
| RC-3 | `strengthen` on theme/time frame can land nothing; the reply could still claim a change | PARTLY | **Fixed** the reply (it stands only while something it proposed landed); the offer stays the §B4.2 letter (watch) |
| RC-W2..W5 | unguarded awaits (B1 has the class), the 2,500-token output cap, free taps share the POST window, a framed open on a builder id replays the builder view | CONFIRMED, watch | Watch (§12) |

All fixes have rows (`api/_utils/sharedResearch/reviewB3.test.js`, the builder route test's "review's route fixes" block) and mutants F-01..F-22, all killed on the final tree (§10). Lens D's ledger differential was re-run on the final tree too (§8).

## 12. Watch on the allowlist

None of these is a defect against the amendment's letter. Each is something to watch when the builder goes on for the allowlist, or a candidate for a later round.

| # | What | Why it stands | When it matters |
|---|---|---|---|
| W-1 | **A segment label holding a figure** ("Liquid cooling, 40% of spend") goes into the composed sentence, but the carried list follows §B4.5's letter: each name's relationship fact, every reason's findings and the point against's. It does not carry the segment's own findings, so Save refuses the figure (`unsupported_assertion`). `thesis.saveIssue` shows this before Save, and an edit or another segment clears it. | §B4.5 names what is carried; the segment is not in it. | **Recommend:** carry the chosen segment's findings too, and rule it in B4's round. |
| W-2 (RB-10) | (a) The time frame's label ("about 30 sessions") lets "30%" pass in an edited statement. (b) An edit may drop the wrong-if from the sentence; the card keeps it in words and V2-5 saves it inside the sentence. (c) The time-frame suggestion's reason is number-checked against the whole record, because the schema gives it no refs. | Each follows the letter of §B4.5 and routine 14. | If edited statements drift in the allowlist's saves. |
| W-3 (RC-3) | `strengthen` is offered for names, the time frame and the theme, where all it can land is new findings. | §B4.2 offers `strengthen` on any part. The reply is honest ("The card did not change."). | If players spend steps on it. |
| W-4 (RA-8) | An own-words open retried after the mode rolls back to `'off'` answers `invalid_entry`, not the session it made. | A rollback is the founder's act. The session stays open and loads by its id. | Only during a rollback. |
| W-5 (RC-W2) | Unguarded awaits sit between a counted call and `failStep` (`companiesBefore`). | B1 has the same class. A throw there leaves the step to the stale-running rule (about 35 s). | If Firestore reads fail mid-step. |
| W-6 (RC-W3) | The 2,500-token output cap is shared with the larger builder schema. | The probes will show the real size. A cut answers `output_cut_off` through B1's path. | Re-check after the probe re-run. |
| W-7 (RC-W4) | Free taps share the per-uid 10 POST a minute window with steps. | It is B1's gate unchanged. A burst of taps answers `429` briefly. | If the B4 client batches taps. |
| W-8 (RC-W5) | A framed `open` that names a builder session's id replays the builder view. | The answer is honest about the shape, and the request is unusual. | Never, from a correct client. |
| W-9 | `thesisCard` is a cross-chat contract. The Practice Field and framework chats read this name and the shape in §4.4. | §B10 S-B1, PF-1. | Before either reads it. |

## 13. Cleanup

- **WSL**, under `flock /tmp/pd-suite.lock`. Three paths were removed:
  - `~/pd-ci-srb3`, the branch tree (852 MB, with its private `npm ci`);
  - `~/pd-ci-srb3m`, `main`'s tree (190 MB; its `node_modules` symlink was unlinked first);
  - `~/pd-srb3-runs`, the logs, JSON reports and dist copies (125 MB).

  `git -C ~/pd-ci worktree prune` was run after. **Freed: 1,194,648 KB (1.14 GiB) by `df`.** No other session's tree was touched: `~/pd-ci` and its other 46 worktrees are listed the same before and after.
- **Windows scratchpad.** Seven read-only review snapshots were deleted (four lenses, two refuters and the final differential), 1.06 GB of files. Each `node_modules` junction was unlinked with `rmdir` first; the real `node_modules` is intact.
- **Kept** in `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B3/review-evidence/`: the review brief and findings, lens D's ledger differential harness, the mutation scripts and the final battery's JSON.

## 14. The PR description

### Shared Research "Work an idea": B3, the thesis builder's server (dark)

This is the server half of Amendment B (§B2–§B6) plus the founder's preamble rulings (§B10, appended to the amendment on this branch). It ships behind `SHARED_RESEARCH_BUILDER_MODE = 'off'` (`src/config/sharedResearchFlags.js:76`), so at `'off'` no request reaches a builder path. The ledger is byte-for-byte unchanged.

Full report: `docs/audits/20261116_BUILD_SHARED_RESEARCH_B3.md`.

#### What a builder session is
- **Opening.** A session opens from the player's own words (new), or from a story or a drop while the switch is `'on'`. It is stamped `shape: 'builder'`. A ledger session gets no stamp; absence reads as ledger (§B10 S-B2).
- **Research steps.** `step` with `intent: 'build'` and one of seven goals: verify_source, map_segments, find_names, build_why, strengthen, pick, direction. The server offers the goals. A step only *proposes*.
- **The free action.** `card` (`confirm` / `set` / `clear`) is the only thing that sets a part of the thesis card. It makes no model call and counts no step, it is idempotent on `opId`, and each applied op leaves one `card` exchange (R-21).
- **Save.** `adopt { rev, statement? }` saves the composed sentence or the player's edit as idea version 1, through B1's save mechanics (now `commitAdoption`, moved unchanged). The list also carries the card as **`thesisCard`**; `thesis` stays `''` (§B10 S-B1). The card is written once, in the save transaction (PF-1). Its finding ids resolve on the research record, which nothing deletes or prunes (PF-2).
- **The `thesis` view.** Every builder answer carries `thesis`: parts with derived states, Atlas's pick, ready and blockers, the sentence, `saveIssue`, and the choices. The contract is report §4.

#### Changes
- **New:**
  - `api/_utils/sharedResearch/thesis.js` (the card, pure);
  - `thesisSchema.js` (the builder turn's schema and validator; B1's checks run first);
  - `thesisWords.js` (the builder's own wording rules);
  - `scripts/sharedResearch/probeBuilder.mjs` and its fixture.
- **Edited:**
  - `api/forge/shared-research.js` (builder branches; the `card` action);
  - `store.js` (`commitAdoption`, `adoptThesis`, `openOwnWords`, `applyCard`; the card inside `recordStep`'s transaction);
  - `stepPrompt.js` (the builder prompts; rulebook §6 in `docs/design/SHADOW_VOICE_RULES_V1.md`, pinned byte for byte);
  - `session.js`, `adoptPreview.js`, `copy.js`, `gate.js`;
  - `stepSchema.js` (one `export`);
  - `src/constants/sharedResearch.js`, `src/config/sharedResearchFlags.js`;
  - `compositionProtectedStoresAllowlist.json`.
- **Not touched:** no fenced file, rule, index, KB loader, research record model or idea version builder; nothing under `src/components/`; no new model id.

#### Checks (on `583e9dbb`, the branch merged with `origin/main` `bd4f0a95`)
- **Full suite** (WSL, `TZ=UTC`, 8 workers, under the suite lock): exit 0. 1,548 files passed, 12 skipped (1,560); 34,913 tests passed, 135 skipped (35,048).
- **`lint:gate`** exit 0. **`test:rules`** exit 0 (45 files, 810 tests). **Minified build** exit 0.
- **Bundle against `main`:** every shipped `.js`, `.css` and `.html` file is byte-identical. Only source maps differ, by build-tree paths and the embedded text of the two `src/` files.
- **Ledger unchanged:** existing tests are untouched (two flag test files gained rows or a note only). The review's ~60-request ledger differential, re-run on the final tree, is byte-identical. B1's recorded probe validates.
- **Mutations:** 62 of 62 killed, covering §B6's twelve, the build's 25 and the review fixes' 22.
- **New rows:** 229 in 7 files.

#### Review (one round)
Four lenses ran on read-only snapshots: integrity, honesty, cost and gates, compatibility. Two refuters followed. Of 27 items, 20 were confirmed, 6 partly and 1 refuted. Every in-scope finding is fixed with rows and mutants (`21125b62`, `8f31d4f5`, `899abd14`). The rest are on the report's watch list (§12).

#### For the founder
- **The probes (K-8) stopped.** Both calls were refused `400` before any output ($0.00). The likeliest cause is the schema's 16 union-type parameters, now 13 and pinned. **The re-run (two calls, under $0.10) waits for your go-ahead** (report §6).
- **Recommend for B4's round:** carry the chosen segment's findings at save, so a label with a figure can be saved (watch W-1).
- No other ruling is open.

Dark. Never merged by the session. B4 (the client) is the next session.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

