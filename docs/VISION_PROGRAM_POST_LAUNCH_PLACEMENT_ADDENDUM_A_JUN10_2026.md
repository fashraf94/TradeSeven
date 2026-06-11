# Vision Program Post-Launch Placement — Addendum A

**Companion to:** `VISION_PROGRAM_POST_LAUNCH_PLACEMENT.md` (June 4, 2026)
**Date:** June 10, 2026
**Status:** Locked as a record; the §2 hypothesis is explicitly a hypothesis, to be validated at the tournament spec pass.
**Cross-references:** `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md` (design-complete, June 10); `FANTASYTRADES_PRELAUNCH_SEQUENCE_AMENDMENT_A_JUN10_2026.md` (strikes Item 5, binds the Signal Capture Rider to the tournament build).

---

## 1. What changed since the placement doc (June 4 → June 10)

The placement doc parked the rich Vision program as the lead post-launch arc, paired with Dossier Sprint 2 as the two horizons of one conversational-signal pipeline, and flagged its §8 decision — committing to the rich Vision over the lighter live model — as a product choice to make deliberately. Six days later, three things moved:

1. **The League Tournament is design-complete (V2.1).** The flagship game's user↔agent relationship is now concrete: a parallel-layer battle where the user runs a 3-stock layer (weekly draft, overnight claims, in-battle long↔short flips) and the agent runs a 6-stock layer autonomously, with the agent seeing its player's picks via the USER PICKS deploy block.
2. **Grading is killed (founder decision, June 10).** League rank + seasonal leaderboard are the only user measures. The grading thread woven through the old Voice Layer Phase 6 and the V1.1 stance §6 ends here.
3. **The Vision↔draft-board convergence is acknowledged (founder, June 10)** as the working hypothesis for where the Vision lives in the flagship game — §2 below.

The placement doc's standing rules carry: don't touch the inert Vision scaffolding pre-launch; don't pull 2b/3 into launch; don't re-spec from the April docs without a fresh discovery pass.

---

## 2. The §8 decision now has a candidate answer

**Hypothesis of record:** for the flagship game, the Vision's production home is the **weekly user draft board + the flip stream**, with the board-prep conversation as its authoring surface.

Why the mapping is natural:

- **The pre-committed draft board is a falsifiable weekly directional thesis by construction.** Ranked, committed before the window, resolved against reality over five trading days. It is what the Vision object was designed to be — a structured, co-authorable statement of "what I believe and where I'm looking" — except it's *mandatory*, produced every round by every player, and already has a resolution mechanism (the week's score).
- **Flips are live Vision updates.** The leg model gives every stance change a timestamp, a price, and a banked consequence — falsifiability is built into the mechanic. V2.1's own spec language already says it: *identity changes are slow, stance changes are fast.* That is a Vision lifecycle expressed as game controls.
- **Claims are thesis rotation.** The overnight identity change is the "my view of the market shifted" event, on the deliberate clock.
- **The authoring surface already has a reserved slot.** V2.1 §12 defers "pre-committed user-board prefill source" to the spec pass. That is exactly where the war-room conversation belongs: the user articulates their weekly read of the market in conversation, and the board is the artifact the conversation produces — the founder's June 10 framing, that the board helps users *articulate what they may and may not want depending on how they view the market for the week.*

**What this means for Spec A:** the five-element vocabulary survives as the **presentation and conversation layer** over board + flips, rather than as a parallel directive object. The agent-battle-side Vision (autopilot fallback generation, Strategy→Vision constraint injection, the directive cutover) remains the *other* horizon — per-battle direction for the agent's own layer. Two homes, one vocabulary. The war-room brainstorm reconciled in the placement doc §6 stays the design north-star; it now has a production surface that didn't exist when it was parked.

**Honest boundaries on the hypothesis:**

- **It is not locked.** The §8 commitment (rich Vision vs. lighter model) is still open — but it must now be made *against the tournament*, not against the April premises. Re-grounding before commitment is mandatory.
- **Tournament V1 ships a bare board.** No Vision layer is required for launch. The board, claims, and flips are complete game mechanics on their own. The Vision arc is the post-launch *deepening* that turns the board into a conversation artifact — never a launch dependency (consistent with V2.1 §4's fence: no Voice Layer→Trading Brain coupling promised beyond Forge rules, presets, debates, flips, claims).
- **One V1-adjacent decision lands at the spec pass anyway:** the §12 prefill-source question. The spec pass should answer it knowing this hypothesis exists (e.g., scout top-ranks as prefill now, conversation-authored board later), without expanding V1 scope.

---

## 3. Sprint 2's input model is formally superseded

The placement doc flagged that Sprint 2 "needs an inputs rethink." This section is the rethink's frame — recorded now so the arc isn't designed off stale premises later.

**Superseded (do not build):** the three input infrastructures from the May 4 spec — veto event capture, the daily handoff-artifact extraction as specced (co-tenant nightly write in `agent-batch-review.js`), and `partnerObservations[]` as a film-room-extracted field. All three were designed for the co-pilot trading-authority relationship. The battle pattern aggregator survives in spirit (cross-battle synthesis is still needed) but re-points at the new sources.

**The three signal families the arc reads instead:**

1. **Training-mode autopilot signal (thin, existing).** Film Room review chats, `consolidatedInsight`, the shipped Phase 1–4 message surfaces. The retroactive-trigger pattern the V1.1 stance designed for autopilot users applies here.
2. **Tournament management signal (the rich vein — new with the game).** Draft-board composition and the scout-prefill delta (the veto-event replacement: what the agent suggested vs. what the user kept, reordered, cut — mandatory, weekly, ordinal); flips (direction conviction with price and time attached); claims (rotation intent); the agent's USER PICKS reaction (double-down / abstain / narrated disagreement); debates (live today); nightly loadout edits (archetype/trait/watchlist changes as preference signal); round-boundary Film Room reviews (the handoff moment, re-grounded from daily cadence to the round boundary).
3. **Research Companion signal (when that arc ships).** Discuss / save / dismiss actions on idea cards plus the seeded Gemma discussions — `partnerObservations`-shaped by nature.

**What survives unchanged into the arc:** the funnel principle (single canonical writer per derived field), the Sonnet writer template from Sprint 1, the 5-cycle consolidation gate, the `partnerProfile` 15-dimension per-confidence schema, the `convictions[]` schema. Only the front of the funnel moves. The `disciplines` dead-write and the `consolidatedInsight` compatibility string remain open items for the arc's discovery pass.

**Removed from the arc's scope:** user directional-clarity grading (killed June 10; league rank owns the measure; Film Room stays qualitative-only).

---

## 4. Signal Capture Rider — the event catalog (single source of truth)

Binding on the tournament spec pass and implementation per Pre-Launch Sequence Amendment A §4. **Cost is logging, not writers.** Each event below must be written in a structured, writer-readable shape (fields, not display strings) at the moment the action it records occurs. None of these writes may block or destabilize the action producing them.

| # | Event | Captured fields (minimum) | Written when |
|---|-------|---------------------------|--------------|
| 1 | **User draft board commit** | Final ranked board; the scout prefill as suggested; the delta (kept / reordered / removed per name); round + group context | At board commit, per round |
| 2 | **Agent board at deploy** | The agent's ranked ~15–20 board (the Sonnet pass already produces it — persist, don't discard) | At morning deploy |
| 3 | **Draft resolution stream** | Pick-by-pick resolution events (the playback surface needs this anyway — one record serves both) | At server-side resolution |
| 4 | **Flip events** | Symbol, direction from→to, timestamp, flip price, banked leg score | At flip (already public feed events — ensure stored shape carries writer fields, not just display) |
| 5 | **Claim events** | Placed (target, drop, timestamp); resolved (won/lost, priority context) | At placement and at pre-open execution |
| 6 | **USER PICKS reaction** | Per user pick: the agent's stance (double-down / abstain / disagree) + reference to any narration message | At deploy, from the agent's first-pass output |
| 7 | **Debate transcripts** | Already in `chatExchanges[]` — confirm queryable per battle with tournament context attached | Existing path; tag at write |
| 8 | **Nightly loadout edits** | What changed (archetype / traits / watchlist / rules), prior → new, timestamp | At save in the nightly window |
| 9 | **Round-boundary Film Room review** | Existing review exchanges, tagged with round/bracket context | Existing path; tag at write |

Implementation notes for the spec pass: prefer co-tenant writes with the producing action (no new cron); apply the shadow-logger discipline where Firestore cost matters; where a write must survive lambda termination, use the Sprint 1 queue-flag pattern rather than fire-and-forget. Discovery should confirm which of #4/#7/#9 already persist sufficient shape versus needing field additions.

---

## 5. What this addendum does not do

- It does **not** start the Vision arc, commit the §8 decision, or relitigate the lighter-model launch.
- It does **not** add tournament V1 scope beyond §4's logging.
- It does **not** redesign Sprint 2 — §3 is the frame the future design pass inherits, written down so the arc starts from June 2026 reality instead of May 2026 specs. The arc still begins with its own fresh discovery audit, after a real observation period of live tournament corpus.

---

*Addendum A prepared June 10, 2026, alongside Pre-Launch Sequence Amendment A, from the V2.1 tournament design and the June 10 founder decisions.*
