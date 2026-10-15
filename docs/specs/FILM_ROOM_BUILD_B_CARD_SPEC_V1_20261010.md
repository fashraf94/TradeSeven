# Film Room Build B — the counter and the card · Spec V1.0

**Date:** 2026-10-10 · **Author:** the Film Room chat (Fable) · **Status:** spec for the card build; the build prompt follows once the A2 follow-up pass has merged
**Rests on:** the Practice Field ↔ Film Room shared contract V1 (10 Oct, by the Practice Field chat). Also spec V1.2 §7, §8 and §11 with Amendments A–E and their addenda (R1–R13).
**Repo home:** `docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md`, committed by the build.

This spec builds the Film Room's links of the contract's chain: the situation registry, tape additions T1 and T2, the tagger, counter and list, and the card with stages `card` and `nominated`. Where the contract decides something, this spec follows it. §9 lists the factual corrections to the contract, sent once as the founder asked. There are no design disagreements, so no ruling is requested.

## 0. In plain terms

- **The day:** each Film Room day lists the moments when a holding had stalled, longest first, each with "Take this home". The list never shows how a moment turned out.
- **The card:** a card is that moment, a question picked from a short menu, and the player's note in their own words. The player then chooses what happens next:
  - **Watch** — the Film Room counts each time the situation comes back.
  - **Practice** — kept for the Practice Field when it opens.
  - **Set** — the player changes a setting themselves.
- **One door:** nothing in a card reaches the agent.
- **Data:** the tape gains the opponent's score at each check, labelled with whether there was an opponent, and the gameplan meetings with how each ended.
- **Off by default:** all of this is dark behind its own flag. With it off, the screen is the current v2, byte for byte.

## 1. The registry (contract §2)

- **`src/data/situationRegistry.js`:** zero-import and Node-clean, after the `src/data/archetypeAdjustments.js` precedent. Entries are `{ id, version, title, definition, slots, playerCallable }`.
  - V1 entries:
    - `stalled`, version 1, live;
    - `down`, reserved, with no definition;
    - `good_lead`, reserved, with no definition.
  - The module holds the definitions and slot values only, never arithmetic.
- **`src/data/situationQuestions.js`:** zero-import and versioned. Entries are `{ id, version, situationId, text }`. V1 questions for `stalled` are founder slot S11, and the copy is swept like all screen copy:
  - `stalled.want` — "What do you want to happen when a holding stops moving like this?"
  - `stalled.whose` — "Whose call is it to move on from a holding that has stopped moving?"
  - `stalled.ready` — "Were other ideas ready to take its place?"
- **Version rule:** a definition, slot or question changes only by a PR that bumps its `version`. Records keep the version they were written under.

## 2. `stalled` and where tagging runs

**The definition** (contract §2, verbatim in intent): per holding, per check, recompute the platform's stagnation count from the price the agent was shown (`checks[].evidence.px`):
- use the platform's own arithmetic (`updateStagnationCounter`, imported, never copied);
- take the thresholds from the registry adapter (`getArchetypeDefinition(codeId).physics.hftConfig.forcedRotation`), apply the battle's tempo dial (`tempoDialClamp.js`), and mirror the tick-age guard.

The situation is live when all three hold:
- the count ≥ `ticksThreshold − S1`;
- the rule hasn't fired for that holding;
- the holding is below the winner threshold.

When forced rotation is off for the archetype, use S2.

**Where it runs: in the close pass, stored on the tape.** The registry adapter and the risk manager's arithmetic are Node-only, and the screen can't load them (the A2 build hit this with the archetype registry). So the close pass runs the tagger after it assembles the day and writes a declared section, `tags`. That's permitted by the contract's "nothing stored beyond the tape's declared fields":

```
tags: {
  registryVersion, situations: { stalled: 1 },
  inputs: {                       // what the tagger used, so the section is reproducible from the tape alone
    archetypeCodeId,
    forcedRotation: { enabled, pctThreshold, ticksThreshold, winnerThreshold, maxTickAgeMinutes },
    perCheck: [{ tickSeq, tempoMultiplier, effectiveTicksThreshold, basis }]   // basis: tick_controls | battle_frozen | archetype_default
  },
  items: [{ situationId, version, symbol, tickSeq, at, count, effectiveTicksThreshold }],
  exits: [{ symbol, tickSeq, at, precededByTag }]   // every recorded stagnation exit, for acceptance B
}
```

- **Classes:** `inputs.*` take the class of their source (recorded when copied from the tick or battle, derived when computed); `items[].count` and `effectiveTicksThreshold` are derived.
- **Merge:** the section is recomputed whenever the close pass re-runs for that day (it's derived from `checks[]`, which is merge-monotone). The refresh endpoint (`refresh=1`) re-tags old days.
- **Coverage (`coverage.tags`):** it follows the inputs `stalled` reads, the checks and the evidence for that symbol. It does not follow bars. A day whose checks or evidence are partial lists `stalled` as unavailable with the reason. Drills keep the contract's bars rule.

**The list** (contract §4) is a pure, zero-import helper the screen runs on the stored items:
- consecutive tagged checks for one symbol form one moment `{ situationId, symbol, fromTickSeq, toTickSeq, from, to, checks }`;
- moments are ordered by `checks` (time in the situation), longest first, ties earliest first (ruling 15);
- it never says "hard", never orders by outcome, and shows nothing known only afterwards.

**The counter:** tags per situation per ET trading week, plus each open Watch card's recurrences since its creation. It's served by an owner-scoped endpoint (§5), because counting across days means reading many tapes.

## 3. Tape additions

- **T1 — the opponent at each check.**
  - `checks[].scores.opponent` is copied from the permanent tick, class recorded. `score.opponentBasis` is `cpu_portfolio` when `battle.opponent` is set, `none` otherwise.
  - With basis `none`, every per-check opponent value is stored as **null**, never 0, so no reader can find a tie. Checks rebuilt from an evaluations entry carry null.
  - Touch points: `scoresOf` in `tapeAssemble.js`, the declaration in `src/constants/filmTape.js`, the declaration golden, the screen fixtures. Tapes already written keep their stored declaration.
  - The screen doesn't render T1 in this build.
- **T2 — gameplan meetings.**
  - `meetings[]` holds the meetings created on the tape day, from `gameplanMeetingHistory`: `{ createdAt, expiresAt, resolvedAt, status: approved | rejected | expired, resolvedBy, legs: [{ symbolOut, symbolIn }], diagnosis }`.
  - All are class recorded except `diagnosis`, which is someone's words. It joins R7's quotation channels and the league-film drop list.
  - It gets its own `coverage.meetings` section.
  - The candle pass adds every leg's symbols to its series set, so a rejected or expired leg has bars.
  - Study gets a **Meetings** section: legs, status and instants, with the diagnosis as an attributed quotation. The "awaiting approval" run in the check strip links to its meeting when the instants match.

## 4. The card and the ledger (contract §5)

**Home:** `agents/{agentId}/plays/{entryId}`.
- Server-only writes; owner read, by `resource.data.ownerId == request.auth.uid`, with lists constrained the same way. Rules-suite rows: owner get and list succeed; other users and anonymous are denied; every client write is denied.
- If the protected-store scanner can't resolve the chained write site statically, register it in its allowlist, per the scanner's own rules.

**Written once:**
- `schemaVersion: 1`, `ownerId`, `agentId`, `createdAt`;
- `archetypeCodeId`, the archetype it was created under;
- `situationId`, `situationVersion`;
- `source: { battleId, etDate, symbol, fromTickSeq, toTickSeq }`;
- `questionId`, `questionVersion`;
- `note`: the player's words, verbatim. At most S10 characters after trimming; control characters are refused, not stripped.
- `route: watch | drill | set`.

**The envelope:**
- `stage`: `card`, or `nominated` when the route is `drill`, or `retired`;
- `stageAt`, `stageHistory[{ stage, at, by }]`, `version`, and the op ids.
- Later stages belong to the camp.

**Shelving** (ruling 5) is computed when the entry is read, never written. An entry whose `archetypeCodeId` isn't the agent's current archetype shows as shelved: it's excluded from the open-card cap, can't move stage, and comes back by itself when the archetype returns. No write means nothing can drift.

**Writes go through `POST /api/film-room/card`** with operations `create` and `retire`. Each write is idempotent by op id and checks the expected version, after `api/_utils/hypothesisRecords/store.js`. It refuses when:
- the mode is off or the owner isn't admitted;
- the caller doesn't own both the battle and the agent;
- the source moment isn't in that tape day's stored `tags.items`, so a card can never point at a moment the tagger didn't find;
- the open-card cap (S9) is reached. The refusal names the cap.

There's a rate limit. Error bodies carry no other owner's data.

**One door** (contract §7):
- A census test fails if any module the evaluator, the deploy path or a prompt assembler can reach imports the ledger store or reads `plays`.
- Acceptance C: the assembled trading prompt with entries at `card` and `nominated` is byte-identical to the one with an empty ledger. The assembler is called, not edited.

## 5. The counter endpoint

**`GET /api/film-room/counter`** takes the owner from the ID token. It reads the owner's tape days in a window, using only `tags`, `etDate` and `ownerId`, through the Admin SDK with a field mask. It returns:
- weekly counts per situation;
- for each open Watch card, the recurrences since its `createdAt`.

All counts are derived. It needs a collection-group index on `tape (ownerId, etDate)`; the build report names it as a founder action. The mode and admission are checked exactly as for the card endpoint.

## 6. The screen (Film Room v2, under `FILM_ROOM_CARDS_MODE`)

The four reserved slots (BA-47), plus one action:

- **`prepared-case`** (header): the day's moments, longest first. Each row shows the symbol, the from–to times, and the number of checks with its class marker, plus **Take this home**.
  - No moments: "No moments matched this day's situations."
  - Unavailable: the coverage reason.
- **`your-call`** (footer), the card form:
  - the moment's facts;
  - the question menu as a choice;
  - the note, with its limit;
  - the three routes, worded honestly:
    - Watch — "the Film Room counts each time this comes back";
    - Practice — "the Practice Field opens later; this keeps the moment for it";
    - Set — "you change a setting yourself", with a link to the existing equip surface if one route exists;
  - the open-card count "n of 5" with its marker.
- **`receipt`** (footer): the filed card, with the player's note as an R7 quotation bound to the ledger path ("— you · time"), its route and stage, and **Retire**.
- **`since-last-time`** (header): for each open Watch card, the situation, the recurrences and battle days since the card's date, from the counter. It also has **My cards**: active, shelved and retired.
- **Check detail:** a tagged check shows the situation, its count against its effective threshold (each with its class), and Take this home.

**Not in this build:**
- showing cards in the next game's cockpit (that's the cockpit arc's surface, and its phase-one rule allows no verbs there);
- the Command Center;
- `down` and `good_lead`;
- T3.

All copy passes the existing sweeps: forbidden words, number words (R8, R12), numbers (BA-42 with R4), signs. Every screen-computed number is declared in `SCREEN_AGGREGATE_CLASSES`.

## 7. Flags

**`FILM_ROOM_CARDS_MODE`:** `off | allowlist | on`, pinned `'off'`, named in DARK_BY_DESIGN after the `FILM_ROOM_V2_MODE` pattern. Per-owner admission uses the cockpit-status `allowlisted` verdict, with no uid in the client. When it's off or the owner isn't admitted:
- the reserved slots stay empty and the screen is the current v2 byte for byte (a golden);
- both endpoints refuse.

**The writer additions** (T1, T2, `tags`, the candle symbol set) ride the existing live tape writer. They are additive declared fields (contract acceptance G), so days written from the merge on are ready when the cards turn on.

## 8. Exit criterion

Only these block. Everything else is backlog.

1. A rendered number has the wrong class or none.
2. A verdict, ranking or forbidden word appears in the screen's own voice.
3. A stated fact contradicts the tape.
4. A non-owner can read a tape, series or ledger entry, or any client can write a ledger entry.
5. With cards off or the owner not admitted, the screen isn't byte-identical to the current v2, and the off path isn't byte-identical to legacy.
6. The hub helper returns anything but its three keys.
7. A ledger entry at any stage before `installed` changes the assembled trading prompt, or is read by any model path.
8. A card can be created for a moment absent from the stored tags, or for another owner's battle or agent.
9. Any existing tape field changes value. Only the declared new fields may appear.
10. A tournament day shows an opponent value of 0, or anything reading as a tie, from basis `none`.

**Acceptance:** the contract's A, B, C, D, E and G, plus three of the Film Room's own:
- **H:** a meeting on a taped day renders with its legs, its outcome and its instants, and its words as a quotation.
- **I:** a day with partial evidence lists `stalled` as unavailable with the reason.
- **J:** the screen with cards off equals the current v2 golden.

**B is run as a read-only census** over all taped days, under the same write-grep gate the Practice Field discovery used. Mismatches are counted and reported, never hidden.

## 9. Factual corrections to the shared contract (sent once)

1. **The tempo dial isn't on the tape.** The A2 inventory of `checks[]` has state, decision, risk, evidence and scores, and no controls. A tagger that is "one pure function over a tape day" therefore can't apply the dial. This spec stores the inputs it used (`tags.inputs`), including the dial at each check from the tick's controls, with a basis.
2. **The tagger can't run in the browser.** The registry adapter and the risk manager's arithmetic are Node-only. This spec runs it in the close pass and stores `tags` as a declared tape section. The camp should read stored tags rather than re-run them, so both sides count the same thing.
3. **Checks without a model call may carry no evidence stamp.** The live counter steps on every tick. If a "no trigger" check has no `evidence.px`, the recount has to treat it explicitly; this spec treats it as a pause, like the age guard. The build verifies the stamp's presence on those checks, and acceptance B measures the effect.
4. **T2 needs the legs' bars.** Unless the candle pass adds each meeting leg's symbols to its series set, a rejected or expired leg has no bars, and the camp's reveal reads `not_scored` for exactly the splits it most wants. This spec adds them.
5. **Coverage should follow the inputs.** `stalled` reads checks and evidence, not bars. Requiring complete bars would drop days `stalled` can be tagged on. The drill keeps the bars rule.
6. **"Shown to the player in the next game" is a cockpit surface.** This build counts recurrences in the Film Room only. The cockpit display belongs to the cockpit arc, under its phase-one rule.
7. **A basis of `none` stores null, not 0.** That makes "never a tie" structural rather than a reader's job.
8. **Shelving is computed, not written** (§4), so restoring needs no write and can't drift.

## 10. Founder slots added here

| Slot | Meaning | Proposed |
|---|---|---|
| S9 | Open cards per agent (active, not shelved or retired) | 5 |
| S10 | Note length | 280 characters |
| S11 | The `stalled` question menu | the three questions in §1 |
