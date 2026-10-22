Build B spec V1.0 — Amendment G: founder rulings for B2, the card (2026-10-21)

* RG-1 — B2 is the card. A screen pass follows it.
   * The screen pass carries:
      * the Study Meetings section (spec §3, acceptance H) with RE-3;
      * W5, per-symbol series coverage;
      * X3-5, discovery first;
      * the QA findings FR-02 to FR-05;
      * the delay-explanation wording;
      * a Glance coverage summary line;
      * the five screen leftovers: A2F2-4, B6, A2F2-5, A2F1-7, A2F3-7.
   * RE-1 lands in B2, because the card shows `stalled`'s coverage.
* RG-2 — Tags show only under cards mode.
   * The moments list and a tagged check's detail render only when `FILM_ROOM_CARDS_MODE` admits the owner.
   * Otherwise the screen is the current v2, byte for byte.
* RG-3 — A tag's count takes its basis's class.
   * It is recorded (R) on the `recorded` basis and derived (D) on `recomputed`.
   * The effective threshold is derived (D).
   * A moment's number of checks is derived (D).
* RG-4 — Recurrences belong to the card's agent.
   * A recurrence is a moment of the card's situation, on any holding, on a battle day of the same agent after the card's creation.
   * The counter returns each one with its battle, day, symbol and from–to, so `since-last-time` can link to it.
   * The counter's field mask adds `agentId` and `battleId`.
* RG-5 — The routes and the receipt say only what will happen.
   * Watch: "The Film Room counts each time this comes back."
   * Practice: "The Practice Field opens later; this keeps the moment for it."
   * Set: "You change the setting yourself; this card changes nothing."
   * No route says or implies that the agent learns from, reads or follows a card.
* RG-6 — The list never shows how a moment turned out.
   * A moment row shows the symbol, its from–to and its number of checks.
   * It shows no price, score, result or later fact.
   * Order: longest first, ties earliest first.
* RG-7 — Deploying the rules and the index is a founder action.
   * The `plays` rules and the `tape (ownerId, etDate)` collection-group index deploy after merge and before any flip.
   * The build report gives the exact commands.
* RG-8 — The founder slots.
   * S9 is 5 open cards per agent, counting only cards that are neither shelved nor retired.
   * S10 is 280 characters after trimming.
   * S11 is spec §1's three `stalled` questions, word for word.
   * S9 and S10 live in their own versioned module, not in the situation registry, whose version every tape stores. S11 lives in `situationQuestions.js`.
   * A change to any of them is a PR that bumps its version.
* RG-9 — Set's link.
   * Set links to the existing equip surface only when exactly one route there fits the situation.
   * Otherwise it states the route in plain words, with no link.
* RG-10 — B2's exit criterion. Spec §8's ten criteria stand, read as follows:
   * Criterion 5: "the current v2" means the screen at this build's base, with `FILM_ROOM_V2_MODE = 'on'`. An untaped battle's legacy screen is unchanged in every mode.
   * Criterion 9: RE-1's change to `coverage.tags` on recorded days is a declared movement.
   * Criterion 10: it is met by RB-5. Tournament battles open the legacy screen and are refused by the card endpoint.
