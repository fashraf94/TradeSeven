# Practice Field shared contract V2 — Amendment B: answers to the Film Room's C1 reply

**Date:** 13 Nov 2026 · **Author:** the Practice Field chat · **Answers:** `docs/design/20261113_FILM_ROOM_TO_PRACTICE_FIELD_C1_REPLY.md` (the Film Room chat, 13 Nov 2026), item by item from its §5 · **Status:** awaiting the founder's adoption with V2 and Amendment A; item 10 is a founder ruling · **Destination:** `docs/design/20261113_PRACTICE_FIELD_SHARED_CONTRACT_V2_AMENDMENT_B.md`, committed by the T1a-1 build together with the Film Room's note. No docs-only PR. No reply to the Film Room is needed.

## The nine answers

| # | Film Room asks | Practice Field answer | Built in |
|---|---|---|---|
| 1 | Module path for `bookForOwner` and `bookIsForAgent`; the book's attribution field | Both live in `api/_utils/practiceField/bookStore.js` and are imported into `api/_utils/filmRoom/practiceFieldSeam.js`, replacing its defaults. `bookForOwner(db, { uid, attributionAgentId })` is one read, returns `{ bookId, status }` for an **idea book** only, or `null`. `bookIsForAgent(bookDoc, attributionAgentId)` is pure. The field is **`attributionAgentId`** on `mandates/{bookId}`, written once at creation, so the seam's current default comparison is already correct. | T1a-1 |
| 2 | Adopt the nomination order table; what closes `considered` and `deferred` | **Adopted exactly** as the Film Room's table. `considered` and `deferred` always end in `accepted` or `declined`: `considered` is written when a consideration run picks the nomination up and that run ends it as `accepted`, `deferred` or `declined`; a `deferred` nomination keeps priority at the next refill and is re-considered there; one still not accepted at its `expiresAt` is moved to **`declined` with reason `window_closed`**. `expired` stays reserved for `queued`. | T2 |
| 3 | `withdrawn` through `buildWithdrawal`; acceptance and withdrawal must not race | **Agreed.** The Practice Field owns `buildWithdrawal`'s shape and keeps the seam's default. Acceptance and admission read `mandates/{bookId}/nominations/{nominationId}` **inside the transaction that writes them** and write only while it is `queued`, `considered` or `deferred`; otherwise the admission is refused `nomination_closed`. A withdrawal is never undone on a retry. Both commit orders are tested. | T2 (admission gains the in-transaction guard) |
| 4 | Copy the thesis and the closing note with their times | **Agreed, bounded at the source.** The thesis is capped at **400 code points** by admission's contract check; the closing note at **600 code points** where it is written. Both carry their instants (`consideredAt`, `closingNoteAt`). | thesis cap T1a-1; copies T2; closing note T1a-2 / T1b |
| 5 | `testing` / `tested` / `noFill` order | **Agreed.** `testing` is sent when an idea that took the card commits its first executed fill (basket entry). `tested` is sent at every terminal result. An idea that ends before its first fill (T1a-1's `entry_timeout`, or a cancellation) sends `tested` directly with `noFill: true`. A filled idea always sends `testing` before `tested`. | T2 |
| 6 | The drafting assembler's path, for C2 | **`api/_utils/practiceField/draftingPrompt.js`**, the moment excerpt's one importer, registered in the Mandate honesty registry with the excerpt as an input. | T1b + T1d |
| 7 | BC-7 | **Accepted** (Amendment A R6). One bounded consideration call runs at nomination, inside the book's monthly spend reservation. With the reservation exhausted, the nomination stays `queued` and says so; it is considered at the next refill. | T2 |
| 8 | The `nominations` rule; `parkedAt` | **The rule:** `match /mandates/{bookId}/nominations/{nominationId} { allow read: if owner of the parent book; allow write: if false; }`, tested with the rules suite. **`parkedAt`** is set by the player from the receipt, once a result shows, through the Film Room's card endpoint. | T2 (rule); Film Room (park op) |
| 9 | The B-slot module's path | **`src/data/practiceFieldSlots.js`**, created by T1a-1, with `PRACTICE_FIELD_SLOTS_VERSION`. B6's nomination expiry (10 sessions) lives there; the Film Room's `NOMINATION_EXPIRY_SESSIONS` copy may be pinned to it by test. | T1a-1 |

Also noted: the maintained calendar ends with 2027; the Practice Field's admission already refuses a window past it (`calendar_unsupported`, T1a-1), and calendar maintenance is T5.

## 10. One founder ruling: `installed` or `adopted`

**The conflict.** Amendment A (F3, from the framework chat) renamed the card stage `installed` to `adopted`, so adoption never reads as the agent trading the idea before P4. The Film Room's C1 (PR #1049, unmerged) built vocabulary version 2 with the stored stage **`installed`** and the transitions `offered`, `installed` and a server `retired`.

**Lean, approved unless the founder objects:** the **stored** stage stays `installed`, as C1 built it, so #1049 merges without another round. Every **player-facing** label for that stage reads **"Adopted as your instruction"**, and the line "[AGENT] doesn't act on your ideas yet" stays on every idea surface until P4. This keeps the framework's honesty point, which concerns what the player reads, and supersedes Amendment A F3's rename of the stored value.

## 11. Order of work this implies

- The T1a-1 build is cut **after #1049 merges**, so the seam is on `main`, and wires `bookForOwner` and `bookIsForAgent` into it. Until then the seam answers "no book" for everyone, which is correct while no idea book exists.
- T2 carries items 2, 3, 5, 7 and 8, and the Film Room's `buildNominationDoc` and `buildWithdrawal` shapes become the Practice Field's own builders there.
