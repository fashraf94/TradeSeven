# Shared Research "Work an idea" · Build Spec V1.2 — Amendment B: the thesis builder

**Date:** Nov 16, 2026 · **Owner:** the Shared Research build-spec chat (Claude) · **Status:** ruled by the founder on Nov 16 ("go" on concept V2 and on design rounds 3 and 3b). Plumbing is approve-by-default.
**Amends:** `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` (with §15–§17) and Amendment A (KB method). Where this amendment and an earlier section disagree, this amendment wins **for builder sessions only**; nothing changes for a session opened in the V1 shape.
**Destination:** `docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md`, committed as the first commit of the B3 branch with the concept and the two design files (no docs-only PR). Project copy: `claude/SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER_NOV16_2026.md`.
**Design of record:** `Work an idea - Thesis Builder R3 (standalone).html` and `… R3b (standalone).html`, on the sentence card (C-B). **Concept:** `SHARED_RESEARCH_WORK_AN_IDEA_CONCEPT_V2_THESIS_BUILDER_NOV16_2026.md`.
**Checked against:** `main` @ `71bc6bd` (read-only): `api/forge/shared-research.js`, `api/_utils/sharedResearch/*`, `src/constants/sharedResearch.js`, `src/config/sharedResearchFlags.js`, `docs/design/SHADOW_VOICE_RULES_V1.md`.
**Writes the spec; does not build.** Two builds: **B3** (server, dark) then **B4** (client, dark), then a one-line founder flip.

---

## B0. In plain terms

Today "Work an idea" follows the evidence and never ends. After these two builds, every tap fills one blank in a **thesis sentence**, and the investigation ends when the sentence is complete:

> *My theme is **AI**, through **GPUs and accelerators**, built on **NVDA**, because **it sells the accelerators AI data centers are buying**. It's wrong if **big buyers cut accelerator spending for two quarters**. Time frame: **Positional · about 30 sessions**.*

The partner talks in short turns and offers choices. Some choices cost a research step; some are free. Evidence sits behind each blank. A typical thesis takes **three research steps** (map the segments, find the companies, build the why) plus a few free taps.

**Nothing about honesty changes.** Every sourcing rule from B1 holds. No stock is picked to finish the sentence. The saved screen says plainly that nothing tracks the thesis yet; the idea book's ending arrives when the Practice Field can take theses in.

**It ships dark, beside V1.** A new switch decides whether a *new* investigation opens as a thesis builder. Investigations already open keep working as they do today.

---

## B1. Rulings applied

**Concept V2 §9, as ruled (defaults stood):** V2-1 ready = Names, Why (one Source-backed reason per name), Wrong if, Time frame; Segment optional · V2-2 one to four names · V2-3 free choices cost no step and call no model · V2-4 the partner may recommend; the player confirms; never silent · V2-5 wrong-if in words is required and saved inside the sentence · V2-6 V1's list is kept as "All evidence" · V2-7 the budget stays ten steps · V2-8 the word on the screen is "thesis".

**Design rulings (rounds 3 and 3b):**

| # | Ruling |
|---|---|
| **DR-1** | The card is **C-B, the sentence**. The finished sentence is what is saved. |
| **DR-2** | **Atlas's pick** is a free choice marked with a one-line reason. **"You pick, and tell me why"** is a step: one model turn on what the record already holds, no retrieval. |
| **DR-3** | **Who set a part** shows on tapping the part, with its sources and *Change*. A suggested, unconfirmed part shows "suggested" on the card itself. |
| **DR-4** | **Out of steps is not the end.** Parts that need no research can still be set, and a ready thesis can still be saved. |
| **DR-5** | **A group** (two to four names): the sentence carries the reason the names share; each name's own sourced reason sits under Why. |
| **DR-6** | **Own words skip the framing turn.** The player's words become the theme; the first choice is *Map the segments*. |
| **DR-7** | **The saved screen ships in today's state only** (R3b T6 "Saved, today"). The idea-book ending (T6 "idea book on") and the watching screen (P1) are not built here (§B8). |

**Three wording rulings (honesty):**
- **W-1** The idea-book action, when it is built, **offers** the thesis; the book may accept, defer or decline it. No line promises it will be held.
- **W-2** Until the idea book reads saved theses, the wrong-if tag reads **"in your words"** (not "watched") and the price line reads **"optional · add your own"** (not "set when the idea book takes it in").
- **W-3** On the watching screen, sorting an item as for or against is the model's reading and is labelled as one. (The Practice Field's build.)

**One correction to concept V2 §7 and §10:** the knowledge-base method does **not** need a new version. The thesis builder is a **frame** (what a step is for, the six parts, when to stop), kept in the server's prompt and the voice rulebook. The **method** (the baseline, or the KB package for own-words investigations) keeps governing how evidence is weighed. Where a method's text proposes its own next step, the frame wins. The KB chat gets a note, not a task.

---

## B2. The shape switch

- **`SHARED_RESEARCH_BUILDER_MODE`** in `src/config/sharedResearchFlags.js`: `'off' | 'on'`, shipped `'off'`, pinned in `sharedResearchFlags.test.js`, read at call time. Who may use Shared Research at all is still `SHARED_RESEARCH_MODE`.
- At `open`, the server stamps the session **`shape: 'builder'`** when the mode is `'on'`, else `'ledger'` (a session with no `shape` reads as `'ledger'`). The shape never changes.
- **Ledger sessions** run exactly as today: same intents, same answers, same client view. **Builder sessions** take only the builder's intents and actions (§B4); the other shape's are refused `invalid_intent`.
- Rollback is the literal back to `'off'`: new investigations open as ledgers; open builder sessions keep working.

---

## B3. The thesis card (session state)

`sharedResearchSessions/{id}.thesis`, server-written, present on builder sessions only:

```
thesis: { schemaVersion: 1, rev,                       // rev: integer, +1 on every change
  theme:     { state, value: string ≤80, by, suggestion: string|null },
  segment:   { state, value: string ≤60, by, findingIds[], skipped: bool,
               map: [ { label ≤60, line ≤120, findingIds[] } ] ≤5 | null },
  names:     { state, value: [symbol] 1–4, by, blocked: 'no_listed_company'|null },
  why:       { state, by, shared: string ≤160,
               reasons: [ { symbol, text ≤200, findingIds[] } ],        // ≥1 per name
               against: { text ≤240, findingIds[] } | null,
               proposal: { shared, reasons, against } | null },          // awaiting the player's confirm
  wrongIf:   { state, by, text ≤200, options: [ { text ≤160, findingIds[] } ] ≤3,
               priceLines: [ { symbol, level } ] },                      // optional; daily close; the player's
  timeFrame: { state, by, value: 'swing'|'positional'|'longterm'|null },
  pick:      { part, value, reason ≤140 } | null }                      // Atlas's pick on the current choices
```

- **`state`** ∈ `unset · suggested · set · stale`. `suggested` = the partner proposed it and the player has not confirmed (never counts). `stale` = a finding behind a set part is no longer current or no longer Source-backed; the part does not count until the player re-confirms it or a step repairs it.
- **`by`** ∈ `player_wrote · player_chose · partner_suggested_confirmed`.
- **Dependencies:** changing **theme** is refused (a different theme is a new investigation). Changing **segment** clears names and why. Changing **names** clears why and the price lines. Wrong-if and time frame stand on their own. A *Change* that clears parts says so before it applies (the client's confirm; the server applies what it is told).
- **Ready** is computed, never stored: names `set` (each still a supported company by `companiesOf`), why `set` with at least one current Source-backed reason per name, wrong-if `set`, time frame `set`.
- **The sentence** is composed by one pure function from the card: *"My theme is {theme}[, through {segment}], built on {names}, because {why.shared}. It's wrong if {wrongIf.text}. Time frame: {label}."* Names join as "A", "A and B", "A, B and C".

The research record is untouched in shape: findings, companies and the supported rule are B1's. Builder steps write **no summary** (`summary` stays as it was at open); the card is the answer.

---

## B4. Actions (builder sessions)

### B4.1 `open`
- **Own words (DR-6):** `{ entry: { kind: 'observation', observation }, requestId }` opens at once: no `frame` call, no framing ceiling spent. The record's question is composed, `Build a thesis on: {observation}` (cut to the record's limit). **Theme** is set from the observation when it is 80 characters or fewer (`by: player_wrote`); longer words leave theme unset for the first step to suggest. The method is selected here for own words (Amendment A's `selectMethod`, as `frame` does today).
- **Story and SignalDrop:** as today (the preview and its question stand). The card opens empty; the drop's validated names stay leads until a step sources them.
- Daily investigation ceiling, attribution stamp, `previous`, idempotency: unchanged.

### B4.2 `step` — one new intent, `build`
`{ sessionId, stepId, intent: 'build', goal, part?, direction? }`. The server decides which goals are offered from the card (the model never invents a research choice):

| `goal` | Offered when | Retrieval | What the turn must return |
|---|---|---|---|
| `verify_source` | a story or drop entry, before anything else | yes | findings on the primary source; a theme suggestion |
| `map_segments` | theme set; segment and names unset | yes | a segment map (2–5), findings, a pick with its reason |
| `find_names` | theme set; segment set or skipped | yes | findings and `companies` (B1's rule), a pick among the supported |
| `build_why` | names set | yes | a why proposal (the shared reason; one reason per name; the point against), up to three wrong-if options, a time-frame pick |
| `strengthen` | any set part, while steps remain ("Keep researching") | yes | findings for that part; a revised proposal when it changes |
| `pick` | choices are on the card for `part` (DR-2) | **no** | the pick and two or three reasons, each tied to findings or marked as the partner's reasoning |
| `direction` | always, with the player's words | yes | findings; whatever proposals follow from them |

Everything else about a step is B1's: one retrieval at most, one model turn, the validator, one transaction, the step and call ceilings, replay by `stepId`, the deadline, the shadow log.

**The turn's output (builder schema)** keeps `reply` (now at most 600 characters), `findings` and `companies` exactly as B1 defines them, drops `summary`, `lines` and `nextAction`, and adds:

```
themeSuggestion: string ≤80 | null
segments: [ { label, line, refs[] } ] ≤5
why: { shared, reasons: [ { companyName, symbolCandidate, text, refs[] } ], against: { text, refs[] } | null } | null
wrongIfOptions: [ { text, refs[] } ] ≤3
timeFramePick: { horizon, reason } | null
pick: { part, value, reason, refs[] } | null
```

**Validation, added to B1's rules (a failure here drops the proposal, never the step's findings):**
1. **A reason** counts only when every ref resolves to a current, Source-backed finding and, for a name's own reason, that finding's symbol is that name. A name with no surviving reason makes the why proposal incomplete: it is stored but cannot be confirmed, and the reply says which name lacks a source.
2. **The point against** needs at least one current finding; without one the card says "No point against found yet" and never hides the absence.
3. **Every written line** (segment labels and lines, shared reason, reasons, against, wrong-if options, pick reasons) passes B1's forbidden patterns, the stray-ticker scan and the number rule (a number must sit in a finding it cites). A line that fails is dropped; a dropped pick leaves the choices unmarked.
4. **Wrong-if options are business conditions.** An option naming a price or a price target is dropped; price lines are the player's own control.
5. **A names pick or proposal** may name only currently supported companies.
6. **`pick` (the goal)** may cite only findings already on the record.

Proposals land on the card as `suggested`/`proposal`/`options`/`map`; **no step ever sets a part** (V2-4).

### B4.3 `card` — the free action
`{ action: 'card', sessionId, opId, rev, op, part, value? }` → the fresh card. No model call, no step counted, one transaction, idempotent on `opId`; a `rev` that is not current answers `409 card_stale` with the fresh card. The per-player rate limit applies.

| `op` | What it does | Checks |
|---|---|---|
| `confirm` | sets a part from the partner's suggestion, proposal or pick (`by: partner_suggested_confirmed`) | the suggestion exists and still passes §B4.2's rules against the fresh record |
| `set` | **segment**: a label from the map (or `skip`) · **names**: one to four supported symbols · **why**: the proposal with reasons deselected, keeping one per name · **wrongIf**: an option, or the player's own text, plus optional price lines · **timeFrame**: one of the three · **theme**: only while unset, the player's own phrase | each as stated; `by: player_chose` or `player_wrote` |
| `clear` | unsets a part and its dependents (§B3) | theme cannot be cleared |

The player's own wrong-if text is theirs: stored as written (B1's rule for the player's words), never rewritten, never scanned for wording.

### B4.4 Reads
`GET ?sessionId=` and every builder answer carry **`thesis`**: the card's parts (each with its state, value, who set it, its finding ids), `rev`, `ready`, what still blocks ready, the composed `sentence`, and **`choices`**: the free choices now valid, the research goals now offered (each marked as one step), and the pick. `adoptPreview` is not returned for builder sessions; the card is the preview.

### B4.5 Endings
- **Save:** `adopt` with `{ sessionId, rev, statement? }`. Refused `not_ready` unless ready. The server composes the sentence; a player's edited `statement` is accepted when it names exactly the set names (B1's company-name rule) and every number in it sits in a carried Source-backed fact, in the wrong-if text, or in the time frame's label. The carried evidence is the card's finding ids (names' relationship facts, the reasons, the point against), at most 28. Horizon and price lines come from the card. The transaction, the committed list, the idea's first version, the record's close, the provenance stamp and idempotency are B1's, through the same adapter.
- **The saved list also carries the card** (`thesis`: the parts, who set each, the wrong-if in words), copied like the provenance stamp, so a reader such as the idea book never has to parse the sentence. The idea version itself is unchanged (V2-5).
- **No thesis:** when `find_names` leaves no supported company, names is `blocked: 'no_listed_company'`; the offered choices are *Conclude* and *Try another segment* (a free `clear`). Concluding is B1's `close`.
- **Out of steps (DR-4):** research goals are no longer offered; free choices are. A ready card can be saved.

---

## B5. The prompt and the rulebook

- **`docs/design/SHADOW_VOICE_RULES_V1.md` gains §6 "The thesis builder":** the six parts and what each needs; the partner proposes and the player decides; each turn works on the goal it was given and on nothing else; a reply is two or three sentences; no part is filled to finish the card; a thesis says what a company earns from and what would prove that wrong, never that a stock is a buy or will rise; when no listed company has a sourced connection, say so. A constant in the prompt module equals §6 byte for byte (the §4/§5 precedent, pinned by test).
- **The builder system prompt** = the partner's identity + rulebook §4 **without its line (7)** ("one next action, aimed at the weakest link") + §6 + the method block as today (Amendment A) + the builder output contract. **The user turn** = the card as it stands, the goal for this step, the current findings, the retrieval items, and the direction when there is one.
- Ledger sessions keep today's prompt, unchanged. The prompt module stays in the prompt-honesty registry; its tests cover both prompts.

---

## B6. B3 — the server build (dark)

**Files, expected:** `api/forge/shared-research.js` (the `card` action; the builder branches of `open`, `step`, `adopt`, `GET`); new `api/_utils/sharedResearch/thesis.js` (pure: the card's shape, transitions, dependencies, ready, the sentence, the choices, the `rev` rule) and `thesisSchema.js` (the builder turn's schema and its validator additions, reusing `stepSchema.js`'s checks); `stepPrompt.js` (the builder prompts); `store.js` (the card inside `recordStep`'s transaction; `applyCard`; the builder arm of `adoptIdea`); `session.js` (shape, the card on the client view); `copy.js` (lines for `invalid_intent`, `card_stale`, `not_ready`, `invalid_card`); `src/constants/sharedResearch.js` (`SESSION_SHAPES`, `BUILD_GOALS`, `THESIS_PARTS`, part states, limits, `THEME_MAX`); `src/config/sharedResearchFlags.js` + its pin; the rulebook §6. **No rule, no index, no fenced file, nothing under `src/components/`.**

**Tests:** the card's transitions and dependencies (pure, table-driven); ready and stale; the sentence for one, two, three and four names, with and without a segment; each goal's offer rule; each validation rule with the defect it names; `card` idempotency, `card_stale`, and that it calls no model and counts no step; own-words `open` with no framing call; a ledger session byte-for-byte unchanged (its existing tests untouched and green; the recorded probe still validates); `adopt` from a ready card, `not_ready`, the edited-sentence checks, the list carrying the card; out of steps still saves; the shape stamp follows the flag at `open` only.

**Mutations (each must fail a row):** a step sets a part without the player · `ready` ignores a stale part · a name outside the supported set is accepted · a reason backed by an inferred finding counts · a wrong-if option with a price passes · `card` calls the model or counts a step · a `pick` cites a finding not on the record · a ledger session accepts `build` · the flag at `'off'` opens a builder session · `adopt` saves a card that is not ready · changing the segment keeps the old names · the composed sentence drops the wrong-if.

**One recorded probe** (as B1's S-6): one `map_segments` turn and one `build_why` turn on `claude-sonnet-5-5` against a fixture, recorded as test fixtures with usage and cost. Two calls, well under $0.10.

**Measures added to §11.4:** research steps and free taps per ready thesis; time from open to ready; how often a why proposal is incomplete; dropped lines by rule; dead ends by cause.

---

## B7. B4 — the client build (dark), after B3 merges

- The work view for a builder session is rounds 3 and 3b on C-B: the sentence card and its collapsed strip; the conversation (the partner's words, the player's taps, the "card changed" line); research choices and free choices drawn differently; Atlas's pick; a tapped part with who set it, its sources and *Change*; a part's evidence; the wait state; thesis ready (one stock and the group) with "How it will be judged"; saved (today's state); the dead end; out of steps; the failed step; the desktop frame.
- **Wording per W-2:** the wrong-if tag reads "in your words"; the price line reads "optional · add your own".
- **Start:** with the builder mode on, "Bring your own starting point" opens at once (DR-6); the framing screen is used only by ledger sessions.
- **Ledger sessions keep today's work view**, untouched. "All evidence" on a builder session is the existing evidence list.
- The client computes nothing the server returns: the card, ready, the sentence, the choices and the pick are rendered as received. Real-browser rows as in B2 (focus, the layer, the fold at 844).
- The body's props and the hub wrapper do not change.

---

## B8. Not in these builds

The idea-book ending and the watching screen (R3b T6 "idea book on", P1): the Practice Field's, when it can take theses in (W-1, W-3). A field on the idea version for the wrong-if in words and per-part provenance: the framework's; the list carries both meanwhile. Starting from a stock (the stock modal's door). Any change to the knowledge-base package. Retiring the ledger shape: a cleanup PR after the builder has run on the allowlist.

---

## B9. Order

1. **B3** (server, dark): branch `claude/shared-research-b3`, one draft PR; first commit = this amendment, the concept and the two design files.
2. **B4** (client, dark): branch `claude/shared-research-b4`, after B3 merges; smoke branch with fixtures and a phone checklist.
3. **The flip:** a one-line founder PR, `SHARED_RESEARCH_BUILDER_MODE` to `'on'` with its pin. No rule or index to deploy.
4. **The founder's allowlist runs** on real stories and his own words; the measures decide the budget and what comes next.

---

## §B10 · B3 preamble rulings (Nov 16)

The B3 session re-verified the amendment against `main` @ `88d34457` and stopped on one shape difference and three readings (STOP report `20261116_SHARED_RESEARCH_B3_PREAMBLE_STOP.md`). The founder ruled them on Nov 16, 2026; B3 builds from `6a55d679` on these rulings. Where a ruling and an earlier section of this amendment disagree, the ruling wins.

| # | Ruling |
|---|---|
| **S-B1** | Approved: the card is saved on the list as `thesisCard`; `thesis` stays `''` as B1 writes it. Name it in the report and the PR. |
| **S-B2** | Approved: only builder sessions are stamped; no `shape` reads as `'ledger'`. |
| **S-B3** | Approved (the default): `pick.reasons: [{ text ≤140, refs[] }] ≤3`, each labelled by the server. |
| **S-B4** | Approved (the recommended default): dropping names keeps the why proposal for the names that remain. |

**Routine choices 1–20:** approved, with one change —

| # | Ruling |
|---|---|
| **R-21** | Free taps DO leave an exchange. Each applied `card` op appends one player exchange of a new kind `card` (builder sessions only): its op, part, a short label of what was set, and the time. No model call, no step. A retried `opId` appends nothing. This keeps the conversation and the order of decisions on reload. |

**Three requirements from the Practice Field chat's reply (Nov 16), on the saved record:**

| # | Requirement |
|---|---|
| **PF-1** | `thesisCard` is written once, in the save transaction, and never edited by any route. It carries its `schemaVersion`, the watchlist id and idea version (1) it was saved with, and the research session id. Pin with a census test: one writer. |
| **PF-2** | Every finding id in `thesisCard` must resolve, from saved records alone, to its text, source name, link and published date for as long as the list exists. Check whether any code path can delete or prune a research record or its findings while its list exists. If none can, the ids suffice: pin that with a census test and say so in the report. If any can, carry a bounded copy of those four fields per carried finding in `thesisCard`. |
| **PF-3** | The provenance stamp is on builder saves exactly as on ledger saves (session at open, the saved list, passed to the version builder). One test row. |

---

## §B11 · B3 report rulings (Nov 16), with the builder turn's output shape (Nov 17)

The founder ruled on the B3 build report (`docs/audits/20261116_BUILD_SHARED_RESEARCH_B3.md`) on Nov 16, 2026. The probe re-run under P-1 was refused again on both calls, with the API's own words: *"The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools."* (`400 invalid_request_error`, no tokens). The session stopped (STOP note `20261116_SHARED_RESEARCH_B3_PROBE_STOP.md`), and the founder ruled the builder turn's output shape on Nov 17, 2026. B3 builds both from `4618e23e`. Where a ruling and an earlier section of this amendment disagree, the ruling wins.

**On the B3 report (Nov 16):**

| # | Ruling |
|---|---|
| **P-1** | Run the two probes. Have the probe script wrap the call so that, if the API refuses, it records the API's own error type and message in the probe record (never the key, never request headers). Do not edit `modelTurn.js`. If either call is refused again: STOP and report the exact message; do not guess a cause and do not change the schema again without it. |
| **P-2** | On success: commit the two fixtures and `thesisSchema.recorded.test.js`, add each probe's line to the report (model, usage, cost, what the validator kept and dropped, the output size against the 2,500-token cap — watch W-6). |
| **W-1** | Ruled now: the save carries the chosen segment's findings too (still at most 28; current ones, each once). A number in the segment label passes only when it sits in a carried Source-backed finding. One row, one mutant. |
| **W-2a** | Ruled now: the card's own texts license their numbers only where they appear. Before the statement's number check, remove the wrong-if text and the time frame's label where each appears verbatim; a number elsewhere in the statement must sit in a carried Source-backed fact or the set theme. "30%" next to "about 30 sessions" is refused. One row, one mutant. |
| — | The rest of the report's watch list stands as written. |

**On the builder turn's output shape (Nov 17):**

| # | Ruling |
|---|---|
| **S-1** | One schema per goal, not one for all. Each goal's schema holds `reply` plus only what that goal may land (the rule the validator already enforces): **verify_source** — findings, companies, themeSuggestion; **map_segments** — findings, companies, segments, a pick (value + one-line reason), themeSuggestion; **find_names** — findings, companies, a pick (value + one-line reason); **build_why** — findings, why (shared, one reason per name, the point against), wrongIfOptions, a wrong-if pick (option + one-line reason), timeFramePick — no companies block; **strengthen** — findings, plus that part's own proposal only; **pick** — reply and the pick with its reasons (≤3, each with refs) — no findings, no companies; **direction** — the schema of the research goal the card would offer next (findings and companies only when none is offered). |
| **S-2** | In every builder schema, `companies` drops `claim` and `openRef` (the card's why replaces the ledger's claims). The reasons array with refs exists only in the `pick` goal's schema; Atlas's pick on a research goal is value + one reason. The ledger's `STEP_SCHEMA` is untouched. |
| **S-3** | Nothing the client reads changes: the `thesis` view, the choices and every answer in the report's §4 stay as built. If any of them would have to change, STOP. |
| **S-4** | Probe every distinct schema, live, one recorded call each (fixtures as P-2). Iterate without stopping, up to 16 calls and $0.50 in total. If a schema is refused, record the API's message and reduce in this order, re-probing after each: (1) remove union types (the empty-string-for-none rule); (2) flatten (a refs list as one string of ids the validator splits; fewer nested objects); (3) shorten enum and description text. If a goal still cannot compile without splitting it into two paid steps, STOP and report: that one is the founder's. |
| **S-5** | Pin it: a test per schema that counts objects, arrays, properties and union types, and fails if any builder schema grows past the numbers that compiled. Report each probe's model, usage, cost, elapsed time (first use includes compilation), output size against the 2,500-token cap, and what the validator kept and dropped. |
| — | Then, as ruled before: W-1, W-2a (each with its row and mutant), this §B11, the merge of `origin/main`, the full suite, rules, `lint:gate`, the ledger differential, the bundle comparison, the mutation battery on the final tree, the report update and the push. One refuter pass over the schema split only (honesty and integrity): each goal still lands only its own proposals; nothing is set by the model. |

---

## §B12 · B3 §B11-round rulings (Nov 17)

The founder ruled on the §B11 round's two questions and its watch list on Nov 17, 2026. B3 builds them from `e8cc184c` under the same fences as §B11: dark, the ledger byte-identical, `modelTurn.js` untouched, key handling unchanged, no merge, no CI watch. Where a ruling and an earlier section of this amendment disagree, the ruling wins.

| # | Ruling |
|---|---|
| **Q-1 → (a)** | Drop `pick` from `strengthen:segment`, `strengthen:names` and `strengthen:wrongIf`, and `timeFramePick` from `strengthen:timeFrame`. The strengthen user turn says the part is already set by the player and asks for evidence for or against it, not a pick. Re-probe those four (4 calls, inside the 16-call / $0.50 cap; a refusal = stop and report). Recorded test: on `strengthen:names` and `strengthen:timeFrame` the model's own reply stands. |
| **Q-2 → (b), at the dead end only** | While `blockedNow` is true, a `direction` step is asked as `find_names` (schema already compiled; no new call). Everywhere else S-1's letter stands, including `direction` asked as `strengthen:theme` once the why is set. |
| **W-10** | Rule 1 changes. A name's reason is kept when (1) it has at least one ref, (2) every ref is a current Source-backed (verified) finding, and (3) at least one ref is about that name. The number rule is unchanged. Apply the same reading everywhere the rule is checked: the validator, the confirm-time re-check, ready, and the save. Update rulebook §6 and the prompt to match. No model call: replay the recorded `build_why` and `strengthen:why` answers and pin that the NVDA reason is kept and the why is complete. |
| **W-13** | Make it an offered choice. When the why is set and a complete proposal is waiting, `choices.free` offers `{ op: 'confirm', part: 'why', revised: true }`. It replaces the set why (`by: partner_suggested_confirmed`) and clears nothing else. Confirm the thesis view carries the waiting proposal so B4 can show it before the tap; add it if not. Record both in the report's §4. |
| **W-12** | Leave. S-1 meant the model's output; the validator's ceiling stays three. |
| **W-11** | No change; note it in the report's §4 for B4. |
| — | Then: a row and a mutant for each change, the ledger differential re-run, the full suite, and the report appended as the §B12 round. |

---

## §B13 · Before the switch (Nov 17)

B3 (the server, #1083) and B4 (the screen, #1086) are merged and dark. The founder walked the phone preview and ruled four server fixes and two screen lines before the one-line switch, on Nov 17, 2026. B5 builds them from `main` @ `2e069d42` on branch `claude/shared-research-b5`, dark: `SHARED_RESEARCH_BUILDER_MODE` stays `'off'`, the ledger byte-identical, `modelTurn.js` untouched, no schema recompiled, no merge, no CI watch. Where a ruling and an earlier section of this amendment disagree, the ruling wins.

| ID | Ruling |
|---|---|
| **T-1** | **Own words never become the theme.** This amends DR-6, which said the player's words become the theme. `openingCardOf` leaves the theme unset for every own-words open: SQ-2's rule for long words now holds for all. The words stay on record as the player's observation ("Your words"). The first `map_segments` suggests a theme when none is set: a short noun phrase of two to six words, never a sentence, at most 80 characters, in the agent's own words. The player confirms it (free) or writes their own (free), as today's free choices allow. Stories and drops keep `verify_source`'s suggestion, unchanged. |
| **T-2** | **The theme gates nothing.** No research goal requires a set theme. `map_segments` is offered while the segment and the names are unset; `find_names` while the segment is set, the names are unset and no dead end holds. Ready is unchanged (it never needed the theme). When the card is saved with no theme, the composed sentence opens **"Built on {names}, through {segment}, because …"** (or "Built on {names}, because …" with no segment) instead of "Through …". The theme's free choices stay on offer until it is set. |
| **T-3** | **Two short sentences.** Rulebook §6 and the builder prompt say: reply in at most two short sentences, about 280 characters — first what this step found, then what it proposes for the card. Do not repeat what the card or the choices already show. Speak to the player as a partner; never "your observation", "the retrieved items" or "the record". §6 changes in one place and stays pinned byte for byte. The server cuts the model's reply at a sentence's end at **320** characters. The server's own lines (the replaced reply, the dead-end line, the unsourced line) may take the whole to 600, as today. The schema's description text is unchanged (no recompile). |
| **T-4** | **No save while a step is running.** `adoptThesis` refuses `409 step_in_flight` inside its transaction, by the same rule `applyCard` uses (a running step that is not stale). It is checked before the rev and before anything is written. A stale running step does not block, as on the card route. Builder save only; B1's ledger adopt is untouched. |
| **T-5** | **The newer time-frame answer wins.** When a step lands an asked time-frame pick, it clears the older time-frame suggestion. When a later step lands a new suggestion, the next step's pick rule (already: every step replaces the pick) leaves only that suggestion. The free `confirm` then always carries the one that is on the card, and its label says which ("{agent} suggested" or "{agent}'s pick"). |
| **T-6** | **The screen: a suggested theme does not hold the front.** In `frontPartOf`, a theme whose state is `suggested` is skipped. Its confirm and its "write your own" show as one small line at the top of the choices: "Use '{suggestion}' as the theme · free". The part in front is the next one, so the segment map's choices show at once after the first map. An unset theme with no suggestion stays in front, as today. |
| **T-7** | **Three recorded probes** (founder-authorized, at most 3 calls, total at most $0.10, a new ledger file for this round). Own words "I want to play AI": (1) `map_segments` on the T-1 card, which must return a theme suggestion of six words or fewer and a reply of at most 320 characters; (2) `find_names` on that card with the segment set and the theme unset (T-2); (3) `build_why` on one name. On `claude-sonnet-5-5`, with the real builder prompt. `CLAUDE_API_KEY` comes from the parent checkout's `.env.local`, loaded into the probe process only: never print it, never copy `.env.local` into the worktree, never commit it. The fixtures hold the response, usage and cost only. A refusal or a missing theme suggestion: STOP and report the API's own message. |
| **T-8** | **Two closings from B4.** (a) B4's Q-1 and Q-2 stand as built: record them closed in §B13. (b) The wrong-if tag reads **"in your words"** only when the player wrote it (`by: 'player_wrote'`). Otherwise it reads **"in words"**: still not "watched" (W-2), and no longer claiming words the agent wrote. |

**Closed by T-8 (a):** B4's **Q-1** (a why proposal's reason wears "Source-backed" only when its name is not incomplete and it is that name's only reason) and **Q-2** (Save stays held for `too_many_evidence_refs` whatever the player writes; for `unsupported_assertion` and `names_not_supported` it is held only while the statement sent would be the server's own sentence) stand as B4 built them (`docs/audits/20261117_BUILD_SHARED_RESEARCH_B4.md` §10). No change.
