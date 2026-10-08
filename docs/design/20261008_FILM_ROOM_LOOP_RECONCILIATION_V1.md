# Film Room ↔ Forge loop — Reconciliation V1 (provisional)

**Date:** 2026-10-08 · **Author:** Fable (Film Room chat) · **Answers:** `docs/design/20261008_FILM_ROOM_FORGE_LOOP_HANDOVER_CHATGPT.md` · **Status:** provisional. Each disposition is confirmed, narrowed or amended by the Phase 0C discovery (`docs/audits/20261008_PHASE0C_FILM_ROOM_LOOP_DISCOVERY.md`) and then fixed in the shared contract. Approve-by-default for Flash. Nothing here authorizes a build.

**Governing inputs:** Film Room design note V1.3 (R1–R16); Build A spec V1.2 + Amendments A–D (BA-1–BA-39, honesty invariants 1–9); `docs/AGENT_LEARNING_CHARTER_V1.md`; the Forge Record design V1.1; the framework arc: pilot spec V1.4 (P1–P7, `PILOT_JOURNEY_MODE`), the Sep 23 founder ruling sheet V1.1 (R2–R9 incl. R8 week-scope freeze), the Oct 7 record-slice Phase 0 decisions D1–D3; cockpit Build 1a spec V1.2 (B1-9 no "held", B1-10 no causal attribution).

## L-1 — Direction adopted

The connected loop (Film Room examines → the learning process qualifies → Forge applies supported adjustments → later games produce evidence → Command Center shows continuity) is the destination. It is design note V1.3's Builds B and C plus the framework pilot's SignalDrop→Film Room journey, with one real change: the agent prepares the review. Nothing in it replaces Build A; the tape is the evidence substrate every step reads.

## L-2 — Ownership split

Reconciles the Sep 15 lean ("attach to the archetype"), framework D1 ("the idea belongs to the Shadow+player partnership, not an archetype") and the handover's "two forms of development":
- **Partnership-owned:** ideas (hypothesis versions under the player's watchlist, `agentId` as provenance only — D1), research records (P2), confirmed preferences, open questions. They survive an archetype switch.
- **Archetype-owned, per user:** behavioral candidates, trials and equipped adjustments. They do not transfer across archetypes untested, and never rewrite the canonical archetype.
- **Battle-owned:** the tape and its actions (owner-readable, server-written).

## L-3 — Artifact mapping (Phase 0C confirms each row)

| Handover artifact | Existing record or path | Status |
|---|---|---|
| Open question | Hypothesis version (P1a, PR #937) with the `review_due` transition in the reflections cron tenant (D2) | exists, dark |
| Follow-through record | P5 evidence-join reference fields on capture/receipts (specified); `callEvents` receipts (Build 1a, merged dark) | partly built |
| Lesson candidate and trial | Charter maturity (Hunch / Testable / Trial-proven) + the pilot's advisory stage; the target must be one of the 46 canonical adjustments | specified |
| User-requested adjustment | the directive gate and equip path; next deployment only (a running agent returns 409 — Fable review B4) | live |
| Reviewed decision | a tape action (A1, live) + its call record (`CALL_RECORDS_MODE` shadow) | live / shadow |
| Confirmed partnership preference | **none** — the Sep 23 audit found no writer for the partner profile | the one new record; its store is decided in the contract after Phase 0C |

No new learning store. The Forge Record Ledger is the home for review artifacts (design note), and the contract maps each artifact to a store before any writer is built.

## L-4 — The grounding gate (C-7)

No agent-authored sentence appears in the Film Room until a review grounding path exists. Today the chat grounds only in battle mode (`api/agent/chat.js`, `mode === 'battle'`), `VOICE_GROUNDING_MODE` is `shadow`, and the 2026-10-05 tape records an ungrounded reply that misstates the swap mechanic ("the old points and thresholds vanish"). The review mode should reuse the cockpit's Build 1a call-response endpoint, grounded on the tape document instead of the live battle. This is a behavior-changing platform build and takes a one-at-a-time slot; Flash schedules it against P1b.

## L-5 — R5 (tomorrow's card)

v1 stays player-authored and becomes a hypothesis version saved from the Film Room (strongest reuse: P1a already stores it and D2 already schedules its review). The agent-proposed, user-confirmed form is the first grounded release, not before L-4.

## L-6 — Case selection and interpretation

"Recommend one case" requires a declared, deterministic rule that the screen names (for example: the day's first discretionary swap; else the first platform-forced exit; else none), never a model's pick. Honesty invariant 9 stands. "What went well, what went poorly" is Build B's character verdict and waits for the formalization session (R7, R15, R16).

## L-7 — R2 stands

Auto-debrief `forgeSuggestions[]` and `proposedRules` stay retired at the writer. No legacy narrative (review rules, reflections, retained memory) is promoted into a lesson; historical sources stay labeled as such. The framework's FR-7 freeze-routes memo governs every prompt-influencing writer.

## L-8 — Forge

The three views (what is active / recommended next / what we are testing) sit over the Forge Record's three benches; the Ledger is the artifact home. Forge has no trading authority: only the equipped configuration and the executor determine behavior. "One approval" means the existing validated equip path invoked from a Film Room card, scoped to the next deployment, never a second store or a second approval. An item with incomplete provenance says what is unknown.

## L-9 — Receipts and "used"

A receipt states what persisted, its owner, its source, any behavioral effect, its effective timing and the next observable step; a failed save never reads as complete. "Used" is shown only after a recorded retrieval or application (B1-10: no causal attribution; the tape's recorded/derived discipline). Protective exits are treated separately from discretionary swaps (BA-6/BA-7; the exit-dials arc's R3): ordinary swap regret never teaches the agent to remove a safeguard.

## L-10 — First proof journey (adopted as the handover proposes)

One prepared case (L-6 rule) → one choice limited to *save a preference* or *track an open question* → a receipt → Command Center shows the open item and its source → a return review resolves it on the next relevant battle. No trial, no Forge change, no trading authority. Dependencies: A2 (the screen), L-4 (grounding), P1a flipped (hypothesis records), the preference record from L-3.

## L-11 — Sequence (completion requirements, not dates)

1. **A2** (facts-only screen, dark; design accommodates the later header and footer) — now.
2. **Phase 0C** (read-only discovery of the loop's substrate at HEAD) — now, alongside A2.
3. **Shared contract** (identity/scope, meaning/authority, source/lifecycle, application/timing, use/failure) — after 0C; this is the merged plan.
4. **Forge "what is active"** read-only view — alongside anything; no behavior change.
5. **Review grounding** (L-4) — the first behavior-changing build; one under review at a time.
6. **First proof journey** (L-10) — after 5 and after P1a flips.
7. **Trials, one-approval, Forge "recommended next"** — after Charter qualification (pilot P3/P4, advisory stage).

Command Center remains the primary implementation effort; nothing above widens its release scope.
