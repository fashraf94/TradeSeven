# Build report — Film Room C1: the vocabulary, the nomination and the chain

**Executor:** Claude Code (Opus), its own worktree, Windows + WSL · **Date:** 12 Nov 2026
**Prompt:** `BUILD_PROMPT_FILM_ROOM_C1_CHAIN_20261112.md` (the Film Room chat) · **Governs:** Build C spec V1 (`docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md`, committed verbatim here), Build B spec V1 with Amendments A–L, screen rules R1–R15
**Branch:** `claude/film-room-c1-chain`, cut from `origin/main` @ `c37baa0d` after `git fetch origin` (main holds #1013 `982f6661` and #1019 `40641486`) · **Code head:** `0ff13830` · **PR:** #1049 (opened as a draft, marked ready for review at the end; the founder merges)

## Verdict

| Question | Answer |
|---|---|
| Built? | Yes: B0 and all twelve items, one commit each, with their tests in the same commit. Then: one commit of emulator rows, a header comment, the protected-store allowlist the full suite asked for (`254b39da`), and three commits from the §2 review (`fd291d7c`, `95d4452e`, `0ff13830`). |
| The flag | `FILM_ROOM_CARDS_MODE` is still `'allowlist'`. No QA pass and no flip in this round. |
| Does anything reach a player today? | The cards-off screen changes only by §8 rulings 1 and 2 (and ruling 4's bound, which no cards-off viewer can reach; §3). With cards on (the allowlist), the form, the receipt and "since last time" change. There is no book for anyone until the Practice Field's T1a lands, so the form shows no Offer route and every nomination is refused `book_not_open`. |
| Tests | At the code head `0ff13830`: the full Linux suite (a git worktree, `TZ=UTC`, 8 workers) gives **0 failing**: 1,414 files, 31,073 rows, 30,966 passed, 107 skipped. The emulator rules suite gives 41 files, **760 of 760**. `lint:gate` and `vite build` both exit 0. The one-door census and acceptance C are green. |
| Mutants | **40 of 40 killed** at the code head: the prompt's named mutants as 24 runs (some split into variants), 10 for the review's fixes, and 6 for the mutating lens's survivors. The 19th named mutant ("the code gone from the labelled exit-reason field") has no target: no such field exists on the screen at this head (§7 item 6). |
| Goldens | The twelve cards-off goldens were re-captured at the code head: **all twelve byte-identical to main's**. Neither ruling reaches a photographed state, as §3 shows. |
| Fences | Held. No BUILD_RULES §1 file, `firestore.rules`, `firestore.indexes.json`, `featureFlags.js`, `casualClone.js`, hub code, `mandate*.js`, setup evaluator or `activationEvidence/**` in the diff. Nothing writes a book document except the nomination record, inside the card endpoint's transaction (§4). |
| §2 review | Done, per BUILD_RULES §2. Three static lenses, two independent refuters and a mutating lens ran, each on its own snapshot. **No BLOCKER.** 18 findings were fixed (each with a row, a comment or an assertion), and 15 are questions, readings or notes. The mutating lens found 6 surviving mutants, and each now has its killing row (§6). |
| Needs a ruling | 16 items, none blocking (§7). |

## 1. The refinements, and the readings this build took

### 1.1 The prompt's three refinements (for the spec's V1.1)

- **R-C1-1:** "Since last time" lists every card past the `card` stage with its newest chain line and time, newest first. No "last visit" mark is stored (`filmRoomCards.js` `latestOf`). A retired card counts as past `card`, so a Watch card the player retired is listed as "Retired · {time}".
- **R-C1-2:** Parking is its own op, `park`, on the card endpoint (`cardStore.js` `parkCard`, `card.js`).
- **R-C1-3:** Both Practice Field helpers sit behind one seam module with "no book" defaults (`api/_utils/filmRoom/practiceFieldSeam.js`). The nomination path is complete and tested before the book exists.

### 1.2 Readings this build took where the spec or prompt leaves a choice (stated, built, pinned)

1. **The one export lives in `src/data/cardStages.js`, and `cardStore.js` re-exports it whole.** The screen and the harness cannot import `cardStore.js`, which pulls in `casualClone.js` and `canonicalHash.js`. So the vocabulary is a zero-import module beside `cardSlots.js`, holding the lists and the open predicate `isOpenStage`. "A tested entry with no `parkedAt`" is a predicate, not a list.
2. **A nominate on a shelved card is refused `illegal_transition`.** That is the spec's letter (§4 precondition 3: "at `card`, not shelved (409 `illegal_transition`)"), not retire's `shelved` code.
3. **Nominate's checks run in this order:** owner → replay → version → stage → book. The book is read once, through the seam, before the transaction (§4 precondition 4). The store judges it in that order, so:
   - a foreign entry with no book is 403;
   - a replay after the book closed is the idempotent 200;
   - an already-nominated entry with no book is `illegal_transition`.

   An Offer create judges the book after its replay check, the same way. A lost answer re-tapped after the book closed gets its card back (SPR-C-3's precedent).
4. **The nomination's id is the op id.** For an Offer create that is the entry's own id. An op id the book already holds under another nomination is refused `op_conflict`, because the record is read in the transaction before its `tx.set`.
5. **A Watch card offered later is followed no more.** `isFollowedWatch` (route `watch`, stage `card`) is the one predicate the counter's recurrences and the screen's Watch list both read. Before C1 the server used the open set and the client used stage `card`. They agreed only because a Watch card could never be nominated.
6. **The player's retire reads the one open predicate, "as today".** It retires an open card: `card`, `nominated`, `testing`, or `tested` unparked. A parked or installed card is no transition. See §7 items 1 and 2.
7. **Parking moves no stage and does not judge shelving.** A shelved tested card parks: the spec's letter names only "tested with no `parkedAt`". `ledgerOf` now keeps the counter row's computed shelving when a newer write result replaces it.
8. **The transition helper validates shapes, not vocabularies, for the Practice Field's words.** A result's `contractCondition` / `economicResult` and an offer's `state` must be short non-empty strings, and the screen renders them exactly as stored. A nomination `state` must be one of `NOMINATION_STATES` other than `queued`. `considered` is accepted (spec §4 lists it) and renders as the record's own word.
9. **The helper binds each copy to the entry's own records.**
   - A `nomination` copy must name the entry's own `bookId` / `nominationId`.
   - `testing` must name the entry's book.
   - `tested` must name the entry's idea.
   - Anything else is 409 `nomination_mismatch`.

   A v1 Practice entry has no nomination, so nothing is copied onto it.
10. **A book read that fails is no open book.** The counter answers `open: false`; nominate and an Offer create refuse `book_not_open`, with a server trace. A walk off the maintained calendar refuses 503 `calendar_unavailable`, and nothing is written.
11. **B6 (10 sessions) is copied into the vocabulary module** (`NOMINATION_EXPIRY_SESSIONS`). The record's `expiresAt` (the seam's builder) and the receipt's "not considered within 10 sessions" read one number. The receipt shows it as a derived number, as the prompt rules. `expiresAt` is the close of the 10th session after the anchor session, the hypothesis review clock's convention on the calendar of record.
12. **Park's op id is minted once per receipt, at the first tap.** Minting late keeps every existing op-id sequence the screen suites rely on unchanged.
13. **Where the Offer create judges the book (review A-14).** The book is read before the transaction, as the prompt says. The store judges it inside, after the replay, the source re-check and the archetype check. So "no book" together with a changed archetype answers `archetype_changed`, and a lost answer re-tapped after the book closed still answers its card.
14. **The result and offer words are not pinned to spec §5's lists (review A-8).** §5 names `met` / `breached` / `unobserved` and `ahead` / `behind` / `within band` / `unmeasurable`. But §3 says `tested` is written "at any terminal result, `inconclusive` and `abandoned` included", so pinning §5's two lists could refuse a real result. The helper stores short strings and the screen renders them as stored.
15. **Replays are scoped by writer (review A-5).** A player op answers only to a player row under its op id, and the helper only to a server row. So the Practice Field's natural op id, the nomination id (which IS the player's nominate op id), never collides.
16. **The chain says only what the history holds (review B-1/A-7, B-3, B-6, B-7, B-8).**
    - A v1 Practice entry (stored route `drill`) shows its stage's own word ("nominated for the Practice Field"), never "Offered to your agent".
    - An expiry carries no "your agent" quotation.
    - A nomination row with no state, or a row with an event the chain does not know, gives no line.
    - A row with no instant says "time not recorded" in words, not as a marked instant.
17. **Set's sentence and tempo link stay on the filed Set card at `card` (review B-4).** A Set card the player later offers has moved on, and RL-5 keeps the sentence and the link together.
18. **The Offer fallback is silent (review B-9).** If the counter re-reads the book closed after the player picked Offer, the choice returns to Watch with no word. That is what gets filed (pinned). The alternative is to clear the choice and disable File.

## 2. The items

| # | Item | Commit | What changed (file:line at the code head) | Tests | Mutants killed |
|---|---|---|---|---|---|
| B0 | Spec V1 verbatim, one index row | `804c47a1` | `docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md`, extracted by script between the markers (lines 113–315), SHA-256 equal to the source range; `docs/README.md` row | — | — |
| 1 | Vocabulary v2 | `70a4d182` | `src/data/cardStages.js:20–40` (the lists, `isOpenStage`, `isFollowedWatch`); `cardStore.js:193` (`isOpen`), `:211` (`buildCardDoc` writes `stageVocabVersion: 2`), `:409` (retire by `isOpenStage`), `:484`/`:565` (`SERVER_TRANSITIONS`, `applyServerTransition`); readers: `cardCounter.js:173`, `filmRoomCards.js:166`/`:235`, `FilmRoomCardRegions.jsx` (regions), `filmRoomCopy.js` `stageWords`, harness open-count oracle | `cardStore.transitions.test.js` (15 at item 1), `cardStages.census.test.js` (13, every reader planted twice), `cardStore.test.js` pins moved to v2, one screen row | M01, M02a, M02b, M03a, M03b, M03c, M04 |
| 2 | The seam | `7dfa2e83` | `api/_utils/filmRoom/practiceFieldSeam.js` (`bookForOwner` → null, `buildNominationDoc`, `closeOfSessionsAfter`, the test-only `setPracticeFieldSeam`); `cardStages.js:53` (B6) | `practiceFieldSeam.test.js` (8) | — (its behaviour is killed through items 3 and 4) |
| 3 | `nominate` and the Offer route | `3b8e16bd` | `cardStore.js:309` (`createCard`: `drill` refused, the book judged after the replay, both halves in one transaction), `:370` (`nominateCard`); `cardRequest.js:81`, `:124`; `card.js:101` (`bookOf`), `:237`, `:256`; `cardStages.js:56–65` (routes) | `card.test.js` (+7 handler rows), `cardStore.transitions.test.js` (+2), `cardRequest.test.js` (+2), migrated `drill` seeds | M05a, M05b, M06, M07, M08, M09a, M09b |
| 4 | The counter | `956b0544` | `cardCounter.js:208` (`bookStateOf`), `:263` (`book: { open }`) | `cardCounter.test.js` (+3) | M15 (with item 7) |
| 5 | The form | `bc2f6b87` | `FilmRoomCardRegions.jsx:205` (routes from the export, Offer only with `book.open === true`, the fallback to Watch); `filmRoomCopy.js:323` (`routeNotes`), refusals | `FilmRoomCards.jsdom.test.jsx` (+5, and the Practice rows moved to Offer) | M10, M11 |
| 6 | The chain | `3bf78c1f` | `filmRoomCards.js:193` (`chainOf`); `FilmRoomCardRegions.jsx:316` (`ChainLine`), `:358` (`Chain`), `:396` (`Receipt`, `onOpenBook`); `filmRoomCopy.js:396`, `:453` (forbidden words); harness channel and B6 oracle | `FilmRoomCards.jsdom.test.jsx` (+7, every state from the REAL helper's writes) | M12a, M12b, M13 |
| 7 | `park` | `7f7ef652` | `cardStore.js:450` (`parkCard`); `card.js:268`; `cardRequest.js:127`; `filmRoomCards.js:314` (hook), `:150` (`ledgerOf` keeps shelving); `FilmRoomCardRegions.jsx:424`; `FilmRoomScreenV2.jsx:324` | store (+4), handler (+2), request (+1), screen (+3) | M14, M15 |
| 8 | Since last time | `26e83559` | `filmRoomCards.js:225` (`latestOf`); `FilmRoomCardRegions.jsx:558` | `FilmRoomCards.jsdom.test.jsx` (+2) | (pinned by its rows; the chain mutants M12a/b reach it too) |
| 9 | Grid tiles (§8 ruling 1) | `ee259a94` | `FilmRoomDeepDive.jsx:416–425` | `FilmRoomDeepDive.jsdom.test.jsx` (+3) | M16 |
| 10 | The meeting code (§8 ruling 2) | `5a80c9d7` | `filmRoomModel.js:468` | `FilmRoomDeepDive.jsdom.test.jsx` (+1, and RL-4's row moved), `FilmRoomStudy.jsdom.test.jsx` (+1) | M17 |
| 11 | A missing battle agent (§8 ruling 3) | `361a25e1` | no code change | `FilmRoomCards.jsdom.test.jsx` (+1) | — |
| 12 | A date not among the battle's days (§8 ruling 4) | `8e354059` | `FilmRoomScreenV2.jsx:221–227` | `FilmRoomCards.jsdom.test.jsx` (+3) | M19 |
| — | The protected-store allowlist (found by the full suite) | `254b39da` | `api/_utils/compositionProtectedStoresAllowlist.json` (five keys at count 1, `_notes_film_room_c1`); `createCard`'s two `tx.create` sites folded into one | `compositionProtectedStores.scan.test.js` green | — |
| — | The §2 review's fixes | `fd291d7c`, `95d4452e`, `0ff13830` | see §6 | +26 rows across the store, seam, handler and screen suites | M20–M35 |
| — | Emulator rows | `498c7788` | `test/rules/filmRoomCardAttribution.rules.mjs` (nominate and the Offer route through an injected seam against a synthetic `idea_book`), `test/rules/filmRoomPlaysDenials.rules.mjs` (client writes denied) | +3 and +9 rows | — |

The mutant battery ran in a `git archive` snapshot of the code head (never the working tree). Each mutant was judged by its exit code and a fresh JSON report, with the file's bytes restored from the archive afterwards. Every `from` had to match exactly once. **At the code head `0ff13830`: 40 of 40 KILLED, 0 SURVIVED, 0 BROKEN** (M01–M19: the prompt's list; M20–M29: the review's fixes; M30–M35: the mutating lens's survivors, re-run against their new rows.)

## 3. The goldens

**The twelve cards-off goldens were re-captured at the code head; none moved.**

**How they were captured.** The capture harness (`src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx`, `FILM_ROOM_V2_GOLDEN_OUT_DIR` set, `TZ=UTC`) ran twice in an LF `git archive`, first of `99d72aab`, then again of the code head `0ff13830`. Each time the two runs were byte-identical.

**The comparison.** All twelve captures are byte-identical to `main`'s goldens, so there is no difference to map, and no golden or its pinned SHA-256 moves.

**Why neither ruling reaches a golden.** The snapshot holds the new code (`noLine` in `FilmRoomDeepDive.jsx`; the meeting maker without its code in `filmRoomModel.js`). The photographed states never take the changed branches:

| Ruling | Why no photograph shows it |
|---|---|
| 1, the tiles | The only photographed grid is Sep 23's desktop Deep dive. It is captured with its series READ: 11 tiles, BTC's NoChart sentence after a successful read, and no tile state. The loading and failed-read tile states are pinned by the Deep dive suite instead (item 9). |
| 2, the meeting code | The Sep 23 tape's three swaps are made by a platform rule (`archetype_rotation`, twice) and the agent. No photographed view holds a meeting swap, as RL-4's chart change reached no golden either. The one "gameplan" string in the Study and Glance photographs is the legend's copy ("the gameplan meeting, or a maker not recorded"), which has no code. Ruling 2 is pinned by the Deep dive and Study suites (item 10). |

**The comparison suite.** `FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx` is unchanged and green in the full suite.

**Every cards-off change, named (review C-3, C-8, C-9).** None is photographed.

| Change | Status | Effect on the cards-off screen |
|---|---|---|
| Ruling 1: the grid tiles | the ruling | While the series loads or after a failed read, a tile also no longer shows a not-charted reason the tape records (BTC's "crypto is not charted"). It says the loading line or the failure sentence, as the ruling's letter has it; its own reason returns once the read succeeds. |
| Ruling 2: the meeting code | the ruling | A meeting maker said in words carries no code. |
| Ruling 4: the `openAt` bound | declared, required by item 12 | The bound applies whatever the cards state. The only sender of a moment `openAt` is the Film Room's own cards-on recurrence link, so a cards-off viewer never receives one. |
| The three new forbidden words | latent | `FORBIDDEN_WORDS` also feeds Deep dive's company-name guard (`displayNameOf`, which withholds a name holding a forbidden word). None of the 140 names in `COMPANY_NAMES` matches `validated`, `proven` or `supported` with their suffixes, so nothing visible changes today. |

## 4. Fence statement

- **BUILD_RULES §1: zero edits.** No fenced file is in the diff, and `api/cron/agent-evaluate.js` is untouched. No fenced function is called by the new code.
- **Not in the diff, as the prompt fences:** `firestore.rules`, `firestore.indexes.json`, `src/config/featureFlags.js`, `api/_utils/casualClone.js`, `src/components/CommandCenter/**`, every `api/_utils/mandate*.js`, the setup evaluator (`api/_utils/setupEvaluator/**`), `api/_utils/activationEvidence/**`, and the one-door census `api/_utils/filmRoom/oneDoor.census.test.js` (unchanged and green). Checked by `git diff --name-only c37baa0d..HEAD` against the list. The diff is 31 files.
- **`FILM_ROOM_CARDS_MODE` is `'allowlist'`** (`src/config/featureFlags.js:3526`, untouched). There was no QA pass and no flip.
- **The book.** Nothing in the Film Room writes a book document except the nomination record. That record is written inside the card endpoint's transaction: `createCard` for the Offer route, and `nominateCard`. Its shape comes from the Practice Field's builder, through the seam. Tests write synthetic book documents (the emulator rows, and the in-memory store).
- **No new door.** The chain's idea and result links render only beside an `onOpenBook` prop, and C1 hands none (`FilmRoomScreenV2` passes no such prop). "Park this card" calls the card endpoint. The Forge is still reached only through Set's existing link (RK-2/RK-3). Nothing new opens the Forge or the Film Room.
- **One door.** The census is unchanged and green. The new modules `src/data/cardStages.js` (zero-import) and `api/_utils/filmRoom/practiceFieldSeam.js` (imports `api/_utils/marketSchedule.js` alone) read no `plays`.
- **Acceptance C is green with its guarantee unchanged.** Its seeded `nominated` entry moved from route `drill` to route `offer` with a book handed in. The populated handle therefore now also holds a nomination record under `mandates/`, and the assembled prompts stay byte-identical with no read of `plays`.
- **No merges, no production writes, no backfill, no refresh, no deploy, no flip.** `origin/main` did not move after the fetch (`c37baa0d`), so the branch is its own merge with main.
- **The protected-store allowlist** (`api/_utils/compositionProtectedStoresAllowlist.json`) gains five keys, each pinned at count 1 with a human-review note (`_notes_film_room_c1`). The full suite's deny-by-default scan found them: the Offer route's record write, nominate's two writes, park, and the transition helper. **The founder reviews them with this PR.**
- **BUILD_RULES §4 import rule.** `cardStore.js` re-exports `src/data/cardStages.js`, which is zero-import. The seam imports `api/_utils/marketSchedule.js`, an api/ module. The unmocked imports in `cardStore.transitions.test.js`, `cardStages.census.test.js` and `practiceFieldSeam.test.js` are their dependency-surface guards.

## 5. What the Practice Field must replace in the seam

`api/_utils/filmRoom/practiceFieldSeam.js` holds the Practice Field's two helpers. Its header names T1a and T2 as the owners.

| Helper | Contract the Film Room relies on | Default until replaced | Owner |
|---|---|---|---|
| `bookForOwner(db, { uid, attributionAgentId })` | One server-side read. Returns `{ bookId, status }` for the owner's idea book managed by that attribution agent (the ranked parent for a casual clone), or `null`. A book is open only when `status === 'active'`. The Film Room sends nothing of it to a client except the counter's boolean, and never caches it. A thrown read is treated as no open book. | `null` for everyone; reads nothing | T1a (spec §13 item 1 asks it to add the helper and name its path) |
| `buildNominationDoc({ entryId, situationId, questionId, questionVersion, nowIso, expiresAfterSessions })` | Returns the record the card endpoint writes at `mandates/{bookId}/nominations/{nominationId}` in the same transaction as the entry's move to `nominated`. It must be pure, with no I/O: it runs inside a Firestore transaction. Its id is the card op's id. Throw an error with `code: 'calendar_unavailable'` to refuse with 503, writing nothing. | Contract V2 §5.2's shape: `{ state: 'queued', source: { kind: 'film_room_card', entryId, situationId, questionId, questionVersion }, queuedAt, expiresAt, stateHistory }`, where `expiresAt` is the close of the 10th session after the anchor, on the calendar of record | T2 (which also declares the nominations rule, spec §9) |

**Writing back onto the entry.** Later states are written through `cardStore.js` `applyServerTransition(db, { entryId, ownerId, agentId, to, by, payload, opId })` (server-only). It takes:

| `to` | Payload | Order |
|---|---|---|
| `nomination` | `{ state, reason, consideredAt, bookId, nominationId }` | entry stays at `nominated` |
| `testing` | `{ bookId, ideaId }` | from `nominated` |
| `tested` | `{ ideaId, resultRef, contractCondition, economicResult }` | from `testing` |
| `installed` | `{ offerId, state }` | from `tested` |
| `retired` | `{ offerId \| null, state }` | from `tested` |

`by` is the writer's name, kept on the history row (`by: 'server', writer`). The helper is idempotent by `opId`, and a shelved entry still transitions.

## 6. The §2 review

The branch diff passes BUILD_RULES §2's threshold, so the review was multi-lens and adversarial.

**Who ran.** Every reviewer worked on its own `git archive` snapshot, path-distinct, read-only on git and the working tree:
- Three static lenses on `99d72aab`: A, server correctness; B, screen honesty and the rulings; C, fences, flag-off and test integrity.
- Two independent refuters, one for A's findings and one for B's. Each re-ran every finding with a concrete row and was told to refute it where it could.
- Lens C's two SHOULD-FIX claims were verified by me with a run. C-1's mutant survives on `254b39da`. The census's old matcher misses C-2's forms, and the new matcher catches them (`verifyC2.mjs`).
- The mutating lens D ran last, on its own snapshot of `fd291d7c`.

**Result: no BLOCKER.** Lens A: 14 items. Lens B: 12. Lens C: 9 (plus 2 notes). Every claim that names a behaviour was reproduced by a refuter or by me: none was REFUTED outright, and several were narrowed (A-5, A-6, A-9, A-11, A-12a). Dispositions: 18 fixed (A-1, A-5, A-10, A-12, B-1/A-7, B-2, B-3, B-4, B-5's link, B-6, B-7, B-8, B-12, C-1, C-2, C-4, C-5, C-6); 15 questions, readings or notes recorded in §1.2, §3 or §7 (A-2, A-3, A-4, A-6, A-8, A-9, A-11, A-13, A-14, B-9, B-10, B-11/C-8, C-3, C-7, C-9).

| Id | Severity | Finding | Verdict | Disposition |
|---|---|---|---|---|
| A-1 | SHOULD-FIX | `applyServerTransition` accepted a non-string `to` (an array or a String object): it coerced to a table key, missed every `===` branch, and landed a payload with no binding check | CONFIRMED (rows with `['testing']`, `['nomination']`, `new String('tested')`) | **Fixed** `fd291d7c`: `typeof to === 'string'`; row + mutant M20 |
| A-2 | QUESTION | A player retire of a nominated or testing card leaves the book's record or idea running; later helper moves answer `illegal_transition` | CONFIRMED as behaviour | Ruling asked (§7 items 1–2) |
| A-3 | QUESTION | Nomination states have no order; `testing` is not tied to `accepted`; history rows keep a copy's state, not its reason | CONFIRMED as behaviour | Ruling asked (§7 item 11) |
| A-4 | QUESTION | No writer for "An offer waits in the Forge" | (the build's own reading) | Ruling asked (§7 item 5) |
| A-5 | MINOR | Player and server op ids shared one replay namespace: a server move under the player's nominate op id, or the Offer create's id, was refused `op_conflict` | CONFIRMED (the refuter added the Offer-create case) | **Fixed** `fd291d7c`: replays scoped by writer; row + M21 |
| A-6 | QUESTION | The book is not re-read in the transaction; `mandates` also holds portfolio books | CONFIRMED as behaviour, unreachable today (the seam answers no book) | Ruling asked (§7 item 12) |
| A-7 | QUESTION | Stored v1 `drill` entries may exist in production; their chain said "Offered to your agent" | CONFIRMED (same as B-1) | **Fixed** with B-1; the production count is a ruling (§7 item 13) |
| A-8 | MINOR | Result and offer words are not pinned; "validated" would be stored and shown verbatim | CONFIRMED | Not pinned (§1.2 reading 14: spec §3's terminal results include `inconclusive` / `abandoned`); ruling asked |
| A-9 | MINOR | `installed` / server `retired` are bound to no idea | CONFIRMED as behaviour (owner, agent, replay and from-stage still checked) | Ruling asked (§7 item 14) |
| A-10 | MINOR | The helper accepted `/` and `__x__` in path ids, and any `nowIso` | CONFIRMED | **Fixed** `fd291d7c`: forge-id class for path ids, an instant for `nowIso`; row + M22 |
| A-11 | MINOR | A corrupt stored `questionVersion` makes nominate a 500 (nothing written) | CONFIRMED, reachable only through a corrupt entry or a replacement builder | Accepted as is (fail closed); named in §5 |
| A-12 | MINOR | Two "nothing written" checks read the wrong handle; the census missed a `switch` and object maps | PARTLY CONFIRMED (the checks guarded one handle of two) / CONFIRMED | **Fixed** `fd291d7c`, `95d4452e`: both handles checked; `switch` and parenthesized chains caught; object maps, aliases and templates stated as documented limits |
| A-13 | NOTE | The expiry convention; the calendar ends 2027 | (the build's own reading) | Ruling asked (§7 item 15) |
| A-14 | NOTE | The Offer create judges the book after the archetype check | CONFIRMED as behaviour | Recorded (§1.2 reading 13) |
| B-1 | SHOULD-FIX (BLOCKER if a `drill` entry exists) | A v1 Practice entry's chain and latest line said "Offered to your agent" | CONFIRMED | **Fixed** `fd291d7c`: the stage's own word; row + M23 |
| B-2 | SHOULD-FIX | An installed card that had been parked kept the "Parked" note | CONFIRMED through the real writers | **Fixed**: the note on a parked TESTED card only; row + M24 |
| B-3 | SHOULD-FIX | The agent's reason was quoted beside an expiry | CONFIRMED through the real helper | **Fixed**: quoted beside an answer only; row + M25 |
| B-4 | SHOULD-FIX | Set's link and sentence on a Set card that had moved past `card` (RL-5 broken) | CONFIRMED through the real writers | **Fixed**: Set's words on the filed card at `card` only; row + M26 |
| B-5 | QUESTION / latent | An expiry after an answer renders above it; the idea link on a non-latest `accepted` line | CONFIRMED (both parts) | Order: ruling asked (§7 item 11). Link: **fixed** (latest only) |
| B-6 | MINOR | A nomination row with no state rendered "undefined" | CONFIRMED (planted; no writer produces it) | **Fixed**: no line; row |
| B-7 | MINOR | An unknown event row read as a second stage move | CONFIRMED (planted) | **Fixed**: no line; row + M27 |
| B-8 | MINOR | "time not recorded" marked as an instant | CONFIRMED (planted) | **Fixed**: words, not `When`; row + M28 |
| B-9 | QUESTION | The Offer fallback to Watch is silent | (the build's reading) | Recorded (§1.2 reading 18) |
| B-10 | QUESTION | A platform rule's reason after "Exit by platform rule" | (the build's reading) | Ruling asked (§7 item 16) |
| B-11 / C-8 | QUESTION | Ruling 1's tiles also hide a not-charted reason while loading | (the ruling's letter) | Recorded (§3) |
| B-12 | MINOR | A row claimed "no Park on an equipped card" without one | CONFIRMED | **Fixed**: the B-2 row asserts no Park on an equipped receipt |
| C-1 | SHOULD-FIX | Nominate adding `stageVocabVersion` to a v1 entry survived the suite | CONFIRMED (M29 survives on `254b39da`) | **Fixed** `95d4452e`: row; M29 killed at the head |
| C-2 | SHOULD-FIX | The census missed common forms and had no discovery walk | CONFIRMED (`verifyC2.mjs`) | **Fixed** `95d4452e`: parenthesized chains and `switch` caught; a discovery walk over the card code; the rest documented |
| C-3 | MINOR | The new forbidden words feed Deep dive's company-name guard on the cards-off screen | (by reading; no name matches) | Recorded (§3) |
| C-4 | MINOR | The §4 dependency-surface comments were missing on the new imports | (by reading) | **Fixed** `95d4452e` |
| C-5 | MINOR | Acceptance C's comment claimed a record no row checked | (by reading) | **Fixed** `95d4452e`: the record is asserted |
| C-6 | MINOR | Two row titles claimed more than their rows | (by reading) | **Fixed** (`fd291d7c`, `95d4452e`) |
| C-7 | MINOR | KRT-3's Offer note check moved to "absent with no book" | compensated by item 5's rows | No change |
| C-9 | QUESTION | Ruling 4 also applies whatever the cards state | (by reading) | Recorded (§3) |

**The mutating lens (D).** D ran on its own snapshot of `fd291d7c`. It planted 25 mutants of its own choosing, beyond the prompt's list, and judged each by exit code with a fresh JSON report: **19 KILLED, 6 SURVIVED, 0 BROKEN.**

All six survivors were real gaps, none equivalent. Each now has a row, in `0ff13830`, and is re-run in the final battery as M30–M35:

| Survivor | The gap | The row that kills it |
|---|---|---|
| D-M21 | Offer showed whenever the counter had not reported the book | Offer only with `book.open === true`: never while the counter loads, after a failed first read, or when it answered with no book field |
| D-M16 | No row pinned a failed book read at the endpoint | It answers 409 `book_not_open`, not 500 |
| D-M20 | No row refused a park | A stale park re-reads the counter and says why |
| D-M09 | No row accepted the reason's exact bound | 2,000 code points accepted |
| D-M11 | No row put an instant exactly at a session close | The walk is half-open |
| D-M08 | No row replayed under another writer | The writer is part of a server request |

**Load flakes, not counted as kills.** D's runs, and my own once, saw two whole-tree census rows cross their 5 s limit while a jsdom suite ran beside them: `oneDoor.census` "every non-test module under api/ …" at 5.2–5.65 s, and `perGameLoadoutFlags` "every read, exact" at 5.4 s. Both pass alone, both files are unchanged by C1, and both pass in the full suite.

**What D did not probe** (its 25 slots ran out) is covered by the build's own battery:
- `retireCard`'s predicate (rows in `cardStore.transitions.test.js`)
- `SERVER_TRANSITIONS` and `boundOf` (M03b, and the binding rows)
- the replay namespaces (M21)
- `groupCards` (the item 1 row)
- `ChainLine` and `Chain` (M12a/b, M23–M28)

## 7. Needs a ruling (none blocks a merge)

Each item below is built one way and pinned by a row. Each asks one question.

1. **Retiring a `testing` card.**
   - **Built:** the player's retire reads the one open predicate "as today", so a `testing` card can be retired.
   - **Effect:** the book's idea keeps running, and the transition helper then refuses the idea's `tested` move onto the retired entry (illegal order).
   - **Question:** keep this, or refuse a player retire at `testing`?
2. **Retiring a `nominated` card.**
   - **Built:** as today, a nominated card can be retired.
   - **Effect:** the book's `queued` record stays behind. The Film Room writes no book document outside the nominate transaction, and the helper refuses later nomination copies onto the retired entry.
   - **Question:** refuse that retire, or should the Practice Field withdraw the record when it meets a retired entry?
3. **A declined or expired nomination stays open.**
   - **Built:** spec §3 keeps the stage at `nominated` for every nomination copy, so the card counts against S9 until the player retires it.
   - **Question:** keep this, or should only `queued` / `accepted` count?
4. **The thesis and the closing note have no field.** Spec §5's chain quotes "the thesis" beside "Taken into an idea" and "the agent's closing note" beside "Tested". Spec §3 names no field for either.
   - **Built:** the accepted line quotes `nomination.reason`, the agent's only words the entry holds, credited "— your agent" at `consideredAt`. The tested line has no quotation.
   - **Question:** which fields carry them (for example `idea.thesis`, or `result.closingNote` with its time) so the helper can copy them?
5. **"An offer waits in the Forge" has no writer.** The helper's `installed` move sets `offer` and moves the stage together, so the ledger can never hold an offer at `tested`. The line is not rendered.
   - **Question:** add an `offered` move (sets `offer`, stage stays `tested`) to the helper?
6. **Ruling 2's second sentence has no site.** "A labelled exit-reason field keeps the code" names nothing on the screen at this head: no panel shows the recorded exit reason as a labelled field. Nothing was added, since adding one would be a cards-off change beyond rulings 1 and 2 (exit criterion 14). The named mutant has no target.
   - **Question:** confirm, or name the field.
7. **No button offers a card later.** `nominate` works on any card-stage card (BC-3), but spec §5 makes "Park this card" the only new button. A Watch card can be offered later only through the endpoint until a later build adds the control.
   - **Question:** confirm C1 ships no Offer button on the receipt.
8. **B6's home.** B6 (10 sessions) is copied into `src/data/cardStages.js` (`NOMINATION_EXPIRY_SESSIONS`), so the record's `expiresAt` and the receipt read one number.
   - **Question:** confirm the Film Room may hold this copy until the Practice Field names its module.
9. **`considered` as a state.** Spec §4 lists `considered` among the later transitions, beside `accepted` / `deferred` / `declined` / `expired`.
   - **Built:** the helper accepts it, and the chain renders it as the record's own word ("Your agent's answer · considered").
   - **Question:** is `considered` a state of its own, or the family the other three belong to?
10. **Where the note sits.** The spec's chain table puts the note ("— you") beside "Filed".
    - **Built:** the note keeps its B2 place under the card's facts, and the chain's "Filed" line sits at the chain's foot.
    - **Question:** keep the B2 layout, or move the quotation into the chain?
11. **The order of nomination states (review A-3, B-5).** The helper takes the nomination copies in any order, and `testing` checks the stage (`nominated`) and the book, not that the copied state is `accepted` (built to the prompt's letter, "the legal order" of stages). So "declined, then testing" is accepted, and an `expired` copy after `deferred` renders "Not considered within 10 sessions" above "Deferred". A nomination row in `stageHistory` keeps its state but not its reason, so a deferral's reason is overwritten by a later copy (the screen quotes only the latest, so nothing is misattributed).
    - **Question:** what is contract V2 §5.2's state order? Should the helper enforce it, and require `accepted` before `testing`?
12. **The book is not re-read inside the transaction (review A-6).** `bookForOwner` returns `{ bookId, status }` before the transaction. A book closed between that read and the commit still receives the nomination. `mandates` also holds the portfolio Mandate books (`mandateSchema.js`), so a helper that returned one would land the record there.
    - **Question:** should T1a's contract say it returns only an idea book (`kind: 'idea_book'`)? Or should the Film Room re-read `mandates/{bookId}` in the transaction (a read, inside the fences) and require the owner, the kind, the manager agent and `status: 'active'`?
13. **Stored v1 Practice entries in production (review A-7).** Since the allowlist flip on Oct 29 the form offered Practice to allowlisted owners. The spec's "none exist in production" is unverified here: this build made no production read. Such an entry reads as Offer, shows "nominated for the Practice Field", counts open, can never advance (no nomination record), and can be retired.
    - **Question:** a read-only count of `plays` with `route == 'drill'` before the `'on'` flip?
14. **`installed` and the server's `retired` are bound to no idea (review A-9).** Their payloads carry `{ offerId, state }` only, per the prompt, so the helper cannot check that the offer comes from the entry's own idea (`idea.ideaId`).
    - **Question:** add `ideaId` to both payloads and bind it?
15. **The nomination clock (review A-13).** `expiresAt` follows the hypothesis review clock: the anchor session is session 0, so a nomination queued after the close gets ten whole sessions after the next one. From about mid-December 2027 the walk leaves the maintained calendar (`MAINTAINED_HOLIDAY_YEARS = [2026, 2027]`), and every nominate and Offer create refuses 503 `calendar_unavailable` until 2028 is added.
    - **Question:** confirm the convention, and note the calendar's horizon for the Practice Field.
16. **Ruling 2's reach (review B-10).** Built narrowly: "the meeting code". "Exit by platform rule · stagnation" keeps its reason (RJ-4), and the build's rows pin that reading.
    - **Question:** confirm, or extend "no code after a maker in words" to a platform rule's reason.

## 8. Verification record

All checks ran on the code head `0ff13830`. `origin/main` was `c37baa0d` at the fetch and did not move, so the branch is its own merge with main.

| Check | Where | Result |
|---|---|---|
| Full vitest suite | WSL Ubuntu, a git worktree of `~/pd-ci` at `0ff13830` with a real install for the lockfile (`40382e64edb6`), Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under the shared flock | exit 0, 392 s: **1,414 files, 31,073 rows, 30,966 passed, 0 failed, 107 skipped** |
| Earlier full runs | the same, at `99d72aab`, then `254b39da` | `99d72aab`: 1 failed. The protected-store scan found the ledger's five new write sites, fixed in `254b39da`. `254b39da`: 0 failed. |
| Rules suite (emulator) | WSL, Temurin JDK 21, `firebase emulators:exec --only firestore`, `vitest.rules.config.mjs` | **41 files, 760 / 760**: `filmRoomCardAttribution.rules.mjs` 13, `filmRoomPlaysDenials.rules.mjs` 22, `filmRoomCardReplayOwner.rules.mjs` 3 |
| `lint:gate` | WSL worktree | exit 0 |
| `vite build` | WSL worktree | exit 0 (built in 43 s; the warnings predate C1) |
| One-door census / acceptance C | in the full suite | green (the census file is unchanged; acceptance C asserts the nomination record its populated handle holds) |
| Cards-off goldens | capture harness, twice, in an LF archive | 12 / 12 byte-identical to main's (§3) |
| Mutant battery | an LF archive of `0ff13830`, judged by exit code and a fresh JSON report | **40 of 40 KILLED, 0 SURVIVED, 0 BROKEN** |

**Windows-side targeted runs.** These ran in the worktree during the build. One full-directory run on Windows saw `FilmRoomScreenV2.focus.jsdom.test.jsx` time out under load, and it passed alone. The Linux run is the record.

## 9. The fix round (13 Nov 2026): Astra's findings and Build C Amendment A

**Executor:** Claude Code (Opus), a fresh session in its own worktree, Windows + WSL · **Prompt:** the Film Room chat's fix prompt of 13 Nov 2026 · **Governs:** Astra's C1 review (`docs/audits/20261113_ASTRA_REVIEW_FILM_ROOM_C1_CHAIN.md`) and Build C Amendment A (`docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_A_20261113.md`), both committed verbatim in B0; the Practice Field's shared contract V2 (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md` on `main`) §4.3, §4.4, §5.2, §7, §8.
**Start:** `git fetch origin`; PR #1049's head was `b4f9e4e5` as the prompt required; the session's worktree branch was moved to it and every push goes back by refspec to `claude/film-room-c1-chain`. `main` had moved past the prompt's `9ca96ff2` to **`29e8f4de`** (#1051 T0b and #1047 T0c landed after T0a #1046). `main` was not merged into the branch (CI tests the PR's merge result; the guard's base `c37baa0d` stays an ancestor). Every check below ran on a local merge of the branch with `29e8f4de`; the lockfile is unchanged since `c37baa0d`.

### 9.0 Verdict

| Question | Answer |
|---|---|
| Astra's three findings | **Fixed.** F1: a new nomination re-checks its filed source inside its transaction (`035c9f7d`). F2: the builder's output is checked before either write (`4c6ff974`). F3: a create row is recognised by its shape, now tied to the stored route (`0573f577`, `64f17c58`). |
| Amendment A | **Built as written**: CA-1, CA-2, CA-3, CA-4, CA-5, CA-7, CA-9, CA-11, CA-12, CA-14, CA-17, CA-18, CA-22, CA-23 in code; CA-13 as a script never run against production; the rest are record-only rulings (CA-0, CA-6, CA-8, CA-10, CA-15, CA-16, CA-19; CA-20 in §9.3; CA-21 in §9.10). |
| Backlog §5 | The helper's instant guard takes only a full ISO 8601 instant (`2c4c7ecd`). |
| The flag | `FILM_ROOM_CARDS_MODE` is still `'allowlist'`. No QA pass, no flip. |
| Does anything reach a player today? | No cards-off change (the twelve goldens are byte-identical, §9.4). With cards on, the receipt's chain, labels, groups and words change; "Offer to your agent" shows for no one until a book exists (the seam still answers no book). |
| §2 review | Three static lenses, one refuter for every finding, then a mutating lens, each on its own LF snapshot. **One BLOCKER, of F2's class, found and fixed** (the withdrawal builder could pass by editing its input). The refuter refuted none and narrowed four. See §9.7. |
| Needs a ruling | §9.11. None blocks the merge. |

### 9.1 The fixes, one row each

Every fix is one commit with its tests in the same commit; the review's fixes follow in §9.7. The mutants named here are the prompt's, run in the final battery (§9.8).

| # | Item | Commit | What changed (code head) | Tests | Mutants |
|---|---|---|---|---|---|
| B0 | Astra's review and Amendment A, verbatim; two index rows | `11bc02f0` | Both extracted by script between the prompt's markers, LF; the staged blobs byte-compared with the extraction | — | — |
| 1 | **F1**, a new nomination re-checks its source | `035c9f7d` | `nominateCard` takes a required `verifySource(tx, entry, agentId)`, called after the stage check and before the book (`cardStore.js`); the route's `verifyEntrySourceIn` (`card.js`) re-reads **through the transaction** the battle (owner, mode, attribution by the platform's pure resolver over the clone read in the transaction) and the tape day (the create path's own `checkDayIn`: coverage, exact moment, situation version, archetype). A missing verifier is refused before any read | `card.test.js` 8 new blocks (one loops over 12 source changes; the race and its control, the replay, a repointed or missing clone, the order, no verifier); emulator 3 (five changes in one row, the replay, the tape locked by the transaction) | M01 |
| 2 | **F2**, the builder's output checked | `4c6ff974` | `nominationRecordDefectOf` before either write, both paths; a malformed record is a server fault (the route's 500), nothing written; `calendar_unavailable` stays 503 | `card.test.js` 3 blocks (one loops over the malformed outputs, now 22, on both paths; the extra-field control; the calendar) | M02, M03 |
| 3 | **F3**, no invented "Filed" | `0573f577` | `isCreateRow`: the first row, no event, not a server's, at the create's stage; any other first row is judged as any other row | screen suite 4 blocks (Astra's repro through the real handler and counter; the pure cases) | M04 |
| 4 | **CA-3**, the open predicate and "Not taken" | `1298d5ee` | `OPEN_STAGES` = `card`, `testing`; `isOpenStage` decides `nominated` (closed by a declined, expired or withdrawn copy) and `tested`; `groupCards` gains `notTaken` before the parked fallback; the renderer and its state note | store 4 blocks (two over declined and expired), screen 3 (two over declined and expired) | M05, M06 |
| 5 | **CA-1, CA-2, CA-5's retire side** | `677d5815` | `isRetirableByPlayer` (store and receipt); the withdrawal transaction; `buildWithdrawal` in the seam; 503 `nomination_unavailable`; "Withdrawn and retired"; the sixth write site (CA-20) | store 19 blocks (loops over record states and seven malformed builders), handler 3, emulator 4, screen 4 | M07–M11 |
| 6 | **CA-11, CA-4** | `e0781fb4` | `NOMINATION_ORDER` judged against the copy; `testing` bound to the accepted copy's `ideaId`; rows keep `state`, `reason`, `consideredAt` (and an acceptance's `ideaId`, `thesis`); thesis ≤ 400 and closing note ≤ 600 code points with their own instants; the chain quotes each row at its own time | store 10 blocks (one exhaustive from × to), screen 3 | M12–M17 |
| 7 | **CA-5, CA-14, CA-22** | `9c159e2d` | `offered` (one per card, bound to the idea, `event: 'offered'`); `installed` and the server `retired` bound to the idea and the offer; `tested` from `nominated` with `noFill: true`, setting `idea` from the copy | store 10 blocks, screen 3 | M18–M24 |
| 8 | **CA-12**, the book re-read | `e79354c6` | `requireOpenBookIn` at the precondition's place on both paths; `bookIsForAgent` in the seam; contention rethrown; book fixtures gain their document | store 6 blocks (one over ten book defects), handler 2, emulator 1 | M25–M27 |
| 9 | **CA-9, CA-17** | `84abd0e5` | "Your agent considered this"; `stageLabelOf`, the one stage-word reader, by the stored route | screen 3 blocks | M31, M34, M35 |
| 10 | **CA-7**, "Offer to your agent" | `f2cedf99` | the hook's `nominate`, the parent's `onNominate`, the receipt's button (strict `book.open === true`), its own op id, its refusal words | screen 7 blocks | M28–M30 |
| 11 | **CA-23, CA-18** | `b2eafc8d` | the `cap_reached` words, server and screen; `setNoTempo` and its inventory row retired (413 keys, 560 entries) | handler 1 block (a full mix with nothing retirable) | M32, M33 |
| 12 | **Backlog §5**, the instant guard | `2c4c7ecd` | `isInstant`: a date-time with a time and an offset (or `Z`) on a real calendar date and clock that `Date.parse` also reads | store 3 blocks | M36 |
| 13 | **CA-13**, the census script | `d0e60f6f` | `scripts/census-film-room-v1-plays.mjs`: one read, `plays` collection group, `select('route', 'stage')`, no filter; counts only, under fixed buckets; the write-grep gate; the credential from the environment or a hidden prompt | `census-film-room-v1-plays.test.js` 5 blocks | M37, M38 |

### 9.2 Readings this round took (stated, built, pinned)

1. **F1's place in the order.** Nominate judges the source after the owner, replay, version and stage, and **before the book**, as a create judges its source before its book. With no book (everyone today), a nominate whose source changed answers the source error, not `book_not_open`. Pinned by "THE ORDER, pinned". The alternative (book first) is a ruling (§9.11).
2. **F1's battle checks** are the create path's, judged through the transaction: missing → 404 `not_found` ("Battle not found."), not the caller's or not attributed to the entry's agent → 403 `forbidden`, a mode the tape does not cover → 409 `untaped`, a clone that resolves to no parent → 503 `attribution_unavailable`. A failed battle read is the route's 500, as create's `readBattle` is.
3. **F1 on the emulator.** A write to a document an Admin SDK transaction has read waits for that transaction (the emulator locks what a transaction reads; awaiting such a write inside the callback deadlocked until the 60 s timeout). So the emulator row proves the tape is in the read set by the lock: a removal begun after the read lands only after the commit. The in-memory suite proves the retry judges the changed tape again.
4. **F2's refusal** is the route's 500 (a server fault: the Practice Field's builder broke its contract), with nothing written. No player copy was invented for it.
5. **CA-2's malformed record** (an unknown state, a record naming another entry, a failed read, a builder that throws or returns a malformed record) is 503 `nomination_unavailable`, as ruled; the record's source is copied before the builder runs.
6. **CA-3's group order** on My cards: Active, Shelved, Not taken, Parked, Equipped, Retired, Other.
7. **CA-5's waiting-offer line after the offer is answered.** "An offer waits in the Forge" is drawn only while the card is `tested` and that same offer still waits (parked or not). Once installed or retired by the server, the offered row draws no line; the stage's own line ("Equipped", "Retired · Forge offer {state}") says what became of it.
8. **CA-7's words.** The refusal table is built verbatim. Its first sentence says "since it was filed", while the amendment also says the words "never say 'filed'"; the build reads that as never "Nothing was filed" / "could not be filed" (pinned). A code the table does not name uses the receipt's existing words for it; a code with none says "The card could not be offered." (one new key, the offer's own default). The battle-level F1 refusals (`not_found`, `forbidden`, `untaped`) are such codes.
9. **CA-7's agent.** The receipt's offer names the agent the card is filed under (its own `agentId`, a casual clone's parent), so a lost answer re-tapped after the clone document changed is still its own replay (§9.7, A2).
10. **CA-9's time.** "Your agent considered this · {date}" carries the row's own time, like every other answer line; `consideredAt` is a quotation's time and `considered` quotes nothing.
11. **CA-13's credential.** The script takes the service-account JSON from `FIREBASE_ADMIN_CREDENTIALS` when the process holds it, else from its own hidden prompt (nothing echoed; the input ends when it parses, so a multi-line paste is taken whole). It never reads an `.env` file. The drill line names how many drill entries are not yet retired.
12. **CA-17's chain words.** The chain's state lines (Offered, Tested, Equipped …) name events in their own words; every chain line that names a *stage* (a v1 `drill` row, an unknown stage) goes through `stageLabelOf`, as the route line and My cards do.
13. **CA-22's one fact.** The chain's "Ended before its first trade" and the stage word both read `result.noFill` (`endedBeforeFirstFill`); the history row's `noFill` is stored beside it as provenance. They are written together in one patch, so they agree; split data shows "tested" everywhere rather than two words.
14. **The instant guard** accepts a time without seconds (`2026-11-12T15:00Z`): it is a full date-time with an offset.

### 9.3 The protected-store change

`api/_utils/compositionProtectedStoresAllowlist.json` gains **one key**: `api/_utils/filmRoom/cardStore.js::retireCard::set::unresolved` at **count 1** — the withdrawal of the record, `mandates/{bookId}/nominations/{nominationId}` at the entry's own ids, a `tx.set` beside the retire's one `tx.update` (whose key stays at count 1). The human note under `_notes_film_room_c1` names it in its title and body, and now also names `offered` and CA-22's direct `tested` in the transition helper's line and the nomination copy the retire's update carries (the review's F-C3). The full suite's deny-by-default scan is green with it. **The founder reviews it with this PR.**

### 9.4 The goldens

**Re-captured; all twelve byte-identical to `main`'s.** The capture harness (`src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx`, `FILM_ROOM_V2_GOLDEN_OUT_DIR` set, `TZ=UTC`) ran twice in the WSL worktree holding the local merge of the final code head `9f08deb4` with `main` `29e8f4de` (tree `96859446`; also at `5f8e19ad`, tree `89462e32`, with the same result). Both runs wrote twelve files, and every file equals the other run's, the committed golden and `main`'s own blob byte for byte (SHA-256 prefixes: empty deep desktop `39b82e03`, phone `b9e9bbe3`; empty glance `a180e9c2` / `5d61ab17`; empty study `2dc16ebe` / `5f5e7dbe`; sep23 deep `ffadf417` / `e502efb6`; sep23 glance `46395190` / `d59c474a`; sep23 study `093131f5` / `7cb13597`). No golden moved, so there is no difference to map, and criterion 10's declared cards-off changes are still only §8's rulings 1 and 2. CA-18 removed a key no screen read. The comparison suite (`FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx`) is green in the full suite.

### 9.5 Fence statement

- **BUILD_RULES §1: zero edits**; `api/cron/agent-evaluate.js` untouched. No fenced function is called by the new code.
- **Not in the diff:** `api/_utils/casualClone.js` (its `resolveRecordTargetId` is *called* by `card.js`, never edited), `firestore.rules`, `firestore.indexes.json`, `src/config/featureFlags.js`, `src/components/CommandCenter/**`, every `api/_utils/mandate*.js`, the setup evaluator, `activationEvidence/**`, the workflow and the CI guard, `api/_utils/filmRoom/oneDoor.census.test.js`. Checked by grep over `git diff --name-only c37baa0d..HEAD`, and independently by lens C.
- **The book.** Nothing in the Film Room writes a book document except the nomination record (the card endpoint's transaction: the Offer create, `nominateCard`) and CA-2's withdrawal (the retire transaction), both through the seam's builders, both checked. `mandates/{bookId}` itself is only read.
- **`FILM_ROOM_CARDS_MODE` is `'allowlist'`** (`src/config/featureFlags.js:3526`, untouched).
- **Nothing outside the branch:** no merge into the branch, no production read or write, no backfill, refresh, deploy or flip. The CA-13 script was never run against production.
- **BUILD_RULES §4.** `card.js` now imports `resolveRecordTargetId` (`casualClone.js`) and `isCasualCloneId` (`src/constants/leagueTournament.js`); both were already in the graph through `cardStore.js`, and `card.test.js`'s unmocked import of the route is their guard. The census script imports `src/data/cardStages.js` (zero-import) and `api/_utils/filmTape/errorClass.js` (zero-import); its test's import is its guard.

### 9.6 The checks, on the merged tree

`origin/main` was `29e8f4de` at the last fetch. The branch was merged locally (a throwaway merge in a git worktree of `~/pd-ci`, never pushed): final code head **`9f08deb4`**, merged tree **`96859446`**, identical to `git merge-tree` on Windows (the report commit after it changes only `docs/`; the pushed head's own merge was built once more before the push, exit 0). The lockfile equals `c37baa0d`'s (`40382e64edb6`), and the run linked a real install of it. The run used Node 20.20.2 and `TZ=UTC`.

| Check | Result |
|---|---|
| Full vitest suite (8 workers, under the shared flock) | exit 0, 248 s: **1,415 files passed, 9 skipped (1,424); 31,612 rows: 31,513 passed, 0 failed, 99 skipped** |
| Earlier full runs on the same kind of merge | `d0e60f6f` (before the review's fixes): 31,469 passed, 0 failed; `5f8e19ad` (before the Astra §4 rows): 31,493 passed, 0 failed |
| Rules suite (the Firestore emulator, Temurin JDK 21) | **41 files, 768 / 768** — `filmRoomCardAttribution.rules.mjs` 21 (13 before: F1's three, CA-2's four, CA-12's one), `filmRoomPlaysDenials.rules.mjs` 22, `filmRoomCardReplayOwner.rules.mjs` 3 |
| `lint:gate` | exit 0 |
| `vite build` | exit 0 (built in 14.7 s; two CSS-syntax warnings from files this round does not touch) |
| One-door census, acceptance C | green in the full suite. Acceptance C's populated handle now also holds a live, active idea book (`mandates/book-c`, CA-12), and the assembled prompts stay byte-identical with T0a's, T0b's and T0c's Mandate files merged in. |
| The stage census, the protected-store scan | green (the scan with the new `retireCard::set` key at count 1) |
| Cards-off goldens | 12 / 12 byte-identical (§9.4) |

**Windows-side runs** during the build ran each touched suite in the worktree. One whole-directory run saw `FilmRoomScreenV2.focus.jsdom.test.jsx` time out under load and pass alone (the known Windows load case of §8). The Linux run is the record.

### 9.7 The §2 review

The round's diff passes BUILD_RULES §2's threshold (23 files, +3,827 / −174 against `b4f9e4e5`, docs included; the branch is 35 files against `c37baa0d`), so the review was multi-lens and adversarial. Every reviewer worked on its own LF `git archive` snapshot, path-distinct, read-only on git and the working tree, probes inside its snapshot only.

**Who ran.**
- Three static lenses on `d0e60f6f`: A (server correctness), B (screen honesty and the rulings' words), C (fences, cards-off, test integrity, the census script).
- One refuter for every finding, on a fresh snapshot of `d0e60f6f`, told to refute each with a concrete repro.
- The mutating lens D, last, on its own snapshot of `5e511f3c` (after the first fixes): 53 mutants of its own choosing, judged by exit code and a fresh JSON report.

**Result: one BLOCKER, found and fixed.** The refuter refuted none outright and narrowed four (A1, A2, A5, C5). Every finding has a row or a written disposition.

| Id | Severity (refuter) | Finding | Disposition |
|---|---|---|---|
| A1 | BLOCKER, narrowed to F2's class | `withdrawalOf` handed the stored record to `buildWithdrawal` and compared the output's source with that same object, so a builder that **edits its input in place** to name another entry passed and the retire committed it | **Fixed** `80ee61e6`: the source reference is copied before the builder runs and the output compared with the copy. Row + mutant R01 |
| A5 / C2 | MINOR, narrowed (needs planted data or an injected builder) | the retire never checked that the record at the copy's ids names this entry (`source: {}` passed through `undefined === undefined`) | **Fixed** `80ee61e6`: a film_room_card record naming the retired entry, or 503. Rows + R02 |
| A2 | SHOULD-FIX, narrowed (RK-1's route order predates the round; CA-7 newly sends clone-named nominates from the screen) | a lost answer re-tapped from a casual clone's battle after the clone document changed could no longer be replayed (503 / 404) | **Fixed** `7d8a93d9`: the receipt's offer names the agent the card is filed under (its parent); the replay answers. Retire and park keep RK-1's order (§9.11). Row + R16 |
| A3 | MINOR | a withdrawal builder throwing a contention-shaped code was rethrown raw | **Fixed** `80ee61e6`: any builder throw is 503. Row + R03 |
| A4 | MINOR | F2's check passed an `expiresAt` before `queuedAt`, an empty `stateHistory`, a `queuedAt` that is not the instant handed in | **Fixed** `80ee61e6`. Rows + R04–R06 |
| A6 | QUESTION | a server retire with `offerId` omitted passed as null | **Fixed** to the letter (`offerId` must be sent; `null` with no offer). Row + R07 |
| C1 | MINOR | the battle and clone reads of F1 had no race row (moving either outside the transaction survived) | **Rows** `80ee61e6` (a change between read and commit retries and refuses 403). R08, R09 |
| B1 | SHOULD-FIX | a Watch or Set card's player `nominated` row at index 0 still drew "Filed" — F3's contradiction through another first row | **Fixed** `64f17c58`: the create row is the stored route's (`createStageOf`). Rows + R10 |
| B2 | MINOR | a server row at `nominated` with no event drew the player's "Offered to your agent" | **Fixed** `64f17c58`. Row + R11 |
| B3 | MINOR (BUILD_RULES §9) | "Ended before its first trade" was read from two sources (the row's flag, the result's) | **Fixed** `64f17c58`: one reader, `endedBeforeFirstFill` (`result.noFill`). Row + R12 |
| C3 | MINOR | the census's route × stage table and rendered lines were barely pinned | **Rows** `5e511f3c`, `7d8a93d9`. R15, R17, R18 |
| C4 | MINOR | the census's drill line counted retired drill entries as needing retirement | **Fixed** `5e511f3c`: "not yet retired: n". Row + R13 |
| C5 | MINOR, narrowed (the shell half unverified: no terminal) | the hidden prompt ended at the first newline, so a multi-line service account was refused | **Fixed** `5e511f3c`: the input ends when it parses (or at Ctrl-D / the end of a pipe). Rows + R14 |
| F-C3 | MINOR | the allowlist's human notes were stale (counts exact) | **Fixed** `5e511f3c` (§9.3) |
| F-C7 | QUESTION | with no book, a nominate does source reads and answers a source refusal before `book_not_open` | Reading 1 (§9.2); ruling asked (§9.11) |
| B4 | MINOR | a nominate refused because the card became shelved says "This card has already moved." (the receipt's existing words for `illegal_transition`) | Recorded; the Offer button never shows on a shelved card (row) |
| B5 | QUESTION | which F1 refusals count as "source" for CA-7's one sentence | Reading 8 (§9.2); ruling asked |
| B6 | QUESTION | CA-7's sentence says "since it was filed" while the amendment says the words never say "filed" | Reading 8 (§9.2); ruling asked |
| B7 | QUESTION | CA-9's line shows the row's time, not `consideredAt` | Reading 10 (§9.2) |
| B8 | QUESTION | a no-fill card later parked shows "Parked" as its latest line (R-C1-1), "ended before its first trade" in My cards | Recorded (R-C1-1's rule) |
| PA-3 | MINOR (predates the round) | `createCard` on the Offer route without a source verifier writes both halves; the route always passes one | Recorded |
| PA-7 | QUESTION | with an offer waiting, an `offered` naming another idea answers `nomination_mismatch` before `illegal_transition {offerState}` | Recorded (CA-5 orders neither) |

**Astra's §4 pinning tests, walked.** The prompt asks for Astra's §4 rows; each ruling's "Pinning test" column was checked against the suite. Three gaps had no row and now have one (`9f08deb4`):
- CA-2's **full cross-product**: a copy queued, considered or deferred × a record in every state and none. The record decides.
- CA-2's **write abort points**: the record's write or the entry's write refused. Neither half commits.
- CA-12's **book changed between the re-read and the commit**, field by field (status, owner, kind, agent), on both the nominate and the Offer create.

The same commit adds CA-4's "no closing note, no quotation" assertion, and the census row that CA-3's "the census pins the new predicate" asks for: no listed reader names `OPEN_STAGES` or holds its own list of closing nomination states, with a planted bite in every reader. Four mutants confirm the new rows bite: the withdrawal written outside the transaction; a declined record's state not copied; the book's agent field unchecked; a reader reading `OPEN_STAGES`. Two of Astra's rows belong to the Practice Field's own side and are not built here: its admission re-reading the record, and its conformance to CA-11's table (CA-21 items 5 and 10).

**The mutating lens (D).** 53 mutants on `5e511f3c`: **47 KILLED, 6 SURVIVED, 0 BROKEN**, no equivalent survivor. The six were three test gaps, each now pinned (`5f8e19ad`; the first by `7d8a93d9`) and re-run in the final battery:

| Gap | The survivors | The row that kills them |
|---|---|---|
| LD-1 | the census's by-route and by-stage lines printing a total | the rendered lines pinned line for line (LD1-C08, LD1-C09) |
| LD-2 | the hidden prompt's erase keys deleted or half-deleted | DEL and backspace each correct a typed character (LD2-C07, LD2-C02) |
| LD-3 | Offer and Retire both enabled while the other is in flight | each disabled while the other runs, enabled when it settles (LD3-V08, LD3-V10) |

### 9.8 The mutant battery

Run at the final code head `9f08deb4` in an LF `git archive` of it (never the working tree), `node_modules` junctioned, each mutant judged by its exit code **and** a fresh JSON report. Every `from` had to match exactly once; the file's bytes were copied first and restored after, verified by byte comparison; the ids run were compared with the ids defined. **66 of 66 KILLED, 0 SURVIVED, 0 BROKEN** (the same 62 had also all been killed at `5f8e19ad`). The failed / total rows follow each id.

| Group | Mutants (failed / total rows) |
|---|---|
| F1 – F3 | M01 a new nominate that skips the source check (18/108) · M02 a builder output with a wrong `entryId` committed (4/108) · M03 one with `state: 'accepted'` (2/108) · M04 an unknown first row drawn as Filed (3/133) |
| CA-3 | M05 a declined or expired card counted open (7/248) · M06 a not-taken card listed under Parked (3/133) |
| CA-1, CA-2 | M07 a `testing` retire accepted (5/248) · M08 an accepted record with a queued copy retired (4/223) · M09 a withdrawal that leaves the record `queued` (8/223) · M10 a failed record read that retires anyway (1/115) · M11 ABORTED swallowed (1/115) |
| CA-11 | M12 "declined, then `testing`" (1/115) · M13 "deferred, then `expired`" (2/115) · M14 `testing` with another `ideaId` (1/115) · M15 a later copy overwriting an earlier answer's quotation (2/133) |
| CA-4 | M16 a 401-code-point thesis stored (1/115) · M17 a quotation dated with the delivery time (2/133) |
| CA-5, CA-14 | M18 `offered` drawn as a second "Tested" (1/133) · M19 `installed` with no offer (1/115) · M20 `installed` with no idea passing (1/115) · M21 the server `retired` with no idea passing (1/115) · M22 a second offer replacing a waiting one (1/115) |
| CA-22 | M23 `tested` from `nominated` without `noFill` (1/115) · M24 "Ended before its first trade" drawn from a missing `testing` row (1/133) · M35 the stage word without the fact (1/133) |
| CA-12 | M25 the book re-read skipped (22/223) · M26 a closed book accepted (7/223) · M27 a successful replay refused after the book closed (6/115) |
| CA-7 | M28 the Offer button with `book` missing (1/133) · M29 with the counter still loading (1/133) · M30 two taps minting two ids (1/133) |
| CA-17, CA-9 | M31 a v1 Watch card's nomination drawn as "nominated for the Practice Field" (1/133) · M34 considered drawn as a generic answer (1/133) |
| CA-23 | M32 "Retire a card first" back on the server (1/108) · M33 on the screen (1/133) |
| Backlog §5, CA-13 | M36 the instant guard as `Date.parse` alone (2/115) · M37 a filter on the census's read (2/12) · M38 a raw unknown value printed (5/12) |
| The review's fixes | R01–R18 (A1's in-place builder, a record of another entry, an ABORTED-coded builder, F2's clock and history ×3, an omitted `offerId`, the battle and the clone read outside the transaction, any create stage, a server row's Offered line, the row's no-fill flag, the drill line, the first newline, the table and render misfiles ×3, the offer naming the clone): each 1–3 failed |
| The mutating lens's survivors | LD1 ×2, LD2 ×2, LD3 ×2: each 1–2 failed |
| Astra §4's rows | the withdrawal written outside the transaction · a declined record's state not copied · the book's agent field unchecked · a reader reading `OPEN_STAGES`: each killed |

### 9.9 The Tests run

BUILD_RULES §2: not watched, polled or fixed. Astra read the Tests run of the previous head `b4f9e4e5` once: success, both jobs, the golden guard not tripped. This head's run is read once after the push, and its state is reported on the PR. The branch still has `c37baa0d` as an ancestor, so the guard's base relation is unchanged.

### 9.10 What CA-21 asks of the Practice Field: the seam's contract

`api/_utils/filmRoom/practiceFieldSeam.js` now holds **four** Practice Field helpers. Each has a default the Film Room ships with, and each is the Practice Field's to replace.

| Helper | Contract the Film Room relies on | Default until replaced | Owner |
|---|---|---|---|
| `bookForOwner(db, { uid, attributionAgentId })` | One server-side read, before the transaction. Returns `{ bookId, status }` for the owner's **idea book** managed by that attribution agent (the ranked parent for a casual clone), or `null`. CA-12: it returns idea books only. The Film Room sends a client nothing of it but the counter's `book: { open }`. A throw is treated as no open book. | `null` for everyone; reads nothing | T1a |
| `bookIsForAgent(bookDoc, attributionAgentId)` (CA-12, new) | **Pure.** Runs inside the nominate and Offer transactions, over `mandates/{bookId}` as the transaction re-read it. Answers `true` only when the book is that attribution agent's. A throw, or any answer but `true`, refuses `book_not_open`. | Compares a field named `attributionAgentId` | T1a, which names the book's real attribution field |
| `buildNominationDoc({ entryId, situationId, questionId, questionVersion, nowIso, expiresAfterSessions })` | **Pure.** Returns the record written at `mandates/{bookId}/nominations/{nominationId}` in the same transaction as the entry's move to `nominated`. F2: before either write the Film Room checks a plain object, `state: 'queued'`, `source` a plain object of kind `film_room_card` naming exactly the entry, situation, question and question version it was given, `queuedAt` a full ISO instant **equal to the `nowIso` handed in** (any offset), `expiresAt` a full ISO instant **after `queuedAt`**, and a **non-empty** `stateHistory` array of plain objects (the review's A4; §9.11 item 7). Extra fields pass through untouched; anything else refuses (the route's 500), nothing written. Throw `{ code: 'calendar_unavailable' }` to refuse 503. | Contract V2 §5.2's record, `expiresAt` the close of the 10th session after the anchor | T2 |
| `buildWithdrawal(record, { nowIso })` (CA-2, new) | **Pure.** Runs inside the player's retire transaction, over the record as the transaction read it, when that record is `queued`, `considered` or `deferred`. Before calling it the Film Room requires the record to be **this card's** (a `film_room_card` source naming the retired entry) and copies that source reference; after, it checks a plain object, `state: 'withdrawn'`, and the copied source reference unchanged (so editing the input in place cannot pass). Anything else, or **any** throw, refuses 503 `nomination_unavailable`, nothing written, the card not retired. | The record with `state: 'withdrawn'`, `withdrawnAt`, and a `stateHistory` row `{ state: 'withdrawn', at, by: 'player' }` | The Practice Field (the shape's owner, as for `buildNominationDoc`) |

**Writing back onto the entry.** Later states go through `cardStore.js` `applyServerTransition(db, { entryId, ownerId, agentId, to, by, payload, opId, nowIso })`, server-only. `by` is the writer's name, kept on the row (`by: 'server', writer`). The helper is idempotent by `opId` (its own writer's rows only), checks the entry's owner and agent, and a shelved entry still transitions.

| `to` | Payload | From → to | Bound to | Refused |
|---|---|---|---|---|
| `nomination` | `{ bookId, nominationId, state, reason?, consideredAt? }`; on `accepted` also `ideaId` (required) and `thesis?` (≤ 400 code points; needs `consideredAt`) | `nominated` → `nominated` (copies onto `entry.nomination`; the row keeps `state`, `reason`, `consideredAt`, and on `accepted` `ideaId` and `thesis`) | the entry's own `bookId` / `nominationId` | `state` `queued` or `withdrawn` (400); out of CA-11's order (409 `illegal_transition { nominationState }`) |
| `testing` | `{ bookId, ideaId }` | `nominated` → `testing` (sets `idea`) | the copy's book, the copy `accepted`, and its `ideaId` | anything else 409 `nomination_mismatch` |
| `tested` | `{ ideaId, resultRef, contractCondition, economicResult, closingNote?, closingNoteAt?, noFill? }`; `closingNote` ≤ 600 code points with its instant | `testing` → `tested` (sets `result`); or (CA-22) `nominated` → `tested` with `noFill: true` and an accepted copy, which also sets `idea` from the copy | the entry's `idea.ideaId` (from `testing`) or the copy's `ideaId` (from `nominated`) | from `nominated` without `noFill: true` or with a copy not accepted: 409 `illegal_transition`; `noFill: true` from `testing`: 409 `illegal_transition` |
| `offered` (CA-5, new) | `{ ideaId, offerId, state: 'offered' }` | `tested` → `tested` (sets `offer`; the row carries `event: 'offered'`; `stageAt` and the result do not move) | `entry.idea.ideaId` (present) | an offer already held: 409 `illegal_transition { offerState }` |
| `installed` | `{ ideaId, offerId, state }` | `tested` → `installed` (sets `offer`) | `entry.idea.ideaId` and the waiting offer's `offerId` | 409 `nomination_mismatch` |
| `retired` (server) | `{ ideaId, offerId \| null, state }` | `tested` → `retired` (sets `offer`) | `entry.idea.ideaId`; the offer's `offerId` when one exists, `null` only when none does | 409 `nomination_mismatch` |

Every instant the helper takes (`nowIso`, `consideredAt`, `closingNoteAt`) must be a full ISO 8601 instant with a time and an offset (or `Z`) on a real date; a date alone or a zone-less time is refused 400.

**The relay's ten items (CA-21), restated against the code:**

1. `withdrawn` is written only by the Film Room's player retire, through `buildWithdrawal`; the helper refuses it as a copied state.
2. On `accepted` the copy carries `ideaId`, `thesis` (≤ 400) and `consideredAt`.
3. On `tested` the copy carries `closingNote` (≤ 600) and `closingNoteAt`.
4. `offered` when T3 creates an offer; `installed` and the server's `retired` carry `ideaId` and the offer's id (`null` only with no offer).
5. CA-11's table exactly (above), with its delivery and replay rules: a late copy is refused, a lost one does not block the next; a `considered` or `deferred` nomination always reaches `accepted` or `declined`, or the Practice Field names the state that closes it.
6. `bookForOwner` returns idea books only; T1a names the book's attribution-agent field for `bookIsForAgent`.
7. The calendar's horizon (CA-15): the maintained years are 2026 and 2027; from about mid-December 2027 `nominate` and the Offer create refuse 503 `calendar_unavailable` until 2028 is maintained.
8. B6: the B-slot module's path when it lands (CA-8), so a test pins `NOMINATION_EXPIRY_SESSIONS` to it.
9. Every taken card closes: `testing` then `tested` for a filled idea; `tested` directly with `noFill: true` when it ended before its first fill. A filled idea always sends `testing` first.
10. Withdrawal and acceptance: the Practice Field's acceptance and admission read the nomination record inside the transaction that writes them, and write only while it is `queued`, `considered` or `deferred`; a withdrawal is never undone on a retry; both commit orders tested on each side. The Film Room's side is pinned: a copy after the retire is refused (the entry is retired), and an acceptance landing between the retire's read and its commit makes the retire's commit conflict, retry and refuse.

### 9.11 Needs a ruling (none blocks the merge)

1. **F1's order against the book** (lens C, F-C7). Built: owner → replay → version → stage → **source** → book, as a create judges its source before its book (reading 1). With no book, a nominate whose source changed says the source error, after a few extra reads. Keep, or judge the book first?
2. **CA-7's words** (lens B, B5 and B6). Built verbatim: the one source sentence covers the six tape and archetype refusals; the battle's own refusals (`not_found`, `forbidden`, `untaped`) keep the receipt's existing words. The sentence says "since it was filed", read as allowed (only "Nothing was filed" / "could not be filed" are excluded). Confirm both readings.
3. **Retire and park from a casual clone's battle** (lens A, A2). The offer now names the card's own agent, so its lost answer survives a clone change. Retire and park still name the battle's agent and resolve it first (RK-1's order since B2.1), so a clone document deleted between a lost answer and its re-tap refuses 503. Extend the offer's choice to them?
4. **CA-9's time** (lens B, B7): the considered line carries the row's time; `consideredAt` shows only in a quotation, and considered has none. Keep?
5. **CA-11 still needs the Practice Field's agreement** on its exact edges (CA-21 item 5), and **CA-22 on its delivery order** (item 9): the Film Room side refuses anything else, as ruled.
6. **The CA-13 count before `'on'`**: the founder runs `node scripts/census-film-room-v1-plays.mjs` once (usage in its header); a `drill` entry not yet retired is retired from its receipt.
7. **F2 beyond its letter** (lens A, A4; it binds the Practice Field's T2 builder). The prompt's F2 list asks for valid `queuedAt` and `expiresAt` instants and a `stateHistory` array. Astra's §1 also asks for "valid required clock/history fields", so the review added three checks: `queuedAt` is the instant handed to the builder, `expiresAt` is after it, and the history is a non-empty array of plain rows. Keep them, or relax to the letter? Also confirm that a malformed output is the route's 500 (a server fault, nothing written, no player words; reading 4).
