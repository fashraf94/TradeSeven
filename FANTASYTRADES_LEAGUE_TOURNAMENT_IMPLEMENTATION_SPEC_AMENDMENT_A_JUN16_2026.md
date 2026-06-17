# League Tournament Implementation Spec — Amendment A
## Training-Mode Introduction Deltas

**Type:** Amendment to a locked record (governance).
**Date:** 2026-06-16 · **Version:** A · **Status:** RECORD (active).
**Amends:** `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_V1.md` §0.7 (`:18`) and §0.8 (`:19`).
**Companion specs:** `FANTASYTRADES_LEAGUE_TRAINING_MODE_SPEC_V1_1.md` (design); League Training Slice 1 build report (2026-06-16).

---

## Purpose

The binding League Tournament Implementation Spec is a **locked record** (`docs/README.md:38`) — it is amended by *addition*, never by editing its text. This amendment records the four deltas introduced by building **League Training mode** as the tournament's proving ground, and the conditions under which those deltas are clean. Nothing in the locked spec is changed; the points below supersede only what is named.

The spec text stands unedited. Where this amendment and the spec differ on a named point, this amendment governs from its date forward.

---

## Governing principle (the frame all four deltas sit inside)

Building the Training-mode lifecycle **pre-launch and dark** is *build ahead, not ship early.* It is the same pattern the entire League Next Arc has run on: code lands behind `LEAGUE_NEXT_ARC_ENABLED` and a route-level dev gate, with no user-reachable behavior, until a deliberate activation decision is made. Two conditions keep the reorder clean, and both must hold:

1. **Training stays dark.** No user-facing entry to Training mode ships until a separate, deliberate activation decision. The build flag and the formation route's `?nextArc=1` dev gate are the dark seam. (`LEAGUE_NEXT_ARC_ENABLED` being `true` is its established Phases-1–3 state and does not by itself make Training reachable.)
2. **The deltas are on the record.** This document is that record.

If either condition lapses — if Training becomes user-reachable before a deliberate launch decision, or the deltas drift undocumented — the reorder is no longer clean and must be re-ratified.

---

## The four deltas

### Delta 1 — Training built pre-launch and dark (sequencing reorder of §0.7)

**Spec (§0.7):** defers Training mode to a post-launch program.

**This amendment:** the Training-mode *lifecycle plumbing* is built pre-launch, dark, as the proving ground for the tournament's parallel-layer week — validating structure and flow on a single week before that structure is extended to the four-week tournament.

**Classification:** deliberate founder reorder of *sequencing*, **not** an early ship. Training is not exposed to users; it is built ahead behind the flag and route gate. The post-launch *activation* of Training to users remains consistent with §0.7's intent.

**Rationale:** proving the one-week structure first turns the four-week tournament into an extension rather than a leap. The plumbing touches no fenced files, no shared-host behavior, and adds zero cron entries, so it does not disturb the pre-launch critical path.

---

### Delta 2 — On-demand / rolling cadence (delta; §0.7 is silent)

**Spec (§0.7):** format-level — five trading days. Silent on Monday-anchored vs. rolling cadence.

**This amendment:** Training pods form **on demand** and run a **rolling five-day clock anchored to the next market open**, not a Monday-anchored week.

**Classification:** **delta, not contradiction** — the spec does not specify cadence, so on-demand/rolling fills silence rather than overriding text. The five-day format is unchanged.

**Rationale:** the tournament's own day-clock is already relative (banking-derived, no fixed start date), so a rolling start reuses existing machinery rather than introducing a parallel timing model.

---

### Delta 3 — Entry via the League hero, not the Command Center (placement delta)

**Spec (§0.7):** envisions Training entry via the Command Center.

**This amendment:** Training entry lives in the **League hero / Training tab** (built in Slice 5), the home of the redesigned League surface.

**Classification:** placement delta. No change to who can enter or when; only where the entry surface sits.

---

### Delta 4 — One-battle-per-agent coexistence: deferred to Slice 3 (§0.7 / §0.8)

**Spec (§0.7 / §0.8):** raise the one-battle-per-agent question — a player's agent is committed to a single battle, so a concurrent Training pod needs a "separate training-agent context."

**This amendment — direction recorded, implementation deferred:** the one-battle limit is scoped **per battle type**, not globally. A player's agent may hold, concurrently, **one regular BaggerBomb game, one Training pod, and one tournament bracket entry** — one of each type. This is the "separate training-agent context" the spec anticipates.

**Deferral:** the *implementation* of per-type scoping is deferred to the **Slice 3 plan** (the agent layer). Slice 1 contains no agent layer and is therefore clear of this gate; Slice 2 (interactive draft) is likewise clear. The fence and this coexistence answer both land at Slice 3.

**Directions recorded for Slice 3** (so the slice inherits settled answers, not open questions):
- **Per-type battle slots** — one agent battle per type, concurrent. Open sub-point to pin at Slice 3: where the always-on base layer sits in the type enumeration (its own type, or folded under the tournament).
- **Per-game (changeable) loadouts** — the loadout is *not* locked-shared across the three types. Training must be a loadout testbed: a player can run a different archetype / traits / watchlist in Training than in a ranked tournament without disturbing the live tournament agent. To be designed against the live equip / snapshot-at-start / nightly-edit model via a focused read-only discovery before Slice 3 is built, since the existing per-battle snapshot mechanic may already support most of this.

---

## What this amendment does NOT change

- The locked spec text (untouched).
- The five-trading-day format.
- The League composite scorer as the canonical Training scorer (no Snake Draft scorer copy on the tournament path).
- Training's off-ladder property (no leaderboard, rank, or bracket effect).
- The autopilot agent identity (scout-vs-autopilot retired; both autopilot), consistent with §0.7 and V1.1 §0.
- Everything else in §0.7 / §0.8 not named in the four deltas above.

---

## docs/README.md registry row

Add to the records table (match your existing column order; suggested values):

| Document | Date | Status | Scope |
|---|---|---|---|
| `FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_AMENDMENT_A_JUN16_2026.md` | 2026-06-16 | RECORD (active) | Amends Implementation Spec §0.7/§0.8 — Training-mode introduction deltas: pre-launch/dark build, on-demand/rolling cadence, League-hero entry, one-battle-per-agent deferred to Slice 3 |

> If it's easier to keep the table formatting exact, hand Claude Code this row and let it insert it in the README's existing column structure — it can see the table; this amendment doc itself stays a founder upload.
