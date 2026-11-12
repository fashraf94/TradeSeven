# Film Room Build C spec V1 — the Film Room in the idea loop

**Date:** 12 Nov 2026 · **Author:** the Film Room chat (Fable) · **Status:** rulings BC-1 to BC-8 approved by the founder on 12 Nov 2026 ("yes to all"); the build packages await their prompts. · **For:** the Film Room's builds C1, C2 and C3; the Practice Field chat (one reply, §13); Astra, for the reviews.
**Rests on:** Practice Field concept V6.1 (12 Nov) and shared contract V2 (12 Nov); the Film Room Build B spec V1 with Amendments A–L; the screen rules R1–R15 (spec V1.2 Amendment E); the situation registry v2; Growth Loop Map V1.2; ID-1 (activation evidence, on at `main` `c37baa0d`).
**Checked against:** `main` at `c37baa0d` (the #1044 merge): `api/_utils/filmRoom/cardStore.js`, `api/film-room/card.js`, `api/_utils/filmRoom/cardCounter.js`, `src/screens/filmRoomV2/FilmRoomCardRegions.jsx`, `src/data/situationRegistry.js`, `src/data/situationQuestions.js`, `api/_utils/filmTape/tapeTags.js`, `api/_utils/activationEvidence/pointer.js`, `api/_utils/setupEvaluator/tfSetupV1.js`, `api/_utils/mandateSchema.js`, `firestore.rules`.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md`, carried by C1's docs commit. No docs-only PR. Project copy `claude/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_NOV12_2026.md`.

## 0. In plain terms

The idea book (concept V6.1) is where the player's agent tests ideas. The Film Room's part in that loop is three things: it is the loop's **evidence source** (the tape, read in bounded excerpts by the agent's drafting call), it is where the player **offers a moment** to the agent (a card becomes a nomination), and it is the **chain of record** for that moment: what happened in the game, what the player asked, what the agent made of it, what the idea became, how it ended, and whether anything was equipped. The Film Room judges none of it. Where the chain needs a "why", it is the agent's, quoted and dated.

## 1. The rulings (approved 12 Nov 2026)

| Id | Ruling |
|---|---|
| **BC-1** | **Facts only stays.** The Film Room's own voice states recorded facts, computed situations and counts. The "why" belongs to the agent: its recorded rationale at the time (already on the tape), its reason when it considers a nomination, and its thesis on the idea. All three are shown as attributed quotations with their time (R7), never rewritten. |
| **BC-2** | **Shared contract V2 §7 is the Film Room's job**, with the asks in §13 sent back once. |
| **BC-3** | **The Offer route replaces Practice.** It shows only when the owner's book exists. `nominate` works on any open card, so a Watch card that has recurred can be offered later. The old route's sentence ("The Practice Field opens later…") goes. |
| **BC-4** | **The receipt is the chain view**, end to end (§5). |
| **BC-5** | **The moment excerpt is Film Room-owned** (§6): the bounded, attributed projection the drafting call reads, registered in the honesty registry, with the one-door exception stated in code. |
| **BC-6** | **Situations, in order:** `thesis_broken`, `sold_and_ran`, `idea_name_untraded`. `down` and `good_lead` wait for the multi-day format. |
| **BC-7** | **A per-nomination consideration call** is recommended to the Practice Field chat: one bounded model call at nomination, inside the book's spend bound, so the agent's reason reaches the receipt within minutes rather than at the next refill. The Practice Field decides; the Film Room renders either way. |
| **BC-8** | **Order:** C1, then C2 with the Practice Field's T1b, then C3. C1 folds the four B2.1 rulings and ends with one QA pass and the `'on'` flip. |

## 2. Vocabulary

| Word | Meaning |
|---|---|
| Card | A moment the player took home, with a question, a note and a route (Build B) |
| Nomination | The player's offer of a card to the agent; a record in the book (`mandates/{bookId}/nominations`), with its own states |
| Idea | The agent's test in the book, one sub-ledger (contract V2 §4) |
| Result | The idea's five-column record |
| Chain | The receipt's view of one card from filing to install |
| Excerpt | The bounded tape facts a moment carries into the agent's drafting call |

## 3. The ledger: stage vocabulary v2

`CARD_STAGE_VOCAB_VERSION = 2`, exported beside `CARD_SCHEMA_VERSION` and `CARD_SLOTS_VERSION`. Every entry written from C1 on records `stageVocabVersion: 2`; entries without it read as v1 and are never rewritten.

**Stages:** `card → nominated → testing → tested → installed → retired`. `drilled`, `drafted` and `proven` were never written and are dropped before anything writes them.

| Stage | Written by | When |
|---|---|---|
| `card` | the card endpoint, the player | at create |
| `nominated` | the card endpoint, the player (`nominate`, or a create with the Offer route) | when the nomination record is written, in the same transaction |
| `testing` | the Practice Field's server, through the ledger's transition helper | at the idea's first executed fill, never at acceptance |
| `tested` | the same | at any terminal result, `inconclusive` and `abandoned` included, with the result reference |
| `installed` | the same | when a Forge offer from this card's idea is accepted |
| `retired` | the card endpoint (the player), or the server when the idea is retired without an offer | as today |

**New fields on the entry,** each written once by the transition that sets it: `nomination: { bookId, nominationId, state, reason, consideredAt }` (the state and reason are copied onto the entry at each nomination transition so the receipt reads one document); `idea: { bookId, ideaId }`; `result: { ideaId, resultRef, contractCondition, economicResult }`; `offer: { offerId, state }`; `parkedAt`. `stageHistory[].by` gains `'server'` beside `'player'`, with the writer named.

**Counting (S9):** `card`, `nominated` and `testing` count as open. `tested` counts until `parkedAt` is set or the card is retired. **Parking** is the player's, from the receipt, once a result is shown ("Park this card"); it writes `parkedAt` and nothing else. A separate limit for parked cards is not set.

**Shelving** stays computed at read from the archetype. A shelved card whose idea is still running still receives `testing`, `tested` and `installed` through the server's transition helper, which is bound to the idea's original run and the entry's owner and never grants adoption to the new archetype (contract V2 §7).

**Readers that migrate together,** history never rewritten: `CARD_STAGES`, `OPEN_STAGES`, `isOpen` and the retire transition in `cardStore.js`; the open count and the cap in `cardCounter.js`; the screen's open-stage list and grouping (`filmRoomCards.js`, `FilmRoomCardRegions.jsx`); the labels (`filmRoomCopy.js` `stageWords`); the harness fixture's count; the rules test `filmRoomCardAttribution.rules.mjs`; the card endpoint's ops. A test pins the stage list and the open set in every reader to the one export.

## 4. The `nominate` op

`POST /api/film-room/card` gains `{ op: 'nominate', opId, agentId, entryId, expectedVersion }`.

**Preconditions, in order, each with its refusal:**
1. cards mode admits the caller (as every op).
2. the entry is the caller's, under the attribution agent (403 `forbidden`; RK-1).
3. the entry is at `card`, not shelved (409 `illegal_transition`); a replay of the same op id is the idempotent answer.
4. **the owner's book exists** for that attribution agent, with `status: 'active'` (409 `book_not_open`, the body naming nothing of any book). The lookup is one read through a Practice Field helper (`bookForOwner(db, { uid, attributionAgentId })`, T1a's), never a client-side guess.

**The write, one transaction:** the nomination record in `mandates/{bookId}/nominations/{nominationId}` (`queued`, the source reference `{ kind: 'film_room_card', entryId, situationId, questionId, questionVersion }`, `queuedAt`, `expiresAt` per B6), and the entry's stage `nominated` with `nomination: { bookId, nominationId, state: 'queued' }`, `version + 1`. The record's shape is contract V2 §5.2's; the Practice Field's helper builds it so one writer owns the shape.

**A create with the Offer route** does the same in its own transaction: the entry is written at `nominated` with the nomination beside it. Precondition 4 applies; with no book the form never offers the route (§5).

**Later transitions** (`considered`, `accepted`, `deferred`, `declined`, `expired`) are the Practice Field's writes. Each copies its state, reason and time onto the entry's `nomination` field through the ledger's transition helper, so the Film Room reads one document and the honesty of the copy is the helper's test.

**The route list changes:** `CARD_ROUTES` becomes `['watch', 'offer', 'set']`. `'drill'` is read as `'offer'` for stored entries (none exist in production) and is never written again.

## 5. The screen: the chain

**The form.** Routes: Watch, Offer (only when the counter reports the owner's book as open: `counter.book: { open: true }`), Set. Offer's note: *"Your agent considers this moment at its next chance. It may take it, defer it or decline it, and says why."* With no book, the form has Watch and Set, and nothing else is said.

**The receipt** shows the chain for the card, newest state first, each state as one line with its time:

| State | The line (own voice) | The quotation beside it |
|---|---|---|
| filed | "Filed · {date}" and the card's facts | the note, "— you" |
| offered | "Offered to your agent · {date}" | — |
| considered: deferred / declined | "Deferred" / "Declined · {date}" | the reason, "— your agent, {date}" |
| considered: accepted | "Taken into an idea · {date}", with a link "Open the idea" | the thesis, "— your agent, {date}" |
| expired | "Not considered within {n} sessions" (n from B6, derived) | — |
| testing | "Testing · from {date}" with the idea link | — |
| tested | "Tested · {date}": the contract condition and the economic result as the result's own words (`met` / `breached` / `unobserved`; `ahead` / `behind` / `within band` / `unmeasurable`), with a link to the result | the agent's closing note, "— your agent, {date}" |
| offered at the Forge | "An offer waits in the Forge" with a link | — |
| installed | "Equipped · {date}" | — |
| parked / retired | as today's state notes | — |

Rules: every number carries its class; the Film Room renders the result's words exactly as the record stores them and never says "validated", "proven", "supported", "right" or "wrong"; a link opens the book's screen or the Forge through App's existing doors (no new door); a card from another day keeps RG-5's sentence alone, as today. "Park this card" appears on a `tested` receipt and is the only new button.

**The subject line** (from C2's excerpt) sits under the card's facts on the form and the receipt: "{SYM} · {sector} · under your idea '{statement, first 60 code points}' v{n}", each part recorded (R) and shown only where the tape holds it; no sector or idea is guessed.

**Since last time** keeps Watch cards and recurrences. It adds one line per nominated card whose state changed since the player's last visit, in the receipt's words.

## 6. The moment excerpt (C2)

A read-only projection, `api/_utils/filmRoom/momentExcerpt.js`, `excerptOf(db, { uid, attributionAgentId, battleId, etDate, moment })`, answering only the owner's own tape. Bounded fields, each with provenance (`recorded` from the tape's class; `quoted` for the agent's or the player's words), and nothing else:

| Field | Source | Bound |
|---|---|---|
| `symbol`, `situationId`, `situationVersion`, `from`, `to`, `checks` | the moment | — |
| `sector` | the symbol directory (`TICKER_TO_SECTOR`, as `candleInputs.js` uses it) | one word; absent when the directory lacks it |
| `idea` | the day's `calls[].hypothesisRef` (`watchlistId`, `hypothesisVersion`) and the version's `statement` | the statement, 280 code points; absent without a carried idea |
| `rationale` | the tape's `rationale[]` row at the moment's first check, or the nearest earlier one | `hypothesis` and `rationale`, 600 code points, quoted |
| `directive` | the day's `directives[]` row whose heard check falls in the moment | `playerText` and `canonicalText`, 400 code points, quoted |
| `meeting` | the day's `meetings[]` row whose life holds the moment | outcome, legs, the diagnosis 400 code points, quoted "— the platform" |
| `exit` | the `actions[]` row that ends the run, if one does | mechanism, exit reason, the sold and bought symbols, the exit price (R) |
| `afterExit` | the sold symbol's series after the exit | the last recorded bar's close and its time, and the bar count after the exit (R); absent when the series has none |
| `count` | `stalled`'s count at the last check, or the situation's own measure | the number and its basis (R or D) |
| `recurrences` | the counter, for a Watch card | the count and the days (D) |
| `card` | the player's card, when the excerpt is for a nominated card | question text, note (quoted "— you"), route, filed date |

**No raw ids reach a prompt:** the excerpt carries opaque local labels for the battle, the idea and the card; the Practice Field's assembler resolves them server-side (contract V2 §5.1). **Nothing is inferred:** no sector, idea, cause or verdict is added where the tape holds none. The excerpt's shape is versioned (`MOMENT_EXCERPT_VERSION = 1`) and a golden pins it.

**One door, stated.** The one-door census (`oneDoor.census.test.js`) keeps every existing root forbidden from the ledger. It gains one explicit exception: the Practice Field's drafting assembler (the path the Practice Field names in its reply, §13) may import `momentExcerpt.js`, and through it read `plays` for the owner's own cards. The exception is a named entry with the contract's section beside it; any other path reaching the excerpt fails the census. Acceptance C gains a row the Practice Field's T2 runs: the battle and draft prompts byte-identical with a populated ledger and a populated book.

## 7. Situations (C3)

The registry goes to version 3. Each situation is additive, tagged by the close pass from its first deploy, and reaches past days through a `refresh=1`. Each has a question menu of two or three questions in the player's framing, outcome-free (RG-6), with the Watch, Offer and Set routes; Set says "No setting changes this situation for this archetype." where none does.

**`thesis_broken` (v1).** Per holding, per check, for an agent whose archetype has a rule set (the Trend Follower today). The holding check is the setup evaluator's own (`evaluateTfHolding`, `HOLDING_CHECKS`: `close_below_slow`, `structure_break`, `regime_flip`), run on the evidence as of the last completed session before the check, with the anchor from the holding's activation pointer (`agentBattles/{battleId}/activations`, `anchorSwingLow.value`; `provenance: absent` reads `unknown`). The holding is tagged when at least one check reads `broken`; `unknown` never tags, and the item records which checks read what. A candidate's entry verdict never tags a held name (Amendment A, A6). No slot: the thresholds are the rule set's. The item carries `ruleSet` and the evaluator's verdict words as recorded.
- Questions: "What should a holding do once its chart leg breaks?"; "Whose call is it to hold a name through a break?"; "Was the break already in view when the name came in?"

**`sold_and_ran` (v1).** Per exit. The sold symbol's series after the exit holds at least S3a bars, and its last recorded close is at least S3b above the exit price (the `actions[]` row's `exitPrice`, R). Where the series holds fewer bars, or the exit price is unrecorded, the exit is not tagged and the coverage note says so. The moment is the run from the exit's check to the day's last check. Slots, in `situationRegistry.js`: **S3a** = 6 bars (one hour of 10-minute bars); **S3b** = 2%. Founder slots; proposed values.
- Questions: "What would it have taken to stay in {SYM}?"; "Whose call was the exit?"; "Was the replacement ready, or was the exit the point?"

**`idea_name_untraded` (v1).** Per battle day with a carried idea (`agentContext.equippedHypothesis` present). A symbol on the battle's frozen equipped list (`agentContext.frozenLayers.equippedWatchlist`) that no check holds and no swap brings in during the day. The moment is the day's span for that symbol; the count is the number of names untraded. Not tagged on a day with no carried idea, and never on a name the list didn't freeze.
- Questions: "What would have made {SYM} a buy for your agent?"; "Should the idea's list be shorter?"; "Was there room in the book?"

**`down` and `good_lead`** keep their reserved entries. Their definitions (a run of checks where the score gap to the opponent is beyond a threshold, S6–S8) are written with the multi-day format, where a run spans days.

## 8. The four B2.1 rulings (folded into C1)

| # | Ruling |
|---|---|
| 1 | **Grid tiles while loading or after a failed read.** The tiles show the loading line or the failure sentence. "No chart was recorded" appears only after a successful read with no chart. The grid's section line is unchanged. |
| 2 | **The meeting code.** Wherever the screen says a maker in words ("by the gameplan meeting"), no code follows. Where a panel shows the recorded exit reason as a labelled field, the code stays: there it is the record. |
| 3 | **A missing battle agent.** No link. The cautious reading stands. |
| 4 | **A real date that isn't one of the battle's days.** The Film Room ignores the day and opens the battle's default view, nothing marked. The navigation check stays as built. |

## 9. Access

| Record | Write | Read |
|---|---|---|
| the ledger's stage and the copied nomination, idea, result and offer fields | the card endpoint (player ops) and the ledger's transition helper (server), both server-side | the owner, through the counter |
| `mandates/{bookId}/nominations` | the card endpoint's `nominate` transaction, through the Practice Field's builder; the Practice Field for every later state | the owner (the book's rule) |
| the moment excerpt | — | the owner's own tape and cards only; the drafting assembler, as the one named exception |

No rules change for the ledger. The nominations subcollection's rule is the Practice Field's (owner read via the parent book's `userId`, write false), declared in T2.

## 10. Build packages

| Package | Delivers | Flag | Size |
|---|---|---|---|
| **C1** | §3 vocabulary v2 and the readers; §4 `nominate` and the Offer route, with `book_not_open` and the Practice Field's `bookForOwner` helper stubbed to "no book" until T1a lands; §5 the chain receipt, parking, the "since last time" lines; §8 the four rulings; this spec, verbatim. Then one QA pass on the allowlist, then `'on'`. | under `FILM_ROOM_CARDS_MODE` | medium |
| **C2** | §6 the excerpt, its golden, the subject line, the census exception, the honesty-registry entry. Built beside the Practice Field's T1b, which consumes it. | none (a read module); the subject line under cards mode | small to medium |
| **C3** | §7 the three situations, their questions, registry v3, the refresh named in the report. | the tagger (live for every tape); moments under cards mode | medium |

Each package: its own branch, its own PR, an Astra review, the full Linux suite in a git clone, the rules suite, `lint:gate`, `vite build`, the cards-off goldens, the census and acceptance C. Fences as Build B's: zero BUILD_RULES §1 edits; `agent-evaluate.js`, `casualClone.js`, the hub's code and `firestore.rules` untouched unless a package names a rule.

## 11. Acceptance cases

1. **C-VOCAB.** Every reader lists the same six stages and the same open set from one export; a v1 entry (no `stageVocabVersion`) reads and counts as before.
2. **C-NOMINATE.** A `nominate` on a `card`-stage entry writes the nomination record and the entry's stage in one transaction; a replay answers the same; a second `nominate` on the same entry is `illegal_transition`.
3. **C-NOBOOK.** With no book for the owner, `nominate` and an Offer-route create refuse `book_not_open`, write nothing, and the form shows no Offer route.
4. **C-OWNER.** A nomination keys the book of the attribution agent (the ranked parent for a clone battle), never the clone; another owner's entry is `forbidden`.
5. **C-COPY.** A Practice Field transition (`considered` with a reason; `testing`; `tested`) copies its state onto the entry through the helper; the receipt renders the reason as a quotation credited "— your agent" with its time, and the result's words exactly as stored.
6. **C-SHELVED.** A shelved card's idea reaching `tested` updates the entry through the helper; the card stays shelved and counts as the contract says.
7. **C-PARK.** Parking a `tested` card sets `parkedAt` and drops it from the open count; it cannot be parked twice; an open card cannot be parked.
8. **C-EXCERPT.** The excerpt for a fixture moment equals its golden; each quoted field is bounded; a tape lacking a field yields an absent field, never a guess; another owner's battle answers nothing.
9. **C-DOOR.** The census passes with the one named exception; a planted import of `momentExcerpt.js` from any existing root fails it; acceptance C holds with a populated ledger.
10. **C-SIT.** For each new situation: a fixture day tags where the definition says and nowhere else; `unknown` evidence never tags `thesis_broken`; an exit with five bars after it never tags `sold_and_ran`; a day with no carried idea never tags `idea_name_untraded`; a refresh re-tags a stored day once, then unchanged.
11. **C-OFF.** With cards off, the twelve goldens are unchanged except the declared items (§8's rulings 1 and 2).

## 12. Exit criterion additions (beside Build B's ten)

11. A stage, a nomination state, a result word or an offer state appears on screen that the ledger or the book does not hold, or in other words than theirs.
12. The excerpt carries a field the tape doesn't hold, exceeds a bound, or reaches another owner's data.
13. A model path other than the named exception reaches the ledger or the excerpt.
14. A situation tags from `unknown` evidence, or from a fact the tape doesn't record.

## 13. The reply to the Practice Field chat (sent once, with this spec)

> **Film Room → Practice Field chat, on shared contract V2 (12 Nov).** Adopted as the Film Room's job; Build C spec V1 is the Film Room's side. Four points of fact and one recommendation:
> 1. **No book yet.** Nominations need a book, and most players have none until T1f. The Film Room shows the Offer route only when the owner's book exists and refuses `nominate` with `book_not_open` otherwise. Please add a `bookForOwner(db, { uid, attributionAgentId })` read helper to T1a's scope and name its path.
> 2. **One transaction.** The Film Room's card endpoint writes `plays/{id}.stage = nominated` and the nomination record together, through a Practice Field builder for the record's shape (`buildNominationDoc`). Later nomination states are yours and copy their state, reason and time onto the entry through the ledger's transition helper (`cardStore.js`, C1). Please confirm the split, and name the `nominations` rule in T2.
> 3. **`parkedAt`** is set by the player from the receipt, once a result is shown. Confirm, or name another writer.
> 4. **§7's reader list** should add `cardCounter.js`'s open count, the harness fixture and `filmRoomCardAttribution.rules.mjs`.
> 5. **The excerpt and the one-door exception.** The Film Room builds the moment excerpt (`api/_utils/filmRoom/momentExcerpt.js`, spec §6) as the bounded fields your drafting call reads for game moments and cards. The census will allow exactly one importer; please name the drafting assembler's path for T1b, and register the excerpt in the Mandate honesty registry when you import it.
> 6. **Recommendation (BC-7):** consider a nomination with one bounded call at nomination time, inside the book's $3 bound, rather than only at the next refill. The agent's reason is the loop's first feedback to the player; waiting up to ten sessions for it makes the Film Room's offer feel unanswered. Your call on cost; the Film Room renders either way.

## 14. Not decided here

- The QA brief is reissued with C1's report (the Offer route and the chain change what the tester sees); `'on'` follows that pass.
- The multi-day format's tape work (the dormant merge, `down` and `good_lead`, a chain across days) is the next wave, specified when that format's investigation reports.
- The framework's P5 projection (believed / called / done) stays the framework's; the Film Room renders it in its own later build.
