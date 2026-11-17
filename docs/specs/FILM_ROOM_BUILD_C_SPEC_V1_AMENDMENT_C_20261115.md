# Film Room Build C spec V1 — Amendment C: C2 against what the Practice Field and BaggerBomb decided since (2026-11-15)

**Status:** proposed by the Film Room chat on 15 Nov 2026. The founder approves it by sending it with the C2 build prompt. C2's first commit commits it.
**Why:** C2 builds the moment excerpt (spec §6), the agent's drafting call's one window onto game moments and cards. Since the spec was written, three things have been decided elsewhere:
- **The Practice Field answered the Film Room's C1 reply.** Its shared contract V2 Amendment B named the drafting call's file, the B-slot module and a founder ruling on the word for `installed`.
- **Its Amendments C and D** set what a prompt may receive from a player's input.
- **The BaggerBomb revamp (15 Nov)** changes what the tape will record.

This amendment fits C2 to all three, and carries four small items left from C1.
**Rests on:**
- the spec V1, with Amendments A and B (on `main`);
- the Practice Field's shared contract V2 with its Amendments A and B, and its Amendments C, D and E (`docs/design/` on `main`);
- the BaggerBomb direction note BB-1 to BB-22, with its Amendment A (adopted 15 Nov).
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_C_20261115.md`, with one `docs/README.md` row, committed by C2's first commit. No docs-only PR.

## CC-1. The one importer, and the census

- **The importer.** The moment excerpt's one importer is **`api/_utils/practiceField/draftingPrompt.js`**: contract V2 Amendment B, item 6.
- **It doesn't exist yet;** the Practice Field's T1b + T1d writes it. So C2 builds the exception now, and it stays latent until then:
  - The one-door census gains a named exception table, holding one entry: that importer, `api/_utils/filmRoom/momentExcerpt.js`, and the sections it rests on (contract V2 §9 and this spec's §6).
  - Any model path that reaches `momentExcerpt.js` fails the census, unless it reaches it only through the named importer.
  - When T1b + T1d adds the file, that build adds a `drafting` model path to the census with its roots. Its walk may reach the excerpt, and through it `plays`, only through the named importer.
- **The Mandate manager's path joins the census now**, as a model path with its roots:
  - `api/cron/mandate-evaluate.js`;
  - `api/_utils/mandatePromptAssembly.js`.

  It may reach neither the ledger nor the excerpt. Contract V2 §9 lets only the drafting call read Film Room cards; the manager never does. Astra checked this path by hand in the C1 confirmation. From C2 on, the census pins it.

## CC-2. Quotations fit the Practice Field's rule on inputs

The Practice Field's Amendment D, W-06, says a prompt may receive from a player's input "validated structured fields and one quoted excerpt of at most 500 code points per source". A Film Room card offered to the agent is such an input (its Amendment C).

The excerpt is built so that rule can be kept exactly:
- **Every quoted field is at most 500 code points.** The agent's rationale drops from the spec's 600 to 500. The directive's two texts (400), the meeting's diagnosis (400; the tape keeps up to 500), the idea's statement (280) and the card's note (280) keep their bounds.
- **Every quotation says who wrote it, and when:**
  - the speaker: `by: 'agent' | 'player' | 'platform'`;
  - the time: `at`, the time the tape records for the words, or `null` when it records none.

  The speakers per field:

  | Speaker | Fields |
  |---|---|
  | `agent` | the rationale |
  | `player` | the directive's player text, the card's note, the idea's statement |
  | `platform` | the directive's canonical text, the meeting's diagnosis |
- **A card's one quotation.** For a nominated card, the excerpt names the player's note as the input's one quoted excerpt, in a field of its own (`inputQuote`).
- **The moment's other quotations** are facts of the game moment, a passive source, each in its own labelled field:
  - the rationale;
  - the directive's texts;
  - the meeting's diagnosis.

  Which of them a prompt receives, under W-06, W-07 and the drafting call's token budget, is the drafting assembler's decision (T1d).
- **Speakers are never merged.** The excerpt never joins two speakers' words into one quotation.

## CC-3. Labels, never ids

`excerptOf` returns `{ excerpt, refs }`.
- **`excerpt` is what may reach a prompt.** It names the battle, the idea and the card by opaque local labels (`b1`, `i1`, `c1`).
- **`refs` maps each label to its real id,** for the server's own resolution (contract V2 §5.1). It is never placed in a prompt.

A test pins that `excerpt` holds no id-shaped value: no battle, user, agent, entry, watchlist or nomination id. Symbols are not ids.

## CC-4. A card's excerpt re-checks its source

An excerpt for a card reads the card from the owner's attribution agent's `plays`, and the moment from the card's filed source. The source must pass the same day check that a create and a nomination run: coverage, the exact moment, the situation version and the archetype (C1's F1). Use one implementation of that check, shared by the route and the excerpt.

A card whose source no longer passes gives no excerpt (`null`), never a guess.

## CC-5. Owner only, and silent

`excerptOf` answers only when all three hold:
- the tape day's `ownerId` is the caller's;
- the battle's attribution agent is the one named;
- for a card, the entry is the owner's under that agent.

Anything else is `null`: no fields, and no reason that tells a missing day from someone else's.

## CC-6. The excerpt is version 1 of today's tape

- **What version 1 describes.** `MOMENT_EXCERPT_VERSION = 1` describes today's BaggerBomb tape.
- **What changes it.** The trader game's launch set (BB-7's stops and targets, exits to cash, BB-8's bank-on-exit, BB-13's scoring version on every battle) changes what the tape records. The excerpt moves to version 2 in the Film Room build that follows those changes onto the tape. Version 2 carries the battle's scoring version, so the drafting call can keep BB-13: "battles under different versions are never compared".
- **Until then,** a field the tape doesn't hold is absent. For example, an exit to cash has no bought symbol.

## CC-7. The subject line

- **Where it shows.** Under the card's facts, on the form and the receipt, under cards mode only (spec §5).
- **What it says:** "{SYM} · {sector} · under your idea '{statement, first 60 code points}' v{n}".
- **How it's built.** It comes from one pure projection that both the excerpt and the screen use, so the receipt and the agent's excerpt never say different things.
- **What it shows.** Each part only where the tape holds it. Nothing is guessed:
  - the sector comes from the same directory the excerpt uses, as screen code already imports it;
  - with no carried idea, the line ends after the sector.

## CC-8. The word for `installed`: "Adopted as your instruction"

The Practice Field's contract V2 Amendment B, item 10, is a founder ruling: the stored stage stays `installed`, and every player-facing word for it reads as adopted. On the Film Room:

| Where | Today | From C2 |
|---|---|---|
| the stage word | "equipped" | "adopted as your instruction" |
| the chain line | "Equipped · {date}" | "Adopted as your instruction · {date}" |
| the My cards group | "Equipped" | "Adopted" |
| the `cap_reached` words | "…retired, parked, equipped or not taken." | "…retired, parked, adopted or not taken." (server and screen) |

Under the chain's adopted line, one sentence: **"Your agent doesn't act on your ideas yet."** It stays until the framework's P4 changes that.

No stored value changes. The stage is reached only through the Practice Field's T3, so no player sees these words today.

## CC-9. Four small items left from C1

1. **CB-3.** Every receipt action names the card's own agent, as the offer does since C1's fix round: retire and park send the card's own `agentId` (the casual clone's parent). The server's ownership checks are unchanged.
2. **Astra's BG-1.** When a retire meets a terminal record (`declined`, `expired` or `withdrawn`), the record must name the retiring entry (a `film_room_card` source with this `entryId`). Otherwise the retire refuses 503 `nomination_unavailable`, as the withdrawal already does.
3. **B6's pin.** A test pins `NOMINATION_EXPIRY_SESSIONS` to `src/data/practiceFieldSlots.js`'s B6 nomination expiry (contract V2 Amendment B, item 9). `cardStages.js` stays zero-import, so the pin lives in a test.
4. **The seam's stale comment.** The `PRACTICE_FIELD_SEAM_DEFAULTS` JSDoc in `practiceFieldSeam.js` still says "one read". It says "at most two reads", as its header does since T1a-1.

## CC-10. What waits, and why

- **C3 waits for the trader game.** Its situations were written for the swap game:
  - `sold_and_ran` is defined over a swap's exit;
  - `stalled`, which the C1 chain already reads, comes from the stagnation rule.

  The launch set replaces swaps with positions that open with a stop and a target and exit to cash (BB-7), and makes ranked games 3 trading days long (BB-3). That also brings `down` and `good_lead` into reach.

  C3 is written again against the trader game, once the launch set's builds name what the tape will record. The Film Room sends the BaggerBomb revamp chat one note listing what the tape needs from those builds.
- **The consideration call's timing (the Practice Field's Amendment C, §4)** moves to the next intraday window. The Offer route's note ("at its next chance") stays true, so nothing changes on the screen.
- **W-05 and W-17** (attribution frozen at the offer; the receipt's `standing` copy) apply to card offers in the Practice Field's T2, not in C2.
