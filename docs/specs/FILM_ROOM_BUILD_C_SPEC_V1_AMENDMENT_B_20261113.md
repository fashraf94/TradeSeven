# Film Room Build C spec V1 — Amendment B: rulings on the C1 fix round's questions (2026-11-13)

**Status:** the Film Room chat's rulings on the C1 build report's §9.11. The founder approved them by sending them with Astra's C1 confirmation review.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_B_20261113.md`, with one `docs/README.md` row, committed verbatim by C2's first commit. No docs-only PR.

- **CB-1. F1's order stays as built.**
  - The order: owner → replay → version → stage → source → book. A create judges its source before its book, and a nomination does the same.
  - So with no book, a nomination whose source changed answers the source error. Both refusals are true; the create path's order wins.
- **CB-2. CA-7's words: both readings confirmed.**
  - "since it was filed" is allowed. The amendment excluded only "Nothing was filed" and "could not be filed".
  - The battle's own refusals (`not_found`, `forbidden`, `untaped`) keep the receipt's existing words.
  - A code with no words says "The card could not be offered."
- **CB-3. Retire and park from a casual clone's battle.** C1 keeps RK-1's order for retire and park. C2's prompt carries one small item: every receipt action names the card's own agent, as the offer now does.
- **CB-4. Dates on the chain follow one rule, as built:**
  - a chain line's date is when the ledger recorded the move (its history row's time);
  - a quotation's date is when the words were written (`consideredAt`, `closingNoteAt`).

  "Your agent considered this" is a line, so it shows the row's time.
- **CB-5. The Practice Field's side.**
  - What was sent: CA-11's table, CA-21 item 10's concurrency rule and CA-22's delivery order went to the Practice Field chat on 13 Nov, in the Film Room's one reply (`docs/design/20261113_FILM_ROOM_TO_PRACTICE_FIELD_C1_REPLY.md`, which its T1a-1 build commits).
  - How it answers: in its T1a-1 spec. Disagreements go to the founder as rulings.
  - Until then: the Film Room's side refuses anything else, as built.
- **CB-6. The census before `'on'`.** The founder runs `node scripts/census-film-room-v1-plays.mjs` once, after C3 and before the `'on'` flip. Any `drill` entry not yet retired is retired from its receipt.
- **CB-7. F2's extra checks stay.**
  - The checks:
    - `queuedAt` equals the instant handed to the builder;
    - `expiresAt` is after it;
    - `stateHistory` is a non-empty array of plain rows.
  - The Practice Field has been told, in its reply's §1.
  - A malformed output is the route's 500: a server fault, with nothing written, and the receipt's default words.
- **CB-8. The protected-store key** `api/_utils/filmRoom/cardStore.js::retireCard::set::unresolved`, at count 1, is the withdrawal of a nomination record. The Film Room chat recommends approving it, and the founder's merge approves it.
