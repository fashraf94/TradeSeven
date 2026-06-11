# FantasyTrades — Pre-Launch Sequence: Amendment A

**Date:** June 10, 2026
**Amends:** `FANTASYTRADES_PRELAUNCH_SEQUENCE.md` (May 12, 2026)
**Status:** Locked. First formal amendment to the sequence contract.
**Companions:**
- `VISION_PROGRAM_POST_LAUNCH_PLACEMENT.md` (June 4, 2026) + **Addendum A** (June 10, 2026 — written alongside this amendment; holds the signal-family catalog and the Vision↔draft-board hypothesis)
- `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md` (June 10, 2026 — design-complete)

---

## Why an amendment is legitimate

The sequence contract's own rule: don't reopen the order **unless real new context emerges.** Three pieces of real new context have:

1. **The June 4 ground-truth audit** confirmed launch is autopilot-only (co-pilot/manual/veto machinery built but dormant) and that Dossier Sprint 2's three input infrastructures are absent under that launch shape. Item 5 was already blocked-as-designed.
2. **The June 8–10 League Tournament design arc** completed end to end (V2.1, audit-grounded @ `e3b4011`). The flagship game now defines a concrete user↔agent relationship — parallel-layer battles, draft boards, claims, flips, the USER PICKS block — that supersedes the interaction model Sprint 2's inputs were designed for.
3. **Two founder decisions (June 10):** user directional-clarity grading is killed (league rank is the only user measure); the Vision program's candidate production home is the tournament draft board + flip stream (recorded in the placement Addendum A).

This is exactly the kind of context the escape hatch was written for. Everything else about the contract's discipline — one item at a time, no replanning mid-phase, the current item is the next item — carries unchanged.

---

## Amendment 1 — Item 5 (Dossier Sprint 2) is struck from the pre-launch sequence

**Re-homed as the post-launch Conversational-Signal Pipeline V2 arc**, paired with the Vision program per the placement doc and its Addendum A.

Item 5 is triply superseded:

- **Blocked as designed.** Its primary inputs do not exist under the autopilot-only launch: veto capture is built but dormant behind launch guards, `partnerObservations[]` does not exist, the handoff artifact was never implemented. Building the writers now means writers consuming null inputs — the failure mode the Sprint 2 spec itself warned against.
- **Input model superseded.** The veto/co-pilot/daily-handoff signal sources belong to a trading-authority relationship the product has moved away from twice (autopilot-only launch; scout-and-parallel-layers tournament). The tournament hands the writers richer replacements — draft-board deltas, flips, claims, USER PICKS reactions, debates — cataloged in placement Addendum A §3–4. Designing the writers before those surfaces ship a single production event would repeat the Forge mistake.
- **Companion deliverable killed.** User directional-clarity grading (old Voice Layer rework Phase 6) is dead per Amendment 2. The Sprint 2 → grading dependency chain no longer points anywhere pre-launch.

**What survives, untouched, for the post-launch arc:** the funnel principle, the Sonnet writer pattern (Sprint 1's consolidation writer as template), the 5-cycle consolidation gate, the `partnerProfile` 15-dimension schema, the `convictions[]` schema, and the per-dimension confidence model. Only the front of the funnel moves. No relitigation of those when the arc runs.

---

## Amendment 2 — User directional-clarity grading is removed from the plan of record

**Decision (Flash, June 10, 2026):** no grading system. The league's career rank (RP, tiers, tier-floor ratchet — Tournament framework §7, carried into V2.1 §9) plus the seasonal leaderboard are the user-facing measures of performance.

Wherever grading appears in prior docs, it is dead: Voice Layer rework roadmap Phase 6, V1.1 product stance Section 6 (principles stay as historical record; the design-specifics session never happens), Sprint 2 Tiers roadmap's "Tier 1 — User grading" track.

**What survives:** the Film Room (shipped, Voice Layer Phase 4) remains the *qualitative* companion to rank — the conversation about why the week went the way it did. No scoring layer is added to it.

---

## Amendment 3 — The revised sequence of record

1. **Finish the current pre-launch tail.** Items 6–7 as in flight: Command Dashboard shipped and flag-on; Archetype Identity Contract V1 locked; onboarding build in progress. Close these loops first.
2. **Standing blockers — clear before the tournament build starts:**
   - **DST claim-execution defect** (V2.1 §10) — jumps the queue as a standalone blocker; the *shipping* snake draft game is affected today (claims cron pinned UTC fires ~10:25 AM ET in daylight time against a window that closed at 9:24 AM ET).
   - **DRB shadow logger GCS write failure** — silent training-data loss daily since ~April 30; must fix before launch.
   - *(Tracked, not a hard gate:)* Firestore index drift cleanup workstream — Console workaround stands; CLI deploy remains blocked until the workstream runs.
3. **League Tournament build** (V2.1 — design-complete; implementation-chat discovery per its own §12, hard STOP, phased). Two sequencing notes inside this item:
   - The **§7 engine parameterization is a deliberate, founder-gated fence entry** with the byte-identical-tiered invariant and fresh flat6 calibration as its re-validation contract. Schedule it when no other stream is competing for founder review attention.
   - The **Signal Capture Rider (Amendment 4)** is binding on the spec pass and implementation.
4. **Launch.**
5. **Post-launch arcs** (ordering deliberately loose, one recommendation recorded): **Research Companion** can run first *while tournament signal accumulates* — the Conversational-Signal Pipeline V2 arc benefits from an observation period of real tournament corpus before its design pass, which the Research Companion's build time provides for free. Item 8 (Forge component refinement) remains post-launch iterative polish as before.

Items 1–4 of the original sequence remain recorded as complete. The discipline rules are unchanged.

---

## Amendment 4 — Signal Capture Rider (binding on the tournament build)

**Principle:** every new tournament surface writes its events in a writer-readable shape from day one — the same "carries `direction` from day one" pattern V2.1 §3 applies to schemas, applied to signal. This costs logging, not writers. **No dossier writer ships pre-launch.** The point is that the post-launch arc inherits weeks of corpus instead of a cold start.

The full event catalog (what to capture, in what shape, written where) lives in **`VISION_PROGRAM_POST_LAUNCH_PLACEMENT` Addendum A §4** — single source of truth, so the tournament spec pass and the future arc read the same list. The spec pass must walk that catalog and confirm each event's write path; the implementation discovery must verify none of the writes block or destabilize the action that produces them (Sprint 1 lesson: fire-and-forget on serverless is a footgun — use awaited writes in-request, or the queue-flag pattern where the write must survive the lambda).

---

## How to use this document

Same as the parent contract. When planning paralysis returns, the answer is the current item of Amendment 3's sequence. The next item is automatic. The only deliberate pauses built in are the ones the tournament doc itself defines: discovery STOPs and the §7 fence-entry gate.

---

*Amendment A prepared June 10, 2026, from the June 4 ground-truth audit, the June 8–10 tournament design arc, and the June 10 founder decisions on grading and Vision placement.*
