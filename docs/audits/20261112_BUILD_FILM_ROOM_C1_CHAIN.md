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
