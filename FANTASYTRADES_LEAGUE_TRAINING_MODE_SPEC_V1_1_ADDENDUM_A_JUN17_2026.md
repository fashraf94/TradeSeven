# League Training Mode Spec V1.1 — Addendum A
## Slice 2: Interactive Draft Design

**Type:** Design-spec addendum (companion to `FANTASYTRADES_LEAGUE_TRAINING_MODE_SPEC_V1_1.md`).
**Date:** 2026-06-17 · **Version:** A.
**Refines:** V1.1's draft model. **Supersedes:** V1.1's scout-seeded board.
**Grounded in:** the Slice 2 read-only discovery (2026-06-17) and the four-question design deliberation.
**Related record:** `FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_AMENDMENT_A_JUN16_2026.md` (governance deltas).

---

## Purpose

V1.1 specified an interactive user-layer snake draft but left the *how* open and assumed a scout-seeded board the discovery proved infeasible pre-battle. This addendum records the four decisions that settle the Slice 2 draft design. They govern the **user layer only** (each seat's 3 picks); the agent layer (Slice 3), claims (Slice 4), and entry hero (Slice 5) are out of scope here.

---

## Decision 1 — Live, pick-by-pick snake draft

The user-layer draft is a **live interactive snake draft**, mirroring the dashboard Snake Draft experience — not a board-submit. Each seat picks 3 in snake order; the human picks live while three CPU seats pick on their turns. The board visibly depletes as picks are made.

**Why:** the live draft is the differentiated, sticky core of the product — the moment that feels like a game rather than a form. Training is the proving ground for the tournament's draft, so it must validate the live flow, not a stand-in. **Feasibility:** at the 1-human + 3-CPU pod shape, a live draft is async-friendly — the human drafts whenever they want against instant CPUs, with no matchmaking or scheduled-draft-time system required. The multi-human-simultaneous case is deferred until the tournament fills pods without CPU padding. **Precedent:** this is effectively the tournament's draft model too.

---

## Decision 2 — Universal board with a live archetype-fit overlay

The draft board is **universal**: one shared read of `indexIntelligence/stockRankings`, sector-grouped, momentum/composite-sorted, identical for every player.

**Scout-seeding is superseded and deferred.** The discovery confirmed scout signals (`scoutAlerts`) don't exist until a battle does, so there is nothing to seed from at draft time. Scout-seeding becomes a post-launch enhancement contingent on a pre-battle scout store, which is a Forge-integration dependency. The board is built from the verified pre-battle signals: `sectorName`, `momentumScore`/`momentumRank`, `compositeScore`.

On top of the universal board sits a **thin per-player highlight overlay**: run `computeArchetypeRankings` for the agent the player chose and mark the top **~5 still-available** names as archetype-fit. The overlay tracks availability live — when a highlighted name is drafted, the highlight moves to the next-best available fit. The overlay **informs, it does not constrain**: the user picks freely, and the highlight surfaces a deliberate "harmonize or hedge" choice against their agent's archetype rather than steering the pick. Five highlights for three slots preserves agency (choosing among fits, not tapping a pre-decided three). The board stays a single shared object; only the highlight is per-player.

---

## Decision 3 — `DRAFTING` in-draft state, transition-only handoff

The pod sits in the existing (currently unused) **`DRAFTING`** status for the duration of the live draft. This isolates the in-draft pod from any selector that keys on `FORMING` (the Monday pipeline, the abandonment sweep), so a background process can never auto-resolve a draft mid-pick and yank it out from under the player.

Picks are **written live** — the picks *are* the draft — so the handoff to `AWAITING_OPEN` is **transition-only**: it stamps status and the start anchor and does **not** re-run the deterministic resolver. Transition edges are additive (`FORMING → DRAFTING → AWAITING_OPEN`), the same pattern Slice 1 used. The snake order comes from the canonical pure `generateSnakeOrder` (called, never copied); the duplicate inline order in `resolveSnakeDraft` must be unified to that source or locked under a consistency test.

Going live forces the formation flow to split from synchronous into **form + async resolve-on-completion** — this is the shape of an interactive draft, not an optional choice.

---

## Decision 4 — Resumable draft + idle sweep + per-pick clock

A live draft is **resumable**. The snake draft pauses at the human's turn (CPUs cannot pick ahead of them), so an abandoned draft simply waits at "your pick"; the player can re-open and finish anytime before their pod's open.

A **background sweep** guarantees completion. Extending Slice 1's anchor-morning flip sweep with a `DRAFTING` branch: a pod that has gone **idle** past a threshold has its remaining picks autopicked (reusing the CPU/best-available logic — the top archetype-highlight is the natural autopick), is resolved to `AWAITING_OPEN`, and flips on schedule, guaranteed before the anchor-day close so day 1 banks on time. A **last-activity timestamp** on the group (updated each pick) distinguishes idle from active, so the sweep never interrupts a draft in progress. All abandonments — zero-pick or partial — are **auto-completed and run**; cleanup of zero-engagement pods is a ranked-tournament concern, not a no-stakes training one.

A **per-pick countdown with autopick-on-timeout** (mirroring the legacy `autopickCountdown`) keeps the draft feeling live rather than a turn-based wait. The pace (urgent vs. generous) is a build-time tuning dial, not a structural decision.

---

## What this supersedes / leaves intact

- **Supersedes:** V1.1's scout-seeded suggested board → universal board + archetype-fit overlay; scout deferred post-launch.
- **Intact:** V1.1's interactive-draft intent (now specified, not contradicted), the five-day format, the composite scorer, the off-ladder property, the 1-human + 3-CPU pod shape, and the Slice 1 lifecycle (`AWAITING_OPEN`, the parameterized resolve) which Slice 2 builds on rather than changes — the one sanctioned Slice-1 edit being the formation-seam swap.
