# Archetype Mastery — Spec V2 (LOCKED)

**Date:** July 21, 2026
**Status:** DESIGN-LOCKED on founder ratification (§13). **This document supersedes and fully replaces** `ARCHETYPE_MASTERY_SPEC_V1.md` and amendment deltas V1.1–V1.3. If any superseded document conflicts with this one, this one wins.
**Provenance:** V1 design + four adversarial review rounds (ChatGPT; 27→12→10→6 findings, ~45 confirmed defects resolved pre-code). Residual assurance is explicitly assigned to three downstream nets: CC Phase 0 STOP conditions (§11), Phase 1 property/emulator tests (§12), pre-merge adversarial diff review.
**Governing docs:** `AGENT_LEARNING_CHARTER_V1.md` (two-track ruling §6); `ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md` (verdicts cited as A1–E6).

---

## 1. What this is

Per-user, per-archetype progression making BaggerBomb the platform's training ground:
- **XP track** — deterministic, settlement-time, always progresses. Absorbs all engagement pressure.
- **Levels** — gate customization *capacity* (lean slots, dial positions, Forge rule capacity). Never behavior.
- **Training Report** — server-written per-battle projection (XP + level movement; Phase B lesson panel reserved).

## 2. Core rulings (ratified; not open)

1. Mastery attaches to **user × archetype**; attribution via `battle.agentContext.archetype`, frozen at creation (A2).
2. Mastery state lives in a **server-only collection** (career-rank pattern; user-doc XP is forgeable — B4/n17).
3. XP computes at **`completeBattle`**; no new cron.
4. **Adherence XP is v2** (C4 — pending the enforce-mode persistence grep; if positive, signal accrues from Jul 18, 2026).
5. Archetype mastery **absorbs the agent-level mechanical track**; maturity stages → narrative; Career Rank untouched.
6. Levels gate **capacity, never behavior** (Charter P1).
7. **Training-vs-ranked intent (⚑ ratified at lock):** calendar-day parity with ranked is a **non-goal**. Defended invariants: (i) per-slot training award < per-slot ranked award; (ii) daily totals hard-bounded by slot bands; (iii) for a user with ranked access, CPU play is never the XP-optimal slot use. Training out-earning ranked in a week where ranked access is scarce is the training ground working.

## 3. The slot system (derived, never allocated)

A battle's daily-rate band is a **pure function of immutable creation data**:

```
slotDate = America/New_York date of battle.createdAt
slotRank = 1 + |{ same-user, same-archetype battles b on slotDate :
                  (b.createdAt, b.battleId) < (this.createdAt, this.battleId) }|
rateBand = rank 1–3 → 1.0 · 4–6 → 0.5 · 7+ → 0
```

- **No allocator exists** — no counter, no assignment transaction. Ranks are append-only stable in the normal case; award totals cannot depend on commit order (verified by the §12 property test permuting settlement AND evaluation order).
- **Authority inversion:** the first verified slot stamp `masterySlot: {date, rank, rateBand, assignedAt}` (written at first evaluation tick, write-once guarded) is **authoritative once written**. Recomputation is diagnostic only. The same-millisecond insertion edge (equal `createdAt`, smaller `battleId` arriving late) therefore cannot retro-shift a stamped battle; a detected duplicate-rank pair is an audit event routed to the corrections ledger. Phase 0 checks whether a server-monotone creation key exists to eliminate the edge at the source.
- **Pre-tick terminal battles** derive their slot lazily at settlement (then stamp — same authority rule).
- **No refunds, ever.** No-contests spend their slot; genuine systemic faults route through corrections (§8). Refund mechanics were struck in review as an unfixable timing dependency.
- **Retention is a permanent schema invariant:** `agentBattles` documents are never deleted and never carry TTL. Archived, not removed. Any deletion path found in Phase 0 is a STOP.
- **Slot-key fields are server-authored and immutable** — `createdAt`, `battleId`, ownership, `agentContext.archetype` — with field-level client-write denial verified by emulator tests (**lock criterion**, not a nicety).
- **Cross-boundary rule (stated plainly):** rank is a *creation-time* fact; eligibility (§5) is a *settlement-time* fact. All four combinations are defined: created-during-disabled/settled-enabled → pays (rank from its creation day, eligibility from its settlement); created-enabled/settled-disabled → stamped ineligible, unpaid absent a correction. Disabled windows do not inherently forfeit later payment; they forfeit nothing but time.

## 4. XP formula

```
xpBase  = PARTICIPATION            // flat, any settled eligible battle
        + PERFORMANCE              // clamp(f(agentLegScore), 0, CAP); floors at 0; never negative
        + PLACEMENT                // f(count of human opponents with strictly lower final score);
                                   //   0 humans outplaced → flat CPU_PLACEMENT (< 1v1 human win)
        + COMPLETION               // multi-day battle fully completed
xpFinal = round(xpBase × MODE_MULT × rateBand)      // MODE_MULT: ranked/league 1.0, training 0.6
```

- **Constants are calibrated in Phase 0** against the acceptance matrix — accepted only if ALL hold: (a) ranked median ≈ 100; (b) max training award < median ranked award; (c) max XP/day/archetype documented + founder-approved; (d) idle-pattern battle < 40% of ranked median at full rate; (e) CPU-pod first place < 1v1 human win; (f) median and max XP per elapsed day and per occupied slot, by mode and pod composition, reported for founder review (observability per ruling 2.7, not a training≤ranked gate). Calibration uses post-Jul-18 battles where sample allows; pre/post-Jul-18 cohort distributions compared — if materially different, the historical performance mapping is versioned or the cap certified sufficient.
- **Competition shape freezes at creation** (`fieldSize`, human/CPU census). Ties pay strictly-outplaced only — an engineered N-way tie pays zero placement to all N. Departed/DQ seats reduce the human census.
- **Eligibility matrix** (component × terminal state; statuses enumerated in Phase 0): completed → all components; abandoned/forfeit → no COMPLETION, others per matrix; no-contest → zero-value receipt; every terminal state gets an explicit row in the Phase-0-completed matrix.
- **Fail-closed inputs:** unknown/missing mode, alien archetype, non-finite score, ambiguous shape → terminal zero receipt `reason: 'quarantined'` + server-only quarantine-ledger entry. Never defaults to 1.0 mode.
- **Terminal zero receipts** (`daily_ceiling`, `quarantined`, `flag_disabled`, …) are real `masteryAward` docs with `xpFinal: 0` and a **public `reasonCode` enum only** — diagnostics live in the server-only ledger; the Film Room never renders internals.
- Day boundary: **America/New_York**, server-computed, immutable.
- Collusion/feeder controls: deferred at beta scale; the award audit trail is the monitoring surface; repeat-matchup dampening on the scale backlog.

## 5. Settlement protocol

1. **Completion + eligibility, one transaction:** the transaction that first commits `status: completed` also writes `masteryEligibility: { eligible: <worker's own flag view>, epochId }`, write-once guarded. Atomic with the transition — a battle can never exist completed-but-unstamped, and racing workers cannot split-brain the stamp. (Before first enablement — epoch registry empty — settlement writes nothing mastery-related; dark byte-identity holds.)
2. **Award, one transaction:** `masteryAward` (write-once, guarded on absence) + `masteryProfiles` increment, together. Award only if stamped eligible.
3. **Repair sweep** (existing cron cadence): battles stamped `eligible: true` with `masteryAward === undefined` → award late. The sweep reads stamps ONLY — never flags, never timestamp-interval inference. Converts any crash between completion and award into bounded delay, never loss.
4. **Epoch registry** (append-only config doc; each `MASTERY_XP_ENABLED` flip appends `{state, at}`): audit trail, `cutoverT` identity (epoch 1 start), epochId vocabulary. **Not** an eligibility oracle.

`masteryAward` shape: `{ archetype, components: {participation, performance, placement, completion}, multipliers: {mode, rateBand}, xpFinal, levelBefore, levelAfter, levelProvisional?, formulaVersion, epochId, reasonCode?, settledAt, backfilled? }`. Field-level client-write denial + emulator tests (create/update/delete/overwrite) are Phase 1 acceptance criteria. No aggregate `formulaVersion` on the profile — per-award versions are the source of truth.

## 6. Profiles, levels, unlocks

**`masteryProfiles/{userId}`** (server-only writes; owner read): per-archetype `{xp, level, battlesCounted, lastAwardAt}`, `backfillApplied[backfillId][archetypeId]` markers, `revalidationRequired`, `updatedAt`. No daily counter exists (slots are derived).

**Curve** ⚑D1: 10 levels; cumulative 200/500/900/1400/2000/2700/3500/4400/5400; bands **Novice 1–3 / Adept 4–7 / Master 8–10** ⚑D5.

**Unlock table** (every level carries at least one real unlock; reserved items are roadmap milestones, never entitlements — UI copy says so; the Training Report's next-unlock teaser names only shipped or cosmetic unlocks):

| L | Unlock | Enforcement |
|---|---|---|
| 1 | 2 lean slots · dial {conservative, moderate} · Forge band 1 (10) | `STANDING_LEANS_CAP` becomes level-derived |
| 2 | Dial **aggressive** + crest | `set-tempo-dial` validation + tick-time clamp. Positions are lateral style, not power; equipped state grandfathers; leaving aggressive at L1 is one-way until L2 (documented) |
| 3 | **+1 lean slot** (3) | `equip-lean.js` chokepoint AND battle-snapshot revalidation kernel — both (D1) |
| 4 | Forge band 2 (15) + crest | §6.1 |
| 5 | Adept crest · Trial slot 1 (reserved — Trial Curriculum V1) | Honest "Coming soon" |
| 6 | **+1 lean slot** (4) | Dual anchors as L3 |
| 7 | Forge band 3 (20) + crest | §6.1 |
| 8 | Crest · Trial slot 2 (reserved) | — |
| 9 | Crest · reserved (Phase B lesson-compile capacity) | — |
| 10 | Mastery crest · reserved (strategy composition) | — |

**§6.1 Forge capacity** ⚑D4: keyed to **highest archetype level** — the single, deliberate account-scoped absorption (Forge bundles are account-scoped assets; per-archetype capacity on account assets is incoherent). **Legacy floor is LAZY:** `effectiveCap = max(masteryCap, liveLegacyEntitlement(user))` computed at enforcement time until `agentProgression.js` retirement, whose ceremony computes final floors (max across all agent records), writes them, passes a coverage audit (zero users with saved bundles exceeding their effective cap), then retires the module. No snapshot, no snapshot race. **Server-side enforcement rider:** the currently client-only `FORGE_LIMITS` (P2 #7) gains server enforcement at the bundle-save path in Phase 2 — a standalone security hardening exempt from flags-off byte-identity, with the PR footnote (patch flag-#4 precedent). Byte-identity acceptance is thereby narrowed to *valid-client behavior*.

**Cross-archetype semantics:** bundles are per-archetype (Phase 0 confirms keying; shared state = STOP). Each archetype's bundle validates against that archetype's level. **Downgrade rule:** levels never decrease and unlocks never revoke — **except via corrections (§8)**, the system's only downward path.

**Migration:** Forge capacity re-points per §6.1; chat-budget unification explicitly out of scope (pre-existing P2 #6, separate task); maturity stages and Career Rank untouched; `agentProgression.js` retired only at its ceremony.

## 7. Flags

`MASTERY_XP_ENABLED` (writer + stamps post-epoch-1) · `MASTERY_ENFORCEMENT_ENABLED` (server cap checks) · `MASTERY_SURFACE_ENABLED` (UI). Operative rules: SURFACE never alters entitlements; ENFORCEMENT reads profiles + floors regardless of XP state; missing profile ⇒ baseline entitlements + empty state.

| XP | ENF | SURF | Behavior |
|---|---|---|---|
| 0·0·0 | | | Today; byte-identical for valid clients (§6.1 rider stands alone) |
| 1·0·0 | | | Awards accrue dark; baseline caps; no UI — **launch/backfill state** |
| 1·1·0 | | | Awards + mastery caps + floors; no UI — **transitional only**, flip SURFACE promptly |
| 1·1·1 | | | Full launch |
| 0·1·0 | | | Writer rolled back; entitlements frozen at last profile + floors — valid incident posture |
| 0·1·1 | | | As above with UI showing frozen state |
| 0·0·1 | | | Display-only; no enforcement; "progression paused" banner |
| 1·0·1 | | | Legal but avoid outside brief windows — display may show unenforced locks |

Flip order: **XP → backfill → ENFORCEMENT (with floor audit) → SURFACE.**

## 8. Corrections (`masteryCorrections/{id}`)

Founder-authorized, append-only: `{userId, archetype, delta, reason, authorizedBy, refs[]}`. Application is **one transaction**: profile mutation + `appliedAt` marker, guarded on marker absence — retries inert. Finite deltas only; effective XP floors at 0; level recomputed. Entitlement-reducing corrections set `revalidationRequired`; the **existing battle-snapshot revalidation kernel** clamps over-cap equipped state with user notice at next deployment/battle start — never mid-battle, never waiting on a user action. Awards are never mutated; corrections are the sole downward path (fraud, defective deploys, duplicate-rank audits, systemic-fault compensation).

## 9. Backfill ⚑D3 (ratified at lock)

Race-free cutover: (1) flip `MASTERY_XP_ENABLED` — live writer owns `completedAt > cutoverT`; (2) backfill owns `≤ cutoverT` only; (3) repair sweep reconciles the seam; (4) surface stays dark throughout. Execution: **pure offline replay** — reconstruct historical slots deterministically (creation-data function; identical to live derivation), compute awards + `levelBefore/After` within the isolated replay, stamp per-battle receipts (create-only, `backfilled: true`), then **one aggregate merge per user×archetype stream**, each transactional and guarded on its own `backfillApplied[backfillId][archetypeId]` marker — crash-retry inert, streams independent. Backfill touches no live state besides these guarded merges (no live counter exists to race). Fail-closed validation + quarantine ledger; dry-run → founder reviews award distribution AND quarantine counts → live run. Seam-window live receipts carry `levelProvisional: true`; the Training Report suppresses their level ceremony permanently (receipts honestly record interim state; we don't rewrite history).

## 10. Training Report

Film Room per-battle (E6), reading `masteryAward` + owner-read profile only. XP breakdown, level progress, band-promotion ceremony (suppressed for provisional), next-unlock teaser (shipped/cosmetic only), reserved Lessons panel with honest empty state. Cumulative per-archetype cards on the Evolution/RecordSheet host in Phase 3.

## 11. CC Phase 0 (read-only, hard STOP; ⚠ = STOP condition if violated)

1. `completeBattle` anchor + the completion transaction's extendability for the eligibility stamp (⚠ if completion is not transactional or sits in a fence file — enforcement design changes, not the fence).
2. Battle-doc cardinality: per-agent, not shared multi-human (⚠ if shared — award keying redesign).
3. Bundle keying per-archetype (⚠ if shared).
4. Retention: no deletion/TTL path on `agentBattles` (⚠ if one exists).
5. Server-monotone creation key existence (kills the same-millisecond rank edge if available).
6. Rank-query supportability (index on user/agent + archetype + createdAt).
7. Slot-key field authorship + Firestore rules posture; battle-doc client-write posture for `masteryAward`/`masteryEligibility`/`masterySlot`.
8. Terminal-status enumeration → complete the §4 eligibility matrix.
9. Score-distribution percentiles + pre/post-Jul-18 cohorts → propose constants against the full §4 acceptance matrix.
10. `agentProgression` consumer enumeration; equip-path + revalidation-kernel insertion points; epoch-registry storage home; deployment concurrency limits (absence = standalone platform finding).
11. Fence check on every write target (⚠ zero fence files, as always).

## 12. Build phases & acceptance

**P1 dark core:** profiles + rules; slot module (pure, derived, stamp-as-authority); completion-transaction eligibility stamp; award transaction; repair sweep; formula module against calibration fixtures. **Acceptance:** order-independence property test (permute settlement AND evaluation order ⇒ identical totals); emulator denial tests (all mastery fields, all verbs); write-once guards under concurrent-retry tests; flags-off byte-identity (valid-client scope).
**P2 enforcement:** dual-anchor lean caps; dial gate; Forge re-point + server rider + lazy floor. **P3 surface.** **P4 cutover** per §9 order, dry-run gated.
Standard gates: fence gate, `/code-review` high, **pre-merge adversarial diff review (ChatGPT) — the relocated final review, aimed at §3/§5 transaction code specifically**, founder merges.

## 13. Founder sign-off (lock ratifies)

☐ D1 curve (10 levels, §6 numbers, constants tunable at Phase 0) ☐ D2 (0.6× training; 3/3/0 bands) ☐ D3 backfill (§9) ☐ D4 Forge keying (§6.1) ☐ D5 bands ☐ Ruling 2.7 training-intent statement ☐ Exit-condition waiver (round-4 blockers closed in-document; final adversarial pass relocated to the pre-merge diff)

---
*Signed: ____ (Flash) — date ____. Post-lock changes require V2.1 versioning; §2 rulings and §3 invariants are amendable only with explicit founder re-ratification.*
