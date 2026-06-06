# Trait Foundation Revamp — Design Specification (V2.2)

**Date:** June 6, 2026
**Status:** Build-ready. Foundation locked, Phase 0 audit folded in, final review fixes incorporated. Cleared to plan and build Phase 1.
**Supersedes:** `TRAIT_FOUNDATION_REVAMP_DESIGN_SPEC_V2_1.md`.
**Provenance:** Design conversation + three external critique rounds (incl. a final go/no-go review) + Phase 0 read-only audit (branch `claude/optimistic-mayer-eQ6xy`, HEAD `12c322f`). Mechanical claims are backed by `file:line` evidence from the audit.
**Lens:** Users 1+2 (casual player + practical partner-seeker). Excellent defaults beat deep authoring.

---

## 1. The decision, in one paragraph

A trait is a **disposition** — a steady behavioral lean — surfaced as a friendly **card**, powered by a fixed set of internal behavioral axes (**six at launch**). The customization surface is **three sibling loadout families**: **Archetype** (locked core philosophy + the hard safety floors), **Temperament Traits** (how the agent behaves), and **Play Cards** (what it hunts — selection biases). Both card families are *bounded tilts on the archetype baseline*: temperament cards tilt behavior, play cards tilt selection, neither can reverse the archetype's identity. Dials move the AI's **advice** (the numbers/language Haiku reads), never the deterministic safety brakes, which stay archetype-locked. The pipeline feeds the existing decision path through the existing bounded seam with **no calibration-fence edit** — confirmed against live code. It ships in phases, clarity win first.

---

## 2. What changed from V2.1 (final-review fixes)

1. **Play Card ↔ Archetype compatibility contract** added (§4.7), scoped: compatibility *data* + seeding/warning policy ship in Phase 1; mechanical precedence enforcement is Phase 2.
2. **strategyPreset coexistence resolved for Phase 1** (§4.8): it sits beside the cards, unchanged, with no copy collision; integration deferred to Phase 2.
3. **The teeth gate is re-sequenced** (§4.5, §14): a pre-beta offline divergence harness tests whether a dial is behaviorally *real*; beta tests only whether it's *felt/trusted*.
4. **Post-battle attribution tags** are pulled into Phase 1's value (§9): observed behaviors are tagged back to the cards that shaped them. This is the one piece of Phase 1 that is a small build, not pure re-labeling.
5. **Phase 1 success is defined as comprehension/correctness, not behavior** (§11), with an explicit acceptance gate.
6. **Phase 1 ships with an executable acceptance-test suite** (§10), not just a hazard list.
7. **Iron Discipline stays one user-facing card** though it decomposes across two axes (§4.2); the multi-axis mapping is a Phase 2 substrate detail.

---

## 3. The problem (recap)

The old model overloaded one word: dispositions ("who the agent is") and selection leans ("what it hunts") were both "traits," and disposition was expressed twice — as archetypes and as trait rule-bundles — so "Trend Rider" duplicated "Trend Follower." Authoring a trait meant assembling a rule bundle, and users could never tell whether they were shaping who the agent *is* or what's in its *toolkit*. (Full diagnosis: V1 §2.)

---

## 4. The target model

### 4.1 Three sibling loadout families

| Family | Question it answers | Nature | Editable? |
|---|---|---|---|
| **Archetype** | What does it select / believe, and what are its hard limits? | Locked selection philosophy + deterministic safety floors (the baseline) | Chosen at birth, locked |
| **Temperament Traits** | How does it behave? | Steady behavior tilts (six axes), advisory | Yes — via cards |
| **Play Cards** | What signals does it hunt? | Selection tilts (former Instincts) | Yes — equip/swap; archetype pre-equips matches |

Both card families are bounded tilts on the archetype baseline; an untouched agent is coherent, balanced, and safe from the archetype alone.

### 4.2 Traits are cards; the substrate is hidden

The public unit is a **trait card** — memorable, nameable, shareable, later earnable. Underneath, a card sets a few of the six axes. Users never author raw dials at launch.

Card schema (target): `name`, `behavior`, `whenItHelps`, `whenItHurts`, `archetypeFit`, `earnedTrigger` (null unless earned), and internal axis fields `primaryAxis`, `secondaryAxes`, `axisDeltaWeights`, `strengthScaling`. A card that touches more than one axis (e.g. Iron Discipline → Loss Tolerance + Action Friction) stays **one** user-facing card with weighted deltas; it is not split into two cards.

### 4.3 The six launch axes

They **partition the decision lifecycle** (selection excluded — archetype-owned; battle-state reaction excluded — parked game-state family). Every "rides on" param was confirmed present and flowing through the seam.

| Axis | Poles | Lifecycle stage | Source trait(s) | Rides on (confirmed) |
|---|---|---|---|---|
| **Entry Trigger** | Wait for proof ↔ Act on first sign | Getting in | Dual Conviction | tv-10 fund/tech score, tv-12 + confirmation count |
| **Action Friction** | Needs clear edge ↔ Trades on thin edge | Act-or-not / swap | Iron Discipline + Active Trader | mb-04 swap-hurdle ATR, mb-07 swap window, mb-03 |
| **Patience** | Restless ↔ Patient | Holding the undecided middle | Patient Holder + Active Trader | mb-01 hold-minutes, mb-03, tv-03 |
| **Profit-Taking** | Bank early ↔ Let it ride | Exiting a winner | Let Winners Run + Threshold Harvester | mb-08 threshold-hold, th-01 |
| **Loss Tolerance** | Cut fast ↔ Give room | Cutting a loser | Iron Discipline + Penalty Dodger | mb-09 eject ATR, ts-07/ts-01 (soft band only) |
| **Exposure Shape** | Stacked conviction ↔ Diversified | Shaping the portfolio | Diversifier + Sector Rotator | a-05 anchors/rockets, a-09, sector + correlation caps |

**Deferred 7th — External Signal Weight** (Price-action purist ↔ Context-sensitive): sound disposition, but no live signal rail today — parked to Phase 3, shipped only once the user-surfaced-signal rail exists.

### 4.4 Archetype as baseline; signature axes; two card-only axes

Archetype and cards share one coordinate system. Signature-axis candidates (the axis each archetype anchors): guardian → **Loss Tolerance**; diversifier → **Exposure Shape**; degen → **Action Friction**; analyst / contrarian → **Entry Trigger**. **Profit-Taking and Patience have no archetype signature** — pure card-driven axes, bounded only by global clamps. Exact per-archetype ranges are deferred until a replay harness exists (§14); identity coherence at launch is held by a signature lock + global clamps + warning copy.

### 4.5 Force model — dials move advice (Option A, locked)

- Dials move the AI's **advice** (the thresholds/language Haiku reads). Mechanically real (they change what the decision system reads) but advisory in force. Not decorative: a decorative trait changes nothing the decision system reads; an advisory dial changes the real numbers Haiku sees.
- **The archetype owns the hard floors.** Frame: *archetype = the hard rules of the road; temperament = the driving style within them.*
- **Tighten-only escape hatch (Phase 3 option).** A specific axis may later touch a deterministic floor, but only via a clamp that *tightens* it (makes the agent safer than the floor), never loosens it. Deliberate, parity-guarded fence change; not default.
- **Re-sequenced teeth gate.** The *real* test (does a dial change behavior at all) moves **pre-beta**, into an offline fixture harness (§14) — you don't wait for beta to discover a dead dial. **Beta** tests only the *felt* dimension (perception and trust). A tighten-only escalation is justified only when a card is behaviorally real and well-framed yet still needs hard teeth.

### 4.6 Safety — confirmed separated (the invariant already holds)

The deterministic floors are real, archetype-locked, and unreachable from any trait param: catastrophic eject `bustBuffer` −0.85× ATR (`agentRiskManager.js:93,101-107`); hurdle floor `hftConfig.hurdleFloor` 0.2–0.6 (`:304-341`); swap circuit-breaker `hftConfig.swapWindow` (`:471`). `hftConfig` is read "regardless of the user-toggleable preset" (`agentArchetypeConfig.js:8-15`); the deterministic cron path reads `getArchetypeConfig` + presets, never `paramValues`. No user dial can weaken a hard floor.

### 4.7 Play Card ↔ Archetype compatibility contract (NEW)

Two layers now bias selection (archetype philosophy + play-card tilt), so precedence must be explicit.

- **Per-card compatibility data** (ships Phase 1): `compatibleArchetypes`, `softConflictArchetypes`, `hardBlockedArchetypes`, `defaultEligibleArchetypes`, `conflictCopy`.
- **Phase 1 policy:** default seeding never seeds a soft- or hard-conflict card; a soft-conflict equip shows `conflictCopy` ("unusual fit for a Contrarian"); a hard-conflict equip is blocked. Mechanics are otherwise unchanged in Phase 1, so a conflicting equip produces today's behavior — this is an identity-legibility guard, not a new mechanic.
- **Phase 2 precedence (mechanical):** the archetype owns baseline candidate scoring; a Play Card tilts **inside the archetype's legal universe** and cannot reverse it — the same bounded-delta pattern as temperament cards. This enforcement is Phase 2, not Phase 1.

### 4.8 strategyPreset coexistence (NEW)

For Phase 1, `strategyPreset` (aggressive/balanced/defensive) **sits beside the cards, unchanged**: it remains the legacy battle stance; Temperament Traits remain card-level behavior leans; no Phase 1 card copy claims to replace or rename a preset. Whether the preset later becomes an axis-preset or stays a separate control is a **Phase 2** decision.

---

## 5. Play Cards (the former Instincts)

All six Instincts become **Play Cards** — a public, equippable family defined as **selection biases** ("what the agent hunts"), with rules as the execution layer underneath, sitting beside (and bounded by) the archetype's baseline philosophy.

- Trend Rider, Bargain Hunter, Squeeze Whisperer, Breakout Chaser, Volume Believer, Smart Money Tracker → Play Cards.
- Archetypes **pre-equip** matching Play Cards; users swap without touching raw rules. Plays are never fused into archetype identity.
- **Sector Rotator** is the one ambiguous card (part selection-method, part allocation/Exposure Shape) — its mapping is an explicit Phase 1 plan decision, not a default; archetype promotion stays deferred until data.
- **Score Adaptor** (gs-05/gs-06, game-state) is confirmed **not** a temperament axis — parked to the Phase 3 Game-State Plays family.

---

## 6. How it fits the loadout

Watchlist + Strategy remain sibling loadout pieces, unchanged; watchlist stays a preference signal, frozen at battle start. Archetype is the default-provider. Temperament Traits + Play Cards are enrichment, not deploy gates. All pieces freeze at battle start. `strategyPreset` coexistence is resolved for Phase 1 in §4.8.

---

## 7. The seam — confirmed cheap / fence-free

```
trait cards → axis deltas → (bounded translation, clamped to KB min/max + signature-locked) → paramValues
           → projectActiveRules → prompt → Haiku → trades
```
The four fence files only carry and interpolate `paramValues` (`projectActiveRules.js:46`, `agentPromptAssembly.js:281`); the clamp envelope already exists on every KB param. Precedents: strength→paramOverrides, Vision soft-preference→constraint. **Phase 2 (build the substrate) is viable without a fence edit.**

---

## 8. Card copy is a correctness task

Current copy over-claims hard mechanics ("Catastrophic Loss Eject — overrides all holding rules") while the rules are soft advice. Copy must honestly describe advisory leans ("strongly favors cutting losers fast"), with the archetype framed as owner of the hard limits. Establish one advisory-language standard for all cards. Public, plain-English card names (the internal axis names are jargon) remain a downstream task.

---

## 9. Phased scope

**Phase 0 — Discovery audit. COMPLETE.**

**Phase 1 — Clarity MVP (fence-free, ships first).**
- Re-family the 16 into Temperament Traits / Play Cards / archetype-aligned / parked; honest, friendly copy; Trend Rider & Bargain Hunter marked archetype-aligned (not deleted).
- Keep current equip behavior and current param mechanics; dials are internal metadata only; no raw dials, no bounds, no archetype changes.
- Ship the §4.7 compatibility data + seeding/warning policy and the §4.8 strategyPreset rule.
- **Post-battle attribution tags** — observed behaviors tagged back to the card that shaped them ("This reflected your Iron Discipline temperament" / "This came from your Volume Believer play card"), riding the existing post-battle reflection path. The one small build in Phase 1; it makes the clarity release legible and felt.
- Comprehension + engagement telemetry. Respects §10 guardrails and tests.

**Phase 2 — Internal substrate (greenlit on the audit).** Build the six-axis dial vector + bounded translation + clamps; cards → axis deltas; the §4.7 mechanical precedence; the pre-beta divergence harness as the ship gate. No raw dials exposed.

**Phase 3 — Behavior Lab (post-launch).** External Signal Weight + the signal rail; raw dials; per-archetype bounds tuned against a replay harness; earned trait cards; the Game-State Plays family; replay previews + shareable loadout codes; any tighten-only teeth escalations the gates justify.

---

## 10. Phase 1 build guardrails + acceptance tests

Must NOT break: `traitId` join keys (across equipped traits, rule docs, defaults, combos, orphan-cleanup); `ruleId`/`sourceRef`↔KB-template linkage; the ≤2-per-DNA-group slot caps (each archetype seeds **3** defaults against a **2-per-group** cap — works only if defaults stay spread ≤2/group); the `{traitId, strength, isCustom, equippedAt}` entry shape; combo pairs keyed on `traitId`. Free to change: display name, identity statement, icon, tags, group labels/grouping (within slot math), card copy.

**Acceptance tests (definition of done):**
1. Every legacy `traitId` remains stable.
2. Every equipped trait still resolves to its rule docs.
3. Every Play Card resolves to valid KB templates.
4. Every archetype still seeds exactly 3 defaults.
5. No seeded default set violates the 2-per-group cap.
6. Existing equipped traits render after the re-family (migration).
7. Combo pairs still resolve by `traitId`.
8. Shared rule IDs (`th-01`, `mb-08`) collision behavior is explicit — a resolver, or co-equip prevention, or a display of which card controls the shared rule (not just "Last Equipped Wins").
9. Re-equip and strength changes still work.
10. Unknown/missing family metadata fails closed (no silent mis-grouping).

---

## 11. Phase 1 success criteria (comprehension, not behavior)

Phase 1 is a clarity and correctness release, not a behavior release — and is framed as such. Acceptance gate:
- ≥4 of 5 non-technical testers explain Archetype vs. Temperament Trait vs. Play Card after one onboarding pass.
- Testers correctly predict which family affects "how it behaves" vs. "what it hunts."
- Testers do **not** believe Iron Discipline creates a hard eject (the honest-copy check).
- Testers understand Play Cards as swappable signal preferences.

---

## 12. Migration posture

Decide-the-target-then-migrate, never rip-out-now. 8 dispositional traits → Temperament Trait cards; Trend Rider & Bargain Hunter → "archetype-aligned," retire only if post-launch data shows confusion; 6 Instincts → Play Cards; Score Adaptor → parked. Already-equipped legacy cards must keep working through the re-family (acceptance test #6). The live equip path stays functional throughout.

---

## 13. Open decisions (for the Phase 1 plan)

Implementation-level, to settle when writing the build plan: full 16-card mapping incl. the Sector Rotator call; Phase 1 family enum names; whether Play Cards and Temperament Traits share equip slots; default seed list per archetype after regrouping; the shared-ruleId resolver; whether `archetypeFit` and internal `axisDeltas` surface in Phase 1; the advisory-copy standard; telemetry event names + thresholds. Product-level, still open: public card names; transaction-cost model (folds into Action Friction if costs exist).

---

## 14. Tracked gates

- **Comprehension gate (Phase 1):** §11 must pass before Phase 1 is "done."
- **No public sliders** until ≥4/5 testers explain the three families.
- **Pre-beta divergence harness (before any Phase 2 card ships):** per axis — same battle state / archetype / watchlist, trait off vs. on — confirm the prompt payload changes, the threshold language changes, at least one borderline fixture produces a different recommendation/rationale, and the deterministic floors still override. No Phase 2 card ships unless it changes the prompt AND flips a borderline fixture.
- **Beta gate:** tests felt/trust/comprehension only (the real-divergence question is answered pre-beta by the harness).
- **No per-archetype bounds table** until a replay harness tests ≥500 battles/archetype against baseline defaults and reports drift in trade count, holding time, drawdown, concentration, and scoring outcome.
- **External Signal Weight** ships only once the user-surfaced-signal rail exists.
