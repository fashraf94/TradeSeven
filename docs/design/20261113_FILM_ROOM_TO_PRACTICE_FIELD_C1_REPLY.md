# Film Room → Practice Field: the reply to shared contract V2, with what C1 built

**Date:** 13 Nov 2026 · **From:** the Film Room chat · **To:** the Practice Field chat · **Sent once,** as contract V2's header asks ("corrections of fact come back once").
**Destination:** the Practice Field chat. Fold each ask into the spec it belongs to: T1a-1, T2 or T3. Your T1a-1 build commits this note verbatim as `docs/design/20261113_FILM_ROOM_TO_PRACTICE_FIELD_C1_REPLY.md`, with one `docs/README.md` row. No docs-only PR.
**How to answer:**
- **No reply to the Film Room is needed.** Put your answers in your T1a-1 spec, using §5's list.
- **If you disagree with an item,** take it to the founder as a ruling, not back to us. That keeps the founder out of a back-and-forth.

## 0. In short

- **Shared contract V2 is adopted** as the Film Room's job.
- **The Film Room's side of the nomination path is built.** It's in PR #1049, `claude/film-room-c1-chain`, which merges after one more review.
- **A seam.** The path reaches your book through one module, `api/_utils/filmRoom/practiceFieldSeam.js`. It holds four helpers that are yours to replace. Until you do, every helper answers "no book", so nobody sees the Offer route today. The seam lands on `main` with #1049, so your T1a-1 build should be cut after that merge.
- **Your later writes onto a card** go through one server-only helper, `applyServerTransition`, in `api/_utils/filmRoom/cardStore.js`.
- **What this note covers:**
  - what is built (§1–§2);
  - what we ask of you, from the spec's §13 and its Amendment A (§3–§4);
  - the answers we need in your T1a-1 spec (§5).

The governing texts are both on the PR branch, so you don't need to fetch them: Build C spec V1, and its Amendment A (`docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_A_20261113.md`). Everything you need from them is restated here.

## 1. The seam: four helpers, yours to replace

Replace each default by importing your helper into `practiceFieldSeam.js`. That file is the only Film Room file your PRs touch. Each helper must be pure or a single read, as stated, because three of them run inside a Firestore transaction.

| Helper | What the Film Room relies on | Default today | Yours in |
|---|---|---|---|
| `bookForOwner(db, { uid, attributionAgentId })` | One server-side read, before the transaction. Returns `{ bookId, status }` for the owner's **idea book** that the attribution agent manages (the ranked parent for a casual clone), or `null`. **Idea books only**, never a portfolio book. The Film Room tells a client only `book: { open }`. A throw counts as "no open book". | `null` for everyone | T1a-1 |
| `bookIsForAgent(bookDoc, attributionAgentId)` | Pure. It runs inside the nominate and Offer-create transactions, on `mandates/{bookId}` as the transaction re-read it. Answers `true` only when the book belongs to that attribution agent. The Film Room separately requires `userId === uid`, `kind === 'idea_book'` and `status === 'active'`. A throw, or any answer but `true`, refuses. | compares a field named `attributionAgentId` | T1a-1: please name the book's real attribution field |
| `buildNominationDoc({ entryId, situationId, questionId, questionVersion, nowIso, expiresAfterSessions })` | Pure. Returns the record the card endpoint writes at `mandates/{bookId}/nominations/{nominationId}`, in the same transaction as the card's move to `nominated`. The nomination id is the card op's id. **The Film Room checks the output before writing anything** (see the list below). To refuse with 503, throw `{ code: 'calendar_unavailable' }`. | contract V2 §5.2's record, with `expiresAt` at the close of the 10th session after the anchor | T2 |
| `buildWithdrawal(record, { nowIso })` | Pure. It runs inside the player's retire transaction, on the record as the transaction read it, when that record is `queued`, `considered` or `deferred`. Before calling it, the Film Room requires the record to be this card's, and copies its source reference. Afterwards it requires a plain object with `state: 'withdrawn'` and that source reference unchanged. A throw, or anything else, refuses (503), writes nothing and doesn't retire the card. | the record with `state: 'withdrawn'`, `withdrawnAt`, and a `stateHistory` row `{ state: 'withdrawn', at, by: 'player' }` | T2 (you own the shape) |

**What the Film Room checks in `buildNominationDoc`'s output.** Before either half is written, the output must have all of these:
- a plain object;
- `state: 'queued'`;
- `source` of kind `film_room_card`, naming exactly the `entryId`, `situationId`, `questionId` and `questionVersion` it was given;
- `queuedAt`, a full ISO instant equal to the `nowIso` handed in;
- `expiresAt`, a full ISO instant after `queuedAt`;
- `stateHistory`, a non-empty array of plain objects.

Extra fields you add pass through untouched. Anything else is a server fault (500), and nothing is written.

## 2. Writing onto a card: `applyServerTransition`

`applyServerTransition(db, { entryId, ownerId, agentId, to, by, payload, opId, nowIso })` is server-only.
- `by` is your writer's name; it is kept on the card's history row.
- The helper is idempotent per op id, among your own rows.
- It checks the card's owner and agent.
- A shelved card still transitions.
- Every instant must be a full ISO 8601 instant, with a time and an offset (or `Z`).

| `to` | Payload | Move | Bound to |
|---|---|---|---|
| `nomination` | `{ bookId, nominationId, state, reason?, consideredAt? }`. On `accepted`, also `ideaId` (required) and `thesis?`: at most 400 code points, and it needs `consideredAt`. | the card stays `nominated`; the state is copied onto it | the card's own book and nomination |
| `testing` | `{ bookId, ideaId }` | `nominated → testing`, at the idea's first executed fill | an `accepted` copy and its `ideaId` |
| `tested` | `{ ideaId, resultRef, contractCondition, economicResult, closingNote?, closingNoteAt?, noFill? }`. The closing note is at most 600 code points and needs its instant. | `testing → tested`. Or `nominated → tested`, with `noFill: true` and an accepted copy, when the idea ended before its first fill. | the card's idea |
| `offered` (new) | `{ ideaId, offerId, state: 'offered' }` | `tested → tested`; one offer per card | the card's idea |
| `installed` | `{ ideaId, offerId, state }` | `tested → installed` | the card's idea and the waiting offer |
| `retired` (server) | `{ ideaId, offerId \| null, state }` | `tested → retired`. `offerId` is `null` only when no offer exists. | the card's idea, and the offer when there is one |

Result and offer words are stored and shown exactly as you write them. The Film Room never renders "validated", "proven" or "supported".

## 3. What we ask, from Amendment A

1. **The nomination order.** The helper enforces this table, judged against the card's current copy. Please adopt it exactly in T2.

   | From | May move to |
   |---|---|
   | `queued` | `considered`, `accepted`, `deferred`, `declined`, `expired` |
   | `considered` | `accepted`, `deferred`, `declined` |
   | `deferred` | `considered`, `accepted`, `declined` |
   | `accepted`, `declined`, `expired`, `withdrawn` | nothing |

   - A copy that arrives late, after a later state, is refused.
   - A copy that never arrives doesn't block the next one.
   - Expiry comes only from `queued`, because the receipt says "Not considered within 10 sessions".
   - **Your call:** does a `considered` or `deferred` nomination always reach `accepted` or `declined`? If not, name the state that closes it.

   Your contract's compact arrow, `queued → considered → accepted | deferred | declined | expired`, doesn't by itself fix these exact edges, so please confirm the table rather than assume it.
2. **`withdrawn`.** A new nomination state, written only by the Film Room when the player retires a card the agent hasn't taken yet, through your `buildWithdrawal`. The helper refuses it as a copied state.
3. **Withdrawal and acceptance must not race.**
   - Your acceptance and admission read the nomination record **inside the transaction that writes them**, and write only while it is still `queued`, `considered` or `deferred`.
   - A withdrawal is never undone on a retry.
   - A check before the transaction followed by an unconditional write is not enough.
   - Test both commit orders on your side. The Film Room's side is already pinned: a copy after the retire is refused, and an acceptance landing mid-retire makes the retire conflict, retry and refuse.
4. **The agent's words reach the receipt.**
   - On `accepted`, copy the idea's `thesis` (at most 400 code points) with `consideredAt`. It is quoted "— your agent, {date}".
   - On `tested`, copy the result's closing note (at most 600) with its time.
   - Please bound both at your source; the copy refuses rather than truncates.
5. **Every taken card closes.**
   - For each idea that took a card, write `testing` and then `tested`.
   - When the idea ends before its first fill, write `tested` directly with `noFill: true`. That is your own fact, never inferred. The card then reads "Ended before its first trade".
   - A filled idea always sends `testing` before `tested`.

   Without this, a card the agent accepted can be stuck: the player can't retire it once it's accepted.
6. **Offers (T3).**
   - Send `offered` when you create a Forge offer. The receipt then says "An offer waits in the Forge".
   - `installed` and the server `retired` carry `ideaId` and the offer's id.
7. **The calendar's horizon.** The maintained market years are 2026 and 2027. From about mid-December 2027, every nomination refuses with 503 `calendar_unavailable` until 2028 is added. Please note this for your own clocks too.
8. **B6.** The Film Room holds a copy of B6 (10 sessions) as `NOMINATION_EXPIRY_SESSIONS` in `src/data/cardStages.js`. Name your B-slot module's path when it lands, and a test will pin the two together.

## 4. Still open from the spec's §13

1. **The rule.** Please name the `nominations` read rule in T2: owner read through the parent book's `userId`; no client writes. Today the catch-all denies all client access.
2. **`parkedAt`** is set by the player from the receipt, once a result shows. Confirm, or name another writer.
3. **Your §7 reader list** needs no change from you. C1 moved every Film Room reader to vocabulary version 2, including the counter, the harness and the rules test.
4. **The excerpt and the one-door exception.** The Film Room's C2 builds the moment excerpt, `api/_utils/filmRoom/momentExcerpt.js`: the bounded tape facts your drafting call reads for game moments and cards.
   - The census will allow exactly one importer. **Please name your drafting assembler's path for T1b.**
   - Please register the excerpt in the honesty registry when you import it.
   - C2 is built beside your T1b and can't start until we have that path.
5. **Our recommendation (BC-7).** Consider one bounded model call when a card is offered, inside the book's $3 bound, rather than waiting for the next refill. The agent's answer is the loop's first feedback to the player; waiting up to ten sessions makes the offer feel ignored. The cost is your call, and the Film Room renders either way.

## 5. The answers we need, in your T1a-1 spec

1. The module path for `bookForOwner` and `bookIsForAgent`, and the book's attribution-agent field.
2. Whether you adopt §3 item 1's order table, and what closes a `considered` or `deferred` nomination.
3. That you will write `withdrawn` through `buildWithdrawal`, and hold the concurrency rule in §3 item 3.
4. That you will copy the thesis and the closing note with their times (§3 item 4).
5. The `testing` / `tested` / `noFill` delivery order (§3 item 5).
6. The drafting assembler's path, for C2 (§4 item 4).
7. Your decision on BC-7 (§4 item 5).
8. The `nominations` rule (§4 item 1), and `parkedAt` (§4 item 2).
9. The B-slot module's path, when it exists (§3 item 8).