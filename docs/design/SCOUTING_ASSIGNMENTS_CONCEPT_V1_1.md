# Scouting Assignments — the character asks for a call (V1.1)

**Date:** September 1, 2026
**Status:** Concept V1.1, pre-spec. **Supersedes V1.** Sol pass one applied (findings 12–13, and his authority note). Own mini-arc; enters spec only after Phase 0 proves the two predicates in §3. Slots after Direct and the per-directive receipt.
**Prepared by:** Fable, with Flash (founder idea, Sep 1).
**Suggested commit location:** `docs/design/SCOUTING_ASSIGNMENTS_CONCEPT_V1_1.md`
**Companions:** Controller brief V1.2 · Cockpit brief V1 · Phase 0 discovery V1 · framework V1.2 · Scouting Focus V1.1 / V1.3

**What changed in V1.1:** the trigger is written as two predicates to be proved, not as a fact; the ahead-side framing is deleted; the "your calls" record is removed under the no-grading rule; an answer is a structured write with no budget and no character reply; *preference* is the weakest directive kind with no tie-break priority; the character's copy asks for a preference and nothing more, the interface states the mechanics; receipts follow the Controller's two tiers.

---

## 1. The idea

When two names on the battle's bench rank nearly even for the equipped archetype **and** a swap is possible before a coming check, the character sends the user to scout them: *"PLTR and CRWD rank almost even for a Speculator today. Scout both. Which do you prefer?"* The user gets a scouting window (the two names side by side, with the evidence the platform already produces, and doors to the screener and correlation tools), a due check, and four answers: A, B, neither, your call. The answer is stored as a *preference* — the weakest directive kind — and the check that follows stamps whatever receipt the system can prove. The character still decides.

Working name: **Scouting assignment** (verb: *Scout it*). Consistent with the house vocabulary: Scouting Focus renamed "research" to "scouting" because research reads like homework and scouting is game behavior. The scouting *board* is what the character hunts from; an *assignment* asks the user to scout two names off it.

## 2. Why it matters

1. **It gives Direct a reason.** At beta the confidence side has one verb. An assignment is the bridge from curiosity (Show it) to confidence (Direct): the character asks → the user scouts → the user answers → a confirmed check resolves it.
2. **It is the opening move.** The framework noted that no obvious opening move has ever existed on the conversational surface. Here the opening move is the character's.
3. **It leaves the app with the user.** A call with a due check is an open loop. It is the one honest reason for a push notification and the most urgent thing the cockpit can show.

It is not a fifth verb; it is the character using the user's verbs.

## 3. The honesty rule — two predicates, both to be proved

"I'm torn" cannot be the voice model deciding to sound torn (C1). An assignment may be issued only when **both** of these are mechanically true, read from persisted battle state without fence contact:

- **P1 — the tie.** Two bench names whose archetype rank differs by less than a defined margin, read from the post-rank archetype output the scouting board already uses (Scouting Focus V1.3 §3: focus influence begins *after* the base ranking exists; the ranking engine is never touched). Margin, persistence, readability, and real-world frequency are Phase 0 questions, not assumptions.
- **P2 — the swap possibility.** A swap involving those names can actually occur at or before the due check under the live swap-window and lock rules. If P2 cannot be known ahead of a check, the ask cannot name a due check and the concept must be reshaped or dropped.

If either predicate is false, no assignment is issued. Silence is truthful.

**Copy rules.** The character cites the fact (`rank almost even`) and asks for a preference — nothing more. It never says what it will reach for, rotate to, or protect. The *interface*, not the character, states the mechanics: when the preference expires and which check will see it (wording gated on the receipt proof, exactly as for Direct). **The deficit is never the trigger** and the ahead-side framing ("which protects it?") is prohibited: rank proximity proves nothing about protecting a lead.

## 4. Lifecycle

| State | What happens | Where it shows | Source of truth |
|---|---|---|---|
| **Issued** | At a confirmed check, in character, citing the tie and naming the due check. Server-initiated turn. | Tape; *This turn*; cockpit; push (optional, flagged) | P1 ∧ P2 at issue time |
| **Open** | The scouting window: the two names side by side — the scouting board's reason chips, the evidence rows the research path returns (provisional until items 18–19), and doors to the screener and correlation tool. | *This turn*; the window opens from the card | Existing research path, run for two names |
| **Answered** | `PLTR` · `CRWD` · `Neither` · `Your call`, plus an optional one-line note. **An answer is a structured write, not a chat turn:** no character reply, no message budget consumed. If the user wants to *discuss*, that is a follow-up and costs a message. | Tape (user entry with a `Scouted` chip); *This turn*: `Answered · PLTR · expires at the ~2:00 check` | Stored as a directive of kind *preference* through the normal channel and the gate; no special priority |
| **Receipt** | **Floor:** `2:00 · Acted · swapped in PLTR ↳ from your call` when a trade cites the preference; `Expired` when the due check passes. **Ceiling (gated on the per-directive receipt):** `2:00 · Heard · holding — no swap this check`. Nothing else renders. Pairing a hold with the user's call is a ceiling claim, never inferred. | Rows and tape; leaves *This turn* | Controller §5.3 tiers |
| **Expired** | Due check passed unanswered or unresolved. `Expired` — and `I went with PLTR` only if a trade happened. | Tape | Battle state |

*Removed in V1.1:* the post-close "your calls" record. Scoring the user's picks is grading in substance, and grading is locked out (Amendment 2, Jun 10). The retention hook does not need it; the open loop and the receipt do that work.

## 5. The window is one card, not a hub

Two names side by side, the reason chips the scouting board already carries, the evidence rows, and links out. Nothing the user does inside the tools feeds the character; only the answer and the note do (C2). The window never says what the character will do (C1). Inside the battle the only forward path is the answer; outside it, Show it's next-deploy flag.

## 6. Guardrails

- **Cap:** one assignment per battle under fullday; one per day under 3-day.
- **Answers always include *Neither* and *Your call*.** The character must be able to hear "no."
- **Answer force:** *preference* is the weakest directive kind; it enters through the same gated channel as every Direct input, gets no tie-break priority, and the character is free to ignore it. That is what keeps it influence rather than execution.
- **Flag-gated, instrumented:** issue rate, answer rate, pick distribution, honor rate, time-to-answer. Default may reasonably be off until the numbers say otherwise.
- **The rubber-stamp loop, named.** Sol flagged "file this" because the agent proposes and the user rubber-stamps with user authority. An assignment is that loop with the character also choosing the framing. The weakest kind, the "no" answers, and the honor-rate instrumentation are the mitigation; if honor rate looks like obedience, the flag goes off.
- **No assignment without P2.** A dead ask is worse than no ask.
- **Offline users.** Expiry is quiet and truthful; at most one push at issue.

## 7. Where it shows

- **Controller (Battle View):** a card in *This turn* with the due check; the window opens from it; the receipt lands on rows and in the tape.
- **Cockpit (Command Center):** the top line of the live card — `1Agent asked for a call before the ~2:00 check: PLTR or CRWD` — rendered only while P1 ∧ P2 still hold and the answer is open.
- **Push:** one notification at issue, flagged separately.

## 8. Dependencies and sequencing

Depends on: Direct (a preference is a directive kind), the per-directive receipt (framework item 8) for anything beyond the floor, the research path for one name run twice (items 18–19), the server-initiated turn pattern (`ensure-opener.js` / statusFeed writes — "a second thing to build" per §7.1), a *preference* kind in the directive allowlist and its ingestion in the control prompt, the scouting board's persisted ranked output, and a client-readable swap-possibility predicate.

Sequence: cockpit card → Controller: Why? → *This turn* + tape → Direct with floor receipts → Show it → **Scouting assignments**. Under 3-day battles (D-14) the assignment becomes overnight homework — its strongest form; a point for that ruling when it comes up.

## 9. Phase 0 discovery questions (read-only, hard STOP)

1. **P1 source.** Where does the archetype-ranked output of the bench live at HEAD; persisted or computed in-eval; readable without fence contact; timestamped? `file:line`.
2. **P1 margin and frequency.** What rank distance is "close," and on recent battle data how often would two bench names qualify? A daily trigger is noise; a never-trigger is a dead feature.
3. **P2.** Swap mechanics for bench → book mid-battle: windows, locks, tier entry; can "a swap is possible before check T" be evaluated from persisted state before T?
4. **Preference kind.** Is there a directive kind close to *preference* in the allowlist / gate; does the control prompt ingest it; does `submit_trade_decision` echo enough to produce the floor receipt?
5. **Server-initiated turn.** What exists; what a due-timed ask needs; how the budget accounting treats a structured answer (must be zero) and an optional note.
6. **Research ×2.** Latency and cost for two names in one turn (item 18 ×2); can the reason chips be reused?
7. **Push.** What notification infrastructure exists, if any.

## 10. Rulings needed

| # | Question | Fable's lean |
|---|---|---|
| A-1 | Name | *Scouting assignment* / *Scout it* |
| A-2 | Is the answer free? | Yes, by construction: a structured write, not a chat turn. The note travels with the write and gets no reply. |
| A-3 | Cap | 1 per battle (fullday) / 1 per day (3-day) |
| A-4 | Answer force | *Preference* — weakest kind; no tie-break priority; same gate |
| A-5 | Framing | Tie only. Deficit never the trigger; no ahead-side ask. |
| A-6 | Push at issue | Own flag; off by default until the feature proves out |

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| P1 not a persisted, readable fact → fabricated dilemma | High | Phase 0 items 1–2; no assignment without P1 |
| P2 unknowable ahead of a check → dead asks | High | Phase 0 item 3; no assignment without P2; reshape or drop |
| Rubber-stamp loop stronger than "file this" | High | Weakest kind; "no" answers; honor-rate instrumentation; flag |
| Reteaches intervention when losing | Medium | Tie is the trigger; deficit is context at most |
| Receipt overstates ("holding because you said") | High | Floor only until the ceiling is proven; no causal pairing |
| Window grows into a research hub | Medium | One card; links out |
| Budget accounting drift | Medium | Answers are writes; discussion costs; Phase 0 item 5 |
| Cost creep (research ×2) | Low | Cap; existing path; no new model |
| Push becomes nagging | Medium | One at issue; own flag |

## 12. Copy fixtures (proposed — string requests)

- Ask (Sol's minimum): *"PLTR and CRWD rank almost even for a Speculator today. Scout both. Which do you prefer?"*
- Interface line under the ask (gated wording): `Your preference expires at the ~2:00 PM check.`
- Answers: `PLTR` · `CRWD` · `Neither` · `Your call`
- Answered chip: `Scouted · PLTR · expires at the ~2:00 check`
- Receipts, floor: `2:00 · Acted · swapped in PLTR ↳ from your call` · `Expired`
- Receipts, ceiling (gated): `2:00 · Heard · holding — no swap this check`
- Expiry with trade: `Expired · I went with PLTR`
- Cockpit: `1Agent asked for a call before the ~2:00 check: PLTR or CRWD`

*Prepared September 1, 2026. Nothing here is a build instruction.*
