# Film Room Build C spec V1 — Amendment A: rulings on the C1 build's questions (2026-11-13, revised after Astra's review)

**Status:** the founder sent the first text to Astra's C1 review on 13 Nov 2026, and approved CA-22 during it. This revision takes in the review's §4 boundaries. It adds CA-23 and the review's points to CA-21, and changes nothing that the review judged safe. The C1 fix round builds it and commits it.
**Answers:**
- the C1 build report (`docs/audits/20261112_BUILD_FILM_ROOM_C1_CHAIN.md`), §7 items 1–16, one ruling each;
- Astra's question during the review (CA-22);
- Astra's review, §4 (`docs/audits/20261113_ASTRA_REVIEW_FILM_ROOM_C1_CHAIN.md`).

It also covers the three refinements, the protected-store keys, BC-8's change and the S9 refusal.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_A_20261113.md`, with one `docs/README.md` row, committed by the C1 fix round. No docs-only PR.
**Rests on:** the Practice Field's shared contract V2, now on `main` at `docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md` (#1046), §4.3, §4.4, §5.2, §7 and §8. Where a ruling needs something from the Practice Field, CA-21 lists it, and the Film Room sends it once.

## CA-0. What stands from the build

- **The three refinements become the spec's own:**
  - **R-C1-1.** "Since last time" lists every card past `card`, with its newest chain line and time, newest first. No visit mark is stored. This replaces spec §5's "since the player's last visit".
  - **R-C1-2.** `park` is its own op.
  - **R-C1-3.** The two Practice Field helpers sit behind `practiceFieldSeam.js`, which defaults to "no book".
- **The report's §1.2 readings 1–18 stand,** except where a ruling below changes them: reading 6 (CA-1, CA-2, CA-5), reading 8 (CA-9, CA-11) and reading 16's stage word (CA-17).
- **Reading 14 stands.** Result and offer words are stored and shown exactly as written, never pinned to a list.

## CA-1. A player can't retire a `testing` card (item 1)

- **The rule.** The player's retire of a `testing` card is refused: 409 `illegal_transition`, with `{ stage: 'testing' }` and nothing else. The refusal comes after the existing owner, replay, version and shelving checks, so their precedence holds and a successful replay still answers.
- **Why.** The idea is running with the card as its source, and the card's chain must be able to receive `tested`.
- **The predicate.** The vocabulary module gains one predicate, `isRetirableByPlayer(entry)`. Both the store and the receipt read it. It covers CA-1, CA-2's copy-side rule and CA-5.
- **What doesn't change.** `isOpenStage` stays as it is for `testing`: a testing card still counts toward S9.
- **After the result,** the player parks the card or retires it, as today.

## CA-2. Retiring a nominated card withdraws it, until the agent takes it (item 2)

The retire op keeps its existing checks: owner, replay, version, shelving and the open predicate. On a `nominated` entry that holds a `nomination`, the same transaction reads the book's record before either write. It reads it at the entry's own `nomination.bookId` / `nominationId`, and the record, not the entry's copy, decides:

| The record | What happens |
|---|---|
| `accepted` | 409 `illegal_transition`, with `{ stage: 'nominated', nominationState: 'accepted' }`. Nothing is written. |
| `queued`, `considered` or `deferred` | The record moves to `withdrawn` through the seam's new pure builder, `buildWithdrawal(record, { nowIso })`. Its default sets `state: 'withdrawn'` and `withdrawnAt`, and adds a `stateHistory` row `{ state: 'withdrawn', at, by: 'player' }`. The Practice Field owns the shape, as with `buildNominationDoc`. The entry retires as today, with its copy's `state` set to `withdrawn`. |
| `declined`, `expired` or `withdrawn` | The entry retires, and its copy's `state` takes the record's state, so a retired card never says `queued` when the book says otherwise. Nothing is written to the book. |
| no document | The entry retires. Nothing is written to the book. |

- **It fails closed.** Each of these refuses with 503 `nomination_unavailable`, writes nothing and doesn't retire:
  - a record read that fails;
  - a record whose state isn't in `NOMINATION_STATES`;
  - a builder that throws;
  - a builder output that isn't a plain object with `state: 'withdrawn'` and the record's own source reference.

  Firestore contention (ABORTED) is rethrown so the transaction retries, never mapped to this refusal. The player's words: *"This card's offer could not be checked. Nothing was changed. Try again."*
- **A v1 entry** with no `nomination` (stored route `drill`) retires as today.
- **The vocabulary.** `NOMINATION_STATES` gains `withdrawn`. Only this retire writes it: the transition helper refuses `withdrawn` as a copied state (400 `invalid_transition`).
- **The screen.**
  - At `nominated`, the receipt shows Retire only while the copy is `queued`, `considered` or `deferred`, or when the entry has no copy (v1). This is through `isRetirableByPlayer`.
  - The retire line of a withdrawn card reads **"Withdrawn and retired · {date}"**.
- **Concurrency.** The transaction holds the entry and the record, so a stale copy can't bring a retired entry back, and a retire after a copy fails its version check. The Practice Field's own writes must hold the same line (CA-21, item 10).
- **The allowlist.** The record write is a new protected-store site (CA-20).
- **Why.** The player can take an offer back until the agent has acted on it. After that, the card belongs to the idea's run until the result.

## CA-3. A declined or expired nomination closes the card (item 3)

- **The predicate.**
  - `OPEN_STAGES` narrows to the stages that are open outright: `card` and `testing`.
  - `isOpenStage` decides the other two:
    - `nominated` is open unless the copy's `state` is `declined`, `expired` or `withdrawn`;
    - `tested` is open until parked, as before.
  - An entry at `nominated` with no copy (v1) stays open.
  - The stage stays `nominated` (contract V2, B-STAGE). `deferred` stays open.
- **Every reader** goes through `isOpenStage`; none reads `OPEN_STAGES` to mean "open". That covers:
  - the store's `isOpen` / `openCardCount`, and `readCards`;
  - the counter;
  - `groupCards`;
  - the receipt;
  - the harness's open-count oracle.
- **The list.** `groupCards` gains a list, `notTaken`, judged before the parked fallback; shelving keeps its precedence. The renderer's group iteration gains it too. It is labelled **"Not taken"**, with the state note **"Not taken: kept, no longer counted as open."**
- **What the player can do with it.**
  - A not-taken card can't be retired, because it isn't open.
  - It can't be offered again: `nominate` stays `card`-only, one nomination per card.
- **The census** pins the new predicate, and behaviour rows pin every reader.

## CA-4. The thesis and the closing note (item 4)

- **On `accepted`.** The `nomination` copy carries:
  - `ideaId` (required);
  - `thesis` (optional, a string of at most 400 code points);
  - `consideredAt`, which must be an instant whenever a thesis is present.

  The accepted line quotes the thesis: "— your agent, {consideredAt}". With no thesis, there is no quotation. The line never quotes `reason` in its place: a reason is quoted beside `deferred` and `declined` only.
- **On `tested`.** The payload gains `closingNote` (optional, at most 600 code points) and `closingNoteAt` (an instant, required whenever there is a note). The tested line quotes the note: "— your agent, {closingNoteAt}". With no note, there is no quotation.
- **Bounds.**
  - Code points are counted, astral characters included, and the text is kept exactly.
  - Over a bound, or with a missing or invalid time, the helper refuses with 400 `invalid_transition` and writes nothing.
  - The copy never truncates a quotation; the Practice Field bounds its fields at the source.
- **Whose time a quotation carries.** A quotation always carries its own source time: `consideredAt`, or `closingNoteAt`. Never the copy's delivery time (the history row's `at`).

## CA-5. The `offered` move (item 5)

- **The move.** `SERVER_TRANSITIONS` gains `offered`: from `tested`, the stage unchanged, setting the `offer` field. Its payload is `{ ideaId, offerId, state: 'offered' }`.
- **Its checks.**
  - `payload.ideaId` must equal `entry.idea.ideaId`, which must be present (409 `nomination_mismatch`).
  - The entry must hold no offer. While one exists, a different op is refused: 409 `illegal_transition`, with `{ offerState }`. A replay of the same op is idempotent.
- **Its history row.** The row carries `event: 'offered'` (as nomination copies carry `event: 'nomination'`), so the chain never draws a second "Tested" line. `stageAt` and the result's instant don't move.
- **The chain.** While the stage is `tested` and `offer.state` is `offered`, the chain says **"An offer waits in the Forge · {date}"**, parked or not. Its link waits for a door, as built: C1 passes none.
- **`installed` needs the offer.** It requires `entry.offer.offerId === payload.offerId`, so `offered` always comes first (CA-14).
- **Retire and park.**
  - While an offer waits, the player's retire at `tested` is refused: 409 `illegal_transition`, with `{ stage: 'tested', offerState: 'offered' }`. The player answers the offer in the Forge.
  - Parking is unaffected.

## CA-6. Ruling 2's second sentence (item 6)

Confirmed: no labelled exit-reason field exists on the screen at this head, so there is nothing to add. The 19th named mutant has no target and leaves the battery.

## CA-7. An "Offer to your agent" button on the receipt (item 7)

- **Spec §5 is amended:** "Park this card" is no longer the only new button.
- **When it shows.** A receipt for a card at `card` (any route, v1 or v2, not shelved) shows **"Offer to your agent"** only when the counter reports `book: { open: true }`, strictly `=== true`. It doesn't show while the counter loads, after a failed first read, with the field missing, or with `false`. Offer's route note sits above it.
- **What a tap does.** One tap sends `nominate`, with its own op id. The id is minted once per receipt at the first tap, as park's is, and is never shared with retire or park. A lost answer re-tapped sends the same id.
- **The wiring.** The cards hook gains `nominate`, keeping its successful result and refreshing after a refusal, beside create, retire and park. The parent passes the callback down, and the receipt takes it as a prop.
- **What a refusal says.** A refusal re-reads the counter and says why, with words that never say "filed":

  | Refusal | Words |
  |---|---|
  | every source refusal (fix F1): the moment gone or moved, the tape changed, the day unavailable, the tape or its situations missing, the archetype changed | *"This card's moment has changed on the tape since it was filed, so it can't be offered. The card stays as it is."* |
  | `tape_unreadable` | *"The tape for this day could not be read. Nothing was offered. Try again."* |
  | `attribution_unavailable` | *"The agent this card belongs to could not be resolved. Nothing was offered. Try again."* |
  | `book_not_open` | *"This card cannot be offered to your agent now. Nothing was offered."* |
  | `calendar_unavailable` | *"The offer's expiry could not be placed on the market calendar. Nothing was offered."* |
  | any other | the receipt's existing words for that code |
- **Why.** This carries out BC-3's intent: a Watch card that has recurred can be offered later.
- **Today.** No player has a book, so the button shows for no one and nobody's screen changes.

## CA-8. B6's copy (item 8)

Confirmed. When the Practice Field's B-slot module lands, a test pins `NOMINATION_EXPIRY_SESSIONS` to its B6. Until then, the copy is the one number.

## CA-9. `considered` is a state of its own (item 9)

- **What it means.** Contract V2 §5.2 runs `queued → considered → …`: the agent has looked at the nomination and has not answered yet.
- **The line.** **"Your agent considered this · {date}"**, with no quotation. A reason copied at `considered` is kept, not quoted.
- **What it replaces:** the built "Your agent's answer · considered".
- **Where it applies.** Every depth that draws `ChainLine` says the same.

## CA-10. The note keeps its place (item 10)

The B2 layout stays:
- the note sits under the card's facts, "— you";
- the chain's "Filed" line, at the chain's foot, carries no quotation.

Spec §5's table is read that way.

## CA-11. The nomination order (item 11)

After the replay check and before any write, the helper judges the move against the entry's current copy. The player's own copy is `queued`.

| From | May move to |
|---|---|
| `queued` | `considered`, `accepted`, `deferred`, `declined`, `expired` |
| `considered` | `accepted`, `deferred`, `declined` |
| `deferred` | `considered`, `accepted`, `declined` |
| `accepted`, `declined`, `expired`, `withdrawn` | nothing |

- **Anything else** is refused: 409 `illegal_transition`, with `{ nominationState }`. A replay is unaffected.
- **Expiry comes only from `queued`,** so "Not considered within 10 sessions" is always true when it is shown.
- **Late or lost copies.**
  - A copy delivered late, after a later state, is refused.
  - A copy that never arrives doesn't block the next one: `queued` can move straight to an answer.
- **`testing` needs an accepted copy.** The copy must be `accepted`, and `payload.ideaId` must equal `nomination.ideaId`, as well as the book, as built. Anything else is 409 `nomination_mismatch`.
- **History keeps every answer.**
  - Each nomination row in `stageHistory` keeps the copy's `state`, `reason` and `consideredAt`, within the same bounds.
  - The chain quotes each `deferred` or `declined` row's own reason at that row's own `consideredAt`, so a later copy never overwrites an earlier answer.
  - The chain's quotation source changes together with CA-4.
- **The Practice Field's agreement.** This table is the Film Room's ruling. Contract V2's compact arrow (`queued → considered → accepted | deferred | declined | expired`) doesn't by itself prove these exact edges, so the Practice Field is asked to adopt them (CA-21, item 5).

## CA-12. The book is re-read inside the transaction (item 12)

- **The Film Room re-reads.** `nominate` and the Offer create re-read `mandates/{bookId}` inside their transaction, in the existing book precondition's place:
  - for `nominate`, after the owner, replay, version, stage and shelving checks;
  - for the Offer create, after replay, source and archetype, and before the cap and id-conflict checks.

  So a successful replay returns before any re-read, and the order of refusals is unchanged.
- **What it requires.**
  - The book document exists.
  - `userId === uid`.
  - `kind === 'idea_book'`.
  - `status === 'active'`.
  - The seam's new pure predicate, `bookIsForAgent(bookDoc, attributionAgentId)`, answers true. T1a owns the predicate; its default compares a field named `attributionAgentId`. A predicate that throws, or answers anything but `true`, fails closed.
- **Failures.**
  - A failure is 409 `book_not_open`, with nothing written and a body that names nothing.
  - An ordinary failed read maps to the same.
  - Firestore contention (ABORTED) is rethrown so the transaction retries.
  - A book changed between the pre-read and the commit conflicts and is judged again on the retry.
- **The read before the transaction stays,** for the counter.
- **The Practice Field restricts.** T1a's `bookForOwner` returns idea books only (CA-21).
- **The withdrawal (CA-2)** doesn't check the book's status. A withdrawal is the player's answer, whatever state the book is in.

## CA-13. Stored v1 Practice entries (item 13)

- **The script.** The fix round adds a read-only census script. It reads the `plays` collection group with field selection (`route`, `stage`) and no filter, so it needs no index. It prints counts by route and stage only: no ids, no owners, with honest buckets for a missing or unknown field. It makes no write call.
- **Who runs it.** CC writes it and never runs it against production. The founder runs it once, before `'on'`, with the secret entered through the hidden prompt.
- **If any `drill` entry exists,** the founder retires it from its receipt (CA-2's v1 case).

## CA-14. `installed` and the server's `retired` are bound to the idea (item 14)

- **The idea.**
  - Both payloads gain `ideaId`, bound to `entry.idea.ideaId`, which must be present. A missing idea never passes as `undefined === undefined`.
  - Anything else is 409 `nomination_mismatch`.
- **The offer.**
  - `installed` requires the entry's offer and a matching `offerId`.
  - A server retire with an offer requires a matching `offerId`.
  - A server retire without one sends `offerId: null`, and the entry must hold none.
- **The words** stay verbatim (reading 14).

## CA-15. The nomination clock (item 15)

- **The convention, confirmed.** The anchor session is session 0. `expiresAt` is the close of the 10th session after it, on the calendar of record.
- **The calendar's horizon goes to the Practice Field (CA-21).** The maintained years are 2026 and 2027. From about mid-December 2027, `nominate` and the Offer create refuse 503 `calendar_unavailable` until 2028 is maintained.

## CA-16. Ruling 2 stays narrow (item 16)

Confirmed: "Exit by platform rule · stagnation" keeps its reason (RJ-4).

## CA-17. The stage word for an offered card

- **The rule.** One label reader names a card's stage for:
  - the receipt's route line;
  - My cards;
  - the chain;
  - "Since last time".

  At `nominated`, it reads **"offered to your agent"**, except for an entry whose stored route is `drill`. That entry keeps "nominated for the Practice Field", as reading 16 rules for its chain.
- **What decides it.** The stored route, not the vocabulary version. A v1 Watch or Set card offered after C1 stays v1 (no `stageVocabVersion` is added), and it reads "offered to your agent", because it was.
- **The census** keeps covering `stageWords`.
- **Why.** The route line and the chain should say the same thing. The old phrase was the retired Practice route's.

## CA-18. The unread Set key

- **The key.** `setNoTempo` ("No tempo setting was recorded for this battle.") is unread since the founder's FQ-1 on #1019, which made every battle link.
- **The change.** The fix round retires the key and its inventory row, and reconciles the inventory's total with the amendment's new keys.

## CA-19. BC-8, as the founder amended it (12 Nov)

- **The QA pass and the `'on'` flip come after C3,** not after C1.
- **C1 and C2 merge** with the flag at `'allowlist'`.
- **The reissued QA brief** covers the whole arc.

## CA-20. The protected-store keys

- **The five keys** under `_notes_film_room_c1` are the new ops' own writes. Astra matched each to its one site:
  - the Offer create's record;
  - nominate's two writes;
  - park;
  - the transition helper.
- **CA-2 adds a sixth write site.**
  - If the withdrawal uses `tx.set`, the key is `retireCard::set::unresolved`, at count 1.
  - If it uses a second `tx.update`, the existing retire update key's count becomes 2 instead.

  The fix round adds exactly what the code needs, never an unused key, and updates the note.
- **Approval.** The Film Room chat recommends approving them. The founder's merge approves them. That approval waives no finding.

## CA-21. What the Practice Field is asked for

These go in one relay, together with spec §13:
1. **`withdrawn`.** A nomination state written only by the Film Room's player retire, through `buildWithdrawal`, whose shape the Practice Field owns.
2. **The thesis.** On `accepted`, the copy carries `ideaId`, the idea's `thesis` (at most 400 code points) and `consideredAt`.
3. **The closing note.** On `tested`, the copy carries the result's closing note (at most 600) and its time.
4. **The offer moves.** An `offered` move when T3 creates an offer. `installed` and the server `retired` carry `ideaId` and the offer's id.
5. **The order.** CA-11's state table, adopted exactly, with its delivery and replay rules. In particular, a `considered` or `deferred` nomination always reaches `accepted` or `declined`, or the Practice Field names the state that closes it.
6. **The book.** `bookForOwner` returns idea books only. Name the book's attribution-agent field, for `bookIsForAgent`.
7. **The calendar.** Its horizon (CA-15).
8. **B6.** The B-slot module's path, when it lands (CA-8).
9. **Every taken card closes.**
   - For every idea that took a card, the Practice Field writes `testing` and then `tested`.
   - When the idea ends before its first fill, it writes `tested` directly, with `noFill: true` (CA-22).
   - A filled idea always sends `testing` before `tested`.
10. **Withdrawal and acceptance.**
    - The Practice Field's acceptance and admission read the nomination record inside the transaction that writes them, and write only when the record is still `queued`, `considered` or `deferred`.
    - A withdrawal is never undone on a retry.
    - A check before the transaction followed by an unconditional write is not enough.
    - Both commit orders are tested on each side.

## CA-22. An idea that ends before its first fill (asked by Astra during the C1 review)

- **The contract doesn't settle it.**
  - §7 writes `testing` only at the first executed fill, and `tested` at any terminal result, `inconclusive` and `abandoned` included.
  - §4.3 records an abandonment, and lets `entering` fill partly.

  So an accepted idea can end with nothing filled. Treat it as possible.
- **The move.** The helper's `tested` may come from `testing`, as before. Or it may come from `nominated`, but only when all three hold:
  - the copy is `accepted`;
  - `payload.ideaId` equals `nomination.ideaId`;
  - the payload carries `noFill: true`. This is the Practice Field's own fact that nothing was filled, never inferred.

  From `nominated`, the one transaction also sets `idea: { bookId, ideaId }` from the copy, with one history row and one version increment, so CA-14's bindings hold. This is a named exception to the one-field patch, not a general spread of the payload.
- **Refusals.** Anything else is refused:
  - `tested` from `nominated` without `noFill: true`, or with another state, is 409 `illegal_transition`;
  - another idea is 409 `nomination_mismatch`;
  - `noFill: true` from `testing` is 409 `illegal_transition`.
- **The record.** `result.noFill: true` and the history row's `noFill: true` are stored.
- **The words.** Read from the stored flag, never from a missing `testing` row, the card says:
  - in the chain, **"Ended before its first trade · {date}"**, with the result's own words as stored and the closing note's quotation (CA-4);
  - on the route line, in My cards and in "Since last time", the stage word **"ended before its first trade"**, through CA-17's one label reader.

  It never says "Tested". A normal `testing → tested` card still says "Tested".
- **After it,** the card is `tested` like any other: it counts open until parked or retired.
- **Why.** With CA-1 and CA-2 refusing the player's retire, an accepted card needs a way out that doesn't depend on a fill. Now it always has one: `testing` then `tested`, or `tested` directly with the Practice Field's no-fill fact.

## CA-23. The S9 refusal tells the truth (Astra's review, cross-ruling 1)

- **The problem.** After CA-1, CA-2 and CA-5, a full set of open cards may hold nothing the player can retire: a testing card, an accepted nomination, a result with an offer waiting.
- **The new words.** "Retire a card first" goes, on both the server and the screen. The `cap_reached` words become:
  - server: *"The open-card cap for this agent is reached. A card stops counting once it is retired, parked, equipped or not taken."*
  - screen: *"The open-card cap is reached. A card stops counting once it is retired, parked, equipped or not taken."*
- **The test.** A row pins the words against a full mix with no retirable card.

## What the fix round builds

| Ruling | Code |
|---|---|
| CA-1, CA-2, CA-3, CA-4, CA-5, CA-7, CA-9, CA-11, CA-12, CA-14, CA-17, CA-18, CA-22, CA-23 | yes |
| CA-13 | the script only |
| CA-0, CA-6, CA-8, CA-10, CA-15, CA-16, CA-19, CA-20, CA-21 | record only |

**The off path doesn't move.** Every code ruling sits behind the cards flag or the "no book" seam, except CA-18, which removes an unread key. The twelve cards-off goldens stay byte-identical.
